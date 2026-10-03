// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { actionTimestamp, dateKeyToLocalDate, dueStatus } from "../到期管家/src/date.ts"
import { orderedDueEntries, sortDueItems } from "../到期管家/src/due_ordering.ts"
import { groupManualItems } from "../到期管家/src/manual_item_groups.ts"
import { nextWidgetRefresh } from "../到期管家/src/reminders.ts"
import { defaultState, manualItemsForDisplay } from "../到期管家/src/storage.ts"
import type { DisplayDueItem, ManualDueItem } from "../到期管家/src/types.ts"

// Independent reference to the released 3.6.1 comparator, including all ties.
function previousOrder(items: DisplayDueItem[], now: Date) {
  const rank = (status: ReturnType<typeof dueStatus>) => status.overdue ? 0 : status.needsAction ? 1 : 2
  return [...items].sort((a, b) => {
    if (a.stale !== b.stale) return a.stale ? 1 : -1
    const ar = rank(dueStatus(a, now)), br = rank(dueStatus(b, now))
    if (ar !== br) return ar - br
    const at = actionTimestamp(a), bt = actionTimestamp(b)
    if (at !== bt) return at - bt
    if (a.dueTimestamp !== b.dueTimestamp) return a.dueTimestamp - b.dueTimestamp
    if (a.priority !== b.priority) return b.priority - a.priority
    const titles = a.title.localeCompare(b.title, "zh-Hans-CN")
    if (titles !== 0) return titles
    if (a.source !== b.source) return a.source.localeCompare(b.source)
    return a.id.localeCompare(b.id)
  })
}

function fixture(index: number): DisplayDueItem {
  const dueDate = `2026-${index % 2 ? "10" : "09"}-${String(index % 28 + 1).padStart(2, "0")}`
  const includesTime = index % 3 === 0, hour = index % 24, minute = index % 60
  return { id: String(index), source: index % 2 ? "manual" : "reminder", title: ["账单", "航班", "Apple", "会员", "証件"][index % 5],
    kind: "custom", iconName: "calendar", iconColor: "systemBlue", completionKey: `period:${index}`,
    dueDate, includesTime, hour, minute, remindBeforeDays: index % 15,
    dueTimestamp: dateKeyToLocalDate(dueDate, includesTime, hour, minute).getTime(),
    priority: index % 5, stale: index % 11 === 0, canComplete: index % 11 !== 0, amount: "", note: "" }
}

test("precomputed sorting is exactly equivalent to the released comparator at deadline and midnight boundaries", () => {
  const items = Array.from({ length: 1500 }, (_, index) => fixture((index * 823) % 1500))
  const original = structuredClone(items)
  for (const now of [new Date(2026, 8, 30, 23, 59), new Date(2026, 9, 1), new Date(2026, 9, 1, 12), new Date(2026, 9, 4, 0, 0)]) {
    const ordered = sortDueItems(items, now)
    assert.deepEqual(ordered, previousOrder(items, now))
    assert.ok(ordered.every(item => items.includes(item)), "output preserves exact item objects and source/period fields")
  }
  assert.deepEqual(items, original)
})

test("precomputed sorting preserves stable exact ties, live-before-cache and source/ID tie breaks", () => {
  const base = fixture(0), live = { ...base, stale: false }, other = { ...live }
  const items = [base, live, other, { ...live, source: "manual" as const }, { ...live, id: "a" }]
  const sorted = sortDueItems(items, new Date(2026, 9, 3))
  assert.deepEqual(sorted, previousOrder(items, new Date(2026, 9, 3)))
  assert.ok(sorted.indexOf(live) < sorted.indexOf(other))
  assert.equal(sorted.at(-1), base)
  assert.deepEqual(sortDueItems([]), [])
  assert.deepEqual(sortDueItems([base]), [base])
})

test("sorting calculates one status and one action key per item, not per comparison", () => {
  const source = readFileSync(new URL("../到期管家/src/due_ordering.ts", import.meta.url), "utf8")
    .replace(/^import[\s\S]*?from\s+"[^"]+"\s*\n/gm, "").replace(/^export /gm, "")
  let statuses = 0, actions = 0
  const order = new Function("dueStatus", "actionTimestamp", new Bun.Transpiler({ loader: "ts" }).transformSync(source)
    + "\nreturn orderedDueEntries")((item: any, now: Date) => { statuses++; return dueStatus(item, now) },
      (item: any) => { actions++; return actionTimestamp(item) })
  const entries = order(Array.from({ length: 1000 }, (_, index) => fixture(index)), new Date(2026, 9, 1))
  assert.equal(statuses, 1000); assert.equal(actions, 1000)
  assert.equal(entries.length, 1000)
  assert.equal(entries[0].status.overdue, true)
})

