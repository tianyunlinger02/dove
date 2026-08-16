# Usage

## 使用原则

Dove 使用宿主正常的文件、编程、执行和研究工具推进真实科研工作。研究上下文是 `.dove/research/` 下的普通 Markdown，不是数据库或隐藏状态。

当研究方向仍开放时，先发散探索并比较重要候选，再决定投入哪条路线。理论与证据冲突时，重新审视理论、实验和路线本身，选择最能澄清分歧的下一步，而不是默认继续增加实验。

默认使用用户要求的语言和格式；没有特殊要求时，用自然清楚的中文回答。最终回复应直接回答真实请求，保留重要失败、限制和不确定性，不复述内部工作流。

## 日常入口

安装并初始化项目后，从项目中进入或重新进入 Claude Code。可以直接提出普通工作请求，也可以显式调用十个扁平 Skills：

```text
/dove:research 比较当前实现和文档设计，找出最重要的未解决问题。
```

清晰的普通工作请求可由隐藏 intake 选择 `research`、`status`、`source`、`experiment`、`draft`、`figure`、`review`、`rebuttal` 或 `lessons`。路由本身零写入，永远不会选择 Auto。

## 十个 Skills

### Research

用于一次有边界的研究、综合或项目调查。必要时读取 `RESEARCH.md`、Mission 汇总和直接相关文档，然后检查真实项目材料与外部资源，完成本轮成果并停止。

问题或路线尚未明确时，先探索实质不同的解释与方案，再比较重要候选，不直接投入第一个看似合理或最容易的方案。

只有当工作产生值得长期保留的研究价值时，才自然维护相关 Mission、Claim、汇总和 overview；不会为了证明 Skill 运行过而写文档。

### Status

只读查看当前研究投影。先读 `RESEARCH.md`，再读回答问题所需的目录汇总和少量直接链接文档。报告真实主线、进展、失败、限制、不确定性和优先级。

缺少 overview、汇总或链接时，直接说明；不创建或修复文件，也不推断数据库状态。

### Source

发现、获取、保存（有帮助时）、阅读并核对真实材料。区分“搜索到”“成功获取”“实际阅读”和“用于结论”。保存重要路径、获取失败、条件、冲突与限制。

值得保留的来源可写成自然命名的 Source note，并从 `sources/SOURCES.md` 链接。不要生成 Source ID、fingerprint 或 hash。

Claude 项目可按需使用隐藏 `dove-paper-search` 支持 Skill 和固定版本的外部 `paper-search-mcp==0.1.4`。工具可用性、公开下载和全文访问仍取决于本机环境与来源本身。

### Experiment

根据用户的真实请求处理实验设计、执行、现有结果分析或事后记录。

新实验需要执行时，先选择或创建一个自然命名的 Experiment 文档，写明它测试什么以及如何判断结果。执行后把实际过程、结果、重要失败或偏差和解释追加到同一文档。

设计-only 工作写出可执行计划后停止；分析-only 工作直接检查现有结果；事后记录必须诚实标明 retrospective。不要执行后再伪造 prospective plan。

### Draft

读取目标文稿和相关证据，用普通编辑工具创建或修改项目 artifact。将 claims 限制在真实证据范围内，并保留反证、citation gaps 和不确定性。

组织 Results 时，应说明重要结果在检验哪项研究或贡献承诺，以及它支持、削弱或不能建立什么；不要只按现有指标、图表或实验产物堆积内容。

只有重要 claim 的支持、反证、缺失证据或 cannot-say 边界值得单独保存时，才创建自然命名的 Claim 文档；不建立 Claim database。

### Figure

收集真实数据和项目材料，制作或修改图、diagram、plot 和 caption。核对 labels、denominators、来源、可读性以及图、caption 与底层证据是否一致。

只有在有助于后续恢复时，才从相关 Mission 或 Experiment 文档链接 figure。

### Review

Review 是用户管理的单独交换，保存在一份可读的 Review 文档中。

准备 Review 时：

1. 选择或创建自然命名的 Review Markdown；
2. 记录目的、相关项目相对路径、范围限制、必要 rubric 和自包含 prompt；
3. 把声明材料和 prompt 返回给用户，由用户选择并启动单独 reviewer session 或人员；
4. Reviewer 只读，不修改项目文件；
5. 用户取得实际返回后，将其忠实追加到对应 Review 文档。

