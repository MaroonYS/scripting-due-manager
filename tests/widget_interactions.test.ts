// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { openReminderFromWidget } from "../到期管家/src/reminder_navigation.ts"
import { localizeWidgetActionError } from "../到期管家/src/widget_localization.ts"

const UUID = "8ec3f3ed-7ba0-44e1-88ba-b9c9e4022a9d"
const read = (file: string) => readFileSync(new URL(`../到期管家/${file}`, import.meta.url), "utf8")
const transpile = (source: string) => new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } }).transformSync(source)
const withoutImports = (source: string) => source.replace(/^import[\s\S]*?from\s+"[^"]+"\s*\n/gm, "").replace(/^export /gm, "")
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }

function navigationEnvironment(reminder: any, success = true) {
  const previous = { Reminder: (globalThis as any).Reminder, Safari: (globalThis as any).Safari }
  const events: any[] = []
  ;(globalThis as any).Reminder = { get: async (id: string) => { events.push(["get", id]); return reminder } }
  ;(globalThis as any).Safari = { openURL: async (url: string) => { events.push(["open", url]); return success } }
  return { events, cleanup: () => Object.assign(globalThis, previous) }
}

test("foreground Reminder navigation looks up the exact item and opens only its canonical URL", async () => {
  const reminder = { identifier: UUID, title: "Keep", notes: "https://malicious.example/never-open", isCompleted: false, save: () => assert.fail("must not save") }
  const env = navigationEnvironment(reminder)
  try {
    await openReminderFromWidget(UUID)
    assert.deepEqual(env.events, [["get", UUID], ["open", `x-apple-reminderkit://REMCDReminder/${UUID.toUpperCase()}`]])
    assert.equal(reminder.isCompleted, false)
    assert.equal(reminder.title, "Keep")
  } finally { env.cleanup() }
})

test("invalid, missing and unsupported Reminder IDs never fall back to another item or the app homepage", async () => {
  const invalid = navigationEnvironment({ identifier: UUID })
  try {
    for (const id of [null, "", "x".repeat(513), "bad\nvalue"]) await assert.rejects(openReminderFromWidget(id), /标识无效/)
    assert.deepEqual(invalid.events, [])
  } finally { invalid.cleanup() }
  for (const reminder of [null, { identifier: "unsupported-calendar-id", notes: `x-apple-reminder://${UUID}` }]) {
    const env = navigationEnvironment(reminder)
    try { await assert.rejects(openReminderFromWidget(UUID)); assert.deepEqual(env.events, [["get", UUID]]) }
    finally { env.cleanup() }
  }
})

test("a failed native open is an explicit failure, not a reported successful deep link", async () => {
  const env = navigationEnvironment({ identifier: UUID }, false)
  try { await assert.rejects(openReminderFromWidget(UUID), /系统未能打开/); assert.equal(env.events.length, 2) }
  finally { env.cleanup() }
})

test("the real entry routes a widget navigation without loading the app, storage or maintenance", async () => {
  for (const fail of [false, true]) {
    const events: any[] = []
    const bindings = {
      Script: { queryParameters: { action: "open-reminder", id: UUID }, exit: () => events.push("exit") },
      loadReminderNavigation: async () => ({ openReminderFromWidget: async (id: string) => { events.push(["open", id]); if (fail) throw Error("denied") } }),
      loadApplication: () => assert.fail("must not load main app"),
      Navigation: { present: () => assert.fail("must not mount main app") },
      Dialog: { alert: async (value: any) => events.push(["alert", value.title]) },
    }
    const source = withoutImports(read("index.tsx"))
      .replace('await import("./src/reminder_navigation")', "await loadReminderNavigation()")
      .replace('import("./src/app")', "loadApplication()")
      .replace(/^void run\(\)\s*$/m, "")
    const run = new Function(...Object.keys(bindings), `${transpile(source)}\nreturn run`)(...Object.values(bindings))
    await run()
    assert.deepEqual(events, [["open", UUID], ...(fail ? [["alert", "无法打开对应提醒事项"]] : []), "exit"])
  }
})

function intentHarness(result: string | ((id: string, key: string) => Promise<string>), feedback: any = null) {
  const events: any[] = [], registered: Record<string, any> = {}
  const bindings = {
    Device: {}, configureWidgetLocale: () => {}, AppIntentProtocol: { AppIntent: "AppIntent" },
    AppIntentManager: { register: (definition: any) => { registered[definition.name] = definition; return (params: any) => ({ name: definition.name, params }) } },
    findManualDisplayItemForCompletion: () => feedback, findReminderDisplayItemForCompletion: () => feedback,
    completeManualOccurrence: (id: string, key: string) => { events.push(["manual", id, key]); return result },
    completeReminderOccurrence: async (id: string, key: string) => { events.push(["reminder", id, key]); return typeof result === "function" ? result(id, key) : result },
    clearWidgetActionError: () => events.push("clear"), writeWidgetActionError: (message: string) => events.push(["warning", message]),
    writeWidgetCompletionFeedback: (item: any) => { events.push(["feedback", item]); return true },
    reloadWidgetsAfterStorageWrite: async () => events.push("reload"), reloadUserWidgets: async () => {},
    reconcileNotifications: async () => events.push("notifications"), loadState: () => ({ items: [] }),
    console: { error: () => {} },
  }
  new Function(...Object.keys(bindings), transpile(withoutImports(read("app_intents.tsx"))))(...Object.values(bindings))
  return { events, perform: registered.CompleteDueItem.perform }
}

