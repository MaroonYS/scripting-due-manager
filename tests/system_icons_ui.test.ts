// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import * as icons from "../到期管家/src/icons.ts"
import { recommendedSystemIcons } from "../到期管家/src/system_icon_recommendations.ts"
import { itemIconID, symbolChoice } from "../到期管家/src/icon_preferences.ts"
import { defaultState } from "../到期管家/src/storage.ts"
import type { ManualDueItem } from "../到期管家/src/types.ts"

const read = (file: string) => readFileSync(new URL(`../到期管家/src/${file}`, import.meta.url), "utf8")
const h = (type: any, props: any, ...children: any[]): any => typeof type === "function" && type.name === "DueSymbol"
  ? type({ ...props, children })
  : ({ type: typeof type === "function" ? type.name : type,
    props: props ?? {}, children: children.flat(Infinity).filter(child => child != null && child !== false) })
const nodes = (node: any): any[] => [node, ...node.children.filter((child: any) => typeof child === "object").flatMap(nodes)]
const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve() }
const primitives = Object.fromEntries(["Button", "DisclosureGroup", "HStack", "Image", "LazyVGrid", "List", "NavigationLink", "Picker", "Section", "Spacer", "SystemIconPicker", "SystemIconThemes", "Text", "TextField", "Toggle", "VStack"].map(name => [name, name]))
const dueSymbolSource = read("due_symbol.tsx").replace(/^import .*$/gm, "").replace(/^export /gm, "")
const dueSymbolCompiled = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } }).transformSync(dueSymbolSource)
const dueSymbolBindings = { h, ...primitives, normalizeIconOverride: icons.normalizeIconOverride }
const DueSymbol = new Function(...Object.keys(dueSymbolBindings), `${dueSymbolCompiled}\nreturn DueSymbol`)(...Object.values(dueSymbolBindings))

function compiledFunction(file: string, name: string, extra: Record<string, any> = {}) {
  const bindings = { h, ...primitives, ...icons, DueSymbol, recommendedSystemIcons, itemIconID, symbolChoice, ...extra }
  const source = read(file).replace(/^import .*$/gm, "").replace(/^export /gm, "")
  const compiled = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } }).transformSync(source)
  return new Function(...Object.keys(bindings), `${compiled}\nreturn ${name}`)(...Object.values(bindings))
}

function harness(file: string, name: string, extra: Record<string, any> = {}) {
  const slots: any[] = [], pending: (() => void)[] = [], writes: number[] = []
  let cursor = 0
  const component = compiledFunction(file, name, { ...extra,
    useState: (initial: any) => {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial
      return [slots[index], (next: any) => { writes.push(index); slots[index] = typeof next === "function" ? next(slots[index]) : next }]
    },
    useEffect: (effect: () => (() => void) | void, deps: any[]) => {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((value, position) => value !== previous.deps[position])) {
        slots[index] = { deps }
        pending.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect() })
      }
    },
  })
  return Object.assign((props: any) => {
    cursor = 0
    const root = component(props)
    while (pending.length) pending.shift()!()
    return root
  }, { writes, dispose: () => { for (const slot of slots) slot?.cleanup?.() } })
}

const iconNames = (root: any) => nodes(root).filter(node => node.type === "Button" && node.props.key).map(node => node.props.key)
const automaticButton = (root: any) => nodes(root).find(node => node.type === "Button" && JSON.stringify(node.children).includes("自动匹配"))!
const choose = (root: any, name: string) => nodes(root).find(node => node.type === "SystemIconThemes")!.props.onChanged(name)

test("the first screen exposes eight relevant symbols without expanding a catalog", () => {
  const render = harness("system_icon_themes.tsx", "SystemIconThemes")
  const props = { value: "car.fill", automaticName: "music.note", onChanged: () => assert.fail("unexpected selection") }
  const root = render(props), names = iconNames(root)
  assert.equal(names.length, 8)
  assert.equal(new Set(names).size, 8)
  assert.deepEqual(names.slice(0, 2), ["music.note", "car.fill"])
  assert.equal(nodes(root).filter(node => node.type === "DisclosureGroup").length, 0)
  assert.equal(nodes(root).filter(node => node.type === "LazyVGrid").length, 1)
  const category = nodes(root).find(node => node.type === "Picker")!
  assert.equal(category.props.value, "推荐")
  assert.equal(category.children.length, icons.DUE_ICON_GROUPS.length + 1)
  const search = nodes(root).find(node => node.type === "TextField" && node.props.title === "搜索图标")!
  assert.ok(search)
  assert.equal(search.props.prompt, "还款、存款、护照、HSBC…")
  assert.ok(JSON.stringify(root.props.footer).includes("场景、品牌"))
  assert.ok(nodes(root).filter(node => node.type === "Button").every(node => JSON.stringify(node).includes("minHeight")))
})

