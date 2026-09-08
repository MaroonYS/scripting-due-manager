// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import test from "node:test"
import { BRAND_CATALOG } from "../到期管家/src/brand_catalog.ts"
import { BRAND_ASSETS, brandAsset, loadBrandLogo } from "../到期管家/src/brand_assets.ts"
import { inferItemBrand, itemBrandChoice, normalizeBrandPreferences, resolveItemBrand, withItemBrandChoice } from "../到期管家/src/brand_preferences.ts"
import { defaultState, loadState, STATE_KEY, updateItemBrandChoice, updateSettings, listLocalSnapshots } from "../到期管家/src/storage.ts"
import { createBackupJSON, parseBackupJSON } from "../到期管家/src/recovery.ts"
import { widgetCompletionLabel } from "../到期管家/src/widget_localization.ts"
import type { DisplayDueItem } from "../到期管家/src/types.ts"

const item: DisplayDueItem = { source: "manual", id: "same/id", title: "SafePal 月费", kind: "subscription",
  iconName: "creditcard.fill", iconColor: "systemOrange", dueDate: "2026-09-30", dueTimestamp: 1790755200000,
  completionKey: "exact-occurrence", includesTime: false, hour: 0, minute: 0, remindBeforeDays: 0,
  amount: "", note: "", priority: 0, stale: false, canComplete: true }
const byName = (name: string) => BRAND_CATALOG.find(brand => brand.name === name)!
const settings = () => ({ ...defaultState().settings, smallWidgetIconStyle: "brand" as const })

