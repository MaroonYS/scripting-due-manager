// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { normalizeReminderCalendarIDs } from "../到期管家/src/storage.ts"

const read = (name: string) => readFileSync(new URL(`../到期管家/src/${name}`, import.meta.url), "utf8")
const withoutImports = (source: string) => source.replace(/^import[\s\S]*?from\s+"[^"]+"\s*\n/gm, "").replace(/^export /gm, "")
const transpile = (source: string) => new Bun.Transpiler({ loader: "tsx", tsconfig: {
  compilerOptions: { jsx: "react", jsxFactory: "h" },
} }).transformSync(source)
const flush = async () => { for (let index = 0; index < 40; index++) await Promise.resolve() }
const nodes = (node: any): any[] => [node, ...node.children.filter((child: any) => child && typeof child === "object").flatMap(nodes)]
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
const calendar = (id: string, title = id, source = "iCloud", readOnly = false) => ({
  identifier: id, title, source: { title: source }, allowsContentModifications: !readOnly,
})

function picker(options: {
  selected?: string[]
  access?: (call: number) => Promise<string[]>
  read?: (call: number) => Promise<any[]>
  save?: (ids: string[], call: number) => Promise<void>
} = {}) {
  let cursor = 0, timerSequence = 0, accessCalls = 0, reads = 0, saves = 0
  const cells: any[] = [], effects: (() => void)[] = [], writes: any[] = [], events: any[] = []
  const timers = new Map<number, { callback: () => void; milliseconds: number }>()
  const bindings = {
    h: (type: any, props: any, ...children: any[]) => ({ type: typeof type === "function" ? type.name : type,
      props: props ?? {}, children: children.flat(Infinity).filter(child => child != null) }),
    ...Object.fromEntries(["Button", "HStack", "Image", "List", "Section", "Spacer", "Text", "VStack"].map(name => [name, name])),
    Navigation: { useDismiss: () => () => events.push("dismiss") },
    Script: { requestAccess: (scopes: string[]) => {
      events.push(["permission", scopes]); return options.access?.(++accessCalls) ?? Promise.resolve(["calendar", "reminders"])
    } },
    Calendar: { forReminders: () => { reads++; return options.read?.(reads) ?? Promise.resolve([calendar("a")]) } },
    Dialog: { alert: async (details: any) => { events.push(["alert", details.title, details.message]) } },
    normalizeReminderCalendarIDs,
    setTimeout: (callback: () => void, milliseconds: number) => {
      const id = ++timerSequence; timers.set(id, { callback, milliseconds }); return id
    },
    clearTimeout: (id: number) => timers.delete(id),
    useState: (initial: any) => {
      const index = cursor++
      if (!cells[index]) cells[index] = { value: typeof initial === "function" ? initial() : initial }
      return [cells[index].value, (next: any) => {
        cells[index].value = typeof next === "function" ? next(cells[index].value) : next
        writes.push([index, cells[index].value])
      }]
    },
    useEffect: (effect: () => any, deps: any[]) => {
      const index = cursor++, previous = cells[index]
      if (previous && deps.length === previous.deps.length && deps.every((value, i) => value === previous.deps[i])) return
      previous?.cleanup?.(); cells[index] = { deps }
      effects.push(() => { cells[index].cleanup = effect() })
    },
  }
  const source = withoutImports(read("async_deadline.ts")) + withoutImports(read("reminder_calendar_picker.tsx"))
  const component = new Function(...Object.keys(bindings), transpile(source) + "\nreturn ReminderCalendarPicker")(...Object.values(bindings))
  const props = { selectedIDs: options.selected ?? [], onChanged: async (ids: string[]) => {
    events.push(["save", ids]); await options.save?.(ids, ++saves); events.push("save-finished")
  } }
  const render = () => { cursor = 0; return component(props) }
  return {
    events, writes, timers, render,
    commit: () => { while (effects.length) effects.shift()!() },
    unmount: () => { for (const cell of cells) cell?.cleanup?.() },
    accessCount: () => accessCalls, readCount: () => reads,
    expire: () => {
      const [id, timer] = [...timers][0]; assert.equal(timer.milliseconds, 10000)
      timers.delete(id); timer.callback()
    },
  }
}
const confirm = (root: any) => root.props.toolbar.confirmationAction.props.action()
const all = (root: any) => nodes(root).find(node => node.type === "Button"
  && node.children.some((child: any) => child.type === "ReminderCalendarRow" && child.props.title === "全部列表"))!
const retry = (root: any) => nodes(root).find(node => node.type === "Button" && node.props.title === "读取失败，点此重试")!
const row = (root: any, title: string) => nodes(root).find(node => node.type === "Button"
  && node.children.some((child: any) => child.type === "ReminderCalendarRow" && child.props.title === title))!

test("the extracted picker preserves deduplication, source sorting, multi-selection and read-only labels", async () => {
  const env = picker({ selected: [" b ", "b"], read: async () => [
    calendar("b", "B", "zAccount", true), calendar("a", "A", "aAccount"), calendar("a", "duplicate"), calendar(""),
  ] })
  env.render(); env.commit(); await flush()
  const root = env.render(), rows = nodes(root).filter(node => node.type === "ReminderCalendarRow")
  assert.deepEqual(rows.map(node => node.props.title), ["全部列表", "A", "B"])
  assert.equal(rows[2].props.detail, "zAccount · 只读"); assert.equal(rows[2].props.selected, true)
  row(root, "A").props.action(); confirm(env.render()); await flush()
  assert.deepEqual(env.events.filter(event => Array.isArray(event) && event[0] === "save"), [["save", ["a", "b"]]])
  assert.equal(env.events.at(-1), "dismiss"); assert.equal(env.timers.size, 0)
})

