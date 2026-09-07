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

test("widget item URLs deep-link reminders and retain the manual edit fallback", () => {
  assert.equal(APPLE_REMINDERS_URL, "x-apple-reminderkit://")
  const source = readFileSync(
    new URL("../到期管家/src/widget_view.tsx", import.meta.url),
    "utf8",
  )
  const resolver = source.slice(source.indexOf("function itemURL"))
  assert.match(resolver, /if \(item\.source === "reminder"\) \{/)
  assert.match(
    resolver,
    /return appleReminderDeepLink\(item\.id\) \?\? APPLE_REMINDERS_URL/,
  )
  assert.match(
    resolver,
    /Script\.createRunURLScheme\(Script\.name, \{ action: "edit", id: item\.id \}\)/,
  )
})

test("reminder content links stay separate from completion AppIntent buttons", () => {
  const source = readFileSync(
    new URL("../到期管家/src/widget_view.tsx", import.meta.url),
    "utf8",
  )
  const small = source.slice(
    source.indexOf("function SmallDueItem"),
    source.indexOf("function smallItemDetail"),
  )
  const row = source.slice(
    source.indexOf("function DueItemRow"),
    source.indexOf("function ListCompletionIcon"),
  )
  const completion = source.slice(
    source.indexOf("function ListCompletionIcon"),
    source.indexOf("function ListCompletionSymbol"),
  )

  assert.match(small, /<ListCompletionIcon[\s\S]*?\/>\s*<\/VStack>\s*<Link url=\{itemURL\(item\)\}>/)
  assert.match(row, /<ListCompletionIcon[\s\S]*?\/>\s*<Link url=\{itemURL\(item\)\}>/)
  assert.match(completion, /return <Button/)
  assert.match(completion, /intent=\{CompleteDueItemIntent\(\{/)
  assert.match(completion, /occurrenceKey: item\.completionKey/)
  assert.doesNotMatch(completion, /<Link/)
})

test("current-item summaries use the same dynamic item link", () => {
  const source = readFileSync(
    new URL("../到期管家/src/widget_view.tsx", import.meta.url),
    "utf8",
  )
  const compactHeader = source.slice(
    source.indexOf("function WidgetHeader"),
    source.indexOf("function LargeSummaryHeader"),
  )
  const largeSummary = source.slice(
    source.indexOf("function LargeSummaryHeader"),
    source.indexOf("function largeSummaryDate"),
  )

  assert.match(compactHeader, /compact && items\[0\][\s\S]*?itemURL\(items\[0\]\)/)
  assert.match(compactHeader, /return <Link url=\{url\}>/)
  assert.match(largeSummary, /const url = item \? itemURL\(item\) : Script\.createRunURLScheme\(Script\.name\)/)
  assert.match(largeSummary, /return <Link url=\{url\}>/)
})
