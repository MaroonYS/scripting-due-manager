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
import { currentWidgetLocale, widgetText } from "./src/widget_localization"
import { DueManagerWidget } from "./src/widget_view"

const WIDGET_LOCALE = currentWidgetLocale()

async function main() {
  const state = loadState()
  const reminderResult = state.settings.includeReminders
    ? await loadReminderItems(
      state.settings.reminderHorizonDays,
      state.settings.reminderCalendarIDs,
    )
    : { items: [], fetchedAt: null, live: false, fromCache: false, error: null }
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
      remindersLive={reminderResult.live}
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
        <Text font="headline" foregroundStyle="systemRed">
          {widgetText("loadFailed", WIDGET_LOCALE)}
        </Text>
        <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={4}>
          {widgetText("runAppToCheck", WIDGET_LOCALE)}
        </Text>
      </VStack>
    </VStack>,
  )
  Script.exit()
})
