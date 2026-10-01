// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { resolveDueIcon } from "../到期管家/src/icons.ts"
import { itemIconID, symbolChoice } from "../到期管家/src/icon_preferences.ts"
import { defaultState } from "../到期管家/src/storage.ts"
import type { AppState, DisplayDueItem, ManualDueItem } from "../到期管家/src/types.ts"

type Node = { type: string; props: Record<string, any>; children: any[] }
const h = (type: any, props: any, ...children: any[]): Node => ({
  type: typeof type === "function" ? type.name : type, props: props ?? {},
  children: children.flat(Infinity).filter(child => child != null && child !== false),
})
const nodes = (node: Node): Node[] => [node, ...node.children.filter(child => typeof child === "object").flatMap(nodes)]
const flush = async () => { for (let index = 0; index < 10; index++) await Promise.resolve() }
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function manual(id: string, patch: Partial<ManualDueItem> = {}): ManualDueItem {
  return { id, title: id, kind: "custom", iconName: null, dueDate: "2026-10-01", includesTime: false,
    hour: 0, minute: 0, remindBeforeDays: 0, recurrence: null, amount: "", note: "", enabled: true,
    createdAt: 1, updatedAt: 2, ...patch }
}
function reminder(id: string, patch: Partial<DisplayDueItem> = {}): DisplayDueItem {
  return { id, title: id, source: "reminder", kind: "reminder", completionKey: "date:2026-10-01",
    iconName: "wallet.pass.fill", iconColor: "systemOrange", dueDate: "2026-10-01", includesTime: false,
    hour: 0, minute: 0, dueTimestamp: 1, remindBeforeDays: 0, amount: "", note: "Bills", priority: 0,
    stale: false, canComplete: true, ...patch }
}
function harness(initial: AppState = defaultState(), extra: Record<string, any> = {}) {
  const slots: any[] = [], pending: (() => void)[] = [], reads: any[] = [], changed: AppState[] = [], writes: number[] = []
  const requests: ReturnType<typeof deferred<any>>[] = []
  let cursor = 0
  const bindings = {
    h, resolveDueIcon, itemIconID, symbolChoice,
    ...Object.fromEntries(["Button", "HStack", "Image", "List", "NavigationLink", "Picker", "Section", "Spacer", "Text", "TextField", "Toggle", "VStack", "SystemIconPicker"].map(name => [name, name])),
    useState: (value: any) => {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof value === "function" ? value() : value
      return [slots[index], (next: any) => { writes.push(index); slots[index] = typeof next === "function" ? next(slots[index]) : next }]
    },
    useEffect: (effect: () => (() => void) | void, deps: any[]) => {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((value, position) => value !== previous.deps[position])) {
        slots[index] = { deps }
        pending.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect() })
      }
    },
    loadState: () => initial,
    loadReminderItems: (...args: any[]) => {
      const request = deferred<any>(); reads.push(args); requests.push(request); return request.promise
    },
    updateItemIconChoice: () => { throw Error("Unexpected write") },
    updateManualItemIcon: () => { throw Error("Unexpected write") },
    reloadWidgetsAfterStorageWrite: () => { throw Error("Unexpected refresh") },
    Dialog: { alert: () => { throw Error("Unexpected alert") } }, ...extra,
  }
  const source = readFileSync(new URL("../到期管家/src/icon_library_view.tsx", import.meta.url), "utf8")
    .replace(/^import .*$/gm, "").replace(/^export /gm, "")
  const compiled = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } }).transformSync(source)
  const components = new Function(...Object.keys(bindings), `${compiled}\nreturn { IconLibraryView, ItemIconEditor, filterIconRows, iconRowAppearance }`)(...Object.values(bindings))
  return {
    ...components, reads, requests, changed, writes,
    render: (state = initial) => {
      cursor = 0
      const result = components.IconLibraryView({ state, onChanged: (next: AppState) => changed.push(next) }) as Node
      while (pending.length) pending.shift()!()
      return result
    },
    renderEditor: (row: any, onChanged: (next: AppState) => void) => {
      cursor = 0
      return components.ItemIconEditor({ row, onChanged }) as Node
    },
    dispose: () => { for (const slot of slots) slot?.cleanup?.() },
  }
}
const rowKeys = (root: Node) => nodes(root).filter(node => node.type === "NavigationLink").map(node => JSON.parse(node.props.key))

