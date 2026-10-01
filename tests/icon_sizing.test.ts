// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { DUE_ICON_OPTIONS, normalizeIconOverride } from "../到期管家/src/icons.ts"

type Node = { type: string; props: Record<string, any>; children: any[] }
const source = readFileSync(new URL("../到期管家/src/due_symbol.tsx", import.meta.url), "utf8")
const h = (type: string | ((props: any) => Node), props: any, ...children: any[]): Node => typeof type === "function"
  ? type({ ...props, children })
  : ({ type, props: props ?? {}, children: children.flat(Infinity).filter(child => child != null && child !== false) })
const deny = () => { throw Error("native symbol rendering must not perform I/O") }
const unavailable = new Proxy(deny, { get: deny, apply: deny, construct: deny })
const bindings = { h, Image: "Image", Label: "Label", VStack: "VStack", normalizeIconOverride,
  Storage: unavailable, FileManager: unavailable, UIImage: unavailable, fetch: deny, setTimeout: deny, setInterval: deny }
const compiled = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } })
  .transformSync(source.replace(/^import .*$/gm, "").replace(/^export /gm, ""))
const { DueSymbol, DueSymbolLabel, dueSymbolGeometry } = new Function(...Object.keys(bindings), `${compiled}\nreturn { DueSymbol, DueSymbolLabel, dueSymbolGeometry }`)(...Object.values(bindings))
const nodes = (node: Node): Node[] => [node, ...node.children.filter(child => typeof child === "object").flatMap(nodes)]
const image = (node: Node): Node => {
  const images = nodes(node).filter(value => value.type === "Image")
  assert.equal(images.length, 1, "one native glyph, not a duplicate decoration")
  return images[0]
}
const geometry = (node: Node) => ({ slot: node.props.frame, spacing: node.props.spacing,
  glyph: image(node).props.frame, font: image(node).props.font, fontWeight: image(node).props.fontWeight,
  resizable: image(node).props.resizable, scaleToFit: image(node).props.scaleToFit })

const profiles = [
  { label: "item preview", size: 36, slotSize: 48 },
  { label: "category and recommendation grid", size: 24, slotSize: 32 },
  { label: "icon library and automatic rows", size: 20, slotSize: 26 },
  { label: "manual completion", size: 20, slotSize: 40 },
  { label: "small and medium completion", size: 17, slotSize: 40, widget: true },
  { label: "medium compact row", size: 17, slotSize: 38, widget: true },
  { label: "large completion", size: 18, slotSize: 40, widget: true },
  { label: "height constrained widget row", size: 17, slotSize: 36, widget: true },
  { label: "widget summary", size: 26, slotSize: 40, widget: true },
  { label: "widget next item", size: 11, slotSize: 12, widget: true },
] as const

test("all 216 catalog glyphs use precise two-axis drawing bounds and full centered layout slots", () => {
  assert.equal(DUE_ICON_OPTIONS.length, 216)
  const covered = new Set<string>()
  for (const icon of DUE_ICON_OPTIONS) for (const profile of profiles) {
    const root = DueSymbol({ name: icon.name, color: icon.color, ...profile }) as Node
    assert.equal(root.type, "VStack", `${icon.name}: ${profile.label}`)
    assert.equal(root.props.alignment, "center")
    assert.equal(root.props.spacing, 0)
    assert.deepEqual(root.props.frame, { width: profile.slotSize, height: profile.slotSize, alignment: "center" })
    const glyph = image(root)
    assert.equal(glyph.props.systemName, icon.name)
    assert.equal(glyph.props.foregroundStyle, icon.color)
    assert.equal(glyph.props.font, profile.size)
    assert.equal(glyph.props.fontWeight, "regular")
    assert.equal(glyph.props.resizable, true)
    assert.equal(glyph.props.scaleToFit, true)
    assert.equal(glyph.props.scaledToFit, undefined, "scaleToFit is the verified Scripting API")
    assert.deepEqual(glyph.props.frame, { width: profile.size, height: profile.size, alignment: "center" })
    assert.ok(profile.size <= profile.slotSize, "drawing bounds must not consume the whole tap/layout target")
    covered.add(icon.name)
  }
  assert.equal(covered.size, 216)
})

