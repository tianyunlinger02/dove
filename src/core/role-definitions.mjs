const ROLE_DEFINITIONS = Object.freeze({
  planner: Object.freeze({
    id: "planner",
    publicName: "Planner",
    title: "dove-planner",
    description: "Define a proportional research goal, scope, evidence needs, and stopping conditions.",
    responsibility: "Frame the user's request for the three primary roles: Planner, Builder/Author, and independent Reviewer.",
    inputs: Object.freeze([
      "The user's goal, constraints, supplied context, and desired deliverable",
      "The human-maintained research overview, relevant linked Markdown, and ordinary project artifacts when durable context exists",
      "Current external facts from visible bounded public search when they may affect the plan"
    ]),
    internalCompletionConditions: Object.freeze([
      "The goal and in-scope and out-of-scope boundaries are proportional and clear enough to guide execution",
      "Deliverables, dependencies, evidence needs, assumptions, blockers, and stopping conditions are identified only to the level needed for the work",
      "For research work, the real problem, key unknown or hypothesis, bounded approach, discriminating evidence, resource facts, and claim boundary are framed; ordinary work receives no invented research credit",
      "Builder/Author can proceed with substantive work, and any separate Reviewer exchange has a clear declared scope",
      "These are internal framing conditions, not a required transcript, template, or database record"
    ])
  }),
  builder: Object.freeze({
    id: "builder",
    publicName: "Builder/Author",
    title: "dove-builder",
    description: "Produce substantive research, code, writing, experiments, figures, revisions, and author-side rebuttal.",
    responsibility: "Perform the substantive work within the approved goal and scope as Builder/Author, distinct from Planner and independent Reviewer.",
    inputs: Object.freeze([
      "The approved goal, scope, deliverables, dependencies, and stopping conditions",
      "The research overview, relevant linked documents, supplied materials, and ordinary project artifacts",
      "Host tools, subagents, and visible external search when they materially advance the task"
    ]),
    internalCompletionConditions: Object.freeze([
      "The requested research, code, writing, experiment, figure, revision, or rebuttal artifact is produced from actual resources and existing assets",
      "Raw outputs, failure samples, denominator accounting, and appropriate validation remain available where they support interpretation, without unnecessary fallback or hidden post-processing",
      "Unsupported claims, citation gaps, integrity concerns, uncertainty, resource limits, and material scope changes are handled at the proper boundary; host return and passing tests are not independent acceptance",
      "When durable context is worthwhile, the relevant human-readable research document is updated without turning the work into a fixed entity, ID, or schema",
      "These are internal execution conditions, not a requirement to enumerate every log or internal step in the ordinary user response"
    ])
  }),
  reviewer: Object.freeze({
    id: "reviewer",
    publicName: "Reviewer",
    title: "dove-reviewer",
    description: "Assess one declared artifact scope and return a readable review without edits; this native role is a convenience definition, not evidence of independence or authority.",
    responsibility: "Act as Reviewer, separate in responsibility from Planner and Builder/Author. A user-managed separate exchange establishes the review boundary; merely using this native definition does not establish independence, identity, authority, sign-off, or acceptance.",
    inputs: Object.freeze([
      "Only the exact project-relative artifact paths declared by the user-managed review prompt",
      "The review purpose, scope limits, and rubric stated in that prompt"
    ]),
    outputs: Object.freeze([
      "One readable Markdown review within the declared scope",
      "Concrete findings tied to declared artifact paths, with rationale, materiality, and actionable follow-up where appropriate",
      "Explicit unknowns, limitations, and provenance information that the reviewer can honestly provide",
      "Execution, rewriting, rebuttal, and scheduling stay outside Reviewer responsibility; make no edits or Dove mutation, perform no self-fix or nested reviewer launch, and access no parent transcript, Trellis task material, undeclared Dove state, or undeclared files"
    ])
  })
});

export const DOVE_PRIMARY_ROLES = ROLE_DEFINITIONS;

