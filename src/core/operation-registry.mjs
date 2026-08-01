const TERMINAL = "terminal";
const RESUME_ORIGINAL = "resume-original";
const NO_CLOSURE = "none";
const HOST_OUTCOME_CLOSURE = "host-outcome";
const RESEARCH_OUTCOME_CLOSURE = "research-outcome";
const DOMAIN_CLOSURE = "domain";

const DEFAULT_RETRY = Object.freeze({
  succeeded: "none",
  declined: "none",
  cancelled: "none",
  failed: "explicit-request"
});

const INTERACTIONS = new Set(["read", "write", "checkpoint", "ambient-create"]);
const CONTINUATIONS = new Set([TERMINAL, RESUME_ORIGINAL]);
const CLOSURES = new Set([NO_CLOSURE, HOST_OUTCOME_CLOSURE, RESEARCH_OUTCOME_CLOSURE, DOMAIN_CLOSURE]);
const CALLBACK_MODES = new Set([HOST_OUTCOME_CLOSURE, RESEARCH_OUTCOME_CLOSURE]);
const RETRIES = new Set(["none", "explicit-request"]);
const PRESENTATIONS = new Set(["show", "silent-on-success"]);
const RETRY_OUTCOMES = Object.freeze(["succeeded", "declined", "cancelled", "failed"]);
const STATUS_OUTCOMES = new Set(["success", "proposal", "declined", "cancelled", "failure", "replay"]);
const STATUS_CATEGORIES = new Set(["success", "success-zero-write", "awaiting-approval", "declined", "cancelled", "invalid-input", "ambiguous-target", "not-found", "stale-state", "capability-unavailable", "blocked", "evidence-incomplete", "operational-failure", "internal-failure"]);
const STATUS_PHASES = new Set(["approval", "validation", "selection", "read", "execution", "evidence", "internal"]);
const STATUS_USER_ACTIONS = new Set(["none", "approve-or-cancel", "clarify-input", "select-target", "refresh-state", "enable-capability", "resolve-blocker", "provide-evidence", "retry-explicitly", "reassess-read-only"]);

const SUCCESS = Object.freeze({ outcome: "success" });
const PROPOSAL = Object.freeze({ outcome: "proposal", category: "awaiting-approval", phase: "approval", userAction: "approve-or-cancel" });
const DECLINED = Object.freeze({ outcome: "declined", category: "declined", phase: "approval", userAction: "none" });
const CANCELLED = Object.freeze({ outcome: "cancelled", category: "cancelled", phase: "approval", userAction: "none" });
const REPLAY = Object.freeze({ outcome: "replay", category: "success-zero-write", phase: "execution", userAction: "none", retry: "none" });
const NO_PROGRESS = Object.freeze({ outcome: "failure", category: "blocked", phase: "execution", userAction: "resolve-blocker", retry: "explicit-request" });
const PARTIAL_COMMIT_FAILURE = Object.freeze({ outcome: "failure", category: "internal-failure", phase: "internal", userAction: "reassess-read-only", retry: "none" });
const BLOCKED = Object.freeze({ outcome: "failure", category: "blocked", phase: "execution", userAction: "resolve-blocker" });
const EVIDENCE_INCOMPLETE = Object.freeze({ outcome: "failure", category: "evidence-incomplete", phase: "evidence", userAction: "provide-evidence" });

function statusPolicy(entries) {
  return Object.freeze(Object.fromEntries(Object.entries(entries).map(([status, semantics]) => [status, Object.freeze({ ...semantics })])));
}

