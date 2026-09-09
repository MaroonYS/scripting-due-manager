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
import { artworkFrame } from "../到期管家/src/artwork_adaptation.ts"
import { recommendIconQueries } from "../到期管家/src/icon_recommendations.ts"
import { onlineArtworkLabel } from "../到期管家/src/online_artwork_ids.ts"
import { ICONS8_STYLES } from "../到期管家/src/online_artwork.ts"
import { DEFAULT_ICON_SUBSCRIPTIONS, iconSubscriptions, MAX_ICON_SUBSCRIPTIONS, normalizeIconSubscriptions } from "../到期管家/src/icon_subscriptions.ts"
import { githubArtworkID } from "../到期管家/src/github_artwork_ids.ts"

const chat = "icons8-ka3InxFU3QZa", claude = "icons8-zQjzFjPpT2Ek"
const read = (file: string) => readFileSync(new URL(`../到期管家/src/${file}`, import.meta.url), "utf8")
const h = (type: any, props: any, ...children: any[]) => ({ type: typeof type === "function" ? type.name : type, props: props ?? {}, children: children.flat(Infinity).filter(c => c != null && c !== false) })
const nodes = (node: any): any[] => [node, ...node.children.filter((c: any) => typeof c === "object").flatMap(nodes)]
const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve() }
const primitives = Object.fromEntries(["Button", "Image", "SVG", "SecureField", "Label", "HStack", "VStack", "ZStack", "Text", "Spacer", "RoundedRectangle", "NavigationLink", "Section", "List", "TextField", "Picker", "Link", "LazyVGrid", "ArtworkImage", "ArtworkCompletionLabel", "ArtworkBrowser", "ItemIconLibraryRow", "IconSubscriptionsView", "Toggle"].map(name => [name, name]))
function compile(source: string, names: string[], bindings: Record<string, any>) {
  const code = source.replace(/^import .*$/gm, "").replace(/^export /gm, "")
  const compiled = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } }).transformSync(code)
  const env = { h, ...primitives, artworkFrame, recommendIconQueries, onlineArtworkLabel, ICONS8_STYLES,
    DEFAULT_ICON_SUBSCRIPTIONS, iconSubscriptions, MAX_ICON_SUBSCRIPTIONS, normalizeIconSubscriptions,
    Icons8MCPAccountView: "Icons8MCPAccountView", hasIcons8MCPSession: () => false, ...bindings }
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

function browserHarness(select = false, itemTitle = "", startProvider?: "icons8mcp") {
  const state = hooks(), events: any[] = [], requests: { ids: string[]; finish: (value: any) => void }[] = []
  const searches: { provider: string; query: string; page: number; style: string; finish: (value: any) => void; fail: (error: Error) => void }[] = []
  let key: string | null = null
  const { ArtworkBrowser } = compile(read("artwork_browser.tsx"), ["ArtworkBrowser"], {
    ...state, ...catalog, loadState: () => defaultState(), Script: { directory: "/bundle" }, Navigation: { useDismiss: () => () => events.push("dismiss") },
    loadArtworkPage: (ids: string[]) => new Promise(resolve => requests.push({ ids, finish: resolve })),
    searchOnlineArtwork: (provider: string, query: string, page: number, style: string) => new Promise((finish, fail) => searches.push({ provider, query, page, style, finish, fail })),
    searchGithubArtwork: (query: string, page: number) => new Promise((finish, fail) => searches.push({ provider: "github", query, page, style: "全部风格", finish, fail })),
    searchIcons8MCP: (query: string, page: number) => new Promise((finish, fail) => searches.push({ provider: "icons8mcp", query, page, style: "fluency", finish, fail })),
    readIcons8Key: () => key, iconKeychainAvailable: () => true,
    saveIcons8Key: (value: string) => { events.push("saveKey"); key = value }, removeIcons8Key: () => { events.push("removeKey"); key = null },
  })
  const render = () => { state.reset(); return ArtworkBrowser({ itemTitle, itemKind: "subscription", startProvider, ...(select ? { onSelected: (id: string) => events.push(id) } : {}) }) }
  return { state, events, requests, searches, render,
    show: () => { render().props.onAppear(); return render() },
    submit: (query: string) => {
      nodes(render()).find(n => n.type === "TextField").props.onChanged(query)
      nodes(render()).find(n => n.type === "Button" && n.props.title === "在线搜索").props.action()
      return render()
    },
  }
}