test("category browsing is one visible grid and global search restores the previous category", () => {
  const events: string[] = [], render = harness("system_icon_themes.tsx", "SystemIconThemes")
  const props = { value: "wallet.pass.fill", automaticName: "music.note", onChanged: (name: string) => events.push(name) }
  const group = icons.DUE_ICON_OPTIONS.find(icon => icon.name === "wallet.pass.fill")!.group
  nodes(render(props)).find(node => node.type === "Picker")!.props.onChanged(group)
  let root = render(props)
  assert.deepEqual(iconNames(root), icons.DUE_ICON_OPTIONS.filter(icon => icon.group === group).map(icon => icon.name))
  const wallet = nodes(root).find(node => node.type === "Button" && node.props.key === "wallet.pass.fill")!
  assert.ok(JSON.stringify(wallet).includes("✓ "))
  wallet.props.action(); assert.deepEqual(events, ["wallet.pass.fill"])
  nodes(root).find(node => node.type === "TextField")!.props.onChanged("music")
  root = render(props)
  assert.equal(nodes(root).filter(node => node.type === "Picker").length, 0)
  assert.deepEqual(iconNames(root), icons.searchSystemIcons("music").map(icon => icon.name))
  assert.ok(iconNames(root).includes("music.note"))
  nodes(root).find(node => node.type === "TextField")!.props.onChanged("")
  root = render(props)
  assert.equal(nodes(root).find(node => node.type === "Picker")!.props.value, group)
  assert.deepEqual(iconNames(root), icons.DUE_ICON_OPTIONS.filter(icon => icon.group === group).map(icon => icon.name))
})

test("all category grid choices render through the same 24 pt glyph in a complete 32 pt slot", () => {
  const render = harness("system_icon_themes.tsx", "SystemIconThemes")
  const props = { value: "creditcard.fill", automaticName: "calendar.badge.clock", onChanged: () => assert.fail("rendering must not select") }
  const covered = new Set<string>()
  for (const group of icons.DUE_ICON_GROUPS) {
    nodes(render(props)).find(node => node.type === "Picker")!.props.onChanged(group)
    const root = render(props)
    const buttons = nodes(root).filter(node => node.type === "Button" && node.props.key)
    assert.deepEqual(buttons.map(node => node.props.key), icons.DUE_ICON_OPTIONS.filter(icon => icon.group === group).map(icon => icon.name))
    for (const button of buttons) {
      const glyphs = nodes(button).filter(node => node.type === "Image")
      assert.equal(glyphs.length, 1)
      const glyph = glyphs[0], slot = button.children[0].children[0]
      assert.equal(glyph.props.systemName, button.props.key)
      assert.equal(glyph.props.font, 24)
      assert.equal(glyph.props.resizable, true)
      assert.equal(glyph.props.scaleToFit, true)
      assert.deepEqual(glyph.props.frame, { width: 24, height: 24, alignment: "center" })
      assert.equal(slot.type, "VStack")
      assert.deepEqual(slot.props.frame, { width: 32, height: 32, alignment: "center" })
      assert.equal(button.children[0].props.frame.minHeight, 84, "the new drawing bounds must not shrink a grid tap target")
      assert.equal(button.children[0].props.contentShape, "rect")
      covered.add(glyph.props.systemName)
    }
  }
  assert.equal(covered.size, 216)
})

test("recommendations stay stable while previewing and empty searches never choose a symbol", () => {
  const events: string[] = [], render = harness("system_icon_themes.tsx", "SystemIconThemes")
  const props = { value: "car.fill", automaticName: "music.note", onChanged: (name: string) => events.push(name) }
  const original = iconNames(render(props))
  assert.deepEqual(iconNames(render({ ...props, value: "creditcard.fill" })), original)
  nodes(render(props)).find(node => node.type === "TextField")!.props.onChanged("unknown-847291")
  const root = render(props)
  assert.deepEqual(iconNames(root), [])
  assert.ok(JSON.stringify(root).includes("没有匹配的系统图标"))
  assert.deepEqual(events, [])
})

