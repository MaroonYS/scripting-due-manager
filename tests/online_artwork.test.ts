// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { artworkFrame } from "../到期管家/src/artwork_adaptation.ts"
import { iconKeychainAvailable, readIcons8Key, removeIcons8Key, saveIcons8Key } from "../到期管家/src/icon_credentials.ts"
import { recommendIconQueries } from "../到期管家/src/icon_recommendations.ts"
import { onlineArtworkLabel, parseOnlineArtworkID } from "../到期管家/src/online_artwork_ids.ts"
import { loadOnlineArtwork, onlineSearchRequest, parseOnlineSearchPage, safeFluentSVG, searchOnlineArtwork } from "../到期管家/src/online_artwork.ts"
import { applyItemIconEdit, normalizeItemIconChoices, validStoredIconID } from "../到期管家/src/icon_preferences.ts"
import { isKnownIconChoice, withItemIconChoices } from "../到期管家/src/artwork_catalog.ts"
import { defaultState, normalizeState } from "../到期管家/src/storage.ts"
import { loadArtwork, loadArtworkPage, peekArtwork } from "../到期管家/src/artwork_assets.ts"

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 32 32"><path fill="#F8312F" d="M1 1h20v20H1z"/></svg>'
const fluent = "fluent-emoji-flat:alarm-clock", vendor = "icons8-online:g6K6MWJPKeyk"
const response = (raw: unknown, status = 200) => ({ ok: status < 300, status, text: async () => typeof raw === "string" ? raw : JSON.stringify(raw), data: async () => raw })
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }

test("online identifiers are provider-qualified, bounded and never arbitrary network or file paths", () => {
  for (const id of [fluent, "fluent-emoji-flat:person-medium-dark-skin-tone", vendor, "icons8-online:12345"]) {
    assert.ok(parseOnlineArtworkID(id)); assert.ok(validStoredIconID(id)); assert.ok(isKnownIconChoice(id)); assert.ok(onlineArtworkLabel(id))
  }
  for (const id of ["https://evil.test/a.svg", "fluent-emoji-flat:../../x", "fluent-emoji-flat:x?url=foo", "other:calendar", "fluent-emoji-flat:" + "a".repeat(129), "icons8-online:__proto__", "icons8-online:a/b", "icons8-online:" + "a".repeat(33), "fluent-emoji-flat:-x", "fluent-emoji-flat:a--b"]) {
    assert.equal(parseOnlineArtworkID(id), null); assert.equal(validStoredIconID(id), false)
  }
  assert.equal(parseOnlineArtworkID("icons8-LegacyID"), null)
  assert.equal(validStoredIconID("icons8-LegacyID"), true)
})

test("online choices round-trip state and preserve legacy choices, identity, permissions and CAS checks", () => {
  const initial = defaultState()
  initial.settings.itemIconChoices = normalizeItemIconChoices([{ source: "manual", itemID: "a", iconID: fluent }, { source: "reminder", itemID: "a", iconID: vendor }, { source: "manual", itemID: "b", iconID: "icons8-LegacyID" }])
  const restored = normalizeState(JSON.parse(JSON.stringify(initial)))
  assert.deepEqual(restored.settings.itemIconChoices, initial.settings.itemIconChoices)
  const rows = withItemIconChoices([{ id: "a", source: "manual", completionKey: "occurrence", title: "Private", canComplete: false, stale: true, iconName: "calendar" } as any], restored.settings)
  assert.equal(rows[0].artworkID, fluent); assert.equal(rows[0].completionKey, "occurrence"); assert.equal(rows[0].canComplete, false); assert.equal(rows[0].title, "Private")
  assert.throws(() => applyItemIconEdit(restored.settings, "manual", "a", { iconID: vendor, expectedIconID: null }))
  const changed = applyItemIconEdit(restored.settings, "manual", "a", { iconID: vendor, expectedIconID: fluent })
  assert.equal(changed.itemIconChoices.find(i => i.itemID === "b")?.iconID, "icons8-LegacyID")
})