test("icon rows keep source identity, hidden state and explicit mode independent", () => {
  const state = { ...defaultState(), items: [manual("same"), manual("legacy", { iconName: "car.fill" }), manual("hidden", { enabled: false })] }
  state.settings.includeReminders = true
  state.settings.itemIconChoices = [{ source: "reminder", itemID: "same", iconID: "sf:creditcard.fill" }]
  const reminders = [reminder("same"), reminder("auto")], originals = structuredClone({ state, reminders })
  const { filterIconRows } = harness(state)
  const keys = (rows: any[]) => rows.map(row => [row.source, row.item.id])
  assert.deepEqual(keys(filterIconRows(state, reminders, "", "all", "all", false)), [
    ["manual", "same"], ["manual", "legacy"], ["reminder", "same"], ["reminder", "auto"],
  ])
  assert.deepEqual(keys(filterIconRows(state, reminders, "", "all", "explicit", true)), [["manual", "legacy"], ["reminder", "same"]])
  assert.deepEqual(keys(filterIconRows(state, reminders, "", "manual", "automatic", true)), [["manual", "same"], ["manual", "hidden"]])
  assert.deepEqual(keys(filterIconRows({ ...state, settings: { ...state.settings, includeReminders: false } }, reminders, "", "reminder", "all", true)), [])
  assert.deepEqual({ state, reminders }, originals)
})

test("icon search normalizes fullwidth names and matches manual notes or reminder list names", () => {
  const state = { ...defaultState(), items: [manual("manual", { title: "Music annual", note: "Backup payment" })] }
  state.settings.includeReminders = true
  const reminders = [reminder("reminder", { title: "Annual", note: "Music subscriptions" })]
  const { filterIconRows } = harness(state)
  assert.equal(filterIconRows(state, reminders, "　ＭＵＳＩＣ　", "all", "all", false).length, 2)
  assert.equal(filterIconRows(state, reminders, "BACKUP", "all", "all", false)[0].item, state.items[0])
  assert.equal(filterIconRows(state, reminders, "subscriptions", "all", "all", false)[0].item, reminders[0])
  assert.deepEqual(filterIconRows(state, reminders, "no-match", "all", "all", false), [])
})

test("icon row previews respect choice precedence and distinguish legacy manual symbols from automatic matching", () => {
  const state = defaultState(), { iconRowAppearance } = harness(state)
  const automatic = manual("same", { title: "Music monthly" }), legacy = manual("legacy", { iconName: "car.fill" })
  assert.deepEqual(iconRowAppearance({ source: "manual", item: automatic }, state.settings), {
    icon: resolveDueIcon(automatic.title, automatic.kind), explicit: false, unavailable: false,
  })
  assert.deepEqual(iconRowAppearance({ source: "manual", item: legacy }, state.settings), {
    icon: resolveDueIcon(legacy.title, legacy.kind, legacy.iconName), explicit: true, unavailable: false,
  })
  state.settings.itemIconChoices = [{ source: "manual", itemID: "legacy", iconID: "sf:creditcard.fill" }]
  assert.equal(iconRowAppearance({ source: "manual", item: legacy }, state.settings).icon.name, "creditcard.fill")
  assert.equal(iconRowAppearance({ source: "reminder", item: reminder("legacy") }, state.settings).explicit, false)
  assert.equal(iconRowAppearance({ source: "reminder", item: reminder("legacy") }, state.settings).icon.name, "wallet.pass.fill")
})

