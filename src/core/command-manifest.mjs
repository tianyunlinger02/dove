import { commandOperationMetadata } from "./operation-registry.mjs";
import { DEFAULT_DOVE_RESPONSE_LANGUAGE } from "./schema.mjs";

export const PACKAGE_DOCUMENTATION_PATHS = [
  "README.md",
  "docs/README.md",
  "docs/INSTALL.md",
  "docs/USAGE.md",
  "docs/PACKAGING.md",
  "docs/CAPABILITY_MATRIX.md",
  "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"
];

export const PACKAGE_RUNTIME_PATHS = [
  "dist/index.mjs",
  "bin/dove-package.mjs",
  "mcp/dove-state-server-package.mjs",
  "scripts/doctor-mcp-probe-package.mjs",
  "scripts/dove-user-prompt-submit-package.mjs"
];

export const DEFAULT_HOST_ADAPTERS = ["opencode"];
export const PROJECT_HOST_IDS = ["opencode", "codex", "cursor", "agents", "claude"];
export const HOST_IDS = [...PROJECT_HOST_IDS];
export const DOVE_MCP_CONFIG_PATH = ".mcp.json";
export const DOVE_MCP_SERVER_NAME = "dove";
export const DOVE_CLAUDE_AMBIENT_PROJECT_PATHS = Object.freeze([
  ".claude/rules/dove.md",
  ".claude/skills/dove-intake/SKILL.md",
  ".claude/skills/dove-lessons-intake/SKILL.md",
  ".claude/settings.json"
]);
export const INSTALLED_DOVE_MCP_SERVER = Object.freeze({
  type: "stdio",
  command: "dove",
  args: Object.freeze(["mcp", "serve", "--project", "."])
});

export const HOST_DEFINITIONS = {
  opencode: { label: "OpenCode", scope: "project", jsonChecks: [".opencode.json"] },
  codex: { label: "Codex", scope: "project", jsonChecks: [] },
  cursor: { label: "Cursor", scope: "project", jsonChecks: [] },
  agents: { label: "Shared agent skills", scope: "project", jsonChecks: [] },
  claude: { label: "Claude Code", scope: "project", jsonChecks: [] }
};

export const OPENCODE_ROLE_SKILL_PATHS = [
  ".opencode/skills/dove-planner/SKILL.md",
  ".opencode/skills/dove-builder/SKILL.md",
  ".opencode/skills/dove-reviewer/SKILL.md"
];

const HOST_ADAPTER_LANGUAGE_LABEL = DEFAULT_DOVE_RESPONSE_LANGUAGE === "zh" ? "Chinese" : DEFAULT_DOVE_RESPONSE_LANGUAGE;

export const HOST_ADAPTER_POLICY = Object.freeze({
  toolAccess: Object.freeze({
    transport: "mcp-only",
    unavailable: "stop",
    cliFallback: false,
    shellFallback: false,
    directDoveStateAccess: false
  }),
  publicChannels: Object.freeze({
    present: "report-when-host-control-presentation-is-show",
    preserveVerbatim: true,
    researchHandoff: "consume-when-host-execution-needs-it",
    hostControl: "follow-mechanically-without-rendering"
  }),
  privacy: Object.freeze({
    exposePrivateProtocol: false
  }),
  language: Object.freeze({
    default: DEFAULT_DOVE_RESPONSE_LANGUAGE,
    style: "concise-senior-research-assistant"
  }),
  adapterBullets: Object.freeze([
    "Use the listed public Dove MCP tools. If they are unavailable, stop and ask the user to re-enter the project host; do not substitute CLI, shell, or direct state access.",
    "Present only the human `report` when directed. Keep machine channels internal and execute a supplied typed closure once with its binding unchanged.",
    `Respond concisely in ${HOST_ADAPTER_LANGUAGE_LABEL} by default: judgment, evidence or risk, and next action.`
  ])
});

const COMMON_CONSTRAINTS = [
  "Every command mutation except workspace initialization and the canonical project Lessons update uses an explicit mission target and writes only mission-bound artifacts with current evidence and provenance; hidden ambient intake is a separate server-owned entry operation.",
  "Validate every imported path and every referenced source, finding, experiment result, and artifact before the first write.",
  "Do not create packets, boards, runtime state, hidden schedulers, policy overrides, role permissions, lifecycle mirrors, or persistent context.",
  "Every read is zero-write and must not repair, refresh, bootstrap, or convert durable state.",
  "Keep Planner, Builder/Author, and Reviewer responsibilities separate; archived Reviewer findings remain non-authoritative and never establish identity, sign-off, acceptance, or scientific endorsement.",
  "Apply the Research Constitution locally: protect truth, safety, and evidence integrity; distinguish host return from completion and independent review; preserve failures, uncertainty, real resource facts, and claim boundaries without inventing scientific endorsement."
];

