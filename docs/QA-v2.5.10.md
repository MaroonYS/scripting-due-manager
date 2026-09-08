# v2.5.10 — 设置图标与重复版本行

Copyright (c) 2026 MaroonYS. 本文受仓库 LICENSE 约束。

## 范围

- 删除主界面“版本 + 版本号”整行；不删除更新入口、更新页版本信息或版权页发行信息。
- 只优化金额、Apple 提醒事项、提醒事项列表和小／中／大预览这六个设置入口的图标。
- 新增独立的 settings_icons.tsx，仅供主界面使用；不改动 WidgetKit 展示、点击、
  事项图标推断、同步、存储、通知、版权许可或更新校验。

## 图标规则

金额使用 banknote.fill；Apple 提醒事项使用 list.bullet.clipboard；
提醒事项列表使用 line.3.horizontal.decrease.circle，表达按列表筛选。
SF Symbols 使用单色系统蓝，避免深色模式中层级色导致轮廓过暗。

预览图标由原生 RoundedRectangle、VStack、ZStack 绘制，不新增位图或网络资源：
小号 18×18 pt、中号 22×13 pt、大号 18×22 pt，统一 1.5 pt 描边、3 pt 圆角；
小、中号各两条内部线，大号三条。所有图标占用 24×24 pt，图文间距 12 pt。
原生 Text 不加固定高度、字号或单行限制；Toggle、Button 使用官方支持的自定义标签，
不同时传入互斥的 title。参考
[Toggle 文档](https://scriptingapp.github.io/guide/Views/Controls/Toggle/)、
[Button 文档](https://scriptingapp.github.io/guide/Views/Button)、
[形状文档](https://scriptingapp.github.io/zh/guide/Views/Shapes/)。

## 已执行验证

- Bun 1.3.11：265 项测试，12 个测试文件；Asia/Hong_Kong、UTC、America/New_York
  三个时区均 265 通过、0 失败。
- TypeScript 7.0.2 严格检查通过。
- 新增 6 项测试覆盖图标映射、描边与内容边界、尺寸比例、标签布局、
  实际设置行的开关值／禁用状态／回调、列表筛选及三种预览的精确尺寸参数。
- 旧版针对主界面版本行的断言已改为“该行不存在，但更新页版本信息完整保留”。
- 从实际图标组件导出的视图树生成 macOS SwiftUI 浅色／深色参考图并视觉检查；
  轮廓、内容线条与对齐清晰，没有图标内部溢出。这只是等价图形参考，
  不是 iPhone Scripting 原生页面截图，也不验证该宿主的行布局实现。
- 安装包发布前须解压测试、逐文件核对源码和许可，发布流程继续生成并核验签名来源。

## iPhone 真机待验收

1. 更新后运行主脚本，确认底部只有更新和版权入口，不再出现单独的版本行。
2. 打开更新页，确认当前／最新版本与更新按钮正常。
3. 浅色、深色和较大文字尺寸下检查六个入口：文字不截断，图标不挤压开关和列表副标题。
4. 金额开关影响原来的金额显示；提醒开关和列表选择正常；三个预览分别打开对应尺寸。
5. 确认原桌面组件的尺寸、排版、点击和事项数据保持不变。
