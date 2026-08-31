import {
  DOVE_RESEARCH_ACTION_LENS_FRAME,
  DOVE_RESEARCH_ADVANCE,
  DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY,
  DOVE_RESEARCH_CAPABILITY_RESPONSIBILITY,
  DOVE_RESEARCH_CAPABILITY_RETURN,
  DOVE_RESEARCH_EVIDENCE_DRIVEN_CLAIM_BOUNDARY,
  DOVE_RESEARCH_EVIDENCE_STATE,
  DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY,
  DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY,
  DOVE_RESEARCH_FRAME,
  DOVE_RESEARCH_GOAL_TASK_THEORY_REVIEW,
  DOVE_RESEARCH_HUNCH,
  DOVE_RESEARCH_JUDGMENT_BOUNDARY,
  DOVE_RESEARCH_MAINLINE,
  DOVE_RESEARCH_MAINTENANCE_TRIGGER,
  DOVE_RESEARCH_MANUSCRIPT_REVIEW_BOUNDARY,
  DOVE_RESEARCH_MANUSCRIPT_REVIEW_CAPABILITY,
  DOVE_RESEARCH_MANUSCRIPT_REVIEW_LOOP,
  DOVE_RESEARCH_MANUSCRIPT_READINESS_BASIS,
  DOVE_RESEARCH_OUTCOME_CONTINUATION,
  DOVE_RESEARCH_REVIEW_CONDITIONAL_DELIVERY,
  DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC,
  DOVE_RESEARCH_REVIEW_DUAL_COMPLETION,
  DOVE_RESEARCH_REVIEW_FROZEN_HANDOFF,
  DOVE_RESEARCH_REVIEW_ISOLATED_PERSISTENT,
  DOVE_RESEARCH_REVIEW_MODES,
  DOVE_RESEARCH_REVIEW_DEFAULT,
  DOVE_RESEARCH_REVIEW_NEGATIVE_CONTINUITY,
  DOVE_RESEARCH_REVIEW_ANTI_GAMING,
  DOVE_RESEARCH_REVIEW_NO_INDEPENDENT_STATUS_CLAIM,
  DOVE_RESEARCH_REVIEW_RETURN_PROVENANCE,
  DOVE_RESEARCH_REVIEW_VERSION_CURRENCY,
  DOVE_RESEARCH_SHARED_CONTRACT,
  DOVE_RESEARCH_DEFAULT_AUTONOMY,
  DOVE_RESEARCH_CLARIFICATION,
  DOVE_RESEARCH_CROSS_DOMAIN_INTUITION,
  DOVE_RESEARCH_OVERALL_BEST_ACTION,
  DOVE_RESEARCH_REAL_BLOCKER,
  DOVE_RESEARCH_REPORTING_DISTINCTION,
  DOVE_RESEARCH_SKILL_INVENTORY_TEXT,
  DOVE_RESEARCH_SUPPORT_SUBORDINATION_BOUNDARY
} from "./dove-research-contract.mjs";
import { EXA_WEB_SUPPORT_SKILL_PATH } from "./web-access-integration.mjs";

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
  ".claude/skills/dove-web-reader/SKILL.md",
  ".claude/settings.json"
]);
export const PACKAGE_RESOURCE_ROOT = "package-resources/hosts";
export const PACKAGE_GENERATED_SUPPORT_PATHS = Object.freeze([
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/agents/dove.md`,
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/rules/dove.md`,
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/skills/dove-intake/SKILL.md`,
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/skills/dove-paper-search/SKILL.md`,
  `${PACKAGE_RESOURCE_ROOT}/claude/${EXA_WEB_SUPPORT_SKILL_PATH}`
]);
export const HOST_DEFINITIONS = {
  claude: { label: "Claude Code", scope: "project", jsonChecks: [] },
  dsh: { label: "DeepSeek Harness (dsh)", scope: "project", jsonChecks: [] }
};
export const OPENCODE_ROLE_SKILL_PATHS = [];

export const HOST_ADAPTER_POLICY = Object.freeze({
  toolAccess: Object.freeze({ transport: "host-files", unavailable: "report", cliFallback: false, shellFallback: false }),
  privacy: Object.freeze({ exposePrivateProtocol: false })
});

const RESEARCH_FRAME = DOVE_RESEARCH_FRAME;
const RESEARCH_ADVANCE = DOVE_RESEARCH_ADVANCE;
const RESEARCH_HUNCH = DOVE_RESEARCH_HUNCH;
const JUDGMENT_BOUNDARY = DOVE_RESEARCH_JUDGMENT_BOUNDARY;
const RESEARCH_MAINTENANCE_TRIGGER = DOVE_RESEARCH_MAINTENANCE_TRIGGER;

const commonClarification = [DOVE_RESEARCH_CLARIFICATION];

