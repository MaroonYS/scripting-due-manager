// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import * as dates from "../到期管家/src/date.ts"
import * as icons from "../到期管家/src/icons.ts"
import * as kinds from "../到期管家/src/item_kinds.ts"
import { itemIconID } from "../到期管家/src/icon_preferences.ts"
import { symbolChoice, normalizeItemIconChoices } from "../到期管家/src/icon_preferences.ts"
import { defaultState, updateManualItemIcon, loadState, listLocalSnapshots, STATE_KEY, LOCAL_SNAPSHOTS_KEY } from "../到期管家/src/storage.ts"
import type { ManualDueItem } from "../到期管家/src/types.ts"

const nodes = (node: any): any[] => [node, ...node.children.filter((child: any) => typeof child === "object").flatMap(nodes)]
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

function editorHarness(options: { brand?: string; icon?: string; fail?: boolean; confirm?: boolean } = {}) {
  const source = readFileSync(new URL("../到期管家/src/app.tsx", import.meta.url), "utf8")
  const code = source.slice(source.indexOf("function ItemEditor("), source.indexOf("function ManualItemsSection("))
    + source.slice(source.indexOf("function IconPicker("), source.indexOf("function ReminderCalendarPicker("))
    + readFileSync(new URL("../到期管家/src/system_icon_picker.tsx", import.meta.url), "utf8").replace(/^import .*$/gm, "").replace(/^export /gm, "")
  const item: ManualDueItem = { id: "editor-test", title: "Monthly", kind: "subscription", iconName: null,
    dueDate: "2026-09-30", includesTime: false, hour: 0, minute: 0, remindBeforeDays: 0,
    recurrence: dates.createRecurrenceRule("month", 1, "2026-09-30"), enabled: true, amount: "10", note: "Keep", createdAt: 1, updatedAt: 2 }
  const state = { ...defaultState(2), items: [item] }
  if (options.brand) state.settings.itemBrandChoices = [{ source: "manual", itemID: item.id, brandID: options.brand }]
  if (options.icon) state.settings.itemIconChoices = normalizeItemIconChoices([{ source: "manual", itemID: item.id, iconID: options.icon }])
  const events: any[][] = []
  const slots: Record<string, any[]> = {}
  let active: any[] = [], cursor = 0
  const bindings = {
    ...dates, ...icons, ...kinds, itemIconID, symbolChoice, SystemIconThemes: "SystemIconThemes",
    h: (type: any, props: any, ...children: any[]) => ({ type: typeof type === "function" ? type.name : type, props: props ?? {}, children: children.flat(Infinity).filter(child => child != null) }),
    ...Object.fromEntries(["Button", "DatePicker", "HStack", "Image", "LabeledContent", "List", "NavigationLink", "Picker", "Section", "Spacer", "Text", "TextField", "Toggle", "VStack", "IconSettingRow"].map(name => [name,name])),
    Navigation: { useDismiss: () => () => events.push(["dismiss"]) },
    useState: (initial: any) => {
      const values = active, index = cursor++
      if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial
      return [values[index], (next: any) => { values[index] = typeof next === "function" ? next(values[index]) : next }]
    },
    useEffect: () => undefined,
    recurrenceIntervalUnitLabel: () => "个月",
    loadState: () => structuredClone(state),
    upsertItem: (...args: any[]) => { events.push(["save",...args]); if (options.fail) throw Error("save failed"); return state },
    completeManualItem: (...args: any[]) => { events.push(["complete",...args]); if (options.fail) throw Error("save failed"); return state },
    deleteItem: () => { throw Error("Unexpected delete") },
    refreshAfterDataChange: async () => { events.push(["refresh"]); return null },
    Dialog: { alert: async (info: any) => events.push(["alert",info.title]), confirm: async () => { events.push(["confirm"]); return options.confirm ?? true } },
  }
  const compiled = new Bun.Transpiler({loader:"tsx",tsconfig:{compilerOptions:{jsx:"react",jsxFactory:"h"}}}).transformSync(code)
  const components = new Function(...Object.keys(bindings),`${compiled}\nreturn {ItemEditor,IconPicker,SystemIconPicker}`)(...Object.values(bindings))
  const render = (name: string, props?: any) => {
    active = slots[name] ??= []; cursor = 0
    return components[name](props ?? {item,standalone:true,onChanged:()=>events.push(["changed"])})
  }
  const pickerProps = (root: any) => nodes(root).find(node => node.type === "NavigationLink" && node.props.destination?.type === "IconPicker")!.props.destination.props
  const renderPicker = () => {
    const wrapper = render("IconPicker", pickerProps(render("ItemEditor")))
    assert.equal(wrapper.type, "SystemIconPicker")
    return render("SystemIconPicker", wrapper.props)
  }
  const chooseAndConfirm = async (name: string) => {
    nodes(renderPicker()).find(node => node.type === "SystemIconThemes").props.onChanged(name)
    renderPicker().props.toolbar.confirmationAction.props.action()
    await flush()
  }
  return { render, events, pickerProps, renderPicker, chooseAndConfirm, item }
}

