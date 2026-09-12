// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { appleReminderDeepLink } from "./reminder_links"
import { readReminderNotes } from "./reminder_notes"
import { withReadDeadline } from "./async_deadline"

/** Runs only in the foreground. Never completes or edits the reminder. */
export async function openReminderFromWidget(id: unknown): Promise<void> {
  const reminder = await readReminderNotes(id)
  const url = appleReminderDeepLink(reminder.id)
  if (!url) throw Error("此账户的提醒事项标识暂不支持精确跳转。请在 Apple 提醒事项内查找；未改为打开首页。")
  let opened = false
  try { opened = await withReadDeadline(() => Safari.openURL(url), 10000) }
  catch { throw Error("系统详情打开失败或超时；你仍可在本页查看备注。") }
  if (!opened) throw Error("系统未能打开对应提醒事项，请确认 Apple 提醒事项已安装并允许打开。")
}
