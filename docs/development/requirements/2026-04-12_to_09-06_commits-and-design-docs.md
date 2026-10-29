# Dove 早期要求清单（2026-04-12 至 2026-09-06）

> **全部条目都是间接来源**：来自提交说明，以及 AI 助手当时按用户指示写的设计文档，不是用户原话（用户 9 月 6 日以前的聊天原文已经不存在）。每行末尾的"间接来源"就是这个意思。
> 本文件只整理要求，不判断当前 Dove 是否已经做到。

材料：

- 提交记录：`git_history_before_0907.md`，04-12 至 09-06 共 104 个提交。多数提交只有标题；只有标题、没写理由的条目标"（仅标题）"。
- 设计文档：`docs_0906/` 下四份 9 月 6 日版本。缩写：VP = VISION_AND_PRINCIPLES.md，PR = PRODUCT_REQUIREMENTS.md，FE = FINAL_EXPECTATIONS.md，RM = RESEARCH_MODEL.md。

---

## 1. 从提交记录看到的要求

按时间先后排。同一要求的多个提交合成一行，依据里列出全部哈希。"后来"只写提交记录或 9-06 文档里能看到的变化。

- [04-12] 做一个学术论文工作流包 paper_factory，最初只能装在 OpenCode 上（4 月这批提交由 oh-my-openagent 的 Sisyphus 代写） · 依据：提交 7377058「Add paper_factory academic workflow pack」；9f24a12 后来写「no longer limited to OpenCode-only installation」 · 后来：被"一个统一科研 agent"取代（a6bb20a「Make Dove a unified research agent」；VP 说 Skill「不是不同人格、固定阶段或需要用户手动协调的工作流」） · 间接来源
- [04-12] 记下 paper_factory 的来历和"phase"迁移 · 依据：提交 2a1fef9「Document paper_factory lineage and phase migration」（仅标题） · 间接来源
- [04-12] 扩充命令和 skill 入口 · 依据：提交 2ee16b3「Expand paper_factory command and skill surfaces」（仅标题） · 后来：所有提交说明都没有点名具体 skill，看不到 paper planning、experiment planning 这类 skill 的名字；9-06 定为九个 Skill，其中没有单独的规划类 skill（PR「九个公开 Skills 保持为」） · 间接来源
- [04-12] 工作流引擎及其校验 · 依据：提交 3d034d8「Harden paper_factory workflow engine and validation」（仅标题） · 后来：08-16 e1042ad「Markdown workflow simplification」、08-20 a6bb20a 改为统一 agent，9-06 文档不再有固定流程 · 间接来源
- [04-13] 编排里要有审查和证据契约 · 依据：提交 6c0975d「Strengthen orchestration review and evidence contracts」（仅标题） · 间接来源
- [04-13] 工作区操作入口，以及跨会话保留上下文的持久清单 · 依据：提交 f44181e「Add workspace operating surfaces and durable context manifests」（仅标题） · 后来：9-06 文档不再提 context manifest，续接改靠可见对话、compact/resume 事实卡和普通 Markdown · 间接来源
- [04-13] 能力同时通过 MCP 工具和命令提供，并扩大 MCP 校验范围 · 依据：提交 6dee591「Expose phase5 behavior through MCP and commands」；117316b、eaccbc5 · 后来：07-22 3b13df9 收成「thin MCP boundary」；9-06 文档没有再把 MCP 写成入口（只在审稿侧写"不使用 MCP"） · 间接来源
- [04-13] 图有分阶段的契约并和质检挂钩；受管产物和图都要校验 · 依据：提交 38a3a2b「Deepen staged figure contracts and QA linkage」；ea2360c「Harden managed artifacts and figure validation」（均仅标题） · 间接来源
- [04-13] Dove 对自身的"元优化"只出提案、不直接改 · 依据：提交 203daea「Add proposal-only meta optimize surfaces」（仅标题）；5808239 刷新其指导 · 后来：9-06 文档不再提元优化 · 间接来源
- [04-13] 给本地动作和产物打包上下文（context bundle），之后改称 operator（提交里对用户的称呼）上下文包，并多次刷新指导 · 依据：提交 f9448e5「Add local action and artifact context bundles」；5808239、ead149a、d901b14、1597f07「Refresh operator context bundles and guidance」 · 后来：9-06 文档不再提 · 间接来源
- [04-13] doctor 健康诊断（含 meta schema 迁移检查），通过 MCP 和命令提供 · 依据：提交 117316b「Expose phase6 diagnostics through MCP and commands」；5665049「Harden meta schema migration and doctor diagnostics」 · 后来：一直保留，09-06 362e794 改为「read-only integration diagnostics」 · 间接来源
- [04-13] 优化器产出持久报告 · 依据：提交 6fa981e「Add durable optimizer report scaffold」（仅标题） · 后来：9-06 文档不再提 · 间接来源
- [04-13] 按分类（taxonomy）积累问题记忆，产出补救产物和 operator 产物，后来扩到 operator 记忆 · 依据：提交 c597fa1「Add taxonomy-aware optimizer memory and surfaces」；4ce4947「…remediation artifacts」、a94c721「…operator artifacts」、04e36a8「Add taxonomy-aware operator memory and governance artifacts」 · 后来：9-06 文档不再提；最接近的是 Lessons · 间接来源
- [04-13] 元治理：治理留证、生命周期语义、治理产物和 operator 治理入口 · 依据：提交 8bf9c14「Harden meta governance and doctor diagnostics」；6f0ac9d、cfcdf9f「Harden governance proof and lifecycle semantics」、4b26297、40a36b2「Finalize operator governance MCP handlers」 · 后来：9-06 文档没有治理层 · 间接来源
- [04-25] 把调试中学到的东西写成指导 · 依据：提交 17bc92f「Capture lifecycle mirror debugging guidance」（仅标题） · 间接来源
- [04-25] 开发 Dove 本身用 Trellis 管任务和规范；Trellis 的本地任务归档和运行文件不进指导采集，也不进包历史 · 依据：提交 72fd92f「Exclude local Trellis task archive from guidance capture」；d63d07e「Keep generated Trellis workspace metadata out of the package history」 · 后来：截至 9-06 仍在用（VP「`.trellis/spec/` 保存实现规范」），09-06 362e794「simplify Trellis startup, workflow, and specifications」做了精简，没有删除 · 间接来源
- [04-25] 受治理约束的自主"campaign"运行循环 · 依据：提交 2aef23a「Add governed autonomy campaign runtime loop」（仅标题） · 后来：05-04 改成显式、前台的 autonomy operate（ec1ed0d），08-29 改为"自主科研是默认"（906f9ab），9-06「没有单独 Auto Skill 或 Auto 命令」 · 间接来源
- [05-03] 包仓库只放源码和模板，`.paper` 留作本地自用（dogfood）和运行状态 · 依据：提交 111abd4「preserving .paper as local dogfood/runtime state」 · 后来：05-05 改为 `.dove`（b2c982b） · 间接来源
- [05-03] 支持多个宿主：Claude、Codex、Cursor、OpenCode 和共享 agent 适配，不再只限 OpenCode · 依据：提交 9f24a12「Publish safe Claude, Codex, Cursor, OpenCode, and shared agent adapter files」 · 后来：06-19 1e329ac 去掉项目级 Claude 命令；07-22、09-05 两次"Lighten / Simplify host integration"；9-06 PR 只点名「Claude Code 获得完整 Dove 集成；DeepSeek Harness 获得 project-local filesystem Skills only」，Codex、Cursor、OpenCode 不再出现（提交里没有单独的删除记录） · 间接来源
- [05-03] 按宿主安装：中性核心和所选宿主的适配分开复制，doctor 检查装好的宿主入口 · 依据：提交 8fb4181「copy a neutral core separately from selected adapters, and make doctor validate installed host surfaces」 · 间接来源
- [05-04] 有界、在前台跑的科研推进流程，把目标规划、落地、审批、执行和持久运行状态串起来，不加隐藏调度器 · 依据：提交 ec1ed0d「bounded foreground research operating flow … without adding a hidden scheduler」 · 后来：单独的 operate 入口被"默认自主推进"取代；"不加隐藏后台"一直保留到 9-06（PR「不得新增…隐藏后台任务或无界队列」） · 间接来源
- [05-04] 运行入口接进 CLI 和治理登记，保证"调得到、可审计" · 依据：提交 6a24986「so the committed runtime surface is reachable and audited」 · 间接来源
- [05-04] 隔离的外部审稿交接：命令优先，冻结审稿输入，只导入明确的交接/报告文件，跨隔离边界核对输入哈希 · 依据：提交 d677337「freezes review input, imports only explicit handoff/report artifacts, and validates the input hash across the isolation boundary」 · 后来：发展成 9-06 的 `dove-review`；哈希在 09-05 3c0568c 改为只内部用（「Keep review hashes internal」） · 间接来源
- [05-04] 受 CodeStable 启发的生命周期路由 · 依据：提交 8cfcbfa「CodeStable-inspired lifecycle router」 · 后来：被统一 agent 取代（VP：Skill「不是…固定阶段」） · 间接来源
- [05-04] 只查不修的审计 · 依据：提交 8cfcbfa「no-fix audit」「inspect … without hidden mutation」 · 间接来源
- [05-04] 接入已有论文资产时先提方案，迁移时不暗中改动 · 依据：提交 8cfcbfa「proposal-first onboarding … migrate existing paper assets without hidden mutation」 · 间接来源
- [05-04] 角色层级 · 依据：提交 8cfcbfa「role hierarchy documentation」 · 后来：9-06 改为「一个 Dove…不靠不同人格制造分工」 · 间接来源
- [05-05] 改名 Dove，分步过渡，同时兼容 paper-factory、保留 `.paper` 根目录 · 依据：提交 106417e「Finish the staged Dove transition while preserving paper-factory compatibility」 · 间接来源
- [05-05] `.dove` 成为唯一事实来源，同时保留论文和工程两类工作流能力 · 依据：提交 b2c982b「so .dove is the single source of truth while preserving the paper and engineering workflow capabilities」 · 后来：9-06 文档没有单独的工程工作流，"实现方法"并入科研能力（VP） · 间接来源
- [05-06] 打包后保持宿主中立、只发布 Dove 自己的适配；计划和审批流程从论文专用路由提升为通用流程 · 依据：提交 e70b9f4「promoting shared plan and approval workflows out of paper-only routes」 · 后来：9-06 文档没有独立的计划/审批流程，计划只剩"中央实验先保存 plan 再执行"（PR） · 间接来源
- [05-06] 所有宿主的命令由同一份清单生成，各宿主保持一致 · 依据：提交 c35e947「Generate all host command adapters from one manifest」 · 间接来源
- [05-06] 文档地图：讲清 docs 的结构、哪些文件算权威 · 依据：提交 6e2edd7「so operators know which files are authoritative」 · 间接来源
- [05-07] 对外只呈现 Dove 这一个产品边界 · 依据：提交 c92bf0d「Present Dove as the public product boundary」 · 间接来源
- [05-07] Lessons 是手动的"归来仪式"、按手动节奏写 · 依据：提交 c92bf0d「make lessons a manual return ritual」；ecae19a「manual lesson rhythm」 · 后来：9-06 放宽为 Dove 在有复用价值时读写（RM「Dove 在它们可能启发当前或未来工作…时读取或维护它们」） · 间接来源
- [05-07] 被忽略的旧工作区文件不让 doctor 报不健康 · 依据：提交 c92bf0d「keep ignored legacy workspace artifacts from failing doctor health」 · 间接来源
- [05-07] README 讲清鸽子"出任务—归来"的隐喻和文件系统契约，照顾第一次读的人 · 依据：提交 ecae19a「Clarify Dove's mission-return metaphor, filesystem contract」 · 后来：Mission 作为"有范围的研究往返"保留到 9-06（RM） · 间接来源
- [05-11] 任务范围内的写入绑定到持久的任务包（task packet） · 依据：提交 343e13f「Bind task-scoped Dove writes to durable task packets」 · 后来：9-06 文档不再有 task packet，改为普通 Markdown · 间接来源
- [05-11] 图生成工作流 · 依据：提交 fa1cd77「Add Dove figure generation workflow」（仅标题） · 间接来源
- [05-12] 公共流程以任务为中心，status 以权威任务状态为准，让用户看到更干净可靠的项目看板 · 依据：提交 d1104e8「so operators see a cleaner, more reliable project dashboard」 · 间接来源
- [05-13] Mission 先提案，用户明确批准后才写任务包 · 依据：提交 8871b6c「task packets are only written after explicit operator approval」 · 后来：9-06 改为"围绕用户确认的目标、开放探索标为暂定"，并写明「承认事实上的否定不需要批准」（PR） · 间接来源
- [05-15] 日常的 mission、auto、status、operator 流程要更实用：收紧确认边界、任务定位和前台执行契约，改进 status 输出 · 依据：提交 f9f17d1「tightening confirmation boundaries, task targeting, foreground execution contracts」 · 后来：auto、operator 入口取消（9-06「没有单独 Auto Skill 或 Auto 命令」） · 间接来源
- [05-15] 输出本地化 · 依据：提交 f9f17d1「localization」 · 后来：9-06 文档没有再明说 · 间接来源
- [05-16] 生命周期变化有明确边界和交接，运行日志只追加；能续接前台工作，且不声称没有证据的进展 · 依据：提交 91ae567「append-only runtime logs so Dove can resume foreground work without claiming unevidenced progress」 · 间接来源
- [05-18] 每日主页和紧凑的行动卡，各流程都给出能执行的下一步，同时守住确认和证据边界 · 依据：提交 d5c8e25「Add daily home and compact action cards」 · 后来：9-06 文档不再提每日主页 · 间接来源
- [06-15] 命令结果给紧凑摘要、证据与交接指引、命令示例和输出样例，便于查看 · 依据：提交 381d9e3「Add compact result summaries, evidence and handoff guidance」 · 间接来源
- [06-17] 文档证据台账 · 依据：提交 6116057「Add Dove document evidence ledger」（仅标题） · 后来：9-06 不再要台账式记录（PR「不建立台账、缓存或 BibTeX parser」「不得要求…数据库式记录」） · 间接来源
- [06-19] 全局状态页：发布跨项目的脱敏状态索引，在前台经 Cloudflare 对外，只用密码保护 · 依据：提交 6503a88「sanitized global status index with foreground Cloudflare support and password-only page protection」 · 后来：9-06 FE 仍提到"状态页"，但只算支撑 · 间接来源
- [06-19] Claude Code 改用用户级 `/dove:*` 命令，项目里只留 `.dove/` 状态和受支持的项目适配 · 依据：提交 1e329ac「Claude Code now uses the user-level /dove:* command set」 · 间接来源
- [06-22] mission 完成状态前后一致 · 依据：提交 41005d0「Keep mission completion state consistent」 · 间接来源
- [06-22] 普通提问也先走"行动前指导"，按角色框架、参考 lessons 给出下一步，并守住前台边界 · 依据：提交 638540c「so ordinary prompts route through role-framed, lesson-aware next actions」 · 后来：09-05 3c0568c「retire prompt intake」，9-06 PR「`UserPromptSubmit`、隐藏 intake 和其替代每轮 hook 均已退休」，角色框架也被"一个 Dove"取代（两者是否对应是推断） · 间接来源
- [06-23] 测试和校验用的临时目录放在仓库里，不往根 /tmp 写，免得反复运行撑满磁盘 · 依据：提交 1077ab7「so repeated runs do not fill the root filesystem」 · 间接来源
- [06-24] 查目标会议/期刊相关来源时，把来源和笔记存进任务包，让普通科研提问产出可追溯的证据，而不是绕去做审稿式审计 · 依据：提交 7983d9c「produce traceable evidence instead of reviewer-audit detours」 · 间接来源
- [06-24] 没有真实的来源、笔记、草稿、经验和审稿循环材料就不记录产物；auto/operator 到宿主边界就明确停下，不造假进展 · 依据：提交 4363cc5「Require real source, note, draft, experience, and review-loop material … instead of fake progress」 · 间接来源
- [06-30] 要有可执行的工作流契约和收敛证据，只记真实进展，不做占位式状态更新 · 依据：提交 8027a73「Require executable workflow contracts and convergence evidence … instead of placeholder state updates」；e6ce777 重复 · 后来：9-06 改为「不新增科研模板或 gate」（PR） · 间接来源
- [07-01] 显式调用 gpt-image2 生成图，OpenAI 凭据走环境变量 · 依据：提交 e6ce777「explicit gpt-image2 figure generation through env-based OpenAI credentials」 · 后来：9-06 泛化为「方法图、概念图或视觉摘要可在合适时使用专门的图像生成模型」（PR） · 间接来源
- [07-03] 图、operator、status、回滚和审稿循环的行为，按自用中碰到的边界对齐 · 依据：提交 6eb0cd3「Align figure, operator, status, rollback, and review-loop behavior with dogfood boundaries」 · 后来：9-06 文档不再提回滚 · 间接来源
- [07-04] MCP 和 status 默认给紧凑、面向行动的结果，用户不用展开原始状态就能判断结果 · 依据：提交 10e151e「so operators can judge outcomes without expanding raw workflow state」 · 间接来源
- [07-05] status 默认只聚焦"一个需要人来做的下一步"，完整/调试细节要显式展开 · 依据：提交 bea564f「focus on one human next action while preserving explicit full/debug detail」 · 间接来源
- [07-05] 图质检只针对当前这张图；生成的 SVG 源和最终目标路径分开，外部生成或手动导入时不会混淆输入和输出 · 依据：提交 95a18b0「split generated SVG source paths from canonical final targets」 · 后来：9-06 文档不再提这一层 · 间接来源
- [07-07] 每日 status、图流程、MCP 结果和生成的宿主适配都说用户能照着做的话，内部细节只放在展开模式里 · 依据：提交 0672e0c「speak in actionable user-facing language while keeping internals available only through expanded modes」；8f445f3 重复 · 间接来源
- [07-09] 重构 mission 交接的含义 · 依据：提交 4e25eef「Refactor Dove mission handoff semantics」（仅标题） · 间接来源
- [07-10~07-16] 一连串加固：真实进展流程、执行与证据的完整性、记录归属与授权、可信执行边界、Schema 8 完整性 · 依据：提交 2810c27「Harden Dove real-progress workflows」；a436b00、f813bb1、82b4119、ced6af2、7fbf1ca、2087d59（均仅标题） · 间接来源
- [07-15] 重心放回 mission 证据的真实完整 · 依据：提交 59acca6「Refocus Dove on mission evidence integrity」（仅标题） · 间接来源
- [07-22] 宿主集成变轻：统一工作区路径，日常流程走薄 MCP 层，mission 续接和证据闭合聚焦宿主上的真实工作；项目级 MCP 安装和 doctor 检查更严格 · 依据：提交 3b13df9「keep mission continuation and evidence closure focused on real host work」 · 间接来源
- [08-01] 切换到 Schema 18 架构，08-09 再统一到 Research Format 1 · 依据：提交 eb12134「Complete Dove Schema 18 architecture cutover」；cca897e「Complete Dove Research Format 1 convergence」（均仅标题） · 后来：被普通 Markdown 研究记录取代（f5b1019；PR「不得要求固定 headings、frontmatter、generated IDs…」） · 间接来源
- [08-12] 研究记录改为 Markdown 架构，08-16 工作流随之简化 · 依据：提交 f5b1019「Complete Dove Markdown research architecture」；e1042ad「Complete Dove Markdown workflow simplification」（均仅标题） · 间接来源
- [08-16] 反馈按明确引用来分派 · 依据：提交 c8ebee6「Route Dove feedback by explicit reference」（仅标题，"反馈"指什么没写） · 间接来源
- [08-20] Dove 成为一个统一的科研 agent · 依据：提交 a6bb20a「Make Dove a unified research agent」（仅标题） · 后来：取代此前的工作流包、角色和路由（VP「Dove 是一个完整科研 Agent」） · 间接来源
- [08-25] 包资源和项目内容分开，支持安全卸载 · 依据：提交 aeea8d8「Separate Dove package resources and add safe uninstall」（仅标题） · 后来：9-06 PR 要求卸载保留 research/reviews/runs · 间接来源
- [08-27] 自主科研的审稿循环 · 依据：提交 a003300「Complete Dove autonomous research review loop」（仅标题） · 间接来源
- [08-29] 自主科研成为 Dove 的默认行为 · 依据：提交 906f9ab「Make autonomous research Dove's default」（仅标题） · 后来：9-06 VP「自主多轮是 Dove 的默认科研行为…没有单独 Auto Skill 或 Auto 命令」 · 间接来源
- [08-30] 细化科研续接的含义 · 依据：提交 21f2f1e「Refine Dove research continuation semantics」（仅标题） · 间接来源
- [09-03] 科研执行流程 · 依据：提交 198c2e0「Complete Dove research execution workflows」（仅标题） · 间接来源
- [09-03] 运行超时时状态要说清楚 · 依据：提交 1683e67「Clarify Dove run timeout status」（仅标题） · 后来：9-06 RM 写明超时只是中断、不是研究完成 · 间接来源
- [09-05] 共享的科研判断与"作者""审稿"两种立场分开 · 依据：提交 3c0568c「Separate shared research judgment from author and reviewer stances」 · 间接来源
- [09-05] 退休每轮的 prompt intake · 依据：提交 3c0568c「retire prompt intake」 · 间接来源
- [09-05] 不再接管 statusline（提交记录里 statusline 第一次出现就是退休） · 依据：提交 3c0568c「retire … statusline ownership」 · 间接来源
- [09-05] 集成更新尊重本地修改 · 依据：提交 3c0568c「make integration updates respect local edits」 · 后来：9-06 细化为显式 update 覆盖并提醒、SessionStart 跳过并提醒（PR） · 间接来源
- [09-05] 审稿哈希只在内部用；运行记录只留最少的事实 · 依据：提交 3c0568c「Keep review hashes internal, minimize run facts」 · 间接来源
- [09-05] compact/resume 时提供元数据 · 依据：提交 3c0568c「add compact/resume metadata」 · 后来：9-06 定为只读事实卡 · 间接来源
- [09-05] 给 Dove 的对外行为做评测并留证据 · 依据：提交 3c0568c「public behavior evaluation evidence」；918d83f「strengthen public behavior evidence capture」 · 间接来源
- [09-05] 共享科研判断接到所有宿主入口，补齐能力和运行缺口 · 依据：提交 918d83f「Wire shared research judgment through host entrypoints, close capability and runtime gaps」 · 间接来源
- [09-06] 更早给出科学判断 · 依据：提交 362e794「earlier scientific judgment」 · 间接来源
- [09-06] 讲清评价是否有效、消融能否归因、作者侧怎样综合证据 · 依据：提交 362e794「Clarify evaluation validity, ablation attribution, and author-side evidence synthesis」 · 间接来源
- [09-06] 减少重复提示 · 依据：提交 362e794「reducing repeated prompts」 · 间接来源
- [09-06] 集成诊断只读 · 依据：提交 362e794「Improve read-only integration diagnostics」 · 间接来源
- 未单列的提交：8d9f164、f3edc89、e165083、5a17760、41be379（各 phase 的架构、语义文档）；be75b56（清理旧 Paper Factory 命名残留）；5127314、c3a2169（status 渲染、主页同步的修复）；d5fe222（CLI 和发布整理）。其余重复提交已并进上面对应的行 · 间接来源

