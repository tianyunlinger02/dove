import {
  DOVE_RESEARCH_ACTUAL_MATERIAL_FACT_BOUNDARY,
  DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY,
  DOVE_RESEARCH_RESULT_ADOPTION,
  DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY,
  DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY,
  DOVE_RESEARCH_MAINTENANCE_TRIGGER,
  DOVE_RESEARCH_MENTOR_NAME,
  DOVE_RESEARCH_REVIEW_AGENT_NAME,
  DOVE_RESEARCH_REVIEW_CONDITIONAL_DELIVERY,
  DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC,
  DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS,
  DOVE_RESEARCH_CLARIFICATION,
  DOVE_RESEARCH_QUALITY_REFERENCE_PATHS,
  DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS
} from "./dove-research-contract.mjs";
import { EXA_WEB_SUPPORT_SKILL_PATH } from "./web-access-integration.mjs";
import { DOVE_AGENT_SURFACES } from "./dove-agent-definition.mjs";
import { DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS, DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATHS } from "./dove-author-preferences.mjs";

export const PACKAGE_DOCUMENTATION_PATHS = ["README.md", "docs/README.md", "docs/AUTHOR_PREFERENCES.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md", "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"];
export const PACKAGE_LEGAL_PATHS = ["LICENSE", "THIRD_PARTY_NOTICES.md"];
export const PACKAGE_BRAND_PATHS = ["dove.png"];
export const PACKAGE_RUNTIME_PATHS = ["dist/index.mjs", "bin/dove-package.mjs"];
export const PROJECT_HOST_IDS = ["claude", "dsh"];
export const DOVE_CLAUDE_AMBIENT_PROJECT_PATHS = Object.freeze([
  ".claude/rules/dove.md",
  DOVE_RESEARCH_QUALITY_REFERENCE_PATHS.claude,
  DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS.claude,
  DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS.claude,
  DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATHS.claude,
  ".claude/skills/dove-paper-search/SKILL.md",
  ".claude/skills/dove-web-reader/SKILL.md",
  ".claude/settings.json"
]);
export const PACKAGE_RESOURCE_ROOT = "package-resources/hosts";
export const PACKAGE_GENERATED_SUPPORT_PATHS = Object.freeze([
  ...Object.values(DOVE_AGENT_SURFACES).map((agentPath) => `${PACKAGE_RESOURCE_ROOT}/claude/${agentPath}`),
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/rules/dove.md`,
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/skills/dove-paper-search/SKILL.md`,
  `${PACKAGE_RESOURCE_ROOT}/claude/${EXA_WEB_SUPPORT_SKILL_PATH}`,
  ...PROJECT_HOST_IDS.flatMap((hostId) => [
    `${PACKAGE_RESOURCE_ROOT}/${hostId}/${DOVE_RESEARCH_QUALITY_REFERENCE_PATHS[hostId]}`,
    `${PACKAGE_RESOURCE_ROOT}/${hostId}/${DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS[hostId]}`,
    `${PACKAGE_RESOURCE_ROOT}/${hostId}/${DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS[hostId]}`,
    `${PACKAGE_RESOURCE_ROOT}/${hostId}/${DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATHS[hostId]}`
  ])
]);
export const HOST_DEFINITIONS = {
  claude: { label: "Claude Code", scope: "project", jsonChecks: [] },
  dsh: { label: "DeepSeek Harness (dsh)", scope: "project", jsonChecks: [] }
};

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

const LESSONS_VALUE_STANDARD = "could inspire current or subsequent work, improve judgment, expand the candidate space, or prevent repeated mistakes";
const relevantLessons = `Before the first consequential choice for the current request, or after a user correction or recurring repair or failure exposes a possibly shared mistaken premise, read ".dove/research/lessons/LESSONS.md" once if it exists unless it has already been checked for this question in the active context, then only directly relevant or plausibly decision-changing linked Lessons. Reuse still-applicable Lessons instead of rereading them mechanically. Read ".dove/research/RESEARCH.md" separately only when project context is still needed; it is not a prerequisite for Lessons. If Lessons materials are absent, continue without creating them. Treat Lessons as fallible guidance, never as evidence. Ordinary deterministic local work has no Lessons prerequisite.`;

