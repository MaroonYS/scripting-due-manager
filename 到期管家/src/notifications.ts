import {
  actionDateKey,
  addCalendarDays,
  dateKeyToLocalDate,
  localDateKey,
  nextOccurrence,
  parseDateKey,
} from "./date"
import type { ManualDueItem } from "./types"
import { normalizeManualItemID } from "./item_ids"
import { currentWidgetLocale, formatWidgetDate, widgetLanguage } from "./widget_localization"

export const NOTIFICATION_SETTINGS_KEY = "due-manager-notification-settings-v1"
export const NOTIFICATION_STATUS_KEY = "due-manager-notification-status-v1"
export const NOTIFICATION_LOCK_KEY = "due-manager-notification-lock-v1"
export const NOTIFICATION_DIRTY_KEY = "due-manager-notification-dirty-v1"
export const NOTIFICATION_OWNER = "due-manager.local.v1"
export const NOTIFICATION_HORIZON_DAYS = 90
export const MAX_OWN_PENDING_NOTIFICATIONS = 40
// This is our conservative budget, not a promise about the host app's OS quota.
export const MAX_APP_PENDING_BUDGET = 60
const SHARED = { shared: true } as const

export interface NotificationSettings {
  schemaVersion: 1
  enabled: boolean
  hour: number
  minute: number
  includeDueDate: boolean
  /** Explicit per-item opt-outs; Apple Reminders are never scheduled here. */
  mutedItemIDs: string[]
}

export interface NotificationStatus {
  schemaVersion: 1
  state: "disabled" | "ready" | "limited" | "unavailable" | "error"
  message: string
  pendingCount: number
  lastAttemptAt: number
  lastSuccessAt: number | null
  plannedThrough: number | null
}

export interface PlannedNotification {
  /** Stable occurrence identity; independent of language and device time zone. */
  identity: string
  key: string
  itemID: string
  dueDate: string
  kind: "action" | "due"
  fireAt: number
  title: string
  body: string
}

export interface NotificationPlan {
  notifications: PlannedNotification[]
  limited: boolean
  plannedThrough: number
}

/** Narrow adapter for the documented Scripting Notification API, injectable in tests. */
export interface NotificationRuntime {
  getAllPendings(): Promise<unknown[]>
  removePendings(ids: string[]): Promise<void>
  schedule(notification: PlannedNotification): Promise<void>
}

export interface NotificationReconcileOptions {
  now?: Date
  /** A live clock for long-running reconciliation; `now` remains a fixed test clock. */
  clock?: () => Date
  runtime?: NotificationRuntime | null
  settings?: NotificationSettings
  locale?: string
  /** Read after the cross-runtime lease is acquired, so stale widget snapshots cannot win. */
  loadItems?: () => ManualDueItem[]
  /** Limits new system requests across this call's retries, without shrinking desired keys. */
  maxNewRequests?: number
  /** Widgets use zero: don't wait for an app/intent reconciliation already in flight. */
  leaseWaitMs?: number
}

export function defaultNotificationSettings(): NotificationSettings {
  return { schemaVersion: 1, enabled: false, hour: 9, minute: 0, includeDueDate: false, mutedItemIDs: [] }
}

export function normalizeNotificationSettings(value: unknown): NotificationSettings {
  const defaults = defaultNotificationSettings()
  if (!value || typeof value !== "object") return defaults
  const raw = value as Record<string, unknown>
  return {
    schemaVersion: 1,
    enabled: raw.enabled === true,
    hour: boundedInteger(raw.hour, 0, 23, 9),
    minute: boundedInteger(raw.minute, 0, 59, 0),
    includeDueDate: raw.includeDueDate === true,
    mutedItemIDs: Array.isArray(raw.mutedItemIDs)
      ? [...new Set(raw.mutedItemIDs.filter((id): id is string => typeof id === "string" && id.length > 0)
        .map(normalizeManualItemID))]
      : [],
  }
}

export function loadNotificationSettings(): NotificationSettings {
  return normalizeNotificationSettings(Storage.get(NOTIFICATION_SETTINGS_KEY, SHARED))
}