const onlineIDs = (offset = 0) => Array.from({ length: 24 }, (_, i) => githubArtworkID(`https://raw.githubusercontent.com/example/icons/main/icon-${i + offset}.png`)!)
test("dedicated MCP entry searches Earth Smiley on appearance and a loaded selection returns a persistable ID", async () => {
  const env = browserHarness(true, "", "icons8mcp"), id = "icons8-mcp:9GC5rqCM5uDh"
  assert.equal(env.searches.length, 0)
  env.show()
  assert.equal(env.searches[0].provider, "icons8mcp")
  assert.equal(env.searches[0].query, "earth smiley")
  assert.equal(env.searches[0].style, "fluency")
  assert.ok(nodes(env.render()).some(n => n.type === "NavigationLink" && n.props.destination?.type === "Icons8MCPAccountView"))
  env.searches[0].finish({ icons: [{ id, label: "Earth Smiley", detail: "Windows 11 Color" }], page: 0, hasMore: false })
  await flush(); env.render()
  const unloaded = nodes(env.render()).find(n => n.type === "Button" && n.props.key === id)
  assert.equal(unloaded.props.disabled, true)
  env.requests[0].finish({ [id]: { image: "png" } }); await flush()
  nodes(env.render()).find(n => n.type === "Button" && n.props.key === id).props.action()
  assert.deepEqual(env.events, [id, "dismiss"])
  env.state.cleanup()
})
function finishSearch(env: ReturnType<typeof browserHarness>, index: number, offset = 0) {
  const ids = onlineIDs(offset)
  env.searches[index].finish({ icons: ids.map(id => ({ id, label: id, detail: "Fluent" })), hasMore: true, page: env.searches[index].page })
}

test("online browser sends no request until visible and searching, decodes one page and resets on new terms", async () => {
  const env = browserHarness()
  env.show()
  assert.equal(env.searches.length, 0); assert.equal(env.requests.length, 0)
  env.submit("clock")
  assert.equal(env.searches[0].provider, "github"); assert.equal(env.searches[0].query, "clock")
  finishSearch(env, 0); await flush()
  let root = env.render()
  assert.equal(env.requests[0].ids.length, 24)
  assert.equal(nodes(root).filter(n => n.type === "Button" && n.props.key?.startsWith("github-artwork:")).length, 24)
  nodes(root).find(n => n.type === "Button" && n.props.title === "下一页").props.action()
  root = env.render()
  assert.equal(env.searches[1].page, 1)
  finishSearch(env, 1, 24); await flush(); env.render()
  assert.deepEqual(env.requests[1].ids, onlineIDs(24))
  nodes(root).find(n => n.type === "TextField").props.onChanged("book")
  root = env.render()
  assert.equal(env.searches.length, 2) // Typing alone does not send requests.
  env.submit("book"); assert.equal(env.searches[2].page, 0)
  assert.ok(!nodes(root).some(n => n.type === "Button" && n.props.title === "上一页"))
  assert.deepEqual(env.events, [])
  env.state.cleanup()
})