const ADAPTER_NOTES = Object.freeze({
  "dove.workspace": Object.freeze([
    "Inspect the current project briefly, state its overall situation and structure, formulate one clean concise research mainline like a paper title, and call `manage_dove_workspace` immediately. Do not show an evidence list, risk list, choices, elicitation, or confirmation."
  ]),
  "dove.mission": Object.freeze([
    "For a simple new mission, call `manage_dove_mission` directly with the concrete goal and only complete, plainly supported requirements, scope, artifacts, completion conditions, or typed evidence details.",
    "For branches or reevaluation, select the exact visible mission number from status. Keep the existing mission direction intact; use a branch for a changed task and Workspace for a changed project mainline."
  ]),
  "dove.status": Object.freeze([
    "Return `report.briefing` verbatim as the whole answer, including every heading and line break. Do not answer from another envelope field or summarize, translate, paraphrase, shorten, or reformat it. Omit the mission number for the whole workspace; include an exact visible mission number only when the user selects that mission."
  ]),
  "dove.lessons": Object.freeze([
    "Read the complete canonical Lessons document by default. For an explicit update, read first, preserve the exact machine-only binding, edit the complete Markdown under the five stable sections, and update once without creating a Mission."
  ]),
  "dove.source": Object.freeze([
    "Source is external-content research. Discover and visibly capture selected outside material with host tools before registration; a registered source remains a candidate, and public verification may reject but never trust it."
  ]),
  "dove.note": Object.freeze([
    "Note is internal-project research and synthesis. Use project files and context, but do not create a Dove note store or treat note output as evidence."
  ]),
  "dove.experience": Object.freeze([
    "Experience is experiment conception and pre-execution reasoning. Do not freeze a formal protocol or record a result; use Experiment for those writes."
  ]),
  "dove.figure": Object.freeze([
    "The host gathers materials and produces the figure. Archive only a real current project output with its caption, references, and available QA findings."
  ]),
  "dove.experiment": Object.freeze([
    "Freeze one concrete general protocol before execution. Record the full-denominator result only from current execution evidence; record any matching claim separately."
  ]),
  "dove.draft": Object.freeze([
    "The host writes or revises the substantive project draft, then archives its current project path and references."
  ]),
  "dove.review": Object.freeze([
    "Start one Review Skill Mission, freeze one explicit current artifact scope with `manage_dove_review` operation=scope, launch exactly one dedicated fresh read-only `dove-reviewer` through the host-native agent surface, wait synchronously, archive its structured return with operation=archive, then execute the original typed Review Mission closure exactly once.",
    "Keep the scope binding and launch contract inside `hostControl`; never expose them, use MCP to launch an agent, let the main host impersonate Reviewer, or fall back to an exchange."
  ]),
  "dove.rebuttal": Object.freeze([
    "Keep the substantive response and revisions author-side, preserve current finding references, and never claim independent reviewer sign-off."
  ])
});

const CALL_FLOW_CHANNEL_POLICY = Object.freeze({
  result: "Follow hostControl.presentation; render only report when shown, otherwise remain silent.",
  callback: "Use only a typed hostControl.closureRequest exactly once; never infer a callback from prose or query status to rebuild it.",
  privacy: "Never expose hostControl, researchHandoff, private state, generated identifiers, or machine-only fields."
});

const selector = (mission = "none", research = "none") => Object.freeze({ mission, research });
const step = (tool, required, instruction) => Object.freeze({ tool, required: Object.freeze(required), instruction });
const readSkillContext = () => step("query_dove_status", ["operation"], "Use operation=status to read the public workspace and lifecycle context. Select an existing work number only when the requested record or artifact identifies it exactly; otherwise ask one zero-write clarification and stop.");
const startSkill = (skill, boundary) => step("manage_dove_mission", ["operation", "skill", "goal"], `Use operation=start-skill and skill=${skill}. Refine one minimal goal from the request and current context. Command text is optional constraints; clarify only material ambiguity and do not impose a fixed template. Start one research Skill Mission before ${boundary}; an artifact-owning mission may be selected as its parent without stopping that parent. Preserve result.selector.missionNumber for every later mission-bound tool and use the supplied research outcome closure exactly once after host work.`);
const resumeSkill = (boundary) => step("query_dove_status", ["operation"], `Use operation=status and select the exact existing work number identified by the requested lifecycle record or artifact before ${boundary}. Do not call start-skill, do not guess the latest work, and ask one zero-write clarification if the owner is not unambiguous.`);
const exactReadTarget = (boundary) => step("query_dove_status", ["operation"], `Use operation=status and select the exact artifact-owning work number before ${boundary}. This phase is read-only: do not create a Skill Mission, do not guess the latest work, and ask one zero-write clarification if the artifacts do not identify one work number.`);
const mode = (id, when, steps, { clarification = [] } = {}) => Object.freeze({ id, when, steps: Object.freeze(steps), clarification: Object.freeze(clarification) });
const flow = ({ status, selectors = selector(), generatedFields = [], modes, examples }) => Object.freeze({
  status,
  selectors,
  generatedFields: Object.freeze(generatedFields),
  modes: Object.freeze(modes),
  examples: Object.freeze(examples),
  channels: CALL_FLOW_CHANNEL_POLICY
});

