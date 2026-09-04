import { Button, List, Navigation, Section, Text, VStack, useEffect, useState } from "scripting"
import { humanDate } from "./date"
import { refreshAfterDataChange } from "./maintenance"
import {
  createBackupJSON, createLocalSnapshot, listCompletionHistory, listLocalSnapshots,
  parseBackupJSON, restoreBackupJSON, restoreLocalSnapshot, undoManualCompletion,
  createRecoveryArchiveJSON, readRecoveryStatus,
} from "./recovery"
import type { AppState, CompletionRecord, LocalSnapshot } from "./types"

export function RecoveryView({ onChanged, recoveryMode = false }: {
  onChanged: (state?: AppState) => void
  recoveryMode?: boolean
}) {
  const dismiss = Navigation.useDismiss()
  const [history, setHistory] = useState<CompletionRecord[]>([])
  const [snapshots, setSnapshots] = useState<LocalSnapshot[]>([])
  const [readError, setReadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [gate] = useState(() => ({ busy: false }))
  const [recoveryStatus, setRecoveryStatus] = useState(readRecoveryStatus)

  const refresh = () => {
    setRecoveryStatus(readRecoveryStatus())
    const failures: string[] = []
    try { setHistory(listCompletionHistory()) } catch (error) { setHistory([]); failures.push(String(error)) }
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
    const warning = await refreshAfterDataChange()
    if (warning) await Dialog.alert({ title: "数据已恢复", message: warning })
    onChanged(state)
  }
  const exportJSON = async (json: string, name: string) => {
    if (typeof DocumentPicker === "undefined" || typeof Data === "undefined") {
      throw new Error("当前 Scripting 不支持文件导出，请先更新 Scripting。")
    }
    const data = Data.fromString(json)
    if (!data) throw new Error("无法生成备份文件，未导出任何内容。")
    const files = await DocumentPicker.exportFiles({ files: [{
      data, name: `due-manager-${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    }] })
    if (files.length > 0) await Dialog.alert({ title: "文件已导出", message: "文件可能包含事项名称、金额、备注、设置和完成记录，请保存在你信任的位置。原始恢复档案用于排查与保全，不能当作普通备份直接导入。" })
  }
  const exportBackup = async () => exportJSON(createBackupJSON(), "backup")
  const exportArchive = async () => exportJSON(createRecoveryArchiveJSON(), "recovery-archive")
  const importBackup = async () => {
    const currentRecoveryStatus = readRecoveryStatus()
    if (!currentRecoveryStatus.canRestore) throw new Error(currentRecoveryStatus.message ?? "当前数据不能安全覆盖。")
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
      message: `备份时间：${new Date(preview.exportedAt).toLocaleString()}\n${preview.itemCount} 条手动事项，${preview.historyCount} 条完成记录。\n\n这会替换当前手动事项和显示设置，不修改 Apple 提醒事项。恢复前会保存当前数据；无法正常读取的原始数据会先隔离保全，保全失败则不恢复。通知时间和单项设置随备份恢复，通知先关闭，请检查后重新开启。`,
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
    const currentRecoveryStatus = readRecoveryStatus()
    if (!currentRecoveryStatus.canRestore) throw new Error(currentRecoveryStatus.message ?? "当前数据不能安全覆盖。")
    if (!await Dialog.confirm({ title: "恢复本地快照？", message: `${new Date(snapshot.createdAt).toLocaleString()} · ${snapshot.state.items.length} 条事项\n将替换当前手动事项和显示设置；当前数据先备份，无法读取的原始数据先隔离保全，保全失败则不恢复。不会改变系统提醒事项。通知时间和单项设置随快照恢复，通知先关闭，请检查后重新开启。`, cancelLabel: "取消", confirmLabel: "保全当前并恢复" })) return
    await changed(restoreLocalSnapshot(snapshot.id))
  }

  return <List listStyle="insetGroup" navigationTitle={recoveryMode ? "数据恢复" : "记录与数据安全"} navigationBarTitleDisplayMode="inline"
    toolbar={{ cancellationAction: recoveryMode ? <Button title="关闭" disabled={busy} action={() => dismiss()} /> : undefined }}>
    {recoveryMode || recoveryStatus.message ? <Section header={<Text>数据保护模式</Text>} footer={<Text>此页不自动清空或覆盖数据。只有确认恢复后才进行写入；不兼容的更高版本数据禁止覆盖，请使用匹配的新版本脚本。</Text>}>
      <Text foregroundStyle="systemOrange">{recoveryStatus.message ?? "请从有效备份或本地快照恢复。"}</Text>
      <Button title="重新检查数据" systemImage="arrow.clockwise" disabled={busy} action={refresh} />
    </Section> : null}
    <Section header={<Text>备份与恢复</Text>} footer={<Text>自动保留最近 10 份本机快照，和脚本数据存放在同一设备，并非独立备份。建议定期导出到“文件”。恢复不修改系统提醒事项；通知先关闭，请检查后重新开启。</Text>}>
      {readError ? <Text font="caption" foregroundStyle="systemOrange">{readError}</Text> : null}
      <Button title="导出备份到文件" systemImage="square.and.arrow.up" disabled={busy} action={() => { void perform(exportBackup) }} />
      <Button title="导出原始数据与恢复档案" systemImage="doc.zipper" disabled={busy} action={() => { void perform(exportArchive) }} />
      <Button title="从文件恢复备份" systemImage="square.and.arrow.down" disabled={busy || !recoveryStatus.canRestore} action={() => { void perform(importBackup) }} />
      <Button title="立即创建本地快照" systemImage="externaldrive.badge.plus" disabled={busy || !["ready", "missing"].includes(recoveryStatus.status)} action={() => { void perform(async () => { createLocalSnapshot("手动快照") }) }} />
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
        <Button key={snapshot.id} buttonStyle="plain" disabled={busy || !recoveryStatus.canRestore} action={() => { void perform(async () => { await restore(snapshot) }) }}>
          <VStack alignment="leading" spacing={3} padding={{ vertical: 3 }}>
            <Text foregroundStyle="label">{snapshot.reason}</Text>
            <Text font="caption" foregroundStyle="secondaryLabel">{new Date(snapshot.createdAt).toLocaleString()} · {snapshot.state.items.length} 条事项</Text>
          </VStack>
        </Button>
      ))}
    </Section>
  </List>
}