test("obsolete browser page loads do not replace the current page or flash stale thumbnails", async () => {
  const env = browserHarness()
  env.show(); env.submit("clock"); finishSearch(env, 0); await flush()
  let root = env.render()
  nodes(root).find(n => n.type === "Button" && n.props.title === "下一页").props.action()
  root = env.render()
  finishSearch(env, 1, 24); await flush(); root = env.render()
  const old = Object.fromEntries(env.requests[0].ids.map(id => [id, { image: id }]))
  env.requests[0].finish(old); await flush()
  assert.equal(nodes(env.render()).filter(n => n.type === "ArtworkImage").length, 0)
  const current = Object.fromEntries(env.requests[1].ids.map(id => [id, { image: id }]))
  env.requests[1].finish(current); await flush()
  assert.equal(nodes(env.render()).filter(n => n.type === "ArtworkImage").length, 24)
  env.state.cleanup()
})

test("preview-only browser never saves; item selection requires a loaded preview and then dismisses once", async () => {
  for (const select of [false, true]) {
    const env = browserHarness(select)
    env.show(); env.submit("clock"); finishSearch(env, 0); await flush()
    let root = env.render()
    let button = nodes(root).find(n => n.type === "Button" && n.props.key?.startsWith("github-artwork:"))
    if (select) { assert.equal(button.props.disabled, true); button.props.action(); assert.deepEqual(env.events, []) }
    env.requests[0].finish(Object.fromEntries(env.requests[0].ids.map(id => [id, { svg: "svg" }]))); await flush()
    root = env.render()
    button = nodes(root).find(n => n.type === "Button" && n.props.key?.startsWith("github-artwork:"))
    button.props.action()
    if (select) button.props.action() // Native double-taps must not dismiss two levels.
    assert.deepEqual(env.events, select ? [button.props.key, "dismiss"] : [])
    env.state.cleanup()
  }
})

test("obsolete searches cannot replace results after terms, provider changes or dismissal", async () => {
  const env = browserHarness()
  env.show(); env.submit("clock"); env.submit("book")
  finishSearch(env, 1, 40); await flush(); env.render()
  finishSearch(env, 0); await flush()
  assert.deepEqual(env.requests[0].ids, onlineIDs(40))
  let root = env.render()
  nodes(root).find(n => n.type === "Picker" && n.props.title === "在线图库").props.onChanged("icons8")
  env.render(); assert.equal(env.searches[2].provider, "icons8")
  root = env.render(); root.props.onDisappear(); env.render()
  finishSearch(env, 2, 70); await flush()
  assert.equal(nodes(env.render()).filter(n => n.type === "ArtworkImage").length, 0)
  env.state.cleanup()
})

test("automatic recommendations start only on appearance and never auto-save or transmit the full title", () => {
  const env = browserHarness(true, "ChatGPT Plus 给张三 2026-10-01")
  env.render(); assert.equal(env.searches.length, 0)
  let root = env.show()
  assert.equal(env.searches[0].provider, "github"); assert.equal(env.searches[0].query, "ChatGPT"); assert.deepEqual(env.events, [])
  nodes(root).find(n => n.type === "Picker" && n.props.title === "在线图库").props.onChanged("fluent")
  root = env.render()
  assert.equal(env.searches[1].provider, "fluent"); assert.equal(env.searches[1].query, "robot")
  nodes(root).find(n => n.type === "Picker" && n.props.title === "在线图库").props.onChanged("icons8")
  env.render()
  assert.equal(env.searches[2].query, "ChatGPT")
  assert.equal(env.searches[2].style, "全部风格")
  assert.ok(!JSON.stringify(env.searches).includes("张三"))
  env.state.cleanup()
})

test("credential configuration uses obscured input, clears it after save and does not persist search state", () => {
  const env = browserHarness()
  let root = env.show()
  nodes(root).find(n => n.type === "Picker" && n.props.title === "在线图库").props.onChanged("icons8")
  root = env.render()
  nodes(root).find(n => n.type === "SecureField").props.onChanged("test-only-key")
  root = env.render()
  nodes(root).find(n => n.type === "Button" && n.props.title === "安全保存 API Key").props.action()
  root = env.render()
  assert.equal(nodes(root).find(n => n.type === "SecureField").props.value, "")
  assert.deepEqual(env.events, ["saveKey"])
  assert.ok(!JSON.stringify(root).includes("test-only-key"))
  nodes(root).find(n => n.type === "Button" && n.props.title === "清除本机 API Key").props.action()
  root = env.render(); assert.deepEqual(env.events, ["saveKey", "removeKey"])
  assert.equal(env.searches.length, 0)
  env.state.cleanup()
})