test("the form uses the shared picker and only stages a symbol after explicit confirmation", async () => {
  const env = editorHarness({brand:"brand-retired"})
  const picker = env.renderPicker()
  assert.equal(picker.type, "List")
  assert.ok(!nodes(picker).some(node => node.type === "Picker" || node.type === "BrandCatalogView"))
  assert.equal(nodes(picker).filter(node => node.type === "SystemIconThemes").length, 1)
  nodes(picker).find(node => node.type === "SystemIconThemes").props.onChanged("creditcard.fill")
  assert.deepEqual(env.events, [])
  assert.equal(env.pickerProps(env.render("ItemEditor")).value, null)
  assert.equal(nodes(env.renderPicker()).find(node => node.type === "SystemIconThemes").props.value, "creditcard.fill")
  env.renderPicker().props.toolbar.confirmationAction.props.action()
  await flush()
  assert.deepEqual(env.events, [["dismiss"]])
  const root = env.render("ItemEditor")
  assert.equal(env.pickerProps(root).value, "creditcard.fill")
  assert.equal(env.pickerProps(root).onBrandChanged, undefined)
  root.props.toolbar.confirmationAction.props.action()
  await flush()
  const saved = env.events.find(event => event[0] === "save")!
  assert.equal(saved[1].id, env.item.id)
  assert.equal(saved[1].iconName, "creditcard.fill")
  assert.equal(saved[2], env.item.updatedAt)
  assert.equal(saved.length, 4)
  assert.deepEqual(saved[3], { iconID: null, expectedIconID: null })
  assert.ok(!env.events.some(event => event[0] === "complete"))
})

test("cancelling the icon picker discards its draft without changing the parent form", () => {
  const env = editorHarness()
  nodes(env.renderPicker()).find(node => node.type === "SystemIconThemes").props.onChanged("creditcard.fill")
  env.renderPicker().props.toolbar.cancellationAction.props.action()
  assert.equal(env.pickerProps(env.render("ItemEditor")).value, null)
  assert.deepEqual(env.events, [["dismiss"]])
})

test("cancelling the parent form after confirming a symbol never saves or refreshes widgets", async () => {
  const env = editorHarness()
  await env.chooseAndConfirm("creditcard.fill")
  const root = env.render("ItemEditor")
  root.props.toolbar.cancellationAction.props.action()
  assert.deepEqual(env.events, [["dismiss"], ["dismiss"]])
})


test("failed Save does not dismiss or refresh even with legacy brand data", async () => {
  const env = editorHarness({brand:"brand-retired",fail:true})
  const root = env.render("ItemEditor")
  root.props.toolbar.confirmationAction.props.action()
  await flush()
  assert.equal(env.events[0][0], "save")
  assert.equal(env.events[0][3], undefined)
  assert.deepEqual(env.events.at(-1), ["alert","保存失败"])
  assert.ok(!env.events.some(event => event[0] === "dismiss" || event[0] === "refresh"))
})

