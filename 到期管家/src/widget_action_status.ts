import { clearWidgetActionError, readWidgetActionStatus } from "./storage"
import type { WidgetActionStatus } from "./types"

export type WidgetActionInspection = {
  event: WidgetActionStatus | null
  message: string | null
  readError: string | null
  outcome: "completed" | "unconfirmed" | "none" | "unavailable"
  title: string
  guidance: string
}

const COMPLETED_WARNINGS = new Set([
  "提醒已完成，但本地缓存未能更新",
  "提醒已完成，但本地缓存或完成记录未能保存",
  "事项已完成，但完成动画状态未能保存",
])

export function explainWidgetAction(message: string | null): WidgetActionInspection {
  if (!message) return {
    event: null, message: null, readError: null, outcome: "none", title: "暂无待检查的操作提示",
    guidance: "没有保留中的异常提示不代表所有事项都已完成。请以事项列表或 Apple 提醒事项中的实际状态为准。",
  }
  if (COMPLETED_WARNINGS.has(message)) return {
    event: null, message, readError: null, outcome: "completed", title: "事项已完成，后续更新出现问题",
    guidance: "无需再次完成本期。可返回主界面刷新组件；Apple 提醒事项请同时核对系统 App，完成记录或缓存可能尚未保存。",
  }
  return {
    event: null, message, readError: null, outcome: "unconfirmed", title: "请核对上次操作结果",
    guidance: "此提示不能证明事项仍未完成。请先核对完成记录和 Apple 提醒事项中的状态，再决定是否重试；刷新组件或清除提示不会再次完成事项。",
  }
}

export function inspectWidgetAction(): WidgetActionInspection {
  try {
    const event = readWidgetActionStatus()
    return { ...explainWidgetAction(event?.message ?? null), event }
  }
  catch (error) {
    return {
      event: null, message: null, readError: String(error), outcome: "unavailable", title: "暂时无法读取操作提示",
      guidance: "请检查设备存储后重新读取；无法读取不等于操作成功或没有异常。",
    }
  }
}

/** Acknowledge the displayed event, including newer events with identical wording. */
export function acknowledgeWidgetAction(expected: WidgetActionStatus): void {
  const current = readWidgetActionStatus()
  if (!current || current.eventID !== expected.eventID || current.createdAt !== expected.createdAt
    || current.message !== expected.message) throw new Error("操作提示已经变化，请重新读取后确认。")
  clearWidgetActionError()
  if (readWidgetActionStatus() != null) throw new Error("提示尚未清除或出现了新提示，请重新读取后确认。")
}
