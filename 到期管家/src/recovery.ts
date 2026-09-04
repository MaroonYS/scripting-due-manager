import { parseDateKey, MAX_RECURRENCE_INTERVAL, MAX_REMIND_BEFORE_DAYS } from "./date"
import { isItemKind } from "./item_kinds"
import { normalizeIconOverride } from "./icons"
import { loadNotificationSettings, normalizeNotificationSettings } from "./notifications"
import type { NotificationSettings } from "./notifications"
import { loadState, normalizeState, restoreStateFromBackup } from "./storage"
import type { AppState } from "./types"

export {
  createLocalSnapshot,
  listLocalSnapshots,
  restoreLocalSnapshot,
  listCompletionHistory,
  undoManualCompletion,
} from "./storage"

export const BACKUP_FORMAT = "scripting-due-manager-backup"
export const MAX_BACKUP_CHARACTERS = 16 * 1024 * 1024

export interface BackupPreview {
  state: AppState
  itemCount: number
  historyCount: number
  exportedAt: number
  schemaVersion: number
  notificationSettings?: NotificationSettings
}

/** Local JSON only. Apple Reminders records/notes are never exported as tasks. */
export function createBackupJSON(now = Date.now()): string {
  const json = JSON.stringify({
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: now,
    state: loadState(),
    notificationSettings: loadNotificationSettings(),
  }, null, 2)
  if (json.length > MAX_BACKUP_CHARACTERS) throw new Error("当前备份超过 16 MB 导入上限，未导出不可恢复的文件；现有数据没有改动。")
  return json
}

/** Reject malformed input rather than silently dropping or repairing its items. */
export function parseBackupJSON(json: string): BackupPreview {
  if (json.length > MAX_BACKUP_CHARACTERS) throw new Error("备份文件超过 16 MB，请使用较小的到期管家备份。")
  let raw: unknown
  try { raw = JSON.parse(json) } catch { throw new Error("不是有效的 JSON 备份文件。") }
  if (!record(raw) || raw.format !== BACKUP_FORMAT || raw.version !== 1
    || !finite(raw.exportedAt) || !record(raw.state)) {
    throw new Error("不是受支持的到期管家备份，未修改现有数据。")
  }
  const data = raw.state
  if (![1, 2, 3].includes(data.schemaVersion) || !Array.isArray(data.items)
    || !record(data.settings) || !finite(data.updatedAt)) {
    throw new Error("备份数据版本或结构无效，未修改现有数据。")
  }
  const ids = new Set<string>()
  for (const [index, item] of data.items.entries()) {
    validateItem(item, `第 ${index + 1} 条事项`)
    if (ids.has(item.id)) throw new Error(`备份包含重复事项 ID：${item.id}`)
    ids.add(item.id)
  }
  validateSettings(data.settings)
  if (raw.notificationSettings != null) validateNotificationSettings(raw.notificationSettings)
  if (data.completionHistory != null) {
    if (!Array.isArray(data.completionHistory) || data.completionHistory.length > 100) {
      throw new Error("备份完成记录无效或超过保留范围。")
    }
    const historyIDs = new Set<string>()
    for (const entry of data.completionHistory) {
      if (!record(entry) || !nonempty(entry.id) || historyIDs.has(entry.id) || !nonempty(entry.itemID)
        || !nonempty(entry.title) || !parseDateKey(entry.dueDate) || !finite(entry.completedAt)
        || !["manual", "reminder"].includes(entry.source) || !["complete", "skip"].includes(entry.action)
        || (entry.undoneAt !== null && !finite(entry.undoneAt))) {
        throw new Error("备份包含无效完成记录。")
      }
      historyIDs.add(entry.id)
      if (entry.source === "manual") {
        validateItem(entry.before, "完成前事项")
        validateItem(entry.after, "完成后事项")
        if (entry.before.id !== entry.itemID || entry.after.id !== entry.itemID) {
          throw new Error("完成记录与事项 ID 不一致。")
        }
      }
    }
  }
  const state = normalizeState(data)
  // Selected Apple list IDs are preserved verbatim; unavailable IDs continue
  // to fail closed in reminders.ts rather than silently widening to all lists.
  return {
    state,
    itemCount: state.items.length,
    historyCount: state.completionHistory?.length ?? 0,
    exportedAt: raw.exportedAt,
    schemaVersion: data.schemaVersion,
    ...(raw.notificationSettings != null ? { notificationSettings: normalizeNotificationSettings(raw.notificationSettings) } : {}),
  }
}