const COMMAND_CALL_FLOWS = Object.freeze({
  "dove.workspace": flow({
    status: "inspect-before-write",
    selectors: selector("none", "none"),
    modes: [
      mode("set-mainline", "The user invokes /dove:workspace, with or without a proposed mainline.", [
        step("query_dove_status", ["operation"], "Use operation=status to read the public Workspace state, then use normal host read-only exploration to inspect enough of the current project to briefly introduce its overall situation and structure. Do not produce evidence or risk lists and do not ask questions."),
        step("manage_dove_workspace", ["operation", "projectBrief", "mainline"], "Use operation=set-mainline. Pass one brief introduction to the project's overall situation and structure as projectBrief. Prefer an explicit user-supplied mainline; otherwise formulate one clean concise research mainline like a paper title from the inspected project. Apply it immediately. An absent Workspace is initialized; a current Workspace is replaced while internal revision history remains preserved.")
      ]),
      mode("reset", "An unsupported workspace must be explicitly archived before current records are created.", [step("manage_dove_workspace", ["operation", "mainline", "archiveReset"], "Pass operation=initialize with archiveReset=true and the selected mainline. The archive remains read-only history and is never imported into current runtime state.")])
    ],
    examples: ["set-mainline", "set-mainline"]
  }),
  "dove.mission": flow({
    status: "required-only-for-existing-work",
    selectors: selector("status-one-based-for-reevaluation", "none"),
    modes: [
      mode("create-root", "The user asks for a new bounded task under the current workspace mainline without an existing parent.", [step("manage_dove_mission", ["operation", "mode", "goal", "requirements", "assumptions", "scope", "outOfScope", "artifacts", "completionCriteria", "evidenceRequirements"], "Use operation=create-root and pass explicit mode=research only when the work changes research understanding, experiments, evidence, or paper claims; otherwise pass mode=ordinary. Keep the direct Mission contract proportional to the request and use the in-tool approval checkpoint.")]),
      mode("branch", "The user asks to continue, alter, recover, or explore an alternative from an existing mission.", [step("query_dove_status", ["operation"], "Use operation=status to read full status and select the exact visible parent mission number."), step("manage_dove_mission", ["operation", "mode", "parentMissionNumber", "branchKind", "branchReason", "goal"], "Use operation=branch and pass the direct Mission contract for the new child. Stop an active parent in the same checkpoint with stopParentReason, and list handoffArtifactPaths only when permission to update those artifacts must transfer.")]),
      mode("reevaluate-decision", "Current evidence or unconsumed research receipts require a new bounded judgment within the immutable mission contract.", [step("query_dove_status", ["operation"], "Use operation=status to read full status and select the exact visible mission number and current evidence."), step("manage_dove_mission", ["operation", "missionNumber", "requestedDisposition", "synthesis", "hypotheses", "routes", "openQuestions", "evidenceRefs", "reasonCodes", "nextAction"], "Use operation=reevaluate-research-decision. Record one current scientific judgment; Dove binds the current decision and its eligible unconsumed receipts. Authorize at most one bounded next action, and do not invent evidence or treat host execution as scientific acceptance.")], { clarification: ["Ask once if the disposition, current evidence, or bounded next action cannot be determined without inventing facts."] })
    ],
    examples: ["create-root", "reevaluate-decision"]
  }),
  "dove.status": flow({
    status: "is-the-status-call",
    selectors: selector("optional-explicit-one-based", "none"),
    modes: [mode("workspace", "The user asks for current status.", [step("query_dove_status", ["operation"], "Use operation=status. Omit missionNumber for the whole workspace; include it only when the user explicitly selected a visible work number. Return report.briefing verbatim.")])],
    examples: ["workspace", "workspace"]
  }),
  "dove.lessons": flow({
    status: "read-before-update",
    selectors: selector("none", "none"),
    modes: [
      mode("read", "Read is the default.", [step("manage_dove_lessons", ["operation"], "Use operation=read and return the complete human Markdown report. Keep the returned document control in hostControl private.")]),
      mode("update", "The user explicitly asks to preserve or revise reusable experience.", [step("manage_dove_lessons", ["operation"], "Use operation=read. Preserve the complete Markdown and exact hostControl.lessonsDocument.binding."), step("manage_dove_lessons", ["operation", "binding", "markdown"], "Use operation=update with the exact binding unchanged and the complete replacement Markdown containing the five stable sections. Create no Mission and do not treat Lessons as evidence, scientific endorsement, or completion proof.")], { clarification: ["Ask once only if the intended reusable guidance is materially ambiguous."] })
    ],
    examples: ["read", "update"]
  }),
  "dove.source": flow({
    status: "start-for-new-research-resume-for-owned-records",
    selectors: selector("exact-record-owner-or-started-skill", "none"),
    generatedFields: [{ field: "sourceId", strategy: "host-safe-stable-label", when: "register" }],
    modes: [
      mode("query", "The user asks about an existing source collection or candidate.", [resumeSkill("the source query"), step("manage_dove_sources", ["operation", "missionNumber"], "Use operation=query for the exact work that owns the requested source collection or candidate and apply only requested filters.")]),
      mode("register", "The user asks to find or register new external content.", [readSkillContext(), startSkill("source", "external discovery"), step("manage_dove_sources", ["operation", "missionNumber", "sourceId", "capturePath"], "After host-native discovery and visible capture, use operation=register for the new Skill Mission with a safe stable label and the real captured external-material path.")]),
      mode("reject", "The user explicitly rejects an existing external candidate after audit.", [resumeSkill("the source audit"), step("manage_dove_sources", ["operation", "missionNumber", "sourceId", "method", "checkedMaterial", "auditEvidence"], "Use operation=reject for the exact work that owns the candidate and record only a supported rejection; never claim positive trust.")], { clarification: ["Ask once if the candidate to reject does not identify one exact work number."] })
    ],
    examples: ["register", "reject"]
  }),
  "dove.note": flow({
    status: "start-for-new-analysis-resume-for-explicit-continuation",
    selectors: selector("start-or-exact-continuation", "none"),
    modes: [
      mode("research", "The user asks for a new bounded internal analysis.", [readSkillContext(), startSkill("note", "reading or analyzing project material with host tools")], { clarification: ["Ask once only when the intended internal research question or output is materially ambiguous."] }),
      mode("continue", "The user explicitly continues an existing bounded note analysis.", [resumeSkill("the continued internal analysis")], { clarification: ["Ask once if the continuation does not identify one exact existing analysis mission."] })
    ],
    examples: ["research", "continue"]
  }),
  "dove.experience": flow({
    status: "start-for-new-analysis-resume-for-explicit-continuation",
    selectors: selector("start-or-exact-continuation", "none"),
    modes: [
      mode("conceive", "The user asks for a new bounded experiment conception or analysis.", [readSkillContext(), startSkill("experience", "experiment conception or pre-execution reasoning with host tools")], { clarification: ["Ask once only when the experiment question or requested reasoning is materially ambiguous."] }),
      mode("continue", "The user explicitly continues an existing bounded experiment analysis.", [resumeSkill("the continued experiment reasoning")], { clarification: ["Ask once if the continuation does not identify one exact existing analysis mission."] })
    ],
    examples: ["conceive", "continue"]
  }),
  "dove.figure": flow({
    status: "host-artifact-work-then-archive",
    selectors: selector("started-skill-or-current-figure-owner", "none"),
    modes: [
      mode("new", "The user asks to gather materials, draw, or revise a real project figure.", [readSkillContext(), startSkill("figure", "gathering materials and drawing with host tools"), step("record_dove_figure", ["missionNumber", "artifactPath", "referencePaths", "caption", "qa", "findings"], "After the substantive host work, archive the exact current mission-owned project figure with its caption, references, QA, and findings. Keep the project artifact in place and do not require Review coverage.")]),
      mode("revision", "The user asks to revise an existing project figure.", [resumeSkill("the figure revision"), step("record_dove_figure", ["missionNumber", "artifactPath", "referencePaths", "caption", "qa", "findings"], "Archive the revised current project figure only after the host work and keep QA and findings non-authoritative.")])
    ],
    examples: ["new", "revision"]
  }),
  "dove.experiment": flow({
    status: "start-for-protocol-resume-for-result-and-claim",
    selectors: selector("started-skill-or-protocol-owner", "none"),
    generatedFields: [{ field: "experimentId", strategy: "host-safe-stable-label", when: "protocol" }, { field: "claimId", strategy: "host-safe-stable-label", when: "claim" }],
    modes: [
      mode("protocol", "The user asks to freeze a new formal experiment protocol.", [readSkillContext(), startSkill("experiment", "the formal protocol write"), step("record_dove_experiment", ["missionNumber", "experimentId", "protocol"], "For the new Skill Mission, generate a safe experiment label and provide the complete general protocol before execution.")]),
      mode("result", "The user asks to record the evidence-backed result for an existing frozen protocol.", [resumeSkill("the experiment result write"), step("record_dove_experiment", ["missionNumber", "experimentId", "protocol", "result"], "Use the exact protocol work number and experiment label, replay the frozen protocol unchanged, and add the status, outcome, measurements, current evidence references, full denominator, failures, deviations, and limitations from real execution evidence.")]),
      mode("claim", "The user separately asks to record evidence-backed claims from an existing experiment.", [resumeSkill("the experiment claim write"), step("record_dove_claims", ["missionNumber", "claims"], "Use the exact protocol work number, generate safe claim labels, and include only claims with current evidence lineage and exact experiment bindings.")])
    ],
    examples: ["protocol", "result"]
  }),
  "dove.draft": flow({
    status: "host-artifact-work-then-archive",
    selectors: selector("started-skill-or-current-draft-owner", "none"),
    modes: [
      mode("new", "The user asks to write a new substantive project draft.", [readSkillContext(), startSkill("draft", "drafting with host tools"), step("record_dove_draft", ["missionNumber", "artifactPath", "referencePaths", "qa", "findings"], "After substantive host writing, archive the exact current mission-owned project draft and current references. Keep the project artifact in place and do not impose a writing template.")]),
      mode("revision", "The user asks to revise an existing project draft.", [resumeSkill("the draft revision"), step("record_dove_draft", ["missionNumber", "artifactPath", "referencePaths", "qa", "findings"], "Archive the revised project draft only after substantive host work; QA and findings remain non-authoritative annotations.")])
    ],
    examples: ["new", "revision"]
  }),
  "dove.review": flow({
    status: "start-scope-native-review-archive-close",
    selectors: selector("started-review-skill-mission", "none"),
    generatedFields: [],
    modes: [
      mode("review", "The user asks for independent review of explicit project artifacts.", [
        readSkillContext(),
        startSkill("review", "independent assessment of one frozen declared artifact scope"),
        step("manage_dove_review", ["operation", "missionNumber", "reviewMissionBinding", "hostKind", "artifactPaths"], "Call operation=scope exactly once for the new Review Skill Mission. Keep its scope binding and native Reviewer launch request machine-only; scope must be zero-write. Then launch exactly one dedicated fresh read-only Dove Reviewer through that supported native host agent surface, never through MCP, wait synchronously, and accept only its structured return."),
        step("manage_dove_review", ["operation", "missionNumber", "scopeBinding", "status", "verdict", "summary", "findings", "actionItems", "report", "provenance"], "Call operation=archive exactly once with the original unchanged scope binding and the dedicated Reviewer's structured return. Then execute the original typed Review Mission closure request exactly once.")
      ], { clarification: ["Ask once only when the artifact boundary is materially ambiguous."] })
    ],
    examples: ["review"]
  }),
  "dove.rebuttal": flow({
    status: "author-side-host-work-then-archive",
    selectors: selector("started-skill-or-current-rebuttal-owner", "none"),
    modes: [
      mode("new", "The user asks for author-side rebuttal or revision work from archived findings.", [readSkillContext(), startSkill("rebuttal", "author-side rebuttal work with host tools"), step("record_dove_rebuttal", ["missionNumber", "artifactPath", "referencePaths", "qa", "findings", "findingRefs"], "After substantive host work, archive the exact current mission-owned rebuttal and preserved current findings. Findings may be non-authoritative; never mint reviewer sign-off.")]),
      mode("revision", "The user asks to revise an existing author-side rebuttal.", [resumeSkill("the rebuttal revision"), step("record_dove_rebuttal", ["missionNumber", "artifactPath", "referencePaths", "qa", "findings", "findingRefs"], "Archive the revised project rebuttal while preserving finding references and remaining uncertainty.")], { clarification: ["Ask once if the rebuttal artifact or preserved finding cannot be identified exactly."] })
    ],
    examples: ["new", "revision"]
  })
});

