// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import test from "node:test"
import { resolveDueIcon, resolveReminderIcon } from "../到期管家/src/icons.ts"
import { travelCardScene } from "../到期管家/src/travel_card_scenes.ts"

test("loyalty points remain a benefit of a qualified payment card", () => {
  assert.equal(travelCardScene("Hilton credit card loyalty points"), "hotelCard")
  assert.equal(travelCardScene("航空信用卡积分"), "airlineCard")
  assert.equal(travelCardScene("酒店信用卡會員積分"), "hotelCard")
  assert.equal(travelCardScene("loyalty points"), null)
})

test("specific document and non-payment-card terms override stale payment type", () => {
  for (const title of ["Hilton residence card", "Hilton driving licence renewal", "United States", "Delta Dental", "旅行 SIM 卡", "Hilton prepaid card", "Hilton stored-value card", "旅行駕駛證", "酒店储值卡", "酒店預付卡"]) {
    assert.equal(travelCardScene(title, "creditCard"), null, title)
  }
})

test("additional co-brands require financial evidence outside a payment type", () => {
  for (const title of ["Hyatt", "IHG", "雅高", "Asia Miles", "ANA", "JAL", "Avios", "MileagePlus"]) {
    assert.equal(travelCardScene(title), null, title)
    assert.ok(travelCardScene(`${title} credit card`), title)
    assert.ok(travelCardScene(title, "creditCard"), title)
  }
  assert.equal(travelCardScene("ANAlysis credit card"), null)
  assert.equal(travelCardScene("JALapeño credit card"), null)
})

test("plain hotel and airline actions are not financial evidence", () => {
  for (const title of ["hotel booking", "Hilton hotel reservation", "Cathay flight arrival", "酒店預訂", "航班起飛", "travel visa application", "Cathay travel visa renewal", "Cathay visa application", "Cathay visa appointment", "Visa renewal"]) {
    assert.equal(travelCardScene(title), null, title)
    assert.equal(travelCardScene(title, "creditCard"), null, title)
  }
})

test("all six qualified purposes automatically remain payment cards", () => {
  for (const title of ["Hyatt credit card", "Avios credit card", "Cathay Visa renewal", "Hilton Visa renewal", "travel credit card", "Amtrak credit card", "cash back credit card", "rewards credit card"]) {
    assert.equal(resolveDueIcon(title, "custom").name, "creditcard.fill", title)
    assert.equal(resolveReminderIcon(title, "Travel", "Spotify Premium", "music.note", "strong").name, "creditcard.fill", title)
    assert.equal(resolveDueIcon(title, "custom", "wallet.pass.fill").name, "wallet.pass.fill", title)
  }
})

test("typed bare co-brands use card identity without changing generic brand inference", () => {
  assert.equal(resolveDueIcon("Hilton", "creditCard").name, "creditcard.fill")
  assert.equal(resolveDueIcon("Cathay", "creditCard").name, "creditcard.fill")
  assert.equal(resolveDueIcon("Hilton", "custom").name, "calendar.badge.clock")
  assert.equal(resolveReminderIcon("Hilton", "Travel").name, "suitcase.rolling.fill")
})

test("specific service subjects retain their identity when mentioning a co-branded payment method", () => {
  const cases: readonly [string, string][] = [
    ["Spotify Premium Hilton Amex payment", "music.note"],
    ["Netflix Hilton card renewal", "play.rectangle.fill"],
    ["NordVPN Hilton Amex payment", "lock.shield.fill"],
    ["VPN subscription Hilton card renewal", "lock.shield.fill"],
    ["SSL certificate Hilton Amex payment", "globe"],
    ["1Password Hilton card renewal", "key.fill"],
    ["GitHub Copilot Hilton Amex payment", "sparkles"],
  ]
  for (const [title, icon] of cases) {
    assert.equal(resolveDueIcon(title, "custom").name, icon, title)
    assert.equal(resolveDueIcon(title, "creditCard").name, icon, title)
    assert.equal(resolveReminderIcon(title, "Credit Cards").name, icon, title)
  }
})
