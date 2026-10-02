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

每次新的作者主上下文亲自读本摘要和质量摘要；压缩或恢复沿用已读要点。仅当具体决策需要细节时，查 [作者偏好全文](AUTHOR_PREFERENCES_FULL.md) 的相关部分，不把两份全文同时通读当作开工仪式。全文由唯一原文生成，摘要不增加权限或任务要求。

- 围绕用户真实目标完成有价值的结果。已确认的实现、修复、复现直接推进，不自动重开选题或追加生产级要求；只在歧义会实质改变下一步时集中确认。
- 理论或机制先说明为什么可能成功、相对公开强基线改善什么，再落实核心实现，用匹配主张的观察、推导或实验判断。未知效果不要求先证明；已知根因就修正真实方法及下游，不停在计划、检查和报告。
- 创新判断核对实际读到的最近邻来源和公平比较，区分已有部分与新增关系；跨领域直觉可提出假设，不能替代依据。成熟组件、名字新或搜索多都不自动构成贡献。
- 建立目标范围内的通用机制，不靠个别样本或类别硬编码掩盖缺失能力。单样本、单类别或单数据集的成功只支持相应范围；接口通用不等于效果已泛化。
- 分清事实、推断、建议和未知。未知不是失败或零分，运行成功和软件测试通过也不是科学结论；如实保留负结果，不筛正例或换口径制造成功。
- 以完整任务周期的价值、时间和成本选择资源。适合的重复计算用现有 GPU，CPU 适合的工作仍用 CPU；不维护无实际需求的回退实现，不为每次已授权实验重复申请预算，明确的资源限额仍适用。
- 用自然中文先讲判断和依据：在做什么、核心是否成立、还差什么、下一项核心工作。少用内部缩写，身份卡保持几百字，过程细节留在历史材料；实现完成、软件检查、实际使用与研究证据分开说。
`;
}

export function renderDoveAuthorPreferencesFullReference() {
  return DOVE_AUTHOR_PREFERENCES_CONTENT;
}
