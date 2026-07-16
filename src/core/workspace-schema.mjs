import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { missionCompletionCriteria, missionContractDigest, missionEvidenceRequirements } from "./mission-contract-integrity.mjs";
import { validateMissionGraph } from "./mission-graph.mjs";
import { readExecutionReceiptLedger } from "./receipt-ledger.mjs";
import { DOVE_WORKSPACE_SCHEMA_VERSION, PACKAGE_VERSION } from "./schema.mjs";

export { DOVE_WORKSPACE_SCHEMA_VERSION };
export const DOVE_MANIFEST_SCHEMA_VERSION = 1;
export const DOVE_PROJECT_SCHEMA_VERSION = 1;
export const DOVE_TRUST_SCHEMA_VERSION = 1;

export const MINIMAL_WORKSPACE_DIRECTORIES = Object.freeze([
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

export const MINIMAL_WORKSPACE_REQUIRED_FILES = Object.freeze([
  ".dove/manifest.json",
  ".dove/project.json"
]);

const CURRENT_SCHEMA_FORBIDDEN_LEGACY_PATHS = Object.freeze([
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

const MANIFEST_FIELDS = new Set(["schemaVersion", "manifestVersion", "workspaceId", "createdAt", "packageVersion"]);
const PROJECT_FIELDS = new Set(["schemaVersion", "workspaceId", "projectId", "goal", "trust", "createdAt", "updatedAt"]);
const TRUST_FIELDS = new Set(["schemaVersion", "entries"]);
const MISSION_FIELDS = new Set(["schemaVersion", "workspaceId", "missionId", "contractDigest", "createdAt", "scope", "outOfScope", "targetArtifacts", "expectedArtifacts", "completionCriteria", "evidenceRequirements", "dependsOnMissionIds", "goal", "supersedesMissionId", "completionCriterionIds", "evidenceRequirementIds"]);
const LESSON_FIELDS = new Set(["schemaVersion", "workspaceId", "lessonId", "missionId", "contractDigest", "scope", "kind", "summary", "details", "nextTimeGuidance", "sourceIds", "noteIds", "artifactRefs", "appliesToArtifactRefs", "tags", "supersedesLessonId", "createdAt"]);
const LESSON_REF_FIELDS = new Set(["path", "sha256"]);
const LESSON_SCOPES = new Set(["global", "mission"]);
const LESSON_KINDS = new Set(["preference", "constraint", "method", "failure", "review-insight"]);
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

export function stableWorkspaceSerialize(value) {
  return JSON.stringify(stableValue(value));
}

export function workspaceDigest(value) {
  return sha256(stableWorkspaceSerialize(value));
}

export function canonicalWorkspacePath(root) {
  return fs.realpathSync.native(path.resolve(root));
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
    fs.lstatSync(fullPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function readJsonStrict(fullPath, label) {
  let text;
  try {
    text = fs.readFileSync(fullPath, "utf8");
  } catch (error) {
    throw new Error(`${label} cannot be read: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Malformed durable JSON in ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function validateDoveManifest(value) {
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

export function validateDoveTrustConfig(value) {
  assertSealed(value, TRUST_FIELDS, "Dove project trust config");
  if (value.schemaVersion !== DOVE_TRUST_SCHEMA_VERSION) {
    throw new Error(`Dove project trust schemaVersion ${value.schemaVersion ?? "missing"} is unsupported.`);
  }
  if (!Array.isArray(value.entries) || value.entries.length !== 0) {
    throw new Error("Dove project trust entries must be an empty sealed array until a trust schema is explicitly introduced.");
  }
  return value;
}

export function validateDoveProject(value, manifest) {
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

function validateMissionShape(value, manifest, label) {
  assertSealed(value, MISSION_FIELDS, label);
  if (value.schemaVersion !== 1) throw new Error(`${label} has an unsupported schemaVersion.`);
  safeId(value.workspaceId, `${label}.workspaceId`);
  if (value.workspaceId !== manifest.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  const missionId = safeId(value.missionId, `${label}.missionId`);
  if (path.posix.basename(label) !== `${missionId}.json`) throw new Error(`${label} filename must match missionId ${missionId}.`);
  hash(value.contractDigest, `${label}.contractDigest`);
  exactIso(value.createdAt, `${label}.createdAt`);
  nonEmptyString(value.goal, `${label}.goal`);
  for (const field of ["scope", "outOfScope", "targetArtifacts", "expectedArtifacts", "completionCriteria", "evidenceRequirements", "completionCriterionIds", "evidenceRequirementIds"]) {
    stringArray(value[field], `${label}.${field}`);
  }
  if (value.dependsOnMissionIds !== undefined) stringArray(value.dependsOnMissionIds, `${label}.dependsOnMissionIds`);
  if (value.supersedesMissionId !== undefined) safeId(value.supersedesMissionId, `${label}.supersedesMissionId`);
  const content = {
    goal: value.goal,
    scope: value.scope,
    outOfScope: value.outOfScope,
    targetArtifacts: value.targetArtifacts,
    expectedArtifacts: value.expectedArtifacts,
    completionCriteria: value.completionCriteria,
    evidenceRequirements: value.evidenceRequirements,
    ...(value.dependsOnMissionIds === undefined ? {} : { dependsOnMissionIds: value.dependsOnMissionIds }),
    ...(value.supersedesMissionId === undefined ? {} : { supersedesMissionId: value.supersedesMissionId })
  };
  const expectedDigest = missionContractDigest(missionId, content);
  if (value.contractDigest !== expectedDigest) throw new Error(`${label}.contractDigest does not match its canonical mission content.`);
  const expectedCriterionIds = missionCompletionCriteria(content).map(({ criterionId }) => criterionId);
  if (JSON.stringify(value.completionCriterionIds) !== JSON.stringify(expectedCriterionIds)) throw new Error(`${label}.completionCriterionIds do not match canonical mission content.`);
  const expectedEvidenceIds = missionEvidenceRequirements(content).map(({ requirementId }) => requirementId);
  if (JSON.stringify(value.evidenceRequirementIds) !== JSON.stringify(expectedEvidenceIds)) throw new Error(`${label}.evidenceRequirementIds do not match canonical mission content.`);
  return value;
}

function validateLessonReferenceArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const seen = new Set();
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
  if (path.posix.basename(label) !== expectedFilename) throw new Error(`${label} filename must match lessonId ${lessonId}.`);
  const missionId = safeId(value.missionId, `${label}.missionId`);
  hash(value.contractDigest, `${label}.contractDigest`);
  if (!LESSON_SCOPES.has(value.scope)) throw new Error(`${label}.scope must be global or mission.`);
  if (!LESSON_KINDS.has(value.kind)) throw new Error(`${label}.kind is unsupported.`);
  nonEmptyString(value.summary, `${label}.summary`);
  if (value.details !== undefined) nonEmptyString(value.details, `${label}.details`);
  stringArray(value.nextTimeGuidance, `${label}.nextTimeGuidance`);
  if (value.nextTimeGuidance.length === 0) throw new Error(`${label}.nextTimeGuidance must contain at least one item.`);
  stringArray(value.sourceIds, `${label}.sourceIds`);
  stringArray(value.noteIds, `${label}.noteIds`);
  validateLessonReferenceArray(value.artifactRefs, `${label}.artifactRefs`);
  validateLessonReferenceArray(value.appliesToArtifactRefs, `${label}.appliesToArtifactRefs`);
  stringArray(value.tags, `${label}.tags`);
  if (value.supersedesLessonId !== undefined) {
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
  const successorByLesson = new Map();
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
    const seen = new Set();
    let current = lessonId;
    while (current) {
      if (seen.has(current)) throw new Error(`Lesson supersession contains a cycle at ${current}.`);
      seen.add(current);
      current = lessons.get(current)?.supersedesLessonId ?? null;
    }
  }
}

function validateJsonDirectory(root, relativeDirectory, manifest, validate, context = {}) {
  const directory = path.join(root, relativeDirectory);
  const values = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isSymbolicLink()) throw new Error(`${path.posix.join(relativeDirectory, entry.name)} must not be a symbolic link.`);
    if (!entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${path.posix.join(relativeDirectory, entry.name)} must be a regular JSON file.`);
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    values.push(validate(readJsonStrict(path.join(root, relativePath), relativePath), manifest, relativePath, context));
  }
  return values;
}

function requiredPathProblem(root, relativePath, kind) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return `${relativePath} is missing`;
  const stat = fs.lstatSync(fullPath);
  if (stat.isSymbolicLink()) return `${relativePath} must not be a symbolic link`;
  if (kind === "directory" && !stat.isDirectory()) return `${relativePath} must be a directory`;
  if (kind === "file" && !stat.isFile()) return `${relativePath} must be a regular file`;
  return null;
}

function sourceIdentity(doveRoot) {
  const stat = fs.lstatSync(doveRoot, { bigint: true });
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
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = prefix ? path.posix.join(prefix, entry.name) : entry.name;
      const fullPath = path.join(directory, entry.name);
      const stat = fs.lstatSync(fullPath, { bigint: true });
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
        entries.push({ ...metadata, kind: "file", sizeBytes: String(stat.size), sha256: sha256(fs.readFileSync(fullPath)) });
      } else if (stat.isSymbolicLink()) {
        entries.push({ ...metadata, kind: "symlink", target: fs.readlinkSync(fullPath) });
      } else {
        throw new Error(`Unsupported filesystem entry inside .dove: ${relativePath}.`);
      }
    }
  };
  visit(doveRoot);
  return entries;
}

export function inspectDoveSourceTree(root) {
  const workspace = canonicalWorkspacePath(root);
  const doveRoot = path.join(workspace, ".dove");
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
  if (value === undefined) return "missing";
  return "invalid";
}

export function inspectDoveWorkspace(root) {
  const workspace = canonicalWorkspacePath(root);
  const doveRoot = path.join(workspace, ".dove");
  if (!pathExistsNoFollow(doveRoot)) {
    return { workspace, state: "absent", category: "absent", healthy: false, schemaVersion: null, detectedSchema: "absent" };
  }
  let source;
  try {
    source = { identity: sourceIdentity(doveRoot) };
  } catch (error) {
    return { workspace, state: "invalid-root", category: "invalid", healthy: false, schemaVersion: null, detectedSchema: "invalid-root", error: error instanceof Error ? error.message : String(error) };
  }
  const manifestPath = path.join(doveRoot, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return { workspace, state: "legacy-missing-manifest", category: "legacy", healthy: false, schemaVersion: null, detectedSchema: "missing-manifest", source };
  }
  let manifest;
  try {
    manifest = readJsonStrict(manifestPath, ".dove/manifest.json");
  } catch (error) {
    return { workspace, state: "malformed-manifest", category: "invalid", healthy: false, schemaVersion: null, detectedSchema: "malformed", source, error: error instanceof Error ? error.message : String(error) };
  }
  const version = manifest?.schemaVersion;
  const retainedLegacyAuthorityManifest = version === undefined && Number.isInteger(manifest?.version);
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
      ...CURRENT_SCHEMA_FORBIDDEN_LEGACY_PATHS
        .filter((relativePath) => fs.existsSync(path.join(workspace, relativePath)))
        .map((relativePath) => `${relativePath} is a retained legacy artifact and must not coexist with current schema ${DOVE_WORKSPACE_SCHEMA_VERSION}`)
    ].filter(Boolean);
    if (problems.length > 0) throw new Error(`Dove schema declaration contradicts required layout: ${problems.join("; ")}.`);
    const project = validateDoveProject(readJsonStrict(path.join(doveRoot, "project.json"), ".dove/project.json"), manifest);
    const missionValues = validateJsonDirectory(workspace, ".dove/missions", manifest, validateMissionShape);
    const missionGraph = validateMissionGraph(missionValues.map((mission) => ({ filename: `${mission.missionId}.json`, mission })));
    const missions = missionGraph.missions;
    const receiptLedger = readExecutionReceiptLedger(workspace, { manifest, missions });
    const lessonsDirectory = path.join(workspace, ".dove/lessons");
    if (pathExistsNoFollow(lessonsDirectory)) {
      const stat = fs.lstatSync(lessonsDirectory);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(".dove/lessons must be a real directory when present.");
      const lessons = new Map(validateJsonDirectory(workspace, ".dove/lessons", manifest, validateLessonShape, { missions }).map((lesson) => [lesson.lessonId, lesson]));
      validateLessonSupersession(lessons);
    }
    for (const relativeDirectory of [".dove/receipts/completion", ".dove/receipts/authority"]) {
      const entries = fs.readdirSync(path.join(workspace, relativeDirectory));
      if (entries.length > 0) {
        throw new Error(`${relativeDirectory} must remain empty until its sealed schema is introduced.`);
      }
    }
    return { workspace, state: "current-healthy", category: "current", healthy: true, schemaVersion: version, detectedSchema: String(version), source, manifest, project, missions, receiptLedger };
  } catch (error) {
    return { workspace, state: "current-unhealthy", category: "invalid", healthy: false, schemaVersion: version, detectedSchema: String(version), source, manifest, error: error instanceof Error ? error.message : String(error) };
  }
}

