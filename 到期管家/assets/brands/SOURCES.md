# 品牌素材来源与使用边界

素材来源核对日期：2026-09-08；加载及裁剪方式更新：2026-09-09；适用版本：2.7.3（PNG 与 2.7.0 相同）。332 个品牌全部有实际图片，共 333 个 PNG 文件（SafePal 有深浅两份）。
素材只用于用户事项的描述性识别，不是品牌 App 启动器；点击主图标仍执行原来的完成操作。
这些第三方图案不属于本项目的独占版权或限制性代码许可，不表示官方合作、背书或任何金融服务推荐。

## 完整来源清单

逐项来源见随包 [manifest.json](./manifest.json)：每条包含稳定品牌 ID、名称、分类、输出文件、字节数、SHA-256、输入来源与哈希、转换方式及权利说明。来源分布：

| 来源 | 品牌数 | 记录内容 |
| --- | ---: | --- |
| 品牌网站及其公开资源 | 164 | 图片 URL、引用页面或官方资源依据、输入哈希 |
| 对应官方 App 的 App Store 图标 | 115 | App ID、应用名称、开发者／销售方及 Apple CDN 图片 URL |
| Simple Icons | 50 | 固定提交的 SVG URL、图标名称、上游颜色，以及已有的指南／许可元数据 |
| LobeHub Icons | 1 | ChatGPT 对应 OpenAI 图案，固定提交的 SVG URL，MIT 条款 |
| 原先核对的 SafePal、Telegram 原图 | 2 | 下列官方来源及原始文件 SHA-256 |

“品牌图标”包括品牌标志、品牌网站图标及对应产品／官方 App 图标；不保证每个服务都存在单独的独立商标图案。部分服务使用其网站当时提供的品牌标识，例如 Amazon Prime、GeForce NOW、Microsoft 365。
App Store 图标来源记录用于确认对应应用及发布者，不把 Apple 的分发服务视为该商标的权利人或再分发许可。

## 文件处理与离线加载

- 新增的 330 个图案等比转换为 144 × 144 PNG，内容放在 120 × 120 的边界内，使用白色或深灰中性底板和留白，不拉伸、不裁切形状、不进行 AI 重绘。
- Simple Icons 的单色 SVG 使用同一固定提交元数据中的品牌色填充；该颜色记录在 `source.color`。其他图案保留源文件已有颜色，未指定的 SVG 颜色使用渲染器默认值。官方多图 SVG 中提取的命名符号另记原资源哈希与符号名。
- 这不是“全部原字节未修改”的素材集合。转换前后哈希分别记录；SafePal、Telegram 三个原 PNG 是例外，保持原字节。
- 从 2.7.1 起，主界面、编辑预览、目录和小号组件统一使用圆形显示遮罩；330 个新图案显示时放大 1.2 倍，将打包新增的 12 px 外圈留白裁去，再按圆形边界显示。圆形遮罩会裁去方形图片四角，这是显示层处理，不改 PNG、Base64、清单和原文件哈希；不是声称显示时完全不裁切。
- 从 2.7.3 起，330 个放大图案仍以 28.8 pt 显示，但圆形裁剪直径由 24 pt 放宽到 28 pt，每侧增加 2 pt 余量，不再将全部打包外圈留白裁尽。ChatGPT 等图案可保留更多外缘，仍会裁去方形底板的四角。
- 主界面和组件以原彩图案在 40 pt 完成槽内显示；SafePal／Telegram 不额外放大，圆形直径仍为 20／24 pt。裁剪边界不大于原图片尺寸，避免露出方形外边。只裁图片，不缩小完成点击区。只读、缓存、冲突或无法解码时保留 SF Symbol。
- 从 2.7.2 起，每个 PNG 的同字节 Base64 备份独立放在 `assets/brands/fallbacks/<文件名>.json`，不再整库嵌入可执行代码。先异步读取单张 PNG，再按需读取对应 JSON；超时 1.5 秒回退系统图标。图片数据同样适用第三方权利例外，不归项目独占。
- 运行时不搜索、不请求 App Store、不下载图标，也不上传事项、SIM 或联系人。主界面首屏不读图片，目录每页 32 项且只为出现的行启动异步读取；小号组件只读取当前品牌，其余尺寸与系统模式不读图片。

## 图标库声明与权利边界

