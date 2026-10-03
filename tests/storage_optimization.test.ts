// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import test from "node:test"
import {
  completeManualItem, completeManualOccurrence, defaultState, deleteItem,
  listLocalSnapshots, loadState, LOCAL_SNAPSHOTS_KEY, manualOccurrenceKey,
  normalizeReminderCalendarIDs, normalizeState, planManualCompletion,
  readRecoveryStatus, recordReminderCompletion, saveState,
  STATE_KEY, undoManualCompletion, updateItemIconChoice, updateManualItemIcon,
  updateSettings, upsertItem,
} from "../到期管家/src/storage.ts"
import { createRecurrenceRule } from "../到期管家/src/date.ts"
import { createBackupJSON, parseBackupJSON, restoreBackupJSON } from "../到期管家/src/recovery.ts"
import type { AppState, ManualDueItem } from "../到期管家/src/types.ts"

function item(overrides: Partial<ManualDueItem> = {}): ManualDueItem {
  return {
    id: "manual", title: "Keep", kind: "custom", iconName: null,
    dueDate: "2026-10-03", includesTime: false, hour: 9, minute: 0,
    remindBeforeDays: 0, recurrence: createRecurrenceRule("month", 1, "2026-10-03"),
    amount: "USD 25", note: "Keep private note", enabled: true, createdAt: 1, updatedAt: 2,
    ...overrides,
  }
}

function initialState(): AppState {
  return { ...defaultState(2), items: [item(), item({ id: "unrelated", title: "Unrelated" })] }
}

function environment(initial: AppState | null = initialState(), legacy: AppState | null = null) {
  const original = (globalThis as any).Storage
  const values = new Map<string, any>()
  if (initial) values.set(STATE_KEY, structuredClone(initial))
  const writes: string[] = []
  let stateReads = 0
  let beforeStateRead: ((count: number) => void) | undefined
  let afterSnapshotWrite: (() => void) | undefined
  let failSnapshot = false
  ;(globalThis as any).Storage = {
    get: (key: string, options?: { shared: boolean }) => {
      if (!options?.shared) return key === STATE_KEY ? structuredClone(legacy) : null
      if (key === STATE_KEY) beforeStateRead?.(++stateReads)
      return structuredClone(values.get(key) ?? null)
    },
    set: (key: string, value: unknown) => {
      if (key === LOCAL_SNAPSHOTS_KEY && failSnapshot) return false
      writes.push(key)
      values.set(key, structuredClone(value))
      if (key === LOCAL_SNAPSHOTS_KEY) afterSnapshotWrite?.()
      return true
    },
    remove: (key: string) => { values.delete(key) },
    contains: (key: string) => values.has(key),
  }
  return {
    values, writes,
    onStateRead(callback: (count: number) => void) { beforeStateRead = callback },
    onSnapshotWrite(callback: () => void) { afterSnapshotWrite = callback },
    failSnapshot() { failSnapshot = true },
    cleanup() { (globalThis as any).Storage = original },
  }
}

interface MutationCase {
  name: string
  state?: () => AppState
  preflightRead?: number
  run(state: AppState): unknown
}
const mutations: MutationCase[] = [
  { name: "settings", run: () => updateSettings({ showAmounts: false }) },
  { name: "upsert", run: state => upsertItem({ ...state.items[0], title: "New title" }, 2) },
  { name: "delete", run: () => deleteItem("manual", 2) },
  { name: "widget completion", run: state => completeManualOccurrence("manual", manualOccurrenceKey(state.items[0]), 500) },
  { name: "editor completion", run: state => completeManualItem({ ...state.items[0], title: "Completed edited" }, 2, false, 500) },
  { name: "item icon", run: () => updateItemIconChoice("manual", "manual", { iconID: "sf:car.fill", expectedIconID: null }) },
  { name: "legacy manual icon", preflightRead: 3, run: () => updateManualItemIcon("manual", "car.fill", 2, null) },
  { name: "Apple completion history", run: () => recordReminderCompletion({ id: "apple", title: "Apple", dueDate: "2026-10-03" }, 500) },
  {
    name: "undo",
    state: () => planManualCompletion(initialState(), "manual", manualOccurrenceKey(item()), 500).state,
    run: state => undoManualCompletion(state.completionHistory![0].id, 600),
  },
]

