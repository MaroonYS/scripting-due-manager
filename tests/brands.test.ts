// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { createHash } from "node:crypto"
import test from "node:test"
import { BRAND_CATALOG } from "../到期管家/src/brand_catalog.ts"
import { BRAND_ASSETS, brandAsset, brandFallbackPath, loadBrandLogo, inspectBrandLogo, brandLogoStatusText } from "../到期管家/src/brand_assets.ts"
import { itemBrandChoice, normalizeBrandPreferences, resolveItemBrand, withItemBrandChoice } from "../到期管家/src/brand_preferences.ts"
import { defaultState, loadState, STATE_KEY, updateItemBrandChoice, updateSettings, listLocalSnapshots, upsertItem, completeManualItem, LOCAL_SNAPSHOTS_KEY } from "../到期管家/src/storage.ts"
import { createRecurrenceRule } from "../到期管家/src/date.ts"
import { createBackupJSON, parseBackupJSON } from "../到期管家/src/recovery.ts"
import { widgetCompletionLabel } from "../到期管家/src/widget_localization.ts"
import type { DisplayDueItem, ManualDueItem } from "../到期管家/src/types.ts"

const item: DisplayDueItem = { source: "manual", id: "same/id", title: "SafePal 月费", kind: "subscription",
  iconName: "creditcard.fill", iconColor: "systemOrange", dueDate: "2026-09-30", dueTimestamp: 1790755200000,
  completionKey: "exact-occurrence", includesTime: false, hour: 0, minute: 0, remindBeforeDays: 0,
  amount: "", note: "", priority: 0, stale: false, canComplete: true }
const byName = (name: string) => BRAND_CATALOG.find(brand => brand.name === name)!
const settings = () => ({ ...defaultState().settings, smallWidgetIconStyle: "brand" as const })
const fallbackText = (path: string) => readFileSync(new URL(`../到期管家/${brandFallbackPath(path)}`, import.meta.url), "utf8")

