// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { brandAsset, inspectBrandLogo, brandFallbackPath } from "../到期管家/src/brand_assets.ts"
import { ReadDeadlineError, withReadDeadline } from "../到期管家/src/async_deadline.ts"
import { BRAND_CATALOG } from "../到期管家/src/brand_catalog.ts"
import { defaultState } from "../到期管家/src/storage.ts"
import { resolveItemBrand, withItemBrandChoice } from "../到期管家/src/brand_preferences.ts"

const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
const cmb = brandAsset(BRAND_CATALOG.find(brand => brand.name === "招商银行／掌上生活")!.id)!
const telegram = brandAsset(BRAND_CATALOG.find(brand => brand.name === "Telegram")!.id)!
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const ready = (name: string) => ({ status: "ready", logo: { image: { light: name, dark: name }, size: 24 } })

test("optional-read deadlines handle success, throws, never-resolving reads and late rejection", async () => {
  assert.equal(await withReadDeadline(async () => 42, 100), 42)
  await assert.rejects(withReadDeadline(() => { throw Error("read failed") }, 100), /read failed/)
  const late = deferred<number>()
  await assert.rejects(withReadDeadline(() => late.promise, 5), ReadDeadlineError)
  late.reject(Error("too late")); await flush()
})

test("stalled PNG or fallback reads time out and never replace the returned system-icon result", async () => {
  const previousFiles = (globalThis as any).FileManager, previousImage = (globalThis as any).UIImage
  try {
    for (const fallback of [false, true]) {
      const late = deferred<any>(), reads: string[] = []
      ;(globalThis as any).FileManager = {
        readAsData: async (path: string) => { reads.push(path); return fallback ? null : late.promise },
        readAsString: (path: string) => { reads.push(path); return late.promise },
      }
      ;(globalThis as any).UIImage = { fromData: (value: unknown) => value, fromBase64String: (value: string) => value }
      const result = await inspectBrandLogo(cmb, "/bundle", 5)
      assert.deepEqual(result, { status: "timed-out", logo: null })
      assert.deepEqual(reads, fallback ? [`/bundle/${cmb.light}`, `/bundle/${brandFallbackPath(cmb.light)}`] : [`/bundle/${cmb.light}`])
      late.resolve(fallback ? JSON.stringify({ source: cmb.light, encoding: "base64", png: "late" }) : "late")
      await flush()
      assert.deepEqual(result, { status: "timed-out", logo: null })
    }
  } finally { (globalThis as any).FileManager = previousFiles; (globalThis as any).UIImage = previousImage }
})

test("malformed, oversized, cross-file or traversal artwork fails closed without library-wide reads", async () => {
  const previousFiles = (globalThis as any).FileManager, previousImage = (globalThis as any).UIImage
  try {
    let reads = 0, decodes = 0
    ;(globalThis as any).UIImage = { fromBase64String: () => { decodes++; return {} } }
    for (const invalid of ["{", "[]", "x".repeat(1024 * 1024 + 1), JSON.stringify({ source: telegram.light, encoding: "base64", png: "wrong" })]) {
      ;(globalThis as any).FileManager = { readAsString: async () => { reads++; return invalid } }
      assert.deepEqual(await inspectBrandLogo(cmb, "/bundle"), { status: "decode-failed", logo: null })
    }
    assert.equal(reads, 4); assert.equal(decodes, 0)
    assert.equal((await inspectBrandLogo({ ...cmb, light: "../private.png" }, "/bundle")).status, "decode-failed")
    assert.equal(reads, 4)
  } finally { (globalThis as any).FileManager = previousFiles; (globalThis as any).UIImage = previousImage }
})

function hooks() {
  const reads: { id: string; pending: ReturnType<typeof deferred<any>> }[] = []
  let slots: any[] = [], cursor = 0
  const instances = new Map<string, any[]>()
  const bindings = {
    useState: (initial: any) => { const cells = slots, index = cursor++
      if (!cells[index]) cells[index] = { value: typeof initial === "function" ? initial() : initial }
      return [cells[index].value, (value: any) => { cells[index].value = value }]
    },
    useEffect: (effect: () => () => void, deps: any[]) => {
      const index = cursor++
      if (slots[index] && deps.every((value, i) => value === slots[index].deps[i])) return
      slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: effect() }
    },
    inspectBrandLogo: (asset: any) => { const pending = deferred<any>(); reads.push({ id: asset.brandID, pending }); return pending.promise },
  }
  const code = readFileSync(new URL("../到期管家/src/brand_loading.ts", import.meta.url), "utf8")
    .replace(/^import .* from .*\n/gm, "").replace(/^export /gm, "")
  const hook = new Function(...Object.keys(bindings), new Bun.Transpiler({ loader: "ts" }).transformSync(code) + "\nreturn useBrandLogo")(...Object.values(bindings))
  return { reads,
    render(id: string, asset: any = cmb) { slots = instances.get(id) ?? []; instances.set(id, slots); cursor = 0; return hook(asset, "/bundle") },
    unmount(id: string) { for (const slot of instances.get(id) ?? []) slot.cleanup?.() },
  }
}

