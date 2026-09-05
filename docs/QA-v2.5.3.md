# v2.5.3 回归与验收

## 自动化验证

- 系统语言标记与 Scripting 首选语言冲突时，系统语言必须优先；英文系统下 `doc.text.magnifyingglass` 必须显示 “Tax & Accounting”。
- 只提供 `preferredLanguages` 的旧运行环境仍能识别英文；只提供中文语言码、脚本与地区时仍能区分简体和繁体。
- `zh-Hans-HK` 保持简体，`zh-Hant-CN` 保持繁体；与本地化后备文案同名的真实提醒在在线、缓存与完成记录中均不得改写。
- 运行完整测试、TypeScript 检查、安装包解压比对与云端发布检查。

本地结果：默认时区、UTC 与 America/Los_Angeles 各通过 227 项测试，0 失败；TypeScript 无诊断；安装包完整且与源码一致。发布包 SHA-256：`6692fcf6ad1b730bc989372958ade95b9c9c524f2b74545ab6c027a5cf01674e`。

## iPhone 待验收

1. 将 iPhone 系统语言设为 English，同时让 Scripting 使用中文界面；运行一次到期管家并刷新小组件。
2. 小号左上角应显示 “Tax & Accounting”，右侧日期应使用英文格式；中、大及锁屏组件的内置标题、分区、空状态和错误提示也应使用英文。
3. 将 iPhone 系统语言切换为简体中文和繁体中文，各运行一次脚本，确认所有尺寸使用对应文字与日期格式。
4. 核对事项数量、排序、图标、行高、完成点击区域和通知设置均未变化。

自动化测试不等于 WidgetKit 真机刷新、原生排版、动画、VoiceOver 或真实通知送达验证。