test("Fluent search stays within the requested collection and uses the documented minimum limit", async () => {
  const req = onlineSearchRequest("fluent", " clock ", 2)
  const url = new URL(req.url)
  assert.equal(url.origin, "https://api.iconify.design"); assert.equal(url.pathname, "/search")
  assert.equal(url.searchParams.get("prefix"), "fluent-emoji-flat"); assert.equal(url.searchParams.get("query"), "clock")
  assert.equal(url.searchParams.get("limit"), "32"); assert.equal(url.searchParams.get("start"), "48")
  assert.equal(req.options.headers, undefined); assert.equal(await req.options.handleRedirect(), null)
})

test("Icons8 requests use header-only credentials, default to all styles and reject unsafe input", async () => {
  const req = onlineSearchRequest("icons8", "微信 & chat", 3, "全部风格", "test-only-fake-key")
  const url = new URL(req.url)
  assert.equal(url.origin, "https://search.icons8.com"); assert.equal(url.pathname, "/api/iconsets/v5/search")
  assert.equal(url.searchParams.get("platform"), null); assert.equal(url.searchParams.get("term"), "微信 & chat")
  assert.equal(url.searchParams.get("offset"), "72"); assert.equal(url.searchParams.get("amount"), "24")
  assert.equal(url.searchParams.get("token"), null); assert.ok(!req.url.includes("test-only"))
  assert.equal(req.options.headers?.["Api-Key"], "test-only-fake-key"); assert.equal(await req.options.handleRedirect(), null)
  assert.equal(new URL(onlineSearchRequest("icons8", "chat", 0, "Windows 11 Color", "fake").url).searchParams.get("platform"), "fluency")
  for (const page of [-1, 0.5, 201, NaN]) assert.throws(() => onlineSearchRequest("fluent", "clock", page))
  for (const term of ["", "  ", "a\nsecret", "a".repeat(101)]) assert.throws(() => onlineSearchRequest("fluent", term, 0))
  assert.throws(() => onlineSearchRequest("icons8", "clock", 0), /API Key/)
  assert.throws(() => onlineSearchRequest("icons8", "clock", 0, "全部风格", "bad\nkey"), /格式/)
})

test("result adapters discard foreign URLs, other Iconify sets, duplicates and animated/external results", () => {
  const a = parseOnlineSearchPage("fluent", { icons: [fluent, fluent, "mdi:home", "https://bad/a", "fluent-emoji-flat:book"] }, 0)
  assert.deepEqual(a.icons.map(i => i.id), [fluent, "fluent-emoji-flat:book"])
  const b = parseOnlineSearchPage("icons8", { parameters: { countAll: 60 }, icons: [{ id: "123", name: "We\nChat\u202e", platform: "fluency" }, { id: "123" }, { id: 456, name: "Clock" }, { id: "../bad" }, { id: "789", isAnimated: true }, { id: "101", isExternal: true }] }, 1)
  assert.deepEqual(b.icons.map(i => i.id), ["icons8-online:123", "icons8-online:456"])
  assert.equal(b.icons[0].label, "WeChat"); assert.equal(b.hasMore, true)
  assert.throws(() => parseOnlineSearchPage("fluent", { icons: "wrong" }, 0))
  assert.throws(() => parseOnlineSearchPage("icons8", { success: false, icons: [] }, 0))
})

test("search page boundaries never falsely treat total as the collection-wide count", () => {
  const ids = Array.from({ length: 32 }, (_, i) => `fluent-emoji-flat:icon-${i}`)
  const first = parseOnlineSearchPage("fluent", { total: 32, icons: ids }, 0)
  assert.equal(first.icons.length, 24); assert.equal(first.hasMore, true)
  assert.equal(parseOnlineSearchPage("fluent", { total: 24, icons: ids.slice(0, 24) }, 1).hasMore, false)
  assert.equal(parseOnlineSearchPage("icons8", { parameters: { countAll: 24 }, icons: [{ id: "123" }] }, 0).hasMore, false)
})

