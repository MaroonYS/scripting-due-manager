// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { Button, HStack, Image, List, Navigation, Script, Section, Spacer, Text, VStack, useEffect, useState } from "scripting"
import { normalizeReminderCalendarIDs } from "./storage"
import { ReadDeadlineError, withReadDeadline } from "./async_deadline"

type ReminderCalendarChoice = {
  id: string
  title: string
  sourceTitle: string
  readOnly: boolean
}

/** Keep permission prompts, optional reads and accepted saves on separate lifecycles. */
export function ReminderCalendarPicker({ selectedIDs, onChanged }: {
  selectedIDs: string[]
  onChanged: (calendarIDs: string[]) => Promise<void>
}) {
  const dismiss = Navigation.useDismiss()
  const [selection, setSelection] = useState<string[]>(() => normalizeReminderCalendarIDs(selectedIDs))
  const [calendars, setCalendars] = useState<ReminderCalendarChoice[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [gate] = useState(() => ({ active: true, generation: 0, loading: 0, ready: false, saving: false }))

  const loadCalendars = async () => {
    if (!gate.active || gate.loading || gate.saving) return
    const request = ++gate.generation
    gate.loading = request; gate.ready = false
    setLoading(true); setLoadError(null)
    const isCurrent = () => gate.active && request === gate.generation
    try {
      // A human-controlled permission prompt is not a slow optional read.
      const granted = await Script.requestAccess(["calendar", "reminders"])
      if (!isCurrent()) return
      if (!granted.includes("calendar") || !granted.includes("reminders")) {
        throw new Error("需要日历与提醒事项权限，才能读取可选列表。")
      }
      const available = await withReadDeadline(() => Calendar.forReminders(), 10000)
      if (!isCurrent()) return
      const byIdentifier = new Map<string, ReminderCalendarChoice>()
      for (const calendar of available) {
        const id = typeof calendar?.identifier === "string" ? calendar.identifier.trim() : ""
        if (!id || byIdentifier.has(id)) continue
        byIdentifier.set(id, {
          id,
          title: String(calendar.title || "未命名列表").slice(0, 100),
          sourceTitle: String(calendar.source?.title || "").slice(0, 100),
          readOnly: calendar.allowsContentModifications === false,
        })
      }
      setCalendars([...byIdentifier.values()].sort((left, right) => {
        const sourceOrder = left.sourceTitle.localeCompare(right.sourceTitle, "zh-Hans-CN")
        return sourceOrder || left.title.localeCompare(right.title, "zh-Hans-CN")
      }))
      gate.ready = true
    } catch (error) {
      if (isCurrent()) setLoadError(error instanceof ReadDeadlineError
        ? "读取提醒事项列表超时，请稍后点此重试。" : String(error))
    } finally {
      if (gate.loading === request) gate.loading = 0
      if (isCurrent()) setLoading(false)
    }
  }

  useEffect(() => {
    gate.active = true
    void loadCalendars()
    return () => { gate.active = false; gate.generation++; gate.loading = 0; gate.ready = false }
  }, [gate])

  const selectAll = () => { if (gate.active && !gate.saving) setSelection([]) }
  const toggleCalendar = (id: string) => {
    if (!gate.active || gate.saving || !gate.ready) return
    const knownIDs = new Set(calendars.map(calendar => calendar.id))
    if (!knownIDs.has(id)) return
    setSelection(previous => {
      const current = previous.filter(identifier => knownIDs.has(identifier))
      return normalizeReminderCalendarIDs(current.includes(id)
        ? current.filter(identifier => identifier !== id) : [...current, id])
    })
  }

  const availableIDs = new Set(calendars.map(calendar => calendar.id))
  const unavailableCount = selection.filter(identifier => !availableIDs.has(identifier)).length
  const save = async () => {
    if (!gate.active || gate.saving || gate.loading || !gate.ready || loading || loadError) return
    const request = gate.generation
    if (unavailableCount > 0) {
      await Dialog.alert({
        title: "无法保存列表选择",
        message: `有 ${unavailableCount} 个原先选择的列表已不可用。请改选现有列表，或选择“全部列表”后再保存。`,
      })
      return
    }
    gate.saving = true; setSaving(true)
    try {
      // Once accepted, a settings write finishes exactly once even if this page closes.
      await onChanged(normalizeReminderCalendarIDs(selection))
      if (gate.active && request === gate.generation) { gate.active = false; dismiss() }
    } catch (error) {
      if (gate.active && request === gate.generation) await Dialog.alert({ title: "列表设置保存失败", message: String(error) })
    } finally {
      gate.saving = false
      if (gate.active && request === gate.generation) setSaving(false)
    }
  }

  return <List
    listStyle="insetGroup"
    navigationTitle="提醒事项列表"
    navigationBarTitleDisplayMode="inline"
    disabled={saving}
    toolbar={{
      confirmationAction: <Button title={saving ? "正在保存…" : "完成"}
        disabled={saving || loading || loadError != null} action={() => { void save() }} />,
    }}
  >
    <Section footer={<Text>不选择具体列表时会读取全部列表；也可以同时选择多个列表。</Text>}>
      <Button buttonStyle="plain" action={selectAll}>
        <ReminderCalendarRow title="全部列表" detail="包含所有账户中的提醒事项"
          selected={selection.length === 0} iconName="tray.full.fill" />
      </Button>
    </Section>
    <Section header={<Text>具体列表</Text>}
      footer={unavailableCount > 0
        ? <Text foregroundStyle="systemOrange">有 {unavailableCount} 个原先选择的列表已不可用；请选择现有列表或改为全部列表。</Text>
        : undefined}>
      {loading ? <HStack spacing={10}>
        <Image systemName="arrow.clockwise" foregroundStyle="secondaryLabel" />
        <Text foregroundStyle="secondaryLabel">正在读取列表…</Text>
      </HStack> : null}
      {!loading && loadError ? <Button title="读取失败，点此重试" systemImage="exclamationmark.triangle"
        action={() => { void loadCalendars() }} /> : null}
      {!loading && !loadError && calendars.length === 0
        ? <Text foregroundStyle="secondaryLabel">没有可用的提醒事项列表</Text> : null}
      {!loading && !loadError ? calendars.map(calendar => (
        <Button key={calendar.id} buttonStyle="plain" action={() => toggleCalendar(calendar.id)}>
          <ReminderCalendarRow title={calendar.title}
            detail={[calendar.sourceTitle, calendar.readOnly ? "只读" : ""].filter(Boolean).join(" · ") || undefined}
            selected={selection.includes(calendar.id)} iconName="list.bullet.circle.fill" />
        </Button>
      )) : null}
    </Section>
  </List>
}

function ReminderCalendarRow({ title, detail, selected, iconName }: {
  title: string; detail?: string; selected: boolean; iconName: string
}) {
  return <HStack spacing={12}>
    <Image systemName={iconName} foregroundStyle="systemBlue" frame={{ width: 26 }} />
    <VStack alignment="leading" spacing={1}>
      <Text foregroundStyle="label">{title}</Text>
      {detail ? <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1}>{detail}</Text> : null}
    </VStack>
    <Spacer />
    {selected ? <Image systemName="checkmark" foregroundStyle="systemBlue" fontWeight="semibold" /> : null}
  </HStack>
}
