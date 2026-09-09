// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. Third-party artwork retains its own rights.

import { Button, Link, List, Section, Text, useEffect, useState } from "scripting"
import { Icons8MCPLogin, disconnectIcons8MCP, refreshIcons8MCP, verifyIcons8MCP } from "./icons8_mcp"
import { hasIcons8MCPSession } from "./icons8_mcp_credentials"
import { iconKeychainAvailable } from "./icon_credentials"
import { mcpError } from "./icons8_mcp_protocol"

export function Icons8MCPAccountView({ onChanged }: { onChanged: () => void }) {
  const [connected, setConnected] = useState(hasIcons8MCPSession)
  const [status, setStatus] = useState("首次使用请连接免费账号。测试包里的临时登录不会自动迁移。")
  const [logs, setLogs] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [gate] = useState(() => ({ active: false, busy: false, login: null as Icons8MCPLogin | null }))
  useEffect(() => () => { gate.active = false; gate.login?.cancel() }, [])
  const progress = (message: string) => {
    if (gate.active) { setStatus(message); setLogs(previous => [...previous.slice(-19), message]) }
  }
  const action = async (run: () => Promise<void>) => {
    if (gate.busy || !gate.active) return
    gate.busy = true; setBusy(true)
    try { await run() }
    catch (error) { progress(mcpError(error)) }
    finally {
      gate.busy = false; gate.login = null
      if (gate.active) { setBusy(false); setConnected(hasIcons8MCPSession()); onChanged() }
    }
  }
  const connect = () => action(async () => {
    setLogs([])
    gate.login = new Icons8MCPLogin(progress)
    await gate.login.connect()
    if (!gate.active) return
    setConnected(hasIcons8MCPSession())
    progress("登录已保存，正在检查图标搜索连接…")
    await verifyIcons8MCP()
    progress("已连接 Icons8。返回上一页即可搜索、选择并保存到事项。")
  })
  const clear = () => action(async () => {
    if (!await Dialog.confirm({ title: "清除本机 Icons8 登录？", message: "不会删除 Icons8 账号、旧 REST API Key 或事项已选图标。下次在线搜索需重新登录。", confirmLabel: "清除", cancelLabel: "取消" })) return
    if (!gate.active) return
    disconnectIcons8MCP()
    progress("已清除本机 MCP 登录，已有事项图标保留。")
  })
  return <List listStyle="insetGroup" navigationTitle="连接 Icons8 免费账号" navigationBarTitleDisplayMode="inline"
    onAppear={() => { gate.active = true; setBusy(gate.busy); setConnected(hasIcons8MCPSession()) }}
    onDisappear={() => { if (!gate.login?.browserOpen) { gate.active = false; gate.login?.cancel() } }}>
    <Section header={<Text>Windows 11 Color 图库</Text>} footer={<Text>使用 Icons8 官方 MCP，免费账号可搜索并使用 PNG，保留 Icons8 署名。此入口不购买套餐，也不请求付费 SVG。</Text>}>
      <Text>{connected ? "本机已保存登录；在线搜索会按需续期。" : "尚未连接 Icons8 免费账号。"}</Text>
      <Button title={busy ? "连接操作进行中…" : connected ? "重新登录或更换账号" : "登录 Icons8 免费账号"} disabled={busy || !iconKeychainAvailable()} action={connect} />
      <Text font="caption" foregroundStyle="secondaryLabel">{status}</Text>
    </Section>
    <Section header={<Text>登录操作提示</Text>} footer={<Text>浏览器回调需要 Scripting 的 HttpServer（Pro）；已在 TestFlight 3.3.0 + Pro 验证基础流程。密码只在 Icons8 官方页面输入，不要发到聊天。</Text>}>
      <Text>授权页出现「已收到 Icons8 授权」后，点左上角的 × 关闭网页；不要点页面底部的返回箭头。回到这里会继续显示验证进度。</Text>
      <Text font="caption" foregroundStyle="secondaryLabel">登录最多等待五分钟；网络步骤有超时提示。离开此账号页会取消尚未完成的登录，不会覆盖原凭据。</Text>
    </Section>
    {connected ? <Section header={<Text>连接维护</Text>}>
      <Button title="检查图标搜索连接" disabled={busy} action={() => action(async () => { progress("正在检查连接…"); await verifyIcons8MCP(); progress("图标搜索连接正常。") })} />
      <Button title="验证登录续期" disabled={busy} action={() => action(async () => { progress("正在验证登录续期…"); await refreshIcons8MCP(); progress("登录续期成功。") })} />
    </Section> : null}
    <Section footer={<Text>登录凭据仅保存到当前脚本的本机钥匙串，不同步 iCloud，不进入事项、JSON 备份、安装包或公开仓库。已选 PNG 的显示不需要再次登录。</Text>}>
      <Button title="清除本机 MCP 登录" disabled={busy || !iconKeychainAvailable()} action={clear} />
    </Section>
    {logs.length ? <Section header={<Text>连接记录（不含凭据）</Text>}>
      {logs.map((line, index) => <Text key={index} font="caption" foregroundStyle="secondaryLabel">{line}</Text>)}
    </Section> : null}
    <Section><Link url="https://icons8.com/icons/fluency"><Text>Icons8 · Windows 11 Color 原图库</Text></Link>
      <Link url="https://icons8.com/mcp/"><Text>Icons8 MCP 免费 PNG 与署名说明</Text></Link></Section>
  </List>
}
