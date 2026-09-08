// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.
import { join } from "node:path"
import { BRAND_CATALOG } from "../到期管家/src/brand_catalog"
const output = process.argv[2]
const rows = []
for (const [index, brand] of BRAND_CATALOG.entries()) {
  const record = await Bun.file(join(output, "raw", `${brand.id}.json`)).json()
  const candidates = []
  for (const finding of record.findings) {
    const file = join(output, "rendered", finding.filename.replace(/\.[^.]+$/, ".png"))
    if (!await Bun.file(file + ".json").exists()) continue
    const info = await Bun.file(file + ".json").json()
    candidates.push({ ...finding, ...info, file })
  }
  const score = (a: any) => (a.sourceType === "app-store" ? 3000 : a.reviewedProduct ? 2000 : a.sourceType === "brand-site" && Math.min(a.width, a.height) >= 64 ? 1000 : 0) + Math.min(a.width,a.height,288)
  candidates.sort((a, b) => score(b) - score(a))
  rows.push({ index: index + 1, ...brand, candidates, selected: candidates[0] ?? null })
}
await Bun.write(join(output, "preview.json"), JSON.stringify(rows, null, 2))
console.log(`${rows.filter(row => row.selected).length}/${rows.length} selected for review`)
