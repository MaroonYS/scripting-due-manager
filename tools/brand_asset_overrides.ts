// SPDX-FileCopyrightText: 2026 MaroonYS
// SPDX-License-Identifier: LicenseRef-Due-Manager-Personal-Use-1.0
// See LICENSE and NOTICE.md. All rights reserved, subject to their exceptions.

/** Supplemental public brand sites and exact asset URLs; never user task data. */
export const ADDITIONAL_BRAND_SITES: Record<string, string[]> = {
  "NIO／蔚来": ["https://www.nio.cn/", "https://www.nio.com/en_GB"],
  "iD Mobile": ["https://www.idmobile.co.uk/help-and-advice"],
  "Mercedes-Benz／奔驰": ["https://www.mbusa.com/", "https://www.mercedes-benz.com.cn/"],
  "Pionex Card": ["https://www.pionex.com/en/", "https://www.pionex.us/"],
  "US Mobile": ["https://www.usmobile.com/plans", "https://www.usmobile.com/blog/"],
  "The Telegraph": ["https://www.telegraph.co.uk/subscriptions/"],
  "Credit Karma": ["https://www.creditkarma.com/about/", "https://www.intuit.com/products/"],
  "RedotPay": ["https://www.redotpay.com/en/", "https://helpcenter.redotpay.com/"],
  "HA Go": ["https://www2.ha.org.hk/hago/en/", "https://www.ha.org.hk/hago/"],
  "Disney+": ["https://www.disneyplus.com/en-gb", "https://help.disneyplus.com/"],
  "Planet Fitness": ["https://www.planetfitness.com/about-planet-fitness"],
  "中银香港／BoC Pay+": ["https://www.bochk.com/tc/home.html", "https://www.bochk.com/en/home.html"],
  "MyChart": ["https://www.mychart.org/Download", "https://www.mychart.org/Home"],
  "Ultra Mobile": ["https://www.ultramobile.com/plans/"],
  "Birdie／自由鸟": ["https://www.birdie.com.hk/mobile/", "https://www.birdie.com.hk/mobile/en/"],
  "Zopa": ["https://www.zopa.com/credit-card", "https://www.zopa.com/about"],
  "SmarTone／数码通": ["https://www.smartone.com/tc/", "https://www.smartone.com/en/"],
  "VOXI": ["https://www.voxi.co.uk/plans"],
  "Google One": ["https://one.google.com/about/", "https://one.google.com/intl/en/about/"],
  "Lebara UK": ["https://mobile.lebara.com/gb/en/", "https://www.lebara.co.uk/en/home.html"],
  "云闪付": ["https://cn.unionpay.com/upowhtml/cn/templates/newInfo-qingAnTong.html", "https://yunshanfu.unionpay.com/"],
  "OneDrive": ["https://www.microsoft.com/en-us/microsoft-365/onedrive/online-cloud-storage", "https://onedrive.com/"],
  "环联香港": ["https://www.transunion.hk/zh", "https://www.transunion.com/"],
  "Lynk & Co／领克": ["https://www.lynkco.com.cn/", "https://www.lynkco.com/en/"],
  "PayMe": ["https://payme.hsbc.com.hk/en/", "https://payme.hsbc.com.hk/zh-hk/"],
  "giffgaff": ["https://www.giffgaff.com/mobile-phones", "https://www.giffgaff.com/sim-only-deals"],
  "Chime": ["https://www.chime.com/about-us/", "https://www.chime.com/blog/"],
  "Fifth Third": ["https://www.53.com/content/fifth-third/en.html", "https://www.53.com/content/fifth-third/en/personal-banking.html"],
  "Kobo": ["https://www.kobo.com/us/en", "https://us.kobobooks.com/"],
  "Microsoft 365": ["https://www.microsoft.com/en-us/microsoft-365", "https://www.office.com/"],
}

export const EXTRA_BRAND_IMAGES: Record<string, { url: string; source: string; sourceType: string; svgSymbol?: string }[]> = {
  "Adobe Creative Cloud": [{ url: "https://www.adobe.com/cc-shared/assets/img/product-icons/svg/creative-cloud.svg", source: "https://www.adobe.com/creativecloud.html", sourceType: "brand-site" }],
  "腾讯云": [{ url: "https://cloudcache.tencent-cloud.com/open_proj/proj_qcloud_v2/gateway/shareicons/cloud.png", source: "https://cloud.tencent.com/", sourceType: "brand-site" }],
  "VOXI": [{ url: "https://www.vodafone.co.uk/newscentre/wp-content/uploads/2024/09/VOXI-texture-logo.png", source: "https://www.vodafone.co.uk/newscentre/media/voxi-texture-logo", sourceType: "brand-site" }],
  "Lynk & Co／领克": [{ url: "https://dm30webimages.lynkco.com.cn/LynkCoPortal/media/0b74de4359d34f87a728d7d9f17971ae/2024-05-31/logo.png", source: "https://www.lynkco.com.cn/", sourceType: "brand-site" }],
  "Apple One": [{ url: "https://www.apple.com/v/apple-one/f/images/overview/hero_logo_apple_one__bhxr6ypxozwy_large_2x.png", source: "https://www.apple.com/v/apple-one/f/built/styles/overview.built.css", sourceType: "brand-site" }],
  "Apple Arcade": [{ url: "https://www.apple.com/v/apple-one/f/images/overview/icon_arcade__bcp3eftw1hhu_large_2x.png", source: "https://www.apple.com/v/apple-one/f/built/styles/overview.built.css", sourceType: "brand-site" }],
  "Apple Fitness+": [{ url: "https://www.apple.com/v/apple-one/f/images/overview/icon_fitness__ds6h8i3y3tqq_large_2x.png", source: "https://www.apple.com/v/apple-one/f/built/styles/overview.built.css", sourceType: "brand-site" }],
  "Apple News+": [{ url: "https://www.apple.com/v/apple-one/f/images/overview/icon_news__cxqcvxs34iuu_large_2x.png", source: "https://www.apple.com/v/apple-one/f/built/styles/overview.built.css", sourceType: "brand-site" }],
  "PlayStation Plus": [
    { url: "https://gmedia.playstation.com/is/image/SIEPDC/ps-plus-black-badge-01-22sep20?$native--t$", source: "https://www.playstation.com/ps-plus/", sourceType: "brand-site" },
    { url: "https://www.playstation.com/etc.clientlibs/global_pdc/clientlibs/auto-clientlibs/pdc.designkit/resources/ps-icons-map__dig__brand.svg", source: "https://www.playstation.com/ps-plus/", sourceType: "brand-site", svgSymbol: "ps-icon_brand_playstation-plus" },
  ],
  "Xbox Game Pass": [{ url: "https://cms-assets.xboxservices.com/assets/5d/fc/5dfc9e21-5f25-4a7b-aea0-0fbcc3787934.jpg?n=1254895_Sharing_200x200.jpg", source: "https://www.xbox.com/xbox-game-pass/", sourceType: "brand-site" }],
  "ChatGPT": [{ url: "https://raw.githubusercontent.com/lobehub/lobe-icons/a94750e3f5f8fc33757b839d85030e742284e43a/packages/static-svg/icons/openai.svg", source: "https://github.com/lobehub/lobe-icons", sourceType: "lobe-icons" }],
  "Grok": [{ url: "https://raw.githubusercontent.com/lobehub/lobe-icons/a94750e3f5f8fc33757b839d85030e742284e43a/packages/static-svg/icons/grok.svg", source: "https://github.com/lobehub/lobe-icons", sourceType: "lobe-icons" }],
}