test("search makes live requests and surfaces safe authentication, quota and malformed-body failures", async () => {
  let count = 0
  const fetcher = async () => { count++; return response({ icons: [fluent] }) }
  assert.equal((await searchOnlineArtwork("fluent", "clock", 0, "全部风格", { fetch: fetcher })).icons[0].id, fluent)
  await searchOnlineArtwork("fluent", "clock", 0, "全部风格", { fetch: fetcher }); assert.equal(count, 2)
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(searchOnlineArtwork("icons8", "chat", 0, "全部风格", { apiKey: "fake-key", fetch: async () => response("DO NOT DISPLAY SERVER SECRETS", status) }), error => {
      assert.ok(!String(error).includes("SECRETS")); assert.ok(!String(error).includes("fake-key")); return true
    })
  }
  await assert.rejects(searchOnlineArtwork("fluent", "clock", 0, "全部风格", { fetch: async () => response("bad JSON") }), /失败/)
  await assert.rejects(searchOnlineArtwork("fluent", "clock", 0, "全部风格", { fetch: async () => { throw Error("URL?token=secret") } }), error => !String(error).includes("secret"))
})

test("missing Icons8 credentials fail clearly before issuing any request", async () => {
  let calls = 0
  await assert.rejects(searchOnlineArtwork("icons8", "chat", 0, "全部风格", { apiKey: null, fetch: async () => { calls++; return response({}) } }), /API Key/)
  assert.equal(await loadOnlineArtwork(vendor, { apiKey: null, fetch: async () => { calls++; return response({}) } }), null)
  assert.equal(calls, 0)
})

test("SVG display accepts native geometry and normalizes only em raster dimensions", () => {
  const safe = safeFluentSVG(svg)!
  assert.equal(safe.width, 32); assert.equal(safe.height, 32)
  assert.ok(safe.svg.includes('width="96" height="96"')); assert.ok(safe.svg.includes('viewBox="0 0 32 32"'))
  assert.ok(safe.svg.includes('fill="#F8312F" d="M1 1h20v20H1z"'))
  for (const text of ["bad", svg.replace("<path", '<script src="https://evil.test/x.js"/><path'), svg.replace("<path", '<image href="https://evil.test/a"/><path'), svg.replace("<path", '<foreignObject/><path'), svg.replace("fill=", 'onload="alert(1)" fill='), svg.replace("#F8312F", "url(https://evil.test)"), svg.replace("0 0 32 32", "0 0 999999 32"), "<!DOCTYPE svg>" + svg, svg.repeat(2000)]) assert.equal(safeFluentSVG(text), null)
})

test("live image loads are bounded, discard late results, and redact network errors", async () => {
  const calls: any[] = []
  const loaded = await loadOnlineArtwork(fluent, { fetch: async (...args) => { calls.push(args); return response(svg) } })
  assert.ok(loaded && "svg" in loaded); assert.equal(loaded.adaptive, true)
  assert.equal(calls[0][0], "https://api.iconify.design/fluent-emoji-flat/alarm-clock.svg")
  assert.equal(await calls[0][1].handleRedirect(), null)
  assert.equal(await loadOnlineArtwork(fluent, { fetch: async () => { throw Error("private") } }), null)
  assert.equal(await loadOnlineArtwork(fluent, { timeoutMS: 10, fetch: () => new Promise(() => {}) }), null)
  assert.equal(await loadOnlineArtwork(fluent, { fetch: async () => ({ ...response(svg), expectedContentLength: 9000000 }) }), null)
})

