import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  advanceManualItem,
  calendarDayDifference,
  createRecurrenceRule,
  dueStatus,
  MAX_REMIND_BEFORE_DAYS,
  MAX_RECURRENCE_INTERVAL,
  MIN_REMIND_BEFORE_DAYS,
  MIN_RECURRENCE_INTERVAL,
  nextOccurrence,
  parseDateKey,
  parseRemindBeforeDaysInput,
  parseRecurrenceIntervalInput,
} from "../到期管家/src/date.ts"
import {
  DUE_ICON_GROUPS,
  DUE_ICON_OPTIONS,
  dueIconLabel,
  normalizeIconOverride,
  REMINDER_LIST_ICON_RULES,
  resolveDueIcon,
  resolveReminderIcon,
} from "../到期管家/src/icons.ts"
import {
  isItemKind,
  ITEM_KIND_DEFINITIONS,
} from "../到期管家/src/item_kinds.ts"
import {
  kindColor,
  kindIcon,
  kindLabel,
} from "../到期管家/src/presentation.ts"
import {
  completeReminderOccurrence,
  findReminderDisplayItemForCompletion,
  isSnapshotStale,
  loadReminderItems,
  nextWidgetRefresh,
  sortDueItems,
} from "../到期管家/src/reminders.ts"
import {
  defaultState,
  deleteItem,
  loadState,
  manualItemsForDisplay,
  manualOccurrenceKey,
  planManualCompletion,
  REMINDER_SNAPSHOT_KEY,
  saveState,
  STATE_KEY,
  updateSettings,
  upsertItem,
} from "../到期管家/src/storage.ts"
import {
  clearWidgetCompletionFeedback,
  findManualDisplayItemForCompletion,
  mergeWidgetCompletionFeedback,
  readWidgetCompletionFeedback,
  readWidgetCompletionTransition,
  WIDGET_COMPLETION_FEEDBACK_KEY,
  writeWidgetCompletionFeedback,
} from "../到期管家/src/widget_completion.ts"
import {
  largeWidgetLayout,
  listItemTitleFontSize,
  smallItemTitleFontSize,
  visibleWidgetItems,
  widgetItemCapacity,
  widgetRowHeight,
} from "../到期管家/src/widget_layout.ts"
import {
  currentWidgetLocale,
  formatWidgetDate,
  formatWidgetItemDate,
  localizeWidgetActionError,
  widgetKindLabel,
  widgetLanguage,
  widgetText,
} from "../到期管家/src/widget_localization.ts"
import type { DisplayDueItem, ItemKind, ManualDueItem } from "../到期管家/src/types.ts"

const LEGACY_DUE_ICON_NAMES = [
  "creditcard.fill",
  "building.columns.fill",
  "banknote.fill",
  "cart.fill",
  "play.rectangle.fill",
  "music.note",
  "gamecontroller.fill",
  "newspaper.fill",
  "sparkles",
  "icloud.fill",
  "globe",
  "wifi",
  "iphone",
  "bolt.fill",
  "drop.fill",
  "flame.fill",
  "house.fill",
  "car.fill",
  "shield.fill",
  "cross.case.fill",
  "pawprint.fill",
  "figure.run",
  "graduationcap.fill",
  "airplane",
  "gift.fill",
  "ticket.fill",
  "doc.text.fill",
  "checklist",
  "repeat.circle.fill",
  "calendar.badge.clock",
] as const

type IconCase = readonly [title: string, kind: ItemKind | "reminder", expected: string]

function assertIconCases(cases: readonly IconCase[]): void {
  for (const [title, kind, expected] of cases) {
    assert.equal(resolveDueIcon(title, kind).name, expected, title)
  }
}

