// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { Device, Script, Text, VStack, Widget } from "scripting"
import { nextWidgetRefresh } from "./src/reminders"
import { loadWidgetData } from "./src/widget_data"
import {
  loadState,
  readWidgetActionError,
} from "./src/storage"
import {
  readWidgetCompletionTransition,
} from "./src/widget_completion"
import { configureWidgetLocale, currentWidgetLocale, widgetText } from "./src/widget_localization"
import { DueManagerWidget } from "./src/widget_view"
import { reconcileNotifications } from "./src/notifications"
import { brandAsset, loadBrandLogo } from "./src/brand_assets"
import { resolveItemBrand } from "./src/brand_preferences"

configureWidgetLocale(Device)
const WIDGET_LOCALE = currentWidgetLocale()

async function main() {
  const { state, reminderResult, items } = await loadWidgetData()
  const completionTransition = readWidgetCompletionTransition()
  const refreshAt = nextWidgetRefresh(items, new Date(), state.settings.includeReminders)
  // Other families never read artwork. A slow optional image falls back within 1.5 s.
  const brand = Widget.family === "systemSmall" && items[0] ? resolveItemBrand(items[0], state.settings) : null
  const brandLogo = brand ? await loadBrandLogo(brandAsset(brand.id), Script.directory) : null

  Widget.present(
    <DueManagerWidget
      items={items}
      iconSettings={state.settings}
      brandLogo={brandLogo}
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
  // Optional bounded maintenance happens after presenting content; it cannot
  // turn a valid timeline into a load-error placeholder.
  try {
    await reconcileNotifications([], { loadItems: () => loadState().items, maxNewRequests: 3, leaseWaitMs: 0 })
  } catch (error) { console.error("Widget notification maintenance deferred", error) }
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