test("icon library retries a failed reminder read and reports cache fallback", async () => {
  const state = defaultState(); state.settings.includeReminders = true
  const env = harness(state)
  try {
    env.render(); let root = env.render()
    assert.equal(env.reads.length, 1)
    assert.ok(nodes(root).find(node => node.type === "Button" && node.props.title === "正在读取…")?.props.disabled)
    env.requests[0].reject(Error("Permission denied")); await flush()
    root = env.render()
    assert.ok(JSON.stringify(root).includes("Permission denied"))
    nodes(root).find(node => node.type === "Button" && node.props.title === "重新读取提醒事项")!.props.action()
    env.render(); assert.equal(env.reads.length, 2)
    env.requests[1].resolve({ items: [reminder("cached")], error: null, fromCache: true }); await flush()
    root = env.render()
    assert.deepEqual(rowKeys(root), [["reminder", "cached"]])
    assert.ok(JSON.stringify(root).includes("当前提醒事项来自本机缓存"))
    assert.deepEqual(env.changed, [], "reads and retries must not save settings")
  } finally { env.dispose() }
})

test("changing reminder scope discards late results and disabling hides stale reminder rows", async () => {
  const state = defaultState(); state.settings.includeReminders = true
  const env = harness(state)
  try {
    env.render()
    const changed = { ...state, settings: { ...state.settings, reminderCalendarIDs: ["new-list"] } }
    env.render(changed); env.render(changed)
    assert.equal(env.reads.length, 2)
    assert.deepEqual(env.reads[1], [changed.settings.reminderHorizonDays, ["new-list"]])
    env.requests[1].resolve({ items: [reminder("new")], error: null, fromCache: false }); await flush()
    assert.deepEqual(rowKeys(env.render(changed)), [["reminder", "new"]])
    env.requests[0].resolve({ items: [reminder("old")], error: null, fromCache: false }); await flush()
    assert.deepEqual(rowKeys(env.render(changed)), [["reminder", "new"]])
    const disabled = { ...changed, settings: { ...changed.settings, includeReminders: false } }
    env.render(disabled); env.render(disabled)
    assert.deepEqual(rowKeys(env.render(disabled)), [])
    assert.equal(env.reads.length, 2)
  } finally { env.dispose() }
})

test("unavailable stored symbols remain identifiable and Auto confirmation clears the exact preference", async () => {
  const state = defaultState(), events: any[] = []
  state.settings.itemIconChoices = [{ source: "reminder", itemID: "future", iconID: "sf:future.symbol.fill" }]
  const env = harness(state, {
    updateItemIconChoice: (...args: any[]) => { events.push(["save", ...args]); return state },
    reloadWidgetsAfterStorageWrite: async () => { events.push(["reload"]) },
  })
  const row = { source: "reminder", item: reminder("future") }
  const appearance = env.iconRowAppearance(row, state.settings)
  assert.equal(appearance.explicit, true)
  assert.equal(appearance.unavailable, true)
  assert.equal(appearance.icon.name, row.item.iconName, "unavailable symbols preview the automatic fallback")
  const root = env.renderEditor(row, next => events.push(["changed", next]))
  assert.equal(root.type, "SystemIconPicker")
  assert.equal(root.props.value, null)
  await root.props.onConfirm(null)
  assert.deepEqual(events[0], ["save", "reminder", "future", { iconID: null, expectedIconID: "sf:future.symbol.fill" }])
  assert.deepEqual(events.slice(1), [["changed", state], ["reload"]])
})

test("leaving the icon library prevents late read results from updating its state", async () => {
  const state = defaultState(); state.settings.includeReminders = true
  const env = harness(state)
  env.render(); env.dispose()
  const writesAtExit = env.writes.length
  env.requests[0].resolve({ items: [reminder("late")], error: null, fromCache: false }); await flush()
  assert.equal(env.writes.length, writesAtExit)
})

