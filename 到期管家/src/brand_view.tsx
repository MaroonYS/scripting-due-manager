// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { Button, Image, Label, List, NavigationLink, Picker, Script, Section, Text, TextField, VStack, useEffect, useState } from "scripting"
import { BRAND_CATALOG } from "./brand_catalog"
import { BRAND_ASSETS, brandAsset, brandLogoStatusText } from "./brand_assets"
import { useBrandLogo } from "./brand_loading"
import { BrandLogo } from "./brand_logo"
import { itemBrandChoice } from "./brand_preferences"
import { loadState, manualItemsForDisplay, updateItemBrandChoice } from "./storage"
import { loadWidgetData } from "./widget_data"
import { reloadWidgetsAfterStorageWrite } from "./widget_refresh"
import type { AppState, DisplayDueItem } from "./types"

async function refreshBrandWidgets() {
  try { await reloadWidgetsAfterStorageWrite() }
  catch (error) { await Dialog.alert({ title: "设置已保存", message: `组件刷新请求失败，请稍后手动刷新。${String(error)}` }) }
}

export function BrandSettingsView({ onChanged }: { onChanged: (state: AppState) => void }) {
  const [state, setState] = useState(loadState)
  const [items, setItems] = useState(() => manualItemsForDisplay(state))
  const [message, setMessage] = useState("正在读取当前事项…")
  useEffect(() => {
    let active = true
    void loadWidgetData().then(data => {
      if (!active) return
      setState(data.state)
      setItems(data.items)
      setMessage(data.reminderResult.error ?? "只列出当前组件范围内的事项；选择品牌不会修改或完成事项。")
    }).catch(error => { if (active) setMessage(`读取未完成：${String(error)}`) })
    return () => { active = false }
  }, [])
  const changed = (next: AppState) => { setState(next); onChanged(next) }
  return <List listStyle="insetGroup" navigationTitle="事项图标" navigationBarTitleDisplayMode="inline">
    <Section footer={<Text>系统图标与品牌 Logo 按事项独立任选，可以混合使用。主界面与小号组件遵循同一选择，不需要全局开关。左图标完成事项，文字查看详情，不会打开品牌 App；底部预告、中号和大号仍用系统图标。</Text>}>
      <Text>每个事项，单独选择</Text>
      <Text font="caption" foregroundStyle="secondaryLabel">已明确选择的品牌会保留，未指定品牌的事项使用系统图标。更改一项不影响其他事项；缺失素材、图片读取失败、只读或过期缓存均回退系统图标。</Text>
    </Section>
    <Section header={<Text>逐项选择</Text>} footer={<Text>{message}</Text>}>
      {items.length === 0 ? <Text foregroundStyle="secondaryLabel">暂无可设置的事项</Text> : items.map(item => {
        const choice = itemBrandChoice(state.settings, item)
        const selected = BRAND_CATALOG.find(brand => brand.id === choice)
        const summary = choice === "system" || choice === null ? "系统图标" : selected ? `品牌 Logo · ${selected.name}` : "未知品牌 · 系统回退"
        const fallback = selected && !brandAsset(selected.id) ? " · 未内置 Logo，系统回退" : item.stale || !item.canComplete ? " · 缓存／只读，系统图标" : ""
        return <NavigationLink key={`${item.source}:${item.id}`} destination={<BrandChoiceView item={item} onChanged={changed} />}>
          <VStack alignment="leading" spacing={3}>
            <Text>{item.title || "未命名事项"}</Text>
            <Text font="caption" foregroundStyle="secondaryLabel">{summary}{fallback}</Text>
          </VStack>
        </NavigationLink>
      })}
    </Section>
    <Section header={<Text>素材与品牌</Text>} footer={<Text>品牌及商标属于各自权利人，仅用于识别你的事项，不表示合作、背书或支付安全保证。不会读取 SIM、联系人或上传事项。</Text>}>
      <Text>{`${BRAND_CATALOG.length} 个品牌 · ${BRAND_ASSETS.length} 个已内置 Logo`}</Text>
      <Text font="caption" foregroundStyle="secondaryLabel">图片随安装包内置，离线可用，等比显示完整图案，不强制圆形裁剪或抠除原有背景。来源包括品牌网站、对应官方 App 图标和署名图标库；不代表品牌授权或背书。编辑事项的“选择图标”也可直接选择品牌。</Text>
      <NavigationLink destination={<BrandCatalogView />}><Label title="浏览品牌与素材状态" systemImage="square.grid.2x2" /></NavigationLink>
    </Section>
  </List>
}

