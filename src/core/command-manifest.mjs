export const CORE_INSTALL_PATHS = ["README.md", "bin", "docs", "mcp", "scripts", "src"];

export const DEFAULT_HOST_ADAPTERS = ["opencode"];

export const HOST_IDS = ["opencode", "claude", "codex", "cursor", "agents"];

export const HOST_DEFINITIONS = {
  opencode: { label: "OpenCode", jsonChecks: [".opencode.json"] },
  claude: { label: "Claude Code", jsonChecks: [] },
  codex: { label: "Codex", jsonChecks: [] },
  cursor: { label: "Cursor", jsonChecks: [] },
  agents: { label: "Shared agent skills", jsonChecks: [] }
};

export const MANAGED_HOST_ADAPTER_PATHS = {
  opencode: [".opencode/commands/dove*.md", ".opencode/skills/dove-*", ".opencode.json"],
  claude: [".claude/commands/dove"],
  codex: [".codex/skills/dove-*"],
  cursor: [".cursor/commands/dove-*.md"],
  agents: [".agents/skills/dove-*", "AGENTS.md"]
};

export const MANAGED_PACKAGE_PATHS = [
  ".opencode/commands/dove*.md",
  ".opencode/skills/dove-*",
  ".opencode.json",
  ".claude/commands/dove",
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
  ".dove/workspace/index.json"
];

export const TOOL_CONTEXT_PATHS = {
  query_dove_orchestrate: [".dove/workspace/index.json", ".dove/orchestration/board.json"],
  query_dove_mission: [".dove/workspace/index.json"],
  query_dove_mission_board: [".dove/orchestration/board.json", ".dove/task-packets/index.json"],
  query_dove_status: [".dove/workspace/index.json", ".dove/orchestration/board.json", ".dove/task-packets/index.json", ".dove/state.json", ".dove/checklists/current.md", ".dove/reviews", ".dove/experiments", ".dove/versions", ".dove/wiki/navigation.md"],
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
  "If target resolution is ambiguous, follow `.dove/state.json.settings.taskTargetResolution.autoSelect`: true auto-selects the best candidate; false stops and asks for packetId confirmation.",
  "Reject the write when explicit packet ids or linked artifact ids point to conflicting durable packets."
];

