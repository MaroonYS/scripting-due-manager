// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { loadState, saveState, SHARED_STORAGE_OPTIONS, STATE_KEY } from "./storage"

/** Upgrade-only removal. No service calls, file deletion or broad keychain clear. */
export function cleanupRetiredIcons(): string | null {
  const warnings: string[] = []
  try {
    const raw = Storage.get<any>(STATE_KEY, SHARED_STORAGE_OPTIONS) ?? Storage.get<any>(STATE_KEY)
    const settings = raw?.settings
    const retiredChoices = Array.isArray(settings?.itemIconChoices)
      && settings.itemIconChoices.some((choice: any) => typeof choice?.iconID === "string" && /^(?:icons8-|fluent-emoji-flat:|github-artwork:)/.test(choice.iconID))
    if (settings && ("iconSubscriptions" in settings || retiredChoices)) {
      // Validation and the existing snapshot-before-save guard remain in force.
      if (!saveState(loadState())) warnings.push("旧图库选择未能清理，请稍后重新打开到期管家；事项数据未重置。")
    }
  } catch { warnings.push("旧图库选择清理未完成；事项数据未重置，请稍后重试。") }
  try {
    if (typeof Keychain !== "undefined" && typeof Keychain.get === "function" && typeof Keychain.remove === "function") {
      const options = { synchronizable: false, accessibility: "first_unlock_this_device" as const }
      for (const key of ["due-manager.icons8.api-key.v1", "due-manager.icons8.mcp.session.v1"]) {
        // Read only to distinguish an absent key from a failed removal. Never log it.
        if (Keychain.get(key, options) != null && !Keychain.remove(key, options)) {
          warnings.push("旧图库登录凭据未能清理，请解锁设备后重新打开到期管家。")
        }
      }
    }
  } catch { warnings.push("旧图库登录凭据清理未完成，请解锁设备后重试。") }
  return warnings.length ? [...new Set(warnings)].join("\n") : null
}
