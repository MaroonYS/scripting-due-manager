// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { actionTimestamp, dueStatus } from "./date"
import type { DisplayDueItem } from "./types"

export type DueOrderInput = Pick<DisplayDueItem, "id" | "source" | "title" | "stale" | "priority"
  | "dueDate" | "includesTime" | "hour" | "minute" | "dueTimestamp" | "remindBeforeDays">

/** A short-lived projection, not a global or persisted cache of user content. */
export function orderedDueEntries<T extends DueOrderInput>(items: readonly T[], now = new Date()) {
  const entries = items.map(item => {
    const status = dueStatus(item, now)
    return { item, status, rank: status.overdue ? 0 : status.needsAction ? 1 : 2,
      actionAt: actionTimestamp(item) }
  })
  // Calendar/date calculations are linear, rather than repeated by each comparison.
  return entries.sort((left, right) => {
    const a = left.item, b = right.item
    if (a.stale !== b.stale) return a.stale ? 1 : -1
    if (left.rank !== right.rank) return left.rank - right.rank
    if (left.actionAt !== right.actionAt) return left.actionAt - right.actionAt
    if (a.dueTimestamp !== b.dueTimestamp) return a.dueTimestamp - b.dueTimestamp
    if (a.priority !== b.priority) return b.priority - a.priority
    const titleOrder = a.title.localeCompare(b.title, "zh-Hans-CN")
    if (titleOrder !== 0) return titleOrder
    if (a.source !== b.source) return a.source.localeCompare(b.source)
    return a.id.localeCompare(b.id)
  })
}

export function sortDueItems(items: readonly DisplayDueItem[], now = new Date()): DisplayDueItem[] {
  return orderedDueEntries(items, now).map(entry => entry.item)
}
