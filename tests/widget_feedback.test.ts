import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  formatWidgetItemTime,
  formatWidgetLastSync,
  localizeWidgetActionError,
  widgetCompletionLabel,
} from "../到期管家/src/widget_localization.ts"
import type { DisplayDueItem } from "../到期管家/src/types.ts"

function item(overrides: Partial<DisplayDueItem> = {}): DisplayDueItem {
  return {
    id: "widget-test",
    source: "manual",
    completionKey: "widget-test-occurrence",
    title: "Check subscription",
    kind: "subscription",
    iconName: "sparkles",
    iconColor: "systemPurple",
    dueDate: "2026-09-30",
    includesTime: true,
    hour: 18,
    minute: 5,
    dueTimestamp: new Date(2026, 8, 30, 18, 5).getTime(),
    remindBeforeDays: 0,
    amount: "USD 20.00",
    note: "A long subscription plan note",
    priority: 0,
    stale: false,
    canComplete: true,
    ...overrides,
  }
}

const source = readFileSync(
  new URL("../到期管家/src/widget_view.tsx", import.meta.url),
  "utf8",
)

test("small auxiliary time is absent for date-only items", () => {
  assert.equal(formatWidgetItemTime(item({ includesTime: false }), "en-US"), "")
  assert.equal(formatWidgetItemTime(item({ includesTime: false }), "zh-Hans"), "")
})

test("small auxiliary time follows locale and uses the authoritative device-local instant", () => {
  const current = item({ hour: 1, minute: 2 })
  for (const locale of ["en-US", "en-GB", "zh-Hans-CN", "zh-Hant-HK"]) {
    assert.equal(
      formatWidgetItemTime(current, locale),
      new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" })
        .format(new Date(current.dueTimestamp)),
      locale,
    )
  }
})

test("invalid auxiliary timestamps fall back to safe hour and minute values", () => {
  assert.equal(
    formatWidgetItemTime(item({ dueTimestamp: Number.NaN, hour: 18, minute: 5 }), "en-GB"),
    "18:05",
  )
  assert.equal(
    formatWidgetItemTime(item({ dueTimestamp: Number.NaN, hour: Number.NaN, minute: Number.NaN }), "en-GB"),
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1)),
  )
  assert.equal(formatWidgetItemTime(item(), "not_a_locale"), "18:05")
})

test("sync feedback shows the last actual success and includes the date for old data", () => {
  const now = new Date(2026, 8, 4, 16, 0)
  assert.equal(formatWidgetLastSync(new Date(2026, 8, 4, 15, 5).getTime(), "en-GB", now), "Last sync 15:05")
  assert.equal(
    formatWidgetLastSync(new Date(2026, 8, 3, 15, 5).getTime(), "en-GB", now),
    `Last sync ${new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(2026, 8, 3, 15, 5))}`,
  )
  assert.match(formatWidgetLastSync(new Date(2025, 8, 3, 15, 5).getTime(), "en-US", now), /2025/)
  assert.match(formatWidgetLastSync(new Date(2026, 8, 4, 15, 5).getTime(), "zh-Hant-HK", now), /^上次同步 /)
  assert.doesNotMatch(formatWidgetLastSync(now.getTime(), "zh-Hans", now), /天后|倒计时/)
})

test("no successful sync is explicit instead of showing a fabricated timestamp", () => {
  for (const fetchedAt of [null, 0, Number.NaN, Number.POSITIVE_INFINITY, 1e20]) {
    assert.equal(formatWidgetLastSync(fetchedAt, "en-US"), "Not synced yet")
    assert.equal(formatWidgetLastSync(fetchedAt, "zh-Hans"), "尚未同步成功")
  }
})

test("Home Screen feedback never exposes unknown private error strings", () => {
  const privateError = "Failed reading private-reminder-42 for user@example.com"
  assert.equal(
    localizeWidgetActionError(privateError, "en-US"),
    "The last action needs attention; open Due Manager to check",
  )
  assert.doesNotMatch(localizeWidgetActionError(privateError, "zh-Hant"), /private-reminder|user@/)
  assert.equal(
    localizeWidgetActionError("提醒完成失败，请打开主脚本检查权限", "en-US"),
    "Couldn’t complete the reminder; check access in the main script",
  )
})

