import { reconcileNotifications } from "./notifications"
import { loadState } from "./storage"
import { reloadWidgetsAfterStorageWrite } from "./widget_refresh"

/** A notification failure must not turn a successful item save into a false failure. */
export async function refreshAfterDataChange(): Promise<string | null> {
  const warnings: string[] = []
  // Publish saved data promptly; a full notification refill can involve many requests.
  try { await reloadWidgetsAfterStorageWrite() }
  catch (error) {
    console.error("Widget refresh failed after data was saved", error)
    warnings.push("组件刷新请求失败，请返回主界面点「刷新桌面组件」。无需重复保存事项。")
  }
  try {
    const status = await reconcileNotifications([], { loadItems: () => loadState().items })
    if (status.state === "error" || status.state === "unavailable") warnings.push("通知安排未完成，请到「通知与提醒」检查权限并重试。")
  } catch (error) {
    console.error("Notification reconciliation failed", error)
    warnings.push("通知安排未完成，请到「通知与提醒」重试。")
  }
  return warnings.length ? warnings.join("\n") : null
}