test("catalog contains 332 unique stable choices across all requested sectors, separate from artwork", () => {
  assert.equal(BRAND_CATALOG.length, 332)
  assert.equal(new Set(BRAND_CATALOG.map(brand => brand.id)).size, 332)
  for (const brand of BRAND_CATALOG) {
    assert.ok(brand.name && brand.group)
    assert.match(brand.id, /^brand-[a-f0-9]{16}$/)
  }
  for (const name of ["中国移动", "中国联通", "中国电信", "Spotify", "Netflix", "Bitwarden", "SafePal / Fiat24"]) assert.ok(byName(name))
  assert.equal(BRAND_ASSETS.length, BRAND_CATALOG.length, "every selectable brand has a real bundled image")
  assert.equal(new Set(BRAND_ASSETS.map(asset => asset.brandID)).size, BRAND_ASSETS.length)
  for (const asset of BRAND_ASSETS) {
    assert.ok(BRAND_CATALOG.some(brand => brand.id === asset.brandID))
    assert.ok(asset.size >= 20 && asset.size <= 24)
    for (const path of [asset.light, asset.dark]) {
      assert.match(path, /^assets\/brands\/[a-z0-9-]+\.png$/)
      const data = readFileSync(new URL(`../到期管家/${path}`, import.meta.url))
      assert.equal(data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a")
    }
  }
})

test("all 332 source records, PNGs and embedded fallbacks agree byte-for-byte", () => {
  const manifest = JSON.parse(readFileSync(new URL("../到期管家/assets/brands/manifest.json", import.meta.url), "utf8"))
  assert.equal(manifest.brandCount, 332)
  assert.equal(manifest.assets.length, 332)
  const paths = new Set<string>()
  for (const asset of BRAND_ASSETS) {
    const record = manifest.assets.find((record: any) => record.brandID === asset.brandID)
    assert.ok(record)
    assert.equal(record.name, BRAND_CATALOG.find(brand => brand.id === asset.brandID)!.name)
    assert.equal(record.outputs.length, new Set([asset.light, asset.dark]).size)
    if (record.source.type !== "reviewed-original") {
      assert.match(record.source.url, /^https:\/\//)
      assert.match(record.source.inputSHA256, /^[a-f0-9]{64}$/)
      assert.ok(record.source.basis)
    }
    for (const path of new Set([asset.light, asset.dark])) {
      paths.add(path)
      const bytes = readFileSync(new URL(`../到期管家/${path}`, import.meta.url))
      const fallback = JSON.parse(fallbackText(path))
      assert.equal(fallback.source, path)
      assert.equal(fallback.encoding, "base64")
      assert.deepEqual(Buffer.from(fallback.png, "base64"), bytes, path)
      const source = record.outputs.find((output: any) => output.path === path)
      assert.equal(createHash("sha256").update(bytes).digest("hex"), source.sha256, path)
      const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20)
      assert.ok(width >= 144 && height >= 144 && width <= 800 && height <= 800)
    }
  }
  assert.equal(paths.size, 333)
  assert.deepEqual(readdirSync(new URL("../到期管家/assets/brands/fallbacks", import.meta.url)).sort(),
    [...paths].map(path => path.split("/").at(-1)!.replace(".png", ".json")).sort())
  const runtime = readFileSync(new URL("../到期管家/src/brand_assets.ts", import.meta.url), "utf8")
  assert.doesNotMatch(runtime, /fetch\(|Storage\.|XMLHttpRequest|https?:\/\//)
})

test("bundled official image bytes match the reviewed source artifacts", () => {
  const hashes = {
    "safepal-dark.png": "b73d9e50a6c2dc890bf47f1aebf3230971c06ab591c44ddae48c20929d5c6b6d",
    "safepal-light.png": "66b358516bbaa30d32ba7bf1bc3da2f50bb4c4e6163842f348f7b8e55d399637",
    "telegram.png": "44af9a76a532559ef8cb450b48096713be819103ab79a19d7e4abb9b32ff4cb7",
  }
  const sources = readFileSync(new URL("../到期管家/assets/brands/SOURCES.md", import.meta.url), "utf8")
  for (const [file, expected] of Object.entries(hashes)) {
    const actual = createHash("sha256").update(readFileSync(new URL(`../到期管家/assets/brands/${file}`, import.meta.url))).digest("hex")
    assert.equal(actual, expected)
    assert.ok(sources.includes(expected))
  }
})

test("third-party sources retain upstream notices and do not claim artwork ownership", () => {
  const read = (path: string) => readFileSync(new URL(`../到期管家/${path}`, import.meta.url), "utf8")
  const manifest = JSON.parse(read("assets/brands/manifest.json"))
  const counts: Record<string, number> = {}
  for (const { source } of manifest.assets) {
    counts[source.type] = (counts[source.type] ?? 0) + 1
    if (source.type === "simple-icons") {
      assert.match(source.url, /777807a262bb7384ff406fd4b35fdcd02e9514c3/)
      assert.match(source.color, /^[a-fA-F0-9]{6}$/)
    }
    if (source.type === "app-store") {
      assert.ok(source.appID && source.appName && source.seller)
    }
  }
  assert.deepEqual(counts, { "brand-site": 164, "app-store": 115, "simple-icons": 50, "reviewed-original": 2, "lobe-icons": 1 })
  assert.ok(read("assets/brands/simple-icons-license.txt").includes("No trademark or patent rights"))
  assert.ok(read("assets/brands/simple-icons-disclaimer.txt").includes("all icons within the project are also CC0"))
  assert.ok(read("assets/brands/lobe-icons-license.txt").includes("Copyright (c) 2023 LobeHub"))
  assert.ok(read("assets/brands/lobe-icons-license.txt").includes("Permission is hereby granted, free of charge"))
  assert.ok(read("NOTICE.md").includes("assets/brands/"))
  assert.ok(JSON.parse(fallbackText(BRAND_ASSETS[0].light)).notice.includes("Third-party artwork"))
})

test("every brand name and alias stays a system icon unless that exact item explicitly selects a brand", () => {
  for (const style of ["system", "brand"] as const) for (const source of ["manual", "reminder"] as const) {
    const value = { ...settings(), smallWidgetIconStyle: style }
    const original = structuredClone(value)
    for (const brand of BRAND_CATALOG) for (const title of [brand.name, ...brand.aliases]) {
      assert.equal(resolveItemBrand({ ...item, source, title, iconIsExplicit: false }, value), null, `${source}:${style}:${title}`)
    }
    assert.deepEqual(value, original)
  }
})

test("system default, manual SF choices, stale and read-only guards take priority", () => {
  assert.equal(resolveItemBrand(item, defaultState().settings), null)
  assert.equal(resolveItemBrand({ ...item, iconIsExplicit: true }, settings()), null)
  assert.equal(resolveItemBrand(item, settings()), null)
  const selected = { ...settings(), itemBrandChoices: withItemBrandChoice(settings(), item, byName("Spotify").id) }
  assert.equal(resolveItemBrand({ ...item, iconIsExplicit: true }, selected)?.name, "Spotify")
  assert.equal(resolveItemBrand({ ...item, stale: true }, selected), null)
  assert.equal(resolveItemBrand({ ...item, canComplete: false }, selected), null)
  assert.equal(resolveItemBrand(item, { ...selected, smallWidgetIconStyle: "system" })?.name, "Spotify")
  for (const brandID of ["system", "brand-future"]) assert.equal(resolveItemBrand(item, {
    ...settings(), itemBrandChoices: withItemBrandChoice(settings(), item, brandID),
  }), null)
})

test("mixed per-item choices ignore both legacy modes and cannot leak across IDs, sources or renamed titles", () => {
  for (const style of ["system", "brand"] as const) {
    const selected = { ...settings(), smallWidgetIconStyle: style,
      itemBrandChoices: [{ source: "manual" as const, itemID: item.id, brandID: byName("Spotify").id }] }
    assert.equal(resolveItemBrand({ ...item, title: "Renamed Netflix" }, selected)?.name, "Spotify")
    assert.equal(resolveItemBrand({ ...item, id: "other", title: "Spotify" }, selected), null)
    assert.equal(resolveItemBrand({ ...item, source: "reminder", title: "Spotify" }, selected), null)
    const mixed = { ...selected, itemBrandChoices: withItemBrandChoice(selected, { ...item, source: "reminder" }, byName("Telegram").id) }
    const changed = { ...mixed, itemBrandChoices: withItemBrandChoice(mixed, item, "system") }
    assert.equal(resolveItemBrand(item, changed), null)
    assert.equal(resolveItemBrand({ ...item, source: "reminder" }, changed)?.name, "Telegram")
    assert.equal(changed.smallWidgetIconStyle, style)
  }
})

test("per-item selections distinguish sources and preserve unknown IDs without prototype keys", () => {
  let value = settings()
  const reminder = { ...item, source: "reminder" as const }
  value = { ...value, itemBrandChoices: withItemBrandChoice(value, item, "system") }
  value = { ...value, itemBrandChoices: withItemBrandChoice(value, reminder, "brand-future") }
  assert.equal(itemBrandChoice(value, item), "system")
  assert.equal(itemBrandChoice(value, reminder), "brand-future")
  value = { ...value, itemBrandChoices: withItemBrandChoice(value, item, null) }
  assert.equal(itemBrandChoice(value, item), null)
  assert.equal(itemBrandChoice(value, reminder), "brand-future")
  assert.equal(withItemBrandChoice(value, { source: "manual", id: "__proto__" }, "system").length, 2)
})

test("legacy settings migrate safely while invalid and duplicate preferences fail closed", () => {
  assert.deepEqual(normalizeBrandPreferences({}), { smallWidgetIconStyle: "system", itemBrandChoices: [] })
  const valid = { source: "manual", itemID: "x", brandID: "brand-future" }
  for (const raw of [{ smallWidgetIconStyle: "other" }, { itemBrandChoices: {} }, { itemBrandChoices: [valid, valid] },
    { itemBrandChoices: [{ ...valid, source: "contact" }] }, { itemBrandChoices: [{ ...valid, brandID: "../../logo" }] },
    { itemBrandChoices: Array.from({ length: 2001 }, (_, i) => ({ ...valid, itemID: String(i) })) }]) {
    assert.throws(() => normalizeBrandPreferences(raw))
  }
})

test("preferences survive saves, automatic snapshots and backup export/import without modifying items", () => {
  const previous = (globalThis as any).Storage
  const values = new Map<string, unknown>([[STATE_KEY, defaultState(1)]])
  let fail = false
  ;(globalThis as any).Storage = {
    get: (key: string) => structuredClone(values.get(key) ?? null),
    set: (key: string, value: unknown) => { if (fail) return false; values.set(key, structuredClone(value)); return true },
    contains: (key: string) => values.has(key), remove: (key: string) => values.delete(key),
  }
  try {
    assert.equal(loadState().settings.smallWidgetIconStyle, "system")
    updateSettings({ smallWidgetIconStyle: "brand" })
    updateItemBrandChoice(item, "brand-future")
    updateSettings({ showAmounts: false })
    assert.equal(itemBrandChoice(loadState().settings, item), "brand-future")
    assert.equal(itemBrandChoice(listLocalSnapshots()[0].state.settings, item), "brand-future")
    assert.deepEqual(parseBackupJSON(createBackupJSON()).state.settings, loadState().settings)
    const corrupt = JSON.parse(createBackupJSON())
    corrupt.state.settings.itemBrandChoices[0].brandID = "../evil"
    assert.throws(() => parseBackupJSON(JSON.stringify(corrupt)))
    fail = true
    assert.throws(() => updateItemBrandChoice(item, "system"))
    assert.equal(itemBrandChoice(loadState().settings, item), "brand-future")
    assert.deepEqual(loadState().items, [])
    fail = false
    const raw = values.get(STATE_KEY) as any
    raw.settings.itemBrandChoices = [null]
    values.set(STATE_KEY, raw)
    assert.throws(() => updateSettings({ showAmounts: true }))
    assert.deepEqual((values.get(STATE_KEY) as any).settings.itemBrandChoices, [null])
  } finally { (globalThis as any).Storage = previous }
})

test("missing, corrupt or unavailable UIImage decoding never hides the fallback symbol", async () => {
  const previous = (globalThis as any).UIImage, previousFiles = (globalThis as any).FileManager
  const asset = brandAsset(byName("SafePal / Fiat24").id)!
  const calls: string[] = []
  try {
    ;(globalThis as any).FileManager = { readAsData: async (path: string) => { calls.push(path); return { path } } }
    delete (globalThis as any).UIImage
    assert.equal(await loadBrandLogo(asset, "/bundle"), null)
    assert.equal(await loadBrandLogo(null, "/bundle"), null)
    ;(globalThis as any).UIImage = { fromData: (data: unknown) => data }
    const logo = (await loadBrandLogo(asset, "/bundle"))!
    assert.ok(logo.image.light && logo.image.dark)
    assert.equal(logo.size, asset.size)
    assert.ok(calls.every(path => path.startsWith("/bundle/assets/brands/")))
    ;(globalThis as any).UIImage = { fromData: (data: any) => data.path.endsWith(asset.dark) ? null : {} }
    assert.equal(await loadBrandLogo(asset, "/bundle"), null)
    ;(globalThis as any).UIImage = { fromData: () => { throw Error("corrupt") } }
    assert.equal(await loadBrandLogo(asset, "/bundle"), null)
    assert.equal(brandAsset("brand-future"), null)
  } finally { (globalThis as any).UIImage = previous; (globalThis as any).FileManager = previousFiles }
})

test("independent offline image files rescue missing PNG reads and distinguish failures", async () => {
  const previous = (globalThis as any).UIImage, previousFiles = (globalThis as any).FileManager
  const asset = brandAsset(byName("SafePal / Fiat24").id)!, decoded: string[] = [], reads: string[] = []
  try {
    ;(globalThis as any).FileManager = {
      readAsData: async () => { throw Error("PNG unavailable") },
      readAsString: async (path: string) => {
        reads.push(path)
        return fallbackText(path.endsWith("safepal-dark.json") ? asset.light : asset.dark)
      },
    }
    ;(globalThis as any).UIImage = { fromData: () => null, fromBase64String: (value: string) => { decoded.push(value); return { value } } }
    assert.equal((await inspectBrandLogo(asset, "/moved/bundle")).status, "ready")
    assert.deepEqual(decoded, [JSON.parse(fallbackText(asset.light)).png, JSON.parse(fallbackText(asset.dark)).png])
    assert.equal(reads.length, 2, "only the two selected variants are read, never the whole library")
    ;(globalThis as any).UIImage = { fromBase64String: () => ({}) }
    assert.ok(await loadBrandLogo(asset, "/bundle"), "base64-only decoder remains supported")
    ;(globalThis as any).UIImage = { fromBase64String: () => null }
    assert.equal((await inspectBrandLogo(asset, "/bundle")).status, "decode-failed")
    ;(globalThis as any).UIImage = {}
    assert.equal((await inspectBrandLogo(asset, "/bundle")).status, "decoder-unavailable")
    assert.equal((await inspectBrandLogo(null, "/bundle")).status, "not-bundled")
    const statuses = ["ready", "loading", "not-bundled", "decoder-unavailable", "decode-failed", "timed-out"] as const
    assert.equal(new Set(statuses.map(brandLogoStatusText)).size, statuses.length)
  } finally { (globalThis as any).UIImage = previous; (globalThis as any).FileManager = previousFiles }
})

function brandStorageHarness() {
  const previous = (globalThis as any).Storage
  const draft: ManualDueItem = { id: "brand-editor-item", title: "Monthly", kind: "subscription", iconName: null,
    dueDate: "2026-09-30", includesTime: false, hour: 0, minute: 0, remindBeforeDays: 0,
    recurrence: createRecurrenceRule("month", 1, "2026-09-30"), amount: "12", note: "keep", enabled: true, createdAt: 1, updatedAt: 2 }
  const values = new Map<string, unknown>([[STATE_KEY, { ...defaultState(2), items: [draft] }]])
  const failures = new Set<string>(), writes: string[] = []
  ;(globalThis as any).Storage = {
    get: (key: string) => structuredClone(values.get(key) ?? null),
    set: (key: string, value: unknown) => { if (failures.has(key)) return false; writes.push(key); values.set(key, structuredClone(value)); return true },
    contains: (key: string) => values.has(key), remove: (key: string) => values.delete(key),
  }
  return { draft, values, failures, writes, cleanup: () => { (globalThis as any).Storage = previous } }
}

test("saving an edited item commits only its own brand preference without changing the legacy global mode", () => {
  const env = brandStorageHarness()
  try {
    updateItemBrandChoice({ source: "reminder", id: env.draft.id }, byName("Telegram").id)
    env.writes.length = 0
    const next = upsertItem({ ...env.draft, title: "Edited" }, env.draft.updatedAt, { brandID: byName("Spotify").id })
    assert.equal(env.writes.filter(key => key === STATE_KEY).length, 1)
    assert.equal(next.items[0].title, "Edited")
    assert.equal(next.settings.smallWidgetIconStyle, "system")
    assert.equal(itemBrandChoice(next.settings, { source: "manual", id: env.draft.id }), byName("Spotify").id)
    assert.equal(itemBrandChoice(next.settings, { source: "reminder", id: env.draft.id }), byName("Telegram").id)
    assert.equal(itemBrandChoice(listLocalSnapshots()[0].state.settings, { source: "manual", id: env.draft.id }), null)
    assert.equal(next.items[0].dueDate, env.draft.dueDate)
    assert.equal(next.items[0].note, env.draft.note)
    assert.equal(next.completionHistory?.length ?? 0, 0)
    const unchanged = upsertItem({ ...loadState().items[0], note: "new note" }, next.items[0].updatedAt)
    assert.equal(itemBrandChoice(unchanged.settings, { source: "manual", id: env.draft.id }), byName("Spotify").id, "an untouched editor choice preserves the latest stored preference")
  } finally { env.cleanup() }
})

test("save failures and stale editor revisions cannot partially commit a brand selection", () => {
  for (const failKey of [STATE_KEY, LOCAL_SNAPSHOTS_KEY]) {
    const env = brandStorageHarness()
    try {
      const original = structuredClone(env.values.get(STATE_KEY))
      env.failures.add(failKey)
      assert.throws(() => upsertItem({ ...env.draft, title: "Edited" }, 2, { brandID: byName("Spotify").id }))
      assert.deepEqual(env.values.get(STATE_KEY), original)
      assert.throws(() => completeManualItem(env.draft, 2, false, new Date(2026, 8, 30).getTime(), { brandID: byName("Spotify").id }))
      assert.deepEqual(env.values.get(STATE_KEY), original)
      env.failures.clear()
      assert.throws(() => upsertItem(env.draft, 1, { brandID: byName("Spotify").id }))
      assert.throws(() => completeManualItem(env.draft, 1, false, Date.now(), { brandID: byName("Spotify").id }))
      assert.deepEqual(env.values.get(STATE_KEY), original)
      assert.throws(() => upsertItem(env.draft, 2, { brandID: "../bad" }))
      assert.deepEqual(env.values.get(STATE_KEY), original)
    } finally { env.cleanup() }
  }
})

test("complete-and-save keeps one occurrence record together with the staged brand choice", () => {
  const env = brandStorageHarness()
  try {
    const next = completeManualItem({ ...env.draft, note: "edited note" }, 2, false, new Date(2026, 8, 30).getTime(), { brandID: byName("Spotify").id })
    assert.equal(env.writes.filter(key => key === STATE_KEY).length, 1)
    assert.equal(next.items[0].dueDate, "2026-10-30")
    assert.equal(next.items[0].note, "edited note")
    assert.equal(next.completionHistory?.length, 1)
    assert.equal(next.completionHistory?.[0].source, "manual")
    assert.equal(itemBrandChoice(next.settings, { source: "manual", id: env.draft.id }), byName("Spotify").id)
    assert.equal(next.settings.smallWidgetIconStyle, "system")
    const cleared = upsertItem(loadState().items[0], next.items[0].updatedAt, { brandID: null })
    assert.equal(itemBrandChoice(cleared.settings, { source: "manual", id: env.draft.id }), null)
    assert.equal(cleared.settings.smallWidgetIconStyle, "system", "clearing one choice must not change the legacy global mode")
  } finally { env.cleanup() }
})

test("actual logo button JSX preserves the native completion label, target and exact occurrence intent", () => {
  const source = readFileSync(new URL("../到期管家/src/widget_view.tsx", import.meta.url), "utf8")
  const code = source.slice(source.indexOf("function ListCompletionIcon("), source.indexOf("function listItemSupportingText("))
  const bindings = {
    h: (type: any, props: any, ...children: any[]) => typeof type === "function" ? type(props) : ({ type, props, children }),
    Button: "Button", Image: "Image", BrandCompletionLabel: "BrandCompletionLabel", widgetCompletionLabel, widgetRuntimeLocale: () => "en-US",
    CompleteDueItemIntent: (value: any) => ({ intent: "complete", ...value }),
  }
  const compiled = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } }).transformSync(code)
  const render = new Function(...Object.keys(bindings), `${compiled}\nreturn ListCompletionIcon`)(...Object.values(bindings))
  const logo = { image: { light: {}, dark: {} }, size: 20 }
  for (const value of [null, logo]) {
    const node = render({ item, hitSize: 40, symbolSize: 17, logo: value })
    assert.equal(node.type, "Button")
    assert.deepEqual(node.props.frame, { width: 40, height: 40 })
    assert.equal(node.props.contentShape, "rect")
    assert.deepEqual(node.props.intent, { intent: "complete", source: item.source, id: item.id, occurrenceKey: item.completionKey })
    assert.equal(node.props.foregroundStyle, value ? undefined : item.iconColor)
    assert.equal(node.props.widgetAccentable, !value)
    if (value) {
      assert.equal(node.props.title, undefined, "custom labels must not compete with a native title initializer")
      assert.equal(node.children[0].type, "BrandCompletionLabel")
      assert.equal(node.children[0].props.title, widgetCompletionLabel(item, "en-US"))
      assert.equal(node.children[0].props.hitSize, 40)
      assert.equal(node.children[0].props.logo, value)
      assert.equal(node.children[0].props.widget, true)
    } else {
      assert.equal(node.props.title, widgetCompletionLabel(item, "en-US"))
      assert.equal(node.props.labelStyle, "iconOnly")
    }
    assert.equal(node.props.background, undefined, "the brand image must be inside the tappable label, not outside as a background")
  }
  for (const patch of [{ stale: true }, { canComplete: false }]) {
    const node = render({ item: { ...item, ...patch }, hitSize: 40, symbolSize: 17, logo })
    assert.equal(node.type, "Image")
    assert.equal(node.props.systemName, item.iconName)
    assert.equal(node.props.foregroundStyle, "tertiaryLabel")
    assert.equal(node.props.intent, undefined)
  }
  assert.equal(source.match(/logo=\{logo\}/g)?.length, 4, "only the small-widget chain and its completion label forward a logo")
  assert.doesNotMatch(source.slice(source.indexOf("function SmallNextItemPreview("), source.indexOf("function ListWidget(")), /brandAsset|loadBrandLogo|logo=/)
})

