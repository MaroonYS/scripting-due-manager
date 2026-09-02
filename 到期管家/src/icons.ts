import { ITEM_KIND_DEFINITIONS } from "./item_kinds"
import type { ItemKind } from "./types"

export type DueIconGroup =
  | "财务"
  | "影音娱乐"
  | "工作效率"
  | "数字服务"
  | "社交通讯"
  | "居家生活"
  | "健康运动"
  | "出行旅行"
  | "学习阅读"
  | "创作设计"
  | "其他"

export type DueIconDefinition = {
  name: string
  label: string
  color: string
  group: DueIconGroup
}

export type ResolvedDueIcon = Pick<DueIconDefinition, "name" | "label" | "color">

export const DUE_ICON_GROUPS: DueIconGroup[] = [
  "财务",
  "影音娱乐",
  "工作效率",
  "数字服务",
  "社交通讯",
  "居家生活",
  "健康运动",
  "出行旅行",
  "学习阅读",
  "创作设计",
  "其他",
]

export const DUE_ICON_OPTIONS: DueIconDefinition[] = [
  { name: "creditcard.fill", label: "信用卡", color: "systemOrange", group: "财务" },
  { name: "building.columns.fill", label: "银行", color: "systemIndigo", group: "财务" },
  { name: "banknote.fill", label: "付款现金", color: "systemGreen", group: "财务" },
  { name: "chart.line.uptrend.xyaxis", label: "投资行情", color: "systemGreen", group: "财务" },
  { name: "chart.pie.fill", label: "预算理财", color: "systemBlue", group: "财务" },
  { name: "doc.text.magnifyingglass", label: "税务会计", color: "systemOrange", group: "财务" },
  { name: "percent", label: "利率优惠", color: "systemPink", group: "财务" },
  { name: "dollarsign.circle.fill", label: "税费账务", color: "systemGreen", group: "财务" },
  { name: "shield.fill", label: "保险", color: "systemGreen", group: "财务" },

  { name: "play.rectangle.fill", label: "视频流媒体", color: "systemRed", group: "影音娱乐" },
  { name: "music.note", label: "音乐", color: "systemPink", group: "影音娱乐" },
  { name: "headphones", label: "有声书音频", color: "systemPurple", group: "影音娱乐" },
  { name: "mic.fill", label: "播客", color: "systemOrange", group: "影音娱乐" },
  { name: "waveform", label: "广播声音", color: "systemTeal", group: "影音娱乐" },
  { name: "radio.fill", label: "电台广播", color: "systemTeal", group: "影音娱乐" },
  { name: "gamecontroller.fill", label: "游戏", color: "systemPurple", group: "影音娱乐" },
  { name: "tv.fill", label: "电视", color: "systemBlue", group: "影音娱乐" },
  { name: "sportscourt.fill", label: "体育赛事", color: "systemGreen", group: "影音娱乐" },
  { name: "theatermasks.fill", label: "演出娱乐", color: "systemPink", group: "影音娱乐" },
  { name: "ticket.fill", label: "票券会员", color: "systemOrange", group: "影音娱乐" },

  { name: "briefcase.fill", label: "商务办公", color: "systemIndigo", group: "工作效率" },
  { name: "checklist", label: "任务管理", color: "systemBlue", group: "工作效率" },
  { name: "checkmark.circle.fill", label: "待办效率", color: "systemBlue", group: "工作效率" },
  { name: "calendar", label: "日历排程", color: "systemRed", group: "工作效率" },
  { name: "note.text", label: "笔记知识库", color: "systemYellow", group: "工作效率" },
  { name: "envelope.fill", label: "邮箱", color: "systemBlue", group: "工作效率" },
  { name: "doc.on.doc.fill", label: "文档协作", color: "systemTeal", group: "工作效率" },
  { name: "signature", label: "电子签名", color: "systemIndigo", group: "工作效率" },
  { name: "rectangle.3.group.fill", label: "项目工作流", color: "systemPurple", group: "工作效率" },
  { name: "printer.fill", label: "打印扫描", color: "systemGray", group: "工作效率" },
  { name: "scanner.fill", label: "文档扫描", color: "systemTeal", group: "工作效率" },
  { name: "storefront.fill", label: "商户门店", color: "systemOrange", group: "工作效率" },

  { name: "sparkles", label: "AI 服务", color: "systemPurple", group: "数字服务" },
  { name: "icloud.fill", label: "云存储", color: "systemBlue", group: "数字服务" },
  { name: "externaldrive.fill", label: "备份硬盘", color: "systemGray", group: "数字服务" },
  { name: "globe", label: "网站域名", color: "systemTeal", group: "数字服务" },
  { name: "wifi", label: "宽带网络", color: "systemBlue", group: "数字服务" },
  { name: "iphone", label: "手机套餐", color: "systemIndigo", group: "数字服务" },
  { name: "desktopcomputer", label: "软件设备", color: "systemGray", group: "数字服务" },
  { name: "terminal.fill", label: "开发工具", color: "systemIndigo", group: "数字服务" },
  { name: "curlybraces.square.fill", label: "代码开发", color: "systemIndigo", group: "数字服务" },
  { name: "lock.shield.fill", label: "网络安全 VPN", color: "systemGreen", group: "数字服务" },
  { name: "shield.lefthalf.filled", label: "安全防护", color: "systemGreen", group: "数字服务" },
  { name: "key.fill", label: "密码管理", color: "systemOrange", group: "数字服务" },
  { name: "network", label: "服务器网络", color: "systemTeal", group: "数字服务" },
  { name: "server.rack", label: "云主机服务器", color: "systemTeal", group: "数字服务" },
  { name: "square.grid.2x2.fill", label: "应用套餐", color: "systemPurple", group: "数字服务" },
  { name: "puzzlepiece.extension.fill", label: "浏览器扩展", color: "systemPurple", group: "数字服务" },

  { name: "message.fill", label: "即时通讯", color: "systemGreen", group: "社交通讯" },
  { name: "bubble.left.and.bubble.right.fill", label: "社交网络", color: "systemBlue", group: "社交通讯" },
  { name: "video.fill", label: "视频会议", color: "systemBlue", group: "社交通讯" },
  { name: "person.2.fill", label: "团队社群", color: "systemIndigo", group: "社交通讯" },
  { name: "person.3.fill", label: "俱乐部协会", color: "systemIndigo", group: "社交通讯" },
  { name: "heart.fill", label: "交友约会", color: "systemPink", group: "社交通讯" },
  { name: "crown.fill", label: "高级会员", color: "systemYellow", group: "社交通讯" },
  { name: "phone.fill", label: "语音通话", color: "systemGreen", group: "社交通讯" },
  { name: "paperplane.fill", label: "消息发布", color: "systemBlue", group: "社交通讯" },

  { name: "bolt.fill", label: "电费", color: "systemOrange", group: "居家生活" },
  { name: "drop.fill", label: "水费", color: "systemBlue", group: "居家生活" },
  { name: "flame.fill", label: "燃气", color: "systemOrange", group: "居家生活" },
  { name: "house.fill", label: "住房家庭", color: "systemTeal", group: "居家生活" },
  { name: "fork.knife", label: "餐饮外卖", color: "systemOrange", group: "居家生活" },
  { name: "takeoutbag.and.cup.and.straw.fill", label: "外卖配送", color: "systemOrange", group: "居家生活" },
  { name: "cup.and.saucer.fill", label: "咖啡茶饮", color: "systemBrown", group: "居家生活" },
  { name: "cart.fill", label: "购物超市", color: "systemBlue", group: "居家生活" },
  { name: "bag.fill", label: "会员商店", color: "systemPink", group: "居家生活" },
  { name: "tshirt.fill", label: "服饰洗护", color: "systemPurple", group: "居家生活" },
  { name: "shippingbox.fill", label: "物流配送", color: "systemBrown", group: "居家生活" },
  { name: "hammer.fill", label: "家修维护", color: "systemOrange", group: "居家生活" },
  { name: "washer.fill", label: "家电清洁", color: "systemBlue", group: "居家生活" },
  { name: "trash.fill", label: "垃圾回收", color: "systemGreen", group: "居家生活" },
  { name: "bell.and.waves.left.and.right.fill", label: "家庭安防", color: "systemRed", group: "居家生活" },
  { name: "pawprint.fill", label: "宠物", color: "systemOrange", group: "居家生活" },

  { name: "cross.case.fill", label: "医疗", color: "systemRed", group: "健康运动" },
  { name: "heart.text.square.fill", label: "健康监测", color: "systemRed", group: "健康运动" },
  { name: "pills.fill", label: "药物保健", color: "systemPink", group: "健康运动" },
  { name: "stethoscope", label: "医生门诊", color: "systemTeal", group: "健康运动" },
  { name: "figure.run", label: "健身运动", color: "systemGreen", group: "健康运动" },
  { name: "dumbbell.fill", label: "健身房", color: "systemIndigo", group: "健康运动" },
  { name: "figure.mind.and.body", label: "冥想正念", color: "systemPurple", group: "健康运动" },
  { name: "bed.double.fill", label: "睡眠", color: "systemIndigo", group: "健康运动" },
  { name: "moon.zzz.fill", label: "睡眠监测", color: "systemIndigo", group: "健康运动" },
  { name: "brain.head.profile", label: "心理专注", color: "systemPurple", group: "健康运动" },
  { name: "leaf.fill", label: "冥想健康", color: "systemGreen", group: "健康运动" },
  { name: "trophy.fill", label: "体育会员", color: "systemYellow", group: "健康运动" },

  { name: "airplane", label: "航班旅行", color: "systemBlue", group: "出行旅行" },
  { name: "car.fill", label: "汽车用车", color: "systemBlue", group: "出行旅行" },
  { name: "bus.fill", label: "公交大巴", color: "systemGreen", group: "出行旅行" },
  { name: "tram.fill", label: "地铁火车", color: "systemOrange", group: "出行旅行" },
  { name: "ferry.fill", label: "轮渡船务", color: "systemBlue", group: "出行旅行" },
  { name: "map.fill", label: "地图导航", color: "systemGreen", group: "出行旅行" },
  { name: "location.fill", label: "位置轨迹", color: "systemRed", group: "出行旅行" },
  { name: "suitcase.rolling.fill", label: "酒店行李", color: "systemIndigo", group: "出行旅行" },
  { name: "fuelpump.fill", label: "加油充电", color: "systemOrange", group: "出行旅行" },
  { name: "bolt.car.fill", label: "电车充电", color: "systemGreen", group: "出行旅行" },
  { name: "parkingsign.circle.fill", label: "停车路费", color: "systemBlue", group: "出行旅行" },
  { name: "bicycle", label: "骑行户外", color: "systemGreen", group: "出行旅行" },

  { name: "graduationcap.fill", label: "教育课程", color: "systemIndigo", group: "学习阅读" },
  { name: "book.fill", label: "阅读电子书", color: "systemOrange", group: "学习阅读" },
  { name: "book.closed.fill", label: "电子书漫画", color: "systemOrange", group: "学习阅读" },
  { name: "books.vertical.fill", label: "图书馆书籍", color: "systemBrown", group: "学习阅读" },
  { name: "newspaper.fill", label: "新闻报刊", color: "systemBlue", group: "学习阅读" },
  { name: "text.book.closed.fill", label: "辞典参考", color: "systemTeal", group: "学习阅读" },
  { name: "character.book.closed.fill", label: "语言学习", color: "systemRed", group: "学习阅读" },
  { name: "lightbulb.fill", label: "知识技能", color: "systemYellow", group: "学习阅读" },
  { name: "function", label: "数学科学", color: "systemIndigo", group: "学习阅读" },
  { name: "globe.asia.australia.fill", label: "地理历史", color: "systemGreen", group: "学习阅读" },
  { name: "teddybear.fill", label: "少儿亲子", color: "systemPink", group: "学习阅读" },

  { name: "camera.fill", label: "摄影拍摄", color: "systemBlue", group: "创作设计" },
  { name: "photo.fill.on.rectangle.fill", label: "照片图库", color: "systemGreen", group: "创作设计" },
  { name: "paintbrush.fill", label: "绘画设计", color: "systemPurple", group: "创作设计" },
  { name: "paintpalette.fill", label: "设计素材", color: "systemPurple", group: "创作设计" },
  { name: "pencil.and.ruler.fill", label: "制图排版", color: "systemOrange", group: "创作设计" },
  { name: "scissors", label: "剪辑裁剪", color: "systemRed", group: "创作设计" },
  { name: "wand.and.stars", label: "特效美化", color: "systemPurple", group: "创作设计" },
  { name: "film.fill", label: "影片制作", color: "systemIndigo", group: "创作设计" },
  { name: "cube.transparent.fill", label: "3D 建模", color: "systemTeal", group: "创作设计" },
  { name: "scribble.variable", label: "手写创意", color: "systemPink", group: "创作设计" },

  { name: "gift.fill", label: "生日礼物", color: "systemPink", group: "其他" },
  { name: "birthday.cake.fill", label: "生日纪念", color: "systemPink", group: "其他" },
  { name: "heart.circle.fill", label: "公益捐赠", color: "systemPink", group: "其他" },
  { name: "doc.text.fill", label: "账单文件", color: "systemBlue", group: "其他" },
  { name: "repeat.circle.fill", label: "周期订阅", color: "systemPurple", group: "其他" },
  { name: "calendar.badge.clock", label: "日期", color: "systemTeal", group: "其他" },
  { name: "wrench.and.screwdriver.fill", label: "工具维修", color: "systemGray", group: "其他" },
  { name: "cloud.sun.fill", label: "天气", color: "systemBlue", group: "其他" },
  { name: "umbrella.fill", label: "雨天防护", color: "systemBlue", group: "其他" },
  { name: "tag.fill", label: "会员价格", color: "systemOrange", group: "其他" },
  { name: "bell.fill", label: "提醒通知", color: "systemRed", group: "其他" },
  { name: "qrcode", label: "通行码", color: "systemIndigo", group: "其他" },
]

