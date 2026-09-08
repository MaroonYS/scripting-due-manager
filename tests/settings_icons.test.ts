// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(new URL(`../到期管家/${path}`, import.meta.url), "utf8")
const iconSource = read("src/settings_icons.tsx")
type Node = { type: string; props: Record<string, any>; children: any[] }
const h = (type: string | ((props: any) => Node), props: any, ...children: any[]): Node =>
  typeof type === "function" ? type({ ...props, children }) : { type, props: props ?? {}, children: children.flat(Infinity).filter(child => child != null) }
const transpiler = new Bun.Transpiler({ loader: "tsx", tsconfig: {
  compilerOptions: { jsx: "react", jsxFactory: "h" },
} })
const primitives = Object.fromEntries(["HStack", "Image", "RoundedRectangle", "Text", "VStack", "ZStack"]
  .map(name => [name, name]))
const compiled = transpiler.transformSync(iconSource.replace(/^import .* from "scripting"\n/m, "").replace(/^export /gm, ""))
const icons = new Function("h", ...Object.keys(primitives), `${compiled}\nreturn { SettingsRowIcon, SettingsRowLabel, PREVIEW_ICON_LAYOUTS, SETTINGS_ICON_SIZE }`)(h, ...Object.values(primitives))
const nodes = (node: Node): Node[] => [node, ...node.children.filter(child => typeof child === "object").flatMap(nodes)]
const text = (node: Node): string => [node.props.title ?? "", ...node.children.map(child =>
  typeof child === "object" ? text(child) : String(child))].join("")

test("amount, Apple Reminders and list filtering use outlined native icons in the same slot", () => {
  for (const [kind, symbol] of Object.entries({
    amount: "banknote", reminders: "list.bullet.clipboard", reminderLists: "line.3.horizontal.decrease.circle",
  })) {
    const node = icons.SettingsRowIcon({ kind })
    assert.equal(node.type, "Image")
    assert.equal(node.props.systemName, symbol)
    assert.ok(!node.props.systemName.endsWith(".fill"), "settings symbols must stay outlined")
    assert.equal(node.props.foregroundStyle, "systemBlue")
    assert.equal(node.props.symbolRenderingMode, "monochrome")
    assert.deepEqual(node.props.frame, { width: 24, height: 24 })
  }
})

test("preview icons have square, landscape and portrait outlines with unclipped content lines", () => {
  const layouts = icons.PREVIEW_ICON_LAYOUTS
  assert.equal(layouts.small.width, layouts.small.height)
  assert.ok(layouts.medium.width > layouts.medium.height)
  assert.ok(layouts.large.width < layouts.large.height)
  for (const kind of ["small", "medium", "large"]) {
    const node = icons.SettingsRowIcon({ kind })
    assert.deepEqual(node.props.frame, { width: 24, height: 24 })
    const outline = node.children[0]
    assert.equal(outline.type, "RoundedRectangle")
    assert.equal(outline.props.fill, "clear")
    assert.equal(outline.props.stroke.strokeStyle.lineWidth, 1.5)
    assert.ok(layouts[kind].width + 1.5 <= 24)
    assert.ok(layouts[kind].height + 1.5 <= 24)
    const content = node.children[1]
    assert.equal(content.type, "VStack")
    assert.equal(content.children.length, kind === "large" ? 3 : 2)
    for (const line of content.children) assert.ok(line.props.frame.width <= content.props.frame.width)
    const contentHeight = content.children.reduce((sum: number, line: Node) => sum + line.props.frame.height, 0)
      + (content.children.length - 1) * content.props.spacing
    assert.ok(contentHeight <= layouts[kind].height - 6)
  }
})

test("settings labels share icon spacing and preserve the native text and row sizing", () => {
  const node = icons.SettingsRowLabel({ title: "大号组件预览", kind: "large" })
  assert.equal(node.props.spacing, 12)
  assert.deepEqual(node.props.frame, { maxWidth: "infinity", alignment: "leading" })
  assert.equal(node.children[1].type, "Text")
  assert.equal(text(node.children[1]), "大号组件预览")
  assert.equal(node.children[1].props.font, undefined)
  assert.equal(node.children[1].props.lineLimit, undefined)
})

