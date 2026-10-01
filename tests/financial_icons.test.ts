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

const FINANCIAL_ICONS = [
  ["creditcard.and.123", "卡片管理", "卡片管理", "Card Management"],
  ["creditcard.trianglebadge.exclamationmark", "卡片检查", "卡片檢查", "Card Review"],
  ["dollarsign.arrow.circlepath", "自动扣款", "自動扣款", "Automatic Payments"],
  ["dollarsign.square.fill", "储蓄存款", "儲蓄存款", "Savings & Deposits"],
  ["chart.xyaxis.line", "基金净值", "基金淨值", "Fund Values"],
  ["chart.line.downtrend.xyaxis", "行情波动", "行情波動", "Market Movements"],
  ["chart.bar.xaxis", "资产配置", "資產配置", "Asset Allocation"],
  ["building.columns.circle.fill", "金融机构", "金融機構", "Financial Institutions"],
  ["checkmark.rectangle.stack.fill", "账目核对", "帳目核對", "Account Reconciliation"],
  ["plus.forwardslash.minus", "利息计算", "利息計算", "Interest Calculations"],
  ["doc.plaintext.fill", "发票凭证", "發票憑證", "Invoices & Receipts"],
  ["tray.and.arrow.down.fill", "结算到账", "結算到帳", "Settlement & Deposits"],
] as const

const names = (query: string) => searchSystemIcons(query).map(icon => icon.name)
const includes = (query: string, expected: readonly string[]) => {
  const actual = names(query)
  for (const name of expected) assert.ok(actual.includes(name), `${query}: missing ${name} in ${actual.join(", ")}`)
  assert.equal(new Set(actual).size, actual.length)
  assert.deepEqual(actual, DUE_ICON_OPTIONS.filter(icon => actual.includes(icon.name)).map(icon => icon.name), "search retains catalog order")
}

test("financial enrichment appends twelve native symbols and preserves every original catalog definition", () => {
  assert.equal(DUE_ICON_OPTIONS.length, 216)
  assert.equal(new Set(DUE_ICON_OPTIONS.map(icon => icon.name)).size, 216)
  assert.deepEqual(DUE_ICON_OPTIONS.slice(188, 200).map(icon => icon.name), FINANCIAL_ICONS.map(([name]) => name))
  assert.equal(createHash("sha256").update(JSON.stringify(DUE_ICON_OPTIONS.slice(0, 188))).digest("hex"),
    "d13888470bbd8d164fd66a288e2de34a5517bac68e5bde9c0d34dd854b64e65d", "the existing 188 names, labels, colors and order are unchanged")
})

test("every added financial symbol has complete readable labels and is a valid local SF choice", () => {
  for (const [name, simplified, traditional, english] of FINANCIAL_ICONS) {
    const definition = DUE_ICON_OPTIONS.find(icon => icon.name === name)!
    assert.equal(definition.group, "财务")
    assert.match(definition.color, /^system(?:Orange|Teal|Green|Blue|Indigo|Purple|Pink)$/)
    assert.equal(dueIconLabel(name, "zh-Hans"), simplified)
    assert.equal(dueIconLabel(name, "zh-Hant"), traditional)
    assert.equal(dueIconLabel(name, "en"), english)
    assert.equal(normalizeIconOverride(name), name)
    assert.ok(isKnownIconChoice(`sf:${name}`))
    assert.equal(symbolChoice(`sf:${name}`), definition)
    assert.deepEqual(normalizeItemIconChoices([{ source: "reminder", itemID: "financial-test", iconID: `sf:${name}` }]),
      [{ source: "reminder", itemID: "financial-test", iconID: `sf:${name}` }])
  }
})

test("savings and deposit search recognizes simplified, traditional, English and bank-qualified phrases", () => {
  for (const query of ["储蓄", "儲蓄", "定期存款", "定存到期", "银行 定期存款", "銀行 定期存款", "time deposit", "fixed deposit", "deposit maturity", "HSBC savings", "ＢＯＣ　ｓａｖｉｎｇｓ"]) {
    includes(query, ["dollarsign.square.fill"])
  }
})