test("applied widget completion uses the exact source and occurrence, then refreshes before optional maintenance", async () => {
  for (const source of ["manual", "reminder"]) {
    const feedback = { canComplete: true, id: "exact" }, env = intentHarness("applied", feedback)
    await env.perform({ source, id: "exact", occurrenceKey: "date:2026-09-30" })
    assert.deepEqual(env.events, [[source, "exact", "date:2026-09-30"], "clear", ["feedback", feedback], "reload", "notifications"])
  }
})

test("stale, missing and cache-warning completion outcomes are visible and never claim another completion", async () => {
  for (const result of ["stale", "missing", "appliedCacheStale"]) {
    const env = intentHarness(result)
    await env.perform({ source: "reminder", id: UUID, occurrenceKey: "date:2026-09-30" })
    const warning = env.events.find(event => Array.isArray(event) && event[0] === "warning")?.[1]
    assert.ok(warning)
    assert.notEqual(localizeWidgetActionError(warning, "en-US"), "The last action needs attention; open Due Manager to check")
    assert.equal(env.events.filter(event => event === "reload").length, 1)
    assert.ok(!env.events.some(event => Array.isArray(event) && event[0] === "feedback"))
  }
})

test("readonly and invalid widget actions never reach a mutation; complete identifiers up to 512 chars are preserved", async () => {
  for (const [params, feedback] of [
    [{ source: "reminder", id: UUID, occurrenceKey: "date:2026-09-30" }, { canComplete: false }],
    [{ source: "reminder", id: "x".repeat(513), occurrenceKey: "date:2026-09-30" }, null],
    [{ source: "other", id: UUID, occurrenceKey: "date:2026-09-30" }, null],
  ]) {
    const env = intentHarness("applied", feedback)
    await env.perform(params)
    assert.ok(!env.events.some(event => Array.isArray(event) && ["manual", "reminder"].includes(event[0])))
    assert.ok(env.events.includes("reload"))
  }
  const env = intentHarness("missing"), id = "x".repeat(512)
  await env.perform({ source: "reminder", id, occurrenceKey: "date:2026-09-30" })
  assert.deepEqual(env.events[0], ["reminder", id, "date:2026-09-30"])
})

test("rapid widget taps are serialized without substituting the next occurrence", async () => {
  let release!: () => void, count = 0
  const gate = new Promise<void>(resolve => { release = resolve })
  const env = intentHarness(async () => { if (++count === 1) { await gate; return "applied" }; return "stale" })
  const params = { source: "reminder", id: UUID, occurrenceKey: "date:2026-09-30" }
  const first = env.perform(params), second = env.perform(params)
  await flush(); assert.equal(count, 1)
  release(); await Promise.all([first, second])
  assert.equal(count, 2)
  assert.deepEqual(env.events.filter(event => Array.isArray(event) && event[0] === "reminder"), [["reminder", UUID, params.occurrenceKey], ["reminder", UUID, params.occurrenceKey]])
  assert.ok(env.events.some(event => Array.isArray(event) && event[0] === "warning" && event[1].includes("未完成其他期次")))
})

test("widget controls use occurrence identity rather than slot position and give the label the whole hit region", () => {
  const source = read("src/widget_view.tsx")
  const identity = source.slice(source.indexOf("function widgetItemIdentity"))
  const identify = new Function(`${transpile(identity)}\nreturn widgetItemIdentity`)()
  const old = { source: "reminder", id: "a", completionKey: "date:2026-09-30" }
  assert.notEqual(identify(old), identify({ ...old, id: "b" }))
  assert.notEqual(identify(old), identify({ ...old, completionKey: "date:2026-10-30" }))
  assert.notEqual(identify(old), identify({ ...old, source: "manual" }))
  assert.doesNotMatch(source, /queue-slot-/)
  const completion = source.slice(source.indexOf("function ListCompletionIcon"), source.indexOf("function ListCompletionSymbol"))
  assert.match(completion, /<Label[\s\S]*?frame=\{\{ width: hitSize, height: hitSize \}\}\s+contentShape="rect"/)
  assert.doesNotMatch(completion, /<Link|onTapGesture|open-reminder/)
  assert.match(source, /action: "open-reminder", id: item.id/)
  assert.doesNotMatch(source, /return appleReminderDeepLink|APPLE_REMINDERS_URL/)
})
