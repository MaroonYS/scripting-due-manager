import assert from "node:assert/strict"
import test from "node:test"
import { createRecurrenceRule } from "../到期管家/src/date.ts"
import {
  completeManualItem, completeManualOccurrence, createLocalSnapshot, defaultState,
  deleteItem, listCompletionHistory, listLocalSnapshots, loadState,
  LOCAL_SNAPSHOTS_KEY, manualOccurrenceKey, MAX_COMPLETION_HISTORY,
  MAX_LOCAL_SNAPSHOTS, restoreLocalSnapshot, saveState, STATE_KEY,
  undoManualCompletion, updateSettings, upsertItem,
} from "../到期管家/src/storage.ts"
import { createBackupJSON, parseBackupJSON, restoreBackupJSON } from "../到期管家/src/recovery.ts"
import { completeReminderOccurrence } from "../到期管家/src/reminders.ts"
import { defaultNotificationSettings, loadNotificationSettings, NOTIFICATION_SETTINGS_KEY, updateNotificationSettings } from "../到期管家/src/notifications.ts"
import type { AppState, ManualDueItem } from "../到期管家/src/types.ts"

function item(overrides: Partial<ManualDueItem> = {}): ManualDueItem {
  return {
    id: "manual-1", title: "Monthly subscription", kind: "subscription", iconName: null,
    dueDate: "2026-09-30", includesTime: true, hour: 18, minute: 0,
    remindBeforeDays: 3, recurrence: createRecurrenceRule("month", 1, "2026-09-30"),
    amount: "USD 20", note: "Preserve this note", enabled: true, createdAt: 1, updatedAt: 2,
    ...overrides,
  }
}

function setup(items = [item()]) {
  const original = (globalThis as any).Storage
  const values = new Map<string, unknown>()
  const initial: AppState = { ...defaultState(2), items }
  values.set(STATE_KEY, structuredClone(initial))
  const failures = new Set<string>()
  ;(globalThis as any).Storage = {
    get: (key: string, options?: { shared: boolean }) => options?.shared
      ? structuredClone(values.get(key) ?? null) : null,
    set: (key: string, value: unknown) => {
      if (failures.has(key)) return false
      values.set(key, structuredClone(value))
      return true
    },
    remove: (key: string) => { values.delete(key) },
    contains: (key: string) => values.has(key),
  }
  return { values, failures, initial, cleanup: () => { (globalThis as any).Storage = original } }
}

test("loading and saving more than 1000 manual items never truncates them", () => {
  const data = Array.from({ length: 1507 }, (_, index) => item({ id: `item-${index}` }))
  const env = setup(data)
  try {
    assert.equal(loadState().items.length, data.length)
    updateSettings({ showAmounts: false })
    assert.equal(loadState().items.length, data.length)
    assert.equal(loadState().items.at(-1)?.id, "item-1506")
    assert.equal(listLocalSnapshots()[0].state.items.length, data.length)
    assert.equal(parseBackupJSON(createBackupJSON()).itemCount, data.length)
  } finally { env.cleanup() }
})

test("manual completion stores its exact before and after in the same state write", () => {
  const env = setup()
  try {
    const before = loadState().items[0]
    assert.equal(completeManualOccurrence(before.id, manualOccurrenceKey(before), 500), "applied")
    const state = loadState()
    const record = state.completionHistory![0]
    assert.equal(record.completedAt, 500)
    assert.deepEqual(record.before, before)
    assert.deepEqual(record.after, state.items[0])
    assert.equal(record.dueDate, "2026-09-30")
    assert.equal(state.items[0].dueDate, "2026-10-30")
    assert.equal(completeManualOccurrence(before.id, manualOccurrenceKey(before), 501), "stale")
    assert.equal(listCompletionHistory().length, 1)
  } finally { env.cleanup() }
})

