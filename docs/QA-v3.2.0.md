# v3.2.0 — GitHub 图库订阅与自定义源

Copyright (c) 2026 MaroonYS. 本文受仓库 LICENSE 约束；第三方图案保留其自身权利。

## 实现与兼容边界

- 预设恩秀 App、恩秀 Emby、selfh.st 三个公开清单，无 API Key。合并已启用源，在本机按名称和已知品牌别名搜索，24 项分页；空词浏览全部。同名不同图案保留，同一图片地址去重。不把 GitHub 搜索描述成全站搜索接口，不自动上传查询词或事项内容。
- GitHub 为普通图库入口及识别到应用品牌时的默认来源。无法识别品牌的通用事项保留 Fluent 类别推荐；Icons8 为需用户自行配置 Key 的可选风格补充。所有推荐仅给候选，不自动改动原选择。
- 自定义源支持 `icons: [{name, url}]`，以及 selfh.st／Dashboard Icons 官方索引。仅接受 GitHub Raw、文件页或 jsDelivr GitHub 链接，规范为 Raw；拒绝认证信息、端口、查询参数、片段、目录穿越、双重编码、控制字符、陌生主机及非 JSON／PNG／SVG 文件。jsDelivr 未指定引用时规范为 HEAD，不保留独立 CDN 传输线路。
- 最多 12 个订阅，每源最多 10000 项、清单正文最多 2000000 字符并检查声明长度；最多三个源并发，单源 8.5 秒期限及最多 12 个在途请求。清单会话缓存 15 分钟，支持手动刷新，更新失败时仅在已有成功缓存的情况下回退并明确提示。部分来源失败保留成功结果，全部失败、全部禁用有独立错误信息。
- 管理页验证成功且含可用图案后才添加，防重复点击；离页并重新进入也不会提交旧访问发起的验证。保存失败保留输入和原设置。启停、移除及补回预设采用订阅级比较检查，合并无关设置／事项更新；旧设置进入原有快照流程。
- 新图标以 `github-artwork:` 加编码后的、严格验证的公开图片地址保存，独立于可变清单的数组顺序和订阅是否启用。标识与订阅设置随备份保留，移除源不移除事项选择。合法旧内置、Fluent、Icons8、SF 标识兼容；新 GitHub 选择需 3.2 或更新版本恢复。
- PNG 请求 4 秒期限、2 MB 声明长度及真实 Data.size 检查；先检查 PNG 签名、IHDR 和不超过 2048×2048 的尺寸再解码。大图使用原生 preparingThumbnail 生成最长边不超过 192 px 的显示副本，另保留原始比例数据；不裁图、不改上游文件。缺少所需原生方法或解码失败时回退系统图标。
- SVG 沿用受限的绘图解析，不允许脚本、事件、外部图片／引用、CSS 等；并不保证任意 GitHub SVG 都能显示。预览和桌面组件继续使用原色、完整形状、自适配留白与背景。GitHub 轻量图片与 Fluent／旧内置共用最多 64 项会话缓存；Icons8 仍无成功缓存、不落盘。
- 页面／行出现后才联网，迟到结果隔离；图片四路渐进加载，每页最多 24 项。小组件只加载本次可见项，继续使用原有 1.6 秒渲染等待上限及系统符号回退；锁屏附件不新增图片请求。事项、周期、通知、完成保护及固定安装／更新 URL 不变。
- 旧 829 PNG／独立 JSON 文件没有增删或修改。新图案只引用公开链接，不将上游整库图片加入安装包；作者、CC BY 4.0 与其他适用授权说明位于图库页、管理页、版权页及 NOTICE。

## 已完成自动化验证