test("GitHub is the default blank-query browser and exposes subscription management and partial-source warnings", async () => {
  const env = browserHarness()
  let root = env.show()
  assert.equal(nodes(root).find(n => n.type === "Picker" && n.props.title === "在线图库").props.value, "github")
  assert.ok(nodes(root).some(n => n.type === "NavigationLink" && n.children.some((child: any) => child.type === "Text" && child.children.includes("管理 GitHub 图库订阅"))))
  assert.equal(nodes(root).find(n => n.type === "Button" && n.props.title === "在线搜索").props.disabled, false)
  env.submit("")
  env.searches[0].finish({ icons: [], hasMore: false, page: 0, warnings: ["测试源：暂时无法读取"] })
  await flush(); root = env.render()
  assert.ok(nodes(root).some(n => n.type === "Text" && n.children.includes("测试源：暂时无法读取")))
  env.state.cleanup()
})

test("generic item recommendations retain Fluent while selecting a library never alters stored artwork", () => {
  const env = browserHarness(true, "每月房租")
  let root = env.show()
  assert.equal(env.searches[0].provider, "fluent"); assert.equal(env.searches[0].query, "house")
  nodes(root).find(n => n.type === "Picker" && n.props.title === "在线图库").props.onChanged("github")
  root = env.render()
  assert.equal(env.searches[1].provider, "github")
  nodes(root).find(n => n.type === "Button" && n.props.title === "按事项名称推荐").props.action()
  env.render()
  assert.equal(env.searches[2].provider, "fluent")
  assert.deepEqual(env.events, [])
  env.state.cleanup()
})

function subscriptionsHarness() {
  const state = hooks(), writes: any[] = [], checks: { source: any; finish: (value: any) => void; fail: (reason: Error) => void }[] = []
  let current = defaultState(), failure = false
  const { IconSubscriptionsView } = compile(read("icon_subscriptions_view.tsx"), ["IconSubscriptionsView"], {
    ...state, loadState: () => current,
    fetchGithubManifest: (source: any) => new Promise((finish, fail) => checks.push({ source, finish, fail })),
    updateIconSubscriptions: (next: any, expected: any) => {
      if (failure) throw Error("测试保存失败")
      assert.deepEqual(expected, iconSubscriptions(current.settings))
      current = { ...current, settings: { ...current.settings, iconSubscriptions: normalizeIconSubscriptions(next) } }
      writes.push(current.settings.iconSubscriptions)
      return current
    },
  })
  const render = () => { state.reset(); return IconSubscriptionsView({ onSaved: () => {} }) }
  const show = () => { render().props.onAppear(); return render() }
  const input = (name: string, url: string) => {
    let root = render()
    nodes(root).find(n => n.type === "TextField" && n.props.title === "图库名称").props.onChanged(name)
    nodes(root).find(n => n.type === "TextField" && n.props.title === "JSON 链接").props.onChanged(url)
    return render()
  }
  const add = () => nodes(render()).find(n => n.type === "Button" && n.props.title === "验证并添加").props.action()
  return { state, writes, checks, render, show, input, add, failWrites: () => { failure = true } }
}