---

## 2. 9 月 6 日设计文档里的要求

四份文档大量互相重复。每条要求只在它**最早出现**的文件下列一次，用"亦见"标出还在哪些文件里出现；"仅见本文件"的多是低调的细则。后面的文件只列新增或明显细化的要求，组末一行列出它重复了哪些前文条目。

### VISION_AND_PRINCIPLES.md（VP）

- Dove 要能做完整的科研：理解问题、查来源、比较解释、设计和分析实验、实现方法、写作、画图、审查研究、回应批评 · 依据：VISION_AND_PRINCIPLES.md「用户说明研究目标后，Dove 应能理解问题、查阅来源、比较解释、设计和分析实验、实现方法、写作、画图、审查研究并回应批评」 · 亦见 FE · 间接来源
- Skill 只是按需用的专项方法，不是人格、固定阶段，也不是要用户手动协调的工作流 · 依据：VISION_AND_PRINCIPLES.md「不是不同人格、固定阶段或需要用户手动协调的工作流」 · 亦见 PR、RM · 间接来源
- 只有一个 Dove，共享同一套科研判断，不靠不同人格分工 · 依据：VISION_AND_PRINCIPLES.md「共享同一套科研判断，不靠不同人格制造分工」 · 亦见 PR、FE、RM · 间接来源
- 作者主会话负责持续主线和用户决策；有界的独立调查可以交给隔离的 Dove 子代理 · 依据：VISION_AND_PRINCIPLES.md「作者主会话负责持续主线与用户决策，有界独立调查可以交给隔离的 Dove subagent」 · 亦见 PR、FE、RM · 间接来源
- `dove-review` 是同一个研究者站到隔离的审稿位置上质疑论文，不继承作者主线，也不替作者修改 · 依据：VISION_AND_PRINCIPLES.md「不继承作者主线，也不替作者修订」 · 亦见 PR、FE、RM · 间接来源
- 围绕用户确认的目标行动；开放探索可以先从暂定的问题/路线开始；方向、范围或完成含义要变时，必须请用户确认 · 依据：VISION_AND_PRINCIPLES.md「方向、范围或完成含义要改变时必须请用户确认」 · 亦见 PR、RM · 间接来源
- 默认自主多轮推进：只要还有可靠的行动能改变或保护判断，就继续；没有单独的 Auto Skill 或 Auto 命令 · 依据：VISION_AND_PRINCIPLES.md「只要仍有可靠行动可以改变或保护判断，Dove 就继续」 · 亦见 PR、FE、RM · 间接来源
- 行动高于展示：主要产出是更清楚的判断、真实证据、实验和分析，以及改好的代码、稿件、图和交付物，不是更多文档或状态报告 · 依据：VISION_AND_PRINCIPLES.md「而不是更多文档或状态报告」 · 亦见 PR、FE · 间接来源
- 事实、引用、实验数字、方法描述和稿件主张都来自实际检查过的材料；写作和修订不能悄悄加强或减弱主张 · 依据：VISION_AND_PRINCIPLES.md「写作和修订不能静默强化或弱化主张」 · 亦见 PR、FE、RM · 间接来源
- 先解决高层问题：贡献、机制、新颖性、定位 → 方法、证据、实验分析、baseline、失败分析 → 论证、写作、图 → 交付放最后 · 依据：VISION_AND_PRINCIPLES.md「高层问题先行…delivery 最后」 · 亦见 FE、RM · 间接来源
- 公共概念保持简单：复杂性体现在判断质量里，不暴露为更多模式、角色、命令和模板 · 依据：VISION_AND_PRINCIPLES.md「而不是暴露为更多模式、角色、命令和模板」 · 仅见本文件 · 间接来源
- 先弄清真实问题、压力来源、关键不确定性、要改变的决策和完成含义 · 依据：VISION_AND_PRINCIPLES.md「压力来源、关键不确定性、要改变的决策和完成含义」 · 亦见 FE、RM · 间接来源
- 会影响行动的歧义先澄清，并说明答案会怎样改变下一步 · 依据：VISION_AND_PRINCIPLES.md「并说明答案如何改变下一步」 · 亦见 PR（列出意图、目标产物、评价标准、范围、关键取舍）、FE、RM · 间接来源
- 把文献当创新燃料：共识说明默认约束，矛盾暴露突破口，未验证的假设是可检验的入口，可迁移的机制给出新路线，没人探索过的条件范围可能就是贡献 · 依据：VISION_AND_PRINCIPLES.md「文献是创新燃料」 · 亦见 FE、RM · 间接来源
- 可以借数学、物理、相邻领域机制和跨领域类比形成高层直觉，但验证前只算候选假设 · 依据：VISION_AND_PRINCIPLES.md「在验证前只是候选假设」 · 亦见 FE（"主动借用"）、RM · 间接来源
- 好路线要足以支撑核心主张、给出可区分的预测；实验、来源、理论、实现和图都服务于区分候选解释、改善证据或保护关键产物 · 依据：VISION_AND_PRINCIPLES.md「好的路线应足以支撑核心主张并产生可区分预测」 · 亦见 FE、RM · 间接来源
- 论文要有一根"脊柱"：问题、机制、证据、核心主张、图表、局限和面向目标会议的贡献互相支撑 · 依据：VISION_AND_PRINCIPLES.md「论文工作维护 paper spine」 · 亦见 RM · 间接来源
- 保持用户当前的权威稿件格式，遵守目标会议的实际要求；新稿只在会议接受 LaTeX 时才默认用 LaTeX，并检查实际编译产物 · 依据：VISION_AND_PRINCIPLES.md「新稿仅在 venue 接受 LaTeX 时默认使用 LaTeX 源并检查实际编译产物」 · 亦见 PR、FE、RM · 间接来源
- 作者侧的科学自检有价值，但不算独立的外部评价 · 依据：VISION_AND_PRINCIPLES.md「作者侧科学自检有价值，但不是独立外部评价」 · 亦见 PR、FE、RM · 间接来源
- `dove-review` 用于近投稿论文：作者侧冻结完整论文、编译产物、补充材料和其他随投稿提交的文件，隔离审稿只看这些，意见回到作者侧去分析、回应或修改 · 依据：VISION_AND_PRINCIPLES.md「隔离 reviewer 只审查这些材料，并把意见返回给作者侧分析、回应或修订」 · 亦见 PR、FE、RM · 间接来源
- 文档分工：`.dove/research/` 放项目的研究上下文，`.trellis/spec/` 放实现规范，实现和生成文件落实行为 · 依据：VISION_AND_PRINCIPLES.md「`.trellis/spec/` 保存实现规范」 · 仅见本文件提到 Trellis 规范目录 · 间接来源
- 开发文档只帮助稳定产品含义，不能代替真实研究、作者判断、独立审稿、实际交付或软件检查 · 依据：VISION_AND_PRINCIPLES.md「不替代真实研究、作者判断、独立 `dove-review`、实际交付或软件检查」 · 间接来源

