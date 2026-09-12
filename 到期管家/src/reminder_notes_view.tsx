// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { Button, List, Navigation, Section, Text, useEffect, useState } from "scripting"
import { readReminderNotes, type ReminderNotes } from "./reminder_notes"
import { openReminderFromWidget } from "./reminder_navigation"

/** Reads only the chosen reminder after this page is visible. */
export function ReminderNotesView({ id, standalone = false }: { id: unknown; standalone?: boolean }) {
  const dismiss = Navigation.useDismiss()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ id: unknown; attempt: number; value: ReminderNotes | null; error: string | null } | null>(null)
  const [opening, setOpening] = useState(false)
  const [gate] = useState(() => ({ opening: false }))
  useEffect(() => {
    let active = true
    setResult(null)
    void readReminderNotes(id).then(value => {
      if (active) setResult({ id, attempt, value, error: null })
    }, error => {
      if (active) setResult({ id, attempt, value: null, error: String(error.message ?? "读取备注失败，请重试。") })
    })
    return () => { active = false }
  }, [id, attempt])
  // Never flash a previous item's notes while props change or a retry begins.
  const current = result && result.id === id && result.attempt === attempt ? result : null
  const value = current?.value
  const open = async () => {
    if (gate.opening || !value?.canOpen) return
    gate.opening = true; setOpening(true)
    try { await openReminderFromWidget(value.id) }
    catch (error) { await Dialog.alert({ title: "无法在提醒事项中打开", message: String(error) }) }
    finally { gate.opening = false; setOpening(false) }
  }
  return <List listStyle="insetGroup" navigationTitle="提醒事项备注" navigationBarTitleDisplayMode="inline"
    toolbar={standalone ? { cancellationAction: <Button title="关闭" action={() => dismiss()} /> } : undefined}>
    {!current ? <Section><Text>正在读取对应提醒事项的备注…</Text></Section> : null}
    {current?.error ? <Section header={<Text>暂时无法读取</Text>}>
      <Text foregroundStyle="systemOrange">{current.error}</Text>
      <Button title="重试" action={() => setAttempt(value => value + 1)} />
    </Section> : null}
    {value ? <>
      <Section header={<Text>对应提醒事项</Text>}>
        <Text font="headline" fixedSize={{ horizontal: false, vertical: true }}>{value.title}</Text>
        {value.list ? <Text foregroundStyle="secondaryLabel">{value.list}</Text> : null}
        {value.completed ? <Text foregroundStyle="secondaryLabel">此提醒事项已完成，备注仍可查看。</Text> : null}
      </Section>
      <Section header={<Text>完整备注</Text>} footer={<Text>只读查看，不修改提醒事项。备注仅在本页读取，不写入缓存或备份。</Text>}>
        {value.notes.trim() ? <Text fixedSize={{ horizontal: false, vertical: true }} multilineTextAlignment="leading">{value.notes}</Text>
          : <Text foregroundStyle="secondaryLabel">此提醒事项没有备注。</Text>}
      </Section>
      <Section>
        <Button title={opening ? "正在打开…" : "在提醒事项中打开"} disabled={opening || !value.canOpen} action={() => { void open() }} />
        {!value.canOpen ? <Text font="caption" foregroundStyle="secondaryLabel">此账户暂不支持系统详情跳转，完整备注已在上方显示。</Text> : null}
        <Button title="重新读取备注" disabled={opening} action={() => setAttempt(value => value + 1)} />
      </Section>
    </> : null}
  </List>
}
