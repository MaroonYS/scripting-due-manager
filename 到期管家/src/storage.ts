import {
  advanceManualItem,
  dateKeyToLocalDate,
  localDateKey,
  parseDateKey,
} from "./date"
import { normalizeIconOverride, resolveDueIcon } from "./icons"
import type {
  AppSettings,
  AppState,
  DisplayDueItem,
  ItemKind,
  ManualDueItem,
  RecurrenceRule,
  RecurrenceUnit,
  WidgetActionStatus,
} from "./types"

export const STATE_KEY = "due-manager-state-v1"
export const REMINDER_SNAPSHOT_KEY = "due-manager-reminders-v1"
export const WIDGET_ACTION_STATUS_KEY = "due-manager-widget-action-v1"
export const SHARED_STORAGE_OPTIONS = { shared: true } as const

export type ManualCompletionResult = "applied" | "stale" | "missing"

const DEFAULT_SETTINGS: AppSettings = {
  includeReminders: false,
  reminderHorizonDays: 730,
  reminderCalendarIDs: [],
  showAmounts: true,
}

export function defaultState(now = Date.now()): AppState {
  return {
    schemaVersion: 1,
    items: [],
    settings: {
      ...DEFAULT_SETTINGS,
      reminderCalendarIDs: [...DEFAULT_SETTINGS.reminderCalendarIDs],
    },
    updatedAt: now,
  }
}

export function loadState(): AppState {
  const shared = Storage.get<unknown>(STATE_KEY, SHARED_STORAGE_OPTIONS)
  if (shared != null) return normalizeState(shared)

  // Versions before 1.2.1 used the current script's private domain. Copy a
  // validated snapshot once so future package replacements keep the data.
  const legacy = Storage.get<unknown>(STATE_KEY)
  const state = normalizeState(legacy)
  if (legacy != null) Storage.set(STATE_KEY, state, SHARED_STORAGE_OPTIONS)
  return state
}

export function saveState(state: AppState): boolean {
  return Storage.set(STATE_KEY, {
    ...state,
    schemaVersion: 1,
    updatedAt: Math.max(Date.now(), state.updatedAt),
  }, SHARED_STORAGE_OPTIONS)
}

export function updateSettings(settings: Partial<AppSettings>): AppState {
  const current = loadState()
  const next: AppState = {
    ...current,
    settings: normalizeSettings({ ...current.settings, ...settings }),
    updatedAt: Date.now(),
  }
  return persistOrThrow(next)
}

export function upsertItem(item: ManualDueItem): AppState {
  const current = loadState()
  const index = current.items.findIndex(candidate => candidate.id === item.id)
  const items = [...current.items]
  if (index >= 0) items[index] = item
  else items.push(item)
  const next = { ...current, items, updatedAt: Date.now() }
  return persistOrThrow(next)
}

export function deleteItem(id: string): AppState {
  const current = loadState()
  const next = {
    ...current,
    items: current.items.filter(item => item.id !== id),
    updatedAt: Date.now(),
  }
  return persistOrThrow(next)
}

