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
  clearWidgetCompletionFeedback,
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
  perform: async params => {
    let validatedParams: CompleteDueItemParams | null = null
    try {
      if (!isCompletionParams(params)) {
        throw new Error("Invalid completion parameters")
      }
      validatedParams = params

      const feedbackItem = params.source === "manual"
        ? findManualDisplayItemForCompletion(params.id, params.occurrenceKey)
        : findReminderDisplayItemForCompletion(params.id, params.occurrenceKey)

      const result = params.source === "manual"
        ? completeManualOccurrence(params.id, params.occurrenceKey)
        : await completeReminderOccurrence(params.id, params.occurrenceKey)
      clearWidgetActionError()

      if (result === "applied" && feedbackItem && writeWidgetCompletionFeedback(feedbackItem)) {
        // First reload morphs the outline into a completed checkmark. Keep the
        // old occurrence briefly before the final reload lets the queue advance.
        await reloadWidgetsAfterStorageWrite()
        await new Promise<void>(resolve => setTimeout(resolve, 800))
      }
    } catch (error) {
      console.error("CompleteDueItem failed", error)
      writeWidgetActionError(
        params?.source === "reminder"
          ? "提醒完成失败，请打开主脚本检查权限"
          : "事项完成失败，请打开主脚本检查存储",
      )
    } finally {
      if (validatedParams) {
        clearWidgetCompletionFeedback(
          validatedParams.source,
          validatedParams.id,
          validatedParams.occurrenceKey,
        )
      }
      await reloadWidgetsAfterStorageWrite()
    }
  },
})

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