### PRODUCT_REQUIREMENTS.md（PR）

- 实现不能拿文档数量、工具调用次数、测试通过或固定的工作外观来代替研究判断 · 依据：PRODUCT_REQUIREMENTS.md「而不是以文档数量、工具调用次数、测试通过或固定工作外观替代研究判断」 · 间接来源
- 普通 Claude 会话靠项目 rule 共享科研判断；`claude --agent dove` 启动作者主会话 · 依据：PRODUCT_REQUIREMENTS.md「普通 Claude rule 共享科研判断，`claude --agent dove` 启动作者主会话」 · 亦见 FE、RM · 间接来源
- 需要完整对话、重要用户澄清或持续主线责任的工作，不能委派给子代理 · 依据：PRODUCT_REQUIREMENTS.md「需要完整对话、重要用户澄清或持续主线责任的工作不得委派」 · 亦见 FE、RM · 间接来源
- 公开 Skill 固定为九个：research、status、source、experiment、draft、figure、review、rebuttal、lessons · 依据：PRODUCT_REQUIREMENTS.md「九个公开 Skills 保持为」 · 亦见 FE（"平级入口"）、RM · 间接来源
- 不得新增 Auto Skill、Auto 命令、隐藏后台任务或无界队列 · 依据：PRODUCT_REQUIREMENTS.md「不得新增 Auto Skill、Auto command、隐藏后台任务或无界队列」 · 亦见 FE、RM · 间接来源
- Claude Code 获得完整集成；DeepSeek Harness 只获得项目内文件形式的 Skills · 依据：PRODUCT_REQUIREMENTS.md「DeepSeek Harness 获得 project-local filesystem Skills only」 · 仅见本文件 · 间接来源
- 改变贡献定义也要用户参与决策（与目标、范围、完成含义并列） · 依据：PRODUCT_REQUIREMENTS.md「改变目标、贡献定义、范围或完成含义需要用户参与决策」 · 间接来源
- 承诺或实质改变重要路线、方法、假设、评价目标或中央实验之前，先说清核心命题、前提、简单的替代解释和能区分它们的结果 · 依据：PRODUCT_REQUIREMENTS.md「明确核心命题、前提、简单替代解释和可区分结果」 · 亦见 FE、RM · 间接来源
- 按需用推导、反例或小诊断来确认或修订方法、baseline、指标和投入决定，但不设固定的理论开场 · 依据：PRODUCT_REQUIREMENTS.md「不设固定理论开场」 · 亦见 FE、RM · 间接来源
- 外部知识可能改变判断时，有针对性地去查 · 依据：PRODUCT_REQUIREMENTS.md「外部知识可能改变判断时定向查阅」 · 亦见 RM · 间接来源
- 查过的证据在条件仍成立时复用；只有实质变化、矛盾或与决策有关的缺口才补查 · 依据：PRODUCT_REQUIREMENTS.md「已检查证据只在条件仍成立时复用，仅为实质变化、矛盾或决策相关缺口补查」 · 亦见 FE、RM · 间接来源
- 委派回来后，由掌握完整用户上下文的主会话综合决定性证据、子任务范围、没验证的边界和矛盾 · 依据：PRODUCT_REQUIREMENTS.md「由持有完整用户上下文的主会话综合决定性证据、子任务范围、未验证边界和矛盾」 · 亦见 FE、RM · 间接来源
- 子代理完成、检查通过或多数意见都不能代替判断；主会话也不必把子任务全部重做 · 依据：PRODUCT_REQUIREMENTS.md「代理完成、检查通过或多数意见不替代判断，也不要求重做全部子任务」 · 亦见 FE（加上"报告拼接"）、RM · 间接来源
- 结果分四种：支持、反驳、证据不足、当前对照无法识别 · 依据：PRODUCT_REQUIREMENTS.md「区分支持、反驳、证据不足和当前对照无法识别」 · 亦见 FE、RM · 间接来源
- 不能靠无限补查推迟接受反证；新方向成功不能抹掉原命题的失败 · 依据：PRODUCT_REQUIREMENTS.md「新方向成功不得覆盖原命题失败」 · 亦见 FE、RM · 间接来源
- 承认事实上的否定不需要批准；只有改变确认过的主线或完成含义才要用户决定 · 依据：PRODUCT_REQUIREMENTS.md「承认事实上的否定不需要批准」 · 亦见 FE、RM · 间接来源
- 选行动要比较科研价值、结果质量、总时间、资源、机会成本、返工风险和后续影响，不机械地挑最近或最容易的 · 依据：PRODUCT_REQUIREMENTS.md「而不是机械选择最近或最容易的动作」 · 亦见 FE、RM · 间接来源
- 收窄主张之前，先比较可行的补证据行动；确实要改主张时，说明是证据还是现实条件逼的 · 依据：PRODUCT_REQUIREMENTS.md「收窄主张前先比较可行的补证据行动」 · 仅见本文件 · 间接来源
- 持续推进只能停在这几种情况：目标已达到；实质调查确认没有有效路径；下一步需要用户决策、权限、高成本或破坏性动作、对外发布，或碰到明确的外部限制 · 依据：PRODUCT_REQUIREMENTS.md「持续推进只能停止于」 · 亦见 FE、RM · 间接来源
- 有界的局部任务可以完成，但不能说成整体研究完成，除非它真的改变了重要判断、关键证据、关键产物或下一步决策 · 依据：PRODUCT_REQUIREMENTS.md「不得表述为整体研究完成」 · 亦见 FE、RM · 间接来源
- `.dove/research/**` 是研究者自己拥有的普通 Markdown · 依据：PRODUCT_REQUIREMENTS.md「普通 researcher-owned Markdown」 · 亦见 RM · 间接来源
- 研究目录不存在时，init 只建一个最小的 `RESEARCH.md`；已有目录哪怕缺概览也不动；输出要分清哪些是新建、哪些是保留 · 依据：PRODUCT_REQUIREMENTS.md「已有目录即使缺少 overview 也保持不变，输出必须区分实际创建与保留」 · 仅见本文件 · 间接来源
- Mission、Source、Experiment、Review、Claim、Lesson 文档按需出现 · 依据：PRODUCT_REQUIREMENTS.md「Mission、Source、Experiment、Review、Claim 和 Lesson documents 按需出现」 · 仅见本文件 · 间接来源
- 研究记录不得要求固定标题、frontmatter、自动生成的 ID、存下来的计数、研究哈希、机器索引或数据库式记录 · 依据：PRODUCT_REQUIREMENTS.md「不得要求固定 headings、frontmatter、generated IDs、stored counts、research hashes、machine index 或数据库式记录」 · 亦见 RM（部分） · 间接来源
- update、SessionStart 同步、重装和卸载都必须保留已有的 research、reviews、runs 内容 · 依据：PRODUCT_REQUIREMENTS.md「必须保留现有 `.dove/research/**`、`.dove/reviews/**` 和 `.dove/runs/**` 内容」 · 亦见 FE（"两者不改研究记录"） · 间接来源
- 不安装 UserPromptSubmit 或别的每轮 hook；旧的 Dove UserPromptSubmit 只能精确退休，不碰用户或 Trellis 的其他 prompt hook · 依据：PRODUCT_REQUIREMENTS.md「不得触碰用户/Trellis 其他 prompt hooks」 · 亦见 FE · 间接来源
- 研究 Markdown 只在用户要求、重要结论/决策/优先级改变，或确实有助于保存证据和后续恢复时才写；Lessons 门槛更宽，看可复用价值 · 依据：PRODUCT_REQUIREMENTS.md「研究 Markdown 只在用户要求、重要结论/决策/优先级改变，或对保存证据和后续恢复确实有用时维护」 · 亦见 RM · 间接来源
- 可以用普通相对链接和项目内路径指向真实材料，但不加链接解析器、反向链接审计、一致性矩阵或数据库式检查 · 依据：PRODUCT_REQUIREMENTS.md「不得新增 link parser、backlink audit、一致性矩阵或数据库式一致性检查」 · 亦见 RM · 间接来源
- 来源要分清"找到了""取到了""读过了""真正用上了" · 依据：PRODUCT_REQUIREMENTS.md「区分 material found、retrieved、inspected 和 used」 · 亦见 RM · 间接来源
- 引用身份对不对、它支不支持主张，分开判断 · 依据：PRODUCT_REQUIREMENTS.md「Citation identity 与 claim support 必须分开判断」 · 亦见 RM · 间接来源
- 可以对用户指定的条目做有界的 DOI 身份核验，能直接查询时优先于模糊标题匹配；不建台账、缓存或 BibTeX 解析器；身份核验不等于读过全文或支持主张 · 依据：PRODUCT_REQUIREMENTS.md「不建立台账、缓存或 BibTeX parser。身份核验不等于读过全文或支持主张」 · 亦见 FE、RM · 间接来源
- 复合主张要逐部分区分来源支持、矛盾和没覆盖的部分，不能拿部分支持当整体支持 · 依据：PRODUCT_REQUIREMENTS.md「不能以部分支持代替整体支持」 · 亦见 RM · 间接来源
- 只做核验时报告边界，不自动改稿或改研究目标 · 依据：PRODUCT_REQUIREMENTS.md「仅核验时报告边界，不自动修改稿件或研究目标」 · 亦见 RM · 间接来源
- 普通来源检查与问题规模相称；明确要求系统综述、荟萃分析、证据分级或可审计综合时，用该领域合适的结构化方法 · 依据：PRODUCT_REQUIREMENTS.md「显式 systematic review、meta-analysis、evidence grading 或 auditable synthesis 请求应使用适合领域的结构化方法」 · 亦见 RM · 间接来源
- 搜索、读论文、读网页的能力按安装文档配置；缺工具或权限时要说出来，并用手头仍然有用的材料继续判断 · 依据：PRODUCT_REQUIREMENTS.md「缺失工具或权限时必须说明，并使用仍能帮助判断的可用材料」 · 仅见本文件 · 间接来源
- 实验要分清：只做设计、按请求执行、分析已有结果、事后记录、小规模实验、诊断工作 · 依据：PRODUCT_REQUIREMENTS.md「区分 design-only、requested execution、existing-result analysis、retrospective recording、小规模实验和 diagnostic work」 · 亦见 RM · 间接来源
- 中央实验要说清它解决什么不确定性、比较哪些替代解释、什么结果算有用 · 依据：PRODUCT_REQUIREMENTS.md「中央实验需要清楚说明它要解决什么不确定性、比较什么替代解释、什么结果算有用」 · 亦见 RM · 间接来源
- 方法、配置、数据、指标、运行次数和结果数字，都来自实际代码、配置、日志、输出、数据文件或用户材料 · 依据：PRODUCT_REQUIREMENTS.md「运行次数和结果数字必须来自实际代码、配置、日志、输出、数据文件或用户材料」 · 亦见 RM · 间接来源
- 异常、反常、不稳定、复现不了或好得反常的结果，先查实现、数据/预处理、配置/环境、随机性、指标、baseline 和分析错误，再做科学解释 · 依据：PRODUCT_REQUIREMENTS.md「异常、反常、不稳定、无法复现或异常优异结果先排查…再进入科学解释」 · 亦见 RM · 间接来源
- 评价链要从实际输入、输出、评价依据和指标一路追到比较，检查参照或代理指标是否适用 · 依据：PRODUCT_REQUIREMENTS.md「评价链须从实际输入、输出、评价依据和指标追溯到比较，检查 reference/proxy 适用性」 · 亦见 FE、RM · 间接来源
- 失败和被排除的样本怎样计入分母，要说清 · 依据：PRODUCT_REQUIREMENTS.md「失败与排除的分母处理」 · 亦见 RM（更细） · 间接来源
- 适用时检查配对、不确定性、相关性和最终测试集的独立性 · 依据：PRODUCT_REQUIREMENTS.md「适用的配对、不确定性、相关性和最终测试独立性」 · 亦见 RM（更细） · 间接来源
- 消融按实际代码、配置和输出找混杂，分清"整套实现更好""组件有增益""机制得到支持"三种结论 · 依据：PRODUCT_REQUIREMENTS.md「区分整套实现、组件增益与机制证据」 · 亦见 FE、RM · 间接来源
- 识别不了贡献时，修最小必要的对照或收窄结论，不用多跑几次来代替 · 依据：PRODUCT_REQUIREMENTS.md「无法识别贡献时修最小必要对照或限定结论，不以更多运行替代」 · 亦见 FE、RM · 间接来源
- 最小的代表性诊断只在必要且获准时做；小样本证明不了总体统计上够用 · 依据：PRODUCT_REQUIREMENTS.md「最小代表性诊断只在必要且获准时执行，小样本不证明总体统计充分性」 · 亦见 FE、RM · 间接来源
- 只做设计时只读追溯，交付方案和没验证的部分，不自行升级成执行 · 依据：PRODUCT_REQUIREMENTS.md「design-only 只读追溯并交付方案和未验证部分，不升级执行」 · 亦见 FE、RM · 间接来源
- 已有结果直接分析；事后记录不能装成事前计划 · 依据：PRODUCT_REQUIREMENTS.md「事后记录不伪装成事前计划」 · 亦见 RM · 间接来源
- 新授权、需要记录的中央实验：先成功保存计划再执行，把实际结果和影响解释的偏差追加到同一份实验文档 · 依据：PRODUCT_REQUIREMENTS.md「新授权且需要记录的中央实验必须先成功保存 plan，再执行并把实际结果与影响解释的偏差追加到同一 Experiment document」 · 亦见 RM · 间接来源
- 这些实验判断不新增科研模板或关卡（gate） · 依据：PRODUCT_REQUIREMENTS.md「不新增科研模板或 gate」 · 亦见 FE、RM（加上"记录表"） · 间接来源
- Draft 从实际证据编辑普通文本和产物，守住论文的核心论证和主张含义 · 依据：PRODUCT_REQUIREMENTS.md「Draft 必须从实际证据编辑普通项目文本和产物，维护论文的核心论证与主张含义」 · 亦见 RM · 间接来源
- 润色不能悄悄改变确定性、因果性、适用范围、普遍性、定量限定或新颖性；证据或用户决定要求改时，先说明改了什么、依据是什么 · 依据：PRODUCT_REQUIREMENTS.md「证据或用户决定要求改变时先说明改变和依据」 · 亦见 RM · 间接来源
- 作者风格只从可靠样本或确认过的作者文本里校准，并让位于科学准确和投稿规范 · 依据：PRODUCT_REQUIREMENTS.md「作者风格只能从可靠样本或已确认作者文本中校准」 · 亦见 RM · 间接来源
- Figure 覆盖真实绘图、重画、生成、修订、检查和图注；从这张图在论文里承担的证据或解释任务出发，检查数据、选择依据、视觉素材、绘制逻辑、图注、旁边的主张和实际版面 · 依据：PRODUCT_REQUIREMENTS.md「从图在论文中承担的证据或解释任务出发」 · 亦见 RM · 间接来源
- 定量图用真实数据和可复现的绘图；方法图、概念图、视觉摘要可以在合适时用专门的图像生成模型 · 依据：PRODUCT_REQUIREMENTS.md「定量图必须使用真实数据和可复现绘图」 · 亦见 RM · 间接来源
- 重要的图要放进真实稿件版面、按接近最终的尺寸检查，单看图片预览不够 · 依据：PRODUCT_REQUIREMENTS.md「单独图片预览不足以证明它能支撑稿件」 · 仅见本文件（RM 只提"实际稿件布局"） · 间接来源
- Review 支持五种操作：作者侧自检、交付检查、`dove-review` 交接、导入返回的审稿、检查审稿上下文 · 依据：PRODUCT_REQUIREMENTS.md「Review 必须支持五种操作」 · 亦见 RM · 间接来源
- 作者侧自检是当前作者上下文里的只读判断，不能自称独立外部评价 · 依据：PRODUCT_REQUIREMENTS.md「不能声称独立外部评价」 · 亦见 RM · 间接来源
- 全文或近投稿的自检要查：方法是否回答问题、领域机制和文献对不对、贡献和证据配不配得上目标会议、最强的知情读者反对意见，以及引用支持、主张含义变化、没有材料撑着的事实、异常结果的执行是否有效 · 依据：PRODUCT_REQUIREMENTS.md「最强的知情读者反对意见，以及引用支持、主张含义变化、未由材料支持的事实和异常结果的执行有效性」 · 亦见 FE、RM · 间接来源
- 只有真正存在隔离、持久、可恢复的审稿上下文时，`dove-review` 才能算独立外部评价 · 依据：PRODUCT_REQUIREMENTS.md「只能在存在真实隔离、持久、可恢复审稿上下文时作为独立外部评价路径使用」 · 仅见本文件 · 间接来源
- 审稿交接基于冻结的近投稿材料：完整论文、当前格式的权威源、实际构建或导出的产物、实际附录或补充材料、其他随投稿提交的文件；不强迫转成 LaTeX · 依据：PRODUCT_REQUIREMENTS.md「不强迫已有稿件转换为 LaTeX」 · 亦见 FE、RM · 间接来源
- 审稿每轮只拿到所列冻结文件的副本和 Read：不联网、不用 MCP、看不到作者的私有对话和未列文件；需要的投稿规则和文献由作者侧先取得并列进交接，缺了就限定判断 · 依据：PRODUCT_REQUIREMENTS.md「每轮只提供所列冻结文件副本和 Read；没有联网、MCP、作者私有对话或未列文件访问」 · 亦见 FE、RM · 间接来源
- 同一个审稿会话可以保留自己的审稿历史，但不会自动拿到作者侧的旧 Review 文件 · 依据：PRODUCT_REQUIREMENTS.md「同一会话可保留自身审稿历史，但不自动取得作者侧旧 Review 文件」 · 亦见 FE、RM · 间接来源
- 全文审稿回答四个问题（方法是否回答问题、领域判断对不对、贡献和证据是否适合目标会议、最强的合理反对意见及需要什么证据或修改），返回用 Verdict、Blocking issues、Grounding basis、Author-side next actions 四个标题，不解析成机器验收门槛 · 依据：PRODUCT_REQUIREMENTS.md「不得解析成机器接受门槛」 · 亦见 FE、RM · 间接来源
- 审稿 SHA 只做内部字节核对，不出现在给人看的输出、CLI JSON 和科研表述里，也不能拿哈希证明科学结论 · 依据：PRODUCT_REQUIREMENTS.md「不以哈希证明科学结论」 · 亦见 RM · 间接来源
- 导入返回的审稿时如实保存，不自动开始回应、修改、外部搜索或收窄主张 · 依据：PRODUCT_REQUIREMENTS.md「导入返回审稿时必须忠实保存实际返回，不自动开始作者回应、修订、外部搜索或缩小主张」 · 仅见本文件（FE、RM 有相近的"不照单修改"） · 间接来源
- Rebuttal 留在作者侧：分析意见，找出需要的证据、行动和修改，写回复，并按请求改稿件、图、补充材料、亮点或其他投稿文件 · 依据：PRODUCT_REQUIREMENTS.md「Rebuttal 保持作者侧」 · 亦见 RM · 间接来源
- 新加的引用分别查来源身份和对主张的支持；新的实验解释来自实际实验材料 · 依据：PRODUCT_REQUIREMENTS.md「新引用必须分别检查来源身份和对主张的支持；新实验解释必须来自实际实验材料」 · 仅见本文件 · 间接来源
- Dove 要认得清当前工作的源码、证据基础、构建链和最终交付物 · 依据：PRODUCT_REQUIREMENTS.md「Dove 必须识别当前工作的源码、证据基础、构建链和最终交付物」 · 仅见本文件 · 间接来源
- 投稿完成要求同一个当前完整版本同时满足三条：作者侧按完整研究判断科学上已充分；`dove-review` 按目标会议的真实标准判断科学上可接受；实际提交物满足交付要求 · 依据：PRODUCT_REQUIREMENTS.md「用户确认的投稿完成目标要求同一当前完整版本同时满足」 · 亦见 FE、RM · 间接来源
- 独立审稿不可用时不降低标准；局部审查、改图或润色的完成不自动升级为投稿完成 · 依据：PRODUCT_REQUIREMENTS.md「独立审稿不可用不降低该标准」 · 亦见 FE、RM · 间接来源
- 旧判断、局部完成、构建成功、格式完整、检查通过、安装事实或研究 Markdown 更新，都不能单独证明投稿就绪 · 依据：PRODUCT_REQUIREMENTS.md「不能单独证明投稿就绪」 · 亦见 FE、RM · 间接来源
- 显式 update 会覆盖 Dove 自己管理的集成文件里的本地修改，并在输出和 `replacedLocalEdits` 里提醒；不覆盖用户自己的文件或无关配置 · 依据：PRODUCT_REQUIREMENTS.md「在人类输出及 `replacedLocalEdits` JSON 中提醒；不覆盖用户自有文件或无关配置」 · 亦见 FE · 间接来源
- SessionStart 跳过有本地修改的文件，其余安全同步照做，并用 systemMessage 提醒；磁盘更新不等于当前会话已重新加载 · 依据：PRODUCT_REQUIREMENTS.md「磁盘更新不等于当前会话重新加载」 · 亦见 FE · 间接来源
- 不再安装或管理 statusLine，旧 helper 只留给用户自己组合；退休时保留用户改过的版本和无关配置 · 依据：PRODUCT_REQUIREMENTS.md「`statusLine` 不再安装或管理」 · 亦见 FE · 间接来源
- compact/resume 只给只读事实卡：RESEARCH.md 是否存在及修改时间；最新 Review 的 id、轮次、更新时间和材料是否最新；最新 Run 的 id、开始时间、状态和退出码；缺失或读不到就写 unavailable · 依据：PRODUCT_REQUIREMENTS.md「compact/resume 只提供只读事实卡」 · 亦见 FE、RM · 间接来源
- 事实卡不读研究 Markdown 正文、报告或日志，不推断主线；startup/clear 不给研究卡 · 依据：PRODUCT_REQUIREMENTS.md「不读研究 Markdown 正文、report 或 stdout/stderr logs，不推断主线；startup/clear 无研究卡」 · 亦见 FE、RM · 间接来源
- 审稿工作区用短路径，不嵌入项目的目录层级；路径本身证明不了隔离 · 依据：PRODUCT_REQUIREMENTS.md「Reviewer workspace 使用短路径…路径本身不证明隔离行为」 · 仅见本文件 · 间接来源
- Run 收据只留命令、时间、结果、指标、比较依据，以及显式 seed 和 Git commit/dirty 这些最低事实，不扩成环境清单 · 依据：PRODUCT_REQUIREMENTS.md「不扩展为环境分类清单」 · 亦见 FE · 间接来源
- Git 信息不改变能不能比较、怎么排名；机器比较代替不了科学上的可比性判断 · 依据：PRODUCT_REQUIREMENTS.md「Git 不改变比较资格或排名；机器比较不替代科学可比性判断」 · 亦见 FE · 间接来源
- 预算是资源取舍和比较的依据，不是预付额度，也不自动变成运行时的硬上限；实际执行仍守用户明确的限制、权限和显式超时 · 依据：PRODUCT_REQUIREMENTS.md「预算是资源判断和运行比较依据，不是预付额度」 · 亦见 RM · 间接来源
- 公共文档、实现和生成文件要和研究模型一致 · 依据：PRODUCT_REQUIREMENTS.md「公共文档、实现和生成文件必须与 [研究模型](RESEARCH_MODEL.md) 一致」 · 亦见 RM · 间接来源
- 普通会话靠项目 rule 共享判断，不靠每轮 hook 注入或分类；rule 不是授权机制，也不另建一套研究状态 · 依据：PRODUCT_REQUIREMENTS.md「rule 不是授权机制，也不创建另一套研究状态」 · 亦见 FE · 间接来源
- status 必须只读 · 依据：PRODUCT_REQUIREMENTS.md「`status` 必须只读」 · 亦见 RM · 间接来源
- 软件检查只保护实现和发布行为，不能说成科学正确、研究完成、可复现、被接收、通过独立审稿或 Dove 研究质量的证明 · 依据：PRODUCT_REQUIREMENTS.md「不得把检查结果表述为科学正确、研究完成、可复现性、接收、独立审稿或 Dove 研究质量证明」 · 亦见 FE、RM · 间接来源
- （本文件还重复了前面已列的，不再单列）Skill 不是人格、阶段或工作流；围绕确认目标行动；歧义先反问（细化为意图、目标产物、评价标准、范围、关键取舍）；开放探索必须明确标为暂定；事实、方法、结果来自实际材料；隔离审稿不继承主线、不替作者动手、不另设人格；稿件格式与 LaTeX 规则 · 间接来源

