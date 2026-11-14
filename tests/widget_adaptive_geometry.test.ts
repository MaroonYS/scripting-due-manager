// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import test from "node:test"
import {
  agendaWidgetLayout,
  smallWidgetLayout,
  widgetTitleFitsOneLine,
} from "../到期管家/src/widget_layout.ts"

const agendaFamilies = ["systemMedium", "systemLarge", "systemExtraLargePortrait"] as const
const tolerance = 0.001

function assertFiniteGeometry(geometry: object, context: string) {
  for (const [key, value] of Object.entries(geometry)) {
    assert.ok(typeof value === "number" && Number.isFinite(value) && value >= 0,
      `${context}: ${key} must be finite and nonnegative, got ${value}`)
  }
}

function assertSmallFit(width: number, height: number, hasDetail: boolean, hasNext: boolean, preferThreeLines = false) {
  const plan = smallWidgetLayout(width, height, { hasDetail, hasNext, preferThreeLines })
  const context = `small ${width}×${height}, detail=${hasDetail}, preview=${hasNext}`
  assertFiniteGeometry(plan, context)
  assert.ok(plan.contentWidth + 2 * plan.padding <= width + tolerance, context)
  assert.ok(plan.auxiliaryInset <= 8, context)
  assert.ok(Math.abs(plan.auxiliaryContentWidth + 2 * (plan.padding + plan.auxiliaryInset) - width) < tolerance, context)
  if (plan.padding === 11) assert.equal(plan.padding + plan.auxiliaryInset, 19, context)
  assert.ok(plan.verticalInset >= plan.padding && plan.verticalInset <= plan.padding + plan.padding * (5 / 11), context)
  assert.ok(Math.abs(plan.contentHeight + 2 * plan.verticalInset - height) < tolerance, context)
  assert.ok(plan.titleHeight >= plan.hitSize && plan.hitSize <= plan.contentWidth, context)
  assert.ok([1, 2, 3].includes(plan.titleLines), context)
  if (!hasDetail) assert.equal(plan.detailHeight, 0, context)
  if (!hasNext) assert.equal(plan.previewHeight, 0, context)
  const heightUsed = plan.headerHeight + plan.titleHeight + plan.detailHeight + plan.previewHeight
    + (plan.headerHeight ? plan.headerGap : 0)
    + (plan.detailHeight || plan.previewHeight ? plan.gap : 0)
    + (plan.detailHeight && plan.previewHeight ? plan.footerGap : 0)
  assert.ok(heightUsed <= plan.contentHeight + tolerance,
    `${context}: bands use ${heightUsed} of ${plan.contentHeight} pt`)
  return plan
}

function assertAgendaFit(
  family: (typeof agendaFamilies)[number],
  width: number,
  height: number,
  itemCount: number,
  actionCount: number,
  hasIssue: boolean,
) {
  const plan = agendaWidgetLayout(family, width, height, { itemCount, actionCount, hasIssue })
  const context = `${family} ${width}×${height}, count=${itemCount}/${actionCount}, issue=${hasIssue}`
  assertFiniteGeometry(plan, context)
  assert.ok(plan.contentWidth + 2 * plan.padding <= width + tolerance, context)
  assert.ok(plan.contentHeight + 2 * plan.padding <= height + tolerance, context)
  assert.ok(Number.isInteger(plan.capacity) && plan.capacity <= itemCount, context)
  assert.ok([0, 1, 2].includes(plan.sectionCount) && plan.sectionCount <= plan.capacity, context)
  if (family === "systemMedium") assert.equal(plan.sectionCount, 0, context)
  if (plan.sectionCount === 2) {
    assert.ok(actionCount > 0 && actionCount < plan.capacity,
      `${context}: both section headers need corresponding visible items`)
  }
  if (!hasIssue || !plan.capacity) assert.equal(plan.issueHeight, 0, context)
  if (plan.capacity > 0) assert.ok(plan.hitSize > 0 && plan.hitSize <= plan.rowHeight, context)
  const rowGaps = Math.max(0, plan.capacity - Math.max(1, plan.sectionCount))
  const heightUsed = plan.headerHeight + plan.queueGap
    + plan.capacity * plan.rowHeight + rowGaps * plan.rowGap
    + plan.sectionCount * plan.sectionHeaderHeight
    + Math.max(0, plan.sectionCount - 1) * plan.sectionGap + plan.issueHeight
  assert.ok(heightUsed <= plan.contentHeight + tolerance,
    `${context}: agenda uses ${heightUsed} of ${plan.contentHeight} pt`)
  const widthUsed = plan.hitSize + plan.titleWidth + plan.metadataGap + plan.metadataWidth
  assert.ok(Math.abs(widthUsed - plan.contentWidth) <= tolerance,
    `${context}: columns use ${widthUsed} of ${plan.contentWidth} pt`)
  return plan
}

test("small layouts fit separate header, completion, detail and preview bands across width/height combinations", () => {
  // Synthetic proposals in points, not dimensions inferred from hardware pixels.
  for (const width of [96, 114, 141, 158.5, 170, 210, 246]) {
    for (const height of [80, 94, 111, 127.5, 141, 156, 170, 212]) {
      for (const hasDetail of [false, true]) {
        for (const hasNext of [false, true]) {
          assertSmallFit(width, height, hasDetail, hasNext)
        }
      }
    }
  }
})

