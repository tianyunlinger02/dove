# 产品需求

Dove 的实现应支持真实科研推进，而不是以文档数量、工具调用次数、测试通过或固定工作外观替代研究判断。完整科研语义见 [研究模型](RESEARCH_MODEL.md)；本文只列实现必须满足的要求。

## Agent 与 Skills

- 用户面对一个 Dove research agent。
- 九个公开 Skills 保持为：`research`、`status`、`source`、`experiment`、`draft`、`figure`、`review`、`rebuttal`、`lessons`。
- Skills 是同一个 Dove 的专项入口，不是不同人格、固定阶段或独立工作流。
- 默认多轮推进属于 Dove 本身；不得新增 Auto Skill、Auto command、隐藏后台任务或无界队列。
- Claude Code 获得完整 Dove 集成；DeepSeek Harness 获得 project-local filesystem Skills only。

## 行为要求

- Dove 必须围绕用户确认的目标行动；开放探索必须明确标为 provisional question/route。
- 改变目标、贡献定义、范围或完成含义需要用户参与决策。
- 会影响行动的意图、目标产物、评价标准、范围或关键取舍不清时，Dove 必须先反问必要问题，并说明答案如何改变下一步。
- Dove 应比较科研价值、结果质量、总时间、资源、机会成本、返工风险和后续影响，而不是机械选择最近或最容易的动作。
- 持续推进只能停止于：目标已达到；实质调查确认没有有效路径；下一步需要用户决策、权限、高成本/破坏性动作、外部发布或明确外部限制。
- bounded 局部任务可以完成，但不得表述为整体研究完成，除非它实际改变了重要判断、关键证据、关键产物或下一步决策。

## Research Markdown

- `.dove/research/**` 是普通 researcher-owned Markdown。
- Fresh init 只创建最小 `RESEARCH.md`；Mission、Source、Experiment、Review、Claim 和 Lesson documents 按需出现。
- 不得要求固定 headings、frontmatter、generated IDs、stored counts、research hashes、machine index 或数据库式记录。
- `dove update`、SessionStart sync、reinstall 和 uninstall 必须保留现有 `.dove/research/**`、`.dove/reviews/**` 和 `.dove/runs/**` 内容；`UserPromptSubmit` 必须保持零写。
- 研究 Markdown 只在用户要求、重要结论/决策/优先级改变，或对保存证据和后续恢复确实有用时维护。Lessons 可按更宽的 reusable-value 标准维护。
- 可在有恢复价值时使用普通 Markdown 相对链接和 project-relative artifact path 指向真实材料，但不得新增 link parser、backlink audit、一致性矩阵或数据库式一致性检查。

## Source 要求

- Source 必须区分 material found、retrieved、inspected 和 used。
- Citation identity 与 claim support 必须分开判断。
- 复合主张应拆分，只保留来源实际支持的部分。
- 普通来源检查应与问题成比例；显式 systematic review、meta-analysis、evidence grading 或 auditable synthesis 请求应使用适合领域的结构化方法。
- Claude 项目中的搜索、论文阅读和网页阅读能力按 Installation 文档配置；缺失工具或权限时必须说明，并使用仍能帮助判断的可用材料。

## Experiment 要求

- Experiment 必须区分 design-only、requested execution、existing-result analysis、retrospective recording、小规模实验和 diagnostic work。
- 中央实验需要清楚说明它要解决什么不确定性、比较什么替代解释、什么结果算有用。
- 方法、配置、数据、指标、运行次数和结果数字必须来自实际代码、配置、日志、输出、数据文件或用户材料。
- 异常、反常、不稳定、无法复现或异常优异结果先排查实现、数据/预处理、配置/环境、随机性、指标、baseline 和分析错误，再进入科学解释。
- 新执行且需要记录的中央实验必须先写 plan，再把实际结果追加到同一 Experiment document。

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
- `dove-review` 只能在存在真实隔离、持久、可恢复审稿上下文时作为独立外部评价路径使用。
- `dove-review` 交接必须基于冻结的近投稿材料：当前完整论文、LaTeX 源、实际编译产物、实际投稿附录或补充材料，以及其他会随投稿提交的文件。
- 每轮 `dove-review` 必须只提供当轮列出的冻结材料；旧 Review、作者私有对话和未列材料默认不可见。
- 导入返回审稿时必须忠实保存实际返回，不自动开始作者回应、修订、外部搜索或缩小主张。
- Rebuttal 保持作者侧：分析意见，识别需要的证据、行动和修改，写回应并按请求修改稿件、图、补充材料、亮点或其他投稿文件。
- 新引用必须分别检查来源身份和对主张的支持；新实验解释必须来自实际实验材料。

## 投稿与完成

- 投稿论文默认以 LaTeX 源和实际编译产物为工作对象；只有目标期刊或会议官方不提供或不接受 LaTeX 时才采用其他格式。
- Dove 必须识别当前工作的源码、证据基础、构建链和最终交付物。
- 投稿完成要求同一当前版本同时满足：作者侧根据完整研究判断论文科学上已经充分；`dove-review` 根据目标期刊或会议的真实标准判断科学上可以接受（当该路径是目标的一部分）；实际提交物满足交付要求。
- 旧判断、局部任务完成、构建成功、格式完整、检查通过、安装事实或研究 Markdown 更新不能单独证明投稿就绪。

## 实现一致性

- 公共文档、实现和生成文件必须与 [研究模型](RESEARCH_MODEL.md) 一致。
- 普通提示的环境路由只为明确科研相关的非 slash 请求补充 Dove 上下文；不得选择 Skill、写文件、决定授权、继续、完成或主张范围。
- `status` 必须只读。
- 软件检查保护实现和发布行为；不得把检查结果表述为科学正确、研究完成、可复现性、接收、独立审稿或 Dove 研究质量证明。
