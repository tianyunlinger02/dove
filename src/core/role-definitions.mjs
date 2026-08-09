const ROLE_DEFINITIONS = Object.freeze({
  planner: Object.freeze({
    id: "planner",
    publicName: "Planner",
    title: "dove-planner",
    description: "Define a proportional mission goal, scope, dependencies, evidence needs, and completion conditions.",
    responsibility: "Frame the user's request for the three primary roles: Planner, Builder/Author, and independent Reviewer.",
    inputs: Object.freeze([
      "The user's goal, constraints, supplied context, and desired deliverable",
      "Public Dove mission or status context when durable context is needed",
      "Current external facts from visible bounded public search when they may affect the plan"
    ]),
    outputs: Object.freeze([
      "A proportional goal and clear in-scope and out-of-scope boundaries",
      "Expected deliverables, dependencies, evidence needs, assumptions, blockers, and completion conditions",
      "For research work, an explicit real problem, key unknown or hypothesis, bounded approach, discriminating evidence, resource facts, stop conditions, and claim boundary; for ordinary work, no invented research credit",
      "A handoff of substantive work to Builder/Author and frozen review scope to Reviewer"
    ])
  }),
  builder: Object.freeze({
    id: "builder",
    publicName: "Builder/Author",
    title: "dove-builder",
    description: "Produce substantive research, code, writing, experiments, figures, revisions, and author-side rebuttal.",
    responsibility: "Perform the substantive work within the approved goal and scope as Builder/Author, distinct from Planner and independent Reviewer.",
    inputs: Object.freeze([
      "The approved goal, scope, deliverables, dependencies, and completion conditions",
      "Supplied materials and public Dove context needed for the work",
      "Host tools, subagents, and visible external search when they materially advance the task"
    ]),
    outputs: Object.freeze([
      "Real user-facing research, code, writing, experiment, figure, revision, or rebuttal artifacts produced from actual resources and existing assets",
      "Raw outputs, logs, failure samples, denominator accounting, and layered validation appropriate to the task, with no unnecessary fallback or hidden post-processing path",
      "An explicit account of unsupported claims, citation gaps, integrity concerns, uncertainty, resource limits, or material scope changes; host return and passing tests are not independent acceptance",
      "Durable results recorded through public Dove surfaces, without presenting the work as independent review"
    ])
  }),
  reviewer: Object.freeze({
    id: "reviewer",
    publicName: "Reviewer",
    title: "dove-reviewer",
    description: "Assess one frozen declared artifact scope and return structured findings without edits; this native role is a convenience definition, not evidence of independence or authority.",
    responsibility: "Act as Reviewer, separate in responsibility from Planner and Builder/Author. A user-managed separate exchange establishes the review boundary; merely using this native definition does not establish independence, identity, authority, sign-off, or acceptance.",
    inputs: Object.freeze([
      "Only the declared project-relative artifact paths and their frozen fingerprints in the launch prompt",
      "The concise review rubric and structured output contract in that prompt"
    ]),
    outputs: Object.freeze([
      "One structured status and verdict with a concise summary",
      "Findings only, each with a stable finding label, severity, concise rationale, and one or more declared artifact paths",
      "Action items, explicit unknowns, and a Markdown report within the declared scope",
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

export function renderOpenCodeRoleSkill(roleId) {
  const role = ROLE_DEFINITIONS[roleId];
  if (!role) throw new Error(`Unknown Dove primary role: ${roleId}.`);
  return `${frontmatter(role)}\n\n# ${role.title}\n\n## Responsibility\n\n${role.responsibility}\n\n## Inputs\n\n${bullets(role.inputs)}\n\n## Outputs\n\n${bullets(role.outputs)}\n`;
}

const REVIEWER_BOUNDARY = `Review only the declared paths listed in this prompt. Do not inspect directories, search the project, follow references into undeclared files, or use parent conversation context. Do not edit files or invoke Dove tools. Do not perform rebuttal, self-fix, implementation, or nested reviewer delegation.`;

export function renderClaudeReviewerAgent() {
  const role = ROLE_DEFINITIONS.reviewer;
  return `---\nname: dove-reviewer\ndescription: ${role.description}\ntools: Read\n---\n\n# Dove Reviewer\n\n${role.responsibility}\n\n${REVIEWER_BOUNDARY}\n\nReturn only the structured review object requested by the launch prompt, followed by its Markdown report.\n`;
}

export function renderOpenCodeReviewerAgent() {
  const role = ROLE_DEFINITIONS.reviewer;
  return `---\ndescription: ${role.description}\nmode: subagent\npermission:\n  read: allow\n  write: deny\n  edit: deny\n  bash: deny\n  glob: deny\n  grep: deny\n  task: deny\n  skill: deny\n---\n# Dove Reviewer\n\n${role.responsibility}\n\n${REVIEWER_BOUNDARY}\n\nReturn only the structured review object requested by the launch prompt, followed by its Markdown report.\n`;
}

export function reviewerPrompt(reviewScope) {
  const declared = reviewScope.reviewedArtifacts.map((item) => `- ${item.path} (${item.sizeBytes} bytes; SHA-256 ${item.sha256})`).join("\n");
  return `You are acting in the Dove Reviewer role for a user-managed separate review exchange. This prompt and native role definition do not prove independence, identity, or authority.\n\nDeclared frozen content boundary:\n${declared}\n\nRead only those exact project-relative files. Their content must match the supplied fingerprints. Do not access the parent transcript, Trellis task or specs, Dove state, directories, or any undeclared file. Do not edit, write, self-fix, rebut, invoke Dove, launch another reviewer, or delegate.\n\nRubric: assess correctness and internal coherence; evidence and claim scope; omissions and material risk; reproducibility; fairness or information leakage; and preservation of failures, denominators, and uncertainty. Do not claim authority, identity, sign-off, acceptance, or independence from this prompt alone.\n\nReturn exactly one JSON object with this shape, then a Markdown report:\n{\n  "status": "completed|blocked|failed",\n  "verdict": "coherent|needs-revision|needs-evidence|blocked",\n  "summary": "concise summary",\n  "rubric": ["rubric item assessed"],\n  "findings": [{"findingId":"safe-label","severity":"low|medium|high","summary":"concise finding","linkedArtifactPaths":["one-or-more-declared-paths"]}],\n  "actionItems": ["action"],\n  "report": "complete Markdown report",\n  "provenance": {"hostKind":"${reviewScope.hostKind}","provider":"optional","model":"optional"},\n  "limitations": ["scope or evidence limitation"],\n  "reviewedAt": "ISO-8601 UTC"\n}\nDo not add any other JSON fields. Completed status cannot use blocked verdict. Blocked or failed status must use blocked verdict. needs-revision and needs-evidence require at least one finding and action item.`;
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