test("wide cards, tall credentials, circles and aircraft share the same aspect-fit geometry", () => {
  const names = ["creditcard.fill", "person.text.rectangle.fill", "lanyardcard.fill", "bed.double.circle.fill", "airplane.departure", "key.horizontal.fill"]
  const expected = geometry(DueSymbol({ name: names[0], color: "systemBlue", size: 24, slotSize: 32 }))
  for (const name of names) {
    assert.equal(normalizeIconOverride(name), name)
    const root = DueSymbol({ name, color: "systemBlue", size: 24, slotSize: 32 })
    assert.deepEqual(geometry(root), expected, name)
    assert.equal(image(root).props.systemName, name)
  }
})

test("active and muted native symbols change color without changing the drawing path or dimensions", () => {
  for (const icon of DUE_ICON_OPTIONS) {
    const active = DueSymbol({ name: icon.name, color: icon.color, size: 20, slotSize: 40 })
    const muted = DueSymbol({ name: icon.name, color: "tertiaryLabel", size: 20, slotSize: 40 })
    assert.deepEqual(geometry(active), geometry(muted), icon.name)
    assert.equal(image(active).props.systemName, image(muted).props.systemName)
    assert.equal(image(muted).props.foregroundStyle, "tertiaryLabel")
  }
})

test("widget replacement and accent flags never change glyph bounds or layout slots", () => {
  for (const widget of [false, true]) for (const replace of [false, true]) {
    const root = DueSymbol({ name: "creditcard.fill", color: "systemOrange", size: 17, slotSize: 40, widget, replace })
    assert.deepEqual(geometry(root), geometry(DueSymbol({ name: "creditcard.fill", color: "systemOrange", size: 17, slotSize: 40 })))
    assert.equal(image(root).props.widgetAccentable, widget ? true : undefined)
    assert.equal(image(root).props.contentTransition, replace ? "symbolEffectReplace" : undefined)
  }
})

test("unknown, unavailable and empty symbols render a safe nonempty fallback with the requested geometry", () => {
  for (const name of [undefined, null, "", "passport", "sf:creditcard.fill", "unknown.future.symbol", "https://example.com/icon.png"]) {
    const root = DueSymbol({ name, color: "systemOrange", size: 20, slotSize: 26 })
    assert.equal(image(root).props.systemName, "calendar.badge.clock")
    assert.deepEqual(root.props.frame, { width: 26, height: 26, alignment: "center" })
    assert.deepEqual(image(root).props.frame, { width: 20, height: 20, alignment: "center" })
  }
})

test("a renderer without an explicit slot defaults to its complete drawing size and never performs I/O", () => {
  for (const icon of DUE_ICON_OPTIONS) {
    const root = DueSymbol({ name: icon.name, color: icon.color, size: 20 })
    assert.deepEqual(root.props.frame, { width: 20, height: 20, alignment: "center" })
    assert.equal(image(root).props.systemName, icon.name)
  }
  const executable = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")
  assert.doesNotMatch(executable, /\b(?:Storage|FileManager|UIImage|fetch|setTimeout|setInterval)\b/)
})