test("complete-and-save includes the chosen SF Symbol only after confirmation", async () => {
  for (const confirmed of [false,true]) {
    const env = editorHarness({confirm:confirmed})
    await env.chooseAndConfirm("creditcard.fill")
    const root = env.render("ItemEditor")
    nodes(root).find(node => node.type === "Button" && node.props.title === "完成本期").props.action()
    await flush()
    const completion = env.events.find(event => event[0] === "complete")
    assert.equal(Boolean(completion), confirmed)
    if (completion) {
      assert.equal(completion[1].id, env.item.id)
      assert.equal(completion[1].iconName, "creditcard.fill")
      assert.equal(completion[2], env.item.updatedAt)
      assert.equal(completion[3], false)
      assert.equal(typeof completion[4], "number")
      assert.equal(completion.length, 6)
      assert.deepEqual(completion[5], { iconID: null, expectedIconID: null })
    } else assert.deepEqual(env.events, [["dismiss"], ["confirm"]])
  }
})

test("automatic selection remains a draft until confirmed and clears this form's symbol only", async () => {
  const env = editorHarness({brand:"brand-retired", icon:"sf:creditcard.fill"})
  const picker = env.renderPicker()
  assert.equal(nodes(picker).find(node => node.type === "SystemIconThemes").props.value, "creditcard.fill")
  nodes(picker).find(node => node.type === "Button" && JSON.stringify(node.children).includes("自动匹配")).props.action()
  assert.equal(env.pickerProps(env.render("ItemEditor")).value, "creditcard.fill")
  assert.deepEqual(env.events, [])
  env.renderPicker().props.toolbar.confirmationAction.props.action()
  await flush()
  const root = env.render("ItemEditor")
  assert.equal(env.pickerProps(root).value, null)
  assert.deepEqual(env.events, [["dismiss"]])
})

test("opening a system picker with a retired brand neither switches nor saves anything", () => {
  const env = editorHarness({brand:"brand-retired"})
  const picker = env.renderPicker()
  assert.equal(nodes(picker).find(node => node.type === "SystemIconThemes").props.value, null)
  assert.ok(JSON.stringify(picker).includes("自动匹配"))
  assert.equal(nodes(picker).filter(node => node.type === "Image" && node.props.systemName === "checkmark").length, 1)
  assert.deepEqual(env.events, [])
})

function manualIconStorageEnvironment(withOverride = true) {
  const previous = (globalThis as any).Storage
  const item: ManualDueItem = {
    id: "manual-icon", title: "Monthly", kind: "subscription", iconName: "car.fill",
    dueDate: "2026-09-30", includesTime: true, hour: 9, minute: 30, remindBeforeDays: 3,
    recurrence: dates.createRecurrenceRule("month", 1, "2026-09-30"), enabled: true,
    amount: "25", note: "Keep private note", createdAt: 1, updatedAt: 2,
  }
  const state = { ...defaultState(2), items: [item, { ...item, id: "other-item", iconName: "calendar" }] }
  state.settings.showAmounts = false
  state.settings.itemIconChoices = [
    ...(withOverride ? [{ source: "manual" as const, itemID: item.id, iconID: "sf:creditcard.fill" }] : []),
    { source: "manual", itemID: "other-item", iconID: "sf:wallet.pass.fill" },
    { source: "reminder", itemID: item.id, iconID: "sf:music.note" },
  ]
  const values = new Map<string, any>([[STATE_KEY, structuredClone(state)]]), writes: string[] = [], failures = new Set<string>()
  ;(globalThis as any).Storage = {
    get: (key: string) => structuredClone(values.get(key) ?? null),
    set: (key: string, value: unknown) => {
      if (failures.has(key)) return false
      writes.push(key); values.set(key, structuredClone(value)); return true
    },
    contains: (key: string) => values.has(key), remove: (key: string) => values.delete(key),
  }
  const normalized = loadState()
  values.set(STATE_KEY, structuredClone(normalized))
  return { item, state: normalized, values, writes, failures, cleanup: () => { (globalThis as any).Storage = previous } }
}

