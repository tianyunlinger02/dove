// src/core/schema.mjs
var DOVE_WORKSPACE_SCHEMA_VERSION = 7;
var PACKAGE_VERSION = "0.2.0";
var DOVE_RESPONSE_LANGUAGES = Object.freeze(["zh", "en"]);
var DEFAULT_DOVE_RESPONSE_LANGUAGE = "zh";
function normalizeDoveResponseLanguage(value, fallback = DEFAULT_DOVE_RESPONSE_LANGUAGE, options = {}) {
  const normalizedFallback = DOVE_RESPONSE_LANGUAGES.includes(fallback) ? fallback : DEFAULT_DOVE_RESPONSE_LANGUAGE;
  if (typeof value !== "string" || !value.trim()) return normalizedFallback;
  const normalized = value.trim().toLowerCase();
  if (DOVE_RESPONSE_LANGUAGES.includes(normalized)) return normalized;
  if (options.strict === true) {
    throw new Error(`Unsupported Dove response language: ${value}. Supported values: ${DOVE_RESPONSE_LANGUAGES.join(", ")}.`);
  }
  return normalizedFallback;
}
var ARTIFACT_PATHS = Object.freeze({
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
var GUARDED_MUTATIONS = [
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
  "verify_review_coverage"
]);
var NEGATIVE_TESTS = Object.freeze({
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
var GOVERNANCE_NEGATIVE_COVERAGE = Object.freeze(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => Object.freeze({
  id: entry.id,
  level: "dynamic",
  tests: Object.freeze([NEGATIVE_TESTS[entry.id]])
})));

// src/core/mission-queries.mjs
import fs15 from "node:fs";
import path15 from "node:path";

// src/core/completion-gates.mjs
import fs13 from "node:fs";
import path13 from "node:path";

// src/core/artifact-integrity.mjs
import fs from "node:fs";
import path from "node:path";
var BOOKKEEPING_PREFIXES = Object.freeze([
  `${ARTIFACT_PATHS.missionsDir}/`,
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
  if (path.isAbsolute(original) || /^[A-Za-z]:[\\/]/u.test(original)) {
    return { ok: false, path: original, reason: "absolute paths are not inspected" };
  }
  if (/^[a-z][a-z0-9+.-]*:/iu.test(original)) {
    return { ok: false, path: original, reason: "unsupported or malformed external reference scheme" };
  }
  const normalizedPath = path.posix.normalize(original.replace(/\\/gu, "/"));
  if (normalizedPath === "." || normalizedPath === ".." || normalizedPath.startsWith("../")) {
    return { ok: false, path: original, normalizedPath, reason: "path escapes the project root" };
  }
  return { ok: true, path: original, normalizedPath };
}
function artifactEvidenceRole(relativePath) {
  const normalized = normalizeProjectRelativePath(relativePath);
  if (!normalized.ok) return "unsupported";
  const value = normalized.normalizedPath;
  if (!value.startsWith(`${ARTIFACT_PATHS.doveRoot}/`)) return "external-project";
  if (BOOKKEEPING_FILES.has(value) || BOOKKEEPING_PREFIXES.some((prefix) => value.startsWith(prefix))) return "bookkeeping";
  if (DOMAIN_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}/`))) return "substantive";
  return "unsupported";
}
function inspectDeclaredPath(root, rawPath, options = {}) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) {
    return { path: normalized.path, normalizedPath: normalized.normalizedPath ?? null, status: "unsafe", exists: false, file: false, reason: normalized.reason };
  }
  const rootPath = path.resolve(root);
  const fullPath = path.resolve(rootPath, normalized.normalizedPath);
  const relativeToRoot = path.relative(rootPath, fullPath);
  if (relativeToRoot === ".." || relativeToRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToRoot)) {
    return { path: normalized.path, normalizedPath: normalized.normalizedPath, status: "unsafe", exists: false, file: false, reason: "resolved path escapes the project root" };
  }
  let realRootPath;
  let realFullPath;
  let canonicalRelativePath;
  let stat;
  try {
    realRootPath = fs.realpathSync.native(rootPath);
    realFullPath = fs.realpathSync.native(fullPath);
    const relativeToRealRoot = path.relative(realRootPath, realFullPath);
    if (relativeToRealRoot === ".." || relativeToRealRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToRealRoot)) {
      return { path: normalized.path, normalizedPath: normalized.normalizedPath, status: "unsafe", exists: true, file: false, reason: "real path escapes the project root" };
    }
    canonicalRelativePath = relativeToRealRoot.split(path.sep).join("/");
    stat = fs.statSync(realFullPath);
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
      return { ...base, status: rejected, reason: rejected === "bookkeeping" ? "path is Dove bookkeeping rather than substantive evidence" : "path is not an approved schema 7 evidence artifact" };
    }
  }
  if (options.requireNonEmpty === true && stat.size === 0) return { ...base, status: "empty", reason: "path is an empty file" };
  if (options.readText !== true) return base;
  try {
    const maxBytes = Number.isInteger(options.maxBytes) && options.maxBytes > 0 ? options.maxBytes : 24 * 1024;
    const descriptor = fs.openSync(realFullPath, "r");
    try {
      const buffer = Buffer.alloc(Math.min(maxBytes, stat.size));
      const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, 0);
      return { ...base, text: buffer.subarray(0, bytesRead).toString("utf8"), bytesRead, truncated: stat.size > bytesRead };
    } finally {
      fs.closeSync(descriptor);
    }
  } catch (error) {
    return { ...base, status: "unreadable", reason: error instanceof Error ? error.message : String(error) };
  }
}

// src/core/domain-artifacts.mjs
import crypto5 from "node:crypto";
import fs9 from "node:fs";
import path9 from "node:path";

// src/core/workspace.mjs
import fs4 from "node:fs";
import path4 from "node:path";

// src/core/mutation-backend.mjs
import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import fs3 from "node:fs";
import path3 from "node:path";

// src/core/contained-write.mjs
import fs2 from "node:fs";
import path2 from "node:path";
function pathEscapesRoot(relativePath) {
  return relativePath === ".." || relativePath.startsWith(`..${path2.sep}`) || path2.isAbsolute(relativePath);
}
function existingAncestor(candidatePath) {
  let currentPath = candidatePath;
  while (!fs2.existsSync(currentPath)) {
    const parentPath = path2.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
  }
  return currentPath;
}
function resolveCanonicalContainedWrite(root, candidatePath, options = {}) {
  const label = options.label ?? "Write path";
  const resolvedRoot = path2.resolve(root);
  const canonicalRoot = fs2.realpathSync.native(resolvedRoot);
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
      stat = fs2.lstatSync(currentPath);
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
  const canonicalAncestor = fs2.realpathSync.native(existingAncestor(requestedPath));
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

// src/core/mutation-backend.mjs
var mutationStorage = new AsyncLocalStorage();
function normalizeMutationMode(value) {
  if (value === void 0) {
    return "direct-process";
  }
  if (value === "patch-plan" || value === "direct-process") {
    return value;
  }
  throw new Error("mutationMode must be either patch-plan or direct-process when explicitly provided.");
}
function currentMutationContext(root) {
  const context = mutationStorage.getStore();
  if (!context || context.lifecycle !== "active") {
    return null;
  }
  if (root) {
    try {
      if (fs3.realpathSync.native(path3.resolve(root)) !== context.root) {
        return null;
      }
    } catch {
      return null;
    }
  }
  return context;
}
function isPatchPlanMode(root) {
  return currentMutationContext(root)?.patchPlanMode === true;
}

// src/core/workspace.mjs
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function resolvePath(root, relativePath) {
  return path4.join(root, relativePath);
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
  if (!fs4.existsSync(fullPath)) return cloneFallback(fallback);
  try {
    return JSON.parse(fs4.readFileSync(fullPath, "utf8"));
  } catch (error) {
    throw new Error(`Malformed JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function writeJson(root, relativePath, value) {
  return requireMutationContext(root, "writeJson").writeJson(relativePath, value);
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

// src/core/workspace-schema.mjs
import crypto2 from "node:crypto";
import fs5 from "node:fs";
import path5 from "node:path";
var DOVE_MANIFEST_SCHEMA_VERSION = 1;
var DOVE_PROJECT_SCHEMA_VERSION = 1;
var DOVE_TRUST_SCHEMA_VERSION = 1;
var MINIMAL_WORKSPACE_DIRECTORIES = Object.freeze([
  ".dove/missions",
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
  ".dove/project.json",
  ".dove/artifacts/ownership.json",
  ".dove/artifacts/lineage.json"
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
  ".dove/wiki"
]);
var MANIFEST_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "manifestVersion", "workspaceId", "createdAt", "packageVersion"]);
var PROJECT_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "projectId", "goal", "trust", "createdAt", "updatedAt"]);
var TRUST_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "entries"]);
var INDEX_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "artifacts", "updatedAt"]);
var INDEX_ITEM_FIELDS = /* @__PURE__ */ new Set(["path", "kind", "sha256", "missionId", "contractDigest", "receiptId"]);
var LINEAGE_ITEM_FIELDS = /* @__PURE__ */ new Set([...INDEX_ITEM_FIELDS, "derivedReferences"]);
var MISSION_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "missionId", "contractDigest", "createdAt", "scope", "outOfScope", "targetArtifacts", "expectedArtifacts", "completionCriteria", "evidenceRequirements", "dependsOnMissionIds", "goal", "supersedesMissionId", "completionCriterionIds", "evidenceRequirementIds"]);
var RECEIPT_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "receiptId", "missionId", "contractDigest", "summary", "artifacts", "validations", "criteriaSatisfied", "producedAt"]);
var RECEIPT_ARTIFACT_FIELDS = /* @__PURE__ */ new Set(["path", "kind", "sha256"]);
var RECEIPT_VALIDATION_FIELDS = /* @__PURE__ */ new Set(["kind", "reference", "outputHash"]);
var RECEIPT_CRITERION_FIELDS = /* @__PURE__ */ new Set(["criterionId", "evidenceRefs"]);
var LESSON_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "lessonId", "missionId", "contractDigest", "scope", "kind", "summary", "details", "nextTimeGuidance", "sourceIds", "noteIds", "artifactRefs", "appliesToArtifactRefs", "tags", "supersedesLessonId", "createdAt"]);
var LESSON_REF_FIELDS = /* @__PURE__ */ new Set(["path", "sha256"]);
var LESSON_SCOPES = /* @__PURE__ */ new Set(["global", "mission"]);
var LESSON_KINDS = /* @__PURE__ */ new Set(["preference", "constraint", "method", "failure", "review-insight"]);
var SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var HASH = /^[0-9a-f]{64}$/u;
var ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
function sha256(value) {
  return crypto2.createHash("sha256").update(value).digest("hex");
}
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}
function stableWorkspaceSerialize(value) {
  return JSON.stringify(stableValue(value));
}
function workspaceDigest(value) {
  return sha256(stableWorkspaceSerialize(value));
}
function canonicalWorkspacePath(root) {
  return fs5.realpathSync.native(path5.resolve(root));
}
function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object.`);
  }
}
function assertSealed(value, fields, label) {
  assertPlainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}
function exactIso(value, label) {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value) || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  }
  return value;
}
function safeId(value, label) {
  if (typeof value !== "string" || !SAFE_ID.test(value)) {
    throw new Error(`${label} must be a safe lowercase identifier.`);
  }
  return value;
}
function pathExistsNoFollow(fullPath) {
  try {
    fs5.lstatSync(fullPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
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
function validateDoveManifest(value) {
  assertSealed(value, MANIFEST_FIELDS, "Dove manifest");
  if (value.schemaVersion !== DOVE_WORKSPACE_SCHEMA_VERSION) {
    throw new Error(`Dove manifest schemaVersion ${value.schemaVersion ?? "missing"} is unsupported; expected ${DOVE_WORKSPACE_SCHEMA_VERSION}.`);
  }
  if (value.manifestVersion !== DOVE_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Dove manifest manifestVersion ${value.manifestVersion ?? "missing"} is unsupported.`);
  }
  safeId(value.workspaceId, "Dove manifest workspaceId");
  exactIso(value.createdAt, "Dove manifest createdAt");
  if (typeof value.packageVersion !== "string" || !value.packageVersion.trim()) {
    throw new Error("Dove manifest packageVersion must be a non-empty string.");
  }
  return value;
}
function validateDoveTrustConfig(value) {
  assertSealed(value, TRUST_FIELDS, "Dove project trust config");
  if (value.schemaVersion !== DOVE_TRUST_SCHEMA_VERSION) {
    throw new Error(`Dove project trust schemaVersion ${value.schemaVersion ?? "missing"} is unsupported.`);
  }
  if (!Array.isArray(value.entries) || value.entries.length !== 0) {
    throw new Error("Dove project trust entries must be an empty sealed array until a trust schema is explicitly introduced.");
  }
  return value;
}
function validateDoveProject(value, manifest) {
  assertSealed(value, PROJECT_FIELDS, "Dove project identity");
  if (value.schemaVersion !== DOVE_PROJECT_SCHEMA_VERSION) {
    throw new Error(`Dove project schemaVersion ${value.schemaVersion ?? "missing"} is unsupported.`);
  }
  safeId(value.workspaceId, "Dove project workspaceId");
  safeId(value.projectId, "Dove project projectId");
  if (value.workspaceId !== manifest.workspaceId) {
    throw new Error("Dove project workspaceId does not match the manifest workspaceId.");
  }
  if (value.projectId !== `project-${manifest.workspaceId}`) {
    throw new Error("Dove project projectId does not match the manifest identity.");
  }
  if (typeof value.goal !== "string" || !value.goal.trim()) {
    throw new Error("Dove project goal must be a non-empty string.");
  }
  exactIso(value.createdAt, "Dove project createdAt");
  exactIso(value.updatedAt, "Dove project updatedAt");
  if (value.createdAt !== manifest.createdAt) {
    throw new Error("Dove project createdAt must match the manifest createdAt.");
  }
  validateDoveTrustConfig(value.trust);
  return value;
}
function exactOptionalIso(value, label) {
  if (value === null) return null;
  return exactIso(value, label);
}
function hash(value, label) {
  if (typeof value !== "string" || !HASH.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return value;
}
function nonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value;
}
function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${label} must not contain duplicates.`);
  return value;
}
function validateOwnershipShape(value, label, manifest, lineage = false) {
  assertSealed(value, INDEX_FIELDS, label);
  if (value.schemaVersion !== 1) throw new Error(`${label} has an unsupported schemaVersion.`);
  safeId(value.workspaceId, `${label}.workspaceId`);
  if (value.workspaceId !== manifest.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  if (!Array.isArray(value.artifacts)) throw new Error(`${label}.artifacts must be an array.`);
  exactOptionalIso(value.updatedAt, `${label}.updatedAt`);
  const seen = /* @__PURE__ */ new Set();
  for (const [index, item] of value.artifacts.entries()) {
    const itemLabel = `${label}.artifacts[${index}]`;
    assertSealed(item, lineage ? LINEAGE_ITEM_FIELDS : INDEX_ITEM_FIELDS, itemLabel);
    nonEmptyString(item.path, `${itemLabel}.path`);
    nonEmptyString(item.kind, `${itemLabel}.kind`);
    hash(item.sha256, `${itemLabel}.sha256`);
    safeId(item.missionId, `${itemLabel}.missionId`);
    hash(item.contractDigest, `${itemLabel}.contractDigest`);
    safeId(item.receiptId, `${itemLabel}.receiptId`);
    if (seen.has(item.path)) throw new Error(`${label}.artifacts contains duplicate path ${item.path}.`);
    seen.add(item.path);
    if (lineage) stringArray(item.derivedReferences, `${itemLabel}.derivedReferences`);
  }
  return value;
}
function validateMissionShape(value, manifest, label) {
  assertSealed(value, MISSION_FIELDS, label);
  if (value.schemaVersion !== 1) throw new Error(`${label} has an unsupported schemaVersion.`);
  safeId(value.workspaceId, `${label}.workspaceId`);
  if (value.workspaceId !== manifest.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  safeId(value.missionId, `${label}.missionId`);
  hash(value.contractDigest, `${label}.contractDigest`);
  exactIso(value.createdAt, `${label}.createdAt`);
  nonEmptyString(value.goal, `${label}.goal`);
  for (const field of ["scope", "outOfScope", "targetArtifacts", "expectedArtifacts", "completionCriteria", "evidenceRequirements", "completionCriterionIds", "evidenceRequirementIds"]) {
    stringArray(value[field], `${label}.${field}`);
  }
  if (value.dependsOnMissionIds !== void 0) stringArray(value.dependsOnMissionIds, `${label}.dependsOnMissionIds`);
  if (value.supersedesMissionId !== void 0) safeId(value.supersedesMissionId, `${label}.supersedesMissionId`);
  return value;
}
function validateLessonReferenceArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const seen = /* @__PURE__ */ new Set();
  for (const [index, item] of value.entries()) {
    const itemLabel = `${label}[${index}]`;
    assertSealed(item, LESSON_REF_FIELDS, itemLabel);
    nonEmptyString(item.path, `${itemLabel}.path`);
    hash(item.sha256, `${itemLabel}.sha256`);
    if (seen.has(item.path)) throw new Error(`${label} contains duplicate path ${item.path}.`);
    seen.add(item.path);
  }
  return value;
}
function validateLessonShape(value, manifest, label, context = {}) {
  assertSealed(value, LESSON_FIELDS, label);
  if (value.schemaVersion !== 1) throw new Error(`${label} has an unsupported schemaVersion.`);
  safeId(value.workspaceId, `${label}.workspaceId`);
  if (value.workspaceId !== manifest.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  const lessonId = safeId(value.lessonId, `${label}.lessonId`);
  const expectedFilename = `${lessonId}.json`;
  if (path5.posix.basename(label) !== expectedFilename) throw new Error(`${label} filename must match lessonId ${lessonId}.`);
  const missionId = safeId(value.missionId, `${label}.missionId`);
  hash(value.contractDigest, `${label}.contractDigest`);
  if (!LESSON_SCOPES.has(value.scope)) throw new Error(`${label}.scope must be global or mission.`);
  if (!LESSON_KINDS.has(value.kind)) throw new Error(`${label}.kind is unsupported.`);
  nonEmptyString(value.summary, `${label}.summary`);
  if (value.details !== void 0) nonEmptyString(value.details, `${label}.details`);
  stringArray(value.nextTimeGuidance, `${label}.nextTimeGuidance`);
  if (value.nextTimeGuidance.length === 0) throw new Error(`${label}.nextTimeGuidance must contain at least one item.`);
  stringArray(value.sourceIds, `${label}.sourceIds`);
  stringArray(value.noteIds, `${label}.noteIds`);
  validateLessonReferenceArray(value.artifactRefs, `${label}.artifactRefs`);
  validateLessonReferenceArray(value.appliesToArtifactRefs, `${label}.appliesToArtifactRefs`);
  stringArray(value.tags, `${label}.tags`);
  if (value.supersedesLessonId !== void 0) {
    safeId(value.supersedesLessonId, `${label}.supersedesLessonId`);
    if (value.supersedesLessonId === lessonId) throw new Error(`${label} must not supersede itself.`);
  }
  exactIso(value.createdAt, `${label}.createdAt`);
  const mission = context.missions?.get(missionId);
  if (!mission) throw new Error(`${label} references unknown mission ${missionId}.`);
  if (mission.contractDigest !== value.contractDigest) throw new Error(`${label}.contractDigest does not match mission ${missionId}.`);
  return value;
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
function validateReceiptShape(value, manifest, label) {
  assertSealed(value, RECEIPT_FIELDS, label);
  if (value.schemaVersion !== 1) throw new Error(`${label} has an unsupported schemaVersion.`);
  safeId(value.workspaceId, `${label}.workspaceId`);
  if (value.workspaceId !== manifest.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  safeId(value.receiptId, `${label}.receiptId`);
  safeId(value.missionId, `${label}.missionId`);
  hash(value.contractDigest, `${label}.contractDigest`);
  nonEmptyString(value.summary, `${label}.summary`);
  exactIso(value.producedAt, `${label}.producedAt`);
  if (!Array.isArray(value.artifacts) || value.artifacts.length === 0) throw new Error(`${label}.artifacts must contain at least one item.`);
  if (!Array.isArray(value.validations)) throw new Error(`${label}.validations must be an array.`);
  if (!Array.isArray(value.criteriaSatisfied)) throw new Error(`${label}.criteriaSatisfied must be an array.`);
  for (const [index, item] of value.artifacts.entries()) {
    const itemLabel = `${label}.artifacts[${index}]`;
    assertSealed(item, RECEIPT_ARTIFACT_FIELDS, itemLabel);
    nonEmptyString(item.path, `${itemLabel}.path`);
    nonEmptyString(item.kind, `${itemLabel}.kind`);
    hash(item.sha256, `${itemLabel}.sha256`);
  }
  for (const [index, item] of value.validations.entries()) {
    const itemLabel = `${label}.validations[${index}]`;
    assertSealed(item, RECEIPT_VALIDATION_FIELDS, itemLabel);
    nonEmptyString(item.kind, `${itemLabel}.kind`);
    nonEmptyString(item.reference, `${itemLabel}.reference`);
    hash(item.outputHash, `${itemLabel}.outputHash`);
  }
  for (const [index, item] of value.criteriaSatisfied.entries()) {
    const itemLabel = `${label}.criteriaSatisfied[${index}]`;
    assertSealed(item, RECEIPT_CRITERION_FIELDS, itemLabel);
    nonEmptyString(item.criterionId, `${itemLabel}.criterionId`);
    stringArray(item.evidenceRefs, `${itemLabel}.evidenceRefs`);
  }
  return value;
}
function validateJsonDirectory(root, relativeDirectory, manifest, validate, context = {}) {
  const directory = path5.join(root, relativeDirectory);
  const values = [];
  for (const entry of fs5.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isSymbolicLink()) throw new Error(`${path5.posix.join(relativeDirectory, entry.name)} must not be a symbolic link.`);
    if (!entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${path5.posix.join(relativeDirectory, entry.name)} must be a regular JSON file.`);
    const relativePath = path5.posix.join(relativeDirectory, entry.name);
    values.push(validate(readJsonStrict(path5.join(root, relativePath), relativePath), manifest, relativePath, context));
  }
  return values;
}
function requiredPathProblem(root, relativePath, kind) {
  const fullPath = path5.join(root, relativePath);
  if (!fs5.existsSync(fullPath)) return `${relativePath} is missing`;
  const stat = fs5.lstatSync(fullPath);
  if (stat.isSymbolicLink()) return `${relativePath} must not be a symbolic link`;
  if (kind === "directory" && !stat.isDirectory()) return `${relativePath} must be a directory`;
  if (kind === "file" && !stat.isFile()) return `${relativePath} must be a regular file`;
  return null;
}
function sourceIdentity(doveRoot) {
  const stat = fs5.lstatSync(doveRoot, { bigint: true });
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
    for (const entry of fs5.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = prefix ? path5.posix.join(prefix, entry.name) : entry.name;
      const fullPath = path5.join(directory, entry.name);
      const stat = fs5.lstatSync(fullPath, { bigint: true });
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
        entries.push({ ...metadata, kind: "file", sizeBytes: String(stat.size), sha256: sha256(fs5.readFileSync(fullPath)) });
      } else if (stat.isSymbolicLink()) {
        entries.push({ ...metadata, kind: "symlink", target: fs5.readlinkSync(fullPath) });
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
  const doveRoot = path5.join(workspace, ".dove");
  if (!pathExistsNoFollow(doveRoot)) return null;
  const identity = sourceIdentity(doveRoot);
  const entries = treeEntries(doveRoot);
  return {
    identity,
    entryCount: entries.length,
    treeDigest: workspaceDigest(entries)
  };
}
function detectedVersionLabel(value) {
  if (Number.isInteger(value)) return String(value);
  if (value === void 0) return "missing";
  return "invalid";
}
function inspectDoveWorkspace(root) {
  const workspace = canonicalWorkspacePath(root);
  const doveRoot = path5.join(workspace, ".dove");
  if (!pathExistsNoFollow(doveRoot)) {
    return { workspace, state: "absent", category: "absent", healthy: false, schemaVersion: null, detectedSchema: "absent" };
  }
  let source;
  try {
    source = { identity: sourceIdentity(doveRoot) };
  } catch (error) {
    return { workspace, state: "invalid-root", category: "invalid", healthy: false, schemaVersion: null, detectedSchema: "invalid-root", error: error instanceof Error ? error.message : String(error) };
  }
  const manifestPath = path5.join(doveRoot, "manifest.json");
  if (!fs5.existsSync(manifestPath)) {
    return { workspace, state: "legacy-missing-manifest", category: "legacy", healthy: false, schemaVersion: null, detectedSchema: "missing-manifest", source };
  }
  let manifest;
  try {
    manifest = readJsonStrict(manifestPath, ".dove/manifest.json");
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
      ...CURRENT_SCHEMA_FORBIDDEN_LEGACY_PATHS.filter((relativePath) => fs5.existsSync(path5.join(workspace, relativePath))).map((relativePath) => `${relativePath} is a retained legacy artifact and must not coexist with current schema ${DOVE_WORKSPACE_SCHEMA_VERSION}`)
    ].filter(Boolean);
    if (problems.length > 0) throw new Error(`Dove schema declaration contradicts required layout: ${problems.join("; ")}.`);
    const project = validateDoveProject(readJsonStrict(path5.join(doveRoot, "project.json"), ".dove/project.json"), manifest);
    validateOwnershipShape(readJsonStrict(path5.join(doveRoot, "artifacts", "ownership.json"), ".dove/artifacts/ownership.json"), "Artifact ownership index", manifest);
    validateOwnershipShape(readJsonStrict(path5.join(doveRoot, "artifacts", "lineage.json"), ".dove/artifacts/lineage.json"), "Artifact lineage index", manifest, true);
    const missions = new Map(validateJsonDirectory(workspace, ".dove/missions", manifest, validateMissionShape).map((mission) => [mission.missionId, mission]));
    validateJsonDirectory(workspace, ".dove/receipts/execution", manifest, validateReceiptShape);
    const lessonsDirectory = path5.join(workspace, ".dove/lessons");
    if (pathExistsNoFollow(lessonsDirectory)) {
      const stat = fs5.lstatSync(lessonsDirectory);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(".dove/lessons must be a real directory when present.");
      const lessons = new Map(validateJsonDirectory(workspace, ".dove/lessons", manifest, validateLessonShape, { missions }).map((lesson) => [lesson.lessonId, lesson]));
      validateLessonSupersession(lessons);
    }
    for (const relativeDirectory of [".dove/receipts/completion", ".dove/receipts/authority"]) {
      const entries = fs5.readdirSync(path5.join(workspace, relativeDirectory));
      if (entries.length > 0) {
        throw new Error(`${relativeDirectory} must remain empty until its sealed schema is introduced.`);
      }
    }
    return { workspace, state: "current-healthy", category: "current", healthy: true, schemaVersion: version, detectedSchema: String(version), source, manifest, project };
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
  safeId(workspaceId, "workspaceId");
  exactIso(createdAt, "createdAt");
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
  return {
    manifest,
    project,
    ownership: { schemaVersion: 1, workspaceId, artifacts: [], updatedAt: null },
    lineage: { schemaVersion: 1, workspaceId, artifacts: [], updatedAt: null }
  };
}
function newWorkspaceId() {
  return `workspace-${crypto2.randomUUID()}`;
}
function writeJsonAtomicContent(targetPath, value, ops) {
  ops.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}
`, "utf8");
}
function materializeMinimalWorkspaceDirectory(directory, documents, options = {}) {
  const ops = options.fsOps ?? fs5;
  ops.mkdirSync(directory, { recursive: false });
  for (const relativePath of MINIMAL_WORKSPACE_DIRECTORIES.map((item) => item.slice(".dove/".length))) {
    ops.mkdirSync(path5.join(directory, relativePath), { recursive: true });
  }
  writeJsonAtomicContent(path5.join(directory, "manifest.json"), documents.manifest, ops);
  writeJsonAtomicContent(path5.join(directory, "project.json"), documents.project, ops);
  writeJsonAtomicContent(path5.join(directory, "artifacts", "ownership.json"), documents.ownership, ops);
  writeJsonAtomicContent(path5.join(directory, "artifacts", "lineage.json"), documents.lineage, ops);
}
function archiveTargetFor({ workspace, detectedSchema, treeDigest }) {
  const schemaLabel = String(detectedSchema ?? "invalid").replace(/[^a-z0-9._-]+/giu, "-").toLowerCase();
  return path5.join(workspace, ".dove-archive", `schema-${schemaLabel}-${String(treeDigest).slice(0, 24)}`);
}

// src/core/artifact-lineage.mjs
var ARTIFACT_OWNERSHIP_SCHEMA_VERSION = 1;
var ARTIFACT_LINEAGE_SCHEMA_VERSION = 1;
var OWNERSHIP_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "artifacts", "updatedAt"]);
var LINEAGE_FIELDS = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "artifacts", "updatedAt"]);
var OWNERSHIP_ITEM_FIELDS = /* @__PURE__ */ new Set(["path", "kind", "sha256", "missionId", "contractDigest", "receiptId"]);
var LINEAGE_ITEM_FIELDS2 = /* @__PURE__ */ new Set([...OWNERSHIP_ITEM_FIELDS, "derivedReferences"]);
var HASH_PATTERN = /^[0-9a-f]{64}$/u;
function createArtifactOwnershipIndex(workspaceId = null) {
  return {
    schemaVersion: ARTIFACT_OWNERSHIP_SCHEMA_VERSION,
    workspaceId,
    artifacts: [],
    updatedAt: null
  };
}
function createArtifactLineageIndex(workspaceId = null) {
  return {
    schemaVersion: ARTIFACT_LINEAGE_SCHEMA_VERSION,
    workspaceId,
    artifacts: [],
    updatedAt: null
  };
}
function assertPlainObject2(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object.`);
  }
}
function assertAllowedFields(value, allowed, label) {
  assertPlainObject2(value, label);
  const unknown = Object.keys(value).filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}
