import {
  DOVE_RESEARCH_AGENT_DESCRIPTION,
  DOVE_RESEARCH_AGENT_NAME,
  DOVE_RESEARCH_CAPSULE_BULLETS,
  DOVE_RESEARCH_CROSS_DOMAIN_INTUITION,
  DOVE_RESEARCH_CURIOSITY,
  DOVE_RESEARCH_DIRECT_JUDGMENT,
  DOVE_RESEARCH_FLAT_SKILL_SENTENCE,
  DOVE_RESEARCH_FRAME,
  DOVE_RESEARCH_HUNCH,
  DOVE_RESEARCH_LAYERING,
  DOVE_RESEARCH_MAINTENANCE_TRIGGER,
  DOVE_RESEARCH_ONE_AGENT,
  DOVE_RESEARCH_PERSONA_BULLETS,
  DOVE_RESEARCH_PROPORTIONALITY,
  DOVE_RESEARCH_SHARED_CONTRACT_BULLETS,
  DOVE_RESEARCH_STOPPING
} from "./dove-research-contract.mjs";

export const DOVE_AGENT_NAME = DOVE_RESEARCH_AGENT_NAME;
export const DOVE_AGENT_DESCRIPTION = DOVE_RESEARCH_AGENT_DESCRIPTION;

export const DOVE_AGENT_FRAME = DOVE_RESEARCH_FRAME;
export const DOVE_AGENT_HUNCH = DOVE_RESEARCH_HUNCH;
export const DOVE_AGENT_CURIOSITY = DOVE_RESEARCH_CURIOSITY;
export const DOVE_AGENT_LAYERING = DOVE_RESEARCH_LAYERING;
export const DOVE_AGENT_PROPORTIONALITY = DOVE_RESEARCH_PROPORTIONALITY;
export const DOVE_AGENT_STOPPING = DOVE_RESEARCH_STOPPING;

export const DOVE_AGENT_PERSONA_BULLETS = DOVE_RESEARCH_PERSONA_BULLETS;
export const DOVE_AGENT_CAPSULE_BULLETS = DOVE_RESEARCH_CAPSULE_BULLETS;
export const DOVE_AGENT_DIRECT_JUDGMENT = DOVE_RESEARCH_DIRECT_JUDGMENT;

function bullets(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function renderDoveSharedResearchContractSection() {
  return `## Shared research commitments\n\n${bullets(DOVE_RESEARCH_SHARED_CONTRACT_BULLETS)}`;
}

export function renderDoveAgentPersonaSection() {
  return `## Dove research-agent persona\n\n${bullets(DOVE_AGENT_PERSONA_BULLETS)}`;
}

export function renderDoveAgentInstructions() {
  return `# Dove Agent

${DOVE_RESEARCH_ONE_AGENT} ${DOVE_RESEARCH_FLAT_SKILL_SENTENCE}

## Research judgment

${DOVE_RESEARCH_FRAME}

${DOVE_RESEARCH_CROSS_DOMAIN_INTUITION}

${DOVE_RESEARCH_HUNCH} ${DOVE_RESEARCH_CURIOSITY}

## Evidence, scope, and follow-through

- Treat inspected material, retrieved sources, executed work, rendered figures, and checked artifacts as evidence; notes, files, or checks alone are not research progress.
- Preserve the user-confirmed Workspace mainline, intended contribution, key route decision, and completion meaning; bring material changes to the user instead of switching silently.
- For negative results or near misses, first check validity, then turn the signal into a new hypothesis, diagnostic, or route update rather than discarding it.
- Answer and stop for pure judgment or bounded requests; in an active confirmed research context, perform the feasible next in-scope step and continue while an effective mainline action remains.
- Use only exposed, permitted host tools and actual materials. Maintain Dove research Markdown when ${DOVE_RESEARCH_MAINTENANCE_TRIGGER}.
- Author-side Review is Dove's own scientific self-check; independent \`dove-review\` exists only when a real isolated persistent reviewer context judges the current frozen handoff, and its findings inform Dove's author-side judgment and response.
`;
}
