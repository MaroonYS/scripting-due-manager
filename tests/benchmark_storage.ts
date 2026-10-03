// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

// Run from the repository root: bun tests/benchmark_storage.ts
// Synthetic host measurements only; no native iPhone / Scripting timing claim.
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"

const reference = "c63d393567ca8c88c800da55880fc2224899e0eb"
const sourceRoot = fileURLToPath(new URL("../到期管家/src/", import.meta.url))
const original = execFileSync("git", ["show", `${reference}:到期管家/src/storage.ts`], { encoding: "utf8" })
const dependencies = Object.assign({}, ...await Promise.all([
  "date", "icons", "legacy_icon_preferences", "icon_preferences", "item_kinds", "item_ids", "notifications",
].map(name => import(`${sourceRoot}${name}.ts`))))
const stripped = original
  .replace(/^import[\s\S]*? from "[^\"]+"\r?\n/gm, "")
  .replace(/^export \{[^\n]+\} from "[^\"]+"\r?\n/gm, "")
  .replace(/^export /gm, "")
const before = new Function(...Object.keys(dependencies),
  new Bun.Transpiler({ loader: "ts" }).transformSync(stripped)
    + "\nreturn {normalizeState, defaultState, updateSettings, STATE_KEY, LOCAL_SNAPSHOTS_KEY}",
)(...Object.values(dependencies))
const after = await import(`${sourceRoot}storage.ts`)
console.log(JSON.stringify({
  reference, baselineSourceSHA256: createHash("sha256").update(original).digest("hex"),
  bun: Bun.version, warmups: 5, samples: 9, clock: "performance.now", measure: "batch median per call",
}))

const median = (samples: number[]) => samples.sort((left, right) => left - right)[Math.floor(samples.length / 2)]
const makeItem = (id: string, note = "Private") => ({
  id, title: "Keep", kind: "custom", iconName: null,
  dueDate: "2026-10-03", includesTime: false, hour: 9, minute: 0,
  remindBeforeDays: 0, recurrence: null, amount: "", note, enabled: true, createdAt: 1, updatedAt: 2,
})
const duplicateNormalization = []
for (const count of [500, 1000, 2000, 4000]) {
  const raw = { ...before.defaultState(2), items: Array.from({ length: count }, () => makeItem("same-legacy-id")) }
  assert.deepEqual(after.normalizeState(raw), before.normalizeState(raw))
  const record: any = { count, batch: 3 }
  for (const [name, module] of [["before", before], ["after", after]] as const) {
    for (let warmup = 0; warmup < 5; warmup++) module.normalizeState(raw)
    const samples = []
    for (let sample = 0; sample < 9; sample++) {
      const start = performance.now()
      for (let repeat = 0; repeat < 3; repeat++) module.normalizeState(raw)
      samples.push((performance.now() - start) / 3)
    }
    record[`${name}Ms`] = median(samples)
  }
  duplicateNormalization.push(record)
}
console.log(JSON.stringify({ duplicateNormalization }))

const originalStorage = (globalThis as any).Storage
try {
  for (const count of [100, 2000]) {
    const state = before.normalizeState({
      ...before.defaultState(2), items: Array.from({ length: count }, (_, index) => makeItem(`unique-${index}`, "Private ".repeat(100))),
    })
    const seeded = new Map([
      [before.STATE_KEY, state],
      [before.LOCAL_SNAPSHOTS_KEY, {
        schemaVersion: 1,
        snapshots: Array.from({ length: 10 }, (_, index) => ({ id: `s${index}`, createdAt: 2, reason: "Existing", state })),
      }],
    ])
    let values: Map<string, any>
    ;(globalThis as any).Storage = {
      get: (key: string, options: any) => options?.shared ? structuredClone(values.get(key) ?? null) : null,
      set: (key: string, value: any) => { values.set(key, structuredClone(value)); return true },
      remove: (key: string) => values.delete(key),
    }
    const record: any = { count, snapshots: 10, noteChars: 800, batch: 5, storageStub: "structuredClone per native read/write" }
    for (const [name, module] of [["before", before], ["after", after]] as const) {
      for (let warmup = 0; warmup < 5; warmup++) {
        values = new Map(seeded)
        module.updateSettings({ showAmounts: false })
      }
      const samples = []
      for (let sample = 0; sample < 9; sample++) {
        const start = performance.now()
        for (let repeat = 0; repeat < 5; repeat++) {
          values = new Map(seeded)
          module.updateSettings({ showAmounts: false })
        }
        samples.push((performance.now() - start) / 5)
      }
      record[`${name}Ms`] = median(samples)
    }
    console.log(JSON.stringify({ guardedSettingsWrite: record }))
  }
} finally { (globalThis as any).Storage = originalStorage }
