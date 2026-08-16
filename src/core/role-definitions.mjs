const ROLE_DEFINITIONS = Object.freeze({
  planner: Object.freeze({
    id: "planner",
    publicName: "Planner",
    title: "dove-planner",
    description: "Clarify the goal and evidence needed when planning is useful.",
    responsibility: "Frame only what the Builder/Author needs to proceed.",
    inputs: Object.freeze([
      "The user's goal, constraints, context, and desired result"
    ]),
    internalCompletionConditions: Object.freeze([
      "The goal, material uncertainty, evidence needs, and stopping point are clear enough for the work"
    ])
  }),
  builder: Object.freeze({
    id: "builder",
    publicName: "Builder/Author",
    title: "dove-builder",
    description: "Do the substantive research, coding, writing, experiment, figure, revision, or rebuttal work.",
    responsibility: "Complete the user's request from real project material and appropriate evidence.",
    inputs: Object.freeze([
      "The user's request and the project material relevant to it"
    ]),
    internalCompletionConditions: Object.freeze([
      "The requested result is produced and checked proportionally, with material failures and uncertainty preserved"
    ])
  }),
  reviewer: Object.freeze({
    id: "reviewer",
    publicName: "Reviewer",
    title: "dove-reviewer",
    description: "Assess a declared artifact scope and return a readable review without edits; this role does not establish reviewer independence.",
    responsibility: "Review the user-declared scope separately from Planner and Builder/Author. The user manages the exchange; this role is responsibility separation, not proof of reviewer identity, independence, or authority.",
    inputs: Object.freeze([
      "Only the exact project-relative artifact paths declared by the user-managed review prompt",
      "The review purpose, scope limits, and rubric stated in that prompt"
    ]),
    outputs: Object.freeze([
      "One readable Markdown review within the declared scope",
      "Concrete findings tied to declared artifact paths, with rationale, materiality, and actionable follow-up where appropriate",
      "Explicit unknowns, limitations, and provenance information that the reviewer can honestly provide",
      "Make no edits, rebuttal, implementation, Dove mutation, or nested reviewer launch, and do not use parent conversation context or undeclared project material"
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

const REVIEWER_BOUNDARY = "Review only the declared scope and say when that scope is insufficient. Do not edit files, use parent conversation context, invoke Dove, perform rebuttal or implementation, or launch another reviewer.";

export function renderClaudeReviewerAgent() {
  const role = ROLE_DEFINITIONS.reviewer;
  return `---\nname: dove-reviewer\ndescription: ${role.description}\ntools: Read\n---\n\n# Dove Reviewer\n\n${role.responsibility}\n\n${REVIEWER_BOUNDARY}\n\nReturn one readable Markdown review limited to the declared scope.\n`;
}

export function renderOpenCodeReviewerAgent() {
  const role = ROLE_DEFINITIONS.reviewer;
  return `---\ndescription: ${role.description}\nmode: subagent\npermission:\n  read: allow\n  write: deny\n  edit: deny\n  bash: deny\n  glob: deny\n  grep: deny\n  task: deny\n  skill: deny\n---\n# Dove Reviewer\n\n${role.responsibility}\n\n${REVIEWER_BOUNDARY}\n\nReturn one readable Markdown review limited to the declared scope.\n`;
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