const READ_OK = statusPolicy({ ok: SUCCESS, empty: SUCCESS });
const RECORDED = statusPolicy({ recorded: SUCCESS, planned: SUCCESS });
const WORKSPACE_STATUSES = statusPolicy({
  "needs-confirmation": PROPOSAL,
  initialized: SUCCESS,
  revised: SUCCESS,
  "archive-reset-complete": SUCCESS,
  "initialization-planned": SUCCESS,
  "revision-planned": SUCCESS
});
const MISSION_STATUSES = statusPolicy({ proposal: SUCCESS, "needs-confirmation": PROPOSAL, materialized: SUCCESS, "materialization-planned": SUCCESS, recorded: SUCCESS });
const RECEIPT_STATUSES = statusPolicy({ ingested: SUCCESS, "ingest-planned": SUCCESS, replayed: REPLAY, "no-progress-skipped": NO_PROGRESS, "partial-commit-failure": PARTIAL_COMMIT_FAILURE });
const COMPLETION_STATUSES = statusPolicy({ complete: SUCCESS, incomplete: SUCCESS, completed: SUCCESS, stopped: SUCCESS, failed: SUCCESS });
const REVIEW_RECORD_STATUSES = statusPolicy({ scoped: SUCCESS, archived: SUCCESS, "archive-planned": SUCCESS, replayed: REPLAY });
const COMMON_OPERATION_STATUSES = statusPolicy({
  declined: DECLINED,
  cancelled: CANCELLED,
  "needs-task-selection": { outcome: "failure", category: "ambiguous-target", phase: "selection", userAction: "select-target" },
  blocked: BLOCKED,
  "no-op": NO_PROGRESS,
  noop: NO_PROGRESS,
  "step-no-progress": NO_PROGRESS,
  "needs-explicit-progress-step": NO_PROGRESS,
  "blocked-boundary": { outcome: "failure", category: "invalid-input", phase: "validation", userAction: "clarify-input" },
  "blocked-missing-materials": { outcome: "failure", category: "invalid-input", phase: "validation", userAction: "clarify-input" },
  "missing-required-materials": { outcome: "failure", category: "invalid-input", phase: "validation", userAction: "clarify-input" },
  "needs-completion-evidence": EVIDENCE_INCOMPLETE,
  "needs-source-verification": EVIDENCE_INCOMPLETE,
  "source-provenance-unverified": EVIDENCE_INCOMPLETE,
  "qa-needs-attention": EVIDENCE_INCOMPLETE,
  "verification-failed": EVIDENCE_INCOMPLETE,
  "missing-secret-env": { outcome: "failure", category: "capability-unavailable", phase: "execution", userAction: "enable-capability" },
  "provider-failed": { outcome: "failure", category: "capability-unavailable", phase: "execution", userAction: "enable-capability" },
  "awaiting-host-pass": { outcome: "failure", category: "operational-failure", phase: "execution", userAction: "retry-explicitly" },
  "awaiting-host-results": { outcome: "failure", category: "operational-failure", phase: "execution", userAction: "retry-explicitly" },
  "needs-host-results": { outcome: "failure", category: "operational-failure", phase: "execution", userAction: "retry-explicitly" },
  failed: { outcome: "failure", category: "operational-failure", phase: "execution", userAction: "retry-explicitly" },
  "materialization-failed": { outcome: "failure", category: "operational-failure", phase: "execution", userAction: "retry-explicitly" },
  "unexpected-step-status": { outcome: "failure", category: "internal-failure", phase: "internal", userAction: "retry-explicitly" },
  "workflow-error-boundary": { outcome: "failure", category: "internal-failure", phase: "internal", userAction: "retry-explicitly" }
});

const HOST_OUTCOME_CALLBACK = Object.freeze({
  tool: "close_host_outcome",
  mode: HOST_OUTCOME_CLOSURE,
  exactlyOnce: true,
  when: "success",
  missionIdPath: "mission.missionId",
  researchItemIdPath: null,
  decisionRevisionPath: null,
  boundArgNames: Object.freeze(["missionNumber"]),
  requiredOutcomeFields: Object.freeze(["attemptId", "status", "summary"]),
  defaults: Object.freeze({
    artifactPaths: Object.freeze([]),
    validationPaths: Object.freeze([]),
    facts: Object.freeze([])
  })
});

const RESEARCH_OUTCOME_FIELDS = Object.freeze([
  "attemptId",
  "status",
  "performedActionCount",
  "actualUsage",
  "evidenceReturned",
  "artifactPaths",
  "validationPaths",
  "facts",
  "startedAt",
  "finishedAt"
]);

const RESEARCH_OUTCOME_CONTRACT = Object.freeze({
  kind: "research-execution",
  evidenceReturnPath: "executionHandoff.expectedEvidence",
  budgetPath: "executionHandoff.budget",
  issuedAtPath: "executionHandoff.issuedAt",
  expiresAtPath: "executionHandoff.expiresAt"
});

