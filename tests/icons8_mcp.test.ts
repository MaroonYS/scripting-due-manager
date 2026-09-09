// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"
import test from "node:test"
import * as protocol from "../到期管家/src/icons8_mcp_protocol.ts"
import * as credentials from "../到期管家/src/icons8_mcp_credentials.ts"
import * as mcp from "../到期管家/src/icons8_mcp.ts"
import { icons8MCPID, icons8MCPPNGURL } from "../到期管家/src/icons8_mcp_ids.ts"
import { loadIcons8MCPArtwork } from "../到期管家/src/icons8_mcp_images.ts"
import { normalizeItemIconChoices } from "../到期管家/src/icon_preferences.ts"
import { defaultState, STATE_KEY } from "../到期管家/src/storage.ts"
import { createBackupJSON, parseBackupJSON } from "../到期管家/src/recovery.ts"
import { loadArtwork, loadArtworkPage, peekArtwork } from "../到期管家/src/artwork_assets.ts"

const tool = { name: "search_icons", inputSchema: { properties: { query: { type: "string" }, platform: { type: "string" }, amount: { type: "integer", maximum: 100 }, offset: { type: "integer" } }, required: ["query"] } }
const session = (token = "access-one", expiresAt: number | null = null) => ({ clientID: "client-one", clientSecret: "client-secret", accessToken: token, refreshToken: "refresh-one", redirectURI: "http://127.0.0.1:12345/due-manager/icons8/callback", expiresAt })
const metadata = { issuer: protocol.MCP_ORIGIN + "/", authorization_endpoint: protocol.MCP_ORIGIN + "/authorize", token_endpoint: protocol.MCP_ORIGIN + "/token", registration_endpoint: protocol.MCP_ORIGIN + "/register", code_challenge_methods_supported: ["S256"], token_endpoint_auth_methods_supported: ["client_secret_post"] }
const tokens = { access_token: "access-two", token_type: "Bearer", refresh_token: "refresh-two", expires_in: 3600 }
const reply = (value: unknown, status = 200, headers: Record<string, string> = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: (name: string) => headers[name.toLowerCase()] ?? (name.toLowerCase() === "content-type" ? "application/json" : null) }, text: async () => JSON.stringify(value) })
const artwork = { icons: [{ id: "9GC5rqCM5uDh", name: "Earth Smiley", platform: "fluency" }] }
class Bytes {
  constructor(readonly bytes: Buffer) {}
  get size() { return this.bytes.length }
  static fromRawString(value: string) { return new Bytes(Buffer.from(value)) }
  static combine(values: Bytes[]) { return new Bytes(Buffer.concat(values.map(value => value.bytes))) }
  toRawString() { return this.bytes.toString("utf8") }
  toBase64String() { return this.bytes.toString("base64") }
  slice(start: number, end: number) { return new Bytes(this.bytes.subarray(start, end)) }
  toUint8Array() { return new Uint8Array(this.bytes) }
}
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve() }
async function native(run: (env: { values: Map<string, string>; requests: any[]; writes: any[]; server: () => any; setFetch: (fn: any) => void; setSafari: (fn: any) => void }) => Promise<void>) {
  const names = ["Keychain", "fetch", "Data", "Crypto", "HttpServer", "HttpResponse", "HttpResponseBody", "Safari", "UIImage", "Storage"]
  const old = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
  const values = new Map<string, string>(), requests: any[] = [], writes: any[] = []
  let currentServer: any = null
  class Server {
    port = 12345; listenAddressIPv4 = ""; stopped = false
    handlers = new Map<string, any>()
    constructor() { currentServer = this }
    registerAsyncHandler(path: string, handler: any) { this.handlers.set(path, handler) }
    start() { return null }
    stop() { this.stopped = true }
  }
  const assign = (name: string, value: any) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  assign("Keychain", { get: (key: string) => values.get(key) ?? null, set: (key: string, value: string, options: any) => { writes.push({ key, options }); values.set(key, value); return true }, remove: (key: string) => { values.delete(key); return true } })
  assign("Data", Bytes)
  assign("Crypto", { generateSymmetricKey: () => new Bytes(randomBytes(32)), sha256: (value: Bytes) => new Bytes(createHash("sha256").update(value.bytes).digest()) })
  assign("HttpServer", Server)
  assign("HttpResponseBody", { text: (value: string) => value })
  assign("HttpResponse", { ok: (body: unknown) => ({ status: 200, body }), badRequest: (body: unknown) => ({ status: 400, body }), raw: (status: number, _: string, body: unknown) => ({ status, ...body as object }) })
  const setFetch = (fn: any) => assign("fetch", async (url: string, options: any) => { requests.push({ url, options }); return fn(url, options) })
  const setSafari = (fn: any) => assign("Safari", { present: fn })
  setSafari(async () => {})
  setFetch(async (_url: string, options: any) => {
    const body = JSON.parse(options.body)
    const result = body.method === "initialize" ? { protocolVersion: "2025-03-26" }
      : body.method === "tools/list" ? { tools: [tool] } : artwork
    return reply({ jsonrpc: "2.0", id: body.id, result }, 200, { "mcp-session-id": "session-one" })
  })
  try { await run({ values, writes, requests, server: () => currentServer, setFetch, setSafari }) }
  finally {
    try { mcp.disconnectIcons8MCP() } catch {}
    for (const name of names) { if (old[name]) Object.defineProperty(globalThis, name, old[name]!); else delete (globalThis as any)[name] }
  }
}

