// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  formatWidgetDate,
  formatWidgetItemTime,
  formatWidgetLastSync,
  formatWidgetWeekday,
  localizeWidgetActionError,
  widgetCompletionLabel,
  widgetItemDateKey,
  widgetText,
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

test("calendar headers show the local timed date but keep all-day dates floating", () => {
  const nextDay = new Date(2026, 9, 1, 0, 5)
  const sameDueDate = item({ dueDate: "2026-09-30", dueTimestamp: nextDay.getTime() })
  const timedKey = widgetItemDateKey(sameDueDate)
  assert.equal(timedKey, "2026-10-01")
  assert.equal(widgetItemDateKey({ ...sameDueDate, includesTime: false }), "2026-09-30")
  assert.equal(widgetItemDateKey({ ...sameDueDate, dueTimestamp: 9e20 }), "2026-09-30")
  for (const locale of ["en-US", "en-GB", "zh-CN", "zh-Hant-HK"]) {
    assert.equal(formatWidgetWeekday(timedKey, locale),
      new Intl.DateTimeFormat(locale, { weekday: "short" }).format(nextDay))
    assert.equal(formatWidgetDate(timedKey, locale, { now: nextDay }),
      new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(nextDay))
  }
  assert.equal(formatWidgetWeekday("2026-02-31", "en-US"), "")
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

test("small precise time is auxiliary rather than a live timer or a second control", () => {
  const detail = source.slice(source.indexOf("function SmallCurrentDetail"), source.indexOf("function SmallNextItemPreview"))
  assert.ok(detail.includes("function SmallCurrentDetail"))
  assert.match(detail, /\{time\}/)
  assert.doesNotMatch(detail, /DateLabel|style="timer"|ListCompletionIcon|CompleteDueItemIntent/)
  assert.doesNotMatch(detail, /\b(?:top|bottom):\s*-\d/)
})

test("small issue status replaces only auxiliary text and offers an app link", () => {
  const detail = source.slice(source.indexOf("function SmallCurrentDetail"), source.indexOf("function SmallNextItemPreview"))
  const compiled = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } }).transformSync(detail)
  const h = (type: string, props: any, ...children: any[]) => ({ type, props, children: children.filter(child => child != null) })
  const bindings = { h, Link: "Link", HStack: "HStack", Spacer: "Spacer", Text: "Text", formatWidgetItemTime,
    itemURL: (item: DisplayDueItem) => `notes:${item.id}` }
  const render = new Function(...Object.keys(bindings), `${compiled}\nreturn SmallCurrentDetail`)(...Object.values(bindings))
  const current = item(), detailText = "Sensitive original note", locale = "en-GB"
  const issue = { compactText: "Review action", color: "systemRed", url: "app:widget-status" }
  const plain = render({ item: current, detail: detailText, issue: null, locale, height: 16 })
  const warning = render({ item: current, detail: detailText, issue, locale, height: 16 })
  assert.equal(plain.props.url, `notes:${current.id}`)
  assert.equal(warning.props.url, issue.url)
  assert.deepEqual(plain.children[0].children.map((node: any) => node.children[0]), [detailText, "18:05"])
  assert.deepEqual(warning.children[0].children.map((node: any) => node.children[0]), [issue.compactText, "18:05"])
})

test("cached and failed list widgets show actionable last-sync feedback only when needed", () => {
  const issue = source.slice(source.indexOf("function WidgetIssueLink"), source.indexOf("function itemURL"))
  assert.match(issue, /<Link url=\{issue\.url\}>/)
  assert.match(issue, /if \(props\.remindersFromCache\)/)
  assert.match(issue, /formatWidgetLastSync\(props\.reminderFetchedAt, widgetRuntimeLocale\(\)\)/)
  assert.match(issue, /return null/)
  assert.match(source, /<WidgetIssueLink\s+issue=\{issue\}/)
})

test("sync retries open the main refresh flow while completion warnings open action inspection", () => {
  const compiled = new Bun.Transpiler({ loader: "ts" }).transformSync(
    source.slice(source.indexOf("function widgetIssue("), source.indexOf("function itemURL(")),
  )
  const bindings = {
    Script: { name: "Due Manager", createRunURLScheme: (_name: string, parameters: unknown = {}) => JSON.stringify(parameters) },
    widgetRuntimeLocale: () => "en-US", widgetText, localizeWidgetActionError, formatWidgetLastSync,
  }
  const evaluate = new Function(...Object.keys(bindings), `${compiled}\nreturn widgetIssue`)(...Object.values(bindings))
  const base = { remindersLive: false, remindersFromCache: false, reminderFetchedAt: null,
    reminderError: null, interactionError: null }
  assert.equal(evaluate(base), null)
  for (const patch of [{ reminderError: "offline" }, { remindersFromCache: true },
    { remindersLive: true, reminderError: "cache save failed" }]) {
    const issue = evaluate({ ...base, ...patch })
    assert.deepEqual(JSON.parse(issue.url), {}, "retry must mount DueManagerApp, which refreshes reminders")
  }
  assert.deepEqual(JSON.parse(evaluate({ ...base, interactionError: "failed", reminderError: "offline" }).url),
    { action: "widget-status" })
})

test("completion buttons use a native semantic icon-only label and retain tap size", () => {
  const control = source.slice(source.indexOf("function ListCompletionIcon"), source.indexOf("function ListCompletionSymbol"))
  assert.match(control, /<DueSymbolLabel\s+title=\{widgetCompletionLabel\(item, widgetRuntimeLocale\(\)\)\}/)
  assert.match(control, /name=\{item\.iconName\}/)
  assert.match(control, /color=\{item\.iconColor\}/)
  assert.match(control, /const size = Math.min\(symbolSize, hitSize\)/)
  assert.match(control, /size=\{size\}\s+slotSize=\{hitSize\}\s+widget/)
  assert.match(control, /frame=\{\{ width: hitSize, height: hitSize \}\}/)
  assert.match(control, /occurrenceKey: item\.completionKey/)
  assert.doesNotMatch(control, /accessibilityLabel=|font=\{symbolSize [+-]/)
  const symbolSource = readFileSync(new URL("../到期管家/src/due_symbol.tsx", import.meta.url), "utf8")
  const semantic = symbolSource.slice(symbolSource.indexOf("export function DueSymbolLabel"))
  assert.match(semantic, /return <Label\s+title=\{title\}/)
  assert.match(semantic, /labelStyle="iconOnly"/)
  assert.match(semantic, /foregroundStyle="clear"/)
  assert.match(semantic, /frame=\{\{ width: geometry\.slotSize, height: geometry\.slotSize, alignment: "center" \}\}/)
  assert.match(semantic, /contentShape="rect"/)
  assert.match(semantic, /background=\{\{ content: <DueSymbol \{\.\.\.symbol\} \/>, alignment: "center" \}\}/)
  assert.doesNotMatch(semantic, /accessibilityLabel=|onTapGesture=|intent=|<Button/)
})
