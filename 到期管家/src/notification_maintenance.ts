// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { reconcileNotifications } from "./notifications"
import type { NotificationReconcileOptions, NotificationStatus } from "./notifications"

/**
 * Limit how long the UI waits, without cancelling a native notification write.
 * The worker retains its queue and lease until it finishes; a late result is
 * consumed once and never starts another reconciliation from this helper.
 */
export function maintainNotificationsWithBudget(
  options: NotificationReconcileOptions = {},
  waitMs = 1500,
): Promise<NotificationStatus | null> {
  const budget = Number.isFinite(waitMs) ? Math.max(0, Math.trunc(waitMs)) : 1500
  return new Promise((resolve, reject) => {
    let waiting = true
    const timer = setTimeout(() => {
      if (!waiting) return
      waiting = false
      resolve(null)
    }, budget)
    Promise.resolve().then(() => reconcileNotifications([], options)).then(status => {
      if (!waiting) return
      waiting = false
      clearTimeout(timer)
      resolve(status)
    }, error => {
      // Also handles a late rejection after the UI has stopped waiting.
      if (!waiting) return
      waiting = false
      clearTimeout(timer)
      reject(error)
    })
  })
}
