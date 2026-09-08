// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

/**
 * Research-only Apple chart snapshot. Not imported by the installed script.
 * Saves factual identifiers and chart positions, not descriptions or artwork.
 * Chart inclusion is neither a download count nor permission to reuse a logo.
 * Usage: bun tools/collect_app_store_charts.ts <output.json>
 */
import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"

const output = process.argv[2]
if (!output || !output.endsWith(".json")) throw new Error("Provide an explicit output.json path")
if (await Bun.file(output).exists()) throw new Error("Output already exists; use a new snapshot path to preserve earlier evidence")
const GENRES_URL = "https://itunes.apple.com/WebObjects/MZStoreServices.woa/ws/genres?id=36"
const REGIONS = ["us", "cn", "hk", "gb"] as const
const CHARTS = ["topfreeapplications", "toppaidapplications"] as const
const startedAt = new Date().toISOString()

async function json(url: string): Promise<any> {
  let last: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) { last = error }
  }
  throw last
}

const genres = (await json(GENRES_URL))["36"]?.subgenres
if (!genres || typeof genres !== "object") throw new Error("Apple genre response is not recognized")
const categories = Object.entries(genres).map(([id, value]: [string, any]) => ({ id, name: String(value.name) }))
const jobs = REGIONS.flatMap(region => categories.flatMap(category => CHARTS.map(chart => ({ region, category, chart }))))
const results: any[] = []
let cursor = 0
let completed = 0

async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++]
    const source = `https://itunes.apple.com/${job.region}/rss/${job.chart}/limit=50/genre=${job.category.id}/json`
    const capturedAt = new Date().toISOString()
    try {
      const data = await json(source)
      const feed = data?.feed
      if (!feed || !Array.isArray(feed.entry)) throw new Error("No ranked entry array in response")
      const entries = feed.entry.slice(0, 50).map((entry: any, index: number) => {
        const appID = String(entry.id?.attributes?.["im:id"] ?? "")
        const name = entry["im:name"]?.label
        if (!/^\d+$/.test(appID) || typeof name !== "string") throw new Error("Invalid ranked app identifier or name")
        return {
          rank: index + 1,
          appID,
          bundleID: entry.id?.attributes?.["im:bundleId"] ?? null,
          name,
          developer: entry["im:artist"]?.label ?? null,
          primaryCategoryID: entry.category?.attributes?.["im:id"] ?? null,
          appStoreURL: `https://apps.apple.com/${job.region}/app/id${appID}`,
          // No artwork is fetched, embedded or licensed by this record.
          artworkPermission: "not-assessed",
        }
      })
      results.push({ ...job, source, capturedAt, feedUpdatedAt: feed.updated?.label ?? null, status: "ok", entries })
    } catch (error) {
      results.push({ ...job, source, capturedAt, status: "unavailable", error: String(error), entries: [] })
    }
    completed++
    if (completed % 12 === 0 || completed === jobs.length) console.log(`Collected ${completed}/${jobs.length} charts`)
  }
}

await Promise.all(Array.from({ length: 4 }, worker))
results.sort((a, b) => REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region)
  || Number(a.category.id) - Number(b.category.id) || a.chart.localeCompare(b.chart))
const successful = results.filter(result => result.status === "ok")
const uniqueAppIDs = new Set(successful.flatMap(result => result.entries.map((entry: any) => entry.appID)))
const snapshot = {
  schemaVersion: 1,
  purpose: "Candidate discovery for optional personal widget brand identification; not an endorsement or artwork license",
  startedAt,
  completedAt: new Date().toISOString(),
  platform: "iPhone applications (Apple topfreeapplications/toppaidapplications feeds)",
  genreSource: GENRES_URL,
  requestedLimit: 50,
  regions: REGIONS,
  chartTypes: CHARTS,
  categories,
  summary: {
    requestedCharts: jobs.length,
    successfulCharts: successful.length,
    unavailableCharts: results.length - successful.length,
    shortCharts: successful.filter(result => result.entries.length < 50).length,
    rankedEntries: successful.reduce((sum, result) => sum + result.entries.length, 0),
    uniqueAppIDs: uniqueAppIDs.size,
  },
  charts: results,
}
await mkdir(dirname(output), { recursive: true })
await Bun.write(output, JSON.stringify(snapshot, null, 2) + "\n")
console.log(JSON.stringify(snapshot.summary))
console.log(`Saved ${output}`)
