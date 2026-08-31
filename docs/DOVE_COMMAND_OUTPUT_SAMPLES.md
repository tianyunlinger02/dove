# Dove Command Output Samples

These samples show the human-facing shape of Dove integration and command output without imposing response templates. They describe the current Dove 3.0.0 model: one Dove research agent, default multi-round progression for confirmed goals, nine optional specialist Skills, three runtime bundles, no Auto command, no Dove research-state MCP server, and no Research Format database.

Generated adapter inventory is not project readiness. Claude Code and DeepSeek Harness are the supported project initialization paths in this release; DSH receives project-local filesystem Skills only.

## Project integration output

Bare `dove` is a short project-aware home. In an interactive terminal it shows Dove's pixel-art bird, the research-agent tagline, and points to `dove` for setup, `dove update` when synchronization is needed, `dove doctor` when attention is needed, or entering a supported host to state the research goal directly; `/dove:*` remains an optional Claude Code shortcut when the project is current.

A successful interactive `dove init --host claude` begins with Dove's bird and then shows the project, host, installed surface, and next step:

```text
  ██▓▓                          █▓▓▓
 ▓█████                      ████▓██
 ▓█████▓                   ▓████████
 ▓███████▓                ██████████
  █████████▓            ▓██████████
  ████████████▓         ██████████
  ███████████████     ▓█████████
    ▓█████████████▓  ▓████████▓
     ███████████████████████▓
      █████████████████████▓▓████
       ▓██████████████████████████
          ▓███████████████████▓  ▓
        ▓██████████████████▓
 ▓▓▓███████████████████▓▓
█████████▓▓▓

Dove 已在此项目启用

项目  example-project
宿主  Claude Code

✓ Dove agent 与 9 个可选专项入口已安装
✓ Claude 提示钩子、WebFetch 禁用与项目绝对路径状态栏已配置
✓ 按需论文检索 MCP 与普通网页 Exa MCP 已声明
✓ 最小研究入口 RESEARCH.md 已建立
✓ 项目集成记录已建立

最小研究入口已建立；研究 overview 与任何后续主题文档由研究者按需维护。它们不代表科研主线、结论或任务已经完成。

论文检索需要本机已有 uvx；Claude Code 首次使用 `dove-paper-search` 或 `exa` project MCP 时会请求你批准。Dove 未安装依赖、写入凭据或替你批准。WebSearch 保留用于搜索发现，WebFetch 由项目权限禁用。

下一步  从当前项目进入或重新进入 Claude Code，直接提出科研请求；Dove 会按科研相关性唤醒，/dove:* 只是可选专项快捷入口。
```

Piped or redirected default output omits the mascot and ANSI styling but keeps the same human summary. `dove init --json` and `dove init --format json` emit one direct machine-readable integration result without presentation prefix, suffix, or ANSI bytes.

## Dove agent surface

Installed Claude projects receive `.claude/agents/dove.md`. The agent describes Dove as one complete research agent rather than separate planning, authoring, and reviewing personas:

```markdown
# Dove Agent

Dove is one complete research agent, not separate planning, authoring, or reviewing personas. Its nine Skills are optional specialist methods and shortcuts, not separate personas, fixed stages, or a workflow the user must coordinate.

## Dove research-agent behavior

- Start from the real research question, current mainline, external context, user need, key uncertainty, and decision that matters.
- Use hunches and first impressions as hypotheses, not decisions; treat user preferences as tradeoff signals, not conclusions or rigid rules.
- Bring research drive: do not stop at admitting limits; turn gaps into sharp hypotheses, discriminating evidence to seek, or concrete next moves that advance the mainline.
- Treat rigor, novelty, experiments, validation, engineering, writing, review, documents, and preferences as layered means rather than equal goals. For a confirmed goal, continue Dove's default progression while an effective in-scope action remains.
```

The exact generated file includes the full canonical persona and tool boundaries.

## Ordinary prompt ambient flow

The hidden intake is added only when a non-slash request is clearly research-related. It does not select a Skill; the host and the same Dove model decide whether to answer, clarify, or use optional capabilities.

A judgment-only prompt should not route into a Skill:

```text
用户：现在怎么办？

Dove-style direct answer:
当前最重要的判断是 X。我的 hunch 是 Y，但它还只是基于 A/B 两个信号的假设。下一步不该先跑大实验，而该先检查 Z，因为它最能区分两个候选解释。除非你要我执行，我会停在无副作用的判断和建议上。
```

This path performs no research Markdown write, launches no subagent, creates no task, and does not require a separate Auto command.

## Skill output shape

A slash command is a capability entrance. The final answer should lead with the real result rather than Dove bookkeeping:

```text
/dove:experiment 分析这个实验结果
```

Expected user-facing shape:

```text
结论：这个结果支持路线 A 继续，但还不足以排除路线 B。

关键依据：
- 指标 1 改善发生在目标条件下，而不是只发生在方便 proxy 上。
- 失败样例集中在长尾输入，说明机制可能仍依赖数据分布。

下一步：
先做一个最小区分检查：固定输入分布，只替换机制组件。如果差异仍存在，再把它记录为主线实验结果；否则不要扩大实验。
```

The response does not need to expose internal workflow steps.

## Research Markdown maintenance

Dove research Markdown is ordinary context. A Skill run alone is not enough reason to write. Maintenance is appropriate when the user explicitly asks to record, update, or save research context, when the result clearly changes the research mainline, conclusion, decision, or priority, or when durable recovery and evidence value make the work worth preserving.

Example write-worthy result:

```text
这个实验把主线从“方法是否有效”推进到“增益是否来自机制组件”。需要更新对应 Experiment document 和 RESEARCH.md 的当前主线。
```

Example non-write result:

```text
这只是一次解释性回答，没有改变主线、决策，也没有后续恢复价值；不更新 Markdown。
```

## Error result

Errors should be direct and actionable:

```text
Dove 不能继续：当前项目没有有效的 `.dove/install/manifest.json`，所以无法判断哪些 host resources 由 Dove 管理。

下一步：如果这是目标项目，请显式运行 `dove init --host claude`；如果不是，不要从这里推断或修复 Dove 状态。
```

Errors do not expose durable IDs, hashes, replay data, private paths, or control fields.

## Removed surfaces

Dove 3.0.0 does not expose an Auto Skill or command, retired packet, board, runtime, navigation, operator, onboarding, public-status publishing, audio-review, review-loop, or Research Format database surfaces. It does not package a Dove research MCP server or separate user-switchable planning, authoring, or reviewing agents.
