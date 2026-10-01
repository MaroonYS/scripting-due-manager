// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { DUE_ICON_OPTIONS } from "../到期管家/src/icons.ts"
import { recommendedSystemIcons } from "../到期管家/src/system_icon_recommendations.ts"

const names = (...args: Parameters<typeof recommendedSystemIcons>) => recommendedSystemIcons(...args).map(icon => icon.name)
const includes = (actual: string[], expected: string[], title: string) => {
  for (const name of expected) assert.ok(actual.includes(name), `${title}: missing ${name} in ${actual.join(", ")}`)
}
const includesOne = (actual: string[], expected: string[], title: string) => {
  assert.ok(expected.some(name => actual.includes(name)), `${title}: expected one of ${expected.join(", ")} in ${actual.join(", ")}`)
}

test("savings titles refine a general payment icon with deposit and banking alternatives", () => {
  for (const title of ["存款到期", "儲蓄存款到期", "fixed deposit maturity"]) {
    const result = names("banknote.fill", null, { title, kind: "custom" })
    assert.equal(result[0], "banknote.fill")
    includes(result, ["dollarsign.square.fill"], title)
    includesOne(result, ["building.columns.fill", "building.columns.circle.fill"], title)
  }
})

test("investment titles refine a general financial icon with fund and portfolio alternatives", () => {
  for (const title of ["基金定投", "基金定期投資", "fund investment"]) {
    const result = names("creditcard.fill", null, { title, kind: "custom" })
    assert.equal(result[0], "creditcard.fill")
    includes(result, ["chart.line.uptrend.xyaxis"], title)
    includesOne(result, ["chart.xyaxis.line", "chart.bar.xaxis", "chart.pie.fill"], title)
    assert.ok(!result.includes("person.text.rectangle.fill"), `${title}: financial rather than identity alternatives`)
  }
})

test("loan repayment titles provide interest and payment alternatives instead of only card icons", () => {
  for (const title of ["房贷还款", "房貸還款", "mortgage repayment", "loan repayment"]) {
    const result = names("creditcard.fill", null, { title, kind: "repayment" })
    assert.equal(result[0], "creditcard.fill")
    includes(result, ["percent", "banknote.fill"], title)
    includesOne(result, ["plus.forwardslash.minus", "dollarsign.arrow.circlepath", "calendar"], title)
  }
})

test("qualified mortgage titles refine a house automatic icon without losing its anchor", () => {
  for (const title of ["房贷还款", "按揭還款", "mortgage repayment"]) {
    const result = names("house.fill", null, { title, kind: "custom" })
    assert.equal(result[0], "house.fill")
    includes(result, ["percent", "banknote.fill"], title)
    includesOne(result, ["dollarsign.arrow.circlepath", "plus.forwardslash.minus"], title)
    assert.ok(!result.includes("hammer.fill"), `${title}: repayment rather than home maintenance`)
  }
})

test("salary and reimbursement titles recommend receiving and settlement icons", () => {
  for (const title of ["工资入账", "工資入賬", "报销到账", "報銷到賬", "salary deposit", "reimbursement received"]) {
    const result = names("banknote.fill", null, { title, kind: "custom" })
    assert.equal(result[0], "banknote.fill")
    includes(result, ["arrow.down.circle.fill", "tray.and.arrow.down.fill"], title)
  }
})

test("invoice reconciliation titles provide bill documents and ledger checks", () => {
  for (const title of ["发票核对", "發票核對", "invoice reconciliation"]) {
    const result = names("banknote.fill", null, { title, kind: "custom" })
    assert.equal(result[0], "banknote.fill")
    includes(result, ["doc.plaintext.fill", "checkmark.rectangle.stack.fill"], title)
    includesOne(result, ["doc.text.fill", "doc.text.magnifyingglass"], title)
  }
})

test("bank management fee titles recommend institutions rather than a generic card-only scene", () => {
  for (const title of ["银行管理费", "銀行管理費", "bank account fee"]) {
    const result = names("creditcard.fill", null, { title, kind: "custom" })
    assert.equal(result[0], "creditcard.fill")
    includes(result, ["building.columns.fill", "building.columns.circle.fill"], title)
    includesOne(result, ["banknote.fill", "wallet.pass.fill"], title)
  }
})

test("credit card bills include card management and automatic payment choices", () => {
  for (const title of ["信用卡账单", "信用卡賬單", "credit card bill"]) {
    const result = names("creditcard.fill", null, { title, kind: "creditCard" })
    assert.equal(result[0], "creditcard.fill")
    includes(result, ["creditcard.and.123", "dollarsign.arrow.circlepath"], title)
    includesOne(result, ["doc.text.fill", "wallet.pass.fill", "building.columns.fill"], title)
    assert.ok(!result.includes("person.text.rectangle.fill"), `${title}: card is not an identity document`)
  }
})

