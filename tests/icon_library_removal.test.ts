// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import test from "node:test"
import * as storage from "../到期管家/src/storage.ts"
import { createRecurrenceRule } from "../到期管家/src/date.ts"
import { createBackupJSON, parseBackupJSON, restoreBackupJSON } from "../到期管家/src/recovery.ts"
import { normalizeLegacyIconPreferences } from "../到期管家/src/legacy_icon_preferences.ts"
import type { ManualDueItem } from "../到期管家/src/types.ts"

function setup() {
  const previous = (globalThis as any).Storage
  const item: ManualDueItem = { id: "same-id", title: "Spotify", kind: "subscription", iconName: "creditcard.fill",
    dueDate: "2026-09-30", includesTime: false, hour: 9, minute: 0, remindBeforeDays: 3,
    recurrence: createRecurrenceRule("month", 1, "2026-09-30"), amount: "10", note: "keep", enabled: true, createdAt: 1, updatedAt: 2 }
  const state = { ...storage.defaultState(2), items: [item, { ...item, id: "other", iconName: "car.fill" }] }
  state.settings.smallWidgetIconStyle = "brand"
  state.settings.itemBrandChoices = [
    { source: "manual", itemID: item.id, brandID: "brand-retired" },
    { source: "reminder", itemID: item.id, brandID: "brand-unknown-future" },
  ]
  const values = new Map<string, any>([[storage.STATE_KEY, structuredClone(state)]])
  const failures = new Set<string>(), writes: string[] = []
  ;(globalThis as any).Storage = {
    get: (key: string) => structuredClone(values.get(key) ?? null),
    set: (key: string, value: unknown) => { if (failures.has(key)) return false; writes.push(key); values.set(key, structuredClone(value)); return true },
    contains: (key: string) => values.has(key), remove: (key: string) => values.delete(key),
  }
  return { state, item, values, failures, writes, cleanup: () => { (globalThis as any).Storage = previous } }
}

test("the retired library, loader, catalog and UI are absent from the runtime bundle", () => {
  const root = new URL("../到期管家/", import.meta.url)
  assert.equal(existsSync(new URL("assets/brands", root)), false)
  const entries = readdirSync(new URL("src/", root))
  assert.ok(!entries.some(name => name.startsWith("brand_")))
  for (const name of ["src/app.tsx", "src/widget_view.tsx", "widget.tsx"]) {
    assert.doesNotMatch(readFileSync(new URL(name, root), "utf8"), /BrandLogo|BrandCatalog|BrandSettings|brand_assets|brand_preferences|itemBrandChoices|brandLogo|品牌 Logo/)
  }
})

test("legacy icon metadata remains inert while distinct per-item SF Symbols survive loading", () => {
  const env = setup()
  try {
    const state = storage.loadState()
    assert.deepEqual(state.items, env.state.items)
    assert.deepEqual(state.settings, env.state.settings)
    assert.deepEqual(storage.manualItemsForDisplay(state).map(item => item.iconName), ["creditcard.fill", "car.fill"])
    assert.deepEqual(env.writes, [])
  } finally { env.cleanup() }
})

test("editing one SF Symbol preserves another item and all inactive legacy choices", () => {
  const env = setup()
  try {
    const next = storage.upsertItem({ ...env.item, iconName: "calendar" }, env.item.updatedAt)
    assert.equal(next.items[0].iconName, "calendar")
    assert.deepEqual(next.items[1], env.state.items[1])
    assert.deepEqual(next.settings, env.state.settings)
    assert.deepEqual(storage.listLocalSnapshots()[0].state.settings, env.state.settings)
    assert.equal(storage.listLocalSnapshots()[0].state.items[0].iconName, "creditcard.fill")
  } finally { env.cleanup() }
})

test("legacy fields survive settings saves, completion, undo and backup restore without a catalog", () => {
  const env = setup()
  try {
    storage.updateSettings({ showAmounts: false })
    storage.completeManualItem(env.item, env.item.updatedAt)
    assert.deepEqual(storage.loadState().settings.itemBrandChoices, env.state.settings.itemBrandChoices)
    storage.undoManualCompletion(storage.listCompletionHistory()[0].id)
    const backup = createBackupJSON()
    assert.deepEqual(parseBackupJSON(backup).state.settings.itemBrandChoices, env.state.settings.itemBrandChoices)
    restoreBackupJSON(backup)
    const restored = storage.loadState()
    assert.deepEqual(restored.settings.itemBrandChoices, env.state.settings.itemBrandChoices)
    assert.equal(restored.settings.smallWidgetIconStyle, "brand")
    assert.equal(restored.items[0].dueDate, env.item.dueDate)
    assert.equal(restored.items[0].iconName, env.item.iconName)
    assert.equal(restored.items[0].note, env.item.note)
  } finally { env.cleanup() }
})