- Bun 1.3.11：369 项测试、20 个测试文件，在 Asia/Hong_Kong、UTC、America/New_York 全部通过；本轮对应运行约 3.38、3.14、3.16 秒。
- TypeScript 7.0.2 严格校验通过；使用仓库宿主声明替身，不等同于真正 Scripting SDK 编译。`git diff --check` 及根目录／随包 NOTICE 一致性检查通过。
- 安装包 ZIP 检查、解压后逐文件源码比对（不含 README／系统元数据）与随包 LICENSE／NOTICE 比对通过。包体 6,264,655 字节，SHA-256：`02f8126ee82b6031f7f419f837667a0794b49c48388390a0212e607fc9bfbdee`。正式发行仍由官方工作流执行测试、比对和签名来源证明核验。
- 新增 14 项核心测试覆盖地址、标识、来源边界、恶意清单、中文已知品牌别名、去重分页、部分失败、缓存过期／刷新、共享请求、超时迟到隔离、并发／取消、PNG 检查与缩略图、安全 SVG、会话缓存和备份／并发写入保护。
- 原 TSX 交互测试更新至 GitHub 默认，并新增 6 项：空词浏览／部分来源提示、通用事项保留 Fluent、管理页先验证后保存、防连点、失败保留输入、离页取消、非法／重复 URL 不联网、启停／移除／补回来源。原有选图保存、单次退出、旧请求隔离、Icons8 密钥处理和组件动作保护仍通过。
- 新增只读网络抽样命令：`bun tools/smoke_github_artwork.ts`。使用 curl 的正常主机信任库及 HTTPS 校验，没有关闭 TLS 验证。当前机器 Bun 直接 fetch GitHub 报证书链错误，因此不将本次 curl 结果视为用户 iPhone 网络环境已验证。

## 真实网络抽样（2026-09-09）

| 源 | 可解析图案条目 | 跳过项 |
| --- | ---: | ---: |
| 恩秀 App | 373 | 0 |
| 恩秀 Emby | 699 | 0 |
| selfh.st | 2893 | 0 |

这些是本次清单条目数，含变体，不代表同等数量独立应用，也不保证未来不变。

真实合并搜索 ChatGPT Plus、微信、Netflix、Spotify、Apple Music、iCloud、Emby 均有结果，当前首屏分别为 3、2、4、5、1、2、20 项。检查每个源首项及搜索首项，共 10 张不同 PNG 的真实响应体与安全头信息通过；未对全库图片逐张解码，也未运行 iOS UIImage。原有 Fluent／Icons8 本轮保留接口行为；Icons8 没有用户真实 Key，认证成功路径仍只由模拟接口覆盖。

## iPhone 待验收

1. 更新原脚本，确认事项、原图、SF Symbols 与备份仍在；不要删除脚本或重建事项。
2. GitHub 空词浏览、中文／英文搜索、翻页、弱网、刷新清单，分别启停三个源；自定义清单验证成功／失败、重复添加、添加途中返回及重新进入。
3. 给手动事项和 Apple 提醒事项分别选图，取消不保存，保存仅改该项。移除其来源后，地址有效时仍能显示，地址失效时可回退系统符号。
4. Scripting 原生 Data.slice／toUint8Array（或旧 getBytes）、UIImage.preparingThumbnail、SVG 及 LazyVGrid 的实际支持；检查原比例、长标签、深浅色、动态字号、VoiceOver 和 40／38 pt 完成热区。
5. 小中大号、摘要、下一项预告及 WidgetKit 刷新／着色／内存表现；1.6 秒内未取得图片时应保持可操作的系统符号。没有承诺即时刷新或离线图片可用。
6. 如需 Icons8，使用者在脚本内配置自己的 Key 后验收真实搜索、取图、失效与额度路径，不将密钥发到聊天或提交仓库。

## 依据

- [sooyaaabo/IconLibrary](https://github.com/sooyaaabo/IconLibrary)、[selfh.st/icons](https://github.com/selfhst/icons)、[Dashboard Icons](https://github.com/homarr-labs/dashboard-icons)。
- Scripting [Data](https://scriptingapp.github.io/guide/Utilities/Data)、[UIImage](https://scriptingapp.github.io/guide/Utilities/UIImage)、[Response](https://scriptingapp.github.io/guide/Utilities/Request/Response)。
- [用户操作说明](./GITHUB-ICON-SOURCES.md)、[前版在线库验证范围](./QA-v3.1.0.md)。
