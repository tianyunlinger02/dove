import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { openRootedFilesystem } from "./rooted-filesystem.mjs";

const REVIEW_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9])?$/u;
const WINDOWS_RESERVED_NAMES = new Set(["CON", "PRN", "AUX", "NUL", ...Array.from({ length: 9 }, (_, index) => `COM${index + 1}`), ...Array.from({ length: 9 }, (_, index) => `LPT${index + 1}`)]);

function lstatOrNull(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function realpathNative(fsOps, targetPath) {
  return typeof fsOps.realpathSync?.native === "function" ? fsOps.realpathSync.native(targetPath) : fsOps.realpathSync(targetPath);
}

function pathInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function assertStateRootOutsideProject(stateRoot, projectRoot, fsOps) {
  if (projectRoot === undefined || projectRoot === null) return;
  const project = realpathNative(fsOps, path.resolve(projectRoot));
  const candidate = path.resolve(stateRoot);
  if (pathInside(project, candidate)) throw new Error("Dove review workspace state root must be outside the initialized project so the reviewer sees only copied listed materials.");
}

function assertResolvedStateRootOutsideProject(stateRoot, projectRoot, fsOps) {
  if (projectRoot === undefined || projectRoot === null) return;
  const project = realpathNative(fsOps, path.resolve(projectRoot));
  const resolved = realpathNative(fsOps, stateRoot);
  if (pathInside(project, resolved)) throw new Error("Dove review workspace state root must be outside the initialized project so the reviewer sees only copied listed materials.");
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function exactIsoTimestamp(value = new Date()) {
  const timestamp = value instanceof Date ? value.toISOString() : value;
  if (typeof timestamp !== "string" || new Date(timestamp).toISOString() !== timestamp) throw new Error("Dove review timestamp must be an exact ISO timestamp.");
  return timestamp;
}

export function createReviewId(options = {}) {
  const date = exactIsoTimestamp(options.now).slice(0, 10).replace(/-/gu, "");
  return `review-${date}-${crypto.randomUUID().slice(0, 8)}`;
}

export function normalizeReviewId(value, label = "Dove review id") {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.includes("\0")) throw new Error(`${label} must be a non-empty path-safe identifier.`);
  if (!REVIEW_ID_PATTERN.test(value)) throw new Error(`${label} may contain only letters, numbers, dot, underscore, and dash, must start and end with a letter or number, and must not be a path.`);
  const upper = value.split(".", 1)[0].toUpperCase();
  if (WINDOWS_RESERVED_NAMES.has(upper)) throw new Error(`${label} must not use a reserved device name: ${value}`);
  return value;
}

export function resolveReviewStateRoot(options = {}) {
  const env = options.env ?? process.env;
  const fsOps = options.fsOps ?? fs;
  const explicit = options.stateRoot ?? env.DOVE_REVIEW_STATE_ROOT;
  const xdgState = env.XDG_STATE_HOME;
  const home = env.HOME ?? os.homedir();
  let stateRoot;
  if (typeof explicit === "string" && explicit.trim()) stateRoot = explicit;
  else if (typeof xdgState === "string" && xdgState.trim()) stateRoot = path.join(xdgState, "dove", "reviews");
  else if (typeof home === "string" && home.trim()) stateRoot = path.join(home, ".local", "state", "dove", "reviews");
  else throw new Error("Dove review workspace requires DOVE_REVIEW_STATE_ROOT, XDG_STATE_HOME, or HOME.");
  assertStateRootOutsideProject(stateRoot, options.projectRoot, fsOps);
  const resolved = ensureRealDirectory(stateRoot, { fsOps, label: "Dove review state root" });
  assertResolvedStateRootOutsideProject(resolved, options.projectRoot, fsOps);
  return resolved;
}

export function ensureRealDirectory(directoryPath, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const label = options.label ?? "Directory";
  if (typeof directoryPath !== "string" || !directoryPath.trim() || directoryPath.includes("\0")) throw new Error(`${label} must name a directory.`);
  const resolved = path.resolve(directoryPath);
  const parsed = path.parse(resolved);
  let current = parsed.root;
  const relative = path.relative(parsed.root, resolved);
  const components = relative ? relative.split(path.sep).filter(Boolean) : [];
  for (const component of components) {
    current = path.join(current, component);
    const stat = lstatOrNull(fsOps, current);
    if (stat === null) {
      fsOps.mkdirSync(current, { mode: 0o700 });
      continue;
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`${label} must use only real directory components: ${current}`);
  }
  const finalStat = fsOps.lstatSync(resolved);
  if (finalStat.isSymbolicLink() || !finalStat.isDirectory()) throw new Error(`${label} must be a real directory: ${resolved}`);
  return realpathNative(fsOps, resolved);
}

export function reviewWorkspaceName(reviewId, options = {}) {
  const projectRoot = realpathNative(options.fsOps ?? fs, path.resolve(options.projectRoot));
  return `r-${sha256(JSON.stringify([projectRoot, normalizeReviewId(reviewId)])).slice(0, 20)}`;
}

function reviewWorkspaceLocation(reviewId, options = {}) {
  const id = normalizeReviewId(reviewId);
  const fsOps = options.fsOps ?? fs;
  const stateRoot = resolveReviewStateRoot({ ...options, fsOps });
  const stateRootFs = openRootedFilesystem(stateRoot, { fsOps });
  const name = reviewWorkspaceName(id, options);
  const workspaceRoot = options.workspaceRoot ?? stateRootFs.displayPath(name);
  // Preserve the recorded session location only when its project-scoped key matches.
  // Unnamespaced workspaces have no provable owner; never adopt or replace them.
  if (workspaceRoot !== stateRootFs.displayPath(name)) {
    throw new Error("Dove review recorded workspace must belong to this project and review inside the selected state root. Start a new review id; the existing workspace is left untouched.");
  }
  return { id, name, stateRoot, stateRootFs, workspaceRoot };
}

function writeMaterialFiles(root, files, fsOps) {
  const anchor = openRootedFilesystem(root, { fsOps });
  for (const file of files) {
    const relativePath = anchor.normalize(file.path, "Dove review copied material path");
    const parent = path.posix.dirname(relativePath);
    if (parent !== ".") anchor.mkdir(parent, { recursive: true, mode: 0o700 });
    anchor.writeNewFile(relativePath, file.bytes, { mode: 0o600 });
  }
}

export function prepareReviewWorkspace(options = {}) {
  const fsOps = options.fsOps ?? fs;
  if (!Array.isArray(options.files)) throw new Error("Dove review workspace files must be an array.");
  const { id, name, stateRoot, stateRootFs, workspaceRoot } = reviewWorkspaceLocation(options.reviewId, options);
  const stagingName = `.${name}.staging-${crypto.randomUUID()}`;
  const backupName = `.${name}.previous-${crypto.randomUUID()}`;
  let backupCreated = false;
  let promoted = false;
  stateRootFs.mkdir(stagingName, { mode: 0o700 });
  const stagingRoot = stateRootFs.displayPath(stagingName);
  try {
    writeMaterialFiles(stagingRoot, options.files, fsOps);
    const existing = stateRootFs.tryLstat(name);
    if (existing !== null) {
      if (!options.workspaceRoot) throw new Error(`Dove review workspace already exists without this review's recorded session: ${workspaceRoot}`);
      if (existing.isSymbolicLink() || !existing.isDirectory()) throw new Error(`Dove review workspace must be a real directory: ${workspaceRoot}`);
      stateRootFs.rename(name, backupName);
      backupCreated = true;
    }
    try {
      stateRootFs.rename(stagingName, name);
      promoted = true;
    } catch (promoteError) {
      if (backupCreated && !stateRootFs.exists(name) && stateRootFs.exists(backupName)) {
        try { stateRootFs.rename(backupName, name); } catch (restoreError) {
          throw new Error(`Dove review workspace replacement failed and the previous workspace could not be restored: ${errorMessage(promoteError)}; restore: ${errorMessage(restoreError)}`, { cause: promoteError });
        }
      }
      throw promoteError;
    }
    if (backupCreated && options.keepPreviousWorkspaceBackup === true) {
      return { reviewId: id, stateRoot, workspaceRoot, previousWorkspaceBackupName: backupName };
    }
    try {
      if (backupCreated) stateRootFs.remove(backupName, { recursive: true, force: true });
    } catch {
      // The current workspace is already promoted; stale previous-workspace cleanup is best-effort.
    }
    return { reviewId: id, stateRoot, workspaceRoot, previousWorkspaceBackupName: null };
  } catch (error) {
    try {
      if (stateRootFs.exists(stagingName)) stateRootFs.remove(stagingName, { recursive: true, force: true });
    } catch {
      // The original error is more actionable; stale staging cleanup is best-effort.
    }
    try {
      if (backupCreated && !stateRootFs.exists(name) && stateRootFs.exists(backupName)) stateRootFs.rename(backupName, name);
    } catch (restoreError) {
      throw new Error(`Dove review workspace preparation failed and the previous workspace could not be restored: ${errorMessage(error)}; restore: ${errorMessage(restoreError)}`, { cause: error });
    }
    throw error;
  } finally {
    try {
      if (promoted && backupCreated && options.keepPreviousWorkspaceBackup !== true && stateRootFs.exists(backupName)) stateRootFs.remove(backupName, { recursive: true, force: true });
    } catch {
      // Stale backup cleanup is best-effort after the replacement has succeeded.
    }
  }
}

function listWorkspaceFiles(anchor, relativeDir = "") {
  const files = [];
  const entries = anchor.readdir(relativeDir || null, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    const stat = anchor.lstat(relativePath);
    if (stat.isSymbolicLink()) throw new Error(`Dove review workspace contains a symbolic link: ${relativePath}`);
    if (stat.isDirectory()) files.push(...listWorkspaceFiles(anchor, relativePath));
    else if (stat.isFile()) files.push(relativePath);
    else throw new Error(`Dove review workspace contains an unsupported path type: ${relativePath}`);
  }
  return files.sort();
}

export function finalizePreparedReviewWorkspace(workspace, options = {}) {
  if (!workspace?.previousWorkspaceBackupName) return;
  const fsOps = options.fsOps ?? fs;
  const stateRoot = resolveReviewStateRoot({ ...options, fsOps });
  const stateRootFs = openRootedFilesystem(stateRoot, { fsOps });
  try {
    stateRootFs.remove(workspace.previousWorkspaceBackupName, { recursive: true, force: true });
  } catch {
    // The promoted workspace already matches the written round. Stale backup cleanup is best-effort.
  }
}

export function restorePreparedReviewWorkspace(workspace, options = {}) {
  if (!workspace?.reviewId) return;
  const fsOps = options.fsOps ?? fs;
  const { name, stateRootFs } = reviewWorkspaceLocation(workspace.reviewId, { ...options, fsOps, workspaceRoot: workspace.workspaceRoot });
  const current = stateRootFs.tryLstat(name);
  if (current !== null) {
    if (current.isSymbolicLink() || !current.isDirectory()) throw new Error(`Dove review workspace must be a real directory before restoring the previous workspace: ${workspace.workspaceRoot}`);
    stateRootFs.remove(name, { recursive: true, force: true });
  }
  if (!workspace.previousWorkspaceBackupName) return;
  stateRootFs.rename(workspace.previousWorkspaceBackupName, name);
}

export function assertReviewWorkspaceMatchesSnapshot(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const snapshot = options.snapshot;
  if (!snapshot || !Array.isArray(snapshot.materials)) throw new Error("Dove review snapshot is missing its material manifest.");
  const { workspaceRoot } = reviewWorkspaceLocation(options.reviewId, options);
  const anchor = openRootedFilesystem(workspaceRoot, { fsOps });
  const expected = new Map(snapshot.materials.map((material) => [material.path, material]));
  const actualPaths = listWorkspaceFiles(anchor);
  const actualSet = new Set(actualPaths);
  for (const actualPath of actualPaths) {
    if (!expected.has(actualPath)) throw new Error(`Dove review workspace contains an unlisted file: ${actualPath}`);
  }
  for (const material of snapshot.materials) {
    if (!actualSet.has(material.path)) throw new Error(`Dove review workspace is missing copied material: ${material.path}`);
    const bytes = anchor.readFile(material.path);
    if (bytes.length !== material.size || sha256(bytes) !== material.sha256) throw new Error(`Dove review workspace material no longer matches the frozen snapshot: ${material.path}`);
  }
  return { workspaceRoot, files: actualPaths };
}
