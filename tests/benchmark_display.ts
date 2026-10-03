// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

// Synthetic, repeatable host benchmark. Not an iPhone/WidgetKit latency test.
// Run: bun tests/benchmark_display.ts
import assert from "node:assert/strict"
import { actionTimestamp, dueStatus } from "../到期管家/src/date.ts"
import { sortDueItems } from "../到期管家/src/due_ordering.ts"
import { groupManualItems } from "../到期管家/src/manual_item_groups.ts"
import { defaultState, manualItemsForDisplay } from "../到期管家/src/storage.ts"
import { indexItemIconChoices, indexedItemIconID, itemIconID } from "../到期管家/src/icon_preferences.ts"
import type { DisplayDueItem, ManualDueItem } from "../到期管家/src/types.ts"

const now = new Date(2026, 9, 3, 12), state = defaultState(2)
state.items = Array.from({ length: 2000 }, (_, index): ManualDueItem => ({
  id: `item-${index}`, title: ["Hilton 信用卡", "房贷", "机票", "订阅", "护照"][index % 5],
  kind: index % 3 ? "custom" : "creditCard", iconName: null,
  dueDate: `2026-${index % 2 ? "10" : "09"}-${String(index % 28 + 1).padStart(2, "0")}`,
  includesTime: index % 3 === 0, hour: index % 24, minute: index % 60, remindBeforeDays: index % 10,
  recurrence: null, amount: "100", note: "Synthetic only", enabled: index % 11 !== 0, createdAt: 1, updatedAt: 2,
}))
state.settings.itemIconChoices = state.items.map(item => ({ source: "manual", itemID: item.id, iconID: "sf:creditcard.fill" }))
const items = manualItemsForDisplay(state)

function referenceSort(items: DisplayDueItem[]) {
  const rank = (value: ReturnType<typeof dueStatus>) => value.overdue ? 0 : value.needsAction ? 1 : 2
  return [...items].sort((a, b) => {
    if (a.stale !== b.stale) return a.stale ? 1 : -1
    const ar = rank(dueStatus(a, now)), br = rank(dueStatus(b, now))
    if (ar !== br) return ar - br
    const at = actionTimestamp(a), bt = actionTimestamp(b)
    if (at !== bt) return at - bt
    if (a.dueTimestamp !== b.dueTimestamp) return a.dueTimestamp - b.dueTimestamp
    if (a.priority !== b.priority) return b.priority - a.priority
    return a.title.localeCompare(b.title, "zh-Hans-CN") || a.source.localeCompare(b.source) || a.id.localeCompare(b.id)
  })
}

function referenceGroups() {
  const groups: ManualDueItem[][] = [[], [], [], []], byID = new Map<string, ManualDueItem>()
  for (const item of state.items) {
    if (!byID.has(item.id)) byID.set(item.id, item)
    if (!item.enabled) groups[3].push(item)
  }
  for (const displayed of referenceSort(manualItemsForDisplay(state))) {
    const item = byID.get(displayed.id)!
    const status = dueStatus(item, now)
    groups[status.overdue ? 0 : status.needsAction ? 1 : 2].push(item)
  }
  return groups
}
function newGroups() {
  const groups = groupManualItems(state, now)
  return [groups.overdueItems, groups.needsActionItems, groups.upcomingItems, groups.inactiveItems]
}

assert.deepEqual(sortDueItems(items, now), referenceSort(items))
assert.deepEqual(newGroups(), referenceGroups())
const previousChoices = () => state.items.map(item => itemIconID(state.settings, "manual", item.id))
const indexedChoices = () => {
  const index = indexItemIconChoices(state.settings)
  return state.items.map(item => indexedItemIconID(index, "manual", item.id))
}
assert.deepEqual(indexedChoices(), previousChoices())

function medianMilliseconds(run: () => unknown) {
  for (let warm = 0; warm < 20; warm++) run()
  const batches: number[] = []
  for (let batch = 0; batch < 9; batch++) {
    const start = performance.now()
    for (let repeat = 0; repeat < 10; repeat++) run()
    batches.push((performance.now() - start) / 10)
  }
  return batches.sort((a, b) => a - b)[4]
}
console.log(JSON.stringify({ runtime: Bun.version, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  manualItems: state.items.length, displayed: items.length, choices: state.settings.itemIconChoices.length,
  warmup: 20, batches: 9, repetitions: 10,
  sort: { previousMs: medianMilliseconds(() => referenceSort(items)), optimizedMs: medianMilliseconds(() => sortDueItems(items, now)) },
  groups: { previousMs: medianMilliseconds(referenceGroups), optimizedMs: medianMilliseconds(newGroups) },
  iconChoices: { previousMs: medianMilliseconds(previousChoices), optimizedMs: medianMilliseconds(indexedChoices) },
}))
