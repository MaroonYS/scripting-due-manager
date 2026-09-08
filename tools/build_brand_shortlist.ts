// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

/** Research-only editorial shortlist. Does not fetch or approve any artwork. */
import { dirname, join } from "node:path"
import { sectorPicks, subscriptionCategories } from "./brand_sector_additions"

const snapshotPath = process.argv[2]
if (!snapshotPath) throw new Error("Provide a chart snapshot JSON path")
const snapshot = await Bun.file(snapshotPath).json()
const day = snapshot.startedAt.slice(0, 10)
const base = dirname(snapshotPath)
type Pick = [name: string, ...appIDs: string[]]
const picks: Record<string, Pick[]> = {
  "美国银行与信用卡": [
    ["Capital One", "407558537"], ["Chase", "298867247"],
    ["Bank of America", "284847138"], ["Wells Fargo", "311548709"],
    ["Citi", "301724680"], ["American Express", "362348516"],
    ["U.S. Bank", "458734623"], ["SoFi", "1191985736"],
    ["Chime", "836215269"], ["Fifth Third", "468738585"],
  ],
  "中国大陆银行与信用卡": [
    ["中国农业银行", "515651240"], ["中国工商银行", "423514795"],
    ["中国建设银行", "391965015"], ["中国银行", "399608199"],
    ["招商银行／掌上生活", "392899425", "398453262"],
    ["交通银行／买单吧", "337876534", "1057446665"],
    ["邮储银行", "493489515"], ["平安口袋银行", "1085016815"],
    ["中信银行／动卡空间", "422844108", "487967179"],
    ["兴业银行", "433592972"], ["浦发银行／浦大喜奔", "471855847", "974428942"],
    ["民生银行", "523091708"], ["光大银行", "447733826"],
  ],
  "香港银行与信用卡": [
    ["中银香港／BoC Pay+", "1534534188", "1403690384"],
    ["汇丰香港／Reward+", "1164066737", "1315948639"],
    ["恒生银行", "1039256353"], ["渣打香港", "445795688"],
    ["Mox", "1505743481"], ["ZA Bank", "1477150600"],
    ["DBS Card+ HK", "382581448"], ["东亚银行", "381215704"],
    ["建行港澳", "1434519981"], ["Amex Hong Kong", "628054799"],
    ["AEON HK", "1332612057"],
  ],
  "英国银行与信用卡": [
    ["Lloyds", "469964520"], ["Monzo", "1052238659"],
    ["NatWest", "334855322"], ["Nationwide", "542355130"],
    ["Santander UK", "482973524"], ["Barclays／Barclaycard", "536248734", "596487185"],
    ["Starling", "956806430"], ["HSBC UK", "1220329065"],
    ["Capital One UK", "481679012"], ["Chase UK", "1517121245"],
    ["Zopa", "1324011914"], ["Halifax", "486355738"],
    ["Amex UK", "399021772"],
  ],
  "支付与汇款": [
    ["PayPal", "283646709"], ["Cash App", "711923939"], ["Venmo", "351727428"],
    ["Klarna", "1115120118"], ["Revolut", "932493382"], ["Wise", "612261027"],
    ["支付宝", "333206289"], ["AlipayHK", "1210638245"], ["八达通", "1114430602"],
    ["云闪付", "600273928"], ["PayMe", "1184264977"], ["Remitly", "674258465"],
  ],
  "保险、信用与投资记录": [
    ["Credit Karma", "519817714"], ["Experian US", "1087101090"],
    ["Experian UK", "1114748256"], ["环联香港", "1600437761"],
    ["ClearScore", "1056640628"], ["GEICO", "331763096"],
    ["Progressive", "349731802"], ["State Farm", "318142137"],
    ["AIA HK", "1292514758"], ["AXA HK", "1456962787"],
    ["中国人寿", "765577833"], ["中国人保", "710189980"],
    ["TradingView", "1205990992"], ["富途牛牛", "592031984"], ["IBKR", "454558592"],
  ],
  "AI 与数字订阅": [
    ["ChatGPT", "6448311069"], ["Claude", "6473753684"], ["Google Gemini", "6477489729"],
    ["Grok", "6670324846"], ["DeepSeek", "6737597349"], ["豆包", "6459478672"],
    ["千问", "6466733523"], ["Kimi", "6474233312"], ["Perplexity", "1668000334"],
  ],
  "视频与娱乐订阅": [
    ["Netflix", "363590051"], ["Disney+", "1446075923"], ["Prime Video", "545519333"],
    ["HBO Max", "1666653815"], ["Hulu", "376510438"], ["Peacock", "1508186374"],
    ["Paramount+", "530168168", "1340650234"], ["腾讯视频", "458318329"],
    ["爱奇艺", "393765873"], ["优酷", "336141475"], ["哔哩哔哩", "736536022", "1517062289"],
  ],
  "音乐与音频": [
    ["Spotify", "324684580"], ["YouTube Music", "1017492454"], ["QQ音乐", "414603431"],
    ["网易云音乐", "590338362"], ["酷狗音乐", "472208016"], ["汽水音乐", "1605585211"],
    ["SoundCloud", "336353151"], ["TIDAL", "913943275"], ["Suno", "6480136315"],
  ],
  "办公与效率": [
    ["Microsoft Teams", "1113153706"], ["Zoom", "546505307"], ["企业微信", "1087897068"],
    ["钉钉", "930368978"], ["飞书", "1401729613"], ["Slack", "618783545"],
    ["WPS Office", "599852710"], ["Notion", "1232780281"], ["Goodnotes", "1444383602"],
  ],
  "网盘与存储": [
    ["Google Drive", "507874739"], ["Dropbox", "327630330"], ["OneDrive", "477537958"],
    ["百度网盘", "547166701"], ["阿里云盘", "1494661473"], ["夸克网盘", "6755949705"],
  ],
  "创作与设计": [
    ["Canva", "897446215"], ["CapCut", "1500855883"], ["剪映", "1458072671"],
    ["Lightroom", "878783582"], ["Adobe Express", "1051937863"],
    ["Figma", "1152747299"], ["Procreate Pocket", "916366645"],
  ],
  "健康、健身与运动": [
    ["Strava", "426826309"], ["AllTrails", "405075943"], ["Keep", "952694580"],
    ["MyFitnessPal", "341232718"], ["Calm", "571800810"], ["PureGym", "588860938"],
    ["24/7 Fitness", "1471090850"], ["Planet Fitness", "399857015"],
  ],
  "购物与会员": [
    ["Costco", "535509415", "1593445613"], ["山姆会员商店", "818237113"],
    ["Walmart", "338137227"], ["京东", "414245413"], ["淘宝", "387682726"],
    ["Tesco", "389581236"], ["拼多多", "1044283059"],
  ],
  "餐饮与外卖": [
    ["Starbucks", "331177714", "636266448", "1499149941"], ["瑞幸咖啡", "1296749505"],
    ["McDonald's", "922103212", "1054598922", "1217507712", "1082476620"],
    ["DoorDash", "719972451"], ["Keeta", "1662451643"], ["美团", "423084029"],
  ],
  "旅行与交通": [
    ["Uber", "368677368"], ["Lyft", "529379082"], ["Airbnb", "401626263"],
    ["Trip.com", "681752345"], ["携程", "379395415"], ["滴滴", "554499054"],
    ["Trainline", "334235181"], ["MTR Mobile", "369295276"],
  ],
  "导航": [
    ["Google Maps", "585027354"], ["高德地图", "461703208"],
    ["Waze", "323229106"], ["Citymapper", "469463298"],
  ],
  "教育与参考": [
    ["Duolingo", "570060128"], ["Google Classroom", "924620788"],
    ["有道词典", "353115739"], ["Google Translate", "414706506"],
  ],
  "阅读与有声书": [
    ["Kindle", "302584613"], ["Audible", "379693831"], ["微信读书", "952059546"],
    ["喜马拉雅", "876336838"], ["Kobo", "301259483"],
  ],
  "新闻与报刊订阅": [
    ["The New York Times", "284862083"], ["The Wall Street Journal", "364387007"],
    ["The Times", "436792321"], ["The Telegraph", "388947468"],
    ["South China Morning Post", "623201967"], ["Substack", "1581650857"],
    ["香港01", "1084662006"],
  ],
  "通讯、社交与安全": [
    ["微信", "414478124"], ["QQ", "444934666"], ["Telegram", "686449807"],
    ["Discord", "985746746"], ["LinkedIn", "288429040"],
    ["NordVPN", "905953485"], ["ExpressVPN", "886492891"], ["Surfshark", "1391782046"],
    ["中国移动", "583700738"], ["中国联通", "416457422"], ["中国电信", "513836029"],
  ],
  "开发工具": [
    ["GitHub", "1477376905"], ["Replit", "1614022293"],
  ],
  "天气": [
    ["Windy.com", "1161387262"], ["AccuWeather", "300048137"],
    ["彩云天气", "847764912"], ["MyObservatory", "361319719"],
  ],
  "医疗与生活服务": [
    ["CVS Health", "395545555"], ["MyChart", "382952264"], ["HA Go", "1469340861"],
    ["NHS App", "1388411277"],
  ],
  "游戏": [
    ["王者荣耀", "989673964"], ["和平精英", "1321803705"],
  ],
}

