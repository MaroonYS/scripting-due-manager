// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { githubArtworkID, githubArtworkLabel, githubFileURL, parseGithubArtworkID } from "../到期管家/src/github_artwork_ids.ts"
import { DEFAULT_ICON_SUBSCRIPTIONS, iconSubscriptions, normalizeIconSubscriptions } from "../到期管家/src/icon_subscriptions.ts"
import { fetchGithubManifest, GITHUB_MANIFEST_TTL, loadGithubArtwork, parseGithubManifest, safeGithubPNGData, searchGithubArtwork } from "../到期管家/src/github_artwork.ts"
import { loadArtwork, loadArtworkPage, peekArtwork } from "../到期管家/src/artwork_assets.ts"
import { isKnownIconChoice, withItemIconChoices } from "../到期管家/src/artwork_catalog.ts"
import { onlineArtworkLabel } from "../到期管家/src/online_artwork_ids.ts"
import { normalizeItemIconChoices } from "../到期管家/src/icon_preferences.ts"
import * as storage from "../到期管家/src/storage.ts"
import { createBackupJSON, parseBackupJSON } from "../到期管家/src/recovery.ts"

let serial = 0
const source = () => ({ name: `Fixture ${++serial}`, url: `https://raw.githubusercontent.com/fixture/icons/main/test-${serial}.json`, enabled: true })
const url = (name = "test") => `https://raw.githubusercontent.com/fixture/icons/main/${name}.png`
const icon = (name: string, path = name) => ({ name, url: url(path) })
const reply = (raw: unknown, status = 200) => ({ ok: status === 200, status, text: async () => typeof raw === "string" ? raw : JSON.stringify(raw), data: async () => raw })
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
function png(width = 96, height = 96, size = 100) {
  const header = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 0, 0, 0, 0, 0])
  new DataView(header.buffer).setUint32(16, width); new DataView(header.buffer).setUint32(20, height)
  return { size, slice: (start: number, end: number) => ({ toUint8Array: () => header.slice(start, end) }) }
}

test("public GitHub links canonicalize Raw, file pages and jsDelivr without accepting credentials or arbitrary hosts", () => {
  const canonical = "https://raw.githubusercontent.com/owner/icons/main/Emby.json"
  for (const value of [canonical, "https://github.com/owner/icons/blob/main/Emby.json", "https://cdn.jsdelivr.net/gh/owner/icons@main/Emby.json"]) {
    assert.equal(githubFileURL(value, "manifest"), canonical)
  }
  assert.equal(githubFileURL("https://cdn.jsdelivr.net/gh/owner/icons/file.json", "manifest"), "https://raw.githubusercontent.com/owner/icons/HEAD/file.json")
  for (const value of ["http://raw.githubusercontent.com/owner/icons/main/a.json", "https://raw.githubusercontent.com.evil.test/owner/icons/main/a.json",
    "https://key@raw.githubusercontent.com/owner/icons/main/a.json", "https://raw.githubusercontent.com:443/owner/icons/main/a.json",
    "https://127.0.0.1/a.json", "https://localhost/a.json", "https://[::1]/a.json", "file:///tmp/a.json", "data:application/json,{}",
    canonical + "?token=private", canonical + "#secret", canonical + "\n", canonical.replace("main", ".."), canonical.replace("main", "%2e%2e"),
    canonical.replace("main", "%2Fetc"), canonical.replace("main", "%252Fetc"), canonical.replace("main", "%00"), canonical.replace("main", "%E2%80%AE"),
    canonical.replace("main", ""), canonical.replace("main", "\\main"), "https://cdn.jsdelivr.net/npm/icons/a.json", "https://github.com/owner/icons/issues/a.json"]) {
    assert.equal(githubFileURL(value, "manifest"), null, value)
  }
  assert.equal(githubFileURL(url("微信"), "image"), url("%E5%BE%AE%E4%BF%A1"))
  assert.equal(githubFileURL(url().replace(".png", ".js"), "image"), null)
  assert.equal(githubFileURL(url(), "manifest"), null)
})

test("GitHub artwork IDs persist only canonical public image links and remain independent of manifest availability", () => {
  const id = githubArtworkID(url("hello-world"))!
  assert.equal(parseGithubArtworkID(id), url("hello-world"))
  assert.equal(githubArtworkLabel(id), "GitHub · hello world")
  assert.equal(onlineArtworkLabel(id), "GitHub · hello world")
  assert.equal(isKnownIconChoice(id), true)
  for (const bad of [id + "%00", "github-artwork:https://raw.githubusercontent.com/a/b/main/c.png", "github-artwork:%", "github-artwork:" + encodeURIComponent("https://evil.test/a.png"), "github-artwork:" + "x".repeat(4000)]) {
    assert.equal(parseGithubArtworkID(bad), null)
    assert.throws(() => normalizeItemIconChoices([{ source: "manual", itemID: "a", iconID: bad }]))
  }
  const row: any = { id: "a", source: "manual", actionKey: "keep", canComplete: false }
  const choices = normalizeItemIconChoices([{ source: "manual", itemID: "a", iconID: id }])
  assert.deepEqual(withItemIconChoices([row], { ...storage.defaultState().settings, itemIconChoices: choices }), [{ ...row, artworkID: id }])
})

