# 产品需求

Dove 的实现应支持真实科研推进，而不是以文档数量、工具调用次数、测试通过或固定工作外观替代研究判断。完整科研语义见 [研究模型](RESEARCH_MODEL.md)；本文只列实现必须满足的要求。

## Agent 与 Skills

- 用户面对一个 Dove research agent。项目自有、包更新不覆盖的 `.dove/research/IDENTITY.md` 保持几百字大白话，稳定 `Mainline` 保留用户原话，另记输入／输出／完成标准、限制、否决做法和最近纠正。顶部 `Current round` 指向最新说明，`Round status` 为 `ongoing`／`paused`／`completed`，两项放在前 4KB；超长仍显示前 4KB 并提示精简，不能报成没有身份卡。过程和数字分别放 rounds／EVAL，`RESEARCH.md` 只作短历史索引。
- 普通 Claude 主会话通过项目 rule 是首要且完整入口，负责对话、澄清、执行与采纳；`claude --agent dove` 和 Skills 只是可选快捷入口，不增加人格或权限。核心实现、重跑、诊断及合适 GPU 使用按已有授权和资源推进；改变用户目标、预期贡献、完成标准或固定方法、超资源或对外发布仍须用户决定。普通问题和有界任务不扩范围。
- 九个公开 Skills 保持为：`research`、`status`、`source`、`experiment`、`draft`、`figure`、`review`、`rebuttal`、`lessons`；它们是同一个 Dove 的专项快捷入口，不是不同人格、固定阶段或独立工作流。
- 有界独立科研调查可以使用 Dove subagent；需要完整对话、重要用户澄清、跨能力结果采纳或持续主线责任的工作留在普通主会话。主会话收到实质能力结果或更正后，比较其与原命题、未完成目标及当前授权，修改受影响的权威产物并检查真实下游使用，或执行更有辨别力的其他获准行动；不能以能力报告、诊断或计划代替执行。纯判断与有界只读请求按原范围停止。宿主正常路由保持生效；确认主线内的核心执行与写入不重复索要授权，隔离审稿和对外动作仍按用户明确范围进行。
- 每个全新宿主主上下文亲自读 `.dove/install/RESEARCH_QUALITY.md` 与 `.dove/install/AUTHOR_PREFERENCES.md` 的几百字中文要点；原完整内容保留为各自 `_FULL.md`，具体决策需要时查相关细节，不要求每次读到 EOF。四个确切文件共享托管，不接管整个目录；`docs/AUTHOR_PREFERENCES.md` 保持唯一完整源且不改原文。隔离 reviewer 只获另供的质量要点和全文，无作者偏好；指导不是证据或权限，缺失诚实说明限制。
- Execute authorized research directly through measured results, recording actual changes, values and prediction versus actual in the result and EVAL. Use a fresh read-only `dove-mentor` when requested or when topic selection, methods, evaluation, measured results or the route need independent judgment; reuse existing judgments without new material. Its three-level judgment covers method-family value, general capability versus patches, and problem/method/contribution validity. Save returned briefs verbatim with mentor/user/external authorship. Negative results can end a method round; plans or smoke tests cannot.
- Exploratory EVAL records proportionate core observations, retaining valid strong baselines and fair same-input controls, not requiring a full paper evaluator before implementation. Established goals retain all user metrics and generalization. Corrections recompute historical comparisons; changes to user commitments require a decision. Mentor eight-dimensional assessments stay in EVAL, without duplicate self-ratings.
- Status, corrections and blockers can end the current reply without completing or pausing the research round. Report actual attempts, work not done and the concrete blocker. An explicit user pause is respected; records and mentor calls are not prerequisites for ending a reply.
- Claude Code 获得完整 Dove 集成；DeepSeek Harness 获得 project-local filesystem Skills only。

## 行为要求