查看现有 Review 时只读报告，不创建新 handoff。导入返回时不重写、归一化或用摘要覆盖原文。作者分析只在用户要求时添加；实质回应、修订和 follow-up 使用 Rebuttal。

Dove 不启动、冒充或认证 Reviewer。角色分离或会话分离不能证明 reviewer identity、independence 或 authority。

### Rebuttal

Rebuttal 和 revision 属于 Builder/Author。读取真实 Review 文档和 artifacts，根据证据处理每项重要 finding，写回应并完成普通项目修改。

确认回应对应真实 finding，且修订没有夸大证据或抹去失败与不确定性。

### Lessons

先读 `lessons/LESSONS.md`，再只读当前任务直接相关的主题。Lessons 是可质疑的通用建议，不是证据、权限或完成证明。

只有用户明确要求 remember、reflection 或 durable Lessons maintenance 时才修改。维护自然主题和链接，不创建 lesson IDs、frontmatter、应用 ledger 或固定模板。

### Auto

Auto 只能显式调用，用于已记录主线内的多轮高自主研究。Ambient intake 不会选择它。

Auto 要求已有足够明确的 `RESEARCH.md` 主线。该主线是只读方向边界：Auto 可以推进与主线一致的检索、分析、代码、写作、图表、验证和实验，但不能暗中重定义方向。

当理论与证据冲突时，重新审视理论、实验和路线本身，选择最能澄清分歧的下一步，不默认需要更多实验。

如果主线缺失、明显不完整或证据要求改变主线，Auto 返回或保存简短建议并停止。它没有默认轮数，直到目标完成、预算结束、没有正预期价值的可行行动、遇到边界或必需的 Review 返回不可用。

Auto 是前台宿主工作，不是 daemon、scheduler、MCP service 或隐藏 session store。

## Markdown 研究组织

默认树：

```text
.dove/research/
├── RESEARCH.md
├── missions/MISSIONS.md
├── experiments/EXPERIMENTS.md
├── sources/SOURCES.md
├── reviews/REVIEWS.md
├── claims/CLAIMS.md
└── lessons/
    ├── LESSONS.md
    ├── decision-making.md
    ├── research-method.md
    ├── experiments-and-evidence.md
    ├── engineering-and-validation.md
    ├── writing-and-review.md
    └── collaboration-and-environment.md
```

每个汇总是人工维护的入口和综合，不是机器索引。其他文档使用自然名称和自然结构，并在未来恢复确实受益时链接。

不要强制固定 headings、frontmatter、ID、enum、machine index、stored count、research hash 或统一模板。

## CLI 生命周期

CLI 只负责项目软件接入、诊断、显式旧研究导出和 hooks：

```text
init, update, reinstall, doctor, export-research, hook
```

- `init`：建立支持的 Claude 项目接入和完整默认研究树。
- `update`：刷新已识别接入，创建缺失的默认文档，并向现有默认文档精确追加缺失的 canonical 段落或导航；项目中已有的不同内容不覆盖。
- `reinstall`：展示删除与替换范围，默认 No；确认后删除 Dove 自定义研究和旧归档并重建默认树，保留普通项目文件。
- `doctor`：面向开发排查的只读诊断，不判断科研质量。用户通常无需运行。
- `export-research`：一次性把支持的旧 JSON research records 转成 Markdown 并归档原始字节；真实研究需要单独授权。
- `hook user-prompt-submit` 和 `hook stop`：提供 Claude 路由与一轮“说人话”总结。

没有 `dove sync`、`dove mcp`、Workspace/Mission database 命令或旧研究 fallback。

## 软件与研究边界

`.dove/install/` 保存 revision `2.0` 的安装 manifest，也可保存宿主自然维护的 `DOCTOR.md`。它没有 Doctor JSON issue lifecycle。`.dove/research/` 是研究者拥有的 Markdown；`.dove/archive/` 保存显式 export 产生的原始归档。

安装安全 hash 只保护软件管理内容，不是研究证据。测试、adapter 检查、package validation、模型输出和 Review 都不能单独建立科学正确、完成、复现或独立评审。
