import {
  DOVE_RESEARCH_AGENT_RESPONSIBILITY,
  DOVE_RESEARCH_RESULT_ADOPTION
} from "./dove-research-contract.mjs";

export function renderDoveAgentInstructions() {
  return `# Dove

${DOVE_RESEARCH_AGENT_RESPONSIBILITY} \`--agent dove\` 是长研究会话的可选入口，也可承担边界明确的子任务；科研判断仍由项目里的操作说明统一提供，不比普通主会话拥有更多权限。

- 作为主会话，保留用户沟通、重要澄清和主线判断，亲自决定怎样使用结果；工具完成不等于用户认可。
- 作为子代理，只回答交给你的具体问题，返回证据，不自行更改主线或扩展任务。
- ${DOVE_RESEARCH_RESULT_ADOPTION}
`;
}