export function updateNotificationSettings(patch: Partial<NotificationSettings>): NotificationSettings {
  const next = normalizeNotificationSettings({ ...loadNotificationSettings(), ...patch })
  if (!Storage.set(NOTIFICATION_SETTINGS_KEY, next, SHARED)) throw new Error("通知设置未能保存，请检查可用存储空间。")
  return next
}

export function loadNotificationStatus(): NotificationStatus | null {
  const raw = Storage.get<NotificationStatus>(NOTIFICATION_STATUS_KEY, SHARED)
  return raw?.schemaVersion === 1 ? raw : null
}

/** Floating local dates preserve monthly/yearly anchors; no repeating 30-day timers. */
export function planNotifications(
  items: ManualDueItem[],
  settings: NotificationSettings,
  now = new Date(),
  maximum = MAX_OWN_PENDING_NOTIFICATIONS,
  locale = currentWidgetLocale(),
): NotificationPlan {
  const horizon = dateKeyToLocalDate(addCalendarDays(localDateKey(now), NOTIFICATION_HORIZON_DAYS)).getTime()
  const capacity = Math.max(0, Math.min(MAX_OWN_PENDING_NOTIFICATIONS, Math.floor(maximum)))
  if (!settings.enabled) return { notifications: [], limited: false, plannedThrough: horizon }
  const muted = new Set(settings.mutedItemIDs)
  let candidates: PlannedNotification[] = []
  let limited = false
  const seen = new Set<string>()
  for (const item of items) {
    if (!item.enabled || muted.has(item.id) || !parseDateKey(item.dueDate) || seen.has(item.id)) continue
    seen.add(item.id)
    let dueDate = item.dueDate
    let steps = 0
    while (steps < 10000) {
      steps += 1
      const advanced = (item.remindBeforeDays ?? 0) > 0
      const actionAt = dateKeyToLocalDate(
        actionDateKey(dueDate, item.remindBeforeDays),
        true,
        !advanced && item.includesTime ? item.hour : settings.hour,
        !advanced && item.includesTime ? item.minute : settings.minute,
      ).getTime()
      if (actionAt > horizon) break
      const times: Array<{ kind: PlannedNotification["kind"]; fireAt: number }> = [{ kind: "action", fireAt: actionAt }]
      if (advanced && settings.includeDueDate) {
        times.push({
          kind: "due",
          fireAt: dateKeyToLocalDate(dueDate, true,
            item.includesTime ? item.hour : settings.hour,
            item.includesTime ? item.minute : settings.minute).getTime(),
        })
      }
      for (const time of times) {
        if (!Number.isFinite(time.fireAt) || time.fireAt <= now.getTime() || time.fireAt > horizon) continue
        const when = formatWidgetDate(dueDate, locale, {
          includesTime: item.includesTime, hour: item.hour, minute: item.minute, now,
        })
        const language = widgetLanguage(locale)
        const body = language === "en" ? `Due ${when}` : language === "zh-Hant" ? `到期：${when}` : `到期：${when}`
        const title = item.title.slice(0, 200)
        const identity = notificationIdentity(item.id, dueDate, time.kind)
        const key = JSON.stringify([item.id, dueDate, time.kind, time.fireAt, title, body])
        candidates.push({ identity, key, itemID: item.id, dueDate, ...time, title, body })
      }
      // An occurrence's due notice can be later than the next occurrence's
      // advance notice. Inspect the full bounded horizon before choosing the
      // earliest requests, keeping only one overflow candidate in memory.
      if (candidates.length > capacity + 1) {
        limited = true
        candidates.sort(compareNotifications)
        candidates = candidates.slice(0, capacity + 1)
      }
      if (!item.recurrence) break
      const next = nextOccurrence(dueDate, item.recurrence)
      if (!parseDateKey(next) || next <= dueDate) break
      dueDate = next
    }
    if (steps >= 10000) limited = true
    // Every later item still competes by date for the bounded global queue.
    candidates.sort(compareNotifications)
    if (candidates.length > capacity + 1) candidates = candidates.slice(0, capacity + 1)
  }
  candidates.sort(compareNotifications)
  limited ||= candidates.length > capacity
  const notifications = candidates.slice(0, capacity)
  return {
    notifications,
    limited,
    plannedThrough: limited ? notifications.at(-1)?.fireAt ?? now.getTime() : horizon,
  }
}

