// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import test from "node:test"
import { DUE_ICON_OPTIONS, dueIconLabel, searchSystemIcons, resolveDueIcon, resolveReminderIcon, inferReminderNoteIconCandidate } from "../到期管家/src/icons.ts"
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
    const result = searchSystemIcons(query)
    assert.ok(reference(query).every(icon => result.includes(icon)), `${query}: existing label matches remain searchable`)
    assert.deepEqual(result, DUE_ICON_OPTIONS.filter(icon => result.includes(icon)), `${query}: aliases never reorder the catalog`)
  }
  assert.equal(searchSystemIcons("").length, DUE_ICON_OPTIONS.length)
  assert.ok(searchSystemIcons("銀行").some(icon => icon.name === "building.columns.fill"))
  assert.ok(searchSystemIcons("ＷＡＬＬＥＴ").some(icon => icon.name === "wallet.pass.fill"))
  assert.deepEqual(searchSystemIcons("Credit Card").map(icon => icon.name), ["creditcard.fill", "creditcard.and.123", "creditcard.trianglebadge.exclamationmark"])
  assert.equal(searchSystemIcons("wallet unknown-847291").length, 0)
  const results = searchSystemIcons("fill")
  assert.ok(results.length > 1)
  assert.deepEqual(results, DUE_ICON_OPTIONS.filter(icon => results.includes(icon)))
  assert.ok(results.every(icon => DUE_ICON_OPTIONS.includes(icon)), "results retain catalog objects")
})

test("scene aliases make the nine former zero-hit searches discoverable in simplified, traditional and English", () => {
  const scenes = [
    [["房租", "租約", "rent"], "house.fill"],
    [["物业", "物業", "property management"], "house.fill"],
    [["护照", "護照", "passport"], "doc.text.image.fill"],
    [["驾照", "駕照", "driving licence"], "person.text.rectangle.fill"],
    [["合同", "合約", "contract"], "signature"],
    [["年检", "年檢", "annual inspection"], "car.fill"],
    [["保养", "保養", "car maintenance"], "wrench.adjustable.fill"],
    [["复诊", "複診", "follow-up"], "stethoscope"],
    [["贷款", "貸款", "repayment"], "percent"],
  ] as const
  for (const [queries, name] of scenes) for (const query of queries) {
    const results = searchSystemIcons(query)
    assert.ok(results.some(icon => icon.name === name), `${query}: ${name}`)
    assert.deepEqual(results, DUE_ICON_OPTIONS.filter(icon => results.includes(icon)), query)
  }
  for (const [query, name] of [["牙科", "mouth.fill"], ["口腔", "mouth.fill"], ["泳課", "figure.pool.swim"],
    ["游泳", "figure.pool.swim"], ["yoga", "figure.yoga"], ["资格证", "checkmark.seal.fill"], ["資格證", "checkmark.seal.fill"]]) {
    assert.ok(searchSystemIcons(query).some(icon => icon.name === name), query)
  }
})

test("search reuses product and action vocabulary without weakening AND terms or normalizing away identifiers", () => {
  for (const [query, name] of [["ChatGPT", "sparkles"], ["　ＣＨＡＴＧＰＴ　", "sparkles"], ["Netflix", "play.rectangle.fill"],
    ["汇丰", "building.columns.fill"], ["匯豐", "building.columns.fill"], ["滙豐", "building.columns.fill"],
    ["1Password", "key.fill"], ["go swimming", "figure.pool.swim"], ["取快递", "shippingbox.fill"]]) {
    assert.ok(searchSystemIcons(query).some(icon => icon.name === name), query)
  }
  assert.deepEqual(searchSystemIcons("ChatGPT 数字服务").map(icon => icon.name), ["sparkles"])
  assert.deepEqual(searchSystemIcons("property management 居家生活").map(icon => icon.name), ["house.fill"])
  assert.equal(searchSystemIcons("Netflix 财务").length, 0)
  assert.equal(searchSystemIcons("passport unknown-847291").length, 0)
  assert.ok(searchSystemIcons("doc.text.image.fill").some(icon => icon.name === "doc.text.image.fill"))
  assert.ok(searchSystemIcons("figure.pool.swim").some(icon => icon.name === "figure.pool.swim"))
})

test("two-letter Latin abbreviations require boundaries while longer and one-letter searches remain partial", () => {
  for (const query of ["AI", "ai", "　ＡＩ　", "AI 数字服务"]) {
    assert.deepEqual(searchSystemIcons(query).map(icon => icon.name), ["sparkles"], query)
  }
  assert.deepEqual(searchSystemIcons("ID card").map(icon => icon.name), ["person.text.rectangle.fill"])
  assert.deepEqual(searchSystemIcons("ＩＤ card").map(icon => icon.name), ["person.text.rectangle.fill"])
  assert.equal(searchSystemIcons("AI 财务").length, 0)
  assert.equal(searchSystemIcons("ID unknown-847291").length, 0)
  for (const query of ["TV", "ＴＶ"]) {
    const result = searchSystemIcons(query)
    assert.ok(result.some(icon => icon.name === "tv.fill"), query)
    assert.ok(!result.some(icon => icon.name === "figure.pool.swim"), "TV does not match unrelated longer words")
    assert.deepEqual(result, DUE_ICON_OPTIONS.filter(icon => result.includes(icon)), query)
  }
  assert.ok(searchSystemIcons("mail").some(icon => icon.name === "envelope.fill"), "longer partial search stays available")
  assert.ok(searchSystemIcons("train").some(icon => icon.name === "tram.fill"))
  assert.ok(searchSystemIcons("t").some(icon => icon.name === "creditcard.fill"), "one-letter search is unchanged")
  for (const query of ["体检", "體檢"]) assert.deepEqual(searchSystemIcons(query).map(icon => icon.name), ["cross.case.fill"], query)
  assert.ok(searchSystemIcons("oral checkup").some(icon => icon.name === "mouth.fill"), "qualified oral vocabulary remains discoverable")
})

