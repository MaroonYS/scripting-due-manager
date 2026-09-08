// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

type Node = { type: string; props: Record<string, any>; children: any[] }
const h = (type: any, props: any, ...children: any[]): Node => ({
  type: typeof type === "function" ? type.name : type, props: props ?? {},
  children: children.flat(Infinity).filter(child => child != null),
})
const transpile = (source: string) => new Bun.Transpiler({ loader: "tsx", tsconfig: {
  compilerOptions: { jsx: "react", jsxFactory: "h" },
} }).transformSync(source)
const source = readFileSync(new URL("../到期管家/index.tsx", import.meta.url), "utf8")
const appSource = readFileSync(new URL("../到期管家/src/app.tsx", import.meta.url), "utf8")
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const nodes = (node: Node): Node[] => [node, ...node.children.filter(child => typeof child === "object").flatMap(nodes)]
const text = (node: Node): string => [node.props.title ?? "", ...node.children.map(child => typeof child === "object" ? text(child) : String(child))].join(" ")

function bootstrap(load?: () => Promise<any>, nativeFailure = false) {
  const events: any[] = [], timers = new Map<number, { at: number; fn: () => void }>()
  const state = new Map<string, any[]>(), effects: (() => void)[] = []
  let slots: any[] = [], cursor = 0, clock = 0, timerID = 0
  const module = {
    createApplication: () => { events.push("preflight"); return { element: h("DueManagerApp", {}), canMaintain: true } },
    startApplicationMaintenance: () => { events.push("maintenance") },
  }
  const bindings = {
    h, Button: "Button", List: "List", NavigationStack: "NavigationStack", Section: "Section", Text: "Text",
    Script: { metadata: { version: "test" }, exit: () => events.push("exit") },
    Navigation: {
      useDismiss: () => () => events.push("dismiss"),
      present: async ({ element }: any) => { events.push(["present", element.type]); if (nativeFailure) throw Error("native failed") },
    },
    Dialog: { alert: async (value: any) => events.push(["alert", value.title]) },
    loadApplication: async () => { events.push("import"); return load ? load() : module },
    setTimeout: (fn: () => void, delay: number) => { const id = ++timerID; timers.set(id, { at: clock + delay, fn }); return id },
    clearTimeout: (id: number) => timers.delete(id),
    useState: (initial: any) => {
      const cells = slots, index = cursor++
      if (!cells[index]) cells[index] = { kind: "state", value: typeof initial === "function" ? initial() : initial }
      return [cells[index].value, (value: any) => { cells[index].value = typeof value === "function" ? value(cells[index].value) : value }]
    },
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
      const cells = slots, index = cursor++, previous = cells[index]
      if (previous && deps.every((dep, i) => dep === previous.deps[i])) return
      previous?.cleanup?.()
      const entry = { kind: "effect", deps, cleanup: undefined as any }
      cells[index] = entry
      effects.push(() => { entry.cleanup = effect() })
    },
  }
  const compiled = transpile(source.replace(/^import .*\n/gm, "")
    .replace('import("./src/app")', "loadApplication()").replace(/^void run\(\)\s*$/m, ""))
  const components = new Function(...Object.keys(bindings), compiled + "\nreturn {StartupScreen,ApplicationSurface,run}")( ...Object.values(bindings))
  return {
    events, timers, module,
    render(name = "StartupScreen", props?: any) {
      slots = state.get(name) ?? []; state.set(name, slots); cursor = 0
      return components[name](props) as Node
    },
    effects() { while (effects.length) effects.shift()!() },
    tick(milliseconds: number) {
      clock += milliseconds
      for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
        if (timer.at <= clock && timers.delete(id)) timer.fn()
      }
    },
    unmount() { for (const cells of state.values()) for (const entry of cells) if (entry?.kind === "effect") entry.cleanup?.() },
    run: () => components.run(),
  }
}

