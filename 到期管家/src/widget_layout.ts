export type HomeWidgetFamily = "systemSmall" | "systemMedium" | "systemLarge"

const LIST_VERTICAL_PADDING = 22
const LIST_WIDGET_FALLBACK_WIDTH = 364
const TITLE_WRAP_TOLERANCE = 2
const TITLE_WIDTH_SAFETY_FACTOR = 1.015

type ListWidgetFamily = Exclude<HomeWidgetFamily, "systemSmall">

export type LargeWidgetLayout = {
  summaryHeight: number
  sectionHeaderHeight: number
  maximumSections: 1 | 2
  maximumRows: 3 | 4 | 5
}

/** Mirrors the denser and roomier large-widget heights used across iPhones. */
export function largeWidgetLayout(displayHeight?: number): LargeWidgetLayout {
  if (typeof displayHeight !== "number" || !Number.isFinite(displayHeight)) {
    return { summaryHeight: 74, sectionHeaderHeight: 32, maximumSections: 2, maximumRows: 5 }
  }
  if (displayHeight >= 350) {
    return { summaryHeight: 74, sectionHeaderHeight: 32, maximumSections: 2, maximumRows: 5 }
  }
  if (displayHeight >= 310) {
    return { summaryHeight: 70, sectionHeaderHeight: 28, maximumSections: 1, maximumRows: 5 }
  }
  if (displayHeight >= 272) {
    return { summaryHeight: 70, sectionHeaderHeight: 28, maximumSections: 1, maximumRows: 4 }
  }
  return { summaryHeight: 66, sectionHeaderHeight: 24, maximumSections: 1, maximumRows: 3 }
}

/**
 * Uses the actual widget width and a lightweight glyph-width estimate to make
 * titles that need a second line one point smaller. Text still owns wrapping;
 * this only selects the more balanced typography before the view is rendered.
 */
export function listItemTitleFontSize(
  title: string,
  family: ListWidgetFamily,
  displayWidth?: number,
): number {
  const baseFontSize = family === "systemLarge" ? 15 : 14
  const compactFontSize = baseFontSize - 1
  const extraCompactFontSize = baseFontSize - 2
  const hasExplicitLineBreak = /[\r\n\u2028\u2029]/.test(title)
  const widgetWidth = typeof displayWidth === "number"
    && Number.isFinite(displayWidth)
    && displayWidth > 0
    ? displayWidth
    : LIST_WIDGET_FALLBACK_WIDTH
  // WidgetFrame (22) + list inset (6) + hit area + title/metadata gap + metadata.
  const reservedWidth = family === "systemLarge" ? 200 : 190
  const availableWidth = Math.max(72, widgetWidth - reservedWidth)
  const baseWidth = estimatedTitleWidth(title, baseFontSize)

  if (!hasExplicitLineBreak && baseWidth <= availableWidth + TITLE_WRAP_TOLERANCE) {
    return baseFontSize
  }

  const compactTwoLineWidth = estimatedTitleWidth(title, compactFontSize)
  return compactTwoLineWidth > availableWidth * 1.9
    ? extraCompactFontSize
    : compactFontSize
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

function listMetrics(
  family: ListWidgetFamily,
  displayHeight?: number,
) {
  if (family === "systemMedium") {
    return { headerAndTopGap: 23, minimumRows: 2, maximumRows: 3, minimumRowHeight: 35 }
  }
  const layout = largeWidgetLayout(displayHeight)
  return {
    headerAndTopGap: layout.summaryHeight
      + layout.sectionHeaderHeight * layout.maximumSections,
    minimumRows: 3,
    maximumRows: layout.maximumRows,
    minimumRowHeight: 38,
  }
}

/**
 * Keeps rows readable on compact devices while filling taller widget variants.
 * The fallbacks match the common iPhone Home Screen sizes.
 */
export function widgetItemCapacity(
  family: HomeWidgetFamily,
  displayHeight?: number,
): number {
  if (family === "systemSmall") return 1
  if (typeof displayHeight !== "number" || !Number.isFinite(displayHeight)) {
    return family === "systemMedium" ? 3 : 5
  }

  const metrics = listMetrics(family, displayHeight)
  for (let capacity = metrics.maximumRows; capacity >= metrics.minimumRows; capacity -= 1) {
    const rowGaps = family === "systemMedium" ? Math.max(0, capacity - 1) : 0
    const requiredHeight = LIST_VERTICAL_PADDING
      + metrics.headerAndTopGap
      + capacity * metrics.minimumRowHeight
      + rowGaps
    if (displayHeight >= requiredHeight) return capacity
  }
  return metrics.minimumRows
}

/** Uses the actual WidgetKit height so every supported iPhone size fills cleanly. */
export function widgetRowHeight(
  family: ListWidgetFamily,
  displayHeight: number | undefined,
  capacity: number,
  largeSectionCount?: number,
): number {
  if (typeof displayHeight !== "number" || !Number.isFinite(displayHeight) || capacity <= 0) {
    if (family === "systemMedium") return 38
    return largeSectionCount === 1 ? 50 : 44
  }
  if (family === "systemMedium") {
    const metrics = listMetrics(family, displayHeight)
    const rowGaps = Math.max(0, capacity - 1)
    const available = displayHeight
      - LIST_VERTICAL_PADDING
      - metrics.headerAndTopGap
      - rowGaps
    return clamp(Math.floor(available / capacity), metrics.minimumRowHeight, 42)
  }

  const layout = largeWidgetLayout(displayHeight)
  const sectionCount = clamp(
    Math.trunc(largeSectionCount ?? layout.maximumSections),
    1,
    layout.maximumSections,
  )
  const available = displayHeight
    - LIST_VERTICAL_PADDING
    - layout.summaryHeight
    - layout.sectionHeaderHeight * sectionCount
  return clamp(Math.floor(available / capacity), 38, 50)
}

export function visibleWidgetItems<T>(items: readonly T[], capacity: number): T[] {
  return items.slice(0, Math.max(0, Math.trunc(capacity)))
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
