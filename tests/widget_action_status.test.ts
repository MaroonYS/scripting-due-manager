import assert from "node:assert/strict"
import test from "node:test"
import { acknowledgeWidgetAction, explainWidgetAction, inspectWidgetAction } from "../到期管家/src/widget_action_status.ts"
import { STATE_KEY, WIDGET_ACTION_STATUS_KEY, writeWidgetActionError } from "../到期管家/src/storage.ts"

function withStorage(action: (values: Map<string, unknown>) => void) {
  const previous = (globalThis as any).Storage
  const values = new Map<string, unknown>([[STATE_KEY, { sentinel: "must never change" }]])
  ;(globalThis as any).Storage = {
    get: (key: string, options?: { shared?: boolean }) => options?.shared ? values.get(key) ?? null : null,
    set: (key: string, value: unknown) => { values.set(key, value); return true },
    remove: (key: string) => { values.delete(key) },
    contains: (key: string) => values.has(key),
  }
  try { action(values) } finally { (globalThis as any).Storage = previous }
}

test("action details distinguish completed warnings from unconfirmed failures", () => {
  for (const message of ["提醒已完成，但本地缓存未能更新", "提醒已完成，但本地缓存或完成记录未能保存", "事项已完成，但完成动画状态未能保存"]) {
    const result = explainWidgetAction(message)
    assert.equal(result.outcome, "completed")
    assert.match(result.guidance, /无需再次完成/)
  }
  assert.equal(explainWidgetAction("提醒完成失败，请打开主脚本检查权限").outcome, "unconfirmed")
  assert.equal(explainWidgetAction("数据操作已结束，但组件刷新请求失败，请打开主脚本刷新").outcome, "unconfirmed")
  assert.match(explainWidgetAction(null).guidance, /不代表所有事项都已完成/)
})

test("acknowledging a widget warning never mutates items or completes an occurrence", () => withStorage(values => {
  const message = "提醒已完成，但本地缓存或完成记录未能保存"
  values.set(WIDGET_ACTION_STATUS_KEY, { schemaVersion: 1, createdAt: Date.now(), message })
  assert.equal(inspectWidgetAction().outcome, "completed")
  acknowledgeWidgetAction(inspectWidgetAction().event!)
  assert.equal(inspectWidgetAction().outcome, "none")
  assert.deepEqual(values.get(STATE_KEY), { sentinel: "must never change" })
}))

test("acknowledgement refuses to clear a changed message", () => withStorage(values => {
  values.set(WIDGET_ACTION_STATUS_KEY, { schemaVersion: 1, createdAt: Date.now(), message: "new warning" })
  assert.throws(() => acknowledgeWidgetAction({ schemaVersion: 1, createdAt: Date.now(), message: "old warning" }), /已经变化/)
  assert.equal(inspectWidgetAction().message, "new warning")
}))

test("a failed status read is visible and cannot masquerade as no warning", () => withStorage(() => {
  ;(globalThis as any).Storage.get = () => { throw new Error("read failed") }
  assert.equal(inspectWidgetAction().outcome, "unavailable")
  assert.match(inspectWidgetAction().readError!, /read failed/)
}))

test("a failed remove is not falsely reported as acknowledgement success", () => withStorage(values => {
  const message = "warning"
  values.set(WIDGET_ACTION_STATUS_KEY, { schemaVersion: 1, createdAt: Date.now(), message })
  ;(globalThis as any).Storage.remove = () => undefined
  assert.throws(() => acknowledgeWidgetAction(inspectWidgetAction().event!), /尚未清除/)
}))

test("identical messages from newer events cannot be acknowledged by an old page", () => withStorage(values => {
  const createdAt = Date.now()
  values.set(WIDGET_ACTION_STATUS_KEY, { schemaVersion: 1, createdAt, message: "same warning" })
  const legacy = inspectWidgetAction().event!
  values.set(WIDGET_ACTION_STATUS_KEY, { schemaVersion: 1, createdAt: createdAt + 1, message: "same warning" })
  assert.throws(() => acknowledgeWidgetAction(legacy), /已经变化/)
  writeWidgetActionError("same warning", createdAt)
  const first = inspectWidgetAction().event!
  writeWidgetActionError("same warning", createdAt)
  assert.notEqual(inspectWidgetAction().event!.eventID, first.eventID)
  assert.throws(() => acknowledgeWidgetAction(first), /已经变化/)
  assert.equal(inspectWidgetAction().message, "same warning")
}))