test("manual grouping uses a light projection without inspecting icons, amount or private notes", () => {
  const manual: ManualDueItem = { id: "light", title: "酒店卡", kind: "creditCard", iconName: null,
    dueDate: "2026-10-03", includesTime: false, hour: 9, minute: 0, remindBeforeDays: 0,
    recurrence: null, amount: "", note: "", enabled: true, createdAt: 1, updatedAt: 2 }
  for (const field of ["iconName", "amount", "note"]) Object.defineProperty(manual, field, { get: () => assert.fail(`must not read ${field}`) })
  const state = { ...defaultState(2), items: [manual] }
  const groups = groupManualItems(state, new Date(2026, 9, 3, 12))
  assert.equal(groups.needsActionItems[0], manual)
  const imports = new Bun.Transpiler({ loader: "ts" }).scanImports(readFileSync(new URL("../到期管家/src/manual_item_groups.ts", import.meta.url), "utf8"))
  assert.ok(!imports.some(entry => ["./storage", "./reminders", "./icons"].includes(entry.path)))
})

test("manual grouping retains legacy first-match behavior even for unnormalised duplicate IDs", () => {
  const create = (enabled: boolean, dueDate: string): ManualDueItem => ({ id: "duplicate", title: "same", kind: "custom", iconName: null,
    dueDate, includesTime: false, hour: 9, minute: 0, remindBeforeDays: 0, recurrence: null, amount: "", note: "",
    enabled, createdAt: 1, updatedAt: 2 })
  const first = create(false, "2026-09-01"), second = create(true, "2026-10-09")
  const state = { ...defaultState(2), items: [first, second] }
  const groups = groupManualItems(state, new Date(2026, 9, 3))
  assert.equal(groups.inactiveItems[0], first)
  assert.equal(groups.overdueItems[0], first)
})

test("light manual groups remain aligned with widget projection for mixed date/priority cases", () => {
  const state = defaultState(2)
  state.items = Array.from({ length: 300 }, (_, index) => {
    const displayed = fixture(index)
    return { ...displayed, kind: index % 2 ? "creditCard" : "custom", iconName: null,
      recurrence: null, enabled: index % 7 !== 0, createdAt: 1, updatedAt: 2 } as ManualDueItem
  })
  for (const now of [new Date(2026, 9, 3), new Date(2026, 9, 3, 12)]) {
    const groups = groupManualItems(state, now)
    assert.deepEqual([...groups.overdueItems, ...groups.needsActionItems, ...groups.upcomingItems].map(item => item.id),
      previousOrder(manualItemsForDisplay(state), now).map(item => item.id))
  }
  const entries = orderedDueEntries(manualItemsForDisplay(state), new Date(2026, 9, 3))
  assert.equal(entries.length, state.items.filter(item => item.enabled).length)
})

test("refresh scheduling accepts raw manual timing without resolving icons or reading notes", () => {
  const item: ManualDueItem = { id: "clock", title: "Keep", kind: "custom", iconName: null,
    dueDate: "2026-10-03", includesTime: true, hour: 13, minute: 0, remindBeforeDays: 2,
    recurrence: null, amount: "", note: "", enabled: true, createdAt: 1, updatedAt: 2 }
  const display = manualItemsForDisplay({ ...defaultState(2), items: [item] })
  for (const field of ["iconName", "title", "amount", "note"]) Object.defineProperty(item, field, { get: () => assert.fail(`must not read ${field}`) })
  const now = new Date(2026, 9, 3, 12)
  assert.equal(nextWidgetRefresh([item], now).getTime(), new Date(2026, 9, 3, 13).getTime())
  assert.equal(nextWidgetRefresh([item], now).getTime(), nextWidgetRefresh(display, now).getTime())
  assert.equal(nextWidgetRefresh([item], now, true, true).getTime(), nextWidgetRefresh(display, now, true, true).getTime())
})