function externalChange(state: AppState, sameRevision: boolean): AppState {
  return {
    ...state,
    updatedAt: sameRevision ? state.updatedAt : state.updatedAt + 10,
    items: state.items.map(value => value.id === "unrelated"
      ? { ...value, title: "New external title", note: "Newest private note" } : value),
  }
}

test("every local mutation rejects an already observed external edit, including same-revision content", () => {
  for (const mutation of mutations) for (const sameRevision of [false, true]) {
    const state = mutation.state?.() ?? initialState()
    const env = environment(state)
    const newest = externalChange(state, sameRevision)
    try {
      env.onStateRead(count => {
        if (count === (mutation.preflightRead ?? 2)) env.values.set(STATE_KEY, structuredClone(newest))
      })
      assert.throws(() => mutation.run(state), /其他位置更新|覆盖新数据/, mutation.name)
      assert.deepEqual(env.values.get(STATE_KEY), newest, mutation.name)
      assert.deepEqual(env.writes, [], mutation.name)
    } finally { env.cleanup() }
  }
})

test("all local mutations recheck after snapshot writes and preserve both new data and rollback snapshots", () => {
  for (const mutation of mutations) {
    const state = mutation.state?.() ?? initialState()
    const env = environment(state)
    const newest = externalChange(state, true)
    try {
      env.onSnapshotWrite(() => env.values.set(STATE_KEY, structuredClone(newest)))
      assert.throws(() => mutation.run(state), /备份期间|覆盖新数据/, mutation.name)
      assert.deepEqual(env.values.get(STATE_KEY), newest, mutation.name)
      assert.deepEqual(env.writes, [LOCAL_SNAPSHOTS_KEY], mutation.name)
      const snapshot = listLocalSnapshots()[0]
      assert.deepEqual(snapshot.state, normalizeState(state), mutation.name)
      assert.equal(snapshot.state.items[1].note, "Keep private note", mutation.name)
      assert.equal(snapshot.state.completionHistory?.length ?? 0, state.completionHistory?.length ?? 0, mutation.name)
    } finally { env.cleanup() }
  }
})

test("all local mutations keep normal save semantics and one pre-mutation rollback snapshot", () => {
  for (const mutation of mutations) {
    const state = mutation.state?.() ?? initialState()
    const env = environment(state)
    try {
      mutation.run(state)
      assert.deepEqual(env.writes, [LOCAL_SNAPSHOTS_KEY, STATE_KEY], mutation.name)
      assert.deepEqual(listLocalSnapshots()[0].state, normalizeState(state), mutation.name)
      assert.equal(loadState().items.find(value => value.id === "unrelated")?.note, "Keep private note", mutation.name)
      assert.ok(parseBackupJSON(createBackupJSON()).itemCount > 0, mutation.name)
    } finally { env.cleanup() }
  }
})

test("snapshot failure and final preflight read failure never replace primary state", () => {
  for (const failure of ["snapshot", "final read"] as const) {
    const state = initialState()
    const env = environment(state)
    try {
      if (failure === "snapshot") env.failSnapshot()
      else env.onStateRead(count => { if (count === 3) throw Error("Storage temporarily unavailable") })
      assert.throws(() => updateSettings({ showAmounts: false }), /无法保存|Storage temporarily unavailable/)
      assert.deepEqual(env.values.get(STATE_KEY), state)
      assert.equal(env.writes.includes(STATE_KEY), false)
      assert.equal(env.writes.includes(LOCAL_SNAPSHOTS_KEY), failure === "final read")
    } finally { env.cleanup() }
  }
})

