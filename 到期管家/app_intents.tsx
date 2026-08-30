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
  canRunWidgetCompletionIntent,
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
  renderGeneration: number
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
  let shouldReload = false
  try {
    if (!isCompletionParams(params)) {
      throw new Error("Invalid completion parameters")
    }
    if (!canRunWidgetCompletionIntent(params.renderGeneration)) {
      // The control belongs to a timeline that has already completed an item.
      // Ignore it without refreshing; the current generation remains tappable.
      return
    }
    shouldReload = true

    const feedbackItem = params.source === "manual"
      ? findManualDisplayItemForCompletion(params.id, params.occurrenceKey)
      : findReminderDisplayItemForCompletion(params.id, params.occurrenceKey)

    const result = params.source === "manual"
      ? completeManualOccurrence(params.id, params.occurrenceKey)
      : await completeReminderOccurrence(params.id, params.occurrenceKey)
    clearWidgetActionError()

    if (result === "applied" && feedbackItem) {
      // Keep the previous occurrence as a short-lived transition source.
      // WidgetKit receives one final state update after this intent returns.
      if (!writeWidgetCompletionFeedback(feedbackItem)) {
        writeWidgetActionError("事项已完成，但完成动画状态未能保存")
      }
    }
  } catch (error) {
    shouldReload = true
    console.error("CompleteDueItem failed", error)
    writeWidgetActionError(
      params?.source === "reminder"
        ? "提醒完成失败，请打开主脚本检查权限"
        : "事项完成失败，请打开主脚本检查存储",
    )
  } finally {
    if (shouldReload) {
      // A single reload mirrors native interactive widgets and avoids
      // WidgetKit coalescing an unseen intermediate state.
      await reloadWidgetsAfterStorageWrite()
    }
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
    && typeof params.renderGeneration === "number"
    && Number.isSafeInteger(params.renderGeneration)
    && params.renderGeneration >= 0
}
