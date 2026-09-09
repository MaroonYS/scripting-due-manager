// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { createHash } from "node:crypto"
import test from "node:test"
import * as storage from "../到期管家/src/storage.ts"
import { ARTWORK_CATALOG, artworkByID, searchArtwork, withItemIconChoices } from "../到期管家/src/artwork_catalog.ts"
import { applyItemIconEdit, itemIconID, normalizeItemIconChoices } from "../到期管家/src/icon_preferences.ts"
import { createBackupJSON, parseBackupJSON } from "../到期管家/src/recovery.ts"
import { createRecurrenceRule } from "../到期管家/src/date.ts"
import type { DisplayDueItem, ManualDueItem } from "../到期管家/src/types.ts"

const chat = "icons8-ka3InxFU3QZa", claude = "icons8-zQjzFjPpT2Ek"
function setup() {
  const previous = (globalThis as any).Storage
  const item: ManualDueItem = { id: "same", title: "ChatGPT", kind: "subscription", iconName: "creditcard.fill", dueDate: "2026-09-30", includesTime: false, hour: 9, minute: 0, remindBeforeDays: 0,
    recurrence: createRecurrenceRule("month", 1, "2026-09-30"), amount: "10", note: "Keep", enabled: true, createdAt: 1, updatedAt: 2 }
  const state = { ...storage.defaultState(2), items: [item, { ...item, id: "other" }] }
  state.settings.itemBrandChoices = [{ source: "manual", itemID: "same", brandID: "brand-retired" }]
  const values = new Map<string, any>([[storage.STATE_KEY, structuredClone(state)]])
  const failures = new Set<string>()
  ;(globalThis as any).Storage = {
    get: (key: string) => structuredClone(values.get(key) ?? null),
    set: (key: string, value: any) => { if (failures.has(key)) return false; values.set(key, structuredClone(value)); return true },
    contains: (key: string) => values.has(key), remove: (key: string) => values.delete(key),
  }
  return { item, state, values, failures, cleanup: () => { (globalThis as any).Storage = previous } }
}

test("new icon preferences preserve unknown IDs and separate manual/reminder namespaces", () => {
  const choices = [{ source: "manual", itemID: "__proto__", iconID: chat }, { source: "reminder", itemID: "__proto__", iconID: "icons8-Future123" }]
  const settings = { itemIconChoices: normalizeItemIconChoices(choices) }
  assert.deepEqual(settings.itemIconChoices, choices)
  assert.equal(itemIconID(settings, "manual", "__proto__"), chat)
  assert.equal(itemIconID(settings, "reminder", "__proto__"), "icons8-Future123")
  assert.equal(itemIconID(settings, "manual", "missing"), null)
})

test("malformed, duplicate, path-like and oversized choice data fail closed", () => {
  const one = { source: "manual", itemID: "a", iconID: chat }
  for (const choices of [[one, one], [null], [{ ...one, source: "other" }], [{ ...one, itemID: "" }], [{ ...one, iconID: "../secret" }], [{ ...one, iconID: "https://example.com/a.png" }], Array(2001).fill(one), {}]) {
    assert.throws(() => normalizeItemIconChoices(choices))
  }
})

test("item icon compare-and-set merges unrelated choices and refuses stale rows", () => {
  const first = applyItemIconEdit({}, "manual", "a", { iconID: chat, expectedIconID: null })
  const second = applyItemIconEdit(first, "reminder", "a", { iconID: claude, expectedIconID: null })
  assert.equal(itemIconID(second, "manual", "a"), chat)
  assert.equal(itemIconID(second, "reminder", "a"), claude)
  assert.throws(() => applyItemIconEdit(second, "manual", "a", { iconID: claude, expectedIconID: null }))
})

