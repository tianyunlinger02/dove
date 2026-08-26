import {
  DOVE_RESEARCH_ADVANCE,
  DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY,
  DOVE_RESEARCH_AUTO_CYCLE,
  DOVE_RESEARCH_AUTO_EXPLICIT_ONLY,
  DOVE_RESEARCH_AUTO_GOAL_RECOVERY,
  DOVE_RESEARCH_AUTO_REVIEW_RESPONSE,
  DOVE_RESEARCH_AUTO_NOT_MECHANICAL_SKILLS,
  DOVE_RESEARCH_AUTO_REPORTING_BOUNDARY,
  DOVE_RESEARCH_CAPSULE_BULLETS,
  DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY,
  DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY,
  DOVE_RESEARCH_FRAME,
  DOVE_RESEARCH_HUNCH,
  DOVE_RESEARCH_JUDGMENT_BOUNDARY,
  DOVE_RESEARCH_MAINTENANCE_TRIGGER,
  DOVE_RESEARCH_MANUSCRIPT_READINESS_BASIS,
  DOVE_RESEARCH_MANUSCRIPT_REVIEW_BOUNDARY,
  DOVE_RESEARCH_MANUSCRIPT_REVIEW_GATE,
  DOVE_RESEARCH_MANUSCRIPT_REVIEW_LOOP,
  DOVE_RESEARCH_SKILL_INVENTORY_TEXT,
  DOVE_RESEARCH_SUPPORT_SUBORDINATION_BOUNDARY,
  DOVE_RESEARCH_WHOLE_MANUSCRIPT_READINESS_BOUNDARY
} from "./dove-research-contract.mjs";

export const PACKAGE_DOCUMENTATION_PATHS = ["README.md", "docs/README.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md", "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"];
export const PACKAGE_RUNTIME_PATHS = ["dist/index.mjs", "bin/dove-package.mjs", "scripts/dove-user-prompt-submit-package.mjs"];
export const RETIRED_PACKAGE_RUNTIME_PATHS = [
  "mcp/dove-state-server-package.mjs",
  "scripts/doctor-mcp-probe-package.mjs"
];
export const DEFAULT_HOST_ADAPTERS = ["claude", "dsh"];
export const PROJECT_HOST_IDS = ["claude", "dsh"];
export const HOST_IDS = [...PROJECT_HOST_IDS];
export const DOVE_CLAUDE_AMBIENT_PROJECT_PATHS = Object.freeze([
  ".claude/rules/dove.md",
  ".claude/skills/dove-intake/SKILL.md",
  ".claude/skills/dove-paper-search/SKILL.md",
  ".claude/settings.json"
]);
export const PACKAGE_RESOURCE_ROOT = "package-resources/hosts";
export const PACKAGE_GENERATED_SUPPORT_PATHS = Object.freeze([
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/agents/dove.md`,
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/rules/dove.md`,
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/skills/dove-intake/SKILL.md`,
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/skills/dove-paper-search/SKILL.md`
]);
export const HOST_DEFINITIONS = {
  claude: { label: "Claude Code", scope: "project", jsonChecks: [] },
  dsh: { label: "DeepSeek Harness (dsh)", scope: "project", jsonChecks: [] }
};
export const OPENCODE_ROLE_SKILL_PATHS = [];

export const HOST_ADAPTER_POLICY = Object.freeze({
  toolAccess: Object.freeze({ transport: "host-files", unavailable: "report", cliFallback: false, shellFallback: false }),
  privacy: Object.freeze({ exposePrivateProtocol: false }),
  adapterBullets: DOVE_RESEARCH_CAPSULE_BULLETS
});

const RESEARCH_FRAME = DOVE_RESEARCH_FRAME;
const RESEARCH_ADVANCE = DOVE_RESEARCH_ADVANCE;
const RESEARCH_HUNCH = DOVE_RESEARCH_HUNCH;
const JUDGMENT_BOUNDARY = DOVE_RESEARCH_JUDGMENT_BOUNDARY;
const RESEARCH_MAINTENANCE_TRIGGER = DOVE_RESEARCH_MAINTENANCE_TRIGGER;

const host = (instruction, options = {}) => ({
  type: "host",
  capability: options.capability ?? "ordinary-project-work",
  readOnly: options.readOnly === true,
  persistWhen: options.persistWhen ?? "never",
  persistencePolicy: options.persistencePolicy ?? "never",
  instruction
});

