import { DOVE_RESEARCH_AGENT_RESPONSIBILITY } from "./dove-research-contract.mjs";
import {
  DOVE_AGENT_DESCRIPTION,
  DOVE_AGENT_NAME,
  renderDoveAgentInstructions
} from "./dove-agent-persona.mjs";

export const DOVE_AGENT_SURFACES = Object.freeze({
  claude: ".claude/agents/dove.md"
});

export const DOVE_AGENT_DEFINITION = Object.freeze({
  id: DOVE_AGENT_NAME,
  publicName: "Dove",
  title: DOVE_AGENT_NAME,
  description: DOVE_AGENT_DESCRIPTION,
  responsibility: DOVE_RESEARCH_AGENT_RESPONSIBILITY
});

export function renderClaudeDoveAgent() {
  return `---
name: ${DOVE_AGENT_NAME}
description: ${DOVE_AGENT_DESCRIPTION}
---

${renderDoveAgentInstructions()}`;
}

export function generatedDoveAgentEntries() {
  return [
    { relativePath: DOVE_AGENT_SURFACES.claude, content: renderClaudeDoveAgent() }
  ];
}
