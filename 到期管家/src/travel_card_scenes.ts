// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import type { ItemKind } from "./types"

/** Visual purposes of a payment card, not a financial-product recommendation. */
export type TravelCardScene = "hotelCard" | "airlineCard" | "travelCard"
  | "railCard" | "cashbackCard" | "rewardsCard"

const HOTEL_BRAND = /\b(?:hilton|marriott|bonvoy|hyatt|ihg|accor|wyndham|radisson|choice\s+hotels)\b|希尔顿|希爾頓|万豪|萬豪|凯悦|凱悅|洲际|洲際|雅高|温德姆|溫德姆/u
const AIRLINE_BRAND = /\b(?:cathay|asia\s+miles|avios|british\s+airways|delta|united|mileageplus|mileage\s+plus|ana|jal|singapore\s+airlines|krisflyer|emirates|qantas|aeroplan|air\s+canada|lufthansa)\b|国泰|國泰|亚洲万里通|亞洲萬里通|达美|達美|美联航|美聯航|全日空|日航|新加坡航空|阿联酋航空|阿聯酋航空|澳航|加拿大航空|汉莎|漢莎/u
const UNRELATED_AIRLINE_BRAND = /\b(?:united\s+(?:states|kingdom|nations|bank)|delta\s+dental)\b/u
const HOTEL_PURPOSE = /\b(?:hotel|hotels|lodging|hospitality)\b|酒店|饭店|飯店|旅馆|旅館/u
const AIRLINE_PURPOSE = /\b(?:airline|airlines|flight|flights|aviation|air\s+miles)\b|航空|航班|飞行|飛行|航空里程/u
const RAIL_PURPOSE = /\b(?:rail|railway|railroad|train|amtrak)\b|铁路|鐵路|高铁|高鐵/u
const TRAVEL_PURPOSE = /\b(?:travel|travelling|traveling|journey)\b|旅行|旅游|旅遊|差旅/u
const CASHBACK_PURPOSE = /\b(?:cashback|cash\s+back|cash\s+rebate)\b|返现|返現|现金回赠|現金回贈|现金回馈|現金回饋/u
const REWARDS_PURPOSE = /\b(?:rewards?|points?)\b|积分|積分|奖赏|獎賞|奖励|獎勵/u

const FINANCIAL_CARD = /\b(?:credit|charge|debit)\s*card\b|\b(?:amex|american\s+express|mastercard|master\s+card)\b|信用卡|贷记卡|貸記卡|签账卡|簽賬卡|借记卡|借記卡/u
const CARD_WORD = /\bcard\b|卡/u
const VISA_NETWORK = /\bvisa\b/u
// These are specific non-payment cards/passes. Bare "loyalty" or "points"
// does not disqualify a genuine credit card that earns loyalty rewards.
const OTHER_CARD = /\b(?:membership|member|loyalty|gift|prepaid|sim|transit|transport|transportation|stored\s+value)\s+(?:card|pass)\b|\b(?:rail\s*card|rail\s+pass|boarding\s+(?:pass|card))\b|会员卡|會員卡|会籍卡|會籍卡|礼品卡|禮品卡|储值卡|儲值卡|预付卡|預付卡|交通卡|乘车卡|乘車卡|公交卡|登机牌|登機牌|登机证|登機證|\bsim\s*卡/iu
const DOCUMENT = /\b(?:passport|identity\s+card|id\s+card|residence\s+(?:card|permit)|(?:driver'?s?|driving)\s+licen[cs]e)\b|护照|護照|身份证|身份證|居留证|居留證|驾照|駕照|驾驶证|駕駛證|签证|簽證/u
const VISA_DOCUMENT = /\b(?:travel\s+visa|visa\s+(?:application|appointment|extension))\b/u
const VISA_RENEWAL = /\bvisa\s+renewal\b/u
const BOOKING_OR_FLIGHT_ACTION = /\b(?:(?:hotel|flight|airline)\s+(?:booking|reservation|departure|arrival)|boarding\s+time)\b|酒店预订|酒店預訂|酒店预约|酒店預約|飯店預訂|饭店预订|航班预订|航班預訂|航班起飞|航班起飛|航班抵达|航班抵達/u

/**
 * A bare brand is never sufficient outside an explicitly typed credit card.
 * Exclusions win over a stale credit-card kind, keeping documents and loyalty
 * cards from being silently relabelled as financial products.
 */
export function travelCardScene(
  title: string,
  kind?: ItemKind | "reminder",
): TravelCardScene | null {
  const text = title.normalize("NFKC").toLowerCase()
    .replace(/[-‐‑‒–—―_]+/gu, " ").replace(/\s+/gu, " ").trim()
  if (!text || OTHER_CARD.test(text) || DOCUMENT.test(text)) return null

  const financialCard = FINANCIAL_CARD.test(text)
  const hotelBrand = HOTEL_BRAND.test(text)
  const airlineBrand = !UNRELATED_AIRLINE_BRAND.test(text) && AIRLINE_BRAND.test(text)
  const hasBrand = hotelBrand || airlineBrand
  if (!financialCard && (VISA_DOCUMENT.test(text) || BOOKING_OR_FLIGHT_ACTION.test(text)
    || (VISA_RENEWAL.test(text) && !hasBrand))) return null

  const qualifiedCard = financialCard || (hasBrand && (CARD_WORD.test(text) || VISA_NETWORK.test(text)))
    || kind === "creditCard"
  if (!qualifiedCard) return null

  if (hotelBrand || HOTEL_PURPOSE.test(text)) return "hotelCard"
  if (airlineBrand || AIRLINE_PURPOSE.test(text)) return "airlineCard"
  if (RAIL_PURPOSE.test(text)) return "railCard"
  if (TRAVEL_PURPOSE.test(text)) return "travelCard"
  if (CASHBACK_PURPOSE.test(text)) return "cashbackCard"
  if (REWARDS_PURPOSE.test(text)) return "rewardsCard"
  return null
}
