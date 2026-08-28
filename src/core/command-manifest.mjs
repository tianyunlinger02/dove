import {
  DOVE_RESEARCH_ACTION_LENS_FRAME,
  DOVE_RESEARCH_ADVANCE,
  DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY,
  DOVE_RESEARCH_AUTO_CYCLE,
  DOVE_RESEARCH_AUTO_GOAL_CONTEXT,
  DOVE_RESEARCH_AUTO_INNER_ROUNDS,
  DOVE_RESEARCH_AUTO_NOT_MECHANICAL_SKILLS,
  DOVE_RESEARCH_AUTO_OUTER_SESSION,
  DOVE_RESEARCH_AUTO_OUTER_STOP,
  DOVE_RESEARCH_AUTO_REPORTING_BOUNDARY,
  DOVE_RESEARCH_AUTO_RESEARCH_PRIORITY,
  DOVE_RESEARCH_AUTO_REVIEW_FINDING_ABSORPTION,
  DOVE_RESEARCH_CAPABILITY_RESPONSIBILITY,
  DOVE_RESEARCH_CAPSULE_BULLETS,
  DOVE_RESEARCH_EVIDENCE_STATE,
  DOVE_RESEARCH_FIGURE_CAPABILITY_BOUNDARY,
  DOVE_RESEARCH_FIGURE_EVIDENCE_BOUNDARY,
  DOVE_RESEARCH_FRAME,
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
  DOVE_RESEARCH_REVIEW_VERSION_CURRENCY,
  DOVE_RESEARCH_SKILL_INVENTORY_TEXT,
  DOVE_RESEARCH_SPECIALIZED_CAPSULE_BULLETS,
  DOVE_RESEARCH_SUPPORT_SUBORDINATION_BOUNDARY
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

const commonClarification = ["Ask only when a material ambiguity blocks the work; otherwise continue with a reasonable interpretation."];

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

function capabilityContract(options) {
  const contract = {
    purpose: options.purpose,
    when: options.when,
    responsibilities: options.responsibilities ?? [],
    actions: options.actions ?? [],
    boundaries: options.boundaries ?? [],
    nonGoals: options.nonGoals ?? [],
    clarification: options.clarification ?? commonClarification,
    hostGuidance: options.hostGuidance ?? hostGuidance()
  };
  if (options.semanticSections) contract.semanticSections = options.semanticSections;
  return contract;
}

function contract(slug) {
  if (slug === "research") return capabilityContract({
    purpose: "Complete one bounded pass of research framing, investigation, synthesis, or project work that advances a real judgment or requested artifact without becoming Auto.",
    when: "Use when the user requests one bounded pass rather than explicit multi-round autonomy.",
    responsibilities: [
      `${RESEARCH_FRAME} ${RESEARCH_HUNCH}`,
      "Use existing Dove research context only when it materially helps the bounded goal; otherwise work from the user's request and real project materials.",
      `Produce the requested analysis or artifact, advance a real judgment or eliminate a serious candidate, and stop at the bounded deliverable. ${JUDGMENT_BOUNDARY}`
    ],
    actions: [
      readArea("missions", "the bounded research goal"),
      relevantLessons,
      action("project-exploration", `Inspect the ordinary project materials and real external resources needed to understand the question. ${RESEARCH_FRAME} ${RESEARCH_HUNCH}`, { readOnly: true }),
      action("research-work", `Complete the bounded research or project work. ${RESEARCH_ADVANCE}`),
      maintainArea("missions", "When the maintenance trigger is met, update an existing Mission document or create one naturally named Mission document for the bounded goal, substantive work, current conclusion, and useful next branches.")
    ],
    boundaries: [
      "Research may read, write, edit, run, or validate ordinary project artifacts only to the proportionate extent needed for the bounded deliverable.",
      `Maintain Dove research Markdown only when ${RESEARCH_MAINTENANCE_TRIGGER}.`
    ],
    nonGoals: [
      "Do not turn a bounded Research pass into Auto or an internal stage pipeline.",
      "Do not create a Mission document merely to prove the Skill ran."
    ]
  });
  if (slug === "auto") {
    const mainlineReadAction = readResearchDocuments("Read only the context needed to confirm the Workspace mainline and current uncertainty: `.dove/research/RESEARCH.md` when present, directly relevant linked notes, the current conversation, and actual project artifacts. For submission work, identify the authoritative manuscript source and build path before editing. When independent review context is relevant, read only explicit handoff records, Reviewer returns, clarifications, rebuttals, and change notes, not private Reviewer transcripts. Treat a `/dove:auto` suffix as the immediate in-scope goal; without a suffix, use the confirmed mainline's completion condition. If the mainline is not confirmed or a material boundary would change, ask.");
    const scientificWorkAction = action("autonomous-research-work", "Choose and perform the next useful author-side mainline action with approved host tools, then reassess contribution sufficiency, evidence, and authoritative artifact state. Use Direct Scientific Review self-check, Figure, Source, Experiment, Draft, Rebuttal, independent Reviewer handoff, or other capabilities only when they materially improve that action; absorb, reject with evidence, clarify, or convert Review and figure findings into direct Dove action. For submission work, edit through the authoritative LaTeX source and compiled output by default; use another format only after verifying that the venue does not provide or accept LaTeX. Do not treat a capability, recommendation, checklist, validation, generated file, Markdown update, or Mission completion as the objective.");
    const independentReviewerAction = action("independent-reviewer-handoff", "When author-side Dove judges the current full submission ready for independent review, prepare a frozen handoff and call a genuinely isolated host Agent context if the host provides one. Start a fresh Reviewer context for the first round, resume the same Reviewer context for later rounds, give it only the listed materials, and ask for a read-only whole-paper scientific acceptability recommendation with delivery readiness reported separately. If the host lacks true isolation, state that boundary and do not substitute same-context review.");
    const supportMaintenanceAction = updateResearchDocuments("Maintain only the narrowest document when the result changes the mainline, conclusion, decision, priority, or durable recovery context. This supports choosing and performing the next action; it is never Auto's required endpoint.", { persistencePolicy: "auto-subordinate" });
    const semanticSections = [
      {
        title: "Outer session",
        purpose: DOVE_RESEARCH_AUTO_OUTER_SESSION,
        responsibilities: [
          DOVE_RESEARCH_AUTO_GOAL_CONTEXT,
          DOVE_RESEARCH_MAINLINE
        ],
        actions: [mainlineReadAction],
        boundaries: [
          "Host waiting support may assist a real wait, but must not become a Dove daemon, scheduler, queue, package-owned runtime, state store, or background Auto."
        ]
      },
      {
        title: "Inner scientific rounds",
        purpose: DOVE_RESEARCH_AUTO_INNER_ROUNDS,
        responsibilities: [
          DOVE_RESEARCH_AUTO_CYCLE,
          DOVE_RESEARCH_EVIDENCE_STATE,
          DOVE_RESEARCH_ACTION_LENS_FRAME
        ],
        actions: [scientificWorkAction],
        boundaries: [
          DOVE_RESEARCH_AUTO_REPORTING_BOUNDARY,
          "Review, testing, validation, checkpointing, generated files, Markdown maintenance, and a single Mission completion are evidence only; none is an Auto stop fact by itself."
        ]
      },
      {
        title: "Research priority and scientific writing",
        purpose: DOVE_RESEARCH_AUTO_RESEARCH_PRIORITY,
        responsibilities: [
          DOVE_RESEARCH_MANUSCRIPT_READINESS_BASIS,
          "When contribution is weak, diagnose the limiting deficiency as method, evidence, experiment or analysis, source or positioning, writing or argument, or delivery artifact. Treat scientific writing as part of the argument: revise claims, paper structure, explanations, tables, captions, and manuscript text when that is the material way to make supported science legible."
        ],
        boundaries: [
          DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY
        ]
      },
      {
        title: "Review absorption",
        purpose: DOVE_RESEARCH_AUTO_REVIEW_FINDING_ABSORPTION,
        responsibilities: [
          DOVE_RESEARCH_MANUSCRIPT_REVIEW_CAPABILITY,
          DOVE_RESEARCH_MANUSCRIPT_REVIEW_LOOP,
          "Use Direct Scientific Review self-check when a fresh author-side adversarial judgment can change the next action; use Conditional Delivery Review only when delivery is explicitly requested or truly limiting after the science and argument are sufficiently supported."
        ]
      },
      {
        title: "Independent Reviewer Handoff",
        purpose: DOVE_RESEARCH_REVIEW_DUAL_COMPLETION,
        responsibilities: [
          DOVE_RESEARCH_REVIEW_ISOLATED_PERSISTENT,
          DOVE_RESEARCH_REVIEW_FROZEN_HANDOFF,
          DOVE_RESEARCH_REVIEW_NEGATIVE_CONTINUITY,
          DOVE_RESEARCH_REVIEW_VERSION_CURRENCY
        ],
        actions: [independentReviewerAction],
        boundaries: [
          DOVE_RESEARCH_REVIEW_ANTI_GAMING,
          DOVE_RESEARCH_REVIEW_NO_INDEPENDENT_STATUS_CLAIM
        ]
      },
      {
        title: "Support and host boundaries",
        purpose: DOVE_RESEARCH_SUPPORT_SUBORDINATION_BOUNDARY,
        responsibilities: [
          DOVE_RESEARCH_CAPABILITY_RESPONSIBILITY,
          DOVE_RESEARCH_AUTO_NOT_MECHANICAL_SKILLS
        ],
        actions: [supportMaintenanceAction],
        boundaries: [
          "For real long-running host work, preserve terminal success, failure, crash, timeout, OOM, cancellation, or missing-output facts and return to mainline judgment."
        ]
      },
      {
        title: "Outer stop",
        purpose: DOVE_RESEARCH_AUTO_OUTER_STOP,
        responsibilities: [
          DOVE_RESEARCH_OUTCOME_CONTINUATION
        ],
        nonGoals: [
          "Do not traverse Skills mechanically, force a mandatory action order, reduce contribution judgment to numbers, or end because a familiar surface artifact exists.",
          "Do not delegate author-side self-check or research judgment to helper subagents. Independent review is a distinct frozen handoff to a genuinely isolated host Reviewer context, not another author-side Dove role.",
          "Do not let research-document maintenance, generated exports, or validation reports replace direct work on evidence, methods, experiments, analysis, authoritative manuscript source, figures, captions, tables, supplements, highlights, or venue-facing artifacts."
        ]
      }
    ];
    return capabilityContract({
      purpose: "Conduct explicit foreground multi-round work that advances the user-confirmed Workspace mainline within the user's limits.",
      when: "Use only when the user explicitly invokes `/dove:auto` or otherwise explicitly requests multi-round autonomous work on the confirmed Workspace mainline or an immediate in-scope goal.",
      responsibilities: sectionItems(semanticSections, "responsibilities"),
      actions: sectionItems(semanticSections, "actions"),
      boundaries: sectionItems(semanticSections, "boundaries"),
      nonGoals: sectionItems(semanticSections, "nonGoals"),
      semanticSections,
      hostGuidance: hostGuidance({
        common: ["If host or context interruption prevents finishing the current action, preserve the last reliable evidence, unfinished action, and next concrete action in natural language; treat that as operational interruption, not completion or a material blocker."],
        claude: ["When Claude Code exposes background or monitoring support for a real long-running command, compilation, experiment, or external wait, use it conditionally and reassess after success, failure, crash, timeout, OOM, cancellation, or missing output.", "When independent review is needed and Claude Code exposes a truly independent Agent context, start or resume that isolated Reviewer with only the frozen handoff materials; otherwise report that independent review is unavailable rather than using the author context."],
        dsh: ["If DSH lacks a real waiting or monitoring affordance for a long action, say so honestly and preserve the continuation point rather than promising Monitor, Cron, tmux, or a background Dove run.", "Use an isolated persistent Reviewer context in DSH only if DSH actually provides an equivalent capability; otherwise report the boundary and do not simulate independence."]
      })
    });
  }
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
    when: "Use when the user requests source discovery, reading, comparison, verification, or source-backed positioning.",
    responsibilities: [
      "Ground source work in the user's source question and current project need, not in a fixed provider order or paper count.",
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
      "Do not create source IDs, source databases, trust scores, or research hashes."
    ]
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
    const reviewGroundingAction = action("review-grounding", "For Direct Scientific Review self-check or independent Reviewer handoff preparation, inspect the actual manuscript or declared artifacts, infer the target venue and submission stage, and ask if an unclear venue would materially change the review. Use official venue sources for applicable formal requirements and a small, discriminating set of actually inspected published work for novelty, positioning, evidence norms, experiment presentation, and reader expectations. Distinguish material merely found from material retrieved, inspected, and used. For returned-review import or ordinary context inspection, do not trigger venue or paper search merely because Review was invoked.", { readOnly: true });
    const reviewerPerspectiveAction = action("reviewer-perspective-work", "Perform Direct Scientific Review self-check in the current Dove run; do not call the Agent tool or launch helper subagents. From the established grounding, test contribution, novelty, claims, evidence, method, experiment conditions, limitations, writing clarity, likely reader confusion, and material figure evidence jobs across the current full paper. Return concrete findings with evidence, consequence or effect on the goal, useful response, and a natural-language scientific acceptability recommendation; keep delivery readiness separate. Mark the critique as advisory author-side reviewer perspective, not independent external review, independent Reviewer status, or authority over Auto. Direct Review returns the critique; it does not itself authorize author-side artifact changes and cannot satisfy final independent review.", { readOnly: true });
    const deliveryReviewAction = action("delivery-review", "When delivery review is selected, inspect official venue requirements, build output, required materials, formatting, anonymity, packaging, and access limits. Report delivery readiness separately from scientific acceptability.");
    const reviewHandoffAction = action("review-handoff", "When preparing an independent Reviewer handoff, assemble only frozen materials for the current full-paper review: current full paper, authoritative LaTeX source and actual compiled output, explicit evidence or supplements, public venue requirements, necessary public related work, and explicit rebuttal, clarification, or change notes. Start a fresh genuinely isolated host Agent context for the first round and resume that same Reviewer's context for later rounds when the host actually provides isolation and persistence; otherwise report the boundary. The Reviewer is read-only and returns a natural-language whole-paper recommendation with scientific acceptability and delivery readiness separated.");
    const reviewMaintenanceAction = maintainArea("reviews", "When the user supplies an actual Reviewer return, clarification, rebuttal exchange, or asks to preserve a Direct Scientific Review self-check or independent handoff record, append it faithfully to the corresponding Review document with a clear boundary from existing text. Do not rewrite, summarize over, normalize, or replace the original return; add author interpretation only when the user asks.");
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
        title: "Direct Scientific Review self-check",
        purpose: DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC,
        responsibilities: [
          DOVE_RESEARCH_MANUSCRIPT_REVIEW_BOUNDARY,
          "Perform grounding and critique directly in the current Dove run as author-side self-check; a separate Reviewer must be a genuinely isolated host context with only frozen handoff materials."
        ],
        actions: [
          reviewGroundingAction,
          reviewerPerspectiveAction
        ],
        boundaries: [
          "Direct Review may read, search, and inspect the current full paper and critique it, but it does not modify author-side manuscript, experiment, implementation, build, delivery, or Review-return artifacts. Preserving a requested critique or returned review belongs to the separate maintenance/import action; author response, revision, or follow-up execution belongs to Rebuttal, Draft, Experiment, Figure, or explicit Auto.",
          "Direct Review may give an author-side acceptability recommendation, but it does not claim independent external review, independent Reviewer status, external acceptance, scientific certification, or authority over the Workspace mainline."
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
        title: "Independent Reviewer Handoff",
        purpose: DOVE_RESEARCH_REVIEW_DUAL_COMPLETION,
        responsibilities: [
          DOVE_RESEARCH_REVIEW_ISOLATED_PERSISTENT,
          DOVE_RESEARCH_REVIEW_FROZEN_HANDOFF,
          DOVE_RESEARCH_REVIEW_NEGATIVE_CONTINUITY,
          DOVE_RESEARCH_REVIEW_VERSION_CURRENCY
        ],
        actions: [
          reviewHandoffAction
        ],
        boundaries: [
          DOVE_RESEARCH_REVIEW_ANTI_GAMING,
          DOVE_RESEARCH_REVIEW_NO_INDEPENDENT_STATUS_CLAIM
        ]
      },
      {
        title: "Returned Review Import",
        purpose: "Faithfully preserve a returned review in the corresponding Review document.",
        responsibilities: [
          "Append the actual reviewer return faithfully with a clear boundary from existing text; do not rewrite, summarize over, normalize, or invent severity, finding IDs, strict schema, or acceptance status."
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
        purpose: "Review findings are advisory evidence for the caller. Auto must absorb them into its next scientific judgment; ordinary author-side response or revision belongs to Rebuttal, Draft, Experiment, Figure, or another explicitly requested capability.",
        responsibilities: [
          "Return findings with enough evidence and consequence for the caller to act on, reject with inspected evidence, bound or block on a real limit, or deliberately defer because another mainline action is more material."
        ],
        boundaries: [
          "Review itself ends after the selected critique, delivery inspection, handoff, import, or context report. It does not continue as author-side execution unless the user explicitly invoked Auto or requested another bounded work capability."
        ],
        nonGoals: [
          "Do not turn a Review finding, report, or recommendation into authority over the Workspace mainline or an implicit Auto session."
        ]
      }
    ];
    return capabilityContract({
      purpose: "Use one Review mode: direct scientific self-check, conditional delivery review, independent Reviewer handoff, returned-review import, or context inspection.",
      when: "Use when the user requests reviewer-perspective critique, delivery review, independent Reviewer handoff preparation, returned-review import, or review-context inspection.",
      responsibilities: sectionItems(semanticSections, "responsibilities"),
      actions: sectionItems(semanticSections, "actions"),
      boundaries: sectionItems(semanticSections, "boundaries"),
      nonGoals: sectionItems(semanticSections, "nonGoals"),
      semanticSections,
      hostGuidance: hostGuidance({
        claude: ["For independent Reviewer Handoff, use a true isolated Claude Code Agent context only if the host actually provides it; preserve that Reviewer context across re-review rounds and give it only the frozen handoff materials. If unavailable, report the boundary rather than using the author context."],
        dsh: ["Use DSH for independent Reviewer Handoff only if it actually provides equivalent isolated persistent Agent context; otherwise report the boundary and do not simulate independence."]
      })
    });
  }
  if (slug === "rebuttal") return capabilityContract({
    purpose: "Analyze review findings, draft author-side responses, and make requested evidence-backed revisions.",
    when: "Use when the user requests author-side rebuttal, response, revision, or follow-up work from review findings.",
    responsibilities: [
      "Treat Rebuttal as current-Dove author-side work: analyze each material finding against evidence, decide whether to accept, reject, qualify, or investigate it, and revise artifacts when that is the useful response.",
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
      "Do not turn Lessons into a database, frontmatter schema, application ledger, or Auto completion record.",
      "Do not treat Lessons as evidence that a current research claim or artifact is correct."
    ]
  });
}