test("icon library paginates 85 items, resets after filters and clamps when available rows shrink", () => {
  const state = { ...defaultState(), items: Array.from({ length: 85 }, (_, index) =>
    manual(`item-${String(index).padStart(3, "0")}`, { iconName: index < 5 ? "car.fill" : null })) }
  const original = structuredClone(state), storageWrites: any[] = []
  const env = harness(state, {
    updateManualItemIcon: (...args: any[]) => { storageWrites.push(args); return state },
    updateItemIconChoice: (...args: any[]) => { storageWrites.push(args); return state },
  })
  const button = (root: Node, title: string) => nodes(root).find(node => node.type === "Button" && node.props.title === title)
  const expected = (start: number, end: number) => state.items.slice(start, end).map(item => ["manual", item.id])
  try {
    let root = env.render()
    assert.deepEqual(rowKeys(root), expected(0, 40))
    assert.equal(button(root, "上一页")!.props.disabled, true)
    assert.equal(button(root, "下一页")!.props.disabled, false)
    button(root, "下一页")!.props.action(); root = env.render()
    assert.deepEqual(rowKeys(root), expected(40, 80))
    assert.equal(button(root, "上一页")!.props.disabled, false)
    assert.equal(button(root, "下一页")!.props.disabled, false)
    button(root, "下一页")!.props.action(); root = env.render()
    assert.deepEqual(rowKeys(root), expected(80, 85))
    assert.equal(button(root, "上一页")!.props.disabled, false)
    assert.equal(button(root, "下一页")!.props.disabled, true)
    button(root, "上一页")!.props.action(); root = env.render()
    assert.deepEqual(rowKeys(root), expected(40, 80))
    button(root, "下一页")!.props.action(); root = env.render()

    nodes(root).find(node => node.type === "TextField")!.props.onChanged("item-00")
    root = env.render()
    assert.deepEqual(rowKeys(root), expected(0, 10), "search starts from the first matching page")
    assert.equal(button(root, "下一页"), undefined)
    nodes(root).find(node => node.type === "TextField")!.props.onChanged("")
    root = env.render()
    assert.deepEqual(rowKeys(root), expected(0, 40))
    button(root, "下一页")!.props.action(); root = env.render()
    button(root, "下一页")!.props.action(); root = env.render()
    nodes(root).find(node => node.type === "Picker" && node.props.title === "事项来源")!.props.onChanged("manual")
    root = env.render()
    assert.deepEqual(rowKeys(root), expected(0, 40), "source changes reset even when the result count is unchanged")
    assert.equal(button(root, "上一页")!.props.disabled, true)

    button(root, "下一页")!.props.action(); root = env.render()
    button(root, "下一页")!.props.action(); root = env.render()
    nodes(root).find(node => node.type === "Picker" && node.props.title === "图标方式")!.props.onChanged("explicit")
    root = env.render()
    assert.deepEqual(rowKeys(root), expected(0, 5), "mode changes reset to the first matching item")
    assert.equal(button(root, "下一页"), undefined)
    nodes(root).find(node => node.type === "Picker" && node.props.title === "图标方式")!.props.onChanged("all")
    root = env.render()
    button(root, "下一页")!.props.action(); root = env.render()
    button(root, "下一页")!.props.action(); root = env.render()
    const reduced = { ...state, items: state.items.slice(0, 19) }
    env.render(reduced); root = env.render(reduced)
    assert.deepEqual(rowKeys(root), expected(0, 19), "current page clamps after external row removal")
    assert.equal(button(root, "上一页"), undefined)
    assert.equal(button(root, "下一页"), undefined)
    assert.deepEqual(env.reads, [])
    assert.deepEqual(env.changed, [])
    assert.deepEqual(storageWrites, [])
    assert.deepEqual(state, original)
  } finally { env.dispose() }
})