type IconRule = {
  icon: string
  keywords: string[]
  exactKeywords?: string[]
}

type CompiledKeyword = {
  raw: string
  words: string
  containsNonASCII: boolean
  score: number
}

type CompiledIconRule = {
  icon: string
  keywords: CompiledKeyword[]
  exactKeywords: string[]
}

// Rules stay deliberately conservative: manual choices cover the long tail, while
// automatic matching only uses product names or phrases with a clear meaning.
const ICON_RULES: IconRule[] = [
  {
    icon: "sparkles",
    keywords: [
      "github copilot", "microsoft copilot", "google ai", "gemini advanced",
      "notion ai", "cursor pro", "adobe firefly", "chatgpt", "openai", "claude",
      "anthropic", "gemini", "deepseek", "perplexity", "midjourney", "runway",
      "windsurf", "replit", "grok", "poe ai", "人工智能", "AI会员", "AI订阅",
    ],
    exactKeywords: ["AI"],
  },
  {
    icon: "music.note",
    keywords: [
      "youtube music", "apple music", "amazon music", "spotify", "tidal", "deezer",
      "qq音乐", "网易云音乐", "酷狗音乐", "酷我音乐", "音乐会员", "音乐订阅",
    ],
  },
  {
    icon: "play.rectangle.fill",
    keywords: [
      "amazon prime video", "prime video", "apple tv+", "apple tv plus", "youtube premium", "youtube",
      "netflix", "disney+", "disney plus", "hbo max", "max streaming", "paramount+",
      "paramount plus", "peacock", "hulu", "crunchyroll", "mubi", "bilibili",
      "哔哩哔哩", "爱奇艺", "腾讯视频", "优酷", "芒果tv", "芒果 TV", "tvb",
      "now tv", "视频会员", "影视会员", "流媒体订阅",
    ],
  },
  {
    icon: "gamecontroller.fill",
    keywords: [
      "apple arcade", "xbox game pass", "playstation plus", "ps plus",
      "nintendo switch online", "geforce now", "ea play", "ubisoft+", "steam",
      "主机游戏", "游戏会员", "游戏订阅",
    ],
  },
  {
    icon: "sportscourt.fill",
    keywords: [
      "nba league pass", "nfl+", "mlb.tv", "f1 tv", "espn+", "dazn",
      "体育会员", "赛事会员", "体育直播",
    ],
  },
  {
    icon: "headphones",
    keywords: [
      "kindle audible", "audible", "storytel", "audiobook subscription", "audio book subscription",
      "喜马拉雅", "懒人听书", "有声书", "听书会员", "音频会员",
    ],
  },
  {
    icon: "mic.fill",
    keywords: ["podcast subscription", "podcast premium", "pocket casts plus", "播客会员", "播客订阅"],
  },
  {
    icon: "radio.fill",
    keywords: ["siriusxm", "tunein premium", "radio subscription", "网络电台", "广播会员"],
  },
  {
    icon: "newspaper.fill",
    keywords: [
      "apple news+", "apple news plus", "new york times", "financial times", "wall street journal",
      "washington post", "the economist", "bloomberg news", "medium membership",
      "substack", "newspaper", "magazine", "newsletter", "新闻", "报刊", "杂志", "通讯订阅",
    ],
  },
  {
    icon: "book.closed.fill",
    keywords: [
      "kindle unlimited", "everand", "scribd", "webtoon", "book subscription",
      "ebook subscription", "e-book subscription", "微信读书", "电子书会员", "漫画会员", "阅读会员",
    ],
  },
  {
    icon: "paintpalette.fill",
    keywords: [
      "adobe creative cloud", "canva pro", "figma professional", "envato elements",
      "adobe photoshop", "adobe lightroom", "adobe illustrator", "creative market",
      "设计会员", "素材订阅", "修图会员", "字体订阅",
    ],
  },
  {
    icon: "camera.fill",
    keywords: ["photography plan", "vsco membership", "picsart gold", "摄影会员", "相机会员"],
  },
  {
    icon: "film.fill",
    keywords: ["final cut pro", "davinci resolve studio", "video editor subscription", "剪辑会员", "影片制作"],
  },
  {
    icon: "briefcase.fill",
    keywords: [
      "microsoft 365", "office 365", "google workspace", "slack pro", "zoom workplace",
      "dropbox business", "办公套件", "企业协作", "商务会员",
    ],
  },
  {
    icon: "checkmark.circle.fill",
    keywords: [
      "todoist pro", "todoist", "ticktick premium", "ticktick", "notion plus",
      "evernote", "obsidian sync", "things cloud", "滴答清单", "待办会员", "笔记会员",
    ],
    exactKeywords: ["Notion"],
  },
  {
    icon: "envelope.fill",
    keywords: [
      "proton mail", "fastmail", "hey email", "mailbox subscription", "email hosting",
      "企业邮箱", "邮箱会员", "邮箱服务",
    ],
  },
  {
    icon: "doc.text.fill",
    keywords: ["adobe acrobat", "pdf expert", "document subscription", "文档会员", "PDF会员", "电子账单"],
  },
  {
    icon: "scanner.fill",
    keywords: ["scanner pro", "camscanner", "adobe scan", "扫描会员", "扫描订阅"],
  },
  {
    icon: "signature",
    keywords: ["docusign", "adobe sign", "electronic signature", "电子签名", "电子签署"],
  },
  {
    icon: "lock.shield.fill",
    keywords: [
      "nordvpn", "expressvpn", "surfshark", "mullvad", "proton vpn", "private internet access",
      "vpn subscription", "VPN续费", "VPN会员", "翻墙服务",
    ],
  },
  {
    icon: "key.fill",
    keywords: [
      "1password", "bitwarden premium", "dashlane", "keeper security", "password manager",
      "密码管理", "密码库", "保险箱密码", "密码轮换",
    ],
  },
  {
    icon: "shield.lefthalf.filled",
    keywords: [
      "applecare+", "applecare plus", "norton 360", "mcafee", "malwarebytes", "bitdefender",
      "antivirus", "anti-virus", "防病毒", "杀毒软件", "安全防护会员",
    ],
  },
  {
    icon: "curlybraces.square.fill",
    keywords: [
      "apple developer program", "github pro", "gitlab premium", "jetbrains", "xcode cloud",
      "developer subscription", "code hosting", "开发者会员", "代码托管", "开发工具订阅",
    ],
  },
  {
    icon: "server.rack",
    keywords: [
      "digitalocean", "vultr", "linode", "hetzner", "cloudways", "server hosting",
      "cloud server", "web hosting", "virtual private server", "vps hosting", "云服务器",
      "云主机", "虚拟主机", "网站主机", "服务器托管", "阿里云服务器", "腾讯云服务器",
    ],
  },
  {
    icon: "externaldrive.fill",
    keywords: [
      "backblaze cloud backup", "backblaze", "carbonite", "time machine backup", "local backup", "backup service",
      "移动硬盘", "本地备份", "硬盘备份", "备份服务",
    ],
  },
  {
    icon: "icloud.fill",
    keywords: [
      "icloud+", "icloud plus", "google one", "dropbox plus", "dropbox", "onedrive", "google drive",
      "box cloud storage", "mega cloud", "pcloud", "cloud storage", "cloud backup",
      "网盘会员", "云盘会员", "云存储", "云备份",
    ],
  },
  {
    icon: "square.grid.2x2.fill",
    keywords: ["apple one", "setapp", "app bundle", "software bundle", "软件合集", "应用合集", "应用套餐"],
  },
  {
    icon: "puzzlepiece.extension.fill",
    keywords: ["safari extension", "browser extension", "chrome extension", "浏览器扩展", "插件订阅"],
  },
  {
    icon: "globe",
    keywords: [
      "domain renewal", "domain registration", "web domain", "ssl certificate", "tls certificate",
      "https certificate", "域名续费", "域名到期", "SSL证书", "TLS证书", "HTTPS证书",
    ],
  },
  {
    icon: "wifi",
    keywords: [
      "home internet", "broadband", "internet bill", "wi-fi plan", "wifi plan", "家庭宽带",
      "宽带账单", "网络费", "中国电信宽带", "中国联通宽带", "中国移动宽带",
    ],
  },
  {
    icon: "iphone",
    keywords: [
      "mobile plan", "phone bill", "cellular plan", "sim plan", "esim plan", "手机费", "手机套餐",
      "话费账单", "流量套餐", "中国移动", "移动话费", "移动套餐", "中国联通",
      "联通话费", "联通套餐", "中国电信", "电信话费", "电信套餐",
    ],
  },
  {
    icon: "video.fill",
    keywords: ["zoom pro", "google meet", "microsoft teams", "video conferencing", "视频会议", "会议会员"],
  },
  {
    icon: "bubble.left.and.bubble.right.fill",
    keywords: [
      "linkedin premium", "discord nitro", "reddit premium", "telegram premium", "twitter premium",
      "social subscription", "社交会员", "社群会员",
    ],
    exactKeywords: ["X Premium"],
  },
  {
    icon: "heart.fill",
    keywords: ["tinder plus", "tinder gold", "bumble premium", "hinge+", "dating subscription", "婚恋会员", "交友会员"],
  },
  {
    icon: "person.3.fill",
    keywords: ["club membership", "association dues", "professional membership", "俱乐部会费", "协会会费", "商会会费"],
  },
  {
    icon: "shippingbox.fill",
    keywords: [
      "amazon prime", "walmart+ delivery", "jd plus", "jd.com plus", "delivery membership",
      "shipping membership", "京东plus", "京东 PLUS", "配送会员", "物流会员", "包邮会员",
    ],
  },
  {
    icon: "storefront.fill",
    keywords: [
      "costco membership", "sam's club", "sams club", "walmart+", "retail membership",
      "山姆会员", "盒马会员", "商超会员", "零售会员",
    ],
  },
  {
    icon: "fork.knife",
    keywords: [
      "hellofresh", "blue apron", "meal kit subscription", "food subscription",
      "外卖会员", "餐饮会员", "餐包订阅", "美食订阅",
    ],
  },
  {
    icon: "takeoutbag.and.cup.and.straw.fill",
    keywords: ["doordash dashpass", "deliveroo plus", "foodpanda pro", "ubereats one", "送餐会员", "外卖配送"],
  },
  {
    icon: "cup.and.saucer.fill",
    keywords: ["coffee subscription", "pret subscription", "panera sip club", "咖啡订阅", "茶饮会员"],
  },
  {
    icon: "cart.fill",
    keywords: ["shopping membership", "grocery subscription", "购物会员", "超市订阅", "购物清单"],
  },
  {
    icon: "house.fill",
    keywords: [
      "mortgage payment", "property fee", "home loan", "house rent", "rent payment",
      "房租", "房贷", "按揭", "物业管理费", "物业费", "住房费用",
    ],
  },
  {
    icon: "bolt.fill",
    keywords: ["electricity bill", "power bill", "electric bill", "电费", "电力账单"],
  },
  {
    icon: "drop.fill",
    keywords: ["water bill", "water utility", "水费", "自来水账单"],
  },
  {
    icon: "flame.fill",
    keywords: ["gas bill", "gas utility", "燃气费", "燃气账单", "煤气费", "天然气费", "天然气账单"],
  },
  {
    icon: "bell.and.waves.left.and.right.fill",
    keywords: ["home security", "alarm monitoring", "ring protect", "adt monitoring", "家庭安防", "报警服务"],
  },
  {
    icon: "washer.fill",
    keywords: ["laundry subscription", "cleaning service", "家政服务", "洗衣会员", "清洁服务"],
  },
  {
    icon: "trash.fill",
    keywords: ["waste collection", "recycling service", "垃圾处理费", "环卫费", "回收服务"],
  },
  {
    icon: "hammer.fill",
    keywords: ["home warranty", "home maintenance", "home repair plan", "appliance repair plan", "家庭维修", "家修服务"],
  },
  {
    icon: "dumbbell.fill",
    keywords: [
      "apple fitness+", "apple fitness plus", "peloton", "strava", "classpass", "gym membership",
      "fitness subscription", "健身课程", "健身房", "健身会员", "运动会员", "瑜伽会员",
    ],
  },
  {
    icon: "figure.mind.and.body",
    keywords: ["headspace", "meditation subscription", "mindfulness subscription", "冥想会员", "正念课程"],
  },
  {
    icon: "moon.zzz.fill",
    keywords: ["sleep cycle premium", "sleep subscription", "sleep tracking", "睡眠会员", "睡眠监测"],
  },
  {
    icon: "pills.fill",
    keywords: ["prescription refill", "medication refill", "pharmacy subscription", "处方续药", "药品续购", "保健品订阅"],
  },
  {
    icon: "stethoscope",
    keywords: ["telehealth", "online doctor", "doctor appointment", "在线问诊", "医生复诊", "门诊预约"],
  },
  {
    icon: "cross.case.fill",
    keywords: [
      "hospital bill", "dental appointment", "medical appointment", "医疗费", "医院账单",
      "体检预约", "牙医预约", "医疗服务",
    ],
  },
  {
    icon: "heart.text.square.fill",
    keywords: ["health monitoring", "heart monitoring", "blood pressure tracking", "健康监测", "心率监测", "血压记录"],
  },
  {
    icon: "airplane",
    keywords: ["flight booking", "airline ticket", "travel membership", "机票", "航班", "旅行会员", "签证到期"],
  },
  {
    icon: "map.fill",
    keywords: [
      "alltrails+", "alltrails plus", "komoot premium", "citymapper club", "gps subscription",
      "navigation subscription", "导航会员", "地图订阅", "户外地图",
    ],
  },
  {
    icon: "tram.fill",
    keywords: ["transit pass", "rail pass", "metro pass", "train pass", "公交月票", "地铁月票", "铁路通票"],
  },
  {
    icon: "bolt.car.fill",
    keywords: ["ev charging", "supercharger membership", "charging network", "充电会员", "电车充电", "充电桩服务"],
  },
  {
    icon: "fuelpump.fill",
    keywords: ["fuel card", "gas station membership", "加油卡", "油费", "加油会员"],
  },
  {
    icon: "car.fill",
    keywords: [
      "car insurance", "vehicle insurance", "car registration", "vehicle inspection", "roadside assistance",
      "车险", "汽车保险", "车辆年检", "道路救援", "用车会员",
    ],
  },
  {
    icon: "parkingsign.circle.fill",
    keywords: ["parking pass", "parking permit", "toll pass", "停车月卡", "停车费", "路桥费"],
  },
  {
    icon: "bicycle",
    keywords: ["bike membership", "bike share", "cycling subscription", "骑行会员", "共享单车月卡"],
  },
  {
    icon: "graduationcap.fill",
    keywords: [
      "online course", "school tuition", "university tuition", "gymnasium tuition", "coursera plus",
      "udemy personal plan", "skillshare", "masterclass", "brilliant premium", "quizlet plus",
      "学费", "网课会员", "课程会员", "学校缴费", "考试报名",
    ],
  },
  {
    icon: "character.book.closed.fill",
    keywords: ["duolingo super", "babbel", "rosetta stone", "language learning", "语言学习", "外语课程", "单词会员"],
  },
  {
    icon: "text.book.closed.fill",
    keywords: ["dictionary subscription", "reference subscription", "词典会员", "百科订阅", "参考资料"],
  },
  {
    icon: "chart.line.uptrend.xyaxis",
    keywords: [
      "tradingview", "robinhood gold", "seeking alpha", "investment subscription", "brokerage fee",
      "富途", "老虎证券", "投资会员", "股票行情", "基金定投",
    ],
  },
  {
    icon: "chart.pie.fill",
    keywords: ["ynab", "monarch money", "quicken", "budgeting app", "expense tracker", "预算软件", "记账会员", "财务统计"],
  },
  {
    icon: "doc.text.magnifyingglass",
    keywords: ["tax filing", "tax preparation", "accounting subscription", "报税服务", "税务申报", "会计服务"],
  },
  {
    icon: "percent",
    keywords: ["loan interest", "interest payment", "apr review", "贷款利息", "分期利息", "利率到期"],
  },
  {
    icon: "creditcard.fill",
    keywords: [
      "credit card", "visa card", "mastercard", "american express", "amex", "credit 01", "credit 02", "credit 03", "credit 04",
      "信用卡", "还款日", "卡账单", "银行账单", "卡片年费",
    ],
  },
  {
    icon: "building.columns.fill",
    keywords: ["bank account", "bank fee", "bank 01", "bank 02", "bank 03", "bank 04", "banking", "sofi", "ally bank", "银行账户", "储蓄账户", "银行服务费"],
    exactKeywords: ["Bank", "银行"],
  },
  {
    icon: "shield.fill",
    keywords: [
      "insurance premium", "insurance renewal", "insurance policy", "health insurance",
      "保险费", "保费", "保险续费", "保险到期", "保单续期",
    ],
    exactKeywords: ["Insurance", "保险"],
  },
  {
    icon: "banknote.fill",
    keywords: ["payment due", "cash payment", "membership dues", "应付款", "现金缴费", "会费缴纳"],
  },
  {
    icon: "pawprint.fill",
    keywords: ["pet insurance", "veterinary plan", "pet subscription", "宠物保险", "宠物会员", "猫粮订阅", "狗粮订阅", "兽医预约"],
  },
  {
    icon: "cloud.sun.fill",
    keywords: ["carrot weather", "accuweather premium", "weather radar", "weather subscription", "天气会员", "气象服务", "天气预报订阅"],
  },
  {
    icon: "heart.circle.fill",
    keywords: ["charity donation", "monthly donation", "nonprofit membership", "公益捐款", "每月捐赠", "慈善会员"],
  },
  {
    icon: "birthday.cake.fill",
    keywords: ["birthday reminder", "birthday party", "生日提醒", "生日派对"],
  },
  {
    icon: "gift.fill",
    keywords: ["anniversary gift", "gift reminder", "纪念日礼物", "节日礼物"],
  },
]