test("permission prompts have no timer and repeated read retries launch only one prompt/query", async () => {
  const permission = deferred<string[]>(), env = picker({ access: call => call === 1
    ? Promise.resolve([]) : permission.promise })
  env.render(); env.commit(); await flush()
  const action = retry(env.render()).props.action
  action(); action(); action(); await flush()
  assert.equal(env.accessCount(), 2); assert.equal(env.readCount(), 0); assert.equal(env.timers.size, 0)
  permission.resolve(["calendar", "reminders"]); await flush()
  assert.equal(env.readCount(), 1); assert.equal(retry(env.render()), undefined)
})

test("closing during authorization prevents a late native read, settings write or UI update", async () => {
  const permission = deferred<string[]>(), env = picker({ access: () => permission.promise })
  const root = env.render(); env.commit(); await flush()
  env.unmount(); const writes = env.writes.length
  permission.resolve(["calendar", "reminders"]); await flush()
  all(root).props.action(); confirm(root); await flush()
  assert.equal(env.readCount(), 0); assert.equal(env.writes.length, writes)
  assert.equal(env.events.length, 1); assert.equal(env.timers.size, 0)
})

test("closing during the calendar read consumes either late success or rejection without stale UI", async () => {
  for (const succeeds of [true, false]) {
    const read = deferred<any[]>(), env = picker({ read: () => read.promise })
    env.render(); env.commit(); await flush(); assert.equal(env.readCount(), 1)
    env.unmount(); const writes = env.writes.length
    if (succeeds) read.resolve([calendar("private-old-list")]); else read.reject(new Error("late failure"))
    await flush()
    assert.equal(env.writes.length, writes); assert.equal(env.events.length, 1); assert.equal(env.timers.size, 0)
  }
})

test("an optional calendar read times out and a retry ignores the earlier native result", async () => {
  const old = deferred<any[]>(), current = deferred<any[]>(), env = picker({
    read: call => call === 1 ? old.promise : current.promise,
  })
  env.render(); env.commit(); await flush(); env.expire(); await flush()
  assert.match(env.writes.findLast(write => write[0] === 4)[1], /超时/)
  const action = retry(env.render()).props.action; action(); action(); await flush()
  assert.equal(env.readCount(), 2)
  old.resolve([calendar("old-result")]); await flush()
  assert.ok(!env.writes.some(write => write[0] === 1 && write[1].some((value: any) => value.id === "old-result")))
  current.resolve([calendar("new-result")]); await flush()
  assert.ok(row(env.render(), "new-result")); assert.equal(env.timers.size, 0)
})

test("a missing selected list cannot be saved until the user explicitly selects all or existing lists", async () => {
  const env = picker({ selected: ["missing"] })
  env.render(); env.commit(); await flush(); confirm(env.render()); await flush()
  assert.ok(env.events.some(event => event[0] === "alert" && event[1] === "无法保存列表选择"))
  assert.ok(!env.events.some(event => event[0] === "save"))
  all(env.render()).props.action(); confirm(env.render()); await flush()
  assert.ok(env.events.some(event => event[0] === "save" && event[1].length === 0))
})

test("accepted saves finish exactly once after exit without late alerts, UI writes or dismissal", async () => {
  for (const succeeds of [true, false]) {
    const save = deferred<void>(), env = picker({ selected: ["a"], save: () => save.promise })
    env.render(); env.commit(); await flush()
    const root = env.render(); confirm(root); confirm(root); await flush()
    const beforeSelection = env.writes.length
    all(root).props.action(); row(root, "a").props.action()
    assert.equal(env.writes.length, beforeSelection)
    env.unmount(); const writes = env.writes.length
    if (succeeds) save.resolve(); else save.reject(new Error("late failure"))
    await flush(); confirm(root)
    assert.equal(env.events.filter(event => event[0] === "save").length, 1)
    assert.equal(env.events.includes("save-finished"), succeeds)
    assert.ok(!env.events.includes("dismiss")); assert.ok(!env.events.some(event => event[0] === "alert"))
    assert.equal(env.writes.length, writes)
  }
})

test("active save failure keeps selection and permits an explicit retry without duplicating the first write", async () => {
  const env = picker({ selected: ["a"], save: async (_ids, call) => { if (call === 1) throw new Error("save failed") } })
  env.render(); env.commit(); await flush(); confirm(env.render()); await flush()
  assert.ok(env.events.some(event => event[0] === "alert" && event[1] === "列表设置保存失败"))
  assert.ok(!env.events.includes("dismiss"))
  assert.equal(row(env.render(), "a").children[0].props.selected, true)
  confirm(env.render()); await flush()
  assert.equal(env.events.filter(event => event[0] === "save").length, 2)
  assert.equal(env.events.filter(event => event === "dismiss").length, 1)
})
