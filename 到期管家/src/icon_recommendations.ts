// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { resolveDueIcon } from "./icons"
import { ARTWORK_CATALOG } from "./artwork_catalog"
import type { ItemKind } from "./types"

export interface IconRecommendation { fluent: string; icons8: string; reason: string }
const EMOJI_BY_SYMBOL: Record<string, string> = {
  "repeat.circle.fill": "calendar", "doc.text.fill": "page", "wrench.and.screwdriver.fill": "wrench", "birthday.cake.fill": "birthday-cake",
  "creditcard.fill": "credit-card", "building.columns.fill": "bank", "banknote.fill": "money", "chart.line.uptrend.xyaxis": "chart",
  "chart.pie.fill": "chart", "doc.text.magnifyingglass": "document", "percent": "money", "dollarsign.circle.fill": "money", "shield.fill": "shield",
  "play.rectangle.fill": "movie", "music.note": "musical", "headphones": "headphone", "mic.fill": "microphone", "waveform": "radio", "radio.fill": "radio",
  "gamecontroller.fill": "video-game", "tv.fill": "television", "sportscourt.fill": "ball", "theatermasks.fill": "performing", "ticket.fill": "ticket",
  "briefcase.fill": "briefcase", "checklist": "memo", "checkmark.circle.fill": "check", "calendar": "calendar", "note.text": "notebook", "envelope.fill": "envelope",
  "doc.on.doc.fill": "document", "signature": "pen", "rectangle.3.group.fill": "clipboard", "printer.fill": "printer", "scanner.fill": "printer", "storefront.fill": "store",
  "sparkles": "robot", "icloud.fill": "cloud", "externaldrive.fill": "floppy-disk", "globe": "globe", "wifi": "antenna", "iphone": "mobile-phone",
  "desktopcomputer": "computer", "terminal.fill": "computer", "curlybraces.square.fill": "computer", "lock.shield.fill": "locked", "shield.lefthalf.filled": "shield",
  "key.fill": "key", "network": "computer", "server.rack": "computer", "square.grid.2x2.fill": "computer", "puzzlepiece.extension.fill": "puzzle",
  "message.fill": "speech", "bubble.left.and.bubble.right.fill": "speech", "video.fill": "video-camera", "person.2.fill": "people", "person.3.fill": "people",
  "heart.fill": "heart", "crown.fill": "crown", "phone.fill": "telephone", "paperplane.fill": "envelope",
  "bolt.fill": "high-voltage", "drop.fill": "droplet", "flame.fill": "fire", "house.fill": "house", "fork.knife": "fork",
  "takeoutbag.and.cup.and.straw.fill": "takeout", "cup.and.saucer.fill": "hot-beverage", "cart.fill": "shopping-cart", "bag.fill": "shopping-bags", "tshirt.fill": "shirt",
  "shippingbox.fill": "package", "hammer.fill": "hammer", "washer.fill": "broom", "trash.fill": "wastebasket", "bell.and.waves.left.and.right.fill": "bell", "pawprint.fill": "paw",
  "cross.case.fill": "hospital", "heart.text.square.fill": "heart", "pills.fill": "pill", "stethoscope": "stethoscope", "figure.run": "running", "dumbbell.fill": "lifting",
  "figure.mind.and.body": "lotus", "bed.double.fill": "bed", "moon.zzz.fill": "sleeping", "brain.head.profile": "brain", "leaf.fill": "leaf", "trophy.fill": "trophy",
  "airplane": "airplane", "car.fill": "automobile", "bus.fill": "bus", "tram.fill": "train", "map.fill": "map", "location.fill": "compass", "suitcase.rolling.fill": "luggage",
  "fuelpump.fill": "fuel", "bolt.car.fill": "automobile", "parkingsign.circle.fill": "parking", "bicycle": "bicycle",
  "graduationcap.fill": "graduation", "book.fill": "book", "book.closed.fill": "book", "books.vertical.fill": "books", "newspaper.fill": "newspaper", "text.book.closed.fill": "book",
  "character.book.closed.fill": "book", "lightbulb.fill": "light-bulb", "function": "abacus", "globe.asia.australia.fill": "globe", "teddybear.fill": "teddy",
}

