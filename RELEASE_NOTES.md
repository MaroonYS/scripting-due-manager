# 到期管家 v2.5.7

## 本次修复

- 取消 `Wallet Plan` 对 `creditcard.fill` 的强制绑定。它现在是中性混合容器：事项标题的明确类别、具体产品和高置信度备注可以为每条事项独立选择图标，无任何可靠信号时使用中性任务图标。
- 在 `Wallet Plan` 内新增严格的编号模块识别。`BANK 06`、`BANK06`、`BANK-06` 使用银行图标；`CREDIT 09`、`CREDIT#09` 使用信用卡图标。同一规则覆盖积分／里程、投资、贷款、保险、税务／征信、账单和付款的英文与简繁中文前缀。
- 编号前缀是明确的用户分类，所以高于标题后部的品牌词；例如 `BANK 08 | Quicksilver` 仍属于银行，`CREDIT 08 | SoFi` 仍属于信用卡。
- 扩展 Equifax、Experian、TransUnion、myFICO、Credit Karma 及信用报告／评分／监控的语义识别，它们使用文档查询图标，不再因所属 List 而显示为信用卡。
- 保留严格边界：模块名必须位于标题开头并紧跟 1–3 位数字。`bank holiday`、`bankruptcy`、`credit union`、`course credit`、`Wallet Planning Workshop` 等仍不会误命中。

## 更新与使用

本次不迁移或重写事项，不改变小、中、大组件的布局、完成操作、详情跳转、系统语言或通知逻辑。更新后运行一次主脚本，使其实时读取 Apple 提醒事项并重新写入图标提示；无需删除事项、重建小组件或重新导入数据。

## 明确限制

- Apple 公开的 EventKit `EKReminder` 属性以及 Scripting 的 `Reminder` 文档都没有提供 iOS 17 以后 List 内的 Section 名称。因此脚本无法直接读取 `Wallet Plan` 中四个系统分区，只能使用可见的事项标题、List 和备注。
- 如果事项只靠系统 Section 归类，标题只有无语义数字且备注为空，程序会安全显示中性图标，而不会根据 Section 顺序猜测。
- 备注正文仍不会进入小组件缓存；缓存只保存白名单 SF Symbol 名称与置信度。

回归范围与真机验收步骤见 `docs/QA-v2.5.7.md`。
