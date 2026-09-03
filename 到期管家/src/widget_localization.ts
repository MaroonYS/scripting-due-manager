import { localDateKey, pad2, parseDateKey } from "./date"
import type { DisplayDueItem, ItemKind } from "./types"

export type WidgetLanguage = "en" | "zh-Hans" | "zh-Hant"

declare const Device: {
  preferredLanguages?: string[]
  systemLocale?: string
  systemLanguageTag?: string
  systemLanguageCode?: string
  systemCountryCode?: string
  systemScriptCode?: string
}

const WIDGET_TEXT = {
  en: {
    appName: "Due Manager",
    due: "Due",
    reminders: "Reminders",
    recentItems: "Upcoming",
    needsAction: "Needs Attention",
    nextItems: "Next",
    unableToLoad: "Unable to Load",
    allDone: "All Done",
    openAppToAdd: "Open Due Manager to add an item",
    loadFailed: "Due Manager Couldn’t Load",
    runAppToCheck: "Open the main script to check data or Reminders access.",
    reminderReadCacheFailed: "Reminders loaded, but the cache couldn’t be saved",
    reminderSyncCached: "Reminders couldn’t sync; showing cached items",
    reminderReadFailed: "Reminders couldn’t load; open the main script to check",
    reminderCompletedCacheFailed: "Reminder completed, but its local cache couldn’t update",
    completionAnimationSaveFailed: "Item completed, but the animation state couldn’t be saved",
    reminderCompletionFailed: "Couldn’t complete the reminder; check access in the main script",
    itemCompletionFailed: "Couldn’t complete the item; check storage in the main script",
  },
  "zh-Hans": {
    appName: "到期管家",
    due: "到期",
    reminders: "提醒事项",
    recentItems: "近期事项",
    needsAction: "需要处理",
    nextItems: "接下来",
    unableToLoad: "暂时无法读取",
    allDone: "全部完成",
    openAppToAdd: "打开「到期管家」添加事项",
    loadFailed: "到期管家加载失败",
    runAppToCheck: "请运行主脚本检查数据或提醒事项权限。",
    reminderReadCacheFailed: "提醒事项已读取，但缓存保存失败",
    reminderSyncCached: "提醒事项同步失败，正在显示缓存",
    reminderReadFailed: "提醒事项读取失败，请打开主脚本检查",
    reminderCompletedCacheFailed: "提醒已完成，但本地缓存未能更新",
    completionAnimationSaveFailed: "事项已完成，但完成动画状态未能保存",
    reminderCompletionFailed: "提醒完成失败，请打开主脚本检查权限",
    itemCompletionFailed: "事项完成失败，请打开主脚本检查存储",
  },
  "zh-Hant": {
    appName: "到期管家",
    due: "到期",
    reminders: "提醒事項",
    recentItems: "近期事項",
    needsAction: "需要處理",
    nextItems: "接下來",
    unableToLoad: "暫時無法讀取",
    allDone: "全部完成",
    openAppToAdd: "開啟「到期管家」新增事項",
    loadFailed: "到期管家載入失敗",
    runAppToCheck: "請執行主腳本檢查資料或提醒事項權限。",
    reminderReadCacheFailed: "提醒事項已讀取，但快取儲存失敗",
    reminderSyncCached: "提醒事項同步失敗，正在顯示快取",
    reminderReadFailed: "提醒事項讀取失敗，請開啟主腳本檢查",
    reminderCompletedCacheFailed: "提醒已完成，但本機快取未能更新",
    completionAnimationSaveFailed: "事項已完成，但完成動畫狀態未能儲存",
    reminderCompletionFailed: "提醒完成失敗，請開啟主腳本檢查權限",
    itemCompletionFailed: "事項完成失敗，請開啟主腳本檢查儲存空間",
  },
} as const

export type WidgetTextKey = keyof (typeof WIDGET_TEXT)["en"]

const KIND_LABELS: Record<WidgetLanguage, Record<ItemKind | "reminder", string>> = {
  en: {
    creditCard: "Credit Cards",
    subscription: "Subscriptions",
    bill: "Bills",
    repayment: "Loans",
    insurance: "Insurance",
    digitalService: "Digital Services",
    credential: "Documents",
    maintenance: "Maintenance",
    appointment: "Appointments",
    occasion: "Occasions",
    custom: "Other",
    reminder: "Reminders",
  },
  "zh-Hans": {
    creditCard: "信用卡",
    subscription: "订阅会员",
    bill: "账单缴费",
    repayment: "贷款分期",
    insurance: "保险保单",
    digitalService: "数字服务",
    credential: "证件合同",
    maintenance: "保养维护",
    appointment: "预约日程",
    occasion: "纪念日期",
    custom: "其他事项",
    reminder: "提醒事项",
  },
  "zh-Hant": {
    creditCard: "信用卡",
    subscription: "訂閱會員",
    bill: "帳單繳費",
    repayment: "貸款分期",
    insurance: "保險保單",
    digitalService: "數位服務",
    credential: "證件合約",
    maintenance: "保養維護",
    appointment: "預約日程",
    occasion: "紀念日期",
    custom: "其他事項",
    reminder: "提醒事項",
  },
}

const ACTION_ERROR_TEXT_KEYS: Record<string, WidgetTextKey> = {
  "提醒已完成，但本地缓存未能更新": "reminderCompletedCacheFailed",
  "事项已完成，但完成动画状态未能保存": "completionAnimationSaveFailed",
  "提醒完成失败，请打开主脚本检查权限": "reminderCompletionFailed",
  "事项完成失败，请打开主脚本检查存储": "itemCompletionFailed",
}