const RESEARCH_OUTCOME_CALLBACK = Object.freeze({
  tool: "record_research_outcome",
  mode: RESEARCH_OUTCOME_CLOSURE,
  exactlyOnce: true,
  when: "research-handoff",
  missionIdPath: "decision.missionId",
  researchItemIdPath: null,
  decisionRevisionPath: "decision.revision",
  boundArgNames: Object.freeze(["missionNumber", "decisionRevision"]),
  requiredOutcomeFields: RESEARCH_OUTCOME_FIELDS,
  defaults: Object.freeze({}),
  outcomeContract: RESEARCH_OUTCOME_CONTRACT
});

const AMBIENT_RESEARCH_OUTCOME_CALLBACK = Object.freeze({
  tool: "record_research_outcome",
  mode: RESEARCH_OUTCOME_CLOSURE,
  exactlyOnce: true,
  when: "research-handoff",
  missionIdPath: "currentResearchDecision.missionId",
  researchItemIdPath: null,
  decisionRevisionPath: "currentResearchDecision.revision",
  boundArgNames: Object.freeze(["missionNumber", "decisionRevision"]),
  requiredOutcomeFields: RESEARCH_OUTCOME_FIELDS,
  defaults: Object.freeze({}),
  outcomeContract: RESEARCH_OUTCOME_CONTRACT
});

function resolvedPolicy(value, context) {
  return typeof value === "function" ? value(context) : value;
}

function assertPolicy(value, allowed, label, operationId) {
  if (!allowed.has(value)) throw new Error(`Invalid ${label} for Dove operation ${operationId}: ${value}`);
  return value;
}

function freezeCallback(callback, operationId) {
  if (callback === undefined || callback === null) return null;
  if (typeof callback === "function") return Object.freeze(callback);
  if (!callback || typeof callback !== "object" || Array.isArray(callback)) throw new Error(`Dove operation ${operationId} callback must be an object.`);
  if (typeof callback.tool !== "string" || !callback.tool) throw new Error(`Dove operation ${operationId} callback requires a tool.`);
  assertPolicy(callback.mode, CALLBACK_MODES, "callback mode", operationId);
  if (callback.exactlyOnce !== true) throw new Error(`Dove operation ${operationId} callback must be exactly once.`);
  if (callback.when !== "success" && callback.when !== "research-handoff") throw new Error(`Invalid callback condition for Dove operation ${operationId}: ${callback.when}`);
  if (typeof callback.missionIdPath !== "string" || !callback.missionIdPath) throw new Error(`Dove operation ${operationId} callback requires a mission binding path.`);
  if (callback.researchItemIdPath !== null && (typeof callback.researchItemIdPath !== "string" || !callback.researchItemIdPath)) throw new Error(`Dove operation ${operationId} callback has an invalid research item binding path.`);
  if (callback.decisionRevisionPath !== null && (typeof callback.decisionRevisionPath !== "string" || !callback.decisionRevisionPath)) throw new Error(`Dove operation ${operationId} callback has an invalid decision revision binding path.`);
  if (callback.outcomeContract !== undefined) {
    const contract = callback.outcomeContract;
    if (!contract || typeof contract !== "object" || Array.isArray(contract) || contract.kind !== "research-execution") {
      throw new Error(`Dove operation ${operationId} callback has an invalid outcome contract.`);
    }
    for (const field of ["evidenceReturnPath", "budgetPath", "issuedAtPath", "expiresAtPath"]) {
      if (typeof contract[field] !== "string" || !contract[field]) throw new Error(`Dove operation ${operationId} callback outcome contract requires ${field}.`);
    }
  }
  return Object.freeze({
    ...callback,
    boundArgNames: Object.freeze([...(callback.boundArgNames ?? [])]),
    requiredOutcomeFields: Object.freeze([...(callback.requiredOutcomeFields ?? [])]),
    defaults: Object.freeze({ ...(callback.defaults ?? {}) }),
    outcomeContract: callback.outcomeContract === undefined
      ? null
      : Object.freeze({ ...callback.outcomeContract })
  });
}