export function nextNotificationForItem(
  item: ManualDueItem,
  settings: NotificationSettings,
  now = new Date(),
  locale = currentWidgetLocale(),
): PlannedNotification | null {
  return planNotifications([item], settings, now, 1, locale).notifications[0] ?? null
}

let reconcileQueue: Promise<unknown> = Promise.resolve()

/** Call after every mutation and on app/widget refresh to replenish the rolling window. */
export function reconcileNotifications(
  items: ManualDueItem[],
  options: NotificationReconcileOptions = {},
): Promise<NotificationStatus> {
  const budget = {
    remaining: boundedInteger(options.maxNewRequests, 0, MAX_OWN_PENDING_NOTIFICATIONS, MAX_OWN_PENDING_NOTIFICATIONS),
    // Correcting existing wrong-time requests is not ordinary widget backfill.
    // This exceptional allowance is shared across retries and capped at 40.
    repairsRemaining: MAX_OWN_PENDING_NOTIFICATIONS,
  }
  const run = reconcileQueue.then(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await reconcileNow(items, options, budget) }
      catch (error) { if (!(error instanceof SourceChangedError) || attempt === 2) throw error }
    }
    throw new Error("通知配置持续变化，请重试。")
  }).catch((error): NotificationStatus => {
    const status: NotificationStatus = {
      schemaVersion: 1, state: "error", message: `通知配置或状态读取失败，请重试。${String(error).slice(0, 120)}`,
      pendingCount: 0, lastAttemptAt: reconciliationClock(options)().getTime(), lastSuccessAt: null, plannedThrough: null,
    }
    try { Storage.set(NOTIFICATION_STATUS_KEY, status, SHARED) } catch { /* State failure already reported. */ }
    return status
  })
  // A failed adapter/storage call must not permanently poison future retries.
  reconcileQueue = run.catch(() => undefined)
  return run
}

