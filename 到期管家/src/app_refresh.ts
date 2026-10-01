// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import * as Scripting from "scripting"

/** Refresh a surviving app instance when it returns from the background. */
export function observeApplicationRefresh(refresh: () => void,
  onForegroundChanged?: (foreground: boolean) => void, runtime: any = Scripting): () => void {
  const globals = globalThis as unknown as Record<string, any>
  const scene = (runtime.AppEvents ?? globals.AppEvents)?.scenePhase
  let active = true, wasBackground = false, queued = false
  let timer: unknown = null
  const request = () => {
    if (!active || queued) return
    queued = true
    timer = setTimeout(() => {
      queued = false
      if (active) refresh()
    }, 0)
  }
  const listener = (phase: string) => {
    if (phase === "background") { wasBackground = true; onForegroundChanged?.(false) }
    if (phase === "active" && wasBackground) { wasBackground = false; onForegroundChanged?.(true); request() }
  }
  let removeResume: (() => void) | undefined
  try {
    if (typeof scene?.addListener === "function" && typeof scene?.removeListener === "function") scene.addListener(listener)
  } catch { /* Manual refresh remains available on older hosts. */ }
  try {
    if (typeof runtime.Script?.onResume === "function") removeResume = runtime.Script.onResume((details: any) => {
      onForegroundChanged?.(true)
      const action = details?.queryParameters?.action
      // The lightweight entry handles the selected reminder's destination.
      if (action === "reminder-notes" || action === "open-reminder") return
      request()
    })
  } catch { /* This optional lifecycle API must not stop the app. */ }
  return () => {
    active = false
    if (timer != null) clearTimeout(timer)
    try { scene?.removeListener?.(listener) } catch { /* Already detached by the host. */ }
    try { removeResume?.() } catch { /* Already detached by the host. */ }
  }
}
