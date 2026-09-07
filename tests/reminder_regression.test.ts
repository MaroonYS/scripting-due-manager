import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"
import {
  completeReminderOccurrence,
  findReminderDisplayItemForCompletion,
  loadReminderItems,
  clearReminderSnapshot,
} from "../到期管家/src/reminders.ts"
import { createBackupJSON, parseBackupJSON } from "../到期管家/src/recovery.ts"
import { REMINDER_SNAPSHOT_KEY, STATE_KEY, defaultState, loadState } from "../到期管家/src/storage.ts"
import { loadWidgetData } from "../到期管家/src/widget_data.ts"

const globals = globalThis as Record<string, any>
const remindersModule = new URL("../到期管家/src/reminders.ts", import.meta.url).href
const localizationModule = new URL("../到期管家/src/widget_localization.ts", import.meta.url).href

function readCacheInTimeZone(cached: ReturnType<typeof snapshot>, timeZone: string): Record<string, any> {
  // Isolate TZ from the test runner and other suites: engines cache time zones
  // differently when process.env.TZ changes during async tests.
  const script = `
    import { loadReminderItems, findReminderDisplayItemForCompletion } from ${JSON.stringify(remindersModule)};
    import { formatWidgetDate, formatWidgetItemDate, formatWidgetItemTime } from ${JSON.stringify(localizationModule)};
    globalThis.Storage = { get: () => (${JSON.stringify(cached)}) };
    globalThis.Reminder = { getIncompletes: async () => { throw new Error("offline") } };
    const result = await loadReminderItems(365);
    const item = result.items[0];
    console.log(JSON.stringify({
      item, fromCache: result.fromCache,
      header: formatWidgetDate(item.dueDate, "en-US"),
      time: formatWidgetItemTime(item, "en-US"),
      fullDate: formatWidgetItemDate(item, "en-US"),
      feedback: findReminderDisplayItemForCompletion(item.id, item.completionKey),
      wrongKey: findReminderDisplayItemForCompletion(item.id, "outdated-key"),
      localDayEnd: new Date(2026, 8, 4, 23, 59, 59, 999).getTime(),
    }));
  `
  const processResult = spawnSync(process.execPath, ["--eval", script], {
    encoding: "utf8", env: { ...process.env, TZ: timeZone },
  })
  assert.equal(processResult.status, 0, processResult.stderr)
  return JSON.parse(processResult.stdout)
}

function cachedItem(overrides: Record<string, any> = {}) {
  return {
    id: "reminder-regression",
    title: "Reminder",
    dueDate: "2026-09-04",
    includesTime: false,
    hour: 0,
    minute: 0,
    dueTimestamp: new Date(2026, 8, 4, 23, 59, 59, 999).getTime(),
    calendarTitle: "Reminders",
    noteIconHint: null,
    noteIconConfidence: null,
    priority: 0,
    canComplete: true,
    ...overrides,
  }
}

function snapshot(items = [cachedItem()], fetchedAt = Date.now()) {
  return { schemaVersion: 1, fetchedAt, calendarFilterIDs: [], items }
}

function reminder(overrides: Record<string, any> = {}) {
  return {
    identifier: "reminder-regression",
    title: "Reminder",
    dueDateComponents: { year: 2026, month: 9, day: 4, date: new Date(2026, 8, 4) },
    calendar: { title: "Reminders", allowsContentModifications: true },
    isCompleted: false,
    save: async () => undefined,
    ...overrides,
  }
}

async function withRuntime(operation: (store: Map<string, any>) => Promise<void>) {
  const originals = new Map(["Storage", "Reminder", "Device", "Calendar"].map(key => [key, globals[key]]))
  const previousTimeZone = process.env.TZ
  const store = new Map<string, any>()
  const keyFor = (key: string, options?: { shared?: boolean }) => `${options?.shared ? "shared" : "private"}:${key}`
  globals.Storage = {
    get: (key: string, options?: { shared?: boolean }) => structuredClone(store.get(keyFor(key, options))),
    set: (key: string, value: unknown, options?: { shared?: boolean }) => {
      store.set(keyFor(key, options), structuredClone(value))
      return true
    },
    remove: (key: string, options?: { shared?: boolean }) => { store.delete(keyFor(key, options)) },
    contains: (key: string, options?: { shared?: boolean }) => store.has(keyFor(key, options)),
  }
  globals.Device = { preferredLanguages: ["en-US"] }
  try { await operation(store) }
  finally {
    for (const [key, value] of originals) {
      if (value === undefined) delete globals[key]
      else globals[key] = value
    }
    if (previousTimeZone === undefined) delete process.env.TZ
    else process.env.TZ = previousTimeZone
  }
}