test("manual automatic icon clears both legacy icon and preference without touching unrelated data", () => {
  for (const withOverride of [false, true]) {
    const env = manualIconStorageEnvironment(withOverride)
    try {
      const next = updateManualItemIcon(env.item.id, null, env.item.updatedAt, withOverride ? "sf:creditcard.fill" : null)
      assert.deepEqual(next.items[0], { ...env.item, iconName: null, updatedAt: env.item.updatedAt + 1 })
      assert.deepEqual(next.items[1], env.state.items[1])
      assert.deepEqual(next.settings, { ...env.state.settings, itemIconChoices: env.state.settings.itemIconChoices!.filter(choice => choice.source !== "manual" || choice.itemID !== env.item.id) })
      assert.equal(itemIconID(next.settings, "manual", env.item.id), null)
      assert.equal(itemIconID(next.settings, "reminder", env.item.id), "sf:music.note")
      assert.deepEqual(listLocalSnapshots()[0].state, env.state)
      assert.equal(loadState().items[0].iconName, null)
    } finally { env.cleanup() }
  }
})

test("a direct manual symbol edit saves only appearance and preserves the latest unrelated settings and items", () => {
  const env = manualIconStorageEnvironment()
  try {
    const latest = structuredClone(env.state)
    latest.settings.showAmounts = true
    latest.settings.includeReminders = true
    latest.items[1].note = "changed elsewhere"
    latest.items[1].updatedAt++
    env.values.set(STATE_KEY, latest)
    const next = updateManualItemIcon(env.item.id, "building.columns.fill", env.item.updatedAt, "sf:creditcard.fill")
    assert.deepEqual(next.items[0], { ...env.item, iconName: "building.columns.fill", updatedAt: env.item.updatedAt + 1 })
    assert.deepEqual(next.items[1], latest.items[1])
    assert.deepEqual(next.settings, { ...latest.settings, itemIconChoices: latest.settings.itemIconChoices!.slice(1) })
    assert.equal(loadState().items[0].iconName, "building.columns.fill")
  } finally { env.cleanup() }
})

test("stale manual item or override edits never write an icon or discard newer data", () => {
  for (const conflict of ["item", "preference", "deleted"] as const) {
    const env = manualIconStorageEnvironment()
    try {
      const latest = structuredClone(env.state)
      if (conflict === "item") { latest.items[0].note = "new note"; latest.items[0].updatedAt++ }
      if (conflict === "preference") latest.settings.itemIconChoices![0].iconID = "sf:calendar"
      if (conflict === "deleted") latest.items.shift()
      env.values.set(STATE_KEY, latest)
      assert.throws(() => updateManualItemIcon(env.item.id, null, env.item.updatedAt, "sf:creditcard.fill"))
      assert.deepEqual(env.values.get(STATE_KEY), latest)
      assert.deepEqual(env.writes, [])
    } finally { env.cleanup() }
  }
})

test("failed manual icon writes or snapshots and unknown symbols preserve saved business data", () => {
  for (const failKey of [STATE_KEY, LOCAL_SNAPSHOTS_KEY, "unknown-symbol"]) {
    const env = manualIconStorageEnvironment()
    try {
      if (failKey !== "unknown-symbol") env.failures.add(failKey)
      assert.throws(() => updateManualItemIcon(env.item.id, failKey === "unknown-symbol" ? "not.a.real.symbol" : null, env.item.updatedAt, "sf:creditcard.fill"))
      assert.deepEqual(env.values.get(STATE_KEY), env.state)
      assert.equal(itemIconID(loadState().settings, "manual", env.item.id), "sf:creditcard.fill")
      assert.equal(loadState().items[0].iconName, "car.fill")
    } finally { env.cleanup() }
  }
})
