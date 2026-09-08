// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { BRAND_ASSET_DATA } from "./brand_asset_data"
import { BRAND_ASSETS } from "./brand_asset_manifest"
export { BRAND_ASSETS } from "./brand_asset_manifest"

export interface BrandAsset {
  brandID: string
  light: string
  dark: string
  /** Visible mark size inside the existing 40 pt completion target. */
  size: number
}

export function brandAsset(brandID: string): BrandAsset | null {
  return BRAND_ASSETS.find(asset => asset.brandID === brandID) ?? null
}

export type LoadedBrandLogo = { image: { light: UIImage; dark: UIImage }; size: number }
export type BrandLogoStatus = "ready" | "not-bundled" | "decoder-unavailable" | "decode-failed"
export type BrandLogoInspection = { status: BrandLogoStatus; logo: LoadedBrandLogo | null }

/** File-first with an embedded PNG fallback for hosts that relocate imported assets. */
function decodeImage(path: string, directory: string): UIImage | null {
  try {
    const image = UIImage.fromFile(`${directory}/${path}`)
    if (image) return image
  } catch {}
  const encoded = BRAND_ASSET_DATA[path]
  if (encoded) {
    try { return UIImage.fromBase64String(encoded) } catch {}
  }
  return null
}

/** No network, data writes or eager decoding of the full library. */
export function inspectBrandLogo(asset: BrandAsset | null, directory: string): BrandLogoInspection {
  if (!asset) return { status: "not-bundled", logo: null }
  if (typeof UIImage === "undefined") return { status: "decoder-unavailable", logo: null }
  if (typeof UIImage.fromFile !== "function" && typeof UIImage.fromBase64String !== "function") {
    return { status: "decoder-unavailable", logo: null }
  }
  const light = decodeImage(asset.light, directory)
  const dark = asset.light === asset.dark ? light : decodeImage(asset.dark, directory)
  return light && dark
    ? { status: "ready", logo: { image: { light, dark }, size: asset.size } }
    : { status: "decode-failed", logo: null }
}

export function brandLogoStatusText(status: BrandLogoStatus): string {
  switch (status) {
    case "ready": return "已内置 Logo · 可离线显示"
    case "not-bundled": return "此品牌未收录图片 · 系统图标回退"
    case "decoder-unavailable": return "当前宿主不支持图片解码 · 请更新 Scripting"
    case "decode-failed": return "图片加载失败 · 系统图标回退，请重新安装最新版"
  }
}

/** Decode both variants before hiding the SF Symbol. No widget network I/O. */
export function loadBrandLogo(asset: BrandAsset | null, directory: string): LoadedBrandLogo | null {
  return inspectBrandLogo(asset, directory).logo
}
