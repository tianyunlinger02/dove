const policyProps = {
  actorRole: { type: "string" },
  policyOverrideReason: { type: "string" },
  policyOverrideReasonCode: { type: "string" },
  policyOverrideEvidencePaths: { type: "array", items: { type: "string" } },
  policyOverrideTargetArtifact: { type: "string" },
  policyOverrideTargetId: { type: "string" },
  policyOverrideSourceId: { type: "string" },
  policyOverridePhase: { type: "string" },
  policyOverrideExpiresAt: { type: "string" }
};

function withPolicy(properties = {}) {
  return { ...properties, ...policyProps };
}

const taskTargetProps = {
  packetId: { type: "string", description: "Durable Dove task packet id that this task-scoped write must bind before mutating state." },
  taskPacketId: { type: "string", description: "Alias for the durable Dove task packet id." },
  missionPacketId: { type: "string", description: "Alias for the durable Dove mission packet id." },
  taskId: { type: "string", description: "Alias for the durable Dove task packet id." },
  target: { type: "string", description: "Natural-language task target used to resolve an existing durable packet." },
  packetTarget: { type: "string", description: "Natural-language packet target used to resolve an existing durable packet." },
  taskName: { type: "string", description: "Human task name used to resolve an existing durable packet." }
};

function withTaskTarget(properties = {}) {
  return { ...taskTargetProps, ...properties };
}

const boundaryProps = {
  boundary: { type: "object" },
  boundaryType: { type: "string" },
  boundaryId: { type: "string" },
  requiredInputs: { type: "array", items: { type: "string" } },
  requiredActions: { type: "array", items: { type: "string" } },
  ownerRole: { type: "string" },
  nextRole: { type: "string" },
  handoff: { type: "object" },
  handoffId: { type: "string" },
  blockedReason: { type: "string" }
};

const workContractProps = {
  purpose: { type: "string" },
  deliverables: { type: "array", items: { type: "string" } },
  outOfScope: { type: "array", items: { type: "string" } },
  outOfScopeItems: { type: "array", items: { type: "string" } },
  evidenceContract: { type: "array", items: { type: "string" } },
  doneCriteria: { type: "array", items: { type: "string" } },
  practicalImpact: { type: "string" },
  recommendedRoutes: { type: "array", items: { type: "object" } }
};

const executionContractProps = {
  chainType: { type: "string" },
  roleSequence: { type: "array", items: { type: "string" } },
  readFirst: { type: "array", items: { type: "string" } },
  action: { type: "string" },
  implementation: { type: "array", items: { type: "string" } },
  files: { type: "array", items: { type: "object", properties: { path: { type: "string" }, action: { type: "string" }, target: { type: "string" }, change: { type: "string" } } } },
  materials: { type: "object", properties: { requiredInputs: { type: "array", items: { type: "string" } }, requiredArtifacts: { type: "array", items: { type: "string" } }, sourceRefs: { type: "array", items: { type: "string" } }, artifactRefs: { type: "array", items: { type: "string" } } } },
  convergence: { type: "object", properties: { criteria: { type: "array", items: { type: "string" } }, verificationCommands: { type: "array", items: { type: "string" } }, evidenceRequired: { type: "array", items: { type: "string" } }, definitionOfDone: { type: "string" } } },
  failureRoutes: { type: "array", items: { type: "object", properties: { on: { type: "string" }, boundaryType: { type: "string" }, nextAction: { type: "string" }, requiredActions: { type: "array", items: { type: "string" } } } } }
};

const verifiedCriteriaItemProps = {
  criterion: { type: "string" },
  status: { type: "string" },
  evidencePaths: { type: "array", items: { type: "string" } }
};

const executionReceiptProps = {
  receiptId: { type: "string" },
  runId: { type: "string" },
  packetId: { type: "string" },
  command: { type: "string" },
  surface: { type: "string" },
  actionType: { type: "string" },
  startedAt: { type: "string" },
  completedAt: { type: "string" },
  status: { type: "string" },
  outcome: { type: "string" },
  resultSummary: { type: "string" },
  publicSafeSummary: { type: "string" },
  nextAction: { type: "string" },
  lifecycleTransition: { type: "object", properties: { previousStatus: { type: "string" }, nextStatus: { type: "string" } } },
  artifactRefs: { type: "array", items: { type: "string" } },
  artifactPaths: { type: "array", items: { type: "string" } },
  evidenceLinks: { type: "array", items: { type: "string" } },
  evidencePaths: { type: "array", items: { type: "string" } },
  validationEvidencePaths: { type: "array", items: { type: "string" } },
  verificationEvidencePaths: { type: "array", items: { type: "string" } },
  verifiedCriteria: { type: "array", items: { type: "object", properties: verifiedCriteriaItemProps } },
  criteriaCoverage: { type: "object" },
  validationGateResults: { type: "array", items: { type: "object" } },
  boundary: { type: "object" }
};

const executionVerificationProps = {
  executionContract: { type: "object", properties: executionContractProps },
  executionReceipt: { type: "object", properties: executionReceiptProps },
  validationEvidencePaths: { type: "array", items: { type: "string" } },
  verificationEvidencePaths: { type: "array", items: { type: "string" } },
  verifiedCriteria: { type: "array", items: { type: "object", properties: verifiedCriteriaItemProps } }
};

const contractAwareAutoStepProps = {
  requiredMaterials: { type: "array", items: { type: "string" } },
  outputArtifacts: { type: "array", items: { type: "string" } },
  convergenceChecks: { type: "array", items: { type: "string" } },
  failureRoutes: { type: "array", items: { type: "object" } },
  ...executionVerificationProps
};

const planMissionProps = {
  id: { type: "string" },
  packetId: { type: "string" },
  taskPacketId: { type: "string" },
  goal: { type: "string" },
  objective: { type: "string" },
  title: { type: "string" },
  summary: { type: "string" },
  stage: { type: "string" },
  missionStage: { type: "string" },
  domain: { type: "string" },
  doveDomain: { type: "string" },
  missionDomain: { type: "string" },
  level: { type: "number" },
  taskLevel: { type: "number" },
  missionLevel: { type: "number" },
  status: { type: "string" },
  dependencies: { type: "array", items: { type: "string" } },
  dependencyIds: { type: "array", items: { type: "string" } },
  blockedBy: { type: "array", items: { type: "string" } },
  blockerIds: { type: "array", items: { type: "string" } },
  evidenceExpectations: { type: "array", items: { type: "string" } },
  evidenceLinks: { type: "array", items: { type: "string" } },
  artifactRefs: { type: "array", items: { type: "string" } },
  artifactPaths: { type: "array", items: { type: "string" } },
  currentFocus: { type: "string" },
  nextAction: { type: "string" },
  workContract: { type: "object", properties: workContractProps },
  ...executionVerificationProps,
  ...boundaryProps,
  childMissions: { type: "array", items: { type: ["object", "string"] } },
  children: { type: "array", items: { type: ["object", "string"] } }
};

const operatorTaskResultProps = {
  id: { type: "string" },
  packetId: { type: "string" },
  taskPacketId: { type: "string" },
  taskId: { type: "string" },
  resultStatus: { type: "string" },
  taskStatus: { type: "string" },
  missionStatus: { type: "string" },
  completeTask: { type: "boolean" },
  complete: { type: "boolean" },
  completeOnSuccess: { type: "boolean" },
  blocked: { type: "boolean" },
  outcome: { type: "string" },
  summary: { type: "string" },
  resultSummary: { type: "string" },
  reason: { type: "string" },
  nextAction: { type: "string" },
  evidenceLinks: { type: "array", items: { type: "string" } },
  evidencePaths: { type: "array", items: { type: "string" } },
  artifactRefs: { type: "array", items: { type: "string" } },
  artifactPaths: { type: "array", items: { type: "string" } },
  ...executionVerificationProps,
  ...boundaryProps,
  startedAt: { type: "string" },
  completedAt: { type: "string" }
};

const resultModeProperty = {
  type: "string",
  enum: ["compact", "full", "debug"],
  description: "MCP response expansion mode. compact returns the stable result contract only; full includes fullResult; debug includes fullResult plus diagnostics."
};

const mutationModeProperty = {
  type: "string",
  enum: ["patch-plan", "direct-process"],
  description: "Canonical Dove mutation mode. patch-plan returns declarative file operations for host-tracked application; direct-process writes from the Dove process and is not verified host rollback-safe. If omitted, host-facing MCP calls keep functional direct-process behavior and return hostRollbackIneligibleReason plus rollbackAdvice when writes are not host-rollback eligible."
};

const operatorSurfaceProperty = {
  type: "string",
  enum: ["operator", "compact", "full", "debug"],
  description: "Tool discovery surface. operator/compact lists the small everyday Dove operator surface; full/debug lists the canonical registry."
};

