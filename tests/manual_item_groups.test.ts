// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import test from "node:test"
import { groupManualItems } from "../到期管家/src/manual_item_groups.ts"
import { sortDueItems } from "../到期管家/src/reminders.ts"
import { defaultState, manualItemsForDisplay } from "../到期管家/src/storage.ts"
import type { ManualDueItem } from "../到期管家/src/types.ts"

function item(id: string, patch: Partial<ManualDueItem> = {}): ManualDueItem {
  return {
    id, title: id, kind: "custom", iconName: null,
    dueDate: "2026-10-01", includesTime: false, hour: 0, minute: 0,
    remindBeforeDays: 0, recurrence: null, amount: "Keep amount", note: "Keep note",
    enabled: true, createdAt: 1, updatedAt: 2, ...patch,
  }
}

test("manual groups preserve shared widget ordering and classify active items once", () => {
  const state = { ...defaultState(2), items: [
    item("future-later", { dueDate: "2026-10-09" }),
    item("today"),
    item("early-action", { dueDate: "2026-10-20", remindBeforeDays: 18 }),
    item("overdue-recent", { dueDate: "2026-09-30" }),
    item("timed-later", { includesTime: true, hour: 17 }),
    item("overdue-earlier", { dueDate: "2026-09-28" }),
    item("action-window", { dueDate: "2026-10-05", remindBeforeDays: 4 }),
    item("timed-earlier", { includesTime: true, hour: 9 }),
  ] }
  const now = new Date(2026, 9, 1, 8)
  const original = structuredClone(state)
  const groups = groupManualItems(state, now)
  assert.deepEqual(groups.overdueItems.map(value => value.id), ["overdue-earlier", "overdue-recent"])
  assert.deepEqual(groups.needsActionItems.map(value => value.id), ["today", "action-window"])
  assert.deepEqual(groups.upcomingItems.map(value => value.id), ["timed-earlier", "timed-later", "early-action", "future-later"])
  const active = [...groups.overdueItems, ...groups.needsActionItems, ...groups.upcomingItems]
  assert.deepEqual(active.map(value => value.id), sortDueItems(manualItemsForDisplay(state), now).map(value => value.id))
  assert.equal(new Set(active).size, state.items.length)
  assert.ok(active.every(value => state.items.includes(value)), "grouping retains original item references")
  assert.deepEqual(state, original, "render preparation must not mutate persisted state")
})

test("manual groups keep inactive items separate and retain their stored order", () => {
  const state = { ...defaultState(2), items: [
    item("hidden-future", { enabled: false, dueDate: "2026-12-01" }),
    item("active", { dueDate: "2026-10-03" }),
    item("hidden-past", { enabled: false, dueDate: "2025-01-01" }),
  ] }
  const groups = groupManualItems(state, new Date(2026, 9, 1))
  assert.deepEqual(groups.overdueItems, [])
  assert.deepEqual(groups.needsActionItems, [])
  assert.deepEqual(groups.upcomingItems, [state.items[1]])
  assert.deepEqual(groups.inactiveItems, [state.items[0], state.items[2]])
  assert.deepEqual(groupManualItems(defaultState(2), new Date(2026, 9, 1)), {
    overdueItems: [], needsActionItems: [], upcomingItems: [], inactiveItems: [],
  })
})

test("manual grouping preserves priority, title and ID tie-breaks from the shared sorter", () => {
  const state = { ...defaultState(2), items: [
    item("b", { title: "Same" }),
    item("a", { title: "Same" }),
    item("priority", { title: "Z", kind: "creditCard" }),
    item("title-first", { title: "A" }),
  ] }
  const now = new Date(2026, 9, 1)
  const groups = groupManualItems(state, now)
  assert.deepEqual(groups.needsActionItems.map(value => value.id), sortDueItems(manualItemsForDisplay(state), now).map(value => value.id))
  assert.deepEqual(groups.needsActionItems.map(value => value.id), ["priority", "title-first", "a", "b"])
})

test("manual groups use the supplied clock at timed deadlines and local midnight", () => {
  const state = { ...defaultState(2), items: [item("all-day"), item("timed", { includesTime: true, hour: 10 })] }
  const before = groupManualItems(state, new Date(2026, 9, 1, 9, 59, 59, 999))
  assert.deepEqual(before.overdueItems, [])
  assert.deepEqual(before.needsActionItems.map(value => value.id), ["all-day"])
  assert.deepEqual(before.upcomingItems.map(value => value.id), ["timed"])
  const deadline = groupManualItems(state, new Date(2026, 9, 1, 10))
  assert.deepEqual(deadline.overdueItems.map(value => value.id), ["timed"])
  assert.deepEqual(deadline.needsActionItems.map(value => value.id), ["all-day"])
  const beforeMidnight = groupManualItems(state, new Date(2026, 9, 1, 23, 59, 59, 999))
  assert.deepEqual(beforeMidnight.needsActionItems.map(value => value.id), ["all-day"])
  const midnight = groupManualItems(state, new Date(2026, 9, 2))
  assert.deepEqual(midnight.overdueItems.map(value => value.id), ["all-day", "timed"])
  assert.deepEqual(midnight.needsActionItems, [])
  assert.deepEqual(midnight.upcomingItems, [])
})