const commonClarification = ["Ask only when a material ambiguity blocks the work; otherwise continue with a reasonable interpretation."];
const readResearchDocuments = (instruction) => host(instruction, { capability: "research-document-reading", readOnly: true });
const updateResearchDocuments = (instruction, options = {}) => host(instruction, {
  capability: "research-document-maintenance",
  persistWhen: options.persistWhen ?? RESEARCH_MAINTENANCE_TRIGGER,
  persistencePolicy: options.persistencePolicy ?? "standard-research"
});
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
    `${instruction} Update only the narrowest relevant research document. Update \`${areaPath(area)}\` only when its own links or synthesis materially change. Update \`.dove/research/RESEARCH.md\` only for a project-level mainline, conclusion, navigation, or priority change.`
  );
}

function workflow(slug) {
  if (slug === "research") return {
    status: "single-bounded-pass",
    modes: [{ id: "default", when: "The user requests one bounded pass of research framing, investigation, synthesis, or project work.", steps: [
      readArea("missions", "the bounded research goal"),
      relevantLessons,
      host(`Inspect the relevant ordinary project materials and real external resources needed to understand the question. ${RESEARCH_FRAME} ${RESEARCH_HUNCH}`, { capability: "project-exploration", readOnly: true }),
      host(`Complete exactly one bounded research or project pass. ${RESEARCH_ADVANCE} ${JUDGMENT_BOUNDARY} Produce the requested analysis or artifact, advance a real judgment or eliminate a serious candidate, and stop after the bounded deliverable rather than turning Research into multi-round autonomy.`, { capability: "research-work" }),
      maintainArea("missions", "When the maintenance trigger is met, update the existing Mission document or create one naturally named Mission document for the bounded goal, substantive work, current conclusion, and useful next branches.")
    ], clarification: commonClarification }]
  };
  if (slug === "auto") return {
    status: "explicit-multi-round-autonomy",
    modes: [{ id: "default", when: "The user explicitly invokes high-autonomy multi-round research on the current mainline or an immediate stated goal.", steps: [
      readResearchDocuments(`${DOVE_RESEARCH_AUTO_GOAL_RECOVERY} For a paper project whose mainline is submission readiness, continue until the whole manuscript and required submission package are actually ready or a material blocker cannot be resolved under current conditions. ${DOVE_RESEARCH_MANUSCRIPT_READINESS_BASIS} ${DOVE_RESEARCH_MANUSCRIPT_REVIEW_GATE} ${DOVE_RESEARCH_MANUSCRIPT_REVIEW_BOUNDARY} ${DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY} ${DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY}`),
      host(`${DOVE_RESEARCH_AUTO_CYCLE} ${DOVE_RESEARCH_SUPPORT_SUBORDINATION_BOUNDARY} ${DOVE_RESEARCH_AUTO_NOT_MECHANICAL_SKILLS} Use the recovered whole-manuscript readiness basis to choose the next material action; do not let one visible formatting or artifact gap displace a higher-order scientific or scholarly blocker. ${DOVE_RESEARCH_MANUSCRIPT_REVIEW_GATE} ${DOVE_RESEARCH_MANUSCRIPT_REVIEW_BOUNDARY} ${DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY} ${DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY} ${DOVE_RESEARCH_MANUSCRIPT_REVIEW_LOOP} ${DOVE_RESEARCH_WHOLE_MANUSCRIPT_READINESS_BOUNDARY} ${DOVE_RESEARCH_AUTO_REPORTING_BOUNDARY} ${DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY} Repeat the decision cycle as needed. Finishing one edit, check, Review invocation, export, or validation is a result to reassess, not a reason to close Auto. If the goal is not achieved and another feasible in-scope action is likely to matter, perform that action in the same Auto run and continue the next cycle; do not stop after describing work that Auto can still carry out.`, { capability: "autonomous-research-work" }),
      updateResearchDocuments(`${DOVE_RESEARCH_SUPPORT_SUBORDINATION_BOUNDARY} This maintenance step is conditional support, not a per-cycle closing phase or a substitute for resuming interrupted work. Skip maintenance unless the result materially changes the active mainline, conclusion, decision, or priority, or durable recovery genuinely requires a narrow project document. Update only the narrowest relevant naturally named document; keep \`RESEARCH.md\` concise and update it only for a real project-level mainline, conclusion, navigation, or priority change. Never infer Lessons maintenance from Auto completion or a Stop continuation; maintain Lessons only when the explicit request is to remember, reflect, or preserve durable guidance.`, { persistencePolicy: "auto-subordinate" }),
      host(`${DOVE_RESEARCH_AUTO_REPORTING_BOUNDARY} Final synthesis is allowed only after a real stop condition is met. For manuscript submission readiness, a goal-achieved synthesis requires a current Review invocation returning \`PASS\` on the latest material state; otherwise synthesize only a real unresolved boundary, not submit-ready completion. If another executable in-scope action is still likely to change the mainline, return to autonomous research work and perform it rather than reporting it as a future next step. Do not stop merely because one pass or support task finished. Stop only when the goal is achieved, the user budget ends, no feasible action is likely to change the research decision, or a safety, genuinely competing direction, required external return, or other real boundary needs user input.`, { capability: "research-synthesis", readOnly: true })
    ], clarification: commonClarification }]
  };
  if (slug === "status") return {
    status: "read-only",
    modes: [{ id: "default", when: "The user requests current Dove research status.", steps: [
      readResearchDocuments("Read `.dove/research/RESEARCH.md` once when it exists, then read the one or more directory summaries needed for the question, then only directly linked details needed to resolve material ambiguity. Do not recursively scan the research tree. Report the current mainline, substantive progress, active problems, decisions, and next priorities. If an overview, summary, or link is absent, say so naturally; do not infer a database state or modify files."),
      relevantLessons
    ], clarification: [] }]
  };
  if (slug === "source") return {
    status: "bounded-source-work",
    modes: [{ id: "default", when: "The user requests source discovery, reading, comparison, or verification.", steps: [
      readArea("sources", "the source question"),
      relevantLessons,
      host("Discover, retrieve when available, save when useful, read, and verify real material with available and approved host-native project or external research tools. Distinguish material merely found from material actually retrieved, inspected, and used; when one source path is unavailable, report that boundary and continue with other approved local, web, or user-provided material that can still inform the question.", { capability: "source-research" }),
      maintainArea("sources", "When a used source deserves durable context, create or update one naturally named source note under `sources/` with the citation or URL, what was actually inspected and learned, and useful related links. Do not generate a Source ID, fingerprint, or byte hash.")
    ], clarification: commonClarification }]
  };
  if (slug === "experiment") return {
    status: "planned-experiment-work",
    modes: [{ id: "default", when: "The user requests experiment design, execution, analysis, or recording.", steps: [
      readArea("experiments", "the experiment"),
      relevantLessons,
      host(`Follow the user's actual experiment request. ${JUDGMENT_BOUNDARY} Before treating a new experiment as central, establish the real problem, key uncertainty, or route decision it should resolve from the request and project context; if that basis is not yet established, pause central experiment design and inspect the actual project material, relevant sources, or smallest low-risk diagnostic needed to investigate the problem; do not invent a substitute experiment or stop at merely admitting the basis is missing. ${RESEARCH_HUNCH} For a new experiment that will be executed and needs recording for future recovery, choose or create one naturally named Experiment document under \`experiments/\` and write what it tests and how the result will be judged. For design-only work, produce an executable plan and stop before central execution. For analysis of existing results, inspect and analyze those results directly. For retrospective recording, label it as retrospective rather than presenting it as a prospective plan.`, { capability: "experiment-design" }),
      host("Execute the central experiment only when the request calls for execution. Use normal host tools. Append the actual procedure, result, and any deviation that changes the interpretation to the same Experiment document used for the prospective plan only when the maintenance trigger is met. For analysis-only or retrospective work, do not invent an execution step.", { capability: "experiment-execution" }),
      maintainArea("experiments", "When the maintenance trigger is met, record the experiment, diagnostic, result, failure, and the research decision it informs in the relevant Experiment document.")
    ], clarification: commonClarification }]
  };
  if (slug === "draft") return {
    status: "artifact-work",
    modes: [{ id: "default", when: "The user requests drafting, assessment, or revision of ordinary project text or artifacts.", steps: [
      readArea("claims", "the draft and its material claims"),
      relevantLessons,
      host("Read the target and relevant project material, then draft, assess, create, or revise the ordinary artifact with host editing tools when the requested deliverable requires it.", { capability: "artifact-editing" }),
      host("Run the checks needed for the requested artifact. If checks reveal in-scope fixable issues, route back to artifact editing before the final response; report only remaining issues that materially affect the artifact, exceed scope, or require user judgment.", { capability: "artifact-validation", readOnly: true }),
      maintainArea("claims", "Create or revise a naturally named Claim document under `claims/` only when an important research claim needs durable treatment. Do not build a Claim database.")
    ], clarification: commonClarification }]
  };
  if (slug === "figure") return {
    status: "artifact-work",
    modes: [{ id: "default", when: "The user requests a figure, diagram, plot, caption, or figure assessment.", steps: [
      readResearchDocuments("When existing Dove research context would materially help the requested figure, read `.dove/research/RESEARCH.md`, then the directly relevant Mission or Experiment summary, then only needed linked details. Otherwise work directly from the user's requested materials and data. Do not recursively scan the research tree."),
      relevantLessons,
      host("Inspect the requested figure's evidence job in the manuscript or research argument and gather the actual data, selection metadata, source visuals, plotting or rendering code, captions, nearby claims, and intended manuscript layout needed to judge that job. Create or revise the figure with the best-suited available specialized tool: use real data and reproducible plotting code for quantitative or statistical plots; use an available specialized figure-generation model for method diagrams, conceptual illustrations, or visual abstracts when it is the best fit; and use suitable SVG, layout, annotation, or image-editing tools for composition and repair. Do not invent data, results, or method details, and do not treat opening, contact-sheeting, or re-exporting an unchanged figure as improvement. Put scratch renders and validation intermediates in a repository-local temporary workspace such as `.claude/tmp/`, not the system `/tmp`, unless the user explicitly directs otherwise.", { capability: "figure-creation" }),
      host("Inspect the actual rendered figure in its reviewer-facing manuscript layout and at realistic final size, not only as a standalone source image or contact sheet. Check proportionately that it performs its intended evidence job for the method, comparison, result, failure mode, or contribution; remains legible and interpretable; and that its text, labels, units, legends, panels, visual encoding, arrows, cropping, caption, nearby manuscript claim, source data or selection metadata, and rendering or plotting logic agree. Look for concrete defects such as duplicate captions, over-dense panels, mismatched selection wording, or inconsistent examples when the materials make them possible. Treat generated-model output and visual inspection alone as unverified until these cross-checks pass. If checks reveal in-scope fixable issues, return to figure creation before the final response; report only remaining material issues, missing source material, scope limits, or needed user choices.", { capability: "figure-validation", readOnly: true }),
      updateResearchDocuments("Link the figure from the relevant Mission or Experiment detail document when that improves recovery. Update a directory summary or `RESEARCH.md` only if the figure materially changes that synthesis, mainline, conclusion, navigation, or priority.")
    ], clarification: commonClarification }]
  };
  if (slug === "review") return {
    status: "reviewer-perspective-work",
    modes: [{ id: "default", when: "The user requests reviewer-perspective critique, separate review preparation, return import, or review-context inspection.", steps: [
      readArea("reviews", "the review work"),
      relevantLessons,
      host("For a direct reviewer-perspective critique or separate review preparation, establish the external review context before forming findings. Infer the target venue and submission stage from the request, manuscript, and existing context; if the venue remains unclear and would materially change the review, ask rather than pretending the critique is venue-grounded. Reuse user-provided material only after checking that it is sufficiently current and relevant. Otherwise use available and approved host-native tools to discover, retrieve when available, read, and verify the material that can change the review judgment. Use current official venue sources for applicable scope, submission, review, formatting, anonymity, and required-material rules; published papers are scholarly context and cannot substitute for official venue requirements. Inspect a small, discriminating set of relevant published work when novelty, positioning, nearest comparators, evidence norms, experiment presentation, or reader expectations are material. Distinguish material merely found from material retrieved, inspected, and actually used; do not present search results, titles, or abstracts as papers read, and do not turn failure to find material into a claim that none exists. Do not require a fixed paper count, provider order, source list, or venue checklist. Stop when the inspected context is sufficient to support or change material findings, further search is unlikely to matter, or access boundaries are clear; report those boundaries and continue from available project material. For returned-review import or ordinary review-context inspection, do not trigger venue or paper search merely because Review was invoked.", { capability: "review-grounding", readOnly: true }),
      host(`Follow the user's actual Review request. ${DOVE_RESEARCH_AUTO_REVIEW_RESPONSE} ${DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY} For other direct review, form a fresh scoped judgment from the declared artifact or material and the established external review context: reconstruct its intended contribution, trace the claims that matter to the evidence actually offered, identify the strongest plausible falsifier or informed-reader objection, and judge whether the work answers it. Connect material findings to the official venue requirements and published work actually inspected when applicable. Return a scoped Markdown critique without pretending it is an independent external review; if grounding is unavailable or inapplicable, state that boundary instead of inventing references or substituting generic review language. To prepare a separate review, select or create one naturally named Review Markdown under \`reviews/\` and record the purpose, target venue when known, relevant project-relative artifact paths, scope limits, useful rubric, the official venue material and published work actually inspected or the access boundary, and a self-contained prompt for a separate reviewer chosen and managed by the user. Ask that reviewer to verify time-sensitive grounding when needed without assuming they have Dove's tools. If exact version freezing matters, use an ordinary Git commit, versioned copy, or review bundle and link it. To import a returned review, locate the corresponding Review document and preserve the supplied return faithfully without reconstructing preparation. To inspect existing review context, read and report it without creating a new Review document.`, { capability: "reviewer-perspective-work" }),
      host("Only when preparing a separate review handoff, return the relevant files and self-contained prompt to the user. Dove may declare a read-only scope and Markdown return contract, but the user is responsible for choosing and configuring the separate reviewer or session accordingly. Do not launch, impersonate, substitute for, or certify the separate reviewer. When importing, inspecting, or directly reviewing, do not create a new handoff.", { capability: "review-handoff", readOnly: true }),
      maintainArea("reviews", "When the user supplies an actual reviewer return, or asks to preserve a direct reviewer-perspective critique, append it faithfully to the corresponding Review document with a clear boundary from existing text. Do not rewrite, summarize over, or normalize the original return, and do not require verdict, severity, finding IDs, or a strict schema. Add author interpretation only when the user asks for it; use Rebuttal for substantive response, revision, and follow-up work.")
    ], clarification: commonClarification }]
  };
  if (slug === "rebuttal") return {
    status: "author-side-work",
    modes: [{ id: "default", when: "The user requests author-side rebuttal or requested revision from review findings.", steps: [
      readArea("reviews", "the relevant returned review"),
      relevantLessons,
      host("Read the relevant Review document and actual artifacts. Analyze each material finding against the evidence, draft or revise the response, and make requested ordinary project revisions. This remains author-side Dove work rather than a separate review return.", { capability: "rebuttal-and-revision" }),
      host("Check that each response and requested revision addresses a real finding. If checks reveal in-scope fixable issues, return to rebuttal or revision work before the final response; report only remaining material issues, scope limits, or needed user choices.", { capability: "artifact-validation", readOnly: true }),
      maintainArea("reviews", "Append the author response, requested revisions, resulting decisions, unresolved issues, and follow-up to the same Review document or the directly affected research document when that context is worth preserving.")
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
        updateResearchDocuments("Preserve useful existing structure in researcher-owned Lessons documents, or create a naturally named Markdown file when a new project-specific theme is genuinely useful. Do not write project-specific guidance into package-managed built-in Lessons themes. Update `lessons/LESSONS.md` with a natural link when needed. Source explanation is optional. Do not create lesson IDs, frontmatter, an application ledger, or treat Lessons as evidence.", {
          persistWhen: "the user explicitly asks to remember, reflect, or preserve durable Lessons guidance",
          persistencePolicy: "explicit-lessons"
        })
      ], clarification: commonClarification }
    ]
  };
}

