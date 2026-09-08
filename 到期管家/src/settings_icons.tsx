// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { HStack, Image, RoundedRectangle, Text, VStack, ZStack } from "scripting"

export type SettingsIconKind = "amount" | "reminders" | "reminderLists" | "small" | "medium" | "large"
export const SETTINGS_ICON_SIZE = 24
export const PREVIEW_ICON_LAYOUTS = {
  small: { width: 18, height: 18, lines: [7, 11] },
  medium: { width: 22, height: 13, lines: [8, 15] },
  large: { width: 18, height: 22, lines: [7, 11, 9] },
} as const

/** Settings-only decoration: no dependency on widget rendering or item data. */
export function SettingsRowIcon({ kind }: { kind: SettingsIconKind }) {
  if (kind === "amount" || kind === "reminders" || kind === "reminderLists") {
    const symbol = {
      amount: "banknote.fill",
      reminders: "list.bullet.clipboard",
      reminderLists: "line.3.horizontal.decrease.circle",
    }[kind]
    return <Image
      systemName={symbol}
      font={20}
      fontWeight="regular"
      foregroundStyle="systemBlue"
      symbolRenderingMode="monochrome"
      frame={{ width: SETTINGS_ICON_SIZE, height: SETTINGS_ICON_SIZE }}
    />
  }
  const layout = PREVIEW_ICON_LAYOUTS[kind]
  return <ZStack frame={{ width: SETTINGS_ICON_SIZE, height: SETTINGS_ICON_SIZE }}>
    <RoundedRectangle
      cornerRadius={3}
      fill="clear"
      stroke={{ shapeStyle: "systemBlue", strokeStyle: { lineWidth: 1.5 } }}
      frame={{ width: layout.width, height: layout.height }}
    />
    <VStack alignment="leading" spacing={2.5} frame={{ width: layout.width - 7 }}>
      {layout.lines.map((width, index) => <RoundedRectangle
        key={index}
        cornerRadius={1}
        fill="systemBlue"
        opacity={index === 0 ? 1 : 0.55}
        frame={{ width, height: index === 0 ? 2 : 1.5 }}
      />)}
    </VStack>
  </ZStack>
}

export function SettingsRowLabel({ title, kind }: { title: string; kind: SettingsIconKind }) {
  return <HStack spacing={12} frame={{ maxWidth: "infinity", alignment: "leading" }}>
    <SettingsRowIcon kind={kind} />
    <Text>{title}</Text>
  </HStack>
}
