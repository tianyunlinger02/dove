export const DOVE_WORKSPACE_SCHEMA_VERSION = 18;
export const PACKAGE_VERSION = "0.4.0";

export const DOVE_RESPONSE_LANGUAGES = Object.freeze(["zh", "en"]);
export const DEFAULT_DOVE_RESPONSE_LANGUAGE = "zh";
export const DOVE_RESEARCH_SKILL_IDS = Object.freeze([
  "source",
  "note",
  "experience",
  "experiment",
  "draft",
  "figure",
  "review",
  "rebuttal"
]);

export function normalizeDoveResponseLanguage(value, fallback = DEFAULT_DOVE_RESPONSE_LANGUAGE, options = {}) {
  const normalizedFallback = DOVE_RESPONSE_LANGUAGES.includes(fallback) ? fallback : DEFAULT_DOVE_RESPONSE_LANGUAGE;
  if (typeof value !== "string" || !value.trim()) return normalizedFallback;
  const normalized = value.trim().toLowerCase();
  if (DOVE_RESPONSE_LANGUAGES.includes(normalized)) return normalized;
  if (options.strict === true) {
    throw new Error(`Unsupported Dove response language: ${value}. Supported values: ${DOVE_RESPONSE_LANGUAGES.join(", ")}.`);
  }
  return normalizedFallback;
}

export const ARTIFACT_PATHS = Object.freeze({
  doveRoot: ".dove",
  doveRootManifest: ".dove/manifest.json",
  projectIdentity: ".dove/project.json",
  workspaceRevisionsDir: ".dove/workspace-revisions",
  missionsDir: ".dove/missions",
  missionTransitionsDir: ".dove/mission-transitions",
  artifactHandoffsDir: ".dove/artifact-handoffs",
  researchDecisionsDir: ".dove/research-decisions",
  lessonsDocument: ".dove/LESSONS.md",
  receiptsDir: ".dove/receipts",
  executionReceiptsDir: ".dove/receipts/execution",
  sourcesDir: ".dove/sources",
  claimsDir: ".dove/claims",
  experimentsDir: ".dove/experiments",
  reviewsDir: ".dove/reviews"
});

function governanceScopeMetadata(mutationScope) {
  return Object.freeze({
    mutationScope,
    requiresMissionId: !["project-identity", "project-lessons"].includes(mutationScope),
    artifactFields: []
  });
}

const GUARDED_MUTATIONS = [
  ["manage-dove-workspace", "Managing the explicit Dove workspace research mainline", ARTIFACT_PATHS.projectIdentity, "manageDoveWorkspace", "manage_dove_workspace", ["dove.workspace"], "project-identity"],
  ["create-dove-mission", "Persisting one minimal mission contract", ARTIFACT_PATHS.missionsDir, "createDoveMission", "manage_dove_mission", ["dove.mission", "dove.source", "dove.note", "dove.experience", "dove.experiment", "dove.draft", "dove.figure", "dove.review", "dove.rebuttal"], "mission-contract", ["create-root", "branch", "start-skill"]],
  ["create-ambient-dove-mission", "Persisting one ambient mission contract", ARTIFACT_PATHS.missionsDir, "createAmbientDoveMission", "create_ambient_dove_mission", [], "mission-contract"],
  ["append-research-decision", "Appending one immutable mission-bound research decision", ARTIFACT_PATHS.researchDecisionsDir, "appendResearchDecision", null, [], "mission-domain"],
  ["reevaluate-research-decision", "Recording one policy-validated mission-bound research reevaluation", ARTIFACT_PATHS.researchDecisionsDir, "reevaluateResearchDecision", "manage_dove_mission", ["dove.mission"], "mission-domain", ["reevaluate-research-decision"]],
  ["update-dove-lessons", "Updating the canonical advisory Lessons document", ARTIFACT_PATHS.lessonsDocument, "updateDoveLessons", "manage_dove_lessons", ["dove.lessons"], "project-lessons", ["update"]],
  ["ingest-execution-receipt", "Private core receipt ingestion used only behind canonical closure endpoints", ARTIFACT_PATHS.executionReceiptsDir, "ingestExecutionReceipt", null, [], "mission-receipt", []],
  ["close-host-outcome", "Recording current host-produced mission outcomes", ARTIFACT_PATHS.executionReceiptsDir, "closeHostOutcome", "close_host_outcome", [], "mission-receipt"],
  ["record-research-outcome", "Recording one sealed research execution receipt without changing the current scientific decision", ARTIFACT_PATHS.executionReceiptsDir, "recordResearchOutcome", "record_research_outcome", [], "mission-receipt"],
  ["register-source", "Registering a mission-bound source candidate", ARTIFACT_PATHS.sourcesDir, "registerSource", "manage_dove_sources", ["dove.source"], "mission-domain", ["register"]],
  ["verify-source", "Rejecting a mission-bound source candidate", ARTIFACT_PATHS.sourcesDir, "verifySource", "manage_dove_sources", ["dove.source"], "mission-domain", ["reject"]],
  ["upsert-claims", "Recording mission-bound evidence-backed claims", ARTIFACT_PATHS.claimsDir, "upsertClaims", "record_dove_claims", ["dove.experiment"], "mission-domain"],
  ["run-experience-workflow", "Recording a mission-bound experiment", ARTIFACT_PATHS.experimentsDir, "runExperienceWorkflow", "record_dove_experiment", ["dove.experiment"], "mission-domain"],
  ["record-dove-draft", "Archiving a current mission-owned project draft", ARTIFACT_PATHS.executionReceiptsDir, "recordDoveDraft", "record_dove_draft", ["dove.draft"], "mission-domain"],
  ["record-dove-figure", "Archiving a current mission-owned project figure", ARTIFACT_PATHS.executionReceiptsDir, "recordDoveFigure", "record_dove_figure", ["dove.figure"], "mission-domain"],
  ["archive-review-record", "Archiving one immutable non-authoritative Review record and report for a frozen mission-readable artifact scope", ARTIFACT_PATHS.reviewsDir, "archiveReviewRecord", "manage_dove_review", ["dove.review"], "mission-review", ["archive"]],
  ["record-dove-rebuttal", "Archiving a current mission-owned project rebuttal with preserved findings", ARTIFACT_PATHS.executionReceiptsDir, "recordDoveRebuttal", "record_dove_rebuttal", ["dove.rebuttal"], "mission-domain"],
];

