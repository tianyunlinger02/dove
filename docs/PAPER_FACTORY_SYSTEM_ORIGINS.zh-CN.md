# Dove 体系来源、优点迁移与实现说明

本文档用于说明以下几个项目各自的优势、它们大致采用了什么实现方式、`Dove` 迁移了哪些优点，以及这些优点在当前仓库里是如何实现的：

- OpenCode
- oh-my-openagent / oh-my-opencode
- ARIS（`Auto-claude-code-research-in-sleep`）
- AutoFigure-Edit
- Trellis
- 当前 `Dove`

本文档坚持两个原则：

1. **只写证据支持的内容**。凡是说“已实现”的地方，都能在当前仓库或参考仓库里找到对应的文件、命令、工件或测试。
2. **不把“借鉴”写成“等价复刻”**。`Dove` 是一个 host-neutral、file-first、带可选多宿主 adapter 的学术论文工作流包，不是任何单一参考项目的完整克隆。

---

## 1. 先说明 `Dove` 现在是什么

在谈迁移来源之前，先明确当前 `Dove` 的系统定位。

从当前仓库看，`Dove` 已经被实现为一个 **host-neutral 的学术写作工作流包**，OpenCode 是默认 adapter，核心由四层组成：

1. **宿主 adapter 层**：`.opencode/*`、`.claude/*`、`.codex/*`、`.cursor/*`、`.agents/*`
2. **中立 CLI/MCP/core 层**：`bin/`、`mcp/`、`scripts/`、`src/`
3. **确定性工具层**：`src/mcp/*`
4. **持久化工件层**：`.dove/*`

它当前的核心设计点包括：

- `.dove/orchestration/board.json` 作为板式编排真值源
- `.dove/orchestration/handoffs.md` 作为角色交接日志
- `.dove/task-packets/*` 作为持久化任务包
- `.dove/context/roles/*.json` 作为按角色裁剪后的上下文清单
- `.dove/sessions/*` 作为持久化会话/工作区摘要
- `dove.status` 作为公共任务图表面，`dove.status`、`dove.status`、`dove.status` 作为 paper-domain 查询与导航表面

这些能力可在以下文件中直接看到：

- `README.md`
- `docs/USAGE.md`
- `docs/CAPABILITY_MATRIX.md`
- `src/core/orchestration.mjs`
- `src/core/navigation.mjs`
- `src/core/evidence.mjs`
- `src/core/reviews.mjs`
- `src/mcp/tool-definitions.mjs`

因此，下文谈“迁移了什么优点”，不是抽象理念，而是看这些具体结构从哪些参考项目中受到了启发。

---

## 2. OpenCode 的优点、实现方式，以及我们迁移了什么

### 2.1 OpenCode 的优点

OpenCode 对 `Dove` 最大的价值，不是某一个具体学术功能，而是它提供了一个**真实可承载的宿主边界**。也就是：

- 有稳定的命令入口
- 有技能系统
- 有 MCP 接入面
- 可以做项目内本地扩展
- 允许用文件和命令组织工作流，而不是依赖闭源 IDE 魔法

### 2.2 OpenCode 的实现方式

从我们之前针对 OpenCode 的研究，以及当前 `Dove` 的目标适配面来看，OpenCode 的可用扩展面主要体现在：

- `.opencode/commands/`
- `.opencode/skills/`
- `.opencode.json`
- 本地 stdio MCP

也就是说，OpenCode 更适合作为 **workflow pack 宿主**，而不是假设它已经有完整的宿主级 agent runtime、隐式 scheduler 或 subagent hook interception。

### 2.3 我们迁移了什么优点

我们不是“迁移 OpenCode 的能力”，而是**接受 OpenCode 的真实边界**，然后围绕它设计 `Dove`：

- 把论文工作流做成 `.opencode/commands` 命令包
- 把角色行为做成 `.opencode/skills` 技能包
- 把确定性状态变更放进 MCP 工具
- 把长生命周期状态放进 `.dove/*`

### 2.4 我们是怎么实现的

关键实现文件：

