# 到期管家 v3.8.0 布局验证记录

日期：2026-11-14。以用户提供的 iPhone Duo 桌面图和 Apple Calendar 为设计参考，不把截图像素换算成 WidgetKit 点数。桌面上的小号详情/预告重叠，与代码无高度判断、固定高度和相向负内边距相符；中、大号标题过早换行，与固定 116/124 pt 右栏相符。这不是对某个 iOS 版本缺陷的判定。

## 依据与边界

- [Apple iPhone Duo 准备指南](https://developer.apple.com/iphone-duo/prepare/) 与 [设计指南](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo)：内容根据容器的可用空间排版，不按机型、屏幕分辨率和设备姿态硬编码。参考日历的日期、星期与分组层级，保留组件内的已有操作。
- [Scripting Widget API](https://scriptingapp.github.io/guide/Widget/Widget%20API) 和 [iOS 27 组件文档](https://scriptingapp.github.io/guide/Changelog/3.2.1/System%20Shortcut%20Widget%20Buttons%20%28iOS%2027%2B%29)：`Widget.displaySize` 提供点数宽高；Scripting 提供 `systemExtraLargePortrait` 时才进入竖向议程布局。文档的 300×628 pt 是竖向超大应用内模拟预览尺寸，非 Duo 实测尺寸。
- 用原生 VStack/HStack、语义颜色和宿主 Widget 背景。没有使用私有 Calendar 或 SwiftUI 接口，没有更换宿主或扩展签名；未承诺读取、修改系统默认边距。未改提醒事项读取范围、保存、通知、时间线或刷新请求；保留 216 个符号、期次校验、独立备注链接与完成按钮，及原生过渡降级机制。

## 结构与适配

- 小号将页头、主标题、详情、预告分成非负高度区间，计划器一起核算边距与间距。长标题按空间争取第三行，当前详情优先于预告；预告不重复渲染时间。无足够空间时主动缩减可选信息。
- 中、大、竖向超大号统一预算日期栏、实际可见事项、分组、间距和同步提示。标题占主栏；右栏日期和时间分开，较窄时整体移到标题下方。金额、列表名与备注摘要空间不足时可省略，详情仍有准确入口。
- 合成例：141×141 pt 小号内区 119 pt，普通标题的页头、主行、详情、预告加三处间距合计 114 pt；长标题可用第三行并隐藏预告。364×170 pt 中号的标题预算示例从 174 pt 到 201 pt，364×382 pt 大号从 164 pt 到 197 pt。300×628 pt 竖向超大可按预算放 9 项。上述均不是 Duo 真机布局测量。

## 验证范围

- Bun 1.3.11 在 Asia/Shanghai、UTC 和 America/New_York 各通过 560 项／38 文件。TypeScript 7.0.2 严格检查及 `git diff --check` 通过。渲染结构检查覆盖混合文字、压缩时独立的日期/时间、预告让位、竖向超大、空状态、缓存/只读、准确备注链接及单一期次按钮。
- 安装包完整性通过，解包与源码逐文件一致（忽略 README 和 .DS_Store），版权文件与仓库根副本逐字节一致。54 个条目、53 个文件；171,314 字节；SHA-256 `6bf016f0824e99c50143e7ca792fb34bae926e2f39bad924d307ada90edc4845`。
- 本机工具链为 Xcode 27.2（27B52），本机现有模拟器运行时 iOS 27.0，无 Duo 模拟器。TypeScript/TSX 自动化提取渲染结构和预算，不能证明 SwiftUI 宿主的字体排版、实际触控或系统着色结果。
- iPhone Use 复用了已配置服务尝试启动，未找到目标 USB 设备；发现的手机是另一台机型。用户当时无法接入 Duo，未读取、替换或操作任何手机上的脚本及事项。后续应在 Duo 内外屏核对小号长中英混合标题、同一事项时间与下一项预告，及中、大、超大号的整体对齐、系统着色、备注链接和完成响应。
