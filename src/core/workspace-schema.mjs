import fs from "node:fs";
import path from "node:path";

import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";
import { INSTALLATION_MANIFEST_PATH } from "./project-installation-manifest.mjs";
import { ARTIFACT_PATHS, DOVE_RESEARCH_FORMAT, LEGACY_DOVE_SCHEMA_VERSION, RESEARCH_DIRECTORIES, RESEARCH_REQUIRED_FILES } from "./schema.mjs";
import { assertFields, exactTimestamp, nonEmptyText, researchId } from "./research-records.mjs";

export { DOVE_RESEARCH_FORMAT };
export const DEFAULT_DOVE_LESSONS_MARKDOWN = "# Dove Lessons\n";

const FORMAT_FIELDS = new Set(["format"]);
const WORKSPACE_FIELDS = new Set(["workspaceId", "researchQuestion", "mainline", "contributionIntent", "currentFocus", "changeHistory", "createdAt", "updatedAt"]);
const HISTORY_FIELDS = new Set(["changedAt", "summary"]);

function canonicalWorkspace(root) { return fs.realpathSync.native(path.resolve(root)); }
function existsNoFollow(fullPath) { try { fs.lstatSync(fullPath); return true; } catch (error) { if (error?.code === "ENOENT") return false; throw error; } }
function requiredPathProblem(root, relativePath, kind) {
  const fullPath = path.join(root, relativePath);
  if (!existsNoFollow(fullPath)) return `${relativePath} is missing`;
  const stat = fs.lstatSync(fullPath);
  if (stat.isSymbolicLink()) return `${relativePath} must not be a symbolic link`;
  if (kind === "directory" && !stat.isDirectory()) return `${relativePath} must be a directory`;
  if (kind === "file" && !stat.isFile()) return `${relativePath} must be a regular file`;
  return null;
}
function readStrictJson(root, relativePath) {
  const problem = requiredPathProblem(root, relativePath, "file");
  if (problem) throw new Error(problem);
  return parseJsonWithoutDuplicateKeys(fs.readFileSync(path.join(root, relativePath), "utf8"), relativePath);
}

export function validateResearchFormat(value) {
  assertFields(value, FORMAT_FIELDS, "Dove research format marker");
  if (value.format !== DOVE_RESEARCH_FORMAT) throw new Error(`Unsupported Dove research format ${String(value.format ?? "missing")}.`);
  return value;
}

export function validateWorkspaceRecord(value) {
  assertFields(value, WORKSPACE_FIELDS, "Dove Workspace");
  researchId(value.workspaceId, "Dove Workspace workspaceId");
  for (const field of ["researchQuestion", "mainline", "contributionIntent", "currentFocus"]) nonEmptyText(value[field], `Dove Workspace ${field}`);
  exactTimestamp(value.createdAt, "Dove Workspace createdAt"); exactTimestamp(value.updatedAt, "Dove Workspace updatedAt");
  if (value.updatedAt < value.createdAt) throw new Error("Dove Workspace updatedAt must not precede createdAt.");
  if (!Array.isArray(value.changeHistory) || value.changeHistory.length === 0) throw new Error("Dove Workspace changeHistory must contain at least one human-readable change.");
  value.changeHistory.forEach((entry, index) => {
    assertFields(entry, HISTORY_FIELDS, `Dove Workspace changeHistory[${index}]`);
    exactTimestamp(entry.changedAt, `Dove Workspace changeHistory[${index}].changedAt`); nonEmptyText(entry.summary, `Dove Workspace changeHistory[${index}].summary`);
    if (index > 0 && entry.changedAt < value.changeHistory[index - 1].changedAt) throw new Error("Dove Workspace changeHistory must be chronological.");
  });
  if (value.changeHistory.at(-1).changedAt !== value.updatedAt) throw new Error("Dove Workspace updatedAt must match the latest changeHistory entry.");
  return value;
}

export function validateLessonsMarkdown(value, label = "Dove Lessons") {
  if (typeof value !== "string" || !value.trim() || !value.endsWith("\n") || value.includes("\0")) throw new Error(`${label} must be non-empty newline-terminated Markdown without null bytes.`);
  return value;
}

function detectLegacy(root) {
  const manifestPath = path.join(root, ".dove/manifest.json");
  if (!existsNoFollow(manifestPath)) return null;
  try { return parseJsonWithoutDuplicateKeys(fs.readFileSync(manifestPath, "utf8"), ".dove/manifest.json")?.schemaVersion ?? null; } catch { return null; }
}

