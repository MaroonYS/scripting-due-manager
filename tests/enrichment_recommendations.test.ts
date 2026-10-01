// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import * as icons from "../到期管家/src/icons.ts"
import { recommendedSystemIcons } from "../到期管家/src/system_icon_recommendations.ts"

const names = (...args: Parameters<typeof recommendedSystemIcons>) => recommendedSystemIcons(...args).map(icon => icon.name)
const assertIncludes = (actual: string[], expected: string[], context: string) => {
  for (const name of expected) assert.ok(actual.includes(name), `${context}: missing ${name} in ${actual.join(", ")}`)
}

test("VPN recommendations cross the category order to include security, passwords and networking", () => {
  const result = names("lock.shield.fill", null, { title: "VPN 续费", kind: "subscription" })
  assert.equal(result[0], "lock.shield.fill")
  assertIncludes(result, ["key.fill", "network"], "VPN")
  assert.ok(result.includes("wifi") || result.includes("globe"), "VPN has a recognizable network alternative")
})

test("scene matching normalizes full-width text and Latin case without relying on the automatic symbol", () => {
  const plain = names("calendar.badge.clock", null, { title: "VPN 续费", kind: "custom" })
  const fullWidth = names("calendar.badge.clock", null, { title: "　ＶＰＮ　续费　", kind: "custom" })
  const lowerCase = names("calendar.badge.clock", null, { title: "vpn 续费", kind: "custom" })
  assert.deepEqual(fullWidth, plain)
  assert.deepEqual(lowerCase, plain)
  assertIncludes(plain, ["lock.shield.fill", "key.fill", "network"], "title-derived VPN")
})

test("vehicle care recommendations include insurance, repair tools and parking rather than only transport types", () => {
  for (const title of ["车辆年检", "汽车保养预约"]) {
    const result = names("car.fill", null, { title, kind: "custom" })
    assert.equal(result[0], "car.fill")
    assertIncludes(result, ["shield.fill", "wrench.and.screwdriver.fill", "parkingsign.circle.fill"], title)
  }
})

test("credential renewal recommendations pair identification with documents and an expiry date", () => {
  for (const title of ["护照换发", "驾驶证续期"]) {
    const result = names("person.crop.rectangle.fill", null, { title, kind: "custom" })
    assert.equal(result[0], "person.crop.rectangle.fill")
    assert.ok(result.some(name => ["doc.text.fill", "doc.richtext", "doc.text.magnifyingglass", "doc.on.doc.fill", "doc.text.image.fill"].includes(name)), `${title}: document alternative`)
    assert.ok(result.some(name => ["calendar", "calendar.badge.clock", "clock.fill"].includes(name)), `${title}: expiry alternative`)
  }
})

test("specific vehicle and credential titles enrich a generic automatic date icon", () => {
  for (const title of ["车辆年检", "汽车保养预约", "汽車保養預約"]) {
    const result = names("calendar.badge.clock", null, { title, kind: "custom" })
    assert.equal(result[0], "calendar.badge.clock")
    assertIncludes(result, ["car.fill", "shield.fill", "parkingsign.circle.fill"], title)
  }
  for (const title of ["驾驶证续期", "駕駛證續期"]) {
    const result = names("calendar.badge.clock", null, { title, kind: "custom" })
    assert.equal(result[0], "calendar.badge.clock")
    assert.ok(result.includes("person.crop.rectangle.fill") || result.includes("person.text.rectangle.fill"), `${title}: identity alternative`)
    assert.ok(result.includes("doc.on.doc.fill") || result.includes("doc.text.image.fill"), `${title}: document alternative`)
  }
})

test("a recognized automatic scene takes precedence over an ambiguous item kind", () => {
  const payment = names("creditcard.fill", null, { title: "Visa Card 续费", kind: "credential" })
  assertIncludes(payment, ["creditcard.fill", "building.columns.fill", "wallet.pass.fill"], "Visa payment")
  assert.ok(!payment.includes("person.text.rectangle.fill"), "a payment card must not become an identity document")
  const insurance = names("shield.fill", null, { title: "保险单续期", kind: "credential" })
  assertIncludes(insurance, ["shield.fill", "checkmark.shield.fill", "house.fill", "car.fill"], "insurance")
})

test("software licence expiry recommends digital tools rather than identity credentials", () => {
  for (const title of ["software license expiry", "软件许可证到期"]) {
    const result = names("calendar.badge.clock", null, { title, kind: "custom" })
    assert.equal(result[0], "calendar.badge.clock")
    assertIncludes(result, ["globe", "network", "terminal.fill"], title)
    assert.ok(!result.includes("person.text.rectangle.fill"), `${title}: not a driving licence`)
    assert.ok(!result.includes("person.crop.rectangle.fill"), `${title}: not an identity document`)
  }
  const known = names("desktopcomputer", null, { title: "license expiry", kind: "digitalService" })
  assert.equal(known[0], "desktopcomputer")
  assertIncludes(known, ["globe", "network"], "known software symbol")
  assert.ok(!known.includes("person.text.rectangle.fill"))
})

