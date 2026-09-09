// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. Credentials are sent only to the pinned Icons8 MCP origin.

import { checkMCPCredentialSnapshot, mcpCredentialSnapshot, removeIcons8MCPSession, saveMCPSession } from "./icons8_mcp_credentials"
import type { MCPCredentialSnapshot } from "./icons8_mcp_credentials"
import { Icons8MCPError, MCP_CALLBACK, MCP_ENDPOINT, MCP_ORIGIN, MCP_RESOURCE, mcpBase64URL, mcpCallbackCode, mcpError, mcpFail,
  mcpForm, mcpRecord, mcpReply, mcpSearchArguments, mcpSecret, mcpSSEReply, parseMCPArtworkPage, parseMCPClient, parseMCPTokens,
  parseMCPTools, validateMCPMetadata } from "./icons8_mcp_protocol"
import type { MCPSession, MCPTool } from "./icons8_mcp_protocol"
import type { OnlineArtworkPage } from "./online_artwork"

export interface MCPRequestOptions {
  method?: string; headers?: Record<string, string>; body?: string; timeout?: number; allowInsecureRequest?: boolean;
  signal?: { readonly aborted: boolean }; handleRedirect?: () => Promise<null>
}
export interface MCPResponse {
  ok: boolean; status: number; headers: { get(name: string): string | null }; expectedContentLength?: number;
  text(): Promise<string>;
  dataStream?: { getReader(): { read(): Promise<{ done: boolean; value?: Data }>; cancel(): Promise<void>; releaseLock(): void } }
}
export type MCPFetch = (url: string, options?: MCPRequestOptions) => Promise<MCPResponse>
const MAX_BODY = 1_000_000
const LOGIN_MS = 5 * 60 * 1000
type Progress = (message: string) => void

