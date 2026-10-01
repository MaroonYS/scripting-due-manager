// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { DUE_ICON_OPTIONS } from "./icons"
import type { DueIconDefinition } from "./icons"
import type { ItemKind } from "./types"

export interface SystemIconContext { title?: string; kind?: ItemKind | "reminder" }

// Related actions, not adjacent positions in the full catalog. No user content is stored.
const SCENE_ICONS = {
  security: ["lock.shield.fill", "key.fill", "shield.lefthalf.filled", "network", "lock.doc.fill", "server.rack", "wifi", "checkmark.shield.fill"],
  vehicle: ["car.fill", "wrench.adjustable.fill", "shield.fill", "parkingsign.circle.fill", "fuelpump.fill", "bolt.car.fill", "wrench.and.screwdriver.fill", "calendar"],
  credentials: ["person.text.rectangle.fill", "doc.text.image.fill", "checkmark.seal.fill", "doc.on.doc.fill", "signature", "calendar", "person.crop.rectangle.fill", "lock.doc.fill"],
  housing: ["house.fill", "doc.text.fill", "bolt.fill", "drop.fill", "flame.fill", "wifi", "hammer.fill", "wrench.and.screwdriver.fill"],
  credit: ["creditcard.fill", "creditcard.and.123", "building.columns.fill", "wallet.pass.fill", "dollarsign.arrow.circlepath", "doc.text.fill", "creditcard.trianglebadge.exclamationmark", "calendar"],
  banking: ["building.columns.fill", "building.columns.circle.fill", "dollarsign.square.fill", "creditcard.and.123", "wallet.pass.fill", "arrow.left.arrow.right.circle.fill", "banknote.fill", "lock.doc.fill"],
  savings: ["dollarsign.square.fill", "building.columns.fill", "percent", "calendar", "banknote.fill", "tray.and.arrow.down.fill", "arrow.down.circle.fill", "lock.doc.fill"],
  investment: ["chart.xyaxis.line", "chart.line.uptrend.xyaxis", "chart.bar.xaxis", "chart.pie.fill", "chart.line.downtrend.xyaxis", "chart.bar.fill", "building.columns.fill", "calendar"],
  loan: ["banknote.fill", "percent", "dollarsign.arrow.circlepath", "calendar", "house.fill", "doc.text.fill", "plus.forwardslash.minus", "building.columns.fill"],
  billing: ["doc.plaintext.fill", "checkmark.rectangle.stack.fill", "doc.text.fill", "chart.bar.fill", "chart.pie.fill", "banknote.fill", "plus.forwardslash.minus", "calendar"],
  transfer: ["arrow.left.arrow.right.circle.fill", "banknote.fill", "arrow.up.circle.fill", "arrow.down.circle.fill", "yensign.circle.fill", "eurosign.circle.fill", "sterlingsign.circle.fill", "dollarsign.circle.fill"],
  income: ["arrow.down.circle.fill", "tray.and.arrow.down.fill", "banknote.fill", "building.columns.fill", "dollarsign.square.fill", "doc.plaintext.fill", "checkmark.rectangle.stack.fill", "calendar"],
  tax: ["doc.text.magnifyingglass", "doc.plaintext.fill", "dollarsign.circle.fill", "percent", "plus.forwardslash.minus", "checkmark.rectangle.stack.fill", "building.columns.fill", "calendar"],
  insurance: ["shield.fill", "checkmark.shield.fill", "doc.on.doc.fill", "calendar", "house.fill", "car.fill", "cross.case.fill", "banknote.fill"],
  medical: ["stethoscope", "cross.case.fill", "mouth.fill", "calendar", "heart.text.square.fill", "syringe.fill", "pills.fill", "eye.fill"],
  medication: ["pills.fill", "alarm.fill", "calendar", "clock.fill", "stethoscope", "cross.case.fill", "heart.text.square.fill", "syringe.fill"],
  swimming: ["figure.pool.swim", "figure.run", "figure.yoga", "dumbbell.fill", "calendar", "heart.text.square.fill", "bicycle", "trophy.fill"],
  yoga: ["figure.yoga", "figure.mind.and.body", "dumbbell.fill", "calendar", "heart.text.square.fill", "figure.run", "leaf.fill", "figure.pool.swim"],
  digital: ["desktopcomputer", "globe", "server.rack", "network", "icloud.fill", "lock.shield.fill", "terminal.fill", "calendar"],
  entertainment: ["play.rectangle.fill", "music.note", "headphones", "tv.fill", "gamecontroller.fill", "ticket.fill", "repeat.circle.fill", "crown.fill"],
} as const
type Scene = keyof typeof SCENE_ICONS
const FINANCIAL_SCENES = new Set<Scene>(["credit", "banking", "savings", "investment", "loan", "billing", "transfer", "income", "tax", "insurance"])

