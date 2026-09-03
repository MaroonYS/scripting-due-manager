export type HomeWidgetFamily = "systemSmall" | "systemMedium" | "systemLarge"

const LIST_VERTICAL_PADDING = 22

function listMetrics(family: Exclude<HomeWidgetFamily, "systemSmall">) {
  return family === "systemMedium"
    ? { headerAndTopGap: 23, minimumRows: 2, maximumRows: 3, minimumRowHeight: 35 }
    : { headerAndTopGap: 106, minimumRows: 3, maximumRows: 5, minimumRowHeight: 38 }
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

  const metrics = listMetrics(family)
  for (let capacity = metrics.maximumRows; capacity >= metrics.minimumRows; capacity -= 1) {
    const dividers = family === "systemMedium" ? Math.max(0, capacity - 1) : 0
    const requiredHeight = LIST_VERTICAL_PADDING
      + metrics.headerAndTopGap
      + capacity * metrics.minimumRowHeight
      + dividers
    if (displayHeight >= requiredHeight) return capacity
  }
  return metrics.minimumRows
}

/** Uses the actual WidgetKit height so every supported iPhone size fills cleanly. */
export function widgetRowHeight(
  family: Exclude<HomeWidgetFamily, "systemSmall">,
  displayHeight: number | undefined,
  capacity: number,
): number {
  if (typeof displayHeight !== "number" || !Number.isFinite(displayHeight) || capacity <= 0) {
    return family === "systemMedium" ? 38 : 45
  }
  const metrics = listMetrics(family)
  const dividers = family === "systemMedium" ? Math.max(0, capacity - 1) : 0
  const available = displayHeight
    - LIST_VERTICAL_PADDING
    - metrics.headerAndTopGap
    - dividers
  return family === "systemMedium"
    ? clamp(Math.floor(available / capacity), metrics.minimumRowHeight, 42)
    : clamp(Math.floor(available / capacity), metrics.minimumRowHeight, 48)
}

export function visibleWidgetItems<T>(items: readonly T[], capacity: number): T[] {
  return items.slice(0, Math.max(0, Math.trunc(capacity)))
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
