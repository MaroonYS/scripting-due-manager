// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { readReminderNotes } from "../到期管家/src/reminder_notes.ts"
import { openReminderFromWidget } from "../到期管家/src/reminder_navigation.ts"
import { localDateKey } from "../到期管家/src/date.ts"
import { dueIconLabel } from "../到期管家/src/icons.ts"
import { formatWidgetDate, formatWidgetWeekday, widgetItemDateKey, widgetText } from "../到期管家/src/widget_localization.ts"

const UUID = "8ec3f3ed-7ba0-44e1-88ba-b9c9e4022a9d"
const read = (file: string) => readFileSync(new URL(`../到期管家/${file}`, import.meta.url), "utf8")
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
const withoutImports = (source: string) => source.replace(/^import[\s\S]*?from\s+"[^"]+"\s*\n/gm, "").replace(/^export /gm, "")
const transpile = (source: string) => new Bun.Transpiler({ loader: "tsx", tsconfig: {
  compilerOptions: { jsx: "react", jsxFactory: "h", jsxFragmentFactory: "Fragment" },
} }).transformSync(source)

async function withNative(get: (id: string) => Promise<any>, operation: () => Promise<void>) {
  const globals = globalThis as any
  const names = ["Reminder", "Storage", "Safari"]
  const old = names.map(name => globals[name])
  globals.Reminder = { get }
  globals.Storage = new Proxy({}, { get: () => assert.fail("notes must not touch Storage") })
  globals.Safari = { openURL: () => assert.fail("reading notes must not launch URLs") }
  try { await operation() }
  finally { names.forEach((name, i) => { if (old[i] === undefined) delete globals[name]; else globals[name] = old[i] }) }
}

test("notes are fetched by exact ID, kept complete and never stored, edited or opened as a URL", async () => {
  const notes = "  备注第一行\n\nhttps://example.com/do-not-open\n" + "完整备注📌\n".repeat(5000) + "最后一行  "
  const reminder = { identifier: UUID, title: "测试事项", notes, calendar: { title: "Work", allowsContentModifications: false }, isCompleted: true,
    save: () => assert.fail("read-only view must not save") }
  await withNative(async id => { assert.equal(id, UUID); return reminder }, async () => {
    assert.deepEqual(await readReminderNotes(UUID), { id: UUID, title: "测试事项", list: "Work", notes, completed: true, canOpen: true })
    assert.equal(reminder.isCompleted, true)
  })
})

test("invalid and mismatched IDs cannot reveal another reminder's private notes", async () => {
  await withNative(async () => assert.fail("invalid ID must not reach native lookup"), async () => {
    for (const id of [undefined, null, "", "a".repeat(513), "x\ny", 42, {}]) await assert.rejects(readReminderNotes(id), /标识无效/)
  })
  await withNative(async () => ({ identifier: "other", notes: "PRIVATE OTHER NOTES" }), async () => {
    await assert.rejects(readReminderNotes(UUID), error => /不一致/.test(String(error)) && !String(error).includes("PRIVATE"))
  })
})

test("canonical UUID aliases are accepted while non-UUID accounts can still read notes", async () => {
  await withNative(async () => ({ identifier: `x-apple-reminder://${UUID.toUpperCase()}`, notes: "Alias" }), async () => {
    assert.equal((await readReminderNotes(UUID)).notes, "Alias")
  })
  const id = "account/" + "a".repeat(504)
  await withNative(async () => ({ identifier: id, title: "Account", notes: "Readable" }), async () => {
    const value = await readReminderNotes(id)
    assert.equal(value.notes, "Readable")
    assert.equal(value.canOpen, false)
  })
})

test("empty notes and deleted or denied reminders have distinct, privacy-safe outcomes", async () => {
  await withNative(async () => ({ identifier: UUID, title: "", notes: null }), async () => {
    assert.deepEqual(await readReminderNotes(UUID), { id: UUID, title: "未命名提醒事项", list: "", notes: "", completed: false, canOpen: true })
  })
  await withNative(async () => null, async () => { await assert.rejects(readReminderNotes(UUID), /已删除或暂时无法读取/) })
  await withNative(async () => { throw Error("PRIVATE NATIVE ERROR") }, async () => {
    await assert.rejects(readReminderNotes(UUID), error => /权限/.test(String(error)) && !String(error).includes("PRIVATE"))
  })
})

