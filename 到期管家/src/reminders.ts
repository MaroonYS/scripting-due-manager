import {
  dateKeyToLocalDate,
  dueStatus,
  formatDateKey,
  parseDateKey,
} from "./date"
import { resolveDueIcon } from "./icons"
import {
  normalizeReminderCalendarIDs,
  REMINDER_SNAPSHOT_KEY,
  SHARED_STORAGE_OPTIONS,
} from "./storage"
import type {
  CachedReminderItem,
  DisplayDueItem,
  ReminderLoadResult,
  ReminderSnapshot,
} from "./types"

export async function loadReminderItems(
  horizonDays: number,
  calendarIDs: readonly string[] = [],
  now = new Date(),
): Promise<ReminderLoadResult> {
  const calendarFilterIDs = normalizeReminderCalendarIDs(calendarIDs)
  try {
    const endDate = new Date(now)
    endDate.setDate(endDate.getDate() + Math.max(30, Math.min(3650, horizonDays)))
    const calendars = calendarFilterIDs.length > 0
      ? await resolveReminderCalendars(calendarFilterIDs)
      : undefined
    const reminders = await Reminder.getIncompletes(
      calendars ? { endDate, calendars } : { endDate },
    )
    const cached = reminders
      .map(reminderToCacheItem)
      .filter((item): item is CachedReminderItem => item != null)
      .sort((left, right) => left.dueTimestamp - right.dueTimestamp)
      .slice(0, 500)
    const snapshot: ReminderSnapshot = {
      schemaVersion: 1,
      fetchedAt: Date.now(),
      calendarFilterIDs,
      items: cached,
    }
    Storage.set(REMINDER_SNAPSHOT_KEY, snapshot, SHARED_STORAGE_OPTIONS)
    return {
      items: cached.map(item => cacheItemToDisplay(item, false)),
      fetchedAt: snapshot.fetchedAt,
      fromCache: false,
      error: null,
    }
  } catch (error) {
    const snapshot = readSnapshot()
    const matchingSnapshot = snapshot != null
      && sameCalendarFilter(snapshot.calendarFilterIDs, calendarFilterIDs)
      ? snapshot
      : null
    const expired = matchingSnapshot != null && isSnapshotStale(matchingSnapshot.fetchedAt)
    return {
      items: matchingSnapshot && !expired
        ? matchingSnapshot.items.map(item => cacheItemToDisplay(item, true))
        : [],
      fetchedAt: matchingSnapshot?.fetchedAt ?? null,
      fromCache: matchingSnapshot != null,
      error: expired
        ? `提醒缓存已过期：${readableError(error)}`
        : readableError(error),
    }
  }
}

async function resolveReminderCalendars(calendarFilterIDs: string[]): Promise<any[]> {
  const available = await Calendar.forReminders()
  const byIdentifier = new Map<string, any>()
  for (const calendar of available) {
    const identifier = typeof calendar?.identifier === "string"
      ? calendar.identifier
      : ""
    if (identifier) byIdentifier.set(identifier, calendar)
  }
  const calendars = calendarFilterIDs
    .map(identifier => byIdentifier.get(identifier))
    .filter(calendar => calendar != null)
  if (calendars.length !== calendarFilterIDs.length) {
    const missingCount = calendarFilterIDs.length - calendars.length
    throw new Error(`有 ${missingCount} 个所选提醒事项列表已不可用，请在主脚本中重新选择。`)
  }
  return calendars
}

function sameCalendarFilter(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((identifier, index) => identifier === right[index])
}

export function sortDueItems(items: DisplayDueItem[], now = new Date()): DisplayDueItem[] {
  return [...items].sort((left, right) => {
    if (left.stale !== right.stale) return left.stale ? 1 : -1
    const leftStatus = dueStatus(left, now)
    const rightStatus = dueStatus(right, now)
    const leftRank = urgencyRank(leftStatus.days, leftStatus.overdue)
    const rightRank = urgencyRank(rightStatus.days, rightStatus.overdue)
    if (leftRank !== rightRank) return leftRank - rightRank
    if (left.dueTimestamp !== right.dueTimestamp) return left.dueTimestamp - right.dueTimestamp
    if (left.priority !== right.priority) return right.priority - left.priority
    const titleOrder = left.title.localeCompare(right.title, "zh-Hans-CN")
    if (titleOrder !== 0) return titleOrder
    if (left.source !== right.source) return left.source.localeCompare(right.source)
    return left.id.localeCompare(right.id)
  })
}