const DEFAULT_HOST_GUIDANCE = Object.freeze({
  common: Object.freeze([
    "Use only tools that are actually available, approved, and appropriate in the current host and project. If a needed capability is unavailable, state that boundary and use any other approved material or action that can still advance the request."
  ]),
  claude: Object.freeze([
    "Claude Code adapters and hooks are project integration, not a Dove scheduler. If the current Claude Code session actually exposes background execution, Monitor, Cron, loop, tmux, or equivalent waiting affordances, use them only for a real wait or long-running host action, cover success and failure terminal states, and return to Dove's mainline judgment when results arrive."
  ]),
  dsh: Object.freeze([
    "DSH adapters are project-local filesystem Skills. Use only DSH-exposed filesystem and tool affordances; do not claim Claude Code hooks, Monitor, Cron, tmux, MCP support, or background supervision unless DSH actually exposes an equivalent in the current run."
  ])
});

function hostGuidance(extra = {}) {
  return Object.fromEntries(["common", "claude", "dsh"].map((hostId) => [hostId, [
    ...(DEFAULT_HOST_GUIDANCE[hostId] ?? []),
    ...(extra[hostId] ?? [])
  ]]));
}

function action(capability, instruction, options = {}) {
  return {
    type: "host",
    capability,
    readOnly: options.readOnly === true,
    persistWhen: options.persistWhen ?? "never",
    persistencePolicy: options.persistencePolicy ?? "never",
    instruction
  };
}

