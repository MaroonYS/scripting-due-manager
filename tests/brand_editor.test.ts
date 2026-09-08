// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import * as dates from "../到期管家/src/date.ts"
import * as icons from "../到期管家/src/icons.ts"
import * as kinds from "../到期管家/src/item_kinds.ts"
import { defaultState } from "../到期管家/src/storage.ts"
import { itemBrandChoice, withItemBrandChoice } from "../到期管家/src/brand_preferences.ts"
import { BRAND_CATALOG } from "../到期管家/src/brand_catalog.ts"
import type { ManualDueItem } from "../到期管家/src/types.ts"

const nodes = (node: any): any[] => [node, ...node.children.filter((child: any) => typeof child === "object").flatMap(nodes)]
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
const spotify = BRAND_CATALOG.find(brand => brand.name === "Spotify")!.id

function editorHarness(options: { brand?: string; fail?: boolean; confirm?: boolean } = {}) {
  const source = readFileSync(new URL("../到期管家/index.tsx", import.meta.url), "utf8")
  const code = source.slice(source.indexOf("function ItemEditor("), source.indexOf("function ManualItemsSection("))
    + source.slice(source.indexOf("function IconPicker("), source.indexOf("function IconChoiceRow("))
  const item: ManualDueItem = { id: "editor-test", title: "Monthly", kind: "subscription", iconName: null,
    dueDate: "2026-09-30", includesTime: false, hour: 0, minute: 0, remindBeforeDays: 0,
    recurrence: dates.createRecurrenceRule("month", 1, "2026-09-30"), enabled: true, amount: "10", note: "Keep", createdAt: 1, updatedAt: 2 }
  const state = { ...defaultState(2), items: [item] }
  if (options.brand) state.settings.itemBrandChoices = withItemBrandChoice(state.settings, {source:"manual",id:item.id},options.brand)
  const events: any[][] = []
  const slots: Record<string, any[]> = {}
  let active: any[] = [], cursor = 0
  const bindings = {
    ...dates, ...icons, ...kinds, itemBrandChoice,
    h: (type: any, props: any, ...children: any[]) => ({ type: typeof type === "function" ? type.name : type, props: props ?? {}, children: children.flat(Infinity).filter(child => child != null) }),
    ...Object.fromEntries(["Button", "DatePicker", "HStack", "LabeledContent", "List", "NavigationLink", "Picker", "Section", "Text", "TextField", "Toggle", "VStack", "IconSettingRow", "IconChoiceRow", "BrandCatalogView"].map(name => [name,name])),
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

test("the original icon picker exposes a brand tab and stages the choice until Save", async () => {
  const env = editorHarness()
  let root = env.render("ItemEditor")
  const props = env.pickerProps(root)
  let picker = env.render("IconPicker",props)
  nodes(picker).find(node => node.type === "Picker" && node.props.title === "图标类别").props.onChanged("brand")
  picker = env.render("IconPicker",props)
  assert.equal(picker.type,"BrandCatalogView")
  assert.ok(picker.props.selectionHint.includes("保存事项时才生效"))
  picker.props.onSelect(spotify)
  assert.deepEqual(env.events,[ ["dismiss"] ],"selection only leaves the picker")
  root = env.render("ItemEditor")
  assert.equal(env.pickerProps(root).brandChoice,spotify)
  root.props.toolbar.confirmationAction.props.action()
  await flush()
  const saved = env.events.find(event => event[0] === "save")!
  assert.equal(saved[1].id,env.item.id)
  assert.equal(saved[2],env.item.updatedAt)
  assert.deepEqual(saved[3],{brandID:spotify,enableBrandMode:true})
  assert.ok(!env.events.some(event => event[0] === "complete"))
})

test("closing an editor with a staged brand leaves storage and widgets untouched", () => {
  const env = editorHarness()
  let root = env.render("ItemEditor")
  env.pickerProps(root).onBrandChanged(spotify)
  root = env.render("ItemEditor")
  root.props.toolbar.cancellationAction.props.action()
  assert.deepEqual(env.events,[ ["dismiss"] ])
})

test("untouched brand preferences are not rewritten and failed Save does not dismiss", async () => {
  const env = editorHarness({brand:spotify,fail:true})
  const root = env.render("ItemEditor")
  root.props.toolbar.confirmationAction.props.action()
  await flush()
  assert.equal(env.events[0][0],"save")
  assert.equal(env.events[0][3],undefined)
  assert.deepEqual(env.events.at(-1),["alert","保存失败"])
  assert.ok(!env.events.some(event => event[0] === "dismiss" || event[0] === "refresh"))
})

test("complete-and-save forwards the staged preference only after confirmation", async () => {
  for (const confirmed of [false,true]) {
    const env = editorHarness({confirm:confirmed})
    let root = env.render("ItemEditor")
    env.pickerProps(root).onBrandChanged(spotify)
    root = env.render("ItemEditor")
    nodes(root).find(node => node.type === "Button" && node.props.title === "完成本期").props.action()
    await flush()
    const completion = env.events.find(event => event[0] === "complete")
    assert.equal(Boolean(completion),confirmed)
    if(completion) {
      assert.equal(completion[1].id,env.item.id)
      assert.equal(completion[2],env.item.updatedAt)
      assert.equal(completion[3],false)
      assert.equal(typeof completion[4],"number")
      assert.deepEqual(completion[5],{brandID:spotify,enableBrandMode:true})
    } else assert.deepEqual(env.events,[ ["confirm"] ])
  }
})

test("choosing a system symbol explicitly clears brand priority for that item", () => {
  const env = editorHarness({brand:spotify})
  let root = env.render("ItemEditor")
  const props = env.pickerProps(root)
  let picker = env.render("IconPicker",props)
  picker.props.topContent.props.onChanged("system")
  picker = env.render("IconPicker",props)
  nodes(picker).find(node => node.type === "Button" && node.children.some((child:any)=>child.type === "IconChoiceRow" && child.props.name === "creditcard.fill")).props.action()
  root = env.render("ItemEditor")
  assert.equal(env.pickerProps(root).brandChoice,"system")
  assert.equal(env.pickerProps(root).value,"creditcard.fill")
  assert.deepEqual(env.events,[ ["dismiss"] ])
})
