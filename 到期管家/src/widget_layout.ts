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
    return clamp(Math.floor((displayHeight - 66) / 34), 2, 3)
  }
  return clamp(Math.floor((displayHeight - 79) / 38), 5, 7)
}

export function visibleWidgetItems<T>(items: readonly T[], capacity: number): T[] {
  return items.slice(0, Math.max(0, Math.trunc(capacity)))
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