- `.opencode/commands/*.md`
- `.opencode/skills/*/SKILL.md`
- `.opencode.json`
- `mcp/dove-state-server.mjs`
- `src/mcp/tool-definitions.mjs`
- `src/mcp/handlers.mjs`

这部分让 `Dove` 一开始就尊重 OpenCode 的真实宿主边界；在多宿主安装改造后，OpenCode 变成默认 adapter，而中立核心继续由 CLI/MCP/core 和 `.dove` 承载。

---

## 3. oh-my-openagent / oh-my-opencode 的优点、实现方式，以及我们迁移了什么

### 3.1 它的主要优点是什么

oh-my-openagent / oh-my-opencode 最强的地方，不是单一功能，而是**工程化编排能力**。按参考仓库 `README.md` 和 `AGENTS.md`，它的突出优势包括：

- 明确的多角色协作模型
- 强调 orchestration，而不是单模型单回合问答
- 完整的 command / skill / MCP / hook / tool 体系
- 安装、doctor、运行时守卫等工程化配套
- 对工作分类、任务分流、并行执行有非常强的组织能力

从 `reference_repos/oh-my-openagent/README.md` 可以看到它把自己定位为：

- discipline agents
- ultrawork / loop 型工作方式
- background agents
- built-in MCPs
- command / skill / planner / reviewer / oracle 一整套编排体系

从 `reference_repos/oh-my-openagent/AGENTS.md` 可以进一步看出，它实现上属于**更重型的插件/宿主集成系统**，包含：

- 10 个 OpenCode hook handlers
- 数十个 hooks / tools / feature modules
- 多层配置系统
- 多层 MCP 体系
- 更完整的 agent registry / model routing / CLI / doctor

### 3.2 它大致是怎么实现的

从 `AGENTS.md` 描述可以总结为几类实现方式：

1. **宿主插件层很重**：有完整插件入口、hook handler、feature manager、tool registry
2. **角色系统明确**：如 Sisyphus、Oracle、Librarian、Explore、Prometheus 等
3. **多层配置**：项目级、用户级、默认级合并
4. **并行化和工具化很强**：background tasks、tmux、LSP、AST-grep、MCP 都被纳入统一 harness

### 3.3 我们迁移了什么优点

我们迁移的不是它那套更重的宿主 hook/runtime 本身，而是迁移了这些**可移植优势**：

- **显式角色库存**
- **board-first orchestration 思路**
- **command/skill/MCP 分层**
- **install / sync / doctor 的工程化习惯**
- **工作流组合方式**
- **把复杂任务拆成可检查的 durable artifacts**

### 3.4 我们是怎么实现的

在 `Dove` 中，这些迁移主要落在：

- 角色与板式编排：
  - `src/core/schema.mjs`
  - `src/core/orchestration.mjs`
  - `.dove/orchestration/board.json`
  - `.dove/orchestration/handoffs.md`
- command / skill / MCP 分层：
  - `.opencode/commands/*`
  - `.opencode/skills/*`
  - `src/mcp/tool-definitions.mjs`
  - `src/mcp/handlers.mjs`
- install / doctor：
  - `bin/dove.mjs`
  - `scripts/doctor-mcp-probe.mjs`

我们**没有**迁移的部分也要明确：

- 没有声称实现 oh-my-opencode 那种完整 hook-heavy host runtime
- 没有声称实现它全部 agent/runtime fallback/model routing 能力
- 没有声称完整复刻其插件规模

这部分边界也已经在 `docs/CAPABILITY_MATRIX.md` 里被显式标注。

---

## 4. ARIS 的优点、实现方式，以及我们迁移了什么

### 4.1 它的主要优点是什么

ARIS 的核心优点不是“有很多技能”，而是它把**学术研究到论文写作**组织成了完整链路。

从 `reference_repos/Auto-claude-code-research-in-sleep/README.md` 可以直接看出的强项包括：

- durable research workflow
- research pipeline / rebuttal / paper writing 等完整工作流
- persistent memory / research wiki
- claim-driven experiments
- cross-model review
- review / rebuttal safety gates
- meta-optimize / learning from prior runs

它非常强调一件事：**ARIS 是 methodology，不只是 prompt 集合**。

### 4.2 它大致是怎么实现的

