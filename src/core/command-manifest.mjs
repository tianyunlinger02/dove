export const PACKAGE_DOCUMENTATION_PATHS = ["README.md", "docs/README.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md", "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"];
export const PACKAGE_RUNTIME_PATHS = ["dist/index.mjs", "bin/dove-package.mjs", "scripts/dove-user-prompt-submit-package.mjs"];
export const RETIRED_PACKAGE_RUNTIME_PATHS = [
  "mcp/dove-state-server-package.mjs",
  "scripts/doctor-mcp-probe-package.mjs"
];
export const DEFAULT_HOST_ADAPTERS = ["opencode"];
export const PROJECT_HOST_IDS = ["opencode", "codex", "cursor", "agents", "claude"];
export const HOST_IDS = [...PROJECT_HOST_IDS];
export const DOVE_CLAUDE_AMBIENT_PROJECT_PATHS = Object.freeze([
  ".claude/rules/dove.md",
  ".claude/skills/dove-intake/SKILL.md",
  ".claude/skills/dove-paper-search/SKILL.md",
  ".claude/settings.json"
]);
export const PACKAGE_GENERATED_SUPPORT_PATHS = Object.freeze([
  ".claude/agents/dove-reviewer.md",
  ".claude/rules/dove.md",
  ".claude/skills/dove-intake/SKILL.md",
  ".claude/skills/dove-paper-search/SKILL.md",
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
    "Use host file and research tools directly. Research Markdown is ordinary researcher-owned context, not a database.",
    "Keep material failures, limitations, and uncertainty visible; model output, tests, and review are bounded evidence rather than scientific authority."
  ])
});

const host = (instruction, options = {}) => ({
  type: "host",
  capability: options.capability ?? "ordinary-project-work",
  readOnly: options.readOnly === true,
  persistWhen: options.persistWhen ?? "never",
  instruction
});

const commonClarification = ["Ask only when a material ambiguity blocks the work; otherwise continue with a reasonable interpretation."];
const readResearchDocuments = (instruction) => host(instruction, { capability: "research-document-reading", readOnly: true });
const updateResearchDocuments = (instruction) => host(instruction, { capability: "research-document-maintenance", persistWhen: "the work creates durable research value" });
const relevantLessons = host(
  "When reusable guidance may help the current task, read `.dove/research/lessons/LESSONS.md`, then only the naturally linked theme documents directly relevant to the work. Do not read unrelated themes or give any one Lesson special treatment. Treat Lessons as fallible advice, never as evidence or authority.",
  { capability: "lesson-reading", readOnly: true }
);

const AREA = Object.freeze({
  missions: Object.freeze({ directory: "missions", summary: "MISSIONS.md" }),
  experiments: Object.freeze({ directory: "experiments", summary: "EXPERIMENTS.md" }),
  sources: Object.freeze({ directory: "sources", summary: "SOURCES.md" }),
  reviews: Object.freeze({ directory: "reviews", summary: "REVIEWS.md" }),
  claims: Object.freeze({ directory: "claims", summary: "CLAIMS.md" }),
  lessons: Object.freeze({ directory: "lessons", summary: "LESSONS.md" })
});

function areaPath(area) {
  const value = AREA[area];
  return `.dove/research/${value.directory}/${value.summary}`;
}

function readArea(area, purpose) {
  return readResearchDocuments(
    `When existing Dove research context would materially help ${purpose}, read \`.dove/research/RESEARCH.md\`, then \`${areaPath(area)}\`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Do not recursively scan the research tree. If a needed entry or link is absent, say so naturally rather than inferring a database state.`
  );
}

function maintainArea(area, instruction) {
  return updateResearchDocuments(
    `${instruction} Keep the readable links and synthesis in \`${areaPath(area)}\` current when a detail document is created or materially changed. Update \`.dove/research/RESEARCH.md\` only for a material mainline, important conclusion, navigation, or priority change.`
  );
}

