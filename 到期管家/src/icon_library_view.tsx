// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { Button, HStack, Image, List, NavigationLink, Picker, Section, Spacer, Text, TextField, Toggle, VStack, useEffect, useState } from "scripting"
import { indexItemIconChoices, indexedItemIconID, itemIconID, symbolChoice } from "./icon_preferences"
import type { IconSource } from "./icon_preferences"
import { resolveDueIcon } from "./icons"
import { SystemIconPicker } from "./system_icon_picker"
import { loadReminderItems } from "./reminders"
import { loadState, updateItemIconChoice, updateManualItemIcon } from "./storage"
import { reloadWidgetsAfterStorageWrite } from "./widget_refresh"
import type { AppSettings, AppState, DisplayDueItem, ManualDueItem } from "./types"

type IconRow = { source: "manual"; item: ManualDueItem } | { source: "reminder"; item: DisplayDueItem }
type SearchEntry = { row: IconRow; title?: string; note?: string; text?: string }
export interface IconRowSearchIndex {
  items: readonly ManualDueItem[]; reminders: readonly DisplayDueItem[]; includeReminders: boolean
  entries: SearchEntry[]
}

/** Per-view, lazy text index. It is never persisted or shared between users/views. */
export function createIconRowSearchIndex(state: AppState, reminders: DisplayDueItem[]): IconRowSearchIndex {
  return { items: state.items, reminders, includeReminders: state.settings.includeReminders, entries: [
    ...state.items.map(item => ({ row: { source: "manual" as const, item } })),
    ...(state.settings.includeReminders ? reminders.map(item => ({ row: { source: "reminder" as const, item } })) : []),
  ] }
}

function currentSearchIndex(index: IconRowSearchIndex, state: AppState, reminders: DisplayDueItem[]) {
  return index.items === state.items && index.reminders === reminders
    && index.includeReminders === state.settings.includeReminders
    && index.entries.length === state.items.length + (state.settings.includeReminders ? reminders.length : 0)
    && index.entries.every((entry, position) => entry.row.item === (position < state.items.length
      ? state.items[position] : reminders[position - state.items.length]))
}

function searchableText(entry: SearchEntry) {
  // Retain correctness even if an owning item is edited in place.
  const { title, note } = entry.row.item
  if (entry.text == null || entry.title !== title || entry.note !== note) {
    entry.title = title; entry.note = note
    entry.text = `${title} ${note}`.normalize("NFKC").toLowerCase()
  }
  return entry.text
}

function automaticIcon(row: IconRow) {
  return row.source === "manual" ? resolveDueIcon(row.item.title, row.item.kind)
    : resolveDueIcon("", "reminder", row.item.iconName)
}

export function iconRowAppearance(row: IconRow, settings: AppSettings) {
  const iconID = itemIconID(settings, row.source, row.item.id)
  const choice = symbolChoice(iconID)
  const legacy = row.source === "manual" ? row.item.iconName : null
  return { icon: choice ?? (legacy ? resolveDueIcon(row.item.title, row.item.kind, legacy) : automaticIcon(row)),
    explicit: iconID != null || legacy != null, unavailable: iconID != null && choice == null }
}

export function filterIconRows(state: AppState, reminders: DisplayDueItem[], query: string,
  source: IconSource | "all", mode: "all" | "automatic" | "explicit", showHidden: boolean,
  prepared?: IconRowSearchIndex): IconRow[] {
  const term = query.normalize("NFKC").toLowerCase().trim()
  const search = prepared && currentSearchIndex(prepared, state, reminders) ? prepared : createIconRowSearchIndex(state, reminders)
  const choices = mode === "all" ? null : indexItemIconChoices(state.settings)
  return search.entries.filter(entry => {
    const row = entry.row
    return (source === "all" || row.source === source)
    && (row.source !== "manual" || showHidden || row.item.enabled)
    && (!term || searchableText(entry).includes(term))
    && (choices == null || (indexedItemIconID(choices, row.source, row.item.id) != null
      || (row.source === "manual" && row.item.iconName != null)) === (mode === "explicit"))
  }).map(entry => entry.row)
}

