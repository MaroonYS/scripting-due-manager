# 到期管家 v3.3.0

Icons8 Windows 11 Color 图库正式接入事项选图，并补充银行与更多 App 品牌来源。

- 编辑事项 → 图标 →「Icons8 · Windows 11 彩色图库」连接免费账号，搜索并选图，再返回事项页保存；Apple 提醒事项也可单独设置。Earth Smiley 所属的 `fluency` 风格始终固定，不混入其他风格。图库首页仅预览，不自动修改事项。
- 使用 Icons8 官方 MCP、本机回调及 PKCE；授权后点网页左上角 × 返回，不是底部返回箭头。需要支持 HttpServer 的 Scripting Pro。凭据仅在本机钥匙串，不同步、不进入备份，支持检查连接、续期和清除；旧 REST API Key 独立保留。
- 已选 96 px PNG 可由主界面和小中大桌面组件按需显示，不在组件内发起登录。图案保留 Icons8 署名，网络失败回退系统符号；旧内置图案、SF Symbols、事项、周期、通知与固定更新地址不变。
- GitHub 新增 Bank Logos（417 张通过格式检查的银行／机构方形与横版，含历史标志）、Simple Icons（单色品牌）和 Dashboard Icons，连同 App、Emby、selfh.st 共六个预设。升级用户可在订阅管理页「补回缺少的预设图库」，原自定义订阅与开关不会被覆盖。
- 英国、美国、大陆、香港及 U 卡使用本机品牌词表搜索，不是业务地域或产品推荐。已核对 HSBC、渣打、招商、恒生、Monzo、Revolut、Chase 等。U 卡仍有明显缺项，当前仅确认 Bybit；RedotPay、Wirex、Nexo 等没有用无关品牌或币种图案填补。
- 选图仍须保存事项，取消不生效。含 `icons8-mcp:` 选择的备份需 3.3+ 恢复；密码、授权码和令牌不会进入安装包、仓库或 JSON 备份。

393 项测试在香港、UTC、纽约三时区通过，严格类型检查通过；417 个上游银行 SVG 全部通过真实下载与安全解析。用户此前的 TestFlight 3.3.0 + Pro 诊断已验证实验脚本的基础登录、搜索和 PNG 显示；本版正式集成、令牌续期及 iPhone／WidgetKit 原生效果仍需真机验收。

新图库只引用公开清单和原图，不将整库图片打包。Icons8、IconGo、Simple Icons、homarr-labs、sooyaaabo、selfh.st 及各品牌保留相应权利；署名及适用许可随包保留，见 NOTICE。

[操作与覆盖说明](https://github.com/MaroonYS/scripting-due-manager/blob/v3.3.0/docs/GITHUB-ICON-SOURCES.md) · [QA 与真机验收边界](https://github.com/MaroonYS/scripting-due-manager/blob/v3.3.0/docs/QA-v3.3.0.md)
