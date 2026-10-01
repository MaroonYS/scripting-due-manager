// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"
import { createRecurrenceRule } from "../到期管家/src/date.ts"
import { DUE_ICON_OPTIONS, dueIconLabel, inferReminderNoteIconCandidate, normalizeIconOverride,
  resolveDueIcon, resolveReminderIcon, searchSystemIcons } from "../到期管家/src/icons.ts"
import { isKnownIconChoice, itemIconID, normalizeItemIconChoices, symbolChoice, withItemIconChoices } from "../到期管家/src/icon_preferences.ts"
import { createBackupJSON, parseBackupJSON } from "../到期管家/src/recovery.ts"
import * as storage from "../到期管家/src/storage.ts"
import type { ManualDueItem } from "../到期管家/src/types.ts"

const TRAVEL_ICONS = [
  ["bed.double.circle.fill", "酒店住宿", "酒店住宿", "Hotel Stays"],
  ["building.2.crop.circle.fill", "酒店大楼", "酒店大樓", "Hotels & Resorts"],
  ["key.horizontal.fill", "房卡门钥", "房卡門鑰", "Room Keys"],
  ["suitcase.cart.fill", "行李托运", "行李托運", "Checked Baggage"],
  ["airplane.departure", "出发登机", "出發登機", "Departures & Boarding"],
  ["airplane.arrival", "抵达接机", "抵達接機", "Arrivals & Pickup"],
  ["airplane.circle.fill", "航空里程", "航空里程", "Airline Miles"],
  ["binoculars.fill", "景点观光", "景點觀光", "Sightseeing"],
  ["figure.seated.seatbelt", "机舱座位", "機艙座位", "Cabin & Seats"],
  ["fork.knife.circle.fill", "酒店餐饮", "酒店餐飲", "Hotel Dining"],
  ["lanyardcard.fill", "证件挂卡", "證件掛卡", "ID Badges"],
  ["person.crop.circle.badge.checkmark", "身份核验", "身份核驗", "Identity Checks"],
  ["person.crop.square.filled.and.at.rectangle", "会员证卡", "會員證卡", "Membership Cards"],
  ["tram.circle.fill", "铁路通勤", "鐵路通勤", "Rail & Commuting"],
  ["globe.europe.africa.fill", "欧洲旅行", "歐洲旅行", "Europe & Africa Travel"],
  ["globe.americas.fill", "美洲旅行", "美洲旅行", "Americas Travel"],
] as const

const WORK_ICONS = new Set(["lanyardcard.fill", "person.crop.circle.badge.checkmark", "person.crop.square.filled.and.at.rectangle"])
const names = (query: string) => searchSystemIcons(query).map(icon => icon.name)
function includes(query: string, expected: readonly string[]) {
  const actual = names(query)
  for (const name of expected) assert.ok(actual.includes(name), `${query}: missing ${name} in ${actual.join(", ")}`)
  assert.equal(new Set(actual).size, actual.length)
  assert.deepEqual(actual, DUE_ICON_OPTIONS.filter(icon => actual.includes(icon.name)).map(icon => icon.name), "search retains catalog order")
}

test("travel enrichment appends sixteen native symbols and preserves every old catalog definition", () => {
  assert.equal(DUE_ICON_OPTIONS.length, 216)
  assert.equal(new Set(DUE_ICON_OPTIONS.map(icon => icon.name)).size, 216)
  assert.deepEqual(DUE_ICON_OPTIONS.slice(200).map(icon => icon.name), TRAVEL_ICONS.map(([name]) => name))
  assert.equal(createHash("sha256").update(JSON.stringify(DUE_ICON_OPTIONS.slice(0, 200))).digest("hex"),
    "08460f671b73a3701ff630e701d57d2d897c837580ee6ca8109dfefd7831e8ad", "old names, labels, groups, colors and order are unchanged")
  assert.deepEqual(DUE_ICON_OPTIONS.find(icon => icon.name === "globe.asia.australia.fill"), {
    name: "globe.asia.australia.fill", label: "地理历史", color: "systemGreen", group: "学习阅读",
  }, "the existing Asia globe is reused through search without duplicate symbols or reclassification")
})