function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}
function normalizeIndex(value, { label, schemaVersion, workspaceId, fields, itemFields, lineage = false }) {
  assertAllowedFields(value, fields, label);
  if (value.schemaVersion !== schemaVersion) {
    throw new Error(`${label} has an unsupported schemaVersion.`);
  }
  if (typeof value.workspaceId !== "string" || value.workspaceId !== workspaceId) {
    throw new Error(`${label}.workspaceId does not match the current manifest workspaceId.`);
  }
  if (!Array.isArray(value.artifacts)) throw new Error(`${label}.artifacts must be an array.`);
  if (value.updatedAt !== null && typeof value.updatedAt !== "string") throw new Error(`${label}.updatedAt must be a string or null.`);
  const seen = /* @__PURE__ */ new Set();
  const artifacts = value.artifacts.map((item, index) => {
    const itemLabel = `${label}.artifacts[${index}]`;
    assertAllowedFields(item, itemFields, itemLabel);
    const normalized = {
      path: assertString(item.path, `${itemLabel}.path`),
      kind: assertString(item.kind, `${itemLabel}.kind`),
      sha256: assertString(item.sha256, `${itemLabel}.sha256`).toLowerCase(),
      missionId: assertString(item.missionId, `${itemLabel}.missionId`),
      contractDigest: assertString(item.contractDigest, `${itemLabel}.contractDigest`).toLowerCase(),
      receiptId: assertString(item.receiptId, `${itemLabel}.receiptId`)
    };
    if (!HASH_PATTERN.test(normalized.sha256) || !HASH_PATTERN.test(normalized.contractDigest)) {
      throw new Error(`${itemLabel} contains an invalid SHA-256 digest.`);
    }
    if (seen.has(normalized.path)) throw new Error(`${label}.artifacts contains duplicate path ${normalized.path}.`);
    seen.add(normalized.path);
    if (lineage) {
      if (!Array.isArray(item.derivedReferences) || item.derivedReferences.some((reference) => typeof reference !== "string" || !reference.trim())) {
        throw new Error(`${itemLabel}.derivedReferences must be an array of non-empty strings.`);
      }
      const derivedReferences = item.derivedReferences.map((reference) => reference.trim());
      if (new Set(derivedReferences).size !== derivedReferences.length) {
        throw new Error(`${itemLabel}.derivedReferences contains duplicates.`);
      }
      normalized.derivedReferences = derivedReferences;
    }
    return normalized;
  });
  return { schemaVersion, workspaceId, artifacts, updatedAt: value.updatedAt };
}
function readArtifactOwnership(root) {
  const workspace = openDoveWorkspace(root, { operation: "Artifact ownership read" });
  return normalizeIndex(readJson(root, ARTIFACT_PATHS.artifactOwnership, () => createArtifactOwnershipIndex(workspace.manifest.workspaceId)), {
    label: "Artifact ownership index",
    schemaVersion: ARTIFACT_OWNERSHIP_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    fields: OWNERSHIP_FIELDS,
    itemFields: OWNERSHIP_ITEM_FIELDS
  });
}
function readArtifactLineage(root) {
  const workspace = openDoveWorkspace(root, { operation: "Artifact lineage read" });
  return normalizeIndex(readJson(root, ARTIFACT_PATHS.artifactLineage, () => createArtifactLineageIndex(workspace.manifest.workspaceId)), {
    label: "Artifact lineage index",
    schemaVersion: ARTIFACT_LINEAGE_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    fields: LINEAGE_FIELDS,
    itemFields: LINEAGE_ITEM_FIELDS2,
    lineage: true
  });
}
function mergeOwnedPaths(items, additions) {
  const next = new Map(items.map((item) => [item.path, item]));
  for (const item of additions) {
    const existing = next.get(item.path);
    if (existing && existing.missionId !== item.missionId) {
      throw new Error(`Artifact path ${item.path} is already owned by mission ${existing.missionId}; mission ${item.missionId} cannot overwrite it.`);
    }
    next.set(item.path, item);
  }
  return [...next.values()].sort((left, right) => left.path.localeCompare(right.path));
}
function prepareArtifactLineageUpdate(root, receipt) {
  const timestamp = nowIso();
  const ownership = readArtifactOwnership(root);
  const lineage = readArtifactLineage(root);
  const ownershipItems = receipt.artifacts.map((artifact) => ({
    path: artifact.path,
    kind: artifact.kind,
    sha256: artifact.sha256,
    missionId: receipt.missionId,
    contractDigest: receipt.contractDigest,
    receiptId: receipt.receiptId
  }));
  const criterionRefsByArtifact = new Map(receipt.artifacts.map((artifact) => [artifact.path, /* @__PURE__ */ new Set()]));
  for (const criterion of receipt.criteriaSatisfied) {
    for (const evidenceRef of criterion.evidenceRefs) {
      if (!evidenceRef.startsWith("artifact:")) continue;
      const artifactPath = evidenceRef.slice("artifact:".length);
      criterionRefsByArtifact.get(artifactPath)?.add(`criterion:${criterion.criterionId}`);
    }
  }
  const lineageItems = ownershipItems.map((item) => ({
    ...item,
    derivedReferences: [...criterionRefsByArtifact.get(item.path) ?? []].sort()
  }));
  return {
    ownership: {
      schemaVersion: ARTIFACT_OWNERSHIP_SCHEMA_VERSION,
      workspaceId: ownership.workspaceId,
      artifacts: mergeOwnedPaths(ownership.artifacts, ownershipItems),
      updatedAt: timestamp
    },
    lineage: {
      schemaVersion: ARTIFACT_LINEAGE_SCHEMA_VERSION,
      workspaceId: lineage.workspaceId,
      artifacts: mergeOwnedPaths(lineage.artifacts, lineageItems),
      updatedAt: timestamp
    },
    ownershipPaths: ownershipItems.map((item) => item.path),
    lineagePaths: lineageItems.map((item) => item.path)
  };
}

// src/core/mission-contracts.mjs
import crypto3 from "node:crypto";
import fs7 from "node:fs";
import path7 from "node:path";