test("search-only synonyms do not become title or note inference rules", () => {
  for (const query of ["合同", "license", "licence", "AI", "inspection", "贷款"]) assert.ok(searchSystemIcons(query).length > 0, query)
  for (const title of ["合同配色调整", "software license review", "licence configuration", "AI alignment", "annual inspection", "贷款模型研究", "保养提醒"]) {
    assert.equal(resolveDueIcon(title, "custom").name, "calendar.badge.clock", title)
    assert.equal(resolveReminderIcon(title, "Personal", title).name, "checklist", title)
    assert.equal(inferReminderNoteIconCandidate(title), null, title)
  }
})

test("specific scenes refine titles and notes while explicit choices and unrelated contexts remain authoritative", () => {
  const cases = [
    ["驾照续期", "person.text.rectangle.fill"], ["driving licence renewal", "person.text.rectangle.fill"],
    ["passport renewal", "doc.text.image.fill"], ["簽證到期", "doc.text.image.fill"],
    ["资格证续期", "checkmark.seal.fill"], ["professional certificate renewal", "checkmark.seal.fill"],
    ["游泳课程", "figure.pool.swim"], ["swimming lesson", "figure.pool.swim"],
    ["牙医预约", "mouth.fill"], ["dental appointment", "mouth.fill"],
    ["瑜伽会员", "figure.yoga"], ["yoga class", "figure.yoga"],
    ["车辆保养", "wrench.adjustable.fill"], ["car maintenance", "wrench.adjustable.fill"],
  ] as const
  for (const [title, name] of cases) {
    assert.equal(resolveDueIcon(title, "custom").name, name, title)
    assert.equal(resolveReminderIcon(title, "Work", "Netflix").name, name, title)
    assert.deepEqual(inferReminderNoteIconCandidate(title), { iconName: name, confidence: "strong" }, title)
    assert.equal(resolveReminderIcon("续订服务", "Work", title).name, name, title)
    assert.equal(resolveDueIcon(title, "custom", "music.note").name, "music.note", `${title}: old explicit choices win`)
  }
  for (const [title, name] of [["Visa card renewal", "creditcard.fill"], ["Visa payment", "creditcard.fill"],
    ["SSL证书续期", "globe"], ["TLS certificate renewal", "globe"], ["software license review", "calendar.badge.clock"],
    ["做体检", "calendar.badge.clock"], ["home maintenance", "hammer.fill"], ["car insurance", "car.fill"]]) {
    assert.equal(resolveDueIcon(title, "custom").name, name, title)
  }
  for (const [title, name] of [["做瑜伽", "figure.yoga"], ["go swimming", "figure.pool.swim"], ["看牙医", "mouth.fill"],
    ["renew passport", "doc.text.image.fill"], ["renew identity card", "person.text.rectangle.fill"], ["renew qualification", "checkmark.seal.fill"],
    ["service the car", "wrench.adjustable.fill"], ["做体检", "cross.case.fill"], ["go running", "figure.run"]]) {
    assert.equal(resolveReminderIcon(title, "Work").name, name, title)
  }
  assert.equal(resolveReminderIcon("家庭电费", "Work", "renew passport").name, "bolt.fill", "specific titles outrank notes")
  assert.deepEqual(inferReminderNoteIconCandidate("renew passport"), { iconName: "doc.text.image.fill", confidence: "strong" })
  assert.deepEqual(inferReminderNoteIconCandidate("service the car"), { iconName: "wrench.adjustable.fill", confidence: "strong" })
  assert.equal(resolveReminderIcon("续订服务", "Work", "service the car").name, "wrench.adjustable.fill")
  assert.deepEqual(inferReminderNoteIconCandidate("do yoga"), { iconName: "figure.yoga", confidence: "ordinary" })
  const reminder = { ...displayItem("reminder", "r"), iconName: "doc.text.image.fill", iconColor: "systemIndigo" }
  const settings = { ...defaultState().settings, itemIconChoices: [{ source: "reminder" as const, itemID: "r", iconID: "sf:music.note" }] }
  assert.equal(withItemIconChoices([reminder], settings)[0].iconName, "music.note")
  assert.equal(dueIconLabel("person.text.rectangle.fill", "zh-Hant"), "身份駕照")
  assert.equal(dueIconLabel("doc.text.image.fill", "zh-Hant"), "護照簽證")
  assert.equal(dueIconLabel("checkmark.seal.fill", "en"), "Certificates & Qualifications")
})