const cryptoCards = [
  ["RedotPay", "https://www.redotpay.com/card"],
  ["Bybit Card", "https://www.bybit.com/cards/"],
  ["Crypto.com Prepaid Card", "https://help.crypto.com/en/articles/1345769-how-to-apply-for-a-crypto-com-prepaid-card"],
  ["Wirex", "https://help.wirexapp.com/article/what-is-the-wirex-card-1300"],
  ["Nexo Card", "https://nexo.com/crypto-card"],
  ["OKX Card", "https://www.okx.com/en-gb/help/whats-okx-card"],
  ["Bitget Wallet Card", "https://web3.bitget.com/card"],
  ["SafePal / Fiat24", "https://www.safepal.com/en/bank"],
  ["TokenPocket TP Card", "https://help.tokenpocket.pro/en/wallet-operation/tp-card/faq"],
  ["Pionex Card", "https://support.pionex.com/hc/en-us/sections/47904768884633-Pionex-Card"],
  ["ether.fi Cash", "https://help.ether.fi/en/articles/262378-frequently-asked-questions"],
  ["MetaMask Card", "https://metamask.io/card"],
]

function chartEvidence(name: string, appIDs: string[]) {
  return appIDs.map(appID => {
    const matches = snapshot.charts.flatMap((chart: any) => chart.entries
      .filter((entry: any) => entry.appID === appID)
      .map((entry: any) => ({ region: chart.region, category: chart.category, chart: chart.chart,
        rank: entry.rank, name: entry.name, developer: entry.developer,
        appStoreURL: entry.appStoreURL, source: chart.source, capturedAt: chart.capturedAt })))
    if (matches.length === 0) throw new Error(`No chart evidence for ${name} (${appID})`)
    return { appID, appearances: matches }
  })
}
const seenNames = new Set<string>()
const candidates = Object.entries(picks).flatMap(([group, rows]) => rows.map(([name, ...appIDs]) => {
  if (seenNames.has(name) || new Set(appIDs).size !== appIDs.length) throw new Error(`Duplicate shortlist selection: ${name}`)
  seenNames.add(name)
  const evidence = chartEvidence(name, appIDs)
  return { name, group, kind: "editorial-chart-candidate", evidence,
    identityStatus: "store-metadata-cross-check-only", logoStatus: "not-approved-or-packaged" }
}))