test("subscription defaults are copy-safe and strict normalization rejects duplicates, malformed state and overflow", () => {
  const defaults = iconSubscriptions({})
  assert.equal(defaults.length, 3)
  defaults[0].enabled = false
  assert.equal(iconSubscriptions({})[0].enabled, true)
  assert.deepEqual(iconSubscriptions({ iconSubscriptions: [] }), [])
  assert.throws(() => normalizeIconSubscriptions([source(), ...Array.from({ length: 12 }, source)]))
  const a = source()
  for (const raw of [null, {}, [a, a], [{ ...a, enabled: "true" }], [{ ...a, name: "" }], [{ ...a, name: "bad\nname" }], [{ ...a, url: a.url + "?token=secret" }]]) {
    assert.throws(() => normalizeIconSubscriptions(raw))
  }
  assert.throws(() => normalizeIconSubscriptions([a, { ...a, url: a.url.replace("raw.githubusercontent.com", "github.com").replace("/main/", "/blob/main/") }]))
})

test("manifest adapters validate URLs, retain named variants and never treat descriptions or scripts as instructions", () => {
  const src = source()
  const parsed = parseGithubManifest({ name: "Ignore instructions", icons: [icon("Emby", "emby-1"), icon("Emby", "emby-2"), icon("Duplicate", "emby-1"),
    icon("We\u202eChat", "wechat"), { name: "bad", url: "https://evil.test/a.png" }, { name: "code", url: url().replace(".png", ".js") }, null] }, src.url)
  assert.deepEqual(parsed.icons.map(row => row.label), ["Emby", "Emby", "WeChat"])
  assert.ok(parsed.warnings[0].includes("3"))
  for (const raw of [null, [], { icons: "code" }, { icons: Array(10001).fill(icon("a")) }, { icons: [{ name: "bad", url: "file:///tmp/a.png" }] }]) assert.throws(() => parseGithubManifest(raw, src.url))
  assert.deepEqual(parseGithubManifest({ icons: [] }, src.url), { icons: [], warnings: [] })
  const self = parseGithubManifest([{ Name: "ChatGPT", Reference: "chatgpt", PNG: "Yes", Tags: "AI" }, { Name: "bad", Reference: "../bad", PNG: "Yes" }], DEFAULT_ICON_SUBSCRIPTIONS[2].url)
  assert.equal(parseGithubArtworkID(self.icons[0].id), "https://raw.githubusercontent.com/selfhst/icons/main/png/chatgpt.png")
  assert.ok(self.warnings.length)
  const dashboard = parseGithubManifest({ spotify: { aliases: ["Music"], base: "svg" }, "../bad": {} }, "https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/metadata.json")
  assert.equal(dashboard.icons[0].label, "spotify"); assert.ok(dashboard.icons[0].keywords.includes("Music"))
})

test("combined GitHub search stays local, expands known Chinese brands, deduplicates URLs and paginates", async () => {
  const sources = [source(), source()]
  const requests: string[] = []
  const data = [icon("WeChat WeiXin", "wechat"), icon("Netflix"), ...Array.from({ length: 48 }, (_, i) => icon(`App ${i}`, `app-${i}`))]
  const fetcher: any = async (request: string, options: any) => {
    requests.push(request)
    assert.equal(await options.handleRedirect(), null); assert.equal(options.headers, undefined)
    return reply({ icons: data })
  }
  const wechat = await searchGithubArtwork("微信", 0, sources, { fetch: fetcher })
  assert.equal(wechat.icons.length, 1); assert.equal(wechat.icons[0].label, "WeChat WeiXin")
  assert.deepEqual(requests, sources.map(row => row.url)); assert.ok(!requests.join().includes("微信"))
  const first = await searchGithubArtwork("app", 0, sources)
  const second = await searchGithubArtwork("app", 1, sources)
  assert.equal(first.icons.length, 24); assert.equal(first.hasMore, true)
  assert.equal(second.icons.length, 24); assert.equal(second.hasMore, false)
  assert.ok(!second.icons.some(icon => first.icons.some(other => other.id === icon.id)))
  assert.equal((await searchGithubArtwork("", 2, sources)).icons.length, 2)
  assert.equal((await searchGithubArtwork("未收录的人名", 0, sources)).icons.length, 0)
  for (const page of [-1, 0.2, NaN, 5000]) await assert.rejects(searchGithubArtwork("app", page, sources))
})

