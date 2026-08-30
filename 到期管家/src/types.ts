export type ItemKind = "creditCard" | "subscription" | "bill" | "custom"

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
  showAmounts: boolean
}

export interface AppState {
  schemaVersion: 1
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
}

export interface ReminderSnapshot {
  schemaVersion: 1
  fetchedAt: number
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
}

export interface ReminderLoadResult {
  items: DisplayDueItem[]
  fetchedAt: number | null
  fromCache: boolean
  error: string | null
}

export interface WidgetActionStatus {
  schemaVersion: 1
  createdAt: number
  message: string
}
