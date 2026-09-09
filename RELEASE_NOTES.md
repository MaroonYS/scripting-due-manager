# 到期管家 v3.2.0

新增无需 API Key 的 GitHub 图库订阅与自定义 JSON 源。

- 预设恩秀 App、恩秀 Emby、selfh.st：在线更新清单，本机搜索名称与已知品牌别名，图片按需加载；不上传搜索词或事项内容，不把新图库整库打包。24 项分页，留空可浏览全部，单个源失败不影响其余来源。
- 「管理 GitHub 图库订阅」可验证后添加、启停、移除及补回预设，最多 12 个源。支持 name／url 图标清单及 selfh.st／Dashboard Icons 官方索引；GitHub 文件页和 jsDelivr GitHub 链接统一规范为 Raw，仅加载公开 PNG／安全 SVG。
- 应用／品牌默认推荐 GitHub；房租、证件等通用事项保留 Fluent Emoji Flat。Icons8 作为需自备 API Key 的可选风格补充，不纳入默认 GitHub 搜索；原钥匙串与 API 缓存限制不变。
- 订阅设置和选中的公开图片链接随快照及 JSON 备份保留。移除订阅不清掉事项图标；已有图案、130 个 SF Symbols、事项、周期、通知及安装／更新链接保持兼容。新 GitHub 图标标识需 3.2 或更新版本恢复，不建议降级后保存数据。
- 图案继续适配尺寸、原始比例、留白与深浅色背景。PNG 先检查体积、签名与像素尺寸，再使用轻量显示缩略图；不裁图、不修改上游文件。超时、失效链接和不支持的图片回退系统符号，保留原完成操作保护。

预设仅引用原作者公开资源，不 Fork 或整库再分发。恩秀 IconLibrary 由 sooyaaabo 整理；Icons by selfh.st/icons（CC BY 4.0）。其他图案和商标仍遵循各自权利与服务条款，详见 NOTICE。

369 项测试在香港、UTC、纽约三个时区通过，严格类型检查通过；三个真实清单、七组品牌搜索及十张 PNG 响应体／图片头抽样通过。iPhone Scripting／WidgetKit 原生显示、缩略图、刷新与点击尚待真机验收；Icons8 真实认证仍需用户自行配置 Key 后验证。

[使用说明](https://github.com/MaroonYS/scripting-due-manager/blob/v3.2.0/docs/GITHUB-ICON-SOURCES.md) · [QA 与验收边界](https://github.com/MaroonYS/scripting-due-manager/blob/v3.2.0/docs/QA-v3.2.0.md)