test("the real entry is small, has only native static imports, and contains no executable image library", () => {
  assert.ok(Buffer.byteLength(source) < 8000)
  const imports = new Bun.Transpiler({ loader: "tsx" }).scanImports(source)
  assert.deepEqual(imports.filter(entry => entry.kind === "import-statement").map(entry => entry.path), ["scripting"])
  assert.ok(imports.some(entry => entry.kind === "dynamic-import" && entry.path === "./src/app"))
  assert.doesNotMatch(source, /loadState|UIImage|brand_assets|brand_asset_data|reconcileNotifications/)
  assert.equal(existsSync(new URL("../到期管家/src/brand_asset_data.ts", import.meta.url)), false)
  const root = fileURLToPath(new URL("../到期管家", import.meta.url))
  const sources = (path: string): string[] => readdirSync(path, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? sources(join(path, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(path, entry.name)] : [])
  assert.ok(sources(root).reduce((sum, path) => sum + statSync(path).size, 0) < 1_500_000)
})

test("the first native startup screen renders before importing app code or inspecting data", async () => {
  const env = bootstrap()
  try {
    const first = env.render()
    assert.equal(first.type, "NavigationStack")
    assert.ok(text(first).includes("准备加载界面"))
    assert.deepEqual(env.events, [])
    env.effects()
    assert.deepEqual(env.events, [])
    env.tick(50); await flush()
    assert.deepEqual(env.events, ["import"])
    assert.ok(text(env.render()).includes("检查本机数据"))
    env.tick(50); await flush()
    const ready = env.render()
    assert.equal(ready.type, "ApplicationSurface")
    assert.deepEqual(env.events, ["import", "preflight"])
    env.render("ApplicationSurface", ready.props); env.effects()
    assert.deepEqual(env.events, ["import", "preflight", "maintenance"])
    assert.equal(env.timers.size, 0)
  } finally { env.unmount() }
})

test("a stalled module import becomes a visible error; a late result never reads or rewrites state", async () => {
  let release!: (value: any) => void
  const env = bootstrap(() => new Promise(resolve => { release = resolve }))
  try {
    env.render(); env.effects(); env.tick(50); await flush()
    env.tick(10000)
    assert.ok(text(env.render()).includes("启动超过 10 秒"))
    assert.ok(text(env.render()).includes("加载主界面代码"))
    release(env.module); await flush(); env.tick(50); await flush()
    assert.deepEqual(env.events, ["import"])
    assert.equal(env.render().type, "NavigationStack")
  } finally { env.unmount() }
})

test("import and preflight failures remain on the startup page and retry without resetting data", async () => {
  for (const failPreflight of [false, true]) {
    let count = 0
    const env = bootstrap(async () => {
      if (++count === 1) {
        if (!failPreflight) throw Error("module failed")
        return { ...env.module, createApplication: () => { throw Error("storage failed") } }
      }
      return env.module
    })
    try {
      env.render(); env.effects(); env.tick(50); await flush(); env.tick(50); await flush()
      let view = env.render()
      assert.ok(text(view).includes(failPreflight ? "storage failed" : "module failed"))
      nodes(view).find(node => node.type === "Button" && node.props.title === "重试启动")!.props.action()
      env.render(); env.effects(); env.tick(50); await flush(); env.tick(50); await flush()
      assert.equal(env.render().type, "ApplicationSurface")
      assert.equal(env.events.filter(event => event === "preflight").length, 1)
    } finally { env.unmount() }
  }
})

test("closing while app code is pending invalidates late callbacks and always exits the host run", async () => {
  let release!: (value: any) => void
  const env = bootstrap(() => new Promise(resolve => { release = resolve }))
  env.render(); env.effects(); env.tick(50); await flush()
  env.unmount(); release(env.module); await flush(); env.tick(10000)
  assert.deepEqual(env.events, ["import"])
  assert.equal(env.timers.size, 0)
  await env.run()
  assert.deepEqual(env.events.slice(-2), [["present", "StartupScreen"], "exit"])
  const failed = bootstrap(undefined, true)
  await failed.run()
  assert.deepEqual(failed.events, [["present", "StartupScreen"], ["alert", "启动界面未能打开"], "exit"])
})

function routing(status: string, action = "", id = "") {
  const events: string[] = []
  let readable = status === "ready" || status === "missing"
  const bindings = {
    h, readRecoveryStatus: () => { events.push("preflight"); return { status: readable ? "ready" : status } },
    Script: { queryParameters: { action, id } },
    findItem: (value: string) => { events.push("find:" + value); if (!readable) throw Error("damaged state"); return { id: value } },
    NavigationStack: "NavigationStack", RecoveryView: "RecoveryView", WidgetActionStatusView: "WidgetActionStatusView",
    ItemEditor: "ItemEditor", DueManagerApp: "DueManagerApp",
    reconcileNotifications: async () => { events.push("maintenance") }, loadState: () => { throw Error("must stay deferred") },
    console: { error: () => {} },
  }
  const compiled = transpile(appSource.slice(appSource.indexOf("export function createApplication(")).replace(/^export /gm, ""))
  const app = new Function(...Object.keys(bindings), compiled + "\nreturn {createApplication,startApplicationMaintenance}")(...Object.values(bindings))
  return { events, app, create: () => app.createApplication(() => { readable = true; events.push("restart") }) }
}

test("damaged and future data still route only to recovery without starting maintenance or item lookup", () => {
  for (const status of ["damaged", "unsupported"]) {
    const env = routing(status, "edit", "test-item"), route = env.create()
    assert.equal(route.canMaintain, false)
    assert.equal(route.element.children[0].type, "RecoveryView")
    assert.deepEqual(env.events, ["preflight"])
  }
})

test("successful recovery restarts preparation before showing the main app", () => {
  const env = routing("damaged"), route = env.create()
  route.element.children[0].props.onChanged()
  const restored = env.create()
  assert.equal(restored.canMaintain, true)
  assert.equal(restored.element.type, "DueManagerApp")
  assert.deepEqual(env.events, ["preflight", "restart", "preflight"])
})

test("existing item and widget-warning deep links keep the same standalone destinations", () => {
  for (const [action, id, target] of [["edit", "same-item", "ItemEditor"], ["widget-status", "", "WidgetActionStatusView"]]) {
    const env = routing("ready", action, id), route = env.create()
    assert.equal(route.element.children[0].type, target)
    assert.equal(route.element.children[0].props.standalone, true)
    if (id) assert.equal(route.element.children[0].props.item.id, id)
    assert.ok(!env.events.includes("maintenance"))
  }
  assert.equal(routing("missing").create().element.type, "DueManagerApp")
})
