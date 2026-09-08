# v2.7.1 — 品牌显示与图标完成修复

Copyright (c) 2026 MaroonYS. 本文受仓库 LICENSE 约束，第三方图案权利除外。

## 故障定位与实现范围

用户截图是主脚本的手动事项列表。此前该列表只调用系统图标解析，不读取已保存品牌；整行是编辑页导航，没有独立的图标完成按钮。因此已选招商银行仍显示系统图标，图标点击也只进入编辑。

本版让活跃手动行读取当前设置，并将左侧完成按钮与右侧详情导航设为同级控件。明确指定的品牌可在主界面显示，小组件系统模式不隐藏它；此显示不写入或更改设置。自动识别仍受模式和手选系统图标规则约束。已完成、隐藏项继续静态显示，不提供完成操作。

主界面调用既有 `completeManualOccurrence(id, capturedOccurrenceKey)`，校验渲染时的事项版本与周期；保留原存储、快照、完成记录和撤销实现。门闩防止等待刷新时重复提交，旧行再次触发也不能推进新周期。存储失败报告“完成失败”；提交后列表／组件／通知刷新失败报告“事项已完成”及警告，避免引导再次完成。

小号组件原品牌展示采用透明系统图标按钮加背景图片。本版把可见 UIImage 放入 Button 的实际标签，保留原 `CompleteDueItemIntent` 的 source、id、occurrenceKey。点击形状改为文档中的 `rect`；不声称已通过真机实验确认旧背景结构是所有漏点的唯一原因。只读／缓存分支不创建 Intent，系统图标回退继续可用。

接口依据：[Scripting Button](https://scriptingapp.github.io/guide/Views/Button) 支持子视图标签及交互 Intent；[Shape](https://scriptingapp.github.io/guide/Types/Shape) 与 [contentShape](https://scriptingapp.github.io/guide/View%20Modifiers/contentShape) 定义 `rect`、`circle` 形状。[UIImage](https://scriptingapp.github.io/guide/Utilities/UIImage) 的原文件／Base64 加载方式不变。

## 圆形显示与图片核对

- `BrandLogo` 统一用于主界面、编辑预览、目录和小号组件。一般图片 24 pt 圆形，330 个带打包留白图案的内部图片为 28.8 pt；1.2 倍放大仅裁去新增外圈留白，再用圆形遮罩裁去方形四角。
- SafePal 保留 20 pt、原双配色；Telegram 保留 24 pt，二者不额外放大。333 个 PNG、清单及同字节 Base64 均与 v2.7.0 相同，来源与第三方条款不变。
- 圆形遮罩只施加在图片上；Button 和其标签保留 40 pt 矩形区域。标签内有原生 icon-only `Label` 保存完成事项的语义标题，可见图片不在 Button 背景，Button 本身不透明隐藏。真实 VoiceOver 朗读与宿主合并语义仍须真机确认。
- `tools/qa_brand_library.swift` 的 `--circular` 选项使用 ImageIO 解码全部 333 个 PNG，生成六页深浅色参考图；全部 332 个图案已目视核对。
- `tools/qa_brand_controls.swift` 以 macOS SwiftUI 渲染招商银行、Ultra Mobile、Spotify、Telegram、SafePal 的标签／圆形图片／40 pt 点击框几何参考，核对图案、留白和深浅色。
- 以上仅为本机解码和等价布局参考，**不是 iPhone Scripting 或 WidgetKit 的真实截图、触控测试或无障碍验收**。

## 自动化验证

- Bun 1.3.11：299 项测试、16 个文件，Asia/Hong_Kong、UTC、America/New_York 三个时区均 0 失败。
- TypeScript 7.0.2 严格检查与 `git diff --check` 通过。本地验证使用项目宿主类型桩，不能替代 Scripting 的真机 API 验证。
- 新增 7 项实际主列表 TSX 测试：已选招商银行在两种模式显示且无写入；完成和详情是同级控件；完成保留品牌和其他字段；快速点按／旧行重放；外部编辑／删除冲突；主状态／快照写入失败；提交后维护警告；系统选择／坏图回退及非活跃行保护。
- 新增 4 项实际圆形组件 TSX／解析测试：332 图案的尺寸、裁切与原彩；可见图片在矩形语义标签内；四处共用组件；主界面明确选择覆盖显示模式但不改变设置、不绕过只读保护。
- 既有品牌完成按钮测试继续核对精确 Intent 参数、40 pt 区域、只读／缓存无 Intent，以及原标题语义。其余日期、周期、存储、通知、提醒同步、编辑原子保存、图标识别和版权回归全量通过。

## 打包与发布检查

从源码目录重新生成 `.scripting`，仅排除 README.md 与 .DS_Store；检查 ZIP 完整性、解压源码逐文件一致、LICENSE／NOTICE 字节一致及全部品牌文件哈希。
原固定安装链接、`remoteResource` 和发布工作流不变。流水线执行回归测试、严格类型检查、包源码一致性、SHA-256 和指定 main 提交的 GitHub 签名来源证明验证。
发行后独立下载包与 SHA256SUMS，与本地包比较，并校验官方仓库／工作流／main／精确提交的来源证明。

## iPhone 待验收

1. 不删除旧脚本，更新到 2.7.1 并运行主脚本；已有招商银行选择应直接显示。确认事项、模式、周期、通知和记录未被重建。
2. 在可安全完成的测试事项上点主界面左图标，只完成一期；点文字打开同一事项的编辑页。快速点两次、旧编辑页保存与重新打开列表不能跳过后续周期。确认“已完成或隐藏”项没有完成按钮。
3. 小号组件品牌主图标中心和 40 pt 边缘均应可完成同一事项；标题仍打开详情，不打开品牌 App。只读或缓存图标不可完成。
4. 浅色／深色检查招商银行、Ultra Mobile、Spotify、Telegram、SafePal 与其他品牌：外轮廓为圆形，打包的白色外框已裁去；检查桌面着色、透明模式下的真实 WidgetKit 输出。
5. VoiceOver 应读“完成 + 当前事项”，不将图片读成另一可交互控件；验证动态字号、按钮与详情导航没有重叠。
6. 切小组件系统模式：组件回到 SF，主界面明确选定的品牌仍显示。改为固定系统图标后两处正确回退，图片加载失败也不留下空白完成按钮。
7. 确认底部预告、中大号、锁屏、原详情跳转和周期规则未变化；误触完成可从记录与数据安全撤销。