export const OPERATOR_TOOL_NAMES = [
  "query_dove_status",
  "query_dove_orchestrate",
  "query_document_ledger",
  "query_operator_lessons",
  "create_dove_task",
  "run_dove_auto",
  "run_dove_operator",
  "register_source",
  "upsert_note",
  "upsert_draft",
  "record_document_evidence",
  "run_figure_workflow",
  "run_experience_workflow",
  "run_review_loop",
  "build_rebuttal_strategy",
  "query_dove_return"
];

const OPERATOR_WORKFLOW_AREAS = {
  query_dove_status: "status",
  query_dove_orchestrate: "routing",
  query_document_ledger: "evidence",
  query_operator_lessons: "lessons",
  create_dove_task: "mission",
  run_dove_auto: "auto",
  run_dove_operator: "operator",
  register_source: "source",
  upsert_note: "note",
  upsert_draft: "draft",
  record_document_evidence: "document",
  run_figure_workflow: "figure",
  run_experience_workflow: "experience",
  run_review_loop: "review",
  build_rebuttal_strategy: "rebuttal",
  query_dove_return: "verification"
};

const OPERATOR_SCHEMA_FIELDS = {
  query_dove_status: ["intent", "domain", "stage", "packetId", "status", "detail", "view", "showMissions", "includeMissionDetails", "requestStatusAdjustment", "includeStatusAdjustmentPreview", "resultMode"],
  query_dove_orchestrate: ["request", "userRequest", "goal", "domain", "stage", "targetArtifacts", "acceptanceChecks", "allowAutonomy", "resultMode"],
  query_document_ledger: ["packetId", "taskId", "documentKind", "status", "evidenceScope", "publicSafe", "limit", "resultMode"],
  query_operator_lessons: ["domain", "status", "tag", "actorRole", "limit", "resultMode"],
  create_dove_task: ["goal", "objective", "prompt", "title", "summary", "domain", "stage", "evidenceExpectations", "artifactPaths", "confirm", "confirmed", "resultMode", "mutationMode"],
  run_dove_auto: ["packetId", "taskId", "target", "goal", "prompt", "command", "workflow", "steps", "autoSteps", "maxIterations", "maxSteps", "confirm", "confirmed", "completeTask", "completeOnSuccess", "resultMode", "mutationMode"],
  run_dove_operator: ["confirm", "confirmed", "includeQueueDetails", "blockerInvestigationMode", "taskResults", "results", "resultMode", "mutationMode"],
  register_source: ["packetId", "taskId", "target", "sourceId", "citationKey", "title", "authors", "year", "locator", "sourceType", "abstract", "origin", "sources", "resultMode", "mutationMode"],
  upsert_note: ["packetId", "taskId", "target", "noteId", "title", "sectionId", "sourceIds", "summary", "quotes", "claims", "openQuestions", "resultMode", "mutationMode"],
  upsert_draft: ["packetId", "taskId", "target", "sectionId", "title", "body", "status", "summary", "resultMode", "mutationMode"],
  record_document_evidence: ["packetId", "taskId", "target", "documentId", "title", "documentKind", "status", "evidenceScope", "summary", "sourceRefs", "artifactRefs", "artifactPaths", "evidencePaths", "createDocument", "appendDocument", "body", "resultMode", "mutationMode"],
  run_figure_workflow: ["packetId", "taskId", "target", "intent", "description", "figureId", "purpose", "captionIntent", "artifactPaths", "materialHints", "providerId", "executeProvider", "allowMissingMaterials", "caption", "finalSvgPath", "svgContent", "resultMode", "mutationMode"],
  run_experience_workflow: ["packetId", "taskId", "target", "experimentId", "goal", "idea", "title", "methodology", "successMetric", "claimId", "result", "resultId", "outcome", "summary", "evidenceLinks", "artifactPaths", "resultMode", "mutationMode"],
  run_review_loop: ["packetId", "taskId", "target", "scope", "stage", "actorRole", "resultMode", "mutationMode"],
  build_rebuttal_strategy: ["packetId", "taskId", "target", "actorRole", "resultMode", "mutationMode"],
  query_dove_return: ["goal", "domain", "stage", "scope", "targetArtifacts", "artifactPaths", "acceptanceChecks", "validationEvidencePaths", "evidencePaths", "reviewEvidencePaths", "resultMode"]
};

export const toolDiscoveryInputSchema = {
  type: "object",
  properties: {
    surface: operatorSurfaceProperty,
    resultMode: resultModeProperty
  }
};

export const MUTATING_TOOL_NAMES = new Set([
  "ensure_workspace",
  "init_project",
  "publish_dove_status",
  "publish_dove_global_status",
  "record_document_evidence",
  "init_dove_goal",
  "create_dove_task",
  "record_dove_mission_pass",
  "apply_dove_status_adjustments",
  "run_dove_auto",
  "run_dove_operator",
  "kill_dove_task",
  "reset_dove_version",
  "run_experience_workflow",
  "prepare_audio_review",
  "import_audio_review",
  "run_audio_review",
  "run_dove_review_loop",
  "launch_dove_mission",
  "summarize_session_journal",
  "upsert_orchestration_board",
  "append_handoff",
  "update_research_brief",
  "register_source",
  "upsert_note",
  "upsert_claims",
  "upsert_plan",
  "upsert_outline",
  "upsert_draft",
  "upsert_experiment_plan",
  "upsert_experiment_result",
  "run_experiment_audit",
  "bridge_result_to_claim",
  "run_review_loop",
  "append_review_log",
  "prepare_isolated_review",
  "import_isolated_review",
  "upsert_revision_plan",
  "set_section_status",
  "sync_checklist",
  "sync_citations",
  "refresh_wiki",
  "normalize_rebuttal_issues",
  "build_rebuttal_strategy",
  "build_rebuttal",
  "create_version_snapshot",
  "compare_versions",
  "upsert_figure_plan",
  "run_figure_workflow",
  "prepare_figure_generation",
  "import_figure_generation",
  "validate_figure_pipeline",
  "record_operator_lesson",
  "record_operator_follow_through",
  "issue_program_approval",
  "plan_campaign",
  "revoke_program_approval",
  "materialize_guidance_packet",
  "run_autonomy_once",
  "run_autonomy_foreground",
  "run_autonomy_operate"
]);

function addMcpControlFields(tool) {
  const properties = {
    ...(tool.inputSchema?.properties ?? {}),
    resultMode: resultModeProperty
  };
  if (MUTATING_TOOL_NAMES.has(tool.name)) {
    properties.mutationMode = mutationModeProperty;
  }
  return {
    ...tool,
    inputSchema: {
      ...tool.inputSchema,
      properties
    }
  };
}

