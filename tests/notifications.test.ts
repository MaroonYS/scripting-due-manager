import assert from "node:assert/strict"
import test from "node:test"
import { actionTimestamp, advanceManualItem, createRecurrenceRule, dueStatus, isOccurrenceInFuture } from "../到期管家/src/date.ts"
import {
  defaultNotificationSettings,
  loadNotificationSettings,
  loadNotificationStatus,
  MAX_APP_PENDING_BUDGET,
  MAX_OWN_PENDING_NOTIFICATIONS,
  nextNotificationForItem,
  normalizeNotificationSettings,
  NOTIFICATION_DIRTY_KEY,
  NOTIFICATION_LOCK_KEY,
  NOTIFICATION_OWNER,
  NOTIFICATION_SETTINGS_KEY,
  planNotifications,
  reconcileNotifications,
  updateNotificationSettings,
} from "../到期管家/src/notifications.ts"
import type { NotificationRuntime, NotificationSettings, PlannedNotification } from "../到期管家/src/notifications.ts"
import type { ManualDueItem } from "../到期管家/src/types.ts"

const NOW = new Date(2026, 8, 1, 12, 0)
function item(patch: Partial<ManualDueItem> = {}): ManualDueItem {
  return { id: "test", title: "Test subscription", kind: "subscription", iconName: null,
    dueDate: "2026-09-30", includesTime: false, hour: 18, minute: 30, remindBeforeDays: 0,
    recurrence: null, amount: "", note: "", enabled: true, createdAt: 1, updatedAt: 1, ...patch }
}
function config(patch: Partial<NotificationSettings> = {}): NotificationSettings {
  return { ...defaultNotificationSettings(), enabled: true, ...patch }
}
function storage() {
  const values = new Map<string, unknown>()
  ;(globalThis as any).Storage = {
    get: (key: string) => values.get(key) ?? null,
    set: (key: string, value: unknown) => { values.set(key, value); return true },
    contains: (key: string) => values.has(key),
    remove: (key: string) => values.delete(key),
  }
  return values
}
function runtime() {
  let requests: any[] = []
  let sequence = 0
  const scheduled: PlannedNotification[] = []
  const cancelled: string[] = []
  const adapter: NotificationRuntime = {
    async getAllPendings() { return [...requests] },
    async removePendings(ids) { cancelled.push(...ids); requests = requests.filter(request => !ids.includes(request.identifier)) },
    async schedule(notification) {
      scheduled.push(notification)
      requests.push({ identifier: `request-${++sequence}`, content: { userInfo: {
        dueManagerOwner: NOTIFICATION_OWNER, dueManagerKey: notification.key,
      } } })
    },
  }
  return { adapter, scheduled, cancelled,
    get pending() { return requests },
    add(request: any) { requests.push(request) },
  }
}

test("timed advance action starts at midnight consistently across status, sorting and skip", () => {
  const early = item({ includesTime: true, remindBeforeDays: 3 })
  const midnight = new Date(2026, 8, 27, 0, 0)
  assert.equal(actionTimestamp(early), midnight.getTime())
  assert.equal(dueStatus(early, midnight).needsAction, true)
  assert.equal(isOccurrenceInFuture(early, early.dueDate, midnight), false)
  assert.equal(isOccurrenceInFuture(early, early.dueDate, new Date(midnight.getTime() - 1)), true)
  const recurring = { ...early, dueDate: "2026-08-30", recurrence: createRecurrenceRule("month", 1, "2026-08-30") }
  assert.equal(advanceManualItem(recurring, { skipToFuture: true, now: new Date(2026, 8, 27, 1) }).dueDate, "2026-10-30")
})

test("without advance a timed item becomes actionable at its actual deadline", () => {
  const timed = item({ includesTime: true })
  const deadline = new Date(2026, 8, 30, 18, 30)
  assert.equal(actionTimestamp(timed), deadline.getTime())
  assert.equal(dueStatus(timed, new Date(2026, 8, 30, 10)).needsAction, false)
  assert.equal(dueStatus(timed, deadline).needsAction, true)
  assert.equal(isOccurrenceInFuture(timed, timed.dueDate, deadline), false)
})

