# Dove command output samples

These samples show output shape only. They are examples, not response templates or scientific guarantees.

## Interactive project setup

Bare `dove` should give a concise project setup result and a next step.

```text
Dove 已在此项目启用

项目  example-project
宿主  Claude Code

✓ Dove agent 与 9 个可选入口已安装
✓ Claude 项目提示、状态栏与来源阅读支持已配置
✓ 最小研究入口 RESEARCH.md 已建立
✓ 项目集成记录已建立

后续研究 overview 与主题文档由研究者按需维护。

下一步  重新进入 Claude Code，直接提出科研请求；/dove:* 是可选专项入口。首次使用外部论文或网页阅读能力时，宿主可能请求你的批准。
```

Piped output should omit mascot art and ANSI styling while keeping the same human summary. Explicit JSON modes should return one direct machine-readable result.

## Dove agent excerpt

Installed Claude projects receive a Dove agent file. A short illustrative excerpt:

```markdown
# Dove Agent

Dove works as one complete research agent. Its nine Skills — research, status, source, experiment, draft, figure, review, rebuttal, and lessons — are flat entrances into the same research collaboration.

## Research judgment

Dove starts from the real research question, current or provisional route, user need, key uncertainty, and decision that matters. It uses theory, related work, adjacent fields, mathematical or physical analysis, analogies, and project evidence to generate and test route ideas.

## Evidence, scope, and follow-through

- Treat hunches, negative results, and near misses as hypotheses or diagnostic signals to validate.
- Preserve the user-confirmed Workspace mainline while another effective in-scope action remains.
```

## Ordinary prompt answer

A non-slash research prompt may receive a direct Dove-style answer. The answer should lead with judgment and useful action, not internal bookkeeping.

```text
用户：现在怎么办？

Dove-style answer:
当前最重要的判断是 X。我的 hunch 是 Y，但它还只是由 A/B 两个信号支持的假设。下一步不该先跑大实验，而该先检查 Z，因为它最能区分两个候选解释。除非你要我执行，我会停在无副作用的判断和建议上。
```

## Skill result

A slash command is a capability entrance. The final answer should state the result, evidence, and next useful action.

```text
/dove:experiment 分析这个实验结果
```

Expected shape:

```text
结论：这个结果支持路线 A 继续，但还不足以排除路线 B。

关键依据：
- 指标 1 的改善发生在目标条件下，而不是只发生在方便 proxy 上。
- 失败样例集中在长尾输入，说明机制可能仍依赖数据分布。

下一步：
先做一个最小区分检查：固定输入分布，只替换机制组件，并排查实现、配置、指标和分析脚本是否能解释差异。如果差异仍存在，再记录为实验结果；否则不要扩大结论。
```

## Research Markdown maintenance

When a result changes the research direction or has real recovery value, Dove may record it in ordinary Markdown.

```text
这个实验把问题从“方法是否有效”推进到“增益是否来自机制组件”。需要更新对应 Experiment document 和 RESEARCH.md。
```

When nothing important changes, the answer can say so and avoid writing:

```text
这只是一次解释性回答，没有改变当前判断、决策，也没有后续恢复价值；不更新 Markdown。
```

Shape-only link example:

```markdown
更新了 [mechanism ablation](experiments/mechanism-ablation.md)，其中引用项目材料 `data/ablation/results.csv`、`figures/mechanism-ablation.svg` 和 `.dove/runs/run-20260903-a1b2c3d4/run.jsonl`。这些路径帮助恢复现场；它们不是 ID、frontmatter、backlink audit 或一致性矩阵。
```

## Run receipt output

A `dove run` receipt records local execution facts before Dove interprets the result scientifically.

```text
Dove run 已启动

Run：run-20260903-a1b2c3d4
状态：started
Supervisor PID：12345
命令：node scripts/diagnostic.mjs
Journal：.dove/runs/run-20260903-a1b2c3d4/run.jsonl
stdout：.dove/runs/run-20260903-a1b2c3d4/stdout.log
stderr：.dove/runs/run-20260903-a1b2c3d4/stderr.log
```

`status` is read-only, `resume` never reruns a target, and `compare` returns `comparable: false` instead of ranking when run basis fields differ.

## Review output

Author-side self-check should be clear about its scope:

```text
这是作者侧科学自检，不是独立 dove-review。

主要问题：
1. 贡献与最近的 X 工作区分仍不够清楚。
2. Figure 3 支撑了趋势，但不足以证明因果机制。

建议：先补一段 related-work 定位，并做一个能区分机制解释与 baseline artifact 的诊断检查。
```

A `dove-review` handoff result should point to the frozen materials and returned report rather than summarizing a private reviewer transcript.

```text
Dove review handoff 已完成

Review：review-20260902-a1b2c3d4
轮次：1
状态：completed
Session：00000000-0000-4000-8000-000000000000
报告：.dove/reviews/review-20260902-a1b2c3d4/rounds/1/report.md
Backend：.dove/reviews/review-20260902-a1b2c3d4/rounds/1/backend.json

冻结材料：
- paper/main.tex (12345 bytes)
- build/main.pdf (45678 bytes)
- supplement/supplement.pdf (23456 bytes)

Reviewer 只接收本轮冻结材料；不会读取私有 transcript。
```

## Error result

Errors should be direct and actionable.

```text
Dove 不能继续：当前项目没有有效的 `.dove/install/manifest.json`，所以无法判断 Dove 管理的项目集成。

下一步：如果这是目标项目，请显式运行 `dove init --host claude`；如果不是，不要从这里推断或修复 Dove 安装。
```

Do not expose private transcripts or irrelevant internal fields in user-facing output.
