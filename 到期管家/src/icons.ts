import type { ItemKind } from "./types"

export type DueIconGroup = "财务" | "媒体" | "数字服务" | "生活" | "其他"

export type DueIconDefinition = {
  name: string
  label: string
  color: string
  group: DueIconGroup
}

export type ResolvedDueIcon = Pick<DueIconDefinition, "name" | "label" | "color">

export const DUE_ICON_GROUPS: DueIconGroup[] = ["财务", "媒体", "数字服务", "生活", "其他"]

export const DUE_ICON_OPTIONS: DueIconDefinition[] = [
  { name: "creditcard.fill", label: "信用卡", color: "systemOrange", group: "财务" },
  { name: "building.columns.fill", label: "银行", color: "systemIndigo", group: "财务" },
  { name: "banknote.fill", label: "付款", color: "systemGreen", group: "财务" },
  { name: "cart.fill", label: "购物", color: "systemBlue", group: "财务" },
  { name: "play.rectangle.fill", label: "视频", color: "systemRed", group: "媒体" },
  { name: "music.note", label: "音乐", color: "systemPink", group: "媒体" },
  { name: "gamecontroller.fill", label: "游戏", color: "systemPurple", group: "媒体" },
  { name: "newspaper.fill", label: "新闻阅读", color: "systemBlue", group: "媒体" },
  { name: "sparkles", label: "AI 服务", color: "systemPurple", group: "数字服务" },
  { name: "icloud.fill", label: "云服务", color: "systemBlue", group: "数字服务" },
  { name: "globe", label: "网站域名", color: "systemTeal", group: "数字服务" },
  { name: "wifi", label: "网络", color: "systemBlue", group: "数字服务" },
  { name: "iphone", label: "手机", color: "systemIndigo", group: "数字服务" },
  { name: "bolt.fill", label: "电费", color: "systemOrange", group: "生活" },
  { name: "drop.fill", label: "水费", color: "systemBlue", group: "生活" },
  { name: "flame.fill", label: "燃气", color: "systemOrange", group: "生活" },
  { name: "house.fill", label: "住房", color: "systemTeal", group: "生活" },
  { name: "car.fill", label: "车辆", color: "systemBlue", group: "生活" },
  { name: "shield.fill", label: "保险", color: "systemGreen", group: "生活" },
  { name: "cross.case.fill", label: "医疗", color: "systemRed", group: "生活" },
  { name: "pawprint.fill", label: "宠物", color: "systemOrange", group: "生活" },
  { name: "figure.run", label: "运动", color: "systemGreen", group: "生活" },
  { name: "graduationcap.fill", label: "学习", color: "systemIndigo", group: "其他" },
  { name: "airplane", label: "旅行", color: "systemBlue", group: "其他" },
  { name: "gift.fill", label: "生日礼物", color: "systemPink", group: "其他" },
  { name: "ticket.fill", label: "票券", color: "systemOrange", group: "其他" },
  { name: "doc.text.fill", label: "账单文件", color: "systemBlue", group: "其他" },
  { name: "checklist", label: "提醒事项", color: "systemBlue", group: "其他" },
  { name: "repeat.circle.fill", label: "周期订阅", color: "systemPurple", group: "其他" },
  { name: "calendar.badge.clock", label: "日期", color: "systemTeal", group: "其他" },
]

type IconRule = {
  icon: string
  keywords: string[]
}

