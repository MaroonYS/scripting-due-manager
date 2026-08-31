import { dueStatus, humanDate, localDateKey } from "./date"
import { itemKindDefinition } from "./item_kinds"
import type { DisplayDueItem, ItemKind, RecurrenceRule } from "./types"

export function kindLabel(kind: ItemKind | "reminder"): string {
  if (kind === "reminder") return "提醒事项"
  return itemKindDefinition(kind).label
}

export function kindIcon(kind: ItemKind | "reminder"): string {
  if (kind === "reminder") return "checklist"
  return itemKindDefinition(kind).icon
}

export function kindColor(kind: ItemKind | "reminder"): string {
  if (kind === "reminder") return "systemPink"
  return itemKindDefinition(kind).color
}

export function recurrenceLabel(rule: RecurrenceRule | null): string {
  if (!rule) return "不重复"
  const interval = rule.interval > 1 ? `每 ${rule.interval} ` : "每"
  if (rule.unit === "day") return `${interval}天`
  if (rule.unit === "week") return `${interval}周`
  if (rule.unit === "month") return rule.useMonthEnd ? `${interval}月月末` : `${interval}月`
  return `${interval}年`
}

export function displayDate(item: DisplayDueItem): string {
  if (item.includesTime && Number.isFinite(item.dueTimestamp)) {
    const date = new Date(item.dueTimestamp)
    return humanDate(localDateKey(date), true, date.getHours(), date.getMinutes())
  }
  return humanDate(item.dueDate, item.includesTime, item.hour, item.minute)
}

export function summaryText(items: DisplayDueItem[], now = new Date()): string {
  const statuses = items.map(item => dueStatus(item, now))
  const overdue = statuses.filter(status => status.overdue).length
  const today = statuses.filter(status => !status.overdue && status.days === 0).length
  if (overdue > 0 && today > 0) return `${overdue} 项逾期 · ${today} 项今天`
  if (overdue > 0) return `${overdue} 项已逾期`
  if (today > 0) return `${today} 项今天到期`
  return `${items.length} 项待跟进`
}

export function compactUpdateTime(timestamp: number | null): string {
  if (timestamp == null || timestamp <= 0) return "尚未同步"
  const date = new Date(timestamp)
  const today = new Date()
  const sameDay = date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
  if (sameDay) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
  }
  return `${date.getMonth() + 1}/${date.getDate()}`
}
