// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { appleReminderDeepLink } from "./reminder_links"
import { ReadDeadlineError, withReadDeadline } from "./async_deadline"

export type ReminderNotes = { id: string; title: string; list: string; notes: string; completed: boolean; canOpen: boolean }

export function isReminderID(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 512 && !/[\u0000-\u001f\u007f]/.test(id)
}

/** Foreground read only. Notes remain in this view's memory, never Storage or URLs. */
export async function readReminderNotes(id: unknown): Promise<ReminderNotes> {
  if (!isReminderID(id)) throw Error("提醒事项标识无效，请返回到期管家重新同步后再试。")
  let reminder: any
  try {
    reminder = await withReadDeadline(() => Reminder.get(id), 10000)
  } catch (error) {
    if (error instanceof ReadDeadlineError) throw Error("读取备注超时，请稍后重试。没有更改提醒事项。")
    throw Error("无法读取此提醒事项，请确认 Scripting 的提醒事项权限已开启，再点重试。没有更改提醒事项。")
  }
  if (!reminder) throw Error("此提醒事项已删除或暂时无法读取，请返回到期管家重新同步。没有打开其他事项。")
  // A native lookup must identify the requested item; allow only canonical UUID aliases.
  const requestedURL = appleReminderDeepLink(id), returnedURL = appleReminderDeepLink(reminder.identifier)
  if (reminder.identifier !== id && !(requestedURL && requestedURL === returnedURL)) {
    throw Error("系统返回的提醒事项与所选事项不一致，请重新同步。没有显示其他事项的备注。")
  }
  return {
    id,
    title: typeof reminder.title === "string" && reminder.title.trim() ? reminder.title : "未命名提醒事项",
    list: typeof reminder.calendar?.title === "string" ? reminder.calendar.title : "",
    notes: typeof reminder.notes === "string" ? reminder.notes : "",
    completed: reminder.isCompleted === true,
    canOpen: returnedURL != null,
  }
}