test("undo completion restores the completed occurrence without overwriting other items or settings", () => {
  const env = setup([item(), item({ id: "unrelated" })])
  try {
    const before = loadState().items[0]
    completeManualOccurrence(before.id, manualOccurrenceKey(before), 500)
    const completed = loadState().items[0]
    const record = listCompletionHistory()[0]
    updateSettings({ showAmounts: false })
    upsertItem({ ...loadState().items[1], title: "Unrelated changed", updatedAt: 1000 }, 2)
    const restored = undoManualCompletion(record.id, 600)
    assert.equal(restored.items[0].dueDate, before.dueDate)
    assert.equal(restored.items[0].enabled, true)
    assert.ok(restored.items[0].updatedAt > completed.updatedAt)
    assert.equal(restored.items[1].title, "Unrelated changed")
    assert.equal(restored.settings.showAmounts, false)
    assert.equal(restored.completionHistory![0].undoneAt, 600)
    assert.throws(() => undoManualCompletion(record.id), /已撤销/)
    assert.equal(completeManualOccurrence(before.id, manualOccurrenceKey(completed)), "stale")
  } finally { env.cleanup() }
})

test("undoing one-time completion makes the original item visible again", () => {
  const env = setup([item({ recurrence: null })])
  try {
    const before = loadState().items[0]
    completeManualOccurrence(before.id, manualOccurrenceKey(before))
    assert.equal(loadState().items[0].enabled, false)
    undoManualCompletion(listCompletionHistory()[0].id)
    assert.equal(loadState().items[0].enabled, true)
  } finally { env.cleanup() }
})

test("undo refuses later edits even if an external write reuses the same item revision", () => {
  const env = setup()
  try {
    const before = loadState().items[0]
    completeManualOccurrence(before.id, manualOccurrenceKey(before))
    const record = listCompletionHistory()[0]
    const state = loadState()
    state.items[0].note = "Edited externally"
    env.values.set(STATE_KEY, state)
    assert.throws(() => undoManualCompletion(record.id), /完成后已被编辑/)
    assert.equal(loadState().items[0].note, "Edited externally")
    assert.equal(listCompletionHistory()[0].undoneAt, null)
  } finally { env.cleanup() }
})

test("undo refuses a later completion or deletion", () => {
  const env = setup()
  try {
    let current = loadState().items[0]
    completeManualOccurrence(current.id, manualOccurrenceKey(current))
    const first = listCompletionHistory()[0]
    current = loadState().items[0]
    completeManualOccurrence(current.id, manualOccurrenceKey(current))
    assert.throws(() => undoManualCompletion(first.id), /完成后已被编辑/)
    const second = listCompletionHistory()[0]
    deleteItem(current.id)
    assert.throws(() => undoManualCompletion(second.id), /完成后已被编辑/)
    assert.deepEqual(loadState().items, [])
  } finally { env.cleanup() }
})

test("editor completion atomically saves edits, records skip action, and rejects stale editors", () => {
  const env = setup()
  try {
    const original = loadState().items[0]
    const edited = { ...original, title: "Edited and completed", updatedAt: 300 }
    const saved = completeManualItem(edited, original.updatedAt, true, new Date(2027, 1, 1).getTime())
    assert.equal(saved.items[0].title, edited.title)
    assert.ok(saved.items[0].dueDate > "2027-02-01")
    assert.equal(listCompletionHistory()[0].action, "skip")
    assert.throws(() => completeManualItem(edited, original.updatedAt), /为避免覆盖新数据/)
    undoManualCompletion(listCompletionHistory()[0].id)
    assert.equal(loadState().items[0].title, edited.title)
    assert.equal(loadState().items[0].dueDate, original.dueDate)
  } finally { env.cleanup() }
})

test("local snapshots are bounded and capture state before destructive mutations", () => {
  const env = setup()
  try {
    const original = createLocalSnapshot("手动更新前")
    assert.equal(original.reason, "手动更新前")
    for (let index = 0; index < 15; index += 1) updateSettings({ showAmounts: index % 2 === 0 })
    assert.equal(listLocalSnapshots().length, MAX_LOCAL_SNAPSHOTS)
    const previous = loadState()
    deleteItem(previous.items[0].id)
    const latest = listLocalSnapshots()[0]
    assert.equal(latest.state.items[0].title, previous.items[0].title)
    const restored = restoreLocalSnapshot(latest.id)
    assert.equal(restored.items.length, 1)
    assert.ok(restored.items[0].updatedAt > previous.items[0].updatedAt)
    assert.equal(listLocalSnapshots()[0].reason, "恢复前备份")
    assert.deepEqual(listLocalSnapshots()[0].state.items, [])
  } finally { env.cleanup() }
})