### FINAL_EXPECTATIONS.md（FE）

- 这份文档写的是用户真实使用时应看到的验收目标，不代表当时已经全部做到 · 依据：FINAL_EXPECTATIONS.md「这些是产品验收目标，不表示当前实现已经全部达到」 · 仅见本文件 · 间接来源
- 用户只需说目标、问题或想要的结果；Dove 自己看懂项目现场、找出最要紧的不足、挑能力开始干；用户不需要懂内部实现、文档结构、Skill 清单或角色切换 · 依据：FINAL_EXPECTATIONS.md「用户不需要理解内部实现、文档结构、Skill 清单或角色切换」 · 仅见本文件 · 间接来源
- 可见会话里已有明确的方向、证据、产物和未完成行动时，用户说"继续"就顺着接；不够确定时只问最少的问题，并说明答案会改变什么 · 依据：FINAL_EXPECTATIONS.md「用户说“继续”应自然沿该上下文续接」 · 亦见 RM（中断后恢复） · 间接来源
- 找最小的充分机制：刚好足以支撑核心主张、给出可区分预测 · 依据：FINAL_EXPECTATIONS.md「寻找足以支撑核心主张并产生可区分预测的最小机制」 · 亦见 RM（"最小充分机制"） · 间接来源
- 设计和解释实验时，及早指出"即使成功也证明不了核心贡献"的情况 · 依据：FINAL_EXPECTATIONS.md「能及早指出“即使成功也不能证明核心贡献”」 · 仅见本文件 · 间接来源
- 每个结果先吸收进机制、假设、预测、证据范围、主张强度、关键产物或下一步行动，再决定继续、修正还是停 · 依据：FINAL_EXPECTATIONS.md「每个结果先被吸收到机制、假设、预测、证据范围、主张强度、关键产物或下一行动」 · 亦见 RM（"吸收结果并重新判断"） · 间接来源
- 负结果和差一点成功的结果可以启发新方向 · 依据：FINAL_EXPECTATIONS.md「negative result 和 near-miss 可以启发新方向」 · 亦见 RM · 间接来源
- 始终围绕同一条确认目标做作者侧判断：理解目标、找出当前限制、比较严肃的候选解释、选最能改变判断的行动、吸收结果再判断 · 依据：FINAL_EXPECTATIONS.md「始终围绕同一条确认目标进行作者侧科研判断」 · 亦见 RM · 间接来源
- 路线失败、证据不足或行动受限时，继续调查、比较候选、在目标内找有效路径；只有经过实质调查和尝试、确认现实中确实被堵死，才报告真实阻塞 · 依据：FINAL_EXPECTATIONS.md「只有经过实质调查与尝试，确认没有其他有效路径且目标在现实条件下确实被阻塞时，才报告真实阻塞」 · 亦见 PR、RM（停止条件） · 间接来源
- 一次 Mission、检索、作图、实验分析、改稿或检查都可以真实完成；Dove 要说明完成了哪个局部目标、它有没有改变重要判断、证据、产物或下一步 · 依据：FINAL_EXPECTATIONS.md「Dove 会说明它完成了什么局部目标」 · 亦见 PR、RM · 间接来源
- 否定结果、可复现的失败和讲清楚的限制，只要回答了真实问题，也算有价值的完成 · 依据：FINAL_EXPECTATIONS.md「否定结果、可复现失败和清楚限制也可以是有价值的完成」 · 仅见本文件 · 间接来源
- 稿件、回复和引用相关的输出，不拿模型记忆冒充项目事实 · 依据：FINAL_EXPECTATIONS.md「不会用模型记忆补成当前项目事实」 · 仅见本文件 · 间接来源
- 默认多轮推进，不以一轮、一次 Review、一次修改、一次测试或一次汇报为默认终点 · 依据：FINAL_EXPECTATIONS.md「不以一轮、一次 Review、一次修改、一次测试或一次汇报作为默认终点」 · 亦见 RM（"重新判断不是默认停止点"） · 间接来源
- 碰到高成本、破坏性、对外发布或需要权限的动作，先做完不依赖它的判断、找别的能推进的路；比较后确认非做不可，才请求授权并留好续接点 · 依据：FINAL_EXPECTATIONS.md「若经比较确认该动作确实必要，它请求执行该动作所需的授权并保留清楚续接点」 · 亦见 RM · 间接来源
- 上下文、工具或宿主中断时，要准确留下续接点，不能当成研究完成 · 依据：FINAL_EXPECTATIONS.md「上下文、工具或宿主中断需要准确保留续接点，而不是被当作研究完成」 · 亦见 RM · 间接来源
- 审查局部段落、单张图或单项方法时，保持局部范围 · 依据：FINAL_EXPECTATIONS.md「局部段落、单图或单项方法审查保持局部范围」 · 亦见 RM · 间接来源
- 论文要达到较高完成度、接近真实投稿、格式基本达标，才交给 `dove-review` · 依据：FINAL_EXPECTATIONS.md「只有论文已经达到较高完成度、整理为接近真实投稿且格式基本达标后，才交给 `dove-review`」 · 亦见 RM · 间接来源
- 复审回到同一个审稿会话：保留它自己的历史，但每轮重审当轮完整的冻结版本 · 依据：FINAL_EXPECTATIONS.md「后续复审恢复同一审稿会话…但每轮重新审查当轮完整冻结版本」 · 亦见 RM · 间接来源
- 科学上可不可接受，和交付是否就绪，分开判断 · 依据：FINAL_EXPECTATIONS.md「科学可接受性与交付就绪分开判断」 · 仅见本文件 · 间接来源
- 不能为了绕开旧意见而重开审稿会话 · 依据：FINAL_EXPECTATIONS.md「不能为了绕过旧意见而重开会话」 · 亦见 RM（只有用户要求才换审稿上下文） · 间接来源
- 返回的审稿意见在作者侧是要分析的反方证据，不自动照改、不自动收窄主张、不宣布论文失败 · 依据：FINAL_EXPECTATIONS.md「而不是自动照单修改、自动收窄主张或宣布论文失败」 · 亦见 RM · 间接来源
- 推进投稿时，作者侧围绕整篇真实稿件和证据判断进展 · 依据：FINAL_EXPECTATIONS.md「作者侧围绕整篇真实稿件和证据判断进展」 · 仅见本文件 · 间接来源
- 格式和投稿材料在确实影响提交时才处理，不挤掉更高层的问题 · 依据：FINAL_EXPECTATIONS.md「格式和投稿材料在确实影响提交时得到处理，但不排挤更高层限制」 · 仅见本文件 · 间接来源
- 研究 Markdown、Mission 文档、状态页、测试、包检查和安装事实有用，但不是主要产出；用户看到的进展应来自更清楚的判断、新得到或被否定的关键证据、真实跑的实验和分析、改好的代码/稿件/图/交付物，以及澄清了的风险、限制和决策 · 依据：FINAL_EXPECTATIONS.md「不会成为 Dove 最主要的产出」 · 细化 VP"行动高于展示" · 间接来源
- 事实卡只帮助定位记录，不负责恢复科研判断 · 依据：FINAL_EXPECTATIONS.md「卡片帮助定位记录，不恢复科研判断」 · 亦见 RM · 间接来源
- 开发检查要分清源内容、生成文件、软件测试、用户级安装、当前会话加载、真实任务行为和科研目标改善；低层检查不能代替高层结论 · 依据：FINAL_EXPECTATIONS.md「较低层检查不能替代较高层结论」 · 仅见本文件 · 间接来源
- （本文件还重复了前面已列的，不再单列）普通会话靠 rule、不靠每轮 hook 或隐藏 intake；`claude --agent dove` 是作者入口；九个平级入口、没有 Auto；不论领域和路线是否成熟都先理解真实问题；主动借用跨领域直觉、再查目标领域；文献是创新燃料；承诺前识别命题、前提、替代解释和"反证可能"；评价链、消融、最小必要对照、design-only、小样本；四种结论和不无限补查；整体最优；三种停止情况；按问题层级处理并"把结果放回整体判断"；不能用报告拼接代替判断；作者自检覆盖的四个方面；审稿对象清单和"作者侧先取得官方要求、审稿标准和相关论文"；四问四标题；投稿三重标准（加"旧版本 verdict"不能证明就绪）；update、SessionStart"不改研究记录"、statusLine、事实卡、Run 收据、DOI 核验 · 间接来源

