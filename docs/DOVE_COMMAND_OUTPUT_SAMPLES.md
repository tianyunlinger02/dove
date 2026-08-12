# Dove command and response samples

Dove responses should fit the task rather than a fixed template. The examples below illustrate Dove 3.0.0 boundaries: natural conversation, ordinary Markdown research documents, user-managed review, and software-only CLI diagnostics.

## Bounded research completion

```text
已完成这轮对照检查，并把真正影响后续判断的结果写入现有研究文档。

关键结论：实现已经切到 Markdown 文档主线，但安装说明里仍残留旧的服务注册步骤。这个残留会误导新项目，应该先修正文档，再验证初始化输出。

限制：本轮只检查了声明范围内的文档与入口，没有据此判断整个研究目标已经完成。
```

## Status with no overview

A missing overview is normal:

```text
当前没有 `.dove/research/RESEARCH.md`。这表示项目尚未维护 Dove 研究概览，或研究上下文只存在于普通项目文件中；不是“研究状态损坏”。

本次 Status 是只读的，因此没有创建或修改文件。
```

## Status with a broken link

```text
研究概览仍可读取，但其中指向 `experiments/noise-benchmark.md` 的链接已失效，所以我无法从该文档核对实验结果。

目前可以确认主线和其余进展；与该实验有关的结论应暂时视为未核对。建议修复链接或提供新路径。
```

The missing link is reported as an ordinary document problem. Status does not repair it or label the whole research area invalid.

## Source work blocked by access

```text
目前还不能可靠补上这条引用。找到的二手材料都指向同一篇原始论文，但公开入口只提供摘要，无法核对方法和适用条件；我没有把二手转述当作已验证来源。

你可以提供全文让我继续核验，或者让我把正文收窄到摘要真正支持的范围。
```

## Experiment plan before execution

```text
已先把实验计划写入 `.dove/research/experiments/noisy-data-benchmark.md`，包括比较对象、主要指标、停止条件、预期产物、失败价值和资源边界。

实验尚未执行。确认当前计划后，我再按同一文档运行并把实际过程与结果追加进去。
```

After execution, the response may say:

```text
实验已按书面计划执行，实际过程和结果已追加到同一个文档。

这轮结果没有支持原假设：主要指标落在预先声明的无实质差异区间内；有效样本为 48/52，4 个排除项均因采集失败。当前只能说“未观察到预期增益”，不能据此断言两种方法等价。
```

## Review preparation

```text
已准备 Review 文档：`.dove/research/reviews/results-section-review.md`

声明范围：
- `paper/results.md`
- `figures/figure-2.png`

Reviewer 只应读取上述路径，不应修改项目文件，并应返回 Markdown。请把 Review 文档中的自包含提示和声明文件交给你选择并管理的独立会话或评审者。Dove 不会代替你启动或认证 Reviewer。
```

## User-obtained review return

```text
已把你取得的 Reviewer Markdown 原样保存在同一份 Review 文档中，并在其后记录作者处理：主结论已收窄，补充了未完成复现实验的限制，仍有一个高噪声条件问题待解决。

这份返回是评审证据，但 Reviewer 角色名称和本地会话分离本身不能证明独立性。
```

## Auto blocked by the mainline boundary

```text
Auto 未继续执行。当前没有足够明确的 `RESEARCH.md` 主线，而这个主线是 Auto 的只读边界；我不会在自治过程中替你重定义研究方向。

我已给出一份普通项目建议，列出可选主线、关键分歧和需要你确认的范围。确认并记录主线后，可以再次显式调用 `/dove:auto`。
```

## CLI initialization

Illustrative human output:

```text
Dove 已在此项目启用

项目  example-project
宿主  Claude Code

✓ Dove Skill 入口已安装
✓ Planner、Builder/Author 与 Reviewer 资源已安装
✓ 提示词钩子已配置
✓ `.dove/install/manifest.json` 已建立（revision 2.0）

未创建研究数据库或研究 MCP 服务，也未自动创建 `.dove/research/RESEARCH.md`。
下一步  从当前项目重新进入 Claude Code。
```

Generated resources show what Dove projected into the project. They do not prove that every host feature is available in the current session.

## Doctor

```text
Dove 检查

软件包      当前
项目集成    当前
提示词钩子  当前
研究概览    未找到（正常）

Doctor 只报告软件、集成和本地文件可读性，不判断科研结论是否正确、工作是否完成或评审是否独立。
```

Doctor machine state and readable `DOCTOR.md` belong under `.dove/install/`, not in the research documents.

## Explicit research export

```text
检测到可导出的 legacy Dove JSON research records 研究状态。

`dove export-research` 会执行一次性 Markdown 转换，并把原始旧版 JSON 字节归档到 `.dove/archive/...`。它不支持 v1，也不会安装旧 JSON 的运行时回退。

尚未执行：真实研究数据导出需要单独授权。
```

Export is not part of `init`, `sync`, `upgrade`, Doctor, or routine release validation.

## Complete Reinstall confirmation

```text
Complete Reinstall 将删除当前项目的 Dove 研究文档和旧归档，然后重建项目集成。
普通项目文件不会删除。

继续？ (y/N)
```

The default is No. `sync` or `upgrade` should be used when the goal is only to refresh integration.

## CLI help inventory

```text
Top level: init, sync, upgrade, reinstall, doctor, export-research, hook
Hook: user-prompt-submit
```

There is no `mcp` command and no `migrate-research` command. Research work uses the ten host Skills with normal host file and research tools.

## Validation boundary

A maintainer result should stay software-scoped:

```text
文档与生成资源检查通过；三个发布 bundle 与声明清单一致。

这些结果只说明软件发布边界通过了本地验证，不证明研究结论、复现性、论文完成度或 Reviewer 独立性。
```
