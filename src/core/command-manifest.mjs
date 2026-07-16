export const CORE_INSTALL_PATHS = [
  "README.md",
  "docs/README.md",
  "docs/INSTALL.md",
  "docs/USAGE.md",
  "docs/PACKAGING.md",
  "docs/CAPABILITY_MATRIX.md",
  "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md",
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
  ".opencode/skills/dove-planner/SKILL.md",
  ".opencode/skills/dove-builder/SKILL.md",
  ".opencode/skills/dove-reviewer/SKILL.md"
];

export const TOOL_RESULT_CONTEXT_FIELDS = Object.freeze({
  init_dove_goal: ["mutation.paths"],
  create_dove_mission: ["executionHandoff.missionId", "executionHandoff.contractDigest", "executionHandoff.targetArtifacts", "executionHandoff.expectedArtifacts", "executionHandoff.completionCriteria", "executionHandoff.evidenceRequirements"],
  query_dove_mission: ["mission.missionId", "contractDigest", "mission.targetArtifacts", "mission.expectedArtifacts"],
  query_dove_status: ["scope.missionId", "currentContext.selectedMissionId", "needsAttention.stableGaps"],
  ingest_execution_receipt: ["receipt.artifacts", "receipt.validations", "completion.assessment"],
  assess_mission_completion: ["missionId", "completionCriteria", "evidenceRequirements", "diagnostics.missionPath"],
  search_network: ["candidates.registrationDraft", "candidates.captureRequiredForEvidence"],
  query_network_search_providers: ["providers"],
  query_sources: ["items.capturedMaterial", "items.eligibility"],
  query_dove_lessons: ["items.artifactRefs"],
  record_dove_lesson: ["lesson.artifactRefs"],
  register_source: ["source.capturedMaterial", "artifacts"],
  verify_source: ["source.capturedMaterial", "artifacts"],
  upsert_note: ["artifacts"],
  upsert_claims: ["artifacts"],
  run_experience_workflow: ["artifacts"],
  upsert_draft: ["artifacts"],
  upsert_draft_metadata: ["artifacts"],
  run_figure_workflow: ["artifacts"],
  prepare_review_exchange: ["actionablePaths", "reviewedArtifacts", "importAction"],
  import_review_exchange: ["actionablePaths", "nextAction"],
  verify_review_coverage: ["reviews.reviewPath", "reviews.reviewedArtifactPaths"],
  normalize_rebuttal_issues: ["artifacts"],
  build_rebuttal_strategy: ["artifacts"],
  build_rebuttal: ["artifacts"],
  create_version_snapshot: ["artifacts"],
  compare_versions: ["artifacts"]
});

const COMMON_CONSTRAINTS = [
  "Every mutation requires an explicit missionId and writes only mission-bound artifacts, canonical receipts, ownership, and lineage.",
  "Validate every imported path, hash, source, note, finding, experiment result, and artifact reference before the first write.",
  "Do not create packets, boards, runtime state, hidden schedulers, policy overrides, role authority, lifecycle mirrors, or persistent context.",
  "Every read is zero-write and must not repair, refresh, bootstrap, or convert durable state.",
  "Keep Planner, Builder, and Reviewer responsibilities separate; Reviewer authority must fail closed when no trusted proof capability exists."
];

const surface = (id, title, category, policy, summary, requiredTools, constraints, ux) => ({
  id,
  title,
  domain: "generic",
  category,
  policy,
  summary,
  requiredTools,
  constraints: [...COMMON_CONSTRAINTS, ...constraints],
  adapterConstraints: constraints,
  ux
});

