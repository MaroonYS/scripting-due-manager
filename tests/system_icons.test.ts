// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import test from "node:test"
import { DUE_ICON_OPTIONS, searchSystemIcons, resolveReminderIcon, inferReminderNoteIconCandidate } from "../到期管家/src/icons.ts"
import { normalizeItemIconChoices, withItemIconChoices } from "../到期管家/src/icon_preferences.ts"
import { cleanupRetiredIcons } from "../到期管家/src/icon_cleanup.ts"
import * as storage from "../到期管家/src/storage.ts"
import { createBackupJSON, parseBackupJSON } from "../到期管家/src/recovery.ts"

function environment(failKey = "") {
  const previous = { Storage: (globalThis as any).Storage, Keychain: (globalThis as any).Keychain }
  const state = storage.defaultState(2)
  state.items = [{ id: "manual", title: "Keep", kind: "custom", iconName: "car.fill", dueDate: "2026-09-30", includesTime: false,
    hour: 9, minute: 0, remindBeforeDays: 3, recurrence: null, amount: "25", note: "private note", enabled: true, createdAt: 1, updatedAt: 2 }]
  state.settings.itemIconChoices = [
    { source: "manual", itemID: "manual", iconID: "icons8-Old" },
    { source: "reminder", itemID: "one", iconID: "fluent-emoji-flat:calendar" },
    { source: "reminder", itemID: "two", iconID: "github-artwork:old" },
    { source: "reminder", itemID: "three", iconID: "icons8-mcp:Old" },
    { source: "reminder", itemID: "four", iconID: "icons8-online:Old" },
    { source: "reminder", itemID: "five", iconID: "sf:creditcard.fill" },
  ]
  ;(state.settings as any).iconSubscriptions = [{ url: "retired:must-not-be-fetched" }]
  const values = new Map<string, any>([[storage.STATE_KEY, structuredClone(state)]])
  const keys = new Map<string, string>([["due-manager.icons8.api-key.v1", "SECRET-REST"], ["due-manager.icons8.mcp.session.v1", "SECRET-MCP"], ["unrelated", "KEEP"]])
  const writes: string[] = [], removed: string[] = []
  ;(globalThis as any).Storage = {
    get: (key: string) => structuredClone(values.get(key) ?? null), contains: (key: string) => values.has(key),
    set: (key: string, value: any) => { if (key === failKey) return false; writes.push(key); values.set(key, structuredClone(value)); return true },
    remove: (key: string) => values.delete(key),
  }
  ;(globalThis as any).Keychain = {
    get: (key: string, options: any) => { assert.equal(options.synchronizable, false); return keys.get(key) ?? null },
    remove: (key: string) => { if (failKey === "keychain") return false; removed.push(key); return keys.delete(key) },
  }
  return { state, values, writes, keys, removed, cleanup: () => { Object.assign(globalThis, previous) } }
}

test("all newly introduced image catalogs, resources, search engines and account UI are absent", () => {
  const root = new URL("../到期管家/", import.meta.url)
  for (const name of ["icons8", "bank-logos", "fluent-emoji-flat", "simple-icons", "dashboard-icons"]) assert.equal(existsSync(new URL(`assets/${name}`, root)), false)
  for (const file of readdirSync(new URL("src/", root))) {
    assert.doesNotMatch(file, /^(?:artwork_|online_artwork|github_artwork|icons8_mcp|icon_subscriptions|icon_credentials|icon_recommendations|financial_icon_keywords)/)
    assert.doesNotMatch(readFileSync(new URL(`src/${file}`, root), "utf8"), /img\.icons8\.com|api\.iconify\.design|icons8\.com\/mcp|ArtworkBrowser|useVisibleArtwork/)
  }
})

test("only retired image choices are stripped; SF choices and business data survive upgrade and backup", () => {
  const env = environment()
  try {
    const normalized = storage.loadState()
    assert.deepEqual(normalized.items, env.state.items)
    assert.deepEqual(normalized.settings.itemIconChoices, [env.state.settings.itemIconChoices!.at(-1)])
    assert.equal("iconSubscriptions" in normalized.settings, false)
    assert.equal(cleanupRetiredIcons(), null)
    assert.deepEqual(env.values.get(storage.STATE_KEY).items, env.state.items)
    assert.equal("iconSubscriptions" in env.values.get(storage.STATE_KEY).settings, false)
    assert.deepEqual(env.removed, ["due-manager.icons8.api-key.v1", "due-manager.icons8.mcp.session.v1"])
    assert.equal(env.keys.get("unrelated"), "KEEP")
    const backup = createBackupJSON()
    assert.doesNotMatch(backup, /SECRET-|icons8-|fluent-emoji-flat:|github-artwork:|iconSubscriptions/)
    assert.deepEqual(parseBackupJSON(backup).state.items, env.state.items)
    const writeCount = env.writes.length
    assert.equal(cleanupRetiredIcons(), null)
    assert.equal(env.writes.length, writeCount)
  } finally { env.cleanup() }
})

