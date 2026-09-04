import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

// Execute the actual startup function with a headless navigation adapter. This
// verifies routing/order, not Scripting's native rendering or button gestures.
const app = readFileSync(new URL("../到期管家/index.tsx", import.meta.url), "utf8")
const startup = app.slice(app.indexOf("async function run()"), app.indexOf("\nrun().catch"))
const compiled = new Bun.Transpiler({ loader: "tsx", tsconfig: {
  compilerOptions: { jsx: "react", jsxFactory: "h" },
} }).transformSync(startup)

type Element = { type: string; props: Record<string, any>; children: Element[] }

async function exercise(status: string, recover = false, action = "", id = "") {
  const events: string[] = []
  let readable = status === "ready" || status === "missing"
  const find = (node: Element, name: string): Element | undefined => node.type === name
    ? node : node.children.flatMap(child => child ? [find(child, name)] : []).find(Boolean)
  const bindings = {
    h: (type: string, props: Record<string, any> | null, ...children: Element[]) => ({ type, props: props ?? {}, children }),
    readRecoveryStatus: () => { events.push("preflight"); return { status } },
    loadState: () => { events.push("read-state"); if (!readable) throw new Error("damaged state"); return { items: [] } },
    reconcileNotifications: async (_: unknown[], options: { loadItems: () => unknown[] }) => {
      events.push("notifications"); options.loadItems()
    },
    Script: { queryParameters: { action, id }, exit: () => events.push("exit") },
    findItem: (key: string) => { events.push(`find:${key}`); if (!readable) throw new Error("damaged state"); return { id: key } },
    Navigation: { present: async ({ element }: { element: Element }) => {
      const recovery = find(element, "StartupRecoveryView")
      if (recovery) {
        events.push("recovery-screen")
        if (recover) { readable = true; recovery.props.onRecovered() }
      } else if (find(element, "WidgetActionStatusView")) events.push("action-status-screen")
      else if (find(element, "ItemEditor")) events.push("editor-screen")
      else events.push("main-screen")
    } },
    NavigationStack: "NavigationStack", StartupRecoveryView: "StartupRecoveryView",
    WidgetActionStatusView: "WidgetActionStatusView", ItemEditor: "ItemEditor", DueManagerApp: "DueManagerApp",
  }
  const run = new Function(...Object.keys(bindings), `${compiled}\nreturn run`)(...Object.values(bindings))
  await run()
  return events
}

test("damaged data reaches recovery without mounting the normal app or scheduling notifications", async () => {
  assert.deepEqual(await exercise("damaged", false, "edit", "test-item"), ["preflight", "recovery-screen", "exit"])
})

test("unsupported data can be inspected and closed without loading or overwriting it", async () => {
  assert.deepEqual(await exercise("unsupported"), ["preflight", "recovery-screen", "exit"])
})

test("successful startup recovery resumes the app and only then reads repaired state", async () => {
  assert.deepEqual(await exercise("damaged", true), ["preflight", "recovery-screen", "notifications", "read-state", "main-screen", "exit"])
})

test("widget warning deep links open the status screen rather than an item completion action", async () => {
  assert.deepEqual(await exercise("ready", false, "widget-status"), ["preflight", "notifications", "read-state", "action-status-screen", "exit"])
})

test("existing item deep links and first-install navigation still work", async () => {
  assert.deepEqual(await exercise("ready", false, "edit", "test-item"), ["preflight", "notifications", "read-state", "find:test-item", "editor-screen", "exit"])
  assert.ok((await exercise("missing")).includes("main-screen"))
})