function pickerEnvironment(options: { fail?: boolean; deferred?: boolean } = {}) {
  const events: any[] = [], automatic = icons.resolveReminderIcon("续订服务", "Work", "Spotify Premium")
  let finish: (() => void) | undefined, reject: ((error: Error) => void) | undefined
  const pending = new Promise<void>((resolve, fail) => { finish = resolve; reject = fail })
  const render = harness("system_icon_picker.tsx", "SystemIconPicker", {
    Navigation: { useDismiss: () => () => events.push("dismiss") },
    Dialog: { alert: async (value: any) => events.push(["alert", value.title]) },
  })
  const props = { title: "续订服务", automatic, value: "creditcard.fill", footer: "local only",
    onConfirm: async (value: string | null) => {
      events.push(["confirm", value])
      if (options.fail) throw Error("save failed")
      if (options.deferred) await pending
    },
  }
  return { events, automatic, render: () => render(props), finish: () => finish!(),
    reject: () => reject!(Error("save failed")), dispose: render.dispose, writes: render.writes }
}

test("a shared picker draft never invokes the parent callback and Cancel discards it", () => {
  const env = pickerEnvironment()
  choose(env.render(), "wallet.pass.fill")
  const root = env.render()
  assert.equal(nodes(root).find(node => node.type === "SystemIconThemes")!.props.value, "wallet.pass.fill")
  assert.ok(nodes(root).some(node => node.type === "Image" && node.props.systemName === "wallet.pass.fill"))
  assert.deepEqual(env.events, [])
  root.props.toolbar.cancellationAction.props.action()
  assert.deepEqual(env.events, ["dismiss"])
})

test("automatic previews use the note-inferred reminder symbol instead of a generic placeholder", async () => {
  const env = pickerEnvironment()
  assert.equal(env.automatic.name, "music.note")
  automaticButton(env.render()).props.action()
  const root = env.render(), preview = nodes(root).find(node => node.type === "Image" && node.props.frame?.width === 36 && node.props.frame?.height === 36)!
  assert.equal(preview.props.systemName, "music.note")
  assert.equal(preview.props.foregroundStyle, env.automatic.color)
  assert.equal(preview.props.font, 36)
  assert.equal(preview.props.resizable, true)
  assert.equal(preview.props.scaleToFit, true)
  assert.ok(nodes(root).some(node => node.type === "VStack" && node.props.frame?.width === 48 && node.props.frame?.height === 48), "preview retains its full 48 pt slot")
  assert.equal(nodes(root).find(node => node.type === "SystemIconThemes")!.props.value, null)
  assert.ok(JSON.stringify(root).includes("自动匹配 ·"))
  assert.deepEqual(env.events, [])
  root.props.toolbar.confirmationAction.props.action(); await flush()
  assert.deepEqual(env.events, [["confirm", null], "dismiss"])
})

test("double confirmation invokes a pending parent only once and waits to dismiss", async () => {
  const env = pickerEnvironment({ deferred: true })
  choose(env.render(), "wallet.pass.fill")
  const root = env.render()
  root.props.toolbar.confirmationAction.props.action(); root.props.toolbar.confirmationAction.props.action()
  await flush()
  assert.deepEqual(env.events, [["confirm", "wallet.pass.fill"]])
  const busy = env.render()
  assert.equal(busy.props.disabled, true)
  assert.equal(busy.props.toolbar.confirmationAction.props.disabled, true)
  assert.equal(busy.props.toolbar.cancellationAction.props.disabled, true)
  env.finish(); await flush()
  assert.deepEqual(env.events, [["confirm", "wallet.pass.fill"], "dismiss"])
})

test("a failed confirmation leaves the selected draft open for retry", async () => {
  const env = pickerEnvironment({ fail: true })
  choose(env.render(), "wallet.pass.fill")
  env.render().props.toolbar.confirmationAction.props.action(); await flush()
  assert.deepEqual(env.events, [["confirm", "wallet.pass.fill"], ["alert", "图标未保存"]])
  const root = env.render()
  assert.equal(root.props.disabled, false)
  assert.equal(nodes(root).find(node => node.type === "SystemIconThemes")!.props.value, "wallet.pass.fill")
})

