// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. Credentials never enter app settings or backup JSON.

import { iconKeychainAvailable } from "./icon_credentials"
import { mcpFail, normalizeMCPSession } from "./icons8_mcp_protocol"
import type { MCPSession } from "./icons8_mcp_protocol"

const KEY = "due-manager.icons8.mcp.session.v1"
const OPTIONS = { synchronizable: false, accessibility: "first_unlock_this_device" as const }
let generation = 0
export interface MCPCredentialSnapshot { raw: string | null; generation: number; session: MCPSession | null }
export function mcpCredentialSnapshot(): MCPCredentialSnapshot {
  if (!iconKeychainAvailable()) mcpFail("当前 Scripting 不支持安全钥匙串，请更新后连接。")
  let raw: string | null
  try { raw = Keychain.get(KEY, OPTIONS) } catch { mcpFail("无法读取本机 Icons8 登录，请解锁设备后重试。") }
  if (raw == null) return { raw: null, generation, session: null }
  if (typeof raw !== "string" || raw.length > 70000) mcpFail("本机 Icons8 登录数据无效，请在账号页清除后重新连接。")
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { mcpFail("本机 Icons8 登录数据无效，请在账号页清除后重新连接。") }
  const session = normalizeMCPSession(parsed)
  if (!session) mcpFail("本机 Icons8 登录数据无效，请在账号页清除后重新连接。")
  return { raw, generation, session }
}
export function hasIcons8MCPSession(): boolean { try { return mcpCredentialSnapshot().session != null } catch { return false } }
export function checkMCPCredentialSnapshot(expected: MCPCredentialSnapshot): void {
  const current = mcpCredentialSnapshot()
  if (current.generation !== expected.generation || current.raw !== expected.raw) mcpFail("Icons8 登录状态已在别处更改，请重新搜索或连接。")
}
export function saveMCPSession(session: MCPSession, expected: MCPCredentialSnapshot): MCPCredentialSnapshot {
  const normalized = normalizeMCPSession(session)
  if (!normalized) mcpFail("Icons8 登录凭据无效，未保存。")
  checkMCPCredentialSnapshot(expected)
  let saved = false
  try { saved = Keychain.set(KEY, JSON.stringify(normalized), OPTIONS) } catch { /* Do not expose native errors. */ }
  if (!saved) mcpFail("登录未能安全保存到本机钥匙串，原配置未主动清除。")
  generation++
  return mcpCredentialSnapshot()
}
/** Removing local credentials does not alter the account, existing artwork or REST API key. */
export function removeIcons8MCPSession(): void {
  if (!iconKeychainAvailable()) mcpFail("当前 Scripting 不支持安全钥匙串。")
  let removed = false
  try { removed = Keychain.remove(KEY, OPTIONS) } catch { /* Redact native errors. */ }
  if (!removed) mcpFail("无法清除本机 Icons8 登录，请重试。")
  generation++
}