test("a stalled native read times out without persisting a late result", async () => {
  const globals = globalThis as any, oldTimer = globals.setTimeout, oldClear = globals.clearTimeout
  let expire!: () => void, release!: (value: any) => void
  globals.setTimeout = (callback: () => void, delay: number) => { assert.equal(delay, 10000); expire = callback; return 1 }
  globals.clearTimeout = () => {}
  try {
    await withNative(() => new Promise(resolve => { release = resolve }), async () => {
      const operation = readReminderNotes(UUID)
      await flush(); expire()
      await assert.rejects(operation, /读取备注超时/)
      release({ identifier: UUID, notes: "LATE PRIVATE NOTES" }); await flush()
    })
  } finally { globals.setTimeout = oldTimer; globals.clearTimeout = oldClear }
})

test("explicit external open revalidates the selected item and cannot use a notes URL", async () => {
  await withNative(async () => ({ identifier: "wrong", notes: "x-apple-reminderkit://" }), async () => {
    await assert.rejects(openReminderFromWidget(UUID), /不一致/)
  })
})

type Node = { type: string; props: any; children: any[] }
const h = (type: any, props: any, ...children: any[]): Node => ({ type: typeof type === "function" ? type.name : type, props: props ?? {}, children: children.flat(Infinity).filter(x => x != null && x !== false) })
const nodes = (node: Node): Node[] => [node, ...node.children.filter(x => x && typeof x === "object").flatMap(nodes)]
const text = (node: Node): string => [node.props.title ?? "", ...node.children.map(x => typeof x === "object" ? text(x) : String(x))].join(" ")

function viewHarness(readNotes: (id: unknown) => Promise<any>, open: (id: unknown) => Promise<void> = async () => {}, listLoader?: (...args: any[]) => Promise<any>) {
  const cells: any[] = [], effects: (() => void)[] = [], events: any[] = []
  let cursor = 0
  const bindings = {
    h, Fragment: "Fragment", ...Object.fromEntries(["Button", "List", "Section", "Text", "TextField", "NavigationLink", "ReminderNotesView"].map(x => [x, x])),
    Navigation: { useDismiss: () => () => events.push("dismiss") },
    Dialog: { alert: async (value: any) => events.push(["alert", value.title]) },
    readReminderNotes: readNotes, openReminderFromWidget: open,
    loadReminderItems: listLoader, withReadDeadline: (load: () => Promise<any>) => load(),
    useState: (initial: any) => {
      const index = cursor++
      if (!cells[index]) cells[index] = { value: typeof initial === "function" ? initial() : initial }
      return [cells[index].value, (value: any) => { cells[index].value = typeof value === "function" ? value(cells[index].value) : value }]
    },
    useEffect: (effect: () => any, deps: any[]) => {
      const index = cursor++, previous = cells[index]
      if (previous && deps.every((value, i) => value === previous.deps[i])) return
      previous?.cleanup?.(); cells[index] = { deps }
      effects.push(() => { cells[index].cleanup = effect() })
    },
  }
  const renderView = new Function(...Object.keys(bindings), transpile(withoutImports(read(listLoader ? "src/reminder_notes_list.tsx" : "src/reminder_notes_view.tsx"))) + (listLoader ? "\nreturn ReminderNotesList" : "\nreturn ReminderNotesView"))(...Object.values(bindings))
  return { events, render: (id: unknown = UUID) => { cursor = 0; return renderView(listLoader ? { settings: id } : { id, standalone: true }) as Node },
    effects: () => { while (effects.length) effects.shift()!() }, unmount: () => { cells.forEach(cell => cell?.cleanup?.()) } }
}

const result = (id = UUID, notes = "第一行\n\n最后一行") => ({ id, title: "Selected Reminder", list: "Work", notes, completed: false, canOpen: true })

