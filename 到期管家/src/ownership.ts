// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

export const COPYRIGHT_NOTICE = "© 2026 MaroonYS · 保留权利"
export const LICENSE_ID = "LicenseRef-Due-Manager-Personal-Use-1.0"
export const OFFICIAL_REPOSITORY_URL = "https://github.com/MaroonYS/scripting-due-manager"
export const OFFICIAL_RELEASES_URL = `${OFFICIAL_REPOSITORY_URL}/releases`
export const PERSONAL_USE_NOTICE = "允许个人非商业安装、运行、更新、必要备份及分享官方链接。"
export const REUSE_RESTRICTION_NOTICE = "未经书面许可，禁止摘取再用、改名冒充、去除署名、转载、重新打包、二次分发及商业使用。"
export const RIGHTS_EXCEPTION_NOTICE = "仅限依法可受保护且有权授权的部分；法定例外、GitHub 平台已有授权、第三方权利及有效的先前许可不受影响。"

/** Link to the terms shipped with this version; do not silently show newer terms. */
export function releaseNoticeURL(version: string, file: "LICENSE" | "NOTICE.md"): string | null {
  if (!/^\d+\.\d+\.\d+$/.test(version)) return null
  return `${OFFICIAL_REPOSITORY_URL}/blob/v${version}/${file}`
}
