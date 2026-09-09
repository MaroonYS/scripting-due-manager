// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. Free MCP PNG artwork requires Icons8 attribution.

import { withReadDeadline } from "./async_deadline"
import { safeGithubPNGData } from "./github_artwork"
import { icons8MCPPNGURL } from "./icons8_mcp_ids"
import type { LoadedArtwork } from "./artwork_assets"
import type { OnlineFetch } from "./online_artwork"

/** Rendering an already selected public PNG never logs in, reads credentials or calls MCP. */
export async function loadIcons8MCPArtwork(id: string, options: { fetch?: OnlineFetch; timeoutMS?: number } = {}): Promise<LoadedArtwork | null> {
  const url = icons8MCPPNGURL(id)
  if (!url || typeof UIImage === "undefined") return null
  const timeoutMS = options.timeoutMS ?? 4000
  try {
    return await withReadDeadline(async () => {
      const response = await (options.fetch ?? fetch)(url, { timeout: timeoutMS / 1000, handleRedirect: async () => null })
      if (!response.ok || (response.expectedContentLength ?? 0) > 350000) return null
      const data = await response.data()
      if (!data || typeof data !== "object" || !("size" in data) || typeof data.size !== "number" || data.size > 350000 || !safeGithubPNGData(data, 192)) return null
      const image = UIImage.fromData(data)
      if (!image || !Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width <= 0 || image.height <= 0 || image.width > 192 || image.height > 192) return null
      return { image, lightBackplate: false, adaptive: true }
    }, timeoutMS)
  } catch { return null }
}
