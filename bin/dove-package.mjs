#!/usr/bin/env node

// bin/dove.mjs
import crypto11 from "node:crypto";
import fs21 from "node:fs";
import { spawnSync } from "node:child_process";
import path24 from "node:path";
import process3 from "node:process";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/core/claude-code-gateway.mjs
import os from "node:os";
import path from "node:path";
import process2 from "node:process";
function resolveClaudeConfigRoot(env = process2.env) {
  return path.resolve(env.DOVE_CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"));
}

// src/cli/command-parser.mjs
var value = (name, options = {}) => ({ name, kind: "value", ...options });
var boolean = (name, options = {}) => ({ name, kind: "boolean", ...options });
var outputOptions = [boolean("--json"), value("--format")];
var mutationOptions = [value("--mutation-mode"), ...outputOptions];
var missionOptions = [
  value("--operation"),
  value("--requirement"),
  value("--node-update-json", { repeatable: true }),
  value("--proposal-token"),
  value("--proposal-digest"),
  value("--mutation-mode"),
  ...outputOptions,
  value("--mission-id"),
  value("--goal"),
  value("--scope", { repeatable: true }),
  value("--out-of-scope", { repeatable: true }),
  value("--target-artifact", { repeatable: true }),
  value("--expected-artifact", { repeatable: true }),
  value("--completion-criterion", { repeatable: true }),
  value("--evidence-requirement", { repeatable: true }),
  value("--depends-on-mission-id", { repeatable: true }),
  value("--supersedes-mission-id"),
  boolean("--confirmed")
];
var receiptOptions = [
  value("--input"),
  value("--receipt-id"),
  value("--mission-id"),
  value("--contract-digest"),
  value("--summary"),
  value("--artifact-json", { repeatable: true }),
  value("--validation-json", { repeatable: true }),
  value("--criterion-json", { repeatable: true }),
  value("--produced-at"),
  ...mutationOptions
];
function command(options = [], positional = { min: 0, max: 1 }) {
  return { options, positional };
}
var CLI_COMMAND_SPECS = {
  install: command([boolean("--force"), value("--host", { repeatable: true }), value("--platform", { repeatable: true }), value("--mutation-mode"), ...outputOptions]),
  sync: command([boolean("--force"), value("--host", { repeatable: true }), value("--platform", { repeatable: true }), value("--mutation-mode"), ...outputOptions]),
  doctor: command([...outputOptions]),
  init: command([value("--goal"), boolean("--archive-reset"), boolean("--confirmed"), value("--proposal-token"), value("--proposal-digest"), ...mutationOptions]),
  mission: command(missionOptions),
  receipt: command(receiptOptions),
  status: command([value("--mission-id"), value("--detail"), value("--language"), ...outputOptions, boolean("--help", { key: "help" }), boolean("-h", { key: "help" })]),
  lessons: command([value("--lesson-id"), value("--mission-id"), value("--scope"), value("--kind"), value("--summary"), value("--details"), value("--next-time-guidance", { repeatable: true }), value("--source-id", { repeatable: true }), value("--note-id", { repeatable: true }), value("--artifact", { repeatable: true }), value("--applies-to-artifact", { repeatable: true }), value("--tag", { repeatable: true }), value("--supersedes-lesson-id"), boolean("--include-superseded"), boolean("--include-unscoped"), value("--limit"), value("--proposal-token"), value("--mutation-mode"), boolean("--confirmed"), ...outputOptions], { min: 0, max: 2 }),
  version: command([value("--mission-id"), value("--version-id"), value("--label"), value("--artifact", { repeatable: true }), value("--supersedes-version-id"), value("--from-version-id"), value("--to-version-id"), ...mutationOptions]),
  source: command([value("--mission-id"), value("--source-id"), value("--citation-key"), value("--title"), value("--locator"), value("--source-type"), value("--origin"), value("--abstract"), value("--year"), value("--author", { repeatable: true }), value("--capture-path"), value("--method"), value("--checked-material"), value("--audit-evidence-json"), ...mutationOptions], { min: 0, max: 2 }),
  note: command([value("--mission-id"), value("--note-id"), value("--title"), value("--summary"), value("--quote", { repeatable: true }), value("--claim", { repeatable: true }), value("--open-question", { repeatable: true }), value("--source-id", { repeatable: true }), value("--artifact", { repeatable: true }), ...mutationOptions]),
  draft: command([value("--mission-id"), value("--draft-id"), value("--title"), value("--body"), value("--summary"), value("--evidence", { repeatable: true }), value("--artifact", { repeatable: true }), boolean("--metadata-only"), ...mutationOptions]),
  experience: command([value("--mission-id"), value("--experiment-id"), value("--title"), value("--goal"), value("--hypothesis"), value("--protocol"), value("--success-criterion", { repeatable: true }), value("--comparison-target", { repeatable: true }), value("--result"), value("--result-evidence", { repeatable: true }), value("--audit-finding", { repeatable: true }), value("--integrity-flag", { repeatable: true }), value("--claim-id"), value("--bridge-reason"), ...mutationOptions]),
  figure: command([value("--mission-id"), value("--figure-id"), value("--intent"), value("--purpose"), value("--material", { repeatable: true }), value("--prompt"), value("--output-path"), value("--output-sha256"), value("--caption"), value("--qa-finding", { repeatable: true }), ...mutationOptions]),
  review: command([value("--mission-id"), value("--exchange-id"), value("--review-id"), value("--policy"), value("--artifact", { repeatable: true }), value("--final-plan", { repeatable: true }), value("--final-result", { repeatable: true }), boolean("--preflight"), boolean("--prepare"), boolean("--import"), boolean("--verify-coverage"), boolean("--require-authoritative"), ...mutationOptions]),
  rebuttal: command([value("--mission-id"), value("--issue-json", { repeatable: true }), value("--strategy"), value("--response-json", { repeatable: true }), boolean("--issues-only"), boolean("--strategy-only"), ...mutationOptions])
};
function optionMap(spec) {
  const map = /* @__PURE__ */ new Map();
  for (const option of spec.options) {
    if (map.has(option.name)) throw new Error(`Duplicate CLI option spec: ${option.name}`);
    map.set(option.name, option);
  }
  return map;
}
function parseDoveCli(argv, specs = CLI_COMMAND_SPECS) {
  const tokens = Array.from(argv ?? [], (item) => String(item));
  if (tokens.length === 0) return { command: null, positionals: [], args: [] };
  const commandName = tokens.shift();
  if (["help", "--help", "-h"].includes(commandName)) return { command: commandName, positionals: [], args: [] };
  const spec = specs[commandName];
  if (spec && tokens.some((token) => token === "--help" || token === "-h")) return { command: commandName, positionals: [], args: ["--help"] };
  if (!spec) return { command: commandName, positionals: tokens, args: [] };
  const options = optionMap(spec);
  const args2 = [];
  const positionals = [];
  const seen = /* @__PURE__ */ new Map();
  let separated = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const raw = tokens[index];
    if (!separated && raw === "--") {
      separated = true;
      continue;
    }
    if (separated || !raw.startsWith("-")) {
      positionals.push(raw);
      continue;
    }
    const equalsIndex = raw.indexOf("=");
    const name = equalsIndex > 0 ? raw.slice(0, equalsIndex) : raw;
    const inlineValue = equalsIndex > 0 ? raw.slice(equalsIndex + 1) : null;
    const option = options.get(name);
    if (!option) throw new Error(`Unknown or unsupported CLI argument: ${name}.`);
    const key = option.key ?? option.name;
    const count = seen.get(key) ?? 0;
    if (count > 0 && !option.repeatable) throw new Error(`${name} may be provided only once.`);
    seen.set(key, count + 1);
    if (option.kind === "boolean") {
      if (inlineValue !== null) throw new Error(`${name} does not accept a value.`);
      args2.push(name);
      continue;
    }
    let optionValue = inlineValue;
    if (optionValue === null) {
      const next = tokens[index + 1];
      const nextName = next?.split("=", 1)[0];
      if (next === void 0 || next === "--" || options.has(nextName)) throw new Error(`${name} requires a value.`);
      optionValue = next;
      index += 1;
    }
    if (optionValue === "") throw new Error(`${name} requires a value.`);
    args2.push(name, optionValue);
  }
  const { min = 0, max = 0 } = spec.positional ?? {};
  if (positionals.length < min) throw new Error(`${commandName} requires ${min} positional argument(s).`);
  if (positionals.length > max) throw new Error(`${commandName} accepts at most ${max} positional argument(s).`);
  return { command: commandName, positionals, args: args2 };
}

// src/core/command-manifest.mjs
var CORE_INSTALL_PATHS = [
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
var DEFAULT_HOST_ADAPTERS = ["opencode"];
var PROJECT_HOST_IDS = ["opencode", "codex", "cursor", "agents"];
var USER_HOST_IDS = ["claude"];
var HOST_IDS = [...PROJECT_HOST_IDS, ...USER_HOST_IDS];
var DOVE_MCP_CONFIG_PATH = ".mcp.json";
var DOVE_MCP_SERVER_NAME = "dove";
var DOVE_CLAUDE_PROJECT_MARKER_PATH = "mcp/dove-claude-project.json";
var DOVE_CLAUDE_PROJECT_MARKER = Object.freeze({
  version: 1,
  host: "claude"
});
var INSTALLED_DOVE_MCP_SERVER = Object.freeze({
  type: "stdio",
  command: "node",
  args: Object.freeze(["${CLAUDE_PROJECT_DIR:-.}/mcp/dove-state-server-package.mjs"])
});
var HOST_DEFINITIONS = {
  opencode: { label: "OpenCode", scope: "project", jsonChecks: [".opencode.json"] },
  codex: { label: "Codex", scope: "project", jsonChecks: [] },
  cursor: { label: "Cursor", scope: "project", jsonChecks: [] },
  agents: { label: "Shared agent skills", scope: "project", jsonChecks: [] },
  claude: { label: "Claude Code user commands", scope: "user", jsonChecks: [] }
};
var OPENCODE_ROLE_SKILL_PATHS = [
  ".opencode/skills/dove-planner/SKILL.md",
  ".opencode/skills/dove-builder/SKILL.md",
  ".opencode/skills/dove-reviewer/SKILL.md"
];
var TOOL_RESULT_CONTEXT_FIELDS = Object.freeze({
  init_dove_goal: ["mutation.paths[]"],
  create_dove_mission: ["executionHandoff.missionId", "executionHandoff.contractDigest", "executionHandoff.targetArtifacts[]", "executionHandoff.expectedArtifacts[]", "executionHandoff.completionCriteria[]", "executionHandoff.evidenceRequirements[]", "mission.missionId", "contractDigest", "tree.missionId", "tree.revision", "tree.nodes[]", "diff", "lessonDrafts[]"],
  query_dove_mission: ["mission.missionId", "contractDigest", "mission.targetArtifacts[]", "mission.expectedArtifacts[]"],
  query_dove_status: ["scope.missionId", "currentContext.selectedMissionId", "currentContext.integrityAssessment", "currentContext.researchTree", "needsAttention.stableGaps"],
  ingest_execution_receipt: ["receipt.artifacts[]", "receipt.validations[]", "completion.assessment"],
  close_host_outcome: ["status", "zeroWrite", "receipt.artifacts[]", "receipt.validations[]", "completion.assessment"],
  assess_mission_completion: ["missionId", "status", "complete", "supersededByMissionId", "dependencyCoverage[]", "incompleteReasons[]", "completionCriteria[]", "evidenceRequirements[]", "diagnostics.missionPath"],
  search_network: ["candidates[].registrationDraft", "candidates[].captureRequiredForEvidence"],
  query_network_search_providers: ["providers[]"],
  query_sources: ["items[].sourceId", "items[].capturedMaterial", "items[].eligibility"],
  query_dove_lessons: ["items[].artifactRefs[]"],
  record_dove_lesson: ["lesson.artifactRefs[]"],
  register_source: ["source.capturedMaterial", "artifacts[]"],
  verify_source: ["source.capturedMaterial", "artifacts[]"],
  upsert_note: ["artifacts[]"],
  upsert_claims: ["artifacts[]"],
  run_experience_workflow: ["artifacts[]"],
  upsert_draft: ["artifacts[]"],
  upsert_draft_metadata: ["artifacts[]"],
  run_figure_workflow: ["artifacts[]"],
  prepare_review_exchange: ["actionablePaths", "reviewedArtifacts[]", "importAction"],
  import_review_exchange: ["actionablePaths", "nextAction"],
  verify_review_coverage: ["reviews[].reviewPath", "reviews[].reviewedArtifactPaths[]"],
  normalize_rebuttal_issues: ["artifacts[]"],
  build_rebuttal_strategy: ["artifacts[]"],
  build_rebuttal: ["artifacts[]"],
  create_version_snapshot: ["artifacts[]"],
  compare_versions: ["comparison.added[]", "comparison.removed[]", "comparison.changed[]"]
});
var COMMON_CONSTRAINTS = [
  "Every mutation except workspace initialization requires an explicit missionId and writes only mission-bound artifacts, canonical receipts, ownership, and lineage.",
  "Validate every imported path, hash, source, note, finding, experiment result, and artifact reference before the first write.",
  "Do not create packets, boards, runtime state, hidden schedulers, policy overrides, role authority, lifecycle mirrors, or persistent context.",
  "Every read is zero-write and must not repair, refresh, bootstrap, or convert durable state.",
  "Keep Planner, Builder, and Reviewer responsibilities separate; Reviewer authority must fail closed when no trusted proof capability exists."
];
var surface = (id, title, category, policy, summary, requiredTools, constraints, ux) => ({
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
var COMMAND_INTERACTION_CONTRACTS = Object.freeze({
  "dove.init": { interaction: "checkpoint", continuation: "terminal", closure: "none", pathInput: "none" },
  "dove.mission": { interaction: "checkpoint", continuation: "resume-original", closure: "host-outcome", closureTools: Object.freeze(["close_host_outcome"]), pathInput: "none", explicitStopMode: "create-only" },
  "dove.status": { interaction: "read", continuation: "terminal", closure: "none", pathInput: "none" },
  "dove.lessons": { interaction: "write", continuation: "terminal", closure: "domain", pathInput: "workspace-file" },
  "dove.version": { interaction: "write", continuation: "terminal", closure: "domain", pathInput: "workspace-file" },
  "dove.source": { interaction: "write", continuation: "terminal", closure: "domain", pathInput: "workspace-file" },
  "dove.note": { interaction: "write", continuation: "terminal", closure: "domain", pathInput: "workspace-file" },
  "dove.figure": { interaction: "write", continuation: "terminal", closure: "domain", pathInput: "workspace-file" },
  "dove.experience": { interaction: "write", continuation: "resume-original", closure: "domain", pathInput: "workspace-file", explicitStopMode: "protocol-only" },
  "dove.draft": { interaction: "write", continuation: "terminal", closure: "domain", pathInput: "workspace-file" },
  "dove.review": { interaction: "checkpoint", continuation: "terminal", closure: "domain", pathInput: "workspace-file" },
  "dove.rebuttal": { interaction: "write", continuation: "terminal", closure: "domain", pathInput: "workspace-file" }
});
var TOOL_INTERACTION_CONTRACTS = Object.freeze({
  init_dove_goal: Object.freeze({ interaction: "checkpoint", pathFields: [] }),
  create_dove_mission: Object.freeze({ interaction: "checkpoint", pathFields: ["targetArtifacts", "expectedArtifacts"] }),
  query_dove_mission: Object.freeze({ interaction: "read", pathFields: ["targetArtifacts", "expectedArtifacts"] }),
  query_dove_status: Object.freeze({ interaction: "read", pathFields: [] }),
  ingest_execution_receipt: Object.freeze({ interaction: "write", pathFields: ["artifacts[].path", "validations[].reference"] }),
  close_host_outcome: Object.freeze({ interaction: "write", pathFields: ["artifactPaths", "validationPaths"] }),
  assess_mission_completion: Object.freeze({ interaction: "read", pathFields: [] }),
  search_network: Object.freeze({ interaction: "read", pathFields: [] }),
  query_network_search_providers: Object.freeze({ interaction: "read", pathFields: [] }),
  query_sources: Object.freeze({ interaction: "read", pathFields: [] }),
  query_dove_lessons: Object.freeze({ interaction: "read", pathFields: ["artifactRefs"] }),
  record_dove_lesson: Object.freeze({ interaction: "write", pathFields: ["artifactRefs", "appliesToArtifactRefs"] }),
  register_source: Object.freeze({ interaction: "write", pathFields: ["capturePath"] }),
  verify_source: Object.freeze({ interaction: "write", pathFields: [] }),
  upsert_note: Object.freeze({ interaction: "write", pathFields: ["artifactRefs"] }),
  upsert_claims: Object.freeze({ interaction: "write", pathFields: ["claims[].artifactRefs"] }),
  run_experience_workflow: Object.freeze({ interaction: "write", pathFields: ["resultEvidenceRefs"] }),
  upsert_draft: Object.freeze({ interaction: "write", pathFields: ["evidenceRefs", "artifactRefs"] }),
  upsert_draft_metadata: Object.freeze({ interaction: "write", pathFields: ["evidenceRefs", "artifactRefs"] }),
  run_figure_workflow: Object.freeze({ interaction: "write", pathFields: ["materials", "outputPath"] }),
  prepare_review_exchange: Object.freeze({ interaction: "checkpoint", pathFields: ["artifactPaths", "finalPlanPaths", "finalResultPaths"] }),
  import_review_exchange: Object.freeze({ interaction: "write", pathFields: [] }),
  verify_review_coverage: Object.freeze({ interaction: "read", pathFields: ["artifactPaths"] }),
  normalize_rebuttal_issues: Object.freeze({ interaction: "write", pathFields: ["issues[].findingRefs", "issues[].evidenceRefs"] }),
  build_rebuttal_strategy: Object.freeze({ interaction: "write", pathFields: [] }),
  build_rebuttal: Object.freeze({ interaction: "write", pathFields: ["issues[].findingRefs", "issues[].evidenceRefs", "responses[].evidenceRefs"] }),
  create_version_snapshot: Object.freeze({ interaction: "write", pathFields: ["artifactRefs"] }),
  compare_versions: Object.freeze({ interaction: "read", pathFields: [] })
});
var commandSurfaces = [
  surface("dove.init", "Dove init", "mutation", "guarded-mutation", "Prepare Dove project records and save the project goal after approval.", ["init_dove_goal"], [
    "The preview is strictly zero-write; approval creates only the minimal project records and required directories.",
    "Keep schema versions, workspace identifiers, hashes, proposal tokens, confirmation payloads, replay fields, generated commands, and internal paths out of user-facing answers.",
    "Use the returned approval wording for the visible confirmation; keep integrity verification and the generated confirmation command internal.",
    "Legacy or invalid state requires an explicit archive reset with no import, repair, fallback, or alias."
  ], { dailyFlow: ["Preview what initialization will establish without creating or changing files.", "Ask whether to create Dove project records and save the current project goal."], targetingBehavior: "Initialization applies only to the current project.", confirmationBehavior: "Show one plain-language approve-or-cancel question; never display internal confirmation data.", expectedOutcome: "The project has minimal Dove records and its stated goal, without creating workflow tasks or runtime state.", examples: ["/dove:init Initialize this research workspace", "/dove:init Replace invalid Dove project records and initialize again"] }),
  surface("dove.mission", "Dove mission", "mutation", "explicit-approval", "Propose and persist one minimal mission contract or reevaluate its research decision tree.", ["create_dove_mission"], [
    "For mission creation, call create_dove_mission directly; never call query_dove_mission as a preliminary preview because the create tool already performs the zero-write preview, approval, and application.",
    "Create persists only goal, scope, out-of-scope, target and expected artifacts, completion criteria, evidence requirements, dependencies, and supersession metadata.",
    "Target and expected artifacts must be canonical workspace-relative file paths, never prose descriptions. Evidence requirements are optional; omit them unless they can be expressed exactly as artifact:<path>, validation:<path>, or note:<id>, and never invent free-form evidence requirement text.",
    "Research-tree reevaluation records explicit retrieval or experiment decisions, terminal outcomes, and draft failure lessons without adding a new public surface.",
    "Every proposal is zero-write; confirmation must exactly replay the returned contract or research-tree diff."
  ], { dailyFlow: ["Turn one concrete goal into a minimal mission contract.", "Reevaluate the mission research tree only from explicit current requirements and node outcomes."], targetingBehavior: "The host keeps one private safe mission id for the current checkpoint and optional outcome closure; no packet target is resolved and the id is not shown to the user.", confirmationBehavior: "Approve the exact proposal, adjust it, or cancel.", expectedOutcome: "One durable mission contract or research-tree revision exists without orchestration state.", examples: ["/dove:mission Validate the new retrieval method", "/dove:mission Reevaluate the research tree for mission <id>"] }),
  surface("dove.status", "Dove status", "query", "read-only", "Read schema 9 mission and evidence integrity without refreshing state.", ["query_dove_status"], [
    "Absent state returns needs-init; malformed, legacy, contradictory, or future state fails closed.",
    "Compact status reports only schema health, mission count, receipt count, source count, and live integrity."
  ], { dailyFlow: ["Inspect current schema and integrity without writes.", "Pass missionId to scope completion, source, domain, and review checks; when more than one mission exists, choose explicitly."], targetingBehavior: "With zero missions status reports none; with one mission it scopes to the only mission; with multiple missions it never selects an implicit latest mission.", confirmationBehavior: "No confirmation is applicable because status is read-only.", expectedOutcome: "The operator sees stable gaps and one existing command or tool to run next.", examples: ["/dove:status", "/dove:status Show integrity for mission <id>"] }),
  surface("dove.lessons", "Dove lessons", "mutation", "guarded-mutation", "Query advisory lessons by default or explicitly record one mission-provenanced lesson.", ["query_dove_lessons", "record_dove_lesson"], [
    "Default behavior is an explicit read-only query; never auto-capture a lesson and never auto-recall lessons from another command.",
    "Every lesson retains its recording mission as provenance; global scope means broad applicability, not provenance detached from that mission.",
    "The only lesson kinds are preference, constraint, method, failure, and review-insight.",
    "An explicit record request authorizes that one advisory lesson write without a second confirmation.",
    "Lessons never grant authority, satisfy completion, replace current evidence checks, become mission output artifacts, import transcripts, write Trellis state, or create runtime memory."
  ], { dailyFlow: ["Query only the lessons explicitly requested for the current mission, kind, tags, or artifact scope.", "Use record only when the operator explicitly asks to preserve a specific lesson."], targetingBehavior: "Query may include globally applicable lessons and current mission-scoped lessons while preserving each recording mission; artifact filters require an explicit missionId.", confirmationBehavior: "Query is read-only. An explicit record request authorizes only that lesson write and does not ask again.", expectedOutcome: "The operator receives current advisory guidance or one immutable advisory lesson with evidence lineage.", examples: ["/dove:lessons Query method lessons for the current mission", "/dove:lessons Record this explicit review insight"] }),
  surface("dove.version", "Dove version", "mutation", "guarded-mutation", "Snapshot current mission artifacts or compare two snapshots immediately without writes.", ["create_version_snapshot", "compare_versions"], [
    "Snapshots are immutable ids and contain current hashes and receipt lineage.",
    "Comparison rejects stale snapshots and returns the current artifact differences without persisting a comparison artifact."
  ], { dailyFlow: ["Snapshot current mission artifacts before a meaningful revision.", "Compare two explicit snapshots with a zero-write query."], targetingBehavior: "Provide missionId and version ids explicitly.", confirmationBehavior: "Snapshot inputs must resolve to current mission-owned artifacts; comparison is read-only and requires no confirmation.", expectedOutcome: "Version snapshots are durable; hash comparison results are immediate and zero-write.", examples: ["/dove:version Snapshot the current draft", "/dove:version Compare the previous and current snapshots"] }),
  surface("dove.source", "Dove source", "mutation", "guarded-mutation", "Discover, query, register, or reject mission-bound source candidates.", ["search_network", "query_sources", "register_source", "verify_source"], [
    "Registration always creates a candidate and imports captured material under mission-owned source artifacts.",
    "Schema 9 stores only candidate or rejected source state; public verification is rejection-only and ordinary execution receipts never mint positive source authority."
  ], { dailyFlow: ["Use public network search when discovery is needed, then visibly capture the selected material with host tools.", "Register real external material with title or locator, query eligibility, or reject a candidate after an explicit audit."], targetingBehavior: "Provide missionId and sourceId explicitly for mission-bound source records.", confirmationBehavior: "Search and query are read-only; an explicit register or reject request authorizes that write. No candidate becomes trusted through public input.", expectedOutcome: "The selected source material is captured and its candidate identity, fingerprint, lifecycle, and eligibility are current.", examples: ["/dove:source Find and register a relevant public paper for the mission", "/dove:source Reject the candidate after checking the captured PDF"] }),
  surface("dove.note", "Dove note", "mutation", "guarded-mutation", "Write substantive mission-bound synthesis from current eligible evidence.", ["upsert_note"], [
    "A note requires summary, quote, claim, or open question plus at least one current mission-owned artifact, including a current note artifact when applicable.",
    "sourceIds remain ineligible until a trusted positive source verifier exists; candidate or rejected sources cannot authorize the write."
  ], { dailyFlow: ["Synthesize current mission-owned artifacts, including current note artifacts when applicable.", "Record claims, quotes, and open questions rather than empty bookkeeping."], targetingBehavior: "Provide missionId and noteId explicitly.", confirmationBehavior: "Ineligible or cross-mission evidence stops the write.", expectedOutcome: "A substantive note with current evidence lineage exists.", examples: ["/dove:note Summarize the current mission artifacts", "/dove:note Record the open methodological question"] }),
  surface("dove.figure", "Dove figure", "mutation", "guarded-mutation", "Prepare or import a mission-bound figure with caption, provenance, QA, and review boundary.", ["run_figure_workflow"], [
    "Provider execution stays host-side; Dove accepts only current imported output with a matching hash.",
    "Clean QA remains diagnostic and imported output stays ready for independent review."
  ], { dailyFlow: ["Gather current mission materials and record a drawing prompt.", "Import host-produced output with caption and QA when available."], targetingBehavior: "Provide missionId, figureId, and material artifact paths explicitly.", confirmationBehavior: "Binary imports use direct-process; patch-plan supports SVG only.", expectedOutcome: "The figure is prepared, ready for independent review, or needs fixes.", examples: ["/dove:figure Prepare the method overview figure", "/dove:figure Import the generated SVG with its caption"] }),
  surface("dove.experience", "Dove experience", "mutation", "guarded-mutation", "Record one mission-bound experiment protocol, result, audit, and optional claim bridge.", ["run_experience_workflow", "upsert_claims"], [
    "The protocol, result, audit, and claim bridge use one implementation and one preflighted write set.",
    "Results require current evidence; claim bridges require a clean audit and a current mission claim."
  ], { dailyFlow: ["Record a concrete protocol and success criteria.", "Add current result evidence, audit findings, and claim impact when available."], targetingBehavior: "Provide missionId and experimentId explicitly.", confirmationBehavior: "Integrity flags prevent claim bridging.", expectedOutcome: "Experiment evidence and claim impact are linked without scheduling execution.", examples: ["/dove:experience Record the ablation protocol", "/dove:experience Audit the result and bridge it to the claim"] }),
  surface("dove.draft", "Dove draft", "mutation", "guarded-mutation", "Write a real mission-bound draft body or metadata for an existing draft.", ["upsert_draft", "upsert_draft_metadata"], [
    "Body writes require non-empty substantive text and current evidence lineage.",
    "Metadata-only updates require an existing current mission-owned draft."
  ], { dailyFlow: ["Write or revise real draft text from current evidence.", "Use metadata-only mode only for an existing draft."], targetingBehavior: "Provide missionId and draftId explicitly.", confirmationBehavior: "Cross-mission or stale evidence stops the write.", expectedOutcome: "A real draft artifact and canonical receipt exist.", examples: ["/dove:draft Write the methods section", "/dove:draft Update metadata for the current draft"] }),
  surface("dove.review", "Dove review", "mutation", "guarded-mutation", "Preflight, prepare, import, or verify one policy-scoped schema 9 review exchange without reviewer orchestration.", ["prepare_review_exchange", "import_review_exchange", "verify_review_coverage"], [
    "Policy expresses input scope only: local-preflight, isolated-selected-artifacts, final-plan-results-only, or external.",
    "local-preflight is strictly zero-write and non-authoritative; other policies freeze only current mission-owned artifact snapshots.",
    "Prepare writes canonical input and manifest artifacts owned together by one preparation receipt; import validates that ledger anchor before accepting the canonical handoff and report.",
    "Only completed coherent, needs-revision, or needs-evidence returns count as coverage; blocked or failed returns remain durable but ineligible, and every finding links an in-scope artifact.",
    "Imported public review material remains non-authoritative; caller-supplied reviewer identity, verdict, report, handoff, or manifest fields never mint Reviewer authority.",
    "Dove does not launch a reviewer, session, subagent, process, loop, or board transition."
  ], { dailyFlow: ["Use local-preflight for a zero-write exact scope check.", "Prepare a policy-scoped exchange, let an independent external process or person produce the declared files, then import and verify coverage."], targetingBehavior: "Provide missionId and explicit policy artifact paths; import also requires exchangeId and reviewId.", confirmationBehavior: "Prepare/import are guarded mutations; preflight and coverage verification are read-only.", expectedOutcome: "A tamper-evident mission-bound review and exact current coverage assessment exist without self-issued authority.", examples: ["/dove:review Preflight the current methods artifacts", "/dove:review Import the returned review exchange"] }),
  surface("dove.rebuttal", "Dove rebuttal", "mutation", "guarded-mutation", "Normalize reviewer findings and write author-side evidence-linked responses.", ["normalize_rebuttal_issues", "build_rebuttal_strategy", "build_rebuttal"], [
    "Every issue must link to a current mission-owned review artifact and concrete finding id.",
    "Strategy and responses remain author-side and reject stale issues, stale strategy, or missing evidence."
  ], { dailyFlow: ["Normalize concrete reviewer findings before strategy.", "Write evidence-linked author responses without claiming Reviewer authority."], targetingBehavior: "Provide missionId and finding references explicitly.", confirmationBehavior: "Unsupported findings or responses stop before writing.", expectedOutcome: "Issues, strategy, and response text retain current finding and evidence lineage.", examples: ["/dove:rebuttal Normalize the reviewer findings", "/dove:rebuttal Draft evidence-backed responses"] })
];
var COMMAND_SURFACES = commandSurfaces.map((command3) => {
  const interaction = COMMAND_INTERACTION_CONTRACTS[command3.id];
  if (!interaction) throw new Error(`Missing command interaction contract: ${command3.id}`);
  return { ...command3, ...interaction };
});
var COMMAND_SURFACE_BY_ID = Object.fromEntries(COMMAND_SURFACES.map((item) => [item.id, item]));
function commandIdToSlug(commandId) {
  return commandId.replace(/^dove\./u, "");
}
function hostCommandSlug(commandId) {
  return commandIdToSlug(commandId).replace(/\./gu, "-");
}
function adapterPathForCommand(hostId, command3) {
  const commandId = typeof command3 === "string" ? command3 : command3.id;
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
  return COMMAND_SURFACES.map((command3) => adapterPathForCommand(hostId, command3));
}
var HOST_ADAPTERS = Object.fromEntries(PROJECT_HOST_IDS.map((hostId) => {
  const commandPaths = commandAdapterPathsForHost(hostId);
  const extraPaths = hostId === "opencode" ? [...OPENCODE_ROLE_SKILL_PATHS, ".opencode.json"] : hostId === "agents" ? ["AGENTS.md"] : [];
  return [hostId, { label: HOST_DEFINITIONS[hostId].label, paths: [...commandPaths, ...extraPaths], requiredPaths: [...commandPaths, ...extraPaths], jsonChecks: HOST_DEFINITIONS[hostId].jsonChecks }];
}));
var RETIRED_COMMAND_SLUGS = Object.freeze([
  "auto",
  "operator",
  "review-loop",
  "orchestrate",
  "plan",
  "checklist",
  "audit",
  "autonomy-operate",
  "return",
  "follow-through",
  "governance-audit",
  "onboard",
  "launch",
  "approvals",
  "kill",
  "planner",
  "builder",
  "reviewer"
]);
var RETIRED_OPENCODE_ROLE_SKILLS = Object.freeze([
  "dove-pipeline",
  "dove-researcher",
  "dove-rebuttal-strategist",
  "dove-experiment-planning",
  "dove-version-analyst",
  "dove-claim-gate",
  "dove-citation-discipline",
  "dove-rebuttal",
  "dove-review-loop"
]);
var CURRENT_MANAGED_PATHS = Object.freeze({
  core: Object.freeze([...CORE_INSTALL_PATHS]),
  opencode: Object.freeze([...HOST_ADAPTERS.opencode.paths]),
  codex: Object.freeze([...HOST_ADAPTERS.codex.paths]),
  cursor: Object.freeze([...HOST_ADAPTERS.cursor.paths]),
  agents: Object.freeze([...HOST_ADAPTERS.agents.paths]),
  claude: Object.freeze(commandAdapterPathsForHost("claude"))
});
var RETIRED_MANAGED_PATHS = Object.freeze({
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
    ...RETIRED_COMMAND_SLUGS.map((slug) => `commands/dove/${slug}.md`),
    "commands/dove/paper/draft.md"
  ])
});
var MANAGED_PACKAGE_PATHS = Object.freeze([
  ...CURRENT_MANAGED_PATHS.opencode,
  ...CURRENT_MANAGED_PATHS.codex,
  ...CURRENT_MANAGED_PATHS.cursor,
  ...CURRENT_MANAGED_PATHS.agents,
  ...CURRENT_MANAGED_PATHS.core
]);

// src/core/contained-write.mjs
import fs from "node:fs";
import path2 from "node:path";
function pathEscapesRoot(relativePath) {
  return relativePath === ".." || relativePath.startsWith(`..${path2.sep}`) || path2.isAbsolute(relativePath);
}
function existingAncestor(fsOps, candidatePath) {
  let currentPath = candidatePath;
  while (!fsOps.existsSync(currentPath)) {
    const parentPath = path2.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
  }
  return currentPath;
}
function realpathNative(fsOps, targetPath) {
  return typeof fsOps.realpathSync?.native === "function" ? fsOps.realpathSync.native(targetPath) : fsOps.realpathSync(targetPath);
}
function resolveCanonicalContainedWrite(root, candidatePath, options = {}) {
  const label = options.label ?? "Write path";
  const fsOps = options.fsOps ?? fs;
  const resolvedRoot = path2.resolve(root);
  const canonicalRoot = realpathNative(fsOps, resolvedRoot);
  const requestedPath = path2.isAbsolute(candidatePath) ? path2.resolve(candidatePath) : path2.resolve(resolvedRoot, candidatePath);
  const requestedRelative = path2.relative(resolvedRoot, requestedPath);
  if (!requestedRelative || pathEscapesRoot(requestedRelative)) {
    throw new Error(`${label} must stay inside the canonical root: ${candidatePath}`);
  }
  let currentPath = resolvedRoot;
  for (const component of requestedRelative.split(path2.sep)) {
    currentPath = path2.join(currentPath, component);
    let stat;
    try {
      stat = fsOps.lstatSync(currentPath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        break;
      }
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`${label} must not contain symbolic links: ${candidatePath}`);
    }
  }
  const canonicalAncestor = realpathNative(fsOps, existingAncestor(fsOps, requestedPath));
  const canonicalRelative = path2.relative(canonicalRoot, canonicalAncestor);
  if (pathEscapesRoot(canonicalRelative)) {
    throw new Error(`${label} must stay inside the canonical root: ${candidatePath}`);
  }
  return {
    root: canonicalRoot,
    relativePath: requestedRelative.split(path2.sep).join("/"),
    fullPath: path2.join(canonicalRoot, requestedRelative)
  };
}

// src/core/execution-receipts.mjs
import crypto9 from "node:crypto";
import fs15 from "node:fs";
import path18 from "node:path";

// src/core/artifact-integrity.mjs
import fs4 from "node:fs";
import path5 from "node:path";

// src/core/schema.mjs
var DOVE_WORKSPACE_SCHEMA_VERSION = 9;
var PACKAGE_VERSION = "0.4.0";
var DOVE_RESPONSE_LANGUAGES = Object.freeze(["zh", "en"]);
var ARTIFACT_PATHS = Object.freeze({
  doveRoot: ".dove",
  doveRootManifest: ".dove/manifest.json",
  projectIdentity: ".dove/project.json",
  missionsDir: ".dove/missions",
  researchTreesDir: ".dove/research-trees",
  lessonsDir: ".dove/lessons",
  receiptsDir: ".dove/receipts",
  executionReceiptsDir: ".dove/receipts/execution",
  completionReceiptsDir: ".dove/receipts/completion",
  authorityReceiptsDir: ".dove/receipts/authority",
  artifactsDir: ".dove/artifacts",
  sourcesDir: ".dove/sources",
  notesDir: ".dove/notes",
  claimsDir: ".dove/claims",
  experimentsDir: ".dove/experiments",
  draftsDir: ".dove/drafts",
  figuresDir: ".dove/figures",
  reviewsDir: ".dove/reviews",
  reviewExchangesDir: ".dove/reviews/exchanges",
  rebuttalDir: ".dove/rebuttal",
  versionsDir: ".dove/versions"
});
function governanceScopeMetadata(mutationScope) {
  return Object.freeze({
    mutationScope,
    requiresMissionId: mutationScope !== "project-identity",
    artifactFields: []
  });
}
var GUARDED_MUTATIONS = [
  ["init-dove-goal", "Creating minimal Dove project identity", ARTIFACT_PATHS.projectIdentity, "initDoveGoal", "init_dove_goal", ["dove.init"], "project-identity"],
  ["create-dove-mission", "Persisting one minimal mission contract", ARTIFACT_PATHS.missionsDir, "createDoveMission", "create_dove_mission", ["dove.mission"], "mission-contract"],
  ["record-dove-lesson", "Recording an immutable mission-provenanced lesson", ARTIFACT_PATHS.lessonsDir, "recordDoveLesson", "record_dove_lesson", ["dove.lessons"], "mission-domain"],
  ["ingest-execution-receipt", "Ingesting an immutable execution receipt", ARTIFACT_PATHS.executionReceiptsDir, "ingestExecutionReceipt", "ingest_execution_receipt", [], "mission-receipt"],
  ["close-host-outcome", "Recording current host-produced mission outcomes", ARTIFACT_PATHS.executionReceiptsDir, "closeHostOutcome", "close_host_outcome", [], "mission-receipt"],
  ["register-source", "Registering a mission-bound source candidate", ARTIFACT_PATHS.sourcesDir, "registerSource", "register_source", ["dove.source"], "mission-domain"],
  ["verify-source", "Rejecting a mission-bound source candidate", ARTIFACT_PATHS.sourcesDir, "verifySource", "verify_source", ["dove.source"], "mission-domain"],
  ["upsert-note", "Recording a mission-bound evidence note", ARTIFACT_PATHS.notesDir, "upsertNote", "upsert_note", ["dove.note"], "mission-domain"],
  ["upsert-claims", "Recording mission-bound evidence-backed claims", ARTIFACT_PATHS.claimsDir, "upsertClaims", "upsert_claims", ["dove.experience"], "mission-domain"],
  ["run-experience-workflow", "Recording a mission-bound experiment", ARTIFACT_PATHS.experimentsDir, "runExperienceWorkflow", "run_experience_workflow", ["dove.experience"], "mission-domain"],
  ["upsert-draft", "Writing a mission-bound draft", ARTIFACT_PATHS.draftsDir, "upsertDraft", "upsert_draft", ["dove.draft"], "mission-domain"],
  ["upsert-draft-metadata", "Writing metadata for a mission-bound draft", ARTIFACT_PATHS.draftsDir, "upsertDraftMetadata", "upsert_draft_metadata", ["dove.draft"], "mission-domain"],
  ["run-figure-workflow", "Preparing or importing a mission-bound figure", ARTIFACT_PATHS.figuresDir, "runFigureWorkflow", "run_figure_workflow", ["dove.figure"], "mission-domain"],
  ["prepare-review-exchange", "Preparing a frozen mission-bound review exchange", ARTIFACT_PATHS.reviewExchangesDir, "prepareReviewExchange", "prepare_review_exchange", ["dove.review"], "mission-review"],
  ["import-review-exchange", "Importing a verified mission-bound review exchange", ARTIFACT_PATHS.reviewsDir, "importReviewExchange", "import_review_exchange", ["dove.review"], "mission-review"],
  ["normalize-rebuttal-issues", "Normalizing mission-bound review findings", ARTIFACT_PATHS.rebuttalDir, "normalizeRebuttalIssues", "normalize_rebuttal_issues", ["dove.rebuttal"], "mission-domain"],
  ["build-rebuttal-strategy", "Recording an author-side rebuttal strategy", ARTIFACT_PATHS.rebuttalDir, "buildRebuttalStrategy", "build_rebuttal_strategy", ["dove.rebuttal"], "mission-domain"],
  ["build-rebuttal", "Writing evidence-linked author responses", ARTIFACT_PATHS.rebuttalDir, "buildRebuttal", "build_rebuttal", ["dove.rebuttal"], "mission-domain"],
  ["create-version-snapshot", "Snapshotting current mission artifacts", ARTIFACT_PATHS.versionsDir, "createVersionSnapshot", "create_version_snapshot", ["dove.version"], "mission-domain"]
];
var GOVERNANCE_GUARDED_MUTATIONS = Object.freeze(GUARDED_MUTATIONS.map(([id, action, artifactPath, coreFunction, mcpTool, commandIds, scope]) => Object.freeze({
  id,
  action,
  artifactPath,
  surfaceBindings: Object.freeze({ coreFunction, mcpTool, commandIds: Object.freeze(commandIds) }),
  ...governanceScopeMetadata(scope)
})));
var GOVERNANCE_EXEMPT_MUTATIONS = Object.freeze([]);
var GOVERNANCE_READONLY_COMMANDS = Object.freeze(["dove.status"]);
var GOVERNANCE_READONLY_TOOLS = Object.freeze([
  "query_dove_mission",
  "query_dove_status",
  "assess_mission_completion",
  "search_network",
  "query_network_search_providers",
  "query_sources",
  "query_dove_lessons",
  "verify_review_coverage",
  "compare_versions"
]);
var NEGATIVE_TESTS = Object.freeze({
  "init-dove-goal": "initialization rejects stale or mismatched confirmation without writing",
  "create-dove-mission": "mission confirmation rejects replay drift without writing",
  "record-dove-lesson": "lesson confirmation rejects workspace, contract, mutation mode, content, supersession, and reference drift without writing",
  "ingest-execution-receipt": "receipt ingestion validates current contracts, paths, hashes, and evidence before writing",
  "close-host-outcome": "host outcome closure accepts only current mission-bound files, generates receipt metadata internally, and skips without writing when no uncovered artifact remains",
  "register-source": "source registration requires an explicit mission and creates candidate evidence only",
  "verify-source": "public source verification cannot mint positive trust authority",
  "upsert-note": "notes reject stale, cross-mission, or ineligible evidence before writing",
  "upsert-claims": "claims reject missing, stale, or cross-mission evidence before writing",
  "run-experience-workflow": "experiment result, audit, and claim bridge preflight one atomic write set",
  "upsert-draft": "drafts require explicit mission binding and current evidence",
  "upsert-draft-metadata": "draft metadata requires a current mission-owned draft",
  "run-figure-workflow": "figure import validates current materials, output hash, and review coverage before writing",
  "prepare-review-exchange": "review preparation rejects unsafe or cross-mission paths before writing",
  "import-review-exchange": "review import rejects tampering, drift, symlinks, and caller-minted authority before writing",
  "normalize-rebuttal-issues": "rebuttal issues require current mission-bound findings and evidence",
  "build-rebuttal-strategy": "rebuttal strategy requires current normalized issues",
  "build-rebuttal": "author responses preflight issues, strategy, and evidence before writing",
  "create-version-snapshot": "version snapshots reject stale or cross-mission artifacts and preserve immutable copies"
});
var GOVERNANCE_NEGATIVE_COVERAGE = Object.freeze(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => Object.freeze({
  id: entry.id,
  level: "dynamic",
  tests: Object.freeze([NEGATIVE_TESTS[entry.id]])
})));

// src/core/mutation-backend.mjs
import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import fs3 from "node:fs";
import path4 from "node:path";

// src/core/anchored-filesystem.mjs
import fs2 from "node:fs";
import path3 from "node:path";
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function normalizeRelativePath(relativePath, label = "Filesystem path") {
  if (typeof relativePath !== "string" || !relativePath.trim()) throw new Error(`${label} must be a non-empty relative path.`);
  const normalized = path3.posix.normalize(relativePath.replace(/\\/gu, "/"));
  if (path3.isAbsolute(relativePath) || normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("\0")) {
    throw new Error(`${label} must stay inside the anchored root: ${relativePath}`);
  }
  return normalized;
}
function requiredFunction(fsOps, name) {
  if (typeof fsOps?.[name] !== "function") throw new Error(`Anchored filesystem requires fsOps.${name}().`);
  return fsOps[name].bind(fsOps);
}
function realpathNative2(fsOps, targetPath) {
  const realpath = requiredFunction(fsOps, "realpathSync");
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(targetPath) : realpath(targetPath);
}
function anchoredFilesystemCapability(options = {}) {
  const fsOps = options.fsOps ?? fs2;
  const platform = options.platform ?? process.platform;
  const procFdRoot = options.procFdRoot ?? "/proc/self/fd";
  if (platform !== "linux") return { supported: false, reason: "direct-process anchored writes require Linux" };
  const constants = fsOps.constants ?? fs2.constants;
  if (!Number.isInteger(constants?.O_DIRECTORY) || !Number.isInteger(constants?.O_NOFOLLOW)) {
    return { supported: false, reason: "direct-process anchored writes require O_DIRECTORY and O_NOFOLLOW" };
  }
  try {
    const stat = requiredFunction(fsOps, "statSync")(procFdRoot);
    if (!stat.isDirectory()) return { supported: false, reason: `${procFdRoot} is not a directory` };
  } catch (error) {
    return { supported: false, reason: `direct-process anchored writes require readable ${procFdRoot}: ${errorMessage(error)}` };
  }
  return { supported: true, reason: null, procFdRoot };
}
function requireAnchoredFilesystemCapability(options = {}) {
  const capability = anchoredFilesystemCapability(options);
  if (!capability.supported) throw new Error(`Direct-process mutation is unavailable: ${capability.reason}. Use mutationMode: patch-plan or a read-only operation instead.`);
  return capability;
}
var AnchoredFilesystem = class {
  constructor(root, options = {}) {
    this.fsOps = options.fsOps ?? fs2;
    this.constants = this.fsOps.constants ?? fs2.constants;
    this.procFdRoot = options.procFdRoot ?? "/proc/self/fd";
    requireAnchoredFilesystemCapability({ ...options, fsOps: this.fsOps, procFdRoot: this.procFdRoot });
    const openSync = requiredFunction(this.fsOps, "openSync");
    const resolvedRoot = path3.resolve(root);
    try {
      this.rootFd = openSync(resolvedRoot, this.constants.O_RDONLY | this.constants.O_DIRECTORY | this.constants.O_NOFOLLOW);
    } catch (error) {
      throw new Error(`Unable to anchor workspace root without following links: ${resolvedRoot}: ${errorMessage(error)}`, { cause: error });
    }
    this.rootHandlePath = path3.posix.join(this.procFdRoot, String(this.rootFd));
    try {
      this.root = realpathNative2(this.fsOps, this.rootHandlePath);
    } catch (error) {
      this.close();
      throw new Error(`Unable to resolve anchored workspace root: ${errorMessage(error)}`, { cause: error });
    }
    this.closed = false;
  }
  assertOpen() {
    if (this.closed) throw new Error("Anchored filesystem is closed.");
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.rootFd !== void 0) requiredFunction(this.fsOps, "closeSync")(this.rootFd);
  }
  normalize(relativePath, label) {
    return normalizeRelativePath(relativePath, label);
  }
  displayPath(relativePath) {
    return path3.join(this.root, this.normalize(relativePath));
  }
  openDirectory(relativePath = null) {
    this.assertOpen();
    if (relativePath === null || relativePath === "" || relativePath === ".") {
      return { fd: this.rootFd, handlePath: this.rootHandlePath, relativePath: "", owned: false };
    }
    const normalized = this.normalize(relativePath, "Directory path");
    let currentFd = this.rootFd;
    let owned = false;
    let currentRelative = "";
    try {
      for (const component of normalized.split("/")) {
        const currentHandle = path3.posix.join(this.procFdRoot, String(currentFd));
        const candidate = path3.posix.join(currentHandle, component);
        const nextFd = requiredFunction(this.fsOps, "openSync")(candidate, this.constants.O_RDONLY | this.constants.O_DIRECTORY | this.constants.O_NOFOLLOW);
        if (owned) requiredFunction(this.fsOps, "closeSync")(currentFd);
        currentFd = nextFd;
        owned = true;
        currentRelative = currentRelative ? `${currentRelative}/${component}` : component;
      }
      return { fd: currentFd, handlePath: path3.posix.join(this.procFdRoot, String(currentFd)), relativePath: currentRelative, owned };
    } catch (error) {
      if (owned) requiredFunction(this.fsOps, "closeSync")(currentFd);
      throw error;
    }
  }
  closeDirectory(directory) {
    if (directory?.owned === true && directory.fd !== void 0) requiredFunction(this.fsOps, "closeSync")(directory.fd);
  }
  withParent(relativePath, callback) {
    const normalized = this.normalize(relativePath);
    const parentRelative = path3.posix.dirname(normalized);
    const parent = this.openDirectory(parentRelative === "." ? null : parentRelative);
    const name = path3.posix.basename(normalized);
    try {
      return callback({ normalized, parent, name, handlePath: path3.posix.join(parent.handlePath, name) });
    } finally {
      this.closeDirectory(parent);
    }
  }
  lstat(relativePath) {
    return this.withParent(relativePath, ({ handlePath }) => requiredFunction(this.fsOps, "lstatSync")(handlePath));
  }
  tryLstat(relativePath) {
    try {
      return this.lstat(relativePath);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }
  exists(relativePath) {
    return this.tryLstat(relativePath) !== null;
  }
  openFile(relativePath, flags, mode) {
    return this.withParent(relativePath, ({ handlePath }) => requiredFunction(this.fsOps, "openSync")(handlePath, flags | this.constants.O_NOFOLLOW, mode));
  }
  inspectRegularFile(relativePath) {
    const fd = this.openFile(relativePath, this.constants.O_RDONLY | (this.constants.O_NONBLOCK ?? 0));
    try {
      const stat = requiredFunction(this.fsOps, "fstatSync")(fd);
      if (!stat.isFile()) throw new Error(`Anchored read target must be a regular file: ${relativePath}`);
      return stat;
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }
  readFile(relativePath) {
    const fd = this.openFile(relativePath, this.constants.O_RDONLY);
    try {
      const stat = requiredFunction(this.fsOps, "fstatSync")(fd);
      if (!stat.isFile()) throw new Error(`Anchored read target must be a regular file: ${relativePath}`);
      return Buffer.from(requiredFunction(this.fsOps, "readFileSync")(fd));
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }
  writeNewFile(relativePath, content, options = {}) {
    const mode = options.mode ?? 384;
    const fd = this.openFile(relativePath, this.constants.O_WRONLY | this.constants.O_CREAT | this.constants.O_EXCL, mode);
    try {
      requiredFunction(this.fsOps, "writeFileSync")(fd, content, options.encoding);
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }
  chmod(relativePath, mode) {
    const fd = this.openFile(relativePath, this.constants.O_RDONLY);
    try {
      requiredFunction(this.fsOps, "fchmodSync")(fd, mode);
    } finally {
      requiredFunction(this.fsOps, "closeSync")(fd);
    }
  }
  mkdir(relativePath, options = {}) {
    const normalized = this.normalize(relativePath, "Directory path");
    if (options.recursive === true) {
      let current = "";
      for (const component of normalized.split("/")) {
        current = current ? `${current}/${component}` : component;
        const stat = this.tryLstat(current);
        if (stat) {
          if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Anchored directory component is not a real directory: ${current}`);
          continue;
        }
        this.mkdir(current, { mode: options.mode });
      }
      return;
    }
    this.withParent(normalized, ({ handlePath }) => requiredFunction(this.fsOps, "mkdirSync")(handlePath, { recursive: false, ...options.mode === void 0 ? {} : { mode: options.mode }, anchoredPath: normalized, displayPath: this.displayPath(normalized) }));
  }
  readdir(relativePath = null, options = {}) {
    const directory = this.openDirectory(relativePath);
    try {
      return requiredFunction(this.fsOps, "readdirSync")(directory.handlePath, options);
    } finally {
      this.closeDirectory(directory);
    }
  }
  rename(fromRelativePath, toRelativePath) {
    const from = this.normalize(fromRelativePath, "Rename source");
    const to = this.normalize(toRelativePath, "Rename destination");
    const fromParent = this.openDirectory(path3.posix.dirname(from) === "." ? null : path3.posix.dirname(from));
    const toParent = this.openDirectory(path3.posix.dirname(to) === "." ? null : path3.posix.dirname(to));
    try {
      const sourcePath2 = path3.posix.join(fromParent.handlePath, path3.posix.basename(from));
      const sourceStat = requiredFunction(this.fsOps, "lstatSync")(sourcePath2);
      if (sourceStat.isSymbolicLink()) throw new Error(`Anchored rename source must not be a symbolic link: ${from}`);
      const destinationPath = path3.posix.join(toParent.handlePath, path3.posix.basename(to));
      try {
        const destinationStat = requiredFunction(this.fsOps, "lstatSync")(destinationPath);
        if (destinationStat.isSymbolicLink()) throw new Error(`Anchored rename destination must not be a symbolic link: ${to}`);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      requiredFunction(this.fsOps, "renameSync")(sourcePath2, destinationPath, { anchoredFrom: from, anchoredTo: to, displayFrom: this.displayPath(from), displayTo: this.displayPath(to) });
    } finally {
      this.closeDirectory(toParent);
      this.closeDirectory(fromParent);
    }
  }
  unlink(relativePath, options = {}) {
    try {
      this.withParent(relativePath, ({ handlePath }) => {
        const stat = requiredFunction(this.fsOps, "lstatSync")(handlePath);
        if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Anchored unlink target must be a regular file: ${relativePath}`);
        requiredFunction(this.fsOps, "unlinkSync")(handlePath, { anchoredPath: this.normalize(relativePath), displayPath: this.displayPath(relativePath) });
      });
    } catch (error) {
      if (options.force === true && error?.code === "ENOENT") return;
      throw error;
    }
  }
  rmdir(relativePath, options = {}) {
    try {
      const normalized = this.normalize(relativePath);
      this.withParent(normalized, ({ handlePath }) => requiredFunction(this.fsOps, "rmdirSync")(handlePath, { anchoredPath: normalized, displayPath: this.displayPath(normalized), recursiveCleanup: options.recursiveCleanup === true }));
    } catch (error) {
      if (options.force === true && error?.code === "ENOENT") return;
      throw error;
    }
  }
  remove(relativePath, options = {}) {
    const normalized = this.normalize(relativePath, "Removal path");
    const stat = this.tryLstat(normalized);
    if (!stat) {
      if (options.force === true) return;
      const error = new Error(`Anchored removal target does not exist: ${normalized}`);
      error.code = "ENOENT";
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Anchored removal target must not be a symbolic link: ${normalized}`);
    if (stat.isDirectory()) {
      if (options.recursive !== true) return this.rmdir(normalized);
      const directory = this.openDirectory(normalized);
      try {
        const entries = requiredFunction(this.fsOps, "readdirSync")(directory.handlePath, { withFileTypes: true });
        for (const entry of entries) {
          const childPath = `${normalized}/${entry.name}`;
          const childHandlePath = path3.posix.join(directory.handlePath, entry.name);
          const childStat = requiredFunction(this.fsOps, "lstatSync")(childHandlePath);
          if (childStat.isSymbolicLink()) throw new Error(`Anchored cleanup encountered a symbolic link: ${childPath}`);
          if (childStat.isDirectory()) this.remove(childPath, { recursive: true, force: false });
          else if (childStat.isFile()) this.unlink(childPath);
          else throw new Error(`Anchored cleanup encountered an unsupported path type: ${childPath}`);
        }
      } finally {
        this.closeDirectory(directory);
      }
      return this.rmdir(normalized, { force: options.force, recursiveCleanup: true });
    }
    if (stat.isFile()) return this.unlink(normalized, { force: options.force });
    throw new Error(`Anchored removal target has an unsupported path type: ${normalized}`);
  }
};
function openAnchoredFilesystem(root, options = {}) {
  return new AnchoredFilesystem(root, options);
}

// src/core/mutation-backend.mjs
var mutationStorage = new AsyncLocalStorage();
var DIRECT_PROCESS_ROLLBACK_REASON = "direct-process writes are performed by the Dove process, not by host-tracked file edits; native programming-terminal rollback does not track those writes.";
var PATCH_PLAN_ROLLBACK_ADVICE = "Use mutationMode: patch-plan and apply the returned operations through host-tracked file edits before relying on host rollback.";
var MAX_CLEANUP_RESIDUES = 20;
function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}
function errorMessage2(error) {
  return error instanceof Error ? error.message : String(error);
}
function normalizeMutationMode(value2) {
  if (value2 === void 0) return "direct-process";
  if (value2 === "patch-plan" || value2 === "direct-process") return value2;
  throw new Error("mutationMode must be either patch-plan or direct-process when explicitly provided.");
}
function normalizeRelativePath2(relativePath) {
  if (typeof relativePath !== "string" || !relativePath.trim()) {
    throw new Error("Mutation path must be a non-empty relative path.");
  }
  const normalized = path4.posix.normalize(relativePath.replace(/\\/g, "/"));
  if (path4.isAbsolute(relativePath) || normalized === "." || normalized.startsWith("../") || normalized === "..") {
    throw new Error(`Mutation path must stay inside the project: ${relativePath}`);
  }
  return normalized;
}
function classifyScope(relativePath) {
  if (relativePath === ".dove" || relativePath.startsWith(".dove/")) return ".dove";
  if (relativePath.startsWith(".opencode/") || relativePath.startsWith(".cursor/") || relativePath.startsWith(".codex/") || relativePath.startsWith(".agents/")) {
    return "generated-adapter";
  }
  return "explicit-external-output";
}
function serializeJson(value2) {
  return `${JSON.stringify(value2, null, 2)}
`;
}
function resultDeclaresWrites(value2) {
  return Boolean(value2) && typeof value2 === "object" && !Array.isArray(value2) && Array.isArray(value2.writes) && value2.writes.length > 0;
}
function pathType(stat) {
  if (stat.isFile()) return "file";
  if (stat.isDirectory()) return "directory";
  if (stat.isSymbolicLink()) return "symlink";
  return "other";
}
function directoryHash(directory, fsOps = fs3) {
  const entries = [];
  const visit = (current, prefix = "") => {
    for (const entry of fsOps.readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const fullPath = path4.join(current, entry.name);
      const relativePath = prefix ? path4.posix.join(prefix, entry.name) : entry.name;
      const stat = fsOps.lstatSync(fullPath);
      const type = pathType(stat);
      const metadata = { path: relativePath, type, mode: stat.mode & 4095 };
      if (type === "file") entries.push({ ...metadata, sha256: sha256(fsOps.readFileSync(fullPath)) });
      else if (type === "symlink") entries.push({ ...metadata, target: fsOps.readlinkSync(fullPath) });
      else {
        entries.push(metadata);
        if (type === "directory") visit(fullPath, relativePath);
      }
    }
  };
  visit(directory);
  return sha256(JSON.stringify(entries));
}
function diskPathState(fullPath, fsOps = fs3) {
  let stat;
  try {
    stat = fsOps.lstatSync(fullPath);
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, type: "absent", sha256: null, mode: null };
    throw error;
  }
  const type = pathType(stat);
  return {
    exists: true,
    type,
    sha256: type === "file" ? sha256(fsOps.readFileSync(fullPath)) : type === "directory" ? directoryHash(fullPath, fsOps) : type === "symlink" ? sha256(fsOps.readlinkSync(fullPath)) : null,
    mode: stat.mode & 4095
  };
}
function samePathState(left, right) {
  return left.exists === right.exists && left.type === right.type && left.sha256 === right.sha256;
}
function buildMutationId() {
  return `mutation-${crypto.randomUUID()}`;
}
function isInside(relativePath, directoryPath) {
  return relativePath === directoryPath || relativePath.startsWith(`${directoryPath}/`);
}
function pathDepth(relativePath) {
  return relativePath.split("/").length;
}
var MutationContext = class {
  constructor(root, options = {}) {
    const resolvedRoot = path4.resolve(root);
    this.root = typeof (options.fsOps ?? fs3).realpathSync.native === "function" ? (options.fsOps ?? fs3).realpathSync.native(resolvedRoot) : (options.fsOps ?? fs3).realpathSync(resolvedRoot);
    this.id = options.id ?? buildMutationId();
    this.actionId = options.actionId ?? "unspecified";
    this.mutationMode = normalizeMutationMode(options.mutationMode);
    this.mutationModeSource = options.mutationMode === "patch-plan" || options.mutationMode === "direct-process" ? "explicit" : "default";
    this.hostId = options.hostId ?? "unknown";
    this.createdAt = options.createdAt ?? (/* @__PURE__ */ new Date()).toISOString();
    this.fsOps = options.fsOps ?? fs3;
    if (this.mutationMode === "direct-process") requireAnchoredFilesystemCapability({ fsOps: this.fsOps, platform: options.platform, procFdRoot: options.procFdRoot });
    this.platform = options.platform;
    this.procFdRoot = options.procFdRoot;
    this.overlay = /* @__PURE__ */ new Map();
    this.virtualDirectories = /* @__PURE__ */ new Set();
    this.preconditions = /* @__PURE__ */ new Map();
    this.readSet = /* @__PURE__ */ new Map();
    this.snapshotCache = /* @__PURE__ */ new Map();
    this.operationsByPath = /* @__PURE__ */ new Map();
    this.operationOrder = [];
    this.directoryReplacements = /* @__PURE__ */ new Map();
    this.commitLocks = /* @__PURE__ */ new Map();
    this.commitState = { phase: "not-started", rollbackAttempted: false, cleanupFailures: [] };
    this.lifecycle = "active";
  }
  get patchPlanMode() {
    return this.mutationMode === "patch-plan";
  }
  assertActive(operation = "MutationContext operation") {
    if (this.lifecycle !== "active") throw new Error(`${operation} cannot use a ${this.lifecycle} MutationContext.`);
  }
  resolve(relativePath) {
    this.assertActive("Mutation path resolution");
    const normalized = normalizeRelativePath2(relativePath);
    return resolveCanonicalContainedWrite(this.root, normalized, { label: "Mutation path", fsOps: this.fsOps });
  }
  replacementFor(relativePath) {
    return [...this.directoryReplacements.keys()].find((directoryPath) => isInside(relativePath, directoryPath)) ?? null;
  }
  recordFirstTouch(normalized, fullPath) {
    if (!this.preconditions.has(normalized)) this.preconditions.set(normalized, diskPathState(fullPath, this.fsOps));
    return this.preconditions.get(normalized);
  }
  fileExists(relativePath) {
    const { relativePath: normalized, fullPath } = this.resolve(relativePath);
    if (this.overlay.has(normalized) || this.virtualDirectories.has(normalized)) return true;
    if (this.replacementFor(normalized)) return false;
    return this.fsOps.existsSync(fullPath);
  }
  readFileSnapshot(relativePath) {
    const { relativePath: normalized, fullPath } = this.resolve(relativePath);
    if (this.overlay.has(normalized)) {
      const content = this.overlay.get(normalized);
      const buffer = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(content, "utf8");
      return { relativePath: normalized, exists: true, type: "file", mode: null, sha256: sha256(buffer), buffer };
    }
    if (this.replacementFor(normalized)) return { relativePath: normalized, exists: false, type: "absent", mode: null, sha256: null, buffer: null };
    if (!this.snapshotCache.has(normalized)) {
      const initial = diskPathState(fullPath, this.fsOps);
      if (initial.exists && initial.type !== "file") throw new Error(`Mutation read target must be absent or a regular file: ${normalized}`);
      const buffer = initial.exists ? Buffer.from(this.fsOps.readFileSync(fullPath)) : null;
      const snapshot2 = { relativePath: normalized, ...initial, buffer };
      this.snapshotCache.set(normalized, snapshot2);
      this.readSet.set(normalized, initial);
    }
    const snapshot = this.snapshotCache.get(normalized);
    return { ...snapshot, buffer: snapshot.buffer === null ? null : Buffer.from(snapshot.buffer) };
  }
  readBuffer(relativePath, fallback = null) {
    const snapshot = this.readFileSnapshot(relativePath);
    if (!snapshot.exists) return typeof fallback === "function" ? fallback() : fallback === null ? null : Buffer.from(fallback);
    return Buffer.from(snapshot.buffer);
  }
  readText(relativePath, fallback = "") {
    const buffer = this.readBuffer(relativePath, null);
    return buffer === null ? fallback : buffer.toString("utf8");
  }
  readDirectory(relativePath) {
    const { relativePath: normalized, fullPath } = this.resolve(relativePath);
    if (this.replacementFor(normalized)) return [];
    if (this.snapshotCache.has(`${normalized}/`)) return structuredClone(this.snapshotCache.get(`${normalized}/`));
    const stat = diskPathState(fullPath, this.fsOps);
    if (!stat.exists) {
      this.readSet.set(normalized, stat);
      this.snapshotCache.set(`${normalized}/`, []);
      return [];
    }
    if (stat.type !== "directory") throw new Error(`Mutation directory read target must be a real directory: ${normalized}`);
    const entries = this.fsOps.readdirSync(fullPath, { withFileTypes: true }).map((entry) => ({ name: entry.name, type: entry.isFile() ? "file" : entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "other" })).sort((left, right) => left.name.localeCompare(right.name));
    this.readSet.set(normalized, stat);
    this.snapshotCache.set(`${normalized}/`, entries);
    return structuredClone(entries);
  }
  readJson(relativePath, fallback) {
    const text = this.readText(relativePath, null);
    if (text === null) return typeof fallback === "function" ? fallback() : structuredClone(fallback);
    return JSON.parse(text);
  }
  writeJson(relativePath, value2) {
    return this.writeText(relativePath, serializeJson(value2), "write-json");
  }
  writeJsonIfChanged(relativePath, value2) {
    const nextContent = serializeJson(value2);
    const currentContent = this.readText(relativePath, null);
    if (currentContent === nextContent) return false;
    this.writeText(relativePath, nextContent, "write-json");
    return true;
  }
  writeText(relativePath, content, kind = "write-text") {
    return this.writeContent(relativePath, String(content ?? ""), { kind, encoding: "utf8" });
  }
  writeBinary(relativePath, content, kind = "write-binary") {
    if (this.patchPlanMode) throw new Error("Binary mutations require direct-process mode; patch-plan cannot safely represent binary output.");
    const buffer = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(content);
    return this.writeContent(relativePath, buffer, { kind, encoding: "binary" });
  }
  writeContent(relativePath, content, { kind, encoding }) {
    const { relativePath: normalized, fullPath } = this.resolve(relativePath);
    const existing = this.operationsByPath.get(normalized);
    if (existing?.kind === "ensure-directory") throw new Error(`Mutation path cannot be both a directory and a file: ${normalized}`);
    const initial = this.recordFirstTouch(normalized, fullPath);
    if (!this.replacementFor(normalized) && initial.exists && initial.type !== "file") {
      throw new Error(`Mutation file target must be absent or a regular file: ${normalized}`);
    }
    const operation = {
      operationId: existing?.operationId ?? `op-${crypto.randomUUID()}`,
      mutationId: this.id,
      actionId: this.actionId,
      relativePath: normalized,
      kind,
      encoding,
      ...encoding === "utf8" ? { content } : { byteLength: content.byteLength },
      previousExists: initial.exists,
      previousSha256: initial.sha256,
      expectedPreviousSha256: initial.sha256,
      nextSha256: sha256(content),
      scope: classifyScope(normalized),
      rollbackEligibility: this.patchPlanMode ? "host-tracked-file-edits-required" : "dove-caught-failure-restore"
    };
    if (!existing) this.operationOrder.push(normalized);
    this.operationsByPath.set(normalized, operation);
    this.overlay.set(normalized, content);
    return operation;
  }
  appendText(relativePath, content) {
    const previous = this.readText(relativePath, "");
    return this.writeText(relativePath, `${previous}${String(content ?? "")}`, "append-as-write");
  }
  requireCommitPrecondition(relativePath) {
    this.assertActive("Mutation commit precondition registration");
    if (this.patchPlanMode) return null;
    const { relativePath: normalized, fullPath } = this.resolve(relativePath);
    this.recordFirstTouch(normalized, fullPath);
    return normalized;
  }
  requireCommitLock(relativePath, options = {}) {
    this.assertActive("Mutation commit lock registration");
    if (this.patchPlanMode) return null;
    const { relativePath: normalized, fullPath } = this.resolve(relativePath);
    if (this.fsOps.existsSync(fullPath)) throw new Error(`${options.label ?? "Mutation commit lock"} is already held: ${normalized}.`);
    this.commitLocks.set(normalized, { relativePath: normalized, fullPath, label: options.label ?? "Mutation commit lock" });
    return normalized;
  }
  ensureFile(relativePath, content) {
    if (this.fileExists(relativePath)) return false;
    this.writeText(relativePath, content, "ensure-file");
    return true;
  }
  ensureDirectory(relativePath) {
    const { relativePath: normalized, fullPath } = this.resolve(relativePath);
    const existing = this.operationsByPath.get(normalized);
    if (existing && existing.kind !== "ensure-directory") throw new Error(`Mutation path cannot be both a file and a directory: ${normalized}`);
    if (this.virtualDirectories.has(normalized)) return false;
    const initial = this.recordFirstTouch(normalized, fullPath);
    if (!this.replacementFor(normalized) && initial.exists) {
      if (initial.type !== "directory") throw new Error(`Mutation directory target must be absent or a real directory: ${normalized}`);
      return false;
    }
    const operation = {
      operationId: existing?.operationId ?? `op-${crypto.randomUUID()}`,
      mutationId: this.id,
      actionId: this.actionId,
      relativePath: normalized,
      kind: "ensure-directory",
      encoding: null,
      previousExists: initial.exists,
      previousSha256: initial.sha256,
      expectedPreviousSha256: initial.sha256,
      nextSha256: null,
      scope: classifyScope(normalized),
      rollbackEligibility: this.patchPlanMode ? "host-tracked-file-edits-required" : "dove-caught-failure-restore"
    };
    if (!existing) this.operationOrder.push(normalized);
    this.operationsByPath.set(normalized, operation);
    this.virtualDirectories.add(normalized);
    return true;
  }
  replaceDirectory(relativePath, options = {}) {
    this.assertActive("Directory replacement");
    if (this.patchPlanMode) throw new Error("Directory replacement is direct-process only.");
    const { relativePath: normalized, fullPath } = this.resolve(relativePath);
    const initial = this.recordFirstTouch(normalized, fullPath);
    if (initial.exists && initial.type !== "directory") throw new Error(`Directory replacement target must be absent or a real directory: ${normalized}`);
    let archiveTarget = null;
    if (options.archiveTarget !== void 0 && options.archiveTarget !== null) {
      const resolvedArchive = this.resolve(options.archiveTarget);
      archiveTarget = resolvedArchive.relativePath;
      const archiveInitial = this.recordFirstTouch(archiveTarget, resolvedArchive.fullPath);
      if (archiveInitial.exists) throw new Error(`Directory replacement archive target must be absent: ${archiveTarget}`);
    }
    this.directoryReplacements.set(normalized, { relativePath: normalized, archiveTarget });
    this.virtualDirectories.add(normalized);
  }
  operations() {
    return this.operationOrder.map((relativePath) => this.operationsByPath.get(relativePath)).filter(Boolean);
  }
  summary(options = {}) {
    const operations = this.operations();
    const writesApplied = options.writesApplied ?? (!this.patchPlanMode && operations.length > 0);
    const cleanupResidues = this.commitState.cleanupFailures.slice(0, MAX_CLEANUP_RESIDUES);
    return {
      mutationId: this.id,
      actionId: this.actionId,
      mutationMode: this.mutationMode,
      mutationModeSource: this.mutationModeSource,
      writesApplied,
      operationCount: operations.length,
      paths: operations.map((operation) => operation.relativePath),
      directoryEffectCount: operations.filter((operation) => operation.kind === "ensure-directory").length,
      directoryPaths: operations.filter((operation) => operation.kind === "ensure-directory").map((operation) => operation.relativePath),
      hostRollbackEligible: this.patchPlanMode,
      hostRollbackIneligibleReason: this.patchPlanMode ? null : DIRECT_PROCESS_ROLLBACK_REASON,
      recommendedMutationMode: this.patchPlanMode ? null : "patch-plan",
      rollbackAdvice: this.patchPlanMode ? null : PATCH_PLAN_ROLLBACK_ADVICE,
      externalWriteCaptureVerified: false,
      doveRestoreSupported: !this.patchPlanMode,
      doveRestoreScope: this.patchPlanMode ? null : "caught-commit-failures-only",
      crashConsistencyGuaranteed: false,
      transactionState: {
        phase: this.patchPlanMode ? "planned" : this.commitState.phase,
        rollbackAttempted: this.commitState.rollbackAttempted,
        cleanup: {
          status: this.commitState.cleanupFailures.length === 0 ? "clean" : "residue",
          residueCount: this.commitState.cleanupFailures.length,
          residues: cleanupResidues,
          omittedResidueCount: Math.max(0, this.commitState.cleanupFailures.length - cleanupResidues.length)
        }
      }
    };
  }
  revalidatePreconditions() {
    const expectedStates = new Map([...this.readSet, ...this.preconditions]);
    for (const [relativePath, expected] of expectedStates) {
      const { fullPath } = this.resolve(relativePath);
      const actual = diskPathState(fullPath, this.fsOps);
      if (!samePathState(actual, expected)) {
        throw new Error(`Mutation commit precondition changed for ${relativePath}: expected ${expected.type}${expected.sha256 ? ` ${expected.sha256}` : ""}, found ${actual.type}${actual.sha256 ? ` ${actual.sha256}` : ""}.`);
      }
    }
  }
  revalidatePreconditionsAnchored(anchor) {
    const expectedStates = new Map([...this.readSet, ...this.preconditions]);
    for (const [relativePath, expected] of expectedStates) {
      const stat = anchor.tryLstat(relativePath);
      let actual;
      if (!stat) actual = { exists: false, type: "absent", sha256: null, mode: null };
      else {
        const type = pathType(stat);
        actual = { exists: true, type, sha256: type === "file" ? sha256(anchor.readFile(relativePath)) : type === "directory" ? diskPathState(path4.join(this.root, relativePath), this.fsOps).sha256 : null, mode: stat.mode & 4095 };
      }
      if (!samePathState(actual, expected)) throw new Error(`Mutation commit precondition changed for ${relativePath}: expected ${expected.type}${expected.sha256 ? ` ${expected.sha256}` : ""}, found ${actual.type}${actual.sha256 ? ` ${actual.sha256}` : ""}.`);
    }
  }
  makeAnchoredDirectory(anchor, relativePath, createdDirectories) {
    const normalized = path4.posix.normalize(relativePath || ".");
    if (normalized === ".") return;
    let current = "";
    for (const component of normalized.split("/")) {
      current = current ? `${current}/${component}` : component;
      const stat = anchor.tryLstat(current);
      if (stat) {
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Mutation directory component must be a real directory: ${current}`);
        continue;
      }
      anchor.mkdir(current);
      createdDirectories.push(current);
    }
  }
  stageTransaction(anchor, transactionRoot) {
    const createdDirectories = [];
    anchor.mkdir(transactionRoot);
    createdDirectories.push(transactionRoot);
    const stagedRoot = `${transactionRoot}/staged`;
    const backupsRoot = `${transactionRoot}/backups`;
    anchor.mkdir(stagedRoot);
    anchor.mkdir(backupsRoot);
    const replacementStages = /* @__PURE__ */ new Map();
    let replacementIndex = 0;
    for (const replacement of this.directoryReplacements.values()) {
      const stagePath = `${stagedRoot}/directory-${replacementIndex++}`;
      anchor.mkdir(stagePath);
      replacementStages.set(replacement.relativePath, stagePath);
      const directoryOperations = this.operations().filter((operation) => operation.kind === "ensure-directory" && isInside(operation.relativePath, replacement.relativePath));
      for (const operation of directoryOperations.sort((left, right) => pathDepth(left.relativePath) - pathDepth(right.relativePath))) {
        if (operation.relativePath === replacement.relativePath) continue;
        const nested = path4.posix.relative(replacement.relativePath, operation.relativePath);
        anchor.mkdir(`${stagePath}/${nested}`, { recursive: true });
      }
      const fileOperations = this.operations().filter((operation) => operation.kind !== "ensure-directory" && isInside(operation.relativePath, replacement.relativePath));
      for (const operation of fileOperations) {
        const nested = path4.posix.relative(replacement.relativePath, operation.relativePath);
        const stagedFile = `${stagePath}/${nested}`;
        anchor.mkdir(path4.posix.dirname(stagedFile), { recursive: true });
        anchor.writeNewFile(stagedFile, this.overlay.get(operation.relativePath), { encoding: operation.encoding === "utf8" ? "utf8" : void 0 });
      }
    }
    const fileStages = /* @__PURE__ */ new Map();
    let fileIndex = 0;
    for (const operation of this.operations()) {
      if (operation.kind === "ensure-directory" || this.replacementFor(operation.relativePath)) continue;
      const stagedFile = `${stagedRoot}/file-${fileIndex++}`;
      anchor.writeNewFile(stagedFile, this.overlay.get(operation.relativePath), { encoding: operation.encoding === "utf8" ? "utf8" : void 0 });
      const initial = this.preconditions.get(operation.relativePath);
      if (initial?.exists && initial.type === "file") anchor.chmod(stagedFile, initial.mode);
      fileStages.set(operation.relativePath, stagedFile);
    }
    return { transactionRoot, backupsRoot, replacementStages, fileStages, createdDirectories };
  }
  rollbackTransaction(anchor, transaction, promotions) {
    const failures = [];
    const attempt = (callback) => {
      try {
        callback();
      } catch (error) {
        failures.push(errorMessage2(error));
      }
    };
    for (const promotion of [...promotions].reverse()) {
      if (promotion.promoted) attempt(() => anchor.remove(promotion.targetPath, { recursive: promotion.directory === true, force: true }));
      if (promotion.originalLocation && anchor.exists(promotion.originalLocation)) attempt(() => anchor.rename(promotion.originalLocation, promotion.targetPath));
      else if (promotion.backupPath && anchor.exists(promotion.backupPath)) attempt(() => anchor.rename(promotion.backupPath, promotion.targetPath));
    }
    for (const directoryPath of [...transaction.createdDirectories].sort((left, right) => right.length - left.length)) {
      if (directoryPath === transaction.transactionRoot) continue;
      if (anchor.exists(directoryPath)) attempt(() => anchor.rmdir(directoryPath));
    }
    if (anchor.exists(transaction.transactionRoot)) attempt(() => anchor.remove(transaction.transactionRoot, { recursive: true, force: true }));
    if (failures.length > 0) throw new Error(failures.join("; "));
  }
  acquireCommitLocks(anchor) {
    const acquired = [];
    try {
      for (const lock of this.commitLocks.values()) {
        try {
          anchor.writeNewFile(lock.relativePath, Buffer.alloc(0), { mode: 384 });
        } catch (error) {
          if (error?.code === "EEXIST") throw new Error(`${lock.label} is already held: ${lock.relativePath}.`);
          throw error;
        }
        acquired.push(lock);
      }
      return acquired;
    } catch (error) {
      this.releaseCommitLocks(anchor, acquired);
      throw error;
    }
  }
  releaseCommitLocks(anchor, acquired) {
    const failures = [];
    for (const lock of [...acquired].reverse()) {
      try {
        anchor.unlink(lock.relativePath, { force: true });
      } catch (error) {
        failures.push(errorMessage2(error));
      }
    }
    if (failures.length > 0) throw new Error(`Mutation commit lock cleanup failed: ${failures.join("; ")}`);
  }
  commitDirect() {
    const anchor = openAnchoredFilesystem(this.root, { fsOps: this.fsOps, platform: this.platform, procFdRoot: this.procFdRoot });
    const acquiredLocks = this.acquireCommitLocks(anchor);
    let primaryError = null;
    try {
      this.commitState.phase = "preparing";
      this.revalidatePreconditionsAnchored(anchor);
      if (this.operations().length === 0 && this.directoryReplacements.size === 0) {
        this.commitState.phase = "committed";
        return;
      }
      const transactionRoot = `.dove-transaction-${this.id.replace(/[^a-z0-9._-]/giu, "-")}`;
      if (anchor.exists(transactionRoot)) throw new Error(`Mutation transaction path is already occupied: ${anchor.displayPath(transactionRoot)}`);
      let transaction = { transactionRoot, createdDirectories: [] };
      const promotions = [];
      try {
        transaction = this.stageTransaction(anchor, transactionRoot);
        this.revalidatePreconditionsAnchored(anchor);
        this.commitState.phase = "promoting";
        let replacementIndex = 0;
        for (const replacement of this.directoryReplacements.values()) {
          const targetPath = replacement.relativePath;
          const stagePath = transaction.replacementStages.get(replacement.relativePath);
          const promotion = { targetPath, promoted: false, backupPath: null, originalLocation: null, directory: true };
          promotions.push(promotion);
          if (anchor.exists(targetPath)) {
            const originalLocation = replacement.archiveTarget ?? `${transaction.backupsRoot}/directory-${replacementIndex}`;
            this.makeAnchoredDirectory(anchor, path4.posix.dirname(originalLocation), transaction.createdDirectories);
            anchor.rename(targetPath, originalLocation);
            promotion.originalLocation = originalLocation;
          }
          this.makeAnchoredDirectory(anchor, path4.posix.dirname(targetPath), transaction.createdDirectories);
          anchor.rename(stagePath, targetPath);
          promotion.promoted = true;
          replacementIndex += 1;
        }
        for (const operation of this.operations().filter((item) => item.kind === "ensure-directory" && !this.replacementFor(item.relativePath)).sort((left, right) => pathDepth(left.relativePath) - pathDepth(right.relativePath))) {
          this.makeAnchoredDirectory(anchor, operation.relativePath, transaction.createdDirectories);
        }
        let fileIndex = 0;
        for (const operation of this.operations()) {
          if (operation.kind === "ensure-directory" || this.replacementFor(operation.relativePath)) continue;
          const targetPath = operation.relativePath;
          const stagedPath = transaction.fileStages.get(operation.relativePath);
          const promotion = { targetPath, promoted: false, backupPath: null, originalLocation: null, directory: false };
          promotions.push(promotion);
          this.makeAnchoredDirectory(anchor, path4.posix.dirname(targetPath), transaction.createdDirectories);
          if (anchor.exists(targetPath)) {
            const backupPath = `${transaction.backupsRoot}/file-${fileIndex}`;
            anchor.rename(targetPath, backupPath);
            promotion.backupPath = backupPath;
          }
          anchor.rename(stagedPath, targetPath);
          promotion.promoted = true;
          fileIndex += 1;
        }
      } catch (error) {
        this.commitState.phase = "rolling-back";
        this.commitState.rollbackAttempted = true;
        try {
          this.rollbackTransaction(anchor, transaction, promotions);
          this.commitState.phase = "rolled-back";
        } catch (rollbackError) {
          this.commitState.phase = "rollback-failed";
          throw new Error(`Dove mutation commit failed and rollback also failed: ${errorMessage2(error)}; rollback: ${errorMessage2(rollbackError)}`, { cause: error });
        }
        throw new Error(`Dove mutation commit failed and all staged changes were rolled back: ${errorMessage2(error)}`, { cause: error });
      }
      this.commitState.phase = "committed";
      try {
        anchor.remove(transactionRoot, { recursive: true, force: true });
      } catch (cleanupError) {
        this.commitState.cleanupFailures.push({ path: anchor.displayPath(transactionRoot), reason: errorMessage2(cleanupError) });
      }
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      try {
        this.releaseCommitLocks(anchor, acquiredLocks);
      } catch (cleanupError) {
        if (!primaryError && this.commitState.phase === "committed") this.commitState.cleanupFailures.push({ path: "commit-locks", reason: errorMessage2(cleanupError) });
      } finally {
        anchor.close();
      }
    }
  }
  finish(result = {}) {
    this.assertActive("MutationContext finish");
    const operations = this.operations();
    if (!this.patchPlanMode) this.commitDirect();
    const writesApplied = !this.patchPlanMode && (operations.length > 0 || this.directoryReplacements.size > 0 || resultDeclaresWrites(result));
    const directRestoreSupported = !this.patchPlanMode;
    const metadata = {
      mutationId: this.id,
      mutationMode: this.mutationMode,
      mutationModeSource: this.mutationModeSource,
      writesApplied,
      hostRollbackEligible: this.patchPlanMode,
      hostTrackedFileEditsRequired: this.patchPlanMode,
      directProcessWritesAreRollbackSafe: directRestoreSupported,
      externalWriteCaptureVerified: false,
      doveRestoreSupported: directRestoreSupported,
      doveRestoreScope: directRestoreSupported ? "caught-commit-failures-only" : null,
      crashConsistencyGuaranteed: false,
      hostRollbackIneligibleReason: this.patchPlanMode ? null : DIRECT_PROCESS_ROLLBACK_REASON,
      recommendedMutationMode: this.patchPlanMode ? null : "patch-plan",
      rollbackAdvice: this.patchPlanMode ? null : PATCH_PLAN_ROLLBACK_ADVICE,
      mutationSummary: this.summary({ writesApplied })
    };
    if (this.patchPlanMode) {
      metadata.mutationPlan = {
        presentation: "dove-mutation-plan",
        mutationId: this.id,
        actionId: this.actionId,
        hostId: this.hostId,
        workspaceRealpath: typeof this.fsOps.realpathSync.native === "function" ? this.fsOps.realpathSync.native(this.root) : this.fsOps.realpathSync(this.root),
        mutationModeSource: this.mutationModeSource,
        createdAt: this.createdAt,
        writesApplied: false,
        hostTrackedFileEditsRequired: true,
        directProcessWritesAreRollbackSafe: false,
        externalWriteCaptureVerified: false,
        doveRestoreSupported: false,
        doveRestoreScope: null,
        crashConsistencyGuaranteed: false,
        operations
      };
    }
    this.lifecycle = "finished";
    if (result && typeof result === "object" && !Array.isArray(result)) return { ...result, ...metadata };
    return { result, ...metadata };
  }
  abort() {
    if (this.lifecycle === "active") this.lifecycle = "aborted";
  }
};
function createMutationContext(root, options = {}) {
  return new MutationContext(root, options);
}
function runWithMutationContext(root, options, callback) {
  const context = createMutationContext(root, options);
  return mutationStorage.run(context, () => {
    try {
      const result = callback(context);
      if (result && typeof result.then === "function") {
        return result.then(
          (resolved) => context.finish(resolved),
          (error) => {
            context.abort();
            throw error;
          }
        );
      }
      return context.finish(result);
    } catch (error) {
      context.abort();
      throw error;
    }
  });
}
function currentMutationContext(root) {
  const context = mutationStorage.getStore();
  if (!context || context.lifecycle !== "active") return null;
  if (root) {
    try {
      const resolved = typeof context.fsOps.realpathSync.native === "function" ? context.fsOps.realpathSync.native(path4.resolve(root)) : context.fsOps.realpathSync(path4.resolve(root));
      if (resolved !== context.root) return null;
    } catch {
      return null;
    }
  }
  return context;
}
function isPatchPlanMode(root) {
  return currentMutationContext(root)?.patchPlanMode === true;
}

// src/core/artifact-integrity.mjs
var BOOKKEEPING_PREFIXES = Object.freeze([
  `${ARTIFACT_PATHS.missionsDir}/`,
  `${ARTIFACT_PATHS.researchTreesDir}/`,
  `${ARTIFACT_PATHS.lessonsDir}/`,
  `${ARTIFACT_PATHS.receiptsDir}/`,
  `${ARTIFACT_PATHS.artifactsDir}/`
]);
var BOOKKEEPING_FILES = /* @__PURE__ */ new Set([ARTIFACT_PATHS.doveRootManifest, ARTIFACT_PATHS.projectIdentity]);
var DOMAIN_PREFIXES = Object.freeze([
  ARTIFACT_PATHS.sourcesDir,
  ARTIFACT_PATHS.notesDir,
  ARTIFACT_PATHS.claimsDir,
  ARTIFACT_PATHS.experimentsDir,
  ARTIFACT_PATHS.draftsDir,
  ARTIFACT_PATHS.figuresDir,
  ARTIFACT_PATHS.reviewsDir,
  ARTIFACT_PATHS.rebuttalDir,
  ARTIFACT_PATHS.versionsDir
]);
function normalizeProjectRelativePath(rawPath) {
  const original = typeof rawPath === "string" ? rawPath.trim() : String(rawPath ?? "").trim();
  if (!original) return { ok: false, path: original, reason: "empty path" };
  if (original.includes("\0")) return { ok: false, path: original, reason: "path contains a null byte" };
  if (path5.isAbsolute(original) || /^[A-Za-z]:[\\/]/u.test(original)) {
    return { ok: false, path: original, reason: "absolute paths are not inspected" };
  }
  if (/^[a-z][a-z0-9+.-]*:/iu.test(original)) {
    return { ok: false, path: original, reason: "unsupported or malformed external reference scheme" };
  }
  const normalizedPath = path5.posix.normalize(original.replace(/\\/gu, "/"));
  if (normalizedPath === "." || normalizedPath === ".." || normalizedPath.startsWith("../")) {
    return { ok: false, path: original, normalizedPath, reason: "path escapes the project root" };
  }
  return { ok: true, path: original, normalizedPath };
}
function artifactEvidenceRole(relativePath) {
  const normalized = normalizeProjectRelativePath(relativePath);
  if (!normalized.ok) return "unsupported";
  const value2 = normalized.normalizedPath;
  if (!value2.startsWith(`${ARTIFACT_PATHS.doveRoot}/`)) return "external-project";
  if (BOOKKEEPING_FILES.has(value2) || BOOKKEEPING_PREFIXES.some((prefix) => value2.startsWith(prefix))) return "bookkeeping";
  if (DOMAIN_PREFIXES.some((prefix) => value2 === prefix || value2.startsWith(`${prefix}/`))) return "substantive";
  return "unsupported";
}
function inspectDeclaredPath(root, rawPath, options = {}) {
  const normalized = normalizeProjectRelativePath(rawPath);
  const mutationContext = currentMutationContext(root);
  if (!normalized.ok) {
    return { path: normalized.path, normalizedPath: normalized.normalizedPath ?? null, status: "unsafe", exists: false, file: false, reason: normalized.reason };
  }
  const rootPath = path5.resolve(root);
  const fullPath = path5.resolve(rootPath, normalized.normalizedPath);
  const relativeToRoot = path5.relative(rootPath, fullPath);
  if (relativeToRoot === ".." || relativeToRoot.startsWith(`..${path5.sep}`) || path5.isAbsolute(relativeToRoot)) {
    return { path: normalized.path, normalizedPath: normalized.normalizedPath, status: "unsafe", exists: false, file: false, reason: "resolved path escapes the project root" };
  }
  let realRootPath;
  let realFullPath;
  let canonicalRelativePath;
  let stat;
  try {
    if (mutationContext) {
      const snapshot = mutationContext.readFileSnapshot(normalized.normalizedPath);
      if (!snapshot.exists) return { path: normalized.path, normalizedPath: normalized.normalizedPath, status: "missing", exists: false, file: false, reason: "path does not exist" };
    }
    realRootPath = fs4.realpathSync.native(rootPath);
    realFullPath = fs4.realpathSync.native(fullPath);
    const relativeToRealRoot = path5.relative(realRootPath, realFullPath);
    if (relativeToRealRoot === ".." || relativeToRealRoot.startsWith(`..${path5.sep}`) || path5.isAbsolute(relativeToRealRoot)) {
      return { path: normalized.path, normalizedPath: normalized.normalizedPath, status: "unsafe", exists: true, file: false, reason: "real path escapes the project root" };
    }
    canonicalRelativePath = relativeToRealRoot.split(path5.sep).join("/");
    stat = fs4.statSync(realFullPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { path: normalized.path, normalizedPath: normalized.normalizedPath, status: "missing", exists: false, file: false, reason: "path does not exist" };
    }
    return { path: normalized.path, normalizedPath: normalized.normalizedPath, status: "unreadable", exists: false, file: false, reason: error instanceof Error ? error.message : String(error) };
  }
  if (stat.isDirectory()) {
    return { path: normalized.path, normalizedPath: normalized.normalizedPath, canonicalRelativePath, status: "directory", exists: true, file: false, sizeBytes: stat.size, reason: "path is a directory" };
  }
  if (!stat.isFile()) {
    return { path: normalized.path, normalizedPath: normalized.normalizedPath, canonicalRelativePath, status: "unsupported", exists: true, file: false, sizeBytes: stat.size, reason: "path is not a regular file" };
  }
  const evidenceRole = artifactEvidenceRole(normalized.normalizedPath);
  const canonicalEvidenceRole = artifactEvidenceRole(canonicalRelativePath);
  const base = { path: normalized.path, normalizedPath: normalized.normalizedPath, canonicalRelativePath, evidenceRole, canonicalEvidenceRole, status: "existing", exists: true, file: true, sizeBytes: stat.size };
  if (options.rejectBookkeeping === true) {
    const rejected = [evidenceRole, canonicalEvidenceRole].find((role) => role === "bookkeeping" || role === "unsupported");
    if (rejected) {
      return { ...base, status: rejected, reason: rejected === "bookkeeping" ? "path is Dove bookkeeping rather than substantive evidence" : "path is not an approved schema 9 evidence artifact" };
    }
  }
  if (options.requireNonEmpty === true && stat.size === 0) return { ...base, status: "empty", reason: "path is an empty file" };
  if (options.readText !== true) return base;
  try {
    const maxBytes = Number.isInteger(options.maxBytes) && options.maxBytes > 0 ? options.maxBytes : 24 * 1024;
    if (mutationContext && canonicalRelativePath === normalized.normalizedPath) {
      const content = mutationContext.readBuffer(canonicalRelativePath, null);
      if (content === null) return { ...base, status: "missing", exists: false, file: false, reason: "path does not exist" };
      const bytesRead = Math.min(maxBytes, content.length);
      return { ...base, text: content.subarray(0, bytesRead).toString("utf8"), bytesRead, truncated: content.length > bytesRead };
    }
    const descriptor = fs4.openSync(realFullPath, "r");
    try {
      const buffer = Buffer.alloc(Math.min(maxBytes, stat.size));
      const bytesRead = fs4.readSync(descriptor, buffer, 0, buffer.length, 0);
      return { ...base, text: buffer.subarray(0, bytesRead).toString("utf8"), bytesRead, truncated: stat.size > bytesRead };
    } finally {
      fs4.closeSync(descriptor);
    }
  } catch (error) {
    return { ...base, status: "unreadable", reason: error instanceof Error ? error.message : String(error) };
  }
}

// src/core/completion-gates.mjs
import path17 from "node:path";

// src/core/domain-artifacts.mjs
import crypto7 from "node:crypto";
import fs13 from "node:fs";
import path15 from "node:path";

// src/core/receipt-ledger.mjs
import fs5 from "node:fs";
import path7 from "node:path";

// src/core/mission-graph.mjs
import path6 from "node:path";
function missionEntries(value2) {
  if (!Array.isArray(value2)) throw new Error("Mission graph entries must be an array.");
  return value2.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Mission graph entry ${index} must be an object.`);
    const mission = entry.mission;
    if (!mission || typeof mission !== "object" || Array.isArray(mission)) throw new Error(`Mission graph entry ${index} must contain a mission object.`);
    const missionId = mission.missionId;
    if (typeof missionId !== "string" || !missionId) throw new Error(`Mission graph entry ${index} has no missionId.`);
    const filename = typeof entry.filename === "string" ? path6.posix.basename(entry.filename) : "";
    if (filename !== `${missionId}.json`) throw new Error(`Mission file ${entry.filename ?? "unknown"} filename must match missionId ${missionId}.`);
    return { filename, mission, missionId };
  });
}
function assertAcyclic(byId, edgeIds, label) {
  const visiting = /* @__PURE__ */ new Set();
  const visited = /* @__PURE__ */ new Set();
  const visit = (missionId) => {
    if (visited.has(missionId)) return;
    if (visiting.has(missionId)) throw new Error(`${label} contains a cycle at ${missionId}.`);
    visiting.add(missionId);
    for (const nextId of edgeIds(byId.get(missionId))) visit(nextId);
    visiting.delete(missionId);
    visited.add(missionId);
  };
  for (const missionId of byId.keys()) visit(missionId);
}
function terminalSuccessorMissionId(missionGraph, missionId) {
  let current = missionId;
  const seen = /* @__PURE__ */ new Set();
  while (missionGraph.successorByMission.has(current)) {
    if (seen.has(current)) throw new Error(`Mission supersession contains a cycle at ${current}.`);
    seen.add(current);
    current = missionGraph.successorByMission.get(current);
  }
  return current === missionId ? null : current;
}
function missionSupersedes(missionGraph, successorMissionId, ancestorMissionId) {
  if (successorMissionId === ancestorMissionId) return false;
  let current = ancestorMissionId;
  const seen = /* @__PURE__ */ new Set();
  while (missionGraph.successorByMission.has(current)) {
    if (seen.has(current)) throw new Error(`Mission supersession contains a cycle at ${current}.`);
    seen.add(current);
    current = missionGraph.successorByMission.get(current);
    if (current === successorMissionId) return true;
  }
  return false;
}
function assertMissionAcceptsWrites(workspace, mission, options = {}) {
  const supersededByMissionId = terminalSuccessorMissionId(workspace.missionGraph, mission.missionId);
  if (supersededByMissionId) {
    const suffix = options.receipt === true ? "and no longer accepts execution receipts." : "and is read-only history.";
    throw new Error(`Mission ${mission.missionId} has been superseded by ${supersededByMissionId} ${suffix}`);
  }
}
function validateMissionGraph(value2) {
  const entries = missionEntries(value2);
  const byId = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    if (byId.has(entry.missionId)) throw new Error(`Mission graph contains duplicate missionId ${entry.missionId}.`);
    byId.set(entry.missionId, entry.mission);
  }
  for (const mission of byId.values()) {
    const dependencies = Array.isArray(mission.dependsOnMissionIds) ? mission.dependsOnMissionIds : [];
    for (const dependencyId of dependencies) {
      if (dependencyId === mission.missionId) throw new Error(`Mission ${mission.missionId} must not depend on itself.`);
      if (!byId.has(dependencyId)) throw new Error(`Mission ${mission.missionId} depends on unknown mission ${dependencyId}.`);
    }
    if (mission.supersedesMissionId !== void 0) {
      if (mission.supersedesMissionId === mission.missionId) throw new Error(`Mission ${mission.missionId} must not supersede itself.`);
      if (!byId.has(mission.supersedesMissionId)) throw new Error(`Mission ${mission.missionId} supersedes unknown mission ${mission.supersedesMissionId}.`);
    }
  }
  const dependenciesByMission = new Map([...byId.values()].map((mission) => [
    mission.missionId,
    Object.freeze([...mission.dependsOnMissionIds ?? []])
  ]));
  assertAcyclic(byId, (mission) => dependenciesByMission.get(mission.missionId), "Mission dependency graph");
  const successorByMission = /* @__PURE__ */ new Map();
  for (const mission of byId.values()) {
    if (!mission.supersedesMissionId) continue;
    if (successorByMission.has(mission.supersedesMissionId)) {
      throw new Error(`Mission supersession forks at ${mission.supersedesMissionId}.`);
    }
    successorByMission.set(mission.supersedesMissionId, mission.missionId);
  }
  assertAcyclic(byId, (mission) => mission.supersedesMissionId ? [mission.supersedesMissionId] : [], "Mission supersession");
  return { missions: byId, dependenciesByMission, successorByMission };
}

// src/core/receipt-ledger.mjs
var EXECUTION_RECEIPT_SCHEMA_VERSION = 3;
var EXECUTION_RECEIPT_PRODUCER_KINDS = Object.freeze(["public-execution", "dove-internal"]);
var RECEIPT_FIELDS = /* @__PURE__ */ new Set([
  "schemaVersion",
  "workspaceId",
  "receiptId",
  "ledgerSequence",
  "missionId",
  "contractDigest",
  "summary",
  "artifacts",
  "validations",
  "criteriaSatisfied",
  "producedAt",
  "recordedAt",
  "producer"
]);
var ARTIFACT_FIELDS = /* @__PURE__ */ new Set(["path", "kind", "sha256", "derivedReferences"]);
var VALIDATION_FIELDS = /* @__PURE__ */ new Set(["kind", "reference", "outputHash"]);
var CRITERION_FIELDS = /* @__PURE__ */ new Set(["criterionId", "evidenceRefs", "evidenceBindings"]);
var EVIDENCE_BINDING_FIELDS = /* @__PURE__ */ new Set(["reference", "sha256", "receiptId"]);
var PRODUCER_FIELDS = /* @__PURE__ */ new Set(["kind", "actionId"]);
var SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var HASH = /^[0-9a-f]{64}$/u;
var PRODUCER_KIND_SET = new Set(EXECUTION_RECEIPT_PRODUCER_KINDS);
var INTERNAL_ACTION_IDS = new Set(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.id));
function assertPlainObject(value2, label) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) throw new Error(`${label} must be a plain object.`);
}
function assertSealed(value2, fields, label) {
  assertPlainObject(value2, label);
  const unknown = Object.keys(value2).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function exactString(value2, label) {
  if (typeof value2 !== "string" || !value2.trim() || value2 !== value2.trim()) throw new Error(`${label} must be a canonical non-empty string.`);
  return value2;
}
function safeId(value2, label) {
  const normalized = exactString(value2, label);
  if (!SAFE_ID.test(normalized)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return normalized;
}
function hash(value2, label) {
  const normalized = exactString(value2, label);
  if (!HASH.test(normalized)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return normalized;
}
function exactIso(value2, label) {
  if (typeof value2 !== "string" || !Number.isFinite(Date.parse(value2)) || new Date(Date.parse(value2)).toISOString() !== value2) {
    throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  }
  return value2;
}
function canonicalPath(value2, label) {
  const normalized = normalizeProjectRelativePath(value2);
  if (!normalized.ok) throw new Error(`${label} has an unsafe path: ${normalized.reason}.`);
  if (value2 !== normalized.normalizedPath) throw new Error(`${label} must use a canonical project-relative path.`);
  return value2;
}
function canonicalStringArray(value2, label, options = {}) {
  if (!Array.isArray(value2)) throw new Error(`${label} must be an array.`);
  const items = value2.map((item, index) => exactString(item, `${label}[${index}]`));
  if (new Set(items).size !== items.length) throw new Error(`${label} must not contain duplicates.`);
  if (options.sorted === true && items.some((item, index) => index > 0 && items[index - 1].localeCompare(item) > 0)) {
    throw new Error(`${label} must use canonical lexical order.`);
  }
  return items;
}
function validateProducer(value2, label) {
  assertSealed(value2, PRODUCER_FIELDS, label);
  if (!PRODUCER_KIND_SET.has(value2.kind)) throw new Error(`${label}.kind is unsupported.`);
  const actionId = safeId(value2.actionId, `${label}.actionId`);
  if (value2.kind === "public-execution" && actionId !== "ingest-execution-receipt") {
    throw new Error(`${label} public-execution producer must use actionId ingest-execution-receipt.`);
  }
  if (value2.kind === "dove-internal" && (!INTERNAL_ACTION_IDS.has(actionId) || actionId === "ingest-execution-receipt")) {
    throw new Error(`${label} dove-internal producer actionId is not a registered internal Dove mutation.`);
  }
  return value2;
}
function validateStoredReceipt(value2, context) {
  const { manifest, missions, label, filename } = context;
  assertSealed(value2, RECEIPT_FIELDS, label);
  if (value2.schemaVersion !== EXECUTION_RECEIPT_SCHEMA_VERSION) throw new Error(`${label} has an unsupported schemaVersion.`);
  if (value2.workspaceId !== manifest.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  safeId(value2.workspaceId, `${label}.workspaceId`);
  const receiptId = safeId(value2.receiptId, `${label}.receiptId`);
  if (filename !== `${receiptId}.json`) throw new Error(`${label} filename must match receiptId ${receiptId}.`);
  if (!Number.isSafeInteger(value2.ledgerSequence) || value2.ledgerSequence < 1) throw new Error(`${label}.ledgerSequence must be a positive safe integer.`);
  const missionId = safeId(value2.missionId, `${label}.missionId`);
  const mission = missions.get(missionId);
  if (!mission) throw new Error(`${label} references unknown mission ${missionId}.`);
  hash(value2.contractDigest, `${label}.contractDigest`);
  if (value2.contractDigest !== mission.contractDigest) throw new Error(`${label}.contractDigest does not match mission ${missionId}.`);
  exactString(value2.summary, `${label}.summary`);
  exactIso(value2.producedAt, `${label}.producedAt`);
  exactIso(value2.recordedAt, `${label}.recordedAt`);
  validateProducer(value2.producer, `${label}.producer`);
  if (!Array.isArray(value2.artifacts)) throw new Error(`${label}.artifacts must be an array.`);
  if (!Array.isArray(value2.validations)) throw new Error(`${label}.validations must be an array.`);
  if (!Array.isArray(value2.criteriaSatisfied)) throw new Error(`${label}.criteriaSatisfied must be an array.`);
  if (value2.artifacts.length === 0 && value2.validations.length === 0 && value2.criteriaSatisfied.length === 0) {
    throw new Error(`${label} must contain at least one artifact, validation, or satisfied criterion.`);
  }
  const artifactPaths = /* @__PURE__ */ new Set();
  for (const [index, artifact] of value2.artifacts.entries()) {
    const itemLabel = `${label}.artifacts[${index}]`;
    assertSealed(artifact, ARTIFACT_FIELDS, itemLabel);
    const artifactPath = canonicalPath(artifact.path, `${itemLabel}.path`);
    if (artifactPaths.has(artifactPath)) throw new Error(`${label}.artifacts contains duplicate path ${artifactPath}.`);
    artifactPaths.add(artifactPath);
    exactString(artifact.kind, `${itemLabel}.kind`);
    hash(artifact.sha256, `${itemLabel}.sha256`);
    canonicalStringArray(artifact.derivedReferences, `${itemLabel}.derivedReferences`, { sorted: true });
  }
  const validationPaths = /* @__PURE__ */ new Set();
  for (const [index, validation] of value2.validations.entries()) {
    const itemLabel = `${label}.validations[${index}]`;
    assertSealed(validation, VALIDATION_FIELDS, itemLabel);
    exactString(validation.kind, `${itemLabel}.kind`);
    const reference = canonicalPath(validation.reference, `${itemLabel}.reference`);
    if (validationPaths.has(reference)) throw new Error(`${label}.validations contains duplicate reference ${reference}.`);
    if (artifactPaths.has(reference)) throw new Error(`${label} artifact and validation paths must be canonically distinct: ${reference}.`);
    validationPaths.add(reference);
    hash(validation.outputHash, `${itemLabel}.outputHash`);
  }
  const artifactHashByReference = new Map(value2.artifacts.map((artifact) => [`artifact:${artifact.path}`, artifact.sha256]));
  const validationHashByReference = new Map(value2.validations.map((validation) => [`validation:${validation.reference}`, validation.outputHash]));
  const criterionIds = /* @__PURE__ */ new Set();
  const missionCriterionIds = new Set(Array.isArray(mission.completionCriterionIds) ? mission.completionCriterionIds : []);
  for (const [index, criterion] of value2.criteriaSatisfied.entries()) {
    const itemLabel = `${label}.criteriaSatisfied[${index}]`;
    assertSealed(criterion, CRITERION_FIELDS, itemLabel);
    const criterionId = safeId(criterion.criterionId, `${itemLabel}.criterionId`);
    if (!missionCriterionIds.has(criterionId)) throw new Error(`${itemLabel}.criterionId is unknown for mission ${missionId}.`);
    if (criterionIds.has(criterionId)) throw new Error(`${label}.criteriaSatisfied contains duplicate criterionId ${criterionId}.`);
    criterionIds.add(criterionId);
    const references = canonicalStringArray(criterion.evidenceRefs, `${itemLabel}.evidenceRefs`);
    if (references.length === 0) throw new Error(`${itemLabel}.evidenceRefs must contain at least one item.`);
    if (!Array.isArray(criterion.evidenceBindings) || criterion.evidenceBindings.length !== references.length) {
      throw new Error(`${itemLabel}.evidenceBindings must bind every evidence reference to its original hash.`);
    }
    const bindingByReference = /* @__PURE__ */ new Map();
    for (const [bindingIndex, binding] of criterion.evidenceBindings.entries()) {
      const bindingLabel = `${itemLabel}.evidenceBindings[${bindingIndex}]`;
      assertSealed(binding, EVIDENCE_BINDING_FIELDS, bindingLabel);
      const reference = exactString(binding.reference, `${bindingLabel}.reference`);
      if (bindingByReference.has(reference)) throw new Error(`${itemLabel}.evidenceBindings contains duplicate reference ${reference}.`);
      const receiptId2 = safeId(binding.receiptId, `${bindingLabel}.receiptId`);
      bindingByReference.set(reference, { sha256: hash(binding.sha256, `${bindingLabel}.sha256`), receiptId: receiptId2 });
    }
    for (const [referenceIndex, reference] of references.entries()) {
      const separator = reference.indexOf(":");
      if (separator <= 0 || separator === reference.length - 1) throw new Error(`${itemLabel}.evidenceRefs[${referenceIndex}] must be a typed evidence reference.`);
      const kind = reference.slice(0, separator);
      const target2 = reference.slice(separator + 1);
      if ((kind === "artifact" || kind === "validation") && canonicalPath(target2, `${itemLabel}.evidenceRefs[${referenceIndex}]`) !== target2) {
        throw new Error(`${itemLabel}.evidenceRefs[${referenceIndex}] must be canonical.`);
      }
      if (!bindingByReference.has(reference)) throw new Error(`${itemLabel}.evidenceBindings is missing ${reference}.`);
      const binding = bindingByReference.get(reference);
      const declaredHash = kind === "artifact" ? artifactHashByReference.get(reference) : kind === "validation" ? validationHashByReference.get(reference) : null;
      if (declaredHash && (binding.sha256 !== declaredHash || binding.receiptId !== receiptId)) throw new Error(`${itemLabel}.evidenceBindings does not match the receipt declaration for ${reference}.`);
    }
  }
  return value2;
}
function readJsonStrict(fullPath, label) {
  let text;
  try {
    text = fs5.readFileSync(fullPath, "utf8");
  } catch (error) {
    throw new Error(`${label} cannot be read: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Malformed durable JSON in ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function derivedState(manifest, receipts, missionGraph) {
  const currentByPath = /* @__PURE__ */ new Map();
  const artifactHistory = [];
  for (const receipt of receipts) {
    for (const artifact of receipt.artifacts) {
      const previous = currentByPath.get(artifact.path);
      if (previous && previous.missionId !== receipt.missionId && !missionSupersedes(missionGraph, receipt.missionId, previous.missionId)) {
        throw new Error(`Execution receipt ledger assigns artifact path ${artifact.path} to mission ${receipt.missionId} after ownership by unrelated mission ${previous.missionId}.`);
      }
      const entry = {
        path: artifact.path,
        kind: artifact.kind,
        sha256: artifact.sha256,
        missionId: receipt.missionId,
        contractDigest: receipt.contractDigest,
        receiptId: receipt.receiptId,
        ledgerSequence: receipt.ledgerSequence,
        recordedAt: receipt.recordedAt,
        producer: receipt.producer,
        derivedReferences: artifact.derivedReferences
      };
      artifactHistory.push(entry);
      currentByPath.set(artifact.path, entry);
    }
  }
  const current = [...currentByPath.values()].sort((left, right) => left.path.localeCompare(right.path));
  const updatedAt = receipts.at(-1)?.recordedAt ?? null;
  return {
    schemaVersion: EXECUTION_RECEIPT_SCHEMA_VERSION,
    workspaceId: manifest.workspaceId,
    receipts,
    artifactHistory,
    currentOwnership: current.map(({ derivedReferences: _derivedReferences, ledgerSequence: _ledgerSequence, recordedAt: _recordedAt, producer: _producer, ...item }) => item),
    currentLineage: current.map(({ ledgerSequence: _ledgerSequence, recordedAt: _recordedAt, producer: _producer, ...item }) => item),
    updatedAt,
    nextLedgerSequence: receipts.length + 1
  };
}
function readExecutionReceiptLedger(root, options = {}) {
  const manifest = options.manifest;
  const missions = options.missions;
  const missionGraph = options.missionGraph;
  if (!manifest || !(missions instanceof Map) || !missionGraph) throw new Error("Execution receipt ledger read requires the validated manifest, mission map, and mission graph.");
  const directory = path7.resolve(root, ARTIFACT_PATHS.executionReceiptsDir);
  const receipts = fs5.readdirSync(directory, { withFileTypes: true }).map((entry) => {
    const relativePath = path7.posix.join(ARTIFACT_PATHS.executionReceiptsDir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`${relativePath} must not be a symbolic link.`);
    if (!entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${relativePath} must be a regular JSON file.`);
    return validateStoredReceipt(readJsonStrict(path7.join(directory, entry.name), relativePath), {
      manifest,
      missions,
      label: relativePath,
      filename: entry.name
    });
  }).sort((left, right) => left.ledgerSequence - right.ledgerSequence);
  const receiptIds = /* @__PURE__ */ new Set();
  for (const [index, receipt] of receipts.entries()) {
    const expectedSequence = index + 1;
    if (receipt.ledgerSequence !== expectedSequence) {
      throw new Error(`Execution receipt ledgerSequence must be contiguous from 1; expected ${expectedSequence}, found ${receipt.ledgerSequence} in ${receipt.receiptId}.`);
    }
    if (receiptIds.has(receipt.receiptId)) throw new Error(`Execution receipt ledger contains duplicate receiptId ${receipt.receiptId}.`);
    receiptIds.add(receipt.receiptId);
  }
  return derivedState(manifest, receipts, missionGraph);
}
function deriveArtifactReferences(receipt, explicitByPath = /* @__PURE__ */ new Map()) {
  const criterionReferences = new Map(receipt.artifacts.map((artifact) => [artifact.path, []]));
  for (const criterion of receipt.criteriaSatisfied) {
    for (const reference of criterion.evidenceRefs) {
      if (!reference.startsWith("artifact:")) continue;
      const artifactPath = reference.slice("artifact:".length);
      criterionReferences.get(artifactPath)?.push(`criterion:${criterion.criterionId}`);
    }
  }
  return receipt.artifacts.map((artifact) => ({
    ...artifact,
    derivedReferences: [.../* @__PURE__ */ new Set([...explicitByPath.get(artifact.path) ?? [], ...criterionReferences.get(artifact.path) ?? []])].sort()
  }));
}
function assertReceiptAppendable(ledger, receipt, options = {}) {
  const missionGraph = options.missionGraph;
  if (receipt.ledgerSequence !== ledger.nextLedgerSequence) {
    throw new Error(`Execution receipt ledgerSequence must be ${ledger.nextLedgerSequence}.`);
  }
  if (ledger.receipts.some((item) => item.receiptId === receipt.receiptId)) throw new Error(`Execution receipt id is already occupied: ${receipt.receiptId}.`);
  const currentByPath = new Map(ledger.currentOwnership.map((item) => [item.path, item]));
  const receiptById = new Map(ledger.receipts.map((item) => [item.receiptId, item]));
  for (const artifact of receipt.artifacts) {
    const current = currentByPath.get(artifact.path);
    const currentReceipt = current ? receiptById.get(current.receiptId) : null;
    if (currentReceipt?.producer?.kind === "dove-internal" && ["prepare-review-exchange", "import-review-exchange"].includes(currentReceipt.producer.actionId)) {
      throw new Error(`Artifact path ${artifact.path} is an immutable review ${currentReceipt.producer.actionId === "prepare-review-exchange" ? "preparation control" : "import record"} and cannot be overwritten.`);
    }
    if (current && current.missionId !== receipt.missionId && (!missionGraph || !missionSupersedes(missionGraph, receipt.missionId, current.missionId))) {
      throw new Error(`Artifact path ${artifact.path} is already owned by mission ${current.missionId}; unrelated mission ${receipt.missionId} cannot overwrite it.`);
    }
  }
}

// src/core/workspace-schema.mjs
import crypto5 from "node:crypto";
import fs10 from "node:fs";
import path12 from "node:path";

// src/core/mission-contract-integrity.mjs
import crypto2 from "node:crypto";
var MISSION_CONTRACT_SCHEMA_VERSION = 1;
var MISSION_CRITERION_ID_VERSION = 1;
var MISSION_EVIDENCE_REQUIREMENT_ID_VERSION = 1;
var MISSION_CONTRACT_ARRAY_FIELDS = Object.freeze([
  "scope",
  "outOfScope",
  "targetArtifacts",
  "expectedArtifacts",
  "completionCriteria",
  "evidenceRequirements"
]);
var MISSION_OPTIONAL_ARRAY_FIELDS = Object.freeze(["dependsOnMissionIds"]);
var MISSION_CONTRACT_INPUT_FIELDS = Object.freeze([
  "missionId",
  "goal",
  ...MISSION_CONTRACT_ARRAY_FIELDS,
  ...MISSION_OPTIONAL_ARRAY_FIELDS,
  "supersedesMissionId"
]);
var PERSISTED_MISSION_FIELDS = Object.freeze([
  "schemaVersion",
  "workspaceId",
  "missionId",
  "contractDigest",
  "createdAt",
  ...MISSION_CONTRACT_ARRAY_FIELDS,
  ...MISSION_OPTIONAL_ARRAY_FIELDS,
  "goal",
  "supersedesMissionId",
  "completionCriterionIds",
  "evidenceRequirementIds"
]);
var PERSISTED_MISSION_FIELD_SET = new Set(PERSISTED_MISSION_FIELDS);
var TYPED_EVIDENCE_REQUIREMENT_PATTERN = /^(artifact|validation|note):(.+)$/u;
var SAFE_ID2 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var HASH2 = /^[0-9a-f]{64}$/u;
function sha2562(value2) {
  return crypto2.createHash("sha256").update(value2).digest("hex");
}
function stableMissionValue(value2) {
  if (Array.isArray(value2)) return value2.map(stableMissionValue);
  if (value2 && typeof value2 === "object") {
    return Object.fromEntries(
      Object.entries(value2).filter(([, item]) => item !== void 0).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableMissionValue(item)])
    );
  }
  return value2;
}
function stableMissionSerialize(value2) {
  return JSON.stringify(stableMissionValue(value2));
}
function assertPlainObject2(value2, label) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) throw new Error(`${label} must be a plain object.`);
}
function normalizeString(value2, fallback = null) {
  if (typeof value2 !== "string") return fallback;
  const normalized = value2.trim();
  return normalized || fallback;
}
function normalizeStringArray(value2, label = "Mission contract array field") {
  if (value2 === void 0) return [];
  if (!Array.isArray(value2)) throw new Error(`${label} must be an array of non-empty strings.`);
  const normalized = value2.map((item) => normalizeString(item, null));
  if (normalized.some((item) => item === null)) throw new Error(`${label} must contain only non-empty strings.`);
  return Array.from(new Set(normalized));
}
function canonicalContractPath(rawPath, label) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) throw new Error(`${label} has an unsafe project-relative path ${JSON.stringify(rawPath)}: ${normalized.reason}.`);
  const supplied = String(rawPath).trim().replace(/\\/gu, "/");
  if (normalized.normalizedPath !== supplied) throw new Error(`${label} path must be canonical: ${rawPath}.`);
  const evidenceRole = artifactEvidenceRole(normalized.normalizedPath);
  if (normalized.normalizedPath === ARTIFACT_PATHS.lessonsDir || normalized.normalizedPath.startsWith(`${ARTIFACT_PATHS.lessonsDir}/`)) {
    throw new Error(`${label} must not reference advisory-only Dove lessons: ${rawPath}.`);
  }
  if (normalized.normalizedPath === ARTIFACT_PATHS.researchTreesDir || normalized.normalizedPath.startsWith(`${ARTIFACT_PATHS.researchTreesDir}/`)) {
    throw new Error(`${label} must not reference Dove research-tree bookkeeping: ${rawPath}.`);
  }
  if (evidenceRole === "bookkeeping" || evidenceRole === "unsupported") {
    throw new Error(`${label} must reference a substantive current-schema artifact or an external project artifact, not Dove bookkeeping: ${rawPath}.`);
  }
  return normalized.normalizedPath;
}
function normalizeContractPaths(value2, label) {
  return normalizeStringArray(value2, label).map((item, index) => canonicalContractPath(item, `${label}[${index}]`));
}
function normalizeEvidenceRequirements(value2) {
  return normalizeStringArray(value2, "evidenceRequirements").map((requirement, index) => {
    if (requirement === "review:authoritative" || requirement.startsWith("source:")) {
      throw new Error(`evidenceRequirements[${index}] requests ${requirement}, but this local-first Dove schema has no public authority path that can satisfy source:<id> or review:authoritative requirements.`);
    }
    const match = TYPED_EVIDENCE_REQUIREMENT_PATTERN.exec(requirement);
    if (!match) throw new Error(`evidenceRequirements[${index}] must use artifact:<path>, validation:<path>, or note:<id>.`);
    const [, kind, rawValue] = match;
    const normalizedValue = normalizeString(rawValue, null);
    if (!normalizedValue) throw new Error(`evidenceRequirements[${index}] must contain a non-empty typed reference.`);
    if (kind === "artifact" || kind === "validation") return `${kind}:${canonicalContractPath(normalizedValue, `evidenceRequirements[${index}]`)}`;
    if (!SAFE_ID2.test(normalizedValue)) throw new Error(`evidenceRequirements[${index}] note reference must be a safe lowercase identifier.`);
    return `${kind}:${normalizedValue}`;
  });
}
function normalizeMissionContractContent(value2 = {}) {
  assertPlainObject2(value2, "Mission contract");
  const goal = normalizeString(value2.goal, null);
  if (!goal) throw new Error("Dove mission requires a non-empty goal.");
  const content = { goal };
  for (const field of MISSION_CONTRACT_ARRAY_FIELDS) {
    if (field === "targetArtifacts" || field === "expectedArtifacts") content[field] = normalizeContractPaths(value2[field], field);
    else if (field === "evidenceRequirements") content[field] = normalizeEvidenceRequirements(value2[field]);
    else content[field] = normalizeStringArray(value2[field], field);
  }
  const dependsOnMissionIds = normalizeStringArray(value2.dependsOnMissionIds, "dependsOnMissionIds");
  for (const [index, missionId] of dependsOnMissionIds.entries()) {
    if (!SAFE_ID2.test(missionId)) throw new Error(`dependsOnMissionIds[${index}] must be a safe lowercase identifier.`);
  }
  if (dependsOnMissionIds.length > 0) content.dependsOnMissionIds = dependsOnMissionIds;
  const supersedesMissionId = normalizeString(value2.supersedesMissionId, null);
  if (supersedesMissionId) {
    if (!SAFE_ID2.test(supersedesMissionId)) throw new Error("supersedesMissionId must be a safe lowercase identifier.");
    content.supersedesMissionId = supersedesMissionId;
  }
  return content;
}
function missionCompletionCriterionId(_index, criterion) {
  return `criterion-${sha2562(stableMissionSerialize({ version: MISSION_CRITERION_ID_VERSION, criterion })).slice(0, 16)}`;
}
function missionEvidenceRequirementId(_index, requirement) {
  return `evidence-${sha2562(stableMissionSerialize({ version: MISSION_EVIDENCE_REQUIREMENT_ID_VERSION, requirement })).slice(0, 16)}`;
}
function missionCompletionCriteria(content = {}) {
  return (Array.isArray(content.completionCriteria) ? content.completionCriteria : []).map((criterion, index) => ({
    criterionId: missionCompletionCriterionId(index, criterion),
    criterion
  }));
}
function missionEvidenceRequirements(content = {}) {
  return (Array.isArray(content.evidenceRequirements) ? content.evidenceRequirements : []).map((requirement, index) => ({
    requirementId: missionEvidenceRequirementId(index, requirement),
    requirement
  }));
}
function missionContractDigest(missionId, content) {
  return sha2562(stableMissionSerialize({
    schemaVersion: MISSION_CONTRACT_SCHEMA_VERSION,
    missionId,
    ...content,
    completionCriterionIds: missionCompletionCriteria(content).map(({ criterionId }) => criterionId),
    evidenceRequirementIds: missionEvidenceRequirements(content).map(({ requirementId }) => requirementId)
  }));
}
function currentMissionContractMetadata(mission = {}) {
  assertPlainObject2(mission, "Mission contract");
  const unknown = Object.keys(mission).filter((field) => !PERSISTED_MISSION_FIELD_SET.has(field));
  if (unknown.length > 0) throw new Error(`Mission contract does not accept unknown persisted fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  if (mission.schemaVersion !== MISSION_CONTRACT_SCHEMA_VERSION) throw new Error(`Mission contract schemaVersion ${mission.schemaVersion ?? "missing"} is unsupported.`);
  const missionId = normalizeString(mission.missionId, null);
  if (!missionId || !SAFE_ID2.test(missionId)) throw new Error("Mission contract has an invalid missionId.");
  const workspaceId = normalizeString(mission.workspaceId, null);
  if (!workspaceId || !SAFE_ID2.test(workspaceId)) throw new Error(`Mission contract has an invalid workspaceId for ${missionId}.`);
  for (const field of ["contractDigest", "createdAt", "goal", ...MISSION_CONTRACT_ARRAY_FIELDS, "completionCriterionIds", "evidenceRequirementIds"]) {
    if (!Object.hasOwn(mission, field)) throw new Error(`Mission contract is missing required persisted field $.${field}.`);
  }
  if (!HASH2.test(String(mission.contractDigest ?? ""))) throw new Error(`Mission contract has an invalid contractDigest for ${missionId}.`);
  const createdAt = normalizeString(mission.createdAt, null);
  if (!createdAt || !Number.isFinite(Date.parse(createdAt)) || new Date(Date.parse(createdAt)).toISOString() !== createdAt) {
    throw new Error(`Mission contract has an invalid createdAt timestamp for ${missionId}.`);
  }
  const content = normalizeMissionContractContent(mission);
  const completionCriterionIds = missionCompletionCriteria(content).map(({ criterionId }) => criterionId);
  const evidenceRequirementIds = missionEvidenceRequirements(content).map(({ requirementId }) => requirementId);
  return { missionId, workspaceId, createdAt, content, contractDigest: missionContractDigest(missionId, content), completionCriterionIds, evidenceRequirementIds };
}
function assertCurrentMissionContract(mission = {}, options = {}) {
  const current = currentMissionContractMetadata(mission);
  const label = options.label ?? `Mission contract ${current.missionId}`;
  if (options.workspaceId !== void 0 && current.workspaceId !== options.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  if (options.filename !== void 0 && options.filename !== `${current.missionId}.json`) throw new Error(`${label} filename must match missionId ${current.missionId}.`);
  if (mission.contractDigest !== current.contractDigest) throw new Error(`${label}.contractDigest does not match its canonical mission content.`);
  if (!Array.isArray(mission.completionCriterionIds) || stableMissionSerialize(mission.completionCriterionIds) !== stableMissionSerialize(current.completionCriterionIds)) {
    throw new Error(`${label}.completionCriterionIds do not match canonical mission content.`);
  }
  if (!Array.isArray(mission.evidenceRequirementIds) || stableMissionSerialize(mission.evidenceRequirementIds) !== stableMissionSerialize(current.evidenceRequirementIds)) {
    throw new Error(`${label}.evidenceRequirementIds do not match canonical mission content.`);
  }
  return current;
}
function validatePersistedMission(mission, options = {}) {
  assertCurrentMissionContract(mission, options);
  return mission;
}

// src/core/research-tree.mjs
import crypto4 from "node:crypto";
import fs9 from "node:fs";
import path11 from "node:path";

// src/core/source-trust.mjs
import fs8 from "node:fs";
import path10 from "node:path";

// src/core/review-artifact-snapshot.mjs
import crypto3 from "node:crypto";
import fs6 from "node:fs";
import path8 from "node:path";
var HASH_PATTERN = /^[a-f0-9]{64}$/u;
function sha256Buffer(value2) {
  return crypto3.createHash("sha256").update(value2).digest("hex");
}
function sha256File(fullPath) {
  return sha256Buffer(fs6.readFileSync(fullPath));
}
function snapshotArtifactBuffer(root, relativePath, label = "artifact") {
  const normalized = normalizeProjectRelativePath(relativePath);
  if (!normalized.ok) throw new Error(`${label} has an unsafe path ${relativePath}: ${normalized.reason}.`);
  const suppliedPath = String(relativePath).trim().replace(/\\/gu, "/");
  if (normalized.normalizedPath !== suppliedPath) throw new Error(`${label} must use a normalized project-relative path.`);
  const inspection = inspectDeclaredPath(root, suppliedPath, { requireNonEmpty: true });
  if (inspection.status !== "existing") throw new Error(`${label} is not a usable file at ${suppliedPath}: ${inspection.reason ?? inspection.status}.`);
  const canonicalPath2 = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath2 !== suppliedPath) throw new Error(`${label} must use its canonical realpath and cannot use an internal alias.`);
  const mutationContext = currentMutationContext(root);
  let content;
  if (mutationContext && typeof mutationContext.readFileSnapshot === "function") {
    const snapshot = mutationContext.readFileSnapshot(canonicalPath2);
    if (!snapshot.exists || snapshot.type !== "file" || !snapshot.buffer) throw new Error(`${label} must be an existing regular file.`);
    content = Buffer.from(snapshot.buffer);
  } else {
    if (mutationContext) mutationContext.requireCommitPrecondition(canonicalPath2);
    content = fs6.readFileSync(path8.resolve(root, canonicalPath2));
  }
  if (content.byteLength === 0) throw new Error(`${label} must be a non-empty regular file.`);
  return { path: canonicalPath2, content, sizeBytes: content.byteLength, sha256: sha256Buffer(content) };
}
function stableSnapshotSetHash(snapshots = []) {
  const canonical = [...snapshots].map(({ path: artifactPath, sizeBytes, sha256: sha2567 }) => ({ path: artifactPath, sizeBytes, sha256: sha2567 })).sort((left, right) => left.path.localeCompare(right.path));
  return sha256Buffer(`${JSON.stringify(canonical)}
`);
}
function canonicalReviewArtifactPath(root, relativePath, label = "review artifact") {
  const normalized = normalizeProjectRelativePath(relativePath);
  if (!normalized.ok) throw new Error(`${label} has an unsafe path ${relativePath}: ${normalized.reason}.`);
  const suppliedPath = String(relativePath).trim().replace(/\\/gu, "/");
  if (normalized.normalizedPath !== suppliedPath) throw new Error(`${label} must use a normalized project-relative path.`);
  const inspection = inspectDeclaredPath(root, normalized.normalizedPath, { requireNonEmpty: true, rejectBookkeeping: true });
  if (inspection.status !== "existing") throw new Error(`${label} is not a usable file at ${normalized.normalizedPath}: ${inspection.reason ?? inspection.status}.`);
  const canonicalPath2 = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath2 !== normalized.normalizedPath) throw new Error(`${label} must use its canonical realpath and cannot use an internal alias.`);
  return canonicalPath2;
}
function resolveReviewArtifactSnapshots(root, missionId, relativePaths, label = "reviewed artifacts", options = {}) {
  if (!Array.isArray(relativePaths)) throw new Error(`${label} must be an array of project-relative paths.`);
  const ownership = readArtifactOwnership(root);
  const ownerByPath = new Map(ownership.artifacts.map((item) => [item.path, item]));
  const snapshots = [];
  const seen = /* @__PURE__ */ new Set();
  for (const [index, relativePath] of relativePaths.entries()) {
    if (typeof relativePath !== "string" || !relativePath.trim()) throw new Error(`${label}[${index}] must be a non-empty path.`);
    const canonicalPath2 = canonicalReviewArtifactPath(root, relativePath, `${label}[${index}]`);
    if (seen.has(canonicalPath2)) continue;
    seen.add(canonicalPath2);
    const owner = ownerByPath.get(canonicalPath2);
    if (!owner) throw new Error(`${label}[${index}] is not a registered schema 9 artifact: ${canonicalPath2}.`);
    if (owner.missionId !== missionId) throw new Error(`${label}[${index}] belongs to mission ${owner.missionId}, not ${missionId}.`);
    const inspection = inspectDeclaredPath(root, canonicalPath2, { requireNonEmpty: true, rejectBookkeeping: true });
    const snapshot = {
      path: canonicalPath2,
      sizeBytes: inspection.sizeBytes,
      sha256: sha256File(path8.resolve(root, canonicalPath2))
    };
    if (options.requireOwnershipCurrent !== false && snapshot.sha256 !== owner.sha256) {
      throw new Error(`${label}[${index}] has changed since its latest ownership receipt: ${canonicalPath2}.`);
    }
    snapshots.push(snapshot);
  }
  if (snapshots.length === 0) throw new Error(`${label} requires at least one existing non-empty non-bookkeeping mission-owned artifact.`);
  snapshots.sort((left, right) => left.path.localeCompare(right.path));
  return { reviewedArtifacts: snapshots, reviewedArtifactSetSha256: stableSnapshotSetHash(snapshots) };
}
function normalizeReviewSnapshots(value2, label = "reviewedArtifacts") {
  if (!Array.isArray(value2) || value2.length === 0) return { ok: false, snapshots: [], reason: `${label} must contain artifact snapshots` };
  const snapshots = [];
  const seen = /* @__PURE__ */ new Set();
  for (const [index, item] of value2.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false, snapshots: [], reason: `${label}[${index}] must be an object` };
    if (Object.keys(item).some((field) => !["path", "sizeBytes", "sha256"].includes(field))) return { ok: false, snapshots: [], reason: `${label}[${index}] has unknown fields` };
    const normalized = normalizeProjectRelativePath(item.path);
    if (!normalized.ok || normalized.normalizedPath !== item.path || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || !HASH_PATTERN.test(String(item.sha256 ?? ""))) {
      return { ok: false, snapshots: [], reason: `${label}[${index}] is invalid` };
    }
    if (seen.has(item.path)) return { ok: false, snapshots: [], reason: `${label} contains duplicate paths` };
    seen.add(item.path);
    snapshots.push({ path: item.path, sizeBytes: item.sizeBytes, sha256: item.sha256 });
  }
  snapshots.sort((left, right) => left.path.localeCompare(right.path));
  return { ok: true, snapshots, reason: null };
}
function verifyReviewSnapshotSet(root, preparedSnapshots, expectedSetHash) {
  const normalized = normalizeReviewSnapshots(preparedSnapshots);
  const failures = [];
  if (!normalized.ok) return { ok: false, failures: [normalized.reason], reviewedArtifacts: [], reviewedArtifactSetSha256: null };
  const setHash = stableSnapshotSetHash(normalized.snapshots);
  if (setHash !== expectedSetHash) failures.push("reviewed-artifact-set-hash-mismatch");
  for (const prepared of normalized.snapshots) {
    const inspection = inspectDeclaredPath(root, prepared.path, { requireNonEmpty: true, rejectBookkeeping: true });
    if (inspection.status !== "existing") {
      failures.push(`reviewed-artifact-${inspection.status}:${prepared.path}`);
      continue;
    }
    const canonicalPath2 = inspection.canonicalRelativePath ?? inspection.normalizedPath;
    if (inspection.normalizedPath !== prepared.path || canonicalPath2 !== prepared.path) {
      failures.push(`reviewed-artifact-path-changed:${prepared.path}`);
      continue;
    }
    const current = { path: canonicalPath2, sizeBytes: inspection.sizeBytes, sha256: sha256File(path8.resolve(root, canonicalPath2)) };
    if (JSON.stringify(current) !== JSON.stringify(prepared)) failures.push(`reviewed-artifact-changed:${prepared.path}`);
  }
  return {
    ok: failures.length === 0,
    failures: [...new Set(failures)],
    reviewedArtifacts: normalized.snapshots,
    reviewedArtifactSetSha256: setHash
  };
}

// src/core/workspace.mjs
import fs7 from "node:fs";
import path9 from "node:path";
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function resolvePath(root, relativePath) {
  return path9.join(root, relativePath);
}
function cloneFallback(fallback) {
  return typeof fallback === "function" ? fallback() : structuredClone(fallback);
}
function requireMutationContext(root, operation) {
  const context = currentMutationContext(root);
  if (!context) throw new Error(`${operation} requires an active MutationContext.`);
  return context;
}
function readJson(root, relativePath, fallback) {
  const context = currentMutationContext(root);
  if (context) return context.readJson(relativePath, fallback);
  const fullPath = resolvePath(root, relativePath);
  if (!fs7.existsSync(fullPath)) return cloneFallback(fallback);
  try {
    return JSON.parse(fs7.readFileSync(fullPath, "utf8"));
  } catch (error) {
    throw new Error(`Malformed JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function writeJson(root, relativePath, value2) {
  return requireMutationContext(root, "writeJson").writeJson(relativePath, value2);
}
function writeText(root, relativePath, content) {
  return requireMutationContext(root, "writeText").writeText(relativePath, content);
}
function assertGovernanceMutationRegistered(actionId, expectedMode) {
  const guarded = new Set(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.id));
  const exempt = new Map(GOVERNANCE_EXEMPT_MUTATIONS.map((entry) => [entry.id, entry]));
  if (expectedMode === "guarded") {
    if (!guarded.has(actionId)) throw new Error(`Governance registry missing guarded mutation entry: ${actionId}`);
    return;
  }
  if (expectedMode === "exempt") {
    const entry = exempt.get(actionId);
    if (!entry) throw new Error(`Governance registry missing exempt mutation entry: ${actionId}`);
    if (entry.sunsetAt && entry.sunsetAt <= nowIso()) throw new Error(`Governance exempt entry expired: ${actionId}`);
    return;
  }
  throw new Error(`Unknown governance mutation mode: ${expectedMode}`);
}

// src/core/source-trust.mjs
var SOURCE_LIFECYCLE_STATES = Object.freeze(["candidate", "rejected"]);
var SOURCE_FIELDS = /* @__PURE__ */ new Set([
  "schemaVersion",
  "sourceId",
  "missionId",
  "contractDigest",
  "citationKey",
  "title",
  "authors",
  "year",
  "locator",
  "sourceType",
  "abstract",
  "origin",
  "identityFingerprint",
  "capturedMaterial",
  "lifecycle",
  "currentDecision"
]);
var CAPTURED_MATERIAL_FIELDS = /* @__PURE__ */ new Set(["path", "sizeBytes", "sha256"]);
var CANDIDATE_DECISION_FIELDS = /* @__PURE__ */ new Set(["decision", "decidedAt", "reason"]);
var REJECTED_DECISION_FIELDS = /* @__PURE__ */ new Set(["decision", "method", "checkedMaterial", "auditEvidence", "decidedAt"]);
var AUDIT_EVIDENCE_FIELDS = /* @__PURE__ */ new Set(["reference", "kind", "observation"]);
var HASH_PATTERN2 = /^[0-9a-f]{64}$/u;
var NOTE_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "noteId", "missionId", "contractDigest", "title", "summary", "quotes", "claims", "openQuestions", "sourceIds", "artifactRefs", "updatedAt"]);
var REGISTER_FIELDS = /* @__PURE__ */ new Set(["missionId", "sourceId", "citationKey", "title", "authors", "year", "locator", "sourceType", "abstract", "origin", "capturePath"]);
var REJECT_FIELDS = /* @__PURE__ */ new Set(["missionId", "sourceId", "method", "checkedMaterial", "auditEvidence"]);
var QUERY_FIELDS = /* @__PURE__ */ new Set(["missionId", "sourceId", "lifecycle", "limit"]);
function normalizeText(value2) {
  return typeof value2 === "string" ? value2.trim().replace(/\s+/gu, " ") : "";
}
function normalizeIdentityText(value2) {
  return normalizeText(value2).normalize("NFKC").toLowerCase();
}
function normalizeDoi(value2) {
  const text = normalizeIdentityText(value2).replace(/^https?:\/\/(?:dx\.)?doi\.org\//u, "");
  return text.startsWith("10.") ? text : "";
}
function normalizeUrl(value2) {
  const text = normalizeText(value2);
  if (!text) return "";
  try {
    const parsed2 = new URL(text);
    if (!["http:", "https:"].includes(parsed2.protocol)) return "";
    parsed2.hash = "";
    parsed2.hostname = parsed2.hostname.toLowerCase();
    if (parsed2.protocol === "https:" && parsed2.port === "443" || parsed2.protocol === "http:" && parsed2.port === "80") parsed2.port = "";
    return parsed2.toString();
  } catch {
    return "";
  }
}
function canonicalSourceIdentity(source = {}) {
  return {
    doi: normalizeDoi(source.doi) || normalizeDoi(source.locator),
    url: normalizeUrl(source.url) || normalizeUrl(source.locator),
    locator: normalizeIdentityText(source.locator),
    title: normalizeIdentityText(source.title),
    authors: (Array.isArray(source.authors) ? source.authors : []).map(normalizeIdentityText).filter(Boolean).sort()
  };
}
function sourceIdentityFingerprint(source = {}) {
  return domainSha256(JSON.stringify(canonicalSourceIdentity(source)));
}
function sourcePath(sourceId) {
  return path10.posix.join(".dove/sources", `${sourceId}.json`);
}
function notePath(noteId) {
  return path10.posix.join(".dove/notes", `${noteId}.json`);
}
function assertSealed2(value2, fields, label) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) throw new Error(`${label} must be a plain object.`);
  const unknown = Object.keys(value2).filter((field) => !fields.has(field));
  if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function exactTimestamp(value2, label) {
  if (typeof value2 !== "string" || !Number.isFinite(Date.parse(value2)) || new Date(Date.parse(value2)).toISOString() !== value2) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return value2;
}
function validateStoredSource(root, source, filename, missions, label) {
  assertSealed2(source, SOURCE_FIELDS, label);
  if (source.schemaVersion !== 1) throw new Error(`${label} has an unsupported schemaVersion.`);
  const sourceId = domainSafeId(source.sourceId, `${label}.sourceId`);
  if (filename !== `${sourceId}.json`) throw new Error(`${label} filename must match sourceId ${sourceId}.`);
  const missionId = domainSafeId(source.missionId, `${label}.missionId`);
  const mission = missions.get(missionId);
  if (!mission) throw new Error(`${label} references unknown mission ${missionId}.`);
  if (!HASH_PATTERN2.test(String(source.contractDigest ?? "")) || source.contractDigest !== mission.contractDigest) throw new Error(`${label}.contractDigest does not match mission ${missionId}.`);
  if (!SOURCE_LIFECYCLE_STATES.includes(source.lifecycle)) throw new Error(`${label}.lifecycle must be candidate or rejected; stored verified source state is invalid.`);
  if (source.identityFingerprint !== sourceIdentityFingerprint(source)) throw new Error(`${label}.identityFingerprint does not match current source identity.`);
  if (!source.title && !source.locator) throw new Error(`${label} requires a title or locator.`);
  if (!Array.isArray(source.authors) || source.authors.some((item) => typeof item !== "string" || !item.trim()) || new Set(source.authors).size !== source.authors.length) throw new Error(`${label}.authors must be a unique string array.`);
  if (!source.capturedMaterial) throw new Error(`${label}.capturedMaterial is required.`);
  assertSealed2(source.capturedMaterial, CAPTURED_MATERIAL_FIELDS, `${label}.capturedMaterial`);
  const materialPath = canonicalDomainPath(source.capturedMaterial.path, `${label}.capturedMaterial.path`, ".dove/sources/materials");
  if (!HASH_PATTERN2.test(String(source.capturedMaterial.sha256 ?? ""))) throw new Error(`${label}.capturedMaterial.sha256 must be a lowercase SHA-256 hash.`);
  if (!Number.isSafeInteger(source.capturedMaterial.sizeBytes) || source.capturedMaterial.sizeBytes <= 0) throw new Error(`${label}.capturedMaterial.sizeBytes must be a positive safe integer.`);
  const material = capturedMaterial(root, materialPath, { includeContent: true });
  if (!material || material.path !== materialPath || material.sizeBytes !== source.capturedMaterial.sizeBytes || material.sha256 !== source.capturedMaterial.sha256) throw new Error(`${label}.capturedMaterial is missing, aliased, empty, size-drifted, or hash-drifted.`);
  const expectedDecisionFields = source.lifecycle === "candidate" ? CANDIDATE_DECISION_FIELDS : REJECTED_DECISION_FIELDS;
  assertSealed2(source.currentDecision, expectedDecisionFields, `${label}.currentDecision`);
  if (source.currentDecision.decision !== source.lifecycle) throw new Error(`${label}.currentDecision.decision must match lifecycle ${source.lifecycle}.`);
  exactTimestamp(source.currentDecision.decidedAt, `${label}.currentDecision.decidedAt`);
  if (source.lifecycle === "candidate") {
    domainNonEmptyText(source.currentDecision.reason, `${label}.currentDecision.reason`);
  } else {
    domainNonEmptyText(source.currentDecision.method, `${label}.currentDecision.method`);
    domainNonEmptyText(source.currentDecision.checkedMaterial, `${label}.currentDecision.checkedMaterial`);
    if (!Array.isArray(source.currentDecision.auditEvidence) || source.currentDecision.auditEvidence.length === 0) throw new Error(`${label}.currentDecision.auditEvidence must contain at least one item.`);
    source.currentDecision.auditEvidence.forEach((item, index) => {
      assertSealed2(item, AUDIT_EVIDENCE_FIELDS, `${label}.currentDecision.auditEvidence[${index}]`);
      for (const field of AUDIT_EVIDENCE_FIELDS) domainNonEmptyText(item[field], `${label}.currentDecision.auditEvidence[${index}].${field}`);
    });
  }
  return source;
}
function readSourceFiles(root) {
  const workspace = openDoveWorkspace(root, { operation: "Source query" });
  const directory = path10.resolve(root, ".dove/sources");
  return fs8.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.name !== "materials").map((entry) => {
    const relativePath = path10.posix.join(".dove/sources", entry.name);
    if (entry.isSymbolicLink()) throw new Error(`${relativePath} must not be a symbolic link.`);
    if (!entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${relativePath} must be a regular JSON source file.`);
    return validateStoredSource(root, readJson(root, relativePath, null), entry.name, workspace.missions, relativePath);
  }).sort((left, right) => String(left.sourceId).localeCompare(String(right.sourceId)));
}
function capturedMaterial(root, capturePath, options = {}) {
  if (!capturePath) return null;
  const canonicalPath2 = canonicalDomainPath(capturePath, "capturePath");
  const snapshot = snapshotArtifactBuffer(root, canonicalPath2, "capturePath");
  return options.includeContent === true ? snapshot : { path: snapshot.path, sha256: snapshot.sha256 };
}
function sourceRecord(args2, capturedMaterial2, contractDigest, current = null) {
  const missionId = domainSafeId(args2.missionId, "missionId");
  const sourceId = domainSafeId(args2.sourceId, "sourceId");
  const title = normalizeText(args2.title);
  const locator = normalizeText(args2.locator);
  if (!title && !locator) throw new Error("register_source requires a real title or locator.");
  const authors = domainStringArray(args2.authors, "authors");
  const identityFields = { title, authors, locator };
  const fingerprint = sourceIdentityFingerprint(identityFields);
  return {
    schemaVersion: 1,
    sourceId,
    missionId,
    contractDigest,
    citationKey: normalizeText(args2.citationKey) || null,
    title: title || null,
    authors,
    year: args2.year === void 0 || args2.year === null || String(args2.year).trim() === "" ? null : String(args2.year).trim(),
    locator: locator || null,
    sourceType: normalizeText(args2.sourceType) || null,
    abstract: normalizeText(args2.abstract) || null,
    origin: normalizeText(args2.origin) || null,
    identityFingerprint: fingerprint,
    capturedMaterial: capturedMaterial2,
    lifecycle: "candidate",
    currentDecision: {
      decision: "candidate",
      decidedAt: (/* @__PURE__ */ new Date()).toISOString(),
      reason: current ? "source-registration-refreshed" : "source-registered"
    }
  };
}
function registerSource(root, args2 = {}) {
  assertSealedDomainArgs(args2, REGISTER_FIELDS, "register_source");
  const { mission } = readCurrentMission(root, args2.missionId, "Source registration");
  readSourceFiles(root);
  const sourceId = domainSafeId(args2.sourceId, "sourceId");
  const relativePath = sourcePath(sourceId);
  const existing = fs8.existsSync(path10.resolve(root, relativePath)) ? readJson(root, relativePath, null) : null;
  if (existing && existing.missionId !== mission.missionId) throw new Error(`Source ${args2.sourceId} belongs to mission ${existing.missionId}.`);
  const captured = capturedMaterial(root, args2.capturePath, { includeContent: true });
  if (!captured) throw new Error("register_source requires capturePath for concrete non-empty captured material.");
  const materialPath = path10.posix.join(".dove/sources/materials", `${sourceId}${path10.extname(captured.path).toLowerCase() || ".bin"}`);
  const sourceMaterial = { path: materialPath, sizeBytes: captured.sizeBytes, sha256: captured.sha256 };
  const source = sourceRecord(args2, sourceMaterial, mission.contractDigest, existing);
  const writes = [{ path: relativePath, kind: "data", content: domainJson(source), derivedReferences: [`artifact:${source.capturedMaterial.path}`] }];
  writes.unshift({ path: materialPath, kind: "document", content: captured.content, derivedReferences: [] });
  return {
    ...finalizeDomainArtifacts(root, {
      actionId: "register-source",
      operation: "Source registration",
      missionId: mission.missionId,
      summary: `Registered source candidate ${source.sourceId}.`,
      completionEligible: false,
      writes
    }),
    source
  };
}
function normalizeAuditEvidence(value2) {
  if (!Array.isArray(value2) || value2.length === 0) throw new Error("verify_source requires at least one auditEvidence item.");
  return value2.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`auditEvidence[${index}] must be an object.`);
    const unknown = Object.keys(item).filter((field) => !["reference", "kind", "observation"].includes(field));
    if (unknown.length) throw new Error(`auditEvidence[${index}] does not accept unknown fields: ${unknown.join(", ")}.`);
    return {
      reference: domainNonEmptyText(item.reference, `auditEvidence[${index}].reference`),
      kind: domainNonEmptyText(item.kind, `auditEvidence[${index}].kind`),
      observation: domainNonEmptyText(item.observation, `auditEvidence[${index}].observation`)
    };
  });
}
function verifySource(root, args2 = {}) {
  assertSealedDomainArgs(args2, REJECT_FIELDS, "verify_source");
  const { mission } = readCurrentMission(root, args2.missionId, "Source rejection");
  readSourceFiles(root);
  const sourceId = domainSafeId(args2.sourceId, "sourceId");
  const relativePath = sourcePath(sourceId);
  const source = readJson(root, relativePath, null);
  if (!source) throw new Error(`Unknown source: ${sourceId}.`);
  if (source.missionId !== mission.missionId) throw new Error(`Source ${sourceId} belongs to mission ${source.missionId}.`);
  const next = {
    ...source,
    lifecycle: "rejected",
    currentDecision: {
      decision: "rejected",
      method: domainNonEmptyText(args2.method, "method"),
      checkedMaterial: domainNonEmptyText(args2.checkedMaterial, "checkedMaterial"),
      auditEvidence: normalizeAuditEvidence(args2.auditEvidence),
      decidedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  };
  return {
    ...finalizeDomainArtifacts(root, {
      actionId: "verify-source",
      operation: "Source rejection",
      missionId: mission.missionId,
      summary: `Rejected source ${sourceId}.`,
      completionEligible: false,
      writes: [{ path: relativePath, kind: "data", content: domainJson(next), derivedReferences: [] }]
    }),
    source: next
  };
}
function sourceEligibility(source, _verifications = [], options = {}) {
  if (!source) return { eligible: false, reason: "unknown-source", source: null, verification: null };
  const missionId = normalizeText(options.missionId);
  if (!missionId || source.missionId !== missionId) return { eligible: false, reason: "source-mission-binding-mismatch", source, verification: source.currentDecision ?? null };
  if (!SOURCE_LIFECYCLE_STATES.includes(source.lifecycle) || source.currentDecision?.decision !== source.lifecycle) return { eligible: false, reason: "source-durable-state-invalid", source, verification: source.currentDecision ?? null };
  if (source.identityFingerprint !== sourceIdentityFingerprint(source)) return { eligible: false, reason: "source-identity-changed", source, verification: source.currentDecision ?? null };
  if (!source.capturedMaterial) return { eligible: false, reason: "source-captured-material-missing", source, verification: source.currentDecision ?? null };
  try {
    const material = capturedMaterial(options.root, source.capturedMaterial.path, { includeContent: true });
    if (!material || material.sha256 !== source.capturedMaterial.sha256 || material.sizeBytes !== source.capturedMaterial.sizeBytes) return { eligible: false, reason: "source-captured-material-changed", source, verification: source.currentDecision ?? null };
  } catch {
    return { eligible: false, reason: "source-captured-material-invalid", source, verification: source.currentDecision ?? null };
  }
  return { eligible: false, reason: `source-${source.lifecycle}`, source, verification: source.currentDecision ?? null };
}
function evaluateSourceIds(root, sourceIds = [], missionId = null) {
  const byId = new Map(readSourceFiles(root).map((source) => [source.sourceId, source]));
  return sourceIds.map((sourceId) => ({ sourceId, ...sourceEligibility(byId.get(sourceId) ?? null, [], { root, missionId }) }));
}
function evaluateSourceReferences(root, references = [], missionId = null) {
  const sources = readSourceFiles(root);
  const byReference = new Map(sources.flatMap((source) => [source.sourceId, source.citationKey, source.locator].filter(Boolean).map((reference) => [reference, source])));
  return references.map((reference) => ({ reference, ...sourceEligibility(byReference.get(reference) ?? null, [], { root, missionId }) }));
}
function evaluateNoteReferences(root, references = [], missionId = null) {
  const workspace = openDoveWorkspace(root, { operation: "Note evidence receipt ledger read" });
  const owned = new Map(workspace.receiptLedger.currentOwnership.map((item) => [item.path, item]));
  const receiptById = new Map(workspace.receiptLedger.receipts.map((item) => [item.receiptId, item]));
  return references.map((reference) => {
    let noteId;
    try {
      noteId = domainSafeId(reference, "note reference");
    } catch {
      return { reference, eligible: false, reason: "note-reference-invalid", note: null, owner: null, sources: [], artifacts: [] };
    }
    const relativePath = notePath(noteId);
    const owner = owned.get(relativePath) ?? null;
    if (!owner) return { reference, eligible: false, reason: "note-ownership-missing", note: null, owner: null, sources: [], artifacts: [] };
    if (!missionId || owner.missionId !== missionId) return { reference, eligible: false, reason: "note-owner-mission-mismatch", note: null, owner, sources: [], artifacts: [] };
    let snapshot;
    try {
      snapshot = snapshotArtifactBuffer(root, relativePath, `note ${noteId}`);
    } catch {
      return { reference, eligible: false, reason: "note-path-invalid", note: null, owner, sources: [], artifacts: [] };
    }
    if (snapshot.sha256 !== owner.sha256) return { reference, eligible: false, reason: "note-hash-drift", note: null, owner, sources: [], artifacts: [] };
    let note;
    try {
      note = JSON.parse(snapshot.content.toString("utf8"));
      assertSealed2(note, NOTE_FIELDS, `note ${noteId}`);
    } catch {
      return { reference, eligible: false, reason: "note-schema-invalid", note: null, owner, sources: [], artifacts: [] };
    }
    const ownerReceipt = receiptById.get(owner.receiptId);
    if (note.schemaVersion !== 2 || note.noteId !== noteId || note.missionId !== missionId || note.contractDigest !== owner.contractDigest || ownerReceipt?.contractDigest !== note.contractDigest) {
      return { reference, eligible: false, reason: "note-binding-invalid", note, owner, sources: [], artifacts: [] };
    }
    exactTimestamp(note.updatedAt, `note ${noteId}.updatedAt`);
    const sourceIds = Array.isArray(note.sourceIds) ? note.sourceIds : [];
    const artifactRefs = Array.isArray(note.artifactRefs) ? note.artifactRefs : [];
    if (sourceIds.length === 0 && artifactRefs.length === 0) return { reference, eligible: false, reason: "note-evidence-missing", note, owner, sources: [], artifacts: [] };
    const sources = evaluateSourceReferences(root, sourceIds, missionId);
    const sourceFailure = sources.find((item) => !item.eligible);
    const artifacts = artifactRefs.map((artifactPath) => {
      const artifactOwner = owned.get(artifactPath);
      if (!artifactOwner) return { path: artifactPath, current: false, reason: "artifact-ownership-missing" };
      if (artifactOwner.missionId !== missionId) return { path: artifactPath, current: false, reason: "artifact-mission-binding-mismatch" };
      try {
        const artifactSnapshot = snapshotArtifactBuffer(root, artifactPath, `note ${noteId} artifact`);
        return { path: artifactPath, current: artifactSnapshot.sha256 === artifactOwner.sha256, reason: artifactSnapshot.sha256 === artifactOwner.sha256 ? "current-artifact" : "artifact-hash-drift" };
      } catch (error) {
        return { path: artifactPath, current: false, reason: error instanceof Error ? error.message : "artifact-path-invalid" };
      }
    });
    const artifactFailure = artifacts.find((item) => !item.current);
    const failure = sourceFailure?.reason ?? artifactFailure?.reason ?? null;
    return { reference, eligible: !failure, reason: failure ?? "verified-note", note, owner, sources, artifacts };
  });
}
function querySources(root, args2 = {}) {
  assertSealedDomainArgs(args2, QUERY_FIELDS, "query_sources");
  const { mission } = readCurrentMission(root, args2.missionId, "Source query");
  const sourceId = normalizeText(args2.sourceId);
  const lifecycle = normalizeText(args2.lifecycle).toLowerCase();
  if (lifecycle && !SOURCE_LIFECYCLE_STATES.includes(lifecycle)) throw new Error(`lifecycle must be one of: ${SOURCE_LIFECYCLE_STATES.join(", ")}.`);
  const limit = Math.min(200, Math.max(1, Number.isFinite(Number(args2.limit)) ? Math.trunc(Number(args2.limit)) : 50));
  const items = readSourceFiles(root).filter((source) => source.missionId === mission.missionId).filter((source) => !sourceId || [source.sourceId, source.citationKey, source.locator].includes(sourceId)).filter((source) => !lifecycle || source.lifecycle === lifecycle).slice(0, limit).map((source) => {
    const eligibility = sourceEligibility(source, [], { root, missionId: mission.missionId });
    return { ...source, eligibility: { eligible: eligibility.eligible, reason: eligibility.reason } };
  });
  return { status: items.length ? "ok" : "empty", missionId: mission.missionId, sourceCount: items.length, items, writes: [] };
}

// src/core/research-tree.mjs
var RESEARCH_TREE_SCHEMA_VERSION = 1;
var RESEARCH_TREE_PROPOSAL_VERSION = 1;
var RESEARCH_TREE_NODE_STATUSES = Object.freeze(["pending", "completed", "blocked"]);
var RESEARCH_TREE_WORK_KINDS = Object.freeze(["retrieval", "experiment", "analysis"]);
var STATUS_SET = new Set(RESEARCH_TREE_NODE_STATUSES);
var WORK_KIND_SET = new Set(RESEARCH_TREE_WORK_KINDS);
var REEVALUATE_FIELDS = /* @__PURE__ */ new Set(["operation", "missionId", "requirement", "nodeUpdates"]);
var REPLAY_FIELDS = /* @__PURE__ */ new Set([
  "confirmed",
  "proposalVersion",
  "proposalWorkspace",
  "proposalDigest",
  "proposalToken",
  "mutationMode",
  "workspaceId",
  "contractDigest",
  "createdAt",
  "receiptId"
]);
var NODE_FIELDS = /* @__PURE__ */ new Set([
  "nodeId",
  "parentNodeId",
  "workKind",
  "questionOrHypothesis",
  "workDescription",
  "successOrStopCriterion",
  "status",
  "outcomeSummary",
  "outcomeEvidenceRefs",
  "blockedReasonCode",
  "lessonId",
  "createdAt",
  "updatedAt"
]);
var NODE_INPUT_FIELDS = new Set([...NODE_FIELDS].filter((field) => field !== "createdAt" && field !== "updatedAt"));
var TREE_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "missionId", "contractDigest", "revision", "nodes", "updatedAt"]);
function assertPlainObject3(value2, label) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) throw new Error(`${label} must be a plain object.`);
}
function assertSealed3(value2, fields, label) {
  assertPlainObject3(value2, label);
  const unknown = Object.keys(value2).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function exactIso2(value2, label) {
  if (typeof value2 !== "string" || !Number.isFinite(Date.parse(value2)) || new Date(Date.parse(value2)).toISOString() !== value2) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return value2;
}
function nullableSafeId(value2, label) {
  if (value2 === null) return null;
  return domainSafeId(value2, label);
}
function normalizeWorkKind(value2, label) {
  const workKind = domainNonEmptyText(value2, label).toLowerCase();
  if (!WORK_KIND_SET.has(workKind)) throw new Error(`${label} must be retrieval, experiment, or analysis.`);
  return workKind;
}
function normalizeStatus(value2, label) {
  const status = domainNonEmptyText(value2, label).toLowerCase();
  if (!STATUS_SET.has(status)) throw new Error(`${label} is unsupported.`);
  return status;
}
function normalizeOutcomeFields(value2, label, status, options = {}) {
  const evidenceRefs = domainStringArray(value2.outcomeEvidenceRefs, `${label}.outcomeEvidenceRefs`);
  if (status === "pending") {
    if (value2.outcomeSummary !== null || evidenceRefs.length !== 0 || value2.blockedReasonCode !== null || value2.lessonId !== null) {
      throw new Error(`${label} pending nodes require null outcomeSummary, blockedReasonCode, and lessonId with empty outcomeEvidenceRefs.`);
    }
    return { outcomeSummary: null, outcomeEvidenceRefs: [], blockedReasonCode: null, lessonId: null };
  }
  const outcomeSummary = domainNonEmptyText(value2.outcomeSummary, `${label}.outcomeSummary`);
  if (evidenceRefs.length === 0) throw new Error(`${label} ${status} nodes require at least one current outcomeEvidenceRef.`);
  if (status === "completed") {
    if (value2.blockedReasonCode !== null || value2.lessonId !== null) throw new Error(`${label} completed nodes must keep blockedReasonCode and lessonId null.`);
    return { outcomeSummary, outcomeEvidenceRefs: evidenceRefs, blockedReasonCode: null, lessonId: null };
  }
  const blockedReasonCode = domainSafeId(value2.blockedReasonCode, `${label}.blockedReasonCode`);
  const lessonId = options.allowUnassignedBlockedLesson === true && value2.lessonId === null ? null : domainSafeId(value2.lessonId, `${label}.lessonId`);
  return { outcomeSummary, outcomeEvidenceRefs: evidenceRefs, blockedReasonCode, lessonId };
}
function normalizeNode(value2, label, options = {}) {
  assertSealed3(value2, options.persisted === true ? NODE_FIELDS : NODE_INPUT_FIELDS, label);
  const status = normalizeStatus(value2.status, `${label}.status`);
  const outcome = normalizeOutcomeFields(value2, label, status, options);
  return {
    nodeId: domainSafeId(value2.nodeId, `${label}.nodeId`),
    parentNodeId: nullableSafeId(value2.parentNodeId, `${label}.parentNodeId`),
    workKind: normalizeWorkKind(value2.workKind, `${label}.workKind`),
    questionOrHypothesis: domainNonEmptyText(value2.questionOrHypothesis, `${label}.questionOrHypothesis`),
    workDescription: domainNonEmptyText(value2.workDescription, `${label}.workDescription`),
    successOrStopCriterion: domainNonEmptyText(value2.successOrStopCriterion, `${label}.successOrStopCriterion`),
    status,
    ...outcome,
    ...options.persisted === true ? {
      createdAt: exactIso2(value2.createdAt, `${label}.createdAt`),
      updatedAt: exactIso2(value2.updatedAt, `${label}.updatedAt`)
    } : {}
  };
}
function sameImmutableNodeFields(left, right) {
  return left.parentNodeId === right.parentNodeId && left.workKind === right.workKind && left.questionOrHypothesis === right.questionOrHypothesis && left.workDescription === right.workDescription && left.successOrStopCriterion === right.successOrStopCriterion;
}
function sameOutcome(left, right) {
  return left.status === right.status && left.outcomeSummary === right.outcomeSummary && stableWorkspaceSerialize(left.outcomeEvidenceRefs) === stableWorkspaceSerialize(right.outcomeEvidenceRefs) && left.blockedReasonCode === right.blockedReasonCode && left.lessonId === right.lessonId;
}
function assertTreeGraph(nodes, label = "Research tree") {
  const byId = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    if (byId.has(node.nodeId)) throw new Error(`${label} contains duplicate nodeId ${node.nodeId}.`);
    byId.set(node.nodeId, node);
  }
  for (const node of nodes) {
    if (node.parentNodeId === null) continue;
    if (node.parentNodeId === node.nodeId) throw new Error(`${label} node ${node.nodeId} must not parent itself.`);
    if (!byId.has(node.parentNodeId)) throw new Error(`${label} node ${node.nodeId} references unknown parent ${node.parentNodeId}.`);
  }
  for (const node of nodes) {
    const seen = /* @__PURE__ */ new Set();
    let cursor = node;
    while (cursor?.parentNodeId !== null) {
      if (seen.has(cursor.nodeId)) throw new Error(`${label} contains a cycle at ${cursor.nodeId}.`);
      seen.add(cursor.nodeId);
      cursor = byId.get(cursor.parentNodeId);
    }
  }
}
function validateResearchTree(value2, options = {}) {
  const label = options.label ?? "Research tree";
  assertSealed3(value2, TREE_FIELDS, label);
  if (value2.schemaVersion !== RESEARCH_TREE_SCHEMA_VERSION) throw new Error(`${label} has an unsupported schemaVersion.`);
  const workspaceId = domainSafeId(value2.workspaceId, `${label}.workspaceId`);
  const missionId = domainSafeId(value2.missionId, `${label}.missionId`);
  if (options.workspaceId !== void 0 && workspaceId !== options.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  if (options.missionId !== void 0 && missionId !== options.missionId) throw new Error(`${label}.missionId does not match its filename.`);
  if (options.contractDigest !== void 0 && value2.contractDigest !== options.contractDigest) throw new Error(`${label}.contractDigest does not match mission ${missionId}.`);
  if (!/^[0-9a-f]{64}$/u.test(String(value2.contractDigest ?? ""))) throw new Error(`${label}.contractDigest must be a lowercase SHA-256 digest.`);
  if (!Number.isSafeInteger(value2.revision) || value2.revision < 1) throw new Error(`${label}.revision must be a positive safe integer.`);
  exactIso2(value2.updatedAt, `${label}.updatedAt`);
  if (!Array.isArray(value2.nodes) || value2.nodes.length === 0) throw new Error(`${label}.nodes must contain at least one decision node.`);
  const nodes = value2.nodes.map((node, index) => {
    const normalized = normalizeNode(node, `${label}.nodes[${index}]`, { persisted: true });
    if (Date.parse(normalized.updatedAt) < Date.parse(normalized.createdAt)) throw new Error(`${label}.nodes[${index}].updatedAt must not precede createdAt.`);
    return normalized;
  });
  assertTreeGraph(nodes, label);
  return { ...value2, nodes };
}
function researchTreePath(missionId) {
  return path11.posix.join(ARTIFACT_PATHS.researchTreesDir, `${domainSafeId(missionId, "missionId")}.json`);
}
function readResearchTree(root, missionId, options = {}) {
  const { workspace, mission } = readCurrentMission(root, missionId, options.operation ?? "Research tree read");
  const relativePath = researchTreePath(mission.missionId);
  const context = currentMutationContext(root);
  const exists = context ? context.fileExists(relativePath) : fs9.existsSync(path11.resolve(root, relativePath));
  if (!exists) return null;
  return validateResearchTree(readJson(root, relativePath, null), {
    label: relativePath,
    workspaceId: workspace.manifest.workspaceId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest
  });
}
function mutationModeFor(root, args2) {
  const explicit = Object.hasOwn(args2, "mutationMode") ? normalizeMutationMode(args2.mutationMode) : null;
  const active = currentMutationContext(root)?.mutationMode ?? null;
  if (active && explicit && active !== explicit) throw new Error(`reevaluate-research-tree mutationMode ${explicit} does not match the active mutation context mode ${active}.`);
  return active ?? explicit ?? "direct-process";
}
function createdAtFor(args2) {
  if (args2.confirmed !== true) return (/* @__PURE__ */ new Date()).toISOString();
  return exactIso2(args2.createdAt, "createdAt");
}
function normalizedArgs(args2) {
  if (args2.operation !== "reevaluate-research-tree") throw new Error("Research-tree reevaluation requires operation reevaluate-research-tree.");
  if (!Array.isArray(args2.nodeUpdates) || args2.nodeUpdates.length === 0) throw new Error("reevaluate-research-tree requires at least one decision node update.");
  const nodeUpdates = args2.nodeUpdates.map((node, index) => normalizeNode(node, `nodeUpdates[${index}]`, { allowUnassignedBlockedLesson: true }));
  if (new Set(nodeUpdates.map((node) => node.nodeId)).size !== nodeUpdates.length) throw new Error("nodeUpdates must not contain duplicate nodeId values.");
  return {
    operation: "reevaluate-research-tree",
    missionId: domainSafeId(args2.missionId, "missionId"),
    requirement: domainNonEmptyText(args2.requirement, "requirement"),
    nodeUpdates
  };
}
function validateCurrentEvidenceRefs(root, missionId, references, label) {
  return references.map((reference, index) => {
    if (reference.startsWith("source:")) {
      const sourceId = domainSafeId(reference.slice("source:".length), `${label}[${index}] source id`);
      const evaluation = evaluateSourceReferences(root, [sourceId], missionId)[0];
      if (!evaluation?.eligible) throw new Error(`${label}[${index}] is not current eligible source evidence: ${evaluation?.reason ?? "unknown-source"}.`);
      return { reference: `source:${sourceId}`, sourceId };
    }
    if (reference.startsWith("note:")) {
      const noteId = domainSafeId(reference.slice("note:".length), `${label}[${index}] note id`);
      const evaluation = evaluateNoteReferences(root, [noteId], missionId)[0];
      if (!evaluation?.eligible) throw new Error(`${label}[${index}] is not current eligible note evidence: ${evaluation?.reason ?? "unknown-note"}.`);
      return { reference: `note:${noteId}`, noteId };
    }
    if (reference.startsWith("validation:")) {
      const validation = resolveMissionValidationReference(root, missionId, reference.slice("validation:".length), `${label}[${index}]`);
      return { reference: `validation:${validation.reference}`, validation };
    }
    const rawPath = reference.startsWith("artifact:") ? reference.slice("artifact:".length) : reference;
    const [artifact] = resolveMissionArtifactReferences(root, missionId, [rawPath], `${label}[${index}]`);
    return { reference: `artifact:${artifact.path}`, artifact };
  });
}
function deterministicLessonId(missionId, revision, nodeId) {
  return `research-blocked-${domainSha256(`${missionId}
${revision}
${nodeId}`).slice(0, 24)}`;
}
function failureLesson(workspaceId, mission, treeRevision, node, evidence, createdAt) {
  const sourceIds = evidence.filter((item) => item.sourceId).map((item) => item.sourceId);
  const noteIds = evidence.filter((item) => item.noteId).map((item) => item.noteId);
  const artifactRefs = evidence.filter((item) => item.artifact).map((item) => ({ path: item.artifact.path, sha256: item.artifact.sha256 }));
  return {
    schemaVersion: 2,
    workspaceId,
    lessonId: node.lessonId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    scope: "mission",
    kind: "failure",
    researchTreeOrigin: { nodeId: node.nodeId, treeRevision, blockedReasonCode: node.blockedReasonCode },
    summary: `Research decision ${node.nodeId} was blocked: ${node.outcomeSummary}`,
    nextTimeGuidance: [`Reevaluate ${node.nodeId} only when the host presents a new user requirement or explicit direction.`],
    sourceIds,
    noteIds,
    artifactRefs,
    appliesToArtifactRefs: [],
    tags: ["research-tree", "blocked", node.blockedReasonCode],
    createdAt
  };
}
function buildProposal(root, args2) {
  const input = normalizedArgs(args2);
  const { workspace, mission } = readCurrentMission(root, input.missionId, "Research tree reevaluation");
  const mutationMode2 = mutationModeFor(root, args2);
  if (args2.confirmed === true) {
    if (args2.workspaceId !== workspace.manifest.workspaceId) throw new Error("Confirmed research-tree replay no longer matches the workspace identity.");
    if (args2.contractDigest !== mission.contractDigest) throw new Error("Confirmed research-tree replay no longer matches the mission contract digest.");
  }
  const currentTree = readResearchTree(root, mission.missionId, { operation: "Research tree reevaluation" });
  const currentNodes = currentTree?.nodes ?? [];
  const byId = new Map(currentNodes.map((node) => [node.nodeId, node]));
  const createdAt = createdAtFor(args2);
  const fromRevision = currentTree?.revision ?? 0;
  const toRevision = fromRevision + 1;
  const addedNodes = [];
  const completedNodes = [];
  const blockedNodes = [];
  const unchangedNodes = [];
  const blockedEvidence = /* @__PURE__ */ new Map();
  for (const update of input.nodeUpdates) {
    const existing = byId.get(update.nodeId);
    const assignedUpdate = update.status === "blocked" ? { ...update, lessonId: deterministicLessonId(mission.missionId, toRevision, update.nodeId) } : update;
    if (!existing) {
      if (assignedUpdate.status !== "pending") {
        throw new Error("New research-tree nodes must start as pending before they can become completed or blocked.");
      }
      const added = { ...assignedUpdate, createdAt, updatedAt: createdAt };
      addedNodes.push(added);
      byId.set(added.nodeId, added);
      continue;
    }
    if (!sameImmutableNodeFields(existing, assignedUpdate)) throw new Error(`Research tree node ${update.nodeId} may not change its parent or decision definition after persistence.`);
    if (existing.status !== "pending") {
      if (!sameOutcome(existing, assignedUpdate)) throw new Error(`Research tree node ${update.nodeId} is terminal and may not change after ${existing.status}.`);
      unchangedNodes.push(existing.nodeId);
      continue;
    }
    if (assignedUpdate.status === "pending") {
      unchangedNodes.push(existing.nodeId);
      continue;
    }
    const outcomeEvidence = validateCurrentEvidenceRefs(root, mission.missionId, assignedUpdate.outcomeEvidenceRefs, `nodeUpdates.${assignedUpdate.nodeId}.outcomeEvidenceRefs`);
    if (assignedUpdate.status === "blocked") {
      blockedEvidence.set(assignedUpdate.nodeId, outcomeEvidence);
    }
    const changed = { ...existing, ...assignedUpdate, createdAt: existing.createdAt, updatedAt: createdAt };
    byId.set(changed.nodeId, changed);
    if (changed.status === "completed") completedNodes.push(changed);
    else blockedNodes.push(changed);
  }
  if (blockedNodes.length > 0 && addedNodes.length > 0) throw new Error("A blocked research-tree reevaluation must not add alternative or replacement nodes in the same proposal.");
  if (addedNodes.length === 0 && completedNodes.length === 0 && blockedNodes.length === 0) throw new Error("Research-tree reevaluation produced no durable decision changes; no write proposal was created.");
  const nodes = [...byId.values()];
  assertTreeGraph(nodes);
  const tree = {
    schemaVersion: RESEARCH_TREE_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    revision: toRevision,
    nodes,
    updatedAt: createdAt
  };
  validateResearchTree(tree, { workspaceId: workspace.manifest.workspaceId, missionId: mission.missionId, contractDigest: mission.contractDigest });
  const lessons = blockedNodes.map((node) => failureLesson(workspace.manifest.workspaceId, mission, toRevision, node, blockedEvidence.get(node.nodeId) ?? [], createdAt));
  const receiptId = args2.confirmed === true ? domainSafeId(args2.receiptId, "receiptId") : `receipt-create-dove-mission-${crypto4.randomUUID()}`;
  const diff = {
    fromRevision,
    toRevision,
    addedNodes: addedNodes.map((node) => node.nodeId),
    completedNodes: completedNodes.map((node) => node.nodeId),
    blockedNodes: blockedNodes.map((node) => node.nodeId),
    unchangedNodes
  };
  const proposalWorkspace = canonicalWorkspacePath(root);
  const envelope = {
    proposalVersion: RESEARCH_TREE_PROPOSAL_VERSION,
    proposalWorkspace,
    workspaceId: workspace.manifest.workspaceId,
    mutationMode: mutationMode2,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    requirement: input.requirement,
    currentTreeDigest: currentTree ? domainSha256(stableWorkspaceSerialize(currentTree)) : null,
    tree,
    diff,
    lessons,
    receiptId
  };
  const proposalDigest = domainSha256(stableWorkspaceSerialize(envelope));
  return { input, mission, tree, diff, lessons, receiptId, envelope, proposalDigest, mutationMode: mutationMode2, relativePath: researchTreePath(mission.missionId) };
}
function confirmArgsFor(proposal) {
  return {
    operation: proposal.input.operation,
    confirmed: true,
    proposalVersion: RESEARCH_TREE_PROPOSAL_VERSION,
    proposalWorkspace: proposal.envelope.proposalWorkspace,
    proposalDigest: proposal.proposalDigest,
    mutationMode: proposal.mutationMode,
    workspaceId: proposal.envelope.workspaceId,
    contractDigest: proposal.envelope.contractDigest,
    createdAt: proposal.tree.updatedAt,
    receiptId: proposal.receiptId,
    missionId: proposal.input.missionId,
    requirement: proposal.input.requirement,
    nodeUpdates: proposal.input.nodeUpdates
  };
}
function withToken(proposal) {
  const confirmArgs2 = confirmArgsFor(proposal);
  const proposalToken2 = Buffer.from(JSON.stringify({ version: RESEARCH_TREE_PROPOSAL_VERSION, mutationMode: proposal.mutationMode, confirmArgs: confirmArgs2 }), "utf8").toString("base64url");
  return { ...proposal, proposalToken: proposalToken2 };
}
function assertExactReplay(root, proposal, args2) {
  if (!currentMutationContext(root)) throw new Error("Confirmed research-tree reevaluation requires an active MutationContext.");
  if (args2.proposalVersion !== RESEARCH_TREE_PROPOSAL_VERSION) throw new Error("The selected research-tree proposal version is unsupported. Request a fresh proposal.");
  const expected = confirmArgsFor(proposal);
  const supplied = Object.fromEntries(Object.entries(args2).filter(([field]) => REEVALUATE_FIELDS.has(field) || REPLAY_FIELDS.has(field)));
  if (stableWorkspaceSerialize(supplied) !== stableWorkspaceSerialize(expected)) throw new Error("The selected research-tree proposal no longer matches the exact diff, current tree, workspace, mission contract, evidence, receipt, or mutation mode. Request a fresh proposal.");
}
function reevaluateResearchTree(root, args2 = {}) {
  assertSealedDomainArgs(args2, /* @__PURE__ */ new Set([...REEVALUATE_FIELDS, ...REPLAY_FIELDS]), "create_dove_mission reevaluate-research-tree");
  if (args2.confirmed !== true) {
    const replayOnly = Object.keys(args2).filter((field) => REPLAY_FIELDS.has(field) && field !== "mutationMode");
    if (replayOnly.length > 0) throw new Error(`reevaluate-research-tree proposal does not accept caller replay fields: ${replayOnly.map((field) => `$.${field}`).join(", ")}.`);
  }
  const proposal = withToken(buildProposal(root, args2));
  if (args2.confirmed !== true) {
    return {
      status: "needs-confirmation",
      operation: "reevaluate-research-tree",
      missionId: proposal.mission.missionId,
      requirement: proposal.input.requirement,
      hostMediation: "The host invokes reevaluation when a new user requirement or explicit direction is available; Dove does not schedule, poll, or continue research autonomously.",
      tree: proposal.tree,
      diff: proposal.diff,
      lessons: proposal.lessons,
      proposalDigest: proposal.proposalDigest,
      approval: {
        required: true,
        noChangesApplied: true,
        summary: `Dove can save the proposed research decision changes for: ${proposal.input.requirement}`,
        effects: [
          ...proposal.diff.addedNodes.length > 0 ? [`Add ${proposal.diff.addedNodes.length} research decision${proposal.diff.addedNodes.length === 1 ? "" : "s"}.`] : [],
          ...proposal.diff.completedNodes.length > 0 ? [`Mark ${proposal.diff.completedNodes.length} research decision${proposal.diff.completedNodes.length === 1 ? "" : "s"} completed.`] : [],
          ...proposal.diff.blockedNodes.length > 0 ? [`Mark ${proposal.diff.blockedNodes.length} research decision${proposal.diff.blockedNodes.length === 1 ? "" : "s"} blocked and preserve the resulting lesson${proposal.diff.blockedNodes.length === 1 ? "" : "s"}.`] : []
        ],
        question: "Save these research decision changes and continue the requested work?"
      },
      confirmation: {
        required: true,
        exactReplay: true,
        proposalVersion: RESEARCH_TREE_PROPOSAL_VERSION,
        proposalWorkspace: proposal.envelope.proposalWorkspace,
        proposalDigest: proposal.proposalDigest,
        proposalToken: proposal.proposalToken,
        mutationMode: proposal.mutationMode,
        confirmArgs: confirmArgsFor(proposal)
      },
      mutation: { mutationMode: proposal.mutationMode, writesApplied: false, paths: [] }
    };
  }
  assertExactReplay(root, proposal, args2);
  const writes = [{
    path: proposal.relativePath,
    kind: "data",
    content: domainJson(proposal.tree),
    derivedReferences: [`mission:${proposal.mission.missionId}`, `research-tree-revision:${proposal.tree.revision}`]
  }, ...proposal.lessons.map((lesson) => ({
    path: path11.posix.join(ARTIFACT_PATHS.lessonsDir, `${lesson.lessonId}.json`),
    kind: "data",
    content: domainJson(lesson),
    derivedReferences: [`research-tree:${proposal.mission.missionId}`, `research-node:${lesson.researchTreeOrigin.nodeId}`]
  }))];
  const recorded = finalizeDomainArtifacts(root, {
    actionId: "create-dove-mission",
    operation: "Research tree reevaluation",
    missionId: proposal.mission.missionId,
    receiptId: proposal.receiptId,
    summary: `Recorded research tree revision ${proposal.tree.revision} for mission ${proposal.mission.missionId}.`,
    allowResearchTreeArtifacts: true,
    writes
  });
  return {
    ...recorded,
    operation: "reevaluate-research-tree",
    requirement: proposal.input.requirement,
    hostMediation: "The host invokes reevaluation for new user requirements; this transaction does not start a daemon, scheduler, poller, or autonomous continuation.",
    tree: proposal.tree,
    diff: proposal.diff,
    lessons: proposal.lessons
  };
}
function researchTreeProjection(tree, detail = "compact") {
  if (!tree) return null;
  const statusCounts = Object.fromEntries(RESEARCH_TREE_NODE_STATUSES.map((status) => [status, tree.nodes.filter((node) => node.status === status).length]));
  const summary = { missionId: tree.missionId, revision: tree.revision, nodeCount: tree.nodes.length, statusCounts, updatedAt: tree.updatedAt };
  return detail === "full" ? { ...summary, nodes: tree.nodes } : summary;
}

// src/core/workspace-schema.mjs
var DOVE_MANIFEST_SCHEMA_VERSION = 1;
var DOVE_PROJECT_SCHEMA_VERSION = 1;
var DOVE_TRUST_SCHEMA_VERSION = 1;
var MINIMAL_WORKSPACE_DIRECTORIES = Object.freeze([
  ".dove/missions",
  ".dove/research-trees",
  ".dove/artifacts",
  ".dove/receipts",
  ".dove/receipts/execution",
  ".dove/receipts/completion",
  ".dove/receipts/authority",
  ".dove/sources",
  ".dove/notes",
  ".dove/claims",
  ".dove/experiments",
  ".dove/drafts",
  ".dove/figures",
  ".dove/reviews",
  ".dove/reviews/exchanges",
  ".dove/rebuttal",
  ".dove/versions"
]);
var MINIMAL_WORKSPACE_REQUIRED_FILES = Object.freeze([
  ".dove/manifest.json",
  ".dove/project.json"
]);
var CURRENT_SCHEMA_FORBIDDEN_LEGACY_PATHS = Object.freeze([
  ".dove/state.json",
  ".dove/task-packets",
  ".dove/orchestration",
  ".dove/runtime",
  ".dove/workspace",
  ".dove/mutations",
  ".dove/programs",
  ".dove/meta",
  ".dove/context",
  ".dove/wiki",
  ".dove/artifacts/ownership.json",
  ".dove/artifacts/lineage.json"
]);
var MANIFEST_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "manifestVersion", "workspaceId", "createdAt", "packageVersion"]);
var PROJECT_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "projectId", "goal", "trust", "createdAt", "updatedAt"]);
var TRUST_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "entries"]);
var LESSON_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "lessonId", "missionId", "contractDigest", "scope", "kind", "researchTreeOrigin", "summary", "details", "nextTimeGuidance", "sourceIds", "noteIds", "artifactRefs", "appliesToArtifactRefs", "tags", "supersedesLessonId", "createdAt"]);
var LESSON_RESEARCH_TREE_ORIGIN_FIELDS = /* @__PURE__ */ new Set(["nodeId", "treeRevision", "blockedReasonCode"]);
var LESSON_REF_FIELDS = /* @__PURE__ */ new Set(["path", "sha256"]);
var LESSON_SCOPES = /* @__PURE__ */ new Set(["global", "mission"]);
var LESSON_KINDS = /* @__PURE__ */ new Set(["preference", "constraint", "method", "failure", "review-insight"]);
var SAFE_ID3 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var HASH3 = /^[0-9a-f]{64}$/u;
var ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
function sha2563(value2) {
  return crypto5.createHash("sha256").update(value2).digest("hex");
}
function stableValue(value2) {
  if (Array.isArray(value2)) return value2.map(stableValue);
  if (value2 && typeof value2 === "object") {
    return Object.fromEntries(Object.entries(value2).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value2;
}
function stableWorkspaceSerialize(value2) {
  return JSON.stringify(stableValue(value2));
}
function workspaceDigest(value2) {
  return sha2563(stableWorkspaceSerialize(value2));
}
function canonicalWorkspacePath(root) {
  return fs10.realpathSync.native(path12.resolve(root));
}
function assertPlainObject4(value2, label) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) {
    throw new Error(`${label} must be a plain object.`);
  }
}
function assertSealed4(value2, fields, label) {
  assertPlainObject4(value2, label);
  const unknown = Object.keys(value2).filter((field) => !fields.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}
function exactIso3(value2, label) {
  if (typeof value2 !== "string" || !ISO_TIMESTAMP.test(value2) || !Number.isFinite(Date.parse(value2)) || new Date(Date.parse(value2)).toISOString() !== value2) {
    throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  }
  return value2;
}
function safeId2(value2, label) {
  if (typeof value2 !== "string" || !SAFE_ID3.test(value2)) {
    throw new Error(`${label} must be a safe lowercase identifier.`);
  }
  return value2;
}
function pathExistsNoFollow(fullPath) {
  try {
    fs10.lstatSync(fullPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
function readJsonStrict2(fullPath, label) {
  let text;
  try {
    text = fs10.readFileSync(fullPath, "utf8");
  } catch (error) {
    throw new Error(`${label} cannot be read: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Malformed durable JSON in ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function validateDoveManifest(value2) {
  assertSealed4(value2, MANIFEST_FIELDS, "Dove manifest");
  if (value2.schemaVersion !== DOVE_WORKSPACE_SCHEMA_VERSION) {
    throw new Error(`Dove manifest schemaVersion ${value2.schemaVersion ?? "missing"} is unsupported; expected ${DOVE_WORKSPACE_SCHEMA_VERSION}.`);
  }
  if (value2.manifestVersion !== DOVE_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Dove manifest manifestVersion ${value2.manifestVersion ?? "missing"} is unsupported.`);
  }
  safeId2(value2.workspaceId, "Dove manifest workspaceId");
  exactIso3(value2.createdAt, "Dove manifest createdAt");
  if (typeof value2.packageVersion !== "string" || !value2.packageVersion.trim()) {
    throw new Error("Dove manifest packageVersion must be a non-empty string.");
  }
  return value2;
}
function validateDoveTrustConfig(value2) {
  assertSealed4(value2, TRUST_FIELDS, "Dove project trust config");
  if (value2.schemaVersion !== DOVE_TRUST_SCHEMA_VERSION) {
    throw new Error(`Dove project trust schemaVersion ${value2.schemaVersion ?? "missing"} is unsupported.`);
  }
  if (!Array.isArray(value2.entries) || value2.entries.length !== 0) {
    throw new Error("Dove project trust entries must be an empty sealed array until a trust schema is explicitly introduced.");
  }
  return value2;
}
function validateDoveProject(value2, manifest) {
  assertSealed4(value2, PROJECT_FIELDS, "Dove project identity");
  if (value2.schemaVersion !== DOVE_PROJECT_SCHEMA_VERSION) {
    throw new Error(`Dove project schemaVersion ${value2.schemaVersion ?? "missing"} is unsupported.`);
  }
  safeId2(value2.workspaceId, "Dove project workspaceId");
  safeId2(value2.projectId, "Dove project projectId");
  if (value2.workspaceId !== manifest.workspaceId) {
    throw new Error("Dove project workspaceId does not match the manifest workspaceId.");
  }
  if (value2.projectId !== `project-${manifest.workspaceId}`) {
    throw new Error("Dove project projectId does not match the manifest identity.");
  }
  if (typeof value2.goal !== "string" || !value2.goal.trim()) {
    throw new Error("Dove project goal must be a non-empty string.");
  }
  exactIso3(value2.createdAt, "Dove project createdAt");
  exactIso3(value2.updatedAt, "Dove project updatedAt");
  if (value2.createdAt !== manifest.createdAt) {
    throw new Error("Dove project createdAt must match the manifest createdAt.");
  }
  validateDoveTrustConfig(value2.trust);
  return value2;
}
function hash2(value2, label) {
  if (typeof value2 !== "string" || !HASH3.test(value2)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return value2;
}
function nonEmptyString(value2, label) {
  if (typeof value2 !== "string" || !value2.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value2;
}
function stringArray(value2, label) {
  if (!Array.isArray(value2) || value2.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  if (new Set(value2).size !== value2.length) throw new Error(`${label} must not contain duplicates.`);
  return value2;
}
function validateMissionShape(value2, manifest, label) {
  return validatePersistedMission(value2, {
    label,
    workspaceId: manifest.workspaceId,
    filename: path12.posix.basename(label)
  });
}
function validateLessonReferenceArray(value2, label) {
  if (!Array.isArray(value2)) throw new Error(`${label} must be an array.`);
  const seen = /* @__PURE__ */ new Set();
  for (const [index, item] of value2.entries()) {
    const itemLabel = `${label}[${index}]`;
    assertSealed4(item, LESSON_REF_FIELDS, itemLabel);
    nonEmptyString(item.path, `${itemLabel}.path`);
    hash2(item.sha256, `${itemLabel}.sha256`);
    if (seen.has(item.path)) throw new Error(`${label} contains duplicate path ${item.path}.`);
    seen.add(item.path);
  }
  return value2;
}
function validateLessonShape(value2, manifest, label, context = {}) {
  assertSealed4(value2, LESSON_FIELDS, label);
  if (value2.schemaVersion !== 2) throw new Error(`${label} has an unsupported schemaVersion.`);
  safeId2(value2.workspaceId, `${label}.workspaceId`);
  if (value2.workspaceId !== manifest.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  const lessonId = safeId2(value2.lessonId, `${label}.lessonId`);
  const expectedFilename = `${lessonId}.json`;
  if (path12.posix.basename(label) !== expectedFilename) throw new Error(`${label} filename must match lessonId ${lessonId}.`);
  const missionId = safeId2(value2.missionId, `${label}.missionId`);
  hash2(value2.contractDigest, `${label}.contractDigest`);
  if (!LESSON_SCOPES.has(value2.scope)) throw new Error(`${label}.scope must be global or mission.`);
  if (!LESSON_KINDS.has(value2.kind)) throw new Error(`${label}.kind is unsupported.`);
  if (value2.researchTreeOrigin !== void 0) {
    if (value2.kind !== "failure" || value2.scope !== "mission") throw new Error(`${label} researchTreeOrigin is allowed only on mission-scoped failure lessons.`);
    assertSealed4(value2.researchTreeOrigin, LESSON_RESEARCH_TREE_ORIGIN_FIELDS, `${label}.researchTreeOrigin`);
    safeId2(value2.researchTreeOrigin.nodeId, `${label}.researchTreeOrigin.nodeId`);
    safeId2(value2.researchTreeOrigin.blockedReasonCode, `${label}.researchTreeOrigin.blockedReasonCode`);
    if (!Number.isSafeInteger(value2.researchTreeOrigin.treeRevision) || value2.researchTreeOrigin.treeRevision < 1) throw new Error(`${label}.researchTreeOrigin.treeRevision must be a positive safe integer.`);
  }
  nonEmptyString(value2.summary, `${label}.summary`);
  if (value2.details !== void 0) nonEmptyString(value2.details, `${label}.details`);
  stringArray(value2.nextTimeGuidance, `${label}.nextTimeGuidance`);
  if (value2.nextTimeGuidance.length === 0) throw new Error(`${label}.nextTimeGuidance must contain at least one item.`);
  stringArray(value2.sourceIds, `${label}.sourceIds`);
  stringArray(value2.noteIds, `${label}.noteIds`);
  validateLessonReferenceArray(value2.artifactRefs, `${label}.artifactRefs`);
  validateLessonReferenceArray(value2.appliesToArtifactRefs, `${label}.appliesToArtifactRefs`);
  stringArray(value2.tags, `${label}.tags`);
  if (value2.supersedesLessonId !== void 0) {
    safeId2(value2.supersedesLessonId, `${label}.supersedesLessonId`);
    if (value2.supersedesLessonId === lessonId) throw new Error(`${label} must not supersede itself.`);
  }
  exactIso3(value2.createdAt, `${label}.createdAt`);
  const mission = context.missions?.get(missionId);
  if (!mission) throw new Error(`${label} references unknown mission ${missionId}.`);
  if (mission.contractDigest !== value2.contractDigest) throw new Error(`${label}.contractDigest does not match mission ${missionId}.`);
  return value2;
}
function validateLessonSupersession(lessons) {
  const successorByLesson = /* @__PURE__ */ new Map();
  for (const lesson of lessons.values()) {
    if (!lesson.supersedesLessonId) continue;
    const previous = lessons.get(lesson.supersedesLessonId);
    if (!previous) throw new Error(`Lesson ${lesson.lessonId} supersedes unknown lesson ${lesson.supersedesLessonId}.`);
    if (previous.scope !== lesson.scope || previous.kind !== lesson.kind) throw new Error(`Lesson ${lesson.lessonId} must supersede a lesson with the same scope and kind.`);
    if (lesson.scope === "mission" && previous.missionId !== lesson.missionId) throw new Error(`Mission-scoped lesson ${lesson.lessonId} must supersede a lesson from the same mission.`);
    if (successorByLesson.has(previous.lessonId)) throw new Error(`Lesson supersession forks at ${previous.lessonId}.`);
    successorByLesson.set(previous.lessonId, lesson.lessonId);
  }
  for (const lessonId of lessons.keys()) {
    const seen = /* @__PURE__ */ new Set();
    let current = lessonId;
    while (current) {
      if (seen.has(current)) throw new Error(`Lesson supersession contains a cycle at ${current}.`);
      seen.add(current);
      current = lessons.get(current)?.supersedesLessonId ?? null;
    }
  }
}
function validateJsonDirectory(root, relativeDirectory, manifest, validate, context = {}) {
  const directory = path12.join(root, relativeDirectory);
  const values = [];
  for (const entry of fs10.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isSymbolicLink()) throw new Error(`${path12.posix.join(relativeDirectory, entry.name)} must not be a symbolic link.`);
    if (!entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${path12.posix.join(relativeDirectory, entry.name)} must be a regular JSON file.`);
    const relativePath = path12.posix.join(relativeDirectory, entry.name);
    values.push(validate(readJsonStrict2(path12.join(root, relativePath), relativePath), manifest, relativePath, context));
  }
  return values;
}
function requiredPathProblem(root, relativePath, kind) {
  const fullPath = path12.join(root, relativePath);
  if (!fs10.existsSync(fullPath)) return `${relativePath} is missing`;
  const stat = fs10.lstatSync(fullPath);
  if (stat.isSymbolicLink()) return `${relativePath} must not be a symbolic link`;
  if (kind === "directory" && !stat.isDirectory()) return `${relativePath} must be a directory`;
  if (kind === "file" && !stat.isFile()) return `${relativePath} must be a regular file`;
  return null;
}
function sourceIdentity(doveRoot) {
  const stat = fs10.lstatSync(doveRoot, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(".dove must be a real directory; symbolic-link workspace roots are not accepted.");
  }
  return {
    kind: "directory",
    device: String(stat.dev),
    inode: String(stat.ino),
    mode: Number(stat.mode),
    ctimeNs: String(stat.ctimeNs),
    mtimeNs: String(stat.mtimeNs)
  };
}
function treeEntries(doveRoot) {
  const entries = [];
  const visit = (directory, prefix = "") => {
    for (const entry of fs10.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = prefix ? path12.posix.join(prefix, entry.name) : entry.name;
      const fullPath = path12.join(directory, entry.name);
      const stat = fs10.lstatSync(fullPath, { bigint: true });
      const metadata = {
        path: relativePath,
        device: String(stat.dev),
        inode: String(stat.ino),
        mode: Number(stat.mode),
        ctimeNs: String(stat.ctimeNs),
        mtimeNs: String(stat.mtimeNs)
      };
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        entries.push({ ...metadata, kind: "directory" });
        visit(fullPath, relativePath);
      } else if (stat.isFile()) {
        entries.push({ ...metadata, kind: "file", sizeBytes: String(stat.size), sha256: sha2563(fs10.readFileSync(fullPath)) });
      } else if (stat.isSymbolicLink()) {
        entries.push({ ...metadata, kind: "symlink", target: fs10.readlinkSync(fullPath) });
      } else {
        throw new Error(`Unsupported filesystem entry inside .dove: ${relativePath}.`);
      }
    }
  };
  visit(doveRoot);
  return entries;
}
function inspectDoveSourceTree(root) {
  const workspace = canonicalWorkspacePath(root);
  const doveRoot = path12.join(workspace, ".dove");
  if (!pathExistsNoFollow(doveRoot)) return null;
  const identity = sourceIdentity(doveRoot);
  const entries = treeEntries(doveRoot);
  return {
    identity,
    entryCount: entries.length,
    treeDigest: workspaceDigest(entries)
  };
}
function detectedVersionLabel(value2) {
  if (Number.isInteger(value2)) return String(value2);
  if (value2 === void 0) return "missing";
  return "invalid";
}
function inspectDoveWorkspace(root) {
  const workspace = canonicalWorkspacePath(root);
  const doveRoot = path12.join(workspace, ".dove");
  if (!pathExistsNoFollow(doveRoot)) {
    return { workspace, state: "absent", category: "absent", healthy: false, schemaVersion: null, detectedSchema: "absent" };
  }
  let source;
  try {
    source = { identity: sourceIdentity(doveRoot) };
  } catch (error) {
    return { workspace, state: "invalid-root", category: "invalid", healthy: false, schemaVersion: null, detectedSchema: "invalid-root", error: error instanceof Error ? error.message : String(error) };
  }
  const manifestPath = path12.join(doveRoot, "manifest.json");
  if (!fs10.existsSync(manifestPath)) {
    return { workspace, state: "legacy-missing-manifest", category: "legacy", healthy: false, schemaVersion: null, detectedSchema: "missing-manifest", source };
  }
  let manifest;
  try {
    manifest = readJsonStrict2(manifestPath, ".dove/manifest.json");
  } catch (error) {
    return { workspace, state: "malformed-manifest", category: "invalid", healthy: false, schemaVersion: null, detectedSchema: "malformed", source, error: error instanceof Error ? error.message : String(error) };
  }
  const version = manifest?.schemaVersion;
  const retainedLegacyAuthorityManifest = version === void 0 && Number.isInteger(manifest?.version);
  if (retainedLegacyAuthorityManifest) {
    return { workspace, state: "legacy-authority-manifest", category: "legacy", healthy: false, schemaVersion: manifest.version, detectedSchema: `legacy-authority-${manifest.version}`, source, manifest };
  }
  if (!Number.isInteger(version)) {
    return { workspace, state: "invalid-manifest-version", category: "invalid", healthy: false, schemaVersion: null, detectedSchema: detectedVersionLabel(version), source, manifest };
  }
  if (version < DOVE_WORKSPACE_SCHEMA_VERSION) {
    return { workspace, state: "legacy-version", category: "legacy", healthy: false, schemaVersion: version, detectedSchema: String(version), source, manifest };
  }
  if (version > DOVE_WORKSPACE_SCHEMA_VERSION) {
    return { workspace, state: "future-version", category: "future", healthy: false, schemaVersion: version, detectedSchema: String(version), source, manifest };
  }
  try {
    validateDoveManifest(manifest);
    const problems = [
      ...MINIMAL_WORKSPACE_DIRECTORIES.map((relativePath) => requiredPathProblem(workspace, relativePath, "directory")),
      ...MINIMAL_WORKSPACE_REQUIRED_FILES.map((relativePath) => requiredPathProblem(workspace, relativePath, "file")),
      ...CURRENT_SCHEMA_FORBIDDEN_LEGACY_PATHS.filter((relativePath) => fs10.existsSync(path12.join(workspace, relativePath))).map((relativePath) => `${relativePath} is a retained legacy artifact and must not coexist with current schema ${DOVE_WORKSPACE_SCHEMA_VERSION}`)
    ].filter(Boolean);
    if (problems.length > 0) throw new Error(`Dove schema declaration contradicts required layout: ${problems.join("; ")}.`);
    const project = validateDoveProject(readJsonStrict2(path12.join(doveRoot, "project.json"), ".dove/project.json"), manifest);
    const missionValues = validateJsonDirectory(workspace, ".dove/missions", manifest, validateMissionShape);
    const missionGraph = validateMissionGraph(missionValues.map((mission) => ({ filename: `${mission.missionId}.json`, mission })));
    const missions = missionGraph.missions;
    const researchTreeValues = validateJsonDirectory(workspace, ".dove/research-trees", manifest, (value2, _manifest, label) => {
      const missionId = path12.posix.basename(label, ".json");
      const mission = missions.get(missionId);
      if (!mission) throw new Error(`${label} references unknown mission ${missionId}.`);
      return validateResearchTree(value2, { label, workspaceId: manifest.workspaceId, missionId, contractDigest: mission.contractDigest });
    });
    const researchTrees = new Map(researchTreeValues.map((tree) => [tree.missionId, tree]));
    const receiptLedger = readExecutionReceiptLedger(workspace, { manifest, missions, missionGraph });
    const lessonsDirectory = path12.join(workspace, ".dove/lessons");
    if (pathExistsNoFollow(lessonsDirectory)) {
      const stat = fs10.lstatSync(lessonsDirectory);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(".dove/lessons must be a real directory when present.");
      const lessons = new Map(validateJsonDirectory(workspace, ".dove/lessons", manifest, validateLessonShape, { missions }).map((lesson) => [lesson.lessonId, lesson]));
      validateLessonSupersession(lessons);
    }
    for (const relativeDirectory of [".dove/receipts/completion", ".dove/receipts/authority"]) {
      const entries = fs10.readdirSync(path12.join(workspace, relativeDirectory));
      if (entries.length > 0) {
        throw new Error(`${relativeDirectory} must remain empty until its sealed schema is introduced.`);
      }
    }
    return {
      workspace,
      state: "current-healthy",
      category: "current",
      healthy: true,
      schemaVersion: version,
      detectedSchema: String(version),
      source,
      manifest,
      project,
      missions,
      missionGraph,
      researchTrees,
      receiptLedger
    };
  } catch (error) {
    return { workspace, state: "current-unhealthy", category: "invalid", healthy: false, schemaVersion: version, detectedSchema: String(version), source, manifest, error: error instanceof Error ? error.message : String(error) };
  }
}
function workspaceSchemaError(inspection, operation = "Dove operation") {
  if (inspection.state === "absent") {
    return new Error(`${operation} requires a current Dove workspace. Run confirmed dove init first.`);
  }
  if (inspection.category === "legacy") {
    return new Error(`${operation} cannot open legacy Dove schema state (${inspection.state}, detected ${inspection.detectedSchema}). Run dove init --archive-reset and confirm the exact proposal.`);
  }
  if (inspection.category === "future") {
    return new Error(`${operation} refuses future Dove schema ${inspection.detectedSchema}; install a compatible Dove version. No files were changed.`);
  }
  return new Error(`${operation} refuses invalid Dove workspace state ${inspection.state}${inspection.error ? `: ${inspection.error}` : ""}. Run dove init --archive-reset and confirm the exact proposal. No files were changed.`);
}
function openDoveWorkspace(root, options = {}) {
  const inspection = inspectDoveWorkspace(root);
  if (inspection.healthy) return inspection;
  if (inspection.state === "absent" && options.allowAbsent === true) return inspection;
  throw workspaceSchemaError(inspection, options.operation);
}
function createMinimalWorkspaceDocuments({ workspaceId, goal, createdAt }) {
  safeId2(workspaceId, "workspaceId");
  exactIso3(createdAt, "createdAt");
  if (typeof goal !== "string" || !goal.trim()) throw new Error("Dove init requires a non-empty goal.");
  const manifest = {
    schemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION,
    manifestVersion: DOVE_MANIFEST_SCHEMA_VERSION,
    workspaceId,
    createdAt,
    packageVersion: PACKAGE_VERSION
  };
  const project = {
    schemaVersion: DOVE_PROJECT_SCHEMA_VERSION,
    workspaceId,
    projectId: `project-${workspaceId}`,
    goal: goal.trim(),
    trust: { schemaVersion: DOVE_TRUST_SCHEMA_VERSION, entries: [] },
    createdAt,
    updatedAt: createdAt
  };
  return { manifest, project };
}
function newWorkspaceId() {
  return `workspace-${crypto5.randomUUID()}`;
}
function archiveTargetFor({ workspace, detectedSchema, treeDigest }) {
  const schemaLabel = String(detectedSchema ?? "invalid").replace(/[^a-z0-9._-]+/giu, "-").toLowerCase();
  return path12.join(workspace, ".dove-archive", `schema-${schemaLabel}-${String(treeDigest).slice(0, 24)}`);
}

// src/core/artifact-lineage.mjs
function readArtifactLedger(root) {
  const workspace = openDoveWorkspace(root, { operation: "Artifact receipt ledger read" });
  return workspace.receiptLedger;
}
function readArtifactOwnership(root) {
  const ledger = readArtifactLedger(root);
  return {
    schemaVersion: ledger.schemaVersion,
    workspaceId: ledger.workspaceId,
    artifacts: ledger.currentOwnership,
    updatedAt: ledger.updatedAt
  };
}

// src/core/mission-contracts.mjs
import crypto6 from "node:crypto";
import fs12 from "node:fs";
import path14 from "node:path";

// src/core/workspace-init.mjs
import fs11 from "node:fs";
import path13 from "node:path";
var DOVE_INIT_PROPOSAL_VERSION = 1;
var INIT_FIELDS = /* @__PURE__ */ new Set([
  "goal",
  "archiveReset",
  "confirmed",
  "proposalVersion",
  "proposalWorkspace",
  "proposalDigest",
  "mutationMode",
  "workspaceId",
  "createdAt",
  "detectedState",
  "detectedSchema",
  "sourceIdentity",
  "sourceTreeDigest",
  "archiveTarget"
]);
function assertPlainObject5(value2, label) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) throw new Error(`${label} must be a plain object.`);
}
function assertAllowed(args2) {
  assertPlainObject5(args2, "dove init arguments");
  const unknown = Object.keys(args2).filter((field) => !INIT_FIELDS.has(field));
  if (unknown.length > 0) throw new Error(`dove init does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function goalFrom(args2) {
  const goal = typeof args2.goal === "string" ? args2.goal.trim() : "";
  if (!goal) throw new Error("Dove init requires a non-empty goal.");
  return goal;
}
function mutationModeFor2(root, args2) {
  const explicit = Object.hasOwn(args2, "mutationMode") ? normalizeMutationMode(args2.mutationMode) : null;
  const active = currentMutationContext(root)?.mutationMode ?? null;
  if (explicit && active && explicit !== active) throw new Error(`Dove init mutationMode ${explicit} does not match the active MutationContext mode ${active}.`);
  return active ?? explicit ?? "direct-process";
}
function optionalReplayString(value2, label) {
  if (value2 === null || value2 === void 0) return null;
  if (typeof value2 !== "string" || !value2) throw new Error(`${label} must be a non-empty string or null.`);
  return value2;
}
function exactReplayInput(args2) {
  return {
    goal: goalFrom(args2),
    archiveReset: args2.archiveReset === true,
    confirmed: true,
    proposalVersion: args2.proposalVersion,
    proposalWorkspace: optionalReplayString(args2.proposalWorkspace, "proposalWorkspace"),
    proposalDigest: optionalReplayString(args2.proposalDigest, "proposalDigest"),
    mutationMode: Object.hasOwn(args2, "mutationMode") ? normalizeMutationMode(args2.mutationMode) : "direct-process",
    workspaceId: optionalReplayString(args2.workspaceId, "workspaceId"),
    createdAt: optionalReplayString(args2.createdAt, "createdAt"),
    detectedState: optionalReplayString(args2.detectedState, "detectedState"),
    detectedSchema: optionalReplayString(args2.detectedSchema, "detectedSchema"),
    sourceIdentity: args2.sourceIdentity ?? null,
    sourceTreeDigest: optionalReplayString(args2.sourceTreeDigest, "sourceTreeDigest"),
    archiveTarget: optionalReplayString(args2.archiveTarget, "archiveTarget")
  };
}
function proposalEnvelope({ workspace, mutationMode: mutationMode2, workspaceId, createdAt, goal, inspection, archiveReset, archiveTarget }) {
  return {
    proposalVersion: DOVE_INIT_PROPOSAL_VERSION,
    workspace,
    mutationMode: mutationMode2,
    workspaceId,
    createdAt,
    goal,
    archiveReset,
    detectedState: inspection.state,
    detectedSchema: inspection.detectedSchema,
    sourceIdentity: inspection.source?.identity ?? null,
    sourceTreeDigest: inspection.source?.treeDigest ?? null,
    archiveTarget: archiveTarget ?? null,
    newSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION
  };
}
function assertArchiveTargetSafe(workspace, archiveTarget) {
  const archiveParent = path13.join(workspace, ".dove-archive");
  if (path13.dirname(archiveTarget) !== archiveParent) {
    throw new Error("Dove archive target must be the deterministic workspace-local .dove-archive target.");
  }
  if (!fs11.existsSync(archiveParent)) return;
  const parentStat = fs11.lstatSync(archiveParent);
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
    throw new Error("Dove archive parent .dove-archive must be a real workspace-local directory, not a symbolic link or file.");
  }
}
function proposalOperations(envelope) {
  const initialize = [
    ...MINIMAL_WORKSPACE_DIRECTORIES.map((relativePath) => ({ type: "create-directory", path: relativePath })),
    ...MINIMAL_WORKSPACE_REQUIRED_FILES.map((relativePath) => ({ type: "write-sealed-json", path: relativePath }))
  ];
  return envelope.archiveReset ? [
    { type: "atomic-directory-rename", from: ".dove", to: path13.relative(envelope.workspace, envelope.archiveTarget).split(path13.sep).join("/") },
    ...initialize
  ] : initialize;
}
function confirmArgs(envelope, proposalDigest) {
  return {
    goal: envelope.goal,
    archiveReset: envelope.archiveReset,
    confirmed: true,
    proposalVersion: envelope.proposalVersion,
    proposalWorkspace: envelope.workspace,
    proposalDigest,
    mutationMode: envelope.mutationMode,
    workspaceId: envelope.workspaceId,
    createdAt: envelope.createdAt,
    detectedState: envelope.detectedState,
    detectedSchema: envelope.detectedSchema,
    sourceIdentity: envelope.sourceIdentity,
    sourceTreeDigest: envelope.sourceTreeDigest,
    archiveTarget: envelope.archiveTarget
  };
}
function buildProposal2(root, args2 = {}) {
  const workspace = canonicalWorkspacePath(root);
  const replay = args2.confirmed === true ? exactReplayInput(args2) : null;
  if (replay && replay.proposalVersion !== DOVE_INIT_PROPOSAL_VERSION) {
    throw new Error("The selected Dove init proposal version is unsupported. Request a fresh proposal.");
  }
  if (replay && replay.proposalWorkspace !== workspace) {
    throw new Error("The selected Dove init proposal belongs to a different canonical workspace. Request a fresh proposal.");
  }
  const inspection = inspectDoveWorkspace(workspace);
  const archiveReset = args2.archiveReset === true;
  if (archiveReset && inspection.state !== "absent") {
    inspection.source = inspectDoveSourceTree(workspace);
  }
  if (archiveReset) {
    if (inspection.state === "absent" || inspection.healthy) {
      throw new Error("dove init --archive-reset applies only when an existing legacy or invalid .dove directory requires explicit replacement.");
    }
  } else if (inspection.state !== "absent") {
    if (inspection.healthy) throw new Error("Dove workspace is already initialized with the current schema.");
    throw workspaceSchemaError(inspection, "dove init");
  }
  const goal = goalFrom(args2);
  const mutationMode2 = mutationModeFor2(workspace, args2);
  if (archiveReset && mutationMode2 === "patch-plan") {
    throw new Error("dove init --archive-reset cannot run in patch-plan mode because a patch plan cannot express the required atomic directory rename and rollback semantics. Use direct-process and an exact confirmation replay.");
  }
  const workspaceId = replay?.workspaceId ?? (typeof args2.workspaceId === "string" && args2.workspaceId ? args2.workspaceId : newWorkspaceId());
  const createdAt = replay?.createdAt ?? (typeof args2.createdAt === "string" && args2.createdAt ? args2.createdAt : (/* @__PURE__ */ new Date()).toISOString());
  const archiveTarget = archiveReset ? archiveTargetFor({ workspace, detectedSchema: inspection.detectedSchema, treeDigest: inspection.source.treeDigest }) : null;
  if (archiveReset) assertArchiveTargetSafe(workspace, archiveTarget);
  const envelope = proposalEnvelope({ workspace, mutationMode: mutationMode2, workspaceId, createdAt, goal, inspection, archiveReset, archiveTarget });
  const proposalDigest = workspaceDigest(envelope);
  return { envelope, proposalDigest, inspection, documents: createMinimalWorkspaceDocuments({ workspaceId, goal, createdAt }) };
}
function mutationMetadata(proposal, writesApplied) {
  return {
    mutationMode: proposal.envelope.mutationMode,
    writesApplied,
    paths: writesApplied ? [
      ...proposal.envelope.archiveReset ? [".dove", path13.relative(proposal.envelope.workspace, proposal.envelope.archiveTarget).split(path13.sep).join("/")] : [],
      ...MINIMAL_WORKSPACE_REQUIRED_FILES
    ] : []
  };
}
function proposalResult(proposal) {
  const args2 = confirmArgs(proposal.envelope, proposal.proposalDigest);
  return {
    status: "needs-confirmation",
    kind: proposal.envelope.archiveReset ? "archive-reset" : "init",
    workspace: proposal.envelope.workspace,
    detectedSchemaState: {
      state: proposal.envelope.detectedState,
      detectedSchema: proposal.envelope.detectedSchema
    },
    source: proposal.envelope.archiveReset ? {
      path: ".dove",
      identity: proposal.envelope.sourceIdentity,
      treeDigest: proposal.envelope.sourceTreeDigest
    } : null,
    archiveTarget: proposal.envelope.archiveTarget,
    newSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION,
    operations: proposalOperations(proposal.envelope),
    proposalDigest: proposal.proposalDigest,
    approval: {
      required: true,
      noChangesApplied: true,
      summary: proposal.envelope.archiveReset ? "Dove can replace the invalid project records and save the current project goal." : "Dove can create minimal project records and save the current project goal.",
      effects: proposal.envelope.archiveReset ? ["Archive the invalid Dove project records.", "Create clean minimal project records.", "Save the current project goal."] : ["Create minimal Dove project records.", "Save the current project goal."],
      question: proposal.envelope.archiveReset ? "Replace the invalid Dove project records and initialize this project?" : "Create Dove project records for this project?"
    },
    confirmation: {
      required: true,
      exactReplay: true,
      proposalVersion: DOVE_INIT_PROPOSAL_VERSION,
      proposalWorkspace: proposal.envelope.workspace,
      proposalDigest: proposal.proposalDigest,
      mutationMode: proposal.envelope.mutationMode,
      confirmArgs: args2,
      proposalToken: Buffer.from(JSON.stringify({ version: DOVE_INIT_PROPOSAL_VERSION, confirmArgs: args2 }), "utf8").toString("base64url")
    },
    mutation: mutationMetadata(proposal, false)
  };
}
function assertExactReplay2(proposal, args2) {
  if (args2.confirmed !== true) return;
  const replay = exactReplayInput(args2);
  const expectedArgs = confirmArgs(proposal.envelope, proposal.proposalDigest);
  if (stableWorkspaceSerialize(replay) !== stableWorkspaceSerialize(expectedArgs)) {
    throw new Error("The selected Dove init proposal no longer matches the approved proposal replay fields exactly. Request a fresh proposal.");
  }
  if (replay.proposalDigest !== proposal.proposalDigest) throw new Error("The selected Dove init proposal no longer matches the exact workspace, source tree, archive target, goal, schema version, or mutation mode. Request a fresh proposal.");
  if (proposal.envelope.archiveReset) {
    const archiveTarget = proposal.envelope.archiveTarget;
    if (fs11.existsSync(archiveTarget)) throw new Error(`Archive target is already occupied: ${archiveTarget}. Request a fresh proposal.`);
    const source = inspectDoveSourceTree(proposal.envelope.workspace);
    if (!source || stableWorkspaceSerialize(source.identity) !== stableWorkspaceSerialize(proposal.envelope.sourceIdentity) || source.treeDigest !== proposal.envelope.sourceTreeDigest) {
      throw new Error("The .dove source identity or tree digest changed after proposal. Request a fresh archive-reset proposal.");
    }
  }
}
function stageDoveInitialization(context, proposal) {
  if (proposal.envelope.archiveReset) {
    context.replaceDirectory(".dove", {
      archiveTarget: path13.relative(proposal.envelope.workspace, proposal.envelope.archiveTarget).split(path13.sep).join("/")
    });
  } else {
    context.replaceDirectory(".dove");
  }
  for (const relativePath of MINIMAL_WORKSPACE_DIRECTORIES) context.ensureDirectory(relativePath);
  context.writeJson(".dove/manifest.json", proposal.documents.manifest);
  context.writeJson(".dove/project.json", proposal.documents.project);
}
function initDoveWorkspace(root, args2 = {}, options = {}) {
  assertAllowed(args2);
  const proposal = buildProposal2(root, args2);
  if (args2.confirmed !== true) return proposalResult(proposal);
  assertExactReplay2(proposal, args2);
  if (!currentMutationContext(root)) throw new Error("Confirmed Dove init requires an active MutationContext.");
  if (proposal.envelope.archiveReset && proposal.envelope.mutationMode === "patch-plan") {
    throw new Error("Confirmed Dove archive-reset cannot claim patch-plan writes: the required atomic directory rename and rollback are direct-process only.");
  }
  const context = currentMutationContext(root);
  if (proposal.envelope.mutationMode === "patch-plan") {
    for (const relativePath of MINIMAL_WORKSPACE_DIRECTORIES) context.ensureDirectory(relativePath);
    context.writeJson(".dove/manifest.json", proposal.documents.manifest);
    context.writeJson(".dove/project.json", proposal.documents.project);
    return {
      status: "initialization-planned",
      kind: "init",
      manifest: proposal.documents.manifest,
      project: proposal.documents.project,
      archiveTarget: null,
      mutation: mutationMetadata(proposal, false),
      writes: []
    };
  }
  stageDoveInitialization(context, proposal);
  return {
    status: proposal.envelope.archiveReset ? "archive-reset-complete" : "initialized",
    kind: proposal.envelope.archiveReset ? "archive-reset" : "init",
    manifest: proposal.documents.manifest,
    project: proposal.documents.project,
    archiveTarget: proposal.envelope.archiveTarget,
    mutation: mutationMetadata(proposal, true),
    writes: MINIMAL_WORKSPACE_REQUIRED_FILES
  };
}

// src/core/mission-contracts.mjs
var MISSION_PROPOSAL_VERSION = 1;
var MISSION_REPLAY_CONTROL_FIELDS = /* @__PURE__ */ new Set([
  "confirmed",
  "proposalVersion",
  "proposalWorkspace",
  "proposalDigest",
  "mutationMode",
  "workspaceId",
  "createdAt"
]);
var INIT_INPUT_FIELDS = /* @__PURE__ */ new Set(["goal", "archiveReset", "confirmed", "proposalVersion", "proposalWorkspace", "proposalDigest", "mutationMode", "workspaceId", "createdAt", "detectedState", "detectedSchema", "sourceIdentity", "sourceTreeDigest", "archiveTarget"]);
function sha2564(value2) {
  return crypto6.createHash("sha256").update(value2).digest("hex");
}
function normalizeString2(value2, fallback = null) {
  if (typeof value2 !== "string") {
    return fallback;
  }
  const normalized = value2.trim();
  return normalized || fallback;
}
function assertPlainObject6(value2, label) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) {
    throw new Error(`${label} must be a plain object.`);
  }
}
function assertAllowedFields(args2, allowed, label) {
  assertPlainObject6(args2, `${label} arguments`);
  const unknown = Object.keys(args2).filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}
function canonicalWorkspace(root) {
  return fs12.realpathSync.native(path14.resolve(root));
}
function slugify(value2) {
  return String(value2 ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "mission";
}
function normalizeMissionId(value2, goal) {
  const fallback = `mission-${slugify(goal)}-${sha2564(goal).slice(0, 10)}`;
  const missionId = normalizeString2(value2, fallback);
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(missionId)) {
    throw new Error("missionId must start with a lowercase letter or digit and contain only lowercase letters, digits, dot, underscore, or hyphen.");
  }
  return missionId;
}
function missionContractContent(args2 = {}) {
  return normalizeMissionContractContent(args2);
}
var assertCurrentMissionContract2 = assertCurrentMissionContract;
function missionPath(missionId) {
  return path14.posix.join(ARTIFACT_PATHS.missionsDir, `${missionId}.json`);
}
function fileExists(root, relativePath) {
  const context = currentMutationContext(root);
  return context ? context.fileExists(relativePath) : fs12.existsSync(path14.join(root, relativePath));
}
function projectIdentitySnapshot(root, workspace, args2 = {}, mutationMode2 = "direct-process") {
  const inspection = inspectDoveWorkspace(root);
  if (inspection.healthy) {
    return {
      required: false,
      workspaceBootstrapRequired: false,
      identityDigest: workspaceDigest(inspection.project),
      identity: inspection.project,
      manifest: inspection.manifest,
      workspaceId: inspection.manifest.workspaceId,
      createdAt: inspection.manifest.createdAt,
      documents: null
    };
  }
  if (inspection.state !== "absent") {
    throw workspaceSchemaError(inspection, "Dove mission");
  }
  const goal = normalizeString2(args2.goal, null);
  const workspaceId = normalizeString2(args2.workspaceId, null) ?? newWorkspaceId();
  const createdAt = normalizeString2(args2.createdAt, null) ?? nowIso();
  const documents = createMinimalWorkspaceDocuments({ workspaceId, goal, createdAt });
  const initProposal = initDoveWorkspace(root, {
    goal,
    mutationMode: mutationMode2,
    workspaceId,
    createdAt
  });
  return {
    required: true,
    workspaceBootstrapRequired: true,
    identityDigest: workspaceDigest({ manifest: documents.manifest, project: documents.project }),
    identity: documents.project,
    manifest: documents.manifest,
    workspaceId,
    createdAt,
    documents,
    initConfirmArgs: initProposal.confirmation.confirmArgs
  };
}
function fileArtifactIdentity(relativePath, fullPath, stat) {
  return {
    path: relativePath,
    exists: true,
    kind: "file",
    mode: Number(stat.mode),
    sizeBytes: String(stat.size),
    ctimeNs: String(stat.ctimeNs),
    mtimeNs: String(stat.mtimeNs),
    sha256: sha2564(fs12.readFileSync(fullPath))
  };
}
function directoryArtifactIdentity(relativePath, fullPath) {
  const entries = [];
  const visit = (directoryPath, directoryRelativePath) => {
    for (const entry of fs12.readdirSync(directoryPath, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = path14.join(directoryPath, entry.name);
      const entryRelativePath = path14.posix.join(directoryRelativePath, entry.name);
      const stat = fs12.lstatSync(entryPath, { bigint: true });
      const metadata = { path: entryRelativePath, mode: Number(stat.mode), ctimeNs: String(stat.ctimeNs), mtimeNs: String(stat.mtimeNs) };
      if (stat.isSymbolicLink()) {
        throw new Error(`Mission target artifact directories must not contain symbolic links: ${path14.posix.join(relativePath, entryRelativePath)}.`);
      } else if (stat.isDirectory()) {
        entries.push({ ...metadata, kind: "directory" });
        visit(entryPath, entryRelativePath);
      } else if (stat.isFile()) {
        entries.push({ ...metadata, kind: "file", sizeBytes: String(stat.size), sha256: sha2564(fs12.readFileSync(entryPath)) });
      } else {
        entries.push({ ...metadata, kind: "other", sizeBytes: String(stat.size) });
      }
    }
  };
  visit(fullPath, "");
  return {
    path: relativePath,
    exists: true,
    kind: "directory",
    mode: Number(fs12.lstatSync(fullPath, { bigint: true }).mode),
    entryCount: entries.length,
    treeDigest: sha2564(stableMissionSerialize(entries))
  };
}
function artifactIdentity(root, rawPath) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) {
    throw new Error(`Invalid target artifact ${JSON.stringify(rawPath)}: ${normalized.reason}.`);
  }
  const relativePath = normalized.normalizedPath;
  if (relativePath === ".dove-archive" || relativePath.startsWith(".dove-archive/")) {
    throw new Error("Mission target artifacts must not include preserved .dove-archive state.");
  }
  const fullPath = path14.join(root, relativePath);
  if (!fs12.existsSync(fullPath)) {
    resolveCanonicalContainedWrite(root, relativePath, { label: "Mission target artifact path" });
    return { path: relativePath, exists: false };
  }
  const stat = fs12.lstatSync(fullPath, { bigint: true });
  if (stat.isSymbolicLink()) {
    throw new Error(`Mission target artifacts must not be symbolic links: ${relativePath}.`);
  }
  resolveCanonicalContainedWrite(root, relativePath, { label: "Mission target artifact path" });
  if (stat.isFile()) {
    return fileArtifactIdentity(relativePath, fullPath, stat);
  }
  if (stat.isDirectory()) {
    return directoryArtifactIdentity(relativePath, fullPath);
  }
  return {
    path: relativePath,
    exists: true,
    kind: "other",
    mode: stat.mode,
    sizeBytes: stat.size
  };
}
function targetArtifactIdentities(root, targetArtifacts, expectedArtifacts = []) {
  const identities = /* @__PURE__ */ new Map();
  for (const artifactPath of [...targetArtifacts, ...expectedArtifacts]) {
    identities.set(artifactPath, artifactIdentity(root, artifactPath));
  }
  return [...identities.values()];
}
function missionMutationMode(root, args2 = {}) {
  const explicitMode = Object.hasOwn(args2, "mutationMode") ? normalizeMutationMode(args2.mutationMode) : null;
  const activeMode = currentMutationContext(root)?.mutationMode ?? null;
  if (activeMode && explicitMode && activeMode !== explicitMode) {
    throw new Error(`Dove mission mutationMode ${explicitMode} does not match the active mutation context mode ${activeMode}.`);
  }
  return activeMode ?? explicitMode ?? "direct-process";
}
function hasConfirmation(args2 = {}) {
  return args2.confirmed === true;
}
function validateProposedMissionGraph(root, projectIdentity, mission) {
  const existing = projectIdentity.required ? [] : [...openDoveWorkspace(root, { operation: "Dove mission graph validation" }).missions.values()];
  validateMissionGraph([
    ...existing.map((item) => ({ filename: `${item.missionId}.json`, mission: item })),
    { filename: `${mission.missionId}.json`, mission }
  ]);
}
function buildMissionProposal(root, args2 = {}) {
  const workspace = canonicalWorkspace(root);
  const content = missionContractContent(args2);
  const missionId = normalizeMissionId(args2.missionId, content.goal);
  const contractDigest = missionContractDigest(missionId, content);
  const mutationMode2 = missionMutationMode(root, args2);
  const projectIdentity = projectIdentitySnapshot(root, workspace, {
    goal: content.goal,
    workspaceId: args2.workspaceId,
    createdAt: args2.createdAt
  }, mutationMode2);
  if (!projectIdentity.required) {
    const suppliedWorkspaceId = normalizeString2(args2.workspaceId, projectIdentity.workspaceId);
    const suppliedCreatedAt = normalizeString2(args2.createdAt, projectIdentity.createdAt);
    if (suppliedWorkspaceId !== projectIdentity.workspaceId || suppliedCreatedAt !== projectIdentity.createdAt) {
      throw new Error("Dove mission replay no longer matches the current manifest workspace identity.");
    }
  }
  const targetIdentities = targetArtifactIdentities(root, content.targetArtifacts, content.expectedArtifacts);
  const mission = {
    schemaVersion: MISSION_CONTRACT_SCHEMA_VERSION,
    proposalVersion: MISSION_PROPOSAL_VERSION,
    missionId,
    contractDigest,
    ...content,
    completionCriterionIds: missionCompletionCriteria(content).map(({ criterionId }) => criterionId),
    evidenceRequirementIds: missionEvidenceRequirements(content).map(({ requirementId }) => requirementId)
  };
  validateProposedMissionGraph(root, projectIdentity, mission);
  const envelope = {
    proposalVersion: MISSION_PROPOSAL_VERSION,
    workspace,
    mutationMode: mutationMode2,
    workspaceSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION,
    projectIdentityRequired: projectIdentity.required,
    workspaceBootstrapRequired: projectIdentity.workspaceBootstrapRequired,
    workspaceId: projectIdentity.workspaceId,
    workspaceCreatedAt: projectIdentity.createdAt,
    projectIdentityDigest: projectIdentity.identityDigest,
    targetArtifactIdentities: targetIdentities,
    mission
  };
  const proposalDigest = sha2564(stableMissionSerialize(envelope));
  return {
    workspace,
    mutationMode: mutationMode2,
    projectIdentity,
    targetIdentities,
    mission,
    content,
    contractDigest,
    proposalDigest
  };
}
function confirmArgsFor2(proposal) {
  return {
    confirmed: true,
    proposalVersion: MISSION_PROPOSAL_VERSION,
    proposalWorkspace: proposal.workspace,
    proposalDigest: proposal.proposalDigest,
    mutationMode: proposal.mutationMode,
    workspaceId: proposal.projectIdentity.workspaceId,
    createdAt: proposal.projectIdentity.createdAt,
    missionId: proposal.mission.missionId,
    ...proposal.content
  };
}
function approvalMetadata(proposal) {
  return {
    required: true,
    noChangesApplied: true,
    summary: `Dove can save this mission checkpoint: ${proposal.content.goal}`,
    effects: [
      "Save the approved goal and scope.",
      "Save the expected outcomes and evidence requirements.",
      "Return control to the host to continue the requested work."
    ],
    question: "Create this mission checkpoint and continue the requested work?"
  };
}
function confirmationMetadata(proposal) {
  const confirmArgs2 = confirmArgsFor2(proposal);
  return {
    required: true,
    proposalVersion: MISSION_PROPOSAL_VERSION,
    proposalDigest: proposal.proposalDigest,
    proposalWorkspace: proposal.workspace,
    mutationMode: proposal.mutationMode,
    trustBoundary: "trusted-local-exact-replay-data",
    proofOfHumanApproval: false,
    tamperProof: false,
    confirmArgs: confirmArgs2,
    proposalToken: Buffer.from(JSON.stringify({ version: MISSION_PROPOSAL_VERSION, mutationMode: proposal.mutationMode, confirmArgs: confirmArgs2 }), "utf8").toString("base64url")
  };
}
function executionHandoff(mission) {
  return {
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    targetArtifacts: mission.targetArtifacts,
    expectedArtifacts: mission.expectedArtifacts,
    completionCriteria: missionCompletionCriteria(mission),
    evidenceRequirements: missionEvidenceRequirements(mission),
    receiptCliTemplate: 'node ./bin/dove-package.mjs receipt . --input "<receipt.json>" --mutation-mode direct-process --json',
    mcpTools: {
      ingest: "ingest_execution_receipt",
      assess: "assess_mission_completion"
    },
    persisted: false
  };
}
function missionMutationMetadata(proposal, applied) {
  return {
    mutationMode: proposal.mutationMode,
    writesApplied: applied,
    paths: applied ? [
      ...proposal.projectIdentity.required ? [
        ARTIFACT_PATHS.doveRootManifest,
        ARTIFACT_PATHS.projectIdentity
      ] : [],
      missionPath(proposal.mission.missionId)
    ] : []
  };
}
function assertReplayHeader(proposal, args2) {
  const suppliedDigest = normalizeString2(args2.proposalDigest, "");
  if (!/^[0-9a-f]{64}$/u.test(suppliedDigest) || !normalizeString2(args2.missionId, null)) {
    throw new Error("Confirmed Dove mission materialization requires the exact proposalDigest and missionId returned by the selected local proposal replay data.");
  }
  if (!currentMutationContext(proposal.workspace)) {
    throw new Error("Confirmed Dove mission materialization requires an active MutationContext; direct core replay cannot write outside the selected mutation mode.");
  }
  if (args2.proposalVersion !== MISSION_PROPOSAL_VERSION) {
    throw new Error("The selected local Dove mission proposal replay version is not supported. Request a fresh proposal.");
  }
  if (normalizeString2(args2.proposalWorkspace, "") !== proposal.workspace) {
    throw new Error("The selected local Dove mission proposal replay belongs to a different canonical workspace. Request a fresh proposal.");
  }
  if (suppliedDigest !== proposal.proposalDigest) {
    throw new Error("The selected local Dove mission proposal replay no longer matches the current contract, target artifact identities, project identity, or exact replay fields. Request a fresh proposal before materialization.");
  }
}
function assertMissionIdAvailable(root, missionId) {
  if (fileExists(root, missionPath(missionId))) {
    throw new Error(`Dove mission id already exists or changed: ${missionId}. Request a fresh proposal.`);
  }
}
function materializeProjectIdentity(root, proposal) {
  if (!proposal.projectIdentity.required) {
    openDoveWorkspace(root, { operation: "Dove mission materialization" });
    return proposal.projectIdentity.identity;
  }
  initDoveWorkspace(root, proposal.projectIdentity.initConfirmArgs);
  return proposal.projectIdentity.identity;
}
function persistedMission(proposal) {
  return {
    schemaVersion: MISSION_CONTRACT_SCHEMA_VERSION,
    workspaceId: proposal.projectIdentity.workspaceId,
    missionId: proposal.mission.missionId,
    contractDigest: proposal.contractDigest,
    createdAt: proposal.projectIdentity.required ? proposal.projectIdentity.createdAt : nowIso(),
    ...proposal.content,
    completionCriterionIds: missionCompletionCriteria(proposal.content).map(({ criterionId }) => criterionId),
    evidenceRequirementIds: missionEvidenceRequirements(proposal.content).map(({ requirementId }) => requirementId)
  };
}
function createDoveMission(root, args2 = {}) {
  assertGovernanceMutationRegistered("create-dove-mission", "guarded");
  const operation = args2.operation ?? "create";
  if (operation === "reevaluate-research-tree") return reevaluateResearchTree(root, args2);
  if (operation !== "create") throw new Error("create_dove_mission operation must be create or reevaluate-research-tree.");
  assertAllowedFields(args2, /* @__PURE__ */ new Set([...MISSION_CONTRACT_INPUT_FIELDS, ...MISSION_REPLAY_CONTROL_FIELDS, "operation"]), "create_dove_mission");
  const createArgs = Object.fromEntries(Object.entries(args2).filter(([field]) => field !== "operation"));
  const confirmed = hasConfirmation(createArgs);
  const proposal = buildMissionProposal(root, createArgs);
  if (!confirmed) {
    return {
      status: "needs-confirmation",
      mission: proposal.mission,
      contractDigest: proposal.contractDigest,
      handoffBrief: proposal.content,
      approval: approvalMetadata(proposal),
      confirmation: confirmationMetadata(proposal),
      mutation: missionMutationMetadata(proposal, false)
    };
  }
  assertReplayHeader(proposal, createArgs);
  assertMissionIdAvailable(root, proposal.mission.missionId);
  const mission = persistedMission(proposal);
  materializeProjectIdentity(root, proposal);
  writeJson(root, missionPath(mission.missionId), mission);
  const plannedOnly = isPatchPlanMode(root);
  return {
    status: plannedOnly ? "materialization-planned" : "materialized",
    mission,
    contractDigest: proposal.contractDigest,
    handoffBrief: proposal.content,
    executionHandoff: executionHandoff(mission),
    mutation: missionMutationMetadata(proposal, !plannedOnly)
  };
}
function initDoveGoal(root, args2 = {}) {
  assertGovernanceMutationRegistered("init-dove-goal", "guarded");
  assertAllowedFields(args2, INIT_INPUT_FIELDS, "init_dove_goal");
  return initDoveWorkspace(root, args2);
}

// src/core/domain-artifacts.mjs
var SAFE_ID4 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
function domainSafeId(value2, label) {
  const normalized = typeof value2 === "string" ? value2.trim() : "";
  if (!SAFE_ID4.test(normalized)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return normalized;
}
function domainNonEmptyText(value2, label) {
  const normalized = typeof value2 === "string" ? value2.trim() : "";
  if (!normalized) throw new Error(`${label} must be a non-empty string.`);
  return normalized;
}
function domainStringArray(value2, label, options = {}) {
  if (value2 === void 0) return [];
  if (!Array.isArray(value2)) throw new Error(`${label} must be an array of non-empty strings.`);
  const items = value2.map((item, index) => domainNonEmptyText(item, `${label}[${index}]`));
  if (new Set(items).size !== items.length) throw new Error(`${label} must not contain duplicates.`);
  if (options.minItems && items.length < options.minItems) throw new Error(`${label} must contain at least ${options.minItems} item(s).`);
  return items;
}
function assertSealedDomainArgs(args2, fields, label) {
  if (!args2 || typeof args2 !== "object" || Array.isArray(args2)) throw new Error(`${label} arguments must be a plain object.`);
  const unknown = Object.keys(args2).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function domainJson(value2) {
  return `${JSON.stringify(value2, null, 2)}
`;
}
function domainSha256(value2) {
  return crypto7.createHash("sha256").update(value2).digest("hex");
}
function readCurrentMission(root, missionId, operation = "Domain workflow") {
  const workspace = openDoveWorkspace(root, { operation });
  const normalizedMissionId = domainSafeId(missionId, "missionId");
  const relativePath = path15.posix.join(ARTIFACT_PATHS.missionsDir, `${normalizedMissionId}.json`);
  const fullPath = path15.resolve(root, relativePath);
  if (!fs13.existsSync(fullPath)) throw new Error(`Mission does not exist: ${normalizedMissionId}.`);
  const mission = readJson(root, relativePath, null);
  const current = assertCurrentMissionContract2(mission);
  if (mission.workspaceId !== workspace.manifest.workspaceId) throw new Error(`Mission ${normalizedMissionId} belongs to a different workspace.`);
  return { workspace, mission, current, relativePath };
}
function canonicalDomainPath(rawPath, label, requiredPrefix = null) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) throw new Error(`${label} has an unsafe path: ${normalized.reason}.`);
  const supplied = String(rawPath).trim().replace(/\\/gu, "/");
  if (normalized.normalizedPath !== supplied) throw new Error(`${label} must use a canonical project-relative path.`);
  if (requiredPrefix && normalized.normalizedPath !== requiredPrefix && !normalized.normalizedPath.startsWith(`${requiredPrefix}/`)) {
    throw new Error(`${label} must stay under ${requiredPrefix}.`);
  }
  return normalized.normalizedPath;
}
function currentFileHash(root, relativePath, label) {
  const inspection = inspectDeclaredPath(root, relativePath, { requireNonEmpty: true });
  if (inspection.status !== "existing") throw new Error(`${label} must reference an existing non-empty regular file (${inspection.reason ?? inspection.status}).`);
  const canonicalPath2 = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath2 !== relativePath) throw new Error(`${label} must use the canonical realpath-contained path.`);
  return { path: canonicalPath2, sha256: sha256File(path15.resolve(root, canonicalPath2)) };
}
function isDoveLessonArtifactPath(rawPath) {
  const normalized = normalizeProjectRelativePath(rawPath);
  return normalized.ok && (normalized.normalizedPath === ARTIFACT_PATHS.lessonsDir || normalized.normalizedPath.startsWith(`${ARTIFACT_PATHS.lessonsDir}/`));
}
function assertNotDoveLessonArtifactPath(rawPath, label = "artifact") {
  if (isDoveLessonArtifactPath(rawPath)) {
    throw new Error(`${label} must not use a Dove lesson as substantive artifact or evidence.`);
  }
}
function resolveMissionArtifactReferences(root, missionId, references = [], label = "artifactRefs") {
  const normalized = domainStringArray(references, label);
  if (normalized.length === 0) return [];
  const ownership = readArtifactOwnership(root);
  const byPath = new Map(ownership.artifacts.map((item) => [item.path, item]));
  return normalized.map((rawPath, index) => {
    const artifactPath = canonicalDomainPath(rawPath, `${label}[${index}]`);
    assertNotDoveLessonArtifactPath(artifactPath, `${label}[${index}]`);
    const owner = byPath.get(artifactPath);
    if (!owner) throw new Error(`${label}[${index}] is not a registered schema 9 artifact: ${artifactPath}.`);
    if (owner.missionId !== missionId) throw new Error(`${label}[${index}] belongs to mission ${owner.missionId}, not ${missionId}.`);
    const current = currentFileHash(root, artifactPath, `${label}[${index}]`);
    if (current.sha256 !== owner.sha256) throw new Error(`${label}[${index}] has changed since its latest ownership receipt: ${artifactPath}.`);
    return { ...owner, ...current };
  });
}
function resolveMissionValidationReference(root, missionId, rawPath, label = "validation reference") {
  const { workspace, mission } = readCurrentMission(root, missionId, label);
  const validationPath = canonicalDomainPath(rawPath, label);
  const receipt = workspace.receiptLedger.receipts.toReversed().find(
    (item) => item.missionId === mission.missionId && item.contractDigest === mission.contractDigest && item.validations.some((validation2) => validation2.reference === validationPath)
  );
  const validation = receipt?.validations.find((item) => item.reference === validationPath);
  if (!validation) throw new Error(`${label} is not current mission-bound validation evidence: ${validationPath}.`);
  const current = currentFileHash(root, validationPath, label);
  if (current.sha256 !== validation.outputHash) throw new Error(`${label} has changed since its validation receipt: ${validationPath}.`);
  return { reference: validationPath, outputHash: validation.outputHash, receiptId: receipt.receiptId };
}
function normalizeWrite(root, missionId, item, index, options = {}) {
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`domainWrites[${index}] must be an object.`);
  const relativePath = canonicalDomainPath(item.path, `domainWrites[${index}].path`, ".dove");
  const isLesson = isDoveLessonArtifactPath(relativePath);
  const isResearchTree = relativePath === ARTIFACT_PATHS.researchTreesDir || relativePath.startsWith(`${ARTIFACT_PATHS.researchTreesDir}/`);
  if (isLesson && options.allowLessonArtifacts !== true) {
    throw new Error(`domainWrites[${index}].path may create a Dove lesson only through an approved lesson or research-tree transaction.`);
  }
  if (isResearchTree && options.allowResearchTreeArtifacts !== true) {
    throw new Error(`domainWrites[${index}].path may create Dove research-tree bookkeeping only through reevaluate-research-tree.`);
  }
  if (options.restrictToLessonArtifacts === true && !isLesson) {
    throw new Error(`domainWrites[${index}].path must stay under ${ARTIFACT_PATHS.lessonsDir} for lesson recording.`);
  }
  if (options.restrictToResearchTreeArtifacts === true && !isLesson && !isResearchTree) {
    throw new Error(`domainWrites[${index}].path must stay under ${ARTIFACT_PATHS.researchTreesDir} or ${ARTIFACT_PATHS.lessonsDir} for research-tree reevaluation.`);
  }
  const kind = domainNonEmptyText(item.kind, `domainWrites[${index}].kind`);
  if (!["report", "document", "code", "data", "figure", "media", "other"].includes(kind)) throw new Error(`domainWrites[${index}].kind is unsupported.`);
  const content = Buffer.isBuffer(item.content) ? item.content : Buffer.from(String(item.content ?? ""), "utf8");
  if (content.byteLength === 0) throw new Error(`domainWrites[${index}].content must be non-empty.`);
  const context = currentMutationContext(root);
  context.resolve(relativePath);
  if (Buffer.isBuffer(item.content) && isPatchPlanMode(root) && path15.extname(relativePath).toLowerCase() !== ".svg") {
    throw new Error(`domainWrites[${index}] patch-plan cannot safely represent binary artifact ${relativePath}; import PNG, JPEG, or PDF output in direct-process mode.`);
  }
  const derivedReferences = domainStringArray(item.derivedReferences, `domainWrites[${index}].derivedReferences`);
  return {
    path: relativePath,
    kind,
    content,
    encoding: Buffer.isBuffer(item.content) ? "binary" : "utf8",
    sha256: domainSha256(content),
    missionId,
    derivedReferences
  };
}
function finalizeDomainArtifacts(root, options = {}) {
  const actionId = domainNonEmptyText(options.actionId, "actionId");
  assertGovernanceMutationRegistered(actionId, options.governanceMode ?? "guarded");
  const context = currentMutationContext(root);
  if (!context) throw new Error(`${actionId} requires an active MutationContext.`);
  const { workspace, mission } = readCurrentMission(root, options.missionId, options.operation ?? actionId);
  assertMissionAcceptsWrites(workspace, mission);
  context.requireCommitPrecondition(ARTIFACT_PATHS.executionReceiptsDir);
  context.requireCommitLock(".dove/.receipt-ledger-append.lock", { label: "Execution receipt ledger append lock" });
  if (!Array.isArray(options.writes) || options.writes.length === 0) throw new Error(`${actionId} requires at least one real domain artifact write.`);
  const lessonRecording = options.allowLessonArtifacts === true && actionId === "record-dove-lesson";
  const researchTreeRecording = options.allowResearchTreeArtifacts === true && actionId === "create-dove-mission";
  const writes = options.writes.map((item, index) => normalizeWrite(root, mission.missionId, item, index, {
    allowLessonArtifacts: lessonRecording || researchTreeRecording,
    allowResearchTreeArtifacts: researchTreeRecording,
    restrictToLessonArtifacts: lessonRecording,
    restrictToResearchTreeArtifacts: researchTreeRecording
  }));
  const duplicatePath = writes.map((item) => item.path).find((item, index, items) => items.indexOf(item) !== index);
  if (duplicatePath) throw new Error(`${actionId} contains duplicate artifact path ${duplicatePath}.`);
  const receiptId = options.receiptId === void 0 ? `receipt-${actionId}-${crypto7.randomUUID()}` : domainSafeId(options.receiptId, "receiptId");
  const receiptPath = path15.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receiptId}.json`);
  if (context.fileExists(receiptPath)) throw new Error(`Generated execution receipt id is occupied: ${receiptId}.`);
  const ownershipBeforeWrite = readArtifactOwnership(root);
  const ownerByPath = new Map(ownershipBeforeWrite.artifacts.map((item) => [item.path, item]));
  for (const item of writes) {
    if (!context.fileExists(item.path)) continue;
    if (isDoveLessonArtifactPath(item.path)) {
      throw new Error(`${actionId} refuses to overwrite immutable lesson artifact ${item.path}.`);
    }
    const owner = ownerByPath.get(item.path);
    if (!owner) throw new Error(`${actionId} refuses to overwrite unowned existing artifact ${item.path}.`);
    const ownerReceipt = workspace.receiptLedger.receipts.find((receipt2) => receipt2.receiptId === owner.receiptId);
    if (ownerReceipt?.producer?.kind === "dove-internal" && ["prepare-review-exchange", "import-review-exchange"].includes(ownerReceipt.producer.actionId)) {
      throw new Error(`${actionId} refuses to overwrite immutable review ${ownerReceipt.producer.actionId === "prepare-review-exchange" ? "preparation control" : "import record"} ${item.path}.`);
    }
    if (owner.missionId !== mission.missionId && !missionSupersedes(workspace.missionGraph, mission.missionId, owner.missionId)) {
      throw new Error(`${actionId} refuses to overwrite artifact ${item.path} owned by unrelated mission ${owner.missionId}.`);
    }
    const current = currentFileHash(root, item.path, item.path);
    if (current.sha256 !== owner.sha256) throw new Error(`${actionId} refuses to overwrite drifted artifact ${item.path}.`);
  }
  const artifacts = writes.map(({ path: artifactPath, kind, sha256: sha2567 }) => ({ path: artifactPath, kind, sha256: sha2567 }));
  const completionEligible = false;
  const criteriaSatisfied = [];
  const recordedAt = nowIso();
  const baseReceipt = {
    schemaVersion: EXECUTION_RECEIPT_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    receiptId,
    ledgerSequence: workspace.receiptLedger.nextLedgerSequence,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    summary: domainNonEmptyText(options.summary, "summary"),
    artifacts,
    validations: [],
    criteriaSatisfied,
    producedAt: recordedAt,
    recordedAt,
    producer: { kind: "dove-internal", actionId }
  };
  const receipt = {
    ...baseReceipt,
    artifacts: deriveArtifactReferences(baseReceipt, new Map(writes.map((item) => [item.path, item.derivedReferences])))
  };
  assertReceiptAppendable(workspace.receiptLedger, receipt, { missionGraph: workspace.missionGraph });
  for (const item of writes) {
    if (item.encoding === "binary") {
      if (isPatchPlanMode(root)) {
        writeText(root, item.path, item.content.toString("utf8"));
      } else {
        context.writeBinary(item.path, item.content);
      }
    } else writeText(root, item.path, item.content.toString("utf8"));
  }
  writeJson(root, receiptPath, receipt);
  const plannedOnly = isPatchPlanMode(root);
  return {
    status: plannedOnly ? "planned" : "recorded",
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    receipt,
    artifacts,
    completionEligible,
    mutation: {
      mutationMode: context.mutationMode,
      writesApplied: !plannedOnly,
      paths: [...writes.map((item) => item.path), receiptPath]
    }
  };
}

// src/core/review-exchange.mjs
import crypto8 from "node:crypto";
import fs14 from "node:fs";
import path16 from "node:path";
var REVIEW_EXCHANGE_SCHEMA_VERSION = 8;
var REVIEW_EXCHANGE_POLICIES = Object.freeze([
  "local-preflight",
  "isolated-selected-artifacts",
  "final-plan-results-only",
  "external"
]);
var POLICY_SET = new Set(REVIEW_EXCHANGE_POLICIES);
var PREPARE_FIELDS = /* @__PURE__ */ new Set(["missionId", "policy", "artifactPaths", "finalPlanPaths", "finalResultPaths"]);
var IMPORT_FIELDS = /* @__PURE__ */ new Set(["missionId", "exchangeId", "reviewId"]);
var COVERAGE_FIELDS = /* @__PURE__ */ new Set(["missionId", "artifactPaths", "requireAuthoritative"]);
var EXPECTED_COVERAGE_FIELDS = /* @__PURE__ */ new Set(["missionId", "expectedSnapshots", "requireAuthoritative"]);
var REVIEW_VERDICTS = /* @__PURE__ */ new Set(["coherent", "needs-revision", "needs-evidence", "blocked"]);
var REVIEW_STATUSES = /* @__PURE__ */ new Set(["completed", "blocked", "failed"]);
var HASH_PATTERN3 = /^[0-9a-f]{64}$/u;
var INPUT_FIELDS = /* @__PURE__ */ new Set([
  "schemaVersion",
  "workspaceId",
  "missionId",
  "contractDigest",
  "exchangeId",
  "createdAt",
  "policy",
  "scopeSha256",
  "inputBoundary",
  "preparationReceiptId",
  "artifactPaths",
  "finalPlanPaths",
  "finalResultPaths",
  "reviewedArtifactPaths",
  "reviewedArtifacts",
  "reviewedArtifactSetSha256",
  "packageArtifacts",
  "packageArtifactSetSha256",
  "outputContract",
  "privacyBoundary"
]);
var MANIFEST_FIELDS2 = /* @__PURE__ */ new Set([
  "schemaVersion",
  "workspaceId",
  "missionId",
  "contractDigest",
  "exchangeId",
  "status",
  "createdAt",
  "policy",
  "scopeSha256",
  "inputBoundary",
  "preparationReceiptId",
  "inputPath",
  "inputSha256",
  "handoffPath",
  "reportPath",
  "consumptionPath",
  "artifactPackagePath",
  "artifactPaths",
  "finalPlanPaths",
  "finalResultPaths",
  "reviewedArtifactPaths",
  "reviewedArtifacts",
  "reviewedArtifactSetSha256",
  "packageArtifacts",
  "packageArtifactSetSha256"
]);
var PACKAGE_ARTIFACT_FIELDS = /* @__PURE__ */ new Set(["sourcePath", "sourceSha256", "sourceSizeBytes", "packagePath", "packageSha256", "packageSizeBytes"]);
var CONSUMPTION_FIELDS = /* @__PURE__ */ new Set([
  "schemaVersion",
  "workspaceId",
  "missionId",
  "contractDigest",
  "exchangeId",
  "reviewId",
  "preparationReceiptId",
  "importReceiptId",
  "consumedAt"
]);
var HANDOFF_FIELDS = /* @__PURE__ */ new Set([
  "schemaVersion",
  "workspaceId",
  "missionId",
  "contractDigest",
  "exchangeId",
  "reviewId",
  "policy",
  "scopeSha256",
  "status",
  "verdict",
  "reviewerId",
  "summary",
  "inputPath",
  "inputSha256",
  "reportPath",
  "reportSha256",
  "reviewedArtifactPaths",
  "findings",
  "actionItems",
  "reviewedAt"
]);
var FINDING_FIELDS = /* @__PURE__ */ new Set(["findingId", "severity", "summary", "linkedArtifactPaths"]);
var IMPORTED_REVIEW_FIELDS = /* @__PURE__ */ new Set([
  "schemaVersion",
  "workspaceId",
  "missionId",
  "contractDigest",
  "exchangeId",
  "reviewId",
  "policy",
  "scopeSha256",
  "status",
  "verdict",
  "reviewerId",
  "summary",
  "reviewedAt",
  "reviewedArtifactPaths",
  "reviewedArtifacts",
  "reviewedArtifactSetSha256",
  "packageArtifacts",
  "packageArtifactSetSha256",
  "findings",
  "actionItems",
  "preparationReceiptId",
  "importReceiptId",
  "exchange",
  "authority",
  "privateTranscriptImported"
]);
var EXCHANGE_HASH_FIELDS = /* @__PURE__ */ new Set([
  "manifestPath",
  "manifestSha256",
  "inputPath",
  "inputSha256",
  "handoffPath",
  "handoffSha256",
  "reportPath",
  "reportSha256",
  "consumptionPath",
  "consumptionSha256",
  "importedReportPath",
  "importedReportSha256"
]);
var AUTHORITY_FIELDS = /* @__PURE__ */ new Set(["authoritative", "callerMayMintAuthority", "issuer", "reason"]);
function sealed(value2, fields, label) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) throw new Error(`${label} must be a plain object.`);
  const unknown = Object.keys(value2).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  return value2;
}
function exchangePath(exchangeId, leaf) {
  return path16.posix.join(".dove/reviews/exchanges", exchangeId, leaf);
}
function artifactPackagePath(exchangeId) {
  return exchangePath(exchangeId, "package/artifacts");
}
function consumptionPath(exchangeId) {
  return exchangePath(exchangeId, "consumption.json");
}
function exchangeLockPath(exchangeId) {
  return exchangePath(exchangeId, ".exchange.lock");
}
function packageArtifactPath(exchangeId, index, sourcePath2) {
  const extension = path16.posix.extname(sourcePath2);
  return exchangePath(exchangeId, `package/artifacts/artifact-${String(index + 1).padStart(4, "0")}${extension}`);
}
function importedReviewPath(reviewId) {
  return path16.posix.join(".dove/reviews", `${reviewId}.json`);
}
function importedReportPath(reviewId) {
  return path16.posix.join(".dove/reviews", `${reviewId}.report.md`);
}
function exactTimestamp2(value2, label) {
  const text = domainNonEmptyText(value2, label);
  const parsed2 = Date.parse(text);
  if (!Number.isFinite(parsed2) || new Date(parsed2).toISOString() !== text) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return text;
}
function exactHash(value2, label) {
  const hash3 = String(value2 ?? "");
  if (!HASH_PATTERN3.test(hash3)) throw new Error(`${label} must be a lowercase SHA-256 hash.`);
  return hash3;
}
function currentCanonicalLeaf(root, relativePath, label) {
  const inspection = inspectDeclaredPath(root, relativePath, { requireNonEmpty: true });
  if (inspection.status !== "existing") throw new Error(`${label} must be an existing non-empty regular file (${inspection.reason ?? inspection.status}).`);
  const canonicalPath2 = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (inspection.normalizedPath !== relativePath || canonicalPath2 !== relativePath) throw new Error(`${label} must be the canonical realpath-contained exchange path.`);
  const context = currentMutationContext(root);
  const snapshot = context?.readFileSnapshot?.(canonicalPath2);
  const content = snapshot?.exists && snapshot.type === "file" && snapshot.buffer ? Buffer.from(snapshot.buffer) : fs14.readFileSync(path16.resolve(root, canonicalPath2));
  return { path: canonicalPath2, content, sizeBytes: content.byteLength, sha256: snapshot?.sha256 ?? domainSha256(content) };
}
function snapshotContent(root, snapshot, label) {
  if (Buffer.isBuffer(snapshot?.content)) return Buffer.from(snapshot.content);
  if (Buffer.isBuffer(snapshot?.buffer)) return Buffer.from(snapshot.buffer);
  const buffered = snapshotArtifactBuffer(root, snapshot.path, label);
  if (buffered.sha256 !== snapshot.sha256 || buffered.sizeBytes !== snapshot.sizeBytes) throw new Error(`${label} changed while the review exchange was being prepared.`);
  return buffered.content;
}
function buildArtifactPackage(root, exchangeId, snapshots) {
  const packageArtifacts = [];
  const writes = [];
  for (const [index, snapshot] of snapshots.entries()) {
    const content = snapshotContent(root, snapshot, `Review artifact ${snapshot.path}`);
    const packagePath = packageArtifactPath(exchangeId, index, snapshot.path);
    const packageSha256 = domainSha256(content);
    packageArtifacts.push({
      sourcePath: snapshot.path,
      sourceSha256: snapshot.sha256,
      sourceSizeBytes: snapshot.sizeBytes,
      packagePath,
      packageSha256,
      packageSizeBytes: content.byteLength
    });
    writes.push({ path: packagePath, kind: "data", content, derivedReferences: [`artifact:${snapshot.path}`] });
  }
  return { packageArtifacts, packageArtifactSetSha256: stablePackageArtifactSetHash(packageArtifacts), writes };
}
function stablePackageArtifactSetHash(items) {
  return domainSha256(`${JSON.stringify([...items].sort((left, right) => left.sourcePath.localeCompare(right.sourcePath)))}
`);
}
function normalizePackageArtifacts(value2, label = "packageArtifacts") {
  if (!Array.isArray(value2) || value2.length === 0) throw new Error(`${label} must contain package artifact mappings.`);
  const sourcePaths = /* @__PURE__ */ new Set();
  const packagePaths = /* @__PURE__ */ new Set();
  const normalized = value2.map((item, index) => {
    sealed(item, PACKAGE_ARTIFACT_FIELDS, `${label}[${index}]`);
    const sourcePath2 = domainNonEmptyText(item.sourcePath, `${label}[${index}].sourcePath`);
    const packagePath = domainNonEmptyText(item.packagePath, `${label}[${index}].packagePath`);
    if (sourcePaths.has(sourcePath2) || packagePaths.has(packagePath)) throw new Error(`${label} contains duplicate source or package paths.`);
    sourcePaths.add(sourcePath2);
    packagePaths.add(packagePath);
    const sourceSizeBytes = item.sourceSizeBytes;
    const packageSizeBytes = item.packageSizeBytes;
    if (!Number.isSafeInteger(sourceSizeBytes) || sourceSizeBytes <= 0 || !Number.isSafeInteger(packageSizeBytes) || packageSizeBytes <= 0) throw new Error(`${label}[${index}] sizes must be positive safe integers.`);
    return {
      sourcePath: sourcePath2,
      sourceSha256: exactHash(item.sourceSha256, `${label}[${index}].sourceSha256`),
      sourceSizeBytes,
      packagePath,
      packageSha256: exactHash(item.packageSha256, `${label}[${index}].packageSha256`),
      packageSizeBytes
    };
  }).sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
  return normalized;
}
function assertPackageBindings(root, exchangeId, snapshots, manifest, input, ownershipByPath = null) {
  if (manifest.policy !== "isolated-selected-artifacts") {
    if (!Array.isArray(manifest.packageArtifacts) || manifest.packageArtifacts.length !== 0 || !Array.isArray(input.packageArtifacts) || input.packageArtifacts.length !== 0 || manifest.packageArtifactSetSha256 !== null || input.packageArtifactSetSha256 !== null) {
      throw new Error(`${manifest.policy} must not declare an isolated artifact package.`);
    }
    return { packageArtifacts: [], packageArtifactSetSha256: null };
  }
  const manifestPackage = normalizePackageArtifacts(manifest.packageArtifacts, "manifest.packageArtifacts");
  const inputPackage = normalizePackageArtifacts(input.packageArtifacts, "input.packageArtifacts");
  if (!same(manifestPackage, inputPackage)) throw new Error("Review exchange artifact package drifted between manifest and input.");
  if (manifest.artifactPackagePath !== artifactPackagePath(exchangeId)) throw new Error("Review exchange manifest artifact package path is noncanonical.");
  if (manifestPackage.length !== snapshots.length) throw new Error("Review exchange artifact package does not exactly map the frozen source set.");
  for (const [index, snapshot] of snapshots.entries()) {
    const item = manifestPackage[index];
    if (item.sourcePath !== snapshot.path || item.sourceSha256 !== snapshot.sha256 || item.sourceSizeBytes !== snapshot.sizeBytes) throw new Error(`Review exchange package source mapping drifted for ${snapshot.path}.`);
    if (item.packagePath !== packageArtifactPath(exchangeId, index, snapshot.path)) throw new Error(`Review exchange package path is noncanonical for ${snapshot.path}.`);
    const packageLeaf = currentCanonicalLeaf(root, item.packagePath, `Review exchange packaged artifact ${item.packagePath}`);
    if (packageLeaf.sha256 !== item.packageSha256 || packageLeaf.sizeBytes !== item.packageSizeBytes) throw new Error(`Review exchange packaged artifact changed: ${item.packagePath}.`);
    const sourceLeaf = currentCanonicalLeaf(root, snapshot.path, `Review exchange source artifact ${snapshot.path}`);
    if (sourceLeaf.sha256 !== item.sourceSha256 || sourceLeaf.sizeBytes !== item.sourceSizeBytes || sourceLeaf.sha256 !== packageLeaf.sha256 || sourceLeaf.sizeBytes !== packageLeaf.sizeBytes) throw new Error(`Review exchange source/package mapping is no longer current for ${snapshot.path}.`);
    if (ownershipByPath) {
      const sourceOwner = ownershipByPath.get(item.sourcePath);
      const packageOwner = ownershipByPath.get(item.packagePath);
      if (!sourceOwner || sourceOwner.sha256 !== item.sourceSha256) throw new Error(`Review exchange source ownership is not current for ${item.sourcePath}.`);
      if (!packageOwner || packageOwner.sha256 !== item.packageSha256) throw new Error(`Review exchange package ownership is not current for ${item.packagePath}.`);
    }
  }
  const setHash = stablePackageArtifactSetHash(manifestPackage);
  if (manifest.packageArtifactSetSha256 !== setHash || input.packageArtifactSetSha256 !== setHash) throw new Error("Review exchange package artifact-set hash drifted.");
  return { packageArtifacts: manifestPackage, packageArtifactSetSha256: setHash };
}
function normalizedPolicy(value2) {
  const policy = domainNonEmptyText(value2, "policy");
  if (!POLICY_SET.has(policy)) throw new Error(`policy must be one of: ${REVIEW_EXCHANGE_POLICIES.join(", ")}.`);
  return policy;
}
function normalizePolicyPaths(args2, policy) {
  const artifactPaths = domainStringArray(args2.artifactPaths, "artifactPaths");
  const finalPlanPaths = domainStringArray(args2.finalPlanPaths, "finalPlanPaths");
  const finalResultPaths = domainStringArray(args2.finalResultPaths, "finalResultPaths");
  if (policy === "final-plan-results-only") {
    if (artifactPaths.length > 0) throw new Error("final-plan-results-only does not accept artifactPaths outside its final plan and result classes.");
    if (finalPlanPaths.length === 0 || finalResultPaths.length === 0) throw new Error("final-plan-results-only requires at least one finalPlanPath and one finalResultPath.");
  } else {
    if (finalPlanPaths.length > 0 || finalResultPaths.length > 0) throw new Error(`${policy} accepts only artifactPaths.`);
    if (artifactPaths.length === 0) throw new Error(`${policy} requires at least one artifactPath.`);
  }
  return {
    artifactPaths,
    finalPlanPaths,
    finalResultPaths,
    reviewedArtifactPaths: policy === "final-plan-results-only" ? [...finalPlanPaths, ...finalResultPaths].sort() : artifactPaths
  };
}
function policyInputBoundary(policy) {
  switch (policy) {
    case "local-preflight":
      return "read-only-current-workspace";
    case "isolated-selected-artifacts":
      return "selected-artifact-isolation";
    case "final-plan-results-only":
      return "classified-final-plan-results";
    case "external":
      return "host-mediated-external-review";
    default:
      throw new Error(`Unsupported review policy: ${policy}.`);
  }
}
function policyScope(policy, paths) {
  const value2 = {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    policy,
    inputBoundary: policyInputBoundary(policy),
    artifactPaths: paths.artifactPaths,
    finalPlanPaths: paths.finalPlanPaths,
    finalResultPaths: paths.finalResultPaths,
    reviewedArtifactPaths: paths.reviewedArtifactPaths
  };
  return { value: value2, sha256: domainSha256(`${JSON.stringify(value2)}
`) };
}
function reviewPreflight(root, args2, operation) {
  const { workspace, mission } = readCurrentMission(root, args2.missionId, operation);
  const policy = normalizedPolicy(args2.policy);
  const paths = normalizePolicyPaths(args2, policy);
  let snapshot;
  let canonical;
  if (policy === "final-plan-results-only") {
    const plans = resolveReviewArtifactSnapshots(root, mission.missionId, paths.finalPlanPaths, "finalPlanPaths");
    const results = resolveReviewArtifactSnapshots(root, mission.missionId, paths.finalResultPaths, "finalResultPaths");
    const finalPlanPaths = plans.reviewedArtifacts.map((item) => item.path);
    const finalResultPaths = results.reviewedArtifacts.map((item) => item.path);
    if (finalPlanPaths.length !== paths.finalPlanPaths.length || finalResultPaths.length !== paths.finalResultPaths.length || finalPlanPaths.some((item) => finalResultPaths.includes(item))) {
      throw new Error("final-plan-results-only contains an internal alias or overlap that collapses the exact classified artifact set.");
    }
    snapshot = resolveReviewArtifactSnapshots(root, mission.missionId, [...finalPlanPaths, ...finalResultPaths], `${policy} review artifacts`);
    canonical = { artifactPaths: [], finalPlanPaths, finalResultPaths, reviewedArtifactPaths: snapshot.reviewedArtifacts.map((item) => item.path) };
  } else {
    snapshot = resolveReviewArtifactSnapshots(root, mission.missionId, paths.artifactPaths, `${policy} review artifacts`);
    const artifactPaths = snapshot.reviewedArtifacts.map((item) => item.path);
    if (artifactPaths.length !== paths.artifactPaths.length) throw new Error(`${policy} contains an internal alias that collapses the exact artifact set.`);
    canonical = { artifactPaths, finalPlanPaths: [], finalResultPaths: [], reviewedArtifactPaths: artifactPaths };
  }
  const scope = policyScope(policy, canonical);
  return { workspace, mission, policy, paths: canonical, snapshot, scope };
}
function reviewPreparationEnvelope(root, prepared) {
  return {
    workspace: fs14.realpathSync.native(path16.resolve(root)),
    missionId: prepared.mission.missionId,
    contractDigest: prepared.mission.contractDigest,
    policy: prepared.policy,
    inputBoundary: policyInputBoundary(prepared.policy),
    scopeSha256: prepared.scope.sha256,
    artifactPaths: prepared.paths.artifactPaths,
    finalPlanPaths: prepared.paths.finalPlanPaths,
    finalResultPaths: prepared.paths.finalResultPaths,
    reviewedArtifacts: prepared.snapshot.reviewedArtifacts,
    reviewedArtifactSetSha256: prepared.snapshot.reviewedArtifactSetSha256
  };
}
function reviewPreparationProposal(root, prepared) {
  const envelope = reviewPreparationEnvelope(root, prepared);
  return {
    envelope,
    proposalDigest: domainSha256(JSON.stringify(envelope)),
    approval: {
      required: true,
      noChangesApplied: true,
      summary: `Dove can freeze ${envelope.reviewedArtifacts.length} current artifact${envelope.reviewedArtifacts.length === 1 ? "" : "s"} for independent review.`,
      effects: [
        "Freeze the selected current artifact set for review.",
        "Create only the review input package and its integrity record.",
        "Keep writer and reviewer private transcripts outside the exchange."
      ],
      question: "Prepare this independent review exchange?"
    }
  };
}
function assertApprovedReviewPreparation(root, prepared, approvedProposal) {
  if (!approvedProposal || typeof approvedProposal !== "object" || Array.isArray(approvedProposal)) {
    throw new Error("Review exchange preparation requires the approved in-memory proposal.");
  }
  const current = reviewPreparationProposal(root, prepared);
  if (approvedProposal.proposalDigest !== current.proposalDigest || approvedProposal.proposalWorkspace !== current.envelope.workspace) {
    throw new Error("The approved review exchange no longer matches the current workspace, mission, scope, or artifact snapshots. Request fresh approval.");
  }
}
function newExchangeId(policy) {
  return domainSafeId(`exchange-${policy}-${crypto8.randomUUID()}`, "exchangeId");
}
function preflightResult(prepared) {
  return {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    status: "ready",
    zeroWrite: true,
    missionId: prepared.mission.missionId,
    contractDigest: prepared.mission.contractDigest,
    policy: prepared.policy,
    inputBoundary: policyInputBoundary(prepared.policy),
    scopeSha256: prepared.scope.sha256,
    artifactPaths: prepared.paths.artifactPaths,
    finalPlanPaths: prepared.paths.finalPlanPaths,
    finalResultPaths: prepared.paths.finalResultPaths,
    reviewedArtifactPaths: prepared.snapshot.reviewedArtifacts.map((item) => item.path),
    reviewedArtifacts: prepared.snapshot.reviewedArtifacts,
    reviewedArtifactSetSha256: prepared.snapshot.reviewedArtifactSetSha256,
    operation: "preflight",
    nextAction: {
      command: 'node ./bin/dove-package.mjs review . --mission-id "<mission id>" --policy "<review policy>" --artifact "<artifact path>" --prepare --mutation-mode direct-process --json',
      mcpTool: "prepare_review_exchange"
    },
    authority: { authoritative: false, callerMayMintAuthority: false, reason: "Local preflight is read-only and non-authoritative." }
  };
}
function prepareReviewExchange(root, args2 = {}, options = {}) {
  assertSealedDomainArgs(args2, PREPARE_FIELDS, "prepare_review_exchange");
  const prepared = reviewPreflight(root, args2, "Review exchange preparation");
  if (prepared.policy === "local-preflight") return preflightResult(prepared);
  if (options.approvedProposal !== void 0) assertApprovedReviewPreparation(root, prepared, options.approvedProposal);
  const exchangeId = newExchangeId(prepared.policy);
  const inputPath = exchangePath(exchangeId, "input.json");
  const manifestPath = exchangePath(exchangeId, "manifest.json");
  const handoffPath = exchangePath(exchangeId, "handoff.json");
  const reportPath = exchangePath(exchangeId, "report.md");
  const exchangeConsumptionPath = consumptionPath(exchangeId);
  const packageRoot = artifactPackagePath(exchangeId);
  const artifactPackage = prepared.policy === "isolated-selected-artifacts" ? buildArtifactPackage(root, exchangeId, prepared.snapshot.reviewedArtifacts) : { packageArtifacts: [], packageArtifactSetSha256: null, writes: [] };
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const preparationReceiptId = domainSafeId(`receipt-prepare-review-exchange-${crypto8.randomUUID()}`, "preparationReceiptId");
  const input = {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    workspaceId: prepared.workspace.manifest.workspaceId,
    missionId: prepared.mission.missionId,
    contractDigest: prepared.mission.contractDigest,
    exchangeId,
    createdAt,
    policy: prepared.policy,
    inputBoundary: policyInputBoundary(prepared.policy),
    scopeSha256: prepared.scope.sha256,
    preparationReceiptId,
    artifactPaths: prepared.paths.artifactPaths,
    finalPlanPaths: prepared.paths.finalPlanPaths,
    finalResultPaths: prepared.paths.finalResultPaths,
    reviewedArtifactPaths: prepared.snapshot.reviewedArtifacts.map((item) => item.path),
    reviewedArtifacts: prepared.snapshot.reviewedArtifacts,
    reviewedArtifactSetSha256: prepared.snapshot.reviewedArtifactSetSha256,
    packageArtifacts: artifactPackage.packageArtifacts,
    packageArtifactSetSha256: artifactPackage.packageArtifactSetSha256,
    outputContract: {
      handoffPath,
      reportPath,
      requiredHandoffFields: [...HANDOFF_FIELDS],
      actionableReturn: {
        completedVerdicts: ["coherent", "needs-revision", "needs-evidence"],
        blockedVerdict: "blocked",
        findingLinkedArtifactMinimum: 1,
        actionItemsRequiredFor: ["needs-revision", "needs-evidence"]
      }
    },
    privacyBoundary: {
      writerPrivateTranscriptShared: false,
      reviewerPrivateTranscriptShouldReturn: false,
      undeclaredContextShared: false,
      acceptedReturnArtifacts: [handoffPath, reportPath]
    }
  };
  const inputContent = domainJson(input);
  const manifest = {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    workspaceId: prepared.workspace.manifest.workspaceId,
    missionId: prepared.mission.missionId,
    contractDigest: prepared.mission.contractDigest,
    exchangeId,
    status: "prepared",
    createdAt,
    policy: prepared.policy,
    inputBoundary: policyInputBoundary(prepared.policy),
    scopeSha256: prepared.scope.sha256,
    preparationReceiptId,
    inputPath,
    inputSha256: domainSha256(inputContent),
    handoffPath,
    reportPath,
    consumptionPath: exchangeConsumptionPath,
    artifactPackagePath: packageRoot,
    artifactPaths: input.artifactPaths,
    finalPlanPaths: input.finalPlanPaths,
    finalResultPaths: input.finalResultPaths,
    reviewedArtifactPaths: input.reviewedArtifactPaths,
    reviewedArtifacts: input.reviewedArtifacts,
    reviewedArtifactSetSha256: input.reviewedArtifactSetSha256,
    packageArtifacts: input.packageArtifacts,
    packageArtifactSetSha256: input.packageArtifactSetSha256
  };
  const manifestContent = domainJson(manifest);
  const result = finalizeDomainArtifacts(root, {
    actionId: "prepare-review-exchange",
    receiptId: preparationReceiptId,
    operation: "Review exchange preparation",
    missionId: prepared.mission.missionId,
    summary: `Prepared ${prepared.policy} review exchange ${exchangeId}.`,
    writes: [
      ...artifactPackage.writes,
      { path: inputPath, kind: "data", content: inputContent, derivedReferences: [...input.reviewedArtifactPaths.map((item) => `artifact:${item}`), ...artifactPackage.packageArtifacts.map((item) => `artifact:${item.packagePath}`)] },
      { path: manifestPath, kind: "data", content: manifestContent, derivedReferences: [`artifact:${inputPath}`, ...artifactPackage.packageArtifacts.map((item) => `artifact:${item.packagePath}`)] }
    ]
  });
  return {
    ...result,
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    status: result.status === "planned" ? "prepare-planned" : "prepared",
    exchangeId,
    policy: prepared.policy,
    scopeSha256: prepared.scope.sha256,
    preparationReceiptId,
    inputPath,
    inputSha256: manifest.inputSha256,
    manifestPath,
    manifestSha256: domainSha256(manifestContent),
    handoffPath,
    reportPath,
    consumptionPath: exchangeConsumptionPath,
    artifactPackagePath: packageRoot,
    packageArtifacts: artifactPackage.packageArtifacts,
    packageArtifactSetSha256: artifactPackage.packageArtifactSetSha256,
    reviewedArtifactPaths: input.reviewedArtifactPaths,
    reviewedArtifactSetSha256: input.reviewedArtifactSetSha256,
    operation: "prepare",
    actionablePaths: {
      input: { path: inputPath, sha256: manifest.inputSha256, role: "review-input" },
      manifest: { path: manifestPath, sha256: domainSha256(manifestContent), role: "review-manifest" },
      handoff: { path: handoffPath, sha256: null, role: "reviewer-return-handoff" },
      report: { path: reportPath, sha256: null, role: "reviewer-return-report" }
    },
    importAction: {
      command: `node ./bin/dove-package.mjs review . --mission-id "${prepared.mission.missionId}" --exchange-id "${exchangeId}" --review-id "<review id>" --import --mutation-mode direct-process --json`,
      mcpTool: "import_review_exchange"
    },
    authority: { authoritative: false, callerMayMintAuthority: false }
  };
}
function assertIdentity(value2, manifest, mission, workspaceId, label) {
  if (value2.schemaVersion !== REVIEW_EXCHANGE_SCHEMA_VERSION) throw new Error(`${label}.schemaVersion must be ${REVIEW_EXCHANGE_SCHEMA_VERSION}.`);
  if (value2.workspaceId !== workspaceId || value2.workspaceId !== manifest.workspaceId) throw new Error(`${label} workspace binding mismatch.`);
  if (value2.missionId !== mission.missionId || value2.missionId !== manifest.missionId) throw new Error(`${label} mission binding mismatch.`);
  if (value2.contractDigest !== mission.contractDigest || value2.contractDigest !== manifest.contractDigest) throw new Error(`${label} contract digest is stale.`);
  if (value2.exchangeId !== manifest.exchangeId) throw new Error(`${label} exchangeId mismatch.`);
  if (value2.policy !== manifest.policy) throw new Error(`${label} policy binding mismatch.`);
  if (value2.scopeSha256 !== manifest.scopeSha256) throw new Error(`${label} scope binding mismatch.`);
}
function same(value2, expected) {
  return JSON.stringify(value2) === JSON.stringify(expected);
}
function assertPreparationReceipt(workspace, mission, manifestLeaf, inputLeaf, manifestPath, inputPath, packageArtifacts) {
  const expected = new Map([
    [inputPath, inputLeaf.sha256],
    [manifestPath, manifestLeaf.sha256],
    ...packageArtifacts.map((item) => [item.packagePath, item.packageSha256])
  ]);
  const receipt = workspace.receiptLedger.receipts.find((item) => {
    if (item.producer?.kind !== "dove-internal" || item.producer?.actionId !== "prepare-review-exchange") return false;
    const artifacts = new Map(item.artifacts.map((artifact) => [artifact.path, artifact]));
    return artifacts.size === expected.size && [...expected].every(([artifactPath, sha2567]) => artifacts.get(artifactPath)?.sha256 === sha2567);
  });
  if (!receipt) throw new Error("Review exchange preparation receipt does not own the exact immutable input, manifest, and package artifact paths and hashes.");
  if (receipt.missionId !== mission.missionId || receipt.contractDigest !== mission.contractDigest) throw new Error("Review exchange preparation receipt mission binding mismatch.");
  return receipt;
}
function assertPreparedScope(manifest, input) {
  const policy = normalizedPolicy(manifest.policy);
  if (policy === "local-preflight") throw new Error("local-preflight cannot create an importable exchange.");
  const expectedInputBoundary = policyInputBoundary(policy);
  if (manifest.inputBoundary !== expectedInputBoundary || input.inputBoundary !== expectedInputBoundary) throw new Error("Review exchange policy input boundary drifted.");
  const fields = ["artifactPaths", "finalPlanPaths", "finalResultPaths", "reviewedArtifactPaths"];
  for (const field of fields) if (!same(manifest[field], input[field])) throw new Error(`Review exchange ${field} drifted between manifest and input.`);
  const paths = normalizePolicyPaths(input, policy);
  if (!same(paths.reviewedArtifactPaths, input.reviewedArtifactPaths)) throw new Error("Review exchange policy scope no longer equals the exact reviewed artifact set.");
  const scope = policyScope(policy, paths);
  if (scope.sha256 !== manifest.scopeSha256 || scope.sha256 !== input.scopeSha256) throw new Error("Review exchange scope hash drifted.");
}
function finalizeReviewImport(root, options) {
  assertGovernanceMutationRegistered("import-review-exchange", "guarded");
  const context = currentMutationContext(root);
  if (!context) throw new Error("import-review-exchange requires an active MutationContext.");
  context.requireCommitPrecondition(ARTIFACT_PATHS.executionReceiptsDir);
  context.requireCommitLock(".dove/.receipt-ledger-append.lock", { label: "Execution receipt ledger append lock" });
  const writes = options.writes.map((item) => {
    const content = Buffer.isBuffer(item.content) ? Buffer.from(item.content) : Buffer.from(String(item.content ?? ""), "utf8");
    if (content.byteLength === 0) throw new Error(`import-review-exchange write ${item.path} must be non-empty.`);
    context.resolve(item.path);
    if (context.fileExists(item.path)) throw new Error(`import-review-exchange refuses to overwrite ${item.path}.`);
    return { ...item, content, sha256: domainSha256(content) };
  });
  const recordedAt = nowIso();
  const receiptArtifacts = [
    ...(options.receiptArtifacts ?? []).map((item) => ({ ...item, derivedReferences: item.derivedReferences ?? [] })),
    ...writes.map((item) => ({ path: item.path, kind: item.kind, sha256: item.sha256, derivedReferences: item.derivedReferences ?? [] }))
  ];
  const duplicateReceiptPath = receiptArtifacts.map((item) => item.path).find((item, index, items) => items.indexOf(item) !== index);
  if (duplicateReceiptPath) throw new Error(`import-review-exchange receipt contains duplicate artifact path ${duplicateReceiptPath}.`);
  const baseReceipt = {
    schemaVersion: EXECUTION_RECEIPT_SCHEMA_VERSION,
    workspaceId: options.workspace.manifest.workspaceId,
    receiptId: options.receiptId,
    ledgerSequence: options.workspace.receiptLedger.nextLedgerSequence,
    missionId: options.mission.missionId,
    contractDigest: options.mission.contractDigest,
    summary: domainNonEmptyText(options.summary, "summary"),
    artifacts: receiptArtifacts.map(({ path: artifactPath, kind, sha256: sha2567 }) => ({ path: artifactPath, kind, sha256: sha2567 })),
    validations: [],
    criteriaSatisfied: [],
    producedAt: recordedAt,
    recordedAt,
    producer: { kind: "dove-internal", actionId: "import-review-exchange" }
  };
  const receipt = { ...baseReceipt, artifacts: deriveArtifactReferences(baseReceipt, new Map(receiptArtifacts.map((item) => [item.path, item.derivedReferences]))) };
  assertReceiptAppendable(options.workspace.receiptLedger, receipt, { missionGraph: options.workspace.missionGraph });
  for (const item of writes) {
    if (Buffer.isBuffer(item.content) && !isPatchPlanMode(root)) context.writeBinary(item.path, item.content);
    else context.writeText(item.path, item.content.toString("utf8"));
  }
  const receiptPath = path16.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receipt.receiptId}.json`);
  if (context.fileExists(receiptPath)) throw new Error(`Generated execution receipt id is occupied: ${receipt.receiptId}.`);
  writeJson(root, receiptPath, receipt);
  const plannedOnly = isPatchPlanMode(root);
  return {
    status: plannedOnly ? "planned" : "recorded",
    missionId: options.mission.missionId,
    contractDigest: options.mission.contractDigest,
    receipt,
    artifacts: baseReceipt.artifacts,
    completionEligible: false,
    mutation: {
      mutationMode: context.mutationMode,
      writesApplied: !plannedOnly,
      paths: [...writes.map((item) => item.path), receiptPath]
    }
  };
}
function normalizeFindings(items, reviewedArtifactPaths) {
  if (!Array.isArray(items)) throw new Error("Review handoff findings must be an array.");
  const reviewed = new Set(reviewedArtifactPaths);
  const seen = /* @__PURE__ */ new Set();
  return items.map((item, index) => {
    sealed(item, FINDING_FIELDS, `Review handoff findings[${index}]`);
    const findingId = domainSafeId(item.findingId, `findings[${index}].findingId`);
    if (seen.has(findingId)) throw new Error(`Review handoff contains duplicate findingId ${findingId}.`);
    seen.add(findingId);
    const severity = domainNonEmptyText(item.severity, `findings[${index}].severity`).toLowerCase();
    if (!["low", "medium", "high"].includes(severity)) throw new Error(`findings[${index}].severity must be low, medium, or high.`);
    const linkedArtifactPaths = domainStringArray(item.linkedArtifactPaths, `findings[${index}].linkedArtifactPaths`, { minItems: 1 });
    if (linkedArtifactPaths.some((artifactPath) => !reviewed.has(artifactPath))) throw new Error(`findings[${index}] links an artifact outside the frozen review set.`);
    return { findingId, severity, summary: domainNonEmptyText(item.summary, `findings[${index}].summary`), linkedArtifactPaths };
  });
}
function importReviewExchange(root, args2 = {}) {
  assertSealedDomainArgs(args2, IMPORT_FIELDS, "import_review_exchange");
  const { workspace, mission } = readCurrentMission(root, args2.missionId, "Review exchange import");
  assertMissionAcceptsWrites(workspace, mission);
  const exchangeId = domainSafeId(args2.exchangeId, "exchangeId");
  const reviewId = domainSafeId(args2.reviewId, "reviewId");
  const inputPath = exchangePath(exchangeId, "input.json");
  const manifestPath = exchangePath(exchangeId, "manifest.json");
  const handoffPath = exchangePath(exchangeId, "handoff.json");
  const reportPath = exchangePath(exchangeId, "report.md");
  const exchangeConsumptionPath = consumptionPath(exchangeId);
  const reviewPath = importedReviewPath(reviewId);
  const finalReportPath = importedReportPath(reviewId);
  const context = currentMutationContext(root);
  if (!context) throw new Error("import_review_exchange requires an active MutationContext.");
  context.requireCommitLock(exchangeLockPath(exchangeId), { label: "Review exchange import lock" });
  if (context.fileExists(exchangeConsumptionPath)) throw new Error(`Review exchange ${exchangeId} has already been consumed.`);
  if (context.fileExists(reviewPath) || context.fileExists(finalReportPath)) throw new Error(`Review ${reviewId} has already been imported.`);
  const manifestLeaf = currentCanonicalLeaf(root, manifestPath, "Review exchange manifest");
  let manifest;
  try {
    manifest = sealed(JSON.parse(manifestLeaf.content.toString("utf8")), MANIFEST_FIELDS2, "Review exchange manifest");
  } catch (error) {
    throw new Error(`Review exchange manifest is malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (manifest.status !== "prepared") throw new Error(`Review exchange ${exchangeId} is not importable from status ${manifest.status ?? "unknown"}.`);
  domainSafeId(manifest.preparationReceiptId, "manifest.preparationReceiptId");
  if (manifest.exchangeId !== exchangeId) throw new Error("Review exchange manifest exchangeId mismatch.");
  assertIdentity(manifest, manifest, mission, workspace.manifest.workspaceId, "Review exchange manifest");
  if (manifest.inputPath !== inputPath || manifest.handoffPath !== handoffPath || manifest.reportPath !== reportPath || manifest.consumptionPath !== exchangeConsumptionPath) throw new Error("Review exchange manifest contains noncanonical exchange paths.");
  exactHash(manifest.inputSha256, "manifest.inputSha256");
  const inputLeaf = currentCanonicalLeaf(root, inputPath, "Review exchange input");
  let input;
  try {
    input = sealed(JSON.parse(inputLeaf.content.toString("utf8")), INPUT_FIELDS, "Review exchange input");
  } catch (error) {
    throw new Error(`Review exchange input is malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
  assertIdentity(input, manifest, mission, workspace.manifest.workspaceId, "Review exchange input");
  domainSafeId(input.preparationReceiptId, "input.preparationReceiptId");
  if (inputLeaf.sha256 !== manifest.inputSha256) throw new Error("Review exchange input hash does not match the prepared manifest.");
  if (input.outputContract?.handoffPath !== handoffPath || input.outputContract?.reportPath !== reportPath) throw new Error("Review exchange input output contract is noncanonical.");
  if (!same(input.outputContract?.requiredHandoffFields, [...HANDOFF_FIELDS])) throw new Error("Review exchange handoff contract drifted.");
  if (!same(input.outputContract?.actionableReturn, {
    completedVerdicts: ["coherent", "needs-revision", "needs-evidence"],
    blockedVerdict: "blocked",
    findingLinkedArtifactMinimum: 1,
    actionItemsRequiredFor: ["needs-revision", "needs-evidence"]
  })) throw new Error("Review exchange actionable return contract drifted.");
  if (input.privacyBoundary?.writerPrivateTranscriptShared !== false || input.privacyBoundary?.reviewerPrivateTranscriptShouldReturn !== false || input.privacyBoundary?.undeclaredContextShared !== false) throw new Error("Review exchange privacy boundary is invalid.");
  assertPreparedScope(manifest, input);
  const manifestSnapshots = normalizeReviewSnapshots(manifest.reviewedArtifacts, "manifest.reviewedArtifacts");
  const inputSnapshots = normalizeReviewSnapshots(input.reviewedArtifacts, "input.reviewedArtifacts");
  if (!manifestSnapshots.ok || !inputSnapshots.ok || !same(manifestSnapshots.snapshots, inputSnapshots.snapshots)) throw new Error("Review exchange artifact snapshot contract drifted.");
  const exactSetHash = stableSnapshotSetHash(manifestSnapshots.snapshots);
  if (manifest.reviewedArtifactSetSha256 !== exactSetHash || input.reviewedArtifactSetSha256 !== exactSetHash) throw new Error("Review exchange artifact-set hash drifted.");
  if (!same(manifest.reviewedArtifactPaths, manifestSnapshots.snapshots.map((item) => item.path))) throw new Error("Review exchange artifact paths do not equal the exact frozen snapshot set.");
  const snapshotVerification = verifyReviewSnapshotSet(root, manifestSnapshots.snapshots, exactSetHash);
  if (!snapshotVerification.ok) throw new Error(`Review exchange artifacts changed before import: ${snapshotVerification.failures.join(", ")}.`);
  const ownershipByPath = new Map(workspace.receiptLedger.currentOwnership.map((item) => [item.path, item]));
  for (const snapshot of manifestSnapshots.snapshots) {
    const owner = ownershipByPath.get(snapshot.path);
    if (!owner || owner.missionId !== mission.missionId || owner.contractDigest !== mission.contractDigest || owner.sha256 !== snapshot.sha256) {
      throw new Error(`Review exchange source ownership is not current for ${snapshot.path}.`);
    }
  }
  const packageBinding = assertPackageBindings(root, exchangeId, manifestSnapshots.snapshots, manifest, input, ownershipByPath);
  const preparationReceipt = assertPreparationReceipt(workspace, mission, manifestLeaf, inputLeaf, manifestPath, inputPath, packageBinding.packageArtifacts);
  if (manifest.preparationReceiptId !== preparationReceipt.receiptId || input.preparationReceiptId !== preparationReceipt.receiptId) throw new Error("Review exchange preparation receipt anchor does not match the ledger owner.");
  const handoffLeaf = currentCanonicalLeaf(root, handoffPath, "Review exchange handoff");
  const reportLeaf = currentCanonicalLeaf(root, reportPath, "Review exchange report");
  const handoff = sealed(JSON.parse(handoffLeaf.content.toString("utf8")), HANDOFF_FIELDS, "Review exchange handoff");
  assertIdentity(handoff, manifest, mission, workspace.manifest.workspaceId, "Review exchange handoff");
  if (handoff.reviewId !== reviewId) throw new Error("Review exchange handoff reviewId mismatch.");
  if (!REVIEW_STATUSES.has(handoff.status)) throw new Error(`Review exchange handoff status is unsupported: ${handoff.status}.`);
  if (!REVIEW_VERDICTS.has(handoff.verdict)) throw new Error(`Review exchange handoff verdict is unsupported: ${handoff.verdict}.`);
  if (handoff.status === "completed" && handoff.verdict === "blocked") throw new Error("A completed review handoff must return coherent, needs-revision, or needs-evidence.");
  if (handoff.status !== "completed" && handoff.verdict !== "blocked") throw new Error("A blocked or failed review handoff must return verdict blocked.");
  if (handoff.inputPath !== inputPath || handoff.reportPath !== reportPath) throw new Error("Review exchange handoff paths do not match the canonical exchange.");
  if (exactHash(handoff.inputSha256, "handoff.inputSha256") !== inputLeaf.sha256) throw new Error("Review exchange handoff input hash mismatch.");
  if (exactHash(handoff.reportSha256, "handoff.reportSha256") !== reportLeaf.sha256) throw new Error("Review exchange report hash mismatch.");
  if (!same(handoff.reviewedArtifactPaths, manifest.reviewedArtifactPaths)) throw new Error("Review exchange handoff scope drifted from the exact frozen artifact set.");
  const findings = normalizeFindings(handoff.findings, manifest.reviewedArtifactPaths);
  const actionItems = domainStringArray(handoff.actionItems, "Review handoff actionItems");
  if (["needs-revision", "needs-evidence"].includes(handoff.verdict) && actionItems.length === 0) throw new Error(`Review handoff verdict ${handoff.verdict} requires at least one actionable action item.`);
  const importReceiptId = domainSafeId(`receipt-import-review-exchange-${crypto8.randomUUID()}`, "importReceiptId");
  const consumedAt = nowIso();
  const consumption = {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    exchangeId,
    reviewId,
    preparationReceiptId: preparationReceipt.receiptId,
    importReceiptId,
    consumedAt
  };
  sealed(consumption, CONSUMPTION_FIELDS, "Review exchange consumption");
  const consumptionContent = domainJson(consumption);
  const consumptionSha256 = domainSha256(consumptionContent);
  const review = {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    exchangeId,
    reviewId,
    policy: manifest.policy,
    scopeSha256: manifest.scopeSha256,
    status: handoff.status,
    verdict: handoff.verdict,
    reviewerId: domainNonEmptyText(handoff.reviewerId, "reviewerId"),
    summary: domainNonEmptyText(handoff.summary, "summary"),
    reviewedAt: exactTimestamp2(handoff.reviewedAt, "reviewedAt"),
    reviewedArtifactPaths: manifest.reviewedArtifactPaths,
    reviewedArtifacts: manifestSnapshots.snapshots,
    reviewedArtifactSetSha256: exactSetHash,
    packageArtifacts: packageBinding.packageArtifacts,
    packageArtifactSetSha256: packageBinding.packageArtifactSetSha256,
    findings,
    actionItems,
    preparationReceiptId: preparationReceipt.receiptId,
    importReceiptId,
    exchange: {
      manifestPath,
      manifestSha256: manifestLeaf.sha256,
      inputPath,
      inputSha256: inputLeaf.sha256,
      handoffPath,
      handoffSha256: handoffLeaf.sha256,
      reportPath,
      reportSha256: reportLeaf.sha256,
      consumptionPath: exchangeConsumptionPath,
      consumptionSha256,
      importedReportPath: finalReportPath,
      importedReportSha256: reportLeaf.sha256
    },
    authority: {
      authoritative: false,
      callerMayMintAuthority: false,
      issuer: null,
      reason: "No trusted Reviewer issuer is connected; public handoff, reviewerId, verdict, and report material are non-authoritative."
    },
    privateTranscriptImported: false
  };
  const result = finalizeReviewImport(root, {
    workspace,
    mission,
    receiptId: importReceiptId,
    summary: `Imported non-authoritative review ${reviewId} from exchange ${exchangeId}.`,
    receiptArtifacts: [
      { path: handoffPath, kind: "data", sha256: handoffLeaf.sha256, derivedReferences: [`artifact:${inputPath}`] },
      { path: reportPath, kind: "report", sha256: reportLeaf.sha256, derivedReferences: review.reviewedArtifactPaths.map((item) => `artifact:${item}`) }
    ],
    writes: [
      { path: exchangeConsumptionPath, kind: "data", content: consumptionContent, derivedReferences: [`artifact:${manifestPath}`, `artifact:${inputPath}`] },
      { path: finalReportPath, kind: "report", content: reportLeaf.content, derivedReferences: review.reviewedArtifactPaths.map((item) => `artifact:${item}`) },
      { path: reviewPath, kind: "data", content: domainJson(review), derivedReferences: [`artifact:${exchangeConsumptionPath}`, `artifact:${handoffPath}`, `artifact:${reportPath}`, `artifact:${finalReportPath}`, ...review.reviewedArtifactPaths.map((item) => `artifact:${item}`)] }
    ]
  });
  return {
    ...result,
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    status: result.status === "planned" ? "import-planned" : "imported",
    exchangeId,
    reviewId,
    review,
    reviewPath,
    reportPath: finalReportPath,
    operation: "import",
    actionablePaths: {
      input: { path: inputPath, sha256: inputLeaf.sha256, role: "review-input" },
      manifest: { path: manifestPath, sha256: manifestLeaf.sha256, role: "review-manifest" },
      handoff: { path: handoffPath, sha256: handoffLeaf.sha256, role: "reviewer-return-handoff" },
      report: { path: finalReportPath, sha256: reportLeaf.sha256, role: "imported-review-report" },
      consumption: { path: exchangeConsumptionPath, sha256: consumptionSha256, role: "review-exchange-consumption" },
      review: { path: reviewPath, sha256: result.artifacts?.find((item) => item.path === reviewPath)?.sha256 ?? null, role: "imported-review-record" }
    },
    nextAction: {
      command: `node ./bin/dove-package.mjs review . --mission-id "${mission.missionId}" --artifact "<reviewed artifact path>" --verify-coverage --json`,
      mcpTool: "verify_review_coverage"
    },
    authoritative: false,
    privateTranscriptImported: false
  };
}
function currentHash(root, relativePath, expectedHash, label) {
  try {
    const leaf = currentCanonicalLeaf(root, relativePath, label);
    return { current: leaf.sha256 === expectedHash, actualSha256: leaf.sha256, reason: leaf.sha256 === expectedHash ? null : "hash-mismatch" };
  } catch (error) {
    return { current: false, actualSha256: null, reason: error instanceof Error ? error.message : String(error) };
  }
}
function readImportedReviews(root, missionId) {
  const directory = path16.resolve(root, ".dove/reviews");
  if (!fs14.existsSync(directory)) return [];
  return fs14.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => {
    const reviewPath = path16.posix.join(".dove/reviews", entry.name);
    try {
      const review = sealed(JSON.parse(fs14.readFileSync(path16.resolve(root, reviewPath), "utf8")), IMPORTED_REVIEW_FIELDS, `Imported review ${reviewPath}`);
      return review.missionId === missionId ? { reviewPath, review } : null;
    } catch (error) {
      return { reviewPath, review: null, readFailure: error instanceof Error ? error.message : String(error) };
    }
  }).filter(Boolean);
}
function requestedCoverageSnapshot(root, missionId, requestedPaths) {
  if (requestedPaths.length === 0) return { snapshot: null, failures: [] };
  try {
    return {
      snapshot: resolveReviewArtifactSnapshots(root, missionId, requestedPaths, "review coverage artifacts"),
      failures: []
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/is not a usable file .*path does not exist|is not a registered schema 9 artifact|has changed since its latest ownership receipt/u.test(message)) {
      return { snapshot: null, failures: [`requested-artifact-unavailable:${message}`] };
    }
    throw error;
  }
}
function normalizeExpectedCoverageSnapshots(value2) {
  if (value2 === void 0) return null;
  const normalized = normalizeReviewSnapshots(value2, "expectedSnapshots");
  if (!normalized.ok) throw new Error(normalized.reason);
  return {
    reviewedArtifacts: normalized.snapshots,
    reviewedArtifactSetSha256: stableSnapshotSetHash(normalized.snapshots)
  };
}
function receiptArtifactMap(receipt) {
  return new Map(Array.isArray(receipt?.artifacts) ? receipt.artifacts.map((artifact) => [artifact.path, artifact]) : []);
}
function assessImportedReview(root, workspace, mission, { reviewPath, review, readFailure }, requestedSnapshot) {
  const failures = [];
  if (readFailure || !review) return { reviewId: null, reviewPath, current: false, authoritative: false, failures: [readFailure ?? "review-unreadable"] };
  if (review.schemaVersion !== REVIEW_EXCHANGE_SCHEMA_VERSION) {
    return { reviewId: review.reviewId ?? null, reviewPath, current: false, authoritative: false, failures: ["review-schema-invalid"] };
  }
  if (review.contractDigest !== mission.contractDigest) failures.push("contract-digest-stale");
  if (!POLICY_SET.has(review.policy) || review.policy === "local-preflight") failures.push("review-policy-invalid");
  if (review.status !== "completed") failures.push(`review-status-ineligible:${review.status ?? "unknown"}`);
  if (!["coherent", "needs-revision", "needs-evidence"].includes(review.verdict)) failures.push(`review-verdict-ineligible:${review.verdict ?? "unknown"}`);
  const snapshots = normalizeReviewSnapshots(review.reviewedArtifacts, "review.reviewedArtifacts");
  if (!snapshots.ok) failures.push(snapshots.reason);
  const setHash = snapshots.ok ? stableSnapshotSetHash(snapshots.snapshots) : null;
  if (!setHash || review.reviewedArtifactSetSha256 !== setHash || !same(review.reviewedArtifactPaths, snapshots.snapshots.map((item) => item.path))) failures.push("reviewed-artifact-set-hash-mismatch");
  if (snapshots.ok) failures.push(...verifyReviewSnapshotSet(root, snapshots.snapshots, setHash).failures);
  if (requestedSnapshot && (!snapshots.ok || !same(requestedSnapshot.reviewedArtifacts, snapshots.snapshots))) failures.push("requested-artifact-set-not-exactly-covered");
  const importReceipt = workspace.receiptLedger.receipts.find((receipt) => receipt.receiptId === review.importReceiptId);
  const preparationReceipt = workspace.receiptLedger.receipts.find((receipt) => receipt.receiptId === review.preparationReceiptId);
  if (importReceipt?.producer?.kind !== "dove-internal" || importReceipt?.producer?.actionId !== "import-review-exchange") failures.push("import-review-receipt-missing");
  if (preparationReceipt?.producer?.kind !== "dove-internal" || preparationReceipt?.producer?.actionId !== "prepare-review-exchange") failures.push("preparation-review-receipt-missing");
  if (importReceipt && (importReceipt.missionId !== mission.missionId || importReceipt.contractDigest !== mission.contractDigest)) failures.push("import-review-receipt-binding-mismatch");
  if (preparationReceipt && (preparationReceipt.missionId !== mission.missionId || preparationReceipt.contractDigest !== mission.contractDigest)) failures.push("preparation-review-receipt-binding-mismatch");
  try {
    const exchange = sealed(review.exchange, EXCHANGE_HASH_FIELDS, `Imported review ${review.reviewId} exchange`);
    const importArtifacts = receiptArtifactMap(importReceipt);
    const preparationArtifacts = receiptArtifactMap(preparationReceipt);
    const reviewLeaf = currentHash(root, reviewPath, importArtifacts.get(reviewPath)?.sha256, "imported review record");
    if (!importArtifacts.has(reviewPath) || !reviewLeaf.current) failures.push("imported-review-receipt-hash-stale");
    if (importArtifacts.get(exchange.importedReportPath)?.sha256 !== exchange.importedReportSha256) failures.push("imported-report-receipt-hash-mismatch");
    if (preparationArtifacts.get(exchange.manifestPath)?.sha256 !== exchange.manifestSha256) failures.push("manifest-receipt-hash-mismatch");
    if (preparationArtifacts.get(exchange.inputPath)?.sha256 !== exchange.inputSha256) failures.push("input-receipt-hash-mismatch");
    if (importArtifacts.get(exchange.handoffPath)?.sha256 !== exchange.handoffSha256) failures.push("handoff-receipt-hash-mismatch");
    if (importArtifacts.get(exchange.reportPath)?.sha256 !== exchange.reportSha256) failures.push("exchange-report-receipt-hash-mismatch");
    if (importArtifacts.get(exchange.consumptionPath)?.sha256 !== exchange.consumptionSha256) failures.push("consumption-receipt-hash-mismatch");
    let manifest = null;
    let input = null;
    try {
      manifest = sealed(JSON.parse(fs14.readFileSync(path16.resolve(root, exchange.manifestPath), "utf8")), MANIFEST_FIELDS2, `Imported review ${review.reviewId} manifest`);
      input = sealed(JSON.parse(fs14.readFileSync(path16.resolve(root, exchange.inputPath), "utf8")), INPUT_FIELDS, `Imported review ${review.reviewId} input`);
    } catch (error) {
      failures.push(`prepared-review-control-invalid:${error instanceof Error ? error.message : String(error)}`);
    }
    if (manifest && input) {
      if (manifest.preparationReceiptId !== review.preparationReceiptId || input.preparationReceiptId !== review.preparationReceiptId) failures.push("preparation-receipt-anchor-mismatch");
      const preparedSnapshots = normalizeReviewSnapshots(manifest.reviewedArtifacts, "manifest.reviewedArtifacts");
      const inputSnapshots = normalizeReviewSnapshots(input.reviewedArtifacts, "input.reviewedArtifacts");
      if (!preparedSnapshots.ok || !inputSnapshots.ok || !same(preparedSnapshots.snapshots, inputSnapshots.snapshots)) failures.push("prepared-reviewed-artifact-set-invalid");
      else {
        const preparedSetHash = stableSnapshotSetHash(preparedSnapshots.snapshots);
        if (manifest.reviewedArtifactSetSha256 !== preparedSetHash || input.reviewedArtifactSetSha256 !== preparedSetHash) failures.push("prepared-reviewed-artifact-set-hash-mismatch");
        if (!same(review.reviewedArtifacts, preparedSnapshots.snapshots) || review.reviewedArtifactSetSha256 !== preparedSetHash || !same(review.reviewedArtifactPaths, preparedSnapshots.snapshots.map((item) => item.path))) failures.push("reviewed-set-not-receipt-anchored");
      }
    }
    for (const [pathField, hashField, label] of [
      ["manifestPath", "manifestSha256", "review manifest"],
      ["inputPath", "inputSha256", "review input"],
      ["handoffPath", "handoffSha256", "review handoff"],
      ["reportPath", "reportSha256", "review report"],
      ["importedReportPath", "importedReportSha256", "imported review report"]
    ]) {
      if (!HASH_PATTERN3.test(String(exchange[hashField] ?? ""))) failures.push(`${hashField}-invalid`);
      else if (!currentHash(root, exchange[pathField], exchange[hashField], label).current) failures.push(`${hashField}-stale`);
    }
  } catch (error) {
    failures.push(`review-exchange-invalid:${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    const authority = sealed(review.authority, AUTHORITY_FIELDS, `Imported review ${review.reviewId} authority`);
    if (authority.authoritative !== false || authority.callerMayMintAuthority !== false || authority.issuer !== null || typeof authority.reason !== "string" || !authority.reason.trim()) failures.push("public-review-authority-invalid");
  } catch (error) {
    failures.push(`public-review-authority-invalid:${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    reviewId: review.reviewId,
    exchangeId: review.exchangeId,
    reviewPath,
    policy: review.policy,
    verdict: review.verdict,
    current: failures.length === 0,
    authoritative: false,
    reviewedArtifactPaths: review.reviewedArtifactPaths,
    reviewedArtifactSetSha256: review.reviewedArtifactSetSha256,
    failures: [...new Set(failures)]
  };
}
function verifyReviewCoverageInput(root, args2, fields, operation) {
  assertSealedDomainArgs(args2, fields, operation);
  const { workspace, mission } = readCurrentMission(root, args2.missionId, "Review coverage verification");
  const requestedPaths = args2.artifactPaths === void 0 ? [] : domainStringArray(args2.artifactPaths, "artifactPaths");
  const expected = normalizeExpectedCoverageSnapshots(args2.expectedSnapshots);
  const requested = expected ? { snapshot: expected, failures: [] } : requestedCoverageSnapshot(root, mission.missionId, requestedPaths);
  const assessments = readImportedReviews(root, mission.missionId).map((item) => assessImportedReview(root, workspace, mission, item, requested.snapshot));
  const currentReviews = assessments.filter((item) => item.current);
  const failures = [...requested.failures];
  const exactCoverageRequested = requestedPaths.length > 0 || expected !== null;
  if (currentReviews.length === 0) failures.push(exactCoverageRequested ? "current-exact-review-coverage-missing" : "current-review-coverage-missing");
  if (args2.requireAuthoritative === true) failures.push("trusted-review-issuer-missing");
  return {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    status: failures.length === 0 ? "covered" : "not-covered",
    zeroWrite: true,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    requestedArtifactPaths: requested.snapshot?.reviewedArtifacts.map((item) => item.path) ?? requestedPaths,
    requestedArtifactSetSha256: requested.snapshot?.reviewedArtifactSetSha256 ?? null,
    covered: requested.failures.length === 0 && currentReviews.length > 0,
    authoritative: false,
    issuer: null,
    failures: [...new Set(failures)],
    reviews: assessments
  };
}
function verifyExpectedReviewCoverage(root, args2 = {}) {
  return verifyReviewCoverageInput(root, args2, EXPECTED_COVERAGE_FIELDS, "verify expected review coverage");
}
function verifyReviewCoverage(root, args2 = {}) {
  return verifyReviewCoverageInput(root, args2, COVERAGE_FIELDS, "verify_review_coverage");
}

// src/core/completion-gates.mjs
var HASH_PATTERN4 = /^[0-9a-f]{64}$/u;
var ARTIFACT_KINDS = /* @__PURE__ */ new Set(["report", "document", "code", "data", "figure", "media", "other"]);
var VALIDATION_KINDS = /* @__PURE__ */ new Set(["test-log", "typecheck-log", "lint-log", "build-log", "audit-log", "validation-log", "command-output"]);
var RECEIPT_FIELDS2 = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "receiptId", "ledgerSequence", "missionId", "contractDigest", "summary", "artifacts", "validations", "criteriaSatisfied", "producedAt", "recordedAt", "producer"]);
var ARTIFACT_FIELDS2 = /* @__PURE__ */ new Set(["path", "kind", "sha256", "derivedReferences"]);
var VALIDATION_FIELDS2 = /* @__PURE__ */ new Set(["kind", "reference", "outputHash"]);
var CRITERION_FIELDS2 = /* @__PURE__ */ new Set(["criterionId", "evidenceRefs", "evidenceBindings"]);
var EVIDENCE_BINDING_FIELDS2 = /* @__PURE__ */ new Set(["reference", "sha256", "receiptId"]);
function missionPath2(missionId) {
  return path17.posix.join(ARTIFACT_PATHS.missionsDir, `${missionId}.json`);
}
function sealed2(value2, allowed) {
  return value2 && typeof value2 === "object" && !Array.isArray(value2) && Object.keys(value2).every((key) => allowed.has(key));
}
function currentHashedFile(root, relativePath, expectedHash) {
  if (isDoveLessonArtifactPath(relativePath)) return { current: false, reason: "lesson-advisory-only", path: relativePath ?? null, actualHash: null };
  if (typeof relativePath !== "string" || !relativePath.trim() || !HASH_PATTERN4.test(String(expectedHash ?? ""))) {
    return { current: false, reason: "hashed-file-input-invalid", path: relativePath ?? null, actualHash: null };
  }
  try {
    const snapshot = snapshotArtifactBuffer(root, relativePath, `completion evidence ${relativePath}`);
    return {
      current: snapshot.sha256 === expectedHash,
      reason: snapshot.sha256 === expectedHash ? null : "hash-mismatch",
      path: snapshot.path,
      actualHash: snapshot.sha256,
      sizeBytes: snapshot.sizeBytes
    };
  } catch (error) {
    return { current: false, reason: error instanceof Error ? error.message : "path-invalid", path: relativePath, actualHash: null };
  }
}
function typedEvidenceEligibility(root, missionId, reference) {
  if (reference.startsWith("source:")) {
    const value2 = reference.slice("source:".length);
    const evaluation = evaluateSourceReferences(root, [value2], missionId)[0] ?? { eligible: false, reason: "unknown-source" };
    return { ...evaluation, evidenceSha256: evaluation.source?.capturedMaterial?.sha256 ?? null };
  }
  if (reference.startsWith("note:")) {
    const value2 = reference.slice("note:".length);
    const evaluation = evaluateNoteReferences(root, [value2], missionId)[0] ?? { eligible: false, reason: "unknown-note" };
    return { ...evaluation, evidenceSha256: evaluation.owner?.sha256 ?? null };
  }
  return { eligible: null, reason: null, evidenceSha256: null };
}
function assessArtifact(root, mission, artifact, currentOwnerByPath) {
  if (!sealed2(artifact, ARTIFACT_FIELDS2) || typeof artifact.path !== "string" || !artifact.path.trim() || !ARTIFACT_KINDS.has(artifact.kind) || !HASH_PATTERN4.test(String(artifact.sha256 ?? "")) || !Array.isArray(artifact.derivedReferences)) {
    return { path: artifact?.path ?? null, current: false, reason: "artifact-schema-invalid", ownerReceiptId: null, recordedSha256: artifact?.sha256 ?? null };
  }
  const owner = currentOwnerByPath.get(artifact.path);
  if (!owner || owner.missionId !== mission.missionId) {
    return { path: artifact.path, current: false, reason: owner ? "artifact-current-owner-mission-mismatch" : "artifact-current-owner-missing", ownerReceiptId: owner?.receiptId ?? null, recordedSha256: artifact.sha256 };
  }
  if (owner.sha256 !== artifact.sha256) {
    return { path: artifact.path, current: false, reason: "artifact-superseded", ownerReceiptId: owner.receiptId, recordedSha256: artifact.sha256, ownerSha256: owner.sha256 };
  }
  return { ...currentHashedFile(root, artifact.path, owner.sha256), ownerReceiptId: owner.receiptId, recordedSha256: artifact.sha256 };
}
function assessValidation(root, validation) {
  if (!sealed2(validation, VALIDATION_FIELDS2) || typeof validation.reference !== "string" || !validation.reference.trim() || !VALIDATION_KINDS.has(validation.kind) || !HASH_PATTERN4.test(String(validation.outputHash ?? ""))) {
    return { path: validation?.reference ?? null, current: false, reason: "validation-schema-invalid", recordedSha256: validation?.outputHash ?? null };
  }
  return { ...currentHashedFile(root, validation.reference, validation.outputHash), recordedSha256: validation.outputHash };
}
function criterionAssessment(root, mission, criterion, receipt, artifactAssessments, validationAssessments, currentOwnerByPath, requiredIds, seenCriteria) {
  const failures = [];
  if (!sealed2(criterion, CRITERION_FIELDS2)) failures.push("criterion-schema-invalid");
  if (!requiredIds.has(criterion?.criterionId)) failures.push("criterion-unknown");
  if (seenCriteria.has(criterion?.criterionId)) failures.push("criterion-duplicate");
  seenCriteria.add(criterion?.criterionId);
  const evidenceRefs = Array.isArray(criterion?.evidenceRefs) ? criterion.evidenceRefs : [];
  const evidenceBindings = Array.isArray(criterion?.evidenceBindings) ? criterion.evidenceBindings : [];
  if (evidenceRefs.length === 0 || evidenceRefs.some((reference) => typeof reference !== "string" || !reference.trim()) || new Set(evidenceRefs).size !== evidenceRefs.length) failures.push("criterion-evidence-invalid");
  if (evidenceBindings.length !== evidenceRefs.length || evidenceBindings.some((binding) => !sealed2(binding, EVIDENCE_BINDING_FIELDS2) || !evidenceRefs.includes(binding.reference) || !HASH_PATTERN4.test(String(binding.sha256 ?? "")) || typeof binding.receiptId !== "string" || !binding.receiptId) || new Set(evidenceBindings.map((binding) => binding.reference)).size !== evidenceBindings.length) {
    failures.push("criterion-evidence-binding-invalid");
  }
  const bindingByReference = new Map(evidenceBindings.map((binding) => [binding.reference, binding]));
  const receiptArtifactByPath = new Map((receipt.artifacts ?? []).map((artifact, index) => [artifact.path, artifactAssessments[index]]));
  const receiptValidationByPath = new Map((receipt.validations ?? []).map((validation, index) => [validation.reference, validationAssessments[index]]));
  const evidence = evidenceRefs.map((reference) => {
    const binding = bindingByReference.get(reference) ?? null;
    const boundSha256 = binding?.sha256 ?? null;
    const boundReceiptId = binding?.receiptId ?? null;
    if (reference.startsWith("artifact:")) {
      const artifactPath = reference.slice("artifact:".length);
      const owner = currentOwnerByPath.get(artifactPath);
      if (!owner) return { reference, boundSha256, eligible: false, reason: "artifact-current-owner-missing", contributingReceiptId: null };
      if (owner.missionId !== mission.missionId) return { reference, boundSha256, eligible: false, reason: "artifact-current-owner-mission-mismatch", contributingReceiptId: null };
      if (owner.sha256 !== boundSha256 || owner.receiptId !== boundReceiptId) return { reference, boundSha256, boundReceiptId, eligible: false, reason: "artifact-original-owner-superseded", contributingReceiptId: null };
      const current = currentHashedFile(root, artifactPath, owner.sha256);
      const declaration = receiptArtifactByPath.get(artifactPath);
      if (declaration && declaration.recordedSha256 !== boundSha256) return { reference, boundSha256, eligible: false, reason: "artifact-receipt-binding-mismatch", contributingReceiptId: null };
      return { reference, boundSha256, eligible: current.current, reason: current.current ? null : current.reason, contributingReceiptId: current.current ? owner.receiptId : null };
    }
    if (reference.startsWith("validation:")) {
      const validationPath = reference.slice("validation:".length);
      const declaration = receiptValidationByPath.get(validationPath);
      if (!declaration || declaration.recordedSha256 !== boundSha256 || boundReceiptId !== receipt.receiptId) return { reference, boundSha256, boundReceiptId, eligible: false, reason: "validation-receipt-binding-mismatch", contributingReceiptId: null };
      return { reference, boundSha256, eligible: declaration.current, reason: declaration.current ? null : declaration.reason, contributingReceiptId: declaration.current ? receipt.receiptId : null };
    }
    const typed = typedEvidenceEligibility(root, mission.missionId, reference);
    const currentTypedReceiptId = typed.owner?.receiptId ?? receipt.receiptId;
    const bound = HASH_PATTERN4.test(String(boundSha256 ?? "")) && typed.evidenceSha256 === boundSha256 && boundReceiptId === currentTypedReceiptId;
    return { reference, boundSha256, boundReceiptId, eligible: typed.eligible === true && bound, reason: typed.eligible !== true ? typed.reason ?? "unresolved-evidence-reference" : bound ? null : "typed-evidence-original-owner-superseded", contributingReceiptId: typed.eligible === true && bound ? currentTypedReceiptId : null };
  });
  if (evidence.some((item) => !item.eligible)) failures.push("criterion-evidence-stale-or-ineligible");
  return {
    criterionId: criterion?.criterionId ?? null,
    evidence,
    failures: [...new Set(failures)],
    satisfied: failures.length === 0,
    contributingReceiptIds: [...new Set(evidence.map((item) => item.contributingReceiptId).filter(Boolean))]
  };
}
function receiptAssessment(root, mission, receipt, workspaceId, currentOwnerByPath, missionCurrent = true) {
  const failures = [];
  if (!missionCurrent) failures.push("mission-contract-invalid");
  if (!sealed2(receipt, RECEIPT_FIELDS2) || receipt.schemaVersion !== 3) failures.push("receipt-schema-invalid");
  if (receipt.workspaceId !== workspaceId || mission.workspaceId !== workspaceId) failures.push("workspace-binding-mismatch");
  if (receipt.missionId !== mission.missionId) failures.push("mission-binding-mismatch");
  if (receipt?.contractDigest !== mission.contractDigest || !missionCurrent) failures.push("contract-digest-stale");
  if (!Array.isArray(receipt.artifacts)) failures.push("artifacts-invalid");
  if (!Array.isArray(receipt.validations)) failures.push("validations-invalid");
  if (!Array.isArray(receipt.criteriaSatisfied)) failures.push("criteria-invalid");
  if ((receipt.artifacts?.length ?? 0) + (receipt.validations?.length ?? 0) + (receipt.criteriaSatisfied?.length ?? 0) === 0) failures.push("progress-evidence-missing");
  const artifactAssessments = (Array.isArray(receipt.artifacts) ? receipt.artifacts : []).map((artifact) => assessArtifact(root, mission, artifact, currentOwnerByPath));
  const validationAssessments = (Array.isArray(receipt.validations) ? receipt.validations : []).map((validation) => assessValidation(root, validation));
  if (artifactAssessments.some((item) => !item.current)) failures.push("artifact-drift-or-superseded");
  if (validationAssessments.some((item) => !item.current)) failures.push("validation-drift");
  const artifactPaths = (receipt.artifacts ?? []).map((artifact) => artifact?.path).filter(Boolean);
  const validationPaths = (receipt.validations ?? []).map((validation) => validation?.reference).filter(Boolean);
  if (new Set(artifactPaths).size !== artifactPaths.length) failures.push("artifact-path-duplicate");
  if (new Set(validationPaths).size !== validationPaths.length) failures.push("validation-path-duplicate");
  const requiredIds = new Set(missionCompletionCriteria(mission).map((criterion) => criterion.criterionId));
  const seenCriteria = /* @__PURE__ */ new Set();
  const criteria = (Array.isArray(receipt.criteriaSatisfied) ? receipt.criteriaSatisfied : []).map((criterion) => criterionAssessment(root, mission, criterion, receipt, artifactAssessments, validationAssessments, currentOwnerByPath, requiredIds, seenCriteria));
  if (criteria.some((criterion) => !criterion.satisfied)) failures.push("criteria-evidence-invalid");
  const stale = failures.some((failure) => ["mission-contract-invalid", "contract-digest-stale", "artifact-drift-or-superseded", "validation-drift"].includes(failure)) || criteria.some((criterion) => criterion.failures.includes("criterion-evidence-stale-or-ineligible"));
  return {
    receiptId: receipt.receiptId ?? null,
    current: failures.length === 0,
    stale,
    failures: [...new Set(failures)],
    artifacts: artifactAssessments,
    validations: validationAssessments,
    criteria,
    producedAt: receipt.producedAt ?? null
  };
}
function artifactCoverageAssessment(root, mission, currentOwnerByPath) {
  const requiredPaths = [.../* @__PURE__ */ new Set([...mission.targetArtifacts ?? [], ...mission.expectedArtifacts ?? []])].sort();
  return requiredPaths.map((artifactPath) => {
    const owner = currentOwnerByPath.get(artifactPath) ?? null;
    if (!owner) return { path: artifactPath, covered: false, reason: "artifact-current-owner-missing", receiptId: null, sha256: null };
    if (owner.missionId !== mission.missionId) return { path: artifactPath, covered: false, reason: "artifact-current-owner-mission-mismatch", receiptId: owner.receiptId, sha256: owner.sha256 };
    const current = currentHashedFile(root, artifactPath, owner.sha256);
    return { path: artifactPath, covered: current.current, reason: current.current ? null : current.reason, receiptId: current.current ? owner.receiptId : null, sha256: owner.sha256 };
  });
}
function criterionCoverageAssessment(mission, receiptAssessments) {
  return missionCompletionCriteria(mission).map(({ criterionId, criterion }) => {
    const proofs = receiptAssessments.flatMap((receipt) => receipt.criteria.filter((item) => item.criterionId === criterionId && item.satisfied).map((item) => ({ receiptId: receipt.receiptId, evidence: item.evidence, contributingReceiptIds: [.../* @__PURE__ */ new Set([receipt.receiptId, ...item.contributingReceiptIds])] })));
    return { criterionId, criterion, covered: proofs.length > 0, contributingReceiptIds: [...new Set(proofs.flatMap((item) => item.contributingReceiptIds))], proofs };
  });
}
function evidenceRequirementAssessment(root, mission, receiptAssessments, artifactCoverage) {
  const requirements = missionEvidenceRequirements(mission);
  const artifactByReference = new Map(artifactCoverage.map((item) => [`artifact:${item.path}`, item]));
  const validationProofs = /* @__PURE__ */ new Map();
  for (const receipt of receiptAssessments) {
    for (const validation of receipt.validations) {
      if (validation.current) validationProofs.set(`validation:${validation.path}`, receipt.receiptId);
    }
  }
  return requirements.map(({ requirementId, requirement }) => {
    if (requirement === "review:authoritative") {
      const coverage = verifyReviewCoverage(root, { missionId: mission.missionId, requireAuthoritative: true });
      const satisfied = coverage.authoritative === true && coverage.failures.length === 0;
      return { requirementId, requirement, satisfied, reason: satisfied ? null : "authoritative-review-proof-missing", contributingReceiptIds: [] };
    }
    if (requirement.startsWith("source:") || requirement.startsWith("note:")) {
      const evaluation = typedEvidenceEligibility(root, mission.missionId, requirement);
      return { requirementId, requirement, satisfied: evaluation.eligible === true, reason: evaluation.eligible === true ? null : evaluation.reason, contributingReceiptIds: evaluation.eligible === true && evaluation.owner?.receiptId ? [evaluation.owner.receiptId] : [] };
    }
    if (requirement.startsWith("artifact:")) {
      const coverage = artifactByReference.get(requirement);
      return { requirementId, requirement, satisfied: coverage?.covered === true, reason: coverage?.covered === true ? null : coverage?.reason ?? "required-artifact-not-current", contributingReceiptIds: coverage?.covered ? [coverage.receiptId] : [] };
    }
    if (requirement.startsWith("validation:")) {
      const receiptId = validationProofs.get(requirement) ?? null;
      return { requirementId, requirement, satisfied: Boolean(receiptId), reason: receiptId ? null : "required-validation-not-current", contributingReceiptIds: receiptId ? [receiptId] : [] };
    }
    return { requirementId, requirement, satisfied: false, reason: "unsupported-evidence-requirement-syntax", contributingReceiptIds: [] };
  });
}
function assessMissionFromWorkspace(root, workspace, missionId, state2) {
  if (state2.memo.has(missionId)) return state2.memo.get(missionId);
  if (state2.visiting.has(missionId)) throw new Error(`Mission dependency assessment contains a cycle at ${missionId}.`);
  const mission = workspace.missions.get(missionId);
  if (!mission) throw new Error(`Mission does not exist: ${missionId}.`);
  state2.visiting.add(missionId);
  try {
    const relativePath = missionPath2(missionId);
    let missionContractFailure = null;
    try {
      assertCurrentMissionContract2(mission);
    } catch (error) {
      missionContractFailure = error instanceof Error ? error.message : String(error);
    }
    const receipts = workspace.receiptLedger.receipts.filter((receipt) => receipt.missionId === missionId);
    const receiptAssessments = receipts.map((receipt) => receiptAssessment(root, mission, receipt, workspace.manifest.workspaceId, state2.currentOwnerByPath, missionContractFailure === null));
    const artifactCoverage = artifactCoverageAssessment(root, mission, state2.currentOwnerByPath);
    const criterionCoverage = criterionCoverageAssessment(mission, receiptAssessments);
    const requirements = evidenceRequirementAssessment(root, mission, receiptAssessments, artifactCoverage);
    const dependencyCoverage = (workspace.missionGraph.dependenciesByMission.get(missionId) ?? []).map((dependencyMissionId) => {
      const assessment2 = assessMissionFromWorkspace(root, workspace, dependencyMissionId, state2);
      return {
        missionId: dependencyMissionId,
        status: assessment2.status,
        complete: assessment2.complete,
        supersededByMissionId: assessment2.supersededByMissionId,
        incompleteReasons: assessment2.incompleteReasons
      };
    });
    const supersededByMissionId = terminalSuccessorMissionId(workspace.missionGraph, missionId);
    const incompleteReasons = [];
    if (supersededByMissionId) incompleteReasons.push("mission-superseded");
    if (missionContractFailure) incompleteReasons.push("mission-contract-invalid");
    if (receipts.length === 0) incompleteReasons.push("execution-receipt-missing");
    if (artifactCoverage.some((item) => !item.covered)) incompleteReasons.push("mission-artifact-coverage-missing");
    if (criterionCoverage.some((item) => !item.covered)) incompleteReasons.push("criteria-coverage-missing");
    if (requirements.some((requirement) => !requirement.satisfied)) incompleteReasons.push("evidence-requirements-unmet");
    if (dependencyCoverage.some((dependency) => !dependency.complete)) incompleteReasons.push("mission-dependency-incomplete");
    const contributingReceiptIds = [...new Set([
      ...artifactCoverage.filter((item) => item.covered).map((item) => item.receiptId),
      ...criterionCoverage.flatMap((item) => item.contributingReceiptIds),
      ...requirements.flatMap((item) => item.contributingReceiptIds)
    ].filter(Boolean))].sort((left, right) => {
      const leftSequence = receipts.find((receipt) => receipt.receiptId === left)?.ledgerSequence ?? 0;
      const rightSequence = receipts.find((receipt) => receipt.receiptId === right)?.ledgerSequence ?? 0;
      return leftSequence - rightSequence;
    });
    if (receipts.length > 0 && contributingReceiptIds.length === 0 && !receiptAssessments.some((receipt) => receipt.current)) incompleteReasons.push("execution-receipts-stale-or-invalid");
    const assessment = {
      status: supersededByMissionId ? "superseded" : incompleteReasons.length === 0 ? "complete" : "incomplete",
      complete: incompleteReasons.length === 0,
      missionId,
      contractDigest: mission.contractDigest,
      supersededByMissionId,
      dependencyCoverage,
      contributingReceiptIds,
      artifactCoverage,
      criterionCoverage,
      receiptCount: receipts.length,
      staleReceiptIds: receiptAssessments.filter((receipt) => receipt.stale).map((receipt) => receipt.receiptId),
      receipts: receiptAssessments,
      completionCriteria: missionCompletionCriteria(mission),
      evidenceRequirements: requirements,
      incompleteReasons,
      diagnostics: {
        zeroWrite: true,
        missionContractFailure,
        missionPath: relativePath,
        receiptRoot: ARTIFACT_PATHS.executionReceiptsDir,
        artifactAuthority: "execution-receipt-ledger-current-ownership"
      }
    };
    state2.memo.set(missionId, assessment);
    return assessment;
  } finally {
    state2.visiting.delete(missionId);
  }
}
function assessMissionCompletion(root, args2 = {}) {
  if (!args2 || typeof args2 !== "object" || Array.isArray(args2)) throw new Error("assess_mission_completion arguments must be a plain object.");
  const unknown = Object.keys(args2).filter((field) => field !== "missionId");
  if (unknown.length > 0) throw new Error(`assess_mission_completion does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  const missionId = typeof args2.missionId === "string" ? args2.missionId.trim() : "";
  if (!missionId) throw new Error("assess_mission_completion requires missionId.");
  const workspace = openDoveWorkspace(root, { operation: "Mission completion assessment" });
  return assessMissionFromWorkspace(root, workspace, missionId, {
    memo: /* @__PURE__ */ new Map(),
    visiting: /* @__PURE__ */ new Set(),
    currentOwnerByPath: new Map(workspace.receiptLedger.currentOwnership.map((item) => [item.path, item]))
  });
}

// src/core/execution-receipts.mjs
var EXECUTION_RECEIPT_ARTIFACT_KINDS = Object.freeze(["report", "document", "code", "data", "figure", "media", "other"]);
var EXECUTION_RECEIPT_VALIDATION_KINDS = Object.freeze(["test-log", "typecheck-log", "lint-log", "build-log", "audit-log", "validation-log", "command-output"]);
var ARTIFACT_KIND_SET = new Set(EXECUTION_RECEIPT_ARTIFACT_KINDS);
var VALIDATION_KIND_SET = new Set(EXECUTION_RECEIPT_VALIDATION_KINDS);
var TOP_LEVEL_FIELDS = /* @__PURE__ */ new Set([
  "receiptId",
  "missionId",
  "contractDigest",
  "summary",
  "artifacts",
  "validations",
  "criteriaSatisfied",
  "producedAt"
]);
var ARTIFACT_FIELDS3 = /* @__PURE__ */ new Set(["path", "kind", "sha256"]);
var VALIDATION_FIELDS3 = /* @__PURE__ */ new Set(["kind", "reference", "outputHash"]);
var CRITERION_FIELDS3 = /* @__PURE__ */ new Set(["criterionId", "evidenceRefs"]);
var RECEIPT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var HASH_PATTERN5 = /^[0-9a-f]{64}$/u;
var EVIDENCE_REF_PATTERN = /^(artifact|validation|source|note):(.+)$/u;
var POST_COMMIT_ASSESSMENT_FIELDS = /* @__PURE__ */ new Set(["kind", "missionId"]);
var POST_COMMIT_ASSESSMENT_KIND = "assess-mission-completion";
function assertPlainObject7(value2, label) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) {
    throw new Error(`${label} must be a plain object.`);
  }
}
function assertAllowedFields2(value2, allowed, label) {
  assertPlainObject7(value2, label);
  const unknown = Object.keys(value2).filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}
function nonEmptyString2(value2, label) {
  if (typeof value2 !== "string" || !value2.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value2.trim();
}
function hashString(value2, label) {
  const hash3 = nonEmptyString2(value2, label).toLowerCase();
  if (!HASH_PATTERN5.test(hash3)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  }
  return hash3;
}
function safeId3(value2, label) {
  const id = nonEmptyString2(value2, label);
  if (!RECEIPT_ID_PATTERN.test(id)) {
    throw new Error(`${label} must start with a lowercase letter or digit and contain only lowercase letters, digits, dot, underscore, or hyphen.`);
  }
  return id;
}
function parseProducedAt(value2) {
  const producedAt = nonEmptyString2(value2, "producedAt");
  const timestamp = Date.parse(producedAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== producedAt) {
    throw new Error("producedAt must be an exact ISO-8601 timestamp.");
  }
  return producedAt;
}
function executionReceiptPath(receiptId) {
  return path18.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receiptId}.json`);
}
function missionContractPath(missionId) {
  return path18.posix.join(ARTIFACT_PATHS.missionsDir, `${missionId}.json`);
}
function inspectCurrentFile(root, rawPath, label) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) {
    throw new Error(`${label} has an unsafe path ${JSON.stringify(rawPath)}: ${normalized.reason}.`);
  }
  if (normalized.normalizedPath !== rawPath.trim().replace(/\\/gu, "/")) {
    throw new Error(`${label} path must be canonical: ${rawPath}.`);
  }
  const inspection = inspectDeclaredPath(root, normalized.normalizedPath, { requireNonEmpty: true });
  if (inspection.status !== "existing") {
    throw new Error(`${label} must be a safe existing non-empty regular file: ${normalized.normalizedPath} (${inspection.reason ?? inspection.status}).`);
  }
  const canonicalPath2 = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath2 !== normalized.normalizedPath) {
    throw new Error(`${label} must use its canonical realpath-contained path; alias ${normalized.normalizedPath} resolves to ${canonicalPath2}.`);
  }
  const snapshot = snapshotArtifactBuffer(root, canonicalPath2, label);
  return {
    path: snapshot.path,
    sha256: snapshot.sha256
  };
}
function inspectHashedFile(root, rawPath, expectedHash, label) {
  const inspected = inspectCurrentFile(root, rawPath, label);
  if (inspected.sha256 !== expectedHash) {
    throw new Error(`${label} SHA-256 mismatch for ${inspected.path}.`);
  }
  return inspected;
}
function normalizeArtifacts(root, mission, value2) {
  if (value2 === void 0) return [];
  if (!Array.isArray(value2)) throw new Error("artifacts must be an array.");
  const seen = /* @__PURE__ */ new Set();
  const artifacts = value2.map((item, index) => {
    const label = `artifacts[${index}]`;
    assertAllowedFields2(item, ARTIFACT_FIELDS3, label);
    const rawPath = nonEmptyString2(item.path, `${label}.path`);
    const kind = nonEmptyString2(item.kind, `${label}.kind`);
    if (!ARTIFACT_KIND_SET.has(kind)) {
      throw new Error(`${label}.kind must be one of: ${EXECUTION_RECEIPT_ARTIFACT_KINDS.join(", ")}.`);
    }
    const sha2567 = hashString(item.sha256, `${label}.sha256`);
    const inspected = inspectHashedFile(root, rawPath, sha2567, label);
    assertNotDoveLessonArtifactPath(inspected.path, `${label}.path`);
    if (seen.has(inspected.path)) throw new Error(`artifacts contains duplicate canonical path ${inspected.path}.`);
    seen.add(inspected.path);
    return { path: inspected.path, kind, sha256: sha2567 };
  });
  return artifacts;
}
function normalizeValidations(root, value2) {
  if (value2 === void 0) return [];
  if (!Array.isArray(value2)) throw new Error("validations must be an array.");
  const seen = /* @__PURE__ */ new Set();
  return value2.map((item, index) => {
    const label = `validations[${index}]`;
    assertAllowedFields2(item, VALIDATION_FIELDS3, label);
    const kind = nonEmptyString2(item.kind, `${label}.kind`);
    if (!VALIDATION_KIND_SET.has(kind)) {
      throw new Error(`${label}.kind must be one of: ${EXECUTION_RECEIPT_VALIDATION_KINDS.join(", ")}.`);
    }
    const reference = nonEmptyString2(item.reference, `${label}.reference`);
    const outputHash = hashString(item.outputHash, `${label}.outputHash`);
    const inspected = inspectHashedFile(root, reference, outputHash, label);
    assertNotDoveLessonArtifactPath(inspected.path, `${label}.reference`);
    const evidenceRole = artifactEvidenceRole(inspected.path);
    if (evidenceRole === "bookkeeping") {
      throw new Error(`${label}.reference must be validation output rather than Dove bookkeeping: ${inspected.path}.`);
    }
    if (seen.has(inspected.path)) throw new Error(`validations contains duplicate canonical reference ${inspected.path}.`);
    seen.add(inspected.path);
    return { kind, reference: inspected.path, outputHash };
  });
}
function typedReferenceEvaluation(root, missionId, reference) {
  const match = EVIDENCE_REF_PATTERN.exec(reference);
  if (!match) return { eligible: false, reason: "unknown-evidence-reference-kind" };
  const [, kind, value2] = match;
  if (kind === "source") {
    const evaluation = evaluateSourceReferences(root, [value2], missionId)[0] ?? { eligible: false, reason: "unknown-source" };
    return { ...evaluation, evidenceSha256: evaluation.source?.capturedMaterial?.sha256 ?? null };
  }
  if (kind === "note") {
    const evaluation = evaluateNoteReferences(root, [value2], missionId)[0] ?? { eligible: false, reason: "unknown-note" };
    return { ...evaluation, evidenceSha256: evaluation.owner?.sha256 ?? null };
  }
  return { eligible: null, kind, value: value2, evidenceSha256: null };
}
function normalizeCriteria(root, mission, value2, artifacts, validations, ledger, receiptId) {
  const requiredCriteria = missionCompletionCriteria(mission);
  if (!Array.isArray(value2)) throw new Error("criteriaSatisfied must be an array.");
  const requiredIds = new Set(requiredCriteria.map((item) => item.criterionId));
  const artifactRefs = new Set(artifacts.map((artifact) => `artifact:${artifact.path}`));
  const validationRefs = new Set(validations.map((validation) => `validation:${validation.reference}`));
  const seen = /* @__PURE__ */ new Set();
  const criteria = value2.map((item, index) => {
    const label = `criteriaSatisfied[${index}]`;
    assertAllowedFields2(item, CRITERION_FIELDS3, label);
    const criterionId = nonEmptyString2(item.criterionId, `${label}.criterionId`);
    if (!requiredIds.has(criterionId)) throw new Error(`${label}.criterionId is unknown for the current mission: ${criterionId}.`);
    if (seen.has(criterionId)) throw new Error(`criteriaSatisfied contains duplicate criterionId ${criterionId}.`);
    seen.add(criterionId);
    if (!Array.isArray(item.evidenceRefs) || item.evidenceRefs.length === 0) {
      throw new Error(`${label}.evidenceRefs must contain at least one resolvable evidence reference; summary is not evidence.`);
    }
    const evidenceBindings = [];
    const evidenceRefs = item.evidenceRefs.map((reference, evidenceIndex) => {
      const normalized = nonEmptyString2(reference, `${label}.evidenceRefs[${evidenceIndex}]`);
      if (artifactRefs.has(normalized)) {
        evidenceBindings.push({ reference: normalized, sha256: artifacts.find((artifact) => `artifact:${artifact.path}` === normalized).sha256, receiptId });
        return normalized;
      }
      if (validationRefs.has(normalized)) {
        evidenceBindings.push({ reference: normalized, sha256: validations.find((validation) => `validation:${validation.reference}` === normalized).outputHash, receiptId });
        return normalized;
      }
      if (normalized.startsWith("artifact:")) {
        const artifactPath = normalized.slice("artifact:".length);
        const owner = ledger.currentOwnership.find((item2) => item2.path === artifactPath);
        if (!owner || owner.missionId !== mission.missionId) throw new Error(`${label}.evidenceRefs[${evidenceIndex}] is not current mission-owned artifact evidence: ${normalized}.`);
        const inspected = inspectHashedFile(root, artifactPath, owner.sha256, `${label}.evidenceRefs[${evidenceIndex}]`);
        evidenceBindings.push({ reference: normalized, sha256: inspected.sha256, receiptId: owner.receiptId });
        return normalized;
      }
      const evaluation = typedReferenceEvaluation(root, mission.missionId, normalized);
      if (evaluation.eligible === true && HASH_PATTERN5.test(String(evaluation.evidenceSha256 ?? ""))) {
        evidenceBindings.push({ reference: normalized, sha256: evaluation.evidenceSha256, receiptId: evaluation.owner?.receiptId ?? receiptId });
        return normalized;
      }
      throw new Error(`${label}.evidenceRefs[${evidenceIndex}] is not current eligible typed evidence: ${normalized} (${evaluation.reason ?? "unresolved"}).`);
    });
    if (new Set(evidenceRefs).size !== evidenceRefs.length) throw new Error(`${label}.evidenceRefs contains duplicates.`);
    return { criterionId, evidenceRefs, evidenceBindings };
  });
  return criteria;
}
function validateExecutionReceipt(root, args2 = {}) {
  const workspace = openDoveWorkspace(root, { operation: "Execution receipt validation" });
  assertAllowedFields2(args2, TOP_LEVEL_FIELDS, "ingest_execution_receipt");
  const receiptId = safeId3(args2.receiptId, "receiptId");
  const missionId = safeId3(args2.missionId, "missionId");
  const contractDigest = hashString(args2.contractDigest, "contractDigest");
  const summary = nonEmptyString2(args2.summary, "summary");
  const producedAt = parseProducedAt(args2.producedAt);
  const missionRelativePath = missionContractPath(missionId);
  if (!fs15.existsSync(path18.resolve(root, missionRelativePath))) {
    throw new Error(`Mission does not exist: ${missionId}.`);
  }
  const mission = readJson(root, missionRelativePath, null);
  if (!mission || mission.missionId !== missionId) throw new Error(`Mission contract is malformed or mismatched: ${missionId}.`);
  assertMissionAcceptsWrites(workspace, mission, { receipt: true });
  const currentContract = assertCurrentMissionContract2(mission);
  if (mission.workspaceId !== workspace.manifest.workspaceId) throw new Error(`Mission contract workspaceId does not match the current workspace for ${missionId}.`);
  if (contractDigest !== currentContract.contractDigest) throw new Error(`contractDigest does not match the current mission contract for ${missionId}.`);
  const receiptRelativePath = executionReceiptPath(receiptId);
  const mutationContext = currentMutationContext(root);
  if (mutationContext) {
    mutationContext.requireCommitPrecondition(ARTIFACT_PATHS.executionReceiptsDir);
    mutationContext.requireCommitLock(".dove/.receipt-ledger-append.lock", { label: "Execution receipt ledger append lock" });
  }
  if (mutationContext ? mutationContext.fileExists(receiptRelativePath) : fs15.existsSync(path18.resolve(root, receiptRelativePath))) {
    throw new Error(`Execution receipt id is already occupied: ${receiptId}.`);
  }
  const artifacts = normalizeArtifacts(root, mission, args2.artifacts);
  const validations = normalizeValidations(root, args2.validations);
  const artifactPaths = new Set(artifacts.map((artifact) => artifact.path));
  const overlappingValidation = validations.find((validation) => artifactPaths.has(validation.reference));
  if (overlappingValidation) {
    throw new Error(`Execution receipt artifact and validation paths must be canonically distinct: ${overlappingValidation.reference}.`);
  }
  const criteriaSatisfied = normalizeCriteria(root, mission, args2.criteriaSatisfied, artifacts, validations, workspace.receiptLedger, receiptId);
  if (artifacts.length === 0 && validations.length === 0 && criteriaSatisfied.length === 0) {
    throw new Error("execution receipt must contain at least one artifact, validation, or satisfied criterion.");
  }
  const baseReceipt = {
    schemaVersion: EXECUTION_RECEIPT_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    receiptId,
    ledgerSequence: workspace.receiptLedger.nextLedgerSequence,
    missionId,
    contractDigest,
    summary,
    artifacts,
    validations,
    criteriaSatisfied,
    producedAt,
    recordedAt: (/* @__PURE__ */ new Date()).toISOString(),
    producer: { kind: "public-execution", actionId: "ingest-execution-receipt" }
  };
  const receipt = { ...baseReceipt, artifacts: deriveArtifactReferences(baseReceipt) };
  assertReceiptAppendable(workspace.receiptLedger, receipt, { missionGraph: workspace.missionGraph });
  return { mission, receipt };
}
function ingestExecutionReceipt(root, args2 = {}) {
  assertGovernanceMutationRegistered("ingest-execution-receipt", "guarded");
  const mutationContext = currentMutationContext(root);
  if (!mutationContext) throw new Error("ingest_execution_receipt requires an active MutationContext.");
  const { receipt } = validateExecutionReceipt(root, args2);
  writeJson(root, executionReceiptPath(receipt.receiptId), receipt);
  const plannedOnly = isPatchPlanMode(root);
  return {
    status: plannedOnly ? "ingest-planned" : "ingested",
    receipt,
    completion: { missionId: receipt.missionId, assessWith: "assess_mission_completion", assessment: null },
    postCommit: plannedOnly ? null : { kind: POST_COMMIT_ASSESSMENT_KIND, missionId: receipt.missionId },
    mutation: {
      mutationMode: mutationContext.mutationMode,
      writesApplied: !plannedOnly,
      paths: [executionReceiptPath(receipt.receiptId)]
    }
  };
}
function resolveExecutionReceiptPostCommit(root, result, options = {}) {
  if (!result || typeof result !== "object" || Array.isArray(result) || !Object.hasOwn(result, "postCommit")) return result;
  const unknownOptions = Object.keys(options).filter((field) => field !== "committed");
  if (unknownOptions.length > 0) throw new Error(`Execution receipt post-commit resolution does not accept unknown options: ${unknownOptions.join(", ")}.`);
  const committed = options.committed !== false;
  const { postCommit, ...publicResult } = result;
  if (postCommit === null) return publicResult;
  assertAllowedFields2(postCommit, POST_COMMIT_ASSESSMENT_FIELDS, "execution receipt postCommit");
  if (postCommit.kind !== POST_COMMIT_ASSESSMENT_KIND) throw new Error(`Unsupported execution receipt postCommit kind: ${postCommit.kind}.`);
  const missionId = safeId3(postCommit.missionId, "execution receipt postCommit.missionId");
  if (!publicResult.completion || publicResult.completion.missionId !== missionId || publicResult.completion.assessment !== null) {
    throw new Error("Execution receipt postCommit descriptor does not match its sealed completion result.");
  }
  if (!committed) return publicResult;
  if (publicResult.mutationMode === "patch-plan" || publicResult.writesApplied !== true || publicResult.mutationSummary?.transactionState?.phase !== "committed") {
    throw new Error("Execution receipt post-commit assessment requires a successfully committed direct-process mutation result.");
  }
  try {
    return {
      ...publicResult,
      completion: {
        ...publicResult.completion,
        assessment: assessMissionCompletion(root, { missionId })
      }
    };
  } catch {
    return {
      ...publicResult,
      completion: {
        ...publicResult.completion,
        assessment: null,
        assessmentUnavailable: true
      }
    };
  }
}
function readExecutionReceipts(root, missionId = null) {
  const workspace = openDoveWorkspace(root, { operation: "Execution receipt read" });
  return workspace.receiptLedger.receipts.filter((receipt) => !missionId || receipt.missionId === missionId);
}

// src/core/file-set-transaction.mjs
import crypto10 from "node:crypto";
import fs16 from "node:fs";
import path19 from "node:path";
var MAX_CLEANUP_RESIDUES2 = 20;
function errorMessage3(error) {
  return error instanceof Error ? error.message : String(error);
}
function sha2565(content) {
  return crypto10.createHash("sha256").update(content).digest("hex");
}
function state(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return { exists: false, type: "absent", sha256: null, mode: null };
  if (stat.isSymbolicLink()) return { exists: true, type: "symlink", sha256: null, mode: stat.mode & 4095 };
  if (stat.isDirectory()) return { exists: true, type: "directory", sha256: null, mode: stat.mode & 4095 };
  if (!stat.isFile()) return { exists: true, type: "other", sha256: null, mode: stat.mode & 4095 };
  return { exists: true, type: "file", sha256: sha2565(anchor.readFile(relativePath)), mode: stat.mode & 4095 };
}
function sameState(left, right) {
  return left.exists === right.exists && left.type === right.type && left.sha256 === right.sha256;
}
function parentDirectories(relativePath) {
  const directories = [];
  let current = path19.posix.dirname(relativePath);
  while (current !== ".") {
    directories.push(current);
    current = path19.posix.dirname(current);
  }
  return directories.reverse();
}
function ensureParentDirectories(anchor, relativePath, createdDirectories) {
  for (const directoryPath of parentDirectories(relativePath)) {
    const stat = anchor.tryLstat(directoryPath);
    if (stat) {
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Transactional directory component must be a real directory: ${directoryPath}`);
      continue;
    }
    anchor.mkdir(directoryPath);
    createdDirectories.push(directoryPath);
  }
}
function committedResult(entries, cleanupFailures) {
  const residues = cleanupFailures.slice(0, MAX_CLEANUP_RESIDUES2);
  return {
    writtenPaths: entries.filter((entry) => !entry.deleting).map((entry) => entry.relativePath),
    removedPaths: entries.filter((entry) => entry.deleting).map((entry) => entry.relativePath),
    changedPaths: entries.map((entry) => entry.relativePath),
    transactionState: {
      phase: "committed",
      rollbackAttempted: false,
      cleanup: {
        status: cleanupFailures.length === 0 ? "clean" : "residue",
        residueCount: cleanupFailures.length,
        residues,
        omittedResidueCount: Math.max(0, cleanupFailures.length - residues.length)
      }
    }
  };
}
function writeFileSetTransaction(entries, options = {}) {
  if (!Array.isArray(entries)) throw new Error("Transactional write entries must be an array.");
  const fsOps = options.fsOps ?? fs16;
  const transactionId = (options.transactionId ?? crypto10.randomUUID()).replace(/[^a-z0-9._-]/giu, "-");
  const anchors = /* @__PURE__ */ new Map();
  const resolved = [];
  const targets = /* @__PURE__ */ new Set();
  const transactions = /* @__PURE__ */ new Map();
  const promotions = [];
  const createdDirectories = /* @__PURE__ */ new Map();
  let phase = "preparing";
  const anchorFor = (root) => {
    const canonicalRoot = typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(path19.resolve(root)) : fsOps.realpathSync(path19.resolve(root));
    if (!anchors.has(canonicalRoot)) anchors.set(canonicalRoot, openAnchoredFilesystem(canonicalRoot, { fsOps, platform: options.platform, procFdRoot: options.procFdRoot }));
    return anchors.get(canonicalRoot);
  };
  try {
    for (const [index, entry] of entries.entries()) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Transactional write entry ${index} must be an object.`);
      const anchor = anchorFor(entry.root);
      const relativePath = anchor.normalize(entry.relativePath, entry.label ?? "Transactional write path");
      const key = `${anchor.root}\0${relativePath}`;
      if (targets.has(key)) throw new Error(`Transactional write set contains duplicate target ${relativePath}.`);
      targets.add(key);
      const previous = state(anchor, relativePath);
      const deleting = entry.delete === true;
      const deletingEmptyDirectory = deleting && entry.deleteEmptyDirectory === true;
      if (previous.exists && previous.type !== "file" && !(deletingEmptyDirectory && previous.type === "directory")) {
        throw new Error(`Transactional write target must be absent or a regular file${deletingEmptyDirectory ? " or an explicitly selected empty directory" : ""}: ${relativePath}.`);
      }
      if (deleting && !previous.exists) continue;
      if (!deleting && previous.exists && entry.force !== true) continue;
      resolved.push({
        ...entry,
        anchor,
        relativePath,
        deleting,
        content: deleting ? null : Buffer.isBuffer(entry.content) ? Buffer.from(entry.content) : Buffer.from(String(entry.content ?? ""), entry.encoding ?? "utf8"),
        previous
      });
    }
    if (resolved.length === 0) return committedResult([], []);
    for (const anchor of new Set(resolved.map((entry) => entry.anchor))) {
      const transactionPath = `.dove-file-transaction-${transactionId}`;
      if (anchor.exists(transactionPath)) throw new Error(`Transactional staging path is already occupied: ${anchor.displayPath(transactionPath)}.`);
      anchor.mkdir(transactionPath);
      anchor.mkdir(`${transactionPath}/staged`);
      anchor.mkdir(`${transactionPath}/backups`);
      transactions.set(anchor, { transactionPath, stagedRoot: `${transactionPath}/staged`, backupRoot: `${transactionPath}/backups` });
      createdDirectories.set(anchor, []);
    }
    for (const [index, entry] of resolved.entries()) {
      if (entry.deleting) continue;
      const transaction = transactions.get(entry.anchor);
      entry.stagedPath = `${transaction.stagedRoot}/file-${index}`;
      entry.anchor.writeNewFile(entry.stagedPath, entry.content);
      if (entry.previous.mode !== null) entry.anchor.chmod(entry.stagedPath, entry.previous.mode);
    }
    for (const entry of resolved) {
      const actual = state(entry.anchor, entry.relativePath);
      if (!sameState(actual, entry.previous)) throw new Error(`Transactional write precondition changed for ${entry.relativePath}.`);
      if (entry.deleting && entry.previous.type === "directory") {
        const children = entry.anchor.readdir(entry.relativePath);
        const scheduledChildren = new Set(resolved.filter((candidate) => candidate.anchor === entry.anchor && candidate.deleting && path19.posix.dirname(candidate.relativePath) === entry.relativePath).map((candidate) => path19.posix.basename(candidate.relativePath)));
        if (children.some((child) => !scheduledChildren.has(typeof child === "string" ? child : child.name))) {
          throw new Error(`Transactional directory deletion requires every child to be an exact scheduled deletion: ${entry.relativePath}.`);
        }
      }
    }
    phase = "promoting";
    for (const [index, entry] of resolved.entries()) {
      const transaction = transactions.get(entry.anchor);
      const promotion = { entry, backupPath: null, promoted: false };
      promotions.push(promotion);
      ensureParentDirectories(entry.anchor, entry.relativePath, createdDirectories.get(entry.anchor));
      if (entry.previous.exists) {
        promotion.backupPath = `${transaction.backupRoot}/file-${index}`;
        entry.anchor.rename(entry.relativePath, promotion.backupPath);
      }
      if (!entry.deleting) {
        entry.anchor.rename(entry.stagedPath, entry.relativePath);
        promotion.promoted = true;
      }
    }
    phase = "committed";
    const cleanupFailures = [];
    for (const [anchor, transaction] of transactions) {
      try {
        anchor.remove(transaction.transactionPath, { recursive: true, force: true });
      } catch (cleanupError) {
        cleanupFailures.push({ path: anchor.displayPath(transaction.transactionPath), reason: errorMessage3(cleanupError) });
      }
    }
    return committedResult(resolved, cleanupFailures);
  } catch (error) {
    if (phase === "committed") throw new Error(`Transactional write committed before post-commit cleanup failed: ${errorMessage3(error)}`, { cause: error });
    const rollbackFailures = [];
    const attempt = (callback) => {
      try {
        callback();
      } catch (rollbackError) {
        rollbackFailures.push(errorMessage3(rollbackError));
      }
    };
    for (const promotion of [...promotions].reverse()) {
      const { entry } = promotion;
      if (promotion.promoted) attempt(() => entry.anchor.remove(entry.relativePath, { force: true }));
      if (promotion.backupPath && entry.anchor.exists(promotion.backupPath)) attempt(() => entry.anchor.rename(promotion.backupPath, entry.relativePath));
    }
    for (const [anchor, directories] of createdDirectories) {
      for (const directoryPath of [...directories].sort((left, right) => right.length - left.length)) {
        attempt(() => anchor.rmdir(directoryPath, { force: true }));
      }
    }
    for (const [anchor, transaction] of transactions) {
      attempt(() => anchor.remove(transaction.transactionPath, { recursive: true, force: true }));
    }
    if (rollbackFailures.length > 0) throw new Error(`Transactional write failed and rollback also failed: ${errorMessage3(error)}; rollback: ${rollbackFailures.join("; ")}`, { cause: error });
    throw new Error(`Transactional write failed and all staged changes were rolled back: ${errorMessage3(error)}`, { cause: error });
  } finally {
    for (const anchor of anchors.values()) anchor.close();
  }
}

// src/core/lessons.mjs
import fs17 from "node:fs";
import path20 from "node:path";
var DOVE_LESSON_SCHEMA_VERSION = 2;
var DOVE_LESSON_PROPOSAL_VERSION = 1;
var DOVE_LESSON_SCOPES = Object.freeze(["global", "mission"]);
var DOVE_LESSON_KINDS = Object.freeze(["preference", "constraint", "method", "failure", "review-insight"]);
var LESSON_SCOPE_SET = new Set(DOVE_LESSON_SCOPES);
var LESSON_KIND_SET = new Set(DOVE_LESSON_KINDS);
var RECORD_FIELDS = /* @__PURE__ */ new Set([
  "missionId",
  "lessonId",
  "scope",
  "kind",
  "summary",
  "details",
  "nextTimeGuidance",
  "sourceIds",
  "noteIds",
  "artifactRefs",
  "appliesToArtifactRefs",
  "tags",
  "supersedesLessonId"
]);
var REPLAY_FIELDS2 = /* @__PURE__ */ new Set([
  "confirmed",
  "proposalVersion",
  "proposalWorkspace",
  "proposalDigest",
  "proposalToken",
  "mutationMode",
  "workspaceId",
  "contractDigest",
  "createdAt"
]);
var QUERY_FIELDS2 = /* @__PURE__ */ new Set([
  "lessonId",
  "missionId",
  "scope",
  "kind",
  "tags",
  "artifactRefs",
  "includeSuperseded",
  "includeUnscoped",
  "limit"
]);
function lessonPath(lessonId) {
  return path20.posix.join(ARTIFACT_PATHS.lessonsDir, `${lessonId}.json`);
}
function normalizeOptionalText(value2, label) {
  if (value2 === void 0) return void 0;
  return domainNonEmptyText(value2, label);
}
function normalizeEnum(value2, allowed, label) {
  const normalized = domainNonEmptyText(value2, label).toLowerCase();
  if (!allowed.has(normalized)) throw new Error(`${label} must be one of: ${[...allowed].join(", ")}.`);
  return normalized;
}
function normalizeMutationModeForLesson(root, args2) {
  const explicit = Object.hasOwn(args2, "mutationMode") ? normalizeMutationMode(args2.mutationMode) : null;
  const active = currentMutationContext(root)?.mutationMode ?? null;
  if (active && explicit && active !== explicit) {
    throw new Error(`record_dove_lesson mutationMode ${explicit} does not match the active mutation context mode ${active}.`);
  }
  return active ?? explicit ?? "direct-process";
}
function readLessons(root) {
  openDoveWorkspace(root, { operation: "Dove lesson read" });
  const directory = path20.resolve(root, ARTIFACT_PATHS.lessonsDir);
  if (!fs17.existsSync(directory)) return [];
  return fs17.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).sort((left, right) => left.name.localeCompare(right.name)).map((entry) => readJson(root, path20.posix.join(ARTIFACT_PATHS.lessonsDir, entry.name), null));
}
function validateEligibleReferences(root, missionId, sourceIds, noteIds) {
  const sources = evaluateSourceReferences(root, sourceIds, missionId);
  const sourceFailure = sources.find((item) => item.eligible !== true);
  if (sourceFailure) throw new Error(`sourceIds contains ineligible current source ${sourceFailure.reference}: ${sourceFailure.reason}.`);
  const notes = evaluateNoteReferences(root, noteIds, missionId);
  const noteFailure = notes.find((item) => item.eligible !== true);
  if (noteFailure) throw new Error(`noteIds contains ineligible current note ${noteFailure.reference}: ${noteFailure.reason}.`);
  return {
    sources: sources.map((item) => ({ reference: item.reference, snapshotDigest: domainSha256(stableWorkspaceSerialize(item.source)) })),
    notes: notes.map((item) => ({ reference: item.reference, snapshotDigest: domainSha256(stableWorkspaceSerialize(item.note)) }))
  };
}
function referenceSnapshots(references) {
  return references.map((reference) => ({ path: reference.path, sha256: reference.sha256 }));
}
function assertSupersession(lessons, candidate) {
  if (!candidate.supersedesLessonId) return null;
  if (candidate.supersedesLessonId === candidate.lessonId) throw new Error("A Dove lesson must not supersede itself.");
  const previous = lessons.find((lesson) => lesson.lessonId === candidate.supersedesLessonId);
  if (!previous) throw new Error(`Cannot supersede unknown lesson ${candidate.supersedesLessonId}.`);
  if (previous.scope !== candidate.scope || previous.kind !== candidate.kind) {
    throw new Error("A Dove lesson may supersede only a lesson with the same scope and kind.");
  }
  if (candidate.scope === "mission" && previous.missionId !== candidate.missionId) {
    throw new Error("A mission-scoped Dove lesson may supersede only a lesson from the same mission.");
  }
  const successor = lessons.find((lesson) => lesson.supersedesLessonId === previous.lessonId);
  if (successor) throw new Error(`Lesson ${previous.lessonId} already has successor ${successor.lessonId}; supersession must not fork.`);
  const seen = /* @__PURE__ */ new Set([candidate.lessonId]);
  let cursor = previous;
  while (cursor) {
    if (seen.has(cursor.lessonId)) throw new Error("Dove lesson supersession must not contain a cycle.");
    seen.add(cursor.lessonId);
    cursor = cursor.supersedesLessonId ? lessons.find((lesson) => lesson.lessonId === cursor.supersedesLessonId) : null;
  }
  return { lessonId: previous.lessonId, createdAt: previous.createdAt };
}
function normalizedRecordInput(args2) {
  const content = {
    lessonId: domainSafeId(args2.lessonId, "lessonId"),
    missionId: domainSafeId(args2.missionId, "missionId"),
    scope: normalizeEnum(args2.scope, LESSON_SCOPE_SET, "scope"),
    kind: normalizeEnum(args2.kind, LESSON_KIND_SET, "kind"),
    summary: domainNonEmptyText(args2.summary, "summary"),
    nextTimeGuidance: domainStringArray(args2.nextTimeGuidance, "nextTimeGuidance", { minItems: 1 }),
    sourceIds: domainStringArray(args2.sourceIds, "sourceIds"),
    noteIds: domainStringArray(args2.noteIds, "noteIds"),
    artifactRefs: domainStringArray(args2.artifactRefs, "artifactRefs"),
    appliesToArtifactRefs: domainStringArray(args2.appliesToArtifactRefs, "appliesToArtifactRefs"),
    tags: domainStringArray(args2.tags, "tags")
  };
  const details = normalizeOptionalText(args2.details, "details");
  if (details !== void 0) content.details = details;
  if (args2.supersedesLessonId !== void 0) content.supersedesLessonId = domainSafeId(args2.supersedesLessonId, "supersedesLessonId");
  return content;
}
function createdAtFor2(args2) {
  if (args2.confirmed !== true) return nowIso();
  const createdAt = domainNonEmptyText(args2.createdAt, "createdAt");
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== createdAt) {
    throw new Error("createdAt replay data must be an exact ISO-8601 timestamp.");
  }
  return createdAt;
}
function buildProposal3(root, args2) {
  const content = normalizedRecordInput(args2);
  const { workspace, mission } = readCurrentMission(root, content.missionId, "Dove lesson proposal");
  const mutationMode2 = normalizeMutationModeForLesson(root, args2);
  if (args2.confirmed === true) {
    if (args2.workspaceId !== workspace.manifest.workspaceId) throw new Error("Confirmed Dove lesson replay no longer matches the workspace identity.");
    if (args2.contractDigest !== mission.contractDigest) throw new Error("Confirmed Dove lesson replay no longer matches the mission contract digest.");
  }
  const relativePath = lessonPath(content.lessonId);
  const context = currentMutationContext(root);
  const occupied = context ? context.fileExists(relativePath) : fs17.existsSync(path20.resolve(root, relativePath));
  if (occupied) throw new Error(`Dove lesson id is already occupied: ${content.lessonId}.`);
  const lessons = readLessons(root);
  const evidenceSnapshots = validateEligibleReferences(root, mission.missionId, content.sourceIds, content.noteIds);
  const artifacts = resolveMissionArtifactReferences(root, mission.missionId, content.artifactRefs, "artifactRefs");
  const applicability = resolveMissionArtifactReferences(root, mission.missionId, content.appliesToArtifactRefs, "appliesToArtifactRefs");
  const supersession = assertSupersession(lessons, content);
  const createdAt = createdAtFor2(args2);
  const lesson = {
    schemaVersion: DOVE_LESSON_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    lessonId: content.lessonId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    scope: content.scope,
    kind: content.kind,
    summary: content.summary,
    ...content.details === void 0 ? {} : { details: content.details },
    nextTimeGuidance: content.nextTimeGuidance,
    sourceIds: content.sourceIds,
    noteIds: content.noteIds,
    artifactRefs: referenceSnapshots(artifacts),
    appliesToArtifactRefs: referenceSnapshots(applicability),
    tags: content.tags,
    ...content.supersedesLessonId === void 0 ? {} : { supersedesLessonId: content.supersedesLessonId },
    createdAt
  };
  const proposalWorkspace = canonicalWorkspacePath(root);
  const envelope = {
    proposalVersion: DOVE_LESSON_PROPOSAL_VERSION,
    proposalWorkspace,
    workspaceId: workspace.manifest.workspaceId,
    mutationMode: mutationMode2,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    lesson,
    evidenceSnapshots,
    supersession
  };
  const proposalDigest = domainSha256(stableWorkspaceSerialize(envelope));
  const replayArgs = {
    confirmed: true,
    proposalVersion: DOVE_LESSON_PROPOSAL_VERSION,
    proposalWorkspace,
    proposalDigest,
    mutationMode: mutationMode2,
    workspaceId: envelope.workspaceId,
    contractDigest: envelope.contractDigest,
    createdAt: lesson.createdAt,
    missionId: content.missionId,
    lessonId: content.lessonId,
    scope: content.scope,
    kind: content.kind,
    summary: content.summary,
    ...content.details === void 0 ? {} : { details: content.details },
    nextTimeGuidance: content.nextTimeGuidance,
    sourceIds: content.sourceIds,
    noteIds: content.noteIds,
    artifactRefs: content.artifactRefs,
    appliesToArtifactRefs: content.appliesToArtifactRefs,
    tags: content.tags,
    ...content.supersedesLessonId === void 0 ? {} : { supersedesLessonId: content.supersedesLessonId }
  };
  const proposalToken2 = Buffer.from(JSON.stringify({ version: DOVE_LESSON_PROPOSAL_VERSION, mutationMode: mutationMode2, confirmArgs: replayArgs }), "utf8").toString("base64url");
  return { content, lesson, envelope, proposalDigest, proposalToken: proposalToken2, relativePath, mutationMode: mutationMode2 };
}
function confirmArgsFor3(proposal) {
  return {
    confirmed: true,
    proposalVersion: DOVE_LESSON_PROPOSAL_VERSION,
    proposalWorkspace: proposal.envelope.proposalWorkspace,
    proposalDigest: proposal.proposalDigest,
    proposalToken: proposal.proposalToken,
    mutationMode: proposal.mutationMode,
    workspaceId: proposal.envelope.workspaceId,
    contractDigest: proposal.envelope.contractDigest,
    createdAt: proposal.lesson.createdAt,
    missionId: proposal.content.missionId,
    lessonId: proposal.content.lessonId,
    scope: proposal.content.scope,
    kind: proposal.content.kind,
    summary: proposal.content.summary,
    ...proposal.content.details === void 0 ? {} : { details: proposal.content.details },
    nextTimeGuidance: proposal.content.nextTimeGuidance,
    sourceIds: proposal.content.sourceIds,
    noteIds: proposal.content.noteIds,
    artifactRefs: proposal.content.artifactRefs,
    appliesToArtifactRefs: proposal.content.appliesToArtifactRefs,
    tags: proposal.content.tags,
    ...proposal.content.supersedesLessonId === void 0 ? {} : { supersedesLessonId: proposal.content.supersedesLessonId }
  };
}
function assertExactReplay3(root, proposal, args2) {
  if (!currentMutationContext(root)) throw new Error("Confirmed Dove lesson recording requires an active MutationContext.");
  if (args2.proposalVersion !== DOVE_LESSON_PROPOSAL_VERSION) throw new Error("The selected Dove lesson proposal version is unsupported. Request a fresh proposal.");
  const expected = confirmArgsFor3(proposal);
  const supplied = Object.fromEntries(Object.entries(args2).filter(([field]) => REPLAY_FIELDS2.has(field) || RECORD_FIELDS.has(field)));
  if (stableWorkspaceSerialize(supplied) !== stableWorkspaceSerialize(expected)) {
    throw new Error("The selected Dove lesson proposal no longer matches the exact replay fields, workspace, contract, mutation mode, supersession, or references. Request a fresh proposal.");
  }
}
function mutationMetadata2(proposal, writesApplied, paths = []) {
  return { mutationMode: proposal.mutationMode, writesApplied, paths };
}
function recordDoveLesson(root, args2 = {}) {
  assertSealedDomainArgs(args2, /* @__PURE__ */ new Set([...RECORD_FIELDS, ...REPLAY_FIELDS2]), "record_dove_lesson");
  if (args2.confirmed !== true) {
    const replayOnly = Object.keys(args2).filter((field) => REPLAY_FIELDS2.has(field) && field !== "mutationMode");
    if (replayOnly.length > 0) {
      throw new Error(`record_dove_lesson proposal does not accept caller replay fields: ${replayOnly.map((field) => `$.${field}`).join(", ")}.`);
    }
  }
  const proposal = buildProposal3(root, args2);
  if (args2.confirmed !== true) {
    const confirmArgs2 = confirmArgsFor3(proposal);
    return {
      status: "needs-confirmation",
      lesson: proposal.lesson,
      proposalDigest: proposal.proposalDigest,
      confirmation: {
        required: true,
        exactReplay: true,
        proposalVersion: DOVE_LESSON_PROPOSAL_VERSION,
        proposalWorkspace: proposal.envelope.proposalWorkspace,
        proposalDigest: proposal.proposalDigest,
        proposalToken: proposal.proposalToken,
        mutationMode: proposal.mutationMode,
        confirmArgs: confirmArgs2
      },
      advisoryOnly: true,
      authority: false,
      completionEligible: false,
      mutation: mutationMetadata2(proposal, false)
    };
  }
  assertExactReplay3(root, proposal, args2);
  const derivedReferences = [
    ...proposal.lesson.sourceIds.map((id) => `source:${id}`),
    ...proposal.lesson.noteIds.map((id) => `note:${id}`),
    ...proposal.lesson.artifactRefs.map((item) => `artifact:${item.path}`),
    ...proposal.lesson.appliesToArtifactRefs.map((item) => `applies-to:${item.path}`),
    ...proposal.lesson.supersedesLessonId ? [`lesson:${proposal.lesson.supersedesLessonId}`] : []
  ];
  const recorded = finalizeDomainArtifacts(root, {
    actionId: "record-dove-lesson",
    operation: "Dove lesson recording",
    missionId: proposal.lesson.missionId,
    summary: `Recorded advisory lesson ${proposal.lesson.lessonId}.`,
    allowLessonArtifacts: true,
    writes: [{
      path: proposal.relativePath,
      kind: "data",
      content: domainJson(proposal.lesson),
      derivedReferences
    }]
  });
  return {
    ...recorded,
    lesson: proposal.lesson,
    advisoryOnly: true,
    authority: false,
    completionEligible: false
  };
}
function assessPinnedArtifacts(root, missionId, references) {
  const ownership = readArtifactOwnership(root);
  const byPath = new Map(ownership.artifacts.map((item) => [item.path, item]));
  return references.map((reference) => {
    const owner = byPath.get(reference.path);
    if (!owner) return { ...reference, current: false, reason: "artifact-ownership-missing" };
    const inspection = inspectDeclaredPath(root, reference.path, { requireNonEmpty: true });
    if (inspection.status !== "existing") return { ...reference, current: false, reason: inspection.reason ?? inspection.status };
    const currentHash2 = sha256File(path20.resolve(root, reference.path));
    const current = currentHash2 === reference.sha256 && owner.sha256 === reference.sha256 && owner.missionId === missionId;
    return { ...reference, current, reason: current ? null : "artifact-hash-or-ownership-drift", actualHash: currentHash2 };
  });
}
function lessonAssessment(root, lesson, successorId, matchedArtifactRefs) {
  const sources = evaluateSourceReferences(root, lesson.sourceIds, lesson.missionId).map((item) => ({ reference: item.reference, current: item.eligible === true, reason: item.reason }));
  const notes = evaluateNoteReferences(root, lesson.noteIds, lesson.missionId).map((item) => ({ reference: item.reference, current: item.eligible === true, reason: item.reason }));
  const artifacts = assessPinnedArtifacts(root, lesson.missionId, lesson.artifactRefs);
  const applicability = assessPinnedArtifacts(root, lesson.missionId, lesson.appliesToArtifactRefs);
  const current = [...sources, ...notes, ...artifacts, ...applicability].every((item) => item.current === true);
  return {
    current,
    superseded: Boolean(successorId),
    successorLessonId: successorId ?? null,
    evidence: { sources, notes, artifacts },
    applicability,
    matchedArtifactRefs
  };
}
function queryDoveLessons(root, args2 = {}) {
  assertSealedDomainArgs(args2, QUERY_FIELDS2, "query_dove_lessons");
  const workspace = openDoveWorkspace(root, { operation: "Dove lesson query" });
  const lessonId = args2.lessonId === void 0 ? null : domainSafeId(args2.lessonId, "lessonId");
  const missionId = args2.missionId === void 0 ? null : domainSafeId(args2.missionId, "missionId");
  const scope = args2.scope === void 0 ? null : normalizeEnum(args2.scope, LESSON_SCOPE_SET, "scope");
  const kind = args2.kind === void 0 ? null : normalizeEnum(args2.kind, LESSON_KIND_SET, "kind");
  const tags = domainStringArray(args2.tags, "tags");
  const artifactRefs = domainStringArray(args2.artifactRefs, "artifactRefs");
  if (artifactRefs.length > 0 && !missionId) throw new Error("Artifact-scoped Dove lesson queries require missionId.");
  if (missionId) readCurrentMission(root, missionId, "Dove lesson query");
  const ownership = readArtifactOwnership(root);
  const ownedPaths = new Set(ownership.artifacts.filter((item) => item.missionId === missionId).map((item) => item.path));
  const existingArtifactRefs = artifactRefs.filter((reference) => ownedPaths.has(reference));
  const queryArtifacts = existingArtifactRefs.length > 0 ? resolveMissionArtifactReferences(root, missionId, existingArtifactRefs, "artifactRefs") : [];
  const queryArtifactPaths = /* @__PURE__ */ new Set([...queryArtifacts.map((item) => item.path), ...artifactRefs.filter((reference) => !ownedPaths.has(reference))]);
  const includeSuperseded = args2.includeSuperseded === true;
  const includeUnscoped = args2.includeUnscoped === true;
  const limitNumber = args2.limit === void 0 ? 50 : Number(args2.limit);
  if (!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > 200) throw new Error("limit must be an integer from 1 to 200.");
  const lessons = readLessons(root);
  const successorByLesson = new Map(lessons.filter((lesson) => lesson.supersedesLessonId).map((lesson) => [lesson.supersedesLessonId, lesson.lessonId]));
  const items = lessons.filter((lesson) => !lessonId || lesson.lessonId === lessonId).filter((lesson) => missionId ? lesson.scope === "global" || lesson.scope === "mission" && lesson.missionId === missionId : lesson.scope === "global").filter((lesson) => !scope || lesson.scope === scope).filter((lesson) => !kind || lesson.kind === kind).filter((lesson) => tags.every((tag) => lesson.tags.includes(tag))).filter((lesson) => includeSuperseded || !successorByLesson.has(lesson.lessonId)).map((lesson) => {
    const matchedArtifactRefs = lesson.appliesToArtifactRefs.map((item) => item.path).filter((item) => queryArtifactPaths.has(item));
    return { lesson, matchedArtifactRefs };
  }).filter(({ lesson, matchedArtifactRefs }) => queryArtifactPaths.size === 0 || matchedArtifactRefs.length > 0 || includeUnscoped && lesson.appliesToArtifactRefs.length === 0).map(({ lesson, matchedArtifactRefs }) => ({
    lessonId: lesson.lessonId,
    missionId: lesson.missionId,
    contractDigest: lesson.contractDigest,
    scope: lesson.scope,
    kind: lesson.kind,
    ...lesson.researchTreeOrigin === void 0 ? {} : { researchTreeOrigin: lesson.researchTreeOrigin },
    summary: lesson.summary,
    ...lesson.details === void 0 ? {} : { details: lesson.details },
    nextTimeGuidance: lesson.nextTimeGuidance,
    sourceIds: lesson.sourceIds,
    noteIds: lesson.noteIds,
    artifactRefs: lesson.artifactRefs,
    appliesToArtifactRefs: lesson.appliesToArtifactRefs,
    tags: lesson.tags,
    ...lesson.supersedesLessonId === void 0 ? {} : { supersedesLessonId: lesson.supersedesLessonId },
    createdAt: lesson.createdAt,
    assessment: lessonAssessment(root, lesson, successorByLesson.get(lesson.lessonId), matchedArtifactRefs)
  })).sort((left, right) => right.assessment.matchedArtifactRefs.length - left.assessment.matchedArtifactRefs.length || Number(right.scope === "mission") - Number(left.scope === "mission") || String(right.createdAt).localeCompare(String(left.createdAt)) || left.lessonId.localeCompare(right.lessonId)).slice(0, limitNumber);
  return {
    status: items.length > 0 ? "ok" : "empty",
    workspaceId: workspace.manifest.workspaceId,
    missionId,
    lessonCount: items.length,
    items,
    advisoryOnly: true,
    authority: false,
    writes: []
  };
}

// src/core/mission-queries.mjs
import fs19 from "node:fs";
import path22 from "node:path";

// src/core/retained-domain-workflows.mjs
import fs18 from "node:fs";
import path21 from "node:path";
var NOTE_FIELDS2 = /* @__PURE__ */ new Set(["missionId", "noteId", "title", "summary", "quotes", "claims", "openQuestions", "sourceIds", "artifactRefs"]);
var DRAFT_FIELDS = /* @__PURE__ */ new Set(["missionId", "draftId", "title", "body", "summary", "evidenceRefs", "artifactRefs"]);
var DRAFT_META_FIELDS = /* @__PURE__ */ new Set(["missionId", "draftId", "title", "summary", "evidenceRefs", "artifactRefs"]);
var EXPERIMENT_FIELDS = /* @__PURE__ */ new Set(["missionId", "experimentId", "title", "goal", "hypothesis", "protocol", "successCriteria", "comparisonTargets", "result", "resultEvidenceRefs", "auditFindings", "integrityFlags", "claimId", "bridgeReason"]);
var FIGURE_FIELDS = /* @__PURE__ */ new Set(["missionId", "figureId", "intent", "purpose", "materials", "prompt", "outputPath", "outputSha256", "caption", "qaFindings"]);
var REBUTTAL_FIELDS = /* @__PURE__ */ new Set(["missionId", "issues", "strategy", "responses"]);
var VERSION_FIELDS = /* @__PURE__ */ new Set(["missionId", "versionId", "label", "artifactRefs", "supersedesVersionId"]);
var COMPARE_FIELDS = /* @__PURE__ */ new Set(["missionId", "fromVersionId", "toVersionId"]);
function filePath(directory, id, extension = "json") {
  return path21.posix.join(directory, `${id}.${extension}`);
}
function existingBoundRecord(root, relativePath, missionId, label) {
  const current = fs18.existsSync(path21.resolve(root, relativePath)) ? readJson(root, relativePath, null) : null;
  if (current && current.missionId !== missionId) throw new Error(`${label} belongs to mission ${current.missionId}, not ${missionId}.`);
  return current;
}
function currentBoundRecord(root, relativePath, missionId, label) {
  resolveMissionArtifactReferences(root, missionId, [relativePath], `${label} artifact`);
  const current = readJson(root, relativePath, null);
  if (!current || current.missionId !== missionId) throw new Error(`${label} is not a current record for mission ${missionId}.`);
  return current;
}
function normalizeFindingRefs(root, missionId, values, label) {
  return domainStringArray(values, label, { minItems: 1 }).map((reference, index) => {
    const separator = reference.lastIndexOf("#");
    if (separator <= 0 || separator === reference.length - 1) throw new Error(`${label}[${index}] must use <review-artifact-path>#<finding-id>.`);
    const artifactPath = reference.slice(0, separator);
    const findingId = domainSafeId(reference.slice(separator + 1), `${label}[${index}] finding id`);
    const [artifact] = resolveMissionArtifactReferences(root, missionId, [artifactPath], `${label}[${index}]`);
    let review;
    try {
      review = readJson(root, artifact.path, null);
    } catch {
      throw new Error(`${label}[${index}] must reference a JSON review artifact.`);
    }
    const findings = Array.isArray(review?.findings) ? review.findings : [];
    const finding = findings.find((item) => item && typeof item === "object" && (item.findingId === findingId || item.id === findingId));
    if (review?.missionId !== missionId || !finding) throw new Error(`${label}[${index}] does not resolve to a mission-bound review finding.`);
    return `${artifact.path}#${findingId}`;
  });
}
function normalizeEvidenceRefs(root, missionId, values, label = "evidenceRefs") {
  const references = domainStringArray(values, label);
  return references.map((reference, index) => {
    if (reference.startsWith("source:")) {
      const id = reference.slice("source:".length);
      const evaluation = evaluateSourceReferences(root, [id], missionId)[0];
      if (!evaluation?.eligible) throw new Error(`${label}[${index}] is not eligible source evidence: ${evaluation?.reason ?? "unknown-source"}.`);
      return reference;
    }
    if (reference.startsWith("note:")) {
      const id = reference.slice("note:".length);
      const evaluation = evaluateNoteReferences(root, [id], missionId)[0];
      if (!evaluation?.eligible) throw new Error(`${label}[${index}] is not eligible note evidence: ${evaluation?.reason ?? "unknown-note"}.`);
      return reference;
    }
    if (reference.startsWith("validation:")) {
      const validation = resolveMissionValidationReference(root, missionId, reference.slice("validation:".length), `${label}[${index}]`);
      return `validation:${validation.reference}`;
    }
    const artifactPath = reference.startsWith("artifact:") ? reference.slice("artifact:".length) : reference;
    const [artifact] = resolveMissionArtifactReferences(root, missionId, [artifactPath], `${label}[${index}]`);
    return `artifact:${artifact.path}`;
  });
}
function normalizeRebuttalIssueItems(root, missionId, items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("normalize_rebuttal_issues requires at least one issue.");
  return items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`issues[${index}] must be an object.`);
    const unknown = Object.keys(item).filter((field) => !["issueId", "summary", "findingRefs", "evidenceRefs"].includes(field));
    if (unknown.length) throw new Error(`issues[${index}] does not accept unknown input: ${unknown.join(", ")}.`);
    return { issueId: domainSafeId(item.issueId, `issues[${index}].issueId`), summary: domainNonEmptyText(item.summary, `issues[${index}].summary`), findingRefs: normalizeFindingRefs(root, missionId, item.findingRefs, `issues[${index}].findingRefs`), evidenceRefs: normalizeEvidenceRefs(root, missionId, item.evidenceRefs, `issues[${index}].evidenceRefs`) };
  });
}
function rebuttalIssuesRecord(missionId, issues) {
  return { schemaVersion: 1, missionId, issues, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function rebuttalStrategyRecord(missionId, issues, strategy) {
  return { schemaVersion: 1, missionId, strategy: domainNonEmptyText(strategy, "strategy"), issueIds: issues.map((item) => item.issueId), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function upsertNote(root, args2 = {}) {
  assertSealedDomainArgs(args2, NOTE_FIELDS2, "upsert_note");
  const { mission } = readCurrentMission(root, args2.missionId, "Note workflow");
  const noteId = domainSafeId(args2.noteId, "noteId");
  const summary = typeof args2.summary === "string" ? args2.summary.trim() : "";
  const quotes = domainStringArray(args2.quotes, "quotes");
  const claims = domainStringArray(args2.claims, "claims");
  const openQuestions = domainStringArray(args2.openQuestions, "openQuestions");
  if (!summary && quotes.length === 0 && claims.length === 0 && openQuestions.length === 0) throw new Error("upsert_note requires substantive synthesis content.");
  const sourceIds = domainStringArray(args2.sourceIds, "sourceIds");
  if (sourceIds.length > 0) {
    const failures = evaluateSourceReferences(root, sourceIds, mission.missionId).filter((item) => !item.eligible);
    if (failures.length) throw new Error(`upsert_note rejects ineligible sources: ${failures.map((item) => `${item.reference} (${item.reason})`).join(", ")}.`);
  }
  const artifacts = resolveMissionArtifactReferences(root, mission.missionId, args2.artifactRefs, "artifactRefs");
  if (sourceIds.length === 0 && artifacts.length === 0) throw new Error("upsert_note requires at least one current mission artifact reference; sourceIds remain unavailable until a trusted positive source verifier exists.");
  const relativePath = filePath(".dove/notes", noteId);
  existingBoundRecord(root, relativePath, mission.missionId, `Note ${noteId}`);
  const note = {
    schemaVersion: 2,
    noteId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    title: typeof args2.title === "string" && args2.title.trim() ? args2.title.trim() : noteId,
    summary: summary || null,
    quotes,
    claims,
    openQuestions,
    sourceIds,
    artifactRefs: artifacts.map((item) => item.path),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  return { ...finalizeDomainArtifacts(root, { actionId: "upsert-note", missionId: mission.missionId, summary: `Recorded note ${noteId}.`, completionEligible: false, writes: [{ path: relativePath, kind: "data", content: domainJson(note), derivedReferences: [...sourceIds.map((id) => `source:${id}`), ...note.artifactRefs.map((item) => `artifact:${item}`)] }] }), note };
}
function draftContent(draft) {
  return `# ${draft.title}

${draft.body}

---
Mission: ${draft.missionId}
Evidence: ${draft.evidenceRefs.join(", ") || "none"}
`;
}
function upsertDraft(root, args2 = {}) {
  assertSealedDomainArgs(args2, DRAFT_FIELDS, "upsert_draft");
  const { mission } = readCurrentMission(root, args2.missionId, "Draft workflow");
  const draftId = domainSafeId(args2.draftId, "draftId");
  const evidenceRefs = normalizeEvidenceRefs(root, mission.missionId, [...domainStringArray(args2.evidenceRefs, "evidenceRefs"), ...domainStringArray(args2.artifactRefs, "artifactRefs").map((value2) => `artifact:${value2}`)]);
  if (evidenceRefs.length === 0) throw new Error("upsert_draft body requires at least one current eligible evidence or artifact reference.");
  const draft = { schemaVersion: 1, draftId, missionId: mission.missionId, title: typeof args2.title === "string" && args2.title.trim() ? args2.title.trim() : draftId, body: domainNonEmptyText(args2.body, "body"), summary: typeof args2.summary === "string" && args2.summary.trim() ? args2.summary.trim() : null, evidenceRefs, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  const relativePath = filePath(".dove/drafts", draftId, "md");
  return { ...finalizeDomainArtifacts(root, { actionId: "upsert-draft", missionId: mission.missionId, summary: `Recorded draft ${draftId}.`, completionEligible: true, writes: [{ path: relativePath, kind: "document", content: draftContent(draft), derivedReferences: evidenceRefs }] }), draft };
}
function upsertDraftMetadata(root, args2 = {}) {
  assertSealedDomainArgs(args2, DRAFT_META_FIELDS, "upsert_draft_metadata");
  const { mission } = readCurrentMission(root, args2.missionId, "Draft metadata workflow");
  const draftId = domainSafeId(args2.draftId, "draftId");
  const draftPath = filePath(".dove/drafts", draftId, "md");
  resolveMissionArtifactReferences(root, mission.missionId, [draftPath], "draftPath");
  const evidenceRefs = normalizeEvidenceRefs(root, mission.missionId, [...domainStringArray(args2.evidenceRefs, "evidenceRefs"), ...domainStringArray(args2.artifactRefs, "artifactRefs").map((value2) => `artifact:${value2}`)]);
  const metadataPath = filePath(".dove/drafts", `${draftId}.metadata`);
  const metadata = { schemaVersion: 1, draftId, missionId: mission.missionId, title: typeof args2.title === "string" && args2.title.trim() ? args2.title.trim() : draftId, summary: typeof args2.summary === "string" && args2.summary.trim() ? args2.summary.trim() : null, evidenceRefs, draftPath, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  return finalizeDomainArtifacts(root, { actionId: "upsert-draft-metadata", missionId: mission.missionId, summary: `Recorded metadata for draft ${draftId}.`, completionEligible: false, writes: [{ path: metadataPath, kind: "data", content: domainJson(metadata), derivedReferences: [`artifact:${draftPath}`, ...evidenceRefs] }] });
}
function runExperienceWorkflow(root, args2 = {}) {
  assertSealedDomainArgs(args2, EXPERIMENT_FIELDS, "run_experience_workflow");
  const { mission } = readCurrentMission(root, args2.missionId, "Experiment workflow");
  const experimentId = domainSafeId(args2.experimentId, "experimentId");
  const protocol = domainNonEmptyText(args2.protocol, "protocol");
  const successCriteria = domainStringArray(args2.successCriteria, "successCriteria", { minItems: 1 });
  const plan = { schemaVersion: 1, experimentId, missionId: mission.missionId, title: typeof args2.title === "string" && args2.title.trim() ? args2.title.trim() : experimentId, goal: domainNonEmptyText(args2.goal, "goal"), hypothesis: domainNonEmptyText(args2.hypothesis, "hypothesis"), protocol, successCriteria, comparisonTargets: domainStringArray(args2.comparisonTargets, "comparisonTargets"), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  const writes = [{ path: filePath(".dove/experiments", `${experimentId}.plan`), kind: "data", content: domainJson(plan), derivedReferences: [] }];
  let result = null;
  let audit = null;
  let bridge = null;
  if (args2.result !== void 0) {
    const resultEvidenceRefs = normalizeEvidenceRefs(root, mission.missionId, args2.resultEvidenceRefs, "resultEvidenceRefs");
    if (resultEvidenceRefs.length === 0) throw new Error("Experiment result requires current mission-bound evidence.");
    result = { schemaVersion: 1, resultId: experimentId, experimentId, missionId: mission.missionId, outcome: domainNonEmptyText(args2.result, "result"), evidenceRefs: resultEvidenceRefs, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    writes.push({ path: filePath(".dove/experiments", `${experimentId}.result`), kind: "data", content: domainJson(result), derivedReferences: resultEvidenceRefs });
    const auditFindings = domainStringArray(args2.auditFindings, "auditFindings");
    const integrityFlags = domainStringArray(args2.integrityFlags, "integrityFlags");
    if (auditFindings.length === 0) throw new Error("Experiment result requires an explicit audit before claim bridging.");
    audit = { schemaVersion: 1, auditId: experimentId, experimentId, resultId: experimentId, missionId: mission.missionId, findings: auditFindings, integrityFlags, passed: integrityFlags.length === 0, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    result.audit = { passed: audit.passed, auditId: audit.auditId };
    writes[writes.length - 1] = { ...writes.at(-1), content: domainJson(result) };
    writes.push({ path: filePath(".dove/experiments", `${experimentId}.audit`), kind: "data", content: domainJson(audit), derivedReferences: [`experiment-result:${experimentId}`] });
    if (args2.claimId !== void 0) {
      if (!audit.passed) throw new Error("Experiment result cannot bridge to a claim while integrity flags remain.");
      const claimId = domainSafeId(args2.claimId, "claimId");
      currentBoundRecord(root, filePath(".dove/claims", claimId), mission.missionId, `Claim ${claimId}`);
      bridge = { schemaVersion: 1, bridgeId: `${experimentId}-${claimId}`, missionId: mission.missionId, experimentId, resultId: experimentId, auditId: experimentId, claimId, reason: domainNonEmptyText(args2.bridgeReason, "bridgeReason"), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      writes.push({ path: filePath(".dove/claims", `${experimentId}-${claimId}.bridge`), kind: "data", content: domainJson(bridge), derivedReferences: [`experiment-result:${experimentId}`, `claim:${claimId}`] });
    }
  } else if (args2.auditFindings !== void 0 || args2.integrityFlags !== void 0 || args2.claimId !== void 0) {
    throw new Error("Experiment audit or claim bridge requires a real result and result evidence.");
  }
  return { ...finalizeDomainArtifacts(root, { actionId: "run-experience-workflow", missionId: mission.missionId, summary: result ? `Recorded experiment ${experimentId} plan, result, and audit.` : `Recorded experiment ${experimentId} protocol.`, completionEligible: Boolean(result && audit?.passed), writes }), plan, result, audit, bridge, hostBoundary: { executesExperiment: false, providerScheduling: false } };
}
function currentOutput(root, outputPath, expectedHash) {
  const canonical = canonicalDomainPath(outputPath, "outputPath");
  const snapshot = snapshotArtifactBuffer(root, canonical, "Figure outputPath");
  if (expectedHash && expectedHash !== snapshot.sha256) throw new Error("Figure output hash does not match the imported file.");
  return snapshot;
}
function runFigureWorkflow(root, args2 = {}) {
  assertSealedDomainArgs(args2, FIGURE_FIELDS, "run_figure_workflow");
  const { mission } = readCurrentMission(root, args2.missionId, "Figure workflow");
  const figureId = domainSafeId(args2.figureId, "figureId");
  const materials = resolveMissionArtifactReferences(root, mission.missionId, args2.materials, "materials");
  if (materials.length === 0) throw new Error("Figure workflow requires current mission-bound materials.");
  const prompt = domainNonEmptyText(args2.prompt, "prompt");
  const writes = [];
  const plan = { schemaVersion: 1, figureId, missionId: mission.missionId, intent: domainNonEmptyText(args2.intent, "intent"), purpose: domainNonEmptyText(args2.purpose, "purpose"), materialRefs: materials.map((item) => item.path), prompt, hostBoundary: "provider-execution-outside-dove", updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  writes.push({ path: filePath(".dove/figures", `${figureId}.plan`), kind: "data", content: domainJson(plan), derivedReferences: plan.materialRefs.map((item) => `artifact:${item}`) });
  let imported = null;
  let qa = null;
  if (args2.outputPath !== void 0) {
    const output = currentOutput(root, args2.outputPath, args2.outputSha256);
    const sourceContent = output.content;
    const extension = path21.extname(output.path).toLowerCase() || ".bin";
    const finalPath = filePath(".dove/figures", `${figureId}.final`, extension.slice(1));
    const caption = domainNonEmptyText(args2.caption, "caption");
    const qaFindings = domainStringArray(args2.qaFindings, "qaFindings");
    const coverage = verifyExpectedReviewCoverage(root, {
      missionId: mission.missionId,
      expectedSnapshots: [{ path: finalPath, sizeBytes: output.sizeBytes, sha256: output.sha256 }],
      requireAuthoritative: true
    });
    imported = { schemaVersion: 1, figureId, missionId: mission.missionId, importedFrom: output.path, finalPath, finalSha256: output.sha256, finalSizeBytes: output.sizeBytes, caption, provenance: { materialRefs: plan.materialRefs, promptSha256: domainSha256(prompt), importedSizeBytes: output.sizeBytes }, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    qa = { schemaVersion: 1, figureId, missionId: mission.missionId, finalPath, finalSha256: output.sha256, findings: qaFindings, reviewCoverage: coverage, status: qaFindings.length ? "needs-fix" : "ready-for-independent-review", updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    writes.push({ path: finalPath, kind: "figure", content: sourceContent, derivedReferences: plan.materialRefs.map((item) => `artifact:${item}`) });
    writes.push({ path: filePath(".dove/figures", `${figureId}.caption`, "md"), kind: "document", content: `${caption}
`, derivedReferences: [`artifact:${finalPath}`] });
    writes.push({ path: filePath(".dove/figures", `${figureId}.provenance`), kind: "data", content: domainJson(imported), derivedReferences: [`artifact:${finalPath}`, ...plan.materialRefs.map((item) => `artifact:${item}`)] });
    writes.push({ path: filePath(".dove/figures", `${figureId}.qa`), kind: "data", content: domainJson(qa), derivedReferences: [`artifact:${finalPath}`] });
  } else if (args2.caption !== void 0 || args2.qaFindings !== void 0 || args2.outputSha256 !== void 0) {
    throw new Error("Figure caption, QA, or hash import requires outputPath.");
  }
  return { ...finalizeDomainArtifacts(root, { actionId: "run-figure-workflow", missionId: mission.missionId, summary: imported ? `Imported figure ${figureId} with provenance and QA.` : `Prepared figure ${figureId} materials and prompt.`, completionEligible: false, writes }), plan, imported, qa, hostBoundary: { executesProvider: false, acceptsImportedOutput: true } };
}
function normalizeRebuttalIssues(root, args2 = {}) {
  assertSealedDomainArgs(args2, /* @__PURE__ */ new Set(["missionId", "issues"]), "normalize_rebuttal_issues");
  const { mission } = readCurrentMission(root, args2.missionId, "Rebuttal issue normalization");
  const issues = normalizeRebuttalIssueItems(root, mission.missionId, args2.issues);
  const record = rebuttalIssuesRecord(mission.missionId, issues);
  return finalizeDomainArtifacts(root, { actionId: "normalize-rebuttal-issues", missionId: mission.missionId, summary: `Normalized ${issues.length} rebuttal issue(s).`, completionEligible: false, writes: [{ path: filePath(".dove/rebuttal", `${mission.missionId}.issues`), kind: "data", content: domainJson(record), derivedReferences: issues.flatMap((item) => [...item.findingRefs.map((id) => `finding:${id}`), ...item.evidenceRefs]) }] });
}
function buildRebuttalStrategy(root, args2 = {}) {
  assertSealedDomainArgs(args2, /* @__PURE__ */ new Set(["missionId", "strategy"]), "build_rebuttal_strategy");
  const { mission } = readCurrentMission(root, args2.missionId, "Rebuttal strategy");
  const issuesPath = filePath(".dove/rebuttal", `${mission.missionId}.issues`);
  const issues = currentBoundRecord(root, issuesPath, mission.missionId, "Rebuttal issues");
  if (!issues?.issues?.length) throw new Error("build_rebuttal_strategy requires normalized mission-bound issues.");
  const strategy = rebuttalStrategyRecord(mission.missionId, issues.issues, args2.strategy);
  return finalizeDomainArtifacts(root, { actionId: "build-rebuttal-strategy", missionId: mission.missionId, summary: "Recorded author-side rebuttal strategy.", completionEligible: false, writes: [{ path: filePath(".dove/rebuttal", `${mission.missionId}.strategy`), kind: "data", content: domainJson(strategy), derivedReferences: [`artifact:${issuesPath}`] }] });
}
function buildRebuttal(root, args2 = {}) {
  assertSealedDomainArgs(args2, REBUTTAL_FIELDS, "build_rebuttal");
  const { mission } = readCurrentMission(root, args2.missionId, "Rebuttal workflow");
  const issuesPath = filePath(".dove/rebuttal", `${mission.missionId}.issues`);
  const strategyPath = filePath(".dove/rebuttal", `${mission.missionId}.strategy`);
  const writes = [];
  const issues = args2.issues !== void 0 ? rebuttalIssuesRecord(mission.missionId, normalizeRebuttalIssueItems(root, mission.missionId, args2.issues)) : currentBoundRecord(root, issuesPath, mission.missionId, "Rebuttal issues");
  if (!issues?.issues?.length) throw new Error("build_rebuttal requires normalized mission-bound issues.");
  if (args2.issues !== void 0) {
    writes.push({ path: issuesPath, kind: "data", content: domainJson(issues), derivedReferences: issues.issues.flatMap((item) => [...item.findingRefs.map((id) => `finding:${id}`), ...item.evidenceRefs]) });
  }
  const strategy = args2.strategy !== void 0 ? rebuttalStrategyRecord(mission.missionId, issues.issues, args2.strategy) : currentBoundRecord(root, strategyPath, mission.missionId, "Rebuttal strategy");
  if (!strategy?.strategy || strategy.missionId !== mission.missionId) throw new Error("build_rebuttal requires an author-side strategy for the requested mission.");
  if (args2.strategy !== void 0) {
    writes.push({ path: strategyPath, kind: "data", content: domainJson(strategy), derivedReferences: [`artifact:${issuesPath}`] });
  }
  if (!Array.isArray(args2.responses) || args2.responses.length === 0) throw new Error("build_rebuttal requires evidence-linked responses.");
  const responses = args2.responses.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`responses[${index}] must be an object.`);
    const unknown = Object.keys(item).filter((field) => !["issueId", "response", "evidenceRefs"].includes(field));
    if (unknown.length) throw new Error(`responses[${index}] does not accept unknown input: ${unknown.join(", ")}.`);
    const issueId = domainSafeId(item.issueId, `responses[${index}].issueId`);
    if (!issues.issues.some((issue) => issue.issueId === issueId)) throw new Error(`responses[${index}] references unknown issue ${issueId}.`);
    const evidenceRefs = normalizeEvidenceRefs(root, mission.missionId, item.evidenceRefs, `responses[${index}].evidenceRefs`);
    if (evidenceRefs.length === 0) throw new Error(`responses[${index}] requires evidence.`);
    return { issueId, response: domainNonEmptyText(item.response, `responses[${index}].response`), evidenceRefs };
  });
  const content = responses.map((item) => `## ${item.issueId}

${item.response}

Evidence: ${item.evidenceRefs.join(", ")}
`).join("\n");
  writes.push({ path: filePath(".dove/rebuttal", `${mission.missionId}.response`, "md"), kind: "document", content, derivedReferences: [`artifact:${issuesPath}`, `artifact:${strategyPath}`, ...responses.flatMap((item) => item.evidenceRefs)] });
  return finalizeDomainArtifacts(root, { actionId: "build-rebuttal", missionId: mission.missionId, summary: "Recorded author-side rebuttal responses.", completionEligible: true, writes });
}
function versionPath(versionId) {
  return filePath(".dove/versions", versionId);
}
function createVersionSnapshot(root, args2 = {}) {
  assertSealedDomainArgs(args2, VERSION_FIELDS, "create_version_snapshot");
  const { mission } = readCurrentMission(root, args2.missionId, "Version snapshot");
  const versionId = domainSafeId(args2.versionId, "versionId");
  if (fs18.existsSync(path21.resolve(root, versionPath(versionId)))) throw new Error(`Version snapshot id is already occupied: ${versionId}.`);
  const artifacts = resolveMissionArtifactReferences(root, mission.missionId, args2.artifactRefs, "artifactRefs");
  if (artifacts.length === 0) throw new Error("create_version_snapshot requires current mission artifacts.");
  const supersedesVersionId = args2.supersedesVersionId === void 0 ? null : domainSafeId(args2.supersedesVersionId, "supersedesVersionId");
  if (supersedesVersionId) {
    currentBoundRecord(root, versionPath(supersedesVersionId), mission.missionId, `Superseded version ${supersedesVersionId}`);
  }
  const copiedArtifacts = artifacts.map(({ path: artifactPath, kind, sha256: sha2567, receiptId }) => {
    const extension = path21.extname(artifactPath);
    const snapshotPath = filePath(path21.posix.join(".dove/versions", versionId, "artifacts"), domainSha256(artifactPath).slice(0, 20), extension ? extension.slice(1) : "bin");
    return { path: artifactPath, kind, sha256: sha2567, receiptId, snapshotPath };
  });
  const snapshot = { schemaVersion: 1, versionId, missionId: mission.missionId, label: typeof args2.label === "string" && args2.label.trim() ? args2.label.trim() : versionId, artifacts: copiedArtifacts, supersedesVersionId, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
  const writes = [
    ...copiedArtifacts.map((item) => ({ path: item.snapshotPath, kind: item.kind, content: fs18.readFileSync(path21.resolve(root, item.path)), derivedReferences: [`artifact:${item.path}`] })),
    { path: versionPath(versionId), kind: "data", content: domainJson(snapshot), derivedReferences: snapshot.artifacts.map((item) => `artifact:${item.path}`) }
  ];
  return finalizeDomainArtifacts(root, { actionId: "create-version-snapshot", missionId: mission.missionId, summary: `Created version snapshot ${versionId}.`, completionEligible: false, writes });
}
function compareVersions(root, args2 = {}) {
  assertSealedDomainArgs(args2, COMPARE_FIELDS, "compare_versions");
  const { mission } = readCurrentMission(root, args2.missionId, "Version comparison");
  const fromVersionId = domainSafeId(args2.fromVersionId, "fromVersionId");
  const toVersionId = domainSafeId(args2.toVersionId, "toVersionId");
  const from = currentBoundRecord(root, versionPath(fromVersionId), mission.missionId, `Version ${fromVersionId}`);
  const to = currentBoundRecord(root, versionPath(toVersionId), mission.missionId, `Version ${toVersionId}`);
  const stale = [...from.artifacts, ...to.artifacts].filter((item) => {
    if (typeof item.snapshotPath !== "string") return true;
    const [snapshotArtifact] = resolveMissionArtifactReferences(root, mission.missionId, [item.snapshotPath], `Version snapshot ${item.snapshotPath}`);
    return snapshotArtifact.sha256 !== item.sha256;
  });
  if (stale.length) throw new Error(`Version comparison refuses stale artifact snapshots: ${[...new Set(stale.map((item) => item.snapshotPath ?? item.path))].join(", ")}.`);
  const fromMap = new Map(from.artifacts.map((item) => [item.path, item.sha256]));
  const toMap = new Map(to.artifacts.map((item) => [item.path, item.sha256]));
  const paths = [.../* @__PURE__ */ new Set([...fromMap.keys(), ...toMap.keys()])].sort();
  const comparison = { schemaVersion: 1, missionId: mission.missionId, fromVersionId, toVersionId, added: paths.filter((item) => !fromMap.has(item)), removed: paths.filter((item) => !toMap.has(item)), changed: paths.filter((item) => fromMap.has(item) && toMap.has(item) && fromMap.get(item) !== toMap.get(item)), comparedAt: (/* @__PURE__ */ new Date()).toISOString() };
  return { status: "compared", zeroWrite: true, comparison, writes: [] };
}
function queryDomainIntegrity(root, missionId = null) {
  const workspace = openDoveWorkspace(root, { operation: "Domain integrity query" });
  const ownership = readArtifactOwnership(root);
  const domainPrefixes = [".dove/sources/", ".dove/notes/", ".dove/claims/", ".dove/experiments/", ".dove/drafts/", ".dove/figures/", ".dove/rebuttal/", ".dove/versions/"];
  const domainArtifacts = ownership.artifacts.filter((item) => domainPrefixes.some((prefix) => item.path.startsWith(prefix))).filter((item) => !missionId || item.missionId === missionId);
  const stale = domainArtifacts.filter((item) => !fs18.existsSync(path21.resolve(root, item.path)) || domainSha256(fs18.readFileSync(path21.resolve(root, item.path))) !== item.sha256);
  return { workspaceId: workspace.manifest.workspaceId, missionId, artifactCount: domainArtifacts.length, staleArtifactCount: stale.length, stalePaths: stale.map((item) => item.path) };
}

// src/core/mission-queries.mjs
function statusDetail(args2 = {}) {
  const detail = args2.detail ?? "compact";
  if (detail !== "compact" && detail !== "full") throw new Error("Dove status detail must be compact or full.");
  return detail;
}
function responseLanguage(args2 = {}) {
  return args2.responseLanguage === "en" || args2.language === "en" ? "en" : "zh";
}
function compactDomainIntegrity(integrity) {
  return {
    artifactCount: integrity.artifactCount,
    staleArtifactCount: integrity.staleArtifactCount,
    stalePaths: integrity.stalePaths
  };
}
function readCurrentMissions(root, options = {}) {
  const workspace = openDoveWorkspace(root, { allowAbsent: options.allowAbsent === true, operation: options.operation ?? "Dove mission query" });
  if (workspace.state === "absent") return { workspace, missions: [] };
  const missionsRoot = path22.resolve(root, ARTIFACT_PATHS.missionsDir);
  const missions = fs19.readdirSync(missionsRoot, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => {
    const relativePath = path22.posix.join(ARTIFACT_PATHS.missionsDir, entry.name);
    let mission;
    try {
      mission = JSON.parse(fs19.readFileSync(path22.resolve(root, relativePath), "utf8"));
    } catch (error) {
      throw new Error(`Malformed durable JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    assertCurrentMissionContract2(mission);
    return mission;
  }).sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)) || left.missionId.localeCompare(right.missionId));
  return { workspace, missions };
}
function emptyStatus(args2, language, detail) {
  const headline = language === "en" ? "Dove is not initialized in this workspace." : "\u5F53\u524D workspace \u5C1A\u672A\u521D\u59CB\u5316 Dove\u3002";
  const result = {
    mode: "dove-status-query",
    query: true,
    proposalOnly: true,
    noAutoApply: true,
    intent: typeof args2.intent === "string" ? args2.intent.trim() || null : null,
    responseLanguage: language,
    detail: "compact",
    detailsAvailable: true,
    summary: headline,
    headline,
    scope: { kind: "minimal-mission-workspace", schemaVersion: null, state: "absent" },
    currentContext: { missionCount: 0, receiptCount: 0, sourceCount: 0, integrityAssessment: null, domainIntegrity: null, reviewValidity: null },
    nextStep: { label: language === "en" ? "Run dove init, inspect the proposal, and confirm the exact replay data." : "\u8FD0\u884C dove init\uFF0C\u68C0\u67E5 proposal\uFF0C\u5E76\u786E\u8BA4 exact replay data\u3002" },
    needsAttention: { status: "needs-init", summary: language === "en" ? "A confirmed initialization is required before durable Dove work can begin." : "\u5F00\u59CB durable Dove \u5DE5\u4F5C\u524D\u9700\u8981\u5148\u786E\u8BA4\u521D\u59CB\u5316\u3002" },
    changes: { intent: "none", applied: false, count: 0, rollback: "not-applicable" },
    showMore: { detailsAvailable: true },
    optionalMissionDetails: null,
    statusHome: null
  };
  result.statusHome = {
    presentation: "dove-project-situation-home",
    detail: result.detail,
    liveContextFirst: true,
    intent: result.intent,
    headline,
    scope: result.scope,
    currentContext: result.currentContext,
    nextStep: result.nextStep,
    needsAttention: result.needsAttention,
    changes: result.changes,
    showMore: result.showMore,
    optionalMissionDetails: null,
    detailsAvailable: true
  };
  return detail === "full" ? { ...result, detail: "full", manifest: null, project: null, missions: [], integrityAssessment: null, domainIntegrity: null, sourceIntegrity: null, reviewValidity: null, diagnostics: { artifactPathsRead: [], noRefresh: true, noCommandExecution: true, noExternalProcess: true, noGitInspection: true, noSourceMutation: true } } : result;
}
function queryDoveStatus(root, args2 = {}) {
  if (!args2 || typeof args2 !== "object" || Array.isArray(args2)) throw new Error("Dove status arguments must be a plain object.");
  const allowed = /* @__PURE__ */ new Set(["missionId", "intent", "detail", "responseLanguage", "language"]);
  const unknown = Object.keys(args2).filter((field) => !allowed.has(field));
  if (unknown.length > 0) throw new Error(`Dove status does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  const language = responseLanguage(args2);
  const detail = statusDetail(args2);
  const { workspace, missions } = readCurrentMissions(root, { allowAbsent: true, operation: "Dove status" });
  if (workspace.state === "absent") return emptyStatus(args2, language, detail);
  const requestedMissionId = typeof args2.missionId === "string" ? args2.missionId.trim() : "";
  const selectedMission = requestedMissionId ? missions.find((mission) => mission.missionId === requestedMissionId) ?? null : missions.length === 1 ? missions[0] : null;
  if (requestedMissionId && !selectedMission) throw new Error(`Mission does not exist: ${requestedMissionId}.`);
  const missionScope = requestedMissionId ? "explicit" : missions.length === 0 ? "none" : missions.length === 1 ? "only-mission" : "workspace";
  const scopedMissions = selectedMission ? [selectedMission] : missionScope === "workspace" ? missions : [];
  const integrityAssessment = selectedMission ? assessMissionCompletion(root, { missionId: selectedMission.missionId }) : null;
  const researchTree = selectedMission ? readResearchTree(root, selectedMission.missionId, { operation: "Dove status research tree" }) : null;
  const compactResearchTree = researchTreeProjection(researchTree, "compact");
  const receipts = readExecutionReceipts(root, selectedMission?.missionId ?? null);
  const malformedReceipt = receipts.find((receipt) => receipt.__readFailure);
  if (malformedReceipt) throw new Error(`Malformed durable JSON in ${path22.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${malformedReceipt.receiptId}.json`)}: ${malformedReceipt.__readFailure}`);
  const domainIntegrity = queryDomainIntegrity(root, selectedMission?.missionId ?? null);
  const sourceItems = scopedMissions.flatMap((mission) => querySources(root, { missionId: mission.missionId, limit: 200 }).items);
  const requiredSourceIds = selectedMission ? [...new Set(selectedMission.evidenceRequirements.filter((requirement) => requirement.startsWith("source:")).map((requirement) => requirement.slice("source:".length)))] : [];
  const requiredSources = selectedMission ? evaluateSourceIds(root, requiredSourceIds, selectedMission.missionId).map((evaluation) => ({
    sourceId: evaluation.sourceId,
    lifecycle: evaluation.source?.lifecycle ?? "missing",
    eligible: evaluation.eligible === true,
    reason: evaluation.reason
  })) : [];
  const sourceIntegrity = {
    sourceCount: sourceItems.length,
    eligibleCount: sourceItems.filter((item) => item.eligibility?.eligible === true).length,
    candidateCount: sourceItems.filter((item) => item.lifecycle === "candidate").length,
    rejectedCount: sourceItems.filter((item) => item.lifecycle === "rejected").length,
    invalidCount: 0,
    required: requiredSources
  };
  const requiresSourceEvidence = requiredSourceIds.length > 0;
  const requiresReviewEvidence = selectedMission?.evidenceRequirements?.includes("review:authoritative") === true;
  const reviewValidity = selectedMission && requiresReviewEvidence ? verifyReviewCoverage(root, { missionId: selectedMission.missionId, requireAuthoritative: true }) : { covered: false, authoritative: false, failures: [] };
  const sourceGaps = requiresSourceEvidence ? requiredSources.filter((item) => item.eligible !== true) : [];
  const reviewGaps = requiresReviewEvidence ? reviewValidity.failures ?? [] : [];
  const headline = language === "en" ? `Dove schema ${workspace.schemaVersion} is healthy with ${missions.length} mission contract${missions.length === 1 ? "" : "s"}.` : `Dove schema ${workspace.schemaVersion} \u5065\u5EB7\uFF0C\u5F53\u524D\u6709 ${missions.length} \u4E2A mission contract\u3002`;
  const supersededByMissionId = integrityAssessment?.supersededByMissionId ?? null;
  const stableGaps = {
    completion: integrityAssessment?.incompleteReasons ?? [],
    dependencies: integrityAssessment?.dependencyCoverage?.filter((dependency) => !dependency.complete) ?? [],
    supersession: supersededByMissionId ? { supersededByMissionId } : null,
    sources: sourceGaps,
    domain: domainIntegrity.stalePaths ?? [],
    review: reviewGaps
  };
  const attentionReasons = [
    ...stableGaps.completion,
    ...stableGaps.domain,
    ...stableGaps.sources.length > 0 ? ["source-evidence-unavailable"] : [],
    ...stableGaps.review.length > 0 ? ["review-evidence-unavailable"] : [],
    ...sourceIntegrity.invalidCount > 0 ? ["invalid-source-verification"] : []
  ];
  const currentContext = {
    missionCount: missions.length,
    missionScope,
    selectedMissionId: selectedMission?.missionId ?? null,
    receiptCount: receipts.length,
    sourceCount: sourceIntegrity.sourceCount,
    integrityAssessment: integrityAssessment ? {
      status: integrityAssessment.status,
      complete: integrityAssessment.complete,
      supersededByMissionId,
      dependencyCoverage: integrityAssessment.dependencyCoverage,
      staleReceiptCount: integrityAssessment.staleReceiptIds.length,
      incompleteReasons: integrityAssessment.incompleteReasons
    } : null,
    domainIntegrity: compactDomainIntegrity(domainIntegrity),
    reviewValidity: { covered: reviewValidity.covered === true, authoritative: reviewValidity.authoritative === true, failures: reviewValidity.failures ?? [] },
    researchTree: compactResearchTree
  };
  const result = {
    mode: "dove-status-query",
    query: true,
    proposalOnly: true,
    noAutoApply: true,
    intent: typeof args2.intent === "string" ? args2.intent.trim() || null : null,
    responseLanguage: language,
    detail: "compact",
    detailsAvailable: true,
    summary: headline,
    headline,
    scope: { kind: "minimal-mission-workspace", schemaVersion: workspace.schemaVersion, missionScope, missionId: selectedMission?.missionId ?? null },
    currentContext,
    nextStep: missionScope === "workspace" ? { label: language === "en" ? "Choose a mission explicitly with dove status --mission-id <id> --json." : "\u4F7F\u7528 dove status --mission-id <id> --json \u663E\u5F0F\u9009\u62E9 mission\u3002", command: 'node ./bin/dove-package.mjs status . --mission-id "<mission id>" --json', mcpTool: "query_dove_status" } : selectedMission ? supersededByMissionId ? {
      label: language === "en" ? `Mission ${selectedMission.missionId} is read-only history; continue with successor ${supersededByMissionId}.` : `Mission ${selectedMission.missionId} \u5DF2\u6210\u4E3A\u53EA\u8BFB\u5386\u53F2\uFF1B\u8BF7\u7EE7\u7EED\u5904\u7406\u540E\u7EE7 mission ${supersededByMissionId}\u3002`,
      command: `node ./bin/dove-package.mjs status . --mission-id "${supersededByMissionId}" --json`,
      mcpTool: "query_dove_status"
    } : { label: language === "en" ? "Address the listed mission gaps, then reassess completion." : "\u5904\u7406\u5217\u51FA\u7684 mission \u7F3A\u53E3\uFF0C\u7136\u540E\u91CD\u65B0\u8BC4\u4F30\u5B8C\u6210\u5EA6\u3002", command: `node ./bin/dove-package.mjs status . --mission-id "${selectedMission.missionId}" --json`, mcpTool: "query_dove_status" } : { label: language === "en" ? "Create one minimal mission contract." : "\u521B\u5EFA\u4E00\u4E2A\u6700\u5C0F mission contract\u3002", command: 'node ./bin/dove-package.mjs mission . --goal "<mission goal>" --mutation-mode direct-process --json', mcpTool: "create_dove_mission" },
    needsAttention: missionScope === "workspace" ? { status: "mission-selection-required", summary: language === "en" ? "More than one mission exists; status did not select an implicit latest mission." : "\u5B58\u5728\u591A\u4E2A mission\uFF1Bstatus \u4E0D\u4F1A\u9690\u5F0F\u9009\u62E9\u6700\u65B0 mission\u3002", reasons: ["explicit-mission-required"], missionOptions: missions.map((mission) => ({ missionId: mission.missionId, goal: mission.goal })) } : attentionReasons.length ? {
      status: supersededByMissionId ? "superseded" : "incomplete",
      summary: supersededByMissionId ? language === "en" ? `This mission was superseded by ${supersededByMissionId} and is read-only history.` : `\u8BE5 mission \u5DF2\u88AB ${supersededByMissionId} \u53D6\u4EE3\uFF0C\u73B0\u4E3A\u53EA\u8BFB\u5386\u53F2\u3002` : language === "en" ? "Current mission or domain evidence is incomplete." : "\u5F53\u524D mission \u6216\u9886\u57DF\u8BC1\u636E\u5C1A\u4E0D\u5B8C\u6574\u3002",
      reasons: attentionReasons,
      stableGaps
    } : { status: "clear", summary: language === "en" ? "No current mission or domain integrity failure is present." : "\u5F53\u524D\u6CA1\u6709 mission \u6216\u9886\u57DF\u5B8C\u6574\u6027\u5931\u8D25\u3002", stableGaps },
    changes: { intent: "none", applied: false, count: 0, rollback: "not-applicable" },
    showMore: { detailsAvailable: true },
    optionalMissionDetails: null,
    statusHome: null
  };
  result.statusHome = { presentation: "dove-project-situation-home", detail: result.detail, liveContextFirst: true, intent: result.intent, headline, scope: result.scope, currentContext, nextStep: result.nextStep, needsAttention: result.needsAttention, changes: result.changes, showMore: result.showMore, optionalMissionDetails: null, detailsAvailable: true };
  if (detail !== "full") return result;
  return {
    ...result,
    detail: "full",
    manifest: workspace.manifest,
    project: workspace.project,
    missions: selectedMission ? [selectedMission] : missions,
    integrityAssessment,
    domainIntegrity,
    sourceIntegrity,
    reviewValidity,
    researchTree: researchTreeProjection(researchTree, "full"),
    diagnostics: {
      artifactPathsRead: [ARTIFACT_PATHS.doveRootManifest, ARTIFACT_PATHS.projectIdentity, ARTIFACT_PATHS.missionsDir, ARTIFACT_PATHS.executionReceiptsDir, ARTIFACT_PATHS.researchTreesDir, ".dove/sources"],
      noRefresh: true,
      noCommandExecution: true,
      noExternalProcess: true,
      noGitInspection: true,
      noSourceMutation: true
    }
  };
}

// src/core/strict-json.mjs
function duplicateKeyError(label, key, path25) {
  throw new Error(`${label} must not contain duplicate JSON object keys: ${path25 === "$" ? key : `${path25}.${key}`}.`);
}
function parseJsonWithoutDuplicateKeys(text, label = "JSON input") {
  if (typeof text !== "string") throw new Error(`${label} must contain valid JSON.`);
  let index = 0;
  function skipWhitespace() {
    while (/\s/u.test(text[index] ?? "")) index += 1;
  }
  function parseString() {
    if (text[index] !== '"') throw new Error(`${label} must contain valid JSON.`);
    const start = index;
    index += 1;
    let escaped = false;
    while (index < text.length) {
      const character = text[index];
      index += 1;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === '"') {
        return JSON.parse(text.slice(start, index));
      }
      if (character.charCodeAt(0) < 32) throw new Error(`${label} must contain valid JSON.`);
    }
    throw new Error(`${label} must contain valid JSON.`);
  }
  function parseNumber() {
    const match = text.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u);
    if (!match) throw new Error(`${label} must contain valid JSON.`);
    index += match[0].length;
  }
  function parseArray(path25) {
    index += 1;
    skipWhitespace();
    if (text[index] === "]") {
      index += 1;
      return;
    }
    let itemIndex = 0;
    while (true) {
      parseValue(`${path25}[${itemIndex}]`);
      itemIndex += 1;
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      if (text[index] !== ",") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      skipWhitespace();
    }
  }
  function parseObject(path25) {
    index += 1;
    skipWhitespace();
    if (text[index] === "}") {
      index += 1;
      return;
    }
    const keys = /* @__PURE__ */ new Set();
    while (true) {
      const key = parseString();
      if (keys.has(key)) duplicateKeyError(label, key, path25);
      keys.add(key);
      skipWhitespace();
      if (text[index] !== ":") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      parseValue(path25 === "$" ? `$.${key}` : `${path25}.${key}`);
      skipWhitespace();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      if (text[index] !== ",") throw new Error(`${label} must contain valid JSON.`);
      index += 1;
      skipWhitespace();
    }
  }
  function parseValue(path25) {
    skipWhitespace();
    const character = text[index];
    if (character === "{") parseObject(path25);
    else if (character === "[") parseArray(path25);
    else if (character === '"') parseString();
    else if (character === "-" || /\d/u.test(character ?? "")) parseNumber();
    else if (text.startsWith("true", index)) index += 4;
    else if (text.startsWith("false", index)) index += 5;
    else if (text.startsWith("null", index)) index += 4;
    else throw new Error(`${label} must contain valid JSON.`);
    skipWhitespace();
  }
  try {
    parseValue("$");
    skipWhitespace();
    if (index !== text.length) throw new Error(`${label} must contain valid JSON.`);
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${label} must not contain duplicate`)) throw error;
    throw new Error(`${label} must contain valid JSON.`);
  }
}

// scripts/generate-command-adapters.mjs
import fs20 from "node:fs";
import path23 from "node:path";
import { fileURLToPath } from "node:url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path23.dirname(__filename);
var PACKAGE_ROOT = path23.resolve(__dirname, "..");
function markdownTitle(command3) {
  return command3.title.replace(/\b\w/g, (char) => char.toUpperCase());
}
function yamlString(value2) {
  return JSON.stringify(String(value2).replace(/\n/g, " "));
}
function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
function policyLine(command3) {
  switch (command3.policy) {
    case "proposal-only":
      return "Only inspect and suggest; wait for explicit approval before changing anything.";
    case "query":
      return "Keep every read and query strictly read-only with zero writes; never bootstrap, refresh, or mutate state from the query path.";
    case "guarded-mutation":
      return "Only make the specific change requested for this command; do not bundle unrelated work.";
    case "explicit-approval":
      return "Ask for approval before making the proposed change.";
    case "governed-bookkeeping":
      return "Add only the explicit note or lesson the operator asked for.";
    case "guidance":
      return "Give workflow guidance only; move real changes through the matching Dove request.";
    case "isolated-handoff":
      return "Use only the reviewer materials the operator provides; do not share hidden session context.";
    default:
      return "Stay within this command's purpose and keep implementation details out of the default answer.";
  }
}
function dailyUseBullets(command3) {
  const ux = command3.ux ?? {};
  return [
    ...Array.isArray(ux.dailyFlow) ? ux.dailyFlow : [],
    ux.targetingBehavior ? `Targeting: ${ux.targetingBehavior}` : null,
    ux.confirmationBehavior ? `Confirmation: ${ux.confirmationBehavior}` : null,
    ux.expectedOutcome ? `Outcome: ${ux.expectedOutcome}` : null
  ].filter(Boolean);
}
function exampleBullets(command3, hostId = null) {
  const examples = command3.ux?.examples;
  if (!Array.isArray(examples)) {
    return [];
  }
  return examples.map((example) => {
    const text = String(example).trim();
    return hostId === "opencode" ? text.replace(/^\/dove:/u, "/dove.") : text;
  }).filter(Boolean);
}
function mcpInvocationBullets(command3) {
  const tools = unique(command3.requiredTools ?? []);
  const toolList = tools.map((tool) => `\`${tool}\``).join(", ");
  const bullets = [
    `Use only the Dove MCP tool matching the requested operation from this command's allowed tools: ${toolList}.`,
    "Pass only structured public arguments accepted by that tool. Call Dove through MCP only. If MCP is unavailable, stop instead of using another route.",
    "For checkpoint operations, let the MCP tool handle its one approval and application inside the same call. Never display or request proposal, replay, workspace, digest, token, mutation-mode, confirmation payload, or generated-command data."
  ];
  if (command3.continuation === "resume-original") {
    bullets.push("Preserve the full original user request before calling Dove. After a successful Dove write, resume that same request in the current host turn using normal host planning, tools, files, testing, search, and review rather than ending at the Dove result.");
  }
  if (command3.explicitStopMode === "create-only") {
    bullets.push("Stop after the Dove checkpoint only when the user explicitly asked solely to create or reevaluate the mission, to create it without execution, or to wait for another instruction. Words such as 'first' or 'before continuing' express order and do not by themselves request a stop.");
  }
  if (command3.explicitStopMode === "protocol-only") {
    bullets.push("Stop after recording the experiment protocol only when the user explicitly asked for protocol-only setup; otherwise continue the requested experiment work with host tools when it is feasible in this turn.");
  }
  if (command3.continuation === "resume-original") {
    bullets.push("If the Dove call is declined, cancelled, or fails, do not continue work that depended on the unsaved checkpoint; report the practical outcome in ordinary language.");
  }
  if (command3.closure === "host-outcome") {
    const closureTools = unique(command3.closureTools ?? []);
    if (closureTools.length !== 1) throw new Error(`${command3.id} must declare exactly one host outcome closure tool.`);
    bullets.push(`Before the create checkpoint, generate one private safe mission id, pass it as \`missionId\`, and retain it only for this host turn; never show it to the user. After successful substantive host work, call the MCP tool \`${closureTools[0]}\` at most once. Reuse that exact mission id. Pass only that mission id, a concise outcome summary, paths actually created or materially changed, and optional real validation-output paths.`);
    bullets.push("Do not calculate or pass receipt identifiers, timestamps, fingerprints, contract data, artifact kinds, validation kinds, criterion claims, task ids, or session ids. Do not call closure after create-only, proposal-only, declined, cancelled, failed, or blocked work, and never retry it automatically.");
    bullets.push("A skipped closure is a valid zero-write outcome. If evidence recording fails, preserve every host-produced file and report that the substantive work succeeded but Dove could not record or assess its evidence; never roll back or delete the real work.");
  }
  return bullets;
}
function guardrailBullets(command3) {
  const bullets = [
    "For daily answers, answer the Dove request the operator invoked. Only use an explicitly listed project check or action below; do not construct default answers by manually reading or listing internal files.",
    "If the requested work cannot be finished here, say the practical result in ordinary language instead of reading or dumping internal files.",
    "If an explicitly listed project check or action fails, report that message in ordinary language and stop; do not recover by manually reading internal files.",
    ...mcpInvocationBullets(command3),
    "Treat Dove's returned answer as the source of truth; translate it into practical operator actions instead of repeating implementation details.",
    ...command3.id === "dove.init" ? ["For the visible initialization approval, say only that no files have changed, what minimal project records and goal will be saved, and ask whether to approve or cancel. Do not print or paraphrase schema versions, workspace identifiers, hashes, proposal tokens, confirmation payloads, replay fields, generated commands, or internal paths."] : [],
    "Use ordinary mission wording in user-facing answers: what happened, what material is ready, what is missing, and the next action; do not explain why a tool is unavailable by default.",
    "When the target work is unclear, ask the operator to choose by visible mission goal or numbered option; do not ask for internal ids in the default answer.",
    "Honor Dove's response language preference; respond in Chinese by default unless the project asks for English.",
    "When answering in Chinese, use natural Chinese section wording instead of English workflow labels such as Review Findings, Response Strategy, Draft Response, Evidence Needed, or claim impact.",
    policyLine(command3),
    ...command3.adapterConstraints ?? [],
    "Keep Planner, Builder, and Reviewer responsibilities separate: scope, execution, and independent review should not be blended."
  ];
  if (command3.id === "dove.mission") {
    bullets.push("Keep the returned mission or research-tree material identical to the approved content; do not add a role, route, authority, status, or blocker-routing instruction.");
  } else if (command3.domain === "paper") {
    bullets.push("Use the top-level Dove requests for sources, notes, drafting, review, rebuttal, experiences, figures, and version lineage.");
  } else {
    bullets.push("Use this shared Dove mission flow across paper, engineering, experiment, review, and general missions; move concrete work through top-level Dove requests.");
  }
  if (command3.id !== "dove.mission") {
    bullets.push("Return the next action, evidence expectations, and unresolved blockers without claiming work that was not performed.");
  }
  return bullets;
}
function renderBullets(bullets) {
  return bullets.map((bullet) => `- ${bullet}`).join("\n");
}
function renderNumbered(bullets) {
  return bullets.map((bullet, index) => `${index + 1}. ${bullet}`).join("\n");
}
function renderExamples(command3, hostId = null) {
  const examples = exampleBullets(command3, hostId);
  return examples.length > 0 ? `

## Examples

${examples.map((example) => `- \`${example}\``).join("\n")}` : "";
}
function renderBody(command3, heading, hostId = null) {
  const dailyUse = renderBullets(dailyUseBullets(command3));
  const examples = renderExamples(command3, hostId);
  const guardrails = renderNumbered(guardrailBullets(command3));
  return `# ${heading}

${command3.summary}

## Daily use

${dailyUse}${examples}

## Operating rules

${guardrails}
`;
}
function renderFrontmatter(command3, fields = {}) {
  const lines = ["---"];
  if (fields.name) {
    lines.push(`name: ${fields.name}`);
  }
  lines.push(`description: ${yamlString(command3.summary)}`);
  lines.push("---", "");
  return lines.join("\n");
}
function renderMarkdownCommand(command3, heading, hostId = null) {
  return `${renderFrontmatter(command3)}
${renderBody(command3, heading, hostId)}`;
}
function renderSkill(command3, hostId = null) {
  const name = `dove-${hostCommandSlug(command3.id)}`;
  return `${renderFrontmatter(command3, { name })}
${renderBody(command3, markdownTitle(command3), hostId)}`;
}
function renderCommandAdapter(hostId, command3) {
  switch (hostId) {
    case "opencode":
    case "claude":
      return renderMarkdownCommand(command3, command3.id, hostId);
    case "cursor":
      return renderMarkdownCommand(command3, `dove-${hostCommandSlug(command3.id)}`, hostId);
    case "codex":
    case "agents":
      return renderSkill(command3, hostId);
    default:
      throw new Error(`Unknown host adapter: ${hostId}`);
  }
}
function generatedAdapterEntries() {
  return PROJECT_HOST_IDS.flatMap((hostId) => COMMAND_SURFACES.map((command3) => ({
    hostId,
    command: command3,
    relativePath: adapterPathForCommand(hostId, command3),
    content: renderCommandAdapter(hostId, command3)
  })));
}
function generatedClaudeUserCommandEntries() {
  return COMMAND_SURFACES.map((command3) => ({
    hostId: "claude",
    command: command3,
    relativePath: adapterPathForCommand("claude", command3),
    content: renderCommandAdapter("claude", command3)
  }));
}

// bin/dove.mjs
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path24.dirname(__filename2);
var PACKAGE_ROOT2 = path24.resolve(__dirname2, "..");
var LOCAL_COMMANDS = /* @__PURE__ */ new Set(["init", "mission", "receipt", "status", "lessons", "version", "source", "note", "draft", "experience", "figure", "review", "rebuttal"]);
var PUBLIC_COMMANDS = new Set(COMMAND_SURFACES.map((surface2) => surface2.id.replace(/^dove\./u, "")));
function usage() {
  console.log(`dove

Usage:
  dove init [target] --goal <text> [--archive-reset]
  dove mission [target] --goal <text>
  dove mission [target] --operation reevaluate-research-tree --mission-id <id> --requirement <text> --node-update-json <json>
  dove receipt [target] --input <receipt.json>
  dove status [target] [--mission-id <id>] [--detail compact|full]
  dove lessons [query|record] [target] [--mission-id <id>]
  dove source [query|register|verify] [target] --mission-id <id> [--source-id <id>]
  dove note [target] --mission-id <id> --note-id <id>
  dove draft [target] --mission-id <id> --draft-id <id>
  dove experience [target] --mission-id <id> --experiment-id <id>
  dove figure [target] --mission-id <id> --figure-id <id>
  dove review [target] --mission-id <id> <--preflight|--prepare|--import|--verify-coverage>
  dove rebuttal [target] --mission-id <id>
  dove version [target] --mission-id <id>
  dove install [target] --host <opencode|codex|cursor|agents|claude|all>
  dove sync [target] --host <opencode|codex|cursor|agents|claude|all>
  dove doctor [target]

Dove persists only schema 9 mission, advisory lesson, execution receipt ledger, source, domain, review, rebuttal, research-tree, and version artifacts.
`);
}
function readFlagValue(args2, flag) {
  const index = args2.indexOf(flag);
  return index >= 0 && index + 1 < args2.length ? args2[index + 1] : null;
}
function readFlagValues(args2, flag) {
  const values = [];
  for (let index = 0; index < args2.length; index += 1) {
    if (args2[index] === flag && index + 1 < args2.length) {
      values.push(args2[index + 1]);
      index += 1;
    }
  }
  return values;
}
function definedObject(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value2]) => value2 !== void 0 && value2 !== null));
}
function optionalFlagValue(args2, flag) {
  return args2.includes(flag) ? readFlagValue(args2, flag) : void 0;
}
function optionalFlagValues(args2, flag) {
  return args2.includes(flag) ? readFlagValues(args2, flag) : void 0;
}
function parseJson(value2, label) {
  try {
    return JSON.parse(value2);
  } catch (error) {
    throw new Error(`${label} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function parseRepeatedJson(args2, flag) {
  return readFlagValues(args2, flag).map((value2) => parseJson(value2, flag));
}
function mutationMode(args2, fallback = "patch-plan") {
  const value2 = readFlagValue(args2, "--mutation-mode") ?? fallback;
  if (!["patch-plan", "direct-process"].includes(value2)) throw new Error("--mutation-mode must be patch-plan or direct-process.");
  return value2;
}
function withoutMutationMode(args2) {
  const result = [];
  for (let index = 0; index < args2.length; index += 1) {
    if (args2[index] === "--mutation-mode") {
      index += 1;
    } else {
      result.push(args2[index]);
    }
  }
  return result;
}
function resolveTarget(rawTarget2) {
  return path24.resolve(process3.cwd(), rawTarget2 || ".");
}
function targetAndArgs(rawTarget2, args2) {
  return !rawTarget2 || rawTarget2.startsWith("-") ? { target: resolveTarget("."), args: rawTarget2 ? [rawTarget2, ...args2] : args2 } : { target: resolveTarget(rawTarget2), args: args2 };
}
function runMutation(target2, actionId, args2, callback, fallback = "patch-plan") {
  const cleanArgs = withoutMutationMode(args2);
  const result = runWithMutationContext(target2, { actionId, mutationMode: mutationMode(args2, fallback), hostId: "cli" }, () => callback(cleanArgs));
  return resolveExecutionReceiptPostCommit(target2, result);
}
function shellQuote(value2) {
  return `'${String(value2 ?? "").replace(/'/gu, `'"'"'`)}'`;
}
function proposalToken(result) {
  return result?.confirmation?.proposalToken ?? null;
}
function proposalCommand(command3, result, target2, token = proposalToken(result)) {
  const mode = result?.confirmation?.mutationMode ?? result?.confirmation?.confirmArgs?.mutationMode;
  if (!token || !mode) return null;
  return ["node", shellQuote(__filename2), command3, shellQuote(target2), "--proposal-token", shellQuote(token), "--confirmed", "--mutation-mode", shellQuote(mode), "--json"].join(" ");
}
function withProposalCommand(command3, result, target2) {
  const token = proposalToken(result);
  const exactConfirmationCommand = proposalCommand(command3, result, target2, token);
  return exactConfirmationCommand ? { ...result, confirmation: { ...result.confirmation, exactConfirmationCommand } } : result;
}
function decodeProposalToken(token, label) {
  if (!token || !/^[A-Za-z0-9_-]+$/u.test(token)) throw new Error(`--proposal-token must be the exact token returned by the Dove ${label} proposal.`);
  let payload;
  try {
    payload = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    throw new Error(`--proposal-token is malformed. Request a fresh Dove ${label} proposal.`);
  }
  if (!payload?.confirmArgs || typeof payload.confirmArgs !== "object" || Array.isArray(payload.confirmArgs)) throw new Error(`--proposal-token is not a supported Dove ${label} token.`);
  return payload;
}
function initArgs(args2) {
  const token = readFlagValue(args2, "--proposal-token");
  if (token) return { ...decodeProposalToken(token, "init").confirmArgs, confirmed: args2.includes("--confirmed") };
  return definedObject({
    goal: optionalFlagValue(args2, "--goal"),
    archiveReset: args2.includes("--archive-reset") ? true : void 0,
    confirmed: args2.includes("--confirmed") ? true : void 0,
    proposalDigest: optionalFlagValue(args2, "--proposal-digest"),
    mutationMode: mutationMode(args2, "direct-process")
  });
}
function missionArgs(args2) {
  const token = readFlagValue(args2, "--proposal-token");
  if (token) {
    const payload = decodeProposalToken(token, "mission");
    return { ...payload.confirmArgs, confirmed: args2.includes("--confirmed"), mutationMode: payload.mutationMode ?? payload.confirmArgs.mutationMode };
  }
  const operation = optionalFlagValue(args2, "--operation");
  return definedObject({
    operation,
    confirmed: args2.includes("--confirmed") ? true : void 0,
    mutationMode: mutationMode(args2, "direct-process"),
    proposalDigest: optionalFlagValue(args2, "--proposal-digest"),
    missionId: optionalFlagValue(args2, "--mission-id"),
    goal: optionalFlagValue(args2, "--goal"),
    scope: optionalFlagValues(args2, "--scope"),
    outOfScope: optionalFlagValues(args2, "--out-of-scope"),
    targetArtifacts: optionalFlagValues(args2, "--target-artifact"),
    expectedArtifacts: optionalFlagValues(args2, "--expected-artifact"),
    completionCriteria: optionalFlagValues(args2, "--completion-criterion"),
    evidenceRequirements: optionalFlagValues(args2, "--evidence-requirement"),
    dependsOnMissionIds: optionalFlagValues(args2, "--depends-on-mission-id"),
    supersedesMissionId: optionalFlagValue(args2, "--supersedes-mission-id"),
    requirement: optionalFlagValue(args2, "--requirement"),
    nodeUpdates: args2.includes("--node-update-json") ? parseRepeatedJson(args2, "--node-update-json") : void 0
  });
}
function lessonQueryArgs(args2) {
  return Object.fromEntries(Object.entries({
    lessonId: readFlagValue(args2, "--lesson-id") ?? void 0,
    missionId: readFlagValue(args2, "--mission-id") ?? void 0,
    scope: readFlagValue(args2, "--scope") ?? void 0,
    kind: readFlagValue(args2, "--kind") ?? void 0,
    tags: readFlagValues(args2, "--tag"),
    artifactRefs: readFlagValues(args2, "--artifact"),
    includeSuperseded: args2.includes("--include-superseded"),
    includeUnscoped: args2.includes("--include-unscoped"),
    limit: readFlagValue(args2, "--limit") ?? void 0
  }).filter(([, value2]) => value2 !== void 0));
}
function lessonRecordArgs(args2) {
  const token = readFlagValue(args2, "--proposal-token");
  if (token) {
    const payload = decodeProposalToken(token, "lesson");
    return { ...payload.confirmArgs, proposalToken: token, confirmed: args2.includes("--confirmed"), mutationMode: payload.mutationMode ?? payload.confirmArgs.mutationMode };
  }
  if (args2.includes("--confirmed")) throw new Error("dove lessons record --confirmed requires the exact --proposal-token returned by the proposal.");
  return {
    mutationMode: mutationMode(args2, "direct-process"),
    missionId: readFlagValue(args2, "--mission-id"),
    lessonId: readFlagValue(args2, "--lesson-id"),
    scope: readFlagValue(args2, "--scope"),
    kind: readFlagValue(args2, "--kind"),
    summary: readFlagValue(args2, "--summary"),
    details: readFlagValue(args2, "--details") ?? void 0,
    nextTimeGuidance: readFlagValues(args2, "--next-time-guidance"),
    sourceIds: readFlagValues(args2, "--source-id"),
    noteIds: readFlagValues(args2, "--note-id"),
    artifactRefs: readFlagValues(args2, "--artifact"),
    appliesToArtifactRefs: readFlagValues(args2, "--applies-to-artifact"),
    tags: readFlagValues(args2, "--tag"),
    supersedesLessonId: readFlagValue(args2, "--supersedes-lesson-id") ?? void 0
  };
}
function receiptArgs(args2, root) {
  const input = readFlagValue(args2, "--input");
  if (input) {
    const fullPath = path24.resolve(root, input);
    const relative = path24.relative(root, fullPath);
    if (relative.startsWith("..") || path24.isAbsolute(relative)) throw new Error("--input must stay inside the selected workspace.");
    return parseJson(fs21.readFileSync(fullPath, "utf8"), "--input");
  }
  return definedObject({
    receiptId: optionalFlagValue(args2, "--receipt-id"),
    missionId: optionalFlagValue(args2, "--mission-id"),
    contractDigest: optionalFlagValue(args2, "--contract-digest"),
    summary: optionalFlagValue(args2, "--summary"),
    artifacts: args2.includes("--artifact-json") ? parseRepeatedJson(args2, "--artifact-json") : void 0,
    validations: args2.includes("--validation-json") ? parseRepeatedJson(args2, "--validation-json") : void 0,
    criteriaSatisfied: args2.includes("--criterion-json") ? parseRepeatedJson(args2, "--criterion-json") : void 0,
    producedAt: optionalFlagValue(args2, "--produced-at")
  });
}
function sourceArgs(args2, action) {
  if (action === "query") return definedObject({ missionId: optionalFlagValue(args2, "--mission-id"), sourceId: optionalFlagValue(args2, "--source-id") });
  if (action === "verify") return definedObject({
    missionId: optionalFlagValue(args2, "--mission-id"),
    sourceId: optionalFlagValue(args2, "--source-id"),
    method: optionalFlagValue(args2, "--method"),
    checkedMaterial: optionalFlagValue(args2, "--checked-material"),
    auditEvidence: args2.includes("--audit-evidence-json") ? parseJson(readFlagValue(args2, "--audit-evidence-json"), "--audit-evidence-json") : void 0
  });
  return definedObject({
    missionId: optionalFlagValue(args2, "--mission-id"),
    sourceId: optionalFlagValue(args2, "--source-id"),
    citationKey: optionalFlagValue(args2, "--citation-key"),
    title: optionalFlagValue(args2, "--title"),
    locator: optionalFlagValue(args2, "--locator"),
    sourceType: optionalFlagValue(args2, "--source-type"),
    origin: optionalFlagValue(args2, "--origin"),
    abstract: optionalFlagValue(args2, "--abstract"),
    year: optionalFlagValue(args2, "--year"),
    authors: optionalFlagValues(args2, "--author"),
    capturePath: optionalFlagValue(args2, "--capture-path")
  });
}
function reviewArgs(args2) {
  const modes = ["preflight", "prepare", "import", "verify-coverage"].filter((mode2) => args2.includes(`--${mode2}`));
  if (modes.length > 1) throw new Error("dove review accepts one operation mode.");
  const mode = modes[0] ?? "preflight";
  const missionId = readFlagValue(args2, "--mission-id");
  if (mode === "import") return { mode, args: { missionId, exchangeId: readFlagValue(args2, "--exchange-id"), reviewId: readFlagValue(args2, "--review-id") } };
  if (mode === "verify-coverage") return { mode, args: { missionId, artifactPaths: readFlagValues(args2, "--artifact"), requireAuthoritative: args2.includes("--require-authoritative") } };
  return { mode, args: { missionId, policy: mode === "preflight" ? "local-preflight" : readFlagValue(args2, "--policy"), artifactPaths: readFlagValues(args2, "--artifact"), finalPlanPaths: readFlagValues(args2, "--final-plan"), finalResultPaths: readFlagValues(args2, "--final-result") } };
}
function hostIds(args2) {
  const raw = [...readFlagValues(args2, "--host"), ...readFlagValues(args2, "--platform")];
  if (raw.length === 0) return DEFAULT_HOST_ADAPTERS;
  const requested = raw.flatMap((value2) => value2.split(",").map((item) => item.trim()).filter(Boolean));
  if (requested.includes("all")) return HOST_IDS;
  const invalid = requested.filter((host) => !HOST_IDS.includes(host));
  if (invalid.length) throw new Error(`Unknown host adapter(s): ${invalid.join(", ")}.`);
  return [...new Set(requested)];
}
function requireManagedPackageSource(relativePath) {
  const source = path24.join(PACKAGE_ROOT2, relativePath);
  let stat;
  try {
    stat = fs21.lstatSync(source);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`Managed package source is missing: ${relativePath}.`);
    throw error;
  }
  if (stat.isSymbolicLink()) throw new Error(`Managed package source must not be a symbolic link: ${relativePath}.`);
  if (!stat.isFile() && !stat.isDirectory()) throw new Error(`Managed package source must be a regular file or directory: ${relativePath}.`);
  return source;
}
function collectCopyEntries(source, destination, force, destinationRoot, entries, plannedPaths, sourceLabel) {
  const stat = fs21.lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error(`Managed package source must not contain symbolic links: ${sourceLabel}.`);
  const relative = path24.relative(destinationRoot, destination).split(path24.sep).join("/");
  resolveCanonicalContainedWrite(destinationRoot, relative, { label: "Install destination" });
  if (stat.isDirectory()) {
    for (const entry of fs21.readdirSync(source)) {
      collectCopyEntries(path24.join(source, entry), path24.join(destination, entry), force, destinationRoot, entries, plannedPaths, `${sourceLabel}/${entry}`);
    }
    return;
  }
  if (!stat.isFile()) throw new Error(`Managed package source must contain only regular files and directories: ${sourceLabel}.`);
  entries.push({ root: destinationRoot, relativePath: relative, content: fs21.readFileSync(source), force, label: "Install destination" });
  plannedPaths.push({ root: destinationRoot, path: relative, operation: "write" });
}
function collectRetiredEntries(root, host, entries, plannedPaths) {
  for (const relativePath of RETIRED_MANAGED_PATHS[host] ?? []) {
    resolveCanonicalContainedWrite(root, relativePath, { label: "Retired managed path" });
    const absolutePath = path24.join(root, relativePath);
    if (!fs21.existsSync(absolutePath)) continue;
    const stat = fs21.lstatSync(absolutePath);
    if (stat.isSymbolicLink()) throw new Error(`Retired managed path must not be a symbolic link: ${relativePath}.`);
    if (stat.isDirectory()) {
      const children = fs21.readdirSync(absolutePath);
      if (children.length !== 1 || children[0] !== "SKILL.md") continue;
      const skillPath = `${relativePath}/SKILL.md`;
      if (!entries.some((entry) => entry.root === root && entry.relativePath === skillPath)) {
        entries.push({ root, relativePath: skillPath, delete: true, force: true, label: "Retired managed path" });
        plannedPaths.push({ root, path: skillPath, operation: "delete" });
      }
      entries.push({ root, relativePath, delete: true, deleteEmptyDirectory: true, force: true, label: "Retired managed directory" });
      plannedPaths.push({ root, path: relativePath, operation: "delete" });
      continue;
    }
    if (!stat.isFile()) throw new Error(`Retired managed path must be a regular file: ${relativePath}.`);
    if (entries.some((entry) => entry.root === root && entry.relativePath === relativePath)) continue;
    entries.push({ root, relativePath, delete: true, force: true, label: "Retired managed path" });
    plannedPaths.push({ root, path: relativePath, operation: "delete" });
  }
}
function plainObject(value2) {
  return value2 !== null && typeof value2 === "object" && !Array.isArray(value2);
}
function sameMcpServer(value2, expected) {
  if (!plainObject(value2)) return false;
  if (Object.keys(value2).sort().join(",") !== "args,command,type") return false;
  return value2.type === expected.type && value2.command === expected.command && Array.isArray(value2.args) && value2.args.length === expected.args.length && value2.args.every((item, index) => item === expected.args[index]);
}
function installedMcpServerKind(value2) {
  return sameMcpServer(value2, INSTALLED_DOVE_MCP_SERVER) ? "current" : null;
}
function prepareProjectMcpConfig(target2) {
  const resolved = resolveCanonicalContainedWrite(target2, DOVE_MCP_CONFIG_PATH, { label: "Claude project MCP configuration" });
  const absolutePath = resolved.fullPath;
  let config = {};
  if (fs21.existsSync(absolutePath)) {
    const stat = fs21.lstatSync(absolutePath);
    if (stat.isSymbolicLink()) throw new Error(`${DOVE_MCP_CONFIG_PATH} must not be a symbolic link.`);
    if (!stat.isFile()) throw new Error(`${DOVE_MCP_CONFIG_PATH} must be absent or a regular file.`);
    config = parseJsonWithoutDuplicateKeys(
      fs21.readFileSync(absolutePath, "utf8"),
      DOVE_MCP_CONFIG_PATH
    );
    if (!plainObject(config)) throw new Error(`${DOVE_MCP_CONFIG_PATH} must contain a JSON object.`);
  }
  const servers = config.mcpServers;
  if (servers !== void 0 && !plainObject(servers)) throw new Error(`${DOVE_MCP_CONFIG_PATH} mcpServers must be a JSON object.`);
  const existing = servers?.[DOVE_MCP_SERVER_NAME];
  if (existing !== void 0) {
    const kind = installedMcpServerKind(existing);
    if (kind === null) throw new Error(`${DOVE_MCP_CONFIG_PATH} already defines a conflicting Dove MCP server.`);
    if (kind === "current") return { healthy: true, status: "configured", write: null };
  }
  const merged = {
    ...config,
    mcpServers: {
      ...servers ?? {},
      [DOVE_MCP_SERVER_NAME]: INSTALLED_DOVE_MCP_SERVER
    }
  };
  return { healthy: true, status: "missing-dove-server", write: `${JSON.stringify(merged, null, 2)}
` };
}
function inspectProjectMcpConfig(target2) {
  try {
    const prepared = prepareProjectMcpConfig(target2);
    return prepared.write === null ? { healthy: true, status: "registered" } : { healthy: false, status: prepared.status, message: `${DOVE_MCP_CONFIG_PATH} does not register the Dove MCP server.` };
  } catch (error) {
    return { healthy: false, status: "invalid", message: error instanceof Error ? error.message : String(error) };
  }
}
function installOrSync(target2, args2) {
  const hosts = hostIds(args2);
  const projectHosts = hosts.filter((host) => Object.hasOwn(HOST_ADAPTERS, host));
  const corePaths = [...CORE_INSTALL_PATHS];
  const hostPaths = projectHosts.flatMap((host) => HOST_ADAPTERS[host].paths.map((relativePath) => ({ host, relativePath })));
  const force = args2.includes("--force");
  const entries = [];
  const plannedPaths = [];
  const managedSources = new Map(
    [...corePaths, ...hostPaths.map(({ relativePath }) => relativePath)].map((relativePath) => [relativePath, requireManagedPackageSource(relativePath)])
  );
  for (const relativePath of corePaths) {
    collectCopyEntries(managedSources.get(relativePath), path24.join(target2, relativePath), force, target2, entries, plannedPaths, relativePath);
  }
  for (const { relativePath } of hostPaths) {
    collectCopyEntries(managedSources.get(relativePath), path24.join(target2, relativePath), force, target2, entries, plannedPaths, relativePath);
  }
  for (const host of projectHosts) collectRetiredEntries(target2, host, entries, plannedPaths);
  let claudeConfigRoot = null;
  const claudeEntries = generatedClaudeUserCommandEntries();
  if (hosts.some((host) => USER_HOST_IDS.includes(host))) {
    const mcpConfig = prepareProjectMcpConfig(target2);
    if (mcpConfig.write !== null) {
      entries.push({ root: target2, relativePath: DOVE_MCP_CONFIG_PATH, content: mcpConfig.write, encoding: "utf8", force: true, label: "Claude project MCP configuration" });
      plannedPaths.push({ root: target2, path: DOVE_MCP_CONFIG_PATH, operation: "write" });
    }
    entries.push({ root: target2, relativePath: DOVE_CLAUDE_PROJECT_MARKER_PATH, content: `${JSON.stringify(DOVE_CLAUDE_PROJECT_MARKER, null, 2)}
`, encoding: "utf8", force: true, label: "Claude project installation marker" });
    plannedPaths.push({ root: target2, path: DOVE_CLAUDE_PROJECT_MARKER_PATH, operation: "write" });
    claudeConfigRoot = resolveClaudeConfigRoot();
    for (const entry of claudeEntries) {
      entries.push({ root: claudeConfigRoot, relativePath: entry.relativePath, content: `${entry.content.trimEnd()}
`, encoding: "utf8", force: true, label: "Claude command adapter path" });
      plannedPaths.push({ root: claudeConfigRoot, path: entry.relativePath, operation: "write" });
    }
    collectRetiredEntries(claudeConfigRoot, "claude", entries, plannedPaths);
  }
  const transaction = writeFileSetTransaction(entries);
  const written = new Set(transaction.writtenPaths);
  const removed = new Set(transaction.removedPaths);
  const removedPaths = plannedPaths.filter((entry) => entry.operation === "delete" && removed.has(entry.path));
  const writtenPaths = plannedPaths.filter((entry) => entry.operation === "write" && written.has(entry.path));
  const skippedPaths = plannedPaths.filter((entry) => entry.operation === "write" && !written.has(entry.path));
  const copiedUserHostPaths = claudeConfigRoot ? claudeEntries.filter((entry) => written.has(entry.relativePath)).map((entry) => ({ host: "claude", path: entry.relativePath, root: claudeConfigRoot })) : [];
  return {
    target: target2,
    hosts,
    force,
    copiedCorePaths: corePaths,
    copiedHostPaths: hostPaths.map(({ host, relativePath }) => ({ host, path: relativePath })),
    copiedUserHostPaths,
    plannedPaths,
    writtenPaths,
    skippedPaths,
    removedPaths,
    transactionState: transaction.transactionState
  };
}
function sha2566(content) {
  return crypto11.createHash("sha256").update(content).digest("hex");
}
function expectedProjectHostContent(host) {
  return new Map([
    ...generatedAdapterEntries().filter((entry) => entry.hostId === host).map((entry) => [entry.relativePath, `${entry.content.trimEnd()}
`]),
    ...host === "opencode" ? OPENCODE_ROLE_SKILL_PATHS.map((relativePath) => [relativePath, fs21.readFileSync(path24.join(PACKAGE_ROOT2, relativePath))]) : [],
    ...host === "opencode" ? [[".opencode.json", fs21.readFileSync(path24.join(PACKAGE_ROOT2, ".opencode.json"))]] : [],
    ...host === "agents" ? [["AGENTS.md", fs21.readFileSync(path24.join(PACKAGE_ROOT2, "AGENTS.md"))]] : []
  ]);
}
function fileMatchesExpected(absolutePath, expectedContent) {
  if (!fs21.existsSync(absolutePath)) return false;
  const stat = fs21.lstatSync(absolutePath);
  return stat.isFile() && !stat.isSymbolicLink() && sha2566(fs21.readFileSync(absolutePath)) === sha2566(expectedContent);
}
function matchesClaudeProjectMarker(target2) {
  const absolutePath = path24.join(target2, DOVE_CLAUDE_PROJECT_MARKER_PATH);
  if (!fs21.existsSync(absolutePath)) return false;
  const stat = fs21.lstatSync(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink()) return false;
  try {
    const marker = JSON.parse(fs21.readFileSync(absolutePath, "utf8"));
    return plainObject(marker) && Object.keys(marker).sort().join(",") === "host,version" && marker.version === DOVE_CLAUDE_PROJECT_MARKER.version && marker.host === DOVE_CLAUDE_PROJECT_MARKER.host;
  } catch {
    return false;
  }
}
function detectHosts(target2, { includeClaude = false } = {}) {
  const result = Object.entries(HOST_ADAPTERS).filter(([, adapter]) => adapter.paths.some((relativePath) => fs21.existsSync(path24.join(target2, relativePath)))).map(([host]) => host);
  if (includeClaude && (matchesClaudeProjectMarker(target2) || fs21.existsSync(path24.join(target2, DOVE_MCP_CONFIG_PATH)))) result.push("claude");
  return result;
}
function stripAnsi(value2) {
  return String(value2 ?? "").replace(/\x1B\[[0-?]*[ -/]*[@-~]/gu, "");
}
function parseClaudeMcpStatus(output) {
  const statusLines = stripAnsi(output).replaceAll("\r\n", "\n").split("\n").filter((line) => /^\s*Status\s*:/iu.test(line));
  if (statusLines.length !== 1) return "unknown";
  const value2 = statusLines[0].replace(/^\s*Status\s*:\s*/iu, "").trim();
  if (/Pending approval/iu.test(value2)) return "pending-approval";
  if (/Failed to connect/iu.test(value2)) return "failed";
  if (/Connected/iu.test(value2)) return "connected";
  return "unknown";
}
function inspectClaudeMcpConnection(target2) {
  const command3 = process3.env.DOVE_CLAUDE_COMMAND || "claude";
  const result = spawnSync(command3, ["mcp", "get", DOVE_MCP_SERVER_NAME], {
    cwd: target2,
    encoding: "utf8",
    shell: false,
    timeout: 15e3,
    maxBuffer: 1024 * 1024
  });
  if (result.error?.code === "ENOENT") return { state: "unavailable", message: "Claude Code is unavailable, so project MCP approval and connection cannot be observed." };
  if (result.error?.code === "ETIMEDOUT") return { state: "unavailable", message: "Claude Code MCP status timed out." };
  const state2 = parseClaudeMcpStatus(`${result.stdout ?? ""}
${result.stderr ?? ""}`);
  if (state2 !== "unknown") return { state: state2, message: state2 === "pending-approval" ? "Dove is registered but awaits approval in a normal Claude Code project session." : state2 === "failed" ? "Claude Code reports that the Dove MCP server failed to connect." : null };
  return { state: "unknown", message: "Claude Code did not return one recognized Dove MCP Status line." };
}
function runInstalledMcpProbe(target2) {
  const relativePath = "scripts/doctor-mcp-probe-package.mjs";
  const probePath = path24.join(target2, relativePath);
  if (!fs21.existsSync(probePath)) {
    return { ok: false, state: "missing", message: `Installed MCP probe is missing: ${relativePath}.` };
  }
  const probeStat = fs21.lstatSync(probePath);
  if (!probeStat.isFile() || probeStat.isSymbolicLink()) {
    return { ok: false, state: "invalid", message: `Installed MCP probe must be a regular file: ${relativePath}.` };
  }
  const result = spawnSync(process3.execPath, [probePath, target2], {
    cwd: target2,
    encoding: "utf8",
    shell: false,
    timeout: 3e4,
    maxBuffer: 1024 * 1024
  });
  if (result.error?.code === "ETIMEDOUT") return { ok: false, state: "timeout", message: "Installed MCP package probe timed out." };
  if (result.status !== 0) return { ok: false, state: "failed", message: "Installed MCP package probe failed." };
  const lines = String(result.stdout ?? "").trim().split("\n").filter(Boolean);
  if (lines.length !== 1) return { ok: false, state: "invalid-result", message: "Installed MCP package probe did not return one structured result." };
  let payload;
  try {
    payload = JSON.parse(lines[0]);
  } catch {
    return { ok: false, state: "invalid-result", message: "Installed MCP package probe returned invalid JSON." };
  }
  const ok = payload?.ok === true && payload.toolCount === 28 && payload.hasCreateDoveMission === true && payload.elicitationCount === 1 && payload.checkpointStatus === "declined" && payload.zeroWrite === true;
  return ok ? { ok: true, state: "passed", ...payload } : { ok: false, state: "invalid-result", message: "Installed MCP package probe returned an incomplete success result." };
}
function doctor(target2) {
  const installedHosts = detectHosts(target2, { includeClaude: true });
  const missing = [];
  const drifted = [];
  const checks = [];
  for (const host of installedHosts) {
    if (host === "claude") {
      const mcpConfig = inspectProjectMcpConfig(target2);
      const expected2 = new Map(generatedClaudeUserCommandEntries().map((entry) => [entry.relativePath, `${entry.content.trimEnd()}
`]));
      const requiredPaths2 = [DOVE_MCP_CONFIG_PATH, DOVE_CLAUDE_PROJECT_MARKER_PATH, ...expected2.keys()];
      if (!fs21.existsSync(path24.join(target2, DOVE_MCP_CONFIG_PATH))) missing.push(DOVE_MCP_CONFIG_PATH);
      else if (!mcpConfig.healthy) drifted.push(DOVE_MCP_CONFIG_PATH);
      if (!fs21.existsSync(path24.join(target2, DOVE_CLAUDE_PROJECT_MARKER_PATH))) missing.push(DOVE_CLAUDE_PROJECT_MARKER_PATH);
      else if (!matchesClaudeProjectMarker(target2)) drifted.push(DOVE_CLAUDE_PROJECT_MARKER_PATH);
      for (const [relativePath, content] of expected2) {
        const absolutePath = path24.join(resolveClaudeConfigRoot(), relativePath);
        if (!fs21.existsSync(absolutePath)) missing.push(relativePath);
        else if (!fileMatchesExpected(absolutePath, content)) drifted.push(relativePath);
      }
      const registrationOk = mcpConfig.healthy && requiredPaths2.every((relativePath) => !missing.includes(relativePath) && !drifted.includes(relativePath));
      checks.push({ check: "host-adapter:claude", ok: registrationOk, requiredPaths: requiredPaths2, message: mcpConfig.message ?? null });
      checks.push({ check: "claude-mcp-registration", ok: mcpConfig.healthy, state: mcpConfig.healthy ? "registered" : mcpConfig.status, message: mcpConfig.message ?? null });
      const connection = mcpConfig.healthy ? inspectClaudeMcpConnection(target2) : { state: "blocked", message: "Claude MCP connection cannot be checked until project registration is current." };
      checks.push({ check: "claude-mcp-status", ok: connection.state === "connected", state: connection.state, message: connection.message });
      continue;
    }
    const expected = expectedProjectHostContent(host);
    const requiredPaths = HOST_ADAPTERS[host]?.requiredPaths ?? [];
    for (const relativePath of requiredPaths) {
      const absolutePath = path24.join(target2, relativePath);
      if (!fs21.existsSync(absolutePath)) missing.push(relativePath);
      else if (!fileMatchesExpected(absolutePath, expected.get(relativePath))) drifted.push(relativePath);
    }
    checks.push({ check: `host-adapter:${host}`, ok: requiredPaths.every((relativePath) => !missing.includes(relativePath) && !drifted.includes(relativePath)), requiredPaths });
  }
  const runtimePath = "mcp/dove-state-server-package.mjs";
  if (installedHosts.length > 0 && !fs21.existsSync(path24.join(target2, runtimePath))) missing.push(runtimePath);
  if (installedHosts.length > 0) {
    const claudeStatus = checks.find((check) => check.check === "claude-mcp-status")?.state;
    const probe = installedHosts.includes("claude") && claudeStatus !== "connected" ? { ok: false, state: "blocked", message: "The package probe was not started because Claude Code has not reported the project MCP server as connected." } : runInstalledMcpProbe(target2);
    checks.push({ check: "runtime:mcp-package-probe", ...probe });
  }
  const workspace = inspectDoveWorkspace(target2);
  const workspaceOk = workspace.state === "absent" ? installedHosts.length > 0 && missing.length === 0 : workspace.healthy;
  checks.push({ check: "workspace-schema", ok: workspaceOk, message: workspace.state === "absent" ? "Dove runtime is installed and .dove is absent; initialize explicitly when needed." : workspace.healthy ? `Current Dove schema ${workspace.schemaVersion} is healthy.` : `${workspace.state}${workspace.error ? `: ${workspace.error}` : ""}; run dove init --archive-reset and confirm the exact proposal.` });
  const result = { target: target2, node: process3.version, healthy: missing.length === 0 && drifted.length === 0 && checks.every((check) => check.ok), workspaceMode: workspace.state === "absent" ? "runtime-only" : workspace.healthy ? "current-schema" : "archive-reset-required", workspaceSchema: { state: workspace.state, category: workspace.category, healthy: workspace.healthy, schemaVersion: workspace.schemaVersion, detectedSchema: workspace.detectedSchema, error: workspace.error ?? null, zeroWrite: true }, missing: [...new Set(missing)], drifted: [...new Set(drifted)], checks, warnings: [], hostAdapters: installedHosts, writes: [] };
  console.log(JSON.stringify(result, null, 2));
  return result.healthy ? 0 : 1;
}
function statusArgs(args2) {
  const detail = optionalFlagValue(args2, "--detail");
  if (detail !== void 0 && !["compact", "full"].includes(detail)) throw new Error("--detail must be compact or full.");
  const language = optionalFlagValue(args2, "--language");
  if (language !== void 0 && !["zh", "en"].includes(language)) throw new Error("--language must be zh or en.");
  return definedObject({ missionId: optionalFlagValue(args2, "--mission-id"), detail, language });
}
function wantsJson(args2) {
  return args2.includes("--json") || readFlagValue(args2, "--format") === "json";
}
function printResult(result, args2) {
  if (wantsJson(args2)) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (result?.approval?.required === true) {
    console.log([
      result.approval.summary,
      "No files have been created or changed.",
      ...result.approval.effects.map((effect) => `- ${effect}`),
      result.approval.question
    ].join("\n"));
    return;
  }
  const command3 = result?.confirmation?.exactConfirmationCommand;
  if (command3 && result?.confirmation?.required === true) {
    console.log([
      "--- DOVE PROPOSAL: ZERO-WRITE BOUNDARY ---",
      result.summary ?? result.headline ?? result.status ?? "Dove proposal is ready.",
      "No durable mutation has been applied.",
      "Exact confirmation command:",
      command3,
      "--- END DOVE PROPOSAL ---"
    ].join("\n"));
    return;
  }
  console.log(result.summary ?? result.headline ?? result.status ?? "Dove operation completed.");
}
var parsed;
try {
  parsed = parseDoveCli(process3.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process3.exit(1);
}
var command2 = parsed.command;
if (!command2 || ["help", "--help", "-h"].includes(command2)) {
  usage();
  process3.exit(0);
}
if (!Object.hasOwn({ install: true, sync: true, doctor: true }, command2) && !LOCAL_COMMANDS.has(command2)) {
  usage();
  process3.exit(1);
}
var [rawTarget, ...extraPositionals] = parsed.positionals;
var sourceAction = "query";
if (command2 === "source" && ["query", "register", "verify"].includes(rawTarget)) {
  sourceAction = rawTarget;
  [rawTarget, ...extraPositionals] = extraPositionals;
}
var lessonsAction = "query";
if (command2 === "lessons" && ["query", "record"].includes(rawTarget)) {
  lessonsAction = rawTarget;
  [rawTarget, ...extraPositionals] = extraPositionals;
}
var invalidLessonsPositionals = command2 === "lessons" && extraPositionals.length > 0;
var invalidSourcePositionals = command2 === "source" && extraPositionals.length > 0;
var rawArgs = [...extraPositionals, ...parsed.args];
var selected = targetAndArgs(rawTarget, rawArgs);
var target = selected.target;
var args = selected.args;
try {
  if (invalidLessonsPositionals) throw new Error("dove lessons accepts only query or record followed by one target.");
  if (invalidSourcePositionals) throw new Error("dove source accepts only query, register, or verify followed by one target.");
  if (command2 === "install" || command2 === "sync") {
    if (readFlagValue(args, "--mutation-mode") === "patch-plan") throw new Error(`${command2} requires direct-process file copying.`);
    console.log(JSON.stringify(installOrSync(target, args), null, 2));
    process3.exit(0);
  }
  if (command2 === "doctor") process3.exit(doctor(target));
  if (command2 === "status") {
    const result2 = queryDoveStatus(target, statusArgs(args));
    printResult(result2, args);
    process3.exit(0);
  }
  if (command2 === "init") {
    const input = initArgs(args);
    const result2 = input.confirmed ? runMutation(target, "init-dove-goal", args, () => initDoveGoal(target, input), "direct-process") : initDoveGoal(target, input);
    printResult(withProposalCommand("init", result2, target), args);
    process3.exit(0);
  }
  if (command2 === "mission") {
    const input = missionArgs(args);
    const result2 = input.confirmed ? runMutation(target, "create-dove-mission", args, () => createDoveMission(target, input), "direct-process") : createDoveMission(target, input);
    printResult(withProposalCommand("mission", result2, target), args);
    process3.exit(0);
  }
  if (command2 === "lessons") {
    if (lessonsAction === "query") {
      printResult(queryDoveLessons(target, lessonQueryArgs(args)), args);
      process3.exit(0);
    }
    const input = lessonRecordArgs(args);
    const result2 = input.confirmed ? runMutation(target, "record-dove-lesson", args, () => recordDoveLesson(target, input), "direct-process") : recordDoveLesson(target, input);
    printResult(withProposalCommand("lessons record", result2, target), args);
    process3.exit(0);
  }
  let result;
  if (command2 === "receipt") result = runMutation(target, "ingest-execution-receipt", args, (clean) => ingestExecutionReceipt(target, receiptArgs(clean, target)));
  if (command2 === "source") {
    if (sourceAction === "query") result = querySources(target, sourceArgs(args, sourceAction));
    else result = runMutation(target, sourceAction === "verify" ? "verify-source" : "register-source", args, (clean) => sourceAction === "verify" ? verifySource(target, sourceArgs(clean, sourceAction)) : registerSource(target, sourceArgs(clean, sourceAction)));
  }
  if (command2 === "note") result = runMutation(target, "upsert-note", args, (clean) => upsertNote(target, definedObject({ missionId: optionalFlagValue(clean, "--mission-id"), noteId: optionalFlagValue(clean, "--note-id"), title: optionalFlagValue(clean, "--title"), summary: optionalFlagValue(clean, "--summary"), quotes: optionalFlagValues(clean, "--quote"), claims: optionalFlagValues(clean, "--claim"), openQuestions: optionalFlagValues(clean, "--open-question"), sourceIds: optionalFlagValues(clean, "--source-id"), artifactRefs: optionalFlagValues(clean, "--artifact") })));
  if (command2 === "draft") {
    const metadataOnly = args.includes("--metadata-only");
    result = runMutation(target, metadataOnly ? "upsert-draft-metadata" : "upsert-draft", args, (clean) => (metadataOnly ? upsertDraftMetadata : upsertDraft)(target, definedObject({ missionId: optionalFlagValue(clean, "--mission-id"), draftId: optionalFlagValue(clean, "--draft-id"), title: optionalFlagValue(clean, "--title"), body: optionalFlagValue(clean, "--body"), summary: optionalFlagValue(clean, "--summary"), evidenceRefs: optionalFlagValues(clean, "--evidence"), artifactRefs: optionalFlagValues(clean, "--artifact") })));
  }
  if (command2 === "experience") result = runMutation(target, "run-experience-workflow", args, (clean) => runExperienceWorkflow(target, definedObject({ missionId: optionalFlagValue(clean, "--mission-id"), experimentId: optionalFlagValue(clean, "--experiment-id"), title: optionalFlagValue(clean, "--title"), goal: optionalFlagValue(clean, "--goal"), hypothesis: optionalFlagValue(clean, "--hypothesis"), protocol: optionalFlagValue(clean, "--protocol"), successCriteria: optionalFlagValues(clean, "--success-criterion"), comparisonTargets: optionalFlagValues(clean, "--comparison-target"), result: optionalFlagValue(clean, "--result"), resultEvidenceRefs: optionalFlagValues(clean, "--result-evidence"), auditFindings: optionalFlagValues(clean, "--audit-finding"), integrityFlags: optionalFlagValues(clean, "--integrity-flag"), claimId: optionalFlagValue(clean, "--claim-id"), bridgeReason: optionalFlagValue(clean, "--bridge-reason") })));
  if (command2 === "figure") result = runMutation(target, "run-figure-workflow", args, (clean) => runFigureWorkflow(target, definedObject({ missionId: optionalFlagValue(clean, "--mission-id"), figureId: optionalFlagValue(clean, "--figure-id"), intent: optionalFlagValue(clean, "--intent"), purpose: optionalFlagValue(clean, "--purpose"), materials: optionalFlagValues(clean, "--material"), prompt: optionalFlagValue(clean, "--prompt"), outputPath: optionalFlagValue(clean, "--output-path"), outputSha256: optionalFlagValue(clean, "--output-sha256"), caption: optionalFlagValue(clean, "--caption"), qaFindings: optionalFlagValues(clean, "--qa-finding") })));
  if (command2 === "review") {
    const request = reviewArgs(args);
    if (request.mode === "preflight") result = prepareReviewExchange(target, request.args);
    else if (request.mode === "verify-coverage") result = verifyReviewCoverage(target, request.args);
    else result = runMutation(target, request.mode === "prepare" ? "prepare-review-exchange" : "import-review-exchange", args, () => request.mode === "prepare" ? prepareReviewExchange(target, request.args) : importReviewExchange(target, request.args));
  }
  if (command2 === "rebuttal") {
    const input = { missionId: readFlagValue(args, "--mission-id"), issues: parseRepeatedJson(args, "--issue-json"), strategy: readFlagValue(args, "--strategy"), responses: parseRepeatedJson(args, "--response-json") };
    if (args.includes("--issues-only")) result = runMutation(target, "normalize-rebuttal-issues", args, () => normalizeRebuttalIssues(target, { missionId: input.missionId, issues: input.issues }));
    else if (args.includes("--strategy-only")) result = runMutation(target, "build-rebuttal-strategy", args, () => buildRebuttalStrategy(target, { missionId: input.missionId, strategy: input.strategy }));
    else result = runMutation(target, "build-rebuttal", args, () => buildRebuttal(target, input));
  }
  if (command2 === "version") {
    const fromVersionId = optionalFlagValue(args, "--from-version-id");
    const toVersionId = optionalFlagValue(args, "--to-version-id");
    const comparing = fromVersionId !== void 0 || toVersionId !== void 0;
    const input = comparing ? definedObject({ missionId: optionalFlagValue(args, "--mission-id"), fromVersionId, toVersionId }) : definedObject({ missionId: optionalFlagValue(args, "--mission-id"), versionId: optionalFlagValue(args, "--version-id"), label: optionalFlagValue(args, "--label"), artifactRefs: optionalFlagValues(args, "--artifact"), supersedesVersionId: optionalFlagValue(args, "--supersedes-version-id") });
    result = comparing ? compareVersions(target, input) : runMutation(target, "create-version-snapshot", args, () => createVersionSnapshot(target, input));
  }
  printResult(result, args);
  process3.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (wantsJson(args)) console.log(JSON.stringify({ status: "blocked", message }, null, 2));
  else console.error(message);
  process3.exit(1);
}