// More specific services and phrases deliberately come before broad categories.
const ICON_RULES: IconRule[] = [
  {
    icon: "sparkles",
    keywords: ["claude", "chatgpt", "openai", "gemini", "copilot", "deepseek", "perplexity", "anthropic", "人工智能"],
  },
  {
    icon: "music.note",
    keywords: ["spotify", "apple music", "youtube music", "qq音乐", "网易云音乐", "音乐", "音频"],
  },
  {
    icon: "play.rectangle.fill",
    keywords: ["netflix", "youtube", "disney+", "disney plus", "hbo", "bilibili", "哔哩哔哩", "爱奇艺", "腾讯视频", "优酷", "视频", "影视"],
  },
  {
    icon: "gamecontroller.fill",
    keywords: ["playstation", "xbox", "nintendo", "steam", "游戏", "主机会员"],
  },
  {
    icon: "icloud.fill",
    keywords: ["icloud", "dropbox", "onedrive", "google drive", "网盘", "云盘", "云存储", "云备份"],
  },
  {
    icon: "creditcard.fill",
    keywords: ["credit", "mastercard", "american express", "amex", "visa", "信用卡", "还款日", "卡账单", "银行账单"],
  },
  {
    icon: "building.columns.fill",
    keywords: ["bank", "banking", "sofi", "ally", "银行", "储蓄账户"],
  },
  {
    icon: "car.fill",
    keywords: ["car insurance", "vehicle", "parking", "tesla", "车险", "停车", "加油", "充电桩", "汽车", "车辆", "年检"],
  },
  {
    icon: "shield.fill",
    keywords: ["insurance", "保险", "保费"],
  },
  {
    icon: "cross.case.fill",
    keywords: ["hospital", "doctor", "dentist", "medicine", "medical", "health", "医疗", "医院", "复诊", "体检", "牙医", "药物", "药品"],
  },
  {
    icon: "house.fill",
    keywords: ["mortgage", "property fee", "home loan", "house rent", "房租", "房贷", "按揭", "物业", "管理费"],
  },
  {
    icon: "bolt.fill",
    keywords: ["electricity", "power bill", "电费", "电力"],
  },
  {
    icon: "drop.fill",
    keywords: ["water bill", "水费", "自来水"],
  },
  {
    icon: "flame.fill",
    keywords: ["gas bill", "燃气", "煤气", "天然气"],
  },
  {
    icon: "iphone",
    keywords: ["mobile plan", "phone bill", "cellular", "手机费", "话费", "流量套餐"],
  },
  {
    icon: "wifi",
    keywords: ["broadband", "internet", "wi-fi", "wifi", "宽带", "网络费", "电信", "联通", "移动"],
  },
  {
    icon: "globe",
    keywords: ["domain", "hosting", "server", "ssl", "域名", "主机", "服务器", "证书续期"],
  },
  {
    icon: "graduationcap.fill",
    keywords: ["tuition", "course", "school", "exam", "学费", "课程", "学校", "考试", "作业"],
  },
  {
    icon: "airplane",
    keywords: ["flight", "airline", "travel", "trip", "机票", "航班", "旅行", "签证", "酒店"],
  },
  {
    icon: "pawprint.fill",
    keywords: ["pet", "veterinary", "宠物", "猫粮", "狗粮", "兽医"],
  },
  {
    icon: "figure.run",
    keywords: ["gym", "fitness", "workout", "健身", "运动", "瑜伽"],
  },
  {
    icon: "gift.fill",
    keywords: ["birthday", "anniversary", "gift", "生日", "纪念日", "礼物"],
  },
  {
    icon: "newspaper.fill",
    keywords: ["newspaper", "magazine", "newsletter", "新闻", "报刊", "杂志"],
  },
  {
    icon: "cart.fill",
    keywords: ["shopping", "order", "purchase", "购物", "订单", "采购"],
  },
]

const KIND_FALLBACKS: Record<ItemKind | "reminder", string> = {
  creditCard: "creditcard.fill",
  subscription: "repeat.circle.fill",
  bill: "doc.text.fill",
  custom: "calendar.badge.clock",
  reminder: "checklist",
}

export function normalizeIconOverride(value: unknown): string | null {
  if (typeof value !== "string") return null
  return DUE_ICON_OPTIONS.some(option => option.name === value) ? value : null
}

export function resolveDueIcon(
  title: string,
  kind: ItemKind | "reminder",
  override: string | null = null,
): ResolvedDueIcon {
  const normalizedOverride = normalizeIconOverride(override)
  const inferredName = normalizedOverride
    ?? ICON_RULES.find(rule => rule.keywords.some(keyword => matchesKeyword(title, keyword)))?.icon
    ?? KIND_FALLBACKS[kind]
  const definition = DUE_ICON_OPTIONS.find(option => option.name === inferredName)
    ?? DUE_ICON_OPTIONS[DUE_ICON_OPTIONS.length - 1]
  return {
    name: definition.name,
    label: definition.label,
    color: definition.color,
  }
}

function matchesKeyword(title: string, keyword: string): boolean {
  const normalizedTitle = title.normalize("NFKC").toLocaleLowerCase()
  const normalizedKeyword = keyword.normalize("NFKC").toLocaleLowerCase()
  if (/[^\u0000-\u00ff]/.test(normalizedKeyword)) {
    return normalizedTitle.includes(normalizedKeyword)
  }
  const words = normalizedTitle
    .replace(/[^a-z0-9+]+/g, " ")
    .trim()
  const keywordWords = normalizedKeyword
    .replace(/[^a-z0-9+]+/g, " ")
    .trim()
  return ` ${words} `.includes(` ${keywordWords} `)
}