test("all-day action starts at midnight but isn't overdue until the following day", () => {
  const allDay = item()
  const midnight = new Date(2026, 8, 30)
  assert.equal(actionTimestamp({ ...allDay, dueTimestamp: new Date(2026, 8, 30, 23, 59).getTime() }), midnight.getTime())
  assert.equal(dueStatus(allDay, midnight).needsAction, true)
  assert.equal(dueStatus(allDay, new Date(2026, 8, 30, 23, 59)).overdue, false)
  assert.equal(dueStatus(allDay, new Date(2026, 9, 1)).overdue, true)
})

test("notification settings default off and malformed time values are normalized", () => {
  storage()
  assert.equal(loadNotificationSettings().enabled, false)
  const normalized = normalizeNotificationSettings({ enabled: 1, hour: 25, minute: -1, mutedItemIDs: ["a", "a", 1, ""] })
  assert.equal(normalized.enabled, false)
  assert.equal(normalized.hour, 9)
  assert.equal(normalized.minute, 0)
  assert.deepEqual(normalized.mutedItemIDs, ["a"])
  updateNotificationSettings({ enabled: true, hour: 8, minute: 45 })
  assert.equal(loadNotificationSettings().hour, 8)
})

test("date-only notifications use selected clock time; timed due notices preserve deadline", () => {
  const settings = config({ hour: 8, minute: 15 })
  assert.equal(nextNotificationForItem(item(), settings, NOW)?.fireAt, new Date(2026, 8, 30, 8, 15).getTime())
  assert.equal(nextNotificationForItem(item({ includesTime: true }), settings, NOW)?.fireAt, new Date(2026, 8, 30, 18, 30).getTime())
})

test("advance notifications use selected time and optionally notify again on actual due date", () => {
  const settings = config({ hour: 10, minute: 20, includeDueDate: true })
  const early = item({ includesTime: true, remindBeforeDays: 3 })
  const plan = planNotifications([early], settings, NOW)
  assert.deepEqual(plan.notifications.map(value => [value.kind, value.fireAt]), [
    ["action", new Date(2026, 8, 27, 10, 20).getTime()],
    ["due", new Date(2026, 8, 30, 18, 30).getTime()],
  ])
  assert.equal(early.dueDate, "2026-09-30")
})

test("non-advance notifications are not duplicated by also-notify-at-due option", () => {
  assert.equal(planNotifications([item()], config({ includeDueDate: true }), NOW).notifications.length, 1)
})

test("notification plan contains future recurrence dates with original month-end anchor", () => {
  const monthly = item({ dueDate: "2026-09-30", recurrence: createRecurrenceRule("month", 1, "2026-08-31") })
  const result = planNotifications([monthly], config(), NOW)
  assert.deepEqual(result.notifications.map(value => value.dueDate), ["2026-09-30", "2026-10-31", "2026-11-30"])
})

test("long advance windows don't omit nearer advance triggers from later occurrences", () => {
  const daily = item({ dueDate: "2026-09-01", remindBeforeDays: 30,
    recurrence: createRecurrenceRule("day", 1, "2026-09-01") })
  const result = planNotifications([daily], config({ includeDueDate: true }), NOW, 4)
  assert.deepEqual(result.notifications.map(value => value.fireAt), [
    new Date(2026, 8, 2, 9).getTime(), new Date(2026, 8, 2, 9).getTime(),
    new Date(2026, 8, 3, 9).getTime(), new Date(2026, 8, 3, 9).getTime(),
  ])
  assert.deepEqual(new Set(result.notifications.map(value => value.kind)), new Set(["action", "due"]))
})