function settings(includeReminders: boolean, loading = false) {
  const app = read("index.tsx")
  const start = app.indexOf('      <Section\n        header={<Text>系统提醒事项</Text>}')
  const end = app.indexOf('      <Section>\n        <NavigationLink destination={<RecoveryView', start)
  assert.ok(start > 0 && end > start)
  const compiled = transpiler.transformSync(`function render() { return <VStack>${app.slice(start, end)}</VStack> }`)
  const events: any[] = []
  const bindings = {
    h, ...primitives, ...icons,
    ...Object.fromEntries(["Section", "Toggle", "NavigationLink", "ReminderCalendarPicker", "Spacer", "Button",
      "ReminderStatusRow", "WidgetActionStatusView", "NotificationView", "BrandSettingsView", "Label"].map(name => [name, name])),
    refreshState: () => {},
    state: { settings: { includeReminders, reminderCalendarIDs: ["selected"], showAmounts: true } },
    reminderStatus: { loading },
    setReminderIntegration: (value: boolean) => events.push(["reminders", value]),
    setReminderCalendarSelection: (value: string[]) => events.push(["lists", value]),
    setShowAmounts: (value: boolean) => events.push(["amount", value]),
    preview: (family: string) => events.push(["preview", family]),
    refreshReminders: () => events.push(["sync"]),
    reloadUserWidgets: () => events.push(["refresh"]),
    Dialog: { alert: () => { throw new Error("unexpected alert") } },
  }
  const view = new Function(...Object.keys(bindings), `${compiled}\nreturn render()`)(...Object.values(bindings))
  return { elements: nodes(view), events }
}

test("custom icon labels retain each toggle value, disabled state and exact preview action", () => {
  const { elements, events } = settings(true, true)
  const reminder = elements.find(node => node.type === "Toggle" && text(node) === "显示 Apple 提醒事项")!
  assert.equal(reminder.props.value, true)
  assert.equal(reminder.props.disabled, true)
  assert.equal(reminder.props.title, undefined, "custom labels must not also supply title")
  reminder.props.onChanged(false)
  const amount = elements.find(node => node.type === "Toggle" && text(node) === "在组件显示金额")!
  assert.equal(amount.props.value, true)
  amount.props.onChanged(false)
  for (const title of ["小号组件预览", "中号组件预览", "大号组件预览"]) {
    const button = elements.find(node => node.type === "Button" && text(node) === title)!
    assert.ok(button)
    button.props.action()
  }
  assert.deepEqual(events, [["reminders", false], ["amount", false],
    ["preview", "systemSmall"], ["preview", "systemMedium"], ["preview", "systemLarge"]])
})

test("reminder list navigation retains selection and remains hidden when integration is disabled", () => {
  const visible = settings(true)
  const link = visible.elements.find(node => node.type === "NavigationLink" && text(node).includes("提醒事项列表"))!
  assert.ok(link)
  assert.equal(link.children[0].props.spacing, 12)
  assert.deepEqual(link.props.destination.props.selectedIDs, ["selected"])
  link.props.destination.props.onChanged(["next"])
  assert.deepEqual(visible.events, [["lists", ["next"]]])
  assert.ok(!settings(false).elements.some(node => node.type === "NavigationLink" && text(node).includes("提醒事项列表")))
})

test("standalone version row is removed while update metadata and widget code stay independent", () => {
  const app = read("index.tsx")
  const start = app.indexOf("function DueManagerApp(")
  const main = app.slice(start, app.indexOf("function ItemEditor(", start))
  assert.doesNotMatch(main, /<Text>版本<\/Text>|Script\.metadata\.version/)
  assert.ok(main.includes('destination={<UpdateView />}'))
  assert.ok(main.includes('destination={<OwnershipView />}'))
  assert.ok(read("src/update_view.tsx").includes('title="当前版本"'))
  assert.ok(read("src/update_view.tsx").includes('title="最新版本"'))
  for (const path of ["widget.tsx", "src/widget_view.tsx", "app_intents.tsx"]) {
    assert.ok(!read(path).includes("settings_icons"), path)
  }
})
