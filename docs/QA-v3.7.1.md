# 到期管家 v3.7.1 验证记录

日期：2026-10-05。本轮只改善图标完成后的原生过渡，不修改事项写入、时间线刷新、存储或图标尺寸。

## 方案与依据

- 原 0.32 秒平滑弹簧与从底部整行移入改为明确淡出／淡入：退出 `opacity + easeOut(0.46)`，进入 `opacity + easeIn(0.32).delay(0.08)`；位置布局单独 `smooth({ duration: 0.46, extraBounce: 0 })`。80 毫秒延后仅属于原生动画描述，不是 JS 等待，也不推迟完成写入和刷新请求。
- 小号 SmallDueItem 的原生 VStack 使用来源＋ID＋期次 key 及退出／进入过渡，循环事项下期不会复用上一期身份。中、大号 queue 原生父容器在空状态前后保持同一 key；最后事项的退出与空状态进入不再依赖替换整个未设过渡的列表容器。
- 大号分类使用 recent／action／upcoming 固定身份，原生分类根容器也有过渡，处理最后一行导致整个分类删除的路径；已保留的行仍按准确事项身份保留。
- 只挂载当前数据的一棵交互树，完成代数仅作为动画 value，不用作整树 key。没有已完成事项快照、透明 AppIntent 层、假完成勾选、JS 动画循环、额外时间线或为视觉效果拖延保存。
- 动画 API 缺失、不兼容或构建抛错时，过渡和动画属性均不设置，继续原静态内容与完成操作。数据、216 个符号、热区、完整备注、只读／缓存保护、通知维护和已接受写入流程不变。

主代理读取的官方资料：

- [Scripting Animation and Transition](https://scriptingapp.github.io/guide/View%20Modifiers/Animation%20and%20Transition)：easeIn／easeOut／smooth／delay、opacity、asymmetric、transition.animation 及 value-based animation 的准确签名。
- [Scripting contentTransition](https://scriptingapp.github.io/guide/View%20Modifiers/contentTransition)：同一视图的内容变化与视图插入／删除过渡不同。
- [Scripting ScrollViewReader](https://scriptingapp.github.io/guide/Views/ScrollViewReader)：使用稳定唯一 key 表示视图身份，不使用 SwiftUI `.id()`。
- [Apple WidgetKit animation](https://developer.apple.com/documentation/widgetkit/animating-data-updates-in-widgets-and-live-activities)：时间线数据更新支持原生过渡和动画，但实际执行由系统决定；最长两秒，Always-On 不播放。资料读取并不证明用户安装的宿主按相同方式实现。

## 回归与安装包

Bun 1.3.11 在 Asia/Hong_Kong、UTC、America/New_York 各 550 项／37 文件通过，0 失败。TypeScript 7.0.2 严格检查及 git diff --check 通过；比 3.7.0 新增 10 项结构回归，原有日期、图标尺寸、精准完成、备注、缓存、存储与通知保护测试保留。

- 新测试转译实际 widget_view.tsx 和 DueSymbol／DueSymbolLabel，使用实际日期状态、布局与多语言模块，核对原生视图树，而非只匹配源码文字。动画模拟器精确记录两条 opacity 过渡、曲线、时长和延后；不允许整行 move 或 scale。
- 小号 A→B、同 ID 下期、跨来源同 ID 保持准确原生根身份；中／大号保留行保持原 key 与 Intent，新树不含已完成期次的按钮或文本。每项仅一个真实完成按钮，语义 Label 保留完整矩形热区。
- 各尺寸最后一项之后的空／错误状态均有准确 key／transition，不挂完成按钮；中／大号 empty 是原稳定 queue 的子视图。大号 action 分类消失时 upcoming 身份保留，简中／英文与紧凑 recent 分类均核对。
- 缓存／只读不暴露完成意图；9 组缺少、部分支持或抛错的动画 API 配置在三种尺寸均正常显示，动画／过渡属性不设置，空状态路径也可用。渲染测试禁止存储 I/O、fetch、JS timer 或 interval。

3.7.1 ZIP 通过 unzip -t，解包与源码逐文件一致，只按既有规则排除 README.md／.DS_Store；LICENSE／NOTICE 与仓库根副本逐字节一致。54 个条目、53 个文件，171,095 字节；SHA-256：`52c6b64b35421d868d5dcbf04abe266761d74674b72d1ad8fd4cd3c93db7465a`。远程工作流与固定更新链接仍需发布后单独核验，不能以本机包代替。

## 设备待验收

没有可控制的用户 iPhone。本机测试只能核对实际 TSX 树、身份、动画参数、Intent 目标及降级路径，不能证明逐帧视觉效果、帧率、完成点击到刷新延迟、VoiceOver、着色模式或减少动态效果的实际行为。需观察小号 A→B、循环事项下一期、中号保留行补位、大号分类最后一行、全部完成后的空状态、快速点击、缓存／只读与 API 不支持降级。更新原脚本并运行一次，再请求刷新现有组件；不删除原脚本或重建事项。