test("plan is bounded and prioritizes nearest notifications across all items", () => {
  const items = Array.from({ length: 200 }, (_, index) => item({ id: String(index), dueDate: "2026-09-30" }))
  items.push(item({ id: "earliest", dueDate: "2026-09-02" }))
  const result = planNotifications(items, config(), NOW)
  assert.equal(result.notifications.length, MAX_OWN_PENDING_NOTIFICATIONS)
  assert.equal(result.notifications[0].itemID, "earliest")
  assert.equal(result.limited, true)
  assert.equal(result.plannedThrough, result.notifications.at(-1)?.fireAt)
})

test("disabled, muted, expired, duplicate and invalid items do not produce notifications", () => {
  const active = item()
  const result = planNotifications([
    item({ id: "disabled", enabled: false }), item({ id: "muted" }),
    item({ id: "expired", dueDate: "2026-09-01" }), item({ id: "invalid", dueDate: "bad" }), active, active,
  ], config({ mutedItemIDs: ["muted"] }), NOW)
  assert.equal(result.notifications.length, 1)
  assert.equal(planNotifications([active], defaultNotificationSettings(), NOW).notifications.length, 0)
})

test("reconciliation schedules once, preserves matching requests and cancels edits/deletes only", async () => {
  storage()
  const api = runtime()
  api.add({ identifier: "other-script", content: { userInfo: {} } })
  const options = { now: NOW, runtime: api.adapter, settings: config() }
  await reconcileNotifications([item()], options)
  await reconcileNotifications([item()], options)
  assert.equal(api.scheduled.length, 1)
  await reconcileNotifications([item({ title: "Changed" })], options)
  assert.equal(api.scheduled.length, 2)
  assert.deepEqual(api.cancelled, ["request-1"])
  await reconcileNotifications([], options)
  assert.equal(api.pending.length, 1)
  assert.equal(api.pending[0].identifier, "other-script")
})

test("completion rolls planned recurrence onward and undo restores the cancelled occurrence", async () => {
  storage()
  const api = runtime()
  const recurring = item({ recurrence: createRecurrenceRule("month", 1, "2026-09-30") })
  const options = { now: NOW, runtime: api.adapter, settings: config() }
  await reconcileNotifications([recurring], options)
  assert.equal(api.pending.length, 3)
  await reconcileNotifications([{ ...recurring, dueDate: "2026-10-30" }], options)
  assert.equal(api.pending.length, 2)
  await reconcileNotifications([recurring], options)
  assert.equal(api.pending.length, 3)
  assert.equal(api.scheduled.filter(value => value.dueDate === "2026-09-30").length, 2)
})

test("duplicate owned requests are cleaned without touching unrelated notifications", async () => {
  storage()
  const api = runtime()
  const planned = nextNotificationForItem(item(), config(), NOW)!
  for (const identifier of ["one", "two"]) api.add({ identifier, content: { userInfo: { dueManagerOwner: NOTIFICATION_OWNER, dueManagerKey: planned.key } } })
  await reconcileNotifications([item()], { now: NOW, runtime: api.adapter, settings: config() })
  assert.deepEqual(api.cancelled, ["two"])
  assert.equal(api.scheduled.length, 0)
})

test("disabling notifications cancels existing requests even when the status was lost", async () => {
  storage()
  const api = runtime()
  api.add({ identifier: "owned", content: { userInfo: { dueManagerOwner: NOTIFICATION_OWNER, dueManagerKey: "old" } } })
  const result = await reconcileNotifications([], { now: NOW, runtime: api.adapter, settings: defaultNotificationSettings() })
  assert.equal(result.state, "disabled")
  assert.deepEqual(api.cancelled, ["owned"])
})

test("other scripts' pending requests reduce our scheduling budget", async () => {
  storage()
  const api = runtime()
  for (let index = 0; index < MAX_APP_PENDING_BUDGET - 2; index++) api.add({ identifier: `other-${index}`, content: {} })
  const items = Array.from({ length: 10 }, (_, index) => item({ id: String(index) }))
  const result = await reconcileNotifications(items, { now: NOW, runtime: api.adapter, settings: config() })
  assert.equal(result.state, "limited")
  assert.equal(result.pendingCount, 2)
  assert.equal(api.cancelled.length, 0)
})

