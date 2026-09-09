# GitHub 与 Icons8 图库（更新至 3.3）

Copyright (c) 2026 MaroonYS. 本文受仓库 LICENSE 约束；第三方图案保留自身权利。

## 使用入口

打开「图标与外观 → 图标图库与逐项设置 → 在线图库」，选择「GitHub 订阅」。从事项编辑页进入也可以选图；选中的图案仍须在事项编辑页保存后生效，不会自动替换已有选择。

- GitHub：应用、品牌、媒体服务图标，新安装默认启用下表六个源，无需 API Key。升级后已有订阅配置不会被自动改动，请到管理页点「补回缺少的预设图库」。
- Fluent Emoji Flat：房租、证件、保修等通用事项图案，无需密钥。
- Icons8 免费账号：官方 MCP 的 Windows 11 Color（`fluency`），即 Earth Smiley 所属图库；单独连接账号，不进入 GitHub 搜索。
- Icons8 REST API：原有独立 Key 入口，供已有 API 权限的用户使用；与 MCP 登录不是同一凭据。

| 预设 | 清单 | 用途 |
| --- | --- | --- |
| 恩秀 App | [App-Icon.json](https://raw.githubusercontent.com/sooyaaabo/IconLibrary/main/App-Icon.json) | 国内外应用图案与部分变体 |
| 恩秀 Emby | [Emby-Icon.json](https://raw.githubusercontent.com/sooyaaabo/IconLibrary/main/Emby-Icon.json) | 媒体服务与 Emby 社区图标 |
| selfh.st | [index.json](https://raw.githubusercontent.com/selfhst/icons/main/index.json) | 订阅服务、应用与自托管工具 |
| Bank Logos | [bank-logos.json](https://raw.githubusercontent.com/MaroonYS/scripting-due-manager/main/catalogs/bank-logos.json) | 基于 IconGo 原图的 417 张银行／机构方形与横版，含历史标志 |
| Simple Icons | [simple-icons.json](https://raw.githubusercontent.com/simple-icons/simple-icons/develop/data/simple-icons.json) | 单色品牌标志；可补英美金融品牌，并非彩色 App 图标 |
| Dashboard Icons | [metadata.json](https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/metadata.json) | 更多应用、自托管与服务图案 |

## 在事项中使用 Icons8

编辑手动事项 →「图标」→「Icons8 · Windows 11 彩色图库」。Apple 提醒事项则从图库的事项列表进入本地图标编辑页，选择相同入口。

首次点「连接 Icons8 免费账号」，在官方网页授权；出现「已收到 Icons8 授权」后点网页**左上角 ×**，不要点底部返回箭头。返回账号页后会继续验证并保存；实验脚本里临时保存的账号不会迁移。登录依赖 Scripting Pro 的 HttpServer，本机回调只监听 `127.0.0.1`；基础流程已有 TestFlight 3.3.0 + Pro 用户诊断通过，新正式集成仍需 iPhone 验收。

回到图库搜索 `earth smiley`，或使用银行、信用卡等快捷词；始终限定 Windows 11 Color，每页 24 个。选中已加载的图案后，返回事项编辑页点「保存」才生效。取消不改动原图，图库首页的单独浏览不会替换任何事项。若该风格没有目标品牌，可以切换 GitHub；不混用其他风格冒充结果。

账号页支持检查连接、验证续期和清除本机登录。凭据仅在本机钥匙串，不同步、不进入备份；不要把密码、授权码或令牌发到聊天。已选图案使用公开 96 px PNG 显示，主界面和小中大组件不必再次登录；网络失败回退系统图标，不保证离线显示。Icons8 免费 PNG 保留出处链接，未请求付费 SVG。

## 金融图库的覆盖边界

可点「金融／英国／美国／大陆／香港／U卡」在本机查找；名称与地区是公开词表，不是产品资格或可用地域推荐。2026-09-09 实查有 HSBC、渣打、招商、恒生、Monzo、Revolut、Chase 等；英国和美国的补充来自 Simple Icons 等源，内地与香港传统银行以 Bank Logos 为主。

U 卡和香港数字银行覆盖仍不齐：当前六个预设中确认有 Bybit；本轮精确搜索未找到 RedotPay、Wirex、Nexo、Crypto.com、ZA Bank、Mox、livi 的对应标志。搜索识别到这些品牌时不会用 NEXON、Proxmox、枣庄银行等近似名称填补，也不会拿币种图标代替 App。上述缺项仅指本次预设检查，不代表全网或 Icons8 一定没有，未来上游可能更新。

Bank Logos 原仓库的 `logos/` 有 212 个文件标识、424 张方形／横版；本索引排除 7 张超出安全 SVG 子集的横版，保留 417 张，方形版本均保留。目录中的机构或图案可能是历史版本，不保证是最新官方 App 图标。更新索引使用 `tools/build_bank_icon_catalog.ts`；它只输出可审查 JSON，不修改或下载保存原图。

在线更新清单，在本机搜索其名称／已知品牌别名，再按需加载图片。这不是 GitHub 全站搜索 API。搜索词不发送到 GitHub；GitHub 仍会收到清单和被查看图片的普通请求。中文别名不是通用翻译服务：无法识别的名称可尝试英文或原清单中的命名。

每页 24 个图案，留空搜索可浏览全部。相同图片地址去重，同名的不同图案保留供选择。单个源无法访问时显示提示，其余源仍可用；若全部源失败或被关闭，会明确提示原因。

## 添加自己的清单

在「管理 GitHub 图库订阅」填写名称和 JSON 链接，点击「验证并添加」。读取成功且含可用图案后才保存；失败会保留输入和旧设置，退出页面则取消这次添加。最多保存 12 个订阅。

通用清单格式示例：

```json
{
  "name": "示例图库",
  "icons": [
    {
      "name": "AList",
      "url": "https://raw.githubusercontent.com/sooyaaabo/IconLibrary/main/Emby/AList.png"
    }
  ]
}
```

`icons` 数组及每项 `name`、`url` 必需，顶层名称／描述不作为代码执行。支持 `aliases` 字符串作为额外搜索词；已知金融品牌可用 `brand` 字段明确归类。也能识别 selfh.st、Dashboard Icons 的官方索引，转换为同仓库、同引用下的 PNG 地址；Simple Icons 的官方 `data/simple-icons.json` 按其 slug 规则转换为同引用下的 `icons/*.svg`，不请求数据中任意 `source` 地址。

仅接受 HTTPS 的 GitHub Raw、GitHub 文件页及 jsDelivr GitHub 链接，统一规范成 GitHub Raw 地址。jsDelivr 未指定引用时使用 `HEAD`；如果你的网络无法访问 Raw，这一版不会保留 jsDelivr 作为独立传输线路。只支持公开 PNG／安全 SVG；带用户名／密码、查询参数、片段、本地路径、私人服务器、脚本或其他文件类型的地址会被拒绝。

## 更新、移除与备份

清单在当前会话缓存 15 分钟；「立即更新清单并搜索」可重新拉取。刷新失败但本次会话已有成功清单时，会说明正在使用上次的清单。图片只按可见页加载，PNG 校验真实字节大小、签名和像素尺寸后使用轻量缩略图；SVG 使用受限的安全绘图子集，不保证任意 SVG 都能显示。

开关或移除订阅只影响搜索，不清除已选图标，也不会删除上游图片。已选图片用独立公开链接保存，仍可在原地址有效时显示；断网、原图删除或格式不支持时回退 SF Symbols，事项操作不受影响。

订阅设置和选中的公开图片链接随本机快照、JSON 备份保存，不包含清单正文、整库图片、Icons8 Key 或 MCP 登录。旧选择继续兼容；含 GitHub 选择的备份需 3.2+，含 `icons8-mcp:` 选择的备份需 3.3+ 恢复，不建议降级后保存数据。

## 作者与许可

预设只引用原作者的公开链接，不 Fork、整库下载打包或替图案重绘。恩秀图标归 [sooyaaabo/IconLibrary](https://github.com/sooyaaabo/IconLibrary) 及相关权利人；Icons by [selfh.st/icons](https://github.com/selfhst/icons)，集合许可为 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。各品牌商标仍归相应权利人。自定义源请核对作者说明和许可，例如 Qure 明确限制商业用途。完整边界见仓库 NOTICE。

Bank Logos（IconGo / MIT）、Simple Icons（CC0，单个品牌要求见上游）及 Dashboard Icons（Apache 2.0）保留许可和出处；完整原许可在包内各自的 `assets/.../LICENSE`。这些集合许可不授予第三方商标权，项目自己的限制性许可不覆盖第三方已授予的权利。

本机测试不等于 iPhone 真机验收，详见 [3.3 QA](./QA-v3.3.0.md)。
