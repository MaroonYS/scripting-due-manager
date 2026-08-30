import { AppIntentManager, AppIntentProtocol } from "scripting"
import { completeReminderOccurrence } from "./src/reminders"
import {
  clearWidgetActionError,
  completeManualOccurrence,
  writeWidgetActionError,
} from "./src/storage"
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
    try {
      if (!isCompletionParams(params)) {
        throw new Error("Invalid completion parameters")
      }

      if (params.source === "manual") {
        completeManualOccurrence(params.id, params.occurrenceKey)
      } else {
        await completeReminderOccurrence(params.id, params.occurrenceKey)
      }
      clearWidgetActionError()
    } catch (error) {
      console.error("CompleteDueItem failed", error)
      writeWidgetActionError(
        params?.source === "reminder"
          ? "提醒完成失败，请打开主脚本检查权限"
          : "事项完成失败，请打开主脚本检查存储",
      )
    } finally {
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
