// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// Public brand vocabulary only; not a list of available financial products.

export const FINANCIAL_ICON_BRANDS: readonly { name: string; aliases: string; region: string }[] = [
  { name: "HSBC", aliases: "汇丰 匯豐 汇丰银行 匯豐銀行", region: "英国 香港" },
  { name: "Standard Chartered", aliases: "渣打 渣打银行 渣打銀行", region: "英国 香港" },
  { name: "Barclays", aliases: "巴克莱 巴克萊", region: "英国" },
  { name: "Monzo", aliases: "Monzo", region: "英国" },
  { name: "Starling Bank", aliases: "Starling", region: "英国" },
  { name: "Revolut", aliases: "Revolut", region: "英国" },
  { name: "Wise", aliases: "TransferWise", region: "英国" },
  { name: "NatWest", aliases: "NatWest", region: "英国" },
  { name: "Lloyds Bank", aliases: "Lloyds 劳埃德 勞埃德", region: "英国" },
  { name: "Nationwide", aliases: "Nationwide", region: "英国" },
  { name: "Halifax", aliases: "Halifax", region: "英国" },
  { name: "Royal Bank of Scotland", aliases: "RBS 苏格兰皇家银行 蘇格蘭皇家銀行", region: "英国" },
  { name: "Curve", aliases: "Curve", region: "英国" },
  { name: "Trading 212", aliases: "Trading212", region: "英国" },
  { name: "Bank of America", aliases: "bankofamerica BofA 美国银行 美國銀行 美银 美銀", region: "美国" },
  { name: "Chase", aliases: "Chase 大通 大通银行 大通銀行", region: "美国" },
  { name: "JPMorgan", aliases: "jpmorganchina 摩根大通", region: "美国" },
  { name: "Citi", aliases: "Citibank 花旗 花旗银行 花旗銀行", region: "美国 香港" },
  { name: "Wells Fargo", aliases: "Wellsfargo 富国 富國", region: "美国" },
  { name: "American Express", aliases: "Amex 美国运通 美國運通 运通 運通", region: "美国" },
  { name: "Capital One", aliases: "CapitalOne 第一资本 第一資本", region: "美国" },
  { name: "Discover", aliases: "Discover", region: "美国" },
  { name: "US Bank", aliases: "USBank 合众银行 合眾銀行", region: "美国" },
  { name: "Charles Schwab", aliases: "Schwab 嘉信 嘉信理财 嘉信理財", region: "美国" },
  { name: "Fidelity", aliases: "Fidelity 富达 富達", region: "美国" },
  { name: "Robinhood", aliases: "Robinhood 罗宾汉 羅賓漢", region: "美国" },
  { name: "Interactive Brokers", aliases: "IBKR 盈透 盈透证券 盈透證券", region: "美国 香港" },
  { name: "East West Bank", aliases: "eastwestbank 华美银行 華美銀行", region: "美国" },
  { name: "Bank of China", aliases: "boc 中国银行 中國銀行 中行", region: "大陆 内地" },
  { name: "ICBC", aliases: "中国工商银行 中國工商銀行 工商银行 工商銀行 工行", region: "大陆 内地" },
  { name: "Agricultural Bank of China", aliases: "abchina 农业银行 農業銀行 农行 農行", region: "大陆 内地" },
  { name: "China Construction Bank", aliases: "ccb 建设银行 建設銀行 建行", region: "大陆 内地" },
  { name: "Bank of Communications", aliases: "bankcomm 交通银行 交通銀行 交行", region: "大陆 内地" },
  { name: "China Merchants Bank", aliases: "cmbchina 招商银行 招商銀行 招行", region: "大陆 内地" },
  { name: "China CITIC Bank", aliases: "citicbank 中信银行 中信銀行", region: "大陆 内地" },
  { name: "China Minsheng Bank", aliases: "cmbc 民生银行 民生銀行", region: "大陆 内地" },
  { name: "Postal Savings Bank of China", aliases: "psbc 邮储 邮儲 邮政储蓄 郵政儲蓄", region: "大陆 内地" },
  { name: "Ping An Bank", aliases: "pingan 平安银行 平安銀行", region: "大陆 内地" },
  { name: "Shanghai Pudong Development Bank", aliases: "spdb 浦发银行 浦發銀行 浦发 浦發", region: "大陆 内地" },
  { name: "Industrial Bank", aliases: "cib 兴业银行 興業銀行", region: "大陆 内地" },
  { name: "China Everbright Bank", aliases: "cebbank 光大银行 光大銀行", region: "大陆 内地" },
  { name: "China Guangfa Bank", aliases: "cgbchina 广发银行 廣發銀行", region: "大陆 内地" },
  { name: "Bank of Beijing", aliases: "bankofbeijing 北京银行 北京銀行", region: "大陆 内地" },
  { name: "Bank of Shanghai", aliases: "bosc 上海银行 上海銀行", region: "大陆 内地" },
  { name: "Alipay", aliases: "支付宝 支付寶", region: "大陆 内地" },
  { name: "WeChat", aliases: "Weixin 微信 微信支付", region: "大陆 内地" },
  { name: "UnionPay", aliases: "银联 銀聯 中国银联 中國銀聯", region: "大陆 内地" },
  { name: "BOCHK", aliases: "中银香港 中銀香港", region: "香港" },
  { name: "Hang Seng Bank", aliases: "hangseng 恒生 恒生银行 恒生銀行", region: "香港" },
  { name: "Bank of East Asia", aliases: "hkbea 东亚银行 東亞銀行", region: "香港" },
  { name: "Dah Sing Bank", aliases: "dahsing 大新银行 大新銀行", region: "香港" },
  { name: "DBS", aliases: "星展 星展银行 星展銀行", region: "香港" },
  { name: "OCBC", aliases: "华侨银行 華僑銀行 华侨永亨 華僑永亨", region: "香港" },
  { name: "ZA Bank", aliases: "众安银行 眾安銀行", region: "香港" },
  { name: "Mox", aliases: "Mox", region: "香港" },
  { name: "livi", aliases: "理慧 理慧银行 理慧銀行", region: "香港" },
  { name: "WeLab Bank", aliases: "WeLab 汇立银行 匯立銀行", region: "香港" },
  { name: "Airstar Bank", aliases: "天星银行 天星銀行", region: "香港" },
  { name: "Ant Bank", aliases: "蚂蚁银行 螞蟻銀行", region: "香港" },
  { name: "AlipayHK", aliases: "支付宝香港 支付寶香港", region: "香港" },
  { name: "Octopus", aliases: "八达通 八達通", region: "香港" },
  { name: "Futu", aliases: "富途 富途牛牛", region: "香港" },
  { name: "Webull", aliases: "微牛 微牛证券 微牛證券", region: "美国 香港" },
  { name: "RedotPay", aliases: "RedotPay 红点支付 紅點支付", region: "U卡 加密卡" },
  { name: "Bybit", aliases: "Bybit", region: "U卡 加密卡" },
  { name: "Wirex", aliases: "Wirex", region: "U卡 加密卡" },
  { name: "Nexo", aliases: "Nexo", region: "U卡 加密卡" },
  { name: "Crypto.com", aliases: "Crypto.com", region: "U卡 加密卡" },
  { name: "Visa", aliases: "维萨 維薩 威士", region: "卡组织" },
  { name: "Mastercard", aliases: "万事达 萬事達", region: "卡组织" },
  { name: "PayPal", aliases: "贝宝 貝寶", region: "支付" },
]
const compact = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")
const vocabulary = FINANCIAL_ICON_BRANDS.flatMap(brand => [brand.name, ...brand.aliases.split(" ")].map(word => ({ brand, word: word.normalize("NFKC").toLowerCase() })))
const byExactName = new Map(vocabulary.map(row => [compact(row.word), row.brand]))
const prefixNames = vocabulary.slice().sort((a, b) => b.word.length - a.word.length)
/** Exact public labels/aliases only: no substring classification of unrelated apps. */
export function financialIconBrand(label: string) {
  return byExactName.get(compact(label))
}
export function financialIconKeywords(label: string): string {
  const brand = financialIconBrand(label)
  return brand ? `金融 ${brand.name} ${brand.aliases} ${brand.region}` : ""
}
/** Allow suffix labels such as "WeChat WeiXin" or "HSBC · UK", not NEXON/Proxmox. */
export function financialIconBrandForLabel(label: string) {
  const exact = financialIconBrand(label)
  if (exact) return exact
  const normalized = label.normalize("NFKC").toLowerCase()
  return prefixNames.find(row => normalized.startsWith(row.word) && /^[\s·/|,（(\-]/.test(normalized.slice(row.word.length)))?.brand
}
