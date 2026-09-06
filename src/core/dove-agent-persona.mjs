import {
  DOVE_RESEARCH_AGENT_DESCRIPTION,
  DOVE_RESEARCH_AGENT_NAME,
  DOVE_RESEARCH_CAPSULE_BULLETS,
  DOVE_RESEARCH_CROSS_DOMAIN_INTUITION,
  DOVE_RESEARCH_CURIOSITY,
  DOVE_RESEARCH_DIRECT_JUDGMENT,
  DOVE_RESEARCH_EVIDENCE_DRIVEN_CLAIM_BOUNDARY,
  DOVE_RESEARCH_FLAT_SKILL_SENTENCE,
  DOVE_RESEARCH_FRAME,
  DOVE_RESEARCH_HUNCH,
  DOVE_RESEARCH_LAYERING,
  DOVE_RESEARCH_MAINTENANCE_TRIGGER,
  DOVE_RESEARCH_MAINLINE_ANCHORING,
  DOVE_RESEARCH_ONE_AGENT,
  DOVE_RESEARCH_PERSONA_BULLETS,
  DOVE_RESEARCH_PROPORTIONALITY,
  DOVE_RESEARCH_REAL_BLOCKER,
  DOVE_RESEARCH_REVIEW_DUAL_COMPLETION,
  DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS,
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

function bullets(items, coveredText = "") {
  return items.filter((item) => !coveredText.includes(item)).map((item) => `- ${item}`).join("\n");
}

export function renderDoveSharedResearchContractSection({ compact = false, coveredText = "" } = {}) {
  if (compact) return `## Research judgment\n\n${bullets(DOVE_RESEARCH_SHARED_CONTRACT_BULLETS, coveredText)}`;
  return `## Shared researcher judgment

${DOVE_RESEARCH_ONE_AGENT} ${DOVE_RESEARCH_FLAT_SKILL_SENTENCE}

${DOVE_RESEARCH_FRAME}

${DOVE_RESEARCH_CROSS_DOMAIN_INTUITION}

${DOVE_RESEARCH_HUNCH} ${DOVE_RESEARCH_CURIOSITY}

### Evidence and action

${bullets(DOVE_RESEARCH_SHARED_CONTRACT_BULLETS, coveredText)}`;
}

export function renderDoveAuthorStanceSection({ compact = false, coveredText = "" } = {}) {
  const shared = [
    DOVE_RESEARCH_MAINLINE_ANCHORING,
    "Answer and stop for pure judgment or bounded requests; in an active confirmed research context, perform the feasible next in-scope step and continue while an effective mainline action remains. Read-only requests authorize inspection and reporting, not execution or recording.",
    DOVE_RESEARCH_EVIDENCE_DRIVEN_CLAIM_BOUNDARY,
    DOVE_RESEARCH_REAL_BLOCKER,
    DOVE_RESEARCH_REVIEW_DUAL_COMPLETION
  ];
  if (!compact) shared.push(
    `Maintain Dove research Markdown when ${DOVE_RESEARCH_MAINTENANCE_TRIGGER}.`,
    "Author-side Review is Dove's own scientific self-check; independent `dove-review` exists only when a real isolated persistent reviewer context judges the current frozen handoff, and its findings inform Dove's author-side judgment and response."
  );
  return `## Author stance\n\n${bullets(shared, coveredText)}`;
}

export function renderDoveReviewerStanceSection() {
  return `## Reviewer stance

- Apply shared theory, validity, and action-selection principles only to judging the frozen materials and recommending author-side work. Do not establish missing grounding through new research, run diagnostics, execute experiments, or perform author revisions; missing evidence limits the judgment.
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