test("leaving a picker suppresses late success, failure and retained confirmation actions", async () => {
  for (const fail of [false, true]) {
    const env = pickerEnvironment({ deferred: true }), root = env.render()
    root.props.toolbar.confirmationAction.props.action(); await flush()
    env.dispose()
    const writesAtExit = env.writes.length
    root.props.toolbar.confirmationAction.props.action()
    choose(root, "wallet.pass.fill")
    automaticButton(root).props.action()
    root.props.toolbar.cancellationAction.props.action()
    if (fail) env.reject(); else env.finish()
    await flush()
    assert.deepEqual(env.events, [["confirm", "creditcard.fill"]], "accepted work finishes without touching the exited UI")
    assert.equal(env.writes.length, writesAtExit)
    root.props.toolbar.confirmationAction.props.action(); await flush()
    assert.deepEqual(env.events, [["confirm", "creditcard.fill"]])
  }
})

test("cancelled picker actions cannot confirm or dismiss a later screen", async () => {
  const env = pickerEnvironment(), root = env.render()
  root.props.toolbar.cancellationAction.props.action()
  const writesAtCancel = env.writes.length
  choose(root, "wallet.pass.fill")
  automaticButton(root).props.action()
  root.props.toolbar.confirmationAction.props.action()
  root.props.toolbar.cancellationAction.props.action()
  await flush()
  assert.deepEqual(env.events, ["dismiss"])
  assert.equal(env.writes.length, writesAtCancel)
})

function itemEditorEnvironment(source: "manual" | "reminder", options: { fail?: boolean; override?: boolean; refreshFail?: boolean; refreshDeferred?: boolean } = {}) {
  const state = defaultState(), events: any[] = []
  let finish!: () => void, reject!: (error: Error) => void
  const pending = new Promise<void>((resolve, fail) => { finish = resolve; reject = fail })
  const manual: ManualDueItem = { id: "same-id", title: "Monthly", kind: "subscription", iconName: "car.fill",
    dueDate: "2026-09-30", includesTime: false, hour: 9, minute: 0, remindBeforeDays: 3,
    recurrence: null, amount: "25", note: "Keep", enabled: true, createdAt: 1, updatedAt: 2 }
  state.items = [manual]
  if (options.override !== false) state.settings.itemIconChoices = [{ source, itemID: "same-id", iconID: "sf:creditcard.fill" }]
  const reminder = { id: "same-id", source: "reminder", title: "续订服务", note: "Spotify Premium", iconName: "music.note", iconColor: "systemPink", canComplete: false }
  const row = { source, item: source === "manual" ? manual : reminder }
  const globals = {
    loadState: () => structuredClone(state),
    Navigation: { useDismiss: () => () => events.push("dismiss") },
    updateItemIconChoice: (...args: any[]) => { events.push(["reminder-save", ...args]); if (options.fail) throw Error("storage failed"); return state },
    updateManualItemIcon: (...args: any[]) => { events.push(["manual-save", ...args]); if (options.fail) throw Error("storage failed"); return state },
    reloadWidgetsAfterStorageWrite: async () => {
      events.push("reload")
      if (options.refreshFail) throw Error("reload failed")
      if (options.refreshDeferred) await pending
    },
    Dialog: { alert: async (value: any) => events.push(["alert", value.title]) },
  }
  const editor = harness("icon_library_view.tsx", "ItemIconEditor", globals)
  const picker = harness("system_icon_picker.tsx", "SystemIconPicker", globals)
  const props = { row, onChanged: (next: any) => { assert.deepEqual(next, state); events.push("changed") } }
  const wrapper = () => editor(props)
  return { state, row, events, wrapper, render: () => picker(wrapper().props),
    dispose: () => { editor.dispose(); picker.dispose() }, finish, reject }
}

test("read-only reminders use an exact source-aware local CAS only after Save", async () => {
  const env = itemEditorEnvironment("reminder")
  assert.equal("canComplete" in env.row.item && env.row.item.canComplete, false)
  choose(env.render(), "wallet.pass.fill")
  assert.deepEqual(env.events, [])
  const root = env.render()
  root.props.toolbar.confirmationAction.props.action(); root.props.toolbar.confirmationAction.props.action()
  await flush()
  assert.deepEqual(env.events, [["reminder-save", "reminder", "same-id", { iconID: "sf:wallet.pass.fill", expectedIconID: "sf:creditcard.fill" }], "changed", "reload", "dismiss"])
  assert.equal(env.row.item.iconName, "music.note")
  assert.equal(env.row.item.note, "Spotify Premium")
})