test("first saves distinguish absent storage from a saved empty state removed during a mutation", () => {
  {
    const env = environment(null)
    try {
      upsertItem(item())
      assert.equal(loadState().items[0].id, "manual")
      assert.deepEqual(env.writes, [STATE_KEY])
    } finally { env.cleanup() }
  }
  {
    const env = environment(defaultState(2))
    try {
      env.onStateRead(count => { if (count === 2) env.values.delete(STATE_KEY) })
      assert.throws(() => updateSettings({ showAmounts: false }), /其他位置更新/)
      assert.equal(env.values.has(STATE_KEY), false)
      assert.deepEqual(env.writes, [])
    } finally { env.cleanup() }
  }
  {
    const env = environment(null)
    const newest = initialState()
    try {
      // The private-domain legacy probe is separate from shared-state reads.
      env.onStateRead(count => { if (count === 2) env.values.set(STATE_KEY, structuredClone(newest)) })
      assert.throws(() => upsertItem(item()), /其他位置更新/)
      assert.deepEqual(env.values.get(STATE_KEY), newest)
      assert.deepEqual(env.writes, [])
    } finally { env.cleanup() }
  }
})

test("legacy private data migration remains compatible with guarded mutations", () => {
  const legacy = initialState()
  const env = environment(null, legacy)
  try {
    updateSettings({ showAmounts: false })
    assert.deepEqual(env.writes, [STATE_KEY, LOCAL_SNAPSHOTS_KEY, STATE_KEY])
    assert.equal(loadState().settings.showAmounts, false)
    assert.deepEqual(listLocalSnapshots()[0].state.items, legacy.items)
  } finally { env.cleanup() }
})

test("unchanged ancient shared states without revisions do not confuse read-clock fallbacks with edits", () => {
  const originalNow = Date.now
  for (const revision of [undefined, "not-a-number", null]) {
    const env = environment()
    try {
      const raw = { ...initialState(), updatedAt: revision }
      env.values.set(STATE_KEY, raw)
      let clock = 1000
      Date.now = () => clock++
      updateSettings({ showAmounts: false })
      assert.equal(loadState().settings.showAmounts, false)
      assert.deepEqual(env.writes, [LOCAL_SNAPSHOTS_KEY, STATE_KEY])
      assert.equal(listLocalSnapshots()[0].state.updatedAt, 1000)
    } finally { Date.now = originalNow; env.cleanup() }
  }
})

test("removing a real revision during a mutation is still an observed conflict", () => {
  const env = environment()
  try {
    env.onStateRead(count => {
      if (count === 2) {
        const latest = structuredClone(env.values.get(STATE_KEY))
        delete latest.updatedAt
        env.values.set(STATE_KEY, latest)
      }
    })
    assert.throws(() => updateSettings({ showAmounts: false }), /其他位置更新/)
    assert.equal("updatedAt" in env.values.get(STATE_KEY), false)
    assert.deepEqual(env.writes, [])
  } finally { env.cleanup() }
})

test("newly observed malformed or future-schema states block mutations without creating misleading snapshots", () => {
  for (const latest of [
    { schemaVersion: 99, items: [], settings: {}, updatedAt: 2, futureData: "Keep verbatim" },
    { ...initialState(), items: [{ title: "Damaged original", dueDate: "invalid" }] },
    { ...initialState(), completionHistory: [{}] },
  ]) {
    const env = environment()
    try {
      env.onStateRead(count => { if (count === 2) env.values.set(STATE_KEY, structuredClone(latest)) })
      assert.throws(() => updateSettings({ showAmounts: false }), /版本|丢弃|完成记录/)
      assert.deepEqual(env.values.get(STATE_KEY), latest)
      assert.deepEqual(env.writes, [])
    } finally { env.cleanup() }
  }
})