export type ReminderCompletionResult = "applied" | "stale" | "missing"

export function findReminderDisplayItemForCompletion(
  id: string,
  completionKey: string,
): DisplayDueItem | null {
  const cached = readSnapshot()?.items.find(item => item.id === id)
  if (!cached) return null
  const item = cacheItemToDisplay(cached, false)
  return item.completionKey === completionKey ? item : null
}

export function reminderOccurrenceKey(
  item: Pick<CachedReminderItem, "dueDate" | "includesTime" | "dueTimestamp">,
): string {
  return item.includesTime
    ? `time:${Math.trunc(item.dueTimestamp)}`
    : `date:${item.dueDate}`
}

export async function completeReminderOccurrence(
  id: string,
  completionKey: string,
): Promise<ReminderCompletionResult> {
  const reminder = await Reminder.get(id)
  if (!reminder || reminder.isCompleted === true) {
    removeReminderFromSnapshot(id)
    return "missing"
  }

  const current = reminderToCacheItem(reminder)
  if (!current || reminderOccurrenceKey(current) !== completionKey) {
    return "stale"
  }

  reminder.isCompleted = true
  await reminder.save()
  removeReminderFromSnapshot(id)
  return "applied"
}

export function nextWidgetRefresh(
  items: DisplayDueItem[],
  now = new Date(),
  remindersEnabled = false,
): Date {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1)
  let refreshAt = midnight
  const minimum = now.getTime() + 5 * 60 * 1000

  if (remindersEnabled) {
    const reminderPoll = new Date(now.getTime() + 3 * 60 * 60 * 1000)
    if (reminderPoll < refreshAt) refreshAt = reminderPoll
  }

  for (const item of items) {
    if (!item.includesTime) continue
    if (item.dueTimestamp <= now.getTime()) continue
    const candidate = Math.max(item.dueTimestamp, minimum)
    if (candidate < refreshAt.getTime()) {
      refreshAt = new Date(candidate)
    }
  }
  return refreshAt
}

export function isSnapshotStale(fetchedAt: number | null, now = Date.now()): boolean {
  if (fetchedAt == null || !Number.isFinite(fetchedAt)) return true
  const age = now - fetchedAt
  return age < -5 * 60 * 1000 || age > 24 * 60 * 60 * 1000
}

export function clearReminderSnapshot(): void {
  Storage.remove(REMINDER_SNAPSHOT_KEY, SHARED_STORAGE_OPTIONS)
  Storage.remove(REMINDER_SNAPSHOT_KEY)
}

function reminderToCacheItem(reminder: any): CachedReminderItem | null {
  const components = reminder?.dueDateComponents
  const computed: Date | null = components?.date ?? null
  if (!components || !(computed instanceof Date) || Number.isNaN(computed.getTime())) return null

  const includesTime = components.hour != null && components.minute != null

  // Timed reminders represent an absolute instant. Display every component in
  // the device's current time zone so the label, sort key and countdown agree.
  // Date-only reminders are floating calendar dates and retain their components.
  const year = includesTime ? computed.getFullYear() : integerOr(components.year, Number.NaN)
  const month = includesTime ? computed.getMonth() + 1 : integerOr(components.month, Number.NaN)
  const day = includesTime ? computed.getDate() : integerOr(components.day, Number.NaN)
  const dueDate = formatDateKey(year, month, day)
  if (!parseDateKey(dueDate)) return null

  const hour = includesTime ? computed.getHours() : 0
  const minute = includesTime ? computed.getMinutes() : 0
  const dueTimestamp = includesTime
    ? computed.getTime()
    : dateKeyToLocalDate(dueDate, false).getTime()

  return {
    id: String(reminder.identifier ?? `${reminder.title}-${dueTimestamp}`),
    title: String(reminder.title ?? "未命名提醒").slice(0, 200),
    dueDate,
    includesTime,
    hour,
    minute,
    dueTimestamp,
    calendarTitle: String(reminder.calendar?.title ?? "提醒事项").slice(0, 80),
    priority: normalizedReminderPriority(reminder.priority),
  }
}

