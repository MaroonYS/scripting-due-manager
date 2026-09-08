// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. Third-party artwork retains its own rights.

import { Image, Label, VStack, ZStack } from "scripting"
import type { LoadedBrandLogo } from "./brand_assets"

/** Give enlarged packaged artwork 2 pt more room on each edge, without zooming it further. */
export function BrandLogo({ logo, widget = false }: { logo: LoadedBrandLogo; widget?: boolean }) {
  const imageSize = logo.size * (logo.contentScale ?? 1)
  // Never make the mask larger than the image: original, unscaled artwork
  // keeps its existing circular outline instead of exposing square edges.
  const clipSize = Math.min(imageSize, logo.size + 4)
  return <VStack
    spacing={0}
    frame={{ width: clipSize, height: clipSize }}
    clipShape="circle"
  >
    <Image
      image={logo.image}
      resizable
      scaleToFit
      renderingMode="original"
      widgetAccentedRenderingMode={widget ? "fullColor" : undefined}
      frame={{ width: imageSize, height: imageSize }}
    />
  </VStack>
}

/** The visible image belongs to the button label, never to its background. */
export function BrandCompletionLabel({ logo, title, hitSize, widget = false }: {
  logo: LoadedBrandLogo; title: string; hitSize: number; widget?: boolean
}) {
  return <ZStack frame={{ width: hitSize, height: hitSize }} contentShape="rect">
    {/* Retain a native icon-only action label for VoiceOver without coloring
        the Button itself clear. The UIImage is the visible label content. */}
    <Label title={title} systemImage="checkmark.circle" labelStyle="iconOnly" foregroundStyle="clear" />
    <BrandLogo logo={logo} widget={widget} />
  </ZStack>
}
