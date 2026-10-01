// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { DUE_ICON_OPTIONS, resolveDueIcon, resolveReminderIcon } from "../到期管家/src/icons.ts"
import { recommendedSystemIcons } from "../到期管家/src/system_icon_recommendations.ts"
import { travelCardScene } from "../到期管家/src/travel_card_scenes.ts"
import type { TravelCardScene } from "../到期管家/src/travel_card_scenes.ts"

const names = (...args: Parameters<typeof recommendedSystemIcons>) => recommendedSystemIcons(...args).map(icon => icon.name)
const includes = (actual: string[], expected: readonly string[], title: string) => {
  for (const name of expected) assert.ok(actual.includes(name), `${title}: missing ${name} in ${actual.join(", ")}`)
}
const includesOne = (actual: string[], expected: readonly string[], title: string) => {
  assert.ok(expected.some(name => actual.includes(name)), `${title}: expected one of ${expected.join(", ")} in ${actual.join(", ")}`)
}

test("qualified hotel co-branded cards retain a distinct hotel-card scene", () => {
  for (const title of ["酒店信用卡年费", "酒店聯名信用卡年費", "hotel credit card annual fee", "Hilton Amex renewal", "Marriott Bonvoy card", "Hilton card"]) {
    assert.equal(travelCardScene(title), "hotelCard", title)
  }
})

test("qualified airline co-branded cards retain a distinct airline-card scene", () => {
  for (const title of ["航空信用卡还款", "航班聯名信用卡年費", "airline credit card bill", "Cathay Visa", "Delta Amex", "United credit card"]) {
    assert.equal(travelCardScene(title), "airlineCard", title)
  }
})

test("travel and rail co-branded cards are separate from airline and hotel cards", () => {
  const cases: readonly [string, TravelCardScene][] = [
    ["旅行信用卡年费", "travelCard"], ["旅遊信用卡續期", "travelCard"], ["travel credit card renewal", "travelCard"],
    ["铁路信用卡年费", "railCard"], ["鐵路聯名信用卡續期", "railCard"], ["rail credit card renewal", "railCard"],
  ]
  for (const [title, scene] of cases) assert.equal(travelCardScene(title), scene, title)
})

test("cashback and reward credit cards expose their own benefits without implying travel", () => {
  const cases: readonly [string, TravelCardScene][] = [
    ["返现信用卡年费", "cashbackCard"], ["現金回贈信用卡", "cashbackCard"], ["cashback credit card bill", "cashbackCard"],
    ["积分信用卡", "rewardsCard"], ["積分信用卡年費", "rewardsCard"], ["rewards credit card renewal", "rewardsCard"],
  ]
  for (const [title, scene] of cases) assert.equal(travelCardScene(title), scene, title)
})

test("explicit credit-card kind allows a co-brand name but a bare brand is not financial evidence", () => {
  for (const title of ["Marriott Bonvoy", "Hilton", "Cathay", "Delta", "United"]) {
    assert.equal(travelCardScene(title, "custom"), null, `${title}: custom title`)
    assert.equal(travelCardScene(title, "reminder"), null, `${title}: reminder title`)
    assert.equal(travelCardScene(title), null, `${title}: unqualified title`)
    assert.equal(travelCardScene(title, "creditCard"), /Marriott|Hilton/.test(title) ? "hotelCard" : "airlineCard", `${title}: explicit financial type`)
  }
})

test("membership and loyalty cards do not masquerade as co-branded credit cards", () => {
  for (const title of ["Marriott Bonvoy membership card", "Hilton loyalty card", "Delta membership card", "酒店会员卡", "酒店會員卡", "航空会员卡", "航空會員卡"]) {
    assert.equal(travelCardScene(title), null, title)
    assert.equal(travelCardScene(title, "creditCard"), null, `${title}: conflicting old kind`)
  }
})

test("gift, SIM, boarding and transit cards or passes are not travel credit products", () => {
  for (const title of ["Hilton gift card", "hotel gift card", "旅行 SIM 卡", "travel SIM card", "airline boarding pass", "航空登机牌", "航空登機證", "rail pass", "railcard", "铁路交通卡", "鐵路交通卡", "transit card"]) {
    assert.equal(travelCardScene(title), null, title)
    assert.equal(travelCardScene(title, "creditCard"), null, `${title}: conflicting old kind`)
  }
})

test("passport and visa documents and explicit bookings remain non-card contexts", () => {
  for (const title of ["passport renewal", "travel visa renewal", "Visa renewal", "護照換發", "签证续期", "簽證續期", "Hilton hotel booking", "Cathay flight booking", "Delta flight departure"]) {
    assert.equal(travelCardScene(title), null, title)
    assert.equal(travelCardScene(title, "creditCard"), null, `${title}: conflicting old kind`)
  }
  assert.equal(travelCardScene("Visa Card renewal"), null, "generic Visa card is financial but not a travel co-brand")
})

