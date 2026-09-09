// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// Maintainer-only asset build. Never imported by the Scripting runtime.
// The project owner confirmed offline/public package redistribution permission.
// This does not grant downstream users a standalone artwork license.
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const target = resolve(root, "到期管家/assets/icons8")
const download = process.argv.includes("--download")
const excluded = /^(AI|AI Chatting|Sparkles|Anti WeChat|Attract Customers|Square and compasses|TikTok Verified Account|PС Game|Ex Source|Windows 95|Bin Windows|Get Help|Get Started App|Magnifier|Narrator|On-Screen Keyboard|Windows Memory Diagnosis|Windows Defragmenter|Disk Cleanup|Neurodiverse|Chat Space|Notification)$/i
const groupNames: Record<string, string> = {
  Adobe: "设计创作", Ai: "AI 服务", Apple: "Apple", Browsers: "浏览器与网络", Enterprise: "办公效率",
  Cinema: "影音娱乐", "Cloud storage": "云服务与安全", "Video games": "游戏", "Creative software": "设计创作",
  "Eating places": "购物生活", Education: "学习阅读", "Google services": "Google", Hardware: "设备工具",
  Marketing: "购物生活", Messengers: "社交通讯", Microsoft: "Microsoft", Music: "影音娱乐",
  Networks: "浏览器与网络", Ecommerce: "购物与支付", Publishing: "学习阅读", "Search engines": "浏览器与网络",
  "Software development": "开发工具", "Social bookmarking": "社交通讯", "Social media": "社交通讯",
  Sports: "运动", Streaming: "影音娱乐", Transport: "出行旅行", Travel: "出行旅行", Utilities: "效率工具",
  "Photo and video": "影音创作", Other: "其他应用", General: "生活图标",
}
const aliases: Record<string, string> = {
  "budget": "预算 預算", "debt": "债务 債務 还款 還款", "investment": "投资 投資 理财 理財", "bank-cards": "银行卡 銀行卡 信用卡",
  "card-payment": "刷卡 付款", "card-security": "支付安全", "certificate": "证书 證書 认证 認證", "credit-card": "信用卡 还款 還款",
  "debit-card": "储蓄卡 儲蓄卡", "bill": "账单 帳單", "billing": "账务 帳務 缴费 繳費", "invoice": "发票 發票",
  "paid-bill": "已付账单 已付帳單", "pay-date": "付款日期 发薪日 發薪日", "payment-history": "付款记录 付款記錄",
  "receipt": "收据 收據", "tax": "税务 稅務", "banknotes": "纸币 紙幣 现金 現金", "card-wallet": "卡包 钱包 錢包",
  "cash": "现金 現金", "coins": "硬币 硬幣", "dollar-bag": "钱袋 錢袋 存款", "calendar": "日历 行事曆 日曆",
  "tear-off-calendar": "台历 臺曆", "today": "今天", "weekend": "周末 週末", "calendar-plus": "新增日程", "event-accepted": "预约 預約 约定 約定",
  "view-schedule": "日程 排程", "alarm-clock": "闹钟 鬧鐘", "clock": "时钟 時鐘", "stopwatch": "秒表 碼錶", "timer": "计时器 計時器",
  "birthday": "生日 纪念 週年", "celebrate": "庆祝 慶祝", "event": "活动 活動", "meeting": "会议 會議", "season-sale": "促销 促銷 打折",
  "deadline": "截止 到期", "hourglass": "沙漏", "countdown": "倒计时 倒數計時", "plumbing": "水管 维修 維修", "spa": "水疗 水療 保养 保養",
  "water-pipe": "水费 水費 水管", "bed": "睡眠 床 酒店", "cutlery": "餐饮 餐飲 餐具", "doorbell": "门铃 門鈴", "key": "钥匙 鑰匙 租房",
  "book-shelf": "书籍 書籍 书架 書架 阅读 閱讀", "crib": "婴儿 嬰兒 亲子 親子", "garage": "车库 車庫 停车 停車",
  "central-heating": "暖气 暖氣 供暖", "air-conditioner": "空调 空調", "apple-homepod": "苹果音箱 蘋果音箱", "appliances": "家电 家電",
  "camera-automation": "监控 監控 摄像头 攝影機", "home-automation": "智能家居 房屋 家庭", "lights": "灯光 燈光 电费 電費",
  "office-phone": "电话 電話 通讯 通訊", "smoke-detector": "烟雾报警 煙霧警報", "vacuum-cleaner": "吸尘器 吸塵器 保洁 清潔",
  "washing-machine": "洗衣机 洗衣機 洗护 洗護", "earth-smiley": "地球 微笑 环球 環球 旅行",
  "wechat": "微信 weixin wechat", "weibo": "微博 新浪", "tencent-weibo": "腾讯微博", "bilibili": "哔哩哔哩 B站 哔哩哔哩大会员",
  "unionpay": "银联 銀聯 中国银联", "xiaomi": "小米", "duolingo-logo": "多邻国 多鄰國", "tick-tick": "滴答清单 滴答清單 ticktick",
  "telegram-app": "电报 電報 tg", "facebook": "脸书 臉書", "instagram": "照片 社交 ins", "twitter-bird": "推特", "x": "推特 twitter",
  "youtube": "油管 视频 影片", "netflix-desktop-app": "奈飞 奈飛 网飞 網飛 Netflix", "spotify": "声田 音乐 音樂",
  "chatgpt": "OpenAI GPT Plus Pro", "claude-ai": "Claude Anthropic 克劳德", "gemini-ai": "Gemini 双子座 雙子座 Google AI",
  "deepseek": "深度求索 DeepSeek", "cursor-ai": "Cursor 编程 編程", "perplexity-ai": "Perplexity 搜索 搜尋",
  "apple-tv": "Apple TV+ 苹果电视 蘋果電視", "apple-fitness": "Fitness+ 苹果健身 蘋果健身", "music": "Apple Music 苹果音乐 蘋果音樂",
  "icloud": "苹果云 蘋果雲 云存储 雲端储存 iCloud+", "shortcuts": "快捷指令 捷徑", "ibooks": "Apple Books 图书 圖書",
  "apple-pay": "苹果支付 蘋果支付", "app-store": "苹果商店 蘋果商店", "ios-photos": "苹果照片 蘋果照片",
  "google-drive": "谷歌云端硬盘 谷歌云盘 雲端硬碟", "google-one": "谷歌会员 雲端會員", "gmail": "谷歌邮箱 信箱",
  "google-calendar": "谷歌日历 行事曆", "google-docs": "谷歌文档 文件", "google-sheets": "谷歌表格 試算表",
  "google-slides": "谷歌幻灯片 簡報", "google-photos": "谷歌相册 相簿", "google-maps": "谷歌地图 地圖",
  "microsoft-365": "Office 办公 辦公 微软 微軟", "microsoft-onedrive-2025": "OneDrive 微软云盘 微軟雲端硬碟",
  "microsoft-onenote-2025": "OneNote 笔记 筆記", "microsoft-outlook-2025": "Outlook 邮箱 郵件",
  "microsoft-excel-2025": "Excel 表格 試算表", "microsoft-word-2025": "Word 文档 文件", "microsoft-powerpoint-2025": "PowerPoint PPT 幻灯片 簡報",
  "microsoft-todo-2019": "Microsoft To Do 微软待办 微軟待辦", "microsoft-teams-2025": "Teams 团队会议 團隊會議",
  "microsoft-edge": "微软浏览器 微軟瀏覽器 Edge", "notion": "笔记 筆記 知识库 知識庫", "evernote": "印象笔记 印象筆記",
  "goodnotes": "好笔记 手写 手寫", "notability": "笔记 手写 筆記 手寫", "anki": "记忆卡片 記憶卡片 闪卡 閃卡",
  "adobe-photoshop": "PS 修图 修圖", "adobe-premiere-pro": "PR 剪辑 剪輯", "adobe-lightroom": "LR 摄影 攝影",
  "adobe-acrobat-reader": "PDF 阅读 閱讀", "adobe-illustrator": "AI 矢量 插画 插畫", "adobe-creative-cloud": "Adobe CC 创意云 創意雲",
  "canva": "可画 可畫 设计 設計", "figma": "界面设计 介面設計", "steam": "蒸汽平台 游戏 遊戲", "genshin-impact-logo": "原神",
  "minecraft-logo": "我的世界 麦块 麥塊", "nintendo-switch-logo": "任天堂 Switch", "playstation": "索尼 Sony PS",
  "paypal": "贝宝 貝寶 支付", "american-express": "美国运通 美國運通 信用卡", "bank-of-america": "美国银行 美國銀行 美银 美銀",
  "visa": "维萨 威士 信用卡", "wellsfargo": "富国银行 富國銀行", "ynab": "预算 預算 记账 記帳",
  "amazon-prime-video": "亚马逊 亞馬遜 Prime 视频 影片", "amazon-shopping-app": "亚马逊购物 亞馬遜購物",
  "starbucks": "星巴克 咖啡", "foodpanda": "外卖 外送", "instacart": "超市 生鲜 生鮮", "shopee": "虾皮 蝦皮购物",
  "tesla": "特斯拉 汽车 汽車", "lyft": "打车 叫車", "ups": "联合包裹 聯合包裹 快递 物流",
  "bitwarden": "密码管理 密碼管理", "protonvpn": "VPN 安全", "protonmail": "加密邮箱 加密郵件", "authy": "验证器 驗證器 2FA",
  "github": "代码 代碼 托管", "visual-studio-code-2019": "VS Code vscode 编辑器 編輯器", "tradingview": "行情 看盘 看盤",
  "pocket-casts": "播客 Podcast", "vlc": "播放器", "zoom": "视频会议 視像會議", "tiktok": "抖音国际版 抖音國際版 TikTok",
}
const payNames = /^(Apple Pay|Google Pay(?: New)?|Zelle|Wellsfargo|Desjardins|American Express|Bank of America|Bhim|Blockchain.*|Cash App|Diners Club|Discover Card|PayPal|Payoneer|Paytm|Pix|Stripe|UnionPay|Visa|Ynab|Highradius)$/i
// Other Windows 11 Color variants observed in the same rendered source catalog.
// Keep the raw source inventory intact; choose the modern/color variant here.
const preferredVariants: Record<string, string> = { "microsoft-edge": "dGm9KIZPpukc", "microsoft-powerpoint-2025": "h5aGExIW8Uft" }
// Visually reviewed dark marks: a view-layer plate on dark backgrounds only.
// This never modifies, recolors, trims, or re-encodes the original PNG.
const lightBackplates = new Set([
  "8QGE7uQedCwQ", "2Wgfq9p8joZQ", "hCQjDhlJZbKP", "GJTUa9i8YZ5Y", "07ZeDviI2FK9",
  "1QqZHb5JS4Nr", "OjcVmPJ55gPs", "S82R0mhIAwEg", "1NIORMWM1Z3H", "0CxBw6ZtJi4x",
  "kQSS04V7DmPz", "7cyyxLNMDATG", "Lg28hPCJzib2", "9a63hqnQ1mOx", "XZpuIviKKqAk",
  "9kNMt0nIMrCH", "gQGF4A6ClZwU", "yXxr92YdER87", "27b1TeRy35eP", "7YnOcP5ENydL",
  "NO8It5EgLtpM", "x64Lsk7ePy2t", "0hnNNhA5my8V", "PZQVBAxaueDJ", "5mbMwDZ796xj",
  "pUf6Ty49x4KC", "uq1hDUTyBszw", "IPzemd2v4Ubj", "foeQvjHxAbGL",
])
const records = readFileSync(resolve(root, "tools/icons8_logos_source.psv"), "utf8").split(/\r?\n/)
  .filter(line => line && !line.startsWith("#"))
  .map(line => {
    const [category, sourceID, slug, label, ...extra] = line.split("|")
    const vendorID = preferredVariants[slug] ?? sourceID
    if (!groupNames[category] || !/^[A-Za-z0-9]{1,32}$/.test(vendorID) || !slug || !label || extra.length) throw Error(`Invalid record: ${line}`)
    return { category, vendorID, slug, label, id: `icons8-${vendorID}`, group: payNames.test(label) ? "财务支付" : groupNames[category], aliases: aliases[slug] ?? "", lightBackplate: lightBackplates.has(vendorID) }
  }).filter(e => !excluded.test(e.label))
