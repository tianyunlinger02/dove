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
  ".dove/workspace/index.json",
  ".dove/config.json",
  ".dove/config.local.json",
  ".dove/state.json"
];

export const TOOL_CONTEXT_PATHS = {
  init_dove_goal: [".dove/state.json", ".dove/task-packets/index.json"],
  create_dove_task: [".dove/state.json", ".dove/task-packets/index.json", ".dove/meta/operator-lessons.json"],
  run_dove_auto: [".dove/state.json", ".dove/task-packets/index.json", ".dove/runtime", ".dove/meta/operator-lessons.json"],
  kill_dove_task: [".dove/task-packets/index.json"],
  reset_dove_version: [".dove/state.json", ".dove/task-packets/index.json", ".dove/versions", ".dove/meta/operator-lessons.json"],
  run_experience_workflow: [".dove/experiments", ".dove/claims", ".dove/evidence/index.json", ".dove/task-packets/index.json"],
  run_audio_review: [".dove/audio/reviews", ".dove/task-packets/index.json", ".dove/reviews"],
  run_dove_review_loop: [".dove/audio/reviews", ".dove/reviews", ".dove/drafts", ".dove/experiments", ".dove/task-packets/index.json"],
  query_dove_orchestrate: [".dove/workspace/index.json", ".dove/orchestration/board.json"],
  query_dove_mission: [".dove/workspace/index.json"],
  query_dove_mission_board: [".dove/orchestration/board.json", ".dove/task-packets/index.json"],
  query_dove_status: [".dove/state.json", ".dove/task-packets/index.json", ".dove/reviews/REVIEW_STATE.json", ".dove/reviews/concerns.json", ".dove/versions/index.json", ".dove/versions/comparisons.json", ".dove/meta/operator-lessons.json", ".dove/experiments", ".dove/checklists/current.md", ".dove/orchestration/board.json", ".dove/workspace/index.json"],
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
  "If target resolution is ambiguous, follow `.dove/state.json.settings.taskTargetResolution.autoSelect`: true auto-selects the best candidate; false stops and asks for packetId confirmation.",
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
    policy: "guarded-mutation",
    summary: "Create a task under the init goal after classifying stage, domain, level, dependencies, blockers, and evidence expectations.",
    requiredTools: ["create_dove_task"],
    constraints: ["Require an existing init goal before creating mission tasks.", "Classify each task as `plan`, `execute`, or `audit` and as `paper`, `experiment`, or `engineering` before writing.", "User-created tasks default to level 3; only system-created prerequisite/controller tasks may be level 1 or 2.", "Do not execute the task from this surface; return the created task, blockers, evidence expectations, and recommended next command."]
  },
  {
    id: "dove.auto",
    title: "Dove auto",
    domain: "generic",
    category: "mutation",
    policy: "explicit-approval",
    summary: "Start with mission-style intake, then after confirmation automatically execute the task until completion or a boundary is reached.",
    requiredTools: ["run_dove_auto"],
    constraints: ["Use the same intake and classification model as `/dove:mission` before autonomous execution starts.", "Require explicit operator confirmation before execution beyond task creation or selection.", "May internally call public Dove workflows such as source, note, experience, figure, draft, review, review-loop, rebuttal, lessons, and status as needed.", "Stop at completed, blocked, killed, authority/review boundary, missing provider credentials, conflicting packet target, or step-budget exhaustion."]
  },
  {
    id: "dove.status",
    title: "Dove status",
    domain: "generic",
    category: "query",
    policy: "query",
    summary: "Show the project goal, active task tree, task states, blockers, versions, lessons, review state, and return readiness.",
    requiredTools: ["query_dove_status"],
    constraints: ["Use status as the unified project and task dashboard; do not expose separate plan, checklist, audit, return, or orchestration slash surfaces.", "Build the main dashboard from authoritative state, task packet, review, version, lesson, and experiment indexes; treat workspace/wiki/navigation reports only as diagnostics.", "Do not execute work, run tests, inspect git, repair state, or mutate artifacts from this surface."]
  },
  {
    id: "dove.kill",
    title: "Dove kill",
    domain: "generic",
    category: "mutation",
    policy: "guarded-mutation",
    summary: "Terminate a non-init Dove task and record the reason.",
    requiredTools: ["kill_dove_task"],
    constraints: ["Never kill the level-0 init task.", "Return indexed task choices when no unique task target is supplied and multiple active tasks exist, then wait for the operator to choose.", "Mark the selected task killed instead of deleting its durable packet."]
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
    constraints: ["The audio reviewer may read only the current task summary, final plan paths, final result paths, explicit artifact paths, artifact hashes, instructions, and output contract.", "Do not share writer private transcript, broad project context, orchestration board context, or reviewer private transcript.", "Import only declared handoff/report artifacts back into Dove review ledgers."]
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
    case "claude": return `.claude/commands/dove/${commandIdToSlug(commandId).replace(/\./g, "/")}.md`;
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
