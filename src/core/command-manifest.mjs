import {
  DOVE_RESEARCH_ACTUAL_MATERIAL_FACT_BOUNDARY,
  DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY,
  DOVE_RESEARCH_REVIEW_FROZEN_HANDOFF,
  DOVE_RESEARCH_ADVANCE,
  DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY,
  DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY,
  DOVE_RESEARCH_FRAME,
  DOVE_RESEARCH_MAINTENANCE_TRIGGER,
  DOVE_RESEARCH_REVIEW_CONDITIONAL_DELIVERY,
  DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC,
  DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS,
  DOVE_RESEARCH_REVIEW_DUAL_COMPLETION,
  DOVE_RESEARCH_REVIEW_ISOLATED_PERSISTENT,
  DOVE_RESEARCH_REVIEW_NEGATIVE_CONTINUITY,
  DOVE_RESEARCH_REVIEW_NO_INDEPENDENT_STATUS_CLAIM,
  DOVE_RESEARCH_REVIEW_ANTI_GAMING,
  DOVE_RESEARCH_REVIEW_RETURN_PROVENANCE,
  DOVE_RESEARCH_REVIEW_VERSION_CURRENCY,
  DOVE_RESEARCH_DEFAULT_AUTONOMY,
  DOVE_RESEARCH_CLARIFICATION,
  DOVE_RESEARCH_SKILL_INVENTORY_TEXT
} from "./dove-research-contract.mjs";
import { EXA_WEB_SUPPORT_SKILL_PATH } from "./web-access-integration.mjs";

export const PACKAGE_DOCUMENTATION_PATHS = ["README.md", "docs/README.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md", "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"];
export const PACKAGE_LEGAL_PATHS = ["LICENSE"];
export const PACKAGE_RUNTIME_PATHS = ["dist/index.mjs", "bin/dove-package.mjs"];
export const RETIRED_PACKAGE_RUNTIME_PATHS = [
  "mcp/dove-state-server-package.mjs",
  "scripts/doctor-mcp-probe-package.mjs"
];
export const DEFAULT_HOST_ADAPTERS = ["claude", "dsh"];
export const PROJECT_HOST_IDS = ["claude", "dsh"];
export const HOST_IDS = [...PROJECT_HOST_IDS];
export const DOVE_CLAUDE_AMBIENT_PROJECT_PATHS = Object.freeze([
  ".claude/rules/dove.md",
  ".claude/skills/dove-paper-search/SKILL.md",
  ".claude/skills/dove-web-reader/SKILL.md",
  ".claude/settings.json"
]);
export const PACKAGE_RESOURCE_ROOT = "package-resources/hosts";
export const PACKAGE_GENERATED_SUPPORT_PATHS = Object.freeze([
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/agents/dove.md`,
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/rules/dove.md`,
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
    "In DSH, work from project-local files and whatever tools the current run actually exposes."
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
    `When existing Dove research context would materially help ${purpose}, read \`.dove/research/RESEARCH.md\`, then \`${areaPath(area)}\`, then only directly relevant linked details. Otherwise work directly from the user's request and specified project materials. Avoid broad research-tree scans. If a needed entry or link is absent, say so naturally.`
  );
}

function maintainArea(area, instruction) {
  return updateResearchDocuments(
    `${instruction} Use ordinary Markdown links and readable project-relative artifact paths only when useful for recovery, and keep the note as human prose rather than a structured store. Update only the narrowest relevant research document. Update \`${areaPath(area)}\` only when its own links or synthesis materially change. Update \`.dove/research/RESEARCH.md\` only for a project-level mainline, conclusion, navigation, or priority change.`
  );
}

function sectionItems(sections, field) {
  return sections.flatMap((section) => Array.isArray(section[field]) ? section[field] : []);
}

const SHARED_RESEARCH_JUDGMENT_TITLE = "Return with";
const SHARED_RESEARCH_JUDGMENT_RESPONSIBILITIES = Object.freeze([
  "Inspected evidence, material change, and unresolved limits; include the next useful action only when it helps the current request."
]);

function sharedResearchJudgmentSection() {
  return {
    title: SHARED_RESEARCH_JUDGMENT_TITLE,
    responsibilities: [...SHARED_RESEARCH_JUDGMENT_RESPONSIBILITIES]
  };
}