export const GOVERNANCE_GUARDED_MUTATIONS = Object.freeze(GUARDED_MUTATIONS.map(([id, action, artifactPath, coreFunction, mcpTool, commandIds, scope, mcpOperations = null]) => Object.freeze({
  id,
  action,
  artifactPath,
  surfaceBindings: Object.freeze({ coreFunction, mcpTool, mcpOperations: mcpOperations === null ? null : Object.freeze(mcpOperations), commandIds: Object.freeze(commandIds) }),
  ...governanceScopeMetadata(scope)
})));

export const GOVERNANCE_EXEMPT_MUTATIONS = Object.freeze([]);
export const GOVERNANCE_READONLY_COMMANDS = Object.freeze(["dove.status"]);
export const GOVERNANCE_READONLY_TOOLS = Object.freeze([
  Object.freeze({ mcpTool: "manage_dove_mission", operations: Object.freeze(["query"]) }),
  Object.freeze({ mcpTool: "query_dove_status", operations: Object.freeze(["status", "completion"]) }),
  Object.freeze({ mcpTool: "manage_dove_sources", operations: Object.freeze(["query"]) }),
  Object.freeze({ mcpTool: "manage_dove_lessons", operations: Object.freeze(["read"]) }),
  Object.freeze({ mcpTool: "manage_dove_review", operations: Object.freeze(["scope"]) })
]);

const NEGATIVE_TESTS = Object.freeze({
  "manage-dove-workspace": "workspace initialization, mainline revision, and archive reset reject stale or mismatched confirmation without writing",
  "create-dove-mission": "mission confirmation rejects replay drift without writing",
  "create-ambient-dove-mission": "ambient mission creation rejects caller-controlled identity, lineage, reevaluation, workspace-mainline change, and replay fields before writing",
  "append-research-decision": "research decision append rejects malformed, stale, cross-mission, forked, gapped, or occupied state without writing",
  "reevaluate-research-decision": "research reevaluation rejects stale revision, cross-mission evidence, policy-ineligible authorization, and non-atomic decision or lesson writes",
  "update-dove-lessons": "Lessons update rejects malformed Markdown, a mismatched workspace binding, or a stale current hash without writing",
  "ingest-execution-receipt": "receipt ingestion validates current contracts, paths, hashes, and evidence before writing",
  "close-host-outcome": "host outcome closure accepts only current mission-bound files, generates receipt metadata internally, and skips without writing when no uncovered artifact remains",
  "record-research-outcome": "research outcome closure rejects stale, expired, cross-mission, evidence-drifted, invalid, or same-attempt changed content and writes one immutable receipt only",
  "register-source": "source registration requires an explicit mission and creates candidate evidence only",
  "verify-source": "public source verification cannot mint positive trust authority",
  "upsert-claims": "claims reject missing, stale, or cross-mission evidence before writing",
  "run-experience-workflow": "experiment protocol and result preflight one bounded write set",
  "record-dove-draft": "draft archive requires a current exact-mission-owned project artifact and current references",
  "record-dove-figure": "figure archive requires a current exact-mission-owned project artifact, references, caption, QA, and findings without review coverage",
  "archive-review-record": "review archive rejects changed scope, stale ownership, invalid finding links, replay drift, and caller-minted authority before atomically writing only the record, report, and Receipt",
  "record-dove-rebuttal": "rebuttal archive requires a current exact-mission-owned project artifact and preserved current findings without minting reviewer authority"
});

export const GOVERNANCE_NEGATIVE_COVERAGE = Object.freeze(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => Object.freeze({
  id: entry.id,
  level: "dynamic",
  tests: Object.freeze([NEGATIVE_TESTS[entry.id]])
})));
