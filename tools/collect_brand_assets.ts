// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { createHash } from "node:crypto"
import { BRAND_CATALOG } from "../到期管家/src/brand_catalog"
import { BRAND_SITES, SIMPLE_ICON_TITLES } from "./brand_asset_sources"
import { ADDITIONAL_BRAND_SITES, EXTRA_BRAND_IMAGES } from "./brand_asset_overrides"

const output = process.argv[2]
if (!output || !output.startsWith("/tmp/due-manager-complete-brands.")) throw new Error("Pass a task-specific temporary output directory")
const only = new Set(process.argv.slice(3))
const SIMPLE_COMMIT = "777807a262bb7384ff406fd4b35fdcd02e9514c3"
const simple = await Bun.file(join(output, "simple-icons.json")).json() as any[]
await mkdir(join(output, "raw"), { recursive: true })
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const errors: string[] = []
async function get(url: string): Promise<{ bytes: Uint8Array; type: string; url: string } | null> {
  if (!url.startsWith("https://")) return null
  // curl has a hard wall-clock deadline even for DNS/TLS failures; no TLS bypass.
  const path = join(output, "raw", `fetch-${sha(new TextEncoder().encode(url))}`)
  const proc = Bun.spawn(["curl", "-fLsS", "--max-time", "12", "--connect-timeout", "5", "--max-filesize", "4000000", "--proto", "=https", "--proto-redir", "=https", "-A", "Mozilla/5.0", "-o", path, "-w", "%{content_type}\n%{url_effective}", url], { stdout: "pipe", stderr: "pipe" })
  const [status, headers] = await Promise.all([proc.exited, new Response(proc.stdout).text()])
  if (status !== 0) return null
  const [type, finalURL] = headers.split("\n")
  return { bytes: new Uint8Array(await Bun.file(path).arrayBuffer()), type: type ?? "", url: finalURL ?? url }
}
function imageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78) return "png"
  if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return "ico"
  if (bytes[0] === 255 && bytes[1] === 216) return "jpg"
  if (new TextDecoder().decode(bytes.slice(0, 1000)).includes("<svg")) return "svg"
  if (new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF") return "webp"
  return null
}
const decode = (value: string) => value.replace(/&amp;/g, "&").replace(/&#x26;/g, "&")
function attrs(tag: string) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(match => [match[1].toLowerCase(), decode(match[2] ?? match[3] ?? match[4])]))
}
const normalizeTitle = (title: string) => title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "")
const slug = (title: string) => title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\+/g, "plus").replace(/\./g, "dot").replace(/&/g, "and").replace(/[^a-z0-9]/g, "")

async function collect(brand: typeof BRAND_CATALOG[number]) {
  const recordPath = join(output, "raw", `${brand.id}.json`)
  if (await Bun.file(recordPath).exists() && !only.size) return
  const site = BRAND_SITES[brand.name]
  if (!site) throw new Error(`Missing site: ${brand.name}`)
  const candidates: { url: string; basis: string; score: number }[] = []
  for (const pageURL of [site, ...(ADDITIONAL_BRAND_SITES[brand.name] ?? [])]) {
    const page = await get(pageURL)
    if (!page) continue
    const html = new TextDecoder().decode(page.bytes)
    for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
      const a = attrs(tag)
      if (!/(^|\s)(icon|apple-touch-icon|mask-icon)(\s|$)/.test(a.rel ?? "") || !a.href) continue
      try {
        const url = new URL(a.href, page.url).href
        const size = Math.max(0, ...[...(a.sizes ?? "").matchAll(/(\d+)x/g)].map(match => Number(match[1])))
        candidates.push({ url, basis: `official page link: ${page.url}`, score: a.rel.includes("apple-touch") ? 300 + size : size || (url.endsWith(".svg") ? 200 : 32) })
      } catch {}
    }
    // Retain icon paths actually embedded in site manifests as secondary evidence.
    for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
      const a = attrs(tag)
      if (a.rel !== "manifest" || !a.href) continue
      try {
        const manifest = await get(new URL(a.href, page.url).href)
        if (manifest) for (const icon of JSON.parse(new TextDecoder().decode(manifest.bytes)).icons ?? []) {
          if (typeof icon.src === "string") candidates.push({ url: new URL(icon.src, manifest.url).href, basis: `official manifest: ${manifest.url}`, score: 250 })
        }
      } catch {}
    }
  }
  candidates.push({ url: new URL("/favicon.ico", site).href, basis: `conventional icon on official domain: ${site}`, score: 0 })
  const findings: any[] = []
  for (const candidate of candidates.sort((a, b) => b.score - a.score).filter((entry, index, all) => all.findIndex(other => entry.url === other.url) === index).slice(0, 5)) {
    const response = await get(candidate.url)
    const type = response && imageType(response.bytes)
    if (!response || !type) continue
    const filename = `${brand.id}-${findings.length}.${type}`
    await Bun.write(join(output, "raw", filename), response.bytes)
    findings.push({ filename, type, url: response.url, basis: candidate.basis, sha256: sha(response.bytes), sourceType: "brand-site" })
    if (findings.length >= 2) break
  }
  const simpleTitle = SIMPLE_ICON_TITLES[brand.name]
  const icon = simple.find(icon => simpleTitle ? icon.title === simpleTitle : brand.name.split(/[／（]/).some(name => normalizeTitle(name) === normalizeTitle(icon.title)))
  if (icon) {
    const name = icon.slug ?? slug(icon.title)
    const url = `https://raw.githubusercontent.com/simple-icons/simple-icons/${SIMPLE_COMMIT}/icons/${name}.svg`
    const response = await get(url)
    if (response && imageType(response.bytes) === "svg") {
      const filename = `${brand.id}-simple.svg`
      await Bun.write(join(output, "raw", filename), response.bytes)
      findings.push({ filename, type: "svg", url, basis: icon.source, guidelines: icon.guidelines, license: icon.license, color: icon.hex,
        sha256: sha(response.bytes), sourceType: "simple-icons", upstreamTitle: icon.title })
    }
  }
  for (const extra of EXTRA_BRAND_IMAGES[brand.name] ?? []) {
    const response = await get(extra.url)
    const type = response && imageType(response.bytes)
    if (!response || !type) continue
    const filename = `${brand.id}-extra${findings.length}.${type}`
    await Bun.write(join(output, "raw", filename), response.bytes)
    findings.push({ filename, type, url: response.url, basis: extra.source, sha256: sha(response.bytes), sourceType: extra.sourceType })
  }
  const record = { id: brand.id, name: brand.name, site, retrievedAt: new Date().toISOString(), findings }
  await Bun.write(recordPath, JSON.stringify(record, null, 2))
  console.log(`${findings.length ? "FOUND" : "MISSING"} ${brand.name}: ${findings.map(x => x.sourceType + "/" + x.type).join(", ")}`)
}
const queue = BRAND_CATALOG.filter(brand => !only.size || only.has(brand.id) || only.has(brand.name))
let cursor = 0
await Promise.all(Array.from({ length: 8 }, async () => {
  while (cursor < queue.length) {
    const brand = queue[cursor++]
    try { await collect(brand) } catch (error) { errors.push(`${brand.name}: ${String(error)}`) }
  }
}))
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1 }
