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
    <Section header={<Text>系统图标</Text>}>
      <Text>本版本只使用 Apple SF Symbols，不再内置或连接第三方图标库。Apple 与 Scripting 的名称、系统符号及相应权利仍属于各自权利人。</Text>
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
