# 到期管家 v3.4.0 验证记录

日期：2026-09-09。范围：删除新增外部图库、扩展与折叠 SF Symbols、标题／备注匹配，以及桌面组件完成和系统提醒导航。未修改真实 Apple 提醒事项或读取用户账号凭据。

## 已完成验证

- Bun 1.3.11：314 项测试、18 个文件，在 Asia/Hong_Kong、UTC、America/New_York 分别通过，0 失败。故障注入测试会输出预期的存储／缓存错误，不代表测试失败。
- TypeScript 7.0.2 严格检查：`tsc -p tsconfig.validation.json` 通过。
- 182 个符号名称去重、原有 130 个选项保留、各主题不为空，简体／繁体／英文及名称搜索测试通过。本机 AppKit 对全部 182 个名称调用 `NSImage(systemSymbolName:)` 均能解析；这只证明当前 Mac 系统可解析，不等同于旧版 iOS 的渲染验收。
- 主题初次进入全部折叠，不构建隐藏的 182 行；独立展开、全部展开／收起、搜索自动展开、清空搜索恢复原展开状态、无匹配提示通过。两类事项均覆盖暂存、保存、取消、保存失败及并发选择校验。
- 图库代码、账号页、网络搜索、图片读取及内置图像目录不存在。运行代码只在升级清理／旧备份解析中保留退役 ID 前缀和两个精确钥匙串键；不再连接图库服务。
- 升级清理保留事项、日期、周期及 SF 选择；旧图库订阅和相关选择不进入新备份。清理失败不会重置数据、泄漏凭据或清空无关钥匙串键；失败保留可重试原值。用户既有备份文件和历史发行不删除。
- 标题具体语义、泛化标题的强备注细化、普通备注与 List 兜底、Wallet Plan 编号、长备注提示以及本地图标覆盖通过；提示缓存不保存系统备注正文。
- 小、中、大组件实际按钮参数、标签热区、内容链接、事项／期次身份通过测试。执行真实 AppIntent 回调代码并模拟原生边界，覆盖成功、旧期次、已不存在、缓存失败、只读、512 字符 ID 和串行重复点击。
- 导航入口使用原始 ID 调用 Reminder.get，仅将可解析的当前标识交给 Safari.openURL。无效输入、找不到事项、不支持的 ID 及系统拒绝打开均显式失败，不打开首页或其他事项，不完成或编辑系统数据；入口不会先加载主界面或启动维护。
- 实时读取优先使用 `dueDateIncludesTime`；全天带零时分、定时缺少时分字段、旧接口仅有 hour、午夜以及无效／超长／缺失 ID 的回归通过。
- 原日期、跨时区、月末／闰日、完成记录、撤销、备份恢复、缓存新鲜度、并发写入、通知和启动安全测试保留。

## 包与发行校验

从当前 `到期管家/` 重新创建 ZIP 容器，不追加到旧包。验证压缩包完整性、版本 3.4.0、逐文件源码一致性，以及根目录和包内 LICENSE／NOTICE 完全相同。当前包不包含已删除的图库目录、旧模块或实验脚本。

GitHub 官方流水线再次运行测试、类型及逐文件校验，生成 SHA256SUMS 和签名来源证明；其结果以本次提交对应的 Actions 运行与发行资产为准。旧文件可在历史 Git 标签恢复，没有改写已有发行。

## 真机待验收（不可由本机测试代替）

1. 更新原脚本后运行一次，核对原事项及日期不变、旧彩色图案恢复为系统符号、无图库入口；主界面无清理失败提示，再请求刷新小组件。
2. 在真实 iPhone 的小／中／大组件分别点左图标：手动一次性只完成一次，周期只前进一期，系统提醒在 Apple 提醒事项中完成。等新时间线到达后继续点下一项，确认没有旧动作绑定。
3. 快速双击、点击旧时间线、只读列表及离线缓存不得推进其他期次。检查「上次组件操作」中的明确状态，完成后刷新仍受 WidgetKit 调度影响。
4. 点击每种组件的标题／日期／摘要／下一事项预告，确认经 Scripting 打开正确系统提醒，覆盖 iCloud 和用户实际账户；无效或已删除 ID 应提示。手动事项仍进入其编辑页。
5. 在提醒事项修改标题或备注后实时同步：确认具体标题优先，备注能细化泛化标题，手选符号不被覆盖；离线缓存不含备注正文。
6. 手动和系统选图页检查 11 个折叠主题、搜索、展开／收起、取消与保存；核对新增符号的实际显示、深浅色、大字及 VoiceOver。

此环境不能执行 iPhone Scripting／WidgetKit 原生点击，因此没有声称已经复现并在用户设备确认修复。详情地址仍是未公开的 `x-apple-reminderkit://REMCDReminder/{UUID}`，即使系统接受 URL 也不能由返回值证明最终选中正确详情，必须在设备观察。没有使用首页回退来掩盖这一边界。

## 接口依据

- [Apple：从小组件链接到具体场景](https://developer.apple.com/documentation/WidgetKit/Linking-to-specific-app-scenes-from-your-widget-or-Live-Activity)：组件激活先向宿主交付 URL；据此改为宿主运行入口转交系统提醒导航。
- [Scripting Script](https://scriptingapp.github.io/guide/Script/Script)：`createRunURLScheme`。
- [Scripting Safari](https://scriptingapp.github.io/guide/Device%20Capabilities/Safari/)：`openURL` 返回系统是否接受打开请求，不等于详情定位验收。
- [Scripting 2.4.9](https://scriptingapp.github.io/TestFlight/guide/Changelog/2.4.9/)：Reminder 标识、get、save 与 dueDateIncludesTime。
- [Scripting Button](https://scriptingapp.github.io/guide/Views/Button) 与 [DisclosureGroup](https://scriptingapp.github.io/guide/Views/List/DisclosureGroup/)：原生子标签、可控展开状态及回调。
