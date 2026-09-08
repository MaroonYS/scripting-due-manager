// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.
import { createHash } from "node:crypto"
import { BRAND_CATALOG } from "../到期管家/src/brand_catalog"
import { APPSTORE_SOURCES } from "./brand_appstore_sources"
const output = process.argv[2]
if(!output?.startsWith("/tmp/due-manager-complete-brands.")) throw Error("Task temp directory required")
async function get(url: string): Promise<Uint8Array> {
  const proc = Bun.spawn(["curl", "-fLsS", "--max-time", "20", "--proto", "=https", "--proto-redir", "=https", url], {stdout:"pipe",stderr:"pipe"})
  const [status, bytes] = await Promise.all([proc.exited, new Response(proc.stdout).bytes()])
  if(status) throw Error("public asset fetch unavailable")
  return bytes
}
const entries = Object.entries(APPSTORE_SOURCES)
let cursor = 0
await Promise.all(Array.from({length:4}, async () => {
  while(cursor < entries.length) {
    const [name, source] = entries[cursor++]
    try {
      const brand = BRAND_CATALOG.find(brand => brand.name === name)
      if(!brand) throw Error("unknown brand")
      const recordPath = `${output}/raw/${brand.id}.json`
      const record = await Bun.file(recordPath).json()
      if(record.findings.some((r:any)=>r.sourceType === "app-store" && r.appID === source.id)) continue
      const lookup = `https://itunes.apple.com/lookup?id=${source.id}&country=${source.country}`
      const info = JSON.parse(new TextDecoder().decode(await get(lookup))).results.find((r:any)=>r.trackId === source.id)
      if(!info || info.sellerName !== source.seller) throw Error("seller identity changed; manual review required")
      const url = info.artworkUrl512
      if(!/^https:\/\/is\d+-ssl\.mzstatic\.com\//.test(url)) throw Error("unexpected Apple artwork host")
      const bytes = await get(url)
      const type = bytes[0]===255 && bytes[1]===216 ? "jpg" : bytes[0]===137 && bytes[1]===80 ? "png" : null
      if(!type) throw Error("unsupported image format")
      const filename = `${brand.id}-appstore.${type}`
      await Bun.write(`${output}/raw/${filename}`, bytes)
      record.findings.push({filename,type,url,basis:info.trackViewUrl,lookup,appID:source.id,appName:info.trackName,seller:info.sellerName,sellerURL:info.sellerUrl,sourceType:"app-store",sha256:createHash("sha256").update(bytes).digest("hex")})
      await Bun.write(recordPath, JSON.stringify(record,null,2))
      console.log(`FOUND ${name}: ${info.trackName} / ${info.sellerName}`)
    } catch(error) { console.log(`FAILED ${name}: ${String(error)}`); process.exitCode = 1 }
  }
}))