function freezeStatusSemantics(semantics, status, operationId) {
  if (!semantics || typeof semantics !== "object" || Array.isArray(semantics)) throw new Error(`Dove operation ${operationId} status ${status} requires semantics.`);
  assertPolicy(semantics.outcome, STATUS_OUTCOMES, "status outcome", operationId);
  if (semantics.category !== undefined) assertPolicy(semantics.category, STATUS_CATEGORIES, "status category", operationId);
  if (semantics.phase !== undefined) assertPolicy(semantics.phase, STATUS_PHASES, "status phase", operationId);
  if (semantics.userAction !== undefined) assertPolicy(semantics.userAction, STATUS_USER_ACTIONS, "status user action", operationId);
  if (semantics.retry !== undefined) assertPolicy(semantics.retry, RETRIES, "status retry", operationId);
  return Object.freeze({ ...semantics });
}

function freezeStatuses(statuses, operationId) {
  if (!statuses || typeof statuses !== "object" || Array.isArray(statuses)) throw new Error(`Dove operation ${operationId} requires a canonical status registry.`);
  const statusesWithCommon = { ...COMMON_OPERATION_STATUSES, ...statuses };
  const entries = Object.entries(statusesWithCommon);
  if (entries.length === 0) throw new Error(`Dove operation ${operationId} requires at least one registered status.`);
  return Object.freeze(Object.fromEntries(entries.map(([status, semantics]) => {
    if (typeof status !== "string" || !status.trim() || status !== status.trim().toLowerCase()) throw new Error(`Dove operation ${operationId} has an invalid status key: ${status}`);
    return [status, freezeStatusSemantics(semantics, status, operationId)];
  })));
}

function freezeOperation(operation) {
  if (typeof operation.id !== "string" || !operation.id) throw new Error("Dove operations require a stable id.");
  const publicProjector = operation.publicProjector;
  if (typeof publicProjector !== "string" || !publicProjector) throw new Error(`Dove operation ${operation.id} requires a public projector.`);
  if (typeof operation.interaction !== "function") assertPolicy(operation.interaction, INTERACTIONS, "interaction", operation.id);
  if (typeof operation.continuation !== "function" && operation.continuation !== undefined) assertPolicy(operation.continuation, CONTINUATIONS, "continuation", operation.id);
  if (typeof operation.closure !== "function" && operation.closure !== undefined) assertPolicy(operation.closure, CLOSURES, "closure", operation.id);
  if (typeof operation.presentation !== "function" && operation.presentation !== undefined) assertPolicy(operation.presentation, PRESENTATIONS, "presentation", operation.id);
  const retry = Object.freeze({ ...DEFAULT_RETRY, ...(operation.retry ?? {}) });
  for (const outcome of RETRY_OUTCOMES) assertPolicy(retry[outcome], RETRIES, `${outcome} retry`, operation.id);
  const callback = freezeCallback(operation.callback, operation.id);
  const statuses = freezeStatuses(operation.statuses, operation.id);
  return Object.freeze({
    checkpoint: false,
    continuation: TERMINAL,
    closure: NO_CLOSURE,
    presentation: "show",
    pathFields: Object.freeze([]),
    tools: Object.freeze([]),
    routes: Object.freeze({}),
    ...operation,
    publicProjector,
    statuses,
    retry,
    callback,
    pathFields: Object.freeze([...(operation.pathFields ?? [])]),
    tools: Object.freeze([...(operation.tools ?? [])]),
    routes: Object.freeze(Object.fromEntries(Object.entries(operation.routes ?? {}).map(([name, route]) => [name, Object.freeze({ ...route, pathFields: Object.freeze([...(route.pathFields ?? [])]) })])))
  });
}

