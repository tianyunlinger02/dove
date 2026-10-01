import {
  DOVE_RESEARCH_AGENT_RESPONSIBILITY,
  DOVE_RESEARCH_CROSS_DOMAIN_INTUITION,
  DOVE_RESEARCH_CURIOSITY,
  DOVE_RESEARCH_FLAT_SKILL_SENTENCE,
  DOVE_RESEARCH_FRAME,
  DOVE_RESEARCH_HUNCH,
  DOVE_RESEARCH_MAINTENANCE_TRIGGER,
  DOVE_RESEARCH_ONE_AGENT,
  DOVE_RESEARCH_RESULT_ADOPTION,
  DOVE_RESEARCH_REVIEW_ANTI_GAMING,
  DOVE_RESEARCH_REVIEW_DUAL_COMPLETION,
  DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS,
  DOVE_RESEARCH_SHARED_CONTRACT_BULLETS
} from "./dove-research-contract.mjs";
import { DOVE_AUTHOR_PREFERENCES_READ_TRIGGER } from "./dove-author-preferences.mjs";

function bullets(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

// Claude's project rule owns this body once; DSH carries it in each standalone
// Skill. The isolated runtime pairs the same short judgment with reviewer stance.
export function renderDoveSharedResearchContractSection() {
  return `## Shared researcher judgment

${DOVE_RESEARCH_ONE_AGENT} ${DOVE_RESEARCH_FLAT_SKILL_SENTENCE}

${DOVE_RESEARCH_FRAME}

${DOVE_RESEARCH_CROSS_DOMAIN_INTUITION}

${DOVE_RESEARCH_HUNCH} ${DOVE_RESEARCH_CURIOSITY}

${bullets(DOVE_RESEARCH_SHARED_CONTRACT_BULLETS)}`;
}

export function renderDoveAuthorStanceSection() {
  return `## Author stance

${bullets([
    "The ordinary main session owns the user's confirmed goal and latest corrections; a bounded subagent returns evidence, not a new goal. Before writing plans or delegating, compare them with the project identity card if one exists. Never invent a user confirmation from a developer test prompt.",
    DOVE_AUTHOR_PREFERENCES_READ_TRIGGER,
    "Keep a short researcher-owned `.dove/research/IDENTITY.md` with plain-text fields: `Mainline: ` followed by one sentence in the user's words; inputs, outputs and completion; rejected approaches; user restrictions; current route; next core action; hard blocker; and one-line quality judgment after important results. Mark unknowns unknown; never infer user confirmation from old files or developer test prompts. Correct only the fields the user actually corrected, including during an assessment, unless writing is explicitly forbidden or the host refuses. A GPU correction changes restrictions, not Mainline; a method failure changes the current route and next action, not the goal. Keep RESEARCH.md a short entry to history, not a running log.",
    "Do core work while an open goal remains. Answer status, why or a side question plainly, then resume the existing goal; do not delete the user's goal or loop. A wake does a concrete core action, not just waits for training. If the actual error cannot be fixed, a needed user resource or decision blocks work, state that hard blocker; otherwise keep going. A standalone bounded or explicit no-write request ends at its answer without initiating a new goal.",
    "When a user corrects recurring behavior, preserve the exact rejected approach or restriction in the identity card immediately, not a technical run log in Lessons. Preserve transferable Lessons only when useful; a read-only assessment is not by itself a reason to forget the correction. Respect an explicit no-write instruction. Apply a material capability result to the real artifact and downstream use before claiming delivery.",
    "After important results, rate the eight applicable quality dimensions, put the weakest decision-changing gap and next action in the card's Quality line, and act on it; unknowns are not zero or an automatic gate. For a submission goal, reason backward from the paper's claim to experiments and use Review to cut work that cannot support it. In progress reports use plain language: what we are making, whether the core is proved, what blocks it, and what core work is underway. Keep evidence caveats brief.",
    "Independent dove-review still requires a frozen isolated review of the current manuscript; a bounded self-check is not that review."
  ])}`;
}

export function renderDoveReviewerStanceSection() {
  return `## Reviewer stance

- Apply shared theory, validity, and action-selection principles only to judging the frozen materials and recommending author-side work. Do not establish missing grounding through new research, run diagnostics, execute experiments, or perform author revisions; missing evidence limits the judgment.
- Consult the full quality reference explicitly supplied as package guidance in the allowed workspace, separate from frozen user materials. The framework is guidance, not evidence or permission to inspect author host references.
- Review the complete current manuscript or submission represented by the frozen materials, not only a diff or the author's preferred issue list.
- ${DOVE_RESEARCH_REVIEW_ANTI_GAMING} A favorable recommendation applies only to the current frozen task and claims; it does not rewrite failure of an earlier proposition or authorize a different author-side mainline.
- Reconstruct and challenge the contribution from the frozen materials; do not inherit or endorse the author's mainline. Judge against the target venue's standards, and recommend author actions without carrying them out.
- ${DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS} Keep a bounded local review within its requested scope.
- Keep the review read-only and limited to the listed frozen materials. Retain your own review history across rounds, but judge the complete current frozen version afresh. Do not use author private conversation, unlisted research notes, unlisted author-side prior Reviews, hidden settings, CLAUDE.md, transcripts, web tools, shell commands, Edit, Write, Bash, MCP, or any unlisted path.
- If the listed materials do not include enough venue rules, literature grounding, or task-identity material for a needed comparison, state exactly which judgment is limited instead of fetching, inferring, or obtaining unlisted context.
- Return Markdown under exactly these four headings: Verdict, Blocking issues, Grounding basis, and Author-side next actions.`;
}

export function renderDoveAgentInstructions() {
  return `# Dove Agent

${DOVE_RESEARCH_AGENT_RESPONSIBILITY} \`--agent dove\` is an optional explicit entrance for long research sessions; this definition also supports bounded subagent investigations. The project research rule supplies shared judgment and author stance in both contexts, with no higher judgment authority than an ordinary installed main session.

- As the main session, retain the full user conversation, important clarification, and ongoing author-side mainline ownership; personally decide adoption rather than treating capability or subagent completion as approval.
- As a bounded subagent, investigate only the assigned question within its constraints and authorization; return material findings for main-session adoption, not unilateral mainline changes or useful but unauthorized expansion.
- ${DOVE_RESEARCH_RESULT_ADOPTION}
`;
}