export function IconLibraryView({ state, onChanged }: { state: AppState; onChanged: (state?: AppState) => void }) {
  const [current, setCurrent] = useState(state)
  const [reminders, setReminders] = useState<DisplayDueItem[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState("")
  const [source, setSource] = useState<IconSource | "all">("all")
  const [mode, setMode] = useState<"all" | "automatic" | "explicit">("all")
  const [showHidden, setShowHidden] = useState(false)
  const [page, setPage] = useState(0)
  const [searchCache] = useState(() => ({ index: createIconRowSearchIndex(current, reminders) }))
  const [lifecycle] = useState(() => ({ active: true }))
  useEffect(() => { lifecycle.active = true; return () => { lifecycle.active = false } }, [lifecycle])
  useEffect(() => { setCurrent(state) }, [state])
  const changed = (next?: AppState) => { if (!lifecycle.active) return; const latest = next ?? loadState(); setCurrent(latest); onChanged(latest) }
  const scope = JSON.stringify([current.settings.includeReminders, current.settings.reminderHorizonDays, current.settings.reminderCalendarIDs])
  useEffect(() => {
    let active = true
    setReminders([])
    if (!current.settings.includeReminders) { setLoading(false); setMessage(null); return }
    setLoading(true); setMessage(null)
    void loadReminderItems(current.settings.reminderHorizonDays, current.settings.reminderCalendarIDs).then(result => {
      if (!active) return
      setReminders(result.items); setLoading(false)
      setMessage(result.error ?? (result.fromCache ? "当前提醒事项来自本机缓存，可重新读取。" : null))
    }).catch(error => { if (active) { setLoading(false); setMessage(String(error)) } })
    return () => { active = false }
  }, [scope, attempt])
  if (!currentSearchIndex(searchCache.index, current, reminders)) searchCache.index = createIconRowSearchIndex(current, reminders)
  const rows = filterIconRows(current, reminders, query, source, mode, showHidden, searchCache.index)
  const pages = Math.max(1, Math.ceil(rows.length / 40)), currentPage = Math.min(page, pages - 1)
  const visible = rows.slice(currentPage * 40, (currentPage + 1) * 40)
  const emptyMessage = loading && source !== "manual" ? "正在读取提醒事项…"
    : !current.settings.includeReminders && source === "reminder" ? "请先在首页开启 Apple 提醒事项。"
    : query.trim() || mode !== "all" || source !== "all" ? "没有匹配的事项，请调整搜索或筛选条件。"
    : "暂无显示中的事项，可新增事项或开启已隐藏事项。"
  return <List listStyle="insetGroup" navigationTitle="事项图标" navigationBarTitleDisplayMode="inline">
    <Section footer={<Text>选择事项后只修改图标，不改日期或备注。自动匹配会跟随内容变化；手动指定会固定为所选图标。仅使用本机 SF Symbols。</Text>}>
      <TextField title="查找事项" value={query} prompt="事项名称或列表名称" onChanged={(value: string) => { setQuery(value); setPage(0) }} />
      <Picker title="事项来源" value={source} pickerStyle="segmented" onChanged={(value: IconSource | "all") => { setSource(value); setPage(0) }}>
        <Text tag="all">全部</Text><Text tag="manual">手动</Text><Text tag="reminder">提醒事项</Text>
      </Picker>
      <Picker title="图标方式" value={mode} pickerStyle="menu" onChanged={(value: "all" | "automatic" | "explicit") => { setMode(value); setPage(0) }}>
        <Text tag="all">全部方式</Text><Text tag="automatic">自动匹配</Text><Text tag="explicit">手动指定</Text>
      </Picker>
      <Toggle title="包含已完成或隐藏事项" value={showHidden} onChanged={(value: boolean) => { setShowHidden(value); setPage(0) }} />
    </Section>
    <Section header={<Text>{`选择事项 · ${rows.length}`}</Text>}>
      {visible.map(row => <NavigationLink key={JSON.stringify([row.source, row.item.id])}
        destination={<ItemIconEditor row={row} onChanged={changed} />}>
        <ItemIconLibraryRow row={row} settings={current.settings} />
      </NavigationLink>)}
      {!rows.length ? <Text foregroundStyle="secondaryLabel">{emptyMessage}</Text> : null}
    </Section>
    {pages > 1 ? <Section><HStack>
      <Button title="上一页" disabled={currentPage === 0} action={() => setPage(currentPage - 1)} />
      <Spacer /><Text>{currentPage + 1} / {pages}</Text><Spacer />
      <Button title="下一页" disabled={currentPage + 1 === pages} action={() => setPage(currentPage + 1)} />
    </HStack></Section> : null}
    {current.settings.includeReminders ? <Section header={<Text>提醒事项同步</Text>}>
      <Button title={loading ? "正在读取…" : "重新读取提醒事项"} disabled={loading} action={() => setAttempt(value => value + 1)} />
      {message ? <Text font="caption" foregroundStyle="secondaryLabel">{message}</Text> : null}
    </Section> : null}
  </List>
}

function ItemIconLibraryRow({ row, settings }: { row: IconRow; settings: AppSettings }) {
  const { icon, explicit, unavailable } = iconRowAppearance(row, settings)
  return <HStack spacing={12}>
    <Image systemName={icon.name} foregroundStyle={icon.color} frame={{ width: 26 }} />
    <VStack alignment="leading" spacing={3}>
      <Text lineLimit={2}>{row.item.title}</Text>
      <Text font="caption" foregroundStyle="secondaryLabel">{`${row.source === "manual" ? "手动事项" : "Apple 提醒事项"}${row.source === "manual" && !row.item.enabled ? " · 已隐藏" : ""} · ${explicit ? "手动指定" : "自动匹配"} · ${unavailable ? "旧图标不可用" : icon.label}`}</Text>
    </VStack>
  </HStack>
}

export function ItemIconEditor({ row, onChanged }: { row: IconRow; onChanged: (state?: AppState) => void }) {
  const [lifecycle] = useState(() => ({ active: true }))
  useEffect(() => { lifecycle.active = true; return () => { lifecycle.active = false } }, [lifecycle])
  const [initial] = useState(() => {
    const state = loadState()
    const item = row.source === "manual" ? state.items.find(item => item.id === row.item.id) : row.item
    if (!item) return null
    const iconID = itemIconID(state.settings, row.source, item.id)
    return { iconID, item, expectedUpdatedAt: row.source === "manual" ? (item as ManualDueItem).updatedAt : undefined,
      automatic: row.source === "manual" ? resolveDueIcon(item.title, (item as ManualDueItem).kind) : automaticIcon(row),
      value: symbolChoice(iconID)?.name ?? (row.source === "manual" ? (item as ManualDueItem).iconName : null) }
  })
  const save = async (value: string | null) => {
    if (!lifecycle.active) return
    if (!initial) throw Error("事项已被移除，请返回后重新打开。")
    if (value === initial.value && (initial.iconID == null || symbolChoice(initial.iconID) != null)) { onChanged(loadState()); return }
    const next = row.source === "manual"
      ? updateManualItemIcon(row.item.id, value, initial.expectedUpdatedAt!, initial.iconID)
      : updateItemIconChoice("reminder", row.item.id, { iconID: value == null ? null : `sf:${value}`, expectedIconID: initial.iconID })
    try { onChanged(next); await reloadWidgetsAfterStorageWrite() }
    catch (error) { if (lifecycle.active) await Dialog.alert({ title: "图标已保存", message: `组件刷新请求未完成，可在首页重试。\n${String(error)}` }) }
  }
  return <SystemIconPicker title={initial?.item.title ?? row.item.title} kind={row.source === "manual" ? (initial?.item as ManualDueItem | undefined)?.kind ?? row.item.kind : "reminder"}
    automatic={initial?.automatic ?? automaticIcon(row)} value={initial?.value ?? null}
    confirmLabel="保存图标" onConfirm={save}
    footer={`${initial?.iconID && !symbolChoice(initial.iconID) ? "旧图标不在当前图标库中，预览使用自动图标；确认自动匹配会清除旧选择。" : ""}确认后仅保存此事项的本地图标，并请求刷新组件；不会修改 Apple 提醒事项。取消或返回均不保存。`} />
}
