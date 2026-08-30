import { Text, VStack, Widget } from "scripting"
import { loadReminderItems, nextWidgetRefresh, sortDueItems } from "./src/reminders"
import {
  loadState,
  manualItemsForDisplay,
  readWidgetActionError,
} from "./src/storage"
import { DueManagerWidget } from "./src/widget_view"

async function main() {
  const state = loadState()
  const reminderResult = state.settings.includeReminders
    ? await loadReminderItems(state.settings.reminderHorizonDays)
    : { items: [], fetchedAt: null, fromCache: false, error: null }
  const items = sortDueItems([
    ...manualItemsForDisplay(state),
    ...reminderResult.items,
  ])
  const refreshAt = nextWidgetRefresh(items, new Date(), state.settings.includeReminders)

  Widget.present(
    <DueManagerWidget
      items={items}
      reminderFetchedAt={reminderResult.fetchedAt}
      remindersFromCache={reminderResult.fromCache}
      remindersEnabled={state.settings.includeReminders}
      reminderError={reminderResult.error}
      interactionError={readWidgetActionError()}
    />,
    { policy: "after", date: refreshAt },
  )
}

main().catch(error => {
  console.error(error)
  Widget.present(
    <VStack
      padding={12}
      frame={Widget.displaySize}
      spacing={6}
      widgetBackground={{ light: "#FFFFFF", dark: "#1C1C1E" }}
    >
      <Text font="headline" foregroundStyle="systemRed">到期管家加载失败</Text>
      <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={4}>
        请运行主脚本检查数据或提醒事项权限。
      </Text>
    </VStack>,
  )
})
