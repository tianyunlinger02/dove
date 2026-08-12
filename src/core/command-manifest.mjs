export const PACKAGE_DOCUMENTATION_PATHS = ["README.md", "docs/README.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md", "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"];
export const PACKAGE_RUNTIME_PATHS = ["dist/index.mjs", "bin/dove-package.mjs", "scripts/dove-user-prompt-submit-package.mjs"];
export const RETIRED_PACKAGE_RUNTIME_PATHS = ["mcp/dove-state-server-package.mjs"];
export const DEFAULT_HOST_ADAPTERS = ["opencode"];
export const PROJECT_HOST_IDS = ["opencode", "codex", "cursor", "agents", "claude"];
export const HOST_IDS = [...PROJECT_HOST_IDS];
export const DOVE_CLAUDE_AMBIENT_PROJECT_PATHS = Object.freeze([".claude/rules/dove.md", ".claude/skills/dove-intake/SKILL.md", ".claude/skills/dove-lessons-intake/SKILL.md", ".claude/settings.json"]);
export const PACKAGE_GENERATED_SUPPORT_PATHS = Object.freeze([
  ".claude/agents/dove-reviewer.md",
  ".claude/rules/dove.md",
  ".claude/skills/dove-intake/SKILL.md",
  ".claude/skills/dove-lessons-intake/SKILL.md",
  ".opencode/agents/dove-reviewer.md"
]);
export const HOST_DEFINITIONS = {
  opencode: { label: "OpenCode", scope: "project", jsonChecks: [] },
  codex: { label: "Codex", scope: "project", jsonChecks: [] },
  cursor: { label: "Cursor", scope: "project", jsonChecks: [] },
  agents: { label: "Shared agent skills", scope: "project", jsonChecks: [] },
  claude: { label: "Claude Code", scope: "project", jsonChecks: [] }
};
export const OPENCODE_ROLE_SKILL_PATHS = [".opencode/skills/dove-planner/SKILL.md", ".opencode/skills/dove-builder/SKILL.md", ".opencode/skills/dove-reviewer/SKILL.md"];

export const HOST_ADAPTER_POLICY = Object.freeze({
  toolAccess: Object.freeze({ transport: "host-files", unavailable: "report", cliFallback: false, shellFallback: false }),
  privacy: Object.freeze({ exposePrivateProtocol: false }),
  adapterBullets: Object.freeze([
    "Treat `.dove/research/RESEARCH.md` and its linked Markdown as ordinary researcher-owned documents, not a database or machine authority.",
    "Use host file and research tools directly. Read the overview first when it exists, then only the linked documents and project artifacts relevant to the task.",
    "Keep failures, adverse evidence, limitations, and uncertainty visible; tests, host output, and any review remain bounded evidence rather than scientific authority."
  ])
});

const host = (instruction, options = {}) => ({
  type: "host",
  capability: options.capability ?? "ordinary-project-work",
  readOnly: options.readOnly === true,
  persistWhen: options.persistWhen ?? "never",
  instruction
});

const commonClarification = ["Explore first. Ask one brief clarification only if material ambiguity in the goal, boundary, or deliverable remains; otherwise continue within the requested boundary."];
const readResearchDocuments = (instruction = "If `.dove/research/RESEARCH.md` exists, read it first and follow only the most relevant Markdown links. If it is absent, treat that as normal and inspect ordinary project material instead. Do not require fixed headings, frontmatter, IDs, or a machine index.") => host(instruction, { capability: "research-document-reading", readOnly: true });
const updateResearchDocuments = (instruction) => host(instruction, { capability: "research-document-maintenance", persistWhen: "research-context-worth-preserving" });