const supplements = cryptoCards.map(([name, officialSource]) => ({
  name, group: "U卡／加密货币支付卡", kind: "official-product-page-supplement",
  officialSource, checkedOn: day, chartRank: null,
  logoStatus: "not-approved-or-packaged", regionEligibility: "not-assessed",
  note: "Only identifies a card product; not a product recommendation, safety rating, fee comparison or application eligibility claim.",
}))
const deferred = [{
  name: "Gnosis Pay", status: "service-transition-review", checkedOn: day,
  officialSource: "https://gnosispay.com/blog/gnosis-pay-the-next-era",
  note: "2026-09-03 official announcement describes a transition toward enterprise partners and winding down direct-to-consumer services. Keep separate from ordinary current candidates.",
}]

const sectorNames = new Set<string>()
const sectorCatalog = sectorPicks.map(pick => {
  if (sectorNames.has(pick.name)) throw new Error(`Duplicate sector selection: ${pick.name}`)
  sectorNames.add(pick.name)
  if (!pick.officialSource.startsWith("https://")) throw new Error(`Invalid reference: ${pick.name}`)
  const existing = candidates.find(candidate => candidate.name === pick.name)
  return { ...pick, kind: "editorial-sector-reference", checkedOn: "2026-09-08",
    isAdditionalCandidate: !existing, chartRank: null,
    evidence: existing?.evidence ?? chartEvidence(pick.name, pick.appIDs ?? []),
    sourceReview: "brand-or-product-reference-only; artwork-permission-not-assessed",
    logoStatus: "not-approved-or-packaged", regionEligibility: "not-assessed" }
})
const sectorSupplements = sectorCatalog.filter(candidate => candidate.isAdditionalCandidate)
const allCandidateNames = new Set([...candidates, ...supplements, ...sectorSupplements].map(candidate => candidate.name))
if (allCandidateNames.size !== candidates.length + supplements.length + sectorSupplements.length) {
  throw new Error("Candidate names overlap across independent source lists")
}
for (const [category, names] of Object.entries(subscriptionCategories)) {
  if (new Set(names).size !== names.length) throw new Error(`Duplicate subscription reference: ${category}`)
  for (const name of names) if (!allCandidateNames.has(name)) throw new Error(`Unknown subscription candidate: ${name}`)
}
const subscriptionCandidateCount = new Set(Object.values(subscriptionCategories).flat()).size