// Apple Reminders titles are usually short actions rather than product names.
// Keep these broader daily-life phrases isolated from manually managed due items.
const REMINDER_CONTENT_RULES: IconRule[] = [
  {
    icon: "briefcase.fill",
    keywords: [
      "team meeting", "staff meeting", "client meeting", "project review", "weekly report",
      "团队开会", "团队会议", "客户会议", "项目评审", "提交周报", "工作汇报", "开会",
    ],
  },
  {
    icon: "phone.fill",
    keywords: ["phone call", "call back", "return call", "打电话", "回电话", "给家里回电", "回电"],
  },
  {
    icon: "message.fill",
    keywords: ["send message", "reply to message", "reply message", "发消息", "回消息", "回复消息"],
  },
  {
    icon: "envelope.fill",
    keywords: ["send email", "reply to email", "reply email", "check email", "发邮件", "回邮件", "回复邮件", "查邮件"],
  },
  {
    icon: "shippingbox.fill",
    keywords: [
      "pick up package", "collect package", "send package", "ship package", "pick up parcel",
      "取快递", "拿快递", "寄快递", "收包裹", "取包裹", "取件", "寄件",
    ],
  },
  {
    icon: "cart.fill",
    keywords: [
      "buy groceries", "grocery run", "go to supermarket", "supermarket shopping",
      "买菜", "买日用品", "购买日用品", "去超市", "采购生活用品", "采购清单",
    ],
  },
  {
    icon: "takeoutbag.and.cup.and.straw.fill",
    keywords: ["pick up takeout", "order takeout", "pick up food", "取外卖", "点外卖", "取餐"],
  },
  {
    icon: "fork.knife",
    keywords: ["make dinner", "cook dinner", "meal prep", "做饭", "准备早餐", "准备午餐", "准备晚餐", "吃饭"],
  },
  {
    icon: "cup.and.saucer.fill",
    keywords: ["buy coffee", "coffee break", "买咖啡", "喝咖啡", "买奶茶"],
  },
  {
    icon: "washer.fill",
    keywords: ["do laundry", "pick up dry cleaning", "clean the house", "洗衣服", "取干洗", "打扫卫生", "大扫除", "清洁房间"],
  },
  {
    icon: "trash.fill",
    keywords: ["take out trash", "take out rubbish", "recycling day", "倒垃圾", "垃圾分类", "回收垃圾"],
  },
  {
    icon: "wrench.and.screwdriver.fill",
    keywords: ["repair appointment", "fix appliance", "change filter", "维修预约", "修理家电", "更换滤芯", "修水管"],
  },
  {
    icon: "pills.fill",
    keywords: ["take medicine", "take medication", "take vitamins", "吃药", "服药", "按时用药", "吃维生素"],
  },
  {
    icon: "stethoscope",
    keywords: ["see the doctor", "doctor visit", "follow-up visit", "看医生", "去复诊", "医生复诊", "复诊"],
  },
  {
    icon: "cross.case.fill",
    keywords: ["health checkup", "dental checkup", "see the dentist", "去体检", "做体检", "看牙医", "牙医复诊"],
  },
  {
    icon: "figure.run",
    keywords: ["go running", "go swimming", "work out", "morning run", "去跑步", "跑步", "游泳", "锻炼", "做瑜伽", "健身"],
  },
  {
    icon: "bed.double.fill",
    keywords: ["go to bed", "bedtime", "sleep early", "早点睡", "准备睡觉", "按时睡觉"],
  },
  {
    icon: "graduationcap.fill",
    keywords: ["submit homework", "finish homework", "study for exam", "attend class", "交作业", "提交作业", "写作业", "作业", "准备考试", "复习考试", "去上课"],
  },
  {
    icon: "book.fill",
    keywords: ["read a book", "return library book", "reading time", "读书", "看书", "阅读", "还书"],
  },
  {
    icon: "airplane",
    keywords: ["online check-in", "airport check-in", "leave for airport", "航班值机", "线上值机", "出发去机场", "去机场"],
  },
  {
    icon: "suitcase.rolling.fill",
    keywords: ["pack luggage", "pack suitcase", "travel packing", "收拾行李", "整理行李", "准备旅行", "旅行准备"],
  },
  {
    icon: "car.fill",
    keywords: ["wash the car", "service the car", "car service", "洗车", "车辆保养", "汽车保养", "送车维修"],
  },
  {
    icon: "fuelpump.fill",
    keywords: ["refuel the car", "fill up the car", "汽车加油", "车辆加油", "去加油站"],
  },
  {
    icon: "bolt.car.fill",
    keywords: ["charge the car", "charge ev", "给车充电", "电动车充电", "车辆充电"],
  },
  {
    icon: "parkingsign.circle.fill",
    keywords: ["pay for parking", "renew parking", "停车缴费", "续停车费", "停车续费"],
  },
  {
    icon: "doc.text.fill",
    keywords: ["pay the bill", "check the bill", "交账单", "付账单", "账单缴费", "生活缴费"],
  },
  {
    icon: "repeat.circle.fill",
    keywords: ["renew subscription", "cancel subscription", "review subscriptions", "续订服务", "取消订阅", "检查订阅"],
  },
  {
    icon: "doc.on.doc.fill",
    keywords: ["sign contract", "renew document", "renew passport", "签合同", "合同续签", "更新证件", "护照续期", "证件续期"],
  },
  {
    icon: "calendar",
    keywords: ["make appointment", "appointment reminder", "预约理发", "预约办事", "预约时间"],
  },
  {
    icon: "birthday.cake.fill",
    keywords: ["birthday party", "birthday dinner", "生日聚会", "生日晚餐", "过生日"],
  },
  {
    icon: "gift.fill",
    keywords: ["buy a gift", "wrap a gift", "买礼物", "准备礼物", "包装礼物"],
  },
  {
    icon: "pawprint.fill",
    keywords: ["walk the dog", "feed the cat", "feed the dog", "feed the pet", "遛狗", "遛猫", "喂猫", "喂狗", "喂宠物"],
  },
]

