# 参考项目架构与核心思路

这份文档专门回答一个问题：

> 我们参考的几个项目，**各自的系统架构是什么，核心设计思路又是什么**？

它和 `docs/PAPER_FACTORY_SYSTEM_ORIGINS.zh-CN.md` 的区别是：

- `PAPER_FACTORY_SYSTEM_ORIGINS.zh-CN.md` 更偏**来源、迁移映射、已迁入能力**
- 本文档更偏**架构视角**，强调每个项目是如何组织系统、如何分层、核心方法论是什么

为了保持诚实，本文件只讨论两类内容：

1. 能从参考仓库和当前 `Dove` 仓库中直接找到证据支持的内容
2. 与 `Dove` 设计决策直接相关的架构思想

本文档不把“受启发”写成“完全等价”。

> 说明：文中提到的 `reference_repos/*` 路径，指的是开发过程中在本地工作区下载的参考仓库材料，用于做架构分析与迁移判断。它们不是 `Dove` 发布包的一部分；如果你在一个精简发布副本里阅读本文档，请以上游项目仓库和 README 为准。

---

## 1. 先看 `Dove` 自己的架构定位

在看参考项目之前，先明确当前 `Dove` 本身已经是什么系统。

### 1.1 `Dove` 不是一个单体插件，而是四层 workflow pack

当前 `Dove` 是一个 **host-neutral、file-first、board-first** 的学术论文工作流包，OpenCode 是默认宿主 adapter，而不是唯一底座。它的系统结构可以分成四层：

1. **宿主 adapter 层**：`.opencode/*`、`.claude/*`、`.codex/*`、`.cursor/*`、`.agents/*`
2. **中立 CLI/MCP/core 层**：`bin/`、`mcp/`、`scripts/`、`src/`
3. **确定性工具层**：`src/mcp/*`
4. **持久化工件层**：`.dove/*`

对应文件：

- `README.md`
- `docs/USAGE.md`
- `src/mcp/tool-definitions.mjs`
- `src/mcp/handlers.mjs`
- `src/core/orchestration.mjs`
- `src/core/navigation.mjs`

### 1.2 它的核心控制面是什么

当前 `Dove` 的控制面并不是“聊天上下文”，而是 durable files：

- `.dove/orchestration/board.json`
- `.dove/orchestration/handoffs.md`
- `.dove/task-packets/*`
- `.dove/context/*`
- `.dove/workspace/index.json`
- `.dove/reviews/*`
- `.dove/experiments/*`
- `.dove/claims/*`
- `.dove/versions/*`
- `.dove/figures/*`

这意味着：

- agent 行为必须最终落回文件
- MCP 只是 deterministic helper，不是 source of truth
- docs/commands/skills 只是驱动层，不是持久状态本身

这是理解后面所有“参考了谁”的基础。

---

## 2. OpenCode：宿主边界而不是“超能力提供者”

### 2.1 OpenCode 在这里扮演什么角色

OpenCode 对 `Dove` 的价值，主要不是某个研究能力，而是它提供了一个**稳定、真实、有限**的宿主边界。

它适合承载：

- 项目命令
- 技能
- 本地 MCP
- 项目内扩展配置

但它并不天然等于：

- 隐式 agent scheduler
- hook-heavy runtime interception
- 自动多代理 swarm 系统

### 2.2 这对架构意味着什么

所以 `Dove` 的设计原则一直是：

> 先接受 OpenCode 的真实边界，再在边界内做最强的工作流系统。

这就是为什么我们采用：

- `.opencode/commands`
- `.opencode/skills`
- `.opencode.json`
- 本地 stdio MCP
- `.dove/*` 作为真值源

而不是去构造一个依赖宿主私有 hook 的“伪完整版 runtime”。

---

## 3. oh-my-openagent / oh-my-opencode：工程化编排系统

参考证据（开发时本地参考材料，对应上游仓库）：

- `reference_repos/oh-my-openagent/README.md`
- `reference_repos/oh-my-openagent/AGENTS.md`

### 3.1 它的架构长什么样

