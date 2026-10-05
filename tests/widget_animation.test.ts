// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { dateKeyToLocalDate, dueStatus } from "../到期管家/src/date.ts"
import { dueIconLabel, normalizeIconOverride } from "../到期管家/src/icons.ts"
import * as localization from "../到期管家/src/widget_localization.ts"
import * as layout from "../到期管家/src/widget_layout.ts"
import type { DisplayDueItem } from "../到期管家/src/types.ts"

type Node = { type: string; props: Record<string, any>; children: any[] }
type Family = "systemSmall" | "systemMedium" | "systemLarge"
const families: Family[] = ["systemSmall", "systemMedium", "systemLarge"]
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
    dueStatus, dueIconLabel, Widget,
    Button: "Button", Divider: "Divider", HStack: "HStack", Image: "Image", Link: "Link", Spacer: "Spacer", Text: "Text", VStack: "VStack",
    Script: { name: "到期管家", createRunURLScheme: (_name: string, params?: Record<string, string>) => "scripting://run/manager?" + new URLSearchParams(params).toString() },
    CompleteDueItemIntent: (params: unknown) => ({ name: "CompleteDueItem", params }),
    console: { error: () => {}, warn: () => {} }, Storage: { get: deny, set: deny }, fetch: deny, setTimeout: deny, setInterval: deny,
  }
  const render = new Function(...Object.keys(bindings), `${transpile(read("src/widget_view.tsx"))}\nreturn DueManagerWidget`)(...Object.values(bindings))
  return {
    render(family: Family, items: DisplayDueItem[], generation = 0, extra: Record<string, unknown> = {}, height = 376): Node {
      Widget.family = family
      Widget.displaySize = { width: family === "systemSmall" ? 170 : 364, height }
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
  for (const family of ["systemMedium", "systemLarge"] as Family[]) {
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
  assert.equal(named(env.render("systemLarge", [next], 1, {}, 320), "large-section-recent").length, 1)
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

test("stale and readonly items retain visual identity but expose no completion intent", () => {
  const env = harness(), stale = item("stale", { stale: true }), readonly = item("readonly", { canComplete: false })
  for (const family of families) {
    const root = env.render(family, family === "systemSmall" ? [stale] : [stale, readonly], 1)
    assert.deepEqual(row(root, stale).props.transition, expectedTransition)
    assertCurrentControls(root, [])
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
