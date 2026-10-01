// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

import { Button, HStack, Image, List, Navigation, Section, Spacer, Text, VStack, useState } from "scripting"
import { resolveDueIcon } from "./icons"
import type { ResolvedDueIcon } from "./icons"
import { SystemIconThemes } from "./system_icon_themes"

/** Selection is a draft until confirmed, whether it belongs to a form or a saved item. */
export function SystemIconPicker({ title, automatic, value, onConfirm, confirmLabel = "使用此图标", footer }: {
  title: string; automatic: ResolvedDueIcon; value: string | null
  onConfirm: (value: string | null) => void | Promise<void>; confirmLabel?: string; footer: string
}) {
  const dismiss = Navigation.useDismiss()
  const [selected, setSelected] = useState(value)
  const [busy, setBusy] = useState(false)
  const [gate] = useState(() => ({ busy: false }))
  const preview = selected == null ? automatic : resolveDueIcon("", "custom", selected)
  const confirm = async () => {
    if (gate.busy) return
    gate.busy = true; setBusy(true)
    try { await onConfirm(selected); dismiss() }
    catch (error) { await Dialog.alert({ title: "图标未保存", message: String(error) }) }
    finally { gate.busy = false; setBusy(false) }
  }
  return <List listStyle="insetGroup" navigationTitle="选择事项图标" navigationBarTitleDisplayMode="inline" disabled={busy}
    toolbar={{
      cancellationAction: <Button title="取消" disabled={busy} action={() => dismiss()} />,
      confirmationAction: <Button title={busy ? "正在保存…" : confirmLabel} disabled={busy} action={() => { void confirm() }} />,
    }}>
    <Section header={<Text>预览</Text>} footer={<Text>{footer}</Text>}>
      <HStack spacing={14} padding={{ vertical: 6 }}>
        <Image systemName={preview.name} foregroundStyle={preview.color} font="largeTitle" frame={{ width: 48 }} />
        <VStack alignment="leading" spacing={4}>
          <Text font="headline" lineLimit={2}>{title.trim() || "未命名事项"}</Text>
          <Text font="subheadline" foregroundStyle="secondaryLabel">{`${selected == null ? "自动匹配" : "手动指定"} · ${preview.label}`}</Text>
        </VStack>
      </HStack>
      <Button buttonStyle="plain" action={() => setSelected(null)}>
        <HStack spacing={12} frame={{ minHeight: 44 }} contentShape="rect">
          <Image systemName={automatic.name} foregroundStyle={automatic.color} frame={{ width: 26 }} />
          <VStack alignment="leading" spacing={3}>
            <Text foregroundStyle="label">自动匹配</Text>
            <Text font="caption" foregroundStyle="secondaryLabel">{`当前：${automatic.label}；内容变化时跟随更新`}</Text>
          </VStack>
          <Spacer />
          {selected == null ? <Image systemName="checkmark" foregroundStyle="systemBlue" /> : null}
        </HStack>
      </Button>
    </Section>
    <SystemIconThemes value={selected} automaticName={automatic.name} onChanged={setSelected} />
  </List>
}
