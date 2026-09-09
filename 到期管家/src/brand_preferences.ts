// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { BRAND_CATALOG, type BrandDefinition } from "./brand_catalog"
import type { AppSettings, DisplayDueItem } from "./types"

/** Legacy field retained for lossless backup roundtrips; no longer controls rendering. */
export type SmallWidgetIconStyle = "system" | "brand"
export interface ItemBrandChoice {
  source: "manual" | "reminder"
  itemID: string
  /** "system" or absence uses the item's SF Symbol; a brand ID selects only that item. */
  brandID: string
}
export const MAX_BRAND_CHOICES = 2000

/** Strict preservation: malformed settings must not be silently lost on save. */
export function normalizeBrandPreferences(raw: Record<string, unknown>): {
  smallWidgetIconStyle: SmallWidgetIconStyle
  itemBrandChoices: ItemBrandChoice[]
} {
  const style = raw.smallWidgetIconStyle ?? "system"
  if (style !== "system" && style !== "brand") throw new Error("小组件图标模式无效，原数据已保留。")
  const choices = raw.itemBrandChoices ?? []
  if (!Array.isArray(choices) || choices.length > MAX_BRAND_CHOICES) {
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
    return { source: value.source, itemID: value.itemID, brandID: value.brandID } as ItemBrandChoice
  })
  return { smallWidgetIconStyle: style, itemBrandChoices: normalized }
}

export function itemBrandChoice(settings: AppSettings, item: Pick<DisplayDueItem, "source" | "id">): string | null {
  return settings.itemBrandChoices?.find(choice => choice.source === item.source && choice.itemID === item.id)?.brandID ?? null
}

export function withItemBrandChoice(settings: AppSettings, item: Pick<DisplayDueItem, "source" | "id">, brandID: string | null): ItemBrandChoice[] {
  const choices = (settings.itemBrandChoices ?? []).filter(choice => choice.source !== item.source || choice.itemID !== item.id)
  if (brandID !== null) choices.push({ source: item.source, itemID: item.id, brandID })
  return normalizeBrandPreferences({ itemBrandChoices: choices }).itemBrandChoices
}

export function resolveItemBrand(
  item: Pick<DisplayDueItem, "source" | "id" | "title" | "iconIsExplicit" | "stale" | "canComplete">,
  settings: AppSettings,
): BrandDefinition | null {
  if (item.stale || !item.canComplete) return null
  const choice = itemBrandChoice(settings, item)
  // One explicit choice, shared by the app and small widget. A legacy global
  // mode or another item's choice can neither select nor hide this item's logo.
  if (choice === null || choice === "system") return null
  return BRAND_CATALOG.find(brand => brand.id === choice) ?? null
}
