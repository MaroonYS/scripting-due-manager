# 到期管家 for Scripting

紧凑原生风格的 iPhone 到期事项组件，按 Apple 公布的 WidgetKit 尺寸自适应小、中、大版式，支持信用卡账单、订阅、周期事项与 Apple 提醒事项。三种尺寸统一视觉安全边距，中、大号组件采用 14 pt 横向、11 pt 纵向内容边距；完成按钮扩大了可点击区域。完成后以代次（generation）驱动 WidgetKit 内容过渡，已完成事项不会被重新塞回队列。Apple 提醒事项可按一个或多个具体列表筛选；只读列表会显示锁定状态。导入的提醒事项会依次根据标题、所属 List、备注和默认值离线推断图标，常见动作与 List 类别也能识别；备注正文不会写入缓存，只保存推断出的图标提示。手动事项现提供 11 种到期类型；内置 130 个本机 SF Symbols，并按 11 个 App Store 常见方向分组。事项名称可离线匹配更多订阅品牌与类别，较长的具体短语优先且收窄了易误判关键词，同时保留手动覆盖和旧图标兼容。

## 一键安装或更新

[在 iPhone 上安装或更新到期管家](https://www.scripting.fun/import_scripts/?urls=%5B%22https%3A%2F%2Fgithub.com%2FMaroonYS%2Fscripting-due-manager%2Freleases%2Flatest%2Fdownload%2Fdue-manager.scripting%22%5D)

固定链接始终指向 GitHub 最新发行版中的不可变安装包，避免分支原始文件的 CDN 缓存返回旧版。安装后，脚本还会通过 `remoteResource` 使用同一地址检查更新。

从 1.2.0 升级时先不要删除手机里的旧脚本；让现有脚本更新到最新版后运行一次，它会把旧事项迁移到本机持久域。此后更新脚本或刷新数据都无需重新添加事项或桌面组件。

完整功能说明和安装要求见 [`到期管家/README.md`](./到期管家/README.md)。

## 仓库内容

- `到期管家/`：可维护的 Scripting 源码。
- `到期管家.scripting`：可直接导入的发行包。
- `tests/`：日期、周期、图标匹配、提醒事项分层图标识别、完成过渡代次、队列补位、幂等完成、列表筛选、只读权限和冲突保护测试。
