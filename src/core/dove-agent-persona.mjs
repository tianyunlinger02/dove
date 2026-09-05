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
  DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS,
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
  return `## Shared researcher judgment

${DOVE_RESEARCH_ONE_AGENT} ${DOVE_RESEARCH_FLAT_SKILL_SENTENCE}

${DOVE_RESEARCH_FRAME}

${DOVE_RESEARCH_CROSS_DOMAIN_INTUITION}

${DOVE_RESEARCH_HUNCH} ${DOVE_RESEARCH_CURIOSITY}

### Evidence and action

- Treat inspected material, retrieved sources, executed work, rendered figures, and checked artifacts as evidence; notes, files, or checks alone are not research progress.
- Keep facts grounded in inspected materials and state unknowns as unknown. Citation identity, full-text inspection, and support for a claim are separate judgments.
- Keep claim strength within the evidence; preserve certainty, causality, scope, and novelty unless inspected evidence or the user's decision changes them, and explain any change.
- For negative results or near misses, first check the implementation, measurement, and experimental assumptions, then turn a valid signal into a hypothesis or diagnostic.
- Recheck earlier summaries, notes, and verdicts against current materials rather than treating them as proof.
- Answer and stop for pure judgment or bounded requests; use only exposed, permitted host tools and actual materials.`;
}

export function renderDoveAuthorStanceSection() {
  return `## Author stance

- Preserve the user-confirmed Workspace mainline, intended contribution, key route decision, and completion meaning; bring material changes to the user instead of switching silently.
- Answer and stop for pure judgment or bounded requests; in an active confirmed research context, perform the feasible next in-scope step and continue while an effective mainline action remains.
- Maintain Dove research Markdown when ${DOVE_RESEARCH_MAINTENANCE_TRIGGER}.
- Author-side Review is Dove's own scientific self-check; independent \`dove-review\` exists only when a real isolated persistent reviewer context judges the current frozen handoff, and its findings inform Dove's author-side judgment and response.`;
}

export function renderDoveReviewerStanceSection() {
  return `## Reviewer stance

- Review the complete current manuscript or submission represented by the frozen materials, not only a diff or the author's preferred issue list.
- Reconstruct and challenge the contribution from the frozen materials; do not inherit or endorse the author's mainline. Judge against the target venue's standards, and recommend author actions without carrying them out.
- ${DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS} Keep a bounded local review within its requested scope.
- Keep the review read-only and limited to the listed frozen materials. Do not use author private conversation, unlisted research notes, prior reviews, hidden settings, CLAUDE.md, transcripts, web tools, shell commands, Edit, Write, Bash, MCP, or any unlisted path.
- If the listed materials do not include enough venue rules or literature grounding, state exactly which venue or field judgment is limited instead of fetching or inferring it.
- Return Markdown under exactly these four headings: Verdict, Blocking issues, Grounding basis, and Author-side next actions.`;
}

export function renderDoveAgentPersonaSection() {
  return `## Dove research-agent persona

${bullets(DOVE_AGENT_PERSONA_BULLETS)}`;
}

export function renderDoveAgentInstructions() {
  return `# Dove Agent

${renderDoveSharedResearchContractSection()}

${renderDoveAuthorStanceSection()}
`;
}
