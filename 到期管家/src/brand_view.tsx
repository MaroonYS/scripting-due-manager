// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { Button, Image, Label, List, NavigationLink, Picker, Script, Section, Text, TextField, VStack, useEffect, useState } from "scripting"
import { BRAND_CATALOG } from "./brand_catalog"
import { BRAND_ASSETS, brandAsset, loadBrandLogo } from "./brand_assets"
import { inferItemBrand, itemBrandChoice, type SmallWidgetIconStyle } from "./brand_preferences"
import { loadState, manualItemsForDisplay, updateItemBrandChoice, updateSettings } from "./storage"
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
  const [busy, setBusy] = useState(false)
  const [gate] = useState(() => ({ busy: false }))
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
  const setStyle = async (style: SmallWidgetIconStyle) => {
    if (gate.busy) return
    gate.busy = true; setBusy(true)
    try { changed(updateSettings({ smallWidgetIconStyle: style })); await refreshBrandWidgets() }
    catch (error) { await Dialog.alert({ title: "图标设置未保存", message: String(error) }) }
    finally { gate.busy = false; setBusy(false) }
  }
  return <List listStyle="insetGroup" navigationTitle="小组件图标" navigationBarTitleDisplayMode="inline">
    <Section footer={<Text>仅改变小号组件当前事项的主图标。点击主图标仍是“完成事项”，不会打开品牌 App；标题保留原来的详情跳转。底部预告、中号和大号仍用系统图标。</Text>}>
      <Picker title="图标样式" value={state.settings.smallWidgetIconStyle ?? "system"} pickerStyle="menu" disabled={busy}
        onChanged={(value: unknown) => { if (value === "system" || value === "brand") void setStyle(value) }}>
        <Text tag="system">系统图标</Text>
        <Text tag="brand">品牌 Logo 优先</Text>
      </Picker>
      <Text font="caption" foregroundStyle="secondaryLabel">旧设置默认不变。缺失素材、无法识别、只读或过期缓存均回退系统图标；手动选过的系统图标会保留，除非再明确指定品牌。</Text>
    </Section>
    <Section header={<Text>逐项选择</Text>} footer={<Text>{message}</Text>}>
      {items.length === 0 ? <Text foregroundStyle="secondaryLabel">暂无可设置的事项</Text> : items.map(item => {
        const choice = itemBrandChoice(state.settings, item)
        const selected = BRAND_CATALOG.find(brand => brand.id === choice)
        const automatic = !item.iconIsExplicit ? inferItemBrand(item.title) : null
        const summary = choice === "system" ? "固定系统图标" : selected?.name ?? (choice ? "未知品牌 · 系统回退" : automatic ? `自动 · ${automatic.name}` : "自动 · 系统图标")
        const matched = choice === "system" ? null : choice ? selected : automatic
        const fallback = matched && !brandAsset(matched.id) ? " · 未内置 Logo，系统回退" : item.stale || !item.canComplete ? " · 缓存／只读，系统图标" : ""
        return <NavigationLink key={`${item.source}:${item.id}`} destination={<BrandChoiceView item={item} onChanged={changed} />}>
          <VStack alignment="leading" spacing={3}>
            <Text>{item.title || "未命名事项"}</Text>
            <Text font="caption" foregroundStyle="secondaryLabel">{summary}{fallback}{state.settings.smallWidgetIconStyle !== "brand" ? " · 系统模式" : ""}</Text>
          </VStack>
        </NavigationLink>
      })}
    </Section>
    <Section header={<Text>素材与品牌</Text>} footer={<Text>品牌及商标属于各自权利人，仅用于识别你的事项，不表示合作、背书或支付安全保证。不会读取 SIM、联系人或上传事项。</Text>}>
      <Text>{`${BRAND_CATALOG.length} 个品牌选项 · ${BRAND_ASSETS.length} 个已内置官方 Logo`}</Text>
      <Text font="caption" foregroundStyle="secondaryLabel">品牌清单不等于 Logo 素材库。尚未内置的选择会保留，但目前显示系统图标。</Text>
      <NavigationLink destination={<BrandCatalogView />}><Label title="浏览品牌与素材状态" systemImage="square.grid.2x2" /></NavigationLink>
    </Section>
  </List>
}

function BrandChoiceView({ item, onChanged }: { item: DisplayDueItem; onChanged: (state: AppState) => void }) {
  const [choice, setChoice] = useState(() => itemBrandChoice(loadState().settings, item))
  const [busy, setBusy] = useState(false)
  const [gate] = useState(() => ({ busy: false }))
  const save = async (brandID: string | null) => {
    if (gate.busy) return
    gate.busy = true; setBusy(true)
    try { const next = updateItemBrandChoice(item, brandID); setChoice(brandID); onChanged(next); await refreshBrandWidgets() }
    catch (error) { await Dialog.alert({ title: "品牌选择未保存", message: String(error) }) }
    finally { gate.busy = false; setBusy(false) }
  }
  return <BrandCatalogView title={item.title || "事项品牌"} choice={choice} busy={busy} onSelect={brandID => { void save(brandID) }} />
}

function BrandCatalogView({ title = "品牌与素材", choice, busy = false, onSelect }: {
  title?: string; choice?: string | null; busy?: boolean; onSelect?: (brandID: string | null) => void
}) {
  const [search, setSearch] = useState("")
  const query = search.trim().toLocaleLowerCase()
  const matches = BRAND_CATALOG.filter(brand => `${brand.name} ${brand.group}`.toLocaleLowerCase().includes(query))
  const groups = [...new Set(matches.map(brand => brand.group))]
  return <List listStyle="insetGroup" navigationTitle={title} navigationBarTitleDisplayMode="inline">
    <Section footer={<Text>选中只保存图标偏好，不会完成事项。需要在上一页开启“品牌 Logo 优先”才生效。</Text>}>
      <TextField title="搜索" prompt="品牌、银行、运营商、汽车、订阅" value={search} onChanged={setSearch} />
      {onSelect ? <Button title={`${choice == null ? "✓ " : ""}自动识别／系统回退`} disabled={busy} action={() => onSelect(null)} /> : null}
      {onSelect ? <Button title={`${choice === "system" ? "✓ " : ""}固定使用系统图标`} disabled={busy} action={() => onSelect("system")} /> : null}
    </Section>
    {groups.map(group => <Section key={group} header={<Text>{group}</Text>}>
      {matches.filter(brand => brand.group === group).map(brand => {
        const logo = loadBrandLogo(brandAsset(brand.id), Script.directory)
        const label = `${choice === brand.id ? "✓ " : ""}${brand.name}`
        const content = <VStack alignment="leading" spacing={3}>
            {logo ? <VStack frame={{ width: 40, height: 40 }}><Image image={logo.image} resizable scaleToFit renderingMode="original" frame={{ width: logo.size, height: logo.size }} /></VStack> : null}
            <Text>{label}</Text>
            <Text font="caption" foregroundStyle="secondaryLabel">{logo ? "已内置官方 Logo" : "暂无可用素材 · 系统图标回退"}</Text>
          </VStack>
        return onSelect
          ? <Button key={brand.id} disabled={busy} action={() => onSelect(brand.id)}>{content}</Button>
          : <VStack key={brand.id} alignment="leading">{content}</VStack>
      })}
    </Section>)}
    {matches.length === 0 ? <Section><Text>没有匹配品牌</Text></Section> : null}
  </List>
}
