// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// Third-party artwork retains its own rights. See NOTICE.md.

import { withReadDeadline } from "./async_deadline"
import { readIcons8Key } from "./icon_credentials"
import { parseOnlineArtworkID } from "./online_artwork_ids"
import type { OnlineArtworkProvider } from "./online_artwork_ids"

export const ONLINE_ARTWORK_PAGE_SIZE = 24
export const ONLINE_SEARCH_TIMEOUT_MS = 8500
export const ICONS8_STYLES = ["全部风格", "Windows 11 Color", "Color", "Fluent", "iOS Glyphs"] as const
export type Icons8Style = typeof ICONS8_STYLES[number]
const STYLE_CODES: Record<Icons8Style, string> = { "全部风格": "", "Windows 11 Color": "fluency", Color: "color", Fluent: "fluent", "iOS Glyphs": "ios-glyphs" }

export interface OnlineArtworkResult { id: string; label: string; detail: string }
export interface OnlineArtworkPage { icons: OnlineArtworkResult[]; hasMore: boolean; page: number; warnings?: string[] }
export interface OnlineRequestOptions { timeout: number; headers?: Record<string, string>; handleRedirect: () => Promise<null> }
export interface OnlineResponse { ok: boolean; status: number; text(): Promise<string>; data(): Promise<unknown>; expectedContentLength?: number }
export type OnlineFetch = (url: string, options: OnlineRequestOptions) => Promise<OnlineResponse>
const noRedirect = async () => null

function queryString(values: Record<string, string | number>): string {
  return Object.entries(values).filter(([, value]) => value !== "").map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join("&")
}
function record(value: unknown): Record<string, unknown> | null { return value != null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null }
function safeLabel(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim().slice(0, 120) || fallback : fallback
}

export function onlineSearchRequest(provider: OnlineArtworkProvider, query: string, page: number, style: Icons8Style = "全部风格", apiKey: string | null = null) {
  const term = query.normalize("NFKC").trim()
  if (!term || term.length > 100 || /[\u0000-\u001f\u007f]/.test(term)) throw Error("请输入 1–100 个字符的搜索词。")
  if (!Number.isInteger(page) || page < 0 || page > 200) throw Error("搜索页码无效，请重新搜索。")
  const options: OnlineRequestOptions = { timeout: 8, handleRedirect: noRedirect }
  if (provider === "fluent") return {
    url: `https://api.iconify.design/search?${queryString({ query: term, prefix: "fluent-emoji-flat", limit: 32, start: page * ONLINE_ARTWORK_PAGE_SIZE })}`,
    options,
  }
  if (provider !== "icons8" || !Object.prototype.hasOwnProperty.call(STYLE_CODES, style)) throw Error("未知的在线图库或风格。")
  if (!apiKey) throw Error("Icons8 在线搜索需要 API Key，请先在下方安全配置。")
  if (!/^[\x21-\x7e]{1,512}$/.test(apiKey)) throw Error("Icons8 API Key 格式无效，请重新配置。")
  options.headers = { "Api-Key": apiKey, "Cache-Control": "no-store" }
  return {
    url: `https://search.icons8.com/api/iconsets/v5/search?${queryString({ term, amount: ONLINE_ARTWORK_PAGE_SIZE, offset: page * ONLINE_ARTWORK_PAGE_SIZE, platform: STYLE_CODES[style], language: "zh", authors: "icons8", isAnimated: "false" })}`,
    options,
  }
}

export function parseOnlineSearchPage(provider: OnlineArtworkProvider, raw: unknown, page: number): OnlineArtworkPage {
  const data = record(raw)
  if (!data || !Array.isArray(data.icons) || data.icons.length > 1000 || data.success === false) throw Error("图库返回了无法识别的数据，请稍后重试。")
  const seen = new Set<string>(), icons: OnlineArtworkResult[] = []
  for (const value of data.icons.slice(0, ONLINE_ARTWORK_PAGE_SIZE)) {
    if (provider === "fluent") {
      const id = parseOnlineArtworkID(value)
      if (!id || id.provider !== "fluent" || seen.has(value as string)) continue
      seen.add(value as string)
      icons.push({ id: value as string, label: id.name.replace(/-/g, " "), detail: "Fluent Emoji Flat" })
    } else {
      const row = record(value)
      if (!row || row.isAnimated === true || row.isExternal === true) continue
      const name = typeof row.id === "number" && Number.isSafeInteger(row.id) && row.id > 0 ? String(row.id) : row.id
      const id = typeof name === "string" ? `icons8-online:${name}` : ""
      if (!parseOnlineArtworkID(id) || seen.has(id)) continue
      seen.add(id)
      icons.push({ id, label: safeLabel(row.name, `Icons8 ${name}`), detail: safeLabel(row.platform, "Icons8") })
    }
  }
  const parameters = record(data.parameters), count = parameters?.countAll ?? data.countAll
  const hasMore = provider === "fluent" ? data.icons.length > ONLINE_ARTWORK_PAGE_SIZE
    : typeof count === "number" && Number.isFinite(count) ? count > (page + 1) * ONLINE_ARTWORK_PAGE_SIZE : data.icons.length === ONLINE_ARTWORK_PAGE_SIZE
  return { icons, hasMore: hasMore && page < 200, page }
}

