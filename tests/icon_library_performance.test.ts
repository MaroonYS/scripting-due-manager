// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { indexItemIconChoices, indexedItemIconID, itemIconID, symbolChoice, withItemIconChoices } from "../到期管家/src/icon_preferences.ts"
import { resolveDueIcon } from "../到期管家/src/icons.ts"
import { defaultState } from "../到期管家/src/storage.ts"
import type { AppState, DisplayDueItem, ManualDueItem } from "../到期管家/src/types.ts"

function manual(id: string, patch: Partial<ManualDueItem> = {}): ManualDueItem {
  return { id, title: `Hotel ${id}`, kind: "custom", iconName: null, dueDate: "2026-10-01", includesTime: false,
    hour: 0, minute: 0, remindBeforeDays: 0, recurrence: null, amount: "", note: "Travel payment", enabled: true,
    createdAt: 1, updatedAt: 2, ...patch }
}
function reminder(id: string, patch: Partial<DisplayDueItem> = {}): DisplayDueItem {
  return { id, title: `Flight ${id}`, source: "reminder", kind: "reminder", completionKey: "date:2026-10-01",
    iconName: "airplane", iconColor: "systemBlue", dueDate: "2026-10-01", includesTime: false,
    hour: 0, minute: 0, dueTimestamp: 1, remindBeforeDays: 0, amount: "", note: "Travel payment", priority: 0,
    stale: false, canComplete: true, ...patch }
}
function functions(extra: Record<string, any> = {}) {
  const source = readFileSync(new URL("../到期管家/src/icon_library_view.tsx", import.meta.url), "utf8")
    .replace(/^import .*$/gm, "").replace(/^export /gm, "")
  const bindings = { resolveDueIcon, indexItemIconChoices, indexedItemIconID, itemIconID, symbolChoice, ...extra }
  const compiled = new Bun.Transpiler({ loader: "tsx" }).transformSync(source)
  return new Function(...Object.keys(bindings), `${compiled}\nreturn { filterIconRows, createIconRowSearchIndex }`)(...Object.values(bindings))
}
const keys = (rows: any[]) => rows.map(row => [row.source, row.item.id])

test("source-scoped icon indexes preserve first choices, unknown symbols and arbitrary IDs", () => {
  const state = defaultState()
  state.settings.itemIconChoices = [
    { source: "manual", itemID: "__proto__", iconID: "sf:creditcard.fill" },
    { source: "manual", itemID: "__proto__", iconID: "sf:car.fill" },
    { source: "reminder", itemID: "__proto__", iconID: "sf:wallet.pass.fill" },
    { source: "manual", itemID: "same", iconID: "sf:future.symbol.fill" },
    { source: "reminder", itemID: "same", iconID: "sf:airplane" },
    { source: "manual", itemID: 'quote"[]', iconID: "sf:calendar" },
  ]
  const original = structuredClone(state.settings), index = indexItemIconChoices(state.settings)
  for (const source of ["manual", "reminder"] as const) {
    for (const id of ["__proto__", "same", 'quote"[]', "missing"]) {
      assert.equal(indexedItemIconID(index, source, id), itemIconID(state.settings, source, id))
    }
  }
  assert.equal(indexedItemIconID(indexItemIconChoices(undefined), "manual", "same"), null)
  const items = [reminder("__proto__"), reminder("same"), reminder("missing")]
  assert.deepEqual(withItemIconChoices(items, state.settings).map(item => item.iconName), ["wallet.pass.fill", "airplane", "airplane"])
  assert.equal(withItemIconChoices(items, state.settings)[2], items[2])
  assert.deepEqual(state.settings, original)
})

test("2,000-row filters with 2,000 choices match the former linear implementation", () => {
  const state: AppState = { ...defaultState(), items: Array.from({ length: 1000 }, (_, index) =>
    manual(`id-${index}`, { enabled: index % 7 !== 0, iconName: index % 11 === 0 ? "car.fill" : null })) }
  const reminders = Array.from({ length: 1000 }, (_, index) => reminder(`id-${index}`))
  state.settings.includeReminders = true
  state.settings.itemIconChoices = Array.from({ length: 2000 }, (_, index) => ({
    source: index < 1000 ? "manual" as const : "reminder" as const, itemID: `id-${index % 1000}`,
    iconID: index % 13 === 0 ? "sf:future.symbol.fill" : "sf:creditcard.fill",
  }))
  const original = structuredClone({ state, reminders }), { filterIconRows, createIconRowSearchIndex } = functions()
  const prepared = createIconRowSearchIndex(state, reminders)
  const oldFilter = (query: string, source: string, mode: string, showHidden: boolean) => {
    const term = query.normalize("NFKC").toLowerCase().trim()
    return [...state.items.map(item => ({ source: "manual", item })), ...reminders.map(item => ({ source: "reminder", item }))]
      .filter(row => (source === "all" || row.source === source)
        && (row.source !== "manual" || showHidden || (row.item as ManualDueItem).enabled)
        && `${row.item.title} ${row.item.note}`.normalize("NFKC").toLowerCase().includes(term)
        && (mode === "all" || (itemIconID(state.settings, row.source as any, row.item.id) != null
          || (row.source === "manual" && row.item.iconName != null)) === (mode === "explicit")))
  }
  for (const source of ["all", "manual", "reminder"] as const) for (const mode of ["all", "automatic", "explicit"] as const) {
    for (const hidden of [false, true]) for (const query of ["", "　ＴＲＡＶＥＬ　", "Hotel id-99", "no-match"]) {
      assert.deepEqual(keys(filterIconRows(state, reminders, query, source, mode, hidden, prepared)), keys(oldFilter(query, source, mode, hidden)))
    }
  }
  assert.deepEqual({ state, reminders }, original)
})