test("transfers and currency exchange titles recommend transfers and currency or payment alternatives", () => {
  for (const title of ["转账换汇", "轉賬換匯", "bank transfer", "currency exchange"]) {
    const result = names("banknote.fill", null, { title, kind: "custom" })
    assert.equal(result[0], "banknote.fill")
    includes(result, ["arrow.left.arrow.right.circle.fill"], title)
    includesOne(result, ["arrow.up.circle.fill", "arrow.down.circle.fill", "dollarsign.circle.fill", "eurosign.circle.fill", "sterlingsign.circle.fill", "yensign.circle.fill"], title)
  }
})

test("insurance premium context refines a generic payment icon into policy coverage choices", () => {
  for (const title of ["保险保费", "保險保費", "insurance premium"]) {
    const result = names("banknote.fill", null, { title, kind: "insurance" })
    assert.equal(result[0], "banknote.fill")
    includes(result, ["shield.fill", "checkmark.shield.fill"], title)
    includesOne(result, ["doc.on.doc.fill", "calendar"], title)
  }
})

test("tax filing context provides accounting and documentary choices", () => {
  for (const title of ["税务申报", "稅務申報", "tax filing"]) {
    const result = names("banknote.fill", null, { title, kind: "custom" })
    assert.equal(result[0], "banknote.fill")
    includes(result, ["doc.text.magnifyingglass"], title)
    includesOne(result, ["doc.plaintext.fill", "doc.text.fill"], title)
  }
})

test("interest keeps its qualified savings or receiving purpose rather than implying a loan", () => {
  const cases = [
    { titles: ["定期存款利息", "定存利息", "fixed deposit interest"], expected: ["dollarsign.square.fill", "percent", "calendar"] },
    { titles: ["工资入账", "工資入帳", "利息入账", "利息入帳", "salary received", "interest income"], expected: ["arrow.down.circle.fill", "tray.and.arrow.down.fill"] },
  ]
  const failures: string[] = []
  for (const { titles, expected } of cases) for (const title of titles) {
    const result = names("banknote.fill", null, { title, kind: "custom" })
    assert.equal(result[0], "banknote.fill", title)
    for (const name of expected) if (!result.includes(name)) failures.push(`${title}: missing ${name}`)
  }
  assert.deepEqual(failures, [], failures.join("; "))
})

test("automatic debit follows a qualified mortgage or policy purpose, with a card fallback only when generic", () => {
  const cases = [
    { titles: ["房贷自动扣款", "房貸自動扣款", "mortgage autopay"], expected: ["banknote.fill", "percent", "dollarsign.arrow.circlepath"], excluded: ["creditcard.and.123"] },
    { titles: ["保险自动扣款", "保險自動扣款", "insurance autopay"], expected: ["shield.fill", "checkmark.shield.fill"], excluded: ["creditcard.and.123"] },
    { titles: ["自动扣款", "自動扣款", "autopay", "direct debit"], expected: ["creditcard.fill", "creditcard.and.123", "dollarsign.arrow.circlepath"], excluded: [] },
  ]
  const failures: string[] = []
  for (const { titles, expected, excluded } of cases) for (const title of titles) {
    const result = names("banknote.fill", null, { title, kind: "custom" })
    assert.equal(result[0], "banknote.fill", title)
    for (const name of expected) if (!result.includes(name)) failures.push(`${title}: missing ${name}`)
    for (const name of excluded) if (result.includes(name)) failures.push(`${title}: unrelated ${name}`)
  }
  assert.deepEqual(failures, [], failures.join("; "))
})

test("financial scenes do not collapse into one catch-all financial recommendation list", () => {
  const titles = ["存款到期", "基金定投", "房贷还款", "工资入账", "发票核对", "银行管理费", "信用卡账单", "转账换汇", "保险保费", "税务申报"]
  const lists = titles.map(title => names("banknote.fill", null, { title, kind: "custom" }))
  assert.ok(new Set(lists.map(result => result.join(","))).size >= 8, "specific financial jobs need distinct useful alternatives")
})

test("English finance scene matching is case-insensitive and NFKC-normalized", () => {
  for (const title of ["fixed deposit maturity", "fund investment", "mortgage repayment", "salary deposit", "invoice reconciliation", "bank account fee", "credit card bill", "currency exchange", "insurance premium", "tax filing"]) {
    const context = { title, kind: "custom" as const }
    const expected = names("banknote.fill", null, context)
    assert.deepEqual(names("banknote.fill", null, { ...context, title: title.toUpperCase() }), expected, title)
    const fullWidth = `　${title.replace(/[!-~]/g, char => String.fromCharCode(char.charCodeAt(0) + 0xfee0)).replace(/ /g, "　")}　`
    assert.deepEqual(names("banknote.fill", null, { ...context, title: fullWidth }), expected, title)
  }
})

