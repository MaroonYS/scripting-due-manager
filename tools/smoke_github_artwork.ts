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

const run = promisify(execFile)
async function read(url: string): Promise<Buffer> {
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
for (const query of ["ChatGPT Plus", "微信", "Netflix", "Spotify", "Apple Music", "iCloud", "Emby"]) {
  const page = await searchGithubArtwork(query, 0, DEFAULT_ICON_SUBSCRIPTIONS, { fetch: transport })
  assert.ok(page.icons.length, query)
  console.log(JSON.stringify({ query, count: page.icons.length, first: page.icons[0].label, source: page.icons[0].detail }))
  samples.add(page.icons[0].id)
}
for (const id of samples) {
  const url = parseGithubArtworkID(id)!
  const bytes = await read(url)
  const data = { size: bytes.length, slice: (start: number, end: number) => ({ toUint8Array: () => new Uint8Array(bytes.subarray(start, end)) }) }
  assert.equal(safeGithubPNGData(data), true, url)
  console.log(JSON.stringify({ png: url.split("/").pop(), bytes: bytes.length, validHeader: true }))
}
console.log(JSON.stringify({ result: "passed", checkedImages: samples.size, nativeIOSVerified: false }))