type ReminderListIconRule = {
  icon: string
  aliases: string[]
}

// Generic category words are trustworthy for a List name, but too broad for an
// arbitrary title. Matching remains exact after removing decoration and a common
// trailing “List / 清单 / 提醒” suffix.
const REMINDER_LIST_ICON_RULES: ReminderListIconRule[] = [
  { icon: "briefcase.fill", aliases: ["工作", "工作项目", "我的工作", "办公", "work", "work projects", "office", "business"] },
  { icon: "checkmark.circle.fill", aliases: ["待办", "任务", "差事", "tasks", "to do", "todo", "errands"] },
  { icon: "cart.fill", aliases: ["购物", "每周购物", "采购", "买东西", "shopping", "shopping groceries", "groceries", "grocery"] },
  { icon: "house.fill", aliases: ["家庭", "居家", "家务", "home", "family", "household"] },
  { icon: "heart.text.square.fill", aliases: ["健康", "health", "wellness"] },
  { icon: "dumbbell.fill", aliases: ["健身", "运动", "fitness", "workout", "sports"] },
  { icon: "cross.case.fill", aliases: ["医疗", "看病", "medical", "healthcare"] },
  { icon: "pills.fill", aliases: ["用药", "吃药", "medicine", "medication"] },
  { icon: "graduationcap.fill", aliases: ["学习", "学校", "课程", "教育", "study", "school", "classes", "education"] },
  { icon: "book.closed.fill", aliases: ["阅读", "书籍", "读书", "reading", "books"] },
  { icon: "suitcase.rolling.fill", aliases: ["旅行", "旅行计划", "旅游", "出行", "出行计划", "travel", "travel plans", "trips", "vacation"] },
  { icon: "repeat.circle.fill", aliases: ["订阅", "会员", "subscriptions", "subscription", "memberships"] },
  { icon: "doc.text.fill", aliases: ["账单", "账单缴费", "缴费", "费用", "bills", "bills payments", "bill payments", "utilities"] },
  { icon: "creditcard.fill", aliases: ["信用卡", "还款", "credit cards", "credit card"] },
  { icon: "building.columns.fill", aliases: ["财务", "金融", "银行", "finance", "banking", "money"] },
  { icon: "car.fill", aliases: ["车辆", "汽车", "用车", "car", "cars", "vehicle"] },
  { icon: "pawprint.fill", aliases: ["宠物", "猫狗", "pets", "pet care"] },
  { icon: "birthday.cake.fill", aliases: ["生日", "纪念日", "birthdays", "anniversaries"] },
  { icon: "doc.on.doc.fill", aliases: ["证件", "合同", "文件", "documents", "contracts"] },
  { icon: "wrench.and.screwdriver.fill", aliases: ["维修", "保养", "维护", "maintenance", "repairs"] },
  { icon: "calendar", aliases: ["预约", "日程", "appointments", "schedule"] },
  { icon: "play.rectangle.fill", aliases: ["影音", "影视", "电影", "movies", "movies tv", "streaming"] },
  { icon: "music.note", aliases: ["音乐", "music"] },
  { icon: "gamecontroller.fill", aliases: ["游戏", "games", "gaming"] },
  { icon: "sparkles", aliases: ["人工智能", "ai services", "ai"] },
  { icon: "globe", aliases: ["数字服务", "网络服务", "digital services", "online services"] },
]

