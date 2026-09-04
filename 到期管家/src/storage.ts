import {
  advanceManualItem,
  dateKeyToLocalDate,
  localDateKey,
  MAX_REMIND_BEFORE_DAYS,
  MAX_RECURRENCE_INTERVAL,
  MIN_REMIND_BEFORE_DAYS,
  MIN_RECURRENCE_INTERVAL,
  parseDateKey,
} from "./date"
import { normalizeIconOverride, resolveDueIcon } from "./icons"
import { isItemKind, itemKindPriority } from "./item_kinds"
import { normalizeManualItemID } from "./item_ids"
export { normalizeManualItemID } from "./item_ids"
import { loadNotificationSettings, normalizeNotificationSettings, NOTIFICATION_SETTINGS_KEY } from "./notifications"
import type { NotificationSettings } from "./notifications"
import type {
  AppSettings,
  AppState,
  CompletionRecord,
  DisplayDueItem,
  LocalSnapshot,
  ManualDueItem,
  RecurrenceRule,
  RecurrenceUnit,
  WidgetActionStatus,
} from "./types"

export const STATE_KEY = "due-manager-state-v1"
export const REMINDER_SNAPSHOT_KEY = "due-manager-reminders-v1"
export const WIDGET_ACTION_STATUS_KEY = "due-manager-widget-action-v1"
export const SHARED_STORAGE_OPTIONS = { shared: true } as const
export const LOCAL_SNAPSHOTS_KEY = "due-manager-local-snapshots-v1"
export const MAX_LOCAL_SNAPSHOTS = 10
export const MAX_COMPLETION_HISTORY = 100
export const RECOVERY_ARCHIVE_KEY = "due-manager-recovery-archive-v1"
/** Milliseconds through 9999-12-31; always well below Number.MAX_SAFE_INTEGER. */
export const MAX_STATE_TIMESTAMP = 253402300799999

export interface RecoveryStatus {
  status: "ready" | "missing" | "damaged" | "unsupported"
  canRestore: boolean
  message: string | null
  archiveCount: number
}

interface RawRecoveryContext {
  stateRaw: unknown
  stateSource: "shared" | "private" | "missing"
  snapshotsRaw: unknown
  notificationSettingsRaw: unknown
}

interface RecoveryArchiveEntry extends RawRecoveryContext {
  id: string
  createdAt: number
  reason: string
}

export type ManualCompletionResult = "applied" | "stale" | "missing"

const DEFAULT_SETTINGS: AppSettings = {
  includeReminders: false,
  reminderHorizonDays: 730,
  reminderCalendarIDs: [],
  showAmounts: true,
}