从 README 可以总结它的实现方式：

1. **技能驱动工作流**：大量 `SKILL.md` 组成复合流程
2. **plain markdown / low lock-in**：强调零依赖、文件驱动、可迁移
3. **多工作流分段**：idea discovery、experiment bridge、paper writing、rebuttal、research wiki 等
4. **跨模型协作**：执行与审查分离，避免 self-review 局部最优
5. **持久化研究记忆**：research wiki、experiment log、claims、reviews 等

### 4.3 我们迁移了什么优点

`Dove` 迁移的 ARIS 优点主要是学术侧：

- 持久化 research memory
- claim-evidence discipline
- 支持 claim 关联的实验计划与结果追踪
- review + revision loop
- rebuttal issue board + strategy
- version evolution / comparison

### 4.4 我们是怎么实现的

这些能力现在已经具体落在：

- 证据与 claim：
  - `src/core/evidence.mjs`
  - `.dove/evidence/index.json`
  - `.dove/claims/CLAIMS_FROM_RESULTS.md`
- 实验：
  - `src/core/orchestration.mjs`
  - `.dove/experiments/plans.json`
  - `.dove/experiments/results.json`
  - `.dove/experiments/EXPERIMENT_LOG.md`
- 评审与修订：
  - `src/core/reviews.mjs`
  - `.dove/reviews/log.md`
  - `.dove/revision-plans/current-plan.md`
- rebuttal：
  - `.dove/rebuttal/issues.json`
  - `.dove/rebuttal/strategy.md`
  - `.dove/rebuttal/response-draft.md`
- 版本演化：
  - `.dove/versions/index.json`
  - `.dove/versions/comparisons.json`
  - `.dove/versions/LATEST_COMPARISON.md`

这里需要特别说明：当前实现支持把实验计划和实验结果与 claim 关联起来，但并不是“所有实验都必须强制绑定 claim 才能存在”。因此，更准确的说法是：`Dove` 吸收了 ARIS 的 **claim-aware / claim-linked experiment discipline**，而不是把所有实验都做成绝对强约束的 claim-only runtime。

我们迁移的是 **ARIS 的学术工作流结构和方法学优势**，而不是声称已经达到 ARIS 全部系统深度。`docs/CAPABILITY_MATRIX.md` 里也明确保留了“不是 full parity”的边界。

---

## 5. AutoFigure-Edit 的优点、实现方式，以及我们迁移了什么

### 5.1 它的主要优点是什么

AutoFigure-Edit 的核心强项非常聚焦：

- 从 method text 到 publication-ready figure
- 生成 **editable SVG**
- 有嵌入式 SVG 编辑器
- 有图像分割、模板化、最终组装的明确流水线

从 `reference_repos/AutoFigure-Edit/README.md` 可以看到它强调：

- Text-to-Figure
- SAM3 icon detection
- labeled placeholders
- SVG generation
- embedded editor
- artifact outputs

### 5.2 它大致是怎么实现的

README 的 “How It Works” 部分给出了很清楚的四阶段流程：

1. raster generation
2. segmentation
3. SVG template generation
4. final SVG assembly

并且是一个真正的图像/矢量生成与编辑系统，而不是只做 figure backlog 管理。

### 5.3 我们迁移了什么优点

目前 `Dove` 迁移的是 **figure planning discipline**，而不是 AutoFigure-Edit 的完整生成能力。

也就是说，我们吸收了：

- figure 作为论文工作流中的显式工件
- figure backlog / planning / owner / inputs / status 的结构化思维

### 5.4 我们是怎么实现的

当前落地点包括：

- figure command：`.opencode/commands/dove.paper.figure.md`
- figure artifact：
  - `.dove/figures/README.md`
  - `.dove/figures/index.json`
- figure state mutation：
  - `src/core/artifacts.mjs`
  - `src/mcp/handlers.mjs`

必须明确的是：

- `Dove` 当前 **没有**实现 AutoFigure-Edit 那种从 method text 到 editable SVG 的完整生成管线
- 它现在做的是 **figure planning / durable tracking**，而不是完整图形生成系统
- 因而它与 AutoFigure-Edit 的关系更准确地说是：**吸收了 figure 规划与工件化管理思路，而不是集成了其图像生成运行时**

