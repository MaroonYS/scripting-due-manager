// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// Read-only upstream importer. Prints a reviewable generic manifest; never writes files.
import { execFileSync } from "node:child_process"
import { financialIconBrand, financialIconKeywords } from "../到期管家/src/financial_icon_keywords.ts"
const api = (path: string, raw = false) => execFileSync("gh", ["api", path, ...(raw ? ["-H", "Accept: application/vnd.github.raw+json"] : [])], { encoding: "utf8", maxBuffer: 8_000_000 })
const repo = "icongo/bank-logos"
const commit = JSON.parse(api(`repos/${repo}/commits/main`)).sha
if (!/^[a-f0-9]{40}$/.test(commit)) throw Error("Missing upstream commit")
const tree = JSON.parse(api(`repos/${repo}/git/trees/${commit}?recursive=1`))
if (tree.truncated) throw Error("Truncated upstream tree")
const paths = tree.tree.map((entry: any) => entry.path).filter((path: string) => /^logos\/[a-z0-9-]+\.svg$/.test(path)) as string[]
// Real SVG audit on 2026-09-09: these wide variants use inline CSS or exceed
// the renderer's bounded viewBox. Keep their valid square variants instead.
const excluded = new Set(["bangkokbank", "dyccb", "eastwestbank", "jx-bank", "megabank", "societegenerale", "z-bank"].map(slug => `logos/${slug}.svg`))
const readme = api(`repos/${repo}/contents/README.md?ref=${commit}`, true)
const names = new Map<string, Set<string>>()
for (const match of readme.matchAll(/<img\s+src="\.\/logos\/([a-z0-9-]+)\.svg"[^>]*\balt="([^"]+)"/g)) {
  const slug = match[1].replace(/-rect$/, ""), values = names.get(slug) ?? new Set<string>()
  values.add(match[2]); names.set(slug, values)
}
const labelOwners = new Map<string, Set<string>>()
for (const [slug, labels] of names) for (const label of labels) {
  const owners = labelOwners.get(label) ?? new Set<string>(); owners.add(slug); labelOwners.set(label, owners)
}
// Explicit corrections for reused README alt labels and labels omitted there.
const overrides: Record<string, string> = {
  hsbc: "HSBC 汇丰银行", sc: "Standard Chartered 渣打银行", hangseng: "Hang Seng Bank 恒生银行",
  hkbea: "Bank of East Asia 东亚银行", dahsing: "Dah Sing Bank 大新银行", dbs: "DBS 星展银行",
  ocbc: "OCBC 华侨银行", bankofamerica: "Bank of America 美国银行", jpmorganchina: "JPMorgan 摩根大通",
  barclays: "Barclays 巴克莱银行", citibank: "Citi 花旗银行", eastwestbank: "East West Bank 华美银行",
  boc: "中国银行", icbc: "中国工商银行", abchina: "中国农业银行", ccb: "中国建设银行", bankcomm: "交通银行",
  cmbchina: "招商银行", citicbank: "中信银行", cmbc: "中国民生银行", psbc: "中国邮政储蓄银行",
  pingan: "平安银行", spdb: "浦发银行", cib: "兴业银行", cebbank: "中国光大银行", cgbchina: "广发银行",
  bankofbeijing: "北京银行", bosc: "上海银行", bankoftianjin: "天津银行", xmbankonline: "厦门银行",
  ccabchina: "长安银行", jnbank: "济宁银行", hfrcbc: "合肥科技农村商业银行", norincogroup: "中国兵器工业集团",
  "china-cba": "中国银行业协会", zj96596: "浙江农村信用社联合社", trcbank: "天津农村商业银行", zaozhuangbank: "枣庄银行",
}
const icons = paths.filter(path => !excluded.has(path)).sort().map(path => {
  const file = path.slice(6, -4), square = file.endsWith("-rect"), slug = file.replace(/-rect$/, "")
  const labels = names.get(slug), candidate = labels?.size === 1 ? [...labels][0] : null
  const label = overrides[slug] ?? (candidate && labelOwners.get(candidate)?.size === 1 ? candidate : slug)
  const brand = financialIconBrand(slug === "sc" ? "Standard Chartered" : slug) ?? financialIconBrand(label)
  return { name: `${label} · ${square ? "方形" : "横版"}`, url: `https://raw.githubusercontent.com/${repo}/main/${path}`,
    ...(brand ? { brand: brand.name } : {}),
    aliases: `${slug} ${label} 金融 银行 ${financialIconKeywords(slug === "sc" ? "Standard Chartered" : slug)} ${financialIconKeywords(label)}`.trim() }
})
console.log(JSON.stringify({ name: "Bank Logos · 银行", source: `https://github.com/${repo}`, sourceCommit: commit,
  license: `https://github.com/${repo}/blob/${commit}/LICENSE`, description: "图案包含银行、机构和历史标志；名称按上游资料整理，不是当前银行或产品名录。名称不确定时保留文件标识。仅索引公开原图，不重新分发图像。",
  excludedUnsafeVariants: [...excluded], icons }, null, 2))
