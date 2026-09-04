import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
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

test("legacy long muted item IDs follow the same normalization as manual items", () => {
  const oldID = `${"x".repeat(160)}-duplicate-2`
  const newID = `${"x".repeat(148)}-duplicate-2`
  const settings = normalizeNotificationSettings(config({ mutedItemIDs: [oldID, newID] }))
  assert.deepEqual(settings.mutedItemIDs, [newID])
  assert.equal(planNotifications([item({ id: newID })], settings, NOW).notifications.length, 0)
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
  // A changed title no longer causes a valid, already-scheduled request to be
  // discarded. It remains until the cosmetic update has budget to replace it.
  assert.equal(result.pendingCount, 3)
  assert.equal(result.state, "limited")
  assert.equal(api.cancelled.length, 0)
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

test("language changes replace only budgeted content and preserve every other effective reminder", async () => {
  storage()
  const api = runtime()
  const items = Array.from({ length: 10 }, (_, i) => item({ id: `item-${i}`, includesTime: true, hour: 9, minute: i }))
  await reconcileNotifications(items, { now: NOW, runtime: api.adapter, settings: config(), locale: "en-US" })
  const originalIDs = api.pending.map(value => value.identifier)
  let minimumPending = api.pending.length
  const adapter = { ...api.adapter, async removePendings(ids: string[]) {
    // A replacement has already been accepted before each original is removed.
    assert.equal(api.pending.length, 11)
    await api.adapter.removePendings(ids)
    minimumPending = Math.min(minimumPending, api.pending.length)
  } }
  const result = await reconcileNotifications(items, {
    now: NOW, runtime: adapter, settings: config(), locale: "zh-Hans-CN", maxNewRequests: 3, leaseWaitMs: 0,
  })
  assert.equal(result.pendingCount, 10)
  assert.equal(api.pending.length, 10)
  assert.equal(minimumPending, 10)
  assert.equal(api.scheduled.length, 13)
  assert.equal(originalIDs.filter(id => api.pending.some(value => value.identifier === id)).length, 7)
  assert.equal(result.state, "limited")
  assert.match(result.message, /有效提醒均已保留/)
})

test("stable identities are independent of titles and localized content, but occurrences differ", () => {
  const a = planNotifications([item()], config(), NOW, 40, "en-US").notifications[0]
  const b = planNotifications([item({ title: "Updated" })], config(), NOW, 40, "zh-Hans-CN").notifications[0]
  const c = planNotifications([item({ dueDate: "2026-10-01" })], config(), NOW, 40, "en-US").notifications[0]
  assert.equal(a.identity, b.identity)
  assert.notEqual(a.key, b.key)
  assert.notEqual(a.identity, c.identity)
})

test("v2.5 pending keys migrate in place instead of cancelling the whole queue", async () => {
  storage()
  const api = runtime()
  const planned = planNotifications([item()], config(), NOW, 40, "en-US").notifications[0]
  // Old notifications had no dueManagerIdentity, only the original tuple key.
  api.add({ identifier: "legacy-v250", content: { userInfo: { dueManagerOwner: NOTIFICATION_OWNER, dueManagerKey: planned.key } } })
  const result = await reconcileNotifications([item()], { now: NOW, runtime: api.adapter, settings: config(), locale: "zh-Hans-CN", maxNewRequests: 0 })
  assert.equal(result.pendingCount, 1)
  assert.equal(api.pending[0].identifier, "legacy-v250")
  assert.equal(api.cancelled.length, 0)
})

test("legacy overlong active pending IDs survive migration with only three widget replacements", async () => {
  storage()
  const api = runtime()
  const oldItems = Array.from({ length: 10 }, (_, i) => item({ id: `${String(i).repeat(160)}-duplicate-2` }))
  const migratedItems = Array.from({ length: 10 }, (_, i) => item({ id: `${String(i).repeat(148)}-duplicate-2` }))
  for (const [index, planned] of planNotifications(oldItems, config(), NOW, 40, "en-US").notifications.entries()) {
    api.add({ identifier: `legacy-${index}`, content: { userInfo: {
      dueManagerOwner: NOTIFICATION_OWNER, dueManagerKey: planned.key,
    } } })
  }
  let minimumPending = api.pending.length
  const adapter = { ...api.adapter, async removePendings(ids: string[]) {
    await api.adapter.removePendings(ids)
    minimumPending = Math.min(minimumPending, api.pending.length)
  } }
  const result = await reconcileNotifications(migratedItems, {
    now: NOW, runtime: adapter, settings: config(), locale: "en-US", maxNewRequests: 3, leaseWaitMs: 0,
  })
  assert.equal(result.state, "limited")
  assert.equal(result.pendingCount, 10)
  assert.equal(minimumPending, 10)
  assert.equal(api.pending.length, 10)
  assert.equal(api.scheduled.length, 3)
  assert.equal(api.cancelled.length, 3)
  assert.equal(api.pending.filter(value => value.identifier.startsWith("legacy-")).length, 7)
  assert.match(result.message, /有效提醒均已保留/)
})

test("changed trigger times repair existing requests ahead of the ordinary three-request budget", async () => {
  storage()
  const api = runtime()
  const items = Array.from({ length: 10 }, (_, i) => item({ id: `item-${i}` }))
  await reconcileNotifications(items, { now: NOW, runtime: api.adapter, settings: config({ hour: 9 }) })
  const result = await reconcileNotifications(items, {
    now: NOW, runtime: api.adapter, settings: config({ hour: 10 }), maxNewRequests: 3, leaseWaitMs: 0,
  })
  assert.equal(result.state, "ready")
  assert.equal(api.scheduled.length, 20)
  assert.equal(api.cancelled.length, 10)
  assert.equal(api.pending.length, 10)
  assert.ok(api.pending.every(value => new Date(JSON.parse(value.content.userInfo.dueManagerKey)[3]).getHours() === 10))
})

test("time-zone changes repair the entire existing queue without leaving seven items unplanned", () => {
  const items = Array.from({ length: 10 }, (_, i) => item({ id: `zone-${i}`, includesTime: true, hour: 9, minute: i }))
  const moduleURL = new URL("../到期管家/src/notifications.ts", import.meta.url).href
  const reconcileInZone = (zone: string, previousPending: unknown[] = []) => {
    // Bun caches runtime TZ changes differently on Linux/macOS. Start a fresh
    // process in each real zone, carrying the old native queue into the new one.
    const script = `
      import { reconcileNotifications, NOTIFICATION_OWNER } from ${JSON.stringify(moduleURL)};
      const values = new Map();
      globalThis.Storage = {
        get: key => values.get(key) ?? null,
        set: (key, value) => { values.set(key, value); return true },
        contains: key => values.has(key),
        remove: key => values.delete(key),
      };
      let pending = ${JSON.stringify(previousPending)};
      const scheduled = [];
      const cancelled = [];
      const runtime = {
        getAllPendings: async () => [...pending],
        removePendings: async ids => {
          cancelled.push(...ids);
          pending = pending.filter(request => !ids.includes(request.identifier));
        },
        schedule: async planned => {
          scheduled.push(planned);
          pending.push({ identifier: ${JSON.stringify(zone)} + '-' + scheduled.length,
            content: { userInfo: { dueManagerOwner: NOTIFICATION_OWNER, dueManagerKey: planned.key } } });
        },
      };
      const result = await reconcileNotifications(${JSON.stringify(items)}, {
        now: new Date("2026-09-01T12:00:00Z"), runtime,
        settings: ${JSON.stringify(config())}, locale: "en-US",
        maxNewRequests: ${previousPending.length ? 3 : 40}, leaseWaitMs: 0,
      });
      console.log(JSON.stringify({ result, pending, scheduled, cancelled,
        offset: new Date("2026-09-30T12:00:00Z").getTimezoneOffset(),
        localHours: pending.map(request => new Date(JSON.parse(request.content.userInfo.dueManagerKey)[3]).getHours()),
      }));
    `
    const child = spawnSync(process.execPath, ["--eval", script], {
      encoding: "utf8", env: { ...process.env, TZ: zone }, timeout: 10000,
    })
    assert.equal(child.status, 0, child.stderr || String(child.error ?? ""))
    return JSON.parse(child.stdout) as {
      result: { state: string; pendingCount: number }; pending: unknown[];
      scheduled: PlannedNotification[]; cancelled: string[]; offset: number; localHours: number[];
    }
  }
  const before = reconcileInZone("Asia/Hong_Kong")
  const after = reconcileInZone("America/New_York", before.pending)
  assert.equal(before.offset, -480)
  assert.equal(after.offset, 240)
  assert.equal(before.result.state, "ready")
  assert.equal(before.pending.length, 10)
  assert.equal(after.result.state, "ready")
  assert.equal(after.result.pendingCount, 10)
  assert.equal(before.scheduled.length + after.scheduled.length, 20)
  assert.equal(after.cancelled.length, 10)
  assert.equal(after.pending.length, 10)
  assert.equal(after.scheduled[0].identity, before.scheduled[0].identity)
  assert.equal(after.scheduled[0].fireAt - before.scheduled[0].fireAt, 12 * 60 * 60 * 1000)
  assert.ok(after.localHours.every(hour => hour === 9))
})

test("failed cosmetic replacement retains the valid old notification", async () => {
  storage()
  const api = runtime()
  await reconcileNotifications([item()], { now: NOW, runtime: api.adapter, settings: config(), locale: "en-US" })
  const originalID = api.pending[0].identifier
  const failing = { ...api.adapter, async schedule() { throw new Error("denied") } }
  const result = await reconcileNotifications([item()], { now: NOW, runtime: failing, settings: config(), locale: "zh-Hans-CN" })
  assert.equal(result.state, "error")
  assert.equal(api.pending[0].identifier, originalID)
  assert.equal(api.cancelled.length, 0)
})

test("an unacknowledged replacement cannot remove the old reminder or claim ready", async () => {
  storage()
  const api = runtime()
  await reconcileNotifications([item()], { now: NOW, runtime: api.adapter, settings: config() })
  const unacknowledged = { ...api.adapter, async schedule() { /* Host silently drops it. */ } }
  const result = await reconcileNotifications([item({ title: "Changed" })], { now: NOW, runtime: unacknowledged, settings: config() })
  assert.equal(result.state, "error")
  assert.match(result.message, /系统未确认替换请求/)
  assert.equal(api.pending.length, 1)
  assert.equal(api.cancelled.length, 0)
})

test("a trigger-repair failure keeps remaining originals and reports their stale time", async () => {
  storage()
  const api = runtime()
  const items = Array.from({ length: 10 }, (_, i) => item({ id: `item-${i}` }))
  await reconcileNotifications(items, { now: NOW, runtime: api.adapter, settings: config({ hour: 9 }) })
  let calls = 0
  const failing = { ...api.adapter, async schedule(notification: PlannedNotification) {
    if (++calls === 3) throw new Error("native failure")
    await api.adapter.schedule(notification)
  } }
  const result = await reconcileNotifications(items, {
    now: NOW, runtime: failing, settings: config({ hour: 10 }), maxNewRequests: 3,
  })
  assert.equal(result.state, "error")
  assert.match(result.message, /原时刻/)
  assert.equal(api.pending.length, 10)
  assert.equal(api.cancelled.length, 2)
  assert.equal(api.pending.filter(value => new Date(JSON.parse(value.content.userInfo.dueManagerKey)[3]).getHours() === 9).length, 8)
})

test("a saturated host queue does not sacrifice valid reminders for cosmetic updates", async () => {
  storage()
  const api = runtime()
  for (let i = 0; i < 50; i++) api.add({ identifier: `other-${i}`, content: {} })
  const items = Array.from({ length: 10 }, (_, i) => item({ id: `item-${i}` }))
  await reconcileNotifications(items, { now: NOW, runtime: api.adapter, settings: config(), locale: "en-US" })
  assert.equal(api.pending.length, 60)
  const result = await reconcileNotifications(items, { now: NOW, runtime: api.adapter, settings: config(), locale: "zh-Hans-CN", maxNewRequests: 3 })
  assert.equal(result.state, "limited")
  assert.match(result.message, /暂无替换余量/)
  assert.equal(api.pending.length, 60)
  assert.equal(api.cancelled.length, 0)
  assert.equal(api.scheduled.length, 10)
})

test("a saturated host reports stale-time repairs rather than pretending the queue is fixed", async () => {
  storage()
  const api = runtime()
  for (let i = 0; i < 50; i++) api.add({ identifier: `other-${i}`, content: {} })
  const items = Array.from({ length: 10 }, (_, i) => item({ id: `item-${i}` }))
  await reconcileNotifications(items, { now: NOW, runtime: api.adapter, settings: config({ hour: 9 }) })
  const result = await reconcileNotifications(items, { now: NOW, runtime: api.adapter, settings: config({ hour: 10 }), maxNewRequests: 3 })
  assert.equal(result.state, "error")
  assert.match(result.message, /没有安全替换余量/)
  assert.equal(api.pending.length, 60)
  assert.equal(api.cancelled.length, 0)
})

test("one free host slot is reused for all controlled repairs without exceeding sixty requests", async () => {
  storage()
  const api = runtime()
  for (let i = 0; i < 49; i++) api.add({ identifier: `other-${i}`, content: {} })
  const items = Array.from({ length: 10 }, (_, i) => item({ id: `item-${i}` }))
  await reconcileNotifications(items, { now: NOW, runtime: api.adapter, settings: config({ hour: 9 }) })
  let maximum = api.pending.length
  const adapter = { ...api.adapter, async schedule(notification: PlannedNotification) {
    await api.adapter.schedule(notification)
    maximum = Math.max(maximum, api.pending.length)
  } }
  const result = await reconcileNotifications(items, { now: NOW, runtime: adapter, settings: config({ hour: 10 }), maxNewRequests: 3 })
  assert.equal(result.state, "ready")
  assert.equal(api.scheduled.length, 20)
  assert.equal(maximum, 60)
  assert.equal(api.pending.length, 59)
})

test("fresh time after the native query excludes a deadline that passed while waiting", async () => {
  storage()
  const api = runtime()
  let wall = new Date(2026, 8, 30, 8, 59, 58).getTime()
  const adapter = { ...api.adapter, async getAllPendings() {
    wall += 5000
    return api.adapter.getAllPendings()
  } }
  const result = await reconcileNotifications([item({ includesTime: true, hour: 9, minute: 0 })], {
    runtime: adapter, settings: config(), clock: () => new Date(wall),
  })
  assert.equal(api.scheduled.length, 0)
  assert.equal(result.pendingCount, 0)
  assert.match(result.message, /已过的提醒不会补发/)
})

test("every subsequent request checks the live clock and expired confirmations aren't counted", async () => {
  storage()
  const api = runtime()
  let wall = new Date(2026, 8, 30, 8, 59, 58).getTime()
  const attempts: Array<{ fireAt: number; at: number }> = []
  const adapter = { ...api.adapter, async schedule(notification: PlannedNotification) {
    attempts.push({ fireAt: notification.fireAt, at: wall })
    await api.adapter.schedule(notification)
    wall += 65000
  } }
  const result = await reconcileNotifications([
    item({ id: "first", includesTime: true, hour: 9, minute: 0 }),
    item({ id: "second", includesTime: true, hour: 9, minute: 1 }),
  ], { runtime: adapter, settings: config(), clock: () => new Date(wall) })
  assert.equal(attempts.length, 1)
  assert.ok(attempts.every(value => value.fireAt > value.at))
  assert.equal(result.pendingCount, 0)
  assert.equal(api.pending.length, 0)
})

test("advance-day default time never pushes a 00:30 actual-due notification to 09:00", () => {
  const plan = planNotifications([item({ dueDate: "2026-09-05", includesTime: true, hour: 0, minute: 30, remindBeforeDays: 1 })],
    config({ includeDueDate: true, hour: 9 }), new Date(2026, 8, 4, 0))
  assert.deepEqual(plan.notifications.map(value => value.fireAt), [
    new Date(2026, 8, 4, 9).getTime(), new Date(2026, 8, 5, 0, 30).getTime(),
  ])
})