const KIND_FALLBACKS = new Map<ItemKind, string>(
  ITEM_KIND_DEFINITIONS.map(definition => [definition.value, definition.icon] as const),
)

const DEFAULT_ICON: ResolvedDueIcon = {
  name: "calendar.badge.clock",
  label: "日期",
  color: "systemTeal",
}

const ICON_OPTION_NAMES = new Set(DUE_ICON_OPTIONS.map(option => option.name))
const ICON_OPTIONS_BY_NAME = new Map(DUE_ICON_OPTIONS.map(option => [option.name, option]))
const COMPILED_ICON_RULES = compileIconRules(ICON_RULES)
const COMPILED_REMINDER_CONTENT_RULES = compileIconRules(REMINDER_CONTENT_RULES)
const REMINDER_LIST_ICONS_BY_TITLE = new Map(
  REMINDER_LIST_ICON_RULES.flatMap(rule => (
    rule.aliases.map(alias => [normalizeReminderListTitle(alias), rule.icon] as const)
  )),
)

export function normalizeIconOverride(value: unknown): string | null {
  if (typeof value !== "string") return null
  return ICON_OPTION_NAMES.has(value) ? value : null
}

export function resolveDueIcon(
  title: string,
  kind: ItemKind | "reminder",
  override: string | null = null,
): ResolvedDueIcon {
  const normalizedOverride = normalizeIconOverride(override)
  const inferredName = normalizedOverride
    ?? bestMatchingIcon(title)
    ?? (kind === "reminder" ? "checklist" : KIND_FALLBACKS.get(kind))
    ?? DEFAULT_ICON.name
  return resolvedIcon(inferredName)
}

