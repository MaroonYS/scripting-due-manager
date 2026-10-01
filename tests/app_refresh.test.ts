// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (file: string) => readFileSync(new URL(`../到期管家/${file}`, import.meta.url), "utf8")
const withoutImports = (source: string) => source.replace(/^import[\s\S]*?from\s+"[^"]+"\s*\n/gm, "").replace(/^export /gm, "")
const transpile = (source: string) => new Bun.Transpiler({ loader: "tsx", tsconfig: {
  compilerOptions: { jsx: "react", jsxFactory: "h" },
} }).transformSync(source)
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve() }
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

function clock() {
  let sequence = 0
  const timers = new Map<number, { callback: () => void; milliseconds: number }>()
  return {
    timers,
    setTimeout: (callback: () => void, milliseconds: number) => {
      const id = ++sequence; timers.set(id, { callback, milliseconds }); return id
    },
    clearTimeout: (id: number) => { timers.delete(id) },
    fire: (predicate: (milliseconds: number) => boolean) => {
      const timer = [...timers].find(([, value]) => predicate(value.milliseconds))
      assert.ok(timer, "expected a scheduled callback")
      timers.delete(timer[0]); timer[1].callback()
    },
  }
}

function nativeLifecycle() {
  const scenes = new Set<(phase: string) => void>(), resumes = new Set<(details: any) => void>()
  const events: string[] = []
  return {
    scenes, resumes, events,
    runtime: {
      AppEvents: { scenePhase: {
        addListener: (listener: (phase: string) => void) => { events.push("scene-add"); scenes.add(listener) },
        removeListener: (listener: (phase: string) => void) => { events.push("scene-remove"); assert.ok(scenes.delete(listener)) },
      } },
      Script: { onResume: (listener: (details: any) => void) => {
        events.push("resume-add"); resumes.add(listener)
        return () => { events.push("resume-remove"); resumes.delete(listener) }
      } },
    },
    phase: (value: string) => { for (const listener of [...scenes]) listener(value) },
    resume: (details: any = {}) => { for (const listener of [...resumes]) listener(details) },
  }
}

function lifecycleObserver(timing: ReturnType<typeof clock>, globals: any = {}) {
  const bindings = { Scripting: {}, globalThis: globals, setTimeout: timing.setTimeout, clearTimeout: timing.clearTimeout }
  return new Function(...Object.keys(bindings), transpile(withoutImports(read("src/app_refresh.ts")))
    + "\nreturn observeApplicationRefresh")(...Object.values(bindings))
}

test("foreground refresh ignores permission-panel inactivity and coalesces resume with background return", () => {
  const timing = clock(), native = nativeLifecycle(), phases: boolean[] = []
  let count = 0
  const stop = lifecycleObserver(timing)(() => count++, (value: boolean) => phases.push(value), native.runtime)
  native.phase("inactive"); native.phase("active")
  assert.equal(timing.timers.size, 0)
  native.phase("background"); native.phase("inactive"); native.phase("active")
  native.resume(); native.resume()
  assert.equal(timing.timers.size, 1)
  timing.fire(milliseconds => milliseconds === 0)
  assert.equal(count, 1)
  assert.equal(phases[0], false); assert.equal(phases.at(-1), true)
  stop(); assert.equal(native.scenes.size, 0); assert.equal(native.resumes.size, 0)
})

test("closing a foreground observer cancels scheduled work and detaches both native subscriptions", () => {
  const timing = clock(), native = nativeLifecycle()
  let count = 0
  const stop = lifecycleObserver(timing)(() => count++, undefined, native.runtime)
  native.resume(); assert.equal(timing.timers.size, 1)
  const delayed = [...timing.timers.values()][0].callback
  stop(); delayed(); native.phase("background"); native.phase("active"); native.resume()
  assert.equal(count, 0); assert.equal(timing.timers.size, 0)
  assert.deepEqual(native.events, ["scene-add", "resume-add", "scene-remove", "resume-remove"])
})

test("older hosts can use the global lifecycle API or retain manual refresh without optional APIs", () => {
  const timing = clock(), native = nativeLifecycle()
  let count = 0
  const stop = lifecycleObserver(timing)(() => count++, undefined, {})
  stop(); assert.equal(count, 0); assert.equal(timing.timers.size, 0)
  const stopGlobal = lifecycleObserver(timing, { AppEvents: native.runtime.AppEvents })(() => count++, undefined, {})
  native.phase("background"); native.phase("active"); timing.fire(milliseconds => milliseconds === 0)
  assert.equal(count, 1); stopGlobal()
})

