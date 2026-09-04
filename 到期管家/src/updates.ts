export const LATEST_PACKAGE_URL = "https://github.com/MaroonYS/scripting-due-manager/releases/latest/download/due-manager.scripting"
const RELEASE_API_URL = "https://api.github.com/repos/MaroonYS/scripting-due-manager/releases/latest"
const RELEASE_BASE_URL = "https://github.com/MaroonYS/scripting-due-manager/releases"

export interface ReleaseInfo {
  version: string
  tag: string
  packageURL: string
  pageURL: string
  notes: string
  publishedAt: string | null
}

function versionParts(value: string): number[] {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value.trim())
  if (!match) throw new Error("版本号格式无效，无法安全比较版本。")
  const parts = match.slice(1).map(Number)
  if (!parts.every(Number.isSafeInteger)) throw new Error("版本号超出有效范围。")
  return parts
}

export function compareVersions(left: string, right: string): number {
  const a = versionParts(left)
  const b = versionParts(right)
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1
  }
  return 0
}

/** Never follow an arbitrary asset URL or install a draft/prerelease response. */
export function parseReleaseInfo(value: unknown): ReleaseInfo {
  if (!value || typeof value !== "object") throw new Error("更新信息格式不正确。")
  const data = value as Record<string, unknown>
  if (data.draft !== false || data.prerelease !== false || typeof data.tag_name !== "string") {
    throw new Error("没有可安装的正式版本。")
  }
  const version = versionParts(data.tag_name).join(".")
  const tag = `v${version}`
  if (data.tag_name !== tag) throw new Error("发行标签格式不正确。")
  const packageURL = `${RELEASE_BASE_URL}/download/${tag}/due-manager.scripting`
  const assets = Array.isArray(data.assets) ? data.assets : []
  if (!assets.some(asset => asset && typeof asset === "object"
    && asset.name === "due-manager.scripting"
    && asset.browser_download_url === packageURL
    && asset.state === "uploaded"
    && typeof asset.size === "number" && asset.size > 0)) {
    throw new Error("最新版本尚无完整安装包，请稍后重试。")
  }
  return {
    version,
    tag,
    packageURL,
    pageURL: `${RELEASE_BASE_URL}/tag/${tag}`,
    notes: typeof data.body === "string" && data.body.trim()
      ? data.body.trim().slice(0, 8000)
      : "此版本未提供更新说明。",
    publishedAt: typeof data.published_at === "string" && Number.isFinite(Date.parse(data.published_at))
      ? data.published_at : null,
  }
}

export async function checkLatestRelease(): Promise<ReleaseInfo> {
  const response = await fetch(`${RELEASE_API_URL}?t=${Date.now()}`, {
    headers: { Accept: "application/vnd.github+json", "Cache-Control": "no-cache" },
    timeout: 15,
  })
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new Error("GitHub 暂时限制了检查次数，请稍后重试；当前版本仍可正常使用。")
    }
    throw new Error(`检查更新失败（HTTP ${response.status}），请检查网络后重试。`)
  }
  return parseReleaseInfo(await response.json())
}

export function freshPackageURL(release: ReleaseInfo, currentVersion: string, now = Date.now()): string {
  if (compareVersions(release.version, currentVersion) <= 0) {
    throw new Error("当前版本已是最新，已阻止重复安装或降级。")
  }
  const expectedURL = `${RELEASE_BASE_URL}/download/v${versionParts(release.version).join(".")}/due-manager.scripting`
  if (release.packageURL !== expectedURL) throw new Error("更新地址不属于已核验的发行包。")
  return `${expectedURL}?from=${encodeURIComponent(currentVersion)}&t=${Math.trunc(now)}`
}