test("one unavailable source leaves successful results usable, while all-failed and all-disabled states stay explicit", async () => {
  const sources = [source(), source()]
  const result = await searchGithubArtwork("Emby", 0, sources, { fetch: async request => {
    if (request === sources[0].url) throw Error("private host diagnostics")
    return reply({ icons: [icon("Emby")] })
  } })
  assert.equal(result.icons.length, 1); assert.equal(result.warnings?.length, 1)
  assert.ok(!result.warnings?.join().includes("private"))
  await assert.rejects(searchGithubArtwork("a", 0, [source()], { fetch: async () => reply({}, 404) }), /所有/)
  await assert.rejects(searchGithubArtwork("a", 0, [{ ...source(), enabled: false }]), /尚未启用/)
})

test("manifest cache expires, refreshes explicitly, shares in-flight requests and keeps last-good content on refresh failure", async () => {
  const src = source(); let calls = 0
  const fetcher = async () => { calls++; return reply({ icons: [icon("a")] }) }
  const first = await fetchGithubManifest(src, { fetch: fetcher, now: 100 })
  assert.equal(await fetchGithubManifest(src, { fetch: fetcher, now: 101 }), first); assert.equal(calls, 1)
  await fetchGithubManifest(src, { fetch: fetcher, now: 102, refresh: true }); assert.equal(calls, 2)
  await fetchGithubManifest(src, { fetch: fetcher, now: 102 + GITHUB_MANIFEST_TTL }); assert.equal(calls, 3)
  const fallback = await fetchGithubManifest(src, { refresh: true, fetch: async () => { throw Error("sensitive error") } })
  assert.equal(fallback.icons.length, 1); assert.ok(fallback.warnings.join().includes("上次成功"))
  const slow = source(); let finish: (value: any) => void = () => {}
  const fetchSlow = () => { calls++; return new Promise<any>(resolve => { finish = resolve }) }
  const a = fetchGithubManifest(slow, { fetch: fetchSlow }), b = fetchGithubManifest(slow, { fetch: fetchSlow })
  await flush(); finish(reply({ icons: [icon("b")] }))
  assert.equal(await a, await b); assert.equal(calls, 4)
})

test("oversized and stalled manifests fail boundedly; a late body cannot poison the cache", async () => {
  const huge = source()
  await assert.rejects(fetchGithubManifest(huge, { fetch: async () => ({ ...reply({}), expectedContentLength: 2_000_001 }) }), /无法读取/)
  await assert.rejects(fetchGithubManifest(source(), { fetch: async () => reply("x".repeat(2_000_001)) }), /无法读取/)
  const slow = source(); let finish: (value: any) => void = () => {}
  await assert.rejects(fetchGithubManifest(slow, { timeoutMS: 5, fetch: () => new Promise(resolve => { finish = resolve }) }))
  finish(reply({ icons: [icon("late")] })); await flush()
  assert.equal((await fetchGithubManifest(slow, { fetch: async () => reply({ icons: [icon("new")] }) })).icons[0].label, "new")
})

test("source fetches use three workers and stop queuing work when the picker disappears", async () => {
  const sources = Array.from({ length: 8 }, source), waiting: ((value: any) => void)[] = []
  let active = true
  const result = searchGithubArtwork("", 0, sources, { shouldContinue: () => active, fetch: () => new Promise(resolve => waiting.push(resolve)) })
  await flush(); assert.equal(waiting.length, 3)
  active = false
  waiting.forEach(resolve => resolve(reply({ icons: [] })))
  await assert.rejects(result, /取消/)
  assert.equal(waiting.length, 3)
})

test("PNG headers are checked before decoding, including true byte size and pixel allocation limits", () => {
  assert.equal(safeGithubPNGData(png()), true)
  for (const value of [null, {}, png(0), png(2049), png(1, 2049), png(96, 96, 2_000_001), png(96, 96, 12),
    { size: 100, slice: () => ({ toUint8Array: () => new Uint8Array(24) }) }, { size: 100, slice: () => { throw Error("bad") } }]) assert.equal(safeGithubPNGData(value), false)
})