从 `AGENTS.md` 可以看出，它是一个**重型宿主增强层**，结构上大致包含：

- `src/index.ts` 作为插件入口
- config 系统：多层配置合并与迁移
- agents 系统：多角色 agent registry
- hooks 系统：大量 lifecycle hooks
- tools 系统：统一工具注册
- features 系统：各类增强模块
- cli：install / doctor / run 等工具链
- mcp：内建 MCP

它的初始化流程也非常明确：

1. `loadPluginConfig()`
2. `createManagers()`
3. `createTools()`
4. `createHooks()`
5. `createPluginInterface()`

也就是说，它不是“几个 prompt 文件的集合”，而是一个**完整的插件式 orchestration runtime**。

### 3.2 它的核心思路是什么

它的关键思想不是“多几个 agent 名字”，而是这几件事：

1. **明确分工**：Sisyphus / Oracle / Librarian / Explore / Prometheus 等角色分化清楚
2. **先分类，再执行**：IntentGate、planner、orchestration category 决定任务怎么走
3. **强工具系统**：LSP、AST-grep、MCP、tmux 都是统一编排的一部分
4. **强工作驱动**：`ultrawork`、background agents、todo enforcer、continuation 类机制都强调“做到完成”为止
5. **工程化配套完整**：install、doctor、兼容层、配置迁移、build/publish 全部纳入系统

### 3.3 为什么它对 `Dove` 很重要

因为它给我们的不是学术方法论，而是：

- **如何把 agent workflow 做成一个产品级系统**
- **如何把 command / skill / tool / state 分层**
- **如何让角色不是装饰，而是编排结构的一部分**

### 3.4 `Dove` 吸收了哪些架构思想

吸收的部分：

- board-first orchestration
- 角色库存
- command / skill / MCP 分层
- install / sync / doctor
- 更强的行为纪律与 role-chain contract
- 更近距离的 local-context discipline（artifact/action context bundles）

没有照搬的部分：

- 52 hooks 这种宿主深度集成
- 隐式背景运行时
- 完整 model routing / runtime fallback / plugin runtime

一句话概括：

> OMO 给 `Dove` 的不是“学术能力”，而是“如何把复杂 agent 工作流工程化地组织起来”。

---

## 4. ARIS：研究方法学系统，而不是单个工具包

参考证据（开发时本地参考材料，对应上游仓库）：

- `reference_repos/Auto-claude-code-research-in-sleep/README.md`

### 4.1 它的架构长什么样

ARIS 的一个重要特点是：**它非常轻，但并不简单**。

它并不依赖重型插件 runtime，而是把工作流组织在：

- `skills/*/SKILL.md`
- `templates/*`
- 研究/实验/论文/回复各类流程命令
- 配套脚本与引用资料

系统层面，它更像是一个：

> 由一组 file-first workflows 组成的研究方法学框架

而不是“单个 CLI 命令”。

### 4.2 它的核心思路是什么

ARIS 最重要的核心思路有几条：

1. **cross-model collaboration**
   - 执行者和审查者分离，避免 self-review 的局部最优

2. **research workflow first**
   - 不是单点技能，而是 idea → experiment → review → paper → rebuttal 的完整链路

3. **methodology, not platform**
   - 文件驱动、零依赖、低锁定，强调工作流本身可以迁移

4. **persistent memory**
   - research wiki、claim、experiment log、review memory、rebuttal state 都是长期积累资产

5. **outer-loop improvement**
   - 比如 `meta-optimize`，意味着系统不只优化论文，也优化 workflow 自己

### 4.3 它为什么对 `Dove` 很重要

因为 `Dove` 的学术核心不是来自 OMO，而主要来自 ARIS：

- claim-evidence discipline
- experiment planning / result tracking / audit / bridge
- review / rebuttal / versioning
- typed wiki 与持久化研究记忆
- 不把研究过程压缩成一次性 prompt

### 4.4 `Dove` 吸收了哪些架构思想

当前已经吸收的包括：

