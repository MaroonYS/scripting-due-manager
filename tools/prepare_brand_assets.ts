// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { mkdir, readdir } from "node:fs/promises"
import { join } from "node:path"
import { createRequire } from "node:module"
import { createHash } from "node:crypto"
const output = process.argv[2]
if (!output?.startsWith("/tmp/due-manager-complete-brands.")) throw new Error("Task-specific temp directory required")
const { Resvg } = createRequire(join(output, "package.json"))("@resvg/resvg-js")
await mkdir(join(output, "rendered"), { recursive: true })
const records = await Promise.all((await readdir(join(output, "raw"))).filter(name => /^brand-.*\.json$/.test(name)).map(async name => await Bun.file(join(output, "raw", name)).json()))
let count = 0
for (const record of records) {
  for (const finding of record.findings) {
    const target = finding.filename.replace(/\.[^.]+$/, ".png")
    const preparedPath = join(output, "rendered", target)
    const infoPath = preparedPath + ".json"
    if (await Bun.file(infoPath).exists()) continue
    try {
      let input = join(output, "raw", finding.filename)
      if (finding.type === "svg") {
        let svg = await Bun.file(input).text()
        if (/<script|<foreignObject|\bon\w+\s*=|(?:href|xlink:href)\s*=\s*["'](?:https?:|file:|\/)/i.test(svg)) throw Error("unsafe external SVG resource")
        if (finding.sourceType === "simple-icons") svg = svg.replace("<svg ", `<svg fill="#${finding.color}" `)
        const renderer = new Resvg(svg, { fitTo: { mode: "width", value: 288 }, font: { loadSystemFonts: false } })
        if (renderer.width > 2048 || renderer.height > 2048) throw Error("oversized SVG canvas")
        input = join(output, "rendered", finding.filename + ".raster.png")
        await Bun.write(input, renderer.render().asPng())
      }
      const proc = Bun.spawn([join(output, "render-brand-raster"), input, preparedPath], { stdout: "pipe", stderr: "pipe" })
      const [status, stdout] = await Promise.all([proc.exited, new Response(proc.stdout).text()])
      if (status !== 0) throw Error("native raster decode failed")
      const info = JSON.parse(stdout)
      const bytes = await Bun.file(preparedPath).bytes()
      await Bun.write(infoPath, JSON.stringify({ ...info, filename: target, input: finding.filename, sha256: createHash("sha256").update(bytes).digest("hex") }, null, 2))
      count++
    } catch (error) { console.log(`FAILED ${record.name} ${finding.filename}: ${String(error)}`) }
  }
}
console.log(`Prepared ${count} additional candidate PNGs from ${records.length} brands`)
