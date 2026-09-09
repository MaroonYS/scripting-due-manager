// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. Third-party artwork retains its own rights.

import { ICONS8_MCP_STYLE, ICONS8_MCP_STYLE_LABEL, icons8MCPID } from "./icons8_mcp_ids"
import type { OnlineArtworkPage } from "./online_artwork"

export const MCP_ORIGIN = "https://mcp.icons8.com"
export const MCP_RESOURCE = `${MCP_ORIGIN}/mcp`
export const MCP_ENDPOINT = `${MCP_RESOURCE}/`
export const MCP_CALLBACK = "/due-manager/icons8/callback"
export class Icons8MCPError extends Error {
  constructor(message: string, readonly status?: number) { super(message) }
}
export function mcpFail(message: string): never { throw new Icons8MCPError(message) }
export function mcpError(error: unknown): string {
  return error instanceof Icons8MCPError ? error.message : "Icons8 连接失败，请检查网络后重试。"
}
export function mcpRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}
export function mcpSecret(value: unknown): value is string {
  return typeof value === "string" && /^[\x21-\x7e]{1,16384}$/.test(value)
}
export function mcpForm(values: Record<string, string | number>): string {
  return Object.entries(values).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join("&")
}
export function mcpBase64URL(value: string): string { return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") }
export interface MCPClientRegistration { clientID: string; clientSecret: string; redirectURI: string }
export interface MCPSession extends MCPClientRegistration { accessToken: string; refreshToken: string | null; expiresAt: number | null }
export interface MCPTool { name: string; inputSchema: Record<string, unknown> }

export function validateMCPMetadata(raw: unknown): void {
  const m = mcpRecord(raw)
  if (!m || m.issuer !== `${MCP_ORIGIN}/` || m.authorization_endpoint !== `${MCP_ORIGIN}/authorize`
    || m.token_endpoint !== `${MCP_ORIGIN}/token` || m.registration_endpoint !== `${MCP_ORIGIN}/register`
    || !Array.isArray(m.code_challenge_methods_supported) || !m.code_challenge_methods_supported.includes("S256")
    || !Array.isArray(m.token_endpoint_auth_methods_supported) || !m.token_endpoint_auth_methods_supported.includes("client_secret_post")) {
    mcpFail("Icons8 授权配置已变化，请更新到期管家后再连接。")
  }
}
export function parseMCPClient(raw: unknown, redirectURI: string): MCPClientRegistration {
  const d = mcpRecord(raw)
  if (!d || !mcpSecret(d.client_id) || !mcpSecret(d.client_secret) || d.token_endpoint_auth_method !== "client_secret_post"
    || !Array.isArray(d.redirect_uris) || d.redirect_uris.length !== 1 || d.redirect_uris[0] !== redirectURI) mcpFail("Icons8 客户端注册结果无效。")
  return { clientID: d.client_id, clientSecret: d.client_secret, redirectURI }
}
export function parseMCPTokens(raw: unknown, client: MCPClientRegistration, oldRefresh: string | null = null, now = Date.now()): MCPSession {
  const d = mcpRecord(raw)
  if (!d || !mcpSecret(d.access_token) || typeof d.token_type !== "string" || d.token_type.toLowerCase() !== "bearer"
    || (d.refresh_token != null && !mcpSecret(d.refresh_token))
    || (d.expires_in != null && (typeof d.expires_in !== "number" || !Number.isFinite(d.expires_in) || d.expires_in <= 0 || d.expires_in > 366 * 86400))) {
    mcpFail("Icons8 没有返回有效的登录凭据。")
  }
  return { ...client, accessToken: d.access_token, refreshToken: d.refresh_token as string | undefined ?? oldRefresh,
    expiresAt: typeof d.expires_in === "number" ? now + d.expires_in * 1000 : null }
}
export function normalizeMCPSession(raw: unknown): MCPSession | null {
  const d = mcpRecord(raw)
  if (!d || !mcpSecret(d.accessToken) || !mcpSecret(d.clientID) || !mcpSecret(d.clientSecret)
    || (d.refreshToken !== null && !mcpSecret(d.refreshToken))
    || typeof d.redirectURI !== "string" || !/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/due-manager\/icons8\/callback$/.test(d.redirectURI)
    || Number(/^http:\/\/127\.0\.0\.1:(\d+)/.exec(d.redirectURI)![1]) > 65535
    || (d.expiresAt !== null && (typeof d.expiresAt !== "number" || !Number.isFinite(d.expiresAt) || d.expiresAt <= 0))) return null
  return { accessToken: d.accessToken, clientID: d.clientID, clientSecret: d.clientSecret, refreshToken: d.refreshToken as string | null,
    redirectURI: d.redirectURI, expiresAt: d.expiresAt as number | null }
}
export function mcpCallbackCode(request: { method: string; path: string; headers: Record<string, string>; queryParams: Array<{ key: string; value: string }> }, state: string, host: string): string {
  const headers = Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key.toLowerCase(), value]))
  if (request.method !== "GET" || request.path !== MCP_CALLBACK || headers.host !== host) mcpFail("登录回调地址校验失败。")
  const values = new Map<string, string>()
  for (const pair of request.queryParams) if (["state", "code", "error"].includes(pair.key)) {
    if (values.has(pair.key)) mcpFail("登录回调参数重复。")
    values.set(pair.key, pair.value)
  }
  if (values.get("state") !== state) mcpFail("登录回调状态校验失败。")
  if (values.has("error")) mcpFail("登录未获授权，请重新连接。")
  const code = values.get("code")
  if (!mcpSecret(code)) mcpFail("登录回调缺少有效授权码。")
  return code
}
export function mcpReply(raw: unknown, id: number): Record<string, unknown> | null {
  const d = mcpRecord(raw)
  if (!d || d.jsonrpc !== "2.0" || d.id !== id) return null
  if (d.error != null) mcpFail("Icons8 MCP 拒绝了请求，请重试或重新登录。")
  if (!("result" in d)) mcpFail("Icons8 MCP 响应缺少结果。")
  return d
}
export function mcpSSEReply(text: string, id: number): Record<string, unknown> | null {
  const frames = text.replace(/\r\n/g, "\n").split("\n\n")
  for (const frame of frames.slice(0, -1)) {
    const data = frame.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).replace(/^ /, "")).join("\n")
    if (!data || data === "[DONE]") continue
    let raw: unknown
    try { raw = JSON.parse(data) } catch { mcpFail("Icons8 MCP 事件格式无效。") }
    const reply = mcpReply(raw, id)
    if (reply) return reply
  }
  return null
}
export function parseMCPTools(raw: unknown): MCPTool[] {
  const d = mcpRecord(raw)
  if (!d || !Array.isArray(d.tools) || d.tools.length > 100 || d.nextCursor != null) mcpFail("Icons8 MCP 工具目录需要适配，请更新后重试。")
  return d.tools.flatMap(value => {
    const tool = mcpRecord(value), schema = mcpRecord(tool?.inputSchema)
    return typeof tool?.name === "string" && /^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/.test(tool.name) && schema ? [{ name: tool.name, inputSchema: schema }] : []
  })
}
/** Always send fluency, even though platform is optional. Do not silently mix styles. */
export function mcpSearchArguments(tool: MCPTool, query: string, page: number): { args: Record<string, unknown>; amount: number } {
  const term = query.normalize("NFKC").trim()
  if (!term || term.length > 100 || /[\u0000-\u001f\u007f]/.test(term) || !Number.isInteger(page) || page < 0 || page > 500) mcpFail("请输入 1–100 个可见字符，或重新开始搜索。")
  const props = mcpRecord(tool.inputSchema.properties), platform = mcpRecord(props?.platform)
  if (mcpRecord(props?.query)?.type !== "string" || platform?.type !== "string"
    || (Array.isArray(platform.enum) && !platform.enum.includes(ICONS8_MCP_STYLE))) mcpFail("Icons8 当前接口无法限定 Windows 11 Color 风格，未混入其他风格。")
  const amountProp = mcpRecord(props?.amount), offsetProp = mcpRecord(props?.offset)
  if (!amountProp || !["number", "integer"].includes(amountProp.type as string) || !offsetProp || !["number", "integer"].includes(offsetProp.type as string)) mcpFail("Icons8 分页接口需要更新。")
  const amount = Math.min(24, typeof amountProp.maximum === "number" ? amountProp.maximum : 24)
  const offset = page * amount
  if (!Number.isInteger(amount) || amount < 1 || amount < Number(amountProp.minimum ?? 1)
    || offset < Number(offsetProp.minimum ?? 0) || offset > Number(offsetProp.maximum ?? Infinity)) mcpFail("Icons8 分页范围不受支持，请重新搜索。")
  const args: Record<string, unknown> = { query: term, platform: ICONS8_MCP_STYLE, amount, offset }
  for (const key of Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : []) {
    if (typeof key !== "string" || !Object.prototype.hasOwnProperty.call(args, key)) mcpFail("Icons8 搜索参数已变化，请更新后重试。")
  }
  return { args, amount }
}
export function parseMCPArtworkPage(raw: unknown, page: number, amount: number): OnlineArtworkPage {
  if (mcpRecord(raw)?.isError === true) mcpFail("Icons8 搜索未成功，请重试或重新登录。")
  const found = new Map<string, { id: string; label: string; detail: string }>()
  let visits = 0
  const candidates = new Set<string>(), mismatches = new Set<string>()
  const clean = (value: unknown) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim().slice(0, 100) : ""
  const visit = (value: unknown, depth: number): void => {
    if (++visits > 4000 || depth > 8) return
    if (Array.isArray(value)) { value.slice(0, 1000).forEach(row => visit(row, depth + 1)); return }
    const row = mcpRecord(value)
    if (!row) return
    const id = icons8MCPID(row.icon_id ?? row.id), label = clean(row.name ?? row.commonName ?? row.title)
    if (id && label) {
      candidates.add(id)
      const style = clean(row.platform ?? row.style).toLowerCase()
      if (style && !["fluency", "windows 11 color", "windows-11-color"].includes(style)) mismatches.add(id)
      else if (row.isAnimated !== true && row.isExternal !== true) found.set(id, { id, label, detail: ICONS8_MCP_STYLE_LABEL })
    }
    if (row.type === "text" && typeof row.text === "string" && row.text.length < 1_000_000) {
      let parsed: unknown
      try { parsed = JSON.parse(row.text) } catch { parsed = null }
      if (parsed != null) visit(parsed, depth + 1)
    }
    for (const key of ["structuredContent", "content", "icons", "results", "result", "data", "items"]) if (key in row) visit(row[key], depth + 1)
  }
  visit(raw, 0)
  if (visits > 4000) mcpFail("Icons8 搜索结果过于复杂，请缩小关键词范围。")
  return { icons: [...found.values()].slice(0, amount), page, hasMore: candidates.size >= amount && page < 500,
    warnings: mismatches.size ? [`已忽略 ${mismatches.size} 个非 Windows 11 Color 结果`] : [] }
}