test("a surviving entry routes new and legacy notes URLs while the refresh observer preserves their destination", async () => {
  const timing = clock(), native = nativeLifecycle(), main = deferred<void>(), events: any[] = []
  let refreshes = 0
  const h = (type: any, props: any, ...children: any[]) => ({ type: typeof type === "function" ? type.name : type, props, children })
  const bindings = {
    h, NavigationStack: "NavigationStack",
    Script: { ...native.runtime.Script, queryParameters: {}, exit: () => events.push("exit") },
    Navigation: { present: async ({ element }: any) => {
      if (element.type === "StartupScreen") { events.push("main"); return main.promise }
      assert.equal(element.type, "NavigationStack")
      assert.equal(element.children[0].type, "ReminderNotesView")
      events.push(["notes", element.children[0].props.id])
    } },
    loadReminderNotes: async () => ({ ReminderNotesView: "ReminderNotesView" }),
    loadApplication: () => assert.fail("a resume route must not create another main app"),
    Dialog: { alert: async () => assert.fail("route should not fail") },
  }
  const source = withoutImports(read("index.tsx"))
    .replace('await import("./src/reminder_notes_view")', "await loadReminderNotes()")
    .replace('import("./src/app")', "loadApplication()")
    .replace(/^void run\(\)\s*$/m, "")
  const run = new Function(...Object.keys(bindings), transpile(source) + "\nreturn run")(...Object.values(bindings))
  const running = run()
  const stop = lifecycleObserver(timing)(() => refreshes++, undefined, native.runtime)
  for (const action of ["reminder-notes", "open-reminder"]) {
    native.resume({ queryParameters: { action, id: action } }); await flush()
  }
  assert.deepEqual(events, ["main", ["notes", "reminder-notes"], ["notes", "open-reminder"]])
  assert.equal(refreshes, 0); assert.equal(timing.timers.size, 0)
  native.resume({ queryParameters: { action: "refresh" } })
  timing.fire(milliseconds => milliseconds === 0); assert.equal(refreshes, 1)
  main.resolve(); await running; stop()
  native.resume({ queryParameters: { action: "reminder-notes", id: "closed" } }); await flush()
  assert.equal(native.resumes.size, 0); assert.equal(events.at(-1), "exit")
})

const state = (includeReminders = true, calendarIDs: string[] = []) => ({
  items: [{ id: "manual-original", enabled: true }],
  settings: { includeReminders, reminderHorizonDays: 730, reminderCalendarIDs: calendarIDs },
})
const result = (id = "reminder", count = 1) => ({ items: Array.from({ length: count }, () => ({ id })), fetchedAt: 10,
  live: true, fromCache: false, error: null })

