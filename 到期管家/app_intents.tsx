import { AppIntentManager, AppIntentProtocol } from "scripting"
import {
  completeReminderOccurrence,
  findReminderDisplayItemForCompletion,
} from "./src/reminders"
import {
  clearWidgetActionError,
  completeManualOccurrence,
  writeWidgetActionError,
} from "./src/storage"
import {
  findManualDisplayItemForCompletion,
  writeWidgetCompletionFeedback,
} from "./src/widget_completion"
import {
  reloadUserWidgets,
  reloadWidgetsAfterStorageWrite,
} from "./src/widget_refresh"

export type CompleteDueItemParams = {
  source: "manual" | "reminder"
  id: string
  occurrenceKey: string
}

let completionIntentQueue: Promise<void> = Promise.resolve()

export const RefreshDueItemsIntent = AppIntentManager.register({
  name: "RefreshDueItems",
  protocol: AppIntentProtocol.AppIntent,
  perform: async (_params: undefined) => {
    await reloadUserWidgets()
  },
})

export const CompleteDueItemIntent = AppIntentManager.register<CompleteDueItemParams>({
  name: "CompleteDueItem",
  protocol: AppIntentProtocol.AppIntent,
  perform: params => {
    const operation = completionIntentQueue
      .catch(() => undefined)
      .then(() => performCompleteDueItem(params))
    completionIntentQueue = operation.catch(() => undefined)
    return operation
  },
})

async function performCompleteDueItem(params: CompleteDueItemParams): Promise<void> {
  try {
    if (!isCompletionParams(params)) {
      throw new Error("Invalid completion parameters")
    }

    const feedbackItem = params.source === "manual"
      ? findManualDisplayItemForCompletion(params.id, params.occurrenceKey)
      : findReminderDisplayItemForCompletion(params.id, params.occurrenceKey)
    if (feedbackItem && !feedbackItem.canComplete) {
      throw new Error("所在的提醒事项列表是只读的")
    }

    const result = params.source === "manual"
      ? completeManualOccurrence(params.id, params.occurrenceKey)
      : await completeReminderOccurrence(params.id, params.occurrenceKey)
    clearWidgetActionError()

    const applied = result === "applied" || result === "appliedCacheStale"
    let completionWarning = result === "appliedCacheStale"
      ? "提醒已完成，但本地缓存未能更新"
      : null
    if (applied && feedbackItem) {
      // Advance only a lightweight animation generation. Never retain or
      // reinsert the completed occurrence while WidgetKit refreshes its queue.
      try {
        if (!writeWidgetCompletionFeedback(feedbackItem)) {
          completionWarning = "事项已完成，但完成动画状态未能保存"
        }
      } catch (error) {
        console.error("Completion animation state failed", error)
        completionWarning = "事项已完成，但完成动画状态未能保存"
      }
    }
    if (completionWarning) writeWidgetActionError(completionWarning)
  } catch (error) {
    console.error("CompleteDueItem failed", error)
    writeWidgetActionError(
      params?.source === "reminder"
        ? "提醒完成失败，请打开主脚本检查权限"
        : "事项完成失败，请打开主脚本检查存储",
    )
  } finally {
    // Occurrence keys make old controls idempotent, so every interaction may
    // safely request a fresh timeline instead of leaving a stale widget stuck.
    await reloadWidgetsAfterStorageWrite()
  }
}

function isCompletionParams(value: unknown): value is CompleteDueItemParams {
  if (value == null || typeof value !== "object") return false
  const params = value as Record<string, unknown>
  return (params.source === "manual" || params.source === "reminder")
    && typeof params.id === "string"
    && params.id.length > 0
    && params.id.length <= 200
    && typeof params.occurrenceKey === "string"
    && params.occurrenceKey.length > 0
    && params.occurrenceKey.length <= 240
}
