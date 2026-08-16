# Dove command and response samples

Dove 回复应适合真实任务，而不是套固定模板。以下样例说明 Dove 3.0.0 的十个 Skills、普通 Markdown、用户管理的单独 Review 和六命令 CLI 边界。

## Bounded research completion

```text
已完成这轮对照检查，并把影响后续判断的结果写入现有 Mission 文档。

关键结论：当前实现已经切到 Markdown 研究树，但安装说明仍残留旧命令，会直接误导项目初始化。先修正文档比继续增加局部检查更有价值。

限制：本轮只检查声明范围，没有据此判断整个研究目标已经完成。
```

## Research route exploration

```text
当前存在三条可行路线。我先比较了它们对核心假设的解释力、关键反例、实现成本和最能区分路线的观察，而没有直接投入最容易实现的第一条。

目前第二条理论上更完整，但现有证据仍可能由实验设置偏差解释。下一步应先澄清这个分歧，不默认增加一批相似实验。
```

## Status with no overview

```text
当前没有 `.dove/research/RESEARCH.md`。这表示项目还没有维护研究概览，或上下文只存在于普通项目文件中；不是“研究数据库损坏”。

本次 Status 是只读的，没有创建或修改文件。
```

## Status with a broken link

```text
研究概览可以读取，但其中指向 `experiments/noise-benchmark.md` 的链接已失效，因此无法核对该实验的细节。

目前可以确认其余主线和进展；依赖该实验的结论暂时视为未核对。建议修复链接或提供新路径。
```

## Source blocked by access

```text
找到了原始论文条目和摘要，但公开入口没有可读取全文，因此还不能核对方法与适用条件。我没有把搜索结果或二手转述写成“已阅读原文”。

你可以提供合法全文入口，或者让我把当前表述收窄到摘要真正支持的范围。
```

## Experiment plan before execution

```text
已先把实验计划写入 `.dove/research/experiments/noisy-data-benchmark.md`，说明它测试什么、主要比较和如何判断结果。

实验尚未执行。执行后会把实际过程、结果、重要失败或偏差和解释追加到同一文档。
```

执行后：

```text
实验已执行，实际过程与结果已追加到同一份 Experiment 文档。

结果没有支持原假设：主要指标落在预先声明的无实质差异区间。当前只能说“未观察到预期增益”，不能断言两种方法等价。
```

## Review preparation

```text
已准备 Review 文档：`.dove/research/reviews/results-section-review.md`

声明范围：
- `paper/results.md`
- `figures/figure-2.png`

请把 Review 文档中的自包含 prompt 和上述材料交给你选择并管理的单独 reviewer session 或人员。Reviewer 应保持只读并返回 Markdown。Dove 不会代替你启动、冒充或认证 Reviewer。
```

## Imported review return

```text
已把你取得的 Reviewer Markdown 忠实追加到对应 Review 文档，没有重写或用摘要覆盖原返回。

尚未添加作者解释或修改，因为你这次只要求导入 Review。需要回应和修订时再使用 Rebuttal。
```

## Auto blocked by mainline boundary

```text
Auto 未继续执行。当前 `RESEARCH.md` 没有足够明确的主线，而主线是 Auto 的只读方向边界；我不会在自治过程中替你重定义研究方向。

已返回一份简短建议，列出候选主线和关键分歧。确认并记录主线后，可以再次显式调用 `/dove:auto`。
```

## CLI help

```text
dove

Usage:
  dove --help
  dove --version
  dove init [--project <dir>] [--host <host>...] [--json|--format json]
  dove update [--project <dir>] [--host <host>...] [--json|--format json]
  dove reinstall [--project <dir>] [--json|--format json]
  dove doctor [--project <dir>] [--json|--format json]
  dove export-research [--project <dir>] [--json|--format json]
  dove hook user-prompt-submit --project <dir>
  dove hook stop --project <dir>
```

没有 `sync`、`upgrade`、`mcp serve`、Workspace 或研究数据库命令。

## CLI initialization

```text
Dove 已在此项目启用

项目  example-project
宿主  Claude Code

✓ 10 个 Dove Skill 工作入口已安装
✓ Claude 提示与停止钩子已配置
✓ 按需论文搜索、下载与阅读 MCP 已声明
✓ 完整默认研究目录与通用 Lessons 已建立
✓ 项目集成记录已建立

默认研究目录与通用 Lessons 已建立；它们是可维护的 Markdown 入口，不代表科研主线、结论或任务已经完成。
```

首次使用论文 project MCP 时由用户批准。Dove 不安装依赖、不写凭据、不批准 trust。

## Bare Dove home

当前项目需要更新时：

```text
Dove
围绕科研主线探索，带回证据与经验。

当前项目  Dove 项目集成需要更新

下一步  dove update
帮助  dove --help
```

首页是只读提示，不执行 update。

## Doctor

```text
Dove 检查
面向 Dove 开发排查，检查软件、项目接入和 Markdown 研究文档外层可读性；保持只读，不判断科研结论、完成度或评审权威。用户通常无需运行此命令。

软件      Dove 3.0.0 可用
项目接入  当前
研究文档  Markdown 外层可读
外层可读不等于研究内容正确、完整或经过独立审查。
```

用户对 Dove 的明确反馈和 Dove 实际故障由宿主直接追加到普通 `.dove/install/DOCTOR.md`，不需要运行 Doctor，也没有 JSON issue lifecycle。

## Explicit research export

```text
检测到可导出的 legacy Dove JSON research records。

`dove export-research` 会显示一次性 Markdown 导出预览，并在确认后把原始 JSON bytes 归档到 `.dove/archive/...`。它不支持 v1，也不会安装旧 JSON fallback。

尚未执行：真实研究数据导出需要单独授权。
```

## Complete Reinstall confirmation

```text
完全重新安装将永久重置以下 Dove 项目内容

项目：/path/to/project

将删除
- .dove/research/custom-topic.md
- .dove/archive/old-export

将以当前默认内容替换
- .dove/research/RESEARCH.md

确认后会重建当前项目集成和完整默认研究树。普通项目文件与用户级 Dove 安装不受管理。
```

随后确认默认值为 No。只需要刷新接入或补齐默认内容时使用 `dove update`。

## Validation boundary

```text
生成资源、三个发布 bundles 和 package inventory 检查通过。

这些结果只说明软件发布边界通过本地验证，不证明研究结论、复现性、论文完成度或 Reviewer 独立性。
```