/** Returns only a local icon hint; reminder notes themselves must not be cached. */
export function inferReminderNoteIcon(notes: unknown): string | null {
  if (typeof notes !== "string") return null
  return bestMatchingReminderTextIcon(notes.slice(0, 1000))
}

/**
 * Apple Reminders use their own layered inference so a specific title always
 * outranks the List name, and the List always outranks optional notes.
 */
export function resolveReminderIcon(
  title: string,
  calendarTitle: string,
  notes: string | null = null,
  cachedNoteIconHint: string | null = null,
): ResolvedDueIcon {
  const inferredName = bestMatchingReminderTextIcon(title)
    ?? bestMatchingIcon(calendarTitle)
    ?? bestMatchingReminderListIcon(calendarTitle)
    ?? inferReminderNoteIcon(notes)
    ?? normalizeIconOverride(cachedNoteIconHint)
    ?? "checklist"
  return resolvedIcon(inferredName)
}

function resolvedIcon(iconName: string): ResolvedDueIcon {
  const definition = ICON_OPTIONS_BY_NAME.get(iconName)
    ?? ICON_OPTIONS_BY_NAME.get(DEFAULT_ICON.name)
  if (!definition) return DEFAULT_ICON
  return {
    name: definition.name,
    label: definition.label,
    color: definition.color,
  }
}

