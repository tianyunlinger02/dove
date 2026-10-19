# Research

当前主线是让 Dove 3 成为一个能在自身开发与真实科研项目中工作的完整 research agent：从可恢复的主线和证据状态出发，按当前关键判断选择合适行动，推进真实权威交付物，直到目标完成或确认 material blocker，而不是用 workflow、validator、Markdown 或支撑产物替代科研进展。

当前已确认：Dove 保持一个完整 agent、十个 flat Skills、显式 foreground Auto、普通 Markdown research tree、用户管理的独立 reviewer 边界；Explore、Execute、Express 只能作为正交行动视角，不能变成固定角色流水线、阶段状态机或新 schema。开发仓库的旧 0.4.0 workspace 已通过受控 revision-2.0 adoption 建立当前 Claude project integration；旧 marker、DOCTOR、research tree 和 archive 保留为历史或 researcher-owned 状态。

当前最高风险仍是行为而非表面：persona、Auto、Skills、文档和 validators 中的主线/证据/行动/结果语义有重复；软件检查不能证明真实 Agent 会选对下一步；dogfood Mission 已建立，但短 `/dove:auto` 和专项 Skills 的真实行为仍需验收；右侧 PhysPrior Auto 的既有输出显示实质稿件改善，但尚未证明它识别并验证了真正 venue-facing submission artifact，或在同一运行中持续到真实完成条件。

当前优先级：

1. 将 mainline → evidence state → Explore/Execute/Express → capability/responsibility → outcome/continuation 收敛为一个 canonical 行为契约，减少重复而不是继续叠加提示词。
2. 重新生成并验证所有 host surface、lifecycle 和文档镜像。
3. 用短而真实的 Dove 开发任务和右侧 PhysPrior 任务验收 Auto，再逐个验收专项 Skills；严格区分软件 gate、磁盘 hot-sync、当前会话加载和真实行为。

## Research areas

- [Missions](missions/MISSIONS.md)
- [Experiments](experiments/EXPERIMENTS.md)
- [Sources](sources/SOURCES.md)
- [Reviews](reviews/REVIEWS.md)
- [Claims](claims/CLAIMS.md)
- [Lessons](lessons/LESSONS.md)