const toolOperations = [
  freezeOperation({
    id: "tool.manage-dove-workspace",
    toolName: "manage_dove_workspace",
    publicProjector: "manage_dove_workspace",
    statuses: WORKSPACE_STATUSES,
    interaction: (args) => args?.operation === "set-mainline" ? "write" : "checkpoint",
    checkpoint: (args) => args?.operation !== "set-mainline"
  }),
  freezeOperation({
    id: "tool.manage-dove-mission",
    toolName: "manage_dove_mission",
    publicProjector: "create_dove_mission",
    statuses: statusPolicy({ ...MISSION_STATUSES, proposal: SUCCESS }),
    interaction: (args) => args?.operation === "query" ? "read" : ["start-skill", "reevaluate-research-decision"].includes(args?.operation) ? "write" : "checkpoint",
    checkpoint: (args) => ["create-root", "branch"].includes(args?.operation),
    continuation: (result) => result?.operation === "start-skill" || result?.executionHandoff ? RESUME_ORIGINAL : TERMINAL,
    closure: (result) => result?.operation === "start-skill" && !result?.executionHandoff ? HOST_OUTCOME_CLOSURE : result?.executionHandoff ? RESEARCH_OUTCOME_CLOSURE : NO_CLOSURE,
    callback: (result) => result?.operation === "start-skill" && !result?.executionHandoff ? HOST_OUTCOME_CALLBACK : result?.currentResearchDecision ? AMBIENT_RESEARCH_OUTCOME_CALLBACK : RESEARCH_OUTCOME_CALLBACK,
    routes: {
      query: { targetTool: "query_dove_mission", publicProjector: "query_dove_mission", interaction: "read", checkpoint: false, pathFields: ["artifacts[].path"] },
      "start-skill": { targetTool: "start_dove_skill_mission", publicProjector: "create_dove_mission", interaction: "write", checkpoint: false, pathFields: ["artifacts[].path", "contextArtifactPaths"] },
      "create-root": { targetTool: "create_dove_mission", publicProjector: "create_dove_mission", interaction: "checkpoint", checkpoint: true, pathFields: ["artifacts[].path"] },
      branch: { targetTool: "create_dove_mission", publicProjector: "create_dove_mission", interaction: "checkpoint", checkpoint: true, pathFields: ["artifacts[].path"] },
      "reevaluate-research-decision": { targetTool: "reevaluate_research_decision", publicProjector: "create_dove_mission", interaction: "write", checkpoint: false, pathFields: ["evidenceRefs"] }
    }
  }),
  freezeOperation({
    id: "tool.query-dove-status",
    toolName: "query_dove_status",
    publicProjector: "query_dove_status",
    statuses: statusPolicy({ ok: SUCCESS, ...COMPLETION_STATUSES }),
    interaction: "read",
    routes: {
      status: { targetTool: "query_dove_status", publicProjector: "query_dove_status", interaction: "read", checkpoint: false },
      completion: { targetTool: "assess_mission_completion", publicProjector: "assess_mission_completion", interaction: "read", checkpoint: false }
    }
  }),
  freezeOperation({
    id: "tool.manage-dove-sources",
    toolName: "manage_dove_sources",
    publicProjector: "query_sources",
    statuses: statusPolicy({ ...READ_OK, ...RECORDED }),
    interaction: (args) => args?.operation === "query" ? "read" : "write",
    routes: {
      query: { targetTool: "query_sources", publicProjector: "query_sources", interaction: "read", checkpoint: false },
      register: { targetTool: "register_source", publicProjector: "register_source", interaction: "write", checkpoint: false, pathFields: ["capturePath"] },
      reject: { targetTool: "verify_source", publicProjector: "verify_source", interaction: "write", checkpoint: false }
    },
    closure: DOMAIN_CLOSURE
  }),
  freezeOperation({ id: "tool.record-dove-experiment", toolName: "record_dove_experiment", publicProjector: "run_experience_workflow", statuses: RECORDED, interaction: "write", continuation: RESUME_ORIGINAL, closure: DOMAIN_CLOSURE, routes: { record: { targetTool: "run_experience_workflow", publicProjector: "run_experience_workflow", interaction: "write", checkpoint: false } }, pathFields: ["result.artifactRefs", "result.validationRefs", "result.failures[].evidenceRefs"] }),
  freezeOperation({ id: "tool.record-dove-claims", toolName: "record_dove_claims", publicProjector: "upsert_claims", statuses: RECORDED, interaction: "write", closure: DOMAIN_CLOSURE, pathFields: ["claims[].artifactRefs", "claims[].validationRefs"] }),
  freezeOperation({ id: "tool.record-dove-draft", toolName: "record_dove_draft", publicProjector: "record_draft_archive", statuses: RECORDED, interaction: "write", closure: DOMAIN_CLOSURE, pathFields: ["artifactPath", "referencePaths"] }),
  freezeOperation({ id: "tool.record-dove-figure", toolName: "record_dove_figure", publicProjector: "record_figure_archive", statuses: RECORDED, interaction: "write", closure: DOMAIN_CLOSURE, pathFields: ["artifactPath", "referencePaths"] }),
  freezeOperation({
    id: "tool.manage-dove-review",
    toolName: "manage_dove_review",
    publicProjector: "scope_review_record",
    statuses: REVIEW_RECORD_STATUSES,
    interaction: (args) => args?.operation === "scope" ? "read" : "write",
    checkpoint: false,
    closure: DOMAIN_CLOSURE,
    routes: {
      scope: { targetTool: "scope_review_record", publicProjector: "scope_review_record", interaction: "read", checkpoint: false, pathFields: ["artifactPaths"] },
      archive: { targetTool: "archive_review_record", publicProjector: "archive_review_record", interaction: "write", checkpoint: false, pathFields: ["findings[].linkedArtifactPaths"] }
    }
  }),
  freezeOperation({ id: "tool.record-dove-rebuttal", toolName: "record_dove_rebuttal", publicProjector: "record_rebuttal_archive", statuses: RECORDED, interaction: "write", closure: DOMAIN_CLOSURE, pathFields: ["artifactPath", "referencePaths", "findingRefs"] }),
  freezeOperation({
    id: "tool.manage-dove-lessons",
    toolName: "manage_dove_lessons",
    publicProjector: "read_dove_lessons",
    statuses: statusPolicy({ ok: SUCCESS, updated: SUCCESS, planned: SUCCESS }),
    interaction: (args) => args?.operation === "read" ? "read" : "write",
    routes: {
      read: { targetTool: "read_dove_lessons", publicProjector: "read_dove_lessons", interaction: "read", checkpoint: false },
      update: { targetTool: "update_dove_lessons", publicProjector: "update_dove_lessons", interaction: "write", checkpoint: false }
    }
  }),
  freezeOperation({
    id: "tool.create-ambient-dove-mission",
    toolName: "create_ambient_dove_mission",
    publicProjector: "create_ambient_dove_mission",
    statuses: statusPolicy({ materialized: SUCCESS, "materialization-planned": SUCCESS }),
    interaction: "ambient-create",
    continuation: RESUME_ORIGINAL,
    closure: (result) => result?.mission?.mode === "research" ? RESEARCH_OUTCOME_CLOSURE : HOST_OUTCOME_CLOSURE,
    callback: (result) => result?.mission?.mode === "research" ? AMBIENT_RESEARCH_OUTCOME_CALLBACK : HOST_OUTCOME_CALLBACK,
    presentation: "silent-on-success",
    pathFields: ["artifacts[].path"]
  }),
  freezeOperation({ id: "tool.close-host-outcome", toolName: "close_host_outcome", publicProjector: "close_host_outcome", statuses: RECEIPT_STATUSES, interaction: "write", closure: DOMAIN_CLOSURE, pathFields: ["artifactPaths", "validationPaths"] }),
  freezeOperation({ id: "tool.record-research-outcome", toolName: "record_research_outcome", publicProjector: "record_research_outcome", statuses: statusPolicy({ recorded: SUCCESS, ...RECEIPT_STATUSES }), interaction: "write", closure: DOMAIN_CLOSURE, pathFields: ["artifactPaths", "validationPaths"] })
];