test("small loses the optional preview before its own detail and preserves the normal 40 point completion target", () => {
  const veryShort = assertSmallFit(141, 89, true, true)
  const roomy = assertSmallFit(141, 194, true, true)
  const ordinary = assertSmallFit(141, 141, true, true)
  assert.equal(veryShort.previewHeight, 0)
  assert.ok(roomy.detailHeight > 0 && roomy.previewHeight > 0)
  assert.equal(ordinary.hitSize, 40)
  assert.equal(roomy.hitSize, ordinary.hitSize)
  assert.ok(ordinary.gap > 0)
  let hasSeenPreview = false
  for (let height = 86; height <= 210; height++) {
    const plan = assertSmallFit(141, height, true, true)
    if (plan.previewHeight > 0) {
      assert.ok(plan.detailHeight > 0, "requested detail has priority over the preview")
      hasSeenPreview = true
    }
    if (hasSeenPreview) assert.ok(plan.previewHeight > 0, "more height must not hide an already fitting preview")
  }
  assert.ok(hasSeenPreview)
})

test("small spends only leftover height on paired top and bottom insets", () => {
  const compact = assertSmallFit(141, 141, true, true)
  assert.ok(compact.previewHeight > 0)
  assert.equal(compact.verticalInset, 13.5)
  const roomy = assertSmallFit(170, 170, true, true)
  assert.equal(roomy.padding + roomy.auxiliaryInset, 19)
  assert.equal(roomy.verticalInset, 16)
  assert.equal(roomy.hitSize, compact.hitSize)
})

test("small shifts the main and detail centers toward the reference without changing the footer bottom anchor", () => {
  for (const [width, height] of [[141, 141], [148, 148], [170, 170]]) {
    const plan = assertSmallFit(width, height, true, true)
    const titleCenter = plan.verticalInset + plan.headerHeight + plan.headerGap + plan.titleHeight / 2
    const detailCenter = height - plan.verticalInset - plan.previewHeight - plan.footerGap - plan.detailHeight / 2
    const oldTitleCenter = plan.verticalInset + plan.headerHeight + 4 + plan.titleHeight / 2
    const oldDetailCenter = height - plan.verticalInset - 19 - 4 - 17 / 2
    assert.equal(oldTitleCenter - titleCenter, 4)
    assert.equal(detailCenter - oldDetailCenter, 7)
    assert.equal(plan.footerGap, 1)
    assert.equal(plan.hitSize, 40)
  }
})

test("small can give a long title another line before an optional preview without losing current detail", () => {
  const ordinary = assertSmallFit(141, 141, true, true)
  const longTitle = assertSmallFit(141, 141, true, true, true)
  assert.equal(ordinary.titleLines, 2)
  assert.ok(ordinary.previewHeight > 0)
  assert.equal(longTitle.titleLines, 3)
  assert.ok(longTitle.titleHeight > ordinary.titleHeight)
  assert.equal(longTitle.detailHeight, ordinary.detailHeight)
  assert.equal(longTitle.hitSize, ordinary.hitSize)
  assert.equal(longTitle.previewHeight, 0)
})

test("agenda budgets fit visible rows, real sections, gaps and sync issues together", () => {
  for (const family of agendaFamilies) {
    for (const width of [118, 178.5, 236, 300, 364, 490]) {
      for (const height of [70, 95, 126.5, 151, 180, 249, 320, 382, 628]) {
        for (const [count, actions] of [[0, 0], [1, 0], [2, 1], [4, 0], [7, 3], [9, 9], [400, 3]]) {
          for (const issue of [false, true]) assertAgendaFit(family, width, height, count, actions, issue)
        }
      }
    }
  }
})

test("agenda width budget restores title space and protects ordinary completion target widths", () => {
  for (const family of agendaFamilies) {
    const height = family === "systemMedium" ? 196 : family === "systemLarge" ? 410 : 628
    const narrow = assertAgendaFit(family, 222, height, 12, 2, false)
    const wide = assertAgendaFit(family, 396, height, 12, 2, false)
    assert.ok(narrow.titleWidth > narrow.metadataWidth, `${family}: title must be wider than metadata`)
    assert.ok(narrow.metadataWidth < wide.metadataWidth, `${family}: trailing column must follow the width`)
    assert.ok(wide.titleWidth > narrow.titleWidth)
    assert.ok(wide.metadataWidth <= wide.contentWidth * 0.32 + tolerance)
    assert.ok(wide.metadataWidth < (family === "systemMedium" ? 116 : 124), "do not restore the old fixed rails")
    assert.equal(wide.hitSize, family === "systemMedium" ? 38 : 40)
    assert.equal(narrow.hitSize, wide.hitSize)
  }
})