test("notes page first renders loading, then shows full multiline text without auto-opening or truncating", async () => {
  const calls: unknown[] = [], env = viewHarness(async id => { calls.push(id); return result() }, async () => assert.fail("must not auto-open"))
  try {
    assert.match(text(env.render()), /正在读取/); assert.deepEqual(calls, [])
    env.effects(); await flush()
    const view = env.render(), body = nodes(view).find(node => node.type === "Text" && node.children.includes(result().notes))!
    assert.ok(body); assert.equal(body.props.lineLimit, undefined)
    assert.deepEqual(body.props.fixedSize, { horizontal: false, vertical: true })
    assert.deepEqual(calls, [UUID]); assert.match(text(view), /Selected Reminder/)
    view.props.toolbar.cancellationAction.props.action(); assert.deepEqual(env.events, ["dismiss"])
  } finally { env.unmount() }
})

test("notes retry clears the previous content and allows a fresh native response", async () => {
  let count = 0
  const env = viewHarness(async () => { if (++count === 1) throw Error("读取失败"); return result(UUID, "更新后的备注") })
  try {
    env.render(); env.effects(); await flush()
    const failed = env.render(); assert.match(text(failed), /读取失败/)
    nodes(failed).find(node => node.props.title === "重试")!.props.action()
    assert.match(text(env.render()), /正在读取/); env.effects(); await flush()
    assert.match(text(env.render()), /更新后的备注/); assert.equal(count, 2)
  } finally { env.unmount() }
})

test("switching IDs or leaving the notes page invalidates late replies and never flashes another item's notes", async () => {
  const pending = new Map<unknown, (value: any) => void>()
  const env = viewHarness(id => new Promise(resolve => pending.set(id, resolve)))
  try {
    env.render("a"); env.effects()
    env.render("b"); env.effects()
    pending.get("a")!(result("a", "PRIVATE A")); await flush()
    assert.doesNotMatch(text(env.render("b")), /PRIVATE A/)
    pending.get("b")!(result("b", "PRIVATE B")); await flush()
    assert.match(text(env.render("b")), /PRIVATE B/)
    assert.doesNotMatch(text(env.render("c")), /PRIVATE B/)
    env.effects(); env.unmount(); pending.get("c")!(result("c", "LATE")); await flush()
    assert.doesNotMatch(text(env.render("c")), /LATE/)
  } finally { env.unmount() }
})

test("empty, completed and unsupported-account notes remain explicit and readable", async () => {
  const env = viewHarness(async () => ({ ...result(UUID, "\n "), completed: true, canOpen: false }))
  try {
    env.render(); env.effects(); await flush(); const view = env.render()
    assert.match(text(view), /没有备注/); assert.match(text(view), /已完成/)
    assert.equal(nodes(view).find(node => node.props.title === "在提醒事项中打开")!.props.disabled, true)
  } finally { env.unmount() }
})

test("external navigation is explicit, double-tap gated and never replaces notes with the main app", async () => {
  let release!: () => void, calls = 0
  const env = viewHarness(async () => result(), async id => { assert.equal(id, UUID); calls++; await new Promise<void>(resolve => { release = resolve }); throw Error("failed") })
  try {
    env.render(); env.effects(); await flush()
    const button = nodes(env.render()).find(node => node.props.title === "在提醒事项中打开")!
    button.props.action(); button.props.action(); await flush(); assert.equal(calls, 1)
    release(); await flush(); assert.match(text(env.render()), /第一行/)
    assert.deepEqual(env.events, [["alert", "无法在提醒事项中打开"]])
  } finally { env.unmount() }
})

