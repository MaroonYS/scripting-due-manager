// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.
import { join } from "node:path"
import { createHash } from "node:crypto"

export async function generateBrandFallbacks(root: string) {
  const manifest = await Bun.file(join(root, "assets/brands/manifest.json")).json()
  const paths = new Map<string, string>()
  for (const asset of manifest.assets) for (const output of asset.outputs) {
    if (!/^assets\/brands\/[a-z0-9-]+\.png$/.test(output.path)) throw Error("Unexpected asset path")
    paths.set(output.path, output.sha256)
  }
  for (const [path, expected] of paths) {
    const bytes = await Bun.file(join(root, path)).bytes()
    if (createHash("sha256").update(bytes).digest("hex") !== expected) throw Error(`Changed PNG: ${path}`)
    await Bun.write(join(root, path.replace("assets/brands/", "assets/brands/fallbacks/").replace(/\.png$/, ".json")),
      JSON.stringify({ source: path, encoding: "base64", png: Buffer.from(bytes).toString("base64"),
        notice: "Third-party artwork retains its own rights. See assets/brands/SOURCES.md and manifest.json." }) + "\n")
  }
  console.log(`Generated ${paths.size} individually readable offline fallbacks; PNG bytes unchanged`)
}
if (import.meta.main) await generateBrandFallbacks(join(import.meta.dir, "../到期管家"))