const COMMAND_STATUS = statusPolicy({ ok: SUCCESS });

const commandOperations = [
  freezeOperation({ id: "command.dove.workspace", publicProjector: "command-public-report", commandId: "dove.workspace", statuses: COMMAND_STATUS, interaction: "write", tools: ["query_dove_status", "manage_dove_workspace"], pathInput: "none" }),
  freezeOperation({ id: "command.dove.mission", publicProjector: "command-public-report", commandId: "dove.mission", statuses: COMMAND_STATUS, interaction: "checkpoint", checkpoint: true, tools: ["query_dove_status", "manage_dove_mission"], pathInput: "none" }),
  freezeOperation({ id: "command.dove.status", publicProjector: "command-public-report", commandId: "dove.status", statuses: COMMAND_STATUS, interaction: "read", tools: ["query_dove_status"], pathInput: "none" }),
  freezeOperation({ id: "command.dove.lessons", publicProjector: "command-public-report", commandId: "dove.lessons", statuses: COMMAND_STATUS, interaction: "write", tools: ["manage_dove_lessons"], pathInput: "none" }),
  freezeOperation({ id: "command.dove.source", publicProjector: "command-public-report", commandId: "dove.source", statuses: COMMAND_STATUS, interaction: "write", continuation: RESUME_ORIGINAL, closure: DOMAIN_CLOSURE, tools: ["query_dove_status", "manage_dove_mission", "manage_dove_sources"], pathInput: "workspace-file" }),
  freezeOperation({ id: "command.dove.note", publicProjector: "command-public-report", commandId: "dove.note", statuses: COMMAND_STATUS, interaction: "write", continuation: RESUME_ORIGINAL, tools: ["query_dove_status", "manage_dove_mission"], pathInput: "workspace-file" }),
  freezeOperation({ id: "command.dove.experience", publicProjector: "command-public-report", commandId: "dove.experience", statuses: COMMAND_STATUS, interaction: "write", continuation: RESUME_ORIGINAL, tools: ["query_dove_status", "manage_dove_mission"], pathInput: "workspace-file" }),
  freezeOperation({ id: "command.dove.experiment", publicProjector: "command-public-report", commandId: "dove.experiment", statuses: COMMAND_STATUS, interaction: "write", continuation: RESUME_ORIGINAL, closure: DOMAIN_CLOSURE, tools: ["query_dove_status", "manage_dove_mission", "record_dove_experiment", "record_dove_claims"], pathInput: "workspace-file" }),
  freezeOperation({ id: "command.dove.draft", publicProjector: "command-public-report", commandId: "dove.draft", statuses: COMMAND_STATUS, interaction: "write", continuation: RESUME_ORIGINAL, closure: DOMAIN_CLOSURE, tools: ["query_dove_status", "manage_dove_mission", "record_dove_draft"], pathInput: "workspace-file" }),
  freezeOperation({ id: "command.dove.figure", publicProjector: "command-public-report", commandId: "dove.figure", statuses: COMMAND_STATUS, interaction: "write", continuation: RESUME_ORIGINAL, closure: DOMAIN_CLOSURE, tools: ["query_dove_status", "manage_dove_mission", "record_dove_figure"], pathInput: "workspace-file" }),
  freezeOperation({ id: "command.dove.review", publicProjector: "command-public-report", commandId: "dove.review", statuses: COMMAND_STATUS, interaction: "write", continuation: RESUME_ORIGINAL, closure: DOMAIN_CLOSURE, tools: ["query_dove_status", "manage_dove_mission", "manage_dove_review"], pathInput: "workspace-file" }),
  freezeOperation({ id: "command.dove.rebuttal", publicProjector: "command-public-report", commandId: "dove.rebuttal", statuses: COMMAND_STATUS, interaction: "write", continuation: RESUME_ORIGINAL, closure: DOMAIN_CLOSURE, tools: ["query_dove_status", "manage_dove_mission", "record_dove_rebuttal"], pathInput: "workspace-file" })
];

