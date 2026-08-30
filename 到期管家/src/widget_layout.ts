export type HomeWidgetFamily = "systemSmall" | "systemMedium" | "systemLarge"

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
    return family === "systemMedium" ? 3 : 7
  }
  if (family === "systemMedium") {
    return displayHeight >= 155 ? 3 : 2
  }
  return clamp(Math.floor((displayHeight - 64) / 40), 5, 7)
}

/** Uses the actual WidgetKit height so every supported iPhone size fills cleanly. */
export function widgetRowHeight(
  family: Exclude<HomeWidgetFamily, "systemSmall">,
  displayHeight: number | undefined,
  capacity: number,
): number {
  if (typeof displayHeight !== "number" || !Number.isFinite(displayHeight) || capacity <= 0) {
    return family === "systemMedium" ? 38 : 42
  }
  const padding = family === "systemMedium" ? 22 : 28
  const headerAndTopGap = family === "systemMedium" ? 23 : 26
  const dividers = Math.max(0, capacity - 1)
  const available = displayHeight - padding - headerAndTopGap - dividers
  return family === "systemMedium"
    ? clamp(Math.floor(available / capacity), 35, 40)
    : clamp(Math.floor(available / capacity), 38, 44)
}

export function visibleWidgetItems<T>(items: readonly T[], capacity: number): T[] {
  return items.slice(0, Math.max(0, Math.trunc(capacity)))
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
