// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

/** Research metadata only: no artwork, runtime aliases, or entitlement claims. */
export type SectorPick = {
  name: string
  sector: "telecom" | "automotive" | "subscription"
  group: string
  officialSource: string
  appIDs?: string[]
}
type Row = [name: string, source: string, ...appIDs: string[]]
const rows = (sector: SectorPick["sector"], group: string, values: Row[]): SectorPick[] =>
  values.map(([name, officialSource, ...appIDs]) => ({ name, sector, group, officialSource,
    ...(appIDs.length ? { appIDs } : {}) }))

const verizon = "https://www.verizon.com/about/news/total-wireless-refreshed-lineup-of-unlimited-plans"
const tmobile = "https://www.t-mobile.com/news/business/t-mobile-closes-acquisition-mint-and-ultra-mobile"
const ofca = "https://www.ofca.gov.hk/en/consumer_focus/operators_information/telecommunications_services_providers/index.html"
const ofcom = "https://www.ofcom.org.uk/mobile-coverage-checker/frequently-asked-questions"
const volkswagen = "https://www.volkswagen-group.com/en/group/portrait-and-production-plants.html"
const bmw = "https://www.bmwgroup.com/en/company/brands-products.html"
const gm = "https://www.gm.com/our-brands"
const stellantis = "https://www.media.stellantis.com/uk-en/corporate/press/with-over-2-4-million-registrations-and-a-16-market-share-stellantis-closes-2025-as-the-second-largest-oem-in-the-eu30-automotive-market"
const geely = "https://zgh.com/our-business/?lang=zh-hans"
const hyundai = "https://www.hyundaimotorgroup.com/en/news/hyundai-motor-group-earns-16-iihs-2026-top-safety-awards"
const apple = "https://www.apple.com/apple-one/"