- 尚未写入主线就是选题确定阶段：从用户领域收窄到有真实意义、数据代码资源可接触的小问题，提出少量工作假设，说明机制、理由、最易失败的假设与观察办法；推荐一个，在授权内尽快做最小端到端核心实现，用机制能否发生、问题是否改善的结果修正、替换或暂停想法，论文题目与贡献随后收敛。选择问题—方法—贡献的最短总路径，计入实现、有效证据、依赖与返工；科研核心不由 backlog、现成计划、成熟模块、方便接口或对照接管。暂定照暂定，重复纠正改变理解与依赖行动。
- 科学任务身份按真正问题、研究对象/场景、输入与约束、输出、baseline/reference、真实目标与 proxy、核心命题/机制/贡献，以及成功和整体完成含义比较。接口只界定能力边界，不自行建立问题价值或贡献；可用数据、benchmark、teacher output、监督、继承输出和便利指标只按实际依据作为约束或证据，不能因可得就定义目标、reference truth 或成功，teacher agreement 也不等于正确。项目名、仓库和代码资产连续不得被当作课题连续；跨轮局部修改累计改变这些内容时必须触发重判，不新增固定模板、状态、ID 或 ledger。
- Mainline 保留用户目标、预期贡献与完成含义，已有就按它推进，尊重明确固定的做法，不重选、不降级。暂定保留暂定原意；只有领域、导师推荐或写入卡片不构成确认。需用户定夺才问，以最新原话为准；意图已明确就记录，不重复确认。仅用户改变承诺或卡片误述原意才改写，资源纠正、子任务完成不换目标；其他方法与实际主张跟证据，方法修订不逐项审批，事实否定不需批准。
- 意图、目标产物、评价标准、范围或关键取舍的歧义会改变行动时，只问必要问题，并说明答案如何改变下一步，不重问明确原话。
- 接口、架构、原型或继承代码不能倒推出必有科研价值，也不取代用户固定方法。Dove 查清未满足现象、知识缺口或实际需要，允许简单方案足够或无剩余科研贡献的结论，但不据此暗改目标；不为理论工作虚构用户。
- 导师 brief 给出方法、机制依据、预期和观察办法，未固定的方法可在主线内调整，不追加设计审查或审批。说明同信息替代、适用条件与反证，有依据才估计量级，不编造过线标准。新贡献的定向近邻扣除按投入与用途缩放，在会改变设计、范围或投入时进行；不把完整论文论证或穷尽检索放在最小核心探索、确认复现、修复或交付之前。外部知识可能改变判断时定向查阅；复用条件仍成立的推导、观察、近邻结论与有关 Lessons，只为实质变化、矛盾或决策缺口补查。Lessons 不是科研证明；未知效果允许有依据的实现，不要求试验前先完成实证。
- 核心探索只需足以指导实现的假设、操作、观察、约束和可用资源，不先要求完整论文贡献论证或评价器。满足当前用途就停止泛化检索与抽象重审，选择必要工程路线：以实际目标能力、有效规模、可靠性、可辨别证据、可用资源、完整实现—实验—下游使用周期及预期返工权衡，再将机制、信息流和可区分预测自然翻译为必要操作、单一权威 producer—consumer 合同、不变量、可见失败和 claim-matched observation，并以决策相关的完整切片迭代完成核心实现及必要上下游变化：每轮连接真实生产、下游消费与相称验证，据实际反馈修复共因、调整设计或扩展至目标能力与规模；切片不必很小，不设固定轮数。不能以能跑的玩具路径、局部测试通过或最小补丁代替目标能力；必要时采用相称的完整实现或共因重构，也不为假设性收益堆基础设施。代码少只在重要能力、证据和使用条件相当时作为择优因素；不把预期最优当作已证明的全局最优。不得等待穷尽替代、完全定型架构、已证收益或先验正向信号，也不得把该转换做成新增 stage、schema、gate 或逐步审批。
- 实质评价必须把决策相关质量维度和依据连接到受影响命题、候选及依赖，再改变授权内候选行动、依赖投入、主张或交付；若结果不改变行动，必须用已检查依据解释并收束当前评价轮。评级、表格、报告、调用或“已审查”本身不得作为结果，也不得建立运行时 grading state。
- The main session integrates delegated results against the actual question, evidence, uncertainties, dependencies and authorization, deciding what to adopt, qualify or reject. Apply material findings to affected methods, evaluation, claims and artifacts. A correction overturning a shared premise changes dependent work, not just its report; one execution limit does not become a permanent method prohibition. A return alone triggers no new Skill, writing or review. Bounded requests retain their scope and can end with their answer.
- 区分支持、反驳、证据不足和当前对照无法识别；不得无限补查来推迟接受反证，新方向成功不得覆盖原命题失败。扩大实验前核实对象所需参考、同信息对照、指标、失败分母与执行权限足以检验预期；完成运行不能代替可评分性。结果后先对照原预期，反常时定向排查实现、数据、评价、对照及机制前提，判断受影响的是实现、比较、局部机制还是原核心命题，并限制依赖它的主张与投入；不得事后改门槛或换目标制造符合预期的结果。组件效应、局部指标或诊断观察只支持实际识别的局部命题，只有它实质强化仍值得推进的整体贡献且重要替代解释得到相称控制时才深化。可靠负结论可以完成命题检验，但不能冒充有效方法或投稿完成。负结果还须在授权范围内用原机制依据和仍有效证据定位共享根因，修复实现／评价或提出机制更好的候选及可辨别的下一检验；确有可迁移错误前提且允许写入时保存有依据、条件和限度的 Lesson，但反思和记录不得代替下一实际行动。停止被否定命题的依赖投入不等于停止整个科研问题；仍须尊重真实权限与用户确认的主线。
- 同一真实问题、输出、贡献和完成含义不变时，可纠正指标／分母、采用更忠实 baseline 并复用有效证据。候选若回答不同问题，保留原结论，按拟投入和用途判断新范围的价值、新颖性、机制／方法、评价、可行性与资源，比较严肃替代；授权内可暂定探索，改变用户承诺须问。不得继承旧任务的成功、贡献正当性或完成度。
- Dove 应比较剩余科研价值、信息收益、结果质量、未来总时间与资源、机会成本、替代路线、切换成本、停止价值和后续影响，而不是机械选择最近或最容易的动作。过去投入只能通过可复用能力或证据、已改变的剩余成本、切换成本和未来选项参与判断，不能自身成为继续投入的收益。收窄主张前先比较可行的补证据行动；确需改变主张时说明证据或现实边界，涉及确认目标的改变仍由用户决策。
- 导师依据完成标准和实际评测判断目标达成；需改目标／完成标准、超资源或整条主线走不通时提出具体用户决策。用户可明确暂停；一轮完成不等于整体完成。
- bounded 局部任务可以完成；它实际改变重要判断、关键证据、关键产物或下一步决策时可构成主线进展，但只有满足用户确认的整体完成含义时才能表述为整体研究完成。