async function reconcileNow(
  items: ManualDueItem[],
  options: NotificationReconcileOptions,
  budget: { remaining: number; repairsRemaining: number },
): Promise<NotificationStatus> {
  const clock = reconciliationClock(options)
  let now = clock()
  const previous = loadNotificationStatus()
  let settings = options.settings ?? loadNotificationSettings()
  let leaseToken: string | null = null
  let pendingCount = previous?.pendingCount ?? 0
  const finish = (state: NotificationStatus["state"], message: string, through: number | null = null): NotificationStatus => {
    const status: NotificationStatus = {
      schemaVersion: 1, state, message, pendingCount,
      lastAttemptAt: now.getTime(),
      lastSuccessAt: state === "ready" || state === "limited" || state === "disabled" ? now.getTime() : previous?.lastSuccessAt ?? null,
      plannedThrough: through,
    }
    let saved = false
    try { saved = Storage.set(NOTIFICATION_STATUS_KEY, status, SHARED) } catch { /* Report without undoing the saved item mutation. */ }
    if (!saved) {
      return { ...status, state: "error", message: "通知处理已尝试，但状态保存失败；请检查存储空间并重试。" }
    }
    if (state === "ready" || state === "limited" || state === "disabled") {
      try { Storage.remove(NOTIFICATION_DIRTY_KEY, SHARED) } catch { /* Retry the harmless dirty marker on the next pass. */ }
    }
    return status
  }
  try {
    // A durable dirty marker distinguishes a clean disabled state from a worker
    // interrupted after accepting requests but before recording their count.
    const dirty = Storage.contains(NOTIFICATION_DIRTY_KEY, SHARED)
    const currentLease = Storage.get<{ expiresAt: number }>(NOTIFICATION_LOCK_KEY, SHARED)
    const activeLease = currentLease != null && currentLease.expiresAt > Date.now()
    const cleanDisabled = previous?.state === "disabled" && pendingCount === 0
    const untouched = previous == null && options.runtime === undefined && !Storage.contains(NOTIFICATION_SETTINGS_KEY, SHARED)
    if (!settings.enabled && !dirty && !activeLease && (cleanDisabled || untouched)) {
      return finish("disabled", "通知未开启，暂无到期管家的待发通知。")
    }
    const runtime = options.runtime === undefined ? await loadRuntime() : options.runtime
    if (!runtime) {
      if (!settings.enabled && pendingCount === 0 && !dirty && !activeLease) return finish("disabled", "通知未开启。")
      return finish("unavailable", "当前 Scripting 版本无法管理通知，请更新 Scripting 后重试；已有通知可能尚未取消。")
    }
    const leaseWaitMs = boundedInteger(options.leaseWaitMs, 0, 4000, 4000)
    leaseToken = await acquireReconciliationLease(leaseWaitMs)
    if (!leaseToken) {
      const message = "另一个组件或脚本正在更新通知；本次已跳过，下次运行再补充，未抢占其安排。"
      // A zero-wait widget must not overwrite the active owner's persisted status.
      if (leaseWaitMs === 0) return previous
        ? { ...previous, message, lastAttemptAt: now.getTime() }
        : { schemaVersion: 1, state: "limited", message, pendingCount: 0, lastAttemptAt: now.getTime(), lastSuccessAt: null, plannedThrough: null }
      return finish("error", message)
    }
    settings = options.settings ?? loadNotificationSettings()
    items = options.loadItems?.() ?? items
    const sourceSignature = JSON.stringify([settings, items, notificationEnvironment(options, clock)])
    const assertCurrentSource = () => {
      renewReconciliationLease(leaseToken!)
      const currentSettings = options.settings ?? loadNotificationSettings()
      const currentItems = options.loadItems?.() ?? items
      if (sourceSignature !== JSON.stringify([currentSettings, currentItems, notificationEnvironment(options, clock)])) throw new SourceChangedError()
    }
    const allPending = await runtime.getAllPendings()
    const pending = allPending.map(normalizePending).filter((value): value is PendingRequest => value != null)
    assertCurrentSource()
    // Lock contention and the system query may have crossed a deadline.
    now = clock()
    const owned = pending.filter(request => request.userInfo.dueManagerOwner === NOTIFICATION_OWNER)
    // Unknown host request formats still occupy capacity; never undercount them.
    const otherCount = allPending.length - owned.length
    const plan = planNotifications(items, settings, now,
      Math.max(0, Math.min(MAX_OWN_PENDING_NOTIFICATIONS, MAX_APP_PENDING_BUDGET - otherCount)), options.locale)
    const desired = new Map(plan.notifications.map(notification => [notification.identity, notification]))
    const selected = new Map<string, PendingRequest>()
    const obsolete: string[] = []
    for (const request of owned) {
      const target = request.identity ? desired.get(request.identity) : undefined
      if (!target) { obsolete.push(request.identifier); continue }
      const existing = selected.get(target.identity)
      // Prefer an already-updated request, then an unchanged valid trigger, over
      // an obsolete time or duplicate left by an interrupted replacement.
      const rank = (value: PendingRequest) => value.key === target.key ? 0 : value.fireAt === target.fireAt ? 1 : 2
      if (!existing) selected.set(target.identity, request)
      else if (rank(request) < rank(existing)) {
        obsolete.push(existing.identifier)
        selected.set(target.identity, request)
      } else obsolete.push(request.identifier)
    }
    let hostPendingCount = allPending.length
    if (obsolete.length > 0) {
      assertCurrentSource()
      markPendingChanges()
      await runtime.removePendings(obsolete)
      hostPendingCount -= obsolete.length
      assertCurrentSource()
    }
    pendingCount = selected.size
    const repairs = plan.notifications.filter(notification => {
      const old = selected.get(notification.identity)
      return old != null && old.fireAt !== notification.fireAt
    })
    const additions = plan.notifications.filter(notification => !selected.has(notification.identity))
    const contentUpdates = plan.notifications.filter(notification => {
      const old = selected.get(notification.identity)
      return old?.fireAt === notification.fireAt && old.key !== notification.key
    })
    const expired = new Set<string>()
    let capacityBlocked = false
    const retireExpired = async (notification: PlannedNotification) => {
      expired.add(notification.identity)
      const old = selected.get(notification.identity)
      if (old) {
        assertCurrentSource()
        markPendingChanges()
        await runtime.removePendings([old.identifier])
        selected.delete(notification.identity)
        hostPendingCount = Math.max(0, hostPendingCount - 1)
        assertCurrentSource()
      }
    }
    // Wrong-time repairs always outrank ordinary backfill and cosmetic changes.
    for (const notification of [...repairs, ...additions, ...contentUpdates]) {
      if (notification.fireAt <= clock().getTime()) { await retireExpired(notification); continue }
      const old = selected.get(notification.identity)
      const repairsTime = old != null && old.fireAt !== notification.fireAt
      if (repairsTime ? budget.repairsRemaining <= 0 : budget.remaining <= 0) continue
      // Replacement is new-first: a transient spare slot is necessary. Never
      // discard a valid old request just to obtain that slot at host saturation.
      if (hostPendingCount >= MAX_APP_PENDING_BUDGET) { capacityBlocked = true; continue }
      assertCurrentSource()
      if (notification.fireAt <= clock().getTime()) { await retireExpired(notification); continue }
      markPendingChanges()
      if (notification.fireAt <= clock().getTime()) { await retireExpired(notification); continue }
      if (repairsTime) budget.repairsRemaining -= 1
      else budget.remaining -= 1
      await runtime.schedule(notification)
      assertCurrentSource()
      const accepted = await runtime.getAllPendings()
      assertCurrentSource()
      hostPendingCount = accepted.length
      const confirmed = accepted.map(normalizePending).find(request => request != null
        && request.userInfo.dueManagerOwner === NOTIFICATION_OWNER && request.key === notification.key)
      if (notification.fireAt <= clock().getTime()) {
        // It may have delivered while the API returned. It is not a future
        // pending notification, and a stale native request must not be counted.
        if (confirmed && confirmed.identifier !== old?.identifier) {
          markPendingChanges()
          await runtime.removePendings([confirmed.identifier])
          hostPendingCount = Math.max(0, hostPendingCount - 1)
          assertCurrentSource()
        }
        await retireExpired(notification)
        continue
      }
      if (!confirmed) throw new Error(old
        ? "系统未确认替换请求；原通知仍保留，原提醒时刻可能尚未更新，请重试。"
        : "系统未确认新通知已进入待发队列，请重试。")
      // Only after the new request is confirmed may the old one be cancelled.
      if (old && old.identifier !== confirmed.identifier) {
        markPendingChanges()
        await runtime.removePendings([old.identifier])
        if (accepted.some(value => normalizePending(value)?.identifier === old.identifier)) hostPendingCount -= 1
        assertCurrentSource()
      }
      selected.set(notification.identity, confirmed)
      pendingCount = selected.size
    }
    // Long API calls may also have crossed deadlines of untouched retained rows.
    for (const notification of plan.notifications) {
      if (notification.fireAt <= clock().getTime()) await retireExpired(notification)
    }
    now = clock()
    pendingCount = selected.size
    // Never present mere acceptance by the scheduling API as permission granted.
    if (!settings.enabled) return finish("disabled", "通知已关闭，已取消到期管家的待发通知。")
    const upcoming = plan.notifications.filter(notification => !expired.has(notification.identity))
    const wrongTimeCount = upcoming.filter(notification => {
      const old = selected.get(notification.identity)
      return old != null && old.fireAt !== notification.fireAt
    }).length
    const contentPendingCount = upcoming.filter(notification => {
      const old = selected.get(notification.identity)
      return old?.fireAt === notification.fireAt && old.key !== notification.key
    }).length
    const remainingCount = upcoming.filter(notification => !selected.has(notification.identity)).length
    const expiredNote = expired.size > 0 ? `另有 ${expired.size} 条在处理期间已过提醒时刻，未补发，也未计入待发。` : ""
    if (wrongTimeCount > 0) return finish("error", `有 ${wrongTimeCount} 条既有通知的提醒时刻尚未更新，旧排程仍保留，可能按原时刻提醒。${capacityBlocked ? "宿主待发队列没有安全替换余量；" : "本次修复预算已用完；"}请打开主脚本重试。${expiredNote}`)
    if (remainingCount > 0) {
      let coveredThrough = now.getTime()
      for (const planned of upcoming) {
        if (!selected.has(planned.identity)) break
        coveredThrough = planned.fireAt
      }
      return finish("limited", `当前已排入 ${pendingCount} 条通知；${capacityBlocked ? "宿主待发队列没有安全余量，" : "本次新增预算已用完，"}还有 ${remainingCount} 条等待下次组件运行或打开脚本补充。${expiredNote}`, coveredThrough)
    }
    if (contentPendingCount > 0) return finish("limited", `当前 ${pendingCount} 条有效提醒均已保留；还有 ${contentPendingCount} 条通知文案等待分批更新，不会因文案变化撤掉未轮到的提醒。${capacityBlocked ? "宿主队列暂无替换余量。" : ""}${expiredNote}`, plan.plannedThrough)
    if (plan.limited) return finish("limited", `已排入最近 ${pendingCount} 条通知；达到本脚本的安全排程上限，请定期开启脚本补充后续通知。${expiredNote}`, plan.plannedThrough)
    if (pendingCount === 0) return finish("ready", "未来 90 天内没有可排程的通知：可能已过提醒时刻、尚未进入范围或事项已关闭。已过的提醒不会补发；可开启到期日通知或调整提醒时间。", plan.plannedThrough)
    return finish("ready", `已排入 ${pendingCount} 条通知。实际横幅和声音仍取决于系统通知权限、专注模式与通知摘要。${expiredNote}`, plan.plannedThrough)
  } catch (error) {
    if (error instanceof SourceChangedError) throw error
    const detail = error instanceof Error ? error.message : String(error)
    return finish("error", `通知未完全更新；如有尚未替换的旧请求，它仍可能按原时刻提醒。请检查「设置 → 通知 → Scripting」权限并重试。${detail.slice(0, 160)}`)
  } finally {
    if (leaseToken) {
      try {
        if (Storage.get<{ token: string }>(NOTIFICATION_LOCK_KEY, SHARED)?.token === leaseToken) {
          Storage.remove(NOTIFICATION_LOCK_KEY, SHARED)
        }
      } catch { /* The short lease expires automatically after an interrupted run. */ }
    }
  }
}