/** Each request has a hard local deadline as well as native network cancellation. */
export class Icons8MCPTransport {
  private cancelled = false
  private cancellations = new Set<() => void>()
  constructor(private runFetch: MCPFetch = fetch, private timeoutMS = 20000) {}
  check(): void { if (this.cancelled) mcpFail("Icons8 操作已取消。") }
  cancel(): void { this.cancelled = true; for (const cancel of this.cancellations) cancel(); this.cancellations.clear() }
  async request<T>(url: string, options: MCPRequestOptions, read: (response: MCPResponse) => Promise<T>): Promise<T> {
    this.check()
    if (this.cancellations.size >= 4) mcpFail("Icons8 请求较多，请稍后重试。")
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancel = () => {}
    const interrupted = new Promise<never>((_resolve, reject) => {
      cancel = () => { controller.abort(); reject(new Icons8MCPError("Icons8 操作已取消。")) }
      timer = setTimeout(() => { controller.abort(); reject(new Icons8MCPError("Icons8 请求超时，请检查网络后重试。")) }, this.timeoutMS)
    })
    this.cancellations.add(cancel)
    try {
      const work = async () => {
        const response = await this.runFetch(url, { ...options, timeout: Math.max(1, this.timeoutMS / 1000 - 2), signal: controller.signal,
          handleRedirect: async () => null })
        this.check()
        if (controller.signal.aborted) mcpFail("Icons8 请求已结束，请重试。")
        if (!response.ok) throw new Icons8MCPError(response.status === 401 ? "Icons8 登录已失效，请重新连接。"
          : response.status === 403 ? "Icons8 账号暂时没有当前 MCP 权限。"
          : response.status === 429 ? "Icons8 请求过于频繁，请稍后重试。" : `Icons8 服务暂时不可用（HTTP ${response.status}）。`, response.status)
        if ((response.expectedContentLength ?? 0) > MAX_BODY) mcpFail("Icons8 响应过大，请缩小搜索范围。")
        const result = await read(response)
        this.check()
        if (controller.signal.aborted) mcpFail("Icons8 请求已结束，请重试。")
        return result
      }
      return await Promise.race([work(), interrupted])
    } catch (error) { throw new Icons8MCPError(mcpError(error), error instanceof Icons8MCPError ? error.status : undefined) }
    finally { clearTimeout(timer); controller.abort(); this.cancellations.delete(cancel) }
  }
  async body(response: MCPResponse, id?: number): Promise<unknown> {
    const isSSE = (response.headers.get("content-type") ?? "").toLowerCase().startsWith("text/event-stream")
    if (isSSE && id === undefined) mcpFail("Icons8 授权响应不是预期的 JSON。")
    let text = ""
    if (response.dataStream && typeof response.dataStream.getReader === "function") {
      const reader = response.dataStream.getReader(), chunks: Data[] = []
      let bytes = 0
      try {
        for (;;) {
          this.check()
          const next = await reader.read()
          if (next.done) break
          if (!next.value || typeof next.value.size !== "number" || !Number.isFinite(next.value.size) || next.value.size < 0) mcpFail("Scripting 的流式数据格式需要适配。")
          bytes += next.value.size
          if (bytes > MAX_BODY || chunks.length >= 10000) mcpFail("Icons8 响应过大或分块过多。")
          chunks.push(next.value)
          if (isSSE) {
            const decoded = Data.combine(chunks)?.toRawString()
            if (decoded) { const reply = mcpSSEReply(decoded, id!); if (reply) return reply.result }
          }
        }
        text = Data.combine(chunks)?.toRawString() ?? ""
      } finally { void reader.cancel().catch(() => {}); reader.releaseLock() }
    } else {
      if (isSSE) mcpFail("当前 Scripting 不支持 MCP 流式响应，请更新后重试。")
      text = await response.text()
    }
    if (text.length > MAX_BODY) mcpFail("Icons8 响应过大，请缩小搜索范围。")
    if (isSSE) {
      const reply = mcpSSEReply(text, id!)
      if (!reply) mcpFail("Icons8 事件流结束，但没有当前请求的结果。")
      return reply.result
    }
    let raw: unknown
    try { raw = JSON.parse(text) } catch { mcpFail("Icons8 返回了无法识别的数据。") }
    if (id === undefined) return raw
    const reply = mcpReply(raw, id)
    if (!reply) mcpFail("Icons8 响应编号不匹配。")
    return reply.result
  }
  json(url: string, values?: Record<string, unknown>): Promise<unknown> {
    return this.request(url, { method: values ? "POST" : "GET", headers: { Accept: "application/json", "Cache-Control": "no-store",
      ...(values ? { "Content-Type": "application/json" } : {}) }, body: values ? JSON.stringify(values) : undefined }, response => this.body(response))
  }
  token(values: Record<string, string>): Promise<unknown> {
    return this.request(`${MCP_ORIGIN}/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json", "Cache-Control": "no-store" }, body: mcpForm(values) }, response => this.body(response))
  }
}

class Icons8MCPClient {
  private session: MCPSession
  private sessionID: string | null = null
  private version = "2025-03-26"
  private sequence = 0
  private tools: MCPTool[] = []
  private ready: Promise<void> | null = null
  private refreshing: Promise<void> | null = null
  constructor(readonly transport: Icons8MCPTransport, private snapshot: MCPCredentialSnapshot) {
    if (!snapshot.session) mcpFail("请先连接 Icons8 免费账号。")
    this.session = snapshot.session
  }
  matches(snapshot: MCPCredentialSnapshot): boolean { return snapshot.raw === this.snapshot.raw && snapshot.generation === this.snapshot.generation }
  check(): void { this.transport.check(); checkMCPCredentialSnapshot(this.snapshot) }
  async refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing
    this.check()
    const previous = this.session, expected = this.snapshot
    if (!previous.refreshToken) mcpFail("Icons8 登录已过期，请重新连接免费账号。")
    this.refreshing = (async () => {
      try {
        const raw = await this.transport.token({ grant_type: "refresh_token", refresh_token: previous.refreshToken!,
          client_id: previous.clientID, client_secret: previous.clientSecret, resource: MCP_RESOURCE })
        this.check()
        const next = parseMCPTokens(raw, previous, previous.refreshToken)
        const saved = saveMCPSession(next, expected)
        this.snapshot = saved; this.session = saved.session!; this.ready = null; this.sessionID = null; this.tools = []
      } catch (error) {
        if (error instanceof Icons8MCPError && (error.status === 400 || error.status === 401 || error.status === 403)) mcpFail("Icons8 登录续期失败，请重新连接免费账号。")
        throw error
      }
    })().finally(() => { this.refreshing = null })
    return this.refreshing
  }
  private async rpc(method: string, params: Record<string, unknown> = {}, notification = false): Promise<unknown> {
    this.check()
    const id = ++this.sequence
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${this.session.accessToken}`, "Cache-Control": "no-store" }
    if (method !== "initialize") headers["MCP-Protocol-Version"] = this.version
    if (this.sessionID) headers["Mcp-Session-Id"] = this.sessionID
    const result = await this.transport.request(MCP_ENDPOINT, { method: "POST", headers,
      body: JSON.stringify({ jsonrpc: "2.0", ...(notification ? {} : { id }), method, params }) }, async response => {
      const sessionID = response.headers.get("mcp-session-id")
      if (sessionID !== null) {
        if (!mcpSecret(sessionID) || sessionID.length > 512) mcpFail("Icons8 MCP 会话标识无效。")
        this.sessionID = sessionID
      }
      return notification ? null : this.transport.body(response, id)
    })
    this.check()
    return result
  }
  async initialize(): Promise<void> {
    this.check()
    if (this.refreshing) await this.refreshing
    if (this.session.expiresAt != null && this.session.expiresAt <= Date.now() + 30000) await this.refresh()
    if (this.ready) return this.ready
    this.ready = (async () => {
      this.sessionID = null
      const initial = mcpRecord(await this.rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {},
        clientInfo: { name: "due-manager", version: "3.3.0" } }))
      const version = initial?.protocolVersion
      if (typeof version !== "string" || !["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"].includes(version)) mcpFail("Icons8 MCP 协议版本需要更新。")
      this.version = version
      await this.rpc("notifications/initialized", {}, true)
      this.tools = parseMCPTools(await this.rpc("tools/list"))
      if (!this.tools.some(tool => tool.name === "search_icons")) mcpFail("此账号没有返回图标搜索能力。")
    })().catch(error => { this.ready = null; throw error })
    return this.ready
  }
  async search(query: string, page: number, shouldContinue?: () => boolean): Promise<OnlineArtworkPage> {
    const once = async () => {
      await this.initialize()
      if (shouldContinue?.() === false) mcpFail("图标搜索已取消。")
      const tool = this.tools.find(tool => tool.name === "search_icons")!
      const { args, amount } = mcpSearchArguments(tool, query, page)
      const result = await this.rpc("tools/call", { name: "search_icons", arguments: args })
      if (shouldContinue?.() === false) mcpFail("图标搜索已取消。")
      return parseMCPArtworkPage(result, page, amount)
    }
    try { return await once() }
    catch (error) {
      if (!(error instanceof Icons8MCPError) || error.status !== 401 || shouldContinue?.() === false) throw error
      await this.refresh()
      return once() // Exactly one authenticated retry; token requests are never blindly retried.
    }
  }
}

