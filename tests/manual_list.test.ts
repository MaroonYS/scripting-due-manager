// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import * as storage from "../到期管家/src/storage.ts"
import * as dates from "../到期管家/src/date.ts"
import { resolveDueIcon } from "../到期管家/src/icons.ts"
import { recurrenceLabel } from "../到期管家/src/presentation.ts"
import { resolveItemBrand, withItemBrandChoice } from "../到期管家/src/brand_preferences.ts"
import { BRAND_CATALOG } from "../到期管家/src/brand_catalog.ts"
import { brandAsset, inspectBrandLogo } from "../到期管家/src/brand_assets.ts"
import type { ManualDueItem } from "../到期管家/src/types.ts"

type Node = { type: string; props: Record<string, any>; children: any[] }
const source = readFileSync(new URL("../到期管家/src/app.tsx", import.meta.url), "utf8")
const h = (type: string | ((props: any) => Node), props: any, ...children: any[]): Node =>
  typeof type === "function" ? type({ ...props, children }) : {
    type, props: props ?? {}, children: children.flat(Infinity).filter(child => child != null && child !== false),
  }
const nodes = (node: Node): Node[] => [node, ...node.children.filter(child => typeof child === "object").flatMap(nodes)]
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
const cmb = BRAND_CATALOG.find(brand => brand.name === "招商银行／掌上生活")!

function harness(options: {
  style?: "system" | "brand"; choice?: string; noImages?: boolean; failKey?: string;
  maintenance?: () => Promise<string | null>; failDisplay?: boolean
} = {}) {
  const previousStorage = (globalThis as any).Storage, previousImage = (globalThis as any).UIImage
  const previousFiles = (globalThis as any).FileManager
  const item: ManualDueItem = { id: "manual-cmb", title: "招商银行", kind: "other", iconName: "calendar.badge.clock",
    dueDate: "2026-09-09", includesTime: false, hour: 0, minute: 0, remindBeforeDays: 0,
    recurrence: dates.createRecurrenceRule("month", 1, "2026-09-09"), enabled: true,
    amount: "100", note: "unchanged", createdAt: 1, updatedAt: 2 }
  const state = { ...storage.defaultState(2), items: [item] }
  state.settings.smallWidgetIconStyle = options.style ?? "brand"
  state.settings.itemBrandChoices = withItemBrandChoice(state.settings, { source: "manual", id: item.id }, options.choice ?? cmb.id)
  const values = new Map<string, unknown>([[storage.STATE_KEY, structuredClone(state)]])
  const events: any[][] = [], slots: any[] = []
  let cursor = 0
  ;(globalThis as any).Storage = {
    get: (key: string) => structuredClone(values.get(key) ?? null),
    set: (key: string, value: unknown) => {
      events.push(["write", key])
      if (key === options.failKey) return false
      values.set(key, structuredClone(value)); return true
    },
    contains: (key: string) => values.has(key), remove: (key: string) => values.delete(key),
  }
  ;(globalThis as any).UIImage = {
    fromData: (data: any) => options.noImages ? null : data,
    fromBase64String: (data: string) => options.noImages ? null : { data },
  }
  const reads: string[] = []
  ;(globalThis as any).FileManager = {
    readAsData: async (path: string) => { reads.push(path); return { path } },
    readAsString: async () => { throw Error("missing fallback") },
  }
  const bindings = {
    h, ...dates, resolveDueIcon, recurrenceLabel, resolveItemBrand, brandAsset,
    ...Object.fromEntries(["Button", "Image", "HStack", "VStack", "NavigationLink", "Section", "Text", "Spacer", "ItemEditor", "BrandCompletionLabel", "BrandLogo"].map(name => [name, name])),
    Script: { directory: "/bundle" },
    manualOccurrenceKey: storage.manualOccurrenceKey, loadState: storage.loadState,
    completeManualOccurrence: (id: string, key: string) => {
      events.push(["complete", id, key]); return storage.completeManualOccurrence(id, key)
    },
    refreshAfterDataChange: async () => { events.push(["refresh"]); return options.maintenance ? options.maintenance() : null },
    Dialog: { alert: async (value: any) => events.push(["alert", value.title, value.message]) },
    useState: (initial: any) => {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial
      return [slots[index], (next: any) => { slots[index] = typeof next === "function" ? next(slots[index]) : next }]
    },
    useEffect: (effect: () => (() => void), deps: unknown[]) => {
      const index = cursor++
      if (!slots[index] || deps.some((value, i) => value !== slots[index].deps[i])) {
        slots[index]?.cleanup?.()
        slots[index] = { deps, cleanup: effect() }
      }
    },
  }
  const hookCode = readFileSync(new URL("../到期管家/src/brand_loading.ts", import.meta.url), "utf8")
    .replace(/^import .* from .*\n/gm, "").replace(/^export /gm, "")
  const hookJS = new Bun.Transpiler({ loader: "ts" }).transformSync(hookCode)
  const useBrandLogo = new Function("useState", "useEffect", "inspectBrandLogo", `${hookJS}\nreturn useBrandLogo`)(bindings.useState, bindings.useEffect, inspectBrandLogo)
  const rowBindings = { ...bindings, useBrandLogo }
  const code = source.slice(source.indexOf("function ManualItemsSection("), source.indexOf("function IconSettingRow("))
  const compiled = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } }).transformSync(code)
  const renderRow = new Function(...Object.keys(rowBindings), `${compiled}\nreturn ManualItemRow`)(...Object.values(rowBindings))
  const onChanged = (next: any) => { events.push(["changed", next]); if (options.failDisplay) throw Error("display failed") }
  return {
    item, values, events, reads, original: structuredClone(state),
    render: (patch: Partial<ManualDueItem> = {}, inactive = false) => {
      cursor = 0
      return renderRow({ item: { ...item, ...patch }, inactive, settings: storage.loadState().settings, onChanged }) as Node
    },
    cleanup: () => {
      for (const slot of slots) slot?.cleanup?.()
      ;(globalThis as any).Storage = previousStorage; (globalThis as any).UIImage = previousImage
      ;(globalThis as any).FileManager = previousFiles
    },
  }
}

