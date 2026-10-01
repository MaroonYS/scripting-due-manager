// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (file: string) => readFileSync(new URL(`../到期管家/src/${file}`, import.meta.url), "utf8")
const transpile = (source: string) => new Bun.Transpiler({ loader: "ts" }).transformSync(source)
const withoutImports = (source: string) => source.replace(/^import[\s\S]*?from\s+"[^"]+"\s*\n/gm, "").replace(/^export /gm, "")
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
function helper(operation: (items: unknown[], options: unknown) => Promise<any>) {
  const timers = new Map<number, { callback: () => void; milliseconds: number }>()
  let sequence = 0
  const bindings = {
    reconcileNotifications: operation,
    setTimeout: (callback: () => void, milliseconds: number) => {
      const id = ++sequence; timers.set(id, { callback, milliseconds }); return id
    },
    clearTimeout: (id: number) => timers.delete(id),
  }
  const maintain = new Function(...Object.keys(bindings), transpile(withoutImports(read("notification_maintenance.ts")))
    + "\nreturn maintainNotificationsWithBudget")(...Object.values(bindings))
  return { maintain, timers, expire: () => {
    const [id, timer] = [...timers][0]; timers.delete(id); timer.callback()
  } }
}

test("notification UI budget returns a timely status and calls the worker exactly once", async () => {
  const status = { state: "ready" }, options = { maxNewRequests: 3, leaseWaitMs: 0 }
  const calls: unknown[][] = []
  const env = helper(async (...args) => { calls.push(args); return status })
  const pending = env.maintain(options)
  assert.equal([...env.timers.values()][0].milliseconds, 1500)
  assert.equal(await pending, status)
  assert.deepEqual(calls, [[[], options]])
  assert.equal(env.timers.size, 0)
})

test("stopping UI wait neither cancels nor repeats a notification worker or its late write", async () => {
  const write = deferred<any>(), events: string[] = []
  const env = helper(async () => {
    events.push("write-started")
    const status = await write.promise
    events.push("write-finished")
    return status
  })
  const pending = env.maintain({}, 1500)
  await flush(); env.expire()
  assert.equal(await pending, null)
  assert.deepEqual(events, ["write-started"])
  write.resolve({ state: "ready" }); await flush()
  assert.deepEqual(events, ["write-started", "write-finished"])
  assert.equal(env.timers.size, 0)
})

test("late notification rejection is consumed after the UI budget expires", async () => {
  const worker = deferred<any>(), calls: unknown[][] = []
  const env = helper(async (...args) => { calls.push(args); return worker.promise })
  const pending = env.maintain()
  await flush(); env.expire()
  assert.equal(await pending, null)
  worker.reject(new Error("late native failure")); await flush()
  assert.equal(calls.length, 1)
  assert.equal(env.timers.size, 0)
})

test("an immediate notification failure remains an explicit failure and clears the UI timer", async () => {
  const env = helper(async () => { throw new Error("read failed") })
  await assert.rejects(env.maintain(), /read failed/)
  assert.equal(env.timers.size, 0)
})

function savedDataMaintenance(status: any, failRefresh = false, failWorker = false) {
  const events: unknown[] = [], items = [{ id: "fresh" }]
  const bindings = {
    reloadWidgetsAfterStorageWrite: async () => { events.push("refresh"); if (failRefresh) throw new Error("refresh failed") },
    maintainNotificationsWithBudget: async (options: any) => {
      events.push(["notifications", options.maxNewRequests, options.leaseWaitMs, options.loadItems()])
      if (failWorker) throw new Error("worker failed")
      return status
    },
    loadState: () => ({ items }), console: { error: () => {} },
  }
  const maintain = new Function(...Object.keys(bindings), transpile(withoutImports(read("maintenance.ts")))
    + "\nreturn refreshAfterDataChange")(...Object.values(bindings))
  return { events, items, maintain }
}

test("saved data refreshes before bounded notification upkeep and reports deferred work gently", async () => {
  const env = savedDataMaintenance(null)
  assert.equal(await env.maintain(), "通知仍在更新，可在「通知与提醒」查看。")
  assert.deepEqual(env.events, ["refresh", ["notifications", 3, 0, env.items]])
  const ready = savedDataMaintenance({ state: "ready" })
  assert.equal(await ready.maintain(), null)
})

test("notification failures and refresh failures remain warnings after data was saved", async () => {
  for (const state of ["error", "unavailable"]) {
    const env = savedDataMaintenance({ state })
    assert.match(await env.maintain(), /通知安排未完成/)
  }
  const failed = savedDataMaintenance(null, true, true)
  const warning = await failed.maintain()
  assert.match(warning, /无需重复保存事项/)
  assert.match(warning, /通知安排未完成/)
  assert.equal(failed.events.length, 2)
})