const result = {
  schemaVersion: 2, createdAt: new Date().toISOString(), snapshotPath,
  purpose: "Proposed widget logo sourcing scope only. Does not implement the style selector or grant artwork permission.",
  summary: { chartBasedCandidates: candidates.length, cryptoCardSupplements: supplements.length,
    additionalSectorCandidates: sectorSupplements.length, totalCandidates: allCandidateNames.size,
    telecomCandidates: sectorCatalog.filter(candidate => candidate.sector === "telecom").length,
    automotiveCandidates: sectorCatalog.filter(candidate => candidate.sector === "automotive").length,
    subscriptionCandidates: subscriptionCandidateCount,
    subscriptionCategories: Object.keys(subscriptionCategories).length,
    candidateGroups: new Set([...candidates, ...supplements, ...sectorSupplements].map(candidate => candidate.group)).size,
    deferred: deferred.length,
    approvedLogoAssets: 0, packagedLogoAssets: 0 },
  candidates, supplements, sectorCatalog, subscriptionCategories, deferred,
}
const jsonPath = join(base, `candidate-shortlist-${day}.json`)
await Bun.write(jsonPath, JSON.stringify(result, null, 2) + "\n")

const cell = (s: string) => s.replaceAll("|", "\\|").replaceAll("\n", " ")
const md: string[] = [
  `# 品牌图标候选清单 · ${day}`, "",
  "本文件记录候选采集阶段的依据，不作为当前运行版本或素材覆盖率声明。后续完整图标库及验收范围见 [v2.7.0 验证说明](../QA-v2.7.0.md)，已内置图案以 [素材来源](../../到期管家/assets/brands/SOURCES.md) 为准。", "",
  "## 采集口径", "",
  "- 地区：美国（us）、中国大陆（cn）、香港（hk）、英国（gb）。地区仅表示 App Store 榜单来源，不表示银行或 U卡可在该地开户、申请或使用。",
  "- Apple 分类免费榜为主、付费榜作补充，分别保留名次；不把两类榜单混成一个下载量排名。采集的是榜单快照，不是 Apple 未提供的下载量数据。",
  `- 分类来自 [Apple 公开分类目录](${snapshot.genreSource})，共 ${snapshot.categories.length} 个一级条目；游戏按一级分类收集，不展开游戏子类别、儿童年龄段或 iPad 榜单。`,
  `- 请求 ${snapshot.summary.requestedCharts} 份榜单，取得 ${snapshot.summary.successfulCharts} 份有效榜单、${snapshot.summary.rankedEntries.toLocaleString("en-US")} 条排名记录；按 App ID 去重为 ${snapshot.summary.uniqueAppIDs.toLocaleString("en-US")} 个 App，不等于同样数量的品牌。`,
  "- 无返回条目及不足 50 项的榜单如实列出；不补造第 50 名，也不以其他地区结果冒充缺失榜单。",
  `- 采集窗口：${snapshot.startedAt} 至 ${snapshot.completedAt}（UTC）。[完整快照](./app-store-charts-${day}.json) 保留来源 URL、采集时间、榜单更新时间、App ID、开发者与名次。`,
  "- 未保存应用介绍、评论、广告、图片或任何个人事项数据。下面的短名单是人工优先级筛选，不宣称是各类完整前 50，也不自动把榜上 App 当成知名品牌的官方 App。", "",
  "## 建议首批核对范围", "",
  `共 ${allCandidateNames.size} 个不重复的候选品牌／产品组：原有 ${candidates.length} 个榜单候选、${supplements.length} 个 U卡产品，以及本轮新增 ${sectorSupplements.length} 个行业候选。行业索引包含 ${result.summary.telecomCandidates} 个手机运营商／消费品牌、${result.summary.automotiveCandidates} 个汽车品牌，订阅／会员／续费索引含 ${subscriptionCandidateCount} 个候选、${Object.keys(subscriptionCategories).length} 类。这些索引会引用已有候选，不能把各索引人数再相加。`,
  "地区版本与同品牌不同产品保留 App ID；能共享同一标志的版本只在后续人工确认后复用资产。候选采集阶段批准或打包的 Logo 数量为 0；此处及候选 JSON 的统计不包含后续实现所加入的素材。", "",
  "## 本轮增补口径", "",
  "- 手机服务按美国、中国大陆、香港、英国的消费品牌分组，涵盖网络运营商、虚拟运营商及子品牌；品牌数量不是持牌网络运营商数量。不在此表推断母公司、底层网络或开户资格。",
  "- 汽车表是人工挑选的品牌候选，不是汽车销量排名或所谓 App Store 汽车类前 50；在原快照中找到的官方 App 可补充 App ID 依据。车系、车型及集团归属不自动视为可共用同一 Logo。",
  "- 订阅按服务用途分类，不限于 App Store 内购。套装与单独服务允许各自标识，但相同服务的月付、年付、家庭版不重复建品牌。包含免费层、会员和按量／续费账单的服务，不宣称每个 App 都是收费订阅。",
  "- 官网与集团／监管资料仅用于识别候选和记录入口；部分页面依赖 JavaScript 或限制访问，不代表已逐项核完身份、服务现状及素材权利。没有提供下载量、价格、费率或可申请地区结论。", "",
  "## 订阅、会员与续费分类索引", "",
  "以下引用同一候选库，不新增重复记录。原有 App Store 依据与新增官网入口见各候选表；具体套餐名、适用地区和续费方式留待实际匹配时核实。", "",
  "| 类别 | 候选服务／品牌 |", "| --- | --- |",
]
for (const [group, names] of Object.entries(subscriptionCategories)) md.push(`| ${cell(group)} | ${cell(names.join("、"))} |`)
md.push("", "## 原有榜单候选", "")
for (const [group, rows] of Object.entries(picks)) {
  md.push(`### ${group}`, "", "| 候选品牌／产品 | App Store 依据 |", "| --- | --- |")
  for (const [name] of rows) {
    const candidate = candidates.find(candidate => candidate.name === name)!
    const links = candidate.evidence.map(e => {
      const a = e.appearances[0]
      return `[${e.appID}](${a.appStoreURL})`
    }).join("、")
    md.push(`| ${cell(name)} | ${links} |`)
  }
  md.push("")
}
md.push("## 运营商、汽车及订阅服务增补", "",
  "「沿用已有候选」不重复计数；App ID 仅在原榜单快照确有证据时列出。官网／集团资料不等于 Logo 使用授权。", "")
