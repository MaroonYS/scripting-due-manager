// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import * as icons from "../到期管家/src/icons.ts"
import { itemIconID, symbolChoice } from "../到期管家/src/icon_preferences.ts"
import { defaultState } from "../到期管家/src/storage.ts"

const read = (file: string) => readFileSync(new URL(`../到期管家/src/${file}`, import.meta.url), "utf8")
const h = (type: any, props: any, ...children: any[]) => ({ type: typeof type === "function" ? type.name : type,
  props: props ?? {}, children: children.flat(Infinity).filter(child => child != null && child !== false) })
const nodes = (node: any): any[] => [node, ...node.children.filter((child: any) => typeof child === "object").flatMap(nodes)]
const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve() }
const primitives = Object.fromEntries(["Button", "DisclosureGroup", "HStack", "Image", "Section", "Spacer", "Text", "TextField", "List", "VStack", "NavigationLink", "SystemIconThemes"].map(name => [name, name]))
function harness(file: string, name: string, extra: Record<string, any> = {}) {
  const slots: any[] = []
  let cursor = 0
  const bindings = { h, ...primitives, ...icons, itemIconID, symbolChoice, ...extra,
    useState: (initial: any) => {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial
      return [slots[index], (next: any) => { slots[index] = typeof next === "function" ? next(slots[index]) : next }]
    },
  }
  const source = read(file).replace(/^import .*$/gm, "").replace(/^export /gm, "")
  const compiled = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } }).transformSync(source)
  const component = new Function(...Object.keys(bindings), `${compiled}\nreturn ${name}`)(...Object.values(bindings))
  return (props: any) => { cursor = 0; return component(props) }
}

test("first opening the symbol picker shows eleven collapsed themes without constructing 182 rows", () => {
  const render = harness("system_icon_themes.tsx", "SystemIconThemes")
  const root = render({ value: null, onChanged: () => assert.fail("unexpected selection") })
  const groups = nodes(root).filter(node => node.type === "DisclosureGroup")
  assert.equal(groups.length, icons.DUE_ICON_GROUPS.length)
  assert.ok(groups.every(group => group.props.isExpanded === false && group.children.length === 0))
  assert.equal(nodes(root).filter(node => node.type === "Button").length, 1)
  assert.ok(nodes(root).some(node => node.type === "TextField" && node.props.title === "搜索系统图标"))
})

test("themes independently expand, search reveals relevant rows, and clearing restores expansion", () => {
  const events: string[] = [], render = harness("system_icon_themes.tsx", "SystemIconThemes")
  const props = { value: "wallet.pass.fill", onChanged: (name: string) => events.push(name) }
  let root = render(props)
  nodes(root).find(node => node.type === "DisclosureGroup" && node.props.title.startsWith("财务")).props.onChanged(true)
  root = render(props)
  assert.equal(nodes(root).filter(node => node.type === "DisclosureGroup" && node.props.isExpanded).length, 1)
  const wallet = nodes(root).find(node => node.type === "Button" && node.props.key === "wallet.pass.fill")
  assert.ok(nodes(wallet).some(node => node.type === "Image" && node.props.systemName === "checkmark"))
  wallet.props.action(); assert.deepEqual(events, ["wallet.pass.fill"])
  nodes(root).find(node => node.type === "TextField").props.onChanged("music")
  root = render(props)
  assert.deepEqual(nodes(root).filter(node => node.type === "Button").map(node => node.props.key), icons.searchSystemIcons("music").map(icon => icon.name))
  assert.ok(nodes(root).filter(node => node.type === "DisclosureGroup").every(node => node.props.isExpanded))
  nodes(root).find(node => node.type === "TextField").props.onChanged("")
  root = render(props)
  assert.equal(nodes(root).filter(node => node.type === "DisclosureGroup" && node.props.isExpanded).length, 1)
  nodes(root).find(node => node.type === "Button" && node.props.title === "展开全部主题").props.action()
  root = render(props)
  assert.equal(nodes(root).filter(node => node.type === "Button" && node.props.key).length, 182)
  nodes(root).find(node => node.type === "Button" && node.props.title === "收起全部主题").props.action()
  assert.equal(nodes(render(props)).filter(node => node.type === "Button" && node.props.key).length, 0)
})

test("empty searches are explicit and never trigger a selection", () => {
  const render = harness("system_icon_themes.tsx", "SystemIconThemes"), props = { value: null, onChanged: () => assert.fail("unexpected selection") }
  nodes(render(props)).find(node => node.type === "TextField").props.onChanged("unknown-847291")
  const root = render(props)
  assert.equal(nodes(root).filter(node => node.type === "DisclosureGroup").length, 0)
  assert.ok(JSON.stringify(root).includes("没有匹配的系统图标"))
})

function reminderEditor(fail = false) {
  const state = defaultState(), events: any[] = []
  state.settings.itemIconChoices = [{ source: "reminder", itemID: "reminder-id", iconID: "sf:creditcard.fill" }]
  const render = harness("icon_library_view.tsx", "ReminderIconEditor", {
    loadState: () => structuredClone(state), Navigation: { useDismiss: () => () => events.push("dismiss") },
    updateItemIconChoice: (source: string, id: string, edit: any) => { events.push([source, id, edit]); if (fail) throw Error("storage failed"); return state },
    refreshAfterDataChange: async () => { events.push("refresh"); return null },
    Dialog: { alert: async (value: any) => events.push(["alert", value.title]) },
  })
  const props = { item: { id: "reminder-id", title: "Monthly", iconName: "music.note" }, onChanged: () => events.push("changed") }
  return { events, render: () => render(props) }
}

test("reminder theme selection remains local and staged until Save, using its exact compare-and-set key", async () => {
  const env = reminderEditor()
  nodes(env.render()).find(node => node.type === "SystemIconThemes").props.onChanged("wallet.pass.fill")
  assert.deepEqual(env.events, [])
  const root = env.render()
  root.props.toolbar.confirmationAction.props.action(); root.props.toolbar.confirmationAction.props.action()
  await flush()
  assert.deepEqual(env.events[0], ["reminder", "reminder-id", { iconID: "sf:wallet.pass.fill", expectedIconID: "sf:creditcard.fill" }])
  assert.deepEqual(env.events.slice(1), ["changed", "refresh", "dismiss"])
})

test("reminder auto-match clears only its local override and a failed save never dismisses", async () => {
  for (const fail of [false, true]) {
    const env = reminderEditor(fail)
    nodes(env.render()).find(node => node.type === "Button" && node.props.title === "自动匹配系统图标").props.action()
    env.render().props.toolbar.confirmationAction.props.action(); await flush()
    assert.deepEqual(env.events[0], ["reminder", "reminder-id", { iconID: null, expectedIconID: "sf:creditcard.fill" }])
    assert.equal(env.events.includes("dismiss"), !fail)
    assert.equal(env.events.includes("refresh"), !fail)
  }
})