test("Icons8 display fetches fresh PNGs by ID, with no complete-response or disk cache", async () => {
  const prior = { UIImage: (globalThis as any).UIImage, Keychain: (globalThis as any).Keychain, fetch: globalThis.fetch }
  const calls: any[] = [], image = { width: 96, height: 96, native: true }
  ;(globalThis as any).UIImage = { fromData: (data: any) => data === "png-data" ? image : null }
  ;(globalThis as any).Keychain = { get: () => "fake-local-key", set: () => true, remove: () => true }
  ;(globalThis as any).fetch = async (...args: any[]) => { calls.push(args); return response("png-data") }
  try {
    assert.equal((await loadArtwork(vendor, "/test-live"))?.image, image)
    assert.equal(peekArtwork(vendor, "/test-live"), null)
    assert.equal((await loadArtwork(vendor, "/test-live"))?.image, image)
    assert.equal(calls.length, 2)
    assert.equal(calls[0][0], "https://api-img.icons8.com/?id=g6K6MWJPKeyk&size=96&format=png")
    assert.ok(!calls[0][0].includes("fake-local-key")); assert.equal(calls[0][1].headers["Api-Key"], "fake-local-key")
    assert.equal(await calls[0][1].handleRedirect(), null)
  } finally { Object.assign(globalThis, prior) }
})

test("obsolete visible-page batches stop starting additional online requests", async () => {
  const prior = globalThis.fetch
  const pending: (() => void)[] = [], progress: string[] = []
  let active = true, count = 0
  ;(globalThis as any).fetch = async () => { count++; await new Promise<void>(resolve => pending.push(resolve)); return response(svg) }
  try {
    const result = loadArtworkPage(Array.from({ length: 24 }, (_, i) => `fluent-emoji-flat:visible-${i}`), "/visible-cancel", { shouldContinue: () => active, onImage: id => progress.push(id) })
    await flush(); assert.equal(count, 4)
    active = false; pending.forEach(resolve => resolve())
    assert.deepEqual(await result, {}); assert.equal(count, 4); assert.deepEqual(progress, [])
  } finally { globalThis.fetch = prior }
})

test("Fluent SVGs reuse only the bounded session cache without reusing it across directories", async () => {
  const prior = globalThis.fetch
  let count = 0
  ;(globalThis as any).fetch = async () => { count++; return response(svg) }
  try {
    const first = await loadArtwork(fluent, "/fluent-cache-test")
    assert.equal(first, peekArtwork(fluent, "/fluent-cache-test"))
    assert.equal(first, await loadArtwork(fluent, "/fluent-cache-test")); assert.equal(count, 1)
    assert.equal(peekArtwork(fluent, "/another-script"), null)
    await loadArtwork(fluent, "/another-script"); assert.equal(count, 2)
  } finally { globalThis.fetch = prior }
})

test("visible-page images are delivered progressively while slower previews are still pending", async () => {
  const prior = globalThis.fetch
  const pending: (() => void)[] = [], progress: string[] = []
  let count = 0
  ;(globalThis as any).fetch = async () => { if (++count > 1) await new Promise<void>(resolve => pending.push(resolve)); return response(svg) }
  try {
    const ids = Array.from({ length: 4 }, (_, i) => `fluent-emoji-flat:progress-${i}`)
    const task = loadArtworkPage(ids, "/progressive-test", { onImage: id => progress.push(id) })
    await flush(); assert.deepEqual(progress, [ids[0]])
    pending.forEach(resolve => resolve())
    assert.equal(Object.keys(await task).length, 4); assert.equal(progress.length, 4)
  } finally { globalThis.fetch = prior }
})