// src/core/workspace-init.mjs
import fs6 from "node:fs";
import path6 from "node:path";
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
function assertPlainObject3(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}
function assertAllowed(args) {
  assertPlainObject3(args, "dove init arguments");
  const unknown = Object.keys(args).filter((field) => !INIT_FIELDS.has(field));
  if (unknown.length > 0) throw new Error(`dove init does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function goalFrom(args) {
  const goal = typeof args.goal === "string" ? args.goal.trim() : "";
  if (!goal) throw new Error("Dove init requires a non-empty goal.");
  return goal;
}
function mutationModeFor(root, args) {
  const explicit = Object.hasOwn(args, "mutationMode") ? normalizeMutationMode(args.mutationMode) : null;
  const active = currentMutationContext(root)?.mutationMode ?? null;
  if (explicit && active && explicit !== active) throw new Error(`Dove init mutationMode ${explicit} does not match the active MutationContext mode ${active}.`);
  return active ?? explicit ?? "direct-process";
}
function optionalReplayString(value, label) {
  if (value === null || value === void 0) return null;
  if (typeof value !== "string" || !value) throw new Error(`${label} must be a non-empty string or null.`);
  return value;
}
function exactReplayInput(args) {
  return {
    goal: goalFrom(args),
    archiveReset: args.archiveReset === true,
    confirmed: true,
    proposalVersion: args.proposalVersion,
    proposalWorkspace: optionalReplayString(args.proposalWorkspace, "proposalWorkspace"),
    proposalDigest: optionalReplayString(args.proposalDigest, "proposalDigest"),
    mutationMode: Object.hasOwn(args, "mutationMode") ? normalizeMutationMode(args.mutationMode) : "direct-process",
    workspaceId: optionalReplayString(args.workspaceId, "workspaceId"),
    createdAt: optionalReplayString(args.createdAt, "createdAt"),
    detectedState: optionalReplayString(args.detectedState, "detectedState"),
    detectedSchema: optionalReplayString(args.detectedSchema, "detectedSchema"),
    sourceIdentity: args.sourceIdentity ?? null,
    sourceTreeDigest: optionalReplayString(args.sourceTreeDigest, "sourceTreeDigest"),
    archiveTarget: optionalReplayString(args.archiveTarget, "archiveTarget")
  };
}
function proposalEnvelope({ workspace, mutationMode, workspaceId, createdAt, goal, inspection, archiveReset, archiveTarget }) {
  return {
    proposalVersion: DOVE_INIT_PROPOSAL_VERSION,
    workspace,
    mutationMode,
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
  const archiveParent = path6.join(workspace, ".dove-archive");
  if (path6.dirname(archiveTarget) !== archiveParent) {
    throw new Error("Dove archive target must be the deterministic workspace-local .dove-archive target.");
  }
  if (!fs6.existsSync(archiveParent)) return;
  const parentStat = fs6.lstatSync(archiveParent);
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
    { type: "atomic-directory-rename", from: ".dove", to: path6.relative(envelope.workspace, envelope.archiveTarget).split(path6.sep).join("/") },
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
function buildProposal(root, args = {}) {
  const workspace = canonicalWorkspacePath(root);
  const replay = args.confirmed === true ? exactReplayInput(args) : null;
  if (replay && replay.proposalVersion !== DOVE_INIT_PROPOSAL_VERSION) {
    throw new Error("The selected Dove init proposal version is unsupported. Request a fresh proposal.");
  }
  if (replay && replay.proposalWorkspace !== workspace) {
    throw new Error("The selected Dove init proposal belongs to a different canonical workspace. Request a fresh proposal.");
  }
  const inspection = inspectDoveWorkspace(workspace);
  const archiveReset = args.archiveReset === true;
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
  const goal = goalFrom(args);
  const mutationMode = mutationModeFor(workspace, args);
  if (archiveReset && mutationMode === "patch-plan") {
    throw new Error("dove init --archive-reset cannot run in patch-plan mode because a patch plan cannot express the required atomic directory rename and rollback semantics. Use direct-process and an exact confirmation replay.");
  }
  const workspaceId = replay?.workspaceId ?? (typeof args.workspaceId === "string" && args.workspaceId ? args.workspaceId : newWorkspaceId());
  const createdAt = replay?.createdAt ?? (typeof args.createdAt === "string" && args.createdAt ? args.createdAt : (/* @__PURE__ */ new Date()).toISOString());
  const archiveTarget = archiveReset ? archiveTargetFor({ workspace, detectedSchema: inspection.detectedSchema, treeDigest: inspection.source.treeDigest }) : null;
  if (archiveReset) assertArchiveTargetSafe(workspace, archiveTarget);
  const envelope = proposalEnvelope({ workspace, mutationMode, workspaceId, createdAt, goal, inspection, archiveReset, archiveTarget });
  const proposalDigest = workspaceDigest(envelope);
  return { envelope, proposalDigest, inspection, documents: createMinimalWorkspaceDocuments({ workspaceId, goal, createdAt }) };
}
function mutationMetadata(proposal, writesApplied) {
  return {
    mutationMode: proposal.envelope.mutationMode,
    writesApplied,
    paths: writesApplied ? [
      ...proposal.envelope.archiveReset ? [".dove", path6.relative(proposal.envelope.workspace, proposal.envelope.archiveTarget).split(path6.sep).join("/")] : [],
      ...MINIMAL_WORKSPACE_REQUIRED_FILES
    ] : []
  };
}
function proposalResult(proposal) {
  const args = confirmArgs(proposal.envelope, proposal.proposalDigest);
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
    confirmation: {
      required: true,
      exactReplay: true,
      proposalVersion: DOVE_INIT_PROPOSAL_VERSION,
      proposalWorkspace: proposal.envelope.workspace,
      proposalDigest: proposal.proposalDigest,
      mutationMode: proposal.envelope.mutationMode,
      confirmArgs: args,
      proposalToken: Buffer.from(JSON.stringify({ version: DOVE_INIT_PROPOSAL_VERSION, confirmArgs: args }), "utf8").toString("base64url")
    },
    mutation: mutationMetadata(proposal, false)
  };
}
function assertExactReplay(proposal, args) {
  if (args.confirmed !== true) return;
  const replay = exactReplayInput(args);
  const expectedArgs = confirmArgs(proposal.envelope, proposal.proposalDigest);
  if (stableWorkspaceSerialize(replay) !== stableWorkspaceSerialize(expectedArgs)) {
    throw new Error("The selected Dove init proposal no longer matches the approved proposal replay fields exactly. Request a fresh proposal.");
  }
  if (replay.proposalDigest !== proposal.proposalDigest) throw new Error("The selected Dove init proposal no longer matches the exact workspace, source tree, archive target, goal, schema version, or mutation mode. Request a fresh proposal.");
  if (proposal.envelope.archiveReset) {
    const archiveTarget = proposal.envelope.archiveTarget;
    if (fs6.existsSync(archiveTarget)) throw new Error(`Archive target is already occupied: ${archiveTarget}. Request a fresh proposal.`);
    const source = inspectDoveSourceTree(proposal.envelope.workspace);
    if (!source || stableWorkspaceSerialize(source.identity) !== stableWorkspaceSerialize(proposal.envelope.sourceIdentity) || source.treeDigest !== proposal.envelope.sourceTreeDigest) {
      throw new Error("The .dove source identity or tree digest changed after proposal. Request a fresh archive-reset proposal.");
    }
  }
}
function previewDoveInit(root, args = {}) {
  assertAllowed(args);
  if (args.confirmed === true) throw new Error("previewDoveInit does not accept confirmed replay.");
  return proposalResult(buildProposal(root, args));
}
function materializeDoveInitDirect(root, proposal, options = {}) {
  const ops = options.fsOps ?? fs6;
  const workspace = proposal.envelope.workspace;
  const doveRoot = path6.join(workspace, ".dove");
  if (!proposal.envelope.archiveReset) {
    try {
      materializeMinimalWorkspaceDirectory(doveRoot, proposal.documents, { fsOps: ops });
    } catch (error) {
      let rollbackError = null;
      try {
        if (ops.existsSync(doveRoot)) ops.rmSync(doveRoot, { recursive: true, force: true });
      } catch (rollbackFailure) {
        rollbackError = rollbackFailure;
      }
      if (rollbackError) {
        throw new Error(`Dove initialization failed and cleanup also failed: ${error instanceof Error ? error.message : String(error)}; cleanup: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
      }
      throw new Error(`Dove initialization failed; no .dove workspace was retained: ${error instanceof Error ? error.message : String(error)}`);
    }
    return;
  }
  const archiveTarget = proposal.envelope.archiveTarget;
  const archiveParent = path6.dirname(archiveTarget);
  const archiveParentExisted = ops.existsSync(archiveParent);
  let renamed = false;
  try {
    if (!archiveParentExisted) ops.mkdirSync(archiveParent, { recursive: false });
    ops.renameSync(doveRoot, archiveTarget);
    renamed = true;
    materializeMinimalWorkspaceDirectory(doveRoot, proposal.documents, { fsOps: ops });
  } catch (error) {
    let rollbackError = null;
    try {
      if (renamed && ops.existsSync(doveRoot)) ops.rmSync(doveRoot, { recursive: true, force: true });
      if (renamed && ops.existsSync(archiveTarget)) ops.renameSync(archiveTarget, doveRoot);
      if (!archiveParentExisted && ops.existsSync(archiveParent) && ops.readdirSync(archiveParent).length === 0) ops.rmdirSync(archiveParent);
    } catch (rollbackFailure) {
      rollbackError = rollbackFailure;
    }
    if (rollbackError) {
      throw new Error(`Dove archive-reset failed and rollback also failed: ${error instanceof Error ? error.message : String(error)}; rollback: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
    }
    throw new Error(`Dove archive-reset failed; the original .dove directory was restored: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function initDoveWorkspace(root, args = {}, options = {}) {
  assertAllowed(args);
  const proposal = buildProposal(root, args);
  if (args.confirmed !== true) return proposalResult(proposal);
  assertExactReplay(proposal, args);
  if (!currentMutationContext(root)) throw new Error("Confirmed Dove init requires an active MutationContext.");
  if (proposal.envelope.archiveReset && proposal.envelope.mutationMode === "patch-plan") {
    throw new Error("Confirmed Dove archive-reset cannot claim patch-plan writes: the required atomic directory rename and rollback are direct-process only.");
  }
  if (proposal.envelope.mutationMode === "patch-plan") {
    const context = currentMutationContext(root);
    for (const relativePath of MINIMAL_WORKSPACE_DIRECTORIES) context.ensureDirectory(relativePath);
    context.writeJson(".dove/manifest.json", proposal.documents.manifest);
    context.writeJson(".dove/project.json", proposal.documents.project);
    context.writeJson(".dove/artifacts/ownership.json", proposal.documents.ownership);
    context.writeJson(".dove/artifacts/lineage.json", proposal.documents.lineage);
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
  materializeDoveInitDirect(root, proposal, options);
  const opened = openDoveWorkspace(root, { operation: "confirmed Dove init" });
  return {
    status: proposal.envelope.archiveReset ? "archive-reset-complete" : "initialized",
    kind: proposal.envelope.archiveReset ? "archive-reset" : "init",
    manifest: opened.manifest,
    project: opened.project,
    archiveTarget: proposal.envelope.archiveTarget,
    mutation: mutationMetadata(proposal, true),
    writes: MINIMAL_WORKSPACE_REQUIRED_FILES
  };
}

// src/core/mission-contracts.mjs
var MISSION_CONTRACT_SCHEMA_VERSION = 1;
var MISSION_PROPOSAL_VERSION = 1;
var PROJECT_IDENTITY_SCHEMA_VERSION = 1;
var MISSION_CRITERION_ID_VERSION = 1;
var MISSION_EVIDENCE_REQUIREMENT_ID_VERSION = 1;
var MISSION_CONTRACT_ARRAY_FIELDS = [
  "scope",
  "outOfScope",
  "targetArtifacts",
  "expectedArtifacts",
  "completionCriteria",
  "evidenceRequirements"
];
var MISSION_OPTIONAL_ARRAY_FIELDS = ["dependsOnMissionIds"];
var MISSION_CONTRACT_INPUT_FIELDS = /* @__PURE__ */ new Set([
  "missionId",
  "goal",
  ...MISSION_CONTRACT_ARRAY_FIELDS,
  ...MISSION_OPTIONAL_ARRAY_FIELDS,
  "supersedesMissionId"
]);
var MISSION_REPLAY_CONTROL_FIELDS = /* @__PURE__ */ new Set([
  "confirmed",
  "proposalVersion",
  "proposalWorkspace",
  "proposalDigest",
  "mutationMode",
  "workspaceId",
  "createdAt"
]);
var PERSISTED_MISSION_FIELDS = /* @__PURE__ */ new Set([
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
var TYPED_EVIDENCE_REQUIREMENT_PATTERN = /^(artifact|validation|source|note):(.+)$/u;
var INIT_INPUT_FIELDS = /* @__PURE__ */ new Set(["goal", "archiveReset", "confirmed", "proposalVersion", "proposalWorkspace", "proposalDigest", "mutationMode", "workspaceId", "createdAt", "detectedState", "detectedSchema", "sourceIdentity", "sourceTreeDigest", "archiveTarget"]);
function sha2562(value) {
  return crypto3.createHash("sha256").update(value).digest("hex");
}
function normalizeString(value, fallback = null) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim();
  return normalized || fallback;
}
function normalizeStringArray(value) {
  if (value === void 0) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("Mission contract array fields must be arrays of non-empty strings.");
  }
  const normalized = value.map((item) => normalizeString(item, null));
  if (normalized.some((item) => item === null)) {
    throw new Error("Mission contract array fields must contain only non-empty strings.");
  }
  return Array.from(new Set(normalized));
}
function canonicalContractPath(rawPath, label) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) {
    throw new Error(`${label} has an unsafe project-relative path ${JSON.stringify(rawPath)}: ${normalized.reason}.`);
  }
  const supplied = String(rawPath).trim().replace(/\\/gu, "/");
  if (normalized.normalizedPath !== supplied) {
    throw new Error(`${label} path must be canonical: ${rawPath}.`);
  }
  const evidenceRole = artifactEvidenceRole(normalized.normalizedPath);
  if (normalized.normalizedPath === ARTIFACT_PATHS.lessonsDir || normalized.normalizedPath.startsWith(`${ARTIFACT_PATHS.lessonsDir}/`)) {
    throw new Error(`${label} must not reference advisory-only Dove lessons: ${rawPath}.`);
  }
  if (evidenceRole === "bookkeeping" || evidenceRole === "unsupported") {
    throw new Error(`${label} must reference a substantive schema 7 artifact or an external project artifact, not Dove bookkeeping: ${rawPath}.`);
  }
  return normalized.normalizedPath;
}
function normalizeContractPaths(value, label) {
  return normalizeStringArray(value).map((item, index) => canonicalContractPath(item, `${label}[${index}]`));
}
function normalizeEvidenceRequirements(value) {
  return normalizeStringArray(value).map((requirement, index) => {
    if (requirement === "review:authoritative") return requirement;
    const match = TYPED_EVIDENCE_REQUIREMENT_PATTERN.exec(requirement);
    if (!match) {
      throw new Error(`evidenceRequirements[${index}] must use artifact:<path>, validation:<path>, source:<id>, note:<id>, or review:authoritative.`);
    }
    const [, kind, rawValue] = match;
    const normalizedValue = normalizeString(rawValue, null);
    if (!normalizedValue) {
      throw new Error(`evidenceRequirements[${index}] must contain a non-empty typed reference.`);
    }
    if (kind === "artifact" || kind === "validation") {
      return `${kind}:${canonicalContractPath(normalizedValue, `evidenceRequirements[${index}]`)}`;
    }
    return `${kind}:${normalizedValue}`;
  });
}
function assertPlainObject4(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object.`);
  }
}
function assertAllowedFields2(args, allowed, label) {
  assertPlainObject4(args, `${label} arguments`);
  const unknown = Object.keys(args).filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}
function stableMissionValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableMissionValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== void 0).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableMissionValue(item)])
    );
  }
  return value;
}
function stableMissionSerialize(value) {
  return JSON.stringify(stableMissionValue(value));
}
function canonicalWorkspace(root) {
  return fs7.realpathSync.native(path7.resolve(root));
}
function slugify(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "mission";
}
function normalizeMissionId(value, goal) {
  const fallback = `mission-${slugify(goal)}-${sha2562(goal).slice(0, 10)}`;
  const missionId = normalizeString(value, fallback);
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(missionId)) {
    throw new Error("missionId must start with a lowercase letter or digit and contain only lowercase letters, digits, dot, underscore, or hyphen.");
  }
  return missionId;
}
function missionContractContent(args = {}) {
  const goal = normalizeString(args.goal, null);
  if (!goal) {
    throw new Error("Dove mission requires a non-empty goal.");
  }
  const content = { goal };
  for (const field of MISSION_CONTRACT_ARRAY_FIELDS) {
    if (field === "targetArtifacts" || field === "expectedArtifacts") {
      content[field] = normalizeContractPaths(args[field], field);
    } else if (field === "evidenceRequirements") {
      content[field] = normalizeEvidenceRequirements(args[field]);
    } else {
      content[field] = normalizeStringArray(args[field]);
    }
  }
  const dependsOnMissionIds = normalizeStringArray(args.dependsOnMissionIds);
  if (dependsOnMissionIds.length > 0) {
    content.dependsOnMissionIds = dependsOnMissionIds;
  }
  const supersedesMissionId = normalizeString(args.supersedesMissionId, null);
  if (supersedesMissionId) {
    content.supersedesMissionId = supersedesMissionId;
  }
  return content;
}
function missionCompletionCriterionId(_index, criterion) {
  return `criterion-${sha2562(stableMissionSerialize({
    version: MISSION_CRITERION_ID_VERSION,
    criterion
  })).slice(0, 16)}`;
}
function missionEvidenceRequirementId(_index, requirement) {
  return `evidence-${sha2562(stableMissionSerialize({
    version: MISSION_EVIDENCE_REQUIREMENT_ID_VERSION,
    requirement
  })).slice(0, 16)}`;
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
function contractDigestFor(missionId, content) {
  return sha2562(stableMissionSerialize({
    schemaVersion: MISSION_CONTRACT_SCHEMA_VERSION,
    missionId,
    ...content,
    completionCriterionIds: missionCompletionCriteria(content).map(({ criterionId }) => criterionId),
    evidenceRequirementIds: missionEvidenceRequirements(content).map(({ requirementId }) => requirementId)
  }));
}
function currentMissionContractMetadata(mission = {}) {
  assertPlainObject4(mission, "Mission contract");
  const unknown = Object.keys(mission).filter((field) => !PERSISTED_MISSION_FIELDS.has(field));
  if (unknown.length > 0) {
    throw new Error(`Mission contract does not accept unknown persisted fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
  const missionId = normalizeString(mission.missionId, null);
  if (!missionId || !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(missionId)) {
    throw new Error("Mission contract has an invalid missionId.");
  }
  if (mission.schemaVersion !== MISSION_CONTRACT_SCHEMA_VERSION) {
    throw new Error(`Mission contract schemaVersion ${mission.schemaVersion ?? "missing"} is unsupported.`);
  }
  const workspaceId = normalizeString(mission.workspaceId, null);
  if (!workspaceId || !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(workspaceId)) {
    throw new Error(`Mission contract has an invalid workspaceId for ${missionId}.`);
  }
  for (const field of ["contractDigest", "createdAt", "goal", ...MISSION_CONTRACT_ARRAY_FIELDS, "completionCriterionIds", "evidenceRequirementIds"]) {
    if (!Object.hasOwn(mission, field)) {
      throw new Error(`Mission contract is missing required persisted field $.${field}.`);
    }
  }
  if (!/^[0-9a-f]{64}$/u.test(String(mission.contractDigest ?? ""))) {
    throw new Error(`Mission contract has an invalid contractDigest for ${missionId}.`);
  }
  const createdAt = normalizeString(mission.createdAt, null);
  if (!createdAt || !Number.isFinite(Date.parse(createdAt)) || new Date(Date.parse(createdAt)).toISOString() !== createdAt) {
    throw new Error(`Mission contract has an invalid createdAt timestamp for ${missionId}.`);
  }
  const content = missionContractContent(mission);
  const completionCriterionIds = missionCompletionCriteria(content).map(({ criterionId }) => criterionId);
  const evidenceRequirementIds = missionEvidenceRequirements(content).map(({ requirementId }) => requirementId);
  return {
    missionId,
    content,
    contractDigest: contractDigestFor(missionId, content),
    completionCriterionIds,
    evidenceRequirementIds
  };
}
function assertCurrentMissionContract(mission = {}) {
  const current = currentMissionContractMetadata(mission);
  if (mission.contractDigest !== current.contractDigest) {
    throw new Error(`Mission contract digest is stale or malformed for ${current.missionId}.`);
  }
  if (mission.completionCriterionIds !== void 0 && (!Array.isArray(mission.completionCriterionIds) || mission.completionCriterionIds.length !== current.completionCriterionIds.length || mission.completionCriterionIds.some((criterionId, index) => criterionId !== current.completionCriterionIds[index]))) {
    throw new Error(`Mission completion criterion ids are stale or malformed for ${current.missionId}.`);
  }
  if (mission.evidenceRequirementIds !== void 0 && (!Array.isArray(mission.evidenceRequirementIds) || mission.evidenceRequirementIds.length !== current.evidenceRequirementIds.length || mission.evidenceRequirementIds.some((requirementId, index) => requirementId !== current.evidenceRequirementIds[index]))) {
    throw new Error(`Mission evidence requirement ids are stale or malformed for ${current.missionId}.`);
  }
  return current;
}
function missionPath(missionId) {
  return path7.posix.join(ARTIFACT_PATHS.missionsDir, `${missionId}.json`);
}
function fileExists(root, relativePath) {
  const context = currentMutationContext(root);
  return context ? context.fileExists(relativePath) : fs7.existsSync(path7.join(root, relativePath));
}
function projectIdentitySnapshot(root, workspace, args = {}, mutationMode = "direct-process") {
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
  const goal = normalizeString(args.goal, null);
  const workspaceId = normalizeString(args.workspaceId, null) ?? newWorkspaceId();
  const createdAt = normalizeString(args.createdAt, null) ?? nowIso();
  const documents = createMinimalWorkspaceDocuments({ workspaceId, goal, createdAt });
  const initProposal = initDoveWorkspace(root, {
    goal,
    mutationMode,
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
    sha256: sha2562(fs7.readFileSync(fullPath))
  };
}
function directoryArtifactIdentity(relativePath, fullPath) {
  const entries = [];
  const visit = (directoryPath, directoryRelativePath) => {
    for (const entry of fs7.readdirSync(directoryPath, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = path7.join(directoryPath, entry.name);
      const entryRelativePath = path7.posix.join(directoryRelativePath, entry.name);
      const stat = fs7.lstatSync(entryPath, { bigint: true });
      const metadata = { path: entryRelativePath, mode: Number(stat.mode), ctimeNs: String(stat.ctimeNs), mtimeNs: String(stat.mtimeNs) };
      if (stat.isSymbolicLink()) {
        throw new Error(`Mission target artifact directories must not contain symbolic links: ${path7.posix.join(relativePath, entryRelativePath)}.`);
      } else if (stat.isDirectory()) {
        entries.push({ ...metadata, kind: "directory" });
        visit(entryPath, entryRelativePath);
      } else if (stat.isFile()) {
        entries.push({ ...metadata, kind: "file", sizeBytes: String(stat.size), sha256: sha2562(fs7.readFileSync(entryPath)) });
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
    mode: Number(fs7.lstatSync(fullPath, { bigint: true }).mode),
    entryCount: entries.length,
    treeDigest: sha2562(stableMissionSerialize(entries))
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
  const fullPath = path7.join(root, relativePath);
  if (!fs7.existsSync(fullPath)) {
    resolveCanonicalContainedWrite(root, relativePath, { label: "Mission target artifact path" });
    return { path: relativePath, exists: false };
  }
  const stat = fs7.lstatSync(fullPath, { bigint: true });
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
function missionMutationMode(root, args = {}) {
  const explicitMode = Object.hasOwn(args, "mutationMode") ? normalizeMutationMode(args.mutationMode) : null;
  const activeMode = currentMutationContext(root)?.mutationMode ?? null;
  if (activeMode && explicitMode && activeMode !== explicitMode) {
    throw new Error(`Dove mission mutationMode ${explicitMode} does not match the active mutation context mode ${activeMode}.`);
  }
  return activeMode ?? explicitMode ?? "direct-process";
}
function hasConfirmation(args = {}) {
  return args.confirmed === true;
}
function buildMissionProposal(root, args = {}) {
  const workspace = canonicalWorkspace(root);
  const content = missionContractContent(args);
  const missionId = normalizeMissionId(args.missionId, content.goal);
  const contractDigest = contractDigestFor(missionId, content);
  const mutationMode = missionMutationMode(root, args);
  const projectIdentity = projectIdentitySnapshot(root, workspace, {
    goal: content.goal,
    workspaceId: args.workspaceId,
    createdAt: args.createdAt
  }, mutationMode);
  if (!projectIdentity.required) {
    const suppliedWorkspaceId = normalizeString(args.workspaceId, projectIdentity.workspaceId);
    const suppliedCreatedAt = normalizeString(args.createdAt, projectIdentity.createdAt);
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
  const envelope = {
    proposalVersion: MISSION_PROPOSAL_VERSION,
    workspace,
    mutationMode,
    workspaceSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION,
    projectIdentityRequired: projectIdentity.required,
    workspaceBootstrapRequired: projectIdentity.workspaceBootstrapRequired,
    workspaceId: projectIdentity.workspaceId,
    workspaceCreatedAt: projectIdentity.createdAt,
    projectIdentityDigest: projectIdentity.identityDigest,
    targetArtifactIdentities: targetIdentities,
    mission
  };
  const proposalDigest = sha2562(stableMissionSerialize(envelope));
  return {
    workspace,
    mutationMode,
    projectIdentity,
    targetIdentities,
    mission,
    content,
    contractDigest,
    proposalDigest
  };
}
function confirmArgsFor(proposal) {
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
function confirmationMetadata(proposal) {
  return {
    required: true,
    proposalVersion: MISSION_PROPOSAL_VERSION,
    proposalDigest: proposal.proposalDigest,
    proposalWorkspace: proposal.workspace,
    mutationMode: proposal.mutationMode,
    trustBoundary: "trusted-local-exact-replay-data",
    proofOfHumanApproval: false,
    tamperProof: false,
    confirmArgs: confirmArgsFor(proposal)
  };
}
function missionMutationMetadata(proposal, applied) {
  return {
    mutationMode: proposal.mutationMode,
    writesApplied: applied,
    paths: applied ? [
      ...proposal.projectIdentity.required ? [
        ARTIFACT_PATHS.doveRootManifest,
        ARTIFACT_PATHS.projectIdentity,
        ARTIFACT_PATHS.artifactOwnership,
        ARTIFACT_PATHS.artifactLineage
      ] : [],
      missionPath(proposal.mission.missionId)
    ] : []
  };
}
function assertReplayHeader(proposal, args) {
  const suppliedDigest = normalizeString(args.proposalDigest, "");
  if (!/^[0-9a-f]{64}$/u.test(suppliedDigest) || !normalizeString(args.missionId, null)) {
    throw new Error("Confirmed Dove mission materialization requires the exact proposalDigest and missionId returned by the selected local proposal replay data.");
  }
  if (!currentMutationContext(proposal.workspace)) {
    throw new Error("Confirmed Dove mission materialization requires an active MutationContext; direct core replay cannot write outside the selected mutation mode.");
  }
  if (args.proposalVersion !== MISSION_PROPOSAL_VERSION) {
    throw new Error("The selected local Dove mission proposal replay version is not supported. Request a fresh proposal.");
  }
  if (normalizeString(args.proposalWorkspace, "") !== proposal.workspace) {
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
function previewDoveMissionContract(root, args = {}) {
  assertAllowedFields2(args, MISSION_CONTRACT_INPUT_FIELDS, "Dove mission preview");
  const proposal = buildMissionProposal(root, args);
  return {
    status: "proposal",
    mission: proposal.mission,
    contractDigest: proposal.contractDigest,
    handoffBrief: proposal.content,
    confirmation: { required: false },
    mutation: missionMutationMetadata(proposal, false)
  };
}
function createDoveMission(root, args = {}) {
  assertGovernanceMutationRegistered("create-dove-mission", "guarded");
  assertAllowedFields2(args, /* @__PURE__ */ new Set([...MISSION_CONTRACT_INPUT_FIELDS, ...MISSION_REPLAY_CONTROL_FIELDS]), "create_dove_mission");
  const confirmed = hasConfirmation(args);
  const proposal = buildMissionProposal(root, args);
  if (!confirmed) {
    return {
      status: "needs-confirmation",
      mission: proposal.mission,
      contractDigest: proposal.contractDigest,
      handoffBrief: proposal.content,
      confirmation: confirmationMetadata(proposal),
      mutation: missionMutationMetadata(proposal, false)
    };
  }
  assertReplayHeader(proposal, args);
  assertMissionIdAvailable(root, proposal.mission.missionId);
  const mission = persistedMission(proposal);
  try {
    materializeProjectIdentity(root, proposal);
    writeJson(root, missionPath(mission.missionId), mission);
  } catch (error) {
    if (proposal.projectIdentity.required && proposal.mutationMode === "direct-process") {
      try {
        fs7.rmSync(path7.join(root, ARTIFACT_PATHS.doveRoot), { recursive: true, force: true });
      } catch (cleanupError) {
        throw new Error(`First Dove mission materialization failed and cleanup also failed: ${error instanceof Error ? error.message : String(error)}; cleanup: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
      }
    }
    throw error;
  }
  const plannedOnly = isPatchPlanMode(root);
  return {
    status: plannedOnly ? "materialization-planned" : "materialized",
    mission,
    contractDigest: proposal.contractDigest,
    handoffBrief: proposal.content,
    mutation: missionMutationMetadata(proposal, !plannedOnly)
  };
}
function initDoveGoal(root, args = {}) {
  assertGovernanceMutationRegistered("init-dove-goal", "guarded");
  assertAllowedFields2(args, INIT_INPUT_FIELDS, "init_dove_goal");
  return initDoveWorkspace(root, args);
}

// src/core/review-artifact-snapshot.mjs
import crypto4 from "node:crypto";
import fs8 from "node:fs";
import path8 from "node:path";
var HASH_PATTERN2 = /^[a-f0-9]{64}$/u;
function sha256Buffer(value) {
  return crypto4.createHash("sha256").update(value).digest("hex");
}
function sha256File(fullPath) {
  return sha256Buffer(fs8.readFileSync(fullPath));
}
function stableSnapshotSetHash(snapshots = []) {
  const canonical = [...snapshots].map(({ path: artifactPath, sizeBytes, sha256: sha2563 }) => ({ path: artifactPath, sizeBytes, sha256: sha2563 })).sort((left, right) => left.path.localeCompare(right.path));
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
  const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath !== normalized.normalizedPath) throw new Error(`${label} must use its canonical realpath and cannot use an internal alias.`);
  return canonicalPath;
}
function resolveReviewArtifactSnapshots(root, missionId, relativePaths, label = "reviewed artifacts", options = {}) {
  if (!Array.isArray(relativePaths)) throw new Error(`${label} must be an array of project-relative paths.`);
  const ownership = readArtifactOwnership(root);
  const ownerByPath = new Map(ownership.artifacts.map((item) => [item.path, item]));
  const snapshots = [];
  const seen = /* @__PURE__ */ new Set();
  for (const [index, relativePath] of relativePaths.entries()) {
    if (typeof relativePath !== "string" || !relativePath.trim()) throw new Error(`${label}[${index}] must be a non-empty path.`);
    const canonicalPath = canonicalReviewArtifactPath(root, relativePath, `${label}[${index}]`);
    if (seen.has(canonicalPath)) continue;
    seen.add(canonicalPath);
    const owner = ownerByPath.get(canonicalPath);
    if (!owner) throw new Error(`${label}[${index}] is not a registered schema 7 artifact: ${canonicalPath}.`);
    if (owner.missionId !== missionId) throw new Error(`${label}[${index}] belongs to mission ${owner.missionId}, not ${missionId}.`);
    const inspection = inspectDeclaredPath(root, canonicalPath, { requireNonEmpty: true, rejectBookkeeping: true });
    const snapshot = {
      path: canonicalPath,
      sizeBytes: inspection.sizeBytes,
      sha256: sha256File(path8.resolve(root, canonicalPath))
    };
    if (options.requireOwnershipCurrent !== false && snapshot.sha256 !== owner.sha256) {
      throw new Error(`${label}[${index}] has changed since its latest ownership receipt: ${canonicalPath}.`);
    }
    snapshots.push(snapshot);
  }
  if (snapshots.length === 0) throw new Error(`${label} requires at least one existing non-empty non-bookkeeping mission-owned artifact.`);
  snapshots.sort((left, right) => left.path.localeCompare(right.path));
  return { reviewedArtifacts: snapshots, reviewedArtifactSetSha256: stableSnapshotSetHash(snapshots) };
}
function normalizeReviewSnapshots(value, label = "reviewedArtifacts") {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, snapshots: [], reason: `${label} must contain artifact snapshots` };
  const snapshots = [];
  const seen = /* @__PURE__ */ new Set();
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false, snapshots: [], reason: `${label}[${index}] must be an object` };
    if (Object.keys(item).some((field) => !["path", "sizeBytes", "sha256"].includes(field))) return { ok: false, snapshots: [], reason: `${label}[${index}] has unknown fields` };
    const normalized = normalizeProjectRelativePath(item.path);
    if (!normalized.ok || normalized.normalizedPath !== item.path || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || !HASH_PATTERN2.test(String(item.sha256 ?? ""))) {
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
    const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
    if (inspection.normalizedPath !== prepared.path || canonicalPath !== prepared.path) {
      failures.push(`reviewed-artifact-path-changed:${prepared.path}`);
      continue;
    }
    const current = { path: canonicalPath, sizeBytes: inspection.sizeBytes, sha256: sha256File(path8.resolve(root, canonicalPath)) };
    if (JSON.stringify(current) !== JSON.stringify(prepared)) failures.push(`reviewed-artifact-changed:${prepared.path}`);
  }
  return {
    ok: failures.length === 0,
    failures: [...new Set(failures)],
    reviewedArtifacts: normalized.snapshots,
    reviewedArtifactSetSha256: setHash
  };
}

// src/core/domain-artifacts.mjs
var SAFE_ID2 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
function domainSafeId(value, label) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!SAFE_ID2.test(normalized)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return normalized;
}
function domainNonEmptyText(value, label) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(`${label} must be a non-empty string.`);
  return normalized;
}
function domainStringArray(value, label, options = {}) {
  if (value === void 0) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array of non-empty strings.`);
  const items = value.map((item, index) => domainNonEmptyText(item, `${label}[${index}]`));
  if (new Set(items).size !== items.length) throw new Error(`${label} must not contain duplicates.`);
  if (options.minItems && items.length < options.minItems) throw new Error(`${label} must contain at least ${options.minItems} item(s).`);
  return items;
}
function assertSealedDomainArgs(args, fields, label) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error(`${label} arguments must be a plain object.`);
  const unknown = Object.keys(args).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function domainJson(value) {
  return `${JSON.stringify(value, null, 2)}
`;
}
function domainSha256(value) {
  return crypto5.createHash("sha256").update(value).digest("hex");
}
function readCurrentMission(root, missionId, operation = "Domain workflow") {
  const workspace = openDoveWorkspace(root, { operation });
  const normalizedMissionId = domainSafeId(missionId, "missionId");
  const relativePath = path9.posix.join(ARTIFACT_PATHS.missionsDir, `${normalizedMissionId}.json`);
  const fullPath = path9.resolve(root, relativePath);
  if (!fs9.existsSync(fullPath)) throw new Error(`Mission does not exist: ${normalizedMissionId}.`);
  const mission = readJson(root, relativePath, null);
  const current = assertCurrentMissionContract(mission);
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
  const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath !== relativePath) throw new Error(`${label} must use the canonical realpath-contained path.`);
  return { path: canonicalPath, sha256: sha256File(path9.resolve(root, canonicalPath)) };
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
    if (!owner) throw new Error(`${label}[${index}] is not a registered schema 7 artifact: ${artifactPath}.`);
    if (owner.missionId !== missionId) throw new Error(`${label}[${index}] belongs to mission ${owner.missionId}, not ${missionId}.`);
    const current = currentFileHash(root, artifactPath, `${label}[${index}]`);
    if (current.sha256 !== owner.sha256) throw new Error(`${label}[${index}] has changed since its latest ownership receipt: ${artifactPath}.`);
    return { ...owner, ...current };
  });
}
function normalizeWrite(root, missionId, item, index, options = {}) {
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`domainWrites[${index}] must be an object.`);
  const relativePath = canonicalDomainPath(item.path, `domainWrites[${index}].path`, ".dove");
  if (isDoveLessonArtifactPath(relativePath) && options.allowLessonArtifacts !== true) {
    throw new Error(`domainWrites[${index}].path may create a Dove lesson only through record_dove_lesson.`);
  }
  if (options.allowLessonArtifacts === true && !isDoveLessonArtifactPath(relativePath)) {
    throw new Error(`domainWrites[${index}].path must stay under ${ARTIFACT_PATHS.lessonsDir} for lesson recording.`);
  }
  const kind = domainNonEmptyText(item.kind, `domainWrites[${index}].kind`);
  if (!["report", "document", "code", "data", "figure", "media", "other"].includes(kind)) throw new Error(`domainWrites[${index}].kind is unsupported.`);
  const content = Buffer.isBuffer(item.content) ? item.content : Buffer.from(String(item.content ?? ""), "utf8");
  if (content.byteLength === 0) throw new Error(`domainWrites[${index}].content must be non-empty.`);
  const context = currentMutationContext(root);
  context.resolve(relativePath);
  if (Buffer.isBuffer(item.content) && isPatchPlanMode(root) && path9.extname(relativePath).toLowerCase() !== ".svg") {
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
function mergeDerivedReferences(lineageUpdate, writes, receipt) {
  const byPath = new Map(writes.map((item) => [item.path, item.derivedReferences]));
  const criterionRefs = new Map(receipt.artifacts.map((artifact) => [artifact.path, []]));
  for (const criterion of receipt.criteriaSatisfied) {
    for (const reference of criterion.evidenceRefs) {
      if (!reference.startsWith("artifact:")) continue;
      const artifactPath = reference.slice("artifact:".length);
      criterionRefs.get(artifactPath)?.push(`criterion:${criterion.criterionId}`);
    }
  }
  lineageUpdate.lineage.artifacts = lineageUpdate.lineage.artifacts.map((item) => {
    if (!byPath.has(item.path)) return item;
    return {
      ...item,
      derivedReferences: [.../* @__PURE__ */ new Set([...byPath.get(item.path) ?? [], ...criterionRefs.get(item.path) ?? []])].sort()
    };
  });
  return lineageUpdate;
}
function finalizeDomainArtifacts(root, options = {}) {
  const actionId = domainNonEmptyText(options.actionId, "actionId");
  assertGovernanceMutationRegistered(actionId, options.governanceMode ?? "guarded");
  const context = currentMutationContext(root);
  if (!context) throw new Error(`${actionId} requires an active MutationContext.`);
  const { workspace, mission } = readCurrentMission(root, options.missionId, options.operation ?? actionId);
  if (!Array.isArray(options.writes) || options.writes.length === 0) throw new Error(`${actionId} requires at least one real domain artifact write.`);
  const writes = options.writes.map((item, index) => normalizeWrite(root, mission.missionId, item, index, {
    allowLessonArtifacts: options.allowLessonArtifacts === true && actionId === "record-dove-lesson"
  }));
  const duplicatePath = writes.map((item) => item.path).find((item, index, items) => items.indexOf(item) !== index);
  if (duplicatePath) throw new Error(`${actionId} contains duplicate artifact path ${duplicatePath}.`);
  const receiptId = `receipt-${actionId}-${crypto5.randomUUID()}`;
  const receiptPath = path9.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receiptId}.json`);
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
    if (owner.missionId !== mission.missionId) throw new Error(`${actionId} refuses to overwrite artifact ${item.path} owned by mission ${owner.missionId}.`);
    const current = currentFileHash(root, item.path, item.path);
    if (current.sha256 !== owner.sha256) throw new Error(`${actionId} refuses to overwrite drifted artifact ${item.path}.`);
  }
  const artifacts = writes.map(({ path: artifactPath, kind, sha256: sha2563 }) => ({ path: artifactPath, kind, sha256: sha2563 }));
  const completionEligible = false;
  const criteriaSatisfied = [];
  const receipt = {
    schemaVersion: 1,
    workspaceId: workspace.manifest.workspaceId,
    receiptId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    summary: domainNonEmptyText(options.summary, "summary"),
    artifacts,
    validations: [],
    criteriaSatisfied,
    producedAt: nowIso()
  };
  const lineageUpdate = mergeDerivedReferences(prepareArtifactLineageUpdate(root, receipt), writes, receipt);
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
  writeJson(root, ARTIFACT_PATHS.artifactOwnership, lineageUpdate.ownership);
  writeJson(root, ARTIFACT_PATHS.artifactLineage, lineageUpdate.lineage);
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
      paths: [...writes.map((item) => item.path), receiptPath, ARTIFACT_PATHS.artifactOwnership, ARTIFACT_PATHS.artifactLineage]
    }
  };
}

// src/core/execution-receipts.mjs
import fs11 from "node:fs";
import path11 from "node:path";

// src/core/source-trust.mjs
import fs10 from "node:fs";
import path10 from "node:path";
var SOURCE_LIFECYCLE_STATES = Object.freeze(["candidate", "verified", "rejected"]);
var REGISTER_FIELDS = /* @__PURE__ */ new Set(["missionId", "sourceId", "citationKey", "title", "authors", "year", "locator", "sourceType", "abstract", "origin", "capturePath"]);
var REJECT_FIELDS = /* @__PURE__ */ new Set(["missionId", "sourceId", "method", "checkedMaterial", "auditEvidence"]);
var QUERY_FIELDS = /* @__PURE__ */ new Set(["missionId", "sourceId", "lifecycle", "limit"]);
function normalizeText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "";
}
function normalizeIdentityText(value) {
  return normalizeText(value).normalize("NFKC").toLowerCase();
}
function normalizeDoi(value) {
  const text = normalizeIdentityText(value).replace(/^https?:\/\/(?:dx\.)?doi\.org\//u, "");
  return text.startsWith("10.") ? text : "";
}
function normalizeUrl(value) {
  const text = normalizeText(value);
  if (!text) return "";
  try {
    const parsed = new URL(text);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    if (parsed.protocol === "https:" && parsed.port === "443" || parsed.protocol === "http:" && parsed.port === "80") parsed.port = "";
    return parsed.toString();
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
function readSourceFiles(root) {
  openDoveWorkspace(root, { operation: "Source query" });
  const directory = path10.resolve(root, ".dove/sources");
  return fs10.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => readJson(root, path10.posix.join(".dove/sources", entry.name), null)).filter((item) => item && item.schemaVersion === 1 && item.sourceId).sort((left, right) => String(left.sourceId).localeCompare(String(right.sourceId)));
}
function capturedMaterial(root, capturePath) {
  if (!capturePath) return null;
  const canonicalPath = canonicalDomainPath(capturePath, "capturePath");
  const inspection = inspectDeclaredPath(root, canonicalPath, { requireNonEmpty: true });
  if (inspection.status !== "existing") throw new Error(`capturePath must reference an existing non-empty regular file (${inspection.reason ?? inspection.status}).`);
  const resolved = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (resolved !== canonicalPath) throw new Error("capturePath must use its canonical realpath-contained path.");
  return { path: resolved, sha256: domainSha256(fs10.readFileSync(path10.resolve(root, resolved))) };
}
function sourceRecord(root, args, capturedMaterial2, current = null) {
  const missionId = domainSafeId(args.missionId, "missionId");
  const sourceId = domainSafeId(args.sourceId, "sourceId");
  const title = normalizeText(args.title);
  const locator = normalizeText(args.locator);
  if (!title && !locator) throw new Error("register_source requires a real title or locator.");
  const authors = domainStringArray(args.authors, "authors");
  const identityFields = { title, authors, locator };
  const fingerprint = sourceIdentityFingerprint(identityFields);
  return {
    schemaVersion: 1,
    sourceId,
    missionId,
    citationKey: normalizeText(args.citationKey) || null,
    title: title || null,
    authors,
    year: args.year === void 0 || args.year === null || String(args.year).trim() === "" ? null : String(args.year).trim(),
    locator: locator || null,
    sourceType: normalizeText(args.sourceType) || null,
    abstract: normalizeText(args.abstract) || null,
    origin: normalizeText(args.origin) || null,
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
function registerSource(root, args = {}) {
  assertSealedDomainArgs(args, REGISTER_FIELDS, "register_source");
  const { mission } = readCurrentMission(root, args.missionId, "Source registration");
  const sourceId = domainSafeId(args.sourceId, "sourceId");
  const relativePath = sourcePath(sourceId);
  const existing = fs10.existsSync(path10.resolve(root, relativePath)) ? readJson(root, relativePath, null) : null;
  if (existing && existing.missionId !== mission.missionId) throw new Error(`Source ${args.sourceId} belongs to mission ${existing.missionId}.`);
  const captured = capturedMaterial(root, args.capturePath);
  const materialPath = captured ? path10.posix.join(".dove/sources/materials", `${sourceId}${path10.extname(captured.path).toLowerCase() || ".bin"}`) : null;
  const sourceMaterial = captured ? { path: materialPath, sha256: captured.sha256 } : null;
  const source = sourceRecord(root, args, sourceMaterial, existing);
  const writes = [{ path: relativePath, kind: "data", content: domainJson(source), derivedReferences: source.capturedMaterial ? [`artifact:${source.capturedMaterial.path}`] : [] }];
  if (captured) writes.unshift({ path: materialPath, kind: "document", content: fs10.readFileSync(path10.resolve(root, captured.path)), derivedReferences: [] });
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
function normalizeAuditEvidence(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("verify_source requires at least one auditEvidence item.");
  return value.map((item, index) => {
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
function verifySource(root, args = {}) {
  assertSealedDomainArgs(args, REJECT_FIELDS, "verify_source");
  const { mission } = readCurrentMission(root, args.missionId, "Source rejection");
  const sourceId = domainSafeId(args.sourceId, "sourceId");
  const relativePath = sourcePath(sourceId);
  const source = readJson(root, relativePath, null);
  if (!source) throw new Error(`Unknown source: ${sourceId}.`);
  if (source.missionId !== mission.missionId) throw new Error(`Source ${sourceId} belongs to mission ${source.missionId}.`);
  const next = {
    ...source,
    lifecycle: "rejected",
    currentDecision: {
      decision: "rejected",
      method: domainNonEmptyText(args.method, "method"),
      checkedMaterial: domainNonEmptyText(args.checkedMaterial, "checkedMaterial"),
      auditEvidence: normalizeAuditEvidence(args.auditEvidence),
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
  if (source.identityFingerprint !== sourceIdentityFingerprint(source)) return { eligible: false, reason: "source-identity-changed", source, verification: source.currentDecision ?? null };
  if (source.lifecycle !== "verified" || source.currentDecision?.decision !== "verified") return { eligible: false, reason: `source-${source.lifecycle ?? "candidate"}`, source, verification: source.currentDecision ?? null };
  if (!source.capturedMaterial) return { eligible: false, reason: "source-captured-material-missing", source, verification: source.currentDecision };
  const material = capturedMaterial(options.root, source.capturedMaterial.path);
  if (!material || material.sha256 !== source.capturedMaterial.sha256 || source.currentDecision.materialHash !== material.sha256) return { eligible: false, reason: "source-verification-material-changed", source, verification: source.currentDecision };
  const receipt = readJson(options.root, executionReceiptPath(source.currentDecision.receiptId), null);
  if (!receipt || receipt.missionId !== missionId || !receipt.artifacts.some((item) => item.path === material.path && item.sha256 === material.sha256)) return { eligible: false, reason: "source-verification-receipt-invalid", source, verification: source.currentDecision };
  return { eligible: true, reason: "verified-source", source, verification: source.currentDecision };
}
function evaluateSourceReferences(root, references = [], missionId = null) {
  const sources = readSourceFiles(root);
  const byReference = new Map(sources.flatMap((source) => [source.sourceId, source.citationKey, source.locator].filter(Boolean).map((reference) => [reference, source])));
  return references.map((reference) => ({ reference, ...sourceEligibility(byReference.get(reference) ?? null, [], { root, missionId }) }));
}
function evaluateNoteReferences(root, references = [], missionId = null) {
  return references.map((reference) => {
    const note = readJson(root, notePath(reference), null);
    if (!note) return { reference, eligible: false, reason: "unknown-note", note: null, sources: [], artifacts: [] };
    if (!missionId || note.missionId !== missionId) return { reference, eligible: false, reason: "note-mission-binding-mismatch", note, sources: [], artifacts: [] };
    const sourceIds = Array.isArray(note.sourceIds) ? note.sourceIds : [];
    const artifactRefs = Array.isArray(note.artifactRefs) ? note.artifactRefs : [];
    if (sourceIds.length === 0 && artifactRefs.length === 0) return { reference, eligible: false, reason: "note-evidence-missing", note, sources: [], artifacts: [] };
    const sources = evaluateSourceReferences(root, sourceIds, missionId);
    const sourceFailure = sources.find((item) => !item.eligible);
    const ownership = readJson(root, ARTIFACT_PATHS.artifactOwnership, { artifacts: [] });
    const owned = new Map((ownership.artifacts ?? []).map((item) => [item.path, item]));
    const artifacts = artifactRefs.map((artifactPath) => {
      const owner = owned.get(artifactPath);
      if (!owner) return { path: artifactPath, current: false, reason: "artifact-ownership-missing" };
      if (owner.missionId !== missionId) return { path: artifactPath, current: false, reason: "artifact-mission-binding-mismatch" };
      const inspection = inspectDeclaredPath(root, artifactPath, { requireNonEmpty: true });
      if (inspection.status !== "existing") return { path: artifactPath, current: false, reason: inspection.reason ?? inspection.status };
      const currentHash2 = domainSha256(fs10.readFileSync(path10.resolve(root, artifactPath)));
      return { path: artifactPath, current: currentHash2 === owner.sha256, reason: currentHash2 === owner.sha256 ? "current-artifact" : "artifact-hash-drift" };
    });
    const artifactFailure = artifacts.find((item) => !item.current);
    const failure = sourceFailure?.reason ?? artifactFailure?.reason ?? null;
    return { reference, eligible: !failure, reason: failure ?? "verified-note", note, sources, artifacts };
  });
}
function querySources(root, args = {}) {
  assertSealedDomainArgs(args, QUERY_FIELDS, "query_sources");
  const { mission } = readCurrentMission(root, args.missionId, "Source query");
  const sourceId = normalizeText(args.sourceId);
  const lifecycle = normalizeText(args.lifecycle).toLowerCase();
  const limit = Math.min(200, Math.max(1, Number.isFinite(Number(args.limit)) ? Math.trunc(Number(args.limit)) : 50));
  const items = readSourceFiles(root).filter((source) => source.missionId === mission.missionId).filter((source) => !sourceId || [source.sourceId, source.citationKey, source.locator].includes(sourceId)).filter((source) => !lifecycle || source.lifecycle === lifecycle).slice(0, limit).map((source) => {
    const eligibility = sourceEligibility(source, [], { root, missionId: mission.missionId });
    return { ...source, eligibility: { eligible: eligibility.eligible, reason: eligibility.reason } };
  });
  return { status: items.length ? "ok" : "empty", missionId: mission.missionId, sourceCount: items.length, items, writes: [] };
}

// src/core/execution-receipts.mjs
var EXECUTION_RECEIPT_SCHEMA_VERSION = 1;
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
var ARTIFACT_FIELDS = /* @__PURE__ */ new Set(["path", "kind", "sha256"]);
var VALIDATION_FIELDS = /* @__PURE__ */ new Set(["kind", "reference", "outputHash"]);
var CRITERION_FIELDS = /* @__PURE__ */ new Set(["criterionId", "evidenceRefs"]);
var RECEIPT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var HASH_PATTERN3 = /^[0-9a-f]{64}$/u;
var EVIDENCE_REF_PATTERN = /^(artifact|validation|source|note):(.+)$/u;
function assertPlainObject5(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object.`);
  }
}
function assertAllowedFields3(value, allowed, label) {
  assertPlainObject5(value, label);
  const unknown = Object.keys(value).filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}
function nonEmptyString2(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}
function hashString(value, label) {
  const hash2 = nonEmptyString2(value, label).toLowerCase();
  if (!HASH_PATTERN3.test(hash2)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  }
  return hash2;
}
function safeId2(value, label) {
  const id = nonEmptyString2(value, label);
  if (!RECEIPT_ID_PATTERN.test(id)) {
    throw new Error(`${label} must start with a lowercase letter or digit and contain only lowercase letters, digits, dot, underscore, or hyphen.`);
  }
  return id;
}
function parseProducedAt(value) {
  const producedAt = nonEmptyString2(value, "producedAt");
  const timestamp = Date.parse(producedAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== producedAt) {
    throw new Error("producedAt must be an exact ISO-8601 timestamp.");
  }
  return producedAt;
}
function executionReceiptPath(receiptId) {
  return path11.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receiptId}.json`);
}
function missionContractPath(missionId) {
  return path11.posix.join(ARTIFACT_PATHS.missionsDir, `${missionId}.json`);
}
function inspectHashedFile(root, rawPath, expectedHash, label) {
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
  const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (canonicalPath !== normalized.normalizedPath) {
    throw new Error(`${label} must use its canonical realpath-contained path; alias ${normalized.normalizedPath} resolves to ${canonicalPath}.`);
  }
  const actualHash = sha256File(path11.resolve(root, canonicalPath));
  if (actualHash !== expectedHash) {
    throw new Error(`${label} SHA-256 mismatch for ${canonicalPath}.`);
  }
  return { path: canonicalPath, sha256: actualHash };
}
function normalizeArtifacts(root, mission, value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("artifacts must contain at least one artifact.");
  }
  const seen = /* @__PURE__ */ new Set();
  const artifacts = value.map((item, index) => {
    const label = `artifacts[${index}]`;
    assertAllowedFields3(item, ARTIFACT_FIELDS, label);
    const rawPath = nonEmptyString2(item.path, `${label}.path`);
    const kind = nonEmptyString2(item.kind, `${label}.kind`);
    if (!ARTIFACT_KIND_SET.has(kind)) {
      throw new Error(`${label}.kind must be one of: ${EXECUTION_RECEIPT_ARTIFACT_KINDS.join(", ")}.`);
    }
    const sha2563 = hashString(item.sha256, `${label}.sha256`);
    const inspected = inspectHashedFile(root, rawPath, sha2563, label);
    assertNotDoveLessonArtifactPath(inspected.path, `${label}.path`);
    if (seen.has(inspected.path)) throw new Error(`artifacts contains duplicate canonical path ${inspected.path}.`);
    seen.add(inspected.path);
    return { path: inspected.path, kind, sha256: sha2563 };
  });
  const requiredArtifacts = /* @__PURE__ */ new Set([
    ...Array.isArray(mission.targetArtifacts) ? mission.targetArtifacts : [],
    ...Array.isArray(mission.expectedArtifacts) ? mission.expectedArtifacts : []
  ]);
  const missing = [...requiredArtifacts].filter((artifactPath) => !seen.has(artifactPath));
  if (missing.length > 0) {
    throw new Error(`artifacts is missing mission target or expected artifacts: ${missing.join(", ")}.`);
  }
  return artifacts;
}
function normalizeValidations(root, value) {
  if (value === void 0) return [];
  if (!Array.isArray(value)) throw new Error("validations must be an array.");
  const seen = /* @__PURE__ */ new Set();
  return value.map((item, index) => {
    const label = `validations[${index}]`;
    assertAllowedFields3(item, VALIDATION_FIELDS, label);
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
  const [, kind, value] = match;
  if (kind === "source") {
    return evaluateSourceReferences(root, [value], missionId)[0] ?? { eligible: false, reason: "unknown-source" };
  }
  if (kind === "note") {
    return evaluateNoteReferences(root, [value], missionId)[0] ?? { eligible: false, reason: "unknown-note" };
  }
  return { eligible: null, kind, value };
}
function normalizeCriteria(root, mission, value, artifacts, validations) {
  const requiredCriteria = missionCompletionCriteria(mission);
  if (!Array.isArray(value)) throw new Error("criteriaSatisfied must be an array.");
  const requiredIds = new Set(requiredCriteria.map((item) => item.criterionId));
  const artifactRefs = new Set(artifacts.map((artifact) => `artifact:${artifact.path}`));
  const validationRefs = new Set(validations.map((validation) => `validation:${validation.reference}`));
  const seen = /* @__PURE__ */ new Set();
  const criteria = value.map((item, index) => {
    const label = `criteriaSatisfied[${index}]`;
    assertAllowedFields3(item, CRITERION_FIELDS, label);
    const criterionId = nonEmptyString2(item.criterionId, `${label}.criterionId`);
    if (!requiredIds.has(criterionId)) throw new Error(`${label}.criterionId is unknown for the current mission: ${criterionId}.`);
    if (seen.has(criterionId)) throw new Error(`criteriaSatisfied contains duplicate criterionId ${criterionId}.`);
    seen.add(criterionId);
    if (!Array.isArray(item.evidenceRefs) || item.evidenceRefs.length === 0) {
      throw new Error(`${label}.evidenceRefs must contain at least one resolvable evidence reference; summary is not evidence.`);
    }
    const evidenceRefs = item.evidenceRefs.map((reference, evidenceIndex) => {
      const normalized = nonEmptyString2(reference, `${label}.evidenceRefs[${evidenceIndex}]`);
      if (artifactRefs.has(normalized) || validationRefs.has(normalized)) return normalized;
      const evaluation = typedReferenceEvaluation(root, mission.missionId, normalized);
      if (evaluation.eligible === true) return normalized;
      throw new Error(`${label}.evidenceRefs[${evidenceIndex}] is not current eligible typed evidence: ${normalized} (${evaluation.reason ?? "unresolved"}).`);
    });
    if (new Set(evidenceRefs).size !== evidenceRefs.length) throw new Error(`${label}.evidenceRefs contains duplicates.`);
    return { criterionId, evidenceRefs };
  });
  const missing = requiredCriteria.filter((item) => !seen.has(item.criterionId));
  if (missing.length > 0) {
    throw new Error(`criteriaSatisfied is missing mission completion criteria: ${missing.map((item) => item.criterionId).join(", ")}.`);
  }
  return criteria;
}
function validateExecutionReceipt(root, args = {}) {
  const workspace = openDoveWorkspace(root, { operation: "Execution receipt validation" });
  assertAllowedFields3(args, TOP_LEVEL_FIELDS, "ingest_execution_receipt");
  const receiptId = safeId2(args.receiptId, "receiptId");
  const missionId = safeId2(args.missionId, "missionId");
  const contractDigest = hashString(args.contractDigest, "contractDigest");
  const summary = nonEmptyString2(args.summary, "summary");
  const producedAt = parseProducedAt(args.producedAt);
  const missionRelativePath = missionContractPath(missionId);
  if (!fs11.existsSync(path11.resolve(root, missionRelativePath))) {
    throw new Error(`Mission does not exist: ${missionId}.`);
  }
  const mission = readJson(root, missionRelativePath, null);
  if (!mission || mission.missionId !== missionId) throw new Error(`Mission contract is malformed or mismatched: ${missionId}.`);
  const currentContract = assertCurrentMissionContract(mission);
  if (mission.workspaceId !== workspace.manifest.workspaceId) throw new Error(`Mission contract workspaceId does not match the current workspace for ${missionId}.`);
  if (contractDigest !== currentContract.contractDigest) throw new Error(`contractDigest does not match the current mission contract for ${missionId}.`);
  const receiptRelativePath = executionReceiptPath(receiptId);
  const mutationContext = currentMutationContext(root);
  if (mutationContext ? mutationContext.fileExists(receiptRelativePath) : fs11.existsSync(path11.resolve(root, receiptRelativePath))) {
    throw new Error(`Execution receipt id is already occupied: ${receiptId}.`);
  }
  const artifacts = normalizeArtifacts(root, mission, args.artifacts);
  const validations = normalizeValidations(root, args.validations);
  const criteriaSatisfied = normalizeCriteria(root, mission, args.criteriaSatisfied, artifacts, validations);
  const receipt = {
    schemaVersion: EXECUTION_RECEIPT_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    receiptId,
    missionId,
    contractDigest,
    summary,
    artifacts,
    validations,
    criteriaSatisfied,
    producedAt
  };
  const lineageUpdate = prepareArtifactLineageUpdate(root, receipt);
  return {
    mission,
    receipt,
    lineageUpdate
  };
}
function ingestExecutionReceipt(root, args = {}) {
  assertGovernanceMutationRegistered("ingest-execution-receipt", "guarded");
  if (!currentMutationContext(root)) throw new Error("ingest_execution_receipt requires an active MutationContext.");
  const { receipt, lineageUpdate } = validateExecutionReceipt(root, args);
  writeJson(root, executionReceiptPath(receipt.receiptId), receipt);
  writeJson(root, ARTIFACT_PATHS.artifactOwnership, lineageUpdate.ownership);
  writeJson(root, ARTIFACT_PATHS.artifactLineage, lineageUpdate.lineage);
  const plannedOnly = isPatchPlanMode(root);
  return {
    status: plannedOnly ? "ingest-planned" : "ingested",
    receipt,
    completion: { missionId: receipt.missionId, assessWith: "assess_mission_completion" },
    mutation: {
      mutationMode: currentMutationContext(root).mutationMode,
      writesApplied: !plannedOnly,
      paths: [executionReceiptPath(receipt.receiptId), ARTIFACT_PATHS.artifactOwnership, ARTIFACT_PATHS.artifactLineage]
    }
  };
}
function readExecutionReceipts(root, missionId = null) {
  openDoveWorkspace(root, { operation: "Execution receipt read" });
  const receiptsRoot = path11.resolve(root, ARTIFACT_PATHS.executionReceiptsDir);
  if (!fs11.existsSync(receiptsRoot)) return [];
  return fs11.readdirSync(receiptsRoot, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => {
    const relativePath = path11.posix.join(ARTIFACT_PATHS.executionReceiptsDir, entry.name);
    try {
      return readJson(root, relativePath, null);
    } catch (error) {
      return {
        schemaVersion: null,
        receiptId: entry.name.slice(0, -".json".length),
        missionId,
        __readFailure: error instanceof Error ? error.message : String(error)
      };
    }
  }).filter((receipt) => receipt && (!missionId || receipt.missionId === missionId || receipt.__readFailure)).sort((left, right) => String(left.producedAt).localeCompare(String(right.producedAt)) || String(left.receiptId).localeCompare(String(right.receiptId)));
}

// src/core/review-exchange.mjs
import crypto6 from "node:crypto";
import fs12 from "node:fs";
import path12 from "node:path";
var REVIEW_EXCHANGE_SCHEMA_VERSION = 7;
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
var HASH_PATTERN4 = /^[0-9a-f]{64}$/u;
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
  "artifactPaths",
  "finalPlanPaths",
  "finalResultPaths",
  "reviewedArtifactPaths",
  "reviewedArtifacts",
  "reviewedArtifactSetSha256",
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
  "inputPath",
  "inputSha256",
  "handoffPath",
  "reportPath",
  "artifactPaths",
  "finalPlanPaths",
  "finalResultPaths",
  "reviewedArtifactPaths",
  "reviewedArtifacts",
  "reviewedArtifactSetSha256"
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
  "findings",
  "actionItems",
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
  "importedReportPath",
  "importedReportSha256"
]);
var AUTHORITY_FIELDS = /* @__PURE__ */ new Set(["authoritative", "callerMayMintAuthority", "issuer", "reason"]);
function sealed(value, fields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  return value;
}
function exchangePath(exchangeId, leaf) {
  return path12.posix.join(".dove/reviews/exchanges", exchangeId, leaf);
}
function importedReviewPath(reviewId) {
  return path12.posix.join(".dove/reviews", `${reviewId}.json`);
}
function importedReportPath(reviewId) {
  return path12.posix.join(".dove/reviews", `${reviewId}.report.md`);
}
function exactTimestamp(value, label) {
  const text = domainNonEmptyText(value, label);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return text;
}
function exactHash(value, label) {
  const hash2 = String(value ?? "");
  if (!HASH_PATTERN4.test(hash2)) throw new Error(`${label} must be a lowercase SHA-256 hash.`);
  return hash2;
}
function currentCanonicalLeaf(root, relativePath, label) {
  const inspection = inspectDeclaredPath(root, relativePath, { requireNonEmpty: true });
  if (inspection.status !== "existing") throw new Error(`${label} must be an existing non-empty regular file (${inspection.reason ?? inspection.status}).`);
  const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (inspection.normalizedPath !== relativePath || canonicalPath !== relativePath) throw new Error(`${label} must be the canonical realpath-contained exchange path.`);
  const content = fs12.readFileSync(path12.resolve(root, canonicalPath));
  return { path: canonicalPath, content, sha256: domainSha256(content) };
}
function normalizedPolicy(value) {
  const policy = domainNonEmptyText(value, "policy");
  if (!POLICY_SET.has(policy)) throw new Error(`policy must be one of: ${REVIEW_EXCHANGE_POLICIES.join(", ")}.`);
  return policy;
}
function normalizePolicyPaths(args, policy) {
  const artifactPaths = domainStringArray(args.artifactPaths, "artifactPaths");
  const finalPlanPaths = domainStringArray(args.finalPlanPaths, "finalPlanPaths");
  const finalResultPaths = domainStringArray(args.finalResultPaths, "finalResultPaths");
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
  const value = {
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    policy,
    inputBoundary: policyInputBoundary(policy),
    artifactPaths: paths.artifactPaths,
    finalPlanPaths: paths.finalPlanPaths,
    finalResultPaths: paths.finalResultPaths,
    reviewedArtifactPaths: paths.reviewedArtifactPaths
  };
  return { value, sha256: domainSha256(`${JSON.stringify(value)}
`) };
}
function reviewPreflight(root, args, operation) {
  const { workspace, mission } = readCurrentMission(root, args.missionId, operation);
  const policy = normalizedPolicy(args.policy);
  const paths = normalizePolicyPaths(args, policy);
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
function newExchangeId(policy) {
  return domainSafeId(`exchange-${policy}-${crypto6.randomUUID()}`, "exchangeId");
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
    authority: { authoritative: false, callerMayMintAuthority: false, reason: "Local preflight is read-only and non-authoritative." }
  };
}
function prepareReviewExchange(root, args = {}) {
  assertSealedDomainArgs(args, PREPARE_FIELDS, "prepare_review_exchange");
  const prepared = reviewPreflight(root, args, "Review exchange preparation");
  if (prepared.policy === "local-preflight") return preflightResult(prepared);
  const exchangeId = newExchangeId(prepared.policy);
  const inputPath = exchangePath(exchangeId, "input.json");
  const manifestPath = exchangePath(exchangeId, "manifest.json");
  const handoffPath = exchangePath(exchangeId, "handoff.json");
  const reportPath = exchangePath(exchangeId, "report.md");
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
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
    artifactPaths: prepared.paths.artifactPaths,
    finalPlanPaths: prepared.paths.finalPlanPaths,
    finalResultPaths: prepared.paths.finalResultPaths,
    reviewedArtifactPaths: prepared.snapshot.reviewedArtifacts.map((item) => item.path),
    reviewedArtifacts: prepared.snapshot.reviewedArtifacts,
    reviewedArtifactSetSha256: prepared.snapshot.reviewedArtifactSetSha256,
    outputContract: {
      handoffPath,
      reportPath,
      requiredHandoffFields: [...HANDOFF_FIELDS]
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
    inputPath,
    inputSha256: domainSha256(inputContent),
    handoffPath,
    reportPath,
    artifactPaths: input.artifactPaths,
    finalPlanPaths: input.finalPlanPaths,
    finalResultPaths: input.finalResultPaths,
    reviewedArtifactPaths: input.reviewedArtifactPaths,
    reviewedArtifacts: input.reviewedArtifacts,
    reviewedArtifactSetSha256: input.reviewedArtifactSetSha256
  };
  const manifestContent = domainJson(manifest);
  const result = finalizeDomainArtifacts(root, {
    actionId: "prepare-review-exchange",
    operation: "Review exchange preparation",
    missionId: prepared.mission.missionId,
    summary: `Prepared ${prepared.policy} review exchange ${exchangeId}.`,
    writes: [
      { path: inputPath, kind: "data", content: inputContent, derivedReferences: input.reviewedArtifactPaths.map((item) => `artifact:${item}`) },
      { path: manifestPath, kind: "data", content: manifestContent, derivedReferences: [`artifact:${inputPath}`] }
    ]
  });
  return {
    ...result,
    schemaVersion: REVIEW_EXCHANGE_SCHEMA_VERSION,
    status: result.status === "planned" ? "prepare-planned" : "prepared",
    exchangeId,
    policy: prepared.policy,
    scopeSha256: prepared.scope.sha256,
    inputPath,
    inputSha256: manifest.inputSha256,
    manifestPath,
    manifestSha256: domainSha256(manifestContent),
    handoffPath,
    reportPath,
    reviewedArtifactPaths: input.reviewedArtifactPaths,
    reviewedArtifactSetSha256: input.reviewedArtifactSetSha256,
    authority: { authoritative: false, callerMayMintAuthority: false }
  };
}
function assertIdentity(value, manifest, mission, workspaceId, label) {
  if (value.schemaVersion !== REVIEW_EXCHANGE_SCHEMA_VERSION) throw new Error(`${label}.schemaVersion must be ${REVIEW_EXCHANGE_SCHEMA_VERSION}.`);
  if (value.workspaceId !== workspaceId || value.workspaceId !== manifest.workspaceId) throw new Error(`${label} workspace binding mismatch.`);
  if (value.missionId !== mission.missionId || value.missionId !== manifest.missionId) throw new Error(`${label} mission binding mismatch.`);
  if (value.contractDigest !== mission.contractDigest || value.contractDigest !== manifest.contractDigest) throw new Error(`${label} contract digest is stale.`);
  if (value.exchangeId !== manifest.exchangeId) throw new Error(`${label} exchangeId mismatch.`);
  if (value.policy !== manifest.policy) throw new Error(`${label} policy binding mismatch.`);
  if (value.scopeSha256 !== manifest.scopeSha256) throw new Error(`${label} scope binding mismatch.`);
}
function same(value, expected) {
  return JSON.stringify(value) === JSON.stringify(expected);
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
    const linkedArtifactPaths = domainStringArray(item.linkedArtifactPaths, `findings[${index}].linkedArtifactPaths`);
    if (linkedArtifactPaths.some((artifactPath) => !reviewed.has(artifactPath))) throw new Error(`findings[${index}] links an artifact outside the frozen review set.`);
    return { findingId, severity, summary: domainNonEmptyText(item.summary, `findings[${index}].summary`), linkedArtifactPaths };
  });
}
function importReviewExchange(root, args = {}) {
  assertSealedDomainArgs(args, IMPORT_FIELDS, "import_review_exchange");
  const { workspace, mission } = readCurrentMission(root, args.missionId, "Review exchange import");
  const exchangeId = domainSafeId(args.exchangeId, "exchangeId");
  const reviewId = domainSafeId(args.reviewId, "reviewId");
  const inputPath = exchangePath(exchangeId, "input.json");
  const manifestPath = exchangePath(exchangeId, "manifest.json");
  const handoffPath = exchangePath(exchangeId, "handoff.json");
  const reportPath = exchangePath(exchangeId, "report.md");
  const reviewPath = importedReviewPath(reviewId);
  const finalReportPath = importedReportPath(reviewId);
  if (fs12.existsSync(path12.resolve(root, reviewPath)) || fs12.existsSync(path12.resolve(root, finalReportPath))) throw new Error(`Review ${reviewId} has already been imported.`);
  const manifestLeaf = currentCanonicalLeaf(root, manifestPath, "Review exchange manifest");
  const manifest = sealed(JSON.parse(manifestLeaf.content.toString("utf8")), MANIFEST_FIELDS2, "Review exchange manifest");
  if (manifest.status !== "prepared") throw new Error(`Review exchange ${exchangeId} is not importable from status ${manifest.status ?? "unknown"}.`);
  if (manifest.exchangeId !== exchangeId) throw new Error("Review exchange manifest exchangeId mismatch.");
  assertIdentity(manifest, manifest, mission, workspace.manifest.workspaceId, "Review exchange manifest");
  if (manifest.inputPath !== inputPath || manifest.handoffPath !== handoffPath || manifest.reportPath !== reportPath) throw new Error("Review exchange manifest contains noncanonical exchange paths.");
  exactHash(manifest.inputSha256, "manifest.inputSha256");
  const inputLeaf = currentCanonicalLeaf(root, inputPath, "Review exchange input");
  const input = sealed(JSON.parse(inputLeaf.content.toString("utf8")), INPUT_FIELDS, "Review exchange input");
  assertIdentity(input, manifest, mission, workspace.manifest.workspaceId, "Review exchange input");
  if (inputLeaf.sha256 !== manifest.inputSha256) throw new Error("Review exchange input hash does not match the prepared manifest.");
  if (input.outputContract?.handoffPath !== handoffPath || input.outputContract?.reportPath !== reportPath) throw new Error("Review exchange input output contract is noncanonical.");
  if (!same(input.outputContract?.requiredHandoffFields, [...HANDOFF_FIELDS])) throw new Error("Review exchange handoff contract drifted.");
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
  const handoffLeaf = currentCanonicalLeaf(root, handoffPath, "Review exchange handoff");
  const reportLeaf = currentCanonicalLeaf(root, reportPath, "Review exchange report");
  const handoff = sealed(JSON.parse(handoffLeaf.content.toString("utf8")), HANDOFF_FIELDS, "Review exchange handoff");
  assertIdentity(handoff, manifest, mission, workspace.manifest.workspaceId, "Review exchange handoff");
  if (handoff.reviewId !== reviewId) throw new Error("Review exchange handoff reviewId mismatch.");
  if (!REVIEW_STATUSES.has(handoff.status)) throw new Error(`Review exchange handoff status is unsupported: ${handoff.status}.`);
  if (!REVIEW_VERDICTS.has(handoff.verdict)) throw new Error(`Review exchange handoff verdict is unsupported: ${handoff.verdict}.`);
  if (handoff.status !== "completed" && handoff.verdict === "coherent") throw new Error("A non-completed review handoff cannot return a coherent verdict.");
  if (handoff.inputPath !== inputPath || handoff.reportPath !== reportPath) throw new Error("Review exchange handoff paths do not match the canonical exchange.");
  if (exactHash(handoff.inputSha256, "handoff.inputSha256") !== inputLeaf.sha256) throw new Error("Review exchange handoff input hash mismatch.");
  if (exactHash(handoff.reportSha256, "handoff.reportSha256") !== reportLeaf.sha256) throw new Error("Review exchange report hash mismatch.");
  if (!same(handoff.reviewedArtifactPaths, manifest.reviewedArtifactPaths)) throw new Error("Review exchange handoff scope drifted from the exact frozen artifact set.");
  const findings = normalizeFindings(handoff.findings, manifest.reviewedArtifactPaths);
  const actionItems = domainStringArray(handoff.actionItems, "Review handoff actionItems");
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
    reviewedAt: exactTimestamp(handoff.reviewedAt, "reviewedAt"),
    reviewedArtifactPaths: manifest.reviewedArtifactPaths,
    reviewedArtifacts: manifestSnapshots.snapshots,
    reviewedArtifactSetSha256: exactSetHash,
    findings,
    actionItems,
    exchange: {
      manifestPath,
      manifestSha256: manifestLeaf.sha256,
      inputPath,
      inputSha256: inputLeaf.sha256,
      handoffPath,
      handoffSha256: handoffLeaf.sha256,
      reportPath,
      reportSha256: reportLeaf.sha256,
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
  const result = finalizeDomainArtifacts(root, {
    actionId: "import-review-exchange",
    operation: "Review exchange import",
    missionId: mission.missionId,
    summary: `Imported non-authoritative review ${reviewId} from exchange ${exchangeId}.`,
    writes: [
      { path: finalReportPath, kind: "report", content: reportLeaf.content, derivedReferences: review.reviewedArtifactPaths.map((item) => `artifact:${item}`) },
      { path: reviewPath, kind: "data", content: domainJson(review), derivedReferences: [`artifact:${finalReportPath}`, ...review.reviewedArtifactPaths.map((item) => `artifact:${item}`)] }
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
  const directory = path12.resolve(root, ".dove/reviews");
  if (!fs12.existsSync(directory)) return [];
  return fs12.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => {
    const reviewPath = path12.posix.join(".dove/reviews", entry.name);
    try {
      const review = sealed(JSON.parse(fs12.readFileSync(path12.resolve(root, reviewPath), "utf8")), IMPORTED_REVIEW_FIELDS, `Imported review ${reviewPath}`);
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
    if (/is not a usable file .*path does not exist|is not a registered schema 7 artifact|has changed since its latest ownership receipt/u.test(message)) {
      return { snapshot: null, failures: [`requested-artifact-unavailable:${message}`] };
    }
    throw error;
  }
}
function normalizeExpectedCoverageSnapshots(value) {
  if (value === void 0) return null;
  const normalized = normalizeReviewSnapshots(value, "expectedSnapshots");
  if (!normalized.ok) throw new Error(normalized.reason);
  return {
    reviewedArtifacts: normalized.snapshots,
    reviewedArtifactSetSha256: stableSnapshotSetHash(normalized.snapshots)
  };
}
function assessImportedReview(root, mission, { reviewPath, review, readFailure }, requestedSnapshot) {
  const failures = [];
  if (readFailure || !review) return { reviewId: null, reviewPath, current: false, authoritative: false, failures: [readFailure ?? "review-unreadable"] };
  if (review.schemaVersion !== REVIEW_EXCHANGE_SCHEMA_VERSION) {
    return { reviewId: review.reviewId ?? null, reviewPath, current: false, authoritative: false, failures: ["review-schema-invalid"] };
  }
  if (review.contractDigest !== mission.contractDigest) failures.push("contract-digest-stale");
  if (!POLICY_SET.has(review.policy) || review.policy === "local-preflight") failures.push("review-policy-invalid");
  const snapshots = normalizeReviewSnapshots(review.reviewedArtifacts, "review.reviewedArtifacts");
  if (!snapshots.ok) failures.push(snapshots.reason);
  const setHash = snapshots.ok ? stableSnapshotSetHash(snapshots.snapshots) : null;
  if (!setHash || review.reviewedArtifactSetSha256 !== setHash || !same(review.reviewedArtifactPaths, snapshots.snapshots.map((item) => item.path))) failures.push("reviewed-artifact-set-hash-mismatch");
  if (snapshots.ok) failures.push(...verifyReviewSnapshotSet(root, snapshots.snapshots, setHash).failures);
  if (requestedSnapshot && (!snapshots.ok || !same(requestedSnapshot.reviewedArtifacts, snapshots.snapshots))) failures.push("requested-artifact-set-not-exactly-covered");
  try {
    const exchange = sealed(review.exchange, EXCHANGE_HASH_FIELDS, `Imported review ${review.reviewId} exchange`);
    for (const [pathField, hashField, label] of [
      ["manifestPath", "manifestSha256", "review manifest"],
      ["inputPath", "inputSha256", "review input"],
      ["handoffPath", "handoffSha256", "review handoff"],
      ["reportPath", "reportSha256", "review report"],
      ["importedReportPath", "importedReportSha256", "imported review report"]
    ]) {
      if (!HASH_PATTERN4.test(String(exchange[hashField] ?? ""))) failures.push(`${hashField}-invalid`);
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
function verifyReviewCoverageInput(root, args, fields, operation) {
  assertSealedDomainArgs(args, fields, operation);
  const { mission } = readCurrentMission(root, args.missionId, "Review coverage verification");
  const requestedPaths = args.artifactPaths === void 0 ? [] : domainStringArray(args.artifactPaths, "artifactPaths");
  const expected = normalizeExpectedCoverageSnapshots(args.expectedSnapshots);
  const requested = expected ? { snapshot: expected, failures: [] } : requestedCoverageSnapshot(root, mission.missionId, requestedPaths);
  const assessments = readImportedReviews(root, mission.missionId).map((item) => assessImportedReview(root, mission, item, requested.snapshot));
  const currentReviews = assessments.filter((item) => item.current);
  const failures = [...requested.failures];
  const exactCoverageRequested = requestedPaths.length > 0 || expected !== null;
  if (currentReviews.length === 0) failures.push(exactCoverageRequested ? "current-exact-review-coverage-missing" : "current-review-coverage-missing");
  if (args.requireAuthoritative === true) failures.push("trusted-review-issuer-missing");
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
function verifyExpectedReviewCoverage(root, args = {}) {
  return verifyReviewCoverageInput(root, args, EXPECTED_COVERAGE_FIELDS, "verify expected review coverage");
}
function verifyReviewCoverage(root, args = {}) {
  return verifyReviewCoverageInput(root, args, COVERAGE_FIELDS, "verify_review_coverage");
}

// src/core/completion-gates.mjs
var HASH_PATTERN5 = /^[0-9a-f]{64}$/u;
var ARTIFACT_KINDS = /* @__PURE__ */ new Set(["report", "document", "code", "data", "figure", "media", "other"]);
var VALIDATION_KINDS = /* @__PURE__ */ new Set(["test-log", "typecheck-log", "lint-log", "build-log", "audit-log", "validation-log", "command-output"]);
var RECEIPT_FIELDS2 = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "receiptId", "missionId", "contractDigest", "summary", "artifacts", "validations", "criteriaSatisfied", "producedAt"]);
var ARTIFACT_FIELDS2 = /* @__PURE__ */ new Set(["path", "kind", "sha256"]);
var VALIDATION_FIELDS2 = /* @__PURE__ */ new Set(["kind", "reference", "outputHash"]);
var CRITERION_FIELDS2 = /* @__PURE__ */ new Set(["criterionId", "evidenceRefs"]);
function missionPath2(missionId) {
  return path13.posix.join(ARTIFACT_PATHS.missionsDir, `${missionId}.json`);
}
function sealed2(value, allowed) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => allowed.has(key));
}
function currentHashedFile(root, relativePath, expectedHash) {
  if (isDoveLessonArtifactPath(relativePath)) {
    return { current: false, reason: "lesson-advisory-only", path: relativePath ?? null, actualHash: null };
  }
  if (typeof relativePath !== "string" || !relativePath.trim() || !HASH_PATTERN5.test(String(expectedHash ?? ""))) {
    return { current: false, reason: "hashed-file-input-invalid", path: relativePath ?? null, actualHash: null };
  }
  const suppliedPath = relativePath.trim().replace(/\\/gu, "/");
  const inspection = inspectDeclaredPath(root, suppliedPath, { requireNonEmpty: true });
  if (inspection.status !== "existing") {
    return { current: false, reason: inspection.reason ?? inspection.status, path: relativePath, actualHash: null };
  }
  const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  if (inspection.normalizedPath !== suppliedPath || canonicalPath !== suppliedPath) {
    return { current: false, reason: "canonical-path-changed", path: suppliedPath, canonicalPath, actualHash: null };
  }
  const actualHash = sha256File(path13.resolve(root, canonicalPath));
  return {
    current: actualHash === expectedHash,
    reason: actualHash === expectedHash ? null : "hash-mismatch",
    path: canonicalPath,
    actualHash
  };
}
function typedEvidenceEligibility(root, missionId, reference) {
  if (reference.startsWith("source:")) {
    const value = reference.slice("source:".length);
    return evaluateSourceReferences(root, [value], missionId)[0] ?? { eligible: false, reason: "unknown-source" };
  }
  if (reference.startsWith("note:")) {
    const value = reference.slice("note:".length);
    return evaluateNoteReferences(root, [value], missionId)[0] ?? { eligible: false, reason: "unknown-note" };
  }
  return { eligible: null, reason: null };
}
function receiptAssessment(root, mission, receipt, workspaceId, missionCurrent = true) {
  const failures = [];
  if (receipt?.__readFailure) failures.push("receipt-json-malformed");
  if (!missionCurrent) failures.push("mission-contract-invalid");
  if (!sealed2(receipt, RECEIPT_FIELDS2) || receipt.schemaVersion !== 1) failures.push("receipt-schema-invalid");
  if (receipt.workspaceId !== workspaceId || mission.workspaceId !== workspaceId) failures.push("workspace-binding-mismatch");
  if (receipt.missionId !== mission.missionId) failures.push("mission-binding-mismatch");
  if (receipt?.contractDigest !== mission.contractDigest || !missionCurrent) failures.push("contract-digest-stale");
  if (!Array.isArray(receipt.artifacts) || receipt.artifacts.length === 0) failures.push("artifacts-missing");
  if (!Array.isArray(receipt.validations)) failures.push("validations-invalid");
  if (!Array.isArray(receipt.criteriaSatisfied)) failures.push("criteria-invalid");
  const artifactAssessments = (Array.isArray(receipt.artifacts) ? receipt.artifacts : []).map((artifact) => {
    if (!sealed2(artifact, ARTIFACT_FIELDS2) || typeof artifact.path !== "string" || !artifact.path.trim() || !ARTIFACT_KINDS.has(artifact.kind) || !HASH_PATTERN5.test(String(artifact.sha256 ?? ""))) {
      return { path: artifact?.path ?? null, current: false, reason: "artifact-schema-invalid" };
    }
    return currentHashedFile(root, artifact.path, artifact.sha256);
  });
  const validationAssessments = (Array.isArray(receipt.validations) ? receipt.validations : []).map((validation) => {
    if (!sealed2(validation, VALIDATION_FIELDS2) || typeof validation.reference !== "string" || !validation.reference.trim() || !VALIDATION_KINDS.has(validation.kind) || !HASH_PATTERN5.test(String(validation.outputHash ?? ""))) {
      return { path: validation?.reference ?? null, current: false, reason: "validation-schema-invalid" };
    }
    return currentHashedFile(root, validation.reference, validation.outputHash);
  });
  if (artifactAssessments.some((item) => !item.current)) failures.push("artifact-drift");
  if (validationAssessments.some((item) => !item.current)) failures.push("validation-drift");
  const artifactPaths = (Array.isArray(receipt.artifacts) ? receipt.artifacts : []).map((artifact) => artifact?.path).filter(Boolean);
  const validationPaths = (Array.isArray(receipt.validations) ? receipt.validations : []).map((validation) => validation?.reference).filter(Boolean);
  if (new Set(artifactPaths).size !== artifactPaths.length) failures.push("artifact-path-duplicate");
  if (new Set(validationPaths).size !== validationPaths.length) failures.push("validation-path-duplicate");
  const requiredArtifactPaths = /* @__PURE__ */ new Set([
    ...Array.isArray(mission.targetArtifacts) ? mission.targetArtifacts : [],
    ...Array.isArray(mission.expectedArtifacts) ? mission.expectedArtifacts : []
  ]);
  if ([...requiredArtifactPaths].some((requiredPath) => !artifactPaths.includes(requiredPath))) {
    failures.push("mission-artifact-coverage-missing");
  }
  const requiredCriteria = missionCompletionCriteria(mission);
  const requiredIds = new Set(requiredCriteria.map((criterion) => criterion.criterionId));
  const artifactRefs = new Set((receipt.artifacts ?? []).map((artifact) => `artifact:${artifact.path}`));
  const validationRefs = new Set((receipt.validations ?? []).map((validation) => `validation:${validation.reference}`));
  const seenCriteria = /* @__PURE__ */ new Set();
  const criteria = (Array.isArray(receipt.criteriaSatisfied) ? receipt.criteriaSatisfied : []).map((criterion) => {
    const criterionFailures = [];
    if (!sealed2(criterion, CRITERION_FIELDS2)) criterionFailures.push("criterion-schema-invalid");
    if (!requiredIds.has(criterion?.criterionId)) criterionFailures.push("criterion-unknown");
    if (seenCriteria.has(criterion?.criterionId)) criterionFailures.push("criterion-duplicate");
    seenCriteria.add(criterion?.criterionId);
    const evidenceRefs = Array.isArray(criterion?.evidenceRefs) ? criterion.evidenceRefs : [];
    if (evidenceRefs.length === 0 || evidenceRefs.some((reference) => typeof reference !== "string" || !reference.trim()) || new Set(evidenceRefs).size !== evidenceRefs.length) criterionFailures.push("criterion-evidence-invalid");
    const evidence = evidenceRefs.map((reference) => {
      if (artifactRefs.has(reference)) {
        const artifactPath = reference.slice("artifact:".length);
        const current = artifactAssessments.find((item) => item.path === artifactPath)?.current === true;
        return { reference, eligible: current, reason: current ? null : "artifact-not-current" };
      }
      if (validationRefs.has(reference)) {
        const validationPath = reference.slice("validation:".length);
        const current = validationAssessments.find((item) => item.path === validationPath)?.current === true;
        return { reference, eligible: current, reason: current ? null : "validation-not-current" };
      }
      const typed = typedEvidenceEligibility(root, mission.missionId, reference);
      return { reference, eligible: typed.eligible === true, reason: typed.reason ?? "unresolved-evidence-reference" };
    });
    if (evidence.some((item) => !item.eligible)) criterionFailures.push("criterion-evidence-stale-or-ineligible");
    return { criterionId: criterion?.criterionId ?? null, evidence, failures: criterionFailures, satisfied: criterionFailures.length === 0 };
  });
  const missingCriteria = requiredCriteria.filter((criterion) => !seenCriteria.has(criterion.criterionId));
  if (missingCriteria.length > 0) failures.push("criteria-coverage-missing");
  if (criteria.some((criterion) => !criterion.satisfied)) failures.push("criteria-evidence-invalid");
  const typedEvidenceStale = criteria.some((criterion) => criterion.failures.includes("criterion-evidence-stale-or-ineligible"));
  return {
    receiptId: receipt.receiptId ?? null,
    current: failures.length === 0,
    stale: typedEvidenceStale || failures.some((failure) => ["mission-contract-invalid", "contract-digest-stale", "artifact-drift", "validation-drift"].includes(failure)),
    failures: [...new Set(failures)],
    artifacts: artifactAssessments,
    validations: validationAssessments,
    criteria,
    missingCriterionIds: missingCriteria.map((criterion) => criterion.criterionId),
    producedAt: receipt.producedAt ?? null
  };
}
function evidenceRequirementAssessment(root, mission, receiptAssessments) {
  const requirements = missionEvidenceRequirements(mission);
  const currentReceipts = receiptAssessments.filter((receipt) => receipt.current);
  const artifactRefs = new Set(currentReceipts.flatMap((receipt) => receipt.artifacts.filter((item) => item.current).map((item) => `artifact:${item.path}`)));
  const validationRefs = new Set(currentReceipts.flatMap((receipt) => receipt.validations.filter((item) => item.current).map((item) => `validation:${item.path}`)));
  return requirements.map(({ requirementId, requirement }) => {
    if (requirement === "review:authoritative") {
      const coverage = verifyReviewCoverage(root, { missionId: mission.missionId, requireAuthoritative: true });
      return { requirementId, requirement, satisfied: coverage.authoritative === true && coverage.failures.length === 0, reason: coverage.authoritative === true && coverage.failures.length === 0 ? null : "authoritative-review-proof-missing" };
    }
    if (requirement.startsWith("source:")) {
      const evaluation = typedEvidenceEligibility(root, mission.missionId, requirement);
      return { requirementId, requirement, satisfied: evaluation.eligible === true, reason: evaluation.eligible === true ? null : evaluation.reason };
    }
    if (requirement.startsWith("note:")) {
      const evaluation = typedEvidenceEligibility(root, mission.missionId, requirement);
      return { requirementId, requirement, satisfied: evaluation.eligible === true, reason: evaluation.eligible === true ? null : evaluation.reason };
    }
    if (requirement.startsWith("artifact:")) {
      return { requirementId, requirement, satisfied: artifactRefs.has(requirement), reason: artifactRefs.has(requirement) ? null : "required-artifact-not-current" };
    }
    if (requirement.startsWith("validation:")) {
      return { requirementId, requirement, satisfied: validationRefs.has(requirement), reason: validationRefs.has(requirement) ? null : "required-validation-not-current" };
    }
    return { requirementId, requirement, satisfied: false, reason: "unsupported-evidence-requirement-syntax" };
  });
}
function assessMissionCompletion(root, args = {}) {
  const workspace = openDoveWorkspace(root, { operation: "Mission completion assessment" });
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("assess_mission_completion arguments must be a plain object.");
  const unknown = Object.keys(args).filter((field) => field !== "missionId");
  if (unknown.length > 0) throw new Error(`assess_mission_completion does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  const missionId = typeof args.missionId === "string" ? args.missionId.trim() : "";
  if (!missionId) throw new Error("assess_mission_completion requires missionId.");
  const relativePath = missionPath2(missionId);
  if (!fs13.existsSync(path13.resolve(root, relativePath))) throw new Error(`Mission does not exist: ${missionId}.`);
  const mission = readJson(root, relativePath, null);
  let missionContractFailure = null;
  try {
    assertCurrentMissionContract(mission);
  } catch (error) {
    missionContractFailure = error instanceof Error ? error.message : String(error);
  }
  const receipts = readExecutionReceipts(root, missionId);
  const receiptAssessments = receipts.map((receipt) => receiptAssessment(root, mission, receipt, workspace.manifest.workspaceId, missionContractFailure === null));
  const requirements = evidenceRequirementAssessment(root, mission, receiptAssessments);
  const currentReceipt = [...receiptAssessments].reverse().find((receipt) => receipt.current) ?? null;
  const incompleteReasons = [];
  if (missionContractFailure) incompleteReasons.push("mission-contract-invalid");
  if (!currentReceipt) incompleteReasons.push(receipts.length === 0 ? "execution-receipt-missing" : "execution-receipts-stale-or-invalid");
  const unmetRequirements = requirements.filter((requirement) => !requirement.satisfied);
  if (unmetRequirements.length > 0) incompleteReasons.push("evidence-requirements-unmet");
  return {
    status: incompleteReasons.length === 0 ? "complete" : "incomplete",
    complete: incompleteReasons.length === 0,
    missionId,
    contractDigest: mission.contractDigest,
    currentReceiptId: currentReceipt?.receiptId ?? null,
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
      artifactOwnershipPath: ARTIFACT_PATHS.artifactOwnership,
      artifactLineagePath: ARTIFACT_PATHS.artifactLineage
    }
  };
}

// src/core/retained-domain-workflows.mjs
import fs14 from "node:fs";
import path14 from "node:path";
var NOTE_FIELDS = /* @__PURE__ */ new Set(["missionId", "noteId", "title", "summary", "quotes", "claims", "openQuestions", "sourceIds", "artifactRefs"]);
var CLAIM_FIELDS = /* @__PURE__ */ new Set(["missionId", "claims"]);
var CLAIM_ITEM_FIELDS = /* @__PURE__ */ new Set(["claimId", "text", "sourceIds", "noteIds", "artifactRefs", "experimentResultIds", "gap"]);
var DRAFT_FIELDS = /* @__PURE__ */ new Set(["missionId", "draftId", "title", "body", "summary", "evidenceRefs", "artifactRefs"]);
var DRAFT_META_FIELDS = /* @__PURE__ */ new Set(["missionId", "draftId", "title", "summary", "evidenceRefs", "artifactRefs"]);
var EXPERIMENT_FIELDS = /* @__PURE__ */ new Set(["missionId", "experimentId", "title", "goal", "hypothesis", "protocol", "successCriteria", "comparisonTargets", "result", "resultEvidenceRefs", "auditFindings", "integrityFlags", "claimId", "bridgeReason"]);
var FIGURE_FIELDS = /* @__PURE__ */ new Set(["missionId", "figureId", "intent", "purpose", "materials", "prompt", "outputPath", "outputSha256", "caption", "qaFindings"]);
var REBUTTAL_FIELDS = /* @__PURE__ */ new Set(["missionId", "issues", "strategy", "responses"]);
var VERSION_FIELDS = /* @__PURE__ */ new Set(["missionId", "versionId", "label", "artifactRefs", "supersedesVersionId", "finalize"]);
var COMPARE_FIELDS = /* @__PURE__ */ new Set(["missionId", "fromVersionId", "toVersionId"]);
function filePath(directory, id, extension = "json") {
  return path14.posix.join(directory, `${id}.${extension}`);
}
function existingBoundRecord(root, relativePath, missionId, label) {
  const current = fs14.existsSync(path14.resolve(root, relativePath)) ? readJson(root, relativePath, null) : null;
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
function upsertNote(root, args = {}) {
  assertSealedDomainArgs(args, NOTE_FIELDS, "upsert_note");
  const { mission } = readCurrentMission(root, args.missionId, "Note workflow");
  const noteId = domainSafeId(args.noteId, "noteId");
  const summary = typeof args.summary === "string" ? args.summary.trim() : "";
  const quotes = domainStringArray(args.quotes, "quotes");
  const claims = domainStringArray(args.claims, "claims");
  const openQuestions = domainStringArray(args.openQuestions, "openQuestions");
  if (!summary && quotes.length === 0 && claims.length === 0 && openQuestions.length === 0) throw new Error("upsert_note requires substantive synthesis content.");
  const sourceIds = domainStringArray(args.sourceIds, "sourceIds");
  if (sourceIds.length > 0) {
    const failures = evaluateSourceReferences(root, sourceIds, mission.missionId).filter((item) => !item.eligible);
    if (failures.length) throw new Error(`upsert_note rejects ineligible sources: ${failures.map((item) => `${item.reference} (${item.reason})`).join(", ")}.`);
  }
  const artifacts = resolveMissionArtifactReferences(root, mission.missionId, args.artifactRefs, "artifactRefs");
  if (sourceIds.length === 0 && artifacts.length === 0) throw new Error("upsert_note requires at least one verified source or current mission artifact reference.");
  const relativePath = filePath(".dove/notes", noteId);
  existingBoundRecord(root, relativePath, mission.missionId, `Note ${noteId}`);
  const note = {
    schemaVersion: 1,
    noteId,
    missionId: mission.missionId,
    title: typeof args.title === "string" && args.title.trim() ? args.title.trim() : noteId,
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
function upsertClaims(root, args = {}) {
  assertSealedDomainArgs(args, CLAIM_FIELDS, "upsert_claims");
  const { mission } = readCurrentMission(root, args.missionId, "Claim workflow");
  if (!Array.isArray(args.claims) || args.claims.length === 0) throw new Error("upsert_claims requires at least one claim.");
  const writes = args.claims.map((item, index) => {
    assertSealedDomainArgs(item, CLAIM_ITEM_FIELDS, `claims[${index}]`);
    const claimId = domainSafeId(item.claimId, `claims[${index}].claimId`);
    const sourceIds = domainStringArray(item.sourceIds, `claims[${index}].sourceIds`);
    const noteIds = domainStringArray(item.noteIds, `claims[${index}].noteIds`);
    const evidenceRefs = normalizeEvidenceRefs(root, mission.missionId, [
      ...sourceIds.map((id) => `source:${id}`),
      ...noteIds.map((id) => `note:${id}`),
      ...domainStringArray(item.artifactRefs, `claims[${index}].artifactRefs`).map((value) => `artifact:${value}`)
    ], `claims[${index}].evidenceRefs`);
    const resultIds = domainStringArray(item.experimentResultIds, `claims[${index}].experimentResultIds`);
    for (const resultId of resultIds) {
      const result = currentBoundRecord(root, filePath(".dove/experiments", `${resultId}.result`), mission.missionId, `Experiment result ${resultId}`);
      const audit = currentBoundRecord(root, filePath(".dove/experiments", `${resultId}.audit`), mission.missionId, `Experiment audit ${resultId}`);
      if (result.audit?.passed !== true || audit.passed !== true || result.audit.auditId !== audit.auditId) throw new Error(`Claim ${claimId} requires an audited mission-bound experiment result: ${resultId}.`);
    }
    if (evidenceRefs.length === 0 && resultIds.length === 0) throw new Error(`Claim ${claimId} requires eligible evidence.`);
    const relativePath = filePath(".dove/claims", claimId);
    existingBoundRecord(root, relativePath, mission.missionId, `Claim ${claimId}`);
    const claim = { schemaVersion: 1, claimId, missionId: mission.missionId, text: domainNonEmptyText(item.text, `claims[${index}].text`), evidenceRefs, experimentResultIds: resultIds, gap: typeof item.gap === "string" && item.gap.trim() ? item.gap.trim() : null, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    return { path: relativePath, kind: "data", content: domainJson(claim), derivedReferences: [...evidenceRefs, ...resultIds.map((id) => `experiment-result:${id}`)] };
  });
  return finalizeDomainArtifacts(root, { actionId: "upsert-claims", missionId: mission.missionId, summary: `Recorded ${writes.length} evidence-backed claim(s).`, completionEligible: false, writes });
}
function draftContent(draft) {
  return `# ${draft.title}

${draft.body}

---
Mission: ${draft.missionId}
Evidence: ${draft.evidenceRefs.join(", ") || "none"}
`;
}
function upsertDraft(root, args = {}) {
  assertSealedDomainArgs(args, DRAFT_FIELDS, "upsert_draft");
  const { mission } = readCurrentMission(root, args.missionId, "Draft workflow");
  const draftId = domainSafeId(args.draftId, "draftId");
  const evidenceRefs = normalizeEvidenceRefs(root, mission.missionId, [...domainStringArray(args.evidenceRefs, "evidenceRefs"), ...domainStringArray(args.artifactRefs, "artifactRefs").map((value) => `artifact:${value}`)]);
  const draft = { schemaVersion: 1, draftId, missionId: mission.missionId, title: typeof args.title === "string" && args.title.trim() ? args.title.trim() : draftId, body: domainNonEmptyText(args.body, "body"), summary: typeof args.summary === "string" && args.summary.trim() ? args.summary.trim() : null, evidenceRefs, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  const relativePath = filePath(".dove/drafts", draftId, "md");
  return { ...finalizeDomainArtifacts(root, { actionId: "upsert-draft", missionId: mission.missionId, summary: `Recorded draft ${draftId}.`, completionEligible: true, writes: [{ path: relativePath, kind: "document", content: draftContent(draft), derivedReferences: evidenceRefs }] }), draft };
}
function upsertDraftMetadata(root, args = {}) {
  assertSealedDomainArgs(args, DRAFT_META_FIELDS, "upsert_draft_metadata");
  const { mission } = readCurrentMission(root, args.missionId, "Draft metadata workflow");
  const draftId = domainSafeId(args.draftId, "draftId");
  const draftPath = filePath(".dove/drafts", draftId, "md");
  resolveMissionArtifactReferences(root, mission.missionId, [draftPath], "draftPath");
  const evidenceRefs = normalizeEvidenceRefs(root, mission.missionId, [...domainStringArray(args.evidenceRefs, "evidenceRefs"), ...domainStringArray(args.artifactRefs, "artifactRefs").map((value) => `artifact:${value}`)]);
  const metadataPath = filePath(".dove/drafts", `${draftId}.metadata`);
  const metadata = { schemaVersion: 1, draftId, missionId: mission.missionId, title: typeof args.title === "string" && args.title.trim() ? args.title.trim() : draftId, summary: typeof args.summary === "string" && args.summary.trim() ? args.summary.trim() : null, evidenceRefs, draftPath, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  return finalizeDomainArtifacts(root, { actionId: "upsert-draft-metadata", missionId: mission.missionId, summary: `Recorded metadata for draft ${draftId}.`, completionEligible: false, writes: [{ path: metadataPath, kind: "data", content: domainJson(metadata), derivedReferences: [`artifact:${draftPath}`, ...evidenceRefs] }] });
}
function runExperienceWorkflow(root, args = {}) {
  assertSealedDomainArgs(args, EXPERIMENT_FIELDS, "run_experience_workflow");
  const { mission } = readCurrentMission(root, args.missionId, "Experiment workflow");
  const experimentId = domainSafeId(args.experimentId, "experimentId");
  const protocol = domainNonEmptyText(args.protocol, "protocol");
  const successCriteria = domainStringArray(args.successCriteria, "successCriteria", { minItems: 1 });
  const plan = { schemaVersion: 1, experimentId, missionId: mission.missionId, title: typeof args.title === "string" && args.title.trim() ? args.title.trim() : experimentId, goal: domainNonEmptyText(args.goal, "goal"), hypothesis: domainNonEmptyText(args.hypothesis, "hypothesis"), protocol, successCriteria, comparisonTargets: domainStringArray(args.comparisonTargets, "comparisonTargets"), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  const writes = [{ path: filePath(".dove/experiments", `${experimentId}.plan`), kind: "data", content: domainJson(plan), derivedReferences: [] }];
  let result = null;
  let audit = null;
  let bridge = null;
  if (args.result !== void 0) {
    const resultEvidenceRefs = normalizeEvidenceRefs(root, mission.missionId, args.resultEvidenceRefs, "resultEvidenceRefs");
    if (resultEvidenceRefs.length === 0) throw new Error("Experiment result requires current mission-bound evidence.");
    result = { schemaVersion: 1, resultId: experimentId, experimentId, missionId: mission.missionId, outcome: domainNonEmptyText(args.result, "result"), evidenceRefs: resultEvidenceRefs, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    writes.push({ path: filePath(".dove/experiments", `${experimentId}.result`), kind: "data", content: domainJson(result), derivedReferences: resultEvidenceRefs });
    const auditFindings = domainStringArray(args.auditFindings, "auditFindings");
    const integrityFlags = domainStringArray(args.integrityFlags, "integrityFlags");
    if (auditFindings.length === 0) throw new Error("Experiment result requires an explicit audit before claim bridging.");
    audit = { schemaVersion: 1, auditId: experimentId, experimentId, resultId: experimentId, missionId: mission.missionId, findings: auditFindings, integrityFlags, passed: integrityFlags.length === 0, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    result.audit = { passed: audit.passed, auditId: audit.auditId };
    writes[writes.length - 1] = { ...writes.at(-1), content: domainJson(result) };
    writes.push({ path: filePath(".dove/experiments", `${experimentId}.audit`), kind: "data", content: domainJson(audit), derivedReferences: [`experiment-result:${experimentId}`] });
    if (args.claimId !== void 0) {
      if (!audit.passed) throw new Error("Experiment result cannot bridge to a claim while integrity flags remain.");
      const claimId = domainSafeId(args.claimId, "claimId");
      currentBoundRecord(root, filePath(".dove/claims", claimId), mission.missionId, `Claim ${claimId}`);
      bridge = { schemaVersion: 1, bridgeId: `${experimentId}-${claimId}`, missionId: mission.missionId, experimentId, resultId: experimentId, auditId: experimentId, claimId, reason: domainNonEmptyText(args.bridgeReason, "bridgeReason"), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      writes.push({ path: filePath(".dove/claims", `${experimentId}-${claimId}.bridge`), kind: "data", content: domainJson(bridge), derivedReferences: [`experiment-result:${experimentId}`, `claim:${claimId}`] });
    }
  } else if (args.auditFindings !== void 0 || args.integrityFlags !== void 0 || args.claimId !== void 0) {
    throw new Error("Experiment audit or claim bridge requires a real result and result evidence.");
  }
  return { ...finalizeDomainArtifacts(root, { actionId: "run-experience-workflow", missionId: mission.missionId, summary: result ? `Recorded experiment ${experimentId} plan, result, and audit.` : `Recorded experiment ${experimentId} protocol.`, completionEligible: Boolean(result && audit?.passed), writes }), plan, result, audit, bridge, hostBoundary: { executesExperiment: false, providerScheduling: false } };
}
function currentOutput(root, outputPath, expectedHash) {
  const canonical = canonicalDomainPath(outputPath, "outputPath");
  if (!fs14.existsSync(path14.resolve(root, canonical))) throw new Error("Figure outputPath does not exist.");
  const actual = domainSha256(fs14.readFileSync(path14.resolve(root, canonical)));
  if (expectedHash && expectedHash !== actual) throw new Error("Figure output hash does not match the imported file.");
  return { path: canonical, sha256: actual };
}
function runFigureWorkflow(root, args = {}) {
  assertSealedDomainArgs(args, FIGURE_FIELDS, "run_figure_workflow");
  const { mission } = readCurrentMission(root, args.missionId, "Figure workflow");
  const figureId = domainSafeId(args.figureId, "figureId");
  const materials = resolveMissionArtifactReferences(root, mission.missionId, args.materials, "materials");
  if (materials.length === 0) throw new Error("Figure workflow requires current mission-bound materials.");
  const prompt = domainNonEmptyText(args.prompt, "prompt");
  const writes = [];
  const plan = { schemaVersion: 1, figureId, missionId: mission.missionId, intent: domainNonEmptyText(args.intent, "intent"), purpose: domainNonEmptyText(args.purpose, "purpose"), materialRefs: materials.map((item) => item.path), prompt, hostBoundary: "provider-execution-outside-dove", updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  writes.push({ path: filePath(".dove/figures", `${figureId}.plan`), kind: "data", content: domainJson(plan), derivedReferences: plan.materialRefs.map((item) => `artifact:${item}`) });
  let imported = null;
  let qa = null;
  if (args.outputPath !== void 0) {
    const output = currentOutput(root, args.outputPath, args.outputSha256);
    const sourceContent = fs14.readFileSync(path14.resolve(root, output.path));
    const extension = path14.extname(output.path).toLowerCase() || ".bin";
    const finalPath = filePath(".dove/figures", `${figureId}.final`, extension.slice(1));
    const caption = domainNonEmptyText(args.caption, "caption");
    const qaFindings = domainStringArray(args.qaFindings, "qaFindings");
    const coverage = verifyExpectedReviewCoverage(root, {
      missionId: mission.missionId,
      expectedSnapshots: [{ path: finalPath, sizeBytes: sourceContent.length, sha256: output.sha256 }],
      requireAuthoritative: true
    });
    imported = { schemaVersion: 1, figureId, missionId: mission.missionId, importedFrom: output.path, finalPath, finalSha256: output.sha256, caption, provenance: { materialRefs: plan.materialRefs, promptSha256: domainSha256(prompt) }, validated: false, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    qa = { schemaVersion: 1, figureId, missionId: mission.missionId, finalPath, finalSha256: output.sha256, findings: qaFindings, reviewCoverage: coverage, status: imported.validated ? "validated" : qaFindings.length ? "needs-fix" : "ready-for-independent-review", updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    writes.push({ path: finalPath, kind: "figure", content: sourceContent, derivedReferences: plan.materialRefs.map((item) => `artifact:${item}`) });
    writes.push({ path: filePath(".dove/figures", `${figureId}.caption`, "md"), kind: "document", content: `${caption}
`, derivedReferences: [`artifact:${finalPath}`] });
    writes.push({ path: filePath(".dove/figures", `${figureId}.provenance`), kind: "data", content: domainJson(imported), derivedReferences: [`artifact:${finalPath}`, ...plan.materialRefs.map((item) => `artifact:${item}`)] });
    writes.push({ path: filePath(".dove/figures", `${figureId}.qa`), kind: "data", content: domainJson(qa), derivedReferences: [`artifact:${finalPath}`] });
  } else if (args.caption !== void 0 || args.qaFindings !== void 0 || args.outputSha256 !== void 0) {
    throw new Error("Figure caption, QA, or hash import requires outputPath.");
  }
  return { ...finalizeDomainArtifacts(root, { actionId: "run-figure-workflow", missionId: mission.missionId, summary: imported ? `Imported figure ${figureId} with provenance and QA.` : `Prepared figure ${figureId} materials and prompt.`, completionEligible: imported?.validated === true, writes }), plan, imported, qa, hostBoundary: { executesProvider: false, acceptsImportedOutput: true } };
}
function normalizeRebuttalIssues(root, args = {}) {
  assertSealedDomainArgs(args, /* @__PURE__ */ new Set(["missionId", "issues"]), "normalize_rebuttal_issues");
  const { mission } = readCurrentMission(root, args.missionId, "Rebuttal issue normalization");
  const issues = normalizeRebuttalIssueItems(root, mission.missionId, args.issues);
  const record = rebuttalIssuesRecord(mission.missionId, issues);
  return finalizeDomainArtifacts(root, { actionId: "normalize-rebuttal-issues", missionId: mission.missionId, summary: `Normalized ${issues.length} rebuttal issue(s).`, completionEligible: false, writes: [{ path: filePath(".dove/rebuttal", `${mission.missionId}.issues`), kind: "data", content: domainJson(record), derivedReferences: issues.flatMap((item) => [...item.findingRefs.map((id) => `finding:${id}`), ...item.evidenceRefs]) }] });
}
function buildRebuttalStrategy(root, args = {}) {
  assertSealedDomainArgs(args, /* @__PURE__ */ new Set(["missionId", "strategy"]), "build_rebuttal_strategy");
  const { mission } = readCurrentMission(root, args.missionId, "Rebuttal strategy");
  const issuesPath = filePath(".dove/rebuttal", `${mission.missionId}.issues`);
  const issues = currentBoundRecord(root, issuesPath, mission.missionId, "Rebuttal issues");
  if (!issues?.issues?.length) throw new Error("build_rebuttal_strategy requires normalized mission-bound issues.");
  const strategy = rebuttalStrategyRecord(mission.missionId, issues.issues, args.strategy);
  return finalizeDomainArtifacts(root, { actionId: "build-rebuttal-strategy", missionId: mission.missionId, summary: "Recorded author-side rebuttal strategy.", completionEligible: false, writes: [{ path: filePath(".dove/rebuttal", `${mission.missionId}.strategy`), kind: "data", content: domainJson(strategy), derivedReferences: [`artifact:${issuesPath}`] }] });
}
function buildRebuttal(root, args = {}) {
  assertSealedDomainArgs(args, REBUTTAL_FIELDS, "build_rebuttal");
  const { mission } = readCurrentMission(root, args.missionId, "Rebuttal workflow");
  const issuesPath = filePath(".dove/rebuttal", `${mission.missionId}.issues`);
  const strategyPath = filePath(".dove/rebuttal", `${mission.missionId}.strategy`);
  const writes = [];
  const issues = args.issues !== void 0 ? rebuttalIssuesRecord(mission.missionId, normalizeRebuttalIssueItems(root, mission.missionId, args.issues)) : currentBoundRecord(root, issuesPath, mission.missionId, "Rebuttal issues");
  if (!issues?.issues?.length) throw new Error("build_rebuttal requires normalized mission-bound issues.");
  if (args.issues !== void 0) {
    writes.push({ path: issuesPath, kind: "data", content: domainJson(issues), derivedReferences: issues.issues.flatMap((item) => [...item.findingRefs.map((id) => `finding:${id}`), ...item.evidenceRefs]) });
  }
  const strategy = args.strategy !== void 0 ? rebuttalStrategyRecord(mission.missionId, issues.issues, args.strategy) : currentBoundRecord(root, strategyPath, mission.missionId, "Rebuttal strategy");
  if (!strategy?.strategy || strategy.missionId !== mission.missionId) throw new Error("build_rebuttal requires an author-side strategy for the requested mission.");
  if (args.strategy !== void 0) {
    writes.push({ path: strategyPath, kind: "data", content: domainJson(strategy), derivedReferences: [`artifact:${issuesPath}`] });
  }
  if (!Array.isArray(args.responses) || args.responses.length === 0) throw new Error("build_rebuttal requires evidence-linked responses.");
  const responses = args.responses.map((item, index) => {
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
function createVersionSnapshot(root, args = {}) {
  assertSealedDomainArgs(args, VERSION_FIELDS, "create_version_snapshot");
  const { mission } = readCurrentMission(root, args.missionId, "Version snapshot");
  const versionId = domainSafeId(args.versionId, "versionId");
  if (fs14.existsSync(path14.resolve(root, versionPath(versionId)))) throw new Error(`Version snapshot id is already occupied: ${versionId}.`);
  const artifacts = resolveMissionArtifactReferences(root, mission.missionId, args.artifactRefs, "artifactRefs");
  if (artifacts.length === 0) throw new Error("create_version_snapshot requires current mission artifacts.");
  const supersedesVersionId = args.supersedesVersionId === void 0 ? null : domainSafeId(args.supersedesVersionId, "supersedesVersionId");
  if (supersedesVersionId) {
    currentBoundRecord(root, versionPath(supersedesVersionId), mission.missionId, `Superseded version ${supersedesVersionId}`);
  }
  const completion = assessMissionCompletion(root, { missionId: mission.missionId });
  const reviewCoverage = verifyReviewCoverage(root, { missionId: mission.missionId, artifactPaths: artifacts.map((item) => item.path), requireAuthoritative: true });
  const finalization = args.finalize === true ? { eligible: completion.complete && reviewCoverage.authoritative === true && reviewCoverage.failures.length === 0, completion, reviewCoverage } : null;
  if (args.finalize === true && !finalization.eligible) throw new Error("Version finalization requires current mission completion and current authoritative review proof.");
  const copiedArtifacts = artifacts.map(({ path: artifactPath, kind, sha256: sha2563, receiptId }) => {
    const extension = path14.extname(artifactPath);
    const snapshotPath = filePath(path14.posix.join(".dove/versions", versionId, "artifacts"), domainSha256(artifactPath).slice(0, 20), extension ? extension.slice(1) : "bin");
    return { path: artifactPath, kind, sha256: sha2563, receiptId, snapshotPath };
  });
  const snapshot = { schemaVersion: 1, versionId, missionId: mission.missionId, label: typeof args.label === "string" && args.label.trim() ? args.label.trim() : versionId, artifacts: copiedArtifacts, supersedesVersionId, finalization, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
  const writes = [
    ...copiedArtifacts.map((item) => ({ path: item.snapshotPath, kind: item.kind, content: fs14.readFileSync(path14.resolve(root, item.path)), derivedReferences: [`artifact:${item.path}`] })),
    { path: versionPath(versionId), kind: "data", content: domainJson(snapshot), derivedReferences: snapshot.artifacts.map((item) => `artifact:${item.path}`) }
  ];
  return finalizeDomainArtifacts(root, { actionId: "create-version-snapshot", missionId: mission.missionId, summary: `Created version snapshot ${versionId}.`, completionEligible: false, writes });
}
function compareVersions(root, args = {}) {
  assertSealedDomainArgs(args, COMPARE_FIELDS, "compare_versions");
  const { mission } = readCurrentMission(root, args.missionId, "Version comparison");
  const fromVersionId = domainSafeId(args.fromVersionId, "fromVersionId");
  const toVersionId = domainSafeId(args.toVersionId, "toVersionId");
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
  return finalizeDomainArtifacts(root, { actionId: "compare-versions", missionId: mission.missionId, summary: `Compared versions ${fromVersionId} and ${toVersionId}.`, completionEligible: false, writes: [{ path: filePath(".dove/versions", `${fromVersionId}--${toVersionId}.comparison`), kind: "data", content: domainJson(comparison), derivedReferences: [`version:${fromVersionId}`, `version:${toVersionId}`] }] });
}
function queryDomainIntegrity(root) {
  const workspace = openDoveWorkspace(root, { operation: "Domain integrity query" });
  const ownership = readArtifactOwnership(root);
  const domainPrefixes = [".dove/sources/", ".dove/notes/", ".dove/claims/", ".dove/experiments/", ".dove/drafts/", ".dove/figures/", ".dove/rebuttal/", ".dove/versions/"];
  const domainArtifacts = ownership.artifacts.filter((item) => domainPrefixes.some((prefix) => item.path.startsWith(prefix)));
  const stale = domainArtifacts.filter((item) => !fs14.existsSync(path14.resolve(root, item.path)) || domainSha256(fs14.readFileSync(path14.resolve(root, item.path))) !== item.sha256);
  return { workspaceId: workspace.manifest.workspaceId, artifactCount: domainArtifacts.length, staleArtifactCount: stale.length, stalePaths: stale.map((item) => item.path) };
}

// src/core/mission-queries.mjs
function wantsFullStatus(args = {}) {
  return args.full === true || args.includeDetails === true || args.includeMissionDetails === true || args.showMissions === true || args.detail === "full" || args.view === "full";
}
function responseLanguage(args = {}) {
  return args.responseLanguage === "en" || args.language === "en" ? "en" : "zh";
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
  const missionsRoot = path15.resolve(root, ARTIFACT_PATHS.missionsDir);
  const missions = fs15.readdirSync(missionsRoot, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => {
    const relativePath = path15.posix.join(ARTIFACT_PATHS.missionsDir, entry.name);
    let mission;
    try {
      mission = JSON.parse(fs15.readFileSync(path15.resolve(root, relativePath), "utf8"));
    } catch (error) {
      throw new Error(`Malformed durable JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    assertCurrentMissionContract(mission);
    return mission;
  }).sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)) || left.missionId.localeCompare(right.missionId));
  return { workspace, missions };
}
function emptyStatus(args, language) {
  const headline = language === "en" ? "Dove is not initialized in this workspace." : "\u5F53\u524D workspace \u5C1A\u672A\u521D\u59CB\u5316 Dove\u3002";
  const result = {
    mode: "dove-status-query",
    query: true,
    proposalOnly: true,
    noAutoApply: true,
    intent: typeof args.intent === "string" ? args.intent.trim() || null : null,
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
  return wantsFullStatus(args) ? { ...result, detail: "full", manifest: null, project: null, missions: [], integrityAssessment: null, domainIntegrity: null, sourceIntegrity: null, reviewValidity: null, diagnostics: { artifactPathsRead: [], noRefresh: true, noCommandExecution: true, noExternalProcess: true, noGitInspection: true, noSourceMutation: true } } : result;
}
function queryDoveStatus(root, args = {}) {
  const language = responseLanguage(args);
  const { workspace, missions } = readCurrentMissions(root, { allowAbsent: true, operation: "Dove status" });
  if (workspace.state === "absent") return emptyStatus(args, language);
  const latestMission = missions.at(-1) ?? null;
  const integrityAssessment = latestMission ? assessMissionCompletion(root, { missionId: latestMission.missionId }) : null;
  const receipts = readExecutionReceipts(root);
  const malformedReceipt = receipts.find((receipt) => receipt.__readFailure);
  if (malformedReceipt) throw new Error(`Malformed durable JSON in ${path15.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${malformedReceipt.receiptId}.json`)}: ${malformedReceipt.__readFailure}`);
  const domainIntegrity = queryDomainIntegrity(root);
  const sourceItems = missions.flatMap((mission) => querySources(root, { missionId: mission.missionId, limit: 200 }).items);
  const sourceIntegrity = {
    sourceCount: sourceItems.length,
    eligibleCount: sourceItems.filter((item) => item.eligibility?.eligible === true).length,
    candidateCount: sourceItems.filter((item) => item.lifecycle === "candidate").length,
    rejectedCount: sourceItems.filter((item) => item.lifecycle === "rejected").length,
    invalidCount: sourceItems.filter((item) => item.eligibility?.eligible !== true && item.lifecycle === "verified").length
  };
  const reviewValidity = latestMission ? verifyReviewCoverage(root, { missionId: latestMission.missionId }) : { covered: false, authoritative: false, failures: ["mission-missing"] };
  const headline = language === "en" ? `Dove schema ${workspace.schemaVersion} is healthy with ${missions.length} mission contract${missions.length === 1 ? "" : "s"}.` : `Dove schema ${workspace.schemaVersion} \u5065\u5EB7\uFF0C\u5F53\u524D\u6709 ${missions.length} \u4E2A mission contract\u3002`;
  const attentionReasons = [
    ...integrityAssessment && !integrityAssessment.complete ? integrityAssessment.incompleteReasons : [],
    ...domainIntegrity.stalePaths ?? [],
    ...sourceIntegrity.invalidCount > 0 ? ["invalid-source-verification"] : []
  ];
  const currentContext = {
    missionCount: missions.length,
    receiptCount: receipts.length,
    sourceCount: sourceIntegrity.sourceCount,
    integrityAssessment: integrityAssessment ? { complete: integrityAssessment.complete, staleReceiptCount: integrityAssessment.staleReceiptIds.length, incompleteReasons: integrityAssessment.incompleteReasons } : null,
    domainIntegrity: compactDomainIntegrity(domainIntegrity),
    reviewValidity: { covered: reviewValidity.covered === true, authoritative: reviewValidity.authoritative === true, failures: reviewValidity.failures ?? [] }
  };
  const result = {
    mode: "dove-status-query",
    query: true,
    proposalOnly: true,
    noAutoApply: true,
    intent: typeof args.intent === "string" ? args.intent.trim() || null : null,
    responseLanguage: language,
    detail: "compact",
    detailsAvailable: true,
    summary: headline,
    headline,
    scope: { kind: "minimal-mission-workspace", schemaVersion: workspace.schemaVersion },
    currentContext,
    nextStep: { label: latestMission ? language === "en" ? "Continue the approved work with native host planning." : "\u7531\u5BBF\u4E3B\u539F\u751F plan \u7EE7\u7EED\u5DF2\u6279\u51C6\u5DE5\u4F5C\u3002" : language === "en" ? "Create one minimal mission contract." : "\u521B\u5EFA\u4E00\u4E2A\u6700\u5C0F mission contract\u3002" },
    needsAttention: attentionReasons.length ? { status: "incomplete", summary: language === "en" ? "Current mission or domain evidence is incomplete." : "\u5F53\u524D mission \u6216\u9886\u57DF\u8BC1\u636E\u5C1A\u4E0D\u5B8C\u6574\u3002", reasons: attentionReasons } : { status: "clear", summary: language === "en" ? "No current mission or domain integrity failure is present." : "\u5F53\u524D\u6CA1\u6709 mission \u6216\u9886\u57DF\u5B8C\u6574\u6027\u5931\u8D25\u3002" },
    changes: { intent: "none", applied: false, count: 0, rollback: "not-applicable" },
    showMore: { detailsAvailable: true },
    optionalMissionDetails: null,
    statusHome: null
  };
  result.statusHome = { presentation: "dove-project-situation-home", detail: result.detail, liveContextFirst: true, intent: result.intent, headline, scope: result.scope, currentContext, nextStep: result.nextStep, needsAttention: result.needsAttention, changes: result.changes, showMore: result.showMore, optionalMissionDetails: null, detailsAvailable: true };
  if (!wantsFullStatus(args)) return result;
  return {
    ...result,
    detail: "full",
    manifest: workspace.manifest,
    project: workspace.project,
    missions,
    integrityAssessment,
    domainIntegrity,
    sourceIntegrity,
    reviewValidity,
    diagnostics: {
      artifactPathsRead: [ARTIFACT_PATHS.doveRootManifest, ARTIFACT_PATHS.projectIdentity, ARTIFACT_PATHS.missionsDir, ARTIFACT_PATHS.executionReceiptsDir, ARTIFACT_PATHS.artifactOwnership, ARTIFACT_PATHS.artifactLineage, ".dove/sources"],
      noRefresh: true,
      noCommandExecution: true,
      noExternalProcess: true,
      noGitInspection: true,
      noSourceMutation: true
    }
  };
}
function queryDoveMission(root, args = {}) {
  const inspection = openDoveWorkspace(root, { allowAbsent: true, operation: "Dove mission preview" });
  if (inspection.state !== "absent") openDoveWorkspace(root, { operation: "Dove mission preview" });
  return previewDoveMissionContract(root, args);
}

// src/core/lessons.mjs
import fs16 from "node:fs";
import path16 from "node:path";
var DOVE_LESSON_SCHEMA_VERSION = 1;
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
var REPLAY_FIELDS = /* @__PURE__ */ new Set([
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
  return path16.posix.join(ARTIFACT_PATHS.lessonsDir, `${lessonId}.json`);
}
function normalizeOptionalText(value, label) {
  if (value === void 0) return void 0;
  return domainNonEmptyText(value, label);
}
function normalizeEnum(value, allowed, label) {
  const normalized = domainNonEmptyText(value, label).toLowerCase();
  if (!allowed.has(normalized)) throw new Error(`${label} must be one of: ${[...allowed].join(", ")}.`);
  return normalized;
}
function normalizeMutationModeForLesson(root, args) {
  const explicit = Object.hasOwn(args, "mutationMode") ? normalizeMutationMode(args.mutationMode) : null;
  const active = currentMutationContext(root)?.mutationMode ?? null;
  if (active && explicit && active !== explicit) {
    throw new Error(`record_dove_lesson mutationMode ${explicit} does not match the active mutation context mode ${active}.`);
  }
  return active ?? explicit ?? "direct-process";
}
function readLessons(root) {
  openDoveWorkspace(root, { operation: "Dove lesson read" });
  const directory = path16.resolve(root, ARTIFACT_PATHS.lessonsDir);
  if (!fs16.existsSync(directory)) return [];
  return fs16.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).sort((left, right) => left.name.localeCompare(right.name)).map((entry) => readJson(root, path16.posix.join(ARTIFACT_PATHS.lessonsDir, entry.name), null));
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
function normalizedRecordInput(args) {
  const content = {
    lessonId: domainSafeId(args.lessonId, "lessonId"),
    missionId: domainSafeId(args.missionId, "missionId"),
    scope: normalizeEnum(args.scope, LESSON_SCOPE_SET, "scope"),
    kind: normalizeEnum(args.kind, LESSON_KIND_SET, "kind"),
    summary: domainNonEmptyText(args.summary, "summary"),
    nextTimeGuidance: domainStringArray(args.nextTimeGuidance, "nextTimeGuidance", { minItems: 1 }),
    sourceIds: domainStringArray(args.sourceIds, "sourceIds"),
    noteIds: domainStringArray(args.noteIds, "noteIds"),
    artifactRefs: domainStringArray(args.artifactRefs, "artifactRefs"),
    appliesToArtifactRefs: domainStringArray(args.appliesToArtifactRefs, "appliesToArtifactRefs"),
    tags: domainStringArray(args.tags, "tags")
  };
  const details = normalizeOptionalText(args.details, "details");
  if (details !== void 0) content.details = details;
  if (args.supersedesLessonId !== void 0) content.supersedesLessonId = domainSafeId(args.supersedesLessonId, "supersedesLessonId");
  return content;
}
function createdAtFor(args) {
  if (args.confirmed !== true) return nowIso();
  const createdAt = domainNonEmptyText(args.createdAt, "createdAt");
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== createdAt) {
    throw new Error("createdAt replay data must be an exact ISO-8601 timestamp.");
  }
  return createdAt;
}
function buildProposal2(root, args) {
  const content = normalizedRecordInput(args);
  const { workspace, mission } = readCurrentMission(root, content.missionId, "Dove lesson proposal");
  const mutationMode = normalizeMutationModeForLesson(root, args);
  if (args.confirmed === true) {
    if (args.workspaceId !== workspace.manifest.workspaceId) throw new Error("Confirmed Dove lesson replay no longer matches the workspace identity.");
    if (args.contractDigest !== mission.contractDigest) throw new Error("Confirmed Dove lesson replay no longer matches the mission contract digest.");
  }
  const relativePath = lessonPath(content.lessonId);
  const context = currentMutationContext(root);
  const occupied = context ? context.fileExists(relativePath) : fs16.existsSync(path16.resolve(root, relativePath));
  if (occupied) throw new Error(`Dove lesson id is already occupied: ${content.lessonId}.`);
  const lessons = readLessons(root);
  const evidenceSnapshots = validateEligibleReferences(root, mission.missionId, content.sourceIds, content.noteIds);
  const artifacts = resolveMissionArtifactReferences(root, mission.missionId, content.artifactRefs, "artifactRefs");
  const applicability = resolveMissionArtifactReferences(root, mission.missionId, content.appliesToArtifactRefs, "appliesToArtifactRefs");
  const supersession = assertSupersession(lessons, content);
  const createdAt = createdAtFor(args);
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
    mutationMode,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    lesson,
    evidenceSnapshots,
    supersession
  };
  const proposalDigest = domainSha256(stableWorkspaceSerialize(envelope));
  const proposalToken = Buffer.from(JSON.stringify({
    version: DOVE_LESSON_PROPOSAL_VERSION,
    proposalWorkspace,
    proposalDigest,
    lessonId: lesson.lessonId
  }), "utf8").toString("base64url");
  return { content, lesson, envelope, proposalDigest, proposalToken, relativePath, mutationMode };
}
function confirmArgsFor2(proposal) {
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
function assertExactReplay2(root, proposal, args) {
  if (!currentMutationContext(root)) throw new Error("Confirmed Dove lesson recording requires an active MutationContext.");
  if (args.proposalVersion !== DOVE_LESSON_PROPOSAL_VERSION) throw new Error("The selected Dove lesson proposal version is unsupported. Request a fresh proposal.");
  const expected = confirmArgsFor2(proposal);
  const supplied = Object.fromEntries(Object.entries(args).filter(([field]) => REPLAY_FIELDS.has(field) || RECORD_FIELDS.has(field)));
  if (stableWorkspaceSerialize(supplied) !== stableWorkspaceSerialize(expected)) {
    throw new Error("The selected Dove lesson proposal no longer matches the exact replay fields, workspace, contract, mutation mode, supersession, or references. Request a fresh proposal.");
  }
}
function mutationMetadata2(proposal, writesApplied, paths = []) {
  return { mutationMode: proposal.mutationMode, writesApplied, paths };
}
function recordDoveLesson(root, args = {}) {
  assertSealedDomainArgs(args, /* @__PURE__ */ new Set([...RECORD_FIELDS, ...REPLAY_FIELDS]), "record_dove_lesson");
  if (args.confirmed !== true) {
    const replayOnly = Object.keys(args).filter((field) => REPLAY_FIELDS.has(field) && field !== "mutationMode");
    if (replayOnly.length > 0) {
      throw new Error(`record_dove_lesson proposal does not accept caller replay fields: ${replayOnly.map((field) => `$.${field}`).join(", ")}.`);
    }
  }
  const proposal = buildProposal2(root, args);
  if (args.confirmed !== true) {
    const confirmArgs2 = confirmArgsFor2(proposal);
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
  assertExactReplay2(root, proposal, args);
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
    const currentHash2 = sha256File(path16.resolve(root, reference.path));
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
function queryDoveLessons(root, args = {}) {
  assertSealedDomainArgs(args, QUERY_FIELDS2, "query_dove_lessons");
  const workspace = openDoveWorkspace(root, { operation: "Dove lesson query" });
  const lessonId = args.lessonId === void 0 ? null : domainSafeId(args.lessonId, "lessonId");
  const missionId = args.missionId === void 0 ? null : domainSafeId(args.missionId, "missionId");
  const scope = args.scope === void 0 ? null : normalizeEnum(args.scope, LESSON_SCOPE_SET, "scope");
  const kind = args.kind === void 0 ? null : normalizeEnum(args.kind, LESSON_KIND_SET, "kind");
  const tags = domainStringArray(args.tags, "tags");
  const artifactRefs = domainStringArray(args.artifactRefs, "artifactRefs");
  if (artifactRefs.length > 0 && !missionId) throw new Error("Artifact-scoped Dove lesson queries require missionId.");
  if (missionId) readCurrentMission(root, missionId, "Dove lesson query");
  const queryArtifacts = artifactRefs.length > 0 ? resolveMissionArtifactReferences(root, missionId, artifactRefs, "artifactRefs") : [];
  const queryArtifactPaths = new Set(queryArtifacts.map((item) => item.path));
  const includeSuperseded = args.includeSuperseded === true;
  const includeUnscoped = args.includeUnscoped === true;
  const limitNumber = args.limit === void 0 ? 50 : Number(args.limit);
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

// src/core/operational-outcome.mjs
var PROPOSAL_STATUSES = /* @__PURE__ */ new Set([
  "needs-confirmation",
  "needs-task-selection"
]);
var CONFIRMED_EXECUTION_FAILURE_STATUSES = /* @__PURE__ */ new Set([
  "awaiting-host-pass",
  "awaiting-host-results",
  "needs-host-results"
]);
var OPERATIONAL_FAILURE_STATUSES = /* @__PURE__ */ new Set([
  "blocked",
  "blocked-boundary",
  "blocked-missing-materials",
  "failed",
  "materialization-failed",
  "missing-required-materials",
  "missing-secret-env",
  "needs-completion-evidence",
  "needs-explicit-progress-step",
  "needs-source-verification",
  "no-op",
  "noop",
  "provider-failed",
  "qa-needs-attention",
  "source-provenance-unverified",
  "step-no-progress",
  "unexpected-step-status",
  "verification-failed",
  "workflow-error-boundary"
]);
function normalizeStatus(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
function isProposalOnlyOutcome(result) {
  if (!result || typeof result !== "object") {
    return false;
  }
  const status = normalizeStatus(result.status ?? result.outcome);
  return result.proposalOnly === true || PROPOSAL_STATUSES.has(status);
}
function isOperationalFailureOutcome(result, { confirmed = false } = {}) {
  if (!result || typeof result !== "object") {
    return false;
  }
  if (!confirmed && isProposalOnlyOutcome(result)) {
    return false;
  }
  const status = normalizeStatus(result.status ?? result.outcome);
  return OPERATIONAL_FAILURE_STATUSES.has(status) || confirmed && CONFIRMED_EXECUTION_FAILURE_STATUSES.has(status);
}

// src/core/config.mjs
import fs17 from "node:fs";
import os from "node:os";
import path17 from "node:path";
var DEFAULT_PROVIDER_IDS = Object.freeze(["openalex", "crossref", "arxiv", "europe-pmc"]);
var DEFAULT_TIMEOUT_MS = 12e3;
var DEFAULT_MAX_RESULTS = 8;
var CREDENTIAL_FIELD = /(?:api[-_]?key|token|secret|password|authorization|bearer|credential|headers?)/iu;
function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function normalizedString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function booleanValue(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (["1", "true", "yes", "on"].includes(value.trim().toLowerCase())) return true;
    if (["0", "false", "no", "off"].includes(value.trim().toLowerCase())) return false;
  }
  return fallback;
}
function boundedInteger(value, fallback, min, max) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, Math.trunc(numeric))) : fallback;
}
function stringArray2(value) {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return [...new Set(items.map(normalizedString).filter(Boolean).map((item) => item.toLowerCase()))];
}
function assertNoCredentials(value, label = "networkSearch") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoCredentials(item, `${label}[${index}]`));
    return;
  }
  if (!plainObject(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (CREDENTIAL_FIELD.test(key)) throw new Error(`Dove networkSearch supports only public no-key providers and must not contain credential field ${label}.${key}.`);
    assertNoCredentials(item, `${label}.${key}`);
  }
}
function providerIds(value, fallback) {
  const values = stringArray2(value);
  return values.length > 0 ? values : [...fallback];
}
function normalizeNetworkSearchConfig(rawConfig = {}) {
  const source = plainObject(rawConfig) ? rawConfig : {};
  assertNoCredentials(source);
  const rawSettings = plainObject(source.providerSettings) ? source.providerSettings : {};
  const providerSettings = {};
  for (const [rawId, rawValue] of Object.entries(rawSettings)) {
    const id = normalizedString(rawId)?.toLowerCase();
    if (!id) continue;
    const item = plainObject(rawValue) ? rawValue : {};
    providerSettings[id] = {
      ...item.enabled === void 0 ? {} : { enabled: booleanValue(item.enabled, true) },
      ...item.timeoutMs === void 0 ? {} : { timeoutMs: boundedInteger(item.timeoutMs, DEFAULT_TIMEOUT_MS, 1e3, 6e4) }
    };
  }
  return {
    enabled: booleanValue(source.enabled, true),
    defaultProviderIds: providerIds(source.defaultProviderIds, DEFAULT_PROVIDER_IDS),
    disabledProviderIds: providerIds(source.disabledProviderIds, []),
    providerSettings,
    timeoutMs: boundedInteger(source.timeoutMs, DEFAULT_TIMEOUT_MS, 1e3, 6e4),
    maxResults: boundedInteger(source.maxResults, DEFAULT_MAX_RESULTS, 1, 50)
  };
}
function configPaths(root, env) {
  const paths = [];
  const xdg = normalizedString(env.XDG_CONFIG_HOME) ?? path17.join(os.homedir(), ".config");
  paths.push(path17.join(xdg, "dove", "config.json"));
  if (root) {
    paths.push(path17.resolve(root, ".dove", "config.json"));
    paths.push(path17.resolve(root, ".dove", "config.local.json"));
  }
  return paths;
}
function readConfig(filePath2) {
  if (!fs17.existsSync(filePath2)) return null;
  try {
    const value = JSON.parse(fs17.readFileSync(filePath2, "utf8"));
    if (!plainObject(value)) throw new Error("top level must be an object");
    return value;
  } catch (error) {
    throw new Error(`Failed to read Dove config ${filePath2}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function merge(left, right) {
  const output = { ...left };
  for (const [key, value] of Object.entries(right ?? {})) {
    output[key] = plainObject(output[key]) && plainObject(value) ? merge(output[key], value) : structuredClone(value);
  }
  return output;
}
function loadDoveConfig(root, env = process.env) {
  let source = {};
  for (const filePath2 of configPaths(root, env)) {
    const value = readConfig(filePath2);
    if (value) source = merge(source, value);
  }
  const environmentLanguage = normalizedString(env.DOVE_LANGUAGE ?? env.DOVE_RESPONSE_LANGUAGE);
  return {
    version: 1,
    language: normalizeDoveResponseLanguage(environmentLanguage ?? source.language ?? source.responseLanguage, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true }),
    networkSearch: normalizeNetworkSearchConfig(source.networkSearch)
  };
}
function loadNetworkSearchConfig(root, env = process.env) {
  return loadDoveConfig(root, env).networkSearch;
}
function loadExplicitDoveLanguageConfig(root, env = process.env) {
  let language = null;
  for (const filePath2 of configPaths(root, env)) {
    const value = readConfig(filePath2);
    if (value && (value.language !== void 0 || value.responseLanguage !== void 0)) language = value.language ?? value.responseLanguage;
  }
  language = normalizedString(env.DOVE_LANGUAGE ?? env.DOVE_RESPONSE_LANGUAGE) ?? language;
  return language ? normalizeDoveResponseLanguage(language, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true }) : null;
}
function loadDoveLanguageConfig(root, env = process.env) {
  return loadDoveConfig(root, env).language;
}

// src/core/network-search.mjs
var DEFAULT_KIND = "scholarly";
var SEARCH_KINDS = /* @__PURE__ */ new Set(["scholarly", "web", "all"]);
var DEFAULT_LIMIT = 8;
var MAX_LIMIT = 50;
var DEFAULT_TIMEOUT_MS2 = 12e3;
var MAX_QUERY_CHARS = 500;
var POST_FILTER_OVERFETCH_FACTOR = 3;
var SECRET_VALUE_PATTERN = /\b(?:Bearer\s+[A-Za-z0-9._~+/=-]+|sk-[A-Za-z0-9_-]{12,}|(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,}]+)\b/giu;
var NETWORK_SEARCH_PROVIDER_REGISTRY = Object.freeze([
  Object.freeze({ id: "openalex", kind: "scholarly", access: "public", defaultLimit: 5, maxLimit: 25, capabilities: ["works", "doi", "open-access", "authors", "year"], filters: Object.freeze({ year: "native", domains: "post", fieldsOfStudy: "post", openAccessOnly: "post", locale: "post" }) }),
  Object.freeze({ id: "crossref", kind: "scholarly", access: "public", defaultLimit: 5, maxLimit: 20, capabilities: ["works", "doi", "open-access", "authors", "year"], filters: Object.freeze({ year: "native", domains: "post", openAccessOnly: "post", locale: "post" }) }),
  Object.freeze({ id: "arxiv", kind: "scholarly", access: "public", defaultLimit: 5, maxLimit: 20, capabilities: ["preprints", "arxiv-id", "authors", "year"], filters: Object.freeze({ year: "post", domains: "post", openAccessOnly: "post" }) }),
  Object.freeze({ id: "europe-pmc", kind: "scholarly", access: "public", defaultLimit: 5, maxLimit: 25, capabilities: ["papers", "doi", "pubmed-id", "open-access", "authors", "year"], filters: Object.freeze({ year: "post", domains: "post", openAccessOnly: "post", locale: "post" }) }),
  Object.freeze({ id: "public-web", kind: "web", access: "public", defaultLimit: 0, maxLimit: 0, unavailable: true, capabilities: ["status"], filters: Object.freeze({}) })
]);
var DEFAULT_NETWORK_SEARCH_PROVIDER_IDS = Object.freeze(["openalex", "crossref", "arxiv", "europe-pmc"]);
var PROVIDER_BY_ID = new Map(NETWORK_SEARCH_PROVIDER_REGISTRY.map((provider) => [provider.id, provider]));
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function normalizeString2(value, fallback = null) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}
function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}
function normalizePositiveInteger(value, fallback, min, max) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}
function normalizeStringArray2(value) {
  const rawItems = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return Array.from(new Set(rawItems.map((item) => normalizeString2(item)).filter(Boolean)));
}
function normalizeProviderId(value) {
  return normalizeString2(value)?.toLowerCase() ?? null;
}
function normalizeProviderIds(value) {
  const ids = normalizeStringArray2(value).map(normalizeProviderId).filter(Boolean);
  for (const id of ids) {
    if (!PROVIDER_BY_ID.has(id)) {
      throw new Error(`Unsupported Dove network search provider: ${id}`);
    }
  }
  return ids;
}
function normalizeDomains(value) {
  const domains = normalizeStringArray2(value).map((domain) => domain.toLowerCase());
  for (const domain of domains) {
    if (domain.includes("://") || domain.includes("/") || domain.length > 253 || !/^[a-z0-9.-]+$/iu.test(domain)) {
      throw new Error(`Dove network search domain filters must be bare hostnames: ${domain}`);
    }
  }
  return domains;
}
function normalizeYear(value) {
  const text = typeof value === "number" ? String(Math.trunc(value)) : normalizeString2(value);
  if (!text) {
    return null;
  }
  if (!/^\d{4}(?:-\d{4})?$/u.test(text)) {
    throw new Error("Dove network search year must be YYYY or YYYY-YYYY.");
  }
  return text;
}
function normalizeLocale(value) {
  const locale = normalizeString2(value);
  if (!locale) {
    return null;
  }
  if (!/^[a-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?$/iu.test(locale)) {
    throw new Error(`Dove network search locale must be a compact locale code: ${locale}`);
  }
  return locale.replace("_", "-").toLowerCase();
}
function normalizeNetworkSearchConfigForCore(config = {}) {
  const source = isPlainObject(config) ? config : {};
  return {
    enabled: normalizeBoolean(source.enabled, true),
    defaultProviderIds: normalizeProviderIds(source.defaultProviderIds ?? source.defaultProviders ?? DEFAULT_NETWORK_SEARCH_PROVIDER_IDS),
    disabledProviderIds: normalizeProviderIds(source.disabledProviderIds ?? source.disabledProviders ?? []),
    providerSettings: isPlainObject(source.providerSettings) ? source.providerSettings : {},
    timeoutMs: normalizePositiveInteger(source.timeoutMs, DEFAULT_TIMEOUT_MS2, 1e3, 6e4),
    maxResults: normalizePositiveInteger(source.maxResults ?? source.limit, DEFAULT_LIMIT, 1, MAX_LIMIT)
  };
}
function normalizeNetworkSearchQuery(rawArgs = {}, config = {}) {
  const args = isPlainObject(rawArgs) ? rawArgs : {};
  const normalizedConfig = normalizeNetworkSearchConfigForCore(config);
  const query = normalizeString2(args.query);
  if (!query) {
    throw new Error("Dove network search requires a non-empty query.");
  }
  if (query.length > MAX_QUERY_CHARS) {
    throw new Error(`Dove network search query must be ${MAX_QUERY_CHARS} characters or fewer.`);
  }
  const kind = normalizeString2(args.kind, DEFAULT_KIND).toLowerCase();
  if (!SEARCH_KINDS.has(kind)) {
    throw new Error(`Dove network search kind must be one of: ${Array.from(SEARCH_KINDS).join(", ")}.`);
  }
  return {
    query,
    kind,
    limit: normalizePositiveInteger(args.limit ?? args.maxResults, normalizedConfig.maxResults, 1, Math.min(MAX_LIMIT, normalizedConfig.maxResults || MAX_LIMIT)),
    year: normalizeYear(args.year),
    domains: normalizeDomains(args.domains),
    fieldsOfStudy: normalizeStringArray2(args.fieldsOfStudy),
    openAccessOnly: normalizeBoolean(args.openAccessOnly, false),
    providerIds: normalizeProviderIds(args.providerIds ?? args.providers),
    locale: normalizeLocale(args.locale)
  };
}
function redactSensitiveText(value) {
  const text = String(value ?? "");
  return text.replace(SECRET_VALUE_PATTERN, "[REDACTED]");
}
function sanitizeError(error) {
  return redactSensitiveText(error instanceof Error ? error.message : String(error)).slice(0, 500);
}
function safeUrl(value) {
  const text = normalizeString2(value);
  if (!text) {
    return null;
  }
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
function hostnameFromUrl(value) {
  const url = safeUrl(value);
  return url ? new URL(url).hostname.toLowerCase() : null;
}
function doiUrl(doi) {
  const normalized = normalizeDoi2(doi);
  return normalized ? `https://doi.org/${normalized}` : null;
}
function normalizeDoi2(value) {
  const text = normalizeString2(value)?.replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, "") ?? null;
  if (!text) {
    return null;
  }
  const cleaned = text.trim().toLowerCase();
  return cleaned.startsWith("10.") ? cleaned : null;
}
function normalizeTitle(value) {
  return normalizeString2(Array.isArray(value) ? value[0] : value);
}
function normalizeAuthors(value) {
  if (isPlainObject(value)) {
    return normalizeAuthors(value.author ?? value.authors ?? value.fullName ?? value.name);
  }
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") {
        return normalizeString2(item);
      }
      if (isPlainObject(item)) {
        return normalizeString2(item.fullName ?? item.name ?? item.display_name ?? [item.given, item.family].filter(Boolean).join(" "));
      }
      return null;
    }).filter(Boolean).slice(0, 12);
  }
  const text = normalizeString2(value);
  return text ? text.split(/\s*[,;]\s*/u).map((item) => normalizeString2(item)).filter(Boolean).slice(0, 12) : [];
}
function normalizePublishedAt(year, dateParts) {
  const textYear = typeof year === "number" ? String(year) : normalizeString2(year);
  if (textYear && /^\d{4}/u.test(textYear)) {
    return textYear.slice(0, 10);
  }
  const parts = Array.isArray(dateParts?.[0]) ? dateParts[0] : Array.isArray(dateParts) ? dateParts : null;
  if (!parts?.[0]) {
    return null;
  }
  return parts.slice(0, 3).map((part) => String(part).padStart(2, "0")).join("-");
}
function cleanSnippet(value) {
  const text = normalizeString2(value);
  if (!text) {
    return null;
  }
  return text.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 600);
}
function decodeXml(value) {
  return String(value ?? "").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&amp;/gu, "&").replace(/&quot;/gu, '"').replace(/&#39;/gu, "'").replace(/\s+/gu, " ").trim();
}
function extractXmlText(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "iu"));
  return match ? decodeXml(match[1]) : null;
}
function abstractFromInvertedIndex(index) {
  if (!isPlainObject(index)) {
    return null;
  }
  const pairs = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) {
      continue;
    }
    for (const position of positions) {
      if (Number.isInteger(position)) {
        pairs[position] = word;
      }
    }
  }
  return pairs.filter(Boolean).join(" ") || null;
}
function buildParams(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === void 0 || value === "") {
      continue;
    }
    params.set(key, String(value));
  }
  return params;
}
async function fetchText(url, { timeoutMs, fetchFn, headers = {} }) {
  if (typeof fetchFn !== "function") {
    throw new Error("No fetch implementation is available for Dove network search.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent": "DoveNetworkSearch/1.0",
        ...headers
      }
    });
    if (!response?.ok) {
      throw new Error(`HTTP ${response?.status ?? "error"} from ${new URL(url).hostname}`);
    }
    return await response.text();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
async function fetchJson(url, options) {
  const text = await fetchText(url, options);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON response: ${sanitizeError(error)}`);
  }
}
var FILTER_NAMES = Object.freeze(["year", "domains", "fieldsOfStudy", "openAccessOnly", "locale"]);
var PROVIDER_FILTER_SUPPORT = Object.freeze(Object.fromEntries(NETWORK_SEARCH_PROVIDER_REGISTRY.map((provider) => [
  provider.id,
  Object.freeze(Object.fromEntries(FILTER_NAMES.filter((name) => provider.filters?.[name]).map((name) => [name, provider.filters[name]])))
])));
function requestedFilterNames(query) {
  return FILTER_NAMES.filter((name) => name === "openAccessOnly" ? query.openAccessOnly : Array.isArray(query[name]) ? query[name].length > 0 : Boolean(query[name]));
}
function providerFilterPlan(provider, query) {
  const support = PROVIDER_FILTER_SUPPORT[provider.id] ?? {};
  const requested = requestedFilterNames(query);
  return {
    appliedFilters: requested.filter((name) => Boolean(support[name])),
    unsupportedFilters: requested.filter((name) => !support[name]),
    filterModes: Object.fromEntries(requested.filter((name) => Boolean(support[name])).map((name) => [name, support[name]]))
  };
}
function normalizeComparableText(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
function normalizedLocaleBase(value) {
  return normalizeString2(value)?.toLowerCase().replace("_", "-").split("-")[0] ?? null;
}
function candidateMatchesDomain(candidate, domains) {
  const candidateDomains = normalizeStringArray2(candidate.domains).map((domain) => domain.toLowerCase());
  return domains.some((requested) => candidateDomains.some((candidateDomain) => candidateDomain === requested || candidateDomain.endsWith(`.${requested}`)));
}
function candidateMatchesFields(candidate, fieldsOfStudy) {
  const candidateFields = normalizeStringArray2(candidate.fieldsOfStudy).map(normalizeComparableText).filter(Boolean);
  return fieldsOfStudy.some((requested) => {
    const normalized = normalizeComparableText(requested);
    return candidateFields.some((candidateField) => candidateField === normalized || candidateField.includes(normalized) || normalized.includes(candidateField));
  });
}
function postFilterCandidates(candidates, query, filterPlan) {
  const postFilters = new Set(Object.entries(filterPlan.filterModes).filter(([, mode]) => mode === "post").map(([name]) => name));
  return candidates.filter((candidate) => {
    if (postFilters.has("openAccessOnly") && candidate.openAccess !== true) {
      return false;
    }
    if (postFilters.has("year")) {
      const candidateYear = normalizeString2(candidate.publishedAt)?.slice(0, 4);
      if (!candidateYear) {
        return false;
      }
      const [start, end] = query.year.split("-").map((item) => Number(item));
      const year = Number(candidateYear);
      if (year < start || year > (end || start)) {
        return false;
      }
    }
    if (postFilters.has("domains") && !candidateMatchesDomain(candidate, query.domains)) {
      return false;
    }
    if (postFilters.has("fieldsOfStudy") && !candidateMatchesFields(candidate, query.fieldsOfStudy)) {
      return false;
    }
    if (postFilters.has("locale") && normalizedLocaleBase(candidate.locale) !== normalizedLocaleBase(query.locale)) {
      return false;
    }
    return true;
  });
}
function normalizeCandidate(candidate, provider) {
  const title = normalizeTitle(candidate.title);
  if (!title) {
    return null;
  }
  const doi = normalizeDoi2(candidate.doi);
  const url = safeUrl(candidate.url) ?? doiUrl(doi);
  const candidateDomains = normalizeStringArray2(candidate.domains).map((domain) => domain.toLowerCase());
  const urlHostname = hostnameFromUrl(url);
  if (urlHostname) {
    candidateDomains.push(urlHostname);
  }
  if (!url && !doi && !candidate.arxivId && !candidate.pubmedId && !candidate.semanticScholarId) {
    return null;
  }
  return {
    lifecycle: "candidate",
    title,
    url,
    snippet: cleanSnippet(candidate.snippet),
    sourceName: normalizeString2(candidate.sourceName, provider.id),
    publishedAt: normalizeString2(candidate.publishedAt),
    authors: normalizeAuthors(candidate.authors),
    domains: Array.from(new Set(candidateDomains)),
    fieldsOfStudy: normalizeStringArray2(candidate.fieldsOfStudy),
    locale: normalizedLocaleBase(candidate.locale),
    doi,
    arxivId: normalizeString2(candidate.arxivId),
    pubmedId: normalizeString2(candidate.pubmedId),
    semanticScholarId: normalizeString2(candidate.semanticScholarId),
    openAccess: candidate.openAccess === true ? true : candidate.openAccess === false ? false : null,
    providerId: provider.id,
    provenance: {
      providerId: provider.id,
      providerName: provider.id,
      access: provider.access,
      retrievedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    score: Number.isFinite(candidate.score) ? candidate.score : 0,
    warnings: normalizeStringArray2(candidate.warnings)
  };
}
function canonicalUrlKey(value) {
  const url = safeUrl(value);
  if (!url) {
    return null;
  }
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  return parsed.toString().replace(/\/$/u, "").toLowerCase();
}
function titleKey(value) {
  return normalizeString2(value)?.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() ?? null;
}
function dedupeKey(candidate) {
  if (candidate.doi) {
    return `doi:${candidate.doi}`;
  }
  if (candidate.arxivId) {
    return `arxiv:${candidate.arxivId.toLowerCase()}`;
  }
  if (candidate.pubmedId) {
    return `pmid:${candidate.pubmedId}`;
  }
  const url = canonicalUrlKey(candidate.url);
  if (url) {
    return `url:${url}`;
  }
  const title = titleKey(candidate.title);
  return title ? `title:${title}` : null;
}
function textTokens(value) {
  return Array.from(new Set(normalizeComparableText(value).split(/\s+/u).filter(Boolean)));
}
function tokenOverlapScore(value, queryTokens) {
  if (queryTokens.length === 0) {
    return 0;
  }
  const tokens = new Set(textTokens(value));
  return queryTokens.filter((token) => tokens.has(token)).length / queryTokens.length;
}
function publicationRecencyScore(publishedAt) {
  const year = Number(normalizeString2(publishedAt)?.slice(0, 4));
  if (!Number.isInteger(year)) {
    return 0;
  }
  const age = Math.max(0, (/* @__PURE__ */ new Date()).getUTCFullYear() - year);
  return Math.max(0, 10 - age * 0.75);
}
function scoreCandidate(candidate, query) {
  const normalizedQuery = normalizeComparableText(query.query);
  const normalizedTitle = normalizeComparableText(candidate.title);
  const queryTokens = textTokens(query.query);
  const titleOverlap = tokenOverlapScore(candidate.title, queryTokens);
  const snippetOverlap = tokenOverlapScore(candidate.snippet, queryTokens);
  const fieldOverlap = Math.max(0, ...candidate.fieldsOfStudy.map((field) => tokenOverlapScore(field, queryTokens)));
  const authority = Math.min(8, Math.max(0, Number.isFinite(candidate.score) ? candidate.score : 0));
  let score = authority;
  if (normalizedTitle === normalizedQuery) {
    score += 70;
  } else if (normalizedQuery && normalizedTitle.includes(normalizedQuery)) {
    score += 52;
  }
  score += titleOverlap * 42;
  score += snippetOverlap * 20;
  score += fieldOverlap * 16;
  score += publicationRecencyScore(candidate.publishedAt);
  if (candidate.doi || candidate.arxivId || candidate.pubmedId || candidate.semanticScholarId) {
    score += 2;
  }
  if (candidate.url) {
    score += 1;
  }
  if (candidate.openAccess === true) {
    score += 0.5;
  }
  return score;
}
function dedupeAndRank(candidates, query) {
  const byKey = /* @__PURE__ */ new Map();
  for (const candidate of candidates) {
    const key = dedupeKey(candidate);
    if (!key) {
      continue;
    }
    const scored = { ...candidate, score: scoreCandidate(candidate, query) };
    const existing = byKey.get(key);
    if (!existing || scored.score > existing.score) {
      byKey.set(key, {
        ...scored,
        provenance: {
          ...scored.provenance,
          mergedProviderIds: Array.from(new Set([...existing?.provenance?.mergedProviderIds ?? [], existing?.providerId, scored.providerId].filter(Boolean)))
        }
      });
    } else if (existing) {
      existing.provenance.mergedProviderIds = Array.from(new Set([...existing.provenance?.mergedProviderIds ?? [], scored.providerId].filter(Boolean)));
    }
  }
  return Array.from(byKey.values()).sort((left, right) => right.score - left.score || (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "")).slice(0, query.limit);
}
function selectedProviderIds(query, config) {
  if (query.providerIds.length > 0) {
    const conflicts = query.providerIds.filter((id) => !providerVisibleForKind(PROVIDER_BY_ID.get(id), query.kind));
    if (conflicts.length > 0) {
      throw new Error(`Dove network search provider-kind conflict: ${conflicts.join(", ")} cannot be used for kind ${query.kind}.`);
    }
    return query.providerIds;
  }
  if (query.kind === "web") {
    return ["public-web"];
  }
  if (query.kind === "all") {
    return Array.from(/* @__PURE__ */ new Set([...config.defaultProviderIds, "public-web"]));
  }
  return config.defaultProviderIds.filter((id) => PROVIDER_BY_ID.get(id)?.kind === "scholarly");
}
function providerVisibleForKind(provider, kind) {
  return Boolean(provider) && (kind === "all" || provider.kind === kind);
}
function providerReport(provider, fields = {}) {
  return {
    providerId: provider.id,
    kind: provider.kind,
    access: provider.access,
    status: fields.status ?? "available",
    resultCount: fields.resultCount ?? 0,
    fetchedCount: fields.fetchedCount ?? 0,
    message: fields.message ?? null,
    error: fields.error ?? null,
    appliedFilters: fields.appliedFilters ?? [],
    unsupportedFilters: fields.unsupportedFilters ?? [],
    filterModes: fields.filterModes ?? {},
    capabilities: provider.capabilities
  };
}
function publicWebUnavailableReport() {
  const provider = PROVIDER_BY_ID.get("public-web");
  return providerReport(provider, {
    status: "unavailable",
    message: "Dove \u8FD8\u6CA1\u6709\u5185\u7F6E\u7A33\u5B9A\u7684\u514D key \u901A\u7528\u7F51\u9875\u641C\u7D22 provider\uFF1B\u8BF7\u5148\u7528\u5BBF\u4E3B\u516C\u5F00\u641C\u7D22\u6838\u5B9E\u7F51\u9875\uFF0C\u518D\u628A\u9A8C\u8BC1\u8FC7\u7684\u6765\u6E90\u767B\u8BB0\u4E3A source \u6216 note\u3002"
  });
}
async function withTimeout(operation, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function runProvider(provider, query, config, fetchFn) {
  if (provider.unavailable) {
    return {
      candidates: [],
      report: { ...publicWebUnavailableReport(), unsupportedFilters: requestedFilterNames(query) }
    };
  }
  const limit = Math.min(query.limit, provider.maxLimit || query.limit);
  const timeoutMs = normalizePositiveInteger(config.providerSettings?.[provider.id]?.timeoutMs, config.timeoutMs, 1e3, 6e4);
  const filterPlan = providerFilterPlan(provider, query);
  const needsPostFilter = Object.values(filterPlan.filterModes).includes("post");
  const fetchLimit = needsPostFilter ? Math.min(provider.maxLimit || limit, Math.max(limit, limit * POST_FILTER_OVERFETCH_FACTOR)) : limit;
  const providerQuery = { ...query, limit: fetchLimit };
  try {
    const rawCandidates = await withTimeout(Promise.resolve().then(() => PROVIDER_ADAPTERS[provider.id](providerQuery, { timeoutMs, fetchFn })), timeoutMs);
    const candidates = postFilterCandidates(rawCandidates.map((candidate) => normalizeCandidate(candidate, provider)).filter(Boolean), query, filterPlan).slice(0, limit);
    return {
      candidates,
      report: providerReport(provider, { status: "ok", resultCount: candidates.length, fetchedCount: rawCandidates.length, ...filterPlan })
    };
  } catch (error) {
    return {
      candidates: [],
      report: providerReport(provider, { status: "error", error: sanitizeError(error), message: "Provider search failed.", ...filterPlan })
    };
  }
}
async function searchOpenAlex(query, options) {
  const params = buildParams({
    search: query.query,
    "per-page": query.limit,
    select: "id,doi,title,display_name,publication_year,authorships,open_access,primary_location,locations,primary_topic,topics,language,cited_by_count,abstract_inverted_index"
  });
  if (query.year && !query.year.includes("-")) {
    params.set("filter", `from_publication_date:${query.year}-01-01,to_publication_date:${query.year}-12-31`);
  } else if (query.year) {
    const [start, end] = query.year.split("-");
    params.set("filter", `from_publication_date:${start}-01-01,to_publication_date:${end}-12-31`);
  }
  const json = await fetchJson(`https://api.openalex.org/works?${params.toString()}`, options);
  return Array.isArray(json.results) ? json.results.map((item) => ({
    title: item.title ?? item.display_name,
    url: item.doi ?? item.primary_location?.landing_page_url ?? item.id,
    snippet: abstractFromInvertedIndex(item.abstract_inverted_index) ?? item.primary_location?.source?.display_name,
    sourceName: item.primary_location?.source?.display_name ?? "OpenAlex",
    publishedAt: normalizePublishedAt(item.publication_year),
    authors: Array.isArray(item.authorships) ? item.authorships.map((authorship) => authorship.author?.display_name).filter(Boolean) : [],
    domains: Array.from(new Set([item.primary_location, ...Array.isArray(item.locations) ? item.locations : []].flatMap((location) => [hostnameFromUrl(location?.landing_page_url), hostnameFromUrl(location?.pdf_url)]).filter(Boolean))),
    fieldsOfStudy: Array.from(new Set([item.primary_topic?.display_name, ...Array.isArray(item.topics) ? item.topics.map((topic) => topic?.display_name) : []].filter(Boolean))),
    locale: item.language,
    doi: item.doi,
    openAccess: item.open_access?.is_oa === true,
    score: Number(item.cited_by_count ?? 0) > 0 ? Math.log10(Number(item.cited_by_count) + 1) : 0
  })) : [];
}
function crossrefOpenAccess(item) {
  const links = Array.isArray(item.link) ? item.link : [];
  if (links.some((link) => /^https?:/iu.test(link?.URL ?? "") && /(?:application\/pdf|text\/html)/iu.test(link?.["content-type"] ?? ""))) {
    return true;
  }
  return item.license ? Array.isArray(item.license) ? item.license.length > 0 : true : null;
}
async function searchCrossref(query, options) {
  const params = buildParams({ query: query.query, rows: query.limit, select: "DOI,title,URL,link,license,author,published,published-print,published-online,container-title,abstract,language,is-referenced-by-count" });
  if (query.year && !query.year.includes("-")) {
    params.set("filter", `from-pub-date:${query.year}-01-01,until-pub-date:${query.year}-12-31`);
  } else if (query.year) {
    const [start, end] = query.year.split("-");
    params.set("filter", `from-pub-date:${start}-01-01,until-pub-date:${end}-12-31`);
  }
  const json = await fetchJson(`https://api.crossref.org/works?${params.toString()}`, options);
  const items = json.message?.items;
  return Array.isArray(items) ? items.map((item) => ({
    title: item.title,
    url: item.URL ?? doiUrl(item.DOI),
    snippet: item.abstract ?? item["container-title"]?.[0],
    sourceName: item["container-title"]?.[0] ?? "Crossref",
    publishedAt: normalizePublishedAt(null, item.published?.["date-parts"] ?? item["published-online"]?.["date-parts"] ?? item["published-print"]?.["date-parts"]),
    authors: normalizeAuthors(item.author),
    domains: Array.from(new Set([hostnameFromUrl(item.URL), ...Array.isArray(item.link) ? item.link.map((link) => hostnameFromUrl(link?.URL)) : []].filter(Boolean))),
    locale: item.language,
    doi: item.DOI,
    openAccess: crossrefOpenAccess(item),
    score: Number(item["is-referenced-by-count"] ?? 0) > 0 ? Math.log10(Number(item["is-referenced-by-count"]) + 1) : 0
  })) : [];
}
async function searchArxiv(query, options) {
  const params = buildParams({
    search_query: `all:${query.query}`,
    start: 0,
    max_results: query.limit,
    sortBy: "relevance",
    sortOrder: "descending"
  });
  const xml = await fetchText(`https://export.arxiv.org/api/query?${params.toString()}`, { ...options, headers: { Accept: "application/atom+xml, text/xml;q=0.9" } });
  return Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/giu)).map((match) => {
    const entry = match[1];
    const idUrl = extractXmlText(entry, "id");
    const arxivId = idUrl?.split("/abs/")[1]?.replace(/v\d+$/u, "") ?? null;
    return {
      title: extractXmlText(entry, "title"),
      url: idUrl,
      snippet: extractXmlText(entry, "summary"),
      sourceName: "arXiv",
      publishedAt: extractXmlText(entry, "published")?.slice(0, 10),
      authors: Array.from(entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/giu)).map((author) => decodeXml(author[1])),
      domains: [hostnameFromUrl(idUrl)].filter(Boolean),
      arxivId,
      openAccess: true,
      score: 2
    };
  });
}
async function searchEuropePmc(query, options) {
  const params = buildParams({ query: query.query, format: "json", pageSize: query.limit, resultType: "core" });
  const json = await fetchJson(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params.toString()}`, options);
  const results = json.resultList?.result;
  return Array.isArray(results) ? results.map((item) => {
    const url = item.doi ? doiUrl(item.doi) : item.pmid ? `https://europepmc.org/article/MED/${item.pmid}` : item.pmcid ? `https://europepmc.org/article/PMC/${item.pmcid}` : null;
    return {
      title: item.title,
      url,
      snippet: item.abstractText,
      sourceName: item.journalTitle ?? "Europe PMC",
      publishedAt: normalizePublishedAt(item.firstPublicationDate ?? item.pubYear),
      authors: item.authorList?.author ? normalizeAuthors(item.authorList.author) : normalizeAuthors(item.authorString),
      domains: [hostnameFromUrl(url)].filter(Boolean),
      locale: item.language ?? item.lang,
      doi: item.doi,
      pubmedId: item.pmid,
      openAccess: item.isOpenAccess === "Y" || item.inEPMC === "Y",
      score: Number(item.citedByCount ?? 0) > 0 ? Math.log10(Number(item.citedByCount) + 1) : 0
    };
  }) : [];
}
var PROVIDER_ADAPTERS = {
  openalex: searchOpenAlex,
  crossref: searchCrossref,
  arxiv: searchArxiv,
  "europe-pmc": searchEuropePmc
};
function buildSearchSummary(status, candidates, reports, query) {
  if (!candidates.length) {
    const failedCount = reports.filter((report) => report.status === "error").length;
    const unavailableCount = reports.filter((report) => report.status === "unavailable").length;
    if (query.kind === "web" || unavailableCount === reports.length) {
      return "\u6CA1\u6709\u53EF\u7528\u7684\u514D key \u901A\u7528\u7F51\u9875\u641C\u7D22 provider\uFF1B\u8FD9\u6B21\u6CA1\u6709\u767B\u8BB0\u4EFB\u4F55\u6765\u6E90\u3002";
    }
    if (failedCount > 0) {
      return "\u8FD9\u6B21\u8054\u7F51\u641C\u7D22\u6CA1\u6709\u5F97\u5230\u53EF\u9A8C\u8BC1\u5019\u9009\uFF0C\u5E76\u4E14\u6709 provider \u5931\u8D25\uFF1B\u4E0D\u8981\u628A\u5B83\u5F53\u6210\u5DF2\u5B8C\u6210\u68C0\u7D22\u3002";
    }
    return "\u8FD9\u6B21\u8054\u7F51\u641C\u7D22\u6CA1\u6709\u5F97\u5230\u53EF\u9A8C\u8BC1\u5019\u9009\uFF1B\u4E0D\u8981\u767B\u8BB0\u6765\u6E90\u6216\u751F\u6210 claim\u3002";
  }
  const warningCount = reports.filter((report) => report.status !== "ok").length;
  return warningCount > 0 ? `\u627E\u5230 ${candidates.length} \u4E2A\u5019\u9009\u6765\u6E90\uFF0C\u4F46\u6709 ${warningCount} \u4E2A provider \u4E0D\u53EF\u7528\u6216\u5931\u8D25\u3002` : `\u627E\u5230 ${candidates.length} \u4E2A\u5019\u9009\u6765\u6E90\u3002`;
}
function buildNeedsAttention(status, reports, candidates) {
  const failed = reports.filter((report) => report.status === "error");
  const unavailable = reports.filter((report) => report.status === "unavailable" || report.status === "disabled");
  if (status === "blocked") {
    return {
      status: "blocked",
      summary: "\u6CA1\u6709\u53EF\u9A8C\u8BC1\u5019\u9009\u6765\u6E90\u3002",
      why: unavailable.length > 0 ? unavailable[0].message : failed[0]?.error ?? "\u641C\u7D22\u8FD4\u56DE\u96F6\u7ED3\u679C\u3002",
      needs: ["\u6362\u4E00\u4E2A\u67E5\u8BE2\u8BCD\uFF0C\u6216\u7528\u5BBF\u4E3B\u516C\u5F00\u641C\u7D22\u6838\u5B9E\u7F51\u9875\u540E\u518D\u767B\u8BB0\u6765\u6E90\u3002"]
    };
  }
  if (failed.length > 0 || unavailable.length > 0) {
    return {
      status: "partial",
      summary: "\u90E8\u5206 provider \u6CA1\u6709\u4EA7\u51FA\u3002",
      why: unavailable[0]?.message ?? failed[0]?.error,
      needs: candidates.length > 0 ? ["\u5148\u4EBA\u5DE5\u6253\u5F00\u5019\u9009\u7ED3\u679C\u6838\u5B9E\uFF0C\u518D\u767B\u8BB0\u4E3A source\u3002"] : []
    };
  }
  return null;
}
async function executeNetworkSearch(rawArgs = {}, config = {}, options = {}) {
  const normalizedConfig = normalizeNetworkSearchConfigForCore(config);
  const query = normalizeNetworkSearchQuery(rawArgs, normalizedConfig);
  if (!normalizedConfig.enabled) {
    return {
      status: "blocked",
      summary: "Dove \u8054\u7F51\u641C\u7D22\u5DF2\u5728\u914D\u7F6E\u4E2D\u5173\u95ED\uFF1B\u8FD9\u6B21\u6CA1\u6709\u6267\u884C\u641C\u7D22\u3002",
      scope: { kind: "search", status: "blocked" },
      query,
      candidates: [],
      providerReports: [],
      nextStep: { label: "\u5F00\u542F networkSearch \u540E\u518D\u641C\u7D22\u3002", why: "\u641C\u7D22\u5173\u95ED\u65F6\u4E0D\u80FD\u751F\u6210\u5019\u9009\u6765\u6E90\u3002" },
      needsAttention: { status: "blocked", summary: "\u8054\u7F51\u641C\u7D22\u5173\u95ED\u3002", needs: ["\u542F\u7528\u516C\u5F00 provider \u540E\u91CD\u8BD5\u3002"] },
      showMore: { text: "\u5C55\u5F00\u7ED3\u679C\u53EF\u67E5\u770B\u67E5\u8BE2\u53C2\u6570\u548C provider \u72B6\u6001\u3002" }
    };
  }
  const disabled = new Set(normalizedConfig.disabledProviderIds);
  const providerIds2 = selectedProviderIds(query, normalizedConfig);
  const selectedProviders = providerIds2.map((id) => PROVIDER_BY_ID.get(id)).filter((provider) => provider && providerVisibleForKind(provider, query.kind));
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const providerResults = await Promise.all(selectedProviders.map((provider) => {
    if (disabled.has(provider.id) || normalizedConfig.providerSettings?.[provider.id]?.enabled === false) {
      return { candidates: [], report: providerReport(provider, { status: "disabled", message: "Provider disabled in Dove networkSearch config.", ...providerFilterPlan(provider, query) }) };
    }
    return runProvider(provider, query, normalizedConfig, fetchFn);
  }));
  const providerReports = providerResults.map((result) => result.report);
  const allCandidates = providerResults.flatMap((result) => result.candidates);
  const candidates = dedupeAndRank(allCandidates, query);
  const status = candidates.length > 0 ? "ok" : "blocked";
  return {
    status,
    summary: buildSearchSummary(status, candidates, providerReports, query),
    scope: { kind: "search", status, currentFocus: query.query },
    query,
    candidates,
    providerReports,
    nextStep: {
      label: candidates.length > 0 ? "\u6253\u5F00\u5019\u9009\u6765\u6E90\u6838\u5B9E\u6807\u9898\u3001DOI \u548C\u539F\u6587\u3002" : "\u6362\u67E5\u8BE2\u8BCD\u6216\u6539\u7528\u5BBF\u4E3B\u516C\u5F00\u641C\u7D22\u6838\u5B9E\u3002",
      why: "\u8054\u7F51\u641C\u7D22\u53EA\u4EA7\u51FA\u5019\u9009\uFF0C\u4E0D\u80FD\u76F4\u63A5\u767B\u8BB0\u6765\u6E90\u6216\u751F\u6210 claim\u3002",
      requiredActions: candidates.length > 0 ? ["\u6838\u5B9E\u5019\u9009\u6765\u6E90", "\u628A\u9A8C\u8BC1\u8FC7\u7684\u6765\u6E90\u4EA4\u7ED9 source/note/evidence \u6D41\u7A0B"] : ["\u91CD\u65B0\u68C0\u7D22\u6216\u63D0\u4F9B\u53EF\u9A8C\u8BC1 URL"]
    },
    needsAttention: buildNeedsAttention(status, providerReports, candidates),
    showMore: { text: "\u5C55\u5F00\u7ED3\u679C\u53EF\u67E5\u770B\u5019\u9009\u5217\u8868\u548C provider \u72B6\u6001\uFF1B\u9ED8\u8BA4 compact \u4E0D\u5C55\u793A\u539F\u59CB\u8FD4\u56DE\u3002" },
    diagnostics: {
      providerCount: providerReports.length,
      candidateCountBeforeDedupe: allCandidates.length,
      fetchedCount: providerReports.reduce((sum, report) => sum + report.fetchedCount, 0),
      appliedFilters: Array.from(new Set(providerReports.flatMap((report) => report.appliedFilters))),
      unsupportedFilters: Array.from(new Set(providerReports.flatMap((report) => report.unsupportedFilters)))
    }
  };
}
async function searchNetwork(root, args = {}, env = process.env, options = {}) {
  return executeNetworkSearch(args, loadNetworkSearchConfig(root, env), options);
}
function providerStatus(provider, config) {
  const disabled = new Set(config.disabledProviderIds);
  if (provider.unavailable) {
    return publicWebUnavailableReport();
  }
  if (!config.enabled || disabled.has(provider.id) || config.providerSettings?.[provider.id]?.enabled === false) {
    return providerReport(provider, { status: "disabled", message: "Provider disabled by Dove networkSearch config." });
  }
  return providerReport(provider, { status: "available" });
}
function queryNetworkSearchProviders(root, args = {}, env = process.env) {
  const config = normalizeNetworkSearchConfigForCore(loadNetworkSearchConfig(root, env));
  const kind = normalizeString2(args.kind, "all").toLowerCase();
  if (!SEARCH_KINDS.has(kind)) {
    throw new Error(`Dove network search kind must be one of: ${Array.from(SEARCH_KINDS).join(", ")}.`);
  }
  const requestedIds = normalizeProviderIds(args.providerIds ?? args.providers);
  const conflicts = requestedIds.filter((id) => !providerVisibleForKind(PROVIDER_BY_ID.get(id), kind));
  if (conflicts.length > 0) {
    throw new Error(`Dove network search provider-kind conflict: ${conflicts.join(", ")} cannot be used for kind ${kind}.`);
  }
  const providers = NETWORK_SEARCH_PROVIDER_REGISTRY.filter((provider) => requestedIds.length === 0 || requestedIds.includes(provider.id)).filter((provider) => providerVisibleForKind(provider, kind));
  const providerReports = providers.map((provider) => providerStatus(provider, config));
  const availableCount = providerReports.filter((report) => report.status === "available").length;
  const unavailableCount = providerReports.filter((report) => report.status !== "available").length;
  return {
    status: availableCount > 0 ? "ok" : "blocked",
    summary: availableCount > 0 ? `\u5F53\u524D\u6709 ${availableCount} \u4E2A\u516C\u5F00\u514D key \u641C\u7D22 provider \u53EF\u7528\u3002` : "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u7684\u516C\u5F00\u514D key \u641C\u7D22 provider\u3002",
    scope: { kind: "search", status: availableCount > 0 ? "ok" : "blocked" },
    providers: providerReports,
    defaultProviderIds: config.defaultProviderIds,
    nextStep: {
      label: availableCount > 0 ? "\u76F4\u63A5\u7528\u641C\u7D22\u5DE5\u5177\u53D1\u73B0\u5019\u9009\u6765\u6E90\u3002" : "\u542F\u7528\u516C\u5F00 provider \u6216\u7528\u5BBF\u4E3B\u516C\u5F00\u641C\u7D22\u6838\u5B9E\u3002",
      why: "Dove \u53EA\u5185\u7F6E\u514D key provider\uFF1B\u641C\u7D22\u7ED3\u679C\u4ECD\u9700\u4EBA\u5DE5\u6838\u5B9E\u540E\u518D\u8FDB\u5165\u8BC1\u636E\u94FE\u3002"
    },
    needsAttention: unavailableCount > 0 ? {
      status: availableCount > 0 ? "partial" : "blocked",
      summary: `${unavailableCount} \u4E2A provider \u4E0D\u53EF\u7528\u6216\u5173\u95ED\u3002`,
      needs: ["\u4E0D\u8981\u628A\u4E0D\u53EF\u7528 provider \u5F53\u6210\u5DF2\u68C0\u7D22\u5B8C\u6210\u3002"]
    } : null,
    showMore: { text: "\u5C55\u5F00\u7ED3\u679C\u53EF\u67E5\u770B provider \u80FD\u529B\uFF1B\u9ED8\u8BA4 compact \u4E0D\u5C55\u793A\u5185\u90E8\u5B57\u6BB5\u3002" }
  };
}

// src/core/i18n.mjs
function explicitLanguage(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    const value = source.responseLanguage ?? source.language;
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}
function resolveDoveResponseLanguage(root, args = {}, options = {}) {
  const requested = explicitLanguage(args, args.settings);
  if (requested) return normalizeDoveResponseLanguage(requested, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true });
  const env = options.env ?? process.env;
  const configured = options.configLanguage ?? loadExplicitDoveLanguageConfig(root, env);
  return configured ?? loadDoveLanguageConfig(root, env);
}
function isDoveChinese(language) {
  return normalizeDoveResponseLanguage(language) === "zh";
}
export {
  ARTIFACT_PATHS,
  DEFAULT_DOVE_RESPONSE_LANGUAGE,
  DEFAULT_NETWORK_SEARCH_PROVIDER_IDS,
  DOVE_INIT_PROPOSAL_VERSION,
  DOVE_LESSON_KINDS,
  DOVE_LESSON_PROPOSAL_VERSION,
  DOVE_LESSON_SCHEMA_VERSION,
  DOVE_LESSON_SCOPES,
  DOVE_MANIFEST_SCHEMA_VERSION,
  DOVE_PROJECT_SCHEMA_VERSION,
  DOVE_RESPONSE_LANGUAGES,
  DOVE_TRUST_SCHEMA_VERSION,
  DOVE_WORKSPACE_SCHEMA_VERSION,
  EXECUTION_RECEIPT_SCHEMA_VERSION,
  GOVERNANCE_EXEMPT_MUTATIONS,
  GOVERNANCE_GUARDED_MUTATIONS,
  GOVERNANCE_NEGATIVE_COVERAGE,
  GOVERNANCE_READONLY_COMMANDS,
  GOVERNANCE_READONLY_TOOLS,
  MINIMAL_WORKSPACE_DIRECTORIES,
  MINIMAL_WORKSPACE_REQUIRED_FILES,
  MISSION_CONTRACT_SCHEMA_VERSION,
  MISSION_CRITERION_ID_VERSION,
  MISSION_EVIDENCE_REQUIREMENT_ID_VERSION,
  MISSION_PROPOSAL_VERSION,
  NETWORK_SEARCH_PROVIDER_REGISTRY,
  PROJECT_IDENTITY_SCHEMA_VERSION,
  REVIEW_EXCHANGE_POLICIES,
  REVIEW_EXCHANGE_SCHEMA_VERSION,
  SOURCE_LIFECYCLE_STATES,
  assertCurrentMissionContract,
  assessMissionCompletion,
  buildRebuttal,
  buildRebuttalStrategy,
  compareVersions,
  createDoveMission,
  createVersionSnapshot,
  currentMissionContractMetadata,
  executionReceiptPath,
  importReviewExchange,
  ingestExecutionReceipt,
  initDoveGoal,
  initDoveWorkspace,
  inspectDoveWorkspace,
  isDoveChinese,
  isOperationalFailureOutcome,
  isProposalOnlyOutcome,
  loadDoveConfig,
  loadDoveLanguageConfig,
  loadExplicitDoveLanguageConfig,
  loadNetworkSearchConfig,
  missionCompletionCriteria,
  missionCompletionCriterionId,
  missionEvidenceRequirementId,
  missionEvidenceRequirements,
  normalizeDoveResponseLanguage,
  normalizeRebuttalIssues,
  prepareReviewExchange,
  previewDoveInit,
  previewDoveMissionContract,
  queryDomainIntegrity,
  queryDoveLessons,
  queryDoveMission,
  queryDoveStatus,
  queryNetworkSearchProviders,
  querySources,
  readExecutionReceipts,
  recordDoveLesson,
  registerSource,
  resolveDoveResponseLanguage,
  runExperienceWorkflow,
  runFigureWorkflow,
  searchNetwork,
  upsertClaims,
  upsertDraft,
  upsertDraftMetadata,
  upsertNote,
  validateExecutionReceipt,
  verifyReviewCoverage,
  verifySource
};