test("all sixteen travel and identity symbols have curated labels and valid local SF choices", () => {
  for (const [name, simplified, traditional, english] of TRAVEL_ICONS) {
    const definition = DUE_ICON_OPTIONS.find(icon => icon.name === name)!
    assert.equal(definition.group, WORK_ICONS.has(name) ? "工作效率" : "出行旅行")
    assert.match(definition.color, /^system(?:Orange|Teal|Green|Blue|Indigo|Purple)$/)
    assert.equal(dueIconLabel(name, "zh-Hans"), simplified)
    assert.equal(dueIconLabel(name, "zh-Hant"), traditional)
    assert.equal(dueIconLabel(name, "en"), english)
    assert.equal(normalizeIconOverride(name), name)
    assert.ok(isKnownIconChoice(`sf:${name}`))
    assert.equal(symbolChoice(`sf:${name}`), definition)
    assert.deepEqual(normalizeItemIconChoices([{ source: "reminder", itemID: "travel-test", iconID: `sf:${name}` }]),
      [{ source: "reminder", itemID: "travel-test", iconID: `sf:${name}` }])
  }
})

test("hotel reservations, check-in, checkout and room keys are searchable across languages", () => {
  for (const query of ["酒店预订", "酒店預訂", "订房", "訂房", "hotel booking", "hotel reservation", "入住", "退房", "check-in", "check out"]) includes(query, ["bed.double.circle.fill"])
  for (const query of ["酒店", "飯店", "resort", "酒店集团", "酒店集團", "hotel chain"]) includes(query, ["building.2.crop.circle.fill"])
  for (const query of ["房卡", "門卡", "酒店钥匙", "酒店鑰匙", "room key", "hotel check in", "hotel check out"]) includes(query, ["key.horizontal.fill"])
})

test("hotel credit-card and free-night search returns relevant card and accommodation alternatives", () => {
  for (const query of ["酒店信用卡", "酒店类信用卡", "酒店類信用卡", "酒店联名卡", "酒店聯名卡", "hotel credit card", "hotel co-branded card", "Hilton credit card", "Marriott hotel card"]) {
    includes(query, ["creditcard.fill", "creditcard.and.123", "wallet.pass.fill", "bed.double.circle.fill", "building.2.crop.circle.fill"])
  }
  for (const query of ["免费房晚", "免費房晚", "酒店积分", "酒店積分", "free night", "award night", "hotel points", "night certificate"]) includes(query, ["bed.double.circle.fill"])
})

test("hotel brands and programs browse native category symbols without branded artwork", () => {
  for (const query of ["Hilton", "希尔顿", "希爾頓", "Marriott", "万豪", "萬豪", "Bonvoy", "Hyatt", "凯悦", "凱悅", "IHG", "洲际", "洲際", "Accor", "雅高", "Wyndham", "温德姆", "溫德姆", "Choice"]) {
    includes(query, ["creditcard.fill", "bed.double.circle.fill", "building.2.crop.circle.fill", "person.crop.square.filled.and.at.rectangle"])
  }
})

test("hotel dining, breakfast and loyalty have dedicated browsable alternatives", () => {
  for (const query of ["酒店餐饮", "酒店餐飲", "酒店早餐", "免费早餐", "免費早餐", "行政酒廊", "hotel dining", "hotel breakfast", "free breakfast", "dining voucher", "executive lounge"]) includes(query, ["fork.knife.circle.fill"])
  for (const query of ["会员卡", "會員卡", "会员证", "會員證", "会籍", "會籍", "酒店会员卡", "酒店會員卡", "loyalty card", "loyalty program", "elite status"]) includes(query, ["person.crop.square.filled.and.at.rectangle"])
})

