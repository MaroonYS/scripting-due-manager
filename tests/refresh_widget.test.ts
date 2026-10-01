// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { nextWidgetRefresh } from "../到期管家/src/reminders.ts"

const read = (path: string) => readFileSync(new URL(`../到期管家/${path}`, import.meta.url), "utf8")
const stripped = (value: string) => value.replace(/^import[\s\S]*?from\s+"[^"]+"\s*\n/gm, "").replace(/^export /gm, "")
const transpile = (value: string) => new Bun.Transpiler({ loader: "tsx", tsconfig: {
  compilerOptions: { jsx: "react", jsxFactory: "h" },
} }).transformSync(value)
const h = (type: any, props: any, ...children: any[]) => ({ type, props, children })
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }

test("optional widget feedback failures keep successfully loaded items and request a recovery timeline", async () => {
  const records: any[] = [], items = [{ id: "manual-item" }]
  const bindings = {
    h, Device: {}, Text: "Text", VStack: "VStack", DueManagerWidget: "DueManagerWidget",
    configureWidgetLocale: () => {}, currentWidgetLocale: () => "zh-Hans", widgetText: () => "error",
    Script: { exit: () => records.push("exit") }, Widget: { present: (...args: any[]) => records.push(args) },
    loadWidgetData: async () => ({ state: { settings: { includeReminders: true } }, items,
      reminderResult: { fetchedAt: 1, live: false, fromCache: true, error: "timeout" } }),
    readWidgetCompletionTransition: () => { throw Error("feedback storage unavailable") },
    readWidgetActionError: () => { throw Error("status storage unavailable") }, nextWidgetRefresh,
  }
  const source = stripped(read("widget.tsx")).split("\nmain().catch")[0]
  const main = new Function(...Object.keys(bindings), transpile(source) + "\nreturn main")(...Object.values(bindings))
  const before = Date.now(); await main()
  assert.equal(records[0][0].type, "DueManagerWidget")
  assert.equal(records[0][0].props.items, items)
  assert.equal(records[0][0].props.completionGeneration, 0)
  assert.equal(records[0][0].props.interactionError, null)
  assert.equal(records[0][1].policy, "after")
  assert.ok(records[0][1].date.getTime() > before)
  assert.ok(records[0][1].date.getTime() <= Date.now() + 5 * 60 * 1000)
})

test("a genuine widget data failure stays visible and receives an explicit short retry", async () => {
  const records: any[] = []
  const bindings = {
    h, Device: {}, Text: "Text", VStack: "VStack", configureWidgetLocale: () => {}, currentWidgetLocale: () => "en",
    widgetText: (value: string) => value, Script: { exit: () => records.push("exit") },
    Widget: { present: (...args: any[]) => records.push(args) }, console: { error: () => {} },
    loadWidgetData: async () => { throw Error("damaged state") },
  }
  const before = Date.now()
  new Function(...Object.keys(bindings), transpile(stripped(read("widget.tsx"))))(...Object.values(bindings))
  await flush()
  assert.equal(records[0][0].type, "VStack")
  assert.equal(records[0][1].policy, "after")
  assert.ok(records[0][1].date.getTime() >= before + 5 * 60 * 1000)
  assert.equal(records[1], "exit")
})

test("unsupported scoped reload falls back to the native all-widget request", async () => {
  for (const [scoped, expected] of [[undefined, 1], [async () => { throw Error("unsupported") }, 1], [async () => {}, 0]] as const) {
    let all = 0
    const Widget = { reloadUserWidgets: scoped, reloadAll: () => { all++ } }
    const reload = new Function("Widget", transpile(stripped(read("src/widget_refresh.ts"))) + "\nreturn reloadUserWidgets")(Widget)
    await reload()
    assert.equal(all, expected)
  }
})

test("a reminder notes tap resumes an already-open main instance with its exact destination", async () => {
  let resume!: (details: any) => void, close!: () => void, detached = false
  const presented: any[] = []
  const bindings = {
    h, NavigationStack: "NavigationStack",
    Script: { queryParameters: {}, onResume: (callback: any) => { resume = callback; return () => { detached = true } }, exit: () => {} },
    Navigation: { present: ({ element }: any) => {
      presented.push(element)
      return presented.length === 1 ? new Promise<void>(resolve => { close = resolve }) : Promise.resolve()
    } },
    loadReminderNotes: async () => ({ ReminderNotesView: "ReminderNotesView" }),
    Dialog: { alert: async () => assert.fail("unexpected routing failure") },
  }
  const source = stripped(read("index.tsx")).replace('await import("./src/reminder_notes_view")', "await loadReminderNotes()")
    .replace(/^void run\(\)\s*$/m, "")
  const run = new Function(...Object.keys(bindings), transpile(source) + "\nreturn run")(...Object.values(bindings))
  const active = run(); await flush()
  resume({ queryParameters: { action: "reminder-notes", id: "selected-from-widget" } }); await flush()
  assert.equal(presented[1].children[0].type, "ReminderNotesView")
  assert.equal(presented[1].children[0].props.id, "selected-from-widget")
  close(); await active; assert.equal(detached, true)
  resume({ queryParameters: { action: "open-reminder", id: "after-close" } }); await flush()
  assert.equal(presented.length, 2)
})