test("funds, dividends and portfolios have relevant searchable alternatives without claiming performance", () => {
  for (const query of ["基金 净值", "基金 淨值", "net asset value", "fund value", "基金分红", "基金分紅", "bond dividend", "IBKR fund"]) includes(query, ["chart.xyaxis.line"])
  for (const query of ["资产配置", "資產配置", "asset allocation", "stock portfolio", "bond holdings", "Futu portfolio"]) includes(query, ["chart.bar.xaxis"])
  for (const query of ["行情 波动", "行情 波動", "market volatility", "stock drawdown", "富途 行情"]) includes(query, ["chart.line.downtrend.xyaxis"])
  includes("股票 股息", ["chart.line.uptrend.xyaxis"])
})

test("salary, reimbursement, invoice and reconciliation search works across languages", () => {
  for (const query of ["工资 到账", "工資 到帳", "salary", "payroll", "报销", "報銷", "tax refund", "dividend payout"]) includes(query, ["tray.and.arrow.down.fill"])
  for (const query of ["发票 凭证", "發票 憑證", "报销 凭证", "報銷 憑證", "expense claim", "tax invoice", "e-invoice"]) includes(query, ["doc.plaintext.fill"])
  for (const query of ["对账", "對賬", "對帳", "账目 核对", "帳目 核對", "bank reconciliation", "statement review"]) includes(query, ["checkmark.rectangle.stack.fill"])
})

test("card fees, statement dates, installments, autopay and interest have targeted alternatives", () => {
  for (const query of ["信用卡 年费", "信用卡 年費", "card annual fee", "Visa card statement", "还款日", "還款日", "debit card", "installment"]) includes(query, ["creditcard.and.123"])
  for (const query of ["卡片 核对", "卡片 核對", "statement review", "annual fee review", "credit limit"]) includes(query, ["creditcard.trianglebadge.exclamationmark"])
  for (const query of ["自动还款", "自動還款", "自动缴费", "自動繳費", "直接扣款", "autopay", "direct debit", "recurring payment", "standing order"]) includes(query, ["dollarsign.arrow.circlepath"])
  for (const query of ["房贷 利息", "房貸 利息", "贷款 利率", "貸款 利率", "mortgage interest", "loan amortization", "APR", "installment principal"]) includes(query, ["plus.forwardslash.minus"])
  includes("loan repayment", ["percent", "banknote.fill"])
})

test("bank, payment network and broker brands are searchable category aliases rather than branded images", () => {
  for (const query of ["HSBC", "匯豐", "BOC", "ICBC", "CMB", "CCB", "建行", "农行", "農行", "招商", "渣打", "恒生", "恆生", "Hang Seng"]) includes(query, ["building.columns.fill", "building.columns.circle.fill"])
  for (const query of ["Visa", "Mastercard", "Amex", "American Express", "银联", "銀聯", "UnionPay"]) includes(query, ["creditcard.fill", "creditcard.and.123"])
  for (const query of ["富途", "Futu", "Moomoo", "老虎", "Tiger Brokers", "IBKR", "Interactive Brokers", "盈透"]) includes(query, ["chart.xyaxis.line", "chart.bar.xaxis", "building.columns.circle.fill"])
  for (const query of ["Alipay", "支付宝", "支付寶", "WeChat Pay", "微信支付", "PayPal", "Wise", "Revolut"]) includes(query, ["arrow.left.arrow.right.circle.fill", "wallet.pass.fill"])
})

test("tax, insurance, remittance, FX and settlement search extends existing financial symbols", () => {
  for (const query of ["所得税", "所得稅", "报税", "報稅", "income tax", "tax assessment"]) includes(query, ["doc.text.magnifyingglass"])
  for (const query of ["保费", "保費", "insurance premium", "premium payment"]) includes(query, ["shield.fill"])
  for (const query of ["汇款", "匯款", "外汇", "外匯", "汇率", "匯率", "remittance", "foreign exchange", "FX", "exchange rate", "settlement"]) includes(query, ["arrow.left.arrow.right.circle.fill"])
  includes("settlement payout", ["tray.and.arrow.down.fill"])
})

