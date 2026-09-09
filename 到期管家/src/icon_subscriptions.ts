// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. Third-party artwork retains its own rights.

import { githubFileURL } from "./github_artwork_ids"

export interface IconSubscription { name: string; url: string; enabled: boolean }
export const MAX_ICON_SUBSCRIPTIONS = 12
export const DEFAULT_ICON_SUBSCRIPTIONS: readonly IconSubscription[] = [
  { name: "恩秀 App", url: "https://raw.githubusercontent.com/sooyaaabo/IconLibrary/main/App-Icon.json", enabled: true },
  { name: "恩秀 Emby", url: "https://raw.githubusercontent.com/sooyaaabo/IconLibrary/main/Emby-Icon.json", enabled: true },
  { name: "selfh.st", url: "https://raw.githubusercontent.com/selfhst/icons/main/index.json", enabled: true },
  { name: "Bank Logos · 银行", url: "https://raw.githubusercontent.com/MaroonYS/scripting-due-manager/main/catalogs/bank-logos.json", enabled: true },
  { name: "Simple Icons · 单色品牌", url: "https://raw.githubusercontent.com/simple-icons/simple-icons/develop/data/simple-icons.json", enabled: true },
  { name: "Dashboard Icons · 应用", url: "https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/metadata.json", enabled: true },
]
export function normalizeIconSubscriptions(raw: unknown): IconSubscription[] {
  if (!Array.isArray(raw) || raw.length > MAX_ICON_SUBSCRIPTIONS) throw Error("图库订阅格式无效或超过 12 个，原设置已保留。")
  const seen = new Set<string>()
  return raw.map(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("图库订阅格式无效。")
    const url = githubFileURL(value.url, "manifest")
    if (!url || typeof value.name !== "string" || !value.name.trim() || value.name.length > 60
      || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(value.name)
      || typeof value.enabled !== "boolean") throw Error("请使用公开的 GitHub Raw／jsDelivr JSON 链接，不可含密钥、查询参数或片段。")
    if (seen.has(url)) throw Error("这个图库链接已经添加。")
    seen.add(url)
    return { name: value.name.trim(), url, enabled: value.enabled }
  })
}
export function iconSubscriptions(settings: { iconSubscriptions?: IconSubscription[] }): IconSubscription[] {
  return normalizeIconSubscriptions(settings.iconSubscriptions ?? DEFAULT_ICON_SUBSCRIPTIONS)
}
