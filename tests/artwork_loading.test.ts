// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import test from "node:test"
import { ARTWORK_CATALOG, artworkByID } from "../到期管家/src/artwork_catalog.ts"
import { ARTWORK_CACHE_LIMIT, loadArtwork, loadArtworkPage, peekArtwork } from "../到期管家/src/artwork_assets.ts"

let run = 0
const chat = "icons8-ka3InxFU3QZa"
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
function setup(options: { data?: (path: string) => Promise<any>; text?: (path: string) => Promise<string>; decode?: (data: any) => any } = {}) {
  const previous = { UIImage: (globalThis as any).UIImage, FileManager: (globalThis as any).FileManager }
  const reads: string[] = [], decodes: any[] = []
  ;(globalThis as any).UIImage = {
    fromData: (data: any) => { decodes.push(data); return options.decode ? options.decode(data) : { native: data } },
    fromBase64String: (base64: string) => ({ native: base64 }),
  }
  ;(globalThis as any).FileManager = {
    readAsData: async (path: string) => { reads.push(path); return options.data ? options.data(path) : path },
    readAsString: async (path: string) => {
      reads.push(path)
      return options.text ? options.text(path) : JSON.stringify({ source: artworkByID(chat)!.path, encoding: "base64", png: "cG5n" })
    },
  }
  return { reads, decodes, dir: `/bundle-loading-${++run}`, cleanup: () => Object.assign(globalThis, previous) }
}

test("artwork loads one local PNG, shares in-flight work and caches successful native decodes", async () => {
  let finish!: (value: any) => void
  const env = setup({ data: () => new Promise(resolve => { finish = resolve }) })
  try {
    const a = loadArtwork(chat, env.dir), b = loadArtwork(chat, env.dir)
    assert.equal(a, b)
    await tick(); assert.equal(env.reads.length, 1)
    finish("native-data")
    const image = await a
    assert.equal(image, await b)
    assert.deepEqual(image, { image: { native: "native-data" }, lightBackplate: false })
    assert.equal(await loadArtwork(chat, env.dir), image)
    assert.equal(peekArtwork(chat, env.dir), image)
    assert.equal(env.reads.length, 1); assert.equal(env.decodes.length, 1)
    assert.equal(peekArtwork(chat, env.dir + "-other"), null)
  } finally { env.cleanup() }
})

test("invalid or unknown icon IDs never read files or URLs", async () => {
  const env = setup()
  try {
    for (const id of [null, undefined, "../../private", "https://example.com/icon.png", "icons8-FutureABC", "sf:car.fill", "__proto__"]) {
      assert.equal(await loadArtwork(id, env.dir), null)
      assert.equal(peekArtwork(id, env.dir), null)
    }
    assert.deepEqual(env.reads, [])
  } finally { env.cleanup() }
})

test("an unavailable PNG decoder falls back to only the selected image's independent JSON", async () => {
  const env = setup({ decode: () => null })
  try {
    const result = await loadArtwork(chat, env.dir)
    assert.deepEqual(result?.image, { native: "cG5n" })
    assert.deepEqual(env.reads, [`${env.dir}/${artworkByID(chat)!.path}`, `${env.dir}/assets/icons8/fallbacks/ka3InxFU3QZa.json`])
  } finally { env.cleanup() }
})

test("bad fallback data fails closed and failed loads remain retryable", async () => {
  for (const text of ["broken", "[]", JSON.stringify({ source: "elsewhere.png", encoding: "base64", png: "cG5n" }), "x".repeat(350001)]) {
    const env = setup({ data: async () => { throw Error("read failed") }, text: async () => text })
    try {
      assert.equal(await loadArtwork(chat, env.dir), null)
      assert.equal(await loadArtwork(chat, env.dir), null)
      assert.equal(env.reads.length, 4)
    } finally { env.cleanup() }
  }
})

test("a stalled native read reaches the independent fallback without blocking on the PNG", async () => {
  const env = setup({ data: () => new Promise(() => {}) })
  try {
    const result = await loadArtwork(chat, env.dir)
    assert.deepEqual(result?.image, { native: "cG5n" })
    assert.equal(env.reads.length, 2)
  } finally { env.cleanup() }
})

test("a stalled optional fallback terminates and a late result cannot poison the ready cache", async () => {
  let finish!: (value: string) => void
  const env = setup({ data: async () => { throw Error("missing") }, text: () => new Promise(resolve => { finish = resolve }) })
  try {
    assert.equal(await loadArtwork(chat, env.dir), null)
    finish(JSON.stringify({ source: artworkByID(chat)!.path, encoding: "base64", png: "cG5n" }))
    await tick()
    assert.equal(peekArtwork(chat, env.dir), null)
  } finally { env.cleanup() }
})

test("page loading deduplicates, limits to 24 and uses at most four concurrent reads", async () => {
  let active = 0, peak = 0
  const env = setup({ data: async path => { peak = Math.max(peak, ++active); await tick(); active--; return path } })
  try {
    const ids = ARTWORK_CATALOG.slice(0, 35).map(icon => icon.id)
    const result = await loadArtworkPage([ids[0], ids[0], null, "bad", ...ids], env.dir)
    assert.equal(Object.keys(result).length, 24)
    assert.equal(env.reads.length, 24)
    assert.equal(peak, 4)
  } finally { env.cleanup() }
})

test("ready images obey the 64-entry LRU bound and preserve backplate metadata", async () => {
  const env = setup()
  try {
    const ids = ARTWORK_CATALOG.slice(0, ARTWORK_CACHE_LIMIT + 1).map(icon => icon.id)
    for (const id of ids) await loadArtwork(id, env.dir)
    assert.equal(peekArtwork(ids[0], env.dir), null)
    assert.ok(peekArtwork(ids[1], env.dir))
    assert.ok(peekArtwork(ids.at(-1)!, env.dir))
    const dark = await loadArtwork("icons8-8QGE7uQedCwQ", env.dir)
    assert.equal(dark?.lightBackplate, true)
  } finally { env.cleanup() }
})

test("rapid batches cannot exceed the global 64 in-flight limit", async () => {
  const finishes: ((value: any) => void)[] = []
  const env = setup({ data: () => new Promise(resolve => finishes.push(resolve)) })
  try {
    const promises = ARTWORK_CATALOG.slice(0, 70).map(icon => loadArtwork(icon.id, env.dir))
    await tick()
    assert.equal(env.reads.length, 64)
    for (const finish of finishes) finish("png")
    const results = await Promise.all(promises)
    assert.equal(results.filter(Boolean).length, 64)
  } finally { env.cleanup() }
})