test("permission failure is persisted, remains retryable and never claims delivery authorization", async () => {
  storage()
  const api = runtime()
  const denied = { ...api.adapter, async schedule() { throw new Error("Notification access denied") } }
  const result = await reconcileNotifications([item()], { now: NOW, runtime: denied, settings: config() })
  assert.equal(result.state, "error")
  assert.match(result.message, /权限/)
  assert.equal(loadNotificationStatus()?.state, "error")
  const retried = await reconcileNotifications([item()], { now: NOW, runtime: api.adapter, settings: config() })
  assert.equal(retried.state, "ready")
  assert.match(retried.message, /实际横幅和声音仍取决于系统通知权限/)
})

test("unsupported Notification API returns an actionable result without crashing", async () => {
  storage()
  const result = await reconcileNotifications([item()], { now: NOW, runtime: null, settings: config() })
  assert.equal(result.state, "unavailable")
})

test("when today's chosen time passed, no retroactive alert is sent and status explains", async () => {
  storage()
  const api = runtime()
  const result = await reconcileNotifications([item({ dueDate: "2026-09-01" })], { now: NOW, runtime: api.adapter, settings: config() })
  assert.equal(api.scheduled.length, 0)
  assert.match(result.message, /已过的提醒不会补发/)
})

test("serialized concurrent reconciliation avoids duplicate requests", async () => {
  storage()
  const api = runtime()
  const options = { now: NOW, runtime: api.adapter, settings: config() }
  await Promise.all([reconcileNotifications([item()], options), reconcileNotifications([item()], options)])
  assert.equal(api.scheduled.length, 1)
})

test("failed storage writes are explicit; saved item workflows are not rejected", async () => {
  storage()
  ;(globalThis as any).Storage.set = () => false
  assert.throws(() => updateNotificationSettings({ enabled: true }), /未能保存/)
  const api = runtime()
  const result = await reconcileNotifications([item()], { now: NOW, runtime: api.adapter, settings: config() })
  assert.equal(result.state, "error")
  assert.match(result.message, /状态保存失败/)
})

test("notification settings are independent of the existing app data schema", () => {
  const values = storage()
  updateNotificationSettings({ enabled: true })
  assert.deepEqual([...values.keys()], [NOTIFICATION_SETTINGS_KEY])
})

test("the authoritative item callback replaces a stale widget snapshot before planning", async () => {
  storage()
  const api = runtime()
  await reconcileNotifications([item()], { now: NOW, runtime: api.adapter, settings: config(),
    loadItems: () => [item({ title: "Newest revision" })] })
  assert.equal(api.scheduled[0].title, "Newest revision")
})

test("a deletion during scheduling retries fresh state and removes the obsolete request", async () => {
  storage()
  const api = runtime()
  let items = [item()]
  const adapter = { ...api.adapter, async schedule(notification: PlannedNotification) {
    await api.adapter.schedule(notification)
    items = []
  } }
  const result = await reconcileNotifications([], { now: NOW, runtime: adapter, settings: config(), loadItems: () => items })
  assert.equal(result.state, "ready")
  assert.equal(result.pendingCount, 0)
  assert.equal(api.pending.length, 0)
  assert.equal(api.cancelled.length, 1)
})

test("turning notifications off during scheduling cancels the old request on retry", async () => {
  storage()
  updateNotificationSettings({ enabled: true })
  const api = runtime()
  const adapter = { ...api.adapter, async schedule(notification: PlannedNotification) {
    await api.adapter.schedule(notification)
    updateNotificationSettings({ enabled: false })
  } }
  const result = await reconcileNotifications([item()], { now: NOW, runtime: adapter })
  assert.equal(result.state, "disabled")
  assert.equal(api.pending.length, 0)
})