---

## 6. Trellis 的优点、实现方式，以及我们迁移了什么

### 6.1 它的主要优点是什么

根据我们对 Trellis 公开仓库/文档的研究，最值得迁移的优点主要有：

- durable task packets
- per-role context manifests
- session/workspace persistence surfaces
- safer workflow-pack evolution
- stronger query/navigation UX

也就是说，Trellis 的可迁移价值更多来自：

- **任务包化**
- **上下文按角色裁剪**
- **工作区持久摘要**
- **升级边界明确**
- **用户可以查询工作流，而不仅是推进生命周期**

### 6.2 它大致是怎么实现的

根据我们前面的仓库研究，Trellis 的实现思路大体是：

1. 用 **task packet** 作为核心工作单元，而不是只靠简单 task title
2. 用 **per-role context manifests** 做角色上下文裁剪
3. 用 **session / journal / workspace summary** 保证跨会话可恢复性
4. 用 **template hash / safe update** 保护用户自定义内容
5. 用更强的 query / navigation surface 让用户理解“当前工作为什么在这里”

但同样也有些部分不适合直接迁移到 `Dove`：

- hook-heavy runtime
- 隐式 subagent interception
- 更重的并行 agent runtime 假设

### 6.3 我们迁移了什么优点

这是本轮新增最明显的一条线。我们迁移了：

- **durable task packets**
- **per-role context manifests**
- **session/workspace persistence**
- **workflow-pack 边界保护**
- **query/navigation 命令与 MCP 工具**

### 6.4 我们是怎么实现的

新增或强化的关键文件包括：

- task packets：
  - `.dove/task-packets/index.json`
  - `.dove/task-packets/packets/*.json`
  - `src/core/navigation.mjs`
- role manifests：
  - `.dove/context/roles/*.json`
  - `src/core/navigation.mjs`
- session persistence：
  - `.dove/sessions/journal.json`
  - `.dove/sessions/LATEST_SUMMARY.md`
  - `src/core/navigation.mjs`
- query/navigation surfaces：
  - `.opencode/commands/dove.status.md`
  - `.opencode/commands/dove.status.md`
  - `.opencode/commands/dove.status.md`
  - `.opencode/commands/dove.status.md`
  - `src/mcp/tool-definitions.mjs`
  - `src/mcp/handlers.mjs`
- boundary safety：
  - `.dove/workflow-pack/boundaries.json`
  - `src/core/workspace.mjs`
  - `bin/dove.mjs`

并且，这次我们不是只加了文档，而是真正做了行为级保证：

- install / sync 不再把 `.dove` 当作普通托管代码目录覆盖掉
- packet refresh 会保留用户自定义 packet 字段
- 非法 role manifest 查询会 fail fast

这里也要强调：这一部分是 **Trellis-style 的可移植、file-first 能力迁移**，不是 Trellis runtime 的完整移植。当前实现的是任务包、角色上下文、导航与边界保护层，而不是隐藏 scheduler、hook interception 或后台 agent runtime。

这些都已经通过测试覆盖：

- `tests/integration/trellis-portable-upgrade.test.mjs`
- `tests/integration/cli-install.test.mjs`
- `tests/integration/mcp-tools.test.mjs`

---

## 7. 当前 `Dove` 自己的优点是什么

在吸收了这些项目之后，当前 `Dove` 的优势已经不是单点功能，而是一个更平衡的系统：

### 7.1 工程侧优势

- host-neutral core + optional host adapters
- file-first
- adapter / CLI-MCP-core / `.dove` 四层结构清晰
- install / sync / doctor / dry-run 验证链完整

### 7.2 学术侧优势

- sources / notes / evidence / claims 的持久化
- claim-aware / claim-linked experiments
- review / revision / rebuttal / version 的持续闭环
- figure planning 被纳入工作流而不是散落在 prompt 里

### 7.3 编排与可恢复性优势

- board-first orchestration
- role inventory 明确
- handoff durable
- task packets 可追踪
- role manifests 缩小上下文面
- session summaries / navigation surfaces 提高跨会话恢复能力