test("financial search preserves AND, NFKC and two-letter boundaries and remains read-only", () => {
  const catalog = structuredClone(DUE_ICON_OPTIONS)
  assert.deepEqual(names("ＨＳＢＣ　ＳＡＶＩＮＧＳ"), names("hsbc savings"))
  assert.deepEqual(names("　ＦＸ　"), names("fx"))
  assert.deepEqual(names("AI"), ["sparkles"])
  assert.deepEqual(names("ＡＩ"), ["sparkles"])
  assert.ok(names("ID").includes("person.text.rectangle.fill"))
  assert.deepEqual(names("swimming mortgage"), [])
  assert.deepEqual(names("settlement invoice"), [])
  assert.deepEqual(names("unrelated-financial-query-847291"), [])
  assert.deepEqual(DUE_ICON_OPTIONS, catalog)
  assert.deepEqual(searchSystemIcons(""), DUE_ICON_OPTIONS)
  assert.notEqual(searchSystemIcons(""), DUE_ICON_OPTIONS)
})

test("search-only financial phrases never broaden title or private-note inference", () => {
  for (const title of ["储蓄研究", "基金净值研究", "股息计划", "Salary planning", "invoice research", "Loan research", "对账研究", "card annual fee", "BOC analysis", "ICBC research", "CMB ideas", "Wise ideas", "IBKR ideas", "bocage trip", "Wiseacre essays"]) {
    assert.equal(resolveDueIcon(title, "custom").name, "calendar.badge.clock", title)
    assert.equal(resolveReminderIcon(title, "Work").name, "briefcase.fill", title)
    assert.equal(inferReminderNoteIconCandidate(title), null, title)
  }
})

test("existing specific financial and visa inference stays unchanged and all manual choices still take precedence", () => {
  for (const [title, expected] of [
    ["Visa Card annual fee", "creditcard.fill"], ["Visa renewal", "doc.text.image.fill"],
    ["Amex analysis", "creditcard.fill"], ["Mastercard renewal", "creditcard.fill"],
    ["HSBC analysis", "building.columns.fill"], ["Revolut research", "building.columns.fill"],
    ["支付宝汇款", "arrow.left.arrow.right.circle.fill"], ["WeChat Pay transfer", "arrow.left.arrow.right.circle.fill"],
    ["paypal renewal", "arrow.left.arrow.right.circle.fill"], ["富途研究", "chart.line.uptrend.xyaxis"],
    ["HSBCat newsletter", "newspaper.fill"],
  ]) {
    assert.equal(resolveDueIcon(title, "custom").name, expected, title)
    assert.equal(resolveReminderIcon(title, "Work").name, expected, title)
    assert.deepEqual(inferReminderNoteIconCandidate(title), { iconName: expected, confidence: "strong" }, title)
    for (const [name] of FINANCIAL_ICONS) assert.equal(resolveDueIcon(title, "custom", name).name, name)
    assert.equal(resolveDueIcon(title, "custom", "wallet.pass.fill").name, "wallet.pass.fill")
  }
})

function storageEnvironment() {
  const previous = (globalThis as any).Storage
  const item: ManualDueItem = {
    id: "same-id", title: "Monthly", kind: "creditCard", iconName: "car.fill", dueDate: "2026-10-15",
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

test("all twelve financial choices save and survive backup with dates, notes, completion history and old selections intact", () => {
  for (const [name] of FINANCIAL_ICONS) {
    const env = storageEnvironment()
    try {
      const next = storage.updateManualItemIcon(env.item.id, name, env.item.updatedAt, "sf:wallet.pass.fill")
      assert.deepEqual(next.items[0], { ...env.item, iconName: name, updatedAt: 3 })
      assert.deepEqual(next.items[1], env.state.items[1])
      assert.deepEqual(next.completionHistory, env.state.completionHistory)
      assert.equal(itemIconID(next.settings, "manual", env.item.id), null)
      assert.equal(itemIconID(next.settings, "reminder", env.item.id), "sf:music.note", "editing manual appearance does not touch the same Reminder ID")
      const chosen = storage.updateItemIconChoice("reminder", env.item.id, { iconID: `sf:${name}`, expectedIconID: "sf:music.note" })
      assert.deepEqual(chosen.items, next.items, "Reminder appearance save does not modify manual item data")
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
