// src/core/schema.mjs
import crypto from "node:crypto";

// src/core/command-manifest.mjs
var CORE_INSTALL_PATHS = [
  "README.md",
  "docs/README.md",
  "docs/INSTALL.md",
  "docs/USAGE.md",
  "docs/PACKAGING.md",
  "docs/CAPABILITY_MATRIX.md",
  "dist/index.mjs",
  "bin/dove-package.mjs",
  "mcp/dove-state-server-package.mjs",
  "scripts/doctor-mcp-probe-package.mjs"
];
var DEFAULT_HOST_ADAPTERS = ["opencode"];
var PROJECT_HOST_IDS = ["opencode", "codex", "cursor", "agents"];
var USER_HOST_IDS = ["claude"];
var HOST_IDS = [...PROJECT_HOST_IDS, ...USER_HOST_IDS];
var HOST_DEFINITIONS = {
  opencode: { label: "OpenCode", scope: "project", jsonChecks: [".opencode.json"] },
  codex: { label: "Codex", scope: "project", jsonChecks: [] },
  cursor: { label: "Cursor", scope: "project", jsonChecks: [] },
  agents: { label: "Shared agent skills", scope: "project", jsonChecks: [] },
  claude: { label: "Claude Code user commands", scope: "user", jsonChecks: [] }
};
var MANAGED_HOST_ADAPTER_PATHS = {
  opencode: [".opencode/commands/dove*.md", ".opencode/skills/dove-*", ".opencode.json"],
  codex: [".codex/skills/dove-*"],
  cursor: [".cursor/commands/dove-*.md"],
  agents: [".agents/skills/dove-*", "AGENTS.md"]
};
var MANAGED_PACKAGE_PATHS = [
  ".opencode/commands/dove*.md",
  ".opencode/skills/dove-*",
  ".opencode.json",
  ".codex/skills/dove-*",
  ".cursor/commands/dove-*.md",
  ".agents/skills/dove-*",
  "AGENTS.md",
  ...CORE_INSTALL_PATHS
];
var OPENCODE_ROLE_SKILL_PATHS = [
  ".opencode/skills/dove-pipeline/SKILL.md",
  ".opencode/skills/dove-planner/SKILL.md",
  ".opencode/skills/dove-builder/SKILL.md",
  ".opencode/skills/dove-researcher/SKILL.md",
  ".opencode/skills/dove-reviewer/SKILL.md",
  ".opencode/skills/dove-rebuttal-strategist/SKILL.md",
  ".opencode/skills/dove-experiment-planning/SKILL.md",
  ".opencode/skills/dove-version-analyst/SKILL.md",
  ".opencode/skills/dove-claim-gate/SKILL.md",
  ".opencode/skills/dove-review-loop/SKILL.md",
  ".opencode/skills/dove-citation-discipline/SKILL.md",
  ".opencode/skills/dove-rebuttal/SKILL.md"
];
var TASK_SCOPED_WRITE_TOOL_IDS = /* @__PURE__ */ new Set([
  "update_research_brief",
  "register_source",
  "upsert_note",
  "upsert_claims",
  "upsert_plan",
  "upsert_outline",
  "upsert_draft",
  "set_section_status",
  "upsert_figure_plan",
  "run_figure_workflow",
  "record_dove_mission_pass",
  "run_experience_workflow",
  "run_audio_review",
  "run_dove_review_loop",
  "prepare_figure_generation",
  "import_figure_generation",
  "build_rebuttal",
  "append_review_log",
  "run_review_loop",
  "prepare_isolated_review",
  "import_isolated_review",
  "upsert_revision_plan",
  "normalize_rebuttal_issues",
  "build_rebuttal_strategy",
  "upsert_experiment_plan",
  "upsert_experiment_result",
  "run_experiment_audit",
  "bridge_result_to_claim",
  "create_version_snapshot",
  "compare_versions"
]);
var TASK_SCOPED_WRITE_CONSTRAINTS = [
  "Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.",
  "If no explicit packetId, natural-language target, or linked artifact is supplied and more than one packet candidate exists, stop and use confirmation UX before writing.",
  "If target resolution is ambiguous or multiple candidates share the top confidence, use confirmation UX to select a packet; `.dove/state.json.settings.taskTargetResolution.autoSelect` may only select a unique high-confidence candidate.",
  "Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets."
];
var AGENT_WORKFLOW_CONSTRAINTS = [
  "Use status first only for Dove state, next-step, blocker, task-choice, or task-binding questions; for fix, implement, research, verify, write, review, experiment, or figure prompts, start by producing or inspecting substantive material and use status only as supporting context.",
  "For ordinary prompts that ask to bind, save, deposit, archive, or \u6C89\u6DC0 results to a main task, resolve the durable packet first, register external URLs/templates/guidelines as packet-bound sources, then synthesize internal findings through `upsert_note` or `record_document_evidence` instead of treating the synthesis as an external source.",
  "When reporting research or venue results, separate snapshot-backed or registered sources from candidate links, blocked retrieval candidates, and internal notes/documents; do not put unverified candidates under a generic `Sources:` list.",
  "When work depends on current external information, public web material, provider/tool documentation, scholarly discovery, venue policy, or ecosystem behavior, run a visible bounded search or retrieval step first; use Dove's read-only public no-key network search tools when available, and treat returned items as candidates until verified.",
  "Do not let durable packets, status navigation, receipts, validators, or evidence ledgers substitute for real progress; before bookkeeping, produce or inspect a substantive artifact such as literature synthesis, experiment execution, baseline analysis, result interpretation, claim stress test, draft content, review finding, or code/test evidence.",
  "Treat `preActionGuidance` as read-only guidance that automatically recalls applicable lessons from `.dove/meta/operator-lessons.json`; recording lessons remains explicit through `/dove:lessons` and `record_operator_lesson` only.",
  "Frame work through Planner, Builder, and Reviewer primary roles; researcher, experiment-planner, revision-lead, rebuttal-lead, version-analyst, and review-loop are subagents/modes under those roles, not public slash surfaces.",
  "Planner output must be executable: every new or plan-derived mission needs canonical `executionContract.action`, `implementation`, `convergence.criteria`, and `failureRoutes`; do not invent substitute child missions or infer child work from the parent title when explicit child mission details are missing.",
  "Builder completion requires a result summary plus real evidence/artifact/validation/verification paths and `verifiedCriteria` that covers every `executionContract.convergence.criteria` item; read-only status, summary-only output, or unknown step status must not mark work complete.",
  "Reviewer and audit work may inspect evidence and record explicit review state, but must stay read-only with respect to Builder outputs unless an operator explicitly asks to record review/revision artifacts.",
  "Treat status as the project command center and mission as a durable work contract/progress object; rank missing executable contracts, missing source/material inputs, ready Builder execution, verification gaps, reviewer/audit needs, and reconciliation above optional mission details.",
  'Dove `.dove/` durable state participates in host rollback only through host-tracked file edits: request `mutationMode: "patch-plan"`, inspect the returned operations, and apply them with the host\'s tracked file-edit mechanism. Direct CLI/MCP `direct-process` writes remain functional but rollback-unverified; git presence is not proof, and host rollback must not be routed through `reset_dove_version`.',
  "Never create hidden runtime, scheduler, daemon, background continuation, or unconfirmed writes; auto/operator/mission execution remains explicit bounded foreground work."
];
var COMMAND_SURFACES_BASE = [
  {
    id: "dove.init",
    title: "Dove init",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Create or update the single project-level Dove goal as the unique level-0 task.",
    requiredTools: ["init_dove_goal"],
    constraints: ["There is exactly one level-0 init task; update it instead of creating a second root.", "Use init only for the global project goal, then route concrete work through `/dove:mission` or `/dove:auto`."]
  },
  {
    id: "dove.mission",
    title: "Dove mission",
    domain: "generic",
    category: "mutation",
    policy: "explicit-approval",
    summary: "Convert a user demand into a confirmable Dove task contract, then hand off to the recommended next workflow.",
    requiredTools: ["create_dove_task"],
    constraints: ["Require an existing init goal or make the proposed init goal explicit before converting user demand into a mission task contract.", "Treat the operator input as natural-language demand, not as an already-created task.", "Return a proposal-only mission contract first: title, stage, domain, level, dependencies, blockers, autonomous checklist proposal, compact task card, durable `workContract`, and canonical `executionContract` with action, implementation, materials/readFirst requirements, convergence criteria, evidence requirements, and failure routes.", "After returning the proposal, use interactive confirmation controls when the host supports them (for example Claude Code AskUserQuestion) with options: approve and materialize the contract, adjust the contract, or cancel. Approval must replay the proposal's complete returned `confirmArgs`; when using the listed CLI route, run the exact confirmation command returned by that proposal, including its proposal token and fixed mutation mode. Never reconstruct a fresh `dove mission --goal ... --confirmed` request.", "Classify each task as `plan`, `execute`, or `audit` and as `paper`, `experiment`, or `engineering` before writing.", "User-created mission tasks default to level 3, while explicit operator-created levels 1, 2, 3, or deeper are allowed under the level-0 init goal.", "Autonomously decide whether a checklist is needed; system-created checklist/subtask packets must be children of their mission and must have level greater than the parent mission level.", "After materialization, stop at the contract handoff: return `nextAction`, `recommendedNextCommand`, `recommendedRoutes`, and `handoffRoutes` from the task's work contract instead of executing or recording work.", "Do not claim the mission performed source, note, draft, figure, experiment, review, code, or provider work; execution belongs to `dove.auto`, `dove.operator`, domain workflows, or explicit tool calls after the contract exists.", "Do not call `record_dove_mission_pass` as part of `/dove:mission`; result recording is a separate explicit tool for work that already happened.", "If required materials are missing while defining the contract, keep the contract proposal honest about blockers and evidence expectations instead of inventing results.", "When the converted task is a planning task, its done criteria should require explicit executable child mission contracts before any later execution flow can mark it completed.", "Default the converted user-level mission to level 3 and `pending`; any converted child missions may be level 4, 5, or deeper and must also default to `pending`."]
  },
  {
    id: "dove.auto",
    title: "Dove auto",
    domain: "generic",
    category: "mutation",
    policy: "explicit-approval",
    summary: "Convert demand like mission intake, then after confirmation run a few approved work rounds until completion or a blocker is reached.",
    requiredTools: ["run_dove_auto"],
    constraints: ["Use the same demand-to-task intake and classification model as `/dove:mission` before autonomous execution starts.", "Allow `/dove:auto` to be invoked directly on a new user demand or an existing durable task; it does not require running `/dove:mission` first.", "Return a proposal-only auto contract first: either a converted `proposedTask` with checklist proposal and executable `executionContract`, or a `selectedTask` from durable packet selection with current contract readiness, plus compact task/auto cards, confirmation args, and max iteration budget.", "Use interactive confirmation controls when the host supports them (for example Claude Code AskUserQuestion) before passing `confirmed: true`; options should approve and run bounded auto, adjust target/contract, or cancel.", "When an existing task target is missing or ambiguous, present indexed packet choices through confirmation UX instead of guessing.", "Require explicit operator confirmation before execution beyond task creation or selection.", "Run in the current foreground call only; do not schedule background or daemon continuation after the response ends.", "Use `.dove/state.json.settings.auto.maxIterations` as the default foreground iteration limit; the default is 3.", "Record each foreground iteration and stop reason in `.dove/runtime/results.json`, and return a localized `resultCard` summary without persisting the UX-only card in runtime results.", "May internally call public Dove workflows such as source, note, experience, figure, draft, review, review-loop, rebuttal, lessons, and status as needed.", "For source-research and current-information tasks, run the foreground search or retrieval pass before confirmed execution: use read-only public no-key network search when available, collect concrete URLs/DOIs/templates/guidelines, extract enough synthesis text, then call confirmed `run_dove_auto` once with explicit `steps` for both `dove.source` and `dove.note` so provenance and synthesis are deposited in the same auto run.", "Do not claim source research succeeded when Dove network search, host search, or fetch tools return zero results, unavailable providers, safety errors, or no concrete URLs/snippets; switch to another allowed foreground retrieval path or stop at an explicit host boundary.", 'If host search/fetch/shell/MCP safety classification or tool availability fails before Dove can perform the intended workflow, call `record_dove_mission_pass` for the packet with `resultStatus: "blocked"`, `boundaryType: "host-tool-blocked"`, the failed tool in `requiredActions`, and `nextAction: "project:dove.status"`; do not leave the task in-progress.', "Do not call confirmed `run_dove_auto` with only a packet id for source-research tasks; that only records a `source-requires-host-provenance` boundary and does not advance the research.", "Do not auto-run source, note, draft, experience, or review-loop steps without the material they need: source needs title/locator provenance, note needs synthesis content, draft needs body content, experience needs a goal/title/idea/experimentId, and review-loop needs packet-owned substantive review artifacts.", "Stop at completed, blocked, killed, authority/review boundary, missing provider credentials, conflicting packet target, or step-budget exhaustion.", "When a boundary is reached, persist the first-class boundary with required inputs/actions, role handoff, and next command; do not continue through hidden background work.", "Do not claim host/code/provider/experiment work was completed without real evidence, verification evidence, and `verifiedCriteria` coverage for the executable contract; stop at an awaiting-host/provider, missing-materials, or verification-failed boundary instead."]
  },
  {
    id: "dove.status",
    title: "Dove status",
    domain: "generic",
    category: "mutation",
    policy: "explicit-approval",
    summary: "Show a natural Dove status home that explains the current situation, the smallest useful next action, and how to expand only when needed.",
    requiredTools: ["query_dove_status", "apply_dove_status_adjustments"],
    constraints: ["Use status as the unified whole-project situation home; do not expose separate plan, checklist, audit, return, orchestration, missions, board, or list slash surfaces.", 'First call `query_dove_status` without `detail: "full"` to obtain the compact read-only Dove project situation home, but do not present saved `.dove/` files as the live development situation. Explain the live development situation from host-visible context first: current user request, current session work, known worktree state when available, latest validation/test evidence, active implementation blockers, and what was just completed or is still pending. If live context was not inspected, say which live checks were skipped in ordinary terms such as tests, worktree, or manual artifacts; do not name `.dove/`, durable context, MCP/schema fields, or storage files in the default answer.', "When MCP tools are unavailable and you must inspect `.dove/` files directly, synthesize the same compact public situation home instead of narrating the file schema: translate fields and tool ids into user actions such as provide or import the SVG, rerun figure validation, import the reviewer handoff, or record the experiment result. Default prose should say saved project state or standing guidance instead of `.dove/`, durable state, lessons, context files, or schema names.", "Keep `query_dove_status` read-only: it must return `proposalOnly: true`, `noAutoApply: true`, and `writes: []`.", "Keep durable rollback, boundary, gap, runtime, provider, artifact-path, and schema-field diagnostics in full/debug expansion; default compact status should describe the practical situation instead of printing internal governance or storage fields, and should translate internal figure-check records into current-figure review issues.", "Use compact `statusHome` as a public situation contract: `headline`, `scope`, `currentContext`, `nextStep`, `needsAttention`, `changes`, `showMore`, and explicit expansion handles. Render those fields as natural action guidance, not as a fixed heading template or a debug dump.", "Do not make mission lists, packet ids, phase ids, role labels, version ids, boundary/gap codes, blocked counts, execution-gap counts, repair-frontier names, route strings such as `project:dove.source`, raw artifact fields such as `sourceSvgPath`/`finalSvgPath`, low-level tool ids such as `validate_figure_pipeline`, claim-bridge jargon, or required-evidence blocks the default body of `/dove:status`; default status must answer `what should I do next?` with one recovery or continuation action, and `statusHome.optionalMissionDetails` remains collapsed unless the operator explicitly asks for `show current missions`, `\u6709\u54EA\u4E9B mission`, `--missions`, `showMissions`, or `includeMissionDetails`.", "For normal mission-list prompts, call compact `query_dove_status` with `showMissions: true` or `includeMissionDetails: true` and expand `statusHome.optionalMissionDetails`; do not add or require `/dove:missions`, `/dove:board`, `/dove:list`, and do not route mission-list questions to `/dove:mission`.", "Treat `query_dove_mission_board` as a low-level MCP/debug board, not the default host route for ordinary mission-list prompts.", 'Do not read a saved full status result file or request `detail: "full"` unless the operator explicitly asks to expand/debug full details.', "When `statusHome.blockersAndReconciliation.completionConsistency.status` is `needs-reconciliation`, present it as a legacy consistency issue: a done parent mission still has open checklist children. Do not recommend blanket-marking children done/completed; say to verify child evidence first, then either mark covered children done through confirmed status adjustment or reopen the parent mission.", "Use compact `nextStep` and `needsAttention` for the default explanation; read `actionableBoundaries`, `boundaryActionCards`, durable context, and current boundary metadata only in full/debug or when the operator asks for details.", "Use compact cards for status adjustment previews when available. Do not print raw internal dumps such as raw status-count objects, recent completed mission recaps, or recent killed mission recaps; if showing optional mission details, keep the `done` group collapsed unless the operator asks to expand it.", 'Boundary types are first-class metadata, not machine status choices; keep status choices exactly `["pending", "ready", "in-progress", "blocked", "completed", "killed", "archived"]`; `archived` is a cleanup lifecycle state, not deletion.', "When the host supports interactive confirmation controls, do not ask whether to modify mission statuses during default `/dove:status`; use a single confirmation dialog only when the operator clearly asks to change states or calls `query_dove_status` with `requestStatusAdjustment`/`includeStatusAdjustmentPreview`; build compact adjustment cards from adjustable missions excluding `completed`, `killed`, and `archived`; do not paginate by mission count or collect choices across multiple dialogs.", "The single confirmation dialog must provide a no-change path and a change/provide-adjustment-details path; if the operator does not provide parseable `packetId -> status` adjustments in that single dialog, do not call a mutation tool and instead ask for a clear adjustment format.", 'For status adjustment choices, preserve exactly `["pending", "ready", "in-progress", "blocked", "completed", "killed", "archived"]` as the machine status enum; default status hides archived missions and `includeArchived` may show archived counts/details without deleting evidence.', "Only call `apply_dove_status_adjustments` with `confirmed: true` after that single dialog yields explicit operator-confirmed status adjustments, then show the localized `resultCard` summary.", "Killing a mission is now a status choice in this UX, not a standalone public slash command."]
  },
  {
    id: "dove.operator",
    title: "Dove operator",
    domain: "generic",
    category: "mutation",
    policy: "explicit-approval",
    summary: "Run one approved operator pass over safe built-in steps, explicit results, and optional blocker-investigation planning.",
    requiredTools: ["run_dove_operator"],
    constraints: ["First call `run_dove_operator` without confirmation to return the proposal-only execution contract with compact `queueSummary`, small `queuePreview`, and `writes: []`; do not request full queue arrays unless the operator explicitly asks for `includeQueueDetails: true`.", "Use interactive confirmation controls when the host supports them before passing `confirmed: true`.", "Run in the current foreground call only; do not schedule background or daemon continuation after the response ends.", "For ready and in-progress missions, run one safe internal workflow step when available or collect one real host pass result in order; pass per-task results to `run_dove_operator` with evidence, verificationEvidencePaths, and verifiedCriteria so Dove records lifecycle and runtime state only when the executable contract is covered.", "Do not claim real engineering, paper, or experiment work happened when neither a safe internal step nor an actual host pass result exists; host-pass-required missions without taskResults must remain unchanged, and host results without convergence coverage must become explicit verification/material boundaries with no fake execution.", "When no safe internal step, missing step material, or actual host pass result exists, do not persist an `awaiting-host-pass-result` boundary just to show activity; return the material-specific requiredActions and keep durable writes empty unless another real operator action occurred.", "If a host-side search/fetch/shell/MCP safety classifier or tool-availability failure prevents collecting the pass result, pass a blocked task result with boundaryType `host-tool-blocked` and requiredActions naming the failed host tool instead of leaving the mission in-progress.", "Preserve durable role handoff metadata while running queue passes; do not expose planner/builder/reviewer as separate slash commands.", 'For blocked missions, default to proposal-only blocker-investigation guidance and do not write child missions; create pending child investigation plan missions only when the operator explicitly requests `blockerInvestigationMode: "create"` or `createBlockedInvestigations: true`, then report created and reused counts separately in the localized `resultCard` summary.']
  },
  {
    id: "dove.lessons",
    title: "Dove lessons",
    domain: "generic",
    category: "mutation",
    policy: "governed-bookkeeping",
    summary: "Inspect or record global and task-bound lessons that future Dove work must obey.",
    requiredTools: ["query_operator_lessons", "record_operator_lesson"],
    constraints: ["Record only distilled lessons with problem, decision, pitfall, validation, and next-time guidance.", "When recording a task-specific lesson and multiple tasks exist, return an indexed task list and wait for the operator to choose.", "Allow manual global lessons when no task binding is intended.", "Surface applicable must-obey lessons before later task mutations.", "Do not import or cite ignored raw runtime traces."]
  },
  {
    id: "dove.version",
    title: "Dove version",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Create a direction-change point and clear active non-init work with confirmation.",
    requiredTools: ["reset_dove_version"],
    constraints: ["For direction changes, snapshot the current direction before resetting active tasks.", "Do not use `/dove:version` as a `.dove` rollback restore entrypoint; host/context rollback belongs to the host and can cover Dove workflow artifacts only when patch-plan operations are applied through host-tracked file edits.", "Preserve the level-0 init goal and required global or task lessons during direction-change resets.", "Return a clean status summary and recommend `/dove:mission` for the next direction after direction reset."]
  },
  {
    id: "dove.source",
    title: "Dove source",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Collect and organize external material such as web pages, papers, venue templates, reviewer guidelines, rankings, APIs, or operator-provided sources for the selected task.",
    requiredTools: ["query_sources", "register_source", "verify_source"],
    constraints: ["Treat source as external information intake, not internal note consolidation; pressure-test summaries and writing-style synthesis belong in note or document evidence.", "Use `register_source` with `sources: [...]` for batch provenance capture when the operator provides multiple URLs/templates/guidelines at once.", "When current public information or scholarly discovery is needed, use read-only public no-key network search or visible retrieval to find candidates first, then verify title, locator, DOI/URL, source identity, and citation details before registration.", "Dove network search results are candidate material, not durable source evidence; snippets alone must not become registered sources or claims.", "Never call `register_source` with only a packet id; every new source must include a real title or locator, and source-research auto runs must collect those URLs/templates/guidelines before writing.", "Treat host search output such as `Did 0 searches`, zero results, empty result sets, or unavailable search as a hard retrieval failure; do not describe it as finding official sources, and do not infer locators from memory or prior transcript context.", "Do not call `register_source` when search/fetch returned zero results, safe-domain verification failed, retrieval was blocked, or a network search provider reports unavailable; record or surface a `host-tool-blocked` boundary until verifiable source evidence exists.", "If the host denies or blocks the boundary-recording mutation, stop and report that no durable source or boundary update was written; do not retry another mutating Dove call such as patch-plan without explicit operator approval.", "Use explicit configured providers or operator-provided material; do not hide network/provider calls.", "Link each source to the resolved durable task packet through packetIds.", "Treat source and source-verification JSON ledgers as bookkeeping, not completion artifacts; use typed source:<id> completion evidence only when the latest verification decision is verified and both fingerprint and packet binding match.", "For reviewer-guideline or \u5BA1\u7A3F\u504F\u597D research, stay in Builder/researcher source intake unless the operator asks for an independent audit of an artifact."]
  },
  {
    id: "dove.note",
    title: "Dove note",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Organize task-bound internal synthesis from registered sources, existing materials, pressure-test results, and operator notes for the selected task.",
    requiredTools: ["upsert_note"],
    constraints: ["Treat note as internal information consolidation, not external source discovery; external URLs/templates/guidelines must already be registered as sources when they are evidence.", "Use notes to synthesize verified sources, compare candidates, record open questions, or explain why a candidate could not yet become evidence; keep unverified search snippets labeled as candidates.", "For bind/save/deposit/\u6C89\u6DC0 requests, write the synthesized findings here or in `record_document_evidence` after source details is registered.", "Do not create a new note without real synthesis content: summary, quote, claim, or open question.", "Link notes to the resolved durable task packet through packetIds and to relevant sourceIds/artifacts."]
  },
  {
    id: "dove.figure",
    title: "Dove figure",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Turn one user-described figure intent into materials, optional generation/import, caption support, checks, and a clear answer about whether this figure is usable now.",
    requiredTools: ["run_figure_workflow"],
    constraints: ["Treat the user request as one figure intent; the default result should say whether this figure is ready, what is missing, or what to do next without exposing the material/import/check pipeline as separate user chores.", "Treat the default figure path as a hand-drawn SVG plan: record the backlog item, material bundle, generation prompt, and waiting-for-output state instead of routing the operator to a separate low-level figure-plan write.", "Use the built-in OpenAI image provider only when the operator explicitly selects it or config sets it as default; require `OPENAI_API_KEY` through env-var secret reference and do not store inline API keys.", "Resolve the durable task packet before any figure workflow write, then analyze linked sections, claims, experiments, sources, notes, review concerns, and material hints automatically.", "Use redacted Dove config and env-var secret references for external drawing providers; never store inline API keys, tokens, or secrets.", "Do not mark a final figure ready unless it comes from a validated generation import with durable provenance and caption.", "Captions must explain the figure purpose and linked evidence."]
  },
  {
    id: "dove.experience",
    title: "Dove experience",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Convert an idea into experiment goals/plans/results and bridge validated outcomes into claims or conclusions.",
    requiredTools: ["run_experience_workflow"],
    constraints: ["Use this as the combined experiment and claim workflow; do not expose separate public experiment or claim-gate slash commands.", "Make experiment goals, success criteria, result evidence, audit status, and claim impact explicit.", "Do not create a placeholder experience plan without a real goal, title, idea, or experimentId.", "Do not promote unsupported results into claims."]
  },
  {
    id: "dove.draft",
    title: "Dove draft",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Generate or modify paper draft content from prompts, existing materials, experience, figures, and review information.",
    requiredTools: ["upsert_draft", "set_section_status"],
    constraints: ["Draft as completely as current evidence allows.", "Do not create or update a draft without body content; use `set_section_status` for metadata-only updates.", "Use explicit placeholders for missing evidence or citations inside real draft content instead of fabricating support.", "Incorporate applicable source, note, experience, figure, and review context linked to the resolved task."]
  },
  {
    id: "dove.review",
    title: "Dove review",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Run a local evidence-aware review pass over selected task materials and produce concrete revision guidance.",
    requiredTools: ["run_review_loop"],
    constraints: ["Default review is a local evidence-aware pass that inspects claims, sources, notes, drafts, experiments, figures, and recorded concerns for the selected task or paper pipeline.", "Do not treat a verdict string as review progress; return concrete findings, action items, missing evidence, or a clear coherent result backed by inspected materials.", "Use isolated audio or external reviewer mode only when the operator explicitly asks for isolated/audio/parallel reviewer review; ordinary review should not inherit broad private transcripts or pretend an external review ran."]
  },
  {
    id: "dove.review-loop",
    title: "Dove review loop",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Run one independent local Reviewer pass and return an explicit Builder handoff when revision is required.",
    requiredTools: ["run_dove_review_loop"],
    constraints: ["Run exactly one Reviewer pass for the selected packet and descendants.", "Do not modify draft, experience, experiment, or other Builder-owned material in this call.", "If the verdict is non-coherent, return concrete requiredActions and an explicit Builder handoff; revisions and the next Reviewer pass must be separate explicit calls.", "Do not claim iteration counts, configured rounds, or review-until-coherent behavior; do not prepare isolated/audio review unless the operator explicitly asks for that mode."]
  },
  {
    id: "dove.rebuttal",
    title: "Dove rebuttal",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Normalize reviewer issues, build a rebuttal strategy, and draft submission/revision responses.",
    requiredTools: ["normalize_rebuttal_issues", "build_rebuttal_strategy", "build_rebuttal"],
    constraints: ["Normalize reviewer issues before drafting responses.", "Keep rebuttal and revision response work author-side.", "Link each response to claims, draft sections, experiments, or explicit unresolved placeholders."]
  }
];
var COMMAND_UX_DETAILS = {
  "dove.init": {
    dailyFlow: ["Use this when the workspace needs one clear Dove goal or that goal needs an explicit refresh.", "Keep concrete work out of init; after the goal is set, move the actual request to mission or auto."],
    targetingBehavior: "No task target is needed because this updates the project-level goal.",
    confirmationBehavior: "Update the existing goal rather than creating another root goal.",
    expectedOutcome: "The workspace has one clear project goal and the next practical step is a mission or auto run.",
    examples: ["/dove:init Make Dove a local-first research and engineering workflow", "/dove:init Refresh the project goal around daily Dove usability"]
  },
  "dove.mission": {
    dailyFlow: ["Use this for one concrete user demand that should become a tracked mission/task contract and hand off to the right next workflow.", "Describe the desired outcome in normal language; Dove should propose the task, explain the evidence it will need, and wait for approval before materializing the contract."],
    targetingBehavior: "Creates a new task contract under the project goal, or helps set the project goal first when the workspace is new.",
    confirmationBehavior: "Show the proposed task in plain language, then ask whether to materialize that exact proposal, adjust it, or cancel; confirmation must reuse the returned task id and proposal digest rather than re-infer a new contract.",
    expectedOutcome: "After approval, the contract exists with recommended next routes; real execution belongs to auto, operator, domain workflows, or explicit tools.",
    examples: ["/dove:mission Fix the status dashboard next-action mismatch", "/dove:mission Turn the latest review feedback into one executable task"]
  },
  "dove.auto": {
    dailyFlow: ["Use this when the user wants Dove to continue through a few approved steps after the task is clear.", "When the work depends on current outside information, public docs, papers, or provider behavior, run a visible no-key search/retrieval step early and verify candidates before writing evidence.", "Auto may start from a new demand or an existing task, but it still needs an understandable proposal before spending its work limit."],
    targetingBehavior: "Use the selected task when it is obvious; otherwise ask the operator to choose or approve a new task.",
    confirmationBehavior: "Require explicit approval of the target, work limit, and visible steps before running.",
    expectedOutcome: "Each step either completes useful work with evidence or stops at a clear blocker, review need, missing material, or budget limit.",
    examples: ["/dove:auto Continue the current Dove UX improvement task for up to three approved rounds", "/dove:auto Run the selected task until completion or an explicit blocker"]
  },
  "dove.status": {
    dailyFlow: ["Use this to answer the ordinary operator question: what should I do next?", "Default output should read like a project assistant: briefly explain the current situation, name the smallest useful next action, and mention expansion only when it helps. Do not impose a fixed four-line template or a numbered checklist by default.", "If saved project facts have to be inspected directly, translate them into user actions instead of repeating file names, ids, route names, tool names, or storage terms."],
    targetingBehavior: "Default output is not a mission board or audit report; keep mission lists, raw counts, and extra details collapsed unless the operator asks to expand.",
    confirmationBehavior: "Do not ask for status changes during default status; preview or apply changes only after an explicit status-change request and one clear confirmation step.",
    expectedOutcome: "The operator gets a short, natural status answer with one useful next step and enough context to decide whether to expand.",
    examples: ["/dove:status", "/dove:status Show what is blocked and what the next step is"]
  },
  "dove.operator": {
    dailyFlow: ["Use this to see which tracked work can move now and run one approved operator pass.", "Do not claim real work happened unless a safe built-in step ran or real pass results were supplied."],
    targetingBehavior: "Works over the active work queue rather than one ad hoc target.",
    confirmationBehavior: "Preview the practical queue situation first; require approval before accepting results or creating blocker-investigation work.",
    expectedOutcome: "Runnable work moves with evidence, blocked work gets a concrete investigation option, and unresolved work remains waiting for evidence instead of being marked done.",
    examples: ["/dove:operator", "/dove:operator Run one confirmed queue pass with real results"]
  },
  "dove.lessons": {
    dailyFlow: ["Use this when a closed task yields reusable guidance that future Dove work should obey.", "Keep lesson entries explicit and short: problem, decision, pitfall, validation, and next-time guidance."],
    targetingBehavior: "Can add global lessons or bind a lesson to a selected task.",
    confirmationBehavior: "When task binding is ambiguous, show task choices and wait for the operator.",
    expectedOutcome: "Applicable lessons are recalled later as standing guidance without importing raw traces or adding new lessons implicitly.",
    examples: ["/dove:lessons Add that status should not show completed or killed mission lists", "/dove:lessons Show lessons that apply to the selected task"]
  },
  "dove.version": {
    dailyFlow: ["Use this when the project direction changes enough that active non-root work should be cleared.", "Treat it as a direction reset, not as a general undo command."],
    targetingBehavior: "Operates on the current workspace direction and active tasks.",
    confirmationBehavior: "Require a reason before clearing active work.",
    expectedOutcome: "A direction reset stores the old direction, clears active non-root work, and points the next step at a fresh mission.",
    examples: ["/dove:version Change direction to focus on result-card usability", "/dove:version Reset active tasks after a major project direction change"]
  },
  "dove.source": {
    dailyFlow: ["Use this to add external information such as papers, web findings, venue templates, reviewer guidelines, rankings, API docs, citations, or operator-provided links or material.", "When the user asks for current outside information or scholarly material, run read-only public no-key network search or visible retrieval as candidate discovery, then verify useful candidates before registration.", "For bind/save/deposit/\u6C89\u6DC0 prompts, add external material first, then use note or document evidence for synthesis.", "Keep source intake separate from internal notes and pressure-test summaries."],
    targetingBehavior: "Resolve or confirm the task before adding external source details; batch multiple sources when the operator provides them together.",
    confirmationBehavior: "If no unique task target is available, ask for task selection instead of guessing.",
    expectedOutcome: "The selected task has verified source details, or the request stops clearly because retrieval or verification failed.",
    examples: ["/dove:source Add these CVPR author/reviewer guideline URLs to the selected task", "/dove:source Add venue templates and ranking pages before writing the synthesis note"]
  },
  "dove.note": {
    dailyFlow: ["Use this to consolidate internal information from added sources, existing materials, pressure-test results, or operator notes.", "Use source for external material; use note for project-local synthesis, candidate comparison, open questions, and writing-style or reviewer-preference summaries.", "For bind/save/deposit/\u6C89\u6DC0 prompts, add the synthesized result here or in document evidence after source details are available."],
    targetingBehavior: "Resolve or confirm the task before writing notes.",
    confirmationBehavior: "If the target is missing or ambiguous, ask for task confirmation before writing.",
    expectedOutcome: "The selected task has internal notes linked to relevant sources and materials.",
    examples: ["/dove:note Summarize what the registered venue sources imply for this task", "/dove:note Capture the pressure-test finding and link it to registered sources"]
  },
  "dove.figure": {
    dailyFlow: ["Use this when the user describes the figure they want once, including where it should help the paper or task.", "Dove should gather linked materials, prepare generation or import, draft caption support, check only the current figure for the compact verdict, and say whether this figure is usable now.", "By default, prepare a hand-drawn SVG plan and tell the operator when SVG output is needed.", "Use OpenAI image generation only for an explicit drawing request with OPENAI_API_KEY supplied through the environment."],
    targetingBehavior: "Resolve the figure request to one task before writing; do not make the user reason about paths or workspace-wide extra details unless they explicitly ask for details.",
    confirmationBehavior: "Ask for task confirmation when the figure target is unclear; external drawing calls require explicit safe configuration.",
    expectedOutcome: "The operator gets a clear current-figure result: ready for review, missing materials, awaiting SVG or drawing output, or needing current-figure fixes.",
    examples: ["/dove:figure Draw a workflow diagram for the mission-auto-status loop", "/dove:figure Prepare the main results figure and caption support"]
  },
  "dove.experience": {
    dailyFlow: ["Use this as the experiment and evidence workflow: turn ideas into experiment plans, results, audits, and claim impact.", "Do not treat experience as general retrospectives; use lessons for reusable operator guidance."],
    targetingBehavior: "Resolve the experiment or evidence work to one task before writing.",
    confirmationBehavior: "Ask for task confirmation when the experiment, result, or claim signal does not identify one task.",
    expectedOutcome: "Experiment plans, reviewed results, and claim impact are connected to the selected task.",
    examples: ["/dove:experience Design an experiment to validate retrieval quality", "/dove:experience Import this experiment result and connect it to the claim"]
  },
  "dove.draft": {
    dailyFlow: ["Use this to generate or revise paper sections from the selected task, evidence, notes, sources, experiences, figures, and review findings.", "Write as much as current evidence supports and leave explicit placeholders for gaps."],
    targetingBehavior: "Resolve the draft request to one task before changing draft content.",
    confirmationBehavior: "Ask for task confirmation when the section or task target is ambiguous.",
    expectedOutcome: "Draft content or section status is updated with evidence-aware placeholders where needed.",
    examples: ["/dove:draft Draft the methods section from linked evidence", "/dove:draft Revise the introduction using the latest review findings"]
  },
  "dove.review": {
    dailyFlow: ["Use this for a local evidence-aware review pass over the selected task materials.", "Inspect concrete claims, sources, notes, drafts, experiments, figures, and recorded concerns; do not substitute a verdict label for review work.", "Use separate isolated or audio review only when the operator explicitly asks for that mode."],
    targetingBehavior: "Resolve the review to one task and the exact materials being reviewed.",
    confirmationBehavior: "If the target or reviewed material is unclear, ask for the material instead of guessing or falling back to a status panel.",
    expectedOutcome: "The operator gets concrete findings, action items, missing evidence, or a coherent result backed by inspected materials.",
    examples: ["/dove:review Check whether the current draft is supported by evidence", "/dove:review Review the selected task materials before marking them done"]
  },
  "dove.review-loop": {
    dailyFlow: ["Use this for one independent Reviewer pass over the selected packet materials.", "The pass records concrete findings or a material-backed coherent verdict, but never edits Builder-owned draft or experience material.", "When revision is required, hand the requiredActions to a Builder and invoke review again only after that separate revision call."],
    targetingBehavior: "Resolve the pass to one task and its packet-owned materials before reviewing.",
    confirmationBehavior: "This command performs one visible Reviewer pass only; there is no implicit Reviewer-to-Builder-to-Reviewer cycle.",
    expectedOutcome: "One packet-scoped review result plus an explicit Builder handoff when changes are required.",
    examples: ["/dove:review-loop Run one independent evidence-aware review pass", "/dove:review-loop Review this packet and hand required revisions to Builder"]
  },
  "dove.rebuttal": {
    dailyFlow: ["Use this to organize reviewer issues, build response strategy, and draft evidence-backed rebuttal or revision text.", "Keep rebuttal work author-side and linked to claims, sections, experiments, or explicit gaps."],
    targetingBehavior: "Resolve the rebuttal work to one task and the reviewer issues being answered.",
    confirmationBehavior: "Do not draft final responses from unsupported issues or missing evidence.",
    expectedOutcome: "Reviewer issues, strategy, and response drafts are ready with usable evidence links.",
    examples: ["/dove:rebuttal Normalize reviewer issues and build the response strategy", "/dove:rebuttal Draft an evidence-backed response for the missing-experiment concern"]
  }
};
var COMMAND_ADAPTER_CONSTRAINTS = {
  "dove.init": [
    "Keep init limited to the project goal; do not start concrete research, writing, review, or engineering work here.",
    "After the goal is set, name the practical next Dove surface in ordinary language instead of exposing storage details."
  ],
  "dove.mission": [
    "Propose the task first, then ask whether to materialize that exact proposal, adjust it, or cancel; never rebuild a different contract from a bare confirmation.",
    "After approval, materialize the contract only and hand off to the recommended next workflow; mission itself does not execute source, note, draft, figure, experiment, review, code, or provider work.",
    "Report the created contract and recommended next routes without claiming completion or execution progress.",
    "If the contract is planning work, its done criteria must require explicit executable child mission contracts before any later execution flow can mark it completed."
  ],
  "dove.auto": [
    "Propose the target, work limit, and visible steps before running.",
    "Run only in the current approved interaction; never schedule hidden background continuation.",
    "For research or current-information work, use visible search/retrieval when needed and collect real verified sources or materials before claiming success.",
    "Stop clearly at completion, blocker, review need, missing material, or budget limit."
  ],
  "dove.status": [
    "Start with the live situation the current session can actually see, then fold in saved project state only as background guidance.",
    "Answer the operator's ordinary next-step question in short natural prose: the current situation, the smallest useful action, and why it matters when helpful.",
    "Default status is not a mission board or audit report; keep mission lists, raw identifiers, raw counts, route names, low-level fields, and extra details collapsed unless the operator asks to expand.",
    "When the operator asks to show missions, expand mission details inside this status surface instead of inventing separate list, board, or mission-board commands.",
    "Only preview or apply status changes after an explicit status-change request, using one confirmation step and a clear no-change path.",
    "For legacy parent/child consistency issues, tell the operator to verify child evidence first, then either mark covered children done through confirmed status adjustment or reopen the parent.",
    "After confirmed status changes, return a localized human summary instead of a raw update log."
  ],
  "dove.operator": [
    "Preview the practical queue situation before asking for approval.",
    "Run one operator pass only after confirmation.",
    "Do not claim work without real results; leave it waiting for evidence instead.",
    "Create blocker-investigation tasks only when the operator explicitly asks for them."
  ],
  "dove.lessons": [
    "Add only distilled guidance: problem, decision, pitfall, validation, and next-time behavior.",
    "Do not import raw transcripts or noisy runtime traces as lessons.",
    "When task binding is unclear, ask the operator to choose the task before writing."
  ],
  "dove.version": [
    "Treat this as a direction reset, not as a general undo command.",
    "Require a short reason before clearing active work.",
    "Preserve the project goal and reusable lessons, then point the operator to the next mission."
  ],
  "dove.source": [
    "Only add external material when it has a real title, locator, citation, URL, or operator-provided links or material.",
    "Use public no-key network search or visible retrieval for candidate discovery when current outside information is needed, but register only verified candidates.",
    "If search, fetch, or verification finds no trustworthy material, say no source was added and explain the next retrieval step.",
    "When the target task is unclear, ask the operator to choose from visible context instead of inspecting project state.",
    "When source work cannot finish here, say the source material is ready and has not yet been added to the task; the natural Chinese phrasing is `\u8FD9\u6761\u6765\u6E90\u8FD8\u6CA1\u52A0\u5165\u4EFB\u52A1`.",
    "Batch multiple sources when the operator provides them together.",
    "Keep source intake separate from synthesis; use note or document evidence for summaries and conclusions."
  ],
  "dove.note": [
    "Write notes only when there is real synthesis content: summary, quote, claim, or open question.",
    "External material should be added through source first when it is used as evidence.",
    "Connect the note to the selected task and relevant materials without showing raw internal identifiers."
  ],
  "dove.figure": [
    "Treat the user request as one figure intent and answer whether this figure is ready, waiting for SVG output, missing materials, missing drawing configuration, or needs current-figure fixes.",
    "Use the hand-drawn SVG plan as the normal default path and tell the operator when SVG output is needed.",
    "Use OpenAI image generation only when explicitly selected or configured; the OpenAI key must come from the OPENAI_API_KEY environment variable, never inline text.",
    "Resolve the target task before updating figure state, then gather linked sections, claims, experiments, sources, notes, review concerns, and material hints automatically.",
    "Do not mark a figure ready until imported output has source support, caption, and a clean current-figure check.",
    "Captions must explain the figure purpose and linked evidence; default replies should not make the operator reason about paths or workspace-wide extra details."
  ],
  "dove.experience": [
    "Require a real experiment goal, title, idea, result, or outcome before writing.",
    "Make success criteria, result evidence, audit state, and claim impact understandable to the operator.",
    "Do not promote unsupported results into claims."
  ],
  "dove.draft": [
    "Draft or revise only when body content or a clear section-status change is provided.",
    "Use explicit placeholders for missing evidence or citations instead of fabricating support.",
    "Use linked sources, notes, experience, figures, and review findings when they are available."
  ],
  "dove.review": [
    "Inspect real project materials and report concrete review findings, action items, missing evidence, or a coherent result.",
    "Do not substitute a status panel, task list, or verdict string for review work.",
    "Use separate isolated or audio review only when the operator explicitly asks for that mode, and keep private writer/reviewer transcripts out of ordinary review replies.",
    "Report review outcomes in plain language."
  ],
  "dove.review-loop": [
    "Run exactly one visible local Reviewer pass over the selected packet materials.",
    "Do not revise draft, experiment, experience, or other Builder-owned material in this call.",
    "When changes are required, return concrete required actions and an explicit Builder handoff.",
    "Invoke review again only after a separate explicit Builder revision call."
  ],
  "dove.rebuttal": [
    "Organize reviewer issues before drafting responses.",
    "Keep rebuttal work on the author side.",
    "Link each response to evidence, draft sections, experiments, or explicit unresolved gaps."
  ]
};
var COMMAND_SURFACES = COMMAND_SURFACES_BASE.map((surface) => {
  const withUx = {
    ...surface,
    adapterConstraints: COMMAND_ADAPTER_CONSTRAINTS[surface.id] ?? [],
    constraints: [...AGENT_WORKFLOW_CONSTRAINTS, ...surface.constraints ?? []],
    ux: COMMAND_UX_DETAILS[surface.id]
  };
  const hasTaskScopedWrite = (surface.requiredTools ?? []).some((toolId) => TASK_SCOPED_WRITE_TOOL_IDS.has(toolId));
  if (!hasTaskScopedWrite) {
    return withUx;
  }
  return {
    ...withUx,
    constraints: [...withUx.constraints, ...TASK_SCOPED_WRITE_CONSTRAINTS]
  };
});
var COMMAND_SURFACE_BY_ID = Object.fromEntries(COMMAND_SURFACES.map((surface) => [surface.id, surface]));
var DIRECT_PROCESS_ADAPTER_COMMAND_IDS = COMMAND_SURFACES.filter((surface) => surface.category === "mutation" && surface.id !== "dove.status" && surface.id !== "dove.lessons").map((surface) => surface.id);
function commandIdToSlug(commandId) {
  return commandId.replace(/^dove\./, "");
}
function hostCommandSlug(commandId) {
  return commandIdToSlug(commandId).replace(/\./g, "-");
}
function adapterPathForCommand(hostId, command) {
  const commandId = typeof command === "string" ? command : command.id;
  const hostSlug = hostCommandSlug(commandId);
  switch (hostId) {
    case "opencode":
      return `.opencode/commands/${commandId}.md`;
    case "cursor":
      return `.cursor/commands/dove-${hostSlug}.md`;
    case "codex":
      return `.codex/skills/dove-${hostSlug}/SKILL.md`;
    case "agents":
      return `.agents/skills/dove-${hostSlug}/SKILL.md`;
    case "claude":
      return `commands/dove/${hostSlug}.md`;
    default:
      throw new Error(`Unknown host adapter: ${hostId}`);
  }
}
function commandAdapterPathsForHost(hostId) {
  return COMMAND_SURFACES.map((command) => adapterPathForCommand(hostId, command));
}
var HOST_ADAPTERS = Object.fromEntries(PROJECT_HOST_IDS.map((hostId) => {
  const commandPaths = commandAdapterPathsForHost(hostId);
  const extraPaths = hostId === "opencode" ? [...OPENCODE_ROLE_SKILL_PATHS, ".opencode.json"] : hostId === "agents" ? ["AGENTS.md"] : [];
  return [hostId, {
    label: HOST_DEFINITIONS[hostId].label,
    paths: [...commandPaths, ...extraPaths],
    requiredPaths: [...commandPaths, ...extraPaths],
    jsonChecks: HOST_DEFINITIONS[hostId].jsonChecks
  }];
}));

// src/core/dove-domain.mjs
var DOVE_WORKFLOW_KERNEL_VERSION = "dove-mission-kernel-v1";
var DOVE_MISSION_LIFECYCLE_STAGES = ["goal", "design", "checklist", "execution", "audit", "return"];
var DOVE_DOMAIN_IDS = ["paper", "engineering", "experiment", "review", "general"];
var DOVE_DOMAIN_GUIDANCE = [
  {
    id: "paper",
    label: "Paper",
    summary: "Paper writing, research, claims, citations, rebuttal, figures, and versioned manuscript work.",
    stageRoutes: {
      goal: "project:dove.source",
      design: "project:dove.mission",
      checklist: "project:dove.status",
      execution: "project:dove.draft",
      audit: "project:dove.review",
      return: "project:dove.status"
    },
    returnEvidence: ["claim/evidence coverage", "checklist status", "review verdict", "version comparison"]
  },
  {
    id: "engineering",
    label: "Engineering",
    summary: "Normal engineering requirements, implementation work, tests, regressions, and code review framed as the same Dove mission lifecycle.",
    stageRoutes: {
      goal: "project:dove.mission",
      design: "project:dove.mission",
      checklist: "project:dove.status",
      execution: "project:dove.mission or project:dove.auto",
      audit: "project:dove.review",
      return: "project:dove.status"
    },
    returnEvidence: ["changed files", "tests or validation output", "review notes", "acceptance checklist"]
  },
  {
    id: "experiment",
    label: "Experiment",
    summary: "Experiment plans, runs, result interpretation, audit findings, and result-to-claim traceability.",
    stageRoutes: {
      goal: "project:dove.experience",
      design: "project:dove.experience",
      checklist: "project:dove.status",
      execution: "project:dove.experience",
      audit: "project:dove.experience",
      return: "project:dove.experience"
    },
    returnEvidence: ["experiment audit", "result log", "claim bridge", "review verdict"]
  },
  {
    id: "review",
    label: "Review",
    summary: "Independent critique, reviewer concerns, isolated review handoffs, and acceptance pressure.",
    stageRoutes: {
      goal: "project:dove.mission",
      design: "project:dove.review",
      checklist: "project:dove.status",
      execution: "project:dove.review",
      audit: "project:dove.review",
      return: "project:dove.status"
    },
    returnEvidence: ["review report", "concern state", "revision plan", "acceptance verdict"]
  },
  {
    id: "general",
    label: "General",
    summary: "General bounded research or workflow work that still uses one mission, one board, and one return protocol.",
    stageRoutes: {
      goal: "project:dove.mission",
      design: "project:dove.mission",
      checklist: "project:dove.status",
      execution: "project:dove.mission",
      audit: "project:dove.review",
      return: "project:dove.status"
    },
    returnEvidence: ["task packet", "handoff", "audit summary", "acceptance checklist"]
  }
];
var DOVE_PRIMARY_ROLES = [
  {
    id: "planner",
    label: "Planner",
    summary: "Sets destination, scope, constraints, priorities, and acceptance criteria."
  },
  {
    id: "builder",
    label: "Builder",
    summary: "Performs writing, coding, experiments, data work, implementation, and revision."
  },
  {
    id: "reviewer",
    label: "Reviewer",
    summary: "Independently audits returned work, concerns, evidence, tests, and acceptance."
  }
];
var DOVE_PRIMARY_ROLE_IDS = DOVE_PRIMARY_ROLES.map((role) => role.id);

// src/core/schema.mjs
var SCHEMA_VERSION = 6;
var PACKAGE_VERSION = "0.2.0";
var DOVE_TASK_STAGES = ["plan", "execute", "audit"];
var DOVE_TASK_DOMAINS = ["paper", "experiment", "engineering"];
var DOVE_TASK_STATUSES = ["pending", "ready", "in-progress", "blocked", "completed", "killed", "archived"];
var DOVE_ARCHIVED_TASK_STATUSES = ["archived", "archived-with-lineage"];
var DOVE_BOUNDARY_TYPES = [
  "needs-confirmation",
  "needs-task-selection",
  "awaiting-host-pass",
  "awaiting-host-pass-result",
  "awaiting-host-results",
  "host-tool-blocked",
  "blocked-boundary",
  "needs-review",
  "awaiting-provider-output",
  "awaiting-review-output",
  "missing-required-materials",
  "missing-secret-env",
  "missing-executable-contract",
  "plan-output-not-executable",
  "verification-failed",
  "debug-retry-required",
  "fix-required",
  "provider-failed",
  "workflow-error-boundary"
];
var DOVE_BOUNDARY_STATUSES = ["open", "resolved"];
var DOVE_HANDOFF_STATUSES = ["none", "pending", "accepted", "completed", "blocked"];
var DOVE_TASK_CREATOR_KINDS = ["user", "system"];
var DOVE_AUDIO_CONTEXT_POLICY = "final-plan-results-and-explicit-artifacts-only";
var DOVE_RESPONSE_LANGUAGES = ["zh", "en"];
var DEFAULT_DOVE_RESPONSE_LANGUAGE = "zh";
var DOVE_DOCUMENT_KINDS = ["draft", "note", "review", "figure", "experiment", "source", "claim-support", "operator-note", "implementation-summary", "decision-record", "other"];
var DOVE_DOCUMENT_STATUSES = ["planned", "created", "active", "superseded", "archived", "published"];
var DOVE_DOCUMENT_EVIDENCE_SCOPES = ["internal", "external", "mixed"];
var DOVE_RESPONSE_LANGUAGE_ALIASES = {
  zh: "zh",
  cn: "zh",
  chinese: "zh",
  "zh-cn": "zh",
  "zh-hans": "zh",
  \u4E2D\u6587: "zh",
  \u6C49\u8BED: "zh",
  \u82F1\u6587: "en",
  \u82F1\u8BED: "en",
  en: "en",
  english: "en",
  "en-us": "en",
  "en-gb": "en"
};
function normalizeDoveResponseLanguage(value, fallback = DEFAULT_DOVE_RESPONSE_LANGUAGE, options = {}) {
  const normalizedFallback = DOVE_RESPONSE_LANGUAGES.includes(fallback) ? fallback : DEFAULT_DOVE_RESPONSE_LANGUAGE;
  if (typeof value !== "string" || value.trim().length === 0) {
    return normalizedFallback;
  }
  const normalized = DOVE_RESPONSE_LANGUAGE_ALIASES[value.trim().toLowerCase()];
  if (normalized) {
    return normalized;
  }
  if (options.strict === true) {
    throw new Error(`Unsupported Dove response language: ${value}. Supported values: ${DOVE_RESPONSE_LANGUAGES.join(", ")}.`);
  }
  return normalizedFallback;
}
var DEFAULT_SECTION_ORDER = [
  ["abstract", "Abstract"],
  ["introduction", "Introduction"],
  ["related-work", "Related Work"],
  ["method", "Method"],
  ["experiments", "Experiments"],
  ["limitations", "Limitations"],
  ["conclusion", "Conclusion"],
  ["rebuttal", "Rebuttal Notes"]
];
var PIPELINE_STAGE_ORDER = [
  "init",
  "sources",
  "notes",
  "research",
  "plan",
  "outline",
  "draft",
  "experiments",
  "citations",
  "review",
  "rebuttal",
  "versions",
  "checklist"
];
var PAPER_LIFECYCLE_TAXONOMY_VERSION = "paper-lifecycle-v1";
var PAPER_LIFECYCLE_FAMILIES = [
  {
    id: "objective",
    label: "Objective",
    summary: "Research goal, thesis, venue strategy, and acceptance target.",
    roleHints: ["planner"],
    artifactPathKeys: ["state", "project", "researchContract", "researchBrief", "researchAgenda"]
  },
  {
    id: "structure",
    label: "Structure",
    summary: "Paper organization, sections, drafts, figures, checklists, and versions.",
    roleHints: ["planner", "builder"],
    artifactPathKeys: ["plan", "outline", "draftsDir", "checklist", "figuresIndex", "figureMaterials", "figureGenerations", "figureCaptions", "figureQa", "versionsIndex", "versionComparisons"]
  },
  {
    id: "campaign",
    label: "Campaign",
    summary: "Multi-cycle research programs, approvals, and explicit foreground runtime state.",
    roleHints: ["planner"],
    artifactPathKeys: ["programsIndex", "campaignsIndex", "programRuns", "programApprovals", "runtimeControllerState", "runtimeResults"]
  },
  {
    id: "work-unit",
    label: "Work Unit",
    summary: "Board, handoff, task-packet, and context/action surfaces that make work resumable.",
    roleHints: ["planner", "builder", "reviewer"],
    artifactPathKeys: ["orchestrationBoard", "orchestrationHandoffs", "taskPacketsIndex", "workspaceIndex", "workspaceArtifactMap", "actionContextsDir", "packetContextsDir"]
  },
  {
    id: "concern",
    label: "Concern",
    summary: "Reviewer concerns, revision pressure, rebuttal issues, and isolated review handoffs.",
    roleHints: ["reviewer", "builder"],
    artifactPathKeys: ["reviewState", "reviewConcerns", "reviewDebateLog", "adversarialReviewState", "revisionPlan", "rebuttalIssues", "rebuttalStrategy", "isolatedReviewsDir"]
  },
  {
    id: "audit",
    label: "Audit",
    summary: "Inspection, validation, governance proof, figure QA, version comparison, and meta reports.",
    roleHints: ["reviewer", "planner"],
    artifactPathKeys: ["experimentAudits", "reviewLog", "figureQa", "versionComparisons", "metaGovernanceCoverage", "metaRecommendations", "metaOptimizerReport"]
  },
  {
    id: "knowledge",
    label: "Knowledge",
    summary: "Sources, notes, document evidence, claims, bibliography, wiki, and long-horizon memory.",
    roleHints: ["builder"],
    artifactPathKeys: ["sources", "notes", "evidence", "documentsLedger", "claims", "bibliography", "citationLog", "wiki", "wikiEntities", "wikiRelations", "metaLongHorizonMemory", "metaOperatorLessons"]
  }
];
var PAPER_LIFECYCLE_FAMILY_IDS = PAPER_LIFECYCLE_FAMILIES.map((family) => family.id);
var PAPER_LIFECYCLE_FAMILY_BY_ID = Object.fromEntries(PAPER_LIFECYCLE_FAMILIES.map((family) => [family.id, family]));
var PAPER_MAJOR_CHANGE_PROTOCOL_STAGES = ["design", "checklist", "implementation", "acceptance"];
var PAPER_MAJOR_CHANGE_SIGNALS = [
  "objective-or-thesis-change",
  "structure-or-section-change",
  "core-claim-change",
  "experiment-interpretation-change",
  "reviewer-concern-or-rebuttal-change",
  "figure-set-change",
  "version-or-finalization-change",
  "campaign-or-program-change"
];
var TASK_PACKET_TARGET_FIELDS = [
  "packetId",
  "taskPacketId",
  "missionPacketId",
  "packetIds",
  "target",
  "packetTarget",
  "taskName"
];
function governanceScopeMetadata(mutationScope, options = {}) {
  return {
    mutationScope,
    requiresPacketTarget: Boolean(options.requiresPacketTarget),
    targetFields: options.requiresPacketTarget ? TASK_PACKET_TARGET_FIELDS : [],
    artifactFields: Array.isArray(options.artifactFields) ? options.artifactFields : []
  };
}
function taskScopedMutationMetadata(artifactFields = []) {
  return governanceScopeMetadata("task-scoped-write", { requiresPacketTarget: true, artifactFields });
}
var GOVERNANCE_GUARDED_MUTATION_SCOPE_METADATA = {
  "upsert-orchestration-board": governanceScopeMetadata("workspace-global"),
  "init-dove-goal": governanceScopeMetadata("task-root"),
  "create-dove-task": governanceScopeMetadata("task-materialization"),
  "run-dove-auto": governanceScopeMetadata("task-autonomy"),
  "apply-dove-status-adjustments": governanceScopeMetadata("task-lifecycle"),
  "run-dove-operator": governanceScopeMetadata("task-autonomy"),
  "kill-dove-task": governanceScopeMetadata("task-lifecycle"),
  "reset-dove-version": governanceScopeMetadata("task-version-reset"),
  "run-experience-workflow": taskScopedMutationMetadata(["id", "experimentId", "claimId", "resultId"]),
  "prepare-audio-review": taskScopedMutationMetadata(["runId", "artifactPaths", "finalPlanPaths", "finalResultPaths"]),
  "import-audio-review": taskScopedMutationMetadata(["runId", "handoffPath", "reportPath"]),
  "run-audio-review": taskScopedMutationMetadata(["runId", "artifactPaths", "finalPlanPaths", "finalResultPaths"]),
  "run-dove-review-loop": taskScopedMutationMetadata(["runId", "scope", "artifactPaths"]),
  "append-handoff": governanceScopeMetadata("workspace-global"),
  "register-source": taskScopedMutationMetadata(["sourceId", "sourceIds", "url", "title"]),
  "verify-source": taskScopedMutationMetadata(["sourceId"]),
  "upsert-note": taskScopedMutationMetadata(["id", "sourceIds", "claimIds", "sectionId"]),
  "upsert-claims": taskScopedMutationMetadata(["id", "sourceIds", "noteIds", "experimentIds", "sectionId"]),
  "upsert-plan": taskScopedMutationMetadata(["milestoneIds", "sectionIds"]),
  "upsert-outline": taskScopedMutationMetadata(["sectionId", "sectionIds"]),
  "upsert-draft": taskScopedMutationMetadata(["sectionId"]),
  "set-section-status": taskScopedMutationMetadata(["sectionId"]),
  "upsert-figure-plan": taskScopedMutationMetadata(["id", "figureId", "claimIds", "sectionId"]),
  "run-figure-workflow": taskScopedMutationMetadata(["id", "figureId", "runId", "captionId", "claimIds", "sectionId"]),
  "prepare-figure-generation": taskScopedMutationMetadata(["id", "figureId", "runId", "claimIds", "sectionId"]),
  "import-figure-generation": taskScopedMutationMetadata(["id", "figureId", "runId", "captionId"]),
  "sync-citations": governanceScopeMetadata("derived-refresh"),
  "refresh-wiki": governanceScopeMetadata("derived-refresh"),
  "build-rebuttal": taskScopedMutationMetadata(["rebuttalIssueIds", "issueIds"]),
  "append-review-log": taskScopedMutationMetadata(["reviewId", "findingIds", "concernIds"]),
  "upsert-revision-plan": taskScopedMutationMetadata(["reviewId", "findingIds", "concernIds"]),
  "run-review-loop": taskScopedMutationMetadata(["scope", "stage"]),
  "prepare-isolated-review": taskScopedMutationMetadata(["runId", "scope", "artifactPaths"]),
  "import-isolated-review": taskScopedMutationMetadata(["runId", "handoffPath", "reportPath"]),
  "run-isolated-review": taskScopedMutationMetadata(["runId", "scope", "artifactPaths"]),
  "update-research-brief": taskScopedMutationMetadata(["sourceIds", "noteIds", "claimIds"]),
  "upsert-experiment-plan": taskScopedMutationMetadata(["id", "experimentId", "claimId"]),
  "upsert-experiment-result": taskScopedMutationMetadata(["id", "resultId", "experimentId", "claimId"]),
  "run-experiment-audit": taskScopedMutationMetadata(["resultId", "experimentId", "auditIds"]),
  "bridge-experiment-result-to-claim": taskScopedMutationMetadata(["resultId", "experimentId", "claimId", "auditIds"]),
  "normalize-rebuttal-issues": taskScopedMutationMetadata(["issueIds", "rebuttalIssueIds"]),
  "build-rebuttal-strategy": taskScopedMutationMetadata(["issueIds", "rebuttalIssueIds"]),
  "create-version-snapshot": taskScopedMutationMetadata(["id", "versionId"]),
  "compare-versions": taskScopedMutationMetadata([]),
  "materialize-guidance-packet": governanceScopeMetadata("task-materialization"),
  "launch-dove-mission": governanceScopeMetadata("task-materialization"),
  "record-dove-mission-pass": taskScopedMutationMetadata(["runId", "evidenceLinks", "artifactRefs"]),
  "record-document-evidence": taskScopedMutationMetadata(["id", "documentId", "documentPath", "artifactRefs", "evidenceLinks", "sourceRefs", "claimIds"])
};
var GOVERNANCE_GUARDED_MUTATIONS = [
  { id: "upsert-orchestration-board", action: "Updating the orchestration board", artifactPath: ".dove/orchestration/board.json", surfaceBindings: { coreFunction: "upsertOrchestrationBoard", mcpTool: "upsert_orchestration_board", commandIds: [] } },
  { id: "init-dove-goal", action: "Creating or updating the unique Dove init goal", artifactPath: ".dove/task-packets", surfaceBindings: { coreFunction: "initDoveGoal", mcpTool: "init_dove_goal", commandIds: ["dove.init"] } },
  { id: "create-dove-task", action: "Converting a user demand into a classified Dove task under the init goal", artifactPath: ".dove/task-packets", surfaceBindings: { coreFunction: "createDoveTask", mcpTool: "create_dove_task", commandIds: ["dove.mission"] } },
  { id: "record-dove-mission-pass", action: "Explicitly recording execution results for an existing Dove mission or task", artifactPath: ".dove/runtime/results.json", surfaceBindings: { coreFunction: "recordDoveMissionPass", mcpTool: "record_dove_mission_pass", commandIds: [] } },
  { id: "run-dove-auto", action: "Running demand-to-task intake and bounded autonomous task completion", artifactPath: ".dove/runtime/results.json", surfaceBindings: { coreFunction: "runDoveAuto", mcpTool: "run_dove_auto", commandIds: ["dove.auto"] } },
  { id: "apply-dove-status-adjustments", action: "Applying explicitly confirmed Dove task status adjustments", artifactPath: ".dove/task-packets", surfaceBindings: { coreFunction: "applyDoveStatusAdjustments", mcpTool: "apply_dove_status_adjustments", commandIds: ["dove.status"] } },
  { id: "run-dove-operator", action: "Running one confirmed foreground operator pass over safe internal steps, explicit host results, and blocker planning", artifactPath: ".dove/runtime/results.json", surfaceBindings: { coreFunction: "runDoveOperator", mcpTool: "run_dove_operator", commandIds: ["dove.operator"] } },
  { id: "kill-dove-task", action: "Killing a non-init Dove task", artifactPath: ".dove/task-packets", surfaceBindings: { coreFunction: "killDoveTask", mcpTool: "kill_dove_task", commandIds: [] } },
  { id: "reset-dove-version", action: "Resetting active Dove tasks for a new version direction", artifactPath: ".dove/versions/index.json", surfaceBindings: { coreFunction: "resetDoveVersion", mcpTool: "reset_dove_version", commandIds: ["dove.version"] } },
  { id: "run-experience-workflow", action: "Planning, recording, auditing, and bridging experience evidence into claims", artifactPath: ".dove/experiments/results.json", surfaceBindings: { coreFunction: "runExperienceWorkflow", mcpTool: "run_experience_workflow", commandIds: ["dove.experience"] } },
  { id: "prepare-audio-review", action: "Preparing an isolated audio review input bundle", artifactPath: ".dove/audio/reviews", surfaceBindings: { coreFunction: "prepareAudioReview", mcpTool: "prepare_audio_review", commandIds: [] } },
  { id: "import-audio-review", action: "Importing an isolated audio review handoff", artifactPath: ".dove/audio/reviews", surfaceBindings: { coreFunction: "importAudioReview", mcpTool: "import_audio_review", commandIds: [] } },
  { id: "run-audio-review", action: "Running an explicitly requested isolated audio review over declared task artifacts", artifactPath: ".dove/audio/reviews", surfaceBindings: { coreFunction: "runAudioReview", mcpTool: "run_audio_review", commandIds: [] } },
  { id: "run-dove-review-loop", action: "Running limited local review, draft, and experience iterations", artifactPath: ".dove/reviews/log.md", surfaceBindings: { coreFunction: "runDoveReviewLoop", mcpTool: "run_dove_review_loop", commandIds: ["dove.review-loop"] } },
  { id: "append-handoff", action: "Appending a durable handoff", artifactPath: ".dove/orchestration/handoffs.md", surfaceBindings: { coreFunction: "appendHandoff", mcpTool: "append_handoff", commandIds: [] } },
  { id: "register-source", action: "Registering a source candidate", artifactPath: ".dove/sources/index.json", surfaceBindings: { coreFunction: "registerSource", mcpTool: "register_source", commandIds: ["dove.source"] } },
  { id: "verify-source", action: "Verifying or rejecting a source", artifactPath: ".dove/sources/verifications.json", surfaceBindings: { coreFunction: "verifySource", mcpTool: "verify_source", commandIds: [] } },
  { id: "upsert-note", action: "Recording a structured note", artifactPath: ".dove/notes/index.json", surfaceBindings: { coreFunction: "upsertNote", mcpTool: "upsert_note", commandIds: ["dove.note"] } },
  { id: "upsert-claims", action: "Updating evidence-backed claims", artifactPath: ".dove/evidence/index.json", surfaceBindings: { coreFunction: "upsertClaims", mcpTool: "upsert_claims", commandIds: ["dove.experience"] } },
  { id: "upsert-plan", action: "Updating the Dove mission plan", artifactPath: ".dove/plans/current-plan.md", surfaceBindings: { coreFunction: "upsertPlan", mcpTool: "upsert_plan", commandIds: [] } },
  { id: "upsert-outline", action: "Updating the paper outline", artifactPath: ".dove/outline/current-outline.md", surfaceBindings: { coreFunction: "upsertOutline", mcpTool: "upsert_outline", commandIds: [] } },
  { id: "upsert-draft", action: "Updating a draft section", artifactPath: ".dove/drafts", surfaceBindings: { coreFunction: "upsertDraft", mcpTool: "upsert_draft", commandIds: ["dove.draft"] } },
  { id: "set-section-status", action: "Updating a section status", artifactPath: ".dove/state.json", surfaceBindings: { coreFunction: "setSectionStatus", mcpTool: "set_section_status", commandIds: ["dove.draft"] } },
  { id: "upsert-figure-plan", action: "Updating the figure plan", artifactPath: ".dove/figures/index.json", surfaceBindings: { coreFunction: "upsertFigurePlan", mcpTool: "upsert_figure_plan", commandIds: ["dove.figure"] } },
  { id: "run-figure-workflow", action: "Running the figure workflow from one user intent through materials, generation/import, caption, and QA", artifactPath: ".dove/figures/generations.json", surfaceBindings: { coreFunction: "runFigureWorkflow", mcpTool: "run_figure_workflow", commandIds: ["dove.figure"] } },
  { id: "prepare-figure-generation", action: "Preparing figure generation materials and input bundle", artifactPath: ".dove/figures/generations.json", surfaceBindings: { coreFunction: "prepareFigureGeneration", mcpTool: "prepare_figure_generation", commandIds: ["dove.figure"] } },
  { id: "import-figure-generation", action: "Importing generated figure output and caption", artifactPath: ".dove/figures/generations.json", surfaceBindings: { coreFunction: "importFigureGeneration", mcpTool: "import_figure_generation", commandIds: ["dove.figure"] } },
  { id: "sync-citations", action: "Updating citation artifacts", artifactPath: ".dove/bibliography/citation-log.md", surfaceBindings: { coreFunction: "syncCitations", mcpTool: "sync_citations", commandIds: [] } },
  { id: "refresh-wiki", action: "Refreshing the wiki", artifactPath: ".dove/wiki/index.md", surfaceBindings: { coreFunction: "refreshWiki", mcpTool: "refresh_wiki", commandIds: [] } },
  { id: "build-rebuttal", action: "Building the rebuttal draft", artifactPath: ".dove/drafts/rebuttal.md", surfaceBindings: { coreFunction: "buildRebuttal", mcpTool: "build_rebuttal", commandIds: ["dove.rebuttal"] } },
  { id: "append-review-log", action: "Recording a manual review log", artifactPath: ".dove/reviews/log.md", surfaceBindings: { coreFunction: "appendReviewLog", mcpTool: "append_review_log", commandIds: [] } },
  { id: "upsert-revision-plan", action: "Updating the revision plan", artifactPath: ".dove/revision-plans/current-plan.md", surfaceBindings: { coreFunction: "upsertRevisionPlan", mcpTool: "upsert_revision_plan", commandIds: ["dove.draft"] } },
  { id: "run-review-loop", action: "Running the local evidence-aware review loop", artifactPath: ".dove/reviews/log.md", surfaceBindings: { coreFunction: "runReviewLoop", mcpTool: "run_review_loop", commandIds: ["dove.review"] } },
  { id: "prepare-isolated-review", action: "Preparing an explicit isolated reviewer input bundle", artifactPath: ".dove/reviews/isolated", surfaceBindings: { coreFunction: "prepareIsolatedReview", mcpTool: "prepare_isolated_review", commandIds: [] } },
  { id: "import-isolated-review", action: "Importing an explicit isolated reviewer handoff", artifactPath: ".dove/reviews/isolated", surfaceBindings: { coreFunction: "importIsolatedReview", mcpTool: "import_isolated_review", commandIds: [] } },
  { id: "run-isolated-review", action: "Running an explicit isolated parallel-session reviewer handoff", artifactPath: ".dove/reviews/isolated", surfaceBindings: { coreFunction: "runIsolatedReview", mcpTool: null, commandIds: [], cliCommand: "isolated-review" } },
  { id: "update-research-brief", action: "Updating the research brief", artifactPath: ".dove/research/brief.md", surfaceBindings: { coreFunction: "updateResearchBrief", mcpTool: "update_research_brief", commandIds: ["dove.source"] } },
  { id: "upsert-experiment-plan", action: "Updating an experiment plan", artifactPath: ".dove/experiments/plans.json", surfaceBindings: { coreFunction: "upsertExperimentPlan", mcpTool: "upsert_experiment_plan", commandIds: ["dove.experience"] } },
  { id: "upsert-experiment-result", action: "Updating an experiment result", artifactPath: ".dove/experiments/results.json", surfaceBindings: { coreFunction: "upsertExperimentResult", mcpTool: "upsert_experiment_result", commandIds: ["dove.experience"] } },
  { id: "run-experiment-audit", action: "Running an experiment audit", artifactPath: ".dove/experiments/audits.json", surfaceBindings: { coreFunction: "runExperimentAudit", mcpTool: "run_experiment_audit", commandIds: ["dove.experience"] } },
  { id: "bridge-experiment-result-to-claim", action: "Bridging an experiment result to a claim", artifactPath: ".dove/claims/bridge-log.json", surfaceBindings: { coreFunction: "bridgeExperimentResultToClaim", mcpTool: "bridge_result_to_claim", commandIds: ["dove.experience"] } },
  { id: "normalize-rebuttal-issues", action: "Normalizing rebuttal issues", artifactPath: ".dove/rebuttal/issues.json", surfaceBindings: { coreFunction: "normalizeRebuttalIssues", mcpTool: "normalize_rebuttal_issues", commandIds: ["dove.rebuttal"] } },
  { id: "build-rebuttal-strategy", action: "Building the rebuttal strategy", artifactPath: ".dove/rebuttal/strategy.md", surfaceBindings: { coreFunction: "buildRebuttalStrategy", mcpTool: "build_rebuttal_strategy", commandIds: ["dove.rebuttal"] } },
  { id: "create-version-snapshot", action: "Creating a version snapshot", artifactPath: ".dove/versions/index.json", surfaceBindings: { coreFunction: "createVersionSnapshot", mcpTool: "create_version_snapshot", commandIds: ["dove.version"] } },
  { id: "compare-versions", action: "Comparing versions", artifactPath: ".dove/versions/comparisons.json", surfaceBindings: { coreFunction: "compareVersions", mcpTool: "compare_versions", commandIds: ["dove.version"] } },
  { id: "materialize-guidance-packet", action: "Materializing accepted packet-only guidance into a durable task packet and follow-through record without creating program authority or executing work", artifactPath: ".dove/task-packets", surfaceBindings: { coreFunction: "materializeGuidancePacket", mcpTool: "materialize_guidance_packet", commandIds: [] } },
  { id: "launch-dove-mission", action: "Launching a governed Dove mission by materializing packet-only accepted guidance into the authoritative .dove task-packet store without creating program authority or executing work", artifactPath: ".dove/task-packets", surfaceBindings: { coreFunction: "launchDoveMission", mcpTool: "launch_dove_mission", commandIds: [] } },
  { id: "record-document-evidence", action: "Recording an explicit document/evidence ledger entry without capturing raw transcripts or overwriting existing documents", artifactPath: ".dove/documents/ledger.json", surfaceBindings: { coreFunction: "recordDocumentEvidence", mcpTool: "record_document_evidence", commandIds: [] } }
].map((entry) => ({
  ...entry,
  ...GOVERNANCE_GUARDED_MUTATION_SCOPE_METADATA[entry.id] ?? governanceScopeMetadata("workspace-global")
}));
var GOVERNANCE_EXEMPT_MUTATION_SCOPE_METADATA = {
  "record-operator-lesson": governanceScopeMetadata("governance-bookkeeping"),
  "record-operator-follow-through": governanceScopeMetadata("governance-bookkeeping"),
  "plan-campaign": governanceScopeMetadata("governance-bookkeeping"),
  "revoke-program-approval": governanceScopeMetadata("governance-bookkeeping"),
  "query-meta-optimize": governanceScopeMetadata("derived-refresh"),
  "init-project": governanceScopeMetadata("bootstrap"),
  "sync-checklist": governanceScopeMetadata("derived-refresh"),
  "validate-figure-pipeline": governanceScopeMetadata("inspection-only"),
  "classify-workflow-intent": governanceScopeMetadata("inspection-only"),
  "load-board": governanceScopeMetadata("read-helper"),
  "refresh-durable-surfaces": governanceScopeMetadata("derived-refresh"),
  "publish-dove-status": governanceScopeMetadata("derived-refresh"),
  "publish-dove-global-status": governanceScopeMetadata("derived-refresh"),
  "serve-dove-global-status": governanceScopeMetadata("derived-refresh"),
  "configure-claude-code-gateway-defaults": governanceScopeMetadata("host-install-bootstrap"),
  "summarize-session-journal": governanceScopeMetadata("governance-bookkeeping")
};
var GOVERNANCE_EXEMPT_MUTATIONS = [
  { id: "record-operator-lesson", action: "Recording distilled operator lessons remains explicitly exempt because it is reflective bookkeeping and does not approve, materialize, or execute work.", artifactPath: ".dove/meta/operator-lessons.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-05-07T00:00:00.000Z", lastReviewedAt: "2026-05-07T00:00:00.000Z", reasonCode: "retrospective-bookkeeping", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "recordOperatorLesson", mcpTool: "record_operator_lesson", commandIds: ["dove.lessons"] } },
  { id: "record-operator-follow-through", action: "Recording a manual operator follow-through decision remains explicitly exempt; this public surface cannot write program linkage, runtime retry or timing state, or runtime-owned terminal and executing statuses.", artifactPath: ".dove/meta/operator-follow-through.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-07-11T00:00:00.000Z", reasonCode: "governance-ledger-maintenance", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "recordOperatorFollowThrough", mcpTool: "record_operator_follow_through", commandIds: [] } },
  { id: "plan-campaign", action: "Recording a multi-cycle campaign plan remains exempt because it only records planner-supervised campaign intent and does not approve or execute bounded program work.", artifactPath: ".dove/programs/campaigns.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-25T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "campaign-planning-bookkeeping", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "planCampaign", mcpTool: "plan_campaign", commandIds: [] } },
  { id: "revoke-program-approval", action: "Revoking a program approval remains exempt because it withdraws authority rather than executing new work.", artifactPath: ".dove/programs/approvals.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "approval-withdrawal", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "revokeProgramApproval", mcpTool: "revoke_program_approval", commandIds: [] } },
  { id: "query-meta-optimize", action: "Refreshing proposal-only optimizer surfaces remains exempt because it is part of debt detection, not debt execution.", artifactPath: ".dove/meta/LATEST_OPTIMIZER_REPORT.md", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "proposal-frontier-refresh", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "queryMetaOptimize", mcpTool: "query_meta_optimize", commandIds: [] } },
  { id: "init-project", action: "Project initialization bootstraps the workspace and is explicitly exempt from follow-through gating.", artifactPath: ".dove/state.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-17T00:00:00.000Z", reasonCode: "workspace-bootstrap", reviewCadence: "per-project", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "initProject", mcpTool: "init_project", commandIds: [] } },
  { id: "sync-checklist", action: "Checklist syncing remains exempt because it summarizes debt instead of executing it.", artifactPath: ".dove/checklists/current.md", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "summary-sync", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "syncChecklist", mcpTool: "sync_checklist", commandIds: [] } },
  { id: "validate-figure-pipeline", action: "Figure validation is an inspection path and remains exempt from follow-through execution gating.", artifactPath: ".dove/figures/qa.json", ownerRole: "researcher", approvedByRole: "researcher", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "inspection-only", reviewCadence: "per-change", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "validateFigurePipeline", mcpTool: "validate_figure_pipeline", commandIds: ["dove.figure"] } },
  { id: "classify-workflow-intent", action: "Workflow intent classification is analytical and remains exempt.", artifactPath: ".dove/meta/recommendations.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "analysis-only", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "classifyWorkflowIntent", mcpTool: "query_meta_optimize", commandIds: [] } },
  { id: "load-board", action: "Board loading is a read helper and is explicitly exempt.", artifactPath: ".dove/orchestration/board.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-04-17T00:00:00.000Z", reasonCode: "read-helper", reviewCadence: "per-release", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "loadBoard", mcpTool: "query_workspace_index", commandIds: [] } },
  { id: "refresh-durable-surfaces", action: "Durable surface refresh is a proposal-only summarization step and remains exempt.", artifactPath: ".dove/workspace/index.json", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "summary-refresh", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "refreshDurableSurfaces", mcpTool: "query_workspace_index", commandIds: ["dove.status"] } },
  { id: "publish-dove-status", action: "Publishing sanitized public status artifacts remains exempt because it derives a read-only external summary from durable Dove state without approving, materializing, or executing work.", artifactPath: ".dove/public", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-06-16T00:00:00.000Z", lastReviewedAt: "2026-06-16T00:00:00.000Z", reasonCode: "public-derived-status-refresh", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "publishDoveStatus", mcpTool: "publish_dove_status", commandIds: [] } },
  { id: "publish-dove-global-status", action: "Publishing the global sanitized public status index remains exempt because it only derives a static aggregate from explicit project .dove/public artifacts without approving, materializing, executing work, scanning the computer, or starting external services.", artifactPath: "xdg:dove/public", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-06-17T00:00:00.000Z", lastReviewedAt: "2026-06-17T00:00:00.000Z", reasonCode: "global-public-derived-status-refresh", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "publishDoveGlobalStatus", mcpTool: "publish_dove_global_status", commandIds: [] } },
  { id: "serve-dove-global-status", action: "Serving the global sanitized public status directory remains exempt only as an explicit foreground operator command that publishes the static aggregate once, serves that public directory over loopback, and optionally starts a visible Cloudflare tunnel without scanning the computer, daemonizing, scheduling refreshes, or exposing raw Dove state.", artifactPath: "xdg:dove/public", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-06-17T00:00:00.000Z", lastReviewedAt: "2026-06-17T00:00:00.000Z", reasonCode: "global-public-explicit-foreground-serving", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "runGlobalStatusServingForeground", mcpTool: null, commandIds: [], cliCommand: "serve-global-status" } },
  { id: "configure-claude-code-gateway-defaults", action: "Claude Code gateway default configuration remains exempt because it is an explicit host install/sync bootstrap step that writes only allowlisted non-secret compatibility switches, not Dove task state.", artifactPath: "claude:user-config", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-07-08T00:00:00.000Z", lastReviewedAt: "2026-07-08T00:00:00.000Z", reasonCode: "host-install-bootstrap", reviewCadence: "per-release", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "configureClaudeCodeGatewayDefaults", mcpTool: null, commandIds: [], cliCommand: "install/sync --host claude" } },
  { id: "summarize-session-journal", action: "Session summarization is reflective and remains exempt from execution gating.", artifactPath: ".dove/sessions/LATEST_SUMMARY.md", ownerRole: "planner", approvedByRole: "planner", approvedAt: "2026-04-15T00:00:00.000Z", lastReviewedAt: "2026-05-05T00:00:00.000Z", reasonCode: "reflective-summary", reviewCadence: "per-session", sunsetAt: "2099-12-31T00:00:00.000Z", surfaceBindings: { coreFunction: "summarizeSessionJournal", mcpTool: "query_meta_optimize", commandIds: [] } }
].map((entry) => ({
  ...entry,
  ...GOVERNANCE_EXEMPT_MUTATION_SCOPE_METADATA[entry.id] ?? governanceScopeMetadata("governance-bookkeeping")
}));
var GOVERNANCE_READONLY_COMMANDS = [];
var GOVERNANCE_READONLY_TOOLS = [
  "ensure_workspace",
  "read_state",
  "query_task_graph",
  "query_open_questions",
  "query_decisions",
  "query_lineage",
  "query_workspace_index",
  "query_meta_optimize",
  "query_governance_coverage_report",
  "query_operator_lessons",
  "search_network",
  "query_network_search_providers",
  "query_sources",
  "query_operator_follow_through",
  "query_paper_audit",
  "query_dove_onboarding",
  "query_paper_pipeline",
  "query_dove_orchestrate",
  "query_dove_mission",
  "query_dove_mission_board",
  "query_dove_status",
  "query_document_ledger",
  "query_dove_audit",
  "query_dove_return",
  "query_program_approvals",
  "query_campaigns",
  "query_boundary_report",
  "read_role_context_manifest",
  "read_phase_context_manifest",
  "read_packet_context_manifest",
  "read_artifact_context_manifest",
  "read_action_context_bundle",
  "summarize_session_journal",
  "list_artifacts"
];
var GOVERNANCE_NEGATIVE_COVERAGE = [
  { id: "upsert-orchestration-board", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "init-dove-goal", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "create-dove-task", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "record-dove-mission-pass", level: "dynamic", tests: ["create_dove_task materializes a mission contract without recording runtime results"] },
  { id: "run-dove-auto", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "apply-dove-status-adjustments", level: "dynamic", tests: ["create_dove_task materializes a mission contract without recording runtime results"] },
  { id: "run-dove-operator", level: "dynamic", tests: ["create_dove_task materializes a mission contract without recording runtime results"] },
  { id: "kill-dove-task", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "reset-dove-version", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "run-experience-workflow", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "prepare-audio-review", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "import-audio-review", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "run-audio-review", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "run-dove-review-loop", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "append-handoff", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "register-source", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "verify-source", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "upsert-note", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "upsert-claims", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "upsert-plan", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "upsert-outline", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "upsert-draft", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "set-section-status", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "upsert-figure-plan", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "run-figure-workflow", level: "dynamic", tests: ["runFigureWorkflow rejects missing packet targets before writing figure items", "runFigureWorkflow rejects unsafe SVG and inline secret arguments"] },
  { id: "prepare-figure-generation", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "import-figure-generation", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "sync-citations", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "refresh-wiki", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "build-rebuttal", level: "dynamic", tests: ["a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "append-review-log", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt", "a broader set of guarded write paths all reject unresolved follow-through debt"] },
  { id: "upsert-revision-plan", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "run-review-loop", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "prepare-isolated-review", level: "binding-only", tests: ["isolated review imports only handoff/report artifacts from an external reviewer command"] },
  { id: "import-isolated-review", level: "binding-only", tests: ["isolated review imports only handoff/report artifacts from an external reviewer command"] },
  { id: "run-isolated-review", level: "binding-only", tests: ["isolated review imports only handoff/report artifacts from an external reviewer command"] },
  { id: "update-research-brief", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "upsert-experiment-plan", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "upsert-experiment-result", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "run-experiment-audit", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "bridge-experiment-result-to-claim", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "normalize-rebuttal-issues", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "build-rebuttal-strategy", level: "binding-only", tests: ["governance registry completely binds the expected mutating command and MCP surfaces"] },
  { id: "create-version-snapshot", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "compare-versions", level: "dynamic", tests: ["queryMetaOptimize exposes governance coverage and guarded write paths respect follow-through debt"] },
  { id: "materialize-guidance-packet", level: "dynamic", tests: ["materializeGuidancePacket creates a durable packet from accepted remediation guidance and binds follow-through"] },
  { id: "launch-dove-mission", level: "dynamic", tests: ["launchDoveMission materializes accepted guidance through the .dove mission packet store and refuses dual-root Dove authority"] },
  { id: "record-document-evidence", level: "dynamic", tests: ["record_document_evidence stores internal and public-safe document evidence without publishing raw internal entries"] }
];
var PRIMARY_ROLE_IDS = ["planner", "builder", "reviewer"];
var SUBAGENT_ROLE_IDS = [
  "researcher",
  "experiment-planner",
  "revision-lead",
  "rebuttal-lead",
  "version-analyst"
];
var ROLE_HIERARCHY = {
  planner: {
    id: "planner",
    label: "Planner",
    kind: "primary",
    manuallySwitchable: true,
    parentRole: null,
    charter: "Acts as mentor, PI, and editor: sets direction, prioritizes work, coordinates handoffs, and supervises governance.",
    subagents: ["task-planner", "orchestration-manager", "governance-checker", "priority-ranker", "version-analyst"]
  },
  builder: {
    id: "builder",
    label: "Builder",
    kind: "primary",
    manuallySwitchable: true,
    parentRole: null,
    charter: "Acts as the mission builder: writes, implements, revises, gathers evidence, plans experiments, interprets results, and prepares responses.",
    subagents: ["researcher", "experiment-planner", "result-analyst", "paper-writer", "revision-lead"]
  },
  reviewer: {
    id: "reviewer",
    label: "Reviewer",
    kind: "primary",
    manuallySwitchable: true,
    parentRole: null,
    charter: "Acts as the independent critic: attacks claims, checks evidence and methods, records concerns, and issues verdicts.",
    subagents: ["claim-critic", "evidence-auditor", "experiment-auditor", "methodology-critic", "novelty-critic"]
  },
  researcher: {
    id: "researcher",
    label: "Researcher",
    kind: "subagent",
    manuallySwitchable: false,
    parentRole: "builder",
    charter: "Builder-side specialist for sources, notes, claims, evidence maps, and durable research briefs."
  },
  "experiment-planner": {
    id: "experiment-planner",
    label: "Experiment Planner",
    kind: "subagent",
    manuallySwitchable: false,
    parentRole: "builder",
    charter: "Builder-side specialist for claim-driven experiment plans, baselines, metrics, ablations, and result-to-claim closure."
  },
  "revision-lead": {
    id: "revision-lead",
    label: "Revision Lead",
    kind: "subagent",
    manuallySwitchable: false,
    parentRole: "builder",
    aliasOf: "rebuttal-lead",
    charter: "Builder-side specialist for turning reviewer concerns into revision plans, response matrices, and rebuttal drafts."
  },
  "rebuttal-lead": {
    id: "rebuttal-lead",
    label: "Rebuttal Lead",
    kind: "legacy-subagent",
    manuallySwitchable: false,
    parentRole: "builder",
    canonicalRole: "revision-lead",
    charter: "Legacy name for builder-side revision and rebuttal response work."
  },
  "version-analyst": {
    id: "version-analyst",
    label: "Version Analyst",
    kind: "subagent",
    manuallySwitchable: false,
    parentRole: "planner",
    charter: "Planner-side audit specialist for version diffs, regression checks, and concern-resolution evidence."
  }
};
var ROLE_IDS = [
  ...PRIMARY_ROLE_IDS,
  ...SUBAGENT_ROLE_IDS
];
var ARTIFACT_PATHS = {
  doveRoot: ".dove",
  state: ".dove/state.json",
  readme: ".dove/README.md",
  publicDir: ".dove/public",
  publicStatusJson: ".dove/public/status.json",
  publicStatusMarkdown: ".dove/public/status.md",
  publicStatusHtml: ".dove/public/index.html",
  documentsDir: ".dove/documents",
  documentsLedger: ".dove/documents/ledger.json",
  project: ".dove/project.md",
  researchContract: ".dove/contracts/research-contract.md",
  orchestrationBoard: ".dove/orchestration/board.json",
  orchestrationHandoffs: ".dove/orchestration/handoffs.md",
  taskPacketsDir: ".dove/task-packets",
  taskPacketsPacketsDir: ".dove/task-packets/packets",
  taskPacketsIndex: ".dove/task-packets/index.json",
  roleContextsDir: ".dove/context/roles",
  phaseContextsDir: ".dove/context/phases",
  packetContextsDir: ".dove/context/packets",
  artifactContextsDir: ".dove/context/artifacts",
  actionContextsDir: ".dove/context/actions",
  sessionJournal: ".dove/sessions/journal.json",
  sessionSummary: ".dove/sessions/LATEST_SUMMARY.md",
  workspaceDir: ".dove/workspace",
  workspaceIndex: ".dove/workspace/index.json",
  workspaceArtifactMap: ".dove/workspace/artifact-map.json",
  doveRootManifest: ".dove/manifest.json",
  programsDir: ".dove/programs",
  programsIndex: ".dove/programs/index.json",
  programRuns: ".dove/programs/runs.json",
  programApprovals: ".dove/programs/approvals.json",
  campaignsIndex: ".dove/programs/campaigns.json",
  workflowPackDir: ".dove/workflow-pack",
  workflowBoundaries: ".dove/workflow-pack/boundaries.json",
  researchBrief: ".dove/research/brief.md",
  researchAgenda: ".dove/research/agenda.json",
  plan: ".dove/plans/current-plan.md",
  outline: ".dove/outline/current-outline.md",
  findings: ".dove/findings.md",
  experimentLog: ".dove/experiments/EXPERIMENT_LOG.md",
  experimentPlans: ".dove/experiments/plans.json",
  experimentResults: ".dove/experiments/results.json",
  experimentAudits: ".dove/experiments/audits.json",
  sources: ".dove/sources/index.json",
  sourceVerifications: ".dove/sources/verifications.json",
  notes: ".dove/notes/index.json",
  evidence: ".dove/evidence/index.json",
  claims: ".dove/claims/CLAIMS_FROM_RESULTS.md",
  claimBridgeLog: ".dove/claims/bridge-log.json",
  draftsDir: ".dove/drafts",
  reviewLog: ".dove/reviews/log.md",
  reviewReport: ".dove/reviews/LATEST_REVIEW_REPORT.md",
  reviewState: ".dove/reviews/REVIEW_STATE.json",
  reviewConcerns: ".dove/reviews/concerns.json",
  reviewDebateLog: ".dove/reviews/debate-log.md",
  adversarialReviewState: ".dove/reviews/adversarial-state.json",
  isolatedReviewsDir: ".dove/reviews/isolated",
  audioReviewsDir: ".dove/audio/reviews",
  revisionPlan: ".dove/revision-plans/current-plan.md",
  wiki: ".dove/wiki/index.md",
  queryPack: ".dove/wiki/query_pack.md",
  navigationReport: ".dove/wiki/navigation.md",
  wikiEntities: ".dove/wiki/entities.json",
  wikiRelations: ".dove/wiki/relations.json",
  checklist: ".dove/checklists/current.md",
  bibliography: ".dove/bibliography/references.bib",
  citationLog: ".dove/bibliography/citation-log.md",
  figuresReadme: ".dove/figures/README.md",
  figuresIndex: ".dove/figures/index.json",
  figureBriefs: ".dove/figures/briefs.json",
  figureSegments: ".dove/figures/segments.json",
  figureTemplates: ".dove/figures/templates.json",
  figureEditableIndex: ".dove/figures/editable-index.json",
  figureFinalIndex: ".dove/figures/final-index.json",
  figureMaterials: ".dove/figures/materials.json",
  figureGenerations: ".dove/figures/generations.json",
  figureCaptions: ".dove/figures/captions.json",
  figureQa: ".dove/figures/qa.json",
  rebuttalIssues: ".dove/rebuttal/issues.json",
  rebuttalStrategy: ".dove/rebuttal/strategy.md",
  rebuttalResponseDraft: ".dove/rebuttal/response-draft.md",
  versionsIndex: ".dove/versions/index.json",
  versionComparisons: ".dove/versions/comparisons.json",
  versionComparisonReport: ".dove/versions/LATEST_COMPARISON.md",
  versionSnapshotsDir: ".dove/versions/snapshots",
  runtimeDir: ".dove/runtime",
  runtimeControllerState: ".dove/runtime/controller-state.json",
  runtimeContinuation: ".dove/runtime/continuation.json",
  runtimeLeases: ".dove/runtime/leases.json",
  runtimeEvents: ".dove/runtime/events.json",
  runtimeResults: ".dove/runtime/results.json",
  mutationsDir: ".dove/mutations",
  mutationsIndex: ".dove/mutations/index.json",
  metaDir: ".dove/meta",
  metaEvents: ".dove/meta/events.json",
  metaExecutionBridgeCandidates: ".dove/meta/execution-bridge-candidates.json",
  metaGovernanceCoverage: ".dove/meta/governance-coverage.json",
  metaGovernanceCoverageReport: ".dove/meta/governance-coverage-report.json",
  metaGovernanceCoverageReportMarkdown: ".dove/meta/LATEST_GOVERNANCE_COVERAGE_REPORT.md",
  metaLongHorizonMemory: ".dove/meta/long-horizon-memory.json",
  metaOperatorLessons: ".dove/meta/operator-lessons.json",
  metaOperatorFollowThrough: ".dove/meta/operator-follow-through.json",
  metaOperatorFollowThroughTransitions: ".dove/meta/operator-follow-through-transitions.json",
  metaOperatorPlaybooks: ".dove/meta/operator-playbooks.json",
  metaRemediationPacks: ".dove/meta/remediation-packs.json",
  metaRecommendations: ".dove/meta/recommendations.json",
  metaOptimizerState: ".dove/meta/optimizer-state.json",
  metaOptimizerReport: ".dove/meta/LATEST_OPTIMIZER_REPORT.md"
};
var AUTONOMY_ALLOWED_STEP_TYPES = [
  "refresh-research-brief",
  "refresh-wiki",
  "upsert-note",
  "run-experiment-audit",
  "bridge-result-to-claim",
  "run-review-loop"
];
function normalizeAutonomyAllowedStepType(value, fallback = "refresh-research-brief") {
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/_/g, "-") : "";
  if (AUTONOMY_ALLOWED_STEP_TYPES.includes(normalized)) {
    return normalized;
  }
  return fallback;
}
function digestText(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}
function createManagedArtifactMeta(kind, relativePath) {
  const seed = JSON.stringify({ kind, relativePath, schema: SCHEMA_VERSION, pack: PACKAGE_VERSION });
  return {
    revisionId: `schema-v${SCHEMA_VERSION}:${kind}`,
    templateHash: digestText(seed),
    generatedByVersion: PACKAGE_VERSION,
    managedKind: kind,
    path: relativePath
  };
}
function createContinuationState(overrides = {}) {
  const source = overrides && typeof overrides === "object" && !Array.isArray(overrides) ? overrides : {};
  const responseLanguage = source.responseLanguage ?? source.language ?? DEFAULT_DOVE_RESPONSE_LANGUAGE;
  const { responseLanguage: _responseLanguage, language: _language, ...stateOverrides } = source;
  return {
    status: "ready-to-resume",
    lastCheckpoint: defaultDisplayText(responseLanguage, "lastCheckpoint"),
    checkpointHistory: [],
    updatedAt: null,
    ...stateOverrides,
    checkpointHistory: Array.isArray(stateOverrides.checkpointHistory) ? stateOverrides.checkpointHistory : []
  };
}
function defaultSections() {
  return Object.fromEntries(
    DEFAULT_SECTION_ORDER.map(([id, title]) => [
      id,
      {
        id,
        title,
        status: "planned",
        summary: "",
        draftPath: `.dove/drafts/${id}.md`,
        claimIds: []
      }
    ])
  );
}
function defaultRoleRoster() {
  return PRIMARY_ROLE_IDS.map((roleId) => {
    const role = ROLE_HIERARCHY[roleId];
    return {
      id: role.id,
      label: role.label,
      kind: role.kind,
      manuallySwitchable: role.manuallySwitchable,
      parentRole: role.parentRole,
      charter: role.charter,
      subagents: role.subagents ?? []
    };
  });
}
function createDefaultBoard(stateOverrides = {}) {
  const responseLanguage = stateOverrides.settings?.responseLanguage ?? stateOverrides.responseLanguage ?? DEFAULT_DOVE_RESPONSE_LANGUAGE;
  const objective = stateOverrides.dove?.objective ?? defaultDisplayText(responseLanguage, "objective");
  const phase = stateOverrides.pipeline?.currentStage ?? "init";
  return {
    version: 2,
    paperObjective: objective,
    currentPhase: phase,
    intentType: "plan",
    assignedRole: "planner",
    currentFocus: defaultDisplayText(responseLanguage, "currentFocus"),
    nextAction: defaultDisplayText(responseLanguage, "nextAction"),
    continuationState: createContinuationState({ responseLanguage }),
    reviewRequiredBeforeFinalize: false,
    tasks: [],
    blockers: [],
    evidenceLinks: [],
    experimentIds: [],
    rebuttalIssueIds: [],
    unresolvedBlockersByRole: {},
    versionLineage: {
      currentVersionId: null,
      parentVersionId: null,
      snapshotIds: []
    },
    activeComparisonTargets: [],
    roleRoster: defaultRoleRoster(),
    updatedAt: (/* @__PURE__ */ new Date(0)).toISOString()
  };
}
function normalizeTaskTargetResolutionSettings(raw = {}, base = { autoSelect: true, autoSelectMinScore: 0.55, recordResolution: true }) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const rawScore = source.autoSelectMinScore;
  const autoSelectMinScore = typeof rawScore === "number" && Number.isFinite(rawScore) ? Math.min(1, Math.max(0, rawScore)) : base.autoSelectMinScore;
  return {
    autoSelect: typeof source.autoSelect === "boolean" ? source.autoSelect : base.autoSelect,
    autoSelectMinScore,
    recordResolution: typeof source.recordResolution === "boolean" ? source.recordResolution : base.recordResolution
  };
}
function normalizeTaskModelSettings(raw = {}, base = { uniqueInitLevel: 0, userDefaultLevel: 3, autoClassifyMissionTasks: true }) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    uniqueInitLevel: Number.isFinite(source.uniqueInitLevel) ? source.uniqueInitLevel : base.uniqueInitLevel,
    userDefaultLevel: Number.isFinite(source.userDefaultLevel) ? source.userDefaultLevel : base.userDefaultLevel,
    autoClassifyMissionTasks: typeof source.autoClassifyMissionTasks === "boolean" ? source.autoClassifyMissionTasks : base.autoClassifyMissionTasks
  };
}
function normalizeReviewLoopSettings(raw = {}, base = { maxIterations: 3 }) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const maxIterations = Number.isFinite(source.maxIterations) ? Math.max(1, Math.floor(source.maxIterations)) : base.maxIterations;
  return { maxIterations };
}
function normalizeAutoSettings(raw = {}, base = { maxIterations: 3 }) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const maxIterations = Number.isFinite(source.maxIterations) ? Math.max(1, Math.floor(source.maxIterations)) : base.maxIterations;
  return { maxIterations };
}
function normalizeAudioIsolationSettings(raw = {}, base = { defaultContextPolicy: DOVE_AUDIO_CONTEXT_POLICY }) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    defaultContextPolicy: normalizeString(source.defaultContextPolicy, base.defaultContextPolicy)
  };
}
function normalizeSettings(raw = {}, base = null) {
  const defaults = base ?? {
    strictMode: false,
    responseLanguage: DEFAULT_DOVE_RESPONSE_LANGUAGE,
    taskTargetResolution: normalizeTaskTargetResolutionSettings(),
    taskModel: normalizeTaskModelSettings(),
    auto: normalizeAutoSettings(),
    reviewLoop: normalizeReviewLoopSettings(),
    audioIsolation: normalizeAudioIsolationSettings()
  };
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    ...defaults,
    ...source,
    strictMode: Boolean(source.strictMode ?? defaults.strictMode),
    responseLanguage: normalizeDoveResponseLanguage(source.responseLanguage ?? source.language, defaults.responseLanguage),
    taskTargetResolution: normalizeTaskTargetResolutionSettings(source.taskTargetResolution, defaults.taskTargetResolution),
    taskModel: normalizeTaskModelSettings(source.taskModel, defaults.taskModel),
    auto: normalizeAutoSettings(source.auto, defaults.auto),
    reviewLoop: normalizeReviewLoopSettings(source.reviewLoop, defaults.reviewLoop),
    audioIsolation: normalizeAudioIsolationSettings(source.audioIsolation, defaults.audioIsolation)
  };
}
function createDefaultSettings(overrides = {}) {
  return normalizeSettings(overrides);
}
function defaultDisplayText(language, key) {
  const normalized = normalizeDoveResponseLanguage(language);
  const values = {
    title: {
      zh: "\u672A\u547D\u540D\u4EFB\u52A1\u5DE5\u4F5C\u533A",
      en: "Untitled Mission Workspace"
    },
    objective: {
      zh: "\u8BB0\u5F55 Dove \u4EFB\u52A1\u76EE\u6807\u4E0E\u8D21\u732E\u3002",
      en: "Capture the Dove mission goal and contribution."
    },
    thesis: {
      zh: "\u7528\u4E00\u53E5\u8BDD\u63CF\u8FF0\u8BBA\u6587\u9886\u57DF\u4E3B\u5F20\u6216\u4EFB\u52A1\u7ED3\u679C\u3002",
      en: "Describe the paper-domain claim or mission outcome in one sentence."
    },
    currentFocus: {
      zh: "\u5BF9\u9F50\u770B\u677F\u5E76\u9009\u62E9\u4E0B\u4E00\u4E2A\u6301\u4E45\u6B65\u9AA4\u3002",
      en: "Align the board and choose the next durable step."
    },
    nextAction: {
      zh: "\u8FD0\u884C project:dove.mission\uFF0C\u5728 init \u76EE\u6807\u4E0B\u521B\u5EFA\u4E0B\u4E00\u4E2A\u4EFB\u52A1\u3002",
      en: "Run project:dove.mission to create the next task under the init goal."
    },
    lastCheckpoint: {
      zh: "\u5DE5\u4F5C\u533A\u5DF2\u521D\u59CB\u5316\u3002",
      en: "Workspace bootstrapped."
    }
  };
  return values[key]?.[normalized] ?? values[key]?.en ?? "";
}
function createDefaultState(overrides = {}) {
  const baseSettings = createDefaultSettings(overrides.settings);
  const responseLanguage = baseSettings.responseLanguage;
  const base = {
    version: SCHEMA_VERSION,
    dove: {
      title: defaultDisplayText(responseLanguage, "title"),
      venue: "Unspecified",
      objective: defaultDisplayText(responseLanguage, "objective"),
      deadline: "",
      thesis: defaultDisplayText(responseLanguage, "thesis"),
      audience: "TBD"
    },
    pipeline: {
      currentStage: "init",
      lastCompletedStage: null,
      resumeCommand: "project:dove.status",
      updatedAt: (/* @__PURE__ */ new Date(0)).toISOString()
    },
    orchestration: {
      boardPath: ARTIFACT_PATHS.orchestrationBoard,
      handoffPath: ARTIFACT_PATHS.orchestrationHandoffs,
      phase: "init",
      intentType: "plan",
      assignedRole: "planner",
      currentFocus: defaultDisplayText(responseLanguage, "currentFocus"),
      nextAction: defaultDisplayText(responseLanguage, "nextAction"),
      continuationState: createContinuationState({ responseLanguage }),
      reviewRequiredBeforeFinalize: false,
      activeTaskIds: [],
      blockerIds: [],
      evidenceLinks: [],
      experimentIds: [],
      rebuttalIssueIds: [],
      currentVersionId: null,
      activeComparisonTargets: []
    },
    sections: defaultSections(),
    artifacts: {
      ...ARTIFACT_PATHS
    },
    reviews: {
      lastVerdict: "not-reviewed",
      lastReviewedAt: null,
      openItems: [],
      unresolvedConcernIds: []
    },
    settings: baseSettings
  };
  const incomingDove = overrides.dove ?? overrides.paper ?? {};
  return {
    ...base,
    ...overrides,
    dove: {
      ...base.dove,
      ...incomingDove
    },
    pipeline: {
      ...base.pipeline,
      ...overrides.pipeline ?? {}
    },
    orchestration: normalizeOrchestration(overrides.orchestration, base.orchestration),
    sections: normalizeSections(overrides.sections),
    artifacts: {
      ...ARTIFACT_PATHS,
      ...overrides.artifacts ?? {}
    },
    reviews: {
      ...base.reviews,
      ...overrides.reviews ?? {},
      openItems: Array.isArray(overrides.reviews?.openItems) ? overrides.reviews.openItems : [],
      unresolvedConcernIds: Array.isArray(overrides.reviews?.unresolvedConcernIds) ? overrides.reviews.unresolvedConcernIds : []
    },
    settings: normalizeSettings(overrides.settings, base.settings),
    paper: void 0
  };
}
function normalizeSections(rawSections) {
  const merged = defaultSections();
  if (!rawSections || typeof rawSections !== "object") {
    return merged;
  }
  for (const [id, section] of Object.entries(rawSections)) {
    merged[id] = {
      ...merged[id] ?? {
        id,
        title: id,
        status: "planned",
        summary: "",
        draftPath: `.dove/drafts/${id}.md`,
        claimIds: []
      },
      ...section,
      id,
      draftPath: section?.draftPath ?? `.dove/drafts/${id}.md`,
      claimIds: Array.isArray(section?.claimIds) ? section.claimIds : []
    };
  }
  return merged;
}
function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}
function normalizeString(value, fallback) {
  return typeof value === "string" && value.trim() ? value : fallback;
}
function normalizeStringArray(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  return source.filter((item) => typeof item === "string" && item.trim());
}
function normalizeObjectArray(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : [];
}
function normalizeObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}
function normalizeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}
function normalizeNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}
function normalizeStringArrayRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, items]) => [key, normalizeStringArray(items)])
  );
}
function createLifecycleFamilySummary(overrides = {}) {
  return PAPER_LIFECYCLE_FAMILIES.map((family) => {
    const incoming = overrides[family.id] && typeof overrides[family.id] === "object" && !Array.isArray(overrides[family.id]) ? overrides[family.id] : {};
    return {
      id: family.id,
      label: family.label,
      summary: family.summary,
      roleHints: normalizeStringArray(incoming.roleHints, family.roleHints),
      artifactPathKeys: normalizeStringArray(incoming.artifactPathKeys, family.artifactPathKeys),
      artifactCount: normalizeNumber(incoming.artifactCount, 0),
      activePacketCount: normalizeNumber(incoming.activePacketCount, 0),
      packetCount: normalizeNumber(incoming.packetCount, 0)
    };
  });
}
function normalizeLifecycleFamilyId(value, fallback = null) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return PAPER_LIFECYCLE_FAMILY_IDS.includes(normalized) ? normalized : fallback;
}
function normalizeDoveDomainId(value, fallback = "paper") {
  const normalized = typeof value === "string" ? value.trim() : "";
  return DOVE_DOMAIN_IDS.includes(normalized) ? normalized : fallback;
}
function normalizeDoveMissionLifecycleStage(value, fallback = "goal") {
  const normalized = typeof value === "string" ? value.trim() : "";
  return DOVE_MISSION_LIFECYCLE_STAGES.includes(normalized) ? normalized : fallback;
}
function normalizeDoveBoundaryType(value, fallback = "workflow-error-boundary") {
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/_/g, "-") : "";
  return DOVE_BOUNDARY_TYPES.includes(normalized) ? normalized : fallback;
}
function normalizeDoveBoundaryStatus(value, fallback = "open") {
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/_/g, "-") : "";
  return DOVE_BOUNDARY_STATUSES.includes(normalized) ? normalized : fallback;
}
function normalizeDoveHandoffStatus(value, fallback = "none") {
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/_/g, "-") : "";
  return DOVE_HANDOFF_STATUSES.includes(normalized) ? normalized : fallback;
}
function normalizeDovePrimaryRoleId(value, fallback = "builder") {
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/_/g, "-") : "";
  return DOVE_PRIMARY_ROLE_IDS.includes(normalized) ? normalized : fallback;
}
function normalizeDoveBoundary(value, fallback = null) {
  const source = normalizeObject(value, fallback);
  if (!source || Object.keys(source).length === 0) {
    return fallback;
  }
  const type = normalizeDoveBoundaryType(source.type ?? source.boundaryType, fallback?.type ?? "workflow-error-boundary");
  const status = normalizeDoveBoundaryStatus(source.status ?? source.boundaryStatus, fallback?.status ?? "open");
  return {
    ...source,
    id: normalizeString(source.id ?? source.boundaryId, fallback?.id ?? `boundary-${type}`),
    type,
    status,
    packetId: normalizeString(source.packetId ?? source.taskPacketId, fallback?.packetId ?? null),
    runId: normalizeString(source.runId, fallback?.runId ?? null),
    sourceSurface: normalizeString(source.sourceSurface ?? source.surface, fallback?.sourceSurface ?? null),
    command: normalizeString(source.command, fallback?.command ?? null),
    reason: normalizeString(source.reason ?? source.stopReason, fallback?.reason ?? ""),
    summary: normalizeString(source.summary, fallback?.summary ?? ""),
    requiredInputs: normalizeStringArray(source.requiredInputs, fallback?.requiredInputs ?? []),
    requiredActions: normalizeStringArray(source.requiredActions, fallback?.requiredActions ?? []),
    ownerRole: normalizeDovePrimaryRoleId(source.ownerRole, fallback?.ownerRole ?? "builder"),
    nextRole: normalizeDovePrimaryRoleId(source.nextRole, fallback?.nextRole ?? source.ownerRole ?? "builder"),
    createdAt: source.createdAt ?? fallback?.createdAt ?? null,
    resolvedAt: source.resolvedAt ?? fallback?.resolvedAt ?? null,
    resolution: normalizeString(source.resolution, fallback?.resolution ?? null)
  };
}
function normalizeDoveHandoff(value, fallback = null) {
  const source = normalizeObject(value, fallback);
  if (!source || Object.keys(source).length === 0) {
    return fallback;
  }
  const status = normalizeDoveHandoffStatus(source.status, fallback?.status ?? "pending");
  const toRole = normalizeDovePrimaryRoleId(source.toRole ?? source.nextRole, fallback?.toRole ?? "builder");
  return {
    ...source,
    id: normalizeString(source.id ?? source.handoffId, fallback?.id ?? `handoff-${toRole}`),
    status,
    fromRole: normalizeDovePrimaryRoleId(source.fromRole ?? source.ownerRole, fallback?.fromRole ?? "planner"),
    toRole,
    reason: normalizeString(source.reason, fallback?.reason ?? ""),
    summary: normalizeString(source.summary, fallback?.summary ?? ""),
    boundaryId: normalizeString(source.boundaryId, fallback?.boundaryId ?? null),
    sourceRunId: normalizeString(source.sourceRunId ?? source.runId, fallback?.sourceRunId ?? null),
    requestedAt: source.requestedAt ?? fallback?.requestedAt ?? null,
    acceptedAt: source.acceptedAt ?? fallback?.acceptedAt ?? null,
    completedAt: source.completedAt ?? fallback?.completedAt ?? null
  };
}
var DOVE_EXECUTION_CHAIN_TYPES = [
  "paper-source-note-draft-review",
  "experiment-plan-result-audit",
  "engineering-host-pass-verify",
  "plan-to-executable-missions"
];
function normalizeExecutionStrings(value, fallback = []) {
  const values = Array.isArray(value) ? value : typeof value === "string" && value.trim() ? [value] : fallback;
  return Array.from(new Set(values.map((item) => String(item).trim()).filter(Boolean)));
}
function normalizeExecutionFile(value) {
  const source = normalizeObject(value, null);
  if (!source) {
    return null;
  }
  const file = {
    path: normalizeString(source.path, null),
    action: normalizeString(source.action, null),
    target: normalizeString(source.target, null),
    change: normalizeString(source.change, null)
  };
  return Object.values(file).some(Boolean) ? file : null;
}
function normalizeExecutionRoute(value) {
  const source = normalizeObject(value, null);
  if (!source) {
    return null;
  }
  const route = {
    on: normalizeString(source.on, null),
    boundaryType: normalizeDoveBoundaryType(source.boundaryType, "blocked-boundary"),
    nextAction: normalizeString(source.nextAction, null),
    requiredActions: normalizeExecutionStrings(source.requiredActions)
  };
  return route.on || route.nextAction || route.requiredActions.length > 0 ? route : null;
}
function normalizeDoveExecutionContract(value, fallback = null) {
  const source = normalizeObject(value, null);
  const base = normalizeObject(fallback, {});
  if (!source && Object.keys(base).length === 0) {
    return null;
  }
  const materialSource = normalizeObject(source?.materials, base.materials ?? {});
  const convergenceSource = normalizeObject(source?.convergence, base.convergence ?? {});
  const chainType = normalizeString(source?.chainType, base.chainType ?? "engineering-host-pass-verify");
  return {
    chainType: DOVE_EXECUTION_CHAIN_TYPES.includes(chainType) ? chainType : "engineering-host-pass-verify",
    roleSequence: normalizeExecutionStrings(source?.roleSequence, base.roleSequence ?? ["planner", "builder", "reviewer"]).map((role) => normalizeDovePrimaryRoleId(role, "builder")),
    readFirst: normalizeExecutionStrings(source?.readFirst, base.readFirst ?? []),
    action: normalizeString(source?.action, base.action ?? ""),
    implementation: normalizeExecutionStrings(source?.implementation, base.implementation ?? []),
    files: normalizeObjectArray(source?.files ?? base.files).map(normalizeExecutionFile).filter(Boolean),
    materials: {
      requiredInputs: normalizeExecutionStrings(materialSource.requiredInputs),
      requiredArtifacts: normalizeExecutionStrings(materialSource.requiredArtifacts),
      sourceRefs: normalizeExecutionStrings(materialSource.sourceRefs),
      artifactRefs: normalizeExecutionStrings(materialSource.artifactRefs)
    },
    convergence: {
      criteria: normalizeExecutionStrings(convergenceSource.criteria),
      verificationCommands: normalizeExecutionStrings(convergenceSource.verificationCommands),
      evidenceRequired: normalizeExecutionStrings(convergenceSource.evidenceRequired),
      definitionOfDone: normalizeString(convergenceSource.definitionOfDone, "")
    },
    failureRoutes: normalizeObjectArray(source?.failureRoutes ?? base.failureRoutes).map(normalizeExecutionRoute).filter(Boolean)
  };
}
function doveExecutionContractReadiness(value) {
  const contract = normalizeDoveExecutionContract(value, null);
  if (!contract) {
    return {
      ready: false,
      status: "missing-executable-contract",
      missing: ["executionContract"],
      criteria: [],
      evidenceRequired: [],
      requiredMaterials: []
    };
  }
  const missing = [
    contract.action ? null : "action",
    contract.implementation.length > 0 ? null : "implementation",
    contract.convergence.criteria.length > 0 ? null : "convergence.criteria",
    contract.failureRoutes.length > 0 ? null : "failureRoutes"
  ].filter(Boolean);
  return {
    ready: missing.length === 0,
    status: missing.length === 0 ? "ready" : "missing-executable-contract",
    missing,
    criteria: contract.convergence.criteria,
    evidenceRequired: contract.convergence.evidenceRequired,
    requiredMaterials: [
      ...contract.materials.requiredInputs,
      ...contract.materials.requiredArtifacts,
      ...contract.materials.sourceRefs,
      ...contract.materials.artifactRefs
    ]
  };
}
function normalizeDoveVerifiedCriteria(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => {
    if (typeof item === "string" && item.trim()) {
      return { criterion: item.trim(), status: "verified", evidencePaths: [] };
    }
    const source = normalizeObject(item, null);
    if (!source) {
      return null;
    }
    const criterion = normalizeString(source.criterion, null);
    if (!criterion) {
      return null;
    }
    return {
      criterion,
      status: normalizeString(source.status, "verified"),
      evidencePaths: normalizeExecutionStrings(source.evidencePaths)
    };
  }).filter(Boolean);
}
function doveExecutionCriteriaCoverage(contractValue, verifiedCriteriaValue) {
  const contract = normalizeDoveExecutionContract(contractValue, null);
  const required = contract?.convergence.criteria ?? [];
  const verified = normalizeDoveVerifiedCriteria(verifiedCriteriaValue).filter((item) => ["verified", "passed", "met"].includes(String(item.status).trim().toLowerCase()));
  const verifiedKeys = new Set(verified.map((item) => item.criterion.trim().toLowerCase()));
  const missing = required.filter((criterion) => !verifiedKeys.has(criterion.trim().toLowerCase()));
  return {
    complete: required.length === 0 || missing.length === 0,
    required,
    verified,
    missing
  };
}
function normalizeDoveExecutionReceipt(value, fallback = null) {
  const source = normalizeObject(value, null);
  const base = normalizeObject(fallback, {});
  if (!source && Object.keys(base).length === 0) {
    return null;
  }
  const lifecycleSource = normalizeObject(source?.lifecycleTransition, base.lifecycleTransition ?? {});
  const coverageSource = normalizeObject(source?.criteriaCoverage, base.criteriaCoverage ?? null);
  const receipt = {
    receiptId: normalizeString(source?.receiptId, base.receiptId ?? normalizeString(source?.id, base.id ?? null)),
    runId: normalizeString(source?.runId, base.runId ?? null),
    packetId: normalizeString(source?.packetId, base.packetId ?? null),
    command: normalizeString(source?.command, base.command ?? null),
    surface: normalizeString(source?.surface, base.surface ?? null),
    actionType: normalizeString(source?.actionType, base.actionType ?? null),
    startedAt: normalizeString(source?.startedAt, base.startedAt ?? null),
    completedAt: normalizeString(source?.completedAt, base.completedAt ?? null),
    status: normalizeString(source?.status, base.status ?? null),
    outcome: normalizeString(source?.outcome, base.outcome ?? null),
    resultSummary: normalizeString(source?.resultSummary, base.resultSummary ?? normalizeString(source?.summary, base.summary ?? null)),
    publicSafeSummary: normalizeString(source?.publicSafeSummary, base.publicSafeSummary ?? null),
    nextAction: normalizeString(source?.nextAction, base.nextAction ?? null),
    lifecycleTransition: {
      previousStatus: normalizeString(lifecycleSource.previousStatus, null),
      nextStatus: normalizeString(lifecycleSource.nextStatus, null)
    },
    artifactRefs: normalizeExecutionStrings(source?.artifactRefs, base.artifactRefs ?? []),
    artifactPaths: normalizeExecutionStrings(source?.artifactPaths, base.artifactPaths ?? []),
    evidenceLinks: normalizeExecutionStrings(source?.evidenceLinks, base.evidenceLinks ?? []),
    evidencePaths: normalizeExecutionStrings(source?.evidencePaths, base.evidencePaths ?? []),
    validationEvidencePaths: normalizeExecutionStrings(source?.validationEvidencePaths, base.validationEvidencePaths ?? []),
    verificationEvidencePaths: normalizeExecutionStrings(source?.verificationEvidencePaths, base.verificationEvidencePaths ?? []),
    verifiedCriteria: normalizeDoveVerifiedCriteria(source?.verifiedCriteria ?? base.verifiedCriteria),
    criteriaCoverage: coverageSource ? {
      complete: normalizeBoolean(coverageSource.complete, false),
      required: normalizeExecutionStrings(coverageSource.required),
      missing: normalizeExecutionStrings(coverageSource.missing),
      verified: normalizeDoveVerifiedCriteria(coverageSource.verified)
    } : null,
    validationGateResults: normalizeObjectArray(source?.validationGateResults ?? base.validationGateResults),
    boundary: normalizeObject(source?.boundary, base.boundary ?? null)
  };
  return Object.fromEntries(Object.entries(receipt).filter(([, item]) => item !== null));
}
function createDoveRoleSummary(overrides = {}) {
  const roleOverrides = Object.fromEntries(normalizeObjectArray(overrides).map((role) => [role.id, role]));
  return DOVE_PRIMARY_ROLES.map((role) => ({
    ...role,
    ...normalizeObject(roleOverrides[role.id]),
    id: role.id,
    label: normalizeString(roleOverrides[role.id]?.label, role.label),
    summary: normalizeString(roleOverrides[role.id]?.summary, role.summary)
  }));
}
function createDoveDomainGuidance(overrides = {}) {
  const domainOverrides = Object.fromEntries(normalizeObjectArray(overrides).map((domain) => [domain.id, domain]));
  return DOVE_DOMAIN_GUIDANCE.map((domain) => {
    const incoming = normalizeObject(domainOverrides[domain.id]);
    const incomingStageRoutes = normalizeObject(incoming.stageRoutes);
    return {
      ...domain,
      ...incoming,
      id: domain.id,
      label: normalizeString(incoming.label, domain.label),
      summary: normalizeString(incoming.summary, domain.summary),
      stageRoutes: Object.fromEntries(DOVE_MISSION_LIFECYCLE_STAGES.map((stage) => [stage, normalizeString(incomingStageRoutes[stage], domain.stageRoutes[stage])])),
      returnEvidence: normalizeStringArray(incoming.returnEvidence, domain.returnEvidence)
    };
  });
}
function createDoveAuthorityManifest() {
  return {
    version: 1,
    status: "authoritative",
    strategy: "dove-direct",
    activeDurableRoot: ARTIFACT_PATHS.doveRoot,
    authoritativeRoot: ARTIFACT_PATHS.doveRoot,
    manifestPath: ARTIFACT_PATHS.doveRootManifest,
    currentWriteAuthority: ARTIFACT_PATHS.doveRoot,
    legacyRoot: ".paper",
    dualRootInvariant: {
      allowed: false,
      doveRootAuthoritative: true,
      legacyRootAuthoritative: false,
      reason: ".dove is the only authoritative durable root for Dove."
    },
    phases: [
      {
        id: "dove-direct-authority",
        status: "active",
        summary: "Dove owns the package identity, command language, MCP identity, and .dove durable root."
      }
    ],
    nextDecision: "Use Dove surfaces directly; old .paper state is not read as runtime authority."
  };
}
function normalizeDoveAuthorityManifest(raw = {}, fallback = null) {
  const base = fallback ?? createDoveAuthorityManifest();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const dualRootInvariant = normalizeObject(raw.dualRootInvariant);
  return {
    ...base,
    ...raw,
    version: 1,
    status: normalizeString(raw.status, base.status),
    strategy: normalizeString(raw.strategy, base.strategy),
    activeDurableRoot: normalizeString(raw.activeDurableRoot, base.activeDurableRoot),
    authoritativeRoot: normalizeString(raw.authoritativeRoot, base.authoritativeRoot),
    manifestPath: normalizeString(raw.manifestPath, base.manifestPath),
    currentWriteAuthority: normalizeString(raw.currentWriteAuthority, base.currentWriteAuthority),
    legacyRoot: normalizeString(raw.legacyRoot, base.legacyRoot),
    dualRootInvariant: {
      ...base.dualRootInvariant,
      ...dualRootInvariant,
      allowed: normalizeBoolean(dualRootInvariant.allowed, base.dualRootInvariant.allowed),
      doveRootAuthoritative: normalizeBoolean(dualRootInvariant.doveRootAuthoritative, base.dualRootInvariant.doveRootAuthoritative),
      legacyRootAuthoritative: normalizeBoolean(dualRootInvariant.legacyRootAuthoritative, base.dualRootInvariant.legacyRootAuthoritative),
      reason: normalizeString(dualRootInvariant.reason, base.dualRootInvariant.reason)
    },
    phases: normalizeObjectArray(raw.phases).length > 0 ? normalizeObjectArray(raw.phases).map((phase) => ({
      id: normalizeString(phase.id, "unknown"),
      status: normalizeString(phase.status, "unknown"),
      summary: normalizeString(phase.summary, "No summary provided.")
    })) : base.phases,
    nextDecision: normalizeString(raw.nextDecision, base.nextDecision)
  };
}
function createDoveWorkspaceKernel() {
  return {
    kernelVersion: DOVE_WORKFLOW_KERNEL_VERSION,
    unified: true,
    explicitOnly: true,
    noHiddenRuntime: true,
    identity: {
      productName: "Dove",
      packageName: "dove",
      publicCli: "dove",
      commandPrefix: "project:dove.",
      activeDurableRoot: ARTIFACT_PATHS.doveRoot,
      durableRootStatus: "authoritative",
      overview: "Dove is the product, CLI, MCP identity, command language, and durable workspace authority."
    },
    authorityManifest: createDoveAuthorityManifest(),
    currentDomain: "paper",
    domainIds: DOVE_DOMAIN_IDS,
    primaryRoleIds: DOVE_PRIMARY_ROLE_IDS,
    primaryRoles: createDoveRoleSummary(),
    domainGuidance: createDoveDomainGuidance(),
    missionLifecycle: {
      stages: DOVE_MISSION_LIFECYCLE_STAGES,
      currentStage: "goal",
      paperProtocolStages: PAPER_MAJOR_CHANGE_PROTOCOL_STAGES,
      overview: "Dove missions close through goal, design, checklist, execution, audit, and return."
    },
    missionModel: {
      workUnitName: "mission",
      sourcePacketName: "mission-packet",
      domainField: "doveDomain",
      goalField: "goal",
      returnArtifactName: "handoff",
      acceptanceField: "acceptance",
      durableRoot: ARTIFACT_PATHS.doveRoot
    },
    missionCount: 0,
    activeMissionCount: 0,
    reviewNeededMissionCount: 0,
    domainCounts: Object.fromEntries(DOVE_DOMAIN_IDS.map((domainId) => [domainId, 0])),
    currentMissionFamily: null,
    overview: "Dove is active: paper-domain workflows and engineering missions share one authoritative mission kernel."
  };
}
function normalizeWorkspaceDove(raw = {}, fallback = null) {
  const base = fallback ?? createDoveWorkspaceKernel();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const identity = normalizeObject(raw.identity);
  const authorityManifest = normalizeObject(raw.authorityManifest);
  const missionLifecycle = normalizeObject(raw.missionLifecycle);
  const missionModel = normalizeObject(raw.missionModel);
  const domainCounts = normalizeObject(raw.domainCounts);
  const { taskCenteredCommands: _legacyTaskCenteredCommands, ...rawDove } = raw;
  return {
    ...base,
    ...rawDove,
    kernelVersion: normalizeString(raw.kernelVersion, base.kernelVersion),
    unified: normalizeBoolean(raw.unified, base.unified),
    explicitOnly: normalizeBoolean(raw.explicitOnly, base.explicitOnly),
    noHiddenRuntime: normalizeBoolean(raw.noHiddenRuntime, base.noHiddenRuntime),
    identity: {
      ...base.identity,
      ...identity,
      productName: normalizeString(identity.productName, base.identity.productName),
      packageName: normalizeString(identity.packageName, base.identity.packageName),
      publicCli: normalizeString(identity.publicCli, base.identity.publicCli),
      commandPrefix: normalizeString(identity.commandPrefix, base.identity.commandPrefix),
      activeDurableRoot: normalizeString(identity.activeDurableRoot, base.identity.activeDurableRoot),
      durableRootStatus: normalizeString(identity.durableRootStatus, base.identity.durableRootStatus),
      overview: normalizeString(identity.overview, base.identity.overview)
    },
    authorityManifest: normalizeDoveAuthorityManifest(authorityManifest, base.authorityManifest),
    currentDomain: normalizeDoveDomainId(raw.currentDomain, base.currentDomain),
    domainIds: DOVE_DOMAIN_IDS,
    primaryRoleIds: DOVE_PRIMARY_ROLE_IDS,
    primaryRoles: createDoveRoleSummary(raw.primaryRoles),
    domainGuidance: createDoveDomainGuidance(raw.domainGuidance),
    missionLifecycle: {
      ...base.missionLifecycle,
      ...missionLifecycle,
      stages: normalizeStringArray(missionLifecycle.stages, DOVE_MISSION_LIFECYCLE_STAGES).filter((stage) => DOVE_MISSION_LIFECYCLE_STAGES.includes(stage)),
      currentStage: normalizeDoveMissionLifecycleStage(missionLifecycle.currentStage, base.missionLifecycle.currentStage),
      paperProtocolStages: normalizeStringArray(missionLifecycle.paperProtocolStages, PAPER_MAJOR_CHANGE_PROTOCOL_STAGES).filter((stage) => PAPER_MAJOR_CHANGE_PROTOCOL_STAGES.includes(stage)),
      overview: normalizeString(missionLifecycle.overview, base.missionLifecycle.overview)
    },
    missionModel: {
      ...base.missionModel,
      ...missionModel,
      workUnitName: normalizeString(missionModel.workUnitName, base.missionModel.workUnitName),
      sourcePacketName: normalizeString(missionModel.sourcePacketName, base.missionModel.sourcePacketName),
      domainField: normalizeString(missionModel.domainField, base.missionModel.domainField),
      goalField: normalizeString(missionModel.goalField, base.missionModel.goalField),
      returnArtifactName: normalizeString(missionModel.returnArtifactName, base.missionModel.returnArtifactName),
      acceptanceField: normalizeString(missionModel.acceptanceField, base.missionModel.acceptanceField),
      durableRoot: normalizeString(missionModel.durableRoot, base.missionModel.durableRoot)
    },
    missionCount: normalizeNumber(raw.missionCount, base.missionCount),
    activeMissionCount: normalizeNumber(raw.activeMissionCount, base.activeMissionCount),
    reviewNeededMissionCount: normalizeNumber(raw.reviewNeededMissionCount, base.reviewNeededMissionCount),
    domainCounts: Object.fromEntries(DOVE_DOMAIN_IDS.map((domainId) => [domainId, normalizeNumber(domainCounts[domainId], base.domainCounts[domainId] ?? 0)])),
    currentMissionFamily: normalizeLifecycleFamilyId(raw.currentMissionFamily, base.currentMissionFamily),
    overview: normalizeString(raw.overview, base.overview)
  };
}
function normalizeWorkspaceLifecycle(raw = {}, fallback = null) {
  const base = fallback ?? {
    taxonomyVersion: PAPER_LIFECYCLE_TAXONOMY_VERSION,
    familyIds: PAPER_LIFECYCLE_FAMILY_IDS,
    families: createLifecycleFamilySummary(),
    artifactCounts: Object.fromEntries(PAPER_LIFECYCLE_FAMILY_IDS.map((familyId) => [familyId, 0])),
    activePacketCounts: Object.fromEntries(PAPER_LIFECYCLE_FAMILY_IDS.map((familyId) => [familyId, 0])),
    packetCounts: Object.fromEntries(PAPER_LIFECYCLE_FAMILY_IDS.map((familyId) => [familyId, 0])),
    boardFamily: null,
    boardPhaseFamily: null,
    topFamilies: [],
    protocol: {
      stages: PAPER_MAJOR_CHANGE_PROTOCOL_STAGES,
      majorChangeSignals: PAPER_MAJOR_CHANGE_SIGNALS,
      overview: "Major paper changes should close through design, checklist, implementation, and acceptance."
    }
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const familyOverrides = Object.fromEntries(normalizeObjectArray(raw.families).map((family) => [family.id, family]));
  const artifactCounts = normalizeObject(raw.artifactCounts);
  const activePacketCounts = normalizeObject(raw.activePacketCounts);
  const packetCounts = normalizeObject(raw.packetCounts);
  const protocol = normalizeObject(raw.protocol);
  return {
    ...base,
    ...raw,
    taxonomyVersion: normalizeString(raw.taxonomyVersion, PAPER_LIFECYCLE_TAXONOMY_VERSION),
    familyIds: PAPER_LIFECYCLE_FAMILY_IDS,
    families: createLifecycleFamilySummary(familyOverrides),
    artifactCounts: Object.fromEntries(PAPER_LIFECYCLE_FAMILY_IDS.map((familyId) => [familyId, normalizeNumber(artifactCounts[familyId], 0)])),
    activePacketCounts: Object.fromEntries(PAPER_LIFECYCLE_FAMILY_IDS.map((familyId) => [familyId, normalizeNumber(activePacketCounts[familyId], 0)])),
    packetCounts: Object.fromEntries(PAPER_LIFECYCLE_FAMILY_IDS.map((familyId) => [familyId, normalizeNumber(packetCounts[familyId], 0)])),
    boardFamily: normalizeLifecycleFamilyId(raw.boardFamily, base.boardFamily),
    boardPhaseFamily: normalizeLifecycleFamilyId(raw.boardPhaseFamily, base.boardPhaseFamily),
    topFamilies: normalizeStringArray(raw.topFamilies).filter((familyId) => PAPER_LIFECYCLE_FAMILY_IDS.includes(familyId)),
    protocol: {
      ...base.protocol,
      ...protocol,
      stages: normalizeStringArray(protocol.stages, PAPER_MAJOR_CHANGE_PROTOCOL_STAGES).filter((stage) => PAPER_MAJOR_CHANGE_PROTOCOL_STAGES.includes(stage)),
      majorChangeSignals: normalizeStringArray(protocol.majorChangeSignals, PAPER_MAJOR_CHANGE_SIGNALS).filter((signal) => PAPER_MAJOR_CHANGE_SIGNALS.includes(signal)),
      overview: normalizeString(protocol.overview, base.protocol.overview)
    }
  };
}
function normalizeContinuation(value) {
  if (!value || typeof value !== "object") {
    return createContinuationState();
  }
  return createContinuationState(value);
}
function normalizeOrchestration(raw = {}, defaults = {}) {
  return {
    ...defaults,
    ...raw,
    continuationState: normalizeContinuation(raw.continuationState ?? defaults.continuationState),
    activeTaskIds: normalizeArray(raw.activeTaskIds),
    blockerIds: normalizeArray(raw.blockerIds),
    evidenceLinks: normalizeArray(raw.evidenceLinks),
    experimentIds: normalizeArray(raw.experimentIds),
    rebuttalIssueIds: normalizeArray(raw.rebuttalIssueIds),
    activeComparisonTargets: normalizeArray(raw.activeComparisonTargets)
  };
}
function normalizeState(raw = {}) {
  if (!raw || typeof raw !== "object") {
    return createDefaultState();
  }
  if (raw.version === 1) {
    return createDefaultState({
      dove: {
        title: raw.projectTitle ?? defaultDisplayText(DEFAULT_DOVE_RESPONSE_LANGUAGE, "title"),
        venue: raw.venue ?? "Unspecified",
        objective: raw.objective ?? defaultDisplayText(DEFAULT_DOVE_RESPONSE_LANGUAGE, "objective"),
        deadline: raw.deadline ?? "",
        thesis: defaultDisplayText(DEFAULT_DOVE_RESPONSE_LANGUAGE, "thesis"),
        audience: "TBD"
      },
      pipeline: {
        currentStage: raw.currentPhase ?? "init",
        lastCompletedStage: null,
        resumeCommand: "project:dove.status",
        updatedAt: raw.updatedAt ?? (/* @__PURE__ */ new Date(0)).toISOString()
      },
      orchestration: {
        phase: raw.currentPhase ?? "init"
      }
    });
  }
  if (raw.version === 2) {
    return createDefaultState({
      ...raw,
      version: SCHEMA_VERSION,
      orchestration: {
        phase: raw.pipeline?.currentStage ?? "init",
        assignedRole: raw.pipeline?.currentStage === "review" ? "reviewer" : "planner",
        activeTaskIds: [],
        blockerIds: [],
        evidenceLinks: [],
        experimentIds: [],
        rebuttalIssueIds: [],
        currentVersionId: null,
        activeComparisonTargets: []
      },
      pipeline: {
        ...raw.pipeline ?? {},
        resumeCommand: raw.pipeline?.resumeCommand ?? "project:dove.status"
      }
    });
  }
  const defaults = createDefaultState({ settings: raw.settings });
  return {
    ...defaults,
    ...raw,
    version: SCHEMA_VERSION,
    dove: {
      ...defaults.dove,
      ...raw.dove ?? raw.paper ?? {}
    },
    paper: void 0,
    pipeline: {
      ...defaults.pipeline,
      ...raw.pipeline ?? {}
    },
    orchestration: normalizeOrchestration(raw.orchestration, defaults.orchestration),
    sections: normalizeSections(raw.sections),
    artifacts: {
      ...ARTIFACT_PATHS,
      ...raw.artifacts ?? {}
    },
    reviews: {
      ...defaults.reviews,
      ...raw.reviews ?? {},
      openItems: Array.isArray(raw.reviews?.openItems) ? raw.reviews.openItems : [],
      unresolvedConcernIds: Array.isArray(raw.reviews?.unresolvedConcernIds) ? raw.reviews.unresolvedConcernIds : []
    },
    settings: normalizeSettings(raw.settings, defaults.settings)
  };
}
function normalizeWorkspaceIndex(raw = {}) {
  const base = createWorkspaceIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const workQueues = normalizeObject(raw.workQueues);
  const resumeGuidance = normalizeObject(raw.resumeGuidance);
  const contextSurfaces = normalizeObject(raw.contextSurfaces);
  const behaviorDiscipline = normalizeObject(raw.behaviorDiscipline);
  const dependencyHealth = normalizeObject(raw.dependencyHealth);
  const repairFrontier = normalizeObject(raw.repairFrontier);
  const metaOptimize = normalizeObject(raw.metaOptimize);
  const runtime = normalizeObject(raw.runtime);
  const programs = normalizeObject(raw.programs);
  const campaigns = normalizeObject(raw.campaigns);
  const autonomyLoops = normalizeObject(raw.autonomyLoops);
  const lifecycle = normalizeObject(raw.lifecycle);
  const dove = normalizeObject(raw.dove);
  const latestVersions = normalizeObject(raw.latestVersions);
  return {
    ...base,
    ...raw,
    version: base.version,
    managed: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workspaceIndex),
    boardPhase: normalizeString(raw.boardPhase, base.boardPhase),
    boardAssignedRole: normalizeString(raw.boardAssignedRole, base.boardAssignedRole),
    boardIntentType: normalizeString(raw.boardIntentType, base.boardIntentType),
    currentFocus: normalizeString(raw.currentFocus, base.currentFocus),
    nextAction: normalizeString(raw.nextAction, base.nextAction),
    continuationState: normalizeContinuation(raw.continuationState),
    activePackets: normalizeObjectArray(raw.activePackets),
    workQueues: {
      ready: normalizeObjectArray(workQueues.ready),
      waiting: normalizeObjectArray(workQueues.waiting),
      reviewNeeded: normalizeObjectArray(workQueues.reviewNeeded),
      handoff: normalizeObjectArray(workQueues.handoff),
      stale: normalizeObjectArray(workQueues.stale),
      archived: normalizeObjectArray(workQueues.archived)
    },
    ownershipSummary: normalizeObjectArray(raw.ownershipSummary),
    packetLifecycleCounts: normalizeObject(raw.packetLifecycleCounts),
    handoffObligations: normalizeObjectArray(raw.handoffObligations),
    resumeGuidance: {
      ...base.resumeGuidance,
      ...resumeGuidance,
      command: normalizeString(resumeGuidance.command, base.resumeGuidance.command),
      summary: normalizeString(resumeGuidance.summary, base.resumeGuidance.summary),
      prioritizedPacketIds: normalizeStringArray(resumeGuidance.prioritizedPacketIds),
      packetContextPaths: normalizeStringArray(resumeGuidance.packetContextPaths),
      handoffCandidateIds: normalizeStringArray(resumeGuidance.handoffCandidateIds)
    },
    contextSurfaces: {
      ...base.contextSurfaces,
      ...contextSurfaces,
      currentRoleContextPath: normalizeString(contextSurfaces.currentRoleContextPath, base.contextSurfaces.currentRoleContextPath),
      currentPhaseContextPath: normalizeString(contextSurfaces.currentPhaseContextPath, base.contextSurfaces.currentPhaseContextPath),
      currentActionContextPath: normalizeString(contextSurfaces.currentActionContextPath, base.contextSurfaces.currentActionContextPath),
      prioritizedArtifactContextPaths: normalizeStringArray(contextSurfaces.prioritizedArtifactContextPaths),
      prioritizedPacketActionContextPaths: normalizeStringArray(contextSurfaces.prioritizedPacketActionContextPaths)
    },
    behaviorDiscipline: {
      ...base.behaviorDiscipline,
      ...behaviorDiscipline,
      summary: normalizeString(behaviorDiscipline.summary, base.behaviorDiscipline.summary),
      explicitOnly: normalizeBoolean(behaviorDiscipline.explicitOnly, base.behaviorDiscipline.explicitOnly),
      noHiddenRuntime: normalizeBoolean(behaviorDiscipline.noHiddenRuntime, base.behaviorDiscipline.noHiddenRuntime),
      requiredReadOrder: normalizeStringArray(behaviorDiscipline.requiredReadOrder)
    },
    dependencyHealth: {
      blockedPacketIds: normalizeStringArray(dependencyHealth.blockedPacketIds),
      healthyPacketIds: normalizeStringArray(dependencyHealth.healthyPacketIds),
      waitingPacketIds: normalizeStringArray(dependencyHealth.waitingPacketIds),
      stalePacketIds: normalizeStringArray(dependencyHealth.stalePacketIds),
      missingDependencyIds: normalizeStringArray(dependencyHealth.missingDependencyIds),
      orphanPacketIds: normalizeStringArray(dependencyHealth.orphanPacketIds)
    },
    repairFrontier: {
      ...base.repairFrontier,
      ...repairFrontier,
      count: Number.isFinite(repairFrontier.count) ? repairFrontier.count : base.repairFrontier.count,
      relationIssueCount: Number.isFinite(repairFrontier.relationIssueCount) ? repairFrontier.relationIssueCount : base.repairFrontier.relationIssueCount,
      relationFamilyIssueCount: Number.isFinite(repairFrontier.relationFamilyIssueCount) ? repairFrontier.relationFamilyIssueCount : base.repairFrontier.relationFamilyIssueCount,
      managedArtifactIssueCount: Number.isFinite(repairFrontier.managedArtifactIssueCount) ? repairFrontier.managedArtifactIssueCount : base.repairFrontier.managedArtifactIssueCount,
      governanceIssueCount: Number.isFinite(repairFrontier.governanceIssueCount) ? repairFrontier.governanceIssueCount : base.repairFrontier.governanceIssueCount,
      topDegradedFamilyIds: normalizeStringArray(repairFrontier.topDegradedFamilyIds),
      topDegradedGroupIds: normalizeStringArray(repairFrontier.topDegradedGroupIds),
      taxonomyOverview: normalizeString(repairFrontier.taxonomyOverview, base.repairFrontier.taxonomyOverview),
      relationFamilySummaries: normalizeObjectArray(repairFrontier.relationFamilySummaries),
      relationGroupSummaries: normalizeObjectArray(repairFrontier.relationGroupSummaries),
      prioritizedItems: normalizeObjectArray(repairFrontier.prioritizedItems)
    },
    metaOptimize: normalizeWorkspaceMetaOptimize(metaOptimize, base.metaOptimize),
    runtime: normalizeWorkspaceRuntime(runtime, base.runtime),
    programs: normalizeWorkspacePrograms(programs, base.programs),
    campaigns: normalizeWorkspaceCampaigns(campaigns, base.campaigns),
    autonomyLoops: normalizeWorkspaceAutonomyLoops(autonomyLoops, base.autonomyLoops),
    lifecycle: normalizeWorkspaceLifecycle(lifecycle, base.lifecycle),
    dove: normalizeWorkspaceDove(dove, base.dove),
    activeRoles: normalizeStringArray(raw.activeRoles),
    unresolvedConcernIds: normalizeStringArray(raw.unresolvedConcernIds),
    mostRecentSessions: normalizeObjectArray(raw.mostRecentSessions),
    latestVersions: {
      ...base.latestVersions,
      ...latestVersions,
      currentVersionId: latestVersions.currentVersionId ?? base.latestVersions.currentVersionId,
      activeTargets: normalizeStringArray(latestVersions.activeTargets),
      latestSnapshotIds: normalizeStringArray(latestVersions.latestSnapshotIds)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function normalizeRuntimeLogEntries(raw = {}) {
  const entries = [...normalizeObjectArray(raw.items), ...normalizeObjectArray(raw.entries)];
  const keyed = /* @__PURE__ */ new Map();
  const unkeyed = [];
  for (const entry of entries) {
    const id = normalizeString(entry.id ?? entry.runId ?? entry.eventId, null);
    if (id) {
      keyed.set(id, entry);
    } else {
      unkeyed.push(entry);
    }
  }
  return [...unkeyed, ...keyed.values()];
}
function normalizeRuntimeControllerState(raw = {}) {
  const base = createRuntimeControllerState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  const lastRun = normalizeObject(raw.lastRun);
  return {
    ...base,
    ...raw,
    version: base.version,
    explicitInvocationOnly: normalizeBoolean(raw.explicitInvocationOnly, base.explicitInvocationOnly),
    noDaemon: normalizeBoolean(raw.noDaemon, base.noDaemon),
    selectionPolicy: normalizeString(raw.selectionPolicy, base.selectionPolicy),
    boundedStepPolicy: normalizeString(raw.boundedStepPolicy, base.boundedStepPolicy),
    lastRun: Object.keys(lastRun).length === 0 ? null : {
      runId: normalizeString(lastRun.runId, null),
      status: normalizeString(lastRun.status, null),
      outcome: normalizeString(lastRun.outcome, null),
      selectedPacketId: normalizeString(lastRun.selectedPacketId, null),
      leaseId: normalizeString(lastRun.leaseId, null),
      actorRole: normalizeString(lastRun.actorRole, null),
      envelopeWorkerRole: normalizeString(lastRun.envelopeWorkerRole, null),
      programId: normalizeString(lastRun.programId, null),
      programRunId: normalizeString(lastRun.programRunId, null),
      approvalId: normalizeString(lastRun.approvalId, null),
      startedAt: lastRun.startedAt ?? null,
      completedAt: lastRun.completedAt ?? null,
      summary: normalizeString(lastRun.summary, "")
    },
    summary: {
      ...base.summary,
      ...summary,
      lastRunId: normalizeString(summary.lastRunId, base.summary.lastRunId),
      lastStatus: normalizeString(summary.lastStatus, base.summary.lastStatus),
      lastOutcome: normalizeString(summary.lastOutcome, base.summary.lastOutcome),
      lastSelectedPacketId: normalizeString(summary.lastSelectedPacketId, base.summary.lastSelectedPacketId),
      lastEnvelopeWorkerRole: normalizeString(summary.lastEnvelopeWorkerRole, base.summary.lastEnvelopeWorkerRole),
      lastProgramId: normalizeString(summary.lastProgramId, base.summary.lastProgramId),
      lastProgramRunId: normalizeString(summary.lastProgramRunId, base.summary.lastProgramRunId),
      lastApprovalId: normalizeString(summary.lastApprovalId, base.summary.lastApprovalId),
      lastProgramOutcome: normalizeString(summary.lastProgramOutcome, base.summary.lastProgramOutcome),
      requestCount: normalizeNumber(summary.requestCount, base.summary.requestCount),
      acceptedRequestCount: normalizeNumber(summary.acceptedRequestCount, base.summary.acceptedRequestCount),
      executingRequestCount: normalizeNumber(summary.executingRequestCount, base.summary.executingRequestCount),
      staleRequestCount: normalizeNumber(summary.staleRequestCount, base.summary.staleRequestCount),
      overdueExecutionCount: normalizeNumber(summary.overdueExecutionCount, base.summary.overdueExecutionCount),
      dueReviewCount: normalizeNumber(summary.dueReviewCount, base.summary.dueReviewCount),
      checkpointCount: normalizeNumber(summary.checkpointCount, base.summary.checkpointCount),
      escalationCount: normalizeNumber(summary.escalationCount, base.summary.escalationCount),
      lastCheckpointPacketId: normalizeString(summary.lastCheckpointPacketId, base.summary.lastCheckpointPacketId),
      lastCheckpointSummary: normalizeString(summary.lastCheckpointSummary, base.summary.lastCheckpointSummary),
      lastCheckpointAt: summary.lastCheckpointAt ?? base.summary.lastCheckpointAt,
      lastEscalationPacketId: normalizeString(summary.lastEscalationPacketId, base.summary.lastEscalationPacketId),
      lastEscalationFollowThroughId: normalizeString(summary.lastEscalationFollowThroughId, base.summary.lastEscalationFollowThroughId),
      lastEscalationAt: summary.lastEscalationAt ?? base.summary.lastEscalationAt,
      overview: normalizeString(summary.overview, base.summary.overview),
      controllerStatePath: normalizeString(summary.controllerStatePath, base.summary.controllerStatePath),
      leasesPath: normalizeString(summary.leasesPath, base.summary.leasesPath),
      eventsPath: normalizeString(summary.eventsPath, base.summary.eventsPath),
      resultsPath: normalizeString(summary.resultsPath, base.summary.resultsPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function normalizeRuntimeLeasesIndex(raw = {}) {
  const base = createRuntimeLeasesIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    explicitInvocationOnly: normalizeBoolean(raw.explicitInvocationOnly, base.explicitInvocationOnly),
    items: normalizeObjectArray(raw.items),
    summary: {
      ...base.summary,
      ...summary,
      activeLeaseCount: normalizeNumber(summary.activeLeaseCount, base.summary.activeLeaseCount),
      activePacketIds: normalizeStringArray(summary.activePacketIds),
      activeLeaseIds: normalizeStringArray(summary.activeLeaseIds),
      overview: normalizeString(summary.overview, base.summary.overview),
      leasesPath: normalizeString(summary.leasesPath, base.summary.leasesPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function normalizeRuntimeContinuationIndex(raw = {}) {
  const base = createRuntimeContinuationIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    explicitInvocationOnly: normalizeBoolean(raw.explicitInvocationOnly, base.explicitInvocationOnly),
    noDaemon: normalizeBoolean(raw.noDaemon, base.noDaemon),
    items: normalizeObjectArray(raw.items),
    summary: {
      ...base.summary,
      ...summary,
      continuationCount: normalizeNumber(summary.continuationCount, base.summary.continuationCount),
      currentKind: normalizeString(summary.currentKind, base.summary.currentKind),
      currentPacketId: normalizeString(summary.currentPacketId, base.summary.currentPacketId),
      currentProgramRunId: normalizeString(summary.currentProgramRunId, base.summary.currentProgramRunId),
      currentCommand: normalizeString(summary.currentCommand, base.summary.currentCommand),
      overview: normalizeString(summary.overview, base.summary.overview),
      continuationPath: normalizeString(summary.continuationPath, base.summary.continuationPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function normalizeRuntimeEventsIndex(raw = {}) {
  const base = createRuntimeEventsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    explicitInvocationOnly: normalizeBoolean(raw.explicitInvocationOnly, base.explicitInvocationOnly),
    entries: normalizeRuntimeLogEntries(raw),
    summary: {
      ...base.summary,
      ...summary,
      eventCount: normalizeNumber(summary.eventCount, base.summary.eventCount),
      lastEventType: normalizeString(summary.lastEventType, base.summary.lastEventType),
      lastRunId: normalizeString(summary.lastRunId, base.summary.lastRunId),
      overview: normalizeString(summary.overview, base.summary.overview),
      eventsPath: normalizeString(summary.eventsPath, base.summary.eventsPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function normalizeRuntimeResultsIndex(raw = {}) {
  const base = createRuntimeResultsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    explicitInvocationOnly: normalizeBoolean(raw.explicitInvocationOnly, base.explicitInvocationOnly),
    entries: normalizeRuntimeLogEntries(raw),
    summary: {
      ...base.summary,
      ...summary,
      runCount: normalizeNumber(summary.runCount, base.summary.runCount),
      completedCount: normalizeNumber(summary.completedCount, base.summary.completedCount),
      noopCount: normalizeNumber(summary.noopCount, base.summary.noopCount),
      errorCount: normalizeNumber(summary.errorCount, base.summary.errorCount),
      checkpointCount: normalizeNumber(summary.checkpointCount, base.summary.checkpointCount),
      escalationCount: normalizeNumber(summary.escalationCount, base.summary.escalationCount),
      lastRunId: normalizeString(summary.lastRunId, base.summary.lastRunId),
      lastStatus: normalizeString(summary.lastStatus, base.summary.lastStatus),
      lastOutcome: normalizeString(summary.lastOutcome, base.summary.lastOutcome),
      lastCheckpointPacketId: normalizeString(summary.lastCheckpointPacketId, base.summary.lastCheckpointPacketId),
      lastCheckpointSummary: normalizeString(summary.lastCheckpointSummary, base.summary.lastCheckpointSummary),
      lastCheckpointAt: summary.lastCheckpointAt ?? base.summary.lastCheckpointAt,
      lastEscalationPacketId: normalizeString(summary.lastEscalationPacketId, base.summary.lastEscalationPacketId),
      lastEscalationFollowThroughId: normalizeString(summary.lastEscalationFollowThroughId, base.summary.lastEscalationFollowThroughId),
      lastEscalationAt: summary.lastEscalationAt ?? base.summary.lastEscalationAt,
      overview: normalizeString(summary.overview, base.summary.overview),
      resultsPath: normalizeString(summary.resultsPath, base.summary.resultsPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function normalizeProgramsIndex(raw = {}) {
  const base = createProgramsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    items: normalizeObjectArray(raw.items),
    summary: {
      ...base.summary,
      ...summary,
      programCount: normalizeNumber(summary.programCount, base.summary.programCount),
      activeCount: normalizeNumber(summary.activeCount, base.summary.activeCount),
      blockedCount: normalizeNumber(summary.blockedCount, base.summary.blockedCount),
      topProgramIds: normalizeStringArray(summary.topProgramIds),
      overview: normalizeString(summary.overview, base.summary.overview),
      programsPath: normalizeString(summary.programsPath, base.summary.programsPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function normalizeCampaignsIndex(raw = {}) {
  const base = createCampaignsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    items: normalizeObjectArray(raw.items),
    summary: {
      ...base.summary,
      ...summary,
      campaignCount: normalizeNumber(summary.campaignCount, base.summary.campaignCount),
      plannedCount: normalizeNumber(summary.plannedCount, base.summary.plannedCount),
      activeCount: normalizeNumber(summary.activeCount, base.summary.activeCount),
      reviewNeededCount: normalizeNumber(summary.reviewNeededCount, base.summary.reviewNeededCount),
      completedCount: normalizeNumber(summary.completedCount, base.summary.completedCount),
      blockedCount: normalizeNumber(summary.blockedCount, base.summary.blockedCount),
      topCampaignIds: normalizeStringArray(summary.topCampaignIds),
      overview: normalizeString(summary.overview, base.summary.overview),
      campaignsPath: normalizeString(summary.campaignsPath, base.summary.campaignsPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function normalizeProgramRunsIndex(raw = {}) {
  const base = createProgramRunsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    items: normalizeObjectArray(raw.items),
    summary: {
      ...base.summary,
      ...summary,
      runCount: normalizeNumber(summary.runCount, base.summary.runCount),
      approvedCount: normalizeNumber(summary.approvedCount, base.summary.approvedCount),
      activeCount: normalizeNumber(summary.activeCount, base.summary.activeCount),
      reviewNeededCount: normalizeNumber(summary.reviewNeededCount, base.summary.reviewNeededCount),
      blockedCount: normalizeNumber(summary.blockedCount, base.summary.blockedCount),
      reviewCheckpointRunCount: normalizeNumber(summary.reviewCheckpointRunCount, base.summary.reviewCheckpointRunCount),
      topRunIds: normalizeStringArray(summary.topRunIds),
      overview: normalizeString(summary.overview, base.summary.overview),
      runsPath: normalizeString(summary.runsPath, base.summary.runsPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function normalizeProgramApprovalsIndex(raw = {}) {
  const base = createProgramApprovalsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    items: normalizeObjectArray(raw.items),
    summary: {
      ...base.summary,
      ...summary,
      approvalCount: normalizeNumber(summary.approvalCount, base.summary.approvalCount),
      approvedCount: normalizeNumber(summary.approvedCount, base.summary.approvedCount),
      revokedCount: normalizeNumber(summary.revokedCount, base.summary.revokedCount),
      consumedCount: normalizeNumber(summary.consumedCount, base.summary.consumedCount),
      topApprovalIds: normalizeStringArray(summary.topApprovalIds),
      overview: normalizeString(summary.overview, base.summary.overview),
      approvalsPath: normalizeString(summary.approvalsPath, base.summary.approvalsPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function normalizeWorkflowBoundaries(raw = {}) {
  const base = createWorkflowBoundaries();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const managedArtifacts = normalizeObject(raw.managedArtifacts);
  return {
    ...base,
    ...raw,
    version: base.version,
    managedPaths: normalizeStringArray(raw.managedPaths, base.managedPaths),
    doveBootstrapOnlyPaths: normalizeStringArray(raw.doveBootstrapOnlyPaths, base.doveBootstrapOnlyPaths),
    userOwnedPaths: normalizeStringArray(raw.userOwnedPaths, base.userOwnedPaths),
    managedArtifacts: {
      codePack: {
        ...createManagedArtifactMeta("managed-replaceable", "src"),
        ...normalizeObject(managedArtifacts.codePack)
      },
      workflowBoundaries: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workflowBoundaries),
      workspaceIndex: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workspaceIndex),
      doveRootManifest: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.doveRootManifest),
      executionBridgeCandidates: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.metaExecutionBridgeCandidates),
      operatorLessons: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.metaOperatorLessons),
      remediationPacks: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.metaRemediationPacks),
      documentsLedger: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.documentsLedger)
    },
    notes: normalizeStringArray(raw.notes, base.notes),
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function createSourcesIndex() {
  return { version: 1, items: [], updatedAt: null };
}
function createNotesIndex() {
  return { version: 1, items: [], updatedAt: null };
}
function createEvidenceIndex() {
  return { version: 3, claims: [], updatedAt: null };
}
function normalizeDocumentKind(value, fallback = "other") {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return DOVE_DOCUMENT_KINDS.includes(normalized) ? normalized : fallback;
}
function normalizeDocumentStatus(value, fallback = "created") {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return DOVE_DOCUMENT_STATUSES.includes(normalized) ? normalized : fallback;
}
function normalizeDocumentEvidenceScope(value, fallback = "internal") {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return DOVE_DOCUMENT_EVIDENCE_SCOPES.includes(normalized) ? normalized : fallback;
}
function normalizeUniqueStringArray(value, fallback = []) {
  return Array.from(new Set(normalizeStringArray(value, fallback).map((item) => item.trim()).filter(Boolean)));
}
function createDocumentLedgerSummary(entries = []) {
  const lastEntry = entries.at(-1) ?? null;
  return {
    documentCount: entries.length,
    internalEvidenceCount: entries.filter((entry) => entry.evidenceScope === "internal").length,
    externalEvidenceCount: entries.filter((entry) => entry.evidenceScope === "external").length,
    mixedEvidenceCount: entries.filter((entry) => entry.evidenceScope === "mixed").length,
    publicSafeCount: entries.filter((entry) => entry.publicSafe === true).length,
    lastDocumentId: lastEntry?.documentId ?? null,
    lastUpdatedAt: lastEntry?.updatedAt ?? lastEntry?.createdAt ?? null,
    overview: entries.length > 0 ? `${entries.length} document evidence entr${entries.length === 1 ? "y" : "ies"} recorded.` : "No document evidence has been recorded yet.",
    ledgerPath: ARTIFACT_PATHS.documentsLedger
  };
}
function normalizeDocumentLedgerEntry(value, index = 0) {
  const source = normalizeObject(value);
  const id = normalizeString(source.id, `document-entry-${index + 1}`);
  const documentId = normalizeString(source.documentId, id);
  const evidenceScope = normalizeDocumentEvidenceScope(source.evidenceScope ?? source.scope, "internal");
  const publicSafe = normalizeBoolean(source.publicSafe, false);
  return {
    id,
    packetId: normalizeString(source.packetId ?? source.taskPacketId ?? source.missionPacketId ?? source.taskId, null),
    documentId,
    title: normalizeString(source.title, documentId),
    documentPath: normalizeString(source.documentPath ?? source.path, null),
    documentKind: normalizeDocumentKind(source.documentKind ?? source.kind, "other"),
    status: normalizeDocumentStatus(source.status, "created"),
    evidenceScope,
    publicSafe,
    summary: normalizeString(source.summary, ""),
    context: normalizeString(source.context, ""),
    sourceRefs: normalizeUniqueStringArray(source.sourceRefs ?? source.sourceIds),
    artifactRefs: normalizeUniqueStringArray(source.artifactRefs ?? source.artifactPaths),
    evidenceLinks: normalizeUniqueStringArray(source.evidenceLinks ?? source.evidencePaths),
    claimIds: normalizeUniqueStringArray(source.claimIds ?? source.claims),
    createdAt: normalizeString(source.createdAt, null),
    updatedAt: normalizeString(source.updatedAt, source.createdAt ?? null),
    createdBy: normalizeString(source.createdBy ?? source.actorRole, "operator"),
    appendOnly: true,
    rawTranscriptIncluded: false,
    privateReasoningIncluded: false,
    environmentIncluded: false
  };
}
function createDocumentLedgerIndex() {
  const entries = [];
  return {
    version: 1,
    entries,
    summary: createDocumentLedgerSummary(entries),
    updatedAt: null
  };
}
function normalizeDocumentLedgerIndex(raw = {}) {
  const source = normalizeObject(raw);
  const entries = normalizeObjectArray(source.entries).map((entry, index) => normalizeDocumentLedgerEntry(entry, index));
  return {
    version: 1,
    entries,
    summary: createDocumentLedgerSummary(entries),
    updatedAt: normalizeString(source.updatedAt, entries.at(-1)?.updatedAt ?? entries.at(-1)?.createdAt ?? null)
  };
}
function createMutationProvenanceSummary(entries) {
  const patchPlanCount = entries.filter((entry) => entry.mutationMode === "patch-plan").length;
  const directProcessCount = entries.filter((entry) => entry.mutationMode === "direct-process").length;
  const lastEntry = entries.at(-1) ?? null;
  return {
    mutationCount: entries.length,
    patchPlanCount,
    directProcessCount,
    lastMutationId: lastEntry?.id ?? null,
    lastMutationMode: lastEntry?.mutationMode ?? null,
    lastAppliedBy: lastEntry?.appliedBy ?? null,
    hostRollbackEligible: lastEntry?.hostRollbackEligible ?? false,
    hostRollbackIneligibleReason: lastEntry?.hostRollbackIneligibleReason ?? null,
    recommendedMutationMode: lastEntry?.recommendedMutationMode ?? null,
    rollbackAdvice: lastEntry?.rollbackAdvice ?? null,
    hostCheckpointVerified: false,
    doveRestoreSupported: false
  };
}
function normalizeMutationProvenanceEntry(raw = {}, index = 0) {
  const source = normalizeObject(raw);
  const mutationMode = source.mutationMode === "patch-plan" ? "patch-plan" : "direct-process";
  const writesApplied = normalizeBoolean(source.writesApplied, mutationMode === "direct-process");
  return {
    id: normalizeString(source.id ?? source.mutationId, `mutation-${index + 1}`),
    actionId: normalizeString(source.actionId, "unspecified"),
    packetId: normalizeString(source.packetId, null),
    mutationMode,
    mutationModeSource: normalizeString(source.mutationModeSource, "unknown"),
    writesApplied,
    appliedBy: normalizeString(source.appliedBy, mutationMode === "patch-plan" ? "host-tracked-file-edits-required" : "node-fs"),
    hostId: normalizeString(source.hostId, "unknown"),
    hostRollbackEligible: normalizeBoolean(source.hostRollbackEligible, mutationMode === "patch-plan"),
    hostTrackedFileEditsRequired: normalizeBoolean(source.hostTrackedFileEditsRequired, mutationMode === "patch-plan"),
    hostCheckpointVerified: false,
    directProcessWritesAreRollbackSafe: false,
    externalWriteCaptureVerified: false,
    doveRestoreSupported: false,
    hostRollbackIneligibleReason: normalizeString(source.hostRollbackIneligibleReason, mutationMode === "patch-plan" ? null : "direct-process writes are not verified host rollback-safe"),
    recommendedMutationMode: normalizeString(source.recommendedMutationMode, mutationMode === "patch-plan" ? null : "patch-plan"),
    rollbackAdvice: normalizeString(source.rollbackAdvice, mutationMode === "patch-plan" ? null : "Use mutationMode: patch-plan for host-tracked rollback eligibility."),
    operationCount: Number.isFinite(source.operationCount) ? Math.max(0, Math.floor(source.operationCount)) : normalizeUniqueStringArray(source.paths).length,
    paths: normalizeUniqueStringArray(source.paths),
    createdAt: normalizeString(source.createdAt, null)
  };
}
function createMutationProvenanceIndex() {
  const entries = [];
  return {
    version: 1,
    entries,
    summary: createMutationProvenanceSummary(entries),
    updatedAt: null
  };
}
function normalizeMutationProvenanceIndex(raw = {}) {
  const source = normalizeObject(raw);
  const entries = normalizeObjectArray(source.entries).map((entry, index) => normalizeMutationProvenanceEntry(entry, index));
  return {
    version: 1,
    entries,
    summary: createMutationProvenanceSummary(entries),
    updatedAt: normalizeString(source.updatedAt, entries.at(-1)?.createdAt ?? null)
  };
}
function createTaskPacketsIndex() {
  return {
    version: 4,
    items: [],
    taskModel: {
      uniqueInitLevel: 0,
      userDefaultLevel: 3,
      activeInitId: null,
      activeTaskIds: []
    },
    lifecycleCounts: {},
    stageCounts: Object.fromEntries(DOVE_TASK_STAGES.map((stage) => [stage, 0])),
    domainCounts: Object.fromEntries(DOVE_TASK_DOMAINS.map((domain) => [domain, 0])),
    levelCounts: {},
    lifecycleFamilyCounts: Object.fromEntries(PAPER_LIFECYCLE_FAMILY_IDS.map((familyId) => [familyId, 0])),
    dependencyHealth: {
      blockedPacketIds: [],
      readyPacketIds: [],
      stalePacketIds: [],
      missingDependencyIds: []
    },
    updatedAt: null
  };
}
function createRuntimeControllerState() {
  return {
    version: 1,
    explicitInvocationOnly: true,
    noDaemon: true,
    selectionPolicy: "planner-materialized-guidance-v2",
    boundedStepPolicy: "planner-control-plane-worker-step-v1",
    lastRun: null,
    summary: {
      lastRunId: null,
      lastStatus: "never-run",
      lastOutcome: "not-started",
      lastSelectedPacketId: null,
      lastEnvelopeWorkerRole: null,
      lastProgramId: null,
      lastProgramRunId: null,
      lastApprovalId: null,
      lastProgramOutcome: "not-started",
      requestCount: 0,
      acceptedRequestCount: 0,
      executingRequestCount: 0,
      staleRequestCount: 0,
      overdueExecutionCount: 0,
      dueReviewCount: 0,
      checkpointCount: 0,
      escalationCount: 0,
      lastCheckpointPacketId: null,
      lastCheckpointSummary: null,
      lastCheckpointAt: null,
      lastEscalationPacketId: null,
      lastEscalationFollowThroughId: null,
      lastEscalationAt: null,
      overview: "No autonomous control-plane run has been executed yet.",
      controllerStatePath: ARTIFACT_PATHS.runtimeControllerState,
      leasesPath: ARTIFACT_PATHS.runtimeLeases,
      eventsPath: ARTIFACT_PATHS.runtimeEvents,
      resultsPath: ARTIFACT_PATHS.runtimeResults
    },
    updatedAt: null
  };
}
function createRuntimeContinuationIndex() {
  return {
    version: 1,
    explicitInvocationOnly: true,
    noDaemon: true,
    items: [],
    summary: {
      continuationCount: 0,
      currentKind: null,
      currentPacketId: null,
      currentProgramRunId: null,
      currentCommand: null,
      overview: "No explicit autonomy continuation is currently pending.",
      continuationPath: ARTIFACT_PATHS.runtimeContinuation
    },
    updatedAt: null
  };
}
function createRuntimeLeasesIndex() {
  return {
    version: 1,
    explicitInvocationOnly: true,
    items: [],
    summary: {
      activeLeaseCount: 0,
      activePacketIds: [],
      activeLeaseIds: [],
      overview: "No autonomous control-plane leases are currently active.",
      leasesPath: ARTIFACT_PATHS.runtimeLeases
    },
    updatedAt: null
  };
}
function createRuntimeEventsIndex() {
  return {
    version: 1,
    explicitInvocationOnly: true,
    entries: [],
    summary: {
      eventCount: 0,
      lastEventType: null,
      lastRunId: null,
      overview: "No autonomous control-plane events have been recorded yet.",
      eventsPath: ARTIFACT_PATHS.runtimeEvents
    },
    updatedAt: null
  };
}
function createRuntimeResultsIndex() {
  return {
    version: 1,
    explicitInvocationOnly: true,
    entries: [],
    summary: {
      runCount: 0,
      completedCount: 0,
      noopCount: 0,
      errorCount: 0,
      checkpointCount: 0,
      escalationCount: 0,
      lastRunId: null,
      lastStatus: "never-run",
      lastOutcome: "not-started",
      lastCheckpointPacketId: null,
      lastCheckpointSummary: null,
      lastCheckpointAt: null,
      lastEscalationPacketId: null,
      lastEscalationFollowThroughId: null,
      lastEscalationAt: null,
      overview: "No autonomous control-plane results have been recorded yet.",
      resultsPath: ARTIFACT_PATHS.runtimeResults
    },
    updatedAt: null
  };
}
function createReviewState() {
  return {
    version: 3,
    lastVerdict: "not-reviewed",
    lastReviewedAt: null,
    history: [],
    openItems: [],
    unresolvedConcernIds: [],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    reviewRound: 0,
    reviewerIndependence: {
      reviewerRole: "reviewer",
      responseOwnerRoles: [],
      separationMaintained: true
    }
  };
}
function createReviewConcernsIndex() {
  return { version: 2, items: [], updatedAt: null };
}
function createAdversarialReviewState() {
  return {
    version: 2,
    round: 0,
    unresolvedConcernIds: [],
    escalatedConcernIds: [],
    pendingAuthorResponseIds: [],
    pendingReviewerRulingIds: [],
    concernStatusCounts: {},
    escalationThresholds: { high: 1, medium: 2, low: 3 },
    lastAuditIds: [],
    lastBridgeIds: [],
    updatedAt: null
  };
}
function createFiguresIndex() {
  return { version: 1, items: [], updatedAt: null };
}
function createFigureBriefsIndex() {
  return { version: 1, items: [], updatedAt: null };
}
function createFigureSegmentsIndex() {
  return { version: 1, items: [], updatedAt: null };
}
function createFigureTemplatesIndex() {
  return { version: 1, items: [], updatedAt: null };
}
function createFigureEditableIndex() {
  return { version: 1, items: [], updatedAt: null };
}
function createFigureFinalIndex() {
  return { version: 1, items: [], updatedAt: null };
}
function createFigureQaIndex() {
  return { version: 1, items: [], issues: [], updatedAt: null };
}
function createFigureMaterialsIndex() {
  return { version: 1, items: [], updatedAt: null };
}
function createFigureGenerationsIndex() {
  return { version: 1, items: [], updatedAt: null };
}
function createFigureCaptionsIndex() {
  return { version: 1, items: [], updatedAt: null };
}
function createResearchAgenda() {
  return {
    version: 1,
    objective: "\u8BB0\u5F55\u8BBA\u6587\u76EE\u6807\u4E0E\u8D21\u732E\u3002",
    agenda: [],
    evidenceBacklog: [],
    updatedAt: null
  };
}
function createProgramsIndex() {
  return {
    version: 1,
    items: [],
    summary: {
      programCount: 0,
      activeCount: 0,
      blockedCount: 0,
      topProgramIds: [],
      overview: "No research programs have been recorded yet.",
      programsPath: ARTIFACT_PATHS.programsIndex
    },
    updatedAt: null
  };
}
function createCampaignsIndex() {
  return {
    version: 1,
    items: [],
    summary: {
      campaignCount: 0,
      plannedCount: 0,
      activeCount: 0,
      reviewNeededCount: 0,
      completedCount: 0,
      blockedCount: 0,
      topCampaignIds: [],
      overview: "No multi-cycle research campaigns have been recorded yet.",
      campaignsPath: ARTIFACT_PATHS.campaignsIndex
    },
    updatedAt: null
  };
}
function createProgramRunsIndex() {
  return {
    version: 1,
    items: [],
    summary: {
      runCount: 0,
      approvedCount: 0,
      activeCount: 0,
      reviewNeededCount: 0,
      blockedCount: 0,
      reviewCheckpointRunCount: 0,
      topRunIds: [],
      overview: "No approved program runs have been recorded yet.",
      runsPath: ARTIFACT_PATHS.programRuns
    },
    updatedAt: null
  };
}
function createProgramApprovalsIndex() {
  return {
    version: 1,
    items: [],
    summary: {
      approvalCount: 0,
      approvedCount: 0,
      revokedCount: 0,
      consumedCount: 0,
      topApprovalIds: [],
      overview: "No program approvals have been recorded yet.",
      approvalsPath: ARTIFACT_PATHS.programApprovals
    },
    updatedAt: null
  };
}
function createSessionJournal() {
  return { version: 1, entries: [], updatedAt: null };
}
function createExperimentPlansIndex() {
  return { version: 1, items: [], updatedAt: null };
}
function createExperimentResultsIndex() {
  return { version: 1, items: [], updatedAt: null };
}
function createExperimentAuditsIndex() {
  return { version: 1, items: [], updatedAt: null };
}
function createClaimBridgeLog() {
  return { version: 1, items: [], updatedAt: null };
}
function createMetaEventsIndex() {
  return {
    version: 1,
    proposalOnly: true,
    items: [],
    updatedAt: null
  };
}
function createMetaLongHorizonMemory() {
  return {
    version: 1,
    proposalOnly: true,
    historyWindowSize: 30,
    horizon: {
      sessionEntriesAnalyzed: 0,
      reviewRoundsObserved: 0,
      versionComparisonsAnalyzed: 0,
      auditRecordsAnalyzed: 0,
      bridgeRecordsAnalyzed: 0
    },
    summary: {
      familyCount: 0,
      recurringFamilyCount: 0,
      risingFamilyCount: 0,
      stableFamilyCount: 0,
      coolingFamilyCount: 0,
      snapshotCount: 0,
      lastObservedAt: null,
      lastAction: "unchanged",
      topFamilyIds: [],
      topTaxonomyFamilyIds: [],
      topTaxonomyGroupIds: [],
      pressureAreas: [],
      overview: "No long-horizon workflow memory has been summarized yet."
    },
    historyPolicy: {
      mode: "deterministic-noop-drift-guard-v1",
      lastAction: "unchanged",
      reason: "No long-horizon snapshots have been recorded yet.",
      comparedAt: null,
      lastMeaningfulChangeAt: null
    },
    history: [],
    families: [],
    updatedAt: null
  };
}
function normalizeMetaLongHorizonMemory(raw = {}) {
  const base = createMetaLongHorizonMemory();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const horizon = normalizeObject(raw.horizon);
  const summary = normalizeObject(raw.summary);
  const historyPolicy = normalizeObject(raw.historyPolicy);
  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    historyWindowSize: normalizeNumber(raw.historyWindowSize, base.historyWindowSize),
    horizon: {
      ...base.horizon,
      ...horizon,
      sessionEntriesAnalyzed: normalizeNumber(horizon.sessionEntriesAnalyzed, base.horizon.sessionEntriesAnalyzed),
      reviewRoundsObserved: normalizeNumber(horizon.reviewRoundsObserved, base.horizon.reviewRoundsObserved),
      versionComparisonsAnalyzed: normalizeNumber(horizon.versionComparisonsAnalyzed, base.horizon.versionComparisonsAnalyzed),
      auditRecordsAnalyzed: normalizeNumber(horizon.auditRecordsAnalyzed, base.horizon.auditRecordsAnalyzed),
      bridgeRecordsAnalyzed: normalizeNumber(horizon.bridgeRecordsAnalyzed, base.horizon.bridgeRecordsAnalyzed)
    },
    summary: {
      ...base.summary,
      ...summary,
      familyCount: normalizeNumber(summary.familyCount, base.summary.familyCount),
      recurringFamilyCount: normalizeNumber(summary.recurringFamilyCount, base.summary.recurringFamilyCount),
      risingFamilyCount: normalizeNumber(summary.risingFamilyCount, base.summary.risingFamilyCount),
      stableFamilyCount: normalizeNumber(summary.stableFamilyCount, base.summary.stableFamilyCount),
      coolingFamilyCount: normalizeNumber(summary.coolingFamilyCount, base.summary.coolingFamilyCount),
      snapshotCount: normalizeNumber(summary.snapshotCount, base.summary.snapshotCount),
      lastObservedAt: summary.lastObservedAt ?? base.summary.lastObservedAt,
      lastAction: normalizeString(summary.lastAction, base.summary.lastAction),
      topFamilyIds: normalizeStringArray(summary.topFamilyIds),
      topTaxonomyFamilyIds: normalizeStringArray(summary.topTaxonomyFamilyIds),
      topTaxonomyGroupIds: normalizeStringArray(summary.topTaxonomyGroupIds),
      pressureAreas: normalizeStringArray(summary.pressureAreas),
      overview: normalizeString(summary.overview, base.summary.overview)
    },
    historyPolicy: {
      ...base.historyPolicy,
      ...historyPolicy,
      mode: normalizeString(historyPolicy.mode, base.historyPolicy.mode),
      lastAction: normalizeString(historyPolicy.lastAction, base.historyPolicy.lastAction),
      reason: normalizeString(historyPolicy.reason, base.historyPolicy.reason),
      comparedAt: historyPolicy.comparedAt ?? base.historyPolicy.comparedAt,
      lastMeaningfulChangeAt: historyPolicy.lastMeaningfulChangeAt ?? base.historyPolicy.lastMeaningfulChangeAt
    },
    history: normalizeObjectArray(raw.history),
    families: normalizeObjectArray(raw.families),
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function createMetaRemediationPacksIndex() {
  return {
    version: 1,
    proposalOnly: true,
    packs: [],
    summary: {
      packCount: 0,
      topPackIds: [],
      topClusterIds: [],
      actionableCount: 0,
      partiallyActionableCount: 0,
      advisoryCount: 0,
      readinessOverview: "No proposal-only remediation packs have been generated yet.",
      overview: "No proposal-only remediation packs have been generated yet.",
      packsPath: ARTIFACT_PATHS.metaRemediationPacks
    },
    sourceArtifacts: [
      ARTIFACT_PATHS.metaRecommendations,
      ARTIFACT_PATHS.metaLongHorizonMemory,
      ARTIFACT_PATHS.reviewConcerns,
      ARTIFACT_PATHS.figureQa,
      ARTIFACT_PATHS.workspaceIndex,
      ARTIFACT_PATHS.navigationReport,
      ARTIFACT_PATHS.sessionSummary
    ],
    updatedAt: null
  };
}
function normalizeMetaRemediationPacksIndex(raw = {}) {
  const base = createMetaRemediationPacksIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    packs: normalizeObjectArray(raw.packs),
    summary: {
      ...base.summary,
      ...summary,
      packCount: normalizeNumber(summary.packCount, base.summary.packCount),
      topPackIds: normalizeStringArray(summary.topPackIds),
      topClusterIds: normalizeStringArray(summary.topClusterIds),
      actionableCount: normalizeNumber(summary.actionableCount, base.summary.actionableCount),
      partiallyActionableCount: normalizeNumber(summary.partiallyActionableCount, base.summary.partiallyActionableCount),
      advisoryCount: normalizeNumber(summary.advisoryCount, base.summary.advisoryCount),
      readinessOverview: normalizeString(summary.readinessOverview, base.summary.readinessOverview),
      overview: normalizeString(summary.overview, base.summary.overview),
      packsPath: normalizeString(summary.packsPath, base.summary.packsPath)
    },
    sourceArtifacts: normalizeStringArray(raw.sourceArtifacts, base.sourceArtifacts),
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function cleanUniqueStrings(value, fallback = []) {
  return Array.from(new Set(normalizeStringArray(value, fallback).map((item) => item.trim()).filter(Boolean)));
}
function cleanOptionalString(value, fallback = null) {
  const normalized = normalizeString(value, fallback);
  return typeof normalized === "string" ? normalized.trim() : normalized;
}
function isTrellisTaskSourceArtifact(value) {
  const normalized = String(value ?? "").trim().replace(/\\/g, "/").replace(/^\.\/+/, "");
  return normalized === ".trellis/tasks" || normalized.startsWith(".trellis/tasks/") || normalized === "trellis/tasks" || normalized.startsWith("trellis/tasks/");
}
function normalizeOperatorLessonStatus(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ["active", "retired", "superseded", "archived"].includes(normalized) ? normalized : "active";
}
function summarizeOperatorLessons(lessons = []) {
  const activeLessons = lessons.filter((lesson) => lesson.status === "active");
  const countBy3 = (items) => items.reduce((accumulator, item) => {
    accumulator[item] = (accumulator[item] ?? 0) + 1;
    return accumulator;
  }, {});
  const topKeys = (items) => Object.entries(countBy3(items)).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, 8).map(([key]) => key);
  const sortedActive = [...activeLessons].sort((left, right) => String(right.updatedAt ?? right.createdAt ?? "").localeCompare(String(left.updatedAt ?? left.createdAt ?? "")) || left.id.localeCompare(right.id));
  return {
    lessonCount: lessons.length,
    activeLessonCount: activeLessons.length,
    topLessonIds: sortedActive.slice(0, 8).map((lesson) => lesson.id),
    topTags: topKeys(activeLessons.flatMap((lesson) => lesson.tags ?? [])),
    topDomains: topKeys(activeLessons.map((lesson) => lesson.domain).filter(Boolean)),
    overview: activeLessons.length > 0 ? `${activeLessons.length} active distilled operator lessons are available for reuse.` : "No distilled operator lessons have been recorded yet.",
    lessonsPath: ARTIFACT_PATHS.metaOperatorLessons
  };
}
function normalizeOperatorLesson(raw = {}, index = 0) {
  const title = cleanOptionalString(raw.title, `Operator lesson ${index + 1}`);
  const actorRole = cleanOptionalString(raw.actorRole, "planner");
  const createdAt = cleanOptionalString(raw.createdAt, null);
  const updatedAt = cleanOptionalString(raw.updatedAt, createdAt);
  const sourceArtifacts = cleanUniqueStrings(raw.sourceArtifacts).filter((artifactPath) => !isTrellisTaskSourceArtifact(artifactPath));
  return {
    ...raw,
    id: cleanOptionalString(raw.id, `lesson-${index + 1}`),
    title,
    problem: cleanOptionalString(raw.problem, "No problem statement recorded."),
    decisions: cleanUniqueStrings(raw.decisions),
    pitfalls: cleanUniqueStrings(raw.pitfalls),
    validation: cleanUniqueStrings(raw.validation),
    nextTime: cleanUniqueStrings(raw.nextTime),
    domain: normalizeDoveDomainId(raw.domain, "engineering"),
    stage: normalizeDoveMissionLifecycleStage(raw.stage, "return"),
    actorRole: ROLE_IDS.includes(actorRole) ? actorRole : "planner",
    tags: cleanUniqueStrings(raw.tags),
    sourceType: cleanOptionalString(raw.sourceType, "manual-retrospective"),
    sourceId: cleanOptionalString(raw.sourceId, null),
    sourceArtifacts,
    packetIds: cleanUniqueStrings(raw.packetIds),
    recommendationIds: cleanUniqueStrings(raw.recommendationIds),
    playbookIds: cleanUniqueStrings(raw.playbookIds),
    remediationPackIds: cleanUniqueStrings(raw.remediationPackIds),
    status: normalizeOperatorLessonStatus(raw.status),
    createdAt,
    updatedAt
  };
}
function createMetaOperatorLessonsIndex() {
  return {
    version: 1,
    referenceOnly: true,
    explicitOnly: true,
    noAutoCapture: true,
    noAutoApply: true,
    lessons: [],
    summary: summarizeOperatorLessons([]),
    sourceArtifacts: [
      ARTIFACT_PATHS.sessionSummary,
      ARTIFACT_PATHS.workspaceIndex,
      ARTIFACT_PATHS.metaOperatorPlaybooks,
      ARTIFACT_PATHS.metaRemediationPacks,
      ARTIFACT_PATHS.metaLongHorizonMemory
    ],
    updatedAt: null
  };
}
function normalizeMetaOperatorLessonsIndex(raw = {}) {
  const base = createMetaOperatorLessonsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const lessons = normalizeObjectArray(raw.lessons).map(normalizeOperatorLesson);
  const sourceArtifacts = cleanUniqueStrings(raw.sourceArtifacts, base.sourceArtifacts).filter((artifactPath) => !isTrellisTaskSourceArtifact(artifactPath));
  return {
    ...base,
    ...raw,
    version: base.version,
    referenceOnly: base.referenceOnly,
    explicitOnly: base.explicitOnly,
    noAutoCapture: base.noAutoCapture,
    noAutoApply: base.noAutoApply,
    lessons,
    summary: summarizeOperatorLessons(lessons),
    sourceArtifacts: sourceArtifacts.length > 0 ? sourceArtifacts : base.sourceArtifacts,
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function createMetaOperatorPlaybooksIndex() {
  return {
    version: 1,
    proposalOnly: true,
    playbooks: [],
    summary: {
      playbookCount: 0,
      topPlaybookIds: [],
      topTaxonomyFamilyIds: [],
      actionableCount: 0,
      partiallyActionableCount: 0,
      advisoryCount: 0,
      readinessOverview: "No proposal-only family-level operator playbooks have been generated yet.",
      overview: "No proposal-only family-level operator playbooks have been generated yet.",
      playbooksPath: ARTIFACT_PATHS.metaOperatorPlaybooks
    },
    sourceArtifacts: [
      ARTIFACT_PATHS.wikiRelations,
      ARTIFACT_PATHS.workspaceIndex,
      ARTIFACT_PATHS.metaRecommendations,
      ARTIFACT_PATHS.metaLongHorizonMemory,
      ARTIFACT_PATHS.metaRemediationPacks,
      ARTIFACT_PATHS.metaOptimizerReport
    ],
    updatedAt: null
  };
}
function createMetaExecutionBridgeCandidatesIndex() {
  return {
    version: 1,
    proposalOnly: true,
    noAutoApply: true,
    candidates: [],
    summary: {
      candidateCount: 0,
      topCandidateIds: [],
      candidateTypeCounts: {},
      overview: "No proposal-only execution bridge candidates have been generated yet.",
      candidatesPath: ARTIFACT_PATHS.metaExecutionBridgeCandidates
    },
    sourceArtifacts: [
      ARTIFACT_PATHS.metaOperatorPlaybooks,
      ARTIFACT_PATHS.metaRemediationPacks,
      ARTIFACT_PATHS.workspaceIndex,
      ARTIFACT_PATHS.metaOptimizerReport
    ],
    updatedAt: null
  };
}
function createMetaGovernanceCoverageIndex() {
  return {
    version: 1,
    proposalOnly: true,
    guardedMutations: [],
    exemptMutations: [],
    summary: {
      guardedCount: 0,
      exemptCount: 0,
      overview: "No governance coverage matrix has been generated yet.",
      coveragePath: ARTIFACT_PATHS.metaGovernanceCoverage
    },
    updatedAt: null
  };
}
function createMetaGovernanceCoverageReport() {
  return {
    version: 1,
    status: "pending",
    guardedIds: [],
    exemptIds: [],
    surfaceBindingAudit: {
      uncoveredTools: [],
      uncoveredCommands: [],
      uncoveredCoreFunctions: [],
      uncoveredNegativeCoverage: []
    },
    summary: {
      guardedCount: 0,
      exemptCount: 0,
      overview: "No governance coverage proof has been generated yet.",
      reportPath: ARTIFACT_PATHS.metaGovernanceCoverageReport,
      markdownPath: ARTIFACT_PATHS.metaGovernanceCoverageReportMarkdown
    },
    updatedAt: null
  };
}
function normalizeMetaGovernanceCoverageReport(raw = {}) {
  const base = createMetaGovernanceCoverageReport();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const audit = normalizeObject(raw.surfaceBindingAudit);
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    status: normalizeString(raw.status, base.status),
    guardedIds: normalizeStringArray(raw.guardedIds),
    exemptIds: normalizeStringArray(raw.exemptIds),
    surfaceBindingAudit: {
      ...base.surfaceBindingAudit,
      ...audit,
      uncoveredTools: normalizeStringArray(audit.uncoveredTools),
      uncoveredCommands: normalizeStringArray(audit.uncoveredCommands),
      uncoveredCoreFunctions: normalizeStringArray(audit.uncoveredCoreFunctions),
      uncoveredNegativeCoverage: normalizeStringArray(audit.uncoveredNegativeCoverage)
    },
    summary: {
      ...base.summary,
      ...summary,
      guardedCount: normalizeNumber(summary.guardedCount, base.summary.guardedCount),
      exemptCount: normalizeNumber(summary.exemptCount, base.summary.exemptCount),
      overview: normalizeString(summary.overview, base.summary.overview),
      reportPath: normalizeString(summary.reportPath, base.summary.reportPath),
      markdownPath: normalizeString(summary.markdownPath, base.summary.markdownPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function normalizeMetaGovernanceCoverageIndex(raw = {}) {
  const base = createMetaGovernanceCoverageIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    guardedMutations: normalizeObjectArray(raw.guardedMutations),
    exemptMutations: normalizeObjectArray(raw.exemptMutations),
    summary: {
      ...base.summary,
      ...summary,
      guardedCount: normalizeNumber(summary.guardedCount, base.summary.guardedCount),
      exemptCount: normalizeNumber(summary.exemptCount, base.summary.exemptCount),
      overview: normalizeString(summary.overview, base.summary.overview),
      coveragePath: normalizeString(summary.coveragePath, base.summary.coveragePath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function createMetaOperatorFollowThroughIndex() {
  return {
    version: 1,
    proposalOnly: true,
    explicitOnly: true,
    items: [],
    summary: {
      itemCount: 0,
      acknowledgedCount: 0,
      acceptedForExecutionCount: 0,
      executingCount: 0,
      overdueExecutionCount: 0,
      criticalOverdueExecutionCount: 0,
      deferredCount: 0,
      acceptedRiskCount: 0,
      closedCount: 0,
      supersededCount: 0,
      invalidStatusCount: 0,
      staleCount: 0,
      dueDeferredCount: 0,
      topSourceIds: [],
      overview: "No operator follow-through decisions have been recorded yet.",
      followThroughPath: ARTIFACT_PATHS.metaOperatorFollowThrough
    },
    sourceArtifacts: [
      ARTIFACT_PATHS.metaRemediationPacks,
      ARTIFACT_PATHS.metaOperatorPlaybooks,
      ARTIFACT_PATHS.metaExecutionBridgeCandidates,
      ARTIFACT_PATHS.metaOptimizerReport,
      ARTIFACT_PATHS.workspaceIndex
    ],
    updatedAt: null
  };
}
function createMetaOperatorFollowThroughTransitionsIndex() {
  return {
    version: 1,
    proposalOnly: true,
    explicitOnly: true,
    transitions: [],
    summary: {
      transitionCount: 0,
      overview: "No operator follow-through transitions have been recorded yet.",
      transitionsPath: ARTIFACT_PATHS.metaOperatorFollowThroughTransitions
    },
    updatedAt: null
  };
}
function normalizeMetaOperatorFollowThroughTransitionsIndex(raw = {}) {
  const base = createMetaOperatorFollowThroughTransitionsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    explicitOnly: normalizeBoolean(raw.explicitOnly, base.explicitOnly),
    transitions: normalizeObjectArray(raw.transitions),
    summary: {
      ...base.summary,
      ...summary,
      transitionCount: normalizeNumber(summary.transitionCount, base.summary.transitionCount),
      overview: normalizeString(summary.overview, base.summary.overview),
      transitionsPath: normalizeString(summary.transitionsPath, base.summary.transitionsPath)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function normalizeMetaOperatorFollowThroughIndex(raw = {}) {
  const base = createMetaOperatorFollowThroughIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    explicitOnly: normalizeBoolean(raw.explicitOnly, base.explicitOnly),
    items: normalizeObjectArray(raw.items),
    summary: {
      ...base.summary,
      ...summary,
      itemCount: normalizeNumber(summary.itemCount, base.summary.itemCount),
      acknowledgedCount: normalizeNumber(summary.acknowledgedCount, base.summary.acknowledgedCount),
      acceptedForExecutionCount: normalizeNumber(summary.acceptedForExecutionCount, base.summary.acceptedForExecutionCount),
      executingCount: normalizeNumber(summary.executingCount, base.summary.executingCount),
      overdueExecutionCount: normalizeNumber(summary.overdueExecutionCount, base.summary.overdueExecutionCount),
      criticalOverdueExecutionCount: normalizeNumber(summary.criticalOverdueExecutionCount, base.summary.criticalOverdueExecutionCount),
      deferredCount: normalizeNumber(summary.deferredCount, base.summary.deferredCount),
      acceptedRiskCount: normalizeNumber(summary.acceptedRiskCount, base.summary.acceptedRiskCount),
      closedCount: normalizeNumber(summary.closedCount, base.summary.closedCount),
      supersededCount: normalizeNumber(summary.supersededCount, base.summary.supersededCount),
      invalidStatusCount: normalizeNumber(summary.invalidStatusCount, base.summary.invalidStatusCount),
      staleCount: normalizeNumber(summary.staleCount, base.summary.staleCount),
      dueDeferredCount: normalizeNumber(summary.dueDeferredCount, base.summary.dueDeferredCount),
      topSourceIds: normalizeStringArray(summary.topSourceIds),
      overview: normalizeString(summary.overview, base.summary.overview),
      followThroughPath: normalizeString(summary.followThroughPath, base.summary.followThroughPath)
    },
    sourceArtifacts: normalizeStringArray(raw.sourceArtifacts, base.sourceArtifacts),
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function normalizeMetaExecutionBridgeCandidatesIndex(raw = {}) {
  const base = createMetaExecutionBridgeCandidatesIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    noAutoApply: normalizeBoolean(raw.noAutoApply, base.noAutoApply),
    candidates: normalizeObjectArray(raw.candidates),
    summary: {
      ...base.summary,
      ...summary,
      candidateCount: normalizeNumber(summary.candidateCount, base.summary.candidateCount),
      topCandidateIds: normalizeStringArray(summary.topCandidateIds),
      candidateTypeCounts: normalizeObject(summary.candidateTypeCounts),
      overview: normalizeString(summary.overview, base.summary.overview),
      candidatesPath: normalizeString(summary.candidatesPath, base.summary.candidatesPath)
    },
    sourceArtifacts: normalizeStringArray(raw.sourceArtifacts, base.sourceArtifacts),
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function normalizeMetaOperatorPlaybooksIndex(raw = {}) {
  const base = createMetaOperatorPlaybooksIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    playbooks: normalizeObjectArray(raw.playbooks),
    summary: {
      ...base.summary,
      ...summary,
      playbookCount: normalizeNumber(summary.playbookCount, base.summary.playbookCount),
      topPlaybookIds: normalizeStringArray(summary.topPlaybookIds),
      topTaxonomyFamilyIds: normalizeStringArray(summary.topTaxonomyFamilyIds),
      actionableCount: normalizeNumber(summary.actionableCount, base.summary.actionableCount),
      partiallyActionableCount: normalizeNumber(summary.partiallyActionableCount, base.summary.partiallyActionableCount),
      advisoryCount: normalizeNumber(summary.advisoryCount, base.summary.advisoryCount),
      readinessOverview: normalizeString(summary.readinessOverview, base.summary.readinessOverview),
      overview: normalizeString(summary.overview, base.summary.overview),
      playbooksPath: normalizeString(summary.playbooksPath, base.summary.playbooksPath)
    },
    sourceArtifacts: normalizeStringArray(raw.sourceArtifacts, base.sourceArtifacts),
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function createMetaRecommendationsIndex() {
  return {
    version: 3,
    proposalOnly: true,
    items: [],
    clusters: [],
    ranking: {
      method: "durable-signal-frontier-v1",
      signals: [
        "priority",
        "recurrenceCount",
        "evidenceDensity",
        "crossSessionRecurrence",
        "repairFrontierOverlap",
        "auditCriticality",
        "bridgeCriticality",
        "queueChurn",
        "taxonomyFamilyPressure",
        "taxonomyGroupPressure"
      ],
      tieBreakOrder: ["score-desc", "priority-rank", "cluster-rank", "cluster-id", "category", "id"]
    },
    frontier: {
      recommendationCount: 0,
      criticalCount: 0,
      clusterCount: 0,
      frontierScore: 0,
      topClusterIds: [],
      topRecommendationIds: [],
      activeSignalTypes: [],
      topTaxonomyFamilyIds: [],
      topTaxonomyGroupIds: [],
      pressureAreas: [],
      taxonomyOverview: "No typed wiki taxonomy pressure is currently active in the optimizer frontier.",
      frontierSummary: "No proposal-only optimizer recommendations have been generated yet.",
      rankingMethod: "durable-signal-frontier-v1"
    },
    summary: {
      recommendationCount: 0,
      criticalCount: 0,
      clusterCount: 0,
      frontierScore: 0,
      categories: {},
      signalTypes: [],
      topClusterIds: [],
      topRecommendationIds: [],
      topTaxonomyFamilyIds: [],
      topTaxonomyGroupIds: [],
      pressureAreas: [],
      taxonomyOverview: "No typed wiki taxonomy pressure is currently active in the optimizer frontier.",
      clusterMembership: {},
      topClusters: []
    },
    updatedAt: null
  };
}
function normalizeMetaRecommendationsIndex(raw = {}) {
  const base = createMetaRecommendationsIndex();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const ranking = normalizeObject(raw.ranking);
  const frontier = normalizeObject(raw.frontier);
  const summary = normalizeObject(raw.summary);
  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    items: normalizeObjectArray(raw.items),
    clusters: normalizeObjectArray(raw.clusters),
    ranking: {
      ...base.ranking,
      ...ranking,
      method: normalizeString(ranking.method, base.ranking.method),
      signals: normalizeStringArray(ranking.signals, base.ranking.signals),
      tieBreakOrder: normalizeStringArray(ranking.tieBreakOrder, base.ranking.tieBreakOrder)
    },
    frontier: {
      ...base.frontier,
      ...frontier,
      recommendationCount: normalizeNumber(frontier.recommendationCount, base.frontier.recommendationCount),
      criticalCount: normalizeNumber(frontier.criticalCount, base.frontier.criticalCount),
      clusterCount: normalizeNumber(frontier.clusterCount, base.frontier.clusterCount),
      frontierScore: normalizeNumber(frontier.frontierScore, base.frontier.frontierScore),
      topClusterIds: normalizeStringArray(frontier.topClusterIds),
      topRecommendationIds: normalizeStringArray(frontier.topRecommendationIds),
      activeSignalTypes: normalizeStringArray(frontier.activeSignalTypes),
      topTaxonomyFamilyIds: normalizeStringArray(frontier.topTaxonomyFamilyIds),
      topTaxonomyGroupIds: normalizeStringArray(frontier.topTaxonomyGroupIds),
      pressureAreas: normalizeStringArray(frontier.pressureAreas),
      taxonomyOverview: normalizeString(frontier.taxonomyOverview, base.frontier.taxonomyOverview),
      frontierSummary: normalizeString(frontier.frontierSummary, base.frontier.frontierSummary),
      rankingMethod: normalizeString(frontier.rankingMethod, base.frontier.rankingMethod)
    },
    summary: {
      ...base.summary,
      ...summary,
      recommendationCount: normalizeNumber(summary.recommendationCount, base.summary.recommendationCount),
      criticalCount: normalizeNumber(summary.criticalCount, base.summary.criticalCount),
      clusterCount: normalizeNumber(summary.clusterCount, base.summary.clusterCount),
      frontierScore: normalizeNumber(summary.frontierScore, base.summary.frontierScore),
      categories: normalizeObject(summary.categories),
      signalTypes: normalizeStringArray(summary.signalTypes),
      topClusterIds: normalizeStringArray(summary.topClusterIds),
      topRecommendationIds: normalizeStringArray(summary.topRecommendationIds),
      topTaxonomyFamilyIds: normalizeStringArray(summary.topTaxonomyFamilyIds),
      topTaxonomyGroupIds: normalizeStringArray(summary.topTaxonomyGroupIds),
      pressureAreas: normalizeStringArray(summary.pressureAreas),
      taxonomyOverview: normalizeString(summary.taxonomyOverview, base.summary.taxonomyOverview),
      clusterMembership: normalizeStringArrayRecord(summary.clusterMembership),
      topClusters: normalizeObjectArray(summary.topClusters)
    },
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function createMetaOptimizerState() {
  return {
    version: 5,
    proposalOnly: true,
    sourceArtifacts: [
      ARTIFACT_PATHS.sessionJournal,
      ARTIFACT_PATHS.reviewConcerns,
      ARTIFACT_PATHS.adversarialReviewState,
      ARTIFACT_PATHS.experimentAudits,
      ARTIFACT_PATHS.claimBridgeLog,
      ARTIFACT_PATHS.figureQa,
      ARTIFACT_PATHS.versionComparisons,
      ARTIFACT_PATHS.metaLongHorizonMemory,
      ARTIFACT_PATHS.metaOperatorLessons,
      ARTIFACT_PATHS.metaExecutionBridgeCandidates,
      ARTIFACT_PATHS.metaOperatorFollowThrough,
      ARTIFACT_PATHS.metaOperatorFollowThroughTransitions,
      ARTIFACT_PATHS.metaOperatorPlaybooks,
      ARTIFACT_PATHS.metaRemediationPacks,
      ARTIFACT_PATHS.orchestrationBoard,
      ARTIFACT_PATHS.workspaceIndex
    ],
    frontier: {
      recommendationCount: 0,
      criticalCount: 0,
      clusterCount: 0,
      frontierScore: 0,
      activeSignalTypes: [],
      topClusterIds: [],
      topRecommendationIds: [],
      topClusters: [],
      topTaxonomyFamilyIds: [],
      topTaxonomyGroupIds: [],
      pressureAreas: [],
      taxonomyOverview: "No typed wiki taxonomy pressure is currently active in the optimizer frontier.",
      frontierSummary: "No proposal-only optimizer recommendations have been generated yet.",
      rankingMethod: "durable-signal-frontier-v1",
      tieBreakOrder: ["score-desc", "priority-rank", "cluster-rank", "cluster-id", "category", "id"],
      reportPath: ARTIFACT_PATHS.metaOptimizerReport,
      recommendationsPath: ARTIFACT_PATHS.metaRecommendations,
      statePath: ARTIFACT_PATHS.metaOptimizerState,
      longHorizonPath: ARTIFACT_PATHS.metaLongHorizonMemory,
      remediationPacksPath: ARTIFACT_PATHS.metaRemediationPacks
    },
    clusters: [],
    remediationPacks: {
      packCount: 0,
      topPackIds: [],
      topClusterIds: [],
      actionableCount: 0,
      partiallyActionableCount: 0,
      advisoryCount: 0,
      readinessOverview: "No proposal-only remediation packs have been generated yet.",
      overview: "No proposal-only remediation packs have been generated yet.",
      packsPath: ARTIFACT_PATHS.metaRemediationPacks
    },
    followThrough: {
      itemCount: 0,
      acknowledgedCount: 0,
      acceptedForExecutionCount: 0,
      executingCount: 0,
      overdueExecutionCount: 0,
      criticalOverdueExecutionCount: 0,
      deferredCount: 0,
      acceptedRiskCount: 0,
      closedCount: 0,
      supersededCount: 0,
      invalidStatusCount: 0,
      staleCount: 0,
      dueDeferredCount: 0,
      topSourceIds: [],
      overview: "No operator follow-through decisions have been recorded yet.",
      followThroughPath: ARTIFACT_PATHS.metaOperatorFollowThrough
    },
    operatorLessons: summarizeOperatorLessons([]),
    executionBridgeCandidates: {
      candidateCount: 0,
      topCandidateIds: [],
      overview: "No proposal-only execution bridge candidates have been generated yet.",
      candidatesPath: ARTIFACT_PATHS.metaExecutionBridgeCandidates
    },
    governanceCoverage: {
      guardedCount: 0,
      exemptCount: 0,
      overview: "No governance coverage matrix has been summarized yet.",
      coveragePath: ARTIFACT_PATHS.metaGovernanceCoverage
    },
    operatorPlaybooks: {
      playbookCount: 0,
      topPlaybookIds: [],
      topTaxonomyFamilyIds: [],
      actionableCount: 0,
      partiallyActionableCount: 0,
      advisoryCount: 0,
      readinessOverview: "No proposal-only family-level operator playbooks have been generated yet.",
      overview: "No proposal-only family-level operator playbooks have been generated yet.",
      playbooksPath: ARTIFACT_PATHS.metaOperatorPlaybooks
    },
    longHorizon: {
      familyCount: 0,
      recurringFamilyCount: 0,
      risingFamilyCount: 0,
      stableFamilyCount: 0,
      coolingFamilyCount: 0,
      snapshotCount: 0,
      lastObservedAt: null,
      lastAction: "unchanged",
      topFamilyIds: [],
      topTaxonomyFamilyIds: [],
      topTaxonomyGroupIds: [],
      pressureAreas: [],
      overview: "No long-horizon workflow memory has been summarized yet.",
      memoryPath: ARTIFACT_PATHS.metaLongHorizonMemory
    },
    lastRefreshedAt: null,
    updatedAt: null
  };
}
function normalizeMetaOptimizerState(raw = {}) {
  const base = createMetaOptimizerState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const frontier = normalizeObject(raw.frontier);
  const longHorizon = normalizeObject(raw.longHorizon);
  const operatorLessons = normalizeObject(raw.operatorLessons);
  return {
    ...base,
    ...raw,
    version: base.version,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    sourceArtifacts: normalizeStringArray(raw.sourceArtifacts, base.sourceArtifacts),
    frontier: {
      ...base.frontier,
      ...frontier,
      recommendationCount: normalizeNumber(frontier.recommendationCount, base.frontier.recommendationCount),
      criticalCount: normalizeNumber(frontier.criticalCount, base.frontier.criticalCount),
      clusterCount: normalizeNumber(frontier.clusterCount, base.frontier.clusterCount),
      frontierScore: normalizeNumber(frontier.frontierScore, base.frontier.frontierScore),
      activeSignalTypes: normalizeStringArray(frontier.activeSignalTypes),
      topClusterIds: normalizeStringArray(frontier.topClusterIds),
      topRecommendationIds: normalizeStringArray(frontier.topRecommendationIds),
      topClusters: normalizeObjectArray(frontier.topClusters),
      topTaxonomyFamilyIds: normalizeStringArray(frontier.topTaxonomyFamilyIds),
      topTaxonomyGroupIds: normalizeStringArray(frontier.topTaxonomyGroupIds),
      pressureAreas: normalizeStringArray(frontier.pressureAreas),
      taxonomyOverview: normalizeString(frontier.taxonomyOverview, base.frontier.taxonomyOverview),
      frontierSummary: normalizeString(frontier.frontierSummary, base.frontier.frontierSummary),
      rankingMethod: normalizeString(frontier.rankingMethod, base.frontier.rankingMethod),
      tieBreakOrder: normalizeStringArray(frontier.tieBreakOrder, base.frontier.tieBreakOrder),
      reportPath: normalizeString(frontier.reportPath, base.frontier.reportPath),
      recommendationsPath: normalizeString(frontier.recommendationsPath, base.frontier.recommendationsPath),
      statePath: normalizeString(frontier.statePath, base.frontier.statePath),
      longHorizonPath: normalizeString(frontier.longHorizonPath, base.frontier.longHorizonPath),
      remediationPacksPath: normalizeString(frontier.remediationPacksPath, base.frontier.remediationPacksPath)
    },
    clusters: normalizeObjectArray(raw.clusters),
    operatorPlaybooks: {
      ...base.operatorPlaybooks,
      ...normalizeObject(raw.operatorPlaybooks),
      playbookCount: normalizeNumber(raw.operatorPlaybooks?.playbookCount, base.operatorPlaybooks.playbookCount),
      topPlaybookIds: normalizeStringArray(raw.operatorPlaybooks?.topPlaybookIds),
      topTaxonomyFamilyIds: normalizeStringArray(raw.operatorPlaybooks?.topTaxonomyFamilyIds),
      actionableCount: normalizeNumber(raw.operatorPlaybooks?.actionableCount, base.operatorPlaybooks.actionableCount),
      partiallyActionableCount: normalizeNumber(raw.operatorPlaybooks?.partiallyActionableCount, base.operatorPlaybooks.partiallyActionableCount),
      advisoryCount: normalizeNumber(raw.operatorPlaybooks?.advisoryCount, base.operatorPlaybooks.advisoryCount),
      readinessOverview: normalizeString(raw.operatorPlaybooks?.readinessOverview, base.operatorPlaybooks.readinessOverview),
      overview: normalizeString(raw.operatorPlaybooks?.overview, base.operatorPlaybooks.overview),
      playbooksPath: normalizeString(raw.operatorPlaybooks?.playbooksPath, base.operatorPlaybooks.playbooksPath)
    },
    executionBridgeCandidates: {
      ...base.executionBridgeCandidates,
      ...normalizeObject(raw.executionBridgeCandidates),
      candidateCount: normalizeNumber(raw.executionBridgeCandidates?.candidateCount, base.executionBridgeCandidates.candidateCount),
      topCandidateIds: normalizeStringArray(raw.executionBridgeCandidates?.topCandidateIds),
      overview: normalizeString(raw.executionBridgeCandidates?.overview, base.executionBridgeCandidates.overview),
      candidatesPath: normalizeString(raw.executionBridgeCandidates?.candidatesPath, base.executionBridgeCandidates.candidatesPath)
    },
    governanceCoverage: {
      ...base.governanceCoverage,
      ...normalizeObject(raw.governanceCoverage),
      guardedCount: normalizeNumber(raw.governanceCoverage?.guardedCount, base.governanceCoverage.guardedCount),
      exemptCount: normalizeNumber(raw.governanceCoverage?.exemptCount, base.governanceCoverage.exemptCount),
      overview: normalizeString(raw.governanceCoverage?.overview, base.governanceCoverage.overview),
      coveragePath: normalizeString(raw.governanceCoverage?.coveragePath, base.governanceCoverage.coveragePath)
    },
    remediationPacks: {
      ...base.remediationPacks,
      ...normalizeObject(raw.remediationPacks),
      packCount: normalizeNumber(raw.remediationPacks?.packCount, base.remediationPacks.packCount),
      topPackIds: normalizeStringArray(raw.remediationPacks?.topPackIds),
      topClusterIds: normalizeStringArray(raw.remediationPacks?.topClusterIds),
      actionableCount: normalizeNumber(raw.remediationPacks?.actionableCount, base.remediationPacks.actionableCount),
      partiallyActionableCount: normalizeNumber(raw.remediationPacks?.partiallyActionableCount, base.remediationPacks.partiallyActionableCount),
      advisoryCount: normalizeNumber(raw.remediationPacks?.advisoryCount, base.remediationPacks.advisoryCount),
      readinessOverview: normalizeString(raw.remediationPacks?.readinessOverview, base.remediationPacks.readinessOverview),
      overview: normalizeString(raw.remediationPacks?.overview, base.remediationPacks.overview),
      packsPath: normalizeString(raw.remediationPacks?.packsPath, base.remediationPacks.packsPath)
    },
    followThrough: {
      ...base.followThrough,
      ...normalizeObject(raw.followThrough),
      itemCount: normalizeNumber(raw.followThrough?.itemCount, base.followThrough.itemCount),
      acknowledgedCount: normalizeNumber(raw.followThrough?.acknowledgedCount, base.followThrough.acknowledgedCount),
      acceptedForExecutionCount: normalizeNumber(raw.followThrough?.acceptedForExecutionCount, base.followThrough.acceptedForExecutionCount),
      executingCount: normalizeNumber(raw.followThrough?.executingCount, base.followThrough.executingCount),
      overdueExecutionCount: normalizeNumber(raw.followThrough?.overdueExecutionCount, base.followThrough.overdueExecutionCount),
      criticalOverdueExecutionCount: normalizeNumber(raw.followThrough?.criticalOverdueExecutionCount, base.followThrough.criticalOverdueExecutionCount),
      deferredCount: normalizeNumber(raw.followThrough?.deferredCount, base.followThrough.deferredCount),
      acceptedRiskCount: normalizeNumber(raw.followThrough?.acceptedRiskCount, base.followThrough.acceptedRiskCount),
      closedCount: normalizeNumber(raw.followThrough?.closedCount, base.followThrough.closedCount),
      supersededCount: normalizeNumber(raw.followThrough?.supersededCount, base.followThrough.supersededCount),
      invalidStatusCount: normalizeNumber(raw.followThrough?.invalidStatusCount, base.followThrough.invalidStatusCount),
      staleCount: normalizeNumber(raw.followThrough?.staleCount, base.followThrough.staleCount),
      dueDeferredCount: normalizeNumber(raw.followThrough?.dueDeferredCount, base.followThrough.dueDeferredCount),
      topSourceIds: normalizeStringArray(raw.followThrough?.topSourceIds),
      overview: normalizeString(raw.followThrough?.overview, base.followThrough.overview),
      followThroughPath: normalizeString(raw.followThrough?.followThroughPath, base.followThrough.followThroughPath)
    },
    operatorLessons: {
      ...base.operatorLessons,
      ...operatorLessons,
      lessonCount: normalizeNumber(operatorLessons.lessonCount, base.operatorLessons.lessonCount),
      activeLessonCount: normalizeNumber(operatorLessons.activeLessonCount, base.operatorLessons.activeLessonCount),
      topLessonIds: normalizeStringArray(operatorLessons.topLessonIds),
      topTags: normalizeStringArray(operatorLessons.topTags),
      topDomains: normalizeStringArray(operatorLessons.topDomains),
      overview: normalizeString(operatorLessons.overview, base.operatorLessons.overview),
      lessonsPath: normalizeString(operatorLessons.lessonsPath, base.operatorLessons.lessonsPath)
    },
    longHorizon: {
      ...base.longHorizon,
      ...longHorizon,
      familyCount: normalizeNumber(longHorizon.familyCount, base.longHorizon.familyCount),
      recurringFamilyCount: normalizeNumber(longHorizon.recurringFamilyCount, base.longHorizon.recurringFamilyCount),
      risingFamilyCount: normalizeNumber(longHorizon.risingFamilyCount, base.longHorizon.risingFamilyCount),
      stableFamilyCount: normalizeNumber(longHorizon.stableFamilyCount, base.longHorizon.stableFamilyCount),
      coolingFamilyCount: normalizeNumber(longHorizon.coolingFamilyCount, base.longHorizon.coolingFamilyCount),
      snapshotCount: normalizeNumber(longHorizon.snapshotCount, base.longHorizon.snapshotCount),
      lastObservedAt: longHorizon.lastObservedAt ?? base.longHorizon.lastObservedAt,
      lastAction: normalizeString(longHorizon.lastAction, base.longHorizon.lastAction),
      topFamilyIds: normalizeStringArray(longHorizon.topFamilyIds),
      topTaxonomyFamilyIds: normalizeStringArray(longHorizon.topTaxonomyFamilyIds),
      topTaxonomyGroupIds: normalizeStringArray(longHorizon.topTaxonomyGroupIds),
      pressureAreas: normalizeStringArray(longHorizon.pressureAreas),
      overview: normalizeString(longHorizon.overview, base.longHorizon.overview),
      memoryPath: normalizeString(longHorizon.memoryPath, base.longHorizon.memoryPath)
    },
    lastRefreshedAt: raw.lastRefreshedAt ?? base.lastRefreshedAt,
    updatedAt: raw.updatedAt ?? base.updatedAt
  };
}
function normalizeWorkspaceAutonomyLoops(raw = {}, fallback = null) {
  const base = fallback ?? createWorkspaceIndex().autonomyLoops;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  return {
    ...base,
    ...raw,
    contractVersion: normalizeString(raw.contractVersion, base.contractVersion),
    activeLifecycleState: normalizeString(raw.activeLifecycleState, base.activeLifecycleState),
    loopCount: normalizeNumber(raw.loopCount, base.loopCount),
    blockedCount: normalizeNumber(raw.blockedCount, base.blockedCount),
    readyCount: normalizeNumber(raw.readyCount, base.readyCount),
    closedCount: normalizeNumber(raw.closedCount, base.closedCount),
    currentLoopId: normalizeString(raw.currentLoopId, base.currentLoopId),
    nextSafeAction: normalizeString(raw.nextSafeAction, base.nextSafeAction),
    explicitOnly: normalizeBoolean(raw.explicitOnly, base.explicitOnly),
    noHiddenRuntime: normalizeBoolean(raw.noHiddenRuntime, base.noHiddenRuntime),
    families: normalizeStringArray(raw.families),
    loops: normalizeObjectArray(raw.loops),
    approvalPointers: normalizeStringArray(raw.approvalPointers),
    runtimePointers: normalizeStringArray(raw.runtimePointers),
    followThroughPointers: normalizeStringArray(raw.followThroughPointers),
    blockerIds: normalizeStringArray(raw.blockerIds),
    closureStates: normalizeStringArray(raw.closureStates),
    lifecycleStates: normalizeStringArray(raw.lifecycleStates),
    safeExecutionPath: normalizeString(raw.safeExecutionPath, base.safeExecutionPath),
    overview: normalizeString(raw.overview, base.overview)
  };
}
function normalizeWorkspaceMetaOptimize(raw = {}, fallback = null) {
  const base = fallback ?? createWorkspaceIndex().metaOptimize;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const longHorizon = normalizeObject(raw.longHorizon);
  const remediationPacks = normalizeObject(raw.remediationPacks);
  const operatorPlaybooks = normalizeObject(raw.operatorPlaybooks);
  const executionBridgeCandidates = normalizeObject(raw.executionBridgeCandidates);
  const governanceCoverage = normalizeObject(raw.governanceCoverage);
  const followThrough = normalizeObject(raw.followThrough);
  const operatorLessons = normalizeObject(raw.operatorLessons);
  const autonomyLoops = normalizeObject(raw.autonomyLoops);
  const baseGovernanceCoverage = normalizeObject(base.governanceCoverage, {
    guardedCount: 0,
    exemptCount: 0,
    overview: "No governance coverage matrix has been summarized yet.",
    coveragePath: ARTIFACT_PATHS.metaGovernanceCoverage
  });
  return {
    ...base,
    ...raw,
    proposalOnly: normalizeBoolean(raw.proposalOnly, base.proposalOnly),
    recommendationCount: normalizeNumber(raw.recommendationCount, base.recommendationCount),
    criticalCount: normalizeNumber(raw.criticalCount, base.criticalCount),
    clusterCount: normalizeNumber(raw.clusterCount, base.clusterCount),
    frontierScore: normalizeNumber(raw.frontierScore, base.frontierScore),
    activeSignalTypes: normalizeStringArray(raw.activeSignalTypes),
    topClusterIds: normalizeStringArray(raw.topClusterIds),
    topRecommendationIds: normalizeStringArray(raw.topRecommendationIds),
    topClusters: normalizeObjectArray(raw.topClusters),
    topTaxonomyFamilyIds: normalizeStringArray(raw.topTaxonomyFamilyIds),
    topTaxonomyGroupIds: normalizeStringArray(raw.topTaxonomyGroupIds),
    pressureAreas: normalizeStringArray(raw.pressureAreas),
    taxonomyOverview: normalizeString(raw.taxonomyOverview, base.taxonomyOverview),
    frontierSummary: normalizeString(raw.frontierSummary, base.frontierSummary),
    rankingMethod: normalizeString(raw.rankingMethod, base.rankingMethod),
    tieBreakOrder: normalizeStringArray(raw.tieBreakOrder, base.tieBreakOrder),
    reportPath: normalizeString(raw.reportPath, base.reportPath),
    recommendationsPath: normalizeString(raw.recommendationsPath, base.recommendationsPath),
    statePath: normalizeString(raw.statePath, base.statePath),
    longHorizonPath: normalizeString(raw.longHorizonPath, base.longHorizonPath),
    remediationPacks: {
      ...base.remediationPacks,
      ...remediationPacks,
      packCount: normalizeNumber(remediationPacks.packCount, base.remediationPacks.packCount),
      topPackIds: normalizeStringArray(remediationPacks.topPackIds),
      topClusterIds: normalizeStringArray(remediationPacks.topClusterIds),
      actionableCount: normalizeNumber(remediationPacks.actionableCount, base.remediationPacks.actionableCount),
      partiallyActionableCount: normalizeNumber(remediationPacks.partiallyActionableCount, base.remediationPacks.partiallyActionableCount),
      advisoryCount: normalizeNumber(remediationPacks.advisoryCount, base.remediationPacks.advisoryCount),
      readinessOverview: normalizeString(remediationPacks.readinessOverview, base.remediationPacks.readinessOverview),
      overview: normalizeString(remediationPacks.overview, base.remediationPacks.overview),
      packsPath: normalizeString(remediationPacks.packsPath, base.remediationPacks.packsPath)
    },
    executionBridgeCandidates: {
      ...base.executionBridgeCandidates,
      ...executionBridgeCandidates,
      candidateCount: normalizeNumber(executionBridgeCandidates.candidateCount, base.executionBridgeCandidates.candidateCount),
      topCandidateIds: normalizeStringArray(executionBridgeCandidates.topCandidateIds),
      overview: normalizeString(executionBridgeCandidates.overview, base.executionBridgeCandidates.overview),
      candidatesPath: normalizeString(executionBridgeCandidates.candidatesPath, base.executionBridgeCandidates.candidatesPath)
    },
    governanceCoverage: {
      ...baseGovernanceCoverage,
      ...governanceCoverage,
      guardedCount: normalizeNumber(governanceCoverage.guardedCount, baseGovernanceCoverage.guardedCount),
      exemptCount: normalizeNumber(governanceCoverage.exemptCount, baseGovernanceCoverage.exemptCount),
      overview: normalizeString(governanceCoverage.overview, baseGovernanceCoverage.overview),
      coveragePath: normalizeString(governanceCoverage.coveragePath, baseGovernanceCoverage.coveragePath)
    },
    followThrough: {
      ...base.followThrough,
      ...followThrough,
      itemCount: normalizeNumber(followThrough.itemCount, base.followThrough.itemCount),
      acknowledgedCount: normalizeNumber(followThrough.acknowledgedCount, base.followThrough.acknowledgedCount),
      acceptedForExecutionCount: normalizeNumber(followThrough.acceptedForExecutionCount, base.followThrough.acceptedForExecutionCount),
      deferredCount: normalizeNumber(followThrough.deferredCount, base.followThrough.deferredCount),
      acceptedRiskCount: normalizeNumber(followThrough.acceptedRiskCount, base.followThrough.acceptedRiskCount),
      closedCount: normalizeNumber(followThrough.closedCount, base.followThrough.closedCount),
      supersededCount: normalizeNumber(followThrough.supersededCount, base.followThrough.supersededCount),
      staleCount: normalizeNumber(followThrough.staleCount, base.followThrough.staleCount),
      dueDeferredCount: normalizeNumber(followThrough.dueDeferredCount, base.followThrough.dueDeferredCount),
      topSourceIds: normalizeStringArray(followThrough.topSourceIds),
      overview: normalizeString(followThrough.overview, base.followThrough.overview),
      followThroughPath: normalizeString(followThrough.followThroughPath, base.followThrough.followThroughPath)
    },
    operatorLessons: {
      ...base.operatorLessons,
      ...operatorLessons,
      lessonCount: normalizeNumber(operatorLessons.lessonCount, base.operatorLessons.lessonCount),
      activeLessonCount: normalizeNumber(operatorLessons.activeLessonCount, base.operatorLessons.activeLessonCount),
      topLessonIds: normalizeStringArray(operatorLessons.topLessonIds),
      topTags: normalizeStringArray(operatorLessons.topTags),
      topDomains: normalizeStringArray(operatorLessons.topDomains),
      overview: normalizeString(operatorLessons.overview, base.operatorLessons.overview),
      lessonsPath: normalizeString(operatorLessons.lessonsPath, base.operatorLessons.lessonsPath)
    },
    operatorPlaybooks: {
      ...base.operatorPlaybooks,
      ...operatorPlaybooks,
      playbookCount: normalizeNumber(operatorPlaybooks.playbookCount, base.operatorPlaybooks.playbookCount),
      topPlaybookIds: normalizeStringArray(operatorPlaybooks.topPlaybookIds),
      topTaxonomyFamilyIds: normalizeStringArray(operatorPlaybooks.topTaxonomyFamilyIds),
      actionableCount: normalizeNumber(operatorPlaybooks.actionableCount, base.operatorPlaybooks.actionableCount),
      partiallyActionableCount: normalizeNumber(operatorPlaybooks.partiallyActionableCount, base.operatorPlaybooks.partiallyActionableCount),
      advisoryCount: normalizeNumber(operatorPlaybooks.advisoryCount, base.operatorPlaybooks.advisoryCount),
      readinessOverview: normalizeString(operatorPlaybooks.readinessOverview, base.operatorPlaybooks.readinessOverview),
      overview: normalizeString(operatorPlaybooks.overview, base.operatorPlaybooks.overview),
      playbooksPath: normalizeString(operatorPlaybooks.playbooksPath, base.operatorPlaybooks.playbooksPath)
    },
    autonomyLoops: normalizeWorkspaceAutonomyLoops(autonomyLoops, base.autonomyLoops),
    longHorizon: {
      ...base.longHorizon,
      ...longHorizon,
      familyCount: normalizeNumber(longHorizon.familyCount, base.longHorizon.familyCount),
      recurringFamilyCount: normalizeNumber(longHorizon.recurringFamilyCount, base.longHorizon.recurringFamilyCount),
      risingFamilyCount: normalizeNumber(longHorizon.risingFamilyCount, base.longHorizon.risingFamilyCount),
      stableFamilyCount: normalizeNumber(longHorizon.stableFamilyCount, base.longHorizon.stableFamilyCount),
      coolingFamilyCount: normalizeNumber(longHorizon.coolingFamilyCount, base.longHorizon.coolingFamilyCount),
      snapshotCount: normalizeNumber(longHorizon.snapshotCount, base.longHorizon.snapshotCount),
      lastObservedAt: longHorizon.lastObservedAt ?? base.longHorizon.lastObservedAt,
      lastAction: normalizeString(longHorizon.lastAction, base.longHorizon.lastAction),
      topFamilyIds: normalizeStringArray(longHorizon.topFamilyIds),
      topTaxonomyFamilyIds: normalizeStringArray(longHorizon.topTaxonomyFamilyIds),
      topTaxonomyGroupIds: normalizeStringArray(longHorizon.topTaxonomyGroupIds),
      pressureAreas: normalizeStringArray(longHorizon.pressureAreas),
      overview: normalizeString(longHorizon.overview, base.longHorizon.overview),
      memoryPath: normalizeString(longHorizon.memoryPath, base.longHorizon.memoryPath)
    }
  };
}
function createRebuttalIssuesIndex() {
  return { version: 1, items: [], updatedAt: null };
}
function createVersionsIndex() {
  return {
    version: 1,
    currentVersionId: null,
    items: [],
    lineage: [],
    updatedAt: null
  };
}
function createVersionComparisonsIndex() {
  return { version: 1, items: [], activeTargets: [], updatedAt: null };
}
function createWikiEntitiesIndex() {
  return { version: 1, items: [], updatedAt: null };
}
function createWikiRelationsIndex() {
  return {
    version: 3,
    items: [],
    summary: {
      totalRelations: 0,
      healthyCount: 0,
      degradedCount: 0,
      relationTypeCounts: {},
      integrityReasonCounts: {},
      repairFrontier: [],
      taxonomyRepairFrontier: [],
      taxonomy: {
        familyCount: 0,
        groupCount: 0,
        degradedFamilyCount: 0,
        degradedGroupCount: 0,
        familyCounts: {},
        groupCounts: {},
        topDegradedFamilyIds: [],
        topDegradedGroupIds: [],
        families: [],
        groups: [],
        overview: "No typed wiki relation taxonomy has been summarized yet."
      }
    },
    updatedAt: null
  };
}
function createWorkspaceIndex() {
  return {
    version: 9,
    managed: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workspaceIndex),
    boardPhase: "init",
    boardAssignedRole: "planner",
    boardIntentType: "plan",
    currentFocus: "\u5BF9\u9F50\u6301\u4E45\u5DE5\u4F5C\u6D41\u72B6\u6001\u3002",
    nextAction: "\u5237\u65B0\u770B\u677F\u5E76\u9009\u62E9\u4E0B\u4E00\u4E2A\u89D2\u8272\u8D1F\u8D23\u7684\u6B65\u9AA4\u3002",
    continuationState: createContinuationState(),
    activePackets: [],
    workQueues: {
      ready: [],
      waiting: [],
      reviewNeeded: [],
      handoff: [],
      stale: [],
      archived: []
    },
    ownershipSummary: [],
    packetLifecycleCounts: {},
    handoffObligations: [],
    resumeGuidance: {
      command: "project:dove.status",
      summary: "\u5237\u65B0\u770B\u677F\u5E76\u9009\u62E9\u4E0B\u4E00\u4E2A\u89D2\u8272\u8D1F\u8D23\u7684\u6B65\u9AA4\u3002",
      prioritizedPacketIds: [],
      packetContextPaths: [],
      handoffCandidateIds: []
    },
    contextSurfaces: {
      currentRoleContextPath: `${ARTIFACT_PATHS.roleContextsDir}/planner.json`,
      currentPhaseContextPath: `${ARTIFACT_PATHS.phaseContextsDir}/init.json`,
      currentActionContextPath: `${ARTIFACT_PATHS.actionContextsDir}/current.json`,
      prioritizedArtifactContextPaths: [],
      prioritizedPacketActionContextPaths: []
    },
    behaviorDiscipline: {
      summary: "Read the closest role, phase, packet, and artifact context before mutating durable workflow state.",
      explicitOnly: true,
      noHiddenRuntime: true,
      requiredReadOrder: []
    },
    dependencyHealth: {
      blockedPacketIds: [],
      healthyPacketIds: [],
      waitingPacketIds: [],
      stalePacketIds: [],
      missingDependencyIds: [],
      orphanPacketIds: []
    },
    repairFrontier: {
      count: 0,
      relationIssueCount: 0,
      relationFamilyIssueCount: 0,
      managedArtifactIssueCount: 0,
      governanceIssueCount: 0,
      topDegradedFamilyIds: [],
      topDegradedGroupIds: [],
      taxonomyOverview: "No degraded typed wiki relation families are currently summarized.",
      relationFamilySummaries: [],
      relationGroupSummaries: [],
      prioritizedItems: []
    },
    metaOptimize: {
      proposalOnly: true,
      recommendationCount: 0,
      criticalCount: 0,
      clusterCount: 0,
      frontierScore: 0,
      activeSignalTypes: [],
      topClusterIds: [],
      topRecommendationIds: [],
      topClusters: [],
      topTaxonomyFamilyIds: [],
      topTaxonomyGroupIds: [],
      pressureAreas: [],
      taxonomyOverview: "No typed wiki taxonomy pressure is currently active in the optimizer frontier.",
      frontierSummary: "No proposal-only optimizer recommendations have been generated yet.",
      rankingMethod: "durable-signal-frontier-v1",
      tieBreakOrder: ["score-desc", "priority-rank", "cluster-rank", "cluster-id", "category", "id"],
      reportPath: ARTIFACT_PATHS.metaOptimizerReport,
      recommendationsPath: ARTIFACT_PATHS.metaRecommendations,
      statePath: ARTIFACT_PATHS.metaOptimizerState,
      longHorizonPath: ARTIFACT_PATHS.metaLongHorizonMemory,
      remediationPacks: {
        packCount: 0,
        topPackIds: [],
        topClusterIds: [],
        actionableCount: 0,
        partiallyActionableCount: 0,
        advisoryCount: 0,
        readinessOverview: "No proposal-only remediation packs have been generated yet.",
        overview: "No proposal-only remediation packs have been generated yet.",
        packsPath: ARTIFACT_PATHS.metaRemediationPacks
      },
      governanceCoverage: {
        guardedCount: 0,
        exemptCount: 0,
        overview: "No governance coverage matrix has been summarized yet.",
        coveragePath: ARTIFACT_PATHS.metaGovernanceCoverage
      },
      followThrough: {
        itemCount: 0,
        acknowledgedCount: 0,
        acceptedForExecutionCount: 0,
        deferredCount: 0,
        acceptedRiskCount: 0,
        closedCount: 0,
        supersededCount: 0,
        staleCount: 0,
        dueDeferredCount: 0,
        topSourceIds: [],
        overview: "No operator follow-through decisions have been recorded yet.",
        followThroughPath: ARTIFACT_PATHS.metaOperatorFollowThrough
      },
      operatorLessons: summarizeOperatorLessons([]),
      executionBridgeCandidates: {
        candidateCount: 0,
        topCandidateIds: [],
        overview: "No proposal-only execution bridge candidates have been generated yet.",
        candidatesPath: ARTIFACT_PATHS.metaExecutionBridgeCandidates
      },
      operatorPlaybooks: {
        playbookCount: 0,
        topPlaybookIds: [],
        topTaxonomyFamilyIds: [],
        actionableCount: 0,
        partiallyActionableCount: 0,
        advisoryCount: 0,
        readinessOverview: "No proposal-only family-level operator playbooks have been generated yet.",
        overview: "No proposal-only family-level operator playbooks have been generated yet.",
        playbooksPath: ARTIFACT_PATHS.metaOperatorPlaybooks
      },
      longHorizon: {
        familyCount: 0,
        recurringFamilyCount: 0,
        risingFamilyCount: 0,
        stableFamilyCount: 0,
        coolingFamilyCount: 0,
        snapshotCount: 0,
        lastObservedAt: null,
        lastAction: "unchanged",
        topFamilyIds: [],
        topTaxonomyFamilyIds: [],
        topTaxonomyGroupIds: [],
        pressureAreas: [],
        overview: "No long-horizon workflow memory has been summarized yet.",
        memoryPath: ARTIFACT_PATHS.metaLongHorizonMemory
      }
    },
    runtime: {
      explicitInvocationOnly: true,
      noDaemon: true,
      selectionPolicy: "planner-materialized-guidance-v2",
      boundedStepPolicy: "planner-control-plane-worker-step-v1",
      controllerStatePath: ARTIFACT_PATHS.runtimeControllerState,
      leasesPath: ARTIFACT_PATHS.runtimeLeases,
      eventsPath: ARTIFACT_PATHS.runtimeEvents,
      resultsPath: ARTIFACT_PATHS.runtimeResults,
      lastRunId: null,
      lastStatus: "never-run",
      lastOutcome: "not-started",
      lastSelectedPacketId: null,
      lastEnvelopeWorkerRole: null,
      lastProgramId: null,
      lastProgramRunId: null,
      lastApprovalId: null,
      lastProgramOutcome: "not-started",
      requestCount: 0,
      acceptedRequestCount: 0,
      executingRequestCount: 0,
      staleRequestCount: 0,
      overdueExecutionCount: 0,
      dueReviewCount: 0,
      checkpointCount: 0,
      escalationCount: 0,
      lastCheckpointPacketId: null,
      lastCheckpointSummary: null,
      lastCheckpointAt: null,
      lastEscalationPacketId: null,
      lastEscalationFollowThroughId: null,
      lastEscalationAt: null,
      continuationCount: 0,
      currentContinuationKind: null,
      currentContinuationPacketId: null,
      currentContinuationProgramRunId: null,
      currentContinuationCommand: null,
      activeLeaseCount: 0,
      activeLeasePacketIds: [],
      eventCount: 0,
      resultCount: 0,
      lastEventType: null,
      overview: "No autonomous control-plane run has been executed yet."
    },
    programs: {
      programCount: 0,
      activeCount: 0,
      blockedCount: 0,
      approvedRunCount: 0,
      reviewNeededRunCount: 0,
      reviewCheckpointRunCount: 0,
      consumedApprovalCount: 0,
      topProgramIds: [],
      topRunIds: [],
      topApprovalIds: [],
      currentProgramId: null,
      currentProgramRunId: null,
      currentApprovalId: null,
      currentReviewCheckpointRunId: null,
      currentReviewCheckpointPacketId: null,
      currentReviewCheckpointSummary: null,
      lastProgramOutcome: "not-started",
      overview: "No program-level research operating surfaces are active yet.",
      programsPath: ARTIFACT_PATHS.programsIndex,
      runsPath: ARTIFACT_PATHS.programRuns,
      approvalsPath: ARTIFACT_PATHS.programApprovals
    },
    campaigns: {
      campaignCount: 0,
      plannedCount: 0,
      activeCount: 0,
      reviewNeededCount: 0,
      completedCount: 0,
      blockedCount: 0,
      topCampaignIds: [],
      currentCampaignId: null,
      currentCampaignStatus: null,
      currentCampaignStepCount: 0,
      currentCampaignCompletedStepCount: 0,
      currentCampaignReviewNeededStepCount: 0,
      currentCampaignNextStepId: null,
      currentCampaignNextAction: null,
      overview: "No multi-cycle research campaigns have been recorded yet.",
      campaignsPath: ARTIFACT_PATHS.campaignsIndex
    },
    autonomyLoops: {
      contractVersion: "unified-autonomy-loop-v1",
      activeLifecycleState: "board-ready",
      loopCount: 4,
      blockedCount: 0,
      readyCount: 0,
      closedCount: 0,
      currentLoopId: "board-role-artifact-handoff",
      nextSafeAction: "Refresh the board and choose the next explicit operator action.",
      explicitOnly: true,
      noHiddenRuntime: true,
      families: [],
      loops: [],
      approvalPointers: [],
      runtimePointers: [ARTIFACT_PATHS.runtimeControllerState],
      followThroughPointers: [ARTIFACT_PATHS.metaOperatorFollowThrough],
      blockerIds: [],
      closureStates: [],
      lifecycleStates: [],
      safeExecutionPath: "project:dove.mission -> project:dove.auto",
      overview: "Unified autonomy loop skeleton is explicit, file-first, and foreground-only."
    },
    lifecycle: normalizeWorkspaceLifecycle(),
    dove: createDoveWorkspaceKernel(),
    activeRoles: [],
    unresolvedConcernIds: [],
    mostRecentSessions: [],
    latestVersions: {
      currentVersionId: null,
      activeTargets: []
    },
    updatedAt: null
  };
}
function normalizeWorkspaceRuntime(raw = {}, fallback = null) {
  const base = fallback ?? createWorkspaceIndex().runtime;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  return {
    ...base,
    ...raw,
    explicitInvocationOnly: normalizeBoolean(raw.explicitInvocationOnly, base.explicitInvocationOnly),
    noDaemon: normalizeBoolean(raw.noDaemon, base.noDaemon),
    selectionPolicy: normalizeString(raw.selectionPolicy, base.selectionPolicy),
    boundedStepPolicy: normalizeString(raw.boundedStepPolicy, base.boundedStepPolicy),
    controllerStatePath: normalizeString(raw.controllerStatePath, base.controllerStatePath),
    leasesPath: normalizeString(raw.leasesPath, base.leasesPath),
    eventsPath: normalizeString(raw.eventsPath, base.eventsPath),
    resultsPath: normalizeString(raw.resultsPath, base.resultsPath),
    lastRunId: normalizeString(raw.lastRunId, base.lastRunId),
    lastStatus: normalizeString(raw.lastStatus, base.lastStatus),
    lastOutcome: normalizeString(raw.lastOutcome, base.lastOutcome),
    lastSelectedPacketId: normalizeString(raw.lastSelectedPacketId, base.lastSelectedPacketId),
    lastEnvelopeWorkerRole: normalizeString(raw.lastEnvelopeWorkerRole, base.lastEnvelopeWorkerRole),
    lastProgramId: normalizeString(raw.lastProgramId, base.lastProgramId),
    lastProgramRunId: normalizeString(raw.lastProgramRunId, base.lastProgramRunId),
    lastApprovalId: normalizeString(raw.lastApprovalId, base.lastApprovalId),
    lastProgramOutcome: normalizeString(raw.lastProgramOutcome, base.lastProgramOutcome),
    requestCount: normalizeNumber(raw.requestCount, base.requestCount),
    acceptedRequestCount: normalizeNumber(raw.acceptedRequestCount, base.acceptedRequestCount),
    executingRequestCount: normalizeNumber(raw.executingRequestCount, base.executingRequestCount),
    staleRequestCount: normalizeNumber(raw.staleRequestCount, base.staleRequestCount),
    overdueExecutionCount: normalizeNumber(raw.overdueExecutionCount, base.overdueExecutionCount),
    dueReviewCount: normalizeNumber(raw.dueReviewCount, base.dueReviewCount),
    checkpointCount: normalizeNumber(raw.checkpointCount, base.checkpointCount),
    escalationCount: normalizeNumber(raw.escalationCount, base.escalationCount),
    continuationCount: normalizeNumber(raw.continuationCount, base.continuationCount),
    lastCheckpointPacketId: normalizeString(raw.lastCheckpointPacketId, base.lastCheckpointPacketId),
    lastCheckpointSummary: normalizeString(raw.lastCheckpointSummary, base.lastCheckpointSummary),
    lastCheckpointAt: raw.lastCheckpointAt ?? base.lastCheckpointAt,
    lastEscalationPacketId: normalizeString(raw.lastEscalationPacketId, base.lastEscalationPacketId),
    lastEscalationFollowThroughId: normalizeString(raw.lastEscalationFollowThroughId, base.lastEscalationFollowThroughId),
    lastEscalationAt: raw.lastEscalationAt ?? base.lastEscalationAt,
    currentContinuationKind: normalizeString(raw.currentContinuationKind, base.currentContinuationKind),
    currentContinuationPacketId: normalizeString(raw.currentContinuationPacketId, base.currentContinuationPacketId),
    currentContinuationProgramRunId: normalizeString(raw.currentContinuationProgramRunId, base.currentContinuationProgramRunId),
    currentContinuationCommand: normalizeString(raw.currentContinuationCommand, base.currentContinuationCommand),
    activeLeaseCount: normalizeNumber(raw.activeLeaseCount, base.activeLeaseCount),
    activeLeasePacketIds: normalizeStringArray(raw.activeLeasePacketIds),
    eventCount: normalizeNumber(raw.eventCount, base.eventCount),
    resultCount: normalizeNumber(raw.resultCount, base.resultCount),
    lastEventType: normalizeString(raw.lastEventType, base.lastEventType),
    overview: normalizeString(raw.overview, base.overview)
  };
}
function normalizeWorkspacePrograms(raw = {}, fallback = null) {
  const base = fallback ?? createWorkspaceIndex().programs;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  return {
    ...base,
    ...raw,
    programCount: normalizeNumber(raw.programCount, base.programCount),
    activeCount: normalizeNumber(raw.activeCount, base.activeCount),
    blockedCount: normalizeNumber(raw.blockedCount, base.blockedCount),
    approvedRunCount: normalizeNumber(raw.approvedRunCount, base.approvedRunCount),
    reviewNeededRunCount: normalizeNumber(raw.reviewNeededRunCount, base.reviewNeededRunCount),
    reviewCheckpointRunCount: normalizeNumber(raw.reviewCheckpointRunCount, base.reviewCheckpointRunCount),
    consumedApprovalCount: normalizeNumber(raw.consumedApprovalCount, base.consumedApprovalCount),
    topProgramIds: normalizeStringArray(raw.topProgramIds),
    topRunIds: normalizeStringArray(raw.topRunIds),
    topApprovalIds: normalizeStringArray(raw.topApprovalIds),
    currentProgramId: normalizeString(raw.currentProgramId, base.currentProgramId),
    currentProgramRunId: normalizeString(raw.currentProgramRunId, base.currentProgramRunId),
    currentApprovalId: normalizeString(raw.currentApprovalId, base.currentApprovalId),
    currentReviewCheckpointRunId: normalizeString(raw.currentReviewCheckpointRunId, base.currentReviewCheckpointRunId),
    currentReviewCheckpointPacketId: normalizeString(raw.currentReviewCheckpointPacketId, base.currentReviewCheckpointPacketId),
    currentReviewCheckpointSummary: normalizeString(raw.currentReviewCheckpointSummary, base.currentReviewCheckpointSummary),
    lastProgramOutcome: normalizeString(raw.lastProgramOutcome, base.lastProgramOutcome),
    overview: normalizeString(raw.overview, base.overview),
    programsPath: normalizeString(raw.programsPath, base.programsPath),
    runsPath: normalizeString(raw.runsPath, base.runsPath),
    approvalsPath: normalizeString(raw.approvalsPath, base.approvalsPath)
  };
}
function normalizeWorkspaceCampaigns(raw = {}, fallback = null) {
  const base = fallback ?? createWorkspaceIndex().campaigns;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  return {
    ...base,
    ...raw,
    campaignCount: normalizeNumber(raw.campaignCount, base.campaignCount),
    plannedCount: normalizeNumber(raw.plannedCount, base.plannedCount),
    activeCount: normalizeNumber(raw.activeCount, base.activeCount),
    reviewNeededCount: normalizeNumber(raw.reviewNeededCount, base.reviewNeededCount),
    completedCount: normalizeNumber(raw.completedCount, base.completedCount),
    blockedCount: normalizeNumber(raw.blockedCount, base.blockedCount),
    topCampaignIds: normalizeStringArray(raw.topCampaignIds),
    currentCampaignId: normalizeString(raw.currentCampaignId, base.currentCampaignId),
    currentCampaignStatus: normalizeString(raw.currentCampaignStatus, base.currentCampaignStatus),
    currentCampaignStepCount: normalizeNumber(raw.currentCampaignStepCount, base.currentCampaignStepCount),
    currentCampaignCompletedStepCount: normalizeNumber(raw.currentCampaignCompletedStepCount, base.currentCampaignCompletedStepCount),
    currentCampaignReviewNeededStepCount: normalizeNumber(raw.currentCampaignReviewNeededStepCount, base.currentCampaignReviewNeededStepCount),
    currentCampaignNextStepId: normalizeString(raw.currentCampaignNextStepId, base.currentCampaignNextStepId),
    currentCampaignNextAction: normalizeString(raw.currentCampaignNextAction, base.currentCampaignNextAction),
    overview: normalizeString(raw.overview, base.overview),
    campaignsPath: normalizeString(raw.campaignsPath, base.campaignsPath)
  };
}
function createWorkflowBoundaries() {
  const doveBootstrapOnlyPaths = [
    ".dove/README.md",
    ".dove/project.md",
    ".dove/contracts/research-contract.md",
    ".dove/orchestration/board.json",
    ".dove/orchestration/handoffs.md",
    ".dove/task-packets/index.json",
    ".dove/research/brief.md",
    ".dove/research/agenda.json",
    ".dove/plans/current-plan.md",
    ".dove/outline/current-outline.md",
    ".dove/findings.md",
    ".dove/experiments/EXPERIMENT_LOG.md",
    ".dove/experiments/plans.json",
    ".dove/experiments/results.json",
    ".dove/experiments/audits.json",
    ".dove/sources/index.json",
    ".dove/notes/index.json",
    ".dove/evidence/index.json",
    ".dove/documents/ledger.json",
    ".dove/claims/CLAIMS_FROM_RESULTS.md",
    ".dove/claims/bridge-log.json",
    ".dove/reviews/log.md",
    ".dove/reviews/REVIEW_STATE.json",
    ".dove/reviews/concerns.json",
    ".dove/reviews/debate-log.md",
    ".dove/reviews/adversarial-state.json",
    ".dove/revision-plans/current-plan.md",
    ".dove/wiki/index.md",
    ".dove/wiki/query_pack.md",
    ".dove/wiki/navigation.md",
    ".dove/wiki/entities.json",
    ".dove/wiki/relations.json",
    ".dove/checklists/current.md",
    ".dove/bibliography/references.bib",
    ".dove/bibliography/citation-log.md",
    ".dove/figures/README.md",
    ".dove/figures/index.json",
    ".dove/figures/briefs.json",
    ".dove/figures/segments.json",
    ".dove/figures/templates.json",
    ".dove/figures/editable-index.json",
    ".dove/figures/final-index.json",
    ".dove/figures/materials.json",
    ".dove/figures/generations.json",
    ".dove/figures/captions.json",
    ".dove/figures/qa.json",
    ".dove/rebuttal/issues.json",
    ".dove/rebuttal/strategy.md",
    ".dove/rebuttal/response-draft.md",
    ".dove/versions/index.json",
    ".dove/versions/comparisons.json",
    ".dove/versions/LATEST_COMPARISON.md",
    ".dove/meta/events.json",
    ".dove/meta/long-horizon-memory.json",
    ".dove/meta/operator-lessons.json",
    ".dove/meta/operator-playbooks.json",
    ".dove/meta/remediation-packs.json",
    ".dove/meta/recommendations.json",
    ".dove/meta/optimizer-state.json",
    ".dove/meta/LATEST_OPTIMIZER_REPORT.md",
    ".dove/runtime/controller-state.json",
    ".dove/runtime/leases.json",
    ".dove/runtime/events.json",
    ".dove/runtime/results.json",
    ".dove/programs/index.json",
    ".dove/programs/runs.json",
    ".dove/programs/approvals.json",
    ".dove/sessions/journal.json",
    ".dove/sessions/LATEST_SUMMARY.md",
    ".dove/workspace/index.json",
    ".dove/manifest.json",
    ".dove/workflow-pack/boundaries.json"
  ];
  return {
    version: 3,
    primaryRoleIds: PRIMARY_ROLE_IDS,
    subagentRoleIds: SUBAGENT_ROLE_IDS,
    roleHierarchy: ROLE_HIERARCHY,
    neutralCorePaths: CORE_INSTALL_PATHS,
    defaultHostAdapters: DEFAULT_HOST_ADAPTERS,
    availableHostAdapters: HOST_IDS,
    managedHostAdapterPaths: MANAGED_HOST_ADAPTER_PATHS,
    managedPaths: MANAGED_PACKAGE_PATHS,
    doveBootstrapOnlyPaths,
    userOwnedPaths: [
      ".dove/drafts",
      ".dove/sources",
      ".dove/notes",
      ".dove/evidence",
      ".dove/documents",
      ".dove/experiments",
      ".dove/reviews",
      ".dove/rebuttal",
      ".dove/versions/snapshots",
      ".dove/task-packets/packets",
      ".dove/context/roles",
      ".dove/context/phases",
      ".dove/context/packets",
      ".dove/context/artifacts",
      ".dove/context/actions",
      ".dove/sessions",
      ARTIFACT_PATHS.metaOperatorLessons,
      ARTIFACT_PATHS.workspaceArtifactMap
    ],
    managedArtifacts: {
      codePack: createManagedArtifactMeta("managed-replaceable", "src"),
      workflowBoundaries: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workflowBoundaries),
      workspaceIndex: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workspaceIndex),
      doveRootManifest: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.doveRootManifest),
      operatorLessons: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.metaOperatorLessons),
      documentsLedger: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.documentsLedger),
      programsIndex: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.programsIndex),
      programRuns: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.programRuns),
      programApprovals: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.programApprovals)
    },
    notes: [
      "Pack installs and syncs should bootstrap missing .dove artifacts but should not overwrite user-authored workspace state.",
      ".dove remains the durable source of truth and is treated as workspace data, not a managed code payload.",
      "Managed replaceable code and bootstrap-only workspace artifacts now advertise revision/template metadata for clearer reconciliation."
    ],
    updatedAt: null
  };
}

// src/core/workspace.mjs
import fs3 from "node:fs";
import path4 from "node:path";

// src/core/mutation-backend.mjs
import { AsyncLocalStorage } from "node:async_hooks";
import crypto2 from "node:crypto";
import fs2 from "node:fs";
import path2 from "node:path";

// src/core/contained-write.mjs
import fs from "node:fs";
import path from "node:path";

// src/core/mutation-backend.mjs
var mutationStorage = new AsyncLocalStorage();
function currentMutationContext(root) {
  const context = mutationStorage.getStore();
  if (!context || context.lifecycle !== "active") {
    return null;
  }
  if (root) {
    try {
      if (fs2.realpathSync.native(path2.resolve(root)) !== context.root) {
        return null;
      }
    } catch {
      return null;
    }
  }
  return context;
}
function isPatchPlanMode(root) {
  return currentMutationContext(root)?.patchPlanMode === true;
}

// src/core/workspace-bootstrap.mjs
import path3 from "node:path";
var WORKSPACE_BOOTSTRAP_DIRECTORIES = [
  ARTIFACT_PATHS.doveRoot,
  ARTIFACT_PATHS.publicDir,
  ".dove/contracts",
  ".dove/orchestration",
  ARTIFACT_PATHS.taskPacketsDir,
  ARTIFACT_PATHS.taskPacketsPacketsDir,
  ".dove/context",
  ARTIFACT_PATHS.roleContextsDir,
  ARTIFACT_PATHS.phaseContextsDir,
  ARTIFACT_PATHS.packetContextsDir,
  ARTIFACT_PATHS.artifactContextsDir,
  ARTIFACT_PATHS.actionContextsDir,
  ".dove/sessions",
  ARTIFACT_PATHS.workspaceDir,
  ARTIFACT_PATHS.programsDir,
  ARTIFACT_PATHS.workflowPackDir,
  ".dove/research",
  ".dove/plans",
  ".dove/outline",
  ".dove/sources",
  ".dove/notes",
  ".dove/evidence",
  ARTIFACT_PATHS.documentsDir,
  ".dove/claims",
  ".dove/drafts",
  ".dove/experiments",
  ".dove/reviews",
  ".dove/revision-plans",
  ".dove/wiki",
  ".dove/checklists",
  ".dove/bibliography",
  ".dove/figures",
  ".dove/rebuttal",
  ".dove/versions",
  ARTIFACT_PATHS.runtimeDir,
  ARTIFACT_PATHS.mutationsDir,
  ARTIFACT_PATHS.metaDir,
  ARTIFACT_PATHS.versionSnapshotsDir
];
function createStarterMarkdown(state) {
  const zh = state.settings?.responseLanguage !== "en";
  const tbd = zh ? "\u5F85\u5B9A" : "TBD";
  return {
    [ARTIFACT_PATHS.readme]: zh ? `# .dove \u5DE5\u4F5C\u533A

\u6B64\u76EE\u5F55\u662F Dove \u7684\u6301\u4E45\u4E8B\u5B9E\u6E90\u3002

- \u547D\u4EE4\u3001\u6280\u80FD\u548C MCP \u90FD\u5E94\u6C47\u805A\u5230\u8FD9\u4E9B\u6587\u4EF6\u3002
- \\.dove/orchestration/ \u4E2D\u7684\u7F16\u6392\u770B\u677F\u662F\u89C4\u8303\u5DE5\u4F5C\u8DDF\u8E2A\u5668\u3002
- \u6301\u4E45\u4EFB\u52A1\u5305\u3001\u89D2\u8272\u6E05\u5355\u548C\u4F1A\u8BDD\u6458\u8981\u5E94\u4FDD\u5B58\u5728 \\.dove/ \u5185\u3002
- \u7814\u7A76\u3001\u5B9E\u9A8C\u3001rebuttal \u548C\u7248\u672C\u6F14\u5316\u90FD\u5E94\u4FDD\u6301\u6587\u4EF6\u4F18\u5148\u3001\u53EF\u6062\u590D\u3002
- \u5B8C\u6574\u6027\u4EA7\u7269\u8BA9\u610F\u56FE\u3001\u7EED\u63A5\u3001\u5BA1\u67E5\u548C\u7ED3\u679C\u5230\u4E3B\u5F20\u7684\u8F6C\u79FB\u53EF\u5BA1\u8BA1\u3002
` : `# .dove workspace

This directory is the durable source of truth for Dove.

- Commands, skills, and MCP should converge on these files.
- The orchestration board in \\.dove/orchestration/ is the canonical work tracker.
- Durable task packets, role manifests, and session summaries should stay inside \\.dove/.
- Research, experiments, rebuttal, and version evolution should remain file-first and resumable.
- Phase-2 integrity artifacts make intent, continuation, review, and result-to-claim transitions auditable.
`,
    [ARTIFACT_PATHS.project]: zh ? `# \u9879\u76EE\u7B80\u62A5

- \u5DE5\u4F5C\u6807\u9898: ${state.dove.title}
- \u76EE\u6807 venue: ${state.dove.venue}
- \u76EE\u6807: ${state.dove.objective}
- \u622A\u6B62\u65F6\u95F4: ${state.dove.deadline || tbd}

## Thesis

${state.dove.thesis}

## Audience

${state.dove.audience}
` : `# Project brief

- Working title: ${state.dove.title}
- Venue: ${state.dove.venue}
- Objective: ${state.dove.objective}
- Deadline: ${state.dove.deadline || tbd}

## Thesis

${state.dove.thesis}

## Audience

${state.dove.audience}
`,
    [ARTIFACT_PATHS.researchContract]: zh ? `# \u7814\u7A76\u5951\u7EA6

## \u8303\u56F4

- \u6807\u9898: ${state.dove.title}
- Venue: ${state.dove.venue}
- \u76EE\u6807: ${state.dove.objective}

## \u8BC1\u636E\u7B56\u7565

- \u4E0D\u51ED\u8BB0\u5FC6\u5F15\u7528\u3002
- \u6BCF\u4E2A\u4E3B\u8981 claim \u90FD\u5E94\u6620\u5C04\u5230 source\u3001note\u3001experiment \u6216\u660E\u786E\u6807\u8BB0\u7684 gap\u3002
- Review findings \u548C rebuttal issues \u5FC5\u987B\u8F6C\u5316\u4E3A\u6301\u4E45\u884C\u52A8\u9879\u3002
- \u6700\u7EC8\u5B9A\u7A3F claim \u9700\u8981\u4E00\u6B21\u663E\u5F0F\u9A8C\u8BC1\u3002
` : `# Research contract

## Scope

- Title: ${state.dove.title}
- Venue: ${state.dove.venue}
- Objective: ${state.dove.objective}

## Evidence policy

- No citation from memory.
- Every major claim should map to a source, note, experiment, or clearly marked gap.
- Review findings and rebuttal issues must become durable action items.
- Finalization claims require an explicit verification pass.
`,
    [ARTIFACT_PATHS.researchBrief]: zh ? `# \u7814\u7A76\u7B80\u62A5

## \u76EE\u6807

${state.dove.objective}

## \u8BAE\u7A0B

- \u6F84\u6E05\u8BBA\u6587\u76EE\u6807\u4E0E\u8D21\u732E\u3002
- \u5728\u63D0\u51FA\u5F3A claim \u524D\u6269\u5C55\u8BC1\u636E\u57FA\u7840\u3002

## \u5BF9\u6BD4\u76EE\u6807

- \u8BC4\u4F30\u524D\u5728\u6B64\u6DFB\u52A0\u6D3B\u8DC3\u5BF9\u6BD4\u76EE\u6807\u3002
` : `# Research brief

## Objective

${state.dove.objective}

## Agenda

- Clarify the paper objective and contribution.
- Expand the evidence base before making strong claims.

## Comparison targets

- Add active comparison targets here before evaluation.
`,
    [ARTIFACT_PATHS.plan]: zh ? `# \u5F53\u524D Dove \u4EFB\u52A1\u8BA1\u5212

## \u4E00\u53E5\u8BDD thesis

${state.dove.thesis}

## \u8BA1\u5212\u7AE0\u8282

${Object.values(state.sections).map((section) => `- [ ] ${section.title}`).join("\n")}

## \u7ACB\u5373\u4E0B\u4E00\u6B65

\u8FD0\u884C \`project:dove.status\` \u5BF9\u9F50\u770B\u677F\u5E76\u9009\u62E9\u4E0B\u4E00\u4E2A Dove \u5DE5\u4F5C\u6D41\u3002
` : `# Current Dove mission plan

## One-sentence thesis

${state.dove.thesis}

## Planned sections

${Object.values(state.sections).map((section) => `- [ ] ${section.title}`).join("\n")}

## Immediate next step

Run \`project:dove.status\` to align the board and choose the next Dove surface.
`,
    [ARTIFACT_PATHS.outline]: zh ? `# \u5F53\u524D outline

${Object.values(state.sections).map((section) => `## ${section.title}

- \u76EE\u6807: \u5F85\u5B9A
- \u8BC1\u636E: \u5F85\u5B9A
`).join("\n")}` : `# Current outline

${Object.values(state.sections).map((section) => `## ${section.title}

- Goal: TBD
- Evidence: TBD
`).join("\n")}`,
    [ARTIFACT_PATHS.findings]: zh ? `# \u53D1\u73B0

\u5728\u8F6C\u5316\u4E3A claims \u524D\uFF0C\u5728\u6B64\u8BB0\u5F55\u5173\u952E\u5B9E\u8BC1\u6216\u5206\u6790\u7ED3\u8BBA\u3002
` : `# Findings

Capture key empirical or analytical takeaways here before turning them into claims.
`,
    [ARTIFACT_PATHS.claims]: zh ? `# \u7ED3\u679C claims

\u53EA\u5217\u51FA\u53EF\u8FFD\u6EAF\u5230 sources\u3001notes \u6216 experiments \u7684 claims\u3002
` : `# Claims from results

List only claims that can be traced to sources, notes, or experiments.
`,
    [ARTIFACT_PATHS.experimentLog]: zh ? `# \u5B9E\u9A8C\u65E5\u5FD7

\u5728\u6B64\u8BB0\u5F55\u8BA1\u5212\u8FD0\u884C\u3001\u8BBE\u7F6E\u3001\u7ED3\u679C\u548C\u5931\u8D25\u6848\u4F8B\u3002
` : `# Experiment log

Document planned runs, settings, outcomes, and failure cases here.
`,
    [ARTIFACT_PATHS.orchestrationHandoffs]: zh ? `# Handoffs

## 1970-01-01T00:00:00.000Z \u2014 planner -> researcher

- \u9636\u6BB5: init
- \u610F\u56FE: plan
- \u6458\u8981: \u5DE5\u4F5C\u533A\u5DF2\u521D\u59CB\u5316\u3002
- \u5F53\u524D\u7126\u70B9: \u6F84\u6E05\u8BBA\u6587\u76EE\u6807\u3002
- \u4E0B\u4E00\u6B65: \u6CE8\u518C\u6838\u5FC3 sources\u3002
- \u540E\u7EED\u52A8\u4F5C:
  - \u6CE8\u518C\u6838\u5FC3 sources\u3002
  - \u521B\u5EFA\u7B2C\u4E00\u4EFD\u7814\u7A76\u7B80\u62A5\u3002
- \u8BC1\u636E\u94FE\u63A5: \u65E0
- \u963B\u585E: \u65E0
` : `# Handoffs

## 1970-01-01T00:00:00.000Z \u2014 planner -> researcher

- Phase: init
- Intent: plan
- Summary: Workspace initialized.
- Current focus: Clarify the paper objective.
- Next action: Register core sources.
- Next actions:
  - Register core sources.
  - Create the first research brief.
- Evidence links: none
- Blockers: none
`,
    [ARTIFACT_PATHS.reviewLog]: zh ? `# \u5BA1\u67E5\u65E5\u5FD7

\u6B64\u6587\u4EF6\u53EA\u8FFD\u52A0\u5199\u5165\u3002

## 1970-01-01T00:00:00.000Z \u2014 bootstrap

- \u8303\u56F4: \u5DE5\u4F5C\u533A\u521D\u59CB\u5316
- \u7ED3\u8BBA: not-reviewed
- \u6458\u8981: \u5DF2\u521B\u5EFA starter \u5BA1\u67E5\u65E5\u5FD7\u3002
- \u884C\u52A8\u9879:
  - \u8D77\u8349\u524D\u5148\u5EFA\u7ACB source \u548C note \u57FA\u7840\u3002
` : `# Review log

This file is append-only.

## 1970-01-01T00:00:00.000Z \u2014 bootstrap

- Scope: workspace initialization
- Verdict: not-reviewed
- Summary: Starter review log created.
- Action items:
  - Build the source and note base before drafting.
`,
    [ARTIFACT_PATHS.reviewDebateLog]: zh ? `# Debate log

\u7528\u6B64\u6587\u4EF6\u4EE5\u6301\u4E45\u6587\u672C\u8BB0\u5F55\u5BF9\u6297\u5F0F\u5BA1\u67E5\u8F6E\u6B21\u3001rebuttal \u548C\u88C1\u5B9A\u3002
` : `# Debate log

Use this file to capture adversarial review rounds, rebuttals, and rulings in durable prose.
`,
    [ARTIFACT_PATHS.revisionPlan]: zh ? `# \u5F53\u524D revision plan

\u5C1A\u672A\u7531 review loop \u751F\u6210 revision plan\u3002
` : `# Current revision plan

No review loop has generated a revision plan yet.
`,
    [ARTIFACT_PATHS.wiki]: zh ? `# Paper wiki

## Thesis

${state.dove.thesis}

## \u8BC1\u636E\u6E05\u5355

- \u5F85\u5B9A

## Reviewer concerns

- \u5F85\u5B9A

## \u7248\u672C lineage

- \u8FD8\u6CA1\u6709 snapshots\u3002
` : `# Paper wiki

## Thesis

${state.dove.thesis}

## Evidence inventory

- TBD

## Reviewer concerns

- TBD

## Version lineage

- No snapshots yet.
`,
    [ARTIFACT_PATHS.queryPack]: zh ? `# Query pack

- \u4ECD\u7F3A\u5C11\u54EA\u4E9B\u8BC1\u636E\uFF1F
- \u54EA\u4E9B claims \u652F\u6491\u8F83\u5F31\uFF1F
- \u8D77\u8349\u66F4\u5F3A\u7ED3\u8BBA\u524D\u9700\u8981\u8FD0\u884C\u54EA\u4E9B\u5B9E\u9A8C\uFF1F
- \u54EA\u4E9B rebuttal issues \u4ECD\u672A\u89E3\u51B3\uFF1F
` : `# Query pack

- What evidence is still missing?
- Which claims are weakly supported?
- Which experiments need to be run before drafting stronger conclusions?
- Which rebuttal issues remain unresolved?
`,
    [ARTIFACT_PATHS.navigationReport]: zh ? `# Navigation

## \u4EFB\u52A1\u56FE

- \u5C1A\u672A\u751F\u6210 task packets\u3002

## Open questions

- \u5C1A\u672A\u8BB0\u5F55 open questions\u3002

## Decisions

- \u5C1A\u672A\u8BB0\u5F55 durable decisions\u3002

## Lineage

- \u5C1A\u672A\u8BB0\u5F55 durable lineage summary\u3002
` : `# Navigation

## Task graph

- No task packets generated yet.

## Open questions

- No open questions recorded yet.

## Decisions

- No durable decisions recorded yet.

## Lineage

- No durable lineage summary recorded yet.
`,
    [ARTIFACT_PATHS.checklist]: zh ? `# Dove \u4EFB\u52A1\u68C0\u67E5\u6E05\u5355

## \u4EFB\u52A1\u72B6\u6001

- [ ] \u4FDD\u6301 .dove/task-packets/index.json \u6700\u65B0
- [ ] \u5185\u90E8\u5DE5\u4F5C\u6D41\u4F7F\u7528\u770B\u677F\u65F6\uFF0C\u4FDD\u6301 .dove/orchestration/board.json \u4E0E\u6D3B\u8DC3\u4EFB\u52A1\u5BF9\u9F50

## \u4EFB\u52A1\u8BC1\u636E

- [ ] \u58F0\u660E\u76EE\u6807\u4EA7\u7269\u548C\u9A8C\u6536\u8BC1\u636E
- [ ] \u5C06 sources\u3001notes\u3001\u53D8\u66F4\u6587\u4EF6\u6216\u9A8C\u8BC1\u8F93\u51FA\u94FE\u63A5\u5230\u6D3B\u8DC3\u4EFB\u52A1
- [ ] \u4FDD\u6301\u5DE5\u4F5C\u533A\u7D22\u5F15\u548C\u4EFB\u52A1\u5305\u53EF\u6062\u590D

## \u6267\u884C

- [ ] \u901A\u8FC7 project:dove.mission\u3001project:dove.auto \u6216\u9876\u5C42\u9884\u8BBE\u547D\u4EE4\u8DEF\u7531\u5177\u4F53\u5DE5\u4F5C
- [ ] \u4F7F\u7528 project:dove.status \u68C0\u67E5\u963B\u585E\u3001\u5BA1\u67E5\u5C31\u7EEA\u5EA6\u548C\u5B8C\u6210\u8BC1\u636E

## \u5BA1\u67E5\u4E0E\u5173\u95ED

- [ ] \u5B8C\u6210\u9700\u5BA1\u67E5\u5DE5\u4F5C\u524D\u8FD0\u884C project:dove.review \u6216 project:dove.review-loop
- [ ] \u6807\u8BB0\u5B8C\u6210\u524D\u786E\u8BA4\u5B8C\u6210\u8BC1\u636E\u5DF2\u7ECF\u6301\u4E45\u5316
` : `# Dove mission checklist

## Task state

- [ ] Keep .dove/task-packets/index.json current
- [ ] Keep .dove/orchestration/board.json aligned with active tasks when internal workflows use it

## Mission evidence

- [ ] Declare target artifacts and acceptance evidence
- [ ] Keep sources, notes, changed files, or validation output linked to the active task
- [ ] Keep the workspace index and task packets resumable

## Execution

- [ ] Route concrete work through project:dove.mission, project:dove.auto, or the top-level preset commands
- [ ] Use project:dove.status to inspect blockers, review readiness, and completion evidence

## Review and closure

- [ ] Run project:dove.review or project:dove.review-loop before finalizing reviewed work
- [ ] Confirm completion evidence is durable before marking work complete
`,
    [ARTIFACT_PATHS.bibliography]: "",
    [ARTIFACT_PATHS.citationLog]: zh ? `# Citation log

\u5728\u6B64\u8DDF\u8E2A sources \u7684\u6CE8\u518C\u548C\u9A8C\u8BC1\u72B6\u6001\u3002
` : `# Citation log

Track registration and verification status for sources here.
`,
    [ARTIFACT_PATHS.figuresReadme]: zh ? `# Figures backlog

\u6B64\u76EE\u5F55\u7528\u4E8E figure/table \u89C4\u5212\u548C\u751F\u6210\u4EA7\u7269\u3002Dove \u4F1A\u8BB0\u5F55 figure briefs\u3001\u6240\u9700\u6750\u6599\u3001generation input bundles\u3001\u5BFC\u5165\u8F93\u51FA\u3001captions \u548C QA state\uFF0C\u8BA9 figures \u53EF\u6062\u590D\u4E14\u53EF\u94FE\u63A5\u8BC1\u636E\u3002
` : `# Figures backlog

Use this directory for figure/table planning and generation artifacts. Dove records figure briefs, required materials, generation input bundles, imported outputs, captions, and QA state so figures remain resumable and evidence-linked.
`,
    [ARTIFACT_PATHS.rebuttalStrategy]: zh ? `# Rebuttal strategy

\u5C1A\u672A\u751F\u6210 issue strategy\u3002
` : `# Rebuttal strategy

No issue strategy has been generated yet.
`,
    [ARTIFACT_PATHS.rebuttalResponseDraft]: zh ? `# Rebuttal response draft

\u89C4\u8303\u5316 reviewer issues \u540E\uFF0C\u5728\u6B64\u8D77\u8349\u7B80\u6D01\u4E14\u6709\u8BC1\u636E\u652F\u6491\u7684\u56DE\u5E94\u3002
` : `# Rebuttal response draft

Draft concise, evidence-backed responses here after normalizing reviewer issues.
`,
    [ARTIFACT_PATHS.versionComparisonReport]: zh ? `# Latest version comparison

\u5C1A\u672A\u751F\u6210 comparison\u3002
` : `# Latest version comparison

No comparison has been generated yet.
`,
    [ARTIFACT_PATHS.metaOptimizerReport]: zh ? `# Latest optimizer report

- Proposal only: true
- \u5C1A\u672A\u751F\u6210 meta-optimization recommendations\u3002
` : `# Latest optimizer report

- Proposal only: true
- No meta-optimization recommendations have been generated yet.
`,
    [ARTIFACT_PATHS.sessionSummary]: zh ? `# Latest session summary

- \u5C1A\u672A\u751F\u6210 durable session summary\u3002
` : `# Latest session summary

- No durable session summary has been generated yet.
`,
    [path3.join(ARTIFACT_PATHS.draftsDir, "README.md")]: zh ? `# Drafts

\u6BCF\u4E2A markdown \u6587\u4EF6\u4FDD\u5B58\u4E00\u4E2A section\u3002
` : `# Drafts

Store one section per markdown file.
`,
    [path3.join(ARTIFACT_PATHS.claims.replace("CLAIMS_FROM_RESULTS.md", "README.md"))]: zh ? `# Claims

\u6B64\u76EE\u5F55\u4FDD\u5B58\u6709\u8BC1\u636E\u652F\u6491\u7684 claim artifacts\u3002
` : `# Claims

This directory holds evidence-grounded claim artifacts.
`
  };
}
function createWorkspaceBootstrapJsonArtifacts(state) {
  return [
    [ARTIFACT_PATHS.orchestrationBoard, () => createDefaultBoard(state)],
    [ARTIFACT_PATHS.sources, createSourcesIndex],
    [ARTIFACT_PATHS.sourceVerifications, () => ({ version: 1, items: [], updatedAt: null })],
    [ARTIFACT_PATHS.notes, createNotesIndex],
    [ARTIFACT_PATHS.evidence, createEvidenceIndex],
    [ARTIFACT_PATHS.documentsLedger, createDocumentLedgerIndex],
    [ARTIFACT_PATHS.taskPacketsIndex, createTaskPacketsIndex],
    [ARTIFACT_PATHS.reviewState, createReviewState],
    [ARTIFACT_PATHS.reviewConcerns, createReviewConcernsIndex],
    [ARTIFACT_PATHS.adversarialReviewState, createAdversarialReviewState],
    [ARTIFACT_PATHS.figuresIndex, createFiguresIndex],
    [ARTIFACT_PATHS.figureBriefs, createFigureBriefsIndex],
    [ARTIFACT_PATHS.figureSegments, createFigureSegmentsIndex],
    [ARTIFACT_PATHS.figureTemplates, createFigureTemplatesIndex],
    [ARTIFACT_PATHS.figureEditableIndex, createFigureEditableIndex],
    [ARTIFACT_PATHS.figureFinalIndex, createFigureFinalIndex],
    [ARTIFACT_PATHS.figureMaterials, createFigureMaterialsIndex],
    [ARTIFACT_PATHS.figureGenerations, createFigureGenerationsIndex],
    [ARTIFACT_PATHS.figureCaptions, createFigureCaptionsIndex],
    [ARTIFACT_PATHS.figureQa, createFigureQaIndex],
    [ARTIFACT_PATHS.researchAgenda, createResearchAgenda],
    [ARTIFACT_PATHS.experimentPlans, createExperimentPlansIndex],
    [ARTIFACT_PATHS.experimentResults, createExperimentResultsIndex],
    [ARTIFACT_PATHS.experimentAudits, createExperimentAuditsIndex],
    [ARTIFACT_PATHS.claimBridgeLog, createClaimBridgeLog],
    [ARTIFACT_PATHS.metaEvents, createMetaEventsIndex],
    [ARTIFACT_PATHS.metaExecutionBridgeCandidates, createMetaExecutionBridgeCandidatesIndex],
    [ARTIFACT_PATHS.metaGovernanceCoverage, createMetaGovernanceCoverageIndex],
    [ARTIFACT_PATHS.metaGovernanceCoverageReport, createMetaGovernanceCoverageReport],
    [ARTIFACT_PATHS.metaLongHorizonMemory, createMetaLongHorizonMemory],
    [ARTIFACT_PATHS.metaOperatorLessons, createMetaOperatorLessonsIndex],
    [ARTIFACT_PATHS.metaOperatorFollowThrough, createMetaOperatorFollowThroughIndex],
    [ARTIFACT_PATHS.metaOperatorFollowThroughTransitions, createMetaOperatorFollowThroughTransitionsIndex],
    [ARTIFACT_PATHS.metaOperatorPlaybooks, createMetaOperatorPlaybooksIndex],
    [ARTIFACT_PATHS.metaRemediationPacks, createMetaRemediationPacksIndex],
    [ARTIFACT_PATHS.metaRecommendations, createMetaRecommendationsIndex],
    [ARTIFACT_PATHS.metaOptimizerState, createMetaOptimizerState],
    [ARTIFACT_PATHS.rebuttalIssues, createRebuttalIssuesIndex],
    [ARTIFACT_PATHS.versionsIndex, createVersionsIndex],
    [ARTIFACT_PATHS.versionComparisons, createVersionComparisonsIndex],
    [ARTIFACT_PATHS.wikiEntities, createWikiEntitiesIndex],
    [ARTIFACT_PATHS.wikiRelations, createWikiRelationsIndex],
    [ARTIFACT_PATHS.sessionJournal, createSessionJournal],
    [ARTIFACT_PATHS.runtimeControllerState, createRuntimeControllerState],
    [ARTIFACT_PATHS.runtimeContinuation, createRuntimeContinuationIndex],
    [ARTIFACT_PATHS.runtimeLeases, createRuntimeLeasesIndex],
    [ARTIFACT_PATHS.runtimeEvents, createRuntimeEventsIndex],
    [ARTIFACT_PATHS.runtimeResults, createRuntimeResultsIndex],
    [ARTIFACT_PATHS.mutationsIndex, createMutationProvenanceIndex],
    [ARTIFACT_PATHS.programsIndex, createProgramsIndex],
    [ARTIFACT_PATHS.programRuns, createProgramRunsIndex],
    [ARTIFACT_PATHS.programApprovals, createProgramApprovalsIndex],
    [ARTIFACT_PATHS.campaignsIndex, createCampaignsIndex],
    [ARTIFACT_PATHS.workspaceIndex, createWorkspaceIndex],
    [ARTIFACT_PATHS.doveRootManifest, createDoveAuthorityManifest],
    [ARTIFACT_PATHS.workflowBoundaries, createWorkflowBoundaries]
  ];
}
function createManagedWorkspaceJsonArtifacts() {
  return [
    [ARTIFACT_PATHS.workflowBoundaries, createWorkflowBoundaries, normalizeWorkflowBoundaries],
    [ARTIFACT_PATHS.documentsLedger, createDocumentLedgerIndex, normalizeDocumentLedgerIndex],
    [ARTIFACT_PATHS.metaExecutionBridgeCandidates, createMetaExecutionBridgeCandidatesIndex, normalizeMetaExecutionBridgeCandidatesIndex],
    [ARTIFACT_PATHS.metaGovernanceCoverage, createMetaGovernanceCoverageIndex, normalizeMetaGovernanceCoverageIndex],
    [ARTIFACT_PATHS.metaGovernanceCoverageReport, createMetaGovernanceCoverageReport, normalizeMetaGovernanceCoverageReport],
    [ARTIFACT_PATHS.metaLongHorizonMemory, createMetaLongHorizonMemory, normalizeMetaLongHorizonMemory],
    [ARTIFACT_PATHS.metaOperatorLessons, createMetaOperatorLessonsIndex, normalizeMetaOperatorLessonsIndex],
    [ARTIFACT_PATHS.metaOperatorFollowThrough, createMetaOperatorFollowThroughIndex, normalizeMetaOperatorFollowThroughIndex],
    [ARTIFACT_PATHS.metaOperatorFollowThroughTransitions, createMetaOperatorFollowThroughTransitionsIndex, normalizeMetaOperatorFollowThroughTransitionsIndex],
    [ARTIFACT_PATHS.metaOperatorPlaybooks, createMetaOperatorPlaybooksIndex, normalizeMetaOperatorPlaybooksIndex],
    [ARTIFACT_PATHS.metaRemediationPacks, createMetaRemediationPacksIndex, normalizeMetaRemediationPacksIndex],
    [ARTIFACT_PATHS.metaRecommendations, createMetaRecommendationsIndex, normalizeMetaRecommendationsIndex],
    [ARTIFACT_PATHS.metaOptimizerState, createMetaOptimizerState, normalizeMetaOptimizerState],
    [ARTIFACT_PATHS.runtimeControllerState, createRuntimeControllerState, normalizeRuntimeControllerState],
    [ARTIFACT_PATHS.runtimeContinuation, createRuntimeContinuationIndex, normalizeRuntimeContinuationIndex],
    [ARTIFACT_PATHS.runtimeLeases, createRuntimeLeasesIndex, normalizeRuntimeLeasesIndex],
    [ARTIFACT_PATHS.runtimeEvents, createRuntimeEventsIndex, normalizeRuntimeEventsIndex],
    [ARTIFACT_PATHS.runtimeResults, createRuntimeResultsIndex, normalizeRuntimeResultsIndex],
    [ARTIFACT_PATHS.mutationsIndex, createMutationProvenanceIndex, normalizeMutationProvenanceIndex],
    [ARTIFACT_PATHS.programsIndex, createProgramsIndex, normalizeProgramsIndex],
    [ARTIFACT_PATHS.programRuns, createProgramRunsIndex, normalizeProgramRunsIndex],
    [ARTIFACT_PATHS.programApprovals, createProgramApprovalsIndex, normalizeProgramApprovalsIndex],
    [ARTIFACT_PATHS.campaignsIndex, createCampaignsIndex, normalizeCampaignsIndex],
    [ARTIFACT_PATHS.workspaceIndex, createWorkspaceIndex, normalizeWorkspaceIndex],
    [ARTIFACT_PATHS.doveRootManifest, createDoveAuthorityManifest, normalizeDoveAuthorityManifest]
  ];
}

// src/core/workspace.mjs
var WORKFLOW_BOUNDARIES = createWorkflowBoundaries();
function isBootstrapManagedDovePath(relativePath) {
  return relativePath === ARTIFACT_PATHS.state || WORKFLOW_BOUNDARIES.doveBootstrapOnlyPaths.includes(relativePath);
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function resolvePath(root, relativePath) {
  return path4.join(root, relativePath);
}
function cloneFallback(fallback) {
  return typeof fallback === "function" ? fallback() : structuredClone(fallback);
}
function requireMutationContext(root, operation) {
  const context = currentMutationContext(root);
  if (!context) {
    throw new Error(`${operation} requires an active MutationContext.`);
  }
  return context;
}
function fileExists(root, relativePath) {
  const context = currentMutationContext(root);
  if (context) {
    return context.fileExists(relativePath);
  }
  return fs3.existsSync(resolvePath(root, relativePath));
}
function readJson(root, relativePath, fallback) {
  const context = currentMutationContext(root);
  if (context) {
    return context.readJson(relativePath, fallback);
  }
  const fullPath = resolvePath(root, relativePath);
  if (!fs3.existsSync(fullPath)) {
    return cloneFallback(fallback);
  }
  try {
    return JSON.parse(fs3.readFileSync(fullPath, "utf8"));
  } catch (error) {
    throw new Error(`Malformed JSON in ${relativePath}: ${error.message}`);
  }
}
function writeJson(root, relativePath, value) {
  return requireMutationContext(root, "writeJson").writeJson(relativePath, value);
}
function writeJsonIfChanged(root, relativePath, value) {
  return requireMutationContext(root, "writeJsonIfChanged").writeJsonIfChanged(relativePath, value);
}
function reconcileManagedJsonArtifact(root, relativePath, fallback, normalize) {
  const normalized = normalize(readJson(root, relativePath, fallback));
  writeJsonIfChanged(root, relativePath, normalized);
  return normalized;
}
function readText(root, relativePath, fallback = "") {
  const context = currentMutationContext(root);
  if (context) {
    return context.readText(relativePath, fallback);
  }
  const fullPath = resolvePath(root, relativePath);
  if (!fs3.existsSync(fullPath)) {
    return fallback;
  }
  return fs3.readFileSync(fullPath, "utf8");
}
function writeText(root, relativePath, content) {
  return requireMutationContext(root, "writeText").writeText(relativePath, content);
}
function ensureFile(root, relativePath, content) {
  return requireMutationContext(root, "ensureFile").ensureFile(relativePath, content);
}
function ensureWorkspace(root) {
  const context = requireMutationContext(root, "ensureWorkspace");
  const state = normalizeState(readJson(root, ARTIFACT_PATHS.state, createDefaultState));
  const created = [];
  for (const relativeDir of WORKSPACE_BOOTSTRAP_DIRECTORIES) {
    context.ensureDirectory(relativeDir);
  }
  if (!fileExists(root, ARTIFACT_PATHS.state)) {
    writeJson(root, ARTIFACT_PATHS.state, state);
    created.push(ARTIFACT_PATHS.state);
  }
  for (const [relativePath, content] of Object.entries(createStarterMarkdown(state))) {
    if (isBootstrapManagedDovePath(relativePath) && ensureFile(root, relativePath, content)) {
      created.push(relativePath);
    }
  }
  for (const [relativePath, factory] of createWorkspaceBootstrapJsonArtifacts(state)) {
    if (isBootstrapManagedDovePath(relativePath) && !fileExists(root, relativePath)) {
      writeJson(root, relativePath, factory());
      created.push(relativePath);
    }
  }
  for (const [relativePath, fallback, normalize] of createManagedWorkspaceJsonArtifacts()) {
    reconcileManagedJsonArtifact(root, relativePath, fallback, normalize);
  }
  return { root, created };
}
function listDraftFiles(root) {
  ensureWorkspace(root);
  const draftsDir = resolvePath(root, ARTIFACT_PATHS.draftsDir);
  return fs3.readdirSync(draftsDir, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md").map((entry) => entry.name);
}
function extractCitationKeysFromText(content) {
  const keys = [];
  const pattern = /\[cite:([^\]]+)\]/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const key = match[1]?.trim();
    if (key) {
      keys.push(key);
    }
  }
  return keys;
}
function assertGovernanceMutationRegistered(actionId, expectedMode) {
  const guarded = new Map(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => [entry.id, entry]));
  const exempt = new Map(GOVERNANCE_EXEMPT_MUTATIONS.map((entry) => [entry.id, entry]));
  if (expectedMode === "guarded") {
    if (!guarded.has(actionId)) {
      throw new Error(`Governance registry missing guarded mutation entry: ${actionId}`);
    }
    return;
  }
  if (expectedMode === "exempt") {
    const entry = exempt.get(actionId);
    if (!entry) {
      throw new Error(`Governance registry missing exempt mutation entry: ${actionId}`);
    }
    if (entry.sunsetAt && entry.sunsetAt <= nowIso()) {
      throw new Error(`Governance exempt entry expired: ${actionId}`);
    }
    return;
  }
  throw new Error(`Unknown governance mutation mode: ${expectedMode}`);
}

// src/core/i18n.mjs
import fs5 from "node:fs";
import path6 from "node:path";

// src/core/config.mjs
import fs4 from "node:fs";
import os from "node:os";
import path5 from "node:path";
var DEFAULT_TIMEOUT_MS = 12e4;
var DEFAULT_MAX_PROMPT_CHARS = 2e4;
var DEFAULT_MAX_SVG_BYTES = 1e6;
var DEFAULT_GLOBAL_STATUS_ORIGIN_PORT = 8787;
var DEFAULT_NETWORK_SEARCH_TIMEOUT_MS = 12e3;
var DEFAULT_NETWORK_SEARCH_MAX_RESULTS = 8;
var GPT_IMAGE2_PROVIDER_ID = "gpt-image2";
var GPT_IMAGE2_MODEL = "gpt-image-2";
var OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";
var SECRET_KEY_PATTERN = /(?:api[-_]?key|token|secret|password|authorization|bearer)/i;
var INLINE_BEARER_VALUE_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/i;
var ENV_REF_PATTERN = /^[A-Z_][A-Z0-9_]*$/;
var LOOPBACK_HOSTS = /* @__PURE__ */ new Set(["127.0.0.1", "localhost", "::1"]);
var HOSTNAME_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
var TUNNEL_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
var NETWORK_SEARCH_CREDENTIAL_KEY_PATTERN = /(?:api[-_]?key|token|secret|password|authorization|bearer|credential|headers?)/i;
var DEFAULT_NETWORK_SEARCH_PROVIDER_IDS = ["openalex", "crossref", "arxiv", "europe-pmc"];
var DEFAULT_DOVE_CONFIG = {
  version: 1,
  language: DEFAULT_DOVE_RESPONSE_LANGUAGE,
  figureGeneration: {
    defaultProviderId: null,
    providers: [],
    maxPromptChars: DEFAULT_MAX_PROMPT_CHARS,
    maxSvgBytes: DEFAULT_MAX_SVG_BYTES
  },
  networkSearch: {
    enabled: true,
    defaultProviderIds: DEFAULT_NETWORK_SEARCH_PROVIDER_IDS,
    disabledProviderIds: [],
    providerSettings: {},
    timeoutMs: DEFAULT_NETWORK_SEARCH_TIMEOUT_MS,
    maxResults: DEFAULT_NETWORK_SEARCH_MAX_RESULTS
  },
  globalStatus: {
    outputDir: null,
    projects: [],
    auth: {
      enabled: false,
      username: "dove",
      password: null,
      passwordEnv: null
    },
    cloudflare: {
      enabled: false,
      domain: null,
      tunnelName: null,
      cloudflaredPath: "cloudflared",
      originHost: "127.0.0.1",
      originPort: DEFAULT_GLOBAL_STATUS_ORIGIN_PORT,
      configPath: null,
      credentialsFile: null,
      tokenEnv: null,
      dnsResolverAddrs: []
    }
  }
};
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function clone(value) {
  return structuredClone(value);
}
function normalizePositiveInteger(value, fallback, min, max) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}
function normalizeBoolean2(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}
function normalizeString2(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
function normalizeStringArray2(value) {
  const rawItems = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return Array.from(new Set(rawItems.map((item) => normalizeString2(item)).filter(Boolean)));
}
function isGptImage2Identifier(value) {
  const normalized = normalizeString2(value)?.toLowerCase().replace(/[-_]/g, "") ?? null;
  return normalized === "gptimage2";
}
function inferFigureProviderType(providerType, providerId, endpoint, command, model) {
  const explicitType = normalizeString2(providerType);
  if (explicitType) {
    return explicitType;
  }
  if (isGptImage2Identifier(providerId) || isGptImage2Identifier(model)) {
    return "openai-image";
  }
  return endpoint ? "http-json" : command ? "external-command" : "external-command";
}
function expandHomePath(value) {
  const normalized = normalizeString2(value);
  if (!normalized) {
    return null;
  }
  if (normalized === "~") {
    return os.homedir();
  }
  if (normalized.startsWith("~/")) {
    return path5.join(os.homedir(), normalized.slice(2));
  }
  return normalized;
}
function resolveAbsolutePath(value) {
  const expanded = expandHomePath(value);
  return expanded ? path5.resolve(expanded) : null;
}
function resolveDoveGlobalStatusOutputDir(value = null, env = process.env) {
  const explicit = resolveAbsolutePath(value);
  if (explicit) {
    return explicit;
  }
  const xdgDataHome = resolveAbsolutePath(env.XDG_DATA_HOME);
  return path5.join(xdgDataHome ?? path5.join(os.homedir(), ".local", "share"), "dove", "public");
}
function normalizeEnvRef(value) {
  const normalized = normalizeString2(value);
  if (!normalized) {
    return null;
  }
  if (!ENV_REF_PATTERN.test(normalized)) {
    throw new Error(`Dove config env secret reference must be an environment variable name: ${normalized}`);
  }
  return normalized;
}
function isAllowedSecretReference(key) {
  return /Env$/.test(key) || /EnvVar$/.test(key);
}
function isAllowedInlineSecretPath(configPath) {
  return configPath === "globalStatus.auth.password" || configPath.endsWith(".globalStatus.auth.password");
}
function assertNoInlineSecrets(value, configPath = "config") {
  if (typeof value === "string") {
    if (INLINE_BEARER_VALUE_PATTERN.test(value)) {
      throw new Error(`Dove config must not contain inline bearer credentials at ${configPath}; use an env-var reference instead.`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoInlineSecrets(item, `${configPath}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    const nextPath = `${configPath}.${key}`;
    if (SECRET_KEY_PATTERN.test(key) && !isAllowedSecretReference(key) && !isAllowedInlineSecretPath(nextPath)) {
      throw new Error(`Dove config must not contain inline secret field ${nextPath}; use an env-var reference such as apiKeyEnv instead.`);
    }
    assertNoInlineSecrets(item, nextPath);
  }
}
function assertNoNetworkSearchCredentials(value, configPath = "networkSearch") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoNetworkSearchCredentials(item, `${configPath}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    const nextPath = `${configPath}.${key}`;
    if (NETWORK_SEARCH_CREDENTIAL_KEY_PATTERN.test(key)) {
      throw new Error(`Dove networkSearch supports only public no-key providers and must not contain credential field ${nextPath}.`);
    }
    assertNoNetworkSearchCredentials(item, nextPath);
  }
}
function readOptionalJsonFile(filePath) {
  if (!filePath || !fs4.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs4.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read Dove config ${filePath}: ${message}`);
  }
}
function mergeConfig(base, override) {
  if (!isPlainObject(override)) {
    return clone(base);
  }
  const next = clone(base);
  for (const [key, value] of Object.entries(override)) {
    if (Array.isArray(value)) {
      next[key] = clone(value);
      continue;
    }
    if (isPlainObject(value) && isPlainObject(next[key])) {
      next[key] = mergeConfig(next[key], value);
      continue;
    }
    next[key] = clone(value);
  }
  return next;
}
function configPaths(root, env) {
  if (normalizeString2(env.DOVE_CONFIG_PATH)) {
    return [path5.resolve(env.DOVE_CONFIG_PATH)];
  }
  const paths = [];
  if (normalizeString2(env.XDG_CONFIG_HOME)) {
    paths.push(path5.join(env.XDG_CONFIG_HOME, "dove", "config.json"));
  }
  paths.push(path5.join(os.homedir(), ".config", "dove", "config.json"));
  paths.push(path5.join(root, ".dove", "config.json"));
  paths.push(path5.join(root, ".dove", "config.local.json"));
  return Array.from(new Set(paths));
}
function envConfig(env) {
  const language = normalizeString2(env.DOVE_LANGUAGE ?? env.DOVE_RESPONSE_LANGUAGE);
  const providerId = normalizeString2(env.DOVE_FIGURE_PROVIDER_ID ?? env.DOVE_FIGURE_PROVIDER);
  const providerType = normalizeString2(env.DOVE_FIGURE_PROVIDER_TYPE);
  const endpoint = normalizeString2(env.DOVE_FIGURE_ENDPOINT);
  const command = normalizeString2(env.DOVE_FIGURE_COMMAND);
  const model = normalizeString2(env.DOVE_FIGURE_MODEL);
  const apiKeyEnv = normalizeString2(env.DOVE_FIGURE_API_KEY_ENV);
  const hasProviderOverride = Boolean(providerId || providerType || endpoint || command || model || apiKeyEnv);
  const figureGeneration = {};
  const next = {};
  if (language) {
    next.language = language;
  }
  if (providerId) {
    figureGeneration.defaultProviderId = providerId;
  }
  if (env.DOVE_FIGURE_MAX_PROMPT_CHARS) {
    figureGeneration.maxPromptChars = env.DOVE_FIGURE_MAX_PROMPT_CHARS;
  }
  if (env.DOVE_FIGURE_MAX_SVG_BYTES) {
    figureGeneration.maxSvgBytes = env.DOVE_FIGURE_MAX_SVG_BYTES;
  }
  if (hasProviderOverride) {
    const id = providerId ?? (isGptImage2Identifier(model) ? GPT_IMAGE2_PROVIDER_ID : "env-figure-provider");
    const type = inferFigureProviderType(providerType, id, endpoint, command, model);
    figureGeneration.defaultProviderId = id;
    figureGeneration.providers = [{
      id,
      type,
      endpoint,
      command,
      model: model ?? (type === "openai-image" ? GPT_IMAGE2_MODEL : null),
      apiKeyEnv: apiKeyEnv ?? (type === "openai-image" ? "OPENAI_API_KEY" : null),
      imageSize: env.DOVE_FIGURE_IMAGE_SIZE,
      imageQuality: env.DOVE_FIGURE_IMAGE_QUALITY,
      imageBackground: env.DOVE_FIGURE_IMAGE_BACKGROUND,
      timeoutMs: env.DOVE_FIGURE_TIMEOUT_MS,
      maxPromptChars: env.DOVE_FIGURE_MAX_PROMPT_CHARS,
      maxSvgBytes: env.DOVE_FIGURE_MAX_SVG_BYTES
    }];
  }
  if (Object.keys(figureGeneration).length > 0) {
    next.figureGeneration = figureGeneration;
  }
  return Object.keys(next).length > 0 ? next : null;
}
function normalizeProvider(rawProvider) {
  if (!isPlainObject(rawProvider)) {
    throw new Error("Dove figure provider config entries must be objects.");
  }
  assertNoInlineSecrets(rawProvider, "figureGeneration.providers[]");
  const id = normalizeString2(rawProvider.id);
  if (!id) {
    throw new Error("Dove figure provider config requires a non-empty id.");
  }
  const type = inferFigureProviderType(rawProvider.type, id, rawProvider.endpoint, rawProvider.command, rawProvider.model);
  if (!["http-json", "external-command", "openai-image"].includes(type)) {
    throw new Error(`Unsupported Dove figure provider type: ${type}`);
  }
  const provider = {
    id,
    type,
    timeoutMs: normalizePositiveInteger(rawProvider.timeoutMs, DEFAULT_TIMEOUT_MS, 1e3, 6e5),
    maxPromptChars: normalizePositiveInteger(rawProvider.maxPromptChars, DEFAULT_MAX_PROMPT_CHARS, 1e3, 2e5),
    maxSvgBytes: normalizePositiveInteger(rawProvider.maxSvgBytes, DEFAULT_MAX_SVG_BYTES, 1e3, 1e7)
  };
  const model = normalizeString2(rawProvider.model) ?? (type === "openai-image" ? GPT_IMAGE2_MODEL : null);
  if (model) {
    provider.model = model;
  }
  const endpoint = normalizeString2(rawProvider.endpoint) ?? (type === "openai-image" ? OPENAI_IMAGE_ENDPOINT : null);
  if (endpoint) {
    provider.endpoint = endpoint;
  }
  const command = normalizeString2(rawProvider.command);
  if (command) {
    provider.command = command;
  }
  const apiKeyEnv = normalizeEnvRef(rawProvider.apiKeyEnv ?? (type === "openai-image" ? "OPENAI_API_KEY" : null));
  if (apiKeyEnv) {
    provider.apiKeyEnv = apiKeyEnv;
  }
  const imageSize = normalizeString2(rawProvider.imageSize ?? rawProvider.size);
  if (imageSize) {
    provider.imageSize = imageSize;
  }
  const imageQuality = normalizeString2(rawProvider.imageQuality ?? rawProvider.quality);
  if (imageQuality) {
    provider.imageQuality = imageQuality;
  }
  const imageBackground = normalizeString2(rawProvider.imageBackground ?? rawProvider.background);
  if (imageBackground) {
    provider.imageBackground = imageBackground;
  }
  if ((type === "http-json" || type === "openai-image") && !provider.endpoint) {
    throw new Error(`Dove figure provider ${id} uses ${type} but has no endpoint.`);
  }
  if (type === "external-command" && !provider.command) {
    throw new Error(`Dove figure provider ${id} uses external-command but has no command.`);
  }
  return provider;
}
function normalizeNetworkProviderIds(value, fallback = []) {
  const ids = normalizeStringArray2(value).map((item) => item.toLowerCase());
  return ids.length > 0 ? ids : [...fallback];
}
function normalizeNetworkProviderSettings(rawSettings = {}) {
  const source = isPlainObject(rawSettings) ? rawSettings : {};
  assertNoNetworkSearchCredentials(source, "networkSearch.providerSettings");
  const settings = {};
  for (const [rawId, rawValue] of Object.entries(source)) {
    const id = normalizeString2(rawId)?.toLowerCase();
    if (!id) {
      continue;
    }
    const providerSource = isPlainObject(rawValue) ? rawValue : {};
    const providerSettings = {};
    if (providerSource.enabled !== void 0) {
      providerSettings.enabled = normalizeBoolean2(providerSource.enabled, true);
    }
    if (providerSource.timeoutMs !== void 0) {
      providerSettings.timeoutMs = normalizePositiveInteger(providerSource.timeoutMs, DEFAULT_NETWORK_SEARCH_TIMEOUT_MS, 1e3, 6e4);
    }
    settings[id] = providerSettings;
  }
  return settings;
}
function normalizeNetworkSearchConfig(rawConfig = {}) {
  const source = isPlainObject(rawConfig) ? rawConfig : {};
  assertNoNetworkSearchCredentials(source, "networkSearch");
  return {
    enabled: normalizeBoolean2(source.enabled, true),
    defaultProviderIds: normalizeNetworkProviderIds(source.defaultProviderIds ?? source.defaultProviders, DEFAULT_NETWORK_SEARCH_PROVIDER_IDS),
    disabledProviderIds: normalizeNetworkProviderIds(source.disabledProviderIds ?? source.disabledProviders, []),
    providerSettings: normalizeNetworkProviderSettings(source.providerSettings),
    timeoutMs: normalizePositiveInteger(source.timeoutMs, DEFAULT_NETWORK_SEARCH_TIMEOUT_MS, 1e3, 6e4),
    maxResults: normalizePositiveInteger(source.maxResults ?? source.limit, DEFAULT_NETWORK_SEARCH_MAX_RESULTS, 1, 50)
  };
}
function normalizeFigureGenerationConfig(rawConfig = {}) {
  const source = isPlainObject(rawConfig) ? rawConfig : {};
  assertNoInlineSecrets(source, "figureGeneration");
  const hasExplicitProviders = Array.isArray(source.providers);
  const providers = hasExplicitProviders ? source.providers.map(normalizeProvider) : [];
  const defaultProviderId = normalizeString2(source.defaultProviderId) ?? (hasExplicitProviders ? providers[0]?.id : null) ?? null;
  if (defaultProviderId && !providers.some((provider) => provider.id === defaultProviderId) && !isGptImage2Identifier(defaultProviderId)) {
    throw new Error(`Dove figureGeneration.defaultProviderId references unknown provider: ${defaultProviderId}`);
  }
  return {
    defaultProviderId,
    providers,
    maxPromptChars: normalizePositiveInteger(source.maxPromptChars, DEFAULT_MAX_PROMPT_CHARS, 1e3, 2e5),
    maxSvgBytes: normalizePositiveInteger(source.maxSvgBytes, DEFAULT_MAX_SVG_BYTES, 1e3, 1e7)
  };
}
function normalizeGlobalStatusProject(rawProject) {
  const source = typeof rawProject === "string" ? { root: rawProject } : rawProject;
  if (!isPlainObject(source)) {
    return null;
  }
  if (source.enabled === false) {
    return null;
  }
  const root = resolveAbsolutePath(source.root ?? source.path ?? source.workspace ?? source.workspaceRoot);
  if (!root) {
    return null;
  }
  return {
    root,
    id: normalizeString2(source.id),
    slug: normalizeString2(source.slug),
    title: normalizeString2(source.title ?? source.name),
    enabled: true
  };
}
function normalizeGlobalStatusProjects(rawProjects = []) {
  const projects = Array.isArray(rawProjects) ? rawProjects : [];
  const byRoot = /* @__PURE__ */ new Map();
  for (const rawProject of projects) {
    const project = normalizeGlobalStatusProject(rawProject);
    if (!project) {
      continue;
    }
    byRoot.set(project.root, project);
  }
  return Array.from(byRoot.values());
}
function normalizeHostname(value, label) {
  const normalized = normalizeString2(value);
  if (!normalized) {
    return null;
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized) || normalized.includes("/") || normalized.includes(":")) {
    throw new Error(`Dove global status Cloudflare ${label} must be a bare hostname: ${normalized}`);
  }
  const hostname = normalized.toLowerCase();
  if (hostname.length > 253 || hostname.startsWith(".") || hostname.endsWith(".")) {
    throw new Error(`Dove global status Cloudflare ${label} must be a valid hostname: ${normalized}`);
  }
  const labels = hostname.split(".");
  if (labels.length < 2 || !labels.every((item) => HOSTNAME_LABEL_PATTERN.test(item))) {
    throw new Error(`Dove global status Cloudflare ${label} must be a valid hostname: ${normalized}`);
  }
  return hostname;
}
function normalizeLoopbackHost(value) {
  const normalized = normalizeString2(value) ?? "127.0.0.1";
  if (!LOOPBACK_HOSTS.has(normalized)) {
    throw new Error(`Dove global status serving host must be loopback-only: ${normalized}`);
  }
  return normalized;
}
function normalizeTunnelName(value) {
  const normalized = normalizeString2(value);
  if (!normalized) {
    return null;
  }
  if (!TUNNEL_NAME_PATTERN.test(normalized)) {
    throw new Error(`Dove global status Cloudflare tunnelName must contain only letters, digits, dots, dashes, or underscores: ${normalized}`);
  }
  return normalized;
}
function normalizeDnsResolverAddrs(value) {
  const rawItems = Array.isArray(value) ? value : value === void 0 || value === null ? [] : [value];
  const items = rawItems.map(normalizeString2).filter(Boolean);
  for (const item of items) {
    if (!item.includes(":") || item.includes("://") || item.includes("/") || /\s/.test(item)) {
      throw new Error(`Dove global status Cloudflare dnsResolverAddrs entries must be address:port values: ${item}`);
    }
  }
  return Array.from(new Set(items));
}
function isPathInside(childPath, parentPath) {
  const relative = path5.relative(parentPath, childPath);
  return relative === "" || !relative.startsWith("..") && !path5.isAbsolute(relative);
}
function assertOutsidePublicDir(filePath, outputDir, label) {
  if (!filePath || !outputDir) {
    return;
  }
  if (isPathInside(filePath, outputDir)) {
    throw new Error(`Dove global status Cloudflare ${label} must not be inside the public output directory.`);
  }
}
function normalizeGlobalStatusCloudflareConfig(rawConfig = {}, rawGlobalStatus = {}, outputDir = null) {
  const source = isPlainObject(rawConfig) ? rawConfig : {};
  assertNoInlineSecrets(source, "globalStatus.cloudflare");
  const enabled = normalizeBoolean2(source.enabled ?? rawGlobalStatus.cloudflareEnabled, false);
  const domain = normalizeHostname(source.domain ?? source.hostname ?? rawGlobalStatus.cloudflareDomain ?? rawGlobalStatus.cloudflareHostname, "domain");
  const tunnelName = normalizeTunnelName(source.tunnelName ?? rawGlobalStatus.cloudflareTunnelName);
  const cloudflaredPath = normalizeString2(source.cloudflaredPath ?? source.command ?? rawGlobalStatus.cloudflaredPath) ?? "cloudflared";
  const originHost = normalizeLoopbackHost(source.originHost ?? source.host ?? rawGlobalStatus.cloudflareOriginHost);
  const originPort = normalizePositiveInteger(source.originPort ?? source.port ?? rawGlobalStatus.cloudflareOriginPort, DEFAULT_GLOBAL_STATUS_ORIGIN_PORT, 1, 65535);
  const configPath = resolveAbsolutePath(source.configPath ?? source.configFile ?? rawGlobalStatus.cloudflareConfigPath);
  const credentialsFile = resolveAbsolutePath(source.credentialsFile ?? rawGlobalStatus.cloudflareCredentialsFile);
  const tokenEnv = normalizeEnvRef(source.tokenEnv ?? rawGlobalStatus.cloudflareTokenEnv);
  const dnsResolverAddrs = normalizeDnsResolverAddrs(source.dnsResolverAddrs ?? rawGlobalStatus.cloudflareDnsResolverAddrs);
  assertOutsidePublicDir(configPath, outputDir, "configPath");
  assertOutsidePublicDir(credentialsFile, outputDir, "credentialsFile");
  return {
    enabled,
    domain,
    tunnelName,
    cloudflaredPath,
    originHost,
    originPort,
    configPath,
    credentialsFile,
    tokenEnv,
    dnsResolverAddrs
  };
}
function normalizeGlobalStatusAuthConfig(rawConfig = {}, rawGlobalStatus = {}) {
  const source = isPlainObject(rawConfig) ? rawConfig : {};
  assertNoInlineSecrets(source, "globalStatus.auth");
  return {
    enabled: normalizeBoolean2(source.enabled ?? rawGlobalStatus.authEnabled, false),
    username: normalizeString2(source.username ?? source.user ?? rawGlobalStatus.authUsername ?? rawGlobalStatus.authUser) ?? "dove",
    password: normalizeString2(source.password ?? rawGlobalStatus.authPassword),
    passwordEnv: normalizeEnvRef(source.passwordEnv ?? source.passwordEnvVar ?? rawGlobalStatus.authPasswordEnv ?? rawGlobalStatus.authPasswordEnvVar)
  };
}
function normalizeGlobalStatusConfig(rawConfig = {}) {
  const source = isPlainObject(rawConfig) ? rawConfig : {};
  assertNoInlineSecrets(source, "globalStatus");
  const outputDir = resolveAbsolutePath(source.outputDir ?? source.publicDir ?? source.directory);
  return {
    outputDir,
    projects: normalizeGlobalStatusProjects(source.projects),
    auth: normalizeGlobalStatusAuthConfig(source.auth, source),
    cloudflare: normalizeGlobalStatusCloudflareConfig(source.cloudflare, source, outputDir)
  };
}
function normalizeDoveConfig(rawConfig) {
  const source = isPlainObject(rawConfig) ? rawConfig : {};
  assertNoInlineSecrets(source, "doveConfig");
  const publicStatusSource = isPlainObject(source.publicStatus) ? source.publicStatus : {};
  const globalStatusSource = isPlainObject(source.globalStatus) ? source.globalStatus : {};
  const globalStatusOutputDir = globalStatusSource.outputDir ?? globalStatusSource.publicDir ?? globalStatusSource.directory ?? publicStatusSource.outputDir ?? publicStatusSource.publicDir ?? publicStatusSource.directory;
  const globalStatusProjects = Array.isArray(globalStatusSource.projects) && globalStatusSource.projects.length > 0 ? globalStatusSource.projects : publicStatusSource.projects;
  return {
    version: 1,
    language: normalizeDoveResponseLanguage(source.language ?? source.responseLanguage, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true }),
    figureGeneration: normalizeFigureGenerationConfig(source.figureGeneration),
    networkSearch: normalizeNetworkSearchConfig(source.networkSearch),
    globalStatus: normalizeGlobalStatusConfig({
      ...globalStatusSource,
      outputDir: globalStatusOutputDir,
      projects: globalStatusProjects
    })
  };
}
function loadDoveConfig(root, env = process.env) {
  let config = clone(DEFAULT_DOVE_CONFIG);
  for (const configPath of configPaths(root, env)) {
    const fileConfig = readOptionalJsonFile(configPath);
    if (fileConfig) {
      assertNoInlineSecrets(fileConfig, configPath);
      config = mergeConfig(config, fileConfig);
    }
  }
  const environmentConfig = envConfig(env);
  if (environmentConfig) {
    config = mergeConfig(config, environmentConfig);
  }
  return normalizeDoveConfig(config);
}
function loadFigureGenerationConfig(root, env = process.env) {
  return loadDoveConfig(root, env).figureGeneration;
}
function loadNetworkSearchConfig(root, env = process.env) {
  return loadDoveConfig(root, env).networkSearch;
}
function loadExplicitDoveLanguageConfig(root, env = process.env) {
  let language = null;
  for (const configPath of configPaths(root, env)) {
    const fileConfig = readOptionalJsonFile(configPath);
    if (isPlainObject(fileConfig) && (fileConfig.language !== void 0 || fileConfig.responseLanguage !== void 0)) {
      language = fileConfig.language ?? fileConfig.responseLanguage;
    }
  }
  const environmentLanguage = normalizeString2(env.DOVE_LANGUAGE ?? env.DOVE_RESPONSE_LANGUAGE);
  if (environmentLanguage) {
    language = environmentLanguage;
  }
  return language ? normalizeDoveResponseLanguage(language, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true }) : null;
}
function loadDoveLanguageConfig(root, env = process.env) {
  return loadDoveConfig(root, env).language;
}
function redactDoveConfig(config) {
  if (typeof config === "string") {
    return config.replace(INLINE_BEARER_VALUE_PATTERN, "Bearer <redacted>");
  }
  if (Array.isArray(config)) {
    return config.map((item) => redactDoveConfig(item));
  }
  if (!isPlainObject(config)) {
    return config;
  }
  const redacted = {};
  for (const [key, value] of Object.entries(config)) {
    if (SECRET_KEY_PATTERN.test(key) && !isAllowedSecretReference(key)) {
      redacted[key] = "<redacted>";
      continue;
    }
    redacted[key] = redactDoveConfig(value);
  }
  return redacted;
}

// src/core/i18n.mjs
function isPlainObject2(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function firstExplicitLanguage(...sources) {
  for (const source of sources) {
    if (!isPlainObject2(source)) {
      continue;
    }
    const value = source.responseLanguage ?? source.language;
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}
function readStateLanguage(root) {
  if (!root) {
    return null;
  }
  const statePath = path6.join(root, ARTIFACT_PATHS.state);
  if (!fs5.existsSync(statePath)) {
    return null;
  }
  try {
    const state = normalizeState(JSON.parse(fs5.readFileSync(statePath, "utf8")));
    return state.settings?.responseLanguage ?? null;
  } catch {
    return null;
  }
}
function resolveDoveResponseLanguage(root, args = {}, options = {}) {
  const argLanguage = firstExplicitLanguage(args, args.settings);
  if (argLanguage) {
    return normalizeDoveResponseLanguage(argLanguage, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true });
  }
  const env = options.env ?? process.env;
  const configLanguage = options.configLanguage ?? loadExplicitDoveLanguageConfig(root, env);
  if (configLanguage) {
    return configLanguage;
  }
  const stateLanguage = options.state?.settings?.responseLanguage ?? readStateLanguage(root);
  if (stateLanguage) {
    return normalizeDoveResponseLanguage(stateLanguage, DEFAULT_DOVE_RESPONSE_LANGUAGE);
  }
  return loadDoveLanguageConfig(root, env);
}
function isDoveChinese(language) {
  return normalizeDoveResponseLanguage(language) === "zh";
}
var TEXT = {
  taskFallbackTitle: {
    zh: "Dove \u4EFB\u52A1",
    en: "Dove task"
  },
  executePlannedWork: {
    zh: "\u6267\u884C\u5DF2\u89C4\u5212\u7684 Dove \u5DE5\u4F5C",
    en: "Execute planned Dove work"
  },
  checklistItem: {
    zh: ({ index }) => `\u68C0\u67E5\u9879 ${index}`,
    en: ({ index }) => `Checklist item ${index}`
  },
  checklistClarifyTitle: {
    zh: "\u6F84\u6E05\u8303\u56F4\u4E0E\u9A8C\u6536\u8BC1\u636E",
    en: "Clarify scope and acceptance evidence"
  },
  checklistClarifySummary: {
    zh: "\u786E\u8BA4\u4EFB\u52A1\u8303\u56F4\u3001\u963B\u585E\u9879\u3001\u76EE\u6807\u4EA7\u7269\u548C\u8BC1\u636E\u671F\u671B\u3002",
    en: "Confirm the task scope, blockers, artifact targets, and evidence expectations."
  },
  checklistWorkTitle: {
    zh: "\u6267\u884C\u6838\u5FC3\u4EFB\u52A1\u5DE5\u4F5C",
    en: "Perform the core mission work"
  },
  checklistWorkSummary: {
    zh: "\u901A\u8FC7\u5408\u9002\u7684\u9876\u5C42\u5DE5\u4F5C\u6D41\u5B8C\u6210\u5206\u7C7B\u540E\u7684 Dove \u4EFB\u52A1\u3002",
    en: "Carry out the classified Dove task through the appropriate top-level workflow."
  },
  checklistReviewTitle: {
    zh: "\u8FD0\u884C\u72EC\u7ACB\u5BA1\u67E5\u5E76\u8BB0\u5F55\u53D1\u73B0",
    en: "Run independent review and record findings"
  },
  checklistValidateTitle: {
    zh: "\u9A8C\u8BC1\u8BC1\u636E\u5E76\u8BB0\u5F55\u5B8C\u6210\u72B6\u6001",
    en: "Validate evidence and record completion state"
  },
  checklistValidateSummary: {
    zh: "\u5173\u95ED\u524D\u5BF9\u7167\u58F0\u660E\u7684\u8BC1\u636E\u671F\u671B\u68C0\u67E5\u4EA7\u7269\u3002",
    en: "Check the produced artifacts against the declared evidence expectations before closure."
  },
  initNextActionDisplay: {
    zh: "\u8FD0\u884C project:dove.mission\uFF0C\u5728 init \u76EE\u6807\u4E0B\u521B\u5EFA\u4E0B\u4E00\u4E2A\u4EFB\u52A1\u3002",
    en: "Run project:dove.mission to create the next task under the init goal."
  },
  createTaskConfirmMessage: {
    zh: "\u8BF7\u5148\u6279\u51C6\u8FD9\u4EFD\u9700\u6C42\u5230\u4EFB\u52A1\u7684\u4EFB\u52A1\u5951\u7EA6\uFF1B\u6279\u51C6\u540E Dove \u53EA\u4F1A\u7269\u5316\u5408\u540C\u5E76\u4EA4\u63A5\u63A8\u8350\u7684\u540E\u7EED\u6D41\u7A0B\u3002",
    en: "Approve this demand-to-task mission contract before Dove materializes it and hands off to the recommended next workflow."
  },
  createTaskMaterializedMessage: {
    zh: "\u5DF2\u6279\u51C6\u7684\u9700\u6C42\u5230\u4EFB\u52A1\u5951\u7EA6\u5DF2\u7ECF\u7269\u5316\u3002\u8BF7\u6CBF\u63A8\u8350\u8DEF\u7EBF\u7EE7\u7EED\u63A8\u8FDB\u771F\u5B9E\u5DE5\u4F5C\uFF1Bmission \u672C\u8EAB\u4E0D\u8BB0\u5F55\u6267\u884C\u7ED3\u679C\u3002",
    en: "The approved demand-to-task mission contract is materialized. Continue through the recommended route; mission itself does not record execution results."
  },
  createTaskMaterializationPlannedMessage: {
    zh: "\u5DF2\u751F\u6210\u6279\u51C6\u5408\u540C\u7684\u5F85\u5E94\u7528\u5199\u5165\u8BA1\u5212\uFF0C\u4F46\u5408\u540C\u5C1A\u672A\u7269\u5316\u3002\u8BF7\u7531 host \u5E94\u7528 mutation plan \u540E\u518D\u4EA4\u63A5\u540E\u7EED\u6D41\u7A0B\u3002",
    en: "A host-applied write plan was prepared for the approved contract, but the contract is not materialized yet. Apply the mutation plan before handing off."
  },
  workContractPurpose: {
    zh: ({ title, stage, domain }) => `\u628A\u201C${title}\u201D\u8F6C\u6210\u53EF\u6267\u884C\u3001\u53EF\u9A8C\u8BC1\u3001\u53EF\u7EED\u63A5\u7684 ${stage}/${domain} \u5DE5\u4F5C\u5408\u540C\u3002`,
    en: ({ title, stage, domain }) => `Turn \u201C${title}\u201D into an executable, verifiable, resumable ${stage}/${domain} work contract.`
  },
  workContractDeliverablesPlan: {
    zh: ({ title }) => [`${title} \u7684\u53EF\u6267\u884C\u8BA1\u5212\u548C\u62C6\u5206\u540E\u7684\u540E\u7EED\u4EFB\u52A1\u3002`, "\u660E\u786E\u8BC1\u636E\u7F3A\u53E3\u3001\u963B\u585E\u6761\u4EF6\u548C\u4E0B\u4E00\u6B65\u8DEF\u7EBF\u3002"],
    en: ({ title }) => [`An executable plan for ${title} with follow-up tasks.`, "Explicit evidence gaps, blockers, and next routes."]
  },
  workContractDeliverablesPaper: {
    zh: ({ title }) => [`${title} \u5BF9\u5E94\u7684\u8349\u7A3F\u3001\u6539\u5199\u6216\u8BBA\u6587\u4EA7\u7269\u3002`, "\u652F\u6491\u8BE5\u4EA7\u7269\u7684 source\u3001note\u3001claim\u3001figure \u6216 review \u8BC1\u636E\u5F15\u7528\u3002"],
    en: ({ title }) => [`A draft, revision, or paper artifact for ${title}.`, "Source, note, claim, figure, or review evidence references supporting the artifact."]
  },
  workContractDeliverablesExperiment: {
    zh: ({ title }) => [`${title} \u7684\u5B9E\u9A8C\u8BA1\u5212\u3001\u7ED3\u679C\u6216\u5BA1\u8BA1\u8BB0\u5F55\u3002`, "\u628A\u5B9E\u9A8C\u7ED3\u679C\u6865\u63A5\u5230 claim \u6216\u660E\u786E\u4E0D\u80FD\u6865\u63A5\u7684\u539F\u56E0\u3002"],
    en: ({ title }) => [`An experiment plan, result, or audit record for ${title}.`, "A bridge from result to claim, or an explicit reason it cannot be bridged."]
  },
  workContractDeliverablesAudit: {
    zh: ({ title }) => [`${title} \u7684\u72EC\u7ACB\u68C0\u67E5\u7ED3\u8BBA\u3002`, "\u53EF\u6267\u884C\u7684\u4FEE\u8BA2\u9879\u3001\u8BC1\u636E\u7F3A\u53E3\u6216\u963B\u585E\u8FB9\u754C\u3002"],
    en: ({ title }) => [`Independent review findings for ${title}.`, "Actionable revisions, evidence gaps, or blocker boundaries."]
  },
  workContractDeliverablesEngineering: {
    zh: ({ title }) => [`${title} \u5BF9\u5E94\u7684\u4EE3\u7801\u3001\u914D\u7F6E\u3001\u6587\u6863\u6216\u6D4B\u8BD5\u6539\u52A8\u3002`, "\u80FD\u590D\u73B0\u5B9E\u8D28\u8FDB\u5C55\u7684\u9A8C\u8BC1\u8BC1\u636E\u3002"],
    en: ({ title }) => [`Code, configuration, documentation, or test changes for ${title}.`, "Validation evidence that proves real progress."]
  },
  workContractEvidenceDefault: {
    zh: "\u5217\u51FA\u5B9E\u9645\u4FEE\u6539\u3001\u4EA7\u7269\u8DEF\u5F84\u3001\u6D4B\u8BD5/\u9A8C\u8BC1\u8F93\u51FA\uFF0C\u6216\u8BB0\u5F55\u65E0\u6CD5\u7EE7\u7EED\u7684\u660E\u786E\u8FB9\u754C\u3002",
    en: "List actual changes, artifact paths, test/validation output, or an explicit boundary that blocks continuation."
  },
  workContractDoneDefault: {
    zh: "\u4EA4\u4ED8\u7269\u5DF2\u7ECF\u4EA7\u51FA\uFF0C\u8BC1\u636E\u53EF\u4EE5\u88AB status/review \u8FFD\u8E2A\uFF0C\u4E14\u4E0B\u4E00\u6B65\u4E0D\u662F\u91CD\u65B0\u89E3\u91CA\u9700\u6C42\u3002",
    en: "Deliverables exist, evidence is traceable by status/review, and the next step is not re-explaining the demand."
  },
  workContractOutOfScopeDefault: {
    zh: ["\u4E0D\u865A\u6784\u5B9E\u9A8C\u3001\u8BBA\u6587\u3001review \u6216\u5DE5\u7A0B\u7ED3\u679C\u3002", "\u4E0D\u5728\u6CA1\u6709\u771F\u5B9E\u8BC1\u636E\u65F6\u628A\u4EFB\u52A1\u6807\u8BB0 completed\u3002", "\u4E0D\u542F\u52A8\u9690\u85CF\u540E\u53F0\u6267\u884C\u3001daemon \u6216 scheduler\u3002"],
    en: ["Do not fabricate experiment, paper, review, or engineering results.", "Do not mark the task completed without real evidence.", "Do not start hidden background execution, daemons, or schedulers."]
  },
  workContractImpactPlan: {
    zh: "\u628A\u6A21\u7CCA\u65B9\u5411\u5207\u6210\u53EF\u6267\u884C\u4EFB\u52A1\uFF0C\u540E\u7EED status \u80FD\u76F4\u63A5\u663E\u793A\u8BE5\u505A\u54EA\u4E00\u6B65\u3002",
    en: "Turns a vague direction into executable tasks so status can show the next concrete step."
  },
  workContractImpactPaper: {
    zh: "\u628A\u8BBA\u6587\u63A8\u8FDB\u7ED1\u5B9A\u5230\u53EF\u68C0\u67E5\u7684\u8349\u7A3F/\u8BC1\u636E\u4EA7\u7269\uFF0C\u51CF\u5C11\u53EA\u521B\u5EFA\u4EFB\u52A1\u4F46\u4E0D\u77E5\u9053\u600E\u4E48\u5199\u7684\u60C5\u51B5\u3002",
    en: "Binds paper progress to inspectable draft/evidence artifacts instead of creating a task with no writing path."
  },
  workContractImpactExperiment: {
    zh: "\u628A\u5B9E\u9A8C\u63A8\u8FDB\u7ED1\u5B9A\u5230\u8BA1\u5212\u3001\u7ED3\u679C\u3001\u5BA1\u8BA1\u548C claim \u6865\u63A5\uFF0C\u907F\u514D\u53EA\u8BB0\u5F55\u60F3\u6CD5\u3002",
    en: "Binds experiment progress to planning, results, audit, and claim bridging instead of only recording an idea."
  },
  workContractImpactAudit: {
    zh: "\u628A\u68C0\u67E5\u7ED3\u679C\u8F6C\u6210\u53EF\u4FEE\u8BA2\u3001\u53EF\u9A8C\u8BC1\u7684\u4E0B\u4E00\u6B65\uFF0C\u800C\u4E0D\u662F\u505C\u5728\u6CDB\u6CDB review\u3002",
    en: "Turns review into actionable, verifiable revision steps instead of generic feedback."
  },
  workContractImpactEngineering: {
    zh: "\u628A\u5DE5\u7A0B\u9700\u6C42\u7ED1\u5B9A\u5230\u6539\u52A8\u548C\u9A8C\u8BC1\u8BC1\u636E\uFF0Cstatus \u53EF\u4EE5\u7EE7\u7EED\u63A8\u8FDB\u800C\u4E0D\u662F\u53EA\u5C55\u793A\u4EFB\u52A1\u540D\u3002",
    en: "Binds engineering work to changes and validation evidence so status can continue the work instead of only showing a task name."
  },
  workContractRoutePrimaryLabel: {
    zh: "\u9996\u9009\u63A8\u8FDB\u8DEF\u7EBF",
    en: "Primary route"
  },
  workContractRoutePrimaryWhen: {
    zh: "\u9700\u8981\u6309\u5408\u540C\u4EA7\u51FA\u7B2C\u4E00\u6279\u771F\u5B9E\u4EA4\u4ED8\u7269\u548C\u8BC1\u636E\u65F6\u4F7F\u7528\u3002",
    en: "Use when producing the first real deliverables and evidence for the contract."
  },
  workContractRouteAutoLabel: {
    zh: "\u591A\u8F6E\u81EA\u52A8\u63A8\u8FDB",
    en: "Multi-round auto route"
  },
  workContractRouteAutoWhen: {
    zh: "\u5DF2\u6709\u4EFB\u52A1\u5408\u540C\uFF0C\u60F3\u8BA9 Dove \u5728\u524D\u53F0\u591A\u8F6E\u63A8\u8FDB\u76F4\u5230\u5B8C\u6210\u6216\u8FB9\u754C\u65F6\u4F7F\u7528\u3002",
    en: "Use when a task contract exists and Dove should run foreground iterations until completion or a boundary."
  },
  workContractRouteReviewLabel: {
    zh: "\u5BA1\u67E5/\u9A8C\u6536\u8DEF\u7EBF",
    en: "Review route"
  },
  workContractRouteReviewWhen: {
    zh: "\u9700\u8981\u72EC\u7ACB\u68C0\u67E5\u8BC1\u636E\u3001\u8349\u7A3F\u3001\u7ED3\u679C\u6216\u5B8C\u6210\u72B6\u6001\u65F6\u4F7F\u7528\u3002",
    en: "Use when evidence, drafts, results, or completion state need independent review."
  },
  missionPassSelectMessage: {
    zh: "\u8BB0\u5F55\u4EFB\u52A1\u6267\u884C\u7ED3\u679C\u524D\uFF0C\u8BF7\u5148\u901A\u8FC7 index \u6216 packetId \u9009\u62E9\u4E00\u4E2A\u6301\u4E45\u4EFB\u52A1\u3002",
    en: "Select a durable task by index or packetId before recording the mission pass."
  },
  missionPassCompletedSummary: {
    zh: "\u4EFB\u52A1\u6267\u884C\u5DF2\u5B8C\u6210\u3002",
    en: "Mission pass completed."
  },
  missionPassBlockedSummary: {
    zh: "\u4EFB\u52A1\u6267\u884C\u9047\u5230\u963B\u585E\u3002",
    en: "Mission pass reached a blocker."
  },
  missionPassProgressSummary: {
    zh: "\u4EFB\u52A1\u6267\u884C\u5DF2\u8BB0\u5F55\u8FDB\u5C55\u3002",
    en: "Mission pass recorded progress."
  },
  killSelectMessage: {
    zh: "\u6740\u6B7B\u4EFB\u52A1\u524D\uFF0C\u8BF7\u5148\u901A\u8FC7 index \u6216 packetId \u9009\u62E9\u4E00\u4E2A\u975E init \u4EFB\u52A1\u3002",
    en: "Select a non-init task by index or packetId before killing it."
  },
  killReason: {
    zh: "\u64CD\u4F5C\u8005\u6740\u6B7B\u4E86\u8BE5\u4EFB\u52A1\u3002",
    en: "Operator killed this task."
  },
  lifecycleKillReason: {
    zh: "\u64CD\u4F5C\u8005\u5C06\u8BE5\u4EFB\u52A1\u6807\u8BB0\u4E3A killed\u3002",
    en: "Operator marked this task killed."
  },
  statusAdjustConfirmMessage: {
    zh: "\u5728\u6301\u4E45\u4EFB\u52A1\u751F\u547D\u5468\u671F\u72B6\u6001\u53D8\u66F4\u524D\uFF0C\u8BF7\u786E\u8BA4\u9009\u4E2D\u7684 Dove \u4EFB\u52A1\u72B6\u6001\u8C03\u6574\u3002",
    en: "Confirm the selected Dove task status adjustments before durable task lifecycle state changes."
  },
  statusAdjustMissingReason: {
    zh: "\u6BCF\u4E2A\u8C03\u6574\u90FD\u9700\u8981 packetId \u548C\u4E00\u4E2A\u6709\u6548\u7684 Dove \u4EFB\u52A1\u72B6\u6001\u3002",
    en: "Each adjustment requires packetId and one valid Dove task status."
  },
  statusAdjustNoPacketReason: {
    zh: "\u6CA1\u6709\u6301\u4E45\u4EFB\u52A1\u5305\u5339\u914D\u8BE5 packetId\u3002",
    en: "No durable task packet matches this packetId."
  },
  statusAdjustInitReason: {
    zh: "level-0 init \u4EFB\u52A1\u4E0D\u80FD\u901A\u8FC7\u72B6\u6001 UX \u8C03\u6574\u3002",
    en: "The level-0 init task is not adjusted through status UX."
  },
  statusAdjustSameReason: {
    zh: "\u4EFB\u52A1\u5DF2\u7ECF\u5904\u4E8E\u8BF7\u6C42\u7684\u72B6\u6001\u3002",
    en: "Task already has the requested status."
  },
  blockerTitle: {
    zh: ({ title }) => `\u8C03\u67E5 ${title} \u7684\u963B\u585E\u539F\u56E0`,
    en: ({ title }) => `Investigate blocker for ${title}`
  },
  blockerSummary: {
    zh: ({ title }) => `\u627E\u51FA\u5E76\u89E3\u91CA\u963B\u6B62 ${title} \u7EE7\u7EED\u63A8\u8FDB\u7684\u539F\u56E0\u3002`,
    en: ({ title }) => `Find and explain the blocker preventing ${title} from advancing.`
  },
  blockerEvidenceWhy: {
    zh: ({ id }) => `\u89E3\u91CA ${id} \u4E3A\u4EC0\u4E48\u88AB\u963B\u585E`,
    en: ({ id }) => `Explain why ${id} is blocked`
  },
  blockerEvidenceAction: {
    zh: "\u5EFA\u8BAE\u4E0B\u4E00\u72B6\u6001\u6216\u5177\u4F53\u89E3\u9664\u963B\u585E\u52A8\u4F5C",
    en: "Recommend the next state or concrete unblock action"
  },
  operatorConfirmMessage: {
    zh: "\u8BF7\u5148\u786E\u8BA4\uFF0C\u7136\u540E Dove operator \u53EA\u4F1A\u8FD0\u884C\u5B89\u5168\u5185\u90E8\u6B65\u9AA4\u3001\u8BB0\u5F55\u4F60\u663E\u5F0F\u63D0\u4F9B\u7684 host \u7ED3\u679C\uFF0C\u6216\u4E3A\u963B\u585E\u4EFB\u52A1\u521B\u5EFA\u8C03\u67E5\u8BA1\u5212\uFF1B\u7F3A\u5C11 host \u7ED3\u679C\u7684\u4EFB\u52A1\u4F1A\u4FDD\u6301\u4E0D\u53D8\u5E76\u8FD4\u56DE\u6240\u9700\u8BC1\u636E\u3002",
    en: "Confirm before Dove operator runs only safe internal steps, records explicitly supplied host results, or creates blocker-investigation plan missions; missions missing host results remain unchanged and return required evidence."
  },
  operatorAwaitingStopReason: {
    zh: "\u672A\u63D0\u4F9B\u4E3B\u673A\u4FA7\u4EFB\u52A1\u7ED3\u679C\uFF0C\u56E0\u6B64 Dove \u4E0D\u58F0\u79F0\u5DF2\u7ECF\u6267\u884C\u3002",
    en: "No host-supplied task result was provided, so Dove did not claim execution."
  },
  operatorResultSummary: {
    zh: "\u5DF2\u8BB0\u5F55 operator \u6267\u884C\u7ED3\u679C\u3002",
    en: "Operator pass result recorded."
  },
  versionReason: {
    zh: "\u65B9\u5411\u5DF2\u53D8\u66F4\u3002",
    en: "Direction changed."
  },
  versionTitle: {
    zh: "Dove \u65B9\u5411\u91CD\u7F6E",
    en: "Dove direction reset"
  },
  versionNextActionDisplay: {
    zh: "\u8FD0\u884C project:dove.mission \u5904\u7406\u4E0B\u4E00\u4E2A\u65B9\u5411\u3002",
    en: "Run project:dove.mission for the next direction."
  },
  autoSelectionConfirmMessage: {
    zh: "\u8BF7\u5148\u6279\u51C6\u9009\u4E2D\u7684\u6301\u4E45\u4EFB\u52A1\uFF0C\u7136\u540E /dove:auto \u624D\u4F1A\u8FD0\u884C\u6709\u8FB9\u754C\u7684\u524D\u53F0\u8FED\u4EE3\u3002",
    en: "Approve the selected durable task before /dove:auto runs bounded foreground iterations."
  },
  autoDemandConfirmMessage: {
    zh: "\u8BF7\u5148\u6279\u51C6\u8FD9\u4EFD\u9700\u6C42\u5230\u4EFB\u52A1\u7684 auto \u5951\u7EA6\uFF0C\u7136\u540E Dove \u624D\u4F1A\u5C06\u5176\u7269\u5316\u5E76\u8FD0\u884C\u6709\u8FB9\u754C\u7684\u524D\u53F0\u8FED\u4EE3\u3002",
    en: "Approve this demand-to-task auto contract before Dove materializes it and runs bounded foreground iterations."
  },
  autoSelectExistingMessage: {
    zh: "\u5728 /dove:auto \u8FD0\u884C\u524D\uFF0C\u8BF7\u4F7F\u7528\u786E\u8BA4 UX \u901A\u8FC7 index \u6216 packetId \u9009\u62E9\u4E00\u4E2A\u73B0\u6709\u6301\u4E45\u4EFB\u52A1\u3002",
    en: "Use confirmation UX to select an existing durable task by index or packetId before /dove:auto runs."
  },
  autoSelectOrDemandMessage: {
    zh: "\u5728 /dove:auto \u8FD0\u884C\u524D\uFF0C\u8BF7\u4F7F\u7528\u786E\u8BA4 UX \u9009\u62E9\u4E00\u4E2A\u6301\u4E45\u4EFB\u52A1\uFF0C\u6216\u63D0\u4F9B\u4E00\u4E2A\u65B0\u9700\u6C42\u3002",
    en: "Use confirmation UX to select a durable task or provide a new demand before /dove:auto runs."
  },
  autoSelectExistingConfirmedMessage: {
    zh: "\u5728 /dove:auto \u8FD0\u884C\u524D\uFF0C\u8BF7\u901A\u8FC7 index \u6216 packetId \u9009\u62E9\u4E00\u4E2A\u73B0\u6709\u6301\u4E45\u4EFB\u52A1\u3002",
    en: "Select an existing durable task by index or packetId before /dove:auto runs."
  },
  autoProvideTargetMessage: {
    zh: "\u5728 /dove:auto \u8FD0\u884C\u524D\uFF0C\u8BF7\u63D0\u4F9B\u4EFB\u52A1\u76EE\u6807\u6216\u65B0\u76EE\u6807\u3002",
    en: "Provide a task target or a new goal before /dove:auto runs."
  },
  autoNoStepStopReason: {
    zh: "\u672C\u6B21 auto \u8FED\u4EE3\u672A\u63D0\u4F9B\u5177\u4F53\u4E14\u5B89\u5168\u7684\u5DE5\u4F5C\u6D41\u6B65\u9AA4\u3002",
    en: "No concrete safe workflow step was supplied for this auto iteration."
  },
  durableContextNoticeSummary: {
    zh: "Dove \u7684 .dove \u72B6\u6001\u662F\u9879\u76EE\u5185\u6587\u4EF6\u7CFB\u7EDF\u4E8B\u5B9E\u6E90\uFF1B\u8981\u8BA9\u8FD9\u4E9B\u5DE5\u4F5C\u6D41\u4EA7\u7269\u6709\u8D44\u683C\u968F Claude \u6216\u5176\u4ED6\u7F16\u7A0B\u7EC8\u7AEF\u56DE\u6EDA\uFF0C\u5E94\u4F7F\u7528 mutationMode: patch-plan \u5E76\u7531 host \u7684\u53D7\u8FFD\u8E2A\u6587\u4EF6\u7F16\u8F91\u673A\u5236\u5E94\u7528\uFF1BCLI/MCP direct-process \u5199\u5165\u4E0D\u88AB\u58F0\u660E\u4E3A\u5DF2\u9A8C\u8BC1\u53EF\u56DE\u6EDA\u3002",
    en: "Dove .dove state is an in-project filesystem source of truth; to make those workflow artifacts eligible for Claude or other programming-terminal rollback, use mutationMode: patch-plan and apply it through host-tracked file edits. CLI/MCP direct-process writes are not declared verified rollback-safe."
  },
  durableContextNoticeRecovery: {
    zh: "\u5982\u679C host \u56DE\u6EDA\u540E .dove \u6CA1\u6709\u4E00\u8D77\u56DE\u6EDA\uFF0C\u4E0D\u8981\u4F7F\u7528 reset_dove_version \u5F53\u6062\u590D\u5165\u53E3\uFF1B\u6539\u7528 patch-plan \u8BA9 host tracked edits \u5E94\u7528\u540E\u518D\u4F9D\u8D56 host \u56DE\u6EDA\u3002direct-process \u4ECD\u53EF\u7528\u4E8E\u529F\u80FD\u4F18\u5148\u5199\u5165\uFF0C\u4F46\u56DE\u6EDA\u8986\u76D6\u4FDD\u6301 unverified\u3002",
    en: "If .dove did not roll back with the host rollback, do not use reset_dove_version as a restore path; use patch-plan so host tracked edits apply the files before relying on host rollback. direct-process remains available for functional writes, but rollback coverage stays unverified."
  },
  statusHomeInitTitle: {
    zh: "\u5148\u521B\u5EFA Dove \u9879\u76EE\u76EE\u6807",
    en: "Create the Dove project goal first"
  },
  statusHomeInitWhy: {
    zh: "\u5F53\u524D\u5DE5\u4F5C\u533A\u8FD8\u6CA1\u6709 level-0 init \u76EE\u6807\uFF0C\u540E\u7EED\u4EFB\u52A1\u9700\u8981\u5148\u6302\u5230\u8FD9\u4E2A\u6839\u76EE\u6807\u4E0B\u3002",
    en: "The workspace has no level-0 init goal yet, and later work needs that root."
  },
  statusHomeCreateMissionTitle: {
    zh: "\u521B\u5EFA\u4E0B\u4E00\u4E2A\u5177\u4F53 mission",
    en: "Create the next concrete mission"
  },
  statusHomeCreateMissionWhy: {
    zh: "\u5F53\u524D\u6CA1\u6709\u9700\u8981\u7EE7\u7EED\u63A8\u8FDB\u7684\u6D3B\u8DC3\u4EFB\u52A1\uFF0C\u4E0B\u4E00\u6B65\u5E94\u4ECE\u4E00\u4E2A\u771F\u5B9E\u9700\u6C42\u5F00\u59CB\u3002",
    en: "There is no active task to continue, so the next step should start from a real demand."
  },
  statusHomeBoundaryTitle: {
    zh: ({ title }) => `\u5904\u7406 ${title} \u7684\u7B49\u5F85\u8FB9\u754C`,
    en: ({ title }) => `Resolve waiting boundary for ${title}`
  },
  statusHomeBoundaryWhy: {
    zh: ({ reason }) => reason || "\u4EFB\u52A1\u505C\u5728\u4E00\u4E2A\u9700\u8981\u8865\u8F93\u5165\u3001\u8BC1\u636E\u6216\u4EBA\u5DE5\u52A8\u4F5C\u7684\u8FB9\u754C\u3002",
    en: ({ reason }) => reason || "The task is stopped at a boundary that needs input, evidence, or operator action."
  },
  statusHomeContinuationTitle: {
    zh: ({ title }) => `\u7EE7\u7EED ${title}`,
    en: ({ title }) => `Continue ${title}`
  },
  statusHomeContinuationWhy: {
    zh: "runtime \u91CC\u6709\u660E\u786E\u7684\u524D\u53F0\u7EED\u8DD1\u7EBF\u7D22\uFF0C\u53EF\u4EE5\u4ECE\u8FD9\u91CC\u6062\u590D\u3002",
    en: "Runtime state has an explicit foreground continuation hint for this task."
  },
  statusHomeBlockedTitle: {
    zh: ({ title }) => `\u89E3\u9664 ${title} \u7684\u963B\u585E`,
    en: ({ title }) => `Unblock ${title}`
  },
  statusHomeBlockedWhy: {
    zh: ({ reason }) => reason || "\u4EFB\u52A1\u5F53\u524D\u5E26\u6709\u963B\u585E\u4FE1\u53F7\uFF0C\u9700\u8981\u5148\u89E3\u91CA\u6216\u89E3\u9664\u963B\u585E\u3002",
    en: ({ reason }) => reason || "The task currently has a blocker signal that needs explanation or removal."
  },
  statusHomeReviewTitle: {
    zh: "\u5904\u7406\u5F85\u5BA1\u67E5\u95EE\u9898",
    en: "Handle pending review issues"
  },
  statusHomeReviewWhy: {
    zh: "\u5F53\u524D review state \u91CC\u8FD8\u6709\u672A\u89E3\u51B3\u5173\u6CE8\u70B9\u3002",
    en: "The current review state still has unresolved concerns."
  },
  statusHomeContinueTitle: {
    zh: ({ title }) => `\u63A8\u8FDB ${title}`,
    en: ({ title }) => `Advance ${title}`
  },
  statusHomeContinueWhy: {
    zh: "\u4EFB\u52A1\u5DF2\u6709\u4E0B\u4E00\u6B65\u547D\u4EE4\uFF0C\u53EF\u4EE5\u7EE7\u7EED\u4E00\u6B21\u524D\u53F0\u63A8\u8FDB\u3002",
    en: "The task already has a next command and can continue with one foreground step."
  },
  statusHomeReconcileTitle: {
    zh: ({ count }) => `\u6838\u5BF9 ${count} \u4E2A done \u7236 mission \u7684 checklist \u4E00\u81F4\u6027`,
    en: ({ count }) => `Reconcile checklist consistency for ${count} done parent mission${count === 1 ? "" : "s"}`
  },
  statusHomeReconcileWhy: {
    zh: "\u5DF2\u6709\u7236 mission \u662F done\uFF0C\u4F46\u4E0B\u9762\u8FD8\u6709 open checklist \u5B50\u9879\uFF1B\u5148\u6838\u5BF9\u8FD9\u4E9B\u5B50\u9879\u662F\u5426\u88AB\u7236\u4EFB\u52A1\u8BC1\u636E\u8986\u76D6\uFF0C\u8986\u76D6\u624D\u9010\u9879\u6807 done\uFF0C\u5426\u5219\u5E94\u91CD\u5F00\u7236\u4EFB\u52A1\u3002",
    en: "A parent mission is done while checklist children remain open; verify whether the parent evidence covers each child, mark covered children done, or reopen the parent."
  },
  statusHomeReconcileDoneCriteria: {
    zh: "\u6BCF\u4E2A open checklist \u5B50\u9879\u90FD\u6709\u5BF9\u5E94\u8BC1\u636E\uFF0C\u6216\u7236 mission \u88AB\u9000\u56DE open \u72B6\u6001\u7EE7\u7EED\u5904\u7406\u3002",
    en: "Each open checklist child has matching evidence, or the parent mission is moved back to an open state for continued work."
  },
  boundaryActionContinueLabel: {
    zh: "\u7EE7\u7EED/\u6062\u590D\u524D\u53F0\u6267\u884C",
    en: "Continue or resume foreground work"
  },
  boundaryActionEvidenceLabel: {
    zh: "\u8865\u771F\u5B9E\u7ED3\u679C\u6216\u8BC1\u636E",
    en: "Provide real result or evidence"
  },
  boundaryActionReviewLabel: {
    zh: "\u9001\u72EC\u7ACB review",
    en: "Send to independent review"
  },
  boundaryActionStatusLabel: {
    zh: "\u8C03\u6574\u4EFB\u52A1\u72B6\u6001",
    en: "Adjust task status"
  },
  boundaryActionKillLabel: {
    zh: "\u901A\u8FC7 status \u6807\u8BB0 killed",
    en: "Mark killed through status"
  },
  compactCardScope: {
    zh: ({ stage, domain, status }) => `${stage}/${domain} \xB7 ${status}`,
    en: ({ stage, domain, status }) => `${stage}/${domain} \xB7 ${status}`
  },
  compactCardNoEvidence: {
    zh: "\u5C1A\u672A\u5217\u51FA\u8BC1\u636E\u8981\u6C42\u3002",
    en: "No evidence requirement is listed yet."
  },
  compactCardNoAutomaticExecution: {
    zh: "\u4E0D\u4F1A\u81EA\u52A8\u6267\u884C\uFF1B\u9700\u8981\u663E\u5F0F\u786E\u8BA4\u3002",
    en: "No automatic execution; explicit confirmation is required."
  },
  compactCardFirstActionFallback: {
    zh: "\u786E\u8BA4\u540E\u6267\u884C\u4E0B\u4E00\u6B65\u524D\u53F0\u52A8\u4F5C\u3002",
    en: "After confirmation, run the next foreground action."
  },
  compactCardBoundaryFallback: {
    zh: "\u5982\u679C\u7F3A\u5C11\u771F\u5B9E\u8BC1\u636E\uFF0CDove \u4F1A\u8BB0\u5F55\u8FB9\u754C\u800C\u4E0D\u662F\u58F0\u79F0\u5B8C\u6210\u3002",
    en: "If real evidence is missing, Dove records a boundary instead of claiming completion."
  },
  resultCardHappenedFallback: {
    zh: "\u5DF2\u8BB0\u5F55\u672C\u6B21 Dove \u547D\u4EE4\u7ED3\u679C\u3002",
    en: "Recorded this Dove command result."
  },
  resultCardNoEvidence: {
    zh: "\u672C\u6B21\u7ED3\u679C\u6CA1\u6709\u8BB0\u5F55\u663E\u5F0F\u8BC1\u636E\u3002",
    en: "No explicit evidence was recorded for this result."
  },
  resultCardNoValidation: {
    zh: "\u672C\u6B21\u7ED3\u679C\u6CA1\u6709\u8BB0\u5F55\u663E\u5F0F\u9A8C\u8BC1\u8F93\u51FA\u3002",
    en: "No explicit validation output was recorded for this result."
  },
  resultCardCodeNotInspected: {
    zh: "\u672C\u6B21\u5DE5\u5177\u6CA1\u6709\u68C0\u67E5\u4EE3\u7801\u6539\u52A8\uFF1B\u4E0D\u8981\u4ECE\u672C\u5361\u7247\u63A8\u65AD\u4EE3\u7801\u6587\u4EF6\u3002",
    en: "This tool did not inspect code changes; do not infer changed code files from this card."
  },
  resultCardNoDurableWrites: {
    zh: "\u672C\u6B21\u7ED3\u679C\u6CA1\u6709\u58F0\u660E\u65B0\u7684\u6301\u4E45\u5199\u5165\u3002",
    en: "This result did not declare new durable writes."
  },
  resultCardDurableWritesHidden: {
    zh: "\u5DF2\u66F4\u65B0 Dove \u8BB0\u5F55\uFF1B\u5B8C\u6574\u7EC6\u8282\u53EF\u5C55\u5F00\u67E5\u770B\u3002",
    en: "Dove records were updated; expand for full details."
  },
  resultCardEvidenceHidden: {
    zh: "\u5DF2\u8BB0\u5F55\u8BC1\u636E\u6307\u9488\uFF1B\u9ED8\u8BA4\u6458\u8981\u9690\u85CF\u5185\u90E8\u8DEF\u5F84\u3002",
    en: "Evidence pointers were recorded; internal paths are hidden in the default summary."
  },
  resultCardValidationHidden: {
    zh: "\u5DF2\u8BB0\u5F55\u9A8C\u8BC1\u8F93\u51FA\uFF1B\u9ED8\u8BA4\u6458\u8981\u9690\u85CF\u5185\u90E8\u8DEF\u5F84\u3002",
    en: "Validation output was recorded; internal paths are hidden in the default summary."
  },
  resultCardDetailsAvailable: {
    zh: "\u9700\u8981\u5B8C\u6574\u7EC6\u8282\u65F6\u518D\u5C55\u5F00 full/debug\u3002",
    en: "Expand full/debug only when full details are needed."
  },
  resultCardRuntimeResultRecorded: {
    zh: "\u5DF2\u8BB0\u5F55 runtime result\u3002",
    en: "Runtime result recorded."
  },
  resultCardTaskPacketUpdated: {
    zh: "\u5DF2\u66F4\u65B0\u4EFB\u52A1 packet\u3002",
    en: "Task packet updated."
  },
  resultCardTaskIndexUpdated: {
    zh: "\u5DF2\u66F4\u65B0 task packet index\u3002",
    en: "Task packet index updated."
  },
  resultCardRuntimeEventRecorded: {
    zh: "\u5DF2\u8BB0\u5F55 runtime/lifecycle event\u3002",
    en: "Runtime/lifecycle event recorded."
  },
  resultCardReviewInputPrepared: {
    zh: "\u5DF2\u51C6\u5907\u9694\u79BB review \u8F93\u5165\u5305\u3002",
    en: "Isolated review input bundle prepared."
  },
  resultCardReviewImported: {
    zh: "\u5DF2\u5BFC\u5165\u9694\u79BB\u5BA1\u6838\u7ED3\u679C\u3002",
    en: "Isolated review result imported."
  },
  resultCardNextStatus: {
    zh: "\u67E5\u770B Dove status\u3002",
    en: "Open Dove status."
  },
  resultCardNextProvideEvidence: {
    zh: "\u8865\u771F\u5B9E\u7ED3\u679C\u6216\u8BC1\u636E\u3002",
    en: "Provide real result or evidence."
  },
  resultCardNextImportReview: {
    zh: "\u5BFC\u5165\u5BA1\u6838\u7ED3\u679C\u3002",
    en: "Import the review result."
  },
  resultCardNextAdjustStatus: {
    zh: "\u901A\u8FC7 status \u8C03\u6574\u4EFB\u52A1\u72B6\u6001\u3002",
    en: "Adjust task status through status."
  },
  evidenceResolutionNoArtifacts: {
    zh: "\u672C\u6B21\u6CA1\u6709\u63D0\u4F9B\u7528\u4E8E\u9009\u62E9\u4EFB\u52A1\u7684 artifact/evidence \u8DEF\u5F84\u3002",
    en: "No artifact/evidence path was provided for task selection."
  },
  evidenceResolutionNoSelectedPacket: {
    zh: "\u672C\u6B21\u6CA1\u6709\u9009\u4E2D\u53EF\u63A5\u6536\u8BC1\u636E\u7684\u6301\u4E45\u4EFB\u52A1\u3002",
    en: "No durable task was selected to receive evidence."
  },
  evidenceResolutionAcceptedSelf: {
    zh: "\u8BC1\u636E\u5DF2\u7ECF\u5C5E\u4E8E\u5F53\u524D\u4EFB\u52A1\uFF0C\u53EF\u4EE5\u76F4\u63A5\u8BB0\u5F55\u5230\u8BE5\u4EFB\u52A1\u3002",
    en: "The evidence already belongs to the selected task and can be recorded there."
  },
  evidenceResolutionAcceptedDescendant: {
    zh: "\u8BC1\u636E\u5C5E\u4E8E\u5F53\u524D\u4EFB\u52A1\u7684\u5B50\u4EFB\u52A1\uFF0C\u53EF\u4EE5\u5F52\u5165\u8FD9\u4E2A\u7236\u4EFB\u52A1\u7ED3\u679C\u3002",
    en: "The evidence belongs to a descendant task and can be rolled up into this parent result."
  },
  evidenceResolutionNoExistingOwner: {
    zh: "\u63D0\u4F9B\u7684\u8BC1\u636E\u5C1A\u672A\u88AB\u5176\u4ED6\u4EFB\u52A1\u58F0\u660E\uFF1B\u672C\u6B21\u4F1A\u5F52\u5165\u5F53\u524D\u9009\u4E2D\u7684\u4EFB\u52A1\u3002",
    en: "The provided evidence is not claimed by another task; this pass can attach it to the selected task."
  },
  evidenceResolutionConflict: {
    zh: "\u63D0\u4F9B\u7684\u8BC1\u636E\u5DF2\u88AB\u5176\u4ED6\u4EFB\u52A1\u58F0\u660E\uFF1B\u9700\u8981\u9009\u62E9\u6B63\u786E packet\uFF0C\u6216\u6539\u7528\u5F53\u524D\u4EFB\u52A1/\u5B50\u4EFB\u52A1\u7684\u8BC1\u636E\u3002",
    en: "The provided evidence is already claimed by another task; choose the correct packet or use evidence from the selected task/descendants."
  },
  resultCardHandoffResolveBoundary: {
    zh: ({ ownerRole }) => `\u7531 ${ownerRole || "\u5F53\u524D\u89D2\u8272"} \u5904\u7406\u5F53\u524D\u8FB9\u754C\uFF0C\u8865\u9F50\u8F93\u5165\u6216\u8BC1\u636E\u540E\u518D\u56DE\u5230 status\u3002`,
    en: ({ ownerRole }) => `${ownerRole || "the current role"} should resolve the current boundary, provide required input/evidence, then return to status.`
  },
  resultCardHandoffRoleTransfer: {
    zh: ({ ownerRole, nextRole }) => `\u4ECE ${ownerRole || "\u5F53\u524D\u89D2\u8272"} \u4EA4\u63A5\u7ED9 ${nextRole || "\u4E0B\u4E00\u89D2\u8272"} \u5904\u7406\u5F53\u524D\u8FB9\u754C\u3002`,
    en: ({ ownerRole, nextRole }) => `Hand off from ${ownerRole || "the current role"} to ${nextRole || "the next role"} to resolve the current boundary.`
  },
  resultCardHandoffProvideEvidence: {
    zh: "\u9700\u8981\u8865\u771F\u5B9E\u6267\u884C\u7ED3\u679C\u6216\u8BC1\u636E\uFF1BDove \u4E0D\u4F1A\u5047\u88C5\u5DF2\u7ECF\u5B8C\u6210\u3002",
    en: "Real execution results or evidence are required; Dove will not pretend the work is complete."
  },
  resultCardHandoffImportReview: {
    zh: "\u7B49\u5F85 reviewer \u8F93\u51FA\u5BA1\u6838\u7ED3\u679C\u6216\u62A5\u544A\u540E\u5BFC\u5165\uFF1B\u4E0D\u8981\u5BFC\u5165 reviewer \u79C1\u6709\u8BB0\u5F55\u3002",
    en: "Wait for the reviewer result or report, then import it; do not import reviewer private notes."
  },
  resultCardHandoffAddressReview: {
    zh: "review \u5DF2\u8FD4\u56DE\u9700\u8981\u5904\u7406\u7684\u95EE\u9898\uFF1B\u4E0B\u4E00\u6B65\u5E94\u521B\u5EFA\u6216\u63A8\u8FDB\u4FEE\u590D\u4EFB\u52A1\u3002",
    en: "Review returned issues to address; next create or advance a fix task."
  },
  resultCardNextCreateFixMission: {
    zh: "\u521B\u5EFA\u6216\u63A8\u8FDB\u4FEE\u590D mission\u3002",
    en: "Create or advance a fix mission."
  },
  defaultDoveTitle: {
    zh: "\u672A\u547D\u540D\u4EFB\u52A1\u5DE5\u4F5C\u533A",
    en: "Untitled Mission Workspace"
  },
  defaultDoveObjective: {
    zh: "\u8BB0\u5F55 Dove \u4EFB\u52A1\u76EE\u6807\u4E0E\u8D21\u732E\u3002",
    en: "Capture the Dove mission goal and contribution."
  },
  defaultDoveThesis: {
    zh: "\u7528\u4E00\u53E5\u8BDD\u63CF\u8FF0\u8BBA\u6587\u9886\u57DF\u4E3B\u5F20\u6216\u4EFB\u52A1\u7ED3\u679C\u3002",
    en: "Describe the paper-domain claim or mission outcome in one sentence."
  },
  defaultCurrentFocus: {
    zh: "\u5BF9\u9F50\u770B\u677F\u5E76\u9009\u62E9\u4E0B\u4E00\u4E2A\u6301\u4E45\u6B65\u9AA4\u3002",
    en: "Align the board and choose the next durable step."
  },
  queryFallbackGoal: {
    zh: "\u4ECE\u5F53\u524D\u5DE5\u4F5C\u533A\u754C\u5B9A\u4E00\u4E2A\u6709\u8FB9\u754C\u7684 Dove \u4EFB\u52A1\u3002",
    en: "Frame one bounded Dove mission from the current workspace."
  },
  returnProtocol: {
    zh: ({ checks }) => `\u8FD4\u56DE\u65F6\u643A\u5E26 ${checks}\u3002`,
    en: ({ checks }) => `Return with ${checks}.`
  },
  routeSelectedReason: {
    zh: ({ selectedCommand, nextCommand }) => `\u4E3A\u4E86\u5F97\u5230\u786E\u5B9A\u6027\u7684\u3001\u65E0\u5199\u5165\u7684 Dove \u8DEF\u7531\u7ED3\u679C\uFF0C\u4ECE\u9886\u57DF\u8DEF\u7531 ${nextCommand} \u4E2D\u9009\u62E9\u4E86 ${selectedCommand}\u3002`,
    en: ({ selectedCommand, nextCommand }) => `Selected ${selectedCommand} from domain route ${nextCommand} for a deterministic no-write Dove routing result.`
  },
  routeAutoReason: {
    zh: "\u672C\u6B21 Dove \u8DEF\u7531\u67E5\u8BE2\u5DF2\u663E\u5F0F\u5141\u8BB8\u81EA\u52A8\u6267\u884C\u3002",
    en: "Auto execution was explicitly allowed for this Dove routing query."
  },
  routeDefaultReason: {
    zh: ({ stage, domain, selectedCommand }) => `\u9886\u57DF ${domain} \u7684\u4EFB\u52A1\u9636\u6BB5 ${stage} \u6620\u5C04\u5230 ${selectedCommand}\u3002`,
    en: ({ stage, domain, selectedCommand }) => `Mission stage ${stage} in domain ${domain} maps to ${selectedCommand}.`
  },
  projectTitleFallback: {
    zh: "Dove \u9879\u76EE",
    en: "Dove project"
  },
  boardBlockerFallback: {
    zh: ({ index }) => `\u770B\u677F\u963B\u585E ${index}`,
    en: ({ index }) => `Board blocker ${index}`
  },
  taskBlockedBySummary: {
    zh: ({ id, blockers }) => `${id} \u88AB ${blockers} \u963B\u585E`,
    en: ({ id, blockers }) => `${id} is blocked by ${blockers}`
  },
  taskMarkedBlockedSummary: {
    zh: ({ id }) => `${id} \u88AB\u6807\u8BB0\u4E3A blocked`,
    en: ({ id }) => `${id} is marked blocked`
  },
  returnReadyVerdict: {
    zh: "\u57FA\u4E8E\u5F53\u524D\u6301\u4E45\u8BC1\u636E\uFF0C\u8FD4\u56DE\u5DF2\u5C31\u7EEA\u3002",
    en: "Return is ready from the current durable evidence."
  },
  returnNotReadyVerdict: {
    zh: "\u8FD4\u56DE\u5C1A\u672A\u5C31\u7EEA\uFF1B\u5173\u95ED\u524D\u8BF7\u5148\u6267\u884C\u4E0B\u4E00\u4E2A Dove \u547D\u4EE4\u3002",
    en: "Return is not ready; follow the next Dove command before closure."
  },
  lessonRitualWhen: {
    zh: "\u8FD4\u56DE\u5DF2\u5C31\u7EEA\u4E14\u6709\u503C\u5F97\u4FDD\u7559\u7684\u53EF\u590D\u7528\u7ECF\u9A8C\u4E4B\u540E",
    en: "after return is ready and reusable experience is worth preserving"
  }
};
function doveText(language, key, params = {}) {
  const normalized = normalizeDoveResponseLanguage(language);
  const entry = TEXT[key];
  const value = entry?.[normalized] ?? entry?.en ?? key;
  return typeof value === "function" ? value(params) : value;
}

// src/core/navigation.mjs
import crypto5 from "node:crypto";
import fs7 from "node:fs";
import path8 from "node:path";

// src/core/follow-through-authority.mjs
import crypto3 from "node:crypto";

// src/core/task-packets.mjs
import crypto4 from "node:crypto";
import fs6 from "node:fs";
import path7 from "node:path";
function slugify(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}
function normalizeStringArray3(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}
function normalizeObject2(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function uniqueStrings(values = []) {
  return Array.from(new Set(values.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean)));
}
function normalizeAllowed(value, allowed, fallback) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return allowed.includes(normalized) ? normalized : fallback;
}
function normalizeLevel(value, fallback = 3) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}
function normalizeTaskStatus(value, fallback = "pending") {
  return normalizeAllowed(value, DOVE_TASK_STATUSES, fallback);
}
function normalizePrimaryRole(value, fallback = "builder") {
  return normalizeAllowed(value, DOVE_PRIMARY_ROLE_IDS, fallback);
}
function readJsonReadOnly(root, relativePath, fallback = null) {
  const fullPath = path7.join(root, relativePath);
  if (!fs6.existsSync(fullPath)) {
    return typeof fallback === "function" ? fallback() : structuredClone(fallback);
  }
  return JSON.parse(fs6.readFileSync(fullPath, "utf8"));
}
function packetFilePath(packetId) {
  return path7.join(ARTIFACT_PATHS.taskPacketsPacketsDir, `${packetId}.json`);
}
function packetContextPath(packetId) {
  return path7.join(ARTIFACT_PATHS.packetContextsDir, `${packetId}.json`);
}
function readOptionalJson(root, relativePath) {
  try {
    return readJsonReadOnly(root, relativePath, null);
  } catch {
    return null;
  }
}
function normalizeTaskPacketId(value) {
  return slugify(value);
}
function readTaskTargetResolutionSettings(root) {
  const state = readJsonReadOnly(root, ARTIFACT_PATHS.state, createDefaultState);
  return normalizeSettings(state.settings).taskTargetResolution;
}
function normalizePacketCandidate(root, packet = {}) {
  const id = normalizeTaskPacketId(packet.id ?? packet.packetId ?? packet.sourceId ?? packet.title);
  const filePacket = readOptionalJson(root, packet.packetPath ?? packetFilePath(id));
  const context = readOptionalJson(root, packet.packetContextPath ?? packetContextPath(id));
  const merged = { ...packet, ...normalizeObject2(filePacket) };
  const contextObject = normalizeObject2(context);
  const creatorKind = normalizeAllowed(merged.creatorKind ?? contextObject.creatorKind, DOVE_TASK_CREATOR_KINDS, "user");
  const levelFallback = creatorKind === "system" ? 2 : 3;
  const level = normalizeLevel(merged.level ?? contextObject.level, levelFallback);
  const status = normalizeTaskStatus(merged.status ?? merged.lifecycleStatus ?? contextObject.status, "pending");
  return {
    ...merged,
    id,
    title: merged.title ?? id,
    summary: merged.summary ?? "",
    parentId: merged.parentId ?? contextObject.parentId ?? null,
    rootId: merged.rootId ?? contextObject.rootId ?? (level === 0 ? id : null),
    level,
    creatorKind,
    stage: normalizeAllowed(merged.stage ?? merged.missionStage ?? contextObject.stage, DOVE_TASK_STAGES, "plan"),
    domain: normalizeAllowed(merged.domain ?? merged.doveDomain ?? contextObject.domain, DOVE_TASK_DOMAINS, "engineering"),
    status,
    lifecycleStatus: merged.lifecycleStatus ?? status,
    dependencies: uniqueStrings([...normalizeStringArray3(merged.dependencies), ...normalizeStringArray3(contextObject.dependencies)]),
    blockedBy: uniqueStrings([...normalizeStringArray3(merged.blockedBy), ...normalizeStringArray3(contextObject.blockedBy)]),
    completedAt: merged.completedAt ?? contextObject.completedAt ?? null,
    blockedReason: merged.blockedReason ?? merged.blockerReason ?? contextObject.blockedReason ?? contextObject.blockerReason ?? null,
    killedAt: merged.killedAt ?? contextObject.killedAt ?? null,
    killReason: merged.killReason ?? contextObject.killReason ?? null,
    ownerRole: normalizePrimaryRole(merged.ownerRole ?? contextObject.ownerRole, "builder"),
    nextRole: normalizePrimaryRole(merged.nextRole ?? contextObject.nextRole, merged.ownerRole ?? contextObject.ownerRole ?? "builder"),
    boundary: normalizeDoveBoundary(merged.boundary ?? contextObject.boundary, null),
    boundaryHistory: Array.isArray(merged.boundaryHistory ?? contextObject.boundaryHistory) ? (merged.boundaryHistory ?? contextObject.boundaryHistory).map((item) => normalizeDoveBoundary(item, null)).filter(Boolean) : [],
    handoff: normalizeDoveHandoff(merged.handoff ?? contextObject.handoff, null),
    lastTransition: normalizeObject2(merged.lastTransition ?? contextObject.lastTransition),
    lessonIds: uniqueStrings([...normalizeStringArray3(merged.lessonIds), ...normalizeStringArray3(contextObject.lessonIds)]),
    artifactRefs: uniqueStrings([...normalizeStringArray3(merged.artifactRefs), ...normalizeStringArray3(contextObject.artifactRefs)]),
    contextPolicy: merged.contextPolicy ?? contextObject.contextPolicy ?? DOVE_AUDIO_CONTEXT_POLICY,
    sourceType: merged.sourceType ?? contextObject.sourceType ?? null,
    sourceId: merged.sourceId ?? contextObject.sourceId ?? id,
    currentFocus: merged.currentFocus ?? contextObject.currentFocus ?? "",
    nextAction: merged.nextAction ?? contextObject.nextAction ?? "",
    packetPath: merged.packetPath ?? packetFilePath(id),
    packetContextPath: merged.packetContextPath ?? packetContextPath(id),
    claimIds: uniqueStrings([...normalizeStringArray3(merged.claimIds), ...normalizeStringArray3(contextObject.claimIds)]),
    noteIds: uniqueStrings([...normalizeStringArray3(merged.noteIds), ...normalizeStringArray3(contextObject.noteIds)]),
    experimentIds: uniqueStrings([...normalizeStringArray3(merged.experimentIds), ...normalizeStringArray3(contextObject.experiments), ...normalizeStringArray3(contextObject.experimentIds)]),
    rebuttalIssueIds: uniqueStrings([...normalizeStringArray3(merged.rebuttalIssueIds), ...normalizeStringArray3(contextObject.rebuttalIssueIds)]),
    versionIds: uniqueStrings([...normalizeStringArray3(merged.versionIds), ...normalizeStringArray3(contextObject.versionIds)]),
    resultIds: uniqueStrings([...normalizeStringArray3(merged.resultIds), ...normalizeStringArray3(contextObject.resultIds)]),
    auditIds: uniqueStrings([...normalizeStringArray3(merged.auditIds), ...normalizeStringArray3(contextObject.auditIds)]),
    outputPaths: uniqueStrings([...normalizeStringArray3(merged.outputPaths), ...normalizeStringArray3(contextObject.outputPaths)]),
    evidenceLinks: uniqueStrings([...normalizeStringArray3(merged.evidenceLinks), ...normalizeStringArray3(contextObject.evidenceLinks)]),
    validationEvidencePaths: uniqueStrings([...normalizeStringArray3(merged.validationEvidencePaths), ...normalizeStringArray3(contextObject.validationEvidencePaths)]),
    verificationEvidencePaths: uniqueStrings([...normalizeStringArray3(merged.verificationEvidencePaths), ...normalizeStringArray3(contextObject.verificationEvidencePaths)]),
    verifiedCriteria: normalizeDoveVerifiedCriteria(merged.verifiedCriteria ?? contextObject.verifiedCriteria),
    executionContract: normalizeDoveExecutionContract(merged.executionContract, null),
    context: contextObject
  };
}
function readTaskPacketCatalog(root) {
  const index = readJsonReadOnly(root, ARTIFACT_PATHS.taskPacketsIndex, createTaskPacketsIndex);
  const items = Array.isArray(index.items) ? index.items : [];
  const resultsIndex = readOptionalJson(root, ARTIFACT_PATHS.experimentResults);
  const auditsIndex = readOptionalJson(root, ARTIFACT_PATHS.experimentAudits);
  const results = Array.isArray(resultsIndex?.items) ? resultsIndex.items : [];
  const audits = Array.isArray(auditsIndex?.items) ? auditsIndex.items : [];
  const byId = /* @__PURE__ */ new Map();
  for (const item of items) {
    const packet = normalizePacketCandidate(root, item);
    if (packet.id) {
      const packetExperimentIds = new Set(packet.experimentIds);
      packet.resultIds = uniqueStrings([
        ...packet.resultIds,
        ...results.filter((result) => packetExperimentIds.has(result.experimentId)).map((result) => result.id)
      ]);
      packet.auditIds = uniqueStrings([
        ...packet.auditIds,
        ...audits.filter((audit) => packetExperimentIds.has(audit.experimentId) || packet.resultIds.includes(audit.resultId)).map((audit) => audit.id)
      ]);
      byId.set(packet.id, packet);
    }
  }
  return {
    index,
    packets: Array.from(byId.values()),
    byId
  };
}
function flattenFieldValues(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenFieldValues(item));
  }
  if (value && typeof value === "object") {
    return [];
  }
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}
function collectValuesFromObjects(objects, fields = []) {
  const values = [];
  for (const object of objects) {
    if (!object || typeof object !== "object" || Array.isArray(object)) {
      continue;
    }
    for (const field of fields) {
      values.push(...flattenFieldValues(object[field]));
    }
  }
  return uniqueStrings(values);
}
function requestObjects(args = {}) {
  return [args, args.plan, args.result, args.audit, args.payload].filter((item) => item && typeof item === "object" && !Array.isArray(item));
}
function explicitPacketIds(objects = []) {
  const values = collectValuesFromObjects(objects, ["packetId", "taskPacketId", "missionPacketId", "taskId"]);
  const packetIds = collectValuesFromObjects(objects, ["packetIds", "taskPacketIds", "missionPacketIds", "taskIds"]);
  return uniqueStrings([...values, ...packetIds].map((value) => normalizeTaskPacketId(value)));
}
function targetTexts(objects = [], fields = []) {
  return collectValuesFromObjects(objects, fields).filter((value) => !explicitPacketIds(objects).includes(normalizeTaskPacketId(value)));
}
function artifactValues(objects = [], fields = []) {
  return collectValuesFromObjects(objects, fields);
}
function packetArtifactSet(packet) {
  return new Set(uniqueStrings([
    packet.id,
    packet.sourceId,
    packet.packetPath,
    packet.packetContextPath,
    packet.parentId,
    packet.rootId,
    ...normalizeStringArray3(packet.dependencies),
    ...normalizeStringArray3(packet.blockedBy),
    ...normalizeStringArray3(packet.lessonIds),
    ...normalizeStringArray3(packet.artifactRefs),
    ...normalizeStringArray3(packet.claimIds),
    ...normalizeStringArray3(packet.noteIds),
    ...normalizeStringArray3(packet.experimentIds),
    ...normalizeStringArray3(packet.rebuttalIssueIds),
    ...normalizeStringArray3(packet.versionIds),
    ...normalizeStringArray3(packet.resultIds),
    ...normalizeStringArray3(packet.auditIds),
    ...normalizeStringArray3(packet.outputPaths),
    ...normalizeStringArray3(packet.evidenceLinks),
    ...normalizeStringArray3(packet.validationEvidencePaths),
    ...normalizeStringArray3(packet.verificationEvidencePaths),
    ...normalizeStringArray3(packet.verifiedCriteria?.flatMap((item) => item.evidencePaths ?? []))
  ]));
}
function packetTextValues(packet) {
  return uniqueStrings([
    packet.id,
    packet.title,
    packet.summary,
    packet.currentFocus,
    packet.nextAction,
    packet.stage,
    packet.domain,
    packet.creatorKind,
    packet.sourceId,
    packet.sourceType ? `${packet.sourceType}:${packet.sourceId}` : null
  ].filter(Boolean));
}
function normalizeTextForMatch(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}_-]+/gu, "").trim();
}
function textScore(packet, targets = []) {
  let score = 0;
  const values = packetTextValues(packet);
  for (const target of targets) {
    const normalizedTarget = slugify(target);
    const textTarget = normalizeTextForMatch(target);
    for (const value of values) {
      const normalizedValue = slugify(value);
      const textValue = normalizeTextForMatch(value);
      if (textTarget && textValue && textValue === textTarget) {
        score = Math.max(score, 1);
      } else if (textTarget && textValue && (textValue.includes(textTarget) || textTarget.includes(textValue))) {
        score = Math.max(score, 0.75);
      } else if (normalizedTarget !== "item" && normalizedValue !== "item" && normalizedValue === normalizedTarget) {
        score = Math.max(score, normalizedTarget.length >= 12 ? 1 : 0.65);
      } else if (normalizedTarget !== "item" && normalizedValue !== "item" && (normalizedValue.includes(normalizedTarget) || normalizedTarget.includes(normalizedValue))) {
        score = Math.max(score, normalizedTarget.length >= 12 ? 0.75 : 0.55);
      } else if (String(value).toLowerCase().includes(String(target).toLowerCase())) {
        score = Math.max(score, 0.6);
      }
    }
  }
  return score;
}
function artifactScore(packet, values = []) {
  if (values.length === 0) {
    return 0;
  }
  const artifactSet = packetArtifactSet(packet);
  let matches = 0;
  for (const value of values) {
    if (artifactSet.has(value) || artifactSet.has(slugify(value))) {
      matches += 1;
    }
  }
  return matches > 0 ? Math.min(1, 0.7 + matches / values.length * 0.3) : 0;
}
function lifecycleScore(packet) {
  if (["active", "in-progress", "current"].includes(packet.lifecycleStatus) || ["active", "in-progress", "current"].includes(packet.status)) {
    return 0.4;
  }
  if (["waiting", "queued", "pending", "planned", "open"].includes(packet.lifecycleStatus) || ["waiting", "queued", "pending", "planned", "open"].includes(packet.status)) {
    return 0.25;
  }
  return 0.1;
}
function scorePackets(packets, targets, artifacts) {
  return packets.map((packet) => {
    const targetText = textScore(packet, targets);
    const artifact = artifactScore(packet, artifacts);
    const lifecycle = targets.length === 0 ? lifecycleScore(packet) : 0;
    const score = Math.max(targetText, artifact, lifecycle);
    return {
      packet,
      packetId: packet.id,
      score,
      matchedBy: {
        targetText,
        artifact,
        lifecycle
      }
    };
  }).filter((candidate) => candidate.score > 0).sort((left, right) => right.score - left.score || left.packetId.localeCompare(right.packetId));
}
function candidateScoreText(score) {
  return Number.isFinite(score) ? score.toFixed(2) : "0.00";
}
function candidateSummary(candidate = {}) {
  const packet = candidate.packet ?? {};
  const summary = {
    packetId: candidate.packetId,
    title: packet.title ?? candidate.title ?? candidate.packetId,
    status: packet.status ?? candidate.status,
    level: packet.level ?? candidate.level,
    score: Number.isFinite(candidate.score) ? candidate.score : 0,
    matchedBy: candidate.matchedBy ?? {}
  };
  if (candidate.relation) {
    summary.relation = candidate.relation;
  }
  const matchedArtifacts = uniqueStrings(candidate.matchedArtifacts ?? []);
  if (matchedArtifacts.length > 0) {
    summary.matchedArtifacts = matchedArtifacts;
  }
  return summary;
}
function resolutionError(reason, candidates = [], details = {}) {
  const summaries = candidates.map((candidate) => candidateSummary(candidate));
  const suggestedActions = uniqueStrings(details.suggestedActions ?? details.artifactResolution?.suggestedActions ?? []);
  const candidateText = summaries.length > 0 ? ` Candidates: ${summaries.map((candidate) => `${candidate.packetId}(${candidate.title ?? candidate.packetId}, score=${candidateScoreText(candidate.score)})`).join(", ")}.` : "";
  const suggestionText = suggestedActions.length > 0 ? ` Suggested actions: ${suggestedActions.join("; ")}.` : "";
  const error = new Error(`${reason}${candidateText}${suggestionText} Provide packetId or confirm one candidate explicitly before writing.`);
  error.code = "TASK_PACKET_RESOLUTION_REQUIRED";
  error.reason = reason;
  error.candidates = summaries;
  error.suggestedActions = suggestedActions;
  if (details.artifactResolution) {
    error.artifactResolution = details.artifactResolution;
  }
  if (details.resolutionErrorCode) {
    error.resolutionErrorCode = details.resolutionErrorCode;
  }
  return error;
}
function hasResolutionSignal(targets = [], artifacts = []) {
  return targets.length > 0 || artifacts.length > 0;
}
function hasTiedTopCandidate(candidates = []) {
  return candidates.length > 1 && candidates[0].score === candidates[1].score;
}
function normalizeRelationId(value) {
  return typeof value === "string" && value.trim() ? normalizeTaskPacketId(value) : null;
}
function buildPacketRelationMap(packets = []) {
  const relationMap = /* @__PURE__ */ new Map();
  for (const packet of packets) {
    const packetId = normalizeRelationId(packet?.id);
    if (packetId) {
      relationMap.set(packetId, packet);
    }
  }
  return relationMap;
}
function isDescendantPacket(ancestor, candidate, packetsById) {
  const ancestorId = normalizeRelationId(ancestor?.id);
  let parentId = normalizeRelationId(candidate?.parentId);
  const seen = /* @__PURE__ */ new Set();
  while (ancestorId && parentId && !seen.has(parentId)) {
    if (parentId === ancestorId) {
      return true;
    }
    seen.add(parentId);
    const parent = packetsById.get(parentId);
    parentId = normalizeRelationId(parent?.parentId);
  }
  return false;
}
function packetRelation(selected, candidate, packetsById) {
  const selectedId = normalizeRelationId(selected?.id);
  const candidateId = normalizeRelationId(candidate?.id);
  if (!selectedId || !candidateId) {
    return "unrelated";
  }
  if (candidateId === selectedId) {
    return "self";
  }
  if (isDescendantPacket(selected, candidate, packetsById)) {
    return "descendant";
  }
  if (isDescendantPacket(candidate, selected, packetsById)) {
    return "ancestor";
  }
  const selectedParentId = normalizeRelationId(selected?.parentId);
  const candidateParentId = normalizeRelationId(candidate?.parentId);
  if (selectedParentId && candidateParentId && selectedParentId === candidateParentId) {
    return "sibling";
  }
  const selectedRootId = normalizeRelationId(selected?.rootId);
  const candidateRootId = normalizeRelationId(candidate?.rootId);
  if (selectedRootId && candidateRootId && selectedRootId !== candidateRootId) {
    return "other-root";
  }
  return "unrelated";
}
function matchedArtifactsForPacket(packet, artifacts = []) {
  const artifactSet = packetArtifactSet(packet);
  return uniqueStrings(artifacts.filter((artifact) => artifactSet.has(artifact) || artifactSet.has(slugify(artifact))));
}
function artifactMatchSummary(packet, artifacts = [], relation = null) {
  const score = artifactScore(packet, artifacts);
  return {
    packetId: packet.id,
    title: packet.title ?? packet.id,
    status: packet.status,
    level: packet.level,
    relation,
    score,
    matchedBy: { artifact: score },
    matchedArtifacts: matchedArtifactsForPacket(packet, artifacts)
  };
}
function packetSelectionSummary(packet) {
  return packet ? {
    packetId: packet.id,
    title: packet.title ?? packet.id,
    status: packet.status,
    level: packet.level
  } : null;
}
function artifactConflictSuggestedActions(selectedPacket, requestedArtifacts = [], conflictingMatches = []) {
  const selectedId = selectedPacket?.packetId ?? "selected-packet";
  const ownerActions = conflictingMatches.map((match) => {
    const artifacts = match.matchedArtifacts?.length > 0 ? ` for ${match.matchedArtifacts.join(", ")}` : "";
    return `write-to-owner-packet ${match.packetId}${artifacts}`;
  });
  return uniqueStrings([
    ...ownerActions,
    `choose-or-create-descendant-of ${selectedId} before attaching new artifacts`,
    `do-not-attach-unrelated-artifacts ${requestedArtifacts.join(", ") || "requested artifacts"} to ${selectedId}`
  ]);
}
function analyzeArtifactConsistency(packet, packets, artifacts = []) {
  const requestedArtifacts = uniqueStrings(artifacts);
  const selectedPacketId = normalizeRelationId(packet?.id);
  const selectedPacket = packetSelectionSummary(packet);
  if (!packet || requestedArtifacts.length === 0) {
    return {
      selectedPacketId,
      selectedPacket,
      requestedArtifacts,
      matchingPackets: [],
      acceptedMatches: [],
      conflictingMatches: [],
      hasConflict: false,
      suggestedActions: [],
      explanationCode: requestedArtifacts.length === 0 ? "no-artifacts" : "no-selected-packet"
    };
  }
  const packetsById = buildPacketRelationMap(packets);
  const matchingPackets = packets.filter((candidate) => artifactScore(candidate, requestedArtifacts) > 0).map((candidate) => artifactMatchSummary(candidate, requestedArtifacts, packetRelation(packet, candidate, packetsById)));
  const acceptedMatches = matchingPackets.filter((match) => ["self", "descendant"].includes(match.relation));
  const conflictingMatches = matchingPackets.filter((match) => !["self", "descendant"].includes(match.relation));
  const hasConflict = conflictingMatches.length > 0;
  const explanationCode = hasConflict ? "artifact-conflict" : acceptedMatches.some((match) => match.relation === "descendant") ? "accepted-descendant-artifacts" : acceptedMatches.some((match) => match.relation === "self") ? "accepted-self-artifacts" : "no-existing-artifact-owner";
  const suggestedActions = hasConflict ? artifactConflictSuggestedActions(selectedPacket, requestedArtifacts, conflictingMatches) : [];
  return {
    selectedPacketId,
    selectedPacket,
    requestedArtifacts,
    matchingPackets,
    acceptedMatches,
    conflictingMatches,
    hasConflict,
    suggestedActions,
    explanationCode
  };
}
function ensureArtifactConsistency(packet, packets, artifacts = []) {
  const artifactResolution = analyzeArtifactConsistency(packet, packets, artifacts);
  if (artifactResolution.hasConflict) {
    throw resolutionError(`Task target artifact ids conflict with packet ${packet.id}.`, artifactResolution.conflictingMatches.map((match) => ({
      packetId: match.packetId,
      title: match.title,
      status: match.status,
      level: match.level,
      relation: match.relation,
      score: match.score,
      matchedBy: match.matchedBy,
      matchedArtifacts: match.matchedArtifacts
    })), {
      artifactResolution,
      suggestedActions: artifactResolution.suggestedActions,
      resolutionErrorCode: artifactResolution.explanationCode
    });
  }
  return artifactResolution;
}
function resolveDurableTaskPacket(root, args = {}, options = {}) {
  const settings = options.settings ?? readTaskTargetResolutionSettings(root);
  const catalog = readTaskPacketCatalog(root);
  const objects = requestObjects(args);
  const explicitIds = explicitPacketIds(objects);
  const targets = targetTexts(objects, options.targetFields ?? []);
  const artifacts = artifactValues(objects, options.artifactFields ?? []);
  if (explicitIds.length > 1) {
    throw resolutionError(`Task target fields point to multiple packet ids: ${explicitIds.join(", ")}.`);
  }
  if (explicitIds.length === 1) {
    const packet = catalog.byId.get(explicitIds[0]);
    if (!packet) {
      throw resolutionError(`Task target packet ${explicitIds[0]} does not exist in ${ARTIFACT_PATHS.taskPacketsIndex}.`);
    }
    const artifactResolution2 = ensureArtifactConsistency(packet, catalog.packets, artifacts);
    return {
      packet,
      packetId: packet.id,
      resolution: {
        mode: "explicit-packet-id",
        autoSelect: settings.autoSelect,
        candidates: [{ packetId: packet.id, score: 1 }],
        artifactResolution: artifactResolution2
      },
      artifactIds: artifacts,
      artifactResolution: artifactResolution2
    };
  }
  if (catalog.packets.length === 0) {
    throw new Error(`Task-scoped write requires a durable task packet before writing. No packets exist in ${ARTIFACT_PATHS.taskPacketsIndex}. Launch or materialize a Dove mission packet first.`);
  }
  const candidates = scorePackets(catalog.packets, targets, artifacts);
  if (candidates.length === 0) {
    throw resolutionError("Task-scoped write could not resolve a durable task packet.");
  }
  const top = candidates[0];
  const explicitResolutionSignal = hasResolutionSignal(targets, artifacts);
  if (!explicitResolutionSignal && candidates.length > 1) {
    throw resolutionError("Task target requires confirmation because no packetId, natural-language target, or linked artifact was provided.", candidates);
  }
  if (!settings.autoSelect && candidates.length > 1) {
    throw resolutionError("Task target is ambiguous and autoSelect is false.", candidates);
  }
  if (settings.autoSelect && hasTiedTopCandidate(candidates)) {
    throw resolutionError("Task target requires confirmation because multiple durable packets have the same top confidence.", candidates);
  }
  if (settings.autoSelect && top.matchedBy.targetText > 0 && top.score < settings.autoSelectMinScore) {
    throw resolutionError(`Task target confidence ${top.score.toFixed(2)} is below autoSelectMinScore ${settings.autoSelectMinScore}.`, candidates);
  }
  const artifactResolution = ensureArtifactConsistency(top.packet, catalog.packets, artifacts);
  return {
    packet: top.packet,
    packetId: top.packet.id,
    resolution: {
      mode: settings.autoSelect ? "auto-selected" : "unique-candidate",
      autoSelect: settings.autoSelect,
      candidates: candidates.map((candidate) => ({
        packetId: candidate.packetId,
        score: candidate.score,
        matchedBy: candidate.matchedBy
      })),
      selectedScore: top.score,
      artifactResolution
    },
    artifactIds: artifacts,
    artifactResolution
  };
}
function assertResolvedTaskPacket(root, args = {}, options = {}) {
  return resolveDurableTaskPacket(root, args, options);
}

// src/core/orchestration.mjs
import fs9 from "node:fs";
import path10 from "node:path";
import crypto6 from "node:crypto";

// src/core/mutation-guard.mjs
var GOVERNANCE_MUTATION_BY_ID = new Map([
  ...GOVERNANCE_GUARDED_MUTATIONS,
  ...GOVERNANCE_EXEMPT_MUTATIONS
].map((entry) => [entry.id, entry]));
function getGovernanceMutationEntry(actionId) {
  return GOVERNANCE_MUTATION_BY_ID.get(actionId) ?? null;
}
function assertTaskScopedMutationTarget(root, actionId, args = {}, options = {}) {
  const entry = getGovernanceMutationEntry(actionId);
  if (!entry) {
    throw new Error(`Governance registry missing mutation entry: ${actionId}`);
  }
  if (!entry.requiresPacketTarget) {
    return {
      packet: null,
      packetId: null,
      resolution: {
        mode: "not-packet-scoped",
        mutationScope: entry.mutationScope ?? "unspecified"
      },
      artifactIds: []
    };
  }
  return assertResolvedTaskPacket(root, args, {
    ...options,
    targetFields: options.targetFields ?? entry.targetFields,
    artifactFields: options.artifactFields ?? entry.artifactFields,
    mutationScope: entry.mutationScope
  });
}

// src/core/pre-action-guidance.mjs
var FULL_LESSON_LIMIT = 5;
var DEFAULT_LESSON_LIMIT = 3;
function text(responseLanguage, zh, en) {
  return responseLanguage === "en" ? en : zh;
}
function normalizeString3(value, fallback = null) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function normalizeStringArray4(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)));
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}
function normalizeObjectArray2(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : [];
}
function normalizeObject3(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function normalizeSurface(surface) {
  const normalized = normalizeString3(surface, "dove.status").replace(/^project:/, "");
  return normalized.startsWith("dove.") ? normalized : `dove.${normalized}`;
}
function normalizeRoleId(roleId) {
  const normalized = normalizeString3(roleId, null);
  if (!normalized || !ROLE_HIERARCHY[normalized]) {
    return null;
  }
  const role = ROLE_HIERARCHY[normalized];
  return role.kind === "primary" ? role.id : role.parentRole ?? null;
}
function canonicalSubagentId(roleId) {
  const normalized = normalizeString3(roleId, null);
  if (!normalized || !ROLE_HIERARCHY[normalized]) {
    return null;
  }
  const role = ROLE_HIERARCHY[normalized];
  if (role.kind === "primary") {
    return null;
  }
  return role.canonicalRole ?? role.aliasOf ?? role.id;
}
function roleLabel(roleId) {
  return DOVE_PRIMARY_ROLES.find((role) => role.id === roleId)?.label ?? ROLE_HIERARCHY[roleId]?.label ?? roleId;
}
function roleSummary(roleId) {
  return DOVE_PRIMARY_ROLES.find((role) => role.id === roleId)?.summary ?? ROLE_HIERARCHY[roleId]?.charter ?? null;
}
function roleBoundaryCard(roleId, responseLanguage = "zh") {
  const role = ROLE_HIERARCHY[roleId];
  return {
    role: roleId,
    label: roleLabel(roleId),
    summary: roleSummary(roleId),
    boundary: role?.charter ?? roleSummary(roleId),
    manuallySwitchable: role?.manuallySwitchable === true,
    subagents: normalizeStringArray4(role?.subagents)
  };
}
function normalizeWorkflowStage(stage, surface = "dove.status") {
  const normalized = normalizeString3(stage, null)?.toLowerCase().replace(/_/g, "-") ?? null;
  if (["plan", "goal", "design", "checklist"].includes(normalized)) {
    return "plan";
  }
  if (["execute", "execution", "draft", "experiments", "source", "sources", "notes", "figure", "figures", "claim", "claims"].includes(normalized)) {
    return "execute";
  }
  if (["audit", "review"].includes(normalized)) {
    return "audit";
  }
  if (normalized === "return") {
    return "return";
  }
  if (["dove.auto", "dove.figure", "dove.experience", "dove.draft", "dove.source", "dove.note", "dove.document", "dove.documents", "dove.claim"].includes(surface)) {
    return "execute";
  }
  if (["dove.review", "dove.audit", "dove.paper-audit", "dove.audio-review", "dove.isolated-review"].includes(surface)) {
    return "audit";
  }
  return ["dove.status", "dove.mission", "dove.operator"].includes(surface) ? "plan" : null;
}
function surfaceIn(surface, needles) {
  return needles.some((needle) => surface === needle || surface.includes(needle));
}
function inferPrimaryRoleForSurface(surface, context = {}) {
  const normalizedSurface = normalizeSurface(surface);
  const explicitRole = normalizeRoleId(context.roleId ?? context.primaryRole ?? context.currentContext?.primaryRole ?? context.packet?.ownerRole ?? context.packet?.nextRole);
  if (explicitRole && PRIMARY_ROLE_IDS.includes(explicitRole)) {
    return explicitRole;
  }
  const stage = normalizeWorkflowStage(context.stage ?? context.currentContext?.stage ?? context.packet?.stage, normalizedSurface);
  if (stage === "audit") {
    return "reviewer";
  }
  if (stage === "execute") {
    return "builder";
  }
  if (surfaceIn(normalizedSurface, ["review", "audit"])) {
    return "reviewer";
  }
  if (surfaceIn(normalizedSurface, ["auto", "figure", "experience", "draft", "source", "note", "document", "claim", "experiment", "rebuttal"])) {
    return "builder";
  }
  return "planner";
}
function inferSubagentSpecialty(surface, context = {}) {
  const explicit = canonicalSubagentId(context.subagentSpecialty ?? context.specialty ?? context.roleId ?? context.packet?.ownerRole ?? context.packet?.nextRole);
  if (explicit) {
    return explicit;
  }
  const normalizedSurface = normalizeSurface(surface);
  if (surfaceIn(normalizedSurface, ["source", "note", "claim", "draft"])) {
    return "researcher";
  }
  if (surfaceIn(normalizedSurface, ["experience", "experiment"])) {
    return context.stage === "audit" ? null : "experiment-planner";
  }
  if (surfaceIn(normalizedSurface, ["rebuttal", "revision"])) {
    return "revision-lead";
  }
  if (surfaceIn(normalizedSurface, ["version"])) {
    return "version-analyst";
  }
  return null;
}
function interpretedIntentForSurface(surface, context = {}, responseLanguage = "zh") {
  const request = normalizeString3(context.request, null);
  if (request) {
    return text(responseLanguage, `\u628A\u666E\u901A prompt \u201C${request}\u201D \u5148\u89E3\u91CA\u6210 Dove \u5F53\u524D\u9879\u76EE\u72B6\u6001\u3001\u89D2\u8272\u8FB9\u754C\u548C\u4E0B\u4E00\u6B65\u5DE5\u4F5C\u6D41\u3002`, `Interpret the ordinary prompt \u201C${request}\u201D as Dove project state, role boundary, and next workflow route first.`);
  }
  if (surface === "dove.status") {
    return text(responseLanguage, "\u5148\u8BFB\u53D6\u9879\u76EE\u72B6\u51B5\u4E3B\u9875\uFF0C\u518D\u51B3\u5B9A planner/builder/reviewer \u7684\u4E0B\u4E00\u6B65\u3002", "Read the project situation home first, then decide the planner/builder/reviewer next step.");
  }
  if (surface === "dove.mission") {
    return text(responseLanguage, "\u628A\u7528\u6237\u9700\u6C42\u8F6C\u6210 durable work contract\uFF0C\u800C\u4E0D\u662F\u628A mission \u5F53\u4F5C\u5217\u8868\u6216\u4E3B\u754C\u9762\u3002", "Convert the user demand into a durable work contract, not a mission list or primary UI.");
  }
  if (surface === "dove.auto") {
    return text(responseLanguage, "\u5728\u663E\u5F0F\u786E\u8BA4\u540E\u8FD0\u884C\u6709\u754C\u524D\u53F0\u6267\u884C\uFF0C\u5E76\u5728\u8FB9\u754C\u5904\u505C\u6B62\u8FD4\u56DE\u7ED3\u679C\u3002", "After explicit confirmation, run bounded foreground work and stop at boundaries with a returned result.");
  }
  if (surface === "dove.operator") {
    return text(responseLanguage, "\u7531 planner \u534F\u8C03 ready/blocked work\uFF0C\u5E76\u53EA\u6267\u884C\u663E\u5F0F\u786E\u8BA4\u7684\u4E00\u6B21\u524D\u53F0 pass\u3002", "Let the planner coordinate ready/blocked work and run only one explicitly confirmed foreground pass.");
  }
  if (surface === "dove.source") {
    return text(responseLanguage, "\u628A\u5DF2\u9A8C\u8BC1\u5916\u90E8\u94FE\u63A5\u3001\u6A21\u677F\u3001\u6307\u5357\u3001venue/ranking \u8BC1\u636E\u5148\u6CE8\u518C\u4E3A packet-bound sources\uFF1B\u672A\u6293\u53D6\u6216\u672A\u6CE8\u518C\u7684\u5019\u9009\u94FE\u63A5\u53EA\u80FD\u5217\u4E3A candidate links\uFF0C\u518D\u8FDB\u5165 note \u6216 document evidence \u7EFC\u5408\u6C89\u6DC0\u3002", "Register verified external links, templates, guidelines, and venue/ranking evidence as packet-bound sources first; unfetched or unregistered URLs stay as candidate links before synthesis through note or document evidence.");
  }
  if (surface === "dove.note") {
    return text(responseLanguage, "\u5DF2\u6709 summary\u3001quote\u3001claim \u6216 open question \u65F6\uFF0C\u76F4\u63A5\u628A\u5DF2\u6CE8\u518C sources \u7EFC\u5408\u6210\u7ED1\u5B9A\u4E3B\u4EFB\u52A1\u7684\u7ED3\u6784\u5316 note\uFF1B\u5185\u90E8\u538B\u529B\u6D4B\u8BD5\u603B\u7ED3\u548C\u5199\u4F5C\u504F\u597D\u4E0D\u8981\u4F2A\u88C5\u6210 external source\u3002", "When a summary, quote, claim, or open question is present, directly synthesize registered sources into a packet-bound structured note; internal pressure-test summaries and writing preferences must not be disguised as external sources.");
  }
  if (surface === "dove.draft") {
    return text(responseLanguage, "\u5DF2\u6709\u6B63\u6587\u65F6\uFF0C\u76F4\u63A5\u8BB0\u5F55 packet-bound draft body\uFF1B\u7F3A\u6B63\u6587\u65F6\u505C\u4E0B\u8981\u6C42 draft content\uFF0C\u4E0D\u521B\u5EFA\u5360\u4F4D\u8349\u7A3F\u3002", "When body content is present, directly record a packet-bound draft body; when body content is missing, stop for draft content instead of creating a placeholder draft.");
  }
  if (surface === "dove.document" || surface === "dove.documents") {
    return text(responseLanguage, "\u5DF2\u6709\u62A5\u544A\u6216\u4EA7\u7269\u6458\u8981/\u8DEF\u5F84\u65F6\uFF0C\u76F4\u63A5\u4F5C\u4E3A document evidence \u7ED1\u5B9A\u5230 durable packet\uFF0C\u5E76\u4FDD\u7559 source/artifact provenance\u3002", "When a report or output summary/path is present, directly bind it as document evidence to a durable packet while preserving source/artifact provenance.");
  }
  return text(responseLanguage, "\u5148\u7528\u4E09\u89D2\u8272\u548C lesson guardrail \u6846\u4F4F\u884C\u52A8\uFF0C\u518D\u8FDB\u5165\u5177\u4F53 Dove workflow\u3002", "Frame the action with the three roles and lesson guardrails before entering the concrete Dove workflow.");
}
function buildIntentFrame(surface, context = {}, responseLanguage = "zh") {
  const normalizedSurface = normalizeSurface(surface);
  return {
    ordinaryPromptFirst: true,
    interpretedIntent: interpretedIntentForSurface(normalizedSurface, context, responseLanguage),
    primaryEntry: "statusHome",
    missionAsWorkContract: true,
    noDedicatedMissionListCommand: true,
    statusAsCommandCenter: true,
    surface: normalizedSurface
  };
}
function commandFromNextAction(nextAction) {
  if (!nextAction) {
    return null;
  }
  if (typeof nextAction === "string") {
    return nextAction;
  }
  return normalizeString3(nextAction.command ?? nextAction.firstAction ?? nextAction.copyableCommand ?? nextAction.nextAction, null);
}
function titleFromNextAction(nextAction) {
  if (!nextAction) {
    return null;
  }
  if (typeof nextAction === "string") {
    return nextAction;
  }
  return normalizeString3(nextAction.title ?? nextAction.why ?? nextAction.command ?? nextAction.firstAction, null);
}
function workflowRouteForSurface(surface, command, responseLanguage = "zh") {
  if (command) {
    return command;
  }
  const route = {
    "dove.status": "query_dove_status",
    "dove.mission": "create_dove_task proposal -> materialized contract -> recommended handoff",
    "dove.auto": "run_dove_auto preview -> confirmed bounded foreground pass",
    "dove.operator": "run_dove_operator preview -> confirmed queue pass",
    "dove.review": "review/audit workflow with independent reviewer boundary",
    "dove.source": "register_source quick path for verified external provenance, keep candidate links separate, optionally batch -> upsert_note or record_document_evidence synthesis",
    "dove.note": "upsert_note quick path for packet-bound synthesis from registered sources -> claims or document evidence",
    "dove.draft": "upsert_draft quick path for an existing packet-bound draft body -> run_review_loop independent review",
    "dove.document": "record_document_evidence quick path for packet-bound report/archive ledger with source and artifact provenance",
    "dove.documents": "record_document_evidence quick path for packet-bound report/archive ledger with source and artifact provenance",
    "dove.figure": "figure materials -> generation/import -> caption/provenance -> QA",
    "dove.experience": "experiment plan/result -> audit -> claim bridge",
    "dove.rebuttal": "review issue board -> builder revision strategy -> response draft"
  }[surface];
  return route ?? text(responseLanguage, "\u5148 statusHome \u5206\u8BCA\uFF0C\u518D\u8FDB\u5165\u5BF9\u5E94 Dove workflow\u3002", "Triage through statusHome first, then enter the matching Dove workflow.");
}
function foregroundFlowForSurface(surface, responseLanguage = "zh") {
  if (surface === "dove.status") {
    return text(responseLanguage, "\u53EA\u8BFB command-center \u67E5\u8BE2\uFF1B\u4E0D\u5199\u5165\u3001\u4E0D\u5237\u65B0\u3001\u4E0D\u6267\u884C\u547D\u4EE4\u3002", "Read-only command-center query; no writes, refresh, or command execution.");
  }
  if (surface === "dove.mission") {
    return text(responseLanguage, "\u5148 proposal card\uFF0C\u786E\u8BA4\u540E\u53EA\u7269\u5316\u4EFB\u52A1\u5408\u540C\u5E76\u4EA4\u63A5\u63A8\u8350\u8DEF\u7EBF\uFF1Bmission \u672C\u8EAB\u4E0D\u6267\u884C pass\u3002", "Show a proposal card first; after confirmation only materialize the task contract and hand off recommended routes; mission itself does not run a pass.");
  }
  if (surface === "dove.auto") {
    return text(responseLanguage, "\u663E\u5F0F\u786E\u8BA4\u540E\u7684 bounded foreground loop\uFF1B\u5230\u8BC1\u636E\u3001\u8FB9\u754C\u6216\u9884\u7B97\u5373\u505C\u3002", "Explicitly confirmed bounded foreground loop; stop at evidence, boundary, or budget.");
  }
  if (surface === "dove.operator") {
    return text(responseLanguage, "\u663E\u5F0F\u786E\u8BA4\u7684\u4E00\u6B21\u961F\u5217\u534F\u8C03 pass\uFF1B\u4E0D\u542F\u52A8 scheduler \u6216 daemon\u3002", "One explicitly confirmed queue coordination pass; no scheduler or daemon.");
  }
  return text(responseLanguage, "\u663E\u5F0F\u5DE5\u5177\u8C03\u7528\u5185\u5B8C\u6210\u5F53\u524D workflow \u9636\u6BB5\uFF1B\u5199\u5165\u5FC5\u987B\u7ECF\u8FC7\u8BE5\u5DE5\u5177\u7684\u786E\u8BA4\u5951\u7EA6\u3002", "Complete the current workflow stage inside an explicit tool call; writes must follow that tool's confirmation contract.");
}
function gatesForSurface(surface, primaryRole, responseLanguage = "zh") {
  const common = [
    text(responseLanguage, "\u5148\u8BFB\u53D6\u81EA\u52A8\u53EC\u56DE\u7684 lessons\uFF0C\u53EA\u4F5C\u4E3A guardrail\u3002", "Read automatically recalled lessons first as guardrails only."),
    text(responseLanguage, "\u5199\u5165\u3001\u6267\u884C\u3001\u72B6\u6001\u8C03\u6574\u90FD\u5FC5\u987B\u663E\u5F0F\u786E\u8BA4\u3002", "Writes, execution, and status changes require explicit confirmation."),
    text(responseLanguage, "\u4E0D\u80FD\u542F\u52A8\u9690\u85CF\u540E\u53F0 runtime\u3002", "Do not start hidden background runtime.")
  ];
  if (primaryRole === "reviewer") {
    return [
      text(responseLanguage, "Reviewer \u5FC5\u987B\u72EC\u7ACB\u5BA1\u67E5\u8BC1\u636E\uFF0C\u4E0D\u80FD\u66FF builder \u81EA\u8BC1\u5B8C\u6574\u6027\u3002", "Reviewer must independently audit evidence and cannot self-certify builder completeness."),
      ...common
    ];
  }
  if (primaryRole === "builder") {
    return [
      text(responseLanguage, "Builder \u4EA7\u51FA\u5FC5\u987B\u5E26 evidence/provenance\uFF0C\u8FD4\u56DE\u540E\u4EA4 reviewer \u6216 status gate\u3002", "Builder output must carry evidence/provenance and return through reviewer or status gates."),
      ...common
    ];
  }
  return [
    text(responseLanguage, "Planner \u5148\u5B9A\u8303\u56F4\u3001\u4F18\u5148\u7EA7\u3001\u4E0B\u4E00\u6761 workflow route\uFF0C\u4E0D\u76F4\u63A5\u4F2A\u88C5\u6210\u6267\u884C\u7ED3\u679C\u3002", "Planner sets scope, priority, and the next workflow route first, without pretending execution happened."),
    ...common
  ];
}
function stopConditionsForSurface(surface, responseLanguage = "zh") {
  if (surface === "dove.status") {
    return [text(responseLanguage, "\u8FD4\u56DE\u9879\u76EE\u72B6\u51B5\u3001\u89D2\u8272\u8DEF\u7531\u3001lesson guardrails \u548C\u4E0B\u4E00\u6B65\uFF1B\u4E0D\u6267\u884C\u4E0B\u4E00\u6B65\u3002", "Return project state, role route, lesson guardrails, and next step; do not execute it.")];
  }
  return [
    text(responseLanguage, "\u9047\u5230\u7F3A\u8F93\u5165\u3001\u7F3A\u8BC1\u636E\u3001\u6743\u9650\u8FB9\u754C\u3001review gate \u6216\u9884\u7B97\u8017\u5C3D\u65F6\u505C\u6B62\u3002", "Stop on missing input, missing evidence, authority boundary, review gate, or budget exhaustion."),
    text(responseLanguage, "\u8FD4\u56DE result card / handoff / next action\uFF0C\u800C\u4E0D\u662F\u7EE7\u7EED\u9690\u85CF\u8FD0\u884C\u3002", "Return a result card, handoff, or next action instead of continuing hidden work.")
  ];
}
function executionGuidanceStopCondition({ readiness, coverage, statusExecutionGaps }, responseLanguage = "zh") {
  if (readiness && !readiness.ready) {
    return text(responseLanguage, "\u7F3A\u53EF\u6267\u884C\u5408\u540C\u65F6\u505C\u6B62\u5728 Planner\uFF0C\u4E0D\u8FDB\u5165 Builder \u6216 completion\u3002", "Stop at Planner when the executable contract is missing; do not enter Builder or completion.");
  }
  if (normalizeStringArray4(statusExecutionGaps?.missingMaterialTaskIds).length > 0) {
    return text(responseLanguage, "\u7F3A source/material/read-first \u8F93\u5165\u65F6\u505C\u6B62\u5E76\u8981\u6C42\u8865\u6750\u6599\u3002", "Stop and require materials when source/material/read-first inputs are missing.");
  }
  if (coverage && coverage.complete === false) {
    return text(responseLanguage, "convergence.criteria \u672A\u8986\u76D6\u65F6\u505C\u6B62\u5728 verification/reviewer gate\u3002", "Stop at the verification/reviewer gate when convergence.criteria are not covered.");
  }
  if (normalizeStringArray4(statusExecutionGaps?.verificationGapTaskIds).length > 0) {
    return text(responseLanguage, "\u5DF2\u6709\u7ED3\u679C\u4F46\u7F3A verifiedCriteria \u65F6\u505C\u6B62\u5728 Reviewer \u9A8C\u8BC1\u3002", "Stop at Reviewer verification when results exist but verifiedCriteria is missing.");
  }
  return text(responseLanguage, "\u4E0B\u4E00\u6B65\u53EA\u80FD\u6267\u884C\u5F53\u524D\u663E\u5F0F\u524D\u53F0 pass\uFF0C\u5E76\u8FD4\u56DE\u8BC1\u636E\u6216\u8FB9\u754C\u3002", "Run only the current explicit foreground pass next, returning evidence or a boundary.");
}
function buildExecutionGuidance(context = {}, primaryRole = "planner", responseLanguage = "zh") {
  const packet = normalizeObject3(context.packet);
  const statusExecutionGaps = normalizeObject3(context.statusSummary?.executionGaps);
  const hasPacket = Boolean(packet.id ?? packet.packetId ?? packet.taskPacketId);
  const contract = hasPacket ? normalizeDoveExecutionContract(packet.executionContract, null) : null;
  const readiness = hasPacket ? doveExecutionContractReadiness(contract) : null;
  const verifiedCriteria = hasPacket ? normalizeDoveVerifiedCriteria(packet.verifiedCriteria) : [];
  const coverage = hasPacket ? doveExecutionCriteriaCoverage(contract, verifiedCriteria) : null;
  const missingContractTaskIds = normalizeStringArray4(statusExecutionGaps.missingContractTaskIds);
  const missingMaterialTaskIds = normalizeStringArray4(statusExecutionGaps.missingMaterialTaskIds);
  const verificationGapTaskIds = normalizeStringArray4(statusExecutionGaps.verificationGapTaskIds);
  const readyBuilderTaskIds = normalizeStringArray4(statusExecutionGaps.readyBuilderTaskIds);
  const nextRole = !hasPacket && missingContractTaskIds.length > 0 ? "planner" : readiness && !readiness.ready ? "planner" : missingMaterialTaskIds.length > 0 ? "planner" : coverage?.complete === false || verificationGapTaskIds.length > 0 ? "reviewer" : readyBuilderTaskIds.length > 0 ? "builder" : primaryRole;
  return {
    executableContractPresent: hasPacket ? Boolean(contract) : missingContractTaskIds.length === 0 ? null : false,
    executableContractReady: hasPacket ? readiness?.ready === true : null,
    executionContractStatus: hasPacket ? readiness?.status ?? null : null,
    missingContractFields: hasPacket ? normalizeStringArray4(readiness?.missing) : [],
    missingContractTaskIds,
    missingMaterialTaskIds,
    verificationGapTaskIds,
    readyBuilderTaskIds,
    requiredMaterials: hasPacket ? normalizeStringArray4(readiness?.requiredMaterials) : normalizeStringArray4(statusExecutionGaps.requiredMaterials),
    evidenceRequired: hasPacket ? normalizeStringArray4(readiness?.evidenceRequired) : normalizeStringArray4(statusExecutionGaps.evidenceRequired),
    criteriaCoverage: coverage ? {
      complete: Boolean(coverage.complete),
      missing: normalizeStringArray4(coverage.missing),
      requiredCount: normalizeStringArray4(coverage.required).length
    } : null,
    nextRole,
    stopCondition: executionGuidanceStopCondition({ readiness, coverage, statusExecutionGaps }, responseLanguage)
  };
}
function buildWorkflowFrame(surface, context = {}, responseLanguage = "zh") {
  const normalizedSurface = normalizeSurface(surface);
  const currentStage = normalizeWorkflowStage(context.stage ?? context.currentContext?.stage ?? context.packet?.stage, normalizedSurface);
  const command = commandFromNextAction(context.nextAction ?? context.routeHint);
  const nextHumanAction = normalizeString3(context.nextHumanAction, null) ?? titleFromNextAction(context.nextAction) ?? command ?? workflowRouteForSurface(normalizedSurface, null, responseLanguage);
  const primaryRole = inferPrimaryRoleForSurface(normalizedSurface, context);
  const executionGuidance = buildExecutionGuidance(context, primaryRole, responseLanguage);
  return {
    currentStage,
    recommendedRoute: workflowRouteForSurface(normalizedSurface, command, responseLanguage),
    nextHumanAction,
    allowedForegroundFlow: foregroundFlowForSurface(normalizedSurface, responseLanguage),
    executionGuidance,
    gates: gatesForSurface(normalizedSurface, primaryRole, responseLanguage),
    stopConditions: [executionGuidance.stopCondition, ...stopConditionsForSurface(normalizedSurface, responseLanguage)]
  };
}
function lessonUpdatedAt(lesson = {}) {
  return String(lesson.updatedAt ?? lesson.createdAt ?? "");
}
function lessonRoleMatches(lessonRole, primaryRole) {
  const normalized = normalizeString3(lessonRole, null);
  if (!normalized || !primaryRole) {
    return false;
  }
  if (normalized === primaryRole) {
    return true;
  }
  return ROLE_HIERARCHY[normalized]?.parentRole === primaryRole;
}
function scoreLesson(lesson = {}, context = {}) {
  const matchedBecause = [];
  let score = 0;
  const packet = context.packet && typeof context.packet === "object" ? context.packet : {};
  const packetIds = normalizeStringArray4(lesson.packetIds);
  const linkedPacketIds = normalizeStringArray4([context.packetId, context.taskPacketId, packet.id, packet.packetId, packet.taskPacketId]);
  const linkedLessonIds = new Set(normalizeStringArray4(packet.lessonIds));
  const primaryRole = inferPrimaryRoleForSurface(context.surface ?? "dove.status", context);
  if (packetIds.some((packetId) => linkedPacketIds.includes(packetId))) {
    score += 100;
    matchedBecause.push("packet");
  }
  if (linkedLessonIds.has(lesson.id)) {
    score += 90;
    matchedBecause.push("packet-lesson-id");
  }
  if (lessonRoleMatches(lesson.actorRole ?? lesson.roleId, primaryRole)) {
    score += 40;
    matchedBecause.push("role");
  }
  const domain = normalizeString3(context.domain ?? context.currentContext?.domain ?? packet.domain ?? packet.doveDomain, null);
  if (domain && lesson.domain === domain) {
    score += 25;
    matchedBecause.push("domain");
  }
  const stage = normalizeWorkflowStage(context.stage ?? context.currentContext?.stage ?? packet.stage, context.surface ?? "dove.status");
  if (stage && normalizeWorkflowStage(lesson.stage, context.surface ?? "dove.status") === stage) {
    score += 20;
    matchedBecause.push("stage");
  }
  const contextTags = new Set(normalizeStringArray4([context.workflowKind, context.surface, context.domain, context.stage, ...Array.isArray(context.tags) ? context.tags : []]));
  const tagMatches = normalizeStringArray4(lesson.tags).filter((tag) => contextTags.has(tag));
  if (tagMatches.length > 0) {
    score += tagMatches.length * 8;
    matchedBecause.push(...tagMatches.map((tag) => `tag:${tag}`));
  }
  if (packetIds.length === 0) {
    score += 5;
    matchedBecause.push("global");
  }
  if (score === 0) {
    score = 1;
    matchedBecause.push("active");
  }
  return { score, matchedBecause: Array.from(new Set(matchedBecause)) };
}
function compactPreActionLesson(lesson = {}, matchInfo = {}) {
  const nextTimeCount = normalizeStringArray4(lesson.nextTime).length;
  return {
    id: lesson.id,
    title: lesson.title,
    matchedBecause: normalizeStringArray4(matchInfo.matchedBecause),
    mustObey: lesson.mustObey ?? true,
    nextTimeCount,
    hasNextTimeGuidance: nextTimeCount > 0,
    role: lesson.actorRole ?? null,
    domain: lesson.domain ?? null,
    stage: lesson.stage ?? null,
    tags: normalizeStringArray4(lesson.tags).slice(0, 5)
  };
}
function selectPreActionLessons(operatorLessons = {}, context = {}) {
  const lessons = Array.isArray(operatorLessons) ? operatorLessons : normalizeObjectArray2(operatorLessons.lessons);
  const limit = Math.min(FULL_LESSON_LIMIT, Math.max(0, Number.isFinite(context.lessonLimit) ? Math.floor(context.lessonLimit) : DEFAULT_LESSON_LIMIT));
  return lessons.filter((lesson) => String(lesson.status ?? "active").trim().toLowerCase() === "active").map((lesson) => ({ lesson, matchInfo: scoreLesson(lesson, context) })).sort((left, right) => right.matchInfo.score - left.matchInfo.score || lessonUpdatedAt(right.lesson).localeCompare(lessonUpdatedAt(left.lesson)) || String(left.lesson.id ?? "").localeCompare(String(right.lesson.id ?? ""))).slice(0, limit).map(({ lesson, matchInfo }) => compactPreActionLesson(lesson, matchInfo));
}
function buildRoleFrame(surface, context = {}, responseLanguage = "zh") {
  const primaryRole = inferPrimaryRoleForSurface(surface, context);
  return {
    primaryRole,
    primaryRoleLabel: roleLabel(primaryRole),
    roleReason: text(responseLanguage, `${roleLabel(primaryRole)} \u662F\u5F53\u524D\u5165\u53E3\u7684\u4E3B\u89D2\u8272\uFF1Bspecialty \u53EA\u4F5C\u4E3A\u8BE5\u4E3B\u89D2\u8272\u4E0B\u7684\u81EA\u52A8\u5B50\u80FD\u529B\u3002`, `${roleLabel(primaryRole)} is the primary role for this surface; specialties stay as automatic sub-capabilities under it.`),
    subagentSpecialty: inferSubagentSpecialty(surface, context),
    roleBoundaries: PRIMARY_ROLE_IDS.map((roleId) => roleBoundaryCard(roleId, responseLanguage))
  };
}
function buildPreActionGuidance({
  surface = "dove.status",
  responseLanguage = "zh",
  request = null,
  roleId = null,
  packet = null,
  currentContext = {},
  operatorLessons = {},
  nextAction = null,
  routeHint = null,
  workflowKind = null,
  domain = null,
  stage = null,
  statusSummary = null,
  lessonLimit = DEFAULT_LESSON_LIMIT,
  subagentSpecialty = null,
  nextHumanAction = null,
  tags = []
} = {}) {
  const normalizedSurface = normalizeSurface(surface);
  const context = {
    surface: normalizedSurface,
    responseLanguage,
    request,
    roleId: roleId ?? currentContext?.primaryRole ?? packet?.ownerRole ?? packet?.nextRole,
    packet,
    currentContext,
    nextAction,
    routeHint,
    workflowKind,
    domain: domain ?? currentContext?.domain ?? packet?.domain ?? packet?.doveDomain,
    stage: stage ?? currentContext?.stage ?? packet?.stage,
    statusSummary,
    lessonLimit,
    subagentSpecialty,
    nextHumanAction,
    tags
  };
  const roleFrame = buildRoleFrame(normalizedSurface, context, responseLanguage);
  const workflowFrame = buildWorkflowFrame(normalizedSurface, context, responseLanguage);
  return {
    version: 1,
    presentation: "dove-pre-action-guidance",
    surface: normalizedSurface,
    mode: "read-only-guidance",
    intentFrame: buildIntentFrame(normalizedSurface, context, responseLanguage),
    roleFrame,
    workflowFrame,
    lessonRecall: {
      automatic: true,
      readOnly: true,
      recordingExplicitOnly: true,
      lessonsPath: ARTIFACT_PATHS.metaOperatorLessons,
      topLessons: selectPreActionLessons(operatorLessons, { ...context, roleId: roleFrame.primaryRole })
    },
    referencePatterns: {
      learnedFrom: ["ARIS", "Trellis", "CodeStable", "oh-my-openagent", "AutoFigure-edit"],
      appliedPatterns: ["intent-gate", "stage-gates", "knowledge-compounding", "primary-role-routing", "artifact-provenance"]
    },
    guardrails: {
      explicitOnly: true,
      noHiddenRuntime: true,
      noAutoApply: true,
      requiresConfirmationForWrites: true,
      boundedForegroundOnly: true
    }
  };
}
function summarizePreActionGuidance(guidance = {}) {
  const topLessons = normalizeObjectArray2(guidance.lessonRecall?.topLessons);
  return {
    presentation: "dove-pre-action-guidance-summary",
    surface: guidance.surface ?? null,
    primaryRole: guidance.roleFrame?.primaryRole ?? null,
    primaryRoleLabel: guidance.roleFrame?.primaryRoleLabel ?? null,
    subagentSpecialty: guidance.roleFrame?.subagentSpecialty ?? null,
    nextHumanAction: guidance.workflowFrame?.nextHumanAction ?? null,
    executionNextRole: guidance.workflowFrame?.executionGuidance?.nextRole ?? null,
    executableContractReady: guidance.workflowFrame?.executionGuidance?.executableContractReady ?? null,
    stopCondition: guidance.workflowFrame?.executionGuidance?.stopCondition ?? null,
    lessonIds: topLessons.map((lesson) => lesson.id).filter(Boolean),
    noHiddenRuntime: guidance.guardrails?.noHiddenRuntime === true,
    requiresConfirmationForWrites: guidance.guardrails?.requiresConfirmationForWrites === true,
    recordingExplicitOnly: guidance.lessonRecall?.recordingExplicitOnly === true
  };
}

// src/core/artifact-integrity.mjs
import fs8 from "node:fs";
import path9 from "node:path";
import { inflateSync } from "node:zlib";
var DEFAULT_READ_LIMIT_BYTES = 24 * 1024;
var ARTIFACT_EVIDENCE_ROLES = /* @__PURE__ */ new Map([
  [ARTIFACT_PATHS.researchBrief, "conditional"],
  [ARTIFACT_PATHS.researchAgenda, "conditional"],
  [ARTIFACT_PATHS.plan, "conditional"],
  [ARTIFACT_PATHS.outline, "conditional"],
  [ARTIFACT_PATHS.findings, "conditional"],
  [ARTIFACT_PATHS.experimentLog, "conditional"],
  [ARTIFACT_PATHS.experimentPlans, "conditional"],
  [ARTIFACT_PATHS.experimentResults, "conditional"],
  [ARTIFACT_PATHS.experimentAudits, "conditional"],
  [ARTIFACT_PATHS.notes, "conditional"],
  [ARTIFACT_PATHS.evidence, "conditional"],
  [ARTIFACT_PATHS.claims, "conditional"],
  [ARTIFACT_PATHS.claimBridgeLog, "conditional"],
  [ARTIFACT_PATHS.reviewLog, "conditional"],
  [ARTIFACT_PATHS.reviewReport, "conditional"],
  [ARTIFACT_PATHS.reviewConcerns, "conditional"],
  [ARTIFACT_PATHS.reviewDebateLog, "conditional"],
  [ARTIFACT_PATHS.revisionPlan, "conditional"],
  [ARTIFACT_PATHS.wiki, "conditional"],
  [ARTIFACT_PATHS.bibliography, "conditional"],
  [ARTIFACT_PATHS.citationLog, "conditional"],
  [ARTIFACT_PATHS.figureBriefs, "conditional"],
  [ARTIFACT_PATHS.figureSegments, "conditional"],
  [ARTIFACT_PATHS.figureTemplates, "conditional"],
  [ARTIFACT_PATHS.figureEditableIndex, "conditional"],
  [ARTIFACT_PATHS.figureFinalIndex, "conditional"],
  [ARTIFACT_PATHS.figureMaterials, "conditional"],
  [ARTIFACT_PATHS.figureGenerations, "conditional"],
  [ARTIFACT_PATHS.figureCaptions, "conditional"],
  [ARTIFACT_PATHS.figureQa, "conditional"],
  [ARTIFACT_PATHS.rebuttalIssues, "conditional"],
  [ARTIFACT_PATHS.rebuttalStrategy, "conditional"],
  [ARTIFACT_PATHS.rebuttalResponseDraft, "conditional"],
  [ARTIFACT_PATHS.versionComparisons, "conditional"],
  [ARTIFACT_PATHS.versionComparisonReport, "conditional"]
]);
var BOOKKEEPING_ARTIFACT_PATHS = new Set(
  Object.values(ARTIFACT_PATHS).filter((artifactPath) => typeof artifactPath === "string" && artifactPath.startsWith(`${ARTIFACT_PATHS.doveRoot}/`) && path9.posix.extname(artifactPath).length > 0 && !ARTIFACT_EVIDENCE_ROLES.has(artifactPath))
);
var DYNAMIC_EVIDENCE_PATTERNS = [
  { pattern: /^\.dove\/drafts\/(?!README\.md$)[^/]+\.(?:md|txt|tex)$/u, role: "substantive" },
  { pattern: /^\.dove\/evidence\/(?!index\.json$).+$/u, role: "validation" },
  { pattern: /^\.dove\/(?:reviews\/isolated|audio\/reviews)\/[^/]+\/report\.md$/u, role: "conditional" },
  { pattern: /^\.dove\/figures\/(?!runs\/).+\.(?:final\.svg|png|jpe?g|pdf)$/iu, role: "conditional" }
];
var WORKFLOW_GOAL_COMPLETION_EVIDENCE_ROLES = /* @__PURE__ */ new Map([
  [".dove/evidence/workflow-goal-verification.log", "validation"],
  [".dove/evidence/workflow-goal-result.md", "substantive"]
]);
var DYNAMIC_COMPLETION_EVIDENCE_PATTERN = /^\.dove\/evidence\/(?!index\.json$).+$/u;
var COMPLETION_MEDIA_EXTENSIONS = /* @__PURE__ */ new Map([
  [".svg", "svg"],
  [".png", "png"],
  [".jpg", "jpeg"],
  [".jpeg", "jpeg"],
  [".pdf", "pdf"]
]);
var NEGATIVE_VALIDATION_STATUSES = /* @__PURE__ */ new Set([
  "author-response-submitted",
  "awaiting-author-response",
  "blocked",
  "challenged",
  "concern",
  "contested",
  "escalated",
  "failed",
  "failure",
  "held",
  "held-audit-blocked",
  "held-for-review",
  "held-missing-claim",
  "incomplete",
  "inconclusive",
  "invalid",
  "needs-evidence",
  "needs-review",
  "needs-revision",
  "negative",
  "needs-operator",
  "needs-rebuttal",
  "needs-source-verification",
  "not-ready",
  "not-reviewed",
  "open",
  "pending",
  "rejected",
  "unresolved"
]);
var POSITIVE_VALIDATION_STATUSES = /* @__PURE__ */ new Set([
  "applied",
  "approved",
  "clean",
  "coherent",
  "complete",
  "completed",
  "passed",
  "ready",
  "resolved",
  "verified"
]);
var REQUIREMENT_PURPOSE_PATTERNS = /* @__PURE__ */ new Map([
  ["audit", /\b(?:audit|audited|integrity)\b|审计|完整性/iu],
  ["bridge", /\b(?:bridge|bridged|claim mapping)\b|桥接|论点映射/iu],
  ["comparison", /\b(?:compare|comparison|diff|version delta)\b|比较|对比|版本差异/iu],
  ["qa", /\b(?:qa|quality assurance|quality check)\b|质量检查|质检/iu],
  ["review", /\b(?:review|reviewer|verdict|concern)\b|审查|评审|问题项/iu],
  ["validation", /\b(?:check|lint|test|typecheck|validat(?:e|ed|ion)|verif(?:y|ied|ication))\b|测试|校验|验证/iu],
  ["artifact", /\b(?:artifact|deliverable|draft|figure|implementation|output|report)\b|产物|交付物|草稿|图|实现|输出|报告/iu],
  ["evidence", /\b(?:evidence|log|result|source|citation)\b|证据|日志|结果|来源|引文/iu]
]);
var BOOKKEEPING_EVIDENCE_PATTERNS = [
  /^\.dove\/(?:public|orchestration|task-packets|context|sessions|workspace|programs|workflow-pack|runtime|mutations|meta)(?:\/|$)/u,
  /^\.dove\/wiki\/(?:query_pack|navigation)\.md$/u,
  /^\.dove\/wiki\/(?:entities|relations)\.json$/u,
  /^\.dove\/(?:reviews\/isolated|audio\/reviews)\/[^/]+\/(?!report\.md$).+/u,
  /^\.dove\/versions\/snapshots(?:\/|$)/u,
  /^\.dove\/figures\/runs(?:\/|$)/u
];
var CONDITIONAL_JSON_COLLECTION_FIELDS = /* @__PURE__ */ new Map([
  [ARTIFACT_PATHS.researchAgenda, ["agenda", "evidenceBacklog"]],
  [ARTIFACT_PATHS.experimentAudits, ["items"]],
  [ARTIFACT_PATHS.sources, ["items"]],
  [ARTIFACT_PATHS.notes, ["items"]],
  [ARTIFACT_PATHS.evidence, ["claims"]],
  [ARTIFACT_PATHS.claimBridgeLog, ["items"]],
  [ARTIFACT_PATHS.reviewConcerns, ["items"]],
  [ARTIFACT_PATHS.figureBriefs, ["items"]],
  [ARTIFACT_PATHS.figureSegments, ["items"]],
  [ARTIFACT_PATHS.figureTemplates, ["items"]],
  [ARTIFACT_PATHS.figureEditableIndex, ["items"]],
  [ARTIFACT_PATHS.figureFinalIndex, ["items"]],
  [ARTIFACT_PATHS.figureMaterials, ["items"]],
  [ARTIFACT_PATHS.figureGenerations, ["items"]],
  [ARTIFACT_PATHS.figureCaptions, ["items"]],
  [ARTIFACT_PATHS.figureQa, ["items", "issues"]],
  [ARTIFACT_PATHS.rebuttalIssues, ["items"]],
  [ARTIFACT_PATHS.versionComparisons, ["items"]]
]);
var BOOTSTRAP_MARKDOWN_PATTERNS = /* @__PURE__ */ new Map([
  [ARTIFACT_PATHS.researchBrief, [/Clarify the paper objective and contribution\./iu, /澄清论文目标与贡献。/u]],
  [ARTIFACT_PATHS.plan, [/Run `project:dove\.status`/iu, /运行 `project:dove\.status`/u]],
  [ARTIFACT_PATHS.outline, [/(?:Goal|Evidence): TBD/iu, /(?:目标|证据): 待定/u]],
  [ARTIFACT_PATHS.findings, [/Capture key empirical or analytical takeaways here/iu, /在转化为 claims 前，在此记录/u]],
  [ARTIFACT_PATHS.experimentLog, [/Document planned runs, settings, outcomes/iu, /在此记录计划运行、设置、结果/u]],
  [ARTIFACT_PATHS.claims, [/List only claims that can be traced/iu, /只列出可追溯到/u]],
  [ARTIFACT_PATHS.reviewLog, [/Starter review log created\./iu, /已创建 starter 审查日志。/u]],
  [ARTIFACT_PATHS.reviewDebateLog, [/Use this file to capture adversarial review rounds/iu, /用此文件以持久文本记录/u]],
  [ARTIFACT_PATHS.revisionPlan, [/No review loop has generated/iu, /尚未由 review loop 生成/u]],
  [ARTIFACT_PATHS.wiki, [/- TBD/iu, /- 待定/u]],
  [ARTIFACT_PATHS.citationLog, [/Track registration and verification status/iu, /在此跟踪 sources 的注册和验证状态/u]],
  [ARTIFACT_PATHS.rebuttalStrategy, [/No issue strategy has been generated/iu, /尚未生成 issue strategy/u]],
  [ARTIFACT_PATHS.rebuttalResponseDraft, [/Draft concise, evidence-backed responses here/iu, /在此起草简洁且有证据支撑的回应/u]],
  [ARTIFACT_PATHS.versionComparisonReport, [/No comparison has been generated/iu, /尚未生成 comparison/u]]
]);
function normalizeStringArray5(value) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return Array.from(new Set(values.map((item) => String(item).trim()).filter(Boolean)));
}
function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function normalizeLocalPath(value) {
  const normalized = normalizeProjectRelativePath(value);
  return normalized.ok ? normalized.normalizedPath : null;
}
function normalizeLocalPathArray(values) {
  return Array.from(new Set(normalizeStringArray5(values).map(normalizeLocalPath).filter(Boolean)));
}
function flattenPathFields(value, fields) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenPathFields(item, fields));
  }
  const source = plainObject(value);
  return fields.flatMap((field) => normalizeStringArray5(source[field]));
}
function explicitTaskLinkedPaths(task = {}) {
  const source = plainObject(task);
  const context = plainObject(source.context);
  const pathFields = [
    "artifactRefs",
    "artifactPaths",
    "artifacts",
    "outputPaths",
    "evidenceLinks",
    "evidencePaths",
    "validationEvidencePaths",
    "verificationEvidencePaths"
  ];
  return normalizeLocalPathArray([
    ...flattenPathFields([source, context], pathFields),
    ...flattenPathFields([source.verifiedCriteria, context.verifiedCriteria], ["evidencePaths"])
  ]);
}
function evidenceRequirementKind(value) {
  const requirement = String(value ?? "").trim();
  if (!requirement) {
    return "invalid";
  }
  if (isExternalArtifactReference(requirement)) {
    return "reference";
  }
  const normalized = normalizeProjectRelativePath(requirement);
  if (!normalized.ok) {
    return "invalid";
  }
  const looksNarrative = /\s|[，。；！？：]/u.test(normalized.normalizedPath);
  const pathLike = normalized.normalizedPath.startsWith(".") || !looksNarrative && normalized.normalizedPath.includes("/") || !looksNarrative && path9.posix.extname(normalized.normalizedPath).length > 0;
  return pathLike ? "reference" : "description";
}
function explicitContractLinkedPaths(executionContract = {}) {
  const contract = plainObject(executionContract);
  const materials = plainObject(contract.materials);
  const convergence = plainObject(contract.convergence);
  return normalizeLocalPathArray([
    ...flattenPathFields(contract.files, ["path", "target"]),
    ...normalizeStringArray5(materials.requiredArtifacts).filter((item) => evidenceRequirementKind(item) === "reference"),
    ...normalizeStringArray5(materials.artifactRefs).filter((item) => evidenceRequirementKind(item) === "reference"),
    ...normalizeStringArray5(convergence.evidenceRequired).filter((item) => evidenceRequirementKind(item) === "reference")
  ]);
}
function normalizeCompletionRequirements(value, source = "caller") {
  const values = Array.isArray(value) ? value : value === void 0 || value === null ? [] : [value];
  return values.map((item, index) => {
    if (typeof item === "string" && item.trim()) {
      const requirement2 = item.trim();
      return {
        id: `${source}-${index + 1}`,
        requirement: requirement2,
        purpose: null,
        evidencePaths: evidenceRequirementKind(requirement2) === "reference" ? normalizeLocalPathArray([requirement2]) : [],
        source
      };
    }
    const requirement = plainObject(item);
    const text3 = String(requirement.requirement ?? requirement.description ?? requirement.text ?? requirement.title ?? "").trim();
    if (!text3) {
      return null;
    }
    return {
      id: String(requirement.id ?? `${source}-${index + 1}`).trim(),
      requirement: text3,
      purpose: String(requirement.purpose ?? requirement.kind ?? "").trim() || null,
      evidencePaths: normalizeLocalPathArray(requirement.evidencePaths ?? requirement.paths),
      source
    };
  }).filter(Boolean);
}
function descriptiveContractRequirements(executionContract = {}) {
  return normalizeStringArray5(plainObject(executionContract).convergence?.evidenceRequired).filter((requirement) => evidenceRequirementKind(requirement) === "description");
}
function completionPolicyContext(options = {}) {
  const context = plainObject(options.context);
  const task = plainObject(context.task);
  const executionContract = plainObject(context.executionContract ?? task.executionContract);
  const requirements = [
    ...normalizeCompletionRequirements(context.requirements, "caller"),
    ...normalizeCompletionRequirements(context.evidenceRequirements, "caller-evidence"),
    ...normalizeCompletionRequirements(descriptiveContractRequirements(executionContract), "execution-contract")
  ];
  const taskLinkedPaths = explicitTaskLinkedPaths(task);
  const contractLinkedPaths = explicitContractLinkedPaths(executionContract);
  const requirementLinkedPaths = normalizeLocalPathArray(requirements.flatMap((requirement) => requirement.evidencePaths));
  const criterionLinkedPaths = normalizeLocalPathArray(
    flattenPathFields(context.verifiedCriteria, ["evidencePaths"])
  );
  return {
    task,
    executionContract,
    requirements,
    taskLinkedPaths,
    contractLinkedPaths,
    requirementLinkedPaths,
    criterionLinkedPaths,
    linkedPaths: /* @__PURE__ */ new Set([...taskLinkedPaths, ...contractLinkedPaths, ...requirementLinkedPaths, ...criterionLinkedPaths])
  };
}
function isExternalArtifactReference(value) {
  const text3 = String(value ?? "").trim();
  return /^https?:\/\/[^\s]+$/iu.test(text3) || /^(?:doi|arxiv|source):[^\s]+$/iu.test(text3) || /^10\.\d{4,9}\/[^\s]+$/u.test(text3);
}
function normalizeProjectRelativePath(rawPath) {
  const original = typeof rawPath === "string" ? rawPath.trim() : String(rawPath ?? "").trim();
  if (!original) {
    return { ok: false, path: original, reason: "empty path" };
  }
  if (original.includes("\0")) {
    return { ok: false, path: original, reason: "path contains a null byte" };
  }
  if (path9.isAbsolute(original) || /^[A-Za-z]:[\\/]/.test(original)) {
    return { ok: false, path: original, reason: "absolute paths are not inspected" };
  }
  if (/^[a-z][a-z0-9+.-]*:/iu.test(original)) {
    return { ok: false, path: original, reason: "unsupported or malformed external reference scheme" };
  }
  const normalizedPath = path9.posix.normalize(original.replace(/\\/g, "/"));
  if (normalizedPath === "." || normalizedPath === ".." || normalizedPath.startsWith("../")) {
    return { ok: false, path: original, normalizedPath, reason: "path escapes the project root" };
  }
  return { ok: true, path: original, normalizedPath };
}
function readBoundedText(fullPath, maxBytes = DEFAULT_READ_LIMIT_BYTES) {
  const descriptor = fs8.openSync(fullPath, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const bytesRead = fs8.readSync(descriptor, buffer, 0, maxBytes, 0);
    return {
      text: buffer.subarray(0, bytesRead).toString("utf8"),
      bytesRead
    };
  } finally {
    fs8.closeSync(descriptor);
  }
}
var EXPERIMENT_RESULT_OUTCOMES = /* @__PURE__ */ new Set(["supports", "refutes", "inconclusive", "failed", "pending"]);
var CONDITIONAL_JSON_VALIDATORS = /* @__PURE__ */ new Map([
  [ARTIFACT_PATHS.experimentPlans, (parsed) => Array.isArray(parsed?.items) && parsed.items.length > 0 && parsed.items.some((item) => typeof item?.methodology === "string" && item.methodology.trim().length > 0 && typeof item?.successMetric === "string" && item.successMetric.trim().length > 0)],
  [ARTIFACT_PATHS.experimentResults, (parsed) => Array.isArray(parsed?.items) && parsed.items.length > 0 && parsed.items.some((item) => {
    const outcome = String(item?.outcome ?? "").trim().toLowerCase();
    return EXPERIMENT_RESULT_OUTCOMES.has(outcome) && outcome !== "pending" && typeof item?.summary === "string" && item.summary.trim().length > 0;
  })]
]);
function conditionalJsonHasEvidence(relativePath, text3) {
  const fields = CONDITIONAL_JSON_COLLECTION_FIELDS.get(relativePath);
  const validator = CONDITIONAL_JSON_VALIDATORS.get(relativePath);
  if (!fields && !validator) {
    return null;
  }
  try {
    const parsed = JSON.parse(text3);
    return validator ? validator(parsed) : fields.some((field) => Array.isArray(parsed?.[field]) && parsed[field].length > 0);
  } catch {
    return false;
  }
}
function conditionalMarkdownHasEvidence(relativePath, text3) {
  const patterns = BOOTSTRAP_MARKDOWN_PATTERNS.get(relativePath);
  if (!patterns) {
    return null;
  }
  const normalizedText = String(text3 ?? "").trim();
  return normalizedText.length > 0 && !patterns.some((pattern) => pattern.test(normalizedText));
}
function inspectSemanticEvidence(relativePath, text3) {
  const role = artifactEvidenceRole(relativePath);
  if (["bookkeeping", "unsupported"].includes(role)) {
    return {
      role,
      satisfied: false,
      status: role,
      reason: role === "unsupported" ? "path is not an approved Dove completion-evidence artifact" : "path is a navigation, status, runtime, task, or ledger record rather than substantive work evidence"
    };
  }
  if (role !== "conditional") {
    return { role, satisfied: true, status: "existing", reason: null };
  }
  const jsonEvidence = conditionalJsonHasEvidence(relativePath, text3);
  const markdownEvidence = conditionalMarkdownHasEvidence(relativePath, text3);
  const satisfied = jsonEvidence ?? markdownEvidence ?? String(text3 ?? "").trim().length > 0;
  return satisfied ? { role, satisfied: true, status: "existing", reason: null } : {
    role,
    satisfied: false,
    status: "placeholder",
    reason: "path contains only bootstrap, placeholder, or semantically empty content"
  };
}
function readBoundedBuffer(fullPath, maxBytes = DEFAULT_READ_LIMIT_BYTES) {
  const descriptor = fs8.openSync(fullPath, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const bytesRead = fs8.readSync(descriptor, buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs8.closeSync(descriptor);
  }
}
function completionMediaFormat(relativePath) {
  return COMPLETION_MEDIA_EXTENSIONS.get(path9.posix.extname(String(relativePath ?? "")).toLowerCase()) ?? null;
}
function validSvgBuffer(buffer) {
  const text3 = buffer.toString("utf8").replace(/^﻿/u, "").trim();
  const documentText = text3.replace(/^<\?xml[^>]*>\s*/iu, "");
  if (!/^<svg\b/iu.test(documentText) || !/<\/svg\s*>\s*$/iu.test(documentText)) {
    return false;
  }
  if (/<!DOCTYPE|<!ENTITY|<script\b|\bon\w+\s*=|\b(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|data:|javascript:)/iu.test(documentText)) {
    return false;
  }
  const stack = [];
  const tagPattern = /<\/?([A-Za-z_][\w:.-]*)\b[^>]*>/gu;
  for (const match of documentText.matchAll(tagPattern)) {
    const token = match[0];
    const tag = match[1].toLowerCase();
    if (token.startsWith("</")) {
      if (stack.pop() !== tag) {
        return false;
      }
    } else if (!token.endsWith("/>")) {
      stack.push(tag);
    }
  }
  return stack.length === 0;
}
function crc32(buffer) {
  let crc = 4294967295;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc >>> 1 ^ (crc & 1 ? 3988292384 : 0);
    }
  }
  return (crc ^ 4294967295) >>> 0;
}
function pngPassDimensions(width, height, interlace) {
  if (interlace === 0) {
    return [{ width, height }];
  }
  const starts = [
    [0, 0, 8, 8],
    [4, 0, 8, 8],
    [0, 4, 4, 8],
    [2, 0, 4, 4],
    [0, 2, 2, 4],
    [1, 0, 2, 2],
    [0, 1, 1, 2]
  ];
  return starts.map(([startX, startY, stepX, stepY]) => ({
    width: width <= startX ? 0 : Math.ceil((width - startX) / stepX),
    height: height <= startY ? 0 : Math.ceil((height - startY) / stepY)
  }));
}
function validPngScanlines(buffer, width, height, bitsPerPixel, interlace) {
  const passes = pngPassDimensions(width, height, interlace).filter((pass) => pass.width > 0 && pass.height > 0);
  const expectedBytes = passes.reduce((total, pass) => total + pass.height * (Math.ceil(pass.width * bitsPerPixel / 8) + 1), 0);
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0 || expectedBytes > 64 * 1024 * 1024) {
    return false;
  }
  let inflated;
  try {
    inflated = inflateSync(buffer, { maxOutputLength: expectedBytes + 1 });
  } catch {
    return false;
  }
  if (inflated.length !== expectedBytes) {
    return false;
  }
  let offset = 0;
  for (const pass of passes) {
    const rowBytes = Math.ceil(pass.width * bitsPerPixel / 8);
    for (let row = 0; row < pass.height; row += 1) {
      if (inflated[offset] > 4) {
        return false;
      }
      offset += rowBytes + 1;
    }
  }
  return offset === inflated.length;
}
function validPngBuffer(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 57 || !buffer.subarray(0, 8).equals(signature)) {
    return false;
  }
  const allowedBitDepths = /* @__PURE__ */ new Map([
    [0, /* @__PURE__ */ new Set([1, 2, 4, 8, 16])],
    [2, /* @__PURE__ */ new Set([8, 16])],
    [3, /* @__PURE__ */ new Set([1, 2, 4, 8])],
    [4, /* @__PURE__ */ new Set([8, 16])],
    [6, /* @__PURE__ */ new Set([8, 16])]
  ]);
  const channelCounts = /* @__PURE__ */ new Map([[0, 1], [2, 3], [3, 1], [4, 2], [6, 4]]);
  const criticalChunkTypes = /* @__PURE__ */ new Set(["IHDR", "PLTE", "IDAT", "IEND"]);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  let sawIhdr = false;
  let sawPlte = false;
  let sawIdat = false;
  let closedIdatSequence = false;
  const idatChunks = [];
  while (offset + 12 <= buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > buffer.length) {
      return false;
    }
    const typeBuffer = buffer.subarray(offset + 4, offset + 8);
    const chunkType = typeBuffer.toString("ascii");
    if (!/^[A-Za-z]{4}$/u.test(chunkType)) {
      return false;
    }
    const storedCrc = buffer.readUInt32BE(dataEnd);
    if (crc32(Buffer.concat([typeBuffer, buffer.subarray(dataStart, dataEnd)])) !== storedCrc) {
      return false;
    }
    if (chunkType[0] === chunkType[0].toUpperCase() && !criticalChunkTypes.has(chunkType)) {
      return false;
    }
    if (!sawIhdr) {
      if (chunkType !== "IHDR" || chunkLength !== 13) {
        return false;
      }
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer[dataStart + 8];
      colorType = buffer[dataStart + 9];
      const compression = buffer[dataStart + 10];
      const filter = buffer[dataStart + 11];
      interlace = buffer[dataStart + 12];
      if (width <= 0 || height <= 0 || !allowedBitDepths.get(colorType)?.has(bitDepth) || compression !== 0 || filter !== 0 || ![0, 1].includes(interlace)) {
        return false;
      }
      sawIhdr = true;
    } else if (chunkType === "IHDR") {
      return false;
    } else if (chunkType === "PLTE") {
      if (sawPlte || sawIdat || chunkLength === 0 || chunkLength % 3 !== 0 || chunkLength > 768) {
        return false;
      }
      sawPlte = true;
    } else if (chunkType === "IDAT") {
      if (closedIdatSequence || chunkLength === 0) {
        return false;
      }
      sawIdat = true;
      idatChunks.push(buffer.subarray(dataStart, dataEnd));
    } else {
      if (sawIdat && chunkType !== "IEND") {
        closedIdatSequence = true;
      }
      if (chunkType === "IEND") {
        if (chunkLength !== 0 || chunkEnd !== buffer.length || !sawIdat || colorType === 3 && !sawPlte) {
          return false;
        }
        const bitsPerPixel = channelCounts.get(colorType) * bitDepth;
        return validPngScanlines(Buffer.concat(idatChunks), width, height, bitsPerPixel, interlace);
      }
    }
    offset = chunkEnd;
  }
  return false;
}
var JPEG_START_OF_FRAME_MARKERS = /* @__PURE__ */ new Set([
  192,
  193,
  194,
  195,
  197,
  198,
  199,
  201,
  202,
  203,
  205,
  206,
  207
]);
function validJpegBuffer(buffer) {
  if (buffer.length < 16 || buffer[0] !== 255 || buffer[1] !== 216) {
    return false;
  }
  let offset = 2;
  let sawSof = false;
  let sawSos = false;
  let sawEntropy = false;
  let sawDac = false;
  const quantizationTableIds = /* @__PURE__ */ new Set();
  const huffmanTableIds = /* @__PURE__ */ new Set();
  const requiredQuantizationTableIds = /* @__PURE__ */ new Set();
  const requiredHuffmanTableIds = /* @__PURE__ */ new Set();
  let frameComponents = /* @__PURE__ */ new Set();
  while (offset < buffer.length) {
    if (buffer[offset] !== 255) {
      return false;
    }
    while (offset < buffer.length && buffer[offset] === 255) {
      offset += 1;
    }
    if (offset >= buffer.length) {
      return false;
    }
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0 || marker === 216 || marker >= 208 && marker <= 215) {
      return false;
    }
    if (marker === 217) {
      return sawSof && sawSos && sawEntropy && offset === buffer.length;
    }
    if (marker === 1) {
      continue;
    }
    if (offset + 2 > buffer.length) {
      return false;
    }
    const segmentLength = buffer.readUInt16BE(offset);
    const segmentEnd = offset + segmentLength;
    if (segmentLength < 2 || segmentEnd > buffer.length) {
      return false;
    }
    if (marker === 219) {
      let tableOffset = offset + 2;
      while (tableOffset < segmentEnd) {
        const tableInfo = buffer[tableOffset];
        const precision = tableInfo >> 4;
        const tableId = tableInfo & 15;
        const tableBytes = precision === 0 ? 64 : precision === 1 ? 128 : 0;
        if (tableId > 3 || tableBytes === 0 || tableOffset + 1 + tableBytes > segmentEnd) {
          return false;
        }
        quantizationTableIds.add(tableId);
        tableOffset += 1 + tableBytes;
      }
      if (tableOffset !== segmentEnd) {
        return false;
      }
    }
    if (marker === 196) {
      let tableOffset = offset + 2;
      while (tableOffset < segmentEnd) {
        const tableInfo = buffer[tableOffset];
        const tableClass = tableInfo >> 4;
        const tableId = tableInfo & 15;
        if (tableClass > 1 || tableId > 3 || tableOffset + 17 > segmentEnd) {
          return false;
        }
        let symbolCount = 0;
        for (let index = 1; index <= 16; index += 1) {
          symbolCount += buffer[tableOffset + index];
        }
        if (symbolCount === 0 || tableOffset + 17 + symbolCount > segmentEnd) {
          return false;
        }
        huffmanTableIds.add(`${tableClass}:${tableId}`);
        tableOffset += 17 + symbolCount;
      }
      if (tableOffset !== segmentEnd) {
        return false;
      }
    }
    if (marker === 204) {
      sawDac = true;
    }
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (sawSof || segmentLength < 11) {
        return false;
      }
      const precision = buffer[offset + 2];
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      const componentCount = buffer[offset + 7];
      if (precision === 0 || width === 0 || height === 0 || componentCount === 0 || segmentLength !== 8 + 3 * componentCount) {
        return false;
      }
      frameComponents = /* @__PURE__ */ new Set();
      for (let index = 0; index < componentCount; index += 1) {
        const componentId = buffer[offset + 8 + 3 * index];
        const sampling = buffer[offset + 9 + 3 * index];
        const horizontalSampling = sampling >> 4;
        const verticalSampling = sampling & 15;
        const quantizationTableId = buffer[offset + 10 + 3 * index];
        if (frameComponents.has(componentId) || horizontalSampling === 0 || verticalSampling === 0 || quantizationTableId > 3) {
          return false;
        }
        frameComponents.add(componentId);
        requiredQuantizationTableIds.add(quantizationTableId);
      }
      sawSof = true;
    }
    if (marker !== 218) {
      offset = segmentEnd;
      continue;
    }
    if (!sawSof || segmentLength < 8) {
      return false;
    }
    const scanComponentCount = buffer[offset + 2];
    if (scanComponentCount === 0 || segmentLength !== 6 + 2 * scanComponentCount) {
      return false;
    }
    const scanComponents = /* @__PURE__ */ new Set();
    for (let index = 0; index < scanComponentCount; index += 1) {
      const componentId = buffer[offset + 3 + 2 * index];
      const tableSelectors = buffer[offset + 4 + 2 * index];
      const dcTableId = tableSelectors >> 4;
      const acTableId = tableSelectors & 15;
      if (!frameComponents.has(componentId) || scanComponents.has(componentId) || dcTableId > 3 || acTableId > 3) {
        return false;
      }
      scanComponents.add(componentId);
      requiredHuffmanTableIds.add(`0:${dcTableId}`);
      requiredHuffmanTableIds.add(`1:${acTableId}`);
    }
    if ([...requiredQuantizationTableIds].some((tableId) => !quantizationTableIds.has(tableId)) || !sawDac && [...requiredHuffmanTableIds].some((tableId) => !huffmanTableIds.has(tableId))) {
      return false;
    }
    sawSos = true;
    offset = segmentEnd;
    let scanBytes = 0;
    while (offset < buffer.length) {
      if (buffer[offset] !== 255) {
        scanBytes += 1;
        offset += 1;
        continue;
      }
      let markerOffset = offset + 1;
      while (markerOffset < buffer.length && buffer[markerOffset] === 255) {
        markerOffset += 1;
      }
      if (markerOffset >= buffer.length) {
        return false;
      }
      const scanMarker = buffer[markerOffset];
      if (scanMarker === 0) {
        scanBytes += 1;
        offset = markerOffset + 1;
        continue;
      }
      if (scanMarker >= 208 && scanMarker <= 215) {
        offset = markerOffset + 1;
        continue;
      }
      if (scanBytes > 0) {
        sawEntropy = true;
      }
      offset = markerOffset - 1;
      break;
    }
  }
  return false;
}
function validPdfBuffer(buffer) {
  const text3 = buffer.toString("latin1");
  if (!text3.startsWith("%PDF-") || !/\n%%EOF\s*$/u.test(text3)) {
    return false;
  }
  const startXrefMatch = /startxref\s+(\d+)\s+%%EOF\s*$/u.exec(text3);
  if (!startXrefMatch) {
    return false;
  }
  const xrefOffset = Number(startXrefMatch[1]);
  return Number.isSafeInteger(xrefOffset) && xrefOffset >= 0 && xrefOffset < buffer.length && text3.startsWith("xref", xrefOffset);
}
function completionMediaValidation(relativePath, fullPath, sizeBytes, maxBytes = DEFAULT_READ_LIMIT_BYTES) {
  const format = completionMediaFormat(relativePath);
  if (!format) {
    return null;
  }
  const requiredBytes = Math.max(maxBytes, Math.min(sizeBytes, 4 * 1024 * 1024));
  if (sizeBytes > requiredBytes) {
    return {
      satisfied: false,
      status: "malformed",
      reason: `${format.toUpperCase()} completion evidence exceeds the bounded structural validation limit`
    };
  }
  const buffer = readBoundedBuffer(fullPath, requiredBytes);
  const satisfied = format === "svg" ? validSvgBuffer(buffer) : format === "png" ? validPngBuffer(buffer) : format === "jpeg" ? validJpegBuffer(buffer) : validPdfBuffer(buffer);
  return satisfied ? { satisfied: true, status: "existing", reason: null } : {
    satisfied: false,
    status: "malformed",
    reason: `${format.toUpperCase()} completion evidence has a malformed or incomplete file structure`
  };
}
function artifactEvidenceRole(relativePath) {
  const normalized = normalizeProjectRelativePath(relativePath);
  if (!normalized.ok) {
    return "unsupported";
  }
  const normalizedPath = normalized.normalizedPath;
  if (!normalizedPath.startsWith(`${ARTIFACT_PATHS.doveRoot}/`)) {
    return "external-project";
  }
  const declaredRole = ARTIFACT_EVIDENCE_ROLES.get(normalizedPath);
  if (declaredRole) {
    return declaredRole;
  }
  const dynamicRole = DYNAMIC_EVIDENCE_PATTERNS.find(({ pattern }) => pattern.test(normalizedPath))?.role;
  if (dynamicRole) {
    return dynamicRole;
  }
  if (BOOKKEEPING_ARTIFACT_PATHS.has(normalizedPath) || BOOKKEEPING_EVIDENCE_PATTERNS.some((pattern) => pattern.test(normalizedPath))) {
    return "bookkeeping";
  }
  return "unsupported";
}
function isBookkeepingArtifactPath(relativePath) {
  return artifactEvidenceRole(relativePath) === "bookkeeping";
}
function inspectDeclaredPath(root, rawPath, options = {}) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath ?? null,
      status: "unsafe",
      exists: false,
      file: false,
      reason: normalized.reason
    };
  }
  const rootPath = path9.resolve(root);
  const fullPath = path9.resolve(rootPath, normalized.normalizedPath);
  const relativeToRoot = path9.relative(rootPath, fullPath);
  if (relativeToRoot.startsWith("..") || path9.isAbsolute(relativeToRoot)) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "unsafe",
      exists: false,
      file: false,
      reason: "resolved path escapes the project root"
    };
  }
  let realRootPath;
  let realFullPath;
  let canonicalRelativePath;
  let stat;
  try {
    realRootPath = fs8.realpathSync(rootPath);
    realFullPath = fs8.realpathSync(fullPath);
    const relativeToRealRoot = path9.relative(realRootPath, realFullPath);
    if (relativeToRealRoot === ".." || relativeToRealRoot.startsWith(`..${path9.sep}`) || path9.isAbsolute(relativeToRealRoot)) {
      return {
        path: normalized.path,
        normalizedPath: normalized.normalizedPath,
        status: "unsafe",
        exists: true,
        file: false,
        reason: "real path escapes the project root"
      };
    }
    canonicalRelativePath = relativeToRealRoot.split(path9.sep).join("/");
    stat = fs8.statSync(realFullPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        path: normalized.path,
        normalizedPath: normalized.normalizedPath,
        status: "missing",
        exists: false,
        file: false,
        reason: "path does not exist"
      };
    }
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "unreadable",
      exists: false,
      file: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
  if (stat.isDirectory()) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "directory",
      exists: true,
      file: false,
      sizeBytes: stat.size,
      reason: "path is a directory"
    };
  }
  if (!stat.isFile()) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "unsupported",
      exists: true,
      file: false,
      sizeBytes: stat.size,
      reason: "path is not a regular file"
    };
  }
  const declaredRole = artifactEvidenceRole(normalized.normalizedPath);
  const canonicalRole = artifactEvidenceRole(canonicalRelativePath);
  const baseItem = {
    path: normalized.path,
    normalizedPath: normalized.normalizedPath,
    canonicalRelativePath,
    evidenceRole: declaredRole,
    canonicalEvidenceRole: canonicalRole,
    status: "existing",
    exists: true,
    file: true,
    sizeBytes: stat.size
  };
  if (options.rejectBookkeeping) {
    const rejectedRole = [declaredRole, canonicalRole].find((role) => role === "bookkeeping" || options.requireSemanticEvidence === true && role === "unsupported");
    if (rejectedRole) {
      return {
        ...baseItem,
        status: rejectedRole,
        reason: rejectedRole === "unsupported" ? "path is not an approved Dove completion-evidence artifact" : "path is a navigation, status, runtime, task, or ledger record rather than substantive work evidence"
      };
    }
  }
  if (options.requireNonEmpty && stat.size <= 0) {
    return {
      ...baseItem,
      status: "empty",
      reason: "path is an empty file"
    };
  }
  const needsSemanticRead = options.requireSemanticEvidence === true && [declaredRole, canonicalRole].includes("conditional");
  const mediaRelativePath = options.mediaRelativePath ?? normalized.normalizedPath;
  const needsMediaValidation = options.requireValidMedia === true && Boolean(completionMediaFormat(mediaRelativePath) ?? completionMediaFormat(canonicalRelativePath));
  if (!options.readText && !needsSemanticRead && !needsMediaValidation) {
    return baseItem;
  }
  try {
    const mediaValidation = needsMediaValidation ? completionMediaValidation(
      completionMediaFormat(mediaRelativePath) ? mediaRelativePath : canonicalRelativePath,
      realFullPath,
      stat.size,
      options.maxBytes
    ) : null;
    if (mediaValidation && !mediaValidation.satisfied) {
      return {
        ...baseItem,
        status: mediaValidation.status,
        reason: mediaValidation.reason
      };
    }
    const read = options.readText || needsSemanticRead ? readBoundedText(realFullPath, options.maxBytes ?? DEFAULT_READ_LIMIT_BYTES) : null;
    const semanticInspection = needsSemanticRead ? inspectSemanticEvidence(
      canonicalRole === "conditional" ? canonicalRelativePath : normalized.normalizedPath,
      read?.text ?? ""
    ) : null;
    if (semanticInspection && !semanticInspection.satisfied) {
      return {
        ...baseItem,
        status: semanticInspection.status,
        reason: semanticInspection.reason,
        bytesRead: read?.bytesRead ?? 0,
        truncated: stat.size > (read?.bytesRead ?? 0)
      };
    }
    return {
      ...baseItem,
      ...options.readText ? { text: read?.text ?? "" } : {},
      ...read ? { bytesRead: read.bytesRead, truncated: stat.size > read.bytesRead } : {}
    };
  } catch (error) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "unreadable",
      exists: true,
      file: true,
      sizeBytes: stat.size,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}
function inspectProjectArtifact(root, rawPath, options = {}) {
  return inspectDeclaredPath(root, rawPath, options);
}
function publicPathInspection(item) {
  const { text: text3, ...publicItem } = item;
  return publicItem;
}
function summarizePathInspections(inspections) {
  const pathsWithStatus = (status) => inspections.filter((item) => item.status === status).map((item) => item.normalizedPath ?? item.path).filter(Boolean);
  const problemStatuses = /* @__PURE__ */ new Set(["missing", "unsafe", "unreadable", "directory", "unsupported", "unlinked", "empty", "malformed", "placeholder", "bookkeeping"]);
  return {
    declaredPaths: Array.from(new Set(inspections.map((item) => item.path).filter(Boolean))),
    inspectedPaths: Array.from(new Set(inspections.filter((item) => item.status !== "unsafe").map((item) => item.normalizedPath).filter(Boolean))),
    existingPaths: pathsWithStatus("existing"),
    missingPaths: pathsWithStatus("missing"),
    unsafePaths: pathsWithStatus("unsafe"),
    unreadablePaths: pathsWithStatus("unreadable"),
    directoryPaths: pathsWithStatus("directory"),
    unsupportedPaths: pathsWithStatus("unsupported"),
    unlinkedPaths: pathsWithStatus("unlinked"),
    emptyPaths: pathsWithStatus("empty"),
    malformedPaths: pathsWithStatus("malformed"),
    placeholderPaths: pathsWithStatus("placeholder"),
    bookkeepingPaths: pathsWithStatus("bookkeeping"),
    satisfied: inspections.some((item) => item.status === "existing"),
    problemCount: inspections.filter((item) => problemStatuses.has(item.status)).length,
    items: inspections.map(publicPathInspection)
  };
}
function inspectPathEvidence(root, paths, options = {}) {
  return summarizePathInspections(normalizeStringArray5(paths).map((item) => inspectDeclaredPath(root, item, options)));
}
function evidencePathProblemFlags(root, paths, options = {}) {
  const evidencePaths = normalizeStringArray5(paths);
  const localEvidencePaths = evidencePaths.filter((item) => !isExternalArtifactReference(item));
  const externalEvidenceRefs = evidencePaths.filter(isExternalArtifactReference);
  const pathEvidence = inspectPathEvidence(root, localEvidencePaths, {
    requireNonEmpty: true,
    rejectBookkeeping: true,
    requireSemanticEvidence: true,
    ...options
  });
  const flags = [];
  if (evidencePaths.length === 0) {
    flags.push("missing-evidence-links");
  } else if (localEvidencePaths.length === 0) {
    flags.push("missing-evidence-file");
  }
  if (pathEvidence.missingPaths.length > 0) flags.push("missing-evidence-file");
  if (pathEvidence.unsafePaths.length > 0) flags.push("unsafe-evidence-path");
  if (pathEvidence.unreadablePaths.length > 0) flags.push("unreadable-evidence-file");
  if (pathEvidence.directoryPaths.length > 0) flags.push("directory-evidence-file");
  if (pathEvidence.unsupportedPaths.length > 0) flags.push("unsupported-evidence-file");
  if (pathEvidence.emptyPaths.length > 0) flags.push("empty-evidence-file");
  if (pathEvidence.malformedPaths.length > 0) flags.push("malformed-evidence-file");
  if (pathEvidence.placeholderPaths.length > 0) flags.push("placeholder-evidence-file");
  if (pathEvidence.bookkeepingPaths.length > 0) flags.push("bookkeeping-evidence-file");
  return {
    evidencePaths,
    localEvidencePaths,
    externalEvidenceRefs,
    pathEvidence,
    flags: Array.from(new Set(flags)),
    satisfied: pathEvidence.satisfied && pathEvidence.problemCount === 0
  };
}
function pathProblems(summary) {
  return [
    ...summary.missingPaths,
    ...summary.unsafePaths,
    ...summary.unreadablePaths,
    ...summary.directoryPaths,
    ...summary.unsupportedPaths,
    ...summary.unlinkedPaths ?? [],
    ...summary.emptyPaths,
    ...summary.malformedPaths,
    ...summary.placeholderPaths,
    ...summary.bookkeepingPaths
  ];
}
function completionPathApproval(relativePath, canonicalRelativePath, policy) {
  const normalizedPath = normalizeLocalPath(relativePath);
  const canonicalPath = normalizeLocalPath(canonicalRelativePath) ?? normalizedPath;
  const workflowGoalRole = WORKFLOW_GOAL_COMPLETION_EVIDENCE_ROLES.get(normalizedPath) ?? null;
  if (workflowGoalRole && canonicalPath === normalizedPath) {
    return { approved: true, role: workflowGoalRole, linkage: "workflow-goal-fixed" };
  }
  if (policy.linkedPaths.has(normalizedPath)) {
    return {
      approved: true,
      role: artifactEvidenceRole(canonicalPath),
      linkage: policy.contractLinkedPaths.includes(normalizedPath) ? "execution-contract" : policy.requirementLinkedPaths.includes(normalizedPath) ? "requirement" : policy.criterionLinkedPaths.includes(normalizedPath) ? "verified-criterion" : "task"
    };
  }
  const role = artifactEvidenceRole(canonicalPath);
  if (DYNAMIC_COMPLETION_EVIDENCE_PATTERN.test(normalizedPath ?? "")) {
    return {
      approved: false,
      role,
      linkage: null,
      reason: "dynamic .dove/evidence paths require an exact task, execution-contract, or requirement link"
    };
  }
  if (role === "external-project") {
    return {
      approved: false,
      role,
      linkage: null,
      reason: "repository files outside .dove require an exact task, execution-contract, or requirement link"
    };
  }
  return { approved: true, role, linkage: "approved-dove-role" };
}
function applyCompletionPathPolicy(root, inspection, policy, inspectOptions) {
  if (inspection.status !== "existing") {
    return inspection;
  }
  const rejectedRole = [inspection.evidenceRole, inspection.canonicalEvidenceRole].find((role) => role === "bookkeeping") ?? ([inspection.evidenceRole, inspection.canonicalEvidenceRole].every((role) => role === "unsupported") ? "unsupported" : null);
  if (rejectedRole) {
    return {
      ...inspection,
      status: rejectedRole,
      reason: rejectedRole === "unsupported" ? "path is not an approved Dove completion-evidence artifact" : "path is a navigation, status, runtime, task, or ledger record rather than substantive work evidence"
    };
  }
  const approval = completionPathApproval(
    inspection.normalizedPath,
    inspection.canonicalRelativePath,
    policy
  );
  if (!approval.approved) {
    return {
      ...inspection,
      status: "unlinked",
      completionEvidenceRole: approval.role,
      completionLinkage: null,
      reason: approval.reason
    };
  }
  const mediaFormat = completionMediaFormat(inspection.normalizedPath) ?? completionMediaFormat(inspection.canonicalRelativePath);
  if (mediaFormat) {
    const mediaInspection = inspectDeclaredPath(root, inspection.normalizedPath, {
      ...inspectOptions,
      requireValidMedia: true,
      mediaRelativePath: inspection.normalizedPath
    });
    if (mediaInspection.status !== "existing") {
      return {
        ...mediaInspection,
        completionEvidenceRole: approval.role,
        completionLinkage: approval.linkage
      };
    }
  }
  return {
    ...inspection,
    completionEvidenceRole: approval.role,
    completionLinkage: approval.linkage
  };
}
function completionPathEvidence(root, paths, policy, inspectOptions) {
  const inspections = normalizeStringArray5(paths).map((item) => {
    const inspection = inspectDeclaredPath(root, item, {
      ...inspectOptions,
      rejectBookkeeping: false
    });
    return applyCompletionPathPolicy(root, inspection, policy, inspectOptions);
  });
  const summary = summarizePathInspections(inspections);
  return {
    ...summary,
    items: inspections.map(publicPathInspection)
  };
}
function completionPathProblems(summary) {
  return pathProblems(summary);
}
function criterionExpectsNegativeOutcome(value) {
  const criterion = String(value ?? "").trim();
  return /^(?:blocked|failed|held|negative|rejected|unresolved|incomplete)\b/iu.test(criterion) || /\b(?:must|should|is|remains?|returns?|records?|reports?|shows?|surfaces?)\s+(?:be\s+)?(?:blocked|failed|held|negative|rejected|unresolved|incomplete)\b/iu.test(criterion) || /\b(?:reject|block|hold|surface|report|record)\w*\b[^.]{0,80}\b(?:failure|blocked|failed|held|negative|rejected|unresolved|incomplete)\b/iu.test(criterion);
}
function positiveCriterion(criterion) {
  const status = String(criterion?.status ?? "").trim().toLowerCase();
  return ["met", "passed", "verified"].includes(status) && !criterionExpectsNegativeOutcome(criterion?.criterion);
}
function normalizedStatus(value) {
  return String(value ?? "").trim().toLowerCase();
}
function collectValidationSignals(value, pointer = "$", depth = 0, seen = /* @__PURE__ */ new Set()) {
  if (depth > 8 || value === null || value === void 0) {
    return [];
  }
  if (typeof value !== "object") {
    return [];
  }
  if (seen.has(value)) {
    return [];
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectValidationSignals(item, `${pointer}[${index}]`, depth + 1, seen));
  }
  const signals = [];
  for (const [key, item] of Object.entries(value)) {
    const itemPointer = `${pointer}.${key}`;
    const normalizedKey = key.toLowerCase();
    if (typeof item === "string" && (/(?:status|verdict|readiness)$/u.test(normalizedKey) || /(?:validation|verification|qa|review|comparison)(?:outcome|mapping)$/u.test(normalizedKey))) {
      const status = normalizedStatus(item);
      if (NEGATIVE_VALIDATION_STATUSES.has(status) || POSITIVE_VALIDATION_STATUSES.has(status)) {
        signals.push({ pointer: itemPointer, field: key, status });
      }
    }
    if (typeof item === "boolean" && /(?:complete|completed|passed|ready|resolved|satisfied|valid)$/u.test(normalizedKey)) {
      signals.push({ pointer: itemPointer, field: key, status: item ? "positive" : "incomplete" });
    }
    if (Array.isArray(item) && item.length > 0 && /(?:issues|openissues|openissueids|unresolved|unresolvedconcerns|unresolvedconcernids|integrityflags|missing|missingartifactrefs|missingrequirementids)$/u.test(normalizedKey.replace(/[^a-z]/gu, ""))) {
      signals.push({ pointer: itemPointer, field: key, status: "unresolved", count: item.length });
    }
    if (item && typeof item === "object") {
      signals.push(...collectValidationSignals(item, itemPointer, depth + 1, seen));
    }
  }
  return signals;
}
function parseValidationArtifact(item) {
  if (item.status !== "existing") {
    return null;
  }
  const canonicalPath = item.canonicalRelativePath ?? item.normalizedPath;
  if (path9.posix.extname(canonicalPath ?? "").toLowerCase() !== ".json") {
    return null;
  }
  try {
    return JSON.parse(item.text ?? "");
  } catch {
    return null;
  }
}
function structuredTextValidationSignals(text3) {
  const signals = [];
  const lines = String(text3 ?? "").split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const fieldMatch = /^[-*]?\s*(?:qa\s+)?(?:status|verdict|outcome|readiness|mapping|review verdict|comparison status|audit verdict|bridge status)\s*:\s*([^\s,;]+)/iu.exec(line);
    if (fieldMatch) {
      const status = normalizedStatus(fieldMatch[1]);
      if (NEGATIVE_VALIDATION_STATUSES.has(status) || POSITIVE_VALIDATION_STATUSES.has(status)) {
        signals.push({ pointer: `$text[${index + 1}]`, field: "structured-text", status });
      }
    }
    const unresolvedMatch = /^[-*]?\s*(?:unresolved concerns?|open issues?)\s*:\s*(.+)$/iu.exec(line);
    if (unresolvedMatch && !/^(?:none|no(?:ne)?|0|\[\])\.?$/iu.test(unresolvedMatch[1].trim())) {
      signals.push({ pointer: `$text[${index + 1}]`, field: "structured-text", status: "unresolved" });
    }
  }
  return signals;
}
function negativeOutcomeInspection(root, criterion, pathEvidence, inspectOptions) {
  if (!positiveCriterion(criterion)) {
    return { contradictory: false, paths: [], signals: [] };
  }
  const negativePaths = [];
  const signals = [];
  for (const item of pathEvidence.items ?? []) {
    if (item.status !== "existing") {
      continue;
    }
    const canonicalPath = item.canonicalRelativePath ?? item.normalizedPath;
    const role = item.completionEvidenceRole ?? artifactEvidenceRole(canonicalPath);
    if (!["conditional", "validation"].includes(role)) {
      continue;
    }
    const withText = inspectDeclaredPath(root, item.normalizedPath, { ...inspectOptions, readText: true });
    const parsed = parseValidationArtifact(withText);
    const itemSignals = parsed ? collectValidationSignals(parsed) : structuredTextValidationSignals(withText.text);
    const negativeSignals = itemSignals.filter((signal) => NEGATIVE_VALIDATION_STATUSES.has(signal.status));
    if (negativeSignals.length > 0) {
      negativePaths.push(item.normalizedPath);
      signals.push(...negativeSignals.map((signal) => ({ ...signal, path: item.normalizedPath })));
    }
  }
  return {
    contradictory: negativePaths.length > 0,
    paths: Array.from(new Set(negativePaths)),
    signals
  };
}
function requirementPurpose(requirement) {
  if (requirement.purpose) {
    return requirement.purpose.toLowerCase();
  }
  return Array.from(REQUIREMENT_PURPOSE_PATTERNS.entries()).find(([, pattern]) => pattern.test(requirement.requirement))?.[0] ?? "unspecified";
}
function evidencePurpose(item) {
  const relativePath = String(item.canonicalRelativePath ?? item.normalizedPath ?? "");
  if (relativePath === ARTIFACT_PATHS.experimentAudits) return "audit";
  if (relativePath === ARTIFACT_PATHS.claimBridgeLog) return "bridge";
  if (relativePath === ARTIFACT_PATHS.figureQa) return "qa";
  if ([ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.reviewReport, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.reviewDebateLog].includes(relativePath)) return "review";
  if ([ARTIFACT_PATHS.versionComparisons, ARTIFACT_PATHS.versionComparisonReport].includes(relativePath)) return "comparison";
  const role = item.completionEvidenceRole ?? item.evidenceRole;
  if (role === "validation") return "validation";
  if (role === "substantive" || role === "external-project") return "artifact";
  return "evidence";
}
function requirementCoverage(policy, pathEvidence) {
  const available = (pathEvidence.items ?? []).filter((item) => item.status === "existing");
  const usedEvidenceFiles = /* @__PURE__ */ new Set();
  const coverage = policy.requirements.map((requirement) => {
    const requiredPurpose = requirementPurpose(requirement);
    const exactPaths = new Set(requirement.evidencePaths);
    const matched = available.find((item) => {
      const evidenceFile = item.canonicalRelativePath ?? item.normalizedPath;
      if (usedEvidenceFiles.has(evidenceFile)) {
        return false;
      }
      if (exactPaths.size > 0) {
        return exactPaths.has(item.normalizedPath);
      }
      const itemPurpose = evidencePurpose(item);
      return requiredPurpose === "unspecified" ? false : requiredPurpose === itemPurpose || requiredPurpose === "evidence" && ["artifact", "validation"].includes(itemPurpose);
    });
    if (matched) {
      usedEvidenceFiles.add(matched.canonicalRelativePath ?? matched.normalizedPath);
    }
    return {
      id: requirement.id,
      requirement: requirement.requirement,
      purpose: requiredPurpose,
      source: requirement.source,
      requiredEvidencePaths: requirement.evidencePaths,
      covered: Boolean(matched),
      evidencePath: matched?.normalizedPath ?? null,
      evidencePurpose: matched ? evidencePurpose(matched) : null
    };
  });
  return {
    coverage,
    uncoveredRequirements: coverage.filter((item) => !item.covered),
    coveredRequirements: coverage.filter((item) => item.covered)
  };
}
function completionEvidenceIntegrity(root, evidence = {}, options = {}) {
  const inspectOptions = {
    requireNonEmpty: true,
    rejectBookkeeping: true,
    requireSemanticEvidence: true,
    ...options.inspectOptions ?? {}
  };
  const policy = completionPolicyContext(options);
  const eligibleSourceReferences = new Set(normalizeStringArray5(options.context?.eligibleSourceReferences));
  const evidencePaths = normalizeStringArray5(evidence.evidencePaths);
  const localEvidencePaths = evidencePaths.filter((item) => !isExternalArtifactReference(item));
  const externalEvidenceRefs = evidencePaths.filter(isExternalArtifactReference);
  const sourceEvidenceRefs = externalEvidenceRefs.filter((item) => item.startsWith("source:"));
  const eligibleSourceEvidenceRefs = sourceEvidenceRefs.filter((item) => eligibleSourceReferences.has(item));
  const pathEvidence = completionPathEvidence(root, localEvidencePaths, policy, inspectOptions);
  const criteria = (Array.isArray(evidence.verifiedCriteria) ? evidence.verifiedCriteria : []).map((criterion) => {
    const criterionEvidencePaths = normalizeStringArray5(criterion?.evidencePaths);
    const criterionLocalEvidencePaths = criterionEvidencePaths.filter((item) => !isExternalArtifactReference(item));
    const criterionExternalEvidenceRefs = criterionEvidencePaths.filter(isExternalArtifactReference);
    const criterionEligibleSourceEvidenceRefs = criterionExternalEvidenceRefs.filter((item) => item.startsWith("source:")).filter((item) => eligibleSourceReferences.has(item));
    const criterionPathEvidence = completionPathEvidence(root, criterionLocalEvidencePaths, policy, inspectOptions);
    const negativeOutcome = negativeOutcomeInspection(root, criterion, criterionPathEvidence, inspectOptions);
    return {
      criterion: criterion?.criterion ?? null,
      status: criterion?.status ?? null,
      evidencePaths: criterionEvidencePaths,
      localEvidencePaths: criterionLocalEvidencePaths,
      externalEvidenceRefs: criterionExternalEvidenceRefs,
      eligibleSourceEvidenceRefs: criterionEligibleSourceEvidenceRefs,
      pathEvidence: criterionPathEvidence,
      negativeOutcome,
      satisfied: (criterionPathEvidence.satisfied || criterionEligibleSourceEvidenceRefs.length > 0) && criterionPathEvidence.problemCount === 0 && negativeOutcome.contradictory === false,
      problemPaths: completionPathProblems(criterionPathEvidence)
    };
  });
  const missingCriteriaEvidence = criteria.filter((item) => !item.satisfied);
  const problemPaths = completionPathProblems(pathEvidence);
  const requirementIntegrity = requirementCoverage(policy, pathEvidence);
  const uncoveredRequirements = requirementIntegrity.uncoveredRequirements;
  const existingEvidencePaths = pathEvidence.existingPaths.filter((item) => !(pathEvidence.unlinkedPaths ?? []).includes(item));
  const substantiveEvidencePaths = [...existingEvidencePaths, ...eligibleSourceEvidenceRefs];
  return {
    declaredPaths: evidencePaths,
    localEvidencePaths,
    externalEvidenceRefs,
    eligibleSourceEvidenceRefs,
    pathEvidence,
    existingEvidencePaths,
    substantiveEvidencePaths,
    problemPaths,
    criteria,
    missingCriteriaEvidence,
    requirementCoverage: requirementIntegrity.coverage,
    coveredRequirements: requirementIntegrity.coveredRequirements,
    uncoveredRequirements,
    semanticContext: {
      taskId: policy.task.id ?? policy.task.packetId ?? null,
      taskLinkedPaths: policy.taskLinkedPaths,
      contractLinkedPaths: policy.contractLinkedPaths,
      requirementLinkedPaths: policy.requirementLinkedPaths
    },
    satisfied: (pathEvidence.satisfied || eligibleSourceEvidenceRefs.length > 0) && missingCriteriaEvidence.length === 0 && problemPaths.length === 0 && uncoveredRequirements.length === 0,
    hasSubstantiveEvidence: substantiveEvidencePaths.length > 0 && problemPaths.length === 0
  };
}

// src/core/orchestration.mjs
function classifyWorkflowIntent({ phase, tasks = [], blockers = [] } = {}) {
  const hasOpenBlockers = blockers.some((blocker) => blocker.status !== "resolved" && blocker.status !== "retired");
  if (hasOpenBlockers) {
    return "repair";
  }
  switch (phase) {
    case "sources":
    case "notes":
    case "research":
      return "research";
    case "plan":
    case "outline":
      return "plan";
    case "draft":
      return tasks.some((task) => task.status === "done") ? "review" : "write";
    case "experiments":
      return "experiment";
    case "review":
      return "review";
    case "rebuttal":
      return "respond";
    case "versions":
      return "version";
    case "checklist":
      return "finalize";
    default:
      return "plan";
  }
}

// src/core/source-trust.mjs
import crypto7 from "node:crypto";
var SOURCE_LIFECYCLE_STATES = Object.freeze(["candidate", "verified", "rejected"]);
function normalizeText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "";
}
function normalizeIdentityText(value) {
  return normalizeText(value).normalize("NFKC").toLowerCase();
}
function normalizeDoi(value) {
  const text3 = normalizeIdentityText(value).replace(/^https?:\/\/(?:dx\.)?doi\.org\//u, "");
  return text3.startsWith("10.") ? text3 : "";
}
function normalizeUrl(value) {
  const text3 = normalizeText(value);
  if (!text3) return "";
  try {
    const parsed = new URL(text3);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    if (parsed.protocol === "https:" && parsed.port === "443" || parsed.protocol === "http:" && parsed.port === "80") parsed.port = "";
    return parsed.toString();
  } catch {
    return "";
  }
}
function sourceDoi(source = {}) {
  return normalizeDoi(source.doi) || normalizeDoi(source.url) || normalizeDoi(source.locator);
}
function sourceUrl(source = {}) {
  return normalizeUrl(source.url) || normalizeUrl(source.locator);
}
function canonicalSourceIdentity(source = {}) {
  return {
    doi: sourceDoi(source),
    url: sourceUrl(source),
    locator: normalizeIdentityText(source.locator),
    title: normalizeIdentityText(source.title),
    authors: (Array.isArray(source.authors) ? source.authors : []).map(normalizeIdentityText).filter(Boolean).sort()
  };
}
function sourceIdentityFingerprint(source = {}) {
  return crypto7.createHash("sha256").update(JSON.stringify(canonicalSourceIdentity(source))).digest("hex");
}
function readSourceTrustState(root) {
  const sources = readJson(root, ARTIFACT_PATHS.sources, { version: 2, items: [], updatedAt: null });
  const verifications = readJson(root, ARTIFACT_PATHS.sourceVerifications, { version: 1, items: [], updatedAt: null });
  return { sources, verifications };
}
function sourceReferenceMap(sources = []) {
  return new Map(sources.flatMap((source) => [
    source.id ? [source.id, source] : null,
    source.citationKey ? [source.citationKey, source] : null,
    source.locator ? [source.locator, source] : null,
    source.url ? [source.url, source] : null,
    source.doi ? [source.doi, source] : null
  ].filter(Boolean)));
}
function sourceEligibility(source, verifications = []) {
  if (!source) return { eligible: false, reason: "unknown-source", source: null, verification: null };
  const verification = [...verifications].reverse().find((item) => item.sourceId === source.id) ?? null;
  if (!verification) return { eligible: false, reason: `source-${source.lifecycle ?? "candidate"}`, source, verification: null };
  if (verification.decision !== "verified") {
    return { eligible: false, reason: `source-${verification.decision ?? source.lifecycle ?? "candidate"}`, source, verification };
  }
  const fingerprint = sourceIdentityFingerprint(source);
  if (verification.fingerprint !== fingerprint) {
    return { eligible: false, reason: "source-identity-changed", source, verification };
  }
  const sourcePacketIds = new Set(Array.isArray(source.packetIds) ? source.packetIds : []);
  if (!verification.packetId || !sourcePacketIds.has(verification.packetId)) {
    return { eligible: false, reason: "source-packet-binding-mismatch", source, verification };
  }
  return { eligible: true, reason: "verified-source", source, verification };
}
function evaluateSourceReferences(root, references = []) {
  const { sources, verifications } = readSourceTrustState(root);
  const byReference = sourceReferenceMap(sources.items ?? []);
  return references.map((reference) => {
    const source = byReference.get(reference) ?? null;
    return { reference, ...sourceEligibility(source, verifications.items ?? []) };
  });
}
function querySources(root, args = {}) {
  const { sources, verifications } = readSourceTrustState(root);
  const sourceId = normalizeText(args.sourceId ?? args.id);
  const packetId = normalizeText(args.packetId ?? args.taskPacketId ?? args.missionPacketId);
  const lifecycle = normalizeText(args.lifecycle).toLowerCase();
  const limit = Math.min(200, Math.max(1, Number.isFinite(Number(args.limit)) ? Math.trunc(Number(args.limit)) : 50));
  const items = (sources.items ?? []).filter((source) => !sourceId || [source.id, source.citationKey, source.locator, source.url, source.doi].includes(sourceId)).filter((source) => !packetId || (source.packetIds ?? []).includes(packetId)).map((source) => {
    const eligibility = sourceEligibility(source, verifications.items ?? []);
    return {
      ...source,
      eligibility: {
        eligible: eligibility.eligible,
        reason: eligibility.reason,
        verificationId: eligibility.verification?.id ?? null,
        decision: eligibility.verification?.decision ?? null,
        packetId: eligibility.verification?.packetId ?? null,
        checkedAt: eligibility.verification?.checkedAt ?? null
      }
    };
  }).filter((source) => !lifecycle || source.eligibility.decision === lifecycle || source.lifecycle === lifecycle).slice(0, limit);
  return {
    status: items.length > 0 ? "ok" : "empty",
    sourceCount: items.length,
    items,
    bookkeeping: [ARTIFACT_PATHS.sources, ARTIFACT_PATHS.sourceVerifications]
  };
}
function assertEligibleSourceReferences(root, references = [], label = "Evidence") {
  const evaluations = evaluateSourceReferences(root, references);
  const failures = evaluations.filter((item) => !item.eligible);
  if (failures.length > 0) {
    throw new Error(`${label} requires verified sources with matching identity fingerprints: ${failures.map((item) => `${item.reference} (${item.reason})`).join(", ")}.`);
  }
  return evaluations;
}

// src/core/evidence.mjs
function evaluateEvidence(root) {
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null });
  const sources = readJson(root, ARTIFACT_PATHS.sources, { version: 1, items: [], updatedAt: null });
  const notes = readJson(root, ARTIFACT_PATHS.notes, { version: 1, items: [], updatedAt: null });
  const experimentResults = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  const audits = readJson(root, ARTIFACT_PATHS.experimentAudits, { version: 1, items: [], updatedAt: null });
  const bridgeLog = readJson(root, ARTIFACT_PATHS.claimBridgeLog, { version: 1, items: [], updatedAt: null });
  const sourceById = sourceReferenceMap(sources.items ?? []);
  const noteIds = new Set(notes.items.map((item) => item.id));
  const auditsById = new Map((audits.items ?? []).map((item) => [item.id, item]));
  const resultsById = new Map((experimentResults.items ?? []).map((item) => [item.id, item]));
  const unsupportedClaims = [];
  const weakClaims = [];
  const missingSourceRefs = [];
  const missingNoteRefs = [];
  const draftClaimMismatches = [];
  const claimBridgeProblems = [];
  const auditIntegrityFlags = [];
  for (const claim of evidence.claims) {
    const heldBridgeForClaim = (bridgeLog.items ?? []).find((item) => item.claimId === claim.id && (item.bridgeStatus === "held-for-review" || item.auditVerdict === "blocked"));
    if (heldBridgeForClaim && claim.latestBridgeId !== heldBridgeForClaim.id) {
      claimBridgeProblems.push({ claim, reason: "bridge-held-for-review", bridgeId: heldBridgeForClaim.id, auditIds: heldBridgeForClaim.auditIds ?? [] });
    }
    if (!Array.isArray(claim.sourceIds) || claim.sourceIds.length === 0) {
      unsupportedClaims.push(claim);
      continue;
    }
    const sourceEvaluations = evaluateSourceReferences(root, claim.sourceIds);
    const unknownSources = sourceEvaluations.filter((item) => item.reason === "unknown-source").map((item) => item.reference);
    if (unknownSources.length > 0) {
      missingSourceRefs.push({ claim, missing: unknownSources });
      unsupportedClaims.push(claim);
      continue;
    }
    const ineligibleSources = sourceEvaluations.filter((item) => !item.eligible);
    if (ineligibleSources.length > 0) {
      missingSourceRefs.push({ claim, missing: [], ineligible: ineligibleSources.map((item) => ({ sourceId: item.reference, reason: item.reason })) });
      unsupportedClaims.push(claim);
      continue;
    }
    const unknownNotes = (Array.isArray(claim.noteIds) ? claim.noteIds : []).filter((id) => !noteIds.has(id));
    if (unknownNotes.length > 0) {
      missingNoteRefs.push({ claim, missing: unknownNotes });
    }
    if (claim.sourceIds.length === 1 || claim.status === "weak" || claim.confidence === "low") {
      weakClaims.push(claim);
    }
    const latestBridge = claim.latestBridgeId ? bridgeLog.items.find((item) => item.id === claim.latestBridgeId) : null;
    if ((claim.experimentIds ?? []).length > 0 && !latestBridge) {
      claimBridgeProblems.push({ claim, reason: "missing-bridge-event" });
    }
    if (latestBridge && latestBridge.statusAfter !== claim.status) {
      claimBridgeProblems.push({ claim, reason: "stale-bridge-state", bridgeId: latestBridge.id });
    }
    if (latestBridge && (!Array.isArray(latestBridge.auditIds) || latestBridge.auditIds.length === 0)) {
      claimBridgeProblems.push({ claim, reason: "missing-audit-link", bridgeId: latestBridge.id });
    }
    if (latestBridge) {
      const unknownAuditIds = (latestBridge.auditIds ?? []).filter((id) => !auditsById.has(id));
      if (unknownAuditIds.length > 0) {
        claimBridgeProblems.push({ claim, reason: "unknown-audit-link", bridgeId: latestBridge.id, auditIds: unknownAuditIds });
      }
      if (latestBridge.bridgeStatus === "held-for-review" || latestBridge.auditVerdict === "blocked") {
        claimBridgeProblems.push({ claim, reason: "bridge-held-for-review", bridgeId: latestBridge.id, auditIds: latestBridge.auditIds ?? [] });
      }
    }
    const draftPath = `${ARTIFACT_PATHS.draftsDir}/${claim.sectionId}.md`;
    const draftContent = readText(root, draftPath, "");
    if (!draftContent) {
      draftClaimMismatches.push({ claim, reason: "missing-draft" });
      continue;
    }
    const citedKeys = new Set(extractCitationKeysFromText(draftContent));
    const expectedKeys = claim.sourceIds.flatMap((id) => {
      const source = sourceById.get(id);
      return source ? [source.id, source.citationKey].filter(Boolean) : [];
    });
    if (expectedKeys.length > 0 && !expectedKeys.some((key) => citedKeys.has(key))) {
      draftClaimMismatches.push({ claim, reason: "draft-missing-claim-citation", expectedKeys });
    }
  }
  for (const audit of audits.items ?? []) {
    const result = audit.resultId ? resultsById.get(audit.resultId) : null;
    if ((audit.integrityFlags ?? []).length > 0 || audit.auditVerdict === "blocked") {
      auditIntegrityFlags.push(audit);
    }
    if ((audit.reviewedArtifactRefs ?? []).length === 0) {
      auditIntegrityFlags.push({ ...audit, integrityFlags: [...audit.integrityFlags ?? [], "missing-reviewed-artifact-refs"] });
    }
    if (result?.latestAuditId && result.latestAuditId !== audit.id && result.id === audit.resultId) {
      auditIntegrityFlags.push({ ...audit, integrityFlags: [...audit.integrityFlags ?? [], "stale-result-audit-pointer"] });
    }
  }
  const citationTodos = [];
  const missingCitationRefs = [];
  for (const draftFile of listDraftFiles(root)) {
    const content = readText(root, `${ARTIFACT_PATHS.draftsDir}/${draftFile}`, "");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/TODO\[citation\]|CITATION NEEDED|TODO: citation/i.test(line)) {
        citationTodos.push({ draftFile, line: index + 1, text: line.trim() });
      }
    });
    for (const key of extractCitationKeysFromText(content)) {
      if (!sourceById.has(key)) {
        missingCitationRefs.push({ draftFile, key });
      }
    }
  }
  return {
    unsupportedClaims,
    weakClaims,
    missingSourceRefs,
    missingNoteRefs,
    missingCitationRefs,
    draftClaimMismatches,
    citationTodos,
    claimBridgeProblems,
    auditIntegrityFlags,
    claimCount: evidence.claims.length
  };
}

// src/core/onboarding.mjs
import fs10 from "node:fs";
import path11 from "node:path";
var DEFAULT_EXCLUDED_DIRS = /* @__PURE__ */ new Set([
  ".git",
  ".dove",
  ".agents",
  ".cache",
  ".claude",
  ".codex",
  ".cursor",
  ".opencode",
  ".trellis",
  ".next",
  ".pytest_cache",
  ".venv",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "docs",
  "mcp",
  "reference_repos",
  "scripts",
  "src",
  "tmp"
]);
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set([".eps", ".jpeg", ".jpg", ".pdf", ".png", ".svg", ".tif", ".tiff"]);
var TABLE_EXTENSIONS = /* @__PURE__ */ new Set([".csv", ".tsv", ".xlsx"]);
var RESULT_EXTENSIONS = /* @__PURE__ */ new Set([".json", ".jsonl", ".npy", ".npz", ".pkl", ".parquet"]);
var NOTE_EXTENSIONS = /* @__PURE__ */ new Set([".md", ".txt"]);
function normalizeRelativePath(relativePath) {
  return relativePath.split(path11.sep).join("/");
}
function safeInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function classifyByName(relativePath) {
  const baseName = path11.basename(relativePath).toLowerCase();
  const stem = baseName.replace(/\.[^.]+$/, "");
  const extension = path11.extname(baseName);
  const pathParts = relativePath.toLowerCase().split("/");
  const parentHints = new Set(pathParts.slice(0, -1));
  if (extension === ".bib") {
    return {
      artifactType: "bibliography",
      lifecycleFamily: "knowledge",
      suggestedTarget: ARTIFACT_PATHS.bibliography,
      confidence: "high",
      reason: "BibTeX bibliography file."
    };
  }
  if (["main", "paper", "manuscript", "ms", "article"].includes(stem) && [".tex", ".md"].includes(extension)) {
    return {
      artifactType: "manuscript",
      lifecycleFamily: "structure",
      suggestedTarget: extension === ".md" ? `${ARTIFACT_PATHS.draftsDir}/${stem}.md` : ARTIFACT_PATHS.draftsDir,
      confidence: ["main", "paper", "manuscript"].includes(stem) ? "high" : "medium",
      reason: "Likely primary manuscript entrypoint."
    };
  }
  if (IMAGE_EXTENSIONS.has(extension) && [...parentHints].some((part) => ["fig", "figs", "figure", "figures", "images", "plots"].includes(part))) {
    return {
      artifactType: "figure",
      lifecycleFamily: "structure",
      suggestedTarget: ARTIFACT_PATHS.figuresIndex,
      confidence: "medium",
      reason: "Image or vector asset under a figure-like directory."
    };
  }
  if (TABLE_EXTENSIONS.has(extension) && [...parentHints].some((part) => ["table", "tables", "data"].includes(part)) || /^table[-_\d]/.test(stem)) {
    return {
      artifactType: "table",
      lifecycleFamily: "structure",
      suggestedTarget: ARTIFACT_PATHS.figuresIndex,
      confidence: "medium",
      reason: "Likely table or tabular artifact."
    };
  }
  if ((RESULT_EXTENSIONS.has(extension) || TABLE_EXTENSIONS.has(extension)) && [...parentHints].some((part) => ["result", "results", "experiment", "experiments", "eval", "evaluation", "outputs"].includes(part))) {
    return {
      artifactType: "result",
      lifecycleFamily: "audit",
      suggestedTarget: ARTIFACT_PATHS.experimentResults,
      confidence: "medium",
      reason: "Likely experiment result or evaluation output."
    };
  }
  if (NOTE_EXTENSIONS.has(extension) && /note|notes|reading|literature|survey|annot/i.test(relativePath)) {
    return {
      artifactType: "note",
      lifecycleFamily: "knowledge",
      suggestedTarget: ARTIFACT_PATHS.notes,
      confidence: "medium",
      reason: "Likely research note or literature annotation."
    };
  }
  if (NOTE_EXTENSIONS.has(extension) && /review|reviewer|critique|decision|meta-review/i.test(relativePath)) {
    return {
      artifactType: "review",
      lifecycleFamily: "concern",
      suggestedTarget: ARTIFACT_PATHS.reviewConcerns,
      confidence: "medium",
      reason: "Likely reviewer feedback or decision artifact."
    };
  }
  if (/supplement|appendix|camera-ready|submission|cover[-_ ]?letter|rebuttal|response/i.test(relativePath) && [".tex", ".md", ".pdf", ".txt"].includes(extension)) {
    return {
      artifactType: "submission",
      lifecycleFamily: "structure",
      suggestedTarget: ARTIFACT_PATHS.versionsIndex,
      confidence: "low",
      reason: "Likely submission, appendix, rebuttal, or versioned paper artifact."
    };
  }
  return null;
}
function walkFiles(root, options = {}) {
  const maxDepth = safeInteger(options.maxDepth, 6);
  const maxFiles = safeInteger(options.maxFiles, 3e3);
  const excludedDirs = /* @__PURE__ */ new Set([...DEFAULT_EXCLUDED_DIRS, ...Array.isArray(options.excludeDirs) ? options.excludeDirs : []]);
  const files = [];
  const warnings = [];
  function walk(currentDir, depth) {
    if (files.length >= maxFiles) {
      return;
    }
    let entries = [];
    try {
      entries = fs10.readdirSync(currentDir, { withFileTypes: true });
    } catch (error) {
      warnings.push(`Could not read ${normalizeRelativePath(path11.relative(root, currentDir)) || "."}: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    for (const entry of entries) {
      if (files.length >= maxFiles) {
        warnings.push(`Scan stopped after ${maxFiles} files.`);
        return;
      }
      const fullPath = path11.join(currentDir, entry.name);
      const relativePath = normalizeRelativePath(path11.relative(root, fullPath));
      if (entry.isDirectory()) {
        if (excludedDirs.has(entry.name) || depth >= maxDepth) {
          continue;
        }
        walk(fullPath, depth + 1);
        continue;
      }
      if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }
  walk(root, 0);
  return { files: files.sort(), warnings };
}
function buildConflicts(mappings) {
  const conflicts = [];
  const manuscriptMappings = mappings.filter((item) => item.artifactType === "manuscript" && item.confidence === "high");
  if (manuscriptMappings.length > 1) {
    conflicts.push({
      type: "multiple-primary-manuscripts",
      sourcePaths: manuscriptMappings.map((item) => item.sourcePath),
      suggestedResolution: "Choose one primary manuscript entrypoint before writing or importing drafts."
    });
  }
  const bibliographyMappings = mappings.filter((item) => item.artifactType === "bibliography");
  if (bibliographyMappings.length > 1) {
    conflicts.push({
      type: "multiple-bibliographies",
      sourcePaths: bibliographyMappings.map((item) => item.sourcePath),
      suggestedResolution: "Select the canonical bibliography or merge entries before syncing citations."
    });
  }
  return conflicts;
}
function buildRecommendedNextActions(mappings, conflicts, writeMap) {
  const actions = [];
  if (!writeMap) {
    actions.push("Run `dove onboard . --write-map` to persist this proposal under .dove/workspace/artifact-map.json.");
  }
  if (conflicts.length > 0) {
    actions.push("Resolve mapping conflicts before importing or rewriting paper artifacts.");
  }
  if (mappings.some((item) => item.artifactType === "manuscript")) {
    actions.push("Use `project:dove.mission` before converting a legacy manuscript into the design/checklist/implementation/acceptance flow.");
  }
  if (mappings.some((item) => item.artifactType === "bibliography")) {
    actions.push("Use `project:dove.source` after selecting the canonical bibliography.");
  }
  if (mappings.some((item) => item.artifactType === "review")) {
    actions.push("Use `project:dove.review` or `project:dove.rebuttal` after mapping reviewer feedback artifacts.");
  }
  return actions;
}
function buildProposal(root, options = {}) {
  const { files, warnings } = walkFiles(root, options);
  const mappings = [];
  const unmapped = [];
  for (const sourcePath of files) {
    const classified = classifyByName(sourcePath);
    if (!classified) {
      const extension = path11.extname(sourcePath).toLowerCase();
      if ([".tex", ".md", ".bib", ".pdf", ".png", ".jpg", ".jpeg", ".svg", ".csv", ".tsv", ".json"].includes(extension)) {
        unmapped.push({ sourcePath, reason: "Recognized paper-adjacent extension but no confident lifecycle mapping." });
      }
      continue;
    }
    mappings.push({
      sourcePath,
      artifactType: classified.artifactType,
      lifecycleFamily: normalizeLifecycleFamilyId(classified.lifecycleFamily, "knowledge"),
      suggestedTarget: classified.suggestedTarget,
      confidence: classified.confidence,
      reason: classified.reason,
      action: "map-reference-only"
    });
  }
  const conflicts = buildConflicts(mappings);
  const writeMap = Boolean(options.writeMap);
  return {
    version: 1,
    mode: "onboarding-artifact-map",
    proposalOnly: !writeMap,
    noAutoApply: true,
    writeMap,
    artifactMapPath: ARTIFACT_PATHS.workspaceArtifactMap,
    summary: {
      scannedFileCount: files.length,
      mappingCount: mappings.length,
      conflictCount: conflicts.length,
      unmappedCount: unmapped.length,
      manuscriptCount: mappings.filter((item) => item.artifactType === "manuscript").length,
      bibliographyCount: mappings.filter((item) => item.artifactType === "bibliography").length
    },
    mappings,
    conflicts,
    unmapped,
    warnings,
    recommendedNextActions: buildRecommendedNextActions(mappings, conflicts, writeMap)
  };
}
function discoverPaperArtifacts(root, args = {}) {
  const proposal = buildProposal(root, args);
  if (args.writeMap) {
    writeJson(root, ARTIFACT_PATHS.workspaceArtifactMap, {
      ...proposal,
      proposalOnly: true,
      writeMap: true,
      writtenAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return {
      ...proposal,
      proposalOnly: true,
      written: [ARTIFACT_PATHS.workspaceArtifactMap]
    };
  }
  return {
    ...proposal,
    written: []
  };
}
function queryDoveOnboarding(root, args = {}) {
  const proposal = discoverPaperArtifacts(root, { ...args, writeMap: false });
  return {
    ...proposal,
    mode: "dove-onboarding-query",
    proposalOnly: true,
    noAutoApply: true,
    writeMap: false,
    written: [],
    writes: [],
    diagnostics: {
      noCommandExecution: true,
      noGitInspection: true,
      noSourceMutation: true,
      writeMapForcedFalse: true
    }
  };
}

// src/core/dove.mjs
import fs12 from "node:fs";
import path13 from "node:path";

// src/core/paper-audit.mjs
import fs11 from "node:fs";
import path12 from "node:path";
function cloneFallback2(fallback) {
  return typeof fallback === "function" ? fallback() : structuredClone(fallback);
}
function safeReadJson(root, relativePath, fallback, readErrors) {
  const fullPath = resolvePath(root, relativePath);
  if (!fs11.existsSync(fullPath)) {
    return cloneFallback2(fallback);
  }
  try {
    return JSON.parse(fs11.readFileSync(fullPath, "utf8"));
  } catch (error) {
    readErrors.push({
      path: relativePath,
      message: error instanceof Error ? error.message : String(error)
    });
    return cloneFallback2(fallback);
  }
}
function safeLoadState(root, readErrors) {
  return normalizeState(safeReadJson(root, ARTIFACT_PATHS.state, createDefaultState, readErrors));
}
function safeListDraftFiles(root) {
  const draftsDir = resolvePath(root, ARTIFACT_PATHS.draftsDir);
  if (!fs11.existsSync(draftsDir)) {
    return [];
  }
  return fs11.readdirSync(draftsDir, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md").map((entry) => entry.name);
}
function normalizeStringArray6(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}
function normalizeFigureArtifactPath(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
function isSafeProjectRelativePath(relativePath) {
  if (!relativePath || path12.isAbsolute(relativePath)) {
    return false;
  }
  const normalized = path12.normalize(relativePath);
  return normalized !== "." && !normalized.startsWith("..") && !normalized.includes(`${path12.sep}..${path12.sep}`);
}
function figurePathLooksPortable(relativePath) {
  if (!relativePath) {
    return true;
  }
  return isSafeProjectRelativePath(relativePath) && !relativePath.startsWith(".dove/") && !relativePath.includes("node_modules/");
}
function figureIssueId(figureId, code) {
  return `figure-${figureId}-${code}`.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
}
function responseOwnerForFigureIssue(issue) {
  if (issue.stage === "brief") {
    return "builder";
  }
  if (issue.stage === "editable" || issue.stage === "final-contract") {
    return "builder";
  }
  return "planner";
}
function buildFigureIssue({ figure, code, severity, stage, summary, artifactPaths, timestamp, claimIds, experimentIds, reviewConcernIds, rebuttalIssueIds }) {
  return {
    id: figureIssueId(figure.id, code),
    figureId: figure.id,
    severity,
    code,
    stage,
    summary,
    claimIds: claimIds ?? figure.targetClaimIds,
    experimentIds: experimentIds ?? figure.relatedExperimentIds,
    reviewConcernIds: reviewConcernIds ?? figure.reviewConcernIds,
    rebuttalIssueIds: rebuttalIssueIds ?? figure.rebuttalIssueIds,
    artifactPaths,
    updatedAt: timestamp
  };
}
function safeEvaluateEvidence(root, readErrors) {
  const evidence = safeReadJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null }, readErrors);
  const sources = safeReadJson(root, ARTIFACT_PATHS.sources, { version: 1, items: [], updatedAt: null }, readErrors);
  const notes = safeReadJson(root, ARTIFACT_PATHS.notes, { version: 1, items: [], updatedAt: null }, readErrors);
  const experimentResults = safeReadJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null }, readErrors);
  const audits = safeReadJson(root, ARTIFACT_PATHS.experimentAudits, { version: 1, items: [], updatedAt: null }, readErrors);
  const bridgeLog = safeReadJson(root, ARTIFACT_PATHS.claimBridgeLog, { version: 1, items: [], updatedAt: null }, readErrors);
  const sourceById = new Map((sources.items ?? []).flatMap((item) => [[item.id, item], item.citationKey ? [item.citationKey, item] : null].filter(Boolean)));
  const noteIds = new Set((notes.items ?? []).map((item) => item.id));
  const auditsById = new Map((audits.items ?? []).map((item) => [item.id, item]));
  const resultsById = new Map((experimentResults.items ?? []).map((item) => [item.id, item]));
  const unsupportedClaims = [];
  const weakClaims = [];
  const missingSourceRefs = [];
  const missingNoteRefs = [];
  const draftClaimMismatches = [];
  const claimBridgeProblems = [];
  const auditIntegrityFlags = [];
  for (const claim of evidence.claims ?? []) {
    const heldBridgeForClaim = (bridgeLog.items ?? []).find((item) => item.claimId === claim.id && (item.bridgeStatus === "held-for-review" || item.auditVerdict === "blocked"));
    if (heldBridgeForClaim && claim.latestBridgeId !== heldBridgeForClaim.id) {
      claimBridgeProblems.push({ claim, reason: "bridge-held-for-review", bridgeId: heldBridgeForClaim.id, auditIds: heldBridgeForClaim.auditIds ?? [] });
    }
    if (!Array.isArray(claim.sourceIds) || claim.sourceIds.length === 0) {
      unsupportedClaims.push(claim);
      continue;
    }
    const unknownSources = claim.sourceIds.filter((id) => !sourceById.has(id));
    if (unknownSources.length > 0) {
      missingSourceRefs.push({ claim, missing: unknownSources });
      unsupportedClaims.push(claim);
      continue;
    }
    const unknownNotes = (Array.isArray(claim.noteIds) ? claim.noteIds : []).filter((id) => !noteIds.has(id));
    if (unknownNotes.length > 0) {
      missingNoteRefs.push({ claim, missing: unknownNotes });
    }
    if (claim.sourceIds.length === 1 || claim.status === "weak" || claim.confidence === "low") {
      weakClaims.push(claim);
    }
    const latestBridge = claim.latestBridgeId ? (bridgeLog.items ?? []).find((item) => item.id === claim.latestBridgeId) : null;
    if ((claim.experimentIds ?? []).length > 0 && !latestBridge) {
      claimBridgeProblems.push({ claim, reason: "missing-bridge-event" });
    }
    if (latestBridge && latestBridge.statusAfter !== claim.status) {
      claimBridgeProblems.push({ claim, reason: "stale-bridge-state", bridgeId: latestBridge.id });
    }
    if (latestBridge && (!Array.isArray(latestBridge.auditIds) || latestBridge.auditIds.length === 0)) {
      claimBridgeProblems.push({ claim, reason: "missing-audit-link", bridgeId: latestBridge.id });
    }
    if (latestBridge) {
      const unknownAuditIds = (latestBridge.auditIds ?? []).filter((id) => !auditsById.has(id));
      if (unknownAuditIds.length > 0) {
        claimBridgeProblems.push({ claim, reason: "unknown-audit-link", bridgeId: latestBridge.id, auditIds: unknownAuditIds });
      }
      if (latestBridge.bridgeStatus === "held-for-review" || latestBridge.auditVerdict === "blocked") {
        claimBridgeProblems.push({ claim, reason: "bridge-held-for-review", bridgeId: latestBridge.id, auditIds: latestBridge.auditIds ?? [] });
      }
    }
    const draftPath = `${ARTIFACT_PATHS.draftsDir}/${claim.sectionId}.md`;
    const draftContent = readText(root, draftPath, "");
    if (!draftContent) {
      draftClaimMismatches.push({ claim, reason: "missing-draft" });
      continue;
    }
    const citedKeys = new Set(extractCitationKeysFromText(draftContent));
    const expectedKeys = claim.sourceIds.flatMap((id) => {
      const source = sourceById.get(id);
      return source ? [source.id, source.citationKey].filter(Boolean) : [];
    });
    if (expectedKeys.length > 0 && !expectedKeys.some((key) => citedKeys.has(key))) {
      draftClaimMismatches.push({ claim, reason: "draft-missing-claim-citation", expectedKeys });
    }
  }
  for (const audit of audits.items ?? []) {
    const result = audit.resultId ? resultsById.get(audit.resultId) : null;
    if ((audit.integrityFlags ?? []).length > 0 || audit.auditVerdict === "blocked") {
      auditIntegrityFlags.push(audit);
    }
    if ((audit.reviewedArtifactRefs ?? []).length === 0) {
      auditIntegrityFlags.push({ ...audit, integrityFlags: [...audit.integrityFlags ?? [], "missing-reviewed-artifact-refs"] });
    }
    if (result?.latestAuditId && result.latestAuditId !== audit.id && result.id === audit.resultId) {
      auditIntegrityFlags.push({ ...audit, integrityFlags: [...audit.integrityFlags ?? [], "stale-result-audit-pointer"] });
    }
  }
  const citationTodos = [];
  const missingCitationRefs = [];
  for (const draftFile of safeListDraftFiles(root)) {
    const content = readText(root, `${ARTIFACT_PATHS.draftsDir}/${draftFile}`, "");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/TODO\[citation\]|CITATION NEEDED|TODO: citation/i.test(line)) {
        citationTodos.push({ draftFile, line: index + 1, text: line.trim() });
      }
    });
    for (const key of extractCitationKeysFromText(content)) {
      if (!sourceById.has(key)) {
        missingCitationRefs.push({ draftFile, key });
      }
    }
  }
  return {
    unsupportedClaims,
    weakClaims,
    missingSourceRefs,
    missingNoteRefs,
    missingCitationRefs,
    draftClaimMismatches,
    citationTodos,
    claimBridgeProblems,
    auditIntegrityFlags,
    claimCount: (evidence.claims ?? []).length
  };
}
function safeEvaluateFigurePipeline(root, state, readErrors) {
  const evidence = safeReadJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null }, readErrors);
  const experimentPlans = safeReadJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null }, readErrors);
  const experimentResults = safeReadJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null }, readErrors);
  const reviewConcerns = safeReadJson(root, ARTIFACT_PATHS.reviewConcerns, createReviewConcernsIndex, readErrors);
  const rebuttalIssues = safeReadJson(root, ARTIFACT_PATHS.rebuttalIssues, { version: 1, items: [], updatedAt: null }, readErrors);
  const figures = safeReadJson(root, ARTIFACT_PATHS.figuresIndex, { version: 1, items: [], updatedAt: null }, readErrors);
  const briefs = safeReadJson(root, ARTIFACT_PATHS.figureBriefs, { version: 1, items: [], updatedAt: null }, readErrors);
  const segments = safeReadJson(root, ARTIFACT_PATHS.figureSegments, { version: 1, items: [], updatedAt: null }, readErrors);
  const templates = safeReadJson(root, ARTIFACT_PATHS.figureTemplates, { version: 1, items: [], updatedAt: null }, readErrors);
  const editable = safeReadJson(root, ARTIFACT_PATHS.figureEditableIndex, { version: 1, items: [], updatedAt: null }, readErrors);
  const finals = safeReadJson(root, ARTIFACT_PATHS.figureFinalIndex, { version: 1, items: [], updatedAt: null }, readErrors);
  const claimIds = new Set((evidence.claims ?? []).map((claim) => claim.id));
  const sectionIds = new Set(Object.keys(state.sections ?? {}));
  const experimentIds = /* @__PURE__ */ new Set([
    ...(experimentPlans.items ?? []).map((item) => item.id),
    ...(experimentResults.items ?? []).map((item) => item.experimentId)
  ]);
  const reviewConcernIds = new Set((reviewConcerns.items ?? []).map((item) => item.id));
  const rebuttalIssueIds = new Set((rebuttalIssues.items ?? []).map((item) => item.id));
  const briefByFigure = new Map((briefs.items ?? []).map((item) => [item.figureId, item]));
  const segmentByFigure = new Map((segments.items ?? []).map((item) => [item.figureId, item]));
  const templateByFigure = new Map((templates.items ?? []).map((item) => [item.figureId, item]));
  const editableByFigure = new Map((editable.items ?? []).map((item) => [item.figureId, item]));
  const finalByFigure = new Map((finals.items ?? []).map((item) => [item.figureId, item]));
  const stagePathUsage = /* @__PURE__ */ new Map();
  const timestamp = (/* @__PURE__ */ new Date(0)).toISOString();
  const items = [];
  const issues = [];
  function normalizeFigureListField(figure, field, stage, artifactPaths) {
    const rawValue = figure[field];
    const normalized = normalizeStringArray6(rawValue);
    if (rawValue !== void 0 && rawValue !== null && !Array.isArray(rawValue)) {
      issues.push(buildFigureIssue({
        figure,
        code: `malformed-${field}`,
        severity: "medium",
        stage,
        summary: `Figure ${figure.id} has a malformed ${field} field and it was ignored during QA validation.`,
        artifactPaths,
        timestamp
      }));
    }
    return normalized;
  }
  for (const figure of figures.items ?? []) {
    for (const [field, stage] of [["templateSvgPath", "template"], ["editableSvgPath", "editable"], ["finalSvgPath", "final-contract"]]) {
      const normalizedPath = normalizeFigureArtifactPath(figure[field]);
      if (!normalizedPath || !isSafeProjectRelativePath(normalizedPath)) {
        continue;
      }
      const current = stagePathUsage.get(normalizedPath) ?? [];
      current.push({ figureId: figure.id, field, stage });
      stagePathUsage.set(normalizedPath, current);
    }
  }
  for (const figure of figures.items ?? []) {
    const figureIssues = [];
    const sourceSections = normalizeFigureListField(figure, "sourceSections", "brief", [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa]);
    const sourceArtifactPaths = normalizeFigureListField(figure, "sourceArtifactPaths", "brief", [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa]);
    const targetClaimIds = normalizeFigureListField(figure, "targetClaimIds", "brief", [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa]);
    const relatedExperimentIds = normalizeFigureListField(figure, "relatedExperimentIds", "brief", [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa]);
    const reviewConcernIdsForFigure = normalizeFigureListField(figure, "reviewConcernIds", "editable", [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.figureQa]);
    const rebuttalIssueIdsForFigure = normalizeFigureListField(figure, "rebuttalIssueIds", "final-contract", [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.figureQa]);
    const brief = briefByFigure.get(figure.id);
    const segment = segmentByFigure.get(figure.id);
    const template = templateByFigure.get(figure.id);
    const editableArtifact = editableByFigure.get(figure.id);
    const finalArtifact = finalByFigure.get(figure.id);
    const stageArtifacts = {
      brief: Boolean(brief),
      segments: Boolean(segment),
      template: Boolean(template),
      editable: Boolean(editableArtifact),
      finalContract: Boolean(finalArtifact)
    };
    const stageArtifactPaths = [
      ARTIFACT_PATHS.figuresIndex,
      ARTIFACT_PATHS.figureBriefs,
      ARTIFACT_PATHS.figureSegments,
      ARTIFACT_PATHS.figureTemplates,
      ARTIFACT_PATHS.figureEditableIndex,
      ARTIFACT_PATHS.figureFinalIndex,
      ARTIFACT_PATHS.figureQa
    ];
    const fileChecks = { stagedArtifacts: {}, sourceArtifacts: [] };
    for (const [stageName, present] of Object.entries(stageArtifacts)) {
      if (!present) {
        figureIssues.push(buildFigureIssue({
          figure,
          code: "missing-stage-artifact",
          severity: "high",
          stage: stageName,
          summary: `Figure ${figure.id} is missing the ${stageName} stage artifact.`,
          artifactPaths: stageArtifactPaths,
          timestamp
        }));
      }
    }
    if (targetClaimIds.length === 0) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "missing-claim-linkage",
        severity: "high",
        stage: "brief",
        summary: `Figure ${figure.id} has no linked target claims.`,
        claimIds: [],
        experimentIds: relatedExperimentIds,
        reviewConcernIds: reviewConcernIdsForFigure,
        rebuttalIssueIds: rebuttalIssueIdsForFigure,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }
    const missingSections = sourceSections.filter((sectionId) => !sectionIds.has(sectionId));
    if (missingSections.length > 0) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "missing-source-sections",
        severity: "medium",
        stage: "brief",
        summary: `Figure ${figure.id} references unknown source sections: ${missingSections.join(", ")}.`,
        claimIds: targetClaimIds,
        experimentIds: relatedExperimentIds,
        reviewConcernIds: reviewConcernIdsForFigure,
        rebuttalIssueIds: rebuttalIssueIdsForFigure,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }
    const missingClaims = targetClaimIds.filter((claimId) => !claimIds.has(claimId));
    if (missingClaims.length > 0) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "unknown-claims",
        severity: "high",
        stage: "brief",
        summary: `Figure ${figure.id} references unknown target claims: ${missingClaims.join(", ")}.`,
        claimIds: targetClaimIds,
        experimentIds: relatedExperimentIds,
        reviewConcernIds: reviewConcernIdsForFigure,
        rebuttalIssueIds: rebuttalIssueIdsForFigure,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }
    const missingExperiments = relatedExperimentIds.filter((experimentId) => !experimentIds.has(experimentId));
    if (missingExperiments.length > 0) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "unknown-experiments",
        severity: "medium",
        stage: "brief",
        summary: `Figure ${figure.id} references unknown related experiments: ${missingExperiments.join(", ")}.`,
        claimIds: targetClaimIds,
        experimentIds: relatedExperimentIds,
        reviewConcernIds: reviewConcernIdsForFigure,
        rebuttalIssueIds: rebuttalIssueIdsForFigure,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }
    const missingReviewConcerns = reviewConcernIdsForFigure.filter((id) => !reviewConcernIds.has(id));
    if (missingReviewConcerns.length > 0) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "unknown-review-concerns",
        severity: "medium",
        stage: "editable",
        summary: `Figure ${figure.id} references unknown review concerns: ${missingReviewConcerns.join(", ")}.`,
        claimIds: targetClaimIds,
        experimentIds: relatedExperimentIds,
        reviewConcernIds: reviewConcernIdsForFigure,
        rebuttalIssueIds: rebuttalIssueIdsForFigure,
        artifactPaths: [ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }
    const missingRebuttalIssues = rebuttalIssueIdsForFigure.filter((id) => !rebuttalIssueIds.has(id));
    if (missingRebuttalIssues.length > 0) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "unknown-rebuttal-issues",
        severity: "medium",
        stage: "final-contract",
        summary: `Figure ${figure.id} references unknown rebuttal issues: ${missingRebuttalIssues.join(", ")}.`,
        claimIds: targetClaimIds,
        experimentIds: relatedExperimentIds,
        reviewConcernIds: reviewConcernIdsForFigure,
        rebuttalIssueIds: rebuttalIssueIdsForFigure,
        artifactPaths: [ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.rebuttalIssues, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }
    const portablePathProblems = [figure.templateSvgPath, figure.editableSvgPath, figure.finalSvgPath].filter((relativePath) => !figurePathLooksPortable(relativePath));
    if (portablePathProblems.length > 0) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "non-portable-paths",
        severity: "high",
        stage: "template",
        summary: `Figure ${figure.id} uses non-portable artifact paths: ${portablePathProblems.join(", ")}.`,
        claimIds: targetClaimIds,
        experimentIds: relatedExperimentIds,
        reviewConcernIds: reviewConcernIdsForFigure,
        rebuttalIssueIds: rebuttalIssueIdsForFigure,
        artifactPaths: [ARTIFACT_PATHS.figureTemplates, ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }
    const stagePathChecks = [
      { field: "templateSvgPath", stage: "template", label: "template SVG", value: figure.templateSvgPath, artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureTemplates, ARTIFACT_PATHS.figureQa] },
      { field: "editableSvgPath", stage: "editable", label: "editable SVG", value: figure.editableSvgPath, artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.figureQa] },
      { field: "finalSvgPath", stage: "final-contract", label: "final SVG", value: figure.finalSvgPath, artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.figureQa] }
    ];
    for (const pathCheck of stagePathChecks) {
      const normalizedPath = normalizeFigureArtifactPath(pathCheck.value);
      const exists = normalizedPath && isSafeProjectRelativePath(normalizedPath) ? fs11.existsSync(resolvePath(root, normalizedPath)) : false;
      fileChecks.stagedArtifacts[pathCheck.field] = { path: normalizedPath, exists };
      if (!normalizedPath || !isSafeProjectRelativePath(normalizedPath)) {
        figureIssues.push(buildFigureIssue({
          figure,
          code: `malformed-${pathCheck.field}`,
          severity: "high",
          stage: pathCheck.stage,
          summary: `Figure ${figure.id} has a malformed ${pathCheck.label.toLowerCase()} path.`,
          artifactPaths: pathCheck.artifactPaths,
          timestamp
        }));
        continue;
      }
      if (!exists) {
        figureIssues.push(buildFigureIssue({
          figure,
          code: `missing-${pathCheck.field}-file`,
          severity: "high",
          stage: pathCheck.stage,
          summary: `Figure ${figure.id} is missing the ${pathCheck.label.toLowerCase()} file at ${normalizedPath}.`,
          artifactPaths: pathCheck.artifactPaths,
          timestamp
        }));
      }
    }
    const distinctStagePaths = stagePathChecks.map((item) => normalizeFigureArtifactPath(item.value)).filter((item) => item && isSafeProjectRelativePath(item));
    if (new Set(distinctStagePaths).size !== distinctStagePaths.length) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "colliding-stage-paths",
        severity: "high",
        stage: "template",
        summary: `Figure ${figure.id} reuses the same file path for multiple staged SVG artifacts.`,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureTemplates, ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }
    for (const pathCheck of stagePathChecks) {
      const normalizedPath = normalizeFigureArtifactPath(pathCheck.value);
      const collisions = normalizedPath ? stagePathUsage.get(normalizedPath) ?? [] : [];
      if (collisions.some((entry) => entry.figureId !== figure.id)) {
        const otherFigureIds = Array.from(new Set(collisions.filter((entry) => entry.figureId !== figure.id).map((entry) => entry.figureId))).sort();
        figureIssues.push(buildFigureIssue({
          figure,
          code: `shared-${pathCheck.field}`,
          severity: "high",
          stage: pathCheck.stage,
          summary: `Figure ${figure.id} shares ${pathCheck.label.toLowerCase()} path ${normalizedPath} with ${otherFigureIds.join(", ")}.`,
          artifactPaths: pathCheck.artifactPaths,
          timestamp
        }));
      }
    }
    const normalizedSourceArtifactPaths = sourceArtifactPaths.map(normalizeFigureArtifactPath);
    for (let index = 0; index < normalizedSourceArtifactPaths.length; index += 1) {
      const sourcePath = normalizedSourceArtifactPaths[index];
      const exists = sourcePath && isSafeProjectRelativePath(sourcePath) ? fs11.existsSync(resolvePath(root, sourcePath)) : false;
      fileChecks.sourceArtifacts.push({ path: sourcePath, exists });
      if (!sourcePath || !isSafeProjectRelativePath(sourcePath)) {
        figureIssues.push(buildFigureIssue({
          figure,
          code: `malformed-source-artifact-${index + 1}`,
          severity: "medium",
          stage: "brief",
          summary: `Figure ${figure.id} has a malformed source artifact path entry.`,
          artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa],
          timestamp
        }));
        continue;
      }
      if (!exists) {
        figureIssues.push(buildFigureIssue({
          figure,
          code: `missing-source-artifact-${index + 1}`,
          severity: "medium",
          stage: "brief",
          summary: `Figure ${figure.id} references a missing source artifact at ${sourcePath}.`,
          artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa],
          timestamp
        }));
      }
    }
    const templatePathMismatch = template && [template.templateSvgPath !== figure.templateSvgPath, template.editableSvgPath !== figure.editableSvgPath, template.finalSvgPath !== figure.finalSvgPath].some(Boolean);
    if (templatePathMismatch) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "inconsistent-template-stage-paths",
        severity: "high",
        stage: "template",
        summary: `Figure ${figure.id} has inconsistent staged SVG paths between the figure index and template artifact.`,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureTemplates, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }
    const editablePathMismatch = editableArtifact && [editableArtifact.templateSvgPath !== figure.templateSvgPath, editableArtifact.editableSvgPath !== figure.editableSvgPath, editableArtifact.finalSvgPath !== figure.finalSvgPath].some(Boolean);
    if (editablePathMismatch) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "inconsistent-editable-stage-paths",
        severity: "high",
        stage: "editable",
        summary: `Figure ${figure.id} has inconsistent staged SVG paths between the figure index and editable artifact.`,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }
    if (finalArtifact && finalArtifact.finalSvgPath !== figure.finalSvgPath) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "inconsistent-final-contract-path",
        severity: "high",
        stage: "final-contract",
        summary: `Figure ${figure.id} has inconsistent final SVG paths between the figure index and final contract.`,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }
    if (brief && JSON.stringify(brief.sourceArtifactPaths ?? []) !== JSON.stringify(figure.sourceArtifactPaths ?? [])) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "inconsistent-source-artifact-paths",
        severity: "medium",
        stage: "brief",
        summary: `Figure ${figure.id} has inconsistent source artifact paths between the figure index and brief artifact.`,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }
    if (editableArtifact && editableArtifact.finalSvgPath !== figure.finalSvgPath) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "inconsistent-final-path",
        severity: "high",
        stage: "editable",
        summary: `Figure ${figure.id} has inconsistent final SVG paths across staged artifacts.`,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }
    if (((figure.reviewConcernIds ?? []).length > 0 || (figure.rebuttalIssueIds ?? []).length > 0) && (figure.reviewNotes ?? []).length === 0) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "missing-review-notes",
        severity: "medium",
        stage: "editable",
        summary: `Figure ${figure.id} links to review or rebuttal context but has no durable review notes.`,
        artifactPaths: [ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.rebuttalIssues, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }
    issues.push(...figureIssues.map((issue) => ({
      ...issue,
      responseOwnerRole: responseOwnerForFigureIssue(issue)
    })));
    items.push({
      figureId: figure.id,
      qaStatus: figureIssues.some((issue) => issue.severity === "high") ? "blocked" : figureIssues.length > 0 ? "needs-review" : "ready",
      issueCount: figureIssues.length,
      openIssueIds: figureIssues.map((issue) => issue.id),
      stageArtifacts,
      targetClaimIds: figure.targetClaimIds,
      relatedExperimentIds: figure.relatedExperimentIds,
      reviewConcernIds: figure.reviewConcernIds,
      rebuttalIssueIds: figure.rebuttalIssueIds,
      fileChecks,
      updatedAt: timestamp
    });
  }
  return { version: 1, items, issues, updatedAt: timestamp };
}
function findingId(category, code, seed) {
  return `audit-${category}-${code}-${String(seed).replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase()}`;
}
function addFinding(findings, { id, severity, category, confidence = "high", summary, artifactPaths = [], suggestedNextCommand, claimIds = [], experimentIds = [], reviewConcernIds = [], rebuttalIssueIds = [], proposalOnly = true }) {
  findings.push({
    id,
    severity,
    category,
    confidence,
    summary,
    artifactPaths: Array.from(new Set(artifactPaths.filter(Boolean))),
    claimIds,
    experimentIds,
    reviewConcernIds,
    rebuttalIssueIds,
    suggestedNextCommand,
    proposalOnly,
    noAutoApply: true
  });
}
function countBy(items, field) {
  const counts = {};
  for (const item of items) {
    const key = item[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
function suggestedCommandsFromFindings(findings) {
  return Array.from(new Set(findings.map((finding) => finding.suggestedNextCommand).filter(Boolean)));
}
function artifactPathsRead() {
  return [
    ARTIFACT_PATHS.state,
    ARTIFACT_PATHS.orchestrationBoard,
    ARTIFACT_PATHS.workspaceIndex,
    ARTIFACT_PATHS.checklist,
    ARTIFACT_PATHS.sources,
    ARTIFACT_PATHS.notes,
    ARTIFACT_PATHS.evidence,
    ARTIFACT_PATHS.experimentResults,
    ARTIFACT_PATHS.experimentAudits,
    ARTIFACT_PATHS.claimBridgeLog,
    ARTIFACT_PATHS.reviewState,
    ARTIFACT_PATHS.reviewConcerns,
    ARTIFACT_PATHS.versionComparisons,
    ARTIFACT_PATHS.figuresIndex,
    ARTIFACT_PATHS.figureBriefs,
    ARTIFACT_PATHS.figureSegments,
    ARTIFACT_PATHS.figureTemplates,
    ARTIFACT_PATHS.figureEditableIndex,
    ARTIFACT_PATHS.figureFinalIndex,
    ARTIFACT_PATHS.figureQa,
    ARTIFACT_PATHS.draftsDir
  ];
}
function queryPaperAudit(root, args = {}) {
  const readErrors = [];
  const state = safeLoadState(root, readErrors);
  const board = safeReadJson(root, ARTIFACT_PATHS.orchestrationBoard, {}, readErrors);
  const reviewState = safeReadJson(root, ARTIFACT_PATHS.reviewState, createReviewState, readErrors);
  const reviewConcerns = safeReadJson(root, ARTIFACT_PATHS.reviewConcerns, createReviewConcernsIndex, readErrors);
  const versionComparisons = safeReadJson(root, ARTIFACT_PATHS.versionComparisons, createVersionComparisonsIndex, readErrors);
  const workspaceIndex = normalizeWorkspaceIndex(safeReadJson(root, ARTIFACT_PATHS.workspaceIndex, createWorkspaceIndex, readErrors));
  const checklistText = readText(root, ARTIFACT_PATHS.checklist, "");
  const evidence = safeEvaluateEvidence(root, readErrors);
  const figureQa = safeEvaluateFigurePipeline(root, state, readErrors);
  const findings = [];
  for (const error of readErrors) {
    addFinding(findings, {
      id: findingId("artifact", "malformed-json", error.path),
      severity: "high",
      category: "artifact",
      confidence: "high",
      summary: `${error.path} could not be parsed as JSON: ${error.message}`,
      artifactPaths: [error.path],
      suggestedNextCommand: "project:dove.status"
    });
  }
  for (const claim of evidence.unsupportedClaims) {
    addFinding(findings, {
      id: findingId("evidence", "unsupported-claim", claim.id),
      severity: "high",
      category: "evidence",
      summary: `Claim ${claim.id} has no valid source support.`,
      artifactPaths: [ARTIFACT_PATHS.evidence, ARTIFACT_PATHS.sources],
      claimIds: [claim.id],
      suggestedNextCommand: "project:dove.experience"
    });
  }
  for (const claim of evidence.weakClaims) {
    addFinding(findings, {
      id: findingId("evidence", "weak-claim", claim.id),
      severity: "medium",
      category: "evidence",
      summary: `Claim ${claim.id} is weakly supported and should be strengthened before acceptance.`,
      artifactPaths: [ARTIFACT_PATHS.evidence, ARTIFACT_PATHS.sources, ARTIFACT_PATHS.notes],
      claimIds: [claim.id],
      suggestedNextCommand: "project:dove.source"
    });
  }
  for (const item of evidence.missingSourceRefs) {
    addFinding(findings, {
      id: findingId("evidence", "missing-source-ref", item.claim.id),
      severity: "high",
      category: "evidence",
      summary: `Claim ${item.claim.id} references missing sources: ${item.missing.join(", ")}.`,
      artifactPaths: [ARTIFACT_PATHS.evidence, ARTIFACT_PATHS.sources],
      claimIds: [item.claim.id],
      suggestedNextCommand: "project:dove.source"
    });
  }
  for (const item of evidence.missingNoteRefs) {
    addFinding(findings, {
      id: findingId("evidence", "missing-note-ref", item.claim.id),
      severity: "medium",
      category: "evidence",
      summary: `Claim ${item.claim.id} references missing notes: ${item.missing.join(", ")}.`,
      artifactPaths: [ARTIFACT_PATHS.evidence, ARTIFACT_PATHS.notes],
      claimIds: [item.claim.id],
      suggestedNextCommand: "project:dove.note"
    });
  }
  for (const item of evidence.missingCitationRefs) {
    addFinding(findings, {
      id: findingId("citation", "missing-citation-ref", `${item.draftFile}-${item.key}`),
      severity: "high",
      category: "citation",
      summary: `${item.draftFile} cites unknown source key ${item.key}.`,
      artifactPaths: [ARTIFACT_PATHS.draftsDir, ARTIFACT_PATHS.sources, ARTIFACT_PATHS.bibliography],
      suggestedNextCommand: "project:dove.source"
    });
  }
  for (const todo of evidence.citationTodos) {
    addFinding(findings, {
      id: findingId("citation", "citation-todo", `${todo.draftFile}-${todo.line}`),
      severity: "medium",
      category: "citation",
      summary: `${todo.draftFile}:${todo.line} still has a citation TODO.`,
      artifactPaths: [ARTIFACT_PATHS.draftsDir, ARTIFACT_PATHS.bibliography],
      suggestedNextCommand: "project:dove.source"
    });
  }
  for (const item of evidence.draftClaimMismatches) {
    addFinding(findings, {
      id: findingId("draft", item.reason, item.claim.id),
      severity: "medium",
      category: "draft",
      summary: item.reason === "missing-draft" ? `Claim ${item.claim.id} targets section ${item.claim.sectionId} but no draft exists for that section.` : `Draft for ${item.claim.sectionId} does not cite any expected source for claim ${item.claim.id}.`,
      artifactPaths: [ARTIFACT_PATHS.draftsDir, ARTIFACT_PATHS.evidence],
      claimIds: [item.claim.id],
      suggestedNextCommand: "project:dove.draft"
    });
  }
  for (const audit of evidence.auditIntegrityFlags) {
    addFinding(findings, {
      id: findingId("experiment", "audit-integrity", audit.id),
      severity: "high",
      category: "experiment",
      summary: `Experiment audit ${audit.id} raised integrity flags: ${(audit.integrityFlags ?? []).join(", ")}.`,
      artifactPaths: [ARTIFACT_PATHS.experimentAudits],
      claimIds: audit.claimId ? [audit.claimId] : [],
      experimentIds: audit.experimentId ? [audit.experimentId] : [],
      suggestedNextCommand: "project:dove.experience"
    });
  }
  for (const bridgeProblem of evidence.claimBridgeProblems) {
    addFinding(findings, {
      id: findingId("claim-bridge", bridgeProblem.reason, bridgeProblem.claim.id),
      severity: "high",
      category: "claim-bridge",
      summary: `Claim ${bridgeProblem.claim.id} has a result-to-claim bridge problem (${bridgeProblem.reason}).`,
      artifactPaths: [ARTIFACT_PATHS.claimBridgeLog, ARTIFACT_PATHS.evidence],
      claimIds: [bridgeProblem.claim.id],
      experimentIds: bridgeProblem.claim.experimentIds ?? [],
      suggestedNextCommand: "project:dove.experience"
    });
  }
  for (const issue of figureQa.issues ?? []) {
    addFinding(findings, {
      id: findingId("figure", issue.code, issue.id),
      severity: issue.severity,
      category: "figure",
      summary: issue.summary,
      artifactPaths: issue.artifactPaths ?? [ARTIFACT_PATHS.figureQa],
      claimIds: issue.claimIds ?? [],
      experimentIds: issue.experimentIds ?? [],
      reviewConcernIds: issue.reviewConcernIds ?? [],
      rebuttalIssueIds: issue.rebuttalIssueIds ?? [],
      suggestedNextCommand: "project:dove.figure"
    });
  }
  const openConcerns = (reviewConcerns.items ?? []).filter((item) => item.status !== "resolved");
  for (const concern of openConcerns) {
    addFinding(findings, {
      id: findingId("review", "open-concern", concern.id),
      severity: concern.severity ?? "medium",
      category: "review",
      summary: `Review concern ${concern.id} remains open: ${concern.summary ?? "No summary."}`,
      artifactPaths: [ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.reviewState],
      reviewConcernIds: [concern.id],
      suggestedNextCommand: "project:dove.review"
    });
  }
  if ((reviewState.lastVerdict === "needs-work" || reviewState.lastVerdict === "needs-evidence") && openConcerns.length === 0) {
    addFinding(findings, {
      id: findingId("review", "verdict-without-open-concerns", reviewState.lastVerdict),
      severity: "medium",
      category: "review",
      summary: `Review state verdict is ${reviewState.lastVerdict}, but no open concern items were found.`,
      artifactPaths: [ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.reviewConcerns],
      suggestedNextCommand: "project:dove.review"
    });
  }
  const activeComparisonTargets = versionComparisons.activeTargets ?? [];
  if (activeComparisonTargets.length > 0 && (versionComparisons.items ?? []).length === 0) {
    addFinding(findings, {
      id: findingId("version", "active-targets-without-comparison", activeComparisonTargets.join("-")),
      severity: "medium",
      category: "version",
      summary: `Version comparison has active targets (${activeComparisonTargets.join(", ")}) but no comparison records.`,
      artifactPaths: [ARTIFACT_PATHS.versionComparisons],
      suggestedNextCommand: "project:dove.version"
    });
  }
  if (/\[ \]|TODO|needs-review|blocked/i.test(checklistText) && PAPER_MAJOR_CHANGE_PROTOCOL_STAGES.includes("acceptance")) {
    addFinding(findings, {
      id: findingId("process", "open-checklist-items", ARTIFACT_PATHS.checklist),
      severity: "medium",
      category: "process",
      summary: "The checklist still appears to contain open, TODO, blocked, or needs-review items.",
      artifactPaths: [ARTIFACT_PATHS.checklist],
      suggestedNextCommand: "project:dove.status"
    });
  }
  const boardPhase = board.currentPhase ?? board.phase ?? state.pipeline?.currentStage ?? "init";
  if (workspaceIndex.lifecycle?.boardFamily && workspaceIndex.lifecycle.boardFamily !== "work-unit" && !workspaceIndex.lifecycle.familyIds.includes(workspaceIndex.lifecycle.boardFamily)) {
    addFinding(findings, {
      id: findingId("workspace", "invalid-board-family", workspaceIndex.lifecycle.boardFamily),
      severity: "medium",
      category: "workspace",
      summary: `Workspace lifecycle board family ${workspaceIndex.lifecycle.boardFamily} is not part of the current taxonomy.`,
      artifactPaths: [ARTIFACT_PATHS.workspaceIndex],
      suggestedNextCommand: "project:dove.status"
    });
  }
  const severityCounts = countBy(findings, "severity");
  const categoryCounts = countBy(findings, "category");
  const suggestedNextCommands = suggestedCommandsFromFindings(findings);
  const highestSeverity = findings.some((finding) => finding.severity === "high") ? "high" : findings.some((finding) => finding.severity === "medium") ? "medium" : findings.some((finding) => finding.severity === "low") ? "low" : "none";
  return {
    mode: "audit-only",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    summary: {
      highestSeverity,
      findingCount: findings.length,
      claimCount: evidence.claimCount,
      figureCount: (figureQa.items ?? []).length,
      openConcernCount: openConcerns.length,
      boardPhase,
      lifecycleTaxonomyVersion: PAPER_LIFECYCLE_TAXONOMY_VERSION,
      majorChangeProtocolStages: PAPER_MAJOR_CHANGE_PROTOCOL_STAGES
    },
    findings,
    severityCounts,
    categoryCounts,
    artifactPathsRead: artifactPathsRead(),
    suggestedNextCommands,
    diagnostics: {
      readErrors,
      workspaceLifecycle: workspaceIndex.lifecycle ?? null,
      requestedScope: typeof args.scope === "string" && args.scope.trim().length > 0 ? args.scope.trim() : null
    }
  };
}

// src/core/operator-ux.mjs
function isPlainObject3(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
function normalizeString4(value, fallback = null) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}
function normalizeStringArray7(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map((value) => normalizeString4(value)).filter(Boolean);
}
function uniqueStrings2(values) {
  return [...new Set(normalizeStringArray7(values))];
}
function compactObject(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => {
    if (value === null || value === void 0) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (isPlainObject3(value)) {
      return Object.keys(value).length > 0;
    }
    return true;
  }));
}
function text2(responseLanguage, zh, en) {
  return responseLanguage === "en" ? en : zh;
}
function firstString(...values) {
  for (const value of values) {
    const normalized = normalizeString4(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}
function responseLanguageFrom(data, fallback = "zh") {
  return normalizeString4(data?.responseLanguage ?? data?.statusHome?.responseLanguage, fallback) === "en" ? "en" : "zh";
}
var codeUx = {
  "source-requires-host-provenance": {
    blockedSummary: ["\u73B0\u5728\u5361\u5728\uFF1A\u9700\u8981\u4F60\u63D0\u4F9B\u771F\u5B9E\u6765\u6E90 URL \u6216\u53EF\u9A8C\u8BC1\u6765\u6E90\u4FE1\u606F\u3002", "Blocked: provide a real source URL or verifiable source information."],
    cannotContinueBecause: ["\u6CA1\u6709\u53EF\u9A8C\u8BC1 source\uFF0CDove \u4E0D\u80FD\u628A\u5019\u9009\u94FE\u63A5\u5F53\u6210 provenance\u3002", "There is no verifiable source, so Dove cannot treat candidate links as provenance."],
    nextOperatorAction: ["\u63D0\u4F9B URL\u3001\u6807\u9898\u548C locator\uFF0C\u6216\u5148\u8FD0\u884C\u6388\u6743\u68C0\u7D22\u540E\u518D\u767B\u8BB0 source\u3002", "Provide a URL, title, and locator, or run authorized retrieval before registering the source."],
    requiredEvidence: [["\u771F\u5B9E\u6765\u6E90 URL", "\u6765\u6E90\u6807\u9898", "locator \u6216\u53EF\u8BBF\u95EE\u51FA\u5904"], ["real source URL", "source title", "locator or accessible origin"]]
  },
  "source-provenance-unverified": {
    blockedSummary: ["\u73B0\u5728\u5361\u5728\uFF1A\u9700\u8981\u53EF\u9A8C\u8BC1 source\u3002", "Blocked: a verifiable source is required."],
    cannotContinueBecause: ["\u68C0\u7D22\u5931\u8D25\u30010 \u7ED3\u679C\u6216\u88AB\u5B89\u5168\u7B56\u7565\u963B\u65AD\u4E0D\u80FD\u767B\u8BB0\u4E3A source provenance\u3002", "Failed retrieval, zero results, or safety blocks cannot be registered as source provenance."],
    nextOperatorAction: ["\u8865\u5145\u5DF2\u8BBF\u95EE\u8FC7\u7684\u6765\u6E90\u6750\u6599\uFF0C\u6216\u6388\u6743\u4E3B\u673A\u4FA7\u91CD\u65B0\u68C0\u7D22\u3002", "Provide already-accessed source material, or authorize host-side retrieval again."],
    requiredEvidence: [["\u53EF\u8BBF\u95EE URL", "\u6765\u6E90\u6807\u9898", "\u68C0\u7D22/\u8BBF\u95EE\u8BC1\u636E"], ["accessible URL", "source title", "retrieval/access evidence"]]
  },
  "collect-source-provenance": {
    blockedSummary: ["\u73B0\u5728\u5361\u5728\uFF1A\u9700\u8981\u6536\u96C6\u771F\u5B9E\u6765\u6E90\u8BC1\u636E\u3002", "Blocked: collect real source evidence."],
    cannotContinueBecause: ["\u7F3A\u5C11 source provenance\u3002", "Source provenance is missing."],
    nextOperatorAction: ["\u8865 URL\u3001\u6807\u9898\u3001\u4F5C\u8005/\u5E74\u4EFD\u6216 locator\uFF0C\u7136\u540E\u518D\u8C03\u7528 source \u767B\u8BB0\u3002", "Add URL, title, authors/year, or locator, then register the source."],
    requiredEvidence: [["source provenance"], ["source provenance"]]
  },
  "provide-explicit-auto-step": {
    blockedSummary: ["\u73B0\u5728\u5361\u5728\uFF1A\u9700\u8981\u660E\u786E\u7684\u4E0B\u4E00\u6B65\u6267\u884C\u5185\u5BB9\u3002", "Blocked: an explicit next execution step is required."],
    cannotContinueBecause: ["\u53EA\u8BFB\u67E5\u8BE2\u6216\u7A7A\u6B65\u9AA4\u4E0D\u80FD\u63A8\u8FDB durable task\u3002", "Read-only queries or empty steps cannot advance a durable task."],
    nextOperatorAction: ["\u63D0\u4F9B\u5177\u4F53\u5199\u5165\u3001\u751F\u6210\u3001review \u6216 evidence step\u3002", "Provide a concrete write, generation, review, or evidence step."],
    requiredEvidence: [["\u660E\u786E auto step", "\u6267\u884C\u8BC1\u636E"], ["explicit auto step", "execution evidence"]]
  },
  "note-requires-host-synthesis": {
    blockedSummary: ["\u73B0\u5728\u5361\u5728\uFF1A\u9700\u8981\u4F60\u63D0\u4F9B note \u7684\u771F\u5B9E\u7EFC\u5408\u5185\u5BB9\u3002", "Blocked: provide real note synthesis content."],
    cannotContinueBecause: ["\u7A7A note \u4E0D\u80FD\u4F5C\u4E3A\u7814\u7A76\u8FDB\u5C55\u5199\u5165\u3002", "An empty note cannot be written as research progress."],
    nextOperatorAction: ["\u63D0\u4F9B summary\u3001quote\u3001claim \u6216 open question\u3002", "Provide a summary, quote, claim, or open question."],
    requiredEvidence: [["note summary/claim/quote"], ["note summary/claim/quote"]]
  },
  "draft-requires-host-content": {
    blockedSummary: ["\u73B0\u5728\u5361\u5728\uFF1A\u9700\u8981\u771F\u5B9E draft body\u3002", "Blocked: a real draft body is required."],
    cannotContinueBecause: ["\u6CA1\u6709\u6B63\u6587\u5185\u5BB9\u65F6\u4E0D\u80FD\u5199 draft\u3002", "A draft cannot be written without body content."],
    nextOperatorAction: ["\u63D0\u4F9B sectionId \u548C draft body\uFF0C\u6216\u53EA\u66F4\u65B0\u72B6\u6001\u65F6\u6539\u7528 section status\u3002", "Provide sectionId and draft body, or use section status for metadata-only updates."],
    requiredEvidence: [["draft body", "sectionId"], ["draft body", "sectionId"]]
  },
  "experience-requires-host-objective": {
    blockedSummary: ["\u73B0\u5728\u5361\u5728\uFF1A\u9700\u8981\u5B9E\u9A8C\u76EE\u6807\u6216\u5DF2\u6709 experimentId\u3002", "Blocked: an experiment goal or existing experimentId is required."],
    cannotContinueBecause: ["\u6CA1\u6709\u5B9E\u9A8C\u76EE\u6807\u65F6\u4E0D\u80FD\u89C4\u5212\u6216\u8BB0\u5F55 experiment\u3002", "An experiment cannot be planned or recorded without an objective."],
    nextOperatorAction: ["\u63D0\u4F9B goal/title/idea/experimentId \u548C\u6210\u529F\u6307\u6807\u3002", "Provide a goal/title/idea/experimentId and success metric."],
    requiredEvidence: [["\u5B9E\u9A8C\u76EE\u6807", "\u6210\u529F\u6307\u6807"], ["experiment objective", "success metric"]]
  },
  "review-loop-requires-host-material": {
    blockedSummary: ["\u73B0\u5728\u5361\u5728\uFF1A\u9700\u8981 review-loop \u6750\u6599\u3002", "Blocked: review-loop material is required."],
    cannotContinueBecause: ["\u7F3A\u5C11 draft \u5185\u5BB9\u6216 experiment \u76EE\u6807\u3002", "Draft content or an experiment objective is missing."],
    nextOperatorAction: ["\u63D0\u4F9B draft body \u6216 experience goal \u540E\u518D\u8FD0\u884C review-loop\u3002", "Provide a draft body or experience goal before running the review loop."],
    requiredEvidence: [["draft body \u6216 experience goal"], ["draft body or experience goal"]]
  },
  "awaiting-host-pass-result": {
    blockedSummary: ["\u73B0\u5728\u5361\u5728\uFF1A\u9700\u8981\u771F\u5B9E\u8BC1\u636E\u6216\u6267\u884C\u7ED3\u679C\u3002", "Blocked: real evidence or execution results are required."],
    cannotContinueBecause: ["Dove \u4E0D\u4F1A\u5047\u88C5\u5916\u90E8\u68C0\u7D22\u3001\u751F\u6210\u6216\u9A8C\u8BC1\u5DF2\u7ECF\u5B8C\u6210\u3002", "Dove will not pretend external retrieval, generation, or verification has completed."],
    nextOperatorAction: ["\u8865\u5145\u771F\u5B9E\u6267\u884C\u7ED3\u679C\u3001\u8BC1\u636E\u51FA\u5904\u6216\u5931\u8D25\u539F\u56E0\u3002", "Provide real execution results, evidence references, or the failure reason."],
    requiredEvidence: [["\u771F\u5B9E\u6267\u884C\u7ED3\u679C", "\u8BC1\u636E\u51FA\u5904"], ["real execution result", "evidence reference"]]
  },
  "host-tool-blocked": {
    blockedSummary: ["\u73B0\u5728\u5361\u5728\uFF1A\u5DE5\u5177\u6216\u6743\u9650\u963B\u6B62\u7EE7\u7EED\u3002", "Blocked: a tool or permission issue prevents progress."],
    cannotContinueBecause: ["\u9700\u8981\u8865\u6267\u884C\u7ED3\u679C\uFF0C\u6216\u5148\u8BA9\u76F8\u5173\u5DE5\u5177\u53EF\u7528\u3002", "Provide execution results, or make the needed tool available first."],
    nextOperatorAction: ["\u8865\u771F\u5B9E\u7ED3\u679C/\u8BC1\u636E\uFF0C\u6216\u4FEE\u590D\u5DE5\u5177\u6743\u9650\u540E\u91CD\u8BD5\u3002", "Provide real results/evidence, or fix tool permissions and retry."],
    requiredEvidence: [["\u771F\u5B9E\u6267\u884C\u7ED3\u679C", "\u5931\u8D25\u65E5\u5FD7\u6216\u8BC1\u636E\u51FA\u5904"], ["real execution result", "failure log or evidence reference"]]
  },
  "awaiting-provider-output": {
    blockedSummary: ["\u73B0\u5728\u5361\u5728\uFF1A\u7B49\u5F85\u751F\u6210\u7ED3\u679C\u3002", "Blocked: generation output is still missing."],
    cannotContinueBecause: ["\u7F3A\u5C11\u751F\u6210\u7ED3\u679C\uFF0C\u6216\u751F\u6210\u6240\u9700\u914D\u7F6E\u8FD8\u4E0D\u53EF\u7528\u3002", "Generation output is missing, or the required generation setup is unavailable."],
    nextOperatorAction: ["\u63D0\u4F9B\u751F\u6210\u7ED3\u679C\uFF0C\u6216\u914D\u7F6E\u73AF\u5883\u53D8\u91CF\u540E\u663E\u5F0F\u91CD\u8BD5\u3002", "Provide the generation output, or configure environment variables and retry explicitly."],
    requiredEvidence: [["\u751F\u6210\u7ED3\u679C", "\u751F\u6210\u8BB0\u5F55"], ["generation output", "generation record"]]
  },
  "awaiting-review-output": {
    blockedSummary: ["\u73B0\u5728\u5361\u5728\uFF1A\u7B49\u5F85\u72EC\u7ACB review \u7ED3\u679C\u3002", "Blocked: waiting for independent review results."],
    cannotContinueBecause: ["\u7F3A\u5C11 reviewer \u8F93\u51FA\u6216\u62A5\u544A\u3002", "Reviewer output or report is missing."],
    nextOperatorAction: ["\u5BFC\u5165 reviewer \u8F93\u51FA/\u62A5\u544A\uFF0C\u6216\u91CD\u65B0\u51C6\u5907 review \u6750\u6599\u3002", "Import reviewer output/report, or prepare the review materials again."],
    requiredEvidence: [["reviewer \u8F93\u51FA", "review report"], ["reviewer output", "review report"]]
  },
  "missing-required-materials": {
    blockedSummary: ["\u73B0\u5728\u5361\u5728\uFF1A\u7F3A\u5C11\u5FC5\u9700\u6750\u6599\u3002", "Blocked: required materials are missing."],
    cannotContinueBecause: ["\u6750\u6599\u4E0D\u8DB3\u65F6\u7EE7\u7EED\u4F1A\u4EA7\u751F\u4E0D\u53EF\u9A8C\u8BC1\u8F93\u51FA\u3002", "Continuing without materials would produce unverifiable output."],
    nextOperatorAction: ["\u8865\u9F50 requiredInputs/requiredMaterials \u540E\u518D\u7EE7\u7EED\u3002", "Provide requiredInputs/requiredMaterials before continuing."],
    requiredEvidence: [["\u5FC5\u9700\u8F93\u5165\u6750\u6599"], ["required input materials"]]
  },
  "verification-failed": {
    blockedSummary: ["\u73B0\u5728\u5361\u5728\uFF1A\u9A8C\u8BC1\u672A\u901A\u8FC7\u3002", "Blocked: verification failed."],
    cannotContinueBecause: ["\u5B8C\u6210\u6807\u51C6\u8FD8\u6CA1\u6709\u88AB\u8BC1\u636E\u8986\u76D6\u3002", "Done criteria are not covered by evidence yet."],
    nextOperatorAction: ["\u8865\u9A8C\u8BC1\u8BC1\u636E\u6216\u4FEE\u590D\u5931\u8D25\u9879\u540E\u91CD\u65B0 review\u3002", "Provide verification evidence or fix failed items before review."],
    requiredEvidence: [["\u9A8C\u8BC1\u8BC1\u636E", "\u5931\u8D25\u9879\u4FEE\u590D\u8BB0\u5F55"], ["verification evidence", "fix record"]]
  }
};
function localizedEntry(entry, responseLanguage, key) {
  if (!entry?.[key]) {
    return null;
  }
  const value = entry[key];
  if (Array.isArray(value) && Array.isArray(value[0])) {
    return responseLanguage === "en" ? value[1] : value[0];
  }
  if (Array.isArray(value)) {
    return responseLanguage === "en" ? value[1] : value[0];
  }
  return value;
}
function collectOperatorCodes(data) {
  if (!isPlainObject3(data)) {
    return [];
  }
  const resultCardAction = Array.isArray(data.resultCard?.nextActions) ? data.resultCard.nextActions[0] : null;
  return uniqueStrings2([
    data.status,
    data.kind,
    data.outcome,
    data.stopReason,
    data.reason,
    data.boundaryType,
    data.boundary?.type,
    data.boundary?.reason,
    data.resultCard?.kind,
    data.resultCard?.outcome,
    data.resultCard?.stopReason,
    data.resultCard?.boundaryType,
    data.resultCard?.boundary?.type,
    data.resultCard?.boundary?.reason,
    resultCardAction?.kind,
    resultCardAction?.boundaryType,
    resultCardAction?.reason,
    ...normalizeStringArray7(data.requiredActions),
    ...normalizeStringArray7(data.boundary?.requiredActions),
    ...normalizeStringArray7(data.resultCard?.requiredActions),
    ...normalizeStringArray7(data.resultCard?.boundary?.requiredActions),
    ...normalizeStringArray7(resultCardAction?.requiredActions)
  ]);
}
function buildOperatorUnblock(data, responseLanguage = responseLanguageFrom(data)) {
  const codes = collectOperatorCodes(data);
  const matchedCode = codes.find((code) => codeUx[code]);
  const entry = matchedCode ? codeUx[matchedCode] : null;
  const boundaryType = firstString(data?.boundaryType, data?.boundary?.type, data?.resultCard?.boundaryType, data?.resultCard?.boundary?.type);
  if (!entry && !boundaryType) {
    return null;
  }
  const blockedSummary = localizedEntry(entry, responseLanguage, "blockedSummary") ?? text2(responseLanguage, "\u5F53\u524D\u6CA1\u6709\u660E\u786E\u7684\u4EBA\u4E3A\u963B\u585E\uFF1B\u5982\u9700\u7EC6\u8282\u8BF7\u5C55\u5F00 full/debug\u3002", "There is no explicit operator block; expand full/debug for details.");
  const cannotContinueBecause = localizedEntry(entry, responseLanguage, "cannotContinueBecause");
  const nextOperatorAction = localizedEntry(entry, responseLanguage, "nextOperatorAction") ?? firstString(data?.nextAction, data?.nextCommand, data?.boundary?.command);
  const requiredEvidence = uniqueStrings2([
    ...localizedEntry(entry, responseLanguage, "requiredEvidence") ?? [],
    ...normalizeStringArray7(data?.requiredEvidence),
    ...normalizeStringArray7(data?.boundary?.requiredInputs)
  ]).slice(0, 8);
  return compactObject({
    summary: blockedSummary,
    why: cannotContinueBecause,
    operatorAction: nextOperatorAction,
    needs: requiredEvidence,
    blockedSummary,
    cannotContinueBecause,
    nextOperatorAction,
    requiredEvidence,
    boundaryType
  });
}
function normalizeStatusIntent(value) {
  const normalized = normalizeString4(value, "project-status").toLowerCase();
  return ["project-status", "health-check", "contract-test"].includes(normalized) ? normalized : "project-status";
}

// src/core/dove.mjs
function cloneFallback3(fallback) {
  return typeof fallback === "function" ? fallback() : structuredClone(fallback);
}
function resolveProjectPath(root, relativePath) {
  return path13.join(root, relativePath);
}
function safeReadJson2(root, relativePath, fallback, readErrors) {
  const fullPath = resolveProjectPath(root, relativePath);
  if (!fs12.existsSync(fullPath)) {
    return cloneFallback3(fallback);
  }
  try {
    return JSON.parse(fs12.readFileSync(fullPath, "utf8"));
  } catch (error) {
    readErrors.push({
      path: relativePath,
      message: error instanceof Error ? error.message : String(error)
    });
    return cloneFallback3(fallback);
  }
}
function safeReadText(root, relativePath, readErrors) {
  const fullPath = resolveProjectPath(root, relativePath);
  if (!fs12.existsSync(fullPath)) {
    return null;
  }
  try {
    return fs12.readFileSync(fullPath, "utf8");
  } catch (error) {
    readErrors.push({
      path: relativePath,
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}
function objectOrFallback(value, fallback) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : cloneFallback3(fallback);
}
var VALIDATION_OUTPUT_READ_LIMIT_BYTES = 24 * 1024;
var ARCHIVED_PACKET_STATUSES = new Set(DOVE_ARCHIVED_TASK_STATUSES);
function archivedPacketStatus(value) {
  return ARCHIVED_PACKET_STATUSES.has(String(value ?? "").trim().toLowerCase());
}
function isArchivedStatusTask(task) {
  return archivedPacketStatus(task?.status) || archivedPacketStatus(task?.lifecycleStatus);
}
function normalizeStringArray8(value) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return Array.from(new Set(values.map((item) => String(item).trim()).filter(Boolean)));
}
function mergeStringArrays(...values) {
  return Array.from(new Set(values.flatMap((value) => normalizeStringArray8(value))));
}
function activePackets(packets = []) {
  return packets.filter((packet) => !archivedPacketStatus(packet.status) && !archivedPacketStatus(packet.lifecycleStatus));
}
function classifyValidationOutputText(text3) {
  const normalized = String(text3 ?? "").toLowerCase();
  if (!normalized.trim()) {
    return "unknown";
  }
  const failurePatterns = [
    /\bnot ok\b/,
    /\btraceback\b/,
    /\bexception\b/,
    /\berror\b/,
    /\b[1-9]\d*\s+(?:failing|failures?|failed)\b/,
    /\bfailed\b/,
    /\bnon[- ]?zero\b/,
    /\bexit\s+[1-9]\d*\b/
  ];
  if (failurePatterns.some((pattern) => pattern.test(normalized))) {
    return "failed";
  }
  const passPatterns = [
    /\bpass(?:ed|es)?\b/,
    /\bsuccess(?:ful)?\b/,
    /\bok\b/,
    /\b0\s+(?:failing|failures?|failed)\b/,
    /\bexit\s+0\b/
  ];
  if (passPatterns.some((pattern) => pattern.test(normalized))) {
    return "passed";
  }
  return "unknown";
}
function summarizeValidationOutputText(text3) {
  return String(text3 ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
}
function aggregateValidationOutputStatus(signals, pathEvidence) {
  if (signals.some((signal) => signal.status === "failed")) {
    return "failed";
  }
  if (signals.some((signal) => signal.status === "passed")) {
    return "passed";
  }
  if (signals.length > 0) {
    return "unknown";
  }
  return pathEvidence.declaredPaths.length > 0 ? "missing" : "missing";
}
function buildValidationOutputEvidence(root, pathValues, textValues) {
  const paths = mergeStringArrays(...pathValues);
  const inspections = paths.map((item) => inspectDeclaredPath(root, item, { readText: true, maxBytes: VALIDATION_OUTPUT_READ_LIMIT_BYTES }));
  const pathEvidence = summarizePathInspections(inspections);
  const pathSignals = inspections.filter((item) => typeof item.text === "string").map((item) => ({
    source: "path",
    path: item.normalizedPath,
    status: classifyValidationOutputText(item.text),
    bytesRead: item.bytesRead ?? 0,
    truncated: Boolean(item.truncated),
    sample: summarizeValidationOutputText(item.text)
  }));
  const textSignals = mergeStringArrays(...textValues).map((text3, index) => ({
    source: "text",
    index,
    status: classifyValidationOutputText(text3),
    sample: summarizeValidationOutputText(text3)
  }));
  const signals = [...pathSignals, ...textSignals];
  const status = aggregateValidationOutputStatus(signals, pathEvidence);
  return {
    status,
    satisfied: status === "passed",
    declaredTextCount: textSignals.length,
    paths: pathEvidence,
    signals
  };
}
function acceptanceChecksInclude(mission, terms) {
  return mission.acceptanceChecks.some((check) => {
    const normalized = check.toLowerCase();
    return terms.some((term) => normalized.includes(term));
  });
}
function addPathProblemEvidence(missingEvidence, category, requirement, evidence) {
  const problemPaths = [
    ...evidence.missingPaths,
    ...evidence.unsafePaths,
    ...evidence.unreadablePaths,
    ...evidence.directoryPaths,
    ...evidence.unsupportedPaths
  ];
  if (problemPaths.length > 0) {
    missingEvidence.push({
      category,
      requirement,
      reason: "One or more declared evidence paths could not be safely inspected.",
      paths: problemPaths,
      suggestedInput: `Provide project-local existing file paths for ${requirement}.`
    });
  }
}
function buildEngineeringEvidence(root, args, inputs, mission, completedChecks, uncheckedChecks) {
  const missionPackets = activePackets(inputs.packets).filter((packet) => packet.doveDomain === "engineering");
  const changedFiles = inspectPathEvidence(root, mergeStringArrays(
    args.changedFilePaths,
    args.changedFiles,
    args.changedPaths,
    missionPackets.flatMap((packet) => packet.outputPaths)
  ));
  const validationEvidence = inspectPathEvidence(root, mergeStringArrays(
    args.validationEvidencePaths,
    args.validationEvidence,
    args.evidencePaths,
    args.testEvidencePaths,
    args.testPaths,
    missionPackets.flatMap((packet) => packet.evidenceLinks)
  ));
  const validationOutput = buildValidationOutputEvidence(root, [
    args.validationOutputPaths,
    args.validationLogPaths,
    args.testOutputPaths
  ], [
    args.validationOutputs,
    args.validationOutput
  ]);
  const reviewEvidence = inspectPathEvidence(root, mergeStringArrays(args.reviewEvidencePaths, args.reviewEvidence));
  const requiresValidationOutput = acceptanceChecksInclude(mission, ["test", "validation", "output"]);
  const requiresReview = acceptanceChecksInclude(mission, ["review"]);
  const requiresChecklist = acceptanceChecksInclude(mission, ["checklist"]);
  const missingEvidence = [];
  if (changedFiles.declaredPaths.length === 0) {
    missingEvidence.push({
      category: "changed-files",
      requirement: "changed files",
      reason: "No changed source, test, or documentation files were declared for the engineering return.",
      paths: [],
      suggestedInput: "Pass --changed-file or provide packet outputPaths."
    });
  } else if (!changedFiles.satisfied) {
    missingEvidence.push({
      category: "changed-files",
      requirement: "changed files",
      reason: "Changed-file evidence was declared but no existing project-local file could be inspected.",
      paths: changedFiles.declaredPaths,
      suggestedInput: "Pass project-local changed-file paths that exist in the workspace."
    });
  }
  addPathProblemEvidence(missingEvidence, "changed-files", "changed files", changedFiles);
  if (validationEvidence.declaredPaths.length === 0) {
    missingEvidence.push({
      category: "validation-evidence",
      requirement: "tests or validation evidence",
      reason: "No test, validation, or evidence file was declared for the engineering return.",
      paths: [],
      suggestedInput: "Pass --test-evidence, --validation-evidence, or provide packet evidenceLinks."
    });
  } else if (!validationEvidence.satisfied) {
    missingEvidence.push({
      category: "validation-evidence",
      requirement: "tests or validation evidence",
      reason: "Validation evidence was declared but no existing project-local evidence file could be inspected.",
      paths: validationEvidence.declaredPaths,
      suggestedInput: "Pass project-local test or validation evidence files that exist in the workspace."
    });
  }
  addPathProblemEvidence(missingEvidence, "validation-evidence", "tests or validation evidence", validationEvidence);
  if (requiresValidationOutput && validationOutput.status !== "passed") {
    missingEvidence.push({
      category: "validation-output",
      requirement: "validation output",
      reason: validationOutput.status === "failed" ? "Declared validation output contains failure signals." : validationOutput.status === "unknown" ? "Declared validation output is inconclusive." : "No passing validation output was declared.",
      paths: validationOutput.paths.declaredPaths,
      suggestedInput: "Pass a project-local validation output file or explicit validation output text showing a passing run."
    });
  }
  addPathProblemEvidence(missingEvidence, "validation-output", "validation output", validationOutput.paths);
  const reviewMissing = requiresReview && inputs.reviewState.lastVerdict === "not-reviewed" && !reviewEvidence.satisfied;
  if (reviewMissing) {
    missingEvidence.push({
      category: "review-evidence",
      requirement: "review evidence",
      reason: "The mission asks for review evidence, but no review verdict or review evidence path is available.",
      paths: reviewEvidence.declaredPaths,
      suggestedInput: "Run a review surface or pass project-local review evidence paths."
    });
  }
  addPathProblemEvidence(missingEvidence, "review-evidence", "review evidence", reviewEvidence);
  const checklistMissing = requiresChecklist && (!inputs.checklist || uncheckedChecks > 0);
  if (checklistMissing) {
    missingEvidence.push({
      category: "acceptance-checklist",
      requirement: "acceptance checklist",
      reason: !inputs.checklist ? "No checklist artifact is available." : "The checklist still has unchecked items.",
      paths: [ARTIFACT_PATHS.checklist],
      suggestedInput: "Complete or update the acceptance checklist before return."
    });
  }
  const pathProblemCount = changedFiles.problemCount + validationEvidence.problemCount + validationOutput.paths.problemCount + reviewEvidence.problemCount;
  const hasFailedValidationOutput = validationOutput.status === "failed";
  const hasReviewGap = missingEvidence.some((item) => item.category === "review-evidence");
  const hasChecklistGap = missingEvidence.some((item) => item.category === "acceptance-checklist");
  const hasEvidenceGaps = missingEvidence.some((item) => ["changed-files", "validation-evidence", "validation-output"].includes(item.category));
  return {
    declaredInputsOnly: true,
    noCommandExecution: true,
    noGitInspection: true,
    packetEvidence: {
      packetIds: missionPackets.map((packet) => packet.packetId ?? packet.id).filter(Boolean),
      missionPacketIds: missionPackets.map((packet) => packet.missionPacketId ?? packet.packetId ?? packet.id).filter(Boolean),
      missionPacketStorePath: ARTIFACT_PATHS.taskPacketsIndex,
      missionPacketPaths: Array.from(new Set(missionPackets.map((packet) => packet.missionPacketPath).filter(Boolean))),
      outputPaths: Array.from(new Set(missionPackets.flatMap((packet) => packet.outputPaths))),
      evidenceLinks: Array.from(new Set(missionPackets.flatMap((packet) => packet.evidenceLinks)))
    },
    changedFiles,
    validationEvidence,
    validationOutput,
    reviewEvidence,
    checklist: {
      completedCount: completedChecks,
      uncheckedCount: uncheckedChecks,
      path: ARTIFACT_PATHS.checklist
    },
    missingEvidence,
    readinessSignals: [
      { category: "changed-files", status: changedFiles.satisfied ? "present" : "missing" },
      { category: "validation-evidence", status: validationEvidence.satisfied ? "present" : "missing" },
      { category: "validation-output", status: validationOutput.status },
      { category: "review-evidence", status: hasReviewGap ? "missing" : "not-required-or-present" },
      { category: "acceptance-checklist", status: hasChecklistGap ? "incomplete" : "not-required-or-complete" }
    ],
    readiness: {
      ready: missingEvidence.length === 0,
      pathProblemCount,
      hasEvidenceGaps,
      hasFailedValidationOutput,
      hasReviewGap,
      hasChecklistGap,
      validationOutputStatus: validationOutput.status
    },
    evidenceReadPaths: Array.from(/* @__PURE__ */ new Set([
      ...changedFiles.existingPaths,
      ...validationEvidence.existingPaths,
      ...validationOutput.paths.existingPaths,
      ...reviewEvidence.existingPaths
    ]))
  };
}
function missionStageForPhase(phase) {
  const map = {
    init: "goal",
    sources: "goal",
    notes: "goal",
    research: "goal",
    plan: "design",
    outline: "design",
    checklist: "checklist",
    draft: "execution",
    experiments: "execution",
    citations: "execution",
    rebuttal: "execution",
    review: "audit",
    versions: "return"
  };
  return normalizeDoveMissionLifecycleStage(map[String(phase ?? "").trim()], "goal");
}
function domainForPacket(packet = {}) {
  const explicit = normalizeDoveDomainId(packet.doveDomain ?? packet.missionDomain ?? packet.domain, null);
  if (explicit) {
    return explicit;
  }
  if ((packet.experimentIds ?? []).length > 0 || packet.lifecycleFamily === "audit") {
    return "experiment";
  }
  if (packet.assignedRole === "reviewer" || packet.lifecycleFamily === "concern") {
    return "review";
  }
  if (packet.lifecycleFamily === "work-unit" || packet.lifecycleFamily === "campaign") {
    return "general";
  }
  return "paper";
}
function primaryRoleForStage(stage) {
  if (stage === "audit" || stage === "return") {
    return DOVE_PRIMARY_ROLES.find((role) => role.id === "reviewer");
  }
  if (stage === "execution") {
    return DOVE_PRIMARY_ROLES.find((role) => role.id === "builder");
  }
  return DOVE_PRIMARY_ROLES.find((role) => role.id === "planner");
}
function selectDomainGuidance(workspaceIndex, domain) {
  const guidance = workspaceIndex.dove?.domainGuidance ?? createDoveWorkspaceKernel().domainGuidance;
  return guidance.find((item) => item.id === domain) ?? createDoveWorkspaceKernel().domainGuidance.find((item) => item.id === "paper");
}
function missionPacketAliases(packet) {
  const packetId = String(packet.id ?? packet.packetId ?? packet.missionPacketId ?? "").trim();
  const packetPath = packet.packetPath ?? (packetId ? path13.join(ARTIFACT_PATHS.taskPacketsPacketsDir, `${packetId}.json`) : null);
  const packetContextPath2 = packet.packetContextPath ?? (packetId ? path13.join(ARTIFACT_PATHS.packetContextsDir, `${packetId}.json`) : null);
  return {
    packetId,
    packetPath,
    packetContextPath: packetContextPath2,
    missionPacketId: packetId,
    missionPacketPath: packetPath,
    missionPacketContextPath: packetContextPath2,
    missionPacketStorePath: ARTIFACT_PATHS.taskPacketsIndex,
    missionPacketStoreRoot: ARTIFACT_PATHS.taskPacketsDir,
    source: "mission-packet"
  };
}
function summarizePacket(packet) {
  return {
    id: packet.id,
    ...missionPacketAliases(packet),
    title: packet.title ?? packet.id,
    status: packet.status ?? "pending",
    lifecycleStatus: packet.lifecycleStatus ?? "active",
    lifecycleFamily: packet.lifecycleFamily ?? null,
    doveDomain: domainForPacket(packet),
    assignedRole: packet.assignedRole ?? null,
    phase: packet.phase ?? null,
    nextAction: packet.nextAction ?? null,
    outputPaths: normalizeStringArray8(packet.outputPaths),
    evidenceLinks: normalizeStringArray8(packet.evidenceLinks)
  };
}
function safeReadTaskPacketCatalog(root, taskPackets, readErrors) {
  try {
    return readTaskPacketCatalog(root);
  } catch (error) {
    readErrors.push({
      path: ARTIFACT_PATHS.taskPacketsDir,
      message: error instanceof Error ? error.message : String(error)
    });
    const packets = Array.isArray(taskPackets.items) ? taskPackets.items : [];
    return {
      index: taskPackets,
      packets,
      byId: new Map(packets.map((packet) => [packet.id, packet]).filter(([id]) => id))
    };
  }
}
function readDoveInputs(root) {
  const readErrors = [];
  const state = normalizeState(objectOrFallback(safeReadJson2(root, ARTIFACT_PATHS.state, createDefaultState, readErrors), createDefaultState));
  const board = objectOrFallback(safeReadJson2(root, ARTIFACT_PATHS.orchestrationBoard, () => createDefaultBoard(state), readErrors), () => createDefaultBoard(state));
  const workspaceIndex = normalizeWorkspaceIndex(objectOrFallback(safeReadJson2(root, ARTIFACT_PATHS.workspaceIndex, createWorkspaceIndex, readErrors), createWorkspaceIndex));
  const doveAuthorityManifest = normalizeDoveAuthorityManifest(objectOrFallback(safeReadJson2(root, ARTIFACT_PATHS.doveRootManifest, createDoveAuthorityManifest, readErrors), createDoveAuthorityManifest));
  const taskPackets = objectOrFallback(safeReadJson2(root, ARTIFACT_PATHS.taskPacketsIndex, createTaskPacketsIndex, readErrors), createTaskPacketsIndex);
  const taskCatalog = safeReadTaskPacketCatalog(root, taskPackets, readErrors);
  const reviewState = objectOrFallback(safeReadJson2(root, ARTIFACT_PATHS.reviewState, createReviewState, readErrors), createReviewState);
  const reviewConcerns = objectOrFallback(safeReadJson2(root, ARTIFACT_PATHS.reviewConcerns, () => ({ version: 2, items: [], updatedAt: null }), readErrors), () => ({ version: 2, items: [], updatedAt: null }));
  const versions = objectOrFallback(safeReadJson2(root, ARTIFACT_PATHS.versionsIndex, createVersionsIndex, readErrors), createVersionsIndex);
  const comparisons = objectOrFallback(safeReadJson2(root, ARTIFACT_PATHS.versionComparisons, createVersionComparisonsIndex, readErrors), createVersionComparisonsIndex);
  const experimentPlans = objectOrFallback(safeReadJson2(root, ARTIFACT_PATHS.experimentPlans, () => ({ version: 1, items: [], updatedAt: null }), readErrors), () => ({ version: 1, items: [], updatedAt: null }));
  const experimentResults = objectOrFallback(safeReadJson2(root, ARTIFACT_PATHS.experimentResults, () => ({ version: 1, items: [], updatedAt: null }), readErrors), () => ({ version: 1, items: [], updatedAt: null }));
  const experimentAudits = objectOrFallback(safeReadJson2(root, ARTIFACT_PATHS.experimentAudits, () => ({ version: 1, items: [], updatedAt: null }), readErrors), () => ({ version: 1, items: [], updatedAt: null }));
  const operatorLessons = objectOrFallback(safeReadJson2(root, ARTIFACT_PATHS.metaOperatorLessons, () => ({ version: 1, lessons: [], summary: { lessonCount: 0, activeLessonCount: 0, topLessonIds: [], lessonsPath: ARTIFACT_PATHS.metaOperatorLessons } }), readErrors), () => ({ version: 1, lessons: [], summary: { lessonCount: 0, activeLessonCount: 0, topLessonIds: [], lessonsPath: ARTIFACT_PATHS.metaOperatorLessons } }));
  const runtimeContinuation = normalizeRuntimeContinuationIndex(objectOrFallback(safeReadJson2(root, ARTIFACT_PATHS.runtimeContinuation, createRuntimeContinuationIndex, readErrors), createRuntimeContinuationIndex));
  const runtimeEvents = normalizeRuntimeEventsIndex(objectOrFallback(safeReadJson2(root, ARTIFACT_PATHS.runtimeEvents, createRuntimeEventsIndex, readErrors), createRuntimeEventsIndex));
  const runtimeResults = normalizeRuntimeResultsIndex(objectOrFallback(safeReadJson2(root, ARTIFACT_PATHS.runtimeResults, createRuntimeResultsIndex, readErrors), createRuntimeResultsIndex));
  const checklist = safeReadText(root, ARTIFACT_PATHS.checklist, readErrors);
  const packets = taskCatalog.packets.map(summarizePacket);
  return { state, board, workspaceIndex, doveAuthorityManifest, taskPackets, taskCatalog, packets, reviewState, reviewConcerns, versions, comparisons, experimentPlans, experimentResults, experimentAudits, operatorLessons, runtimeContinuation, runtimeEvents, runtimeResults, checklist, readErrors };
}
function normalizeDoveStatusTaskStatus(packet) {
  if ([packet.status, packet.lifecycleStatus].some(archivedPacketStatus)) {
    return "archived";
  }
  const raw = String(packet.status ?? packet.lifecycleStatus ?? "pending").trim().toLowerCase();
  if (DOVE_TASK_STATUSES.includes(raw)) {
    return raw;
  }
  if (raw === "active") {
    return "in-progress";
  }
  if (raw === "done") {
    return "completed";
  }
  return "pending";
}
function normalizeDoveStatusTaskStage(packet) {
  const raw = String(packet.stage ?? packet.taskStage ?? "").trim().toLowerCase();
  if (DOVE_TASK_STAGES.includes(raw)) {
    return raw;
  }
  const legacyStage = String(packet.missionStage ?? missionStageForPhase(packet.phase)).trim();
  if (["audit", "return"].includes(legacyStage)) {
    return "audit";
  }
  if (legacyStage === "execution") {
    return "execute";
  }
  return "plan";
}
function normalizeDoveStatusTaskDomain(packet) {
  const raw = String(packet.domain ?? packet.doveDomain ?? packet.missionDomain ?? "").trim().toLowerCase();
  if (DOVE_TASK_DOMAINS.includes(raw)) {
    return raw;
  }
  const legacyDomain = domainForPacket(packet);
  return DOVE_TASK_DOMAINS.includes(legacyDomain) ? legacyDomain : "engineering";
}
function normalizeDoveStatusCreatorKind(packet) {
  const raw = String(packet.creatorKind ?? "user").trim().toLowerCase();
  return DOVE_TASK_CREATOR_KINDS.includes(raw) ? raw : "user";
}
function normalizeDoveStatusLevel(packet) {
  const level = Number(packet.level);
  return Number.isFinite(level) ? level : 3;
}
function normalizeStatusContractStringArray(value) {
  if (Array.isArray(value)) {
    return normalizeStringArray8(value);
  }
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}
function firstStatusContractStringArray(...values) {
  for (const value of values) {
    const normalized = normalizeStatusContractStringArray(value);
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return [];
}
function statusCopyableCommand(command, packetId) {
  const publicCommand = toPublicDoveCommand(command, "project:dove.auto");
  return packetId ? `${publicCommand} --packet-id ${packetId}` : publicCommand;
}
function normalizeStatusContractRoutes(routes) {
  return (Array.isArray(routes) ? routes : []).map((route, index) => {
    const source = typeof route === "string" ? { command: route } : objectOrFallback(route, {});
    const command = typeof source.command === "string" && source.command.trim() ? toPublicDoveCommand(source.command, source.command) : null;
    if (!command) {
      return null;
    }
    return {
      label: source.label ?? source.title ?? null,
      command,
      copyableCommand: source.copyableCommand ?? source.copyCommand ?? null,
      packetId: source.packetId ?? source.taskPacketId ?? source.missionPacketId ?? null,
      when: source.when ?? source.reason ?? null,
      role: source.role ?? source.ownerRole ?? null,
      evidenceRequired: normalizeStatusContractStringArray(source.evidenceRequired ?? source.evidenceContract ?? source.evidenceExpectations),
      doneCriteria: normalizeStatusContractStringArray(source.doneCriteria),
      rank: Number.isFinite(source.rank) ? source.rank : index + 1
    };
  }).filter(Boolean);
}
function normalizeDoveStatusWorkContract(contract) {
  const explicit = objectOrFallback(contract, null);
  if (!explicit) {
    return null;
  }
  return {
    purpose: explicit.purpose ?? null,
    deliverables: normalizeStatusContractStringArray(explicit.deliverables),
    outOfScope: firstStatusContractStringArray(explicit.outOfScope, explicit.outOfScopeItems),
    evidenceContract: normalizeStatusContractStringArray(explicit.evidenceContract),
    doneCriteria: normalizeStatusContractStringArray(explicit.doneCriteria),
    recommendedRoutes: normalizeStatusContractRoutes(explicit.recommendedRoutes),
    practicalImpact: explicit.practicalImpact ?? null
  };
}
function summarizeDoveStatusTask(packet, responseLanguage = "zh") {
  const id = String(packet.id ?? packet.packetId ?? packet.missionPacketId ?? "").trim();
  const aliases = missionPacketAliases({ ...packet, id });
  const title = packet.title ?? id;
  const summary = packet.summary ?? packet.currentFocus ?? null;
  const stage = normalizeDoveStatusTaskStage(packet);
  const domain = normalizeDoveStatusTaskDomain(packet);
  const evidenceExpectations = normalizeStringArray8(packet.evidenceExpectations ?? packet.acceptanceChecks);
  const ownerRole = packet.ownerRole ?? null;
  const nextRole = packet.nextRole ?? null;
  const nextAction = packet.nextAction ?? null;
  const workContract = normalizeDoveStatusWorkContract(packet.workContract);
  const executionContract = normalizeDoveExecutionContract(packet.executionContract, null);
  const executionReadiness = doveExecutionContractReadiness(executionContract);
  const verifiedCriteria = normalizeDoveVerifiedCriteria(packet.verifiedCriteria);
  const criteriaCoverage = doveExecutionCriteriaCoverage(executionContract, verifiedCriteria);
  const validationEvidencePaths = normalizeStringArray8(packet.validationEvidencePaths);
  const verificationEvidencePaths = normalizeStringArray8(packet.verificationEvidencePaths);
  const criteriaEvidencePaths = normalizeStringArray8(verifiedCriteria.flatMap((item) => item.evidencePaths ?? []));
  const status = normalizeDoveStatusTaskStatus(packet);
  return {
    id,
    ...aliases,
    title,
    summary,
    parentId: packet.parentId ?? null,
    rootId: packet.rootId ?? null,
    level: normalizeDoveStatusLevel(packet),
    creatorKind: normalizeDoveStatusCreatorKind(packet),
    stage,
    domain,
    status,
    displayStatus: status === "completed" || status === "killed" ? "done" : status,
    lifecycleStatus: packet.lifecycleStatus ?? packet.status ?? null,
    dependencies: normalizeStringArray8(packet.dependencies ?? packet.dependencyIds),
    blockedBy: normalizeStringArray8(packet.blockedBy ?? packet.blockerIds),
    blockedReason: packet.blockedReason ?? packet.blockerReason ?? packet.blockingReason ?? null,
    lessonIds: normalizeStringArray8(packet.lessonIds),
    sourcePlanTaskId: packet.sourcePlanTaskId ?? null,
    derivedFrom: packet.derivedFrom ?? null,
    evidenceExpectations,
    workContract,
    executionContract,
    executionReadiness,
    verifiedCriteria,
    criteriaCoverage,
    validationEvidencePaths,
    verificationEvidencePaths,
    artifactRefs: mergeStringArrays(packet.artifactRefs, packet.artifactPaths, packet.outputPaths, packet.evidenceLinks, validationEvidencePaths, verificationEvidencePaths, criteriaEvidencePaths),
    outputPaths: normalizeStringArray8(packet.outputPaths),
    evidenceLinks: normalizeStringArray8(packet.evidenceLinks),
    contextPolicy: packet.contextPolicy ?? null,
    currentFocus: packet.currentFocus ?? null,
    nextAction,
    createdAt: packet.createdAt ?? null,
    updatedAt: packet.updatedAt ?? null,
    completedAt: packet.completedAt ?? null,
    killedAt: packet.killedAt ?? null,
    killReason: packet.killReason ?? null,
    archivedAt: packet.archivedAt ?? null,
    archiveReason: packet.archiveReason ?? null,
    ownerRole,
    nextRole,
    boundary: normalizeDoveBoundary(packet.boundary, null),
    boundaryHistory: Array.isArray(packet.boundaryHistory) ? packet.boundaryHistory.map((item) => normalizeDoveBoundary(item, null)).filter(Boolean) : [],
    handoff: normalizeDoveHandoff(packet.handoff, null),
    lastTransition: packet.lastTransition && typeof packet.lastTransition === "object" && !Array.isArray(packet.lastTransition) ? packet.lastTransition : null
  };
}
function sortStatusTasks(tasks) {
  return [...tasks].sort((left, right) => left.level - right.level || String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? "")) || left.id.localeCompare(right.id));
}
function sortRecentStatusTasks(tasks) {
  return [...tasks].sort((left, right) => String(right.updatedAt ?? right.completedAt ?? right.killedAt ?? right.createdAt ?? "").localeCompare(String(left.updatedAt ?? left.completedAt ?? left.killedAt ?? left.createdAt ?? "")) || left.id.localeCompare(right.id));
}
function runtimeResultEntries(inputs) {
  const entries = [
    ...Array.isArray(inputs.runtimeResults.items) ? inputs.runtimeResults.items : [],
    ...Array.isArray(inputs.runtimeResults.entries) ? inputs.runtimeResults.entries : []
  ].filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
  const byKey = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const key = entry.id ?? entry.runId ?? `${entry.surface ?? "runtime"}:${entry.packetId ?? "unknown"}:${entry.updatedAt ?? entry.recordedAt ?? entry.createdAt ?? byKey.size}`;
    byKey.set(key, entry);
  }
  return Array.from(byKey.values());
}
function runtimeIterationForPacket(entry, packetId) {
  const iterations = Array.isArray(entry.iterations) ? entry.iterations : [];
  return [...iterations].reverse().find((iteration) => [iteration.packetId, iteration.taskId, iteration.missionPacketId].includes(packetId)) ?? null;
}
function runtimeEntryTouchesPacket(entry, packetId) {
  if ([entry.packetId, entry.taskId, entry.missionPacketId, entry.selectedPacketId].includes(packetId)) {
    return true;
  }
  if (runtimeIterationForPacket(entry, packetId)) {
    return true;
  }
  return ["updatedTaskIds", "awaitingResultTaskIds", "autoRunnableTaskIds", "hostPassRequiredTaskIds", "runnableTaskIds", "blockedTaskIds", "pendingTaskIds"].some((field) => normalizeStringArray8(entry[field]).includes(packetId));
}
function runtimeTimestamp(entry, iteration = null) {
  return iteration?.completedAt ?? iteration?.startedAt ?? entry.updatedAt ?? entry.recordedAt ?? entry.completedAt ?? entry.createdAt ?? entry.startedAt ?? "";
}
function compactRuntimeExecutionReceipt(value) {
  const receipt = normalizeDoveExecutionReceipt(value, null);
  if (!receipt) {
    return null;
  }
  return {
    receiptId: receipt.receiptId ?? null,
    runId: receipt.runId ?? null,
    packetId: receipt.packetId ?? null,
    surface: receipt.surface ?? null,
    command: receipt.command ?? null,
    actionType: receipt.actionType ?? null,
    status: receipt.status ?? null,
    outcome: receipt.outcome ?? null,
    resultSummary: receipt.publicSafeSummary ?? receipt.resultSummary ?? null,
    lifecycleTransition: receipt.lifecycleTransition ?? null,
    evidenceCount: mergeStringArrays(
      receipt.evidenceLinks,
      receipt.evidencePaths,
      receipt.artifactRefs,
      receipt.artifactPaths,
      receipt.validationEvidencePaths,
      receipt.verificationEvidencePaths
    ).length,
    criteriaCoverage: receipt.criteriaCoverage ?? null,
    nextAction: receipt.nextAction ?? null
  };
}
function summarizeRuntimeRun(entry, packetId) {
  const iteration = runtimeIterationForPacket(entry, packetId);
  const executionReceipt = compactRuntimeExecutionReceipt(iteration?.output?.executionReceipt ?? iteration?.executionReceipt ?? entry.executionReceipt);
  return {
    id: entry.id ?? entry.runId ?? null,
    surface: entry.surface ?? null,
    packetId,
    status: iteration?.status ?? entry.status ?? null,
    outcome: iteration?.outcome ?? entry.outcome ?? null,
    stopReason: iteration?.stopReason ?? entry.stopReason ?? null,
    command: iteration?.command ?? entry.command ?? null,
    executionReceipt,
    startedAt: iteration?.startedAt ?? entry.startedAt ?? entry.createdAt ?? null,
    completedAt: iteration?.completedAt ?? entry.completedAt ?? entry.updatedAt ?? entry.recordedAt ?? null,
    updatedAt: entry.updatedAt ?? entry.recordedAt ?? null
  };
}
function lastRuntimeRunForTask(inputs, packetId) {
  return runtimeResultEntries(inputs).filter((entry) => runtimeEntryTouchesPacket(entry, packetId)).sort((left, right) => String(runtimeTimestamp(right, runtimeIterationForPacket(right, packetId))).localeCompare(String(runtimeTimestamp(left, runtimeIterationForPacket(left, packetId))))).map((entry) => summarizeRuntimeRun(entry, packetId))[0] ?? null;
}
function runtimeEventEntries(inputs) {
  return [
    ...Array.isArray(inputs.runtimeEvents?.items) ? inputs.runtimeEvents.items : [],
    ...Array.isArray(inputs.runtimeEvents?.entries) ? inputs.runtimeEvents.entries : []
  ].filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
}
function runtimeEventTimestamp(entry) {
  return entry.timestamp ?? entry.recordedAt ?? entry.completedAt ?? entry.createdAt ?? entry.startedAt ?? "";
}
function runtimeEventTouchesPacket(entry, packetId) {
  return [entry.packetId, entry.taskId, entry.missionPacketId, entry.boundary?.packetId].includes(packetId);
}
function summarizeRuntimeEvent(entry) {
  return {
    id: entry.id ?? entry.eventId ?? null,
    type: entry.type ?? entry.eventType ?? null,
    packetId: entry.packetId ?? entry.taskId ?? entry.missionPacketId ?? null,
    runId: entry.runId ?? null,
    surface: entry.surface ?? entry.sourceSurface ?? null,
    command: entry.command ?? null,
    fromStatus: entry.fromStatus ?? null,
    toStatus: entry.toStatus ?? null,
    boundaryId: entry.boundaryId ?? entry.boundary?.id ?? null,
    handoffId: entry.handoffId ?? entry.handoff?.id ?? null,
    summary: entry.summary ?? null,
    timestamp: runtimeEventTimestamp(entry)
  };
}
function lastRuntimeEventForTask(inputs, packetId) {
  return runtimeEventEntries(inputs).filter((entry) => runtimeEventTouchesPacket(entry, packetId)).sort((left, right) => String(runtimeEventTimestamp(right)).localeCompare(String(runtimeEventTimestamp(left)))).map(summarizeRuntimeEvent)[0] ?? null;
}
function continuationForTask(inputs, packetId) {
  const item = (Array.isArray(inputs.runtimeContinuation.items) ? inputs.runtimeContinuation.items : []).find((candidate) => candidate?.packetId === packetId) ?? null;
  if (!item) {
    return null;
  }
  return {
    kind: item.kind ?? null,
    command: item.command ?? null,
    packetId,
    programRunId: item.programRunId ?? null,
    followThroughId: item.followThroughId ?? null,
    summary: item.summary ?? null,
    requiredReadPaths: normalizeStringArray8(item.requiredReadPaths),
    readyAt: item.readyAt ?? null
  };
}
function openBoundaryForTask(task) {
  const boundary = normalizeDoveBoundary(task.boundary, null);
  return boundary?.status === "open" ? boundary : null;
}
function summarizeActionableBoundary(task) {
  const boundary = task.currentBoundary ?? openBoundaryForTask(task);
  if (!boundary || task.level === 0 || ["completed", "killed"].includes(task.status)) {
    return null;
  }
  return {
    id: boundary.id,
    type: boundary.type,
    status: boundary.status,
    packetId: task.id,
    title: task.title,
    taskStatus: task.status,
    reason: boundary.reason,
    summary: boundary.summary,
    requiredInputs: normalizeStringArray8(boundary.requiredInputs),
    requiredActions: normalizeStringArray8(boundary.requiredActions),
    ownerRole: boundary.ownerRole ?? task.ownerRole ?? null,
    nextRole: boundary.nextRole ?? task.nextRole ?? null,
    createdAt: boundary.createdAt ?? null,
    command: boundary.command ?? task.nextAction ?? null,
    runId: boundary.runId ?? null,
    handoff: normalizeDoveHandoff(task.handoff, null)
  };
}
function boundaryRecommendsBlocked(task) {
  const boundary = task.currentBoundary ?? openBoundaryForTask(task);
  return ["blocked-boundary", "missing-executable-contract", "plan-output-not-executable", "missing-required-materials", "missing-secret-env", "provider-failed", "workflow-error-boundary", "verification-failed", "debug-retry-required", "fix-required", "needs-review", "awaiting-provider-output", "awaiting-review-output"].includes(boundary?.type);
}
function statusActionBase(fields = {}) {
  return {
    proposalOnly: true,
    noAutoApply: true,
    confirmationRequired: true,
    ...fields
  };
}
function boundaryActionKind(boundary) {
  if (["needs-review", "awaiting-review-output"].includes(boundary?.type)) {
    return "send-to-review";
  }
  if (["awaiting-host-pass", "awaiting-host-pass-result", "awaiting-host-results", "host-tool-blocked", "awaiting-provider-output", "missing-executable-contract", "plan-output-not-executable", "missing-required-materials", "missing-secret-env", "verification-failed", "debug-retry-required", "fix-required"].includes(boundary?.type)) {
    return "provide-evidence-or-result";
  }
  return "adjust-status";
}
function toPublicDoveCommand(command, fallback = "project:dove.status") {
  const normalized = typeof command === "string" ? command.trim() : "";
  if (!normalized) {
    return fallback;
  }
  if (normalized.startsWith("project:dove.")) {
    return normalized;
  }
  const toolRoutes = {
    run_dove_auto: "project:dove.auto",
    run_dove_operator: "project:dove.operator",
    create_dove_task: "project:dove.mission",
    record_dove_mission_pass: "project:dove.mission",
    apply_dove_status_adjustments: "project:dove.status",
    run_audio_review: "project:dove.review",
    run_dove_review_loop: "project:dove.review-loop",
    run_experience_workflow: "project:dove.experience",
    run_figure_workflow: "project:dove.figure",
    register_source: "project:dove.source",
    upsert_note: "project:dove.note",
    upsert_draft: "project:dove.draft",
    build_rebuttal: "project:dove.rebuttal"
  };
  return toolRoutes[normalized] ?? (normalized.startsWith("dove.") ? `project:${normalized}` : fallback);
}
function statusPublicCommandText(command, fallback = null) {
  const raw = typeof command === "string" ? command.trim() : "";
  if (!raw) {
    return fallback;
  }
  const firstToken = raw.split(/\s+/u)[0];
  const publicCommand = toPublicDoveCommand(firstToken, fallback);
  const projectMatch = publicCommand?.match(/^project:dove\.([a-z0-9.-]+)$/u);
  if (projectMatch) {
    return `dove.${projectMatch[1]}`;
  }
  return /^dove\.[a-z0-9.-]+$/u.test(publicCommand ?? "") ? publicCommand : fallback;
}
function boundaryActionCommand(task, boundary, kind) {
  if (kind === "send-to-review") {
    return "project:dove.review";
  }
  if (kind === "adjust-status") {
    return null;
  }
  const command = toPublicDoveCommand(boundary?.command ?? task.continuationState?.command ?? task.nextAction, null);
  return command === "project:dove.status" ? null : command;
}
function boundaryActionLabel(kind, responseLanguage) {
  if (kind === "send-to-review") {
    return doveText(responseLanguage, "boundaryActionReviewLabel");
  }
  if (kind === "provide-evidence-or-result") {
    return doveText(responseLanguage, "boundaryActionEvidenceLabel");
  }
  if (kind === "kill-through-status") {
    return doveText(responseLanguage, "boundaryActionKillLabel");
  }
  if (kind === "continue-resume") {
    return doveText(responseLanguage, "boundaryActionContinueLabel");
  }
  return doveText(responseLanguage, "boundaryActionStatusLabel");
}
function boundaryActionOption(kind, task, boundary, responseLanguage) {
  const command = boundaryActionCommand(task, boundary, kind);
  return statusActionBase({
    id: `${boundary.id}-${kind}`,
    label: boundaryActionLabel(kind, responseLanguage),
    kind,
    command,
    tool: ["adjust-status", "kill-through-status"].includes(kind) ? "apply_dove_status_adjustments" : null,
    packetId: task.id,
    boundaryId: boundary.id,
    boundaryType: boundary.type,
    requires: mergeStringArrays(boundary.requiredInputs, boundary.requiredActions),
    requiredInputs: normalizeStringArray8(boundary.requiredInputs),
    requiredActions: normalizeStringArray8(boundary.requiredActions)
  });
}
function buildBoundaryActionCard(task, responseLanguage = "zh") {
  const boundary = task.actionableBoundary ?? summarizeActionableBoundary(task);
  if (!boundary) {
    return null;
  }
  const primaryKind = boundaryActionKind(boundary);
  const optionKinds = Array.from(new Set([
    task.continuationState || task.nextAction ? "continue-resume" : null,
    primaryKind,
    "adjust-status",
    "kill-through-status"
  ].filter(Boolean)));
  const options = optionKinds.map((kind) => boundaryActionOption(kind, task, boundary, responseLanguage));
  const primaryOption = options.find((option) => option.kind === primaryKind) ?? options[0];
  return statusActionBase({
    id: `boundary-action-${boundary.id}`,
    label: primaryOption.label,
    kind: primaryKind,
    command: primaryOption.command,
    tool: primaryOption.tool,
    packetId: task.id,
    title: task.title,
    boundaryId: boundary.id,
    boundaryType: boundary.type,
    reason: boundary.reason,
    summary: boundary.summary,
    requiredInputs: normalizeStringArray8(boundary.requiredInputs),
    requiredActions: normalizeStringArray8(boundary.requiredActions),
    requires: mergeStringArrays(boundary.requiredInputs, boundary.requiredActions),
    ownerRole: boundary.ownerRole ?? task.ownerRole ?? null,
    nextRole: boundary.nextRole ?? task.nextRole ?? null,
    handoff: boundary.handoff ?? task.handoff ?? null,
    runId: boundary.runId ?? null,
    options
  });
}
function rankStatusActionCards(cards) {
  return cards.filter(Boolean).sort((left, right) => (left.priority ?? 100) - (right.priority ?? 100) || String(left.title ?? "").localeCompare(String(right.title ?? ""))).slice(0, 3).map((card, index) => {
    const { priority, ...rest } = card;
    return { ...rest, rank: index + 1 };
  });
}
var STATUS_RECOVERY_CARD_KINDS = /* @__PURE__ */ new Set([
  "reconcile-completion-consistency",
  "boundary-resume",
  "provide-evidence",
  "blocked-unblock",
  "missing-executable-contract",
  "missing-required-materials",
  "verification-failed",
  "review-needed"
]);
function statusCardNeedsRecovery(card) {
  return STATUS_RECOVERY_CARD_KINDS.has(card?.kind);
}
function recoveryCandidateDetail(card) {
  if (!card) {
    return null;
  }
  return compactStatusObject({
    kind: card.kind,
    title: card.title,
    command: card.command,
    copyableCommand: card.copyableCommand,
    packetId: card.packetId ?? null,
    nextRole: card.nextRole ?? null,
    boundaryType: card.boundaryType ?? card.boundary?.type ?? null,
    evidenceRequired: normalizeStringArray8(card.evidenceRequired).slice(0, 8),
    doneCriteria: normalizeStringArray8(card.doneCriteria).slice(0, 8),
    requiredMaterials: normalizeStringArray8(card.requiredMaterials).slice(0, 8),
    criteriaCoverage: card.criteriaCoverage ? {
      complete: Boolean(card.criteriaCoverage.complete),
      missing: normalizeStringArray8(card.criteriaCoverage.missing).slice(0, 8)
    } : null
  });
}
function statusCardIsStatusTriage(card, command) {
  return statusCardNeedsRecovery(card) && command === "project:dove.status";
}
function statusCardPublicCommand(card, fallback = null) {
  const command = typeof card?.command === "string" && card.command.trim() ? card.command.trim() : null;
  if (!command) {
    return fallback;
  }
  const publicCommand = toPublicDoveCommand(command, fallback);
  if (!publicCommand || statusCardIsStatusTriage(card, publicCommand)) {
    return fallback;
  }
  return publicCommand;
}
function statusCardCopyableCommand(card, fallback = null) {
  const explicit = typeof card?.copyableCommand === "string" && card.copyableCommand.trim() ? card.copyableCommand.trim() : null;
  if (explicit && !statusCardIsStatusTriage(card, explicit)) {
    return explicit;
  }
  const command = statusCardPublicCommand(card, null);
  if (command) {
    if (card?.packetId && /^project:dove\.(mission|auto|operator|source|note|figure|experience|draft|review|review-loop|rebuttal)$/.test(command)) {
      return statusCopyableCommand(command, card.packetId);
    }
    return command;
  }
  const firstAction = typeof card?.firstAction === "string" && card.firstAction.trim() ? card.firstAction.trim() : null;
  if (firstAction && (firstAction.startsWith("project:dove.") || firstAction.startsWith("dove."))) {
    const publicFirstAction = toPublicDoveCommand(firstAction, null);
    return publicFirstAction && !statusCardIsStatusTriage(card, publicFirstAction) ? publicFirstAction : fallback;
  }
  return fallback;
}
function statusShortText(value, maxLength = 90) {
  const text3 = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text3) {
    return "";
  }
  return text3.length > maxLength ? `${text3.slice(0, maxLength - 1)}\u2026` : text3;
}
var STATUS_PUBLIC_FORBIDDEN_TEXT = /\.dove\/|\bproject:dove\.[a-z0-9.-]+|--packet-id\b|\b(?:packetId|taskPacketId|missionPacketId|runId|receiptId|boundaryId|boundaryType|mutationMode|patch-plan|direct-process|ownerRole|nextRole|handoff|providerId|sourceSvgPath|targetFinalSvgPath|finalSvgPath|outputManifestPath|svgContent|queueSummary|queuePreview|preActionGuidance|resultCard)\b|\b(?:query_dove_status|run_dove_auto|record_dove_mission_pass|run_figure_workflow|run_dove_operator|record_document_evidence|upsert_note|upsert_draft|register_source)\b/u;
var STATUS_INTERNAL_ACTION_CODE = /^(?:[a-z]+-){2,}[a-z]+$/u;
function statusPublicText(value, responseLanguage = "zh", maxLength = 90) {
  let text3 = statusShortText(value, maxLength);
  if (!text3) {
    return "";
  }
  text3 = text3.replace(/\btask-[a-z0-9][a-z0-9-]*\b/giu, responseLanguage === "en" ? "the current task" : "\u5F53\u524D\u4EFB\u52A1");
  if (STATUS_PUBLIC_FORBIDDEN_TEXT.test(text3) || STATUS_INTERNAL_ACTION_CODE.test(text3)) {
    return "";
  }
  return text3;
}
function statusFirstPublicText(responseLanguage, maxLength, ...values) {
  for (const value of values) {
    const text3 = statusPublicText(value, responseLanguage, maxLength);
    if (text3) {
      return text3;
    }
  }
  return "";
}
function statusRecoverySubject(card, responseLanguage = "zh") {
  if (card?.packetId) {
    return responseLanguage === "en" ? "the current task" : "\u5F53\u524D\u4EFB\u52A1";
  }
  return statusFirstPublicText(responseLanguage, 72, card?.title, card?.label, card?.kind);
}
function statusRecoveryRequirement(card, responseLanguage = "zh") {
  const items = mergeStringArrays(
    card?.requiredMaterials,
    card?.evidenceRequired,
    card?.requiredInputs,
    card?.requires,
    card?.operatorUnblock?.needs,
    card?.operatorUnblock?.requiredEvidence
  ).map((item) => statusPublicText(item, responseLanguage, 52)).filter(Boolean).slice(0, 3);
  if (items.length === 0) {
    return "";
  }
  return items.join(responseLanguage === "en" ? ", " : "\u3001");
}
function statusRecoveryLabel(responseLanguage, zhAction, enAction, subject, requirement) {
  if (responseLanguage === "en") {
    const base2 = subject ? `First ${enAction} for ${subject}` : `First ${enAction}`;
    return requirement ? `${base2}: ${requirement}` : base2;
  }
  const base = subject ? `\u5148\u4E3A${subject}${zhAction}` : `\u5148${zhAction}`;
  return requirement ? `${base}\uFF1A${requirement}` : base;
}
function recoveryPathTitle(primaryCard, responseLanguage = "zh") {
  const kind = primaryCard?.kind;
  const subject = statusRecoverySubject(primaryCard, responseLanguage);
  const requirement = statusRecoveryRequirement(primaryCard, responseLanguage);
  if (kind === "missing-executable-contract") {
    return statusRecoveryLabel(responseLanguage, "\u8865\u53EF\u6267\u884C\u5408\u540C", "add the executable contract", subject, requirement);
  }
  if (kind === "missing-required-materials") {
    return statusRecoveryLabel(responseLanguage, "\u8865\u6750\u6599", "provide the missing materials", subject, requirement);
  }
  if (kind === "verification-failed") {
    return statusRecoveryLabel(responseLanguage, "\u8865\u9A8C\u8BC1\u8BC1\u636E", "provide verification evidence", subject, requirement);
  }
  if (kind === "review-needed") {
    return statusRecoveryLabel(responseLanguage, "\u9001\u5BA1\u6216\u5BFC\u5165\u5BA1\u67E5\u7ED3\u679C", "send for review or import the review result", subject, requirement);
  }
  if (kind === "reconcile-completion-consistency") {
    return statusRecoveryLabel(responseLanguage, "\u6838\u5BF9\u7236\u4EFB\u52A1\u548C checklist \u5B50\u4EFB\u52A1\u72B6\u6001", "reconcile parent and checklist child status", subject, requirement);
  }
  if (kind === "provide-evidence" || kind === "boundary-resume" || kind === "blocked-unblock") {
    return statusRecoveryLabel(responseLanguage, "\u8865\u771F\u5B9E\u7ED3\u679C", "provide the real result", subject, requirement);
  }
  return statusRecoveryLabel(responseLanguage, "\u5904\u7406\u5F53\u524D\u963B\u585E", "handle the current blocker", subject, requirement);
}
function buildRecoveryPathCard(primaryCard, recoveryCards = [], responseLanguage = "zh") {
  if (!primaryCard) {
    return null;
  }
  const command = statusCardPublicCommand(primaryCard);
  const action = statusCardCopyableCommand(primaryCard);
  const relatedCards = recoveryCards.filter((card) => card && card !== primaryCard);
  return statusActionBase({
    ...primaryCard,
    priority: Math.min(primaryCard.priority ?? 10, 9),
    kind: "recover-current-work",
    title: recoveryPathTitle(primaryCard, responseLanguage),
    why: primaryCard.operatorUnblock?.blockedSummary ?? primaryCard.why ?? primaryCard.operatorUnblock?.nextOperatorAction,
    command,
    firstAction: action,
    copyableCommand: action,
    recoveryPrimaryKind: primaryCard.kind,
    relatedActionCount: recoveryCards.length,
    relatedActionKinds: Array.from(new Set(recoveryCards.map((card) => card?.kind).filter(Boolean))).slice(0, 8),
    detail: compactStatusObject({
      primary: recoveryCandidateDetail(primaryCard),
      related: relatedCards.slice(0, 8).map(recoveryCandidateDetail),
      candidates: recoveryCards.slice(0, 12).map(recoveryCandidateDetail)
    })
  });
}
function collapseStatusRecoveryCards(cards, responseLanguage = "zh") {
  const recoveryCards = cards.filter(statusCardNeedsRecovery);
  if (recoveryCards.length === 0) {
    return cards;
  }
  const primaryRecovery = recoveryCards.slice().sort((left, right) => (left.priority ?? 100) - (right.priority ?? 100) || String(left.title ?? "").localeCompare(String(right.title ?? "")))[0];
  const collapsed = buildRecoveryPathCard(primaryRecovery, recoveryCards, responseLanguage);
  return [
    ...cards.filter((card) => !statusCardNeedsRecovery(card)),
    collapsed
  ].filter(Boolean);
}
function completionConsistencyFindings(completionConsistency = {}) {
  return Array.isArray(completionConsistency.findings) ? completionConsistency.findings : [];
}
function completionConsistencyOpenChecklistChildIds(completionConsistency = {}) {
  return new Set(completionConsistencyFindings(completionConsistency).flatMap((finding) => normalizeStringArray8(finding.openChecklistChildIds)));
}
function buildCompletionReconciliationCard(completionConsistency = {}, responseLanguage = "zh") {
  const findings = completionConsistencyFindings(completionConsistency);
  if (findings.length === 0) {
    return null;
  }
  const openChecklistChildIds = Array.from(completionConsistencyOpenChecklistChildIds(completionConsistency));
  return statusActionBase({
    priority: 70,
    kind: "reconcile-completion-consistency",
    title: doveText(responseLanguage, "statusHomeReconcileTitle", { count: findings.length }),
    why: doveText(responseLanguage, "statusHomeReconcileWhy"),
    command: "project:dove.status",
    firstAction: "project:dove.status",
    affectedParentIds: normalizeStringArray8(findings.map((finding) => finding.parentId)),
    findingCount: findings.length,
    openChecklistChildCount: openChecklistChildIds.length,
    openChecklistChildIds,
    evidenceRequired: openChecklistChildIds,
    doneCriteria: [doveText(responseLanguage, "statusHomeReconcileDoneCriteria")],
    findings
  });
}
function primaryStatusRoute(task = {}) {
  const routes = Array.isArray(task.workContract?.recommendedRoutes) ? task.workContract.recommendedRoutes : [];
  return routes.find((route) => typeof route?.command === "string" && route.command.trim()) ?? null;
}
function statusRouteEvidence(task = {}, route = null) {
  return firstStatusContractStringArray(route?.evidenceRequired, task.executionReadiness?.evidenceRequired, task.executionReadiness?.requiredMaterials, task.workContract?.evidenceContract, task.evidenceExpectations);
}
function statusRouteDoneCriteria(task = {}, route = null) {
  return firstStatusContractStringArray(route?.doneCriteria, task.executionContract?.convergence?.criteria, task.executionContract?.convergence?.definitionOfDone, task.workContract?.doneCriteria);
}
function statusInlineText(responseLanguage, zh, en) {
  return responseLanguage === "en" ? en : zh;
}
function statusTaskEvidenceBundle(task = {}) {
  return mergeStringArrays(
    task.artifactRefs,
    task.outputPaths,
    task.evidenceLinks,
    task.validationEvidencePaths,
    task.verificationEvidencePaths,
    task.verifiedCriteria?.flatMap((item) => item.evidencePaths ?? [])
  );
}
function missingExecutionMaterials(task = {}) {
  const required = normalizeStringArray8(task.executionReadiness?.requiredMaterials);
  if (required.length === 0) {
    return [];
  }
  const available = new Set(statusTaskEvidenceBundle(task).map((item) => item.toLowerCase()));
  return required.filter((item) => !available.has(item.toLowerCase()));
}
function hasExecutableContract(task = {}) {
  return task.executionReadiness?.ready === true;
}
function buildMissingExecutionContractCard(task, responseLanguage = "zh") {
  if (hasExecutableContract(task)) {
    return null;
  }
  return statusActionBase({
    priority: 20,
    kind: "missing-executable-contract",
    title: statusInlineText(responseLanguage, `\u8865\u9F50\u53EF\u6267\u884C\u5408\u540C\uFF1A${task.title}`, `Add executable contract: ${task.title}`),
    why: statusInlineText(responseLanguage, "Planner \u5FC5\u987B\u5148\u4EA7\u51FA action\u3001implementation\u3001convergence.criteria \u548C failureRoutes\uFF0C\u4E0D\u80FD\u8BA9\u4EFB\u52A1\u53EA\u505C\u7559\u5728 mission \u6587\u6848\u3002", "Planner must provide action, implementation, convergence.criteria, and failureRoutes before the task can execute."),
    packetId: task.id,
    command: "project:dove.mission",
    firstAction: statusCopyableCommand("project:dove.mission", task.id),
    evidenceRequired: normalizeStringArray8(task.executionReadiness?.missing).map((item) => item === "executionContract" ? item : `executionContract.${item}`),
    doneCriteria: [statusInlineText(responseLanguage, "\u4EFB\u52A1\u5305\u542B\u53EF\u6267\u884C\u5408\u540C\uFF0C\u5E76\u660E\u786E Builder \u8BC1\u636E\u4E0E Reviewer \u9A8C\u8BC1\u6807\u51C6\u3002", "Task has an executable contract with Builder evidence and Reviewer verification criteria.")],
    executionReadiness: task.executionReadiness,
    nextRole: "planner"
  });
}
function buildMissingExecutionMaterialsCard(task, responseLanguage = "zh") {
  if (!hasExecutableContract(task)) {
    return null;
  }
  const missingMaterials = missingExecutionMaterials(task);
  if (missingMaterials.length === 0) {
    return null;
  }
  const route = primaryStatusRoute(task);
  const command = toPublicDoveCommand(route?.command ?? task.nextAction, null);
  const actionableCommand = command === "project:dove.status" ? null : command;
  return statusActionBase({
    priority: 30,
    kind: "missing-required-materials",
    title: statusInlineText(responseLanguage, `\u8865\u6750\u6599/\u8F93\u5165\uFF1A${task.title}`, `Provide materials/inputs: ${task.title}`),
    why: statusInlineText(responseLanguage, "\u6267\u884C\u5408\u540C\u58F0\u660E\u4E86\u5FC5\u9700\u8F93\u5165\u6216 artifact\uFF0CBuilder \u4E0D\u80FD\u5728\u6750\u6599\u7F3A\u5931\u65F6\u5047\u88C5\u63A8\u8FDB\u3002", "The execution contract declares required inputs or artifacts; Builder cannot claim progress while materials are missing."),
    packetId: task.id,
    command: actionableCommand,
    firstAction: actionableCommand ? route?.copyableCommand ?? statusCopyableCommand(actionableCommand, task.id) : null,
    copyableCommand: actionableCommand ? route?.copyableCommand ?? statusCopyableCommand(actionableCommand, task.id) : null,
    evidenceRequired: missingMaterials,
    doneCriteria: [statusInlineText(responseLanguage, "\u7F3A\u5931\u6750\u6599\u88AB\u6CE8\u518C\u4E3A source\u3001artifact \u6216 verification evidence\u3002", "Missing materials are registered as source, artifact, or verification evidence.")],
    requiredMaterials: missingMaterials,
    executionContract: task.executionContract,
    nextRole: "planner"
  });
}
function taskNeedsBuilderExecution(task = {}) {
  const hasEvidence = statusTaskEvidenceBundle(task).length > 0;
  return hasExecutableContract(task) && missingExecutionMaterials(task).length === 0 && !(task.criteriaCoverage?.complete === false && hasEvidence);
}
function buildReadyBuilderExecutionCard(task, responseLanguage = "zh") {
  if (!taskNeedsBuilderExecution(task)) {
    return null;
  }
  const route = primaryStatusRoute(task);
  const command = toPublicDoveCommand(route?.command ?? task.nextAction, "project:dove.auto");
  return statusActionBase({
    priority: 40,
    kind: "ready-builder-execution",
    title: statusInlineText(responseLanguage, `\u6267\u884C\u5408\u540C\uFF1A${task.title}`, `Execute contract: ${task.title}`),
    why: statusInlineText(responseLanguage, "\u5408\u540C\u5DF2\u53EF\u6267\u884C\uFF0C\u4E0B\u4E00\u6B65\u5E94\u7531 Builder \u4EA7\u51FA\u771F\u5B9E\u8BC1\u636E\uFF0C\u800C\u4E0D\u662F\u7EE7\u7EED\u6574\u7406\u72B6\u6001\u3002", "The contract is executable; Builder should now produce real evidence instead of more bookkeeping."),
    packetId: task.id,
    command,
    firstAction: route?.copyableCommand ?? statusCopyableCommand(command, task.id),
    copyableCommand: route?.copyableCommand ?? statusCopyableCommand(command, task.id),
    evidenceRequired: statusRouteEvidence(task, route),
    doneCriteria: statusRouteDoneCriteria(task, route),
    executionContract: task.executionContract,
    nextRole: "builder"
  });
}
function buildVerificationGapCard(task, responseLanguage = "zh") {
  if (!hasExecutableContract(task) || task.criteriaCoverage?.complete !== false || statusTaskEvidenceBundle(task).length === 0) {
    return null;
  }
  const route = primaryStatusRoute(task);
  const command = toPublicDoveCommand(route?.command ?? task.nextAction, "project:dove.review");
  const actionableCommand = command === "project:dove.status" ? "project:dove.review" : command;
  return statusActionBase({
    priority: 45,
    kind: "verification-failed",
    title: statusInlineText(responseLanguage, `\u8865\u9A8C\u8BC1\u8986\u76D6\uFF1A${task.title}`, `Complete verification coverage: ${task.title}`),
    why: statusInlineText(responseLanguage, "\u5DF2\u6709\u6267\u884C\u8BC1\u636E\uFF0C\u4F46 verifiedCriteria \u5C1A\u672A\u8986\u76D6\u5168\u90E8 convergence.criteria\u3002", "Execution evidence exists, but verifiedCriteria does not cover all convergence.criteria."),
    packetId: task.id,
    command: actionableCommand,
    firstAction: route?.copyableCommand ?? statusCopyableCommand(actionableCommand, task.id),
    copyableCommand: route?.copyableCommand ?? statusCopyableCommand(actionableCommand, task.id),
    evidenceRequired: normalizeStringArray8(task.criteriaCoverage?.missing),
    doneCriteria: normalizeStringArray8(task.criteriaCoverage?.required),
    criteriaCoverage: task.criteriaCoverage,
    nextRole: "reviewer"
  });
}
function taskLooksLikeCleanupNoise(task = {}) {
  if (task.derivedFrom === "blocked-mission-investigation") {
    return true;
  }
  const searchable = normalizeStringArray8([task.id, task.title, task.summary, task.sourceId, task.sourceType, task.creatorKind]).join(" ").toLowerCase();
  return /\bdogfood\b|visible[-_ ]?test|operator[-_ ]?investigation|blocked[-_ ]?mission[-_ ]?investigation/.test(searchable);
}
function cleanupArchiveCandidates(tasks = []) {
  return sortStatusTasks(tasks.filter((task) => task.level !== 0 && !["completed", "killed", "archived"].includes(task.status) && !isArchivedStatusTask(task) && taskLooksLikeCleanupNoise(task))).slice(0, 5);
}
function buildCleanupArchiveCard(tasks = [], responseLanguage = "zh") {
  const candidates = cleanupArchiveCandidates(tasks);
  if (candidates.length === 0) {
    return null;
  }
  const candidateIds = candidates.map((task) => task.id);
  return statusActionBase({
    priority: 80,
    kind: "cleanup-archive",
    title: statusInlineText(responseLanguage, "\u5F52\u6863\u8FC7\u671F\u6D4B\u8BD5/\u8C03\u67E5\u566A\u97F3", "Archive stale test/investigation noise"),
    why: statusInlineText(responseLanguage, "\u53D1\u73B0\u7591\u4F3C dogfood \u6216 operator blocker-investigation \u566A\u97F3\uFF1B\u53EA\u5EFA\u8BAE\u901A\u8FC7\u663E\u5F0F status adjustment \u5F52\u6863\uFF0C\u4E0D\u5220\u9664\u8BC1\u636E\u3002", "Likely dogfood or operator blocker-investigation noise was found; archive it only through explicit status adjustment and preserve evidence."),
    command: "project:dove.status",
    firstAction: "project:dove.status --request-status-adjustment",
    copyableCommand: "project:dove.status --request-status-adjustment",
    evidenceRequired: candidateIds,
    doneCriteria: [statusInlineText(responseLanguage, "\u786E\u8BA4\u8FD9\u4E9B packet \u5DF2\u8FC7\u671F\u540E\uFF0C\u5C06\u5B83\u4EEC\u8C03\u6574\u4E3A archived\uFF0C\u4FDD\u7559 durable evidence\u3002", "After confirming these packets are stale, adjust them to archived while preserving durable evidence.")],
    requires: candidateIds,
    options: [{ kind: "preview-status-adjustments", label: statusInlineText(responseLanguage, "\u9884\u89C8\u72B6\u6001\u8C03\u6574", "Preview status adjustments"), command: "project:dove.status --request-status-adjustment" }]
  });
}
function buildStatusExecutionGaps(activeTasks = []) {
  const missingContractTasks = [];
  const missingMaterialTasks = [];
  const verificationGapTasks = [];
  const readyBuilderTasks = [];
  const requiredMaterials = [];
  const evidenceRequired = [];
  for (const task of activeTasks) {
    if (task.actionableBoundary) {
      continue;
    }
    if (!hasExecutableContract(task)) {
      missingContractTasks.push(task);
      evidenceRequired.push(...normalizeStringArray8(task.executionReadiness?.missing).map((item) => item === "executionContract" ? item : `executionContract.${item}`));
      continue;
    }
    const missingMaterials = missingExecutionMaterials(task);
    if (missingMaterials.length > 0) {
      missingMaterialTasks.push(task);
      requiredMaterials.push(...missingMaterials);
      evidenceRequired.push(...missingMaterials);
      continue;
    }
    if (task.criteriaCoverage?.complete === false && statusTaskEvidenceBundle(task).length > 0) {
      verificationGapTasks.push(task);
      evidenceRequired.push(...normalizeStringArray8(task.criteriaCoverage.missing));
      continue;
    }
    if (taskNeedsBuilderExecution(task)) {
      readyBuilderTasks.push(task);
      evidenceRequired.push(...statusRouteEvidence(task, primaryStatusRoute(task)));
    }
  }
  return {
    missingContractTaskIds: missingContractTasks.map((task) => task.id),
    missingMaterialTaskIds: missingMaterialTasks.map((task) => task.id),
    verificationGapTaskIds: verificationGapTasks.map((task) => task.id),
    readyBuilderTaskIds: readyBuilderTasks.map((task) => task.id),
    requiredMaterials: mergeStringArrays(requiredMaterials),
    evidenceRequired: mergeStringArrays(evidenceRequired),
    counts: {
      missingContract: missingContractTasks.length,
      missingMaterials: missingMaterialTasks.length,
      verificationGaps: verificationGapTasks.length,
      readyBuilder: readyBuilderTasks.length,
      blocking: missingContractTasks.length + missingMaterialTasks.length + verificationGapTasks.length
    }
  };
}
function buildStatusNextActionCards({ initTask, activeTasks, blockedTasks, visibleTasks, review, boundaryActionCards, completionConsistency, responseLanguage = "zh" }) {
  const cards = [];
  const seen = /* @__PURE__ */ new Set();
  const reconciliationChildIds = completionConsistencyOpenChecklistChildIds(completionConsistency);
  const pushCard = (key, card) => {
    if (!key || seen.has(key) || !card) {
      return;
    }
    seen.add(key);
    cards.push(statusActionBase(card));
  };
  if (!initTask) {
    pushCard("init", {
      priority: 0,
      kind: "init",
      title: doveText(responseLanguage, "statusHomeInitTitle"),
      why: doveText(responseLanguage, "statusHomeInitWhy"),
      command: "project:dove.init",
      firstAction: "project:dove.init",
      evidenceRequired: []
    });
  }
  pushCard("completion-consistency", buildCompletionReconciliationCard(completionConsistency, responseLanguage));
  for (const action of boundaryActionCards) {
    if (reconciliationChildIds.has(action.packetId)) {
      continue;
    }
    const kind = action.kind === "send-to-review" ? "review-needed" : action.kind === "provide-evidence-or-result" ? "provide-evidence" : "boundary-resume";
    const operatorUnblock = buildStatusOperatorUnblock({
      kind,
      reason: action.reason,
      boundaryType: action.boundaryType,
      boundary: {
        id: action.boundaryId,
        type: action.boundaryType,
        reason: action.reason,
        requiredInputs: action.requiredInputs,
        requiredActions: action.requiredActions,
        command: action.command
      },
      requiredActions: action.requiredActions,
      requiredEvidence: action.requires,
      nextAction: action.command
    }, responseLanguage);
    pushCard(`boundary:${action.boundaryId}`, {
      priority: 10,
      kind,
      title: doveText(responseLanguage, "statusHomeBoundaryTitle", { title: action.title ?? action.packetId }),
      why: operatorUnblock?.blockedSummary ?? doveText(responseLanguage, "statusHomeBoundaryWhy", { reason: action.reason }),
      packetId: action.packetId,
      command: action.command,
      firstAction: operatorUnblock?.nextOperatorAction ?? action.label,
      evidenceRequired: operatorUnblock?.requiredEvidence?.length ? operatorUnblock.requiredEvidence : action.requires,
      operatorUnblock,
      boundary: {
        id: action.boundaryId,
        type: action.boundaryType,
        reason: action.reason,
        requiredInputs: action.requiredInputs,
        requiredActions: action.requiredActions
      },
      handoff: action.handoff,
      boundaryActionCard: action
    });
  }
  for (const task of activeTasks) {
    if (reconciliationChildIds.has(task.id) || task.actionableBoundary) {
      continue;
    }
    pushCard(`execution-contract:${task.id}`, buildMissingExecutionContractCard(task, responseLanguage));
    pushCard(`execution-materials:${task.id}`, buildMissingExecutionMaterialsCard(task, responseLanguage));
    pushCard(`execution-builder:${task.id}`, buildReadyBuilderExecutionCard(task, responseLanguage));
    pushCard(`execution-verification:${task.id}`, buildVerificationGapCard(task, responseLanguage));
  }
  for (const task of activeTasks) {
    if (reconciliationChildIds.has(task.id) || !task.continuationState) {
      continue;
    }
    const route = primaryStatusRoute(task);
    const command = toPublicDoveCommand(task.continuationState.command ?? route?.command ?? task.nextAction, "project:dove.auto");
    pushCard(`continuation:${task.id}`, {
      priority: 20,
      kind: "continue-task",
      title: doveText(responseLanguage, "statusHomeContinuationTitle", { title: task.title }),
      why: route?.when ?? task.workContract?.practicalImpact ?? doveText(responseLanguage, "statusHomeContinuationWhy"),
      packetId: task.id,
      command,
      firstAction: route?.copyableCommand ?? statusCopyableCommand(command, task.id),
      copyableCommand: route?.copyableCommand ?? statusCopyableCommand(command, task.id),
      evidenceRequired: statusRouteEvidence(task, route),
      doneCriteria: statusRouteDoneCriteria(task, route),
      workContract: task.workContract,
      route,
      continuation: task.continuationState,
      handoff: task.handoff ?? null
    });
  }
  for (const task of blockedTasks) {
    const route = primaryStatusRoute(task);
    const command = toPublicDoveCommand(task.currentBoundary?.command ?? route?.command ?? task.nextAction, null);
    const actionableCommand = command === "project:dove.status" ? null : command;
    pushCard(`blocked:${task.id}`, {
      priority: 30,
      kind: "blocked-unblock",
      title: doveText(responseLanguage, "statusHomeBlockedTitle", { title: task.title }),
      why: doveText(responseLanguage, "statusHomeBlockedWhy", { reason: task.blockedReason ?? task.lastStopReason }),
      packetId: task.id,
      command: actionableCommand,
      firstAction: actionableCommand ? route?.copyableCommand ?? statusCopyableCommand(actionableCommand, task.id) : null,
      copyableCommand: actionableCommand ? route?.copyableCommand ?? statusCopyableCommand(actionableCommand, task.id) : null,
      evidenceRequired: normalizeStringArray8(task.evidenceExpectations),
      boundary: task.currentBoundary ?? null,
      handoff: task.handoff ?? null
    });
  }
  if ((review.unresolvedConcernCount ?? 0) > 0) {
    pushCard("review", {
      priority: 40,
      kind: "review-needed",
      title: doveText(responseLanguage, "statusHomeReviewTitle"),
      why: doveText(responseLanguage, "statusHomeReviewWhy"),
      command: "project:dove.review",
      firstAction: "project:dove.review",
      evidenceRequired: normalizeStringArray8(review.unresolvedConcernIds)
    });
  }
  for (const task of activeTasks) {
    if (reconciliationChildIds.has(task.id)) {
      continue;
    }
    const route = primaryStatusRoute(task);
    if (!task.nextAction && !route) {
      continue;
    }
    const command = toPublicDoveCommand(route?.command ?? task.nextAction, "project:dove.auto");
    pushCard(`next:${task.id}`, {
      priority: 50,
      kind: "continue-task",
      title: doveText(responseLanguage, "statusHomeContinueTitle", { title: task.title }),
      why: route?.when ?? task.workContract?.practicalImpact ?? doveText(responseLanguage, "statusHomeContinueWhy"),
      packetId: task.id,
      command,
      firstAction: route?.copyableCommand ?? statusCopyableCommand(command, task.id),
      copyableCommand: route?.copyableCommand ?? statusCopyableCommand(command, task.id),
      evidenceRequired: statusRouteEvidence(task, route),
      doneCriteria: statusRouteDoneCriteria(task, route),
      workContract: task.workContract,
      route,
      boundary: task.currentBoundary ?? null,
      handoff: task.handoff ?? null
    });
  }
  if (initTask && activeTasks.length === 0) {
    pushCard("mission", {
      priority: 60,
      kind: "create-mission",
      title: doveText(responseLanguage, "statusHomeCreateMissionTitle"),
      why: doveText(responseLanguage, "statusHomeCreateMissionWhy"),
      command: "project:dove.mission",
      firstAction: "project:dove.mission",
      evidenceRequired: []
    });
  }
  pushCard("cleanup-archive", buildCleanupArchiveCard(visibleTasks, responseLanguage));
  return rankStatusActionCards(collapseStatusRecoveryCards(cards, responseLanguage));
}
function buildStatusAdjustmentCard(task, recommendedStatus, responseLanguage = "zh") {
  return statusActionBase({
    presentation: "compact-status-adjustment-card",
    packetId: task.id,
    title: task.title,
    currentStatus: task.status,
    recommendedStatus,
    scope: doveText(responseLanguage, "compactCardScope", { stage: task.stage, domain: task.domain, status: task.status }),
    why: task.blockedReason ?? task.lastStopReason ?? doveText(responseLanguage, "compactCardFirstActionFallback"),
    firstAction: "apply_dove_status_adjustments",
    evidenceRequired: normalizeStringArray8(task.evidenceExpectations),
    boundaryOrResume: task.actionableBoundary ?? task.currentBoundary ?? null,
    confirmation: doveText(responseLanguage, "compactCardNoAutomaticExecution")
  });
}
function buildRecentExecutionReceipts(tasks = []) {
  const seen = /* @__PURE__ */ new Set();
  return sortRecentStatusTasks(tasks).map((task) => {
    const receipt = task.lastRun?.executionReceipt ?? null;
    if (!receipt) {
      return null;
    }
    return {
      ...receipt,
      packetId: receipt.packetId ?? task.id,
      title: task.title ?? null,
      completedAt: task.lastRun?.completedAt ?? task.lastRun?.updatedAt ?? null
    };
  }).filter((receipt) => {
    if (!receipt) {
      return false;
    }
    const key = receipt.receiptId ?? receipt.runId ?? `${receipt.packetId}:${receipt.completedAt ?? "unknown"}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).slice(0, 5);
}
function buildDailyHome({ initTask, activeTasks, blockedTasks, visibleTasks, review, boundaryActionCards, completionConsistency, executionGaps, archivedHiddenCount = 0, responseLanguage = "zh" }) {
  const nextActions = buildStatusNextActionCards({ initTask, activeTasks, blockedTasks, visibleTasks, review, boundaryActionCards, completionConsistency, responseLanguage });
  return {
    presentation: "dove-status-home",
    liveContextFirst: true,
    nextActions,
    recentExecutionReceipts: buildRecentExecutionReceipts(visibleTasks),
    missionList: buildStatusMissionList(visibleTasks, { archivedHiddenCount, nextActions, responseLanguage }),
    completionConsistency,
    executionGaps,
    boundaryActionCards,
    suppressUserFacingDumps: ["raw mission counts", "raw status counts", "recent completed missions", "recent killed missions"]
  };
}
function selectDailyHomeNextCommand(statusHome, fallbackNextCommand) {
  const ranked = Array.isArray(statusHome?.nextActions) ? statusHome.nextActions : Array.isArray(statusHome?.nextSteps?.ranked) ? statusHome.nextSteps.ranked : [];
  const firstAction = ranked.find((card) => typeof card?.command === "string" && card.command.trim());
  return firstAction?.command ?? statusHome?.nextStep?.command ?? statusHome?.nextSteps?.suggestedNextCommand ?? fallbackNextCommand;
}
function applicableLessonsForTask(inputs, task) {
  const lessons = Array.isArray(inputs.operatorLessons.lessons) ? inputs.operatorLessons.lessons : [];
  const linkedLessonIds = new Set(normalizeStringArray8(task.lessonIds));
  return lessons.filter((lesson) => {
    const status = String(lesson.status ?? "active").trim().toLowerCase();
    const packetIds = normalizeStringArray8(lesson.packetIds);
    return status === "active" && (packetIds.length === 0 || packetIds.includes(task.id) || linkedLessonIds.has(lesson.id));
  }).slice(0, 10).map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    mustObey: lesson.mustObey ?? true,
    nextTime: normalizeStringArray8(lesson.nextTime)
  }));
}
function unresolvedDependencyIdsForTask(task, byId) {
  return mergeStringArrays(task.dependencies, task.blockedBy).filter((dependencyId) => {
    const dependency = byId.get(dependencyId);
    return !dependency || dependency.status !== "completed";
  });
}
function enrichStatusTasks(tasks, inputs) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return tasks.map((task) => {
    const unresolvedDependencyIds = unresolvedDependencyIdsForTask(task, byId);
    const lastRun = lastRuntimeRunForTask(inputs, task.id);
    const lastEvent = lastRuntimeEventForTask(inputs, task.id);
    const continuationState = continuationForTask(inputs, task.id);
    const currentBoundary = openBoundaryForTask(task);
    const currentBoundaryBlocks = boundaryRecommendsBlocked({ ...task, currentBoundary });
    const blockedReason = task.blockedReason ?? (currentBoundaryBlocks ? currentBoundary?.reason : null) ?? (task.blockedBy.length > 0 ? `blocked-by:${task.blockedBy.join(",")}` : null) ?? (unresolvedDependencyIds.length > 0 ? `unresolved-dependencies:${unresolvedDependencyIds.join(",")}` : null);
    return {
      ...task,
      blockedReason,
      unresolvedDependencyIds,
      currentBoundary,
      actionableBoundary: summarizeActionableBoundary({ ...task, currentBoundary, blockedReason }),
      handoff: normalizeDoveHandoff(task.handoff, null),
      lastRun,
      lastEvent,
      lastStopReason: currentBoundary?.reason ?? lastRun?.stopReason ?? lastEvent?.summary ?? null,
      continuationState,
      applicableLessons: applicableLessonsForTask(inputs, task)
    };
  });
}
function hasTaskBlockerSignal(task) {
  return task.status === "blocked" || boundaryRecommendsBlocked(task) || Boolean(task.blockedReason) || task.blockedBy.length > 0 || normalizeStringArray8(task.unresolvedDependencyIds).length > 0;
}
function runtimeIndicatesInProgress(task) {
  return [task.lastRun?.status, task.lastRun?.outcome, task.continuationState?.kind].some((value) => String(value ?? "").includes("in-progress") || String(value ?? "").includes("continue"));
}
function runtimeIndicatesCompleted(task) {
  return Boolean(task.completedAt) || [task.lastRun?.status, task.lastRun?.outcome].some((value) => ["completed", "task-completed"].includes(String(value ?? "")));
}
function recommendedStatusForTask(task) {
  if (task.status === "archived" || isArchivedStatusTask(task)) {
    return "archived";
  }
  if (runtimeIndicatesCompleted(task)) {
    return "completed";
  }
  if (boundaryRecommendsBlocked(task) || hasTaskBlockerSignal(task)) {
    return "blocked";
  }
  if (runtimeIndicatesInProgress(task)) {
    return "in-progress";
  }
  if (task.status === "pending") {
    return "ready";
  }
  return task.status;
}
function buildStatusAdjustmentContract(tasks, responseLanguage = "zh") {
  const adjustableTasks = sortStatusTasks(tasks.filter((task) => task.level !== 0 && !["completed", "killed", "archived"].includes(task.status) && !isArchivedStatusTask(task)));
  const items = adjustableTasks.map((task, index) => {
    const recommendedStatus = recommendedStatusForTask(task);
    const adjustmentCard = buildStatusAdjustmentCard(task, recommendedStatus, responseLanguage);
    return {
      index: index + 1,
      packetId: task.id,
      title: task.title,
      currentStatus: task.status,
      recommendedStatus,
      level: task.level,
      stage: task.stage,
      domain: task.domain,
      blockedReason: task.blockedReason,
      lastStopReason: task.lastStopReason,
      currentBoundary: task.currentBoundary ?? null,
      actionableBoundary: task.actionableBoundary ?? null,
      handoff: task.handoff ?? null,
      lastEvent: task.lastEvent ?? null,
      adjustmentCard,
      choices: DOVE_TASK_STATUSES,
      confirmArgs: {
        adjustments: [{ packetId: task.id, status: recommendedStatus }],
        confirmed: true
      }
    };
  });
  return {
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    mutationTool: "apply_dove_status_adjustments",
    statusChoices: DOVE_TASK_STATUSES,
    itemCount: adjustableTasks.length,
    adjustmentCards: items.map((item) => item.adjustmentCard),
    items
  };
}
var STATUS_COMPACT_GROUP_LIMITS = {
  doing: 5,
  blocked: 5,
  todo: 5,
  done: 0,
  archived: 0
};
var STATUS_ADJUSTMENT_PREVIEW_LIMIT = 8;
function wantsFullDoveStatus(args = {}) {
  const detail = String(args.detail ?? args.view ?? args.resultMode ?? "").trim().toLowerCase();
  return detail === "full" || detail === "details" || detail === "debug" || booleanArg(args.full) || booleanArg(args.includeDetails);
}
function wantsMissionDetails(args = {}) {
  const detail = String(args.detail ?? args.view ?? args.resultMode ?? "").trim().toLowerCase();
  return booleanArg(args.showMissions) || booleanArg(args.includeMissionDetails) || booleanArg(args.missions) || ["missions", "mission-details", "mission-list"].includes(detail);
}
function wantsStatusAdjustmentPreview(args = {}) {
  const detail = String(args.detail ?? args.view ?? args.resultMode ?? "").trim().toLowerCase();
  return booleanArg(args.requestStatusAdjustment) || booleanArg(args.includeStatusAdjustmentPreview) || booleanArg(args.showStatusAdjustments) || ["status-adjustments", "adjustments", "status-preview"].includes(detail);
}
function compactStatusGroup(group = {}, limit = 0) {
  const items = Array.isArray(group.items) ? group.items : [];
  const shownItems = items.slice(0, limit);
  return {
    ...group,
    items: shownItems,
    itemCount: items.length,
    shownCount: shownItems.length,
    hiddenCount: Math.max(0, items.length - shownItems.length),
    defaultCollapsed: Boolean(group.defaultCollapsed || limit === 0)
  };
}
function compactStatusGroupCounts(groups = {}) {
  return Object.fromEntries(Object.keys(STATUS_COMPACT_GROUP_LIMITS).map((name) => {
    const group = groups[name] ?? {};
    const items = Array.isArray(group.items) ? group.items : [];
    return [name, {
      label: group.label ?? name,
      description: group.description ?? null,
      itemCount: group.itemCount ?? items.length,
      defaultCollapsed: true
    }];
  }));
}
function compactStatusMissionList(missionList = {}, options = {}) {
  const groups = missionList.groups ?? {};
  if (options.includeItems !== true) {
    const groupCounts = compactStatusGroupCounts(groups);
    const hiddenCount2 = Object.values(groupCounts).reduce((total, group) => total + (group.itemCount ?? 0), 0);
    return {
      presentation: missionList.presentation ?? "dove-mission-list",
      detail: "summary",
      summary: missionList.summary ?? {},
      statusModel: missionList.statusModel ?? {},
      defaultCollapsed: true,
      expandWhenAsked: true,
      expanded: false,
      missionItemsIncluded: false,
      groupsOmitted: true,
      groupCounts,
      hiddenItemCount: hiddenCount2,
      detailsAvailable: hiddenCount2 > 0
    };
  }
  const compactGroups = Object.fromEntries(Object.entries(STATUS_COMPACT_GROUP_LIMITS).map(([name, limit]) => [name, compactStatusGroup(groups[name], limit)]));
  const hiddenCount = Object.values(compactGroups).reduce((total, group) => total + (group.hiddenCount ?? 0), 0);
  return {
    ...missionList,
    detail: "compact",
    groups: compactGroups,
    previewLimits: STATUS_COMPACT_GROUP_LIMITS,
    hiddenItemCount: hiddenCount,
    detailsAvailable: hiddenCount > 0,
    expanded: true,
    missionItemsIncluded: true
  };
}
function compactWorkContract(contract) {
  if (!contract) {
    return null;
  }
  return {
    purpose: contract.purpose ?? null,
    deliverables: normalizeStringArray8(contract.deliverables).slice(0, 3),
    evidenceContract: normalizeStringArray8(contract.evidenceContract).slice(0, 3),
    doneCriteria: normalizeStringArray8(contract.doneCriteria).slice(0, 3),
    practicalImpact: contract.practicalImpact ?? null
  };
}
function compactStatusObject(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => {
    if (value === null || value === void 0) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (value && typeof value === "object") {
      return Object.keys(value).length > 0;
    }
    return true;
  }));
}
function statusNoWriteTelemetry() {
  return {
    applied: false,
    count: 0,
    writeIntent: "none",
    rollbackEligible: "not-applicable"
  };
}
function buildStatusOperatorUnblock(data, responseLanguage = "zh") {
  return buildOperatorUnblock({ responseLanguage, ...data }, responseLanguage);
}
function publicStatusBoundaryType(value) {
  const type = String(value ?? "").trim();
  if (!type) {
    return null;
  }
  if (["awaiting-audio-review-output"].includes(type)) {
    return "awaiting-review-output";
  }
  if (["missing-secret-env", "provider-failed"].includes(type)) {
    return "awaiting-provider-output";
  }
  if (["awaiting-host-pass", "awaiting-host-results", "needs-host-results", "needs-completion-evidence", "needs-explicit-progress-step"].includes(type)) {
    return "host-tool-blocked";
  }
  if (type.startsWith("audio-review-") || type === "needs-review") {
    return "verification-failed";
  }
  return type;
}
function compactStatusBoundary(boundary, responseLanguage = "zh") {
  if (!boundary || typeof boundary !== "object" || Array.isArray(boundary)) {
    return null;
  }
  const implementationBoundaryType = String(boundary.type ?? boundary.boundaryType ?? "").trim() || null;
  const type = publicStatusBoundaryType(implementationBoundaryType);
  const requiredInputs = normalizeStringArray8(boundary.requiredInputs);
  const requiredActions = normalizeStringArray8(boundary.requiredActions);
  const command = boundary.command ?? boundary.nextAction ?? null;
  const operatorUnblock = buildStatusOperatorUnblock({
    reason: boundary.reason,
    boundaryType: type ?? implementationBoundaryType,
    boundary: {
      type: type ?? implementationBoundaryType,
      reason: boundary.reason,
      requiredInputs,
      requiredActions,
      command
    },
    requiredActions,
    requiredEvidence: normalizeStringArray8(boundary.requiredEvidence),
    nextAction: command
  }, responseLanguage);
  return compactStatusObject({
    id: boundary.id ?? boundary.boundaryId ?? null,
    type,
    status: boundary.status ?? null,
    packetId: boundary.packetId ?? null,
    summary: boundary.summary ?? operatorUnblock?.blockedSummary ?? null,
    requiredInputs,
    command,
    ownerRole: boundary.ownerRole ?? null,
    nextRole: boundary.nextRole ?? null,
    operatorUnblock,
    detail: compactStatusObject({
      implementationBoundaryType: implementationBoundaryType && type && implementationBoundaryType !== type ? implementationBoundaryType : null,
      implementationReason: boundary.reason ?? null,
      requiredActions
    })
  });
}
function compactStatusActionCard(card, responseLanguage = "zh") {
  if (!card || typeof card !== "object") {
    return card;
  }
  const boundary = compactStatusBoundary(card.boundary, responseLanguage);
  const boundaryType = publicStatusBoundaryType(card.boundaryType ?? card.boundary?.type);
  const requiredActions = normalizeStringArray8(card.requiredActions ?? card.boundary?.requiredActions);
  const requires = normalizeStringArray8(card.requires);
  const operatorUnblock = buildStatusOperatorUnblock({
    kind: card.kind,
    reason: card.reason,
    boundaryType,
    boundary: card.boundary,
    requiredActions,
    requiredEvidence: mergeStringArrays(card.evidenceRequired, card.requiredMaterials, requires),
    nextAction: card.copyableCommand ?? card.firstAction ?? card.command
  }, responseLanguage) ?? boundary?.operatorUnblock ?? null;
  return compactStatusObject({
    presentation: card.presentation,
    proposalOnly: card.proposalOnly,
    noAutoApply: card.noAutoApply,
    rank: card.rank,
    priority: card.priority,
    kind: card.kind,
    recoveryPrimaryKind: card.recoveryPrimaryKind,
    relatedActionCount: card.relatedActionCount,
    relatedActionKinds: normalizeStringArray8(card.relatedActionKinds).slice(0, 8),
    title: card.title,
    why: card.why,
    packetId: card.packetId,
    affectedParentIds: normalizeStringArray8(card.affectedParentIds),
    findingCount: card.findingCount,
    openChecklistChildCount: card.openChecklistChildCount,
    openChecklistChildIds: normalizeStringArray8(card.openChecklistChildIds).slice(0, 20),
    command: card.command,
    firstAction: card.firstAction,
    copyableCommand: card.copyableCommand,
    evidenceRequired: normalizeStringArray8(card.evidenceRequired).slice(0, 5),
    doneCriteria: normalizeStringArray8(card.doneCriteria).slice(0, 5),
    workContract: compactWorkContract(card.workContract),
    executionReadiness: card.executionReadiness ? {
      ready: Boolean(card.executionReadiness.ready),
      status: card.executionReadiness.status ?? null,
      missing: normalizeStringArray8(card.executionReadiness.missing).slice(0, 5)
    } : void 0,
    requiredMaterials: normalizeStringArray8(card.requiredMaterials).slice(0, 5),
    criteriaCoverage: card.criteriaCoverage ? {
      complete: Boolean(card.criteriaCoverage.complete),
      missing: normalizeStringArray8(card.criteriaCoverage.missing).slice(0, 5)
    } : void 0,
    boundaryId: card.boundaryId ?? card.boundary?.id ?? null,
    summary: card.summary ?? card.boundary?.summary ?? null,
    requiredInputs: normalizeStringArray8(card.requiredInputs ?? card.boundary?.requiredInputs).slice(0, 5),
    ownerRole: card.ownerRole ?? card.boundary?.ownerRole ?? null,
    nextRole: card.nextRole ?? card.boundary?.nextRole ?? null,
    boundaryType,
    boundary,
    operatorUnblock,
    detail: compactStatusObject({
      requiredActions: requiredActions.slice(0, 5),
      requires: requires.slice(0, 5)
    })
  });
}
function compactStatusAdjustmentItem(item) {
  return {
    index: item.index,
    packetId: item.packetId,
    title: item.title,
    currentStatus: item.currentStatus,
    recommendedStatus: item.recommendedStatus,
    level: item.level,
    stage: item.stage,
    domain: item.domain,
    blockedReason: item.blockedReason ?? null,
    lastStopReason: item.lastStopReason ?? null,
    boundaryType: item.currentBoundary?.type ?? item.actionableBoundary?.type ?? null,
    choices: item.choices,
    confirmArgs: item.confirmArgs
  };
}
function compactStatusAdjustmentContract(contract = {}, options = {}) {
  const items = Array.isArray(contract.items) ? contract.items : [];
  if (options.includeItems !== true) {
    return {
      proposalOnly: contract.proposalOnly,
      noAutoApply: contract.noAutoApply,
      writes: Array.isArray(contract.writes) ? contract.writes : [],
      mutationTool: contract.mutationTool,
      statusChoices: contract.statusChoices,
      itemCount: contract.itemCount ?? items.length,
      previewItemCount: 0,
      hiddenItemCount: items.length,
      adjustmentCards: [],
      items: [],
      defaultCollapsed: true,
      expandWhenAsked: true,
      confirmationRequiresExplicitRequest: true,
      statusAdjustmentItemsIncluded: false,
      detailsAvailable: items.length > 0
    };
  }
  const shownItems = items.slice(0, STATUS_ADJUSTMENT_PREVIEW_LIMIT).map(compactStatusAdjustmentItem);
  const adjustmentCards = Array.isArray(contract.adjustmentCards) ? contract.adjustmentCards.slice(0, STATUS_ADJUSTMENT_PREVIEW_LIMIT).map((card) => compactStatusActionCard(card, contract.responseLanguage ?? "zh")) : [];
  return {
    proposalOnly: contract.proposalOnly,
    noAutoApply: contract.noAutoApply,
    writes: Array.isArray(contract.writes) ? contract.writes : [],
    mutationTool: contract.mutationTool,
    statusChoices: contract.statusChoices,
    itemCount: contract.itemCount ?? items.length,
    previewItemCount: shownItems.length,
    hiddenItemCount: Math.max(0, items.length - shownItems.length),
    adjustmentCards,
    items: shownItems,
    defaultCollapsed: true,
    expandWhenAsked: true,
    confirmationRequiresExplicitRequest: true,
    statusAdjustmentItemsIncluded: true,
    detailsAvailable: items.length > shownItems.length
  };
}
function buildHostFileCheckpointNotice() {
  return {
    required: true,
    detected: false,
    kind: "host-file-checkpoint",
    status: "not-programmatically-verifiable",
    scope: "host-runtime",
    verificationRequired: true,
    projectFilesRequired: true,
    externalWriteCaptureRequired: true,
    externalWriteCaptureVerified: false
  };
}
function buildMutationRollbackModel(root) {
  const indexPath = resolveProjectPath(root, ARTIFACT_PATHS.mutationsIndex);
  let index = createMutationProvenanceIndex();
  if (fs12.existsSync(indexPath)) {
    try {
      index = normalizeMutationProvenanceIndex(JSON.parse(fs12.readFileSync(indexPath, "utf8")));
    } catch {
      index = createMutationProvenanceIndex();
    }
  }
  const summary = index.summary ?? createMutationProvenanceIndex().summary;
  return {
    patchPlanSupported: true,
    hostTrackedFileEditsRequired: true,
    directProcessWritesAreRollbackSafe: false,
    lastMutationMode: summary.lastMutationMode ?? null,
    lastAppliedBy: summary.lastAppliedBy ?? null,
    hostRollbackEligible: Boolean(summary.hostRollbackEligible),
    hostRollbackIneligibleReason: summary.hostRollbackIneligibleReason ?? null,
    recommendedMutationMode: summary.recommendedMutationMode ?? null,
    rollbackAdvice: summary.rollbackAdvice ?? null,
    hostCheckpointVerified: false,
    externalWriteCaptureVerified: false,
    doveRestoreSupported: false,
    mutationProvenancePath: ARTIFACT_PATHS.mutationsIndex,
    mutationCount: summary.mutationCount ?? 0,
    patchPlanCount: summary.patchPlanCount ?? 0,
    directProcessCount: summary.directProcessCount ?? 0
  };
}
function buildDurableContextNotice(root, responseLanguage = "zh") {
  const hostCheckpoint = buildHostFileCheckpointNotice(root);
  const mutationRollbackModel = buildMutationRollbackModel(root);
  const recoveryActions = [
    { kind: "refresh-status", command: "project:dove.status", mutation: false },
    { kind: "apply-mutation-plan-with-host-tracked-edits", command: "mutationMode: patch-plan", mutation: true, handledByHost: true, hostTrackedFileEditsRequired: true },
    { kind: "use-direct-process-as-unverified", command: "mutationMode: direct-process", mutation: true, hostRollbackEligible: false, hostRollbackIneligibleReason: mutationRollbackModel.hostRollbackIneligibleReason, rollbackAdvice: mutationRollbackModel.rollbackAdvice },
    { kind: "adjust-status", command: "apply_dove_status_adjustments", mutation: true, confirmationRequired: true }
  ];
  return {
    presentation: "dove-durable-context-notice",
    stateSource: "filesystem-durable-state",
    durableRoot: ARTIFACT_PATHS.doveRoot,
    rollbackCoverage: "host-tracked-mutation-plan-required",
    nativeHostRollbackRequiresFileCheckpoint: true,
    hostCheckpointDetected: hostCheckpoint.detected,
    hostCheckpointStatus: hostCheckpoint.status,
    hostCheckpoint,
    mutationRollbackModel,
    projectVisibilityRequired: true,
    projectVisibilityVerified: false,
    externalWriteCaptureRequired: true,
    externalWriteCaptureVerified: false,
    doveRestoreSupported: false,
    doveRestoreCommand: null,
    automaticRollback: false,
    trackedDurablePaths: [ARTIFACT_PATHS.state, ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.mutationsIndex],
    localOnlyIgnoredPaths: [".dove/config.local.json"],
    summary: doveText(responseLanguage, "durableContextNoticeSummary"),
    recovery: doveText(responseLanguage, "durableContextNoticeRecovery"),
    recoveryActions
  };
}
function compactStatusBoundaryFromAction(action, responseLanguage = "zh") {
  if (!action) {
    return null;
  }
  return compactStatusBoundary(action.boundary, responseLanguage) ?? compactStatusBoundary({
    id: action.boundaryId,
    boundaryType: action.boundaryType,
    packetId: action.packetId,
    summary: action.summary,
    requiredInputs: action.requiredInputs,
    requiredActions: action.requiredActions,
    command: action.command,
    ownerRole: action.ownerRole,
    nextRole: action.nextRole
  }, responseLanguage);
}
function compactStatusRequiredEvidence({ primaryStep, boundary, boundaryActionCards, executionGaps }) {
  return mergeStringArrays(
    primaryStep?.evidenceRequired,
    primaryStep?.requiredMaterials,
    primaryStep?.requires,
    primaryStep?.doneCriteria,
    boundary?.requiredInputs,
    boundary?.requiredActions,
    boundaryActionCards.flatMap((card) => mergeStringArrays(card.evidenceRequired, card.requiredMaterials, card.requires)),
    executionGaps.evidenceRequired,
    executionGaps.requiredMaterials
  ).slice(0, 12);
}
function buildStatusIntentPrimaryAction(statusIntent, { gapStatus, executionCounts, boundaryActionCards, responseLanguage = "zh" }) {
  if (statusIntent === "project-status") {
    return null;
  }
  const contractTest = statusIntent === "contract-test";
  return compactStatusObject({
    presentation: "dove-status-intent-card",
    kind: statusIntent,
    title: statusInlineText(responseLanguage, contractTest ? "Dove contract \u68C0\u67E5" : "Dove \u5065\u5EB7\u68C0\u67E5", contractTest ? "Dove contract check" : "Dove health check"),
    why: statusInlineText(responseLanguage, contractTest ? "\u5F53\u524D\u8BF7\u6C42\u662F\u5728\u68C0\u67E5 Dove compact contract \u548C\u5DE5\u5177\u9762\uFF0C\u4E0D\u628A\u9879\u76EE backlog \u5F53\u4F5C\u4E3B\u4E0B\u4E00\u6B65\u3002" : "\u5F53\u524D\u8BF7\u6C42\u662F\u5728\u68C0\u67E5 Dove \u5F53\u524D\u5065\u5EB7\u72B6\u6001\uFF0C\u4E0D\u628A\u9879\u76EE backlog \u5F53\u4F5C\u4E3B\u4E0B\u4E00\u6B65\u3002", contractTest ? "This request checks the Dove compact contract and tool surface, so project backlog is not the primary next step." : "This request checks Dove health, so project backlog is not the primary next step."),
    command: "query_dove_status",
    firstAction: `query_dove_status intent: ${statusIntent}`,
    evidenceRequired: [],
    healthSummary: {
      gapStatus,
      boundaryCount: boundaryActionCards.length,
      blockingExecutionGapCount: executionCounts.blocking ?? 0
    }
  });
}
function buildHumanNextStep(card, responseLanguage = "zh") {
  if (!card) {
    return compactStatusObject({
      label: statusInlineText(responseLanguage, "\u73B0\u5728\u6CA1\u6709\u5FC5\u505A\u52A8\u4F5C", "No required action right now"),
      why: statusInlineText(responseLanguage, "Dove \u6CA1\u6709\u53D1\u73B0\u9700\u8981\u7ACB\u523B\u5904\u7406\u7684\u963B\u585E\u3002", "Dove did not find an immediate blocker.")
    });
  }
  const command = statusPublicCommandText(statusCardPublicCommand(card));
  const copyableCommand = statusPublicCommandText(statusCardCopyableCommand(card));
  const label = statusFirstPublicText(
    responseLanguage,
    90,
    card.title,
    card.label,
    card.operatorUnblock?.operatorAction,
    card.operatorUnblock?.nextOperatorAction,
    card.kind
  ) || statusInlineText(responseLanguage, "\u5904\u7406\u5F53\u524D\u4E0B\u4E00\u6B65", "Handle the current next step");
  const why = statusFirstPublicText(
    responseLanguage,
    140,
    card.operatorUnblock?.blockedSummary,
    card.operatorUnblock?.cannotContinueBecause,
    card.why,
    card.operatorUnblock?.summary
  );
  return compactStatusObject({
    label,
    why,
    command,
    copyableCommand
  });
}
function buildHumanNeedsAttention({ gapStatus, primaryStep, boundary, blockers, readErrors, executionCounts, projectBacklogRequiredEvidence, responseLanguage = "zh" }) {
  const operatorUnblock = primaryStep?.operatorUnblock ?? boundary?.operatorUnblock ?? null;
  const needs = mergeStringArrays(
    primaryStep?.evidenceRequired,
    operatorUnblock?.needs,
    operatorUnblock?.requiredEvidence,
    boundary?.requiredInputs,
    projectBacklogRequiredEvidence
  ).map((item) => statusPublicText(item, responseLanguage, 60)).filter(Boolean).slice(0, 8);
  if (gapStatus !== "blocked") {
    return compactStatusObject({
      status: "clear",
      summary: statusInlineText(responseLanguage, "\u5F53\u524D\u6CA1\u6709\u660E\u663E\u963B\u585E\u3002", "No obvious blocker right now."),
      needs
    });
  }
  const summary = statusFirstPublicText(
    responseLanguage,
    140,
    operatorUnblock?.summary,
    operatorUnblock?.blockedSummary,
    boundary?.summary,
    readErrors.length > 0 ? statusInlineText(responseLanguage, "Dove \u8BFB\u72B6\u6001\u65F6\u9047\u5230\u6587\u4EF6\u95EE\u9898\u3002", "Dove hit a file read problem while checking status.") : null,
    (executionCounts.blocking ?? 0) > 0 ? statusInlineText(responseLanguage, "Dove \u9700\u8981\u5148\u8865\u9F50\u4E00\u4E2A\u6267\u884C\u524D\u63D0\u3002", "Dove needs one execution prerequisite before continuing.") : null,
    blockers.length > 0 ? statusInlineText(responseLanguage, "Dove \u53D1\u73B0\u5F53\u524D\u5DE5\u4F5C\u6709\u963B\u585E\u3002", "Dove found a blocker in the current work.") : null,
    statusInlineText(responseLanguage, "Dove \u9700\u8981\u4F60\u5148\u5904\u7406\u4E00\u4E2A\u963B\u585E\u3002", "Dove needs one blocker handled first.")
  );
  const why = statusFirstPublicText(
    responseLanguage,
    160,
    operatorUnblock?.why,
    operatorUnblock?.cannotContinueBecause,
    primaryStep?.why
  );
  return compactStatusObject({
    status: "blocked",
    summary,
    why,
    needs
  });
}
function buildHumanChanges(writes = statusNoWriteTelemetry()) {
  const writeIntent = writes.writeIntent ?? (writes.applied ? "applied" : "none");
  return compactStatusObject({
    intent: writeIntent,
    applied: writes.applied === true,
    count: writes.count ?? 0,
    rollback: writes.rollbackEligible ?? (writeIntent === "none" ? "not-applicable" : "unverified")
  });
}
function buildHumanShowMore({ missionList, statusAdjustmentContract, writes, responseLanguage = "zh" }) {
  return compactStatusObject({
    text: statusInlineText(responseLanguage, "\u5982\u679C\u4F60\u660E\u786E\u8981\u5C55\u5F00\uFF0C\u53EF\u4EE5\u518D\u67E5\u770B\u4EFB\u52A1\u7EC6\u8282\u6216\u5B8C\u6574\u6CBB\u7406\u72B6\u6001\u3002", "If you explicitly want more detail, ask for task details or the full governance state."),
    noWriteSummary: writes.applied === true ? statusInlineText(responseLanguage, "\u8FD9\u6B21\u6709\u72B6\u6001\u53D8\u66F4\uFF1B\u9700\u8981\u5B8C\u6574\u8BB0\u5F55\u65F6\u518D\u5C55\u5F00\u5BA1\u8BA1\u7EC6\u8282\u3002", "This check included state changes; ask for audit details if needed.") : statusInlineText(responseLanguage, "\u8FD9\u6B21\u53EA\u662F\u8BFB\u53D6\u72B6\u6001\uFF0C\u6CA1\u6709\u5199\u5165\u3002", "This check only read status and made no writes."),
    detailsAvailable: true,
    missionDetailsAvailable: Boolean(missionList.detailsAvailable ?? missionList.itemCount ?? missionList.missionItemsIncluded),
    statusAdjustmentsAvailable: Boolean(statusAdjustmentContract.detailsAvailable ?? statusAdjustmentContract.itemCount)
  });
}
function buildHumanStatusHeadline({ statusIntent, gapStatus, nextStep, needsAttention, responseLanguage = "zh" }) {
  if (statusIntent === "health-check") {
    return statusInlineText(responseLanguage, "Dove \u5065\u5EB7\u68C0\u67E5\u5B8C\u6210\uFF1B\u8FD9\u6B21\u53EA\u662F\u68C0\u67E5\u7CFB\u7EDF\u72B6\u6001\uFF0C\u6CA1\u6709\u5199\u5165\u3002", "Dove health check completed; this only inspected system state and made no writes.");
  }
  if (statusIntent === "contract-test") {
    return statusInlineText(responseLanguage, "Dove compact contract \u68C0\u67E5\u5B8C\u6210\uFF1B\u9ED8\u8BA4\u5DE5\u5177\u9762\u548C full/debug \u5C55\u5F00\u53EF\u7528\u3002", "Dove compact contract check completed; default tool surface and full/debug expansion are available.");
  }
  if (gapStatus === "blocked") {
    const summary = needsAttention?.summary ?? statusInlineText(responseLanguage, "Dove \u6B63\u5728\u7B49\u5F85\u4F60\u5148\u5904\u7406\u4E00\u4E2A\u963B\u585E\u3002", "Dove is waiting for one blocker to be handled first.");
    return /Dove/i.test(summary) ? summary : statusInlineText(responseLanguage, `Dove ${summary}`, `Dove: ${summary}`);
  }
  if (nextStep?.label) {
    return statusInlineText(responseLanguage, `Dove \u53EF\u4EE5\u7EE7\u7EED\uFF1B\u4E0B\u4E00\u6B65\u662F\uFF1A${nextStep.label}`, `Dove can continue; next step: ${nextStep.label}`);
  }
  return statusInlineText(responseLanguage, "Dove \u5F53\u524D\u6CA1\u6709\u660E\u663E\u963B\u585E\u3002", "Dove has no obvious blocker right now.");
}
function buildCompactStatusHome({ result, missionList, nextActions, boundaryActionCards, statusAdjustmentContract, args }) {
  const summary = result.projectSummary ?? {};
  const current = result.current ?? {};
  const dashboard = result.dashboard ?? {};
  const responseLanguage = result.responseLanguage ?? "zh";
  const statusIntent = normalizeStatusIntent(args.intent ?? result.intent);
  const readErrors = Array.isArray(result.diagnostics?.readErrors) ? result.diagnostics.readErrors : [];
  const blockers = Array.isArray(dashboard.blockers) ? dashboard.blockers : [];
  const consistency = result.dailyHome?.completionConsistency ?? {};
  const completionConsistency = {
    status: consistency.status ?? "consistent",
    findingCount: consistency.findingCount ?? (Array.isArray(consistency.findings) ? consistency.findings.length : 0)
  };
  const executionGaps = result.dailyHome?.executionGaps ?? {};
  const executionCounts = {
    missingContract: executionGaps.counts?.missingContract ?? 0,
    missingMaterials: executionGaps.counts?.missingMaterials ?? 0,
    verificationGaps: executionGaps.counts?.verificationGaps ?? 0,
    readyBuilder: executionGaps.counts?.readyBuilder ?? 0,
    blocking: executionGaps.counts?.blocking ?? 0
  };
  const gapStatus = readErrors.length > 0 || blockers.length > 0 || completionConsistency.status === "needs-reconciliation" || executionCounts.blocking > 0 || boundaryActionCards.length > 0 ? "blocked" : "clear";
  const projectBacklogNextAction = nextActions[0] ?? null;
  const intentPrimaryAction = buildStatusIntentPrimaryAction(statusIntent, { gapStatus, executionCounts, boundaryActionCards, responseLanguage });
  const primaryStep = statusIntent === "project-status" ? projectBacklogNextAction : intentPrimaryAction;
  const boundarySourceAction = projectBacklogNextAction ?? boundaryActionCards[0] ?? null;
  const boundary = compactStatusBoundaryFromAction(boundarySourceAction, responseLanguage) ?? compactStatusBoundaryFromAction(boundaryActionCards[0], responseLanguage);
  const projectBacklogRequiredEvidence = statusIntent === "project-status" ? [] : compactStatusRequiredEvidence({ primaryStep: projectBacklogNextAction, boundary, boundaryActionCards, executionGaps });
  const writes = statusNoWriteTelemetry();
  const nextStep = buildHumanNextStep(primaryStep, responseLanguage);
  const needsAttention = buildHumanNeedsAttention({
    gapStatus,
    primaryStep,
    boundary,
    blockers,
    readErrors,
    executionCounts,
    projectBacklogRequiredEvidence,
    responseLanguage
  });
  const changes = buildHumanChanges(writes);
  const showMore = buildHumanShowMore({ missionList, statusAdjustmentContract, writes, responseLanguage });
  const headline = buildHumanStatusHeadline({ statusIntent, gapStatus, nextStep, needsAttention, responseLanguage });
  return compactStatusObject({
    presentation: "dove-project-situation-home",
    detail: "compact",
    liveContextFirst: true,
    intent: statusIntent,
    headline,
    scope: compactStatusObject({
      kind: "workspace",
      domain: current.domain ?? null,
      stage: current.stage ?? null,
      primaryRole: current.primaryRole ?? null
    }),
    currentContext: compactStatusObject({
      title: summary.title ?? null,
      objective: summary.objective ?? null,
      currentFocus: summary.currentFocus ?? null,
      domain: current.domain ?? null,
      stage: current.stage ?? null,
      primaryRole: current.primaryRole ?? null
    }),
    nextStep,
    needsAttention,
    changes,
    showMore,
    optionalMissionDetails: missionList.missionItemsIncluded ? missionList : null,
    statusAdjustmentPreview: statusAdjustmentContract.statusAdjustmentItemsIncluded ? statusAdjustmentContract : null,
    detailsAvailable: true
  });
}
function compactDoveStatusResult(result, args = {}) {
  const includeMissionDetails = wantsMissionDetails(args);
  const includeStatusAdjustmentPreview = wantsStatusAdjustmentPreview(args);
  const responseLanguage = result.responseLanguage ?? "zh";
  const missionList = compactStatusMissionList(result.dailyHome?.missionList, { includeItems: includeMissionDetails });
  const nextActions = (Array.isArray(result.dailyHome?.nextActions) ? result.dailyHome.nextActions : []).slice(0, 3).map((card) => compactStatusActionCard(card, responseLanguage));
  const boundaryActionCards = (Array.isArray(result.dailyHome?.boundaryActionCards) ? result.dailyHome.boundaryActionCards : []).slice(0, 5).map((card) => compactStatusActionCard(card, responseLanguage));
  const statusAdjustmentContract = compactStatusAdjustmentContract(result.statusAdjustmentContract, { includeItems: includeStatusAdjustmentPreview });
  const statusHome = buildCompactStatusHome({
    result,
    missionList,
    nextActions,
    boundaryActionCards,
    statusAdjustmentContract,
    args
  });
  return compactStatusObject({
    mode: result.mode,
    query: result.query,
    proposalOnly: result.proposalOnly,
    noAutoApply: result.noAutoApply,
    intent: statusHome.intent,
    responseLanguage: result.responseLanguage,
    detail: "compact",
    detailsAvailable: true,
    summary: statusHome.headline,
    headline: statusHome.headline,
    scope: statusHome.scope,
    currentContext: statusHome.currentContext,
    nextStep: statusHome.nextStep,
    needsAttention: statusHome.needsAttention,
    changes: statusHome.changes,
    showMore: statusHome.showMore,
    optionalMissionDetails: statusHome.optionalMissionDetails,
    statusAdjustmentPreview: statusHome.statusAdjustmentPreview,
    statusHome
  });
}
function missionUserGroupForStatus(status) {
  if (status === "archived") {
    return "archived";
  }
  if (status === "blocked") {
    return "blocked";
  }
  if (status === "in-progress") {
    return "doing";
  }
  if (status === "completed" || status === "killed") {
    return "done";
  }
  return "todo";
}
function summarizeStatusMissionListItem(task, index) {
  const recommendedStatus = recommendedStatusForTask(task);
  const group = missionUserGroupForStatus(recommendedStatus);
  return {
    index,
    packetId: task.id,
    title: task.title,
    group,
    status: task.status,
    recommendedStatus,
    stage: task.stage,
    domain: task.domain,
    level: task.level,
    blockedReason: task.blockedReason ?? null,
    lastStopReason: task.lastStopReason ?? null,
    boundaryType: task.currentBoundary?.type ?? null,
    evidenceRequired: normalizeStringArray8(task.evidenceExpectations),
    artifactRefs: normalizeStringArray8(task.artifactRefs)
  };
}
function missionPriorityNeeds(task, item, action) {
  return mergeStringArrays(
    action?.requiredMaterials,
    action?.evidenceRequired,
    action?.requiredInputs,
    action?.requires,
    action?.operatorUnblock?.needs,
    action?.operatorUnblock?.requiredEvidence,
    item?.evidenceRequired,
    task?.evidenceExpectations,
    task?.currentBoundary?.requiredInputs,
    task?.currentBoundary?.requiredActions,
    task?.workContract?.evidenceContract,
    task?.workContract?.deliverables
  ).map((value) => statusShortText(value, 80)).filter(Boolean).slice(0, 6);
}
function missionPriorityDoneCriteria(task, action) {
  return mergeStringArrays(action?.doneCriteria, task?.workContract?.doneCriteria).map((value) => statusShortText(value, 90)).filter(Boolean).slice(0, 4);
}
function taskDependsOnPacket(task, packetId) {
  if (!packetId || task?.id === packetId) {
    return false;
  }
  const dependencyIds = mergeStringArrays(task?.dependencies, task?.blockedBy, task?.unresolvedDependencyIds);
  if (dependencyIds.includes(packetId)) {
    return true;
  }
  return typeof task?.blockedReason === "string" && task.blockedReason.includes(packetId);
}
function missionPriorityUnlocks(tasks, packetId) {
  return sortStatusTasks(tasks.filter((task) => {
    if (!taskDependsOnPacket(task, packetId)) {
      return false;
    }
    const recommendedStatus = recommendedStatusForTask(task);
    return !["completed", "killed", "archived"].includes(recommendedStatus);
  })).slice(0, 5).map((task) => ({
    packetId: task.id,
    title: task.title,
    status: task.status,
    recommendedStatus: recommendedStatusForTask(task),
    blockedReason: task.blockedReason ?? null
  }));
}
function primaryMissionListAction(nextActions = [], itemById) {
  return (Array.isArray(nextActions) ? nextActions : []).find((action) => action?.packetId && itemById.has(action.packetId)) ?? null;
}
function fallbackMissionPriorityItem(items = []) {
  return items.find((item) => item.group === "doing") ?? items.find((item) => item.group === "blocked") ?? items.find((item) => item.group === "todo") ?? null;
}
function buildMissionPriorityLane(tasks, items, options = {}) {
  const itemById = new Map(items.map((item) => [item.packetId, item]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const primaryAction = primaryMissionListAction(options.nextActions, itemById);
  const focusItem = primaryAction?.packetId ? itemById.get(primaryAction.packetId) : fallbackMissionPriorityItem(items);
  if (!focusItem) {
    return null;
  }
  const focusTask = taskById.get(focusItem.packetId);
  const command = primaryAction ? statusCardPublicCommand(primaryAction) : null;
  const copyableCommand = primaryAction ? statusCardCopyableCommand(primaryAction) : null;
  const needs = missionPriorityNeeds(focusTask, focusItem, primaryAction);
  const unlocks = missionPriorityUnlocks(tasks, focusItem.packetId);
  const responseLanguage = options.responseLanguage ?? "zh";
  const summary = responseLanguage === "en" ? `Handle ${focusItem.packetId} first; it is the current bottleneck before the grouped mission list.` : `\u5148\u5904\u7406 ${focusItem.packetId}\uFF1B\u8FD9\u662F\u5C55\u5F00\u4EFB\u52A1\u5217\u8868\u524D\u7684\u5F53\u524D\u74F6\u9888\u3002`;
  return compactStatusObject({
    presentation: "dove-mission-priority-lane",
    summary,
    focus: compactStatusObject({
      packetId: focusItem.packetId,
      title: focusItem.title,
      status: focusItem.status,
      recommendedStatus: focusItem.recommendedStatus,
      group: focusItem.group,
      stage: focusItem.stage,
      domain: focusItem.domain
    }),
    action: compactStatusObject({
      label: primaryAction?.title ?? primaryAction?.label ?? null,
      why: primaryAction?.why ?? primaryAction?.operatorUnblock?.summary ?? primaryAction?.operatorUnblock?.operatorAction ?? null,
      command,
      copyableCommand,
      kind: primaryAction?.kind ?? null
    }),
    needs,
    doneCriteria: missionPriorityDoneCriteria(focusTask, primaryAction),
    unlocks,
    relatedActionCount: primaryAction?.relatedActionCount ?? null
  });
}
function openChecklistChildForStatusParent(task, parentId) {
  return task.parentId === parentId && task.creatorKind === "system" && !task.derivedFrom && !task.sourcePlanTaskId && !isArchivedStatusTask(task) && !["completed", "killed"].includes(task.status);
}
function buildCompletionConsistency(tasks = [], responseLanguage = "zh") {
  const byParentId = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    if (!task.parentId || !openChecklistChildForStatusParent(task, task.parentId)) {
      continue;
    }
    byParentId.set(task.parentId, [...byParentId.get(task.parentId) ?? [], task]);
  }
  const findings = tasks.filter((task) => task.status === "completed" && byParentId.has(task.id)).map((parent) => {
    const openChildren = sortStatusTasks(byParentId.get(parent.id) ?? []);
    return {
      id: `completion-consistency-${parent.id}`,
      type: "completed-parent-open-checklist",
      severity: "blocking",
      parentId: parent.id,
      parentTitle: parent.title,
      parentDisplayStatus: "done",
      parentMachineStatus: parent.status,
      openChecklistChildIds: openChildren.map((child) => child.id),
      openChecklistChildren: openChildren.map((child) => ({ id: child.id, title: child.title, status: child.status, displayStatus: child.displayStatus ?? child.status })),
      nextAction: "project:dove.status",
      summary: responseLanguage === "en" ? "A done parent mission still has open checklist children." : "done \u7236 mission \u4E0B\u4ECD\u6709 open checklist \u5B50\u9879\u3002"
    };
  });
  return {
    status: findings.length > 0 ? "needs-reconciliation" : "consistent",
    findingCount: findings.length,
    findings
  };
}
function buildStatusMissionList(tasks, options = {}) {
  const items = sortStatusTasks(tasks.filter((task) => task.level !== 0)).map((task, index) => summarizeStatusMissionListItem(task, index + 1));
  const groups = {
    todo: { label: "todo", description: "pending or ready missions", defaultCollapsed: false, items: [] },
    doing: { label: "doing", description: "missions with in-progress foreground runtime state", defaultCollapsed: false, items: [] },
    blocked: { label: "blocked", description: "missions blocked by dependency, boundary, or missing evidence", defaultCollapsed: false, items: [] },
    done: { label: "done", description: "completed or killed missions", defaultCollapsed: true, items: [] },
    archived: { label: "archived", description: "archived missions hidden from the default project situation", defaultCollapsed: true, items: [] }
  };
  for (const item of items) {
    groups[item.group].items.push(item);
  }
  const priorityLane = buildMissionPriorityLane(tasks, items, options);
  return {
    presentation: "dove-mission-list",
    priorityLane,
    statusModel: {
      userGroups: ["todo", "doing", "blocked", "done", "archived"],
      machineStatuses: DOVE_TASK_STATUSES,
      mapping: {
        todo: ["pending", "ready"],
        doing: ["in-progress"],
        blocked: ["blocked"],
        done: ["completed", "killed"],
        archived: ["archived"]
      }
    },
    summary: {
      totalCount: items.length,
      openCount: groups.todo.items.length + groups.doing.items.length + groups.blocked.items.length,
      todoCount: groups.todo.items.length,
      doingCount: groups.doing.items.length,
      blockedCount: groups.blocked.items.length,
      doneCount: groups.done.items.length,
      archivedCount: groups.archived.items.length,
      archivedHiddenCount: Number(options.archivedHiddenCount ?? 0)
    },
    groups
  };
}
function buildProjectSummary({ title, objective, focus, initTask, tasks, activeTasks, blockedTasks, missionList, review, versions, experiments, blockers, nextCommand, returnStatus, archivedHiddenCount = 0 }) {
  return {
    title,
    objective,
    currentFocus: focus,
    initTaskId: initTask?.id ?? null,
    missionCount: tasks.filter((task) => task.level !== 0).length,
    openMissionCount: missionList?.summary?.openCount ?? activeTasks.length,
    todoMissionCount: missionList?.summary?.todoCount ?? 0,
    doingMissionCount: missionList?.summary?.doingCount ?? 0,
    activeMissionCount: activeTasks.length,
    blockedMissionCount: missionList?.summary?.blockedCount ?? blockedTasks.length,
    archivedMissionCount: missionList?.summary?.archivedCount ?? 0,
    archivedHiddenCount,
    statusCounts: countBy2(tasks.map((task) => task.status), DOVE_TASK_STATUSES),
    reviewVerdict: review.verdict,
    unresolvedConcernCount: review.unresolvedConcernCount,
    versionCount: versions.versionCount,
    experimentPlanCount: experiments.planCount,
    blockerCount: blockers.length,
    returnStatus,
    nextCommand
  };
}
function buildStatusTaskTree(tasks) {
  const byId = new Map(tasks.map((task) => [task.id, { ...task, children: [] }]));
  const roots = [];
  for (const task of byId.values()) {
    if (task.parentId && task.parentId !== task.id && byId.has(task.parentId)) {
      byId.get(task.parentId).children.push(task);
    } else {
      roots.push(task);
    }
  }
  const normalizeNode = (node) => ({ ...node, children: sortStatusTasks(node.children).map(normalizeNode) });
  return sortStatusTasks(roots).map(normalizeNode);
}
function summarizeStatusBlocker(blocker, index, responseLanguage = "zh") {
  if (blocker && typeof blocker === "object" && !Array.isArray(blocker)) {
    return {
      id: blocker.id ?? blocker.blockerId ?? `board-blocker-${index + 1}`,
      source: "board",
      summary: blocker.summary ?? blocker.reason ?? blocker.title ?? blocker.id ?? doveText(responseLanguage, "boardBlockerFallback", { index: index + 1 }),
      severity: blocker.severity ?? null,
      taskId: blocker.taskId ?? blocker.packetId ?? null
    };
  }
  return {
    id: `board-blocker-${index + 1}`,
    source: "board",
    summary: String(blocker ?? doveText(responseLanguage, "boardBlockerFallback", { index: index + 1 })),
    severity: null,
    taskId: null
  };
}
function buildStatusBlockers(inputs, blockedTasks, responseLanguage = "zh") {
  const boardBlockers = Array.isArray(inputs.board.blockers) ? inputs.board.blockers.map((blocker, index) => summarizeStatusBlocker(blocker, index, responseLanguage)) : [];
  const taskBlockers = blockedTasks.map((task) => ({
    id: `task-blocker-${task.id}`,
    source: "task",
    summary: task.blockedReason ?? (task.blockedBy.length > 0 ? doveText(responseLanguage, "taskBlockedBySummary", { id: task.id, blockers: task.blockedBy.join(", ") }) : doveText(responseLanguage, "taskMarkedBlockedSummary", { id: task.id })),
    severity: "blocking",
    taskId: task.id,
    blockedBy: task.blockedBy,
    unresolvedDependencyIds: normalizeStringArray8(task.unresolvedDependencyIds)
  }));
  return [...boardBlockers, ...taskBlockers];
}
function selectStatusNextCommand({ initTask, activeTasks, blockedTasks, review }) {
  if (!initTask) {
    return "project:dove.init";
  }
  if (blockedTasks.length > 0) {
    return "project:dove.status";
  }
  const nextActiveTask = activeTasks.find((task) => task.nextAction);
  if (nextActiveTask) {
    return nextActiveTask.nextAction;
  }
  if (activeTasks.length > 0) {
    return "project:dove.auto";
  }
  if ((review.unresolvedConcernCount ?? 0) > 0) {
    return "project:dove.review";
  }
  return initTask.nextAction ?? "project:dove.mission";
}
function summarizeStatusReview(inputs) {
  const concerns = Array.isArray(inputs.reviewConcerns.items) ? inputs.reviewConcerns.items : [];
  const openConcerns = concerns.filter((concern) => !["closed", "resolved", "accepted"].includes(String(concern.status ?? "open").trim().toLowerCase()));
  const unresolvedConcernIds = normalizeStringArray8(inputs.reviewState.unresolvedConcernIds);
  return {
    verdict: inputs.reviewState.lastVerdict ?? "not-reviewed",
    reviewedAt: inputs.reviewState.lastReviewedAt ?? null,
    reviewRound: inputs.reviewState.reviewRound ?? 0,
    openItemCount: Array.isArray(inputs.reviewState.openItems) ? inputs.reviewState.openItems.length : 0,
    concernCount: concerns.length,
    openConcernCount: openConcerns.length,
    unresolvedConcernCount: unresolvedConcernIds.length || openConcerns.length,
    unresolvedConcernIds,
    reviewerIndependence: inputs.reviewState.reviewerIndependence ?? null
  };
}
function summarizeStatusLessons(inputs) {
  const lessons = Array.isArray(inputs.operatorLessons.lessons) ? inputs.operatorLessons.lessons : [];
  const activeLessons = lessons.filter((lesson) => String(lesson.status ?? "active").trim().toLowerCase() === "active");
  const mustObeyLessons = activeLessons.filter((lesson) => lesson.mustObey !== false);
  const summary = inputs.operatorLessons.summary && typeof inputs.operatorLessons.summary === "object" ? inputs.operatorLessons.summary : {};
  return {
    lessonCount: summary.lessonCount ?? lessons.length,
    activeLessonCount: summary.activeLessonCount ?? activeLessons.length,
    mustObeyLessonCount: mustObeyLessons.length,
    topLessonIds: normalizeStringArray8(summary.topLessonIds).slice(0, 10),
    lessonsPath: summary.lessonsPath ?? ARTIFACT_PATHS.metaOperatorLessons
  };
}
function summarizeStatusVersions(inputs) {
  const versions = Array.isArray(inputs.versions.items) ? inputs.versions.items : [];
  const lineage = Array.isArray(inputs.versions.lineage) ? inputs.versions.lineage : [];
  const comparisons = Array.isArray(inputs.comparisons.items) ? inputs.comparisons.items : [];
  return {
    currentVersionId: inputs.versions.currentVersionId ?? null,
    versionCount: versions.length,
    lineageCount: lineage.length,
    comparisonCount: comparisons.length,
    activeComparisonTargets: normalizeStringArray8(inputs.comparisons.activeTargets),
    versionsPath: ARTIFACT_PATHS.versionsIndex
  };
}
function summarizeStatusExperiments(inputs) {
  return {
    planCount: Array.isArray(inputs.experimentPlans.items) ? inputs.experimentPlans.items.length : 0,
    resultCount: Array.isArray(inputs.experimentResults.items) ? inputs.experimentResults.items.length : 0,
    auditCount: Array.isArray(inputs.experimentAudits.items) ? inputs.experimentAudits.items.length : 0
  };
}
function normalizeStatusStageArg(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (DOVE_TASK_STAGES.includes(raw)) {
    return raw;
  }
  if (["audit", "return"].includes(raw)) {
    return "audit";
  }
  if (raw === "execution") {
    return "execute";
  }
  if (["goal", "design", "checklist"].includes(raw)) {
    return "plan";
  }
  return null;
}
function inferDomain(args, inputs) {
  const explicit = normalizeDoveDomainId(args.domain ?? args.doveDomain ?? args.missionDomain, null);
  if (explicit) {
    return explicit;
  }
  const activePacket = inputs.packets.find((packet) => !archivedPacketStatus(packet.status) && !archivedPacketStatus(packet.lifecycleStatus));
  return activePacket?.doveDomain ?? normalizeDoveDomainId(inputs.workspaceIndex.dove?.currentDomain, "paper");
}
function inferStage(args, inputs) {
  const explicit = normalizeDoveMissionLifecycleStage(args.stage ?? args.missionStage, null);
  if (explicit) {
    return explicit;
  }
  return normalizeDoveMissionLifecycleStage(inputs.workspaceIndex.dove?.missionLifecycle?.currentStage, missionStageForPhase(inputs.board.currentPhase));
}
function inferGoal(args, inputs, responseLanguage = "zh") {
  const explicit = typeof args.goal === "string" && args.goal.trim() ? args.goal.trim() : null;
  if (explicit) {
    return explicit;
  }
  return inputs.board.currentFocus ?? inputs.board.objective ?? inputs.state.dove?.thesis ?? inputs.state.dove?.objective ?? inputs.state.dove?.title ?? doveText(responseLanguage, "queryFallbackGoal");
}
function collectTargetArtifacts(args, packets) {
  const explicit = normalizeStringArray8(args.targetArtifacts ?? args.artifacts ?? args.artifactPaths);
  if (explicit.length > 0) {
    return explicit;
  }
  return Array.from(new Set(packets.flatMap((packet) => [...packet.outputPaths, ...packet.evidenceLinks]))).slice(0, 12);
}
function buildMissionContract(root, args = {}) {
  const inputs = readDoveInputs(root);
  const responseLanguage = resolveDoveResponseLanguage(root, args, { state: inputs.state });
  const domain = inferDomain(args, inputs);
  const stage = inferStage(args, inputs);
  const domainGuidance = selectDomainGuidance(inputs.workspaceIndex, domain);
  const primaryRole = primaryRoleForStage(stage);
  const targetArtifacts = collectTargetArtifacts(args, inputs.packets);
  const acceptanceChecks = normalizeStringArray8(args.acceptanceChecks).length > 0 ? normalizeStringArray8(args.acceptanceChecks) : domainGuidance.returnEvidence;
  const nextCommand = args.nextCommand ?? domainGuidance.stageRoutes?.[stage] ?? "project:dove.status";
  return {
    inputs,
    mission: {
      goal: inferGoal(args, inputs, responseLanguage),
      domain,
      stage,
      primaryRole: primaryRole.id,
      nextCommand,
      targetArtifacts,
      acceptanceChecks,
      returnProtocol: doveText(responseLanguage, "returnProtocol", { checks: acceptanceChecks.join(", ") }),
      domainGuidance: {
        label: domainGuidance.label,
        summary: domainGuidance.summary,
        stageRoutes: domainGuidance.stageRoutes,
        returnEvidence: domainGuidance.returnEvidence
      }
    },
    responseLanguage
  };
}
function artifactPathsReadForDove() {
  return [
    ARTIFACT_PATHS.state,
    ARTIFACT_PATHS.orchestrationBoard,
    ARTIFACT_PATHS.workspaceIndex,
    ARTIFACT_PATHS.doveRootManifest,
    ARTIFACT_PATHS.taskPacketsIndex,
    ARTIFACT_PATHS.taskPacketsPacketsDir,
    ARTIFACT_PATHS.runtimeContinuation,
    ARTIFACT_PATHS.runtimeEvents,
    ARTIFACT_PATHS.runtimeResults,
    ARTIFACT_PATHS.reviewState,
    ARTIFACT_PATHS.reviewConcerns,
    ARTIFACT_PATHS.versionsIndex,
    ARTIFACT_PATHS.versionComparisons,
    ARTIFACT_PATHS.experimentPlans,
    ARTIFACT_PATHS.experimentResults,
    ARTIFACT_PATHS.experimentAudits,
    ARTIFACT_PATHS.metaOperatorLessons,
    ARTIFACT_PATHS.checklist
  ];
}
var PAPER_PIPELINE_STAGE_METADATA = {
  init: { commandId: "project:dove.init", artifactPaths: [ARTIFACT_PATHS.state, ARTIFACT_PATHS.project, ARTIFACT_PATHS.researchContract] },
  sources: { commandId: "project:dove.source", artifactPaths: [ARTIFACT_PATHS.sources, ARTIFACT_PATHS.bibliography] },
  notes: { commandId: "project:dove.note", artifactPaths: [ARTIFACT_PATHS.notes] },
  research: { commandId: "project:dove.source", artifactPaths: [ARTIFACT_PATHS.researchBrief, ARTIFACT_PATHS.researchAgenda] },
  plan: { commandId: "project:dove.mission", artifactPaths: [ARTIFACT_PATHS.plan] },
  outline: { commandId: "project:dove.mission", artifactPaths: [ARTIFACT_PATHS.outline] },
  draft: { commandId: "project:dove.draft", artifactPaths: [ARTIFACT_PATHS.draftsDir] },
  experiments: { commandId: "project:dove.experience", artifactPaths: [ARTIFACT_PATHS.experimentPlans, ARTIFACT_PATHS.experimentResults, ARTIFACT_PATHS.experimentAudits] },
  citations: { commandId: "project:dove.source", artifactPaths: [ARTIFACT_PATHS.bibliography, ARTIFACT_PATHS.citationLog] },
  review: { commandId: "project:dove.review", artifactPaths: [ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.reviewConcerns] },
  rebuttal: { commandId: "project:dove.rebuttal", artifactPaths: [ARTIFACT_PATHS.rebuttalIssues, ARTIFACT_PATHS.rebuttalStrategy, ARTIFACT_PATHS.rebuttalResponseDraft] },
  versions: { commandId: "project:dove.version", artifactPaths: [ARTIFACT_PATHS.versionsIndex, ARTIFACT_PATHS.versionComparisons] },
  checklist: { commandId: "project:dove.status", artifactPaths: [ARTIFACT_PATHS.checklist] },
  return: { commandId: "project:dove.status", artifactPaths: [ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.versionsIndex, ARTIFACT_PATHS.checklist] }
};
function inspectPipelineArtifact(root, relativePath) {
  return {
    path: relativePath,
    exists: fs12.existsSync(path13.join(root, relativePath))
  };
}
function buildPaperPipelineStage(root, stageId, index) {
  const metadata = PAPER_PIPELINE_STAGE_METADATA[stageId];
  const artifacts = metadata.artifactPaths.map((artifactPath) => inspectPipelineArtifact(root, artifactPath));
  const availableArtifacts = artifacts.filter((item) => item.exists).map((item) => item.path);
  const missingArtifacts = artifacts.filter((item) => !item.exists).map((item) => item.path);
  return {
    id: stageId,
    order: index + 1,
    commandId: metadata.commandId,
    keyArtifacts: artifacts,
    availableArtifacts,
    missingArtifacts,
    status: missingArtifacts.length === 0 ? "ready" : availableArtifacts.length > 0 ? "partial" : "missing"
  };
}
function selectPaperPipelineNextCommand(stages) {
  const nextStage = stages.find((stage) => stage.status !== "ready");
  return nextStage?.commandId ?? "project:dove.status";
}
function booleanArg(value) {
  if (value === true) {
    return true;
  }
  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  }
  return false;
}
function buildMissionBoardMission(packet) {
  const missionStage = missionStageForPhase(packet.phase);
  const primaryRole = primaryRoleForStage(missionStage);
  return {
    ...packet,
    ...missionPacketAliases(packet),
    missionStage,
    primaryRole: primaryRole.id,
    archived: archivedPacketStatus(packet.status) || archivedPacketStatus(packet.lifecycleStatus)
  };
}
function matchesMissionBoardFilters(mission, args = {}) {
  const domain = normalizeDoveDomainId(args.domain ?? args.doveDomain ?? args.missionDomain, null);
  if (domain && mission.doveDomain !== domain) {
    return false;
  }
  const stage = normalizeDoveMissionLifecycleStage(args.stage ?? args.missionStage, null);
  if (stage && mission.missionStage !== stage) {
    return false;
  }
  const packetIds = normalizeStringArray8(args.packetId ?? args.packetIds ?? args.missionPacketId ?? args.missionPacketIds);
  if (packetIds.length > 0 && !packetIds.includes(mission.id) && !packetIds.includes(mission.packetId) && !packetIds.includes(mission.missionPacketId)) {
    return false;
  }
  const statuses = normalizeStringArray8(args.status ?? args.statuses);
  if (statuses.length > 0 && !statuses.includes(mission.lifecycleStatus) && !statuses.includes(mission.status)) {
    return false;
  }
  return booleanArg(args.includeArchived) || !mission.archived;
}
function queueNameForMission(mission) {
  const lifecycleStatus = mission.lifecycleStatus ?? "active";
  if (mission.archived || archivedPacketStatus(mission.status) || archivedPacketStatus(lifecycleStatus)) {
    return "archived";
  }
  if (lifecycleStatus === "review-needed") {
    return "reviewNeeded";
  }
  if (["handoff", "handoff-ready", "returned"].includes(lifecycleStatus)) {
    return "handoff";
  }
  if (["waiting", "ready"].includes(lifecycleStatus)) {
    return lifecycleStatus;
  }
  if (["stale", "blocked", "active"].includes(lifecycleStatus)) {
    return lifecycleStatus;
  }
  if (["done", "completed"].includes(mission.status) || lifecycleStatus === "completed") {
    return "ready";
  }
  return "active";
}
function buildMissionQueues(missions) {
  const queues = {
    ready: [],
    waiting: [],
    reviewNeeded: [],
    handoff: [],
    stale: [],
    active: [],
    blocked: [],
    archived: []
  };
  for (const mission of missions) {
    queues[queueNameForMission(mission)].push(mission);
  }
  return queues;
}
function countBy2(values, initialKeys = []) {
  const counts = Object.fromEntries(initialKeys.map((key) => [key, 0]));
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}
function buildMissionBoardCounts(missions) {
  const kernel = createDoveWorkspaceKernel();
  return {
    missionCount: missions.length,
    activeMissionCount: missions.filter((mission) => !mission.archived).length,
    reviewNeededMissionCount: missions.filter((mission) => mission.lifecycleStatus === "review-needed").length,
    domainCounts: countBy2(missions.map((mission) => mission.doveDomain), kernel.domainIds),
    stageCounts: countBy2(missions.map((mission) => mission.missionStage), kernel.missionLifecycle.stages),
    lifecycleStatusCounts: countBy2(missions.map((mission) => mission.lifecycleStatus ?? "active"))
  };
}
function uncheckedChecklistCount(checklist) {
  if (!checklist) {
    return 0;
  }
  return checklist.split(/\r?\n/).filter((line) => /^\s*- \[ \]/.test(line)).length;
}
function completedChecklistCount(checklist) {
  if (!checklist) {
    return 0;
  }
  return checklist.split(/\r?\n/).filter((line) => /^\s*- \[[xX]\]/.test(line)).length;
}
function classifyReturnStatus({ mission, inputs, paperAudit, engineeringEvidence }) {
  if (inputs.readErrors.length > 0) {
    return "blocked";
  }
  const reviewNeeded = inputs.packets.some((packet) => packet.lifecycleStatus === "review-needed") || ["needs-work", "rejected", "blocked"].includes(inputs.reviewState.lastVerdict);
  if (reviewNeeded) {
    return "needs-review";
  }
  const currentPackets = activePackets(inputs.packets);
  if (mission.domain === "engineering" && engineeringEvidence) {
    if (engineeringEvidence.readiness.hasReviewGap) {
      return "needs-review";
    }
    if (engineeringEvidence.readiness.hasFailedValidationOutput) {
      return "needs-execution";
    }
    if (engineeringEvidence.readiness.hasEvidenceGaps || engineeringEvidence.readiness.pathProblemCount > 0) {
      return "needs-audit";
    }
    if (engineeringEvidence.readiness.hasChecklistGap) {
      return "needs-execution";
    }
  }
  if (uncheckedChecklistCount(inputs.checklist) > 0 || currentPackets.some((packet) => ["active", "waiting", "blocked", "stale"].includes(packet.lifecycleStatus))) {
    return "needs-execution";
  }
  if (paperAudit?.severityCounts?.high > 0 || paperAudit?.severityCounts?.critical > 0) {
    return "needs-audit";
  }
  return "ready";
}
function nextCommandForReturnStatus(status, domain) {
  if (status === "needs-review") {
    return "project:dove.review";
  }
  if (status === "needs-execution") {
    return domain === "paper" ? "project:dove.status" : "project:dove.status";
  }
  if (status === "needs-audit") {
    return domain === "engineering" ? "project:dove.status" : "project:dove.review";
  }
  if (status === "blocked") {
    return "project:dove.mission";
  }
  return "project:dove.version";
}
function routeRequestText(args, mission) {
  return normalizeStringArray8([args.request, args.userRequest, args.goal, mission.goal]).join(" ").toLowerCase();
}
function selectRouteCommand(mission, args = {}) {
  const route = mission.domainGuidance.stageRoutes?.[mission.stage] ?? mission.nextCommand;
  const candidates = String(route ?? "project:dove.status").split(/\s+or\s+/).map((item) => item.trim()).filter(Boolean);
  if (candidates.length <= 1) {
    return candidates[0] ?? "project:dove.status";
  }
  const requestText = routeRequestText(args, mission);
  if (booleanArg(args.allowAutonomy)) {
    const autonomy = candidates.find((item) => item.includes(".auto") || item.includes("autonomy"));
    if (autonomy) {
      return autonomy;
    }
  }
  if (/\b(revise|revision|rebuttal|fix|review)\b/.test(requestText)) {
    const revision = candidates.find((item) => /revise|rebuttal|review/.test(item));
    if (revision) {
      return revision;
    }
  }
  return candidates[0];
}
function routeReason(mission, selectedCommand, args = {}, responseLanguage = "zh") {
  if (selectedCommand !== mission.nextCommand && String(mission.nextCommand).includes(" or ")) {
    return doveText(responseLanguage, "routeSelectedReason", { selectedCommand, nextCommand: mission.nextCommand });
  }
  if (booleanArg(args.allowAutonomy) && (selectedCommand.includes(".auto") || selectedCommand.includes("autonomy"))) {
    return doveText(responseLanguage, "routeAutoReason");
  }
  return doveText(responseLanguage, "routeDefaultReason", { stage: mission.stage, domain: mission.domain, selectedCommand });
}
function buildWorkspaceSummary(inputs) {
  const kernel = createDoveWorkspaceKernel();
  const authorityManifest = inputs.doveAuthorityManifest ?? inputs.workspaceIndex.dove?.authorityManifest ?? kernel.authorityManifest;
  return {
    kernelVersion: inputs.workspaceIndex.dove?.kernelVersion ?? kernel.kernelVersion,
    unified: true,
    explicitOnly: true,
    noHiddenRuntime: true,
    identity: inputs.workspaceIndex.dove?.identity ?? kernel.identity,
    authorityManifest,
    durableRoot: ARTIFACT_PATHS.doveRoot,
    authoritativeRoot: authorityManifest?.authoritativeRoot ?? ARTIFACT_PATHS.doveRoot
  };
}
function normalizePaperAuditFinding(finding, mission) {
  return {
    ...finding,
    missionDomain: mission.domain,
    missionStage: mission.stage,
    primaryRole: mission.primaryRole,
    blocking: ["critical", "high"].includes(finding.severity)
  };
}
function auditVerdictFromSeverityCounts(severityCounts = {}) {
  if ((severityCounts.critical ?? 0) > 0 || (severityCounts.high ?? 0) > 0) {
    return "blocking-findings";
  }
  if ((severityCounts.medium ?? 0) > 0 || (severityCounts.low ?? 0) > 0) {
    return "findings";
  }
  return "clear";
}
function queryPaperPipeline(root, args = {}) {
  const inputs = readDoveInputs(root);
  const responseLanguage = resolveDoveResponseLanguage(root, args, { state: inputs.state });
  const currentStage = inferStage({ ...args, domain: "paper" }, inputs);
  const stageIds = [...PIPELINE_STAGE_ORDER, "return"];
  const stages = stageIds.map((stageId, index) => buildPaperPipelineStage(root, stageId, index));
  const stageCounts = countBy2(stages.map((stage) => stage.status), ["ready", "partial", "missing"]);
  return {
    mode: "paper-pipeline-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    responseLanguage,
    current: {
      domain: "paper",
      missionStage: currentStage,
      boardPhase: inputs.board.currentPhase ?? null,
      boardAssignedRole: inputs.board.assignedRole ?? null,
      workspaceCurrentDomain: inputs.workspaceIndex.dove?.currentDomain ?? null,
      workspaceMissionStage: inputs.workspaceIndex.dove?.missionLifecycle?.currentStage ?? null
    },
    stages,
    summary: {
      stageCount: stages.length,
      readyStageCount: stageCounts.ready,
      partialStageCount: stageCounts.partial,
      missingStageCount: stageCounts.missing,
      activePacketCount: activePackets(inputs.packets).filter((packet) => ["paper", "experiment", "review"].includes(packet.doveDomain)).length,
      reviewVerdict: inputs.reviewState.lastVerdict ?? "not-reviewed",
      checklistUncheckedCount: uncheckedChecklistCount(inputs.checklist)
    },
    suggestedNextCommand: selectPaperPipelineNextCommand(stages),
    workspace: buildWorkspaceSummary(inputs),
    diagnostics: {
      readErrors: inputs.readErrors,
      artifactPathsRead: Array.from(/* @__PURE__ */ new Set([...artifactPathsReadForDove(), ...stages.flatMap((stage) => stage.keyArtifacts.map((item) => item.path))])),
      noRefresh: true,
      noCommandExecution: true,
      noExternalProcess: true,
      noGitInspection: true
    }
  };
}
function queryDoveStatus(root, args = {}) {
  const inputs = readDoveInputs(root);
  const responseLanguage = resolveDoveResponseLanguage(root, args, { state: inputs.state });
  const statusIntent = normalizeStatusIntent(args.intent);
  const includeArchived = booleanArg(args.includeArchived);
  const allTasks = sortStatusTasks(enrichStatusTasks((Array.isArray(inputs.taskCatalog.packets) ? inputs.taskCatalog.packets : []).map((packet) => summarizeDoveStatusTask(packet, responseLanguage)).filter((task) => task.id), inputs));
  const archivedTasks = allTasks.filter(isArchivedStatusTask);
  const tasks = includeArchived ? allTasks : allTasks.filter((task) => !isArchivedStatusTask(task));
  const archivedHiddenCount = includeArchived ? 0 : archivedTasks.length;
  const consistencyTasks = allTasks.filter((task) => !isArchivedStatusTask(task));
  const requestedDomain = normalizeDoveDomainId(args.domain ?? args.doveDomain ?? args.missionDomain, null);
  const requestedStage = normalizeStatusStageArg(args.stage ?? args.missionStage);
  const requestedStatuses = normalizeStringArray8(args.status ?? args.statuses);
  const requestedPacketIds = normalizeStringArray8(args.packetId ?? args.packetIds ?? args.missionPacketId ?? args.missionPacketIds);
  const visibleTasks = tasks.filter((task) => {
    if (requestedDomain && task.domain !== requestedDomain) {
      return false;
    }
    if (requestedStage && task.stage !== requestedStage) {
      return false;
    }
    if (requestedStatuses.length > 0 && !requestedStatuses.includes(task.status) && !requestedStatuses.includes(String(task.lifecycleStatus ?? ""))) {
      return false;
    }
    if (requestedPacketIds.length > 0 && !requestedPacketIds.includes(task.id) && !requestedPacketIds.includes(task.packetId) && !requestedPacketIds.includes(task.missionPacketId)) {
      return false;
    }
    return true;
  });
  const initTask = tasks.find((task) => task.level === 0 && task.status !== "killed") ?? null;
  const activeStatusIds = /* @__PURE__ */ new Set(["pending", "ready", "in-progress", "blocked"]);
  const activeTasks = visibleTasks.filter((task) => task.level !== 0 && activeStatusIds.has(task.status));
  const actionableBoundaries = activeTasks.map(summarizeActionableBoundary).filter(Boolean);
  const boundaryActionCards = activeTasks.map((task) => buildBoundaryActionCard(task, responseLanguage)).filter(Boolean);
  const blockedTasks = activeTasks.filter(hasTaskBlockerSignal);
  const completedTasks = sortRecentStatusTasks(visibleTasks.filter((task) => task.status === "completed")).slice(0, 10);
  const killedTasks = sortRecentStatusTasks(visibleTasks.filter((task) => task.status === "killed")).slice(0, 10);
  const completionConsistency = buildCompletionConsistency(consistencyTasks, responseLanguage);
  const executionGaps = buildStatusExecutionGaps(activeTasks);
  const review = summarizeStatusReview(inputs);
  const blockers = buildStatusBlockers(inputs, blockedTasks, responseLanguage);
  const lessons = summarizeStatusLessons(inputs);
  const versions = summarizeStatusVersions(inputs);
  const experiments = summarizeStatusExperiments(inputs);
  const fallbackNextCommand = selectStatusNextCommand({ initTask, activeTasks, blockedTasks, review });
  const currentStage = requestedStage ?? activeTasks[0]?.stage ?? initTask?.stage ?? null;
  const currentDomain = requestedDomain ?? activeTasks[0]?.domain ?? initTask?.domain ?? normalizeDoveDomainId(inputs.workspaceIndex.dove?.currentDomain, null);
  const primaryRole = currentStage === "audit" ? "reviewer" : currentStage === "execute" ? "builder" : "planner";
  const returnStatus = inputs.readErrors.length > 0 ? "blocked" : blockers.length > 0 || completionConsistency.status === "needs-reconciliation" || (executionGaps.counts?.blocking ?? 0) > 0 ? "blocked" : activeTasks.length > 0 ? "in-progress" : review.unresolvedConcernCount > 0 ? "needs-review" : "ready";
  const levelCounts = countBy2(tasks.map((task) => String(task.level)), ["0", "1", "2", "3"]);
  const projectTitle = inputs.state.dove?.title ?? initTask?.title ?? doveText(responseLanguage, "projectTitleFallback");
  const projectObjective = inputs.state.dove?.objective ?? inputs.state.dove?.thesis ?? initTask?.summary ?? inputs.board.objective ?? null;
  const projectFocus = activeTasks[0]?.currentFocus ?? (activeTasks.length === 0 ? projectObjective : inputs.state.orchestration?.currentFocus ?? inputs.board.currentFocus ?? projectObjective);
  const dailyHome = buildDailyHome({ initTask, activeTasks, blockedTasks, visibleTasks, review, boundaryActionCards, completionConsistency, executionGaps, archivedHiddenCount, responseLanguage });
  const nextCommand = selectDailyHomeNextCommand(dailyHome, fallbackNextCommand);
  const projectSummary = buildProjectSummary({ title: projectTitle, objective: projectObjective, focus: projectFocus, initTask, tasks, activeTasks, blockedTasks, missionList: dailyHome.missionList, review, versions, experiments, blockers, nextCommand, returnStatus, archivedHiddenCount });
  const statusAdjustmentContract = buildStatusAdjustmentContract(visibleTasks, responseLanguage);
  const durableContextNotice = buildDurableContextNotice(root, responseLanguage);
  const preActionGuidance = buildPreActionGuidance({
    surface: "dove.status",
    responseLanguage,
    request: args.request ?? args.userRequest ?? args.prompt ?? null,
    roleId: primaryRole,
    currentContext: {
      title: projectTitle,
      objective: projectObjective,
      currentFocus: projectFocus,
      domain: currentDomain,
      stage: currentStage,
      primaryRole
    },
    operatorLessons: inputs.operatorLessons,
    nextAction: dailyHome.nextActions?.[0] ?? nextCommand,
    routeHint: nextCommand,
    workflowKind: "status",
    domain: currentDomain,
    stage: currentStage,
    statusSummary: {
      returnStatus,
      activeTaskCount: activeTasks.length,
      blockerCount: blockers.length,
      unresolvedConcernCount: review.unresolvedConcernCount,
      readErrorCount: inputs.readErrors.length,
      statusAdjustmentCount: statusAdjustmentContract.itemCount ?? 0,
      executionGaps
    }
  });
  const fullResult = {
    mode: "dove-status-query",
    query: true,
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    intent: statusIntent,
    responseLanguage,
    detail: "full",
    projectSummary,
    durableContextNotice,
    preActionGuidance,
    statusAdjustmentContract,
    dailyHome,
    actionableBoundaries,
    boundaryActionCards,
    current: {
      domain: currentDomain,
      stage: currentStage,
      primaryRole,
      nextCommand
    },
    dashboard: {
      projectSummary,
      statusAdjustmentContract,
      dailyHome,
      project: {
        title: projectTitle,
        objective: projectObjective,
        responseLanguage,
        durableRoot: ARTIFACT_PATHS.doveRoot,
        authoritativeRoot: inputs.doveAuthorityManifest.authoritativeRoot ?? ARTIFACT_PATHS.doveRoot,
        durableContextNotice,
        currentFocus: projectFocus,
        nextAction: nextCommand,
        pipeline: {
          currentStage: inputs.state.pipeline?.currentStage ?? inputs.board.currentPhase ?? null,
          lastCompletedStage: inputs.state.pipeline?.lastCompletedStage ?? null,
          resumeCommand: inputs.state.pipeline?.resumeCommand ?? "project:dove.status"
        }
      },
      board: {
        phase: inputs.board.currentPhase ?? null,
        intentType: inputs.board.intentType ?? null,
        assignedRole: inputs.board.assignedRole ?? null,
        continuationStatus: inputs.board.continuationState?.status ?? null,
        reviewRequiredBeforeFinalize: inputs.board.reviewRequiredBeforeFinalize ?? false
      },
      runtime: {
        continuation: {
          ...inputs.runtimeContinuation.summary,
          items: Array.isArray(inputs.runtimeContinuation.items) ? inputs.runtimeContinuation.items : []
        },
        results: inputs.runtimeResults.summary,
        events: inputs.runtimeEvents.summary
      },
      init: initTask,
      tasks: {
        tree: buildStatusTaskTree(visibleTasks),
        active: activeTasks,
        grouped: dailyHome.missionList,
        blocked: blockedTasks,
        actionableBoundaries,
        boundaryActionCards,
        recentCompleted: completedTasks,
        recentKilled: killedTasks,
        activeTaskIds: activeTasks.map((task) => task.id),
        counts: {
          total: tasks.length,
          visible: visibleTasks.length,
          active: activeTasks.length,
          blocked: blockedTasks.length,
          completed: tasks.filter((task) => task.status === "completed").length,
          killed: tasks.filter((task) => task.status === "killed").length,
          archived: tasks.filter((task) => task.status === "archived" || isArchivedStatusTask(task)).length,
          archivedHidden: archivedHiddenCount,
          byStatus: countBy2(tasks.map((task) => task.status), DOVE_TASK_STATUSES),
          byDomain: countBy2(tasks.map((task) => task.domain), DOVE_TASK_DOMAINS),
          byStage: countBy2(tasks.map((task) => task.stage), DOVE_TASK_STAGES),
          byLevel: levelCounts
        },
        index: {
          path: ARTIFACT_PATHS.taskPacketsIndex,
          version: inputs.taskPackets.version ?? null,
          activeInitId: inputs.taskPackets.taskModel?.activeInitId ?? initTask?.id ?? null,
          activeTaskIds: normalizeStringArray8(inputs.taskPackets.taskModel?.activeTaskIds).length > 0 ? normalizeStringArray8(inputs.taskPackets.taskModel?.activeTaskIds) : activeTasks.map((task) => task.id)
        }
      },
      blockers,
      review,
      lessons,
      versions,
      experiments,
      checklist: {
        path: ARTIFACT_PATHS.checklist,
        uncheckedCount: uncheckedChecklistCount(inputs.checklist),
        completedCount: completedChecklistCount(inputs.checklist)
      },
      returnReadiness: {
        status: returnStatus,
        activeTaskCount: activeTasks.length,
        blockerCount: blockers.length,
        unresolvedConcernCount: review.unresolvedConcernCount,
        readErrorCount: inputs.readErrors.length
      },
      nextAction: nextCommand
    },
    board: {
      domain: currentDomain,
      stage: currentStage,
      primaryRole,
      nextCommand,
      phase: inputs.board.currentPhase ?? null,
      assignedRole: inputs.board.assignedRole ?? null
    },
    suggestedNextCommand: nextCommand,
    diagnostics: {
      readErrors: inputs.readErrors,
      artifactPathsRead: artifactPathsReadForDove(),
      derivedReports: {
        navigationReportPath: ARTIFACT_PATHS.navigationReport,
        wikiPath: ARTIFACT_PATHS.wiki
      },
      primaryStateSources: [ARTIFACT_PATHS.state, ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.taskPacketsPacketsDir, ARTIFACT_PATHS.runtimeContinuation, ARTIFACT_PATHS.runtimeEvents, ARTIFACT_PATHS.runtimeResults, ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.versionsIndex, ARTIFACT_PATHS.metaOperatorLessons],
      durableContextNotice,
      mayRefreshDerivedSurfaces: false,
      noCommandExecution: true,
      noExternalProcess: true,
      noGitInspection: true,
      noSourceMutation: true
    }
  };
  return wantsFullDoveStatus(args) ? fullResult : compactDoveStatusResult(fullResult, args);
}
function queryDoveOrchestrate(root, args = {}) {
  const { inputs, mission, responseLanguage } = buildMissionContract(root, args);
  const recommendedCommand = selectRouteCommand(mission, args);
  return {
    mode: "dove-orchestrate-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    responseLanguage,
    mission,
    route: {
      recommendedCommand,
      nextCommand: recommendedCommand,
      reason: routeReason(mission, recommendedCommand, args, responseLanguage),
      roleBoundary: {
        primaryRole: mission.primaryRole,
        reviewerIsolationRequired: mission.primaryRole === "reviewer" || mission.stage === "audit"
      },
      domainStageRoutes: mission.domainGuidance.stageRoutes
    },
    workspace: buildWorkspaceSummary(inputs),
    diagnostics: {
      readErrors: inputs.readErrors,
      artifactPathsRead: artifactPathsReadForDove(),
      noRefresh: true,
      noCommandExecution: true,
      noGitInspection: true
    }
  };
}
function queryDoveAudit(root, args = {}) {
  const { inputs, mission, responseLanguage } = buildMissionContract(root, args);
  const paperAudit = queryPaperAudit(root, { scope: args.scope ?? mission.goal });
  const returnReadiness = queryDoveReturn(root, args);
  return {
    mode: "dove-audit-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    responseLanguage,
    mission,
    audit: {
      verdict: auditVerdictFromSeverityCounts(paperAudit.severityCounts),
      mode: paperAudit.mode,
      scope: args.scope ?? mission.goal,
      severityCounts: paperAudit.severityCounts,
      categoryCounts: paperAudit.categoryCounts,
      findingCount: paperAudit.findings.length,
      suggestedNextCommands: paperAudit.suggestedNextCommands
    },
    findings: paperAudit.findings.map((finding) => normalizePaperAuditFinding(finding, mission)),
    returnReadiness: {
      returnStatus: returnReadiness.returnStatus,
      nextCommand: returnReadiness.nextCommand,
      missingReturnEvidence: returnReadiness.missingReturnEvidence,
      engineeringEvidence: returnReadiness.engineeringEvidence,
      checklist: returnReadiness.checklist,
      review: returnReadiness.review
    },
    workspace: buildWorkspaceSummary(inputs),
    diagnostics: {
      readErrors: [...inputs.readErrors, ...paperAudit.diagnostics?.readErrors ?? [], ...returnReadiness.diagnostics?.readErrors ?? []],
      artifactPathsRead: Array.from(/* @__PURE__ */ new Set([
        ...artifactPathsReadForDove(),
        ...paperAudit.artifactPathsRead ?? [],
        ...returnReadiness.diagnostics?.artifactPathsRead ?? []
      ])),
      noRefresh: true,
      noCommandExecution: true,
      noGitInspection: true
    }
  };
}
function queryDoveMissionBoard(root, args = {}) {
  const { inputs, mission, responseLanguage } = buildMissionContract(root, args);
  const boardStage = normalizeDoveMissionLifecycleStage(args.stage ?? args.missionStage, missionStageForPhase(inputs.board.currentPhase));
  const boardRole = primaryRoleForStage(boardStage);
  const allMissions = inputs.packets.map(buildMissionBoardMission);
  const missions = allMissions.filter((item) => matchesMissionBoardFilters(item, args));
  return {
    mode: "dove-mission-board-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    responseLanguage,
    workspace: {
      ...buildWorkspaceSummary(inputs),
      asReadSnapshot: true,
      workspaceIndexUpdatedAt: inputs.workspaceIndex.updatedAt ?? null
    },
    board: {
      goal: mission.goal,
      domain: mission.domain,
      stage: boardStage,
      boardPhase: inputs.board.currentPhase ?? null,
      boardAssignedRole: inputs.board.assignedRole ?? null,
      primaryRole: boardRole.id,
      nextCommand: mission.nextCommand,
      currentFocus: inputs.board.currentFocus ?? inputs.workspaceIndex.currentFocus ?? null,
      objective: inputs.board.objective ?? null,
      intentType: inputs.board.intentType ?? null,
      nextAction: inputs.board.nextAction ?? inputs.workspaceIndex.nextAction ?? null,
      continuationState: inputs.board.continuationState ?? null,
      reviewRequiredBeforeFinalize: Boolean(inputs.board.reviewRequiredBeforeFinalize),
      acceptanceChecks: mission.acceptanceChecks,
      returnProtocol: mission.returnProtocol
    },
    missions,
    queues: buildMissionQueues(missions),
    counts: buildMissionBoardCounts(allMissions),
    filters: {
      domain: normalizeDoveDomainId(args.domain ?? args.doveDomain ?? args.missionDomain, null),
      stage: normalizeDoveMissionLifecycleStage(args.stage ?? args.missionStage, null),
      packetIds: normalizeStringArray8(args.packetId ?? args.packetIds ?? args.missionPacketId ?? args.missionPacketIds),
      statuses: normalizeStringArray8(args.status ?? args.statuses),
      includeArchived: booleanArg(args.includeArchived)
    },
    diagnostics: {
      readErrors: inputs.readErrors,
      artifactPathsRead: artifactPathsReadForDove(),
      noRefresh: true,
      noCommandExecution: true,
      noGitInspection: true
    }
  };
}
function queryDoveMission(root, args = {}) {
  const { inputs, mission, responseLanguage } = buildMissionContract(root, args);
  return {
    mode: "dove-mission-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    responseLanguage,
    mission,
    workspace: buildWorkspaceSummary(inputs),
    packets: inputs.packets,
    diagnostics: {
      readErrors: inputs.readErrors,
      artifactPathsRead: artifactPathsReadForDove()
    }
  };
}
function queryDoveReturn(root, args = {}) {
  const { inputs, mission, responseLanguage } = buildMissionContract(root, args);
  const validationEvidencePaths = mergeStringArrays(args.validationEvidencePaths, args.validationEvidence, args.evidencePaths);
  const paperAudit = ["paper", "experiment", "review"].includes(mission.domain) ? queryPaperAudit(root, { scope: args.scope ?? mission.goal }) : null;
  const completedChecks = completedChecklistCount(inputs.checklist);
  const uncheckedChecks = uncheckedChecklistCount(inputs.checklist);
  const engineeringEvidence = mission.domain === "engineering" ? buildEngineeringEvidence(root, args, inputs, mission, completedChecks, uncheckedChecks) : null;
  const status = classifyReturnStatus({ mission, inputs, paperAudit, engineeringEvidence });
  const evidenceRead = Array.from(/* @__PURE__ */ new Set([
    ...mission.targetArtifacts,
    ...engineeringEvidence ? engineeringEvidence.evidenceReadPaths : validationEvidencePaths,
    ARTIFACT_PATHS.workspaceIndex,
    ARTIFACT_PATHS.taskPacketsIndex,
    ARTIFACT_PATHS.reviewState,
    ARTIFACT_PATHS.checklist,
    ARTIFACT_PATHS.versionsIndex,
    ARTIFACT_PATHS.versionComparisons
  ])).filter(Boolean);
  const acceptanceMissing = mission.acceptanceChecks.filter((check) => {
    const normalized = check.toLowerCase();
    if (mission.domain === "engineering") {
      if (normalized.includes("changed")) {
        return !engineeringEvidence.changedFiles.satisfied;
      }
      if (normalized.includes("test") || normalized.includes("validation") || normalized.includes("output")) {
        return !engineeringEvidence.validationEvidence.satisfied || engineeringEvidence.validationOutput.status !== "passed";
      }
    } else if (normalized.includes("test") || normalized.includes("validation")) {
      return validationEvidencePaths.length === 0 && !inputs.packets.some((packet) => packet.evidenceLinks.length > 0);
    }
    if (normalized.includes("checklist")) {
      return !inputs.checklist || uncheckedChecks > 0;
    }
    if (normalized.includes("review")) {
      return inputs.reviewState.lastVerdict === "not-reviewed";
    }
    return false;
  });
  const missingReturnEvidence = Array.from(/* @__PURE__ */ new Set([
    ...acceptanceMissing,
    ...engineeringEvidence ? engineeringEvidence.missingEvidence.map((item) => item.requirement) : []
  ]));
  return {
    mode: "dove-return-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    responseLanguage,
    returnStatus: status,
    acceptanceVerdict: status === "ready" ? doveText(responseLanguage, "returnReadyVerdict") : doveText(responseLanguage, "returnNotReadyVerdict"),
    nextCommand: nextCommandForReturnStatus(status, mission.domain),
    mission,
    evidenceRead,
    missingReturnEvidence,
    lessonRitual: {
      command: "project:dove.lessons",
      optional: true,
      when: doveText(responseLanguage, "lessonRitualWhen"),
      requiredFields: ["title", "problem", "decisions", "pitfalls", "validation", "nextTime"],
      noAutoCapture: true,
      noAutoApply: true,
      noExecution: true
    },
    workspace: buildWorkspaceSummary(inputs),
    checklist: {
      completedCount: completedChecks,
      uncheckedCount: uncheckedChecks,
      path: ARTIFACT_PATHS.checklist
    },
    review: {
      lastVerdict: inputs.reviewState.lastVerdict ?? "not-reviewed",
      unresolvedConcernIds: normalizeStringArray8(inputs.reviewState.unresolvedConcernIds),
      openItems: normalizeStringArray8(inputs.reviewState.openItems)
    },
    packets: inputs.packets,
    engineeringEvidence,
    audit: paperAudit ? {
      mode: paperAudit.mode,
      severityCounts: paperAudit.severityCounts,
      findingCount: paperAudit.findings.length,
      suggestedNextCommands: paperAudit.suggestedNextCommands
    } : null,
    diagnostics: {
      readErrors: inputs.readErrors,
      artifactPathsRead: evidenceRead,
      declaredInputsOnly: mission.domain === "engineering",
      noCommandExecution: mission.domain === "engineering",
      noGitInspection: mission.domain === "engineering"
    }
  };
}

// src/core/public-status.mjs
import fs13 from "node:fs";
import path14 from "node:path";
var PUBLIC_STATUS_VERSION = 1;
var GLOBAL_PUBLIC_STATUS_VERSION = 1;
var PUBLIC_TASK_LIMIT = 12;
var PUBLIC_RECENT_LIMIT = 8;
var SECRET_PATTERNS = [
  { pattern: /sk-ant-[A-Za-z0-9_-]+/g, replacement: "<redacted>" },
  { pattern: /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, replacement: "Bearer <redacted>" },
  { pattern: /\b(api[_-]?key|auth[_-]?token|access[_-]?token|secret|password|passwd|pwd)\s*[:=]\s*[^\s,;"']+/gi, replacement: (match, label) => `${label}=<redacted>` }
];
function redactText(value) {
  let text3 = String(value ?? "");
  for (const item of SECRET_PATTERNS) {
    text3 = text3.replace(item.pattern, item.replacement);
  }
  return text3;
}
function publicString(value, maxLength = 320) {
  const text3 = redactText(value).replace(/\s+/g, " ").trim();
  if (!text3) {
    return null;
  }
  return text3.length > maxLength ? `${text3.slice(0, maxLength - 1)}\u2026` : text3;
}
function publicStringArray(value, limit = 10, maxLength = 220) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return Array.from(new Set(values.map((item) => publicString(item, maxLength)).filter(Boolean))).slice(0, limit);
}
function firstPublicString(...values) {
  for (const value of values) {
    const normalized = publicString(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}
function publicTask(task) {
  if (!task || typeof task !== "object") {
    return null;
  }
  return {
    id: publicString(task.id, 160),
    title: publicString(task.title, 220) ?? publicString(task.id, 160),
    summary: firstPublicString(task.summary, task.currentFocus, task.lastStopReason),
    status: publicString(task.status, 80),
    stage: publicString(task.stage, 80),
    domain: publicString(task.domain, 80),
    level: Number.isFinite(Number(task.level)) ? Number(task.level) : null,
    creatorKind: publicString(task.creatorKind, 80),
    currentFocus: publicString(task.currentFocus),
    nextAction: publicString(task.nextAction, 160),
    blockedReason: publicString(task.blockedReason ?? task.lastStopReason),
    boundary: task.actionableBoundary ? {
      id: publicString(task.actionableBoundary.id, 160),
      type: publicString(task.actionableBoundary.type, 120),
      reason: publicString(task.actionableBoundary.reason ?? task.actionableBoundary.summary),
      requiredInputs: publicStringArray(task.actionableBoundary.requiredInputs),
      requiredActions: publicStringArray(task.actionableBoundary.requiredActions),
      ownerRole: publicString(task.actionableBoundary.ownerRole, 80),
      nextRole: publicString(task.actionableBoundary.nextRole, 80)
    } : null,
    evidenceExpectations: publicStringArray(task.evidenceExpectations),
    evidenceLinks: publicStringArray(task.evidenceLinks, 8),
    artifactRefs: publicStringArray(task.artifactRefs, 8),
    updatedAt: publicString(task.updatedAt, 80),
    completedAt: publicString(task.completedAt, 80)
  };
}
function publicAction(action) {
  if (!action || typeof action !== "object") {
    return null;
  }
  return {
    rank: Number.isFinite(Number(action.rank)) ? Number(action.rank) : null,
    title: publicString(action.title ?? action.label, 220),
    why: publicString(action.why ?? action.reason ?? action.summary),
    command: publicString(action.command, 160),
    packetId: publicString(action.packetId, 160),
    boundaryType: publicString(action.boundaryType, 120),
    requires: publicStringArray(action.requires ?? [...publicStringArray(action.requiredInputs), ...publicStringArray(action.requiredActions)])
  };
}
function publicReview(review) {
  const reviewerIndependence = review?.reviewerIndependence;
  const reviewerIndependenceSummary = reviewerIndependence && typeof reviewerIndependence === "object" ? firstPublicString(reviewerIndependence.summary, reviewerIndependence.status, reviewerIndependence.reviewerRole) : publicString(reviewerIndependence, 160);
  return {
    verdict: publicString(review?.verdict, 80) ?? "not-reviewed",
    reviewedAt: publicString(review?.reviewedAt, 80),
    unresolvedConcernCount: Number(review?.unresolvedConcernCount ?? 0),
    openConcernCount: Number(review?.openConcernCount ?? 0),
    reviewerIndependence: reviewerIndependenceSummary
  };
}
function publicRuntime(status) {
  const runtime = status.dashboard?.runtime ?? {};
  return {
    continuation: {
      continuationCount: Number(runtime.continuation?.continuationCount ?? 0),
      currentKind: publicString(runtime.continuation?.currentKind, 120),
      currentPacketId: publicString(runtime.continuation?.currentPacketId, 160),
      currentCommand: publicString(runtime.continuation?.currentCommand, 160),
      overview: publicString(runtime.continuation?.overview)
    },
    results: {
      runCount: Number(runtime.results?.runCount ?? 0),
      completedCount: Number(runtime.results?.completedCount ?? 0),
      errorCount: Number(runtime.results?.errorCount ?? 0),
      lastStatus: publicString(runtime.results?.lastStatus, 120),
      lastOutcome: publicString(runtime.results?.lastOutcome, 160),
      overview: publicString(runtime.results?.overview)
    },
    events: {
      eventCount: Number(runtime.events?.eventCount ?? 0),
      lastEventType: publicString(runtime.events?.lastEventType, 120),
      overview: publicString(runtime.events?.overview)
    }
  };
}
function publicTaskSection(tasks, limit) {
  return (Array.isArray(tasks) ? tasks : []).map(publicTask).filter(Boolean).slice(0, limit);
}
function publicDocumentEntry(entry) {
  if (!entry || typeof entry !== "object" || entry.publicSafe !== true) {
    return null;
  }
  return {
    id: publicString(entry.id, 160),
    packetId: publicString(entry.packetId, 160),
    documentId: publicString(entry.documentId, 160),
    title: publicString(entry.title, 220) ?? publicString(entry.documentId, 160),
    documentKind: publicString(entry.documentKind, 80),
    status: publicString(entry.status, 80),
    evidenceScope: publicString(entry.evidenceScope, 80),
    summary: publicString(entry.summary),
    artifactRefs: publicStringArray(entry.artifactRefs, 6),
    evidenceLinks: publicStringArray(entry.evidenceLinks, 6),
    updatedAt: publicString(entry.updatedAt, 80)
  };
}
function publicDocuments(root) {
  const ledger = normalizeDocumentLedgerIndex(readJson(root, ARTIFACT_PATHS.documentsLedger, createDocumentLedgerIndex));
  const publicSafeLedgerEntries = ledger.entries.filter((entry) => entry.publicSafe === true);
  const publicSafeEntries = publicSafeLedgerEntries.map(publicDocumentEntry).filter(Boolean).slice(-PUBLIC_RECENT_LIMIT);
  return {
    counts: {
      total: publicSafeLedgerEntries.length,
      internalEvidence: publicSafeLedgerEntries.filter((entry) => entry.evidenceScope === "internal").length,
      externalEvidence: publicSafeLedgerEntries.filter((entry) => entry.evidenceScope === "external").length,
      mixedEvidence: publicSafeLedgerEntries.filter((entry) => entry.evidenceScope === "mixed").length,
      publicSafe: publicSafeLedgerEntries.length
    },
    recentPublicSafe: publicSafeEntries,
    ledgerPath: ARTIFACT_PATHS.documentsLedger
  };
}
function countRuntimeEntries(root) {
  const results = readJson(root, ARTIFACT_PATHS.runtimeResults, createRuntimeResultsIndex);
  const events = readJson(root, ARTIFACT_PATHS.runtimeEvents, createRuntimeEventsIndex);
  const taskPackets = readJson(root, ARTIFACT_PATHS.taskPacketsIndex, createTaskPacketsIndex);
  return {
    taskPacketIndexItems: Array.isArray(taskPackets.items) ? taskPackets.items.length : 0,
    runtimeResultEntries: Array.isArray(results.entries) ? results.entries.length : 0,
    runtimeEventEntries: Array.isArray(events.entries) ? events.entries.length : 0
  };
}
function markdownList(items, formatter) {
  if (!Array.isArray(items) || items.length === 0) {
    return "- \u6682\u65E0\n";
  }
  return items.map(formatter).join("\n") + "\n";
}
function renderMarkdown(snapshot) {
  const activeTasks = markdownList(snapshot.tasks.active, (task) => `- ${task.title} \`${task.id}\` \u2014 ${task.status}${task.nextAction ? `\uFF1B\u4E0B\u4E00\u6B65\uFF1A${task.nextAction}` : ""}`);
  const blockedTasks = markdownList(snapshot.tasks.blocked, (task) => `- ${task.title} \`${task.id}\` \u2014 ${task.blockedReason ?? task.boundary?.reason ?? "\u5DF2\u963B\u585E"}`);
  const recentCompleted = markdownList(snapshot.tasks.recentCompleted, (task) => `- ${task.title} \`${task.id}\`${task.completedAt ? ` \u2014 ${task.completedAt}` : ""}`);
  const actions = markdownList(snapshot.nextActions, (action) => `- ${action.title ?? action.command} ${action.command ? `\`${action.command}\`` : ""}${action.why ? ` \u2014 ${action.why}` : ""}`);
  const documents = markdownList(snapshot.documents.recentPublicSafe, (entry) => `- ${entry.title} \`${entry.documentId ?? entry.id}\` \u2014 ${entry.documentKind}/${entry.status}/${entry.evidenceScope}${entry.summary ? `\uFF1B${entry.summary}` : ""}`);
  return `# Dove \u9879\u76EE\u8FDB\u5C55

> \u81EA\u52A8\u751F\u6210\uFF1A${snapshot.generatedAt}
> \u6765\u6E90\uFF1ADove durable state \u7684\u516C\u5F00\u5B89\u5168\u6458\u8981\uFF1B\u4E0D\u5305\u542B raw transcripts\u3001\u79C1\u5BC6\u63A8\u7406\u3001\u73AF\u5883\u53D8\u91CF\u6216\u5B8C\u6574 .dove dump\u3002

## \u76EE\u6807

- \u9879\u76EE\uFF1A${snapshot.project.title ?? "\u672A\u8BBE\u7F6E"}
- \u76EE\u6807\uFF1A${snapshot.project.objective ?? "\u672A\u8BBE\u7F6E"}
- \u5F53\u524D\u7126\u70B9\uFF1A${snapshot.project.currentFocus ?? "\u6682\u65E0"}
- \u4E0B\u4E00\u6B65\uFF1A${snapshot.project.nextAction ?? "project:dove.status"}

## \u8FDB\u5C55\u6982\u89C8

- \u6D3B\u8DC3\u4EFB\u52A1\uFF1A${snapshot.progress.counts.active}
- \u963B\u585E\u4EFB\u52A1\uFF1A${snapshot.progress.counts.blocked}
- \u5DF2\u5B8C\u6210\u4EFB\u52A1\uFF1A${snapshot.progress.counts.completed}
- \u5DF2\u6740\u6B7B\u4EFB\u52A1\uFF1A${snapshot.progress.counts.killed}
- \u5DF2\u5F52\u6863\u4EFB\u52A1\uFF1A${snapshot.progress.counts.archived}${snapshot.progress.counts.archivedHidden ? `\uFF08\u9ED8\u8BA4\u9690\u85CF ${snapshot.progress.counts.archivedHidden}\uFF09` : ""}
- Review verdict\uFF1A${snapshot.progress.review.verdict}
- Runtime\uFF1A${snapshot.progress.runtime.results.lastStatus ?? "never-run"}/${snapshot.progress.runtime.results.lastOutcome ?? "not-started"}
- \u516C\u5F00\u5B89\u5168\u6587\u6863/\u8BC1\u636E\uFF1A${snapshot.documents.counts.publicSafe}/${snapshot.documents.counts.total}

## \u5F53\u524D\u6D3B\u8DC3\u4EFB\u52A1

${activeTasks}
## \u963B\u585E / \u8FB9\u754C

${blockedTasks}
## \u6700\u8FD1\u5B8C\u6210

${recentCompleted}
## \u5EFA\u8BAE\u4E0B\u4E00\u6B65

${actions}
## \u516C\u5F00\u6587\u6863 / \u8BC1\u636E\u6458\u8981

${documents}
## \u516C\u5F00\u8FB9\u754C

- \u4EC5\u516C\u5F00\u6D3E\u751F\u6458\u8981\uFF0C\u4E0D\u516C\u5F00 raw runtime entries\u3001raw document ledger entries \u6216\u6587\u6863\u6B63\u6587\u3002
- \u4E0D\u516C\u5F00 Claude/host transcript\u3001\u9690\u85CF\u63A8\u7406\u3001\u73AF\u5883\u53D8\u91CF\u3001token\u3001\u5BC6\u7801\u6216\u5B8C\u6574 .dove \u5185\u5BB9\u3002
- \u82E5\u8981\u5916\u7F51\u8BBF\u95EE\uFF0C\u5EFA\u8BAE\u53EA\u66B4\u9732 \`.dove/public\`\uFF0C\u5E76\u5728 Cloudflare/\u53CD\u4EE3\u5C42\u52A0\u8BBF\u95EE\u63A7\u5236\u3002
`;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
}
function htmlTaskList(tasks) {
  if (!tasks.length) {
    return "<li>\u6682\u65E0</li>";
  }
  return tasks.map((task) => `<li><strong>${escapeHtml(task.title)}</strong> <code>${escapeHtml(task.id)}</code><br><span>${escapeHtml(task.status)}${task.nextAction ? ` \xB7 \u4E0B\u4E00\u6B65\uFF1A${escapeHtml(task.nextAction)}` : ""}</span>${task.summary ? `<p>${escapeHtml(task.summary)}</p>` : ""}</li>`).join("\n");
}
function htmlActionList(actions) {
  if (!actions.length) {
    return "<li>\u6682\u65E0</li>";
  }
  return actions.map((action) => `<li><strong>${escapeHtml(action.title ?? action.command)}</strong>${action.command ? ` <code>${escapeHtml(action.command)}</code>` : ""}${action.why ? `<p>${escapeHtml(action.why)}</p>` : ""}</li>`).join("\n");
}
function htmlDocumentList(documents) {
  if (!documents.length) {
    return "<li>\u6682\u65E0</li>";
  }
  return documents.map((entry) => `<li><strong>${escapeHtml(entry.title)}</strong> <code>${escapeHtml(entry.documentId ?? entry.id)}</code><br><span>${escapeHtml(entry.documentKind)}/${escapeHtml(entry.status)} \xB7 ${escapeHtml(entry.evidenceScope)}</span>${entry.summary ? `<p>${escapeHtml(entry.summary)}</p>` : ""}</li>`).join("\n");
}
function renderHtml(snapshot) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(snapshot.project.title ?? "Dove \u9879\u76EE\u8FDB\u5C55")}</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #0f172a; color: #e2e8f0; }
    main { max-width: 980px; margin: 0 auto; padding: 32px 20px 56px; }
    a { color: #93c5fd; }
    .hero, section { background: rgba(15, 23, 42, 0.82); border: 1px solid rgba(148, 163, 184, 0.28); border-radius: 18px; padding: 20px; margin: 16px 0; box-shadow: 0 18px 48px rgba(15, 23, 42, 0.28); }
    h1, h2 { margin: 0 0 12px; }
    .meta, .muted { color: #94a3b8; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .metric { background: rgba(30, 41, 59, 0.72); border-radius: 14px; padding: 14px; }
    .metric strong { display: block; font-size: 1.8rem; }
    li { margin: 0 0 12px; }
    code { background: rgba(148, 163, 184, 0.18); border-radius: 6px; padding: 2px 6px; }
  </style>
</head>
<body>
<main>
  <div class="hero">
    <p class="meta">Dove public status \xB7 ${escapeHtml(snapshot.generatedAt)}</p>
    <h1>${escapeHtml(snapshot.project.title ?? "Dove \u9879\u76EE\u8FDB\u5C55")}</h1>
    <p>${escapeHtml(snapshot.project.objective ?? "\u672A\u8BBE\u7F6E\u9879\u76EE\u76EE\u6807")}</p>
    <p><strong>\u5F53\u524D\u7126\u70B9\uFF1A</strong>${escapeHtml(snapshot.project.currentFocus ?? "\u6682\u65E0")}</p>
    <p><strong>\u4E0B\u4E00\u6B65\uFF1A</strong><code>${escapeHtml(snapshot.project.nextAction ?? "project:dove.status")}</code></p>
    <p><a href="status.json">status.json</a> \xB7 <a href="status.md">status.md</a></p>
  </div>

  <section>
    <h2>\u8FDB\u5C55\u6982\u89C8</h2>
    <div class="grid">
      <div class="metric"><strong>${snapshot.progress.counts.active}</strong><span>\u6D3B\u8DC3</span></div>
      <div class="metric"><strong>${snapshot.progress.counts.blocked}</strong><span>\u963B\u585E</span></div>
      <div class="metric"><strong>${snapshot.progress.counts.completed}</strong><span>\u5B8C\u6210</span></div>
      <div class="metric"><strong>${snapshot.progress.counts.killed}</strong><span>\u6740\u6B7B</span></div>
      <div class="metric"><strong>${snapshot.progress.counts.archived}${snapshot.progress.counts.archivedHidden ? ` / ${snapshot.progress.counts.archivedHidden}` : ""}</strong><span>\u5F52\u6863 / \u9ED8\u8BA4\u9690\u85CF</span></div>
      <div class="metric"><strong>${snapshot.documents.counts.publicSafe}/${snapshot.documents.counts.total}</strong><span>\u516C\u5F00\u6587\u6863/\u8BC1\u636E</span></div>
    </div>
    <p class="muted">Review: ${escapeHtml(snapshot.progress.review.verdict)} \xB7 Runtime: ${escapeHtml(snapshot.progress.runtime.results.lastStatus ?? "never-run")}/${escapeHtml(snapshot.progress.runtime.results.lastOutcome ?? "not-started")}</p>
  </section>

  <section><h2>\u5F53\u524D\u6D3B\u8DC3\u4EFB\u52A1</h2><ul>${htmlTaskList(snapshot.tasks.active)}</ul></section>
  <section><h2>\u963B\u585E / \u8FB9\u754C</h2><ul>${htmlTaskList(snapshot.tasks.blocked)}</ul></section>
  <section><h2>\u6700\u8FD1\u5B8C\u6210</h2><ul>${htmlTaskList(snapshot.tasks.recentCompleted)}</ul></section>
  <section><h2>\u5EFA\u8BAE\u4E0B\u4E00\u6B65</h2><ul>${htmlActionList(snapshot.nextActions)}</ul></section>
  <section><h2>\u516C\u5F00\u6587\u6863 / \u8BC1\u636E\u6458\u8981</h2><ul>${htmlDocumentList(snapshot.documents.recentPublicSafe)}</ul></section>
  <section><h2>\u516C\u5F00\u8FB9\u754C</h2><p class="muted">\u6B64\u9875\u9762\u53EA\u53D1\u5E03 Dove durable state \u7684\u8131\u654F\u6458\u8981\uFF0C\u4E0D\u53D1\u5E03 raw transcripts\u3001raw document ledger entries\u3001\u6587\u6863\u6B63\u6587\u3001\u79C1\u5BC6\u63A8\u7406\u3001\u73AF\u5883\u53D8\u91CF\u3001token\u3001\u5BC6\u7801\u6216\u5B8C\u6574 .dove \u5185\u5BB9\u3002\u5916\u7F51\u8BBF\u95EE\u65F6\u5EFA\u8BAE\u53EA\u66B4\u9732 <code>.dove/public</code> \u5E76\u542F\u7528\u8BBF\u95EE\u63A7\u5236\u3002</p></section>
</main>
</body>
</html>
`;
}
function isPlainObject4(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function arrayValue(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return value === void 0 || value === null ? [] : [value];
}
function slugify2(value, fallback) {
  const raw = publicString(value, 160) ?? fallback;
  const slug = String(raw ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || fallback;
}
function dedupeProjects(projects) {
  const byRoot = /* @__PURE__ */ new Map();
  for (const project of projects) {
    byRoot.set(project.root, project);
  }
  return Array.from(byRoot.values());
}
function withCollisionSafeSlugs(projects) {
  const used = /* @__PURE__ */ new Map();
  return projects.map((project, index) => {
    const base = slugify2(project.slug ?? project.id ?? project.title ?? path14.basename(project.root), `project-${index + 1}`);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    const slug = count === 0 ? base : `${base}-${count + 1}`;
    return {
      ...project,
      id: project.id ?? slug,
      slug,
      title: project.title ?? path14.basename(project.root)
    };
  });
}
function resolveGlobalStatusSelection(root, options = {}) {
  const env = options.env ?? process.env;
  const config = loadDoveConfig(root, env);
  const explicitProjects = normalizeGlobalStatusProjects([
    ...arrayValue(options.projects),
    ...arrayValue(options.projectRoots).map((projectRoot) => ({ root: projectRoot })),
    ...arrayValue(options.projectRoot).map((projectRoot) => ({ root: projectRoot }))
  ]);
  const configuredProjects = config.globalStatus.projects;
  const selected = explicitProjects.length > 0 ? options.includeConfig ? [...configuredProjects, ...explicitProjects] : explicitProjects : configuredProjects;
  return {
    env,
    config,
    outputDir: resolveDoveGlobalStatusOutputDir(options.outputDir ?? config.globalStatus.outputDir, env),
    projects: withCollisionSafeSlugs(dedupeProjects(selected))
  };
}
function readProjectPublicStatus(project) {
  const jsonPath = path14.join(project.root, ARTIFACT_PATHS.publicStatusJson);
  if (!fs13.existsSync(jsonPath)) {
    return { status: "missing", project, snapshot: null, reason: `${ARTIFACT_PATHS.publicStatusJson} is missing` };
  }
  try {
    const snapshot = JSON.parse(fs13.readFileSync(jsonPath, "utf8"));
    if (!isPlainObject4(snapshot) || snapshot.mode !== "dove-public-status") {
      return { status: "invalid", project, snapshot: null, reason: "status.json is not a Dove public status snapshot" };
    }
    return { status: "published", project, snapshot, reason: null };
  } catch {
    return { status: "invalid", project, snapshot: null, reason: "status.json could not be parsed" };
  }
}
function projectLinks(slug) {
  return {
    html: `projects/${slug}/index.html`,
    json: `projects/${slug}/status.json`,
    markdown: `projects/${slug}/status.md`
  };
}
function publicProjectCard(readResult) {
  const { project, snapshot, status, reason } = readResult;
  const title = publicString(project.title ?? snapshot?.project?.title, 220) ?? project.slug;
  return {
    id: publicString(project.id, 160) ?? project.slug,
    slug: project.slug,
    title,
    status,
    generatedAt: publicString(snapshot?.generatedAt, 80),
    summary: status === "published" ? firstPublicString(snapshot?.project?.currentFocus, snapshot?.project?.objective, snapshot?.project?.nextAction) : publicString(reason, 220),
    project: status === "published" ? {
      title: publicString(snapshot?.project?.title, 220),
      objective: publicString(snapshot?.project?.objective),
      currentFocus: publicString(snapshot?.project?.currentFocus),
      nextAction: publicString(snapshot?.project?.nextAction, 160)
    } : null,
    progress: status === "published" ? {
      counts: snapshot?.progress?.counts ?? {},
      review: publicReview(snapshot?.progress?.review),
      runtime: snapshot?.progress?.runtime ?? {}
    } : null,
    documents: status === "published" ? snapshot?.documents ?? null : null,
    links: projectLinks(project.slug)
  };
}
function buildGlobalStatusSnapshotFromReadResults(readResults, generatedAt) {
  const projectCards = readResults.map(publicProjectCard);
  const counts = {
    configured: readResults.length,
    published: projectCards.filter((project) => project.status === "published").length,
    missing: projectCards.filter((project) => project.status === "missing").length,
    invalid: projectCards.filter((project) => project.status === "invalid").length,
    skipped: projectCards.filter((project) => project.status === "skipped").length
  };
  return {
    version: GLOBAL_PUBLIC_STATUS_VERSION,
    mode: "dove-global-public-status",
    generatedAt,
    counts,
    projects: projectCards,
    publicArtifacts: {
      json: "status.json",
      markdown: "status.md",
      html: "index.html",
      projectsDir: "projects"
    },
    privacy: {
      sanitized: true,
      derivedOnly: true,
      rawDoveDumpIncluded: false,
      absoluteRootsIncluded: false,
      transcriptsIncluded: false,
      privateReasoningIncluded: false,
      environmentIncluded: false,
      runtimeEntriesIncluded: false,
      documentLedgerRawEntriesIncluded: false,
      documentBodiesIncluded: false,
      cloudflareTunnelStarted: false
    }
  };
}
function buildGlobalStatusSnapshot(root, options = {}) {
  const { projects } = resolveGlobalStatusSelection(root, options);
  return buildGlobalStatusSnapshotFromReadResults(projects.map(readProjectPublicStatus), options.generatedAt ?? nowIso());
}
function renderGlobalMarkdown(snapshot) {
  const projects = markdownList(snapshot.projects, (project) => {
    const counts = project.progress?.counts ?? {};
    const active = Number(counts.active ?? 0);
    const blocked = Number(counts.blocked ?? 0);
    const completed = Number(counts.completed ?? 0);
    const archived = Number(counts.archived ?? 0);
    const archivedHidden = Number(counts.archivedHidden ?? 0);
    const archiveSummary = archived > 0 || archivedHidden > 0 ? ` / \u5F52\u6863 ${archived}${archivedHidden ? `\uFF08\u9690\u85CF ${archivedHidden}\uFF09` : ""}` : "";
    return `- [${project.title}](${project.links.html}) \u2014 ${project.status}\uFF1B\u6D3B\u8DC3 ${active} / \u963B\u585E ${blocked} / \u5B8C\u6210 ${completed}${archiveSummary}${project.summary ? `\uFF1B${project.summary}` : ""}`;
  });
  return `# Dove \u5168\u5C40\u9879\u76EE\u8FDB\u5C55

> \u81EA\u52A8\u751F\u6210\uFF1A${snapshot.generatedAt}
> \u6765\u6E90\uFF1A\u5404\u9879\u76EE \`.dove/public\` \u7684\u516C\u5F00\u5B89\u5168\u6458\u8981\uFF1B\u4E0D\u5305\u542B\u672C\u673A\u7EDD\u5BF9\u8DEF\u5F84\u3001raw .dove dump\u3001transcript\u3001\u79C1\u5BC6\u63A8\u7406\u3001\u73AF\u5883\u53D8\u91CF\u6216\u6587\u6863\u6B63\u6587\u3002

## \u6982\u89C8

- \u5DF2\u914D\u7F6E\u9879\u76EE\uFF1A${snapshot.counts.configured}
- \u5DF2\u53D1\u5E03\u9879\u76EE\uFF1A${snapshot.counts.published}
- \u7F3A\u5931 public status\uFF1A${snapshot.counts.missing}
- \u65E0\u6548 public status\uFF1A${snapshot.counts.invalid}

## \u9879\u76EE

${projects}
## \u516C\u5F00\u8FB9\u754C

- \u8FD9\u4E2A\u5168\u5C40\u9875\u9762\u53EA\u805A\u5408\u6BCF\u4E2A\u9879\u76EE\u5DF2\u7ECF\u516C\u5F00\u5B89\u5168\u7684 \`.dove/public/status.*\`\u3002
- \u4E0D\u626B\u63CF\u6574\u53F0\u7535\u8111\uFF0C\u4E0D\u542F\u52A8 HTTP server \u6216 Cloudflare tunnel\u3002
- \u82E5\u8981\u5916\u7F51\u8BBF\u95EE\uFF0C\u5EFA\u8BAE\u53EA\u66B4\u9732\u8FD9\u4E2A\u5168\u5C40 public \u76EE\u5F55\uFF0C\u5E76\u5728 Cloudflare/\u53CD\u4EE3\u5C42\u52A0\u8BBF\u95EE\u63A7\u5236\u3002
`;
}
function htmlProjectCards(projects) {
  if (!projects.length) {
    return "<li>\u6682\u65E0\u5DF2\u914D\u7F6E\u9879\u76EE</li>";
  }
  return projects.map((project) => {
    const counts = project.progress?.counts ?? {};
    const archived = Number(counts.archived ?? 0);
    const archivedHidden = Number(counts.archivedHidden ?? 0);
    const archiveSummary = archived > 0 || archivedHidden > 0 ? ` \xB7 \u5F52\u6863 ${archived}${archivedHidden ? `\uFF08\u9690\u85CF ${archivedHidden}\uFF09` : ""}` : "";
    return `<li><strong><a href="${escapeHtml(project.links.html)}">${escapeHtml(project.title)}</a></strong> <code>${escapeHtml(project.status)}</code><br><span>\u6D3B\u8DC3 ${escapeHtml(counts.active ?? 0)} \xB7 \u963B\u585E ${escapeHtml(counts.blocked ?? 0)} \xB7 \u5B8C\u6210 ${escapeHtml(counts.completed ?? 0)}${escapeHtml(archiveSummary)}</span>${project.summary ? `<p>${escapeHtml(project.summary)}</p>` : ""}</li>`;
  }).join("\n");
}
function renderGlobalHtml(snapshot) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dove \u5168\u5C40\u9879\u76EE\u8FDB\u5C55</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #0f172a; color: #e2e8f0; }
    main { max-width: 980px; margin: 0 auto; padding: 32px 20px 56px; }
    a { color: #93c5fd; }
    .hero, section { background: rgba(15, 23, 42, 0.82); border: 1px solid rgba(148, 163, 184, 0.28); border-radius: 18px; padding: 20px; margin: 16px 0; box-shadow: 0 18px 48px rgba(15, 23, 42, 0.28); }
    h1, h2 { margin: 0 0 12px; }
    .meta, .muted { color: #94a3b8; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .metric { background: rgba(30, 41, 59, 0.72); border-radius: 14px; padding: 14px; }
    .metric strong { display: block; font-size: 1.8rem; }
    li { margin: 0 0 14px; }
    code { background: rgba(148, 163, 184, 0.18); border-radius: 6px; padding: 2px 6px; }
  </style>
</head>
<body>
<main>
  <div class="hero">
    <p class="meta">Dove global public status \xB7 ${escapeHtml(snapshot.generatedAt)}</p>
    <h1>Dove \u5168\u5C40\u9879\u76EE\u8FDB\u5C55</h1>
    <p>\u805A\u5408\u6240\u6709\u663E\u5F0F\u6CE8\u518C\u9879\u76EE\u7684\u516C\u5F00\u5B89\u5168\u72B6\u6001\u9875\u3002</p>
    <p><a href="status.json">status.json</a> \xB7 <a href="status.md">status.md</a></p>
  </div>
  <section>
    <h2>\u6982\u89C8</h2>
    <div class="grid">
      <div class="metric"><strong>${snapshot.counts.configured}</strong><span>\u5DF2\u914D\u7F6E</span></div>
      <div class="metric"><strong>${snapshot.counts.published}</strong><span>\u5DF2\u53D1\u5E03</span></div>
      <div class="metric"><strong>${snapshot.counts.missing}</strong><span>\u7F3A\u5931</span></div>
      <div class="metric"><strong>${snapshot.counts.invalid}</strong><span>\u65E0\u6548</span></div>
    </div>
  </section>
  <section><h2>\u9879\u76EE</h2><ul>${htmlProjectCards(snapshot.projects)}</ul></section>
  <section><h2>\u516C\u5F00\u8FB9\u754C</h2><p class="muted">\u6B64\u9875\u9762\u53EA\u805A\u5408\u5404\u9879\u76EE\u5DF2\u53D1\u5E03\u7684\u516C\u5F00\u5B89\u5168\u6458\u8981\uFF0C\u4E0D\u5305\u542B\u672C\u673A\u7EDD\u5BF9\u8DEF\u5F84\u3001raw .dove dump\u3001transcript\u3001\u79C1\u5BC6\u63A8\u7406\u3001\u73AF\u5883\u53D8\u91CF\u3001token\u3001\u5BC6\u7801\u6216\u6587\u6863\u6B63\u6587\u3002Dove \u4E0D\u4F1A\u81EA\u52A8\u542F\u52A8 HTTP server \u6216 Cloudflare tunnel\u3002</p></section>
</main>
</body>
</html>
`;
}
function projectPlaceholderMarkdown(project, status, reason) {
  const title = publicString(project.title, 220) ?? project.slug;
  return `# ${title}

- \u72B6\u6001\uFF1A${status}
- \u539F\u56E0\uFF1A${publicString(reason, 220) ?? "\u9879\u76EE public status \u4E0D\u53EF\u7528"}
`;
}
function projectPlaceholderHtml(project, status, reason) {
  const title = publicString(project.title, 220) ?? project.slug;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head><body><main><h1>${escapeHtml(title)}</h1><p>\u72B6\u6001\uFF1A${escapeHtml(status)}</p><p>${escapeHtml(publicString(reason, 220) ?? "\u9879\u76EE public status \u4E0D\u53EF\u7528")}</p><p><a href="../../index.html">\u8FD4\u56DE\u5168\u5C40\u9996\u9875</a></p></main></body></html>
`;
}
function ensureAbsoluteDir(dirPath) {
  fs13.mkdirSync(dirPath, { recursive: true });
}
function writeAbsoluteJson(filePath, value) {
  ensureAbsoluteDir(path14.dirname(filePath));
  fs13.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}
`, "utf8");
}
function writeAbsoluteText(filePath, value) {
  ensureAbsoluteDir(path14.dirname(filePath));
  fs13.writeFileSync(filePath, value, "utf8");
}
function projectRelativeOutputPath(root, filePath) {
  const relativePath = path14.relative(path14.resolve(root), path14.resolve(filePath));
  if (!relativePath || relativePath.startsWith("..") || path14.isAbsolute(relativePath)) {
    return null;
  }
  return relativePath.split(path14.sep).join("/");
}
function writeOutputJson(root, filePath, value) {
  const relativePath = projectRelativeOutputPath(root, filePath);
  if (relativePath) {
    writeJson(root, relativePath, value);
    return;
  }
  if (isPatchPlanMode(root)) {
    throw new Error("publish_dove_global_status patch-plan requires outputDir to stay inside the target project.");
  }
  writeAbsoluteJson(filePath, value);
}
function writeOutputText(root, filePath, value) {
  const relativePath = projectRelativeOutputPath(root, filePath);
  if (relativePath) {
    writeText(root, relativePath, value);
    return;
  }
  if (isPatchPlanMode(root)) {
    throw new Error("publish_dove_global_status patch-plan requires outputDir to stay inside the target project.");
  }
  writeAbsoluteText(filePath, value);
}
function readPublicText(project, relativePath, fallback) {
  const fullPath = path14.join(project.root, relativePath);
  try {
    return fs13.existsSync(fullPath) ? fs13.readFileSync(fullPath, "utf8") : fallback;
  } catch {
    return fallback;
  }
}
function writeGlobalProjectArtifacts(root, outputDir, readResult) {
  const { project, snapshot, status, reason } = readResult;
  const projectDir = path14.join(outputDir, "projects", project.slug);
  const projectSnapshot = snapshot ?? {
    version: 1,
    mode: "dove-global-project-placeholder",
    status,
    title: publicString(project.title, 220) ?? project.slug,
    generatedAt: null,
    summary: publicString(reason, 220),
    links: projectLinks(project.slug),
    privacy: {
      sanitized: true,
      derivedOnly: true,
      absoluteRootsIncluded: false
    }
  };
  const markdown = snapshot ? readPublicText(project, ARTIFACT_PATHS.publicStatusMarkdown, projectPlaceholderMarkdown(project, status, reason)) : projectPlaceholderMarkdown(project, status, reason);
  const html = snapshot ? readPublicText(project, ARTIFACT_PATHS.publicStatusHtml, projectPlaceholderHtml(project, status, reason)) : projectPlaceholderHtml(project, status, reason);
  writeOutputJson(root, path14.join(projectDir, "status.json"), projectSnapshot);
  writeOutputText(root, path14.join(projectDir, "status.md"), markdown);
  writeOutputText(root, path14.join(projectDir, "index.html"), html);
  return [
    path14.join(projectDir, "status.json"),
    path14.join(projectDir, "status.md"),
    path14.join(projectDir, "index.html")
  ].map((filePath) => path14.relative(outputDir, filePath).split(path14.sep).join("/"));
}
function buildDoveGlobalPublicStatus(root, options = {}) {
  return buildGlobalStatusSnapshot(root, options);
}
function refreshGlobalProjectPublicStatus(project, options = {}) {
  try {
    if (!fs13.existsSync(project.root) || !fs13.statSync(project.root).isDirectory()) {
      return { status: "skipped", project, snapshot: null, reason: "project root is missing" };
    }
    publishDoveStatus(project.root, {
      includeArchived: Boolean(options.includeArchived),
      responseLanguage: options.responseLanguage,
      generatedAt: options.generatedAt
    });
    return null;
  } catch {
    return { status: "skipped", project, snapshot: null, reason: "project public status refresh failed" };
  }
}
function publishDoveGlobalStatus(root, options = {}) {
  assertGovernanceMutationRegistered("publish-dove-global-status", "exempt");
  if (options.refresh && isPatchPlanMode(root)) {
    throw new Error("publish_dove_global_status patch-plan does not support refresh; publish each project status with patch-plan before aggregating.");
  }
  const selection = resolveGlobalStatusSelection(root, options);
  const refreshResults = [];
  const readResults = selection.projects.map((project) => {
    const refreshFailure = options.refresh ? refreshGlobalProjectPublicStatus(project, options) : null;
    if (refreshFailure) {
      refreshResults.push({ slug: project.slug, title: publicString(project.title, 220), status: refreshFailure.status, reason: refreshFailure.reason });
      return refreshFailure;
    }
    if (options.refresh) {
      refreshResults.push({ slug: project.slug, title: publicString(project.title, 220), status: "refreshed" });
    }
    return readProjectPublicStatus(project);
  });
  const snapshot = buildGlobalStatusSnapshotFromReadResults(readResults, options.generatedAt ?? nowIso());
  const markdown = renderGlobalMarkdown(snapshot);
  const html = renderGlobalHtml(snapshot);
  const writes = [];
  writeOutputJson(root, path14.join(selection.outputDir, "status.json"), snapshot);
  writes.push("status.json");
  writeOutputText(root, path14.join(selection.outputDir, "status.md"), markdown);
  writes.push("status.md");
  writeOutputText(root, path14.join(selection.outputDir, "index.html"), html);
  writes.push("index.html");
  for (const readResult of readResults) {
    writes.push(...writeGlobalProjectArtifacts(root, selection.outputDir, readResult));
  }
  return {
    mode: "dove-global-public-status-publish",
    status: "published",
    generatedAt: snapshot.generatedAt,
    outputDir: selection.outputDir,
    projectCount: selection.projects.length,
    refresh: Boolean(options.refresh),
    refreshResults,
    writes,
    publicArtifacts: snapshot.publicArtifacts,
    snapshot,
    privacy: snapshot.privacy,
    noDaemon: true,
    noScheduler: true,
    noExternalProcess: true,
    cloudflareTunnelStarted: false
  };
}
function buildDovePublicStatus(root, options = {}) {
  ensureWorkspace(root);
  const status = queryDoveStatus(root, {
    includeArchived: Boolean(options.includeArchived),
    responseLanguage: options.responseLanguage,
    detail: "full"
  });
  const tasks = status.dashboard?.tasks ?? {};
  const project = status.dashboard?.project ?? {};
  const generatedAt = options.generatedAt ?? nowIso();
  return {
    version: PUBLIC_STATUS_VERSION,
    mode: "dove-public-status",
    generatedAt,
    responseLanguage: status.responseLanguage,
    project: {
      title: publicString(project.title ?? status.projectSummary?.title),
      objective: publicString(project.objective ?? status.projectSummary?.objective),
      currentFocus: publicString(project.currentFocus ?? status.projectSummary?.focus),
      nextAction: publicString(project.nextAction ?? status.suggestedNextCommand, 160),
      durableRoot: ARTIFACT_PATHS.doveRoot
    },
    requirements: {
      evidenceExpectations: publicStringArray(status.dashboard?.init?.evidenceExpectations),
      acceptanceSource: "durable-task-packets"
    },
    documents: publicDocuments(root),
    progress: {
      returnStatus: publicString(status.dashboard?.returnReadiness?.status, 80),
      counts: {
        total: Number(tasks.counts?.total ?? 0),
        active: Number(tasks.counts?.active ?? 0),
        blocked: Number(tasks.counts?.blocked ?? 0),
        completed: Number(tasks.counts?.completed ?? 0),
        killed: Number(tasks.counts?.killed ?? 0),
        archived: Number(tasks.counts?.archived ?? 0),
        archivedHidden: Number(tasks.counts?.archivedHidden ?? 0),
        byStatus: tasks.counts?.byStatus ?? {}
      },
      review: publicReview(status.dashboard?.review),
      lessons: {
        activeLessonCount: Number(status.dashboard?.lessons?.activeLessonCount ?? 0),
        mustObeyLessonCount: Number(status.dashboard?.lessons?.mustObeyLessonCount ?? 0),
        lessonsPath: publicString(status.dashboard?.lessons?.lessonsPath, 220)
      },
      versions: status.dashboard?.versions ?? {},
      experiments: status.dashboard?.experiments ?? {},
      runtime: publicRuntime(status)
    },
    tasks: {
      init: publicTask(status.dashboard?.init),
      active: publicTaskSection(tasks.active, PUBLIC_TASK_LIMIT),
      blocked: publicTaskSection(tasks.blocked, PUBLIC_TASK_LIMIT),
      recentCompleted: publicTaskSection(tasks.recentCompleted, PUBLIC_RECENT_LIMIT)
    },
    nextActions: (Array.isArray(status.dailyHome?.nextActions) ? status.dailyHome.nextActions : []).map(publicAction).filter(Boolean),
    sourceSummary: {
      ...countRuntimeEntries(root),
      primaryStateSources: [
        ARTIFACT_PATHS.state,
        ARTIFACT_PATHS.taskPacketsIndex,
        ARTIFACT_PATHS.runtimeResults,
        ARTIFACT_PATHS.runtimeEvents,
        ARTIFACT_PATHS.documentsLedger,
        ARTIFACT_PATHS.reviewState,
        ARTIFACT_PATHS.metaOperatorLessons
      ]
    },
    publicArtifacts: {
      json: ARTIFACT_PATHS.publicStatusJson,
      markdown: ARTIFACT_PATHS.publicStatusMarkdown,
      html: ARTIFACT_PATHS.publicStatusHtml
    },
    privacy: {
      sanitized: true,
      derivedOnly: true,
      rawDoveDumpIncluded: false,
      transcriptsIncluded: false,
      privateReasoningIncluded: false,
      environmentIncluded: false,
      runtimeEntriesIncluded: false,
      documentLedgerRawEntriesIncluded: false,
      documentBodiesIncluded: false,
      cloudflareTunnelStarted: false
    }
  };
}
function publishDoveStatus(root, options = {}) {
  assertGovernanceMutationRegistered("publish-dove-status", "exempt");
  const snapshot = buildDovePublicStatus(root, options);
  const markdown = renderMarkdown(snapshot);
  const html = renderHtml(snapshot);
  writeJson(root, ARTIFACT_PATHS.publicStatusJson, snapshot);
  writeText(root, ARTIFACT_PATHS.publicStatusMarkdown, markdown);
  writeText(root, ARTIFACT_PATHS.publicStatusHtml, html);
  return {
    mode: "dove-public-status-publish",
    status: "published",
    generatedAt: snapshot.generatedAt,
    writes: [ARTIFACT_PATHS.publicStatusJson, ARTIFACT_PATHS.publicStatusMarkdown, ARTIFACT_PATHS.publicStatusHtml],
    publicArtifacts: snapshot.publicArtifacts,
    snapshot,
    privacy: snapshot.privacy,
    noDaemon: true,
    noScheduler: true,
    noExternalProcess: true,
    cloudflareTunnelStarted: false
  };
}

// src/core/global-status-serving.mjs
import { spawn, spawnSync } from "node:child_process";
import crypto8 from "node:crypto";
import fs14 from "node:fs";
import http from "node:http";
import os2 from "node:os";
import path15 from "node:path";
var PUBLIC_FILES = /* @__PURE__ */ new Set(["index.html", "status.json", "status.md"]);
var PROJECT_PUBLIC_FILE_PATTERN = /^projects\/[^/]+\/(?:index\.html|status\.json|status\.md)$/;
var CONTENT_TYPES = /* @__PURE__ */ new Map([
  [".html", "text/html; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"]
]);
var AUTH_COOKIE_NAME = "dove_global_status_auth";
var AUTH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
var AUTH_LOGIN_PATH = "/__dove_global_status_login";
var LOGIN_BODY_LIMIT_BYTES = 4096;
function isPlainObject5(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function normalizeString5(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
function arrayValue2(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return value === void 0 || value === null ? [] : [value];
}
function normalizeBoolean3(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}
function isInside(childPath, parentPath) {
  const relative = path15.relative(parentPath, childPath);
  return relative === "" || !relative.startsWith("..") && !path15.isAbsolute(relative);
}
function normalizeServingAuthConfig(baseConfig = {}, options = {}) {
  return normalizeGlobalStatusAuthConfig({
    ...baseConfig,
    enabled: options.auth ?? options.enableAuth ?? baseConfig.enabled,
    username: options.authUser ?? options.authUsername ?? baseConfig.username,
    password: options.authPassword ?? options.password ?? baseConfig.password,
    passwordEnv: options.authPasswordEnv ?? options.passwordEnv ?? baseConfig.passwordEnv
  });
}
function publicAuthPlan(auth) {
  if (!auth.enabled) {
    return {
      enabled: false,
      scheme: "none",
      passwordConfigured: false,
      passwordEnv: null,
      passwordEnvConfigured: false
    };
  }
  return {
    enabled: true,
    scheme: "password",
    passwordConfigured: Boolean(auth.password),
    passwordEnv: auth.passwordEnv,
    passwordEnvConfigured: Boolean(auth.passwordEnv)
  };
}
function defaultTunnelName() {
  return "dove-global-status";
}
function defaultCloudflaredConfigPath(tunnelName) {
  return path15.join(os2.homedir(), ".cloudflared", `${tunnelName}.yml`);
}
function normalizeServingCloudflareConfig(baseConfig, options, outputDir) {
  const raw = {
    ...baseConfig,
    enabled: options.cloudflare ?? options.enableCloudflare ?? baseConfig.enabled,
    domain: options.domain ?? options.hostname ?? baseConfig.domain,
    tunnelName: options.tunnelName ?? baseConfig.tunnelName,
    cloudflaredPath: options.cloudflaredPath ?? baseConfig.cloudflaredPath,
    originHost: options.host ?? options.originHost ?? baseConfig.originHost,
    originPort: options.port ?? options.originPort ?? baseConfig.originPort,
    configPath: options.cloudflareConfigPath ?? options.configPath ?? baseConfig.configPath,
    credentialsFile: options.credentialsFile ?? baseConfig.credentialsFile,
    tokenEnv: options.tokenEnv ?? baseConfig.tokenEnv,
    dnsResolverAddrs: options.dnsResolverAddrs ?? baseConfig.dnsResolverAddrs
  };
  const normalized = normalizeGlobalStatusCloudflareConfig(raw, {}, outputDir);
  const enabled = normalizeBoolean3(raw.enabled, normalized.enabled);
  const domain = normalized.domain;
  const tunnelName = normalized.tunnelName ?? (domain ? defaultTunnelName(domain) : null);
  const configPath = normalized.configPath ?? (!normalized.tokenEnv && tunnelName ? defaultCloudflaredConfigPath(tunnelName) : null);
  return normalizeGlobalStatusCloudflareConfig({
    ...normalized,
    enabled,
    tunnelName,
    configPath
  }, {}, outputDir);
}
function safePublicPath(requestUrl) {
  const rawPath = String(requestUrl ?? "/").split("?")[0];
  try {
    if (decodeURIComponent(rawPath).split("/").includes("..")) {
      return null;
    }
  } catch {
    return null;
  }
  const url = new URL(requestUrl ?? "/", "http://127.0.0.1");
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (pathname === "/") {
    return "index.html";
  }
  if (pathname.endsWith("/")) {
    pathname = `${pathname}index.html`;
  }
  const relative = pathname.replace(/^\/+/, "");
  if (relative.split("/").includes("..")) {
    return null;
  }
  const normalized = path15.posix.normalize(relative);
  if (normalized.startsWith("../") || normalized === ".." || path15.posix.isAbsolute(normalized)) {
    return null;
  }
  if (PUBLIC_FILES.has(normalized) || PROJECT_PUBLIC_FILE_PATTERN.test(normalized)) {
    return normalized;
  }
  return null;
}
function sendText(response, statusCode, text3) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(text3);
}
function escapeHtml2(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function sendPasswordPage(response, options = {}) {
  const message = options.message ? `<p>${escapeHtml2(options.message)}</p>` : "";
  const returnTo = escapeHtml2(options.returnTo ?? "/");
  response.writeHead(options.statusCode ?? 200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dove global status</title>
<style>
body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f7f7f8;color:#111827}
main{width:min(28rem,calc(100vw - 2rem));padding:2rem;border:1px solid #e5e7eb;border-radius:1rem;background:white;box-shadow:0 1rem 3rem rgba(15,23,42,.08)}
label,input,button{display:block;width:100%;box-sizing:border-box}input,button{font:inherit;padding:.75rem;border-radius:.5rem}input{border:1px solid #d1d5db;margin:.5rem 0 1rem}button{border:0;background:#111827;color:white;cursor:pointer}p{color:#b91c1c}
</style>
</head>
<body>
<main>
<h1>Dove global status</h1>
${message}
<form method="post" action="${AUTH_LOGIN_PATH}">
<input type="hidden" name="returnTo" value="${returnTo}">
<label>\u5BC6\u7801<input name="password" type="password" autocomplete="current-password" autofocus required></label>
<button type="submit">\u8FDB\u5165</button>
</form>
</main>
</body>
</html>`);
}
function sendAuthRequired(response) {
  response.writeHead(401, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end("Authentication required");
}
function constantTimeEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual ?? ""));
  const expectedBuffer = Buffer.from(String(expected ?? ""));
  if (actualBuffer.length !== expectedBuffer.length) {
    crypto8.timingSafeEqual(Buffer.alloc(expectedBuffer.length), Buffer.alloc(expectedBuffer.length));
    return false;
  }
  return crypto8.timingSafeEqual(actualBuffer, expectedBuffer);
}
function parseCookies(value) {
  const cookies = /* @__PURE__ */ new Map();
  for (const part of String(value ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    cookies.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  return cookies;
}
function authCookieValue(authOptions) {
  return crypto8.createHmac("sha256", authOptions.sessionSecret).update(authOptions.password).digest("hex");
}
function parseBasicAuth(value) {
  const header = Array.isArray(value) ? value[0] : value;
  const match = /^Basic\s+(.+)$/i.exec(String(header ?? ""));
  if (!match) {
    return null;
  }
  let decoded;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return null;
  }
  const separator = decoded.indexOf(":");
  if (separator === -1) {
    return null;
  }
  return { password: decoded.slice(separator + 1) };
}
function isAuthorized(request, authOptions) {
  if (!authOptions.enabled) {
    return true;
  }
  const cookies = parseCookies(request.headers.cookie);
  if (constantTimeEqual(cookies.get(AUTH_COOKIE_NAME), authCookieValue(authOptions))) {
    return true;
  }
  const credentials = parseBasicAuth(request.headers.authorization);
  return credentials ? constantTimeEqual(credentials.password, authOptions.password) : false;
}
function readRequestBody(request, maxBytes = LOGIN_BODY_LIMIT_BYTES) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > maxBytes) {
        reject(new Error("request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}
function normalizeReturnPath(value) {
  const raw = normalizeString5(value) ?? "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || !safePublicPath(raw)) {
    return "/";
  }
  return raw;
}
async function handlePasswordLogin(request, response, authOptions) {
  if (request.method !== "POST") {
    sendText(response, 405, "Method not allowed");
    return;
  }
  let body;
  try {
    body = await readRequestBody(request);
  } catch {
    sendText(response, 413, "Request body too large");
    return;
  }
  const params = new URLSearchParams(body);
  const returnTo = normalizeReturnPath(params.get("returnTo"));
  if (!constantTimeEqual(params.get("password"), authOptions.password)) {
    sendPasswordPage(response, { statusCode: 403, returnTo, message: "\u5BC6\u7801\u4E0D\u6B63\u786E\u3002" });
    return;
  }
  response.writeHead(303, {
    "cache-control": "no-store",
    "set-cookie": `${AUTH_COOKIE_NAME}=${authCookieValue(authOptions)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE_SECONDS}`,
    location: returnTo
  });
  response.end();
}
function validateGlobalPublicServeRoot(outputDir) {
  const statusPath = path15.join(outputDir, "status.json");
  let snapshot;
  try {
    snapshot = JSON.parse(fs14.readFileSync(statusPath, "utf8"));
  } catch {
    throw new Error(`Dove global status serve root is missing a readable status.json: ${outputDir}`);
  }
  if (!isPlainObject5(snapshot) || snapshot.mode !== "dove-global-public-status" || snapshot.privacy?.sanitized !== true) {
    throw new Error(`Dove global status serve root is not a sanitized global public status directory: ${outputDir}`);
  }
  return snapshot;
}
function createStaticGlobalStatusServer(outputDir, authOptions = { enabled: false }) {
  const serveRoot = path15.resolve(outputDir);
  const effectiveAuthOptions = authOptions.enabled ? { ...authOptions, sessionSecret: authOptions.sessionSecret ?? crypto8.randomBytes(32).toString("hex") } : { enabled: false };
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (effectiveAuthOptions.enabled && url.pathname === AUTH_LOGIN_PATH) {
      void handlePasswordLogin(request, response, effectiveAuthOptions);
      return;
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      sendText(response, 405, "Method not allowed");
      return;
    }
    const relativePath = safePublicPath(request.url);
    if (!relativePath) {
      sendText(response, 404, "Not found");
      return;
    }
    if (!isAuthorized(request, effectiveAuthOptions)) {
      if (relativePath.endsWith("index.html")) {
        sendPasswordPage(response, { returnTo: normalizeReturnPath(`${url.pathname}${url.search}`) });
      } else {
        sendAuthRequired(response);
      }
      return;
    }
    const filePath = path15.join(serveRoot, relativePath);
    if (!isInside(filePath, serveRoot)) {
      sendText(response, 404, "Not found");
      return;
    }
    let stat;
    try {
      const linkStat = fs14.lstatSync(filePath);
      if (linkStat.isSymbolicLink()) {
        sendText(response, 404, "Not found");
        return;
      }
      stat = fs14.statSync(filePath);
    } catch {
      sendText(response, 404, "Not found");
      return;
    }
    if (!stat.isFile()) {
      sendText(response, 404, "Not found");
      return;
    }
    response.writeHead(200, {
      "content-type": CONTENT_TYPES.get(path15.extname(filePath)) ?? "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs14.createReadStream(filePath).pipe(response);
  });
}
function buildPublishOptions(options, outputDir) {
  return {
    projects: options.projects,
    projectRoots: [
      ...arrayValue2(options.projectRoots),
      ...arrayValue2(options.projectRoot)
    ],
    outputDir,
    refresh: Boolean(options.refresh),
    includeConfig: Boolean(options.includeConfig),
    includeArchived: Boolean(options.includeArchived),
    responseLanguage: options.responseLanguage,
    generatedAt: options.generatedAt
  };
}
function buildCloudflaredCommands(cloudflare) {
  if (!cloudflare.enabled) {
    return null;
  }
  if (!cloudflare.domain) {
    throw new Error("Dove global status Cloudflare serving requires a domain.");
  }
  if (!cloudflare.tunnelName) {
    throw new Error("Dove global status Cloudflare serving requires a tunnelName.");
  }
  const originUrl = `http://${cloudflare.originHost}:${cloudflare.originPort}`;
  const runArgs = cloudflare.tokenEnv ? ["tunnel", "run"] : cloudflare.configPath ? ["tunnel", "--config", cloudflare.configPath, "run", cloudflare.tunnelName] : ["tunnel", "--url", originUrl, "run", cloudflare.tunnelName];
  for (const address of cloudflare.dnsResolverAddrs ?? []) {
    runArgs.push("--dns-resolver-addrs", address);
  }
  return {
    info: { command: cloudflare.cloudflaredPath, args: ["tunnel", "info", cloudflare.tunnelName] },
    create: { command: cloudflare.cloudflaredPath, args: ["tunnel", "create", cloudflare.tunnelName] },
    routeDns: { command: cloudflare.cloudflaredPath, args: ["tunnel", "route", "dns", cloudflare.tunnelName, cloudflare.domain] },
    run: { command: cloudflare.cloudflaredPath, args: runArgs },
    tokenEnvName: cloudflare.tokenEnv ? "TUNNEL_TOKEN" : null
  };
}
function publicServingPlan(plan) {
  const cloudflare = plan.cloudflare.enabled ? {
    enabled: true,
    domain: plan.cloudflare.domain,
    tunnelName: plan.cloudflare.tunnelName,
    cloudflaredPath: plan.cloudflare.cloudflaredPath,
    originHost: plan.cloudflare.originHost,
    originPort: plan.cloudflare.originPort,
    configPath: plan.cloudflare.configPath,
    credentialsFile: plan.cloudflare.credentialsFile,
    credentialsFileConfigured: Boolean(plan.cloudflare.credentialsFile),
    tokenEnv: plan.cloudflare.tokenEnv,
    tokenEnvConfigured: Boolean(plan.cloudflare.tokenEnv),
    configureCloudflare: plan.cloudflare.configureCloudflare,
    commands: plan.cloudflare.commands
  } : {
    enabled: false,
    originHost: plan.cloudflare.originHost,
    originPort: plan.cloudflare.originPort
  };
  return {
    mode: "dove-global-status-serving-plan",
    outputDir: plan.outputDir,
    localUrl: plan.localUrl,
    publicUrl: plan.publicUrl,
    publish: plan.publish,
    auth: publicAuthPlan(plan.auth),
    dryRun: plan.dryRun,
    foreground: true,
    noDaemon: true,
    noScheduler: true,
    willStartHttpServer: !plan.dryRun,
    willStartExternalProcess: Boolean(plan.cloudflare.enabled && !plan.dryRun),
    cloudflareTunnelStarted: false,
    cloudflare
  };
}
function buildGlobalStatusServingPlanData(root, options = {}) {
  const env = options.env ?? process.env;
  const config = loadDoveConfig(root, env);
  const outputDir = resolveDoveGlobalStatusOutputDir(options.outputDir ?? config.globalStatus.outputDir, env);
  const auth = normalizeServingAuthConfig(config.globalStatus.auth, options);
  const cloudflare = normalizeServingCloudflareConfig(config.globalStatus.cloudflare, options, outputDir);
  const cloudflareEnabled = normalizeBoolean3(options.cloudflare ?? options.enableCloudflare, cloudflare.enabled);
  const effectiveCloudflare = normalizeServingCloudflareConfig({
    ...cloudflare,
    enabled: cloudflareEnabled
  }, {}, outputDir);
  const configureCloudflare = Boolean(options.configureCloudflare);
  const localUrl = `http://${effectiveCloudflare.originHost}:${effectiveCloudflare.originPort}`;
  const commands = buildCloudflaredCommands(effectiveCloudflare);
  const plan = {
    root,
    outputDir,
    dryRun: Boolean(options.dryRun),
    localUrl,
    publicUrl: effectiveCloudflare.enabled && effectiveCloudflare.domain ? `https://${effectiveCloudflare.domain}` : null,
    publish: buildPublishOptions(options, outputDir),
    auth,
    cloudflare: {
      ...effectiveCloudflare,
      configureCloudflare,
      commands
    }
  };
  return plan;
}
function buildGlobalStatusServingPlan(root, options = {}) {
  return publicServingPlan(buildGlobalStatusServingPlanData(root, options));
}
function cloudflaredConfigText(cloudflare, localUrl) {
  const lines = [
    `tunnel: ${cloudflare.tunnelName}`
  ];
  if (cloudflare.credentialsFile) {
    lines.push(`credentials-file: ${cloudflare.credentialsFile}`);
  }
  lines.push("ingress:");
  lines.push(`  - hostname: ${cloudflare.domain}`);
  lines.push(`    service: ${localUrl}`);
  lines.push("  - service: http_status:404");
  return `${lines.join("\n")}
`;
}
function writeCloudflaredConfig(plan) {
  const cloudflare = plan.cloudflare;
  if (!cloudflare.enabled || !cloudflare.configPath || cloudflare.tokenEnv) {
    return null;
  }
  fs14.mkdirSync(path15.dirname(cloudflare.configPath), { recursive: true });
  fs14.writeFileSync(cloudflare.configPath, cloudflaredConfigText(cloudflare, plan.localUrl), "utf8");
  return cloudflare.configPath;
}
function runSetupCommand(command, args, options = {}) {
  const result = options.spawnSyncImpl(command, args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    timeout: options.timeoutMs ?? 12e4,
    maxBuffer: 1024 * 1024
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}
function summarizeFailedCommand(label, result) {
  const stderr = normalizeString5(result.stderr);
  const stdout = normalizeString5(result.stdout);
  const details = stderr ?? stdout ?? `exit status ${result.status}`;
  return `${label} failed: ${details}`;
}
function configureCloudflareTunnel(plan, options = {}) {
  const logger = options.logger ?? console;
  if (!plan.cloudflare.enabled) {
    return [];
  }
  if (plan.cloudflare.tokenEnv) {
    if (plan.cloudflare.configureCloudflare) {
      throw new Error("Cloudflare tokenEnv serving cannot configure Cloudflare DNS; run without --configure-cloudflare or use cloudflared login credentials.");
    }
    return [];
  }
  const spawnSyncImpl = options.spawnSyncImpl ?? spawnSync;
  const commands = plan.cloudflare.commands;
  const completed = [];
  const info = runSetupCommand(commands.info.command, commands.info.args, { ...options, spawnSyncImpl });
  completed.push("info");
  if (info.status !== 0) {
    if (!plan.cloudflare.configureCloudflare) {
      throw new Error(`Cloudflare tunnel ${plan.cloudflare.tunnelName} is not available; rerun with --configure-cloudflare after logging in with cloudflared.`);
    }
    const created = runSetupCommand(commands.create.command, commands.create.args, { ...options, spawnSyncImpl });
    if (created.status !== 0) {
      throw new Error(summarizeFailedCommand("cloudflared tunnel create", created));
    }
    completed.push("create");
  }
  if (plan.cloudflare.configureCloudflare) {
    const routed = runSetupCommand(commands.routeDns.command, commands.routeDns.args, { ...options, spawnSyncImpl });
    if (routed.status !== 0) {
      throw new Error(summarizeFailedCommand("cloudflared tunnel route dns", routed));
    }
    completed.push("route-dns");
  }
  const configPath = writeCloudflaredConfig(plan);
  if (configPath) {
    logger.error?.(`Wrote Cloudflare tunnel config: ${configPath}`);
    completed.push("write-config");
  }
  return completed;
}
function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}
function closeServer(server) {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}
function resolveServingAuth(auth, env) {
  if (!auth.enabled) {
    return { enabled: false };
  }
  const inlinePassword = normalizeString5(auth.password);
  if (inlinePassword) {
    return {
      enabled: true,
      password: inlinePassword
    };
  }
  if (!auth.passwordEnv) {
    throw new Error("Dove global status auth requires password or passwordEnv when enabled.");
  }
  const password = env[auth.passwordEnv];
  if (!password) {
    throw new Error(`Dove global status auth password environment variable is not set: ${auth.passwordEnv}`);
  }
  return {
    enabled: true,
    password
  };
}
function cloudflareChildEnv(plan, env) {
  const childEnv = { ...env };
  if (plan.auth.enabled && plan.auth.passwordEnv) {
    delete childEnv[plan.auth.passwordEnv];
  }
  if (!plan.cloudflare.enabled || !plan.cloudflare.tokenEnv) {
    return childEnv;
  }
  const tokenEnv = plan.cloudflare.tokenEnv;
  const token = env[tokenEnv];
  if (!token) {
    throw new Error(`Cloudflare tunnel token environment variable is not set: ${tokenEnv}`);
  }
  delete childEnv[tokenEnv];
  childEnv.TUNNEL_TOKEN = token;
  return childEnv;
}
async function runGlobalStatusServingForeground(root, options = {}) {
  assertGovernanceMutationRegistered("serve-dove-global-status", "exempt");
  const privatePlan = buildGlobalStatusServingPlanData(root, options);
  const plan = publicServingPlan(privatePlan);
  if (plan.dryRun) {
    return plan;
  }
  const logger = options.logger ?? console;
  const env = options.env ?? process.env;
  const authOptions = resolveServingAuth(privatePlan.auth, env);
  const publish = publishDoveGlobalStatus(root, privatePlan.publish);
  validateGlobalPublicServeRoot(privatePlan.outputDir);
  const server = createStaticGlobalStatusServer(privatePlan.outputDir, authOptions);
  await listen(server, privatePlan.cloudflare.originHost, privatePlan.cloudflare.originPort);
  let child = null;
  let configured = [];
  try {
    if (privatePlan.cloudflare.enabled) {
      configured = configureCloudflareTunnel(privatePlan, {
        spawnSyncImpl: options.spawnSyncImpl ?? spawnSync,
        logger
      });
      child = (options.spawnImpl ?? spawn)(privatePlan.cloudflare.commands.run.command, privatePlan.cloudflare.commands.run.args, {
        cwd: options.cwd ?? process.cwd(),
        env: cloudflareChildEnv(privatePlan, env),
        stdio: "inherit",
        detached: false
      });
    }
  } catch (error) {
    await closeServer(server);
    throw error;
  }
  logger.error?.(`Dove global status local URL: ${plan.localUrl}`);
  if (plan.publicUrl) {
    logger.error?.(`Dove global status public URL: ${plan.publicUrl}`);
  }
  return await new Promise((resolve, reject) => {
    let closed = false;
    const finish = async (status, detail = {}) => {
      if (closed) {
        return;
      }
      closed = true;
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      if (child && !child.killed) {
        child.kill("SIGTERM");
      }
      await closeServer(server);
      resolve({
        mode: "dove-global-status-serving",
        status,
        outputDir: plan.outputDir,
        localUrl: plan.localUrl,
        publicUrl: plan.publicUrl,
        publish,
        auth: plan.auth,
        configured,
        noDaemon: true,
        noScheduler: true,
        foreground: true,
        noExternalProcess: !plan.cloudflare.enabled,
        cloudflareTunnelStarted: Boolean(plan.cloudflare.enabled),
        ...detail
      });
    };
    const onSignal = () => {
      void finish("stopped", { signal: "operator-stop" });
    };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
    if (child) {
      child.once("error", async (error) => {
        if (!closed) {
          process.off("SIGINT", onSignal);
          process.off("SIGTERM", onSignal);
          await closeServer(server);
          reject(error);
        }
      });
      child.once("exit", (code, signal) => {
        void finish(code === 0 ? "stopped" : "cloudflared-exited", { cloudflaredExitCode: code, cloudflaredSignal: signal });
      });
    }
  });
}

// src/core/documents.mjs
import fs15 from "node:fs";
import path16 from "node:path";
function normalizeString6(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function normalizeAllowed2(value, allowed, fallback) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return allowed.includes(normalized) ? normalized : fallback;
}
function filteredEntries(entries, filters) {
  return entries.filter((entry) => {
    if (filters.packetId && entry.packetId !== filters.packetId) return false;
    if (filters.documentKind && entry.documentKind !== filters.documentKind) return false;
    if (filters.status && entry.status !== filters.status) return false;
    if (filters.evidenceScope && entry.evidenceScope !== filters.evidenceScope) return false;
    if (typeof filters.publicSafe === "boolean" && entry.publicSafe !== filters.publicSafe) return false;
    return true;
  });
}
function queryDocumentLedger(root, args = {}) {
  const ledger = normalizeDocumentLedgerIndex(readJson(root, ARTIFACT_PATHS.documentsLedger, createDocumentLedgerIndex));
  const filters = {
    packetId: normalizeString6(args.packetId ?? args.taskPacketId ?? args.missionPacketId ?? args.taskId, null),
    documentKind: args.documentKind ? normalizeAllowed2(args.documentKind, DOVE_DOCUMENT_KINDS, null) : null,
    status: args.status ? normalizeAllowed2(args.status, DOVE_DOCUMENT_STATUSES, null) : null,
    evidenceScope: args.evidenceScope ? normalizeAllowed2(args.evidenceScope, DOVE_DOCUMENT_EVIDENCE_SCOPES, null) : null,
    publicSafe: typeof args.publicSafe === "boolean" ? args.publicSafe : null
  };
  const limit = Number.isFinite(Number(args.limit)) ? Math.max(1, Math.min(100, Math.floor(Number(args.limit)))) : 25;
  const entries = filteredEntries(ledger.entries, filters).slice(-limit);
  return {
    mode: "document-ledger-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    filters,
    summary: ledger.summary,
    entries,
    privacy: {
      documentBodiesIncluded: false,
      rawTranscriptIncluded: false,
      privateReasoningIncluded: false,
      environmentIncluded: false
    }
  };
}

// src/core/operational-outcome.mjs
var PROPOSAL_STATUSES = /* @__PURE__ */ new Set([
  "needs-confirmation",
  "needs-task-selection"
]);
var CONFIRMED_EXECUTION_FAILURE_STATUSES = /* @__PURE__ */ new Set([
  "awaiting-host-pass",
  "awaiting-host-results",
  "needs-host-results"
]);
var OPERATIONAL_FAILURE_STATUSES = /* @__PURE__ */ new Set([
  "auto-read-only-step-no-progress",
  "blocked",
  "blocked-boundary",
  "blocked-missing-materials",
  "failed",
  "materialization-failed",
  "missing-required-materials",
  "missing-secret-env",
  "needs-completion-evidence",
  "needs-explicit-progress-step",
  "needs-source-verification",
  "no-op",
  "noop",
  "provider-failed",
  "qa-needs-attention",
  "source-provenance-unverified",
  "step-no-progress",
  "unexpected-step-status",
  "verification-failed",
  "workflow-error-boundary"
]);
function normalizeStatus(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
function isProposalOnlyOutcome(result) {
  if (!result || typeof result !== "object") {
    return false;
  }
  const status = normalizeStatus(result.status ?? result.outcome);
  return result.proposalOnly === true || PROPOSAL_STATUSES.has(status);
}
function isOperationalFailureOutcome(result, { confirmed = false } = {}) {
  if (!result || typeof result !== "object") {
    return false;
  }
  if (!confirmed && isProposalOnlyOutcome(result)) {
    return false;
  }
  const status = normalizeStatus(result.status ?? result.outcome);
  return OPERATIONAL_FAILURE_STATUSES.has(status) || confirmed && CONFIRMED_EXECUTION_FAILURE_STATUSES.has(status);
}

// src/core/workflow-goals.mjs
import fs16 from "node:fs";
import path17 from "node:path";
var WORKFLOW_GOAL_CONTRACTS = [
  {
    id: "operator-host-pass-without-results",
    surface: "dove.operator",
    objective: "A confirmed foreground operator pass must not claim execution progress for host-pass-required work unless a safe internal step or an explicit host result exists.",
    pressureTest: "Seed a ready source task that requires host provenance, preview the operator queue, then confirm run_dove_operator without taskResults.",
    acceptanceCriteria: [
      "Preview classifies the task as host-pass-required and does not report auto-runnable work.",
      "Confirmed execution without taskResults returns needs-host-results.",
      "No task is reported as updated and the result card does not expose affected packet ids.",
      "The task remains ready and has no synthetic boundary.",
      "No runtime result entry is persisted for the run.",
      "The response returns material-specific required actions for the host pass."
    ],
    failureMode: "fake-foreground-progress-without-evidence",
    failureReflection: {
      lessonCaptureRequired: true,
      lessonCommand: "project:dove.lessons",
      remediationRequired: true,
      operatorFollowThroughRequired: true,
      regressionArtifacts: [
        "scripts/validate-workflow-goals.mjs",
        "tests/integration/workflow-goals.test.mjs",
        "tests/integration/mcp-tools.test.mjs"
      ],
      remediationTargets: [
        "src/core/task-workflow.mjs",
        "src/core/workflow-goals.mjs",
        "src/core/command-manifest.mjs"
      ],
      summary: "If this goal fails, close the fix only after adding or updating an explicit lesson/remediation note and keeping this scenario in the workflow-goals gate."
    }
  },
  {
    id: "mission-contract-materializes-without-execution",
    surface: "dove.mission",
    objective: "A Dove mission must materialize only an exact approved task contract, reject bare or stale confirmation, and avoid recording pass/runtime execution results.",
    pressureTest: "Replay one create_dove_task proposal's exact confirmArgs, then use a separate proposal to reject bare confirmation and stale pass/result fields without materialization.",
    acceptanceCriteria: [
      "The proposal returns mission-contract and contract-handoff semantics with no writes.",
      "Bare confirmed:true without the proposal digest is rejected without materialization.",
      "A stale confirmation that changes the approved contract is rejected without materialization.",
      "Replaying the exact confirmArgs returns materialized with contractMaterialized true.",
      "The task remains ready, no runtime result is persisted, and no mission pass recorder fields are returned."
    ],
    failureMode: "mission-confirmation-substitution-or-fake-execution",
    failureReflection: workflowFailureReflection({
      regressionArtifacts: ["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs", "tests/integration/mcp-tools.test.mjs"],
      remediationTargets: ["src/core/task-workflow.mjs", "src/core/workflow-goals.mjs", "src/core/command-manifest.mjs"],
      summary: "If mission confirmation accepts a bare or stale contract, or materialization records runtime results, repair create_dove_task so only exact proposal replay reaches contract handoff."
    })
  },
  {
    id: "mission-completion-requires-evidence",
    surface: "dove.result-recording",
    objective: "An explicit Dove result recording pass must not mark a task completed from a bare completion flag or summary without explicit evidence, artifacts, validation output, or concrete plan-output missions.",
    pressureTest: "Seed a ready mission task, then call record_dove_mission_pass with resultStatus completed and a summary but no evidence or artifacts.",
    acceptanceCriteria: [
      "The mission pass returns needs-completion-evidence and remains proposal-only.",
      "The task remains ready instead of completed.",
      "No runtime result entry is persisted for the rejected completion.",
      "The response names the missing evidence/artifact action."
    ],
    failureMode: "fake-mission-completion-without-evidence",
    failureReflection: {
      lessonCaptureRequired: true,
      lessonCommand: "project:dove.lessons",
      remediationRequired: true,
      operatorFollowThroughRequired: true,
      regressionArtifacts: [
        "scripts/validate-workflow-goals.mjs",
        "tests/integration/workflow-goals.test.mjs",
        "tests/integration/mcp-tools.test.mjs"
      ],
      remediationTargets: [
        "src/core/task-workflow.mjs",
        "src/core/workflow-goals.mjs",
        "src/core/result-cards.mjs"
      ],
      summary: "If mission completion can succeed without evidence, repair the mission pass contract and keep this pressure scenario executable."
    }
  },
  {
    id: "auto-read-only-step-cannot-complete",
    surface: "dove.auto",
    objective: "A confirmed Dove auto run must not treat read-only status or lesson queries as durable task progress or completion.",
    pressureTest: "Seed a ready task and confirm run_dove_auto with a single dove.status step marked completeTask.",
    acceptanceCriteria: [
      "The auto run returns needs-explicit-progress-step.",
      "No auto iteration is recorded or persisted as completed work.",
      "The task remains ready instead of in-progress, blocked, or completed.",
      "The response requires an explicit write/generation/review step."
    ],
    failureMode: "read-only-auto-step-fake-completion",
    failureReflection: {
      lessonCaptureRequired: true,
      lessonCommand: "project:dove.lessons",
      remediationRequired: true,
      operatorFollowThroughRequired: true,
      regressionArtifacts: [
        "scripts/validate-workflow-goals.mjs",
        "tests/integration/workflow-goals.test.mjs",
        "tests/integration/mcp-tools.test.mjs"
      ],
      remediationTargets: [
        "src/core/task-workflow.mjs",
        "src/core/workflow-goals.mjs",
        "src/core/result-cards.mjs"
      ],
      summary: "If read-only auto steps can complete tasks, repair auto step classification and keep this pressure scenario executable."
    }
  },
  {
    id: "experience-blocked-audit-not-bridged",
    surface: "dove.experience",
    objective: "An experience result with blocked audit integrity must not be reported as a bridged claim update.",
    pressureTest: "Seed a task and call run_experience_workflow with an incomplete result that lacks required evidence and methodology.",
    acceptanceCriteria: [
      "The workflow returns needs-review rather than bridged.",
      "The audit verdict is blocked and integrity flags are visible.",
      "Any bridge entry is held rather than applied.",
      "No claim state is upgraded from blocked audit evidence."
    ],
    failureMode: "blocked-experiment-audit-reported-as-bridged",
    failureReflection: {
      lessonCaptureRequired: true,
      lessonCommand: "project:dove.lessons",
      remediationRequired: true,
      operatorFollowThroughRequired: true,
      regressionArtifacts: [
        "scripts/validate-workflow-goals.mjs",
        "tests/integration/workflow-goals.test.mjs",
        "tests/integration/evidence-integrity.test.mjs"
      ],
      remediationTargets: [
        "src/core/experience-workflow.mjs",
        "src/core/workflow-goals.mjs",
        "src/core/result-cards.mjs"
      ],
      summary: "If blocked experiment audits are presented as bridged results, repair the audit-to-claim bridge and keep this pressure scenario executable."
    }
  },
  {
    id: "plan-completion-requires-executable-children",
    surface: "dove.result-recording",
    objective: "A completed planning result must not complete unless it returns explicit executable child missions with contracts.",
    pressureTest: "Seed a plan-stage task, then record an explicit completed result with summary and criteria evidence but no child mission output.",
    acceptanceCriteria: [
      "The mission pass returns plan-output-not-executable and remains proposal-only.",
      "The plan task remains ready instead of completed.",
      "No runtime result entry is persisted for the rejected plan pass.",
      "The response requires explicit executable child missions."
    ],
    failureMode: "plan-pass-completed-without-executable-child-work",
    failureReflection: workflowFailureReflection({
      regressionArtifacts: ["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs", "tests/integration/mcp-tools.test.mjs"],
      remediationTargets: ["src/core/task-workflow.mjs", "src/core/workflow-goals.mjs", "src/core/command-manifest.mjs"],
      summary: "If a plan pass can complete without explicit executable child contracts, repair plan-output gating and keep this pressure scenario executable."
    })
  },
  {
    id: "plan-child-contract-requires-criteria",
    surface: "dove.result-recording",
    objective: "A plan-derived child mission must not be materialized from an explicit result child contract that lacks convergence criteria.",
    pressureTest: "Seed a plan-stage task, then record an explicit completed result with one child mission whose executionContract omits convergence.criteria.",
    acceptanceCriteria: [
      "The mission pass returns plan-output-not-executable.",
      "The response identifies the child mission as not executable.",
      "The response names convergence.criteria as missing.",
      "No child task is created from the invalid plan output."
    ],
    failureMode: "plan-child-materialized-without-convergence-criteria",
    failureReflection: workflowFailureReflection({
      regressionArtifacts: ["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs", "tests/integration/mcp-tools.test.mjs"],
      remediationTargets: ["src/core/task-workflow.mjs", "src/core/workflow-goals.mjs"],
      summary: "If a plan child can materialize without convergence criteria, repair child executionContract readiness checks and keep this scenario executable."
    })
  },
  {
    id: "status-adjust-completion-requires-criteria",
    surface: "dove.status",
    objective: "A status adjustment must not mark a task complete unless verifiedCriteria covers the execution contract criteria.",
    pressureTest: "Seed a ready task with an executable contract, then apply a confirmed completed status adjustment with summary and evidence but no verifiedCriteria coverage.",
    acceptanceCriteria: [
      "The status adjustment returns rejected.",
      "The rejection contains a verification-failed completion block.",
      "The task remains ready instead of completed.",
      "The response requires verified criteria coverage."
    ],
    failureMode: "status-adjustment-fake-completion-without-criteria",
    failureReflection: workflowFailureReflection({
      regressionArtifacts: ["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs", "tests/integration/dove-query.test.mjs"],
      remediationTargets: ["src/core/task-workflow.mjs", "src/core/dove.mjs", "src/core/workflow-goals.mjs"],
      summary: "If status adjustment can complete without verified criteria, repair the shared completion gate and keep this pressure scenario executable."
    })
  },
  {
    id: "operator-host-result-requires-criteria",
    surface: "dove.operator",
    objective: "A host pass result supplied to the operator must not complete a task without convergence criteria coverage.",
    pressureTest: "Seed a host-pass-required task, then confirm run_dove_operator with a completed taskResult that has evidence but no verifiedCriteria.",
    acceptanceCriteria: [
      "The operator records a verification-failed iteration.",
      "The task becomes blocked with a verification-failed boundary instead of completed.",
      "The operator result is recorded only as a boundary-producing pass.",
      "The response requires verified criteria coverage."
    ],
    failureMode: "operator-host-result-fake-completion-without-criteria",
    failureReflection: workflowFailureReflection({
      regressionArtifacts: ["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs", "tests/integration/mcp-tools.test.mjs"],
      remediationTargets: ["src/core/task-workflow.mjs", "src/core/workflow-goals.mjs"],
      summary: "If operator host results can complete without criteria coverage, repair host-result completion verification and keep this pressure scenario executable."
    })
  },
  {
    id: "auto-completion-requires-criteria",
    surface: "dove.auto",
    objective: "A Dove auto step that produces artifacts must still route to verification failure when verifiedCriteria does not cover the task contract.",
    pressureTest: "Seed a ready task with an executable contract, then run a concrete auto note step marked completeTask without verifiedCriteria.",
    acceptanceCriteria: [
      "The auto run returns verification-failed.",
      "The task becomes blocked rather than completed.",
      "The boundary type is verification-failed.",
      "The response requires verified criteria coverage."
    ],
    failureMode: "auto-artifact-step-fake-completion-without-criteria",
    failureReflection: workflowFailureReflection({
      regressionArtifacts: ["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs", "tests/unit/phase6-hardening.test.mjs"],
      remediationTargets: ["src/core/task-workflow.mjs", "src/core/workflow-goals.mjs"],
      summary: "If auto artifacts can complete tasks without criteria coverage, repair auto completion verification and keep this scenario executable."
    })
  },
  {
    id: "status-routes-missing-execution-contract",
    surface: "dove.status",
    objective: "Status must route an active task without an executable contract to a visible Planner next action instead of treating the task as ordinary mission display.",
    pressureTest: "Seed a ready task, remove its executionContract from durable packet state, then query full Dove status.",
    acceptanceCriteria: [
      "Status returns blocked because executionGaps has a missingContract count.",
      "The first ranked recovery action wraps missing-executable-contract as recoveryPrimaryKind.",
      "The next action points to the Planner/mission surface.",
      "preActionGuidance reports planner as the execution next role."
    ],
    failureMode: "status-hides-missing-executable-contract",
    failureReflection: workflowFailureReflection({
      regressionArtifacts: ["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs", "tests/integration/dove-query.test.mjs"],
      remediationTargets: ["src/core/dove.mjs", "src/core/pre-action-guidance.mjs", "src/core/workflow-goals.mjs"],
      summary: "If status does not rank missing executable contracts as Planner work, repair status routing and keep this pressure scenario executable."
    })
  },
  {
    id: "public-surfaces-stay-flat",
    surface: "dove.status",
    objective: "Dove must not expose public role or mission-board slash surfaces when improving workflow orchestration.",
    pressureTest: "Inspect the public command manifest and assert that planner, builder, reviewer, missions, board, and list surfaces are absent.",
    acceptanceCriteria: [
      "The command manifest contains no dove.planner surface.",
      "The command manifest contains no dove.builder or dove.reviewer surface.",
      "The command manifest contains no dove.missions, dove.board, or dove.list surface.",
      "The existing flat Dove surfaces remain present."
    ],
    failureMode: "public-slash-surface-sprawl",
    failureReflection: workflowFailureReflection({
      regressionArtifacts: ["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs", "tests/integration/mcp-tools.test.mjs"],
      remediationTargets: ["src/core/command-manifest.mjs", "src/core/workflow-goals.mjs"],
      summary: "If role or mission-board slash surfaces appear, remove the public surface sprawl and keep this pressure scenario executable."
    })
  }
];
var CONTRACT_BY_ID = new Map(WORKFLOW_GOAL_CONTRACTS.map((contract) => [contract.id, contract]));
function workflowFailureReflection({ regressionArtifacts, remediationTargets, summary }) {
  return {
    lessonCaptureRequired: true,
    lessonCommand: "project:dove.lessons",
    remediationRequired: true,
    operatorFollowThroughRequired: true,
    regressionArtifacts,
    remediationTargets,
    summary
  };
}
var WORKFLOW_GOAL_CRITERION = "workflow goal convergence criterion";
var WORKFLOW_GOAL_VERIFICATION_PATH = ".dove/evidence/workflow-goal-verification.log";
var WORKFLOW_GOAL_ARTIFACT_PATH = ".dove/evidence/workflow-goal-result.md";
function workflowExecutionContract(overrides = {}) {
  const base = {
    chainType: "engineering-host-pass-verify",
    roleSequence: ["builder", "reviewer"],
    readFirst: [],
    action: "project:dove.auto",
    implementation: ["Produce the workflow goal artifact."],
    files: [],
    materials: {
      requiredInputs: [],
      requiredArtifacts: [],
      sourceRefs: [],
      artifactRefs: []
    },
    convergence: {
      criteria: [WORKFLOW_GOAL_CRITERION],
      verificationCommands: ["node --test tests/integration/workflow-goals.test.mjs"],
      evidenceRequired: [WORKFLOW_GOAL_ARTIFACT_PATH, WORKFLOW_GOAL_VERIFICATION_PATH],
      definitionOfDone: "The workflow goal criterion is covered by explicit verification evidence."
    },
    failureRoutes: [
      { on: "missing-required-materials", boundaryType: "missing-required-materials", nextAction: "project:dove.status", requiredActions: ["provide-required-materials"] },
      { on: "verification-failed", boundaryType: "verification-failed", nextAction: "project:dove.status", requiredActions: ["provide-verified-criteria"] }
    ]
  };
  return {
    ...base,
    ...overrides,
    roleSequence: overrides.roleSequence ?? base.roleSequence,
    readFirst: overrides.readFirst ?? base.readFirst,
    implementation: overrides.implementation ?? base.implementation,
    files: overrides.files ?? base.files,
    materials: {
      ...base.materials,
      ...overrides.materials ?? {}
    },
    convergence: {
      ...base.convergence,
      ...overrides.convergence ?? {}
    },
    failureRoutes: overrides.failureRoutes ?? base.failureRoutes
  };
}
function workflowVerifiedCriteria(criterion = WORKFLOW_GOAL_CRITERION) {
  return [{ criterion, status: "verified", evidencePaths: [WORKFLOW_GOAL_VERIFICATION_PATH] }];
}
function writeJson2(root, relativePath, value) {
  fs16.writeFileSync(path17.join(root, relativePath), `${JSON.stringify(value, null, 2)}
`);
}
function writeWorkflowGoalEvidenceFile(root, relativePath, text3) {
  const fullPath = path17.join(root, relativePath);
  fs16.mkdirSync(path17.dirname(fullPath), { recursive: true });
  fs16.writeFileSync(fullPath, text3, "utf8");
  return relativePath;
}
function seedWorkflowGoalEvidence(root) {
  writeWorkflowGoalEvidenceFile(root, WORKFLOW_GOAL_VERIFICATION_PATH, "Workflow goal verification passed.\n");
  writeWorkflowGoalEvidenceFile(root, WORKFLOW_GOAL_ARTIFACT_PATH, "# Workflow goal artifact\n\nSubstantive workflow goal evidence.\n");
}
function patchGoalTask(root, packetId, patch = {}) {
  const packetPath = `${ARTIFACT_PATHS.taskPacketsDir}/packets/${packetId}.json`;
  const packet = readJson2(root, packetPath);
  const nextPacket = { ...packet, ...patch };
  for (const key of Object.keys(patch)) {
    if (patch[key] === void 0) {
      delete nextPacket[key];
    }
  }
  writeJson2(root, packetPath, nextPacket);
  const index = readJson2(root, ARTIFACT_PATHS.taskPacketsIndex);
  const nextItems = (index.items ?? []).map((item) => {
    if (item.id !== packetId) {
      return item;
    }
    const nextItem = { ...item, ...patch };
    for (const key of Object.keys(patch)) {
      if (patch[key] === void 0) {
        delete nextItem[key];
      }
    }
    return nextItem;
  });
  writeJson2(root, ARTIFACT_PATHS.taskPacketsIndex, { ...index, items: nextItems });
  return nextPacket;
}
var WorkflowGoalValidationError = class extends Error {
  constructor(failures) {
    const details = failures.map((failure) => {
      const reflection = failure.failureReflection ?? {};
      const remediation = [
        reflection.summary,
        reflection.lessonCaptureRequired ? `Record/update lesson with ${reflection.lessonCommand}.` : null,
        reflection.operatorFollowThroughRequired ? "Record operator follow-through for the failed goal before closing." : null,
        reflection.regressionArtifacts?.length ? `Regression artifacts: ${reflection.regressionArtifacts.join(", ")}` : null
      ].filter(Boolean).join(" ");
      return `- ${failure.id}: ${failure.message}${remediation ? ` ${remediation}` : ""}`;
    }).join("\n");
    super(`Workflow goal validation failed:
${details}`);
    this.name = "WorkflowGoalValidationError";
    this.failures = failures;
  }
};
function normalizeArray2(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
}
function assertContract(condition, contract, message) {
  if (!condition) {
    throw new Error(`Workflow goal contract ${contract.id ?? "<missing-id>"} is invalid: ${message}`);
  }
}
function validateWorkflowGoalContracts(contracts = WORKFLOW_GOAL_CONTRACTS) {
  const seen = /* @__PURE__ */ new Set();
  for (const contract of contracts) {
    assertContract(contract && typeof contract === "object" && !Array.isArray(contract), { id: "<unknown>" }, "contract must be an object");
    assertContract(typeof contract.id === "string" && contract.id.trim(), contract, "id is required");
    assertContract(!seen.has(contract.id), contract, "id must be unique");
    seen.add(contract.id);
    assertContract(typeof contract.surface === "string" && contract.surface.startsWith("dove."), contract, "surface must name a Dove workflow surface or internal result-recording surface");
    assertContract(typeof contract.objective === "string" && contract.objective.trim(), contract, "objective is required");
    assertContract(typeof contract.pressureTest === "string" && contract.pressureTest.trim(), contract, "pressureTest is required");
    assertContract(normalizeArray2(contract.acceptanceCriteria).length >= 3, contract, "at least three acceptance criteria are required");
    assertContract(typeof contract.failureMode === "string" && contract.failureMode.trim(), contract, "failureMode is required");
    const reflection = contract.failureReflection;
    assertContract(reflection && typeof reflection === "object" && !Array.isArray(reflection), contract, "failureReflection is required");
    assertContract(reflection.lessonCaptureRequired === true, contract, "failureReflection.lessonCaptureRequired must be true");
    assertContract(reflection.lessonCommand === "project:dove.lessons", contract, "failureReflection.lessonCommand must be project:dove.lessons");
    assertContract(reflection.remediationRequired === true, contract, "failureReflection.remediationRequired must be true");
    assertContract(reflection.operatorFollowThroughRequired === true, contract, "failureReflection.operatorFollowThroughRequired must be true");
    assertContract(normalizeArray2(reflection.regressionArtifacts).length > 0, contract, "failureReflection.regressionArtifacts must name regression gates");
    assertContract(normalizeArray2(reflection.remediationTargets).length > 0, contract, "failureReflection.remediationTargets must name likely repair targets");
    assertContract(typeof reflection.summary === "string" && reflection.summary.trim(), contract, "failureReflection.summary is required");
  }
  return {
    status: "passed",
    contractCount: contracts.length,
    contractIds: contracts.map((contract) => contract.id)
  };
}
function parseToolJson(result, action) {
  const text3 = result?.content?.[0]?.text;
  if (!text3) {
    throw new Error(`${action} returned no text content.`);
  }
  if (result.isError === true) {
    throw new Error(`${action} failed: ${text3}`);
  }
  try {
    const parsed = JSON.parse(text3);
    if (parsed?.presentation === "dove-mcp-result-contract" && parsed.fullResult) {
      return parsed.confirmation ? { ...parsed.fullResult, confirmation: parsed.confirmation } : parsed.fullResult;
    }
    return parsed;
  } catch (error) {
    throw new Error(`${action} returned invalid JSON: ${error.message}`);
  }
}
function expectToolError(result, action, pattern) {
  const text3 = result?.content?.[0]?.text ?? "";
  expect(result?.isError === true, `${action} must be rejected`, { result });
  expect(pattern.test(text3), `${action} must explain the confirmation rejection`, { text: text3 });
  return text3;
}
function exactMissionConfirmArgs(proposal, action = "create_dove_task") {
  const confirmArgs = proposal.confirmation?.confirmArgs;
  expect(confirmArgs && typeof confirmArgs === "object" && !Array.isArray(confirmArgs), `${action} proposal must expose exact confirmArgs in the MCP confirmation capsule`, { confirmation: proposal.confirmation });
  expect(/^[0-9a-f]{64}$/u.test(confirmArgs.proposalDigest ?? ""), `${action} confirmArgs must include the proposal digest`, { proposalDigest: confirmArgs.proposalDigest });
  return structuredClone(confirmArgs);
}
function exactAutoConfirmArgs(proposal, action = "run_dove_auto") {
  const confirmArgs = proposal.confirmation?.confirmArgs ?? proposal.confirmArgs;
  expect(confirmArgs && typeof confirmArgs === "object" && !Array.isArray(confirmArgs), `${action} proposal must expose exact confirmArgs`, { confirmation: proposal.confirmation, confirmArgs: proposal.confirmArgs });
  expect(/^[0-9a-f]{64}$/u.test(confirmArgs.proposalDigest ?? ""), `${action} confirmArgs must include the proposal digest`, { proposalDigest: confirmArgs.proposalDigest });
  return structuredClone(confirmArgs);
}
function parseOperationalToolJson(result, action) {
  const text3 = result?.content?.[0]?.text;
  if (!text3) {
    throw new Error(`${action} returned no text content.`);
  }
  expect(
    result?.isError === true,
    `${action} must preserve operational failure transport semantics`,
    { isError: result?.isError }
  );
  try {
    const parsed = JSON.parse(text3);
    if (parsed?.presentation === "dove-mcp-result-contract" && parsed.fullResult) {
      return parsed.fullResult;
    }
    return parsed;
  } catch (error) {
    throw new Error(`${action} returned invalid JSON: ${error.message}`);
  }
}
function createGoalTask(root, dispatch, args, action = "create_dove_task") {
  const proposal = parseToolJson(dispatch(root, "create_dove_task", args), `${action} proposal`);
  expect(proposal.status === "needs-confirmation", `${action} proposal must require confirmation`, { status: proposal.status });
  const confirmArgs = exactMissionConfirmArgs(proposal, action);
  return parseToolJson(dispatch(root, "create_dove_task", confirmArgs), `${action} confirmed`);
}
function readJson2(root, relativePath) {
  const fullPath = path17.join(root, relativePath);
  return JSON.parse(fs16.readFileSync(fullPath, "utf8"));
}
function expect(condition, message, evidence = {}) {
  if (!condition) {
    const detail = Object.keys(evidence).length > 0 ? ` Evidence: ${JSON.stringify(evidence)}` : "";
    throw new Error(`${message}.${detail}`);
  }
}
function findTask(index, taskId) {
  return (index.items ?? []).find((item) => item.id === taskId) ?? null;
}
function runOperatorHostPassWithoutResultsGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("operator-host-pass-without-results");
  const packetId = "workflow-goal-operator-source";
  const runId = "workflow-goal-operator-run";
  parseToolJson(dispatch(root, "init_dove_goal", {
    id: "workflow-goal-init",
    goal: "Validate workflow goal acceptance gates."
  }), "init_dove_goal");
  createGoalTask(root, dispatch, {
    id: packetId,
    title: "Workflow goal source task",
    goal: "Collect source provenance through host tools.",
    status: "ready",
    nextAction: "project:dove.source",
    domain: "paper",
    checklist: false
  }, "create_dove_task operator source fixture");
  const beforeIndex = readJson2(root, ARTIFACT_PATHS.taskPacketsIndex);
  const beforeTask = findTask(beforeIndex, packetId);
  expect(beforeTask?.status === "ready", "Seeded host-pass task must start ready", { status: beforeTask?.status });
  expect(beforeTask?.boundary === null, "Seeded host-pass task must start without boundary", { boundary: beforeTask?.boundary });
  const preview = parseToolJson(dispatch(root, "run_dove_operator", {}), "run_dove_operator preview");
  expect(preview.status === "needs-confirmation", "Operator preview must require confirmation", { status: preview.status });
  expect(preview.autoRunnableTasks === void 0, "Operator preview must stay compact by default", { autoRunnableTasks: preview.autoRunnableTasks });
  expect(preview.hostPassRequiredTasks === void 0, "Operator preview must not return full host-pass arrays by default", { hostPassRequiredTasks: preview.hostPassRequiredTasks });
  expect(Array.isArray(preview.queueSummary?.autoRunnableTaskIds) && preview.queueSummary.autoRunnableTaskIds.length === 0, "Host-pass-only queue must not report auto-runnable work", { queueSummary: preview.queueSummary });
  expect(JSON.stringify(preview.queueSummary?.hostPassRequiredTaskIds ?? []) === JSON.stringify([packetId]), "Operator preview must classify the task as host-pass-required", { queueSummary: preview.queueSummary });
  expect(Array.isArray(preview.writes) && preview.writes.length === 0, "Operator preview must remain proposal-only", { writes: preview.writes });
  const run = parseOperationalToolJson(dispatch(root, "run_dove_operator", {
    confirmed: true,
    runId
  }), "run_dove_operator confirmed");
  expect(run.status === "needs-host-results", "Confirmed operator run without taskResults must stop at needs-host-results", { status: run.status });
  expect(run.updatedTasks === void 0, "Confirmed operator run must stay compact by default", { updatedTasks: run.updatedTasks });
  expect(Array.isArray(run.updatedTaskIds) && run.updatedTaskIds.length === 0, "Confirmed operator run without taskResults must not report updated task ids", { updatedTaskIds: run.updatedTaskIds });
  expect(JSON.stringify(run.awaitingResultTaskIds ?? []) === JSON.stringify([packetId]), "Confirmed operator run must report awaiting host result task ids", { awaitingResultTaskIds: run.awaitingResultTaskIds });
  expect(JSON.stringify(run.skippedHostPassTaskIds ?? []) === JSON.stringify([packetId]), "Confirmed operator run must report skipped host-pass task ids", { skippedHostPassTaskIds: run.skippedHostPassTaskIds });
  expect(run.operatorResultSummary?.runtimeRecorded === false, "Confirmed operator run without actual work must not record a runtime result", { runtimeRecorded: run.operatorResultSummary?.runtimeRecorded });
  expect(run.resultCard?.status === "needs-host-results", "Result card must preserve needs-host-results status", { resultCardStatus: run.resultCard?.status });
  expect(!Object.hasOwn(run.resultCard ?? {}, "packetIds"), "Result card must not expose affected packet ids when nothing changed", { resultCardKeys: Object.keys(run.resultCard ?? {}) });
  expect((run.awaitingRequiredActions ?? []).includes("collect-source-provenance"), "Confirmed operator run must return source provenance required action", { awaitingRequiredActions: run.awaitingRequiredActions });
  expect((run.awaitingRequiredActions ?? []).includes("call-register-source-with-sources-array"), "Confirmed operator run must return register-source required action", { awaitingRequiredActions: run.awaitingRequiredActions });
  const afterIndex = readJson2(root, ARTIFACT_PATHS.taskPacketsIndex);
  const afterTask = findTask(afterIndex, packetId);
  expect(afterTask?.status === "ready", "Host-pass task must remain ready after no-result operator run", { status: afterTask?.status });
  expect(afterTask?.boundary === null, "Host-pass task must not get a synthetic awaiting boundary", { boundary: afterTask?.boundary });
  const packet = readJson2(root, `${ARTIFACT_PATHS.taskPacketsDir}/packets/${packetId}.json`);
  expect(packet.status === "ready", "Host-pass packet file must remain ready after no-result operator run", { status: packet.status });
  expect(packet.boundary === null, "Host-pass packet file must not get a synthetic boundary", { boundary: packet.boundary });
  const runtimeResults = readJson2(root, ARTIFACT_PATHS.runtimeResults);
  const runtimeEntry = (runtimeResults.entries ?? []).find((entry) => entry.id === runId || entry.runId === runId);
  expect(!runtimeEntry, "No runtime result entry may be persisted when no actual operator work happened", { runId, runtimeEntry });
  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      runId,
      previewStatus: preview.status,
      runStatus: run.status,
      updatedTaskCount: run.updatedTaskIds.length,
      runtimeRecorded: run.operatorResultSummary.runtimeRecorded,
      finalTaskStatus: afterTask.status,
      finalBoundary: afterTask.boundary,
      runtimeEntryPersisted: false,
      requiredActions: run.awaitingRequiredActions
    },
    failureReflection: contract.failureReflection
  };
}
function seedGoalWorkspace(root, dispatch, initId = "workflow-goal-init") {
  parseToolJson(dispatch(root, "init_dove_goal", {
    id: initId,
    goal: "Validate workflow goal acceptance gates."
  }), "init_dove_goal");
  seedWorkflowGoalEvidence(root);
}
function seedGoalTask(root, dispatch, packetId, fields = {}) {
  return createGoalTask(root, dispatch, {
    ...fields,
    id: packetId,
    title: fields.title ?? packetId.replace(/-/g, " "),
    goal: fields.goal ?? "Validate Dove workflow goal behavior.",
    status: fields.status ?? "ready",
    nextAction: fields.nextAction ?? "project:dove.status",
    domain: fields.domain ?? "engineering",
    checklist: false
  }, `create_dove_task ${packetId} fixture`);
}
function runMissionContractMaterializesWithoutExecutionGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("mission-contract-materializes-without-execution");
  const packetId = "workflow-goal-mission-handoff";
  const runId = "workflow-goal-mission-handoff-stale-run";
  seedGoalWorkspace(root, dispatch, "workflow-goal-mission-handoff-init");
  const missionArgs = {
    id: packetId,
    title: "Workflow goal mission handoff",
    goal: "Materialize a mission contract and hand off without recording execution.",
    domain: "engineering",
    checklistItems: []
  };
  const proposal = parseToolJson(dispatch(root, "create_dove_task", missionArgs), "create_dove_task mission handoff proposal");
  expect(proposal.status === "needs-confirmation", "Mission proposal must require confirmation", { status: proposal.status });
  expect(proposal.workflowMode === "mission-contract", "Mission proposal must use mission-contract workflow mode", { workflowMode: proposal.workflowMode });
  expect(proposal.executionMode === "contract-handoff", "Mission proposal must use contract-handoff execution mode", { executionMode: proposal.executionMode });
  expect(proposal.noAutoApply === true && Array.isArray(proposal.writes) && proposal.writes.length === 0, "Mission proposal must remain proposal-only", { noAutoApply: proposal.noAutoApply, writes: proposal.writes });
  expect(!("missionPassRequired" in proposal), "Mission proposal must not expose missionPassRequired", { keys: Object.keys(proposal) });
  expect(!("recordMissionPassTool" in proposal), "Mission proposal must not expose recordMissionPassTool", { keys: Object.keys(proposal) });
  const approvedConfirmArgs = exactMissionConfirmArgs(proposal, "create_dove_task mission handoff");
  const runtimeBefore = readJson2(root, ARTIFACT_PATHS.runtimeResults);
  const created = parseToolJson(dispatch(root, "create_dove_task", approvedConfirmArgs), "create_dove_task mission handoff confirmed");
  expect(created.status === "materialized", "Exact mission confirmation must only materialize the contract", { status: created.status });
  const rejectedPacketId = `${packetId}-rejected`;
  const rejectedMissionArgs = {
    ...missionArgs,
    id: rejectedPacketId,
    title: "Workflow goal rejected mission confirmation"
  };
  const rejectedProposal = parseToolJson(dispatch(root, "create_dove_task", rejectedMissionArgs), "create_dove_task rejected mission proposal");
  const rejectedConfirmArgs = exactMissionConfirmArgs(rejectedProposal, "create_dove_task rejected mission");
  const bareConfirmationError = expectToolError(dispatch(root, "create_dove_task", {
    ...rejectedMissionArgs,
    confirmed: true
  }), "create_dove_task bare confirmation", /exact proposalDigest/u);
  const staleConfirmationError = expectToolError(dispatch(root, "create_dove_task", {
    ...structuredClone(rejectedConfirmArgs),
    runId,
    resultStatus: "completed",
    resultSummary: "These stale pass fields must invalidate mission confirmation.",
    evidenceLinks: [ARTIFACT_PATHS.runtimeResults],
    artifactRefs: [ARTIFACT_PATHS.runtimeResults],
    verificationEvidencePaths: [WORKFLOW_GOAL_VERIFICATION_PATH],
    verifiedCriteria: workflowVerifiedCriteria("Mission materialized without execution")
  }), "create_dove_task stale confirmation", /does not accept unknown input/u);
  const indexAfterRejections = readJson2(root, ARTIFACT_PATHS.taskPacketsIndex);
  expect(!findTask(indexAfterRejections, rejectedPacketId), "Rejected mission confirmations must not materialize the task", { rejectedPacketId });
  expect(created.contractMaterialized === true, "Confirmed mission must report contractMaterialized", { contractMaterialized: created.contractMaterialized });
  expect(created.workflowMode === "mission-contract", "Confirmed mission must keep mission-contract workflow mode", { workflowMode: created.workflowMode });
  expect(created.executionMode === "contract-handoff", "Confirmed mission must keep contract-handoff execution mode", { executionMode: created.executionMode });
  expect(created.foreground === false && created.background === false && created.daemon === false, "Confirmed mission must not claim foreground/background/daemon execution", { foreground: created.foreground, background: created.background, daemon: created.daemon });
  expect(!("missionPassRequired" in created), "Confirmed mission must not expose missionPassRequired", { keys: Object.keys(created) });
  expect(!("recordMissionPassTool" in created), "Confirmed mission must not expose recordMissionPassTool", { keys: Object.keys(created) });
  expect(!("recordMissionPassArgs" in created), "Confirmed mission must not expose recordMissionPassArgs", { keys: Object.keys(created) });
  expect(!("missionPass" in created), "Confirmed mission must not expose missionPass", { keys: Object.keys(created) });
  expect(!("result" in created), "Confirmed mission must not expose result", { keys: Object.keys(created) });
  expect(!("resultCard" in created), "Confirmed mission must not expose resultCard", { keys: Object.keys(created) });
  expect(Array.isArray(created.handoffRoutes) && created.handoffRoutes.length > 0, "Confirmed mission must return handoff routes", { handoffRoutes: created.handoffRoutes });
  expect(JSON.stringify(created.recommendedRoutes ?? []) === JSON.stringify(created.handoffRoutes ?? []), "Confirmed mission recommended routes must match handoff routes", { recommendedRoutes: created.recommendedRoutes, handoffRoutes: created.handoffRoutes });
  const afterIndex = readJson2(root, ARTIFACT_PATHS.taskPacketsIndex);
  const afterTask = findTask(afterIndex, packetId);
  expect(afterTask?.status === "ready", "Materialized mission task must remain ready", { status: afterTask?.status });
  const runtimeAfter = readJson2(root, ARTIFACT_PATHS.runtimeResults);
  const runtimeEntry = (runtimeAfter.entries ?? []).find((entry) => entry.id === runId || entry.runId === runId);
  expect(!runtimeEntry, "Mission materialization must not persist stale pass fields as runtime results", { runId, runtimeEntry });
  expect(JSON.stringify(runtimeAfter.entries ?? []) === JSON.stringify(runtimeBefore.entries ?? []), "Mission materialization must not append runtime result entries", { before: runtimeBefore.entries, after: runtimeAfter.entries });
  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      runId,
      proposalStatus: proposal.status,
      bareConfirmationRejected: bareConfirmationError.includes("exact proposalDigest"),
      staleConfirmationRejected: staleConfirmationError.includes("does not accept unknown input"),
      rejectedPacketId,
      taskAbsentAfterRejectedConfirmations: true,
      materializedStatus: created.status,
      workflowMode: created.workflowMode,
      executionMode: created.executionMode,
      contractMaterialized: created.contractMaterialized,
      finalTaskStatus: afterTask.status,
      runtimeEntryPersisted: false,
      handoffRouteCount: created.handoffRoutes.length,
      passRecorderFieldsAbsent: true
    },
    failureReflection: contract.failureReflection
  };
}
function runMissionCompletionRequiresEvidenceGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("mission-completion-requires-evidence");
  const packetId = "workflow-goal-mission-completion";
  const runId = "workflow-goal-mission-completion-run";
  seedGoalWorkspace(root, dispatch, "workflow-goal-mission-init");
  seedGoalTask(root, dispatch, packetId, { title: "Workflow goal mission completion", nextAction: "project:dove.mission" });
  const rejected = parseToolJson(dispatch(root, "record_dove_mission_pass", {
    packetId,
    runId,
    resultStatus: "completed",
    resultSummary: "The mission claims it is done but provides no evidence."
  }), "record_dove_mission_pass completion without evidence");
  expect(rejected.status === "needs-completion-evidence", "Mission completion without evidence must be rejected", { status: rejected.status });
  expect(rejected.noAutoApply === true && Array.isArray(rejected.writes) && rejected.writes.length === 0, "Rejected mission completion must remain proposal-only", { noAutoApply: rejected.noAutoApply, writes: rejected.writes });
  expect((rejected.requiredActions ?? []).includes("provide-evidence-links-or-artifact-refs-or-verification-evidence"), "Rejected mission completion must request evidence, artifacts, or verification evidence", { requiredActions: rejected.requiredActions });
  const afterIndex = readJson2(root, ARTIFACT_PATHS.taskPacketsIndex);
  const afterTask = findTask(afterIndex, packetId);
  expect(afterTask?.status === "ready", "Task must remain ready after rejected mission completion", { status: afterTask?.status });
  const runtimeResults = readJson2(root, ARTIFACT_PATHS.runtimeResults);
  const runtimeEntry = (runtimeResults.entries ?? []).find((entry) => entry.id === runId || entry.runId === runId);
  expect(!runtimeEntry, "Rejected mission completion must not persist a runtime result", { runId, runtimeEntry });
  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      runId,
      rejectedStatus: rejected.status,
      finalTaskStatus: afterTask.status,
      runtimeEntryPersisted: false,
      requiredActions: rejected.requiredActions
    },
    failureReflection: contract.failureReflection
  };
}
function runAutoReadOnlyCannotCompleteGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("auto-read-only-step-cannot-complete");
  const packetId = "workflow-goal-auto-read-only";
  const runId = "workflow-goal-auto-read-only-run";
  seedGoalWorkspace(root, dispatch, "workflow-goal-auto-init");
  seedGoalTask(root, dispatch, packetId, { title: "Workflow goal auto read-only", nextAction: "project:dove.auto" });
  const steps = [{
    command: "dove.status",
    completeTask: true
  }];
  const proposal = parseToolJson(
    dispatch(root, "run_dove_auto", {
      packetId,
      steps
    }),
    "run_dove_auto read-only completion proposal"
  );
  const run = parseOperationalToolJson(
    dispatch(root, "run_dove_auto", {
      ...exactAutoConfirmArgs(
        proposal,
        "run_dove_auto read-only completion"
      ),
      runId
    }),
    "run_dove_auto read-only completion"
  );
  expect(run.status === "needs-explicit-progress-step", "Read-only auto completion must require an explicit progress step", { status: run.status });
  expect(run.noAutoApply === true && Array.isArray(run.writes) && run.writes.length === 0, "Read-only auto rejection must remain proposal-only", { noAutoApply: run.noAutoApply, writes: run.writes });
  expect(run.result?.iterationCount === 0, "Read-only auto rejection must not record a completed iteration", { iterationCount: run.result?.iterationCount });
  expect((run.requiredActions ?? []).includes("provide-explicit-auto-step"), "Read-only auto rejection must request an explicit progress step", { requiredActions: run.requiredActions });
  const afterIndex = readJson2(root, ARTIFACT_PATHS.taskPacketsIndex);
  const afterTask = findTask(afterIndex, packetId);
  expect(afterTask?.status === "ready", "Read-only auto step must leave task ready", { status: afterTask?.status });
  const runtimeResults = readJson2(root, ARTIFACT_PATHS.runtimeResults);
  const runtimeEntry = (runtimeResults.entries ?? []).find((entry) => entry.id === runId || entry.runId === runId);
  expect(!runtimeEntry, "Read-only auto rejection must not persist runtime work", { runId, runtimeEntry });
  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      runId,
      runStatus: run.status,
      iterationCount: run.result.iterationCount,
      finalTaskStatus: afterTask.status,
      runtimeEntryPersisted: false,
      requiredActions: run.requiredActions
    },
    failureReflection: contract.failureReflection
  };
}
function runExperienceBlockedAuditNotBridgedGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("experience-blocked-audit-not-bridged");
  const packetId = "workflow-goal-experience-blocked";
  seedGoalWorkspace(root, dispatch, "workflow-goal-experience-init");
  seedGoalTask(root, dispatch, packetId, { title: "Workflow goal blocked experience", nextAction: "project:dove.experience", domain: "experiment" });
  const result = parseToolJson(dispatch(root, "run_experience_workflow", {
    packetId,
    experimentId: "blocked-audit-experiment",
    goal: "Validate that blocked experiment audits do not bridge claims.",
    claimId: "unseeded-claim",
    result: {
      outcome: "supports",
      summary: "This result is intentionally incomplete."
    }
  }), "run_experience_workflow blocked audit");
  expect(result.status === "needs-review", "Blocked experiment audit must return needs-review", { status: result.status });
  expect(result.audit?.auditVerdict === "blocked", "Incomplete experiment result must have blocked audit verdict", { audit: result.audit });
  expect((result.audit?.integrityFlags ?? []).length > 0, "Blocked audit must expose integrity flags", { integrityFlags: result.audit?.integrityFlags });
  expect(result.bridge?.status !== "applied", "Blocked audit bridge must not be applied", { bridge: result.bridge });
  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      runStatus: result.status,
      auditVerdict: result.audit.auditVerdict,
      integrityFlags: result.audit.integrityFlags,
      bridgeStatus: result.bridge?.status ?? null
    },
    failureReflection: contract.failureReflection
  };
}
function runPlanCompletionRequiresExecutableChildrenGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("plan-completion-requires-executable-children");
  const packetId = "workflow-goal-plan-no-children";
  const runId = "workflow-goal-plan-no-children-run";
  seedGoalWorkspace(root, dispatch, "workflow-goal-plan-no-children-init");
  seedGoalTask(root, dispatch, packetId, {
    title: "Workflow goal plan requires children",
    stage: "plan",
    nextAction: "project:dove.mission",
    executionContract: workflowExecutionContract({
      chainType: "plan-to-executable-missions",
      roleSequence: ["planner", "builder", "reviewer"],
      action: "record_dove_mission_pass",
      implementation: ["Return explicit executable child missions."],
      convergence: {
        criteria: ["Explicit executable child missions returned"],
        evidenceRequired: ["plannedMissions with executionContract"],
        definitionOfDone: "Planning yields executable child contracts."
      },
      failureRoutes: [
        { on: "plan-output-not-executable", boundaryType: "plan-output-not-executable", nextAction: "record_dove_mission_pass", requiredActions: ["provide-executable-child-missions"] }
      ]
    })
  });
  const rejected = parseToolJson(dispatch(root, "record_dove_mission_pass", {
    packetId,
    runId,
    resultStatus: "completed",
    resultSummary: "The plan claims completion without child mission output.",
    verificationEvidencePaths: [WORKFLOW_GOAL_VERIFICATION_PATH],
    verifiedCriteria: workflowVerifiedCriteria("Explicit executable child missions returned")
  }), "record_dove_mission_pass plan completion without children");
  expect(rejected.status === "plan-output-not-executable", "Plan completion without child missions must be rejected", { status: rejected.status });
  expect(rejected.noAutoApply === true && Array.isArray(rejected.writes) && rejected.writes.length === 0, "Rejected plan completion must remain proposal-only", { noAutoApply: rejected.noAutoApply, writes: rejected.writes });
  expect((rejected.requiredActions ?? []).includes("provide-executable-child-missions"), "Rejected plan completion must request executable child missions", { requiredActions: rejected.requiredActions });
  const afterIndex = readJson2(root, ARTIFACT_PATHS.taskPacketsIndex);
  const afterTask = findTask(afterIndex, packetId);
  expect(afterTask?.status === "ready", "Plan task must remain ready after missing child output", { status: afterTask?.status });
  const runtimeResults = readJson2(root, ARTIFACT_PATHS.runtimeResults);
  const runtimeEntry = (runtimeResults.entries ?? []).find((entry) => entry.id === runId || entry.runId === runId);
  expect(!runtimeEntry, "Rejected plan completion must not persist a runtime result", { runId, runtimeEntry });
  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      runId,
      rejectedStatus: rejected.status,
      finalTaskStatus: afterTask.status,
      runtimeEntryPersisted: false,
      requiredActions: rejected.requiredActions
    },
    failureReflection: contract.failureReflection
  };
}
function runPlanChildContractRequiresCriteriaGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("plan-child-contract-requires-criteria");
  const packetId = "workflow-goal-plan-child-no-criteria";
  const runId = "workflow-goal-plan-child-no-criteria-run";
  seedGoalWorkspace(root, dispatch, "workflow-goal-plan-child-no-criteria-init");
  seedGoalTask(root, dispatch, packetId, {
    title: "Workflow goal plan child criteria",
    stage: "plan",
    nextAction: "project:dove.mission",
    executionContract: workflowExecutionContract({
      chainType: "plan-to-executable-missions",
      roleSequence: ["planner", "builder", "reviewer"],
      action: "record_dove_mission_pass",
      implementation: ["Return explicit executable child missions."],
      convergence: { criteria: ["Executable child mission contracts validated"] },
      failureRoutes: [{ on: "plan-output-not-executable", boundaryType: "plan-output-not-executable", nextAction: "record_dove_mission_pass", requiredActions: ["provide-executable-child-missions"] }]
    })
  });
  const rejected = parseToolJson(dispatch(root, "record_dove_mission_pass", {
    packetId,
    runId,
    resultStatus: "completed",
    resultSummary: "The plan returns a child mission without convergence criteria.",
    plannedMissions: [{
      id: "workflow-goal-invalid-child",
      title: "Invalid child without criteria",
      summary: "This child is intentionally missing convergence criteria.",
      executionContract: workflowExecutionContract({
        convergence: { criteria: [] }
      })
    }]
  }), "record_dove_mission_pass plan child without criteria");
  expect(rejected.status === "plan-output-not-executable", "Plan child without criteria must be rejected", { status: rejected.status });
  expect((rejected.notExecutable ?? []).length === 1, "Rejected plan output must identify the invalid child mission", { notExecutable: rejected.notExecutable });
  expect((rejected.notExecutable?.[0]?.missing ?? []).includes("convergence.criteria"), "Rejected child mission must name convergence.criteria as missing", { notExecutable: rejected.notExecutable });
  const afterIndex = readJson2(root, ARTIFACT_PATHS.taskPacketsIndex);
  const createdChild = findTask(afterIndex, "workflow-goal-invalid-child");
  expect(!createdChild, "Invalid child mission must not be materialized", { createdChild });
  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      runId,
      rejectedStatus: rejected.status,
      notExecutable: rejected.notExecutable,
      childCreated: Boolean(createdChild)
    },
    failureReflection: contract.failureReflection
  };
}
function runStatusAdjustCompletionRequiresCriteriaGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("status-adjust-completion-requires-criteria");
  const packetId = "workflow-goal-status-no-criteria";
  seedGoalWorkspace(root, dispatch, "workflow-goal-status-no-criteria-init");
  seedGoalTask(root, dispatch, packetId, {
    title: "Workflow goal status criteria gate",
    executionContract: workflowExecutionContract()
  });
  const result = parseToolJson(dispatch(root, "apply_dove_status_adjustments", {
    confirmed: true,
    adjustments: [{
      packetId,
      status: "completed",
      reason: "The status adjustment claims completion with evidence but no criteria coverage.",
      artifactRefs: [WORKFLOW_GOAL_ARTIFACT_PATH],
      verificationEvidencePaths: [WORKFLOW_GOAL_VERIFICATION_PATH]
    }]
  }), "apply_dove_status_adjustments without criteria");
  const rejection = result.rejected?.[0];
  expect(result.status === "rejected", "Status adjustment without criteria coverage must be rejected", { status: result.status });
  expect(rejection?.completionBlock?.status === "verification-failed", "Status adjustment rejection must expose verification-failed", { rejection });
  expect((rejection?.completionBlock?.requiredActions ?? []).includes("provide-verified-criteria"), "Status adjustment rejection must require verified criteria", { rejection });
  const afterIndex = readJson2(root, ARTIFACT_PATHS.taskPacketsIndex);
  const afterTask = findTask(afterIndex, packetId);
  expect(afterTask?.status === "ready", "Status adjustment must leave task ready", { status: afterTask?.status });
  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      adjustmentStatus: result.status,
      rejectionStatus: rejection?.completionBlock?.status,
      finalTaskStatus: afterTask.status,
      requiredActions: rejection?.completionBlock?.requiredActions ?? []
    },
    failureReflection: contract.failureReflection
  };
}
function runOperatorHostResultRequiresCriteriaGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("operator-host-result-requires-criteria");
  const packetId = "workflow-goal-operator-no-criteria";
  const runId = "workflow-goal-operator-no-criteria-run";
  seedGoalWorkspace(root, dispatch, "workflow-goal-operator-no-criteria-init");
  seedGoalTask(root, dispatch, packetId, {
    title: "Workflow goal operator criteria gate",
    nextAction: "project:dove.source",
    domain: "paper",
    executionContract: workflowExecutionContract()
  });
  const run = parseToolJson(dispatch(root, "run_dove_operator", {
    confirmed: true,
    includeQueueDetails: true,
    runId,
    taskResults: [{
      packetId,
      resultStatus: "completed",
      summary: "The host pass claims completion with evidence but no criteria coverage.",
      artifactRefs: [WORKFLOW_GOAL_ARTIFACT_PATH],
      verificationEvidencePaths: [WORKFLOW_GOAL_VERIFICATION_PATH]
    }]
  }), "run_dove_operator host result without criteria");
  const iteration = run.result?.iterations?.find((item) => item.packetId === packetId);
  expect(iteration?.status === "verification-failed", "Operator host result without criteria must record verification-failed iteration", { iteration });
  expect((iteration?.requiredActions ?? []).includes("provide-verified-criteria"), "Operator host result must require verified criteria", { iteration });
  const afterIndex = readJson2(root, ARTIFACT_PATHS.taskPacketsIndex);
  const afterTask = findTask(afterIndex, packetId);
  expect(afterTask?.status === "blocked", "Operator host result without criteria must block the task", { status: afterTask?.status });
  expect(afterTask?.boundary?.type === "verification-failed", "Operator host result must open verification-failed boundary", { boundary: afterTask?.boundary });
  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      runStatus: run.status,
      iterationStatus: iteration?.status,
      finalTaskStatus: afterTask.status,
      boundaryType: afterTask.boundary?.type,
      requiredActions: iteration?.requiredActions ?? []
    },
    failureReflection: contract.failureReflection
  };
}
function runAutoCompletionRequiresCriteriaGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("auto-completion-requires-criteria");
  const packetId = "workflow-goal-auto-no-criteria";
  const runId = "workflow-goal-auto-no-criteria-run";
  seedGoalWorkspace(root, dispatch, "workflow-goal-auto-no-criteria-init");
  seedGoalTask(root, dispatch, packetId, {
    title: "Workflow goal auto criteria gate",
    nextAction: "project:dove.auto",
    executionContract: workflowExecutionContract()
  });
  parseToolJson(dispatch(root, "register_source", {
    packetId,
    sourceId: "workflow-goal-auto-source",
    citationKey: "workflowGoalAutoSource2026",
    title: "Workflow Goal Auto Source",
    locator: "integration-test:workflow-goal-auto-source",
    sourceType: "test-fixture"
  }), "register_source auto criteria fixture");
  const steps = [{
    command: "dove.note",
    completeTask: true,
    args: {
      noteId: "workflow-goal-auto-note",
      title: "Workflow goal auto note",
      sourceIds: ["workflow-goal-auto-source"],
      summary: "The auto step produces a real note artifact but no verifiedCriteria coverage."
    }
  }];
  const proposal = parseToolJson(
    dispatch(root, "run_dove_auto", {
      packetId,
      steps
    }),
    "run_dove_auto artifact completion proposal"
  );
  const run = parseOperationalToolJson(
    dispatch(root, "run_dove_auto", {
      ...exactAutoConfirmArgs(
        proposal,
        "run_dove_auto artifact completion"
      ),
      runId
    }),
    "run_dove_auto artifact completion without criteria"
  );
  expect(run.status === "verification-failed", "Auto artifact completion without criteria must return verification-failed", { status: run.status });
  expect(run.boundary?.type === "verification-failed", "Auto artifact completion must open verification-failed boundary", { boundary: run.boundary });
  expect((run.boundary?.requiredActions ?? []).includes("provide-verified-criteria"), "Auto artifact completion must require verified criteria", { boundary: run.boundary });
  const afterIndex = readJson2(root, ARTIFACT_PATHS.taskPacketsIndex);
  const afterTask = findTask(afterIndex, packetId);
  expect(afterTask?.status === "blocked", "Auto artifact completion without criteria must block the task", { status: afterTask?.status });
  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      runStatus: run.status,
      finalTaskStatus: afterTask.status,
      boundaryType: run.boundary?.type,
      requiredActions: run.boundary?.requiredActions ?? []
    },
    failureReflection: contract.failureReflection
  };
}
function runStatusRoutesMissingExecutionContractGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("status-routes-missing-execution-contract");
  const packetId = "workflow-goal-missing-contract";
  seedGoalWorkspace(root, dispatch, "workflow-goal-missing-contract-init");
  seedGoalTask(root, dispatch, packetId, {
    title: "Workflow goal missing contract",
    nextAction: "project:dove.status"
  });
  patchGoalTask(root, packetId, { executionContract: void 0 });
  const status = parseToolJson(dispatch(root, "query_dove_status", { detail: "full" }), "query_dove_status missing contract");
  const nextAction = status.dailyHome?.nextActions?.[0];
  expect(status.projectSummary?.status === "blocked" || status.dashboard?.returnReadiness?.status === "blocked", "Status must be blocked when execution contract is missing", { projectSummary: status.projectSummary, returnReadiness: status.dashboard?.returnReadiness });
  expect(status.dailyHome?.executionGaps?.counts?.missingContract === 1, "Status execution gaps must count the missing contract task", { executionGaps: status.dailyHome?.executionGaps });
  expect(nextAction?.kind === "recover-current-work" && nextAction?.recoveryPrimaryKind === "missing-executable-contract", "Status must rank a recovery card for the missing executable contract first", { nextAction });
  expect(nextAction?.packetId === packetId && nextAction?.command === "project:dove.mission", "Missing contract recovery card must route to Planner mission surface", { nextAction });
  expect(status.preActionGuidance?.workflowFrame?.executionGuidance?.nextRole === "planner", "Pre-action guidance must identify planner as next role", { executionGuidance: status.preActionGuidance?.workflowFrame?.executionGuidance });
  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      returnStatus: status.projectSummary?.status ?? status.dashboard?.returnReadiness?.status,
      missingContractCount: status.dailyHome.executionGaps.counts.missingContract,
      firstActionKind: nextAction.kind,
      recoveryPrimaryKind: nextAction.recoveryPrimaryKind,
      executionNextRole: status.preActionGuidance.workflowFrame.executionGuidance.nextRole
    },
    failureReflection: contract.failureReflection
  };
}
function runPublicSurfacesStayFlatGoal() {
  const contract = CONTRACT_BY_ID.get("public-surfaces-stay-flat");
  const publicIds = COMMAND_SURFACES.map((surface) => surface.id);
  const forbidden = ["dove.planner", "dove.builder", "dove.reviewer", "dove.missions", "dove.board", "dove.list"];
  const presentForbidden = forbidden.filter((id) => publicIds.includes(id));
  const required = ["dove.init", "dove.mission", "dove.auto", "dove.status", "dove.operator", "dove.lessons", "dove.review"];
  const missingRequired = required.filter((id) => !publicIds.includes(id));
  expect(presentForbidden.length === 0, "Forbidden public Dove command surfaces must remain absent", { presentForbidden });
  expect(missingRequired.length === 0, "Required flat Dove command surfaces must remain present", { missingRequired });
  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      surfaceCount: publicIds.length,
      forbiddenAbsent: forbidden,
      requiredPresent: required
    },
    failureReflection: contract.failureReflection
  };
}
var WORKFLOW_GOAL_RUNNERS = {
  "operator-host-pass-without-results": runOperatorHostPassWithoutResultsGoal,
  "mission-contract-materializes-without-execution": runMissionContractMaterializesWithoutExecutionGoal,
  "mission-completion-requires-evidence": runMissionCompletionRequiresEvidenceGoal,
  "auto-read-only-step-cannot-complete": runAutoReadOnlyCannotCompleteGoal,
  "experience-blocked-audit-not-bridged": runExperienceBlockedAuditNotBridgedGoal,
  "plan-completion-requires-executable-children": runPlanCompletionRequiresExecutableChildrenGoal,
  "plan-child-contract-requires-criteria": runPlanChildContractRequiresCriteriaGoal,
  "status-adjust-completion-requires-criteria": runStatusAdjustCompletionRequiresCriteriaGoal,
  "operator-host-result-requires-criteria": runOperatorHostResultRequiresCriteriaGoal,
  "auto-completion-requires-criteria": runAutoCompletionRequiresCriteriaGoal,
  "status-routes-missing-execution-contract": runStatusRoutesMissingExecutionContractGoal,
  "public-surfaces-stay-flat": runPublicSurfacesStayFlatGoal
};
function validateWorkflowGoals(options = {}) {
  const { createRoot, cleanupRoot, dispatch } = options;
  if (typeof createRoot !== "function") {
    throw new Error("validateWorkflowGoals requires createRoot.");
  }
  if (typeof cleanupRoot !== "function") {
    throw new Error("validateWorkflowGoals requires cleanupRoot.");
  }
  if (typeof dispatch !== "function") {
    throw new Error("validateWorkflowGoals requires dispatch.");
  }
  const dispatchForGoal = (root, name, args = {}) => dispatch(root, name, { ...args, resultMode: args.resultMode ?? "full" });
  validateWorkflowGoalContracts();
  const results = [];
  const failures = [];
  for (const contract of WORKFLOW_GOAL_CONTRACTS) {
    const runner = WORKFLOW_GOAL_RUNNERS[contract.id];
    if (!runner) {
      failures.push({
        id: contract.id,
        message: "No executable workflow-goal runner is registered.",
        failureReflection: contract.failureReflection
      });
      continue;
    }
    const root = createRoot(`dove-workflow-goal-${contract.id}-`);
    try {
      results.push(runner(root, dispatchForGoal));
    } catch (error) {
      failures.push({
        id: contract.id,
        message: error instanceof Error ? error.message : String(error),
        failureMode: contract.failureMode,
        failureReflection: contract.failureReflection
      });
    } finally {
      cleanupRoot(root);
    }
  }
  if (failures.length > 0) {
    throw new WorkflowGoalValidationError(failures);
  }
  return {
    status: "passed",
    goalCount: results.length,
    contracts: WORKFLOW_GOAL_CONTRACTS.map((contract) => ({
      id: contract.id,
      surface: contract.surface,
      objective: contract.objective,
      failureMode: contract.failureMode,
      failureReflection: contract.failureReflection
    })),
    results
  };
}

// src/core/network-search.mjs
var DEFAULT_KIND = "scholarly";
var SEARCH_KINDS = /* @__PURE__ */ new Set(["scholarly", "web", "all"]);
var DEFAULT_LIMIT = 8;
var MAX_LIMIT = 50;
var DEFAULT_TIMEOUT_MS2 = 12e3;
var MAX_QUERY_CHARS = 500;
var POST_FILTER_OVERFETCH_FACTOR = 3;
var SECRET_VALUE_PATTERN = /\b(?:Bearer\s+[A-Za-z0-9._~+/=-]+|sk-[A-Za-z0-9_-]{12,}|(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,}]+)\b/giu;
var NETWORK_SEARCH_PROVIDER_REGISTRY = Object.freeze([
  Object.freeze({ id: "openalex", kind: "scholarly", access: "public", defaultLimit: 5, maxLimit: 25, capabilities: ["works", "doi", "open-access", "authors", "year"], filters: Object.freeze({ year: "native", domains: "post", fieldsOfStudy: "post", openAccessOnly: "post", locale: "post" }) }),
  Object.freeze({ id: "crossref", kind: "scholarly", access: "public", defaultLimit: 5, maxLimit: 20, capabilities: ["works", "doi", "open-access", "authors", "year"], filters: Object.freeze({ year: "native", domains: "post", openAccessOnly: "post", locale: "post" }) }),
  Object.freeze({ id: "arxiv", kind: "scholarly", access: "public", defaultLimit: 5, maxLimit: 20, capabilities: ["preprints", "arxiv-id", "authors", "year"], filters: Object.freeze({ year: "post", domains: "post", openAccessOnly: "post" }) }),
  Object.freeze({ id: "europe-pmc", kind: "scholarly", access: "public", defaultLimit: 5, maxLimit: 25, capabilities: ["papers", "doi", "pubmed-id", "open-access", "authors", "year"], filters: Object.freeze({ year: "post", domains: "post", openAccessOnly: "post", locale: "post" }) }),
  Object.freeze({ id: "public-web", kind: "web", access: "public", defaultLimit: 0, maxLimit: 0, unavailable: true, capabilities: ["status"], filters: Object.freeze({}) })
]);
var DEFAULT_NETWORK_SEARCH_PROVIDER_IDS2 = Object.freeze(["openalex", "crossref", "arxiv", "europe-pmc"]);
var PROVIDER_BY_ID = new Map(NETWORK_SEARCH_PROVIDER_REGISTRY.map((provider) => [provider.id, provider]));
function isPlainObject6(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function normalizeString7(value, fallback = null) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}
function normalizeBoolean4(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}
function normalizePositiveInteger2(value, fallback, min, max) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}
function normalizeStringArray9(value) {
  const rawItems = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return Array.from(new Set(rawItems.map((item) => normalizeString7(item)).filter(Boolean)));
}
function normalizeProviderId(value) {
  return normalizeString7(value)?.toLowerCase() ?? null;
}
function normalizeProviderIds(value) {
  const ids = normalizeStringArray9(value).map(normalizeProviderId).filter(Boolean);
  for (const id of ids) {
    if (!PROVIDER_BY_ID.has(id)) {
      throw new Error(`Unsupported Dove network search provider: ${id}`);
    }
  }
  return ids;
}
function normalizeDomains(value) {
  const domains = normalizeStringArray9(value).map((domain) => domain.toLowerCase());
  for (const domain of domains) {
    if (domain.includes("://") || domain.includes("/") || domain.length > 253 || !/^[a-z0-9.-]+$/iu.test(domain)) {
      throw new Error(`Dove network search domain filters must be bare hostnames: ${domain}`);
    }
  }
  return domains;
}
function normalizeYear(value) {
  const text3 = typeof value === "number" ? String(Math.trunc(value)) : normalizeString7(value);
  if (!text3) {
    return null;
  }
  if (!/^\d{4}(?:-\d{4})?$/u.test(text3)) {
    throw new Error("Dove network search year must be YYYY or YYYY-YYYY.");
  }
  return text3;
}
function normalizeLocale(value) {
  const locale = normalizeString7(value);
  if (!locale) {
    return null;
  }
  if (!/^[a-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?$/iu.test(locale)) {
    throw new Error(`Dove network search locale must be a compact locale code: ${locale}`);
  }
  return locale.replace("_", "-").toLowerCase();
}
function normalizeNetworkSearchConfigForCore(config = {}) {
  const source = isPlainObject6(config) ? config : {};
  return {
    enabled: normalizeBoolean4(source.enabled, true),
    defaultProviderIds: normalizeProviderIds(source.defaultProviderIds ?? source.defaultProviders ?? DEFAULT_NETWORK_SEARCH_PROVIDER_IDS2),
    disabledProviderIds: normalizeProviderIds(source.disabledProviderIds ?? source.disabledProviders ?? []),
    providerSettings: isPlainObject6(source.providerSettings) ? source.providerSettings : {},
    timeoutMs: normalizePositiveInteger2(source.timeoutMs, DEFAULT_TIMEOUT_MS2, 1e3, 6e4),
    maxResults: normalizePositiveInteger2(source.maxResults ?? source.limit, DEFAULT_LIMIT, 1, MAX_LIMIT)
  };
}
function normalizeNetworkSearchQuery(rawArgs = {}, config = {}) {
  const args = isPlainObject6(rawArgs) ? rawArgs : {};
  const normalizedConfig = normalizeNetworkSearchConfigForCore(config);
  const query = normalizeString7(args.query);
  if (!query) {
    throw new Error("Dove network search requires a non-empty query.");
  }
  if (query.length > MAX_QUERY_CHARS) {
    throw new Error(`Dove network search query must be ${MAX_QUERY_CHARS} characters or fewer.`);
  }
  const kind = normalizeString7(args.kind, DEFAULT_KIND).toLowerCase();
  if (!SEARCH_KINDS.has(kind)) {
    throw new Error(`Dove network search kind must be one of: ${Array.from(SEARCH_KINDS).join(", ")}.`);
  }
  return {
    query,
    kind,
    limit: normalizePositiveInteger2(args.limit ?? args.maxResults, normalizedConfig.maxResults, 1, Math.min(MAX_LIMIT, normalizedConfig.maxResults || MAX_LIMIT)),
    year: normalizeYear(args.year),
    domains: normalizeDomains(args.domains),
    fieldsOfStudy: normalizeStringArray9(args.fieldsOfStudy),
    openAccessOnly: normalizeBoolean4(args.openAccessOnly, false),
    providerIds: normalizeProviderIds(args.providerIds ?? args.providers),
    locale: normalizeLocale(args.locale)
  };
}
function redactSensitiveText(value) {
  const text3 = String(value ?? "");
  return text3.replace(SECRET_VALUE_PATTERN, "[REDACTED]");
}
function sanitizeError(error) {
  return redactSensitiveText(error instanceof Error ? error.message : String(error)).slice(0, 500);
}
function safeUrl(value) {
  const text3 = normalizeString7(value);
  if (!text3) {
    return null;
  }
  try {
    const url = new URL(text3);
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
function hostnameFromUrl(value) {
  const url = safeUrl(value);
  return url ? new URL(url).hostname.toLowerCase() : null;
}
function doiUrl(doi) {
  const normalized = normalizeDoi2(doi);
  return normalized ? `https://doi.org/${normalized}` : null;
}
function normalizeDoi2(value) {
  const text3 = normalizeString7(value)?.replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, "") ?? null;
  if (!text3) {
    return null;
  }
  const cleaned = text3.trim().toLowerCase();
  return cleaned.startsWith("10.") ? cleaned : null;
}
function normalizeTitle(value) {
  return normalizeString7(Array.isArray(value) ? value[0] : value);
}
function normalizeAuthors(value) {
  if (isPlainObject6(value)) {
    return normalizeAuthors(value.author ?? value.authors ?? value.fullName ?? value.name);
  }
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") {
        return normalizeString7(item);
      }
      if (isPlainObject6(item)) {
        return normalizeString7(item.fullName ?? item.name ?? item.display_name ?? [item.given, item.family].filter(Boolean).join(" "));
      }
      return null;
    }).filter(Boolean).slice(0, 12);
  }
  const text3 = normalizeString7(value);
  return text3 ? text3.split(/\s*[,;]\s*/u).map((item) => normalizeString7(item)).filter(Boolean).slice(0, 12) : [];
}
function normalizePublishedAt(year, dateParts) {
  const textYear = typeof year === "number" ? String(year) : normalizeString7(year);
  if (textYear && /^\d{4}/u.test(textYear)) {
    return textYear.slice(0, 10);
  }
  const parts = Array.isArray(dateParts?.[0]) ? dateParts[0] : Array.isArray(dateParts) ? dateParts : null;
  if (!parts?.[0]) {
    return null;
  }
  return parts.slice(0, 3).map((part) => String(part).padStart(2, "0")).join("-");
}
function cleanSnippet(value) {
  const text3 = normalizeString7(value);
  if (!text3) {
    return null;
  }
  return text3.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 600);
}
function decodeXml(value) {
  return String(value ?? "").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&amp;/gu, "&").replace(/&quot;/gu, '"').replace(/&#39;/gu, "'").replace(/\s+/gu, " ").trim();
}
function extractXmlText(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "iu"));
  return match ? decodeXml(match[1]) : null;
}
function abstractFromInvertedIndex(index) {
  if (!isPlainObject6(index)) {
    return null;
  }
  const pairs = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) {
      continue;
    }
    for (const position of positions) {
      if (Number.isInteger(position)) {
        pairs[position] = word;
      }
    }
  }
  return pairs.filter(Boolean).join(" ") || null;
}
function buildParams(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === void 0 || value === "") {
      continue;
    }
    params.set(key, String(value));
  }
  return params;
}
async function fetchText(url, { timeoutMs, fetchFn, headers = {} }) {
  if (typeof fetchFn !== "function") {
    throw new Error("No fetch implementation is available for Dove network search.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent": "DoveNetworkSearch/1.0",
        ...headers
      }
    });
    if (!response?.ok) {
      throw new Error(`HTTP ${response?.status ?? "error"} from ${new URL(url).hostname}`);
    }
    return await response.text();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
async function fetchJson(url, options) {
  const text3 = await fetchText(url, options);
  try {
    return JSON.parse(text3);
  } catch (error) {
    throw new Error(`Invalid JSON response: ${sanitizeError(error)}`);
  }
}
var FILTER_NAMES = Object.freeze(["year", "domains", "fieldsOfStudy", "openAccessOnly", "locale"]);
var PROVIDER_FILTER_SUPPORT = Object.freeze(Object.fromEntries(NETWORK_SEARCH_PROVIDER_REGISTRY.map((provider) => [
  provider.id,
  Object.freeze(Object.fromEntries(FILTER_NAMES.filter((name) => provider.filters?.[name]).map((name) => [name, provider.filters[name]])))
])));
function requestedFilterNames(query) {
  return FILTER_NAMES.filter((name) => name === "openAccessOnly" ? query.openAccessOnly : Array.isArray(query[name]) ? query[name].length > 0 : Boolean(query[name]));
}
function providerFilterPlan(provider, query) {
  const support = PROVIDER_FILTER_SUPPORT[provider.id] ?? {};
  const requested = requestedFilterNames(query);
  return {
    appliedFilters: requested.filter((name) => Boolean(support[name])),
    unsupportedFilters: requested.filter((name) => !support[name]),
    filterModes: Object.fromEntries(requested.filter((name) => Boolean(support[name])).map((name) => [name, support[name]]))
  };
}
function normalizeComparableText(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
function normalizedLocaleBase(value) {
  return normalizeString7(value)?.toLowerCase().replace("_", "-").split("-")[0] ?? null;
}
function candidateMatchesDomain(candidate, domains) {
  const candidateDomains = normalizeStringArray9(candidate.domains).map((domain) => domain.toLowerCase());
  return domains.some((requested) => candidateDomains.some((candidateDomain) => candidateDomain === requested || candidateDomain.endsWith(`.${requested}`)));
}
function candidateMatchesFields(candidate, fieldsOfStudy) {
  const candidateFields = normalizeStringArray9(candidate.fieldsOfStudy).map(normalizeComparableText).filter(Boolean);
  return fieldsOfStudy.some((requested) => {
    const normalized = normalizeComparableText(requested);
    return candidateFields.some((candidateField) => candidateField === normalized || candidateField.includes(normalized) || normalized.includes(candidateField));
  });
}
function postFilterCandidates(candidates, query, filterPlan) {
  const postFilters = new Set(Object.entries(filterPlan.filterModes).filter(([, mode]) => mode === "post").map(([name]) => name));
  return candidates.filter((candidate) => {
    if (postFilters.has("openAccessOnly") && candidate.openAccess !== true) {
      return false;
    }
    if (postFilters.has("year")) {
      const candidateYear = normalizeString7(candidate.publishedAt)?.slice(0, 4);
      if (!candidateYear) {
        return false;
      }
      const [start, end] = query.year.split("-").map((item) => Number(item));
      const year = Number(candidateYear);
      if (year < start || year > (end || start)) {
        return false;
      }
    }
    if (postFilters.has("domains") && !candidateMatchesDomain(candidate, query.domains)) {
      return false;
    }
    if (postFilters.has("fieldsOfStudy") && !candidateMatchesFields(candidate, query.fieldsOfStudy)) {
      return false;
    }
    if (postFilters.has("locale") && normalizedLocaleBase(candidate.locale) !== normalizedLocaleBase(query.locale)) {
      return false;
    }
    return true;
  });
}
function normalizeCandidate(candidate, provider) {
  const title = normalizeTitle(candidate.title);
  if (!title) {
    return null;
  }
  const doi = normalizeDoi2(candidate.doi);
  const url = safeUrl(candidate.url) ?? doiUrl(doi);
  const candidateDomains = normalizeStringArray9(candidate.domains).map((domain) => domain.toLowerCase());
  const urlHostname = hostnameFromUrl(url);
  if (urlHostname) {
    candidateDomains.push(urlHostname);
  }
  if (!url && !doi && !candidate.arxivId && !candidate.pubmedId && !candidate.semanticScholarId) {
    return null;
  }
  return {
    lifecycle: "candidate",
    title,
    url,
    snippet: cleanSnippet(candidate.snippet),
    sourceName: normalizeString7(candidate.sourceName, provider.id),
    publishedAt: normalizeString7(candidate.publishedAt),
    authors: normalizeAuthors(candidate.authors),
    domains: Array.from(new Set(candidateDomains)),
    fieldsOfStudy: normalizeStringArray9(candidate.fieldsOfStudy),
    locale: normalizedLocaleBase(candidate.locale),
    doi,
    arxivId: normalizeString7(candidate.arxivId),
    pubmedId: normalizeString7(candidate.pubmedId),
    semanticScholarId: normalizeString7(candidate.semanticScholarId),
    openAccess: candidate.openAccess === true ? true : candidate.openAccess === false ? false : null,
    providerId: provider.id,
    provenance: {
      providerId: provider.id,
      providerName: provider.id,
      access: provider.access,
      retrievedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    score: Number.isFinite(candidate.score) ? candidate.score : 0,
    warnings: normalizeStringArray9(candidate.warnings)
  };
}
function canonicalUrlKey(value) {
  const url = safeUrl(value);
  if (!url) {
    return null;
  }
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  return parsed.toString().replace(/\/$/u, "").toLowerCase();
}
function titleKey(value) {
  return normalizeString7(value)?.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() ?? null;
}
function dedupeKey(candidate) {
  if (candidate.doi) {
    return `doi:${candidate.doi}`;
  }
  if (candidate.arxivId) {
    return `arxiv:${candidate.arxivId.toLowerCase()}`;
  }
  if (candidate.pubmedId) {
    return `pmid:${candidate.pubmedId}`;
  }
  const url = canonicalUrlKey(candidate.url);
  if (url) {
    return `url:${url}`;
  }
  const title = titleKey(candidate.title);
  return title ? `title:${title}` : null;
}
function textTokens(value) {
  return Array.from(new Set(normalizeComparableText(value).split(/\s+/u).filter(Boolean)));
}
function tokenOverlapScore(value, queryTokens) {
  if (queryTokens.length === 0) {
    return 0;
  }
  const tokens = new Set(textTokens(value));
  return queryTokens.filter((token) => tokens.has(token)).length / queryTokens.length;
}
function publicationRecencyScore(publishedAt) {
  const year = Number(normalizeString7(publishedAt)?.slice(0, 4));
  if (!Number.isInteger(year)) {
    return 0;
  }
  const age = Math.max(0, (/* @__PURE__ */ new Date()).getUTCFullYear() - year);
  return Math.max(0, 10 - age * 0.75);
}
function scoreCandidate(candidate, query) {
  const normalizedQuery = normalizeComparableText(query.query);
  const normalizedTitle = normalizeComparableText(candidate.title);
  const queryTokens = textTokens(query.query);
  const titleOverlap = tokenOverlapScore(candidate.title, queryTokens);
  const snippetOverlap = tokenOverlapScore(candidate.snippet, queryTokens);
  const fieldOverlap = Math.max(0, ...candidate.fieldsOfStudy.map((field) => tokenOverlapScore(field, queryTokens)));
  const authority = Math.min(8, Math.max(0, Number.isFinite(candidate.score) ? candidate.score : 0));
  let score = authority;
  if (normalizedTitle === normalizedQuery) {
    score += 70;
  } else if (normalizedQuery && normalizedTitle.includes(normalizedQuery)) {
    score += 52;
  }
  score += titleOverlap * 42;
  score += snippetOverlap * 20;
  score += fieldOverlap * 16;
  score += publicationRecencyScore(candidate.publishedAt);
  if (candidate.doi || candidate.arxivId || candidate.pubmedId || candidate.semanticScholarId) {
    score += 2;
  }
  if (candidate.url) {
    score += 1;
  }
  if (candidate.openAccess === true) {
    score += 0.5;
  }
  return score;
}
function dedupeAndRank(candidates, query) {
  const byKey = /* @__PURE__ */ new Map();
  for (const candidate of candidates) {
    const key = dedupeKey(candidate);
    if (!key) {
      continue;
    }
    const scored = { ...candidate, score: scoreCandidate(candidate, query) };
    const existing = byKey.get(key);
    if (!existing || scored.score > existing.score) {
      byKey.set(key, {
        ...scored,
        provenance: {
          ...scored.provenance,
          mergedProviderIds: Array.from(new Set([...existing?.provenance?.mergedProviderIds ?? [], existing?.providerId, scored.providerId].filter(Boolean)))
        }
      });
    } else if (existing) {
      existing.provenance.mergedProviderIds = Array.from(new Set([...existing.provenance?.mergedProviderIds ?? [], scored.providerId].filter(Boolean)));
    }
  }
  return Array.from(byKey.values()).sort((left, right) => right.score - left.score || (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "")).slice(0, query.limit);
}
function selectedProviderIds(query, config) {
  if (query.providerIds.length > 0) {
    const conflicts = query.providerIds.filter((id) => !providerVisibleForKind(PROVIDER_BY_ID.get(id), query.kind));
    if (conflicts.length > 0) {
      throw new Error(`Dove network search provider-kind conflict: ${conflicts.join(", ")} cannot be used for kind ${query.kind}.`);
    }
    return query.providerIds;
  }
  if (query.kind === "web") {
    return ["public-web"];
  }
  if (query.kind === "all") {
    return Array.from(/* @__PURE__ */ new Set([...config.defaultProviderIds, "public-web"]));
  }
  return config.defaultProviderIds.filter((id) => PROVIDER_BY_ID.get(id)?.kind === "scholarly");
}
function providerVisibleForKind(provider, kind) {
  return Boolean(provider) && (kind === "all" || provider.kind === kind);
}
function providerReport(provider, fields = {}) {
  return {
    providerId: provider.id,
    kind: provider.kind,
    access: provider.access,
    status: fields.status ?? "available",
    resultCount: fields.resultCount ?? 0,
    fetchedCount: fields.fetchedCount ?? 0,
    message: fields.message ?? null,
    error: fields.error ?? null,
    appliedFilters: fields.appliedFilters ?? [],
    unsupportedFilters: fields.unsupportedFilters ?? [],
    filterModes: fields.filterModes ?? {},
    capabilities: provider.capabilities
  };
}
function publicWebUnavailableReport() {
  const provider = PROVIDER_BY_ID.get("public-web");
  return providerReport(provider, {
    status: "unavailable",
    message: "Dove \u8FD8\u6CA1\u6709\u5185\u7F6E\u7A33\u5B9A\u7684\u514D key \u901A\u7528\u7F51\u9875\u641C\u7D22 provider\uFF1B\u8BF7\u5148\u7528\u5BBF\u4E3B\u516C\u5F00\u641C\u7D22\u6838\u5B9E\u7F51\u9875\uFF0C\u518D\u628A\u9A8C\u8BC1\u8FC7\u7684\u6765\u6E90\u767B\u8BB0\u4E3A source \u6216 note\u3002"
  });
}
async function withTimeout(operation, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function runProvider(provider, query, config, fetchFn) {
  if (provider.unavailable) {
    return {
      candidates: [],
      report: { ...publicWebUnavailableReport(), unsupportedFilters: requestedFilterNames(query) }
    };
  }
  const limit = Math.min(query.limit, provider.maxLimit || query.limit);
  const timeoutMs = normalizePositiveInteger2(config.providerSettings?.[provider.id]?.timeoutMs, config.timeoutMs, 1e3, 6e4);
  const filterPlan = providerFilterPlan(provider, query);
  const needsPostFilter = Object.values(filterPlan.filterModes).includes("post");
  const fetchLimit = needsPostFilter ? Math.min(provider.maxLimit || limit, Math.max(limit, limit * POST_FILTER_OVERFETCH_FACTOR)) : limit;
  const providerQuery = { ...query, limit: fetchLimit };
  try {
    const rawCandidates = await withTimeout(Promise.resolve().then(() => PROVIDER_ADAPTERS[provider.id](providerQuery, { timeoutMs, fetchFn })), timeoutMs);
    const candidates = postFilterCandidates(rawCandidates.map((candidate) => normalizeCandidate(candidate, provider)).filter(Boolean), query, filterPlan).slice(0, limit);
    return {
      candidates,
      report: providerReport(provider, { status: "ok", resultCount: candidates.length, fetchedCount: rawCandidates.length, ...filterPlan })
    };
  } catch (error) {
    return {
      candidates: [],
      report: providerReport(provider, { status: "error", error: sanitizeError(error), message: "Provider search failed.", ...filterPlan })
    };
  }
}
async function searchOpenAlex(query, options) {
  const params = buildParams({
    search: query.query,
    "per-page": query.limit,
    select: "id,doi,title,display_name,publication_year,authorships,open_access,primary_location,locations,primary_topic,topics,language,cited_by_count,abstract_inverted_index"
  });
  if (query.year && !query.year.includes("-")) {
    params.set("filter", `from_publication_date:${query.year}-01-01,to_publication_date:${query.year}-12-31`);
  } else if (query.year) {
    const [start, end] = query.year.split("-");
    params.set("filter", `from_publication_date:${start}-01-01,to_publication_date:${end}-12-31`);
  }
  const json = await fetchJson(`https://api.openalex.org/works?${params.toString()}`, options);
  return Array.isArray(json.results) ? json.results.map((item) => ({
    title: item.title ?? item.display_name,
    url: item.doi ?? item.primary_location?.landing_page_url ?? item.id,
    snippet: abstractFromInvertedIndex(item.abstract_inverted_index) ?? item.primary_location?.source?.display_name,
    sourceName: item.primary_location?.source?.display_name ?? "OpenAlex",
    publishedAt: normalizePublishedAt(item.publication_year),
    authors: Array.isArray(item.authorships) ? item.authorships.map((authorship) => authorship.author?.display_name).filter(Boolean) : [],
    domains: Array.from(new Set([item.primary_location, ...Array.isArray(item.locations) ? item.locations : []].flatMap((location) => [hostnameFromUrl(location?.landing_page_url), hostnameFromUrl(location?.pdf_url)]).filter(Boolean))),
    fieldsOfStudy: Array.from(new Set([item.primary_topic?.display_name, ...Array.isArray(item.topics) ? item.topics.map((topic) => topic?.display_name) : []].filter(Boolean))),
    locale: item.language,
    doi: item.doi,
    openAccess: item.open_access?.is_oa === true,
    score: Number(item.cited_by_count ?? 0) > 0 ? Math.log10(Number(item.cited_by_count) + 1) : 0
  })) : [];
}
function crossrefOpenAccess(item) {
  const links = Array.isArray(item.link) ? item.link : [];
  if (links.some((link) => /^https?:/iu.test(link?.URL ?? "") && /(?:application\/pdf|text\/html)/iu.test(link?.["content-type"] ?? ""))) {
    return true;
  }
  return item.license ? Array.isArray(item.license) ? item.license.length > 0 : true : null;
}
async function searchCrossref(query, options) {
  const params = buildParams({ query: query.query, rows: query.limit, select: "DOI,title,URL,link,license,author,published,published-print,published-online,container-title,abstract,language,is-referenced-by-count" });
  if (query.year && !query.year.includes("-")) {
    params.set("filter", `from-pub-date:${query.year}-01-01,until-pub-date:${query.year}-12-31`);
  } else if (query.year) {
    const [start, end] = query.year.split("-");
    params.set("filter", `from-pub-date:${start}-01-01,until-pub-date:${end}-12-31`);
  }
  const json = await fetchJson(`https://api.crossref.org/works?${params.toString()}`, options);
  const items = json.message?.items;
  return Array.isArray(items) ? items.map((item) => ({
    title: item.title,
    url: item.URL ?? doiUrl(item.DOI),
    snippet: item.abstract ?? item["container-title"]?.[0],
    sourceName: item["container-title"]?.[0] ?? "Crossref",
    publishedAt: normalizePublishedAt(null, item.published?.["date-parts"] ?? item["published-online"]?.["date-parts"] ?? item["published-print"]?.["date-parts"]),
    authors: normalizeAuthors(item.author),
    domains: Array.from(new Set([hostnameFromUrl(item.URL), ...Array.isArray(item.link) ? item.link.map((link) => hostnameFromUrl(link?.URL)) : []].filter(Boolean))),
    locale: item.language,
    doi: item.DOI,
    openAccess: crossrefOpenAccess(item),
    score: Number(item["is-referenced-by-count"] ?? 0) > 0 ? Math.log10(Number(item["is-referenced-by-count"]) + 1) : 0
  })) : [];
}
async function searchArxiv(query, options) {
  const params = buildParams({
    search_query: `all:${query.query}`,
    start: 0,
    max_results: query.limit,
    sortBy: "relevance",
    sortOrder: "descending"
  });
  const xml = await fetchText(`https://export.arxiv.org/api/query?${params.toString()}`, { ...options, headers: { Accept: "application/atom+xml, text/xml;q=0.9" } });
  return Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/giu)).map((match) => {
    const entry = match[1];
    const idUrl = extractXmlText(entry, "id");
    const arxivId = idUrl?.split("/abs/")[1]?.replace(/v\d+$/u, "") ?? null;
    return {
      title: extractXmlText(entry, "title"),
      url: idUrl,
      snippet: extractXmlText(entry, "summary"),
      sourceName: "arXiv",
      publishedAt: extractXmlText(entry, "published")?.slice(0, 10),
      authors: Array.from(entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/giu)).map((author) => decodeXml(author[1])),
      domains: [hostnameFromUrl(idUrl)].filter(Boolean),
      arxivId,
      openAccess: true,
      score: 2
    };
  });
}
async function searchEuropePmc(query, options) {
  const params = buildParams({ query: query.query, format: "json", pageSize: query.limit, resultType: "core" });
  const json = await fetchJson(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params.toString()}`, options);
  const results = json.resultList?.result;
  return Array.isArray(results) ? results.map((item) => {
    const url = item.doi ? doiUrl(item.doi) : item.pmid ? `https://europepmc.org/article/MED/${item.pmid}` : item.pmcid ? `https://europepmc.org/article/PMC/${item.pmcid}` : null;
    return {
      title: item.title,
      url,
      snippet: item.abstractText,
      sourceName: item.journalTitle ?? "Europe PMC",
      publishedAt: normalizePublishedAt(item.firstPublicationDate ?? item.pubYear),
      authors: item.authorList?.author ? normalizeAuthors(item.authorList.author) : normalizeAuthors(item.authorString),
      domains: [hostnameFromUrl(url)].filter(Boolean),
      locale: item.language ?? item.lang,
      doi: item.doi,
      pubmedId: item.pmid,
      openAccess: item.isOpenAccess === "Y" || item.inEPMC === "Y",
      score: Number(item.citedByCount ?? 0) > 0 ? Math.log10(Number(item.citedByCount) + 1) : 0
    };
  }) : [];
}
var PROVIDER_ADAPTERS = {
  openalex: searchOpenAlex,
  crossref: searchCrossref,
  arxiv: searchArxiv,
  "europe-pmc": searchEuropePmc
};
function buildSearchSummary(status, candidates, reports, query) {
  if (!candidates.length) {
    const failedCount = reports.filter((report) => report.status === "error").length;
    const unavailableCount = reports.filter((report) => report.status === "unavailable").length;
    if (query.kind === "web" || unavailableCount === reports.length) {
      return "\u6CA1\u6709\u53EF\u7528\u7684\u514D key \u901A\u7528\u7F51\u9875\u641C\u7D22 provider\uFF1B\u8FD9\u6B21\u6CA1\u6709\u767B\u8BB0\u4EFB\u4F55\u6765\u6E90\u3002";
    }
    if (failedCount > 0) {
      return "\u8FD9\u6B21\u8054\u7F51\u641C\u7D22\u6CA1\u6709\u5F97\u5230\u53EF\u9A8C\u8BC1\u5019\u9009\uFF0C\u5E76\u4E14\u6709 provider \u5931\u8D25\uFF1B\u4E0D\u8981\u628A\u5B83\u5F53\u6210\u5DF2\u5B8C\u6210\u68C0\u7D22\u3002";
    }
    return "\u8FD9\u6B21\u8054\u7F51\u641C\u7D22\u6CA1\u6709\u5F97\u5230\u53EF\u9A8C\u8BC1\u5019\u9009\uFF1B\u4E0D\u8981\u767B\u8BB0\u6765\u6E90\u6216\u751F\u6210 claim\u3002";
  }
  const warningCount = reports.filter((report) => report.status !== "ok").length;
  return warningCount > 0 ? `\u627E\u5230 ${candidates.length} \u4E2A\u5019\u9009\u6765\u6E90\uFF0C\u4F46\u6709 ${warningCount} \u4E2A provider \u4E0D\u53EF\u7528\u6216\u5931\u8D25\u3002` : `\u627E\u5230 ${candidates.length} \u4E2A\u5019\u9009\u6765\u6E90\u3002`;
}
function buildNeedsAttention(status, reports, candidates) {
  const failed = reports.filter((report) => report.status === "error");
  const unavailable = reports.filter((report) => report.status === "unavailable" || report.status === "disabled");
  if (status === "blocked") {
    return {
      status: "blocked",
      summary: "\u6CA1\u6709\u53EF\u9A8C\u8BC1\u5019\u9009\u6765\u6E90\u3002",
      why: unavailable.length > 0 ? unavailable[0].message : failed[0]?.error ?? "\u641C\u7D22\u8FD4\u56DE\u96F6\u7ED3\u679C\u3002",
      needs: ["\u6362\u4E00\u4E2A\u67E5\u8BE2\u8BCD\uFF0C\u6216\u7528\u5BBF\u4E3B\u516C\u5F00\u641C\u7D22\u6838\u5B9E\u7F51\u9875\u540E\u518D\u767B\u8BB0\u6765\u6E90\u3002"]
    };
  }
  if (failed.length > 0 || unavailable.length > 0) {
    return {
      status: "partial",
      summary: "\u90E8\u5206 provider \u6CA1\u6709\u4EA7\u51FA\u3002",
      why: unavailable[0]?.message ?? failed[0]?.error,
      needs: candidates.length > 0 ? ["\u5148\u4EBA\u5DE5\u6253\u5F00\u5019\u9009\u7ED3\u679C\u6838\u5B9E\uFF0C\u518D\u767B\u8BB0\u4E3A source\u3002"] : []
    };
  }
  return null;
}
async function executeNetworkSearch(rawArgs = {}, config = {}, options = {}) {
  const normalizedConfig = normalizeNetworkSearchConfigForCore(config);
  const query = normalizeNetworkSearchQuery(rawArgs, normalizedConfig);
  if (!normalizedConfig.enabled) {
    return {
      status: "blocked",
      summary: "Dove \u8054\u7F51\u641C\u7D22\u5DF2\u5728\u914D\u7F6E\u4E2D\u5173\u95ED\uFF1B\u8FD9\u6B21\u6CA1\u6709\u6267\u884C\u641C\u7D22\u3002",
      scope: { kind: "search", status: "blocked" },
      query,
      candidates: [],
      providerReports: [],
      nextStep: { label: "\u5F00\u542F networkSearch \u540E\u518D\u641C\u7D22\u3002", why: "\u641C\u7D22\u5173\u95ED\u65F6\u4E0D\u80FD\u751F\u6210\u5019\u9009\u6765\u6E90\u3002" },
      needsAttention: { status: "blocked", summary: "\u8054\u7F51\u641C\u7D22\u5173\u95ED\u3002", needs: ["\u542F\u7528\u516C\u5F00 provider \u540E\u91CD\u8BD5\u3002"] },
      showMore: { text: "\u5C55\u5F00\u7ED3\u679C\u53EF\u67E5\u770B\u67E5\u8BE2\u53C2\u6570\u548C provider \u72B6\u6001\u3002" }
    };
  }
  const disabled = new Set(normalizedConfig.disabledProviderIds);
  const providerIds = selectedProviderIds(query, normalizedConfig);
  const selectedProviders = providerIds.map((id) => PROVIDER_BY_ID.get(id)).filter((provider) => provider && providerVisibleForKind(provider, query.kind));
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const providerResults = await Promise.all(selectedProviders.map((provider) => {
    if (disabled.has(provider.id) || normalizedConfig.providerSettings?.[provider.id]?.enabled === false) {
      return { candidates: [], report: providerReport(provider, { status: "disabled", message: "Provider disabled in Dove networkSearch config.", ...providerFilterPlan(provider, query) }) };
    }
    return runProvider(provider, query, normalizedConfig, fetchFn);
  }));
  const providerReports = providerResults.map((result) => result.report);
  const allCandidates = providerResults.flatMap((result) => result.candidates);
  const candidates = dedupeAndRank(allCandidates, query);
  const status = candidates.length > 0 ? "ok" : "blocked";
  return {
    status,
    summary: buildSearchSummary(status, candidates, providerReports, query),
    scope: { kind: "search", status, currentFocus: query.query },
    query,
    candidates,
    providerReports,
    nextStep: {
      label: candidates.length > 0 ? "\u6253\u5F00\u5019\u9009\u6765\u6E90\u6838\u5B9E\u6807\u9898\u3001DOI \u548C\u539F\u6587\u3002" : "\u6362\u67E5\u8BE2\u8BCD\u6216\u6539\u7528\u5BBF\u4E3B\u516C\u5F00\u641C\u7D22\u6838\u5B9E\u3002",
      why: "\u8054\u7F51\u641C\u7D22\u53EA\u4EA7\u51FA\u5019\u9009\uFF0C\u4E0D\u80FD\u76F4\u63A5\u767B\u8BB0\u6765\u6E90\u6216\u751F\u6210 claim\u3002",
      requiredActions: candidates.length > 0 ? ["\u6838\u5B9E\u5019\u9009\u6765\u6E90", "\u628A\u9A8C\u8BC1\u8FC7\u7684\u6765\u6E90\u4EA4\u7ED9 source/note/evidence \u6D41\u7A0B"] : ["\u91CD\u65B0\u68C0\u7D22\u6216\u63D0\u4F9B\u53EF\u9A8C\u8BC1 URL"]
    },
    needsAttention: buildNeedsAttention(status, providerReports, candidates),
    showMore: { text: "\u5C55\u5F00\u7ED3\u679C\u53EF\u67E5\u770B\u5019\u9009\u5217\u8868\u548C provider \u72B6\u6001\uFF1B\u9ED8\u8BA4 compact \u4E0D\u5C55\u793A\u539F\u59CB\u8FD4\u56DE\u3002" },
    diagnostics: {
      providerCount: providerReports.length,
      candidateCountBeforeDedupe: allCandidates.length,
      fetchedCount: providerReports.reduce((sum, report) => sum + report.fetchedCount, 0),
      appliedFilters: Array.from(new Set(providerReports.flatMap((report) => report.appliedFilters))),
      unsupportedFilters: Array.from(new Set(providerReports.flatMap((report) => report.unsupportedFilters)))
    }
  };
}
async function searchNetwork(root, args = {}, env = process.env, options = {}) {
  return executeNetworkSearch(args, loadNetworkSearchConfig(root, env), options);
}
function providerStatus(provider, config) {
  const disabled = new Set(config.disabledProviderIds);
  if (provider.unavailable) {
    return publicWebUnavailableReport();
  }
  if (!config.enabled || disabled.has(provider.id) || config.providerSettings?.[provider.id]?.enabled === false) {
    return providerReport(provider, { status: "disabled", message: "Provider disabled by Dove networkSearch config." });
  }
  return providerReport(provider, { status: "available" });
}
function queryNetworkSearchProviders(root, args = {}, env = process.env) {
  const config = normalizeNetworkSearchConfigForCore(loadNetworkSearchConfig(root, env));
  const kind = normalizeString7(args.kind, "all").toLowerCase();
  if (!SEARCH_KINDS.has(kind)) {
    throw new Error(`Dove network search kind must be one of: ${Array.from(SEARCH_KINDS).join(", ")}.`);
  }
  const requestedIds = normalizeProviderIds(args.providerIds ?? args.providers);
  const conflicts = requestedIds.filter((id) => !providerVisibleForKind(PROVIDER_BY_ID.get(id), kind));
  if (conflicts.length > 0) {
    throw new Error(`Dove network search provider-kind conflict: ${conflicts.join(", ")} cannot be used for kind ${kind}.`);
  }
  const providers = NETWORK_SEARCH_PROVIDER_REGISTRY.filter((provider) => requestedIds.length === 0 || requestedIds.includes(provider.id)).filter((provider) => providerVisibleForKind(provider, kind));
  const providerReports = providers.map((provider) => providerStatus(provider, config));
  const availableCount = providerReports.filter((report) => report.status === "available").length;
  const unavailableCount = providerReports.filter((report) => report.status !== "available").length;
  return {
    status: availableCount > 0 ? "ok" : "blocked",
    summary: availableCount > 0 ? `\u5F53\u524D\u6709 ${availableCount} \u4E2A\u516C\u5F00\u514D key \u641C\u7D22 provider \u53EF\u7528\u3002` : "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u7684\u516C\u5F00\u514D key \u641C\u7D22 provider\u3002",
    scope: { kind: "search", status: availableCount > 0 ? "ok" : "blocked" },
    providers: providerReports,
    defaultProviderIds: config.defaultProviderIds,
    nextStep: {
      label: availableCount > 0 ? "\u76F4\u63A5\u7528\u641C\u7D22\u5DE5\u5177\u53D1\u73B0\u5019\u9009\u6765\u6E90\u3002" : "\u542F\u7528\u516C\u5F00 provider \u6216\u7528\u5BBF\u4E3B\u516C\u5F00\u641C\u7D22\u6838\u5B9E\u3002",
      why: "Dove \u53EA\u5185\u7F6E\u514D key provider\uFF1B\u641C\u7D22\u7ED3\u679C\u4ECD\u9700\u4EBA\u5DE5\u6838\u5B9E\u540E\u518D\u8FDB\u5165\u8BC1\u636E\u94FE\u3002"
    },
    needsAttention: unavailableCount > 0 ? {
      status: availableCount > 0 ? "partial" : "blocked",
      summary: `${unavailableCount} \u4E2A provider \u4E0D\u53EF\u7528\u6216\u5173\u95ED\u3002`,
      needs: ["\u4E0D\u8981\u628A\u4E0D\u53EF\u7528 provider \u5F53\u6210\u5DF2\u68C0\u7D22\u5B8C\u6210\u3002"]
    } : null,
    showMore: { text: "\u5C55\u5F00\u7ED3\u679C\u53EF\u67E5\u770B provider \u80FD\u529B\uFF1B\u9ED8\u8BA4 compact \u4E0D\u5C55\u793A\u5185\u90E8\u5B57\u6BB5\u3002" }
  };
}
export {
  ARTIFACT_PATHS,
  AUTONOMY_ALLOWED_STEP_TYPES,
  DEFAULT_DOVE_RESPONSE_LANGUAGE,
  DEFAULT_NETWORK_SEARCH_PROVIDER_IDS2 as DEFAULT_NETWORK_SEARCH_PROVIDER_IDS,
  DOVE_AUDIO_CONTEXT_POLICY,
  DOVE_DOCUMENT_EVIDENCE_SCOPES,
  DOVE_DOCUMENT_KINDS,
  DOVE_DOCUMENT_STATUSES,
  DOVE_DOMAIN_GUIDANCE,
  DOVE_DOMAIN_IDS,
  DOVE_MISSION_LIFECYCLE_STAGES,
  DOVE_PRIMARY_ROLES,
  DOVE_PRIMARY_ROLE_IDS,
  DOVE_RESPONSE_LANGUAGES,
  DOVE_TASK_CREATOR_KINDS,
  DOVE_TASK_DOMAINS,
  DOVE_TASK_STAGES,
  DOVE_TASK_STATUSES,
  DOVE_WORKFLOW_KERNEL_VERSION,
  GOVERNANCE_EXEMPT_MUTATIONS,
  GOVERNANCE_GUARDED_MUTATIONS,
  GOVERNANCE_NEGATIVE_COVERAGE,
  GOVERNANCE_READONLY_COMMANDS,
  GOVERNANCE_READONLY_TOOLS,
  NETWORK_SEARCH_PROVIDER_REGISTRY,
  PAPER_LIFECYCLE_FAMILIES,
  PAPER_LIFECYCLE_FAMILY_BY_ID,
  PAPER_LIFECYCLE_FAMILY_IDS,
  PAPER_LIFECYCLE_TAXONOMY_VERSION,
  PAPER_MAJOR_CHANGE_PROTOCOL_STAGES,
  PAPER_MAJOR_CHANGE_SIGNALS,
  PIPELINE_STAGE_ORDER,
  SCHEMA_VERSION,
  SOURCE_LIFECYCLE_STATES,
  WORKFLOW_GOAL_CONTRACTS,
  WorkflowGoalValidationError,
  analyzeArtifactConsistency,
  artifactEvidenceRole,
  assertEligibleSourceReferences,
  assertNoInlineSecrets,
  assertResolvedTaskPacket,
  assertTaskScopedMutationTarget,
  buildDoveGlobalPublicStatus,
  buildGlobalStatusServingPlan,
  buildIntentFrame,
  buildPreActionGuidance,
  buildWorkflowFrame,
  canonicalSourceIdentity,
  classifyWorkflowIntent,
  compactPreActionLesson,
  completionEvidenceIntegrity,
  createDefaultSettings,
  createDefaultState,
  createDocumentLedgerIndex,
  createDoveAuthorityManifest,
  createDoveWorkspaceKernel,
  createMutationProvenanceIndex,
  createStaticGlobalStatusServer,
  doveText,
  evaluateEvidence,
  evaluateSourceReferences,
  evidencePathProblemFlags,
  executeNetworkSearch,
  extractCitationKeysFromText,
  getGovernanceMutationEntry,
  inferPrimaryRoleForSurface,
  inferSubagentSpecialty,
  inspectDeclaredPath,
  inspectPathEvidence,
  inspectProjectArtifact,
  isBookkeepingArtifactPath,
  isDoveChinese,
  isExternalArtifactReference,
  isOperationalFailureOutcome,
  isProposalOnlyOutcome,
  loadDoveConfig,
  loadDoveLanguageConfig,
  loadExplicitDoveLanguageConfig,
  loadFigureGenerationConfig,
  loadNetworkSearchConfig,
  normalizeAudioIsolationSettings,
  normalizeAutoSettings,
  normalizeAutonomyAllowedStepType,
  normalizeDocumentLedgerIndex,
  normalizeDoveAuthorityManifest,
  normalizeDoveDomainId,
  normalizeDoveMissionLifecycleStage,
  normalizeDoveResponseLanguage,
  normalizeGlobalStatusAuthConfig,
  normalizeGlobalStatusCloudflareConfig,
  normalizeGlobalStatusProjects,
  normalizeMutationProvenanceIndex,
  normalizeNetworkSearchConfig,
  normalizeNetworkSearchQuery,
  normalizeProjectRelativePath,
  normalizeReviewLoopSettings,
  normalizeSettings,
  normalizeState,
  normalizeTaskModelSettings,
  normalizeTaskPacketId,
  normalizeTaskTargetResolutionSettings,
  nowIso,
  queryDocumentLedger,
  queryDoveAudit,
  queryDoveMission,
  queryDoveMissionBoard,
  queryDoveOnboarding,
  queryDoveOrchestrate,
  queryDoveReturn,
  queryDoveStatus,
  queryNetworkSearchProviders,
  queryPaperAudit,
  queryPaperPipeline,
  querySources,
  readJson,
  readSourceTrustState,
  readTaskPacketCatalog,
  readTaskTargetResolutionSettings,
  readText,
  redactDoveConfig,
  resolveDoveGlobalStatusOutputDir,
  resolveDoveResponseLanguage,
  resolveDurableTaskPacket,
  resolvePath,
  runGlobalStatusServingForeground,
  searchNetwork,
  selectPreActionLessons,
  sourceEligibility,
  sourceIdentityFingerprint,
  sourceReferenceMap,
  summarizePathInspections,
  summarizePreActionGuidance,
  validateGlobalPublicServeRoot,
  validateWorkflowGoalContracts,
  validateWorkflowGoals
};