### 7.4 strict mode 的真实边界

`Dove` 当前确实实现了 strict mode，但它的作用边界应被准确理解。

当前 strict mode 主要覆盖的是：

- `upsertPlan`
- `upsertOutline`
- `upsertDraft`

这些路径上的阶段前置条件和部分证据前置条件检查。

它**不是**一个“所有命令、所有状态跃迁都统一强拦截”的全局 runtime 守卫系统。因此，文档中凡是提到 strict mode，都应理解为：

> `Dove` 已实现关键写作阶段的严格门控，而不是全系统无例外的统一调度式强约束。

### 7.5 与参考项目的关系

当前最准确的描述不是“它像哪个项目”，而是：

> `Dove` 是一个以中立核心为底座、以 OpenCode 作为默认 adapter、同时支持可选多宿主 adapter 的学术论文工作流包；它吸收了 oh-my-openagent 的工程化编排优势、ARIS 的学术工作流优势、Trellis 的任务包与上下文管理优势，并参考 AutoFigure-Edit 的图形工件规划思路。

---

## 8. 迁移映射总表

| 来源项目 | 主要优点 | 原项目实现方式 | 我们迁移了什么 | 我们如何实现 |
|---|---|---|---|---|
| OpenCode | 真实可承载的宿主边界 | commands / skills / MCP / project-local config | 接受真实宿主约束并围绕它设计 | `.opencode/commands`、`.opencode/skills`、`.opencode.json`、`src/mcp/*` |
| oh-my-openagent / oh-my-opencode | 多角色编排、工程化 install/doctor、command/skill/MCP 体系 | 更重型插件/hook/tool/agent runtime | role inventory、board-first orchestration、workflow pack discipline | `src/core/orchestration.mjs`、`bin/dove.mjs`、`.dove/orchestration/*` |
| ARIS | 学术研究到写作的完整方法链 | skill-based workflow、plain markdown、persistent research memory | evidence discipline、experiments、review/rebuttal/version 流程 | `src/core/evidence.mjs`、`src/core/reviews.mjs`、`.dove/research/*`、`.dove/rebuttal/*`、`.dove/versions/*` |
| AutoFigure-Edit | publication-ready scientific figure pipeline | text → segmentation → template → editable SVG assembly | figure planning discipline | `.opencode/commands/dove.paper.figure.md`、`.dove/figures/*` |
| Trellis | task packets、role manifests、session persistence、safe boundaries、navigation UX | packetized workflow + role contexts + session summaries + safe update logic | durable task packets、role manifests、sessions、query/navigation、boundary safety | `src/core/navigation.mjs`、`.dove/task-packets/*`、`.dove/context/roles/*`、`.dove/sessions/*`、`.dove/workflow-pack/boundaries.json` |

---

## 9. 明确哪些能力我们没有声称拥有

为了防止误解，这里明确列出当前 **不应**声称的内容：

1. `Dove` **不是** oh-my-openagent / oh-my-opencode 的完整宿主级克隆。
2. `Dove` **不是** ARIS 的完整系统级等价实现。
3. `Dove` **不是** Trellis runtime 的完整复刻，不包含隐藏 scheduler、host hook interception 或 Trellis-native subagent 魔法。
4. `Dove` **不是** AutoFigure-Edit 那种完整 figure generation / editable SVG system。

我们迁移的是这些项目中**可迁移、可验证、与 OpenCode 边界相容的优点**，而不是把所有系统硬拼在一起。

---

## 10. 读者应如何使用本文档

如果你想快速判断 `Dove` 的设计来源，建议按这个顺序读：

1. 先看 `README.md`
2. 再看 `docs/USAGE.md`
3. 再看 `docs/CAPABILITY_MATRIX.md`
4. 最后回来看本文档，理解“这些能力分别来自哪里、是怎么落地的”

如果你想继续扩展 `Dove`，建议优先查看：

- `src/core/orchestration.mjs`
- `src/core/navigation.mjs`
- `src/core/evidence.mjs`
- `src/core/reviews.mjs`
- `src/mcp/tool-definitions.mjs`

这些文件基本上就是当前体系里“迁移优点最终如何落成工程结构”的主干。
