# 版权与官方来源 / Copyright and origin

Copyright (c) 2026 MaroonYS. All rights reserved.
许可标识：`LicenseRef-Due-Manager-Personal-Use-1.0`。
完整条款见随包附带的 [LICENSE](./LICENSE)，仅限依法可受保护且有权授权的部分。

- 官方账号：[MaroonYS](https://github.com/MaroonYS)
- 官方仓库：[scripting-due-manager](https://github.com/MaroonYS/scripting-due-manager)
- 官方发行：[Releases](https://github.com/MaroonYS/scripting-due-manager/releases)
- 固定包地址：https://github.com/MaroonYS/scripting-due-manager/releases/latest/download/due-manager.scripting

允许个人非商业安装、运行、更新、必要备份及分享官方链接。未经书面许可，
不得摘取再用、改名冒充、去除署名、重新打包、镜像转载、二次分发或商业化；
法定例外、第三方权利、平台已有授权及有效的先前许可不受影响。

## 如何辨别发行来源

从 v2.5.9 起，官方发布流程校验随包许可、源文件声明和源码／安装包一致性，
并随发行包提供 `SHA256SUMS` 及 GitHub 签名来源证明（attestation）。
必须核对证明中的仓库、发布工作流、引用及提交，不能只看文件名或本声明。
校验方法见官方仓库 `docs/PROTECTION.md`。

SHA-256 校验用于发现字节不一致；签名来源证明用于验证该包来自指定发布流程。
它们不是版权登记、法律上的权属证明、恶意代码扫描或防复制锁。
本机界面显示本声明不代表已经对本机文件进行了完整性验证。
安装及自动更新仍由 Scripting 处理，没有新增本机强制验签器。

## 第三方与数据

Apple、iOS、WidgetKit、SF Symbols、Scripting 及提及的品牌、商标、系统图标
属于各自权利人；项目使用宿主及系统提供的接口与符号，不对其主张独占版权，
不声称获得其官方背书。构建和测试工具受各自许可约束，不因本许可改变。

v3.0 使用 Icons8 Windows 11 Color 第三方图案，当前包附带 829 张原始 PNG
及逐图离线副本。图案权利属于 Icons8 及相关权利人，不属于本项目的独占版权。
项目发布者已确认具有本项目离线打包及公开分发所需授权；本声明不是 Icons8
授权书，也不向下游授予独立素材提取、再许可或素材库再分发权。
具体权限以适用的 Icons8 授权为准。详见包内 assets/icons8/NOTICE.md 及
sources.json（每项来源地址、尺寸、SHA-256 与显示底板标记）。
Icons8：https://icons8.com/ · 风格：https://icons8.com/icons/fluency

v3.1 的图库入口改为 Fluent Emoji Flat 与 Icons8 在线搜索。以上 829 张内置
Icons8 原图继续兼容旧选择，不作为新在线搜索结果的本地替代。
Fluent Emoji Flat 来自 Microsoft fluentui-emoji，由 Iconify API 提供，适用 MIT
许可，完整原许可见 assets/fluent-emoji-flat/LICENSE。项目的限制性许可不改变
这些第三方图案的 MIT 权利；Microsoft 及各品牌商标权利仍分别保留。
来源：https://github.com/microsoft/fluentui-emoji · https://iconify.design/

在线 Icons8 使用服务方的 Search / Renderer API，需要使用者自己的 API Key
及适用访问权限。密钥仅写入当前脚本的本机系统钥匙串，不随安装包或备份分发。
API 图案实时请求，不缓存响应到本地文件或成功结果缓存；第三方 API 权限与
原有网站下载素材的离线打包授权不同，具体受 Icons8 API 条款和账户权限约束。
服务：https://developers.icons8.com/docs/searchIcons
条款说明：https://intercom.help/icons8-7fb7577e8170/en/articles/8204671-rendering-icons-with-icons8-api

v3.2 增加公开 GitHub 图库订阅，预设仅引用下列上游清单及图片链接：
- sooyaaabo/IconLibrary 的 App、Emby 图库：
  https://github.com/sooyaaabo/IconLibrary
  https://raw.githubusercontent.com/sooyaaabo/IconLibrary/main/App-Icon.json
  https://raw.githubusercontent.com/sooyaaabo/IconLibrary/main/Emby-Icon.json
  仓库列有 MIT LICENSE，同时 README 写有禁止 Fork 的要求，图案也包含网络收集素材。
  本项目仅引用公开链接、保留作者署名，不 Fork 或将其整库图片收入发行包；
  不将仓库级许可视为所有第三方品牌图案的无条件授权，具体使用遵循上游说明及权利人要求。
- Icons by selfh.st/icons：
  https://github.com/selfhst/icons
  https://raw.githubusercontent.com/selfhst/icons/main/index.json
  集合采用 CC BY 4.0：https://creativecommons.org/licenses/by/4.0/
  不改上游文件或图案设计，仅按显示槽位生成等比缩略图与背景适配。
  本项目限制性许可不改变这些素材的 CC BY 4.0 权利；第三方商标等权利不因此转移。

自定义订阅由使用者添加，需遵循各自作者的许可与署名要求。兼容 Dashboard Icons
官方索引不表示将其全部图案重新分发或授予新的素材使用权：
https://github.com/homarr-labs/dashboard-icons
GitHub 订阅清单与图片均按需联网读取，不向 GitHub 发送搜索词或完整事项名称。
公开订阅地址及已选图片地址会进入用户自己的设置与备份；不保存凭证或任意网址。
清单与轻量预览仅使用有界会话缓存，不把新图库的图片整库落盘。图标地址可能因
上游维护而失效；关闭／移除订阅不会清除事项选择，失效图片安全回退系统符号。
Icons8 为可选补充，不纳入默认 GitHub 搜索，原有 Keychain 与 API 缓存限制不变。

v3.3 增加 Icons8 官方 MCP 免费账号连接，固定 Windows 11 Color（fluency）风格。
使用本机 OAuth 回调、PKCE 和状态校验；凭据仅保存在当前脚本的本设备钥匙串，
不启用 iCloud 同步，不进入事项、备份、源码或安装包。已选图案以 icons8-mcp:
标识保存，并按需显示公开的 96 px PNG；小组件不读取登录或调用 MCP。
免费 PNG 保留 Icons8 署名，不请求付费 SVG；与原 REST API Key 入口分别管理。
此 MCP PNG 的轻量预览加入有界会话缓存，不落盘；以上 REST API 的限制不变。
服务与署名：https://icons8.com/mcp/ · https://icons8.com/icons/fluency
官方说明：https://github.com/icons8/icons8-mcp

v3.3 同时扩展 GitHub 预设：
- Bank Logos by IconGo：https://github.com/icongo/bank-logos
  MIT；完整原许可见 assets/bank-logos/LICENSE。
  本项目 catalogs/bank-logos.json 仅整理公开图像链接和搜索元数据，
  记录上游提交、纠正明显复用的名称，并排除不支持的横版；不搬运原图。
  标志包含历史机构，不构成当前银行名录、产品推荐或金融服务地域说明。
- Simple Icons：https://github.com/simple-icons/simple-icons
  项目集合与所参考的 slug 规则为 CC0 1.0，见 assets/simple-icons/LICENSE。
  单个品牌可能另列许可和品牌要求，详见上游数据及免责声明。
  图案为单色标志，不重绘成彩色 App 图标；商标等权利不因 CC0 而转移。
- Dashboard Icons：https://github.com/homarr-labs/dashboard-icons
  Apache License 2.0，原版权与完整许可见 assets/dashboard-icons/LICENSE。
  仅适配公开 metadata.json 及 PNG 链接，不将整库图片加入安装包。
这些许可及第三方保留的权利不受本项目限制性许可覆盖。图像显示只适配大小、
原始比例与背景，不改设计；新增的 SVG 显示栅格尺寸最长边不超过 192 px。
英国、美国、大陆、香港及 U 卡只是有限的本机检索词，不能据此认定业务可用、
品牌背书、全部应用／银行／卡产品都有图标，或获得独立素材库的再分发权。

Fluent／Icons8 在线搜索会向所选服务发送搜索词。自动推荐只发送本机识别出的公开品牌／类别词，
不自动上传完整事项名称、备注、金额或日期；推荐不自动替换已经保存的选择。

旧混合品牌／App Logo 图库已从当前包移除，不以旧素材补充新风格的缺项。
历史发行中的第三方图片仍分别适用原发行随附的来源记录、第三方许可及商标限制；
移除图库不改变这些权利，也不对相关图片主张独占版权。

事项、金额、备注和个人备份仍属于用户数据，本声明不取得这些数据的权利。
没有本项目的许可授权服务器、设备绑定、后台取证上传、遥测水印、远程停用或清空数据逻辑。
公开可下载的脚本仍可被复制；许可和来源验证用于声明限制、辨别来源及保留证据。

Personal use only under the bundled LICENSE. No unauthorized reuse, redistribution,
commercial use, removal of notices or passing off. Statutory, platform, third-party
and valid prior rights remain unaffected. Release hashes and attestations verify
bytes and publishing provenance, not copyright ownership or impossibility of copying.
