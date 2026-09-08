// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { BRAND_ASSETS } from "./brand_asset_manifest"
import { ReadDeadlineError, withReadDeadline } from "./async_deadline"
export { BRAND_ASSETS } from "./brand_asset_manifest"

export interface BrandAsset {
  brandID: string
  light: string
  dark: string
  size: number
}
export function brandAsset(brandID: string): BrandAsset | null {
  return BRAND_ASSETS.find(asset => asset.brandID === brandID) ?? null
}
export type LoadedBrandLogo = { image: { light: UIImage; dark: UIImage }; size: number; contentScale?: number }
export type BrandLogoStatus = "ready" | "loading" | "not-bundled" | "decoder-unavailable" | "decode-failed" | "timed-out"
export type BrandLogoInspection = { status: BrandLogoStatus; logo: LoadedBrandLogo | null }
export const BRAND_READ_TIMEOUT_MS = 1500

export function brandFallbackPath(path: string): string | null {
  if (!/^assets\/brands\/[a-z0-9-]+\.png$/.test(path)) return null
  return path.replace("assets/brands/", "assets/brands/fallbacks/").replace(/\.png$/, ".json")
}

/** File I/O is asynchronous. Never import a whole-library image-code module. */
async function decodeImage(path: string, directory: string): Promise<UIImage | null> {
  if (typeof UIImage.fromData === "function" && typeof FileManager.readAsData === "function") {
    try {
      const bytes = await FileManager.readAsData(`${directory}/${path}`)
      const image = bytes ? UIImage.fromData(bytes) : null
      if (image) return image
    } catch { /* Try only this PNG's independent offline fallback. */ }
  }
  const fallback = brandFallbackPath(path)
  if (fallback && typeof UIImage.fromBase64String === "function" && typeof FileManager.readAsString === "function") {
    try {
      const text = await FileManager.readAsString(`${directory}/${fallback}`)
      if (typeof text !== "string" || text.length > 1024 * 1024) return null
      const value: unknown = JSON.parse(text)
      if (!value || typeof value !== "object" || Array.isArray(value)) return null
      const record = value as Record<string, unknown>
      if (record.source !== path || record.encoding !== "base64" || typeof record.png !== "string") return null
      return UIImage.fromBase64String(record.png)
    } catch { /* A missing or corrupt picture must leave the system icon usable. */ }
  }
  return null
}

export async function inspectBrandLogo(asset: BrandAsset | null, directory: string, timeoutMs = BRAND_READ_TIMEOUT_MS): Promise<BrandLogoInspection> {
  if (!asset) return { status: "not-bundled", logo: null }
  if (typeof UIImage === "undefined" || typeof FileManager === "undefined"
    || (typeof UIImage.fromData !== "function" && typeof UIImage.fromBase64String !== "function")) {
    return { status: "decoder-unavailable", logo: null }
  }
  if (!brandFallbackPath(asset.light) || !brandFallbackPath(asset.dark)) return { status: "decode-failed", logo: null }
  try {
    return await withReadDeadline(async () => {
      const light = await decodeImage(asset.light, directory)
      const dark = asset.light === asset.dark ? light : await decodeImage(asset.dark, directory)
      return light && dark ? { status: "ready" as const, logo: {
        image: { light, dark }, size: asset.size,
        contentScale: /^assets\/brands\/brand-[a-f0-9]{16}\.png$/.test(asset.light) ? 144 / 120 : 1,
      } } : { status: "decode-failed" as const, logo: null }
    }, timeoutMs)
  } catch (error) {
    return { status: error instanceof ReadDeadlineError ? "timed-out" : "decode-failed", logo: null }
  }
}
export function brandLogoStatusText(status: BrandLogoStatus): string {
  switch (status) {
    case "ready": return "已内置 Logo · 可离线显示"
    case "loading": return "正在读取图标 · 暂用系统图标"
    case "not-bundled": return "此品牌未收录图片 · 系统图标回退"
    case "decoder-unavailable": return "当前宿主不支持异步图片读取 · 暂用系统图标"
    case "decode-failed": return "图片加载失败 · 已回退系统图标"
    case "timed-out": return "图片读取超时 · 已回退系统图标"
  }
}
export async function loadBrandLogo(asset: BrandAsset | null, directory: string): Promise<LoadedBrandLogo | null> {
  return (await inspectBrandLogo(asset, directory)).logo
}
