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
  normalizeIconOverride,
  resolveDueIcon,
} from "../到期管家/src/icons.ts"
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
  loadState,
  manualItemsForDisplay,
  manualOccurrenceKey,
  planManualCompletion,
  REMINDER_SNAPSHOT_KEY,
  STATE_KEY,
  updateSettings,
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
import type { DisplayDueItem, ManualDueItem } from "../到期管家/src/types.ts"

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
    ...overrides,
  }
}

test("validates local date keys", () => {
  assert.deepEqual(parseDateKey("2028-02-29"), { year: 2028, month: 2, day: 29 })
  assert.equal(parseDateKey("2027-02-29"), null)
  assert.equal(parseDateKey("2026-13-01"), null)
})

test("intelligent icons match common services locally", () => {
  assert.equal(resolveDueIcon("Claude Pro", "subscription").name, "sparkles")
  assert.equal(resolveDueIcon("Ｓｐｏｔｉｆｙ 家庭会员", "subscription").name, "music.note")
  assert.equal(resolveDueIcon("网易云音乐黑胶会员", "subscription").name, "music.note")
  assert.equal(resolveDueIcon("Netflix", "subscription").name, "play.rectangle.fill")
  assert.equal(resolveDueIcon("BANK 03 | SoFi", "reminder").name, "building.columns.fill")
  assert.equal(resolveDueIcon("CREDIT 03 | Venture", "reminder").name, "creditcard.fill")
  assert.equal(resolveDueIcon("家庭电费", "bill").name, "bolt.fill")
  assert.equal(resolveDueIcon("车辆车险", "bill").name, "car.fill")
})

test("manual icon override wins and invalid values return to automatic matching", () => {
  assert.equal(resolveDueIcon("Claude Pro", "subscription", "drop.fill").name, "drop.fill")
  assert.equal(normalizeIconOverride("not.a.real.allowed.symbol"), null)
  assert.equal(resolveDueIcon("Claude Pro", "subscription", "not.a.real.allowed.symbol").name, "sparkles")
})

test("icon matching uses English word boundaries", () => {
  assert.equal(resolveDueIcon("Current account review", "custom").name, "calendar.badge.clock")
  assert.equal(resolveDueIcon("Home internet renewal", "subscription").name, "wifi")
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
  assert.equal(widgetItemCapacity("systemMedium", 168), 3)
  assert.equal(widgetItemCapacity("systemLarge", 250), 5)
  assert.equal(widgetItemCapacity("systemLarge", 360), 7)
})

