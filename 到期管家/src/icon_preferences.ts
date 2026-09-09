// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { parseOnlineArtworkID } from "./online_artwork_ids"
import { parseGithubArtworkID } from "./github_artwork_ids"

export type IconSource = "manual" | "reminder"
export interface ItemIconChoice { source: IconSource; itemID: string; iconID: string }
export interface ItemIconEdit { iconID: string | null; expectedIconID: string | null }
export const MAX_ITEM_ICON_CHOICES = 2000

export function validStoredIconID(value: unknown): value is string {
  return typeof value === "string" && (/^(?:icons8-[A-Za-z0-9]{1,32}|sf:[a-z0-9.]{1,100})$/.test(value) || parseOnlineArtworkID(value) != null || parseGithubArtworkID(value) != null)
}

/** Unknown but well-formed IDs are retained for lossless imports/future catalogs. */
export function normalizeItemIconChoices(raw: unknown): ItemIconChoice[] {
  if (raw == null) return []
  if (!Array.isArray(raw) || raw.length > MAX_ITEM_ICON_CHOICES) throw Error("图标选择数据无效或超过 2000 条，原数据已保留。")
  const seen = new Set<string>()
  return raw.map(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)
      || (value.source !== "manual" && value.source !== "reminder")
      || typeof value.itemID !== "string" || !value.itemID || value.itemID.length > 512
      || !validStoredIconID(value.iconID)) throw Error("事项图标选择格式无效，原数据已保留。")
    const key = JSON.stringify([value.source, value.itemID])
    if (seen.has(key)) throw Error("事项图标选择重复，原数据已保留。")
    seen.add(key)
    return { source: value.source, itemID: value.itemID, iconID: value.iconID }
  })
}

export function itemIconID(settings: { itemIconChoices?: ItemIconChoice[] } | undefined, source: IconSource, itemID: string): string | null {
  return settings?.itemIconChoices?.find(choice => choice.source === source && choice.itemID === itemID)?.iconID ?? null
}

/** A row-level compare-and-set merges unrelated edits from the latest state. */
export function applyItemIconEdit<T extends { itemIconChoices?: ItemIconChoice[] }>(
  settings: T, source: IconSource, itemID: string, edit?: ItemIconEdit,
): T {
  if (!edit) return settings
  if (itemIconID(settings, source, itemID) !== edit.expectedIconID) throw Error("此事项的图标已在别处更改，请返回后重新打开。")
  if (edit.iconID != null && !validStoredIconID(edit.iconID)) throw Error("图标标识无效。")
  const choices = (settings.itemIconChoices ?? []).filter(choice => choice.source !== source || choice.itemID !== itemID)
  if (edit.iconID != null) choices.push({ source, itemID, iconID: edit.iconID })
  return { ...settings, itemIconChoices: normalizeItemIconChoices(choices) }
}