test("airline credit-card and miles search returns card and aviation alternatives", () => {
  for (const query of ["航空信用卡", "航班类信用卡", "航班類信用卡", "航空类信用卡", "航空類信用卡", "航空联名卡", "航空聯名卡", "里程卡", "airline credit card", "flight credit card", "airline co-branded card", "Cathay credit card", "Avios card"]) {
    includes(query, ["creditcard.fill", "creditcard.and.123", "wallet.pass.fill", "airplane", "airplane.circle.fill"])
  }
  for (const query of ["航空里程", "飞行里程", "飛行里程", "里程兑换", "里程兌換", "miles", "air miles", "frequent flyer", "award flight", "miles redemption"]) includes(query, ["airplane.circle.fill"])
})

test("airline and frequent-flyer brands are searchable in simplified, traditional and English", () => {
  for (const query of ["Cathay", "国泰", "國泰", "Asia Miles", "亚洲万里通", "亞洲萬里通", "Avios", "BA", "British Airways", "英航", "Delta", "达美", "達美", "United", "美联航", "美聯航", "ANA", "全日空", "JAL", "日航", "SQ", "Singapore Airlines", "KrisFlyer", "新航", "Emirates", "阿联酋航空", "阿聯酋航空", "Qantas", "澳航", "Aeroplan", "Air Canada", "加航", "Qatar Airways"]) {
    includes(query, ["creditcard.fill", "airplane", "airplane.circle.fill", "person.crop.square.filled.and.at.rectangle"])
  }
})

test("departure, boarding, arrival, baggage and cabin searches remain distinct", () => {
  for (const query of ["出发", "出發", "登机", "登機", "登机牌", "登機牌", "登机口", "登機口", "departure", "boarding gate", "boarding pass", "airport check in"]) includes(query, ["airplane.departure"])
  for (const query of ["抵达", "抵達", "接机", "接機", "arrival", "airport pickup", "airport transfer", "flight landing"]) includes(query, ["airplane.arrival"])
  for (const query of ["行李托运", "行李托運", "行李额", "行李額", "行李领取", "行李領取", "checked baggage", "baggage allowance", "baggage claim", "carry-on"]) includes(query, ["suitcase.cart.fill"])
  for (const query of ["机舱", "機艙", "选座", "選座", "商务舱", "商務艙", "头等舱", "頭等艙", "seat selection", "business class", "first class", "upgrade"]) includes(query, ["figure.seated.seatbelt"])
  assert.ok(!names("arrival").includes("airplane.departure"))
  assert.ok(!names("boarding gate").includes("airplane.arrival"))
})

test("travel cards, airport lounges, rewards and travel insurance extend existing choices", () => {
  for (const query of ["旅行信用卡", "旅遊信用卡", "旅行类信用卡", "旅行類信用卡", "travel credit card", "travel rewards"]) includes(query, ["creditcard.fill", "creditcard.and.123", "wallet.pass.fill", "airplane"])
  for (const query of ["机场贵宾室", "機場貴賓室", "机场休息室", "機場休息室", "airport lounge", "Priority Pass", "LoungeKey"]) includes(query, ["figure.seated.seatbelt", "creditcard.fill"])
  for (const query of ["返现卡", "返現卡", "现金回赠", "現金回贈", "积分卡", "積分卡", "cashback card", "rewards card", "reward points"]) includes(query, ["creditcard.fill", "creditcard.and.123", "gift.fill"])
  for (const query of ["旅行保险", "旅行保險", "旅遊保險", "航班延误", "航班延誤", "travel insurance", "flight delay", "rental insurance"]) includes(query, ["shield.fill"])
})

