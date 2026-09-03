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

export type DueIconLabelLanguage = "en" | "zh-Hans" | "zh-Hant"

// Compact English names are intentionally curated instead of exposing SF
// Symbol identifiers such as “takeoutbag.and.cup.and.straw.fill” in widgets.
const ENGLISH_ICON_LABELS: Record<string, string> = {
  "creditcard.fill": "Credit Card",
  "building.columns.fill": "Banking",
  "banknote.fill": "Payments",
  "chart.line.uptrend.xyaxis": "Investments",
  "chart.pie.fill": "Budgeting",
  "doc.text.magnifyingglass": "Tax & Accounting",
  "percent": "Rates & Offers",
  "dollarsign.circle.fill": "Taxes & Fees",
  "shield.fill": "Insurance",
  "play.rectangle.fill": "Streaming Video",
  "music.note": "Music",
  "headphones": "Audiobooks",
  "mic.fill": "Podcasts",
  "waveform": "Audio",
  "radio.fill": "Radio",
  "gamecontroller.fill": "Games",
  "tv.fill": "Television",
  "sportscourt.fill": "Sports",
  "theatermasks.fill": "Entertainment",
  "ticket.fill": "Tickets",
  "briefcase.fill": "Business",
  "checklist": "Tasks",
  "checkmark.circle.fill": "To-Do",
  "calendar": "Calendar",
  "note.text": "Notes",
  "envelope.fill": "Email",
  "doc.on.doc.fill": "Documents",
  "signature": "E-Signatures",
  "rectangle.3.group.fill": "Projects",
  "printer.fill": "Printing",
  "scanner.fill": "Scanning",
  "storefront.fill": "Stores",
  "sparkles": "AI Services",
  "icloud.fill": "Cloud Storage",
  "externaldrive.fill": "Backups",
  "globe": "Websites & Domains",
  "wifi": "Internet",
  "iphone": "Mobile Plan",
  "desktopcomputer": "Software & Devices",
  "terminal.fill": "Developer Tools",
  "curlybraces.square.fill": "Coding",
  "lock.shield.fill": "VPN & Privacy",
  "shield.lefthalf.filled": "Security",
  "key.fill": "Passwords",
  "network": "Networking",
  "server.rack": "Servers & Hosting",
  "square.grid.2x2.fill": "Apps & Services",
  "puzzlepiece.extension.fill": "Browser Extensions",
  "message.fill": "Messages",
  "bubble.left.and.bubble.right.fill": "Social Networks",
  "video.fill": "Video Meetings",
  "person.2.fill": "Teams",
  "person.3.fill": "Communities",
  "heart.fill": "Dating",
  "crown.fill": "Premium",
  "phone.fill": "Calls",
  "paperplane.fill": "Publishing",
  "bolt.fill": "Electricity",
  "drop.fill": "Water",
  "flame.fill": "Gas",
  "house.fill": "Home & Family",
  "fork.knife": "Food Delivery",
  "takeoutbag.and.cup.and.straw.fill": "Takeout",
  "cup.and.saucer.fill": "Coffee & Tea",
  "cart.fill": "Shopping",
  "bag.fill": "Membership Stores",
  "tshirt.fill": "Clothing Care",
  "shippingbox.fill": "Delivery",
  "hammer.fill": "Home Repairs",
  "washer.fill": "Cleaning",
  "trash.fill": "Recycling",
  "bell.and.waves.left.and.right.fill": "Home Security",
  "pawprint.fill": "Pets",
  "cross.case.fill": "Medical",
  "heart.text.square.fill": "Health Tracking",
  "pills.fill": "Medication",
  "stethoscope": "Doctor Visits",
  "figure.run": "Exercise",
  "dumbbell.fill": "Gym",
  "figure.mind.and.body": "Mindfulness",
  "bed.double.fill": "Sleep",
  "moon.zzz.fill": "Sleep Tracking",
  "brain.head.profile": "Mental Focus",
  "leaf.fill": "Wellbeing",
  "trophy.fill": "Sports Membership",
  "airplane": "Flights & Travel",
  "car.fill": "Car",
  "bus.fill": "Bus",
  "tram.fill": "Train & Metro",
  "ferry.fill": "Ferry",
  "map.fill": "Maps",
  "location.fill": "Location",
  "suitcase.rolling.fill": "Hotels & Luggage",
  "fuelpump.fill": "Fuel & Charging",
  "bolt.car.fill": "EV Charging",
  "parkingsign.circle.fill": "Parking & Tolls",
  "bicycle": "Cycling",
  "graduationcap.fill": "Education",
  "book.fill": "Reading",
  "book.closed.fill": "E-Books & Comics",
  "books.vertical.fill": "Library",
  "newspaper.fill": "News",
  "text.book.closed.fill": "Reference",
  "character.book.closed.fill": "Language Learning",
  "lightbulb.fill": "Skills",
  "function": "Math & Science",
  "globe.asia.australia.fill": "Geography & History",
  "teddybear.fill": "Kids & Family",
  "camera.fill": "Photography",
  "photo.fill.on.rectangle.fill": "Photos",
  "paintbrush.fill": "Drawing & Design",
  "paintpalette.fill": "Design Assets",
  "pencil.and.ruler.fill": "Drafting & Layout",
  "scissors": "Editing",
  "wand.and.stars": "Effects",
  "film.fill": "Filmmaking",
  "cube.transparent.fill": "3D Modeling",
  "scribble.variable": "Handwriting",
  "gift.fill": "Gifts",
  "birthday.cake.fill": "Birthdays",
  "heart.circle.fill": "Charity",
  "doc.text.fill": "Bills",
  "repeat.circle.fill": "Subscriptions",
  "calendar.badge.clock": "Dates",
  "wrench.and.screwdriver.fill": "Repairs",
  "cloud.sun.fill": "Weather",
  "umbrella.fill": "Rain",
  "tag.fill": "Pricing",
  "bell.fill": "Alerts",
  "qrcode": "Passes",
}

