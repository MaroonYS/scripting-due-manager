export type HomeWidgetFamily = "systemSmall" | "systemMedium" | "systemLarge"

const LIST_VERTICAL_PADDING = 22

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

function listMetrics(
  family: Exclude<HomeWidgetFamily, "systemSmall">,
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
  family: Exclude<HomeWidgetFamily, "systemSmall">,
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
