# v2.6.0 — 小号组件双模式与品牌选择

Copyright (c) 2026 MaroonYS. 本文受仓库 LICENSE 约束，第三方图案权利除外。

## 范围和已知限制

小号组件当前事项支持「系统图标／品牌 Logo 优先」，默认保留系统样式。
332 个名称可搜索、逐项指定；它们是名称目录，不是 332 套已授权／已打包 Logo。
首批只有 SafePal、Telegram 两套官方素材；其他名称显示回退状态。
品牌用途是事项识别，点击主图标仍完成事项，不是打开品牌 App。
底部 11 pt 下一事项预告、中号、大号和锁屏图标不变。

设置使用原有共享 AppSettings，旧数据和旧备份缺少新字段时默认系统模式。
逐项选择以来源和事项 ID 区分，不改标题、日期、周期、完成标识或 EventKit 数据。
备份只保存品牌偏好中的提醒 ID，不新增导出 Apple 提醒标题或备注。
损坏／重复偏好拒绝写入，未知但格式有效的品牌 ID 保留并回退，最多 2000 个逐项偏好。
已经手选的 SF Symbol 不被自动品牌推断覆盖；只有用户明确指定品牌时才能替换。

## 实现依据

- [Scripting Button](https://scriptingapp.github.io/guide/Views/Button)：保留原生 `title + systemImage`、`labelStyle="iconOnly"` 和精确完成 Intent。
- [Scripting Image](https://scriptingapp.github.io/guide/Views/Image/) 与 [UIImage](https://scriptingapp.github.io/guide/Utilities/UIImage)：加载本地 PNG，先确认深浅两份均可解码，失败则保留 SF Symbol。
- [Scripting background](https://scriptingapp.github.io/guide/View%20Modifiers/foregroundStyle%20%26%20background)：Logo 是非交互图片背景，原完成按钮仍拥有 40 pt 矩形目标、原生语义标题与唯一 Intent。
- [Scripting 着色适配](https://scriptingapp.github.io/guide/Widget/Tinted%20Mode%20Adaptation%20Guide)：原彩图像设置 `widgetAccentedRenderingMode="fullColor"`，Logo 按钮不加入着色组。实际 WidgetKit 呈现仍需真机验证。
- [素材来源和哈希](../到期管家/assets/brands/SOURCES.md)：SafePal 20 pt 标志保留四边各 10 pt 净空，Telegram 24 pt 放入 40 pt 槽。原 PNG 无修改。

## 自动与本机参考验证

- Bun 1.3.11 全套 277 项测试，13 个文件；Asia/Hong_Kong、UTC、America/New_York 三个时区均通过，0 失败。TypeScript 7.0.2 严格检查及 `git diff --check` 通过。
- 新增 12 项品牌测试：332 个名称与唯一 ID、源文件 PNG／SHA-256、保守匹配及冲突、SF 手选优先、只读和缓存保护、来源隔离、未知 ID 保留、设置校验、快照与备份往返、保存失败、缺失／损坏解码回退。
- 执行实际 TSX 的完成按钮测试，比较两种模式的原生语义标题、热区、同一 source/id/occurrenceKey、原彩图像配置；静态只读／缓存项没有 Intent。
- 执行实际设置和逐项选择 TSX：默认模式、只写视觉偏好、重复点击锁、刷新失败不冒充保存失败、保存失败不更新 UI、36 个运营商搜索结果及未内置素材状态。
- `tools/qa_brand_buttons.swift` 生成 macOS SwiftUI 等价按钮的深／浅色参考图，已目视核对两套标志、SF 回退、对比度和留白。**这不是 iPhone Scripting／WidgetKit 截图，不证明宿主的真实点击或 VoiceOver 行为。**
- 生成器保留候选名称的稳定哈希 ID；素材与榜单采集脚本不进入手机安装包，组件运行时不下载图案。

## iPhone 真机待验收

1. 不删除旧脚本，更新并运行。确认事项、周期、列表范围、通知和原系统图标保持原状。
2. 进入「显示与组件 → 小组件图标」，切至品牌优先；测试 `SafePal 月费` 和 `Telegram Premium`。分别在浅色、深色、桌面着色／透明模式检查图案、留白和对比度。
3. 对同一事项选择系统／自动／指定品牌，再退出重开；缺图品牌应明确提示回退。显式手选的原 SF Symbol 在自动模式保留。
4. 使用一条可安全完成的测试事项点击主 Logo：只完成当前周期，随后下一项补位；连续点按或旧组件重放不得完成后续周期。标题仍打开原事项详情，不打开品牌 App。
5. 用 VoiceOver 确认主 Logo 仍读作“完成 + 当前事项”，而不是品牌 App 的打开按钮；检查 40 pt 目标边缘可点击。
6. 缓存／只读事项应显示灰色系统图标且不能完成；缺失或无法解码 PNG 时显示原系统符号，不出现空白按钮。
7. 确认小号底部预告及中大号图标、详情跳转、金额开关不变；导出／恢复备份后品牌偏好一致。