export const OPERATION_REGISTRY = Object.freeze([...toolOperations, ...commandOperations]);
export const TOOL_OPERATIONS = Object.freeze(toolOperations);
export const COMMAND_OPERATIONS = Object.freeze(commandOperations);

const OPERATION_BY_ID = new Map(OPERATION_REGISTRY.map((operation) => [operation.id, operation]));
const OPERATION_BY_TOOL = new Map(toolOperations.map((operation) => [operation.toolName, operation]));
const OPERATION_BY_TARGET_TOOL = new Map();
for (const operation of toolOperations) {
  for (const route of Object.values(operation.routes)) {
    const existing = OPERATION_BY_TARGET_TOOL.get(route.targetTool);
    if (existing && existing !== operation) throw new Error(`Dove target tool ${route.targetTool} maps to more than one canonical operation.`);
    OPERATION_BY_TARGET_TOOL.set(route.targetTool, operation);
  }
}
const OPERATION_BY_COMMAND = new Map(commandOperations.map((operation) => [operation.commandId, operation]));
if (OPERATION_BY_ID.size !== OPERATION_REGISTRY.length) throw new Error("Dove operation ids must be unique.");
if (OPERATION_BY_TOOL.size !== toolOperations.length) throw new Error("Dove tool operations must be unique.");
if (OPERATION_BY_COMMAND.size !== commandOperations.length) throw new Error("Dove command operations must be unique.");