test("completion icon has a localized action label with the full item title", () => {
  assert.equal(widgetCompletionLabel(item({ title: "Claude Pro" }), "en-US"), "Complete: Claude Pro")
  assert.equal(widgetCompletionLabel(item({ title: "缴费" }), "zh-Hans"), "完成: 缴费")
})

test("small precise time reuses the detail row without taking title or preview space", () => {
  const header = source.slice(source.indexOf("function WidgetHeader"), source.indexOf("function LargeSummaryHeader"))
  const body = source.slice(source.indexOf("function SmallDueItem"), source.indexOf("function SmallNextItemPreview"))
  const detail = source.slice(source.indexOf("function SmallCurrentDetail"), source.indexOf("function SmallNextItemPreview"))
  assert.match(header, /formatWidgetDate\(items\[0\]\.dueDate, WIDGET_LOCALE\)/)
  assert.doesNotMatch(header, /formatWidgetItemTime|formatWidgetItemDate/)
  assert.match(body, /height: 76, alignment: "topLeading"/)
  assert.match(body, /lineLimit=\{3\}/)
  assert.match(body, /detail \|\| item\.includesTime \|\| issue/)
  assert.match(body, /<SmallCurrentDetail item=\{item\} detail=\{detail\} issue=\{issue\} \/>/)
  assert.match(body, /height: 18, alignment: "leading"/)
  assert.match(detail, /height: 19, alignment: "leading"/)
  assert.match(detail, /const time = formatWidgetItemTime\(item, WIDGET_LOCALE\)/)
  assert.match(detail, /multilineTextAlignment="leading"/)
  assert.match(detail, /fixedSize=\{\{ horizontal: true, vertical: false \}\}/)
  assert.doesNotMatch(detail, /<Spacer|lineLimit=\{2\}/)
})

test("small issue status replaces only auxiliary text and offers an app link", () => {
  const detail = source.slice(source.indexOf("function SmallCurrentDetail"), source.indexOf("function SmallNextItemPreview"))
  assert.match(detail, /supportingText = issue\?\.compactText \?\? detail/)
  assert.match(detail, /<Link url=\{issue \? Script\.createRunURLScheme\(Script\.name, \{ action: "widget-status" \}\) : itemURL\(item\)\}>/)
  assert.match(detail, /\{time\}/)
  assert.equal(detail.match(/height: 19/g)?.length, 1)
})

test("cached and failed list widgets show actionable last-sync feedback only when needed", () => {
  const issue = source.slice(source.indexOf("function WidgetIssueLink"), source.indexOf("function itemURL"))
  assert.match(issue, /<Link url=\{Script\.createRunURLScheme\(Script\.name, \{ action: "widget-status" \}\)\}>/)
  assert.match(issue, /if \(props\.remindersFromCache\)/)
  assert.match(issue, /formatWidgetLastSync\(props\.reminderFetchedAt, WIDGET_LOCALE\)/)
  assert.match(issue, /return null/)
  assert.equal(source.match(/visible\.length > 0 && issue\s*\? <WidgetIssueLink issue=\{issue\} \/>/g)?.length, 2)
})

test("completion buttons use a native semantic icon-only label and retain tap size", () => {
  const control = source.slice(source.indexOf("function ListCompletionIcon"), source.indexOf("function ListCompletionSymbol"))
  assert.match(control, /title=\{widgetCompletionLabel\(item, WIDGET_LOCALE\)\}/)
  assert.match(control, /systemImage=\{item\.iconName\}/)
  assert.match(control, /labelStyle="iconOnly"/)
  assert.match(control, /frame=\{\{ width: hitSize, height: hitSize \}\}/)
  assert.match(control, /occurrenceKey: item\.completionKey/)
  assert.doesNotMatch(control, /accessibilityLabel=|font=\{symbolSize [+-]/)
})