test("co-branded classification normalizes Latin case, full-width text and hyphenated card words", () => {
  for (const title of ["Hilton Amex renewal", "Marriott Bonvoy card", "Cathay Visa", "Delta Amex", "travel credit card renewal", "cashback credit card bill"]) {
    const expected = travelCardScene(title)
    assert.ok(expected, title)
    assert.equal(travelCardScene(title.toUpperCase()), expected, title)
    const fullWidth = `　${title.replace(/[!-~]/g, char => String.fromCharCode(char.charCodeAt(0) + 0xfee0)).replace(/ /g, "　")}　`
    assert.equal(travelCardScene(fullWidth), expected, title)
  }
  assert.equal(travelCardScene("hotel-credit-card renewal"), "hotelCard")
  assert.equal(travelCardScene("airline-credit-card bill"), "airlineCard")
})

test("short airline brands match words rather than unrelated longer names", () => {
  for (const title of ["United States ID card", "Delta Dental membership card", "unitedness credit card", "deltawing credit card"]) {
    assert.equal(travelCardScene(title), null, title)
  }
})

test("explicit co-branded card titles keep automatic financial identity and existing overrides", () => {
  for (const title of ["酒店信用卡年费", "Marriott Bonvoy card", "Hilton Amex renewal", "航空信用卡还款", "Cathay Visa", "Delta Amex"]) {
    assert.equal(resolveDueIcon(title, "custom").name, "creditcard.fill", title)
    assert.equal(resolveReminderIcon(title, "Work", "Spotify Premium").name, "creditcard.fill", `${title}: specific title wins`)
    assert.equal(resolveDueIcon(title, "custom", "music.note").name, "music.note", `${title}: existing manual choice`)
  }
})

test("hotel co-branded recommendations combine the card anchor with useful lodging alternatives", () => {
  for (const title of ["酒店信用卡年费", "酒店聯名信用卡年費", "Marriott Bonvoy card", "Hilton Amex renewal"]) {
    const result = names("creditcard.fill", null, { title, kind: "creditCard" })
    assert.equal(result[0], "creditcard.fill", title)
    includes(result, ["bed.double.circle.fill"], title)
    includesOne(result, ["building.2.crop.circle.fill", "key.horizontal.fill"], title)
    includesOne(result, ["creditcard.and.123", "wallet.pass.fill"], title)
    assert.ok(!result.includes("person.text.rectangle.fill"), `${title}: not an identity credential`)
  }
})

test("airline co-branded recommendations combine the card anchor with miles and departure alternatives", () => {
  for (const title of ["航空信用卡还款", "航班聯名信用卡年費", "Cathay Visa", "Cathay Visa renewal", "Delta Amex", "United credit card"]) {
    const result = names("creditcard.fill", null, { title, kind: "creditCard" })
    assert.equal(result[0], "creditcard.fill", title)
    includes(result, ["airplane.circle.fill"], title)
    includesOne(result, ["airplane", "airplane.departure"], title)
    includesOne(result, ["creditcard.and.123", "wallet.pass.fill"], title)
    assert.ok(!result.includes("bed.double.circle.fill"), `${title}: airline rather than hotel benefits`)
  }
})

test("general travel, rail and reward card purposes do not collapse into one recommendation list", () => {
  const titles = ["酒店信用卡", "航空信用卡", "旅行信用卡", "铁路信用卡", "返现信用卡", "积分信用卡"]
  const results = titles.map(title => names("creditcard.fill", null, { title, kind: "creditCard" }))
  assert.equal(new Set(results.map(result => result.join(","))).size, titles.length)
  includesOne(results[2], ["globe.europe.africa.fill", "globe.americas.fill", "map.fill", "suitcase.rolling.fill"], titles[2])
  includesOne(results[3], ["tram.circle.fill", "tram.fill", "train.side.front.car"], titles[3])
  includesOne(results[4], ["percent", "banknote.fill", "dollarsign.arrow.circlepath"], titles[4])
  includesOne(results[5], ["gift.fill", "star.fill", "crown.fill", "trophy.fill"], titles[5])
})

test("hotel booking recommendations are lodging-oriented without credit-card management", () => {
  for (const title of ["酒店预订", "飯店預訂", "hotel booking", "Hilton hotel booking"]) {
    const result = names("calendar.badge.clock", null, { title, kind: "custom" })
    assert.equal(result[0], "calendar.badge.clock", title)
    includes(result, ["bed.double.circle.fill"], title)
    includesOne(result, ["building.2.crop.circle.fill", "key.horizontal.fill"], title)
    assert.ok(!result.includes("creditcard.and.123"), `${title}: booking is not card management`)
  }
})

