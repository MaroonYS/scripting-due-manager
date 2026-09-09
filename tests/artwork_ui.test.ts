// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import * as catalog from "../到期管家/src/artwork_catalog.ts"
import * as icons from "../到期管家/src/icons.ts"
import { itemIconID } from "../到期管家/src/icon_preferences.ts"
import { defaultState } from "../到期管家/src/storage.ts"

const chat = "icons8-ka3InxFU3QZa", claude = "icons8-zQjzFjPpT2Ek"
const read = (file: string) => readFileSync(new URL(`../到期管家/src/${file}`, import.meta.url), "utf8")
const h = (type: any, props: any, ...children: any[]) => ({ type: typeof type === "function" ? type.name : type, props: props ?? {}, children: children.flat(Infinity).filter(c => c != null && c !== false) })
const nodes = (node: any): any[] => [node, ...node.children.filter((c: any) => typeof c === "object").flatMap(nodes)]
const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve() }
const primitives = Object.fromEntries(["Button", "Image", "Label", "HStack", "VStack", "ZStack", "Text", "Spacer", "RoundedRectangle", "NavigationLink", "Section", "List", "TextField", "Picker", "Link", "LazyVGrid", "ArtworkImage", "ArtworkCompletionLabel", "ArtworkBrowser", "ItemIconLibraryRow"].map(name => [name, name]))
function compile(source: string, names: string[], bindings: Record<string, any>) {
  const code = source.replace(/^import .*$/gm, "").replace(/^export /gm, "")
  const compiled = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } }).transformSync(code)
  const env = { h, ...primitives, ...bindings }
  return new Function(...Object.keys(env), `${compiled}\nreturn {${names.join(",")}}`)(...Object.values(env))
}
function hooks() {
  let cursor = 0
  const slots: any[] = []
  return {
    reset: () => { cursor = 0 }, cleanup: () => { for (const slot of slots) slot?.cleanup?.() },
    useState: (initial: any) => {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial
      return [slots[index], (next: any) => { slots[index] = typeof next === "function" ? next(slots[index]) : next }]
    },
    useEffect: (effect: () => any, deps: any[]) => {
      const index = cursor++
      if (!slots[index] || deps.some((v, i) => v !== slots[index].deps[i])) {
        slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: effect() }
      }
    },
  }
}

test("native artwork keeps original pixels and puts dark-mode contrast behind, not over, the image", () => {
  const { ArtworkImage, ArtworkCompletionLabel } = compile(read("artwork_image.tsx"), ["ArtworkImage", "ArtworkCompletionLabel"], {})
  const image = { image: { native: "png" }, lightBackplate: true }
  const root = ArtworkImage({ image, widget: true })
  assert.equal(root.type, "ZStack")
  const [plate, png] = root.children
  assert.equal(plate.type, "RoundedRectangle")
  assert.deepEqual(plate.props.fill, { light: "clear", dark: "#FFFFFF" })
  assert.equal(png.props.image, image.image)
  assert.equal(png.props.renderingMode, "original")
  assert.equal(png.props.scaleToFit, true)
  assert.equal(png.props.widgetAccentedRenderingMode, "fullColor")
  assert.equal(png.props.foregroundStyle, undefined)
  assert.equal(ArtworkImage({ image: { ...image, lightBackplate: false } }).children.length, 1)
  const label = ArtworkCompletionLabel({ image, title: "完成事项：原名称", widget: true })
  assert.deepEqual(label.props.frame, { width: 40, height: 40 })
  assert.equal(label.children[0].type, "Label")
  assert.equal(label.children[0].props.title, "完成事项：原名称")
  assert.equal(label.children[1].type, "ArtworkImage")
  assert.equal(label.props.foregroundStyle, undefined)
  assert.equal(label.props.background, undefined)
})

test("image hooks reject late IDs and unmounted loads instead of flashing the previous item's icon", async () => {
  const state = hooks(), requests: { id: string; finish: (value: any) => void }[] = []
  const { useArtwork } = compile(read("artwork_image.tsx"), ["useArtwork"], {
    ...state, Script: { directory: "/bundle" }, peekArtwork: () => null,
    loadArtwork: (id: string) => new Promise(resolve => requests.push({ id, finish: resolve })),
  })
  const render = (id: string) => { state.reset(); return useArtwork(id) }
  assert.equal(render(chat), null); assert.equal(render(claude), null)
  requests[0].finish({ image: "old" }); await flush()
  assert.equal(render(claude), null)
  requests[1].finish({ image: "new" }); await flush()
  assert.deepEqual(render(claude), { image: "new" })
  render(chat); state.cleanup()
  requests[2].finish({ image: "unmounted" }); await flush()
  assert.equal(render(chat), null)
})

