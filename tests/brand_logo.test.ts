// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { BRAND_ASSETS, brandAsset, loadBrandLogo } from "../到期管家/src/brand_assets.ts"
import { BRAND_CATALOG } from "../到期管家/src/brand_catalog.ts"
import { defaultState } from "../到期管家/src/storage.ts"
import { itemBrandChoice, resolveItemBrand, withItemBrandChoice } from "../到期管家/src/brand_preferences.ts"

type Node = { type: string; props: Record<string, any>; children: any[] }
const read = (path: string) => readFileSync(new URL(`../到期管家/${path}`, import.meta.url), "utf8")
const h = (type: string | ((props: any) => Node), props: any, ...children: any[]): Node =>
  typeof type === "function" ? type({ ...props, children }) : {
    type, props: props ?? {}, children: children.flat(Infinity).filter(child => child != null && child !== false),
  }
const primitives = { Image: "Image", Label: "Label", VStack: "VStack", ZStack: "ZStack" }
const compiled = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } })
  .transformSync(read("src/brand_logo.tsx").replace(/^import .*\n/gm, "").replace(/^export /gm, ""))
const { BrandLogo, BrandCompletionLabel } = new Function("h", ...Object.keys(primitives), `${compiled}\nreturn {BrandLogo,BrandCompletionLabel}`)(h, ...Object.values(primitives))
const nodes = (node: Node): Node[] => [node, ...node.children.filter(child => typeof child === "object").flatMap(nodes)]

test("all brand images preserve their complete content square, equal sizing and original colors without circular clipping", async () => {
  const previous = (globalThis as any).UIImage
  const previousFiles = (globalThis as any).FileManager
  ;(globalThis as any).UIImage = { fromData: (data: unknown) => data }
  ;(globalThis as any).FileManager = { readAsData: async (path: string) => ({ path }) }
  try {
    for (const asset of BRAND_ASSETS) {
      const logo = (await loadBrandLogo(asset, "/bundle"))!
      const view = BrandLogo({ logo })
      assert.equal(view.props.clipShape, "rect")
      const generated = asset.light.includes("/brand-")
      const clipSize = logo.size
      assert.deepEqual(view.props.frame, { width: clipSize, height: clipSize })
      assert.equal(view.props.background, undefined)
      const image = view.children[0]
      assert.equal(image.type, "Image")
      assert.equal(logo.contentScale, generated ? 1.2 : 1)
      assert.deepEqual(image.props.frame, { width: logo.size * (generated ? 1.2 : 1), height: logo.size * (generated ? 1.2 : 1) })
      assert.equal(image.props.renderingMode, "original")
      assert.equal(image.props.widgetAccentedRenderingMode, undefined, "widget-only modifiers must not leak into app views")
      assert.equal(BrandLogo({ logo, widget: true }).children[0].props.widgetAccentedRenderingMode, "fullColor")
      assert.equal(image.props.foregroundStyle, undefined)
      assert.ok(clipSize < 40, "the logo must fit inside the existing completion target")
      if (generated) {
        const sourceVisibleSize = 144 * clipSize / image.props.frame.width
        assert.ok(Math.abs(sourceVisibleSize - 120) < 1e-9)
        assert.ok(Math.abs((144 - sourceVisibleSize) / 2 - 12) < 1e-9, "only the added 12 px border may be removed")
      }
    }
  } finally { (globalThis as any).UIImage = previous; (globalThis as any).FileManager = previousFiles }
})

test("Ultra Mobile retains its purple square and all four content corners instead of revealing white circular crescents", () => {
  const brand = BRAND_CATALOG.find(brand => brand.name === "Ultra Mobile")!
  const asset = brandAsset(brand.id)!
  assert.equal(asset.size, 24)
  const logo = { image: { light: {}, dark: {} }, size: asset.size, contentScale: 1.2 }
  const view = BrandCompletionLabel({ logo, title: "完成事项：Ultra Mobile PayGo", hitSize: 40 })
  const mask = nodes(view).find(node => node.props.clipShape === "rect")!
  const image = nodes(mask).find(node => node.type === "Image")!
  assert.deepEqual(mask.props.frame, { width: 24, height: 24 })
  assert.equal(nodes(view).some(node => node.props.clipShape === "circle"), false)
  assert.deepEqual(image.props.frame, { width: 24 * 1.2, height: 24 * 1.2 })
  assert.deepEqual(view.props.frame, { width: 40, height: 40 })
  assert.equal(view.props.contentShape, "rect")
})

test("the visible complete image is inside a rectangular semantic button label", () => {
  const logo = { image: { light: {}, dark: {} }, size: 24, contentScale: 1.2 }
  const view = BrandCompletionLabel({ logo, title: "Complete: 招商银行", hitSize: 40 })
  assert.equal(view.type, "ZStack")
  assert.equal(view.props.contentShape, "rect")
  assert.deepEqual(view.props.frame, { width: 40, height: 40 })
  assert.equal(view.props.clipShape, undefined, "the 40 pt tap region must not be clipped to the logo")
  assert.equal(view.props.foregroundStyle, undefined, "the control label itself must remain visible")
  const semantic = nodes(view).filter(node => node.type === "Label")
  assert.equal(semantic.length, 1)
  assert.equal(semantic[0].props.title, "Complete: 招商银行")
  assert.equal(semantic[0].props.labelStyle, "iconOnly")
  assert.equal(nodes(view).filter(node => node.type === "Image").length, 1)
  assert.ok(!nodes(view).some(node => ["Button", "Link", "NavigationLink"].includes(node.type)))
  assert.ok(!nodes(view).some(node => node.props.background || node.props.intent || node.props.action))
})

test("main app, editor, catalog and widget share the same complete-image rendering path", () => {
  const app = read("src/app.tsx"), widget = read("src/widget_view.tsx")
  const row = app.slice(app.indexOf("function ManualItemRow("), app.indexOf("function ManualItemDetails("))
  const editor = app.slice(app.indexOf("function IconSettingRow("), app.indexOf("function IconPicker("))
  const control = widget.slice(widget.indexOf("function ListCompletionIcon("), widget.indexOf("function ListCompletionSymbol("))
  assert.match(row, /<BrandCompletionLabel logo=\{logo\}/)
  assert.match(editor, /<BrandLogo logo=\{logo\}/)
  assert.match(read("src/brand_view.tsx"), /<BrandLogo logo=\{logo\}/)
  assert.match(control, /<BrandCompletionLabel logo=\{logo\}/)
  assert.doesNotMatch(control, /background=|foregroundStyle="clear"|foregroundStyle=\{logo/)
  assert.doesNotMatch(control, /contentShape="rectangle"/)
})

test("a saved CMB choice works in the app and small widget without enabling a global mode or bypassing read-only protection", () => {
  const cmb = BRAND_CATALOG.find(brand => brand.name === "招商银行／掌上生活")!
  const item = { source: "manual" as const, id: "cmb", title: "招商银行", iconIsExplicit: true, stale: false, canComplete: true }
  const settings = defaultState().settings
  settings.itemBrandChoices = withItemBrandChoice(settings, item, cmb.id)
  const original = structuredClone(settings)
  assert.equal(resolveItemBrand(item, settings)?.id, cmb.id)
  assert.ok(brandAsset(cmb.id))
  assert.equal(resolveItemBrand({ ...item, stale: true }, settings), null)
  assert.equal(resolveItemBrand({ ...item, canComplete: false }, settings), null)
  assert.equal(itemBrandChoice(settings, item), cmb.id)
  assert.deepEqual(settings, original)
})
