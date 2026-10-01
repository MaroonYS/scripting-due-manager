// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { DUE_ICON_OPTIONS } from "./icons"
import type { DueIconDefinition, DueIconGroup } from "./icons"
import { travelCardScene } from "./travel_card_scenes"
import type { ItemKind } from "./types"

export interface SystemIconContext { title?: string; kind?: ItemKind | "reminder" }

// Related actions, not adjacent positions in the full catalog. No user content is stored.
const SCENE_ICONS = {
  security: ["lock.shield.fill", "key.fill", "shield.lefthalf.filled", "network", "lock.doc.fill", "server.rack", "wifi", "checkmark.shield.fill"],
  vehicle: ["car.fill", "wrench.adjustable.fill", "shield.fill", "parkingsign.circle.fill", "fuelpump.fill", "bolt.car.fill", "wrench.and.screwdriver.fill", "calendar"],
  credentials: ["person.text.rectangle.fill", "doc.text.image.fill", "person.crop.circle.badge.checkmark", "lanyardcard.fill", "calendar", "checkmark.seal.fill", "doc.on.doc.fill", "person.crop.rectangle.fill", "signature", "lock.doc.fill"],
  membership: ["person.crop.square.filled.and.at.rectangle", "lanyardcard.fill", "wallet.pass.fill", "crown.fill", "person.crop.circle.badge.checkmark", "qrcode", "tag.fill", "ticket.fill"],
  sim: ["simcard.fill", "iphone", "antenna.radiowaves.left.and.right", "personalhotspot", "wifi", "network", "qrcode", "globe"],
  giftPass: ["gift.fill", "wallet.pass.fill", "ticket.fill", "tag.fill", "qrcode", "calendar", "birthday.cake.fill", "crown.fill"],
  storedValue: ["wallet.pass.fill", "bag.fill", "storefront.fill", "qrcode", "tag.fill", "cart.fill", "ticket.fill", "calendar"],
  transit: ["tram.circle.fill", "tram.fill", "bus.fill", "train.side.front.car", "ticket.fill", "qrcode", "map.fill", "calendar"],
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
  hotelCard: ["creditcard.fill", "bed.double.circle.fill", "building.2.crop.circle.fill", "creditcard.and.123", "wallet.pass.fill", "key.horizontal.fill", "fork.knife.circle.fill", "crown.fill"],
  airlineCard: ["creditcard.fill", "airplane.circle.fill", "airplane.departure", "creditcard.and.123", "wallet.pass.fill", "airplane", "figure.seated.seatbelt", "suitcase.cart.fill"],
  travelCard: ["creditcard.fill", "globe.europe.africa.fill", "globe.americas.fill", "creditcard.and.123", "wallet.pass.fill", "map.fill", "suitcase.rolling.fill", "globe.asia.australia.fill"],
  railCard: ["creditcard.fill", "tram.circle.fill", "train.side.front.car", "creditcard.and.123", "wallet.pass.fill", "tram.fill", "ticket.fill", "map.fill"],
  cashbackCard: ["creditcard.fill", "percent", "banknote.fill", "creditcard.and.123", "dollarsign.arrow.circlepath", "wallet.pass.fill", "tray.and.arrow.down.fill", "calendar"],
  rewardsCard: ["creditcard.fill", "gift.fill", "tag.fill", "creditcard.and.123", "wallet.pass.fill", "crown.fill", "trophy.fill", "ticket.fill"],
  hotel: ["bed.double.circle.fill", "building.2.crop.circle.fill", "key.horizontal.fill", "suitcase.rolling.fill", "fork.knife.circle.fill", "calendar", "map.fill", "qrcode"],
  hotelDining: ["fork.knife.circle.fill", "bed.double.circle.fill", "building.2.crop.circle.fill", "cup.and.saucer.fill", "fork.knife", "key.horizontal.fill", "calendar", "ticket.fill"],
  flight: ["airplane", "airplane.circle.fill", "airplane.departure", "airplane.arrival", "suitcase.cart.fill", "figure.seated.seatbelt", "ticket.fill", "qrcode"],
  flightDeparture: ["airplane.departure", "airplane", "suitcase.cart.fill", "figure.seated.seatbelt", "qrcode", "ticket.fill", "airplane.circle.fill", "calendar"],
  flightArrival: ["airplane.arrival", "airplane", "suitcase.cart.fill", "map.fill", "location.fill", "car.side.fill", "suitcase.rolling.fill", "calendar"],
  airportLounge: ["figure.seated.seatbelt", "airplane.circle.fill", "wallet.pass.fill", "fork.knife.circle.fill", "airplane.departure", "ticket.fill", "qrcode", "cup.and.saucer.fill"],
  baggage: ["suitcase.cart.fill", "suitcase.rolling.fill", "airplane.departure", "airplane.arrival", "qrcode", "ticket.fill", "airplane", "calendar"],
  sightseeing: ["binoculars.fill", "map.fill", "location.fill", "camera.fill", "globe.europe.africa.fill", "globe.americas.fill", "ticket.fill", "suitcase.rolling.fill"],
  rail: ["tram.circle.fill", "train.side.front.car", "tram.fill", "ticket.fill", "qrcode", "map.fill", "calendar", "suitcase.rolling.fill"],
  travel: ["suitcase.rolling.fill", "map.fill", "globe.europe.africa.fill", "globe.americas.fill", "globe.asia.australia.fill", "airplane", "binoculars.fill", "calendar"],
  medical: ["stethoscope", "cross.case.fill", "mouth.fill", "calendar", "heart.text.square.fill", "syringe.fill", "pills.fill", "eye.fill"],
  medication: ["pills.fill", "alarm.fill", "calendar", "clock.fill", "stethoscope", "cross.case.fill", "heart.text.square.fill", "syringe.fill"],
  swimming: ["figure.pool.swim", "figure.run", "figure.yoga", "dumbbell.fill", "calendar", "heart.text.square.fill", "bicycle", "trophy.fill"],
  yoga: ["figure.yoga", "figure.mind.and.body", "dumbbell.fill", "calendar", "heart.text.square.fill", "figure.run", "leaf.fill", "figure.pool.swim"],
  rest: ["bed.double.fill", "moon.zzz.fill", "figure.mind.and.body", "brain.head.profile", "heart.text.square.fill", "clock.fill", "alarm.fill", "leaf.fill"],
  digital: ["desktopcomputer", "globe", "server.rack", "network", "icloud.fill", "lock.shield.fill", "terminal.fill", "calendar"],
  entertainment: ["play.rectangle.fill", "music.note", "headphones", "tv.fill", "gamecontroller.fill", "ticket.fill", "repeat.circle.fill", "crown.fill"],
} as const
type Scene = keyof typeof SCENE_ICONS
const FINANCIAL_SCENES = new Set<Scene>(["credit", "banking", "savings", "investment", "loan", "billing", "transfer", "income", "tax", "insurance",
  "hotelCard", "airlineCard", "travelCard", "railCard", "cashbackCard", "rewardsCard"])