### RESEARCH_MODEL.md（RM）

- 这份文档是科研含义唯一完整的展开；实现、提示词和宿主文件不能另造一套科研模型 · 依据：RESEARCH_MODEL.md「实现、提示词和宿主文件不应发明另一套科研模型」 · 亦见 PR · 间接来源
- 研究工作区是持续演进的研究主体，保存当前主线、重要证据、关键判断、真实产物和研究历史 · 依据：RESEARCH_MODEL.md「研究工作区是持续演进的研究主体」 · 仅见本文件 · 间接来源
- 主线由用户确认，写明真正要解决的问题、目标、范围和完成含义；用户限制要变时也要请求确认 · 依据：RESEARCH_MODEL.md「主线由用户确认，说明当前真正要解决的问题、目标、范围和完成含义」 · 亦见 VP、PR · 间接来源
- 看懂现场时，项目文件、研究 Markdown、对话摘要、旧 Review、实验结果、稿件、图和代码都可以用 · 依据：RESEARCH_MODEL.md「项目文件、研究 Markdown、对话摘要、旧 Review、实验结果、稿件、图和代码都帮助 Dove 理解现场」 · 仅见本文件 · 间接来源
- 用 Source 检验直觉：有没有依据、是否已有相近解释、什么条件下会失效、什么证据能区分候选 · 依据：RESEARCH_MODEL.md「判断直觉是否有依据、是否已有相近解释、哪些条件会使它失效」 · 仅见本文件 · 间接来源
- 理论分析可以支持保留原本正确的设计，不要求每次都人为改点什么 · 依据：RESEARCH_MODEL.md「分析可以支持保留已有正确设计，不要求每次人为改动」 · 仅见本文件 · 间接来源
- 推导、反例、小诊断三种分析不必都做，也不要求理论完备才能行动 · 依据：RESEARCH_MODEL.md「三种分析不必同时完成，也不要求理论完备才能行动」 · 仅见本文件 · 间接来源
- 数学、物理等形式化分析，在能改变判断时主动用 · 依据：RESEARCH_MODEL.md「数学、物理或其他形式化分析在能改变判断时主动使用」 · 仅见本文件 · 间接来源
- 排错、局部操作和每个委派出去的子任务，不重复扫描全项目，也不重走完整的理论流程 · 依据：RESEARCH_MODEL.md「排错、局部操作和每个被委派的子任务不重复扫描全项目或完整理论流程」 · 仅见本文件 · 间接来源
- 核心实验围绕主张设计：点名要检验的预测，拿主机制和最强的替代解释（包括更简单的解释）比，定义最低充分证据，事先说明正、负、模糊结果分别怎样改变机制、证据范围、主张强度和下一步 · 依据：RESEARCH_MODEL.md「定义最低充分证据，并说明正面、负面或模糊结果如何改变机制、证据范围、主张强度和下一行动」 · 仅见本文件 · 间接来源
- 实验证据只覆盖实际用过的数据、尺度、设置和实现；要扩大结论，得说明保留了什么、变了什么、凭什么能迁移、什么条件下会失效 · 依据：RESEARCH_MODEL.md「扩大结论时说明保留关系、变化因素、迁移依据和失效条件」 · 仅见本文件 · 间接来源
- 四种结论不做成机器状态 · 依据：RESEARCH_MODEL.md「而不把它们做成机器状态」 · 仅见本文件 · 间接来源
- 默认循环：读必要的现场 → 找最重要的未解决问题 → 比较严肃的候选解释 → 选最能改变判断的行动 → 用合适的 Skill 或工具 → 吸收结果再判断 · 依据：RESEARCH_MODEL.md「Dove 默认持续执行同一个循环」 · 亦见 FE · 间接来源
- 重新判断不是默认的停止点；主线里还有可靠的行动能推进或保护目标，就继续 · 依据：RESEARCH_MODEL.md「重新判断不是默认停止点」 · 亦见 FE · 间接来源
- 中断后，主会话从可见对话和必要的项目材料里恢复：真实问题、已观察到的证据、当前解释、未完成的行动和下一步；不够确定方向就先澄清 · 依据：RESEARCH_MODEL.md「主会话应从可见对话和必要项目材料恢复真实问题、已观察证据、当前解释、未完成行动和下一步」 · 亦见 FE · 间接来源
- 事实卡按更新时间、开始时间选最新的 Review 和 Run，并核对最新审稿所列材料的字节；不总结科研、不猜主线、不选下一步；"最新的记录"不等于当前主线 · 依据：RESEARCH_MODEL.md「最新记录不等于当前主线，事实卡不替代主会话的恢复判断」 · 亦见 PR、FE · 间接来源
- Skill 的入口名和工具不决定研究顺序 · 依据：RESEARCH_MODEL.md「入口名和工具不决定研究顺序」 · 仅见本文件 · 间接来源
- 问题或路线还开放时，检查隐含假设、是不是问错了问题、框架是否太窄 · 依据：RESEARCH_MODEL.md「检查隐含假设、可能问错的问题和过窄框架」 · 仅见本文件 · 间接来源
- 抓住仍在最高层限制判断的问题，不被最近冒出来的低层产物牵着走；层级细化为：问题与贡献 → 数据与评价 → 方法与统计识别 → 执行、恢复、论证、写作、图表、交付 · 依据：RESEARCH_MODEL.md「而不是被最近出现的低层产物牵引」 · 亦见 VP、FE（层级划分略有不同） · 间接来源
- 必要的运行有效性检查不能省；保护实际产物的紧急行动不被机械的排序挡住 · 依据：RESEARCH_MODEL.md「必要的运行有效性检查不取消，保护实际产物的紧急行动也不被机械排序阻止」 · 仅见本文件 · 间接来源
- 严肃的候选机制、假设、适用条件、证据、预测和失效条件都留着，直到证据足以区分 · 依据：RESEARCH_MODEL.md「保留严肃候选机制、假设、适用条件、证据、预测和失效条件，直到证据足以区分」 · 仅见本文件 · 间接来源
- 只有证据、重要决策、主张强度、可复用的负结果或近失结果、关键产物或下一行动发生改变，才算科研推进 · 依据：RESEARCH_MODEL.md「只有证据、重要决策、主张强度、可复用的负面结果或近失结果、关键产物或下一行动改变时才算科研推进」 · 仅见本文件 · 间接来源
- 新目标、关键任务、路线、假设或评价目标要是依赖外部理论、相关工作、新颖性或领域惯例，先用 Source 查真正相关的工作、比较后再建议；只是执行已确认的任务且前提仍成立，就直接做 · 依据：RESEARCH_MODEL.md「若只是执行已确认任务且前提仍成立，则直接完成确认任务」 · 仅见本文件 · 间接来源
- Research Skill 是"推进这个目标"的直接入口，在各种能力之间挑当前最有价值的行动；它不是单独的 Auto 模式 · 依据：RESEARCH_MODEL.md「Research 是“推进这个目标”的直接入口」 · 仅见本文件 · 间接来源
- Status 从普通 Markdown 和必要材料报告当前主线、实质进展、活跃问题、决策和下一个优先事项 · 依据：RESEARCH_MODEL.md「报告当前主线、实质进展、活跃问题、决策和下一优先级」 · 仅见本文件 · 间接来源
- 缺概览或链接断了只是普通的文档事实，不会让研究失效 · 依据：RESEARCH_MODEL.md「缺失概览或断链是普通文档事实，不会使研究无效」 · 仅见本文件 · 间接来源
- Source 在有用时才记录外部材料；DOI 核验要保留冲突、没找到和未知 · 依据：RESEARCH_MODEL.md「保留冲突、未找到与未知」 · 仅见本文件 · 间接来源
- 中央实验还要说明对论文的价值和对路线的决策作用；基础不足时先查项目材料和相关来源，必要且获准才做最小代表性诊断 · 依据：RESEARCH_MODEL.md「中央实验需要明确真实问题、关键不确定性、最强替代解释、论文价值和路线决策」 · 间接来源
- 评价链逐步追：输入怎样变成各方法的实际输出、输出跟什么评价依据比、指标量的是什么、最后怎样形成方法间的比较 · 依据：RESEARCH_MODEL.md「输入怎样成为各方法的实际输出，输出与什么评价依据比较，指标测量什么」 · 亦见 PR · 间接来源
- 参照必须适用于目标对象和粒度；用代理指标或方法自己的输出当评价依据时，要说明为什么有效，不能只确认文件存在 · 依据：RESEARCH_MODEL.md「不能只确认文件存在」 · 仅见本文件 · 间接来源
- 失败、缺失、无效输出和排除怎样影响结果和分母要写明：不悄悄只算成功的交集，也不强制所有失败一律记零 · 依据：RESEARCH_MODEL.md「不静默只统计成功交集，也不强制所有失败统一记零」 · 亦见 PR（只提"分母"） · 间接来源
- 适用时在同一个评价单位上做配对比较，看差值、不确定性和样本相关性；有训练、调参、校准或方法选择时，保护最终测试的独立性 · 依据：RESEARCH_MODEL.md「在相同评价单位上作配对比较，考虑差值、不确定性和样本相关性」 · 亦见 PR · 间接来源
- 没有真值、不配对或纯理论的研究，不硬套参照、配对或数据划分 · 依据：RESEARCH_MODEL.md「无真值、非配对或纯理论研究不硬套 reference、配对或数据划分」 · 仅见本文件 · 间接来源
- 小样本诊断只检查链路的含义和实现 · 依据：RESEARCH_MODEL.md「小样本诊断只检查链路语义和实现」 · 亦见 PR、FE · 间接来源
- 消融看实际代码、配置和输出，而不是组件名：除了点名的组件，信息访问、预处理、训练预算、数值尺度、编辑幅度或后处理有没有一起变 · 依据：RESEARCH_MODEL.md「信息访问、预处理、训练预算、数值尺度、编辑幅度或后处理是否同时改变」 · 仅见本文件 · 间接来源
- 当前对照识别不了核心贡献时，仍然可以继续做获准且有价值的探索 · 依据：RESEARCH_MODEL.md「仍可继续获准且有价值的探索」 · 仅见本文件 · 间接来源
- 只有新数据、新方法、新评价链或与决策相关的缺口才触发相应核查；不要求每轮把整条链重查一遍 · 依据：RESEARCH_MODEL.md「不要求每轮全链重查」 · 仅见本文件 · 间接来源
- Rebuttal 先分析每条重要意见暴露的到底是来源、实验、方法、分析、表达、图还是投稿适配的问题 · 依据：RESEARCH_MODEL.md「分析每个重要意见实际暴露的是来源、实验、方法、分析、表达、图或投稿适配问题」 · 仅见本文件 · 间接来源
- 回复和修订时对照原稿主张、审稿人的理解、拟写的回复和修订后的主张，防止悄悄加强或减弱 · 依据：RESEARCH_MODEL.md「回应和修订比较原稿主张、审稿人理解、拟议回复与修订后主张」 · 仅见本文件 · 间接来源
- Lessons 是研究者拥有的可复用建议，在可能启发当前或未来工作、改善判断、扩大候选空间或避免重犯错误时读写 · 依据：RESEARCH_MODEL.md「Lessons 是研究者拥有的可复用建议」 · 仅见本文件 · 间接来源
- Lessons 不是证据、完成证明或固定清单 · 依据：RESEARCH_MODEL.md「Lessons 不是证据、完成证明或固定清单」 · 仅见本文件 · 间接来源
- Mission 是挂在主线下的一次有范围的研究往返，服务于主线里的问题、假设、证据缺口、产物改进或决策，带回结果、证据、失败、未知、产物和建议 · 依据：RESEARCH_MODEL.md「带回结果、证据、失败、未知、产物和建议」 · 仅见本文件 · 间接来源
- Mission 完成不等于主线完成，Mission 失败也不等于主线失败 · 依据：RESEARCH_MODEL.md「Mission 完成不等于主线完成，Mission 失败也不等于主线失败」 · 仅见本文件 · 间接来源
- 研究树保存分支发生时的条件和证据；Mission 的目标、假设或范围实质改变时，旧分支保留原意，新分支承接新问题 · 依据：RESEARCH_MODEL.md「应保留旧分支的原始语义，并让新分支承接新的问题」 · 仅见本文件 · 间接来源
- 局部结果没改变主线判断、关键证据、关键产物或后续决策时，只算"有用支撑"，不算主线进展 · 依据：RESEARCH_MODEL.md「否则它是有用支撑」 · 亦见 PR、FE · 间接来源
- 用不用子代理都不改变研究者身份，也不自动算独立的论文审稿；有界子代理不接管主线或重要的用户沟通 · 依据：RESEARCH_MODEL.md「也不自动构成独立论文审稿」「不接管主线或重要用户沟通」 · 仅见本文件 · 间接来源
- 审稿侧材料缺失时，说明哪些期刊、会议或领域判断受了限制，不自己去补取 · 依据：RESEARCH_MODEL.md「材料缺失时，审稿侧说明哪些期刊、会议或领域判断受限，不自行补取」 · 亦见 PR、FE · 间接来源
- 修订版回到同一个审稿上下文，保留之前的意见和之前交接过的投稿背景；每轮审当前的完整版本，而不是只看改动的差异 · 依据：RESEARCH_MODEL.md「而不是只看改动差异」 · 亦见 FE · 间接来源
- 只有用户明确要求换审稿上下文，才新建 `dove-review` 上下文 · 依据：RESEARCH_MODEL.md「只有用户明确要求更换审稿上下文时，才创建新的 `dove-review` 上下文」 · 仅见本文件（FE 有相近的"不为绕开旧意见重开"） · 间接来源
- 记录的目的，是保存将来判断要用的主线、证据、条件、失败、决策和续接点 · 依据：RESEARCH_MODEL.md「记录的目的，是保存未来判断需要的主线、证据、条件、失败、决策和续接点」 · 仅见本文件 · 间接来源
- 独立审稿暂时不可用时，如实保留这个缺口 · 依据：RESEARCH_MODEL.md「独立审稿暂不可用时诚实保留该缺口，不降低标准」 · 亦见 PR、FE · 间接来源
- （本文件还重复了前面已列的，不再单列）确认主线与暂定探索；歧义先反问；跨领域直觉和"文献是创新燃料"；最小充分机制；承诺前识别命题、前提、适用与失效条件、替代解释；不设固定理论前言；证据复用；四种结论、不无限补查、事实否定不需批准；整体最优与预算不是硬上限；三种停止情况；九个 Skill；证据和主张强度；异常结果先排查；Source 的四级区分、引用身份与支持分开、复合主张、系统综述；实验类型、design-only、事前计划与事后记录、不加模板记录表或 gate；Draft、Figure、Review 五种操作和局部审查；作者自检不算独立评价；`dove-review` 的时机、冻结材料、只 Read、四问四标题、SHA 只内部用、意见是反方证据；研究记录按需写、相对链接不是数据库；投稿格式与三重标准；测试和生成文件只证明各自覆盖的事实 · 间接来源

