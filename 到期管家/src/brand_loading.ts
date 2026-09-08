// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.
import { useEffect, useState } from "scripting"
import { inspectBrandLogo, type BrandAsset, type BrandLogoInspection } from "./brand_assets"

const pending = new Map<string, Promise<BrandLogoInspection>>()
function readVisibleLogo(asset: BrandAsset, directory: string) {
  const key = JSON.stringify([directory, asset.brandID])
  let read = pending.get(key)
  if (!read) {
    read = inspectBrandLogo(asset, directory)
    pending.set(key, read)
    void read.finally(() => { if (pending.get(key) === read) pending.delete(key) })
  }
  return read
}

/** First render is synchronous SF-only. Native visibility starts optional I/O. */
export function useBrandLogo(asset: BrandAsset | null, directory: string) {
  const key = asset ? JSON.stringify([directory, asset.brandID]) : ""
  const initial: BrandLogoInspection = { status: asset ? "loading" : "not-bundled", logo: null }
  const [result, setResult] = useState<{ key: string; inspection: BrandLogoInspection } | null>(null)
  const [gate] = useState(() => ({ visible: false, generation: 0, key: "" }))
  const start = () => {
    if (!gate.visible || !asset || gate.key === key) return
    gate.key = key
    const generation = ++gate.generation
    void readVisibleLogo(asset, directory).then(inspection => {
      if (gate.visible && gate.generation === generation && gate.key === key) setResult({ key, inspection })
    })
  }
  useEffect(() => {
    start()
    return () => { gate.generation++; gate.key = "" }
  }, [key])
  return {
    inspection: result?.key === key ? result.inspection : initial,
    onAppear: () => { gate.visible = true; start() },
    onDisappear: () => { gate.visible = false; gate.generation++; gate.key = "" },
  }
}