test("successful Reminder.save survives cache read, legacy migration and cache write failures", async () => {
  for (const fault of ["read", "legacy-migration", "write-false", "write-throw"]) {
    await withRuntime(async store => {
      store.set(`${fault === "legacy-migration" ? "private" : "shared"}:${REMINDER_SNAPSHOT_KEY}`, snapshot())
      let saves = 0
      const current = reminder({ save: async () => { saves += 1 } })
      globals.Reminder = { get: async () => current }
      const storage = { ...globals.Storage }
      globals.Storage.get = (key: string, options?: { shared?: boolean }) => {
        if (saves && key === REMINDER_SNAPSHOT_KEY && fault === "read") throw new Error("cache read failed")
        return storage.get(key, options)
      }
      globals.Storage.set = (key: string, value: unknown, options?: { shared?: boolean }) => {
        if (saves && key === REMINDER_SNAPSHOT_KEY) {
          if (fault === "write-false") return false
          if (fault === "write-throw" || fault === "legacy-migration") throw new Error("cache write failed")
        }
        return storage.set(key, value, options)
      }
      assert.equal(await completeReminderOccurrence(current.identifier, "date:2026-09-04"), "appliedCacheStale", fault)
      assert.equal(saves, 1, fault)
      assert.equal(loadState().completionHistory?.length, 1, fault)
      // Even when cleanup still fails, an old already-completed button cannot save again.
      assert.equal(await completeReminderOccurrence(current.identifier, "date:2026-09-04"), "missing", fault)
      assert.equal(saves, 1, fault)
    })
  }
})

test("optional cache read failure does not reject loading or the feedback lookup", async () => {
  await withRuntime(async () => {
    globals.Reminder = { getIncompletes: async () => { throw new Error("offline") } }
    globals.Storage.get = () => { throw new Error("cache unavailable") }
    const result = await loadReminderItems(365)
    assert.deepEqual(result.items, [])
    assert.equal(result.live, false)
    assert.equal(result.fromCache, false)
    assert.match(result.error ?? "", /offline.*缓存读取失败.*cache unavailable/)
    const previousErrorLogger = console.error
    const logged: unknown[][] = []
    console.error = (...args) => { logged.push(args) }
    try {
      assert.equal(findReminderDisplayItemForCompletion("reminder-regression", "date:2026-09-04"), null)
      assert.equal(logged.length, 1)
    } finally { console.error = previousErrorLogger }
  })
})

test("offline timed caches follow the current zone while preserving occurrence identity", () => {
    // Originally September 4 at 00:30 in Hong Kong, now September 3 in Los Angeles.
    const timestamp = Date.UTC(2026, 8, 3, 16, 30)
    const result = readCacheInTimeZone(snapshot([cachedItem({
      dueDate: "2026-09-04", includesTime: true, hour: 0, minute: 30, dueTimestamp: timestamp,
    })]), "America/Los_Angeles")
    const item = result.item
    assert.equal(result.fromCache, true)
    assert.equal(item.stale, true)
    assert.equal(item.dueDate, "2026-09-03")
    assert.equal(item.hour, 9)
    assert.equal(item.minute, 30)
    assert.equal(item.dueTimestamp, timestamp)
    assert.equal(item.completionKey, `time:${timestamp}`)
    assert.match(result.header, /Sep 3/)
    assert.equal(result.time, "9:30 AM")
    assert.match(result.fullDate, /Sep 3/)
    assert.equal(result.feedback.dueDate, "2026-09-03")
    assert.equal(result.wrongKey, null)
})

test("offline all-day caches retain the floating date and use the new zone day-end", () => {
    const oldTimestamp = Date.UTC(2026, 8, 4, 15, 59, 59, 999)
    const result = readCacheInTimeZone(snapshot([cachedItem({ dueTimestamp: oldTimestamp, canComplete: false })]), "America/Los_Angeles")
    const item = result.item
    assert.equal(item.dueDate, "2026-09-04")
    assert.equal(item.dueTimestamp, result.localDayEnd)
    assert.notEqual(item.dueTimestamp, oldTimestamp)
    assert.equal(item.completionKey, "date:2026-09-04")
    assert.equal(item.canComplete, false)
    assert.equal(item.stale, true)
    assert.equal(result.time, "")
})