test("flight departure and arrival contexts recommend distinct travel actions", () => {
  const departure = names("airplane", null, { title: "flight departure", kind: "custom" })
  const arrival = names("airplane", null, { title: "flight arrival", kind: "custom" })
  assert.equal(departure[0], "airplane"); assert.equal(arrival[0], "airplane")
  includes(departure, ["airplane.departure"], "departure")
  includes(arrival, ["airplane.arrival"], "arrival")
  includesOne(departure, ["suitcase.cart.fill", "figure.seated.seatbelt"], "departure")
  assert.notDeepEqual(departure, arrival, "boarding and airport pickup should not share an undifferentiated ordering")
})

test("lounge access, baggage and sightseeing contexts expose relevant travel choices", () => {
  const lounge = names("calendar.badge.clock", null, { title: "机场贵宾室", kind: "custom" })
  includes(lounge, ["figure.seated.seatbelt"], "airport lounge")
  includesOne(lounge, ["airplane", "airplane.circle.fill", "wallet.pass.fill"], "airport lounge")
  assert.ok(!lounge.includes("creditcard.and.123"), "lounge access alone is not credit-card management")
  const baggage = names("suitcase.rolling.fill", null, { title: "行李托运", kind: "custom" })
  includes(baggage, ["suitcase.cart.fill"], "checked baggage")
  includesOne(baggage, ["airplane.departure", "airplane.arrival", "airplane"], "checked baggage")
  const sightseeing = names("calendar.badge.clock", null, { title: "景点观光", kind: "custom" })
  includes(sightseeing, ["binoculars.fill", "map.fill"], "sightseeing")
})

test("passport renewal recommends documents and verification rather than co-branded cards", () => {
  for (const title of ["护照换发", "護照續期", "passport renewal", "travel visa renewal"]) {
    const result = names("doc.text.image.fill", null, { title, kind: "creditCard" })
    assert.equal(result[0], "doc.text.image.fill", title)
    includesOne(result, ["person.text.rectangle.fill", "person.crop.circle.badge.checkmark", "lanyardcard.fill"], title)
    assert.ok(!result.includes("creditcard.and.123"), `${title}: document renewal is not payment-card management`)
    assert.ok(!result.includes("airplane.circle.fill"), `${title}: document is not airline miles`)
  }
})

test("identity and membership card recommendations expose verified native card alternatives", () => {
  const identity = names("person.text.rectangle.fill", null, { title: "身份证续期", kind: "credential" })
  includesOne(identity, ["person.crop.circle.badge.checkmark", "lanyardcard.fill"], "identity")
  const membership = names("person.crop.square.filled.and.at.rectangle", null, { title: "酒店會員卡", kind: "custom" })
  assert.equal(membership[0], "person.crop.square.filled.and.at.rectangle")
  includesOne(membership, ["lanyardcard.fill", "wallet.pass.fill", "crown.fill"], "membership")
  assert.ok(!membership.includes("creditcard.and.123"), "membership is not financial card management")
})

test("generic sleep, financial Visa and unrelated security scenes remain appropriate", () => {
  const sleep = names("bed.double.fill", null, { title: "sleep monitoring", kind: "subscription" })
  assert.equal(sleep[0], "bed.double.fill")
  assert.ok(!sleep.includes("bed.double.circle.fill"), "generic sleep is not hotel lodging")
  const visa = names("creditcard.fill", null, { title: "Visa Card renewal", kind: "credential" })
  includes(visa, ["creditcard.and.123"], "ordinary Visa card")
  assert.ok(!visa.includes("airplane.circle.fill"))
  assert.ok(!visa.includes("doc.text.image.fill"))
  const vpn = names("lock.shield.fill", null, { title: "VPN renewal", kind: "creditCard" })
  includes(vpn, ["key.fill", "network"], "VPN")
  assert.ok(!vpn.includes("creditcard.and.123"))
})