const TRADITIONAL_ICON_PHRASES: Array<[string, string]> = [
  ["视频流媒体", "影片串流"],
  ["日历", "日曆"],
  ["历史", "歷史"],
  ["电台", "電臺"],
  ["账单", "帳單"],
  ["账务", "帳務"],
  ["影片制作", "影片製作"],
  ["制图", "製圖"],
]

const TRADITIONAL_ICON_CHARACTERS: Record<string, string> = {
  "专": "專", "乐": "樂", "习": "習", "书": "書", "云": "雲", "亲": "親",
  "价": "價", "优": "優", "会": "會", "体": "體", "储": "儲", "儿": "兒",
  "写": "寫", "创": "創", "办": "辦", "务": "務", "动": "動", "医": "醫",
  "协": "協", "单": "單", "卖": "賣", "参": "參", "发": "發", "团": "團",
  "图": "圖", "声": "聲", "备": "備", "娱": "娛", "学": "學", "宠": "寵",
  "宽": "寬", "导": "導", "带": "帶", "广": "廣", "库": "庫", "应": "應",
  "开": "開", "戏": "戲", "户": "戶", "扩": "擴", "扫": "掃", "护": "護",
  "报": "報", "摄": "攝", "数": "數", "时": "時", "机": "機", "档": "檔",
  "气": "氣", "洁": "潔", "测": "測", "浏": "瀏", "现": "現", "电": "電",
  "画": "畫", "疗": "療", "监": "監", "盘": "盤", "码": "碼", "礼": "禮",
  "笔": "筆", "签": "簽", "约": "約", "级": "級", "纪": "紀", "绘": "繪",
  "络": "絡", "维": "維", "网": "網", "药": "藥", "视": "視", "览": "覽",
  "计": "計", "订": "訂", "议": "議", "讯": "訊", "记": "記", "设": "設",
  "识": "識", "诊": "診", "话": "話", "语": "語", "读": "讀", "课": "課",
  "财": "財", "购": "購", "费": "費", "资": "資", "赛": "賽", "赠": "贈",
  "车": "車", "轨": "軌", "轮": "輪", "软": "軟", "辑": "輯", "辞": "辭",
  "运": "運", "迹": "跡", "邮": "郵", "铁": "鐵", "银": "銀", "门": "門",
  "闻": "聞", "阅": "閱", "队": "隊", "险": "險", "项": "項", "预": "預",
  "频": "頻", "饮": "飲", "饰": "飾", "馆": "館", "骑": "騎", "员": "員",
  "税": "稅",
}

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

