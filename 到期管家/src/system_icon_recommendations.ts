// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { DUE_ICON_OPTIONS } from "./icons"
import type { DueIconDefinition } from "./icons"
import type { ItemKind } from "./types"

export interface SystemIconContext { title?: string; kind?: ItemKind | "reminder" }

// Related actions, not adjacent positions in the full catalog. No user content is stored.
const SCENE_ICONS = {
  security: ["lock.shield.fill", "key.fill", "shield.lefthalf.filled", "network", "lock.doc.fill", "server.rack", "wifi", "checkmark.shield.fill"],
  vehicle: ["car.fill", "wrench.adjustable.fill", "shield.fill", "parkingsign.circle.fill", "fuelpump.fill", "bolt.car.fill", "wrench.and.screwdriver.fill", "calendar"],
  credentials: ["person.text.rectangle.fill", "doc.text.image.fill", "checkmark.seal.fill", "doc.on.doc.fill", "signature", "calendar", "person.crop.rectangle.fill", "lock.doc.fill"],
  housing: ["house.fill", "doc.text.fill", "bolt.fill", "drop.fill", "flame.fill", "wifi", "hammer.fill", "wrench.and.screwdriver.fill"],
  credit: ["creditcard.fill", "building.columns.fill", "wallet.pass.fill", "banknote.fill", "percent", "arrow.left.arrow.right.circle.fill", "doc.text.fill", "calendar"],
  insurance: ["shield.fill", "checkmark.shield.fill", "doc.on.doc.fill", "calendar", "house.fill", "car.fill", "cross.case.fill", "banknote.fill"],
  medical: ["stethoscope", "cross.case.fill", "mouth.fill", "calendar", "heart.text.square.fill", "syringe.fill", "pills.fill", "eye.fill"],
  medication: ["pills.fill", "alarm.fill", "calendar", "clock.fill", "stethoscope", "cross.case.fill", "heart.text.square.fill", "syringe.fill"],
  swimming: ["figure.pool.swim", "figure.run", "figure.yoga", "dumbbell.fill", "calendar", "heart.text.square.fill", "bicycle", "trophy.fill"],
  yoga: ["figure.yoga", "figure.mind.and.body", "dumbbell.fill", "calendar", "heart.text.square.fill", "figure.run", "leaf.fill", "figure.pool.swim"],
  digital: ["desktopcomputer", "globe", "server.rack", "network", "icloud.fill", "lock.shield.fill", "terminal.fill", "calendar"],
  entertainment: ["play.rectangle.fill", "music.note", "headphones", "tv.fill", "gamecontroller.fill", "ticket.fill", "repeat.circle.fill", "crown.fill"],
} as const
type Scene = keyof typeof SCENE_ICONS

const SYMBOL_SCENES = new Map<string, Scene>([
  ...["lock.shield.fill", "key.fill", "shield.lefthalf.filled", "lock.doc.fill"].map(name => [name, "security"] as const),
  ...["car.fill", "car.side.fill", "wrench.adjustable.fill", "parkingsign.circle.fill", "fuelpump.fill", "bolt.car.fill"].map(name => [name, "vehicle"] as const),
  ...["person.text.rectangle.fill", "doc.text.image.fill", "checkmark.seal.fill", "person.crop.rectangle.fill", "doc.on.doc.fill", "signature"].map(name => [name, "credentials"] as const),
  ...["house.fill", "bolt.fill", "drop.fill", "flame.fill", "hammer.fill"].map(name => [name, "housing"] as const),
  ...["creditcard.fill", "building.columns.fill", "wallet.pass.fill", "banknote.fill", "percent"].map(name => [name, "credit"] as const),
  ...["shield.fill", "checkmark.shield.fill"].map(name => [name, "insurance"] as const),
  ...["stethoscope", "cross.case.fill", "mouth.fill", "syringe.fill", "eye.fill", "heart.text.square.fill"].map(name => [name, "medical"] as const),
  ["pills.fill", "medication"], ["figure.pool.swim", "swimming"], ["figure.yoga", "yoga"],
  ...["globe", "server.rack", "network", "icloud.fill", "externaldrive.fill", "desktopcomputer", "terminal.fill", "curlybraces.square.fill", "sparkles", "square.grid.2x2.fill", "puzzlepiece.extension.fill"].map(name => [name, "digital"] as const),
  ...["play.rectangle.fill", "music.note", "headphones", "tv.fill", "gamecontroller.fill"].map(name => [name, "entertainment"] as const),
])

function contextScene(context: SystemIconContext): Scene | null {
  const title = (context.title ?? "").normalize("NFKC").toLowerCase()
  if (/\b(?:vpn|password|privacy)\b|密码|密碼|网络安全|網絡安全/.test(title)) return "security"
  if (/\b(?:car|vehicle|parking)\b|车辆|車輛|汽车|汽車|车险|車險|年检|年檢|停车|停車/.test(title)) return "vehicle"
  if (/\b(?:software|app|saas|ssl|tls)\b|软件|軟件|数字服务|數字服務/.test(title)) return "digital"
  if (/\bpassport\b|\b(?:visa|licen[cs]e|certificate)\s+(?:renewal|expiry)\b|护照|護照|驾照|駕照|驾驶证|駕駛證|证件|證件|合同|资格证|資格證|证书|證書/.test(title)) return "credentials"
  if (/\bswim(?:ming)?\b|游泳|泳课|泳課/.test(title)) return "swimming"
  if (/\byoga\b|瑜伽/.test(title)) return "yoga"
  if (/房租|物业|物業|水费|水費|电费|電費|燃气|燃氣|\b(?:rent|utilities)\b/.test(title)) return "housing"
  if (/复诊|複診|復診|牙科|牙医|牙醫|体检|體檢|\b(?:dental|checkup)\b/.test(title)) return "medical"
  if (/服药|服藥|处方|處方|\bmedication\b/.test(title)) return "medication"
  if (context.kind === "creditCard" || context.kind === "repayment") return "credit"
  if (context.kind === "insurance") return "insurance"
  if (context.kind === "credential") return "credentials"
  return null
}

/** Automatic and existing choices stay first; unknown future symbols are never offered. */
export function recommendedSystemIcons(automaticName?: string, selectedName?: string | null,
  context: SystemIconContext = {}): DueIconDefinition[] {
  const automatic = DUE_ICON_OPTIONS.find(icon => icon.name === automaticName)
  const scene = SYMBOL_SCENES.get(automaticName ?? "") ?? contextScene(context)
  const names = [automaticName, selectedName, ...(scene ? SCENE_ICONS[scene] : []),
    ...DUE_ICON_OPTIONS.filter(icon => icon.group === automatic?.group).map(icon => icon.name),
    "calendar.badge.clock", "repeat.circle.fill", "creditcard.fill", "checklist", "bell.fill", "tag.fill", "gift.fill", "heart.fill"]
  return [...new Set(names)].flatMap(name => {
    const icon = DUE_ICON_OPTIONS.find(candidate => candidate.name === name)
    return icon ? [icon] : []
  }).slice(0, 8)
}