function brandUIHarness(refreshFailure = false, saveFailure = false) {
  const source = readFileSync(new URL("../到期管家/src/brand_view.tsx", import.meta.url), "utf8")
  const code = source.replace(/^import .* from .*\n/gm, "").replace(/^export /gm, "")
  const events: any[] = []
  let state = defaultState(1)
  let cursor = 0
  const slots: any[] = []
  const bindings = {
    h: (type: any, props: any, ...children: any[]) => ({ type: typeof type === "function" ? type.name : type, props: props ?? {}, children: children.flat(Infinity).filter(value => value != null) }),
    ...Object.fromEntries(["Button", "Image", "Label", "List", "NavigationLink", "Picker", "Section", "Text", "TextField", "VStack", "BrandLogo"].map(name => [name, name])),
    Script: { directory: "/bundle" }, BRAND_CATALOG, BRAND_ASSETS, brandAsset, inspectBrandLogo, brandLogoStatusText,
    itemBrandChoice,
    useState: (initial: any) => {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial
      return [slots[index], (value: any) => { slots[index] = typeof value === "function" ? value(slots[index]) : value }]
    },
    useEffect: () => {},
    loadState: () => structuredClone(state), manualItemsForDisplay: () => [item],
    updateSettings: (patch: any) => {
      events.push(["settings", patch]); if (saveFailure) throw Error("save failed")
      state = { ...state, settings: { ...state.settings, ...patch } }; return state
    },
    updateItemBrandChoice: (target: any, brandID: string | null) => {
      events.push(["choice", target.source, target.id, brandID]); if (saveFailure) throw Error("save failed")
      state = { ...state, settings: { ...state.settings, itemBrandChoices: withItemBrandChoice(state.settings, target, brandID) } }; return state
    },
    reloadWidgetsAfterStorageWrite: async () => { events.push(["refresh"]); if (refreshFailure) throw Error("refresh failed") },
    Dialog: { alert: async (value: any) => events.push(["alert", value.title]) },
  }
  const compiled = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } }).transformSync(code)
  const components = new Function(...Object.keys(bindings), `${compiled}\nreturn { BrandSettingsView, BrandChoiceView, BrandCatalogView }`)(...Object.values(bindings))
  return { events, state: () => state,
    render: (name: string, props: any = {}) => { cursor = 0; return components[name](props) },
    changed: (next: any) => events.push(["changed", next.settings]),
  }
}
const allNodes = (node: any): any[] => [node, ...node.children.filter((child: any) => typeof child === "object").flatMap(allNodes)]
const uiText = (node: any): string => [node.props.title ?? "", ...[node.props.header, node.props.footer, ...node.children].filter(value => value != null).map((child: any) => typeof child === "object" ? uiText(child) : String(child))].join("")
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }

