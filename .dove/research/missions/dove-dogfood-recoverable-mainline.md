# Dove dogfood and recoverable mainline

## Goal

让 Dove 开发仓库自身成为当前 Dove 3 的真实使用项目，并让 Dove 在该项目和真实论文项目中能够靠短请求恢复主线、根据证据状态选择行动、作用于权威源码或交付物，并持续到真实完成条件或 material blocker。

## Completion condition

这项 Mission 不以文档写完、generated surface 一致、validator 通过或某一轮修改完成为终点。完成需要同时满足：

- 开发仓库由 current revision-2.0 manifest 管理 Claude project integration，普通 update/hot-sync 可工作，并保持 research、DOCTOR、archive、旧历史 marker、私有状态和无关 hooks 不变；
- canonical Dove 行为能清楚表达 mainline、evidence state、Explore/Execute/Express 行动性质、capability/responsibility 和 outcome/continuation，而不形成固定 pipeline、角色系统、schema 或 prompt 膨胀；
- generated surfaces、公共文档、Trellis specs 和 validators 与 canonical source 一致，软件测试只报告其能证明的软件边界；
- 在 Dove 开发项目中，短 `/dove:auto` 能从本 Mission 恢复主线，选择会改变结果的真实动作，不把最近的检查、文档或安装工作误当最终目标，并在仍有可行动作时继续；
- 在 PhysPrior 等真实项目中，Auto 能找到 authoritative manuscript source、构建链和 venue-facing artifact，推进到实际可提交或确认当前不可解的 material blocker；
- Research、Status、Source、Experiment、Draft、Figure、Review、Rebuttal 和 Lessons 各自在真实 bounded request 中守住能力与副作用边界。

## Authoritative implementation and validation paths

Dove persona、action selection 和 Skill workflow 的 canonical source 位于 `src/core/dove-agent-persona.mjs`、`src/core/command-manifest.mjs` 以及本 Mission 下将建立的共享 research contract；generated host adapters 不是手改权威。

项目接入和 hot-sync 的权威实现位于 `src/core/project-installation.mjs`、`src/core/dove-lifecycle.mjs`、`src/core/project-doctor.mjs`、SessionStart/UserPromptSubmit hooks 和 revision-2.0 `.dove/install/manifest.json`。Stop 只负责回复渲染，不参与同步或研究记录。

软件验证入口位于 `scripts/validate-commands.mjs`、`scripts/validate-hot-sync.mjs`、package/build/release scripts。它们只能证明生成、所有权、生命周期和软件边界，不能证明 Dove 科研判断正确。

## Current evidence and decisions

开发仓库的 current Markdown research tree 已建立，researcher-owned Dove development Lesson 已保留。受控 adoption 已在不执行 reinstall 的情况下创建 revision-2.0 manifest，并通过精确 hash 对比确认 `.dove/research/**`、`DOCTOR.md`、`.dove-archive/**`、`.dove/manifest.json` 和 `.dove/project.json` 未改变；现有 Claude hooks 被保留，Dove hooks 与 pinned paper-search MCP fragment 被合并。旧 0.4.0 marker 仍是惰性历史内容，不是当前 runtime authority。

Dove 作为一个完整 agent、十个 flat Skills、显式 Auto、普通 Markdown、user-managed separate reviewer 和 no fallback/backcompat 是已接受设计边界。Explore、Execute、Express 是可跳过、重复、组合和回退的正交行动视角；Skill、subagent 或角色名称不决定研究顺序。

当前未证明的是模型真实行为：source project 的短 Auto 尚未运行；右侧 PhysPrior 的最新 canonical Auto 尚未在既有 pane 重新启动；authoritative submission artifact 尚未由 Auto 真实识别和验证；专项 Skills 尚未完成逐项真实验收。现有 test green、Doctor ready 和磁盘 hot-sync 不能填补这些证据缺口。

## Next decision-changing work

先完成 canonical research contract、Auto/必要 Skills、generator persistence、validators 和文档的整合，并通过完整软件/lifecycle gate。随后使用短真实请求验收 Dove 开发主线和 PhysPrior submission-readiness 主线。行为失败时按失败所在的 mainline、evidence、action、capability、deliverable 或 continuation 层选择与根因匹配的修改；不默认追加提示词，也不因追求小改而留下系统性问题。
