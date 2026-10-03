// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { dateKeyToLocalDate, dueStatus } from "./date"
import { orderedDueEntries } from "./due_ordering"
import { itemKindPriority } from "./item_kinds"
import type { AppState, ManualDueItem } from "./types"

export interface ManualItemGroups {
  overdueItems: ManualDueItem[]
  needsActionItems: ManualDueItem[]
  upcomingItems: ManualDueItem[]
  inactiveItems: ManualDueItem[]
}

/** Keep the list and widget ordering aligned, using one clock snapshot per render. */
export function groupManualItems(state: AppState, now = new Date()): ManualItemGroups {
  const groups: ManualItemGroups = {
    overdueItems: [],
    needsActionItems: [],
    upcomingItems: [],
    inactiveItems: [],
  }
  const itemsByID = new Map<string, ManualDueItem>()
  for (const item of state.items) {
    if (!itemsByID.has(item.id)) itemsByID.set(item.id, item)
    if (!item.enabled) groups.inactiveItems.push(item)
  }
  const active = state.items.filter(item => item.enabled).map(item => ({
    id: item.id, source: "manual" as const, title: item.title, stale: false,
    priority: itemKindPriority(item.kind), dueDate: item.dueDate, includesTime: item.includesTime,
    hour: item.hour, minute: item.minute, remindBeforeDays: item.remindBeforeDays,
    dueTimestamp: dateKeyToLocalDate(item.dueDate, item.includesTime, item.hour, item.minute).getTime(),
    original: item,
  }))
  for (const entry of orderedDueEntries(active, now)) {
    const item = itemsByID.get(entry.item.id)
    if (!item) continue
    // Stored IDs are unique; retain the earlier first-match behavior for callers
    // passing an unnormalised state with duplicates as well.
    const status = item === entry.item.original ? entry.status : dueStatus(item, now)
    if (status.overdue) groups.overdueItems.push(item)
    else if (status.needsAction) groups.needsActionItems.push(item)
    else groups.upcomingItems.push(item)
  }
  return groups
}