function inspectInstallOnlyWorkspace(root) {
  const doveRoot = path.join(root, ARTIFACT_PATHS.doveRoot);
  const children = fs.readdirSync(doveRoot).map(String).sort();
  if (!children.includes("install") || children.some((child) => !["archive", "install"].includes(child))) return null;
  if (children.includes("archive")) {
    const archiveProblem = requiredPathProblem(root, ".dove/archive", "directory");
    if (archiveProblem) return { state: "invalid-install-only", category: "invalid", healthy: false, error: archiveProblem };
  }
  if (children.includes("install")) {
    const directoryProblem = requiredPathProblem(root, ARTIFACT_PATHS.installDir, "directory");
    if (directoryProblem) return { state: "invalid-install-only", category: "invalid", healthy: false, error: directoryProblem };
    const allowedInstallChildren = new Set(["manifest.json", "transactions"]);
    const installDirectory = path.join(root, ARTIFACT_PATHS.installDir);
    const installChildren = fs.readdirSync(installDirectory).map(String).sort();
    const unknownChildren = installChildren.filter((child) => !allowedInstallChildren.has(child));
    if (unknownChildren.length > 0) {
      return { state: "invalid-install-only", category: "invalid", healthy: false, error: `${ARTIFACT_PATHS.installDir} contains unsupported children: ${unknownChildren.join(", ")}` };
    }
    const manifestProblem = requiredPathProblem(root, INSTALLATION_MANIFEST_PATH, "file");
    if (manifestProblem) return { state: "invalid-install-only", category: "invalid", healthy: false, error: manifestProblem };
    if (installChildren.includes("transactions")) {
      const transactionsProblem = requiredPathProblem(root, ARTIFACT_PATHS.transactionsDir, "directory");
      if (transactionsProblem) return { state: "invalid-install-only", category: "invalid", healthy: false, error: transactionsProblem };
    }
  }
  return { state: "research-absent", category: "absent", healthy: true, format: null };
}

export function inspectDoveWorkspace(root) {
  const workspace = canonicalWorkspace(root); const doveRoot = path.join(workspace, ARTIFACT_PATHS.doveRoot);
  if (!existsNoFollow(doveRoot)) return { workspace, state: "absent", category: "absent", healthy: false, format: null };
  const rootStat = fs.lstatSync(doveRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) return { workspace, state: "invalid-root", category: "invalid", healthy: false, format: null, error: ".dove must be a real directory." };
  const formatPath = path.join(workspace, ARTIFACT_PATHS.format);
  if (!existsNoFollow(formatPath)) {
    const detectedSchema = detectLegacy(workspace);
    if (detectedSchema !== null) return { workspace, state: "legacy-schema", category: "legacy", healthy: false, format: null, detectedSchema };
    const installOnly = inspectInstallOnlyWorkspace(workspace);
    return installOnly ? { workspace, ...installOnly } : { workspace, state: "unknown-format", category: "unknown", healthy: false, format: null };
  }
  let marker;
  try { marker = readStrictJson(workspace, ARTIFACT_PATHS.format); } catch (error) { return { workspace, state: "malformed-format", category: "invalid", healthy: false, format: null, error: error.message }; }
  if (marker?.format !== DOVE_RESEARCH_FORMAT) return { workspace, state: "unsupported-format", category: "unknown", healthy: false, format: marker?.format ?? null, marker };
  try {
    validateResearchFormat(marker);
    const problems = [...RESEARCH_DIRECTORIES.map((relativePath) => requiredPathProblem(workspace, relativePath, "directory")), ...RESEARCH_REQUIRED_FILES.map((relativePath) => requiredPathProblem(workspace, relativePath, "file"))].filter(Boolean);
    if (problems.length) throw new Error(`Dove Research Format 1 layout is incomplete: ${problems.join("; ")}.`);
    const workspaceRecord = validateWorkspaceRecord(readStrictJson(workspace, ARTIFACT_PATHS.workspace));
    const lessons = fs.readFileSync(path.join(workspace, ARTIFACT_PATHS.lessons), "utf8"); validateLessonsMarkdown(lessons, ARTIFACT_PATHS.lessons);
    return { workspace, state: "current-healthy", category: "current", healthy: true, format: DOVE_RESEARCH_FORMAT, marker, workspaceRecord, lessons };
  } catch (error) { return { workspace, state: "current-unhealthy", category: "invalid", healthy: false, format: DOVE_RESEARCH_FORMAT, marker, error: error.message }; }
}

export function workspaceFormatError(inspection, operation = "Dove operation") {
  if (inspection.state === "absent" || inspection.state === "research-absent") return new Error(`${operation} requires an initialized ${DOVE_RESEARCH_FORMAT} workspace.`);
  if (inspection.category === "legacy") return new Error(`${operation} recognizes legacy Dove Schema ${inspection.detectedSchema ?? LEGACY_DOVE_SCHEMA_VERSION} read-only and refuses to write. Dove does not migrate, move, archive, reset, or replace the existing .dove directory.`);
  if (inspection.category === "unknown") return new Error(`${operation} recognizes unsupported Dove format ${inspection.format ?? "unknown"} read-only and refuses to write. No files were changed.`);
  return new Error(`${operation} refuses invalid Dove Research Format 1 state ${inspection.state}${inspection.error ? `: ${inspection.error}` : ""}. No files were changed.`);
}

export function openDoveWorkspace(root, options = {}) {
  const inspection = inspectDoveWorkspace(root);
  if ((inspection.state === "absent" || inspection.state === "research-absent") && options.allowAbsent === true) return inspection;
  if (inspection.state === "research-absent") throw workspaceFormatError(inspection, options.operation);
  if (inspection.healthy) return inspection;
  throw workspaceFormatError(inspection, options.operation);
}
