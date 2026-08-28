# Dove 开发纲领

本目录记录 Dove 长期稳定的开发理论、产品目标、核心需求和最终期望。

建立这个目录，是为了避免实现细节、临时任务、旧 Review、测试结果、研究笔记或历史 PRD 在无意中重新定义 Dove。Dove 可以随着证据演进，但产品方向必须清楚、稳定且可追溯。

## 文档

- [愿景与设计理念](VISION_AND_PRINCIPLES.md)：Dove 为什么存在，以及应长期坚持的高层原则。
- [研究模型](RESEARCH_MODEL.md)：Workspace 主线、Mission、研究树、Auto、Review、证据与产物之间的关系。
- [产品需求](PRODUCT_REQUIREMENTS.md)：产品和实现必须满足的规范性要求。
- [最终期望](FINAL_EXPECTATIONS.md)：我们最终希望 Dove 在真实使用中表现成什么样。

## 核心契约

- Workspace 主线由用户确认，并作为当前方向、边界和完成含义的稳定权威。证据可以改变主线内的路线、假设、结论和产物；需要实质换线时由用户决定。
- 贡献是否充分是相对于主线、目标读者或 venue、真实证据和权威产物的当下判断，不是分数、状态或 checklist。贡献不足时先判断主要缺口是方法、证据、实验、来源、写作还是交付。
- Mission 是主线下的有边界语义单元，不是任务数据库记录。Review 是反方判断：Direct Scientific Review 是作者侧只读自查，独立 Reviewer 交接必须使用冻结材料和真实隔离且持久的 Reviewer 上下文；findings 必须由当前 Dove 吸收、以证据 clarification/rebuttal 驳回，或转化为行动，不能替代主线权威。
- Dove 继续工作的标准是 materiality：下一步是否能实质改变主线判断、贡献可信度或必要交付物。Auto 是一个明确启动的外层前台会话，内部可有多个科学回合；低价值、收益递减的润色不能让 Auto 无限继续。
- 投稿论文默认以真实 LaTeX 源和实际编译产物为权威；只有目标 venue 官方不提供或不接受 LaTeX 时才采用其他格式。
- 长运行、等待和恢复只使用当前宿主实际提供的 background、Monitor、Cron、loop、tmux 或等价能力。它们是宿主连续性支持，不是 Dove runtime、daemon、scheduler、queue 或研究数据库。上下文或 API 中断是 operational interruption，不是产品停止。

## 文档权威边界

本目录是 Dove 稳定产品语义的开发纲领，但不是运行数据库，也不取代真实研究。

其他材料各有职责：

- `.dove/research/` 保存 Dove 开发过程中正在演进的主线、Mission、证据、实验、Review 和 Lessons。它可以发现需要纳入本纲领的新认识，但不会因为更新得更晚就自动成为产品权威。
- `.trellis/spec/` 记录已经确认的产品要求如何落实为仓库工程规范。
- `src/core/` 是可执行的权威实现。
- 根目录 `README.md` 和 `docs/` 下其他文档面向产品使用者。
- generated host resources 是实现的投影，不能独立定义产品。
- 历史 PRD、旧 Review、任务列表、compaction summary、日志和 validator 都是参考或支撑材料，不能未经重新判断就成为当前需求。

当前 `.dove/` 目录继续保留。本目录不迁移、不删除也不替代其中的实时开发研究。

## 维护原则

涉及 Dove 产品含义的实质变化，应先更新本目录，或与实现和公共投影在同一次变更中更新。

文档应优先保留少量清楚、正向、可长期使用的原则。不要把每次纠错都追加成新的概念、流程层、例外列表或防御性规则。

静态验证只能证明软件事实，如契约、生成、投影和边界一致。Dove 是否具备良好的科研判断，最终必须通过真实任务中的行动、证据吸收、Review findings 处理和交付物来检验。