test("invalid legacy metadata is still rejected without silently dropping backup data", () => {
  assert.deepEqual(normalizeLegacyIconPreferences({}), { smallWidgetIconStyle: "system", itemBrandChoices: [] })
  const choice = { source: "manual", itemID: "__proto__", brandID: "brand-unknown" }
  assert.deepEqual(normalizeLegacyIconPreferences({ itemBrandChoices: [choice] }).itemBrandChoices, [choice])
  for (const value of [
    { smallWidgetIconStyle: "invalid" }, { itemBrandChoices: [null] },
    { itemBrandChoices: [choice, choice] }, { itemBrandChoices: [{ ...choice, brandID: "../evil" }] },
    { itemBrandChoices: Array(2001).fill(choice) },
  ]) assert.throws(() => normalizeLegacyIconPreferences(value))
  const env = setup()
  try {
    const backup = JSON.parse(createBackupJSON())
    backup.state.settings.itemBrandChoices[0].brandID = "../evil"
    assert.throws(() => restoreBackupJSON(JSON.stringify(backup)))
    assert.deepEqual(env.writes, [])
    assert.deepEqual(env.values.get(storage.STATE_KEY), env.state)
  } finally { env.cleanup() }
})

test("failed or stale saves cannot discard old choices, items or completion history", () => {
  for (const failKey of [storage.STATE_KEY, storage.LOCAL_SNAPSHOTS_KEY]) {
    const env = setup()
    try {
      env.failures.add(failKey)
      assert.throws(() => storage.upsertItem({ ...env.item, iconName: "calendar" }, 2))
      assert.throws(() => storage.completeManualItem(env.item, 2))
      assert.deepEqual(env.values.get(storage.STATE_KEY), env.state)
      env.failures.clear()
      assert.throws(() => storage.upsertItem(env.item, 1))
      assert.deepEqual(env.values.get(storage.STATE_KEY), env.state)
    } finally { env.cleanup() }
  }
})

test("actual system widget buttons preserve 40 pt semantic targets, exact intents and read-only guards", () => {
  const source = readFileSync(new URL("../到期管家/src/widget_view.tsx", import.meta.url), "utf8")
  const code = source.slice(source.indexOf("function ListCompletionIcon("), source.indexOf("function listItemSupportingText("))
  const bindings = {
    h: (type: unknown, props: any, ...children: any[]) => ({ type, props: props ?? {}, children }),
    Button: "Button", Image: "Image", ListCompletionSymbol: "ListCompletionSymbol",
    peekArtwork: () => null, Script: { directory: "/bundle" }, ArtworkCompletionLabel: "ArtworkCompletionLabel",
    widgetCompletionLabel: (item: any) => `完成事项：${item.title}`, widgetRuntimeLocale: () => "zh-Hans",
    CompleteDueItemIntent: (value: any) => value,
  }
  const compiled = new Bun.Transpiler({loader:"tsx",tsconfig:{compilerOptions:{jsx:"react",jsxFactory:"h"}}}).transformSync(code)
  const render = new Function(...Object.keys(bindings), `${compiled}\nreturn ListCompletionIcon`)(...Object.values(bindings))
  for (const source of ["manual", "reminder"]) {
    const item = { source, id: "exact-id", title: "Keep", completionKey: "exact-occurrence", canComplete: true, stale: false, iconName: "creditcard.fill", iconColor: "systemOrange" }
    const button = render({ item, hitSize: 40, symbolSize: 17 })
    assert.equal(button.type, "Button")
    assert.deepEqual(button.props.frame, { width: 40, height: 40 })
    assert.equal(button.props.contentShape, "rect")
    assert.equal(button.props.title, "完成事项：Keep")
    assert.equal(button.props.systemImage, item.iconName)
    assert.deepEqual(button.props.intent, {source, id:item.id, occurrenceKey:item.completionKey})
    for (const patch of [{stale:true}, {canComplete:false}]) assert.notEqual(render({item:{...item,...patch},hitSize:40,symbolSize:17}).type, "Button")
  }
})
