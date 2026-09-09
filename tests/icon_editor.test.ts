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
import { symbolChoice } from "../到期管家/src/artwork_catalog.ts"
import { defaultState } from "../到期管家/src/storage.ts"
import type { ManualDueItem } from "../到期管家/src/types.ts"

const nodes = (node: any): any[] => [node, ...node.children.filter((child: any) => typeof child === "object").flatMap(nodes)]
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

function editorHarness(options: { brand?: string; icon?: string; fail?: boolean; confirm?: boolean } = {}) {
  const source = readFileSync(new URL("../到期管家/src/app.tsx", import.meta.url), "utf8")
  const code = source.slice(source.indexOf("function ItemEditor("), source.indexOf("function ManualItemsSection("))
    + source.slice(source.indexOf("function IconPicker("), source.indexOf("function IconChoiceRow("))
  const item: ManualDueItem = { id: "editor-test", title: "Monthly", kind: "subscription", iconName: null,
    dueDate: "2026-09-30", includesTime: false, hour: 0, minute: 0, remindBeforeDays: 0,
    recurrence: dates.createRecurrenceRule("month", 1, "2026-09-30"), enabled: true, amount: "10", note: "Keep", createdAt: 1, updatedAt: 2 }
  const state = { ...defaultState(2), items: [item] }
  if (options.brand) state.settings.itemBrandChoices = [{ source: "manual", itemID: item.id, brandID: options.brand }]
  if (options.icon) state.settings.itemIconChoices = [{ source: "manual", itemID: item.id, iconID: options.icon }]
  const events: any[][] = []
  const slots: Record<string, any[]> = {}
  let active: any[] = [], cursor = 0
  const bindings = {
    ...dates, ...icons, ...kinds, itemIconID, symbolChoice, ArtworkBrowser: "ArtworkBrowser",
    h: (type: any, props: any, ...children: any[]) => ({ type: typeof type === "function" ? type.name : type, props: props ?? {}, children: children.flat(Infinity).filter(child => child != null) }),
    ...Object.fromEntries(["Button", "DatePicker", "HStack", "LabeledContent", "List", "NavigationLink", "Picker", "Section", "Text", "TextField", "Toggle", "VStack", "IconSettingRow", "IconChoiceRow"].map(name => [name,name])),
    Navigation: { useDismiss: () => () => events.push(["dismiss"]) },
    useState: (initial: any) => {
      const values = active, index = cursor++
      if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial
      return [values[index], (next: any) => { values[index] = typeof next === "function" ? next(values[index]) : next }]
    },
    recurrenceIntervalUnitLabel: () => "个月",
    loadState: () => structuredClone(state),
    upsertItem: (...args: any[]) => { events.push(["save",...args]); if (options.fail) throw Error("save failed"); return state },
    completeManualItem: (...args: any[]) => { events.push(["complete",...args]); if (options.fail) throw Error("save failed"); return state },
    deleteItem: () => { throw Error("Unexpected delete") },
    refreshAfterDataChange: async () => { events.push(["refresh"]); return null },
    Dialog: { alert: async (info: any) => events.push(["alert",info.title]), confirm: async () => { events.push(["confirm"]); return options.confirm ?? true } },
  }
  const compiled = new Bun.Transpiler({loader:"tsx",tsconfig:{compilerOptions:{jsx:"react",jsxFactory:"h"}}}).transformSync(code)
  const components = new Function(...Object.keys(bindings),`${compiled}\nreturn {ItemEditor,IconPicker}`)(...Object.values(bindings))
  const render = (name: string, props?: any) => {
    active = slots[name] ??= []; cursor = 0
    return components[name](props ?? {item,standalone:true,onChanged:()=>events.push(["changed"])})
  }
  const pickerProps = (root: any) => nodes(root).find(node => node.type === "NavigationLink" && node.props.destination?.type === "IconPicker")!.props.destination.props
  return { render, events, pickerProps, item }
}

test("the icon picker retains every SF Symbol alongside the new color browser and stages choices", async () => {
  const env = editorHarness({brand:"brand-retired"})
  let root = env.render("ItemEditor")
  const picker = env.render("IconPicker", env.pickerProps(root))
  assert.equal(picker.type, "List")
  assert.ok(!nodes(picker).some(node => node.type === "Picker" || node.type === "BrandCatalogView"))
  assert.equal(nodes(picker).filter(node => node.type === "IconChoiceRow").length, icons.DUE_ICON_OPTIONS.length + 1)
  nodes(picker).find(node => node.type === "Button" && node.children.some((child:any) => child.type === "IconChoiceRow" && child.props.name === "creditcard.fill")).props.action()
  assert.deepEqual(env.events, [["dismiss"]])
  root = env.render("ItemEditor")
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

test("cancelling a staged SF Symbol change does not save or refresh widgets", () => {
  const env = editorHarness()
  let root = env.render("ItemEditor")
  env.pickerProps(root).onChanged("creditcard.fill")
  root = env.render("ItemEditor")
  root.props.toolbar.cancellationAction.props.action()
  assert.deepEqual(env.events, [["dismiss"]])
})

test("direct Icons8 MCP picker stages an ID and saves it only with the same manual item", async () => {
  const env = editorHarness(), id = "icons8-mcp:9GC5rqCM5uDh"
  const picker = env.render("IconPicker", env.pickerProps(env.render("ItemEditor")))
  const direct = nodes(picker).find(node => node.type === "NavigationLink" && node.props.destination?.props.startProvider === "icons8mcp")
  assert.equal(direct.props.destination.props.itemTitle, env.item.title)
  direct.props.destination.props.onSelected(id)
  assert.deepEqual(env.events, [])
  const editor = env.render("ItemEditor")
  assert.equal(env.pickerProps(editor).artworkID, id)
  editor.props.toolbar.confirmationAction.props.action(); await flush()
  assert.deepEqual(env.events.find(event => event[0] === "save")[3], { iconID: id, expectedIconID: null })
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
    let root = env.render("ItemEditor")
    env.pickerProps(root).onChanged("creditcard.fill")
    root = env.render("ItemEditor")
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
    } else assert.deepEqual(env.events, [["confirm"]])
  }
})