test("travel recommendations retain known anchors, catalog identities, stable order and immutable context", () => {
  const before = structuredClone(DUE_ICON_OPTIONS)
  const cases: Parameters<typeof recommendedSystemIcons>[] = [
    ["creditcard.fill", "music.note", Object.freeze({ title: "Marriott Bonvoy card", kind: "creditCard" })],
    ["creditcard.fill", "airplane", Object.freeze({ title: "Cathay Visa", kind: "reminder" })],
    ["calendar.badge.clock", "key.horizontal.fill", Object.freeze({ title: "hotel booking", kind: "custom" })],
    ["airplane", "airplane", Object.freeze({ title: "flight departure", kind: "custom" })],
    ["doc.text.image.fill", "wallet.pass.fill", Object.freeze({ title: "passport renewal", kind: "credential" })],
    ["future.airline.card", "wallet.pass.fill", Object.freeze({ title: "travel credit card renewal", kind: "custom" })],
    [undefined, null, Object.freeze({ title: "铁路信用卡", kind: "creditCard" })],
  ]
  for (const args of cases) {
    const snapshot = structuredClone(args), result = recommendedSystemIcons(...args)
    assert.equal(result.length, 8)
    assert.equal(new Set(result.map(icon => icon.name)).size, result.length)
    assert.ok(result.every(icon => DUE_ICON_OPTIONS.includes(icon)), "only known catalog definitions are returned")
    assert.deepEqual(recommendedSystemIcons(...args), result)
    const [automatic, selected] = args, knownAutomatic = DUE_ICON_OPTIONS.some(icon => icon.name === automatic)
    if (knownAutomatic) assert.equal(result[0].name, automatic)
    if (selected !== automatic && DUE_ICON_OPTIONS.some(icon => icon.name === selected)) assert.equal(result[knownAutomatic ? 1 : 0].name, selected)
    assert.deepEqual(args, snapshot, "preview does not change metadata or selection")
  }
  assert.deepEqual(DUE_ICON_OPTIONS, before, "travel enrichment preserves catalog definitions and order")
})

test("travel ranking and guarded card classification need no storage, reminder reads or network", () => {
  for (const file of ["travel_card_scenes.ts", "system_icon_recommendations.ts"]) {
    const source = readFileSync(new URL(`../到期管家/src/${file}`, import.meta.url), "utf8")
    assert.doesNotMatch(source, /\b(?:FileManager|Keychain|Storage|fetch|XMLHttpRequest)\b/, file)
    assert.doesNotMatch(source, /from\s+["'][^"']*(?:storage|reminders|notifications)[^"']*["']/, file)
  }
})

test("explicit non-credit cards ignore stale credit-card types in otherwise generic recommendations", () => {
  const cases = [
    { titles: ["SIM card", "Hilton SIM card", "旅行 SIM 卡", "手機卡"], symbol: "simcard.fill" },
    { titles: ["Hilton gift card", "gift card payment", "酒店礼品卡", "酒店禮品卡"], symbol: "gift.fill" },
    { titles: ["prepaid card", "stored value card", "储值卡", "預付卡"], symbol: "wallet.pass.fill" },
    { titles: ["rail pass", "railcard", "铁路交通卡", "鐵路交通卡"], symbol: "tram.circle.fill" },
    { titles: ["transit card", "transport pass", "交通卡", "公交卡"], symbol: "bus.fill" },
    { titles: ["Hilton membership card", "航空會員卡"], symbol: "lanyardcard.fill" },
  ]
  for (const { titles, symbol } of cases) for (const title of titles) {
    const result = names("calendar.badge.clock", null, { title, kind: "creditCard" })
    assert.equal(result[0], "calendar.badge.clock", title)
    includes(result, [symbol], title)
    assert.ok(!result.includes("creditcard.and.123"), `${title}: not credit-card management`)
    assert.ok(!result.includes("creditcard.trianglebadge.exclamationmark"), `${title}: not credit-card review`)
  }
})

test("recognized SIM and strong non-financial symbols do not become co-branded credit-card browsing", () => {
  const sim = names("simcard.fill", null, { title: "Hilton SIM card", kind: "creditCard" })
  includes(sim, ["simcard.fill", "iphone", "wifi"], "SIM")
  assert.ok(!sim.includes("creditcard.and.123"))
  const cases = [
    { automatic: "music.note", title: "Spotify Hilton card", expected: "headphones" },
    { automatic: "play.rectangle.fill", title: "Netflix hotel credit card", expected: "tv.fill" },
    { automatic: "lock.shield.fill", title: "hotel credit card", expected: "key.fill" },
    { automatic: "cross.case.fill", title: "airline credit card", expected: "stethoscope" },
    { automatic: "doc.text.image.fill", title: "Marriott Bonvoy card", expected: "person.crop.circle.badge.checkmark" },
    { automatic: "bed.double.fill", title: "hotel credit card", expected: "moon.zzz.fill" },
  ]
  for (const { automatic, title, expected } of cases) {
    const result = names(automatic, null, { title, kind: "creditCard" })
    assert.equal(result[0], automatic, title)
    includes(result, [expected], title)
    assert.ok(!result.includes("creditcard.and.123"), `${title}: specific automatic scene wins`)
    assert.ok(!result.includes("bed.double.circle.fill"), `${title}: no unrelated lodging benefits`)
  }
})
