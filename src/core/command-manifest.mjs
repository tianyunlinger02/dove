export const CORE_INSTALL_PATHS = [
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

export const DEFAULT_HOST_ADAPTERS = ["opencode"];

export const PROJECT_HOST_IDS = ["opencode", "codex", "cursor", "agents"];

export const USER_HOST_IDS = ["claude"];

export const HOST_IDS = [...PROJECT_HOST_IDS, ...USER_HOST_IDS];

export const HOST_DEFINITIONS = {
  opencode: { label: "OpenCode", scope: "project", jsonChecks: [".opencode.json"] },
  codex: { label: "Codex", scope: "project", jsonChecks: [] },
  cursor: { label: "Cursor", scope: "project", jsonChecks: [] },
  agents: { label: "Shared agent skills", scope: "project", jsonChecks: [] },
  claude: { label: "Claude Code user commands", scope: "user", jsonChecks: [] }
};

export const MANAGED_HOST_ADAPTER_PATHS = {
  opencode: [".opencode/commands/dove*.md", ".opencode/skills/dove-*", ".opencode.json"],
  codex: [".codex/skills/dove-*"],
  cursor: [".cursor/commands/dove-*.md"],
  agents: [".agents/skills/dove-*", "AGENTS.md"]
};

export const MANAGED_PACKAGE_PATHS = [
  ".opencode/commands/dove*.md",
  ".opencode/skills/dove-*",
  ".opencode.json",
  ".codex/skills/dove-*",
  ".cursor/commands/dove-*.md",
  ".agents/skills/dove-*",
  "AGENTS.md",
  ...CORE_INSTALL_PATHS
];

export const OPENCODE_ROLE_SKILL_PATHS = [
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

export const COMMAND_BASE_CONTEXT_PATHS = [
  ".dove/context/actions/current.json",
  ".dove/workspace/index.json",
  ".dove/config.json",
  ".dove/config.local.json",
  ".dove/state.json"
];

export const TOOL_CONTEXT_PATHS = {
  init_dove_goal: [".dove/state.json", ".dove/task-packets/index.json"],
  create_dove_task: [".dove/state.json", ".dove/task-packets/index.json", ".dove/meta/operator-lessons.json"],
  record_dove_mission_pass: [".dove/state.json", ".dove/task-packets/index.json", ".dove/runtime", ".dove/meta/operator-lessons.json"],
  apply_dove_status_adjustments: [".dove/state.json", ".dove/task-packets/index.json"],
  run_dove_auto: [".dove/state.json", ".dove/task-packets/index.json", ".dove/runtime", ".dove/meta/operator-lessons.json"],
  run_dove_operator: [".dove/state.json", ".dove/task-packets/index.json", ".dove/runtime", ".dove/meta/operator-lessons.json"],
  kill_dove_task: [".dove/task-packets/index.json"],
  reset_dove_version: [".dove/state.json", ".dove/task-packets/index.json", ".dove/versions", ".dove/meta/operator-lessons.json"],
  run_experience_workflow: [".dove/experiments", ".dove/claims", ".dove/evidence/index.json", ".dove/task-packets/index.json"],
  run_audio_review: [".dove/audio/reviews", ".dove/task-packets/index.json", ".dove/reviews"],
  run_dove_review_loop: [".dove/reviews", ".dove/revision-plans", ".dove/drafts", ".dove/experiments", ".dove/task-packets/index.json"],
  query_dove_orchestrate: [".dove/workspace/index.json", ".dove/orchestration/board.json"],
  query_dove_mission: [".dove/workspace/index.json"],
  query_dove_mission_board: [".dove/orchestration/board.json", ".dove/task-packets/index.json"],
  query_dove_status: [".dove/state.json", ".dove/task-packets/index.json", ".dove/workspace/index.json", ".dove/orchestration/board.json", ".dove/meta/operator-lessons.json"],
  query_dove_audit: [".dove/task-packets/index.json", ".dove/runtime/controller-state.json"],
  query_dove_return: [".dove/task-packets/index.json", ".dove/runtime/controller-state.json"],
  launch_dove_mission: [".dove/meta/operator-follow-through.json", ".dove/task-packets/index.json"],
  query_task_graph: [".dove/task-packets/index.json", ".dove/context/packets"],
  sync_checklist: [".dove/checklists/current.md", ".dove/task-packets/index.json"],
  materialize_guidance_packet: [".dove/meta/operator-follow-through.json", ".dove/meta/remediation-packs.json", ".dove/task-packets/index.json"],
  query_governance_coverage_report: [".dove/meta/governance-coverage.json"],
  upsert_plan: [".dove/plans", ".dove/checklists/current.md"],
  query_program_approvals: [".dove/programs/approvals.json", ".dove/runtime/controller-state.json"],
  revoke_program_approval: [".dove/programs/approvals.json"],
  init_project: [".dove/state.json", ".dove/manifest.json"],
  update_research_brief: [".dove/research/brief.md", ".dove/research/agenda.json"],
  query_sources: [".dove/sources/index.json", ".dove/sources/verifications.json"],
  register_source: [".dove/sources/index.json"],
  verify_source: [".dove/sources/index.json", ".dove/sources/verifications.json"],
  upsert_note: [".dove/notes/index.json", ".dove/sources/index.json"],
  upsert_claims: [".dove/evidence/index.json", ".dove/claims/CLAIMS_FROM_RESULTS.md"],
  upsert_outline: [".dove/outline.md", ".dove/plans"],
  upsert_draft: [".dove/drafts", ".dove/evidence/index.json"],
  set_section_status: [".dove/state.json", ".dove/drafts"],
  query_paper_audit: [".dove/evidence/index.json", ".dove/drafts", ".dove/reviews", ".dove/experiments"],
  query_dove_onboarding: ["project root", ".dove/workspace/artifact-map.json"],
  query_paper_pipeline: [".dove/state.json", ".dove/workspace/index.json", ".dove/orchestration/board.json", ".dove/task-packets/index.json", ".dove/reviews", ".dove/experiments", ".dove/versions", ".dove/checklists/current.md"],
  append_review_log: [".dove/reviews/log.json", ".dove/reviews/concerns.json"],
  run_review_loop: [".dove/reviews", ".dove/revision-plans", ".dove/evidence/index.json"],
  prepare_isolated_review: [".dove/reviews/isolated", ".dove/workspace/index.json", ".dove/orchestration/board.json"],
  import_isolated_review: [".dove/reviews/isolated", ".dove/reviews/concerns.json", ".dove/reviews/log.md", ".dove/orchestration/handoffs.md"],
  upsert_revision_plan: [".dove/revision-plans", ".dove/reviews"],
  normalize_rebuttal_issues: [".dove/rebuttal/issues.json"],
  build_rebuttal_strategy: [".dove/rebuttal/issues.json", ".dove/rebuttal/strategy.md"],
  build_rebuttal: [".dove/rebuttal"],
  sync_citations: [".dove/bibliography", ".dove/sources/index.json"],
  upsert_figure_plan: [".dove/figures"],
  run_figure_workflow: [".dove/figures", ".dove/figures/materials.json", ".dove/figures/generations.json", ".dove/figures/captions.json", ".dove/figures/qa.json", ".dove/task-packets/index.json"],
  prepare_figure_generation: [".dove/figures", ".dove/figures/materials.json", ".dove/figures/generations.json", ".dove/task-packets/index.json"],
  import_figure_generation: [".dove/figures", ".dove/figures/generations.json", ".dove/figures/captions.json", ".dove/figures/qa.json", ".dove/task-packets/index.json"],
  validate_figure_pipeline: [".dove/figures/qa.json", ".dove/figures"],
  upsert_experiment_plan: [".dove/experiments/plans.json"],
  upsert_experiment_result: [".dove/experiments/results.json"],
  run_experiment_audit: [".dove/experiments/audits.json", ".dove/experiments/results.json"],
  bridge_result_to_claim: [".dove/claims/bridge-log.json", ".dove/experiments/results.json"],
  create_version_snapshot: [".dove/versions"],
  compare_versions: [".dove/versions"],
  query_open_questions: [".dove/wiki/navigation.md", ".dove/reviews/concerns.json"],
  query_decisions: [".dove/wiki/navigation.md", ".dove/versions"],
  query_lineage: [".dove/versions"],
  query_meta_optimize: [".dove/meta", ".dove/workspace/index.json"],
  query_operator_lessons: [".dove/meta/operator-lessons.json"],
  record_operator_lesson: [".dove/meta/operator-lessons.json"],
  query_operator_follow_through: [".dove/meta/operator-follow-through.json"],
  record_operator_follow_through: [".dove/meta/operator-follow-through.json"],
  refresh_wiki: [".dove/wiki", ".dove/sources/index.json", ".dove/notes/index.json"]
};

const TASK_SCOPED_WRITE_TOOL_IDS = new Set([
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

const TASK_SCOPED_WRITE_CONSTRAINTS = [
  "Before any task-scoped write, resolve the operator's target to an existing durable `.dove/task-packets` packet; never use the latest-created packet as the only implicit target.",
  "If no explicit packetId, natural-language target, or linked artifact is supplied and more than one packet candidate exists, stop and use confirmation UX before writing.",
  "If target resolution is ambiguous or multiple candidates share the top confidence, use confirmation UX to select a packet; `.dove/state.json.settings.taskTargetResolution.autoSelect` may only select a unique high-confidence candidate.",
  "Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets."
];

const AGENT_WORKFLOW_CONSTRAINTS = [
  "Use status first only for Dove state, next-step, blocker, task-choice, or task-binding questions; for fix, implement, research, verify, write, review, experiment, or figure prompts, start by producing or inspecting substantive material and use status only as supporting context.",
  "For ordinary prompts that ask to bind, save, deposit, archive, or 沉淀 results to a main task, resolve the durable packet first, register external URLs/templates/guidelines as packet-bound sources, then synthesize internal findings through `upsert_note` or `record_document_evidence` instead of treating the synthesis as an external source.",
  "When reporting research or venue results, separate snapshot-backed or registered sources from candidate links, blocked retrieval candidates, and internal notes/documents; do not put unverified candidates under a generic `Sources:` list.",
  "When work depends on current external information, public web material, provider/tool documentation, scholarly discovery, venue policy, or ecosystem behavior, run a visible bounded search or retrieval step first; use Dove's read-only public no-key network search tools when available, and treat returned items as candidates until verified.",
  "Do not let durable packets, status navigation, receipts, validators, or evidence ledgers substitute for real progress; before bookkeeping, produce or inspect a substantive artifact such as literature synthesis, experiment execution, baseline analysis, result interpretation, claim stress test, draft content, review finding, or code/test evidence.",
  "Treat `preActionGuidance` as read-only guidance that automatically recalls applicable lessons from `.dove/meta/operator-lessons.json`; recording lessons remains explicit through `/dove:lessons` and `record_operator_lesson` only.",
  "Frame work through Planner, Builder, and Reviewer primary roles; researcher, experiment-planner, revision-lead, rebuttal-lead, version-analyst, and review-loop are subagents/modes under those roles, not public slash surfaces.",
  "Planner output must be executable: every new or plan-derived mission needs canonical `executionContract.action`, `implementation`, `convergence.criteria`, and `failureRoutes`; do not invent substitute child missions or infer child work from the parent title when explicit child mission details are missing.",
  "Builder completion requires a result summary plus real evidence/artifact/validation/verification paths and `verifiedCriteria` that covers every `executionContract.convergence.criteria` item; read-only status, summary-only output, or unknown step status must not mark work complete.",
  "Reviewer and audit work may inspect evidence and record explicit review state, but must stay read-only with respect to Builder outputs unless an operator explicitly asks to record review/revision artifacts.",
  "Treat status as the project command center and mission as a durable work contract/progress object; rank missing executable contracts, missing source/material inputs, ready Builder execution, verification gaps, reviewer/audit needs, and reconciliation above optional mission details.",
  "Dove `.dove/` durable state participates in host rollback only through host-tracked file edits: request `mutationMode: \"patch-plan\"`, inspect the returned operations, and apply them with the host's tracked file-edit mechanism. Direct CLI/MCP `direct-process` writes remain functional but rollback-unverified; git presence is not proof, and host rollback must not be routed through `reset_dove_version`.",
  "Never create hidden runtime, scheduler, daemon, background continuation, or unconfirmed writes; auto/operator/mission execution remains explicit bounded foreground work."
];

const COMMAND_SURFACES_BASE = [
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
    constraints: ["Use the same demand-to-task intake and classification model as `/dove:mission` before autonomous execution starts.", "Allow `/dove:auto` to be invoked directly on a new user demand or an existing durable task; it does not require running `/dove:mission` first.", "Return a proposal-only auto contract first: either a converted `proposedTask` with checklist proposal and executable `executionContract`, or a `selectedTask` from durable packet selection with current contract readiness, plus compact task/auto cards, confirmation args, and max iteration budget.", "Use interactive confirmation controls when the host supports them (for example Claude Code AskUserQuestion) before passing `confirmed: true`; options should approve and run bounded auto, adjust target/contract, or cancel.", "When an existing task target is missing or ambiguous, present indexed packet choices through confirmation UX instead of guessing.", "Require explicit operator confirmation before execution beyond task creation or selection.", "Run in the current foreground call only; do not schedule background or daemon continuation after the response ends.", "Use `.dove/state.json.settings.auto.maxIterations` as the default foreground iteration limit; the default is 3.", "Record each foreground iteration and stop reason in `.dove/runtime/results.json`, and return a localized `resultCard` summary without persisting the UX-only card in runtime results.", "May internally call public Dove workflows such as source, note, experience, figure, draft, review, review-loop, rebuttal, lessons, and status as needed.", "For source-research and current-information tasks, run the foreground search or retrieval pass before confirmed execution: use read-only public no-key network search when available, collect concrete URLs/DOIs/templates/guidelines, extract enough synthesis text, then call confirmed `run_dove_auto` once with explicit `steps` for both `dove.source` and `dove.note` so provenance and synthesis are deposited in the same auto run.", "Do not claim source research succeeded when Dove network search, host search, or fetch tools return zero results, unavailable providers, safety errors, or no concrete URLs/snippets; switch to another allowed foreground retrieval path or stop at an explicit host boundary." , "If host search/fetch/shell/MCP safety classification or tool availability fails before Dove can perform the intended workflow, call `record_dove_mission_pass` for the packet with `resultStatus: \"blocked\"`, `boundaryType: \"host-tool-blocked\"`, the failed tool in `requiredActions`, and `nextAction: \"project:dove.status\"`; do not leave the task in-progress.", "Do not call confirmed `run_dove_auto` with only a packet id for source-research tasks; that only records a `source-requires-host-provenance` boundary and does not advance the research.", "Do not auto-run source, note, draft, experience, or review-loop steps without the material they need: source needs title/locator provenance, note needs synthesis content, draft needs body content, experience needs a goal/title/idea/experimentId, and review-loop needs packet-owned substantive review artifacts.", "Stop at completed, blocked, killed, authority/review boundary, missing provider credentials, conflicting packet target, or step-budget exhaustion.", "When a boundary is reached, persist the first-class boundary with required inputs/actions, role handoff, and next command; do not continue through hidden background work.", "Do not claim host/code/provider/experiment work was completed without real evidence, verification evidence, and `verifiedCriteria` coverage for the executable contract; stop at an awaiting-host/provider, missing-materials, or verification-failed boundary instead."]
  },
  {
    id: "dove.status",
    title: "Dove status",
    domain: "generic",
    category: "mutation",
    policy: "explicit-approval",
    summary: "Show a natural Dove status home that explains the current situation, the smallest useful next action, and how to expand only when needed.",
    requiredTools: ["query_dove_status", "apply_dove_status_adjustments"],
    constraints: ["Use status as the unified whole-project situation home; do not expose separate plan, checklist, audit, return, orchestration, missions, board, or list slash surfaces.", "First call `query_dove_status` without `detail: \"full\"` to obtain the compact read-only Dove project situation home, but do not present saved `.dove/` files as the live development situation. Explain the live development situation from host-visible context first: current user request, current session work, known worktree state when available, latest validation/test evidence, active implementation blockers, and what was just completed or is still pending. If live context was not inspected, say which live checks were skipped in ordinary terms such as tests, worktree, or manual artifacts; do not name `.dove/`, durable context, MCP/schema fields, or storage files in the default answer.", "When MCP tools are unavailable and you must inspect `.dove/` files directly, synthesize the same compact public situation home instead of narrating the file schema: translate fields and tool ids into user actions such as provide or import the SVG, rerun figure validation, import the reviewer handoff, or record the experiment result. Default prose should say saved project state or standing guidance instead of `.dove/`, durable state, lessons, context files, or schema names.", "Keep `query_dove_status` read-only: it must return `proposalOnly: true`, `noAutoApply: true`, and `writes: []`.", "Keep durable rollback, boundary, gap, runtime, provider, artifact-path, and schema-field diagnostics in full/debug expansion; default compact status should describe the practical situation instead of printing internal governance or storage fields, and should translate internal figure-check records into current-figure review issues.", "Use compact `statusHome` as a public situation contract: `headline`, `scope`, `currentContext`, `nextStep`, `needsAttention`, `changes`, `showMore`, and explicit expansion handles. Render those fields as natural action guidance, not as a fixed heading template or a debug dump.", "Do not make mission lists, packet ids, phase ids, role labels, version ids, boundary/gap codes, blocked counts, execution-gap counts, repair-frontier names, route strings such as `project:dove.source`, raw artifact fields such as `sourceSvgPath`/`finalSvgPath`, low-level tool ids such as `validate_figure_pipeline`, claim-bridge jargon, or required-evidence blocks the default body of `/dove:status`; default status must answer `what should I do next?` with one recovery or continuation action, and `statusHome.optionalMissionDetails` remains collapsed unless the operator explicitly asks for `show current missions`, `有哪些 mission`, `--missions`, `showMissions`, or `includeMissionDetails`.", "For normal mission-list prompts, call compact `query_dove_status` with `showMissions: true` or `includeMissionDetails: true` and expand `statusHome.optionalMissionDetails`; do not add or require `/dove:missions`, `/dove:board`, `/dove:list`, and do not route mission-list questions to `/dove:mission`.", "Treat `query_dove_mission_board` as a low-level MCP/debug board, not the default host route for ordinary mission-list prompts.", "Do not read a saved full status result file or request `detail: \"full\"` unless the operator explicitly asks to expand/debug full details.", "When `statusHome.blockersAndReconciliation.completionConsistency.status` is `needs-reconciliation`, present it as a legacy consistency issue: a done parent mission still has open checklist children. Do not recommend blanket-marking children done/completed; say to verify child evidence first, then either mark covered children done through confirmed status adjustment or reopen the parent mission.", "Use compact `nextStep` and `needsAttention` for the default explanation; read `actionableBoundaries`, `boundaryActionCards`, durable context, and current boundary metadata only in full/debug or when the operator asks for details.", "Use compact cards for status adjustment previews when available. Do not print raw internal dumps such as raw status-count objects, recent completed mission recaps, or recent killed mission recaps; if showing optional mission details, keep the `done` group collapsed unless the operator asks to expand it.", "Boundary types are first-class metadata, not machine status choices; keep status choices exactly `[\"pending\", \"ready\", \"in-progress\", \"blocked\", \"completed\", \"killed\", \"archived\"]`; `archived` is a cleanup lifecycle state, not deletion.", "When the host supports interactive confirmation controls, do not ask whether to modify mission statuses during default `/dove:status`; use a single confirmation dialog only when the operator clearly asks to change states or calls `query_dove_status` with `requestStatusAdjustment`/`includeStatusAdjustmentPreview`; build compact adjustment cards from adjustable missions excluding `completed`, `killed`, and `archived`; do not paginate by mission count or collect choices across multiple dialogs.", "The single confirmation dialog must provide a no-change path and a change/provide-adjustment-details path; if the operator does not provide parseable `packetId -> status` adjustments in that single dialog, do not call a mutation tool and instead ask for a clear adjustment format.", "For status adjustment choices, preserve exactly `[\"pending\", \"ready\", \"in-progress\", \"blocked\", \"completed\", \"killed\", \"archived\"]` as the machine status enum; default status hides archived missions and `includeArchived` may show archived counts/details without deleting evidence.", "Only call `apply_dove_status_adjustments` with `confirmed: true` after that single dialog yields explicit operator-confirmed status adjustments, then show the localized `resultCard` summary.", "Killing a mission is now a status choice in this UX, not a standalone public slash command."]
  },
  {
    id: "dove.operator",
    title: "Dove operator",
    domain: "generic",
    category: "mutation",
    policy: "explicit-approval",
    summary: "Run one approved operator pass over safe built-in steps, explicit results, and optional blocker-investigation planning.",
    requiredTools: ["run_dove_operator"],
    constraints: ["First call `run_dove_operator` without confirmation to return the proposal-only execution contract with compact `queueSummary`, small `queuePreview`, and `writes: []`; do not request full queue arrays unless the operator explicitly asks for `includeQueueDetails: true`.", "Use interactive confirmation controls when the host supports them before passing `confirmed: true`.", "Run in the current foreground call only; do not schedule background or daemon continuation after the response ends.", "For ready and in-progress missions, run one safe internal workflow step when available or collect one real host pass result in order; pass per-task results to `run_dove_operator` with evidence, verificationEvidencePaths, and verifiedCriteria so Dove records lifecycle and runtime state only when the executable contract is covered.", "Do not claim real engineering, paper, or experiment work happened when neither a safe internal step nor an actual host pass result exists; host-pass-required missions without taskResults must remain unchanged, and host results without convergence coverage must become explicit verification/material boundaries with no fake execution.", "When no safe internal step, missing step material, or actual host pass result exists, do not persist an `awaiting-host-pass-result` boundary just to show activity; return the material-specific requiredActions and keep durable writes empty unless another real operator action occurred.", "If a host-side search/fetch/shell/MCP safety classifier or tool-availability failure prevents collecting the pass result, pass a blocked task result with boundaryType `host-tool-blocked` and requiredActions naming the failed host tool instead of leaving the mission in-progress.", "Preserve durable role handoff metadata while running queue passes; do not expose planner/builder/reviewer as separate slash commands.", "For blocked missions, default to proposal-only blocker-investigation guidance and do not write child missions; create pending child investigation plan missions only when the operator explicitly requests `blockerInvestigationMode: \"create\"` or `createBlockedInvestigations: true`, then report created and reused counts separately in the localized `resultCard` summary."]
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
    constraints: ["Treat source as external information intake, not internal note consolidation; pressure-test summaries and writing-style synthesis belong in note or document evidence.", "Use `register_source` with `sources: [...]` for batch provenance capture when the operator provides multiple URLs/templates/guidelines at once.", "When current public information or scholarly discovery is needed, use read-only public no-key network search or visible retrieval to find candidates first, then verify title, locator, DOI/URL, source identity, and citation details before registration.", "Dove network search results are candidate material, not durable source evidence; snippets alone must not become registered sources or claims.", "Never call `register_source` with only a packet id; every new source must include a real title or locator, and source-research auto runs must collect those URLs/templates/guidelines before writing.", "Treat host search output such as `Did 0 searches`, zero results, empty result sets, or unavailable search as a hard retrieval failure; do not describe it as finding official sources, and do not infer locators from memory or prior transcript context.", "Do not call `register_source` when search/fetch returned zero results, safe-domain verification failed, retrieval was blocked, or a network search provider reports unavailable; record or surface a `host-tool-blocked` boundary until verifiable source evidence exists.", "If the host denies or blocks the boundary-recording mutation, stop and report that no durable source or boundary update was written; do not retry another mutating Dove call such as patch-plan without explicit operator approval.", "Use explicit configured providers or operator-provided material; do not hide network/provider calls.", "Link each source to the resolved durable task packet through packetIds.", "Treat source and source-verification JSON ledgers as bookkeeping, not completion artifacts; use typed source:<id> completion evidence only when the latest verification decision is verified and both fingerprint and packet binding match.", "For reviewer-guideline or 审稿偏好 research, stay in Builder/researcher source intake unless the operator asks for an independent audit of an artifact."]
  },
  {
    id: "dove.note",
    title: "Dove note",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Organize task-bound internal synthesis from registered sources, existing materials, pressure-test results, and operator notes for the selected task.",
    requiredTools: ["upsert_note"],
    constraints: ["Treat note as internal information consolidation, not external source discovery; external URLs/templates/guidelines must already be registered as sources when they are evidence.", "Use notes to synthesize verified sources, compare candidates, record open questions, or explain why a candidate could not yet become evidence; keep unverified search snippets labeled as candidates.", "For bind/save/deposit/沉淀 requests, write the synthesized findings here or in `record_document_evidence` after source details is registered.", "Do not create a new note without real synthesis content: summary, quote, claim, or open question.", "Link notes to the resolved durable task packet through packetIds and to relevant sourceIds/artifacts."]
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

const COMMAND_UX_DETAILS = {
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
    dailyFlow: ["Use this to add external information such as papers, web findings, venue templates, reviewer guidelines, rankings, API docs, citations, or operator-provided links or material.", "When the user asks for current outside information or scholarly material, run read-only public no-key network search or visible retrieval as candidate discovery, then verify useful candidates before registration.", "For bind/save/deposit/沉淀 prompts, add external material first, then use note or document evidence for synthesis.", "Keep source intake separate from internal notes and pressure-test summaries."],
    targetingBehavior: "Resolve or confirm the task before adding external source details; batch multiple sources when the operator provides them together.",
    confirmationBehavior: "If no unique task target is available, ask for task selection instead of guessing.",
    expectedOutcome: "The selected task has verified source details, or the request stops clearly because retrieval or verification failed.",
    examples: ["/dove:source Add these CVPR author/reviewer guideline URLs to the selected task", "/dove:source Add venue templates and ranking pages before writing the synthesis note"]
  },
  "dove.note": {
    dailyFlow: ["Use this to consolidate internal information from added sources, existing materials, pressure-test results, or operator notes.", "Use source for external material; use note for project-local synthesis, candidate comparison, open questions, and writing-style or reviewer-preference summaries.", "For bind/save/deposit/沉淀 prompts, add the synthesized result here or in document evidence after source details are available."],
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

const COMMAND_ADAPTER_CONSTRAINTS = {
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
    "When source work cannot finish here, say the source material is ready and has not yet been added to the task; the natural Chinese phrasing is `这条来源还没加入任务`.",
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

export const COMMAND_SURFACES = COMMAND_SURFACES_BASE.map((surface) => {
  const withUx = {
    ...surface,
    adapterConstraints: COMMAND_ADAPTER_CONSTRAINTS[surface.id] ?? [],
    constraints: [...AGENT_WORKFLOW_CONSTRAINTS, ...(surface.constraints ?? [])],
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

export const COMMAND_SURFACE_BY_ID = Object.fromEntries(COMMAND_SURFACES.map((surface) => [surface.id, surface]));

export const DIRECT_PROCESS_ADAPTER_COMMAND_IDS = COMMAND_SURFACES
  .filter((surface) => surface.category === "mutation" && surface.id !== "dove.status" && surface.id !== "dove.lessons")
  .map((surface) => surface.id);

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function commandContextPaths(command) {
  const surface = typeof command === "string" ? COMMAND_SURFACE_BY_ID[command] : command;
  if (!surface) {
    throw new Error(`Unknown command surface: ${command}`);
  }
  return unique([
    ...COMMAND_BASE_CONTEXT_PATHS,
    ...(surface.domain === "paper" ? [".dove/state.json"] : []),
    ...(surface.contextPaths ?? []),
    ...(surface.requiredTools ?? []).flatMap((tool) => TOOL_CONTEXT_PATHS[tool] ?? [])
  ]);
}

export function commandIdToSlug(commandId) {
  return commandId.replace(/^dove\./, "");
}

export function hostCommandSlug(commandId) {
  return commandIdToSlug(commandId).replace(/\./g, "-");
}

export function adapterPathForCommand(hostId, command) {
  const commandId = typeof command === "string" ? command : command.id;
  const hostSlug = hostCommandSlug(commandId);
  switch (hostId) {
    case "opencode": return `.opencode/commands/${commandId}.md`;
    case "cursor": return `.cursor/commands/dove-${hostSlug}.md`;
    case "codex": return `.codex/skills/dove-${hostSlug}/SKILL.md`;
    case "agents": return `.agents/skills/dove-${hostSlug}/SKILL.md`;
    case "claude": return `commands/dove/${hostSlug}.md`;
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
  return [hostId, {
    label: HOST_DEFINITIONS[hostId].label,
    paths: [...commandPaths, ...extraPaths],
    requiredPaths: [...commandPaths, ...extraPaths],
    jsonChecks: HOST_DEFINITIONS[hostId].jsonChecks
  }];
}));