export function workspaceSchemaError(inspection, operation = "Dove operation") {
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

export function openDoveWorkspace(root, options = {}) {
  const inspection = inspectDoveWorkspace(root);
  if (inspection.healthy) return inspection;
  if (inspection.state === "absent" && options.allowAbsent === true) return inspection;
  throw workspaceSchemaError(inspection, options.operation);
}

export function createMinimalWorkspaceDocuments({ workspaceId, goal, createdAt }) {
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
  return { manifest, project };
}

export function newWorkspaceId() {
  return `workspace-${crypto.randomUUID()}`;
}

function writeJsonAtomicContent(targetPath, value, ops) {
  ops.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function materializeMinimalWorkspaceDirectory(directory, documents, options = {}) {
  const ops = options.fsOps ?? fs;
  ops.mkdirSync(directory, { recursive: false });
  for (const relativePath of MINIMAL_WORKSPACE_DIRECTORIES.map((item) => item.slice(".dove/".length))) {
    ops.mkdirSync(path.join(directory, relativePath), { recursive: true });
  }
  writeJsonAtomicContent(path.join(directory, "manifest.json"), documents.manifest, ops);
  writeJsonAtomicContent(path.join(directory, "project.json"), documents.project, ops);
}

export function archiveTargetFor({ workspace, detectedSchema, treeDigest }) {
  const schemaLabel = String(detectedSchema ?? "invalid").replace(/[^a-z0-9._-]+/giu, "-").toLowerCase();
  return path.join(workspace, ".dove-archive", `schema-${schemaLabel}-${String(treeDigest).slice(0, 24)}`);
}