test("actual settings page has no global icon-mode control and browsing never changes any item", () => {
  const env = brandUIHarness()
  const root = env.render("BrandSettingsView", { onChanged: env.changed })
  assert.equal(root.props.navigationTitle, "事项图标")
  assert.equal(allNodes(root).find(node => node.type === "Picker"), undefined)
  assert.ok(uiText(root).includes("左图标完成事项，文字查看详情"))
  assert.ok(uiText(root).includes("系统图标与品牌 Logo 按事项独立任选"))
  assert.ok(!uiText(root).includes("自动 · SafePal"))
  assert.deepEqual(env.events, [])
})

test("actual per-item UI saves the exact source and ID without completing or editing the item", async () => {
  const env = brandUIHarness(true)
  const first = env.render("BrandChoiceView", { item, onChanged: env.changed })
  const picker = allNodes(first).find(node => node.type === "Picker")
  assert.equal(picker.props.pickerStyle, "segmented")
  picker.props.onChanged("brand")
  assert.deepEqual(env.events, [], "browsing the other icon library cannot save a selection")
  const root = env.render("BrandChoiceView", { item, onChanged: env.changed })
  assert.equal(root.type, "BrandCatalogView")
  root.props.onSelect(byName("Telegram").id)
  root.props.onSelect("system") // Same-tick duplicate cannot override the first save.
  await flush()
  assert.deepEqual(env.events[0], ["choice", item.source, item.id, byName("Telegram").id])
  assert.equal(itemBrandChoice(env.state().settings, item), byName("Telegram").id)
  assert.equal(env.state().settings.smallWidgetIconStyle, undefined, "choosing a brand must not create a global-mode setting")
  assert.equal(env.events.filter(event => event[0] === "choice").length, 1)
  assert.deepEqual(env.events.at(-1), ["alert", "设置已保存"])
  const failed = brandUIHarness(false, true)
  const failedView = failed.render("BrandChoiceView", { item, onChanged: failed.changed })
  allNodes(failedView).find(node => node.type === "Button").props.action()
  await flush()
  assert.deepEqual(failed.events.map(event => event[0]), ["choice", "alert"])
  assert.equal(itemBrandChoice(failed.state().settings, item), null)
})

