// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. Third-party artwork retains its own rights.

/** Fit the complete image inside a responsive, proportionally padded square. */
export function artworkFrame(size: number, width: number | undefined, height: number | undefined, adaptive = false) {
  const side = Number.isFinite(size) ? Math.max(8, Math.min(256, size)) : 24
  const inset = adaptive ? Math.max(1, side * 0.075) : 0
  const available = side - inset * 2
  const ratio = width && height && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? width / height : 1
  return { side, width: ratio >= 1 ? available : available * ratio, height: ratio >= 1 ? available / ratio : available }
}
