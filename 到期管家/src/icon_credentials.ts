// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

const ICONS8_KEY = "due-manager.icons8.api-key.v1"
const KEY_OPTIONS = { synchronizable: false, accessibility: "first_unlock_this_device" as const }

export function iconKeychainAvailable(): boolean {
  return typeof Keychain !== "undefined" && typeof Keychain.get === "function" && typeof Keychain.set === "function" && typeof Keychain.remove === "function"
}

export function readIcons8Key(): string | null {
  try {
    const key = iconKeychainAvailable() ? Keychain.get(ICONS8_KEY, KEY_OPTIONS) : null
    return typeof key === "string" && /^[\x21-\x7e]{1,512}$/.test(key) ? key : null
  } catch { return null }
}

/** Never fall back to Storage, script files, backup JSON or iCloud. */
export function saveIcons8Key(value: string): void {
  if (!iconKeychainAvailable()) throw Error("当前 Scripting 不支持安全钥匙串，请先更新 Scripting。")
  const key = value.trim()
  if (!/^[\x21-\x7e]{1,512}$/.test(key)) throw Error("请输入有效的 Icons8 API Key（不包含空格或换行）。")
  let saved = false
  try { saved = Keychain.set(ICONS8_KEY, key, KEY_OPTIONS) } catch { /* Do not expose native errors containing credentials. */ }
  if (!saved) throw Error("密钥未能安全保存，原配置未主动清除，请稍后重试。")
}

export function removeIcons8Key(): void {
  if (!iconKeychainAvailable()) throw Error("当前 Scripting 不支持安全钥匙串。")
  let removed = false
  try { removed = Keychain.remove(ICONS8_KEY, KEY_OPTIONS) } catch { /* Redact native errors. */ }
  if (!removed) throw Error("未能清除 Icons8 密钥，请稍后重试。")
}