const baseToolDefinitions = [
  { name: "ensure_workspace", description: "Ensure the canonical .dove workspace and starter artifacts exist.", inputSchema: { type: "object", properties: {} } },
  {
    name: "init_project",
    description: "Initialize or refresh project metadata and the research contract.",
    inputSchema: { type: "object", properties: { title: { type: "string" }, venue: { type: "string" }, objective: { type: "string" }, deadline: { type: "string" }, thesis: { type: "string" }, audience: { type: "string" }, strictMode: { type: "boolean" } } }
  },
  { name: "read_state", description: "Read the normalized Dove state.", inputSchema: { type: "object", properties: {} } },
  { name: "query_task_graph", description: "Refresh and read the durable task-packet graph.", inputSchema: { type: "object", properties: {} } },
  { name: "query_open_questions", description: "Refresh and read open questions across notes, review state, and task packets.", inputSchema: { type: "object", properties: {} } },
  { name: "query_decisions", description: "Refresh and read durable operational decisions and comparison decisions.", inputSchema: { type: "object", properties: {} } },
  { name: "query_lineage", description: "Refresh and read version lineage plus comparison targets.", inputSchema: { type: "object", properties: {} } },
  { name: "query_workspace_index", description: "Refresh and read the top-level workspace index for resumable state.", inputSchema: { type: "object", properties: {} } },
  { name: "query_meta_optimize", description: "Refresh and read the proposal-only meta-optimize frontier, taxonomy-aware grouped clusters, family-level operator playbooks, ranked recommendations, durable remediation packs, longer-horizon memory summaries, and report paths.", inputSchema: { type: "object", properties: {} } },
  { name: "query_governance_coverage_report", description: "Refresh and read the durable governance coverage proof report for guarded and exempt mutation paths.", inputSchema: { type: "object", properties: {} } },
  { name: "query_operator_lessons", description: "Read explicit distilled operator lessons and retrospectives; action surfaces also recall applicable lessons automatically as read-only preActionGuidance without importing raw runtime traces or refreshing derived work surfaces.", inputSchema: { type: "object", properties: { domain: { type: "string" }, status: { type: "string" }, tag: { type: "string" }, actorRole: { type: "string" }, limit: { type: "number" } } } },
  { name: "query_operator_follow_through", description: "Refresh and read the proposal-only operator follow-through ledger for remediation, playbook, and execution-bridge decisions.", inputSchema: { type: "object", properties: {} } },
  { name: "query_paper_audit", description: "Run a strict audit-only paper inspection that reports findings without writing or repairing .dove artifacts.", inputSchema: { type: "object", properties: { scope: { type: "string" } } } },
  { name: "query_dove_onboarding", description: "Map project-local paper artifacts as a proposal-only Dove onboarding query without moving, rewriting, or persisting source assets.", inputSchema: { type: "object", properties: { maxDepth: { type: "number" }, maxFiles: { type: "number" }, excludeDirs: { type: "array", items: { type: "string" } }, writeMap: { type: "boolean" } } } },
  { name: "query_paper_pipeline", description: "Read the paper-domain lifecycle state from durable Dove artifacts without executing commands, running external processes, inspecting git, or writing state.", inputSchema: { type: "object", properties: {} } },
  { name: "query_dove_orchestrate", description: "Route one Dove mission to the next Dove command without writing, refreshing, running tests, or inspecting git.", inputSchema: { type: "object", properties: { request: { type: "string" }, userRequest: { type: "string" }, goal: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, targetArtifacts: { type: "array", items: { type: "string" } }, artifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, acceptanceChecks: { type: "array", items: { type: "string" } }, allowAutonomy: { type: "boolean" } } } },
  { name: "query_dove_mission", description: "Frame one proposal-only Dove mission contract from the current authoritative .dove workspace without writing durable state.", inputSchema: { type: "object", properties: { goal: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, targetArtifacts: { type: "array", items: { type: "string" } }, artifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, acceptanceChecks: { type: "array", items: { type: "string" } }, nextCommand: { type: "string" } } } },
  { name: "query_dove_mission_board", description: "Read the low-level Dove mission board/debug view from authoritative .dove state without writing, refreshing, running tests, or inspecting git; ordinary mission-list prompts should use query_dove_status and expand statusHome.optionalMissionDetails instead.", inputSchema: { type: "object", properties: { domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, packetId: { type: "string" }, packetIds: { type: "array", items: { type: "string" } }, missionPacketId: { type: "string" }, missionPacketIds: { type: "array", items: { type: "string" } }, status: { type: "string" }, statuses: { type: "array", items: { type: "string" } }, includeArchived: { type: "boolean" } } } },
  { name: "query_dove_status", description: "Read the compact Dove status translator by default: the compact MCP result exposes summary/headline, nextStep, needsAttention, changes, and showMore so ordinary operators see one-sentence state, one recommended action, and explicit expansion paths instead of packet/mission/boundary/gap internals. `statusHome.durableContextNotice`, mutationRollbackModel, patch-plan plus host-tracked file-edit requirements, host checkpoint verification limits, unverified direct-process writes, statusHome.preActionGuidance, automatic read-only lesson recall, Planner/Builder/Reviewer role framing, blockers/reconciliation, project state, runtime/dashboard details, and raw action candidates are available only through resultMode: full/debug or detail/full expansion. Default compact status must not render a Missions panel, blocked counts, execution-gap counts, required-evidence blocks, or ask whether to modify mission statuses. Pass showMissions/includeMissionDetails (or detail/view: missions) only for explicit ordinary mission-list prompts; pass requestStatusAdjustment/includeStatusAdjustmentPreview only when the operator explicitly asks to change mission states after a fresh status read; host/context rollback must use mutationMode: patch-plan applied through host-tracked file edits, not git detection, not direct-process, and not reset_dove_version.", inputSchema: { type: "object", properties: { domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, packetId: { type: "string" }, packetIds: { type: "array", items: { type: "string" } }, status: { type: "string" }, statuses: { type: "array", items: { type: "string" } }, includeArchived: { type: "boolean" }, intent: { type: "string", enum: ["project-status", "health-check", "contract-test"] }, detail: { type: "string" }, view: { type: "string" }, resultMode: { type: "string" }, full: { type: "boolean" }, includeDetails: { type: "boolean" }, showMissions: { type: "boolean" }, includeMissionDetails: { type: "boolean" }, requestStatusAdjustment: { type: "boolean" }, includeStatusAdjustmentPreview: { type: "boolean" } } } },
  { name: "publish_dove_status", description: "Publish sanitized public Dove project progress artifacts to .dove/public/status.json, status.md, and index.html without exposing raw transcripts, secrets, runtime entries, or starting external tunnels.", inputSchema: { type: "object", properties: { includeArchived: { type: "boolean" }, responseLanguage: { type: "string" }, generatedAt: { type: "string" } } } },
  { name: "publish_dove_global_status", description: "Publish a single global static Dove status index from explicit or configured project .dove/public artifacts without scanning the computer, exposing local roots, or starting external tunnels.", inputSchema: { type: "object", properties: { projectRoots: { type: "array", items: { type: "string" } }, projects: { type: "array", items: { type: "object" } }, outputDir: { type: "string" }, refresh: { type: "boolean" }, includeConfig: { type: "boolean" }, includeArchived: { type: "boolean" }, responseLanguage: { type: "string" }, generatedAt: { type: "string" } } } },
  { name: "query_document_ledger", description: "Read the proposal-only Dove document/evidence ledger without writing state or exposing document bodies.", inputSchema: { type: "object", properties: { packetId: { type: "string" }, taskPacketId: { type: "string" }, missionPacketId: { type: "string" }, taskId: { type: "string" }, documentKind: { type: "string" }, status: { type: "string" }, evidenceScope: { type: "string" }, publicSafe: { type: "boolean" }, limit: { type: "number" } } } },
  { name: "record_document_evidence", description: "Record an explicit task-scoped Dove document/evidence ledger entry with Builder/researcher preActionGuidanceSummary, optionally creating or appending a .dove/documents archive document for internal summaries, pressure-test reports, and synthesized outputs while preserving source/artifact provenance; do not overwrite existing documents or capture raw transcripts/private reasoning.", inputSchema: { type: "object", properties: withTaskTarget({ id: { type: "string" }, documentId: { type: "string" }, title: { type: "string" }, documentTitle: { type: "string" }, documentPath: { type: "string" }, path: { type: "string" }, documentKind: { type: "string" }, kind: { type: "string" }, status: { type: "string" }, evidenceScope: { type: "string" }, scope: { type: "string" }, publicSafe: { type: "boolean" }, visibility: { type: "string" }, summary: { type: "string" }, context: { type: "string" }, reason: { type: "string" }, sourceRefs: { type: "array", items: { type: "string" } }, sourceIds: { type: "array", items: { type: "string" } }, artifactRefs: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, evidencePaths: { type: "array", items: { type: "string" } }, claimIds: { type: "array", items: { type: "string" } }, claims: { type: "array", items: { type: "string" } }, createDocument: { type: "boolean" }, appendDocument: { type: "boolean" }, body: { type: "string" }, content: { type: "string" }, createdBy: { type: "string" }, actorRole: { type: "string" } }) } },
  { name: "query_dove_audit", description: "Inspect Dove mission audit findings and return readiness without writing, refreshing, fixing, running tests, or inspecting git.", inputSchema: { type: "object", properties: { scope: { type: "string" }, goal: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, targetArtifacts: { type: "array", items: { type: "string" } }, artifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, acceptanceChecks: { type: "array", items: { type: "string" } }, validationEvidencePaths: { type: "array", items: { type: "string" } }, validationEvidence: { type: "array", items: { type: "string" } }, evidencePaths: { type: "array", items: { type: "string" } }, changedFilePaths: { type: "array", items: { type: "string" } }, changedFiles: { type: "array", items: { type: "string" } }, changedPaths: { type: "array", items: { type: "string" } }, testEvidencePaths: { type: "array", items: { type: "string" } }, testPaths: { type: "array", items: { type: "string" } }, validationOutputPaths: { type: "array", items: { type: "string" } }, validationLogPaths: { type: "array", items: { type: "string" } }, testOutputPaths: { type: "array", items: { type: "string" } }, validationOutputs: { type: "array", items: { type: "string" } }, validationOutput: { type: "string" }, reviewEvidencePaths: { type: "array", items: { type: "string" } }, reviewEvidence: { type: "array", items: { type: "string" } } } } },
  { name: "query_dove_return", description: "Inspect Dove mission return readiness from durable .dove state without writing, fixing, running tests, or inspecting git.", inputSchema: { type: "object", properties: { goal: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, scope: { type: "string" }, targetArtifacts: { type: "array", items: { type: "string" } }, artifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, acceptanceChecks: { type: "array", items: { type: "string" } }, validationEvidencePaths: { type: "array", items: { type: "string" } }, validationEvidence: { type: "array", items: { type: "string" } }, evidencePaths: { type: "array", items: { type: "string" } }, changedFilePaths: { type: "array", items: { type: "string" } }, changedFiles: { type: "array", items: { type: "string" } }, changedPaths: { type: "array", items: { type: "string" } }, testEvidencePaths: { type: "array", items: { type: "string" } }, testPaths: { type: "array", items: { type: "string" } }, validationOutputPaths: { type: "array", items: { type: "string" } }, validationLogPaths: { type: "array", items: { type: "string" } }, testOutputPaths: { type: "array", items: { type: "string" } }, validationOutputs: { type: "array", items: { type: "string" } }, validationOutput: { type: "string" }, reviewEvidencePaths: { type: "array", items: { type: "string" } }, reviewEvidence: { type: "array", items: { type: "string" } } } } },
  { name: "init_dove_goal", description: "Create or update the unique level-0 Dove init goal task.", inputSchema: { type: "object", properties: { id: { type: "string" }, goal: { type: "string" }, title: { type: "string" }, objective: { type: "string" }, summary: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, status: { type: "string" }, artifactRefs: { type: "array", items: { type: "string" } } } } },
  { name: "create_dove_task", description: "Convert a user demand into a proposal-only mission work contract with compact task card and preActionGuidance; mission is a durable work/progress object, and only after approval materializes the task for one bounded foreground mission pass with localized resultCard/preActionGuidanceSummary.", inputSchema: { type: "object", properties: { id: { type: "string" }, initId: { type: "string" }, initTitle: { type: "string" }, initObjective: { type: "string" }, initGoal: { type: "string" }, projectTitle: { type: "string" }, workspaceTitle: { type: "string" }, projectObjective: { type: "string" }, projectGoal: { type: "string" }, initDomain: { type: "string" }, projectDomain: { type: "string" }, initStatus: { type: "string" }, initArtifactRefs: { type: "array", items: { type: "string" } }, goal: { type: "string" }, objective: { type: "string" }, prompt: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, level: { type: "number" }, taskLevel: { type: "number" }, missionLevel: { type: "number" }, checklist: { type: ["boolean", "array"] }, autoChecklist: { type: "boolean" }, createChecklist: { type: "boolean" }, checklistItems: { type: "array", items: { type: ["object", "string"] } }, subtasks: { type: "array", items: { type: ["object", "string"] } }, creatorKind: { type: "string" }, dependencies: { type: "array", items: { type: "string" } }, dependencyIds: { type: "array", items: { type: "string" } }, blockedBy: { type: "array", items: { type: "string" } }, blockerIds: { type: "array", items: { type: "string" } }, evidenceExpectations: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, artifactRefs: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, lessonIds: { type: "array", items: { type: "string" } }, workContract: { type: "object", properties: workContractProps }, deliverables: { type: "array", items: { type: "string" } }, outOfScope: { type: "array", items: { type: "string" } }, outOfScopeItems: { type: "array", items: { type: "string" } }, evidenceContract: { type: "array", items: { type: "string" } }, doneCriteria: { type: "array", items: { type: "string" } }, practicalImpact: { type: "string" }, recommendedRoutes: { type: "array", items: { type: "object" } }, contextPolicy: { type: "string" }, status: { type: "string" }, command: { type: "string" }, workflow: { type: "string" }, steps: { type: "array", items: { type: ["object", "string"], properties: contractAwareAutoStepProps } }, runId: { type: "string" }, missionPass: { type: "object" }, passResult: { type: "object" }, result: { type: "object" }, resultStatus: { type: "string" }, taskStatus: { type: "string" }, missionStatus: { type: "string" }, completeTask: { type: "boolean" }, complete: { type: "boolean" }, completeOnSuccess: { type: "boolean" }, blocked: { type: "boolean" }, resultSummary: { type: "string" }, outcome: { type: "string" }, stopReason: { type: "string" }, evidencePaths: { type: "array", items: { type: "string" } }, ...executionVerificationProps, nextAction: { type: "string" }, ...boundaryProps, startedAt: { type: "string" }, completedAt: { type: "string" }, plannedMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, resultingMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, missions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, childMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, confirmed: { type: "boolean" }, confirm: { type: "boolean" } } } },
  { name: "record_dove_mission_pass", description: "Record the result of one bounded foreground /dove:mission pass after resolving the durable task packet, converting completed plan outputs into pending missions when supplied, and returning a localized resultCard summary. When a host-side search/fetch/shell/MCP safety classifier or tool-availability failure prevents normal completion, record resultStatus blocked with boundaryType host-tool-blocked so the task is visibly blocked instead of left in-progress.", inputSchema: { type: "object", properties: withTaskTarget({ id: { type: "string" }, runId: { type: "string" }, resultStatus: { type: "string" }, taskStatus: { type: "string" }, missionStatus: { type: "string" }, completeTask: { type: "boolean" }, complete: { type: "boolean" }, completeOnSuccess: { type: "boolean" }, blocked: { type: "boolean" }, resultSummary: { type: "string" }, summary: { type: "string" }, outcome: { type: "string" }, stopReason: { type: "string" }, evidenceLinks: { type: "array", items: { type: "string" } }, evidencePaths: { type: "array", items: { type: "string" } }, artifactRefs: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, ...executionVerificationProps, command: { type: "string" }, workflow: { type: "string" }, preset: { type: "string" }, nextCommand: { type: "string" }, nextAction: { type: "string" }, ...boundaryProps, startedAt: { type: "string" }, completedAt: { type: "string" }, convertPlanToMissions: { type: "boolean" }, planConversion: { type: "object", properties: { plannedMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, resultingMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, missions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, childMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } } } }, plannedMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, resultingMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, missions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } }, childMissions: { type: "array", items: { type: ["object", "string"], properties: planMissionProps } } }) } },
  { name: "apply_dove_status_adjustments", description: "Preview compact status adjustment cards and apply explicitly confirmed status choices to non-init Dove task packets only after the single /dove:status confirmation dialog yields clear packetId-to-status adjustments; confirmed calls return a localized resultCard.", inputSchema: { type: "object", properties: { confirmed: { type: "boolean" }, confirm: { type: "boolean" }, adjustments: { type: "array", items: { type: "object", properties: { packetId: { type: "string" }, taskPacketId: { type: "string" }, taskId: { type: "string" }, id: { type: "string" }, status: { type: "string" }, taskStatus: { type: "string" }, missionStatus: { type: "string" }, reason: { type: "string" }, summary: { type: "string" }, nextAction: { type: "string" }, artifactRefs: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, ...executionVerificationProps } } }, statusAdjustments: { type: "array", items: { type: "object" } }, items: { type: "array", items: { type: "object" } } } } },
  {
    name: "run_dove_auto",
    description: "Run demand-to-task intake with compact task/auto cards and preActionGuidance, then after explicit confirmation run bounded foreground iterations until completion or a boundary. Source-research auto runs should collect concrete URLs/templates/guidelines and synthesis text in the foreground host pass, never claim source research succeeded when search/fetch returned zero results or safety errors, then call confirmed run_dove_auto once with explicit source and note steps; calling with only a packet id records a source-requires-host-provenance boundary and does not advance research. Missing source/note/draft/experience/review-loop material becomes an explicit blocked host-pass boundary instead of placeholder writes, and host-side safety classifier or tool-availability failures must be recorded as blocked host-tool-blocked mission results; no hidden continuation, scheduler, or daemon is started.",
    inputSchema: {
      type: "object",
      properties: withTaskTarget({
        id: { type: "string" },
        index: { type: "number" },
        confirmed: { type: "boolean" },
        confirm: { type: "boolean" },
        goal: { type: "string" },
        objective: { type: "string" },
        prompt: { type: "string" },
        title: { type: "string" },
        summary: { type: "string" },
        stage: { type: "string" },
        domain: { type: "string" },
        initId: { type: "string" },
        initTitle: { type: "string" },
        initObjective: { type: "string" },
        initGoal: { type: "string" },
        projectTitle: { type: "string" },
        workspaceTitle: { type: "string" },
        projectObjective: { type: "string" },
        projectGoal: { type: "string" },
        initDomain: { type: "string" },
        projectDomain: { type: "string" },
        initStatus: { type: "string" },
        initArtifactRefs: { type: "array", items: { type: "string" } },
        command: { type: "string" },
        workflow: { type: "string" },
        maxIterations: { type: "number" },
        maxSteps: { type: "number" },
        completeTask: { type: "boolean" },
        completeOnSuccess: { type: "boolean" },
        ...executionVerificationProps,
        steps: { type: "array", items: { type: ["object", "string"], properties: contractAwareAutoStepProps } },
        autoSteps: { type: "array", items: { type: ["object", "string"], properties: contractAwareAutoStepProps } },
        runId: { type: "string" }
      })
    }
  },
  { name: "run_dove_operator", description: "Preview compact queue summary/cards with planner preActionGuidance and read-only lesson recall by default, optionally returning full queue details only when includeQueueDetails is true; after explicit confirmation run one foreground operator pass across safe internal steps and explicit host-supplied task results. Host-pass work without taskResults remains unchanged and is returned with material-specific host-pass requiredActions, host-tool-blocked task results record host-side safety classifier or tool-availability failures, blocked work is proposal-only by default, and pending blocker-investigation plan missions are created only when blockerInvestigationMode is create or createBlockedInvestigations is true. Returns created/reused blocker counts and a localized resultCard; no scheduler or hidden runtime.", inputSchema: { type: "object", properties: { confirmed: { type: "boolean" }, confirm: { type: "boolean" }, includeQueueDetails: { type: "boolean" }, blockerInvestigationMode: { type: "string", enum: ["none", "propose", "create"] }, createBlockedInvestigations: { type: "boolean" }, runId: { type: "string" }, taskResults: { type: "array", items: { type: "object", properties: operatorTaskResultProps } }, results: { type: "array", items: { type: "object", properties: operatorTaskResultProps } }, passResults: { type: "array", items: { type: "object", properties: operatorTaskResultProps } } } } },
  { name: "kill_dove_task", description: "Internal guarded capability to kill a non-init Dove task; public operators normally choose killed through /dove:status status adjustment UX.", inputSchema: { type: "object", properties: { packetId: { type: "string" }, taskPacketId: { type: "string" }, taskId: { type: "string" }, id: { type: "string" }, target: { type: "string" }, taskName: { type: "string" }, title: { type: "string" }, index: { type: "number" }, reason: { type: "string" }, killReason: { type: "string" } } } },
  { name: "reset_dove_version", description: "Create a direction-change snapshot and clear active tasks except the level-0 init task. This is not a .dove rollback restore entrypoint; host/context rollback should use mutationMode: patch-plan applied through host-tracked file edits before relying on the host native checkpoint.", inputSchema: { type: "object", properties: { id: { type: "string" }, versionId: { type: "string" }, title: { type: "string" }, reason: { type: "string" }, summary: { type: "string" } } } },
  { name: "run_experience_workflow", description: "Plan, record, audit, and bridge experiment experience into claim state after resolving the durable task packet; every new experience requires a real experiment goal, title, idea, or experimentId, and missing objectives should become an explicit host-pass boundary instead of a placeholder plan. Returns Builder/experiment-planner preActionGuidance with read-only lesson recall, audit gate, and claim-bridge boundary.", inputSchema: { type: "object", properties: withTaskTarget({ id: { type: "string" }, experimentId: { type: "string" }, goal: { type: "string" }, idea: { type: "string" }, title: { type: "string" }, methodology: { type: "string" }, method: { type: "string" }, successMetric: { type: "string" }, metric: { type: "string" }, comparisonTargets: { type: "array", items: { type: "string" } }, baselines: { type: "array", items: { type: "string" } }, claimId: { type: "string" }, result: { type: "object" }, resultId: { type: "string" }, outcome: { type: "string" }, summary: { type: "string" }, resultSummary: { type: "string" }, evidenceLinks: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } } }) } },
  { name: "prepare_audio_review", description: "Prepare an isolated audio review input bundle containing only task summary, final plan/result paths, explicit artifacts, hashes, instructions, and output contract; result cards include Reviewer preActionGuidanceSummary and preserve the no-private-transcript boundary.", inputSchema: { type: "object", properties: withTaskTarget({ runId: { type: "string" }, instructions: { type: "string" }, finalPlanPaths: { type: "array", items: { type: "string" } }, planPaths: { type: "array", items: { type: "string" } }, finalResultPaths: { type: "array", items: { type: "string" } }, resultPaths: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, reviewedArtifactPaths: { type: "array", items: { type: "string" } }, contextPolicy: { type: "string" } }) } },
  { name: "import_audio_review", description: "Import only a declared audio review handoff and optional report artifact back into Dove review ledgers; returns Reviewer preActionGuidanceSummary and never imports private reviewer transcripts.", inputSchema: { type: "object", properties: withTaskTarget({ runId: { type: "string" }, handoffPath: { type: "string" }, reportPath: { type: "string" } }) } },
  { name: "run_audio_review", description: "Prepare an isolated audio review and import a handoff if one is already present; otherwise return import instructions plus a localized resultCard with Reviewer preActionGuidanceSummary and explicit handoff boundary.", inputSchema: { type: "object", properties: withTaskTarget({ runId: { type: "string" }, instructions: { type: "string" }, finalPlanPaths: { type: "array", items: { type: "string" } }, finalResultPaths: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, reviewedArtifactPaths: { type: "array", items: { type: "string" } }, handoffPath: { type: "string" }, reportPath: { type: "string" } }) } },
  { name: "run_dove_review_loop", description: "Run bounded audio review, draft, and experience iterations with the max iteration count from Dove settings by default; draft substeps require draftBody or draft.body and experience substeps require an explicit goal/title/idea/experimentId before any review-loop artifacts are prepared. Returns Reviewer preActionGuidance, recalled lessons, and foreground stop conditions.", inputSchema: { type: "object", properties: withTaskTarget({ runId: { type: "string" }, maxIterations: { type: "number" }, artifactPaths: { type: "array", items: { type: "string" } }, finalPlanPaths: { type: "array", items: { type: "string" } }, finalResultPaths: { type: "array", items: { type: "string" } }, draft: { type: "object" }, draftBody: { type: "string" }, sectionId: { type: "string" }, experience: { type: "object" }, experienceGoal: { type: "string" } }) } },
  { name: "launch_dove_mission", description: "Launch one governed Dove mission by materializing accepted proposal guidance into authoritative .dove mission packets without executing autonomy.", inputSchema: { type: "object", properties: withPolicy({ sourceType: { type: "string" }, sourceId: { type: "string" }, actorRole: { type: "string" }, workerRole: { type: "string" }, doveWorkerRole: { type: "string" }, goal: { type: "string" }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, targetArtifacts: { type: "array", items: { type: "string" } }, artifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, acceptanceChecks: { type: "array", items: { type: "string" } }, acceptanceCriteria: { type: "array", items: { type: "string" } }, returnProtocol: { type: "string" }, packetId: { type: "string" }, missionPacketId: { type: "string" }, followThroughId: { type: "string" }, selectedConversionPathKey: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, phase: { type: "string" }, assignedRole: { type: "string" }, lifecycleStatus: { type: "string" }, currentFocus: { type: "string" }, nextAction: { type: "string" }, dependencies: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, outputPaths: { type: "array", items: { type: "string" } }, ...executionVerificationProps, programId: { type: "string" }, programTitle: { type: "string" }, programObjective: { type: "string" }, programAgenda: { type: "array", items: { type: "string" } }, programEvidenceBacklog: { type: "array", items: { type: "string" } }, programRunId: { type: "string" }, approvalId: { type: "string" }, allowedStepType: { type: "string" }, decisionSummary: { type: "string" }, rationale: { type: "string" }, executeBy: { type: "string" }, reviewAfter: { type: "string" } }) } },
  { name: "query_program_approvals", description: "Read durable program approvals, runs, and review checkpoints.", inputSchema: { type: "object", properties: { programId: { type: "string" }, programRunId: { type: "string" }, status: { type: "string" } } } },
  { name: "query_campaigns", description: "Read durable multi-cycle campaign plans and their linked program/run state without executing work.", inputSchema: { type: "object", properties: { campaignId: { type: "string" }, status: { type: "string" } } } },
  { name: "query_boundary_report", description: "Read the workflow-pack boundary report for managed versus user-owned state.", inputSchema: { type: "object", properties: {} } },
  { name: "read_role_context_manifest", description: "Refresh and read a narrower per-role context manifest.", inputSchema: { type: "object", properties: { roleId: { type: "string" } } } },
  { name: "read_phase_context_manifest", description: "Refresh and read a phase-scoped context manifest.", inputSchema: { type: "object", properties: { phaseId: { type: "string" } } } },
  { name: "read_packet_context_manifest", description: "Refresh and read a packet-scoped context manifest with dependency and resume guidance.", inputSchema: { type: "object", properties: { packetId: { type: "string" } } } },
  { name: "read_artifact_context_manifest", description: "Refresh and read an artifact-scoped local context manifest tied to a durable path.", inputSchema: { type: "object", properties: { artifactPath: { type: "string" } } } },
  { name: "read_action_context_bundle", description: "Refresh and read an explicit pre-action local-context bundle for the current, role, phase, packet, or artifact scope.", inputSchema: { type: "object", properties: { scopeType: { type: "string" }, roleId: { type: "string" }, phaseId: { type: "string" }, packetId: { type: "string" }, artifactPath: { type: "string" } } } },
  { name: "summarize_session_journal", description: "Refresh and summarize durable session/workspace persistence surfaces.", inputSchema: { type: "object", properties: {} } },
  {
    name: "upsert_orchestration_board",
    description: "Update the canonical orchestration board under .dove/orchestration/board.json.",
    inputSchema: { type: "object", properties: withPolicy({ objective: { type: "string" }, phase: { type: "string" }, assignedRole: { type: "string" }, intentType: { type: "string" }, currentFocus: { type: "string" }, nextAction: { type: "string" }, continuationState: { type: "object" }, reviewRequiredBeforeFinalize: { type: "boolean" }, tasks: { type: "array", items: { type: "object" } }, blockers: { type: "array", items: { type: "object" } }, evidenceLinks: { type: "array", items: { type: "string" } }, experimentIds: { type: "array", items: { type: "string" } }, rebuttalIssueIds: { type: "array", items: { type: "string" } }, activeComparisonTargets: { type: "array", items: { type: "string" } }, versionLineage: { type: "object" } }) }
  },
  {
    name: "append_handoff",
    description: "Append a durable handoff entry and update the assigned role.",
    inputSchema: { type: "object", properties: withPolicy({ fromRole: { type: "string" }, toRole: { type: "string" }, phase: { type: "string" }, intentType: { type: "string" }, summary: { type: "string" }, currentFocus: { type: "string" }, nextAction: { type: "string" }, nextActions: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, blockerIds: { type: "array", items: { type: "string" } } }) }
  },
  {
    name: "update_research_brief",
    description: "Update the durable research brief and agenda artifacts. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ objective: { type: "string" }, agenda: { type: "array", items: { type: "string" } }, evidenceBacklog: { type: "array", items: { type: "string" } }, phase: { type: "string" }, assignedRole: { type: "string" } }) }
  },
  {
    name: "register_source",
    description: "Register or update one or more provenance-aware external source records with Builder/researcher preActionGuidanceSummary and packet-bound evidence provenance. Use `sources: [...]` for batch venue/template/guideline/ranking intake; each new source must include a real title or locator. Do not register sources whose origin/abstract says search returned zero results, safe-domain verification failed, or fetch/retrieval was blocked; surface a host-tool-blocked boundary until verifiable source evidence exists. Final user-facing summaries must separate verified registered sources from candidate links and blocked retrieval candidates instead of putting unverified candidates under generic Sources. Internal pressure-test summaries or writing-preference synthesis belong in `upsert_note` or `record_document_evidence`, not source. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ sourceId: { type: "string" }, citationKey: { type: "string" }, title: { type: "string" }, authors: { type: "array", items: { type: "string" } }, year: { type: ["string", "number"] }, locator: { type: "string" }, sourceType: { type: "string" }, abstract: { type: "string" }, origin: { type: "string" }, sources: { type: "array", items: { type: "object", properties: { sourceId: { type: "string" }, citationKey: { type: "string" }, title: { type: "string" }, authors: { type: "array", items: { type: "string" } }, year: { type: ["string", "number"] }, locator: { type: "string" }, sourceType: { type: "string" }, abstract: { type: "string" }, origin: { type: "string" } } } } }) }
  },
  {
    name: "upsert_note",
    description: "Create or update a packet-bound structured note linked to one or more registered sources with Builder/researcher preActionGuidanceSummary and evidence guardrails. New notes require real synthesis content: summary, quote, claim, or open question; empty note requests should stop at a host-pass boundary. Use notes for internal synthesis, pressure-test findings, writing-style summaries, and reviewer-preference analysis after external provenance is registered as sources. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ noteId: { type: "string" }, title: { type: "string" }, sectionId: { type: "string" }, sourceIds: { type: "array", items: { type: "string" } }, summary: { type: "string" }, quotes: { type: "array", items: { type: "string" } }, claims: { type: "array", items: { type: "string" } }, openQuestions: { type: "array", items: { type: "string" } } }) }
  },
  {
    name: "upsert_claims",
    description: "Write claims derived from results into the evidence store; resolves a durable task packet before writing, requires the builder role or researcher subagent unless overridden, and returns Builder/researcher preActionGuidanceSummary with citation/evidence guardrails.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ claims: { type: "array", items: { type: "object", properties: { id: { type: "string" }, text: { type: "string" }, sectionId: { type: "string" }, sourceIds: { type: "array", items: { type: "string" } }, noteIds: { type: "array", items: { type: "string" } }, experimentIds: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, status: { type: "string" }, confidence: { type: "string" }, gap: { type: "string" } } } } })) }
  },
  {
    name: "upsert_plan",
    description: "Create or update the current plan artifact with Planner preActionGuidanceSummary and scope/gate guardrails. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ thesis: { type: "string" }, audience: { type: "string" }, sections: { type: "array", items: { type: "string" } }, evidenceGaps: { type: "array", items: { type: "string" } }, milestones: { type: "array", items: { type: "string" } }, figures: { type: "array", items: { type: "string" } }, notes: { type: "string" } }) }
  },
  {
    name: "upsert_outline",
    description: "Create or update the current section outline with Planner preActionGuidanceSummary and draft gate guardrails. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ sections: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, status: { type: "string" }, goal: { type: "string" }, evidenceFocus: { type: "string" } } } } }) }
  },
  {
    name: "upsert_draft",
    description: "Create or update a section draft under .dove/drafts with Builder/researcher preActionGuidanceSummary. Draft updates require body content; use set_section_status for metadata-only section updates, and stop at a host-pass boundary when no draft body is available. Task-scoped writes resolve to a durable packet first; missing or ambiguous targets require explicit packet confirmation unless there is one unique high-confidence autoSelect candidate.",
    inputSchema: { type: "object", properties: withTaskTarget({ sectionId: { type: "string" }, title: { type: "string" }, body: { type: "string" }, status: { type: "string" }, summary: { type: "string" } }) }
  },
  {
    name: "upsert_experiment_plan",
    description: "Create or update a claim-driven experiment plan; resolves a durable task packet before writing and requires the builder role, or its experiment-planner subagent role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ id: { type: "string" }, title: { type: "string" }, claimId: { type: "string" }, hypothesis: { type: "string" }, methodology: { type: "string" }, successMetric: { type: "string" }, comparisonTargets: { type: "array", items: { type: "string" } }, status: { type: "string" }, owner: { type: "string" } })) }
  },
  {
    name: "upsert_experiment_result",
    description: "Create or update a durable experiment result entry; resolves a durable task packet before writing and requires the builder role, or its experiment-planner subagent role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ id: { type: "string" }, experimentId: { type: "string" }, claimId: { type: "string" }, outcome: { type: "string" }, summary: { type: "string" }, evidenceLinks: { type: "array", items: { type: "string" } }, comparisonTargets: { type: "array", items: { type: "string" } } })) }
  },
  {
    name: "run_experiment_audit",
    description: "Create or update a durable experiment audit record distinct from raw results; resolves a durable task packet before writing, requires resultId when an experiment has multiple results, and returns Reviewer preActionGuidanceSummary for the audit gate.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ resultId: { type: "string" }, experimentId: { type: "string" }, reviewedArtifactRefs: { type: "array", items: { type: "string" } }, auditFindings: { type: "array", items: { type: "string" } }, integrityFlags: { type: "array", items: { type: "string" } }, confidence: { type: "string" }, outcomeMapping: { type: "string" } })) }
  },
  {
    name: "bridge_result_to_claim",
    description: "Persist an explicit result-to-claim bridge event and update claim state with Builder/experiment-planner preActionGuidanceSummary; resolves a durable task packet before writing and requires resultId when an experiment has multiple results.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ resultId: { type: "string" }, experimentId: { type: "string" }, auditIds: { type: "array", items: { type: "string" } }, reason: { type: "string" } })) }
  },
  {
    name: "run_review_loop",
    description: "Run an evidence-aware independent review pass and generate a revision plan; resolves a durable task packet before writing, requires the reviewer role unless overridden, and returns role-framed preActionGuidance.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ scope: { type: "string" }, stage: { type: "string" } })) }
  },
  {
    name: "append_review_log",
    description: "Append a structured manual review entry; resolves a durable task packet before writing and requires the reviewer role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ timestamp: { type: "string" }, stage: { type: "string" }, scope: { type: "string" }, verdict: { type: "string" }, summary: { type: "string" }, findings: { type: "array", items: { type: "object" } }, actionItems: { type: "array", items: { type: "string" } } })) }
  },
  {
    name: "prepare_isolated_review",
    description: "Prepare an isolated reviewer input bundle from explicit Dove artifacts after resolving the durable task packet target, without invoking an external reviewer process; returns Reviewer preActionGuidanceSummary and explicit isolation boundaries.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ runId: { type: "string" }, scope: { type: "string" }, instructions: { type: "string" }, mediatorRole: { type: "string" }, reviewerRole: { type: "string" }, reviewedArtifactPaths: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } } })) }
  },
  {
    name: "import_isolated_review",
    description: "Import only an isolated review handoff and report artifact back into Dove review state after resolving the durable task packet target; returns Reviewer preActionGuidanceSummary and never imports private transcripts.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ runId: { type: "string" }, handoffPath: { type: "string" }, reportPath: { type: "string" } })) }
  },
  {
    name: "upsert_revision_plan",
    description: "Write a manual revision plan artifact; resolves a durable task packet before writing and requires the planner role unless a traceable override is provided.",
    inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ summary: { type: "string" }, items: { type: "array", items: { type: "string" } }, updatedAt: { type: "string" } })) }
  },
  { name: "set_section_status", description: "Update the status and summary for a section after resolving the durable task packet target; returns Planner preActionGuidanceSummary with section gate context.", inputSchema: { type: "object", properties: withTaskTarget({ sectionId: { type: "string" }, status: { type: "string" }, summary: { type: "string" } }) } },
  { name: "sync_checklist", description: "Regenerate the checklist from current state and review findings; returns Planner preActionGuidanceSummary with status gate context.", inputSchema: { type: "object", properties: {} } },
  { name: "sync_citations", description: "Audit citations and regenerate references.bib plus the citation log; returns Builder/researcher preActionGuidanceSummary with citation and evidence guardrails.", inputSchema: { type: "object", properties: { citedOnly: { type: "boolean" } } } },
  { name: "refresh_wiki", description: "Regenerate the durable research wiki and typed wiki indexes from current sources, notes, claims, and review state; returns Planner preActionGuidanceSummary for reusable context refresh.", inputSchema: { type: "object", properties: {} } },
  { name: "normalize_rebuttal_issues", description: "Normalize reviewer issues into a durable rebuttal issue board after resolving the durable task packet target; requires the reviewer role unless overridden and returns Reviewer preActionGuidanceSummary.", inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ issues: { type: "array", items: { type: "object" } } })) } },
  { name: "build_rebuttal_strategy", description: "Generate the rebuttal strategy and response draft from normalized issues after resolving the durable task packet target; requires the builder role or revision/rebuttal subagent role and returns Builder/revision-lead preActionGuidanceSummary.", inputSchema: { type: "object", properties: withPolicy(withTaskTarget({})) } },
  { name: "build_rebuttal", description: "Generate an artifact-backed rebuttal draft from review and evidence state after resolving the durable task packet target.", inputSchema: { type: "object", properties: withTaskTarget({}) } },
  { name: "create_version_snapshot", description: "Snapshot the current paper state and update version lineage after resolving the durable task packet target; requires the planner role, or its version-analyst audit subagent role unless a traceable override is provided.", inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ versionId: { type: "string" }, label: { type: "string" }, parentVersionId: { type: "string" }, summary: { type: "string" } })) } },
  { name: "compare_versions", description: "Compare two durable paper snapshots and record the comparison after resolving the durable task packet target; requires the planner role, or its version-analyst audit subagent role unless a traceable override is provided.", inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ fromVersionId: { type: "string" }, toVersionId: { type: "string" } })) } },
  { name: "list_artifacts", description: "List the expected Dove artifacts and whether they exist.", inputSchema: { type: "object", properties: {} } },
  { name: "upsert_figure_plan", description: "Write the figure backlog, linkage metadata, generation intent, and artifact contracts after resolving the durable task packet target; returns Builder preActionGuidanceSummary with provenance and QA gates.", inputSchema: { type: "object", properties: withTaskTarget({ items: { type: "array", items: { type: "object" } } }) } },
  { name: "run_figure_workflow", description: "Turn one user-described figure intent into a packet-scoped figure plan, material discovery, optional generation/import, caption/provenance, and QA status; returns Builder preActionGuidance with artifact-provenance and QA gates. Use providerId none for a first-class plan-only/manual-output path that records backlog, material bundle, generation prompt, and an awaiting-provider-output or missing-required-materials boundary without routing the operator to upsert_figure_plan. Use providerId gpt-image2 only for explicit foreground OpenAI image generation with OPENAI_API_KEY supplied through the environment, never as an inline secret.", inputSchema: { type: "object", properties: withTaskTarget({ intent: { type: "string" }, description: { type: "string" }, name: { type: "string" }, title: { type: "string" }, figureId: { type: "string" }, id: { type: "string" }, purpose: { type: "string" }, captionIntent: { type: "string" }, targetClaimIds: { type: "array", items: { type: "string" } }, claimIds: { type: "array", items: { type: "string" } }, sourceSections: { type: "array", items: { type: "string" } }, sectionIds: { type: "array", items: { type: "string" } }, sourceArtifactPaths: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, relatedExperimentIds: { type: "array", items: { type: "string" } }, experimentIds: { type: "array", items: { type: "string" } }, reviewConcernIds: { type: "array", items: { type: "string" } }, rebuttalIssueIds: { type: "array", items: { type: "string" } }, requiredVisualElements: { type: "array", items: { type: "string" } }, materialHints: { type: "array", items: { type: ["object", "string"] } }, materialRequirements: { type: "array", items: { type: "object" } }, providerId: { type: "string" }, executeProvider: { type: "boolean" }, allowMissingMaterials: { type: "boolean" }, runId: { type: "string" }, outputFormat: { type: "string" }, constraints: { type: "array", items: { type: "string" } }, outputManifestPath: { type: "string" }, finalSvgPath: { type: "string" }, svgContent: { type: "string" }, caption: { type: "string" }, captionDraft: { type: "string" }, captionId: { type: "string" } }) } },
  { name: "prepare_figure_generation", description: "Discover required figure materials and write a durable generation input bundle after resolving the durable task packet target; returns Builder preActionGuidanceSummary while keeping material provenance and provider boundaries explicit. providerId gpt-image2 selects the built-in OpenAI image provider only for explicit foreground execution with OPENAI_API_KEY supplied through the environment, never as an inline secret.", inputSchema: { type: "object", properties: withTaskTarget({ figureId: { type: "string" }, id: { type: "string" }, runId: { type: "string" }, providerId: { type: "string" }, constraints: { type: "array", items: { type: "string" } }, outputFormat: { type: "string" }, materialHints: { type: "array", items: { type: ["object", "string"] } }, executeProvider: { type: "boolean" }, allowMissingMaterials: { type: "boolean" } }) } },
  { name: "import_figure_generation", description: "Import a declared generated figure output, validate SVG safety, write caption/provenance, refresh figure QA, and return Builder preActionGuidanceSummary with the artifact-provenance gate after resolving the durable task packet target.", inputSchema: { type: "object", properties: withTaskTarget({ figureId: { type: "string" }, id: { type: "string" }, runId: { type: "string" }, outputManifestPath: { type: "string" }, caption: { type: "string" }, captionDraft: { type: "string" }, captionId: { type: "string" }, finalSvgPath: { type: "string" }, svgContent: { type: "string" } }) } },
  { name: "validate_figure_pipeline", description: "Regenerate durable figure material, generation, caption, and stage-validation QA outputs.", inputSchema: { type: "object", properties: {} } },
  { name: "record_operator_lesson", description: "Record one explicit distilled operator lesson with problem, decisions, pitfalls, validation, and next-time guidance; action surfaces auto-recall lessons read-only, but recording never happens implicitly and raw runtime traces are rejected.", inputSchema: { type: "object", properties: withPolicy(withTaskTarget({ id: { type: "string" }, title: { type: "string" }, problem: { type: "string" }, decisions: { type: "array", items: { type: "string" } }, pitfalls: { type: "array", items: { type: "string" } }, validation: { type: "array", items: { type: "string" } }, nextTime: { type: "array", items: { type: "string" } }, domain: { type: "string" }, doveDomain: { type: "string" }, missionDomain: { type: "string" }, stage: { type: "string" }, missionStage: { type: "string" }, actorRole: { type: "string" }, tags: { type: "array", items: { type: "string" } }, sourceType: { type: "string" }, sourceId: { type: "string" }, sourceArtifacts: { type: "array", items: { type: "string" } }, artifactPaths: { type: "array", items: { type: "string" } }, sourceArtifactPath: { type: "string" }, relatedPacketIds: { type: "array", items: { type: "string" } }, packetIds: { type: "array", items: { type: "string" } }, taskPacketIds: { type: "array", items: { type: "string" } }, missionPacketIds: { type: "array", items: { type: "string" } }, taskIds: { type: "array", items: { type: "string" } }, recommendationIds: { type: "array", items: { type: "string" } }, playbookIds: { type: "array", items: { type: "string" } }, remediationPackIds: { type: "array", items: { type: "string" } }, status: { type: "string" } })) } }
  ,{ name: "record_operator_follow_through", description: "Record a proposal-only operator decision for a remediation pack, family playbook, or execution-bridge candidate.", inputSchema: { type: "object", properties: withPolicy({ sourceType: { type: "string" }, sourceId: { type: "string" }, status: { type: "string" }, actorRole: { type: "string" }, workerRole: { type: "string" }, programId: { type: "string" }, programRunId: { type: "string" }, approvalId: { type: "string" }, decisionSummary: { type: "string" }, rationale: { type: "string" }, selectedConversionPathKey: { type: "string" }, linkedTargetArtifact: { type: "string" }, linkedTargetId: { type: "string" }, plannedTarget: { type: "boolean" }, deferUntil: { type: "string" }, executeBy: { type: "string" }, reviewAfter: { type: "string" }, closureReason: { type: "string" }, closureArtifactPaths: { type: "array", items: { type: "string" } } }) } }
  ,{ name: "issue_program_approval", description: "Issue one explicit approval or bounded multi-step authority envelope for an existing packet-bound program run without executing work.", inputSchema: { type: "object", properties: { continuationFromRunId: { type: "string" }, packetId: { type: "string" }, programId: { type: "string" }, programRunId: { type: "string" }, approvalId: { type: "string" }, campaignId: { type: "string" }, campaignStepId: { type: "string" }, campaignStepNextAction: { type: "string" }, actorRole: { type: "string" }, workerRole: { type: "string" }, sourceType: { type: "string" }, sourceId: { type: "string" }, allowedStepType: { type: "string" }, autonomyPolicy: { type: "string" }, stepBudget: { type: "number" }, stepSequence: { type: "array", items: { type: "object", properties: { allowedStepType: { type: "string" }, stepPayload: { type: "object" } } } }, noteTitle: { type: "string" }, noteSectionId: { type: "string" }, noteSourceIds: { type: "array", items: { type: "string" } }, noteSummary: { type: "string" }, noteQuotes: { type: "array", items: { type: "string" } }, noteClaims: { type: "array", items: { type: "string" } }, noteOpenQuestions: { type: "array", items: { type: "string" } }, auditResultId: { type: "string" }, auditReviewedArtifactRefs: { type: "array", items: { type: "string" } }, bridgeResultId: { type: "string" }, bridgeAuditIds: { type: "array", items: { type: "string" } }, bridgeReason: { type: "string" }, reviewScope: { type: "string" }, reviewStage: { type: "string" }, programTitle: { type: "string" }, programObjective: { type: "string" }, programAgenda: { type: "array", items: { type: "string" } }, programEvidenceBacklog: { type: "array", items: { type: "string" } }, executeBy: { type: "string" }, reviewAfter: { type: "string" }, expiresAt: { type: "string" }, summary: { type: "string" }, rationale: { type: "string" }, followThroughId: { type: "string" } } } }
  ,{ name: "plan_campaign", description: "Record or update a planner-supervised multi-cycle campaign plan without approving or executing work.", inputSchema: { type: "object", properties: { campaignId: { type: "string" }, title: { type: "string" }, objective: { type: "string" }, status: { type: "string" }, phase: { type: "string" }, actorRole: { type: "string" }, programIds: { type: "array", items: { type: "string" } }, steps: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, status: { type: "string" }, programId: { type: "string" }, programRunId: { type: "string" }, approvalId: { type: "string" }, packetId: { type: "string" }, allowedStepType: { type: "string" }, objective: { type: "string" }, nextAction: { type: "string" }, evidenceLinks: { type: "array", items: { type: "string" } }, outputPaths: { type: "array", items: { type: "string" } }, executeBy: { type: "string" }, reviewAfter: { type: "string" } } } }, nextAction: { type: "string" }, reviewPolicy: { type: "string" }, explicitApprovalRequired: { type: "boolean" }, noHiddenRuntime: { type: "boolean" } } } }
  ,{ name: "revoke_program_approval", description: "Revoke one explicit program approval without executing work.", inputSchema: { type: "object", properties: { approvalId: { type: "string" }, actorRole: { type: "string" }, summary: { type: "string" }, revokeReason: { type: "string" } } } }
  ,{ name: "materialize_guidance_packet", description: "Create a durable task packet from accepted remediation guidance or a packet-type execution bridge candidate.", inputSchema: { type: "object", properties: withPolicy({ sourceType: { type: "string" }, sourceId: { type: "string" }, actorRole: { type: "string" }, workerRole: { type: "string" }, programId: { type: "string" }, programTitle: { type: "string" }, programObjective: { type: "string" }, programAgenda: { type: "array", items: { type: "string" } }, programEvidenceBacklog: { type: "array", items: { type: "string" } }, programRunId: { type: "string" }, approvalId: { type: "string" }, allowedStepType: { type: "string" }, noteTitle: { type: "string" }, noteSectionId: { type: "string" }, noteSourceIds: { type: "array", items: { type: "string" } }, noteSummary: { type: "string" }, noteQuotes: { type: "array", items: { type: "string" } }, noteClaims: { type: "array", items: { type: "string" } }, noteOpenQuestions: { type: "array", items: { type: "string" } }, auditResultId: { type: "string" }, auditReviewedArtifactRefs: { type: "array", items: { type: "string" } }, bridgeResultId: { type: "string" }, bridgeAuditIds: { type: "array", items: { type: "string" } }, bridgeReason: { type: "string" }, reviewScope: { type: "string" }, reviewStage: { type: "string" }, programApprovalSummary: { type: "string" }, selectedConversionPathKey: { type: "string" }, packetId: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, phase: { type: "string" }, assignedRole: { type: "string" }, status: { type: "string" }, lifecycleStatus: { type: "string" }, currentFocus: { type: "string" }, nextAction: { type: "string" }, dependencies: { type: "array", items: { type: "string" } }, evidenceLinks: { type: "array", items: { type: "string" } }, outputPaths: { type: "array", items: { type: "string" } }, ...executionVerificationProps, decisionSummary: { type: "string" }, rationale: { type: "string" }, executeBy: { type: "string" }, reviewAfter: { type: "string" } }) } }
  ,{ name: "run_autonomy_once", description: "Manually invoke one governed planner-supervised autonomous control-plane pass over at most one materialized packet or one planned target.", inputSchema: { type: "object", properties: { actorRole: { type: "string" } } } }
  ,{ name: "run_autonomy_foreground", description: "Run an explicit foreground autonomy pass that may continue one program-scoped bounded authority envelope or a same-lineage materialized-packet continuation until a stop condition is reached.", inputSchema: { type: "object", properties: { actorRole: { type: "string" }, maxSteps: { type: "number" }, packetId: { type: "string" }, programRunId: { type: "string" }, approvalId: { type: "string" } } } }
  ,{ name: "run_autonomy_operate", description: "Run the maximum-allowed explicit foreground research operating surface from an objective or existing proposal source through planning, materialization, bounded approval, execution, and durable stop summary.", inputSchema: { type: "object", properties: { objective: { type: "string" }, sourceType: { type: "string" }, sourceId: { type: "string" }, actorRole: { type: "string" }, workerRole: { type: "string" }, maxSteps: { type: "number" }, packetId: { type: "string" }, programId: { type: "string" }, programRunId: { type: "string" }, approvalId: { type: "string" }, campaignId: { type: "string" }, campaignStepId: { type: "string" }, executeBy: { type: "string" }, reviewAfter: { type: "string" }, expiresAt: { type: "string" }, stepSequence: { type: "array", items: { type: "object", properties: { allowedStepType: { type: "string" }, stepPayload: { type: "object" } } } }, reviewScope: { type: "string" }, reviewStage: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, rationale: { type: "string" } } } }
];