---

## 3. 早期有、后来可能丢掉的要求

后来的重设计围绕轮次、导师、研究记录和面板组织。下面按我判断的风险从高到低排，**前 5 条风险最高**。每条用一句话说明为什么看起来有风险；这只是预判，没有核对当前 Dove。

1. 【前 5】**持续推进不以"一轮"为终点**：默认多轮，"不以一轮、一次 Review、一次修改、一次测试或一次汇报作为默认终点"，"重新判断不是默认停止点"，只在目标达到、确认无路、需要用户决策或碰到外部限制时停 · 出处：FE、RM、PR；提交 906f9ab · 风险：按轮次组织以后，"一轮结束"天然会变成停下汇报或等指令的点，正好和这条相反。 · 间接来源
2. 【前 5】**判断权留在主会话和用户手里**：子代理完成、检查通过、多数意见、报告拼接都不代替主会话判断；需要完整对话或主线责任的工作不委派，有界子代理不接管主线或重要的用户沟通；改变目标、贡献定义或完成含义由用户决定，事实上的否定不需要批准；审稿意见是要分析的反方证据，不照单改 · 出处：PR、FE、RM；提交 3c0568c · 风险：导师是一个持续给意见的第二方，它的意见很容易变成放行门槛或直接指令，削弱"主会话自己综合判断"和"方向由用户定"。 · 间接来源
3. 【前 5】**研究记录是按需写的普通 Markdown，支撑系统不冒充研究**：只在用户要求、重要结论/决策/优先级改变或确有恢复价值时写；不要求固定标题、frontmatter、ID、计数、哈希、机器索引、数据库式记录或一致性检查；主要产出是判断、证据和改好的产物，不是更多文档或状态报告 · 出处：VP、PR、FE、RM；提交 f5b1019（6116057 的台账、eb12134 的 Schema 已在 9-06 前被否定） · 风险：以研究记录和面板为中心的设计需要每轮写记录、需要面板读得懂的固定结构，最可能反过来要求固定格式、每轮必写，让记录和看板成了主要产出。 · 间接来源
4. 【前 5】**不加模板、关卡和重复流程**：实验判断"不增加科研模板、记录表或新 gate"，"不设固定理论开场"；查过的证据在条件成立时复用，"不要求每轮全链重查"，排错和子任务不重扫全项目；不靠每轮 hook 注入，减少重复提示 · 出处：PR、FE、RM；提交 362e794「reducing repeated prompts」、3c0568c「retire prompt intake」 · 风险：每轮"计划—导师审—写记录"的固定节奏本身就是模板和关卡，还容易每轮重读全部现场、反复注入同样的提示。 · 间接来源
5. 【前 5】**`dove-review` 的独立性和投稿完成标准**：只在论文接近真实投稿时用；冻结完整材料，审稿侧只有文件副本和 Read、不联网；复审回到同一会话、每轮看完整版本、不为绕开旧意见重开，只有用户要求才换；子代理不自动算独立审稿；投稿完成要作者侧充分、`dove-review` 可接受、交付满足三条同时成立，审稿不可用也不降标准 · 出处：VP、PR、FE、RM；提交 d677337 · 风险：导师接手日常质疑以后，冻结材料的独立近投稿审稿容易被并进导师或被当成多余，"导师通过"可能被当成投稿完成或独立评价。 · 间接来源
6. **一个 Dove、公共概念保持简单**：不靠不同人格分工；复杂性不暴露为更多模式、角色、命令和模板；用户不需要懂内部结构或角色切换 · 出处：VP、FE；提交 a6bb20a（早期的角色层级 8cfcbfa 已被它取代） · 风险：导师是新角色，轮次、记录、面板是新的公共概念，正好落在"不暴露更多模式、角色"这条的反面。 · 间接来源
7. **Mission 和研究树**：Mission 是主线下有范围的往返，带回结果、失败、未知和建议；Mission 完成或失败都不等于主线完成或失败；目标、假设实质改变时旧分支保留原意，新分支承接 · 出处：RM；提交 ecae19a（"出任务—归来"的隐喻） · 风险：轮次取代 Mission 成为基本单位后，"往返"和"分支保留原意"没有自然的落点，容易变成一条线性的轮次日志。 · 间接来源
8. **局部完成如实说、不造假进展**：只有证据、决策、主张强度、可复用的负结果、关键产物或下一步改变才算推进，否则只是"有用支撑"；否定结果和可复现的失败也算完成；没有真实材料不记录产物，不声称没有证据的进展 · 出处：RM、FE、PR；提交 4363cc5、8027a73、91ae567 · 风险：每轮都要出记录、面板都要更新时，"完成了一轮"很容易被当成进展，没有变化的轮次也会写出占位内容。 · 间接来源
9. **放弃或收窄之前先找补证据的路**：收窄主张前先比较可行的补证据行动；只有经过实质调查和尝试、确认现实中被堵死，才报告真实阻塞 · 出处：PR、FE · 风险：导师负责淘汰候选，容易让"收窄主张、放弃路线"来得比"先比较补证据行动"更快。 · 间接来源
10. **普通科研提问直接产出可追溯证据，不绕去做审稿式审计** · 出处：提交 7983d9c「instead of reviewer-audit detours」 · 风险：每一步都过导师质疑的设计，可能把"先审一遍"重新变成普通提问的必经绕路。 · 间接来源
11. **前台推进，没有隐藏后台**：不加隐藏调度器、隐藏后台任务或无界队列，也没有单独的 Auto 入口 · 出处：PR、VP；提交 ec1ed0d「without adding a hidden scheduler」 · 风险：要让轮次自动接续，最省事的做法就是后台循环、定时触发或排队，和"前台、无隐藏调度"相冲。 · 间接来源
12. **status 和看板的取向**：status 只读；默认只给"一个需要人做的下一步"和紧凑结果，内部细节要显式展开；缺概览或断链不算研究失效 · 出处：PR、RM；提交 bea564f、10e151e、0672e0c · 风险：面板天然倾向把轮次、导师意见和记录状态都摊开，还可能在面板上直接改记录，"默认一个下一步、细节收起、只读"容易被铺满的信息取代。 · 间接来源
13. **恢复只给事实卡，"继续"按可见对话接**：compact/resume 只给存在与否、时间、轮次、状态这类事实，不读研究正文、不猜主线、不选下一步；用户说"继续"时顺着可见对话接 · 出处：PR、FE、RM；提交 3c0568c · 风险：有了轮次状态以后，恢复时很自然会注入"当前第几轮、下一步做什么"的摘要，替主会话猜主线。 · 间接来源
14. **先问用户、标明暂定**：会影响行动的歧义先反问，并说明答案怎样改变下一步；开放探索明确标为暂定；早期还要求 mission 先提案、用户批准后才落地 · 出处：VP、PR；提交 8871b6c · 风险：自主多轮再加上导师可以替用户"回答"问题，向用户反问和暂定标记容易被省掉。 · 间接来源
15. **实验类型和事前计划**：分清只做设计、按请求执行、分析已有结果、事后记录、小规模和诊断；新授权的中央实验先存计划再跑，偏差追加到同一份文档；事后记录不装成事前计划；只做设计时不升级为执行 · 出处：PR、RM · 风险：轮次记录会接管"计划—执行—结果"的写法，"同一份文档先计划、后追加偏差"和"事后不冒充事前"的区分可能丢失。 · 间接来源
16. **评价链和消融的细则**：参照、代理指标是否适用，"不能只确认文件存在"；失败怎样进分母（不悄悄只算成功的交集、不强制记零）；配对与不确定性；最终测试独立；无真值研究不硬套；消融要查信息访问、预处理、训练预算、数值尺度、编辑幅度、后处理有没有一起变；及早指出"成功了也证明不了核心贡献" · 出处：RM、PR、FE；提交 362e794 · 风险：这些是 9-06 当天才写进去的细则，只在少数段落出现，重写指导时最容易被概括成一句"评价要可靠"。 · 间接来源
17. **路线形成里"可以不改、可以直接做"的条款**：分析可以支持保留原来正确的设计；不要求理论完备才行动；只执行已确认的任务且前提成立就直接做；扩大结论要说明迁移依据和失效条件；检查是不是问错了问题、框架是否太窄 · 出处：RM · 风险：以导师质疑为核心的设计容易鼓励每轮都改点什么、都补一段理论，这些放行条款最容易被删。 · 间接来源
18. **论文侧的低调规则**：润色不悄悄改主张强度；不拿模型记忆冒充项目事实；作者风格只从可靠样本校准；重要的图放进真实版面、按接近最终的尺寸检查；Rebuttal 逐条判断意见暴露的问题类型，并对照原稿主张、审稿人理解、回复和修订后主张；格式不挤掉高层问题；新稿只在会议接受时才默认 LaTeX · 出处：PR、FE、RM · 风险：以科研轮次为主线的重设计重心在实验和路线上，写作、作图和回复这些只在 Skill 段落里出现的规则最容易被压缩或丢掉。 · 间接来源
19. **Source 的细分**：找到、取到、读过、用上四级区分；引用身份和主张支持分开；复合主张逐部分判断；DOI 核验保留冲突、没找到和未知；系统综述用结构化方法；缺工具时说出来 · 出处：PR、RM · 风险：这些只在 Source 段落里出现，重写时容易被概括成"查文献要准确"。 · 间接来源
20. **Lessons 归研究者所有**：Lessons 是研究者的可复用建议，不是证据、完成证明或固定清单；早期是手动的"归来仪式"，行动前要参考 lessons · 出处：RM；提交 c92bf0d、638540c · 风险：导师和研究记录可能接管"经验"这一层，Lessons 要么被并掉，要么变成每轮必过的清单。 · 间接来源
21. **预算不是额度**：预算是资源取舍的依据，不是预付额度，也不自动变成硬上限 · 出处：PR、RM · 风险：按轮次的设计常给每轮定时间或资源额度，预算容易重新变成每轮的硬上限。 · 间接来源
22. **接入已有项目不暗改**：init 只建最小的 RESEARCH.md，已有目录不动，输出分清新建和保留；update、重装、卸载保留 research/reviews/runs；早期接入已有论文资产时先提方案 · 出处：PR；提交 8cfcbfa、aeea8d8 · 风险：围绕研究记录重设计时，往往要建一整套目录或迁移旧记录，"只建最小文件、已有内容不动"容易被打破。 · 间接来源
23. **非 Claude 宿主**：DeepSeek Harness 至少能用项目内的 Skills；更早还支持 Codex、Cursor、OpenCode · 出处：PR；提交 9f24a12 · 风险：导师子代理、轮次驱动和面板多半依赖 Claude Code 的机制，非 Claude 宿主最可能被悄悄放弃。 · 间接来源
24. **检查分层，低层不冒充高层**：软件测试、安装事实、生成文件、研究 Markdown 只证明各自覆盖的事实，不能当成科学正确、研究完成或投稿就绪 · 出处：PR、FE、RM · 风险：面板如果展示"检查通过、记录齐全"，很容易被当成研究进展的证据。 · 间接来源