test("the main list first displays a usable system icon, then the saved CMB brand in either widget mode", async () => {
  for (const style of ["brand", "system"] as const) {
    const env = harness({ style })
    try {
      let row = env.render()
      assert.equal(nodes(row).some(node => node.type === "BrandCompletionLabel"), false)
      assert.deepEqual(env.reads, [], "first render must not access artwork")
      assert.equal(row.children[0].type, "Button")
      row.props.onAppear(); await flush(); row = env.render()
      const label = nodes(row).find(node => node.type === "BrandCompletionLabel")!
      assert.ok(label)
      assert.ok(label.props.logo.image.light.path.endsWith(brandAsset(cmb.id)!.light))
      assert.equal(label.props.logo.contentScale, 1.2)
      assert.equal(label.props.title, "完成事项：招商银行")
      assert.deepEqual(env.events, [], "rendering the chosen image cannot change settings or items")
    } finally { env.cleanup() }
  }
  for (const title of ["已逾期", "需要处理", "接下来"]) {
    assert.ok(source.includes(`<ManualItemsSection title="${title}" items=`))
  }
  assert.equal((source.match(/<ManualItemsSection[^>]+settings=\{state.settings\}/g) ?? []).length, 3)
})

test("main-list completion and editing are sibling controls, and completing preserves the chosen brand", async () => {
  const env = harness()
  try {
    let row = env.render()
    row.props.onAppear(); await flush(); row = env.render()
    const [button, link] = row.children
    assert.equal(button.type, "Button")
    assert.equal(button.props.buttonStyle, "borderless")
    assert.equal(button.props.contentShape, "rect")
    assert.deepEqual(button.props.frame, { width: 40, height: 40 })
    assert.equal(button.props.background, undefined)
    assert.equal(button.props.foregroundStyle, undefined)
    assert.equal(link.type, "NavigationLink")
    assert.equal(link.props.destination.type, "ItemEditor")
    assert.equal(link.props.destination.props.item.id, env.item.id)
    assert.ok(!nodes(link).some(node => node.type === "Button"), "the completion action must not be nested under the detail link")
    button.props.action()
    await flush()
    const saved = storage.loadState()
    assert.equal(saved.items[0].dueDate, "2026-10-09")
    assert.equal(saved.items[0].note, "unchanged")
    assert.equal(saved.completionHistory?.length, 1)
    assert.deepEqual(saved.settings, env.original.settings)
    assert.deepEqual(env.events.find(event => event[0] === "complete"), ["complete", env.item.id, storage.manualOccurrenceKey(env.item)])
    assert.equal(env.events.filter(event => event[0] === "refresh").length, 1)
  } finally { env.cleanup() }
})