const SURFACES = [
  ["research", "Complete one bounded pass of research, synthesis, or project investigation."],
  ["status", "Read the research overview, relevant summaries, and necessary linked context without writes."],
  ["source", "Discover, retrieve when available, read, verify, and document useful sources that materially inform the research."],
  ["experiment", "Design, analyze, record, or explicitly execute an experiment that advances a research decision."],
  ["draft", "Draft, assess, or revise ordinary project text and artifacts from the available evidence."],
  ["figure", "Inspect or gather real materials, then create, revise, validate, or caption figures when requested."],
  ["review", "Use reviewer perspective, prepare a separate review handoff, import a return, or inspect review context."],
  ["rebuttal", "Analyze review findings, draft author-side responses, and make requested evidence-backed revisions."],
  ["lessons", "Read advisory Lessons or maintain researcher-owned project Lessons when explicitly asked."],
  ["auto", `${DOVE_RESEARCH_AUTO_EXPLICIT_ONLY} Conduct foreground goal/mission cycles that autonomously advance the documented or recovered mainline within the user's limits.`]
];

export const DOVE_COMMAND_SKILL_INVENTORY_TEXT = DOVE_RESEARCH_SKILL_INVENTORY_TEXT;

export const COMMAND_SURFACES = SURFACES.map(([slug, summary]) => ({
  id: `dove.${slug}`,
  title: `Dove ${slug}`,
  summary,
  requiredTools: [],
  workflow: workflow(slug),
  examples: [`/dove:${slug}`],
  guidance: slug === "review"
    ? ["Review can use Dove's reviewer perspective directly or prepare a user-managed separate exchange. Dove never launches, impersonates, or certifies a separate reviewer."]
    : slug === "auto"
      ? ["For manuscript submission readiness, the Review gate is the narrow exception to Auto's no-mechanical-Skill rule: when the Claude Code runtime exposes the Skill tool, make an actual `dove:review` call and wait for `PASS` or `REVISE`. Figure is not another mandatory gate, but actual drawing, redrawing, figure revision, or figure-specific validation must use `dove:figure`; generated Markdown can request but cannot prove either runtime call."]
      : []
}));
export const COMMAND_SURFACE_BY_ID = Object.fromEntries(COMMAND_SURFACES.map((item) => [item.id, item]));