### 9-06 时文档里已经看不到的早期要求（不算本节风险，供核对用户是否仍需要）

- Dove 对自身的元优化：按分类积累问题记忆，只出提案、不自己改（203daea、c597fa1、4ce4947） · 9-06 文档不再提 · 间接来源
- 治理层、context bundle、持久上下文清单（8bf9c14、f9448e5、f44181e） · 9-06 文档不再提 · 间接来源
- 文档证据台账（6116057） · 9-06 明确不要台账 · 间接来源
- 工作流契约和收敛证据关卡（8027a73） · 9-06 改为不加 gate · 间接来源
- task packet、Schema 8/18、Research Format 1（343e13f、2087d59、eb12134、cca897e） · 改为普通 Markdown · 间接来源
- 角色层级、生命周期路由、论文与工程两类工作流（8cfcbfa、b2c982b） · 改为一个统一的 Dove · 间接来源
- auto、operator、operate 等单独入口（f9f17d1、ec1ed0d） · 改为默认自主推进 · 间接来源
- 每轮 prompt intake 和 statusline（638540c、3c0568c） · 已退休 · 间接来源
- 回滚（6eb0cd3） · 9-06 文档不再提 · 间接来源
- 图的生成源和最终目标分开、质检只看当前图（95a18b0） · 9-06 文档不再提 · 间接来源
- 指定用 gpt-image2 生成图（e6ce777） · 泛化为"专门的图像生成模型" · 间接来源
- 每日主页和行动卡（d5c8e25） · 9-06 文档不再提 · 间接来源
- MCP 作为日常入口（6dee591、3b13df9） · 9-06 文档不再提 · 间接来源
- 输出本地化（f9f17d1） · 9-06 文档没有再明说 · 间接来源