export function defaultState(now = Date.now()): AppState {
  assertStateTimestamp(now)
  return {
    schemaVersion: 3,
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
  if (shared != null) return normalizeStoredState(shared)

  // Versions before 1.2.1 used the current script's private domain. Copy a
  // validated snapshot once so future package replacements keep the data.
  const legacy = Storage.get<unknown>(STATE_KEY)
  const state = legacy != null ? normalizeStoredState(legacy) : defaultState()
  if (legacy != null && !Storage.set(STATE_KEY, state, SHARED_STORAGE_OPTIONS)) {
    throw new Error(
      "检测到旧版到期管家数据，但无法迁移到共享存储；旧数据仍已保留，请确认设备存储空间后重试。",
    )
  }
  return state
}

export function saveState(state: AppState, snapshotReason = "自动备份"): boolean {
  const previous = Storage.get<unknown>(STATE_KEY, SHARED_STORAGE_OPTIONS)
  if (previous != null && !saveSnapshotOfState(normalizeStoredState(previous), snapshotReason)) {
    return false
  }
  return writeState(state)
}

function writeState(state: AppState): boolean {
  assertStateMetadata(state)
  return Storage.set(STATE_KEY, {
    ...state,
    schemaVersion: 3,
    updatedAt: Math.max(Date.now(), state.updatedAt),
    completionHistory: (state.completionHistory ?? []).slice(0, MAX_COMPLETION_HISTORY),
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

export function upsertItem(
  item: ManualDueItem,
  expectedUpdatedAt?: number,
): AppState {
  assertItemMetadata(item)
  const current = loadState()
  const index = current.items.findIndex(candidate => candidate.id === item.id)
  assertExpectedItemRevision(current, index, expectedUpdatedAt, "保存")
  const items = [...current.items]
  const revised = {
    ...item,
    updatedAt: incrementRevision(item.updatedAt, index >= 0 ? current.items[index].updatedAt : undefined),
  }
  if (index >= 0) items[index] = revised
  else items.push(revised)
  const next = { ...current, items, updatedAt: Date.now() }
  return persistOrThrow(next)
}

export function deleteItem(id: string, expectedUpdatedAt?: number): AppState {
  const current = loadState()
  const index = current.items.findIndex(item => item.id === id)
  assertExpectedItemRevision(current, index, expectedUpdatedAt, "删除")
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
    remindBeforeDays: MIN_REMIND_BEFORE_DAYS,
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
        remindBeforeDays: item.remindBeforeDays,
        dueTimestamp: dateKeyToLocalDate(
          item.dueDate,
          item.includesTime,
          item.hour,
          item.minute,
        ).getTime(),
        amount: state.settings.showAmounts ? item.amount : "",
        note: item.note,
        priority: itemKindPriority(item.kind),
        stale: false,
        canComplete: true,
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

  const revision = nextRevision(state, current, nowMs)
  const items = [...state.items]
  items[index] = { ...advanced, updatedAt: revision }
  const record = manualCompletionRecord(current, items[index], nowMs, false)
  return {
    result: "applied",
    state: {
      ...state,
      items,
      updatedAt: revision,
      completionHistory: appendCompletionRecord(state, record),
    },
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

/** The editor may save edits and complete in one atomic state write. */
export function completeManualItem(
  item: ManualDueItem,
  expectedUpdatedAt?: number,
  skipToFuture = false,
  nowMs = Date.now(),
): AppState {
  assertItemMetadata(item)
  const current = loadState()
  const index = current.items.findIndex(candidate => candidate.id === item.id)
  assertExpectedItemRevision(current, index, expectedUpdatedAt, "保存")
  if (index < 0) throw new Error("事项已不存在，请返回后刷新。")
  const advanced = advanceManualItem(item, { skipToFuture, now: new Date(nowMs) })
  if (item.recurrence && advanced.dueDate === item.dueDate) {
    throw new Error("周期规则没有生成下一期，为保护数据，本次完成已取消。")
  }
  const after = { ...advanced, updatedAt: nextRevision(current, current.items[index], nowMs) }
  const items = [...current.items]
  items[index] = after
  return persistOrThrow({
    ...current,
    items,
    updatedAt: after.updatedAt,
    completionHistory: appendCompletionRecord(current, manualCompletionRecord(item, after, nowMs, skipToFuture)),
  })
}

export function listCompletionHistory(): CompletionRecord[] {
  return loadState().completionHistory ?? []
}

export function undoManualCompletion(recordID: string, nowMs = Date.now()): AppState {
  const current = loadState()
  const history = current.completionHistory ?? []
  const record = history.find(entry => entry.id === recordID)
  if (!record || record.undoneAt != null) throw new Error("该完成记录已不存在或已撤销。")
  if (record.source !== "manual" || !record.before || !record.after) {
    throw new Error("Apple 提醒事项请在系统提醒事项 App 中撤销；本脚本无法安全验证系统事项的后续变更。")
  }
  const index = current.items.findIndex(item => item.id === record.itemID)
  const item = index >= 0 ? current.items[index] : null
  if (!item || JSON.stringify(item) !== JSON.stringify(record.after)) {
    throw new Error("该事项在完成后已被编辑、再次完成或删除。为保护新数据，无法撤销这条记录。")
  }
  const revision = nextRevision(current, item, nowMs)
  const items = [...current.items]
  items[index] = { ...record.before, updatedAt: revision }
  return persistOrThrow({
    ...current,
    items,
    updatedAt: revision,
    completionHistory: history.map(entry => entry.id === recordID ? { ...entry, undoneAt: nowMs } : entry),
  })
}

/** Called only after the system reports a successful Reminder.save(). */
export function recordReminderCompletion(
  item: Pick<DisplayDueItem, "id" | "title" | "dueDate">,
  nowMs = Date.now(),
): void {
  assertStateTimestamp(nowMs)
  const current = loadState()
  persistOrThrow({
    ...current,
    completionHistory: appendCompletionRecord(current, {
      id: makeID(), source: "reminder", itemID: item.id, title: item.title.trim() || "未命名提醒",
      dueDate: item.dueDate, completedAt: nowMs, action: "complete", undoneAt: null,
    }),
    updatedAt: incrementRevision(nowMs, current.updatedAt),
  })
}

export function createLocalSnapshot(reason: string): LocalSnapshot {
  const snapshot = makeSnapshot(loadState(), reason)
  if (!writeSnapshot(snapshot)) throw new Error("无法保存本地备份；为保护数据，本次操作已取消，请检查设备存储空间。")
  return snapshot
}

/** Read-only startup preflight. Storage errors never trigger a reset or write. */
export function readRecoveryStatus(): RecoveryStatus {
  let archiveCount = 0
  try {
    const context = readRawRecoveryContext()
    const archives = readRecoveryArchives()
    archiveCount = archives.length
    const unsupported = unsupportedRecoveryReason(context)
    if (unsupported) return { status: "unsupported", canRestore: false, message: unsupported, archiveCount }
    const issues: string[] = []
    if (context.stateRaw != null) {
      try { normalizeStoredState(context.stateRaw) } catch (error) { issues.push(String(error)) }
    }
    try { normalizeLocalSnapshots(context.snapshotsRaw) } catch (error) { issues.push(String(error)) }
    if (issues.length) return { status: "damaged", canRestore: true, message: issues.join("\n"), archiveCount }
    return { status: context.stateRaw == null ? "missing" : "ready", canRestore: true, message: null, archiveCount }
  } catch (error) {
    return {
      status: "damaged", canRestore: false, archiveCount,
      message: `无法安全读取原始存储或恢复档案。未修改任何数据，请先重试或导出可读取的原始数据：${String(error)}`,
    }
  }
}

/** A forensic export, not an importable backup. Includes current raw data even for future schemas. */
export function readRecoveryArchiveData(): unknown {
  const archiveRaw = Storage.get<unknown>(RECOVERY_ARCHIVE_KEY, SHARED_STORAGE_OPTIONS)
  return {
    format: "scripting-due-manager-recovery-archive", version: 1, exportedAt: Date.now(),
    current: readRawRecoveryContext(),
    entries: isRecord(archiveRaw) && Array.isArray(archiveRaw.entries) ? archiveRaw.entries : [],
    // Preserve malformed archive metadata too; this function must not normalize
    // away the very evidence a repair/export is meant to retain.
    archiveRaw,
  }
}

export function listLocalSnapshots(): LocalSnapshot[] {
  const raw = Storage.get<unknown>(LOCAL_SNAPSHOTS_KEY, SHARED_STORAGE_OPTIONS)
  return normalizeLocalSnapshots(raw)
}

function normalizeLocalSnapshots(raw: unknown): LocalSnapshot[] {
  if (raw == null) return []
  if (!isRecord(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.snapshots)) {
    throw new Error("无法保存：本地备份索引无法读取，为避免覆盖已有备份，已停止写入。")
  }
  return raw.snapshots.slice(0, MAX_LOCAL_SNAPSHOTS).map((value: unknown) => {
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.reason !== "string"
      || typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt) || !isRecord(value.state)) {
      throw new Error("本地备份记录损坏，已保留原数据。")
    }
    return {
      id: value.id, reason: value.reason, createdAt: value.createdAt, state: normalizeStoredState(value.state),
      ...(value.notificationSettings != null ? { notificationSettings: normalizeNotificationSettings(value.notificationSettings) } : {}),
    }
  })
}

export function restoreStateFromBackup(
  state: AppState,
  reason = "导入前备份",
  notificationSettings?: NotificationSettings,
): AppState {
  assertStateMetadata(state)
  const context = readRawRecoveryContext()
  const unsupported = unsupportedRecoveryReason(context)
  if (unsupported) throw new Error(unsupported)
  let current: AppState | null = null
  if (context.stateRaw != null) {
    try { current = normalizeStoredState(context.stateRaw) } catch { /* preserved verbatim below */ }
  }
  let snapshotsDamaged = false
  try { normalizeLocalSnapshots(context.snapshotsRaw) } catch { snapshotsDamaged = true }
  // A corrupt current state contributes no trusted revisions. The imported
  // state is already validated, and a fresh local revision invalidates its UI.
  const revision = [...(current?.items ?? []), ...state.items].reduce(
    (latest, item) => incrementRevision(latest, item.updatedAt),
    incrementRevision(Date.now(), current?.updatedAt, state.updatedAt),
  )
  const originalItems = new Map(state.items.map(item => [item.id, item]))
  const next = {
    ...state,
    updatedAt: revision,
    // Invalidate every previously rendered widget button, including matching old IDs.
    items: state.items.map(item => ({ ...item, updatedAt: revision })),
    completionHistory: (state.completionHistory ?? []).map(record => {
      // Restore eligibility, not blanket permission: only a history entry
      // whose exact saved after-state still matches the imported item gets
      // re-signed. Records superseded by edits/completions remain stale.
      const original = originalItems.get(record.itemID)
      return record.source === "manual" && record.undoneAt == null && record.after && original
        && JSON.stringify(original) === JSON.stringify(record.after)
        ? { ...record, after: { ...record.after, updatedAt: revision } }
        : record
    }),
  }
  // Keep a recoverable original before touching either store. Restore never
  // auto-enables notifications; the user must review and enable them again.
  const stateDamaged = context.stateRaw != null && current == null
  if (stateDamaged || snapshotsDamaged) {
    archiveRawRecoveryContext(context, reason)
    if (snapshotsDamaged) {
      const preserved = current ? [makeSnapshot(current, reason)] : []
      if (!Storage.set(LOCAL_SNAPSHOTS_KEY, { schemaVersion: 1, snapshots: preserved }, SHARED_STORAGE_OPTIONS)) {
        throw new Error("恢复失败：原始快照索引已隔离保留，但无法写入新索引，主数据未被替换。")
      }
    }
  } else if (!saveSnapshotOfState(current ?? defaultState(), reason)) {
    throw new Error("恢复失败：无法保存恢复前备份，原数据没有被替换。")
  }
  const previousNotifications = normalizeNotificationSettings(context.notificationSettingsRaw)
  const restoredNotifications = normalizeNotificationSettings({
    ...(notificationSettings ?? previousNotifications), enabled: false,
  })
  if (!Storage.set(NOTIFICATION_SETTINGS_KEY, restoredNotifications, SHARED_STORAGE_OPTIONS)) {
    throw new Error("恢复失败：无法安全关闭并恢复通知设置，原事项没有被替换。")
  }
  let saved = false
  try { saved = writeState(next) } catch { /* handled by rollback below */ }
  if (!saved) {
    let rolledBack = false
    try {
      rolledBack = context.notificationSettingsRaw == null
        ? (Storage.remove(NOTIFICATION_SETTINGS_KEY, SHARED_STORAGE_OPTIONS), true)
        : Storage.set(NOTIFICATION_SETTINGS_KEY, context.notificationSettingsRaw, SHARED_STORAGE_OPTIONS)
    } catch { /* report the unsuccessful rollback without losing the archive */ }
    throw new Error(rolledBack
      ? "恢复失败：无法写入数据，原事项和通知设置没有被替换。"
      : "恢复失败：原事项没有被替换；通知设置回滚失败，请检查通知开关。本地备份仍已保留。")
  }
  return next
}

export function restoreLocalSnapshot(id: string): AppState {
  const snapshot = listLocalSnapshots().find(entry => entry.id === id)
  if (!snapshot) throw new Error("找不到这份本地备份，请刷新备份列表。")
  return restoreStateFromBackup(snapshot.state, "恢复前备份", snapshot.notificationSettings)
}

export function writeWidgetActionError(message: string, now = Date.now()): void {
  const status: WidgetActionStatus = {
    schemaVersion: 1,
    eventID: makeID(),
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
  return readWidgetActionStatus(now)?.message ?? null
}

export function readWidgetActionStatus(now = Date.now()): WidgetActionStatus | null {
  const shared = Storage.get<unknown>(WIDGET_ACTION_STATUS_KEY, SHARED_STORAGE_OPTIONS)
  const legacy = shared == null ? Storage.get<unknown>(WIDGET_ACTION_STATUS_KEY) : null
  const raw = shared ?? legacy
  if (!isRecord(raw)
    || raw.schemaVersion !== 1
    || typeof raw.createdAt !== "number"
    || !Number.isFinite(raw.createdAt)
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
  return {
    schemaVersion: 1, createdAt: raw.createdAt, message: raw.message.slice(0, 160),
    ...(typeof raw.eventID === "string" && raw.eventID ? { eventID: raw.eventID } : {}),
  }
}

export function findItem(id: string): ManualDueItem | null {
  return loadState().items.find(item => item.id === id) ?? null
}

export function normalizeState(raw: unknown): AppState {
  if (!isRecord(raw)) return defaultState()
  if (
    Object.prototype.hasOwnProperty.call(raw, "schemaVersion")
    && raw.schemaVersion !== 1
    && raw.schemaVersion !== 2
    && raw.schemaVersion !== 3
  ) {
    throw new Error("检测到不受支持的数据版本；为保护原数据，本脚本没有修改它。")
  }
  const rawItems = Array.isArray(raw.items) ? raw.items : []
  const normalizedItems = rawItems
    .map((value, index) => normalizeItem(value, index))
    .filter((item): item is ManualDueItem => item != null)
  const items = uniqueItemIDs(normalizedItems)
  return {
    schemaVersion: 3,
    items,
    settings: normalizeSettings(raw.settings),
    updatedAt: finiteNumber(raw.updatedAt, Date.now()),
    completionHistory: normalizeCompletionHistory(raw.completionHistory),
  }
}

/** Stored data must never silently discard malformed records on the next edit. */
function normalizeStoredState(raw: unknown): AppState {
  if (!isRecord(raw) || !Array.isArray(raw.items)) {
    throw new Error("无法读取已保存的数据结构；原数据已保留，未创建空白数据覆盖它。")
  }
  const state = normalizeState(raw)
  assertStateMetadata(state)
  if (state.items.length !== raw.items.length) {
    throw new Error("已保存的数据含无法识别的事项。为避免丢弃这些记录，已停止读取和写入；原数据仍已保留。")
  }
  if (raw.completionHistory != null && (!Array.isArray(raw.completionHistory)
    || state.completionHistory!.length !== Math.min(raw.completionHistory.length, MAX_COMPLETION_HISTORY))) {
    throw new Error("完成记录数据损坏，已停止写入并保留原数据。")
  }
  return state
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
      ? normalizeManualItemID(raw.id)
      : stableLegacyID(raw, index),
    title,
    kind: isItemKind(raw.kind) ? raw.kind : "custom",
    iconName: normalizeIconOverride(raw.iconName),
    dueDate,
    includesTime: raw.includesTime === true,
    hour: clampInteger(raw.hour, 0, 23, 9),
    minute: clampInteger(raw.minute, 0, 59, 0),
    remindBeforeDays: clampInteger(
      raw.remindBeforeDays,
      MIN_REMIND_BEFORE_DAYS,
      MAX_REMIND_BEFORE_DAYS,
      MIN_REMIND_BEFORE_DAYS,
    ),
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
  const reserved = new Set(items.map(item => item.id))
  return items.map(item => {
    if (!seen.has(item.id)) {
      seen.add(item.id)
      return item
    }

    let suffix = 2
    let id = duplicateItemID(item.id, suffix)
    while (seen.has(id) || reserved.has(id)) {
      suffix += 1
      id = duplicateItemID(item.id, suffix)
    }
    seen.add(id)
    return { ...item, id }
  })
}

function duplicateItemID(base: string, suffix: number): string {
  const ending = `-duplicate-${suffix}`
  return `${base.slice(0, 160 - ending.length)}${ending}`
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
    interval: clampInteger(
      raw.interval,
      MIN_RECURRENCE_INTERVAL,
      MAX_RECURRENCE_INTERVAL,
      MIN_RECURRENCE_INTERVAL,
    ),
    anchorDay: clampInteger(raw.anchorDay, 1, 31, date.day),
    anchorMonth: clampInteger(raw.anchorMonth, 1, 12, date.month),
    useMonthEnd: raw.useMonthEnd === true,
    leapDayPolicy: raw.leapDayPolicy === "mar1" ? "mar1" : "feb28",
  }
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

function nextRevision(state: AppState, item: ManualDueItem, nowMs = Date.now()): number {
  return incrementRevision(nowMs, state.updatedAt, item.updatedAt)
}

export function isStateTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_STATE_TIMESTAMP
}

function assertStateTimestamp(value: unknown): asserts value is number {
  if (!isStateTimestamp(value)) throw new Error("数据时间戳或版本号损坏，必须是合理范围内的安全整数。原数据未被覆盖，请从有效备份恢复。")
}

function incrementRevision(requested: number, ...previous: Array<number | undefined>): number {
  assertStateTimestamp(requested)
  let revision = requested
  for (const value of previous) {
    if (value == null) continue
    assertStateTimestamp(value)
    revision = Math.max(revision, value + 1)
  }
  assertStateTimestamp(revision)
  return revision
}

function assertItemMetadata(item: ManualDueItem): void {
  assertStateTimestamp(item.createdAt)
  assertStateTimestamp(item.updatedAt)
}

function assertStateMetadata(state: AppState): void {
  assertStateTimestamp(state.updatedAt)
  for (const item of state.items) assertItemMetadata(item)
  for (const record of state.completionHistory ?? []) {
    assertStateTimestamp(record.completedAt)
    if (record.undoneAt != null) assertStateTimestamp(record.undoneAt)
    if (record.before) assertItemMetadata(record.before)
    if (record.after) assertItemMetadata(record.after)
  }
}

function manualCompletionRecord(before: ManualDueItem, after: ManualDueItem, nowMs: number, skip: boolean): CompletionRecord {
  return {
    id: makeID(), source: "manual", itemID: before.id, title: before.title,
    dueDate: before.dueDate, completedAt: nowMs, action: skip ? "skip" : "complete",
    undoneAt: null, before: { ...before }, after: { ...after },
  }
}

function appendCompletionRecord(state: AppState, record: CompletionRecord): CompletionRecord[] {
  return [record, ...(state.completionHistory ?? [])].slice(0, MAX_COMPLETION_HISTORY)
}

function normalizeCompletionHistory(raw: unknown): CompletionRecord[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, MAX_COMPLETION_HISTORY).flatMap((value, index) => {
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.itemID !== "string"
      || typeof value.title !== "string" || !parseDateKey(value.dueDate)
      || (value.source !== "manual" && value.source !== "reminder")
      || typeof value.completedAt !== "number" || !Number.isFinite(value.completedAt)) return []
    const before = value.source === "manual" ? normalizeItem(value.before, index) : null
    const after = value.source === "manual" ? normalizeItem(value.after, index) : null
    if (value.source === "manual" && (!before || !after)) return []
    return [{
      id: value.id, source: value.source,
      itemID: value.source === "manual" ? normalizeManualItemID(value.itemID) : value.itemID,
      title: value.source === "reminder" && !value.title.trim() ? "未命名提醒" : value.title,
      dueDate: value.dueDate, completedAt: value.completedAt,
      action: value.action === "skip" ? "skip" as const : "complete" as const,
      undoneAt: typeof value.undoneAt === "number" && Number.isFinite(value.undoneAt) ? value.undoneAt : null,
      ...(before && after ? { before, after } : {}),
    }]
  })
}

function makeSnapshot(state: AppState, reason: string): LocalSnapshot {
  return {
    id: makeID(), createdAt: Date.now(), reason: reason.slice(0, 80), state,
    notificationSettings: loadNotificationSettings(),
  }
}

function writeSnapshot(snapshot: LocalSnapshot): boolean {
  const snapshots = listLocalSnapshots()
  return Storage.set(LOCAL_SNAPSHOTS_KEY, {
    schemaVersion: 1,
    snapshots: [snapshot, ...snapshots].slice(0, MAX_LOCAL_SNAPSHOTS),
  }, SHARED_STORAGE_OPTIONS)
}

function saveSnapshotOfState(state: AppState, reason: string): boolean {
  return writeSnapshot(makeSnapshot(state, reason))
}

function readRawRecoveryContext(): RawRecoveryContext {
  const shared = Storage.get<unknown>(STATE_KEY, SHARED_STORAGE_OPTIONS)
  const legacy = shared == null ? Storage.get<unknown>(STATE_KEY) : null
  return {
    stateRaw: shared ?? legacy,
    stateSource: shared != null ? "shared" : legacy != null ? "private" : "missing",
    snapshotsRaw: Storage.get<unknown>(LOCAL_SNAPSHOTS_KEY, SHARED_STORAGE_OPTIONS),
    notificationSettingsRaw: Storage.get<unknown>(NOTIFICATION_SETTINGS_KEY, SHARED_STORAGE_OPTIONS),
  }
}

function unsupportedRecoveryReason(context: RawRecoveryContext): string | null {
  const unknownState = (raw: unknown) => isRecord(raw)
    && Object.prototype.hasOwnProperty.call(raw, "schemaVersion")
    && ![1, 2, 3].includes(raw.schemaVersion)
  if (unknownState(context.stateRaw)) {
    return "检测到不受支持或较新的主数据版本；本版本禁止覆盖它。请更新脚本，或先导出原始数据供检查。"
  }
  if (isRecord(context.notificationSettingsRaw)
    && Object.prototype.hasOwnProperty.call(context.notificationSettingsRaw, "schemaVersion")
    && context.notificationSettingsRaw.schemaVersion !== 1) {
    return "检测到不受支持或较新的通知设置版本；本版本禁止覆盖它。请先更新脚本或导出原始数据。"
  }
  const snapshots = context.snapshotsRaw
  if (isRecord(snapshots) && Object.prototype.hasOwnProperty.call(snapshots, "schemaVersion")
    && snapshots.schemaVersion !== 1) {
    return "检测到不受支持或较新的快照格式；为保护原始快照，本版本禁止覆盖它。"
  }
  if (isRecord(snapshots) && Array.isArray(snapshots.snapshots)
    && snapshots.snapshots.some((snapshot: unknown) => isRecord(snapshot) && unknownState(snapshot.state))) {
    return "快照中含不受支持或较新的数据版本；请先更新脚本，本版本不会覆盖这些数据。"
  }
  return null
}

function readRecoveryArchives(): RecoveryArchiveEntry[] {
  const raw = Storage.get<unknown>(RECOVERY_ARCHIVE_KEY, SHARED_STORAGE_OPTIONS)
  if (raw == null) return []
  if (!isRecord(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.entries)
    || raw.entries.some((entry: unknown) => !isRecord(entry) || typeof entry.id !== "string"
      || !isStateTimestamp(entry.createdAt) || typeof entry.reason !== "string")) {
    throw new Error("恢复档案索引无法安全读取；已有原始数据仍已保留，请先导出恢复档案。")
  }
  return raw.entries
}

function archiveRawRecoveryContext(context: RawRecoveryContext, reason: string): void {
  const entries = readRecoveryArchives()
  const entry: RecoveryArchiveEntry = { ...context, id: makeID(), createdAt: Date.now(), reason }
  // Unlike rolling convenience snapshots, quarantined originals are never
  // automatically pruned: they may be the sole surviving damaged source.
  if (!Storage.set(RECOVERY_ARCHIVE_KEY, { schemaVersion: 1, entries: [entry, ...entries] }, SHARED_STORAGE_OPTIONS)) {
    throw new Error("无法隔离保留原始损坏数据，为保护原数据，本次恢复已取消。")
  }
}

function persistOrThrow(state: AppState): AppState {
  if (!saveState(state)) {
    throw new Error("无法保存到期管家数据，请确认设备存储空间后重试。")
  }
  return state
}

function assertExpectedItemRevision(
  state: AppState,
  itemIndex: number,
  expectedUpdatedAt: number | undefined,
  action: "保存" | "删除",
): void {
  if (expectedUpdatedAt === undefined) return
  const current = itemIndex >= 0 ? state.items[itemIndex] : null
  if (current && current.updatedAt === expectedUpdatedAt) return
  throw new Error(
    `该事项已在其他位置更新、完成或删除，为避免覆盖新数据，本次${action}已取消。请返回后重新打开该事项。`,
  )
}
