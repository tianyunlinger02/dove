import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { openAnchoredFilesystem, requireAnchoredFilesystemCapability } from "./anchored-filesystem.mjs";
import { resolveCanonicalContainedWrite } from "./contained-write.mjs";

const mutationStorage = new AsyncLocalStorage();
const DIRECT_PROCESS_ROLLBACK_REASON = "direct-process writes are performed by the Dove process, not by host-tracked file edits; native programming-terminal rollback does not track those writes.";
const PATCH_PLAN_ROLLBACK_ADVICE = "Use mutationMode: patch-plan and apply the returned operations through host-tracked file edits before relying on host rollback.";
const MAX_CLEANUP_RESIDUES = 20;

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function normalizeMutationMode(value) {
  if (value === undefined) return "direct-process";
  if (value === "patch-plan" || value === "direct-process") return value;
  throw new Error("mutationMode must be either patch-plan or direct-process when explicitly provided.");
}

function normalizeRelativePath(relativePath) {
  if (typeof relativePath !== "string" || !relativePath.trim()) {
    throw new Error("Mutation path must be a non-empty relative path.");
  }
  const normalized = path.posix.normalize(relativePath.replace(/\\/g, "/"));
  if (path.isAbsolute(relativePath) || normalized === "." || normalized.startsWith("../") || normalized === "..") {
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

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function resultDeclaresWrites(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.writes) && value.writes.length > 0;
}


function pathType(stat) {
  if (stat.isFile()) return "file";
  if (stat.isDirectory()) return "directory";
  if (stat.isSymbolicLink()) return "symlink";
  return "other";
}

function directoryHash(directory, fsOps = fs) {
  const entries = [];
  const visit = (current, prefix = "") => {
    for (const entry of fsOps.readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const fullPath = path.join(current, entry.name);
      const relativePath = prefix ? path.posix.join(prefix, entry.name) : entry.name;
      const stat = fsOps.lstatSync(fullPath);
      const type = pathType(stat);
      const metadata = { path: relativePath, type, mode: stat.mode & 0o7777 };
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

function diskPathState(fullPath, fsOps = fs) {
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
    mode: stat.mode & 0o7777
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

export class MutationContext {
  constructor(root, options = {}) {
    const resolvedRoot = path.resolve(root);
    this.root = typeof (options.fsOps ?? fs).realpathSync.native === "function" ? (options.fsOps ?? fs).realpathSync.native(resolvedRoot) : (options.fsOps ?? fs).realpathSync(resolvedRoot);
    this.id = options.id ?? buildMutationId();
    this.actionId = options.actionId ?? "unspecified";
    this.mutationMode = normalizeMutationMode(options.mutationMode);
    this.mutationModeSource = options.mutationMode === "patch-plan" || options.mutationMode === "direct-process" ? "explicit" : "default";
    this.hostId = options.hostId ?? "unknown";
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.fsOps = options.fsOps ?? fs;
    if (this.mutationMode === "direct-process") requireAnchoredFilesystemCapability({ fsOps: this.fsOps, platform: options.platform, procFdRoot: options.procFdRoot });
    this.platform = options.platform;
    this.procFdRoot = options.procFdRoot;
    this.overlay = new Map();
    this.virtualDirectories = new Set();
    this.preconditions = new Map();
    this.readSet = new Map();
    this.snapshotCache = new Map();
    this.operationsByPath = new Map();
    this.operationOrder = [];
    this.directoryReplacements = new Map();
    this.commitLocks = new Map();
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
    const normalized = normalizeRelativePath(relativePath);
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
      const snapshot = { relativePath: normalized, ...initial, buffer };
      this.snapshotCache.set(normalized, snapshot);
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

  writeJson(relativePath, value) {
    return this.writeText(relativePath, serializeJson(value), "write-json");
  }

  writeJsonIfChanged(relativePath, value) {
    const nextContent = serializeJson(value);
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
      ...(encoding === "utf8" ? { content } : { byteLength: content.byteLength }),
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
    if (options.archiveTarget !== undefined && options.archiveTarget !== null) {
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
        actual = { exists: true, type, sha256: type === "file" ? sha256(anchor.readFile(relativePath)) : type === "directory" ? diskPathState(path.join(this.root, relativePath), this.fsOps).sha256 : null, mode: stat.mode & 0o7777 };
      }
      if (!samePathState(actual, expected)) throw new Error(`Mutation commit precondition changed for ${relativePath}: expected ${expected.type}${expected.sha256 ? ` ${expected.sha256}` : ""}, found ${actual.type}${actual.sha256 ? ` ${actual.sha256}` : ""}.`);
    }
  }

  makeAnchoredDirectory(anchor, relativePath, createdDirectories) {
    const normalized = path.posix.normalize(relativePath || ".");
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

    const replacementStages = new Map();
    let replacementIndex = 0;
    for (const replacement of this.directoryReplacements.values()) {
      const stagePath = `${stagedRoot}/directory-${replacementIndex++}`;
      anchor.mkdir(stagePath);
      replacementStages.set(replacement.relativePath, stagePath);
      const directoryOperations = this.operations().filter((operation) => operation.kind === "ensure-directory" && isInside(operation.relativePath, replacement.relativePath));
      for (const operation of directoryOperations.sort((left, right) => pathDepth(left.relativePath) - pathDepth(right.relativePath))) {
        if (operation.relativePath === replacement.relativePath) continue;
        const nested = path.posix.relative(replacement.relativePath, operation.relativePath);
        anchor.mkdir(`${stagePath}/${nested}`, { recursive: true });
      }
      const fileOperations = this.operations().filter((operation) => operation.kind !== "ensure-directory" && isInside(operation.relativePath, replacement.relativePath));
      for (const operation of fileOperations) {
        const nested = path.posix.relative(replacement.relativePath, operation.relativePath);
        const stagedFile = `${stagePath}/${nested}`;
        anchor.mkdir(path.posix.dirname(stagedFile), { recursive: true });
        anchor.writeNewFile(stagedFile, this.overlay.get(operation.relativePath), { encoding: operation.encoding === "utf8" ? "utf8" : undefined });
      }
    }

    const fileStages = new Map();
    let fileIndex = 0;
    for (const operation of this.operations()) {
      if (operation.kind === "ensure-directory" || this.replacementFor(operation.relativePath)) continue;
      const stagedFile = `${stagedRoot}/file-${fileIndex++}`;
      anchor.writeNewFile(stagedFile, this.overlay.get(operation.relativePath), { encoding: operation.encoding === "utf8" ? "utf8" : undefined });
      const initial = this.preconditions.get(operation.relativePath);
      if (initial?.exists && initial.type === "file") anchor.chmod(stagedFile, initial.mode);
      fileStages.set(operation.relativePath, stagedFile);
    }
    return { transactionRoot, backupsRoot, replacementStages, fileStages, createdDirectories };
  }

  rollbackTransaction(anchor, transaction, promotions) {
    const failures = [];
    const attempt = (callback) => { try { callback(); } catch (error) { failures.push(errorMessage(error)); } };
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
          anchor.writeNewFile(lock.relativePath, Buffer.alloc(0), { mode: 0o600 });
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
      try { anchor.unlink(lock.relativePath, { force: true }); } catch (error) { failures.push(errorMessage(error)); }
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
        // Revalidate the full write/read set only after staging is complete and immediately before promotion.
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
            this.makeAnchoredDirectory(anchor, path.posix.dirname(originalLocation), transaction.createdDirectories);
            anchor.rename(targetPath, originalLocation);
            promotion.originalLocation = originalLocation;
          }
          this.makeAnchoredDirectory(anchor, path.posix.dirname(targetPath), transaction.createdDirectories);
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
          this.makeAnchoredDirectory(anchor, path.posix.dirname(targetPath), transaction.createdDirectories);
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
          throw new Error(`Dove mutation commit failed and rollback also failed: ${errorMessage(error)}; rollback: ${errorMessage(rollbackError)}`, { cause: error });
        }
        throw new Error(`Dove mutation commit failed and all staged changes were rolled back: ${errorMessage(error)}`, { cause: error });
      }
      this.commitState.phase = "committed";
      try { anchor.remove(transactionRoot, { recursive: true, force: true }); } catch (cleanupError) { this.commitState.cleanupFailures.push({ path: anchor.displayPath(transactionRoot), reason: errorMessage(cleanupError) }); }
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      try {
        this.releaseCommitLocks(anchor, acquiredLocks);
      } catch (cleanupError) {
        if (!primaryError && this.commitState.phase === "committed") this.commitState.cleanupFailures.push({ path: "commit-locks", reason: errorMessage(cleanupError) });
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
}

export function createMutationContext(root, options = {}) {
  return new MutationContext(root, options);
}

export function runWithMutationContext(root, options, callback) {
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

export function currentMutationContext(root) {
  const context = mutationStorage.getStore();
  if (!context || context.lifecycle !== "active") return null;
  if (root) {
    try {
      const resolved = typeof context.fsOps.realpathSync.native === "function" ? context.fsOps.realpathSync.native(path.resolve(root)) : context.fsOps.realpathSync(path.resolve(root));
      if (resolved !== context.root) return null;
    } catch {
      return null;
    }
  }
  return context;
}

export function isPatchPlanMode(root) {
  return currentMutationContext(root)?.patchPlanMode === true;
}

export function jsonContent(value) {
  return serializeJson(value);
}