const readResearchDocuments = (instruction) => action("research-document-reading", instruction, { readOnly: true });
const updateResearchDocuments = (instruction, options = {}) => action("research-document-maintenance", instruction, {
  persistWhen: options.persistWhen ?? RESEARCH_MAINTENANCE_TRIGGER,
  persistencePolicy: options.persistencePolicy ?? "standard-research"
});
const relevantLessons = action(
  "lesson-reading",
  "When reusable guidance may help the current task, read `.dove/research/RESEARCH.md` only when project context is needed, then `.dove/research/lessons/LESSONS.md` if it exists, then only directly relevant linked Lessons. If Lessons materials are absent, work without them. Treat Lessons as fallible advice, never as evidence or authority.",
  { readOnly: true }
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

function sectionItems(sections, field) {
  return sections.flatMap((section) => Array.isArray(section[field]) ? section[field] : []);
}

const SHARED_RESEARCH_JUDGMENT_TITLE = "Shared research judgment";
const SHARED_RESEARCH_JUDGMENT_RESPONSIBILITIES = Object.freeze([
  DOVE_RESEARCH_SHARED_CONTRACT,
  DOVE_RESEARCH_CAPABILITY_RESPONSIBILITY,
  DOVE_RESEARCH_CAPABILITY_RETURN,
  "When route, cause, or response is uncertain, compare different explanations or approaches by mechanism, inspected evidence, actual use conditions, and whether a feasible action can distinguish them.",
  DOVE_RESEARCH_EVIDENCE_STATE
]);
const SHARED_RESEARCH_JUDGMENT_BOUNDARIES = Object.freeze([
  "Shared research judgment is natural-language responsibility only; it does not expand this capability's read, write, execution, handoff, submission, or autonomy authorization.",
  "Support facts boundary: keep operational status, file presence, document maintenance, validation or build results, delivery facts, Review provenance, and other support facts separate from inspected evidence, material decisions, substantive progress, and current mainline sufficiency."
]);
const REVIEW_HANDOFF_LISTED_MATERIALS_BOUNDARY = "`dove-review` visibility boundary: only the frozen near-submission materials listed for the current round are visible. This normally means the complete paper, actual submission appendices or supplements, authoritative LaTeX source and compiled output, and venue-facing files; it excludes code, raw experiment outputs, unprocessed figure materials, internal notes, `.dove/research/**`, author evidence packages, private transcripts, old Reviews, historical returns, prior handoffs, and other unlisted project materials.";

function sharedResearchJudgmentSection() {
  return {
    title: SHARED_RESEARCH_JUDGMENT_TITLE,
    responsibilities: [...SHARED_RESEARCH_JUDGMENT_RESPONSIBILITIES],
    boundaries: [...SHARED_RESEARCH_JUDGMENT_BOUNDARIES]
  };
}

function capabilityContract(options) {
  const semanticSections = Array.isArray(options.semanticSections) && options.semanticSections.length > 0
    ? [sharedResearchJudgmentSection(), ...options.semanticSections]
    : null;
  const contract = {
    purpose: options.purpose,
    when: options.when,
    responsibilities: semanticSections ? sectionItems(semanticSections, "responsibilities") : [...SHARED_RESEARCH_JUDGMENT_RESPONSIBILITIES, ...(options.responsibilities ?? [])],
    actions: semanticSections ? sectionItems(semanticSections, "actions") : options.actions ?? [],
    boundaries: semanticSections ? sectionItems(semanticSections, "boundaries") : [...SHARED_RESEARCH_JUDGMENT_BOUNDARIES, ...(options.boundaries ?? [])],
    nonGoals: semanticSections ? sectionItems(semanticSections, "nonGoals") : options.nonGoals ?? [],
    clarification: options.clarification ?? commonClarification,
    hostGuidance: options.hostGuidance ?? hostGuidance()
  };
  if (semanticSections) contract.semanticSections = semanticSections;
  return contract;
}

function contract(slug) {
  if (slug === "research") return capabilityContract({
    purpose: "Advance a confirmed research goal through the overall-best sequence of investigation, experiment, analysis, writing, figure, review, and delivery actions.",
    when: "Use for a clear research goal or project request. Dove continues across substantive rounds by default; no separate Auto mode is required.",
    responsibilities: [
      DOVE_RESEARCH_DEFAULT_AUTONOMY,
      `${RESEARCH_FRAME} ${RESEARCH_HUNCH}`,
      DOVE_RESEARCH_CROSS_DOMAIN_INTUITION,
      DOVE_RESEARCH_GOAL_TASK_THEORY_REVIEW,
      DOVE_RESEARCH_OVERALL_BEST_ACTION,
      DOVE_RESEARCH_REAL_BLOCKER,
      "After each substantive result, absorb the changed evidence and authoritative artifact state, identify the highest material unresolved deficiency, compare serious candidate explanations, and choose the next overall-best feasible action. Use specialist capabilities only when they materially help that action.",
      `${DOVE_RESEARCH_OUTCOME_CONTINUATION} ${DOVE_RESEARCH_REPORTING_DISTINCTION}`
    ],
    actions: [
      readArea("missions", "the research goal"),
      relevantLessons,
      action("project-exploration", `Inspect the ordinary project materials and real external resources needed to understand the question. ${RESEARCH_FRAME} ${DOVE_RESEARCH_CROSS_DOMAIN_INTUITION}`, { readOnly: true }),
      action("research-progression", `Run the default Dove research loop: ${DOVE_RESEARCH_DEFAULT_AUTONOMY} ${DOVE_RESEARCH_ADVANCE}`),
      maintainArea("missions", "When the maintenance trigger is met, update an existing Mission document or create one naturally named Mission document for the substantive work, evidence, decisions, failures, and continuation context.")
    ],
    boundaries: [
      "Research may read, write, edit, run, or validate ordinary project artifacts to the extent authorized by the user's goal and needed for the overall-best mainline action.",
      `Maintain Dove research Markdown only when ${RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not expose Auto as a Skill, mode, stage, or user coordination requirement.",
      "Do not stop after one search, experiment, review, edit, validation, or report while an effective in-scope mainline action remains.",
      "Do not create a Mission document merely to prove the capability ran."
    ],
    hostGuidance: hostGuidance({
      common: ["Host waiting or interruption support is operational only; preserve the continuation point and return to the Dove mainline judgment rather than creating a Dove runtime."],
      claude: ["Use Claude Code background, Monitor, Cron, loop, tmux, or equivalent only for a real long-running host action or wait, then reassess all terminal outcomes."],
      dsh: ["Use only DSH-exposed filesystem and tool affordances; do not claim background continuity or isolated review capabilities DSH does not provide."]
    })
  });
  if (slug === "status") return capabilityContract({
    purpose: "Report the current Dove research status from the overview, relevant summaries, and directly needed linked context without writes.",
    when: "Use when the user asks where the research stands, what is active, or what should be considered next.",
    responsibilities: [
      "Read only enough research context to answer the status question: the overview when present, the relevant summaries, and directly linked details needed to resolve material ambiguity.",
      "Report current mainline, substantive progress, active problems, decisions, and next priorities as ordinary document facts.",
      "Treat missing overview, missing summary, or broken links naturally; do not infer a database state."
    ],
    actions: [
      readResearchDocuments("Read `.dove/research/RESEARCH.md` once when it exists, then read the one or more directory summaries needed for the question, then only directly linked details needed to resolve material ambiguity. Do not recursively scan the research tree. Report the current mainline, substantive progress, active problems, decisions, and next priorities. If an overview, summary, or link is absent, say so naturally; do not infer a database state or modify files."),
      relevantLessons
    ],
    boundaries: [
      "Status is read-only: do not create, modify, repair, validate, or normalize files."
    ],
    nonGoals: [
      "Do not use Status as a hidden sync, Doctor, migration, or research-document maintenance command.",
      "Do not treat installed-file health, validation status, or Markdown navigation as scientific progress."
    ],
    clarification: []
  });
  if (slug === "source") return capabilityContract({
    purpose: "Discover, retrieve when available, read, verify, and document useful sources that materially inform the research.",
    when: "Use when the user requests source discovery, reading, comparison, verification, or source-backed positioning, or when Dove is proposing or materially changing a research goal, key task, route, hypothesis, or evaluation target whose basis depends on external theory or related work.",
    responsibilities: [
      "Ground source work in the user's source question and current project need, not in a fixed provider order or paper count.",
      DOVE_RESEARCH_GOAL_TASK_THEORY_REVIEW,
      "For goal, task, route, hypothesis, or evaluation proposals, inspect the theory and related work that can change significance, mechanism, novelty, positioning, method choice, or evaluation design; return the competing interpretations and what the inspected sources actually support, rather than a bibliography dump.",
      "Distinguish material merely found from material actually retrieved, inspected, and used.",
      "When one source path is unavailable, report the boundary and continue with other approved local, web, or user-provided material that can still inform the question."
    ],
    actions: [
      readArea("sources", "the source question"),
      relevantLessons,
      action("source-research", "Discover, retrieve when available, save when useful, read, and verify real material with available and approved host-native project or external research tools. Distinguish material merely found from material actually retrieved, inspected, and used; when one source path is unavailable, report that boundary and continue with other approved local, web, or user-provided material that can still inform the question."),
      maintainArea("sources", "When a used source deserves durable context, create or update one naturally named source note under `sources/` with the citation or URL, what was actually inspected and learned, and useful related links. Do not generate a Source ID, fingerprint, or byte hash.")
    ],
    boundaries: [
      "Saving retrieved source material or source notes is allowed only when useful for the requested source work and current host approvals permit it.",
      `Maintain Dove research Markdown only when ${RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not treat search results, titles, abstracts, provider hits, or missing results as papers read.",
      "Do not create source IDs, source databases, trust scores, or research hashes.",
      "Do not substitute CLI, shell, curl, or ad hoc fetch scripts when web or MCP retrieval is unavailable."
    ],
    hostGuidance: hostGuidance({
      claude: ["For web access, keep built-in WebSearch available for discovery. Do not use built-in WebFetch; project permissions deny it. Use the pinned dove-paper-search MCP for scholarly paper acquisition and full-text reading, and the exa hosted MCP for ordinary webpage bodies, documentation pages, venue pages, and known URLs. If either MCP is unavailable or unapproved, state the boundary rather than substituting CLI, shell, curl, or ad hoc fetch scripts, then continue with other approved local, web, user-provided, experimental, or analytical material that can still advance the question. Distinguish discovery snippets and alternative evidence from webpage or paper full text actually retrieved and read through the unavailable MCP."],
      dsh: ["DSH receives only filesystem Skills from Dove. Do not claim Claude project permissions, Claude MCP servers, built-in WebFetch denial, or Exa availability unless DSH itself exposes equivalent approved tools in the current run."]
    })
  });
  if (slug === "experiment") return capabilityContract({
    purpose: "Design, analyze, record, or explicitly execute experiments and diagnostics that can change a research decision.",
    when: "Use when the user requests experiment design, execution, analysis, recording, or when an experiment/analysis is the material way to resolve a contribution or evidence deficiency within the confirmed scope.",
    responsibilities: [
      "Follow the user's actual experiment request: design-only, execution, analysis of existing results, or retrospective recording are different tasks.",
      "Before treating a new experiment as central, establish the real problem, key uncertainty, or route decision it should resolve; if missing, inspect actual project material, relevant sources, or a smallest low-risk diagnostic rather than inventing a substitute experiment or stopping at the gap.",
      "When contribution is weak because evidence or analysis is insufficient, prefer experiments or analyses that can materially change the judgment, but do not run experiments mechanically when another action is more decisive."
    ],
    actions: [
      readArea("experiments", "the experiment"),
      relevantLessons,
      action("experiment-design", `Follow the user's actual experiment request. ${JUDGMENT_BOUNDARY} Before treating a new experiment as central, establish the real problem, key uncertainty, or route decision it should resolve from the request and project context; if that basis is not yet established, pause central experiment design and inspect the actual project material, relevant sources, or smallest low-risk diagnostic needed to investigate the problem. For a new experiment that will be executed and needs recording for future recovery, choose or create one naturally named Experiment document under \`experiments/\` and write what it tests and how the result will be judged. For design-only work, produce an executable plan and stop before central execution. For analysis of existing results, inspect and analyze those results directly. For retrospective recording, label it as retrospective rather than presenting it as a prospective plan.`),
      action("experiment-execution", "Execute the central experiment only when the request calls for execution and the host approvals, resources, and scope permit it. Append the actual procedure, result, and any deviation that changes the interpretation to the same Experiment document used for the prospective plan only when the maintenance trigger is met. For analysis-only or retrospective work, do not invent an execution action."),
      maintainArea("experiments", "When the maintenance trigger is met, record the experiment, diagnostic, result, failure, and the research decision it informs in the relevant Experiment document.")
    ],
    boundaries: [
      "Design-only work stops before central execution; high-cost, destructive, outward-facing, or resource-heavy experiments still require explicit user direction and host approval.",
      `Maintain Dove research Markdown only when ${RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not synthesize a prospective plan after execution or disguise retrospective notes as prior design.",
      "Do not run a convenient proxy experiment that cannot affect the research decision."
    ]
  });
  if (slug === "draft") return capabilityContract({
    purpose: "Draft, assess, or revise ordinary project text and artifacts from the available evidence.",
    when: "Use when the user requests drafting, assessment, or revision of text or artifacts, or when expression, argument, or an authoritative delivery artifact is the limiting deficiency.",
    responsibilities: [
      "Read the target artifact and the project evidence needed to support its material claims.",
      "Prioritize writing or packaging when the science is sufficiently supported for the requested claim, or when expression, argument, source propagation, or delivery artifact quality is itself limiting the mainline.",
      `${DOVE_RESEARCH_EVIDENCE_DRIVEN_CLAIM_BOUNDARY} In Draft, when a feasible in-mainline method, experiment, analysis, source, figure, artifact-propagation, or argument action can still support the intended contribution, do that higher-level action before narrowing the claim or merely weakening prose.`,
      "If clearer wording cannot support the intended contribution, identify the method, evidence, experiment, source, or artifact deficiency rather than only weakening prose."
    ],
    actions: [
      readArea("claims", "the draft and its material claims"),
      relevantLessons,
      action("artifact-editing", "Read the target and relevant project material, then draft, assess, create, or revise the ordinary artifact with host editing tools when the requested deliverable requires it. For manuscript work, edit the authoritative source and propagate through the real build or export path before claiming the artifact is current."),
      action("artifact-validation", "Run the checks needed for the requested artifact. If checks reveal in-scope fixable issues, return to artifact editing before the final response; report only remaining issues that materially affect the artifact, exceed scope, or require user judgment.", { readOnly: true }),
      maintainArea("claims", "Create or revise a naturally named Claim document under `claims/` only when an important research claim needs durable treatment. Do not build a Claim database.")
    ],
    boundaries: [
      "Draft may create or edit ordinary project artifacts requested by the user or needed for the bounded deliverable; destructive, outward-facing, or submission actions still need explicit authorization.",
      `Maintain Dove research Markdown only when ${RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not let polished wording, a generated export, or local validation replace missing evidence for a claim.",
      "Do not create Claim records merely because drafting occurred."
    ]
  });
  if (slug === "figure") return capabilityContract({
    purpose: "Inspect or gather real materials, then create, revise, validate, or caption figures when requested.",
    when: "Use when the user requests a figure, diagram, plot, caption, or figure assessment, or when a figure is the material evidence or communication bottleneck.",
    responsibilities: [
      DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY,
      DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY,
      "Prioritize figure work when the figure's evidence job, caption, layout, or data agreement can materially affect the research argument or deliverable; do not package unsupported science as a nicer visual."
    ],
    actions: [
      readResearchDocuments("When existing Dove research context would materially help the requested figure, read `.dove/research/RESEARCH.md`, then the directly relevant Mission or Experiment summary, then only needed linked details. Otherwise work directly from the user's requested materials and data. Do not recursively scan the research tree."),
      relevantLessons,
      action("figure-creation", "Inspect the requested figure's evidence job in the manuscript or research argument and gather the actual data, selection metadata, source visuals, plotting or rendering code, captions, nearby claims, and intended manuscript layout needed to judge that job. Create or revise the figure with the best-suited available specialized tool: use real data and reproducible plotting code for quantitative or statistical plots; use an available specialized figure-generation model for method diagrams, conceptual illustrations, or visual abstracts when it is the best fit; and use suitable SVG, layout, annotation, or image-editing tools for composition and repair. Do not invent data, results, or method details, and do not treat opening, contact-sheeting, or re-exporting an unchanged figure as improvement. Put scratch renders and validation intermediates in a repository-local temporary workspace such as `.claude/tmp/`, not the system `/tmp`, unless the user explicitly directs otherwise."),
      action("figure-validation", "Inspect the actual rendered figure in its reviewer-facing manuscript layout and at realistic final size, not only as a standalone source image or contact sheet. Check proportionately that it performs its intended evidence job for the method, comparison, result, failure mode, or contribution; remains legible and interpretable; and that its text, labels, units, legends, panels, visual encoding, arrows, cropping, caption, nearby manuscript claim, source data or selection metadata, and rendering or plotting logic agree. If checks reveal in-scope fixable issues, return to figure creation before the final response; report only remaining material issues, missing source material, scope limits, or needed user choices.", { readOnly: true }),
      updateResearchDocuments("Link the figure from the relevant Mission or Experiment detail document when that improves recovery. Update a directory summary or `RESEARCH.md` only if the figure materially changes that synthesis, mainline, conclusion, navigation, or priority.")
    ],
    boundaries: [
      "Figure may create, edit, render, or validate ordinary project visuals when requested or material to the deliverable; it must not invent data, results, or method details.",
      `Maintain Dove research Markdown only when ${RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not treat image counts, embedding, resolution, contact sheets, opening an image, or unchanged re-export as proof that the figure communicates the research.",
      "Do not use a figure-generation model when real data plotting, source inspection, or simple editing is the correct action."
    ]
  });
  if (slug === "review") {
    const reviewContextReadAction = readArea("reviews", "the review work");
    const reviewGroundingAction = action("review-grounding", "For author-side scientific self-check, inspect the actual current full paper and ask only if an unclear venue would materially change the judgment. For `dove-review`, require an identified target venue, then let the isolated reviewer context independently inspect official submission requirements, reviewer criteria, and a small representative set of actually retrieved and inspected submitted or published papers and related work needed to judge contribution, positioning, evidence norms, experiment presentation, and reader expectations. Distinguish material merely found from material retrieved, inspected, and used. Returned-review import and ordinary context inspection do not trigger venue or paper search merely because Review was invoked.", { readOnly: true });
    const reviewerPerspectiveAction = action("reviewer-perspective-work", "Perform author-side scientific self-check in the current Dove author context; do not call the Agent tool or launch helper subagents. From the established grounding, test contribution, novelty, claims, evidence, method, experiment conditions, limitations, writing clarity, likely reader confusion, and material figure evidence jobs across the current full paper. Return concrete findings with evidence, consequence, useful response, and a natural-language assessment; keep delivery readiness separate. Mark it as author-side self-check, not independent `dove-review`, external acceptance, or authority over the Workspace mainline.", { readOnly: true });
    const deliveryReviewAction = action("delivery-review", "When delivery review is selected, inspect official venue requirements, build output, required materials, formatting, anonymity, packaging, and access limits. Report delivery readiness separately from scientific acceptability.");
    const reviewHandoffAction = action("dove-review-handoff", "Start `dove-review` only when the paper is highly complete, basically format-compliant, and organized as a near-real submission. Before invocation, create or update one naturally named Review document with the purpose, target venue, exact project-relative frozen material list, self-contained reviewer prompt, and known host limitations. Freeze and expose only the current complete paper, authoritative LaTeX source and actual compiled output, actual submission appendices or supplementary material, and other venue-facing files that would really accompany submission. Do not expose code, raw experiment outputs, unprocessed figure materials, internal notes, `.dove/research/**`, author evidence packages, private transcripts, old Reviews, historical handoffs, or other unlisted project materials. For the first round, start a fresh genuinely isolated host Agent context using the same Dove research-agent definition plus the reviewer-specific visibility overlay; record any real host context, session, resume, environment, or mount handle. For later rounds, resume that same reviewer context unless the user explicitly asks to change reviewer. Never invent a handle. The reviewer may use its own isolated scratch or environment for venue and literature grounding, but it remains read-only toward author materials. It reviews the whole current submission rather than only a diff and reports scientific acceptability separately from delivery readiness. If the host cannot enforce the material boundary or provide genuine isolation, persistence, and recovery, report that independent `dove-review` is unavailable rather than substituting the author context. That unavailable review path does not stop author-side progression: when the confirmed goal still calls for work, continue with feasible Source, Experiment, Draft, Figure, Rebuttal, implementation, author-side scientific self-check, delivery review, or other approved action without claiming that independent review occurred.");
    const reviewMaintenanceAction = maintainArea("reviews", "When the user supplies an actual `dove-review` return, clarification, rebuttal exchange, or asks to preserve an author-side scientific self-check or external handoff record, append it faithfully to the corresponding Review document with a clear boundary from existing text. Record real host-provided context or session provenance, review round, target venue, and frozen material scope when known. Mark user-provided or pasted returns with unverifiable origin as provenance unverified rather than presenting them as the current isolated `dove-review` result. Do not rewrite, summarize over, normalize, or replace the original return; add author interpretation only when the user asks.");
    const semanticSections = [
      {
        title: "Mode selection",
        purpose: DOVE_RESEARCH_REVIEW_MODES,
        responsibilities: [
          DOVE_RESEARCH_REVIEW_DEFAULT
        ],
        nonGoals: [
          "Do not make Review a user-switchable persona, Workspace authority, venue registry, strict import schema, finding-ID system, trust score, or uncontrolled reviewer delegation."
        ]
      },
      {
        title: "Author-side scientific self-check",
        purpose: DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC,
        responsibilities: [
          DOVE_RESEARCH_MANUSCRIPT_REVIEW_BOUNDARY,
          "Perform grounding and critique directly in the current Dove author context. Independent external review exists only as a real isolated persistent `dove-review` context with a near-submission handoff."
        ],
        actions: [
          reviewGroundingAction,
          reviewerPerspectiveAction
        ],
        boundaries: [
          "Author-side self-check may read, search, and inspect the current full paper and critique it, but the review action itself is read-only. Dove's author context absorbs findings and chooses subsequent Source, Experiment, Draft, Figure, Rebuttal, implementation, or delivery work through the default research progression.",
          "Author-side self-check may give an advisory acceptability assessment, but it does not claim independent `dove-review`, external acceptance, scientific certification, or authority over the Workspace mainline."
        ]
      },
      {
        title: "Conditional Delivery Review",
        purpose: DOVE_RESEARCH_REVIEW_CONDITIONAL_DELIVERY,
        actions: [
          deliveryReviewAction
        ]
      },
      {
        title: "`dove-review` external handoff",
        purpose: DOVE_RESEARCH_REVIEW_DUAL_COMPLETION,
        responsibilities: [
          DOVE_RESEARCH_REVIEW_ISOLATED_PERSISTENT,
          DOVE_RESEARCH_REVIEW_FROZEN_HANDOFF,
          DOVE_RESEARCH_REVIEW_NEGATIVE_CONTINUITY,
          DOVE_RESEARCH_REVIEW_VERSION_CURRENCY,
          DOVE_RESEARCH_REVIEW_RETURN_PROVENANCE
        ],
        actions: [
          reviewHandoffAction
        ],
        boundaries: [
          REVIEW_HANDOFF_LISTED_MATERIALS_BOUNDARY,
          DOVE_RESEARCH_REVIEW_ANTI_GAMING,
          DOVE_RESEARCH_REVIEW_NO_INDEPENDENT_STATUS_CLAIM
        ]
      },
      {
        title: "Returned Review Import",
        purpose: "Faithfully preserve a returned review in the corresponding Review document.",
        responsibilities: [
          "Append the actual reviewer return faithfully with a clear boundary from existing text. Bind verified returns to real host-provided context or session provenance, review round, target venue, and frozen material scope when exposed; label unverifiable pasted or user-provided origins as provenance unverified. Do not rewrite, summarize over, normalize, or invent severity, finding IDs, strict schema, or acceptance status."
        ],
        actions: [
          reviewMaintenanceAction
        ],
        boundaries: [
          "Import preserves the returned Markdown faithfully and does not automatically begin author response, revision, venue search, or paper search. Substantive response belongs to Rebuttal."
        ]
      },
      {
        title: "Context Inspection",
        purpose: "Read and report existing Review context without creating a new exchange.",
        responsibilities: [
          "Read only the review context needed for the question, report what is already present, and say naturally when a needed entry or link is absent."
        ],
        actions: [
          reviewContextReadAction,
          relevantLessons
        ],
        boundaries: [
          "Context inspection is read-only and does not create a new handoff, trigger external search, or mutate files."
        ]
      },
      {
        title: "Downstream use",
        purpose: "Review findings are evidence for Dove's author context. It validates them and absorbs valid concerns into the next scientific judgment, research action, revision, clarification, or rebuttal; `dove-review` remains external and read-only.",
        responsibilities: [
          "Return findings with enough evidence and consequence for the caller to act on, reject with inspected evidence, bound or block on a real limit, or deliberately defer because another mainline action is more material."
        ],
        boundaries: [
          "The selected Review method ends after its critique, delivery inspection, handoff, import, or context report. The author context then absorbs material findings into Dove's default research progression when the confirmed goal calls for further work; `dove-review` itself remains read-only and does not perform author-side revision."
        ],
        nonGoals: [
          "Do not turn a Review finding, report, or recommendation into authority over the Workspace mainline or into a hidden user-facing mode."
        ]
      }
    ];
    return capabilityContract({
      purpose: "Use author-side scientific self-check, conditional delivery review, `dove-review` external handoff, returned-review import, or context inspection.",
      when: "Use when author-side scientific self-check can improve the paper, when the user requests delivery review, when a near-submission paper is ready for `dove-review`, or for returned-review import or context inspection.",
      responsibilities: sectionItems(semanticSections, "responsibilities"),
      actions: sectionItems(semanticSections, "actions"),
      boundaries: sectionItems(semanticSections, "boundaries"),
      nonGoals: sectionItems(semanticSections, "nonGoals"),
      semanticSections,
      hostGuidance: hostGuidance({
        claude: ["For `dove-review`, use a genuinely isolated persistent and recoverable Claude Code Agent context only if the host actually provides it and can restrict visibility to the frozen near-submission materials. Start fresh for the first round, record real host-provided resume provenance, resume the same context for re-review, and change it only on explicit user request. If unavailable, report the boundary rather than using the author context, then continue any feasible author-side research, revision, self-check, rebuttal, or delivery work still required by the confirmed goal without claiming independent review."],
        dsh: ["DSH receives filesystem Skills only. Use DSH for `dove-review` only if the current DSH host independently exposes equivalent isolated, persistent, recoverable Agent context with restricted material visibility; otherwise report the boundary, do not simulate independence, and continue any feasible author-side work still required by the confirmed goal."]
      })
    });
  }
  if (slug === "rebuttal") return capabilityContract({
    purpose: "Analyze review findings, draft author-side responses, and make requested evidence-backed revisions.",
    when: "Use when the user requests author-side rebuttal, response, revision, or follow-up work from review findings.",
    responsibilities: [
      "Treat Rebuttal as current-Dove author-side work: analyze each material finding against evidence, decide whether to accept, reject, qualify, or investigate it, and revise artifacts when that is the useful response.",
      `${DOVE_RESEARCH_EVIDENCE_DRIVEN_CLAIM_BOUNDARY} In Rebuttal, when a feasible in-mainline method, experiment, analysis, source, figure, manuscript, supplement, or venue-facing action can answer a valid concern and support the intended contribution, do that higher-level action before narrowing, splitting, or weakening the claim.`,
      "Strengthen evidence, analysis, manuscript text, figures, captions, tables, supplements, highlights, or venue-facing files when findings reveal fixable deficiencies; do not reduce rebuttal to response text when real revisions are in scope.",
      "Keep reviewer return, author interpretation, revisions, and unresolved issues clearly separated."
    ],
    actions: [
      readArea("reviews", "the relevant returned review"),
      relevantLessons,
      action("rebuttal-and-revision", "Read the relevant Review document and actual artifacts. Analyze each material finding against the evidence, draft or revise the response, and make requested ordinary project revisions that resolve, reduce, or honestly bound the finding. This remains author-side Dove work rather than a separate review return."),
      action("artifact-validation", "Check that each response and requested revision addresses a real finding. If checks reveal in-scope fixable issues, return to rebuttal or revision work before the final response; report only remaining material issues, scope limits, or needed user choices.", { readOnly: true }),
      maintainArea("reviews", "Append the author response, requested revisions, resulting decisions, unresolved issues, and follow-up to the same Review document or the directly affected research document when that context is worth preserving.")
    ],
    boundaries: [
      "Rebuttal may modify ordinary project artifacts and research documents when requested or when revisions are the in-scope response; outward-facing submission or destructive action still requires explicit authorization.",
      `Maintain Dove research Markdown only when ${RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not let the Reviewer control the Workspace mainline or take over author-side revision.",
      "Do not fabricate reviewer returns, overwrite original returns with author summaries, or claim independent external review or independent Reviewer status."
    ]
  });
  return capabilityContract({
    purpose: "Read advisory Lessons or maintain researcher-owned project Lessons when explicitly asked.",
    when: "Use when the user requests current Lessons, reusable guidance, remembering, reflection, or durable Lessons maintenance.",
    responsibilities: [
      "Treat Lessons as fallible advice that may help current work but never as evidence, permission, authority, or a completion certificate.",
      "For reading, use the Lessons summary and only relevant linked theme documents; no writes.",
      "For maintenance, write only when the user explicitly asks to remember, reflect, or preserve durable Lessons guidance. Preserve useful structure in researcher-owned Lessons documents."
    ],
    actions: [
      readResearchDocuments("Read `.dove/research/RESEARCH.md` first only when project context is needed, then read `.dove/research/lessons/LESSONS.md` if it exists, then only linked Lessons relevant to the request. If no Lessons summary or linked Lesson exists, report that naturally and continue from the available context. Do not create or modify files and do not treat Lessons as evidence."),
      updateResearchDocuments("Preserve useful existing structure in researcher-owned Lessons documents, or create a naturally named Markdown file when a new project-specific theme is genuinely useful. Update `lessons/LESSONS.md` with a natural link when needed. Source explanation is optional. Do not create lesson IDs, frontmatter, an application ledger, or treat Lessons as evidence.", {
        persistWhen: "the user explicitly asks to remember, reflect, or preserve durable Lessons guidance",
        persistencePolicy: "explicit-lessons"
      })
    ],
    boundaries: [
      "Lessons reading is read-only. Lessons maintenance is explicit-only and limited to researcher-owned Lessons files plus natural links from `lessons/LESSONS.md`.",
      "Lessons materials are optional researcher-owned advisory documents, not package-owned defaults."
    ],
    nonGoals: [
      "Do not turn Lessons into a database, frontmatter schema, application ledger, or research-completion record.",
      "Do not treat Lessons as evidence that a current research claim or artifact is correct."
    ]
  });
}

const SURFACES = [
  ["research", "Advance a confirmed research goal through Dove's default multi-round research progression."],
  ["status", "Read the research overview, relevant summaries, and necessary linked context without writes."],
  ["source", "Discover, retrieve when available, read, verify, and document useful sources that materially inform the research."],
  ["experiment", "Design, analyze, record, or explicitly execute an experiment that advances a research decision."],
  ["draft", "Draft, assess, or revise ordinary project text and artifacts from the available evidence."],
  ["figure", "Inspect or gather real materials, then create, revise, validate, or caption figures when requested."],
  ["review", "Use author-side self-check, delivery review, `dove-review`, returned-review import, or context inspection."],
  ["rebuttal", "Analyze review findings, draft author-side responses, and make requested evidence-backed revisions."],
  ["lessons", "Read advisory Lessons or maintain researcher-owned project Lessons when explicitly asked."],
];

export const DOVE_COMMAND_SKILL_INVENTORY_TEXT = DOVE_RESEARCH_SKILL_INVENTORY_TEXT;

export const COMMAND_SURFACES = SURFACES.map(([slug, summary]) => ({
  id: `dove.${slug}`,
  title: `Dove ${slug}`,
  summary,
  requiredTools: [],
  contract: contract(slug),
  examples: [`/dove:${slug}`],
  guidance: []
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
const RETIRED = ["workspace", "mission", "note", "experience", "auto"];
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
