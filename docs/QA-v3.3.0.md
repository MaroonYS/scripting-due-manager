# v3.3.0 — Icons8 MCP 与金融品牌图库

Copyright (c) 2026 MaroonYS. 本文受仓库 LICENSE 约束；第三方图案保留自身权利。

## 本版实现

- Icons8 免费账号入口通过官方 MCP 搜索，固定 `platform: fluency`，对应 Windows 11 Color 和 Earth Smiley。参数即使是可选项也始终传入；不按搜索结果动态放宽风格。24 项分页，返回值只提取合法 ID、名称和允许的风格，去重并排除动画／外部结果。
- 主图库的浏览入口不修改事项；手动事项及 Apple 提醒事项编辑页均有直接选用入口。已加载图案才能选中；选中只暂存，返回编辑页保存才生效。原 130 个 SF Symbols、829 张内置 PNG／JSON、事项、周期、通知及完成操作保护没有替换。
- OAuth 使用本机 IPv4 回环地址、动态端口、PKCE S256、随机状态及官方固定服务地址。先校验发现元数据与客户端注册结果，再接收带正确 Host、路径、GET 方法和唯一 state/code 的回调。授权页面明确提示点左上角 × 返回，不是底部返回箭头。
- 网络步骤有 20 秒硬期限、原生取消及禁重定向；授权等待上限五分钟。JSON／SSE 正文有大小及分块边界，SSE 匹配请求编号，分块合并保留 UTF-8。界面离开会取消未完成登录；密码只在官方网页输入，错误和连接记录不回显原始服务报错或凭据。
- 登录存入当前脚本、本机且不同步的 Keychain。保存、续期与退出有状态代次和原值校验，旧请求不能覆盖较新账号或退出结果。MCP 读操作、验证和手动续期串行化；过期前续期，401 最多续期并重试一次。清除 MCP 登录不改变旧 REST API Key。
- 新选择仅保存 `icons8-mcp:` 图案 ID。公开 96 px PNG 显示不读登录、不访问 MCP；350 KB 体积、PNG 头与 192 px 尺寸边界在解码前检查。进入原有每页 24 项、四路加载、64 项会话缓存；不写磁盘。小组件仍只预读可见项，并遵守原有 1.6 秒渲染等待上限与系统符号回退；锁屏不新增彩色图案。
- GitHub 预设由三个增加至六个，补入 Bank Logos、Simple Icons（单色）、Dashboard Icons。旧用户保存过的订阅数组、启停状态和自定义源不会被自动覆盖，可在管理页补回缺少预设。
- Bank Logos 清单由公开上游提交生成，只包含图像链接与搜索元数据。`logos/` 的 424 张中排除 7 张不受支持的横版，保留 417 张；不扩大 SVG 安全子集。原 SVG 绘图不变，显示栅格最长边统一限制为 192 px，保留原 viewBox 比例。
- Simple Icons 使用官方 `data/simple-icons.json`、显式 slug 及 CC0 slug 转换规则，生成同仓库同引用下的 SVG 地址，不访问任意 source 链接。支持带下划线的官方别名文件。中文金融别名及地区仅用于本机搜索，明确区分单色与彩色图案。
- 已知金融品牌的精确搜索避免把 NEXON 当 Nexo、Proxmox 当 Mox、枣庄银行当 ZA Bank；缺图保持空结果。地区和 U 卡标签不是业务资格、产品推荐或全覆盖声明。

## 自动化与真实网络验证

- 393 项自动化测试，在 `Asia/Hong_Kong`、`UTC`、`America/New_York` 分别通过（约 3.20 / 3.19 / 3.17 秒）；TypeScript 7.0.2 严格检查与 `git diff --check` 通过。
- 18 项 MCP 专项测试覆盖协议、PKCE／回调、本机原生接口替身、取消、钥匙串失败和并发状态校验、401 续期重试、SSE、真实大小／尺寸边界、备份不含凭据，以及共享图片加载／缓存。它们是模拟宿主与网络的自动化测试，不是已在 iPhone 上运行新正式版本。
- UI 回归覆盖 MCP 专用入口、Earth Smiley 初始查询、加载后选用、暂存至保存及原选择不变；原列表、提醒事项、备份、周期、通知与 WidgetKit 动作参数测试全部保留。
- 2026-09-09 六个清单可解析条目如下；是条目数，含变体和跨库重复，不能相加当成独立 App 数量：

