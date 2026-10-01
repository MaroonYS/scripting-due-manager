// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { Device, Script, Text, VStack, Widget } from "scripting"
import { nextWidgetRefresh } from "./src/reminders"
import { loadWidgetData } from "./src/widget_data"
import { readWidgetActionError } from "./src/storage"
import {
  readWidgetCompletionTransition,
} from "./src/widget_completion"
import { configureWidgetLocale, currentWidgetLocale, widgetText } from "./src/widget_localization"
import { DueManagerWidget } from "./src/widget_view"

configureWidgetLocale(Device)
const WIDGET_LOCALE = currentWidgetLocale()

async function main() {
  const { state, reminderResult, items } = await loadWidgetData()
  let completionGeneration = 0
  let interactionError: string | null = null
  // Optional feedback must not replace valid item data with an error screen.
  try { completionGeneration = readWidgetCompletionTransition().generation } catch { /* Use an unanimated timeline. */ }
  try { interactionError = readWidgetActionError() } catch { /* The main app can inspect storage. */ }
  const refreshAt = nextWidgetRefresh(items, new Date(), state.settings.includeReminders,
    !reminderResult.live || reminderResult.fromCache || reminderResult.error != null)

  Widget.present(
    <DueManagerWidget
      items={items}
      completionGeneration={completionGeneration}
      reminderFetchedAt={reminderResult.fetchedAt}
      remindersLive={reminderResult.live}
      remindersFromCache={reminderResult.fromCache}
      remindersEnabled={state.settings.includeReminders}
      reminderError={reminderResult.error}
      interactionError={interactionError}
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
    { policy: "after", date: new Date(Date.now() + 5 * 60 * 1000) },
  )
  Script.exit()
})