- `.dove/evidence/*`
- `.dove/experiments/*`
- `.dove/reviews/*`
- `.dove/rebuttal/*`
- `.dove/versions/*`
- `.dove/wiki/*`

并且在最近一轮实现中进一步加强了：

- reviewer independence semantics
- adversarial concern memory
- experiment audit ledger
- result-to-claim bridge
- claim-level finalize gate

但仍然没有声称：

- 完整 ARIS parity
- 外部 reviewer runtime 全等迁移
- 自动化研究闭环全部具备

一句话概括：

> ARIS 给 `Dove` 的，是“如何把研究方法论做成 durable workflow system”。

---

## 5. Trellis：长期工作台与任务操作系统思维

### 5.1 我们为什么把 Trellis 当成重要参考

如果说：

- OMO 主要解决“编排”
- ARIS 主要解决“学术方法链路”

那么 Trellis 主要解决的是：

> 如何把复杂工作流变成长期可恢复、可导航、可操作的 workspace。

### 5.2 它的核心思路是什么

根据我们前面的研究，总结起来，Trellis 的可迁移核心思路主要有：

1. **task / workspace / spec 三分**
   - 不只是存任务，而是把“任务、上下文、工作台”分开组织

2. **task packet thinking**
   - 任务不是一行 todo，而是带有依赖、上下文、关联工件、下一步动作的对象

3. **workspace as operating surface**
   - workspace 不是“目录”，而是一个长期操作界面

4. **context manifests**
   - 不同层级有不同 manifest，降低无关上下文噪音

5. **safe update discipline**
   - 对 managed 与 user-owned 内容的边界比较敏感

### 5.3 为什么它对 `Dove` 很重要

因为 `Dove` 从 phase2 开始已经进入了“不是几个命令，而是一个工作台”的阶段。Trellis 给我们的启发主要是：

- packet graph
- role/phase/packet/action/artifact contexts
- workspace index / work queues / resume guidance
- handoff obligations
- 更像长期 operating surface 的 `.dove/workspace/index.json`

### 5.4 `Dove` 吸收了哪些架构思想

现在可以在这些地方看到明显的 Trellis-style 结构：

- `.dove/task-packets/*`
- `.dove/context/roles/*`
- `.dove/context/phases/*`
- `.dove/context/packets/*`
- `.dove/context/artifacts/*`
- `.dove/context/actions/*`
- `.dove/workspace/index.json`
- `.dove/sessions/*`
- `src/core/navigation.mjs`

其中最近一轮实现进一步补上了：

- richer packet lifecycle
- work queues
- dependency health
- packet-scoped manifests
- artifact-local guidance
- pre-action bundles

但仍然没有做成：

- Trellis runtime clone
- worktree daemon
- host hook injection
- hidden scheduler

一句话概括：

> Trellis 给 `Dove` 的，是“如何把工作流变成一个长期可操作的工作台”。

---

## 6. AutoFigure-Edit：图形流水线和图形工件 contract

参考证据：

- `reference_repos/AutoFigure-Edit/README.md`

### 6.1 它的架构长什么样

AutoFigure-Edit 是一个**完整的图形生成与编辑系统**，它的系统形态和 `Dove` 差别非常大。

它包含：

- pipeline 主程序
- Web 后端
- SVG 编辑器
- SAM3 / segmentation
- icon crops / template / final SVG 产物

它的 README 已经明确给出一个四阶段流水线：

1. `figure.png`
2. `sam.png`
3. `template.svg`
4. `final.svg`

而且还有更详细的技术路线：

- text-to-image
- segmentation
- placeholder template
- optimization
- final assembly

### 6.2 它的核心思路是什么

最重要的其实不是“会生成图”，而是它把图形生产过程拆成一系列**可检查、可替换、可编辑的中间工件**：

- 原始生成
- 分割结果
- template
- final assembled SVG

这是一种非常强的 artifact-contract 思维。

### 6.3 为什么它对 `Dove` 很重要

因为论文系统里，figure 往往最容易退化成一句“TODO: 画图”。AutoFigure-Edit 给我们的启发是：

> 即使不做完整生成系统，也应该把图的生命周期工件化。