test("agenda admits more rows with real height; portrait XL is not capped like a standard large widget", () => {
  const large = assertAgendaFit("systemLarge", 300, 382, 100, 2, false)
  const xl = assertAgendaFit("systemExtraLargePortrait", 300, 628, 100, 2, false)
  const shortXL = assertAgendaFit("systemExtraLargePortrait", 300, 236, 100, 2, false)
  assert.ok(large.capacity >= 4)
  assert.ok(xl.capacity > large.capacity)
  assert.ok(xl.capacity > shortXL.capacity)
  assert.equal(xl.sectionCount, 2)
  assert.equal(xl.hitSize, 40)
  for (const family of agendaFamilies) {
    let previous = 0
    for (let height = 90; height <= 640; height += 5) {
      const plan = assertAgendaFit(family, 300, height, 24, 2, false)
      assert.ok(plan.capacity >= previous, `${family}: additional height must not reduce row capacity`)
      previous = plan.capacity
    }
  }
})

test("a sync warning receives an explicit band without inventing rows or extra section headers", () => {
  for (const family of agendaFamilies) {
    const height = family === "systemMedium" ? 160 : 345
    const healthy = assertAgendaFit(family, 300, height, 24, 2, false)
    const warning = assertAgendaFit(family, 300, height, 24, 2, true)
    assert.ok(warning.capacity > 0)
    assert.ok(warning.issueHeight > 0)
    assert.ok(warning.capacity <= healthy.capacity)
    assert.equal(assertAgendaFit(family, 300, height, 0, 0, true).capacity, 0)
  }
})

test("section budgets follow the visible needs-action flags rather than assuming a leading action run", () => {
  // Sorting puts live reminders before stale ones, so upcoming rows can come before
  // overdue rows. Prefix data, not the action count across all items, governs sections.
  const upcomingFirst = [false, false, ...Array.from({ length: 12 }, () => true)]
  const firstSlot = agendaWidgetLayout("systemLarge", 300, 130, {
    itemCount: upcomingFirst.length,
    actionFlags: upcomingFirst,
    actionCount: 1,
  })
  assert.ok(firstSlot.capacity > 0 && firstSlot.capacity <= 2)
  assert.equal(firstSlot.sectionCount, 1)
  const mixed = [false, true, ...Array.from({ length: 12 }, () => true)]
  const moreSpace = agendaWidgetLayout("systemExtraLargePortrait", 300, 628, {
    itemCount: mixed.length,
    actionFlags: mixed,
    actionCount: 0,
  })
  assert.ok(moreSpace.capacity >= 2)
  assert.equal(moreSpace.sectionCount, 2)
})

test("missing and invalid size proposals use the same finite fallback for each affected axis independently", () => {
  const malformed = [undefined, NaN, Infinity, -Infinity, -20, 0]
  const smallOptions = { hasDetail: true, hasNext: true }
  const agendaOptions = { itemCount: 24, actionCount: 2, hasIssue: true }
  const fallbackAgendaSize = { systemMedium: [320, 153], systemLarge: [320, 330], systemExtraLargePortrait: [300, 628] }
  for (const value of malformed) {
    assert.deepEqual(smallWidgetLayout(value, 141, smallOptions), smallWidgetLayout(148, 141, smallOptions))
    assert.deepEqual(smallWidgetLayout(116, value, smallOptions), smallWidgetLayout(116, 148, smallOptions))
    for (const family of agendaFamilies) {
      const [width, height] = fallbackAgendaSize[family]
      assert.deepEqual(agendaWidgetLayout(family, value, 198, agendaOptions),
        agendaWidgetLayout(family, width, 198, agendaOptions))
      assert.deepEqual(agendaWidgetLayout(family, 232, value, agendaOptions),
        agendaWidgetLayout(family, 232, height, agendaOptions))
      assertFiniteGeometry(agendaWidgetLayout(family, value, value, agendaOptions), family)
    }
  }
})

test("positive but extreme host proposals never manufacture height or width beyond the supplied bounds", () => {
  for (const [width, height] of [[1, 1], [24, 26], [65, 48], [256, 26], [64, 530]]) {
    assertSmallFit(width, height, true, true)
    for (const family of agendaFamilies) assertAgendaFit(family, width, height, 12, 6, true)
  }
})

test("title width estimates handle mixed scripts and explicit breaks within the actual text column", () => {
  const title = "19:23–19:50 | 西安北下车出站"
  assert.equal(widgetTitleFitsOneLine(title, 70, 15), false)
  assert.equal(widgetTitleFitsOneLine(title, 270, 15), true)
  assert.equal(widgetTitleFitsOneLine("Venture One\nAutoPay", 270, 15), false)
  assert.equal(widgetTitleFitsOneLine("✈️ Hilton 酒店", 200, 15), true)
  assert.equal(widgetTitleFitsOneLine("A", 0, 15), false)
  assert.equal(widgetTitleFitsOneLine(title, Infinity, 15), false)
  const small = smallWidgetLayout(141, 141)
  assert.equal(widgetTitleFitsOneLine(title, small.contentWidth - small.hitSize, 15), false)
  for (const family of agendaFamilies) {
    const wide = agendaWidgetLayout(family, 450, 382)
    assert.equal(widgetTitleFitsOneLine(title, wide.titleWidth, 15), true)
  }
})
