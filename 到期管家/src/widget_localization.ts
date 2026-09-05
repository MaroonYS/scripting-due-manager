import { localDateKey, pad2, parseDateKey } from "./date"
import type { DisplayDueItem, ItemKind } from "./types"

export type WidgetLanguage = "en" | "zh-Hans" | "zh-Hant"

export type WidgetLocaleDevice = {
  preferredLanguages?: string[]
  systemLocale?: string
  systemLanguageTag?: string
  systemLanguageCode?: string
  systemCountryCode?: string
  systemScriptCode?: string
}

declare const Device: WidgetLocaleDevice

let configuredWidgetDevice: WidgetLocaleDevice | null = null

const WIDGET_TEXT = {
  en: {
    appName: "Due Manager",
    due: "Due",
    reminders: "Reminders",
    untitledReminder: "Untitled Reminder",
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
    reminderCompletedCacheFailed: "Reminder completed, but its local cache or history couldn’t update",
    completionAnimationSaveFailed: "Item completed, but the animation state couldn’t be saved",
    reminderCompletionFailed: "Couldn’t complete the reminder; check access in the main script",
    itemCompletionFailed: "Couldn’t complete the item; check storage in the main script",
    actionNeedsReview: "The last action needs attention; open Due Manager to check",
    reviewAction: "Review action",
    retrySync: "Tap to retry",
    cachedItems: "Cached items",
    lastSynced: "Last sync",
    noSuccessfulSync: "Not synced yet",
    completeItem: "Complete",
  },
  "zh-Hans": {
    appName: "到期管家",
    due: "到期",
    reminders: "提醒事项",
    untitledReminder: "未命名提醒",
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
    reminderCompletedCacheFailed: "提醒已完成，但缓存或完成记录未能保存",
    completionAnimationSaveFailed: "事项已完成，但完成动画状态未能保存",
    reminderCompletionFailed: "提醒完成失败，请打开主脚本检查权限",
    itemCompletionFailed: "事项完成失败，请打开主脚本检查存储",
    actionNeedsReview: "上次操作需要检查，请打开到期管家查看",
    reviewAction: "检查操作",
    retrySync: "点按重试",
    cachedItems: "正在显示缓存",
    lastSynced: "上次同步",
    noSuccessfulSync: "尚未同步成功",
    completeItem: "完成",
  },
  "zh-Hant": {
    appName: "到期管家",
    due: "到期",
    reminders: "提醒事項",
    untitledReminder: "未命名提醒",
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
    reminderCompletedCacheFailed: "提醒已完成，但快取或完成記錄未能儲存",
    completionAnimationSaveFailed: "事項已完成，但完成動畫狀態未能儲存",
    reminderCompletionFailed: "提醒完成失敗，請開啟主腳本檢查權限",
    itemCompletionFailed: "事項完成失敗，請開啟主腳本檢查儲存空間",
    actionNeedsReview: "上次操作需要檢查，請開啟到期管家查看",
    reviewAction: "檢查操作",
    retrySync: "點按重試",
    cachedItems: "正在顯示快取",
    lastSynced: "上次同步",
    noSuccessfulSync: "尚未同步成功",
    completeItem: "完成",
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
  "提醒已完成，但本地缓存或完成记录未能保存": "reminderCompletedCacheFailed",
  "事项已完成，但完成动画状态未能保存": "completionAnimationSaveFailed",
  "提醒完成失败，请打开主脚本检查权限": "reminderCompletionFailed",
  "事项完成失败，请打开主脚本检查存储": "itemCompletionFailed",
}

/**
 * Returns the iPhone system language as a stable BCP-47 tag.
 *
 * The language values exposed by Scripting can disagree. On hosts that expose
 * both forms, systemLanguageTag/systemLanguageCode are authoritative;
 * preferredLanguages remains the compatibility fallback for older releases.
 */
export function configureWidgetLocale(device: WidgetLocaleDevice): void {
  configuredWidgetDevice = device
}

export function currentWidgetLocale(device?: WidgetLocaleDevice): string {
  try {
    const runtimeDevice = device
      ?? configuredWidgetDevice
      ?? (typeof Device !== "undefined" ? Device : undefined)
    if (runtimeDevice) {
      // Read each optional host value independently. One unavailable getter on
      // an older Scripting build must not hide another valid system-language
      // property and force the widget back to the host process locale.
      const preferredLanguages = readOptionalDeviceValue(() => runtimeDevice.preferredLanguages)
      const preferredValue = Array.isArray(preferredLanguages)
        ? preferredLanguages.find(value => typeof value === "string" && value.trim())
        : undefined
      const preferred = normalizeLocaleTag(preferredValue)
      const systemTag = normalizeLocaleTag(readOptionalDeviceValue(() => runtimeDevice.systemLanguageTag))
      const systemLocale = normalizeLocaleTag(readOptionalDeviceValue(() => runtimeDevice.systemLocale))
      const systemLanguageCode = readOptionalDeviceValue(() => runtimeDevice.systemLanguageCode)
      const systemScriptCode = readOptionalDeviceValue(() => runtimeDevice.systemScriptCode)
      const systemCountryCode = readOptionalDeviceValue(() => runtimeDevice.systemCountryCode)
      const assembledTag = [
        systemLanguageCode,
        systemScriptCode,
        systemCountryCode,
      ].filter(value => typeof value === "string" && value.trim()).join("-")
      const assembled = normalizeLocaleTag(assembledTag)
      let explicitSystemTag = systemTag
        && assembled
        && !systemTag.includes("-")
        && assembled.toLowerCase().startsWith(`${systemTag.toLowerCase()}-`)
        ? assembled
        : systemTag || assembled
      if (
        explicitSystemTag
        && !explicitSystemTag.includes("-")
        && systemLocale?.toLowerCase().startsWith(`${explicitSystemTag.toLowerCase()}-`)
      ) explicitSystemTag = systemLocale
      const normalized = normalizeLocaleTag(explicitSystemTag || systemLocale || preferred)
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

function readOptionalDeviceValue<T>(reader: () => T): T | undefined {
  try { return reader() }
  catch { return undefined }
}

export function widgetLanguage(locale: string, scriptCode = ""): WidgetLanguage {
  const normalized = `${locale}-${scriptCode}`.replaceAll("_", "-").toLowerCase()
  const languageCode = normalized.split("-")[0]
  if (languageCode !== "zh") return "en"
  // An explicit script is stronger than the region. This matters for valid
  // combinations such as zh-Hans-HK, which must remain Simplified Chinese.
  if (/(?:^|-)hant(?:-|$)/.test(normalized)) return "zh-Hant"
  if (/(?:^|-)hans(?:-|$)/.test(normalized)) return "zh-Hans"
  if (/(?:^|-)(?:tw|hk|mo)(?:-|$)/.test(normalized)) return "zh-Hant"
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
  // Never expose an arbitrary runtime error, identifier, or private source data
  // on the Home Screen. The app is the place to inspect diagnostic details.
  return widgetText(key ?? "actionNeedsReview", locale)
}

/** The small widget reserves one existing auxiliary line, not another row. */
export function formatWidgetItemTime(item: DisplayDueItem, locale: string): string {
  if (!item.includesTime) return ""
  const timestampDate = Number.isFinite(item.dueTimestamp)
    ? new Date(item.dueTimestamp)
    : null
  const timestampIsValid = timestampDate && Number.isFinite(timestampDate.getTime())
  const hour = timestampIsValid ? timestampDate.getHours() : clampInteger(item.hour, 0, 23)
  const minute = timestampIsValid ? timestampDate.getMinutes() : clampInteger(item.minute, 0, 59)
  const date = new Date(2000, 0, 1, hour, minute)
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date)
  } catch {
    return `${pad2(hour)}:${pad2(minute)}`
  }
}

/** A real timestamp, never a relative countdown or a new permanent status row. */
export function formatWidgetLastSync(
  fetchedAt: number | null,
  locale: string,
  now = new Date(),
): string {
  if (fetchedAt === null || !Number.isFinite(fetchedAt) || fetchedAt <= 0) {
    return widgetText("noSuccessfulSync", locale)
  }
  const date = new Date(fetchedAt)
  if (!Number.isFinite(date.getTime())) return widgetText("noSuccessfulSync", locale)
  const includesDate = localDateKey(date) !== localDateKey(now)
  let stamp: string
  try {
    stamp = new Intl.DateTimeFormat(locale, {
      month: includesDate ? "short" : undefined,
      day: includesDate ? "numeric" : undefined,
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      hour: "numeric",
      minute: "2-digit",
    }).format(date)
  } catch {
    stamp = `${includesDate ? `${localDateKey(date)} ` : ""}${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  }
  return `${widgetText("lastSynced", locale)} ${stamp}`
}

export function widgetCompletionLabel(item: DisplayDueItem, locale: string): string {
  return `${widgetText("completeItem", locale)}: ${item.title}`
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
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

const ENGLISH_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]