const AREA = Object.freeze({
  sources: Object.freeze({ directory: "sources", summary: "SOURCES.md" }),
  reviews: Object.freeze({ directory: "reviews", summary: "REVIEWS.md" }),
  lessons: Object.freeze({ directory: "lessons", summary: "LESSONS.md" })
});

function areaPath(area) {
  const value = AREA[area];
  return `.dove/research/${value.directory}/${value.summary}`;
}

function readArea(area, purpose) {
  return `When existing Dove research context would materially help ${purpose}, check the short identity card when present, then \`${areaPath(area)}\` and directly relevant linked details. Use \`.dove/research/RESEARCH.md\` only if its short navigation is needed. Otherwise work directly from the user's request and specified materials; avoid broad research-tree scans.`;
}

function maintainArea(area, instruction) {
  return `${instruction} Use ordinary Markdown links and readable artifact paths, not a structured store. Keep new core records in the identity card, EVAL and rounds; preserve useful source material, reviewer returns and Lessons under their own existing scope. Update \`${areaPath(area)}\` only when its links or synthesis change, and RESEARCH.md only as a short history index.`;
}

function capabilityContract(options) {
  return {
    ...options,
    returnWith: [DOVE_RESEARCH_RESULT_ADOPTION],
    clarification: options.clarification ?? commonClarification,
    hostGuidance: options.hostGuidance ?? hostGuidance()
  };
}