function BrandChoiceView({ item, onChanged }: { item: DisplayDueItem; onChanged: (state: AppState) => void }) {
  const [choice, setChoice] = useState(() => itemBrandChoice(loadState().settings, item))
  const [mode, setMode] = useState<"system" | "brand">(() => choice && choice !== "system" ? "brand" : "system")
  const [busy, setBusy] = useState(false)
  const [gate] = useState(() => ({ busy: false }))
  const save = async (brandID: string | null) => {
    if (gate.busy) return
    gate.busy = true; setBusy(true)
    try {
      const next = updateItemBrandChoice(item, brandID)
      setChoice(brandID); setMode(brandID && brandID !== "system" ? "brand" : "system")
      onChanged(next); await refreshBrandWidgets()
    }
    catch (error) { await Dialog.alert({ title: "品牌选择未保存", message: String(error) }) }
    finally { gate.busy = false; setBusy(false) }
  }
  const modePicker = <Picker title="图标类别" value={mode} pickerStyle="segmented" disabled={busy}
    onChanged={(value: unknown) => { if (value === "system" || value === "brand") setMode(value) }}>
    <Text tag="system">系统图标</Text>
    <Text tag="brand">品牌 Logo</Text>
  </Picker>
  if (mode === "brand") return <BrandCatalogView title={item.title || "事项图标"} choice={choice} busy={busy}
    topContent={modePicker} onSelect={brandID => { void save(brandID) }} />
  return <List listStyle="insetGroup" navigationTitle={item.title || "事项图标"} navigationBarTitleDisplayMode="inline">
    <Section>{modePicker}</Section>
    <Section footer={<Text>沿用本事项现有的系统图标；手动事项可在编辑页的“选择图标”挑选具体符号。只影响此事项，不会清空其他事项的选择。</Text>}>
      <Label title="本事项的系统图标" systemImage={item.iconName} />
      <Button title={`${choice === null || choice === "system" ? "✓ " : ""}使用系统图标`} disabled={busy} action={() => { void save("system") }} />
    </Section>
  </List>
}

export function BrandCatalogView({ title = "品牌与素材", choice, busy = false, onSelect, topContent, selectionHint }: {
  title?: string; choice?: string | null; busy?: boolean; onSelect?: (brandID: string | null) => void
  topContent?: JSX.Element; selectionHint?: string
}) {
  const [search, setSearch] = useState("")
  const [group, setGroup] = useState("")
  const [page, setPage] = useState(0)
  const pageSize = 32
  const query = search.trim().toLocaleLowerCase()
  const matches = BRAND_CATALOG.filter(brand => (!group || brand.group === group) && `${brand.name} ${brand.group}`.toLocaleLowerCase().includes(query))
  const visible = matches.slice(page * pageSize, (page + 1) * pageSize)
  const groups = [...new Set(BRAND_CATALOG.map(brand => brand.group))]
  return <List listStyle="insetGroup" navigationTitle={title} navigationBarTitleDisplayMode="inline">
    {topContent ? <Section>{topContent}</Section> : null}
    <Section footer={<Text>{selectionHint ?? "选择只影响本事项，不会完成事项。主界面与小号组件使用同一选择，无需开启全局品牌模式；未指定品牌时使用系统图标。"}</Text>}>
      <TextField title="搜索" prompt="品牌、银行、运营商、汽车、订阅" value={search} onChanged={(value: string) => { setSearch(value); setPage(0) }} />
      <Picker title="品牌分类" value={group} pickerStyle="menu" onChanged={(value: string) => { setGroup(value); setPage(0) }}>
        <Text tag="">全部品牌</Text>
        {groups.map(group => <Text key={group} tag={group}>{group}</Text>)}
      </Picker>
      {onSelect ? <Button title={`${choice == null || choice === "system" ? "✓ " : ""}使用本事项的系统图标`} disabled={busy} action={() => onSelect("system")} /> : null}
    </Section>
    {[...new Set(visible.map(brand => brand.group))].map(group => <Section key={group} header={<Text>{group}</Text>}>
      {visible.filter(brand => brand.group === group).map(brand => <BrandCatalogRow key={brand.id}
        brand={brand} selected={choice === brand.id} busy={busy} onSelect={onSelect} />)}
    </Section>)}
    {matches.length > pageSize ? <Section footer={<Text>每页最多加载 32 个图标，搜索和分类会回到第一页。</Text>}>
      <Text>{`第 ${page + 1} / ${Math.ceil(matches.length / pageSize)} 页 · ${matches.length} 个匹配品牌`}</Text>
      {page > 0 ? <Button title="上一页" action={() => setPage(page - 1)} /> : null}
      {(page + 1) * pageSize < matches.length ? <Button title="下一页" action={() => setPage(page + 1)} /> : null}
    </Section> : null}
    {matches.length === 0 ? <Section><Text>没有匹配品牌</Text></Section> : null}
  </List>
}

function BrandCatalogRow({ brand, selected, busy, onSelect }: {
  brand: (typeof BRAND_CATALOG)[number]; selected: boolean; busy: boolean
  onSelect?: (brandID: string | null) => void
}) {
  const image = useBrandLogo(brandAsset(brand.id), Script.directory)
  const { logo, status } = image.inspection
  const content = <VStack alignment="leading" spacing={3}>
    <VStack frame={{ width: 40, height: 40 }}>
      {logo ? <BrandLogo logo={logo} /> : <Image systemName="photo" foregroundStyle="secondaryLabel" />}
    </VStack>
    <Text>{`${selected ? "✓ " : ""}${brand.name}`}</Text>
    <Text font="caption" foregroundStyle="secondaryLabel">{brandLogoStatusText(status)}</Text>
  </VStack>
  return <VStack alignment="leading" onAppear={image.onAppear} onDisappear={image.onDisappear}>
    {onSelect ? <Button disabled={busy} action={() => onSelect(brand.id)}>{content}</Button> : content}
  </VStack>
}