for (const group of new Set(sectorCatalog.map(candidate => candidate.group))) {
  md.push(`### ${group}`, "", "| 候选品牌／服务 | 来源依据 | 计数 |", "| --- | --- | --- |")
  for (const candidate of sectorCatalog.filter(candidate => candidate.group === group)) {
    const chartLinks = candidate.evidence.map(e => `[${e.appID}](${e.appearances[0].appStoreURL})`).join("、")
    md.push(`| ${cell(candidate.name)} | [官网／官方资料](${candidate.officialSource})${chartLinks ? `；${chartLinks}` : ""} | ${candidate.isAdditionalCandidate ? "新增" : "沿用已有候选"} |`)
  }
  md.push("")
}
md.push("### U卡／加密货币支付卡（独立补充）", "",
  "仅确认产品身份与官方资料入口，不给出返现、费率、开户资格、资产安全评级或使用建议；并非所有产品都直接支持 USDT，借记、预付和抵押信用模式也不混为一谈。", "",
  "| 候选产品 | 官方资料 |", "| --- | --- |")
for (const candidate of supplements) md.push(`| ${candidate.name} | [产品说明](${candidate.officialSource}) |`)
md.push("", "Gnosis Pay 单列待复核：其 [2026-09-03 官方公告](https://gnosispay.com/blog/gnosis-pay-the-next-era) 提到转向企业合作方并逐步退出直接面向消费者的服务，不按普通在售消费卡处理。", "",
  "## Logo 来源与使用边界", "",
  "1. App Store 榜单用于发现品牌，不等于授权把 App 图标批量复制进组件。[Apple iTunes Search API 的图标使用说明](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html) 有推广用途和相邻下载入口等条件，不能直接视为本项目使用场景的通用授权。",
  "2. 优先核对品牌官网的资源中心、品牌规范及正式授权材料。记录准确的来源、版本、许可条件、允许的配色与最小尺寸；没有核实的继续用系统图标。",
  "3. 不把自行描摹、第三方图标库或近似 App 的图标冒称为官方 Logo；App 名称相似或排名靠前都不足以确认发布者身份。",
  "4. 不声称品牌背书或取得第三方标志的独占权；第三方资产不纳入项目原创版权主张。个人自用与公开 GitHub 发行需要分别检查素材使用条件。",
  "5. [Spotify 规范](https://developer.spotify.com/documentation/design) 对颜色、留白和最小尺寸有具体要求；[SafePal 资源规范](https://www.safepal.com/en/brandassets) 也限制修改和暗示合作。系统桌面着色可能改变图像观感，需采用允许的方案或回退系统符号。", "",
  "## 双样式交互约定（待实现）", "",
  "- 设置提供「系统图标」与「品牌 Logo 优先」两种选择；默认系统图标，旧安装不改变外观。当前讨论范围是小型组件，中、大型保持现状。",
  "- 品牌模式仅对已确认匹配且有可用本地素材的事项生效；缺少、损坏、冲突或不适配当前显示模式时回退系统图标，不显示空白占位。",
  "- 主图标无论使用哪种外观，始终调用原有完成事项意图；不得改成品牌 App、银行网站或 App Store 跳转。标题与下一项预告的详情跳转保持原样。",
  "- 保留原有事项身份、发生期标识、幂等完成、只读／过期缓存保护。仅更换外观，不改变事项类型、到期日、排序、同步或通知。",
  "- 用户明确指定的图标或品牌优先于自动识别；自动识别不能仅凭「银行」「卡」「AI」等泛词猜品牌，多个品牌冲突时不强行选第一个。",
  "- 运营商由用户明确选择或完整品牌名称识别；不读取 SIM、通讯录，也不上传号码或按手机号号段断言现运营商。携号转网会使原号段失去当前运营商的确定性，见 [OFCA 说明](https://www.ofca.gov.hk/filemanager/ofca/en/content_113/telecommunications.pdf)。",
  "- 汽车优先用完整品牌名称／确认选择；「理想」「坦克」「大众」「3」「EE」「NOW」等歧义词、短缩写或数字不得做无边界包含匹配；车型不会直接触发集团 Logo。",
  "- 区分英国 NOW 与香港 Now TV、Viu 与 ViuTV、Apple TV 订阅与硬件／App、Prime Video 与 Amazon Prime 套装；不能仅因同名或包含关系自动合并。",
  "- 图标素材使用本机资源，组件展示不在线查询品牌，也不上传标题、金额、备注或账户信息。切换后请求刷新，但不承诺 WidgetKit 即时重绘。",
  "- 原主图标 17 pt、点击区域 40 pt；底部图标 11 pt。Logo 的最小尺寸、留白和光学大小须真机核验，不用缩小点击区域来塞下完整文字 Logo。", "",
  "## 榜单覆盖与缺口", "",
  "单元格为免费榜条数／付费榜条数；— 表示当前接口未返回有效排名条目。", "",
  "| Apple 类别 | 美国 | 中国大陆 | 香港 | 英国 |", "| --- | ---: | ---: | ---: | ---: |")