const surface = (id, title, category, policy, summary, operationId, constraints, ux) => ({
  id,
  title,
  domain: "generic",
  category,
  policy,
  summary,
  operationId,
  constraints: [...COMMON_CONSTRAINTS, ...constraints],
  adapterNotes: [...(ADAPTER_NOTES[id] ?? [])],
  callFlow: COMMAND_CALL_FLOWS[id],
  ux
});


const commandSurfaces = [
  surface("dove.workspace", "Dove workspace", "mutation", "guarded-mutation", "Inspect the current project, formulate or accept one concise research mainline, and replace the current Workspace mainline immediately.", "command.dove.workspace", [
    "On invocation, inspect enough of the current project to briefly introduce its overall situation and structure, then formulate one clean concise research mainline like a paper title when the user did not supply one.",
    "Do not present evidence lists, risk lists, alternatives, confirmation, or elicitation. Call the explicit Workspace mutation in the same invocation.",
    "If Workspace is absent, initialize it directly. If it is current, replace the visible current mainline directly while preserving the sealed append-only revision chain and stopping active missions bound to the prior revision.",
    "Workspace mutation is explicit-only. Ambient intake and mission operations may read or bind the current revision but must never create or revise it.",
    "Unsupported legacy or invalid state requires an explicit archive reset with no import, repair, fallback, or alias; current runtime never reads the archive."
  ], { dailyFlow: ["Inspect the current project, briefly state its overall situation and structure, and write one title-like research mainline immediately.", "Use an explicit user-supplied mainline directly, or formulate one when omitted."], targetingBehavior: "The research mainline belongs to the current project and replaces only the visible current mainline; prior revisions remain internal history.", confirmationBehavior: "No confirmation or elicitation for ordinary mainline replacement; unsupported-state archive reset retains its explicit checkpoint.", expectedOutcome: "The user sees a brief project introduction and the newly current concise research mainline, with no evidence list, risk list, or choice prompt.", examples: ["/dove:workspace", "/dove:workspace Retrieval-Augmented Evidence Integrity for Autonomous Research Workflows"] }),
  surface("dove.mission", "Dove mission", "mutation", "explicit-approval", "Create one minimal mission contract or reevaluate its current scientific decision.", "command.dove.mission", [
    "For mission creation, call manage_dove_mission directly with operation=create-root or operation=branch; never call operation=query as a preliminary preview because the creation branches already perform the zero-write preview, approval, and application.",
    "Create persists only the bounded goal, requirements, assumptions, scope, artifacts, completion conditions, evidence needs, dependencies, and explicit parent-child branch provenance.",
    "Artifact paths must be canonical workspace-relative file paths, never prose descriptions.",
    "For scientific reevaluation, select the exact one-based mission number returned by status and assess only current evidence and unconsumed research receipts.",
    "A new ResearchDecision must preserve counterevidence and unknowns; Dove automatically binds the current decision and eligible unconsumed receipts, then either authorizes one bounded next action or records a stop, reject, or user-decision disposition.",
    "Lessons are recorded only through an explicit Dove lessons request; reevaluation never creates one automatically."
  ], { dailyFlow: ["Turn one concrete goal into a minimal mission contract.", "Reevaluate the current scientific judgment after new research evidence arrives."], targetingBehavior: "Creation sends only public mission fields; Dove owns hidden storage identity. Reevaluation uses the exact one-based mission number shown by status while hidden identities remain private.", confirmationBehavior: "Approve, adjust, or cancel Mission creation. Scientific reevaluation appends directly from current evidence; a returned research handoff resumes exactly one bounded action and its supplied callback.", expectedOutcome: "One durable mission contract or one append-only ResearchDecision revision exists; a research handoff may additionally authorize one bounded host action without orchestration state.", examples: ["/dove:mission Validate the new retrieval method", "/dove:mission Reevaluate mission 2 using the latest research outcome"] }),
  surface("dove.status", "Dove status", "query", "read-only", "Read one bounded whole-workspace status projection without refreshing state.", "command.dove.status", [
    "Absent state returns needs-init; malformed, legacy, contradictory, or future state fails closed.",
    "Without a mission number, status covers the Workspace mainline, Mission graph, lifecycle, current scientific decisions, receipts, artifacts, evidence currentness, completion blockers, and archived Review currentness.",
    "Unconsumed research outcomes take priority over another execution recommendation.",
    "A one-based mission number optionally scopes detailed completion, source, domain, review, and research context without replacing the whole-workspace projection."
  ], { dailyFlow: ["Inspect the bounded whole-workspace graph and current integrity without writes.", "Use the exact one-based mission number shown by status only when detailed context for one mission is needed."], targetingBehavior: "The default is the whole workspace for zero, one, or many missions; an explicit one-based mission number adds scoped detail and never selects an implicit latest mission.", confirmationBehavior: "No confirmation is applicable because status is read-only.", expectedOutcome: "The operator sees current research understanding, evidence gaps, and the single highest-priority next step.", examples: ["/dove:status", "/dove:status Show detailed integrity for mission 2"] }),
  surface("dove.lessons", "Dove lessons", "mutation", "guarded-mutation", "Read or replace the complete canonical advisory Lessons document.", "command.dove.lessons", [
    "Default behavior is a zero-write read of the complete canonical Markdown document.",
    "Every update must follow a read, preserve its exact machine-only binding, validate the five stable sections, and replace the complete document atomically.",
    "Lessons maintenance creates no Mission, Receipt, artifact ownership, validation evidence, or completion evidence.",
    "Lessons never grant permission, establish scientific endorsement, replace current evidence checks, import transcripts, write Trellis state, or create runtime memory."
  ], { dailyFlow: ["Read the complete current Lessons document.", "For an explicit change, read first and update the complete Markdown once with the exact returned binding."], targetingBehavior: "Lessons belong to the current project rather than a Mission; no mission selector, lesson identifier, kind, scope, graph, or applicability filter exists.", confirmationBehavior: "Read is zero-write. An explicit update request authorizes one compare-and-swap document replacement without a second confirmation.", expectedOutcome: "The operator receives the current advisory Markdown or one atomic full-document update, with no Mission or evidentiary effect.", examples: ["/dove:lessons", "/dove:lessons Remember that failed cases must remain visible"] }),
  surface("dove.source", "Dove source", "mutation", "guarded-mutation", "Research external content and optionally register or reject captured source candidates.", "command.dove.source", [
    "Start a Source Skill Mission for new external discovery and registration. Query or reject an existing collection or candidate through the exact mission that owns it; a fresh external research request still starts a new Mission.",
    "Registration always creates a candidate from real captured external material; public verification is rejection-only and never marks a source trusted."
  ], { dailyFlow: ["Research external content with host-native search and visibly capture selected material before registration.", "Query, register, or reject real external source candidates when requested."], targetingBehavior: "Dove starts a Source Skill Mission from the request and current context; use its visible mission number for source records.", confirmationBehavior: "Command text is optional constraints. Clarify only material ambiguity; a clear request starts the Skill Mission before host work.", expectedOutcome: "External research is performed within a dedicated Skill Mission and any requested source record has current captured provenance.", examples: ["/dove:source Find and register a relevant public paper", "/dove:source Reject the candidate after checking the captured PDF"] }),
  surface("dove.note", "Dove note", "mutation", "guarded-mutation", "Research and synthesize internal project material without creating note state.", "command.dove.note", [
    "Start a Note Skill Mission before reading, analyzing, or synthesizing internal project material.",
    "Use project files and context as the research material; do not create a Dove note store or treat note output as evidence."
  ], { dailyFlow: ["Investigate an internal project question from current files and context.", "Synthesize project reasoning, gaps, decisions, or implications into the requested host output."], targetingBehavior: "Dove starts one Note Skill Mission from the request and current project context; no pre-existing mission selector is required.", confirmationBehavior: "Command text is optional constraints. Clarify only material ambiguity; do not impose a fixed research template.", expectedOutcome: "The requested internal-project research is completed by the host with no Dove note store or note evidence.", examples: ["/dove:note Analyze the current retrieval design", "/dove:note Synthesize the unresolved project questions"] }),
  surface("dove.experience", "Dove experience", "mutation", "guarded-mutation", "Conceive experiments and reason about them before formal protocol or result recording.", "command.dove.experience", [
    "Start an Experience Skill Mission before experiment conception, feasibility analysis, design reasoning, or pre-execution planning.",
    "Do not freeze a formal protocol or record a result; use Dove Experiment for those durable writes."
  ], { dailyFlow: ["Develop an experiment idea or compare possible designs before execution.", "Reason about feasibility, controls, measurements, risks, or interpretation without formalizing a protocol."], targetingBehavior: "Dove starts one Experience Skill Mission from the request and current project context; no pre-existing mission selector is required.", confirmationBehavior: "Command text is optional constraints. Clarify only material ambiguity; do not impose a fixed experiment template.", expectedOutcome: "The host returns bounded pre-execution experiment reasoning without a formal protocol or result write.", examples: ["/dove:experience Design an ablation strategy", "/dove:experience Assess whether this experiment can distinguish the hypotheses"] }),
  surface("dove.experiment", "Dove experiment", "mutation", "guarded-mutation", "Freeze one mission-bound experiment protocol or record its evidence-backed result.", "command.dove.experiment", [
    "A new protocol starts one Experiment Skill Mission and freezes the question, hypothesis, procedure, inputs, comparisons, metrics, success and stop conditions, constraints, and expected artifacts before execution.",
    "Its result resumes that exact protocol mission and records status, outcome, measurements, current evidence references, the full denominator, failures, deviations, and limitations without hiding unsuccessful cases.",
    "Claims are separate records; only referenced Experiment measurements are mechanically matched."
  ], { dailyFlow: ["Freeze a concrete general protocol before execution.", "Add the real full-denominator result with failures and limitations when available."], targetingBehavior: "Dove starts an Experiment Skill Mission from the request and current context; the formal record is bound to that mission.", confirmationBehavior: "Command text is optional constraints. Clarify only material ambiguity; protocol drift or evidence mismatch stops the write.", expectedOutcome: "A frozen protocol or one immutable evidence-backed result exists without scheduling execution or claiming independent acceptance.", examples: ["/dove:experiment Freeze the ablation protocol", "/dove:experiment Record the completed ablation result"] }),
  surface("dove.draft", "Dove draft", "mutation", "guarded-mutation", "Write or revise a substantive project draft and archive its current evidence-backed path.", "command.dove.draft", [
    "A new draft starts one Draft Skill Mission; revision resumes the exact mission that owns the project artifact.",
    "The host performs the writing. Dove validates the current project artifact, references, QA, and findings, then records a Receipt without copying the draft into a parallel store."
  ], { dailyFlow: ["Write or revise the requested substantive project draft from current evidence.", "Archive its current project path, references, QA, and findings."], targetingBehavior: "Dove starts a Draft Skill Mission from the request and current context; an existing draft revision uses its exact owning mission.", confirmationBehavior: "Command text is optional constraints. Clarify only material ambiguity; cross-mission, stale, or missing project artifacts stop the archive.", expectedOutcome: "The substantive project draft remains in place and has one current Receipt-backed archive reference.", examples: ["/dove:draft Write the methods section", "/dove:draft Revise the current draft from the latest evidence"] }),
  surface("dove.figure", "Dove figure", "mutation", "guarded-mutation", "Gather materials, draw a project figure, and archive it with caption and QA.", "command.dove.figure", [
    "A new figure starts one Figure Skill Mission, possibly as a child of a material owner; revision resumes the exact mission that owns the project artifact.",
    "The host performs material gathering and drawing. Dove validates the current project artifact, references, caption, QA, and findings, then records a Receipt without requiring Review coverage."
  ], { dailyFlow: ["Gather current materials and draw or revise the requested figure.", "Archive the project output with caption, references, QA, and findings."], targetingBehavior: "Dove starts a Figure Skill Mission from the request and current context; an existing figure revision uses its exact owning mission.", confirmationBehavior: "Command text is optional constraints. Clarify only material ambiguity; cross-mission, stale, or missing project artifacts stop the archive.", expectedOutcome: "The substantive project figure remains in place and has one current Receipt-backed archive reference.", examples: ["/dove:figure Draw the method overview figure", "/dove:figure Revise the current SVG and caption"] }),
  surface("dove.review", "Dove review", "mutation", "guarded-mutation", "Freeze one exact artifact scope, obtain one isolated host-native Reviewer return, and atomically archive its non-authoritative findings.", "command.dove.review", [
    "Always start one Review Skill Mission before scope. Scope is strictly zero-write and accepts only explicit normalized current self-or-ancestor mission-owned artifacts whose content matches their current Receipt fingerprints.",
    "The host launches exactly one dedicated fresh read-only synchronous `dove-reviewer` using only the machine-only launch request. MCP never launches agents, and unsupported hosts stop without fallback.",
    "Reviewer input contains only frozen declared paths and fingerprints, a concise rubric, and a structured return contract; it excludes parent transcript, Trellis material, ResearchHandoff, undeclared files, editing, rebuttal, self-fix, and nested delegation.",
    "Archive revalidates the original scope and finding links, derives the Review id internally, and atomically writes only Review JSON, Markdown report, and Receipt. An identical retry is zero-write; a changed retry fails.",
    "Every archive records that reviewer standing is not established and cannot mint identity, sign-off, acceptance, or scientific endorsement. After archive, execute the original typed Review Mission closure exactly once."
  ], { dailyFlow: ["Start the Review Skill Mission and freeze the explicit artifact scope without writes.", "Launch one dedicated native Reviewer, archive its structured return, then close the Review Mission exactly once."], targetingBehavior: "The exact new Review Skill Mission may read only explicitly declared current artifacts owned by itself or an ancestor.", confirmationBehavior: "Command text is optional constraints. Clarify only material artifact-scope ambiguity; unsupported reviewer hosts and stale scopes fail closed.", expectedOutcome: "One immutable current non-authoritative Review record and report exist for the frozen artifact fingerprints, with no exchange or coverage state.", examples: ["/dove:review Review the current methods and results artifacts"] }),
  surface("dove.rebuttal", "Dove rebuttal", "mutation", "guarded-mutation", "Analyze findings, revise project artifacts, and archive an author-side response.", "command.dove.rebuttal", [
    "A new response starts one Rebuttal Skill Mission from current archived findings; revision resumes the exact mission that owns the response artifact.",
    "The host performs the analysis, revision, and writing. Dove validates the current response artifact, references, QA, findings, and preserved finding references, then records a Receipt without claiming Reviewer agreement."
  ], { dailyFlow: ["Analyze current findings and make the requested author-side revisions.", "Archive the project response with preserved finding references and remaining uncertainty."], targetingBehavior: "Dove starts a Rebuttal Skill Mission from the request and current context; an existing response revision uses its exact owning mission.", confirmationBehavior: "Command text is optional constraints. Clarify only material ambiguity; unsupported or stale finding references stop the archive.", expectedOutcome: "The author-side response remains in the project with one current Receipt-backed archive reference and no reviewer sign-off claim.", examples: ["/dove:rebuttal Address the archived reviewer findings", "/dove:rebuttal Revise the response with current evidence"] })
];

