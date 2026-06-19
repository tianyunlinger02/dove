export const CORE_INSTALL_PATHS = ["README.md", "bin", "docs", "mcp", "scripts", "src"];

export const DEFAULT_HOST_ADAPTERS = ["opencode"];

export const HOST_IDS = ["opencode", "codex", "cursor", "agents"];

export const HOST_DEFINITIONS = {
  opencode: { label: "OpenCode", jsonChecks: [".opencode.json"] },
  codex: { label: "Codex", jsonChecks: [] },
  cursor: { label: "Cursor", jsonChecks: [] },
  agents: { label: "Shared agent skills", jsonChecks: [] }
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
  "README.md",
  "bin",
  "docs",
  "mcp",
  "scripts",
  "src"
];

export const OPENCODE_ROLE_SKILL_PATHS = [
  ".opencode/skills/dove-pipeline/SKILL.md",
  ".opencode/skills/dove-planner/SKILL.md",
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
  run_dove_review_loop: [".dove/audio/reviews", ".dove/reviews", ".dove/drafts", ".dove/experiments", ".dove/task-packets/index.json"],
  query_dove_orchestrate: [".dove/workspace/index.json", ".dove/orchestration/board.json"],
  query_dove_mission: [".dove/workspace/index.json"],
  query_dove_mission_board: [".dove/orchestration/board.json", ".dove/task-packets/index.json"],
  query_dove_status: [".dove/state.json", ".dove/task-packets/index.json", ".dove/reviews/REVIEW_STATE.json", ".dove/reviews/concerns.json", ".dove/versions/index.json", ".dove/versions/comparisons.json", ".dove/meta/operator-lessons.json", ".dove/experiments", ".dove/checklists/current.md", ".dove/orchestration/board.json", ".dove/workspace/index.json", ".dove/runtime/continuation.json", ".dove/runtime/events.json", ".dove/runtime/results.json"],
  query_dove_audit: [".dove/task-packets/index.json", ".dove/runtime/controller-state.json"],
  query_dove_return: [".dove/task-packets/index.json", ".dove/runtime/controller-state.json"],
  launch_dove_mission: [".dove/meta/operator-follow-through.json", ".dove/task-packets/index.json", ".dove/programs/approvals.json"],
  query_task_graph: [".dove/task-packets/index.json", ".dove/context/packets"],
  sync_checklist: [".dove/checklists/current.md", ".dove/task-packets/index.json"],
  materialize_guidance_packet: [".dove/meta/operator-follow-through.json", ".dove/meta/remediation-packs.json", ".dove/task-packets/index.json"],
  run_autonomy_operate: [".dove/runtime/controller-state.json", ".dove/programs/approvals.json", ".dove/task-packets/index.json"],
  query_governance_coverage_report: [".dove/meta/governance-coverage.json"],
  upsert_plan: [".dove/plans", ".dove/checklists/current.md"],
  query_program_approvals: [".dove/programs/approvals.json", ".dove/runtime/controller-state.json"],
  issue_program_approval: [".dove/programs/approvals.json"],
  revoke_program_approval: [".dove/programs/approvals.json"],
  init_project: [".dove/state.json", ".dove/manifest.json"],
  update_research_brief: [".dove/research/brief.md", ".dove/research/agenda.json"],
  register_source: [".dove/sources/index.json"],
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
    summary: "Convert a user demand into a Dove task contract, then after approval run one bounded foreground mission pass.",
    requiredTools: ["create_dove_task", "record_dove_mission_pass"],
    constraints: ["Require an existing init goal before converting user demand into a mission task contract.", "Treat the operator input as natural-language demand, not as an already-created task.", "Return a proposal-only mission contract first: title, stage, domain, level, dependencies, blockers, evidence expectations, autonomous checklist proposal, compact task card, and recommended execution route.", "After returning the proposal, use interactive confirmation controls when the host supports them (for example Claude Code AskUserQuestion) with options: approve conversion and run one pass, adjust conversion, or cancel; only pass `confirmed: true` to `create_dove_task` after the operator approves the converted contract.", "Classify each task as `plan`, `execute`, or `audit` and as `paper`, `experiment`, or `engineering` before writing.", "User-created mission tasks default to level 3, while explicit operator-created levels 1, 2, 3, or deeper are allowed under the level-0 init goal.", "Autonomously decide whether a checklist is needed; system-created checklist/subtask packets must be children of their mission and must have level greater than the parent mission level.", "After materialization, immediately execute one bounded foreground pass in the same command invocation, using the appropriate host tools or top-level Dove workflow.", "Do not tell the operator to run `/dove:auto` for the first execution pass.", "After the pass, call `record_dove_mission_pass` to persist the mission result, task status, evidence, blockers, next action, and localized `resultCard` summary.", "If the bounded pass cannot be completed with real host/provider evidence, record a first-class boundary such as `awaiting-host-pass`, `missing-required-materials`, or `needs-review` with ownerRole, nextRole, handoff, and evidence requirements instead of claiming completion.", "When a completed mission pass has stage `plan`, pass explicit plan outputs to `record_dove_mission_pass` through `plannedMissions`, `resultingMissions`, `missions`, `childMissions`, or `planConversion` so Dove converts the plan into pending durable missions.", "Default the converted user-level mission to level 3 and `pending`; any converted child missions may be level 4, 5, or deeper and must also default to `pending`."]
  },
  {
    id: "dove.auto",
    title: "Dove auto",
    domain: "generic",
    category: "mutation",
    policy: "explicit-approval",
    summary: "Convert demand like mission intake, then after confirmation run multi-round foreground autonomy until completion or a boundary is reached.",
    requiredTools: ["run_dove_auto"],
    constraints: ["Use the same demand-to-task intake and classification model as `/dove:mission` before autonomous execution starts.", "Allow `/dove:auto` to be invoked directly on a new user demand or an existing durable task; it does not require running `/dove:mission` first.", "Return a proposal-only auto contract first: either a converted `proposedTask` with checklist proposal or a `selectedTask` from durable packet selection, plus compact task/auto cards, confirmation args, and max iteration budget.", "Use interactive confirmation controls when the host supports them (for example Claude Code AskUserQuestion) before passing `confirmed: true`; options should approve and run bounded auto, adjust target/contract, or cancel.", "When an existing task target is missing or ambiguous, present indexed packet choices through confirmation UX instead of guessing.", "Require explicit operator confirmation before execution beyond task creation or selection.", "Run in the current foreground call only; do not schedule background or daemon continuation after the response ends.", "Use `.dove/state.json.settings.auto.maxIterations` as the default foreground iteration limit; the default is 3.", "Record each foreground iteration and stop reason in `.dove/runtime/results.json`, and return a localized `resultCard` summary without persisting the UX-only card in runtime results.", "May internally call public Dove workflows such as source, note, experience, figure, draft, review, review-loop, rebuttal, lessons, and status as needed.", "Stop at completed, blocked, killed, authority/review boundary, missing provider credentials, conflicting packet target, or step-budget exhaustion.", "When a boundary is reached, persist the first-class boundary with required inputs/actions, role handoff, and next command; do not continue through hidden background work.", "Do not claim host/code/provider/experiment work was completed without real evidence; stop at an awaiting-host/provider boundary instead."]
  },
  {
    id: "dove.status",
    title: "Dove status",
    domain: "generic",
    category: "mutation",
    policy: "explicit-approval",
    summary: "Show the live development situation, then a daily home screen with ranked Dove actions and guarded status-adjustment UX.",
    requiredTools: ["query_dove_status", "apply_dove_status_adjustments"],
    constraints: ["Use status as the unified project and task dashboard; do not expose separate plan, checklist, audit, return, or orchestration slash surfaces.", "First call `query_dove_status` to obtain the read-only Dove durable mission dashboard, but do not treat `.dove/` context as the live development situation. Explain the live development situation from host-visible context first: current user request, current session work, known worktree state when available, latest validation/test evidence, active implementation blockers, and what was just completed or is still pending. If live context was not inspected, say so instead of inferring it from `.dove/`.", "Keep `query_dove_status` read-only: it must return `proposalOnly: true`, `noAutoApply: true`, and `writes: []`.", "Use `dailyHome` as the daily home screen: after live context first, present ranked 1-3 next action cards and proposal-only boundary action cards before raw status fields.", "Use `actionableBoundaries`, `boundaryActionCards`, and current boundary metadata from `query_dove_status` to explain why adjustable missions are waiting, what evidence is required, and who owns the next role handoff.", "After the live development situation, show only non-init missions that are eligible for status adjustment, excluding `completed` and `killed` missions; if there are no adjustable missions, do not print a mission list.", "Use compact cards for status adjustment previews when available. Do not print internal mission summary dumps such as mission counts, status counts, recent completed missions, or recent killed missions in the user-facing status response.", "Boundary types are first-class metadata, not machine status choices; keep status choices exactly `[\"pending\", \"ready\", \"in-progress\", \"blocked\", \"completed\", \"killed\"]`.", "When the host supports interactive confirmation controls, use a single confirmation dialog to ask whether the operator wants to modify mission statuses only when there are adjustable missions or the operator clearly asks to change states; do not paginate by mission count or collect choices across multiple dialogs.", "The single confirmation dialog must provide a no-change path and a change/provide-adjustment-details path; if the operator does not provide parseable `packetId -> status` adjustments in that single dialog, do not call a mutation tool and instead ask for a clear adjustment format.", "For status adjustment choices, preserve exactly `[\"pending\", \"ready\", \"in-progress\", \"blocked\", \"completed\", \"killed\"]` as the machine status enum.", "Only call `apply_dove_status_adjustments` with `confirmed: true` after that single dialog yields explicit operator-confirmed status adjustments, then show the localized `resultCard` summary.", "Killing a mission is now a status choice in this UX, not a standalone public slash command."]
  },
  {
    id: "dove.operator",
    title: "Dove operator",
    domain: "generic",
    category: "mutation",
    policy: "explicit-approval",
    summary: "Run all ready and in-progress Dove missions once, and create blocker-investigation plan missions for blocked work.",
    requiredTools: ["run_dove_operator"],
    constraints: ["First call `run_dove_operator` without confirmation to return the proposal-only execution contract, including compact queue cards, `autoRunnableTasks`, `hostPassRequiredTasks`, blocked missions, pending skipped missions, and `writes: []`.", "Use interactive confirmation controls when the host supports them before passing `confirmed: true`.", "Run in the current foreground call only; do not schedule background or daemon continuation after the response ends.", "For ready and in-progress missions, run one safe internal workflow step when available or collect one real host pass result in order; pass per-task results to `run_dove_operator` so Dove records lifecycle and runtime state.", "Do not claim real engineering, paper, or experiment work happened when neither a safe internal step nor an actual host pass result exists; let `run_dove_operator` record awaiting host results instead.", "When no safe internal step or actual host pass result exists, persist an `awaiting-host-pass-result` boundary rather than marking work complete.", "Preserve durable role handoff metadata while running queue passes; do not expose planner/builder/reviewer as separate slash commands.", "For blocked missions, create pending child plan missions that investigate the blocker reason and link back to the blocked mission, then return a localized `resultCard` summary of updated, awaiting, and created work."]
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
    summary: "Create a direction-change point, clear active non-init tasks, and preserve the init goal plus necessary lessons.",
    requiredTools: ["reset_dove_version"],
    constraints: ["Snapshot the current direction before resetting active tasks.", "Clear active non-init tasks so only the level-0 init task remains active.", "Preserve the level-0 init goal and required global or task lessons that still apply to future work.", "Return a clean status summary and recommend `/dove:mission` for the next direction."]
  },
  {
    id: "dove.source",
    title: "Dove source",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Collect and organize external information such as web, literature, API, or operator-provided sources for the selected task.",
    requiredTools: ["register_source"],
    constraints: ["Treat source as external information intake, not internal note consolidation.", "Use explicit configured providers or operator-provided material; do not hide network/provider calls.", "Link each source to the resolved durable task packet."]
  },
  {
    id: "dove.note",
    title: "Dove note",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Organize internal information from the repository, `.dove`, existing artifacts, and operator notes for the selected task.",
    requiredTools: ["upsert_note"],
    constraints: ["Treat note as internal information consolidation, not external source discovery.", "Link notes to the resolved durable task packet and relevant artifacts."]
  },
  {
    id: "dove.figure",
    title: "Dove figure",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Turn one user-described figure intent into materials, optional generation/import, caption provenance, and QA status.",
    requiredTools: ["run_figure_workflow"],
    constraints: ["Treat the user request as one figure intent; do not ask the user to manually sequence material preparation, result import, or validation.", "Resolve the durable task packet before any figure workflow write, then analyze linked sections, claims, experiments, sources, notes, review concerns, and material hints automatically.", "Use redacted Dove config and env-var secret references for external drawing providers; never store inline API keys, tokens, or secrets.", "Do not mark a final figure ready unless it comes from a validated generation import with durable provenance and caption.", "Captions must explain the figure purpose and linked evidence."]
  },
  {
    id: "dove.experience",
    title: "Dove experience",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Convert an idea into experiment goals/plans/results and bridge validated outcomes into claims or conclusions.",
    requiredTools: ["run_experience_workflow"],
    constraints: ["Use this as the combined experiment and claim workflow; do not expose separate public experiment or claim-gate slash commands.", "Make experiment goals, success criteria, result evidence, audit status, and claim impact explicit.", "Do not promote unsupported results into claims."]
  },
  {
    id: "dove.draft",
    title: "Dove draft",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Generate or modify paper draft content from prompts, existing materials, experience, figures, and review information.",
    requiredTools: ["upsert_draft", "set_section_status"],
    constraints: ["Draft as completely as current evidence allows.", "Use explicit placeholders for missing evidence or citations instead of fabricating support.", "Incorporate applicable source, note, experience, figure, and review context linked to the resolved task."]
  },
  {
    id: "dove.review",
    title: "Dove review",
    domain: "generic",
    category: "mutation",
    policy: "isolated-handoff",
    summary: "Run an isolated audio review over final plan/results and explicitly supplied artifacts without inheriting full project context.",
    requiredTools: ["run_audio_review"],
    constraints: ["The audio reviewer may read only the current task summary, final plan paths, final result paths, explicit artifact paths, artifact hashes, instructions, and output contract.", "Do not share writer private transcript, broad project context, orchestration board context, or reviewer private transcript.", "Import only declared handoff/report artifacts back into Dove review ledgers and return a localized `resultCard` summary for prepared/imported review states."]
  },
  {
    id: "dove.review-loop",
    title: "Dove review loop",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Loop isolated review, draft revision, and experience planning until coherent or blocked, with max iterations from global config.",
    requiredTools: ["run_dove_review_loop"],
    constraints: ["Use default 3 as the max iteration count unless `.dove/state.json.settings.reviewLoop.maxIterations` says otherwise.", "Each iteration should run review, update draft work, and plan missing experience/evidence as needed.", "Stop early when review is coherent, the task is blocked, a provider boundary is reached, or user input is required."]
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
    dailyFlow: ["Use this when the workspace needs its one global Dove goal or the goal wording needs an explicit refresh.", "Keep concrete work out of init; after init, route the actual request to mission or auto."],
    targetingBehavior: "No task target is needed because init owns the unique level-0 root.",
    confirmationBehavior: "Guarded mutation only; update the existing init instead of creating another root.",
    expectedOutcome: "The workspace has one level-0 init task and the next practical command is mission or auto.",
    examples: ["/dove:init Make Dove a local-first research and engineering workflow", "/dove:init Refresh the project goal around daily Dove usability"]
  },
  "dove.mission": {
    dailyFlow: ["Use this for one concrete user demand that should become a durable task and receive one bounded foreground pass.", "Describe the desired outcome in normal language; Dove converts it into title, stage, domain, level, checklist, evidence expectations, compact task card, and execution route."],
    targetingBehavior: "Creates a new mission under the init goal; first-run hosts may propose the init goal and mission together before writing.",
    confirmationBehavior: "Show the compact task card and converted contract first, then ask whether to approve and run one pass, adjust, or cancel.",
    expectedOutcome: "After approval, the task packet exists and the host either records the pass result or persists an explicit boundary with evidence requirements, role handoff, and a localized resultCard summary.",
    examples: ["/dove:mission Fix the status dashboard next-action mismatch", "/dove:mission Turn the latest review feedback into one executable task"]
  },
  "dove.auto": {
    dailyFlow: ["Use this when the user wants Dove to continue through bounded foreground iterations after the same demand-to-task intake as mission.", "Start from a new demand or an existing durable task; auto should propose compact task/auto cards and concrete safe steps before consuming the iteration budget."],
    targetingBehavior: "Selects an existing packet when the target is clear, otherwise proposes a new task contract.",
    confirmationBehavior: "Require explicit approval of the compact task/auto cards, selected/proposed task, max iteration budget, and concrete foreground steps.",
    expectedOutcome: "Each foreground iteration is recorded in runtime results and stops at completion, blocker, review/provider boundary, or budget exhaustion with an explicit boundary and localized resultCard summary.",
    examples: ["/dove:auto Continue the current Dove UX improvement task for up to three foreground rounds", "/dove:auto Run the selected task until completion or an explicit boundary"]
  },
  "dove.status": {
    dailyFlow: ["Use this as the daily home screen: report the host-visible development situation first.", "Then show ranked 1-3 next action cards, actionable boundaries, and boundary action cards before any raw durable details."],
    targetingBehavior: "Shows non-init adjustment targets except completed and killed missions; no counts/completed-killed recaps, mission counts, or status-count dumps.",
    confirmationBehavior: "Use compact adjustment cards and at most one confirmation dialog for status changes; no parseable packetId-to-status adjustment means no mutation.",
    expectedOutcome: "The operator sees current work, actionable boundaries, blockers, next action, optional guarded status adjustments, and localized resultCard summaries after confirmed adjustments without hidden writes or noisy mission summaries.",
    examples: ["/dove:status", "/dove:status Show what is blocked and whether any mission status should change"]
  },
  "dove.operator": {
    dailyFlow: ["Use this to inspect compact queue cards for the ready/in-progress queue, blocked queue, and pending queue, then run one foreground operator pass after confirmation.", "Do not claim real work happened unless the host supplies actual pass results or a safe internal step can run."],
    targetingBehavior: "Works over the active mission queue rather than one ad hoc target.",
    confirmationBehavior: "Preview compact queue cards with writes: [] first; require approval before recording results or creating blocker investigation missions.",
    expectedOutcome: "Runnable work is recorded from real results, blocked work gets pending investigation missions, and unresolved host work remains awaiting evidence through explicit boundaries with a localized resultCard summary.",
    examples: ["/dove:operator", "/dove:operator Run one confirmed queue pass and record real host pass results"]
  },
  "dove.lessons": {
    dailyFlow: ["Use this when a closed task yields reusable guidance that future Dove work should obey.", "Keep lessons short and explicit: problem, decision, pitfall, validation, and next-time guidance."],
    targetingBehavior: "Can record global lessons or bind a lesson to a resolved task packet.",
    confirmationBehavior: "When task binding is ambiguous, show task choices and wait for the operator.",
    expectedOutcome: "Applicable lessons are available to later mission, auto, operator, and status surfaces without importing raw traces.",
    examples: ["/dove:lessons Record that status should not show completed or killed mission lists", "/dove:lessons Show lessons that apply to the selected task"]
  },
  "dove.version": {
    dailyFlow: ["Use this when the project direction changes enough that active non-init work should be cleared.", "Snapshot the old direction before starting a fresh set of missions."],
    targetingBehavior: "Operates on the workspace task set and preserves the init root.",
    confirmationBehavior: "Guarded reset; require a reason before clearing active non-init tasks.",
    expectedOutcome: "A version snapshot is stored, active non-init tasks are cleared, and the next command is mission.",
    examples: ["/dove:version Change direction to focus on result-card usability", "/dove:version Start a fresh figure workflow direction while preserving the init goal"]
  },
  "dove.source": {
    dailyFlow: ["Use this to register external information such as papers, web findings, API docs, citations, or operator-provided provenance.", "Keep source intake separate from internal notes."],
    targetingBehavior: "Resolve or confirm the durable task packet before recording external source metadata.",
    confirmationBehavior: "If no unique task target is available, ask for packet selection instead of guessing.",
    expectedOutcome: "The selected task has durable source metadata and provenance links.",
    examples: ["/dove:source Register this paper as evidence for the selected task", "/dove:source Save the operator-provided API notes as an external source"]
  },
  "dove.note": {
    dailyFlow: ["Use this to consolidate internal information from the repository, existing artifacts, `.dove/`, or operator notes.", "Use source for external material; use note for project-local understanding."],
    targetingBehavior: "Resolve or confirm the durable task packet before writing notes.",
    confirmationBehavior: "If the target is missing or ambiguous, ask for task confirmation before writing.",
    expectedOutcome: "The selected task has internal notes linked to relevant artifacts.",
    examples: ["/dove:note Summarize how the status dashboard chooses its next action", "/dove:note Record the boundary case found during this validation run"]
  },
  "dove.figure": {
    dailyFlow: ["Use this when the user describes the figure they want once, including where it should help the paper or task.", "Dove should gather linked materials, prepare generation/import, write caption provenance, and validate QA without exposing low-level figure tools."],
    targetingBehavior: "Resolve the figure request to one durable task packet before any figure write.",
    confirmationBehavior: "Ask for packet confirmation when the figure target is unclear; provider calls require explicit safe configuration.",
    expectedOutcome: "A figure plan/run, safe import when available, caption provenance, and QA status are recorded.",
    examples: ["/dove:figure Draw a workflow diagram for the mission-auto-status loop", "/dove:figure Prepare the main results figure and caption provenance"]
  },
  "dove.experience": {
    dailyFlow: ["Use this as the experiment/evidence workflow: turn ideas into experiment plans, results, audits, and claim impact.", "Do not treat experience as general retrospectives; use lessons for reusable operator guidance."],
    targetingBehavior: "Resolve the experiment or evidence work to one durable task packet before writing.",
    confirmationBehavior: "Ask for task confirmation when experiment/result/claim signals do not identify one packet.",
    expectedOutcome: "Experiment artifacts, audit state, and claim bridge events are linked to the selected task.",
    examples: ["/dove:experience Design an experiment to validate retrieval quality", "/dove:experience Import this experiment result and bridge it to the claim"]
  },
  "dove.draft": {
    dailyFlow: ["Use this to generate or revise paper sections from the selected task, durable evidence, notes, sources, experiences, figures, and review findings.", "Write as much as current evidence supports and leave explicit placeholders for gaps."],
    targetingBehavior: "Resolve the draft request to one durable task packet before changing draft artifacts.",
    confirmationBehavior: "Ask for packet confirmation when the section/task target is ambiguous.",
    expectedOutcome: "Draft content or section status is updated with evidence-aware placeholders where needed.",
    examples: ["/dove:draft Draft the methods section from linked evidence", "/dove:draft Revise the introduction using the latest review findings"]
  },
  "dove.review": {
    dailyFlow: ["Use this for an isolated audio review over final plan/results and explicitly listed artifacts.", "Do not pass broad project context or private writer/reviewer transcripts."],
    targetingBehavior: "Resolve the review to one durable task packet and explicit artifact paths.",
    confirmationBehavior: "Reviewer handoff/import remains explicit and artifact-bounded.",
    expectedOutcome: "Audio review input/output artifacts are recorded without breaking isolation boundaries.",
    examples: ["/dove:review Review the final plan and result artifacts only", "/dove:review Prepare an isolated reviewer handoff for the current task"]
  },
  "dove.review-loop": {
    dailyFlow: ["Use this when review, draft revision, and experience planning should iterate together within the configured max rounds.", "Stop when coherent, blocked, at provider/review boundary, or when user input is required."],
    targetingBehavior: "Resolve the loop to one durable task packet before mutating review/draft/experience artifacts.",
    confirmationBehavior: "Run only bounded foreground iterations; default max is 3 unless configured otherwise.",
    expectedOutcome: "Each loop iteration records review, draft, and experience state until the task is coherent or blocked.",
    examples: ["/dove:review-loop Run up to three review and revision rounds for the current draft", "/dove:review-loop Stop when the task is coherent or reaches an evidence boundary"]
  },
  "dove.rebuttal": {
    dailyFlow: ["Use this to normalize reviewer issues, build response strategy, and draft evidence-backed rebuttal or revision text.", "Keep rebuttal work author-side and linked to claims, sections, experiments, or explicit gaps."],
    targetingBehavior: "Resolve the rebuttal work to one durable task packet and linked reviewer issues.",
    confirmationBehavior: "Do not draft final responses from unnormalized issues or unsupported evidence.",
    expectedOutcome: "Normalized issues, strategy, and response drafts are stored with durable evidence links.",
    examples: ["/dove:rebuttal Normalize reviewer issues and build the response strategy", "/dove:rebuttal Draft an evidence-backed response for the missing-experiment concern"]
  }
};