test("rapid main-list taps and replaying an old rendered row cannot complete a second period", async () => {
  let release!: (value: string | null) => void
  const pending = new Promise<string | null>(resolve => { release = resolve })
  const env = harness({ maintenance: () => pending })
  try {
    const oldButton = env.render().children[0]
    oldButton.props.action(); oldButton.props.action()
    assert.equal(env.events.filter(event => event[0] === "complete").length, 1)
    assert.equal(env.render().children[0].props.disabled, true)
    release(null); await flush()
    oldButton.props.action(); await flush()
    assert.equal(storage.loadState().items[0].dueDate, "2026-10-09")
    assert.equal(storage.loadState().completionHistory?.length, 1)
    assert.ok(env.events.some(event => event[0] === "alert" && event[1] === "事项已变化"))
    assert.equal(env.events.filter(event => event[0] === "refresh").length, 1)
  } finally { release(null); env.cleanup() }
})

test("a stale or deleted main-list row cannot overwrite a newer item or create completion history", async () => {
  for (const deleted of [false, true]) {
    const env = harness()
    try {
      const button = env.render().children[0]
      if (deleted) storage.deleteItem(env.item.id, env.item.updatedAt)
      else storage.upsertItem({ ...env.item, title: "Newer title" }, env.item.updatedAt)
      const before = storage.loadState()
      button.props.action(); await flush()
      assert.deepEqual(storage.loadState(), before)
      assert.ok(env.events.some(event => event[0] === "changed"))
      assert.ok(env.events.some(event => event[0] === "alert" && event[1] === "事项已变化"))
      assert.ok(!env.events.some(event => event[0] === "refresh"))
    } finally { env.cleanup() }
  }
})

test("main-list storage and snapshot failures keep both the occurrence and brand preference unchanged", async () => {
  for (const failKey of [storage.STATE_KEY, storage.LOCAL_SNAPSHOTS_KEY]) {
    const env = harness({ failKey })
    try {
      env.render().children[0].props.action(); await flush()
      assert.deepEqual(storage.loadState(), storage.normalizeState(env.original))
      assert.ok(env.events.some(event => event[0] === "alert" && event[1] === "完成失败"))
      assert.ok(!env.events.some(event => event[0] === "changed" || event[0] === "refresh"))
      assert.equal(env.render().children[0].props.disabled, false)
    } finally { env.cleanup() }
  }
})

test("main-list refresh failures after a committed completion report success with a warning", async () => {
  for (const options of [
    { maintenance: async () => "notification warning" },
    { maintenance: async () => { throw Error("refresh failed") } },
    { failDisplay: true },
  ]) {
    const env = harness(options)
    try {
      env.render().children[0].props.action(); await flush()
      assert.equal(storage.loadState().items[0].dueDate, "2026-10-09")
      assert.equal(storage.loadState().completionHistory?.length, 1)
      assert.ok(env.events.some(event => event[0] === "alert" && event[1] === "事项已完成" && event[2].includes("无需再次点击完成")))
      assert.ok(!env.events.some(event => event[0] === "alert" && event[1] === "完成失败"))
    } finally { env.cleanup() }
  }
})

test("system choices and broken images keep a working SF completion button, while inactive rows stay read-only", async () => {
  for (const options of [{ choice: "system" }, { noImages: true }]) {
    const env = harness(options)
    try {
      const row = env.render(), button = row.children[0]
      assert.equal(button.type, "Button")
      assert.equal(button.props.systemImage, "calendar.badge.clock")
      assert.equal(button.props.title, "完成事项：招商银行")
      assert.ok(!nodes(row).some(node => node.type === "BrandCompletionLabel"))
      button.props.action(); await flush()
      assert.equal(storage.loadState().completionHistory?.length, 1)
      assert.ok(!nodes(env.render({}, true)).some(node => node.type === "Button"))
      assert.ok(!nodes(env.render({ enabled: false })).some(node => node.type === "Button"))
    } finally { env.cleanup() }
  }
})
