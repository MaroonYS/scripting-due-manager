# 到期管家 for Scripting

紧凑原生风格的 iPhone 到期事项组件，按 Apple 公布的 WidgetKit 尺寸自适应小、中、大版式，支持信用卡账单、订阅、周期事项与 Apple 提醒事项。小号组件会在当前事项下方预告队列中的下一项；点击完成后，交互式 Toggle 会先由系统即时显示选中填充，事项保存后当前项与下一项再按 WidgetKit 时间线平滑补位。事项名称会在本机智能匹配 SF Symbols，也可手动选择图标。

## 一键安装或更新

[在 iPhone 上安装或更新到期管家](https://www.scripting.fun/import_scripts/?urls=%5B%22https%3A%2F%2Fgithub.com%2FMaroonYS%2Fscripting-due-manager%2Fraw%2Frefs%2Fheads%2Fmain%2F%E5%88%B0%E6%9C%9F%E7%AE%A1%E5%AE%B6.scripting%22%5D)

固定链接始终指向本仓库 `main` 分支中的最新版安装包。安装后，脚本还会通过 `remoteResource` 使用同一地址检查更新。

从 1.2.0 升级时先不要删除手机里的旧脚本；让现有脚本更新到最新版后运行一次，它会把旧事项迁移到本机持久域。此后更新脚本或刷新数据都无需重新添加事项或桌面组件。

完整功能说明和安装要求见 [`到期管家/README.md`](./到期管家/README.md)。

## 仓库内容

- `到期管家/`：可维护的 Scripting 源码。
- `到期管家.scripting`：可直接导入的发行包。
- `tests/`：日期、周期、图标匹配、完成过渡代次、队列补位、幂等完成和提醒事项完成测试。