test("an interrupted run's expired lease is recovered and released", async () => {
  const values = storage()
  values.set(NOTIFICATION_LOCK_KEY, { token: "interrupted", expiresAt: 1 })
  const api = runtime()
  const result = await reconcileNotifications([item()], { now: NOW, runtime: api.adapter, settings: config() })
  assert.equal(result.state, "ready")
  assert.equal(values.has(NOTIFICATION_LOCK_KEY), false)
})

test("losing a shared lease stops system mutations and preserves the new owner's lease", async () => {
  const values = storage()
  const api = runtime()
  const adapter = { ...api.adapter, async getAllPendings() {
    values.set(NOTIFICATION_LOCK_KEY, { token: "other-owner", expiresAt: Date.now() + 30000 })
    return []
  } }
  const result = await reconcileNotifications([item()], { now: NOW, runtime: adapter, settings: config() })
  assert.equal(result.state, "error")
  assert.equal(api.scheduled.length, 0)
  assert.equal((values.get(NOTIFICATION_LOCK_KEY) as any).token, "other-owner")
})

test("unrecognized host pending requests still reduce notification capacity", async () => {
  storage()
  const api = runtime()
  for (let i = 0; i < MAX_APP_PENDING_BUDGET; i++) api.add({ unknownFormat: true })
  const result = await reconcileNotifications([item()], { now: NOW, runtime: api.adapter, settings: config() })
  assert.equal(result.state, "limited")
  assert.equal(api.scheduled.length, 0)
  assert.equal(api.cancelled.length, 0)
})

test("widget budget adds at most three requests and subsequent passes replenish the full plan", async () => {
  storage()
  const api = runtime()
  const items = Array.from({ length: 7 }, (_, i) => item({ id: `item-${i}` }))
  const options = { now: NOW, runtime: api.adapter, settings: config(), maxNewRequests: 3, leaseWaitMs: 0 }
  const first = await reconcileNotifications(items, options)
  assert.equal(first.state, "limited")
  assert.match(first.message, /还有 4 条等待下次/)
  assert.equal(api.scheduled.length, 3)
  assert.equal((await reconcileNotifications(items, options)).pendingCount, 6)
  const third = await reconcileNotifications(items, options)
  assert.equal(third.state, "ready")
  assert.equal(third.pendingCount, 7)
  assert.equal(api.scheduled.length, 7)
  assert.equal(api.cancelled.length, 0)
})

test("small widget budget retains later desired requests instead of treating them as obsolete", async () => {
  storage()
  const api = runtime()
  const items = Array.from({ length: 10 }, (_, i) => item({ id: `item-${i}` }))
  const full = planNotifications(items, config(), NOW).notifications
  for (const planned of full.slice(6)) await api.adapter.schedule(planned)
  const result = await reconcileNotifications(items, { now: NOW, runtime: api.adapter, settings: config(), maxNewRequests: 3 })
  assert.equal(result.pendingCount, 7)
  assert.equal(api.cancelled.length, 0)
  assert.equal(api.scheduled.length, 7)
  assert.equal(result.state, "limited")
})

test("zero new-request budget still cancels deleted items and preserves matching requests", async () => {
  storage()
  const api = runtime()
  await reconcileNotifications([item({ id: "keep" }), item({ id: "delete" })], { now: NOW, runtime: api.adapter, settings: config() })
  const result = await reconcileNotifications([item({ id: "keep" }), item({ id: "new" })], {
    now: NOW, runtime: api.adapter, settings: config(), maxNewRequests: 0,
  })
  assert.equal(result.pendingCount, 1)
  assert.equal(result.state, "limited")
  assert.equal(api.cancelled.length, 1)
  assert.equal(api.scheduled.length, 2)
})