export const toolDefinitions = baseToolDefinitions.map(addMcpControlFields).map((tool) => ({
  ...tool,
  operatorTier: OPERATOR_TOOL_NAMES.includes(tool.name) ? "operator" : "advanced",
  workflowArea: OPERATOR_WORKFLOW_AREAS[tool.name] ?? "advanced",
  primaryEntry: OPERATOR_TOOL_NAMES.includes(tool.name),
  internalOnly: !OPERATOR_TOOL_NAMES.includes(tool.name)
}));

function compactOperatorToolSchema(tool) {
  const properties = tool.inputSchema?.properties ?? {};
  const fieldNames = OPERATOR_SCHEMA_FIELDS[tool.name] ?? Object.keys(properties);
  const compactProperties = Object.fromEntries(fieldNames
    .filter((fieldName) => properties[fieldName])
    .map((fieldName) => [fieldName, properties[fieldName]]));
  return {
    ...tool.inputSchema,
    properties: compactProperties
  };
}

function compactOperatorTool(tool) {
  return {
    ...tool,
    inputSchema: compactOperatorToolSchema(tool),
    discoverySurface: "operator",
    fullDetails: "Use tools/list with surface: full or surface: debug to inspect the canonical schema."
  };
}

export function toolDefinitionsForSurface(surface = "operator") {
  const normalized = typeof surface === "string" ? surface.trim().toLowerCase() : "operator";
  if (["full", "debug"].includes(normalized)) {
    return toolDefinitions.map((tool) => ({ ...tool, discoverySurface: normalized }));
  }
  return toolDefinitions
    .filter((tool) => OPERATOR_TOOL_NAMES.includes(tool.name))
    .map(compactOperatorTool);
}