function responseError(provider: OnlineArtworkProvider, status: number): Error {
  if (status === 401 || status === 403) return Error(provider === "icons8" ? "Icons8 密钥无效或没有当前 API 权限，请检查账户配置。" : "Fluent 图库暂时拒绝访问，请稍后重试。")
  if (status === 429) return Error("图库请求过于频繁或额度已用完，请稍后重试。")
  return Error(`图库暂时不可用（HTTP ${status}），请稍后重试。`)
}

export async function searchOnlineArtwork(provider: OnlineArtworkProvider, query: string, page = 0, style: Icons8Style = "全部风格", dependencies: { fetch?: OnlineFetch; apiKey?: string | null } = {}): Promise<OnlineArtworkPage> {
  const request = onlineSearchRequest(provider, query, page, style, dependencies.apiKey === undefined ? provider === "icons8" ? readIcons8Key() : null : dependencies.apiKey)
  const runFetch = dependencies.fetch ?? fetch
  try {
    const result = await withReadDeadline(async () => {
      const response = await runFetch(request.url, request.options)
      if (!response.ok) return { error: responseError(provider, response.status).message }
      if ((response.expectedContentLength ?? 0) > 1_500_000) return { error: "图库响应过大，请缩小搜索范围。" }
      const body = await response.text()
      if (body.length > 1_500_000) return { error: "图库响应过大，请缩小搜索范围。" }
      return { page: parseOnlineSearchPage(provider, JSON.parse(body), page) }
    }, ONLINE_SEARCH_TIMEOUT_MS)
    if (!result) throw Error("timeout")
    if (result.error) return Promise.reject(Error(result.error))
    return result.page!
  } catch { throw Error("在线搜索失败或超时，请检查网络后重试。") }
}

/** Strict SVG subset: no scripts, embedded images, references, CSS or remote resources. */
export function safeFluentSVG(raw: string): { svg: string; width: number; height: number } | null {
  if (raw.length > 200_000 || !/^\s*<svg\s/i.test(raw) || !/<\/svg>\s*$/.test(raw)
    || /<!|<\?|\bon\w+\s*=|\b(?:href|src|style)\s*=|url\s*\(|javascript:|@import/i.test(raw)) return null
  const allowed = new Set(["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "defs", "lineargradient", "radialgradient", "stop", "clippath", "title", "desc"])
  for (const match of raw.matchAll(/<\/?\s*([a-zA-Z][\w:-]*)/g)) if (!allowed.has(match[1].toLowerCase())) return null
  const dimensions = /\bviewBox\s*=\s*["']\s*(-?[\d.]+)\s+(-?[\d.]+)\s+([\d.]+)\s+([\d.]+)\s*["']/.exec(raw)
  if (!dimensions) return null
  const width = Number(dimensions[3]), height = Number(dimensions[4])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 1024 || height > 1024) return null
  // Iconify uses em units in its standalone SVGs. Normalize only root raster
  // dimensions for the native SVG renderer; viewBox and drawing stay intact.
  const svg = raw.replace(/<svg\s([^>]*)>/i, (_whole, attributes: string) => `<svg ${attributes.replace(/\b(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")} width="${Math.round(width * 3)}" height="${Math.round(height * 3)}">`)
  return { svg, width, height }
}

/** Live display only. No response cache, files, Storage, raw URLs or API keys are saved. */
export async function loadOnlineArtwork(id: string, dependencies: { fetch?: OnlineFetch; apiKey?: string | null; timeoutMS?: number } = {}) {
  const icon = parseOnlineArtworkID(id)
  if (!icon) return null
  const runFetch = dependencies.fetch ?? fetch
  const timeoutMS = dependencies.timeoutMS ?? 4000
  try {
    return await withReadDeadline(async () => {
      const options: OnlineRequestOptions = { timeout: timeoutMS / 1000, handleRedirect: noRedirect }
      if (icon.provider === "fluent") {
        const response = await runFetch(`https://api.iconify.design/fluent-emoji-flat/${icon.name}.svg`, options)
        if (!response.ok || (response.expectedContentLength ?? 0) > 200_000) return null
        const svg = safeFluentSVG(await response.text())
        return svg ? { ...svg, lightBackplate: false, adaptive: true } : null
      }
      // Both Search and Renderer officially support header authentication; never URL tokens.
      const key = dependencies.apiKey === undefined ? readIcons8Key() : dependencies.apiKey
      if (!key || typeof UIImage === "undefined") return null
      options.headers = { "Api-Key": key, "Cache-Control": "no-store" }
      const response = await runFetch(`https://api-img.icons8.com/?id=${icon.name}&size=96&format=png`, options)
      if (!response.ok || (response.expectedContentLength ?? 0) > 350_000) return null
      const image = UIImage.fromData(await response.data())
      if (!image || image.width > 1024 || image.height > 1024) return null
      return { image, lightBackplate: false, adaptive: true }
    }, timeoutMS)
  } catch { return null }
}
