// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. Third-party artwork retains its own rights.

export const ICONS8_MCP_STYLE = "fluency"
export const ICONS8_MCP_STYLE_LABEL = "Windows 11 Color"
export const ICONS8_EARTH_SMILEY = "9GC5rqCM5uDh"
export function icons8MCPID(value: unknown): string | null {
  const id = typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value) : value
  return typeof id === "string" && /^[A-Za-z0-9]{1,32}$/.test(id) ? `icons8-mcp:${id}` : null
}
export function parseIcons8MCPID(value: unknown): string | null {
  return typeof value === "string" ? /^icons8-mcp:([A-Za-z0-9]{1,32})$/.exec(value)?.[1] ?? null : null
}
export function icons8MCPLabel(value: unknown): string | null {
  const id = parseIcons8MCPID(value)
  return id ? `Icons8 彩色 · ${id === ICONS8_EARTH_SMILEY ? "Earth Smiley" : id}` : null
}
/** Public website PNG, not the separate, paid REST renderer. Never include credentials. */
export function icons8MCPPNGURL(value: unknown): string | null {
  const id = parseIcons8MCPID(value)
  return id ? `https://img.icons8.com/?id=${id}&format=png&size=96` : null
}