function workflow(slug) {
  if (slug === "research") return {
    status: "single-bounded-pass",
    modes: [{ id: "default", when: "The user requests one bounded pass of research framing, investigation, synthesis, or project work.", steps: [
      readResearchDocuments(),
      host("Inspect the relevant ordinary project materials and real external resources needed to understand the question. Form a proportional research frame from actual evidence rather than Dove bookkeeping.", { capability: "project-exploration", readOnly: true }),
      host("Complete exactly one bounded research or project pass. Produce the requested analysis or artifact, preserve material failures and uncertainty, and stop after the bounded deliverable rather than turning Research into multi-round autonomy.", { capability: "research-work" }),
      updateResearchDocuments("When the work creates durable research value, update the existing topic document or create one readable Markdown document for that work. Update `RESEARCH.md` only when the mainline, important conclusion, linked work, or priority materially changes. Do not create a document merely because the Skill ran.")
    ], clarification: commonClarification }]
  };
  if (slug === "auto") return {
    status: "explicit-multi-round-autonomy",
    modes: [{ id: "default", when: "The user explicitly invokes high-autonomy multi-round research.", steps: [
      readResearchDocuments("Require an existing `.dove/research/RESEARCH.md`, read its current mainline and linked work, and reground from the actual project. If the overview is absent, materially incomplete, or evidence says the mainline must change, write a recommendation as an ordinary project artifact, report the block, and stop."),
      host("Read `.dove/research/LESSONS.md` when present and treat it as fallible guidance, never as evidence or authority.", { capability: "lesson-reading", readOnly: true }),
      host("Deeply explore relevant code, data, results, drafts, figures, constraints, and external sources. Build an evidence-aware frame covering competing explanations, counterfactuals, baselines, discriminating actions, and current claim boundaries.", { capability: "project-exploration", readOnly: true }),
      host("Let Planner and Builder/Author coordinate autonomously, using subagents when useful. Repeatedly choose and perform the feasible action with the highest expected research value, including retrieval, analysis, code, writing, figures, validation, and experiments.", { capability: "autonomous-research-work" }),
      host("For every selected experiment, write or extend one experiment Markdown document with the prospective plan before execution. Then execute with host tools and append actual procedure, results, failures, denominator accounting, deviations, limitations, uncertainty, and implications to that same document.", { capability: "experiment-work", persistWhen: "selected-experiment" }),
      host("When independent review is a true dependency, prepare one readable Review document and return the declared artifacts and prompt to the user for a separate reviewer they manage. Do not launch, impersonate, or fabricate the reviewer; stop if the unavailable return blocks progress.", { capability: "review-handoff", persistWhen: "review-needed" }),
      updateResearchDocuments("After each material round, update the relevant topic document. Keep `RESEARCH.md` concise and update it only for material mainline, conclusion, document-link, or priority changes. Preserve adverse evidence instead of overwriting history with a success narrative."),
      host("Continue without a default round count until the goal is achieved, the user budget ends, no feasible action has positive expected research value, a safety or mainline boundary is reached, or a required Review return is unavailable. Report the evidence-bounded result without claiming scientific authority.", { capability: "research-synthesis", readOnly: true })
    ], clarification: commonClarification }]
  };
  if (slug === "status") return {
    status: "read-only",
    modes: [{ id: "default", when: "The user requests current Dove research status.", steps: [
      readResearchDocuments("Read `.dove/research/RESEARCH.md` once when it exists, then read only the linked documents needed to resolve material ambiguity. Report the current mainline, real progress, failures, limitations, uncertainty, and next priorities. If the overview is absent or a link is missing, say so naturally; do not infer a database state or modify files.")
    ], clarification: [] }]
  };
  if (slug === "source") return {
    status: "bounded-source-work",
    modes: [{ id: "default", when: "The user requests source discovery, reading, comparison, or verification.", steps: [
      readResearchDocuments(),
      host("Discover, retrieve, read, and verify real material with host-native project or external research tools. Distinguish material merely found from material actually inspected and used; preserve conflicts, conditions, and limitations.", { capability: "source-research", readOnly: true }),
      updateResearchDocuments("When a used source deserves durable context, create or update one readable source-note Markdown with citation or URL, what was learned, conditions, conflicts, limitations, and links to related work. Do not generate a Source ID, fingerprint, or byte hash.")
    ], clarification: commonClarification }]
  };
  if (slug === "experiment") return {
    status: "planned-experiment-work",
    modes: [{ id: "default", when: "The user requests experiment design, execution, analysis, or recording.", steps: [
      readResearchDocuments(),
      host("Select or create one readable experiment Markdown document. Before execution, write why the experiment matters, hypotheses or competing explanations, protocol, inputs, comparisons, metrics, discriminating observations, stop conditions, expected artifacts, cost, risk, and failure value. Do not execute first and reconstruct the plan afterward.", { capability: "experiment-design", persistWhen: "experiment-selected" }),
      host("Execute the written plan with normal host tools. Append actual execution, raw artifact paths, observations, positive, negative, null, mixed, failed or stopped outcomes, denominator accounting, exclusions, deviations, unexpected observations, limitations, and uncertainty to the same document.", { capability: "experiment-execution", persistWhen: "experiment-executed" }),
      updateResearchDocuments("Explain in that experiment document what the result supports, weakens, leaves unresolved, and cannot establish. Update `RESEARCH.md` only when the result materially changes the mainline, important conclusions, linked work, or next priority.")
    ], clarification: commonClarification }]
  };
  if (slug === "draft") return {
    status: "artifact-work",
    modes: [{ id: "default", when: "The user requests drafting or revision of an ordinary project artifact.", steps: [
      readResearchDocuments(),
      host("Read the target and relevant project evidence, then create or revise the ordinary draft artifact with host editing tools. Keep every claim within the available evidence and retain material counter-evidence and uncertainty.", { capability: "artifact-editing" }),
      host("Run appropriate host-native validation and report remaining unsupported claims, citation gaps, and uncertainty.", { capability: "artifact-validation", readOnly: true }),
      updateResearchDocuments("Update a linked research document only when the drafting work materially changes a research conclusion, limitation, or next priority; do not build a separate Claim database.")
    ], clarification: commonClarification }]
  };
  if (slug === "figure") return {
    status: "artifact-work",
    modes: [{ id: "default", when: "The user requests a figure, diagram, plot, or caption.", steps: [
      readResearchDocuments(),
      host("Gather actual project materials and data, then create or revise the ordinary figure and caption with host-native plotting, image, or editing tools.", { capability: "figure-creation" }),
      host("Validate labels, denominators, provenance, legibility, and agreement between the figure, caption, and underlying evidence.", { capability: "figure-validation", readOnly: true }),
      updateResearchDocuments("Link the figure from the relevant experiment, mission, or overview document only when that link improves future research recovery.")
    ], clarification: commonClarification }]
  };
  if (slug === "review") return {
    status: "user-managed-review-document",
    modes: [{ id: "default", when: "The user requests independent review preparation, import, or review-context inspection.", steps: [
      readResearchDocuments(),
      host("Select or create one readable Review Markdown. Record the review purpose, declared artifact paths, scope limits, rubric, and a self-contained prompt for a separate reviewer chosen and managed by the user. If exact version freezing matters, use an ordinary Git commit, versioned copy, or review bundle and link it; do not generate a Dove exchange ID or scientific hash.", { capability: "review-preparation", persistWhen: "review-prepared" }),
      host("Return the declared files and prompt to the user. Never launch, impersonate, silently substitute, or certify the reviewer.", { capability: "review-handoff", readOnly: true }),
      updateResearchDocuments("When the user supplies the actual return, append it faithfully to the same Review document together with limitations, author interpretation, and follow-up actions. Preserve the original reviewer content; do not require verdict, severity, finding IDs, or a strict import schema.")
    ], clarification: commonClarification }]
  };
  if (slug === "rebuttal") return {
    status: "author-side-work",
    modes: [{ id: "default", when: "The user requests author-side rebuttal or revision from review findings.", steps: [
      readResearchDocuments(),
      host("Read the relevant Review document and actual artifacts. Analyze each material finding against the evidence, write the response, and make requested ordinary project revisions. This remains Builder/Author work, not independent review.", { capability: "rebuttal-and-revision" }),
      host("Validate that each response maps to a real finding and that revisions do not overstate evidence or erase failures and uncertainty.", { capability: "artifact-validation", readOnly: true }),
      updateResearchDocuments("Append the author response and resulting decisions to the same Review document or the directly affected research document when that context is worth preserving.")
    ], clarification: commonClarification }]
  };
  return {
    status: "advisory-markdown",
    modes: [{ id: "default", when: "The user requests Lessons reading, remembering, or reflection.", steps: [
      host("Use `.dove/research/LESSONS.md` as one complete, ordinary advisory Markdown document. Read it directly for a read request. For explicit remembering or reflection, preserve its useful structure and update it only with supported reusable guidance. If it does not exist and the request needs durable Lessons, create it naturally. Do not create lesson IDs, an application ledger, or treat Lessons as evidence.", { capability: "lesson-maintenance", persistWhen: "explicit-lessons-request" })
    ], clarification: commonClarification }]
  };
}

