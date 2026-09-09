// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. Third-party artwork retains its own rights.

import { Button, HStack, Image, LazyVGrid, Link, List, Navigation, Picker, RoundedRectangle, Script, Section, Spacer, Text, TextField, VStack, ZStack, useEffect, useState } from "scripting"
import { ARTWORK_CATALOG, ARTWORK_GROUPS, ARTWORK_PAGE_SIZE, ARTWORK_STYLE, artworkByID, searchArtwork } from "./artwork_catalog"
import { loadArtworkPage } from "./artwork_assets"
import type { LoadedArtwork } from "./artwork_assets"
import { ArtworkImage } from "./artwork_image"

export function ArtworkBrowser({ selectedID = null, onSelected }: { selectedID?: string | null; onSelected?: (id: string) => void }) {
  const dismiss = Navigation.useDismiss()
  const [query, setQuery] = useState("")
  const [group, setGroup] = useState("全部")
  const [page, setPage] = useState(0)
  const [previewID, setPreviewID] = useState<string | null>(selectedID)
  const [loaded, setLoaded] = useState<{ key: string; images: Record<string, LoadedArtwork> }>({ key: "", images: {} })
  const results = searchArtwork(query, group)
  const totalPages = Math.max(1, Math.ceil(results.length / ARTWORK_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const visible = results.slice(currentPage * ARTWORK_PAGE_SIZE, (currentPage + 1) * ARTWORK_PAGE_SIZE)
  const pageKey = visible.map(icon => icon.id).join(",")
  const images = loaded.key === pageKey ? loaded.images : {}
  useEffect(() => {
    let active = true
    void loadArtworkPage(visible.map(icon => icon.id), Script.directory).then(images => {
      if (active) setLoaded({ key: pageKey, images })
    })
    return () => { active = false }
  }, [pageKey])
  const preview = artworkByID(previewID)

  return <List listStyle="insetGroup" navigationTitle={onSelected ? "选择彩色图标" : "预览彩色图库"} navigationBarTitleDisplayMode="inline">
    <Section footer={<Text>{onSelected ? "为当前事项独立选择；不会更改其他事项。返回事项编辑页并保存后生效。" : "此页仅预览，不会改变任何事项。请在事项的「图标」页面选择。"} 图标保持原始颜色及比例，全部内置、可离线使用。</Text>}>
      <VStack alignment="leading" spacing={5} padding={{ vertical: 5 }}>
        <Text font="headline">{ARTWORK_STYLE}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel">{ARTWORK_CATALOG.length} 枚应用、品牌及生活图标 · {ARTWORK_GROUPS.length} 个分类</Text>
      </VStack>
      <TextField title="搜索" value={query} prompt="应用名称或中文关键词" onChanged={(value: string) => { setQuery(value); setPage(0) }} />
      <Picker title="分类" value={group} pickerStyle="menu" onChanged={(value: unknown) => {
        if (typeof value === "string" && (value === "全部" || ARTWORK_GROUPS.includes(value))) { setGroup(value); setPage(0) }
      }}>
        {["全部", ...ARTWORK_GROUPS].map(name => <Text key={name} tag={name}>{name}</Text>)}
      </Picker>
      {preview ? <HStack spacing={10}>
        <Text foregroundStyle="secondaryLabel">{onSelected ? "当前选择" : "预览选中"}</Text>
        <Spacer />
        <Text lineLimit={2}>{preview.label}</Text>
      </HStack> : null}
    </Section>
    <Section header={<Text>{results.length ? `${results.length} 个结果 · 第 ${currentPage + 1} / ${totalPages} 页` : "没有找到匹配图标"}</Text>}>
      {results.length ? <LazyVGrid columns={[{ size: { type: "adaptive", min: 74, max: 115 }, spacing: 8 }]} spacing={8} padding={{ vertical: 6 }}>
        {visible.map(icon => {
          const selected = icon.id === previewID, image = images[icon.id]
          return <Button key={icon.id} buttonStyle="plain" action={() => {
            setPreviewID(icon.id)
            if (onSelected) { onSelected(icon.id); dismiss() }
          }}>
            <ZStack frame={{ maxWidth: "infinity", height: 100 }} contentShape="rect">
              <RoundedRectangle cornerRadius={12}
                fill={selected ? { light: "#E8F2FF", dark: "#17334F" } : "secondarySystemGroupedBackground"}
                stroke={selected ? { shapeStyle: "systemBlue", strokeStyle: { lineWidth: 1.5 } } : undefined} />
              <VStack spacing={7} padding={7} frame={{ maxWidth: "infinity" }}>
                {image ? <ArtworkImage image={image} size={32} /> : <Image systemName={loaded.key === pageKey ? "photo.badge.exclamationmark" : "photo"} foregroundStyle="tertiaryLabel" frame={{ width: 32, height: 32 }} />}
                <Text font={11} foregroundStyle="label" lineLimit={2} minScaleFactor={0.8} multilineTextAlignment="center" frame={{ maxWidth: "infinity", height: 29 }}>{icon.label}</Text>
              </VStack>
            </ZStack>
          </Button>
        })}
      </LazyVGrid> : <Text foregroundStyle="secondaryLabel">试试英文名称或其他关键词。此风格未收录的应用可以继续使用 SF Symbols。</Text>}
    </Section>
    {totalPages > 1 ? <Section>
      <HStack>
        <Button title="上一页" systemImage="chevron.left" disabled={currentPage === 0} action={() => setPage(currentPage - 1)} />
        <Spacer />
        <Text font="caption" foregroundStyle="secondaryLabel">{currentPage + 1} / {totalPages}</Text>
        <Spacer />
        <Button title="下一页" systemImage="chevron.right" disabled={currentPage + 1 >= totalPages} action={() => setPage(currentPage + 1)} />
      </HStack>
    </Section> : null}
    <Section footer={<Text>包含产品系列与少量图标变体，并不代表相同数量的独立 App。图片不可作为独立素材库再分发；各品牌商标归其权利人所有。</Text>}>
      <Link url="https://icons8.com/icons/fluency"><Text>图标由 Icons8 提供</Text></Link>
    </Section>
  </List>
}