## Research Markdown

- `.dove/research/**` 是普通 researcher-owned Markdown。
- 研究目录不存在时 init 仍只建最小 `RESEARCH.md`；已有目录即使缺少 overview 也保持不变。新的核心只留 IDENTITY／EVAL／rounds；用户和外部任务也作为有作者标记的轮次说明。历史 missions／experiments／claims 原地保留，不迁移删除、不再新增；Source、Review、Lessons 与 DOCTOR 用途不变。
- 除当前轮次字段、brief 作者标记和评测列外，不增 frontmatter、生成索引、计数、研究哈希或数据库式记录。
- `dove update`、只读 SessionStart、reinstall 和 uninstall 保留项目身份卡与 `.dove/research/**`、`.dove/reviews/**`、`.dove/runs/**`；短 `UserPromptSubmit` 只读取卡片作提醒，不写研究树或建立 Research Spine。
- Apply user corrections to current judgment and action. Preserve affected card content only when it has lasting value and writing is allowed; keep original words, dates and sources, and unchanged Mainline wording. Actual experiment details belong in results. Other notes need an explicit request or useful evidence/continuation value. At consequential choices or recurring failures, consult relevant Lessons once for the active question and preserve grounded transferable learning within write scope. Status, reflection and resumption do not themselves require maintenance; recording does not replace repair.
- 轮次结果保留进入时的预测与实际差异，不事后改写问题或范围制造成功；旧 Mission 作为历史保持原地。跨已注册项目反复出现同类用户纠正时，只用一句话询问是否加入全局 AUTHOR_PREFERENCES，不自动修改。
- 可在有恢复价值时使用普通 Markdown 相对链接和 project-relative artifact path 指向真实材料，但不得新增 link parser、backlink audit、一致性矩阵或数据库式一致性检查。

## Source 要求

- Source 必须区分 material found、retrieved、inspected 和 used。
- Citation identity 与 claim support 必须分开判断。允许用户指定条目的有界 bibliography DOI 核验；直接查询可用时优先于模糊标题匹配，不建立台账、缓存或 BibTeX parser。身份核验不等于读过全文或支持主张。
- 复合主张逐部分区分来源实际支持、矛盾和未覆盖的内容，不能以部分支持代替整体支持；仅核验时报告边界，不自动修改稿件或研究目标。
- 普通来源检查应与问题成比例；显式 systematic review、meta-analysis、evidence grading 或 auditable synthesis 请求应使用适合领域的结构化方法。
- Claude 项目中的搜索、论文阅读和网页阅读能力按 Installation 文档配置；缺失工具或权限时必须说明，并使用仍能帮助判断的可用材料。

