// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { loadReminderItems, sortDueItems } from "./reminders"
import { loadState, manualItemsForDisplay } from "./storage"
import type { AppState, ReminderLoadResult } from "./types"
import { withItemIconChoices } from "./artwork_catalog"

function reminderScope(state: AppState): string {
  return JSON.stringify([
    state.settings.includeReminders,
    state.settings.reminderHorizonDays,
    state.settings.reminderCalendarIDs,
  ])
}

function emptyReminders(error: string | null = null): ReminderLoadResult {
  return { items: [], fetchedAt: null, live: false, fromCache: false, error }
}

/** Re-read manual items and settings after EventKit yields to other app/intent work. */
export async function loadWidgetData() {
  let state = loadState()
  let reminderResult = emptyReminders()
  for (let attempt = 0; attempt < 2; attempt++) {
    const scope = reminderScope(state)
    reminderResult = state.settings.includeReminders
      ? await loadReminderItems(state.settings.reminderHorizonDays, state.settings.reminderCalendarIDs)
      : emptyReminders()
    state = loadState()
    if (scope === reminderScope(state)) {
      return { state, reminderResult, items: withItemIconChoices(sortDueItems([
        ...manualItemsForDisplay(state), ...reminderResult.items,
      ]), state.settings) }
    }
  }
  // Repeated scope changes cannot justify showing an old List under new settings.
  reminderResult = emptyReminders(state.settings.includeReminders
    ? "提醒事项列表在读取期间发生变化，请重新同步。" : null)
  return { state, reminderResult, items: withItemIconChoices(sortDueItems(manualItemsForDisplay(state)), state.settings) }
}