let cachedClient: Icons8MCPClient | null = null
const searchQueue: { pending: number; tail: Promise<unknown> } = { pending: 0, tail: Promise.resolve() }
function getClient(): Icons8MCPClient {
  const snapshot = mcpCredentialSnapshot()
  if (!snapshot.session) mcpFail("请先连接 Icons8 免费账号，即可搜索 Windows 11 Color 图库。")
  if (!cachedClient?.matches(snapshot)) {
    cachedClient?.transport.cancel()
    cachedClient = new Icons8MCPClient(new Icons8MCPTransport(), snapshot)
  }
  return cachedClient
}
export function disconnectIcons8MCP(): void {
  removeIcons8MCPSession()
  cachedClient?.transport.cancel(); cachedClient = null
}
async function withClient<T>(operation: (client: Icons8MCPClient) => Promise<T>): Promise<T> {
  if (searchQueue.pending >= 6) mcpFail("Icons8 搜索较多，请稍后重试。")
  // Capture the selected account before queueing. A queued search never moves to a different account.
  const client = getClient()
  searchQueue.pending++
  const task = searchQueue.tail.catch(() => {}).then(async () => {
    client.check()
    return operation(client)
  })
  searchQueue.tail = task.catch(() => {})
  try { return await task } finally { searchQueue.pending-- }
}
export async function verifyIcons8MCP(): Promise<void> {
  // A real read-only search verifies cached sessions too, including one 401 refresh retry.
  await withClient(client => client.search("earth smiley", 0))
}
export async function refreshIcons8MCP(): Promise<void> {
  await withClient(async client => { await client.refresh(); await client.initialize() })
}
export async function searchIcons8MCP(query: string, page = 0, options: { shouldContinue?: () => boolean } = {}): Promise<OnlineArtworkPage> {
  return withClient(client => {
    if (options.shouldContinue?.() === false) mcpFail("图标搜索已取消。")
    return client.search(query, page, options.shouldContinue)
  })
}

