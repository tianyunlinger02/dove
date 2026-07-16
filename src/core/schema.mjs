export const DOVE_WORKSPACE_SCHEMA_VERSION = 7;
export const PACKAGE_VERSION = "0.2.0";

export const DOVE_RESPONSE_LANGUAGES = Object.freeze(["zh", "en"]);
export const DEFAULT_DOVE_RESPONSE_LANGUAGE = "zh";

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
  missionsDir: ".dove/missions",
  lessonsDir: ".dove/lessons",
  receiptsDir: ".dove/receipts",
  executionReceiptsDir: ".dove/receipts/execution",
  completionReceiptsDir: ".dove/receipts/completion",
  authorityReceiptsDir: ".dove/receipts/authority",
  artifactsDir: ".dove/artifacts",
  artifactOwnership: ".dove/artifacts/ownership.json",
  artifactLineage: ".dove/artifacts/lineage.json",
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

const GUARDED_MUTATIONS = [
  ["init-dove-goal", "Creating minimal Dove project identity", ARTIFACT_PATHS.projectIdentity, "initDoveGoal", "init_dove_goal", ["dove.init"], "project-identity"],
  ["create-dove-mission", "Persisting one minimal mission contract", ARTIFACT_PATHS.missionsDir, "createDoveMission", "create_dove_mission", ["dove.mission"], "mission-contract"],
  ["record-dove-lesson", "Recording an immutable mission-provenanced lesson", ARTIFACT_PATHS.lessonsDir, "recordDoveLesson", "record_dove_lesson", ["dove.lessons"], "mission-domain"],
  ["ingest-execution-receipt", "Ingesting an immutable execution receipt", ARTIFACT_PATHS.executionReceiptsDir, "ingestExecutionReceipt", "ingest_execution_receipt", [], "mission-receipt"],
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
  ["create-version-snapshot", "Snapshotting current mission artifacts", ARTIFACT_PATHS.versionsDir, "createVersionSnapshot", "create_version_snapshot", ["dove.version"], "mission-domain"],
  ["compare-versions", "Comparing mission artifact snapshots", ARTIFACT_PATHS.versionsDir, "compareVersions", "compare_versions", ["dove.version"], "mission-domain"]
];

export const GOVERNANCE_GUARDED_MUTATIONS = Object.freeze(GUARDED_MUTATIONS.map(([id, action, artifactPath, coreFunction, mcpTool, commandIds, scope]) => Object.freeze({
  id,
  action,
  artifactPath,
  surfaceBindings: Object.freeze({ coreFunction, mcpTool, commandIds: Object.freeze(commandIds) }),
  ...governanceScopeMetadata(scope)
})));

export const GOVERNANCE_EXEMPT_MUTATIONS = Object.freeze([]);
export const GOVERNANCE_READONLY_COMMANDS = Object.freeze(["dove.status"]);
export const GOVERNANCE_READONLY_TOOLS = Object.freeze([
  "query_dove_mission",
  "query_dove_status",
  "assess_mission_completion",
  "search_network",
  "query_network_search_providers",
  "query_sources",
  "query_dove_lessons",
  "verify_review_coverage"
]);

const NEGATIVE_TESTS = Object.freeze({
  "init-dove-goal": "initialization rejects stale or mismatched confirmation without writing",
  "create-dove-mission": "mission confirmation rejects replay drift without writing",
  "record-dove-lesson": "lesson confirmation rejects workspace, contract, mutation mode, content, supersession, and reference drift without writing",
  "ingest-execution-receipt": "receipt ingestion validates current contracts, paths, hashes, and evidence before writing",
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
  "create-version-snapshot": "version snapshots reject stale or cross-mission artifacts and finalization fails closed",
  "compare-versions": "version comparison rejects stale snapshots before writing"
});

export const GOVERNANCE_NEGATIVE_COVERAGE = Object.freeze(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => Object.freeze({
  id: entry.id,
  level: "dynamic",
  tests: Object.freeze([NEGATIVE_TESTS[entry.id]])
})));