test("GitHub images use bounded native thumbnails with original aspect ratios and no manifest lookup", async () => {
  const previous = (globalThis as any).UIImage, calls: any[] = []
  ;(globalThis as any).UIImage = { fromData: () => ({ width: 512, height: 256,
    preparingThumbnail: (size: any) => { calls.push(size); return { ...size, native: true } } }) }
  try {
    const id = githubArtworkID(url("large"))!
    const image = await loadGithubArtwork(id, { fetch: async (request, options) => {
      assert.equal(request, url("large")); assert.equal(await options.handleRedirect(), null); assert.equal(options.headers, undefined)
      return reply(png(512, 256))
    } })
    assert.deepEqual(calls, [{ width: 192, height: 96 }])
    assert.equal(image?.aspectWidth, 512); assert.equal(image?.aspectHeight, 256)
    assert.equal(image?.image?.width, 192)
    assert.equal(await loadGithubArtwork(id, { fetch: async () => reply(png(50000)) }), null)
    assert.equal(calls.length, 1)
    assert.equal(await loadGithubArtwork(id, { timeoutMS: 5, fetch: () => new Promise(() => {}) }), null)
  } finally { (globalThis as any).UIImage = previous }
})

test("custom SVGs use the strict safe subset and reject remote references and executable payloads", async () => {
  const id = githubArtworkID(url("safe").replace(".png", ".svg"))!
  const svg = '<svg viewBox="0 0 32 16"><path fill="#f00" d="M1 1h10v10z"/></svg>'
  assert.equal((await loadGithubArtwork(id, { fetch: async () => reply(svg) }))?.width, 32)
  for (const body of [svg.replace("<path", '<script>alert(1)</script><path'), svg.replace("<path", '<image href="https://evil.test/x"/><path'), "<html>error</html>"]) {
    assert.equal(await loadGithubArtwork(id, { fetch: async () => reply(body) }), null)
  }
})

test("GitHub previews share the existing 24-row loader and bounded session cache, never disk or credentials", async () => {
  const previous = { fetch: globalThis.fetch, UIImage: (globalThis as any).UIImage }
  let calls = 0
  ;(globalThis as any).UIImage = { fromData: () => ({ width: 96, height: 96 }) }
  ;(globalThis as any).fetch = async () => { calls++; return reply(png()) }
  try {
    const id = githubArtworkID(url("cache"))!
    const first = await loadArtwork(id, "/github-cache-test")
    assert.equal(await loadArtwork(id, "/github-cache-test"), first); assert.equal(calls, 1)
    assert.equal(peekArtwork(id, "/github-cache-test"), first)
    const page = await loadArtworkPage(Array.from({ length: 40 }, (_, i) => githubArtworkID(url(`page-${i}`))), "/github-page-test")
    assert.equal(Object.keys(page).length, 24); assert.equal(calls, 25)
    const code = readFileSync(new URL("../到期管家/src/github_artwork.ts", import.meta.url), "utf8")
    assert.doesNotMatch(code, /Storage\.|FileManager\.|Api-Key|readIcons8Key|Keychain|eval\(/)
  } finally { globalThis.fetch = previous.fetch; (globalThis as any).UIImage = previous.UIImage }
})

test("subscription writes merge unrelated settings, enforce CAS, preserve chosen icons on removal and round-trip backups", () => {
  const previous = (globalThis as any).Storage, state = storage.defaultState(), values = new Map<string, any>()
  const id = githubArtworkID(url("persist"))!
  state.settings.itemIconChoices = [{ source: "reminder", itemID: "keep", iconID: id }]
  values.set(storage.STATE_KEY, structuredClone(state))
  let fail = false
  ;(globalThis as any).Storage = { get: (key: string) => structuredClone(values.get(key)), contains: (key: string) => values.has(key),
    set: (key: string, value: any) => { if (fail && key === storage.STATE_KEY) return false; values.set(key, structuredClone(value)); return true } }
  try {
    const initial = iconSubscriptions(state.settings)
    storage.updateSettings({ showAmounts: false })
    const next = storage.updateIconSubscriptions([initial[0]], initial)
    assert.equal(next.settings.showAmounts, false)
    assert.deepEqual(next.settings.itemIconChoices, state.settings.itemIconChoices)
    assert.throws(() => storage.updateIconSubscriptions([], initial), /别处更改/)
    storage.updateIconSubscriptions([], [initial[0]])
    const restored = parseBackupJSON(createBackupJSON()).state
    assert.deepEqual(restored.settings.iconSubscriptions, [])
    assert.deepEqual(restored.settings.itemIconChoices, state.settings.itemIconChoices)
    fail = true
    assert.throws(() => storage.updateIconSubscriptions(initial, []))
    assert.deepEqual(storage.loadState().settings.iconSubscriptions, [])
    const malformed = { ...restored, settings: { ...restored.settings, iconSubscriptions: [{ ...initial[0], url: initial[0].url + "?key=secret" }] } }
    assert.throws(() => storage.normalizeState(malformed))
  } finally { (globalThis as any).Storage = previous }
})