class SourceChangedError extends Error {
  constructor() { super("通知排程期间事项或设置发生变化，正在使用最新数据重试。") }
}

function markPendingChanges(): void {
  if (!Storage.set(NOTIFICATION_DIRTY_KEY, true, SHARED)) throw new Error("通知排程变更状态未能保存。")
}

async function acquireReconciliationLease(waitMs: number): Promise<string | null> {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const deadline = Date.now() + waitMs
  while (true) {
    const existing = Storage.get<{ token: string; expiresAt: number }>(NOTIFICATION_LOCK_KEY, SHARED)
    if (!existing || existing.expiresAt <= Date.now()) {
      if (!Storage.set(NOTIFICATION_LOCK_KEY, { token, expiresAt: Date.now() + 30000 }, SHARED)) {
        throw new Error("通知排程锁未能保存。")
      }
      // Shared storage has no atomic compare-and-set. Recheck after yielding,
      // and before each system mutation; a later reconciliation also dedupes.
      await Promise.resolve()
      if (Storage.get<{ token: string }>(NOTIFICATION_LOCK_KEY, SHARED)?.token === token) return token
    }
    const remaining = deadline - Date.now()
    if (remaining <= 0) return null
    await new Promise<void>(resolve => setTimeout(resolve, Math.min(100, remaining)))
  }
}