export function restoreBackupJSON(json: string): AppState {
  const preview = parseBackupJSON(json)
  return restoreStateFromBackup(preview.state, "导入前备份", preview.notificationSettings)
}

function validateNotificationSettings(value: unknown): void {
  if (!record(value) || value.schemaVersion !== 1 || typeof value.enabled !== "boolean"
    || !integer(value.hour, 0, 23) || !integer(value.minute, 0, 59)
    || typeof value.includeDueDate !== "boolean" || !Array.isArray(value.mutedItemIDs)
    || value.mutedItemIDs.some((id: unknown) => !boundedText(id, 160, true))
    || new Set(value.mutedItemIDs).size !== value.mutedItemIDs.length) {
    throw new Error("备份通知设置无效，导入已取消。")
  }
}

function validateItem(item: unknown, label: string): asserts item is Record<string, any> {
  if (!record(item) || !boundedText(item.id, 160, true) || !boundedText(item.title, 120, true)
    || !parseDateKey(item.dueDate) || !isItemKind(item.kind)
    || typeof item.includesTime !== "boolean" || !integer(item.hour, 0, 23) || !integer(item.minute, 0, 59)
    || typeof item.enabled !== "boolean" || !finite(item.createdAt) || !finite(item.updatedAt)
    || !boundedText(item.amount, 60) || !boundedText(item.note, 1000)
    || (item.remindBeforeDays != null && !integer(item.remindBeforeDays, 0, MAX_REMIND_BEFORE_DAYS))
    || (item.iconName != null && normalizeIconOverride(item.iconName) !== item.iconName)) {
    throw new Error(`${label}格式无效，导入已取消，未丢弃或覆盖任何现有事项。`)
  }
  const rule = item.recurrence
  if (rule != null && (!record(rule) || !["day", "week", "month", "year"].includes(rule.unit)
    || !integer(rule.interval, 1, MAX_RECURRENCE_INTERVAL) || !integer(rule.anchorDay, 1, 31)
    || !integer(rule.anchorMonth, 1, 12) || typeof rule.useMonthEnd !== "boolean"
    || !["feb28", "mar1"].includes(rule.leapDayPolicy))) {
    throw new Error(`${label}的周期规则无效，导入已取消。`)
  }
}

function validateSettings(settings: Record<string, any>): void {
  if (typeof settings.includeReminders !== "boolean" || typeof settings.showAmounts !== "boolean"
    || !integer(settings.reminderHorizonDays, 30, 3650) || !Array.isArray(settings.reminderCalendarIDs)
    || settings.reminderCalendarIDs.length > 100
    || settings.reminderCalendarIDs.some((id: unknown) => !boundedText(id, 512, true))
    || new Set(settings.reminderCalendarIDs).size !== settings.reminderCalendarIDs.length) {
    throw new Error("备份设置无效，尤其是提醒事项列表范围；导入已取消。")
  }
}

function record(value: unknown): value is Record<string, any> {
  return value != null && typeof value === "object" && !Array.isArray(value)
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function integer(value: unknown, low: number, high: number): boolean {
  return finite(value) && Number.isInteger(value) && value >= low && value <= high
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function boundedText(value: unknown, maximum: number, required = false): value is string {
  return typeof value === "string" && value.length <= maximum && (!required || value.trim() === value && value.length > 0)
}
