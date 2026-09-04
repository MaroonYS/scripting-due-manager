import { Button, List, Navigation, Section, Text, useState } from "scripting"
import { acknowledgeWidgetAction, inspectWidgetAction } from "./widget_action_status"
import { reloadWidgetsAfterStorageWrite } from "./widget_refresh"

export function WidgetActionStatusView({ standalone = false }: { standalone?: boolean }) {
  const dismiss = Navigation.useDismiss()
  const [inspection, setInspection] = useState(inspectWidgetAction)
  const [busy, setBusy] = useState(false)
  const [gate] = useState(() => ({ busy: false }))
  const acknowledge = async () => {
    if (gate.busy || !inspection.event) return
    gate.busy = true
    setBusy(true)
    try {
      acknowledgeWidgetAction(inspection.event)
      setInspection(inspectWidgetAction())
      try { await reloadWidgetsAfterStorageWrite() }
      catch (error) {
        await Dialog.alert({ title: "提示已清除", message: `组件刷新请求失败，请返回主界面重试。\n${String(error)}` })
      }
    } catch (error) {
      setInspection(inspectWidgetAction())
      await Dialog.alert({ title: "提示未能清除", message: String(error) })
    } finally { gate.busy = false; setBusy(false) }
  }
  return <List listStyle="insetGroup" navigationTitle="上次组件操作" navigationBarTitleDisplayMode="inline"
    toolbar={{ cancellationAction: standalone ? <Button title="关闭" action={() => dismiss()} /> : undefined }}>
    <Section header={<Text>操作结果</Text>}>
      <Text fontWeight="semibold" foregroundStyle={inspection.outcome === "completed" ? "systemOrange" : "label"}>{inspection.title}</Text>
      {inspection.message ? <Text>{inspection.message}</Text> : null}
      {inspection.event ? <Text font="caption" foregroundStyle="secondaryLabel">发生于：{new Date(inspection.event.createdAt).toLocaleString()}</Text> : null}
      {inspection.readError ? <Text foregroundStyle="systemOrange">{inspection.readError}</Text> : null}
    </Section>
    <Section header={<Text>下一步</Text>} footer={<Text>此页不会完成、撤销或删除任何事项。清除提示只会移除组件中的异常标记；共享存储不提供跨进程原子确认。</Text>}>
      <Text>{inspection.guidance}</Text>
      <Button title="重新读取状态" systemImage="arrow.clockwise" disabled={busy} action={() => setInspection(inspectWidgetAction())} />
      {inspection.message ? <Button title={busy ? "正在清除…" : "我已了解，清除提示"} systemImage="checkmark"
        disabled={busy} action={() => { void acknowledge() }} /> : null}
    </Section>
  </List>
}