test("recommendation anchors are retained, deduplicated and limited to eight catalog definitions", () => {
  const original = structuredClone(icons.DUE_ICON_OPTIONS)
  const cases: Parameters<typeof recommendedSystemIcons>[] = [
    ["lock.shield.fill", "wallet.pass.fill", { title: "VPN 续费", kind: "subscription" }],
    ["car.fill", "music.note", { title: "车辆年检", kind: "custom" }],
    ["person.crop.rectangle.fill", "car.fill", { title: "护照换发", kind: "reminder" }],
    ["music.note", "music.note"],
    ["unknown.symbol.fill", "another.unknown.symbol"],
    ["unknown.symbol.fill", "wallet.pass.fill"],
    [undefined, null],
  ]
  for (const args of cases) {
    const result = recommendedSystemIcons(...args)
    assert.equal(result.length, 8)
    assert.equal(new Set(result.map(icon => icon.name)).size, result.length)
    assert.ok(result.every(icon => icons.DUE_ICON_OPTIONS.includes(icon)), "recommendations retain known catalog objects")
    assert.deepEqual(recommendedSystemIcons(...args), result, "unchanged input gives deterministic recommendations")
    const [automatic, selected] = args
    const automaticKnown = icons.DUE_ICON_OPTIONS.some(icon => icon.name === automatic)
    if (automaticKnown) assert.equal(result[0].name, automatic)
    if (selected !== automatic && icons.DUE_ICON_OPTIONS.some(icon => icon.name === selected)) assert.equal(result[automaticKnown ? 1 : 0].name, selected)
  }
  assert.deepEqual(icons.DUE_ICON_OPTIONS, original, "scene ranking must not mutate catalog order or definitions")
})

test("generic recommendations preserve the existing automatic, selected and category fallback shape", () => {
  for (const [automaticName, selectedName] of [["clock.fill", "car.fill"], ["bell.fill", null], ["unknown.symbol", undefined], [undefined, undefined]] as const) {
    const automatic = icons.DUE_ICON_OPTIONS.find(icon => icon.name === automaticName)
    const candidates = [automaticName, selectedName,
      ...icons.DUE_ICON_OPTIONS.filter(icon => icon.group === automatic?.group).map(icon => icon.name),
      "calendar.badge.clock", "repeat.circle.fill", "creditcard.fill", "checklist", "bell.fill", "tag.fill", "gift.fill", "heart.fill"]
    const expected = [...new Set(candidates)].filter(name => icons.DUE_ICON_OPTIONS.some(icon => icon.name === name)).slice(0, 8)
    assert.deepEqual(names(automaticName, selectedName), expected)
  }
})

const read = (file: string) => readFileSync(new URL(`../到期管家/src/${file}`, import.meta.url), "utf8")
const h = (type: any, props: any, ...children: any[]) => ({ type: typeof type === "function" ? type.name : type,
  props: props ?? {}, children: children.flat(Infinity).filter(child => child != null && child !== false) })
const nodes = (node: any): any[] => [node, ...node.children.filter((child: any) => typeof child === "object").flatMap(nodes)]
const primitives = Object.fromEntries(["Button", "HStack", "Image", "LazyVGrid", "List", "Picker", "Section", "Spacer", "SystemIconThemes", "Text", "TextField", "VStack"].map(name => [name, name]))

function harness(file: string, componentName: string) {
  const slots: any[] = []
  let cursor = 0
  const bindings = { h, ...primitives, ...icons, recommendedSystemIcons,
    Navigation: { useDismiss: () => () => assert.fail("preview must not dismiss") },
    useState: (initial: any) => {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial
      return [slots[index], (next: any) => { slots[index] = typeof next === "function" ? next(slots[index]) : next }]
    },
  }
  const source = read(file).replace(/^import .*$/gm, "").replace(/^export /gm, "")
  const compiled = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react", jsxFactory: "h" } } }).transformSync(source)
  const component = new Function(...Object.keys(bindings), `${compiled}\nreturn ${componentName}`)(...Object.values(bindings))
  return (props: any) => { cursor = 0; return component(props) }
}

test("the shared picker forwards title and item kind to the scene-aware recommendations", () => {
  const render = harness("system_icon_picker.tsx", "SystemIconPicker")
  const root = render({ title: "车辆年检", kind: "custom", automatic: icons.resolveDueIcon("车辆年检", "custom"),
    value: null, footer: "local only", onConfirm: () => assert.fail("preview must not save") })
  const themes = nodes(root).find(node => node.type === "SystemIconThemes")!
  assert.equal(themes.props.title, "车辆年检")
  assert.equal(themes.props.kind, "custom")
})

test("scene recommendations remain stable while preview changes and search clearing restores the same candidates", () => {
  const events: string[] = []
  const render = harness("system_icon_themes.tsx", "SystemIconThemes")
  const props = { title: "VPN 续费", kind: "subscription", automaticName: "lock.shield.fill", value: "wallet.pass.fill",
    onChanged: (value: string) => events.push(value) }
  const candidates = (root: any) => nodes(root).filter(node => node.type === "Button" && node.props.key).map(node => node.props.key)
  const initial = candidates(render(props))
  assertIncludes(initial, ["lock.shield.fill", "wallet.pass.fill", "key.fill", "network"], "scene grid")
  const changed = { ...props, value: "key.fill" }
  assert.deepEqual(candidates(render(changed)), initial)
  nodes(render(changed)).find(node => node.type === "TextField")!.props.onChanged("unknown-847291")
  assert.deepEqual(candidates(render(changed)), [])
  nodes(render(changed)).find(node => node.type === "TextField")!.props.onChanged("")
  assert.deepEqual(candidates(render(changed)), initial)
  assert.deepEqual(events, [], "ranking and searching do not choose or save an icon")
})
