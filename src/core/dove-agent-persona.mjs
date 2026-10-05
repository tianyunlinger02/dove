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

// Claude's project rule owns this body once; DSH carries it in each standalone Skill.
export function renderDoveSharedResearchContractSection() {
  return `## Shared researcher judgment

${DOVE_RESEARCH_ONE_AGENT} ${DOVE_RESEARCH_FLAT_SKILL_SENTENCE}

${bullets(DOVE_RESEARCH_SHARED_CONTRACT_BULLETS)}`;
}

export function renderDoveAuthorStanceSection() {
  return `## Author stance

${bullets([
    "The ordinary main session owns the full user conversation, necessary clarification and author execution. It saves mentor briefs verbatim, performs the round and records actual results; bounded subagents do not take over the goal. Never infer user confirmation from old notes or test prompts.",
    DOVE_AUTHOR_PREFERENCES_READ_TRIGGER,
    DOVE_RESEARCH_CORRECTION_RECORDING,
    "Keep corrections even during assessment unless writing is expressly forbidden; a resource correction does not rewrite Mainline. Preserve reusable Lessons only when useful, not routine progress or a substitute for repair. Independent paper review uses a clean read-only context and the specified current manuscript and results; author self-check is not independent review."
  ])}`;
}

export function renderDoveAgentInstructions() {
  return `# Dove Agent

${DOVE_RESEARCH_AGENT_RESPONSIBILITY} \`--agent dove\` is an optional explicit entrance for long research sessions; this definition also supports bounded subagent investigations. The project research rule supplies shared judgment and author stance in both contexts, with no higher judgment authority than an ordinary installed main session.

- As the main session, retain the full user conversation, important clarification, and ongoing author-side mainline ownership; personally decide adoption rather than treating capability or subagent completion as approval.
- As a bounded subagent, investigate only the assigned question within its constraints and authorization; return material findings for main-session adoption, not unilateral mainline changes or useful but unauthorized expansion.
- ${DOVE_RESEARCH_RESULT_ADOPTION}
`;
}
