// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

export type HomeWidgetFamily = "systemSmall" | "systemMedium" | "systemLarge" | "systemExtraLargePortrait"

const TITLE_WRAP_TOLERANCE = 2
const TITLE_WIDTH_SAFETY_FACTOR = 1.015

type ListWidgetFamily = Exclude<HomeWidgetFamily, "systemSmall">

export type SmallWidgetLayout = {
  padding: number
  verticalInset: number
  contentWidth: number
  contentHeight: number
  auxiliaryInset: number
  auxiliaryContentWidth: number
  headerHeight: number
  titleHeight: number
  titleLines: 1 | 2 | 3
  detailHeight: number
  previewHeight: number
  gap: number
  hitSize: number
}

export type AgendaWidgetLayout = {
  padding: number
  contentWidth: number
  contentHeight: number
  headerHeight: number
  rowHeight: number
  capacity: number
  sectionHeaderHeight: number
  sectionGap: number
  sectionCount: 0 | 1 | 2
  rowGap: number
  queueGap: number
  issueHeight: number
  hitSize: number
  metadataWidth: number
  titleWidth: number
  metadataGap: number
}

type AgendaLayoutOptions = {
  itemCount?: number
  actionCount?: number
  actionFlags?: readonly boolean[]
  hasIssue?: boolean
}

type SmallLayoutOptions = {
  hasDetail?: boolean
  hasNext?: boolean
  preferThreeLines?: boolean
}

function widgetDimension(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback
}

function contentBox(width: number, height: number, preferredPadding: number) {
  // Basing the inset on the smaller axis prevents a narrow or short host
  // proposal from spending most of its usable room on a desktop-sized inset.
  const padding = Math.min(preferredPadding, Math.min(width, height) * 0.085)
  return { padding, contentWidth: width - 2 * padding, contentHeight: height - 2 * padding }
}

export function smallWidgetLayout(
  displayWidth?: number,
  displayHeight?: number,
  { hasDetail = false, hasNext = false, preferThreeLines = false }: SmallLayoutOptions = {},
): SmallWidgetLayout {
  // Older hosts may not supply one axis. Keep that fallback compact instead
  // of planning for the roomiest standard small widget.
  const box = contentBox(widgetDimension(displayWidth, 148), widgetDimension(displayHeight, 148), 11)
  const { contentWidth, contentHeight } = box
  // The side-by-side Surge reference has a slightly deeper side inset.
  // Keep that adjustment independent of the previously balanced top/bottom.
  const auxiliaryInset = box.padding * (8 / 11)
  const gap = 4
  const hitSize = Math.min(40, contentWidth * 0.42, contentHeight)
  // Two fixed-size title lines and the completion target share one band.
  // Below its ordinary height the renderer gets a one-line title budget.
  let titleHeight = Math.min(contentHeight, 42)
  let room = contentHeight - titleHeight
  const headerHeight = room >= 24 + gap ? 24 : room >= 18 + gap ? 18 : 0
  if (headerHeight > 0) room -= headerHeight + gap
  // When even a compact header cannot fit, stop at the primary title. This
  // avoids briefly showing a detail line only to lose it on a taller proposal
  // where the higher-priority header becomes available.
  const detailHeight = hasDetail && headerHeight > 0 && room >= 17 + gap ? 17 : 0
  if (detailHeight > 0) room -= detailHeight + gap
  // An unusually long title may use the spare line before a preview is
  // admitted, but never at the expense of requested current-item detail.
  if (preferThreeLines && (!hasDetail || detailHeight > 0) && room >= 16) {
    titleHeight += 16
    room -= 16
  }
  const previewHeight = hasNext && (!hasDetail || detailHeight > 0) && room >= 19 + gap ? 19 : 0
  if (previewHeight > 0) room -= previewHeight + gap

  if (titleHeight === 42 && contentHeight >= 150 && room >= 16) {
    titleHeight += 16
    room -= 16
  }
  // Preserve the existing top/bottom budget; the wider side inset must not
  // push the heading or the bottom preview farther in vertically.
  const verticalExtra = Math.min(box.padding * (5 / 11), Math.max(0, room) / 2)
  return {
    ...box, verticalInset: box.padding + verticalExtra, contentHeight: contentHeight - 2 * verticalExtra,
    auxiliaryInset, auxiliaryContentWidth: contentWidth - 2 * auxiliaryInset,
    gap, hitSize, headerHeight, titleHeight, detailHeight, previewHeight,
    titleLines: titleHeight >= 58 ? 3 : titleHeight >= 38 ? 2 : 1,
  }
}

