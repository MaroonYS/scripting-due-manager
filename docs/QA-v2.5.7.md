# v2.5.7 回归与验收

## 自动化验证

- `Wallet Plan` 精确 List 必须是 `generic` 中性容器，不得直接返回 `creditcard.fill`。
- `BANK 06`、`BANK06`、`BANK-107` 及简繁中文银行编号标题必须使用 `building.columns.fill`；`CREDIT 05`、`CREDIT#26` 及中文信用卡编号标题必须使用 `creditcard.fill`。
- 积分／里程、投资、贷款、保险、税务／征信、账单和付款的编号前缀必须映射到各自图标。
- 编号前缀必须高于后部产品词：`BANK 08 | Quicksilver` 为银行，`CREDIT 08 | SoFi` 为信用卡。
- `bank holiday`、`bankruptcy`、`credit union`、`course credit`、`Wallet Planning Workshop`、Gift/SIM Card 等负例不得触发编号模块或信用卡误判。
- Equifax、Experian、TransUnion、myFICO、Credit Karma 以及信用报告／评分／监控必须使用 `doc.text.magnifyingglass`。
- `Wallet Plan` 内高置信度备注可覆盖中性后备，普通日常动作备注不得将其误分类。
- 同一 `Wallet Plan` 中的银行、信用卡、信用监控、备注推断及未识别行必须在实时读取和离线缓存中保持各自图标。缓存不得保存备注原文。
- 本次不得改变组件布局、字号、行数、完成按钮、详情跳转、系统语言、通知、排序或存储 schema。
- 发布前运行默认时区、UTC 及 America/Los_Angeles 完整测试，再运行 TypeScript 检查、`git diff --check`、安装包解压比对与云端 Release 资产核验。

本地结果（2026-09-07）：默认时区、UTC 与 America/Los_Angeles 各 **236 项通过、0 失败**；TypeScript 检查无诊断，`git diff --check` 通过。安装包解压后与发布目录逐文件一致，包内版本为 2.5.7，SHA-256 为 `df88f85ec300ae92129be016ac93623ef977a68c91bb72faee8c0e0e14741f5a`。

## iPhone 必须验收

1. 使用固定更新链接升级到 2.5.7，运行一次主脚本，确认无需重新导入事项或删除小组件。
2. 在 `Wallet Plan` 中同时准备 `BANK 06`、`CREDIT 09`、Equifax/Experian 等事项，确认小、中、大组件分别显示银行、信用卡和文档查询图标。
3. 检查其他已有模块；若标题采用 `POINTS 01`、`INVEST 01`、`LOAN 01`、`INSURANCE 01`、`TAX 01`、`BILL 01` 或对应中文前缀，确认图标与语义相符。
4. 为无语义数字标题填写一个明确产品或类别备注，重新运行主脚本后确认图标按备注推断；再清空标题语义和备注，确认显示中性任务图标而不是信用卡。
5. 点击小、中、大组件的左侧图标，确认完成与队列补位逻辑不变；点击文字和日期，确认仍按 2.5.6 的逻辑打开对应 Apple 提醒事项。
6. 切换英文、简体中文与繁体中文系统语言，确认图标语义名称、日期及其他组件文案仍跟随 iPhone 系统语言。

## 接口限制

Scripting `Reminder` 只暴露标题、备注、所属 Calendar/List、日期、优先级等字段，没有 List 内 Section 字段。因此系统「提醒事项」中四个分区的名称不能直接用于图标匹配；稳定区分必须来自事项标题或备注中的可见语义。

自动化测试不能替代 WidgetKit 真机图标刷新、详情跳转、排版、VoiceOver 或完成操作验收。
