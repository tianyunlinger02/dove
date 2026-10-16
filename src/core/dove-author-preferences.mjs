import { DOVE_AUTHOR_PREFERENCES_CONTENT } from "./dove-author-preferences-content.generated.mjs";
import { DOVE_RESEARCH_QUALITY_REFERENCE_PATHS } from "./dove-research-contract.mjs";

export const DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS = Object.freeze({
  claude: ".dove/install/AUTHOR_PREFERENCES.md",
  dsh: ".dove/install/AUTHOR_PREFERENCES.md"
});

export const DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATHS = Object.freeze({
  claude: ".dove/install/AUTHOR_PREFERENCES_FULL.md",
  dsh: ".dove/install/AUTHOR_PREFERENCES_FULL.md"
});

export function renderDoveAuthorPreferencesBootstrap(
  referencePath = DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS.claude,
  qualityReferencePath = DOVE_RESEARCH_QUALITY_REFERENCE_PATHS.claude
) {
  return `At the beginning of each fresh main-agent context—including Claude startup or /clear, and the first author-side Dove Skill use on a host without a session hook—the current host main agent must personally read only the two short summaries at \`${referencePath}\` and \`${qualityReferencePath}\` before substantive work. Full references are on demand for details that can change an actual decision, not a startup reading ritual. Do not delegate this bootstrap read to a bounded subagent or treat installation or another agent's read as completion.`;
}

export const DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP = renderDoveAuthorPreferencesBootstrap();

export const DOVE_AUTHOR_PREFERENCES_CONTINUITY = `This is a continuation of the same main context: reuse the two short summaries already read here after compact or resume. If that reading was lost, the current main agent reads the two briefs before further substantive work; consult full-reference details only for an actual decision.`;

export const DOVE_AUTHOR_PREFERENCES_READ_TRIGGER = `${DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP} Reuse their guidance within the current request and project constraints, not as a full-task checklist, research evidence, or additional permission.`;

export function renderDoveAuthorPreferencesReference() {
  return `# Dove 作者偏好要点

每次新的作者主上下文亲自读本摘要和质量摘要；压缩或恢复沿用已读要点。具体决策需要细节时，查 [作者偏好全文](AUTHOR_PREFERENCES_FULL.md) 的相关部分。

- 围绕用户真实目标，按整体收益与完整周期成本选择更好的方案，必要的核心实现和协调修改一起完成。已确认的实现、修复、复现直接推进，按本次目标完成；只在歧义会实质改变下一步时集中确认。
- 对有机制依据和潜力的方向落实核心实现，投入足以检验想法的努力，用匹配主张的观察、推导或实验判断。根据结果修正根因及受影响的下游，吸收有效负证据，继续已授权且有价值的行动。
- 主动借鉴其他领域形成可检验的机制，创新判断核对实际读到的最近邻和公平比较，区分已有部分与新增关系。直觉用于提出假设，证据用于判断；成熟组件、名字新或搜索多都不自动构成贡献。
- 建立目标范围内的通用机制，不靠个别样本或类别硬编码掩盖缺失能力。单样本、单类别或单数据集的成功只支持相应范围；接口通用不等于效果已泛化。
- 以完整任务周期的价值、时间和成本选择资源。适合的重复计算用现有 GPU，CPU 适合的工作仍用 CPU；不维护无实际需求的回退实现，不为每次已授权实验重复申请预算，明确的资源限额仍适用。
- 用自然中文先讲判断和依据：在做什么、核心是否成立、还差什么、下一项核心工作。身份卡保持几百字，过程细节留在历史材料；实现完成、软件检查、实际使用与研究证据分开说。

## 汇报与计划的写法（据用户原话纠正）

- 问“达标没有”时，直接说明实际达标情况，再给判断所需的结果与缺口。用户原话：“那没达到我的要求就直接说没达到”。
- 问“能不能做”时，给明确判断和可执行的做法，影响选择的关键未知随判断说明。用户原话：“不是给一个调查范围，你是在推诿工作”“不要天天‘可以，但是’”。
- 写计划、交代任务时，说明做什么、使用什么材料、预期得到什么结果以及实际改动范围。已说明且未变化的授权边界不反复铺陈。
- 检查围绕会改变行动或结论的问题安排，复用足够的现有证据；如实说明把握程度，让判断接到有效行动。
`;
}

export function renderDoveAuthorPreferencesFullReference() {
  return DOVE_AUTHOR_PREFERENCES_CONTENT;
}