test("legacy read-only cached items and outdated occurrence keys cannot bypass EventKit checks", async () => {
  await withRuntime(async store => {
    store.set(`private:${REMINDER_SNAPSHOT_KEY}`, snapshot([cachedItem({ canComplete: false })]))
    const feedback = findReminderDisplayItemForCompletion("reminder-regression", "date:2026-09-04")
    assert.equal(feedback?.canComplete, false)
    let saves = 0
    const current = reminder({ calendar: { allowsContentModifications: false }, save: async () => { saves += 1 } })
    globals.Reminder = { get: async () => current }
    assert.equal(await completeReminderOccurrence(current.identifier, "date:2026-09-03"), "stale")
    await assert.rejects(() => completeReminderOccurrence(current.identifier, "date:2026-09-04"), /只读/)
    assert.equal(saves, 0)
  })
})

test("blank live and legacy cached Reminder titles share a nonempty fallback", async () => {
  for (const title of ["", " \n\t ", null]) {
    await withRuntime(async store => {
      const current = reminder({ title })
      globals.Reminder = { getIncompletes: async () => [current], get: async () => current }
      const item = (await loadReminderItems(365)).items[0]
      assert.equal(item.title, "Untitled Reminder")
      assert.equal(await completeReminderOccurrence(item.id, item.completionKey), "applied")
      const backup = parseBackupJSON(createBackupJSON())
      assert.equal(backup.historyCount, 1)
      assert.equal(backup.state.completionHistory?.[0].title, "Untitled Reminder")
      store.set(`shared:${REMINDER_SNAPSHOT_KEY}`, snapshot([cachedItem({ title: typeof title === "string" ? title : "" })]))
      globals.Reminder.getIncompletes = async () => { throw new Error("offline") }
      assert.equal((await loadReminderItems(365)).items[0].title, "Untitled Reminder")
    })
  }
})

test("blank Reminder presentation follows a changed system language while offline", async () => {
  await withRuntime(async store => {
    globals.Device = {
      preferredLanguages: ["zh-Hans-CN"],
      systemLanguageTag: "en-US",
      systemLanguageCode: "en",
    }
    const current = reminder({ title: "", calendar: { allowsContentModifications: true } })
    globals.Reminder = { getIncompletes: async () => [current] }
    const live = await loadReminderItems(365)
    assert.equal(live.items[0].title, "Untitled Reminder")
    assert.equal(live.items[0].note, "")
    const saved = store.get(`shared:${REMINDER_SNAPSHOT_KEY}`)
    assert.equal(saved.items[0].title, "")
    assert.equal(saved.items[0].calendarTitle, "")

    globals.Device = {
      preferredLanguages: ["en-US"],
      systemLanguageTag: "zh-Hant-HK",
      systemLanguageCode: "zh",
      systemScriptCode: "Hant",
      systemCountryCode: "HK",
    }
    globals.Reminder.getIncompletes = async () => { throw new Error("offline") }
    const cached = await loadReminderItems(365)
    assert.equal(cached.items[0].title, "未命名提醒")
    assert.equal(cached.items[0].note, "")
  })
})

test("literal fallback-looking Reminder titles are never rewritten", async () => {
  for (const [title, systemLanguageTag] of [
    ["Untitled Reminder", "zh-Hant-HK"],
    ["未命名提醒", "en-US"],
  ] as const) {
    await withRuntime(async store => {
      globals.Device = {
        preferredLanguages: [systemLanguageTag],
        systemLanguageTag,
      }
      const current = reminder({ title })
      globals.Reminder = {
        getIncompletes: async () => [current],
        get: async () => current,
      }
      const live = await loadReminderItems(365)
      assert.equal(live.items[0].title, title)
      assert.equal(store.get(`shared:${REMINDER_SNAPSHOT_KEY}`).items[0].title, title)

      globals.Reminder.getIncompletes = async () => { throw new Error("offline") }
      assert.equal((await loadReminderItems(365)).items[0].title, title)

      const result = await completeReminderOccurrence(live.items[0].id, live.items[0].completionKey)
      assert.equal(result, "applied")
      assert.equal(loadState().completionHistory?.[0].title, title)
    })
  }
})