type NormalizedTitle = {
  raw: string
  words: string
}

function bestMatchingIcon(title: string): string | null {
  return bestMatchingIconFromRules(title, COMPILED_ICON_RULES)
}

function bestMatchingReminderTextIcon(text: string): string | null {
  return bestMatchingIcon(text)
    ?? bestMatchingIconFromRules(text, COMPILED_REMINDER_CONTENT_RULES)
}

function bestMatchingIconFromRules(
  title: string,
  rules: readonly CompiledIconRule[],
): string | null {
  const normalizedTitle = normalizeTitle(title)
  let bestIcon: string | null = null
  let bestScore = -1

  for (const rule of rules) {
    if (!ICON_OPTION_NAMES.has(rule.icon)) continue
    for (const exactKeyword of rule.exactKeywords) {
      if (normalizedTitle.raw.trim() === exactKeyword) {
        const score = 10_000 + exactKeyword.length
        if (score > bestScore) {
          bestIcon = rule.icon
          bestScore = score
        }
      }
    }
    for (const keyword of rule.keywords) {
      const score = keywordMatchScore(normalizedTitle, keyword)
      if (score !== null && score > bestScore) {
        bestIcon = rule.icon
        bestScore = score
      }
    }
  }

  return bestIcon
}

function bestMatchingReminderListIcon(title: string): string | null {
  for (const candidate of reminderListTitleCandidates(title)) {
    const iconName = REMINDER_LIST_ICONS_BY_TITLE.get(candidate)
    if (iconName && ICON_OPTION_NAMES.has(iconName)) return iconName
  }
  return null
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").toLowerCase()
}

