// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { dateKeyToLocalDate, dueStatus, localDateKey } from "../到期管家/src/date.ts"
import { dueIconLabel, normalizeIconOverride } from "../到期管家/src/icons.ts"
import * as localization from "../到期管家/src/widget_localization.ts"
import * as layout from "../到期管家/src/widget_layout.ts"
import type { DisplayDueItem } from "../到期管家/src/types.ts"

type Node = { type: string; props: Record<string, any>; children: any[] }
type Family = layout.HomeWidgetFamily
const families: Family[] = ["systemSmall", "systemMedium", "systemLarge", "systemExtraLargePortrait"]
const read = (path: string) => readFileSync(new URL(`../到期管家/${path}`, import.meta.url), "utf8")
const transpile = (source: string) => new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } })
  .transformSync(source.replace(/^import[\s\S]*?from\s+"[^"]+"\s*\n/gm, "").replace(/^export /gm, ""))
const h = (type: string | ((props: any) => Node), props: any, ...children: any[]): Node => typeof type === "function"
  ? type({ ...props, children })
  : { type, props: props ?? {}, children: children.flat(Infinity).filter(child => child != null && child !== false) }
const nodes = (root: Node): Node[] => [root, ...root.children.filter(child => typeof child === "object").flatMap(nodes)]
const buttons = (root: Node) => nodes(root).filter(node => node.type === "Button")
const identity = (item: DisplayDueItem) => JSON.stringify([item.source, item.id, item.completionKey])
const named = (root: Node, key: string) => nodes(root).filter(node => node.props.key === key)
const row = (root: Node, item: DisplayDueItem) => named(root, identity(item)).find(node => node.type === "VStack")!
const texts = (root: Node) => nodes(root).filter(node => node.type === "Text").flatMap(node => node.children).join(" ")
const deny = () => { throw Error("widget animation rendering must not perform I/O or schedule work") }

function curve(kind: string, duration: number, extra: Record<string, unknown> = {}) {
  const value = { kind, duration, ...extra }
  return Object.defineProperty(value, "delay", { value: (time: number) => curve(kind, duration, { ...extra, delaySeconds: time }) })
}
function transition(description: Record<string, unknown>) {
  return Object.defineProperty(description, "animation", { value: (animation: unknown) => transition({ ...description, curve: animation }) })
}
const Animation = {
  smooth: ({ duration, extraBounce }: any) => curve("smooth", duration, { extraBounce }),
  easeIn: (duration: number) => curve("easeIn", duration),
  easeOut: (duration: number) => curve("easeOut", duration),
}
const Transition = {
  opacity: () => transition({ kind: "opacity" }),
  asymmetric: (insertion: unknown, removal: unknown) => transition({ kind: "asymmetric", insertion, removal }),
  move: () => assert.fail("completion fade must not slide the entire row"),
  scale: () => assert.fail("completion fade must not shrink the icon or its hit region"),
}
const expectedTransition = {
  kind: "asymmetric",
  insertion: { kind: "opacity", curve: { kind: "easeIn", duration: 0.32, delaySeconds: 0.08 } },
  removal: { kind: "opacity", curve: { kind: "easeOut", duration: 0.46 } },
}
const symbolBindings = { h, VStack: "VStack", Image: "Image", Label: "Label", normalizeIconOverride }
const symbols = new Function(...Object.keys(symbolBindings), `${transpile(read("src/due_symbol.tsx"))}\nreturn { DueSymbol, DueSymbolLabel }`)(...Object.values(symbolBindings))

function harness(globals: Record<string, unknown> = { Animation, Transition }) {
  let locale = "zh-CN"
  const Widget = { family: "systemSmall", displaySize: { width: 364, height: 376 } }
  const bindings = {
    h, ...localization, ...layout, ...symbols, ...globals,
    currentWidgetLocale: () => locale,
    dueStatus, localDateKey, dueIconLabel, Widget,
    Button: "Button", Divider: "Divider", HStack: "HStack", Image: "Image", Link: "Link", Spacer: "Spacer", Text: "Text", VStack: "VStack",
    Script: { name: "到期管家", createRunURLScheme: (_name: string, params?: Record<string, string>) => "scripting://run/manager?" + new URLSearchParams(params).toString() },
    CompleteDueItemIntent: (params: unknown) => ({ name: "CompleteDueItem", params }),
    console: { error: () => {}, warn: () => {} }, Storage: { get: deny, set: deny }, fetch: deny, setTimeout: deny, setInterval: deny,
  }
  const render = new Function(...Object.keys(bindings), `${transpile(read("src/widget_view.tsx"))}\nreturn DueManagerWidget`)(...Object.values(bindings))
  return {
    render(family: Family, items: DisplayDueItem[], generation = 0, extra: Record<string, unknown> = {},
      height = family === "systemExtraLargePortrait" ? 628 : 376,
      width = family === "systemSmall" ? 170 : family === "systemExtraLargePortrait" ? 300 : 364): Node {
      Widget.family = family
      Widget.displaySize = { width, height }
      return render({ items, completionGeneration: generation, reminderFetchedAt: null, remindersLive: true, remindersFromCache: false,
        remindersEnabled: true, reminderError: null, interactionError: null, ...extra })
    },
    locale(value: string) { locale = value },
  }
}
function item(id: string, overrides: Partial<DisplayDueItem> = {}): DisplayDueItem {
  const dueDate = overrides.dueDate ?? "2040-10-05"
  return { id, source: "manual", completionKey: `date:${dueDate}`, title: `Item ${id}`, kind: "creditCard", iconName: "creditcard.fill",
    iconColor: "systemOrange", dueDate, includesTime: false, hour: 9, minute: 0,
    dueTimestamp: dateKeyToLocalDate(dueDate, true, 9, 0).getTime(), remindBeforeDays: 0, amount: "", note: "", priority: 4,
    stale: false, canComplete: true, ...overrides }
}
function assertCurrentControls(root: Node, items: DisplayDueItem[]) {
  assert.deepEqual(buttons(root).map(node => node.props.intent.params), items.filter(value => value.canComplete && !value.stale)
    .map(value => ({ source: value.source, id: value.id, occurrenceKey: value.completionKey })))
  assert.equal(nodes(root).filter(node => node.props.key === "completion-active-layer").length, 1)
  for (const button of buttons(root)) {
    const semantic = button.children.find(child => child.type === "Label")!
    assert.ok(semantic)
    assert.deepEqual(semantic.props.frame, { ...button.props.frame, alignment: "center" })
    assert.equal(semantic.props.contentShape, "rect")
    assert.equal(semantic.props.labelStyle, "iconOnly")
  }
}

test("completion uses gentle asymmetric native opacity curves and a single generation-driven layout animation", () => {
  const env = harness(), a = item("a")
  for (const family of families) {
    const root = env.render(family, [a], 12)
    assert.deepEqual(row(root, a).props.transition, expectedTransition, family)
    const active = named(root, "completion-active-layer")[0]
    assert.deepEqual(active.props.animation, { animation: { kind: "smooth", duration: 0.46, extraBounce: 0 }, value: 12 })
    assert.equal(nodes(root).filter(node => node.props.animation != null).length, 1)
    assertCurrentControls(root, [a])
  }
})

test("small widget replaces exact native occurrence roots while leaving only the new completion control", () => {
  const env = harness(), a = item("a"), b = item("b")
  const before = env.render("systemSmall", [a, b], 1), after = env.render("systemSmall", [b], 2)
  assert.notEqual(row(before, a).props.key, row(after, b).props.key)
  assert.deepEqual(row(before, a).props.transition, row(after, b).props.transition)
  assert.equal(named(after, identity(a)).length, 0)
  assert.doesNotMatch(texts(after), /Item a/)
  assertCurrentControls(before, [a]); assertCurrentControls(after, [b])
})

test("medium and large surviving rows retain occurrence identity instead of replacing the whole generation layer", () => {
  const env = harness(), a = item("a"), b = item("b"), c = item("c")
  for (const family of families.filter(value => value !== "systemSmall")) {
    const before = env.render(family, [a, b], 20), after = env.render(family, [b, c], 21)
    assert.equal(row(before, b).props.key, row(after, b).props.key)
    assert.deepEqual(buttons(before).find(node => node.props.key === identity(b))!.props.intent,
      buttons(after).find(node => node.props.key === identity(b))!.props.intent)
    assert.equal(named(after, identity(a)).length, 0)
    assert.deepEqual(row(after, c).props.transition, expectedTransition)
    assertCurrentControls(after, [b, c])
  }
})

test("a recurring item's next occurrence fades as a distinct identity and never retains its old intent", () => {
  const env = harness(), old = item("recurring", { completionKey: "date:2026-10-05" }), next = item("recurring", { completionKey: "date:2026-11-05" })
  for (const family of families) {
    const before = env.render(family, [old], 7), after = env.render(family, [next], 8)
    assert.notEqual(row(before, old).props.key, row(after, next).props.key)
    assert.equal(named(after, identity(old)).length, 0)
    assertCurrentControls(after, [next])
  }
})

test("same ID and occurrence in different sources remain distinct completion identities", () => {
  const env = harness(), manual = item("shared"), reminder = item("shared", { source: "reminder", kind: "reminder" })
  for (const family of families) {
    const before = env.render(family, [manual], 1), after = env.render(family, [reminder], 2)
    assert.notEqual(row(before, manual).props.key, row(after, reminder).props.key)
    assert.equal(named(after, identity(manual)).length, 0)
    assertCurrentControls(after, [reminder])
  }
  const together = env.render("systemMedium", [manual, reminder])
  assertCurrentControls(together, [manual, reminder])
})

test("the last item fades into a keyed noninteractive empty state in all home widget families", () => {
  const env = harness(), a = item("last")
  for (const family of families) {
    const before = env.render(family, [a], 4), after = env.render(family, [], 5)
    assert.deepEqual(row(before, a).props.transition, expectedTransition)
    const empty = named(after, "queue-empty-state")
    assert.equal(empty.length, 1)
    assert.equal(empty[0].type, "Link")
    assert.deepEqual(empty[0].props.transition, expectedTransition)
    assert.match(texts(after), /全部完成/)
    assertCurrentControls(after, [])
    assert.equal(named(after, identity(a)).length, 0)
    if (family !== "systemSmall") {
      const key = family === "systemMedium" ? "medium-item-queue" : "large-item-queue"
      const oldQueue = named(before, key)[0], newQueue = named(after, key)[0]
      assert.equal(oldQueue.type, "VStack"); assert.equal(newQueue.type, "VStack")
      assert.equal(newQueue.children.length, 1)
      assert.equal(newQueue.children[0], empty[0], "empty state must enter the retained queue, not replace its parent")
      assert.equal(newQueue.props.frame.maxHeight, "infinity")
    }
  }
})

test("large disappearing sections have native transitions and stable semantic keys independent of locale", () => {
  const env = harness(), action = item("action", { dueDate: "2000-01-01" }), next = item("next")
  const before = env.render("systemLarge", [action, next], 1), after = env.render("systemLarge", [next], 2)
  const actionSection = named(before, "large-section-action")[0], upcoming = named(before, "large-section-upcoming")[0]
  assert.ok(actionSection); assert.ok(upcoming)
  assert.deepEqual(actionSection.props.transition, expectedTransition)
  assert.equal(named(after, "large-section-action").length, 0)
  assert.equal(named(after, "large-section-upcoming")[0].props.key, upcoming.props.key)
  assertCurrentControls(after, [next])
  env.locale("en-US")
  const english = env.render("systemLarge", [action, next], 1)
  assert.ok(named(english, "large-section-action")[0]); assert.ok(named(english, "large-section-upcoming")[0])
  assert.equal(named(env.render("systemLarge", [next], 1, {}, 320), "large-section-upcoming").length, 1)
  assert.equal(named(env.render("systemLarge", [action, next], 1, {}, 196), "large-section-recent").length, 1)
})

function titleNode(root: Node, item: DisplayDueItem) {
  return nodes(row(root, item)).find(node => node.type === "Text" && node.children.includes(item.title))!
}

test("compact small anchors both footer rows at the bottom and keeps their bands and links independent", () => {
  const env = harness(), locale = "en-GB"
  env.locale(locale)
  const current = item("current", { source: "reminder", title: "Train arrival 到站", note: "Trip list", includesTime: true })
  const previewDate = new Date(new Date().getFullYear(), 9, 6, 13, 25)
  const preview = item("following", { source: "reminder", title: "Next itinerary", includesTime: true,
    dueDate: localDateKey(previewDate), dueTimestamp: previewDate.getTime() })
  const tree = env.render("systemSmall", [current, preview], 4, {}, 141, 141)
  const plan = layout.smallWidgetLayout(141, 141, { hasDetail: true, hasNext: true })
  const occurrence = row(tree, current)
  assert.equal(occurrence.children.length, 2)
  const [headline, footer] = occurrence.children
  const [detail, next] = footer.children
  assert.equal(footer.type, "VStack")
  assert.equal(footer.props.frame.alignment, "bottomLeading")
  assert.equal(footer.props.frame.maxHeight, "infinity")
  assert.equal(footer.props.spacing, plan.footerGap)
  assert.equal(headline.props.frame.height, plan.titleHeight)
  assert.equal(detail.children[0].props.frame.height, plan.detailHeight)
  assert.equal(next.children[0].props.frame.height, plan.previewHeight)
  assert.equal(occurrence.props.spacing, plan.gap)
  assert.ok(occurrence.props.spacing > 0)
  assert.match(texts(detail), /Trip list/)
  assert.ok(texts(detail).includes(localization.formatWidgetItemTime(current, locale)))
  assert.ok(texts(next).includes(localization.formatWidgetDate(preview.dueDate, locale)))
  assert.ok(!texts(next).includes(localization.formatWidgetItemTime(preview, locale)))
  assert.deepEqual(Object.fromEntries(new URL(detail.props.url).searchParams), { action: "reminder-notes", id: current.id })
  assert.deepEqual(Object.fromEntries(new URL(next.props.url).searchParams), { action: "reminder-notes", id: preview.id })
  assertCurrentControls(tree, [current])
  assert.equal(buttons(tree)[0].props.frame.width, 40)
  const negativeEdges = nodes(tree).flatMap(node => Object.values(node.props.padding ?? {}))
    .filter(padding => typeof padding === "number" && padding < 0)
  assert.deepEqual(negativeEdges, [])
})

test("long small title takes a third line first and keeps the current detail and completion target", () => {
  const env = harness(), a = item("long", { title: "换乘行程：" + "西安北站到站下车并从东广场出站".repeat(3), note: "Retain my detail" })
  const b = item("preview", { title: "Optional preview" })
  const tree = env.render("systemSmall", [a, b], 5, {}, 141, 141)
  assert.equal(titleNode(tree, a).props.lineLimit, 3)
  assert.match(texts(tree), /Retain my detail/)
  assert.doesNotMatch(texts(tree), /Optional preview/)
  const footer = row(tree, a).children[1]
  assert.equal(footer.props.frame.alignment, "bottomLeading")
  assert.equal(footer.children.length, 1)
  assert.match(texts(footer), /Retain my detail/)
  assertCurrentControls(tree, [a])
  assert.equal(buttons(tree)[0].props.frame.width, 40)
})

test("small headline aligns its leading completion glyph with the red heading and keeps the title link separate", () => {
  const env = harness(), locale = "en-GB"
  env.locale(locale)
  const current = item("current", { title: "Train arrival", source: "reminder", note: "Trip list", includesTime: true })
  const date = new Date(new Date().getFullYear(), 9, 6)
  const preview = item("following", { source: "reminder", title: "Next itinerary", dueDate: localDateKey(date) })
  for (const [width, height] of [[118, 148], [141, 141], [170, 170]]) {
    const tree = env.render("systemSmall", [current, preview], 4, {}, height, width)
    const plan = layout.smallWidgetLayout(width, height, { hasDetail: true, hasNext: true })
    const inset = { leading: plan.sideInset, trailing: plan.sideInset }
    const content = tree.children[0]
    const [header] = content.children[0].children
    const [headline, footer] = row(tree, current).children
    const headerLink = header.children[0].children.find((n: Node) => n.type === "Link")!
    assert.deepEqual(content.props.padding, { top: plan.verticalInset, bottom: plan.verticalInset })
    assert.deepEqual(header.props.padding, inset)
    assert.deepEqual(footer.props.padding, inset)
    const [headingText, headingDate] = headerLink.children[0].children
    assert.equal(headingText.props.frame.alignment, "leading")
    assert.equal(headingText.props.font, 14)
    assert.deepEqual(headingText.props.foregroundStyle, { light: "#C72A32", dark: "#FF4148" })
    assert.equal(headingDate.props.font, 12)
    assert.equal(headingDate.props.foregroundStyle, "secondaryLabel")
    assert.equal(headingDate.props.layoutPriority, 1)
    assert.deepEqual(headline.props.padding, { leading: plan.headlineInset, trailing: plan.padding })
    const [completion, titleLink] = headline.children
    assert.equal(titleLink.type, "Link")
    assert.deepEqual(Object.fromEntries(new URL(titleLink.props.url).searchParams), { action: "reminder-notes", id: current.id })
    assert.equal(titleLink.children[0], titleNode(tree, current))
    assert.equal(titleLink.children[0].props.frame.alignment, "leading")
    assert.equal(titleLink.children[0].props.multilineTextAlignment, "leading")
    assert.equal(completion.type, "Button")
    assert.deepEqual(completion.props.frame, { width: 40, height: 40 })
    const symbol = completion.children[0].props.background.content
    const glyph = nodes(symbol).find(node => node.type === "Image")!
    assert.deepEqual(glyph.props.frame, { width: plan.symbolSize, height: plan.symbolSize, alignment: "center" })
    const paddedGlyphWidth = glyph.props.padding.leading + plan.symbolSize + glyph.props.padding.trailing
    assert.ok(Math.abs(paddedGlyphWidth - completion.props.frame.width) < 1e-6)
    assert.ok(Math.abs(headline.props.padding.leading + glyph.props.padding.leading - header.props.padding.leading) < 1e-6)
    assert.equal(content.children[0].props.spacing, plan.headerGap)
    assert.equal(footer.props.frame.alignment, "bottomLeading")
    assert.equal(footer.props.spacing, 1)
    const [detailLink, nextLink] = footer.children
    assert.equal(detailLink.children[0].children[0].props.frame.alignment, "leading")
    assert.equal(detailLink.children[0].children.at(-1).props.layoutPriority, 1)
    assert.equal(nextLink.children[0].children[0].type, "VStack", "the preview symbol remains on its leading edge")
    assert.equal(nextLink.children[0].children[1].props.frame.alignment, "leading")
    assert.equal(new URL(nextLink.props.url).searchParams.get("id"), preview.id)
    assertCurrentControls(tree, [current])
  }
})

test("small headline uses the reclaimed left gutter to keep a fitting title and preview", () => {
  const env = harness(), width = 141, height = 141
  const plan = layout.smallWidgetLayout(width, height, { hasDetail: true, hasNext: true })
  const oldTitleWidth = width - 2 * plan.padding - plan.hitSize
  assert.equal(plan.titleWidth, oldTitleWidth + 8)
  const title = Array.from({ length: 30 }, (_, i) => "宽".repeat(i + 1)).find(candidate =>
    !layout.widgetTitleFitsOneLine(candidate, oldTitleWidth * 1.85, 15)
    && layout.widgetTitleFitsOneLine(candidate, plan.titleWidth * 1.85, 15))
  assert.ok(title, "fixture fits two lines only with the reclaimed width")
  const current = item("wrapped", { title, note: "Retain my detail" })
  const next = item("preview", { title: "Optional preview" })
  const tree = env.render("systemSmall", [current, next], 4, {}, height, width)
  assert.equal(titleNode(tree, current).props.lineLimit, 2)
  assert.match(texts(tree), /Retain my detail/)
  assert.match(texts(tree), /Optional preview/)
  assertCurrentControls(tree, [current])
})

test("small shrinks only the main title by one point after applying its available-height cap", () => {
  const env = harness()
  const cases = [
    { title: "缴费", size: 16, lines: 2 },
    { title: "出门以后核对最近所有的停车缴费时间和停车记录", size: 14, lines: 3 },
    { title: "缴费", size: 15, lines: 3, height: 180 },
  ]
  for (const { title, size, lines, height = 141 } of cases) {
    const a = item("title-size", { title, note: "Trip list" })
    const tree = env.render("systemSmall", [a], 4, {}, height, 141)
    const mainTitle = titleNode(tree, a)
    assert.equal(mainTitle.props.font, size)
    assert.equal(mainTitle.props.lineLimit, lines)
    assert.deepEqual(buttons(tree)[0].props.frame, { width: 40, height: 40 })
    assert.equal(buttons(tree)[0].children[0].props.font, 17)
    const footer = row(tree, a).children[1]
    assert.equal(nodes(footer).find(n => n.type === "Text" && n.children.includes("Trip list"))!.props.font, 11)
  }
})

test("the small preview budgets its date from the inset width instead of crowding the title", () => {
  const env = harness(); env.locale("en-GB")
  const current = item("current")
  const next = item("later", { dueDate: "2100-11-07" })
  const previewDate = localization.formatWidgetDate(next.dueDate, "en-GB")
  const width = Array.from({ length: 151 }, (_, i) => i + 90).find(width => {
    const size = layout.smallWidgetLayout(width, 170)
    return layout.widgetTitleFitsOneLine(previewDate, size.contentWidth * 0.39, 10)
      && !layout.widgetTitleFitsOneLine(previewDate, size.auxiliaryContentWidth * 0.39, 10)
  })
  assert.ok(width, "fixture should expose the actual text-width difference")
  const tree = env.render("systemSmall", [current, next], 4, {}, 170, width)
  const [preview] = row(tree, current).children[1].children
  assert.ok(texts(preview).includes(next.title))
  assert.ok(!texts(preview).includes(previewDate))
})

test("small footer uses one band for a lone detail or preview and none when both are absent", () => {
  const env = harness(), current = item("current"), next = item("next")
  const withDetail = { ...current, note: "My detail" }
  for (const [items, text] of [
    [[withDetail], withDetail.note], [[current, next], next.title], [[current], ""],
  ] as const) {
    const tree = env.render("systemSmall", [...items], 1, {}, 170, 170)
    const occurrence = row(tree, current)
    assert.equal(occurrence.children.length, text ? 2 : 1)
    if (text) {
      const footer = occurrence.children[1]
      assert.equal(footer.props.frame.alignment, "bottomLeading")
      assert.equal(footer.children.length, 1)
      assert.equal(footer.children[0].type, "Link")
      assert.ok(texts(footer).includes(text))
    }
    assertCurrentControls(tree, [current])
  }
})

test("agenda keeps a wide title and reflows date and real time below it when the rail is too narrow", () => {
  const env = harness(); env.locale("en-GB")
  const a = item("mix", { title: "Venture One AutoPay — 出站换乘", note: "Optional metadata", includesTime: true })
  for (const family of ["systemMedium", "systemLarge", "systemExtraLargePortrait"] as const) {
    const height = family === "systemMedium" ? 162 : 360
    const compact = env.render(family, [a], 1, {}, height, 154)
    assert.equal(titleNode(compact, a).props.fixedSize, undefined)
    const date = localization.formatWidgetDate(a.dueDate, "en-GB")
    const time = localization.formatWidgetItemTime(a, "en-GB")
    assert.ok(texts(row(compact, a)).includes([date, time].join(" · ")))
    assert.doesNotMatch(texts(row(compact, a)), /Optional metadata/)
    const wide = env.render(family, [a], 1, {}, height, 396)
    const geometry = layout.agendaWidgetLayout(family, 396, height, { itemCount: 1 })
    assert.ok(nodes(row(wide, a)).some(node => node.props.frame?.width === geometry.metadataWidth))
    assert.ok(geometry.titleWidth > geometry.metadataWidth)
    assertCurrentControls(compact, [a]); assertCurrentControls(wide, [a])
  }
})

test("portrait extra large stays in the agenda instead of falling back to a noninteractive accessory count", () => {
  const env = harness(), items = Array.from({ length: 12 }, (_, i) => item(`portrait-${i}`))
  const tree = env.render("systemExtraLargePortrait", items, 8, { reminderError: "offline", remindersLive: false }, 628, 300)
  const plan = layout.agendaWidgetLayout("systemExtraLargePortrait", 300, 628, { itemCount: items.length, hasIssue: true })
  assert.ok(plan.capacity > 5)
  assert.equal(named(tree, "large-item-queue").length, 1)
  assertCurrentControls(tree, items.slice(0, plan.capacity))
  assert.ok(nodes(tree).some(node => node.props.frame?.height === plan.issueHeight))
  assert.match(texts(tree), /点按重试/)
})

test("empty error states retain fade identity without recreating completed item controls", () => {
  const env = harness()
  for (const family of families) {
    const root = env.render(family, [], 8, { reminderError: "access denied", remindersLive: false })
    const empty = named(root, "queue-empty-state")[0]
    assert.equal(empty.type, "Link"); assert.deepEqual(empty.props.transition, expectedTransition)
    assert.match(texts(root), /暂时无法读取/)
    assertCurrentControls(root, [])
  }
})

test("an empty agenda still opens the exact last-action status route when completion reported a warning", () => {
  const env = harness()
  for (const family of families) {
    const root = env.render(family, [], 8, { interactionError: "action warning" })
    const [warning] = named(root, "queue-empty-state")
    assert.equal(new URL(warning.props.url).searchParams.get("action"), "widget-status")
    assertCurrentControls(root, [])
  }
})

test("stale and readonly items retain visual identity but expose no completion intent", () => {
  const env = harness(), stale = item("stale", { stale: true }), readonly = item("readonly", { canComplete: false })
  for (const family of families) {
    const root = env.render(family, family === "systemSmall" ? [stale] : [stale, readonly], 1)
    assert.deepEqual(row(root, stale).props.transition, expectedTransition)
    assertCurrentControls(root, [])
  }
  for (const current of [stale, readonly]) {
    const tree = env.render("systemSmall", [current], 1, {}, 141, 141)
    const [symbol, titleLink] = row(tree, current).children[0].children
    const glyph = nodes(symbol).find(node => node.type === "Image")!
    assert.deepEqual(symbol.props.frame, { width: 40, height: 40, alignment: "center" })
    assert.deepEqual(glyph.props.padding, { leading: 16, trailing: 7 })
    assert.equal(glyph.props.foregroundStyle, "tertiaryLabel")
    assert.equal(titleLink.type, "Link")
    assertCurrentControls(tree, [])
  }
})

test("missing, partial and throwing native motion APIs fall back to the same safe static current-item tree", () => {
  const unsupported = [
    {}, { Animation: undefined, Transition }, { Animation, Transition: undefined },
    { Animation: { smooth: Animation.smooth }, Transition },
    { Animation, Transition: { opacity: Transition.opacity } },
    { Animation: { ...Animation, smooth: deny }, Transition },
    { Animation: { ...Animation, easeIn: deny }, Transition },
    { Animation, Transition: { ...Transition, opacity: deny } },
    { Animation, Transition: { ...Transition, asymmetric: deny } },
  ]
  const a = item("safe")
  for (const globals of unsupported) {
    const env = harness(globals)
    for (const family of families) {
      const root = env.render(family, [a], 3)
      assertCurrentControls(root, [a])
      assert.equal(nodes(root).filter(node => node.props.animation != null || node.props.transition != null).length, 0)
      const after = env.render(family, [], 4)
      assert.equal(named(after, "queue-empty-state").length, 1)
      assertCurrentControls(after, [])
    }
  }
})
