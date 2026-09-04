import { Button, LabeledContent, Link, List, Script, Section, Text, useEffect, useState } from "scripting"
import { createLocalSnapshot } from "./recovery"
import { checkLatestRelease, compareVersions, freshPackageURL, type ReleaseInfo } from "./updates"

export function UpdateView() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<number | null>(null)
  const [gate] = useState(() => ({ busy: false }))

  const check = async () => {
    if (gate.busy) return
    gate.busy = true
    setChecking(true)
    setError(null)
    setRelease(null)
    try {
      const latest = await checkLatestRelease()
      // Validate the installed version as well before offering an install.
      compareVersions(latest.version, Script.metadata.version)
      setRelease(latest)
      setCheckedAt(Date.now())
    } catch (caught) {
      setError(String(caught))
    } finally {
      gate.busy = false
      setChecking(false)
    }
  }
  useEffect(() => { void check() }, [])

  const install = async () => {
    if (!release || gate.busy) return
    gate.busy = true
    setInstalling(true)
    try {
      const url = freshPackageURL(release, Script.metadata.version)
      createLocalSnapshot(`更新至 ${release.version} 前`)
      const opened = await Safari.openURL(Script.createImportScriptsURLScheme([url]))
      if (!opened) throw new Error("无法打开 Scripting 更新页面，请稍后重试。")
    } catch (caught) {
      await Dialog.alert({ title: "尚未开始更新", message: String(caught) })
    } finally {
      gate.busy = false
      setInstalling(false)
    }
  }
  const newer = release != null && compareVersions(release.version, Script.metadata.version) > 0

  return <List listStyle="insetGroup" navigationTitle="检查与更新版本" navigationBarTitleDisplayMode="inline">
    <Section footer={<Text>打开本页或点击重新检查时连接 GitHub，不会发送事项内容。安装前自动保存本地快照，随后仍需在 Scripting 中确认更新。</Text>}>
      <LabeledContent title="当前版本"><Text>{Script.metadata.version}</Text></LabeledContent>
      <LabeledContent title="最新版本"><Text>{release?.version ?? (checking ? "检查中…" : "尚未获取")}</Text></LabeledContent>
      {release ? <Text foregroundStyle={newer ? "systemBlue" : "secondaryLabel"}>
        {newer ? "发现新版本" : "当前版本已是最新"}
      </Text> : null}
      <Button title={checking ? "正在检查…" : "重新检查"} systemImage="arrow.clockwise"
        disabled={checking || installing} action={() => { void check() }} />
      {newer ? <Button title={installing ? "正在准备更新…" : "备份并安装更新"} systemImage="arrow.down.circle"
        disabled={installing} action={() => { void install() }} /> : null}
      {checkedAt ? <Text font="caption" foregroundStyle="secondaryLabel">上次成功检查：{new Date(checkedAt).toLocaleString()}</Text> : null}
      {error ? <Text foregroundStyle="systemOrange">{error}</Text> : null}
    </Section>
    {release ? <Section header={<Text>更新内容</Text>}>
      {release.publishedAt ? <Text font="caption" foregroundStyle="secondaryLabel">发布于 {new Date(release.publishedAt).toLocaleString()}</Text> : null}
      <Text>{release.notes}</Text>
      <Link url={release.pageURL}><Text>查看完整发行说明</Text></Link>
    </Section> : null}
  </List>
}
