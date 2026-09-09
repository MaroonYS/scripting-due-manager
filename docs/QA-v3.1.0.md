# v3.1.0 — 双在线图库、名称推荐与自适配

Copyright (c) 2026 MaroonYS. 本文受仓库 LICENSE 约束；第三方图案保留其自身权利。

## 实现范围

- Fluent Emoji Flat 通过 Iconify `/search` 在线搜索，固定 `prefix=fluent-emoji-flat`；Icons8 使用其正式 v5 Search API，默认不限制风格，不把旧 829 枚本地目录当作在线结果。每页显示 24 项，支持翻页、重新搜索、换图库和 Icons8 常用风格。
- 从手动事项及 Apple 提醒事项图标页进入后，按本机识别到的品牌／类别词自动搜索推荐。整条事项名称、日期、金额及备注不自动上传；无法识别品牌时推荐通用图案，用户也能手动改词。推荐不自动替换选择。图库导航目标即使被原生界面提前构造，也须等到 `onAppear` 才联网。
- 手动事项与选图继续原子保存；取消不落盘，失败不关闭。提醒事项只保存本地外观，不修改 EventKit。原有事项、周期、完成与通知逻辑不变。重复点按选图不会重复回退导航。
- 新选择以 `fluent-emoji-flat:name` / `icons8-online:ID` 形式持久保存；不接受任意 URL、路径、其他 Iconify 集合、控制字符或超长 ID。原 `icons8-...`、`sf:...` 和合法未来旧 ID 保留兼容。
- 原 3.0 的 829 份 Icons8 PNG／离线 JSON 未修改或删除，继续服务已选的离线图案。在线图库与旧内置图案使用不同来源标识，不在失败时悄悄换成别的品牌。

## 网络、凭证与资源边界

- Icons8 按正式接口约定要求用户自己的 API Key。`SecureField` 遮挡输入；凭证只写当前脚本的系统钥匙串，`synchronizable=false`、`first_unlock_this_device`，不写 Storage、脚本文件、备份、源代码或包体。保存后清空输入；无钥匙串支持时提示升级，不降级成明文保存。
- 密钥只放 `Api-Key` 请求头，绝不放 URL。图标服务请求禁止重定向，原始网络／服务器错误不回显，避免错误文本带出密钥。
- 搜索请求原生超时 8 秒、整体上限 8.5 秒；新在线图片 4 秒。搜索及 SVG 内容检查长度、结构与标识；SVG 拒绝脚本、外部图片／引用、CSS、事件属性等，只保留支持的绘图元素。将根 SVG 的 `em` 栅格尺寸规范为三倍 viewBox 尺寸，图形路径及原色不变。
- 预览每页 24 项，四路并发并逐张显示；离页／换词不继续启动旧页后续图片，迟到数据不更新当前界面。共享在途上限 64。Icons8 API 的完成结果不进入成功缓存、不落盘，每次新显示实时取图；Fluent 与旧内置图案共享最多 64 项的会话缓存。
- 组件只预取小号最多 2 项、中／大号当前容量内的图案，外层仍为 1.6 秒。已成功的部分图片可进入本次渲染，迟到结果不进入该时间线；在线图像仅通过临时展示数据传给组件，不写回事项、提醒缓存或备份。锁屏附件不取图。
- 图案自适配指按槽位尺寸等比缩放、按比例留白、切换深浅色背景；不声称进行了逐像素透明边界或颜色亮度分析。保持完整形状，不裁圆、不重绘。网络／权限／额度／内容失败时回退 SF Symbols，完成按钮仍保留原事项、来源、周期、只读和缓存保护。

## 已验证