const SURFACES = [
  ["research", "Complete one bounded pass of research, synthesis, or project investigation."],
  ["status", "Read the human-maintained research overview and report current direction and progress without writes."],
  ["source", "Discover, read, verify, and document real sources that materially inform the research."],
  ["experiment", "Plan and execute a real experiment while keeping plan and result in one document."],
  ["draft", "Write or revise ordinary project drafts from the available evidence."],
  ["figure", "Gather real materials and create or revise figures and captions."],
  ["review", "Prepare and preserve a user-managed independent review in one readable document."],
  ["rebuttal", "Perform author-side rebuttal and revision from actual review findings and evidence."],
  ["lessons", "Read or maintain the complete advisory Lessons Markdown document."],
  ["auto", "Conduct explicit high-autonomy multi-round research within the documented current mainline."]
];

export const COMMAND_SURFACES = SURFACES.map(([slug, summary]) => ({
  id: `dove.${slug}`,
  title: `Dove ${slug}`,
  summary,
  requiredTools: [],
  workflow: workflow(slug),
  examples: [`/dove:${slug}`],
  guidance: slug === "review"
    ? ["Review is a user-managed separate exchange recorded in one readable document. Dove never launches, impersonates, or certifies the reviewer."]
    : []
}));
export const COMMAND_SURFACE_BY_ID = Object.fromEntries(COMMAND_SURFACES.map((item) => [item.id, item]));