test("both manual and Reminder choices can switch back to system with a matching selected tab", async () => {
  for (const source of ["manual", "reminder"] as const) {
    const env = brandUIHarness()
    const target = { ...item, source }
    const props = { item: target, onChanged: env.changed }
    let view = env.render("BrandChoiceView", props)
    allNodes(view).find(node => node.type === "Picker").props.onChanged("brand")
    view = env.render("BrandChoiceView", props)
    view.props.onSelect(byName("Telegram").id); await flush()
    view = env.render("BrandChoiceView", props)
    assert.equal(view.props.choice, byName("Telegram").id)
    view.props.onSelect("system"); await flush()
    view = env.render("BrandChoiceView", props)
    assert.equal(view.type, "List")
    assert.equal(allNodes(view).find(node => node.type === "Picker").props.value, "system")
    assert.ok(allNodes(view).find(node => node.type === "Button").props.title.startsWith("✓ "))
    assert.equal(itemBrandChoice(env.state().settings, target), "system")
    assert.equal(itemBrandChoice(env.state().settings, { ...target, source: source === "manual" ? "reminder" : "manual" }), null)
    assert.equal(env.events.filter(event => event[0] === "choice").length, 2)
    assert.equal(env.events.filter(event => event[0] === "settings").length, 0)
  }
})

