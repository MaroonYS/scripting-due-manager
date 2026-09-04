import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const source = (path: string) => readFileSync(new URL(`../到期管家/${path}`, import.meta.url), "utf8")

test("all saved item operations use history-aware completion and warning-only maintenance", () => {
  const app = source("index.tsx")
  assert.match(app, /completeManualItem\(nextItem, expectedUpdatedAt, skipToFuture\)/)
  assert.equal((app.match(/const warning = await refreshAfterDataChange\(\)/g) ?? []).length, 3)
  assert.match(app, /title: "事项已保存"/)
  assert.match(app, /title: "本期已完成"/)
  assert.match(app, /title: "事项已删除"/)
  assert.match(app, /if \(actionGate.busy\) return/)
  assert.match(app, /void runEditorAction\(save\)/)
  assert.match(source("src/maintenance.ts"), /组件刷新请求失败/)
})

test("history backup and notification settings are reachable from main UI", () => {
  const app = source("index.tsx")
  for (const view of ["RecoveryView", "NotificationView", "UpdateView", "WidgetActionStatusView"]) {
    assert.ok(app.includes(`destination={<${view}`), `${view} needs a visible navigation entry`)
  }
  const recovery = source("src/recovery_view.tsx")
  assert.match(recovery, /DocumentPicker.exportFiles/)
  assert.match(recovery, /parseBackupJSON\(json\)/)
  assert.match(recovery, /if \(confirmed\) await changed\(restoreBackupJSON\(json\)\)/)
  assert.match(recovery, /通知先关闭，请检查后重新开启/)
  assert.match(recovery, /if \(record.source === "reminder"\)/)
  assert.match(recovery, /setReadError\(failures.length/)
  assert.match(app, /RecoveryView onChanged=\{refreshRecoveredState\}/)
  assert.match(app, /const refreshRecoveredState[\s\S]*?setReminderStatus\(EMPTY_REMINDER_STATUS\)[\s\S]*?void refreshReminders\(\)/)
  assert.match(recovery, /if \(!currentRecoveryStatus.canRestore\) throw/)
  assert.match(recovery, /createRecoveryArchiveJSON\(\)/)
  assert.match(recovery, /recoveryMode \? "数据恢复"/)
  assert.match(recovery, /隔离保全，保全失败则不恢复/)
})

test("production notification reconciliation reads fresh data and widget maintenance stays bounded", () => {
  for (const path of ["index.tsx", "app_intents.tsx", "widget.tsx", "src/maintenance.ts", "src/notification_view.tsx"]) {
    assert.match(source(path), /reconcileNotifications\(\[\], \{ loadItems: \(\) => loadState\(\).items/)
  }
  const widget = source("widget.tsx")
  assert.ok(widget.indexOf("Widget.present(") < widget.indexOf("await reconcileNotifications("))
  assert.match(widget, /maxNewRequests: 3, leaseWaitMs: 0/)
  const intent = source("app_intents.tsx")
  assert.ok(intent.indexOf("await reloadWidgetsAfterStorageWrite()") < intent.indexOf("await reconcileNotifications("))
  assert.match(intent, /maxNewRequests: 3, leaseWaitMs: 0/)
  const maintenance = source("src/maintenance.ts")
  assert.ok(maintenance.indexOf("await reloadWidgetsAfterStorageWrite()") < maintenance.indexOf("await reconcileNotifications("))
})

test("an applied completion cannot be reclassified by an auxiliary status failure", () => {
  const intent = source("app_intents.tsx")
  assert.match(intent, /try \{ clearWidgetActionError\(\) \}/)
  assert.match(intent, /if \(completionWarning\) writeActionWarningSafely\(completionWarning\)/)
  assert.match(intent, /function writeActionWarningSafely[\s\S]*?try \{ writeWidgetActionError\(message\) \}[\s\S]*?catch/)
})

test("manual update validates version and takes a snapshot before opening pinned installer", () => {
  const view = source("src/update_view.tsx")
  const prepare = view.indexOf("const url = freshPackageURL")
  const backup = view.indexOf("createLocalSnapshot(`更新至")
  const open = view.indexOf("await Safari.openURL")
  assert.ok(prepare >= 0 && backup > prepare && open > backup)
  assert.match(view, /setRelease\(null\)/)
  assert.match(view, /打开本页或点击重新检查时连接 GitHub/)
  assert.match(view, /if \(gate.busy\) return/)
  assert.match(view, /if \(!release \|\| gate.busy\) return/)
})

test("widget error links reach a real inspection page without repeating completion", () => {
  const app = source("index.tsx")
  assert.match(app, /if \(action === "widget-status"\)/)
  assert.match(app, /<WidgetActionStatusView standalone/)
  const status = source("src/widget_action_view.tsx")
  assert.match(status, /inspection.message/)
  assert.match(status, /inspection.guidance/)
  assert.match(status, /acknowledgeWidgetAction\(inspection.event\)/)
  assert.doesNotMatch(status, /completeManual|completeReminder/)
  assert.match(source("src/widget_view.tsx"), /action: "widget-status"/)
})