test("catalog contains 332 unique stable choices across all requested sectors, separate from artwork", () => {
  assert.equal(BRAND_CATALOG.length, 332)
  assert.equal(new Set(BRAND_CATALOG.map(brand => brand.id)).size, 332)
  for (const brand of BRAND_CATALOG) {
    assert.ok(brand.name && brand.group)
    assert.match(brand.id, /^brand-[a-f0-9]{16}$/)
  }
  for (const name of ["中国移动", "中国联通", "中国电信", "Spotify", "Netflix", "Bitwarden", "SafePal / Fiat24"]) assert.ok(byName(name))
  assert.ok(BRAND_ASSETS.length > 0 && BRAND_ASSETS.length < BRAND_CATALOG.length)
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

test("automatic matching is conservative, whole-name based and refuses conflicting brands", () => {
  assert.equal(inferItemBrand("SafePal 月费")?.name, "SafePal / Fiat24")
  assert.equal(inferItemBrand("SPOTIFY 续费")?.name, "Spotify")
  assert.equal(inferItemBrand("中国移动话费")?.name, "中国移动")
  for (const title of ["3", "EE", "NOW", "理想", "坦克", "大众", "keep calm", "notspotify", "Spotifyish", "Fiat24", "Spotify / Netflix", "购买电池"]) {
    assert.equal(inferItemBrand(title), null, title)
  }
})

test("system default, manual SF choices, stale and read-only guards take priority", () => {
  assert.equal(resolveItemBrand(item, defaultState().settings), null)
  assert.equal(resolveItemBrand({ ...item, iconIsExplicit: true }, settings()), null)
  assert.equal(resolveItemBrand(item, settings())?.name, "SafePal / Fiat24")
  const selected = { ...settings(), itemBrandChoices: withItemBrandChoice(settings(), item, byName("Spotify").id) }
  assert.equal(resolveItemBrand({ ...item, iconIsExplicit: true }, selected)?.name, "Spotify")
  assert.equal(resolveItemBrand({ ...item, stale: true }, selected), null)
  assert.equal(resolveItemBrand({ ...item, canComplete: false }, selected), null)
  assert.equal(resolveItemBrand(item, { ...selected, smallWidgetIconStyle: "system" }), null)
  for (const brandID of ["system", "brand-future"]) assert.equal(resolveItemBrand(item, {
    ...settings(), itemBrandChoices: withItemBrandChoice(settings(), item, brandID),
  }), null)
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

test("missing, corrupt or unavailable UIImage decoding never hides the fallback symbol", () => {
  const previous = (globalThis as any).UIImage
  const asset = BRAND_ASSETS[0]
  const calls: string[] = []
  try {
    delete (globalThis as any).UIImage
    assert.equal(loadBrandLogo(asset, "/bundle"), null)
    assert.equal(loadBrandLogo(null, "/bundle"), null)
    ;(globalThis as any).UIImage = { fromFile: (path: string) => { calls.push(path); return { path } } }
    const logo = loadBrandLogo(asset, "/bundle")!
    assert.ok(logo.image.light && logo.image.dark)
    assert.equal(logo.size, asset.size)
    assert.ok(calls.every(path => path.startsWith("/bundle/assets/brands/")))
    ;(globalThis as any).UIImage = { fromFile: (path: string) => path.endsWith(asset.dark) ? null : {} }
    assert.equal(loadBrandLogo(asset, "/bundle"), null)
    ;(globalThis as any).UIImage = { fromFile: () => { throw Error("corrupt") } }
    assert.equal(loadBrandLogo(asset, "/bundle"), null)
    assert.equal(brandAsset("brand-future"), null)
  } finally { (globalThis as any).UIImage = previous }
})

test("actual logo button JSX preserves the native completion label, target and exact occurrence intent", () => {
  const source = readFileSync(new URL("../到期管家/src/widget_view.tsx", import.meta.url), "utf8")
  const code = source.slice(source.indexOf("function ListCompletionIcon("), source.indexOf("function listItemSupportingText("))
  const bindings = {
    h: (type: any, props: any, ...children: any[]) => typeof type === "function" ? type(props) : ({ type, props, children }),
    Button: "Button", Image: "Image", widgetCompletionLabel, widgetRuntimeLocale: () => "en-US",
    CompleteDueItemIntent: (value: any) => ({ intent: "complete", ...value }),
  }
  const compiled = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } }).transformSync(code)
  const render = new Function(...Object.keys(bindings), `${compiled}\nreturn ListCompletionIcon`)(...Object.values(bindings))
  const logo = { image: { light: {}, dark: {} }, size: 20 }
  for (const value of [null, logo]) {
    const node = render({ item, hitSize: 40, symbolSize: 17, logo: value })
    assert.equal(node.type, "Button")
    assert.equal(node.props.title, widgetCompletionLabel(item, "en-US"))
    assert.equal(node.props.labelStyle, "iconOnly")
    assert.deepEqual(node.props.frame, { width: 40, height: 40 })
    assert.deepEqual(node.props.intent, { intent: "complete", source: item.source, id: item.id, occurrenceKey: item.completionKey })
    assert.equal(node.props.foregroundStyle, value ? "clear" : item.iconColor)
    assert.equal(node.props.widgetAccentable, !value)
    if (value) {
      assert.equal(node.props.background.content.type, "Image")
      assert.equal(node.props.background.content.props.renderingMode, "original")
      assert.equal(node.props.background.content.props.widgetAccentedRenderingMode, "fullColor")
      assert.equal(node.props.background.content.props.intent, undefined)
    } else assert.equal(node.props.background, undefined)
  }
  for (const patch of [{ stale: true }, { canComplete: false }]) {
    const node = render({ item: { ...item, ...patch }, hitSize: 40, symbolSize: 17, logo })
    assert.equal(node.type, "Image")
    assert.equal(node.props.systemName, item.iconName)
    assert.equal(node.props.foregroundStyle, "tertiaryLabel")
    assert.equal(node.props.intent, undefined)
  }
  assert.equal(source.match(/logo=\{logo\}/g)?.length, 3, "only the small-widget chain forwards a logo")
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
    ...Object.fromEntries(["Button", "Image", "Label", "List", "NavigationLink", "Picker", "Section", "Text", "TextField", "VStack"].map(name => [name, name])),
    Script: { directory: "/bundle" }, BRAND_CATALOG, BRAND_ASSETS, brandAsset, loadBrandLogo,
    inferItemBrand, itemBrandChoice,
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

test("actual settings picker saves only the style, defaults to system and requests a refresh", async () => {
  const env = brandUIHarness()
  const root = env.render("BrandSettingsView", { onChanged: env.changed })
  const picker = allNodes(root).find(node => node.type === "Picker")
  assert.equal(picker.props.value, "system")
  assert.ok(uiText(root).includes("点击主图标仍是“完成事项”"))
  picker.props.onChanged("brand")
  picker.props.onChanged("system") // Same tick: saved first choice is protected by the gate.
  await flush()
  assert.equal(env.events.filter(event => event[0] === "settings").length, 1)
  assert.deepEqual(env.events[0], ["settings", { smallWidgetIconStyle: "brand" }])
  assert.equal(env.state().settings.smallWidgetIconStyle, "brand")
  assert.equal(env.events.at(-1)[0], "refresh")
  assert.ok(!env.events.some(event => event[0] === "choice"))
})

test("actual per-item UI saves the exact source and ID without completing or editing the item", async () => {
  const env = brandUIHarness(true)
  const root = env.render("BrandChoiceView", { item, onChanged: env.changed })
  assert.equal(root.type, "BrandCatalogView")
  root.props.onSelect(byName("Telegram").id)
  await flush()
  assert.deepEqual(env.events[0], ["choice", item.source, item.id, byName("Telegram").id])
  assert.equal(itemBrandChoice(env.state().settings, item), byName("Telegram").id)
  assert.deepEqual(env.events.at(-1), ["alert", "设置已保存"])
  const failed = brandUIHarness(false, true)
  failed.render("BrandChoiceView", { item, onChanged: failed.changed }).props.onSelect("system")
  await flush()
  assert.deepEqual(failed.events.map(event => event[0]), ["choice", "alert"])
  assert.equal(itemBrandChoice(failed.state().settings, item), null)
})

test("catalog search exposes all operator choices and never claims missing logos are packaged", () => {
  const env = brandUIHarness()
  let root = env.render("BrandCatalogView")
  assert.ok(uiText(root).includes("暂无可用素材 · 系统图标回退"))
  const field = allNodes(root).find(node => node.type === "TextField")
  field.props.onChanged("运营商")
  root = env.render("BrandCatalogView")
  const names = allNodes(root).filter(node => node.type === "Text" && BRAND_CATALOG.some(brand => brand.name === uiText(node)))
  assert.equal(names.length, 36)
  assert.ok(uiText(root).includes("中国移动"))
  assert.ok(!uiText(root).includes("Netflix"))
  assert.ok(!allNodes(root).some(node => node.type === "Button"), "browse-only rows are not disabled buttons that dim artwork")
})