export function commandIdToSlug(commandId) { return commandId.replace(/^dove\./u, ""); }
export function hostCommandSlug(commandId) { return commandIdToSlug(commandId).replace(/\./gu, "-"); }
export function adapterPathForCommand(hostId, command) {
  const commandId = typeof command === "string" ? command : command.id;
  const slug = hostCommandSlug(commandId);
  if (hostId === "claude") return `.claude/commands/dove/${slug}.md`;
  if (hostId === "dsh") return `.dsh/skills/dove-${slug}/SKILL.md`;
  throw new Error(`Unknown host adapter: ${hostId}`);
}
export function commandAdapterPathsForHost(hostId) { return COMMAND_SURFACES.map((command) => adapterPathForCommand(hostId, command)); }
export function allGeneratedCommandAdapterPaths() { return PROJECT_HOST_IDS.flatMap(commandAdapterPathsForHost); }
export const HOST_ADAPTERS = Object.fromEntries(PROJECT_HOST_IDS.map((hostId) => {
  const commandPaths = commandAdapterPathsForHost(hostId);
  const extraPaths = hostId === "claude" ? [...DOVE_CLAUDE_AMBIENT_PROJECT_PATHS] : [];
  return [hostId, { label: HOST_DEFINITIONS[hostId].label, paths: [...commandPaths, ...extraPaths], requiredPaths: [...commandPaths, ...extraPaths], jsonChecks: HOST_DEFINITIONS[hostId].jsonChecks }];
}));
export const CURRENT_MANAGED_PATHS = Object.freeze({
  core: Object.freeze([...PACKAGE_RUNTIME_PATHS]),
  claude: Object.freeze([...HOST_ADAPTERS.claude.paths]),
  dsh: Object.freeze([...HOST_ADAPTERS.dsh.paths])
});
const RETIRED = ["workspace", "mission", "note", "experience"];
export const RETIRED_MANAGED_PATHS = Object.freeze({
  core: Object.freeze([...RETIRED_PACKAGE_RUNTIME_PATHS]),
  claude: Object.freeze([...RETIRED.map((slug) => `.claude/commands/dove/${slug}.md`), ".claude/agents/dove-reviewer.md"]),
  dsh: Object.freeze(RETIRED.flatMap((slug) => [`.dsh/skills/dove-${slug}/SKILL.md`, `.dsh/skills/dove-${slug}`]))
});
export function packageResourcePath(hostId, destinationPath) {
  return `${PACKAGE_RESOURCE_ROOT}/${hostId}/${destinationPath}`;
}
export const MANAGED_PACKAGE_PATHS = Object.freeze([
  ...commandAdapterPathsForHost("claude").map((item) => packageResourcePath("claude", item)),
  ...commandAdapterPathsForHost("dsh").map((item) => packageResourcePath("dsh", item)),
  ...PACKAGE_GENERATED_SUPPORT_PATHS,
  ...CURRENT_MANAGED_PATHS.core,
  ...PACKAGE_DOCUMENTATION_PATHS
]);