const COMMAND_SURFACES_BASE = [
  { id: "dove.orchestrate", title: "Dove orchestrate", domain: "generic", category: "query", policy: "proposal-only", summary: "Route one Dove mission across paper, engineering, experiment, review, and general domains without writing state.", requiredTools: ["query_dove_orchestrate"], forbiddenTools: ["upsert_orchestration_board", "append_handoff"], constraints: ["Use this as the single mission routing surface for every domain; do not mirror shared routing under paper-specific commands."] },
  { id: "dove.mission", title: "Dove mission", domain: "generic", category: "query", policy: "proposal-only", summary: "Frame a Dove mission contract from the current workspace without writing state.", requiredTools: ["query_dove_mission"] },
  { id: "dove.status", title: "Dove status", domain: "generic", category: "query", policy: "query", summary: "Inspect the current Dove mission status, task graph, paper lifecycle, open questions, decisions, and version lineage.", requiredTools: ["query_dove_status"], constraints: ["Use this as the shared status surface across mission board, packet dependencies, paper lifecycle, and navigation state.", "Do not execute work, run tests, inspect git, repair state, or mutate source assets from this surface."] },
  { id: "dove.audit", title: "Dove audit", domain: "generic", category: "query", policy: "proposal-only", summary: "Inspect mission audit findings and readiness without writing or fixing anything.", requiredTools: ["query_dove_audit"], constraints: ["Inspect only declared evidence and durable packet links; do not fix, refresh, run tests, or inspect git."] },
  { id: "dove.return", title: "Dove return", domain: "generic", category: "query", policy: "proposal-only", summary: "Inspect return readiness from declared evidence and durable state.", requiredTools: ["query_dove_return"], constraints: ["Use declared changed-file, test-evidence, and validation-output paths; do not run tests, inspect git, or repair state from this surface.", "At closure, decide explicitly whether reusable experience is worth recording through Dove lessons; do not record automatically."] },
  { id: "dove.launch", title: "Dove launch", domain: "generic", category: "mutation", policy: "guarded-mutation", summary: "Turn accepted guidance into a governed Dove mission packet without executing it.", requiredTools: ["launch_dove_mission"], constraints: ["Use this as the only public slash surface for accepted guidance materialization.", "Require an accepted source plus explicit `executeBy` and `reviewAfter`; create the mission packet only and do not execute autonomy."] },
  { id: "dove.checklist", title: "Dove checklist", domain: "generic", category: "mutation", policy: "guarded-mutation", summary: "Sync the active Dove mission checklist from the current plan and acceptance checks across all domains.", requiredTools: ["sync_checklist"], constraints: ["Use this shared checklist surface for paper and non-paper missions; do not create domain mirror checklist commands."] },
  { id: "dove.autonomy-operate", title: "Dove autonomy operate", domain: "generic", category: "mutation", policy: "explicit-approval", summary: "Run the primary explicit bounded foreground autonomy operating surface.", requiredTools: ["run_autonomy_operate"], constraints: ["Use this as the normal user-facing autonomy entrypoint; `autonomy-once` and `autonomy-foreground` are lower-level CLI/MCP controls.", "Run only explicit bounded foreground autonomy and stop at declared review or authority boundaries."] },
  { id: "dove.governance-audit", title: "Dove governance audit", domain: "generic", category: "query", policy: "proposal-only", summary: "Inspect governance coverage and command/tool bindings without writing state.", requiredTools: ["query_governance_coverage_report"] },
  { id: "dove.plan", title: "Dove plan", domain: "generic", category: "mutation", policy: "guarded-mutation", summary: "Create or update the shared Dove mission design plan for paper, engineering, experiment, review, and general work.", requiredTools: ["upsert_plan"], contextPaths: [".dove/state.json", ".dove/research/brief.md", ".dove/sources/index.json", ".dove/evidence/index.json"], constraints: ["Use this as the single planning surface for every domain; do not mirror shared planning under paper-specific commands.", "For paper missions, include manuscript structure, claims, citations, venue strategy, target artifacts, required evidence, risks, non-goals, and acceptance checks."] },
  { id: "dove.approvals", title: "Dove approvals", domain: "generic", category: "mutation", policy: "explicit-approval", summary: "Inspect, issue, or revoke bounded program approvals.", requiredTools: ["query_program_approvals", "issue_program_approval", "revoke_program_approval"] },
  { id: "dove.lessons", title: "Dove lessons", domain: "generic", category: "mutation", policy: "governed-bookkeeping", summary: "Record or inspect concise operator lessons and retrospectives without importing raw runtime traces.", requiredTools: ["query_operator_lessons", "record_operator_lesson"], constraints: ["Record only distilled lessons with problem, decisions, pitfalls, validation, and next-time guidance.", "Do not import or cite ignored raw runtime traces.", "Do not materialize, approve, launch, or execute work from lessons."] },
  { id: "dove.onboard", title: "Dove onboard", domain: "generic", category: "query", policy: "proposal-only", summary: "Map existing project paper artifacts without moving, rewriting, or overwriting source assets.", requiredTools: ["query_dove_onboarding"], contextPaths: ["project root", ".dove/workspace/artifact-map.json"], constraints: ["Default to proposal-only mapping; persist only through the CLI `dove onboard --write-map` path.", "Never move, delete, import, rewrite, or overwrite source assets from this surface."] },
  { id: "dove.paper.init", title: "Dove paper init", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Initialize the paper-domain research contract and starter workspace.", requiredTools: ["init_project"] },
  { id: "dove.paper.research", title: "Dove paper research", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Update the research brief and agenda from source-first context.", requiredTools: ["update_research_brief"] },
  { id: "dove.paper.source", title: "Dove paper source", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Register sources into the durable paper source index.", requiredTools: ["register_source"] },
  { id: "dove.paper.note", title: "Dove paper note", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Record structured paper notes linked to sources, sections, and claims.", requiredTools: ["upsert_note"] },
  { id: "dove.paper.claim-gate", title: "Dove paper claim gate", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Promote supported findings into evidence-backed claims.", requiredTools: ["upsert_claims"], constraints: ["Promote claims only when linked source or note evidence exists."] },
  { id: "dove.paper.outline", title: "Dove paper outline", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Update the paper outline from the current plan and evidence state.", requiredTools: ["upsert_outline"] },
  { id: "dove.paper.draft", title: "Dove paper draft", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Draft or update paper sections without fabricating evidence.", requiredTools: ["upsert_draft", "set_section_status"], constraints: ["Leave `TODO[citation]` markers when support is missing instead of inventing evidence."] },
  { id: "dove.paper.audit", title: "Dove paper audit", domain: "paper", category: "query", policy: "proposal-only", summary: "Run strict no-fix paper audit inspection.", requiredTools: ["query_paper_audit"], constraints: ["Keep audit strict no-fix: report findings and proposal-only next commands without repairing paper artifacts."] },
  { id: "dove.paper.review", title: "Dove paper review", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Record reviewer concerns, run review passes, and produce revision pressure for the paper.", requiredTools: ["append_review_log", "run_review_loop"] },
  { id: "dove.paper.isolated-review", title: "Dove paper isolated review", domain: "paper", category: "paper-workflow", policy: "isolated-handoff", summary: "Prepare and import isolated reviewer handoffs through explicit artifacts.", requiredTools: ["prepare_isolated_review", "import_isolated_review"], contextPaths: [".dove/reviews/isolated", ".dove/reviews/concerns.json"], constraints: ["Prepare and import explicit artifacts through MCP; external reviewer process execution remains CLI-only.", "Pass only explicit input artifacts to the reviewer and import only handoff/report artifacts back.", "Never import a private reviewer transcript."] },
  { id: "dove.paper.revise", title: "Dove paper revise", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Revise paper artifacts according to review pressure and checklist scope.", requiredTools: ["upsert_revision_plan", "set_section_status"] },
  { id: "dove.paper.rebuttal", title: "Dove paper rebuttal", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Normalize reviewer issues, build a rebuttal strategy, and draft the rebuttal response.", requiredTools: ["normalize_rebuttal_issues", "build_rebuttal_strategy", "build_rebuttal"], constraints: ["Normalize reviewer issues before drafting responses.", "Keep revision/rebuttal work builder-side."] },
  { id: "dove.paper.citations", title: "Dove paper citations", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Sync citation artifacts and bibliography state.", requiredTools: ["sync_citations"], constraints: ["Never fabricate citation data; sync only explicit source and bibliography records."] },
  { id: "dove.paper.figure", title: "Dove paper figure", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Plan, prepare, generate/import, caption, and validate paper figures.", requiredTools: ["upsert_figure_plan", "prepare_figure_generation", "import_figure_generation", "validate_figure_pipeline"], constraints: ["Bind every figure plan, generation prepare, and import write to a resolved durable task packet before mutating state.", "Use redacted Dove config and env-var secret references for external drawing providers; never store inline API keys, tokens, or secrets.", "Do not mark a final figure ready unless it comes from a validated generation import with durable provenance and caption.", "Captions must explain the figure purpose and linked evidence."] },
  { id: "dove.paper.experiment", title: "Dove paper experiment", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Plan, record, and audit claim-driven experiments.", requiredTools: ["upsert_experiment_plan", "upsert_experiment_result", "run_experiment_audit"] },
  { id: "dove.paper.result-bridge", title: "Dove paper result bridge", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Bridge experiment results into claim confidence/state changes.", requiredTools: ["bridge_result_to_claim"] },
  { id: "dove.paper.version", title: "Dove paper version", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Snapshot, compare, and inspect paper version lineage.", requiredTools: ["create_version_snapshot", "compare_versions", "query_lineage"] },
  { id: "dove.paper.meta-optimize", title: "Dove paper meta optimize", domain: "paper", category: "query", policy: "proposal-only", summary: "Inspect proposal-only optimization frontier and recommendations.", requiredTools: ["query_meta_optimize"] },
  { id: "dove.follow-through", title: "Dove follow through", domain: "generic", category: "mutation", policy: "governed-bookkeeping", summary: "Record explicit operator handling of proposal-only remediation guidance across all mission domains.", requiredTools: ["record_operator_follow_through", "query_operator_follow_through"], constraints: ["Use this shared follow-through surface before launching accepted guidance; do not mirror proposal handling under paper-specific commands."] }
];

export const COMMAND_SURFACES = COMMAND_SURFACES_BASE.map((surface) => {
  const hasTaskScopedWrite = (surface.requiredTools ?? []).some((toolId) => TASK_SCOPED_WRITE_TOOL_IDS.has(toolId));
  if (!hasTaskScopedWrite) {
    return surface;
  }
  return {
    ...surface,
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
    case "claude": return `.claude/commands/dove/${hostSlug}.md`;
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