test("catalog search and pagination expose all 36 operators without reading any image during first render", () => {
  const previous = (globalThis as any).FileManager
  let reads = 0
  ;(globalThis as any).FileManager = { readAsData: async () => { reads++; return {} } }
  const rowNames = (root: any): string[] => allNodes(root).filter(node => node.type === "BrandCatalogRow").map(node => node.props.brand.name)
  try {
  const env = brandUIHarness()
  let root = env.render("BrandCatalogView")
  assert.equal(reads, 0)
  assert.equal(rowNames(root).length, 32)
  const field = allNodes(root).find(node => node.type === "TextField")
  field.props.onChanged("运营商")
  root = env.render("BrandCatalogView")
  const names = rowNames(root)
  assert.equal(names.length, 32)
  assert.equal(reads, 0)
  assert.ok(names.includes("中国广电"))
  assert.ok(!names.includes("Netflix"))
  assert.deepEqual(allNodes(root).filter(node => node.type === "Button").map(node => node.props.title), ["下一页"], "browse-only logo rows are static, not dimmed disabled buttons")
  allNodes(root).find(node => node.type === "Button" && node.props.title === "下一页").props.action()
  root = env.render("BrandCatalogView")
  const lastNames = rowNames(root)
  assert.equal(lastNames.length, 4)
  assert.equal(reads, 0)
  assert.equal(new Set([...names, ...lastNames]).size, 36)
  allNodes(root).find(node => node.type === "TextField").props.onChanged("Netflix")
  root = env.render("BrandCatalogView")
  assert.deepEqual(rowNames(root), ["Netflix"], "search resets the page")
  allNodes(root).find(node => node.type === "TextField").props.onChanged("")
  allNodes(root).find(node => node.type === "Picker").props.onChanged("美国银行与信用卡")
  root = env.render("BrandCatalogView")
  assert.ok(rowNames(root).includes("Chime"))
  assert.ok(!rowNames(root).includes("Netflix"))
  assert.equal(reads, 0)
  } finally { (globalThis as any).FileManager = previous }
})