function capabilityContract(options) {
  const semanticSections = Array.isArray(options.semanticSections) && options.semanticSections.length > 0
    ? [...options.semanticSections, sharedResearchJudgmentSection()]
    : null;
  const contract = {
    purpose: options.purpose,
    when: options.when,
    responsibilities: semanticSections ? sectionItems(semanticSections, "responsibilities") : [...(options.responsibilities ?? []), ...SHARED_RESEARCH_JUDGMENT_RESPONSIBILITIES],
    returnWith: [...SHARED_RESEARCH_JUDGMENT_RESPONSIBILITIES],
    actions: semanticSections ? sectionItems(semanticSections, "actions") : options.actions ?? [],
    boundaries: options.boundaries ?? [],
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
      "When framing is open, expose the real phenomenon, intended claim, evaluation target, and result that would change the next action; replenish serious routes from contradictions, adjacent mechanisms, and negative or near-miss results.",
      "After each material result, rejudge the proposition that motivated that round before choosing the next one: distinguish implementation or comparison failure, a bounded local-mechanism result, and support, refutation, or a boundary for the core proposition. Preserve still-valid evidence and assets, but keep a surviving component or local metric gain provisional until its scientific task identity, independent quality, joint conditions, and serious alternatives justify promotion. Normal corrections that preserve the real problem, output, contribution, and completion meaning do not require renewed mainline approval; a materially different confirmed mainline, intended contribution, or completion meaning does.",
      "Use the shared substantive quality criteria for relevant problems, candidates, claims, and key components, with evidence confidence and current-purpose satisfaction stated separately. Evaluate how novel the remaining contribution actually is, not how much literature was checked; a well-investigated incremental idea remains incremental. At material route and investment decisions, compare joint conditions and overall tradeoffs, using a concise evaluation table when useful. Use novelty (N0–N4) and theory (T0–T4) labels only when user- or project-provided definitions are available to read and have actually been inspected; preserve their meanings, not a combined score or global admission threshold. N1 coverage is not an improvement over N0, and N4 search standing does not mean foundational innovation; do not convert these labels into the shared quality grades or require duplicate ratings."
    ],
    actions: [
      readArea("missions", "the research goal"),
      relevantLessons,
      action("project-exploration", `Inspect the project materials and external context needed to understand the question. ${RESEARCH_FRAME}`, { readOnly: true }),
      action("research-progression", `${RESEARCH_ADVANCE} Carry the entering proposition through each material result: state whether it remains unresolved, supported, refuted, or bounded and what dependent claims or investment change. If a surviving component now answers a materially different problem, keep the original conclusion visible, investigate it only within existing authorization while provisional, and obtain the user's decision before adopting it as a different confirmed mainline, contribution, or completion meaning. For a submission goal, use Review to establish the current whole-paper judgment before declaring completion.`),
      maintainArea("missions", "When the maintenance trigger is met, update or create a naturally named Mission document for the substantive work, evidence, decisions, failures, and continuation context. Preserve the problem, proposition, and task scope that motivated entry; append actual results, corrections, changed identity elements, whether a branch is provisional or an authorized mainline, and still-valid assets or counterevidence. Do not rewrite an earlier Mission as though it always pursued a later task, and do not require a new file or fixed task-identity template merely because a change occurred.")
    ],
    boundaries: [
      "Research may read, write, edit, run, or inspect ordinary project artifacts when the user's goal authorizes it and the mainline action needs it.",
      `Maintain Dove research Markdown only when ${RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not expose a separate autonomy Skill, mode, or user coordination requirement.",
      "Do not stop after one search, experiment, review, edit, check, or report while an effective in-scope mainline action remains.",
      "Do not create a Mission document merely to show that research ran."
    ],
    hostGuidance: hostGuidance({
      common: ["Use host waiting or interruption support only for real waits or long-running work, then reassess terminal outcomes."],
      dsh: ["Use only DSH-exposed project files and tools; if background work or isolated review is unavailable, say so and continue with feasible author-side work."]
    })
  });
  if (slug === "status") return capabilityContract({
    purpose: "Report where the research stands from the overview, relevant summaries, and directly needed linked context.",
    when: "Use when the user asks where the research stands, what is active, or what should be considered next.",
    responsibilities: [
      "Read only enough context to answer the status question.",
      "Report the confirmed mainline, any provisional candidate, visible scientific-task identity changes and authorization basis, the entering proposition's current disposition, substantive progress, active problems, and decisions. Use existing materials to judge relevant substantive quality, evidence confidence, and current-purpose satisfaction; otherwise leave the rating undetermined. Distinguish scientific progress from enabling engineering and delivery facts, explaining what understanding, capability, or decision actually changed. A concise evaluation table may expose tradeoffs and unknowns without treating completed checks as high quality. Mention next priorities when relevant to the question.",
      "Treat missing overviews, summaries, or links as ordinary document facts."
    ],
    actions: [
      readResearchDocuments("Read `.dove/research/RESEARCH.md` when it exists, then only the summaries and linked details needed for the question. Use the visible conversation and only necessary current project materials to distinguish live work from durable research notes; report conflicts or stale notes without silently reconciling them. Report a candidate as confirmed mainline only when the visible context or research materials contain that decision; do not infer promotion or task continuity from the latest code, Review, Run receipt, project name, or asset lineage alone. If an overview, summary, link, identity comparison, or authorization basis is absent, say so naturally and do not modify files or run validation to manufacture it."),
      relevantLessons
    ],
    boundaries: [
      "For Status, only inspect and report; do not start validation or maintain documents to fill a missing level or evidence gap."
    ],
    nonGoals: [
      "Do not use Status as a sync, Doctor, migration, or research-document maintenance command.",
      "Do not treat installed-file health, checks, run receipts, engineering receipts, or Markdown navigation as scientific progress."
    ],
    clarification: []
  });
  if (slug === "source") return capabilityContract({
    purpose: "Find, retrieve when possible, read, verify, and document sources that can change the research judgment.",
    when: "Use for source discovery, reading, comparison, verification, bounded bibliography DOI identity checks, source-backed positioning, or route changes that depend on external theory or related work.",
    responsibilities: [
      "Start from the user's source question and current project need, not a fixed tool order or paper count; stop searching when further retrieval would not change the decision or answer the bounded question.",
      "Distinguish ‘发现线索’ (found leads), ‘身份核实’ (verified citation identity), ‘相关全文检查’ (inspected relevant full text), and ‘具体主张核实’ (checked a specific claim). These are source-use facts, not novelty grades; judge novelty by the remaining substantive contribution, with search depth informing confidence. Retrieval alone is not inspection; completed claim verification can find support, contradiction, or insufficient coverage, not necessarily support. When a DOI matters and direct lookup is available, check it before fuzzy title matching; compare DOI, title, authors, year, and venue or version, then report verified, conflict, not-found, or unknown. For a bounded bibliography DOI identity check, verify only the requested entries and do not create a ledger.",
      "Extract consensus, contradictions, assumptions, missing controls, transferable mechanisms, and research opportunities from inspected material. Compare nearby work's problem, inputs/outputs, assumptions, mechanism, and claim at the same granularity; subtract covered contributions and reassess the remaining difference's independence and value. Unchecked full text does not establish absence of overlap.",
      "For explicit systematic review, meta-analysis, evidence grading, or auditable synthesis, use a suitable structured question, search scope, eligibility criteria, PRISMA-style tracking, risk-of-bias and evidence-certainty judgments when applicable, and pool effects only when studies and data are comparable."
    ],
    actions: [
      readArea("sources", "the source question"),
      relevantLessons,
      action("source-research", `Discover, retrieve when available, read, and verify external material with permitted host tools. ${DOVE_RESEARCH_ACTUAL_MATERIAL_FACT_BOUNDARY} For citation checks, verify identity and metadata first, using direct DOI lookup before fuzzy title search when available. A failed lookup is unknown, not permission to recreate retrieval through shell tools. Metadata identity is not full-text inspection or claim support; inspect actual content before using the source for a claim. Split compound claims into their material parts and report each as supported, contradicted, or uncovered by the inspected content, with the passage or evidence and its limits. Partial support is not support for the whole sentence; recommend only the supported wording without automatically editing the manuscript. For explicit systematic work, use the structured method stated above; ordinary paper finding, related-work scans, and single fact checks stay proportional. If needed material is unavailable, say what is missing and continue with any other material that can still inform the question.`),
      maintainArea("sources", "When a used source deserves durable context, create or update a naturally named source note with the citation or URL, what was inspected and learned, and, when useful for recovery, ordinary links to the Claim, Experiment, Figure artifact, or manuscript location that the inspected source actually supports or challenges.")
    ],
    boundaries: [
      "Save retrieved source material or source notes only when useful and permitted.",
      "Keep DOI identity checks transient by default; update ordinary Source notes or bibliography entries only when identity results materially affect research judgment, manuscript citations, or continuation context.",
      `Maintain Dove research Markdown only when ${RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not treat search snippets, titles, abstracts, verified metadata identity, or missing results as papers read.",
      "Do not create source databases, caches, trust scores, research hashes, DOI ledgers, or BibTeX parsers.",
      "Do not substitute CLI, shell, curl, ad hoc fetch scripts, or multi-step substitute chains when web or MCP retrieval is unavailable."
    ],
    hostGuidance: hostGuidance({
      claude: ["In initialized Claude projects, use WebSearch for discovery, dove-paper-search for DOI metadata lookup and academic paper retrieval/full text when exposed, and hosted exa for ordinary webpages and known URLs when exposed; if a material class is missing or not permitted, say so and use other available evidence rather than shell fetching."],
      dsh: ["In DSH, use exposed search, reading, file, and project tools; if a material class is missing, say so and proceed with available local or user-provided material, theory, experiment, or analysis."]
    })
  });
  if (slug === "experiment") return capabilityContract({
    purpose: "Design, execute, inspect, interpret, or record experiments and diagnostics that can change a research decision.",
    when: "Use for experiment design, execution, analysis of existing results, retrospective recording, or when empirical work is the material way to resolve a contribution or evidence deficiency.",
    responsibilities: [
      "Follow the actual request: design-only, execution, existing-result analysis, and retrospective recording are different tasks.",
      "Make experiments claim-driven: name the real problem, key uncertainty, primary prediction, strongest alternative explanation, minimum sufficient evidence, and how positive, negative, or ambiguous outcomes would change the judgment. Before expanding investment, apply the joint conditions for that purpose, checking relevant upper bounds, attainability, evaluation reliability, and minimum worthwhile benefit using existing material or authorized validation. No single successful check establishes that scaling will answer an important scientific uncertainty.",
      "Keep specified design and working execution chain as work facts, not quality grades. Judge evaluation validity and the evidence's ability to establish, refute, or bound the particular claim using the shared criteria. A valid negative result can complete an experiment and advance knowledge without supporting the proposed method; merely nonsignificant results do not establish no effect. Report what was learned and what decision it changes, not run completion as scientific success.",
      "Trace the evaluation chain from input through each method's actual output, the basis it is compared against, what the metric measures, and the final between-method comparison. Explicitly distinguish the real goal, actual output or estimand, baseline, reference or counterfactual, proxy, success condition, and the evidence connecting any proxy to the real goal. When a reference is used, establish its applicability to the target object and granularity; justify any proxy or method's own output used as an evaluation basis, not merely the file's existence. Correcting a metric, denominator, or baseline to measure the same target more faithfully is a normal in-task repair; changing the target output, proxy goal, comparison basis, or success meaning triggers scientific-task identity judgment rather than retroactively declaring success. More runs cannot repair a target or real-goal mismatch.",
      "Explain how failed, missing, invalid, or excluded outputs enter results and denominators, without silently retaining only the successful intersection or automatically assigning every failure zero. Where applicable, align the same evaluation units for paired comparisons, inspect differences and uncertainty, and account for sample dependence. Protect final-test independence when training, tuning, calibration, or method selection occurs.",
      "Judge ablations from actual code, configuration, and outputs: beyond the named component, did information access, preprocessing, training budget, numerical scale, edit magnitude, or postprocessing also change? Distinguish the full implementation winning, a component's gain under the given control, and support for a scientific mechanism. If controls cannot identify the core contribution, compare a suitable repair, evaluation redesign, an identifiable alternative mechanism or route, or stopping the branch; more runs do not repair identification. Keep the current conclusion within actual evidence while choosing the overall-best authorized action, rather than defaulting to minimal controls or claim narrowing.",
      "Use `dove run start|status|resume|finalize|compare` when local execution tracking helps; state the judgment and metric or observation it can inform and what remains outside the receipt. The `.dove/runs/` journal and stdout/stderr are execution materials, not scientific explanation or research progress by themselves."
    ],
    actions: [
      readArea("experiments", "the experiment"),
      relevantLessons,
      action("experiment-design", "For new design, establish the claim-driven comparison and evaluation chain above, preserving the original comparison and explaining any correction to its metric, denominator, baseline, reference, proxy, or success condition. If the central basis is missing, pause central design and inspect actual project material or relevant sources rather than inventing a substitute experiment or easier target. Check new data, methods, evaluation chains, or decision-relevant gaps using existing code, samples, and outputs where sufficient; run a smallest representative low-risk diagnostic only when necessary and authorized. Small samples check chain semantics and implementation, not population-level statistical sufficiency. For design-only work, trace materials read-only and deliver an executable plan with unverified parts, without running diagnostics or experiments. Analyze existing results directly; label retrospective recording retrospective rather than inventing prior design."),
      updateResearchDocuments("Only for newly authorized central execution that needs recording, select the relevant Experiment document or a naturally named new one and save the prospective plan there before execution begins: what it tests, the prediction and strongest alternative, the procedure, and how results will be judged. Keep this same document for the later actual results. Design-only work, existing-result analysis, retrospective recording, and exploratory diagnostics do not require a new document merely to proceed.", {
        persistWhen: `new central execution is requested and permitted, and ${RESEARCH_MAINTENANCE_TRIGGER}`
      }),
      action("experiment-execution", "Execute only when requested and permitted, or inspect existing results when analysis is requested. State methods, configuration, data, metrics, run counts, and result numbers from actual code, logs, outputs, data files, user material, or run receipts. Interpret results against the evaluation chain and actual control differences above, checking decision-relevant anomalies before treating them as evidence. For newly executed central work that needed recording, execute only after the prospective plan has been successfully saved, then append the actual procedure, result, interpretation-changing deviation, evidence scope, and route update to that same Experiment document. For existing-result analysis or retrospective work, record only when useful and do not imply a prior plan existed; run receipts do not replace this scientific explanation. Separate what was observed, what it means, and why it matters; explain follow-up only when useful."),
      maintainArea("experiments", "When the maintenance trigger is met, record the experiment, diagnostic, result, failure, evidence scope, route decision, and useful project-relative logs, data, output, the corresponding `.dove/runs/` run journal, figure, or code paths in the relevant Experiment document, linking affected Claim, Source, or Figure context only when useful for recovery.")
    ],
    boundaries: [
      "Design-only work does not authorize diagnostic or experiment execution; high-cost, destructive, outward-facing, or resource-heavy experiments still require explicit user direction and permission.",
      "Apply reference, pairing, and data-split reasoning only where it fits the study; do not impose ground truth, paired designs, or train/test splits on no-ground-truth, non-paired, or purely theoretical work.",
      `Maintain Dove research Markdown only when ${RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not synthesize a prospective plan after execution or disguise retrospective notes as prior design.",
      "Do not run a convenient proxy experiment that cannot affect the research decision.",
      "Do not treat a diagnostic as evidence beyond the conditions actually tested."
    ]
  });
  if (slug === "draft") return capabilityContract({
    purpose: "Draft, assess, or revise the user-specified project text or artifact from the available evidence.",
    when: "Use when the user specifies a manuscript, section, claim-bearing artifact, draft, assessment, or revision target, or when expression, argument, or an authoritative delivery artifact is the limiting deficiency.",
    responsibilities: [
      "Prioritize the user-specified manuscript or artifact and the evidence needed for its material claims; leave unchecked methods, results, citations, samples, data, and field facts unknown.",
      "Preserve certainty, causality, scope, generality, quantitative qualifiers, and novelty unless inspected evidence changes the judgment; user decisions can change the requested goal or expression, not establish stronger facts. Say what changed before changing the text.",
      "An outline, complete draft, evidence check, and actual delivery are work facts, not scientific quality grades. Judge whether the expression is misleading, weak, accurate and usable, or compelling under the shared criteria; writing completeness is independent of contribution and evidence strength. A polished manuscript can still contain an unsupported central claim. Check how substantive edits affect the whole argument without treating every local edit as a new research task.",
      "Build or repair the paper spine: problem → gap → insight/mechanism → method → evidence → claim → limitation → reader takeaway. State common assumptions and limits together rather than repeating them throughout; core gaps constrain the conclusions.",
      "Use reliable author samples only for stable style cues such as rhythm, paragraphing, hedging, transitions, reporting verbs, and citation integration; keep accuracy and venue norms above voice imitation.",
      "For contribution-level drafting, address in-scope method, source, experiment, figure, artifact propagation, or argument gaps before merely weakening prose. A local wording task stays local; flag a material claim issue without restarting research. Do not obtain coherence or apparent review readiness by silently changing the problem, output, baseline, real goal, contribution, or success meaning; if an authorized revision materially changes scientific task identity, preserve the earlier proposition's conclusion and treat the new scope on its own standing."
    ],
    actions: [
      readResearchDocuments("When an existing Claim note is directly relevant to the user-specified draft or material claim, read `.dove/research/RESEARCH.md`, then `.dove/research/claims/CLAIMS.md`, then only directly relevant linked details. Otherwise work from the target artifact and specified evidence without reading Claims merely because Draft was invoked."),
      relevantLessons,
      action("artifact-editing", `Read the target and relevant material, then draft, assess, create, or revise the ordinary artifact when the deliverable requires it. ${DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY} Propagate authorized edits through the real build or export path and inspect the actual output before claiming the artifact is current; assessment-only requests return findings without edits.`),
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
      "A visual plan, rendered visual, materials and meaning checked, and inspection in the final use context are work facts, not quality grades. Judge accuracy, clarity, insight, and actual usability: a misleading encoding remains poor after inspection, while an accurate mechanism figure can clarify the contribution. A standalone preview does not establish final-context readiness; substantive revisions must preserve nearby claims and evidence, not merely improve appearance.",
      "Organize materials around each figure or panel's evidence or mechanism job: comparison, process, failure mode, causal story, or contribution. Distinguish schematic explanation from data evidence, and keep source data or logic aligned with the actual rendered figure, caption, nearby text, and manuscript claim; local figure edits do not trigger a whole-project audit.",
      "Start from a compact Figure brief and visual plan: target claim, audience, evidence or mechanism job, real materials, panel/story structure, route choice, manuscript placement, final dimensions, caption role, and editable-source route."
    ],
    actions: [
      readResearchDocuments("When existing Dove research context would materially help the figure, read the overview and directly relevant Mission, Experiment, Claim, manuscript, or prior figure context; otherwise use the user's materials and data."),
      relevantLessons,
      action("figure-planning", "Create a compact Figure brief and visual plan from inspected context: target claim, audience, evidence or mechanism job, real data or source visuals, chosen route, panel/story layout, manuscript location, final dimensions, caption and nearby-text role, and expected editable source. For planning-only or assessment-only requests, report the plan or findings without creating files.", { readOnly: true }),
      action("figure-creation", "For creation, choose the route that fits the task: plot quantitative figures from real data with reproducible code; draw editable structure or mechanism diagrams in route-native SVG/vector/source form; use exposed host image generation or editing only when an illustrative image is the right route and permitted; or combine raster panels with SVG/vector labels, layout, and annotations. Render the actual figure and write its caption from the inspected data or mechanism logic, explaining panels, encodings, and relevant limits without overstating the claim. Keep scratch renders in a repository-local workspace such as `.claude/tmp/` unless directed otherwise, and do not invent data, results, or method details."),
      action("figure-inspection", "Open or view the actual rendered figure, not just filenames or thumbnails, at realistic final dimensions and in manuscript context when available. Check the chain from source data or mechanism logic to visual encoding, rendered panels, labels, units, legends, caption, nearby text, layout fit, and manuscript claim; flag mismatches rather than treating figure existence or size as success.", { readOnly: true }),
      action("figure-revision", "For revision, make targeted changes to the editable source, plotting code, SVG/vector structure, raster edits, labels, layout, annotations, caption, nearby manuscript text, or export settings; rerender and inspect the updated figure before delivery."),
      action("figure-delivery", "Deliver the final figure file and caption together with the route-native editable source, such as plotting code and data reference, SVG/vector source, layered or editable image source, or the mixed raster plus SVG/vector composition that allows later modification."),
      updateResearchDocuments("When useful for recovery, use ordinary Markdown links and readable project-relative artifact paths to link the rendered figure, route-native editable source, plot code and data, or source visual from the relevant Mission, Experiment, or Claim. Keep these as human-readable notes, not a structured figure store. Update summaries only for material synthesis or priority changes.")
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
    const reviewGroundingAction = action("review-grounding", "For whole-paper author-side self-check or `dove-review` handoff preparation, inspect the current full paper and the venue or literature context that can change the judgment. Use current official venue sources for formal requirements and inspected relevant published work for novelty, positioning, evidence norms, experiment presentation, and reader expectations; published practice does not replace official rules. Distinguish material merely found from material retrieved, inspected, and used. Import, context inspection, or bounded local review does not trigger venue or paper search by itself.", { readOnly: true });
    const reviewerPerspectiveAction = action("reviewer-perspective-work", `${DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS} Also check citation identity, claim support, changes in claim strength, unsupported facts, anomalous results, and whether the current paper silently replaced an earlier problem, output, baseline, real goal, contribution, or success condition when relevant. ${DOVE_RESEARCH_REVIEW_ANTI_GAMING} A favorable judgment applies to the current task and claims only; it neither erases an earlier proposition's failure nor authorizes a different author-side mainline. For local paragraph, figure, citation, or method review, stay inside the requested scope and do not force the full-paper four questions or start an independent handoff. Return concrete findings with evidence, consequence, useful response, and delivery readiness kept separate. Classify impact as ‘核心问题’ (constrains the core goal), ‘分支问题’ (constrains affected dependent work), or ‘局部问题’ (local quality); state evidence sufficiency separately rather than equating missing evidence with refutation or repair effort with severity.`, { readOnly: true });
    const deliveryReviewAction = action("delivery-review", "When delivery review is requested or genuinely limiting, inspect the actual venue-facing package against those requirements and report remaining delivery gaps.", { readOnly: true });
    const reviewHandoffAction = action("dove-review-handoff", `${DOVE_RESEARCH_REVIEW_FROZEN_HANDOFF} Include the grounding inspected above for the intended frozen-material judgment. Preserve the purpose, target venue, complete frozen material list, reviewer prompt, known host limits, and returned report location in the Review context. Give the reviewer only those listed materials, with Read-only access and no web, MCP, private author conversations, or unlisted files. Use an isolated, persistent, recoverable reviewer context when the host provides one; resume or rerun later whole-paper rounds for the same review id and reviewer session. If grounding is missing, the reviewer should limit venue or literature conclusions to the listed materials; if the runtime is unavailable, say so and continue feasible author-side work without counting it as independent review.`);
    const reviewMaintenanceAction = maintainArea("reviews", "When the user supplies a `dove-review` return, user-pasted review opinion, clarification, rebuttal exchange, or asks to preserve self-check or handoff context, append the actual text faithfully to the corresponding Review document and associate it with the same review id and round when known. When useful for recovery, link the corresponding `.dove/reviews/` round report, frozen materials, and affected Claim, Experiment, Figure, Source, or manuscript locations. Do not revise author artifacts, start a new review, rewrite the return, or add author interpretation unless asked.");
    const semanticSections = [
      {
        title: "Author-side scientific self-check",
        purpose: DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC,
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
        ]
      },
      {
        title: "Independent `dove-review`",
        purpose: DOVE_RESEARCH_REVIEW_DUAL_COMPLETION,
        responsibilities: [
          DOVE_RESEARCH_REVIEW_ISOLATED_PERSISTENT,
          "Each isolated runtime round reviews the whole current frozen paper, not only a diff, with the same four full-paper questions above. The reviewer returns Markdown under Verdict, Blocking issues, Grounding basis, and Author-side next actions.",
          DOVE_RESEARCH_REVIEW_NEGATIVE_CONTINUITY,
          DOVE_RESEARCH_REVIEW_VERSION_CURRENCY,
          DOVE_RESEARCH_REVIEW_RETURN_PROVENANCE
        ],
        actions: [
          reviewHandoffAction
        ],
        boundaries: [
          "Earlier author-side Reviews, handoffs, code, raw outputs, and working figures are not supplied automatically; a resumed reviewer context retains its own review history. Do not restart it to avoid prior objections.",
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
        claude: ["For `dove-review`, use `dove review handoff --project <project> --venue <venue> --material <path>...`, then `dove review resume --project <project> --id <id>` or `dove review rerun --project <project> --id <id> --material <path>...` for the same review id and reviewer session. Import user-provided returns with `dove review import --project <project> --id <id> --file <report.md>`. Only listed materials are copied into the isolated reviewer workspace, and Claude Code receives Read only."],
        dsh: ["In DSH, use author-side Review or preserve a user-provided returned review unless the current host exposes equivalent isolated-review support."]
      })
    });
  }
  if (slug === "rebuttal") return capabilityContract({
    purpose: "Analyze review findings, draft author-side responses, and make requested evidence-backed revisions.",
    when: "Use when the user requests rebuttal, response, revision, or follow-up work from review findings.",
    responsibilities: [
      "Group findings with the same root cause, locate definition, mechanism, evidence, or expression gaps, and analyze them against actual evidence. Decide whether to accept, rebut, qualify, or investigate, naming the needed evidence, research action, and manuscript or rebuttal response while preserving coverage of each material finding.",
      "Finding understood, response path grounded, needed revisions implemented, and effect checked are processing facts, not resolution grades. Judge whether the underlying concern is resolved, reduced, or still limiting, and whether the response improves the whole argument without new scientific defects. Compare local repair, shared-cause redesign, alternative routes, or further evidence when appropriate rather than defaulting to the smallest reply. A written response does not establish that the issue is resolved, and author self-check does not mean reviewer acceptance.",
      "Compare original claim, reviewer interpretation, planned response, and revised claim so certainty, causality, scope, quantitative qualifiers, novelty, contribution, problem, output, baseline, real goal, proxy, and success meaning do not change silently. Reviewer objections can reveal a better task, but they do not automatically authorize a succession of easier tasks; preserve the original proposition's disposition and independently judge any materially different candidate before mainline promotion.",
      "Use Source for new citations and Experiment for new results; leave unchecked source content, project facts, methods, results, and field facts unconfirmed.",
      "When fixable deficiencies are in scope, improve evidence, analysis, manuscript text, figures, captions, tables, supplements, highlights, or venue-facing files—not just response tone. Treat a review as current only for the same complete manuscript and listed materials; after substantive evidence, claim, method, figure, or venue-facing changes, decide whether a fresh `dove review rerun` is needed before relying on the old recommendation."
    ],
    actions: [
      readArea("reviews", "the relevant returned review"),
      relevantLessons,
      action("rebuttal-and-revision", "Read the Review document, same review id and round when available, the reviewed material list, current material state, and actual artifacts. For each material finding, identify the source, experiment, method, analysis, expression, figure, venue-fit, or scientific-task identity problem. For new citations, verify identity and inspected-content support through Source; for new results, inspect actual Experiment materials before using them in the response. Then draft the response and make requested revisions that resolve, reduce, or honestly bound it while preserving accurate claim strength and professional author voice. Do not chase acceptance through cosmetic-only changes, selective evidence, hidden counterevidence, unjustified narrowing, or a sequence of unacknowledged task changes. If the warranted response materially changes the confirmed mainline, intended contribution, or completion meaning, preserve the old proposition's conclusion, independently assess the candidate, and obtain the user's decision before adopting it. Do not rerun review for cosmetic or response-only edits; use `dove review rerun` when substantive evidence, claim scope, method, figure, result interpretation, venue-facing materials, or completion judgment changed enough that the old recommendation no longer covers the current full version."),
      action("artifact-validation", `Check that each response and requested revision addresses a real finding. ${DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY} Propagate requested revisions through the real build or export path and inspect the output before claiming the revised artifact is current; fix in-scope issues or report remaining material limits and user choices.`),
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
      "Treat Lessons as broad, fallible guidance for research methods, successful and failed routes, cross-domain intuitions, experiment and source practice, figures, writing, review, collaboration, and other reusable work—not as evidence or a completion certificate. State whether advice is tentative, grounded, or tested through reuse under stated conditions as evidence facts, not grades of usefulness. Judge its validity, conditions, counterexamples, and transfer value: reuse may refute advice rather than strengthen it. Repeated citation, recording, or application alone does not improve a lesson or establish scientific progress.",
      `For reading, use the Lessons summary and linked themes whenever they ${LESSONS_VALUE_STANDARD}; include directly relevant and plausibly useful material, while reusing active-context Lessons instead of rereading them mechanically.`,
      `For maintenance, preserve a Lesson whenever the experience ${LESSONS_VALUE_STANDARD}. Write the reusable insight with its basis, conditions, counterexamples, and limits when known, not a routine activity log.`
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
  ["research", "Use when a confirmed or provisional research goal needs Dove to choose and carry out the next substantive in-scope action."],
  ["status", "Use when the user asks where the research stands, without turning software health, receipts, or navigation into research progress."],
  ["source", "Use when external sources, citation identity, DOI checks, or bounded bibliography verification can change the research judgment."],
  ["experiment", "Use when empirical design, execution, existing-result analysis, or local run receipts can advance a research decision by resolving a real uncertainty."],
  ["draft", "Use when the user names a draft/artifact to write or revise, with available evidence prioritized over polishing."],
  ["figure", "Use when data or mechanism logic must become an actual checked figure with caption, text, and claim alignment."],
  ["review", "Use for whole-paper author self-check, delivery review, isolated `dove-review`, returned-review import, or bounded local review."],
  ["rebuttal", "Use when review findings require current evidence, possible reruns, author response, or evidence-backed revision."],
  ["lessons", "Use when reusable research guidance should be read or preserved without recording routine progress twice."],
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
