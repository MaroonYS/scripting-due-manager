// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { Image, Label, VStack } from "scripting"
import { normalizeIconOverride } from "./icons"

export interface DueSymbolProps {
  name?: string | null
  color: string
  size: number
  slotSize?: number
  widget?: boolean
  replace?: boolean
}

/** Drawing bounds and layout/tap bounds are deliberately separate. */
export function dueSymbolGeometry(size: number, slotSize?: number) {
  const edge = Number.isFinite(size) ? Math.max(8, Math.min(48, size)) : 20
  const slot = slotSize != null && Number.isFinite(slotSize)
    ? Math.max(edge, Math.min(64, slotSize)) : edge
  return { size: edge, slotSize: slot }
}

/** Every item symbol uses the same aspect-fit drawing path, not font-only sizing. */
export function DueSymbol({ name, color, size, slotSize, widget, replace }: DueSymbolProps) {
  const geometry = dueSymbolGeometry(size, slotSize)
  return <VStack alignment="center" spacing={0} frame={{ width: geometry.slotSize, height: geometry.slotSize, alignment: "center" }}>
    <Image
      systemName={normalizeIconOverride(name) ?? "calendar.badge.clock"}
      resizable={true}
      scaleToFit={true}
      font={geometry.size}
      fontWeight="regular"
      foregroundStyle={color}
      symbolRenderingMode={widget ? "hierarchical" : "monochrome"}
      frame={{ width: geometry.size, height: geometry.size, alignment: "center" }}
      contentTransition={replace ? "symbolEffectReplace" : undefined}
      widgetAccentable={widget ? true : undefined}
    />
  </VStack>
}

/** Keep the native semantic title; only its visual layer is replaced. */
export function DueSymbolLabel({ title, ...symbol }: DueSymbolProps & { title: string }) {
  const geometry = dueSymbolGeometry(symbol.size, symbol.slotSize)
  return <Label
    title={title}
    systemImage={normalizeIconOverride(symbol.name) ?? "calendar.badge.clock"}
    labelStyle="iconOnly"
    font={geometry.size}
    foregroundStyle="clear"
    frame={{ width: geometry.slotSize, height: geometry.slotSize, alignment: "center" }}
    contentShape="rect"
    background={{ content: <DueSymbol {...symbol} />, alignment: "center" }}
    widgetAccentable={symbol.widget ? true : undefined}
  />
}