test("legacy inactive choices and unknown valid SF selections survive normal writes and backup restore", () => {
  const state = initialState()
  state.settings.smallWidgetIconStyle = "brand"
  state.settings.itemBrandChoices = [{ source: "reminder", itemID: "__proto__", brandID: "unknown-future-brand" }]
  state.settings.itemIconChoices = [
    { source: "reminder", itemID: "__proto__", iconID: "sf:future.symbol.fill" },
    { source: "manual", itemID: "manual", iconID: "sf:car.fill" },
  ]
  const env = environment(state)
  try {
    updateSettings({ showAmounts: false })
    completeManualOccurrence("manual", manualOccurrenceKey(item()), 500)
    const loaded = loadState()
    assert.equal(loaded.settings.smallWidgetIconStyle, "brand")
    assert.deepEqual(loaded.settings.itemBrandChoices, state.settings.itemBrandChoices)
    assert.deepEqual(loaded.settings.itemIconChoices, state.settings.itemIconChoices)
    const backup = createBackupJSON(600)
    const restored = restoreBackupJSON(backup)
    assert.deepEqual(restored.settings.itemBrandChoices, state.settings.itemBrandChoices)
    assert.deepEqual(restored.settings.itemIconChoices, state.settings.itemIconChoices)
    assert.equal(restored.items[1].note, state.items[1].note)
  } finally { env.cleanup() }
})

test("damaged explicit reminder-list selections fail closed before reads or mutations can widen the scope", () => {
  for (const scope of [
    null, undefined, "home", {}, [null], [7], [""], [" \u3000 "],
    ["home", " "] , Array.from({ length: 101 }, () => "home"),
    ["x".repeat(513)], ["home", "work\n"], ["home\t"], ["id\u0000"], ["id\u007f"],
  ]) {
    const env = environment()
    const raw = { ...initialState(), settings: { ...initialState().settings, includeReminders: true, reminderCalendarIDs: scope } }
    try {
      env.values.set(STATE_KEY, structuredClone(raw))
      assert.throws(() => loadState(), /列表筛选损坏.*没有扩大至全部列表.*原数据已保留/)
      const status = readRecoveryStatus()
      assert.equal(status.status, "damaged")
      assert.equal(status.canRestore, true)
      assert.match(status.message!, /列表筛选损坏.*没有扩大至全部列表/)
      assert.throws(() => updateSettings({ showAmounts: false }), /列表筛选损坏/)
      assert.throws(() => saveState(defaultState(2)), /列表筛选损坏/)
      assert.deepEqual(env.values.get(STATE_KEY), raw)
      assert.deepEqual(env.writes, [])
    } finally { env.cleanup() }
  }
})

test("legacy missing, explicit all-list, and valid trimmed or repeated list IDs keep their original semantics", () => {
  const cases = [
    { supplied: false, raw: undefined, expected: [] },
    { supplied: true, raw: [], expected: [] },
    { supplied: true, raw: [" home ", "work", "home"], expected: ["home", "work"] },
    { supplied: true, raw: ["x".repeat(512)], expected: ["x".repeat(512)] },
  ]
  for (const sample of cases) {
    const env = environment()
    try {
      const raw: any = { ...initialState(), settings: { ...initialState().settings, includeReminders: true } }
      if (sample.supplied) raw.settings.reminderCalendarIDs = sample.raw
      else delete raw.settings.reminderCalendarIDs
      env.values.set(STATE_KEY, structuredClone(raw))
      assert.deepEqual(loadState().settings.reminderCalendarIDs, sample.expected)
      assert.equal(readRecoveryStatus().status, "ready")
      assert.deepEqual(env.writes, [])
      updateSettings({ showAmounts: false })
      assert.deepEqual(loadState().settings.reminderCalendarIDs, sample.expected)
      assert.equal(loadState().settings.includeReminders, true)
      assert.deepEqual(parseBackupJSON(createBackupJSON()).state.settings.reminderCalendarIDs, sample.expected)
    } finally { env.cleanup() }
  }
})

