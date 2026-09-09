// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { appleReminderDeepLink } from "./reminder_links"

/** Runs only in the foreground. Never completes or edits the reminder. */
export async function openReminderFromWidget(id: unknown): Promise<void> {
  if (typeof id !== "string" || !id || id.length > 512 || /[\u0000-\u001f\u007f]/.test(id)) {
    throw Error("提醒事项标识无效，请在到期管家重新同步后再点击组件。")
  }
  const reminder = await Reminder.get(id)
  if (!reminder) throw Error("此提醒事项已删除或标识已改变，请在到期管家重新同步。没有打开其他事项。")
  const url = appleReminderDeepLink(reminder.identifier)
  if (!url) throw Error("此账户的提醒事项标识暂不支持精确跳转。请在 Apple 提醒事项内查找；未改为打开首页。")
  if (!await Safari.openURL(url)) throw Error("系统未能打开对应提醒事项，请确认 Apple 提醒事项已安装并允许打开。")
}
