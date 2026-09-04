import { Button, DatePicker, LabeledContent, List, Section, Text, Toggle, useState } from "scripting"
import { loadState } from "./storage"
import { createLocalSnapshot } from "./recovery"
import { loadNotificationSettings, loadNotificationStatus, planNotifications,
  reconcileNotifications, updateNotificationSettings, type NotificationSettings } from "./notifications"

export function NotificationView() {
  const [settings, setSettings] = useState(() => loadNotificationSettings())
  const [status, setStatus] = useState(() => loadNotificationStatus())
  const [busy, setBusy] = useState(false)
  const [gate] = useState(() => ({ busy: false }))
  const items = loadState().items.filter(item => item.enabled)
  const time = new Date(2000, 0, 1, settings.hour, settings.minute).getTime()
  const now = new Date()
  const first = planNotifications(items, settings, now, 1).notifications[0]

  const reconcile = async (patch?: Partial<NotificationSettings>) => {
    if (gate.busy) return
    gate.busy = true
    setBusy(true)
    try {
      if (patch) createLocalSnapshot("通知设置变更前")
      const next = patch ? updateNotificationSettings(patch) : loadNotificationSettings()
      setSettings(next)
      setStatus(await reconcileNotifications([], { loadItems: () => loadState().items }))
    } catch (error) {
      await Dialog.alert({ title: "通知设置未完成", message: String(error) })
      setSettings(loadNotificationSettings())
      setStatus(loadNotificationStatus())
    } finally { gate.busy = false; setBusy(false) }
  }
  return <List listStyle="insetGroup" navigationTitle="通知与提醒" navigationBarTitleDisplayMode="inline">
    <Section footer={<Text>默认关闭。开启后只为手动事项安排本地通知；Apple 提醒事项继续使用系统 App 自己的通知，避免重复。请允许 Scripting 的通知权限；专注模式或系统设置可能延后通知。</Text>}>
      <Toggle title="启用本地通知" systemImage="bell" value={settings.enabled} disabled={busy}
        onChanged={(enabled: boolean) => { void reconcile({ enabled }) }} />
      {settings.enabled ? <DatePicker title="提前日／全天事项提醒时刻" displayedComponents={["hourAndMinute"]}
        value={time} datePickerStyle="compact" disabled={busy} onChanged={(value: number) => {
          const selected = new Date(value)
          void reconcile({ hour: selected.getHours(), minute: selected.getMinutes() })
        }} /> : null}
      {settings.enabled ? <Toggle title="真实到期日再提醒一次" value={settings.includeDueDate} disabled={busy}
        onChanged={(includeDueDate: boolean) => { void reconcile({ includeDueDate }) }} /> : null}
    </Section>
    <Section header={<Text>安排状态</Text>} footer={<Text>提前处理从提前日零点开始；通知在上方指定时刻发出。未提前且带具体时间的事项按到期时刻通知。滚动安排未来 90 天、最多 40 个提醒计划，打开脚本、操作事项及组件运行时尝试补充；并非无限期后台运行。替换时先确认新请求再移除旧请求，可能短暂存在副本；若提示未完成，请打开主脚本重试。</Text>}>
      <LabeledContent title="待发通知"><Text>{status?.pendingCount ?? 0} 条</Text></LabeledContent>
      <Text font="caption" foregroundStyle={status?.state === "error" || status?.state === "unavailable" ? "systemOrange" : "secondaryLabel"}>
        {busy ? "正在更新通知安排…" : status?.message ?? "尚未安排通知"}
      </Text>
      {status?.lastSuccessAt ? <Text font="caption" foregroundStyle="secondaryLabel">上次安排成功：{new Date(status.lastSuccessAt).toLocaleString()}</Text> : null}
      {first && settings.enabled ? <Text font="caption" foregroundStyle="secondaryLabel">
        按设置预计：{new Date(first.fireAt).toLocaleString()} · {first.title}。此为设置预览，不代表已安排，请以上方安排状态为准。
      </Text> : null}
      <Button title={busy ? "正在处理…" : "重新检查与安排"} systemImage="arrow.clockwise" disabled={busy}
        action={() => { void reconcile() }} />
    </Section>
    {settings.enabled ? <Section header={<Text>参与通知的事项</Text>} footer={<Text>这里的开关只控制通知，不影响组件显示和提前排序。</Text>}>
      {items.length === 0 ? <Text foregroundStyle="secondaryLabel">暂无启用的手动事项</Text> : items.map(item => (
        <Toggle key={item.id} title={item.title} value={!settings.mutedItemIDs.includes(item.id)} disabled={busy}
          onChanged={(enabled: boolean) => {
            const mutedItemIDs = new Set(loadNotificationSettings().mutedItemIDs)
            if (enabled) mutedItemIDs.delete(item.id)
            else mutedItemIDs.add(item.id)
            void reconcile({ mutedItemIDs: [...mutedItemIDs] })
          }} />
      ))}
    </Section> : null}
  </List>
}