test("MCP public IDs survive item settings and only generate a fixed 96px public PNG URL", () => {
  const id = icons8MCPID("9GC5rqCM5uDh")!
  assert.equal(id, "icons8-mcp:9GC5rqCM5uDh")
  assert.equal(icons8MCPPNGURL(id), "https://img.icons8.com/?id=9GC5rqCM5uDh&format=png&size=96")
  for (const value of ["../secret", "abc?token=secret", "", "a".repeat(33), {}, 1.5]) assert.equal(icons8MCPID(value), null)
  assert.equal(normalizeItemIconChoices([{ source: "manual", itemID: "one", iconID: id }])[0].iconID, id)
})
test("MCP discovery, client registration, tokens and stored session reject changed origins and malformed secrets", () => {
  protocol.validateMCPMetadata(metadata)
  assert.throws(() => protocol.validateMCPMetadata({ ...metadata, token_endpoint: "https://other.example/token" }))
  assert.throws(() => protocol.parseMCPClient({ client_id: "one", client_secret: "two", redirect_uris: ["http://evil"] }, session().redirectURI))
  assert.equal(protocol.parseMCPTokens(tokens, session(), null, 100).expiresAt, 3600100)
  assert.equal(protocol.parseMCPTokens({ access_token: "next", token_type: "bearer" }, session(), "old").refreshToken, "old")
  for (const value of [{ ...tokens, token_type: "basic" }, { ...tokens, access_token: "bad\nsecret" }, { ...tokens, expires_in: Infinity }, { ...tokens, refresh_token: {} }]) assert.throws(() => protocol.parseMCPTokens(value, session()))
  for (const value of [{ ...session(), redirectURI: "http://127.0.0.1:70000/due-manager/icons8/callback" }, { ...session(), redirectURI: "https://evil.example" }, { ...session(), expiresAt: NaN }]) assert.equal(protocol.normalizeMCPSession(value), null)
})
test("MCP callback enforces loopback host, GET, state and unique code without reflecting callback secrets", () => {
  const request = { method: "GET", path: protocol.MCP_CALLBACK, headers: { Host: "127.0.0.1:12345" }, queryParams: [{ key: "state", value: "expected" }, { key: "code", value: "safe-code" }] }
  assert.equal(protocol.mcpCallbackCode(request, "expected", "127.0.0.1:12345"), "safe-code")
  for (const other of [{ ...request, method: "POST" }, { ...request, headers: { Host: "evil.example" } }, { ...request, queryParams: [...request.queryParams, { key: "code", value: "private-duplicate" }] }, { ...request, queryParams: [{ key: "state", value: "private-wrong" }] }]) {
    assert.throws(() => protocol.mcpCallbackCode(other, "expected", "127.0.0.1:12345"), error => !String(error).includes("private"))
  }
})
test("MCP search always fixes fluency even when platform is optional, and enforces bounded pagination", () => {
  assert.deepEqual(protocol.mcpSearchArguments(tool, " earth smiley ", 2), { args: { query: "earth smiley", platform: "fluency", amount: 24, offset: 48 }, amount: 24 })
  for (const page of [-1, 1.5, 501]) assert.throws(() => protocol.mcpSearchArguments(tool, "bank", page))
  assert.throws(() => protocol.mcpSearchArguments(tool, "\n", 0))
  assert.throws(() => protocol.mcpSearchArguments({ ...tool, inputSchema: { ...tool.inputSchema, required: ["query", "unknown"] } }, "bank", 0))
  assert.throws(() => protocol.mcpSearchArguments({ ...tool, inputSchema: { properties: { ...tool.inputSchema.properties, platform: { type: "string", enum: ["color"] } } } }, "bank", 0), /限定/)
})
test("MCP JSON and SSE results match request IDs and never expose server error payloads", () => {
  assert.equal(protocol.mcpSSEReply('data: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\r\n\r\n', 1)?.result?.ok, true)
  assert.equal(protocol.mcpSSEReply('data: {"jsonrpc":"2.0","id":1,"result":{}}\n', 1), null)
  assert.equal(protocol.mcpReply({ jsonrpc: "2.0", id: 2, result: {} }, 1), null)
  assert.throws(() => protocol.mcpReply({ jsonrpc: "2.0", id: 1, error: { message: "private-token" } }, 1), error => !String(error).includes("private-token"))
})
test("MCP artwork parser deduplicates structured/text results, filters wrong style and rejects untrusted IDs", () => {
  const raw = { structuredContent: artwork, content: [{ type: "text", text: JSON.stringify(artwork) }] }
  assert.equal(protocol.parseMCPArtworkPage(raw, 0, 2).hasMore, false)
  const page = protocol.parseMCPArtworkPage({ icons: [...artwork.icons, { id: "wrong", name: "Other", platform: "color" }, { id: "../private", name: "Invalid" }, { id: "animated", name: "Animation", isAnimated: true }] }, 0, 24)
  assert.equal(page.icons.length, 1); assert.equal(page.warnings?.length, 1)
  assert.throws(() => protocol.parseMCPArtworkPage({ isError: true, content: "private" }, 0, 24), error => !String(error).includes("private"))
})
test("MCP keychain storage is device-only and CAS blocks stale login, logout and write failures", async () => native(async env => {
  const first = credentials.mcpCredentialSnapshot()
  credentials.saveMCPSession(session(), first)
  assert.deepEqual(env.writes[0].options, { synchronizable: false, accessibility: "first_unlock_this_device" })
  assert.throws(() => credentials.saveMCPSession(session("stale"), first), /别处更改/)
  const current = credentials.mcpCredentialSnapshot()
  Keychain.set = () => { throw Error("private-token") }
  assert.throws(() => credentials.saveMCPSession(session("unsaved"), current), error => !String(error).includes("private-token"))
  assert.equal(credentials.mcpCredentialSnapshot().session?.accessToken, "access-one")
  env.values.set("due-manager.icons8.api-key.v1", "rest-key")
  mcp.disconnectIcons8MCP()
  assert.throws(() => credentials.checkMCPCredentialSnapshot(current), /别处更改/)
  assert.equal(env.values.get("due-manager.icons8.api-key.v1"), "rest-key")
}))
test("MCP transport has a hard timeout, cancellation, redaction and bounded responses", async () => {
  const hung = new mcp.Icons8MCPTransport(async () => new Promise(() => {}), 5)
  await assert.rejects(hung.json(protocol.MCP_ORIGIN), /超时/)
  const cancelled = new mcp.Icons8MCPTransport(async () => new Promise(() => {}))
  const work = cancelled.json(protocol.MCP_ORIGIN); cancelled.cancel()
  await assert.rejects(work, /取消/)
  await assert.rejects(new mcp.Icons8MCPTransport(async () => { throw Error("private-token") }).json(protocol.MCP_ORIGIN), error => !String(error).includes("private-token"))
  await assert.rejects(new mcp.Icons8MCPTransport(async () => ({ ...reply({}), expectedContentLength: 1000001 })).json(protocol.MCP_ORIGIN), /过大/)
})
test("MCP stream handles UTF-8 split across chunks and cancels the reader after matching response", async () => native(async () => {
  const bytes = Buffer.from('data: {"jsonrpc":"2.0","id":7,"result":{"name":"银行"}}\n\n')
  const split = bytes.indexOf(Buffer.from("银行")) + 1
  const chunks = [bytes.subarray(0, split), bytes.subarray(split)]; let cancelled = false, released = false
  const response = { ...reply({}), headers: { get: () => "text/event-stream" }, dataStream: { getReader: () => ({ read: async () => chunks.length ? { done: false, value: new Bytes(chunks.shift()!) } : { done: true }, cancel: async () => { cancelled = true }, releaseLock: () => { released = true } }) } }
  assert.deepEqual(await new mcp.Icons8MCPTransport().body(response as any, 7), { name: "银行" })
  assert.equal(cancelled, true); assert.equal(released, true)
}))
test("MCP real request chain negotiates, searches with fluency, shares initialization and sends no REST key", async () => native(async env => {
  credentials.saveMCPSession(session(), credentials.mcpCredentialSnapshot())
  const pages = await Promise.all([mcp.searchIcons8MCP("earth smiley"), mcp.searchIcons8MCP("bank", 1)])
  assert.equal(pages[0].icons[0].id, "icons8-mcp:9GC5rqCM5uDh")
  const bodies = env.requests.map(row => JSON.parse(row.options.body))
  assert.equal(bodies.filter(body => body.method === "initialize").length, 1)
  const searches = bodies.filter(body => body.method === "tools/call")
  assert.deepEqual(searches.map(body => body.params.arguments.platform), ["fluency", "fluency"])
  assert.deepEqual(searches.map(body => body.params.arguments.offset), [0, 24])
  assert.ok(env.requests.every(row => row.url === protocol.MCP_ENDPOINT && row.options.headers.Authorization === "Bearer access-one" && row.options.headers["Api-Key"] === undefined))
  await mcp.verifyIcons8MCP()
  assert.equal(env.requests.filter(row => JSON.parse(row.options.body).method === "tools/call").length, 3)
}))
test("MCP one 401 refresh rotates credentials, reinitializes and retries once", async () => native(async env => {
  credentials.saveMCPSession(session(), credentials.mcpCredentialSnapshot())
  let refreshes = 0, initializations = 0, refuse = false
  env.setFetch(async (url: string, options: any) => {
    if (refuse) return reply({}, 401)
    if (url.endsWith("/token")) { refreshes++; assert.equal(new URLSearchParams(options.body).get("refresh_token"), "refresh-one"); return reply(tokens) }
    const body = JSON.parse(options.body)
    if (options.headers.Authorization === "Bearer access-one") return reply({}, 401)
    if (body.method === "initialize") initializations++
    return reply({ jsonrpc: "2.0", id: body.id, result: body.method === "initialize" ? { protocolVersion: "2025-03-26" } : body.method === "tools/list" ? { tools: [tool] } : artwork }, 200, { "mcp-session-id": "session-two" })
  })
  assert.equal((await mcp.searchIcons8MCP("bank")).icons.length, 1)
  assert.equal(refreshes, 1); assert.equal(initializations, 1)
  assert.equal(credentials.mcpCredentialSnapshot().session?.refreshToken, "refresh-two")
  refuse = true
  await assert.rejects(mcp.searchIcons8MCP("bank"), /续期失败/)
}))
test("MCP expiring session refresh happens before search, and cancelled queued work makes no request", async () => native(async env => {
  credentials.saveMCPSession(session("old", Date.now() - 1), credentials.mcpCredentialSnapshot())
  env.setFetch(async (url: string, options: any) => {
    if (url.endsWith("/token")) return reply(tokens)
    const body = JSON.parse(options.body)
    return reply({ jsonrpc: "2.0", id: body.id, result: body.method === "initialize" ? { protocolVersion: "2025-03-26" } : body.method === "tools/list" ? { tools: [tool] } : artwork }, 200, { "mcp-session-id": "session-new" })
  })
  await mcp.searchIcons8MCP("bank")
  assert.ok(env.requests[0].url.endsWith("/token"))
  const length = env.requests.length
  await assert.rejects(mcp.searchIcons8MCP("bank", 0, { shouldContinue: () => false }), /取消/)
  assert.equal(env.requests.length, length)
}))
test("MCP logout during a pending refresh cannot resurrect credentials", async () => native(async env => {
  credentials.saveMCPSession(session(), credentials.mcpCredentialSnapshot())
  let finish: any
  env.setFetch(async () => new Promise(resolve => { finish = resolve }))
  const work = mcp.refreshIcons8MCP(); const rejected = assert.rejects(work, /取消|更改/)
  await flush(); mcp.disconnectIcons8MCP(); finish(reply(tokens)); await rejected
  assert.equal(credentials.hasIcons8MCPSession(), false)
}))
test("MCP native login completes PKCE, ignores bad callback, persists only after Safari closes", async () => native(async env => {
  let challenge = "", closed = false
  env.setFetch(async (url: string, options: any) => {
    if (url.includes(".well-known")) return reply(metadata)
    if (url.includes("/health")) return { ...reply({}), text: async () => "ready" }
    if (url.endsWith("/register")) return reply({ client_id: "client-one", client_secret: "client-secret", token_endpoint_auth_method: "client_secret_post", redirect_uris: JSON.parse(options.body).redirect_uris })
    assert.ok(closed)
    const body = new URLSearchParams(options.body)
    assert.equal(body.get("code"), "auth-code")
    assert.equal(protocol.mcpBase64URL(createHash("sha256").update(body.get("code_verifier")!).digest("base64")), challenge)
    return reply(tokens)
  })
  env.setSafari(async (url: string) => {
    const args = new URL(url).searchParams; challenge = args.get("code_challenge")!
    const server = env.server(), callback = server.handlers.get(protocol.MCP_CALLBACK)
    assert.equal(server.listenAddressIPv4, "127.0.0.1")
    const request = { method: "GET", path: protocol.MCP_CALLBACK, headers: { host: "127.0.0.1:12345" }, queryParams: [{ key: "state", value: "wrong" }, { key: "code", value: "auth-code" }] }
    assert.equal((await callback(request)).status, 400)
    request.queryParams[0].value = args.get("state")!
    const response = await callback(request)
    assert.equal(response.status, 200); assert.ok(response.body.toRawString().includes("左上角"))
    assert.equal(credentials.hasIcons8MCPSession(), false); closed = true
  })
  await new mcp.Icons8MCPLogin(() => {}).connect()
  assert.equal(credentials.hasIcons8MCPSession(), true); assert.equal(env.server().stopped, true)
  assert.ok(env.requests.filter(row => !row.url.includes("127.0.0.1")).every(row => row.url.startsWith(protocol.MCP_ORIGIN + "/")))
}))
test("MCP cancelled native login preserves previous account without exchanging the code", async () => native(async env => {
  credentials.saveMCPSession(session(), credentials.mcpCredentialSnapshot())
  env.setFetch(async (url: string, options: any) => url.includes(".well-known") ? reply(metadata) : url.includes("/health") ? { ...reply({}), text: async () => "ready" }
    : reply({ client_id: "client-one", client_secret: "client-secret", token_endpoint_auth_method: "client_secret_post", redirect_uris: JSON.parse(options.body).redirect_uris }))
  env.setSafari(async () => {})
  await assert.rejects(new mcp.Icons8MCPLogin(() => {}).connect(), /尚未收到授权/)
  assert.equal(credentials.mcpCredentialSnapshot().session?.accessToken, "access-one")
  assert.equal(env.requests.some(row => row.url.endsWith("/token")), false)
  assert.equal(env.server().stopped, true)
}))
test("MCP public PNG render reads no credentials and validates bytes and dimensions before decoding", async () => native(async () => {
  Keychain.get = () => { throw Error("Must not read credentials") }
  const bytes = Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]).copy(bytes)
  bytes.writeUInt32BE(96, 16); bytes.writeUInt32BE(96, 20)
  let decoded = 0
  ;(globalThis as any).UIImage = { fromData: () => { decoded++; return { width: 96, height: 96 } } }
  const fetcher = async (url: string, options: any) => { assert.equal(url, icons8MCPPNGURL("icons8-mcp:9GC5rqCM5uDh")); assert.equal(options.headers, undefined); return { ...reply({}), data: async () => new Bytes(bytes) } }
  assert.ok(await loadIcons8MCPArtwork("icons8-mcp:9GC5rqCM5uDh", { fetch: fetcher }))
  bytes.writeUInt32BE(20000, 16)
  assert.equal(await loadIcons8MCPArtwork("icons8-mcp:9GC5rqCM5uDh", { fetch: fetcher }), null)
  assert.equal(decoded, 1)
}))