test("snapshot write failures block mutation while preserving the complete original state", () => {
  const env = setup()
  try {
    const before = loadState()
    env.failures.add(LOCAL_SNAPSHOTS_KEY)
    assert.equal(saveState({ ...before, items: [] }), false)
    assert.throws(() => deleteItem(before.items[0].id), /无法保存/)
    assert.throws(() => completeManualOccurrence(before.items[0].id, manualOccurrenceKey(before.items[0])), /无法保存/)
    assert.deepEqual(loadState(), before)
    assert.deepEqual(listCompletionHistory(), [])
  } finally { env.cleanup() }
})

test("failed primary state write cannot leave a false completion record", () => {
  const env = setup()
  try {
    const before = loadState()
    env.failures.add(STATE_KEY)
    assert.throws(() => completeManualOccurrence(before.items[0].id, manualOccurrenceKey(before.items[0])), /无法保存/)
    assert.deepEqual(loadState(), before)
    assert.equal(listCompletionHistory().length, 0)
    assert.equal(listLocalSnapshots()[0].state.items[0].dueDate, before.items[0].dueDate)
  } finally { env.cleanup() }
})

test("failed undo write preserves both the completed state and active history entry", () => {
  const env = setup()
  try {
    const before = loadState().items[0]
    completeManualOccurrence(before.id, manualOccurrenceKey(before))
    const completed = loadState()
    env.failures.add(STATE_KEY)
    assert.throws(() => undoManualCompletion(completed.completionHistory![0].id), /无法保存/)
    assert.deepEqual(loadState(), completed)
  } finally { env.cleanup() }
})

test("backup JSON includes manual data, selected Reminder list scope, and completion history", () => {
  const env = setup()
  try {
    updateSettings({ includeReminders: true, reminderCalendarIDs: ["private-list-id"] })
    const current = loadState().items[0]
    completeManualOccurrence(current.id, manualOccurrenceKey(current))
    const parsed = parseBackupJSON(createBackupJSON(777))
    assert.equal(parsed.exportedAt, 777)
    assert.equal(parsed.schemaVersion, 3)
    assert.equal(parsed.itemCount, 1)
    assert.equal(parsed.historyCount, 1)
    assert.deepEqual(parsed.state, loadState())
    assert.deepEqual(parsed.state.settings.reminderCalendarIDs, ["private-list-id"])
  } finally { env.cleanup() }
})

test("malformed or lossy backups are rejected without writing any state or snapshots", () => {
  const env = setup()
  try {
    const source = JSON.parse(createBackupJSON())
    const mutate = (fn: (backup: any) => void) => { const backup = structuredClone(source); fn(backup); return JSON.stringify(backup) }
    const malformed = [
      "not-json", "[]", "{}", JSON.stringify({ ...source, version: 999 }),
      mutate(value => value.state.items.push(value.state.items[0])),
      mutate(value => value.state.items[0].dueDate = "2026-02-31"),
      mutate(value => value.state.items[0].title = ""),
      mutate(value => value.state.items[0].note = "x".repeat(1001)),
      mutate(value => value.state.items[0].recurrence.interval = 0),
      mutate(value => value.state.items[0].includesTime = "true"),
      mutate(value => value.state.items[0].remindBeforeDays = 366),
      mutate(value => value.state.settings.reminderCalendarIDs = [""]),
      mutate(value => value.state.settings.reminderCalendarIDs = ["same", "same"]),
      mutate(value => value.state.completionHistory = [{}]),
    ]
    const before = loadState()
    for (const json of malformed) assert.throws(() => restoreBackupJSON(json))
    assert.deepEqual(loadState(), before)
    assert.deepEqual(listLocalSnapshots(), [])
  } finally { env.cleanup() }
})