test("qualified non-financial automatic scenes stay appropriate despite financial type metadata", () => {
  for (const kind of ["creditCard", "repayment", "insurance"] as const) {
    const vpn = names("lock.shield.fill", null, { title: "VPN renewal", kind })
    assert.equal(vpn[0], "lock.shield.fill")
    includes(vpn, ["key.fill", "network"], `VPN/${kind}`)
    assert.ok(!vpn.includes("creditcard.and.123"))
    const medical = names("cross.case.fill", null, { title: "体检预约", kind })
    assert.equal(medical[0], "cross.case.fill")
    includes(medical, ["stethoscope", "heart.text.square.fill"], `checkup/${kind}`)
    const passport = names("doc.text.image.fill", null, { title: "護照續期", kind })
    assert.equal(passport[0], "doc.text.image.fill")
    includesOne(passport, ["person.text.rectangle.fill", "person.crop.rectangle.fill"], `passport/${kind}`)
    assert.ok(!passport.includes("creditcard.and.123"))
  }
})

test("Visa payment cards and software licence expiry do not become identity documents", () => {
  const visa = names("creditcard.fill", null, { title: "Visa Card renewal", kind: "credential" })
  assert.equal(visa[0], "creditcard.fill")
  includesOne(visa, ["wallet.pass.fill", "building.columns.fill", "creditcard.and.123"], "Visa Card")
  assert.ok(!visa.includes("person.text.rectangle.fill"))
  assert.ok(!visa.includes("doc.text.image.fill"))
  for (const title of ["software license expiry", "軟件許可證到期"]) {
    const software = names("calendar.badge.clock", null, { title, kind: "creditCard" })
    assert.equal(software[0], "calendar.badge.clock")
    includes(software, ["globe", "network", "terminal.fill"], title)
    assert.ok(!software.includes("person.text.rectangle.fill"))
    assert.ok(!software.includes("creditcard.and.123"))
  }
})

test("financial recommendation previews retain anchors, known objects, stable order and immutable inputs", () => {
  const before = structuredClone(DUE_ICON_OPTIONS)
  const examples: Parameters<typeof recommendedSystemIcons>[] = [
    ["creditcard.fill", "music.note", Object.freeze({ title: "基金定投", kind: "custom" })],
    ["banknote.fill", "doc.text.image.fill", Object.freeze({ title: "工资入账", kind: "reminder" })],
    ["creditcard.fill", "creditcard.fill", Object.freeze({ title: "房贷还款", kind: "repayment" })],
    ["future.symbol.fill", "wallet.pass.fill", Object.freeze({ title: "存款到期", kind: "custom" })],
    [undefined, null, Object.freeze({ title: "发票核对", kind: "custom" })],
    ["creditcard.and.123", "tray.and.arrow.down.fill", Object.freeze({ title: "信用卡账单", kind: "creditCard" })],
  ]
  for (const args of examples) {
    const snapshot = structuredClone(args)
    const result = recommendedSystemIcons(...args)
    assert.equal(result.length, 8)
    assert.equal(new Set(result.map(icon => icon.name)).size, 8)
    assert.ok(result.every(icon => DUE_ICON_OPTIONS.includes(icon)), "recommendations return actual catalog definitions")
    assert.deepEqual(recommendedSystemIcons(...args), result, "repeated preview retains deterministic ordering")
    const [automatic, selected] = args
    const automaticKnown = DUE_ICON_OPTIONS.some(icon => icon.name === automatic)
    if (automaticKnown) assert.equal(result[0].name, automatic)
    if (selected !== automatic && DUE_ICON_OPTIONS.some(icon => icon.name === selected)) assert.equal(result[automaticKnown ? 1 : 0].name, selected)
    assert.deepEqual(args, snapshot, "context and current selection are read-only")
  }
  assert.deepEqual(DUE_ICON_OPTIONS, before, "financial ranking preserves existing catalog data and order")
})

test("the pure recommendation module has no persistence, reminder reads or network calls", () => {
  const source = readFileSync(new URL("../到期管家/src/system_icon_recommendations.ts", import.meta.url), "utf8")
  assert.doesNotMatch(source, /\b(?:FileManager|Keychain|Storage|fetch|XMLHttpRequest)\b/)
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:storage|reminders|notifications)[^"']*["']/)
})
