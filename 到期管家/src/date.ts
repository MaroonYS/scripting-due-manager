import type { ManualDueItem, RecurrenceRule } from "./types"

const DAY_MS = 24 * 60 * 60 * 1000

export const MIN_RECURRENCE_INTERVAL = 1
export const MAX_RECURRENCE_INTERVAL = 99
export const MIN_REMIND_BEFORE_DAYS = 0
export const MAX_REMIND_BEFORE_DAYS = 365

export interface DateParts {
  year: number
  month: number
  day: number
}

export function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

export function formatDateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`
}

export function parseDateKey(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
  if (
    parts.year < 1
    || parts.month < 1
    || parts.month > 12
    || parts.day < 1
    || parts.day > daysInMonth(parts.year, parts.month)
  ) {
    return null
  }
  return parts
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function localDateKey(date: Date): string {
  return formatDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

/**
 * Builds a Date using local calendar components. Date-only items use the end of
 * the day so they remain due "today" until local midnight.
 */
export function dateKeyToLocalDate(
  dateKey: string,
  includesTime = false,
  hour = 23,
  minute = 59,
): Date {
  const parts = parseDateKey(dateKey)
  if (!parts) return new Date(Number.NaN)
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    includesTime ? clamp(hour, 0, 23) : 23,
    includesTime ? clamp(minute, 0, 59) : 59,
    includesTime ? 0 : 59,
    includesTime ? 0 : 999,
  )
}

export function calendarOrdinal(dateKey: string): number {
  const parts = parseDateKey(dateKey)
  if (!parts) return Number.NaN
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS)
}

export function calendarDayDifference(fromDateKey: string, toDateKey: string): number {
  return calendarOrdinal(toDateKey) - calendarOrdinal(fromDateKey)
}

export function addCalendarDays(dateKey: string, days: number): string {
  const parts = parseDateKey(dateKey)
  if (!parts) return dateKey
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  return formatDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

export function parseRecurrenceIntervalInput(value: string): number | null {
  return parseBoundedIntegerInput(
    value,
    MIN_RECURRENCE_INTERVAL,
    MAX_RECURRENCE_INTERVAL,
  )
}

export function parseRemindBeforeDaysInput(value: string): number | null {
  return parseBoundedIntegerInput(
    value,
    MIN_REMIND_BEFORE_DAYS,
    MAX_REMIND_BEFORE_DAYS,
  )
}

export function actionDateKey(dueDate: string, remindBeforeDays = 0): string {
  return addCalendarDays(dueDate, -normalizeRemindBeforeDays(remindBeforeDays))
}

export function createRecurrenceRule(
  unit: RecurrenceRule["unit"],
  interval: number,
  dueDate: string,
  useMonthEnd = false,
  leapDayPolicy: RecurrenceRule["leapDayPolicy"] = "feb28",
): RecurrenceRule {
  const parts = parseDateKey(dueDate) ?? { year: 2000, month: 1, day: 1 }
  return {
    unit,
    interval: clamp(
      Math.round(interval),
      MIN_RECURRENCE_INTERVAL,
      MAX_RECURRENCE_INTERVAL,
    ),
    anchorDay: parts.day,
    anchorMonth: parts.month,
    useMonthEnd,
    leapDayPolicy,
  }
}

/** Advances exactly one scheduled occurrence while preserving the original anchor. */
export function nextOccurrence(dateKey: string, recurrence: RecurrenceRule): string {
  const current = parseDateKey(dateKey)
  if (!current) return dateKey
  const interval = clamp(
    Math.round(recurrence.interval),
    MIN_RECURRENCE_INTERVAL,
    MAX_RECURRENCE_INTERVAL,
  )

  if (recurrence.unit === "day") {
    return addCalendarDays(dateKey, interval)
  }
  if (recurrence.unit === "week") {
    return addCalendarDays(dateKey, interval * 7)
  }
  if (recurrence.unit === "month") {
    const zeroBasedTarget = current.year * 12 + (current.month - 1) + interval
    const year = Math.floor(zeroBasedTarget / 12)
    const month = zeroBasedTarget % 12 + 1
    const day = recurrence.useMonthEnd
      ? daysInMonth(year, month)
      : Math.min(clamp(recurrence.anchorDay, 1, 31), daysInMonth(year, month))
    return formatDateKey(year, month, day)
  }

  const year = current.year + interval
  const month = clamp(recurrence.anchorMonth, 1, 12)
  let day = clamp(recurrence.anchorDay, 1, 31)

  if (month === 2 && day === 29 && !isLeapYear(year)) {
    if (recurrence.leapDayPolicy === "mar1") {
      return formatDateKey(year, 3, 1)
    }
    day = 28
  } else {
    day = Math.min(day, daysInMonth(year, month))
  }
  return formatDateKey(year, month, day)
}

export function advanceManualItem(
  item: ManualDueItem,
  options: { skipToFuture?: boolean; now?: Date } = {},
): ManualDueItem {
  const now = options.now ?? new Date()
  if (!item.recurrence) {
    return { ...item, enabled: false, updatedAt: now.getTime() }
  }

  let dueDate = nextOccurrence(item.dueDate, item.recurrence)
  if (options.skipToFuture) {
    let guard = 0
    while (!isOccurrenceInFuture(item, dueDate, now) && guard < 10000) {
      const next = nextOccurrence(dueDate, item.recurrence)
      if (next === dueDate) break
      dueDate = next
      guard += 1
    }
    if (!isOccurrenceInFuture(item, dueDate, now)) {
      throw new Error("累计周期过多，无法安全跳至未来；请先手动调整到期日期。")
    }
  }

  return { ...item, dueDate, updatedAt: now.getTime() }
}

export function isOccurrenceInFuture(
  item: Pick<ManualDueItem, "includesTime" | "hour" | "minute" | "remindBeforeDays">,
  dateKey: string,
  now = new Date(),
): boolean {
  const effectiveDateKey = actionDateKey(dateKey, item.remindBeforeDays)
  if (item.includesTime) {
    return dateKeyToLocalDate(
      effectiveDateKey,
      true,
      item.hour,
      item.minute,
    ).getTime() > now.getTime()
  }
  return calendarDayDifference(localDateKey(now), effectiveDateKey) > 0
}

type DueStatusInput = {
  dueDate: string
  includesTime: boolean
  hour: number
  minute: number
  dueTimestamp?: number
  remindBeforeDays?: number
}

export function actionTimestamp(item: DueStatusInput): number {
  const remindBeforeDays = normalizeRemindBeforeDays(item.remindBeforeDays)
  if (
    remindBeforeDays === 0
    && typeof item.dueTimestamp === "number"
    && Number.isFinite(item.dueTimestamp)
  ) {
    return item.dueTimestamp
  }
  return dateKeyToLocalDate(
    actionDateKey(item.dueDate, remindBeforeDays),
    item.includesTime,
    item.hour,
    item.minute,
  ).getTime()
}

export function dueStatus(
  item: DueStatusInput,
  now = new Date(),
): { days: number; overdue: boolean; needsAction: boolean; label: string; color: string } {
  const actualDeadline = typeof item.dueTimestamp === "number" && Number.isFinite(item.dueTimestamp)
    ? item.dueTimestamp
    : dateKeyToLocalDate(item.dueDate, true, item.hour, item.minute).getTime()
  const actualDateKey = item.includesTime && Number.isFinite(actualDeadline)
    ? localDateKey(new Date(actualDeadline))
    : item.dueDate
  const actualDays = calendarDayDifference(localDateKey(now), actualDateKey)
  const actualTimedAndPassed = item.includesTime
    && actualDays === 0
    && actualDeadline <= now.getTime()

  if (actualDays < 0) {
    return {
      days: actualDays,
      overdue: true,
      needsAction: true,
      label: `逾期 ${Math.abs(actualDays)} 天`,
      color: "systemRed",
    }
  }
  if (actualTimedAndPassed) {
    return { days: 0, overdue: true, needsAction: true, label: "已到期", color: "systemRed" }
  }
  if (actualDays === 0) {
    return { days: 0, overdue: false, needsAction: true, label: "今天", color: "systemOrange" }
  }

  const remindBeforeDays = normalizeRemindBeforeDays(item.remindBeforeDays)
  const effectiveDateKey = actionDateKey(actualDateKey, remindBeforeDays)
  const days = calendarDayDifference(localDateKey(now), effectiveDateKey)
  if (remindBeforeDays > 0 && days <= 0) {
    return { days: 0, overdue: false, needsAction: true, label: "需处理", color: "systemOrange" }
  }
  if (days === 1) {
    return {
      days,
      overdue: false,
      needsAction: false,
      label: remindBeforeDays > 0 ? "明天提醒" : "明天",
      color: "systemOrange",
    }
  }
  return {
    days,
    overdue: false,
    needsAction: false,
    label: remindBeforeDays > 0 ? `${days} 天后提醒` : `${days} 天后`,
    color: days <= 7 ? "systemOrange" : "secondaryLabel",
  }
}

function parseBoundedIntegerInput(
  value: string,
  minimum: number,
  maximum: number,
): number | null {
  const normalized = value.trim()
  if (!/^\d+$/.test(normalized)) return null
  const parsed = Number(normalized)
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) return null
  return parsed
}

function normalizeRemindBeforeDays(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return MIN_REMIND_BEFORE_DAYS
  return clamp(Math.round(value), MIN_REMIND_BEFORE_DAYS, MAX_REMIND_BEFORE_DAYS)
}

export function humanDate(
  dateKey: string,
  includesTime = false,
  hour = 0,
  minute = 0,
): string {
  const parts = parseDateKey(dateKey)
  if (!parts) return dateKey
  const currentYear = new Date().getFullYear()
  const prefix = parts.year === currentYear ? "" : `${parts.year}年`
  const time = includesTime ? ` ${pad2(hour)}:${pad2(minute)}` : ""
  return `${prefix}${parts.month}月${parts.day}日${time}`
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
