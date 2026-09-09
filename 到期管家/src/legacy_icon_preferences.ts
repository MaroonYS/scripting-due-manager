// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

/** Compatibility data only. No catalog, images or rendering decisions belong here. */
export type LegacySmallWidgetIconStyle = "system" | "brand"
export interface LegacyItemBrandChoice {
  source: "manual" | "reminder"
  itemID: string
  /** Inactive pre-2.8.1 choice, including unknown IDs; preserved without lookup. */
  brandID: string
}
export const MAX_LEGACY_ICON_CHOICES = 2000

/** Strict preservation: malformed settings must not be silently lost on save. */
export function normalizeLegacyIconPreferences(raw: Record<string, unknown>): {
  smallWidgetIconStyle: LegacySmallWidgetIconStyle
  itemBrandChoices: LegacyItemBrandChoice[]
} {
  const style = raw.smallWidgetIconStyle ?? "system"
  if (style !== "system" && style !== "brand") throw new Error("小组件图标模式无效，原数据已保留。")
  const choices = raw.itemBrandChoices ?? []
  if (!Array.isArray(choices) || choices.length > MAX_LEGACY_ICON_CHOICES) {
    throw new Error("事项品牌选择数据无效或超过 2000 条，原数据已保留。")
  }
  const keys = new Set<string>()
  const normalized = choices.map((choice: unknown) => {
    if (choice == null || typeof choice !== "object" || Array.isArray(choice)) throw new Error("事项品牌选择格式无效。")
    const value = choice as Record<string, unknown>
    if ((value.source !== "manual" && value.source !== "reminder")
      || typeof value.itemID !== "string" || !value.itemID || value.itemID.length > 512
      || typeof value.brandID !== "string" || !/^[a-z0-9][a-z0-9-]{0,95}$/.test(value.brandID)) {
      throw new Error("事项品牌选择标识无效，原数据已保留。")
    }
    const key = JSON.stringify([value.source, value.itemID])
    if (keys.has(key)) throw new Error("事项品牌选择重复，原数据已保留。")
    keys.add(key)
    return { source: value.source, itemID: value.itemID, brandID: value.brandID } as LegacyItemBrandChoice
  })
  return { smallWidgetIconStyle: style, itemBrandChoices: normalized }
}
