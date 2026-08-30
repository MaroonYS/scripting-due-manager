import { Script, Text, VStack, Widget } from "scripting"
import { loadReminderItems, nextWidgetRefresh, sortDueItems } from "./src/reminders"
import {
  loadState,
  manualItemsForDisplay,
  readWidgetActionError,
} from "./src/storage"
import {
  readWidgetCompletionTransition,
} from "./src/widget_completion"
import { DueManagerWidget } from "./src/widget_view"

async function main() {
  const state = loadState()
  const reminderResult = state.settings.includeReminders
    ? await loadReminderItems(
      state.settings.reminderHorizonDays,
      state.settings.reminderCalendarIDs,
    )
    : { items: [], fetchedAt: null, fromCache: false, error: null }
  const items = sortDueItems([
    ...manualItemsForDisplay(state),
    ...reminderResult.items,
  ])
  const completionTransition = readWidgetCompletionTransition()
  const refreshAt = nextWidgetRefresh(items, new Date(), state.settings.includeReminders)

  Widget.present(
    <DueManagerWidget
      items={items}
      completionGeneration={completionTransition.generation}
      reminderFetchedAt={reminderResult.fetchedAt}
      remindersFromCache={reminderResult.fromCache}
      remindersEnabled={state.settings.includeReminders}
      reminderError={reminderResult.error}
      interactionError={readWidgetActionError()}
    />,
    { policy: "after", date: refreshAt },
  )
  Script.exit()
}

main().catch(error => {
  console.error(error)
  Widget.present(
    <VStack
      frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
      widgetBackground="secondarySystemBackground"
    >
      <VStack padding={11} alignment="leading" spacing={6} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
        <Text font="headline" foregroundStyle="systemRed">到期管家加载失败</Text>
        <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={4}>
          请运行主脚本检查数据或提醒事项权限。
        </Text>
      </VStack>
    </VStack>,
  )
  Script.exit()
})