test("only visible logos load, repeated appearances deduplicate, and invisible or unmounted results are ignored", async () => {
  const env = hooks()
  const a = env.render("a"), b = env.render("b"), absent = env.render("absent", null)
  assert.equal(a.inspection.status, "loading"); assert.equal(absent.inspection.status, "not-bundled")
  absent.onAppear(); assert.equal(env.reads.length, 0)
  a.onAppear(); a.onAppear(); b.onAppear()
  assert.equal(env.reads.length, 1)
  a.onDisappear(); env.unmount("b")
  env.reads[0].pending.resolve(ready("cmb")); await flush()
  assert.equal(env.render("a").inspection.logo, null)
  assert.equal(env.render("b").inspection.logo, null)
  env.render("a").onAppear(); assert.equal(env.reads.length, 2)
  env.reads[1].pending.resolve(ready("cmb")); await flush()
  assert.equal(env.render("a").inspection.logo.image.light, "cmb")
})

test("changing a visible row's brand cannot apply an old asynchronous result", async () => {
  const env = hooks()
  env.render("a").onAppear()
  assert.equal(env.render("a", telegram).inspection.logo, null)
  assert.deepEqual(env.reads.map(read => read.id), [cmb.brandID, telegram.brandID])
  env.reads[1].pending.resolve(ready("telegram")); await flush()
  env.reads[0].pending.resolve(ready("cmb")); await flush()
  assert.equal(env.render("a", telegram).inspection.logo.image.light, "telegram")
})

test("switching a visible item to system ignores a pending brand image without starting another read", async () => {
  const env = hooks()
  env.render("a").onAppear()
  const system = env.render("a", null)
  assert.equal(system.inspection.status, "not-bundled")
  system.onAppear()
  env.reads[0].pending.resolve(ready("cmb")); await flush()
  assert.equal(env.render("a", null).inspection.logo, null)
  assert.equal(env.reads.length, 1)
})

test("widget entry reads only the small-widget selected logo and still presents on image timeout", async () => {
  const source = readFileSync(new URL("../到期管家/widget.tsx", import.meta.url), "utf8")
  const code = source.slice(source.indexOf("async function main()"), source.indexOf("main().catch"))
  for (const family of ["systemSmall", "systemMedium", "systemLarge", "accessoryCircular"]) {
    for (const style of ["system", "brand"] as const) for (const choice of [null, "system", cmb.brandID]) {
      const events: any[] = [], state = defaultState(1)
      state.settings.smallWidgetIconStyle = style
      const item = { source: "manual", id: "exact-id", title: "招商银行", kind: "credit-card", canComplete: true, stale: false, iconName: "creditcard" }
      state.settings.itemBrandChoices = withItemBrandChoice(state.settings, { source: "manual", id: item.id }, choice)
      const bindings = {
        h: (type: any, props: any) => ({ type, props }), DueManagerWidget: "DueManagerWidget",
        Widget: { family, present: (view: any) => events.push(["present", view]) },
        Script: { directory: "/bundle", exit: () => events.push(["exit"]) },
        loadWidgetData: async () => ({ state, reminderResult: {}, items: [item] }),
        readWidgetCompletionTransition: () => ({ generation: 7 }), nextWidgetRefresh: () => new Date(),
        brandAsset, resolveItemBrand, readWidgetActionError: () => null,
        loadBrandLogo: async (asset: any) => { events.push(["image", asset.brandID]); return null },
        reconcileNotifications: async () => events.push(["maintenance"]), loadState: () => state,
      }
      const js = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } }).transformSync(code)
      await new Function(...Object.keys(bindings), js + "\nreturn main()")(...Object.values(bindings))
      const expected = family === "systemSmall" && choice === cmb.brandID
      assert.equal(events.filter(event => event[0] === "image").length, expected ? 1 : 0)
      const rendered = events.find(event => event[0] === "present")[1]
      assert.equal(rendered.props.brandLogo, null)
      assert.equal(rendered.props.items[0], item)
      assert.deepEqual(events.slice(-2).map(event => event[0]), ["maintenance", "exit"])
    }
  }
})
