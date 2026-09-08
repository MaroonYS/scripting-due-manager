# v2.7.3 — 放宽圆形裁剪

Copyright (c) 2026 MaroonYS. 本文受仓库 LICENSE 约束，第三方图案权利除外。

## 改动范围

用户截图中，ChatGPT 图案的外缘贴着圆形边界被裁切。既有显示将 144 px 图片以 1.2 倍放在 24 pt 圆形内，图案本身约 24 pt，部分外缘落到圆外。

共享 `BrandLogo` 现将裁剪直径设为 `min(imageSize, logo.size + 4)`：330 个放大图案为 28 pt，图像仍为 28.8 pt，相当于半径向外增加 2 pt；保留圆形及适量底板留白，不再次放大图像。SafePal 和 Telegram 的原图未放大，裁剪仍为 20／24 pt，避免边界大于图片导致方形外边露出。

主界面、编辑预览、品牌目录和小号组件复用同一组件。40 pt 矩形完成点击区、标签语义、事项与周期参数均未修改。品牌选择／自动匹配规则保持现状；用户已撤回的自动品牌匹配修改没有实施。

333 个 PNG、333 个独立离线 JSON、素材清单和来源哈希不变；不改数据、存储格式、周期、通知、启动或异步读取逻辑。仅同步更新了显示说明。

## 验证

- Bun 1.3.11：309 项测试、17 个文件，在 Asia/Hong_Kong、UTC、America/New_York 均通过。
- TypeScript 7.0.2 严格检查与 `git diff --check` 通过。
- 实际 TSX 测试遍历全部 332 个品牌，核对圆形直径、图像尺寸不变、边界不超过图片且小于 40 pt；新增 ChatGPT 专项断言，验证每侧增加 2 pt，图片和完成热区不变。
- 保留主界面、编辑、目录、小号组件共享渲染路径断言；主列表完成、重复点按、精确周期、只读、坏图回退及全部数据测试继续通过。
- macOS ImageIO 成功解码 333 个 PNG，`tools/qa_brand_library.swift --circular` 生成六页深浅色参考图，332 个图案逐页核对。
- `tools/qa_brand_controls.swift` 使用 SwiftUI 渲染 ChatGPT、Claude、招商银行、Ultra Mobile、Spotify、Telegram 的原图／旧裁剪／新裁剪对比，以及 SafePal 原尺寸。已核对 ChatGPT 外缘和 Claude 尖角留白，其他图案仍在 40 pt 区域内。
- 以上为本机几何与解码参考，**不是 iPhone Scripting 或 WidgetKit 实际输出**。圆形仍会裁去方形底板的四角，不声称所有方形源图片毫无裁切。

## 发布与待验收

重新打包并核对 ZIP、解压源码一致性、LICENSE／NOTICE 字节一致、素材哈希和固定安装地址；官方流水线执行测试与来源证明校验。发行后独立下载包，校验 SHA-256、本地一致性及指定 main 提交的官方工作流来源。

iPhone 更新后检查主界面、编辑预览、目录和小号组件中 ChatGPT 的外缘；深浅色及系统着色均需确认。点击图标应继续完成同一期，文字仍进详情，SafePal／Telegram、系统图标和其他尺寸组件保持原样。无需重建事项或重新选择品牌。