function contract(slug) {
  if (slug === "research") return capabilityContract({
    ambientParticipation: "Read the identity card and EVAL; execute the current round to its result, then call the mentor and continue.",
    purpose: "Start or continue the mentor-led round loop.",
    when: "Use for research progression; bounded questions remain bounded.",
    actions: [
      `Call ${DOVE_RESEARCH_MENTOR_NAME} fresh and read-only with dated user-original sources/range since its last reading, the current user's exact words, specified norms, identity card, EVAL, recent brief/result, actual diff/files and raw artifacts—not execution conversation or paraphrased user intent. Save its brief verbatim; inception precedes EVAL. Follow the versioned method brief; report evaluator flaws and objections in the result.`
    ],
    boundaries: ["The mentor decides methods and engineering within Mainline and user resources. Only goal/claim, deployment input/output or resource changes need the user's decision; ask once and continue independent authorized defaults if unanswered."]
  });
  if (slug === "status") return capabilityContract({
    ambientParticipation: "Read the card, latest EVAL rows and current brief; answer four plain sentences, then return to the round.",
    purpose: "Explain progress in four plain sentences.",
    when: "Use when the user asks where research stands.",
    actions: [
      "Read IDENTITY.md, the last few EVAL.md rows and the current round brief. Say: what we have made; whether the core is demonstrated; what blocks it; which round is underway. Quote actual values when useful; missing evidence stays unknown."
    ],
    boundaries: ["Status reads and reports, without new experiments or a new route. Retain a user's correction in affected card fields unless writing is forbidden; then return to the ongoing round."],
    clarification: []
  });
  if (slug === "source") return capabilityContract({
    ambientParticipation: "When external material can change judgment, use inspected grounding, claim support, and near-neighbor subtraction to change method design, identifying controls, claims, figures, or wording—not accumulate citations.",
    purpose: "Find, retrieve when possible, read, verify, and document sources that can change the research judgment.",
    when: "Use for source discovery, reading, comparison, verification, bounded bibliography DOI identity checks, source-backed positioning, or route changes that depend on external theory or related work.",
    responsibilities: [
      "Start from the user's source question and current project need, not a fixed tool order or paper count; stop searching when further retrieval would not change the decision or answer the bounded question.",
      "Distinguish ‘发现线索’ (found leads), ‘身份核实’ (verified citation identity), ‘相关全文检查’ (inspected relevant full text), and ‘具体主张核实’ (checked a specific claim). These are source-use facts, not novelty grades; judge novelty by the remaining substantive contribution, with search depth informing confidence. Retrieval alone is not inspection; completed claim verification can find support, contradiction, or insufficient coverage, not necessarily support. When a DOI matters and direct lookup is available, check it before fuzzy title matching; compare DOI, title, authors, year, and venue or version, then report verified, conflict, not-found, or unknown. For a bounded bibliography DOI identity check, verify only the requested entries and do not create a ledger.",
      "Extract consensus, contradictions, assumptions, missing controls, transferable mechanisms, and research opportunities from inspected material. Compare nearby work's problem, inputs/outputs, assumptions, components, relationships, mechanisms, and overall properties at the same granularity; locate decisive coverage in actual text, formulas, algorithms, or code, subtract it, and feed the remaining contribution and value back into design before consequential implementation when it can change the candidate. Carry inspected support, contradictions, and remaining contribution into method design, identifying controls, claims, figures, and wording where affected. This targeted inspection shapes the problem and method rather than merely positioning a finished solution; stop when further search cannot change the current design or decision. Use the shared reference to distinguish public combinations, grounded routine constructions, and substitutes borrowing candidate designs, and to keep operation equivalence, expressive coverage, implementation availability, and empirical parity separate. Known components need not exhaust a combination's contribution; no complete precedent is not proof of novelty. Unchecked full text does not establish absence of overlap.",
      "For explicit systematic review, meta-analysis, evidence grading, or auditable synthesis, use a suitable structured question, search scope, eligibility criteria, PRISMA-style tracking, risk-of-bias and evidence-certainty judgments when applicable, and pool effects only when studies and data are comparable."
    ],
    actions: [
      readArea("sources", "the source question"),
      relevantLessons,
      `Discover, retrieve when available, read, and verify external material with permitted host tools. ${DOVE_RESEARCH_ACTUAL_MATERIAL_FACT_BOUNDARY} For citation checks, verify identity and metadata first, using direct DOI lookup before fuzzy title search when available. A failed lookup is unknown, not permission to recreate retrieval through shell tools. Metadata identity is not full-text inspection or claim support; inspect actual content before using the source for a claim. Split compound claims into their material parts and report each as supported, contradicted, or uncovered by the inspected content, with the passage or evidence and its limits. Partial support is not support for the whole sentence; recommend only the supported wording without automatically editing the manuscript. For explicit systematic work, use the structured method stated above; ordinary paper finding, related-work scans, and single fact checks stay proportional. If needed material is unavailable, say what is missing and continue with any other material that can still inform the question.`,
      maintainArea("sources", "When a used source deserves durable context, create or update a naturally named source note with the citation or URL, what was inspected and learned, and, when useful for recovery, ordinary links to the Claim, Experiment, Figure artifact, or manuscript location that the inspected source actually supports or challenges.")
    ],
    boundaries: [
      "Save retrieved source material or source notes only when useful and permitted.",
      "Keep DOI identity checks transient by default; update ordinary Source notes or bibliography entries only when identity results materially affect research judgment, manuscript citations, or continuation context.",
      `Maintain Dove research Markdown other than Lessons only when ${DOVE_RESEARCH_MAINTENANCE_TRIGGER}.`
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
    ambientParticipation: "Develop freely; evaluate fixed method versions and use fresh unseen test data after a tested method changes.",
    purpose: "Run and interpret experiments within a round.",
    when: "Use for development, diagnostics, confirmation, reproduction or existing-result analysis.",
    actions: [
      "Use actual outputs and failure denominators; change code as a new method version and rerun it fully. For unlearnable methods first test single-example overfitting, before larger data/evaluators. Report evaluator flaws and objections in the round result, do not fix EVAL yourself; execute the mentor's protocol repair and all-history recomputation. Put measured results in EVAL, not new experiments/ records."
    ],
    boundaries: ["Read-only or design-only requests do not execute. Heldout used for tuning is no longer independent final evidence."]
  });
  if (slug === "draft") return capabilityContract({
    ambientParticipation: "When text or delivery is material, align claims with inspected evidence and carry edits through the authoritative source and build/export to the inspected deliverable.",
    purpose: "Draft, assess, or revise the user-specified project text or artifact from the available evidence.",
    when: "Use when the user specifies a manuscript, section, claim-bearing artifact, draft, assessment, or revision target, or when expression, argument, or an authoritative delivery artifact is the limiting deficiency.",
    responsibilities: [
      "Prioritize the user-specified manuscript or artifact and the evidence needed for its material claims; leave unchecked methods, results, citations, samples, data, and field facts unknown.",
      "Preserve certainty, causality, scope, generality, quantitative qualifiers, and novelty unless inspected evidence changes the judgment; user decisions can change the requested goal or expression, not establish stronger facts. Say what changed before changing the text.",
      "An outline, complete draft, evidence check, and actual delivery are work facts, not scientific quality grades. Judge whether the expression is misleading, weak, accurate and usable, or accurate with substantially lower understanding/use costs under the shared criteria; writing completeness is independent of contribution and evidence strength. A polished manuscript can still contain an unsupported central claim. Check how substantive edits affect the whole argument without treating every local edit as a new research task.",
      "Build or repair the paper spine: problem → gap → insight/mechanism → method → evidence → claim → limitation → reader takeaway. State common assumptions and limits together rather than repeating them throughout; core gaps constrain the conclusions.",
      "Use reliable author samples only for stable style cues such as rhythm, paragraphing, hedging, transitions, reporting verbs, and citation integration; keep accuracy and venue norms above voice imitation.",
      "For contribution-level drafting, address in-scope method, source, experiment, figure, artifact propagation, or argument gaps before merely weakening prose. A local wording task stays local; flag a material claim issue without restarting research. Do not obtain coherence or apparent review readiness by silently changing the problem, output, baseline, real goal, contribution, or success meaning; if a revision materially changes scientific task identity, preserve the earlier proposition's conclusion and treat the new scope on its own standing."
    ],
    actions: [
      "When an existing Claim note is directly relevant to the user-specified draft or material claim, read `.dove/research/RESEARCH.md`, then `.dove/research/claims/CLAIMS.md`, then only directly relevant linked details. Otherwise work from the target artifact and specified evidence without reading Claims merely because Draft was invoked.",
      relevantLessons,
      `Read the target and relevant material, then draft, assess, create, or revise the ordinary artifact when the deliverable requires it. ${DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY} Propagate edits through the real build or export path and inspect the actual output before claiming the artifact is current; assessment-only requests return findings without edits.`,
      "Run the checks needed for the requested artifact, fix in-scope issues, and report remaining material issues, scope limits, or user choices.",
      "When a claim needs durable context, record its evidence and limits in the current round result and link actual artifacts; keep existing claims/ notes as history without adding or rewriting them."
    ],
    boundaries: [
      "Draft may create or edit ordinary project artifacts requested by the user or needed for the bounded deliverable; destructive, outward-facing, or submission actions still need explicit authorization.",
      `Maintain Dove research Markdown other than Lessons only when ${DOVE_RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not let polished wording, export, or local checks replace missing evidence for a claim.",
      "Do not create Claim records merely because drafting occurred."
    ]
  });
  if (slug === "figure") return capabilityContract({
    ambientParticipation: "When a visual carries evidence or mechanism meaning, check data/mechanism → encoding → render → caption → nearby text → claim, and treat affected prior same-version Review as historical after material changes, without authorizing a rerun.",
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
      "When existing Dove research context would materially help the figure, read the overview and directly relevant Mission, Experiment, Claim, manuscript, or prior figure context; otherwise use the user's materials and data.",
      relevantLessons,
      "Create a compact Figure brief and visual plan from inspected context: target claim, audience, evidence or mechanism job, real data or source visuals, chosen route, panel/story layout, manuscript location, final dimensions, caption and nearby-text role, and expected editable source. For planning-only or assessment-only requests, report the plan or findings without creating files.",
      "For creation, choose the route that fits the task: plot quantitative figures from real data with reproducible code; draw editable structure or mechanism diagrams in route-native SVG/vector/source form; use exposed host image generation or editing only when an illustrative image is the right route and permitted; or combine raster panels with SVG/vector labels, layout, and annotations. Render the actual figure and write its caption from the inspected data or mechanism logic, explaining panels, encodings, and relevant limits without overstating the claim. Keep scratch renders in a repository-local workspace such as `.claude/tmp/` unless directed otherwise, and do not invent data, results, or method details.",
      "Open or view the actual rendered figure, not just filenames or thumbnails, at realistic final dimensions and in manuscript context when available. Check the chain from source data or mechanism logic to visual encoding, rendered panels, labels, units, legends, caption, nearby text, layout fit, and manuscript claim; flag mismatches rather than treating figure existence or size as success.",
      "For revision, make targeted changes to the editable source, plotting code, SVG/vector structure, raster edits, labels, layout, annotations, caption, nearby manuscript text, or export settings; rerender and inspect the updated figure before delivery. Material changes to evidence, encoding, caption, or claim alignment make affected prior same-version Review judgments historical; this does not authorize a review rerun.",
      "Deliver the final figure file and caption together with the route-native editable source, such as plotting code and data reference, SVG/vector source, layered or editable image source, or the mixed raster plus SVG/vector composition that allows later modification.",
      "When useful for recovery, link the rendered figure, route-native editable source, plot code and data, or source visual in the current round result using ordinary Markdown links and readable project-relative artifact paths. Leave historical missions/, experiments/ and claims/ records and summaries untouched; do not create a structured figure store."
    ],
    boundaries: [
      "Figure may create, edit, render, open, inspect, caption, export, or update ordinary project visuals and nearby manuscript text when requested or material to the deliverable; it must not invent data, results, or method details.",
      "A planning-only or explicit no-write request returns a plan or findings; figure creation and revisions carry through when part of the active goal.",
      `Maintain Dove research Markdown other than Lessons only when ${DOVE_RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not treat image counts, embedding, resolution, contact sheets, opening an image, beauty, or unchanged re-export as proof that the figure communicates the research.",
      "Do not use host image generation or editing when real data plotting, source inspection, editable diagrams, or simple vector/raster revision is the correct action."
    ]
  });
  if (slug === "review") {
    return capabilityContract({
      ambientParticipation: "Use a clean read-only paper-review context on specified materials; mentor rounds own method and route judgment.",
      purpose: "Assess a paper, local artifact, delivery readiness or an existing reviewer return.",
      when: "Use for paper judgment or review context, not mentor-led round decisions.",
      actions: [
        DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS,
        `For independent review, call ${DOVE_RESEARCH_REVIEW_AGENT_NAME} in a clean read-only context with the current manuscript, its cited results and relevant inspected venue/literature material. It reads only specified files with Read/Grep/Glob, not the author's execution conversation; no frozen snapshot or review CLI is needed. Whole-paper review reads the full current version; local review stays local.`,
        "Request a concise Markdown judgment, blocking issues, cited evidence and author-side next actions, listing the files actually read. Missing grounding limits the judgment. After substantive changes, request a fresh full-version review; an old recommendation remains historical.",
        "Keep actual reviewer returns faithful, with known venue and materials; distinguish user-pasted opinions from independent work actually performed. Preserve useful returns in the current round result or ordinary project files, not a runtime exchange store. Inspection or preservation alone does not start revision or another review."
      ],
      responsibilities: [
        DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC,
        DOVE_RESEARCH_REVIEW_CONDITIONAL_DELIVERY
      ],
      boundaries: [
        "Findings are reasoned objections, not empirical evidence or automatic acceptance. Assess cited grounds and address material concerns through author-side work; self-check does not certify independent review.",
        "Use an exposed equivalent clean read-only context on other hosts; if unavailable, report the limitation. Do not add hashes, frozen gates, persistent reviewer sessions or approval steps."
      ]
    });
  }
  if (slug === "rebuttal") return capabilityContract({
    ambientParticipation: "When review findings need a response, verify and prioritize them, distinguish answers from existing evidence from needed Source, Experiment, revision, or unresolved limits, and follow the user's actual goal.",
    purpose: "Analyze review findings, draft author-side responses, and make requested evidence-backed revisions.",
    when: "Use when the user requests rebuttal, response, revision, or follow-up work from review findings.",
    responsibilities: [
      "Group findings with the same root cause, locate definition, mechanism, evidence, or expression gaps, and verify them against actual evidence rather than automatically accepting or acting on them. Prioritize follow-through by material consequence. Decide whether to accept, rebut, qualify, or investigate, naming the needed evidence, research action, and manuscript or rebuttal response while preserving coverage of each material finding.",
      "Finding understood, response path grounded, needed revisions implemented, and effect checked are processing facts, not resolution grades. Judge whether the underlying concern is resolved, reduced, or still limiting, and whether the response improves the whole argument without new scientific defects. Compare local repair, shared-cause redesign, alternative routes, or further evidence when appropriate rather than defaulting to the smallest reply. A written response does not establish that the issue is resolved, and author self-check does not mean reviewer acceptance.",
      "Compare original claim, reviewer interpretation, planned response, and revised claim so certainty, causality, scope, quantitative qualifiers, novelty, contribution, problem, output, baseline, real goal, proxy, and success meaning do not change silently. Reviewer objections can reveal a better task, but they do not automatically authorize a succession of easier tasks; preserve the original proposition's disposition and independently judge any materially different candidate before mainline promotion.",
      "Use Source for new citations and Experiment for new results; leave unchecked source content, project facts, methods, results, and field facts unconfirmed.",
      "When fixable deficiencies are in scope, improve evidence, analysis, manuscript text, figures, captions, tables, supplements, highlights, or venue-facing files—not just response tone. Treat a review as current only for the same complete manuscript and listed materials; after substantive evidence, claim, method, figure, or venue-facing changes, decide whether a fresh read-only paper review is needed before relying on the old recommendation."
    ],
    actions: [
      readArea("reviews", "the relevant returned review"),
      relevantLessons,
      "Read the Review document, same review id and round when available, the reviewed material list, current material state, and actual artifacts. For each material finding, identify the source, experiment, method, analysis, expression, figure, venue-fit, or scientific-task identity problem. For new citations, verify identity and inspected-content support through Source; for new results, inspect actual Experiment materials before using them in the response. Then draft the response and make requested revisions that resolve, reduce, or honestly bound it while preserving accurate claim strength and professional author voice. Do not chase acceptance through cosmetic-only changes, selective evidence, hidden counterevidence, unjustified narrowing, or a sequence of unacknowledged task changes. If the warranted response materially changes the confirmed mainline, intended contribution, or completion meaning, preserve the old proposition's conclusion, independently assess the candidate, and obtain the user's decision before adopting it. Do not rerun review for cosmetic or response-only edits; use read-only paper review when substantive evidence, claim scope, method, figure, result interpretation, venue-facing materials, or completion judgment changed enough that the old recommendation no longer covers the current full version.",
      `Check that each response and requested revision addresses a real finding. ${DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY} Propagate requested revisions through the real build or export path and inspect the output before claiming the revised artifact is current; fix in-scope issues or report remaining material limits and user choices.`,
      maintainArea("reviews", "When worth preserving, append the author response, requested revisions, resulting decisions, unresolved issues, and follow-up to the same Review document or directly affected research document, and, when useful for recovery, link the originating Review return plus any newly used Source, Experiment, Figure, or ordinary artifact paths.")
    ],
    boundaries: [
      "Rebuttal may modify ordinary project artifacts and research documents when requested or when revisions are the in-scope response; outward-facing submission or destructive action still requires explicit authorization.",
      `Maintain Dove research Markdown other than Lessons only when ${DOVE_RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not let reviewer findings replace Dove's author-side judgment.",
      "Preserve only actual reviewer returns; do not overwrite original returns with author summaries."
    ]
  });
  return capabilityContract({
    ambientParticipation: "At consequential choices or after corrections and recurring failures, check useful Lessons once within the active context; preserve genuinely reusable experience without waiting for an explicit command, and treat Lessons as fallible guidance rather than evidence.",
    purpose: "Read or maintain researcher-owned Lessons that can improve current or subsequent work.",
    when: `Use when existing or newly learned guidance ${LESSONS_VALUE_STANDARD}, including when the user asks to inspect, remember, reflect on, or preserve Lessons.`,
    responsibilities: [
      "Treat Lessons as broad, fallible guidance for research methods, successful and failed routes, cross-domain intuitions, experiment and source practice, figures, writing, review, collaboration, and other reusable work—not as evidence or a completion certificate. State whether advice is tentative, grounded, or tested through reuse under stated conditions as evidence facts, not grades of usefulness. Judge its validity, conditions, counterexamples, and transfer value: reuse may refute advice rather than strengthen it. Repeated citation, recording, or application alone does not improve a lesson or establish scientific progress.",
      `For reading, use the Lessons summary and linked themes whenever they ${LESSONS_VALUE_STANDARD}; include directly relevant and plausibly useful material, while reusing active-context Lessons instead of rereading them mechanically.`,
      `For maintenance, preserve a Lesson whenever the experience ${LESSONS_VALUE_STANDARD}. Write the reusable insight with its basis, conditions, counterexamples, and limits when known, not a routine activity log.`
    ],
    actions: [
      `Read ".dove/research/lessons/LESSONS.md" if it exists, then linked Lessons that are directly relevant or plausibly useful because they ${LESSONS_VALUE_STANDARD}. Read ".dove/research/RESEARCH.md" separately only when project context is still needed and it has not already been read in the active context; it is not a prerequisite for Lessons. Reuse Lessons already read in the active context instead of rereading them mechanically. If no Lessons summary or useful linked Lesson exists, report that naturally and continue from the available context. Do not create or modify files during reading and do not treat Lessons as evidence.`,
      `When an experience ${LESSONS_VALUE_STANDARD}, preserve its reusable insight and relevant conditions in the narrowest suitable researcher-owned Lessons document. If no Lessons material exists, create a content-bearing ".dove/research/lessons/LESSONS.md" only for that first qualifying experience; do not bootstrap an empty directory or index during reading. Create a naturally named linked Markdown file only when separating a theme is genuinely useful, and update "lessons/LESSONS.md" with a natural link when needed. For a transferable failed approach, include the mistaken premise or root cause, still-applicable earlier grounds, and the better method or repair it informs alongside the actual basis, conditions, counterexamples, and limits when known. Recording a Lesson does not itself fix the problem or replace the next core action. Avoid recording routine progress, transient status, one-off tool failures, non-transferable bugs, or observations with no plausible future value. Do not create lesson IDs, frontmatter, an application ledger, or treat Lessons as evidence.`
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
  ["research", "Start or continue the mentor-led research rounds from the identity card and evaluation table."],
  ["status", "Report what we have made, whether the core is demonstrated, what blocks it and which round is underway."],
  ["source", "Use when external sources, citation identity, DOI checks, or bounded bibliography verification can change the research judgment."],
  ["experiment", "Develop quickly; evaluate fixed method versions and redraw unseen test data after a tested method changes."],
  ["draft", "Use when the user names a draft/artifact to write or revise, with available evidence prioritized over polishing."],
  ["figure", "Use when data or mechanism logic must become an actual checked figure with caption, text, and claim alignment."],
  ["review", "Review a specified paper in a clean read-only context, or inspect author self-check, delivery or returned opinions."],
  ["rebuttal", "Use when review findings require current evidence, possible reruns, author response, or evidence-backed revision."],
  ["lessons", "Use when reusable research guidance should be read or preserved without recording routine progress twice."],
];

export const COMMAND_SURFACES = SURFACES.map(([slug, summary]) => ({
  id: `dove.${slug}`,
  title: `Dove ${slug}`,
  summary,
  contract: contract(slug),
  examples: [`/dove:${slug}`]
}));
export const COMMAND_SURFACE_BY_ID = Object.fromEntries(COMMAND_SURFACES.map((item) => [item.id, item]));

export function renderDoveAmbientParticipationSection() {
  return `## Capability participation

Apply these methods directly in the ordinary main session when useful; commands are shortcuts, not prerequisites. The main session retains judgment before and after delegation.

${COMMAND_SURFACES.map((command) => `- ${command.title}: ${command.contract.ambientParticipation}`).join("\n")}`;
}

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
  const extraPaths = hostId === "claude" ? [...DOVE_CLAUDE_AMBIENT_PROJECT_PATHS] : [
    DOVE_RESEARCH_QUALITY_REFERENCE_PATHS.dsh,
    DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS.dsh,
    DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS.dsh,
    DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATHS.dsh
  ];
  return [hostId, { label: HOST_DEFINITIONS[hostId].label, paths: [...commandPaths, ...extraPaths], requiredPaths: [...commandPaths, ...extraPaths], jsonChecks: HOST_DEFINITIONS[hostId].jsonChecks }];
}));
export const CURRENT_MANAGED_PATHS = Object.freeze({
  core: Object.freeze([...PACKAGE_RUNTIME_PATHS]),
  claude: Object.freeze([...HOST_ADAPTERS.claude.paths]),
  dsh: Object.freeze([...HOST_ADAPTERS.dsh.paths])
});
export function packageResourcePath(hostId, destinationPath) {
  return `${PACKAGE_RESOURCE_ROOT}/${hostId}/${destinationPath}`;
}
export const MANAGED_PACKAGE_PATHS = Object.freeze([
  ...commandAdapterPathsForHost("claude").map((item) => packageResourcePath("claude", item)),
  ...commandAdapterPathsForHost("dsh").map((item) => packageResourcePath("dsh", item)),
  ...PACKAGE_GENERATED_SUPPORT_PATHS,
  ...CURRENT_MANAGED_PATHS.core,
  ...PACKAGE_BRAND_PATHS,
  ...PACKAGE_DOCUMENTATION_PATHS
]);