export function commandIdToSlug(commandId) { return commandId.replace(/^dove\./u, ""); }
export function hostCommandSlug(commandId) { return commandIdToSlug(commandId).replace(/\./gu, "-"); }
export function adapterPathForCommand(hostId, command) {
  const commandId = typeof command === "string" ? command : command.id;
  const slug = hostCommandSlug(commandId);
  if (hostId === "opencode") return `.opencode/commands/${commandId}.md`;
  if (hostId === "cursor") return `.cursor/commands/dove-${slug}.md`;
  if (hostId === "codex") return `.codex/skills/dove-${slug}/SKILL.md`;
  if (hostId === "agents") return `.agents/skills/dove-${slug}/SKILL.md`;
  if (hostId === "claude") return `.claude/commands/dove/${slug}.md`;
  throw new Error(`Unknown host adapter: ${hostId}`);
}
export function commandAdapterPathsForHost(hostId) { return COMMAND_SURFACES.map((command) => adapterPathForCommand(hostId, command)); }
export function allGeneratedCommandAdapterPaths() { return PROJECT_HOST_IDS.flatMap(commandAdapterPathsForHost); }
export const HOST_ADAPTERS = Object.fromEntries(PROJECT_HOST_IDS.map((hostId) => {
  const commandPaths = commandAdapterPathsForHost(hostId);
  const extraPaths = hostId === "opencode" ? [...OPENCODE_ROLE_SKILL_PATHS] : hostId === "agents" ? ["AGENTS.md"] : [];
  return [hostId, { label: HOST_DEFINITIONS[hostId].label, paths: [...commandPaths, ...extraPaths], requiredPaths: [...commandPaths, ...extraPaths], jsonChecks: HOST_DEFINITIONS[hostId].jsonChecks }];
}));
export const CURRENT_MANAGED_PATHS = Object.freeze({
  core: Object.freeze([...PACKAGE_RUNTIME_PATHS]),
  opencode: Object.freeze([...HOST_ADAPTERS.opencode.paths]),
  codex: Object.freeze([...HOST_ADAPTERS.codex.paths]),
  cursor: Object.freeze([...HOST_ADAPTERS.cursor.paths]),
  agents: Object.freeze([...HOST_ADAPTERS.agents.paths]),
  claude: Object.freeze([...commandAdapterPathsForHost("claude"), ...DOVE_CLAUDE_AMBIENT_PROJECT_PATHS])
});
const RETIRED = ["workspace", "mission", "note", "experience"];
export const RETIRED_MANAGED_PATHS = Object.freeze({
  core: Object.freeze([...RETIRED_PACKAGE_RUNTIME_PATHS]),
  opencode: Object.freeze([...RETIRED.map((slug) => `.opencode/commands/dove.${slug}.md`), ".opencode.json"]),
  codex: Object.freeze(RETIRED.flatMap((slug) => [`.codex/skills/dove-${slug}/SKILL.md`, `.codex/skills/dove-${slug}`])),
  cursor: Object.freeze(RETIRED.map((slug) => `.cursor/commands/dove-${slug}.md`)),
  agents: Object.freeze(RETIRED.flatMap((slug) => [`.agents/skills/dove-${slug}/SKILL.md`, `.agents/skills/dove-${slug}`])),
  claude: Object.freeze(RETIRED.map((slug) => `.claude/commands/dove/${slug}.md`))
});
export const MANAGED_PACKAGE_PATHS = Object.freeze([...CURRENT_MANAGED_PATHS.opencode, ...CURRENT_MANAGED_PATHS.codex, ...CURRENT_MANAGED_PATHS.cursor, ...CURRENT_MANAGED_PATHS.agents, ...commandAdapterPathsForHost("claude"), ...PACKAGE_GENERATED_SUPPORT_PATHS, ...CURRENT_MANAGED_PATHS.core, ...PACKAGE_DOCUMENTATION_PATHS]);
