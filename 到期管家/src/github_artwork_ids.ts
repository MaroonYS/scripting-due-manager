// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. Third-party artwork retains its own rights.

/** Only public GitHub files: no credentials, redirects, query strings or private hosts. */
export function githubFileURL(value: unknown, kind: "manifest" | "image"): string | null {
  if (typeof value !== "string" || value.length > 1024 || /[\u0000-\u0020\u007f\\?#]/.test(value)) return null
  const match = /^https:\/\/(raw\.githubusercontent\.com|github\.com|cdn\.jsdelivr\.net)\/(.+)$/i.exec(value)
  if (!match) return null
  try {
    let segments = match[2].split("/").map(part => decodeURIComponent(part))
    if (match[1].toLowerCase() === "github.com") {
      if (segments[2] !== "blob" && segments[2] !== "raw") return null
      segments.splice(2, 1)
    } else if (match[1].toLowerCase() === "cdn.jsdelivr.net") {
      if (segments.shift() !== "gh") return null
      const revision = segments[1]?.split("@")
      if (!revision || revision.length > 2) return null
      segments.splice(1, 1, revision[0], revision[1] ?? "HEAD")
    }
    if (segments.length < 4 || !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,99}$/.test(segments[0])
      || !/^[a-zA-Z0-9_.-]{1,100}$/.test(segments[1])
      || segments.some(part => !part || part === "." || part === ".." || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069/\\%?#:]/.test(part))) return null
    const filename = segments[segments.length - 1]
    if (!(kind === "manifest" ? /\.json$/i : /\.(?:png|svg)$/i).test(filename)) return null
    const canonical = "https://raw.githubusercontent.com/" + segments.map(part => encodeURIComponent(part)).join("/")
    return canonical.length <= 1024 ? canonical : null
  } catch { return null }
}

const PREFIX = "github-artwork:"
export function githubArtworkID(url: string): string | null {
  const canonical = githubFileURL(url, "image")
  return canonical ? PREFIX + encodeURIComponent(canonical) : null
}
export function parseGithubArtworkID(id: unknown): string | null {
  if (typeof id !== "string" || !id.startsWith(PREFIX) || id.length > 3200) return null
  try {
    const url = githubFileURL(decodeURIComponent(id.slice(PREFIX.length)), "image")
    return url && githubArtworkID(url) === id ? url : null
  } catch { return null }
}
export function githubArtworkLabel(id: unknown): string | null {
  const url = parseGithubArtworkID(id)
  return url ? `GitHub · ${decodeURIComponent(url.split("/").pop()!).replace(/\.(png|svg)$/i, "").replace(/[-_]/g, " ").slice(0, 80)}` : null
}