test("explicit filters build one index, never resolve row icons, and all mode skips the index", () => {
  const state: AppState = { ...defaultState(), items: [manual("auto"), manual("legacy", { iconName: "future.symbol.fill" })] }
  state.settings.includeReminders = true
  state.settings.itemIconChoices = [{ source: "reminder", itemID: "unknown", iconID: "sf:future.symbol.fill" }]
  const reminders = [reminder("unknown"), reminder("auto")]
  let builds = 0
  const { filterIconRows } = functions({
    indexItemIconChoices: (...args: any[]) => { builds++; return indexItemIconChoices(args[0]) },
    itemIconID: () => assert.fail("filter must not scan choices for each row"),
    resolveDueIcon: () => assert.fail("filter must not resolve row icons"),
    symbolChoice: () => assert.fail("filter must not resolve row icons"),
  })
  assert.deepEqual(keys(filterIconRows(state, reminders, "", "all", "explicit", true)), [["manual", "legacy"], ["reminder", "unknown"]])
  assert.equal(builds, 1)
  assert.deepEqual(keys(filterIconRows(state, reminders, "", "all", "automatic", true)), [["manual", "auto"], ["reminder", "auto"]])
  assert.equal(builds, 2)
  assert.equal(filterIconRows(state, reminders, "", "all", "all", true).length, 4)
  assert.equal(builds, 2)
})

test("view-local search text is lazy, reusable, NFKC-aware and refreshes changed notes", () => {
  const state: AppState = { ...defaultState(), items: [manual("same", { title: "Ｈｏｔｅｌ", note: "Visa renewal" })] }
  const reminders: DisplayDueItem[] = [], { filterIconRows, createIconRowSearchIndex } = functions()
  const prepared = createIconRowSearchIndex(state, reminders)
  filterIconRows(state, reminders, "", "all", "all", true, prepared)
  assert.equal(prepared.entries[0].text, undefined, "empty queries do not normalize private contents")
  assert.equal(filterIconRows(state, reminders, "HOTEL", "all", "all", true, prepared).length, 1)
  const normalized = prepared.entries[0].text
  assert.equal(normalized, "hotel visa renewal")
  assert.equal(filterIconRows(state, reminders, "visa", "all", "all", true, prepared).length, 1)
  assert.equal(prepared.entries[0].text, normalized)
  state.items[0].note = "Passport renewal"
  assert.equal(filterIconRows(state, reminders, "visa", "all", "all", true, prepared).length, 0)
  assert.equal(filterIconRows(state, reminders, "passport", "all", "all", true, prepared).length, 1)
  assert.equal(prepared.entries[0].text, "hotel passport renewal")
})

test("stale prepared rows cannot survive source replacement, scope changes or in-place reordering", () => {
  const state: AppState = { ...defaultState(), items: [manual("first"), manual("second")] }
  const reminders = [reminder("reminder")], { filterIconRows, createIconRowSearchIndex } = functions()
  const prepared = createIconRowSearchIndex(state, reminders)
  state.items.reverse()
  assert.deepEqual(keys(filterIconRows(state, reminders, "", "all", "all", true, prepared)), [["manual", "second"], ["manual", "first"]])
  state.items[0] = manual("replacement")
  assert.deepEqual(keys(filterIconRows(state, reminders, "", "all", "all", true, prepared)), [["manual", "replacement"], ["manual", "first"]])
  state.settings.includeReminders = true
  assert.deepEqual(keys(filterIconRows(state, reminders, "", "all", "all", true, prepared)), [["manual", "replacement"], ["manual", "first"], ["reminder", "reminder"]])
  const replaced = { ...state, items: [manual("new")] }
  assert.deepEqual(keys(filterIconRows(replaced, reminders, "", "manual", "all", true, prepared)), [["manual", "new"]])
})
