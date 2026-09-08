// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { Widget } from "scripting"

/** Refreshes only user widgets when supported, with a compatibility fallback. */
export async function reloadUserWidgets(): Promise<void> {
  const reload = (Widget as any).reloadUserWidgets
  if (typeof reload === "function") {
    await reload.call(Widget)
    return
  }
  await Widget.reloadAll()
}

/**
 * Storage.set reports acceptance before its background persistence finishes.
 * Waiting briefly prevents a newly requested widget timeline from reading the
 * previous snapshot and then remaining stale until the widget is re-added.
 */
export async function reloadWidgetsAfterStorageWrite(delayMs = 250): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, delayMs))
  await reloadUserWidgets()
}