test("native list rows defer image reads until appearance and discard results after disappearance", async () => {
  const state = hooks(), requests: ((value: any) => void)[] = []
  const { useVisibleArtwork } = compile(read("artwork_image.tsx"), ["useVisibleArtwork"], {
    ...state, Script: { directory: "/bundle" }, peekArtwork: () => null,
    loadArtwork: () => new Promise(resolve => requests.push(resolve)),
  })
  const render = () => { state.reset(); return useVisibleArtwork(chat) }
  let row = render()
  assert.equal(requests.length, 0)
  row.onAppear(); row = render(); assert.equal(requests.length, 1)
  row.onDisappear(); render()
  requests[0]({ image: "late" }); await flush()
  row = render(); assert.equal(row.image, null)
  row.onAppear(); render(); assert.equal(requests.length, 2)
  requests[1]({ image: "visible" }); await flush()
  row = render(); assert.deepEqual(row.image, { image: "visible" })
  row.onDisappear(); render()
  assert.equal(render().image, null) // Offscreen rows do not bypass the bounded shared cache.
  state.cleanup()
})

function browserHarness(select = false) {
  const state = hooks(), events: any[] = [], requests: { ids: string[]; finish: (value: any) => void }[] = []
  const { ArtworkBrowser } = compile(read("artwork_browser.tsx"), ["ArtworkBrowser"], {
    ...state, ...catalog, Script: { directory: "/bundle" }, Navigation: { useDismiss: () => () => events.push("dismiss") },
    loadArtworkPage: (ids: string[]) => new Promise(resolve => requests.push({ ids, finish: resolve })),
  })
  return { state, events, requests, render: () => { state.reset(); return ArtworkBrowser(select ? { onSelected: (id: string) => events.push(id) } : {}) } }
}

test("color browser decodes only 24 visible icons, changes pages and resets pages on search", () => {
  const env = browserHarness()
  let root = env.render()
  assert.equal(env.requests[0].ids.length, 24)
  assert.equal(nodes(root).filter(n => n.type === "Button" && n.props.key?.startsWith("icons8-")).length, 24)
  nodes(root).find(n => n.type === "Button" && n.props.title === "下一页").props.action()
  root = env.render()
  assert.deepEqual(env.requests[1].ids, catalog.ARTWORK_CATALOG.slice(24, 48).map(i => i.id))
  nodes(root).find(n => n.type === "TextField").props.onChanged("微信")
  root = env.render()
  assert.deepEqual(env.requests[2].ids, catalog.searchArtwork("微信").map(i => i.id))
  assert.ok(!nodes(root).some(n => n.type === "Button" && n.props.title === "上一页"))
  assert.deepEqual(env.events, [])
  env.state.cleanup()
})

test("obsolete browser page loads do not replace the current page or flash stale thumbnails", async () => {
  const env = browserHarness()
  let root = env.render()
  nodes(root).find(n => n.type === "Button" && n.props.title === "下一页").props.action()
  root = env.render()
  const old = Object.fromEntries(env.requests[0].ids.map(id => [id, { image: id }]))
  env.requests[0].finish(old); await flush()
  assert.equal(nodes(env.render()).filter(n => n.type === "ArtworkImage").length, 0)
  const current = Object.fromEntries(env.requests[1].ids.map(id => [id, { image: id }]))
  env.requests[1].finish(current); await flush()
  assert.equal(nodes(env.render()).filter(n => n.type === "ArtworkImage").length, 24)
  env.state.cleanup()
})

test("preview-only browser never dismisses or saves; selection invokes exactly one callback and dismissal", () => {
  for (const select of [false, true]) {
    const env = browserHarness(select), root = env.render()
    const button = nodes(root).find(n => n.type === "Button" && n.props.key?.startsWith("icons8-"))
    button.props.action()
    assert.deepEqual(env.events, select ? [button.props.key, "dismiss"] : [])
    env.state.cleanup()
  }
})

