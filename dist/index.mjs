// src/core/schema.mjs
var DOVE_WORKSPACE_SCHEMA_VERSION = 9;
var PACKAGE_VERSION = "0.4.0";
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

// src/core/mission-queries.mjs
import fs17 from "node:fs";
import path19 from "node:path";

// src/core/completion-gates.mjs
import path16 from "node:path";

// src/core/domain-artifacts.mjs
import crypto7 from "node:crypto";
import fs13 from "node:fs";
import path14 from "node:path";

// src/core/artifact-integrity.mjs
import fs4 from "node:fs";
import path4 from "node:path";

// src/core/mutation-backend.mjs
import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import fs3 from "node:fs";
import path3 from "node:path";

// src/core/anchored-filesystem.mjs
import fs from "node:fs";
import path from "node:path";

// src/core/contained-write.mjs
import fs2 from "node:fs";
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
  const fsOps = options.fsOps ?? fs2;
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

// src/core/mutation-backend.mjs
var mutationStorage = new AsyncLocalStorage();
function normalizeMutationMode(value) {
  if (value === void 0) return "direct-process";
  if (value === "patch-plan" || value === "direct-process") return value;
  throw new Error("mutationMode must be either patch-plan or direct-process when explicitly provided.");
}
function currentMutationContext(root) {
  const context = mutationStorage.getStore();
  if (!context || context.lifecycle !== "active") return null;
  if (root) {
    try {
      const resolved = typeof context.fsOps.realpathSync.native === "function" ? context.fsOps.realpathSync.native(path3.resolve(root)) : context.fsOps.realpathSync(path3.resolve(root));
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
  if (path4.isAbsolute(original) || /^[A-Za-z]:[\\/]/u.test(original)) {
    return { ok: false, path: original, reason: "absolute paths are not inspected" };
  }
  if (/^[a-z][a-z0-9+.-]*:/iu.test(original)) {
    return { ok: false, path: original, reason: "unsupported or malformed external reference scheme" };
  }
  const normalizedPath = path4.posix.normalize(original.replace(/\\/gu, "/"));
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
  const mutationContext = currentMutationContext(root);
  if (!normalized.ok) {
    return { path: normalized.path, normalizedPath: normalized.normalizedPath ?? null, status: "unsafe", exists: false, file: false, reason: normalized.reason };
  }
  const rootPath = path4.resolve(root);
  const fullPath = path4.resolve(rootPath, normalized.normalizedPath);
  const relativeToRoot = path4.relative(rootPath, fullPath);
  if (relativeToRoot === ".." || relativeToRoot.startsWith(`..${path4.sep}`) || path4.isAbsolute(relativeToRoot)) {
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
    const relativeToRealRoot = path4.relative(realRootPath, realFullPath);
    if (relativeToRealRoot === ".." || relativeToRealRoot.startsWith(`..${path4.sep}`) || path4.isAbsolute(relativeToRealRoot)) {
      return { path: normalized.path, normalizedPath: normalized.normalizedPath, status: "unsafe", exists: true, file: false, reason: "real path escapes the project root" };
    }
    canonicalRelativePath = relativeToRealRoot.split(path4.sep).join("/");
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

// src/core/receipt-ledger.mjs
import fs5 from "node:fs";
import path6 from "node:path";

// src/core/mission-graph.mjs
import path5 from "node:path";
function missionEntries(value) {
  if (!Array.isArray(value)) throw new Error("Mission graph entries must be an array.");
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Mission graph entry ${index} must be an object.`);
    const mission = entry.mission;
    if (!mission || typeof mission !== "object" || Array.isArray(mission)) throw new Error(`Mission graph entry ${index} must contain a mission object.`);
    const missionId = mission.missionId;
    if (typeof missionId !== "string" || !missionId) throw new Error(`Mission graph entry ${index} has no missionId.`);
    const filename = typeof entry.filename === "string" ? path5.posix.basename(entry.filename) : "";
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
function validateMissionGraph(value) {
  const entries = missionEntries(value);
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
function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}
function assertSealed(value, fields, label) {
  assertPlainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function exactString(value, label) {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) throw new Error(`${label} must be a canonical non-empty string.`);
  return value;
}
function safeId(value, label) {
  const normalized = exactString(value, label);
  if (!SAFE_ID.test(normalized)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return normalized;
}
function hash(value, label) {
  const normalized = exactString(value, label);
  if (!HASH.test(normalized)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  return normalized;
}
function exactIso(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  }
  return value;
}
function canonicalPath(value, label) {
  const normalized = normalizeProjectRelativePath(value);
  if (!normalized.ok) throw new Error(`${label} has an unsafe path: ${normalized.reason}.`);
  if (value !== normalized.normalizedPath) throw new Error(`${label} must use a canonical project-relative path.`);
  return value;
}
function canonicalStringArray(value, label, options = {}) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const items = value.map((item, index) => exactString(item, `${label}[${index}]`));
  if (new Set(items).size !== items.length) throw new Error(`${label} must not contain duplicates.`);
  if (options.sorted === true && items.some((item, index) => index > 0 && items[index - 1].localeCompare(item) > 0)) {
    throw new Error(`${label} must use canonical lexical order.`);
  }
  return items;
}
function validateProducer(value, label) {
  assertSealed(value, PRODUCER_FIELDS, label);
  if (!PRODUCER_KIND_SET.has(value.kind)) throw new Error(`${label}.kind is unsupported.`);
  const actionId = safeId(value.actionId, `${label}.actionId`);
  if (value.kind === "public-execution" && actionId !== "ingest-execution-receipt") {
    throw new Error(`${label} public-execution producer must use actionId ingest-execution-receipt.`);
  }
  if (value.kind === "dove-internal" && (!INTERNAL_ACTION_IDS.has(actionId) || actionId === "ingest-execution-receipt")) {
    throw new Error(`${label} dove-internal producer actionId is not a registered internal Dove mutation.`);
  }
  return value;
}
function validateStoredReceipt(value, context) {
  const { manifest, missions, label, filename } = context;
  assertSealed(value, RECEIPT_FIELDS, label);
  if (value.schemaVersion !== EXECUTION_RECEIPT_SCHEMA_VERSION) throw new Error(`${label} has an unsupported schemaVersion.`);
  if (value.workspaceId !== manifest.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  safeId(value.workspaceId, `${label}.workspaceId`);
  const receiptId = safeId(value.receiptId, `${label}.receiptId`);
  if (filename !== `${receiptId}.json`) throw new Error(`${label} filename must match receiptId ${receiptId}.`);
  if (!Number.isSafeInteger(value.ledgerSequence) || value.ledgerSequence < 1) throw new Error(`${label}.ledgerSequence must be a positive safe integer.`);
  const missionId = safeId(value.missionId, `${label}.missionId`);
  const mission = missions.get(missionId);
  if (!mission) throw new Error(`${label} references unknown mission ${missionId}.`);
  hash(value.contractDigest, `${label}.contractDigest`);
  if (value.contractDigest !== mission.contractDigest) throw new Error(`${label}.contractDigest does not match mission ${missionId}.`);
  exactString(value.summary, `${label}.summary`);
  exactIso(value.producedAt, `${label}.producedAt`);
  exactIso(value.recordedAt, `${label}.recordedAt`);
  validateProducer(value.producer, `${label}.producer`);
  if (!Array.isArray(value.artifacts)) throw new Error(`${label}.artifacts must be an array.`);
  if (!Array.isArray(value.validations)) throw new Error(`${label}.validations must be an array.`);
  if (!Array.isArray(value.criteriaSatisfied)) throw new Error(`${label}.criteriaSatisfied must be an array.`);
  if (value.artifacts.length === 0 && value.validations.length === 0 && value.criteriaSatisfied.length === 0) {
    throw new Error(`${label} must contain at least one artifact, validation, or satisfied criterion.`);
  }
  const artifactPaths = /* @__PURE__ */ new Set();
  for (const [index, artifact] of value.artifacts.entries()) {
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
  for (const [index, validation] of value.validations.entries()) {
    const itemLabel = `${label}.validations[${index}]`;
    assertSealed(validation, VALIDATION_FIELDS, itemLabel);
    exactString(validation.kind, `${itemLabel}.kind`);
    const reference = canonicalPath(validation.reference, `${itemLabel}.reference`);
    if (validationPaths.has(reference)) throw new Error(`${label}.validations contains duplicate reference ${reference}.`);
    if (artifactPaths.has(reference)) throw new Error(`${label} artifact and validation paths must be canonically distinct: ${reference}.`);
    validationPaths.add(reference);
    hash(validation.outputHash, `${itemLabel}.outputHash`);
  }
  const artifactHashByReference = new Map(value.artifacts.map((artifact) => [`artifact:${artifact.path}`, artifact.sha256]));
  const validationHashByReference = new Map(value.validations.map((validation) => [`validation:${validation.reference}`, validation.outputHash]));
  const criterionIds = /* @__PURE__ */ new Set();
  const missionCriterionIds = new Set(Array.isArray(mission.completionCriterionIds) ? mission.completionCriterionIds : []);
  for (const [index, criterion] of value.criteriaSatisfied.entries()) {
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
      const target = reference.slice(separator + 1);
      if ((kind === "artifact" || kind === "validation") && canonicalPath(target, `${itemLabel}.evidenceRefs[${referenceIndex}]`) !== target) {
        throw new Error(`${itemLabel}.evidenceRefs[${referenceIndex}] must be canonical.`);
      }
      if (!bindingByReference.has(reference)) throw new Error(`${itemLabel}.evidenceBindings is missing ${reference}.`);
      const binding = bindingByReference.get(reference);
      const declaredHash = kind === "artifact" ? artifactHashByReference.get(reference) : kind === "validation" ? validationHashByReference.get(reference) : null;
      if (declaredHash && (binding.sha256 !== declaredHash || binding.receiptId !== receiptId)) throw new Error(`${itemLabel}.evidenceBindings does not match the receipt declaration for ${reference}.`);
    }
  }
  return value;
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
  const directory = path6.resolve(root, ARTIFACT_PATHS.executionReceiptsDir);
  const receipts = fs5.readdirSync(directory, { withFileTypes: true }).map((entry) => {
    const relativePath = path6.posix.join(ARTIFACT_PATHS.executionReceiptsDir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`${relativePath} must not be a symbolic link.`);
    if (!entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${relativePath} must be a regular JSON file.`);
    return validateStoredReceipt(readJsonStrict(path6.join(directory, entry.name), relativePath), {
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
import path11 from "node:path";

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
function sha256(value) {
  return crypto2.createHash("sha256").update(value).digest("hex");
}
function stableMissionValue(value) {
  if (Array.isArray(value)) return value.map(stableMissionValue);
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
function assertPlainObject2(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}
function normalizeString(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}
function normalizeStringArray(value, label = "Mission contract array field") {
  if (value === void 0) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array of non-empty strings.`);
  const normalized = value.map((item) => normalizeString(item, null));
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
function normalizeContractPaths(value, label) {
  return normalizeStringArray(value, label).map((item, index) => canonicalContractPath(item, `${label}[${index}]`));
}
function normalizeEvidenceRequirements(value) {
  return normalizeStringArray(value, "evidenceRequirements").map((requirement, index) => {
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
function normalizeMissionContractContent(value = {}) {
  assertPlainObject2(value, "Mission contract");
  const goal = normalizeString(value.goal, null);
  if (!goal) throw new Error("Dove mission requires a non-empty goal.");
  const content = { goal };
  for (const field of MISSION_CONTRACT_ARRAY_FIELDS) {
    if (field === "targetArtifacts" || field === "expectedArtifacts") content[field] = normalizeContractPaths(value[field], field);
    else if (field === "evidenceRequirements") content[field] = normalizeEvidenceRequirements(value[field]);
    else content[field] = normalizeStringArray(value[field], field);
  }
  const dependsOnMissionIds = normalizeStringArray(value.dependsOnMissionIds, "dependsOnMissionIds");
  for (const [index, missionId] of dependsOnMissionIds.entries()) {
    if (!SAFE_ID2.test(missionId)) throw new Error(`dependsOnMissionIds[${index}] must be a safe lowercase identifier.`);
  }
  if (dependsOnMissionIds.length > 0) content.dependsOnMissionIds = dependsOnMissionIds;
  const supersedesMissionId = normalizeString(value.supersedesMissionId, null);
  if (supersedesMissionId) {
    if (!SAFE_ID2.test(supersedesMissionId)) throw new Error("supersedesMissionId must be a safe lowercase identifier.");
    content.supersedesMissionId = supersedesMissionId;
  }
  return content;
}
function missionCompletionCriterionId(_index, criterion) {
  return `criterion-${sha256(stableMissionSerialize({ version: MISSION_CRITERION_ID_VERSION, criterion })).slice(0, 16)}`;
}
function missionEvidenceRequirementId(_index, requirement) {
  return `evidence-${sha256(stableMissionSerialize({ version: MISSION_EVIDENCE_REQUIREMENT_ID_VERSION, requirement })).slice(0, 16)}`;
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
  return sha256(stableMissionSerialize({
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
import path10 from "node:path";

// src/core/source-trust.mjs
import fs8 from "node:fs";
import path9 from "node:path";

// src/core/review-artifact-snapshot.mjs
import crypto3 from "node:crypto";
import fs6 from "node:fs";
import path7 from "node:path";
var HASH_PATTERN = /^[a-f0-9]{64}$/u;
function sha256Buffer(value) {
  return crypto3.createHash("sha256").update(value).digest("hex");
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
    content = fs6.readFileSync(path7.resolve(root, canonicalPath2));
  }
  if (content.byteLength === 0) throw new Error(`${label} must be a non-empty regular file.`);
  return { path: canonicalPath2, content, sizeBytes: content.byteLength, sha256: sha256Buffer(content) };
}
function stableSnapshotSetHash(snapshots = []) {
  const canonical = [...snapshots].map(({ path: artifactPath, sizeBytes, sha256: sha2564 }) => ({ path: artifactPath, sizeBytes, sha256: sha2564 })).sort((left, right) => left.path.localeCompare(right.path));
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
      sha256: sha256File(path7.resolve(root, canonicalPath2))
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
function normalizeReviewSnapshots(value, label = "reviewedArtifacts") {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, snapshots: [], reason: `${label} must contain artifact snapshots` };
  const snapshots = [];
  const seen = /* @__PURE__ */ new Set();
  for (const [index, item] of value.entries()) {
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
    const current = { path: canonicalPath2, sizeBytes: inspection.sizeBytes, sha256: sha256File(path7.resolve(root, canonicalPath2)) };
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
import path8 from "node:path";
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function resolvePath(root, relativePath) {
  return path8.join(root, relativePath);
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
  return path9.posix.join(".dove/sources", `${sourceId}.json`);
}
function notePath(noteId) {
  return path9.posix.join(".dove/notes", `${noteId}.json`);
}
function assertSealed2(value, fields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function exactTimestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return value;
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
  const directory = path9.resolve(root, ".dove/sources");
  return fs8.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.name !== "materials").map((entry) => {
    const relativePath = path9.posix.join(".dove/sources", entry.name);
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
function sourceRecord(args, capturedMaterial2, contractDigest, current = null) {
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
    contractDigest,
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
  readSourceFiles(root);
  const sourceId = domainSafeId(args.sourceId, "sourceId");
  const relativePath = sourcePath(sourceId);
  const existing = fs8.existsSync(path9.resolve(root, relativePath)) ? readJson(root, relativePath, null) : null;
  if (existing && existing.missionId !== mission.missionId) throw new Error(`Source ${args.sourceId} belongs to mission ${existing.missionId}.`);
  const captured = capturedMaterial(root, args.capturePath, { includeContent: true });
  if (!captured) throw new Error("register_source requires capturePath for concrete non-empty captured material.");
  const materialPath = path9.posix.join(".dove/sources/materials", `${sourceId}${path9.extname(captured.path).toLowerCase() || ".bin"}`);
  const sourceMaterial = { path: materialPath, sizeBytes: captured.sizeBytes, sha256: captured.sha256 };
  const source = sourceRecord(args, sourceMaterial, mission.contractDigest, existing);
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
  readSourceFiles(root);
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
function querySources(root, args = {}) {
  assertSealedDomainArgs(args, QUERY_FIELDS, "query_sources");
  const { mission } = readCurrentMission(root, args.missionId, "Source query");
  const sourceId = normalizeText(args.sourceId);
  const lifecycle = normalizeText(args.lifecycle).toLowerCase();
  if (lifecycle && !SOURCE_LIFECYCLE_STATES.includes(lifecycle)) throw new Error(`lifecycle must be one of: ${SOURCE_LIFECYCLE_STATES.join(", ")}.`);
  const limit = Math.min(200, Math.max(1, Number.isFinite(Number(args.limit)) ? Math.trunc(Number(args.limit)) : 50));
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
function assertPlainObject3(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}
function assertSealed3(value, fields, label) {
  assertPlainObject3(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function exactIso2(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return value;
}
function nullableSafeId(value, label) {
  if (value === null) return null;
  return domainSafeId(value, label);
}
function normalizeWorkKind(value, label) {
  const workKind = domainNonEmptyText(value, label).toLowerCase();
  if (!WORK_KIND_SET.has(workKind)) throw new Error(`${label} must be retrieval, experiment, or analysis.`);
  return workKind;
}
function normalizeStatus(value, label) {
  const status = domainNonEmptyText(value, label).toLowerCase();
  if (!STATUS_SET.has(status)) throw new Error(`${label} is unsupported.`);
  return status;
}
function normalizeOutcomeFields(value, label, status, options = {}) {
  const evidenceRefs = domainStringArray(value.outcomeEvidenceRefs, `${label}.outcomeEvidenceRefs`);
  if (status === "pending") {
    if (value.outcomeSummary !== null || evidenceRefs.length !== 0 || value.blockedReasonCode !== null || value.lessonId !== null) {
      throw new Error(`${label} pending nodes require null outcomeSummary, blockedReasonCode, and lessonId with empty outcomeEvidenceRefs.`);
    }
    return { outcomeSummary: null, outcomeEvidenceRefs: [], blockedReasonCode: null, lessonId: null };
  }
  const outcomeSummary = domainNonEmptyText(value.outcomeSummary, `${label}.outcomeSummary`);
  if (evidenceRefs.length === 0) throw new Error(`${label} ${status} nodes require at least one current outcomeEvidenceRef.`);
  if (status === "completed") {
    if (value.blockedReasonCode !== null || value.lessonId !== null) throw new Error(`${label} completed nodes must keep blockedReasonCode and lessonId null.`);
    return { outcomeSummary, outcomeEvidenceRefs: evidenceRefs, blockedReasonCode: null, lessonId: null };
  }
  const blockedReasonCode = domainSafeId(value.blockedReasonCode, `${label}.blockedReasonCode`);
  const lessonId = options.allowUnassignedBlockedLesson === true && value.lessonId === null ? null : domainSafeId(value.lessonId, `${label}.lessonId`);
  return { outcomeSummary, outcomeEvidenceRefs: evidenceRefs, blockedReasonCode, lessonId };
}
function normalizeNode(value, label, options = {}) {
  assertSealed3(value, options.persisted === true ? NODE_FIELDS : NODE_INPUT_FIELDS, label);
  const status = normalizeStatus(value.status, `${label}.status`);
  const outcome = normalizeOutcomeFields(value, label, status, options);
  return {
    nodeId: domainSafeId(value.nodeId, `${label}.nodeId`),
    parentNodeId: nullableSafeId(value.parentNodeId, `${label}.parentNodeId`),
    workKind: normalizeWorkKind(value.workKind, `${label}.workKind`),
    questionOrHypothesis: domainNonEmptyText(value.questionOrHypothesis, `${label}.questionOrHypothesis`),
    workDescription: domainNonEmptyText(value.workDescription, `${label}.workDescription`),
    successOrStopCriterion: domainNonEmptyText(value.successOrStopCriterion, `${label}.successOrStopCriterion`),
    status,
    ...outcome,
    ...options.persisted === true ? {
      createdAt: exactIso2(value.createdAt, `${label}.createdAt`),
      updatedAt: exactIso2(value.updatedAt, `${label}.updatedAt`)
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
function validateResearchTree(value, options = {}) {
  const label = options.label ?? "Research tree";
  assertSealed3(value, TREE_FIELDS, label);
  if (value.schemaVersion !== RESEARCH_TREE_SCHEMA_VERSION) throw new Error(`${label} has an unsupported schemaVersion.`);
  const workspaceId = domainSafeId(value.workspaceId, `${label}.workspaceId`);
  const missionId = domainSafeId(value.missionId, `${label}.missionId`);
  if (options.workspaceId !== void 0 && workspaceId !== options.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  if (options.missionId !== void 0 && missionId !== options.missionId) throw new Error(`${label}.missionId does not match its filename.`);
  if (options.contractDigest !== void 0 && value.contractDigest !== options.contractDigest) throw new Error(`${label}.contractDigest does not match mission ${missionId}.`);
  if (!/^[0-9a-f]{64}$/u.test(String(value.contractDigest ?? ""))) throw new Error(`${label}.contractDigest must be a lowercase SHA-256 digest.`);
  if (!Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error(`${label}.revision must be a positive safe integer.`);
  exactIso2(value.updatedAt, `${label}.updatedAt`);
  if (!Array.isArray(value.nodes) || value.nodes.length === 0) throw new Error(`${label}.nodes must contain at least one decision node.`);
  const nodes = value.nodes.map((node, index) => {
    const normalized = normalizeNode(node, `${label}.nodes[${index}]`, { persisted: true });
    if (Date.parse(normalized.updatedAt) < Date.parse(normalized.createdAt)) throw new Error(`${label}.nodes[${index}].updatedAt must not precede createdAt.`);
    return normalized;
  });
  assertTreeGraph(nodes, label);
  return { ...value, nodes };
}
function researchTreePath(missionId) {
  return path10.posix.join(ARTIFACT_PATHS.researchTreesDir, `${domainSafeId(missionId, "missionId")}.json`);
}
function readResearchTree(root, missionId, options = {}) {
  const { workspace, mission } = readCurrentMission(root, missionId, options.operation ?? "Research tree read");
  const relativePath = researchTreePath(mission.missionId);
  const context = currentMutationContext(root);
  const exists = context ? context.fileExists(relativePath) : fs9.existsSync(path10.resolve(root, relativePath));
  if (!exists) return null;
  return validateResearchTree(readJson(root, relativePath, null), {
    label: relativePath,
    workspaceId: workspace.manifest.workspaceId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest
  });
}
function mutationModeFor(root, args) {
  const explicit = Object.hasOwn(args, "mutationMode") ? normalizeMutationMode(args.mutationMode) : null;
  const active = currentMutationContext(root)?.mutationMode ?? null;
  if (active && explicit && active !== explicit) throw new Error(`reevaluate-research-tree mutationMode ${explicit} does not match the active mutation context mode ${active}.`);
  return active ?? explicit ?? "direct-process";
}
function createdAtFor(args) {
  if (args.confirmed !== true) return (/* @__PURE__ */ new Date()).toISOString();
  return exactIso2(args.createdAt, "createdAt");
}
function normalizedArgs(args) {
  if (args.operation !== "reevaluate-research-tree") throw new Error("Research-tree reevaluation requires operation reevaluate-research-tree.");
  if (!Array.isArray(args.nodeUpdates) || args.nodeUpdates.length === 0) throw new Error("reevaluate-research-tree requires at least one decision node update.");
  const nodeUpdates = args.nodeUpdates.map((node, index) => normalizeNode(node, `nodeUpdates[${index}]`, { allowUnassignedBlockedLesson: true }));
  if (new Set(nodeUpdates.map((node) => node.nodeId)).size !== nodeUpdates.length) throw new Error("nodeUpdates must not contain duplicate nodeId values.");
  return {
    operation: "reevaluate-research-tree",
    missionId: domainSafeId(args.missionId, "missionId"),
    requirement: domainNonEmptyText(args.requirement, "requirement"),
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
function buildProposal(root, args) {
  const input = normalizedArgs(args);
  const { workspace, mission } = readCurrentMission(root, input.missionId, "Research tree reevaluation");
  const mutationMode = mutationModeFor(root, args);
  if (args.confirmed === true) {
    if (args.workspaceId !== workspace.manifest.workspaceId) throw new Error("Confirmed research-tree replay no longer matches the workspace identity.");
    if (args.contractDigest !== mission.contractDigest) throw new Error("Confirmed research-tree replay no longer matches the mission contract digest.");
  }
  const currentTree = readResearchTree(root, mission.missionId, { operation: "Research tree reevaluation" });
  const currentNodes = currentTree?.nodes ?? [];
  const byId = new Map(currentNodes.map((node) => [node.nodeId, node]));
  const createdAt = createdAtFor(args);
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
  const receiptId = args.confirmed === true ? domainSafeId(args.receiptId, "receiptId") : `receipt-create-dove-mission-${crypto4.randomUUID()}`;
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
    mutationMode,
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
  return { input, mission, tree, diff, lessons, receiptId, envelope, proposalDigest, mutationMode, relativePath: researchTreePath(mission.missionId) };
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
  const proposalToken = Buffer.from(JSON.stringify({ version: RESEARCH_TREE_PROPOSAL_VERSION, mutationMode: proposal.mutationMode, confirmArgs: confirmArgs2 }), "utf8").toString("base64url");
  return { ...proposal, proposalToken };
}
function assertExactReplay(root, proposal, args) {
  if (!currentMutationContext(root)) throw new Error("Confirmed research-tree reevaluation requires an active MutationContext.");
  if (args.proposalVersion !== RESEARCH_TREE_PROPOSAL_VERSION) throw new Error("The selected research-tree proposal version is unsupported. Request a fresh proposal.");
  const expected = confirmArgsFor(proposal);
  const supplied = Object.fromEntries(Object.entries(args).filter(([field]) => REEVALUATE_FIELDS.has(field) || REPLAY_FIELDS.has(field)));
  if (stableWorkspaceSerialize(supplied) !== stableWorkspaceSerialize(expected)) throw new Error("The selected research-tree proposal no longer matches the exact diff, current tree, workspace, mission contract, evidence, receipt, or mutation mode. Request a fresh proposal.");
}
function reevaluateResearchTree(root, args = {}) {
  assertSealedDomainArgs(args, /* @__PURE__ */ new Set([...REEVALUATE_FIELDS, ...REPLAY_FIELDS]), "create_dove_mission reevaluate-research-tree");
  if (args.confirmed !== true) {
    const replayOnly = Object.keys(args).filter((field) => REPLAY_FIELDS.has(field) && field !== "mutationMode");
    if (replayOnly.length > 0) throw new Error(`reevaluate-research-tree proposal does not accept caller replay fields: ${replayOnly.map((field) => `$.${field}`).join(", ")}.`);
  }
  const proposal = withToken(buildProposal(root, args));
  if (args.confirmed !== true) {
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
  assertExactReplay(root, proposal, args);
  const writes = [{
    path: proposal.relativePath,
    kind: "data",
    content: domainJson(proposal.tree),
    derivedReferences: [`mission:${proposal.mission.missionId}`, `research-tree-revision:${proposal.tree.revision}`]
  }, ...proposal.lessons.map((lesson) => ({
    path: path10.posix.join(ARTIFACT_PATHS.lessonsDir, `${lesson.lessonId}.json`),
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
function sha2562(value) {
  return crypto5.createHash("sha256").update(value).digest("hex");
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
  return sha2562(stableWorkspaceSerialize(value));
}
function canonicalWorkspacePath(root) {
  return fs10.realpathSync.native(path11.resolve(root));
}
function assertPlainObject4(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object.`);
  }
}
function assertSealed4(value, fields, label) {
  assertPlainObject4(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}
function exactIso3(value, label) {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value) || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  }
  return value;
}
function safeId2(value, label) {
  if (typeof value !== "string" || !SAFE_ID3.test(value)) {
    throw new Error(`${label} must be a safe lowercase identifier.`);
  }
  return value;
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
function validateDoveManifest(value) {
  assertSealed4(value, MANIFEST_FIELDS, "Dove manifest");
  if (value.schemaVersion !== DOVE_WORKSPACE_SCHEMA_VERSION) {
    throw new Error(`Dove manifest schemaVersion ${value.schemaVersion ?? "missing"} is unsupported; expected ${DOVE_WORKSPACE_SCHEMA_VERSION}.`);
  }
  if (value.manifestVersion !== DOVE_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Dove manifest manifestVersion ${value.manifestVersion ?? "missing"} is unsupported.`);
  }
  safeId2(value.workspaceId, "Dove manifest workspaceId");
  exactIso3(value.createdAt, "Dove manifest createdAt");
  if (typeof value.packageVersion !== "string" || !value.packageVersion.trim()) {
    throw new Error("Dove manifest packageVersion must be a non-empty string.");
  }
  return value;
}
function validateDoveTrustConfig(value) {
  assertSealed4(value, TRUST_FIELDS, "Dove project trust config");
  if (value.schemaVersion !== DOVE_TRUST_SCHEMA_VERSION) {
    throw new Error(`Dove project trust schemaVersion ${value.schemaVersion ?? "missing"} is unsupported.`);
  }
  if (!Array.isArray(value.entries) || value.entries.length !== 0) {
    throw new Error("Dove project trust entries must be an empty sealed array until a trust schema is explicitly introduced.");
  }
  return value;
}
function validateDoveProject(value, manifest) {
  assertSealed4(value, PROJECT_FIELDS, "Dove project identity");
  if (value.schemaVersion !== DOVE_PROJECT_SCHEMA_VERSION) {
    throw new Error(`Dove project schemaVersion ${value.schemaVersion ?? "missing"} is unsupported.`);
  }
  safeId2(value.workspaceId, "Dove project workspaceId");
  safeId2(value.projectId, "Dove project projectId");
  if (value.workspaceId !== manifest.workspaceId) {
    throw new Error("Dove project workspaceId does not match the manifest workspaceId.");
  }
  if (value.projectId !== `project-${manifest.workspaceId}`) {
    throw new Error("Dove project projectId does not match the manifest identity.");
  }
  if (typeof value.goal !== "string" || !value.goal.trim()) {
    throw new Error("Dove project goal must be a non-empty string.");
  }
  exactIso3(value.createdAt, "Dove project createdAt");
  exactIso3(value.updatedAt, "Dove project updatedAt");
  if (value.createdAt !== manifest.createdAt) {
    throw new Error("Dove project createdAt must match the manifest createdAt.");
  }
  validateDoveTrustConfig(value.trust);
  return value;
}
function hash2(value, label) {
  if (typeof value !== "string" || !HASH3.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest.`);
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
function validateMissionShape(value, manifest, label) {
  return validatePersistedMission(value, {
    label,
    workspaceId: manifest.workspaceId,
    filename: path11.posix.basename(label)
  });
}
function validateLessonReferenceArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const seen = /* @__PURE__ */ new Set();
  for (const [index, item] of value.entries()) {
    const itemLabel = `${label}[${index}]`;
    assertSealed4(item, LESSON_REF_FIELDS, itemLabel);
    nonEmptyString(item.path, `${itemLabel}.path`);
    hash2(item.sha256, `${itemLabel}.sha256`);
    if (seen.has(item.path)) throw new Error(`${label} contains duplicate path ${item.path}.`);
    seen.add(item.path);
  }
  return value;
}
function validateLessonShape(value, manifest, label, context = {}) {
  assertSealed4(value, LESSON_FIELDS, label);
  if (value.schemaVersion !== 2) throw new Error(`${label} has an unsupported schemaVersion.`);
  safeId2(value.workspaceId, `${label}.workspaceId`);
  if (value.workspaceId !== manifest.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  const lessonId = safeId2(value.lessonId, `${label}.lessonId`);
  const expectedFilename = `${lessonId}.json`;
  if (path11.posix.basename(label) !== expectedFilename) throw new Error(`${label} filename must match lessonId ${lessonId}.`);
  const missionId = safeId2(value.missionId, `${label}.missionId`);
  hash2(value.contractDigest, `${label}.contractDigest`);
  if (!LESSON_SCOPES.has(value.scope)) throw new Error(`${label}.scope must be global or mission.`);
  if (!LESSON_KINDS.has(value.kind)) throw new Error(`${label}.kind is unsupported.`);
  if (value.researchTreeOrigin !== void 0) {
    if (value.kind !== "failure" || value.scope !== "mission") throw new Error(`${label} researchTreeOrigin is allowed only on mission-scoped failure lessons.`);
    assertSealed4(value.researchTreeOrigin, LESSON_RESEARCH_TREE_ORIGIN_FIELDS, `${label}.researchTreeOrigin`);
    safeId2(value.researchTreeOrigin.nodeId, `${label}.researchTreeOrigin.nodeId`);
    safeId2(value.researchTreeOrigin.blockedReasonCode, `${label}.researchTreeOrigin.blockedReasonCode`);
    if (!Number.isSafeInteger(value.researchTreeOrigin.treeRevision) || value.researchTreeOrigin.treeRevision < 1) throw new Error(`${label}.researchTreeOrigin.treeRevision must be a positive safe integer.`);
  }
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
    safeId2(value.supersedesLessonId, `${label}.supersedesLessonId`);
    if (value.supersedesLessonId === lessonId) throw new Error(`${label} must not supersede itself.`);
  }
  exactIso3(value.createdAt, `${label}.createdAt`);
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
function validateJsonDirectory(root, relativeDirectory, manifest, validate, context = {}) {
  const directory = path11.join(root, relativeDirectory);
  const values = [];
  for (const entry of fs10.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isSymbolicLink()) throw new Error(`${path11.posix.join(relativeDirectory, entry.name)} must not be a symbolic link.`);
    if (!entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${path11.posix.join(relativeDirectory, entry.name)} must be a regular JSON file.`);
    const relativePath = path11.posix.join(relativeDirectory, entry.name);
    values.push(validate(readJsonStrict2(path11.join(root, relativePath), relativePath), manifest, relativePath, context));
  }
  return values;
}
function requiredPathProblem(root, relativePath, kind) {
  const fullPath = path11.join(root, relativePath);
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
      const relativePath = prefix ? path11.posix.join(prefix, entry.name) : entry.name;
      const fullPath = path11.join(directory, entry.name);
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
        entries.push({ ...metadata, kind: "file", sizeBytes: String(stat.size), sha256: sha2562(fs10.readFileSync(fullPath)) });
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
  const doveRoot = path11.join(workspace, ".dove");
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
  const doveRoot = path11.join(workspace, ".dove");
  if (!pathExistsNoFollow(doveRoot)) {
    return { workspace, state: "absent", category: "absent", healthy: false, schemaVersion: null, detectedSchema: "absent" };
  }
  let source;
  try {
    source = { identity: sourceIdentity(doveRoot) };
  } catch (error) {
    return { workspace, state: "invalid-root", category: "invalid", healthy: false, schemaVersion: null, detectedSchema: "invalid-root", error: error instanceof Error ? error.message : String(error) };
  }
  const manifestPath = path11.join(doveRoot, "manifest.json");
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
      ...CURRENT_SCHEMA_FORBIDDEN_LEGACY_PATHS.filter((relativePath) => fs10.existsSync(path11.join(workspace, relativePath))).map((relativePath) => `${relativePath} is a retained legacy artifact and must not coexist with current schema ${DOVE_WORKSPACE_SCHEMA_VERSION}`)
    ].filter(Boolean);
    if (problems.length > 0) throw new Error(`Dove schema declaration contradicts required layout: ${problems.join("; ")}.`);
    const project = validateDoveProject(readJsonStrict2(path11.join(doveRoot, "project.json"), ".dove/project.json"), manifest);
    const missionValues = validateJsonDirectory(workspace, ".dove/missions", manifest, validateMissionShape);
    const missionGraph = validateMissionGraph(missionValues.map((mission) => ({ filename: `${mission.missionId}.json`, mission })));
    const missions = missionGraph.missions;
    const researchTreeValues = validateJsonDirectory(workspace, ".dove/research-trees", manifest, (value, _manifest, label) => {
      const missionId = path11.posix.basename(label, ".json");
      const mission = missions.get(missionId);
      if (!mission) throw new Error(`${label} references unknown mission ${missionId}.`);
      return validateResearchTree(value, { label, workspaceId: manifest.workspaceId, missionId, contractDigest: mission.contractDigest });
    });
    const researchTrees = new Map(researchTreeValues.map((tree) => [tree.missionId, tree]));
    const receiptLedger = readExecutionReceiptLedger(workspace, { manifest, missions, missionGraph });
    const lessonsDirectory = path11.join(workspace, ".dove/lessons");
    if (pathExistsNoFollow(lessonsDirectory)) {
      const stat = fs10.lstatSync(lessonsDirectory);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(".dove/lessons must be a real directory when present.");
      const lessons = new Map(validateJsonDirectory(workspace, ".dove/lessons", manifest, validateLessonShape, { missions }).map((lesson) => [lesson.lessonId, lesson]));
      validateLessonSupersession(lessons);
    }
    for (const relativeDirectory of [".dove/receipts/completion", ".dove/receipts/authority"]) {
      const entries = fs10.readdirSync(path11.join(workspace, relativeDirectory));
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
  return path11.join(workspace, ".dove-archive", `schema-${schemaLabel}-${String(treeDigest).slice(0, 24)}`);
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
function readArtifactLineage(root) {
  const ledger = readArtifactLedger(root);
  return {
    schemaVersion: ledger.schemaVersion,
    workspaceId: ledger.workspaceId,
    artifacts: ledger.currentLineage,
    updatedAt: ledger.updatedAt
  };
}
function readArtifactHistory(root) {
  return readArtifactLedger(root).artifactHistory;
}

// src/core/mission-contracts.mjs
import crypto6 from "node:crypto";
import fs12 from "node:fs";
import path13 from "node:path";

// src/core/workspace-init.mjs
import fs11 from "node:fs";
import path12 from "node:path";
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
function assertPlainObject5(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}
function assertAllowed(args) {
  assertPlainObject5(args, "dove init arguments");
  const unknown = Object.keys(args).filter((field) => !INIT_FIELDS.has(field));
  if (unknown.length > 0) throw new Error(`dove init does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}
function goalFrom(args) {
  const goal = typeof args.goal === "string" ? args.goal.trim() : "";
  if (!goal) throw new Error("Dove init requires a non-empty goal.");
  return goal;
}
function mutationModeFor2(root, args) {
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
  const archiveParent = path12.join(workspace, ".dove-archive");
  if (path12.dirname(archiveTarget) !== archiveParent) {
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
    { type: "atomic-directory-rename", from: ".dove", to: path12.relative(envelope.workspace, envelope.archiveTarget).split(path12.sep).join("/") },
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
function buildProposal2(root, args = {}) {
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
  const mutationMode = mutationModeFor2(workspace, args);
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
      ...proposal.envelope.archiveReset ? [".dove", path12.relative(proposal.envelope.workspace, proposal.envelope.archiveTarget).split(path12.sep).join("/")] : [],
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
      confirmArgs: args,
      proposalToken: Buffer.from(JSON.stringify({ version: DOVE_INIT_PROPOSAL_VERSION, confirmArgs: args }), "utf8").toString("base64url")
    },
    mutation: mutationMetadata(proposal, false)
  };
}
function assertExactReplay2(proposal, args) {
  if (args.confirmed !== true) return;
  const replay = exactReplayInput(args);
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
function previewDoveInit(root, args = {}) {
  assertAllowed(args);
  if (args.confirmed === true) throw new Error("previewDoveInit does not accept confirmed replay.");
  return proposalResult(buildProposal2(root, args));
}
function stageDoveInitialization(context, proposal) {
  if (proposal.envelope.archiveReset) {
    context.replaceDirectory(".dove", {
      archiveTarget: path12.relative(proposal.envelope.workspace, proposal.envelope.archiveTarget).split(path12.sep).join("/")
    });
  } else {
    context.replaceDirectory(".dove");
  }
  for (const relativePath of MINIMAL_WORKSPACE_DIRECTORIES) context.ensureDirectory(relativePath);
  context.writeJson(".dove/manifest.json", proposal.documents.manifest);
  context.writeJson(".dove/project.json", proposal.documents.project);
}
function initDoveWorkspace(root, args = {}, options = {}) {
  assertAllowed(args);
  const proposal = buildProposal2(root, args);
  if (args.confirmed !== true) return proposalResult(proposal);
  assertExactReplay2(proposal, args);
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
var PROJECT_IDENTITY_SCHEMA_VERSION = 1;
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
function sha2563(value) {
  return crypto6.createHash("sha256").update(value).digest("hex");
}
function normalizeString2(value, fallback = null) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim();
  return normalized || fallback;
}
function assertPlainObject6(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object.`);
  }
}
function assertAllowedFields(args, allowed, label) {
  assertPlainObject6(args, `${label} arguments`);
  const unknown = Object.keys(args).filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}
function canonicalWorkspace(root) {
  return fs12.realpathSync.native(path13.resolve(root));
}
function slugify(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "mission";
}
function normalizeMissionId(value, goal) {
  const fallback = `mission-${slugify(goal)}-${sha2563(goal).slice(0, 10)}`;
  const missionId = normalizeString2(value, fallback);
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(missionId)) {
    throw new Error("missionId must start with a lowercase letter or digit and contain only lowercase letters, digits, dot, underscore, or hyphen.");
  }
  return missionId;
}
function missionContractContent(args = {}) {
  return normalizeMissionContractContent(args);
}
var currentMissionContractMetadata2 = currentMissionContractMetadata;
var assertCurrentMissionContract2 = assertCurrentMissionContract;
function missionPath(missionId) {
  return path13.posix.join(ARTIFACT_PATHS.missionsDir, `${missionId}.json`);
}
function fileExists(root, relativePath) {
  const context = currentMutationContext(root);
  return context ? context.fileExists(relativePath) : fs12.existsSync(path13.join(root, relativePath));
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
  const goal = normalizeString2(args.goal, null);
  const workspaceId = normalizeString2(args.workspaceId, null) ?? newWorkspaceId();
  const createdAt = normalizeString2(args.createdAt, null) ?? nowIso();
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
    sha256: sha2563(fs12.readFileSync(fullPath))
  };
}
function directoryArtifactIdentity(relativePath, fullPath) {
  const entries = [];
  const visit = (directoryPath, directoryRelativePath) => {
    for (const entry of fs12.readdirSync(directoryPath, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = path13.join(directoryPath, entry.name);
      const entryRelativePath = path13.posix.join(directoryRelativePath, entry.name);
      const stat = fs12.lstatSync(entryPath, { bigint: true });
      const metadata = { path: entryRelativePath, mode: Number(stat.mode), ctimeNs: String(stat.ctimeNs), mtimeNs: String(stat.mtimeNs) };
      if (stat.isSymbolicLink()) {
        throw new Error(`Mission target artifact directories must not contain symbolic links: ${path13.posix.join(relativePath, entryRelativePath)}.`);
      } else if (stat.isDirectory()) {
        entries.push({ ...metadata, kind: "directory" });
        visit(entryPath, entryRelativePath);
      } else if (stat.isFile()) {
        entries.push({ ...metadata, kind: "file", sizeBytes: String(stat.size), sha256: sha2563(fs12.readFileSync(entryPath)) });
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
    treeDigest: sha2563(stableMissionSerialize(entries))
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
  const fullPath = path13.join(root, relativePath);
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
function validateProposedMissionGraph(root, projectIdentity, mission) {
  const existing = projectIdentity.required ? [] : [...openDoveWorkspace(root, { operation: "Dove mission graph validation" }).missions.values()];
  validateMissionGraph([
    ...existing.map((item) => ({ filename: `${item.missionId}.json`, mission: item })),
    { filename: `${mission.missionId}.json`, mission }
  ]);
}
function buildMissionProposal(root, args = {}) {
  const workspace = canonicalWorkspace(root);
  const content = missionContractContent(args);
  const missionId = normalizeMissionId(args.missionId, content.goal);
  const contractDigest = missionContractDigest(missionId, content);
  const mutationMode = missionMutationMode(root, args);
  const projectIdentity = projectIdentitySnapshot(root, workspace, {
    goal: content.goal,
    workspaceId: args.workspaceId,
    createdAt: args.createdAt
  }, mutationMode);
  if (!projectIdentity.required) {
    const suppliedWorkspaceId = normalizeString2(args.workspaceId, projectIdentity.workspaceId);
    const suppliedCreatedAt = normalizeString2(args.createdAt, projectIdentity.createdAt);
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
  const proposalDigest = sha2563(stableMissionSerialize(envelope));
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
function assertReplayHeader(proposal, args) {
  const suppliedDigest = normalizeString2(args.proposalDigest, "");
  if (!/^[0-9a-f]{64}$/u.test(suppliedDigest) || !normalizeString2(args.missionId, null)) {
    throw new Error("Confirmed Dove mission materialization requires the exact proposalDigest and missionId returned by the selected local proposal replay data.");
  }
  if (!currentMutationContext(proposal.workspace)) {
    throw new Error("Confirmed Dove mission materialization requires an active MutationContext; direct core replay cannot write outside the selected mutation mode.");
  }
  if (args.proposalVersion !== MISSION_PROPOSAL_VERSION) {
    throw new Error("The selected local Dove mission proposal replay version is not supported. Request a fresh proposal.");
  }
  if (normalizeString2(args.proposalWorkspace, "") !== proposal.workspace) {
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
  assertAllowedFields(args, new Set(MISSION_CONTRACT_INPUT_FIELDS), "Dove mission preview");
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
  const operation = args.operation ?? "create";
  if (operation === "reevaluate-research-tree") return reevaluateResearchTree(root, args);
  if (operation !== "create") throw new Error("create_dove_mission operation must be create or reevaluate-research-tree.");
  assertAllowedFields(args, /* @__PURE__ */ new Set([...MISSION_CONTRACT_INPUT_FIELDS, ...MISSION_REPLAY_CONTROL_FIELDS, "operation"]), "create_dove_mission");
  const createArgs = Object.fromEntries(Object.entries(args).filter(([field]) => field !== "operation"));
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
function initDoveGoal(root, args = {}) {
  assertGovernanceMutationRegistered("init-dove-goal", "guarded");
  assertAllowedFields(args, INIT_INPUT_FIELDS, "init_dove_goal");
  return initDoveWorkspace(root, args);
}

// src/core/domain-artifacts.mjs
var SAFE_ID4 = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
function domainSafeId(value, label) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!SAFE_ID4.test(normalized)) throw new Error(`${label} must be a safe lowercase identifier.`);
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
  return crypto7.createHash("sha256").update(value).digest("hex");
}
function readCurrentMission(root, missionId, operation = "Domain workflow") {
  const workspace = openDoveWorkspace(root, { operation });
  const normalizedMissionId = domainSafeId(missionId, "missionId");
  const relativePath = path14.posix.join(ARTIFACT_PATHS.missionsDir, `${normalizedMissionId}.json`);
  const fullPath = path14.resolve(root, relativePath);
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
  return { path: canonicalPath2, sha256: sha256File(path14.resolve(root, canonicalPath2)) };
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
  if (Buffer.isBuffer(item.content) && isPatchPlanMode(root) && path14.extname(relativePath).toLowerCase() !== ".svg") {
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
  const receiptPath = path14.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receiptId}.json`);
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
  const artifacts = writes.map(({ path: artifactPath, kind, sha256: sha2564 }) => ({ path: artifactPath, kind, sha256: sha2564 }));
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
import path15 from "node:path";
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
function sealed(value, fields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  return value;
}
function exchangePath(exchangeId, leaf) {
  return path15.posix.join(".dove/reviews/exchanges", exchangeId, leaf);
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
  const extension = path15.posix.extname(sourcePath2);
  return exchangePath(exchangeId, `package/artifacts/artifact-${String(index + 1).padStart(4, "0")}${extension}`);
}
function importedReviewPath(reviewId) {
  return path15.posix.join(".dove/reviews", `${reviewId}.json`);
}
function importedReportPath(reviewId) {
  return path15.posix.join(".dove/reviews", `${reviewId}.report.md`);
}
function exactTimestamp2(value, label) {
  const text = domainNonEmptyText(value, label);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return text;
}
function exactHash(value, label) {
  const hash3 = String(value ?? "");
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
  const content = snapshot?.exists && snapshot.type === "file" && snapshot.buffer ? Buffer.from(snapshot.buffer) : fs14.readFileSync(path15.resolve(root, canonicalPath2));
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
function normalizePackageArtifacts(value, label = "packageArtifacts") {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must contain package artifact mappings.`);
  const sourcePaths = /* @__PURE__ */ new Set();
  const packagePaths = /* @__PURE__ */ new Set();
  const normalized = value.map((item, index) => {
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
function reviewPreparationEnvelope(root, prepared) {
  return {
    workspace: fs14.realpathSync.native(path15.resolve(root)),
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
function prepareReviewExchange(root, args = {}, options = {}) {
  assertSealedDomainArgs(args, PREPARE_FIELDS, "prepare_review_exchange");
  const prepared = reviewPreflight(root, args, "Review exchange preparation");
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
function assertPreparationReceipt(workspace, mission, manifestLeaf, inputLeaf, manifestPath, inputPath, packageArtifacts) {
  const expected = new Map([
    [inputPath, inputLeaf.sha256],
    [manifestPath, manifestLeaf.sha256],
    ...packageArtifacts.map((item) => [item.packagePath, item.packageSha256])
  ]);
  const receipt = workspace.receiptLedger.receipts.find((item) => {
    if (item.producer?.kind !== "dove-internal" || item.producer?.actionId !== "prepare-review-exchange") return false;
    const artifacts = new Map(item.artifacts.map((artifact) => [artifact.path, artifact]));
    return artifacts.size === expected.size && [...expected].every(([artifactPath, sha2564]) => artifacts.get(artifactPath)?.sha256 === sha2564);
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
    artifacts: receiptArtifacts.map(({ path: artifactPath, kind, sha256: sha2564 }) => ({ path: artifactPath, kind, sha256: sha2564 })),
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
  const receiptPath = path15.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${receipt.receiptId}.json`);
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
function importReviewExchange(root, args = {}) {
  assertSealedDomainArgs(args, IMPORT_FIELDS, "import_review_exchange");
  const { workspace, mission } = readCurrentMission(root, args.missionId, "Review exchange import");
  assertMissionAcceptsWrites(workspace, mission);
  const exchangeId = domainSafeId(args.exchangeId, "exchangeId");
  const reviewId = domainSafeId(args.reviewId, "reviewId");
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
  const directory = path15.resolve(root, ".dove/reviews");
  if (!fs14.existsSync(directory)) return [];
  return fs14.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => {
    const reviewPath = path15.posix.join(".dove/reviews", entry.name);
    try {
      const review = sealed(JSON.parse(fs14.readFileSync(path15.resolve(root, reviewPath), "utf8")), IMPORTED_REVIEW_FIELDS, `Imported review ${reviewPath}`);
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
function normalizeExpectedCoverageSnapshots(value) {
  if (value === void 0) return null;
  const normalized = normalizeReviewSnapshots(value, "expectedSnapshots");
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
      manifest = sealed(JSON.parse(fs14.readFileSync(path15.resolve(root, exchange.manifestPath), "utf8")), MANIFEST_FIELDS2, `Imported review ${review.reviewId} manifest`);
      input = sealed(JSON.parse(fs14.readFileSync(path15.resolve(root, exchange.inputPath), "utf8")), INPUT_FIELDS, `Imported review ${review.reviewId} input`);
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
function verifyReviewCoverageInput(root, args, fields, operation) {
  assertSealedDomainArgs(args, fields, operation);
  const { workspace, mission } = readCurrentMission(root, args.missionId, "Review coverage verification");
  const requestedPaths = args.artifactPaths === void 0 ? [] : domainStringArray(args.artifactPaths, "artifactPaths");
  const expected = normalizeExpectedCoverageSnapshots(args.expectedSnapshots);
  const requested = expected ? { snapshot: expected, failures: [] } : requestedCoverageSnapshot(root, mission.missionId, requestedPaths);
  const assessments = readImportedReviews(root, mission.missionId).map((item) => assessImportedReview(root, workspace, mission, item, requested.snapshot));
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
var HASH_PATTERN4 = /^[0-9a-f]{64}$/u;
var ARTIFACT_KINDS = /* @__PURE__ */ new Set(["report", "document", "code", "data", "figure", "media", "other"]);
var VALIDATION_KINDS = /* @__PURE__ */ new Set(["test-log", "typecheck-log", "lint-log", "build-log", "audit-log", "validation-log", "command-output"]);
var RECEIPT_FIELDS2 = /* @__PURE__ */ new Set(["schemaVersion", "workspaceId", "receiptId", "ledgerSequence", "missionId", "contractDigest", "summary", "artifacts", "validations", "criteriaSatisfied", "producedAt", "recordedAt", "producer"]);
var ARTIFACT_FIELDS2 = /* @__PURE__ */ new Set(["path", "kind", "sha256", "derivedReferences"]);
var VALIDATION_FIELDS2 = /* @__PURE__ */ new Set(["kind", "reference", "outputHash"]);
var CRITERION_FIELDS2 = /* @__PURE__ */ new Set(["criterionId", "evidenceRefs", "evidenceBindings"]);
var EVIDENCE_BINDING_FIELDS2 = /* @__PURE__ */ new Set(["reference", "sha256", "receiptId"]);
function missionPath2(missionId) {
  return path16.posix.join(ARTIFACT_PATHS.missionsDir, `${missionId}.json`);
}
function sealed2(value, allowed) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => allowed.has(key));
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
    const value = reference.slice("source:".length);
    const evaluation = evaluateSourceReferences(root, [value], missionId)[0] ?? { eligible: false, reason: "unknown-source" };
    return { ...evaluation, evidenceSha256: evaluation.source?.capturedMaterial?.sha256 ?? null };
  }
  if (reference.startsWith("note:")) {
    const value = reference.slice("note:".length);
    const evaluation = evaluateNoteReferences(root, [value], missionId)[0] ?? { eligible: false, reason: "unknown-note" };
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
function assessMissionFromWorkspace(root, workspace, missionId, state) {
  if (state.memo.has(missionId)) return state.memo.get(missionId);
  if (state.visiting.has(missionId)) throw new Error(`Mission dependency assessment contains a cycle at ${missionId}.`);
  const mission = workspace.missions.get(missionId);
  if (!mission) throw new Error(`Mission does not exist: ${missionId}.`);
  state.visiting.add(missionId);
  try {
    const relativePath = missionPath2(missionId);
    let missionContractFailure = null;
    try {
      assertCurrentMissionContract2(mission);
    } catch (error) {
      missionContractFailure = error instanceof Error ? error.message : String(error);
    }
    const receipts = workspace.receiptLedger.receipts.filter((receipt) => receipt.missionId === missionId);
    const receiptAssessments = receipts.map((receipt) => receiptAssessment(root, mission, receipt, workspace.manifest.workspaceId, state.currentOwnerByPath, missionContractFailure === null));
    const artifactCoverage = artifactCoverageAssessment(root, mission, state.currentOwnerByPath);
    const criterionCoverage = criterionCoverageAssessment(mission, receiptAssessments);
    const requirements = evidenceRequirementAssessment(root, mission, receiptAssessments, artifactCoverage);
    const dependencyCoverage = (workspace.missionGraph.dependenciesByMission.get(missionId) ?? []).map((dependencyMissionId) => {
      const assessment2 = assessMissionFromWorkspace(root, workspace, dependencyMissionId, state);
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
    state.memo.set(missionId, assessment);
    return assessment;
  } finally {
    state.visiting.delete(missionId);
  }
}
function assessMissionCompletion(root, args = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("assess_mission_completion arguments must be a plain object.");
  const unknown = Object.keys(args).filter((field) => field !== "missionId");
  if (unknown.length > 0) throw new Error(`assess_mission_completion does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  const missionId = typeof args.missionId === "string" ? args.missionId.trim() : "";
  if (!missionId) throw new Error("assess_mission_completion requires missionId.");
  const workspace = openDoveWorkspace(root, { operation: "Mission completion assessment" });
  return assessMissionFromWorkspace(root, workspace, missionId, {
    memo: /* @__PURE__ */ new Map(),
    visiting: /* @__PURE__ */ new Set(),
    currentOwnerByPath: new Map(workspace.receiptLedger.currentOwnership.map((item) => [item.path, item]))
  });
}

// src/core/retained-domain-workflows.mjs
import fs15 from "node:fs";
import path17 from "node:path";
var NOTE_FIELDS2 = /* @__PURE__ */ new Set(["missionId", "noteId", "title", "summary", "quotes", "claims", "openQuestions", "sourceIds", "artifactRefs"]);
var CLAIM_FIELDS = /* @__PURE__ */ new Set(["missionId", "claims"]);
var CLAIM_ITEM_FIELDS = /* @__PURE__ */ new Set(["claimId", "text", "sourceIds", "noteIds", "artifactRefs", "experimentResultIds", "gap"]);
var DRAFT_FIELDS = /* @__PURE__ */ new Set(["missionId", "draftId", "title", "body", "summary", "evidenceRefs", "artifactRefs"]);
var DRAFT_META_FIELDS = /* @__PURE__ */ new Set(["missionId", "draftId", "title", "summary", "evidenceRefs", "artifactRefs"]);
var EXPERIMENT_FIELDS = /* @__PURE__ */ new Set(["missionId", "experimentId", "title", "goal", "hypothesis", "protocol", "successCriteria", "comparisonTargets", "result", "resultEvidenceRefs", "auditFindings", "integrityFlags", "claimId", "bridgeReason"]);
var FIGURE_FIELDS = /* @__PURE__ */ new Set(["missionId", "figureId", "intent", "purpose", "materials", "prompt", "outputPath", "outputSha256", "caption", "qaFindings"]);
var REBUTTAL_FIELDS = /* @__PURE__ */ new Set(["missionId", "issues", "strategy", "responses"]);
var VERSION_FIELDS = /* @__PURE__ */ new Set(["missionId", "versionId", "label", "artifactRefs", "supersedesVersionId"]);
var COMPARE_FIELDS = /* @__PURE__ */ new Set(["missionId", "fromVersionId", "toVersionId"]);
function filePath(directory, id, extension = "json") {
  return path17.posix.join(directory, `${id}.${extension}`);
}
function existingBoundRecord(root, relativePath, missionId, label) {
  const current = fs15.existsSync(path17.resolve(root, relativePath)) ? readJson(root, relativePath, null) : null;
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
function upsertNote(root, args = {}) {
  assertSealedDomainArgs(args, NOTE_FIELDS2, "upsert_note");
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
  if (sourceIds.length === 0 && artifacts.length === 0) throw new Error("upsert_note requires at least one current mission artifact reference; sourceIds remain unavailable until a trusted positive source verifier exists.");
  const relativePath = filePath(".dove/notes", noteId);
  existingBoundRecord(root, relativePath, mission.missionId, `Note ${noteId}`);
  const note = {
    schemaVersion: 2,
    noteId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
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
  if (evidenceRefs.length === 0) throw new Error("upsert_draft body requires at least one current eligible evidence or artifact reference.");
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
  const snapshot = snapshotArtifactBuffer(root, canonical, "Figure outputPath");
  if (expectedHash && expectedHash !== snapshot.sha256) throw new Error("Figure output hash does not match the imported file.");
  return snapshot;
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
    const sourceContent = output.content;
    const extension = path17.extname(output.path).toLowerCase() || ".bin";
    const finalPath = filePath(".dove/figures", `${figureId}.final`, extension.slice(1));
    const caption = domainNonEmptyText(args.caption, "caption");
    const qaFindings = domainStringArray(args.qaFindings, "qaFindings");
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
  } else if (args.caption !== void 0 || args.qaFindings !== void 0 || args.outputSha256 !== void 0) {
    throw new Error("Figure caption, QA, or hash import requires outputPath.");
  }
  return { ...finalizeDomainArtifacts(root, { actionId: "run-figure-workflow", missionId: mission.missionId, summary: imported ? `Imported figure ${figureId} with provenance and QA.` : `Prepared figure ${figureId} materials and prompt.`, completionEligible: false, writes }), plan, imported, qa, hostBoundary: { executesProvider: false, acceptsImportedOutput: true } };
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
  if (fs15.existsSync(path17.resolve(root, versionPath(versionId)))) throw new Error(`Version snapshot id is already occupied: ${versionId}.`);
  const artifacts = resolveMissionArtifactReferences(root, mission.missionId, args.artifactRefs, "artifactRefs");
  if (artifacts.length === 0) throw new Error("create_version_snapshot requires current mission artifacts.");
  const supersedesVersionId = args.supersedesVersionId === void 0 ? null : domainSafeId(args.supersedesVersionId, "supersedesVersionId");
  if (supersedesVersionId) {
    currentBoundRecord(root, versionPath(supersedesVersionId), mission.missionId, `Superseded version ${supersedesVersionId}`);
  }
  const copiedArtifacts = artifacts.map(({ path: artifactPath, kind, sha256: sha2564, receiptId }) => {
    const extension = path17.extname(artifactPath);
    const snapshotPath = filePath(path17.posix.join(".dove/versions", versionId, "artifacts"), domainSha256(artifactPath).slice(0, 20), extension ? extension.slice(1) : "bin");
    return { path: artifactPath, kind, sha256: sha2564, receiptId, snapshotPath };
  });
  const snapshot = { schemaVersion: 1, versionId, missionId: mission.missionId, label: typeof args.label === "string" && args.label.trim() ? args.label.trim() : versionId, artifacts: copiedArtifacts, supersedesVersionId, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
  const writes = [
    ...copiedArtifacts.map((item) => ({ path: item.snapshotPath, kind: item.kind, content: fs15.readFileSync(path17.resolve(root, item.path)), derivedReferences: [`artifact:${item.path}`] })),
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
  return { status: "compared", zeroWrite: true, comparison, writes: [] };
}
function queryDomainIntegrity(root, missionId = null) {
  const workspace = openDoveWorkspace(root, { operation: "Domain integrity query" });
  const ownership = readArtifactOwnership(root);
  const domainPrefixes = [".dove/sources/", ".dove/notes/", ".dove/claims/", ".dove/experiments/", ".dove/drafts/", ".dove/figures/", ".dove/rebuttal/", ".dove/versions/"];
  const domainArtifacts = ownership.artifacts.filter((item) => domainPrefixes.some((prefix) => item.path.startsWith(prefix))).filter((item) => !missionId || item.missionId === missionId);
  const stale = domainArtifacts.filter((item) => !fs15.existsSync(path17.resolve(root, item.path)) || domainSha256(fs15.readFileSync(path17.resolve(root, item.path))) !== item.sha256);
  return { workspaceId: workspace.manifest.workspaceId, missionId, artifactCount: domainArtifacts.length, staleArtifactCount: stale.length, stalePaths: stale.map((item) => item.path) };
}

// src/core/execution-receipts.mjs
import crypto9 from "node:crypto";
import fs16 from "node:fs";
import path18 from "node:path";
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
var HOST_OUTCOME_FIELDS = /* @__PURE__ */ new Set([
  "missionId",
  "summary",
  "artifactPaths",
  "validationPaths"
]);
var ARTIFACT_FIELDS3 = /* @__PURE__ */ new Set(["path", "kind", "sha256"]);
var VALIDATION_FIELDS3 = /* @__PURE__ */ new Set(["kind", "reference", "outputHash"]);
var CRITERION_FIELDS3 = /* @__PURE__ */ new Set(["criterionId", "evidenceRefs"]);
var RECEIPT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
var HASH_PATTERN5 = /^[0-9a-f]{64}$/u;
var EVIDENCE_REF_PATTERN = /^(artifact|validation|source|note):(.+)$/u;
var POST_COMMIT_ASSESSMENT_KIND = "assess-mission-completion";
function assertPlainObject7(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object.`);
  }
}
function assertAllowedFields2(value, allowed, label) {
  assertPlainObject7(value, label);
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
  const hash3 = nonEmptyString2(value, label).toLowerCase();
  if (!HASH_PATTERN5.test(hash3)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  }
  return hash3;
}
function safeId3(value, label) {
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
function normalizeArtifacts(root, mission, value) {
  if (value === void 0) return [];
  if (!Array.isArray(value)) throw new Error("artifacts must be an array.");
  const seen = /* @__PURE__ */ new Set();
  const artifacts = value.map((item, index) => {
    const label = `artifacts[${index}]`;
    assertAllowedFields2(item, ARTIFACT_FIELDS3, label);
    const rawPath = nonEmptyString2(item.path, `${label}.path`);
    const kind = nonEmptyString2(item.kind, `${label}.kind`);
    if (!ARTIFACT_KIND_SET.has(kind)) {
      throw new Error(`${label}.kind must be one of: ${EXECUTION_RECEIPT_ARTIFACT_KINDS.join(", ")}.`);
    }
    const sha2564 = hashString(item.sha256, `${label}.sha256`);
    const inspected = inspectHashedFile(root, rawPath, sha2564, label);
    assertNotDoveLessonArtifactPath(inspected.path, `${label}.path`);
    if (seen.has(inspected.path)) throw new Error(`artifacts contains duplicate canonical path ${inspected.path}.`);
    seen.add(inspected.path);
    return { path: inspected.path, kind, sha256: sha2564 };
  });
  return artifacts;
}
function normalizeValidations(root, value) {
  if (value === void 0) return [];
  if (!Array.isArray(value)) throw new Error("validations must be an array.");
  const seen = /* @__PURE__ */ new Set();
  return value.map((item, index) => {
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
  const [, kind, value] = match;
  if (kind === "source") {
    const evaluation = evaluateSourceReferences(root, [value], missionId)[0] ?? { eligible: false, reason: "unknown-source" };
    return { ...evaluation, evidenceSha256: evaluation.source?.capturedMaterial?.sha256 ?? null };
  }
  if (kind === "note") {
    const evaluation = evaluateNoteReferences(root, [value], missionId)[0] ?? { eligible: false, reason: "unknown-note" };
    return { ...evaluation, evidenceSha256: evaluation.owner?.sha256 ?? null };
  }
  return { eligible: null, kind, value, evidenceSha256: null };
}
function normalizeCriteria(root, mission, value, artifacts, validations, ledger, receiptId) {
  const requiredCriteria = missionCompletionCriteria(mission);
  if (!Array.isArray(value)) throw new Error("criteriaSatisfied must be an array.");
  const requiredIds = new Set(requiredCriteria.map((item) => item.criterionId));
  const artifactRefs = new Set(artifacts.map((artifact) => `artifact:${artifact.path}`));
  const validationRefs = new Set(validations.map((validation) => `validation:${validation.reference}`));
  const seen = /* @__PURE__ */ new Set();
  const criteria = value.map((item, index) => {
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
function validateExecutionReceipt(root, args = {}) {
  const workspace = openDoveWorkspace(root, { operation: "Execution receipt validation" });
  assertAllowedFields2(args, TOP_LEVEL_FIELDS, "ingest_execution_receipt");
  const receiptId = safeId3(args.receiptId, "receiptId");
  const missionId = safeId3(args.missionId, "missionId");
  const contractDigest = hashString(args.contractDigest, "contractDigest");
  const summary = nonEmptyString2(args.summary, "summary");
  const producedAt = parseProducedAt(args.producedAt);
  const missionRelativePath = missionContractPath(missionId);
  if (!fs16.existsSync(path18.resolve(root, missionRelativePath))) {
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
  if (mutationContext ? mutationContext.fileExists(receiptRelativePath) : fs16.existsSync(path18.resolve(root, receiptRelativePath))) {
    throw new Error(`Execution receipt id is already occupied: ${receiptId}.`);
  }
  const artifacts = normalizeArtifacts(root, mission, args.artifacts);
  const validations = normalizeValidations(root, args.validations);
  const artifactPaths = new Set(artifacts.map((artifact) => artifact.path));
  const overlappingValidation = validations.find((validation) => artifactPaths.has(validation.reference));
  if (overlappingValidation) {
    throw new Error(`Execution receipt artifact and validation paths must be canonically distinct: ${overlappingValidation.reference}.`);
  }
  const criteriaSatisfied = normalizeCriteria(root, mission, args.criteriaSatisfied, artifacts, validations, workspace.receiptLedger, receiptId);
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
function ingestExecutionReceipt(root, args = {}) {
  assertGovernanceMutationRegistered("ingest-execution-receipt", "guarded");
  const mutationContext = currentMutationContext(root);
  if (!mutationContext) throw new Error("ingest_execution_receipt requires an active MutationContext.");
  const { receipt } = validateExecutionReceipt(root, args);
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
function hostOutcomePaths(value, label) {
  if (value === void 0) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const paths = value.map((item, index) => nonEmptyString2(item, `${label}[${index}]`));
  if (new Set(paths).size !== paths.length) throw new Error(`${label} must not contain duplicates.`);
  return paths;
}
function inspectHostOutcomeFile(root, rawPath, label) {
  const inspected = inspectCurrentFile(root, rawPath, label);
  assertNotDoveLessonArtifactPath(inspected.path, label);
  const evidenceRole = artifactEvidenceRole(inspected.path);
  if (evidenceRole === "bookkeeping") {
    throw new Error(`${label} must be a substantive workspace file rather than Dove bookkeeping.`);
  }
  if (evidenceRole === "unsupported") {
    throw new Error(`${label} is not an eligible host-produced workspace file.`);
  }
  return { ...inspected, evidenceRole };
}
function closeHostOutcome(root, args = {}) {
  assertGovernanceMutationRegistered("close-host-outcome", "guarded");
  assertAllowedFields2(args, HOST_OUTCOME_FIELDS, "close_host_outcome");
  const mutationContext = currentMutationContext(root);
  if (!mutationContext) throw new Error("close_host_outcome requires an active MutationContext.");
  const missionId = safeId3(args.missionId, "missionId");
  const summary = nonEmptyString2(args.summary, "summary");
  const artifactPaths = hostOutcomePaths(args.artifactPaths, "artifactPaths");
  const validationPaths = hostOutcomePaths(args.validationPaths, "validationPaths");
  const workspace = openDoveWorkspace(root, { operation: "Host outcome closure" });
  const missionRelativePath = missionContractPath(missionId);
  if (!mutationContext.fileExists(missionRelativePath)) throw new Error(`Mission does not exist: ${missionId}.`);
  const mission = readJson(root, missionRelativePath, null);
  if (!mission || mission.missionId !== missionId) throw new Error(`Mission contract is malformed or mismatched: ${missionId}.`);
  assertMissionAcceptsWrites(workspace, mission, { receipt: true });
  const currentContract = assertCurrentMissionContract2(mission);
  if (mission.workspaceId !== workspace.manifest.workspaceId) throw new Error(`Mission contract workspaceId does not match the current workspace for ${missionId}.`);
  const ownerByPath = new Map(workspace.receiptLedger.currentOwnership.map((item) => [item.path, item]));
  const inspectedArtifacts = artifactPaths.map((artifactPath, index) => inspectHostOutcomeFile(root, artifactPath, `artifactPaths[${index}]`));
  const validations = validationPaths.map((validationPath, index) => inspectHostOutcomeFile(root, validationPath, `validationPaths[${index}]`));
  const allInspectedPaths = [...inspectedArtifacts, ...validations].map((item) => item.path);
  if (new Set(allInspectedPaths).size !== allInspectedPaths.length) {
    throw new Error("Host outcome artifact and validation paths must be canonically distinct.");
  }
  const eligibleArtifacts = inspectedArtifacts.filter((artifact) => {
    const owner = ownerByPath.get(artifact.path);
    if (!owner) {
      if (artifact.evidenceRole !== "external-project") {
        throw new Error(`Host outcome cannot claim an unowned Dove domain artifact: ${artifact.path}.`);
      }
      return true;
    }
    if (owner.missionId !== missionId) {
      if (artifact.evidenceRole === "external-project" && missionSupersedes(workspace.missionGraph, missionId, owner.missionId)) return true;
      throw new Error(`Host outcome artifact is owned by another mission: ${artifact.path}.`);
    }
    if (owner.sha256 === artifact.sha256) return false;
    if (artifact.evidenceRole !== "external-project") {
      throw new Error(`Host outcome cannot claim a changed Dove domain artifact: ${artifact.path}.`);
    }
    return true;
  });
  if (eligibleArtifacts.length === 0) {
    return {
      status: "skipped",
      zeroWrite: true,
      reason: "no-eligible-artifacts",
      artifacts: [],
      validations: [],
      completion: null,
      postCommit: null,
      mutation: {
        mutationMode: mutationContext.mutationMode,
        writesApplied: false,
        paths: []
      }
    };
  }
  const generated = {
    receiptId: `receipt-host-outcome-${crypto9.randomUUID()}`,
    missionId,
    contractDigest: currentContract.contractDigest,
    summary,
    artifacts: eligibleArtifacts.map((artifact) => ({ path: artifact.path, kind: "other", sha256: artifact.sha256 })),
    validations: validations.map((validation) => ({ kind: "validation-log", reference: validation.path, outputHash: validation.sha256 })),
    criteriaSatisfied: [],
    producedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  return ingestExecutionReceipt(root, generated);
}
function readExecutionReceipts(root, missionId = null) {
  const workspace = openDoveWorkspace(root, { operation: "Execution receipt read" });
  return workspace.receiptLedger.receipts.filter((receipt) => !missionId || receipt.missionId === missionId);
}

// src/core/mission-queries.mjs
function statusDetail(args = {}) {
  const detail = args.detail ?? "compact";
  if (detail !== "compact" && detail !== "full") throw new Error("Dove status detail must be compact or full.");
  return detail;
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
  const missionsRoot = path19.resolve(root, ARTIFACT_PATHS.missionsDir);
  const missions = fs17.readdirSync(missionsRoot, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => {
    const relativePath = path19.posix.join(ARTIFACT_PATHS.missionsDir, entry.name);
    let mission;
    try {
      mission = JSON.parse(fs17.readFileSync(path19.resolve(root, relativePath), "utf8"));
    } catch (error) {
      throw new Error(`Malformed durable JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    assertCurrentMissionContract2(mission);
    return mission;
  }).sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)) || left.missionId.localeCompare(right.missionId));
  return { workspace, missions };
}
function emptyStatus(args, language, detail) {
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
  return detail === "full" ? { ...result, detail: "full", manifest: null, project: null, missions: [], integrityAssessment: null, domainIntegrity: null, sourceIntegrity: null, reviewValidity: null, diagnostics: { artifactPathsRead: [], noRefresh: true, noCommandExecution: true, noExternalProcess: true, noGitInspection: true, noSourceMutation: true } } : result;
}
function queryDoveStatus(root, args = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Dove status arguments must be a plain object.");
  const allowed = /* @__PURE__ */ new Set(["missionId", "intent", "detail", "responseLanguage", "language"]);
  const unknown = Object.keys(args).filter((field) => !allowed.has(field));
  if (unknown.length > 0) throw new Error(`Dove status does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  const language = responseLanguage(args);
  const detail = statusDetail(args);
  const { workspace, missions } = readCurrentMissions(root, { allowAbsent: true, operation: "Dove status" });
  if (workspace.state === "absent") return emptyStatus(args, language, detail);
  const requestedMissionId = typeof args.missionId === "string" ? args.missionId.trim() : "";
  const selectedMission = requestedMissionId ? missions.find((mission) => mission.missionId === requestedMissionId) ?? null : missions.length === 1 ? missions[0] : null;
  if (requestedMissionId && !selectedMission) throw new Error(`Mission does not exist: ${requestedMissionId}.`);
  const missionScope = requestedMissionId ? "explicit" : missions.length === 0 ? "none" : missions.length === 1 ? "only-mission" : "workspace";
  const scopedMissions = selectedMission ? [selectedMission] : missionScope === "workspace" ? missions : [];
  const integrityAssessment = selectedMission ? assessMissionCompletion(root, { missionId: selectedMission.missionId }) : null;
  const researchTree = selectedMission ? readResearchTree(root, selectedMission.missionId, { operation: "Dove status research tree" }) : null;
  const compactResearchTree = researchTreeProjection(researchTree, "compact");
  const receipts = readExecutionReceipts(root, selectedMission?.missionId ?? null);
  const malformedReceipt = receipts.find((receipt) => receipt.__readFailure);
  if (malformedReceipt) throw new Error(`Malformed durable JSON in ${path19.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${malformedReceipt.receiptId}.json`)}: ${malformedReceipt.__readFailure}`);
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
    intent: typeof args.intent === "string" ? args.intent.trim() || null : null,
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
function queryDoveMission(root, args = {}) {
  const inspection = openDoveWorkspace(root, { allowAbsent: true, operation: "Dove mission preview" });
  if (inspection.state !== "absent") openDoveWorkspace(root, { operation: "Dove mission preview" });
  return previewDoveMissionContract(root, args);
}

// src/core/lessons.mjs
import fs18 from "node:fs";
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
  const directory = path20.resolve(root, ARTIFACT_PATHS.lessonsDir);
  if (!fs18.existsSync(directory)) return [];
  return fs18.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).sort((left, right) => left.name.localeCompare(right.name)).map((entry) => readJson(root, path20.posix.join(ARTIFACT_PATHS.lessonsDir, entry.name), null));
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
function createdAtFor2(args) {
  if (args.confirmed !== true) return nowIso();
  const createdAt = domainNonEmptyText(args.createdAt, "createdAt");
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== createdAt) {
    throw new Error("createdAt replay data must be an exact ISO-8601 timestamp.");
  }
  return createdAt;
}
function buildProposal3(root, args) {
  const content = normalizedRecordInput(args);
  const { workspace, mission } = readCurrentMission(root, content.missionId, "Dove lesson proposal");
  const mutationMode = normalizeMutationModeForLesson(root, args);
  if (args.confirmed === true) {
    if (args.workspaceId !== workspace.manifest.workspaceId) throw new Error("Confirmed Dove lesson replay no longer matches the workspace identity.");
    if (args.contractDigest !== mission.contractDigest) throw new Error("Confirmed Dove lesson replay no longer matches the mission contract digest.");
  }
  const relativePath = lessonPath(content.lessonId);
  const context = currentMutationContext(root);
  const occupied = context ? context.fileExists(relativePath) : fs18.existsSync(path20.resolve(root, relativePath));
  if (occupied) throw new Error(`Dove lesson id is already occupied: ${content.lessonId}.`);
  const lessons = readLessons(root);
  const evidenceSnapshots = validateEligibleReferences(root, mission.missionId, content.sourceIds, content.noteIds);
  const artifacts = resolveMissionArtifactReferences(root, mission.missionId, content.artifactRefs, "artifactRefs");
  const applicability = resolveMissionArtifactReferences(root, mission.missionId, content.appliesToArtifactRefs, "appliesToArtifactRefs");
  const supersession = assertSupersession(lessons, content);
  const createdAt = createdAtFor2(args);
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
  const replayArgs = {
    confirmed: true,
    proposalVersion: DOVE_LESSON_PROPOSAL_VERSION,
    proposalWorkspace,
    proposalDigest,
    mutationMode,
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
  const proposalToken = Buffer.from(JSON.stringify({ version: DOVE_LESSON_PROPOSAL_VERSION, mutationMode, confirmArgs: replayArgs }), "utf8").toString("base64url");
  return { content, lesson, envelope, proposalDigest, proposalToken, relativePath, mutationMode };
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
function assertExactReplay3(root, proposal, args) {
  if (!currentMutationContext(root)) throw new Error("Confirmed Dove lesson recording requires an active MutationContext.");
  if (args.proposalVersion !== DOVE_LESSON_PROPOSAL_VERSION) throw new Error("The selected Dove lesson proposal version is unsupported. Request a fresh proposal.");
  const expected = confirmArgsFor3(proposal);
  const supplied = Object.fromEntries(Object.entries(args).filter(([field]) => REPLAY_FIELDS2.has(field) || RECORD_FIELDS.has(field)));
  if (stableWorkspaceSerialize(supplied) !== stableWorkspaceSerialize(expected)) {
    throw new Error("The selected Dove lesson proposal no longer matches the exact replay fields, workspace, contract, mutation mode, supersession, or references. Request a fresh proposal.");
  }
}
function mutationMetadata2(proposal, writesApplied, paths = []) {
  return { mutationMode: proposal.mutationMode, writesApplied, paths };
}
function recordDoveLesson(root, args = {}) {
  assertSealedDomainArgs(args, /* @__PURE__ */ new Set([...RECORD_FIELDS, ...REPLAY_FIELDS2]), "record_dove_lesson");
  if (args.confirmed !== true) {
    const replayOnly = Object.keys(args).filter((field) => REPLAY_FIELDS2.has(field) && field !== "mutationMode");
    if (replayOnly.length > 0) {
      throw new Error(`record_dove_lesson proposal does not accept caller replay fields: ${replayOnly.map((field) => `$.${field}`).join(", ")}.`);
    }
  }
  const proposal = buildProposal3(root, args);
  if (args.confirmed !== true) {
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
  assertExactReplay3(root, proposal, args);
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
  const ownership = readArtifactOwnership(root);
  const ownedPaths = new Set(ownership.artifacts.filter((item) => item.missionId === missionId).map((item) => item.path));
  const existingArtifactRefs = artifactRefs.filter((reference) => ownedPaths.has(reference));
  const queryArtifacts = existingArtifactRefs.length > 0 ? resolveMissionArtifactReferences(root, missionId, existingArtifactRefs, "artifactRefs") : [];
  const queryArtifactPaths = /* @__PURE__ */ new Set([...queryArtifacts.map((item) => item.path), ...artifactRefs.filter((reference) => !ownedPaths.has(reference))]);
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
function normalizeStatus2(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
function isProposalOnlyOutcome(result) {
  if (!result || typeof result !== "object") {
    return false;
  }
  const status = normalizeStatus2(result.status ?? result.outcome);
  return result.proposalOnly === true || PROPOSAL_STATUSES.has(status);
}
function isOperationalFailureOutcome(result, { confirmed = false } = {}) {
  if (!result || typeof result !== "object") {
    return false;
  }
  if (!confirmed && isProposalOnlyOutcome(result)) {
    return false;
  }
  const status = normalizeStatus2(result.status ?? result.outcome);
  return OPERATIONAL_FAILURE_STATUSES.has(status) || confirmed && CONFIRMED_EXECUTION_FAILURE_STATUSES.has(status);
}

// src/core/config.mjs
import fs19 from "node:fs";
import os from "node:os";
import path21 from "node:path";
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
  const xdg = normalizedString(env.XDG_CONFIG_HOME) ?? path21.join(os.homedir(), ".config");
  paths.push(path21.join(xdg, "dove", "config.json"));
  if (root) {
    paths.push(path21.resolve(root, ".dove", "config.json"));
    paths.push(path21.resolve(root, ".dove", "config.local.json"));
  }
  return paths;
}
function readConfig(filePath2) {
  if (!fs19.existsSync(filePath2)) return null;
  try {
    const value = JSON.parse(fs19.readFileSync(filePath2, "utf8"));
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
function normalizeString3(value, fallback = null) {
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
  return Array.from(new Set(rawItems.map((item) => normalizeString3(item)).filter(Boolean)));
}
function normalizeProviderId(value) {
  return normalizeString3(value)?.toLowerCase() ?? null;
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
  const text = typeof value === "number" ? String(Math.trunc(value)) : normalizeString3(value);
  if (!text) {
    return null;
  }
  if (!/^\d{4}(?:-\d{4})?$/u.test(text)) {
    throw new Error("Dove network search year must be YYYY or YYYY-YYYY.");
  }
  return text;
}
function normalizeLocale(value) {
  const locale = normalizeString3(value);
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
  const query = normalizeString3(args.query);
  if (!query) {
    throw new Error("Dove network search requires a non-empty query.");
  }
  if (query.length > MAX_QUERY_CHARS) {
    throw new Error(`Dove network search query must be ${MAX_QUERY_CHARS} characters or fewer.`);
  }
  const kind = normalizeString3(args.kind, DEFAULT_KIND).toLowerCase();
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
  const text = normalizeString3(value);
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
  const text = normalizeString3(value)?.replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, "") ?? null;
  if (!text) {
    return null;
  }
  const cleaned = text.trim().toLowerCase();
  return cleaned.startsWith("10.") ? cleaned : null;
}
function normalizeTitle(value) {
  return normalizeString3(Array.isArray(value) ? value[0] : value);
}
function normalizeAuthors(value) {
  if (isPlainObject(value)) {
    return normalizeAuthors(value.author ?? value.authors ?? value.fullName ?? value.name);
  }
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") {
        return normalizeString3(item);
      }
      if (isPlainObject(item)) {
        return normalizeString3(item.fullName ?? item.name ?? item.display_name ?? [item.given, item.family].filter(Boolean).join(" "));
      }
      return null;
    }).filter(Boolean).slice(0, 12);
  }
  const text = normalizeString3(value);
  return text ? text.split(/\s*[,;]\s*/u).map((item) => normalizeString3(item)).filter(Boolean).slice(0, 12) : [];
}
function normalizePublishedAt(year, dateParts) {
  const textYear = typeof year === "number" ? String(year) : normalizeString3(year);
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
  const text = normalizeString3(value);
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
  return normalizeString3(value)?.toLowerCase().replace("_", "-").split("-")[0] ?? null;
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
      const candidateYear = normalizeString3(candidate.publishedAt)?.slice(0, 4);
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
function registrationDraftFor(candidate, provider) {
  const identity = candidate.doi ?? candidate.arxivId ?? candidate.pubmedId ?? candidate.semanticScholarId ?? candidate.title;
  const sourceId = `source-${String(identity ?? "candidate")}`.toLowerCase().replace(/[^a-z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 127);
  return {
    authoritative: false,
    missionId: null,
    sourceId: sourceId || "source-candidate",
    title: candidate.title,
    authors: candidate.authors,
    year: normalizeString3(candidate.publishedAt)?.slice(0, 4) ?? null,
    locator: candidate.url ?? doiUrl(candidate.doi),
    sourceType: provider.kind === "scholarly" ? "scholarly" : "web",
    origin: `network-search:${provider.id}`,
    abstract: candidate.snippet,
    capturePath: null
  };
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
  const normalized = {
    lifecycle: "candidate",
    title,
    url,
    snippet: cleanSnippet(candidate.snippet),
    sourceName: normalizeString3(candidate.sourceName, provider.id),
    publishedAt: normalizeString3(candidate.publishedAt),
    authors: normalizeAuthors(candidate.authors),
    domains: Array.from(new Set(candidateDomains)),
    fieldsOfStudy: normalizeStringArray2(candidate.fieldsOfStudy),
    locale: normalizedLocaleBase(candidate.locale),
    doi,
    arxivId: normalizeString3(candidate.arxivId),
    pubmedId: normalizeString3(candidate.pubmedId),
    semanticScholarId: normalizeString3(candidate.semanticScholarId),
    openAccess: candidate.openAccess === true ? true : candidate.openAccess === false ? false : null,
    providerId: provider.id,
    provenance: {
      providerId: provider.id,
      providerName: provider.id,
      access: provider.access,
      retrievedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    score: Number.isFinite(candidate.score) ? candidate.score : 0,
    warnings: normalizeStringArray2(candidate.warnings),
    captureRequiredForEvidence: true
  };
  return { ...normalized, registrationDraft: registrationDraftFor(normalized, provider) };
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
  return normalizeString3(value)?.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() ?? null;
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
  const year = Number(normalizeString3(publishedAt)?.slice(0, 4));
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
      label: candidates.length > 0 ? "\u5728\u5BBF\u4E3B\u4E2D\u6253\u5F00\u5019\u9009\u5E76\u53EF\u89C1\u5730\u6355\u83B7\u539F\u6587\uFF0C\u7136\u540E\u7528 capturePath \u767B\u8BB0\u5E76\u67E5\u8BE2 source\u3002" : "\u6362\u67E5\u8BE2\u8BCD\u6216\u6539\u7528\u5BBF\u4E3B\u516C\u5F00\u641C\u7D22\u6838\u5B9E\u3002",
      why: "\u8054\u7F51\u641C\u7D22\u53EA\u4EA7\u51FA\u975E\u6743\u5A01 registrationDraft\uFF1B\u6CA1\u6709\u53EF\u89C1\u6355\u83B7\u6587\u4EF6\u65F6\u4E0D\u80FD\u8FDB\u5165\u8BC1\u636E\u94FE\u3002",
      requiredActions: candidates.length > 0 ? ["\u5BBF\u4E3B\u53EF\u89C1\u6355\u83B7\u5019\u9009\u6750\u6599", "\u7528 --capture-path \u8C03\u7528 register_source", "\u8C03\u7528 query_sources \u68C0\u67E5\u5019\u9009\u72B6\u6001"] : ["\u91CD\u65B0\u68C0\u7D22\u6216\u63D0\u4F9B\u53EF\u9A8C\u8BC1 URL"]
    },
    captureRequiredForEvidence: candidates.length > 0,
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
  const kind = normalizeString3(args.kind, "all").toLowerCase();
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
  RESEARCH_TREE_NODE_STATUSES,
  RESEARCH_TREE_PROPOSAL_VERSION,
  RESEARCH_TREE_SCHEMA_VERSION,
  RESEARCH_TREE_WORK_KINDS,
  REVIEW_EXCHANGE_POLICIES,
  REVIEW_EXCHANGE_SCHEMA_VERSION,
  SOURCE_LIFECYCLE_STATES,
  assertCurrentMissionContract2 as assertCurrentMissionContract,
  assessMissionCompletion,
  buildRebuttal,
  buildRebuttalStrategy,
  closeHostOutcome,
  compareVersions,
  createDoveMission,
  createVersionSnapshot,
  currentMissionContractMetadata2 as currentMissionContractMetadata,
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
  readArtifactHistory,
  readArtifactLedger,
  readArtifactLineage,
  readArtifactOwnership,
  readExecutionReceipts,
  readResearchTree,
  recordDoveLesson,
  reevaluateResearchTree,
  registerSource,
  researchTreePath,
  researchTreeProjection,
  resolveDoveResponseLanguage,
  runExperienceWorkflow,
  runFigureWorkflow,
  searchNetwork,
  upsertClaims,
  upsertDraft,
  upsertDraftMetadata,
  upsertNote,
  validateExecutionReceipt,
  validateMissionGraph,
  validateResearchTree,
  verifyReviewCoverage,
  verifySource
};