const SURFACES = [
  ["research", "Complete one bounded pass of research, synthesis, or project investigation."],
  ["status", "Read the research overview, relevant summaries, and necessary linked context without writes."],
  ["source", "Discover, retrieve when available, read, verify, and document useful sources that materially inform the research."],
  ["experiment", "Design, analyze, record, or explicitly execute an experiment that advances a research decision."],
  ["draft", "Draft, assess, or revise ordinary project text and artifacts from the available evidence."],
  ["figure", "Inspect or gather real materials, then create, revise, validate, or caption figures when requested."],
  ["review", "Use one Review mode: direct self-check, delivery review, independent Reviewer Handoff, import, or context inspection."],
  ["rebuttal", "Analyze review findings, draft author-side responses, and make requested evidence-backed revisions."],
  ["lessons", "Read advisory Lessons or maintain researcher-owned project Lessons when explicitly asked."],
  ["auto", "Explicit foreground multi-round work on the user-confirmed Workspace mainline, including author-side self-check and independent Reviewer Handoff when needed."]
];

export const DOVE_COMMAND_SKILL_INVENTORY_TEXT = DOVE_RESEARCH_SKILL_INVENTORY_TEXT;

export const COMMAND_SURFACES = SURFACES.map(([slug, summary]) => ({
  id: `dove.${slug}`,
  title: `Dove ${slug}`,
  summary,
  requiredTools: [],
  contract: contract(slug),
  adapterCapsuleBullets: ["auto", "review"].includes(slug) ? DOVE_RESEARCH_SPECIALIZED_CAPSULE_BULLETS : undefined,
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
