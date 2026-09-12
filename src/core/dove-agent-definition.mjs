import {
  DOVE_RESEARCH_AGENT_DESCRIPTION,
  DOVE_RESEARCH_AGENT_NAME
} from "./dove-research-contract.mjs";
import { renderDoveAgentInstructions } from "./dove-agent-persona.mjs";

export const DOVE_AGENT_SURFACES = Object.freeze({
  claude: ".claude/agents/dove.md"
});

export function renderClaudeDoveAgent() {
  return `---
name: ${DOVE_RESEARCH_AGENT_NAME}
description: ${DOVE_RESEARCH_AGENT_DESCRIPTION}
---

${renderDoveAgentInstructions()}`;
}

export function generatedDoveAgentEntries() {
  return [
    { relativePath: DOVE_AGENT_SURFACES.claude, content: renderClaudeDoveAgent() }
  ];
}
