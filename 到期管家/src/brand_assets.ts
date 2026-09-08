// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

export interface BrandAsset {
  brandID: string
  light: string
  dark: string
  /** Visible mark size inside the existing 40 pt completion target. */
  size: number
}

/** Only reviewed, bundled official artwork. The 332-name catalog is separate. */
export const BRAND_ASSETS: BrandAsset[] = [
  { brandID: "brand-04127553b4fb06d0", light: "assets/brands/safepal-dark.png", dark: "assets/brands/safepal-light.png", size: 20 },
  { brandID: "brand-acdd1e734125f341", light: "assets/brands/telegram.png", dark: "assets/brands/telegram.png", size: 24 },
]

export function brandAsset(brandID: string): BrandAsset | null {
  return BRAND_ASSETS.find(asset => asset.brandID === brandID) ?? null
}

export type LoadedBrandLogo = { image: { light: UIImage; dark: UIImage }; size: number }

/** Decode both variants before hiding the SF Symbol. No widget network I/O. */
export function loadBrandLogo(asset: BrandAsset | null, directory: string): LoadedBrandLogo | null {
  if (!asset) return null
  try {
    const light = UIImage.fromFile(`${directory}/${asset.light}`)
    const dark = asset.light === asset.dark ? light : UIImage.fromFile(`${directory}/${asset.dark}`)
    return light && dark ? { image: { light, dark }, size: asset.size } : null
  } catch { return null }
}
