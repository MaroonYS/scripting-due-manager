# GitHub 图库订阅（3.2 起）

Copyright (c) 2026 MaroonYS. 本文受仓库 LICENSE 约束；第三方图案保留自身权利。

## 使用入口

打开「图标与外观 → 图标图库与逐项设置 → 在线图库」，选择「GitHub 订阅」。从事项编辑页进入也可以选图；选中的图案仍须在事项编辑页保存后生效，不会自动替换已有选择。

- GitHub：应用、品牌、媒体服务图标，默认启用下表三个源，无需 API Key。
- Fluent Emoji Flat：房租、证件、保修等通用事项图案，无需密钥。
- Icons8：可选的其他图案／风格，仍需自己的 API Key；不进入默认 GitHub 搜索。

| 预设 | 清单 | 用途 |
| --- | --- | --- |
| 恩秀 App | [App-Icon.json](https://raw.githubusercontent.com/sooyaaabo/IconLibrary/main/App-Icon.json) | 国内外应用图案与部分变体 |
| 恩秀 Emby | [Emby-Icon.json](https://raw.githubusercontent.com/sooyaaabo/IconLibrary/main/Emby-Icon.json) | 媒体服务与 Emby 社区图标 |
| selfh.st | [index.json](https://raw.githubusercontent.com/selfhst/icons/main/index.json) | 订阅服务、应用与自托管工具 |

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

`icons` 数组及每项 `name`、`url` 必需，顶层名称／描述不作为代码执行。支持 `aliases` 字符串作为额外搜索词。也能识别 selfh.st 的官方 `index.json` 和 [Dashboard Icons 官方 metadata.json](https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/metadata.json)，这两类索引会转换为同仓库、同引用下的 PNG 地址。

仅接受 HTTPS 的 GitHub Raw、GitHub 文件页及 jsDelivr GitHub 链接，统一规范成 GitHub Raw 地址。jsDelivr 未指定引用时使用 `HEAD`；如果你的网络无法访问 Raw，这一版不会保留 jsDelivr 作为独立传输线路。只支持公开 PNG／安全 SVG；带用户名／密码、查询参数、片段、本地路径、私人服务器、脚本或其他文件类型的地址会被拒绝。

## 更新、移除与备份

清单在当前会话缓存 15 分钟；「立即更新清单并搜索」可重新拉取。刷新失败但本次会话已有成功清单时，会说明正在使用上次的清单。图片只按可见页加载，PNG 校验真实字节大小、签名和像素尺寸后使用轻量缩略图；SVG 使用受限的安全绘图子集，不保证任意 SVG 都能显示。

开关或移除订阅只影响搜索，不清除已选图标，也不会删除上游图片。已选图片用独立公开链接保存，仍可在原地址有效时显示；断网、原图删除或格式不支持时回退 SF Symbols，事项操作不受影响。

订阅设置和选中的公开图片链接随本机快照、JSON 备份保存，不包含清单正文或整库图片，也不包含 Icons8 密钥。3.2 前的选择继续兼容；含新 GitHub 选择的备份应由 3.2 或更新版本恢复，不建议降级后再保存数据。

## 作者与许可

预设只引用原作者的公开链接，不 Fork、整库下载打包或替图案重绘。恩秀图标归 [sooyaaabo/IconLibrary](https://github.com/sooyaaabo/IconLibrary) 及相关权利人；Icons by [selfh.st/icons](https://github.com/selfhst/icons)，集合许可为 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。各品牌商标仍归相应权利人。自定义源请核对作者说明和许可，例如 Qure 明确限制商业用途。完整边界见仓库 NOTICE。

本机测试不等于 iPhone 真机验收，详见 [3.2 QA](./QA-v3.2.0.md)。
