// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { Button, Image, LazyVGrid, Picker, Section, Text, TextField, VStack, useState } from "scripting"
import { DUE_ICON_GROUPS, DUE_ICON_OPTIONS, searchSystemIcons } from "./icons"

/** A small visible starting set, not another hidden catalog of 182 rows. */
export function recommendedSystemIcons(automaticName?: string, selectedName?: string | null) {
  const automatic = DUE_ICON_OPTIONS.find(icon => icon.name === automaticName)
  const names = [automaticName, selectedName,
    ...DUE_ICON_OPTIONS.filter(icon => icon.group === automatic?.group).map(icon => icon.name),
    "calendar.badge.clock", "repeat.circle.fill", "creditcard.fill", "checklist", "bell.fill", "tag.fill", "gift.fill", "heart.fill"]
  return [...new Set(names)].flatMap(name => {
    const icon = DUE_ICON_OPTIONS.find(candidate => candidate.name === name)
    return icon ? [icon] : []
  }).slice(0, 8)
}

/** Both entry points use the same searchable, single-category grid. */
export function SystemIconThemes({ value, automaticName, onChanged }: {
  value: string | null; automaticName?: string; onChanged: (name: string) => void
}) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("推荐")
  const [initialValue] = useState(value)
  const searching = query.normalize("NFKC").trim().length > 0
  const choices = searching ? searchSystemIcons(query)
    : category === "推荐" ? recommendedSystemIcons(automaticName, initialValue)
    : DUE_ICON_OPTIONS.filter(icon => icon.group === category)
  return <Section header={<Text>{searching ? `搜索结果 · ${choices.length}` : category === "推荐" ? "为此事项推荐" : `${category} · ${choices.length}`}</Text>}
    footer={<Text>{`点图标预览，再点右上角确认。搜索覆盖全部 ${DUE_ICON_OPTIONS.length} 个图标，支持中文、英文及 SF Symbol 名称；所有匹配均在本机完成。`}</Text>}>
    <TextField title="搜索图标" prompt="银行、钱包、music…" value={query} onChanged={setQuery} />
    {!searching ? <Picker title="浏览分类" value={category} onChanged={setCategory} pickerStyle="menu">
      <Text tag="推荐">为此事项推荐</Text>
      {DUE_ICON_GROUPS.map(group => <Text key={group} tag={group}>{group}</Text>)}
    </Picker> : null}
    {choices.length ? <LazyVGrid columns={[{ size: { type: "adaptive", min: 80 }, spacing: 12 }]} spacing={12}>
      {choices.map(icon => <Button key={icon.name} buttonStyle="plain" action={() => onChanged(icon.name)}>
        <VStack spacing={8} padding={{ vertical: 10, horizontal: 4 }} frame={{ maxWidth: "infinity", minHeight: 84 }} contentShape="rect">
          <Image systemName={icon.name} foregroundStyle={icon.color} font="title2" frame={{ height: 28 }} />
          <Text font="caption" foregroundStyle={value === icon.name ? "systemBlue" : "label"} lineLimit={2} multilineTextAlignment="center">
            {`${value === icon.name ? "✓ " : ""}${icon.label}`}
          </Text>
        </VStack>
      </Button>)}
    </LazyVGrid> : <Text foregroundStyle="secondaryLabel">没有匹配的系统图标，请换一个关键词。</Text>}
  </Section>
}