test("import creates rollback snapshot and invalidates all previously rendered item buttons", () => {
  const env = setup()
  try {
    const original = loadState()
    const json = createBackupJSON()
    upsertItem({ ...original.items[0], title: "Changed before restore", updatedAt: 20 }, 2)
    const restored = restoreBackupJSON(json)
    assert.equal(restored.items[0].title, original.items[0].title)
    assert.ok(restored.items[0].updatedAt > 20)
    assert.equal(listLocalSnapshots()[0].reason, "导入前备份")
    assert.equal(listLocalSnapshots()[0].state.items[0].title, "Changed before restore")
    assert.equal(completeManualOccurrence(original.items[0].id, manualOccurrenceKey(original.items[0])), "stale")
  } finally { env.cleanup() }
})

test("failed import does not replace data, and keeps a usable pre-import snapshot", () => {
  const env = setup()
  try {
    const json = createBackupJSON()
    upsertItem({ ...loadState().items[0], title: "Keep current", updatedAt: 20 }, 2)
    const before = loadState()
    env.failures.add(STATE_KEY)
    assert.throws(() => restoreBackupJSON(json), /恢复失败/)
    assert.deepEqual(loadState(), before)
    assert.equal(listLocalSnapshots()[0].state.items[0].title, "Keep current")
  } finally { env.cleanup() }
})

test("notification preferences travel with backup but restore never automatically enables alerts", () => {
  const env = setup()
  try {
    updateNotificationSettings({ enabled: true, hour: 7, minute: 15, includeDueDate: true, mutedItemIDs: ["manual-1"] })
    const json = createBackupJSON()
    assert.equal(parseBackupJSON(json).notificationSettings?.enabled, true)
    updateNotificationSettings({ hour: 21, minute: 0, mutedItemIDs: [] })
    restoreBackupJSON(json)
    assert.deepEqual(loadNotificationSettings(), {
      schemaVersion: 1, enabled: false, hour: 7, minute: 15, includeDueDate: true, mutedItemIDs: ["manual-1"],
    })
    assert.equal(listLocalSnapshots()[0].notificationSettings?.hour, 21)
    assert.equal(listLocalSnapshots()[0].notificationSettings?.enabled, true)
    restoreLocalSnapshot(listLocalSnapshots()[0].id)
    assert.equal(loadNotificationSettings().hour, 21)
    assert.equal(loadNotificationSettings().enabled, false)
  } finally { env.cleanup() }
})

test("failed notification settings write blocks import before replacing manual data", () => {
  const env = setup()
  try {
    const json = createBackupJSON()
    upsertItem({ ...loadState().items[0], title: "Keep current", updatedAt: 20 }, 2)
    const before = loadState()
    env.failures.add(NOTIFICATION_SETTINGS_KEY)
    assert.throws(() => restoreBackupJSON(json), /无法安全关闭并恢复通知设置/)
    assert.deepEqual(loadState(), before)
    assert.equal(listLocalSnapshots()[0].state.items[0].title, "Keep current")
  } finally { env.cleanup() }
})

test("failed primary import write rolls notification preferences back to their exact previous values", () => {
  const env = setup()
  try {
    const json = createBackupJSON()
    updateNotificationSettings({ enabled: true, hour: 19, minute: 42, mutedItemIDs: ["manual-1"] })
    const previousNotifications = loadNotificationSettings()
    const before = loadState()
    env.failures.add(STATE_KEY)
    assert.throws(() => restoreBackupJSON(json), /原事项和通知设置没有被替换/)
    assert.deepEqual(loadState(), before)
    assert.deepEqual(loadNotificationSettings(), previousNotifications)
  } finally { env.cleanup() }
})

test("old backup without notification settings is accepted and leaves notifications safely off", () => {
  const env = setup()
  try {
    const raw = JSON.parse(createBackupJSON())
    delete raw.notificationSettings
    updateNotificationSettings({ enabled: true, hour: 16 })
    restoreBackupJSON(JSON.stringify(raw))
    assert.equal(loadNotificationSettings().enabled, false)
    assert.equal(loadNotificationSettings().hour, 16)
    const invalid = { ...raw, notificationSettings: { ...defaultNotificationSettings(), hour: 24 } }
    assert.throws(() => parseBackupJSON(JSON.stringify(invalid)), /通知设置无效/)
  } finally { env.cleanup() }
})