const TRAVEL_SCENES = new Set<Scene>(["hotel", "hotelDining", "flight", "flightDeparture", "flightArrival", "airportLounge", "baggage", "sightseeing", "rail", "transit", "travel"])

// Catalog metadata only. Group order matches the original catalog fallback.
const ICONS_BY_NAME = new Map<string, DueIconDefinition>()
const ICONS_BY_GROUP = new Map<DueIconGroup, DueIconDefinition[]>()
for (const icon of DUE_ICON_OPTIONS) {
  ICONS_BY_NAME.set(icon.name, icon)
  const group = ICONS_BY_GROUP.get(icon.group)
  if (group) group.push(icon)
  else ICONS_BY_GROUP.set(icon.group, [icon])
}

const SYMBOL_SCENES = new Map<string, Scene>([
  ...["lock.shield.fill", "key.fill", "shield.lefthalf.filled", "lock.doc.fill"].map(name => [name, "security"] as const),
  ...["car.fill", "car.side.fill", "wrench.adjustable.fill", "parkingsign.circle.fill", "fuelpump.fill", "bolt.car.fill"].map(name => [name, "vehicle"] as const),
  ...["person.text.rectangle.fill", "doc.text.image.fill", "checkmark.seal.fill", "person.crop.rectangle.fill", "doc.on.doc.fill", "signature"].map(name => [name, "credentials"] as const),
  ...["lanyardcard.fill", "person.crop.circle.badge.checkmark"].map(name => [name, "credentials"] as const),
  ["person.crop.square.filled.and.at.rectangle", "membership"],
  ["simcard.fill", "sim"],
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
  ...["bed.double.fill", "moon.zzz.fill"].map(name => [name, "rest"] as const),
  ...["bed.double.circle.fill", "building.2.crop.circle.fill", "key.horizontal.fill"].map(name => [name, "hotel"] as const),
  ["fork.knife.circle.fill", "hotelDining"],
  ...["airplane", "airplane.circle.fill", "figure.seated.seatbelt"].map(name => [name, "flight"] as const),
  ["airplane.departure", "flightDeparture"], ["airplane.arrival", "flightArrival"],
  ...["suitcase.cart.fill", "suitcase.rolling.fill"].map(name => [name, "baggage"] as const),
  ["binoculars.fill", "sightseeing"],
  ...["tram.circle.fill", "tram.fill", "train.side.front.car"].map(name => [name, "rail"] as const),
  ...["globe.europe.africa.fill", "globe.americas.fill"].map(name => [name, "travel"] as const),
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
  const cardScene = travelCardScene(title, context.kind)
  if (!cardScene && /\bpassport\b|\b(?:visa|licen[cs]e|certificate)\s+(?:renewal|expiry)\b|\bid\s+card\b|护照|護照|驾照|駕照|驾驶证|駕駛證|身份证|身份證|证件|證件|合同|资格证|資格證|证书|證書/.test(title)) return "credentials"
  if (/\b(?:membership|member|loyalty)\s+(?:card|pass)\b|会员卡|會員卡|会员证|會員證|会籍卡|會籍卡/.test(title)) return "membership"
  // Specific non-credit cards override only the context's stale type fallback.
  // A separately recognized automatic scene still follows the priority below.
  if (/\b(?:e\s*sim|esim|sim)\s*(?:card|卡)\b|(?:sim|SIM)\s*卡|电话卡|電話卡|手机卡|手機卡/.test(title)) return "sim"
  if (/\bgift\s+card\b|礼品卡|禮品卡/.test(title)) return "giftPass"
  if (/\b(?:prepaid|pre\s+paid|stored\s+value)\s+card\b|预付卡|預付卡|预付款卡|預付款卡|储值卡|儲值卡/.test(title)) return "storedValue"
  if (/\brail\s*(?:card|pass)\b|铁路交通卡|鐵路交通卡/.test(title)) return "rail"
  if (/\b(?:transit|transport|transportation)\s+(?:card|pass)\b|交通卡|乘车卡|乘車卡|公交卡|八达通|八達通/.test(title)) return "transit"
  if (/\bswim(?:ming)?\b|游泳|泳课|泳課/.test(title)) return "swimming"
  if (/\byoga\b|瑜伽/.test(title)) return "yoga"
  if (/房租|物业|物業|水费|水費|电费|電費|燃气|燃氣|\b(?:rent|utilities)\b/.test(title)) return "housing"
  if (/复诊|複診|復診|牙科|牙医|牙醫|体检|體檢|\b(?:dental|checkup)\b/.test(title)) return "medical"
  if (/服药|服藥|处方|處方|\bmedication\b/.test(title)) return "medication"
  if (cardScene) return cardScene
  const financial = financialTitleScene(title)
  if (financial) return financial
  if (/机场贵宾室|機場貴賓室|机场休息室|機場休息室|\b(?:airport|airline)\s+lounge\b|\blounge\s+(?:access|pass)\b/.test(title)) return "airportLounge"
  if (/行李|托运|托運|\b(?:baggage|luggage|suitcase)\b/.test(title)) return "baggage"
  if (/景点|景點|观光|觀光|\b(?:sightseeing|sight seeing|tourist attraction)\b/.test(title)) return "sightseeing"
  if (/接机|接機|抵达|抵達|到达航班|到達航班|\b(?:flight|airplane)\s+arrival\b|\b(?:airport pickup|arrivals?)\b/.test(title)) return "flightArrival"
  if (/出发航班|出發航班|登机|登機|航班出发|航班出發|\b(?:flight|airplane)\s+departure\b|\b(?:boarding|departures?)\b/.test(title)) return "flightDeparture"
  if (/(?:酒店|饭店|飯店|旅馆|旅館).*(?:早餐|餐饮|餐飲)|\bhotel\s+(?:dining|breakfast)\b/.test(title)) return "hotelDining"
  if (/酒店|饭店|飯店|旅馆|旅館|度假村|房卡|\b(?:hotel|hotels|resort|accommodation|room key)\b/.test(title)) return "hotel"
  if (/航班|航空|机票|機票|里程|\b(?:flight|flights|airline|airlines|air miles|airline miles)\b/.test(title)) return "flight"
  if (/铁路|鐵路|火车|火車|地铁|地鐵|\b(?:rail|railway|train|tram)\b/.test(title)) return "rail"
  if (/旅行|旅游|旅遊|出行|\b(?:travel|trip|trips|vacation)\b/.test(title)) return "travel"
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
  const automatic = ICONS_BY_NAME.get(automaticName ?? "")
  const automaticScene = SYMBOL_SCENES.get(automaticName ?? "")
  const contextualScene = contextScene(context)
  // A specific financial purpose refines a broad money symbol. Strong non-finance
  // scenes still win; only housing + a mortgage/loan purpose is an explicit bridge.
  const refineFinance = contextualScene && FINANCIAL_SCENES.has(contextualScene)
    && (!automaticScene || FINANCIAL_SCENES.has(automaticScene)
      || (automaticName === "house.fill" && contextualScene === "loan"))
  // Travel action titles refine a travel symbol, but cannot replace a recognized
  // non-travel scene. In particular, sleep and identity documents stay distinct.
  const refineTravel = contextualScene && TRAVEL_SCENES.has(contextualScene)
    && automaticScene && TRAVEL_SCENES.has(automaticScene)
  const scene = refineFinance || refineTravel ? contextualScene : automaticScene ?? contextualScene
  const result: DueIconDefinition[] = [], seen = new Set<string>()
  const add = (name?: string | null) => {
    if (name && !seen.has(name)) {
      const icon = ICONS_BY_NAME.get(name)
      if (icon) { seen.add(name); result.push(icon) }
    }
    return result.length === 8
  }
  if (add(automaticName) || add(selectedName)) return result
  if (scene) for (const name of SCENE_ICONS[scene]) if (add(name)) return result
  if (automatic) for (const icon of ICONS_BY_GROUP.get(automatic.group) ?? []) if (add(icon.name)) return result
  for (const name of ["calendar.badge.clock", "repeat.circle.fill", "creditcard.fill", "checklist", "bell.fill", "tag.fill", "gift.fill", "heart.fill"]) {
    if (add(name)) break
  }
  return result
}