### 6.4 `Dove` 吸收了哪些架构思想

现在 `Dove` 的 figure 层已经从简单 backlog 变成 staged artifact contract：

- `.dove/figures/briefs.json`
- `.dove/figures/segments.json`
- `.dove/figures/templates.json`
- `.dove/figures/editable-index.json`
- `.dove/figures/final-index.json`
- `.dove/figures/qa.json`

并且：

- figure QA 已经进入 review surfaces
- figure 与 claim / section / experiment / review context 有了 durable linkage

但仍然明确没有做：

- 图像生成 runtime
- embedded editor
- SAM3 pipeline
- AutoFigure-Edit 级别的 SVG 生产系统

一句话概括：

> AutoFigure-Edit 给 `Dove` 的，不是“自动画图能力本身”，而是“把图变成可审计的阶段性工件”。

---

## 7. 当前 `Dove` 的系统思路，可以怎么理解

如果把上面几个项目压缩成一句架构归纳，那么现在的 `Dove` 可以理解成：

### 7.1 它的宿主策略来自 OpenCode

- 接受真实宿主边界
- 用 commands / skills / MCP / project artifacts 搭系统

### 7.2 它的工程组织思路来自 OMO

- board-first orchestration
- role inventory
- command/skill/MCP 分层
- install / doctor / verification discipline

### 7.3 它的学术方法链路来自 ARIS

- evidence
- experiments
- reviews
- rebuttal
- versions
- persistent research memory

### 7.4 它的 workspace operating 语义来自 Trellis

- task packets
- manifests
- workspace index
- action/artifact local context bundles

### 7.5 它的 figure artifact contract 思维来自 AutoFigure-Edit

- staged artifacts
- template/final separation
- figure QA 进入 review domain

---

## 8. 用一句话区分这几个参考项目

如果你想快速记住它们的“系统气质”，可以这样理解：

- **OpenCode**：真实宿主边界
- **OMO**：工程化 agent 编排系统
- **ARIS**：学术研究方法学系统
- **Trellis**：长期工作台 / task operating system 思维
- **AutoFigure-Edit**：图形流水线与中间工件系统
- **Dove**：把上面这些可迁移优点压缩进一个 host-neutral、file-first、带可选多宿主 adapter 的学术论文 workflow pack

---

## 9. 当前仍然不能误解的边界

即便我们已经吸收了很多优点，也仍然要明确：

1. `Dove` 不是 OMO 的完整 runtime clone
2. `Dove` 不是 ARIS 的 full parity
3. `Dove` 不是 Trellis runtime clone
4. `Dove` 不是 AutoFigure-Edit 的图形生成平台

它真正的价值在于：

> 在不越过 OpenCode 真实边界的前提下，把这些系统里最有价值、最可验证、最可移植的架构思想叠加到一个文件驱动的学术论文工作流里。

---

## 10. 建议的阅读顺序

如果你想系统理解现在的 `Dove`，建议按这个顺序看：

1. `README.md`
2. `docs/USAGE.md`
3. `docs/CAPABILITY_MATRIX.md`
4. `docs/PAPER_FACTORY_SYSTEM_ORIGINS.zh-CN.md`
5. **本文档** `docs/REFERENCE_ARCHITECTURES.zh-CN.md`

如果你想直接看核心代码：

- `src/core/orchestration.mjs`
- `src/core/navigation.mjs`
- `src/core/reviews.mjs`
- `src/core/evidence.mjs`
- `src/core/artifacts.mjs`
- `src/mcp/tool-definitions.mjs`

这些文件基本就是当前 `Dove` 架构主干。

---

## 11. 上游参考项目入口

如果你希望直接阅读这些参考项目的原始设计材料，可以从这里进入：

- oh-my-openagent / oh-my-opencode: https://github.com/code-yeongyu/oh-my-openagent
- ARIS / Auto-claude-code-research-in-sleep: https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep
- AutoFigure-Edit: https://github.com/ResearAI/AutoFigure-Edit
- Trellis: https://github.com/mindfold-ai/Trellis
