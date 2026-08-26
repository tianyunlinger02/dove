import {
  DOVE_RESEARCH_AGENT_DESCRIPTION,
  DOVE_RESEARCH_AGENT_NAME,
  DOVE_RESEARCH_AUTO_EXPLICIT_ONLY,
  DOVE_RESEARCH_CAPSULE_BULLETS,
  DOVE_RESEARCH_CURIOSITY,
  DOVE_RESEARCH_DIRECT_JUDGMENT,
  DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY,
  DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY,
  DOVE_RESEARCH_FLAT_SKILL_SENTENCE,
  DOVE_RESEARCH_FRAME,
  DOVE_RESEARCH_HOST_TOOL_BOUNDARY,
  DOVE_RESEARCH_HUNCH,
  DOVE_RESEARCH_LAYERING,
  DOVE_RESEARCH_MAINTENANCE_TRIGGER,
  DOVE_RESEARCH_MANUSCRIPT_REVIEW_GATE,
  DOVE_RESEARCH_MANUSCRIPT_REVIEW_LOOP,
  DOVE_RESEARCH_ONE_AGENT,
  DOVE_RESEARCH_PERSONA_BULLETS,
  DOVE_RESEARCH_PROPORTIONALITY,
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

export function renderDoveAgentPersonaSection() {
  return `## Dove research-agent persona\n\n${bullets(DOVE_AGENT_PERSONA_BULLETS)}`;
}

export function renderDoveAgentInstructions() {
  return `# Dove Agent

${DOVE_RESEARCH_ONE_AGENT} ${DOVE_RESEARCH_FLAT_SKILL_SENTENCE}

${renderDoveAgentPersonaSection()}

## Tool and Markdown boundaries

- ${DOVE_RESEARCH_HOST_TOOL_BOUNDARY}
- Maintain Dove research Markdown when ${DOVE_RESEARCH_MAINTENANCE_TRIGGER}.
- ${DOVE_RESEARCH_DIRECT_JUDGMENT}
- When a review is requested, use reviewer perspective to test the claim, evidence, method, novelty, limitations, and likely reader confusion; separate review handoffs remain user-managed.
- For a manuscript submission-readiness Auto mainline, ${DOVE_RESEARCH_MANUSCRIPT_REVIEW_GATE} ${DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY} ${DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY} ${DOVE_RESEARCH_MANUSCRIPT_REVIEW_LOOP}
- ${DOVE_RESEARCH_AUTO_EXPLICIT_ONLY} It runs as a goal/mission cycle until the goal is achieved, a real boundary appears, or the budget ends.
- Do not expose planning, authoring, or reviewing as user-switchable Dove personas. Separate review remains a user-managed exchange, not proof of independence or authority.
`;
}