test("widget rows use Apple's published iPhone widget heights", () => {
  assert.equal(widgetItemCapacity("systemMedium", 170), 3)
  assert.equal(widgetRowHeight("systemMedium", 170, 3), 40)
  assert.equal(widgetItemCapacity("systemLarge", 382), 7)
  assert.equal(widgetRowHeight("systemLarge", 382, 7), 44)
  assert.equal(widgetRowHeight("systemLarge", 354, 7), 42)
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
    assert.equal(result.fromCache, true)
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

test("completion feedback preserves the old occurrence until the animation ends", () => {
  const originalStorage = (globalThis as any).Storage
  const sharedValues = new Map<string, unknown>()
  const privateValues = new Map<string, unknown>()
  const now = new Date(2026, 7, 30, 20, 0).getTime()
  const previous = displayItem({
    id: "card",
    completionKey: "2026-08-31|date|1",
    title: "本期账单",
    dueDate: "2026-08-31",
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

    assert.equal(writeWidgetCompletionFeedback(previous, now), true)
    const feedback = readWidgetCompletionFeedback(now + 100)
    assert.equal(feedback.length, 1)
    assert.equal(feedback[0].completionKey, previous.completionKey)
    assert.equal(feedback[0].isCompleting, true)
    assert.equal(feedback[0].note, "")

    const merged = mergeWidgetCompletionFeedback([next, other], feedback)
    assert.equal(merged.some(item => item.completionKey === next.completionKey), false)
    assert.equal(merged.some(item => item.completionKey === previous.completionKey), true)
    assert.equal(merged.some(item => item.id === other.id), true)

    clearWidgetCompletionFeedback("manual", previous.id, previous.completionKey, now + 200)
    assert.deepEqual(readWidgetCompletionFeedback(now + 201), [])
    const cleared = readWidgetCompletionTransition(now + 201)
    assert.equal(cleared.generation, 1)
    assert.equal(cleared.phase, 1)
    assert.equal(sharedValues.has(WIDGET_COMPLETION_FEEDBACK_KEY), true)
    assert.equal(privateValues.has(WIDGET_COMPLETION_FEEDBACK_KEY), false)
  } finally {
    ;(globalThis as any).Storage = originalStorage
  }
})

test("every completion advances the transition generation and replaces older feedback", () => {
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
    assert.deepEqual(firstTransition.items.map(item => item.id), [first.id])

    writeWidgetCompletionFeedback(second, now + 10)
    const secondTransition = readWidgetCompletionTransition(now + 11)
    assert.equal(secondTransition.generation, 2)
    assert.equal(secondTransition.phase, 0)
    assert.deepEqual(secondTransition.items.map(item => item.id), [second.id])

    assert.deepEqual(readWidgetCompletionFeedback(now + 30_011), [])
    const expired = readWidgetCompletionTransition(now + 30_011)
    assert.equal(expired.generation, 2)
    assert.equal(expired.phase, 0)
    assert.deepEqual((values.get(WIDGET_COMPLETION_FEEDBACK_KEY) as any).entries, [])
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
})

test("widget view mounts one plain completion button tree", () => {
  const source = readFileSync(
    new URL("../到期管家/src/widget_view.tsx", import.meta.url),
    "utf8",
  )
  const importBlock = source.slice(0, source.indexOf("from \"scripting\"") + 16)
  assert.doesNotMatch(importBlock, /\bAnimation\b/)
  assert.match(source, /Animation\.default\(\)/)
  assert.match(source, /key="completion-active-layer"/)
  assert.match(source, /function CompletionContent/)
  assert.match(source, /contentTransition="opacity"/)
  assert.match(source, /contentTransition="symbolEffectReplace"/)
  assert.doesNotMatch(source, /zIndex=|allowsHitTesting=|<Toggle|toggleStyle=|buttonStyle="bordered"|buttonBorderShape=|clipShape=/)
  assert.match(source, /return <Button\s+[\s\S]*?buttonStyle="plain"[\s\S]*?CompleteDueItemIntent/)
  assert.match(source, /key=\{`row-\$\{item\.source\}-\$\{item\.id\}-\$\{item\.completionKey\}`\}/)
  assert.match(source, /frame=\{\{ width: hitSize, height: hitSize \}\}/)
  assert.match(source, /circle\.inset\.filled/)
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
  const smallItem = source.slice(
    source.indexOf("function SmallDueItem"),
    source.indexOf("function SmallNextItemPreview"),
  )
  assert.match(smallItem, /padding=\{\{ top: nextItem \? 10 : 12 \}\}/)
  assert.match(smallItem, /<VStack alignment="leading" spacing=\{2\} frame=\{\{ maxWidth: "infinity" \}\}>/)
  assert.match(smallItem, /font=\{17\}/)
  assert.match(smallItem, /lineLimit=\{3\}/)
  assert.match(smallItem, /minScaleFactor=\{0\.9\}/)
  assert.match(smallItem, /<Spacer minLength=\{nextItem \? 4 : 8\} \/>/)
  assert.match(smallItem, /nextItem \? <Spacer minLength=\{0\} \/>/)
  assert.match(source, /font=\{compact \? 13 : "headline"\}/)
  assert.match(source, /function SmallNextItemPreview/)
  const preview = source.slice(
    source.indexOf("function SmallNextItemPreview"),
    source.indexOf("function ListWidget"),
  )
  assert.match(preview, /padding=\{\{ top: 2 \}\}/)
  assert.match(preview, /<Divider padding=\{\{ leading: 39, trailing: 5 \}\} \/>/)
  assert.doesNotMatch(preview, />下一项<\/Text>/)
  assert.match(preview, /frame=\{\{ maxWidth: "infinity", alignment: "leading" \}\}/)
  assert.match(preview, /<Link url=\{itemURL\(item\)\}>/)
  assert.doesNotMatch(preview, /CompletionControl|CompleteDueItemIntent/)
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