const SYMBOL_SCENES = new Map<string, Scene>([
  ...["lock.shield.fill", "key.fill", "shield.lefthalf.filled", "lock.doc.fill"].map(name => [name, "security"] as const),
  ...["car.fill", "car.side.fill", "wrench.adjustable.fill", "parkingsign.circle.fill", "fuelpump.fill", "bolt.car.fill"].map(name => [name, "vehicle"] as const),
  ...["person.text.rectangle.fill", "doc.text.image.fill", "checkmark.seal.fill", "person.crop.rectangle.fill", "doc.on.doc.fill", "signature"].map(name => [name, "credentials"] as const),
  ...["house.fill", "bolt.fill", "drop.fill", "flame.fill", "hammer.fill"].map(name => [name, "housing"] as const),
  ...["creditcard.fill", "wallet.pass.fill", "creditcard.and.123", "creditcard.trianglebadge.exclamationmark"].map(name => [name, "credit"] as const),
  ...["building.columns.fill", "building.columns.circle.fill"].map(name => [name, "banking"] as const),
  ["dollarsign.square.fill", "savings"],
  ...["chart.xyaxis.line", "chart.line.uptrend.xyaxis", "chart.line.downtrend.xyaxis", "chart.pie.fill", "chart.bar.xaxis", "bitcoinsign.circle.fill"].map(name => [name, "investment"] as const),
  ...["percent", "dollarsign.arrow.circlepath", "plus.forwardslash.minus"].map(name => [name, "loan"] as const),
  ...["banknote.fill", "doc.plaintext.fill", "checkmark.rectangle.stack.fill", "chart.bar.fill"].map(name => [name, "billing"] as const),
  ...["arrow.left.arrow.right.circle.fill", "arrow.up.circle.fill", "sterlingsign.circle.fill", "yensign.circle.fill", "eurosign.circle.fill"].map(name => [name, "transfer"] as const),
  ...["arrow.down.circle.fill", "tray.and.arrow.down.fill"].map(name => [name, "income"] as const),
  ...["doc.text.magnifyingglass", "dollarsign.circle.fill"].map(name => [name, "tax"] as const),
  ...["shield.fill", "checkmark.shield.fill"].map(name => [name, "insurance"] as const),
  ...["stethoscope", "cross.case.fill", "mouth.fill", "syringe.fill", "eye.fill", "heart.text.square.fill"].map(name => [name, "medical"] as const),
  ["pills.fill", "medication"], ["figure.pool.swim", "swimming"], ["figure.yoga", "yoga"],
  ...["globe", "server.rack", "network", "icloud.fill", "externaldrive.fill", "desktopcomputer", "terminal.fill", "curlybraces.square.fill", "sparkles", "square.grid.2x2.fill", "puzzlepiece.extension.fill"].map(name => [name, "digital"] as const),
  ...["play.rectangle.fill", "music.note", "headphones", "tv.fill", "gamecontroller.fill"].map(name => [name, "entertainment"] as const),
])

// Browsing context only: no financial status, account data or inference is changed.
function financialTitleScene(title: string): Scene | null {
  if (/信用卡|借记卡|借記卡|卡账单|卡賬單|卡帳單|银行卡激活|銀行卡啟用|\b(?:credit|debit|visa|mastercard|amex)\s+(?:card|bill|payment)\b|\bcard\s+(?:bill|payment|annual fee|statement)\b/.test(title)) return "credit"
  if (/房贷|房貸|按揭|贷款|貸款|还贷|還貸|分期|\b(?:loan|mortgage|repayment|instalments?|installments?)\b/.test(title)) return "loan"
  if (/保费|保費|保单|保單|保险|保險|\b(?:insurance|premiums?)\b/.test(title)) return "insurance"
  if (/报税|報稅|缴税|繳稅|税费|稅費|税务|稅務|\btax(?:es)?\b/.test(title)) return "tax"
  if (/换汇|換匯|汇款|匯款|转账|轉賬|轉帳|汇率|匯率|外汇|外匯|\b(?:remittance|forex|fx)\b|\b(?:money transfer|bank transfer|currency exchange|exchange rate)\b/.test(title)) return "transfer"
  if (/工资|工資|薪资|薪資|薪水|报销|報銷|分红|分紅|股息|派息|收款|入账|入賬|入帳|结算到账|結算到賬|結算到帳|\b(?:salary|payroll|reimbursement|dividends?|income|settlement)\b/.test(title)) return "income"
  if (/储蓄|儲蓄|存款|存单|存單|定存|\bsavings\b|\b(?:fixed deposit|time deposit|certificate of deposit)\b/.test(title)) return "savings"
  if (/基金|股票|证券|證券|债券|債券|定投|理财|理財|投资|投資|资产配置|資產配置|\b(?:funds?|stocks?|bonds?|etf|portfolio|brokerage|investment)\b/.test(title)) return "investment"
  if (/自动扣款|自動扣款|自动付款|自動付款|\b(?:autopay|direct debit)\b/.test(title)) return "credit"
  if (/发票|發票|账单|賬單|帳單|账目|賬目|帳目|对账|對賬|對帳|记账|記賬|記帳|收支|缴费|繳費|付款|支付|\b(?:invoices?|reconciliation|reconcile|expenses?|budget|statement|payments?)\b/.test(title)) return "billing"
  if (/银行|銀行|金融机构|金融機構|\b(?:banking|hsbc|icbc|boc|cmb)\b|\b(?:bank account|bank fee|checking account)\b/.test(title)) return "banking"
  if (/利息|利率|\b(?:interest|apr)\b/.test(title)) return "loan"
  return null
}

