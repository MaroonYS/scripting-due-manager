// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. Third-party artwork retains its own rights.

import { withReadDeadline } from "./async_deadline"
import { githubArtworkID, githubFileURL, parseGithubArtworkID } from "./github_artwork_ids"
import { normalizeIconSubscriptions } from "./icon_subscriptions"
import type { IconSubscription } from "./icon_subscriptions"
import { recommendIconQueries } from "./icon_recommendations"
import { ONLINE_ARTWORK_PAGE_SIZE, safeFluentSVG } from "./online_artwork"
import type { OnlineArtworkPage, OnlineFetch } from "./online_artwork"
import type { LoadedArtwork } from "./artwork_assets"

export const GITHUB_MANIFEST_LIMIT = 2_000_000
export const GITHUB_MANIFEST_TTL = 15 * 60 * 1000
export interface GithubIcon { id: string; label: string; keywords: string }
interface Manifest { icons: GithubIcon[]; warnings: string[]; fetchedAt: number }
const cache = new Map<string, Manifest>()
const pending = new Map<string, Promise<Manifest>>()
const text = (value: unknown, limit = 160) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim().slice(0, limit) : ""
const compact = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")
const record = (value: unknown): Record<string, unknown> | null => value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null

/** Source text is data only. Never evaluate scripts or trust URLs from a manifest. */
export function parseGithubManifest(raw: unknown, sourceURL: string): { icons: GithubIcon[]; warnings: string[] } {
  const source = githubFileURL(sourceURL, "manifest")
  if (!source) throw Error("图库地址无效。")
  const root = record(raw)
  const selfhst = /^https:\/\/raw\.githubusercontent\.com\/selfhst\/icons\/[^/]+\/index\.json$/.test(source)
  const dashboard = /^https:\/\/raw\.githubusercontent\.com\/homarr-labs\/dashboard-icons\/[^/]+\/metadata\.json$/.test(source)
  const sourceRoot = source.slice(0, source.lastIndexOf("/") + 1)
  const rows = selfhst && Array.isArray(raw) ? raw : dashboard && root ? Object.entries(root).map(([slug, value]) => ({ ...record(value), slug })) : root?.icons
  if (!Array.isArray(rows) || rows.length > 10_000) throw Error("清单需包含 icons 数组（name、url），且不可超过 10000 项。")
  const seen = new Set<string>(), icons: GithubIcon[] = []
  let skipped = 0
  for (const value of rows) {
    const row = record(value)
    let label = text(row?.name), url = row?.url, keywords = ""
    if (selfhst && row) {
      const slug = row.Reference
      if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || row.PNG !== "Yes") { skipped++; continue }
      label = text(row.Name)
      url = `${sourceRoot}png/${slug}.png`
      keywords = text(row.Tags, 400) + " " + slug
    } else if (dashboard && row) {
      const slug = row.slug
      if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { skipped++; continue }
      label = slug.replace(/-/g, " ")
      url = `${sourceRoot}png/${slug}.png`
      keywords = Array.isArray(row.aliases) ? row.aliases.slice(0, 20).map(alias => text(alias)).join(" ") : ""
    } else if (row) {
      keywords = text(row.aliases, 400)
    }
    const id = typeof url === "string" ? githubArtworkID(url) : null
    if (!row || !label || !id) { skipped++; continue }
    if (seen.has(id)) continue
    seen.add(id)
    icons.push({ id, label, keywords: `${label} ${keywords}`.slice(0, 800) })
  }
  if (rows.length && !icons.length) throw Error("清单没有可用图标；仅支持公开 GitHub PNG／SVG 图片。")
  return { icons, warnings: skipped ? [`已忽略 ${skipped} 个格式或地址不受支持的图标`] : [] }
}

export async function fetchGithubManifest(source: IconSubscription, options: { fetch?: OnlineFetch; refresh?: boolean; timeoutMS?: number; now?: number } = {}): Promise<Manifest> {
  const url = githubFileURL(source.url, "manifest")
  if (!url) throw Error("图库地址无效。")
  const now = options.now ?? Date.now(), saved = cache.get(url)
  if (!options.refresh && saved && now >= saved.fetchedAt && now - saved.fetchedAt < GITHUB_MANIFEST_TTL) return saved
  const existing = pending.get(url)
  if (existing) return existing
  if (pending.size >= 12) throw Error("图库请求较多，请稍后重试。")
  const timeoutMS = options.timeoutMS ?? 8500
  const request = withReadDeadline(async () => {
    const response = await (options.fetch ?? fetch)(url, { timeout: timeoutMS / 1000, handleRedirect: async () => null })
    if (!response.ok) throw Error("图库暂时无法访问。")
    if ((response.expectedContentLength ?? 0) > GITHUB_MANIFEST_LIMIT) throw Error("图库清单过大。")
    const body = await response.text()
    if (body.length > GITHUB_MANIFEST_LIMIT) throw Error("图库清单过大。")
    const parsed = parseGithubManifest(JSON.parse(body), url)
    return { ...parsed, fetchedAt: now }
  }, timeoutMS).then(result => {
    cache.delete(url); cache.set(url, result)
    while (cache.size > 12) cache.delete(cache.keys().next().value!)
    return result
  }).catch(() => {
    if (saved) return { ...saved, warnings: [...saved.warnings, "在线更新失败，暂用本次会话上次成功的清单"] }
    throw Error("无法读取图库，请检查网络、公开链接及 JSON 格式。")
  }).finally(() => { pending.delete(url) })
  pending.set(url, request)
  return request
}

