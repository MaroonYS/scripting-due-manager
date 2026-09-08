// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { BRAND_CATALOG, type BrandDefinition } from "./brand_catalog"
import type { AppSettings, DisplayDueItem } from "./types"

export type SmallWidgetIconStyle = "system" | "brand"
export interface ItemBrandChoice {
  source: "manual" | "reminder"
  itemID: string
  /** "system" explicitly keeps the SF Symbol; absence means automatic. */
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

function containsAlias(title: string, alias: string): boolean {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  // Latin names need word boundaries; Chinese titles commonly append 续费/还款.
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(title)
}

/** Local title only. Never inspect SIM data, contacts, notes or network services. */
export function inferItemBrand(title: string): BrandDefinition | null {
  const matches = BRAND_CATALOG.filter(brand => brand.aliases.some(alias => containsAlias(title, alias)))
  return matches.length === 1 ? matches[0] : null
}

export function resolveItemBrand(item: DisplayDueItem, settings: AppSettings): BrandDefinition | null {
  if (settings.smallWidgetIconStyle !== "brand" || item.stale || !item.canComplete) return null
  const choice = itemBrandChoice(settings, item)
  if (choice === "system") return null
  if (choice !== null) return BRAND_CATALOG.find(brand => brand.id === choice) ?? null
  if (item.iconIsExplicit) return null
  return inferItemBrand(item.title)
}
