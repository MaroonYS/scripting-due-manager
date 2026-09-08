# 版权、发行核验与取证

Copyright (c) 2026 MaroonYS. 本文受仓库 LICENSE 约束。

## 已落实的限制

自 v2.5.9 起，项目采用 `LicenseRef-Due-Manager-Personal-Use-1.0`，不是开源许可。
默认允许个人非商业安装、运行、更新、必要备份和分享官方链接。超出许可的
摘取再用、修改、转载、二次分发、商业化、去署名和冒充须事先获得书面许可。
完整条款以随版本的 LICENSE 为准，NOTICE.md 列出第三方及来源边界。

代码、测试、工作流加入版权和许可标识；安装包附带完整条款；主界面有离线摘要
和版本化许可链接。发布测试检查声明，流水线逐文件核对包与源码，生成校验文件，
签署并验证发布来源后才创建 Release。已有版本不会被此流水线用不同字节覆盖。
这不是 GitHub 全仓库的管理员写入锁，不能阻止具有管理权限的人改变仓库设置。

## 下载包核验（电脑端）

以 v2.5.9 为例，在一个新的空目录执行以下命令，需安装并可使用 GitHub CLI：

```sh
gh release download v2.5.9 --repo MaroonYS/scripting-due-manager \
  --pattern due-manager.scripting --pattern SHA256SUMS
shasum -a 256 -c SHA256SUMS
gh attestation verify due-manager.scripting \
  --repo MaroonYS/scripting-due-manager \
  --signer-workflow MaroonYS/scripting-due-manager/.github/workflows/publish-release.yml \
  --source-ref refs/heads/main --deny-self-hosted-runners
```

Linux 可将 `shasum -a 256 -c SHA256SUMS` 换为 `sha256sum --check SHA256SUMS`。
两个验证命令都须成功，不能只看相同的文件名、作者文字或一张成功截图。
进一步核对目标版本：在官方 Release 打开标签对应提交，取得完整 40 位提交 SHA，
在验签命令中增加 `--source-digest <该完整提交SHA>`。不要用第三方提供的 SHA 代替。
新版把下载命令中的标签改为目标版本，并核对该版本提交。

SHA-256 发现字节变化，但攻击者也能为仿冒包重新生成校验文件，因此单独的哈希
不能证明官方身份。签名来源证明绑定文件摘要及指定仓库发布工作流；
校验工作流身份、来源引用和提交才有意义。这仍不保证代码无恶意、不证明法律权属。
官方账号或发布工作流若遭入侵，来源可信性也会受影响。
GitHub 对此能力的说明见 [actions/attest](https://github.com/actions/attest)
及 [GitHub CLI 验签说明](https://cli.github.com/manual/gh_attestation_verify)。

这些命令验证的是下载包，不是手机已经安装后可能被改写的文件。
Scripting 的导入及 remoteResource 自动更新继续使用原接口，没有新增本机强制验签器；
不要把主界面的声明或现有更新地址检查说成“本机防篡改验证通过”。

## 遇到疑似侵权时

1. 保留原始发布记录、完整提交、版本标签、官方安装包、哈希及签名验证结果。
2. 记录涉嫌侵权的确切网址、账号、发现时间和带上下文的截图；如合法取得对应文件，
   保留原件并计算其哈希，不运行可疑脚本。
3. 逐项列出可受保护表达的对应位置、实质相似内容、去署名或冒充证据；
   排除相同功能、通用算法、独立创作、法定例外、有效授权与第三方内容。
4. 核实投诉人是权利人或正式授权代理，再通过平台的正式程序处理。
   GitHub 上须先阅读其 [DMCA 政策](https://docs.github.com/en/site-policy/content-removal-policies/dmca-takedown-policy)，
   不仅因为有人合法 fork 就投诉，也不自动提交声明、索赔或公开指控。

取证记录可按“官方版本／提交 → 可疑链接及时间 → 对应文件与具体片段 → 权利依据及例外核查”
填写。不要在公开 issue 中放个人数据、联系方式、证件或未公开证据。
需要联系维护者时，可先在官方仓库提出不含敏感材料的联系请求，等待确认私下沟通方式。

## 无法承诺的边界

- 公开源代码和安装包仍可下载、复制或被改写，文字声明和哈希不能消除这种技术可能。
- 公开 GitHub 仓库允许按平台条款查看和站内 fork；改为私有也不会回收已经存在的副本。
  参见 [GitHub 仓库许可说明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)。
- 版权不能据此扩张为对思想、程序逻辑或算法原理的独占；
  美国版权局的 [计算机程序说明](https://www.copyright.gov/register/tx-programs.html) 对此有明确区分。
  各地标准及 AI 辅助内容的可保护性还须按具体创作贡献核实，不声称项目每一部分均享有独占版权。
- LICENSE 不撤销已有效授予的权利，不改写历史标签和已发布包，不代 Apple、Scripting
  或其他第三方授权，也不取得用户自己的数据。
- 当前仓库保持公开以维持既有安装／更新链接，没有新增设备绑定、追踪上传、授权锁、
  远程停用或破坏数据的机制。更强的访问控制需要另行设计分发方式，仍不能保证绝无复制。

许可文本与本文是项目使用规则和工程说明，不是版权登记或针对某一司法辖区的法律意见。
如需索赔、版权登记、商标保护或跨境执行，应让具备当地资格的律师核实权利主体、
实际创作贡献与条款的可执行性。