/** Queries stay local. Only the configured public manifest URLs are requested. */
export async function searchGithubArtwork(query: string, page: number, sources: readonly IconSubscription[], options: {
  fetch?: OnlineFetch; refresh?: boolean; shouldContinue?: () => boolean; timeoutMS?: number
} = {}): Promise<OnlineArtworkPage> {
  if (query.length > 100 || /[\u0000-\u001f\u007f]/.test(query) || !Number.isInteger(page) || page < 0 || page >= 5000) throw Error("搜索词或页码无效。")
  const enabled = normalizeIconSubscriptions(sources).filter(source => source.enabled)
  if (!enabled.length) throw Error("尚未启用图库，请在「管理 GitHub 图库订阅」中添加或启用。")
  const results: (Manifest | null)[] = Array(enabled.length).fill(null), warnings: string[] = []
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(3, enabled.length) }, async () => {
    for (;;) {
      if (options.shouldContinue?.() === false) return
      const index = cursor++
      if (index >= enabled.length) return
      try { results[index] = await fetchGithubManifest(enabled[index], options) }
      catch { warnings.push(`${enabled[index].name}：暂时无法读取，其余图库仍可搜索`) }
    }
  }))
  if (options.shouldContinue?.() === false) throw Error("搜索已取消。")
  if (!results.some(Boolean)) throw Error("所有已启用图库均无法读取，请检查网络后重试。")
  const term = compact(query), recommended = query.trim() ? recommendIconQueries(query) : null
  const alias = recommended?.brand ? compact(recommended.github) : ""
  const words = query.trim().split(/\s+/).map(compact).filter(Boolean)
  const found: { id: string; label: string; detail: string; score: number }[] = [], seen = new Set<string>()
  results.forEach((result, index) => {
    if (!result) return
    warnings.push(...result.warnings.map(warning => `${enabled[index].name}：${warning}`))
    for (const icon of result.icons) {
      const name = compact(icon.label), keywords = compact(icon.keywords)
      const score = !term ? 1 : name === term || alias && name === alias ? 100 : name.startsWith(term) ? 80
        : name.includes(term) ? 70 : alias && name.includes(alias) ? 60
        : words.length && words.every(word => keywords.includes(word)) ? 40 : alias && keywords.includes(alias) ? 30 : 0
      if (!score || seen.has(icon.id)) continue
      seen.add(icon.id)
      found.push({ id: icon.id, label: icon.label, detail: enabled[index].name, score })
    }
  })
  found.sort((a, b) => b.score - a.score)
  const start = page * ONLINE_ARTWORK_PAGE_SIZE
  return { icons: found.slice(start, start + ONLINE_ARTWORK_PAGE_SIZE).map(({ score, ...icon }) => icon), page,
    hasMore: start + ONLINE_ARTWORK_PAGE_SIZE < found.length && page < 4999, warnings }
}

export async function loadGithubArtwork(id: string, options: { fetch?: OnlineFetch; timeoutMS?: number } = {}): Promise<LoadedArtwork | null> {
  const url = parseGithubArtworkID(id)
  if (!url) return null
  const svgFile = /\.svg$/i.test(url), limit = svgFile ? 200_000 : 2_000_000, timeoutMS = options.timeoutMS ?? 4000
  try {
    return await withReadDeadline(async () => {
      const response = await (options.fetch ?? fetch)(url, { timeout: timeoutMS / 1000, handleRedirect: async () => null })
      if (!response.ok || (response.expectedContentLength ?? 0) > limit) return null
      if (svgFile) {
        const svg = safeFluentSVG(await response.text())
        return svg ? { ...svg, adaptive: true, lightBackplate: false } : null
      }
      if (typeof UIImage === "undefined") return null
      const data = await response.data()
      if (!safeGithubPNGData(data)) return null
      const image = UIImage.fromData(data)
      if (!image || !Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width <= 0 || image.height <= 0 || image.width > 2048 || image.height > 2048) return null
      // Keep only a bounded preview in the shared cache, not 64 full-size PNGs.
      const scale = Math.min(1, 192 / Math.max(image.width, image.height))
      const preview = scale === 1 ? image : image.preparingThumbnail?.({ width: Math.max(1, Math.round(image.width * scale)), height: Math.max(1, Math.round(image.height * scale)) })
      if (!preview || !Number.isFinite(preview.width) || !Number.isFinite(preview.height) || preview.width <= 0 || preview.height <= 0 || preview.width > 192 || preview.height > 192) return null
      return { image: preview, aspectWidth: image.width, aspectHeight: image.height, adaptive: true, lightBackplate: false }
    }, timeoutMS)
  } catch { return null }
}

/** Inspect the PNG signature and IHDR before asking the native decoder to allocate pixels. */
export function safeGithubPNGData(value: unknown): boolean {
  if (!value || typeof value !== "object") return false
  const data = value as { size?: number; slice?: (start: number, end: number) => { toUint8Array?: () => Uint8Array | null; getBytes?: () => Uint8Array | null } }
  if (typeof data.size !== "number" || !Number.isFinite(data.size) || data.size < 24 || data.size > 2_000_000 || typeof data.slice !== "function") return false
  try {
    const header = data.slice(0, 24)
    const bytes = typeof header.toUint8Array === "function" ? header.toUint8Array() : header.getBytes?.()
    if (!bytes || bytes.length !== 24 || ![137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82].every((byte, index) => bytes[index] === byte)) return false
    const dimension = (index: number) => bytes[index] * 16777216 + bytes[index + 1] * 65536 + bytes[index + 2] * 256 + bytes[index + 3]
    const width = dimension(16), height = dimension(20)
    return width > 0 && height > 0 && width <= 2048 && height <= 2048
  } catch { return false }
}
