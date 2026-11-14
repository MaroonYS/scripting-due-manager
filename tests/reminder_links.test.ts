// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  APPLE_REMINDERS_URL,
  appleReminderDeepLink,
} from "../到期管家/src/reminder_links.ts"

const UUID = "8ec3f3ed-7ba0-44e1-88ba-b9c9e4022a9d"
const CANONICAL_URL = `x-apple-reminderkit://REMCDReminder/${UUID.toUpperCase()}`

test("Apple Reminder links canonicalize supported UUID forms", () => {
  assert.equal(appleReminderDeepLink(UUID), CANONICAL_URL)
  assert.equal(appleReminderDeepLink(`  ${UUID.toUpperCase()}  `), CANONICAL_URL)
  assert.equal(appleReminderDeepLink(`x-apple-reminder://${UUID}`), CANONICAL_URL)
  assert.equal(
    appleReminderDeepLink(`x-apple-reminderkit://REMCDReminder/${UUID}`),
    CANONICAL_URL,
  )
})

test("Apple Reminder links reject malformed or expanded identifiers", () => {
  for (const value of [
    null,
    undefined,
    42,
    "",
    "not-a-reminder-id",
    "8ec3f3ed-7ba0-44e1-88ba-b9c9e4022a9",
    `x-apple-reminder://${UUID}/details`,
    `x-apple-reminderkit://REMCDReminder/${UUID}/details`,
    `x-apple-reminderkit://REMCDReminder/${UUID}?source=widget`,
    `x-apple-reminderkit://REMCDList/${UUID}`,
    `javascript:${UUID}`,
  ]) {
    assert.equal(appleReminderDeepLink(value), null, String(value))
  }
})

test("widget item URLs open exact notes or manual edits without passing reminder content", () => {
  assert.equal(APPLE_REMINDERS_URL, "x-apple-reminderkit://")
  const source = readFileSync(
    new URL("../到期管家/src/widget_view.tsx", import.meta.url),
    "utf8",
  )
  const resolver = functionSource(source, "itemURL")
  const compiled = new Bun.Transpiler({ loader: "ts" }).transformSync(resolver)
  const script = { name: "到期管家", createRunURLScheme: (name: string, parameters: unknown) => ({ name, parameters }) }
  const itemURL = new Function("Script", `${compiled}\nreturn itemURL`)(script)
  const item = { id: "apple&id=荟", title: "未公开标题", note: "敏感提醒正文" }
  assert.deepEqual(itemURL({ ...item, source: "reminder" }), {
    name: script.name, parameters: { action: "reminder-notes", id: item.id },
  })
  assert.deepEqual(itemURL({ ...item, source: "manual" }), {
    name: script.name, parameters: { action: "edit", id: item.id },
  })
  assert.doesNotMatch(resolver, /appleReminderDeepLink|APPLE_REMINDERS_URL/)
})

test("reminder content links stay separate from completion AppIntent buttons", () => {
  const source = readFileSync(
    new URL("../到期管家/src/widget_view.tsx", import.meta.url),
    "utf8",
  )
  const small = functionSource(source, "SmallDueItem")
  const row = functionSource(source, "DueItemRow")
  const completion = functionSource(source, "ListCompletionIcon")

  assert.match(small, /<Link url=\{itemURL\(item\)\}>[\s\S]*?<\/Link>\s*<ListCompletionIcon[^>]*\/>/)
  assert.match(row, /<ListCompletionIcon[\s\S]*?\/>\s*(?:<\/VStack>\s*)?<Link url=\{itemURL\(item\)\}>/)
  assert.doesNotMatch(row, /<Link[^>]*>[\s\S]*?<ListCompletionIcon/)
  assert.match(completion, /return <Button/)
  assert.match(completion, /intent=\{CompleteDueItemIntent\(\{/)
  assert.match(completion, /occurrenceKey: item\.completionKey/)
  assert.doesNotMatch(completion, /<Link/)
})

function functionSource(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `missing ${name}`)
  const rest = source.slice(start)
  const next = rest.search(/\n(?:export )?function /)
  return next < 0 ? rest : rest.slice(0, next)
}

test("small preview is a navigation link and cannot complete the next item", () => {
  const source = readFileSync(
    new URL("../到期管家/src/widget_view.tsx", import.meta.url),
    "utf8",
  )
  const preview = functionSource(source, "SmallNextItemPreview")
  assert.match(preview, /return <Link url=\{itemURL\(item\)\}>/)
  assert.doesNotMatch(preview, /ListCompletionIcon|CompleteDueItemIntent|<Button|onTapGesture/)
})
