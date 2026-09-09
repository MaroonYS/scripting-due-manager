// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// Third-party artwork retains its own rights. See assets/icons8/NOTICE.md.

import { ARTWORK_ROWS } from "./artwork_data"
import { DUE_ICON_OPTIONS } from "./icons"
import { itemIconID } from "./icon_preferences"
import type { AppSettings, DisplayDueItem } from "./types"

export interface ArtworkDefinition { id: string; label: string; group: string; aliases: string; path: string; lightBackplate: boolean }
export const ARTWORK_CATALOG: readonly ArtworkDefinition[] = ARTWORK_ROWS.map(([id, label, group, aliases, lightBackplate]) => ({
  id, label, group, aliases, lightBackplate, path: `assets/icons8/${id.slice("icons8-".length)}.png`,
}))
const catalogByID = new Map(ARTWORK_CATALOG.map(icon => [icon.id, icon]))
const symbolsByName = new Map(DUE_ICON_OPTIONS.map(icon => [icon.name, icon]))
export const ARTWORK_GROUPS = [...new Set(ARTWORK_CATALOG.map(icon => icon.group))]
export const ARTWORK_PAGE_SIZE = 24
export const ARTWORK_STYLE = "Icons8 · Windows 11 Color"

export function artworkByID(id: string | null | undefined): ArtworkDefinition | null { return id ? catalogByID.get(id) ?? null : null }
export function symbolChoice(id: string | null | undefined) { return id?.startsWith("sf:") ? symbolsByName.get(id.slice(3)) ?? null : null }
export function isKnownIconChoice(id: string | null) { return id == null || artworkByID(id) != null || symbolChoice(id) != null }

const normalizedText = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")
const searchIndex = new Map(ARTWORK_CATALOG.map(icon => [icon.id, normalizedText(`${icon.label} ${icon.aliases} ${icon.group}`)]))
export function searchArtwork(query: string, group = "全部"): ArtworkDefinition[] {
  const terms = query.trim().split(/\s+/).map(normalizedText).filter(Boolean)
  return ARTWORK_CATALOG.filter(icon => (group === "全部" || icon.group === group)
    && terms.every(term => searchIndex.get(icon.id)!.includes(term)))
}

/** Decoration only: identity, action keys, deadlines and permissions stay untouched. */
export function withItemIconChoices(items: readonly DisplayDueItem[], settings: AppSettings): DisplayDueItem[] {
  return items.map(item => {
    const choice = itemIconID(settings, item.source, item.id)
    const symbol = symbolChoice(choice)
    if (symbol) return { ...item, iconName: symbol.name, iconColor: symbol.color, iconIsExplicit: true, artworkID: undefined }
    const artwork = artworkByID(choice)
    return artwork ? { ...item, artworkID: artwork.id } : { ...item, artworkID: undefined }
  })
}
