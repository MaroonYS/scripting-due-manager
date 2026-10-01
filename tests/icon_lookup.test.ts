// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import test from "node:test"
import { DUE_ICON_OPTIONS, dueIconLabel, searchSystemIcons } from "../到期管家/src/icons.ts"
import { withItemIconChoices } from "../到期管家/src/icon_preferences.ts"
import { defaultState } from "../到期管家/src/storage.ts"
import type { DisplayDueItem } from "../到期管家/src/types.ts"

function displayItem(source: "manual" | "reminder", id: string): DisplayDueItem {
  return { id, source, completionKey: "date:2026-10-01", title: "Keep", kind: source === "manual" ? "custom" : "reminder",
    iconName: "music.note", iconColor: "systemPink", dueDate: "2026-10-01", includesTime: false, hour: 0, minute: 0,
    dueTimestamp: 1, remindBeforeDays: 0, amount: "Keep amount", note: "Keep note", priority: 1, stale: false, canComplete: true }
}

test("batch symbol lookups keep identical IDs separated by source and preserve item order", () => {
  const items = [displayItem("reminder", "same-id"), displayItem("manual", "same-id"), displayItem("manual", "__proto__")]
  const settings = { ...defaultState().settings, itemIconChoices: [
    { source: "manual" as const, itemID: "same-id", iconID: "sf:creditcard.fill" },
    { source: "reminder" as const, itemID: "same-id", iconID: "sf:wallet.pass.fill" },
    { source: "manual" as const, itemID: "__proto__", iconID: "sf:car.fill" },
  ] }
  const originals = structuredClone({ items, settings })
  const result = withItemIconChoices(items, settings)
  assert.deepEqual(result.map(item => item.iconName), ["wallet.pass.fill", "creditcard.fill", "car.fill"])
  assert.deepEqual(result.map(({ iconName, iconColor, iconIsExplicit, ...item }) => item),
    items.map(({ iconName, iconColor, iconIsExplicit, ...item }) => item))
  assert.ok(result.every(item => item.iconIsExplicit === true))
  assert.deepEqual({ items, settings }, originals, "display overrides must not mutate saved items or choices")
})

test("unknown and absent symbols retain the exact automatic item, and first matches stay authoritative", () => {
  const unknown = displayItem("reminder", "unknown"), absent = displayItem("manual", "absent"), duplicate = displayItem("manual", "duplicate")
  const settings = { ...defaultState().settings, itemIconChoices: [
    { source: "reminder" as const, itemID: "unknown", iconID: "sf:future.symbol.fill" },
    { source: "manual" as const, itemID: "duplicate", iconID: "sf:car.fill" },
    { source: "manual" as const, itemID: "duplicate", iconID: "sf:creditcard.fill" },
  ] }
  const result = withItemIconChoices([unknown, absent, duplicate], settings)
  assert.equal(result[0], unknown)
  assert.equal(result[1], absent)
  assert.equal(result[2].iconName, "car.fill")
  assert.equal(withItemIconChoices([absent], defaultState().settings)[0], absent)
})

test("indexed icon search preserves multilingual normalization, AND terms and catalog order", () => {
  const reference = (query: string) => {
    const terms = query.normalize("NFKC").toLowerCase().trim().split(/\s+/).filter(Boolean)
    return DUE_ICON_OPTIONS.filter(icon => {
      const text = `${icon.name} ${icon.label} ${icon.group} ${dueIconLabel(icon.name, "en")} ${dueIconLabel(icon.name, "zh-Hant")}`.normalize("NFKC").toLowerCase()
      return terms.every(term => text.includes(term))
    })
  }
  for (const query of ["", "  ", "钱包", "銀行", "ＷＡＬＬＥＴ", "　ＭＵＳＩＣ　", "Credit Card", "财务 fill", "Wallet 财务", "wallet unknown-847291"]) {
    assert.deepEqual(searchSystemIcons(query), reference(query), query)
  }
  assert.equal(searchSystemIcons("").length, DUE_ICON_OPTIONS.length)
  assert.ok(searchSystemIcons("銀行").some(icon => icon.name === "building.columns.fill"))
  assert.deepEqual(searchSystemIcons("ＷＡＬＬＥＴ").map(icon => icon.name), ["wallet.pass.fill"])
  assert.deepEqual(searchSystemIcons("Credit Card").map(icon => icon.name), ["creditcard.fill"])
  assert.equal(searchSystemIcons("wallet unknown-847291").length, 0)
  const results = searchSystemIcons("fill")
  assert.ok(results.length > 1)
  assert.deepEqual(results, DUE_ICON_OPTIONS.filter(icon => results.includes(icon)))
  assert.ok(results.every(icon => DUE_ICON_OPTIONS.includes(icon)), "results retain catalog objects")
})