test("drawing and slot geometry clamp invalid inputs without shrinking the slot below the glyph", () => {
  for (const [size, slotSize, expected] of [
    [Number.NaN, undefined, { size: 20, slotSize: 20 }],
    [Number.POSITIVE_INFINITY, 64, { size: 20, slotSize: 64 }],
    [Number.NEGATIVE_INFINITY, Number.NaN, { size: 20, slotSize: 20 }],
    [undefined, undefined, { size: 20, slotSize: 20 }],
    [null, null, { size: 20, slotSize: 20 }],
    ["24", "32", { size: 20, slotSize: 20 }],
    [-10, -10, { size: 8, slotSize: 8 }],
    [0, 0, { size: 8, slotSize: 8 }],
    [4, 6, { size: 8, slotSize: 8 }],
    [8, 8, { size: 8, slotSize: 8 }],
    [8, 10, { size: 8, slotSize: 10 }],
    [17.5, 38, { size: 17.5, slotSize: 38 }],
    [20, 8, { size: 20, slotSize: 20 }],
    [20, Number.POSITIVE_INFINITY, { size: 20, slotSize: 20 }],
    [20, Number.NEGATIVE_INFINITY, { size: 20, slotSize: 20 }],
    [20, 64, { size: 20, slotSize: 64 }],
    [20, 65, { size: 20, slotSize: 64 }],
    [48, 40, { size: 48, slotSize: 48 }],
    [49, 80, { size: 48, slotSize: 64 }],
    [1e9, -1e9, { size: 48, slotSize: 48 }],
  ] as const) {
    assert.deepEqual(dueSymbolGeometry(size, slotSize), expected)
    const root = DueSymbol({ name: "creditcard.fill", color: "systemOrange", size, slotSize })
    assert.deepEqual(image(root).props.frame, { width: expected.size, height: expected.size, alignment: "center" })
    assert.deepEqual(root.props.frame, { width: expected.slotSize, height: expected.slotSize, alignment: "center" })
    assert.ok(expected.size >= 8 && expected.size <= 48)
    assert.ok(expected.slotSize >= expected.size && expected.slotSize <= 64)
  }
})

test("all 216 semantic native labels retain their exact title and symbol with the real aspect-fit background", () => {
  for (const icon of DUE_ICON_OPTIONS) for (const profile of profiles) {
    const title = `完成事项：${icon.label} · full item title`, props = { title, name: icon.name, color: icon.color, ...profile }
    const label = DueSymbolLabel(props) as Node
    assert.equal(label.type, "Label")
    assert.equal(label.props.title, title, "the native action title is not abbreviated or discarded")
    assert.equal(label.props.systemImage, icon.name, "the native semantic glyph is retained")
    assert.equal(label.props.labelStyle, "iconOnly")
    assert.equal(label.props.font, profile.size)
    assert.equal(label.props.foregroundStyle, "clear", "only the original glyph drawing is replaced")
    assert.equal(label.props.contentShape, "rect")
    assert.deepEqual(label.props.frame, { width: profile.slotSize, height: profile.slotSize, alignment: "center" })
    assert.notEqual(label.props.hidden, true)
    assert.notEqual(label.props.accessibilityHidden, true)
    assert.notEqual(label.props.opacity, 0)
    assert.equal(label.props.background.alignment, "center")
    const background = label.props.background.content as Node
    assert.equal(background.type, "VStack", "the real DueSymbol background is expanded, not a mock component")
    assert.deepEqual(geometry(background), geometry(DueSymbol(props)))
    assert.equal(image(background).props.systemName, icon.name)
    assert.equal(image(background).props.foregroundStyle, icon.color)
    assert.notEqual(background.props.opacity, 0)
    assert.notEqual(image(background).props.opacity, 0)
    assert.equal(label.props.widgetAccentable, "widget" in profile && profile.widget ? true : undefined)
  }
})

test("native label backgrounds share safe fallback and bounded geometry for malformed dimensions", () => {
  for (const name of [undefined, null, "", "unknown.future.symbol"]) for (const [size, slotSize] of [[Number.NaN, 65], [-10, -20], [100, 8], [20, Number.POSITIVE_INFINITY]]) {
    const label = DueSymbolLabel({ title: "Complete: unchanged title", name, color: "systemBlue", size, slotSize, widget: true, replace: true }) as Node
    const expected = dueSymbolGeometry(size, slotSize), background = label.props.background.content as Node
    assert.equal(label.props.title, "Complete: unchanged title")
    assert.equal(label.props.systemImage, "calendar.badge.clock")
    assert.equal(image(background).props.systemName, "calendar.badge.clock")
    assert.deepEqual(label.props.frame, { width: expected.slotSize, height: expected.slotSize, alignment: "center" })
    assert.deepEqual(background.props.frame, label.props.frame)
    assert.equal(image(background).props.contentTransition, "symbolEffectReplace")
    assert.equal(image(background).props.widgetAccentable, true)
    assert.ok(expected.size >= 8 && expected.size <= 48)
    assert.ok(expected.slotSize >= expected.size && expected.slotSize <= 64)
  }
})