export const COMMAND_SURFACES = commandSurfaces.map((command) => {
  const metadata = commandOperationMetadata(command.operationId);
  return { ...command, ...metadata };
});

export const COMMAND_SURFACE_BY_ID = Object.fromEntries(COMMAND_SURFACES.map((item) => [item.id, item]));

export function commandIdToSlug(commandId) {
  return commandId.replace(/^dove\./u, "");
}

export function hostCommandSlug(commandId) {
  return commandIdToSlug(commandId).replace(/\./gu, "-");
}

export function adapterPathForCommand(hostId, command) {
  const commandId = typeof command === "string" ? command : command.id;
  const hostSlug = hostCommandSlug(commandId);
  switch (hostId) {
    case "opencode": return `.opencode/commands/${commandId}.md`;
    case "cursor": return `.cursor/commands/dove-${hostSlug}.md`;
    case "codex": return `.codex/skills/dove-${hostSlug}/SKILL.md`;
    case "agents": return `.agents/skills/dove-${hostSlug}/SKILL.md`;
    case "claude": return `.claude/commands/dove/${hostSlug}.md`;
    default: throw new Error(`Unknown host adapter: ${hostId}`);
  }
}

export function commandAdapterPathsForHost(hostId) {
  return COMMAND_SURFACES.map((command) => adapterPathForCommand(hostId, command));
}

