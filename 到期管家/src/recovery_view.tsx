import { Button, List, Section, Text, VStack, useEffect, useState } from "scripting"
import { humanDate } from "./date"
import { refreshAfterDataChange } from "./maintenance"
import {
  createBackupJSON, createLocalSnapshot, listCompletionHistory, listLocalSnapshots,
  parseBackupJSON, restoreBackupJSON, restoreLocalSnapshot, undoManualCompletion,
} from "./recovery"
import type { AppState, CompletionRecord, LocalSnapshot } from "./types"

export function RecoveryView({ onChanged }: { onChanged: (state?: AppState) => void }) {
  const [history, setHistory] = useState<CompletionRecord[]>([])
  const [snapshots, setSnapshots] = useState<LocalSnapshot[]>([])
  const [readError, setReadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [gate] = useState(() => ({ busy: false }))

  const refresh = () => {
    const failures: string[] = []
    try { setHistory(listCompletionHistory()) } catch (error) { failures.push(String(error)) }
    try { setSnapshots(listLocalSnapshots()) } catch (error) { failures.push(String(error)) }
    setReadError(failures.length ? failures.join("\n") : null)
  }
  useEffect(refresh, [])
  const perform = async (operation: () => Promise<void>) => {
    if (gate.busy) return
    gate.busy = true
    setBusy(true)
    try { await operation() }
    catch (error) { await Dialog.alert({ title: "操作未完成", message: String(error) }) }
    finally { refresh(); gate.busy = false; setBusy(false) }
  }
  const changed = async (state: AppState) => {
    onChanged(state)
    const warning = await refreshAfterDataChange()
    if (warning) await Dialog.alert({ title: "数据已恢复", message: warning })
  }
  const exportBackup = async () => {
    if (typeof DocumentPicker === "undefined" || typeof Data === "undefined") {
      throw new Error("当前 Scripting 不支持文件导出，请先更新 Scripting。")
    }
    const data = Data.fromString(createBackupJSON())
    if (!data) throw new Error("无法生成备份文件，未导出任何内容。")
    const files = await DocumentPicker.exportFiles({ files: [{
      data, name: `due-manager-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    }] })
    if (files.length > 0) await Dialog.alert({ title: "备份已导出", message: "包含手动事项、显示设置和完成记录。请保存在你信任的位置；文件包含事项名称、金额和备注。" })
  }
  const importBackup = async () => {
    if (typeof DocumentPicker === "undefined" || typeof FileManager === "undefined") {
      throw new Error("当前 Scripting 不支持文件导入，请先更新 Scripting。")
    }
    let json: string
    try {
      const paths = await DocumentPicker.pickFiles({ types: ["public.json"], allowsMultipleSelection: false })
      if (!paths?.length) return
      json = await FileManager.readAsString(paths[0])
    } finally { DocumentPicker.stopAcessingSecurityScopedResources() }
    const preview = parseBackupJSON(json)
    const confirmed = await Dialog.confirm({
      title: "恢复此备份？",
      message: `备份时间：${new Date(preview.exportedAt).toLocaleString()}\n${preview.itemCount} 条手动事项，${preview.historyCount} 条完成记录。\n\n这会替换当前手动事项和显示设置，不修改 Apple 提醒事项。恢复前会保存当前数据快照。通知时间和单项设置随备份恢复，通知先关闭，请检查后重新开启。`,
      cancelLabel: "取消", confirmLabel: "备份当前并恢复",
    })
    if (confirmed) await changed(restoreBackupJSON(json))
  }
  const undo = async (record: CompletionRecord) => {
    if (record.source === "reminder") {
      await Dialog.alert({ title: "请在提醒事项中恢复", message: "Scripting 无法可靠核验系统提醒在完成后的全部修改，尤其是重复提醒。为避免覆盖新修改或生成重复事项，请在 Apple 提醒事项的已完成列表中恢复。" })
      return
    }
    if (!await Dialog.confirm({ title: "撤销这次完成？", message: record.title + "\n仅在事项未被后续修改时恢复完成前的本期日期。", cancelLabel: "取消", confirmLabel: "撤销完成" })) return
    await changed(undoManualCompletion(record.id))
  }
  const restore = async (snapshot: LocalSnapshot) => {
    if (!await Dialog.confirm({ title: "恢复本地快照？", message: `${new Date(snapshot.createdAt).toLocaleString()} · ${snapshot.state.items.length} 条事项\n将替换当前手动事项和显示设置；当前数据会先另存快照。不会改变系统提醒事项。通知时间和单项设置随快照恢复，通知先关闭，请检查后重新开启。`, cancelLabel: "取消", confirmLabel: "备份当前并恢复" })) return
    await changed(restoreLocalSnapshot(snapshot.id))
  }

  return <List listStyle="insetGroup" navigationTitle="记录与数据安全" navigationBarTitleDisplayMode="inline">
    <Section header={<Text>备份与恢复</Text>} footer={<Text>自动保留最近 10 份本机快照，和脚本数据存放在同一设备，并非独立备份。建议定期导出到“文件”。恢复不修改系统提醒事项；通知先关闭，请检查后重新开启。</Text>}>
      {readError ? <Text font="caption" foregroundStyle="systemOrange">{readError}</Text> : null}
      <Button title="导出备份到文件" systemImage="square.and.arrow.up" disabled={busy} action={() => { void perform(exportBackup) }} />
      <Button title="从文件恢复备份" systemImage="square.and.arrow.down" disabled={busy} action={() => { void perform(importBackup) }} />
      <Button title="立即创建本地快照" systemImage="externaldrive.badge.plus" disabled={busy} action={() => { void perform(async () => { createLocalSnapshot("手动快照") }) }} />
    </Section>
    <Section header={<Text>最近完成记录</Text>} footer={<Text>保留最近 100 次记录，从本版本开始记载。手动事项可安全撤销；之后已编辑或再次完成的事项不会被覆盖。系统提醒的恢复请在 Apple 提醒事项中处理。</Text>}>
      {history.length === 0 ? <Text foregroundStyle="secondaryLabel">暂无完成记录</Text> : history.map(record => (
        <Button key={record.id} buttonStyle="plain" disabled={busy || record.undoneAt != null} action={() => { void perform(async () => { await undo(record) }) }}>
          <VStack alignment="leading" spacing={3} padding={{ vertical: 3 }}>
            <Text foregroundStyle="label" lineLimit={2}>{record.title}</Text>
            <Text font="caption" foregroundStyle="secondaryLabel">{new Date(record.completedAt).toLocaleString()} · {record.action === "skip" ? "跳至未来" : "完成本期"}</Text>
            <Text font="caption" foregroundStyle="secondaryLabel">本期：{humanDate(record.dueDate, record.before?.includesTime ?? false, record.before?.hour ?? 0, record.before?.minute ?? 0)}</Text>
            <Text font="caption" foregroundStyle={record.undoneAt ? "secondaryLabel" : "systemBlue"}>
              {record.undoneAt ? "已撤销" : record.source === "manual" ? "点击撤销这次完成" : "系统提醒 · 查看恢复说明"}
            </Text>
          </VStack>
        </Button>
      ))}
    </Section>
    <Section header={<Text>本地恢复快照</Text>}>
      {snapshots.length === 0 ? <Text foregroundStyle="secondaryLabel">暂无快照</Text> : snapshots.map(snapshot => (
        <Button key={snapshot.id} buttonStyle="plain" disabled={busy} action={() => { void perform(async () => { await restore(snapshot) }) }}>
          <VStack alignment="leading" spacing={3} padding={{ vertical: 3 }}>
            <Text foregroundStyle="label">{snapshot.reason}</Text>
            <Text font="caption" foregroundStyle="secondaryLabel">{new Date(snapshot.createdAt).toLocaleString()} · {snapshot.state.items.length} 条事项</Text>
          </VStack>
        </Button>
      ))}
    </Section>
  </List>
}