function application(initial = state(), options: {
  load?: (horizon: number, ids: string[], call: number) => Promise<any>
  access?: () => Promise<string[]>
} = {}) {
  let persisted: any = initial, cursor = 0, loadCount = 0, readCount = 0
  const timing = clock(), native = nativeLifecycle(), cells: any[] = [], effects: (() => void)[] = []
  const stateWrites: any[] = [], statusWrites: any[] = [], queries: any[] = [], mutations: any[] = [], events: any[] = []
  const observer = lifecycleObserver(timing)
  const bindings = {
    Navigation: { useDismiss: () => () => events.push("dismiss") },
    loadState: () => { readCount++; return structuredClone(persisted) },
    createDraftItem: () => ({ id: "draft" }),
    loadReminderItems: (horizon: number, ids: string[]) => {
      queries.push([horizon, [...ids]])
      return options.load?.(horizon, ids, ++loadCount) ?? Promise.resolve(result())
    },
    updateSettings: (patch: any) => {
      mutations.push(patch); persisted = { ...persisted, settings: { ...persisted.settings, ...patch } }; return persisted
    },
    clearReminderSnapshot: () => events.push("cache-clear"),
    refreshWidgetsWithWarning: async () => { events.push("reload") },
    reloadWidgetsAfterStorageWrite: async () => { events.push("reload") },
    observeApplicationRefresh: (refresh: () => void, foreground: (value: boolean) => void) => observer(refresh, foreground, native.runtime),
    manualItemsForDisplay: (value: any) => value.items,
    nextWidgetRefresh: () => new Date(Date.now() + 4000),
    setTimeout: timing.setTimeout, clearTimeout: timing.clearTimeout,
    Script: { requestAccess: () => options.access?.() ?? Promise.resolve(["calendar", "reminders"]) },
    Dialog: { alert: async (value: any) => { events.push(["alert", value.title]) } }, console: { error: () => {} },
    useState: (initialValue: any) => {
      const index = cursor++
      if (!cells[index]) cells[index] = { value: typeof initialValue === "function" ? initialValue() : initialValue }
      return [cells[index].value, (value: any) => {
        cells[index].value = typeof value === "function" ? value(cells[index].value) : value
        if (index === 0) stateWrites.push(cells[index].value)
        if (index === 2) statusWrites.push(cells[index].value)
      }]
    },
    useEffect: (effect: () => any, deps: any[]) => {
      const index = cursor++, previous = cells[index]
      if (previous && previous.deps.length === deps.length && deps.every((value, i) => value === previous.deps[i])) return
      previous?.cleanup?.(); cells[index] = { deps }
      effects.push(() => { cells[index].cleanup = effect() })
    },
  }
  const source = read("src/app.tsx")
  const constants = source.slice(source.indexOf("const EMPTY_REMINDER_STATUS"), source.indexOf("function recurrenceIntervalUnitLabel"))
  const start = source.indexOf("function DueManagerApp()"), end = source.indexOf("  const { overdueItems, needsActionItems, upcomingItems, inactiveItems } = groupManualItems(state)", start)
  assert.ok(start > 0 && end > start)
  // Keep every real callback and effect; omit only the unrelated rendered rows.
  const callbacks = source.slice(start, end) + "\nreturn { refreshReminders, setReminderIntegration, setReminderCalendarSelection, reminderRequests }; }"
  const main = new Function(...Object.keys(bindings), transpile(constants + callbacks) + "\nreturn DueManagerApp")(...Object.values(bindings))
  return {
    timing, native, stateWrites, statusWrites, queries, mutations, events,
    render: () => { cursor = 0; return main() },
    commit: () => { while (effects.length) effects.shift()!() },
    unmount: () => { for (const cell of cells) cell?.cleanup?.() },
    persisted: () => persisted, setPersisted: (value: any) => { persisted = value },
    displayed: () => cells[0].value, status: () => cells[2].value,
    reads: () => readCount,
  }
}

test("foreground synchronization reads the latest manual state before and after a native Reminder query", async () => {
  const pending = deferred<any>(), env = application(state(), {
    load: (_horizon, _ids, call) => call === 2 ? pending.promise : Promise.resolve(result()),
  })
  env.render(); env.commit(); await flush()
  const reads = env.reads(), reloads = env.events.filter(value => value === "reload").length
  const beforeQuery = { ...env.persisted(), items: [{ id: "added-elsewhere", enabled: true }] }
  env.setPersisted(beforeQuery)
  env.native.phase("background"); env.native.phase("active"); env.timing.fire(milliseconds => milliseconds === 0)
  assert.equal(env.reads(), reads + 1); assert.deepEqual(env.displayed(), beforeQuery)
  const afterQuery = { ...env.persisted(), items: [{ id: "completed-elsewhere", enabled: false }] }
  env.setPersisted(afterQuery); pending.resolve(result()); await flush()
  assert.equal(env.reads(), reads + 2); assert.deepEqual(env.displayed(), afterQuery)
  assert.equal(env.status().count, 1)
  assert.equal(env.events.filter(value => value === "reload").length, reloads + 1)
  env.unmount()
})

test("an external list-scope change during a native query discards old status and reads the new scope", async () => {
  const old = deferred<any>(), fresh = deferred<any>()
  const env = application(state(true, ["old"]), { load: (_horizon, _ids, call) => call === 1 ? old.promise : fresh.promise })
  env.render(); env.commit()
  env.setPersisted(state(true, ["new"]))
  old.resolve(result("old-private-scope", 4)); await flush()
  assert.deepEqual(env.queries, [[730, ["old"]], [730, ["new"]]])
  assert.ok(!env.statusWrites.some(value => value.count === 4))
  assert.equal(env.events.filter(value => value === "reload").length, 0)
  fresh.resolve(result("new-scope", 2)); await flush()
  assert.deepEqual(env.displayed().settings.reminderCalendarIDs, ["new"])
  assert.equal(env.status().count, 2); assert.equal(env.events.filter(value => value === "reload").length, 1)
  env.unmount()
})

