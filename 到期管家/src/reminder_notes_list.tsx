// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { Button, List, NavigationLink, Section, Text, TextField, useEffect, useState } from "scripting"
import { ReminderNotesView } from "./reminder_notes_view"
import { loadReminderItems } from "./reminders"
import { withReadDeadline } from "./async_deadline"
import type { AppSettings, DisplayDueItem } from "./types"

/** Explicit fallback if the host opens the main app without a widget target. */
export function ReminderNotesList({ settings }: { settings: AppSettings }) {
  const [query, setQuery] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [rows, setRows] = useState<DisplayDueItem[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const scope = JSON.stringify(settings.reminderCalendarIDs)
  useEffect(() => {
    let active = true
    setLoading(true); setRows([]); setMessage(null)
    void withReadDeadline(() => loadReminderItems(settings.reminderHorizonDays, settings.reminderCalendarIDs), 10000).then(result => {
      if (!active) return
      setRows(result.items); setLoading(false)
      setMessage(result.error ? "提醒事项同步异常；可重试，点击事项后会实时读取备注。" : result.fromCache ? "当前列表来自缓存；点击事项后会实时读取备注。" : null)
    }, () => { if (active) { setLoading(false); setMessage("提醒事项列表读取失败，请检查权限后重试。") } })
    return () => { active = false }
  }, [scope, settings.reminderHorizonDays, attempt])
  const needle = query.trim().toLocaleLowerCase()
  const visible = rows.filter(item => `${item.title} ${item.note}`.toLocaleLowerCase().includes(needle))
  return <List listStyle="insetGroup" navigationTitle="查看提醒事项备注" navigationBarTitleDisplayMode="inline">
    <Section footer={<Text>按当前提醒事项列表与日期范围显示。点击具体事项读取备注，不自动打开其他事项。</Text>}>
      <TextField title="查找提醒事项" prompt="标题或列表名称" value={query} onChanged={setQuery} />
      <Button title={loading ? "正在读取…" : "重新读取列表"} disabled={loading} action={() => setAttempt(value => value + 1)} />
      {message ? <Text foregroundStyle="secondaryLabel">{message}</Text> : null}
    </Section>
    <Section>
      {visible.map(item => <NavigationLink key={item.id} destination={<ReminderNotesView id={item.id} />}>
        <Text>{item.title}</Text>
      </NavigationLink>)}
      {!loading && !visible.length ? <Text foregroundStyle="secondaryLabel">没有找到提醒事项，请检查搜索词、列表筛选和日期范围。</Text> : null}
    </Section>
  </List>
}
