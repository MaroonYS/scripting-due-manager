import type { ItemKind } from "./item_kinds"

export type { ItemKind } from "./item_kinds"

export type RecurrenceUnit = "day" | "week" | "month" | "year"

export interface RecurrenceRule {
  unit: RecurrenceUnit
  interval: number
  /** Original calendar-day anchor. Never derive this again from a clamped month. */
  anchorDay: number
  anchorMonth: number
  useMonthEnd: boolean
  leapDayPolicy: "feb28" | "mar1"
}

export interface ManualDueItem {
  id: string
  title: string
  kind: ItemKind
  /** null follows the title/type automatically; a value locks a local SF Symbol. */
  iconName: string | null
  /** Local calendar date in YYYY-MM-DD. Do not parse with new Date(dateKey). */
  dueDate: string
  includesTime: boolean
  hour: number
  minute: number
  recurrence: RecurrenceRule | null
  amount: string
  note: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface AppSettings {
  includeReminders: boolean
  reminderHorizonDays: number
  /** Empty means every Apple Reminders list. Values are Calendar identifiers. */
  reminderCalendarIDs: string[]
  showAmounts: boolean
}

export interface AppState {
  schemaVersion: 2
  items: ManualDueItem[]
  settings: AppSettings
  updatedAt: number
}

export interface CachedReminderItem {
  id: string
  title: string
  dueDate: string
  includesTime: boolean
  hour: number
  minute: number
  dueTimestamp: number
  calendarTitle: string
  priority: number
  /** False for read-only shared reminder lists. */
  canComplete: boolean
}

export interface ReminderSnapshot {
  schemaVersion: 1
  fetchedAt: number
  /** Query scope for this snapshot. Empty means every reminders list. */
  calendarFilterIDs: string[]
  items: CachedReminderItem[]
}

export interface DisplayDueItem {
  id: string
  source: "manual" | "reminder"
  /** Identifies this exact occurrence so an old widget button cannot complete a later one. */
  completionKey: string
  title: string
  kind: ItemKind | "reminder"
  iconName: string
  iconColor: string
  dueDate: string
  includesTime: boolean
  hour: number
  minute: number
  dueTimestamp: number
  amount: string
  note: string
  priority: number
  stale: boolean
  /** Whether the source permits completing this item from the widget. */
  canComplete: boolean
}

export interface ReminderLoadResult {
  items: DisplayDueItem[]
  fetchedAt: number | null
  /** True when this result came from a successful live EventKit query. */
  live: boolean
  fromCache: boolean
  error: string | null
}

export interface WidgetActionStatus {
  schemaVersion: 1
  createdAt: number
  message: string
}
