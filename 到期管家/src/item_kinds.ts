export const ITEM_KIND_DEFINITIONS = [
  {
    value: "creditCard",
    label: "信用卡",
    icon: "creditcard.fill",
    color: "systemOrange",
    priority: 4,
  },
  {
    value: "subscription",
    label: "订阅会员",
    icon: "repeat.circle.fill",
    color: "systemPurple",
    priority: 2,
  },
  {
    value: "bill",
    label: "账单缴费",
    icon: "doc.text.fill",
    color: "systemBlue",
    priority: 3,
  },
  {
    value: "repayment",
    label: "贷款分期",
    icon: "banknote.fill",
    color: "systemGreen",
    priority: 4,
  },
  {
    value: "insurance",
    label: "保险保单",
    icon: "shield.fill",
    color: "systemGreen",
    priority: 3,
  },
  {
    value: "digitalService",
    label: "数字服务",
    icon: "globe",
    color: "systemTeal",
    priority: 2,
  },
  {
    value: "credential",
    label: "证件合同",
    icon: "doc.on.doc.fill",
    color: "systemTeal",
    priority: 3,
  },
  {
    value: "maintenance",
    label: "保养维护",
    icon: "wrench.and.screwdriver.fill",
    color: "systemGray",
    priority: 1,
  },
  {
    value: "appointment",
    label: "预约日程",
    icon: "calendar",
    color: "systemRed",
    priority: 1,
  },
  {
    value: "occasion",
    label: "纪念日期",
    icon: "birthday.cake.fill",
    color: "systemPink",
    priority: 1,
  },
  {
    value: "custom",
    label: "其他事项",
    icon: "calendar.badge.clock",
    color: "systemTeal",
    priority: 1,
  },
] as const

export type ItemKind = (typeof ITEM_KIND_DEFINITIONS)[number]["value"]
export type ItemKindDefinition = (typeof ITEM_KIND_DEFINITIONS)[number]

const ITEM_KIND_BY_VALUE = new Map<string, ItemKindDefinition>(
  ITEM_KIND_DEFINITIONS.map(definition => [definition.value, definition] as const),
)

export function isItemKind(value: unknown): value is ItemKind {
  return typeof value === "string" && ITEM_KIND_BY_VALUE.has(value)
}

export function itemKindDefinition(kind: ItemKind): ItemKindDefinition {
  return ITEM_KIND_BY_VALUE.get(kind)!
}

export function itemKindPriority(kind: ItemKind): number {
  return itemKindDefinition(kind).priority
}