test("credentials, residence, access badges, passports and driver cards have targeted alternatives", () => {
  for (const query of ["工牌", "员工卡", "員工卡", "工作证", "工作證", "门禁卡", "門禁卡", "id badge", "staff card", "employee badge", "access card", "visitor pass"]) includes(query, ["lanyardcard.fill"])
  for (const query of ["身份核验", "身份核驗", "实名认证", "實名認證", "identity verification", "identity check"]) includes(query, ["person.crop.circle.badge.checkmark"])
  for (const query of ["居留卡", "居留证", "居留證", "residence permit", "resident card"]) includes(query, ["person.crop.rectangle.fill", "person.crop.circle.badge.checkmark"])
  for (const query of ["护照", "護照", "签证", "簽證", "通行证", "通行證", "旅行证件", "旅行證件", "passport", "travel visa", "travel document", "entry permit"]) includes(query, ["doc.text.image.fill"])
  for (const query of ["驾照", "駕照", "驾驶证", "駕駛證", "driver license", "driving licence"]) includes(query, ["person.text.rectangle.fill"])
})

test("rail, ferry, rental, sightseeing and geographic travel options are all searchable", () => {
  for (const query of ["铁路通票", "鐵路通票", "rail pass", "Eurail", "Interrail", "JR Pass", "通勤", "commuting"]) includes(query, ["tram.circle.fill"])
  for (const query of ["铁路信用卡", "鐵路信用卡", "铁路联名卡", "鐵路聯名卡", "交通卡", "railcard", "rail credit card", "commuter card"]) includes(query, ["creditcard.fill", "tram.circle.fill"])
  for (const query of ["邮轮", "郵輪", "船票", "cruise booking", "ferry ticket"]) includes(query, ["ferry.fill"])
  for (const query of ["租车预订", "租車預訂", "租车权益", "租車權益", "car rental", "rental benefits", "Hertz", "Avis", "Sixt"]) includes(query, ["car.side.fill"])
  for (const query of ["景点观光", "景點觀光", "sightseeing", "attraction", "tourism"]) includes(query, ["binoculars.fill"])
  for (const query of ["亚太旅行", "亞太旅行", "Asia travel", "Australia travel", "Oceania"]) includes(query, ["globe.asia.australia.fill"])
  for (const query of ["欧洲旅行", "歐洲旅行", "非洲旅行", "Europe travel", "Africa travel"]) includes(query, ["globe.europe.africa.fill"])
  for (const query of ["美洲旅行", "美国旅行", "美國旅行", "Americas", "North America", "South America"]) includes(query, ["globe.americas.fill"])
})

test("travel search preserves AND, full-width normalization, short-word precision and the static catalog", () => {
  const catalog = structuredClone(DUE_ICON_OPTIONS)
  assert.deepEqual(names("ＨＩＬＴＯＮ　ＣＲＥＤＩＴ　ＣＡＲＤ"), names("hilton credit card"))
  assert.deepEqual(names("　Ａｓｉａ　Ｍｉｌｅｓ　"), names("asia miles"))
  assert.deepEqual(names("ＡＩ"), ["sparkles"])
  assert.deepEqual(names("AI"), ["sparkles"])
  includes("ＩＤ　ＣＡＲＤ", ["person.text.rectangle.fill", "lanyardcard.fill", "person.crop.circle.badge.checkmark"])
  assert.ok(!names("BA").includes("banknote.fill"), "BA never matches banknote as a substring")
  assert.deepEqual(names("hotel swimming mortgage"), [])
  assert.deepEqual(names("departure dental"), [])
  assert.deepEqual(names("unknown-travel-query-847291"), [])
  assert.deepEqual(DUE_ICON_OPTIONS, catalog)
  assert.notEqual(searchSystemIcons(""), DUE_ICON_OPTIONS)
})

test("unqualified hotel, airline and card-brand browsing aliases do not broaden inference", () => {
  for (const title of ["Hilton research", "Marriott ideas", "Bonvoy research", "Hyatt comparison", "IHG essay", "Accor idea", "Wyndham notes", "Choice essay", "Cathay ideas", "Avios study", "Delta research", "United ideas", "ANA essay", "JAL research", "KrisFlyer research", "Emirates ideas", "Qantas notes", "Aeroplan study", "loyalty program study", "resident card research", "Hertz ideas"]) {
    assert.equal(resolveDueIcon(title, "custom").name, "calendar.badge.clock", title)
    assert.equal(resolveReminderIcon(title, "Work").name, "briefcase.fill", title)
    assert.equal(inferReminderNoteIconCandidate(title), null, title)
    assert.equal(resolveReminderIcon("整理资料", title).name, "checklist", "search aliases do not become List inference")
  }
})