function renewReconciliationLease(token: string): void {
  if (Storage.get<{ token: string }>(NOTIFICATION_LOCK_KEY, SHARED)?.token !== token) {
    throw new Error("通知排程已由其他运行接手，请重试。")
  }
  if (!Storage.set(NOTIFICATION_LOCK_KEY, { token, expiresAt: Date.now() + 30000 }, SHARED)) {
    throw new Error("通知排程锁未能续期。")
  }
}

type PendingRequest = {
  identifier: string
  userInfo: Record<string, unknown>
  key: string | null
  identity: string | null
  fireAt: number | null
}

function normalizePending(value: unknown): PendingRequest | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, any>
  // NotificationRequest is returned by pending APIs; NotificationInfo wraps a request.
  const request = raw.request ?? raw
  if (typeof request.identifier !== "string") return null
  const userInfo = request.content?.userInfo ?? {}
  const key = typeof userInfo.dueManagerKey === "string" ? userInfo.dueManagerKey : null
  // v2.5.0 keys already contain this tuple. Decode them to migrate pending
  // requests in place, instead of throwing the old queue away on upgrade.
  let identity: string | null = null
  let fireAt: number | null = null
  try {
    const parts: unknown = key ? JSON.parse(key) : null
    if (Array.isArray(parts) && typeof parts[0] === "string" && typeof parts[1] === "string"
      && parseDateKey(parts[1]) && (parts[2] === "action" || parts[2] === "due")
      && typeof parts[3] === "number" && Number.isFinite(parts[3])) {
      identity = notificationIdentity(parts[0], parts[1], parts[2])
      fireAt = parts[3]
    }
  } catch { /* Unrecognized owned records are obsolete, never retained by accident. */ }
  return { identifier: request.identifier, userInfo, key, identity, fireAt }
}

