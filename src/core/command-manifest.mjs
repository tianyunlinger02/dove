import {
  DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY,
  DOVE_RESEARCH_MENTOR_NAME,
  DOVE_RESEARCH_REVIEW_AGENT_NAME,
  DOVE_RESEARCH_REVIEW_CONDITIONAL_DELIVERY,
  DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC,
  DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS,
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

const DEFAULT_HOST_GUIDANCE = Object.freeze({
  common: Object.freeze([
    "Use tools and materials exposed by the current host and permitted by the user and project. If something is unavailable, name the gap and continue with useful permitted alternatives."
  ]),
  claude: Object.freeze([
    "Use Claude Code waiting or background tools for actual long-running actions, then assess the returned results in the main session."
  ]),
  dsh: Object.freeze([
    "Use project-local files and the tools exposed by the current DSH run."
  ])
});

function hostGuidance(extra = {}) {
  return Object.fromEntries(["common", "claude", "dsh"].map((hostId) => [hostId, [
    ...(DEFAULT_HOST_GUIDANCE[hostId] ?? []),
    ...(extra[hostId] ?? [])
  ]]));
}

function capabilityContract(options) {
  return {
    ...options,
    hostGuidance: options.hostGuidance ?? hostGuidance()
  };
}

function contract(slug) {
  if (slug === "research") return capabilityContract({
    ambientParticipation: "Follow the shared topic-selection process until the user chooses a mainline, then advance it through work that can answer the research question.",
    purpose: "Help the user choose a research direction or advance the confirmed mainline through substantive method work.",
    when: "Use for topic exploration, method development or continuation of existing research.",
    actions: [
      "Apply the shared topic-selection process and RESEARCH_QUALITY.md's sourced gaps, cross-domain mechanism search and adversarial candidate review. Use Source for question-led full-text notes and link candidate cards to that evidence.",
      "After the user chooses, design and test the core mechanism at a scale that answers the question. Use Experiment for comparisons and evaluator repairs; the executor owns engineering and recomputes comparable history when evaluation changes.",
      `Follow the shared research contract for mainline continuity, round records and ${DOVE_RESEARCH_MENTOR_NAME}'s direction-only judgment, including its triggers, fixed questions and note flow.`
    ],
    boundaries: [
      "Before the user's mainline choice, do not implement candidate methods; undertake only diagnostics allowed by the topic criteria. Bounded questions stay bounded, and read-only or design-only requests do not authorize execution."
    ]
  });
  if (slug === "status") return capabilityContract({
    ambientParticipation: "Explain what has been made, whether the core is demonstrated, what blocks progress and which round is underway without starting new work.",
    purpose: "Give a concise, evidence-grounded account of the current research state.",
    when: "Use when the user asks about progress or what remains unresolved.",
    actions: [
      "Read IDENTITY.md, the last few EVAL.md rows and the current round brief. Answer in four plain sentences covering what we have made, whether the core is demonstrated, what blocks it and which round is underway. Include actual values when useful and leave missing evidence unknown."
    ],
    boundaries: ["Status is read-only and does not run research or update documents."]
  });
  if (slug === "source") return capabilityContract({
    ambientParticipation: "Use inspected sources to answer the source question, broaden ideas and improve affected designs or claims.",
    purpose: "Discover, retrieve, inspect and verify sources that can change a research decision or answer a specified question.",
    when: "Use for literature discovery, source reading, citation identity checks, claim verification, related-work comparison or systematic synthesis.",
    actions: [
      "Start from the user's question and relevant existing notes. Distinguish discovery, verified citation identity, full-text inspection and claim support; none substitutes for the next. For citation identity, use direct DOI lookup before fuzzy title search, checking title, authors, year and venue/version. Report conflicts, missing entries and unknowns.",
      "For body-level details, read the full text with 1–5 concrete questions, using `.dove/research/papers/<id>.md` and the cumulative note format in RESEARCH_QUALITY.md. Reuse answered questions rather than rereading; append only new answers with section, page or equation locations, preserving earlier ones. Check-only work returns answers without creating notes or editing manuscripts.",
      "Split compound claims and mark each supported, contradicted, or uncovered, with the relevant passage, formula, algorithm or code and its limits. Use the cumulative notes for novelty and overlap judgments, link affected artifacts and recommend wording matching actual support, not support for only part of a sentence.",
      "Search real neighbors across fields at equal contribution granularity, following the shared topic guidance when selecting ideas. Inspect decisive overlap and use findings to develop mechanisms, candidates and controls, not just deduct novelty. Apply findings to designs or claims; stop when retrieval would not change the decision.",
      "For explicit systematic reviews or meta-analysis, define the question, search scope and eligibility. Use applicable PRISMA tracking, bias and certainty assessment; pool only comparable effects. Ordinary searches need no such machinery. Update `sources/SOURCES.md` only when useful links or synthesis change."
    ],
    boundaries: [
      "Search snippets, abstracts, metadata and absent search results do not establish full-text inspection or absence of overlap. If retrieval is unavailable, state the gap and use other permitted material rather than shell fetching or substitute retrieval chains."
    ],
    hostGuidance: hostGuidance({
      claude: ["Use exposed WebSearch for discovery, dove-paper-search for DOI metadata and academic papers, and hosted exa for ordinary webpages and known URLs."]
    })
  });
  if (slug === "experiment") return capabilityContract({
    ambientParticipation: "Use actual outputs and fair comparisons to distinguish method effects from implementation or evaluation errors.",
    purpose: "Develop, reproduce and evaluate methods with evidence that answers the research question.",
    when: "Use for authorized development, diagnostics, confirmation, reproduction or analysis of existing results.",
    actions: [
      "Inspect the relevant code, data, configuration, outputs and analysis before interpreting results. When a model cannot learn, test single-example overfitting to diagnose the learning mechanism rather than treating larger data or a larger evaluator as the first remedy. A diagnostic supports only the question it actually tests.",
      "Use complete-task comparisons against strong same-input alternatives to assess utility, and ablations or controlled comparisons to test attribution. Keep budgets, uncertainty and failure denominators visible, including missing or invalid outputs. Follow the shared experiment contract for method versions, full evaluation, fresh test draws and final heldout confirmation.",
      "The main executor repairs evaluator errors and recomputes every historical method and baseline under the corrected protocol on comparable data. Reuse retained raw outputs first and rerun historical versions where outputs are missing. Keep earlier protocol results as history rather than mixing them with current comparisons. Protocol repair alone is not a method-version change; ask the user only if the correction changes the goal's meaning."
    ],
    boundaries: [
      "Read-only or design-only requests do not execute. Heldout data used for tuning is no longer independent final evidence."
    ]
  });
  if (slug === "draft") return capabilityContract({
    ambientParticipation: "Write evidence-grounded text in the authoritative manuscript format and carry changes through to an inspected deliverable.",
    purpose: "Draft, assess or revise the specified manuscript, section or claim-bearing artifact.",
    when: "Use for requested writing or revision, or when the argument, expression or delivery artifact needs work.",
    actions: [
      "Read the target and claim evidence. Connect problem, gap, insight, method, evidence and limits; preserve certainty, causality, scope, quantitative qualifiers and novelty. Explain evidence-driven claim changes before revising. Address in-scope source, method, evidence or figure gaps rather than merely weakening prose; polished text does not establish a sound contribution.",
      "Use `.dove/research/papers/library.json` and `library.md` to group related work by direction, checking claim support against `papers/<id>.md`. Verify citation metadata with Source before citing or exporting BibTeX; never invent authors, venue, date or identifiers. Export only verified fields. Explicit library accumulation or a later watch run maintains the library; merely reading it does not write it.",
      "Write publishable findings, setup and limits plainly. Ask the author about missing material rather than putting 'not provided' into the manuscript. Follow reliable author style samples within accuracy and venue norms, and check effects on the whole argument without expanding local writing into a new research task.",
      DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY,
      "Carry edits through the real build or export path and inspect the actual output before calling it current. Check compiled pages for overfull boxes, undefined references, float numbering and placement, and wide tables that need full width in two-column layouts. Measure body word count on the source without tables, captions or references against the target. Fix in-scope issues and report remaining material limits.",
      "If a venue template needs missing fonts or packages, obtain them with permitted tools in a project-local texmf and point the build there, rather than silently substituting fonts or changing system installations."
    ],
    boundaries: [
      "Assessment-only requests return findings without edits. Local writing stays local and does not require a mentor, new round or subagent merely to read the materials. Artifact preparation does not authorize submission."
    ]
  });
  if (slug === "figure") return capabilityContract({
    ambientParticipation: "Turn inspected data or mechanism logic into a rendered, checked figure with a caption and editable sources.",
    purpose: "Gather materials and plan, create, revise, inspect and caption publication figures.",
    when: "Use for a requested diagram, plot, caption, visual revision or assessment, or when a visual is needed to explain evidence or a mechanism.",
    actions: [
      "Inspect the actual data, source visuals and mechanism logic. Plan the figure's claim, audience, panel structure, manuscript placement, final dimensions and editable-source route, distinguishing schematic explanation from measured evidence.",
      "Choose the route that fits the material: plot real data with reproducible code, draw diagrams in editable SVG or vector form, use exposed host image generation or editing when an illustrative image is appropriate and permitted, or combine raster panels with editable vector labels and layout. Keep scratch renders in a repository-local workspace such as `.claude/tmp/` unless directed otherwise.",
      "Render the actual figure and write its caption from the inspected materials, explaining panels, encodings and relevant limits without inventing data, results or method details.",
      "Open or view the actual rendered figure at realistic final dimensions and in manuscript context when available. Check source data or logic against panels, labels, units, legends, caption, nearby text and the claim. Draw at the final column width, keep text at least about 70% of body text in the body font family, avoid label collisions and distinguish series in grayscale. A standalone preview does not establish final-context readiness.",
      "For revision, change the editable source, plotting code, image, layout, caption or nearby text as needed, then rerender and inspect the result. Deliver the final figure file and caption with the route-native editable source, including plotting code and data references, vector structure or an editable raster/vector composition."
    ],
    boundaries: [
      "Planning-only, assessment-only and no-write requests return plans or findings without creating files. Judge a finished visual by faithful meaning and usability, not image counts, resolution or beauty alone."
    ]
  });
  if (slug === "review") return capabilityContract({
    ambientParticipation: "Judge the specified current paper in a clean read-only context, distinguishing independent review from author self-check and delivery checks.",
    purpose: "Assess the scientific quality of a paper, a local artifact, delivery readiness or an existing reviewer return.",
    when: "Use for paper judgment and review inspection rather than mentor direction decisions.",
    responsibilities: [
      DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC,
      DOVE_RESEARCH_REVIEW_CONDITIONAL_DELIVERY
    ],
    actions: [
      DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS,
      `For independent review, call ${DOVE_RESEARCH_REVIEW_AGENT_NAME} in a fresh read-only context with the current manuscript, cited results and relevant inspected venue or literature material. It uses Read/Grep/Glob on specified files, not the author's execution conversation. Use an equivalent clean context on other hosts and report the limitation if none is available; no frozen snapshot, review CLI or persistent reviewer session is needed.`,
      "Request a concise judgment with blocking issues, cited evidence, author-side actions and the files actually read. Missing grounding limits the judgment. Whole-paper review reads the complete current version, while local review stays local; after substantive changes, obtain a fresh full-version review before treating a previous recommendation as current.",
      "Preserve actual reviewer returns faithfully and distinguish user-pasted opinions from independent work performed. Store useful returns as ordinary project material, not a runtime exchange store. Reading or preserving a return does not itself authorize revisions or another review."
    ],
    boundaries: [
      "Review findings are reasoned objections, not empirical evidence or automatic acceptance. The author assesses their grounds and addresses material concerns; author self-check cannot certify independent review."
    ]
  });
  if (slug === "rebuttal") return capabilityContract({
    ambientParticipation: "Respond to verified review concerns as the author, make in-scope evidence-backed revisions and state what remains unresolved.",
    purpose: "Analyze review findings, draft author responses and implement requested revisions.",
    when: "Use when the user asks for a rebuttal, response or follow-through on review findings.",
    actions: [
      "Read the review, its reviewed-material list and the current artifacts. Group findings with the same root cause and verify their grounds rather than accepting every objection. Prioritize material consequences, decide whether to accept, rebut, qualify or investigate, and preserve coverage of every material finding.",
      "Use Source to verify new citations and claim support, and Experiment to obtain or interpret new results. Compare the original claim, reviewer interpretation, response and revised claim so certainty, causality, scope, quantitative qualifiers and novelty do not change silently. Shared mainline rules govern any proposed change of research direction.",
      "Draft the response and make requested revisions to evidence, analysis, text, figures, tables, supplements or venue-facing files, not just response tone. Address shared causes when a local reply would leave the concern intact. Preserve accurate claims and counterevidence instead of seeking apparent acceptance through cosmetic changes or unjustified narrowing.",
      "Use Draft's authoritative-source and build/export workflow to deliver inspected revisions. Apply Review's current-version rule before relying on an old recommendation, but do not rerun review merely for cosmetic or response-only edits. State whether each underlying concern is resolved, reduced or still limiting; a written reply is not resolution or reviewer acceptance.",
      "Keep useful responses, revisions and unresolved issues with links to the originating review and changed artifacts. Preserve original reviewer returns separately from author commentary and do not overwrite them with summaries."
    ],
    boundaries: [
      "Author-side responses and revisions remain within the requested scope and do not authorize submission or destructive actions."
    ]
  });
  return capabilityContract({
    ambientParticipation: "Consult useful Lessons at consequential choices or after recurring mistakes, and preserve transferable insights as optional guidance rather than evidence.",
    purpose: "Read and preserve researcher-owned Lessons that improve future choices or prevent repeated mistakes.",
    when: "Use when experience can inform a current decision, broaden ideas or improve later work, including explicit requests to remember or reflect.",
    actions: [
      "Before the first consequential choice for the current question, or after a correction or recurring failure exposes a shared mistaken premise, check `.dove/research/lessons/LESSONS.md` once if it exists. Follow only relevant or plausibly useful links and reuse Lessons already read in the active context. Missing Lessons and ordinary deterministic local work have no Lessons prerequisite; reading creates no files.",
      "Preserve a grounded reusable insight when it can improve research, collaboration or delivery, stating its basis, conditions, counterexamples and limits. For a transferable failure, explain the mistaken premise, still-valid earlier grounds and the better approach it informs. Reuse can refute a Lesson rather than strengthen it, so assess transfer value instead of counting applications.",
      "Write in the narrowest suitable researcher-owned Lessons document within author write scope. Create a content-bearing `.dove/research/lessons/LESSONS.md` only for the first qualifying insight, not an empty index during reading. Separate a theme into a naturally named Markdown file only when useful, and update its ordinary summary link. Omit routine progress, transient status, one-off tool failures and non-transferable bugs."
    ],
    boundaries: [
      "Lessons are optional, fallible guidance, not package defaults, research evidence or completion certificates. Recording advice does not fix the current problem or replace action, and needs no IDs, frontmatter schema or application ledger."
    ]
  });
}

const SURFACES = [
  ["research", "Explore a broad candidate pool for the user's choice, or advance a confirmed mainline with substantive research."],
  ["status", "Report the current results, core evidence, blockers and active round without running new work."],
  ["source", "Find and inspect sources, verify citation identities and claims, and use the findings to improve research decisions."],
  ["experiment", "Develop and evaluate methods through fair comparisons, informative diagnostics and trustworthy result analysis."],
  ["draft", "Write or revise evidence-grounded text and deliver the authoritative manuscript through its actual build or export."],
  ["figure", "Create and inspect figures from real materials, delivering captions and editable sources with the rendered visuals."],
  ["review", "Independently review the specified current paper or inspect local artifacts, delivery readiness and returned opinions."],
  ["rebuttal", "Verify review concerns, write author responses and make evidence-backed revisions within the requested scope."],
  ["lessons", "Read or preserve reusable guidance that improves judgment without turning routine progress into a second log."],
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
