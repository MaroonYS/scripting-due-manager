// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.
import { createHash } from "node:crypto"
import { BRAND_CATALOG } from "../到期管家/src/brand_catalog"
import { EXTRA_BRAND_IMAGES } from "./brand_asset_overrides"
const output = process.argv[2]
if(!output?.startsWith("/tmp/due-manager-complete-brands.")) throw Error("Task temp directory required")
for (const [name, extras] of Object.entries(EXTRA_BRAND_IMAGES)) {
  const brand = BRAND_CATALOG.find(brand => brand.name === name)!
  const recordPath = `${output}/raw/${brand.id}.json`
  const record = await Bun.file(recordPath).json()
  for(const [index, extra] of extras.entries()) {
    if(record.findings.some((finding:any)=>finding.url === extra.url)) continue
    const proc = Bun.spawn(["curl", "-fLsS", "--max-time", "20", "--proto", "=https", "--proto-redir", "=https", extra.url], {stdout:"pipe",stderr:"pipe"})
    let [status, bytes] = await Promise.all([proc.exited, new Response(proc.stdout).bytes()])
    if(status) {
      // A second normal HTTPS implementation handles hosts incompatible with macOS LibreSSL.
      // Never disable TLS checks or use a proxy/authenticated session.
      try {
        const response = await fetch(extra.url,{signal:AbortSignal.timeout(12000)})
        if(!response.ok || !response.url.startsWith("https://") || Number(response.headers.get("content-length") ?? 0)>4000000) throw Error("unavailable")
        bytes = await response.bytes()
        if(bytes.length>4000000) throw Error("too large")
        status = 0
      } catch {}
    }
    if(status) { console.log(`FAILED ${name}`); continue }
    const upstreamSHA256 = createHash("sha256").update(bytes).digest("hex")
    if(extra.svgSymbol) {
      const svg = new TextDecoder().decode(bytes)
      const symbol = (svg.match(/<symbol\b[\s\S]*?<\/symbol>/g) ?? []).find(symbol => symbol.includes(`id="${extra.svgSymbol}"`))
      if(!symbol) throw Error(`Named SVG symbol unavailable: ${name}`)
      bytes = new TextEncoder().encode(symbol.replace("<symbol ",'<svg xmlns="http://www.w3.org/2000/svg" ').replace("</symbol>","</svg>"))
    }
    const type = bytes[0]===255 && bytes[1]===216 ? "jpg" : bytes[0]===137 && bytes[1]===80 ? "png" : new TextDecoder().decode(bytes.slice(0,1000)).includes("<svg") ? "svg" : null
    if(!type) { console.log(`FAILED format: ${name}`); continue }
    const filename = `${brand.id}-reviewed${index}.${type}`
    await Bun.write(`${output}/raw/${filename}`, bytes)
    record.findings.push({filename,type,url:extra.url,basis:extra.source,sourceType:extra.sourceType,reviewedProduct:true,svgSymbol:extra.svgSymbol,upstreamSHA256,sha256:createHash("sha256").update(bytes).digest("hex")})
    console.log(`FOUND ${name}`)
  }
  await Bun.write(recordPath, JSON.stringify(record,null,2))
}