function item(overrides: Partial<ManualDueItem> = {}): ManualDueItem {
  return {
    id: "test",
    title: "Test",
    kind: "custom",
    iconName: null,
    dueDate: "2026-01-31",
    includesTime: false,
    hour: 9,
    minute: 0,
    remindBeforeDays: 0,
    recurrence: null,
    amount: "",
    note: "",
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function displayItem(overrides: Partial<DisplayDueItem>): DisplayDueItem {
  const dueDate = overrides.dueDate ?? "2026-08-31"
  const hour = overrides.hour ?? 0
  const minute = overrides.minute ?? 0
  const includesTime = overrides.includesTime ?? false
  return {
    id: overrides.id ?? dueDate,
    source: "manual",
    completionKey: overrides.completionKey ?? `occurrence-${overrides.id ?? dueDate}`,
    title: overrides.title ?? dueDate,
    kind: "custom",
    iconName: "calendar.badge.clock",
    iconColor: "systemTeal",
    dueDate,
    includesTime,
    hour,
    minute,
    remindBeforeDays: overrides.remindBeforeDays ?? 0,
    dueTimestamp: overrides.dueTimestamp
      ?? new Date(
        2026,
        Number(dueDate.slice(5, 7)) - 1,
        Number(dueDate.slice(8, 10)),
        includesTime ? hour : 23,
        includesTime ? minute : 59,
        includesTime ? 0 : 59,
        includesTime ? 0 : 999,
      ).getTime(),
    amount: "",
    note: "",
    priority: overrides.priority ?? 1,
    stale: false,
    canComplete: overrides.canComplete ?? true,
    ...overrides,
  }
}

test("validates local date keys", () => {
  assert.deepEqual(parseDateKey("2028-02-29"), { year: 2028, month: 2, day: 29 })
  assert.equal(parseDateKey("2027-02-29"), null)
  assert.equal(parseDateKey("2026-13-01"), null)
})

test("icon catalog is grouped, unique, and keeps every saved legacy symbol valid", () => {
  assert.ok(DUE_ICON_OPTIONS.length >= 100)
  assert.equal(new Set(DUE_ICON_OPTIONS.map(option => option.name)).size, DUE_ICON_OPTIONS.length)
  assert.equal(new Set(DUE_ICON_OPTIONS.map(option => option.label)).size, DUE_ICON_OPTIONS.length)

  const declaredGroups = new Set(DUE_ICON_GROUPS)
  for (const group of DUE_ICON_GROUPS) {
    assert.ok(DUE_ICON_OPTIONS.some(option => option.group === group), `${group} must not be empty`)
  }
  for (const option of DUE_ICON_OPTIONS) {
    assert.ok(declaredGroups.has(option.group), `${option.name} uses an undeclared group`)
  }
  for (const legacyName of LEGACY_DUE_ICON_NAMES) {
    assert.ok(
      DUE_ICON_OPTIONS.some(option => option.name === legacyName),
      `${legacyName} must remain available for saved manual overrides`,
    )
  }
})

test("every due icon exposes its human-readable widget label", () => {
  for (const option of DUE_ICON_OPTIONS) {
    assert.equal(dueIconLabel(option.name, "zh-Hans"), option.label, option.name)
    assert.ok(dueIconLabel(option.name, "en").length > 0, option.name)
    assert.doesNotMatch(dueIconLabel(option.name, "en"), /[\u3400-\u9fff]/u, option.name)
    assert.ok(dueIconLabel(option.name, "zh-Hant").length > 0, option.name)
  }
  assert.equal(dueIconLabel("not.a.real.symbol", "zh-Hans"), "日期")
  assert.equal(dueIconLabel(null, "zh-Hans"), "日期")
  assert.equal(dueIconLabel(undefined, "zh-Hans"), "日期")
  assert.equal(dueIconLabel("shippingbox.fill", "en"), "Delivery")
  assert.equal(dueIconLabel("icloud.fill", "zh-Hant"), "雲存儲")
  assert.equal(dueIconLabel("doc.text.magnifyingglass", "zh-Hant"), "稅務會計")
  assert.equal(dueIconLabel("ticket.fill", "zh-Hant"), "票券會員")
  assert.equal(dueIconLabel("film.fill", "zh-Hant"), "影片製作")
  assert.equal(dueIconLabel(null, "en"), "Dates")
})

test("widget localization maps supported system language tags and scripts", () => {
  assert.equal(widgetLanguage("zh-Hans-CN"), "zh-Hans")
  assert.equal(widgetLanguage("zh-Hant-HK"), "zh-Hant")
  assert.equal(widgetLanguage("zh-TW"), "zh-Hant")
  assert.equal(widgetLanguage("zh-Hans-HK"), "zh-Hans")
  assert.equal(widgetLanguage("zh-Hant-CN"), "zh-Hant")
  assert.equal(widgetLanguage("zh", "Hant"), "zh-Hant")
  assert.equal(widgetLanguage("en-US"), "en")
  assert.equal(widgetLanguage("fr-FR"), "en")

  assert.equal(widgetText("appName", "en-US"), "Due Manager")
  assert.equal(widgetText("needsAction", "zh-Hans-CN"), "需要处理")
  assert.equal(widgetText("needsAction", "zh-Hant-HK"), "需要處理")
  assert.equal(widgetKindLabel("subscription", "en-US"), "Subscriptions")
  assert.equal(widgetKindLabel("credential", "zh-Hant-HK"), "證件合約")
  assert.equal(
    localizeWidgetActionError("提醒完成失败，请打开主脚本检查权限", "en-US"),
    "Couldn’t complete the reminder; check access in the main script",
  )
})

test("widget dates use the system locale while remaining absolute", () => {
  const now = new Date(2026, 8, 1, 12, 0)
  assert.equal(formatWidgetDate("2026-09-04", "zh-Hans-CN", { now }), "9月4日")
  assert.equal(formatWidgetDate("2026-09-04", "zh-Hant-HK", { now }), "9月4日")
  assert.equal(formatWidgetDate("2026-09-04", "en-US", { now }), "Sep 4")
  assert.equal(formatWidgetDate("2027-09-04", "en-US", { now }), "Sep 4, 2027")

  const timed = displayItem({
    dueDate: "2026-09-04",
    includesTime: true,
    hour: 18,
    minute: 5,
    dueTimestamp: new Date(2026, 8, 4, 18, 5).getTime(),
  })
  const localized = formatWidgetItemDate(timed, "en-US", now)
  assert.match(localized, /^Sep 4(?:,| at) 6:05 PM$/)
  assert.doesNotMatch(localized, /today|tomorrow|in \d+ days?|overdue/i)
})

test("widget locale follows the iPhone system language before Scripting's preferred locale", () => {
  const originalDevice = (globalThis as any).Device
  try {
    assert.equal(currentWidgetLocale({
      preferredLanguages: ["zh-Hans-CN"],
      systemLanguageTag: "en-US",
    }), "en-US")

    ;(globalThis as any).Device = {
      preferredLanguages: ["zh-Hant-HK", "en-US"],
      systemLanguageTag: "en-US",
      systemLanguageCode: "en",
    }
    assert.equal(currentWidgetLocale(), "en-US")
    assert.equal(
      dueIconLabel("doc.text.magnifyingglass", widgetLanguage(currentWidgetLocale())),
      "Tax & Accounting",
    )

    ;(globalThis as any).Device = {
      preferredLanguages: ["zh"],
      systemLanguageTag: "zh-Hant-HK",
      systemLanguageCode: "zh",
      systemScriptCode: "Hant",
      systemCountryCode: "HK",
    }
    assert.equal(currentWidgetLocale(), "zh-Hant-HK")

    ;(globalThis as any).Device = {
      preferredLanguages: ["en-GB"],
    }
    assert.equal(currentWidgetLocale(), "en-GB")

    ;(globalThis as any).Device = {
      preferredLanguages: ["zh-Hans-CN"],
      systemLocale: "en_GB",
    }
    assert.equal(currentWidgetLocale(), "en-GB")

    ;(globalThis as any).Device = {
      preferredLanguages: ["zh-Hans-CN"],
      systemLanguageCode: "en",
      systemLocale: "en_GB",
    }
    assert.equal(currentWidgetLocale(), "en-GB")

    ;(globalThis as any).Device = {
      get preferredLanguages() { throw new Error("unavailable") },
      systemLanguageTag: "en-US",
    }
    assert.equal(currentWidgetLocale(), "en-US")

    ;(globalThis as any).Device = {
      preferredLanguages: [],
      systemLanguageCode: "zh",
      systemScriptCode: "Hans",
      systemCountryCode: "CN",
    }
    assert.equal(currentWidgetLocale(), "zh-Hans-CN")
  } finally {
    ;(globalThis as any).Device = originalDevice
  }
})

test("item kinds have one centralized ordered and unique definition", () => {
  assert.deepEqual(
    ITEM_KIND_DEFINITIONS.map(definition => definition.value),
    [
      "creditCard",
      "subscription",
      "bill",
      "repayment",
      "insurance",
      "digitalService",
      "credential",
      "maintenance",
      "appointment",
      "occasion",
      "custom",
    ],
  )
  assert.deepEqual(
    ITEM_KIND_DEFINITIONS.map(definition => definition.label),
    [
      "信用卡",
      "订阅会员",
      "账单缴费",
      "贷款分期",
      "保险保单",
      "数字服务",
      "证件合同",
      "保养维护",
      "预约日程",
      "纪念日期",
      "其他事项",
    ],
  )
  assert.deepEqual(
    ITEM_KIND_DEFINITIONS.map(definition => definition.priority),
    [4, 2, 3, 4, 3, 2, 3, 1, 1, 1, 1],
  )
  assert.equal(ITEM_KIND_DEFINITIONS.length, 11)
  assert.equal(
    new Set(ITEM_KIND_DEFINITIONS.map(definition => definition.value)).size,
    ITEM_KIND_DEFINITIONS.length,
  )
  assert.equal(
    new Set(ITEM_KIND_DEFINITIONS.map(definition => definition.label)).size,
    ITEM_KIND_DEFINITIONS.length,
  )
})

test("every item kind uses a selectable fallback icon and consistent presentation", () => {
  const selectableIcons = new Set(DUE_ICON_OPTIONS.map(option => option.name))
  for (const definition of ITEM_KIND_DEFINITIONS) {
    assert.ok(
      selectableIcons.has(definition.icon),
      `${definition.label} fallback ${definition.icon} must be selectable`,
    )
    assert.equal(
      resolveDueIcon("Project Zephyr 8472", definition.value).name,
      definition.icon,
      `${definition.label} must use its centralized fallback`,
    )
    assert.equal(kindLabel(definition.value), definition.label)
    assert.equal(kindIcon(definition.value), definition.icon)
    assert.equal(kindColor(definition.value), definition.color)
    const state = {
      ...defaultState(1),
      items: [item({ kind: definition.value })],
    }
    assert.equal(manualItemsForDisplay(state)[0].priority, definition.priority)
  }

  assert.equal(kindLabel("reminder"), "提醒事项")
  assert.equal(kindIcon("reminder"), "checklist")
  assert.equal(kindColor("reminder"), "systemPink")
})

test("item kind validation accepts every definition and rejects unknown values", () => {
  for (const definition of ITEM_KIND_DEFINITIONS) {
    assert.equal(isItemKind(definition.value), true, definition.value)
  }
  assert.equal(isItemKind("reminder"), false)
  assert.equal(isItemKind("unknown"), false)
  assert.equal(isItemKind(""), false)
  assert.equal(isItemKind(null), false)
})

test("legacy state upgrades to schema 3 and preserves old and new item kinds", () => {
  const originalStorage = (globalThis as any).Storage
  const legacyKinds = ["creditCard", "subscription", "bill", "custom"] as const
  let sharedValue: any = {
    schemaVersion: 1,
    items: legacyKinds.map((kind, index) => item({
      id: `legacy-kind-${index}`,
      title: `Legacy ${kind}`,
      kind,
    })),
    settings: {},
    updatedAt: 1,
  }
  try {
    ;(globalThis as any).Storage = {
      get: (key: string, options?: { shared: boolean }) => (
        key === STATE_KEY && options?.shared ? sharedValue : null
      ),
      set: (key: string, value: unknown, options?: { shared: boolean }) => {
        if (key === STATE_KEY && options?.shared) sharedValue = value
        return true
      },
      remove: () => undefined,
      contains: () => true,
    }

    const migrated = loadState()
    assert.equal(migrated.schemaVersion, 3)
    assert.deepEqual(migrated.items.map(value => value.kind), legacyKinds)

    const next = {
      ...migrated,
      items: [...migrated.items, item({
        id: "new-insurance-kind",
        title: "Insurance renewal",
        kind: "insurance",
      })],
      updatedAt: 2,
    }
    assert.equal(saveState(next), true)
    assert.equal(sharedValue.schemaVersion, 3)
    assert.equal(
      loadState().items.find(value => value.id === "new-insurance-kind")?.kind,
      "insurance",
    )

    sharedValue = {
      ...sharedValue,
      items: [
        { ...item({ id: "unknown-kind" }), kind: "future-kind" },
      ],
    }
    assert.equal(loadState().items[0].kind, "custom")
  } finally {
    ;(globalThis as any).Storage = originalStorage
  }
})

test("schema 1 and 2 items migrate with no early-action offset", () => {
  const originalStorage = (globalThis as any).Storage
  try {
    for (const schemaVersion of [1, 2]) {
      const sharedValue = {
        schemaVersion,
        items: [{
          id: `legacy-schema-${schemaVersion}`,
          title: `Legacy schema ${schemaVersion}`,
          dueDate: "2026-09-30",
        }],
        settings: {},
        updatedAt: schemaVersion,
      }
      ;(globalThis as any).Storage = {
        get: (key: string, options?: { shared: boolean }) => (
          key === STATE_KEY && options?.shared ? sharedValue : null
        ),
        set: () => true,
        remove: () => undefined,
        contains: () => true,
      }

      const migrated = loadState()
      assert.equal(migrated.schemaVersion, 3)
      assert.equal(migrated.items[0].remindBeforeDays, 0)
    }
  } finally {
    ;(globalThis as any).Storage = originalStorage
  }
})

test("early-action days use the complete zero-to-three-hundred-sixty-five storage domain", () => {
  assert.equal(MIN_REMIND_BEFORE_DAYS, 0)
  assert.equal(MAX_REMIND_BEFORE_DAYS, 365)
  assert.equal(parseRemindBeforeDaysInput("0"), 0)
  assert.equal(parseRemindBeforeDaysInput(" 3 "), 3)
  assert.equal(parseRemindBeforeDaysInput("365"), 365)
  for (const invalid of ["", "-1", "366", "1.5", "+2", "1e2", "not-a-number"]) {
    assert.equal(parseRemindBeforeDaysInput(invalid), null, invalid)
  }

  const originalStorage = (globalThis as any).Storage
  const sharedValue = {
    schemaVersion: 3,
    items: [-1, 0, 3, 365, 366].map((remindBeforeDays, index) => ({
      ...item({ id: `remind-boundary-${index}` }),
      remindBeforeDays,
    })),
    settings: {},
    updatedAt: 1,
  }
  try {
    ;(globalThis as any).Storage = {
      get: (key: string, options?: { shared: boolean }) => (
        key === STATE_KEY && options?.shared ? sharedValue : null
      ),
      set: () => true,
      remove: () => undefined,
      contains: () => true,
    }

    assert.deepEqual(
      loadState().items.map(value => value.remindBeforeDays),
      [0, 0, 3, 365, 365],
    )
  } finally {
    ;(globalThis as any).Storage = originalStorage
  }
})

test("every intelligent icon rule points to a selectable catalog icon", () => {
  const source = readFileSync(
    new URL("../到期管家/src/icons.ts", import.meta.url),
    "utf8",
  )
  const rulesStart = source.indexOf("const ICON_RULES")
  const rulesEnd = source.indexOf("const KIND_FALLBACKS", rulesStart)
  assert.ok(rulesStart >= 0 && rulesEnd > rulesStart)

  const catalogNames = new Set(DUE_ICON_OPTIONS.map(option => option.name))
  const ruleIcons = [...source.slice(rulesStart, rulesEnd).matchAll(/\bicon:\s*"([^"]+)"/g)]
    .map(match => match[1])
  assert.ok(ruleIcons.length > 0)
  for (const iconName of ruleIcons) {
    assert.ok(catalogNames.has(iconName), `${iconName} is referenced by a rule but missing from the picker`)
  }
})

test("intelligent icons cover common App Store and subscription directions locally", () => {
  assertIconCases([
    ["Claude Pro", "subscription", "sparkles"],
    ["Ｓｐｏｔｉｆｙ 家庭会员", "subscription", "music.note"],
    ["网易云音乐黑胶会员", "subscription", "music.note"],
    ["Netflix", "subscription", "play.rectangle.fill"],
    ["Audible membership", "subscription", "headphones"],
    ["Apple Arcade", "subscription", "gamecontroller.fill"],
    ["NBA League Pass", "subscription", "sportscourt.fill"],
    ["The New York Times", "subscription", "newspaper.fill"],
    ["Kindle Unlimited", "subscription", "book.closed.fill"],
    ["Microsoft 365", "subscription", "briefcase.fill"],
    ["Todoist Pro", "subscription", "checkmark.circle.fill"],
    ["1Password Families", "subscription", "key.fill"],
    ["NordVPN renewal", "subscription", "lock.shield.fill"],
    ["Backblaze cloud backup", "subscription", "externaldrive.fill"],
    ["CamScanner Premium", "subscription", "scanner.fill"],
    ["Headspace annual plan", "subscription", "figure.mind.and.body"],
    ["AllTrails+", "subscription", "map.fill"],
    ["BANK 03 | SoFi", "reminder", "building.columns.fill"],
    ["CREDIT 03 | Venture", "reminder", "creditcard.fill"],
    ["家庭电费", "bill", "bolt.fill"],
    ["车辆车险", "bill", "car.fill"],
  ])
})

test("specific brands and product families beat broader matching rules", () => {
  assertIconCases([
    ["YouTube Music Premium", "subscription", "music.note"],
    ["Amazon Prime Video", "subscription", "play.rectangle.fill"],
    ["Amazon Prime", "subscription", "shippingbox.fill"],
    ["Adobe Creative Cloud", "subscription", "paintpalette.fill"],
    ["GitHub Copilot", "subscription", "sparkles"],
    ["GitHub Pro", "subscription", "curlybraces.square.fill"],
    ["Apple Music", "subscription", "music.note"],
    ["Apple TV+", "subscription", "play.rectangle.fill"],
    ["Apple TV Plus", "subscription", "play.rectangle.fill"],
    ["Apple News+", "subscription", "newspaper.fill"],
    ["Apple News Plus", "subscription", "newspaper.fill"],
    ["Apple Fitness+", "subscription", "dumbbell.fill"],
    ["iCloud+", "subscription", "icloud.fill"],
    ["iCloud Plus", "subscription", "icloud.fill"],
    ["Apple One", "subscription", "square.grid.2x2.fill"],
    ["AppleCare+", "subscription", "shield.lefthalf.filled"],
    ["Apple Developer Program", "subscription", "curlybraces.square.fill"],
  ])
})

test("manual icon override wins and invalid values return to automatic matching", () => {
  assert.equal(resolveDueIcon("Claude Pro", "subscription", "drop.fill").name, "drop.fill")
  assert.equal(normalizeIconOverride("not.a.real.allowed.symbol"), null)
  assert.equal(resolveDueIcon("Claude Pro", "subscription", "not.a.real.allowed.symbol").name, "sparkles")
})

test("icon matching avoids broad Chinese substring false positives", () => {
  assertIconCases([
    ["会议时间移动到周五", "custom", "calendar.badge.clock"],
    ["电信诈骗新闻订阅", "custom", "newspaper.fill"],
    ["天然气候研究", "custom", "calendar.badge.clock"],
    ["保险箱密码轮换", "custom", "key.fill"],
    ["银行家杂志订阅", "custom", "newspaper.fill"],
    ["移动硬盘备份", "custom", "externaldrive.fill"],
    ["主机游戏会员", "custom", "gamecontroller.fill"],
    ["加油打气", "custom", "calendar.badge.clock"],
  ])
})

test("icon matching uses English word boundaries", () => {
  assertIconCases([
    ["Current account review", "custom", "calendar.badge.clock"],
    ["Home internet renewal", "subscription", "wifi"],
    ["Steamship maintenance", "custom", "calendar.badge.clock"],
    ["Bankruptcy article", "custom", "calendar.badge.clock"],
    ["Notional planning", "custom", "calendar.badge.clock"],
    ["Netflixify deployment", "custom", "calendar.badge.clock"],
    ["Canvas replacement", "custom", "calendar.badge.clock"],
    ["Gymnasium tuition", "custom", "graduationcap.fill"],
    ["Project X Premium", "custom", "calendar.badge.clock"],
    ["X Premium", "subscription", "bubble.left.and.bubble.right.fill"],
    ["Car repair plan", "custom", "calendar.badge.clock"],
    ["Home repair plan", "subscription", "hammer.fill"],
  ])

  const source = readFileSync(
    new URL("../到期管家/src/icons.ts", import.meta.url),
    "utf8",
  )
  assert.doesNotMatch(source, /toLocaleLowerCase\s*\(/)
})

test("unmatched titles use stable ItemKind fallbacks instead of catalog order", () => {
  assertIconCases([
    ["Project Zephyr 8472", "creditCard", "creditcard.fill"],
    ["Project Zephyr 8472", "subscription", "repeat.circle.fill"],
    ["Project Zephyr 8472", "bill", "doc.text.fill"],
    ["Project Zephyr 8472", "custom", "calendar.badge.clock"],
    ["Project Zephyr 8472", "reminder", "checklist"],
  ])

  const source = readFileSync(
    new URL("../到期管家/src/icons.ts", import.meta.url),
    "utf8",
  )
  assert.doesNotMatch(
    source,
    /DUE_ICON_OPTIONS\s*\[\s*DUE_ICON_OPTIONS\.length\s*-\s*1\s*\]/,
  )
  assert.doesNotMatch(source, /DUE_ICON_OPTIONS\.at\(\s*-1\s*\)/)
})

test("reminder icons resolve title, list and notes in strict priority order", () => {
  const cases = [
    {
      title: "家庭电费",
      calendarTitle: "Adobe Creative Cloud",
      notes: "NordVPN renewal",
      expected: "bolt.fill",
    },
    {
      title: "月底处理",
      calendarTitle: "音乐订阅",
      notes: "Amazon Prime Video",
      expected: "music.note",
    },
    {
      title: "月底处理",
      calendarTitle: "个人",
      notes: "账号资料\n1Password Families",
      expected: "key.fill",
    },
    {
      title: "整理书桌",
      calendarTitle: "个人",
      notes: "周末完成",
      expected: "checklist",
    },
  ] as const

  for (const value of cases) {
    assert.equal(
      resolveReminderIcon(value.title, value.calendarTitle, value.notes).name,
      value.expected,
      `${value.title} / ${value.calendarTitle}`,
    )
  }
})

test("reminder icons recognize common task language and list categories", () => {
  const titleCases = [
    ["下班买菜", "cart.fill"],
    ["去驿站取快递", "shippingbox.fill"],
    ["晚饭后吃药", "pills.fill"],
    ["晚上健身", "figure.run"],
    ["参加团队会议", "briefcase.fill"],
    ["提交数学作业", "graduationcap.fill"],
    ["给妈妈打电话", "phone.fill"],
    ["下楼遛狗", "pawprint.fill"],
    ["晚上倒垃圾", "trash.fill"],
  ] as const
  for (const [title, expected] of titleCases) {
    assert.equal(resolveReminderIcon(title, "个人", "").name, expected, title)
  }

  const listCases = [
    ["工作", "briefcase.fill"],
    ["购物", "cart.fill"],
    ["家庭", "house.fill"],
    ["健康", "heart.text.square.fill"],
    ["学习", "graduationcap.fill"],
    ["旅行", "suitcase.rolling.fill"],
    ["订阅", "repeat.circle.fill"],
    ["账单", "doc.text.fill"],
    ["Delivery", "shippingbox.fill"],
    ["📦 Delivery List", "shippingbox.fill"],
    ["物流清单", "shippingbox.fill"],
    ["🛒 购物清单", "cart.fill"],
    ["Work Reminders", "briefcase.fill"],
    ["旅行计划", "suitcase.rolling.fill"],
  ] as const
  for (const [calendarTitle, expected] of listCases) {
    assert.equal(
      resolveReminderIcon("例行事项", calendarTitle, "").name,
      expected,
      calendarTitle,
    )
  }
})

test("reminder List taxonomy covers every declared alias and common suffix", () => {
  const iconNames = new Set(DUE_ICON_OPTIONS.map(option => option.name))
  const normalizedAliases = new Set<string>()
  let aliasCount = 0

  const normalizeAlias = (value: string) => value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()

  for (const rule of REMINDER_LIST_ICON_RULES) {
    assert.equal(iconNames.has(rule.icon), true, rule.icon)
    for (const alias of rule.aliases) {
      const normalized = normalizeAlias(alias)
      assert.notEqual(normalized, "", `${rule.icon} has an empty alias`)
      assert.equal(
        normalizedAliases.has(normalized),
        false,
        `duplicate normalized reminder List alias: ${normalized}`,
      )
      normalizedAliases.add(normalized)
      aliasCount += 1

      assert.equal(resolveReminderIcon("847291", alias, "").name, rule.icon, alias)
      assert.equal(resolveReminderIcon("847291", `📌 ${alias} List`, "").name, rule.icon, `${alias} List`)
      assert.equal(resolveReminderIcon("847291", `📌 ${alias} 清单`, "").name, rule.icon, `${alias} 清单`)
    }
  }

  assert.ok(REMINDER_LIST_ICON_RULES.length >= 100)
  assert.ok(aliasCount >= 1000)
})

test("reminder List matching keeps exact boundaries and layered priority", () => {
  const falsePositiveLists = [
    "工作室",
    "健康码",
    "音乐会",
    "银行家",
    "快遞員培訓",
    "購物預算",
    "Deliverance",
    "DeliveryOps",
    "workshop",
    "Taskmaster",
    "carpet",
    "Old Delivery List",
    "Not Work List",
  ]
  for (const calendarTitle of falsePositiveLists) {
    assert.equal(
      resolveReminderIcon("847291", calendarTitle, "").name,
      "checklist",
      calendarTitle,
    )
  }

  assert.equal(
    resolveReminderIcon("847291", "📦 Ｄｅｌｉｖｅｒｙ—Ｌｉｓｔ ✅", "").name,
    "shippingbox.fill",
  )
  assert.equal(resolveReminderIcon("家庭电费", "Delivery", "").name, "bolt.fill")
  assert.equal(resolveReminderIcon("去驿站取快递", "Work", "").name, "shippingbox.fill")
  assert.equal(resolveReminderIcon("Amazon Prime Video", "Delivery", "").name, "play.rectangle.fill")

  const source = readFileSync(
    new URL("../到期管家/src/icons.ts", import.meta.url),
    "utf8",
  )
  const resolver = source.slice(
    source.indexOf("export function resolveReminderIcon"),
    source.indexOf("function resolvedIcon"),
  )
  assert.ok(
    resolver.indexOf("bestMatchingReminderListIcon(calendarTitle)")
      < resolver.indexOf("bestMatchingIcon(calendarTitle)"),
    "an exact List category must outrank product-text inference within the List name",
  )
})

test("reminder icon matching keeps false-positive protection in every source", () => {
  assert.equal(
    resolveReminderIcon(
      "会议时间移动到周五",
      "天然气候研究",
      "Steamship maintenance and Netflixify deployment",
    ).name,
    "checklist",
  )
  assert.equal(
    resolveReminderIcon("月底处理", "银行家杂志订阅", "家庭电费").name,
    "newspaper.fill",
  )
  assert.equal(
    resolveReminderIcon("月底处理", "移动硬盘备份", "Amazon Prime Video").name,
    "externaldrive.fill",
  )
  assert.equal(
    resolveReminderIcon("月底处理", "健康码", "加油打气").name,
    "checklist",
  )
  assert.equal(
    resolveReminderIcon("Amazon", "Prime", "Video").name,
    "checklist",
    "separate fields must not combine into the phrase Amazon Prime Video",
  )
})

test("calendar-day differences do not depend on DST hours", () => {
  assert.equal(calendarDayDifference("2026-03-07", "2026-03-09"), 2)
  assert.equal(calendarDayDifference("2026-11-01", "2026-11-02"), 1)
})

test("monthly recurrence preserves a 31st anchor after February", () => {
  const rule = createRecurrenceRule("month", 1, "2025-01-31")
  const february = nextOccurrence("2025-01-31", rule)
  const march = nextOccurrence(february, rule)
  assert.equal(february, "2025-02-28")
  assert.equal(march, "2025-03-31")
})

test("monthly recurrence handles leap February and true month-end", () => {
  const anchor31 = createRecurrenceRule("month", 1, "2028-01-31")
  assert.equal(nextOccurrence("2028-01-31", anchor31), "2028-02-29")

  const monthEnd = createRecurrenceRule("month", 1, "2026-04-30", true)
  assert.equal(nextOccurrence("2026-04-30", monthEnd), "2026-05-31")
})

test("early-action offsets do not shift the real recurrence anchor", () => {
  const recurring = item({
    dueDate: "2026-01-31",
    remindBeforeDays: 3,
    recurrence: createRecurrenceRule("month", 1, "2026-01-31"),
  })

  const february = advanceManualItem(recurring, { now: new Date(2026, 0, 28, 12, 0) })
  const march = advanceManualItem(february, { now: new Date(2026, 1, 25, 12, 0) })

  assert.equal(february.dueDate, "2026-02-28")
  assert.equal(march.dueDate, "2026-03-31")
  assert.equal(march.recurrence?.anchorDay, 31)
  assert.equal(march.remindBeforeDays, 3)
})

test("quarterly recurrence crosses the year", () => {
  const quarterly = createRecurrenceRule("month", 3, "2026-12-31")
  assert.equal(nextOccurrence("2026-12-31", quarterly), "2027-03-31")
})

test("custom recurrence intervals above twelve are preserved for every unit", () => {
  const cases = [
    ["day", 45, "2026-01-31", "2026-03-17"],
    ["week", 24, "2026-01-01", "2026-06-18"],
    ["month", 18, "2026-01-31", "2027-07-31"],
    ["year", 13, "2024-02-29", "2037-02-28"],
  ] as const

  for (const [unit, interval, dueDate, expected] of cases) {
    const rule = createRecurrenceRule(unit, interval, dueDate)
    assert.equal(rule.interval, interval, `${unit} must keep the custom interval`)
    assert.equal(nextOccurrence(dueDate, rule), expected, `${unit} must apply the custom interval`)
  }
})

test("recurrence interval normalization uses the full one-to-ninety-nine domain", () => {
  assert.equal(MIN_RECURRENCE_INTERVAL, 1)
  assert.equal(MAX_RECURRENCE_INTERVAL, 99)
  assert.equal(
    createRecurrenceRule("day", 0, "2026-01-01").interval,
    MIN_RECURRENCE_INTERVAL,
  )
  assert.equal(createRecurrenceRule("day", 13, "2026-01-01").interval, 13)
  assert.equal(
    createRecurrenceRule("day", MAX_RECURRENCE_INTERVAL, "2026-01-01").interval,
    MAX_RECURRENCE_INTERVAL,
  )
  assert.equal(
    createRecurrenceRule("day", MAX_RECURRENCE_INTERVAL + 1, "2026-01-01").interval,
    MAX_RECURRENCE_INTERVAL,
  )
})

test("custom recurrence input accepts only integers from one through ninety-nine", () => {
  assert.equal(parseRecurrenceIntervalInput("1"), 1)
  assert.equal(parseRecurrenceIntervalInput("12"), 12)
  assert.equal(parseRecurrenceIntervalInput("13"), 13)
  assert.equal(parseRecurrenceIntervalInput(" 24 "), 24)
  assert.equal(parseRecurrenceIntervalInput("99"), 99)

  for (const invalid of [
    "",
    " ",
    "0",
    "100",
    "1.5",
    "1e1",
    "+2",
    "-2",
    "not-a-number",
    "9007199254740993",
  ]) {
    assert.equal(parseRecurrenceIntervalInput(invalid), null, invalid)
  }
})

test("stored recurrence intervals above twelve survive normalization", () => {
  const originalStorage = (globalThis as any).Storage
  const storedIntervals = [13, 24, 99]
  const sharedValue = {
    schemaVersion: 2,
    items: storedIntervals.map((interval, index) => item({
      id: `custom-interval-${interval}`,
      recurrence: {
        ...createRecurrenceRule("month", 1, "2026-01-31"),
        interval,
      },
      createdAt: index + 1,
      updatedAt: index + 1,
    })),
    settings: {},
    updatedAt: 1,
  }

  try {
    ;(globalThis as any).Storage = {
      get: (key: string, options?: { shared: boolean }) => (
        key === STATE_KEY && options?.shared ? sharedValue : null
      ),
      set: () => true,
      remove: () => undefined,
      contains: () => true,
    }

    assert.deepEqual(
      loadState().items.map(value => value.recurrence?.interval),
      storedIntervals,
    )
  } finally {
    ;(globalThis as any).Storage = originalStorage
  }
})

test("yearly leap-day anchors recover on the next leap year", () => {
  const rule = createRecurrenceRule("year", 1, "2024-02-29", false, "feb28")
  let due = "2024-02-29"
  due = nextOccurrence(due, rule)
  assert.equal(due, "2025-02-28")
  due = nextOccurrence(due, rule)
  due = nextOccurrence(due, rule)
  due = nextOccurrence(due, rule)
  assert.equal(due, "2028-02-29")
})

test("yearly leap-day can use March 1 in non-leap years", () => {
  const rule = createRecurrenceRule("year", 1, "2024-02-29", false, "mar1")
  assert.equal(nextOccurrence("2024-02-29", rule), "2025-03-01")
})

test("completing once never hides accumulated overdue periods", () => {
  const recurring = item({
    dueDate: "2026-01-31",
    recurrence: createRecurrenceRule("month", 1, "2026-01-31"),
  })
  const advanced = advanceManualItem(recurring, {
    now: new Date(2026, 7, 30, 12, 0),
  })
  assert.equal(advanced.dueDate, "2026-02-28")
})

test("skip-to-future advances through every missed recurrence", () => {
  const recurring = item({
    dueDate: "2026-01-31",
    recurrence: createRecurrenceRule("month", 1, "2026-01-31"),
  })
  const advanced = advanceManualItem(recurring, {
    skipToFuture: true,
    now: new Date(2026, 7, 30, 12, 0),
  })
  assert.equal(advanced.dueDate, "2026-08-31")
})

test("skip-to-future uses the early action date rather than the real due date", () => {
  const recurring = item({
    dueDate: "2026-01-31",
    remindBeforeDays: 3,
    recurrence: createRecurrenceRule("month", 1, "2026-01-31"),
  })
  const advanced = advanceManualItem(recurring, {
    skipToFuture: true,
    now: new Date(2026, 7, 30, 12, 0),
  })

  assert.equal(advanced.dueDate, "2026-09-30")
  assert.equal(advanced.recurrence?.anchorDay, 31)
})

test("date-only items stay due today until local midnight", () => {
  const sameDay = item({ dueDate: "2026-08-30" })
  const today = dueStatus(sameDay, new Date(2026, 7, 30, 23, 59, 59))
  const tomorrow = dueStatus(sameDay, new Date(2026, 7, 31, 0, 0, 1))
  assert.equal(today.label, "今天")
  assert.equal(today.overdue, false)
  assert.equal(tomorrow.label, "逾期 1 天")
  assert.equal(tomorrow.overdue, true)
})

test("an early action window never reports an item overdue before its real due date", () => {
  const early = item({
    dueDate: "2026-09-30",
    remindBeforeDays: 3,
  })

  const beforeWindow = dueStatus(early, new Date(2026, 8, 26, 12, 0))
  assert.equal(beforeWindow.label, "明天提醒")
  assert.equal(beforeWindow.needsAction, false)
  assert.equal(beforeWindow.overdue, false)

  for (const now of [
    new Date(2026, 8, 27, 0, 0),
    new Date(2026, 8, 29, 23, 59),
  ]) {
    const status = dueStatus(early, now)
    assert.equal(status.label, "需处理")
    assert.equal(status.needsAction, true)
    assert.equal(status.overdue, false)
  }

  const actuallyOverdue = dueStatus(early, new Date(2026, 9, 1, 0, 0))
  assert.equal(actuallyOverdue.overdue, true)
  assert.equal(actuallyOverdue.label, "逾期 1 天")
})

test("timed items become due at their configured clock time", () => {
  const timed = item({ dueDate: "2026-08-30", includesTime: true, hour: 18, minute: 0 })
  assert.equal(dueStatus(timed, new Date(2026, 7, 30, 17, 59)).label, "今天")
  assert.equal(dueStatus(timed, new Date(2026, 7, 30, 18, 0)).label, "已到期")
})

test("completing a one-time item hides it", () => {
  const completed = advanceManualItem(item(), { now: new Date(2026, 0, 31) })
  assert.equal(completed.enabled, false)
})

test("sorting puts overdue, today, and future items in urgency order", () => {
  const now = new Date(2026, 7, 30, 12, 0)
  const sorted = sortDueItems([
    displayItem({ id: "future", dueDate: "2026-09-01" }),
    displayItem({ id: "today", dueDate: "2026-08-30" }),
    displayItem({ id: "overdue", dueDate: "2026-08-29" }),
  ], now)
  assert.deepEqual(sorted.map(value => value.id), ["overdue", "today", "future"])
})

test("future items sort by their early action date before their real due date", () => {
  const now = new Date(2026, 8, 1, 12, 0)
  const sorted = sortDueItems([
    displayItem({
      id: "sooner-due",
      dueDate: "2026-09-10",
      remindBeforeDays: 0,
    }),
    displayItem({
      id: "earlier-action",
      dueDate: "2026-09-20",
      remindBeforeDays: 15,
    }),
  ], now)

  assert.deepEqual(sorted.map(value => value.id), ["earlier-action", "sooner-due"])
})

test("already actionable all-day items precede future timed items, which sort chronologically", () => {
  const now = new Date(2026, 7, 30, 8, 0)
  const sorted = sortDueItems([
    displayItem({ id: "date-only", dueDate: "2026-08-30" }),
    displayItem({
      id: "late",
      dueDate: "2026-08-30",
      includesTime: true,
      hour: 17,
      dueTimestamp: new Date(2026, 7, 30, 17, 0).getTime(),
    }),
    displayItem({
      id: "early",
      dueDate: "2026-08-30",
      includesTime: true,
      hour: 9,
      dueTimestamp: new Date(2026, 7, 30, 9, 0).getTime(),
    }),
  ], now)
  assert.deepEqual(sorted.map(value => value.id), ["date-only", "early", "late"])
})

test("manual widget completion is idempotent for an old occurrence button", () => {
  const current = item({
    id: "monthly",
    dueDate: "2026-01-31",
    recurrence: createRecurrenceRule("month", 1, "2026-01-31"),
    updatedAt: 100,
  })
  const state = {
    ...defaultState(100),
    items: [current],
    updatedAt: 100,
  }
  const key = manualOccurrenceKey(current)
  const first = planManualCompletion(state, current.id, key, 1_000)
  assert.equal(first.result, "applied")
  assert.equal(first.state.items[0].dueDate, "2026-02-28")

  const repeated = planManualCompletion(first.state, current.id, key, 1_001)
  assert.equal(repeated.result, "stale")
  assert.equal(repeated.state.items[0].dueDate, "2026-02-28")
})

test("completing the visible item backfills every medium and large widget capacity", () => {
  const layouts = [
    ["systemMedium", 145, 2],
    ["systemMedium", 152, 3],
    ["systemLarge", 250, 3],
    ["systemLarge", 281, 4],
    ["systemLarge", 320, 5],
    ["systemLarge", 354, 5],
    ["systemLarge", 382, 5],
  ] as const

  for (const [family, displayHeight, expectedCapacity] of layouts) {
    const queue = Array.from({ length: expectedCapacity + 1 }, (_, index) => item({
      id: `queue-${index + 1}`,
      title: `第 ${index + 1} 件`,
      dueDate: `2026-09-${String(index + 1).padStart(2, "0")}`,
      updatedAt: index + 1,
    }))
    const state = {
      ...defaultState(queue.length),
      items: queue,
      updatedAt: queue.length,
    }
    const capacity = widgetItemCapacity(family, displayHeight)
    assert.equal(capacity, expectedCapacity, `${family} at ${displayHeight} pt`)

    const before = visibleWidgetItems(
      sortDueItems(manualItemsForDisplay(state)),
      capacity,
    )
    assert.deepEqual(
      before.map(value => value.id),
      queue.slice(0, capacity).map(value => value.id),
      `${family} should initially fill all ${capacity} slots`,
    )

    const first = queue[0]
    const completed = planManualCompletion(
      state,
      first.id,
      manualOccurrenceKey(first),
      100,
    )
    const after = visibleWidgetItems(
      sortDueItems(manualItemsForDisplay(completed.state)),
      capacity,
    )
    assert.deepEqual(
      after.map(value => value.id),
      queue.slice(1, capacity + 1).map(value => value.id),
      `${family} should pull the next item into its last visible slot`,
    )
  }
})

test("manual display items always receive an icon and preserve a manual override", () => {
  const automatic = item({ id: "ai", title: "Claude Pro", kind: "subscription" })
  const overridden = item({ id: "water", title: "Claude Pro", iconName: "drop.fill" })
  const state = { ...defaultState(3), items: [automatic, overridden], updatedAt: 3 }
  const displayed = manualItemsForDisplay(state)
  assert.equal(displayed.find(value => value.id === "ai")?.iconName, "sparkles")
  assert.equal(displayed.find(value => value.id === "water")?.iconName, "drop.fill")
  assert.equal(displayed.every(value => value.canComplete), true)
})

test("manual completion feedback lookup requires the exact visible occurrence", () => {
  const originalStorage = (globalThis as any).Storage
  const current = item({ id: "lookup", title: "查询事项", updatedAt: 42 })
  const state = { ...defaultState(1), items: [current] }
  try {
    ;(globalThis as any).Storage = {
      get: (key: string, options?: { shared: boolean }) => (
        key === STATE_KEY && options?.shared ? state : null
      ),
      set: () => true,
      remove: () => undefined,
      contains: () => true,
    }
    const key = manualOccurrenceKey(current)
    assert.equal(findManualDisplayItemForCompletion(current.id, key)?.title, current.title)
    assert.equal(findManualDisplayItemForCompletion(current.id, "old-occurrence"), null)
  } finally {
    ;(globalThis as any).Storage = originalStorage
  }
})

test("widget capacities adapt to small, medium, and large heights", () => {
  assert.equal(widgetItemCapacity("systemSmall", 170), 1)
  assert.equal(widgetItemCapacity("systemMedium", 145), 2)
  assert.equal(widgetItemCapacity("systemMedium", 151), 2)
  assert.equal(widgetItemCapacity("systemMedium", 152), 3)
  assert.equal(widgetItemCapacity("systemMedium", 168), 3)
  assert.equal(widgetItemCapacity("systemLarge", 250), 3)
  assert.equal(widgetItemCapacity("systemLarge", 271), 3)
  assert.equal(widgetItemCapacity("systemLarge", 272), 4)
  assert.equal(widgetItemCapacity("systemLarge", 309), 4)
  assert.equal(widgetItemCapacity("systemLarge", 310), 5)
  assert.equal(widgetItemCapacity("systemLarge", 349), 5)
  assert.equal(widgetItemCapacity("systemLarge", 350), 5)
  assert.equal(widgetItemCapacity("systemLarge", 354), 5)
  assert.equal(widgetItemCapacity("systemLarge", 382), 5)
  assert.equal(widgetItemCapacity("systemLarge"), 5)
})

test("large widget layout adapts its summary, sections, and rows to each height tier", () => {
  assert.deepEqual(largeWidgetLayout(250), {
    summaryHeight: 66,
    sectionHeaderHeight: 24,
    maximumSections: 1,
    maximumRows: 3,
  })
  assert.deepEqual(largeWidgetLayout(281), {
    summaryHeight: 70,
    sectionHeaderHeight: 28,
    maximumSections: 1,
    maximumRows: 4,
  })
  assert.deepEqual(largeWidgetLayout(320), {
    summaryHeight: 70,
    sectionHeaderHeight: 28,
    maximumSections: 1,
    maximumRows: 5,
  })
  for (const height of [354, 382]) {
    assert.deepEqual(largeWidgetLayout(height), {
      summaryHeight: 74,
      sectionHeaderHeight: 32,
      maximumSections: 2,
      maximumRows: 5,
    })
  }
  assert.deepEqual(largeWidgetLayout(), {
    summaryHeight: 74,
    sectionHeaderHeight: 32,
    maximumSections: 2,
    maximumRows: 5,
  })
})

test("list item title fonts adapt to widget width and estimated wrapping", () => {
  // Short titles retain each widget family's normal list typography.
  assert.equal(listItemTitleFontSize("Claude Pro", "systemMedium", 364), 14)
  assert.equal(listItemTitleFontSize("Claude Pro", "systemLarge", 364), 15)

  // Real compact and roomy widget widths affect whether the same English title
  // is expected to wrap and therefore needs the first compact font step.
  assert.equal(listItemTitleFontSize("Equifax Complete Premier", "systemMedium", 364), 14)
  assert.equal(listItemTitleFontSize("Equifax Complete Premier", "systemMedium", 320), 13)
  assert.equal(listItemTitleFontSize("Equifax Complete Premier", "systemLarge", 364), 14)

  // Mixed CJK and Latin glyphs use visual width rather than UTF-16 length.
  assert.equal(
    listItemTitleFontSize("BANK 06 | Ally 后备资格与一次性申请", "systemMedium", 364),
    13,
  )
  assert.equal(
    listItemTitleFontSize("BANK 06 | Ally 后备资格与一次性申请", "systemLarge", 364),
    14,
  )

  // Incidental whitespace must not change the predicted line count.
  assert.equal(
    listItemTitleFontSize("  Claude   Pro \t -   Monthly  ", "systemMedium", 364),
    listItemTitleFontSize("Claude Pro - Monthly", "systemMedium", 364),
  )

  // A pasted explicit line break is already a two-line title.
  assert.equal(listItemTitleFontSize("Claude Pro\nMonthly", "systemMedium", 364), 13)
  assert.equal(listItemTitleFontSize("Claude Pro\nMonthly", "systemLarge", 364), 14)

  // Wide Latin glyphs, repeated digits, supplementary CJK, and emoji modifiers
  // keep their visual-width behavior at compact widget boundaries.
  assert.equal(listItemTitleFontSize("W".repeat(10), "systemLarge", 338), 14)
  assert.equal(listItemTitleFontSize("1".repeat(20), "systemLarge", 338), 14)
  assert.equal(listItemTitleFontSize("𠀀".repeat(12), "systemMedium", 340), 13)
  assert.equal(listItemTitleFontSize("👍".repeat(10), "systemMedium", 340), 14)
  assert.equal(listItemTitleFontSize("👍🏽".repeat(10), "systemMedium", 340), 14)

  // Titles that still exceed roughly two lines after the first reduction use
  // the second compact step.
  const extraLongTitle = "A".repeat(100)
  assert.equal(listItemTitleFontSize(extraLongTitle, "systemMedium", 364), 12)
  assert.equal(listItemTitleFontSize(extraLongTitle, "systemLarge", 364), 13)

  // Missing and invalid widths use the same published fallback width.
  const fallbackTitle = "BANK 06 | Ally 后备资格与一次性申请"
  const fallbackSize = listItemTitleFontSize(fallbackTitle, "systemLarge")
  assert.equal(fallbackSize, 14)
  for (const invalidWidth of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
    assert.equal(
      listItemTitleFontSize(fallbackTitle, "systemLarge", invalidWidth),
      fallbackSize,
    )
  }
})

test("small item title fonts adapt across one, two, and three lines", () => {
  assert.equal(smallItemTitleFontSize("Claude Pro", 170), 16)
  assert.equal(smallItemTitleFontSize("Claude Pro - Monthly", 170), 15)
  assert.equal(
    smallItemTitleFontSize("BANK 06 | Ally 后备资格与一次性申请", 170),
    14,
  )

  // A narrower published small-widget width can move the same title down one
  // typography step without changing the fixed three-line title slot.
  assert.equal(smallItemTitleFontSize("Claude Pro", 141), 15)
  assert.equal(smallItemTitleFontSize("Claude Pro - Monthly", 141), 14)

  assert.equal(smallItemTitleFontSize("Claude Pro\nMonthly", 170), 15)
  assert.equal(smallItemTitleFontSize("One\nTwo\nThree", 170), 14)

  const fallbackSize = smallItemTitleFontSize("Claude Pro - Monthly")
  assert.equal(fallbackSize, 15)
  for (const invalidWidth of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
    assert.equal(
      smallItemTitleFontSize("Claude Pro - Monthly", invalidWidth),
      fallbackSize,
    )
  }
})

test("widget rows fill published iPhone heights and account for large sections", () => {
  assert.equal(widgetItemCapacity("systemMedium", 170), 3)
  assert.equal(widgetRowHeight("systemMedium", 170, 3), 41)
  assert.equal(widgetRowHeight("systemMedium", 145, 2), 42)
  assert.equal(widgetRowHeight("systemLarge", 250, 3, 1), 46)
  assert.equal(widgetRowHeight("systemLarge", 281, 4, 1), 40)
  assert.equal(widgetRowHeight("systemLarge", 320, 5, 1), 40)
  assert.equal(widgetRowHeight("systemLarge", 354, 5, 1), 45)
  assert.equal(widgetRowHeight("systemLarge", 354, 5, 2), 38)
  assert.equal(widgetRowHeight("systemLarge", 382, 5, 1), 50)
  assert.equal(widgetRowHeight("systemLarge", 382, 5, 2), 44)
  assert.equal(widgetRowHeight("systemLarge", undefined, 5, 1), 50)
  assert.equal(widgetRowHeight("systemLarge", undefined, 5, 2), 44)
})

test("widget refresh targets a near timed due date before midnight", () => {
  const now = new Date(2026, 7, 30, 12, 0)
  const due = new Date(2026, 7, 30, 18, 0)
  const refresh = nextWidgetRefresh([
    displayItem({
      dueDate: "2026-08-30",
      includesTime: true,
      hour: 18,
      minute: 0,
      dueTimestamp: due.getTime(),
    }),
  ], now)
  assert.equal(refresh.getTime(), due.getTime())
})

test("widget refresh targets both timed early-action and real-due transitions", () => {
  const beforeAction = new Date(2026, 8, 6, 23, 0)
  const action = new Date(2026, 8, 7, 0, 0)
  const due = new Date(2026, 8, 10, 18, 0)
  const earlyTimedItem = displayItem({
    dueDate: "2026-09-10",
    includesTime: true,
    hour: 18,
    minute: 0,
    remindBeforeDays: 3,
    dueTimestamp: due.getTime(),
  })

  const actionRefresh = nextWidgetRefresh([earlyTimedItem], beforeAction)
  assert.equal(actionRefresh.getTime(), action.getTime())

  const beforeRealDue = new Date(2026, 8, 10, 12, 0)
  const dueRefresh = nextWidgetRefresh([earlyTimedItem], beforeRealDue)
  assert.equal(dueRefresh.getTime(), due.getTime())
})

test("widget refresh does not request a sub-five-minute timeline", () => {
  const now = new Date(2026, 7, 30, 12, 0)
  const due = new Date(2026, 7, 30, 12, 1)
  const refresh = nextWidgetRefresh([
    displayItem({
      dueDate: "2026-08-30",
      includesTime: true,
      hour: 12,
      minute: 1,
      dueTimestamp: due.getTime(),
    }),
  ], now)
  assert.equal(refresh.getTime(), now.getTime() + 5 * 60 * 1000)
})

test("reminder integration requests a refresh within three hours", () => {
  const now = new Date(2026, 7, 30, 8, 0)
  const refresh = nextWidgetRefresh([], now, true)
  assert.equal(refresh.getTime(), now.getTime() + 3 * 60 * 60 * 1000)
})

test("legacy settings default to all reminder lists and preserve a later selection", () => {
  const originalStorage = (globalThis as any).Storage
  let sharedValue: any = {
    schemaVersion: 1,
    items: [],
    settings: {
      includeReminders: true,
      reminderHorizonDays: 730,
      showAmounts: true,
    },
    updatedAt: 1,
  }
  try {
    ;(globalThis as any).Storage = {
      get: (key: string, options?: { shared: boolean }) => (
        key === STATE_KEY && options?.shared ? sharedValue : null
      ),
      set: (key: string, value: unknown, options?: { shared: boolean }) => {
        if (key === STATE_KEY && options?.shared) sharedValue = value
        return true
      },
      remove: () => undefined,
      contains: () => true,
    }

    const legacy = loadState()
    assert.deepEqual((legacy.settings as any).reminderCalendarIDs, [])

    const selected = updateSettings({
      reminderCalendarIDs: ["home", "work"],
    } as any)
    assert.deepEqual((selected.settings as any).reminderCalendarIDs, ["home", "work"])

    const unrelatedUpdate = updateSettings({ showAmounts: false })
    assert.deepEqual(
      (unrelatedUpdate.settings as any).reminderCalendarIDs,
      ["home", "work"],
    )
    assert.deepEqual(
      sharedValue.settings.reminderCalendarIDs,
      ["home", "work"],
    )
  } finally {
    ;(globalThis as any).Storage = originalStorage
  }
})

test("reminder loading resolves every selected list by Calendar.identifier", async () => {
  const originalStorage = (globalThis as any).Storage
  const originalReminder = (globalThis as any).Reminder
  const originalCalendar = (globalThis as any).Calendar
  const saved = new Map<string, unknown>()
  const home = { identifier: "home", title: "家庭" }
  const personal = { identifier: "personal", title: "个人" }
  const work = { identifier: "work", title: "工作" }
  let queriedCalendars: any[] | undefined
  try {
    ;(globalThis as any).Storage = {
      get: (key: string) => saved.get(key) ?? null,
      set: (key: string, value: unknown) => { saved.set(key, value); return true },
      remove: (key: string) => { saved.delete(key) },
      contains: (key: string) => saved.has(key),
    }
    ;(globalThis as any).Calendar = {
      forReminders: async () => [work, personal, home],
    }
    ;(globalThis as any).Reminder = {
      getIncompletes: async (options?: { calendars?: any[] }) => {
        queriedCalendars = options?.calendars
        return [{
          identifier: "selected-reminder",
          title: "选中列表的事项",
          dueDateComponents: {
            date: new Date(2026, 8, 2, 23, 59, 59, 999),
            year: 2026,
            month: 9,
            day: 2,
            hour: null,
            minute: null,
          },
          calendar: home,
          priority: 0,
        }]
      },
    }

    const result = await (loadReminderItems as any)(
      730,
      ["home", "work"],
      new Date(2026, 7, 31, 12, 0),
    )
    assert.deepEqual(
      new Set(queriedCalendars?.map(calendar => calendar.identifier)),
      new Set(["home", "work"]),
    )
    assert.equal(queriedCalendars?.every(calendar => calendar === home || calendar === work), true)
    assert.equal(result.items.length, 1)
    assert.equal(result.live, true)
    assert.equal(result.fromCache, false)
    assert.deepEqual(
      (saved.get(REMINDER_SNAPSHOT_KEY) as any).calendarFilterIDs,
      ["home", "work"],
    )
  } finally {
    ;(globalThis as any).Storage = originalStorage
    ;(globalThis as any).Reminder = originalReminder
    ;(globalThis as any).Calendar = originalCalendar
  }
})

test("live reminders cache only a note icon hint and keep List as display note", async () => {
  const originalStorage = (globalThis as any).Storage
  const originalReminder = (globalThis as any).Reminder
  const saved = new Map<string, unknown>()
  const due = new Date(2026, 8, 5, 23, 59, 59, 999)
  try {
    ;(globalThis as any).Storage = {
      get: (key: string) => saved.get(key) ?? null,
      set: (key: string, value: unknown) => { saved.set(key, value); return true },
      remove: (key: string) => { saved.delete(key) },
      contains: (key: string) => saved.has(key),
    }
    ;(globalThis as any).Reminder = {
      getIncompletes: async () => [{
        identifier: "notes-icon-hint",
        title: "月底处理",
        notes: "私密账户资料 secret-token-42\n1Password Families",
        dueDateComponents: {
          date: due,
          year: 2026,
          month: 9,
          day: 5,
          hour: null,
          minute: null,
        },
        calendar: { title: "个人", allowsContentModifications: true },
        priority: 0,
      }],
    }

    const result = await loadReminderItems(730)
    const snapshot = saved.get(REMINDER_SNAPSHOT_KEY) as any
    assert.equal(result.live, true)
    assert.equal(result.items[0].iconName, "key.fill")
    assert.equal(result.items[0].note, "个人")
    assert.equal(snapshot.items[0].noteIconHint, "key.fill")
    assert.equal("notes" in snapshot.items[0], false)
    assert.doesNotMatch(JSON.stringify(snapshot), /secret-token-42|1Password Families/)
  } finally {
    ;(globalThis as any).Storage = originalStorage
    ;(globalThis as any).Reminder = originalReminder
  }
})

test("cached reminder hints follow title and List priority and accept legacy rows", async () => {
  const originalStorage = (globalThis as any).Storage
  const originalReminder = (globalThis as any).Reminder
  const dueTimestamp = new Date(2026, 8, 6, 23, 59, 59, 999).getTime()
  const base = {
    dueDate: "2026-09-06",
    includesTime: false,
    hour: 0,
    minute: 0,
    dueTimestamp,
    priority: 0,
  }
  const snapshot = {
    schemaVersion: 1,
    fetchedAt: Date.now(),
    calendarFilterIDs: [],
    items: [
      {
        ...base,
        id: "title-before-hint",
        title: "家庭电费",
        calendarTitle: "个人",
        noteIconHint: "key.fill",
      },
      {
        ...base,
        id: "list-before-hint",
        title: "月底处理",
        calendarTitle: "音乐",
        noteIconHint: "key.fill",
      },
      {
        ...base,
        id: "valid-hint",
        title: "月底处理",
        calendarTitle: "个人",
        noteIconHint: "key.fill",
      },
      {
        ...base,
        id: "invalid-hint",
        title: "月底处理",
        calendarTitle: "个人",
        noteIconHint: "not.a.real.allowed.symbol",
      },
      {
        ...base,
        id: "legacy-without-hint",
        title: "月底处理",
        calendarTitle: "购物",
      },
      {
        ...base,
        id: "delivery-list-with-numeric-title",
        title: "4994",
        calendarTitle: "Delivery",
        noteIconHint: null,
      },
    ],
  }
  try {
    ;(globalThis as any).Storage = {
      get: (key: string) => key === REMINDER_SNAPSHOT_KEY ? snapshot : null,
      set: () => true,
      remove: () => undefined,
      contains: () => true,
    }
    ;(globalThis as any).Reminder = {
      getIncompletes: async () => { throw new Error("temporarily unavailable") },
    }

    const result = await loadReminderItems(730)
    const icons = new Map(result.items.map(value => [value.id, value.iconName]))
    assert.equal(result.live, false)
    assert.equal(result.fromCache, true)
    assert.equal(icons.get("title-before-hint"), "bolt.fill")
    assert.equal(icons.get("list-before-hint"), "music.note")
    assert.equal(icons.get("valid-hint"), "key.fill")
    assert.equal(icons.get("invalid-hint"), "checklist")
    assert.equal(icons.get("legacy-without-hint"), "cart.fill")
    assert.equal(icons.get("delivery-list-with-numeric-title"), "shippingbox.fill")
  } finally {
    ;(globalThis as any).Storage = originalStorage
    ;(globalThis as any).Reminder = originalReminder
  }
})

test("any missing selected reminder list prevents a partial or unfiltered query", async () => {
  const originalStorage = (globalThis as any).Storage
  const originalReminder = (globalThis as any).Reminder
  const originalCalendar = (globalThis as any).Calendar
  let reminderQueries = 0
  try {
    ;(globalThis as any).Storage = {
      get: () => null,
      set: () => true,
      remove: () => undefined,
      contains: () => false,
    }
    ;(globalThis as any).Calendar = {
      forReminders: async () => [{ identifier: "work", title: "工作" }],
    }
    ;(globalThis as any).Reminder = {
      getIncompletes: async () => {
        reminderQueries += 1
        return []
      },
    }

    const result = await (loadReminderItems as any)(730, ["deleted-list", "work"])
    assert.equal(reminderQueries, 0)
    assert.equal(result.items.length, 0)
    assert.equal(result.live, false)
    assert.equal(result.fromCache, false)
    assert.ok(result.error)
  } finally {
    ;(globalThis as any).Storage = originalStorage
    ;(globalThis as any).Reminder = originalReminder
    ;(globalThis as any).Calendar = originalCalendar
  }
})

test("reminder cache fallback requires the exact selected-list scope", async () => {
  const originalStorage = (globalThis as any).Storage
  const originalReminder = (globalThis as any).Reminder
  const originalCalendar = (globalThis as any).Calendar
  const snapshot = {
    schemaVersion: 1,
    fetchedAt: Date.now(),
    calendarFilterIDs: ["home", "work"],
    items: [{
      id: "cached-selected",
      title: "列表内缓存",
      dueDate: "2026-09-01",
      includesTime: false,
      hour: 0,
      minute: 0,
      dueTimestamp: new Date(2026, 8, 1, 23, 59, 59, 999).getTime(),
      calendarTitle: "家庭",
      priority: 0,
    }],
  }
  try {
    ;(globalThis as any).Storage = {
      get: (key: string) => key === REMINDER_SNAPSHOT_KEY ? snapshot : null,
      set: () => true,
      remove: () => undefined,
      contains: () => true,
    }
    ;(globalThis as any).Calendar = {
      forReminders: async () => [
        { identifier: "home", title: "家庭" },
        { identifier: "work", title: "工作" },
      ],
    }
    ;(globalThis as any).Reminder = {
      getIncompletes: async () => { throw new Error("temporarily unavailable") },
    }

    const matching = await (loadReminderItems as any)(730, ["home", "work"])
    assert.equal(matching.live, false)
    assert.equal(matching.fromCache, true)
    assert.deepEqual(matching.items.map((value: DisplayDueItem) => value.id), ["cached-selected"])
    assert.equal(matching.items[0].canComplete, true)

    const different = await (loadReminderItems as any)(730, ["home"])
    assert.equal(different.live, false)
    assert.equal(different.fromCache, false)
    assert.deepEqual(different.items, [])
    assert.ok(different.error)
  } finally {
    ;(globalThis as any).Storage = originalStorage
    ;(globalThis as any).Reminder = originalReminder
    ;(globalThis as any).Calendar = originalCalendar
  }
})

test("stale cached reminders never sort ahead of live items", () => {
  const now = new Date(2026, 7, 30, 12, 0)
  const sorted = sortDueItems([
    displayItem({ id: "stale", dueDate: "2026-01-01", stale: true, source: "reminder", kind: "reminder" }),
    displayItem({ id: "live", dueDate: "2026-09-01" }),
  ], now)
  assert.deepEqual(sorted.map(value => value.id), ["live", "stale"])
})

test("reminder snapshots expire after twenty-four hours", async () => {
  const originalStorage = (globalThis as any).Storage
  const originalReminder = (globalThis as any).Reminder
  const fetchedAt = Date.now() - 25 * 60 * 60 * 1000
  try {
    ;(globalThis as any).Storage = {
      get: () => ({
        schemaVersion: 1,
        fetchedAt,
        items: [{
          id: "cached",
          title: "旧提醒",
          dueDate: "2026-09-01",
          includesTime: false,
          hour: 0,
          minute: 0,
          dueTimestamp: new Date(2026, 8, 1, 23, 59, 59, 999).getTime(),
          calendarTitle: "提醒事项",
          priority: 0,
        }],
      }),
      set: () => true,
      remove: () => undefined,
      contains: () => true,
    }
    ;(globalThis as any).Reminder = {
      getIncompletes: async () => { throw new Error("permission denied") },
    }

    const result = await loadReminderItems(730)
    assert.equal(isSnapshotStale(fetchedAt), true)
    assert.equal(result.live, false)
    assert.equal(result.fromCache, false)
    assert.equal(result.items.length, 0)
    assert.match(result.error ?? "", /缓存已过期/)
  } finally {
    ;(globalThis as any).Storage = originalStorage
    ;(globalThis as any).Reminder = originalReminder
  }
})

test("timed reminders use one consistent device-local instant", async () => {
  const originalStorage = (globalThis as any).Storage
  const originalReminder = (globalThis as any).Reminder
  const instant = new Date(2026, 8, 1, 17, 45)
  try {
    ;(globalThis as any).Storage = {
      get: () => null,
      set: () => true,
      remove: () => undefined,
      contains: () => false,
    }
    ;(globalThis as any).Reminder = {
      getIncompletes: async () => [{
        identifier: "timed",
        title: "跨时区提醒",
        dueDateComponents: {
          date: instant,
          year: 2026,
          month: 9,
          day: 1,
          hour: 0,
          minute: 30,
        },
        priority: 1,
      }],
    }

    const result = await loadReminderItems(730)
    assert.equal(result.live, true)
    assert.equal(result.fromCache, false)
    assert.equal(result.items[0].dueDate, `${instant.getFullYear()}-${String(instant.getMonth() + 1).padStart(2, "0")}-${String(instant.getDate()).padStart(2, "0")}`)
    assert.equal(result.items[0].hour, instant.getHours())
    assert.equal(result.items[0].minute, instant.getMinutes())
    assert.equal(result.items[0].dueTimestamp, instant.getTime())
    assert.equal(result.items[0].priority, 3)
  } finally {
    ;(globalThis as any).Storage = originalStorage
    ;(globalThis as any).Reminder = originalReminder
  }
})

test("a failed reminder snapshot write still returns the live EventKit result", async () => {
  const originalStorage = (globalThis as any).Storage
  const originalReminder = (globalThis as any).Reminder
  const due = new Date(2026, 8, 4, 23, 59, 59, 999)
  try {
    ;(globalThis as any).Storage = {
      get: () => null,
      set: (key: string) => key !== REMINDER_SNAPSHOT_KEY,
      remove: () => undefined,
      contains: () => false,
    }
    ;(globalThis as any).Reminder = {
      getIncompletes: async () => [{
        identifier: "live-without-cache",
        title: "已实时读取",
        dueDateComponents: {
          date: due,
          year: 2026,
          month: 9,
          day: 4,
          hour: null,
          minute: null,
        },
        calendar: { title: "提醒事项" },
        priority: 0,
      }],
    }

    const result = await loadReminderItems(730)
    assert.equal(result.live, true)
    assert.equal(result.fromCache, false)
    assert.deepEqual(result.items.map(value => value.id), ["live-without-cache"])
    assert.equal(result.items[0].stale, false)
    assert.match(result.error ?? "", /无法保存提醒缓存/)
  } finally {
    ;(globalThis as any).Storage = originalStorage
    ;(globalThis as any).Reminder = originalReminder
  }
})

test("reminders from a read-only calendar cannot be completed", async () => {
  const originalStorage = (globalThis as any).Storage
  const originalReminder = (globalThis as any).Reminder
  const due = new Date(2026, 8, 5, 23, 59, 59, 999)
  let savedSnapshot: any = null
  let saves = 0
  const reminder = {
    identifier: "shared-read-only",
    title: "共享只读提醒",
    dueDateComponents: {
      date: due,
      year: 2026,
      month: 9,
      day: 5,
      hour: null,
      minute: null,
    },
    calendar: {
      title: "共享列表",
      allowsContentModifications: false,
    },
    priority: 0,
    isCompleted: false,
    save: async () => { saves += 1 },
  }
  try {
    ;(globalThis as any).Storage = {
      get: () => null,
      set: (key: string, value: unknown) => {
        if (key === REMINDER_SNAPSHOT_KEY) savedSnapshot = value
        return true
      },
      remove: () => undefined,
      contains: () => false,
    }
    ;(globalThis as any).Reminder = {
      getIncompletes: async () => [reminder],
      get: async () => reminder,
    }

    const result = await loadReminderItems(730)
    assert.equal(result.live, true)
    assert.equal(result.items[0].canComplete, false)
    assert.equal(savedSnapshot.items[0].canComplete, false)
    await assert.rejects(
      completeReminderOccurrence(reminder.identifier, result.items[0].completionKey),
      /只读/,
    )
    assert.equal(reminder.isCompleted, false)
    assert.equal(saves, 0)
  } finally {
    ;(globalThis as any).Storage = originalStorage
    ;(globalThis as any).Reminder = originalReminder
  }
})

test("reminder widget completion saves once and removes the cached row", async () => {
  const originalStorage = (globalThis as any).Storage
  const originalReminder = (globalThis as any).Reminder
  const values = new Map<string, unknown>()
  const instant = new Date(2026, 8, 1, 17, 45)
  let saves = 0
  const reminder = {
    identifier: "complete-me",
    title: "完成提醒",
    dueDateComponents: {
      date: instant,
      year: instant.getFullYear(),
      month: instant.getMonth() + 1,
      day: instant.getDate(),
      hour: instant.getHours(),
      minute: instant.getMinutes(),
    },
    calendar: { title: "提醒事项" },
    priority: 1,
    isCompleted: false,
    save: async () => { saves += 1 },
  }
  try {
    ;(globalThis as any).Storage = {
      get: (key: string) => values.get(key) ?? null,
      set: (key: string, value: unknown) => { values.set(key, value); return true },
      remove: (key: string) => { values.delete(key) },
      contains: (key: string) => values.has(key),
    }
    ;(globalThis as any).Reminder = {
      getIncompletes: async () => [reminder],
      get: async (id: string) => id === reminder.identifier ? reminder : null,
    }

    const loaded = await loadReminderItems(730)
    const key = loaded.items[0].completionKey
    assert.equal((values.get(REMINDER_SNAPSHOT_KEY) as any).items.length, 1)
    assert.equal(
      findReminderDisplayItemForCompletion(reminder.identifier, key)?.title,
      "完成提醒",
    )

    assert.equal(await completeReminderOccurrence(reminder.identifier, key), "applied")
    assert.equal(reminder.isCompleted, true)
    assert.equal(saves, 1)
    assert.equal((values.get(REMINDER_SNAPSHOT_KEY) as any).items.length, 0)

    assert.equal(await completeReminderOccurrence(reminder.identifier, key), "missing")
    assert.equal(saves, 1)
  } finally {
    ;(globalThis as any).Storage = originalStorage
    ;(globalThis as any).Reminder = originalReminder
  }
})

test("a completed reminder reports a local snapshot update failure accurately", async () => {
  const originalStorage = (globalThis as any).Storage
  const originalReminder = (globalThis as any).Reminder
  const values = new Map<string, unknown>()
  const instant = new Date(2026, 8, 2, 9, 30)
  let snapshotWrites = 0
  let saves = 0
  const reminder = {
    identifier: "complete-cache-failure",
    title: "已完成但缓存失败",
    dueDateComponents: {
      date: instant,
      year: instant.getFullYear(),
      month: instant.getMonth() + 1,
      day: instant.getDate(),
      hour: instant.getHours(),
      minute: instant.getMinutes(),
    },
    calendar: { title: "提醒事项", allowsContentModifications: true },
    priority: 0,
    isCompleted: false,
    save: async () => { saves += 1 },
  }
  try {
    ;(globalThis as any).Storage = {
      get: (key: string) => values.get(key) ?? null,
      set: (key: string, value: unknown) => {
        if (key === REMINDER_SNAPSHOT_KEY) {
          snapshotWrites += 1
          if (snapshotWrites > 1) return false
        }
        values.set(key, value)
        return true
      },
      remove: (key: string) => { values.delete(key) },
      contains: (key: string) => values.has(key),
    }
    ;(globalThis as any).Reminder = {
      getIncompletes: async () => [reminder],
      get: async () => reminder,
    }

    const loaded = await loadReminderItems(730)
    assert.equal(
      await completeReminderOccurrence(reminder.identifier, loaded.items[0].completionKey),
      "appliedCacheStale",
    )
    assert.equal(reminder.isCompleted, true)
    assert.equal(saves, 1)
    assert.equal((values.get(REMINDER_SNAPSHOT_KEY) as any).items.length, 1)
  } finally {
    ;(globalThis as any).Storage = originalStorage
    ;(globalThis as any).Reminder = originalReminder
  }
})

test("legacy items receive stable IDs and duplicate IDs are preserved safely", () => {
  const originalStorage = (globalThis as any).Storage
  const raw = {
    items: [
      { title: "旧账单", dueDate: "2026-09-01" },
      { id: "same", title: "订阅 A", dueDate: "2026-09-02" },
      { id: "same", title: "订阅 B", dueDate: "2026-09-03" },
    ],
    settings: {},
  }
  try {
    ;(globalThis as any).Storage = {
      get: (key: string) => key === STATE_KEY ? raw : null,
      set: () => true,
      remove: () => undefined,
      contains: () => true,
    }
    const first = loadState()
    const second = loadState()
    assert.equal(first.items[0].id, second.items[0].id)
    assert.equal(first.items[0].iconName, null)
    assert.equal(new Set(first.items.map(value => value.id)).size, 3)
  } finally {
    ;(globalThis as any).Storage = originalStorage
  }
})

test("private state migrates to shared storage and shared data wins afterward", () => {
  const originalStorage = (globalThis as any).Storage
  let privateValue: unknown = {
    items: [{ title: "旧版私有事项", dueDate: "2026-09-01" }],
    settings: {},
    updatedAt: 1,
  }
  let sharedValue: unknown = null
  try {
    ;(globalThis as any).Storage = {
      get: (_key: string, options?: { shared: boolean }) => options?.shared ? sharedValue : privateValue,
      set: (_key: string, value: unknown, options?: { shared: boolean }) => {
        if (options?.shared) sharedValue = value
        else privateValue = value
        return true
      },
      remove: () => undefined,
      contains: () => false,
    }

    const migrated = loadState()
    assert.equal(migrated.items[0].title, "旧版私有事项")
    assert.equal((sharedValue as any).items[0].title, "旧版私有事项")

    privateValue = {
      items: [{ title: "不应覆盖共享数据", dueDate: "2026-09-02" }],
      settings: {},
      updatedAt: 2,
    }
    assert.equal(loadState().items[0].title, "旧版私有事项")
  } finally {
    ;(globalThis as any).Storage = originalStorage
  }
})

test("a failed private-to-shared state migration is reported without pretending success", () => {
  const originalStorage = (globalThis as any).Storage
  const privateValue = {
    items: [{ title: "仍在私有存储", dueDate: "2026-09-06" }],
    settings: {},
    updatedAt: 1,
  }
  let sharedWrites = 0
  try {
    ;(globalThis as any).Storage = {
      get: (_key: string, options?: { shared: boolean }) => (
        options?.shared ? null : privateValue
      ),
      set: (_key: string, _value: unknown, options?: { shared: boolean }) => {
        if (options?.shared) sharedWrites += 1
        return false
      },
      remove: () => undefined,
      contains: () => false,
    }

    assert.throws(() => loadState(), /无法迁移到共享存储/)
    assert.equal(sharedWrites, 1)
    assert.equal(privateValue.items[0].title, "仍在私有存储")
  } finally {
    ;(globalThis as any).Storage = originalStorage
  }
})

test("optimistic item revisions reject stale editor saves and deletes", () => {
  const originalStorage = (globalThis as any).Storage
  const current = item({
    id: "concurrent",
    title: "已由小组件更新",
    dueDate: "2026-09-30",
    updatedAt: 200,
  })
  let sharedValue: any = {
    ...defaultState(200),
    items: [current],
    updatedAt: 200,
  }
  let writes = 0
  try {
    ;(globalThis as any).Storage = {
      get: (key: string, options?: { shared: boolean }) => (
        key === STATE_KEY && options?.shared ? sharedValue : null
      ),
      set: (key: string, value: unknown, options?: { shared: boolean }) => {
        if (key === STATE_KEY && options?.shared) {
          sharedValue = value
          writes += 1
        }
        return true
      },
      remove: () => undefined,
      contains: () => true,
    }

    const staleEdit = { ...current, title: "旧编辑页内容", updatedAt: 300 }
    assert.throws(
      () => upsertItem(staleEdit, 100),
      /为避免覆盖新数据/,
    )
    assert.throws(
      () => deleteItem(current.id, 100),
      /为避免覆盖新数据/,
    )
    assert.equal(writes, 0)
    assert.equal(sharedValue.items[0].title, "已由小组件更新")

    const saved = upsertItem(staleEdit, 200)
    assert.equal(saved.items[0].title, "旧编辑页内容")
    assert.equal(writes, 1)
    assert.throws(
      () => deleteItem(current.id, 200),
      /为避免覆盖新数据/,
    )
    const deleted = deleteItem(current.id, 300)
    assert.deepEqual(deleted.items, [])
  } finally {
    ;(globalThis as any).Storage = originalStorage
  }
})

test("completion feedback uses schema 3 generation state without retaining an occurrence", () => {
  const originalStorage = (globalThis as any).Storage
  const values = new Map<string, unknown>()
  const now = new Date(2026, 7, 30, 20, 0).getTime()
  const previous = displayItem({
    id: "card",
    completionKey: "2026-08-31|date|1",
    title: "本期账单",
    dueDate: "2026-08-31",
    note: "尾号 1234 · 白金套餐",
  })
  const next = displayItem({
    id: "card",
    completionKey: "2026-09-30|date|2",
    title: "下期账单",
    dueDate: "2026-09-30",
  })
  const other = displayItem({ id: "other", title: "其他事项" })
  try {
    ;(globalThis as any).Storage = {
      get: (key: string) => values.get(key) ?? null,
      set: (key: string, value: unknown) => { values.set(key, value); return true },
      remove: (key: string) => { values.delete(key) },
      contains: (key: string) => values.has(key),
    }

    assert.equal(writeWidgetCompletionFeedback(previous, now), true)
    assert.deepEqual(values.get(WIDGET_COMPLETION_FEEDBACK_KEY), {
      schemaVersion: 3,
      generation: 1,
      phase: 1,
    })
    assert.deepEqual(readWidgetCompletionFeedback(now + 100), [])
    assert.deepEqual(readWidgetCompletionTransition(now + 100), {
      generation: 1,
      phase: 1,
      items: [],
    })

    const merged = mergeWidgetCompletionFeedback([next, other], [previous])
    assert.deepEqual(merged.map(item => item.completionKey), [
      next.completionKey,
      other.completionKey,
    ])

    clearWidgetCompletionFeedback("manual", previous.id, previous.completionKey, now + 200)
    assert.deepEqual(values.get(WIDGET_COMPLETION_FEEDBACK_KEY), {
      schemaVersion: 3,
      generation: 1,
      phase: 1,
    })
  } finally {
    ;(globalThis as any).Storage = originalStorage
  }
})

test("legacy completion feedback migrates without persisting its completed item", () => {
  const originalStorage = (globalThis as any).Storage
  const sharedValues = new Map<string, unknown>()
  const privateValues = new Map<string, unknown>()
  const completed = displayItem({ id: "legacy-completed", title: "不应重现" })
  privateValues.set(WIDGET_COMPLETION_FEEDBACK_KEY, {
    schemaVersion: 2,
    generation: 7,
    phase: 1,
    entries: [{ createdAt: Date.now(), item: completed }],
  })
  try {
    ;(globalThis as any).Storage = {
      get: (key: string, options?: { shared: boolean }) => (
        options?.shared ? sharedValues : privateValues
      ).get(key) ?? null,
      set: (key: string, value: unknown, options?: { shared: boolean }) => {
        const domain = options?.shared ? sharedValues : privateValues
        domain.set(key, value)
        return true
      },
      remove: (key: string, options?: { shared: boolean }) => {
        const domain = options?.shared ? sharedValues : privateValues
        domain.delete(key)
      },
      contains: (key: string, options?: { shared: boolean }) => (
        options?.shared ? sharedValues : privateValues
      ).has(key),
    }

    assert.deepEqual(readWidgetCompletionTransition(), {
      generation: 7,
      phase: 1,
      items: [],
    })
    assert.deepEqual(sharedValues.get(WIDGET_COMPLETION_FEEDBACK_KEY), {
      schemaVersion: 3,
      generation: 7,
      phase: 1,
    })
    assert.equal(privateValues.has(WIDGET_COMPLETION_FEEDBACK_KEY), false)
    assert.doesNotMatch(
      JSON.stringify(sharedValues.get(WIDGET_COMPLETION_FEEDBACK_KEY)),
      /legacy-completed|不应重现|entries/,
    )
  } finally {
    ;(globalThis as any).Storage = originalStorage
  }
})

test("every completion advances the generation without storing completed items", () => {
  const originalStorage = (globalThis as any).Storage
  const values = new Map<string, unknown>()
  const now = Date.now()
  const first = displayItem({ id: "first", completionKey: "first-occurrence" })
  const second = displayItem({ id: "second", completionKey: "second-occurrence" })
  try {
    ;(globalThis as any).Storage = {
      get: (key: string) => values.get(key) ?? null,
      set: (key: string, value: unknown) => { values.set(key, value); return true },
      remove: (key: string) => { values.delete(key) },
      contains: (key: string) => values.has(key),
    }

    writeWidgetCompletionFeedback(first, now)
    const firstTransition = readWidgetCompletionTransition(now + 1)
    assert.equal(firstTransition.generation, 1)
    assert.equal(firstTransition.phase, 1)
    assert.deepEqual(firstTransition.items, [])

    writeWidgetCompletionFeedback(second, now + 10)
    const secondTransition = readWidgetCompletionTransition(now + 11)
    assert.equal(secondTransition.generation, 2)
    assert.equal(secondTransition.phase, 0)
    assert.deepEqual(secondTransition.items, [])

    assert.deepEqual(values.get(WIDGET_COMPLETION_FEEDBACK_KEY), {
      schemaVersion: 3,
      generation: 2,
      phase: 0,
    })
  } finally {
    ;(globalThis as any).Storage = originalStorage
  }
})

test("completion intent keeps one persisted transition and requests one widget reload", () => {
  const source = readFileSync(
    new URL("../到期管家/app_intents.tsx", import.meta.url),
    "utf8",
  )
  const feedbackWrite = source.indexOf("writeWidgetCompletionFeedback(feedbackItem)")
  const completionWrite = source.indexOf("const result = params.source")
  const reload = source.indexOf("await reloadWidgetsAfterStorageWrite()")
  assert.ok(feedbackWrite >= 0)
  assert.ok(completionWrite >= 0)
  assert.ok(reload > feedbackWrite)
  assert.equal(source.match(/await reloadWidgetsAfterStorageWrite\(\)/g)?.length, 1)
  assert.doesNotMatch(source, /clearWidgetCompletionFeedback|setTimeout/)
  assert.doesNotMatch(source, /renderedAt|renderGeneration|canRunWidgetCompletionIntent|shouldReload/)
  assert.match(source, /completionIntentQueue/)
  assert.match(source, /result === "appliedCacheStale"/)
  assert.match(source, /提醒已完成，但本地缓存或完成记录未能保存/)
})

test("widget view uses native queue transitions, safe controls, and unified list insets", () => {
  const source = readFileSync(
    new URL("../到期管家/src/widget_view.tsx", import.meta.url),
    "utf8",
  )
  const listWidget = source.slice(
    source.indexOf("function ListWidget("),
    source.indexOf("function ListWidgetBody"),
  )
  const widgetEntry = source.slice(
    source.indexOf("export function DueManagerWidget"),
    source.indexOf("function WidgetHeader"),
  )
  const importBlock = source.slice(0, source.indexOf("from \"scripting\"") + 16)
  assert.doesNotMatch(importBlock, /\bAnimation\b/)
  assert.match(source, /declare const Transition: any/)
  assert.match(source, /Animation\.smooth\(\{\s*duration: 0\.32,\s*extraBounce: 0,\s*\}\)/)
  assert.match(source, /const QUEUE_SLOT_TRANSITION = Transition\s*\.asymmetric\(/)
  assert.match(source, /Transition\.move\("bottom"\)\.combined\(Transition\.opacity\(\)\)/)
  assert.match(source, /transition=\{QUEUE_SLOT_TRANSITION\}/)
  assert.match(source, /key="completion-active-layer"/)
  assert.match(source, /function CompletionContent/)
  assert.match(source, /contentTransition="opacity"/)
  assert.match(source, /contentTransition="symbolEffectReplace"/)
  assert.doesNotMatch(source, /zIndex=|allowsHitTesting=|<Toggle|toggleStyle=|buttonStyle="bordered"|buttonBorderShape=|clipShape=/)
  assert.match(source, /return <Button\s+buttonStyle="plain"\s+contentShape="rectangle"[\s\S]*?CompleteDueItemIntent/)
  assert.match(source, /key=\{`queue-slot-\$\{index\}`\}/)
  assert.match(source, /frame=\{\{ width: hitSize, height: hitSize \}\}/)
  assert.match(source, /const hitSize = Math\.min\(height, roomy \? 40 : 38\)/)
  assert.match(
    widgetEntry,
    /const displaySize = Widget\.displaySize\s+const displayHeight = displaySize\?\.height\s+const displayWidth = displaySize\?\.width/,
  )
  assert.equal(
    widgetEntry.match(/displayWidth=\{displayWidth\}/g)?.length,
    3,
    "small, medium, and large widget entry points must forward their actual width",
  )
  assert.match(
    listWidget,
    /const rowHeight = widgetRowHeight\(family, displayHeight, limit, largeSectionCount\)/,
  )
  assert.match(
    listWidget,
    /<LargeListWidgetBody[\s\S]*?displayWidth=\{displayWidth\}/,
  )
  assert.match(
    listWidget,
    /<ListWidgetBody[\s\S]*?displayWidth=\{displayWidth\}/,
  )
  assert.doesNotMatch(
    listWidget,
    /widgetRowHeight\(family, displayHeight, effectiveLimit, largeSectionCount\)/,
  )
  assert.match(
    listWidget,
    /return <WidgetFrame contentPadding=\{11\}>\s*<VStack\s+alignment="leading"\s+spacing=\{0\}\s+padding=\{\{ leading: 3, trailing: 3 \}\}/,
    "11 pt frame padding plus 3 pt horizontal inset must keep an effective 14 pt list margin",
  )
  assert.equal(
    listWidget.match(/padding=\{\{ leading: 3, trailing: 3 \}\}/g)?.length,
    2,
    "medium and large branches must both keep the effective 14 pt list margin",
  )
  assert.doesNotMatch(source, /contentPadding=\{roomy \? 14 : 11\}/)
  assert.doesNotMatch(source, /previousItems|completionPhase|layer0|layer1/)
  assert.equal(source.match(/animation=\{\{ animation: COMPLETION_QUEUE_ANIMATION, value: generation \}\}/g)?.length, 1)
  assert.doesNotMatch(source, /symbolEffect=\{\{ effect: "bounce"/)
})

test("medium and large rows use compact item icons as completion controls without duplicating title icons", () => {
  const source = readFileSync(
    new URL("../到期管家/src/widget_view.tsx", import.meta.url),
    "utf8",
  )
  const listRow = source.slice(
    source.indexOf("function DueItemRow"),
    source.indexOf("function ListCompletionIcon"),
  )
  const mediumBody = source.slice(
    source.indexOf("function ListWidgetBody"),
    source.indexOf("function LargeListWidgetBody"),
  )
  const largeBody = source.slice(
    source.indexOf("function LargeListWidgetBody"),
    source.indexOf("function CompletionContent"),
  )
  const listCompletionIcon = source.slice(
    source.indexOf("function ListCompletionIcon"),
    source.indexOf("function listItemSupportingText"),
  )
  const listDetail = source.slice(
    source.indexOf("function listItemSupportingText"),
    source.indexOf("function EmptyState"),
  )

  assert.doesNotMatch(listRow, /\btitleInset\b|\bsubjectTextOffset\b/)
  assert.match(listRow, /const metadataWidth = roomy \? 124 : 116/)
  assert.match(listRow, /const supportingText = listItemSupportingText\(item\)/)
  assert.match(
    listRow,
    /return <HStack\s+alignment="center"\s+spacing=\{0\}[\s\S]*?frame=\{\{ maxWidth: "infinity", height \}\}/,
    "the completion control and both content columns should share the full row's vertical center",
  )
  assert.match(
    listRow,
    /<ListCompletionIcon\s+item=\{item\}\s+hitSize=\{hitSize\}\s+symbolSize=\{roomy \? 18 : 17\}\s*\/>/,
    "medium and large rows should use 17 pt and 18 pt item icons",
  )
  assert.match(listRow, /const hitSize = Math\.min\(height, roomy \? 40 : 38\)/)
  assert.match(
    mediumBody,
    /<DueItemRow\s+item=\{item\}\s+roomy=\{false\}\s+height=\{rowHeight\}\s+displayWidth=\{displayWidth\}\s*\/>/,
    "medium rows must receive the actual widget width",
  )
  assert.match(
    largeBody,
    /<LargeWidgetSection[\s\S]*?displayWidth=\{displayWidth\}[\s\S]*?<DueItemRow\s+item=\{item\}\s+roomy\s+height=\{rowHeight\}\s+displayWidth=\{displayWidth\}\s*\/>/,
    "large sections and rows must preserve the actual widget width",
  )
  assert.match(
    listRow,
    /<Link url=\{itemURL\(item\)\}>\s*<HStack\s+alignment="center"\s+spacing=\{8\}\s+frame=\{\{ maxWidth: "infinity" \}\}/,
    "the subject and metadata columns should share one vertically centered content block",
  )
  assert.match(
    listRow,
    /<Link url=\{itemURL\(item\)\}>[\s\S]*?<Text[\s\S]*?\{item\.title\}[\s\S]*?<VStack\s+alignment="trailing"/,
    "the title and metadata should remain inside the item link",
  )
  const itemLink = listRow.slice(
    listRow.indexOf("<Link url={itemURL(item)}>"),
    listRow.lastIndexOf("</Link>") + "</Link>".length,
  )
  assert.doesNotMatch(itemLink, /item\.iconName|item\.iconColor/)
  const titleIndex = listRow.indexOf("{item.title}")
  assert.ok(titleIndex >= 0)
  const titleBlock = listRow.slice(
    listRow.lastIndexOf("<Text", titleIndex),
    listRow.indexOf("</Text>", titleIndex) + "</Text>".length,
  )
  assert.match(
    listRow,
    /const titleFontSize = listItemTitleFontSize\(\s*item\.title,\s*roomy \? "systemLarge" : "systemMedium",\s*displayWidth,\s*\)/,
    "list title typography must be selected from its title, family, and actual width",
  )
  assert.match(titleBlock, /font=\{titleFontSize\}/)
  assert.match(titleBlock, /lineLimit=\{2\}/)
  assert.match(titleBlock, /multilineTextAlignment="leading"/)
  assert.match(titleBlock, /fixedSize=\{\{ horizontal: false, vertical: true \}\}/)
  assert.match(titleBlock, /frame=\{\{ maxWidth: "infinity", alignment: "leading" \}\}/)
  assert.doesNotMatch(titleBlock, /lineLimit=\{1\}|padding=/)
  assert.equal(
    listRow.match(/lineLimit=\{2\}/g)?.length,
    1,
    "only the item title should be allowed to wrap to a second line",
  )
  assert.match(
    listRow,
    /<VStack\s+alignment="trailing"\s+spacing=\{0\}\s+frame=\{\{ width: metadataWidth, alignment: "trailing" \}\}\s*>[\s\S]*?\{supportingText[\s\S]*?\{formatWidgetItemDate\(item, widgetRuntimeLocale\(\)\)\}/,
    "supporting text and localized absolute date should occupy the trailing metadata column",
  )
  const supportingTextIndex = listRow.indexOf("{supportingText}")
  assert.ok(supportingTextIndex >= 0)
  const supportingTextBlock = listRow.slice(
    listRow.lastIndexOf("<Text", supportingTextIndex),
    listRow.indexOf("</Text>", supportingTextIndex) + "</Text>".length,
  )
  assert.match(supportingTextBlock, /lineLimit=\{1\}/)
  assert.match(supportingTextBlock, /minScaleFactor=\{0\.85\}/)
  assert.match(supportingTextBlock, /truncationMode="middle"/)
  assert.match(supportingTextBlock, /allowsTightening=\{true\}/)
  assert.match(supportingTextBlock, /multilineTextAlignment="trailing"/)
  assert.match(supportingTextBlock, /frame=\{\{ maxWidth: "infinity", alignment: "trailing" \}\}/)
  assert.match(
    listRow,
    /frame=\{\{ maxWidth: "infinity", height: 13, alignment: "trailing" \}\}/,
    "a long note must remain in its reserved one-line slot above the date",
  )
  const dateIndex = listRow.indexOf("{formatWidgetItemDate(item, widgetRuntimeLocale())}")
  assert.ok(dateIndex > supportingTextIndex, "the absolute date must remain a separate row after the note")
  assert.equal(listRow.match(/formatWidgetItemDate\(item, widgetRuntimeLocale\(\)\)/g)?.length, 1)
  assert.doesNotMatch(listRow, /DueStatusLabel|DateLabel|status\.label|style="timer"/)
  assert.match(listDetail, /return \[item\.amount, item\.note\][\s\S]*?\.join\(" · "\)/)
  assert.doesNotMatch(listDetail, /formatWidgetItemDate\(item, widgetRuntimeLocale\(\)\)/)

  assert.match(listCompletionIcon, /systemName=\{item\.iconName\}/)
  assert.match(listCompletionIcon, /font=\{symbolSize\}/)
  assert.match(listCompletionIcon, /foregroundStyle=\{enabled \? item\.iconColor : "tertiaryLabel"\}/)
  assert.match(listCompletionIcon, /frame=\{\{ width: hitSize, height: hitSize \}\}/)
  assert.match(
    listCompletionIcon,
    /CompleteDueItemIntent\(\{\s*source: item\.source,\s*id: item\.id,\s*occurrenceKey: item\.completionKey,\s*\}\)/,
  )
})

test("large widgets use adaptive Reminders-style summary and section spacing", () => {
  const source = readFileSync(
    new URL("../到期管家/src/widget_view.tsx", import.meta.url),
    "utf8",
  )
  const listWidget = source.slice(
    source.indexOf("function ListWidget("),
    source.indexOf("function ListWidgetBody"),
  )
  const mediumBody = source.slice(
    source.indexOf("function ListWidgetBody"),
    source.indexOf("function LargeListWidgetBody"),
  )
  const largeBody = source.slice(
    source.indexOf("function LargeListWidgetBody"),
    source.indexOf("function CompletionContent"),
  )
  const largeHeader = source.slice(
    source.indexOf("function LargeSummaryHeader"),
    source.indexOf("function largeSummaryDate"),
  )

  assert.match(largeHeader, /height: number/)
  assert.match(largeHeader, /height, alignment: "topLeading"/)
  assert.match(largeHeader, /frame=\{\{ maxWidth: "infinity", height: 61 \}\}/)
  assert.match(
    largeHeader,
    /<Spacer minLength=\{0\} \/>\s*<Divider padding=\{\{ leading: 5, trailing: 5 \}\} \/>/,
  )
  assert.match(largeHeader, /font=\{26\}/)
  assert.match(largeHeader, /frame=\{\{ width: 40, height: 40 \}\}/)
  assert.match(largeHeader, /<Divider padding=\{\{ leading: 5, trailing: 5 \}\} \/>/)
  assert.match(
    listWidget,
    /<CompletionContent generation=\{completionGeneration\}>[\s\S]*?<LargeSummaryHeader\s+item=\{items\[0\]\}\s+issue=\{issue\}\s+height=\{largeLayout\.summaryHeight\}\s*\/>/,
    "the large header must animate with the completion queue",
  )
  assert.match(
    listWidget,
    /const largeSectionCount = largeLayout[\s\S]*?largeWidgetSectionCount\(visible, largeLayout\.maximumSections\)/,
  )
  assert.match(
    listWidget,
    /widgetRowHeight\(family, displayHeight, limit, largeSectionCount\)/,
  )
  assert.match(listWidget, /maximumSections=\{largeLayout\.maximumSections\}/)
  assert.match(listWidget, /sectionHeaderHeight=\{largeLayout\.sectionHeaderHeight\}/)
  assert.match(largeBody, /maximumSections === 1\s*\? \[\{ title: widgetText\("recentItems", widgetRuntimeLocale\(\)\), rows: indexedItems \}\]/)
  assert.match(largeBody, /title: widgetText\("needsAction", widgetRuntimeLocale\(\)\)/)
  assert.match(largeBody, /title: widgetText\("nextItems", widgetRuntimeLocale\(\)\)/)
  assert.match(largeBody, /maximumSections === 2 && needsAction\.length > 0/)
  assert.match(largeBody, /maximumSections === 2 && upcoming\.length > 0/)
  assert.match(largeBody, /padding=\{\{ bottom: 3, leading: 5, trailing: 5 \}\}/)
  assert.match(largeBody, /height: headerHeight, alignment: "bottomLeading"/)
  assert.doesNotMatch(largeBody, /<Divider/)
  assert.match(mediumBody, /<VStack\s+alignment="leading"\s+spacing=\{1\}/)
  assert.doesNotMatch(mediumBody, /<Divider/)
})

test("small widget uses adaptive item icons and fixed preview geometry", () => {
  const source = readFileSync(
    new URL("../到期管家/src/widget_view.tsx", import.meta.url),
    "utf8",
  )
  const widgetEntry = source.slice(
    source.indexOf("export function DueManagerWidget"),
    source.indexOf("function WidgetHeader"),
  )
  assert.match(source, /const nextItem = items\[1\]/)
  assert.equal(source.match(/<SmallWidgetBody/g)?.length, 1)
  const smallWidget = source.slice(
    source.indexOf("function SmallWidget("),
    source.indexOf("function SmallWidgetBody"),
  )
  const smallBody = source.slice(
    source.indexOf("function SmallWidgetBody"),
    source.indexOf("function SmallDueItem"),
  )
  const widgetHeader = source.slice(
    source.indexOf("function WidgetHeader"),
    source.indexOf("function SmallWidget("),
  )
  const smallDetail = source.slice(
    source.indexOf("function SmallCurrentDetail"),
    source.indexOf("function SmallNextItemPreview"),
  )
  const listCompletionIcon = source.slice(
    source.indexOf("function ListCompletionIcon"),
    source.indexOf("function listItemSupportingText"),
  )

  assert.match(
    widgetEntry,
    /if \(Widget\.family === "systemSmall"\) \{\s*return <SmallWidget \{\.\.\.props\} displayWidth=\{displayWidth\} \/>/,
    "the real small-widget width must enter the compact layout",
  )
  assert.match(smallWidget, /function SmallWidget\(props: WidgetDataProps & \{ displayWidth\?: number \}\)/)
  assert.match(smallWidget, /completionGeneration,\s*displayWidth,/)
  assert.match(
    smallWidget,
    /<SmallWidgetBody\s+item=\{item\}\s+nextItem=\{nextItem\}\s+issue=\{issue\}\s+displayWidth=\{displayWidth\}\s*\/>/,
  )
  assert.match(
    smallBody,
    /<SmallDueItem\s+item=\{item\}\s+nextItem=\{nextItem\}\s+displayWidth=\{displayWidth\}\s+issue=\{issue\}\s*\/>/,
  )
  assert.match(
    smallWidget,
    /compactTitle=\{item\s*\? dueIconLabel\(item\.iconName, widgetRuntimeLanguage\(\)\)\s*:\s*widgetText\("due", widgetRuntimeLocale\(\)\)\}/,
    "the top-left compact title must use the localized current icon name",
  )
  assert.match(widgetHeader, /compactTitle\?: string/)
  assert.match(
    widgetHeader,
    /\{compact \? compactTitle \?\? widgetText\("due", widgetRuntimeLocale\(\)\) : widgetText\("appName", widgetRuntimeLocale\(\)\)\}/,
  )
  assert.match(widgetHeader, /\{compact\s*\? null\s*:\s*<Image/)
  assert.doesNotMatch(smallWidget, /iconName=\{item\?\.iconName\}|iconColor=\{item\?\.iconColor\}/)
  assert.match(smallWidget, /padding=\{\{ leading: 3, trailing: 3 \}\}/)
  const smallItem = source.slice(
    source.indexOf("function SmallDueItem"),
    source.indexOf("function SmallNextItemPreview"),
  )
  assert.match(smallItem, /const detail = smallItemDetail\(item\)/)
  assert.match(
    smallItem,
    /const titleFontSize = smallItemTitleFontSize\(item\.title, displayWidth\)/,
  )
  assert.match(smallItem, /frame=\{\{ maxWidth: "infinity", height: 76, alignment: "topLeading" \}\}/)
  assert.match(smallItem, /<HStack\s+alignment="top"\s+spacing=\{0\}\s+padding=\{\{ top: 15 \}\}/)
  assert.match(
    smallItem,
    /<VStack\s+spacing=\{0\}\s+padding=\{\{ top: -5, bottom: 5 \}\}\s*>\s*<ListCompletionIcon\s+item=\{item\}\s+hitSize=\{40\}\s+symbolSize=\{17\}\s*\/>\s*<\/VStack>/,
    "the small item icon must replace the old circle without shrinking its tap target",
  )
  assert.doesNotMatch(smallItem, /CompletionControl|systemName="circle"/)
  assert.equal(
    smallItem.match(/padding=\{\{ top: -5, bottom: 5 \}\}/g)?.length,
    1,
    "the small completion icon lift must remain unchanged",
  )
  assert.equal(smallItem.match(/padding=\{\{ top: 15 \}\}/g)?.length, 1)
  assert.doesNotMatch(smallItem, /padding=\{\{ top: 22 \}\}/)
  assert.match(smallItem, /frame=\{\{ maxWidth: "infinity", alignment: "leading" \}\}/)
  assert.doesNotMatch(smallItem, /height: 57/)
  assert.match(smallItem, /frame=\{\{ maxWidth: 105, alignment: "leading" \}\}/)
  assert.match(smallItem, /font=\{titleFontSize\}/)
  assert.doesNotMatch(smallItem, /font=\{16\}/)
  assert.match(smallItem, /lineLimit=\{3\}/)
  assert.match(smallItem, /minScaleFactor=\{0\.9\}/)
  assert.match(smallItem, /padding=\{\{ top: 6, bottom: -6 \}\}/)
  assert.equal(
    smallItem.match(/fixedSize=\{\{ horizontal: false, vertical: true \}\}/g)?.length,
    2,
  )
  assert.match(smallItem, /function SmallCurrentDetail/)
  assert.match(smallItem, /padding=\{\{ top: 4, leading: 5, trailing: 5 \}\}/)
  assert.match(smallItem, /font=\{13\}/)
  assert.match(smallDetail, /frame=\{\{ maxWidth: "infinity", height: 19, alignment: "leading" \}\}/)
  assert.match(smallDetail, /padding=\{\{ top: 4, leading: 5, trailing: 5 \}\}/)
  assert.doesNotMatch(smallDetail, /<Spacer/)
  assert.match(smallDetail, /lineLimit=\{1\}/)
  assert.match(smallDetail, /minScaleFactor=\{0\.85\}/)
  assert.match(smallDetail, /truncationMode="middle"/)
  assert.match(smallDetail, /allowsTightening=\{true\}/)
  assert.match(smallDetail, /multilineTextAlignment="leading"/)
  assert.match(smallDetail, /frame=\{\{ maxWidth: "infinity", alignment: "leading" \}\}/)
  assert.match(
    widgetHeader,
    /padding=\{\{[\s\S]*?trailing: 5,[\s\S]*?\}\}/,
    "the compact header and current detail must keep the same 5 pt horizontal inset",
  )
  assert.match(smallItem, /<SmallCurrentDetail item=\{item\} detail=\{detail\} issue=\{issue\} \/>/)
  assert.equal(smallItem.match(/height: 19, alignment: "leading"/g)?.length, 2)
  assert.equal(smallItem.match(/height: 18, alignment: "leading"/g)?.length, 1)
  assert.doesNotMatch(smallItem, /width: 39/)
  assert.match(smallItem, /return \[item\.amount, item\.note\]/)
  assert.match(smallItem, /\.join\(" · "\)/)
  assert.match(smallItem, /<Spacer minLength=\{4\} \/>/)
  assert.match(smallItem, /<Spacer minLength=\{0\} \/>/)
  assert.doesNotMatch(smallItem, /displayDate\(item\)/)
  assert.doesNotMatch(smallItem, /<DueStatusLabel item=\{item\} font="caption" \/>/)
  assert.match(widgetHeader, /font=\{compact \? 13 :/)
  assert.match(widgetHeader, /top: compact \? 8 :/)
  assert.match(widgetHeader, /bottom: compact \? -6 :/)
  assert.match(listCompletionIcon, /systemName=\{item\.iconName\}/)
  assert.match(listCompletionIcon, /foregroundStyle=\{enabled \? item\.iconColor : "tertiaryLabel"\}/)
  assert.match(listCompletionIcon, /frame=\{\{ width: hitSize, height: hitSize \}\}/)
  assert.match(
    listCompletionIcon,
    /CompleteDueItemIntent\(\{\s*source: item\.source,\s*id: item\.id,\s*occurrenceKey: item\.completionKey,\s*\}\)/,
    "tapping the small item icon must complete only the displayed occurrence",
  )
  assert.match(source, /function SmallNextItemPreview/)
  const preview = source.slice(
    source.indexOf("function SmallNextItemPreview"),
    source.indexOf("function ListWidget"),
  )
  assert.match(preview, /height: 18, alignment: "leading"/)
  assert.match(preview, /padding=\{\{ top: -5, leading: 5, trailing: 5, bottom: 9 \}\}/)
  assert.doesNotMatch(preview, /<Divider/)
  assert.doesNotMatch(preview, />下一项<\/Text>/)
  assert.match(preview, /frame=\{\{ maxWidth: "infinity", alignment: "leading" \}\}/)
  assert.match(preview, /<Link url=\{itemURL\(item\)\}>/)
  assert.match(preview, /\{formatWidgetItemDate\(item, widgetRuntimeLocale\(\)\)\}/)
  assert.doesNotMatch(preview, /status\.label|DateLabel|style="timer"/)
  assert.doesNotMatch(preview, /ListCompletionIcon|CompleteDueItemIntent/)
})

test("small widget header keeps its date while list widgets omit item statistics", () => {
  const source = readFileSync(
    new URL("../到期管家/src/widget_view.tsx", import.meta.url),
    "utf8",
  )
  const header = source.slice(
    source.indexOf("function WidgetHeader"),
    source.indexOf("function SmallWidget("),
  )
  assert.match(
    header,
    /\{compact\s*\?\s*<Text[\s\S]*?\{items\[0\]\s*\?\s*formatWidgetDate\(items\[0\]\.dueDate, widgetRuntimeLocale\(\)\)\s*:\s*items\.length\}[\s\S]*?<\/Text>\s*:\s*null\}/,
    "only compact headers should render the current date or the empty-state zero",
  )
  assert.equal(header.match(/items\.length/g)?.length, 1)

  const listWidget = source.slice(
    source.indexOf("function ListWidget("),
    source.indexOf("function ListWidgetBody"),
  )
  assert.match(listWidget, /<WidgetHeader\s+[\s\S]*?items=\{items\}[\s\S]*?issue=\{issue\}[\s\S]*?\/>/)
  assert.doesNotMatch(listWidget, /\bcompact\b/)
})

test("every widget family omits relative-day and live countdown labels", () => {
  const viewSource = readFileSync(
    new URL("../到期管家/src/widget_view.tsx", import.meta.url),
    "utf8",
  )
  const widgetSource = readFileSync(
    new URL("../到期管家/widget.tsx", import.meta.url),
    "utf8",
  )

  assert.doesNotMatch(viewSource, /\bDateLabel\b|style="timer"|DueStatusLabel|status\.label/)
  assert.doesNotMatch(viewSource, /天后|逾期\s*\{|明天|今天/)
  assert.equal(
    viewSource.match(/formatWidgetItemDate\(item, widgetRuntimeLocale\(\)\)/g)?.length,
    2,
    "the small preview and medium/large rows should both show absolute localized dates",
  )
  assert.match(viewSource, /currentWidgetLocale\(\)/)
  assert.match(viewSource, /widgetLanguage\(widgetRuntimeLocale\(\)\)/)
  assert.match(widgetSource, /configureWidgetLocale\(Device\)/)
  assert.doesNotMatch(viewSource, /const WIDGET_(?:LOCALE|LANGUAGE)/)
  assert.match(widgetSource, /widgetText\("loadFailed", WIDGET_LOCALE\)/)
  assert.match(widgetSource, /widgetText\("runAppToCheck", WIDGET_LOCALE\)/)
})

test("settings expose a native multi-list reminder picker", () => {
  const source = readFileSync(
    new URL("../到期管家/index.tsx", import.meta.url),
    "utf8",
  )
  assert.match(source, /function ReminderCalendarPicker/)
  assert.match(source, /Calendar\.forReminders\(\)/)
  assert.match(source, /reminderCalendarIDs/)
  assert.match(source, /提醒事项列表/)
  assert.match(source, /requestAccess\(\[\s*"calendar"\s*,\s*"reminders"\s*\]\)/)
})

test("item editor uses native labeled content for the recurrence interval", () => {
  const source = readFileSync(
    new URL("../到期管家/index.tsx", import.meta.url),
    "utf8",
  )
  const editor = source.slice(
    source.indexOf("function ItemEditor("),
    source.indexOf("function ManualItemsSection("),
  )

  assert.match(
    editor,
    /\[intervalInput, setIntervalInput\] = useState\(\s*String\(item\.recurrence\?\.interval \?\? MIN_RECURRENCE_INTERVAL\),\s*\)/,
  )
  assert.match(
    editor,
    /const recurrenceInterval = parseRecurrenceIntervalInput\(intervalInput\)/,
  )
  assert.match(editor, /recurrenceUnit !== "none" && recurrenceInterval == null/)
  assert.match(editor, /title: "请输入有效间隔"/)
  assert.match(
    editor,
    /message: `间隔必须是 \$\{MIN_RECURRENCE_INTERVAL\}–\$\{MAX_RECURRENCE_INTERVAL\} 的正整数。`/,
  )
  assert.match(
    editor,
    /间隔可输入 \$\{MIN_RECURRENCE_INTERVAL\}–\$\{MAX_RECURRENCE_INTERVAL\} 的正整数。/,
  )

  const repeatSectionStart = editor.indexOf('header={<Text>重复</Text>}')
  const repeatSectionEnd = editor.indexOf("</Section>", repeatSectionStart)
  assert.ok(repeatSectionStart >= 0 && repeatSectionEnd > repeatSectionStart)
  const repeatSection = editor.slice(repeatSectionStart, repeatSectionEnd)

  const intervalValue = repeatSection.indexOf("value={intervalInput}")
  const intervalRowStart = repeatSection.lastIndexOf(
    '<LabeledContent title="间隔">',
    intervalValue,
  )
  const intervalRowEnd = repeatSection.indexOf("</LabeledContent>", intervalValue)
  assert.ok(
    intervalValue >= 0 && intervalRowStart >= 0 && intervalRowEnd > intervalValue,
    "the interval editor must use a native labeled row instead of rendering a bare number",
  )
  const intervalRow = repeatSection.slice(
    intervalRowStart,
    intervalRowEnd + "</LabeledContent>".length,
  )
  assert.match(intervalRow, /<LabeledContent title="间隔">/)
  assert.match(intervalRow, /\{intervalUnitLabel\}/)

  const fieldStart = repeatSection.lastIndexOf("<TextField", intervalValue)
  const fieldEnd = repeatSection.indexOf("/>", intervalValue)
  assert.ok(fieldStart >= intervalRowStart && fieldEnd > intervalValue && fieldEnd < intervalRowEnd)
  const intervalField = repeatSection.slice(fieldStart, fieldEnd + 2)
  assert.match(intervalField, /value=\{intervalInput\}/)
  assert.match(intervalField, /onChanged=\{setIntervalInput\}/)
  assert.match(intervalField, /keyboardType="numberPad"/)
  assert.match(intervalField, /labelsHidden=\{true\}/)
  assert.match(intervalField, /multilineTextAlignment="trailing"/)
  assert.match(intervalField, /frame=\{\{ width: 72, alignment: "trailing" \}\}/)
  assert.match(
    intervalField,
    /prompt=\{`\$\{MIN_RECURRENCE_INTERVAL\}–\$\{MAX_RECURRENCE_INTERVAL\}`\}/,
  )

  assert.match(
    editor,
    /const intervalUnitLabel = recurrenceUnit === "none"\s*\? ""\s*:\s*recurrenceIntervalUnitLabel\(recurrenceUnit\)/,
  )
  const unitHelper = source.slice(
    source.indexOf("function recurrenceIntervalUnitLabel("),
    source.indexOf("function DueManagerApp("),
  )
  assert.match(unitHelper, /case "day": return "天"/)
  assert.match(unitHelper, /case "week": return "周"/)
  assert.match(unitHelper, /case "month": return "个月"/)
  assert.match(unitHelper, /case "year": return "年"/)

  const save = editor.slice(
    editor.indexOf("const save = async"),
    editor.indexOf("const complete = async"),
  )
  const complete = editor.slice(
    editor.indexOf("const complete = async"),
    editor.indexOf("const remove = async"),
  )
  for (const [action, body] of [["save", save], ["complete", complete]] as const) {
    const validation = body.indexOf("const error = validationError()")
    const build = body.indexOf("const nextItem = buildItem()")
    assert.ok(
      validation >= 0 && validation < build,
      `${action} must validate before building the item`,
    )
    assert.match(body, /if \(error\) \{\s*await Dialog\.alert\(error\)\s*return\s*\}/)
  }

  assert.match(editor, /interval: recurrenceInterval!/)
  assert.match(editor, /createRecurrenceRule\(\s*recurrenceUnit,\s*recurrenceInterval!/)
  assert.doesNotMatch(editor, /const intervals\s*=/)
  assert.doesNotMatch(editor, /intervals\.map|Array\.from\(\{\s*length:\s*12/)
  assert.doesNotMatch(editor, /\[interval,\s*setInterval\]/)

  const actions = editor.slice(
    editor.indexOf('header={<Text>本期操作</Text>}'),
    editor.indexOf('title="删除事项"'),
  )
  assert.match(actions, /footer=\{recurrenceUnit !== "none"/)
  assert.match(
    actions,
    /title=\{recurrenceUnit !== "none" \? "完成本期" : "标记完成"\}/,
  )
  assert.match(actions, /\{recurrenceUnit !== "none" && currentStatus\?\.overdue/)
})

test("item editor places advance reminders inside the recurrence section", () => {
  const source = readFileSync(
    new URL("../到期管家/index.tsx", import.meta.url),
    "utf8",
  )
  const editor = source.slice(
    source.indexOf("function ItemEditor("),
    source.indexOf("function ManualItemsSection("),
  )

  assert.match(
    editor,
    /\[remindBeforeInput, setRemindBeforeInput\] = useState\(\s*String\(item\.remindBeforeDays \?\? MIN_REMIND_BEFORE_DAYS\),\s*\)/,
  )
  assert.match(
    editor,
    /const remindBeforeDays = parseRemindBeforeDaysInput\(remindBeforeInput\)/,
  )
  assert.match(editor, /if \(remindBeforeDays == null\) \{[\s\S]*?title: "请输入有效的提前天数"/)
  assert.match(
    editor,
    /message: `提前天数必须是 \$\{MIN_REMIND_BEFORE_DAYS\}–\$\{MAX_REMIND_BEFORE_DAYS\} 的整数；0 表示不提前。`/,
  )
  assert.match(editor, /remindBeforeDays: remindBeforeDays!/)

  const sectionTitle = editor.indexOf('header={<Text>重复</Text>}')
  const sectionEnd = editor.indexOf("</Section>", sectionTitle)
  assert.ok(sectionTitle >= 0 && sectionEnd > sectionTitle)
  const section = editor.slice(sectionTitle, sectionEnd)
  assert.doesNotMatch(editor, /header=\{<Text>提前提醒<\/Text>\}/)
  assert.match(section, /真实到期日、月末规则和周期锚点保持不变/)
  const remindValue = section.indexOf("value={remindBeforeInput}")
  const remindRowStart = section.lastIndexOf(
    '<LabeledContent title="提前提醒">',
    remindValue,
  )
  const remindRowEnd = section.indexOf("</LabeledContent>", remindValue)
  assert.ok(
    remindValue >= 0 && remindRowStart >= 0 && remindRowEnd > remindValue,
    "the advance-days editor must be a labeled row inside Recurrence",
  )
  const remindRow = section.slice(
    remindRowStart,
    remindRowEnd + "</LabeledContent>".length,
  )
  assert.match(remindRow, /<LabeledContent title="提前提醒">/)

  const remindFieldStart = section.lastIndexOf("<TextField", remindValue)
  const remindFieldEnd = section.indexOf("/>", remindValue)
  assert.ok(
    remindFieldStart >= remindRowStart
      && remindFieldEnd > remindValue
      && remindFieldEnd < remindRowEnd,
  )
  const remindField = section.slice(remindFieldStart, remindFieldEnd + 2)
  assert.match(remindField, /value=\{remindBeforeInput\}/)
  assert.match(remindField, /onChanged=\{setRemindBeforeInput\}/)
  assert.match(remindField, /prompt=\{`\$\{MIN_REMIND_BEFORE_DAYS\}–\$\{MAX_REMIND_BEFORE_DAYS\}`\}/)
  assert.match(remindField, /keyboardType="numberPad"/)
  assert.match(remindField, /labelsHidden=\{true\}/)
  assert.match(remindField, /multilineTextAlignment="trailing"/)
  assert.match(remindField, /frame=\{\{ width: 72, alignment: "trailing" \}\}/)
  assert.match(remindRow, /<Text foregroundStyle="secondaryLabel">天<\/Text>/)
})

test("item editor derives its type picker from the centralized definitions", () => {
  const source = readFileSync(
    new URL("../到期管家/index.tsx", import.meta.url),
    "utf8",
  )
  assert.match(source, /ITEM_KIND_DEFINITIONS\.map\(definition =>/)
  assert.match(source, /tag=\{definition\.value\}/)
  assert.match(source, /if \(isItemKind\(value\)\) setKind\(value\)/)
  assert.doesNotMatch(source, /<Text tag="creditCard">/)
  assert.doesNotMatch(source, /<Text tag="subscription">/)
  assert.doesNotMatch(source, /<Text tag="bill">/)
  assert.doesNotMatch(source, /<Text tag="custom">/)
})

test("published script keeps a fixed remote URL and exposes a checked backed-up update flow", () => {
  const manifest = JSON.parse(readFileSync(
    new URL("../到期管家/script.json", import.meta.url),
    "utf8",
  ))
  assert.equal(manifest.version, "2.5.2")
  const latestPackageURL = "https://github.com/MaroonYS/scripting-due-manager/releases/latest/download/due-manager.scripting"
  assert.equal(manifest.remoteResource.url, latestPackageURL)

  const source = readFileSync(
    new URL("../到期管家/index.tsx", import.meta.url),
    "utf8",
  )
  const updates = readFileSync(new URL("../到期管家/src/updates.ts", import.meta.url), "utf8")
  const updateView = readFileSync(new URL("../到期管家/src/update_view.tsx", import.meta.url), "utf8")
  assert.match(updates, /const LATEST_PACKAGE_URL = "https:\/\/github\.com\/MaroonYS\/scripting-due-manager\/releases\/latest\/download\/due-manager\.scripting"/)
  assert.match(updates, /from=\$\{encodeURIComponent\(currentVersion\)\}&t=/)
  assert.match(updateView, /await checkLatestRelease\(\)/)
  assert.ok(updateView.indexOf("createLocalSnapshot(`更新至") < updateView.indexOf("await Safari.openURL"))
  const versionSectionStart = source.indexOf("本机持久存储已启用")
  const versionSectionEnd = source.indexOf("</Section>", versionSectionStart)
  assert.ok(versionSectionStart >= 0 && versionSectionEnd > versionSectionStart)
  const versionSection = source.slice(versionSectionStart, versionSectionEnd)
  assert.match(versionSection, /<Text>版本<\/Text>[\s\S]*?\{Script\.metadata\.version\}/)
  assert.match(
    versionSection,
    /<NavigationLink destination=\{<UpdateView \/>\}>[\s\S]*?<Label title="检查并更新版本" systemImage="arrow\.down\.circle" \/>[\s\S]*?<\/NavigationLink>/,
  )
  assert.ok(
    versionSection.indexOf("Script.metadata.version")
      < versionSection.indexOf("<UpdateView"),
    "the update entry must appear beside and immediately after the displayed version",
  )
})

test("storage failure is surfaced instead of pretending settings were saved", () => {
  const originalStorage = (globalThis as any).Storage
  try {
    ;(globalThis as any).Storage = {
      get: () => ({ schemaVersion: 1, items: [], settings: {}, updatedAt: 0 }),
      set: () => false,
      remove: () => undefined,
      contains: () => true,
    }
    assert.throws(() => updateSettings({ showAmounts: false }), /无法保存/)
  } finally {
    ;(globalThis as any).Storage = originalStorage
  }
})

test("unknown state schema is rejected without overwriting it", () => {
  const originalStorage = (globalThis as any).Storage
  let wrote = false
  try {
    ;(globalThis as any).Storage = {
      get: () => ({ schemaVersion: 99, items: [], settings: {} }),
      set: () => { wrote = true; return true },
      remove: () => undefined,
      contains: () => true,
    }
    assert.throws(() => loadState(), /不受支持的数据版本/)
    assert.equal(wrote, false)
  } finally {
    ;(globalThis as any).Storage = originalStorage
  }
})