function normalizeTitle(title: string): NormalizedTitle {
  const raw = normalizeText(title)
  return {
    raw,
    words: asciiWords(raw),
  }
}

function normalizeReminderListTitle(title: string): string {
  return normalizeText(title)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function reminderListTitleCandidates(title: string): string[] {
  const normalized = normalizeReminderListTitle(title)
  if (!normalized) return []
  const candidates = new Set<string>([normalized])
  let candidate = normalized
  while (candidate) {
    const stripped = candidate
      .replace(/\s+(?:lists?|tasks?|reminders?)$/, "")
      .replace(/(?:清单|列表|事项|提醒)$/, "")
      .trim()
    if (!stripped || stripped === candidate) break
    candidates.add(stripped)
    candidate = stripped
  }
  return [...candidates]
}

function asciiWords(value: string): string {
  return value
    .replace(/[^a-z0-9+]+/g, " ")
    .trim()
}

function compileKeyword(keyword: string): CompiledKeyword {
  const raw = normalizeText(keyword)
  const words = asciiWords(raw)
  const containsNonASCII = /[^\u0000-\u00ff]/.test(raw)
  return {
    raw,
    words,
    containsNonASCII,
    score: containsNonASCII ? raw.length : words.replaceAll(" ", "").length,
  }
}

function compileIconRules(rules: readonly IconRule[]): CompiledIconRule[] {
  return rules.map(rule => ({
    icon: rule.icon,
    keywords: rule.keywords.map(compileKeyword),
    exactKeywords: (rule.exactKeywords ?? []).map(keyword => normalizeText(keyword).trim()),
  }))
}

function keywordMatchScore(title: NormalizedTitle, keyword: CompiledKeyword): number | null {
  if (!keyword.raw) return null
  if (keyword.containsNonASCII) {
    return title.raw.includes(keyword.raw) ? keyword.score : null
  }
  if (!keyword.words) return null
  return ` ${title.words} `.includes(` ${keyword.words} `)
    ? keyword.score
    : null
}