test("system automatic selection clears only this editor's symbol without writing data", () => {
  const env = editorHarness({brand:"brand-retired"})
  let root = env.render("ItemEditor")
  env.pickerProps(root).onChanged("creditcard.fill")
  root = env.render("ItemEditor")
  const picker = env.render("IconPicker", env.pickerProps(root))
  assert.equal(nodes(picker).find(node => node.type === "IconChoiceRow" && node.props.selected).props.name, "creditcard.fill")
  nodes(picker).find(node => node.type === "Button" && node.children.some((child:any) => child.type === "IconChoiceRow" && child.props.title === "自动匹配系统图标")).props.action()
  root = env.render("ItemEditor")
  assert.equal(env.pickerProps(root).value, null)
  assert.deepEqual(env.events, [["dismiss"]])
})

test("opening a system picker with a retired brand neither switches nor saves anything", () => {
  const env = editorHarness({brand:"brand-retired"})
  const root = env.render("ItemEditor")
  const picker = env.render("IconPicker", env.pickerProps(root))
  const selected = nodes(picker).filter(node => node.type === "IconChoiceRow" && node.props.selected)
  assert.equal(selected.length, 1)
  assert.equal(selected[0].props.title, "自动匹配系统图标")
  assert.deepEqual(env.events, [])
})

test("color choices remain staged until Save and carry the initial compare-and-set key", async () => {
  const env = editorHarness({ icon: "icons8-ka3InxFU3QZa" })
  let root = env.render("ItemEditor")
  const picker = env.render("IconPicker", env.pickerProps(root))
  nodes(picker).find(n => n.type === "NavigationLink").props.destination.props.onSelected("icons8-zQjzFjPpT2Ek")
  assert.deepEqual(env.events, []) // The browser owns its single navigation dismissal.
  root = env.render("ItemEditor")
  assert.equal(env.pickerProps(root).artworkID, "icons8-zQjzFjPpT2Ek")
  root.props.toolbar.confirmationAction.props.action()
  await flush()
  assert.deepEqual(env.events.find(e => e[0] === "save")![3], { iconID: "icons8-zQjzFjPpT2Ek", expectedIconID: "icons8-ka3InxFU3QZa" })
  assert.equal(env.events.filter(e => e[0] === "dismiss").length, 1)
})

test("cancelling or failing a staged color change never refreshes or silently saves", async () => {
  for (const fail of [false, true]) {
    const env = editorHarness({ fail, icon: "icons8-ka3InxFU3QZa" })
    let root = env.render("ItemEditor")
    env.pickerProps(root).onArtworkChanged("icons8-zQjzFjPpT2Ek")
    root = env.render("ItemEditor")
    if (fail) root.props.toolbar.confirmationAction.props.action()
    else root.props.toolbar.cancellationAction.props.action()
    await flush()
    assert.ok(!env.events.some(e => e[0] === "refresh" || e[0] === "complete"))
    if (fail) assert.ok(!env.events.some(e => e[0] === "dismiss"))
    else assert.deepEqual(env.events, [["dismiss"]])
  }
})

test("restored SF choices show the actual symbol while unknown color IDs survive untouched Save", async () => {
  const restored = editorHarness({ icon: "sf:car.fill" })
  const props = restored.pickerProps(restored.render("ItemEditor"))
  assert.equal(props.value, "car.fill"); assert.equal(props.artworkID, null)
  const future = editorHarness({ icon: "icons8-FutureABC" })
  const root = future.render("ItemEditor")
  assert.equal(future.pickerProps(root).artworkID, "icons8-FutureABC")
  root.props.toolbar.confirmationAction.props.action()
  await flush()
  assert.equal(future.events.find(e => e[0] === "save")![3], undefined)
})

test("complete-and-save stages color artwork until confirmation without changing occurrence identity", async () => {
  for (const confirm of [false, true]) {
    const env = editorHarness({ confirm, icon: "icons8-ka3InxFU3QZa" })
    let root = env.render("ItemEditor")
    env.pickerProps(root).onArtworkChanged("icons8-zQjzFjPpT2Ek")
    root = env.render("ItemEditor")
    nodes(root).find(n => n.type === "Button" && n.props.title === "完成本期").props.action()
    await flush()
    const saved = env.events.find(e => e[0] === "complete")
    assert.equal(Boolean(saved), confirm)
    if (saved) {
      assert.equal(saved[1].id, env.item.id)
      assert.equal(saved[2], env.item.updatedAt)
      assert.deepEqual(saved[5], { iconID: "icons8-zQjzFjPpT2Ek", expectedIconID: "icons8-ka3InxFU3QZa" })
    }
  }
})