function cacheItemToDisplay(item: CachedReminderItem, stale: boolean): DisplayDueItem {
  const icon = resolveDueIcon(item.title, "reminder")
  return {
    id: item.id,
    source: "reminder",
    completionKey: reminderOccurrenceKey(item),
    title: item.title,
    kind: "reminder",
    iconName: icon.name,
    iconColor: icon.color,
    dueDate: item.dueDate,
    includesTime: item.includesTime,
    hour: item.hour,
    minute: item.minute,
    dueTimestamp: item.dueTimestamp,
    amount: "",
    note: item.calendarTitle,
    priority: item.priority,
    stale,
  }
}

function removeReminderFromSnapshot(id: string): void {
  const snapshot = readSnapshot()
  if (!snapshot) return
  const items = snapshot.items.filter(item => item.id !== id)
  if (items.length === snapshot.items.length) return
  Storage.set(REMINDER_SNAPSHOT_KEY, { ...snapshot, items }, SHARED_STORAGE_OPTIONS)
}

function readSnapshot(): ReminderSnapshot | null {
  const shared = Storage.get<any>(REMINDER_SNAPSHOT_KEY, SHARED_STORAGE_OPTIONS)
  const legacy = shared == null ? Storage.get<any>(REMINDER_SNAPSHOT_KEY) : null
  const raw = shared ?? legacy
  if (!raw || raw.schemaVersion !== 1 || !Array.isArray(raw.items)) return null
  const items = raw.items
    .slice(0, 500)
    .map(normalizeCachedItem)
    .filter((item: CachedReminderItem | null): item is CachedReminderItem => item != null)
  const snapshot: ReminderSnapshot = {
    schemaVersion: 1,
    fetchedAt: typeof raw.fetchedAt === "number" ? raw.fetchedAt : 0,
    calendarFilterIDs: normalizeReminderCalendarIDs(raw.calendarFilterIDs),
    items,
  }
  if (shared == null && legacy != null) {
    Storage.set(REMINDER_SNAPSHOT_KEY, snapshot, SHARED_STORAGE_OPTIONS)
  }
  return snapshot
}

function normalizeCachedItem(raw: any): CachedReminderItem | null {
  if (
    !raw
    || typeof raw.id !== "string"
    || typeof raw.title !== "string"
    || typeof raw.dueDate !== "string"
    || parseDateKey(raw.dueDate) == null
    || typeof raw.includesTime !== "boolean"
    || typeof raw.dueTimestamp !== "number"
    || !Number.isFinite(raw.dueTimestamp)
  ) {
    return null
  }
  return {
    id: raw.id,
    title: raw.title.slice(0, 200),
    dueDate: raw.dueDate,
    includesTime: raw.includesTime,
    hour: boundedInteger(raw.hour, 0, 23, 0),
    minute: boundedInteger(raw.minute, 0, 59, 0),
    dueTimestamp: raw.dueTimestamp,
    calendarTitle: typeof raw.calendarTitle === "string" ? raw.calendarTitle.slice(0, 80) : "提醒事项",
    priority: boundedInteger(raw.priority, 0, 3, 0),
  }
}

function urgencyRank(days: number, overdue: boolean): number {
  if (overdue || days < 0) return 0
  if (days === 0) return 1
  return 2
}

function integerOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback
}

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return Math.min(maximum, Math.max(minimum, integerOr(value, fallback)))
}

/** EventKit uses 1 as high, 5 as medium, 9 as low and 0 as unset. */
function normalizedReminderPriority(value: unknown): number {
  const priority = integerOr(value, 0)
  if (priority <= 0) return 0
  if (priority <= 4) return 3
  if (priority <= 8) return 2
  return 1
}

function readableError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error || "无法读取提醒事项")
}