// A public, bundled vocabulary is used only to derive search terms, never to
// supply offline search results. No arbitrary item titles are transmitted.
const genericWords = new Set("plus pro premium desktop app ai cloud reader music video calendar chat store google apple adobe microsoft 阅读 閱讀 设计 設計 音乐 音樂 视频 視頻 会员 會員 订阅 訂閱 支付 聊天 云端 雲端 云盘 雲盤 网盘 網盤 电商 電商 外卖 外賣 购物 購物 游戏 遊戲 播客 邮箱 郵箱 笔记 筆記 办公 辦公 搜索 搜尋 通讯 通訊 社交 安全 代码 代碼 地图 地圖 银行 銀行 修图 修圖 摄影 攝影 剪辑 剪輯 插画 插畫".split(" "))
const brands = ARTWORK_CATALOG.filter(icon => icon.group !== "生活图标").map(icon => ({
  query: icon.label, group: icon.group, full: icon.label.normalize("NFKC").toLowerCase(),
  words: icon.aliases.split(/[\s,，;；|/]+/).map(word => word.normalize("NFKC").toLowerCase().trim())
    .filter(word => !genericWords.has(word) && (word.length >= 3 || /[\u3400-\u9fff]/.test(word))),
}))
const EMOJI_BY_GROUP: Record<string, string> = {
  "AI 服务": "robot", "社交通讯": "speech", "影音娱乐": "movie", "音乐音频": "musical", "视频影视": "movie",
  "设计创作": "artist", "办公效率": "briefcase", "笔记文档": "notebook", "云存储": "cloud", "浏览器": "globe",
  "开发工具": "computer", "游戏": "video-game", "购物支付": "shopping-cart", "银行金融": "bank", "学习阅读": "book",
  "出行旅行": "airplane", "健康运动": "running", "系统平台": "computer", "安全工具": "locked",
  "财务支付": "bank", "浏览器与网络": "globe", "云服务与安全": "cloud", "购物生活": "shopping-cart", "设备工具": "computer",
  "购物与支付": "shopping-cart", "运动": "running", "效率工具": "briefcase", "影音创作": "movie", "Microsoft": "computer", "Google": "computer", "Apple": "computer",
}
const DIRECT_BRANDS = [
  { words: ["apple music", "苹果音乐", "蘋果音樂"], icons8: "Apple Music", fluent: "musical" },
  { words: ["icloud", "苹果云", "蘋果雲"], icons8: "iCloud", fluent: "cloud" },
  { words: ["netflix", "奈飞", "奈飛", "网飞", "網飛"], icons8: "Netflix", fluent: "movie" },
]

function matches(title: string, word: string): boolean {
  const index = title.indexOf(word)
  if (index < 0) return false
  if (/[\u3400-\u9fff]/.test(word)) return true
  return !/[a-z0-9]/.test(title[index - 1] ?? "") && !/[a-z0-9]/.test(title[index + word.length] ?? "")
}

export function recommendIconQueries(title: string, kind: ItemKind | "reminder" = "custom"): IconRecommendation {
  const normalized = title.normalize("NFKC").toLowerCase()
  const direct = DIRECT_BRANDS.find(brand => brand.words.some(word => matches(normalized, word)))
  if (direct) return { icons8: direct.icons8, fluent: direct.fluent, reason: `识别到 ${direct.icons8}；Fluent 推荐对应类别图案` }
  const icon = resolveDueIcon(title, kind)
  const ranked = normalized ? brands.map(brand => ({ brand, score: matches(normalized, brand.full) ? 1000 + brand.full.length
    : Math.max(0, ...brand.words.filter(word => matches(normalized, word)).map(word => word.length)) }))
    .filter(row => row.score > 0).sort((a, b) => b.score - a.score || a.brand.query.length - b.brand.query.length) : []
  const brand = ranked[0]?.brand
  const symbolQuery = EMOJI_BY_SYMBOL[icon.name] ?? "calendar"
  const fluent = (symbolQuery === "calendar" || icon.name === "checklist") && brand ? EMOJI_BY_GROUP[brand.group] ?? symbolQuery : symbolQuery
  return { fluent, icons8: brand?.query ?? fluent.replace(/-/g, " "), reason: brand ? `识别到 ${brand.query}；Fluent 推荐对应类别图案` : `按「${icon.label}」推荐` }
}