test("public tolerant scope and state normalizers remain compatible with callers", () => {
  assert.deepEqual(normalizeReminderCalendarIDs(null), [])
  assert.deepEqual(normalizeReminderCalendarIDs([null, " home ", "", "home"]), ["home"])
  assert.deepEqual(normalizeState({ ...initialState(), settings: { reminderCalendarIDs: [null, ""] } }).settings.reminderCalendarIDs, [])
})

test("explicit saveState replacements and validated backup restoration retain existing APIs", () => {
  const env = environment()
  try {
    const backup = createBackupJSON(500)
    const replacement = { ...defaultState(10), items: [item({ id: "replacement" })] }
    assert.equal(saveState(replacement, "Explicit replacement"), true)
    assert.equal(loadState().items[0].id, "replacement")
    assert.equal(listLocalSnapshots()[0].reason, "Explicit replacement")
    const restored = restoreBackupJSON(backup)
    assert.deepEqual(restored.items.map(value => value.id), ["manual", "unrelated"])
    assert.equal(listLocalSnapshots()[0].reason, "导入前备份")
    assert.throws(() => upsertItem(item(), 2), /其他位置更新|覆盖新数据/)
  } finally { env.cleanup() }
})

/** The previous first-fit algorithm is kept only as a regression oracle. */
function legacyUniqueIDs(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const reserved = new Set(ids)
  return ids.map(base => {
    if (!seen.has(base)) { seen.add(base); return base }
    let suffix = 2
    let id: string
    do {
      const ending = `-duplicate-${suffix++}`
      id = `${base.slice(0, 160 - ending.length)}${ending}`
    } while (seen.has(id) || reserved.has(id))
    seen.add(id)
    return id
  })
}

test("duplicate ID acceleration preserves first-fit ordering, reserved originals and colliding long bases", () => {
  const bases = ["same", "same-duplicate-2", "same-duplicate-3", "__proto__", "constructor",
    "x".repeat(160), "x".repeat(159) + "y", "x".repeat(148) + "-duplicate-2"]
  let seed = 123456789
  for (let iteration = 0; iteration < 50; iteration++) {
    const ids = Array.from({ length: 200 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return bases[seed % bases.length]
    })
    const state = normalizeState({ ...defaultState(2), items: ids.map(id => item({ id })) })
    const normalizedOriginalIDs = ids.map(id => normalizeState({ ...defaultState(2), items: [item({ id })] }).items[0].id)
    assert.deepEqual(state.items.map(value => value.id), legacyUniqueIDs(normalizedOriginalIDs))
    assert.equal(new Set(state.items.map(value => value.id)).size, ids.length)
    assert.ok(state.items.every(value => value.id.length <= 160))
    assert.deepEqual(normalizeState(state).items.map(value => value.id), state.items.map(value => value.id))
  }
})

test("large duplicate batches preserve all notes and roundtrip through backups without ID churn", () => {
  const data = Array.from({ length: 4000 }, (_, index) => item({ id: "same", note: `Private ${index}` }))
  // Reserve a later original ID before generated duplicates can claim it.
  data.push(item({ id: "same-duplicate-4002", note: "Reserved original" }))
  const env = environment({ ...defaultState(2), items: data })
  try {
    const loaded = loadState()
    assert.equal(loaded.items.length, data.length)
    assert.equal(loaded.items[1].id, "same-duplicate-2")
    assert.equal(loaded.items.at(-1)?.id, "same-duplicate-4002")
    updateSettings({ showAmounts: false })
    const parsed = parseBackupJSON(createBackupJSON())
    assert.deepEqual(parsed.state.items.map(value => value.id), loaded.items.map(value => value.id))
    assert.deepEqual(parsed.state.items.map(value => value.note), data.map(value => value.note))
  } finally { env.cleanup() }
})