/** Returns a stable BCP-47 tag, preferring the first language selected in iOS. */
export function currentWidgetLocale(): string {
  try {
    if (typeof Device !== "undefined") {
      const preferredValue = Array.isArray(Device.preferredLanguages)
        ? Device.preferredLanguages.find(value => typeof value === "string" && value.trim())
        : undefined
      const preferred = normalizeLocaleTag(preferredValue)
      const systemTag = normalizeLocaleTag(Device.systemLanguageTag)
      const explicitTag = preferred
        && systemTag
        && !preferred.includes("-")
        && systemTag.toLowerCase().startsWith(`${preferred.toLowerCase()}-`)
        ? systemTag
        : preferred || systemTag
      const assembledTag = [
        Device.systemLanguageCode,
        Device.systemScriptCode,
        Device.systemCountryCode,
      ].filter(value => typeof value === "string" && value.trim()).join("-")
      const normalized = normalizeLocaleTag(explicitTag || assembledTag || Device.systemLocale)
      if (normalized) return normalized
    }
  } catch {
    // Older Scripting releases may not expose every Device locale property.
  }

  try {
    return normalizeLocaleTag(Intl.DateTimeFormat().resolvedOptions().locale) || "en"
  } catch {
    return "en"
  }
}

export function widgetLanguage(locale: string, scriptCode = ""): WidgetLanguage {
  const normalized = `${locale}-${scriptCode}`.replaceAll("_", "-").toLowerCase()
  const languageCode = normalized.split("-")[0]
  if (languageCode !== "zh") return "en"
  if (
    normalized.includes("hant")
    || /(?:^|-)(?:tw|hk|mo)(?:-|$)/.test(normalized)
  ) {
    return "zh-Hant"
  }
  return "zh-Hans"
}

export function widgetText(key: WidgetTextKey, locale: string): string {
  return WIDGET_TEXT[widgetLanguage(locale)][key]
}

export function widgetKindLabel(kind: ItemKind | "reminder", locale: string): string {
  return KIND_LABELS[widgetLanguage(locale)][kind]
}

export function localizeWidgetActionError(message: string, locale: string): string {
  const key = ACTION_ERROR_TEXT_KEYS[message]
  return key ? widgetText(key, locale) : message
}

export function formatWidgetDate(
  dateKey: string,
  locale: string,
  options: {
    includesTime?: boolean
    hour?: number
    minute?: number
    now?: Date
  } = {},
): string {
  const parts = parseDateKey(dateKey)
  if (!parts) return dateKey

  const includesTime = options.includesTime ?? false
  const hour = clampInteger(options.hour ?? 0, 0, 23)
  const minute = clampInteger(options.minute ?? 0, 0, 59)
  const now = options.now ?? new Date()
  const date = new Date(parts.year, parts.month - 1, parts.day, hour, minute)

  try {
    return new Intl.DateTimeFormat(locale, {
      year: parts.year === now.getFullYear() ? undefined : "numeric",
      month: "short",
      day: "numeric",
      hour: includesTime ? "numeric" : undefined,
      minute: includesTime ? "2-digit" : undefined,
    }).format(date)
  } catch {
    return fallbackDate(parts, includesTime, hour, minute, widgetLanguage(locale), now)
  }
}

export function formatWidgetItemDate(
  item: DisplayDueItem,
  locale: string,
  now = new Date(),
): string {
  if (item.includesTime && Number.isFinite(item.dueTimestamp)) {
    const date = new Date(item.dueTimestamp)
    return formatWidgetDate(localDateKey(date), locale, {
      includesTime: true,
      hour: date.getHours(),
      minute: date.getMinutes(),
      now,
    })
  }
  return formatWidgetDate(item.dueDate, locale, {
    includesTime: item.includesTime,
    hour: item.hour,
    minute: item.minute,
    now,
  })
}

export function formatWidgetMonth(dateKey: string, locale: string): string {
  const parts = parseDateKey(dateKey)
  if (!parts) return ""
  const date = new Date(parts.year, parts.month - 1, parts.day)
  try {
    return new Intl.DateTimeFormat(locale, { month: "short" }).format(date)
  } catch {
    if (widgetLanguage(locale) !== "en") return `${parts.month}月`
    return ENGLISH_MONTHS[parts.month - 1]
  }
}

function normalizeLocaleTag(value: unknown): string | null {
  if (typeof value !== "string") return null
  const candidate = value.trim().replaceAll("_", "-")
  if (!candidate) return null
  try {
    return Intl.getCanonicalLocales(candidate)[0] ?? candidate
  } catch {
    return candidate
  }
}

function fallbackDate(
  parts: { year: number; month: number; day: number },
  includesTime: boolean,
  hour: number,
  minute: number,
  language: WidgetLanguage,
  now: Date,
): string {
  const showYear = parts.year !== now.getFullYear()
  const time = includesTime ? ` ${pad2(hour)}:${pad2(minute)}` : ""
  if (language !== "en") {
    return `${showYear ? `${parts.year}年` : ""}${parts.month}月${parts.day}日${time}`
  }
  const year = showYear ? `, ${parts.year}` : ""
  return `${ENGLISH_MONTHS[parts.month - 1]} ${parts.day}${year}${time}`
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

const ENGLISH_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]