test("secure credentials are script-local, non-syncing, validated and never mirrored to Storage", () => {
  const prior = { Keychain: (globalThis as any).Keychain, Storage: (globalThis as any).Storage }
  let value: string | null = null
  const calls: any[] = []
  ;(globalThis as any).Storage = { set: () => { throw Error("must not write plaintext") } }
  ;(globalThis as any).Keychain = { get: (key: string, options: any) => { calls.push(["get", key, options]); return value }, set: (key: string, next: string, options: any) => { calls.push(["set", key, options]); value = next; return true }, remove: (key: string, options: any) => { calls.push(["remove", key, options]); value = null; return true } }
  try {
    assert.equal(iconKeychainAvailable(), true); saveIcons8Key(" fake-only-key "); assert.equal(readIcons8Key(), "fake-only-key")
    assert.throws(() => saveIcons8Key("bad\nsecret"), /有效/)
    removeIcons8Key(); assert.equal(readIcons8Key(), null)
    assert.ok(calls.every(([, key, options]) => key === "due-manager.icons8.api-key.v1" && options.synchronizable === false && options.accessibility === "first_unlock_this_device"))
    ;(globalThis as any).Keychain = undefined
    assert.equal(iconKeychainAvailable(), false); assert.equal(readIcons8Key(), null); assert.throws(() => saveIcons8Key("fake"), /更新/)
  } finally { Object.assign(globalThis, prior) }
})

test("native credential failures cannot leak sensitive host error messages", () => {
  const prior = (globalThis as any).Keychain
  ;(globalThis as any).Keychain = { get: () => { throw Error("secret") }, set: () => { throw Error("secret") }, remove: () => { throw Error("secret") } }
  try {
    assert.equal(readIcons8Key(), null)
    assert.throws(() => saveIcons8Key("fake-key"), error => !String(error).includes("secret"))
    assert.throws(() => removeIcons8Key(), error => !String(error).includes("secret"))
  } finally { (globalThis as any).Keychain = prior }
})

test("recommendations recognize complete app names before generic words like Plus or Adobe", () => {
  for (const [title, expected, emoji] of [["ChatGPT Plus 续费", "ChatGPT", "robot"], ["Adobe Photoshop 订阅", "Adobe Photoshop", "artist"], ["微信会员", "WeChat", "speech"], ["Apple Music 会员", "Apple Music", "musical"], ["Netflix", "Netflix", "movie"], ["iCloud 200GB", "iCloud", "cloud"]]) {
    const result = recommendIconQueries(title, "subscription")
    assert.equal(result.icons8, expected); assert.equal(result.fluent, emoji)
  }
})

test("automatic recommendations transmit only public vocabulary, never arbitrary personal titles", () => {
  const result = recommendIconQueries("交房租 给张三 13800138000 ￥6000 2026-10-01 private@example.test", "bill")
  assert.equal(result.icons8, "house"); assert.equal(result.fluent, "house")
  const serialized = JSON.stringify(result)
  for (const text of ["张三", "13800138000", "6000", "2026", "private@example.test"]) assert.ok(!serialized.includes(text))
  assert.equal(recommendIconQueries("QZXPRIVATECLIENTCODE", "custom").icons8, "calendar")
})

test("adaptive frames preserve aspect ratio and keep proportional insets across all display sizes", () => {
  for (const size of [12, 24, 30, 32, 80]) {
    const wide = artworkFrame(size, 200, 100, true), tall = artworkFrame(size, 100, 300, true)
    assert.ok(wide.width < size); assert.equal(wide.width / wide.height, 2)
    assert.ok(Math.abs(tall.width / tall.height - 1 / 3) < 1e-8)
  }
  assert.deepEqual(artworkFrame(24, undefined, undefined), { side: 24, width: 24, height: 24 })
  assert.equal(artworkFrame(NaN, 0, 0).side, 24)
})

test("online implementation does not persist API responses, credential fields or arbitrary URLs", () => {
  for (const file of ["online_artwork.ts", "artwork_browser.tsx", "icon_credentials.ts"]) {
    const text = readFileSync(new URL(`../到期管家/src/${file}`, import.meta.url), "utf8")
    assert.ok(!/Storage\.(?:set|write)|FileManager\.(?:write|create)/.test(text))
  }
  const entry = readFileSync(new URL("../到期管家/widget.tsx", import.meta.url), "utf8")
  assert.ok(entry.includes("artworkImage:")); assert.ok(entry.includes("finally { active = false }"))
})
