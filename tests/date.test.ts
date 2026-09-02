import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  advanceManualItem,
  calendarDayDifference,
  createRecurrenceRule,
  dueStatus,
  nextOccurrence,
  parseDateKey,
} from "../到期管家/src/date.ts"
import {
  DUE_ICON_GROUPS,
  DUE_ICON_OPTIONS,
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
  visibleWidgetItems,
  widgetItemCapacity,
  widgetRowHeight,
} from "../到期管家/src/widget_layout.ts"
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

test("legacy state upgrades to schema 2 and preserves old and new item kinds", () => {
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
    assert.equal(migrated.schemaVersion, 2)
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
    assert.equal(sharedValue.schemaVersion, 2)
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

test("quarterly recurrence crosses the year", () => {
  const quarterly = createRecurrenceRule("month", 3, "2026-12-31")
  assert.equal(nextOccurrence("2026-12-31", quarterly), "2027-03-31")
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

test("date-only items stay due today until local midnight", () => {
  const sameDay = item({ dueDate: "2026-08-30" })
  const today = dueStatus(sameDay, new Date(2026, 7, 30, 23, 59, 59))
  const tomorrow = dueStatus(sameDay, new Date(2026, 7, 31, 0, 0, 1))
  assert.equal(today.label, "今天")
  assert.equal(today.overdue, false)
  assert.equal(tomorrow.label, "逾期 1 天")
  assert.equal(tomorrow.overdue, true)
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

test("same-day timed items sort chronologically before date-only items", () => {
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
  assert.deepEqual(sorted.map(value => value.id), ["early", "late", "date-only"])
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

test("completing the visible item lets the next queue item fill its place", () => {
  const first = item({ id: "first", title: "第一件", dueDate: "2026-08-30", updatedAt: 1 })
  const second = item({ id: "second", title: "第二件", dueDate: "2026-08-31", updatedAt: 2 })
  const third = item({ id: "third", title: "第三件", dueDate: "2026-09-01", updatedAt: 3 })
  const state = { ...defaultState(3), items: [first, second, third], updatedAt: 3 }
  const before = visibleWidgetItems(sortDueItems(manualItemsForDisplay(state)), 2)
  assert.deepEqual(before.map(value => value.id), ["first", "second"])

  const completed = planManualCompletion(state, first.id, manualOccurrenceKey(first), 10)
  const after = visibleWidgetItems(sortDueItems(manualItemsForDisplay(completed.state)), 2)
  assert.deepEqual(after.map(value => value.id), ["second", "third"])
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
  assert.equal(widgetItemCapacity("systemLarge", 250), 5)
  assert.equal(widgetItemCapacity("systemLarge", 280), 5)
  assert.equal(widgetItemCapacity("systemLarge", 281), 6)
  assert.equal(widgetItemCapacity("systemLarge", 319), 6)
  assert.equal(widgetItemCapacity("systemLarge", 320), 7)
  assert.equal(widgetItemCapacity("systemLarge", 360), 7)
})

test("widget rows use Apple's published iPhone widget heights", () => {
  assert.equal(widgetItemCapacity("systemMedium", 170), 3)
  assert.equal(widgetRowHeight("systemMedium", 170, 3), 41)
  assert.equal(widgetRowHeight("systemMedium", 145, 2), 42)
  assert.equal(widgetItemCapacity("systemLarge", 382), 7)
  assert.equal(widgetRowHeight("systemLarge", 382, 7), 46)
  assert.equal(widgetRowHeight("systemLarge", 354, 7), 42)
  assert.equal(widgetRowHeight("systemLarge", 250, 5), 39)
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
  assert.match(source, /提醒已完成，但本地缓存未能更新/)
})

test("widget view uses native queue transitions, safe controls, and unified list insets", () => {
  const source = readFileSync(
    new URL("../到期管家/src/widget_view.tsx", import.meta.url),
    "utf8",
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
  assert.match(source, /systemName="lock\.circle"/)
  assert.match(source, /systemName="circle"/)
  assert.match(source, /const hitSize = Math\.min\(height, roomy \? 40 : 38\)/)
  assert.match(source, /<CompletionControl\s+item=\{item\}\s+hitSize=\{40\}/)
  assert.match(
    source,
    /<WidgetFrame contentPadding=\{\{\s*top: 11,\s*bottom: 11,\s*leading: 14,\s*trailing: 14,\s*\}\}>/,
  )
  assert.doesNotMatch(source, /contentPadding=\{roomy \? 14 : 11\}/)
  assert.doesNotMatch(source, /previousItems|completionPhase|layer0|layer1/)
  assert.equal(source.match(/animation=\{\{ animation: COMPLETION_QUEUE_ANIMATION, value: generation \}\}/g)?.length, 1)
  assert.doesNotMatch(source, /symbolEffect=\{\{ effect: "bounce"/)
})

test("small widget previews one non-interactive next queue item", () => {
  const source = readFileSync(
    new URL("../到期管家/src/widget_view.tsx", import.meta.url),
    "utf8",
  )
  assert.match(source, /const nextItem = items\[1\]/)
  assert.equal(source.match(/<SmallWidgetBody/g)?.length, 1)
  const smallWidget = source.slice(
    source.indexOf("function SmallWidget("),
    source.indexOf("function SmallWidgetBody"),
  )
  assert.match(smallWidget, /padding=\{\{ leading: 3, trailing: 3 \}\}/)
  const smallItem = source.slice(
    source.indexOf("function SmallDueItem"),
    source.indexOf("function SmallNextItemPreview"),
  )
  assert.match(smallItem, /const detail = smallItemDetail\(item\)/)
  assert.match(smallItem, /frame=\{\{ maxWidth: "infinity", height: 76, alignment: "topLeading" \}\}/)
  assert.match(smallItem, /<HStack\s+alignment="top"\s+spacing=\{0\}\s+padding=\{\{ top: 15 \}\}/)
  assert.match(
    smallItem,
    /<VStack\s+spacing=\{0\}\s+padding=\{\{ top: -5, bottom: 5 \}\}\s*>\s*<CompletionControl\s+item=\{item\}\s+hitSize=\{40\}\s+symbolSize=\{19\}\s*\/>\s*<\/VStack>/,
  )
  assert.equal(
    source.match(/padding=\{\{ top: -5, bottom: 5 \}\}/g)?.length,
    1,
    "the completion lift must remain small-widget-only",
  )
  assert.equal(smallItem.match(/padding=\{\{ top: 15 \}\}/g)?.length, 1)
  assert.doesNotMatch(smallItem, /padding=\{\{ top: 22 \}\}/)
  assert.match(smallItem, /frame=\{\{ maxWidth: "infinity", alignment: "leading" \}\}/)
  assert.doesNotMatch(smallItem, /height: 57/)
  assert.match(smallItem, /frame=\{\{ maxWidth: 105, alignment: "leading" \}\}/)
  assert.match(smallItem, /font=\{16\}/)
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
  assert.match(smallItem, /frame=\{\{ maxWidth: 135, alignment: "leading" \}\}/)
  assert.match(smallItem, /<SmallCurrentDetail item=\{item\} detail=\{detail\} \/>/)
  assert.equal(smallItem.match(/height: 19, alignment: "leading"/g)?.length, 2)
  assert.equal(smallItem.match(/height: 18, alignment: "leading"/g)?.length, 1)
  assert.doesNotMatch(smallItem, /width: 39/)
  assert.match(smallItem, /return \[item\.amount, item\.note\]/)
  assert.match(smallItem, /\.join\(" · "\)/)
  assert.match(smallItem, /<Spacer minLength=\{4\} \/>/)
  assert.match(smallItem, /<Spacer minLength=\{0\} \/>/)
  assert.doesNotMatch(smallItem, /displayDate\(item\)/)
  assert.doesNotMatch(smallItem, /<DueStatusLabel item=\{item\} font="caption" \/>/)
  assert.match(source, /font=\{compact \? 13 : "headline"\}/)
  assert.match(source, /top: compact \? 8 : 0/)
  assert.match(source, /bottom: compact \? -6 : 0/)
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
  assert.doesNotMatch(preview, /CompletionControl|CompleteDueItemIntent/)

  const listRow = source.slice(
    source.indexOf("function DueItemRow"),
    source.indexOf("function DueStatusLabel"),
  )
  const sharedControl = source.slice(
    source.indexOf("function CompletionControl"),
    source.indexOf("function CompletionSymbol"),
  )
  assert.match(listRow, /return <HStack\s+alignment="center"/)
  assert.match(listRow, /const hitSize = Math\.min\(height, roomy \? 40 : 38\)/)
  assert.doesNotMatch(listRow, /padding=\{\{ top: -5, bottom: 5 \}\}/)
  assert.doesNotMatch(sharedControl, /padding=\{\{ top: -5, bottom: 5 \}\}/)
})

test("small widget header shows its current due date while list widgets keep the count", () => {
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
    /compact\s*&&\s*items\[0\]\s*\?\s*humanDate\(items\[0\]\.dueDate\)\s*:\s*items\.length/,
  )

  const listWidget = source.slice(
    source.indexOf("function ListWidget("),
    source.indexOf("function ListWidgetBody"),
  )
  assert.match(listWidget, /<WidgetHeader\s+[\s\S]*?items=\{items\}[\s\S]*?issue=\{issue\}[\s\S]*?\/>/)
  assert.doesNotMatch(listWidget, /\bcompact\b/)
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

test("published script updates from the fixed latest-release package", () => {
  const manifest = JSON.parse(readFileSync(
    new URL("../到期管家/script.json", import.meta.url),
    "utf8",
  ))
  assert.equal(
    manifest.remoteResource.url,
    "https://github.com/MaroonYS/scripting-due-manager/releases/latest/download/due-manager.scripting",
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