- Simple Icons 固定提交：[777807a262bb7384ff406fd4b35fdcd02e9514c3](https://github.com/simple-icons/simple-icons/tree/777807a262bb7384ff406fd4b35fdcd02e9514c3)。随包保留 [CC0 全文](./simple-icons-license.txt) 和 [完整免责声明](./simple-icons-disclaimer.txt)。其集合采用 CC0，**不等于全部底层图案都是 CC0，也不授予商标权**；逐项已有许可及指南保存在清单中，没有字段不代表没有限制。
- LobeHub Icons 固定提交：[a94750e3f5f8fc33757b839d85030e742284e43a](https://github.com/lobehub/lobe-icons/tree/a94750e3f5f8fc33757b839d85030e742284e43a)。ChatGPT 使用其中 OpenAI SVG，保留 Copyright (c) 2023 LobeHub 及 [MIT 完整条款](./lobe-icons-license.txt)；MIT 条款不表示获得品牌背书或商标许可。
- 网站、应用图标与其中的商标仍属于各自权利人。可公开访问、注明来源、上游图标库许可和个人使用用途，均不等于逐一取得品牌方的书面授权。本项目不作该项声明，也不把本清单当作商用或再分发权利凭证。
- 本次技术核对覆盖来源对应关系、文件完整性和缩略图显示，不构成逐个品牌的全面权利清查。涉及独立再分发、广告、商业使用或其他不同用途时，应另行核实相应授权和品牌指南；有效第三方条款优先于本项目许可中对第三方内容不适用的限制。

## SafePal

- 权利人：SafePal；这里只展示 SafePal 标志，不将其称为 Fiat24 自有标志。
- 官方指南：[SafePal Brand Resource Center](https://www.safepal.com/en/brandassets)。按该页指南作描述性识别，不是单独取得的书面许可；品牌方可撤回许可。
- 原始文件包：[SafePalLogoFiles.zip](https://www.safepal.com/pub/SafePalLogoFiles.zip)，SHA-256 `21b68ca690ca590059bc86131ef878237da0c53c5262ca7913c6ce8b70655bf7`。
- `safepal-dark.png` ← `SafePal Logo Files/Logomark/PNG/Mark - Dark.png`，SHA-256 `b73d9e50a6c2dc890bf47f1aebf3230971c06ab591c44ddae48c20929d5c6b6d`。
- `safepal-light.png` ← `SafePal Logo Files/Logomark/PNG/Mark - Light.png`，SHA-256 `66b358516bbaa30d32ba7bf1bc3da2f50bb4c4e6163842f348f7b8e55d399637`。
- 浅色背景用原始深色标志，深色背景用原始浅色标志。20 pt 标志置于 40 pt 空白槽，四周至少留出半个标志大小；不使用小尺寸完整字标。

## Telegram

- 权利人：Telegram。到期管家不是 Telegram 的官方产品或代表。
- 官方说明：[Telegram Logos and App Screenshots](https://telegram.org/tour/screenshots) 允许示意图、按钮等使用所提供的 Logo，要求明确非官方代表。该页 CC0 条款指截图，不能泛化成所有 Logo 均为 CC0。
- 官方源文件：[Telegram Desktop logo_256_no_margin.png](https://github.com/telegramdesktop/tdesktop/blob/365a9fcf47fcd5459cf530509789154aa3c122c9/Telegram/Resources/art/logo_256_no_margin.png)。使用公开 Logo 说明作为本图案的使用依据，不引入 Telegram 程序代码。
- `telegram.png` 原字节 SHA-256 `44af9a76a532559ef8cb450b48096713be819103ab79a19d7e4abb9b32ff4cb7`。
- 原彩 24 pt 图案置于 40 pt 槽，浅／深色背景使用同一文件。

## 验证与更新

所有 332 条来源、333 个 PNG 及 Base64 备份经过逐字节 SHA-256 检查；macOS ImageIO 成功解码全部图片，并逐页核对深浅色 40 pt 槽位参考图。该参考图不是 iPhone Scripting／WidgetKit 实机验证。
未来新增未知品牌、宿主无解码接口、文件和备份均无法解码，分别显示不同诊断；均不会以空白图案隐藏原系统完成按钮。
开发侧采集、转换、打包及本机参考渲染工具在仓库 `tools/`；运行时图片以此清单哈希为准，重新采集上游变化后的文件必须重新核对。来源、图标版本或权利人要求变化时，应更新或移除对应图案及其内嵌备份。