test("new-request budget is shared across source-change retries", async () => {
  storage()
  const api = runtime()
  let items = Array.from({ length: 5 }, (_, i) => item({ id: `item-${i}` }))
  let changed = false
  const adapter = { ...api.adapter, async schedule(notification: PlannedNotification) {
    await api.adapter.schedule(notification)
    if (!changed) { changed = true; items = items.map(value => ({ ...value, title: "Changed" })) }
  } }
  const result = await reconcileNotifications([], { now: NOW, runtime: adapter, settings: config(), loadItems: () => items, maxNewRequests: 3 })
  assert.equal(api.scheduled.length, 3)
  assert.equal(result.pendingCount, 2)
  assert.equal(result.state, "limited")
  assert.equal(api.cancelled.length, 1)
})

test("zero-wait widget skips a busy lease without API work or persisted status changes", async () => {
  const values = storage()
  const api = runtime()
  await reconcileNotifications([item()], { now: NOW, runtime: api.adapter, settings: config() })
  const prior = loadNotificationStatus()
  values.set(NOTIFICATION_LOCK_KEY, { token: "busy-owner", expiresAt: Date.now() + 30000 })
  const adapter = { ...api.adapter, async getAllPendings() { throw new Error("Must not query under another owner's lease") } }
  const started = Date.now()
  const result = await reconcileNotifications([item()], { now: NOW, runtime: adapter, settings: config(), leaseWaitMs: 0 })
  assert.ok(Date.now() - started < 1000)
  assert.match(result.message, /本次已跳过/)
  assert.equal(result.pendingCount, prior?.pendingCount)
  assert.deepEqual(loadNotificationStatus(), prior)
  assert.equal((values.get(NOTIFICATION_LOCK_KEY) as any).token, "busy-owner")
})

test("clean disabled status avoids Notification API work on later refreshes", async () => {
  storage()
  const api = runtime()
  const settings = defaultNotificationSettings()
  await reconcileNotifications([], { now: NOW, runtime: api.adapter, settings })
  let queries = 0
  const adapter = { ...api.adapter, async getAllPendings() { queries += 1; throw new Error("Disabled refresh must stay local") } }
  const result = await reconcileNotifications([], { now: NOW, runtime: adapter, settings })
  assert.equal(result.state, "disabled")
  assert.equal(queries, 0)
})

test("interrupted dirty scheduling prevents the disabled fast path and cleans stray requests", async () => {
  const values = storage()
  const api = runtime()
  const settings = defaultNotificationSettings()
  await reconcileNotifications([], { now: NOW, runtime: api.adapter, settings })
  values.set(NOTIFICATION_DIRTY_KEY, true)
  api.add({ identifier: "stray", content: { userInfo: { dueManagerOwner: NOTIFICATION_OWNER, dueManagerKey: "interrupted" } } })
  const result = await reconcileNotifications([], { now: NOW, runtime: api.adapter, settings })
  assert.equal(result.state, "disabled")
  assert.deepEqual(api.cancelled, ["stray"])
  assert.equal(values.has(NOTIFICATION_DIRTY_KEY), false)
})

test("unavailable API cannot claim clean shutdown while an interrupted request may remain", async () => {
  const values = storage()
  values.set(NOTIFICATION_DIRTY_KEY, true)
  const result = await reconcileNotifications([], { now: NOW, runtime: null, settings: defaultNotificationSettings() })
  assert.equal(result.state, "unavailable")
  assert.equal(values.has(NOTIFICATION_DIRTY_KEY), true)
})

test("one global preview picks the earliest eligible trigger using one shared clock", () => {
  const now = new Date(2026, 8, 1, 12)
  const result = planNotifications([
    item({ id: "muted", dueDate: "2026-09-01", includesTime: true, hour: 13 }),
    item({ id: "past", dueDate: "2026-09-01", includesTime: true, hour: 11 }),
    item({ id: "later", dueDate: "2026-09-03" }),
    item({ id: "advance", dueDate: "2026-09-05", remindBeforeDays: 3 }),
  ], config({ mutedItemIDs: ["muted"] }), now, 1)
  assert.equal(result.notifications.length, 1)
  assert.equal(result.notifications[0].itemID, "advance")
  assert.equal(result.notifications[0].fireAt, new Date(2026, 8, 2, 9).getTime())
})