export function allGeneratedCommandAdapterPaths() {
  return PROJECT_HOST_IDS.flatMap(commandAdapterPathsForHost);
}

export const HOST_ADAPTERS = Object.fromEntries(PROJECT_HOST_IDS.map((hostId) => {
  const commandPaths = commandAdapterPathsForHost(hostId);
  const extraPaths = hostId === "opencode" ? [...OPENCODE_ROLE_SKILL_PATHS, ".opencode.json"] : hostId === "agents" ? ["AGENTS.md"] : [];
  return [hostId, { label: HOST_DEFINITIONS[hostId].label, paths: [...commandPaths, ...extraPaths], requiredPaths: [...commandPaths, ...extraPaths], jsonChecks: HOST_DEFINITIONS[hostId].jsonChecks }];
}));

const RETIRED_COMMAND_SLUGS = Object.freeze([
  "init", "version", "auto", "operator", "review-loop", "orchestrate", "plan", "checklist", "audit", "autonomy-operate", "return",
  "follow-through", "governance-audit", "onboard", "launch", "approvals", "kill", "planner", "builder", "reviewer"
]);
const RETIRED_OPENCODE_ROLE_SKILLS = Object.freeze([
  "dove-pipeline", "dove-researcher", "dove-rebuttal-strategist", "dove-experiment-planning", "dove-version-analyst",
  "dove-claim-gate", "dove-citation-discipline", "dove-rebuttal", "dove-review-loop"
]);