test("compact and roomy calendar headers open exact notes, with the issue link kept separate", () => {
  const source = read("src/widget_view.tsx")
  const functionSource = (name: string) => {
    const start = source.indexOf(`function ${name}(`)
    assert.ok(start >= 0, name)
    const rest = source.slice(start)
    const next = rest.search(/\n(?:export )?function /)
    return next < 0 ? rest : rest.slice(0, next)
  }
  const bindings = { h, Link: "Link", HStack: "HStack", VStack: "VStack", Text: "Text", Image: "Image",
    Script: { name: "到期管家", createRunURLScheme: (_: string, parameters: any) => "scripting://run/manager?" + new URLSearchParams(parameters).toString() },
    widgetText, widgetItemDateKey, formatWidgetDate, formatWidgetWeekday, localDateKey, dueIconLabel,
    widgetRuntimeLanguage: () => "zh-Hans" }
  const compiled = transpile(["WidgetHeader", "AgendaHeader", "itemURL"].map(functionSource).join("\n"))
  const { WidgetHeader, AgendaHeader } = new Function(...Object.keys(bindings), `${compiled}\nreturn { WidgetHeader, AgendaHeader }`)(...Object.values(bindings))
  const item = { id: "current&exact=提醒", source: "reminder", iconName: "creditcard.fill", dueDate: "2026-09-12", includesTime: false }
  const locale = "zh-CN", now = new Date(2026, 8, 12, 12)
  const expected = { action: "reminder-notes", id: item.id }
  const issue = { url: "scripting://run/manager?action=widget-status", color: "systemRed" }
  const compact = WidgetHeader({ item, issue, locale, now, height: 20 })
  const links = nodes(compact).filter(node => node.type === "Link")
  assert.equal(links.length, 2)
  assert.equal(links[0].props.url, issue.url, "warning must precede the notes link so it cannot displace the trailing date")
  assert.deepEqual(Object.fromEntries(new URL(links[1].props.url).searchParams), expected)
  assert.equal(links[1].children[0].props.contentShape, "rect")

  for (const height of [36, 56]) {
    const roomy = AgendaHeader({ item, roomy: true, locale, now, height })
    assert.deepEqual(Object.fromEntries(new URL(roomy.props.url).searchParams), expected)
    assert.equal(roomy.children[0].props.contentShape, "rect")
  }
  assert.equal(new URL(AgendaHeader({ item, roomy: false, locale, now, height: 22 }).props.url).search, "")
  const empty = WidgetHeader({ item: undefined, issue: null, locale, now, height: 20 })
  assert.equal(new URL(nodes(empty).find(node => node.type === "Link")!.props.url).search, "")

  const viewSource = read("src/reminder_notes_view.tsx")
  assert.doesNotMatch(viewSource, /Storage|loadState|reconcileNotifications|\.save\(|\.slice\(|lineLimit=/)
  assert.doesNotMatch(read("src/reminder_notes.ts"), /Storage\.|\.save\(|console\./)
  assert.match(read("src/app.tsx"), /<ReminderNotesList settings=\{state.settings\}/)
})

test("main-app notes fallback respects the selected scope, searches locally and passes exact IDs", async () => {
  const calls: any[] = [], settings = { reminderCalendarIDs: ["work"], reminderHorizonDays: 42 }
  const env = viewHarness(async () => assert.fail("list must not preload private notes"), undefined, async (...args) => {
    calls.push(args)
    return { items: [{ id: "one", title: "账单", note: "财务" }, { id: "two", title: "续订", note: "Work" }], fromCache: true, error: null }
  })
  try {
    env.render(settings); env.effects(); await flush()
    const view = env.render(settings)
    assert.deepEqual(calls, [[42, ["work"]]])
    assert.match(text(view), /来自缓存/)
    const links = nodes(view).filter(node => node.type === "NavigationLink")
    assert.deepEqual(links.map(node => node.props.destination.props.id), ["one", "two"])
    nodes(view).find(node => node.type === "TextField")!.props.onChanged("work")
    const filtered = nodes(env.render(settings)).filter(node => node.type === "NavigationLink")
    assert.deepEqual(filtered.map(node => node.props.destination.props.id), ["two"])
    assert.equal(calls.length, 1)
  } finally { env.unmount() }
})

test("notes list failures and empty results stay visible and retryable without selecting another item", async () => {
  let count = 0
  const settings = { reminderCalendarIDs: [], reminderHorizonDays: 30 }
  const env = viewHarness(async () => assert.fail("no note read"), undefined, async () => {
    if (++count === 1) throw Error("denied")
    return { items: [], fromCache: false, error: null }
  })
  try {
    env.render(settings); env.effects(); await flush()
    const failed = env.render(settings); assert.match(text(failed), /读取失败/)
    assert.equal(nodes(failed).filter(node => node.type === "NavigationLink").length, 0)
    nodes(failed).find(node => node.props.title === "重新读取列表")!.props.action()
    env.render(settings); env.effects(); await flush()
    assert.match(text(env.render(settings)), /没有找到提醒事项/); assert.equal(count, 2)
  } finally { env.unmount() }
})