export function agendaWidgetLayout(
  family: ListWidgetFamily,
  displayWidth?: number,
  displayHeight?: number,
  options: AgendaLayoutOptions = {},
): AgendaWidgetLayout {
  const medium = family === "systemMedium"
  const portrait = family === "systemExtraLargePortrait"
  const box = contentBox(
    widgetDimension(displayWidth, portrait ? 300 : 320),
    widgetDimension(displayHeight, medium ? 153 : portrait ? 628 : 330),
    medium ? 11 : 12,
  )
  const { contentWidth, contentHeight } = box
  const maximumRows = medium ? 3 : portrait ? 9 : 5
  const { itemCount } = options
  const requestedRows = typeof itemCount === "number" && Number.isFinite(itemCount)
    ? Math.max(0, Math.min(maximumRows, Math.trunc(itemCount))) : maximumRows
  const preferredHeader = medium ? 26 : portrait ? 62 : 58
  const minimumRowHeight = medium ? 36 : 40
  const maximumRowHeight = medium ? 44 : portrait ? 52 : 50
  const rowGap = medium ? 1 : 2
  let headerHeight = Math.min(preferredHeader, contentHeight)
  let sectionHeaderHeight = medium ? 0 : 19
  let sectionGap = medium ? 0 : 6
  let queueGap = requestedRows > 0 ? 4 : 0
  let issueHeight = requestedRows > 0 && options.hasIssue ? 18 : 0
  let capacity = 0
  let rowHeight = 0
  let sectionCount: 0 | 1 | 2 = 0

  // Try more rows before more headings. The exact prefix must fit; older
  // cached rows can put an action item after a current upcoming item.
  fit: for (let count = requestedRows; count > 0; count--) {
    const groups: (0 | 1 | 2)[] = medium ? [0] : agendaHasMixedSections(options, count) ? [2, 1] : [1]
    for (const sections of groups) {
      const gaps = Math.max(0, count - Math.max(1, sections)) * rowGap
      const headers = sections * sectionHeaderHeight + (sections === 2 ? sectionGap : 0)
      const space = contentHeight - headerHeight - queueGap - issueHeight - gaps - headers
      if (space < count * minimumRowHeight) continue
      capacity = count
      sectionCount = sections
      rowHeight = Math.min(maximumRowHeight, Math.floor(space / count))
      break fit
    }
  }

  if (requestedRows === 0) {
    // Let the empty/error view use the rest; there is no queue or footer.
    const availableForHeader = contentHeight - 48
    headerHeight = availableForHeader >= 18 ? Math.min(preferredHeader, availableForHeader) : 0
  } else if (capacity === 0) {
    // A genuinely short proposal still gets its most important item. Optional
    // chrome may disappear, never occupying space assigned to that row.
    capacity = 1
    sectionCount = medium ? 0 : 1
    sectionHeaderHeight = 0
    sectionGap = 0
    const availableAsideFromRow = contentHeight - Math.min(36, contentHeight)
    issueHeight = Math.min(issueHeight, availableAsideFromRow) >= 18 ? 18 : 0
    const availableForHeader = availableAsideFromRow - issueHeight - 4
    headerHeight = availableForHeader >= 18 ? Math.min(preferredHeader, availableForHeader) : 0
    queueGap = headerHeight > 0 ? 4 : 0
    rowHeight = Math.min(maximumRowHeight, contentHeight - headerHeight - queueGap - issueHeight)
  }

  const hitSize = Math.min(medium ? 38 : 40, rowHeight, contentWidth * 0.42)
  // The right column is always subordinate. With too little room for two
  // useful columns, the renderer can present metadata within the title area.
  const metadataWidth = contentWidth >= 164 ? Math.min(medium ? 104 : 112, Math.floor(contentWidth * 0.28)) : 0
  const metadataGap = metadataWidth > 0 ? 8 : 0
  const titleWidth = contentWidth - hitSize - metadataWidth - metadataGap
  return {
    ...box, headerHeight, rowHeight, capacity, sectionHeaderHeight, sectionGap,
    sectionCount, rowGap, queueGap, issueHeight, hitSize, metadataWidth, titleWidth, metadataGap,
  }
}

