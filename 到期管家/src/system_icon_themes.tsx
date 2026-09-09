// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { Button, DisclosureGroup, HStack, Image, Section, Spacer, Text, TextField, useState } from "scripting"
import { DUE_ICON_GROUPS, DUE_ICON_OPTIONS, searchSystemIcons } from "./icons"

/** Shared by manual and imported-reminder pickers; all themes start collapsed. */
export function SystemIconThemes({ value, onChanged }: { value: string | null; onChanged: (name: string) => void }) {
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<string[]>([])
  const searching = query.trim().length > 0
  const matches = searchSystemIcons(query)
  const groups = DUE_ICON_GROUPS.map(group => ({ group, icons: matches.filter(icon => icon.group === group) })).filter(row => row.icons.length)
  const allExpanded = expanded.length === DUE_ICON_GROUPS.length
  return <Section header={<Text>按主题选择 · {DUE_ICON_OPTIONS.length} 个系统图标</Text>}
    footer={<Text>点主题展开；搜索支持中文、英文及 SF Symbol 名称。所有匹配均在本机完成。</Text>}>
    <TextField title="搜索系统图标" prompt="例如：银行、钱包、music" value={query} onChanged={setQuery} />
    {!searching ? <Button title={allExpanded ? "收起全部主题" : "展开全部主题"}
      action={() => setExpanded(allExpanded ? [] : [...DUE_ICON_GROUPS])} /> : null}
    {groups.map(({ group, icons }) => {
      const isExpanded = searching || expanded.includes(group)
      return <DisclosureGroup key={group} title={`${group} · ${icons.length}`}
        isExpanded={isExpanded} onChanged={(open: boolean) => {
          if (!searching) setExpanded(current => open ? [...new Set([...current, group])] : current.filter(name => name !== group))
        }}>
        {isExpanded ? icons.map(icon => <Button key={icon.name} buttonStyle="plain" action={() => onChanged(icon.name)}>
          <HStack spacing={12} frame={{ maxWidth: "infinity", minHeight: 32 }} contentShape="rect">
            <Image systemName={icon.name} foregroundStyle={icon.color} frame={{ width: 26 }} />
            <Text>{icon.label}</Text><Spacer />
            {value === icon.name ? <Image systemName="checkmark" foregroundStyle="systemBlue" /> : null}
          </HStack>
        </Button>) : null}
      </DisclosureGroup>
    })}
    {!matches.length ? <Text foregroundStyle="secondaryLabel">没有匹配的系统图标，请换一个关键词。</Text> : null}
  </Section>
}