export const sectorPicks: SectorPick[] = [
  ...rows("telecom", "中国大陆手机运营商", [
    ["中国移动", "https://www.10086.cn/", "583700738"],
    ["中国联通", "https://www.10010.com/", "416457422"],
    ["中国电信", "https://www.189.cn/", "513836029"],
    ["中国广电", "https://m.10099.com.cn/h5wap/busiClient/pc/d100/index.html?qrCode=code_1", "1643456835"],
  ]),
  ...rows("telecom", "美国手机运营商与消费品牌", [
    ["AT&T", "https://www.att.com/", "309172177"],
    ["Verizon", verizon, "416023011"],
    ["T-Mobile", tmobile, "1111876388"],
    ["Mint Mobile", tmobile], ["Metro by T-Mobile", "https://www.t-mobile.com/news/offers/metro-by-t-mobile-launches-new-plans"],
    ["Ultra Mobile", tmobile], ["Visible", verizon], ["Total Wireless", verizon],
    ["Cricket Wireless", "https://www.cricketwireless.com/"],
    ["Google Fi Wireless", "https://fi.google.com/about/"], ["US Mobile", "https://www.usmobile.com/"],
  ]),
  ...rows("telecom", "香港手机运营商与消费品牌", [
    ["中国移动香港／CMHK", ofca, "483513425"], ["csl.", ofca, "433378614"],
    ["1O1O", "https://www.1010.com.hk/"], ["3 Hong Kong", ofca, "926630813"],
    ["SmarTone／数码通", ofca, "1171031993"],
    ["Birdie／自由鸟", "https://www.birdie.com.hk/"], ["SoSIM", "https://www.sosimhk.com/tc/index.html"],
    ["Club SIM", "https://www.clubsim.com.hk/"], ["SUN Mobile", "https://www.sunmobile.com.hk/"],
  ]),
  ...rows("telecom", "英国手机运营商与消费品牌", [
    ["EE", "https://ee.co.uk/"], ["O2", ofcom, "325533754"],
    ["Vodafone UK", ofcom, "370901726"], ["Three UK", "https://www.three.co.uk/"],
    ["giffgaff", ofcom, "571246020"], ["Tesco Mobile", ofcom, "633420816"],
    ["Sky Mobile", ofcom], ["VOXI", "https://www.voxi.co.uk/"],
    ["SMARTY", "https://smarty.co.uk/"], ["iD Mobile", "https://www.idmobile.co.uk/"],
    ["Lebara UK", "https://www.lebara.co.uk/en/home.html"], ["Lycamobile UK", ofcom],
  ]),
  ...rows("automotive", "汽车品牌：国际与欧美日系", [
    ["Tesla／特斯拉", "https://www.tesla.com/", "582007913"],
    ["Volkswagen／大众", volkswagen], ["Audi／奥迪", volkswagen], ["Porsche／保时捷", volkswagen],
    ["Škoda／斯柯达", volkswagen], ["CUPRA", volkswagen],
    ["BMW／宝马", bmw], ["MINI", bmw], ["Mercedes-Benz／奔驰", "https://www.mercedes-benz.com/en/"],
    ["Volvo／沃尔沃", geely], ["Land Rover／路虎", "https://www.jlr.com/"], ["Jaguar／捷豹", "https://www.jlr.com/"],
    ["Peugeot／标致", stellantis], ["Citroën／雪铁龙", stellantis], ["Vauxhall", stellantis],
    ["Renault／雷诺", "https://www.renaultgroup.com/en/group/"], ["Fiat／菲亚特", stellantis], ["Jeep", stellantis],
    ["Ford／福特", "https://www.ford.com/"], ["Lincoln／林肯", "https://www.lincoln.com/"],
    ["Chevrolet／雪佛兰", gm], ["Buick／别克", gm], ["Cadillac／凯迪拉克", gm], ["GMC", gm],
    ["Toyota／丰田", "https://www.toyota.com/"], ["Lexus／雷克萨斯", "https://pressroom.lexus.com/"],
    ["Honda／本田", "https://automobiles.honda.com/"], ["Nissan／日产", "https://www.nissanusa.com/"],
    ["Mazda／马自达", "https://www.mazdausa.com/"], ["Subaru／斯巴鲁", "https://www.subaru.com/"],
    ["Hyundai／现代", hyundai], ["Kia／起亚", hyundai], ["Genesis／捷尼赛思", hyundai],
  ]),
  ...rows("automotive", "汽车品牌：中国品牌", [
    ["BYD／比亚迪", "https://www.bydglobal.com/", "493482713"],
    ["Geely／吉利", geely], ["Lynk & Co／领克", geely], ["Zeekr／极氪", geely],
    ["NIO／蔚来", "https://www.nio.com/"], ["XPeng／小鹏", "https://www.xiaopeng.com/"],
    ["理想汽车", "https://www.lixiang.com/"], ["小米汽车", "https://www.xiaomiev.com/"],
    ["AITO／问界", "https://aito.auto/"], ["长安汽车", "https://www.changan.com.cn/"],
    ["深蓝汽车", "https://deepal.com.cn/app-download"], ["AVATR／阿维塔", "https://www.avatr.com/"],
    ["Chery／奇瑞", "https://www.cheryinternational.com/pc/news/news1/20250304/detail-2433.shtml"],
    ["HAVAL／哈弗", "https://www.gwm-global.com/"], ["TANK／坦克", "https://www.gwm-global.com/"],
    ["AION／埃安", "https://www.gacgroup.com/cn/tech/detail?baseid=18478"],
    ["Leapmotor／零跑", "https://cn.leapmotor.com/parameter-pk-web.html?carTypeId=19&platform=web"],
  ]),
  ...rows("subscription", "订阅补充：Apple 与综合套装", [
    ["Apple One", apple], ["iCloud+", apple], ["Apple Music", apple], ["Apple TV（订阅服务）", apple],
    ["Apple Arcade", apple], ["Apple Fitness+", apple], ["Apple News+", apple],
    ["Amazon Prime", "https://www.amazon.com/amazonprime"],
  ]),
  ...rows("subscription", "订阅补充：影音与体育", [
    ["YouTube Premium", "https://www.youtube.com/premium"],
    ["Deezer", "https://www.deezer.com/us/"],
    ["DAZN", "https://www.dazn.com/help/articles/how-do-i-cancel-my-subscription"],
    ["NOW（英国）", "https://www.nowtv.com/"], ["Now TV（香港）", "https://www.nowtv.now.com/"],
    ["Crunchyroll", "https://www.crunchyroll.com/"],
    ["myTV SUPER", "https://promo.mytvsuper.com/en/faq"], ["Viu", "https://www.hq.viu.com/index.html"],
    ["芒果TV", "https://club.mgtv.com/usercenter/buyvip.html"],
  ]),
  ...rows("subscription", "订阅补充：办公、云存储与设计", [
    ["Google One", "https://one.google.com/about/"],
    ["Microsoft 365", "https://www.microsoft.com/en-us/microsoft-365"],
    ["Adobe Creative Cloud", "https://www.adobe.com/creativecloud.html"],
    ["Todoist", "https://www.todoist.com/"], ["Setapp", "https://setapp.com/"],
  ]),
  ...rows("subscription", "订阅补充：密码与隐私", [
    ["1Password", "https://1password.com/"], ["Bitwarden", "https://bitwarden.com/products/"],
    ["Proton", "https://proton.me/"],
  ]),
  ...rows("subscription", "订阅补充：游戏会员与云游戏", [
    ["PlayStation Plus", "https://www.playstation.com/en-us/ps-plus/"],
    ["Xbox Game Pass", "https://www.xbox.com/en-US/xbox-game-pass"],
    ["Nintendo Switch Online", "https://www.nintendo.com/us/switch/online/"],
    ["GeForce NOW", "https://www.nvidia.com/en-us/geforce-now/"],
  ]),
  ...rows("subscription", "订阅补充：学习、健身与冥想", [
    ["Coursera Plus", "https://www.coursera.org/courseraplus"], ["MasterClass", "https://www.masterclass.com/"],
    ["Skillshare", "https://www.skillshare.com/"], ["Headspace", "https://www.headspace.com/"],
    ["Peloton", "https://www.onepeloton.com/membership"],
  ]),
  ...rows("subscription", "订阅补充：开发工具、托管与续费账单", [
    ["JetBrains", "https://www.jetbrains.com/"], ["Cloudflare", "https://www.cloudflare.com/"],
    ["Vercel", "https://vercel.com/"], ["DigitalOcean", "https://www.digitalocean.com/"],
    ["阿里云", "https://www.aliyun.com/"], ["腾讯云", "https://cloud.tencent.com/"],
  ]),
]