export const COMMAND_SURFACES = [
  surface("dove.init", "Dove init", "mutation", "guarded-mutation", "Propose and exactly confirm sealed schema 8 workspace initialization.", ["init_dove_goal"], [
    "Proposal is strictly zero-write; exact confirmation creates only manifest, project identity, receipt directories, and required domain directories.",
    "Legacy or invalid state requires explicit direct-process archive-reset with no import, repair, fallback, or alias."
  ], { dailyFlow: ["Request a zero-write schema 8 initialization proposal.", "Inspect and replay the exact confirmation data only when approved."], targetingBehavior: "Initialization is bound to the canonical workspace, not another workflow target.", confirmationBehavior: "Replay the exact proposal digest and workspace identity.", expectedOutcome: "A sealed minimal schema 8 workspace exists without workflow side effects.", examples: ["/dove:init Initialize this research workspace", "/dove:init Archive invalid Dove state and initialize schema 8"] }),
  surface("dove.mission", "Dove mission", "mutation", "explicit-approval", "Propose and persist one minimal mission contract, then return control to the host.", ["create_dove_mission"], [
    "Persist only goal, scope, out-of-scope, target and expected artifacts, completion criteria, evidence requirements, dependencies, and supersession metadata.",
    "Proposal is zero-write; confirmation must exactly replay the returned contract and target artifact identities."
  ], { dailyFlow: ["Turn one concrete goal into a minimal mission contract.", "After approval, continue substantive work with native host planning and tools."], targetingBehavior: "The missionId is explicit or deterministically proposed; no packet target is resolved.", confirmationBehavior: "Approve the exact proposal, adjust it, or cancel.", expectedOutcome: "One durable mission contract exists and no orchestration route is created.", examples: ["/dove:mission Validate the new retrieval method", "/dove:mission Revise the methods draft from current evidence"] }),
  surface("dove.status", "Dove status", "query", "read-only", "Read schema 8 mission and evidence integrity without refreshing state.", ["query_dove_status"], [
    "Absent state returns needs-init; malformed, legacy, contradictory, or future state fails closed.",
    "Compact status reports only schema health, mission count, receipt count, source count, and live integrity."
  ], { dailyFlow: ["Inspect current schema and integrity without writes.", "Pass missionId to scope completion, source, domain, and review checks; when more than one mission exists, choose explicitly."], targetingBehavior: "With zero missions status reports none; with one mission it scopes to the only mission; with multiple missions it never selects an implicit latest mission.", confirmationBehavior: "No confirmation is applicable because status is read-only.", expectedOutcome: "The operator sees stable gaps and one existing command or tool to run next.", examples: ["/dove:status", "/dove:status Show integrity for mission <id>"] }),
  surface("dove.lessons", "Dove lessons", "mutation", "guarded-mutation", "Query advisory lessons by default or explicitly record one exact-confirmation mission-provenanced lesson.", ["query_dove_lessons", "record_dove_lesson"], [
    "Default behavior is an explicit read-only query; never auto-capture a lesson and never auto-recall lessons from another command.",
    "Every lesson retains its recording mission as provenance; global scope means broad applicability, not provenance detached from that mission.",
    "The only lesson kinds are preference, constraint, method, failure, and review-insight.",
    "Recording is advisory-only: proposal is strictly zero-write, and only the exact returned proposal token may be replayed with --confirmed inside a MutationContext.",
    "Lessons never grant authority, satisfy completion, replace current evidence checks, become mission output artifacts, import transcripts, write Trellis state, or create runtime memory."
  ], { dailyFlow: ["Query only the lessons explicitly requested for the current mission, kind, tags, or artifact scope.", "Use record only when the operator explicitly asks to preserve a specific lesson, then inspect and replay the exact confirmation command."], targetingBehavior: "Query may include globally applicable lessons and current mission-scoped lessons while preserving each recording mission; artifact filters require an explicit missionId.", confirmationBehavior: "Query never confirms. Record proposes with zero writes and accepts only the exact proposal token plus --confirmed; there is no confirmation alias.", expectedOutcome: "The operator receives current advisory guidance or one immutable advisory lesson with evidence lineage.", examples: ["/dove:lessons Query method lessons for the current mission", "/dove:lessons Record this explicit review insight"] }),
  surface("dove.version", "Dove version", "mutation", "guarded-mutation", "Snapshot, compare, or finalize current mission artifacts.", ["create_version_snapshot", "compare_versions"], [
    "Snapshots are immutable ids and contain current hashes and receipt lineage.",
    "Comparison rejects stale snapshots; finalization requires complete current receipts and authoritative review proof."
  ], { dailyFlow: ["Snapshot current mission artifacts before a meaningful revision.", "Compare two snapshots or request fail-closed finalization."], targetingBehavior: "Provide missionId and version ids explicitly.", confirmationBehavior: "Finalization succeeds only from current completion and Reviewer proof.", expectedOutcome: "Version lineage and a real hash comparison are durable.", examples: ["/dove:version Snapshot the current draft", "/dove:version Compare the previous and current snapshots"] }),
  surface("dove.source", "Dove source", "mutation", "guarded-mutation", "Register mission-bound source candidates or record a rejection.", ["query_sources", "register_source", "verify_source"], [
    "Registration always creates a candidate and imports captured material under mission-owned source artifacts.",
    "Schema 8 stores only candidate or rejected source state; public verification is rejection-only and ordinary execution receipts never mint positive source authority."
  ], { dailyFlow: ["Register real external material with title or locator.", "Query eligibility or reject a candidate after an explicit audit."], targetingBehavior: "Provide missionId and sourceId explicitly.", confirmationBehavior: "No candidate becomes trusted through public input.", expectedOutcome: "The source has current identity, material fingerprint, lifecycle, and eligibility.", examples: ["/dove:source Register this paper for the mission", "/dove:source Reject the candidate after checking the captured PDF"] }),
  surface("dove.note", "Dove note", "mutation", "guarded-mutation", "Write substantive mission-bound synthesis from current eligible evidence.", ["upsert_note"], [
    "A note requires summary, quote, claim, or open question plus at least one current mission-owned artifact, including a current note artifact when applicable.",
    "sourceIds remain ineligible until a trusted positive source verifier exists; candidate or rejected sources cannot authorize the write."
  ], { dailyFlow: ["Synthesize current mission-owned artifacts, including current note artifacts when applicable.", "Record claims, quotes, and open questions rather than empty bookkeeping."], targetingBehavior: "Provide missionId and noteId explicitly.", confirmationBehavior: "Ineligible or cross-mission evidence stops the write.", expectedOutcome: "A substantive note with current evidence lineage exists.", examples: ["/dove:note Summarize the current mission artifacts", "/dove:note Record the open methodological question"] }),
  surface("dove.figure", "Dove figure", "mutation", "guarded-mutation", "Prepare or import a mission-bound figure with caption, provenance, QA, and review boundary.", ["run_figure_workflow"], [
    "Provider execution stays host-side; Dove accepts only current imported output with a matching hash.",
    "Clean QA is diagnostic only; validated requires authoritative proof for the exact final artifact hash."
  ], { dailyFlow: ["Gather current mission materials and record a drawing prompt.", "Import host-produced output with caption and QA when available."], targetingBehavior: "Provide missionId, figureId, and material artifact paths explicitly.", confirmationBehavior: "Binary imports use direct-process; patch-plan supports SVG only.", expectedOutcome: "The figure is planned, awaiting review, needs fixes, or validated by trusted proof.", examples: ["/dove:figure Prepare the method overview figure", "/dove:figure Import the generated SVG with its caption"] }),
  surface("dove.experience", "Dove experience", "mutation", "guarded-mutation", "Record one mission-bound experiment protocol, result, audit, and optional claim bridge.", ["run_experience_workflow", "upsert_claims"], [
    "The protocol, result, audit, and claim bridge use one implementation and one preflighted write set.",
    "Results require current evidence; claim bridges require a clean audit and a current mission claim."
  ], { dailyFlow: ["Record a concrete protocol and success criteria.", "Add current result evidence, audit findings, and claim impact when available."], targetingBehavior: "Provide missionId and experimentId explicitly.", confirmationBehavior: "Integrity flags prevent claim bridging.", expectedOutcome: "Experiment evidence and claim impact are linked without scheduling execution.", examples: ["/dove:experience Record the ablation protocol", "/dove:experience Audit the result and bridge it to the claim"] }),
  surface("dove.draft", "Dove draft", "mutation", "guarded-mutation", "Write a real mission-bound draft body or metadata for an existing draft.", ["upsert_draft", "upsert_draft_metadata"], [
    "Body writes require non-empty substantive text and current evidence lineage.",
    "Metadata-only updates require an existing current mission-owned draft."
  ], { dailyFlow: ["Write or revise real draft text from current evidence.", "Use metadata-only mode only for an existing draft."], targetingBehavior: "Provide missionId and draftId explicitly.", confirmationBehavior: "Cross-mission or stale evidence stops the write.", expectedOutcome: "A real draft artifact and canonical receipt exist.", examples: ["/dove:draft Write the methods section", "/dove:draft Update metadata for the current draft"] }),
  surface("dove.review", "Dove review", "mutation", "guarded-mutation", "Preflight, prepare, import, or verify one policy-scoped schema 8 review exchange without reviewer orchestration.", ["prepare_review_exchange", "import_review_exchange", "verify_review_coverage"], [
    "Policy expresses input scope only: local-preflight, isolated-selected-artifacts, final-plan-results-only, or external.",
    "local-preflight is strictly zero-write and non-authoritative; other policies freeze only current mission-owned artifact snapshots.",
    "Prepare writes canonical input and manifest artifacts owned together by one preparation receipt; import validates that ledger anchor before accepting the canonical handoff and report.",
    "Only completed coherent, needs-revision, or needs-evidence returns count as coverage; blocked or failed returns remain durable but ineligible, and every finding links an in-scope artifact.",
    "Imported public review material remains non-authoritative; caller-supplied reviewer identity, verdict, report, handoff, or manifest fields never mint Reviewer authority.",
    "Dove does not launch a reviewer, session, subagent, process, loop, board transition, or runtime continuation."
  ], { dailyFlow: ["Use local-preflight for a zero-write exact scope check.", "Prepare a policy-scoped exchange, let an independent external process or person produce the declared files, then import and verify coverage."], targetingBehavior: "Provide missionId and explicit policy artifact paths; import also requires exchangeId and reviewId.", confirmationBehavior: "Prepare/import are guarded mutations; preflight and coverage verification are read-only.", expectedOutcome: "A tamper-evident mission-bound review and exact current coverage assessment exist without self-issued authority.", examples: ["/dove:review Preflight the current methods artifacts", "/dove:review Import the returned review exchange"] }),
  surface("dove.rebuttal", "Dove rebuttal", "mutation", "guarded-mutation", "Normalize reviewer findings and write author-side evidence-linked responses.", ["normalize_rebuttal_issues", "build_rebuttal_strategy", "build_rebuttal"], [
    "Every issue must link to a current mission-owned review artifact and concrete finding id.",
    "Strategy and responses remain author-side and reject stale issues, stale strategy, or missing evidence."
  ], { dailyFlow: ["Normalize concrete reviewer findings before strategy.", "Write evidence-linked author responses without claiming Reviewer authority."], targetingBehavior: "Provide missionId and finding references explicitly.", confirmationBehavior: "Unsupported findings or responses stop before writing.", expectedOutcome: "Issues, strategy, and response text retain current finding and evidence lineage.", examples: ["/dove:rebuttal Normalize the reviewer findings", "/dove:rebuttal Draft evidence-backed responses"] })
];

export const COMMAND_SURFACE_BY_ID = Object.fromEntries(COMMAND_SURFACES.map((item) => [item.id, item]));
export const DIRECT_PROCESS_ADAPTER_COMMAND_IDS = COMMAND_SURFACES.filter((item) => item.category === "mutation").map((item) => item.id);

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function commandResultContextFields(command) {
  const selected = typeof command === "string" ? COMMAND_SURFACE_BY_ID[command] : command;
  if (!selected) throw new Error(`Unknown command surface: ${command}`);
  return unique((selected.requiredTools ?? []).flatMap((tool) => TOOL_RESULT_CONTEXT_FIELDS[tool] ?? []));
}

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
  return [hostId, { label: HOST_DEFINITIONS[hostId].label, paths: [...commandPaths, ...extraPaths], requiredPaths: [...commandPaths, ...extraPaths], jsonChecks: HOST_DEFINITIONS[hostId].jsonChecks }];
}));