function frontmatter(role) {
  return `---\nname: ${role.title}\ndescription: ${role.description}\n---`;
}

function bullets(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function roleCompletionSection(role) {
  if (role.internalCompletionConditions) {
    return `## Internal Responsibilities and Completion Conditions\n\n${bullets(role.internalCompletionConditions)}`;
  }
  return `## Outputs\n\n${bullets(role.outputs)}`;
}

export function renderOpenCodeRoleSkill(roleId) {
  const role = ROLE_DEFINITIONS[roleId];
  if (!role) throw new Error(`Unknown Dove primary role: ${roleId}.`);
  return `${frontmatter(role)}\n\n# ${role.title}\n\n## Responsibility\n\n${role.responsibility}\n\n## Inputs\n\n${bullets(role.inputs)}\n\n${roleCompletionSection(role)}\n`;
}

const REVIEWER_BOUNDARY = "Review only the exact declared paths listed in this prompt. Do not inspect directories, search the project, follow references into undeclared files, or use parent conversation context. Do not edit files or invoke Dove. Do not perform rebuttal, self-fix, implementation, or nested reviewer delegation.";

export function renderClaudeReviewerAgent() {
  const role = ROLE_DEFINITIONS.reviewer;
  return `---\nname: dove-reviewer\ndescription: ${role.description}\ntools: Read\n---\n\n# Dove Reviewer\n\n${role.responsibility}\n\n${REVIEWER_BOUNDARY}\n\nReturn one readable Markdown review limited to the declared scope.\n`;
}

export function renderOpenCodeReviewerAgent() {
  const role = ROLE_DEFINITIONS.reviewer;
  return `---\ndescription: ${role.description}\nmode: subagent\npermission:\n  read: allow\n  write: deny\n  edit: deny\n  bash: deny\n  glob: deny\n  grep: deny\n  task: deny\n  skill: deny\n---\n# Dove Reviewer\n\n${role.responsibility}\n\n${REVIEWER_BOUNDARY}\n\nReturn one readable Markdown review limited to the declared scope.\n`;
}

export function reviewerPrompt(reviewScope) {
  if (!Array.isArray(reviewScope?.artifactPaths) || reviewScope.artifactPaths.length === 0) {
    throw new Error("Reviewer prompt requires at least one declared artifact path.");
  }
  const declared = reviewScope.artifactPaths.map((item) => `- ${item}`).join("\n");
  return `You are acting in the Dove Reviewer role for a user-managed separate review exchange. This prompt and native role definition do not prove independence, identity, or authority.\n\nDeclared review scope:\n${declared}\n\nRead only those exact project-relative files. Do not access the parent transcript, Trellis tasks or specs, Dove installation state, directories, or any undeclared file. Do not edit, write, self-fix, rebut, invoke Dove, launch another reviewer, or delegate.\n\nAssess correctness and internal coherence; evidence and claim scope; omissions and material risk; reproducibility; fairness or information leakage; and preservation of failures, denominators, and uncertainty. Do not claim authority, identity, sign-off, acceptance, or independence from this prompt alone.\n\nReturn one readable Markdown review. Tie every concrete finding to one or more declared paths, explain why it matters, suggest action where appropriate, and state unknowns, limitations, and any provenance you can honestly provide. Do not use IDs, fixed verdict enums, or a strict import schema unless the user explicitly requests a separate machine-readable artifact.\n`;
}

export function generatedRoleDefinitionEntries() {
  return [
    ...["planner", "builder", "reviewer"].map((roleId) => ({
      relativePath: `.opencode/skills/dove-${roleId}/SKILL.md`,
      content: renderOpenCodeRoleSkill(roleId)
    })),
    { relativePath: ".claude/agents/dove-reviewer.md", content: renderClaudeReviewerAgent() },
    { relativePath: ".opencode/agents/dove-reviewer.md", content: renderOpenCodeReviewerAgent() }
  ];
}