/** Cross-category references do not create duplicate brand/product candidates. */
export const subscriptionCategories: Record<string, string[]> = {
  "综合套装": ["Apple One", "Amazon Prime"],
  "视频与体育": ["Netflix", "Disney+", "Prime Video", "HBO Max", "Hulu", "Peacock", "Paramount+", "YouTube Premium", "Apple TV（订阅服务）", "腾讯视频", "爱奇艺", "优酷", "哔哩哔哩", "芒果TV", "DAZN", "NOW（英国）", "Now TV（香港）", "myTV SUPER", "Viu", "Crunchyroll"],
  "音乐与音频": ["Apple Music", "Spotify", "YouTube Music", "QQ音乐", "网易云音乐", "酷狗音乐", "SoundCloud", "TIDAL", "Deezer", "Suno"],
  "AI 服务": ["ChatGPT", "Claude", "Google Gemini", "Grok", "Perplexity", "Suno"],
  "办公与效率": ["Microsoft 365", "Notion", "Goodnotes", "WPS Office", "Zoom", "Slack", "Todoist", "Setapp"],
  "云存储": ["iCloud+", "Google One", "Google Drive", "Dropbox", "OneDrive", "百度网盘", "阿里云盘", "夸克网盘", "Proton"],
  "设计与创作": ["Adobe Creative Cloud", "Lightroom", "Adobe Express", "Canva", "CapCut", "剪映", "Figma"],
  "阅读与新闻": ["Kindle", "Audible", "微信读书", "喜马拉雅", "Kobo", "Apple News+", "The New York Times", "The Wall Street Journal", "The Times", "The Telegraph", "South China Morning Post", "Substack", "香港01"],
  "教育与学习": ["Duolingo", "有道词典", "Coursera Plus", "MasterClass", "Skillshare"],
  "健身与冥想": ["Apple Fitness+", "Strava", "AllTrails", "Keep", "MyFitnessPal", "Calm", "Headspace", "Peloton", "PureGym", "24/7 Fitness", "Planet Fitness"],
  "密码、安全与 VPN": ["1Password", "Bitwarden", "Proton", "NordVPN", "ExpressVPN", "Surfshark"],
  "游戏会员与云游戏": ["Apple Arcade", "PlayStation Plus", "Xbox Game Pass", "Nintendo Switch Online", "GeForce NOW"],
  "购物与生活会员": ["Costco", "山姆会员商店", "Walmart", "京东", "淘宝", "DoorDash", "Uber"],
  "开发工具、托管与续费账单": ["GitHub", "Replit", "JetBrains", "Cloudflare", "Vercel", "DigitalOcean", "阿里云", "腾讯云"],
}