function contextScene(context: SystemIconContext): Scene | null {
  const title = (context.title ?? "").normalize("NFKC").toLowerCase()
  if (/\b(?:vpn|password|privacy)\b|密码|密碼|网络安全|網絡安全/.test(title)) return "security"
  if (/\b(?:car|vehicle|parking)\b|车辆|車輛|汽车|汽車|车险|車險|年检|年檢|停车|停車/.test(title)) return "vehicle"
  if (/\b(?:software|app|saas|ssl|tls)\b|软件|軟件|数字服务|數字服務/.test(title)) return "digital"
  if (/\bpassport\b|\b(?:visa|licen[cs]e|certificate)\s+(?:renewal|expiry)\b|护照|護照|驾照|駕照|驾驶证|駕駛證|证件|證件|合同|资格证|資格證|证书|證書/.test(title)) return "credentials"
  if (/\bswim(?:ming)?\b|游泳|泳课|泳課/.test(title)) return "swimming"
  if (/\byoga\b|瑜伽/.test(title)) return "yoga"
  if (/房租|物业|物業|水费|水費|电费|電費|燃气|燃氣|\b(?:rent|utilities)\b/.test(title)) return "housing"
  if (/复诊|複診|復診|牙科|牙医|牙醫|体检|體檢|\b(?:dental|checkup)\b/.test(title)) return "medical"
  if (/服药|服藥|处方|處方|\bmedication\b/.test(title)) return "medication"
  const financial = financialTitleScene(title)
  if (financial) return financial
  if (context.kind === "creditCard") return "credit"
  if (context.kind === "repayment") return "loan"
  if (context.kind === "bill") return "billing"
  if (context.kind === "insurance") return "insurance"
  if (context.kind === "credential") return "credentials"
  return null
}

/** Automatic and existing choices stay first; unknown future symbols are never offered. */
export function recommendedSystemIcons(automaticName?: string, selectedName?: string | null,
  context: SystemIconContext = {}): DueIconDefinition[] {
  const automatic = DUE_ICON_OPTIONS.find(icon => icon.name === automaticName)
  const automaticScene = SYMBOL_SCENES.get(automaticName ?? "")
  const contextualScene = contextScene(context)
  // A specific financial purpose refines a broad money symbol. Strong non-finance
  // scenes still win; only housing + a mortgage/loan purpose is an explicit bridge.
  const refineFinance = contextualScene && FINANCIAL_SCENES.has(contextualScene)
    && (!automaticScene || FINANCIAL_SCENES.has(automaticScene)
      || (automaticName === "house.fill" && contextualScene === "loan"))
  const scene = refineFinance ? contextualScene : automaticScene ?? contextualScene
  const names = [automaticName, selectedName, ...(scene ? SCENE_ICONS[scene] : []),
    ...DUE_ICON_OPTIONS.filter(icon => icon.group === automatic?.group).map(icon => icon.name),
    "calendar.badge.clock", "repeat.circle.fill", "creditcard.fill", "checklist", "bell.fill", "tag.fill", "gift.fill", "heart.fill"]
  return [...new Set(names)].flatMap(name => {
    const icon = DUE_ICON_OPTIONS.find(candidate => candidate.name === name)
    return icon ? [icon] : []
  }).slice(0, 8)
}