test("manual save atomically commits item plus icon and snapshots their previous state", () => {
  const env = setup()
  try {
    const next = storage.upsertItem({ ...env.item, title: "Changed" }, 2, { iconID: chat, expectedIconID: null })
    assert.equal(next.items[0].title, "Changed")
    assert.equal(itemIconID(next.settings, "manual", "same"), chat)
    assert.deepEqual(next.items[1], env.state.items[1])
    assert.deepEqual(next.settings.itemBrandChoices, env.state.settings.itemBrandChoices)
    const before = storage.listLocalSnapshots()[0].state
    assert.equal(before.items[0].title, "ChatGPT")
    assert.equal(itemIconID(before.settings, "manual", "same"), null)
  } finally { env.cleanup() }
})

test("failed icon-and-item saves preserve both data and the prior icon", () => {
  for (const key of [storage.STATE_KEY, storage.LOCAL_SNAPSHOTS_KEY]) {
    const env = setup()
    try {
      env.failures.add(key)
      assert.throws(() => storage.upsertItem({ ...env.item, title: "Wrong" }, 2, { iconID: chat, expectedIconID: null }))
      assert.deepEqual(env.values.get(storage.STATE_KEY), env.state)
    } finally { env.cleanup() }
  }
})

test("concurrent icon edits and stale item revisions cannot overwrite newer choices", () => {
  const env = setup()
  try {
    storage.updateItemIconChoice("manual", "same", { iconID: claude, expectedIconID: null })
    const before = storage.loadState()
    assert.throws(() => storage.upsertItem({ ...env.item, title: "Stale" }, 2, { iconID: chat, expectedIconID: null }))
    assert.deepEqual(storage.loadState(), before)
    assert.throws(() => storage.updateItemIconChoice("manual", "gone", { iconID: chat, expectedIconID: null }))
    assert.throws(() => storage.updateItemIconChoice("reminder", "same", { iconID: "icons8-Unknown", expectedIconID: null }))
  } finally { env.cleanup() }
})

test("complete-and-save commits artwork once, and undo preserves the chosen appearance", () => {
  const env = setup()
  try {
    storage.completeManualItem(env.item, 2, false, Date.now(), { iconID: chat, expectedIconID: null })
    const state = storage.loadState()
    assert.equal(state.items[0].dueDate, "2026-10-30")
    assert.equal(itemIconID(state.settings, "manual", "same"), chat)
    storage.undoManualCompletion(state.completionHistory![0].id)
    assert.equal(storage.loadState().items[0].dueDate, "2026-09-30")
    assert.equal(itemIconID(storage.loadState().settings, "manual", "same"), chat)
  } finally { env.cleanup() }
})

test("backups retain color, SF and future selections alongside legacy metadata", () => {
  const env = setup()
  try {
    storage.updateItemIconChoice("manual", "same", { iconID: chat, expectedIconID: null })
    storage.updateItemIconChoice("reminder", "same", { iconID: "sf:car.fill", expectedIconID: null })
    const raw = env.values.get(storage.STATE_KEY)
    raw.settings.itemIconChoices.push({ source: "reminder", itemID: "future", iconID: "icons8-FutureABC" })
    const state = parseBackupJSON(createBackupJSON()).state
    assert.deepEqual(state.settings.itemIconChoices, raw.settings.itemIconChoices)
    assert.deepEqual(state.settings.itemBrandChoices, env.state.settings.itemBrandChoices)
  } finally { env.cleanup() }
})

test("mixed choices change appearance only and preserve identity, permissions and occurrence guards", () => {
  const base: DisplayDueItem = { source: "manual", id: "a", completionKey: "exact", title: "Keep", kind: "subscription", iconName: "creditcard.fill", iconColor: "systemOrange", iconIsExplicit: true,
    dueDate: "2026-09-30", includesTime: false, hour: 9, minute: 0, dueTimestamp: 1, remindBeforeDays: 0, amount: "5", note: "private", priority: 0, stale: false, canComplete: true }
  const settings = { ...storage.defaultState().settings, itemIconChoices: normalizeItemIconChoices([
    { source: "manual", itemID: "a", iconID: chat }, { source: "reminder", itemID: "a", iconID: "sf:car.fill" },
    { source: "manual", itemID: "c", iconID: "icons8-FutureABC" },
  ]) }
  const input = [base, { ...base, source: "reminder" as const, canComplete: false, stale: true }, { ...base, id: "c" }]
  const result = withItemIconChoices(input, settings)
  assert.equal(result[0].artworkID, chat)
  assert.equal(result[0].iconName, base.iconName)
  assert.equal(result[1].iconName, "car.fill")
  assert.equal(result[1].canComplete, false)
  assert.equal(result[1].stale, true)
  assert.equal(result[2].artworkID, undefined)
  for (let i = 0; i < result.length; i++) for (const key of ["id", "source", "completionKey", "dueDate", "amount", "note"] as const) assert.equal(result[i][key], input[i][key])
  assert.equal(base.artworkID, undefined)
})

