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
  append_review_log: [".dove/reviews/log.json", ".dove/reviews/concerns.json"],
  run_review_loop: [".dove/reviews", ".dove/revision-plans", ".dove/evidence/index.json"],
  upsert_revision_plan: [".dove/revision-plans", ".dove/reviews"],
  normalize_rebuttal_issues: [".dove/rebuttal/issues.json"],
  build_rebuttal_strategy: [".dove/rebuttal/issues.json", ".dove/rebuttal/strategy.md"],
  build_rebuttal: [".dove/rebuttal"],
  sync_citations: [".dove/bibliography", ".dove/sources/index.json"],
  upsert_figure_plan: [".dove/figures"],
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
  query_operator_follow_through: [".dove/meta/operator-follow-through.json"],
  record_operator_follow_through: [".dove/meta/operator-follow-through.json"],
  refresh_wiki: [".dove/wiki", ".dove/sources/index.json", ".dove/notes/index.json"]
};

export const COMMAND_SURFACES = [
  { id: "dove.orchestrate", title: "Dove orchestrate", domain: "generic", category: "query", policy: "proposal-only", summary: "Route one Dove mission to the next command without writing state.", requiredTools: ["query_dove_orchestrate"], forbiddenTools: ["upsert_orchestration_board", "append_handoff"] },
  { id: "dove.mission", title: "Dove mission", domain: "generic", category: "query", policy: "proposal-only", summary: "Frame a Dove mission contract from the current workspace without writing state.", requiredTools: ["query_dove_mission"] },
  { id: "dove.board", title: "Dove board", domain: "generic", category: "query", policy: "proposal-only", summary: "Inspect the as-read Dove mission board without refreshing or mutating state.", requiredTools: ["query_dove_mission_board"] },
  { id: "dove.audit", title: "Dove audit", domain: "generic", category: "query", policy: "proposal-only", summary: "Inspect mission audit findings and readiness without writing or fixing anything.", requiredTools: ["query_dove_audit"], constraints: ["Inspect only declared evidence and durable packet links; do not fix, refresh, run tests, or inspect git."] },
  { id: "dove.return", title: "Dove return", domain: "generic", category: "query", policy: "proposal-only", summary: "Inspect return readiness from declared evidence and durable state.", requiredTools: ["query_dove_return"], constraints: ["Use declared changed-file, test-evidence, and validation-output paths; do not run tests, inspect git, or repair state from this surface."] },
  { id: "dove.launch", title: "Dove launch", domain: "generic", category: "mutation", policy: "guarded-mutation", summary: "Materialize accepted guidance into a governed Dove mission packet without executing it.", requiredTools: ["launch_dove_mission"], forbiddenTools: ["materialize_guidance_packet"], constraints: ["Require an accepted source plus explicit `executeBy` and `reviewAfter`; create the mission packet only and do not execute autonomy."] },
  { id: "dove.task-graph", title: "Dove task graph", domain: "generic", category: "query", policy: "query", summary: "Inspect task packets, dependencies, blockers, and review-needed work.", requiredTools: ["query_task_graph"] },
  { id: "dove.checklist", title: "Dove checklist", domain: "generic", category: "mutation", policy: "guarded-mutation", summary: "Sync the active Dove mission checklist from the current plan and acceptance checks.", requiredTools: ["sync_checklist"] },
  { id: "dove.materialize", title: "Dove materialize", domain: "generic", category: "mutation", policy: "guarded-mutation", summary: "Convert accepted proposal guidance into a durable task packet.", requiredTools: ["materialize_guidance_packet"] },
  { id: "dove.autonomy-operate", title: "Dove autonomy operate", domain: "generic", category: "mutation", policy: "explicit-approval", summary: "Run the explicit bounded foreground autonomy operating surface.", requiredTools: ["run_autonomy_operate"], constraints: ["Run only explicit bounded foreground autonomy and stop at declared review or authority boundaries."] },
  { id: "dove.governance-audit", title: "Dove governance audit", domain: "generic", category: "query", policy: "proposal-only", summary: "Inspect governance coverage and command/tool bindings without writing state.", requiredTools: ["query_governance_coverage_report"] },
  { id: "dove.plan", title: "Dove plan", domain: "generic", category: "mutation", policy: "guarded-mutation", summary: "Create or update the shared Dove mission design plan.", requiredTools: ["upsert_plan"] },
  { id: "dove.approvals", title: "Dove approvals", domain: "generic", category: "mutation", policy: "explicit-approval", summary: "Inspect, issue, or revoke bounded program approvals.", requiredTools: ["query_program_approvals", "issue_program_approval", "revoke_program_approval"] },
  { id: "dove.paper.init", title: "Dove paper init", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Initialize the paper-domain research contract and starter workspace.", requiredTools: ["init_project"] },
  { id: "dove.paper.orchestrate", title: "Dove paper orchestrate", domain: "paper", category: "query", policy: "proposal-only", summary: "Route paper-domain work to one next command without mutating the board.", requiredTools: ["query_dove_orchestrate"], forbiddenTools: ["upsert_orchestration_board", "append_handoff"] },
  { id: "dove.paper.pipeline", title: "Dove paper pipeline", domain: "paper", category: "paper-workflow", policy: "guidance", summary: "Show the paper-domain lifecycle from initialization through return.", requiredTools: [], contextPaths: [".dove/state.json", ".dove/wiki/navigation.md"] },
  { id: "dove.paper.research", title: "Dove paper research", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Update the research brief and agenda from source-first context.", requiredTools: ["update_research_brief"] },
  { id: "dove.paper.source", title: "Dove paper source", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Register sources into the durable paper source index.", requiredTools: ["register_source"] },
  { id: "dove.paper.note", title: "Dove paper note", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Record structured paper notes linked to sources, sections, and claims.", requiredTools: ["upsert_note"] },
  { id: "dove.paper.claim-gate", title: "Dove paper claim gate", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Promote supported findings into evidence-backed claims.", requiredTools: ["upsert_claims"], constraints: ["Promote claims only when linked source or note evidence exists."] },
  { id: "dove.paper.plan", title: "Dove paper plan", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Plan paper structure, claims, citations, venue strategy, and acceptance checks.", requiredTools: ["upsert_plan"] },
  { id: "dove.paper.outline", title: "Dove paper outline", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Update the paper outline from the current plan and evidence state.", requiredTools: ["upsert_outline"] },
  { id: "dove.paper.draft", title: "Dove paper draft", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Draft or update paper sections without fabricating evidence.", requiredTools: ["upsert_draft", "set_section_status"], constraints: ["Leave `TODO[citation]` markers when support is missing instead of inventing evidence."] },
  { id: "dove.paper.audit", title: "Dove paper audit", domain: "paper", category: "query", policy: "proposal-only", summary: "Run strict no-fix paper audit inspection.", requiredTools: ["query_paper_audit"], constraints: ["Keep audit strict no-fix: report findings and proposal-only next commands without repairing paper artifacts."] },
  { id: "dove.paper.review", title: "Dove paper review", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Record reviewer concerns and review log entries.", requiredTools: ["append_review_log"] },
  { id: "dove.paper.review-loop", title: "Dove paper review loop", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Generate a durable review entry and revision plan.", requiredTools: ["run_review_loop"] },
  { id: "dove.paper.isolated-review", title: "Dove paper isolated review", domain: "paper", category: "paper-workflow", policy: "isolated-handoff", summary: "Prepare and import isolated reviewer handoffs through explicit artifacts.", requiredTools: [], contextPaths: [".dove/reviews/isolated", ".dove/reviews/concerns.json"], constraints: ["Pass only explicit input artifacts to the reviewer and import only handoff/report artifacts back."] },
  { id: "dove.paper.revise", title: "Dove paper revise", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Revise paper artifacts according to review pressure and checklist scope.", requiredTools: ["upsert_revision_plan", "set_section_status"] },
  { id: "dove.paper.rebuttal-strategy", title: "Dove paper rebuttal strategy", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Normalize rebuttal issues and build a response strategy.", requiredTools: ["normalize_rebuttal_issues", "build_rebuttal_strategy"], constraints: ["Normalize reviewer issues before drafting responses."] },
  { id: "dove.paper.rebuttal", title: "Dove paper rebuttal", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Build a rebuttal draft from normalized issues and strategy.", requiredTools: ["build_rebuttal"], constraints: ["Draft responses from normalized rebuttal issues and strategy; keep revision/rebuttal work builder-side."] },
  { id: "dove.paper.citations", title: "Dove paper citations", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Sync citation artifacts and bibliography state.", requiredTools: ["sync_citations"], constraints: ["Never fabricate citation data; sync only explicit source and bibliography records."] },
  { id: "dove.paper.figure", title: "Dove paper figure", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Manage figure artifact contracts and validation state.", requiredTools: ["upsert_figure_plan", "validate_figure_pipeline"], constraints: ["Keep figure records as artifact contracts and QA state; do not claim a render/editor backend."] },
  { id: "dove.paper.experiment-plan", title: "Dove paper experiment plan", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Plan or record claim-driven experiments and results.", requiredTools: ["upsert_experiment_plan", "upsert_experiment_result"] },
  { id: "dove.paper.experiment-audit", title: "Dove paper experiment audit", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Persist experiment audit findings separately from raw results.", requiredTools: ["run_experiment_audit"] },
  { id: "dove.paper.result-bridge", title: "Dove paper result bridge", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Bridge experiment results into claim confidence/state changes.", requiredTools: ["bridge_result_to_claim"] },
  { id: "dove.paper.version-snapshot", title: "Dove paper version snapshot", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Create an honest paper version snapshot.", requiredTools: ["create_version_snapshot"] },
  { id: "dove.paper.version-compare", title: "Dove paper version compare", domain: "paper", category: "paper-workflow", policy: "guarded-mutation", summary: "Compare durable paper versions and preserve lineage.", requiredTools: ["compare_versions"] },
  { id: "dove.paper.task-graph", title: "Dove paper task graph", domain: "paper", category: "query", policy: "query", summary: "Inspect paper-domain task packets and dependencies.", requiredTools: ["query_task_graph"] },
  { id: "dove.paper.open-questions", title: "Dove paper open questions", domain: "paper", category: "query", policy: "query", summary: "Inspect unresolved research and review uncertainty.", requiredTools: ["query_open_questions"] },
  { id: "dove.paper.decisions", title: "Dove paper decisions", domain: "paper", category: "query", policy: "query", summary: "Inspect durable operational and comparison decisions.", requiredTools: ["query_decisions"] },
  { id: "dove.paper.lineage", title: "Dove paper lineage", domain: "paper", category: "query", policy: "query", summary: "Inspect version and comparison lineage.", requiredTools: ["query_lineage"] },
  { id: "dove.paper.meta-optimize", title: "Dove paper meta optimize", domain: "paper", category: "query", policy: "proposal-only", summary: "Inspect proposal-only optimization frontier and recommendations.", requiredTools: ["query_meta_optimize"] },
  { id: "dove.paper.follow-through", title: "Dove paper follow through", domain: "paper", category: "mutation", policy: "governed-bookkeeping", summary: "Record explicit operator handling of remediation guidance.", requiredTools: ["record_operator_follow_through", "query_operator_follow_through"] },
  { id: "dove.paper.materialize", title: "Dove paper materialize", domain: "paper", category: "mutation", policy: "guarded-mutation", summary: "Paper-domain view of materializing accepted guidance into task packets.", requiredTools: ["materialize_guidance_packet"] },
  { id: "dove.paper.autonomy-operate", title: "Dove paper autonomy operate", domain: "paper", category: "mutation", policy: "explicit-approval", summary: "Paper-domain view of explicit bounded foreground autonomy.", requiredTools: ["run_autonomy_operate"], constraints: ["Run only explicit bounded foreground autonomy and stop at declared review or authority boundaries."] },
  { id: "dove.paper.governance-audit", title: "Dove paper governance audit", domain: "paper", category: "query", policy: "proposal-only", summary: "Paper-domain view of governance coverage proof.", requiredTools: ["query_governance_coverage_report"] },
  { id: "dove.paper.checklist", title: "Dove paper checklist", domain: "paper", category: "mutation", policy: "guarded-mutation", summary: "Paper-domain view of the active Dove mission checklist.", requiredTools: ["sync_checklist"] },
  { id: "dove.paper.approvals", title: "Dove paper approvals", domain: "paper", category: "mutation", policy: "explicit-approval", summary: "Paper-domain view of bounded program approvals.", requiredTools: ["query_program_approvals", "issue_program_approval", "revoke_program_approval"] },
  { id: "dove.paper.wiki", title: "Dove paper wiki", domain: "paper", category: "mutation", policy: "guarded-mutation", summary: "Refresh the paper wiki and typed relation surfaces.", requiredTools: ["refresh_wiki"] },
  { id: "dove.paper.onboard", title: "Dove paper onboard", domain: "paper", category: "query", policy: "proposal-only", summary: "Map existing paper artifacts without moving or overwriting source assets.", requiredTools: [], contextPaths: ["project root", ".dove/workspace/artifact-map.json"], constraints: ["Default to proposal-only mapping; never move, delete, import, rewrite, or overwrite source assets."] }
];

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
