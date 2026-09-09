// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// Third-party artwork retains its own rights. See NOTICE.md.

export type OnlineArtworkProvider = "fluent" | "icons8"
export interface OnlineArtworkID { provider: OnlineArtworkProvider; name: string }

/** Store only provider-qualified identifiers, never arbitrary URLs or API payloads. */
export function parseOnlineArtworkID(id: unknown): OnlineArtworkID | null {
  if (typeof id !== "string") return null
  const fluent = /^fluent-emoji-flat:([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(id)
  if (fluent && fluent[1].length <= 128) return { provider: "fluent", name: fluent[1] }
  const icons8 = /^icons8-online:([A-Za-z0-9]{1,32})$/.exec(id)
  return icons8 ? { provider: "icons8", name: icons8[1] } : null
}

export function onlineArtworkLabel(id: string | null | undefined): string | null {
  const icon = parseOnlineArtworkID(id)
  return icon ? icon.provider === "fluent" ? `Fluent · ${icon.name.replace(/-/g, " ")}` : `Icons8 · ${icon.name}` : null
}