test("failed upgrade cleanup preserves the source and never leaks credentials or clears unrelated keys", () => {
  for (const failKey of [storage.STATE_KEY, storage.LOCAL_SNAPSHOTS_KEY, "keychain"]) {
    const env = environment(failKey)
    try {
      const warning = cleanupRetiredIcons()
      assert.ok(warning)
      assert.doesNotMatch(warning, /SECRET-|private note/)
      if (failKey !== "keychain") assert.deepEqual(env.values.get(storage.STATE_KEY), env.state)
      else assert.equal(env.keys.get("due-manager.icons8.mcp.session.v1"), "SECRET-MCP")
      assert.equal(env.keys.get("unrelated"), "KEEP")
    } finally { env.cleanup() }
  }
})

test("unknown or malformed non-retired choices remain validation errors, not silent item resets", () => {
  const choice = { source: "reminder", itemID: "one", iconID: "sf:car.fill" }
  assert.deepEqual(normalizeItemIconChoices([choice]), [choice])
  for (const raw of [[{ ...choice, iconID: "https://example.com/image.png" }], [choice, choice], [{ ...choice, source: "other" }], [null]]) assert.throws(() => normalizeItemIconChoices(raw))
})

test("the expanded SF collection preserves original names, has 182 unique symbols and searchable themes", () => {
  assert.equal(DUE_ICON_OPTIONS.length, 182)
  assert.equal(new Set(DUE_ICON_OPTIONS.map(icon => icon.name)).size, 182)
  assert.ok(searchSystemIcons("钱包").some(icon => icon.name === "wallet.pass.fill"))
  assert.ok(searchSystemIcons("wallet").some(icon => icon.name === "wallet.pass.fill"))
  assert.ok(searchSystemIcons("銀行").some(icon => icon.name === "building.columns.fill"))
  assert.ok(searchSystemIcons("music").some(icon => icon.name === "music.note"))
  assert.equal(searchSystemIcons("unknown-no-match-847291").length, 0)
})

test("reminder titles and notes refine generic actions before unrelated list categories", () => {
  for (const [title, notes, icon] of [
    ["续订服务", "Spotify Premium", "music.note"], ["月底处理", "HSBC", "building.columns.fill"],
    ["月底处理", "Bybit Card", "creditcard.fill"], ["检查", "RedotPay", "creditcard.fill"],
    ["月底处理", "支付宝", "arrow.left.arrow.right.circle.fill"], ["预约", "疫苗接种", "syringe.fill"],
    ["家庭电费", "Netflix", "bolt.fill"], ["银行卡激活", "Spotify", "creditcard.fill"],
  ]) assert.equal(resolveReminderIcon(title, "Work", notes).name, icon, `${title}: ${notes}`)
  assert.equal(resolveReminderIcon("BANK 06 | Ally", "Wallet Plan", "Spotify").name, "building.columns.fill")
  assert.equal(resolveReminderIcon("BILL 01 | Monthly", "Wallet Plan", "Spotify").name, "doc.text.fill")
  const privateNotes = "private ".repeat(200) + "\n1Password Families"
  assert.deepEqual(inferReminderNoteIconCandidate(privateNotes), { iconName: "key.fill", confidence: "strong" })
})

test("manual per-reminder symbols override inference without modifying action identity or dates", () => {
  const item: any = { id: "r", source: "reminder", completionKey: "date:2026-09-30", iconName: "music.note", iconColor: "systemPink", dueDate: "2026-09-30", canComplete: false }
  const settings = { ...storage.defaultState().settings, itemIconChoices: [{ source: "reminder" as const, itemID: "r", iconID: "sf:wallet.pass.fill" }] }
  const [display] = withItemIconChoices([item], settings)
  assert.deepEqual(display, { ...item, iconName: "wallet.pass.fill", iconColor: "systemOrange", iconIsExplicit: true })
})