export type ReminderListIconRule = {
  icon: string
  aliases: string[]
}

// Generic category words are trustworthy for a List name, but too broad for an
// arbitrary title. Matching remains exact after removing decoration and a common
// trailing “List / 清单 / 提醒” suffix.
export const REMINDER_LIST_ICON_RULES: ReminderListIconRule[] = [
  // Work and productivity
  { icon: "briefcase.fill", aliases: ["工作", "我的工作", "辦公", "办公", "職場", "职场", "商務", "商务", "work", "office", "business", "career"] },
  { icon: "rectangle.3.group.fill", aliases: ["項目", "项目", "工作項目", "工作项目", "項目管理", "项目管理", "工作流", "projects", "work projects", "project management", "workflows"] },
  { icon: "checkmark.circle.fill", aliases: ["待辦", "待办", "任務", "任务", "差事", "雜事", "杂事", "to do", "todo", "tasks", "errands"] },
  { icon: "checklist", aliases: ["提醒事項", "提醒事项", "提醒", "收件箱", "默認", "默认", "reminders", "my reminders", "inbox", "personal", "personal tasks"] },
  { icon: "calendar", aliases: ["日程", "安排", "預約", "预约", "行事曆", "日历", "calendar", "schedule", "appointments", "planning"] },
  { icon: "note.text", aliases: ["筆記", "笔记", "備忘", "备忘", "會議記錄", "会议记录", "notes", "memos", "meeting notes"] },
  { icon: "envelope.fill", aliases: ["郵件", "邮件", "郵箱", "邮箱", "電子郵件", "电子邮件", "email", "emails", "mail"] },
  { icon: "phone.fill", aliases: ["電話", "电话", "通話", "通话", "回電", "回电", "calls", "phone calls", "callbacks"] },
  { icon: "message.fill", aliases: ["通訊", "通讯", "聊天", "消息", "messaging", "chats", "messages", "communications"] },
  { icon: "person.2.fill", aliases: ["團隊", "团队", "協作", "协作", "同事", "teams", "collaboration", "coworkers"] },
  { icon: "doc.on.doc.fill", aliases: ["證件", "证件", "文件", "文檔", "文档", "合同", "資料文件", "资料文件", "documents", "files", "contracts", "paperwork"] },
  { icon: "signature", aliases: ["簽署", "签署", "簽名", "签名", "電子簽名", "电子签名", "signing", "signatures", "e signatures"] },
  { icon: "printer.fill", aliases: ["打印", "打印機", "打印机", "printing", "printers"] },
  { icon: "scanner.fill", aliases: ["掃描", "扫描", "掃描件", "扫描件", "scanning", "scans"] },

  // Finance, bills, subscriptions and expirations
  { icon: "creditcard.fill", aliases: ["信用卡", "卡賬", "卡账", "卡賬單", "卡账单", "信用卡還款", "信用卡还款", "還款", "还款", "credit card", "credit cards", "card bills", "card payments"] },
  { icon: "building.columns.fill", aliases: ["財務", "财务", "金融", "銀行", "银行", "資金", "资金", "finance", "finances", "banking", "money"] },
  { icon: "banknote.fill", aliases: ["付款", "待付款", "收付款", "繳款", "缴款", "payment", "payments", "payables", "payments due"] },
  { icon: "chart.line.uptrend.xyaxis", aliases: ["投資", "投资", "股票", "基金", "證券", "证券", "investment", "investments", "stocks", "funds", "investing"] },
  { icon: "chart.pie.fill", aliases: ["預算", "预算", "記賬", "记账", "收支", "個人財務", "个人财务", "budget", "budgets", "budgeting", "expense tracking"] },
  { icon: "doc.text.magnifyingglass", aliases: ["稅務", "税务", "報稅", "报税", "會計", "会计", "發票", "发票", "tax", "taxes", "tax filing", "accounting", "invoices"] },
  { icon: "percent", aliases: ["利率", "利息", "貸款", "贷款", "分期", "interest", "loans", "installments"] },
  { icon: "shield.fill", aliases: ["保險", "保险", "保單", "保单", "insurance", "insurance policies"] },
  { icon: "doc.text.fill", aliases: ["賬單", "帳單", "账单", "賬單繳費", "账单缴费", "繳費", "缴费", "賬務", "账务", "費用", "费用", "生活繳費", "生活缴费", "bills", "bills payments", "bill payments", "utilities", "expenses"] },
  { icon: "repeat.circle.fill", aliases: ["訂閱", "订阅", "續訂", "续订", "周期服務", "周期服务", "會員", "会员", "subscription", "subscriptions", "renewals", "memberships"] },
  { icon: "tag.fill", aliases: ["優惠", "优惠", "優惠券", "优惠券", "折扣", "coupons", "discounts", "deals"] },
  { icon: "crown.fill", aliases: ["高級會員", "高级会员", "會員權益", "会员权益", "vip", "premium"] },
  { icon: "calendar.badge.clock", aliases: ["到期", "有效期", "續期日期", "续期日期", "expirations", "expiry dates", "renewal dates"] },
  { icon: "heart.circle.fill", aliases: ["公益", "捐贈", "捐赠", "慈善", "charity", "donations"] },

  // Digital services
  { icon: "sparkles", aliases: ["人工智能", "ai服務", "ai服务", "ai工具", "ai tools", "artificial intelligence", "ai", "ai services"] },
  { icon: "icloud.fill", aliases: ["雲存儲", "云存储", "雲盤", "云盘", "網盤", "网盘", "cloud storage", "cloud drive", "online storage"] },
  { icon: "externaldrive.fill", aliases: ["備份", "备份", "數據備份", "数据备份", "硬盤", "硬盘", "backups", "data backup", "external drives"] },
  { icon: "globe", aliases: ["網站", "网站", "域名", "網站域名", "网站域名", "websites", "domains"] },
  { icon: "wifi", aliases: ["寬帶", "宽带", "互聯網", "互联网", "家庭網絡", "家庭网络", "網絡費", "网络费", "broadband", "internet", "home internet", "wifi", "wi fi"] },
  { icon: "iphone", aliases: ["手機", "手机", "話費", "话费", "手機套餐", "手机套餐", "流量套餐", "mobile", "phone plans", "cellular"] },
  { icon: "desktopcomputer", aliases: ["軟件", "软件", "軟件許可", "软件许可", "許可證", "许可证", "設備", "设备", "software", "licenses", "devices"] },
  { icon: "terminal.fill", aliases: ["開發工具", "开发工具", "命令行", "運維", "运维", "developer tools", "command line", "devops"] },
  { icon: "curlybraces.square.fill", aliases: ["編程", "编程", "代碼", "代码", "開發", "开发", "coding", "code", "development"] },
  { icon: "lock.shield.fill", aliases: ["vpn", "隱私", "隐私", "網絡隱私", "网络隐私", "privacy", "online privacy"] },
  { icon: "shield.lefthalf.filled", aliases: ["網絡安全", "网络安全", "殺毒", "杀毒", "安全防護", "安全防护", "security", "cybersecurity", "antivirus"] },
  { icon: "key.fill", aliases: ["密碼", "密码", "密碼管理", "密码管理", "密鑰", "密钥", "passwords", "password manager", "keys"] },
  { icon: "network", aliases: ["網絡管理", "网络管理", "局域網", "局域网", "家庭實驗室", "家庭实验室", "network management", "networking", "homelab"] },
  { icon: "server.rack", aliases: ["服務器", "服务器", "雲主機", "云主机", "主機托管", "主机托管", "servers", "cloud servers", "hosting", "vps"] },
  { icon: "square.grid.2x2.fill", aliases: ["數字服務", "数字服务", "數位服務", "在线服务", "在線服務", "網絡服務", "网络服务", "應用", "应用", "軟件訂閱", "软件订阅", "digital services", "online services", "apps", "software subscriptions"] },
  { icon: "puzzlepiece.extension.fill", aliases: ["瀏覽器擴展", "浏览器扩展", "插件", "擴展", "扩展", "browser extensions", "extensions", "plugins"] },

  // Media and social
  { icon: "play.rectangle.fill", aliases: ["影音", "影視", "影视", "視頻", "视频", "流媒體", "流媒体", "電影", "电影", "video", "streaming", "movies", "movies tv", "movies and tv"] },
  { icon: "music.note", aliases: ["音樂", "音乐", "music"] },
  { icon: "headphones", aliases: ["音頻", "音频", "有聲書", "有声书", "聽書", "听书", "audio", "audiobooks"] },
  { icon: "mic.fill", aliases: ["播客", "podcast", "podcasts"] },
  { icon: "radio.fill", aliases: ["電台", "电台", "廣播", "广播", "radio"] },
  { icon: "gamecontroller.fill", aliases: ["遊戲", "游戏", "games", "gaming"] },
  { icon: "tv.fill", aliases: ["電視", "电视", "追劇", "追剧", "television", "tv", "watchlist"] },
  { icon: "sportscourt.fill", aliases: ["體育賽事", "体育赛事", "賽事", "赛事", "sports events", "matches"] },
  { icon: "theatermasks.fill", aliases: ["演出", "戲劇", "戏剧", "綜藝", "综艺", "shows", "theatre", "theater"] },
  { icon: "ticket.fill", aliases: ["票券", "門票", "门票", "活動票", "活动票", "tickets", "event tickets"] },
  { icon: "newspaper.fill", aliases: ["新聞", "新闻", "報刊", "报刊", "雜誌", "杂志", "news", "newspapers", "magazines"] },
  { icon: "bubble.left.and.bubble.right.fill", aliases: ["社交", "社交媒體", "社交媒体", "社交網絡", "社交网络", "social", "social media", "social networks"] },
  { icon: "video.fill", aliases: ["視頻會議", "视频会议", "線上會議", "线上会议", "video meetings", "video calls", "video conferences"] },
  { icon: "person.3.fill", aliases: ["社群", "社區", "社区", "俱樂部", "俱乐部", "協會", "协会", "communities", "clubs", "associations"] },
  { icon: "heart.fill", aliases: ["交友", "約會", "约会", "婚戀", "婚恋", "dating", "relationships"] },
  { icon: "paperplane.fill", aliases: ["公告", "發布", "发布", "群發", "群发", "announcements", "publishing", "broadcasts"] },

  // Shopping, delivery and home
  { icon: "cart.fill", aliases: ["購物", "购物", "每周購物", "每周购物", "採購", "采购", "買東西", "买东西", "超市", "雜貨", "杂货", "shopping", "shopping groceries", "groceries", "grocery"] },
  { icon: "bag.fill", aliases: ["願望單", "愿望单", "心願單", "心愿单", "會員購物", "会员购物", "wishlist", "wish list", "members shopping"] },
  { icon: "storefront.fill", aliases: ["商店", "門店", "门店", "商超", "零售", "stores", "shops", "retail", "retailers"] },
  { icon: "shippingbox.fill", aliases: ["快遞", "快递", "包裹", "物流", "配送", "收貨", "收货", "發貨", "发货", "delivery", "deliveries", "shipping", "packages", "parcels"] },
  { icon: "fork.knife", aliases: ["餐飲", "餐饮", "美食", "吃飯", "吃饭", "食譜", "食谱", "備餐", "备餐", "dining", "food", "recipes", "meal planning"] },
  { icon: "takeoutbag.and.cup.and.straw.fill", aliases: ["外賣", "外卖", "送餐", "外賣配送", "外卖配送", "takeout", "food delivery", "meal delivery"] },
  { icon: "cup.and.saucer.fill", aliases: ["咖啡", "茶飲", "茶饮", "飲品", "饮品", "coffee", "tea", "drinks"] },
  { icon: "tshirt.fill", aliases: ["服飾", "服饰", "衣物", "衣櫥", "衣橱", "clothing", "clothes", "wardrobe"] },
  { icon: "house.fill", aliases: ["家庭", "居家", "家務", "家务", "住房", "房產", "房产", "home", "family", "household", "housing", "property"] },
  { icon: "bolt.fill", aliases: ["電費", "电费", "電力", "电力", "electricity", "power bills"] },
  { icon: "drop.fill", aliases: ["水費", "水费", "用水", "water", "water bills"] },
  { icon: "flame.fill", aliases: ["燃氣", "燃气", "煤氣", "煤气", "天然氣", "天然气", "gas", "gas bills"] },
  { icon: "hammer.fill", aliases: ["家修", "家庭維修", "家庭维修", "房屋維護", "房屋维护", "home repairs", "home maintenance"] },
  { icon: "washer.fill", aliases: ["清潔", "清洁", "洗衣", "家政", "家庭雜務", "家庭杂务", "household chores", "cleaning", "laundry"] },
  { icon: "trash.fill", aliases: ["垃圾", "回收", "垃圾分類", "垃圾分类", "trash", "rubbish", "recycling"] },
  { icon: "bell.and.waves.left.and.right.fill", aliases: ["家庭安防", "門禁", "门禁", "報警", "报警", "home security", "alarms"] },
  { icon: "pawprint.fill", aliases: ["寵物", "宠物", "貓狗", "猫狗", "寵物護理", "宠物护理", "pets", "pet care"] },
  { icon: "gift.fill", aliases: ["禮物", "礼物", "禮品", "礼品", "gifts"] },

  // Health and fitness
  { icon: "heart.text.square.fill", aliases: ["健康", "健康管理", "健康記錄", "健康记录", "health", "health tracking", "wellness"] },
  { icon: "cross.case.fill", aliases: ["醫療", "医疗", "看病", "醫院", "医院", "medical", "healthcare", "hospital"] },
  { icon: "pills.fill", aliases: ["用藥", "用药", "吃藥", "吃药", "藥物", "药物", "藥品", "药品", "保健品", "medication", "medications", "medicine", "prescriptions", "supplements"] },
  { icon: "stethoscope", aliases: ["醫生", "医生", "門診", "门诊", "複診", "复诊", "就醫預約", "就医预约", "doctors", "doctor visits", "medical appointments"] },
  { icon: "figure.run", aliases: ["跑步", "鍛煉", "锻炼", "訓練", "训练", "exercise", "running", "training"] },
  { icon: "dumbbell.fill", aliases: ["健身", "健身房", "運動", "运动", "fitness", "gym", "workout", "workouts", "sports"] },
  { icon: "figure.mind.and.body", aliases: ["冥想", "正念", "瑜伽", "meditation", "mindfulness", "yoga"] },
  { icon: "bed.double.fill", aliases: ["睡眠", "作息", "bedtime", "sleep", "sleep routine"] },
  { icon: "brain.head.profile", aliases: ["心理健康", "心理", "專注", "专注", "mental health", "focus"] },
  { icon: "leaf.fill", aliases: ["身心健康", "自我關懷", "自我关怀", "營養", "营养", "wellbeing", "self care", "nutrition"] },
  { icon: "trophy.fill", aliases: ["比賽", "比赛", "競賽", "竞赛", "運動成就", "运动成就", "competitions", "tournaments", "achievements"] },

  // Transport and travel
  { icon: "airplane", aliases: ["航班", "飛行", "飞行", "機票", "机票", "flights", "air travel", "airline tickets"] },
  { icon: "car.fill", aliases: ["車輛", "车辆", "汽車", "汽车", "用車", "用车", "汽車保養", "汽车保养", "car", "cars", "vehicles", "car care"] },
  { icon: "bus.fill", aliases: ["公交", "公車", "公车", "巴士", "通勤", "bus", "buses", "commute"] },
  { icon: "tram.fill", aliases: ["公共交通", "地鐵", "地铁", "火車", "火车", "鐵路", "铁路", "transit", "metro", "subway", "trains", "rail"] },
  { icon: "ferry.fill", aliases: ["船務", "船务", "輪渡", "轮渡", "船票", "ferries", "boats", "cruises"] },
  { icon: "map.fill", aliases: ["地圖", "地图", "導航", "导航", "路線", "路线", "maps", "navigation", "routes"] },
  { icon: "location.fill", aliases: ["地點", "地点", "位置", "去處", "去处", "places", "locations", "places to go"] },
  { icon: "suitcase.rolling.fill", aliases: ["旅行", "旅行計劃", "旅行计划", "旅遊", "旅游", "出行", "出行計劃", "出行计划", "假期", "行李", "travel", "travel plans", "trips", "vacation", "vacations", "packing"] },
  { icon: "fuelpump.fill", aliases: ["加油", "油費", "油费", "燃油", "fuel", "gas stations"] },
  { icon: "bolt.car.fill", aliases: ["車輛充電", "车辆充电", "電車充電", "电车充电", "充電樁", "充电桩", "ev charging", "car charging"] },
  { icon: "parkingsign.circle.fill", aliases: ["停車", "停车", "停車費", "停车费", "路橋費", "路桥费", "通行費", "通行费", "parking", "tolls"] },
  { icon: "bicycle", aliases: ["騎行", "骑行", "單車", "单车", "自行車", "自行车", "cycling", "bikes", "bicycles"] },

  // Learning and reading
  { icon: "graduationcap.fill", aliases: ["學習", "学习", "學校", "学校", "課程", "课程", "教育", "作業", "作业", "考試", "考试", "study", "school", "classes", "courses", "education", "homework", "exams"] },
  { icon: "book.closed.fill", aliases: ["閱讀", "阅读", "書籍", "书籍", "讀書", "读书", "書單", "书单", "電子書", "电子书", "漫畫", "漫画", "reading", "books", "ebooks", "comics", "reading list"] },
  { icon: "books.vertical.fill", aliases: ["圖書館", "图书馆", "借書", "借书", "還書", "还书", "library", "borrowed books", "library books"] },
  { icon: "text.book.closed.fill", aliases: ["辭典", "辞典", "參考", "参考", "研究資料", "研究资料", "dictionaries", "reference", "research materials"] },
  { icon: "character.book.closed.fill", aliases: ["語言", "语言", "外語", "外语", "語言學習", "语言学习", "languages", "language learning"] },
  { icon: "lightbulb.fill", aliases: ["知識", "知识", "技能", "學習目標", "学习目标", "knowledge", "skills", "learning goals"] },
  { icon: "function", aliases: ["數學", "数学", "科學", "科学", "理科", "math", "maths", "science", "stem"] },
  { icon: "globe.asia.australia.fill", aliases: ["地理", "歷史", "历史", "人文", "geography", "history", "humanities"] },
  { icon: "teddybear.fill", aliases: ["少兒", "少儿", "親子", "亲子", "兒童", "儿童", "kids", "children", "parenting"] },

  // Creation and design
  { icon: "camera.fill", aliases: ["攝影", "摄影", "拍攝", "拍摄", "相機", "相机", "photography", "camera", "shoots"] },
  { icon: "photo.fill.on.rectangle.fill", aliases: ["照片", "相冊", "相册", "圖庫", "图库", "photos", "photo library", "gallery"] },
  { icon: "paintbrush.fill", aliases: ["繪畫", "绘画", "畫畫", "画画", "美術", "美术", "drawing", "painting", "art"] },
  { icon: "paintpalette.fill", aliases: ["設計", "设计", "設計素材", "设计素材", "視覺設計", "视觉设计", "design", "design assets", "visual design"] },
  { icon: "pencil.and.ruler.fill", aliases: ["製圖", "制图", "排版", "建築設計", "建筑设计", "drafting", "layout", "architecture"] },
  { icon: "scissors", aliases: ["剪輯", "剪辑", "裁剪", "編輯素材", "编辑素材", "editing assets", "cutting", "clipping"] },
  { icon: "wand.and.stars", aliases: ["特效", "美化", "修圖", "修图", "effects", "retouching", "enhancements"] },
  { icon: "film.fill", aliases: ["影片製作", "影片制作", "視頻製作", "视频制作", "電影製作", "电影制作", "filmmaking", "video production"] },
  { icon: "cube.transparent.fill", aliases: ["三維", "三维", "建模", "3d", "3d modeling", "modelling"] },
  { icon: "scribble.variable", aliases: ["創作", "创作", "創意", "创意", "寫作", "写作", "手寫", "手写", "creativity", "creative work", "writing", "handwriting"] },

  // Other common lists
  { icon: "birthday.cake.fill", aliases: ["生日", "紀念日", "纪念日", "birthdays", "anniversaries"] },
  { icon: "cloud.sun.fill", aliases: ["天氣", "天气", "氣象", "气象", "weather"] },
  { icon: "umbrella.fill", aliases: ["雨天", "防雨", "rain", "rainy days"] },
  { icon: "bell.fill", aliases: ["通知", "提醒通知", "notifications", "alerts"] },
  { icon: "qrcode", aliases: ["通行碼", "通行码", "二維碼", "二维码", "證碼", "证码", "passes", "qr codes"] },
  { icon: "wrench.and.screwdriver.fill", aliases: ["維修", "维修", "保養", "保养", "維護", "维护", "repairs", "maintenance"] },
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
const REMINDER_LIST_ICONS_BY_TITLE = buildReminderListIconMap(REMINDER_LIST_ICON_RULES)

export function normalizeIconOverride(value: unknown): string | null {
  if (typeof value !== "string") return null
  return ICON_OPTION_NAMES.has(value) ? value : null
}

/** Human-readable catalog label for a resolved SF Symbol used by widgets. */
export function dueIconLabel(
  iconName: string | null | undefined,
  language: DueIconLabelLanguage = "zh-Hans",
): string {
  const icon = resolvedIcon(iconName ?? DEFAULT_ICON.name)
  if (language === "en") {
    return ENGLISH_ICON_LABELS[icon.name] ?? humanizeSymbolName(icon.name)
  }
  if (language === "zh-Hant") return traditionalIconLabel(icon.label)
  return icon.label
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
    ?? bestMatchingReminderListIcon(calendarTitle)
    ?? bestMatchingIcon(calendarTitle)
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

function traditionalIconLabel(label: string): string {
  let result = label
  for (const [simplified, traditional] of TRADITIONAL_ICON_PHRASES) {
    result = result.replaceAll(simplified, traditional)
  }
  return [...result]
    .map(character => TRADITIONAL_ICON_CHARACTERS[character] ?? character)
    .join("")
}

function humanizeSymbolName(symbolName: string): string {
  return symbolName
    .replace(/\.(?:fill|filled)$/u, "")
    .replaceAll(".", " ")
    .replace(/\band\b/gu, "&")
    .replace(/\b\w/gu, character => character.toUpperCase())
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

function buildReminderListIconMap(
  rules: readonly ReminderListIconRule[],
): Map<string, string> {
  const result = new Map<string, string>()
  for (const rule of rules) {
    if (!ICON_OPTION_NAMES.has(rule.icon)) {
      throw new Error(`Unknown reminder List icon: ${rule.icon}`)
    }
    for (const alias of rule.aliases) {
      const normalizedAlias = normalizeReminderListTitle(alias)
      if (!normalizedAlias) {
        throw new Error(`Empty reminder List alias for ${rule.icon}`)
      }
      const previousIcon = result.get(normalizedAlias)
      if (previousIcon) {
        throw new Error(
          `Duplicate reminder List alias "${normalizedAlias}": ${previousIcon} / ${rule.icon}`,
        )
      }
      result.set(normalizedAlias, rule.icon)
    }
  }
  return result
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
