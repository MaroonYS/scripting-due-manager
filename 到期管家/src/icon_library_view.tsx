// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { Button, HStack, Image, List, Navigation, NavigationLink, Section, Spacer, Text, TextField, VStack, useEffect, useState } from "scripting"
import { itemIconID, symbolChoice } from "./icon_preferences"
import { resolveDueIcon } from "./icons"
import { SystemIconThemes } from "./system_icon_themes"
import { loadReminderItems } from "./reminders"
import { loadState, updateItemIconChoice } from "./storage"
import { refreshAfterDataChange } from "./maintenance"
import type { AppState, DisplayDueItem, ManualDueItem } from "./types"

export function IconLibraryView({ state, onChanged, manualDestination }: {
  state: AppState; onChanged: (state?: AppState) => void; manualDestination: (item: ManualDueItem) => JSX.Element
}) {
  const [reminders, setReminders] = useState<DisplayDueItem[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const scope = JSON.stringify([state.settings.includeReminders, state.settings.reminderHorizonDays, state.settings.reminderCalendarIDs])
  useEffect(() => {
    let active = true
    setReminders([])
    if (!state.settings.includeReminders) { setMessage("尚未开启 Apple 提醒事项显示。"); return }
    setMessage("正在读取提醒事项…")
    void loadReminderItems(state.settings.reminderHorizonDays, state.settings.reminderCalendarIDs).then(result => {
      if (active) { setReminders(result.items); setMessage(result.error) }
    }).catch(error => { if (active) setMessage(String(error)) })
    return () => { active = false }
  }, [scope])
  const term = query.normalize("NFKC").toLowerCase().trim()
  const rows = [
    ...state.items.map(item => ({ source: "manual" as const, item })),
    ...(state.settings.includeReminders ? reminders.map(item => ({ source: "reminder" as const, item })) : []),
  ].filter(row => row.item.title.normalize("NFKC").toLowerCase().includes(term))
  const pages = Math.max(1, Math.ceil(rows.length / 40)), currentPage = Math.min(page, pages - 1)
  const visible = rows.slice(currentPage * 40, (currentPage + 1) * 40)
  return <List listStyle="insetGroup" navigationTitle="事项系统图标" navigationBarTitleDisplayMode="inline">
    <Section>
      <Text font="caption" foregroundStyle="secondaryLabel">仅使用本机 SF Symbols，不加载外部图库。提醒事项根据标题和备注自动匹配；逐项手动选择优先。</Text>
    </Section>
    <Section header={<Text>选择要设置的事项</Text>} footer={<Text>手动事项进入编辑页，保存后生效；Apple 提醒事项的图标选择只保存在到期管家，不修改系统事项或备注。</Text>}>
      <TextField title="查找事项" value={query} prompt="输入事项名称" onChanged={(value: string) => { setQuery(value); setPage(0) }} />
      {visible.map(row => <NavigationLink key={JSON.stringify([row.source, row.item.id])}
        destination={row.source === "manual" ? manualDestination(row.item as ManualDueItem)
          : <ReminderIconEditor item={row.item as DisplayDueItem} onChanged={onChanged} />}>
        <ItemIconLibraryRow title={row.item.title} source={row.source}
          iconID={itemIconID(state.settings, row.source, row.item.id)}
          fallback={row.source === "manual" ? resolveDueIcon(row.item.title, (row.item as ManualDueItem).kind, (row.item as ManualDueItem).iconName).name : (row.item as DisplayDueItem).iconName} />
      </NavigationLink>)}
      {!rows.length ? <Text foregroundStyle="secondaryLabel">没有找到事项。新增后可在此设置。</Text> : null}
    </Section>
    {pages > 1 ? <Section><HStack>
      <Button title="上一页" disabled={currentPage === 0} action={() => setPage(currentPage - 1)} />
      <Spacer /><Text>{currentPage + 1} / {pages}</Text><Spacer />
      <Button title="下一页" disabled={currentPage + 1 === pages} action={() => setPage(currentPage + 1)} />
    </HStack></Section> : null}
    {message ? <Section header={<Text>系统提醒事项状态</Text>}><Text font="caption" foregroundStyle="secondaryLabel">{message}</Text></Section> : null}
  </List>
}

function ItemIconLibraryRow({ title, source, iconID, fallback }: { title: string; source: string; iconID: string | null; fallback: string }) {
  const symbol = symbolChoice(iconID)
  return <HStack spacing={12}>
    <Image systemName={symbol?.name ?? fallback} foregroundStyle={symbol?.color ?? "systemBlue"} frame={{ width: 24 }} />
    <VStack alignment="leading" spacing={3}>
      <Text lineLimit={1}>{title}</Text>
      <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1}>{source === "manual" ? "手动事项" : "Apple 提醒事项"} · {symbol?.label ?? "自动匹配"}</Text>
    </VStack>
  </HStack>
}

export function ReminderIconEditor({ item, onChanged }: { item: DisplayDueItem; onChanged: (state?: AppState) => void }) {
  const dismiss = Navigation.useDismiss()
  const [initialID] = useState(() => itemIconID(loadState().settings, "reminder", item.id))
  const [selectedID, setSelectedID] = useState(initialID)
  const [busy, setBusy] = useState(false)
  const [gate] = useState(() => ({ busy: false }))
  const save = async () => {
    if (gate.busy) return
    gate.busy = true; setBusy(true)
    let saved = false
    try {
      const next = selectedID === initialID ? loadState() : updateItemIconChoice("reminder", item.id, { iconID: selectedID, expectedIconID: initialID })
      saved = true
      onChanged(next)
      const warning = await refreshAfterDataChange()
      if (warning) await Dialog.alert({ title: "图标已保存", message: warning })
      dismiss()
    } catch (error) {
      await Dialog.alert({ title: saved ? "图标已保存，刷新未完成" : "保存图标失败", message: String(error) })
      if (saved) dismiss()
    } finally { gate.busy = false; setBusy(false) }
  }
  return <List listStyle="insetGroup" navigationTitle="提醒事项图标" navigationBarTitleDisplayMode="inline" disabled={busy}
    toolbar={{ confirmationAction: <Button title={busy ? "正在保存…" : "保存"} disabled={busy} action={() => { void save() }} /> }}>
    <Section footer={<Text>仅影响到期管家的显示；返回不保存即可取消。不会修改 Apple 提醒事项的名称、备注或到期日。</Text>}>
      <Text font="headline">{item.title}</Text>
      <ItemIconLibraryRow title="当前图标" source="reminder" iconID={selectedID} fallback={item.iconName} />
      <Button title={selectedID == null ? "✓ 自动匹配系统图标" : "自动匹配系统图标"} action={() => setSelectedID(null)} />
    </Section>
    <SystemIconThemes value={symbolChoice(selectedID)?.name ?? null} onChanged={name => setSelectedID(`sf:${name}`)} />
  </List>
}