test("cached Reminder titles and Lists are re-inferred with the current icon rules", async () => {
  await withRuntime(async store => {
    store.set(`shared:${REMINDER_SNAPSHOT_KEY}`, snapshot([
      cachedItem({ title: "Card Setup", calendarTitle: "Wallet Plan" }),
    ]))
    globals.Reminder = { getIncompletes: async () => { throw new Error("offline") } }

    const result = await loadReminderItems(365)
    assert.equal(result.fromCache, true)
    assert.equal(result.items[0].title, "Card Setup")
    assert.equal(result.items[0].note, "Wallet Plan")
    assert.equal(result.items[0].iconName, "creditcard.fill")
  })
})

test("one Wallet Plan List preserves mixed module icons in live and cached rows", async () => {
  await withRuntime(async store => {
    const rows = [
      reminder({
        identifier: "wallet-bank",
        title: "BANK 06 | Ally 后备资格",
        dueDateComponents: { year: 2026, month: 9, day: 4, date: new Date(2026, 8, 4) },
        calendar: { title: "Wallet Plan", allowsContentModifications: true },
      }),
      reminder({
        identifier: "wallet-credit",
        title: "CREDIT 09 | Quicksilver AutoPay",
        dueDateComponents: { year: 2026, month: 9, day: 5, date: new Date(2026, 8, 5) },
        calendar: { title: "Wallet Plan", allowsContentModifications: true },
      }),
      reminder({
        identifier: "wallet-report",
        title: "Equifax Complete Premier",
        dueDateComponents: { year: 2026, month: 9, day: 6, date: new Date(2026, 8, 6) },
        calendar: { title: "Wallet Plan", allowsContentModifications: true },
      }),
      reminder({
        identifier: "wallet-note",
        title: "847291",
        notes: "1Password Families",
        dueDateComponents: { year: 2026, month: 9, day: 7, date: new Date(2026, 8, 7) },
        calendar: { title: "Wallet Plan", allowsContentModifications: true },
      }),
      reminder({
        identifier: "wallet-unknown",
        title: "4994",
        dueDateComponents: { year: 2026, month: 9, day: 8, date: new Date(2026, 8, 8) },
        calendar: { title: "Wallet Plan", allowsContentModifications: true },
      }),
    ]
    globals.Reminder = { getIncompletes: async () => rows }

    const live = await loadReminderItems(365)
    const expected = [
      "building.columns.fill",
      "creditcard.fill",
      "doc.text.magnifyingglass",
      "key.fill",
      "checklist",
    ]
    assert.deepEqual(live.items.map(item => item.iconName), expected)

    const cached = store.get(`shared:${REMINDER_SNAPSHOT_KEY}`)
    assert.equal(cached.items[3].notes, undefined, "private note text must not enter the cache")
    assert.equal(cached.items[3].noteIconHint, "key.fill")
    assert.equal(cached.items[3].noteIconConfidence, "strong")

    globals.Reminder.getIncompletes = async () => { throw new Error("offline") }
    const offline = await loadReminderItems(365)
    assert.equal(offline.fromCache, true)
    assert.deepEqual(offline.items.map(item => item.iconName), expected)
  })
})