test("returning from the background during authorization queues a refresh without cancelling the user's setting", async () => {
  const grant = deferred<string[]>(), env = application(state(false), { access: () => grant.promise })
  const app = env.render(); env.commit(); await flush()
  const enabling = app.setReminderIntegration(true), generation = app.reminderRequests.generation
  env.native.phase("background"); env.native.phase("active"); env.timing.fire(milliseconds => milliseconds === 0)
  assert.equal(app.reminderRequests.generation, generation)
  assert.equal(app.reminderRequests.settingsBusy, true); assert.equal(app.reminderRequests.queued, true)
  assert.equal(env.queries.length, 0)
  grant.resolve(["reminders"]); await enabling; await flush()
  assert.deepEqual(env.mutations, [{ includeReminders: true }])
  assert.equal(env.persisted().settings.includeReminders, true)
  assert.equal(env.queries.length, 2); assert.equal(app.reminderRequests.settingsBusy, false)
  env.unmount()
})

test("returning from the background while selecting lists preserves the new list and then synchronizes it", async () => {
  const selection = deferred<any>(), env = application(state(true, ["old"]), {
    load: (_horizon, _ids, call) => call === 2 ? selection.promise : Promise.resolve(result()),
  })
  const app = env.render(); env.commit(); await flush()
  const choosing = app.setReminderCalendarSelection(["selected"]), generation = app.reminderRequests.generation
  env.native.phase("background"); env.native.phase("active"); env.timing.fire(milliseconds => milliseconds === 0)
  assert.equal(app.reminderRequests.generation, generation)
  assert.deepEqual(env.queries, [[730, ["old"]], [730, ["selected"]]])
  selection.resolve(result()); await choosing; await flush()
  assert.deepEqual(env.mutations, [{ reminderCalendarIDs: ["selected"] }])
  assert.deepEqual(env.persisted().settings.reminderCalendarIDs, ["selected"])
  assert.deepEqual(env.queries.at(-1), [730, ["selected"]]); assert.equal(env.queries.length, 3)
  env.unmount()
})

test("closing the main screen invalidates a late read without writing state, status or a reload", async () => {
  const pending = deferred<any>(), env = application(state(), { load: () => pending.promise })
  env.render(); env.commit()
  const writes = [env.stateWrites.length, env.statusWrites.length], reads = env.reads()
  env.unmount(); pending.resolve(result()); await flush()
  assert.deepEqual([env.stateWrites.length, env.statusWrites.length], writes)
  assert.equal(env.reads(), reads); assert.deepEqual(env.events, [])
  assert.equal(env.timing.timers.size, 0); assert.equal(env.native.scenes.size, 0); assert.equal(env.native.resumes.size, 0)
})

test("closing during authorization or list selection prevents late callbacks from saving or changing UI state", async () => {
  const permission = deferred<string[]>(), enabling = application(state(false), { access: () => permission.promise })
  const app = enabling.render(); enabling.commit(); await flush()
  const operation = app.setReminderIntegration(true), writes = [enabling.stateWrites.length, enabling.statusWrites.length]
  enabling.unmount(); permission.resolve(["reminders"]); await operation; await flush()
  assert.deepEqual(enabling.mutations, [])
  assert.deepEqual([enabling.stateWrites.length, enabling.statusWrites.length], writes)
  const selected = deferred<any>(), selecting = application(state(), { load: (_horizon, _ids, call) => call === 2 ? selected.promise : Promise.resolve(result()) })
  const picker = selecting.render(); selecting.commit(); await flush()
  const selection = picker.setReminderCalendarSelection(["selected"])
  const beforeClose = [selecting.stateWrites.length, selecting.statusWrites.length]
  selecting.unmount(); selected.resolve(result()); await selection; await flush()
  assert.deepEqual(selecting.mutations, [])
  assert.deepEqual([selecting.stateWrites.length, selecting.statusWrites.length], beforeClose)
})

test("a time-boundary callback skips background work, while foreground return refreshes and re-arms it", async () => {
  const env = application(state(false)), app = env.render()
  env.commit(); await flush()
  const reads = env.reads(), reloads = env.events.length
  env.native.phase("background"); assert.equal(app.reminderRequests.foreground, false)
  env.timing.fire(milliseconds => milliseconds >= 1000); await flush()
  assert.equal(env.reads(), reads); assert.equal(env.events.length, reloads)
  env.native.phase("active"); env.timing.fire(milliseconds => milliseconds === 0); await flush()
  assert.equal(env.reads(), reads + 1); assert.equal(env.events.length, reloads + 1)
  env.render(); env.commit()
  assert.equal([...env.timing.timers.values()].filter(value => value.milliseconds >= 1000).length, 1)
  env.unmount(); assert.equal(env.timing.timers.size, 0)
})