test("malformed stored states fail closed and cannot be overwritten with an empty fallback", () => {
  const env = setup()
  try {
    for (const raw of ["broken", { schemaVersion: 3, items: null }, { ...defaultState(), items: [{ title: "No valid date" }] },
      { ...defaultState(), completionHistory: [{}] }]) {
      env.values.set(STATE_KEY, structuredClone(raw))
      assert.throws(() => loadState())
      assert.throws(() => saveState(defaultState()))
      assert.deepEqual(env.values.get(STATE_KEY), raw)
    }
  } finally { env.cleanup() }
})

test("malformed snapshot indexes and entries are preserved rather than reset", () => {
  const env = setup()
  try {
    const before = loadState()
    for (const raw of [{ schemaVersion: 2, snapshots: [] }, { schemaVersion: 1, snapshots: [{}] },
      { schemaVersion: 1, snapshots: [{ id: "broken", createdAt: 1, reason: "Auto", state: { items: [null] } }] }]) {
      env.values.set(LOCAL_SNAPSHOTS_KEY, structuredClone(raw))
      assert.throws(() => listLocalSnapshots())
      assert.throws(() => deleteItem(before.items[0].id))
      assert.deepEqual(loadState(), before)
      assert.deepEqual(env.values.get(LOCAL_SNAPSHOTS_KEY), raw)
    }
  } finally { env.cleanup() }
})

test("completion history stays bounded without dropping any manual items", () => {
  const env = setup()
  try {
    for (let index = 0; index < MAX_COMPLETION_HISTORY + 3; index += 1) {
      const current = loadState().items[0]
      completeManualOccurrence(current.id, manualOccurrenceKey(current), 1000 + index)
    }
    assert.equal(listCompletionHistory().length, MAX_COMPLETION_HISTORY)
    assert.equal(listCompletionHistory()[0].completedAt, 1102)
    assert.equal(loadState().items.length, 1)
  } finally { env.cleanup() }
})

test("Apple completion records successful writes but refuses unsafe programmatic undo", async () => {
  const env = setup()
  const originalReminder = (globalThis as any).Reminder
  let saves = 0
  const reminder = {
    identifier: "apple-1", title: "Apple task", isCompleted: false,
    dueDateComponents: { date: new Date(2026, 8, 30), year: 2026, month: 9, day: 30 },
    recurrenceRules: [{ frequency: "monthly" }],
    save: async () => { saves += 1 },
  }
  ;(globalThis as any).Reminder = { get: async () => reminder }
  try {
    assert.equal(await completeReminderOccurrence(reminder.identifier, "date:2026-09-30"), "applied")
    const record = listCompletionHistory()[0]
    assert.equal(record.source, "reminder")
    assert.equal(record.title, reminder.title)
    assert.throws(() => undoManualCompletion(record.id), /系统提醒事项 App/)
    assert.equal(reminder.isCompleted, true)
    assert.equal(saves, 1)
    assert.equal(await completeReminderOccurrence(reminder.identifier, "date:2026-09-30"), "missing")
    assert.equal(listCompletionHistory().length, 1)
  } finally { env.cleanup(); (globalThis as any).Reminder = originalReminder }
})

test("failed Apple save never records completion; a local failure after success is only a warning", async () => {
  const env = setup()
  const originalReminder = (globalThis as any).Reminder
  let failSave = true
  const reminder = {
    identifier: "apple-2", title: "Apple task", isCompleted: false,
    dueDateComponents: { date: new Date(2026, 8, 30), year: 2026, month: 9, day: 30 },
    save: async () => { if (failSave) throw new Error("EventKit failed") },
  }
  ;(globalThis as any).Reminder = { get: async () => reminder }
  try {
    await assert.rejects(() => completeReminderOccurrence(reminder.identifier, "date:2026-09-30"), /EventKit failed/)
    assert.deepEqual(listCompletionHistory(), [])
    failSave = false
    reminder.isCompleted = false
    env.failures.add(STATE_KEY)
    assert.equal(await completeReminderOccurrence(reminder.identifier, "date:2026-09-30"), "appliedCacheStale")
    assert.equal(reminder.isCompleted, true)
    assert.deepEqual(listCompletionHistory(), [])
  } finally { env.cleanup(); (globalThis as any).Reminder = originalReminder }
})
