// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. Third-party artwork retains its own rights.

import { Image, Label, VStack, ZStack } from "scripting"
import type { LoadedBrandLogo } from "./brand_assets"

/** Crop only the added packaging margin before the circular display mask. */
export function BrandLogo({ logo }: { logo: LoadedBrandLogo }) {
  const imageSize = logo.size * (logo.contentScale ?? 1)
  return <VStack
    spacing={0}
    frame={{ width: logo.size, height: logo.size }}
    clipShape="circle"
  >
    <Image
      image={logo.image}
      resizable
      scaleToFit
      renderingMode="original"
      widgetAccentedRenderingMode="fullColor"
      frame={{ width: imageSize, height: imageSize }}
    />
  </VStack>
}

/** The visible image belongs to the button label, never to its background. */
export function BrandCompletionLabel({ logo, title, hitSize }: {
  logo: LoadedBrandLogo; title: string; hitSize: number
}) {
  return <ZStack frame={{ width: hitSize, height: hitSize }} contentShape="rect">
    {/* Retain a native icon-only action label for VoiceOver without coloring
        the Button itself clear. The UIImage is the visible label content. */}
    <Label title={title} systemImage="checkmark.circle" labelStyle="iconOnly" foregroundStyle="clear" />
    <BrandLogo logo={logo} />
  </ZStack>
}