if (new Set(records.map(e => e.id)).size !== records.length) throw Error("Duplicate icon IDs")
mkdirSync(resolve(target, "fallbacks"), { recursive: true })

function validatePNG(bytes: Buffer, id: string) {
  if (bytes.length < 100 || bytes.length > 256 * 1024 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
    || bytes.toString("ascii", 12, 16) !== "IHDR" || bytes.readUInt32BE(16) !== 96 || bytes.readUInt32BE(20) !== 96) {
    throw Error(`Invalid 96px PNG: ${id}`)
  }
}
let cursor = 0, finished = 0
const failures: string[] = []
await Promise.all(Array.from({ length: 4 }, async () => {
  for (;;) {
    const index = cursor++
    if (index >= records.length) return
    const icon = records[index]
    const path = resolve(target, `${icon.vendorID}.png`)
    try {
      if (!existsSync(path)) {
        if (!download) throw Error("Missing PNG; use --download to fetch the observed public website PNG")
        // This URL was read from the rendered official icon's srcset. Its
        // bytes matched a normal website Download (96×96 PNG) in QA.
        // No Icons8 developer API, credentials, or live app networking.
        const url = `https://img.icons8.com/?size=96&id=${icon.vendorID}&format=png`
        const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
        if (!response.ok) throw Error(`HTTP ${response.status}`)
        const bytes = Buffer.from(await response.arrayBuffer())
        validatePNG(bytes, icon.id)
        writeFileSync(path, bytes)
      }
      validatePNG(readFileSync(path), icon.id)
      if (++finished % 50 === 0) console.log(`Validated ${finished}/${records.length}`)
    } catch (error) { failures.push(`${icon.id}: ${String(error)}`) }
  }
}))
if (failures.length) throw Error(failures.join("\n"))
const provenance = records.map(icon => {
  const bytes = readFileSync(resolve(target, `${icon.vendorID}.png`))
  const file = `assets/icons8/${icon.vendorID}.png`
  writeFileSync(resolve(target, "fallbacks", `${icon.vendorID}.json`), JSON.stringify({ source: file, encoding: "base64", png: bytes.toString("base64") }) + "\n")
  return { ...icon, file, sourceURL: `https://icons8.com/icon/${icon.vendorID}/${icon.slug}`, downloadURL: `https://img.icons8.com/?size=96&id=${icon.vendorID}&format=png`, style: "Windows 11 Color", format: "PNG", width: 96, height: 96, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), fetchedOn: "2026-09-09" }
})
writeFileSync(resolve(target, "sources.json"), JSON.stringify({ vendor: "Icons8", style: "Windows 11 Color", catalogURL: "https://icons8.com/icons/set/logos--style-fluency", icons: provenance }, null, 2) + "\n")
writeFileSync(resolve(root, "到期管家/src/artwork_data.ts"), [
  "// SPDX-FileCopyrightText: 2026 MaroonYS",
  "// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0",
  "// Generated by tools/import_icons8.ts; metadata only, never image bytecode.",
  "// Icons8 artwork retains its own rights. See assets/icons8/NOTICE.md.",
  "export const ARTWORK_ROWS: readonly (readonly [string, string, string, string, boolean])[] = [",
  ...records.map(e => `  ${JSON.stringify([e.id, e.category === "General" ? e.aliases.split(" ")[0] || e.label : e.label, e.group, `${e.label} ${e.aliases}`.trim(), e.lightBackplate])},`),
  "]", "",
].join("\n"))
console.log(JSON.stringify({ count: records.length, pngBytes: provenance.reduce((s,e) => s+e.bytes,0), groups: [...new Set(records.map(e=>e.group))] }))