test("all catalog entries have original PNGs, matching independent fallbacks and verified provenance", () => {
  const source = JSON.parse(readFileSync(new URL("../到期管家/assets/icons8/sources.json", import.meta.url), "utf8"))
  assert.equal(source.icons.length, ARTWORK_CATALOG.length)
  assert.ok(ARTWORK_CATALOG.length >= 800)
  assert.equal(new Set(ARTWORK_CATALOG.map(icon => icon.id)).size, ARTWORK_CATALOG.length)
  assert.equal(readdirSync(new URL("../到期管家/assets/icons8/", import.meta.url)).filter(path => path.endsWith(".png")).length, ARTWORK_CATALOG.length)
  assert.equal(readdirSync(new URL("../到期管家/assets/icons8/fallbacks/", import.meta.url)).length, ARTWORK_CATALOG.length)
  for (const icon of source.icons) {
    assert.equal(icon.style, "Windows 11 Color")
    assert.equal(artworkByID(icon.id)?.path, icon.file)
    assert.equal(artworkByID(icon.id)?.lightBackplate, icon.lightBackplate)
    const bytes = readFileSync(new URL(`../到期管家/${icon.file}`, import.meta.url))
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a")
    assert.equal(bytes.readUInt32BE(16), 96); assert.equal(bytes.readUInt32BE(20), 96)
    assert.equal(createHash("sha256").update(bytes).digest("hex"), icon.sha256)
    const fallback = JSON.parse(readFileSync(new URL(`../到期管家/assets/icons8/fallbacks/${icon.vendorID}.json`, import.meta.url), "utf8"))
    assert.equal(fallback.source, icon.file)
    assert.deepEqual(Buffer.from(fallback.png, "base64"), bytes)
  }
})

test("deleting a manual item removes only its local color choice and snapshots both for recovery", () => {
  const env = setup()
  try {
    storage.updateItemIconChoice("manual", "same", { iconID: chat, expectedIconID: null })
    storage.updateItemIconChoice("reminder", "same", { iconID: claude, expectedIconID: null })
    const next = storage.deleteItem("same", 2)
    assert.equal(itemIconID(next.settings, "manual", "same"), null)
    assert.equal(itemIconID(next.settings, "reminder", "same"), claude)
    const before = storage.listLocalSnapshots()[0].state
    assert.ok(before.items.some(item => item.id === "same"))
    assert.equal(itemIconID(before.settings, "manual", "same"), chat)
  } finally { env.cleanup() }
})

test("catalog search supports Chinese, normalized English, groups and unknown-ID fallback", () => {
  assert.ok(searchArtwork("微信").some(icon => icon.id === "icons8-g6K6MWJPKeyk"))
  assert.ok(searchArtwork("ＣｈａｔＧＰＴ").some(icon => icon.id === chat))
  assert.ok(searchArtwork("信用卡").some(icon => icon.group === "生活图标"))
  assert.ok(searchArtwork("地球").some(icon => icon.id === "icons8-9GC5rqCM5uDh"))
  assert.ok(searchArtwork("", "AI 服务").every(icon => icon.group === "AI 服务"))
  assert.deepEqual(searchArtwork("unfindable-application-name"), [])
  assert.equal(artworkByID("../../secret"), null)
  assert.equal(artworkByID("icons8-FutureABC"), null)
})