test("expired cache retains its successful fetch timestamp without returning expired rows", async () => {
  await withRuntime(async store => {
    const fetchedAt = Date.now() - 25 * 60 * 60 * 1000
    store.set(`shared:${REMINDER_SNAPSHOT_KEY}`, snapshot([cachedItem()], fetchedAt))
    globals.Reminder = { getIncompletes: async () => { throw new Error("offline") } }
    const result = await loadReminderItems(365)
    assert.equal(result.fetchedAt, fetchedAt)
    assert.equal(result.fromCache, false)
    assert.deepEqual(result.items, [])
    assert.match(result.error ?? "", /缓存已过期/)
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

test("a slower earlier sync cannot overwrite or display the newer same-list result", async () => {
  await withRuntime(async store => {
    const old = deferred<any[]>()
    let calls = 0
    globals.Reminder = { getIncompletes: () => ++calls === 1
      ? old.promise : Promise.resolve([reminder({ title: "New title" })]) }
    const first = loadReminderItems(365)
    const latest = await loadReminderItems(365)
    old.resolve([reminder({ title: "Old title" })])
    const late = await first
    assert.equal(latest.items[0].title, "New title")
    assert.equal(late.items[0].title, "New title")
    assert.equal(late.error, null, "normal overlapping widget loads should not create an error banner")
    assert.equal(store.get(`shared:${REMINDER_SNAPSHOT_KEY}`).items[0].title, "New title")
  })
})

test("clearing the cache invalidates pending reads before they can repopulate it", async () => {
  await withRuntime(async store => {
    const old = deferred<any[]>()
    store.set(`shared:${REMINDER_SNAPSHOT_KEY}`, snapshot())
    globals.Reminder = { getIncompletes: () => old.promise }
    const loading = loadReminderItems(365)
    clearReminderSnapshot()
    old.resolve([reminder()])
    const result = await loading
    assert.deepEqual(result.items, [])
    assert.equal(result.live, false)
    assert.equal(store.has(`shared:${REMINDER_SNAPSHOT_KEY}`), false)
  })
})

test("completion invalidates an in-flight query from a separate module runtime", async () => {
  await withRuntime(async store => {
    const otherRuntime = await import(`${remindersModule}?race=completion`)
    const old = deferred<any[]>()
    store.set(`shared:${REMINDER_SNAPSHOT_KEY}`, snapshot())
    globals.Reminder = { getIncompletes: () => old.promise, get: async () => reminder() }
    const loading = otherRuntime.loadReminderItems(365)
    assert.equal(await completeReminderOccurrence("reminder-regression", "date:2026-09-04"), "applied")
    old.resolve([reminder()])
    const result = await loading
    assert.deepEqual(result.items, [])
    assert.deepEqual(store.get(`shared:${REMINDER_SNAPSHOT_KEY}`).items, [])
    assert.equal(loadState().completionHistory?.length, 1)
  })
})

test("shared query start times prevent an older runtime from replacing a newer cache", async () => {
  await withRuntime(async store => {
    const otherRuntime = await import(`${remindersModule}?race=ordering`)
    const old = deferred<any[]>()
    const originalNow = Date.now
    let now = originalNow()
    Date.now = () => now
    try {
      globals.Reminder = { getIncompletes: () => old.promise }
      const loading = otherRuntime.loadReminderItems(365)
      now += 10
      globals.Reminder.getIncompletes = async () => [reminder({ title: "New runtime result" })]
      await loadReminderItems(365)
      old.resolve([reminder({ title: "Old runtime result" })])
      assert.equal((await loading).items[0].title, "New runtime result")
      assert.equal(store.get(`shared:${REMINDER_SNAPSHOT_KEY}`).items[0].title, "New runtime result")
    } finally { Date.now = originalNow }
  })
})

test("offline fallback respects a shortened date horizon", async () => {
  await withRuntime(async store => {
    store.set(`shared:${REMINDER_SNAPSHOT_KEY}`, snapshot([
      cachedItem(), cachedItem({ id: "far", dueDate: "2026-12-01",
        dueTimestamp: new Date(2026, 11, 1, 23, 59, 59, 999).getTime() }),
    ]))
    globals.Reminder = { getIncompletes: async () => { throw new Error("offline") } }
    const result = await loadReminderItems(30, [], new Date(2026, 8, 4))
    assert.deepEqual(result.items.map(item => item.id), ["reminder-regression"])
  })
})

test("all-day reminders on the horizon boundary use the calendar day, not the display day-end", async () => {
  await withRuntime(async store => {
    store.set(`shared:${REMINDER_SNAPSHOT_KEY}`, snapshot([
      cachedItem({ id: "all-day", dueDate: "2026-10-04",
        dueTimestamp: new Date(2026, 9, 4, 23, 59, 59, 999).getTime() }),
      cachedItem({ id: "timed", dueDate: "2026-10-04", includesTime: true,
        dueTimestamp: new Date(2026, 9, 4, 18).getTime() }),
    ]))
    globals.Reminder = { getIncompletes: async () => { throw new Error("offline") } }
    const result = await loadReminderItems(30, [], new Date(2026, 8, 4, 12))
    assert.deepEqual(result.items.map(item => item.id), ["all-day"])
  })
})

test("an overlapping narrower query cannot silently shrink a wider live result", async () => {
  await withRuntime(async store => {
    const old = deferred<any[]>()
    globals.Reminder = { getIncompletes: () => old.promise }
    const wider = loadReminderItems(730)
    globals.Reminder.getIncompletes = async () => [reminder({ identifier: "near" })]
    await loadReminderItems(30)
    old.resolve([reminder({ identifier: "near" }), reminder({ identifier: "far",
      dueDateComponents: { year: 2027, month: 1, day: 1, date: new Date(2027, 0, 1) } })])
    assert.deepEqual((await wider).items.map(item => item.id), ["near", "far"])
    assert.equal(store.get(`shared:${REMINDER_SNAPSHOT_KEY}`).queryHorizonDays, 30)
  })
})

test("unreadable synchronization metadata leaves successful live data usable without claiming a saved cache", async () => {
  await withRuntime(async store => {
    const originalGet = globals.Storage.get
    globals.Storage.get = (key: string, options?: { shared: boolean }) => {
      if (key === "due-manager-reminder-sync-token-v1") throw new Error("storage unavailable")
      return originalGet(key, options)
    }
    globals.Reminder = { getIncompletes: async () => [reminder()] }
    const result = await loadReminderItems(365)
    assert.equal(result.live, true)
    assert.equal(result.items.length, 1)
    assert.match(result.error ?? "", /无法保存提醒缓存/)
    assert.equal(store.has(`shared:${REMINDER_SNAPSHOT_KEY}`), false)
  })
})

test("clock rollback does not let a future-dated old cache block a fresh successful query", async () => {
  await withRuntime(async store => {
    const future = Date.now() + 60 * 60 * 1000
    store.set(`shared:${REMINDER_SNAPSHOT_KEY}`, { ...snapshot([cachedItem({ title: "Old" })], future),
      queryStartedAt: future - 10, queryHorizonDays: 365 })
    globals.Reminder = { getIncompletes: async () => [reminder({ title: "Fresh" })] }
    const result = await loadReminderItems(365)
    assert.equal(result.items[0].title, "Fresh")
    assert.equal(store.get(`shared:${REMINDER_SNAPSHOT_KEY}`).items[0].title, "Fresh")
  })
})

test("widget refresh re-reads manual changes and disabled Reminder integration after awaiting EventKit", async () => {
  await withRuntime(async store => {
    const state = defaultState()
    state.settings.includeReminders = true
    store.set(`shared:${STATE_KEY}`, state)
    const old = deferred<any[]>()
    globals.Reminder = { getIncompletes: () => old.promise }
    const loading = loadWidgetData()
    state.settings.includeReminders = false
    state.items.push({ id: "added-during-sync", title: "New manual item", kind: "custom", iconName: null,
      dueDate: "2026-09-05", includesTime: false, hour: 9, minute: 0, remindBeforeDays: 0,
      recurrence: null, amount: "", note: "", enabled: true, createdAt: 1, updatedAt: 1 })
    store.set(`shared:${STATE_KEY}`, state)
    old.resolve([reminder()])
    const result = await loading
    assert.deepEqual(result.items.map(item => item.id), ["added-during-sync"])
    assert.equal(result.reminderResult.error, null)
    assert.equal(result.state.settings.includeReminders, false)
  })
})

test("widget refresh reloads the changed List instead of mixing old reminders with new settings", async () => {
  await withRuntime(async store => {
    const state = defaultState()
    state.settings.includeReminders = true
    store.set(`shared:${STATE_KEY}`, state)
    const old = deferred<any[]>()
    const filters: string[][] = []
    globals.Calendar = { forReminders: async () => [{ identifier: "new-list" }] }
    globals.Reminder = { getIncompletes: (options: any) => {
      filters.push(options.calendars?.map((calendar: any) => calendar.identifier) ?? [])
      return filters.length === 1 ? old.promise
        : Promise.resolve([reminder({ identifier: "new-list-item", calendar: { title: "Delivery" } })])
    } }
    const loading = loadWidgetData()
    state.settings.reminderCalendarIDs = ["new-list"]
    store.set(`shared:${STATE_KEY}`, state)
    old.resolve([reminder({ identifier: "old-list-item" })])
    const result = await loading
    assert.deepEqual(filters, [[], ["new-list"]])
    assert.deepEqual(result.items.map(item => item.id), ["new-list-item"])
    assert.equal(result.items[0].iconName, "shippingbox.fill")
  })
})