export function createDraftItem(now = new Date()): ManualDueItem {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0)
  const timestamp = now.getTime()
  return {
    id: makeID(),
    title: "",
    kind: "custom",
    iconName: null,
    dueDate: localDateKey(tomorrow),
    includesTime: false,
    hour: 9,
    minute: 0,
    recurrence: null,
    amount: "",
    note: "",
    enabled: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function manualItemsForDisplay(state: AppState): DisplayDueItem[] {
  return state.items
    .filter(item => item.enabled)
    .map(item => {
      const icon = resolveDueIcon(item.title, item.kind, item.iconName)
      return {
        id: item.id,
        source: "manual" as const,
        completionKey: manualOccurrenceKey(item),
        title: item.title,
        kind: item.kind,
        iconName: icon.name,
        iconColor: icon.color,
        dueDate: item.dueDate,
        includesTime: item.includesTime,
        hour: item.hour,
        minute: item.minute,
        dueTimestamp: dateKeyToLocalDate(
          item.dueDate,
          item.includesTime,
          item.hour,
          item.minute,
        ).getTime(),
        amount: state.settings.showAmounts ? item.amount : "",
        note: item.note,
        priority: kindPriority(item.kind),
        stale: false,
      }
    })
}

export function manualOccurrenceKey(
  item: Pick<ManualDueItem, "dueDate" | "includesTime" | "hour" | "minute" | "updatedAt">,
): string {
  const clock = item.includesTime ? `${item.hour}:${item.minute}` : "date"
  return `${item.dueDate}|${clock}|${Math.trunc(item.updatedAt)}`
}

export function planManualCompletion(
  state: AppState,
  id: string,
  completionKey: string,
  nowMs = Date.now(),
): { result: ManualCompletionResult; state: AppState } {
  const index = state.items.findIndex(item => item.id === id)
  if (index < 0 || !state.items[index].enabled) {
    return { result: "missing", state }
  }

  const current = state.items[index]
  if (manualOccurrenceKey(current) !== completionKey) {
    return { result: "stale", state }
  }

  const advanced = advanceManualItem(current, {
    skipToFuture: false,
    now: new Date(nowMs),
  })
  if (current.recurrence && advanced.dueDate === current.dueDate) {
    throw new Error("周期规则没有生成下一期，为保护数据，本次完成已取消。")
  }

  const revision = Math.max(
    Math.trunc(nowMs),
    Math.trunc(current.updatedAt) + 1,
    Math.trunc(state.updatedAt) + 1,
  )
  const items = [...state.items]
  items[index] = { ...advanced, updatedAt: revision }
  return {
    result: "applied",
    state: { ...state, items, updatedAt: revision },
  }
}

export function completeManualOccurrence(
  id: string,
  completionKey: string,
  nowMs = Date.now(),
): ManualCompletionResult {
  const planned = planManualCompletion(loadState(), id, completionKey, nowMs)
  if (planned.result !== "applied") return planned.result
  if (!saveState(planned.state)) {
    throw new Error("无法保存完成状态，请确认设备存储空间后重试。")
  }
  return "applied"
}

export function writeWidgetActionError(message: string, now = Date.now()): void {
  const status: WidgetActionStatus = {
    schemaVersion: 1,
    createdAt: now,
    message: message.slice(0, 160),
  }
  Storage.set(WIDGET_ACTION_STATUS_KEY, status, SHARED_STORAGE_OPTIONS)
}

export function clearWidgetActionError(): void {
  Storage.remove(WIDGET_ACTION_STATUS_KEY, SHARED_STORAGE_OPTIONS)
  Storage.remove(WIDGET_ACTION_STATUS_KEY)
}

export function readWidgetActionError(now = Date.now()): string | null {
  const shared = Storage.get<unknown>(WIDGET_ACTION_STATUS_KEY, SHARED_STORAGE_OPTIONS)
  const legacy = shared == null ? Storage.get<unknown>(WIDGET_ACTION_STATUS_KEY) : null
  const raw = shared ?? legacy
  if (!isRecord(raw)
    || raw.schemaVersion !== 1
    || typeof raw.createdAt !== "number"
    || typeof raw.message !== "string"
  ) {
    return null
  }
  if (shared == null && legacy != null) {
    Storage.set(WIDGET_ACTION_STATUS_KEY, raw, SHARED_STORAGE_OPTIONS)
  }
  if (now - raw.createdAt > 30 * 60 * 1000 || now < raw.createdAt - 5 * 60 * 1000) {
    clearWidgetActionError()
    return null
  }
  return raw.message.slice(0, 160)
}

export function findItem(id: string): ManualDueItem | null {
  return loadState().items.find(item => item.id === id) ?? null
}

function normalizeState(raw: unknown): AppState {
  if (!isRecord(raw)) return defaultState()
  if (
    Object.prototype.hasOwnProperty.call(raw, "schemaVersion")
    && raw.schemaVersion !== 1
  ) {
    throw new Error("检测到不受支持的数据版本；为保护原数据，本脚本没有修改它。")
  }
  const rawItems = Array.isArray(raw.items) ? raw.items.slice(0, 1000) : []
  const normalizedItems = rawItems
    .map((value, index) => normalizeItem(value, index))
    .filter((item): item is ManualDueItem => item != null)
  const items = uniqueItemIDs(normalizedItems)
  return {
    schemaVersion: 1,
    items,
    settings: normalizeSettings(raw.settings),
    updatedAt: finiteNumber(raw.updatedAt, Date.now()),
  }
}

function normalizeSettings(raw: unknown): AppSettings {
  const value = isRecord(raw) ? raw : {}
  return {
    includeReminders: typeof value.includeReminders === "boolean"
      ? value.includeReminders
      : DEFAULT_SETTINGS.includeReminders,
    reminderHorizonDays: clampInteger(
      value.reminderHorizonDays,
      30,
      3650,
      DEFAULT_SETTINGS.reminderHorizonDays,
    ),
    reminderCalendarIDs: normalizeReminderCalendarIDs(value.reminderCalendarIDs),
    showAmounts: typeof value.showAmounts === "boolean"
      ? value.showAmounts
      : DEFAULT_SETTINGS.showAmounts,
  }
}

export function normalizeReminderCalendarIDs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const identifiers = new Set<string>()
  for (const value of raw.slice(0, 100)) {
    if (typeof value !== "string") continue
    const identifier = value.trim().slice(0, 512)
    if (identifier) identifiers.add(identifier)
  }
  return [...identifiers].sort()
}