for (const category of snapshot.categories) {
  const counts = snapshot.regions.map((region: string) => snapshot.chartTypes.map((type: string) => {
    const chart = snapshot.charts.find((c: any) => c.region === region && c.category.id === category.id && c.chart === type)
    return chart?.status === "ok" ? String(chart.entries.length) : "—"
  }).join(" / "))
  md.push(`| ${cell(category.name)} (${category.id}) | ${counts.join(" | ")} |`)
}
md.push("", "本次 Catalogs 与 Stickers 两个目录条目在四区均无有效条目；中国大陆 News 两份榜单亦无有效条目。四区 Magazines & Newspapers 的付费榜少于 50 项。缺口不被解释为对应品牌或应用不存在。", "",
  "## 复核与复现", "", "```sh",
  `bun tools/collect_app_store_charts.ts docs/brand-catalog/app-store-charts-${day}.json`,
  `bun tools/build_brand_shortlist.ts docs/brand-catalog/app-store-charts-${day}.json`,
  "```", "", "重跑会得到新的即时榜单，应使用新的日期或独立文件保留原快照，不应把未来结果继续标成此次快照。", "")
const reportPath = join(base, `品牌图标候选清单-${day}.md`)
await Bun.write(reportPath, md.join("\n"))
console.log(JSON.stringify(result.summary))
console.log(`Saved ${jsonPath}\nSaved ${reportPath}`)