function storageEnvironment() {
  const previous = (globalThis as any).Storage
  const item: ManualDueItem = {
    id: "same-id", title: "Sample card", kind: "creditCard", iconName: "car.fill", dueDate: "2026-10-15",
    includesTime: true, hour: 9, minute: 30, remindBeforeDays: 3,
    recurrence: createRecurrenceRule("month", 1, "2026-10-15"), enabled: true,
    amount: "250", note: "Local test note only", createdAt: 1, updatedAt: 2,
  }
  const state = storage.defaultState(2)
  state.items = [item, { ...item, id: "old-item", iconName: "wallet.pass.fill" }]
  state.settings.itemIconChoices = [
    { source: "manual", itemID: item.id, iconID: "sf:wallet.pass.fill" },
    { source: "reminder", itemID: item.id, iconID: "sf:music.note" },
    { source: "manual", itemID: "old-item", iconID: "sf:creditcard.fill" },
    { source: "reminder", itemID: "old-item", iconID: "sf:building.columns.fill" },
  ]
  state.completionHistory = [{ id: "history", itemID: "fake-reminder", source: "reminder", title: "Local test only",
    dueDate: "2026-10-01", completedAt: 2, action: "complete", undoneAt: null }]
  const values = new Map<string, unknown>([[storage.STATE_KEY, structuredClone(state)]])
  ;(globalThis as any).Storage = {
    get: (key: string) => structuredClone(values.get(key) ?? null),
    set: (key: string, value: unknown) => { values.set(key, structuredClone(value)); return true },
    contains: (key: string) => values.has(key), remove: (key: string) => values.delete(key),
  }
  return { item, state, cleanup: () => { (globalThis as any).Storage = previous } }
}

test("all sixteen choices save and survive backup with dates, notes, completion history and old choices intact", () => {
  for (const [name] of TRAVEL_ICONS) {
    const env = storageEnvironment()
    try {
      const next = storage.updateManualItemIcon(env.item.id, name, env.item.updatedAt, "sf:wallet.pass.fill")
      assert.deepEqual(next.items[0], { ...env.item, iconName: name, updatedAt: 3 })
      assert.deepEqual(next.items[1], env.state.items[1])
      assert.deepEqual(next.completionHistory, env.state.completionHistory)
      assert.equal(itemIconID(next.settings, "manual", env.item.id), null)
      assert.equal(itemIconID(next.settings, "reminder", env.item.id), "sf:music.note", "manual appearance does not touch the same Reminder ID")
      const chosen = storage.updateItemIconChoice("reminder", env.item.id, { iconID: `sf:${name}`, expectedIconID: "sf:music.note" })
      assert.deepEqual(chosen.items, next.items)
      assert.deepEqual(chosen.settings.itemIconChoices!.filter(choice => choice.itemID === "old-item"), env.state.settings.itemIconChoices!.filter(choice => choice.itemID === "old-item"))
      const imported = parseBackupJSON(createBackupJSON(3)).state
      assert.deepEqual(imported.items, chosen.items)
      assert.deepEqual(imported.completionHistory, env.state.completionHistory)
      assert.deepEqual(imported.settings.itemIconChoices, chosen.settings.itemIconChoices)
      assert.equal(resolveDueIcon(imported.items[0].title, imported.items[0].kind, imported.items[0].iconName).name, name)
      const reminder: any = { id: env.item.id, source: "reminder", iconName: "music.note", iconColor: "systemPink",
        dueDate: "2026-10-15", completionKey: "date:2026-10-15", canComplete: false }
      const [display] = withItemIconChoices([reminder], imported.settings)
      assert.deepEqual(display, { ...reminder, iconName: name, iconColor: symbolChoice(`sf:${name}`)!.color, iconIsExplicit: true })
    } finally { env.cleanup() }
  }
})
