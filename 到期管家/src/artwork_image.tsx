// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. Third-party artwork retains its own rights.

import { Image, Label, RoundedRectangle, Script, ZStack, useEffect, useState } from "scripting"
import { loadArtwork, peekArtwork } from "./artwork_assets"
import type { LoadedArtwork } from "./artwork_assets"

export function useArtwork(id: string | null | undefined, active = true): LoadedArtwork | null {
  const [loaded, setLoaded] = useState<{ id: string | null | undefined; image: LoadedArtwork | null }>(() => ({ id, image: peekArtwork(id, Script.directory) }))
  useEffect(() => {
    let current = true
    if (!id) { setLoaded({ id, image: null }); return }
    if (!active) { setLoaded({ id, image: null }); return }
    void loadArtwork(id, Script.directory).then(image => { if (current) setLoaded({ id, image }) })
    return () => { current = false }
  }, [id, active])
  return loaded.id === id ? loaded.image : peekArtwork(id, Script.directory)
}

/** Native lists may construct offscreen rows; start their optional reads on appearance. */
export function useVisibleArtwork(id: string | null | undefined) {
  const [visible, setVisible] = useState(false)
  const image = useArtwork(id, visible)
  return { image, onAppear: () => setVisible(true), onDisappear: () => setVisible(false) }
}

/** Keep original alpha, colors and proportions: no recoloring, cropping or masks. */
export function ArtworkImage({ image, size = 24, widget = false }: { image: LoadedArtwork; size?: number; widget?: boolean }) {
  return <ZStack frame={{ width: size, height: size }}>
    {image.lightBackplate ? <RoundedRectangle cornerRadius={Math.max(3, size / 5)}
      fill={{ light: "clear", dark: "#FFFFFF" }} frame={{ width: size, height: size }} /> : null}
    <Image image={image.image} resizable scaleToFit renderingMode="original"
      widgetAccentedRenderingMode={widget ? "fullColor" : undefined}
      frame={{ width: size, height: size }} />
  </ZStack>
}

export function ArtworkCompletionLabel({ image, title, hitSize = 40, size = 24, widget = false }: {
  image: LoadedArtwork; title: string; hitSize?: number; size?: number; widget?: boolean
}) {
  return <ZStack frame={{ width: hitSize, height: hitSize }} contentShape="rect">
    <Label title={title} systemImage="checkmark.circle" labelStyle="iconOnly" foregroundStyle="clear" />
    <ArtworkImage image={image} size={size} widget={widget} />
  </ZStack>
}