let activeLogin: Icons8MCPLogin | null = null
/** The browser performs account login; the application never sees the password or cookies. */
export class Icons8MCPLogin {
  private transport = new Icons8MCPTransport()
  private server: HttpServer | null = null
  browserOpen = false
  constructor(private progress: Progress) {}
  cancel(): void { this.transport.cancel(); this.server?.stop(); this.server = null }
  async connect(): Promise<void> {
    if (activeLogin) mcpFail("已有 Icons8 登录正在进行，请先结束该操作。")
    activeLogin = this
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopTimer: ReturnType<typeof setTimeout> | undefined
    let code: string | null = null
    try {
      const expected = mcpCredentialSnapshot()
      if (typeof HttpServer === "undefined" || typeof HttpServer.prototype.registerAsyncHandler !== "function"
        || typeof HttpResponse === "undefined" || typeof HttpResponse.raw !== "function" || typeof Safari === "undefined" || typeof Safari.present !== "function"
        || typeof Crypto === "undefined" || typeof Crypto.generateSymmetricKey !== "function" || typeof Crypto.sha256 !== "function"
        || typeof Data === "undefined" || typeof Data.fromRawString !== "function" || typeof Data.combine !== "function" || typeof AbortController === "undefined") {
        mcpFail("免费账号登录需要支持本机 HttpServer 的 Scripting Pro；已验证 TestFlight 3.3.0。")
      }
      this.progress("正在检查 Icons8 官方授权配置…")
      validateMCPMetadata(await this.transport.json(`${MCP_ORIGIN}/.well-known/oauth-authorization-server`))
      const verifier = mcpBase64URL(Crypto.generateSymmetricKey(256).toBase64String()), state = mcpBase64URL(Crypto.generateSymmetricKey(256).toBase64String())
      const verifierData = Data.fromRawString(verifier)
      if (!verifierData || verifier.length < 43 || state.length < 43) mcpFail("无法生成安全的登录验证参数。")
      const challenge = mcpBase64URL(Crypto.sha256(verifierData).toBase64String())
      const server = new HttpServer()
      this.server = server
      server.listenAddressIPv4 = "127.0.0.1"
      let denied = false, timedOut = false
      const deadline = Date.now() + LOGIN_MS
      server.registerAsyncHandler("/due-manager/icons8/health", async () => HttpResponse.ok(HttpResponseBody.text("ready")))
      server.registerAsyncHandler(MCP_CALLBACK, async request => {
        try {
          this.transport.check()
          if (code || timedOut || Date.now() >= deadline) mcpFail("本次登录已结束，请返回到期管家。")
          const received = mcpCallbackCode(request, state, `127.0.0.1:${server.port}`)
          const page = Data.fromRawString('<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>返回到期管家</title></head><body><h2>已收到 Icons8 授权</h2><p>请点左上角的 ×（关闭）返回到期管家，不是页面底部的返回箭头。</p><p>返回后将验证并安全保存登录，再继续选图。此页不需要再次登录。</p></body></html>')
          if (!page) mcpFail("无法显示授权完成页，请关闭网页返回。")
          code = received; clearTimeout(timer)
          this.progress("已收到授权；请点登录网页左上角 × 返回到期管家。")
          stopTimer = setTimeout(() => server.stop(), 1500)
          return HttpResponse.raw(200, "OK", { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" }, body: page })
        } catch (error) {
          if (error instanceof Icons8MCPError && error.message === "登录未获授权，请重新连接。") denied = true
          return HttpResponse.badRequest(HttpResponseBody.text("授权回调未通过验证。请关闭网页返回到期管家重试。"))
        }
      })
      if (server.start({ port: 0, forceIPv4: true }) != null || !server.port) mcpFail("本机回调服务未启动，请确认 Scripting Pro 与网络权限。")
      const redirectURI = `http://127.0.0.1:${server.port}${MCP_CALLBACK}`
      timer = setTimeout(() => { timedOut = true; server.stop(); this.progress("登录已超过五分钟，请关闭网页后重试。") }, LOGIN_MS)
      await this.transport.request(`http://127.0.0.1:${server.port}/due-manager/icons8/health`, { allowInsecureRequest: true }, async response => {
        if (await response.text() !== "ready") mcpFail("本机登录回调连通性验证失败。")
      })
      this.progress("本机回调已验证，正在注册此次连接…")
      const client = parseMCPClient(await this.transport.json(`${MCP_ORIGIN}/register`, {
        client_name: "Due Manager Icons8", redirect_uris: [redirectURI], scope: "icons8", grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"], token_endpoint_auth_method: "client_secret_post",
      }), redirectURI)
      this.transport.check()
      this.progress("请在官方页面登录授权，完成后点左上角 × 返回。")
      this.browserOpen = true
      try {
        await Safari.present(`${MCP_ORIGIN}/authorize?${mcpForm({ response_type: "code", client_id: client.clientID, redirect_uri: redirectURI,
          scope: "icons8", state, code_challenge: challenge, code_challenge_method: "S256", resource: MCP_RESOURCE })}`, false)
      } finally { this.browserOpen = false }
      this.transport.check()
      if (denied) mcpFail("登录未获授权，请重新连接。")
      if (!code) mcpFail(timedOut ? "登录超过五分钟，请重新连接。" : "尚未收到授权，请从到期管家重新发起登录。")
      this.progress("正在验证授权并安全保存登录…")
      const raw = await this.transport.token({ grant_type: "authorization_code", code, code_verifier: verifier,
        client_id: client.clientID, client_secret: client.clientSecret, redirect_uri: redirectURI, resource: MCP_RESOURCE })
      this.transport.check()
      saveMCPSession(parseMCPTokens(raw, client), expected)
      cachedClient?.transport.cancel(); cachedClient = null
      this.progress("登录已保存到本机钥匙串，可以返回图库搜索和选用。")
    } catch (error) { throw new Icons8MCPError(mcpError(error)) }
    finally {
      code = null; clearTimeout(timer); clearTimeout(stopTimer); this.server?.stop(); this.server = null
      if (activeLogin === this) activeLogin = null
    }
  }
}