- Bun 1.3.11：349 项测试、19 个测试文件，在 `Asia/Hong_Kong`、`UTC`、`America/New_York` 分别通过，零失败。
- TypeScript 7.0.2 严格检查通过；`git diff --check` 通过。类型校验使用仓库的宿主声明替身，不等同于真正 Scripting SDK 编译或原生运行。
- 在线适配测试涵盖 ID 校验、来源边界、翻页、权限／额度／坏响应、无密钥不发请求、错误脱敏、SVG 内容限制、挂起／迟到响应、四路渐进预览、离页取消后续队列、Fluent 会话缓存、Icons8 无成功缓存、钥匙串不可用／失败及备份兼容。
- 实际 TSX 测试涵盖可见后再搜索、手工输入不逐字上传、切换词／图库／分页、旧结果隔离、无图片不可保存、单次选图退出、按名称推荐、密钥遮挡与清空、原色／比例／深浅色背景、组件只读与周期保护。
- 2026-09-09 从真实 Iconify API 搜索 `robot`、`speech`、`artist`、`musical`、`high-voltage`、`house`、`movie`、`cloud`，8 组均返回对应集合结果，首个 SVG 均通过当前安全解析与根尺寸规范化。另核对 `clock` 搜索及 `alarm-clock.svg`。这只是抽样，不代表全库逐图或 iPhone 显示验收。
- Icons8 官方开发文档及页面所提供的规范确认了 `https://search.icons8.com/api/iconsets/v5/search` 与 `https://api-img.icons8.com/`，均支持 `Api-Key` 头。一次未带密钥的搜索探测返回带过期兼容警告的结果，不能据此把匿名访问视作稳定受支持功能。Renderer 的无密钥 HEAD 探测返回 401；没有借用网页中的令牌、绕过认证或关闭 TLS 校验。
- 本轮没有用户 Icons8 API Key，认证成功路径仅由模拟接口测试覆盖；真实认证搜索、账户额度和取图仍未验收。
- 3.1.0 包体 ZIP 检查、解压后逐文件源码比对、根目录与随包 LICENSE／NOTICE 一致性通过。安装包为 6,165,632 字节，SHA-256：`3283326f8f83866e116922e33807c20a5a932efa7abde0607ffba2661683da47`。正式发行仍由官方工作流执行测试、比对和来源证明核验。

## 仍需 iPhone 验收

1. 更新原脚本，核对原有事项与图标保留；不要先删除脚本。分别为两条事项选择 Fluent、Icons8／SF Symbols，测试取消和保存不互相影响。
2. Fluent 真实搜索、中文名称生成的推荐词、搜索翻页、弱网重试；未申请 Icons8 Key 时应出现明确说明。拥有适用 Key 后在脚本安全输入，再验收搜索／取图、失效密钥、额度错误和移除凭证。
3. Scripting 原生 SVG、UIImage、SecureField、Keychain 和 LazyVGrid 的真实可用性、布局与性能。尤其检查浅色／深色、大字号、VoiceOver、长名称、键盘及 12／24／30／32 pt 图案比例。
4. 主列表、小中大号 Widget、摘要、下一事项预告、iOS 着色模式；图片中心和热区边缘的完成操作、文字详情跳转、快速连点、旧周期／只读／缓存保护。
5. 离线时旧内置图案／系统符号仍显示；新在线图案可以回退，不保证离线图案或即时刷新。WidgetKit 调度与系统钥匙串权限由 iOS 决定。

## 依据

- [Iconify Search API](https://iconify.design/docs/api/search.html)、[Iconify 图标数据与缓存](https://iconify.design/docs/api/icon-data.html)、[Microsoft Fluent Emoji 许可](https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE)。
- [Icons8 Search API](https://developers.icons8.com/docs/searchIcons)、[Renderer API](https://developers.icons8.com/docs/renderer)、[实时渲染与禁止本地缓存的说明](https://intercom.help/icons8-7fb7577e8170/en/articles/8204671-rendering-icons-with-icons8-api)。原网站下载素材的授权不自动等同于 API 缓存许可。
- Scripting [SVG](https://scriptingapp.github.io/zh/guide/Views/SVG)、[UIImage](https://scriptingapp.github.io/guide/Utilities/UIImage)、[Keychain](https://scriptingapp.github.io/guide/Device%20Capabilities/Keychain)、[SecureField](https://scriptingapp.github.io/guide/Views/Text%20input/SecureField/)、[fetch](https://scriptingapp.github.io/guide/Utilities/Request/fetch) 与 [Response](https://scriptingapp.github.io/guide/Utilities/Request/Response)。
