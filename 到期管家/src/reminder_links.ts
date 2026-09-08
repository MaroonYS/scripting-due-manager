// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

const UUID_PATTERN = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"
const BARE_REMINDER_UUID = new RegExp(`^${UUID_PATTERN}$`, "i")
const LEGACY_REMINDER_URL = new RegExp(`^x-apple-reminder://${UUID_PATTERN}$`, "i")
const REMINDER_KIT_URL = new RegExp(
  `^x-apple-reminderkit://REMCDReminder/${UUID_PATTERN}$`,
  "i",
)

export const APPLE_REMINDERS_URL = "x-apple-reminderkit://"

/**
 * Builds the private Reminders URL used to reveal one reminder. Keep this
 * parser deliberately strict: arbitrary EventKit identifiers must never be
 * interpolated into a custom URL scheme.
 */
export function appleReminderDeepLink(value: unknown): string | null {
  if (typeof value !== "string") return null
  const input = value.trim()
  const match = BARE_REMINDER_UUID.exec(input)
    ?? LEGACY_REMINDER_URL.exec(input)
    ?? REMINDER_KIT_URL.exec(input)
  const identifier = match?.[1]
  if (!identifier) return null
  return `x-apple-reminderkit://REMCDReminder/${identifier.toUpperCase()}`
}
