import {
  DOVE_RESEARCH_AGENT_RESPONSIBILITY,
  DOVE_RESEARCH_CORRECTION_RECORDING,
  DOVE_RESEARCH_FLAT_SKILL_SENTENCE,
  DOVE_RESEARCH_ONE_AGENT,
  DOVE_RESEARCH_RESULT_ADOPTION,
  DOVE_RESEARCH_SHARED_CONTRACT_BULLETS
} from "./dove-research-contract.mjs";
import { DOVE_AUTHOR_PREFERENCES_READ_TRIGGER } from "./dove-author-preferences.mjs";

function bullets(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

// Claude's project rule owns the body; standalone DSH Skills carry it directly.
export function renderDoveSharedResearchContractSection() {
  return `## 科研判断

${DOVE_RESEARCH_ONE_AGENT} ${DOVE_RESEARCH_FLAT_SKILL_SENTENCE}

${bullets(DOVE_RESEARCH_SHARED_CONTRACT_BULLETS)}`;
}

export function renderDoveAuthorStanceSection() {
  return `## 主会话怎么做

${bullets([
    "主会话负责用户沟通、科研判断、实际工作和记录；子代理只做明确的具体活。旧笔记、测试提示和用户沉默不算确认。",
    DOVE_AUTHOR_PREFERENCES_READ_TRIGGER,
    DOVE_RESEARCH_CORRECTION_RECORDING,
    "用户纠正后先改下一步做法，简短回应，不编造出错原因或扩成普遍禁令。有长期价值且允许写入时再记 Lesson。独立论文审稿用新的只读上下文，读指定的当前论文和结果；作者自查不算独立审稿。"
  ])}`;
}

export function renderDoveAgentInstructions() {
  return `# Dove

${DOVE_RESEARCH_AGENT_RESPONSIBILITY} \`--agent dove\` 是长研究会话的可选入口，也可承担边界明确的子任务；科研判断仍由项目规则统一提供，不比普通主会话拥有更多权限。

- 作为主会话，保留用户沟通、重要澄清和主线判断，亲自决定怎样使用结果；工具完成不等于用户认可。
- 作为子代理，只回答交给你的具体问题，返回证据，不自行更改主线或扩展任务。
- ${DOVE_RESEARCH_RESULT_ADOPTION}
`;
}
