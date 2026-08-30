# 到期管家 for Scripting

紧凑原生风格的 iPhone 到期事项组件，按 Apple 公布的 WidgetKit 尺寸自适应小、中、大版式，支持信用卡账单、订阅、周期事项与 Apple 提醒事项。小号组件右上角显示当前事项日期，并在下方预告队列中的下一项；透明的交互式完成按钮不会绘制系统灰色底盘，事项保存后当前项与下一项按时间线过渡补位，并可继续完成新出现的事项。Apple 提醒事项可按一个或多个具体列表筛选；事项名称会在本机智能匹配 SF Symbols，也可手动选择图标。

## 一键安装或更新

[在 iPhone 上安装或更新到期管家](https://www.scripting.fun/import_scripts/?urls=%5B%22https%3A%2F%2Fgithub.com%2FMaroonYS%2Fscripting-due-manager%2Freleases%2Flatest%2Fdownload%2Fdue-manager.scripting%22%5D)

固定链接始终指向 GitHub 最新发行版中的不可变安装包，避免分支原始文件的 CDN 缓存返回旧版。安装后，脚本还会通过 `remoteResource` 使用同一地址检查更新。

从 1.2.0 升级时先不要删除手机里的旧脚本；让现有脚本更新到最新版后运行一次，它会把旧事项迁移到本机持久域。此后更新脚本或刷新数据都无需重新添加事项或桌面组件。

完整功能说明和安装要求见 [`到期管家/README.md`](./到期管家/README.md)。

## 仓库内容

- `到期管家/`：可维护的 Scripting 源码。
- `到期管家.scripting`：可直接导入的发行包。
- `tests/`：日期、周期、图标匹配、完成过渡代次、队列补位、幂等完成、提醒事项列表筛选和完成测试。