function agendaHasMixedSections({ actionFlags, actionCount = 0 }: AgendaLayoutOptions, count: number): boolean {
  if (actionFlags == null) return actionCount > 0 && actionCount < count
  let hasAction = false
  let hasUpcoming = false
  for (let index = 0; index < count; index++) {
    if (actionFlags[index]) hasAction = true
    else hasUpcoming = true
    if (hasAction && hasUpcoming) return true
  }
  return false
}

export function widgetTitleFitsOneLine(title: string, width: number, fontSize: number): boolean {
  return Number.isFinite(width) && width > 0 && Number.isFinite(fontSize) && fontSize > 0
    && !/[\r\n\u2028\u2029]/.test(title)
    && estimatedTitleWidth(title, fontSize) <= width + TITLE_WRAP_TOLERANCE
}

function estimatedTitleWidth(title: string, fontSize: number): number {
  const normalized = title.normalize("NFC").replace(/\s+/g, " ").trim()
  let emWidth = 0
  for (const character of Array.from(normalized)) {
    emWidth += titleCharacterEmWidth(character)
  }
  return emWidth * fontSize * TITLE_WIDTH_SAFETY_FACTOR
}

function titleCharacterEmWidth(character: string): number {
  const codePoint = character.codePointAt(0) ?? 0
  if (isZeroWidthTitleCharacter(codePoint)) return 0
  if (/\s/.test(character)) return 0.25
  if (codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff) return 0.525
  if (isWideCharacter(codePoint)) return isEmoji(codePoint) ? 1.05 : 0.95
  if ("ilI|.,:;!'`".includes(character)) return 0.28
  if ("-/()[]{}".includes(character)) return 0.4
  if ("mw".includes(character)) return 0.82
  if (character === "W") return 0.98
  if ("M@%#&".includes(character)) return 0.9
  if (/[A-Z]/.test(character)) return 0.66
  if (/[a-z]/.test(character)) return 0.53
  if (/[0-9]/.test(character)) return 0.58
  return 0.6
}

function isWideCharacter(codePoint: number): boolean {
  return (codePoint >= 0x2e80 && codePoint <= 0x9fff)
    || (codePoint >= 0x3040 && codePoint <= 0x30ff)
    || (codePoint >= 0xac00 && codePoint <= 0xd7af)
    || (codePoint >= 0xf900 && codePoint <= 0xfaff)
    || (codePoint >= 0xff01 && codePoint <= 0xff60)
    || (codePoint >= 0x20000 && codePoint <= 0x3fffd)
    || isEmoji(codePoint)
}

function isEmoji(codePoint: number): boolean {
  return (codePoint >= 0x1f000 && codePoint <= 0x1faff)
    || (codePoint >= 0x2600 && codePoint <= 0x27bf)
}

function isCombiningMark(codePoint: number): boolean {
  return (codePoint >= 0x0300 && codePoint <= 0x036f)
    || (codePoint >= 0x1ab0 && codePoint <= 0x1aff)
    || (codePoint >= 0x1dc0 && codePoint <= 0x1dff)
    || (codePoint >= 0x20d0 && codePoint <= 0x20ff)
    || (codePoint >= 0xfe20 && codePoint <= 0xfe2f)
}

function isZeroWidthTitleCharacter(codePoint: number): boolean {
  return isCombiningMark(codePoint)
    || codePoint === 0x200d
    || codePoint === 0xfe0e
    || codePoint === 0xfe0f
    || (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff)
    || (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
}