/** No optional Notification import runs when this module is evaluated. */
async function loadRuntime(): Promise<NotificationRuntime | null> {
  try {
    const module = await import("scripting") as unknown as Record<string, any>
    const globals = globalThis as unknown as Record<string, any>
    const notification = module.Notification
    const CalendarTrigger = module.CalendarNotificationTrigger ?? globals.CalendarNotificationTrigger
    const Components = module.DateComponents ?? globals.DateComponents
    if (typeof notification?.schedule !== "function" || typeof notification.getAllPendings !== "function"
      || typeof notification.removePendings !== "function" || typeof CalendarTrigger !== "function" || typeof Components !== "function") return null
    return {
      getAllPendings: () => notification.getAllPendings(),
      removePendings: async ids => { await notification.removePendings(ids) },
      schedule: async planned => {
        const date = new Date(planned.fireAt)
        const script = module.Script
        const tapAction = typeof script?.createRunURLScheme === "function" && typeof script.name === "string"
          ? { type: "openURL", url: script.createRunURLScheme(script.name, { action: "edit", id: planned.itemID }) }
          : undefined
        const result = await notification.schedule({
          title: planned.title,
          body: planned.body,
          threadIdentifier: NOTIFICATION_OWNER,
          tapAction,
          userInfo: { dueManagerOwner: NOTIFICATION_OWNER, dueManagerKey: planned.key,
            dueManagerIdentity: planned.identity, itemID: planned.itemID, dueDate: planned.dueDate },
          trigger: new CalendarTrigger({
            // fromDate respects a non-Gregorian system calendar; explicit month
            // components in the compatibility path use the documented 1–12 range.
            dateMatching: typeof Components.fromDate === "function" ? Components.fromDate(date)
              : new Components({ year: date.getFullYear(), month: date.getMonth() + 1,
                day: date.getDate(), hour: date.getHours(), minute: date.getMinutes(), second: 0 }),
            repeats: false,
          }),
        })
        if (result === false) throw new Error("系统未接受通知请求。")
      },
    }
  } catch { return null }
}

function compareNotifications(left: PlannedNotification, right: PlannedNotification): number {
  return left.fireAt - right.fireAt || left.key.localeCompare(right.key)
}

function notificationIdentity(itemID: string, dueDate: string, kind: PlannedNotification["kind"]): string {
  // Legacy v2.5 duplicate IDs could exceed the storage limit. The old pending
  // key must still match its migrated item instead of losing its notification.
  return JSON.stringify([normalizeManualItemID(itemID), dueDate, kind])
}

function reconciliationClock(options: NotificationReconcileOptions): () => Date {
  return options.clock ?? (options.now ? () => options.now! : () => new Date())
}

function notificationEnvironment(options: NotificationReconcileOptions, clock: () => Date): string {
  return JSON.stringify([options.locale ?? currentWidgetLocale(), clock().getTimezoneOffset()])
}

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback
}