test("MCP artwork backup round-trip contains the choice but no account credentials", async () => native(async () => {
  credentials.saveMCPSession(session(), credentials.mcpCredentialSnapshot())
  const state = defaultState()
  state.settings.itemIconChoices = [{ source: "reminder", itemID: "same-reminder", iconID: "icons8-mcp:9GC5rqCM5uDh" }]
  ;(globalThis as any).Storage = { get: (key: string) => key === STATE_KEY ? structuredClone(state) : null, contains: (key: string) => key === STATE_KEY }
  const json = createBackupJSON()
  assert.deepEqual(parseBackupJSON(json).state.settings.itemIconChoices, state.settings.itemIconChoices)
  for (const privateValue of ["access-one", "refresh-one", "client-secret", "accessToken", "clientSecret", "refreshToken", "mcp.session"]) assert.ok(!json.includes(privateValue))
}))
test("MCP selected PNGs share the bounded 24-row/4-worker/64-image display path without reading login", async () => native(async env => {
  const bytes = Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]).copy(bytes)
  bytes.writeUInt32BE(96, 16); bytes.writeUInt32BE(96, 20)
  Keychain.get = () => { throw Error("Display must not read login") }
  ;(globalThis as any).UIImage = { fromData: () => ({ width: 96, height: 96 }) }
  let active = 0, peak = 0
  env.setFetch(async (url: string, options: any) => {
    assert.ok(url.startsWith("https://img.icons8.com/?id=")); assert.equal(options.headers, undefined)
    peak = Math.max(peak, ++active); await flush(); active--
    return { ...reply({}), data: async () => new Bytes(bytes) }
  })
  const ids = Array.from({ length: 65 }, (_, i) => `icons8-mcp:CacheFixture${i}`), directory = "/mcp-cache-regression"
  assert.equal(Object.keys(await loadArtworkPage([ids[0], ...ids], directory)).length, 24)
  assert.equal(env.requests.length, 24); assert.equal(peak, 4)
  const first = peekArtwork(ids[0], directory)
  assert.ok(first); assert.equal(await loadArtwork(ids[0], directory), first)
  assert.equal(env.requests.length, 24)
  for (const id of ids.slice(24)) await loadArtwork(id, directory)
  assert.equal(peekArtwork(ids[1], directory), null)
  assert.ok(peekArtwork(ids.at(-1)!, directory))
}))