function workflow(slug) {
  if (slug === "research") return {
    status: "single-bounded-pass",
    modes: [{ id: "default", when: "The user requests one bounded pass of research framing, investigation, synthesis, or project work.", steps: [
      readArea("missions", "the bounded research goal"),
      relevantLessons,
      host("Inspect the relevant ordinary project materials and real external resources needed to understand the question. Form a proportional research frame from actual evidence rather than Dove bookkeeping. When the problem or route remains open, explore materially different explanations and approaches, then compare the serious candidates rather than committing to the first plausible or easiest option.", { capability: "project-exploration", readOnly: true }),
      host("Complete exactly one bounded research or project pass. Produce the requested analysis or artifact, preserve material failures and uncertainty, and stop after the bounded deliverable rather than turning Research into multi-round autonomy.", { capability: "research-work" }),
      maintainArea("missions", "When the work creates durable research value, update the existing Mission document or create one naturally named Mission document for the bounded goal, work, failures, evidence-bounded conclusion, limitations, and useful next branches. When an important claim needs its own document, place it under `claims/` and update `claims/CLAIMS.md` without creating a Claim store.")
    ], clarification: commonClarification }]
  };
  if (slug === "auto") return {
    status: "explicit-multi-round-autonomy",
    modes: [{ id: "default", when: "The user explicitly invokes high-autonomy multi-round research.", steps: [
      readResearchDocuments("Require an existing `.dove/research/RESEARCH.md`, read its current mainline, then read the summary for the current work type and only directly relevant linked details. Do not recursively scan all research files. If the overview is absent, materially incomplete, or evidence says the mainline must change, report that boundary and stop before autonomous work."),
      host("When that boundary blocks Auto, create a concise ordinary project recommendation only if the user requested a saved artifact; otherwise return the recommendation directly without changing the research mainline.", { capability: "mainline-boundary-recommendation" }),
      relevantLessons,
      host("Deeply explore relevant code, data, results, drafts, figures, constraints, and external sources. Build an evidence-aware frame covering competing explanations, counterfactuals, baselines, discriminating actions, and current claim boundaries.", { capability: "project-exploration", readOnly: true }),
      host("Let Planner and Builder/Author coordinate autonomously, using subagents when useful. Repeatedly choose and perform the feasible action with the highest expected research value, including retrieval, analysis, code, writing, figures, validation, and experiments. When theory and evidence conflict, reconsider the theory, the experiment, and the route itself; choose the next action that best clarifies the disagreement instead of assuming more experiments are needed.", { capability: "autonomous-research-work" }),
      host("For a selected experiment, write or extend one naturally named document under `experiments/` with the prospective plan before execution. Then execute with host tools, append the actual procedure, result, material failures or deviations, and interpretation to that same document, and update `experiments/EXPERIMENTS.md`.", { capability: "experiment-work" }),
      host("When user-managed separate review is a true dependency, prepare one readable document under `reviews/`, update `reviews/REVIEWS.md`, and return the declared artifacts and prompt to the user for a separate reviewer they manage. Do not launch, impersonate, or fabricate the reviewer; stop if the unavailable return blocks progress.", { capability: "review-handoff" }),
      updateResearchDocuments("When a round produces durable new evidence, a useful conclusion, a material failure, a decision, or a direction change, update the relevant naturally named topic document and its directory summary. Do not interrupt ordinary exploration merely to log a round. Keep `RESEARCH.md` concise and update it only for material mainline, conclusion, document-link, or priority changes. Preserve adverse evidence instead of overwriting history with a success narrative."),
      host("Continue without a default round count until the goal is achieved, the user budget ends, no feasible action has positive expected research value, a safety or mainline boundary is reached, or a required Review return is unavailable. Report the evidence-bounded result without claiming scientific authority.", { capability: "research-synthesis", readOnly: true })
    ], clarification: commonClarification }]
  };
  if (slug === "status") return {
    status: "read-only",
    modes: [{ id: "default", when: "The user requests current Dove research status.", steps: [
      readResearchDocuments("Read `.dove/research/RESEARCH.md` once when it exists, then read the one or more directory summaries needed for the question, then only directly linked details needed to resolve material ambiguity. Do not recursively scan the research tree. Report the current mainline, real progress, failures, limitations, uncertainty, and next priorities. If an overview, summary, or link is absent, say so naturally; do not infer a database state or modify files."),
      relevantLessons
    ], clarification: [] }]
  };
  if (slug === "source") return {
    status: "bounded-source-work",
    modes: [{ id: "default", when: "The user requests source discovery, reading, comparison, or verification.", steps: [
      readArea("sources", "the source question"),
      relevantLessons,
      host("Discover, retrieve, save when useful, read, and verify real material with host-native project or external research tools. Distinguish material merely found from material actually retrieved, inspected, and used; preserve saved paths, failures, conflicts, conditions, and limitations.", { capability: "source-research" }),
      maintainArea("sources", "When a used source deserves durable context, create or update one naturally named source note under `sources/` with the citation or URL, what was actually inspected and learned, conditions, conflicts, limitations, and useful related links. A source explanation is useful when available but is not mandatory. Do not generate a Source ID, fingerprint, or byte hash.")
    ], clarification: commonClarification }]
  };
  if (slug === "experiment") return {
    status: "planned-experiment-work",
    modes: [{ id: "default", when: "The user requests experiment design, execution, analysis, or recording.", steps: [
      readArea("experiments", "the experiment"),
      relevantLessons,
      host("Follow the user's actual experiment request. For a new experiment that will be executed, first choose or create one naturally named Experiment document under `experiments/` and write what it tests and how the result will be judged. For design-only work, produce an executable plan and stop before execution. For analysis of existing results, inspect and analyze those results directly. For retrospective recording, label it honestly as retrospective rather than presenting it as a prospective plan.", { capability: "experiment-design" }),
      host("Execute only when the request calls for execution. Use normal host tools and append the actual procedure and result, material failures or deviations, denominator accounting, and interpretation evidence to the same Experiment document used for the prospective plan. For analysis-only or retrospective work, preserve the actual provenance and do not invent an execution step.", { capability: "experiment-execution" }),
      maintainArea("experiments", "Record what the design, execution, analysis, or retrospective evidence supports and cannot establish in the relevant Experiment document when that context is worth preserving. Preserve failures, limitations, and uncertainty rather than normalizing the document into a fixed template.")
    ], clarification: commonClarification }]
  };
  if (slug === "draft") return {
    status: "artifact-work",
    modes: [{ id: "default", when: "The user requests drafting or revision of an ordinary project artifact.", steps: [
      readArea("claims", "the draft and its material claims"),
      relevantLessons,
      host("Read the target and relevant project evidence, then create or revise the ordinary draft artifact with host editing tools. Keep every claim within the available evidence and retain material counter-evidence and uncertainty.", { capability: "artifact-editing" }),
      host("Run appropriate host-native validation and report remaining unsupported claims, citation gaps, and uncertainty.", { capability: "artifact-validation", readOnly: true }),
      maintainArea("claims", "Create or revise a naturally named Claim document under `claims/` only when a material claim and its support, counter-evidence, missing evidence, or cannot-say boundary deserves durable treatment. Do not build a Claim database.")
    ], clarification: commonClarification }]
  };
  if (slug === "figure") return {
    status: "artifact-work",
    modes: [{ id: "default", when: "The user requests a figure, diagram, plot, or caption.", steps: [
      readResearchDocuments("When existing Dove research context would materially help the requested figure, read `.dove/research/RESEARCH.md`, then the directly relevant Mission or Experiment summary, then only needed linked details. Otherwise work directly from the user's requested materials and data. Do not recursively scan the research tree."),
      relevantLessons,
      host("Gather actual project materials and data, then create or revise the ordinary figure and caption with host-native plotting, image, or editing tools.", { capability: "figure-creation" }),
      host("Validate labels, denominators, provenance, legibility, and agreement between the figure, caption, and underlying evidence.", { capability: "figure-validation", readOnly: true }),
      updateResearchDocuments("Link the figure from the relevant Mission or Experiment detail document when that improves recovery, and naturally update that directory summary. Update `RESEARCH.md` only if the figure materially changes the mainline, conclusion, navigation, or priority.")
    ], clarification: commonClarification }]
  };
  if (slug === "review") return {
    status: "user-managed-review-document",
    modes: [{ id: "default", when: "The user requests user-managed separate review preparation, import, or review-context inspection.", steps: [
      readArea("reviews", "the review exchange"),
      relevantLessons,
      host("Follow the user's actual Review request. To prepare a new review, select or create one naturally named Review Markdown under `reviews/` and record the purpose, relevant project-relative artifact paths, scope limits, useful rubric, and a self-contained prompt for a separate reviewer chosen and managed by the user. If exact version freezing matters, use an ordinary Git commit, versioned copy, or review bundle and link it. To import a returned review, locate the corresponding Review document and preserve the supplied return faithfully without reconstructing preparation. To inspect existing review context, read and report it without creating a new Review document.", { capability: "review-preparation" }),
      host("Only when preparing a new review, return the relevant files and self-contained prompt to the user. Do not launch or substitute for the separate reviewer. When importing or inspecting, do not create a new handoff.", { capability: "review-handoff", readOnly: true }),
      maintainArea("reviews", "When the user supplies an actual reviewer return, append it faithfully to the corresponding Review document with a clear boundary from existing text. Do not rewrite, summarize over, or normalize the original return, and do not require verdict, severity, finding IDs, or a strict schema. Add author interpretation only when the user asks for it; use Rebuttal for substantive response, revision, and follow-up work.")
    ], clarification: commonClarification }]
  };
  if (slug === "rebuttal") return {
    status: "author-side-work",
    modes: [{ id: "default", when: "The user requests author-side rebuttal or revision from review findings.", steps: [
      readArea("reviews", "the relevant returned review"),
      relevantLessons,
      host("Read the relevant Review document and actual artifacts. Analyze each material finding against the evidence, write the response, and make requested ordinary project revisions. This remains Builder/Author work rather than a separate review return.", { capability: "rebuttal-and-revision" }),
      host("Validate that each response maps to a real finding and that revisions do not overstate evidence or erase failures and uncertainty.", { capability: "artifact-validation", readOnly: true }),
      maintainArea("reviews", "Append the author response, revisions, resulting decisions, unresolved issues, and follow-up to the same Review document or the directly affected research document when that context is worth preserving.")
    ], clarification: commonClarification }]
  };
  return {
    status: "advisory-markdown",
    modes: [
      { id: "read", when: "The user requests reading or explaining current Lessons.", steps: [
        readResearchDocuments("Read `.dove/research/RESEARCH.md` first only when project context is needed, then read `.dove/research/lessons/LESSONS.md`, then only the linked theme documents relevant to the request. Report supported reusable guidance as fallible advice. Do not create or modify files and do not treat Lessons as evidence.")
      ], clarification: [] },
      { id: "maintain", when: "The user explicitly requests remembering, reflection, or durable Lessons maintenance.", steps: [
        readResearchDocuments("Read `.dove/research/RESEARCH.md` first only when project context is needed, then `.dove/research/lessons/LESSONS.md`, then only relevant linked themes. Do not recursively scan all research files."),
        updateResearchDocuments("Preserve useful existing structure and maintain supported reusable guidance in the relevant theme under `lessons/`, or create a naturally named Markdown file when a new theme is genuinely useful. Update `lessons/LESSONS.md` with a natural link when needed. Source explanation is optional. Do not create lesson IDs, frontmatter, an application ledger, or treat Lessons as evidence.")
      ], clarification: commonClarification }
    ]
  };
}

const SURFACES = [
  ["research", "Complete one bounded pass of research, synthesis, or project investigation."],
  ["status", "Read the human-maintained research overview and summaries without writes."],
  ["source", "Discover, retrieve, read, verify, and document real sources that materially inform the research."],
  ["experiment", "Design, execute, analyze, or honestly record an experiment from real evidence."],
  ["draft", "Write or revise ordinary project drafts from the available evidence."],
  ["figure", "Gather real materials and create or revise figures and captions."],
  ["review", "Prepare, import, or inspect a user-managed review in one readable document."],
  ["rebuttal", "Perform author-side rebuttal and revision from actual review findings and evidence."],
  ["lessons", "Read or maintain advisory Lessons themes and their summary."],
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
