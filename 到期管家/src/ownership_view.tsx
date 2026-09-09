// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { LabeledContent, Link, List, Script, Section, Text } from "scripting"
import {
  COPYRIGHT_NOTICE, LICENSE_ID, OFFICIAL_REPOSITORY_URL, OFFICIAL_RELEASES_URL,
  PERSONAL_USE_NOTICE, REUSE_RESTRICTION_NOTICE, RIGHTS_EXCEPTION_NOTICE, releaseNoticeURL,
} from "./ownership"

export function OwnershipView() {
  const licenseURL = releaseNoticeURL(Script.metadata.version, "LICENSE")
  const noticeURL = releaseNoticeURL(Script.metadata.version, "NOTICE.md")
  return <List listStyle="insetGroup" navigationTitle="版权与官方来源" navigationBarTitleDisplayMode="inline">
    <Section header={<Text>到期管家 / Due Manager</Text>}>
      <Text>{COPYRIGHT_NOTICE}</Text>
      <LabeledContent title="发行版本"><Text>{Script.metadata.version}</Text></LabeledContent>
      <Text font="caption" foregroundStyle="secondaryLabel">{LICENSE_ID}</Text>
      <Text>{PERSONAL_USE_NOTICE}</Text>
      <Text>{REUSE_RESTRICTION_NOTICE}</Text>
      <Text font="footnote" foregroundStyle="secondaryLabel">{RIGHTS_EXCEPTION_NOTICE}</Text>
      {licenseURL ? <Link url={licenseURL}><Text>查看此版本完整许可</Text></Link> : null}
      {noticeURL ? <Link url={noticeURL}><Text>查看此版本来源与第三方声明</Text></Link> : null}
    </Section>
    <Section header={<Text>第三方在线图库</Text>}>
      <Text>GitHub 预设引用 sooyaaabo/IconLibrary 的 App、Emby 清单及 selfh.st/icons 的公开索引；仅按需显示原图，不将整库素材打包分发。</Text>
      <Link url="https://github.com/sooyaaabo/IconLibrary"><Text>恩秀 IconLibrary · sooyaaabo · 作者说明</Text></Link>
      <Link url="https://github.com/selfhst/icons"><Text>Icons by selfh.st/icons · CC BY 4.0</Text></Link>
      <Link url="https://creativecommons.org/licenses/by/4.0/"><Text>selfh.st 图库许可 · 不改变第三方权利</Text></Link>
      <Text>Fluent Emoji Flat 由 Microsoft 提供，经 Iconify 在线加载，适用 MIT 许可；完整第三方许可随包附带。本项目的限制性许可不改变这些图案的 MIT 权利。</Text>
      <Text>Icons8 提供在线应用与生活图标，需要配置自己的 API Key；原有 Windows 11 Color 内置图案继续兼容已选事项。</Text>
      <Text font="footnote" foregroundStyle="secondaryLabel">Icons8 图案遵循其适用授权及 API 条款，本项目不授予独立素材提取、再许可或素材库再分发权。图案与商标归各权利人，不代表品牌背书。内置文件的来源与逐图哈希随包附带。</Text>
    </Section>
    <Section header={<Text>核对官方发行</Text>}
      footer={<Text>链接仅在点按时打开。本页不联网验证本机代码，不收集事项或设备信息，不设置授权锁。</Text>}>
      <Link url={OFFICIAL_REPOSITORY_URL}><Text>官方仓库 · MaroonYS</Text></Link>
      <Link url={OFFICIAL_RELEASES_URL}><Text>官方发行与校验文件</Text></Link>
      <Text>v2.5.9 起的官方发行提供 SHA-256 校验文件及 GitHub 签名来源证明，可按仓库说明在电脑核验下载包。复制本页文字不能证明安装包来自官方。</Text>
      <Text font="footnote" foregroundStyle="secondaryLabel">公开脚本无法保证绝不被复制。来源证明不等于版权登记；Apple、Scripting、系统符号及其他品牌权利仍属于各自权利人。</Text>
    </Section>
  </List>
}
