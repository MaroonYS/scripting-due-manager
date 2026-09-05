import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"
import {
  completeReminderOccurrence,
  findReminderDisplayItemForCompletion,
  loadReminderItems,
} from "../到期管家/src/reminders.ts"
import { createBackupJSON, parseBackupJSON } from "../到期管家/src/recovery.ts"
import { REMINDER_SNAPSHOT_KEY, loadState } from "../到期管家/src/storage.ts"

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
  const originals = new Map(["Storage", "Reminder", "Device"].map(key => [key, globals[key]]))
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
