import {
  DOVE_RESEARCH_ACTUAL_MATERIAL_FACT_BOUNDARY,
  DOVE_RESEARCH_ADVANCE,
  DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY,
  DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY,
  DOVE_RESEARCH_FRAME,
  DOVE_RESEARCH_MAINTENANCE_TRIGGER,
  DOVE_RESEARCH_MANUSCRIPT_REVIEW_BOUNDARY,
  DOVE_RESEARCH_REVIEW_CONDITIONAL_DELIVERY,
  DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC,
  DOVE_RESEARCH_REVIEW_DUAL_COMPLETION,
  DOVE_RESEARCH_REVIEW_ISOLATED_PERSISTENT,
  DOVE_RESEARCH_REVIEW_NEGATIVE_CONTINUITY,
  DOVE_RESEARCH_REVIEW_NO_INDEPENDENT_STATUS_CLAIM,
  DOVE_RESEARCH_REVIEW_RETURN_PROVENANCE,
  DOVE_RESEARCH_REVIEW_VERSION_CURRENCY,
  DOVE_RESEARCH_DEFAULT_AUTONOMY,
  DOVE_RESEARCH_CLARIFICATION,
  DOVE_RESEARCH_SKILL_INVENTORY_TEXT
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
const RESEARCH_MAINTENANCE_TRIGGER = DOVE_RESEARCH_MAINTENANCE_TRIGGER;

const commonClarification = [DOVE_RESEARCH_CLARIFICATION];

const DEFAULT_HOST_GUIDANCE = Object.freeze({
  common: Object.freeze([
    "Use only tools and materials that the current host exposes and current user/project permissions permit. If something needed is unavailable, name it and use any other available material or action that can still advance the request."
  ]),
  claude: Object.freeze([
    "Use Claude Code waiting or background affordances only for real long-running host actions, then return to Dove's mainline judgment when results arrive."
  ]),
  dsh: Object.freeze([
    "DSH adapters are project-local filesystem Skills; use only affordances that the current DSH run actually exposes."
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
const LESSONS_VALUE_STANDARD = "could inspire current or subsequent work, improve judgment, expand the candidate space, or prevent repeated mistakes";
const relevantLessons = action(
  "lesson-reading",
  `When existing Lessons ${LESSONS_VALUE_STANDARD}, read ".dove/research/lessons/LESSONS.md" if it exists, then the directly relevant or plausibly useful linked Lessons. Read ".dove/research/RESEARCH.md" first only when project context is still needed and it has not already been read in the active context. Reuse Lessons already read in the active context instead of rereading them mechanically. If Lessons materials are absent, work without them. Treat Lessons as fallible guidance, never as evidence.`,
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
    `When existing Dove research context would materially help ${purpose}, read \`.dove/research/RESEARCH.md\`, then \`${areaPath(area)}\`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Do not recursively scan the research tree. If a needed entry or link is absent, say so naturally.`
  );
}

function maintainArea(area, instruction) {
  return updateResearchDocuments(
    `${instruction} Use ordinary Markdown links and readable project-relative artifact paths only when useful for recovery; do not add databases, generated IDs, frontmatter, backlink audits, or consistency matrices. Update only the narrowest relevant research document. Update \`${areaPath(area)}\` only when its own links or synthesis materially change. Update \`.dove/research/RESEARCH.md\` only for a project-level mainline, conclusion, navigation, or priority change.`
  );
}

function sectionItems(sections, field) {
  return sections.flatMap((section) => Array.isArray(section[field]) ? section[field] : []);
}

const SHARED_RESEARCH_JUDGMENT_TITLE = "Return to Dove's research judgment";
const SHARED_RESEARCH_JUDGMENT_RESPONSIBILITIES = Object.freeze([
  "Return with what was inspected, what changed, what remains unresolved, and the next useful action."
]);
const SHARED_RESEARCH_JUDGMENT_BOUNDARIES = Object.freeze([]);
const REVIEW_HANDOFF_LISTED_MATERIALS_BOUNDARY = "For each `dove-review` round, provide only the frozen near-submission materials listed for that round: normally the complete paper, actual submission appendices or supplements, authoritative LaTeX source and compiled output, and other files that will accompany the submission. Code, raw experiment outputs, working figure materials, internal research notes, private author conversations, earlier reviews, and earlier handoffs remain outside the reviewer context unless the current list explicitly includes them.";

function sharedResearchJudgmentSection() {
  return {
    title: SHARED_RESEARCH_JUDGMENT_TITLE,
    responsibilities: [...SHARED_RESEARCH_JUDGMENT_RESPONSIBILITIES]
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
    boundaries: semanticSections ? options.boundaries ?? [] : [...SHARED_RESEARCH_JUDGMENT_BOUNDARIES, ...(options.boundaries ?? [])],
    nonGoals: semanticSections ? sectionItems(semanticSections, "nonGoals") : options.nonGoals ?? [],
    clarification: options.clarification ?? commonClarification,
    hostGuidance: options.hostGuidance ?? hostGuidance()
  };
  if (semanticSections) contract.semanticSections = semanticSections;
  return contract;
}

function contract(slug) {
  if (slug === "research") return capabilityContract({
    purpose: "Advance a confirmed research goal through the best feasible sequence of investigation, experiment, analysis, expression, and follow-through.",
    when: "Use for a clear research goal or project request. Dove continues across substantive rounds by default.",
    responsibilities: [
      DOVE_RESEARCH_DEFAULT_AUTONOMY,
      "When framing is open, expose the real phenomenon, assumptions, intended claim, evaluation target, and result that would change the next action.",
      "Compare serious routes by mechanism, assumptions, predictions, failure conditions, and inspected evidence; replenish ideas from contradictions, adjacent mechanisms, source gaps, and negative or near-miss results.",
      "Use small diagnostics, source checks, experiments, or artifact inspections when they can distinguish routes before larger work."
    ],
    actions: [
      readArea("missions", "the research goal"),
      relevantLessons,
      action("project-exploration", `Inspect the project materials and external context needed to understand the question. ${RESEARCH_FRAME}`, { readOnly: true }),
      action("research-progression", `Follow the confirmed or provisional mainline. Choose the action most likely to change the judgment, perform it with permitted host tools, absorb the result, and continue while it matters. ${RESEARCH_ADVANCE}`),
      maintainArea("missions", "When the maintenance trigger is met, update or create a naturally named Mission document for the substantive work, evidence, decisions, failures, and continuation context.")
    ],
    boundaries: [
      "Research may read, write, edit, run, or inspect ordinary project artifacts when the user's goal authorizes it and the mainline action needs it.",
      `Maintain Dove research Markdown only when ${RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not expose Auto as a Skill or user coordination requirement.",
      "Do not stop after one search, experiment, review, edit, check, or report while an effective in-scope mainline action remains.",
      "Do not create a Mission document merely to show that research ran."
    ],
    hostGuidance: hostGuidance({
      common: ["Use host waiting or interruption support only for real waits or long-running work, then return to Dove's mainline judgment."],
      claude: ["Use Claude Code background, Monitor, Cron, loop, tmux, or equivalent only for real long-running host actions, then reassess terminal outcomes."],
      dsh: ["Use only DSH-exposed filesystem and tool affordances; do not claim background or isolated-review capabilities DSH does not provide."]
    })
  });
  if (slug === "status") return capabilityContract({
    purpose: "Report where the research stands from the overview, relevant summaries, and directly needed linked context.",
    when: "Use when the user asks where the research stands, what is active, or what should be considered next.",
    responsibilities: [
      "Read only enough context to answer the status question.",
      "Report current mainline, substantive progress, active problems, decisions, and next priorities as ordinary document facts.",
      "Treat missing overviews, summaries, or links as ordinary document facts."
    ],
    actions: [
      readResearchDocuments("Read `.dove/research/RESEARCH.md` when it exists, then only the summaries and linked details needed for the question. Report the current mainline, substantive progress, active problems, decisions, and next priorities. If an overview, summary, or link is absent, say so naturally and do not modify files."),
      relevantLessons
    ],
    boundaries: [
      "For Status, only inspect and report."
    ],
    nonGoals: [
      "Do not use Status as a sync, Doctor, migration, or research-document maintenance command.",
      "Do not treat installed-file health, checks, or Markdown navigation as scientific progress."
    ],
    clarification: []
  });
  if (slug === "source") return capabilityContract({
    purpose: "Find, retrieve when possible, read, verify, and document sources that can change the research judgment.",
    when: "Use for source discovery, reading, comparison, verification, source-backed positioning, or route changes that depend on external theory or related work.",
    responsibilities: [
      "Start from the user's source question and current project need, not a fixed tool order or paper count.",
      "Separate citation identity from claim support, and distinguish material merely found from material retrieved, inspected, and used.",
      "Extract consensus, contradictions, assumptions, missing controls, transferable mechanisms, and research opportunities from inspected material.",
      "For explicit systematic review, meta-analysis, evidence grading, or auditable synthesis, use a suitable structured question, search scope, eligibility criteria, PRISMA-style tracking, risk-of-bias and evidence-certainty judgments when applicable, and pool effects only when studies and data are comparable."
    ],
    actions: [
      readArea("sources", "the source question"),
      relevantLessons,
      action("source-research", `Discover, retrieve when available, read, and verify external material with permitted host tools. ${DOVE_RESEARCH_ACTUAL_MATERIAL_FACT_BOUNDARY} For citation checks, verify identity and metadata first, then whether inspected content supports the specific claim and to what strength. For explicit systematic work, use the structured method stated above; ordinary paper finding, related-work scans, and single fact checks stay proportional. If needed material is unavailable, say what is missing and continue with any other material that can still inform the question.`),
      maintainArea("sources", "When a used source deserves durable context, create or update a naturally named source note with the citation or URL, what was inspected and learned, and, when useful for recovery, ordinary links to the Claim, Experiment, Figure artifact, or manuscript location that the inspected source actually supports or challenges.")
    ],
    boundaries: [
      "Save retrieved source material or source notes only when useful and permitted.",
      `Maintain Dove research Markdown only when ${RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not treat search snippets, titles, abstracts, or missing results as papers read.",
      "Do not create source databases, trust scores, or research hashes.",
      "Do not substitute CLI, shell, curl, or ad hoc fetch scripts when web or MCP retrieval is unavailable."
    ],
    hostGuidance: hostGuidance({
      claude: ["In initialized Claude projects, use WebSearch for discovery, dove-paper-search for academic paper retrieval/full text when exposed, and hosted exa for ordinary webpages and known URLs when exposed; if a material class is missing or not permitted, say so and use other available evidence rather than shell fetching."],
      dsh: ["DSH receives filesystem Skills only. Use only DSH-exposed search, reading, file, and project tools; if a material class is missing, say so and proceed with available local or user-provided material, theory, experiment, or analysis."]
    })
  });
  if (slug === "experiment") return capabilityContract({
    purpose: "Design, execute, inspect, interpret, or record experiments and diagnostics that can change a research decision.",
    when: "Use for experiment design, execution, analysis of existing results, retrospective recording, or when empirical work is the material way to resolve a contribution or evidence deficiency.",
    responsibilities: [
      "Follow the actual request: design-only, execution, existing-result analysis, and retrospective recording are different tasks.",
      "Make experiments claim-driven: name the problem, key uncertainty, strongest alternative explanation, minimum sufficient evidence, and how positive, negative, or ambiguous outcomes would change the judgment.",
      "If the central basis is missing, inspect actual project material, relevant sources, or a smallest low-risk diagnostic before designing a substitute experiment.",
      "Before using `dove run start|status|resume|finalize|compare` for local execution receipts, state what judgment the run can change, what metric or observation will decide it, what remains outside the run receipt, and that `.dove/runs/<id>/run.jsonl` is an execution receipt while stdout/stderr paths are actual materials to inspect rather than a replacement for scientific explanation.",
      "Treat small empirical diagnostics as Experiment work, keep conclusions within tested data, scale, settings, and implementation, and check anomalous results before using them as evidence."
    ],
    actions: [
      readArea("experiments", "the experiment"),
      relevantLessons,
      action("experiment-design", "Design the experiment around the real problem, key uncertainty, route decision, primary prediction, strongest alternative, minimum sufficient evidence, and how different outcomes would change the judgment. For design-only work, stop with an executable plan. For retrospective recording, label the record retrospective."),
      action("experiment-execution", `Execute only when requested and permitted, or inspect existing results when analysis is requested. For Dove-managed local executions, use the real \`.dove/runs/<id>/run.jsonl\` receipt and its stdout/stderr paths as inspected execution materials rather than invented run summaries; the receipt does not replace Experiment Markdown explanation. State methods, configuration, data, metrics, run counts, and result numbers from actual code, logs, outputs, data files, user material, or run receipts. For negative, near-miss, anomalous, unusually strong, or hard-to-reproduce results, compare expected and actual behavior and check implementation, data, configuration, baselines, randomness, metrics, and analysis before using them as evidence. When recording is needed, append the actual procedure, result, interpretation-changing deviation, evidence scope, and route update to the same Experiment document used for the plan; ordinary scientific explanation still belongs in Experiment Markdown, not only in the run receipt. Separate what was observed, what it means, why it matters, and what happens next.`),
      maintainArea("experiments", "When the maintenance trigger is met, record the experiment, diagnostic, result, failure, evidence scope, route decision, and useful project-relative logs, data, output, `.dove/runs/<id>/run.jsonl`, figure, or code paths in the relevant Experiment document, linking affected Claim, Source, or Figure context only when useful for recovery.")
    ],
    boundaries: [
      "Design-only work stops before central execution; high-cost, destructive, outward-facing, or resource-heavy experiments still require explicit user direction and permission.",
      `Maintain Dove research Markdown only when ${RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not synthesize a prospective plan after execution or disguise retrospective notes as prior design.",
      "Do not run a convenient proxy experiment that cannot affect the research decision.",
      "Do not treat a diagnostic as evidence beyond the conditions actually tested."
    ]
  });
  if (slug === "draft") return capabilityContract({
    purpose: "Draft, assess, or revise project text and artifacts from the available evidence.",
    when: "Use when the user requests drafting, assessment, or revision, or when expression, argument, or an authoritative delivery artifact is the limiting deficiency.",
    responsibilities: [
      "Read the target artifact and the evidence needed for its material claims; leave unchecked methods, results, citations, samples, data, and field facts unknown.",
      "Preserve certainty, causality, scope, generality, quantitative qualifiers, and novelty unless evidence or the user changes them; say what changed before changing the text.",
      "Build or repair the paper spine: problem → gap → insight/mechanism → method → evidence → claim → limitation → reader takeaway.",
      "Use reliable author samples only for stable style cues such as rhythm, paragraphing, hedging, transitions, reporting verbs, and citation integration; keep accuracy and venue norms above voice imitation.",
      "If the intended contribution still needs method, source, experiment, figure, artifact propagation, or argument work, do that before merely weakening prose."
    ],
    actions: [
      readArea("claims", "the draft and its material claims"),
      relevantLessons,
      action("artifact-editing", "Read the target and relevant material, then draft, assess, create, or revise the ordinary artifact when the deliverable requires it. For manuscript work, edit the authoritative source and propagate through the real build or export path before claiming the artifact is current."),
      action("artifact-validation", "Run the checks needed for the requested artifact, fix in-scope issues, and report remaining material issues, scope limits, or user choices."),
      maintainArea("claims", "Create or revise a naturally named Claim document only when an important research claim needs durable treatment; when useful for recovery, link supporting or challenging Source, Experiment, Figure, and manuscript locations without copying evidence into a claim store.")
    ],
    boundaries: [
      "Draft may create or edit ordinary project artifacts requested by the user or needed for the bounded deliverable; destructive, outward-facing, or submission actions still need explicit authorization.",
      `Maintain Dove research Markdown only when ${RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not let polished wording, export, or local checks replace missing evidence for a claim.",
      "Do not create Claim records merely because drafting occurred."
    ]
  });
  if (slug === "figure") return capabilityContract({
    purpose: "Plan, create, revise, inspect, and caption publication figures from actual materials.",
    when: "Use when the user requests a figure brief, diagram, plot, caption, visual revision, or figure assessment, or when a figure is the material evidence or communication bottleneck.",
    responsibilities: [
      DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY,
      DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY,
      "Make the figure serve a clear evidence or mechanism job: comparison, process, failure mode, causal story, or contribution.",
      "Start from a compact Figure brief and visual plan: target claim, audience, evidence or mechanism job, real materials, panel/story structure, route choice, manuscript placement, final dimensions, caption role, and editable-source route."
    ],
    actions: [
      readResearchDocuments("When existing Dove research context would materially help the figure, read the overview and directly relevant Mission, Experiment, Claim, manuscript, or prior figure context; otherwise use the user's materials and data."),
      relevantLessons,
      action("figure-planning", "Create a compact Figure brief and visual plan from inspected context: target claim, audience, evidence or mechanism job, real data or source visuals, chosen route, panel/story layout, manuscript location, final dimensions, caption and nearby-text role, and expected editable source. For planning-only or assessment-only requests, report the plan or findings without creating files.", { readOnly: true }),
      action("figure-creation", "For creation, choose the route that fits the task: plot quantitative figures from real data with reproducible code; draw editable structure or mechanism diagrams in route-native SVG/vector/source form; use exposed host image generation or editing only when an illustrative image is the right route and permitted; or combine raster panels with SVG/vector labels, layout, and annotations. Render the actual figure, keep scratch renders in a repository-local workspace such as `.claude/tmp/` unless directed otherwise, and do not invent data, results, or method details."),
      action("figure-inspection", "Open or view the actual rendered figure, not just filenames or thumbnails, at realistic final dimensions and in manuscript context when available. Check correctness, beauty, legibility, text, labels, units, legends, panels, visual encoding, scientific relationships, source data or source visuals, rendering logic, caption, nearby text, and layout fit.", { readOnly: true }),
      action("figure-revision", "For revision, make targeted changes to the editable source, plotting code, SVG/vector structure, raster edits, labels, layout, annotations, caption, nearby manuscript text, or export settings; rerender and inspect the updated figure before delivery."),
      action("figure-delivery", "Deliver the final figure file together with the route-native editable source, such as plotting code and data reference, SVG/vector source, layered or editable image source, or the mixed raster plus SVG/vector composition that allows later modification."),
      updateResearchDocuments("When useful for recovery, use ordinary Markdown links and readable project-relative artifact paths to link the rendered figure, route-native editable source, plot code and data, or source visual from the relevant Mission, Experiment, or Claim; do not add databases, generated IDs, frontmatter, backlink audits, or consistency matrices. Update summaries only for material synthesis or priority changes.")
    ],
    boundaries: [
      "Figure may create, edit, render, open, inspect, caption, export, or update ordinary project visuals and nearby manuscript text when requested or material to the deliverable; it must not invent data, results, or method details.",
      "Pure context reading, planning, and inspection are read-only; creation, revision, caption insertion, export, delivery, and research-document maintenance are write-capable only within the authorized task scope.",
      `Maintain Dove research Markdown only when ${RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not treat image counts, embedding, resolution, contact sheets, opening an image, beauty, or unchanged re-export as proof that the figure communicates the research.",
      "Do not use host image generation or editing when real data plotting, source inspection, editable diagrams, or simple vector/raster revision is the correct action."
    ]
  });
  if (slug === "review") {
    const reviewContextReadAction = readArea("reviews", "the review work");
    const reviewGroundingAction = action("review-grounding", "For author-side self-check, inspect the current full paper and the venue or literature context that can change the judgment. Distinguish material merely found from material retrieved, inspected, and used. Import or context inspection does not trigger venue or paper search by itself.", { readOnly: true });
    const reviewerPerspectiveAction = action("reviewer-perspective-work", "Critique the current paper from the established grounding through the stated review views. For local review, stay inside the requested scope. Return concrete findings with evidence, consequence, useful response, and delivery readiness kept separate.", { readOnly: true });
    const deliveryReviewAction = action("delivery-review", "When delivery review is requested or genuinely limiting, inspect official venue requirements, current build output, required materials, formatting, anonymity, packaging, and access limits. Report delivery readiness separately from scientific acceptability.", { readOnly: true });
    const reviewHandoffAction = action("dove-review-handoff", "Start `dove-review` only for a highly complete near-submission paper. Preserve the purpose, target venue, complete frozen material list, reviewer prompt, known host limits, and real runtime paths in the Review context and `.dove/reviews/<id>/review.json`. Give the reviewer only those listed materials. Use the real runtime when the host provides a genuinely isolated, persistent, recoverable reviewer context; resume or rerun later whole-paper rounds through the recorded reviewer session for the same review id. Record only the actual session id and report path returned by the runtime. If the runtime is unavailable, say so and continue feasible author-side work without counting it as independent review.");
    const reviewMaintenanceAction = maintainArea("reviews", "When the user supplies a `dove-review` return, user-pasted review opinion, clarification, rebuttal exchange, or asks to preserve self-check or handoff context, append the actual text faithfully to the corresponding Review document and associate it with the same review id and round when known. When useful for recovery, link the real `.dove/reviews/<id>/rounds/<round>/report.md` return, frozen materials, and affected Claim, Experiment, Figure, Source, or manuscript locations. Do not revise author artifacts, start a new review, rewrite the return, or add author interpretation unless asked.");
    const semanticSections = [
      {
        title: "Author-side scientific self-check",
        purpose: DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC,
        responsibilities: [
          DOVE_RESEARCH_MANUSCRIPT_REVIEW_BOUNDARY,
          "For the complete paper, ask four questions: does the method answer the research question; are the mechanisms, terms, comparisons, literature, counterexamples, and limits correct for the field; do the contribution, evidence, scope, and expression fit the target venue and its readers; and what is the strongest informed objection, with what would answer it. Also check citation identity, claim support, changes in claim strength, unsupported facts, and anomalous results when relevant."
        ],
        actions: [
          reviewGroundingAction,
          reviewerPerspectiveAction
        ],
        boundaries: [
          "Author-side self-check critiques and advises; later changes remain Dove author-side work."
        ]
      },
      {
        title: "Delivery readiness",
        purpose: DOVE_RESEARCH_REVIEW_CONDITIONAL_DELIVERY,
        actions: [
          deliveryReviewAction
        ],
        boundaries: [
          "Delivery readiness is separate from scientific acceptability."
        ]
      },
      {
        title: "Independent `dove-review`",
        purpose: DOVE_RESEARCH_REVIEW_DUAL_COMPLETION,
        responsibilities: [
          DOVE_RESEARCH_REVIEW_ISOLATED_PERSISTENT,
          DOVE_RESEARCH_REVIEW_NEGATIVE_CONTINUITY,
          DOVE_RESEARCH_REVIEW_VERSION_CURRENCY,
          DOVE_RESEARCH_REVIEW_RETURN_PROVENANCE
        ],
        actions: [
          reviewHandoffAction
        ],
        boundaries: [
          REVIEW_HANDOFF_LISTED_MATERIALS_BOUNDARY,
          DOVE_RESEARCH_REVIEW_NO_INDEPENDENT_STATUS_CLAIM
        ]
      },
      {
        title: "Returned review or existing context",
        purpose: "Import a returned review, preserve a user-pasted opinion, or inspect existing Review context without creating a new exchange.",
        responsibilities: [
          "For import, preserve the actual return faithfully with known context, round, venue, and material scope; for inspection, read only the Review context needed for the question."
        ],
        actions: [
          reviewMaintenanceAction,
          reviewContextReadAction
        ],
        boundaries: [
          "Import and inspection do not automatically begin author response, revision, venue search, paper search, or a new handoff."
        ]
      }
    ];
    return capabilityContract({
      purpose: "Use Review for author-side scientific self-check, delivery readiness, independent `dove-review` handoff, returned-review import, or existing context inspection.",
      when: "Use when review can improve the paper, delivery facts matter, a near-submission paper is ready for `dove-review`, a returned review should be preserved, or existing Review context should be inspected.",
      responsibilities: sectionItems(semanticSections, "responsibilities"),
      actions: sectionItems(semanticSections, "actions"),
      boundaries: [
        "Review findings inform Dove's author-side judgment; Dove verifies material findings and chooses the next useful Source, Experiment, Draft, Figure, Rebuttal, delivery, or clarification work.",
        "Independent `dove-review` requires a real isolated, persistent, recoverable host context with a frozen near-submission material list."
      ],
      semanticSections,
      hostGuidance: hostGuidance({
        claude: ["For `dove-review`, call the real CLI surface: `dove review handoff --project <project> --venue <venue> --material <path>...`, then `dove review resume --project <project> --id <id>` or `dove review rerun --project <project> --id <id> --material <path>...` for the same review id and reviewer session. Import user-provided returns with `dove review import --project <project> --id <id> --file <report.md>`. The runtime copies only listed materials into its isolated workspace, gives Claude Code only Read, and records the actual `session_id`."],
        dsh: ["DSH has no equivalent recoverable isolated Claude Code context in this package. Use author-side Review or preserve a user-provided returned review; do not present DSH as running `dove review handoff`, `resume`, or `rerun` unless a future host actually exposes equivalent isolation."]
      })
    });
  }
  if (slug === "rebuttal") return capabilityContract({
    purpose: "Analyze review findings, draft author-side responses, and make requested evidence-backed revisions.",
    when: "Use when the user requests rebuttal, response, revision, or follow-up work from review findings.",
    responsibilities: [
      "Analyze each material finding against actual evidence, decide whether to accept, rebut, qualify, or investigate it, and revise artifacts when that is the useful response.",
      "Name the deficiency, needed evidence, research action, and manuscript or rebuttal response for each material finding.",
      "Compare original claim, reviewer interpretation, planned response, and revised claim so certainty, causality, scope, quantitative qualifiers, novelty, and contribution do not change silently.",
      "Use Source for new citations and Experiment for new results; leave unchecked source content, project facts, methods, results, and field facts unconfirmed.",
      "When fixable deficiencies are in scope, improve evidence, analysis, manuscript text, figures, captions, tables, supplements, highlights, or venue-facing files—not just response tone."
    ],
    actions: [
      readArea("reviews", "the relevant returned review"),
      relevantLessons,
      action("rebuttal-and-revision", "Read the Review document, same review id and round when available, and actual artifacts. For each material finding, identify the source, experiment, method, analysis, expression, figure, or venue-fit problem; then draft the response and make requested revisions that resolve, reduce, or honestly bound it while preserving accurate claim strength and professional author voice. Ordinary author-side revisions do not trigger a full re-review unless the user asks or the submission-readiness decision needs a fresh `dove review rerun`."),
      action("artifact-validation", "Check that each response and requested revision addresses a real finding; fix in-scope issues or report remaining material limits and user choices."),
      maintainArea("reviews", "When worth preserving, append the author response, requested revisions, resulting decisions, unresolved issues, and follow-up to the same Review document or directly affected research document, and, when useful for recovery, link the originating Review return plus any newly used Source, Experiment, Figure, or ordinary artifact paths.")
    ],
    boundaries: [
      "Rebuttal may modify ordinary project artifacts and research documents when requested or when revisions are the in-scope response; outward-facing submission or destructive action still requires explicit authorization.",
      `Maintain Dove research Markdown only when ${RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not let reviewer findings replace Dove's author-side judgment.",
      "Preserve only actual reviewer returns; do not overwrite original returns with author summaries."
    ]
  });
  return capabilityContract({
    purpose: "Read or maintain researcher-owned Lessons that can improve current or subsequent work.",
    when: `Use when existing or newly learned guidance ${LESSONS_VALUE_STANDARD}, including when the user asks to inspect, remember, reflect on, or preserve Lessons.`,
    responsibilities: [
      "Treat Lessons as broad, fallible guidance for research methods, successful and failed routes, cross-domain intuitions, experiment and source practice, figures, writing, review, collaboration, and other reusable work—not as evidence or a completion certificate.",
      `For reading, use the Lessons summary and linked themes whenever they ${LESSONS_VALUE_STANDARD}; include directly relevant and plausibly useful material, while reusing active-context Lessons instead of rereading them mechanically.`,
      `For maintenance, preserve a Lesson whenever the experience ${LESSONS_VALUE_STANDARD}. Write only the reusable insight and useful conditions, not a routine activity log.`
    ],
    actions: [
      readResearchDocuments(`Read ".dove/research/lessons/LESSONS.md" if it exists, then linked Lessons that are directly relevant or plausibly useful because they ${LESSONS_VALUE_STANDARD}. Read ".dove/research/RESEARCH.md" first only when project context is still needed and it has not already been read in the active context. Reuse Lessons already read in the active context instead of rereading them mechanically. If no Lessons summary or useful linked Lesson exists, report that naturally and continue from the available context. Do not create or modify files during reading and do not treat Lessons as evidence.`),
      updateResearchDocuments(`When an experience ${LESSONS_VALUE_STANDARD}, preserve its reusable insight and relevant conditions in the narrowest suitable researcher-owned Lessons document, or create a naturally named Markdown file when a new theme is useful. Update "lessons/LESSONS.md" with a natural link when needed. Avoid recording routine progress, transient status, or observations with no plausible future value. Source explanation is optional. Do not create lesson IDs, frontmatter, an application ledger, or treat Lessons as evidence.`, {
        persistWhen: `the experience ${LESSONS_VALUE_STANDARD}`,
        persistencePolicy: "standard-research"
      })
    ],
    boundaries: [
      "Lessons reading only inspects existing material. Lessons maintenance is limited to researcher-owned Lessons files plus natural links from `lessons/LESSONS.md`, and records reusable guidance rather than routine activity.",
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
  ["experiment", "Design, analyze, record, or explicitly execute experiments, diagnostics, and local evidence work that advance a research decision."],
  ["draft", "Draft, assess, or revise ordinary project text and artifacts from the available evidence."],
  ["figure", "Plan, create, revise, inspect, caption, and deliver editable publication figures from actual materials."],
  ["review", "Use author-side self-check, delivery review, `dove-review`, returned-review import, or context inspection."],
  ["rebuttal", "Analyze review findings, draft author-side responses, and make requested evidence-backed revisions."],
  ["lessons", "Read or maintain researcher-owned Lessons that can inspire, improve, broaden, or protect future work."],
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