function normalizeItem(raw: unknown, index: number): ManualDueItem | null {
  if (!isRecord(raw)) return null
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 120) : ""
  const dueDate = typeof raw.dueDate === "string" ? raw.dueDate : ""
  if (!title || !parseDateKey(dueDate)) return null
  const createdAt = finiteNumber(raw.createdAt, 0)
  return {
    id: typeof raw.id === "string" && raw.id
      ? raw.id.slice(0, 160)
      : stableLegacyID(raw, index),
    title,
    kind: isItemKind(raw.kind) ? raw.kind : "custom",
    iconName: normalizeIconOverride(raw.iconName),
    dueDate,
    includesTime: raw.includesTime === true,
    hour: clampInteger(raw.hour, 0, 23, 9),
    minute: clampInteger(raw.minute, 0, 59, 0),
    recurrence: normalizeRecurrence(raw.recurrence, dueDate),
    amount: typeof raw.amount === "string" ? raw.amount.slice(0, 60) : "",
    note: typeof raw.note === "string" ? raw.note.slice(0, 1000) : "",
    enabled: raw.enabled !== false,
    createdAt,
    updatedAt: finiteNumber(raw.updatedAt, createdAt),
  }
}

function uniqueItemIDs(items: ManualDueItem[]): ManualDueItem[] {
  const seen = new Set<string>()
  return items.map(item => {
    if (!seen.has(item.id)) {
      seen.add(item.id)
      return item
    }

    let suffix = 2
    let id = `${item.id}-duplicate-${suffix}`
    while (seen.has(id)) {
      suffix += 1
      id = `${item.id}-duplicate-${suffix}`
    }
    seen.add(id)
    return { ...item, id }
  })
}

function stableLegacyID(raw: Record<string, any>, index: number): string {
  const seed = [raw.title, raw.dueDate, raw.createdAt, index].map(String).join("\u001f")
  let hash = 2166136261
  for (let position = 0; position < seed.length; position += 1) {
    hash ^= seed.charCodeAt(position)
    hash = Math.imul(hash, 16777619)
  }
  return `due-legacy-${(hash >>> 0).toString(36)}-${index}`
}

function normalizeRecurrence(raw: unknown, dueDate: string): RecurrenceRule | null {
  if (!isRecord(raw) || !isRecurrenceUnit(raw.unit)) return null
  const date = parseDateKey(dueDate)!
  return {
    unit: raw.unit,
    interval: clampInteger(raw.interval, 1, 99, 1),
    anchorDay: clampInteger(raw.anchorDay, 1, 31, date.day),
    anchorMonth: clampInteger(raw.anchorMonth, 1, 12, date.month),
    useMonthEnd: raw.useMonthEnd === true,
    leapDayPolicy: raw.leapDayPolicy === "mar1" ? "mar1" : "feb28",
  }
}

function kindPriority(kind: ItemKind): number {
  if (kind === "creditCard") return 4
  if (kind === "bill") return 3
  if (kind === "subscription") return 2
  return 1
}

function isItemKind(value: unknown): value is ItemKind {
  return value === "creditCard"
    || value === "subscription"
    || value === "bill"
    || value === "custom"
}

function isRecurrenceUnit(value: unknown): value is RecurrenceUnit {
  return value === "day" || value === "week" || value === "month" || value === "year"
}

function isRecord(value: unknown): value is Record<string, any> {
  return value != null && typeof value === "object" && !Array.isArray(value)
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function clampInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

function makeID(): string {
  return `due-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function persistOrThrow(state: AppState): AppState {
  if (!saveState(state)) {
    throw new Error("无法保存到期管家数据，请确认设备存储空间后重试。")
  }
  return state
}