test("color widget actions preserve exact source and occurrence; stale and read-only rows remain noninteractive", () => {
  const source = read("widget_view.tsx"), image = { image: "png", lightBackplate: false }
  const { ListCompletionIcon, ListCompletionSymbol } = compile(source.slice(source.indexOf("function ListCompletionIcon("), source.indexOf("function listItemSupportingText(")), ["ListCompletionIcon", "ListCompletionSymbol"], {
    peekArtwork: () => image, Script: { directory: "/bundle" }, CompleteDueItemIntent: (value: any) => value,
    widgetCompletionLabel: (item: any) => `Complete ${item.title}`, widgetRuntimeLocale: () => "en",
  })
  for (const source of ["manual", "reminder"]) {
    const item = { id: "unchanged-id", source, title: "Original title", completionKey: "unchanged-occurrence", canComplete: true, stale: false, artworkID: chat }
    const root = ListCompletionIcon({ item, hitSize: 40, symbolSize: 17 })
    assert.equal(root.type, "Button")
    assert.deepEqual(root.props.intent, { source, id: item.id, occurrenceKey: item.completionKey })
    assert.deepEqual(root.props.frame, { width: 40, height: 40 })
    assert.equal(root.props.foregroundStyle, undefined)
    assert.equal(root.children[0].props.title, "Complete Original title")
    assert.equal(root.children[0].props.image, image)
    for (const patch of [{ stale: true }, { canComplete: false }]) assert.equal(ListCompletionIcon({ item: { ...item, ...patch }, hitSize: 40, symbolSize: 17 }).type, "ListCompletionSymbol")
    const disabled = ListCompletionSymbol({ item, enabled: false, hitSize: 40, symbolSize: 17 })
    assert.ok(!nodes(disabled).some(n => n.type === "Button"))
    assert.equal(disabled.props.opacity, 0.6)
  }
})

function reminderEditorHarness(options: { fail?: boolean; warning?: string; refreshFail?: boolean } = {}) {
  const state = hooks(), events: any[][] = [], settings = defaultState().settings
  settings.itemIconChoices = [{ source: "reminder", itemID: "reminder-original", iconID: chat }]
  const source = read("icon_library_view.tsx")
  const { ReminderIconEditor } = compile(source.slice(source.indexOf("export function ReminderIconEditor(")), ["ReminderIconEditor"], {
    ...state, ...icons, itemIconID, Navigation: { useDismiss: () => () => events.push(["dismiss"]) },
    loadState: () => ({ settings }),
    updateItemIconChoice: (...args: any[]) => { events.push(["write", ...args]); if (options.fail) throw Error("stale or failed write"); return { settings } },
    refreshAfterDataChange: async () => { events.push(["refresh"]); if (options.refreshFail) throw Error("refresh failed"); return options.warning },
    Dialog: { alert: async (info: any) => events.push(["alert", info.title]) },
  })
  return { events, state, render: () => { state.reset(); return ReminderIconEditor({ item: { id: "reminder-original", title: "Unchanged system title", iconName: "calendar" }, onChanged: () => events.push(["changed"]) }) } }
}

test("reminder artwork selection stays local and unsaved until explicit Save", async () => {
  const env = reminderEditorHarness()
  let root = env.render()
  nodes(root).find(n => n.type === "NavigationLink").props.destination.props.onSelected(claude)
  assert.deepEqual(env.events, [])
  root = env.render()
  const save = root.props.toolbar.confirmationAction.props.action
  save(); save(); await flush()
  assert.deepEqual(env.events[0], ["write", "reminder", "reminder-original", { iconID: claude, expectedIconID: chat }])
  assert.equal(env.events.filter(e => e[0] === "write").length, 1)
  assert.equal(env.events.filter(e => e[0] === "dismiss").length, 1)
})

test("reminder icon write failures stay open without refresh; post-save refresh errors report saved status", async () => {
  for (const options of [{ fail: true }, { refreshFail: true }, { warning: "notification pending" }]) {
    const env = reminderEditorHarness(options)
    let root = env.render()
    nodes(root).find(n => n.type === "NavigationLink").props.destination.props.onSelected(claude)
    root = env.render(); root.props.toolbar.confirmationAction.props.action(); await flush()
    if (options.fail) {
      assert.ok(!env.events.some(e => e[0] === "dismiss" || e[0] === "refresh"))
      assert.deepEqual(env.events.at(-1), ["alert", "保存图标失败"])
    } else {
      assert.deepEqual(env.events.at(-1), ["dismiss"])
      assert.match(env.events.find(e => e[0] === "alert")![1], /^图标已保存/)
    }
  }
})

test("reminder editors may stage a native symbol or clear only their local override", async () => {
  for (const automatic of [false, true]) {
    const env = reminderEditorHarness()
    let root = env.render()
    const button = automatic ? nodes(root).find(n => n.type === "Button" && n.props.title === "自动匹配系统图标")
      : nodes(root).find(n => n.type === "Button" && n.props.key === "car.fill")
    button.props.action(); assert.deepEqual(env.events, [])
    root = env.render(); root.props.toolbar.confirmationAction.props.action(); await flush()
    assert.equal(env.events[0][3].iconID, automatic ? null : "sf:car.fill")
    assert.equal(env.events[0][3].expectedIconID, chat)
  }
})