export const COMMAND_SURFACES = COMMAND_SURFACES_BASE.map((surface) => {
  const withUx = {
    ...surface,
    ux: COMMAND_UX_DETAILS[surface.id]
  };
  const hasTaskScopedWrite = (surface.requiredTools ?? []).some((toolId) => TASK_SCOPED_WRITE_TOOL_IDS.has(toolId));
  if (!hasTaskScopedWrite) {
    return withUx;
  }
  return {
    ...withUx,
    constraints: [...(surface.constraints ?? []), ...TASK_SCOPED_WRITE_CONSTRAINTS]
  };
});

export const COMMAND_SURFACE_BY_ID = Object.fromEntries(COMMAND_SURFACES.map((surface) => [surface.id, surface]));

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
    default: throw new Error(`Unknown host adapter: ${hostId}`);
  }
}

export function commandAdapterPathsForHost(hostId) {
  return COMMAND_SURFACES.map((command) => adapterPathForCommand(hostId, command));
}

export function allGeneratedCommandAdapterPaths() {
  return HOST_IDS.flatMap(commandAdapterPathsForHost);
}

export const HOST_ADAPTERS = Object.fromEntries(HOST_IDS.map((hostId) => {
  const commandPaths = commandAdapterPathsForHost(hostId);
  const extraPaths = hostId === "opencode" ? [...OPENCODE_ROLE_SKILL_PATHS, ".opencode.json"] : hostId === "agents" ? ["AGENTS.md"] : [];
  return [hostId, {
    label: HOST_DEFINITIONS[hostId].label,
    paths: [...commandPaths, ...extraPaths],
    requiredPaths: [...commandPaths, ...extraPaths],
    jsonChecks: HOST_DEFINITIONS[hostId].jsonChecks
  }];
}));