| 来源 | 可解析条目 | 备注 |
| --- | ---: | --- |
| 恩秀 App | 373 | 上游公开清单 |
| 恩秀 Emby | 699 | 含服务变体 |
| selfh.st | 2893 | 应用和自托管服务 |
| Bank Logos | 417 | 212 个原文件标识的方形／横版；7 个横版排除 |
| Simple Icons | 3459 | 单色品牌 |
| Dashboard Icons | 3237 | 跳过 1 个不符合路径格式的条目 |

- 使用正常 HTTPS 校验的 curl 读取真实上游；没有关闭 TLS 验证。发布前银行清单使用本地生成的同字节 JSON，其 417 个上游 SVG 均真实下载并通过安全解析，其余清单来自真实 URL。18 组应用、银行及地区成功搜索，24 个不同 PNG／SVG 响应体和安全格式检查通过；其中 Bybit 来自恩秀 App，其 PNG 为 16275 字节。本机不运行 iOS UIImage／SVG／WidgetKit。
- 可复验命令：发布前 `bun tools/smoke_github_artwork.ts --local-bank --all-bank-images`；发布后去掉 `--local-bank` 直接核验正式 Raw 清单。脚本只读，不把新图像下载保存到包内。
- 精确覆盖核验：HSBC、渣打、招商、恒生、Monzo、Revolut、Chase 有结果；U 卡相关当前仅确认 Bybit。RedotPay、Wirex、Nexo、Crypto.com、ZA Bank、Mox、livi 在这六个预设中未查到对应图案。不是全网缺失判定，也不以错误近似名称填补。

## 本地发行包校验

源码／解包目录逐文件比对、ZIP 完整性以及根目录与包内 LICENSE／NOTICE 字节比对通过。安装包为 6295697 字节，SHA-256：`1c84d464c85f2eb35da437554e93b6c0a30905c7753fba2bd6c6e8235a6178f9`。公开发行还须经过官方工作流的回归、包体与来源证明检查；最终以 Release 附带的校验文件及 attestation 为准。

## 用户已有诊断与正式版待验收

用户提供的《Icons8连接诊断.txt》报告：在 Scripting TestFlight 3.3.0 + Pro，实验脚本的登录、MCP 初始化、搜索及四张 PNG 显示通过；报告没有验证令牌续期。该报告是基础流程的可行性证据，不等同于本版正式集成、固定风格或 WidgetKit 的真机验收。

请更新原脚本，不删除已有数据，然后验证：

1. 在手动事项图标页连接免费账号；收到授权后关闭左上角 ×，账号页继续完成验证。实验脚本的临时登录不会自动迁移。随后搜索并选用 Earth Smiley，保存后主列表及桌面组件显示同一图案。
2. 取消选图不保存；给 Apple 提醒事项选图仅改变到期管家外观，不修改系统名称、备注或到期日。旧内置图片和 SF Symbols 仍能使用。
3. 查看账号页「验证登录续期」、退出、重新登录；检查权限拒绝、断网、超时、应用切后台、授权后返回及取消时的提示。不要把账号密码或令牌发到聊天。
4. 升级用户补回新增 GitHub 预设；检查中文金融词、英国／美国／大陆／香港、具体 U 卡品牌、空结果、翻页、部分源失败与弱网。无对应图案时保留原事项选择。
5. 检查真实 iOS PNG 解码、SVG 渲染、小中大桌面组件、深浅色、长名称、动态字体、VoiceOver、40／38 pt 完成热区和 WidgetKit 刷新。超时后应可用系统符号操作，不保证立即显示远程图片。
6. JSON 备份只有图案标识和订阅设置，没有登录凭据；MCP 新选择需 3.3+ 恢复。跨设备需重新登录；不建议降级后保存数据。

## 依据

- [Icons8 MCP 官方项目](https://github.com/icons8/icons8-mcp)、[免费 PNG 与署名](https://icons8.com/mcp/)、[Earth Smiley 原图](https://icons8.com/icon/9GC5rqCM5uDh/earth-smiley)。
- [Bank Logos](https://github.com/icongo/bank-logos)、[Simple Icons](https://github.com/simple-icons/simple-icons)、[Dashboard Icons](https://github.com/homarr-labs/dashboard-icons)。
- [操作与覆盖说明](./GITHUB-ICON-SOURCES.md)、原有 [3.2 QA](./QA-v3.2.0.md)。
