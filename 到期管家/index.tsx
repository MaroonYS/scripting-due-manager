// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

// Keep this entry independent of storage, artwork and the full app's imports.
import { Button, List, Navigation, NavigationStack, Script, Section, Text, useEffect, useState } from "scripting"

type Application = { attempt: number; element: JSX.Element; startMaintenance: (() => void) | null }
const STARTUP_TIMEOUT_MS = 10000
const nextFrame = () => new Promise<void>(resolve => setTimeout(resolve, 50))

function ApplicationSurface({ application }: { application: Application }) {
  useEffect(() => { application.startMaintenance?.() }, [])
  return application.element
}

function StartupScreen() {
  const dismiss = Navigation.useDismiss()
  const [attempt, setAttempt] = useState(0)
  const [stage, setStage] = useState("准备加载界面")
  const [error, setError] = useState<string | null>(null)
  const [application, setApplication] = useState<Application | null>(null)
  useEffect(() => {
    let active = true
    setApplication(null); setError(null); setStage("准备加载界面")
    const timer = setTimeout(() => {
      if (!active) return
      active = false
      setError("启动超过 10 秒，已停止继续切换界面。请保留此页的阶段信息；没有重置事项或设置。")
    }, STARTUP_TIMEOUT_MS)
    void (async () => {
      // Let the native shell become visible before loading any app dependency.
      await nextFrame()
      if (!active) return
      setStage("加载主界面代码")
      const module = await import("./src/app")
      if (!active) return
      setStage("检查本机数据")
      await nextFrame()
      if (!active) return
      const prepared = module.createApplication(() => setAttempt(value => value + 1))
      if (!active) return
      setStage("显示主界面")
      clearTimeout(timer)
      setApplication({ attempt, element: prepared.element,
        startMaintenance: prepared.canMaintain ? module.startApplicationMaintenance : null })
    })().catch(reason => {
      if (!active) return
      clearTimeout(timer)
      setError(String(reason).slice(0, 500))
    })
    return () => { active = false; clearTimeout(timer) }
  }, [attempt])
  if (application?.attempt === attempt) return <ApplicationSurface key={attempt} application={application} />
  return <NavigationStack>
    <List listStyle="insetGroup" navigationTitle="到期管家启动" navigationBarTitleDisplayMode="inline"
      toolbar={{ cancellationAction: <Button title="关闭" action={() => dismiss()} /> }}>
      <Section header={<Text>正在启动</Text>} footer={<Text>本页不会清空或重建事项。若一直停在这里，请记录下方的阶段和错误。</Text>}>
        <Text>{`版本 ${Script.metadata.version ?? "未知"}`}</Text>
        <Text>{`当前阶段：${stage}`}</Text>
        {error ? <Text foregroundStyle="systemRed">{error}</Text> : <Text foregroundStyle="secondaryLabel">正在加载，请稍候…</Text>}
        {error ? <Button title="重试启动" action={() => setAttempt(value => value + 1)} /> : null}
      </Section>
    </List>
  </NavigationStack>
}

let notesRequestGeneration = 0
async function presentReminderNotes(parameters: Record<string, any>) {
  const request = ++notesRequestGeneration
  try {
    const { ReminderNotesView } = await import("./src/reminder_notes_view")
    if (request !== notesRequestGeneration) return
    await Navigation.present({ element: <NavigationStack>
      <ReminderNotesView id={parameters.id} standalone />
    </NavigationStack> })
  } catch (error) {
    await Dialog.alert({ title: "无法打开提醒事项备注", message: String(error) })
  }
}

async function run() {
  let stopResume: (() => void) | undefined
  let running = true
  try {
    try {
      if (typeof Script.onResume === "function") stopResume = Script.onResume((details: any) => {
        if (!running) return
        const parameters = details?.queryParameters
        if (parameters?.action === "reminder-notes" || parameters?.action === "open-reminder") {
          void presentReminderNotes(parameters)
        }
      })
    } catch { /* The initial route remains available on older hosts. */ }
    if (Script.queryParameters?.action === "reminder-notes" || Script.queryParameters?.action === "open-reminder") {
      await presentReminderNotes(Script.queryParameters)
      return
    }
    await Navigation.present({ element: <StartupScreen /> })
  }
  catch (error) { await Dialog.alert({ title: "启动界面未能打开", message: String(error) }) }
  finally { running = false; notesRequestGeneration++; try { stopResume?.() } catch { /* Already detached. */ } Script.exit() }
}
void run()