export const CURRENT_MANAGED_PATHS = Object.freeze({
  core: Object.freeze([...PACKAGE_RUNTIME_PATHS]),
  opencode: Object.freeze([...HOST_ADAPTERS.opencode.paths]),
  codex: Object.freeze([...HOST_ADAPTERS.codex.paths]),
  cursor: Object.freeze([...HOST_ADAPTERS.cursor.paths]),
  agents: Object.freeze([...HOST_ADAPTERS.agents.paths]),
  claude: Object.freeze([...commandAdapterPathsForHost("claude"), ...DOVE_CLAUDE_AMBIENT_PROJECT_PATHS])
});

export const RETIRED_MANAGED_PATHS = Object.freeze({
  opencode: Object.freeze([
    ...RETIRED_COMMAND_SLUGS.map((slug) => `.opencode/commands/dove.${slug}.md`),
    ".opencode/commands/dove.paper.experiment.md",
    ".opencode/commands/dove.paper.figure.md",
    ".opencode/commands/dove.paper.version.md",
    ...RETIRED_OPENCODE_ROLE_SKILLS.map((skill) => `.opencode/skills/${skill}/SKILL.md`)
  ]),
  codex: Object.freeze([
    ...RETIRED_COMMAND_SLUGS.flatMap((slug) => [`.codex/skills/dove-${slug}/SKILL.md`, `.codex/skills/dove-${slug}`]),
    ".codex/skills/dove-paper-approvals/SKILL.md",
    ".codex/skills/dove-paper-approvals"
  ]),
  cursor: Object.freeze(RETIRED_COMMAND_SLUGS.map((slug) => `.cursor/commands/dove-${slug}.md`)),
  agents: Object.freeze([
    ...RETIRED_COMMAND_SLUGS.flatMap((slug) => [`.agents/skills/dove-${slug}/SKILL.md`, `.agents/skills/dove-${slug}`]),
    ".agents/skills/dove-paper-orchestrate/SKILL.md",
    ".agents/skills/dove-paper-orchestrate"
  ]),
  claude: Object.freeze([
    ...RETIRED_COMMAND_SLUGS.map((slug) => `.claude/commands/dove/${slug}.md`),
    ".claude/commands/dove/paper/draft.md"
  ])
});

export const MANAGED_PACKAGE_PATHS = Object.freeze([
  ...CURRENT_MANAGED_PATHS.opencode,
  ...CURRENT_MANAGED_PATHS.codex,
  ...CURRENT_MANAGED_PATHS.cursor,
  ...CURRENT_MANAGED_PATHS.agents,
  ...commandAdapterPathsForHost("claude"),
  ...CURRENT_MANAGED_PATHS.core,
  ...PACKAGE_DOCUMENTATION_PATHS
]);
