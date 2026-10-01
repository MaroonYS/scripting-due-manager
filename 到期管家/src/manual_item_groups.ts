// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { dueStatus } from "./date"
import { sortDueItems } from "./reminders"
import { manualItemsForDisplay } from "./storage"
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
  for (const displayed of sortDueItems(manualItemsForDisplay(state), now)) {
    const item = itemsByID.get(displayed.id)
    if (!item) continue
    const status = dueStatus(item, now)
    if (status.overdue) groups.overdueItems.push(item)
    else if (status.needsAction) groups.needsActionItems.push(item)
    else groups.upcomingItems.push(item)
  }
  return groups
}
