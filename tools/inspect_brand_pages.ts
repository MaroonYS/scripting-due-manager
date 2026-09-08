// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.
import { createHash } from "node:crypto"
import { join } from "node:path"
import { BRAND_CATALOG } from "../到期管家/src/brand_catalog"
import { BRAND_SITES } from "./brand_asset_sources"
import { ADDITIONAL_BRAND_SITES } from "./brand_asset_overrides"
const output = process.argv[2]
const names = new Set(process.argv.slice(3))
for (const brand of BRAND_CATALOG) {
  const record = await Bun.file(join(output, "raw", `${brand.id}.json`)).json()
  if (names.size ? !names.has(brand.name) : record.findings.length) continue
  console.log(`\n${brand.name}`)
  for (const url of [BRAND_SITES[brand.name], ...(ADDITIONAL_BRAND_SITES[brand.name] ?? [])]) {
    const file = Bun.file(join(output, "raw", `fetch-${createHash("sha256").update(url).digest("hex")}`))
    if (!await file.exists()) { console.log(url, "unavailable"); continue }
    const html = await file.text()
    console.log(url, html.match(/<title[^>]*>([^<]*)/i)?.[1] ?? "no title")
    const tags = (html.match(/<(?:img|meta|link)\b[^>]*>/gi) ?? []).filter(tag => /logo|icon|msapplication|og:image/i.test(tag))
    console.log(tags.slice(0, 16).map(tag => tag.replace(/data:[^"' ]+/g, "inline-data").slice(0, 650)).join("\n"))
  }
}
