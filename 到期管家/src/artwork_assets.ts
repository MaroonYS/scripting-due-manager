// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. Third-party artwork retains its own rights.

import { artworkByID } from "./artwork_catalog"
import { withReadDeadline } from "./async_deadline"
import { loadOnlineArtwork } from "./online_artwork"
import { parseOnlineArtworkID } from "./online_artwork_ids"

export const ARTWORK_READ_TIMEOUT_MS = 1400
export const ARTWORK_CACHE_LIMIT = 64
export type LoadedArtwork = { lightBackplate: boolean; adaptive?: boolean } & (
  | { image: UIImage; svg?: never; width?: never; height?: never }
  | { image?: never; svg: string; width: number; height: number }
)
const ready = new Map<string, LoadedArtwork>()
const pending = new Map<string, Promise<LoadedArtwork | null>>()
const cacheKey = (id: string, directory: string) => JSON.stringify([directory, id])

export function peekArtwork(id: string | null | undefined, directory: string): LoadedArtwork | null {
  if (!id || (!artworkByID(id) && parseOnlineArtworkID(id)?.provider !== "fluent")) return null
  const key = cacheKey(id, directory), value = ready.get(key)
  if (!value) return null
  ready.delete(key); ready.set(key, value)
  return value
}

async function decodeArtwork(id: string, directory: string): Promise<UIImage | null> {
  const icon = artworkByID(id)
  if (!icon || typeof UIImage === "undefined" || typeof FileManager === "undefined") return null
  if (typeof UIImage.fromData === "function" && typeof FileManager.readAsData === "function") {
    try {
      const bytes = await withReadDeadline(() => FileManager.readAsData(`${directory}/${icon.path}`), 650)
      const image = bytes ? UIImage.fromData(bytes) : null
      if (image) return image
    } catch { /* Independent per-image fallback; never decode the whole catalog. */ }
  }
  if (typeof UIImage.fromBase64String === "function" && typeof FileManager.readAsString === "function") {
    try {
      const fallback = icon.path.replace("assets/icons8/", "assets/icons8/fallbacks/").replace(/\.png$/, ".json")
      const text = await FileManager.readAsString(`${directory}/${fallback}`)
      if (typeof text !== "string" || text.length > 350_000) return null
      const data: unknown = JSON.parse(text)
      if (!data || typeof data !== "object" || Array.isArray(data)) return null
      const value = data as Record<string, unknown>
      if (value.source !== icon.path || value.encoding !== "base64" || typeof value.png !== "string") return null
      return UIImage.fromBase64String(value.png)
    } catch { /* Broken artwork cannot disable an item's system-symbol action. */ }
  }
  return null
}

export function loadArtwork(id: string | null | undefined, directory: string): Promise<LoadedArtwork | null> {
  if (!id || (!artworkByID(id) && !parseOnlineArtworkID(id))) return Promise.resolve(null)
  const cached = peekArtwork(id, directory)
  if (cached) return Promise.resolve(cached)
  const key = cacheKey(id, directory), existing = pending.get(key)
  if (existing) return existing
  // Rapid page changes must not start an unbounded number of file reads.
  if (pending.size >= 64) return Promise.resolve(null)
  if (parseOnlineArtworkID(id)) {
    const request: Promise<LoadedArtwork | null> = loadOnlineArtwork(id).then(image => {
      // Iconify permits caching; keep a bounded session-only SVG cache. Icons8
      // responses never enter this cache and are loaded for each new display.
      if (image && parseOnlineArtworkID(id)?.provider === "fluent") {
        ready.set(key, image)
        while (ready.size > ARTWORK_CACHE_LIMIT) ready.delete(ready.keys().next().value!)
      }
      return image
    }).finally(() => { pending.delete(key) })
    pending.set(key, request)
    return request
  }
  const request = withReadDeadline(() => decodeArtwork(id, directory), ARTWORK_READ_TIMEOUT_MS)
    .catch(() => null).then(image => {
      if (image) {
        const artwork = { image, lightBackplate: artworkByID(id)!.lightBackplate }
        ready.set(key, artwork)
        while (ready.size > ARTWORK_CACHE_LIMIT) ready.delete(ready.keys().next().value!)
        return artwork
      }
      return null
    }).finally(() => { pending.delete(key) })
  pending.set(key, request)
  return request
}

/** Bounded batch: caller passes only the visible page or widget rows. */
export async function loadArtworkPage(ids: readonly (string | null | undefined)[], directory: string, options: {
  shouldContinue?: () => boolean; onImage?: (id: string, image: LoadedArtwork) => void
} = {}): Promise<Record<string, LoadedArtwork>> {
  const queue = [...new Set(ids.filter((id): id is string => artworkByID(id) != null || parseOnlineArtworkID(id) != null))].slice(0, 24)
  const result: Record<string, LoadedArtwork> = {}
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
    for (;;) {
      if (options.shouldContinue?.() === false) break
      const id = queue[cursor++]
      if (!id) break
      const image = await loadArtwork(id, directory)
      if (image && options.shouldContinue?.() !== false) { result[id] = image; options.onImage?.(id, image) }
    }
  }))
  return result
}