test("manual entries use the narrow icon handler and preserve parent item data", async () => {
  const env = itemEditorEnvironment("manual")
  const before = structuredClone(env.row.item)
  choose(env.render(), "wallet.pass.fill")
  assert.deepEqual(env.events, [])
  env.render().props.toolbar.confirmationAction.props.action(); await flush()
  assert.deepEqual(env.events, [["manual-save", "same-id", "wallet.pass.fill", 2, "sf:creditcard.fill"], "changed", "reload", "dismiss"])
  assert.deepEqual(env.row.item, before)
})

test("automatic commits target only the selected source and failed storage never reloads or dismisses", async () => {
  for (const source of ["manual", "reminder"] as const) for (const fail of [false, true]) {
    const env = itemEditorEnvironment(source, { fail })
    automaticButton(env.render()).props.action()
    env.render().props.toolbar.confirmationAction.props.action(); await flush()
    assert.deepEqual(env.events[0], source === "manual"
      ? ["manual-save", "same-id", null, 2, "sf:creditcard.fill"]
      : ["reminder-save", "reminder", "same-id", { iconID: null, expectedIconID: "sf:creditcard.fill" }])
    assert.equal(env.events.includes("dismiss"), !fail)
    assert.equal(env.events.includes("reload"), !fail)
    if (fail) assert.deepEqual(env.events.at(-1), ["alert", "图标未保存"])
  }
})

test("unchanged saves close without a storage write or widget refresh", async () => {
  for (const source of ["manual", "reminder"] as const) {
    const env = itemEditorEnvironment(source)
    env.render().props.toolbar.confirmationAction.props.action(); await flush()
    assert.deepEqual(env.events, ["changed", "dismiss"])
  }
})

test("a persisted icon refresh failure reports saved status without retrying the write", async () => {
  const env = itemEditorEnvironment("reminder", { refreshFail: true })
  choose(env.render(), "wallet.pass.fill")
  env.render().props.toolbar.confirmationAction.props.action(); await flush()
  assert.deepEqual(env.events.map(event => Array.isArray(event) ? event[0] : event), ["reminder-save", "changed", "reload", "alert", "dismiss"])
  assert.deepEqual(env.events.at(-2), ["alert", "图标已保存"])
})

test("saved icons still finish refreshing after exit without late alerts or dismissals", async () => {
  for (const fail of [false, true]) {
    const env = itemEditorEnvironment("reminder", { refreshDeferred: true })
    choose(env.render(), "wallet.pass.fill")
    env.render().props.toolbar.confirmationAction.props.action(); await flush()
    env.dispose()
    if (fail) env.reject(Error("late reload failure")); else env.finish()
    await flush()
    assert.deepEqual(env.events.map(event => Array.isArray(event) ? event[0] : event), ["reminder-save", "changed", "reload"])
    assert.equal(env.events.filter(event => Array.isArray(event) && event[0] === "reminder-save").length, 1)
  }
})

test("an exited item editor rejects retained save callbacks without writing", async () => {
  const env = itemEditorEnvironment("manual"), wrapper = env.wrapper()
  env.dispose()
  await wrapper.props.onConfirm("wallet.pass.fill")
  assert.deepEqual(env.events, [])
})

test("library rows identify legacy manual choices and retain automatic symbol colors", () => {
  const appearance = compiledFunction("icon_library_view.tsx", "iconRowAppearance")
  const env = itemEditorEnvironment("manual", { override: false })
  const legacy = appearance(env.row, env.state.settings)
  assert.equal(legacy.explicit, true)
  assert.equal(legacy.icon.name, "car.fill")
  const reminder = appearance({ source: "reminder", item: { id: "r", title: "续订服务", iconName: "music.note" } }, defaultState().settings)
  assert.equal(reminder.explicit, false)
  assert.equal(reminder.icon.name, "music.note")
  assert.equal(reminder.icon.color, icons.resolveDueIcon("", "reminder", "music.note").color)
})
