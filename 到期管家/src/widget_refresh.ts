// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { Widget } from "scripting"

/** Refreshes only user widgets when supported, with a compatibility fallback. */
export async function reloadUserWidgets(): Promise<void> {
  const reload = (Widget as any).reloadUserWidgets
  if (typeof reload === "function") {
    try {
      await reload.call(Widget)
      return
    } catch { /* An older host may expose an unavailable scoped reload. */ }
  }
  await Widget.reloadAll()
}

/**
 * Storage.set reports acceptance before its background persistence finishes.
 * A brief compatibility delay reduces old-snapshot reads; it is not an atomic
 * persistence acknowledgement or a guarantee about WidgetKit scheduling.
 */
export async function reloadWidgetsAfterStorageWrite(delayMs = 250): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, delayMs))
  await reloadUserWidgets()
}