function requireOperation(operation, label) {
  if (!operation) throw new Error(`Unknown Dove operation: ${label}`);
  return operation;
}

export function operationById(id) {
  return requireOperation(OPERATION_BY_ID.get(id), id);
}

export function operationForTool(name) {
  return requireOperation(OPERATION_BY_TOOL.get(name) ?? OPERATION_BY_TARGET_TOOL.get(name), name);
}

export function operationForCommand(commandId) {
  return requireOperation(OPERATION_BY_COMMAND.get(commandId), commandId);
}

export function operationRoute(operation, args = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  const routes = selected.routes ?? {};
  if (Object.keys(routes).length === 0) return null;
  const operationName = typeof args?.operation === "string" ? args.operation : Object.keys(routes).length === 1 ? Object.keys(routes)[0] : null;
  return operationName ? routes[operationName] ?? null : null;
}

export function operationTargetTool(operation, args = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  const route = operationRoute(selected, args);
  if (Object.keys(selected.routes ?? {}).length > 0 && !route) throw new Error(`${selected.toolName ?? selected.id} requires one canonical operation.`);
  return route?.targetTool ?? selected.toolName;
}

export function operationInteraction(operation, args = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  const route = operationRoute(selected, args);
  return assertPolicy(route?.interaction ?? resolvedPolicy(selected.interaction, args), INTERACTIONS, "interaction", selected.id);
}

export function operationRequiresCheckpoint(operation, args = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  const route = operationRoute(selected, args);
  const checkpoint = route?.checkpoint ?? resolvedPolicy(selected.checkpoint, args);
  if (typeof checkpoint !== "boolean") throw new Error(`Invalid checkpoint policy for Dove operation ${selected.id}: ${checkpoint}`);
  return checkpoint;
}

export function operationContinuation(operation, result = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  return assertPolicy(resolvedPolicy(selected.continuation, result), CONTINUATIONS, "continuation", selected.id);
}

export function operationClosure(operation, result = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  return assertPolicy(resolvedPolicy(selected.closure, result), CLOSURES, "closure", selected.id);
}

export function operationRetry(operation, outcome) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  if (!RETRY_OUTCOMES.includes(outcome)) throw new Error(`Unknown Dove operation retry outcome: ${outcome}`);
  return assertPolicy(selected.retry[outcome], RETRIES, `${outcome} retry`, selected.id);
}

export function operationStatus(operation, status) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "";
  return normalized ? selected.statuses[normalized] ?? null : null;
}

export function operationStatuses(operation) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  return selected.statuses;
}

export function operationPresentation(operation, result = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  return assertPolicy(resolvedPolicy(selected.presentation, result), PRESENTATIONS, "presentation", selected.id);
}

export function operationCallback(operation, result = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  const callback = resolvedPolicy(selected.callback, result);
  if (!callback || operationClosure(selected, result) !== callback.mode) return null;
  if (callback.when === "research-handoff" && !result?.executionHandoff) return null;
  return callback;
}

export function operationPublicProjector(operation, args = {}) {
  const selected = typeof operation === "string" ? operationById(operation) : operation;
  const projector = operationRoute(selected, args)?.publicProjector ?? selected.publicProjector;
  if (typeof projector !== "string" || !projector) throw new Error(`Dove operation ${selected.id} requires a public projector.`);
  return projector;
}

export function commandOperationMetadata(operationId) {
  const operation = operationById(operationId);
  if (!operation.commandId) throw new Error(`${operationId} is not a command operation.`);
  return {
    interaction: operationInteraction(operation),
    checkpoint: operationRequiresCheckpoint(operation),
    continuation: operationContinuation(operation),
    closure: operationClosure(operation),
    presentation: operationPresentation(operation),
    retry: operation.retry,
    publicProjector: operationPublicProjector(operation),
    pathInput: operation.pathInput,
    statuses: operation.statuses,
    requiredTools: [...operation.tools]
  };
}