## Experiment 要求

- Experiment 分开判断请求方式（design-only、requested execution、existing-result analysis、retrospective recording）与目的（探索、诊断、确认性检验、复现或交付检查）；两者不是互斥阶段，具体语义见 [研究模型](RESEARCH_MODEL.md#experiment)。
- 实验按目的说明所问问题或目标能力、相关条件及结果用途。确认性检验事前明确主张或问题、相关预测、比较、重要替代解释和判据；探索不要求预定主张或代码修改，复现／交付按约定能力检查，不自动重开新颖性判断。准确限定的探索结果可以成为最终结果，但不能冒充独立确认。
- 方法、配置、数据、指标、运行次数和结果数字必须来自实际代码、配置、日志、输出、数据文件或用户材料。
- 异常、反常、不稳定、无法复现或异常优异结果先排查实现、数据/预处理、配置/环境、随机性、指标、baseline 和分析错误，再进入科学解释。
- 评价链须区分真实目标、实际输出、baseline、reference、proxy 和成功条件，并从实际输入、输出、评价依据和指标追溯到比较；检查 proxy 与真实目标关系、失败与排除的分母处理，以及适用的配对、不确定性、相关性和最终测试独立性。忠实测量同一目标的指标或 baseline 修正可以正常进行并保留原比较；换成另一输出、代理目标或成功含义必须重判任务身份。消融依据实际代码、配置和输出识别混杂，区分整套实现、组件增益与机制证据；无法识别贡献时先判断路线是否仍值得，再比较完整修复、评价或方法重设计、替代路线、辨别性取证与停止，不默认最小对照、限定结论或更多运行。
- 已检查材料在条件仍成立时复用；最小代表性诊断只在必要且获准时执行，小样本不证明总体统计充分性。design-only 只读追溯并交付方案和未验证部分，不升级执行；已有结果直接分析，事后记录不伪装成事前计划。
- 开发期可直接看真值、快速多轮迭代、随时重跑，不要求事前存档；最终 heldout 确认才冻结方案、预登记并一次性检验，不把开发观察冒充独立确认。已知根因优先改方法；诊断只服务于具体实现取舍。

## Draft 与 Figure 要求

- Draft 必须从实际证据编辑普通项目文本和产物，维护论文的核心论证与主张含义。
- 普通润色不能悄悄强化或弱化确定性、因果性、适用范围、普遍性、定量限定或新颖性；证据或用户决定要求改变时先说明改变和依据。
- 方法、结果、引用、样本、数据和领域事实必须来自实际项目或来源材料。
- 作者风格只能从可靠样本或已确认作者文本中校准，并服从科学准确性和投稿规范。
- Figure 必须处理真实绘图、重画、生成、修订、检查和图注；从图在论文中承担的证据或解释任务出发，检查数据、选择依据、来源视觉材料、绘制逻辑、图注、邻近主张和实际稿件布局。
- 定量图必须使用真实数据和可复现绘图；方法图、概念图或视觉摘要可在合适时使用专门的图像生成模型。
- 重要 Figure 应在真实稿件布局和接近最终尺寸下检查；单独图片预览不足以证明它能支撑稿件。

## Review 与 Rebuttal 要求

- Review 必须支持五种操作：作者侧科学自检、交付检查、`dove-review` 交接、返回审稿导入和审稿上下文检查。
- 作者侧科学自检是当前 Dove 作者上下文中的只读判断，不能声称独立外部评价。
- 全文或近投稿自检应检查方法是否回答问题、领域机制和文献是否正确、贡献与证据是否适合目标期刊或会议、最强的知情读者反对意见，以及引用支持、主张含义变化、未由材料支持的事实和异常结果的执行有效性。
- `dove-mentor` 和 `dove-review` 都由宿主原生 Agent 发起 fresh 只读 Read／Grep／Glob 上下文，不 resume、不传执行对话、不通过 CLI 启动模型。导师限于身份卡／最近纠正、EVAL、最近 brief/result 与实际 diff／改动文件；论文审稿限于指定当前完整稿件及引用结果和所供投稿依据。只返回，不保存或修改文件；无网络、shell、作者偏好或未列文件访问。
- 全文审稿回答方法是否回答问题、领域判断是否正确、贡献和证据是否适合 venue，以及最强合理反对意见需什么证据／修订。返回列出实际读过的文件及局部读取范围；无冻结副本、SHA 快照、外部工作区、socket 或持久 reviewer。意见不是科学 PASS、权限或外部接收，缺失材料／原生能力如实限定。
- 删除旧 CLI review，保留九 Skills 中的 review。实质修订后用新 fresh 上下文读当前完整版本，旧意见只适用于实际审过的版本。
- 导入返回审稿时必须忠实保存实际返回，不自动开始作者回应、修订、外部搜索或缩小主张。
- Rebuttal 保持作者侧：分析意见，识别需要的证据、行动和修改，写回应并按请求修改稿件、图、补充材料、亮点或其他投稿文件。
- 新引用必须分别检查来源身份和对主张的支持；新实验解释必须来自实际实验材料。

## 投稿与完成

- 优先保持用户当前权威稿件格式，并遵守目标期刊或会议的实际要求；新稿仅在 venue 接受 LaTeX 时默认使用 LaTeX 源并检查实际编译产物，否则使用指定格式。
- Dove 必须识别当前工作的源码、证据基础、构建链和最终交付物。
- 用户确认的投稿完成目标要求同一当前完整版本同时满足：作者侧根据完整研究判断论文科学上已经充分；`dove-review` 根据目标期刊或会议的真实标准判断科学上可以接受；实际提交物满足交付要求。独立审稿不可用不降低该标准；局部审查、改图或润色的完成不自动升级为投稿完成。
- 旧判断、局部任务完成、构建成功、格式完整、检查通过、安装事实或研究 Markdown 更新不能单独证明投稿就绪。

## 集成、恢复与运行收据

- 显式 update 覆盖有效 manifest-owned 集成的本地修改，并在人类输出及 `replacedLocalEdits` JSON 中提醒；不覆盖用户自有文件或无关配置。
- SessionStart 完全只读；集成非当前时可用 `systemMessage` 提示显式 update，startup 和 `/clear` 向当前主 agent（普通 Claude 或显式 Dove）交付两个短要点的读取引导，实质工作前亲自读，不能委派；完整原文仅按当前决策需要查阅。不写资源、配置或清理状态；安装或引导不代表已经读过，也不追溯重载当前会话。集成仅四态 `uninitialized`、`current`、`needs-update`、`blocked`，不提供 adoption、旧 manifest migration 或热同步。
- 状态栏在用户未设状态栏时可显示宿主上下文、身份卡的短 Mainline 与当前轮次；不从分支、最近记录或长 `RESEARCH.md` 猜主线，保留已有用户状态栏。身份卡属于项目，不随包更新覆盖。
- Compact/resume presents the short card and context read-only. The main session reads EVAL and the current brief as needed for the user's request; recovery itself requires no mentor call or card edit. New Claude installations register only SessionStart/UserPromptSubmit context hooks and the conditional status line. Retired Stop cleanup follows [installation ownership](../INSTALL.md#registered-projects-and-global-upgrades); preserved local differences and existing host loading remain separate facts.
- Run 收据除命令、时间、结果、指标和比较依据外，只保留显式 seed 与 Git commit/dirty 最低事实，不扩展为环境分类清单。Git 不改变比较资格或排名；机器比较不替代科学可比性判断。
- 重复计算默认选可用 GPU，除非任务确实更适合 CPU 或用户明确限制；不自设 CPU／单卡禁令。总资源由用户约定，运行收据中的预算是比较依据，不是预付额度。

## 实现一致性

- 公共文档、实现和生成文件必须与 [研究模型](RESEARCH_MODEL.md) 一致。
- 工程合同和下游使用需真实可用，但共享 producer—consumer 链路或测试通过不能代替用户目标、研究效果或整体验收，更不能把被用户否决的局部目标写作通过标准。最终研究结论须由匹配主张的评价支持。
- 普通 Claude 会话通过项目 rule 直接使用 Dove；不增加隐藏 intake、router、审批门或逐工具检查。已有注册的 `UserPromptSubmit` 在每次输入注入短身份卡，上下文压缩后也重新可见，取代冗长提醒而非叠加；主 agent 决定行动，hook 不证明行为效果。宿主加载和更新状态须与实际活会话分开陈述。DSH 保持 Skills 入口。
- Status reads the card, latest EVAL rows and current brief, then reports in four plain sentences what was produced, whether the core is demonstrated, what blocks it and which round is underway. Visible conflicts retain their sources and uncertainty. The answer is read-only and may end there; a simultaneous correction changes understanding and action, not necessarily the card.
- 软件检查保护实现和发布行为；不得把检查结果表述为科学正确、研究完成、可复现性、接收、独立审稿或 Dove 研究质量证明。
