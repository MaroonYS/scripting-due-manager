// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

// Read-only network smoke: curl uses the host trust store; TLS verification stays enabled.
// This exercises real manifests, search and PNG headers, not iOS UIImage or WidgetKit.
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import assert from "node:assert/strict"
import { DEFAULT_ICON_SUBSCRIPTIONS } from "../到期管家/src/icon_subscriptions.ts"
import { fetchGithubManifest, safeGithubPNGData, searchGithubArtwork } from "../到期管家/src/github_artwork.ts"
import { parseGithubArtworkID } from "../到期管家/src/github_artwork_ids.ts"
import type { OnlineFetch } from "../到期管家/src/online_artwork.ts"
import { safeFluentSVG } from "../到期管家/src/online_artwork.ts"
import { readFileSync } from "node:fs"

const run = promisify(execFile)
async function read(url: string): Promise<Buffer> {
  if (process.argv.includes("--local-bank") && url === DEFAULT_ICON_SUBSCRIPTIONS[3].url) return readFileSync(new URL("../catalogs/bank-logos.json", import.meta.url))
  const { stdout } = await run("curl", ["-fsS", "--proto", "=https", "--max-time", "12", url], { encoding: "buffer", maxBuffer: 3_000_000 })
  return stdout
}
const transport: OnlineFetch = async url => {
  const bytes = await read(url)
  return { ok: true, status: 200, expectedContentLength: bytes.length, text: async () => bytes.toString("utf8"), data: async () => bytes }
}
const samples = new Set<string>()
for (const source of DEFAULT_ICON_SUBSCRIPTIONS) {
  const manifest = await fetchGithubManifest(source, { fetch: transport, refresh: true })
  assert.ok(manifest.icons.length)
  console.log(JSON.stringify({ source: source.name, count: manifest.icons.length, warnings: manifest.warnings }))
  samples.add(manifest.icons[0].id)
}
for (const query of ["ChatGPT Plus", "微信", "Netflix", "Spotify", "Apple Music", "iCloud", "Emby", "HSBC", "渣打", "招商银行", "恒生", "Monzo", "Revolut", "Chase", "Bybit", "英国", "美国", "香港"]) {
  const page = await searchGithubArtwork(query, 0, DEFAULT_ICON_SUBSCRIPTIONS, { fetch: transport })
  assert.ok(page.icons.length, query)
  console.log(JSON.stringify({ query, count: page.icons.length, first: page.icons[0].label, source: page.icons[0].detail }))
  samples.add(page.icons[0].id)
}
for (const id of samples) {
  const url = parseGithubArtworkID(id)!
  const bytes = await read(url)
  const data = { size: bytes.length, slice: (start: number, end: number) => ({ toUint8Array: () => new Uint8Array(bytes.subarray(start, end)) }) }
  assert.equal(url.endsWith(".svg") ? Boolean(safeFluentSVG(bytes.toString("utf8"))) : safeGithubPNGData(data), true, url)
  console.log(JSON.stringify({ image: url.split("/").pop(), bytes: bytes.length, valid: true }))
}
for (const query of ["RedotPay", "Bybit", "Wirex", "Nexo", "Crypto.com", "ZA Bank", "Mox", "livi", "U卡"]) {
  const page = await searchGithubArtwork(query, 0, DEFAULT_ICON_SUBSCRIPTIONS, { fetch: transport })
  console.log(JSON.stringify({ coverageQuery: query, count: page.icons.length, labels: page.icons.map(icon => icon.label) }))
}
if (process.argv.includes("--all-bank-images")) {
  const manifest = await fetchGithubManifest(DEFAULT_ICON_SUBSCRIPTIONS[3], { fetch: transport })
  let cursor = 0, checked = 0; const failures: string[] = []
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (;;) {
      const row = manifest.icons[cursor++]; if (!row) return
      try { assert.ok(safeFluentSVG((await read(parseGithubArtworkID(row.id)!)).toString("utf8"))); checked++ }
      catch { failures.push(row.label) }
    }
  }))
  console.log(JSON.stringify({ bankImages: manifest.icons.length, checked, failures }))
  assert.deepEqual(failures, [])
}
console.log(JSON.stringify({ result: "passed", checkedImages: samples.size, nativeIOSVerified: false }))
