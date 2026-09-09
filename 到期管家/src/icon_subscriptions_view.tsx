// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. Third-party artwork retains its own rights.

import { Button, Link, List, Section, Text, TextField, Toggle, useState } from "scripting"
import { fetchGithubManifest } from "./github_artwork"
import { DEFAULT_ICON_SUBSCRIPTIONS, iconSubscriptions, MAX_ICON_SUBSCRIPTIONS, normalizeIconSubscriptions } from "./icon_subscriptions"
import type { IconSubscription } from "./icon_subscriptions"
import { loadState, updateIconSubscriptions } from "./storage"

export function IconSubscriptionsView({ onSaved }: { onSaved: (sources: IconSubscription[]) => void }) {
  const [sources, setSources] = useState(() => iconSubscriptions(loadState().settings))
  const [name, setName] = useState("")
  const [url, setURL] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [gate] = useState(() => ({ active: false, pending: false, epoch: 0 }))
  const save = (next: IconSubscription[]) => {
    const saved = iconSubscriptions(updateIconSubscriptions(next, sources).settings)
    setSources(saved); onSaved(saved)
  }
  const change = (next: IconSubscription[]) => {
    try { save(next); setMessage("已保存图库订阅；已有事项图标不变。") }
    catch (error) { setMessage(error instanceof Error ? error.message : "保存失败，原设置已保留。") }
  }
  const add = async () => {
    if (gate.pending) return
    const epoch = gate.epoch
    gate.pending = true; setBusy(true); setMessage(null)
    try {
      const next = normalizeIconSubscriptions([...sources, { name, url: url.trim(), enabled: true }])
      const result = await fetchGithubManifest(next[next.length - 1], { refresh: true })
      if (!gate.active || gate.epoch !== epoch) return
      if (!result.icons.length) throw Error("这个清单暂时没有可用图标。")
      save(next); setName(""); setURL("")
      setMessage(`已添加，读取到 ${result.icons.length} 个图标。${result.warnings.join("；")}`)
    } catch (error) { if (gate.active && gate.epoch === epoch) setMessage(error instanceof Error ? error.message : "添加失败，原设置已保留。") }
    finally { gate.pending = false; if (gate.active) setBusy(false) }
  }
  return <List listStyle="insetGroup" navigationTitle="GitHub 图库订阅" navigationBarTitleDisplayMode="inline"
    onAppear={() => {
      gate.active = true; setBusy(gate.pending)
      try { setSources(iconSubscriptions(loadState().settings)) } catch { setMessage("读取订阅失败，未修改原数据。") }
    }} onDisappear={() => { gate.active = false; gate.epoch++ }}>
    <Section header={<Text>已添加 {sources.length} / {MAX_ICON_SUBSCRIPTIONS}</Text>}
      footer={<Text>开关与移除只影响图库搜索，不清除已为事项选择的图片。订阅设置随 JSON 备份保存；清单和图片不整库下载到磁盘。</Text>}>
      <Text font="caption" foregroundStyle="secondaryLabel">启用的图库将合并搜索，最多添加 12 个。</Text>
      {DEFAULT_ICON_SUBSCRIPTIONS.some(source => !sources.some(row => row.url === source.url)) ?
        <Button title="补回缺少的预设图库" disabled={busy} action={() => change([...sources, ...DEFAULT_ICON_SUBSCRIPTIONS.filter(source => !sources.some(row => row.url === source.url))])} /> : null}
    </Section>
    {sources.map(source => <Section key={source.url} header={<Text>{source.name}</Text>}>
        <Toggle value={source.enabled} disabled={busy} onChanged={(enabled: boolean) => change(sources.map(row => row.url === source.url ? { ...row, enabled } : row))}><Text>参与 GitHub 搜索</Text></Toggle>
        <Link url={source.url}><Text font="caption">查看公开清单</Text></Link>
        <Button title={`移除「${source.name}」订阅`} disabled={busy} action={() => change(sources.filter(row => row.url !== source.url))} />
    </Section>)}
    <Section header={<Text>自定义 JSON 图库</Text>} footer={<Text>{"支持 icons: [{name, url}] 清单，以及 selfh.st／Dashboard Icons／Simple Icons 的官方索引。接受 GitHub 文件页、Raw 或 jsDelivr GitHub 链接；仅加载公开 PNG／安全 SVG，不接受密钥、查询参数、脚本或私人服务器。请勿填写含私人信息的链接。"}</Text>}>
      <TextField title="图库名称" value={name} prompt="例如：我的应用图标" onChanged={setName} />
      <TextField title="JSON 链接" value={url} prompt="https://raw.githubusercontent.com/…/icons.json" onChanged={setURL} />
      <Button title={busy ? "正在验证清单…" : "验证并添加"} disabled={busy || !name.trim() || !url.trim() || sources.length >= MAX_ICON_SUBSCRIPTIONS} action={add} />
    </Section>
    {message ? <Section><Text font="caption" foregroundStyle="secondaryLabel">{message}</Text></Section> : null}
    <Section header={<Text>来源与使用说明</Text>} footer={<Text>预设仅引用上游公开链接，不搬运整库。各图案的商标与版权归其权利人；自定义图库请遵循原作者许可与署名要求。</Text>}>
      <Link url="https://github.com/sooyaaabo/IconLibrary"><Text>恩秀 IconLibrary · sooyaaabo · 作者使用说明</Text></Link>
      <Link url="https://github.com/selfhst/icons"><Text>Icons by selfh.st/icons · CC BY 4.0</Text></Link>
      <Link url="https://github.com/icongo/bank-logos"><Text>Bank Logos · IconGo · MIT；方形与横版含历史标志</Text></Link>
      <Link url="https://github.com/simple-icons/simple-icons"><Text>Simple Icons · CC0；单色品牌标志</Text></Link>
      <Link url="https://github.com/homarr-labs/dashboard-icons"><Text>Dashboard Icons · homarr-labs · 上游许可</Text></Link>
    </Section>
  </List>
}