test("subscription manager validates before saving, rejects duplicate taps and clears inputs only after success", async () => {
  const env = subscriptionsHarness(); env.show()
  assert.deepEqual(env.writes, []); assert.deepEqual(env.checks, [])
  env.input("Custom", "https://github.com/fixture/icons/blob/main/custom.json")
  const operation = env.add()
  assert.equal(env.checks.length, 1); assert.deepEqual(env.writes, [])
  assert.equal(env.checks[0].source.url, "https://raw.githubusercontent.com/fixture/icons/main/custom.json")
  const busy = nodes(env.render()).find(n => n.type === "Button" && n.props.title === "正在验证清单…")
  assert.equal(busy.props.disabled, true); busy.props.action(); assert.equal(env.checks.length, 1)
  env.checks[0].finish({ icons: [{}], warnings: [] }); await operation
  assert.equal(env.writes.length, 1); assert.equal(env.writes[0].length, DEFAULT_ICON_SUBSCRIPTIONS.length + 1)
  assert.ok(nodes(env.render()).filter(n => n.type === "TextField").every(n => n.props.value === ""))
})

test("subscription manager preserves drafts and old sources when validation or durable saving fails", async () => {
  const env = subscriptionsHarness(); env.show()
  env.input("Custom", "https://raw.githubusercontent.com/fixture/icons/main/custom.json")
  const check = env.add(); env.checks[0].fail(Error("测试读取失败")); await check
  assert.deepEqual(env.writes, [])
  assert.equal(nodes(env.render()).find(n => n.type === "TextField" && n.props.title === "图库名称").props.value, "Custom")
  env.failWrites()
  const save = env.add(); env.checks[1].finish({ icons: [{}], warnings: [] }); await save
  assert.deepEqual(env.writes, [])
  assert.ok(nodes(env.render()).some(n => n.type === "Text" && n.children.includes("测试保存失败")))
})

test("leaving and reopening the subscription manager cannot commit a verification started in the old visit", async () => {
  const env = subscriptionsHarness(); env.show()
  env.input("Custom", "https://raw.githubusercontent.com/fixture/icons/main/custom.json")
  const operation = env.add()
  env.render().props.onDisappear(); env.show()
  env.checks[0].finish({ icons: [{}], warnings: [] }); await operation
  assert.deepEqual(env.writes, [])
})

test("subscription manager rejects unsafe or duplicate URLs before networking and supports toggling and removal", async () => {
  const env = subscriptionsHarness(); let root = env.show()
  env.input("Unsafe", "https://localhost/a.json?key=private"); await env.add()
  assert.deepEqual(env.checks, []); assert.deepEqual(env.writes, [])
  env.input("Duplicate", DEFAULT_ICON_SUBSCRIPTIONS[0].url); await env.add()
  assert.deepEqual(env.checks, []); assert.deepEqual(env.writes, [])
  root = env.render(); nodes(root).find(n => n.type === "Toggle").props.onChanged(false)
  assert.equal(env.writes[0][0].enabled, false)
  root = env.render(); nodes(root).find(n => n.type === "Button" && n.props.title === "移除「恩秀 App」订阅").props.action()
  assert.equal(env.writes[1].length, DEFAULT_ICON_SUBSCRIPTIONS.length - 1)
  root = env.render(); nodes(root).find(n => n.type === "Button" && n.props.title === "补回缺少的预设图库").props.action()
  assert.equal(env.writes[2].length, DEFAULT_ICON_SUBSCRIPTIONS.length)
})

test("adaptive native SVG renders original colors, proportional padding and dynamic background", () => {
  const { ArtworkImage } = compile(read("artwork_image.tsx"), ["ArtworkImage"], {})
  const root = ArtworkImage({ image: { svg: "<svg/>", width: 64, height: 32, adaptive: true }, size: 32, widget: true })
  const [plate, vector] = root.children
  assert.equal(plate.type, "RoundedRectangle"); assert.notEqual(plate.props.fill.light, plate.props.fill.dark)
  assert.equal(vector.type, "SVG"); assert.equal(vector.props.code, "<svg/>"); assert.equal(vector.props.renderingMode, "original")
  assert.equal(vector.props.frame.width / vector.props.frame.height, 2); assert.ok(vector.props.frame.width < 32)
  assert.equal(vector.props.widgetAccentedRenderingMode, "fullColor")
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
