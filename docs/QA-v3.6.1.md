# 到期管家 v3.6.1 验证记录

日期：2026-10-01。修复上一版只限制字号或单轴外框、各事项图标渲染入口的实际适配路径不一致。

## 实现与边界

新增共享 `src/due_symbol.tsx`。`DueSymbol` 用原生 `Image(systemName)`、`resizable=true`、正式 `scaleToFit=true`、显式 regular 字重和数值字号；图形在完整双轴绘制框内等比适配，再放入完整、居中的独立布局框。主界面使用 monochrome，小组件保留 hierarchical 及 accent 标记。未知名称回退到 `calendar.badge.clock`，不改写偏好。输入有有限数值保护，绘制 8–48 pt、布局不超过 64 pt且不小于绘制框。

| 场景 | 绘制框边长 | 布局／点击框边长 |
|---|---:|---:|
| 大预览 | 36 pt | 48 pt |
| 选图网格 | 24 pt | 32 pt；按钮最小高度仍为 84 pt |
| 图标库、自动匹配行、编辑行 | 20 pt | 26 pt |
| 主列表可完成与隐藏事项 | 20 pt | 40 pt |
| 小／中号组件完成图标 | 17 pt | 原 hitSize，保持 40／38 pt及受限行布局 |
| 大号组件完成图标 | 18 pt | 原 hitSize |
| 组件摘要 | 26 pt | 40 pt |
| 下一项预告 | 11 pt | 12 pt |

不把预览、网格和紧凑组件强设同一大小；同一场景的名称和启用状态共用相同绘制规则。保留原比例，不拉伸、裁切，或给个别符号添加未经设备测量的放大系数；不宣称不同轮廓的实心面积完全相同。

`DueSymbolLabel` 保留现有原生 Label 的 title／systemImage、iconOnly、完整矩形标签框和 contentShape。原生符号前景设为正式 clear 色，只用同框背景中的 DueSymbol 呈现图形；不对语义层使用 hidden／opacity=0，不猜测 Label 自定义 icon 或普通 View 的 accessibilityLabel。完成按钮仍只有一个 action／Intent，背景没有独立手势；来源、ID、期次、防重、只读与缓存限制不变。真实 VoiceOver 合并行为、背景是否额外朗读及着色后的透明层仍需设备观察。

216 个目录名称、顺序、标签、颜色、手选和推荐不变。不读取真实事项或账户，不新增运行时图片、字体、文件、网络、存储、计时器或用户内容缓存。日期、周期、金额、完整备注、完成历史、通知、备份、版权、固定更新 URL 和读取／刷新预算不变。设置中的组件轮廓装饰保留独立布局，不与事项图形混为同一角色。

## 官方接口核对

- [Image](https://scriptingapp.github.io/guide/Views/Image/) 定义系统符号和 ImageResizable；[Image Style](https://scriptingapp.github.io/guide/View%20Modifiers/Image%20Style) 明确 scaleToFit 保留比例、完整显示，不是 scaledToFit。未使用裁切型 scaleToFill 或强设 aspectRatio=1。
- [frame](https://scriptingapp.github.io/guide/View%20Modifiers/frame) 支持完整 width、height 和 center。
- [foregroundStyle / background](https://scriptingapp.github.io/guide/View%20Modifiers/foregroundStyle%20%26%20background.md) 确认背景支持 VirtualNode 与 alignment；[Color](https://scriptingapp.github.io/guide/Types/Color.md) 明列 clear。

直接核对正式 App Store 文档，不以测试 any 类型桩推定原生兼容。没有找到 Label 自定义 icon 的正式签名，故不引入。未分发 Apple 资源，符号兼容性依据仍见 [3.6.0 QA](./QA-v3.6.0.md)。

## 自动化回归

使用 Bun 1.3.11 的 `bun test tests` 在 Asia/Hong_Kong、UTC、America/New_York 三个时区分别通过 506 项测试、33 个文件，全部 0 失败。TypeScript 7.0.2 的 `tsc -p tsconfig.validation.json` 严格检查及 `git diff --check` 通过。本次新增 12 项回归，原行为断言保留并适配真实共享渲染路径。

- 执行真实 renderer，覆盖 216 项×10 场景及相同规模的原生语义标签／背景；验证单个可见 Image、resizable／scaleToFit、双轴绘制与布局框、center、regular、名称、颜色、无未知属性或 I/O。
- 网格全部 216 项，手动／提醒图标库各 216 项，预览与自动行；未知名称、空值、非有限数、范围和过小布局保护。
- 主列表真实 active/inactive 20／40 pt；组件真实 Label 背景与 17／18 pt、40／38／受限行框、准确来源／ID／期次、无额外按钮与只读降色。
- 保留选择／确认／取消、退出迟到结果、保存冲突、旧选择、准确完成、防重、缓存、备注、日期、通知、备份及版权回归。仅模拟原生边界和合成数据，不测量 iPhone 像素。

## 安装包

版本 3.6.1 的 ZIP 通过 `unzip -t`。解包与 `到期管家/` 逐文件内容完全一致，按既有规则只排除 README.md／.DS_Store；script.json、index.tsx、src 直接位于包根，包含新增 due_symbol.tsx。LICENSE／NOTICE.md 均与仓库根副本逐字节一致。52 个条目、51 个文件，166,699 字节。SHA-256：`cd3d40622372c8120d42a3895da6bcbdfb1a223f356bf7e7b2e7eb031bf07c60`。

正式工作流再次执行回归、类型、包源码和来源证明校验。实际固定链接下载的比对结果以交付报告为准，不用本机验证冒充远程发行成功。

## 设备待验收

本环境没有可控制的用户 iPhone，下列结果未声称已验证：

1. 信用卡、挂卡、证件、圆章、飞机及旧符号在实际网格、预览、列表和组件中等比、居中、不裁切；记录设备和字体设置，观察视觉重量，不用结构测试代替实际截图。
2. 启用、隐藏、缓存和只读状态不跳动；预览应大于紧凑列表，大字体下文字和点击区域仍正常。
3. 完成按钮四角和中心操作同一事项／期次，文字仍进入对应备注；快速双击不多推进一期。
4. VoiceOver 朗读完整完成标题，背景图形不引起额外或缺失朗读，透明语义层未消失。
5. 深浅、默认／着色／清透桌面模式只显示一份图形，clear 语义层不被着色强制显现，色彩和对比度可辨。必须在当前 Scripting／iOS 的真实组件观察。
6. 更新原脚本运行一次，确认旧手选、日期、周期、金额、完整备注、完成历史、通知与备份保留。请求刷新不等于 iOS 准点呈现。
