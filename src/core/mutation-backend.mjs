import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

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

function readDiskText(root, relativePath, fallback = "") {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return fallback;
  return fs.readFileSync(fullPath, "utf8");
}

function pathType(stat) {
  if (stat.isFile()) return "file";
  if (stat.isDirectory()) return "directory";
  if (stat.isSymbolicLink()) return "symlink";
  return "other";
}

function directoryHash(directory) {
  const entries = [];
  const visit = (current, prefix = "") => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const fullPath = path.join(current, entry.name);
      const relativePath = prefix ? path.posix.join(prefix, entry.name) : entry.name;
      const stat = fs.lstatSync(fullPath);
      const type = pathType(stat);
      const metadata = { path: relativePath, type, mode: stat.mode & 0o7777 };
      if (type === "file") entries.push({ ...metadata, sha256: sha256(fs.readFileSync(fullPath)) });
      else if (type === "symlink") entries.push({ ...metadata, target: fs.readlinkSync(fullPath) });
      else {
        entries.push(metadata);
        if (type === "directory") visit(fullPath, relativePath);
      }
    }
  };
  visit(directory);
  return sha256(JSON.stringify(entries));
}

function diskPathState(fullPath) {
  let stat;
  try {
    stat = fs.lstatSync(fullPath);
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, type: "absent", sha256: null, mode: null };
    throw error;
  }
  const type = pathType(stat);
  return {
    exists: true,
    type,
    sha256: type === "file" ? sha256(fs.readFileSync(fullPath)) : type === "directory" ? directoryHash(fullPath) : type === "symlink" ? sha256(fs.readlinkSync(fullPath)) : null,
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
    this.root = fs.realpathSync.native(resolvedRoot);
    this.id = options.id ?? buildMutationId();
    this.actionId = options.actionId ?? "unspecified";
    this.mutationMode = normalizeMutationMode(options.mutationMode);
    this.mutationModeSource = options.mutationMode === "patch-plan" || options.mutationMode === "direct-process" ? "explicit" : "default";
    this.hostId = options.hostId ?? "unknown";
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.fsOps = options.fsOps ?? fs;
    this.overlay = new Map();
    this.virtualDirectories = new Set();
    this.preconditions = new Map();
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
    return resolveCanonicalContainedWrite(this.root, normalized, { label: "Mutation path" });
  }

  replacementFor(relativePath) {
    return [...this.directoryReplacements.keys()].find((directoryPath) => isInside(relativePath, directoryPath)) ?? null;
  }

  recordFirstTouch(normalized, fullPath) {
    if (!this.preconditions.has(normalized)) this.preconditions.set(normalized, diskPathState(fullPath));
    return this.preconditions.get(normalized);
  }

  fileExists(relativePath) {
    const { relativePath: normalized, fullPath } = this.resolve(relativePath);
    if (this.overlay.has(normalized) || this.virtualDirectories.has(normalized)) return true;
    if (this.replacementFor(normalized)) return false;
    return fs.existsSync(fullPath);
  }

  readText(relativePath, fallback = "") {
    const { relativePath: normalized } = this.resolve(relativePath);
    if (this.overlay.has(normalized)) {
      const content = this.overlay.get(normalized);
      return Buffer.isBuffer(content) ? content.toString("utf8") : content;
    }
    if (this.replacementFor(normalized)) return fallback;
    return readDiskText(this.root, normalized, fallback);
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
    if (fs.existsSync(fullPath)) throw new Error(`${options.label ?? "Mutation commit lock"} is already held: ${normalized}.`);
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
    for (const [relativePath, expected] of this.preconditions) {
      const { fullPath } = this.resolve(relativePath);
      const actual = diskPathState(fullPath);
      if (!samePathState(actual, expected)) {
        throw new Error(`Mutation commit precondition changed for ${relativePath}: expected ${expected.type}${expected.sha256 ? ` ${expected.sha256}` : ""}, found ${actual.type}${actual.sha256 ? ` ${actual.sha256}` : ""}.`);
      }
    }
  }

  makeDirectory(directoryPath, createdDirectories) {
    if (fs.existsSync(directoryPath)) return;
    const missing = [];
    let current = directoryPath;
    while (current !== this.root && !fs.existsSync(current)) {
      missing.push(current);
      current = path.dirname(current);
    }
    if (current !== this.root) {
      const relative = path.relative(this.root, current);
      if (relative === ".." || relative.startsWith(`..${path.sep}`)) throw new Error(`Mutation directory escaped the workspace: ${directoryPath}`);
    }
    for (const item of missing.reverse()) {
      this.fsOps.mkdirSync(item, { recursive: false });
      createdDirectories.push(item);
    }
  }

  stageTransaction(transactionRoot) {
    const createdDirectories = [];
    this.fsOps.mkdirSync(transactionRoot, { recursive: false });
    createdDirectories.push(transactionRoot);
    const stagedRoot = path.join(transactionRoot, "staged");
    const backupsRoot = path.join(transactionRoot, "backups");
    this.fsOps.mkdirSync(stagedRoot, { recursive: false });
    this.fsOps.mkdirSync(backupsRoot, { recursive: false });

    const replacementStages = new Map();
    let replacementIndex = 0;
    for (const replacement of this.directoryReplacements.values()) {
      const stagePath = path.join(stagedRoot, `directory-${replacementIndex++}`);
      this.fsOps.mkdirSync(stagePath, { recursive: false });
      replacementStages.set(replacement.relativePath, stagePath);
      const directoryOperations = this.operations().filter((operation) => operation.kind === "ensure-directory" && isInside(operation.relativePath, replacement.relativePath));
      for (const operation of directoryOperations.sort((left, right) => pathDepth(left.relativePath) - pathDepth(right.relativePath))) {
        if (operation.relativePath === replacement.relativePath) continue;
        const nested = path.relative(replacement.relativePath, operation.relativePath);
        this.fsOps.mkdirSync(path.join(stagePath, nested), { recursive: true });
      }
      const fileOperations = this.operations().filter((operation) => operation.kind !== "ensure-directory" && isInside(operation.relativePath, replacement.relativePath));
      for (const operation of fileOperations) {
        const nested = path.relative(replacement.relativePath, operation.relativePath);
        const stagedFile = path.join(stagePath, nested);
        this.fsOps.mkdirSync(path.dirname(stagedFile), { recursive: true });
        const content = this.overlay.get(operation.relativePath);
        this.fsOps.writeFileSync(stagedFile, content, operation.encoding === "utf8" ? "utf8" : undefined);
      }
    }

    const fileStages = new Map();
    let fileIndex = 0;
    for (const operation of this.operations()) {
      if (operation.kind === "ensure-directory" || this.replacementFor(operation.relativePath)) continue;
      const stagedFile = path.join(stagedRoot, `file-${fileIndex++}`);
      const content = this.overlay.get(operation.relativePath);
      this.fsOps.writeFileSync(stagedFile, content, operation.encoding === "utf8" ? "utf8" : undefined);
      const initial = this.preconditions.get(operation.relativePath);
      if (initial?.exists && initial.type === "file" && typeof this.fsOps.chmodSync === "function") this.fsOps.chmodSync(stagedFile, initial.mode);
      fileStages.set(operation.relativePath, stagedFile);
    }
    return { transactionRoot, backupsRoot, replacementStages, fileStages, createdDirectories };
  }

  removePath(targetPath) {
    if (!fs.existsSync(targetPath)) return;
    this.fsOps.rmSync(targetPath, { recursive: true, force: true });
  }

  rollbackTransaction(transaction, promotions) {
    const failures = [];
    const attempt = (callback) => {
      try {
        callback();
      } catch (error) {
        failures.push(errorMessage(error));
      }
    };
    for (const promotion of [...promotions].reverse()) {
      if (promotion.promoted) attempt(() => this.removePath(promotion.targetPath));
      if (promotion.originalLocation) {
        if (fs.existsSync(promotion.originalLocation)) attempt(() => this.fsOps.renameSync(promotion.originalLocation, promotion.targetPath));
      } else if (promotion.backupPath && fs.existsSync(promotion.backupPath)) {
        attempt(() => this.fsOps.renameSync(promotion.backupPath, promotion.targetPath));
      }
    }
    for (const directoryPath of [...transaction.createdDirectories].sort((left, right) => right.length - left.length)) {
      if (directoryPath === transaction.transactionRoot) continue;
      if (fs.existsSync(directoryPath)) attempt(() => this.fsOps.rmdirSync(directoryPath));
    }
    if (fs.existsSync(transaction.transactionRoot)) attempt(() => this.fsOps.rmSync(transaction.transactionRoot, { recursive: true, force: true }));
    if (failures.length > 0) throw new Error(failures.join("; "));
  }

  acquireCommitLocks() {
    const acquired = [];
    try {
      for (const lock of this.commitLocks.values()) {
        let handle;
        try {
          handle = this.fsOps.openSync(lock.fullPath, "wx", 0o600);
        } catch (error) {
          if (error?.code === "EEXIST") throw new Error(`${lock.label} is already held: ${lock.relativePath}.`);
          throw error;
        }
        this.fsOps.closeSync(handle);
        acquired.push(lock);
      }
      return acquired;
    } catch (error) {
      this.releaseCommitLocks(acquired);
      throw error;
    }
  }

  releaseCommitLocks(acquired) {
    const failures = [];
    for (const lock of [...acquired].reverse()) {
      try {
        this.fsOps.unlinkSync(lock.fullPath);
      } catch (error) {
        if (error?.code !== "ENOENT") failures.push(errorMessage(error));
      }
    }
    if (failures.length > 0) throw new Error(`Mutation commit lock cleanup failed: ${failures.join("; ")}`);
  }

  commitDirect() {
    const acquiredLocks = this.acquireCommitLocks();
    let primaryError = null;
    try {
      this.commitState.phase = "preparing";
      this.revalidatePreconditions();
      if (this.operations().length === 0 && this.directoryReplacements.size === 0) {
        this.commitState.phase = "committed";
        return;
      }
      const transactionRoot = path.join(this.root, `.dove-transaction-${this.id.replace(/[^a-z0-9._-]/giu, "-")}`);
      resolveCanonicalContainedWrite(this.root, path.relative(this.root, transactionRoot), { label: "Mutation transaction path" });
      if (fs.existsSync(transactionRoot)) throw new Error(`Mutation transaction path is already occupied: ${transactionRoot}`);
      let transaction = { transactionRoot, createdDirectories: [] };
      const promotions = [];
      try {
        transaction = this.stageTransaction(transactionRoot);
        this.commitState.phase = "promoting";
        let replacementIndex = 0;
        for (const replacement of this.directoryReplacements.values()) {
          const targetPath = path.join(this.root, replacement.relativePath);
          const stagePath = transaction.replacementStages.get(replacement.relativePath);
          const promotion = { targetPath, promoted: false, backupPath: null, originalLocation: null };
          promotions.push(promotion);
          if (fs.existsSync(targetPath)) {
            const originalLocation = replacement.archiveTarget
              ? path.join(this.root, replacement.archiveTarget)
              : path.join(transaction.backupsRoot, `directory-${replacementIndex}`);
            this.makeDirectory(path.dirname(originalLocation), transaction.createdDirectories);
            this.fsOps.renameSync(targetPath, originalLocation);
            promotion.originalLocation = originalLocation;
          }
          this.makeDirectory(path.dirname(targetPath), transaction.createdDirectories);
          this.fsOps.renameSync(stagePath, targetPath);
          promotion.promoted = true;
          replacementIndex += 1;
        }

        for (const operation of this.operations().filter((item) => item.kind === "ensure-directory" && !this.replacementFor(item.relativePath)).sort((left, right) => pathDepth(left.relativePath) - pathDepth(right.relativePath))) {
          this.makeDirectory(path.join(this.root, operation.relativePath), transaction.createdDirectories);
        }

        let fileIndex = 0;
        for (const operation of this.operations()) {
          if (operation.kind === "ensure-directory" || this.replacementFor(operation.relativePath)) continue;
          const targetPath = path.join(this.root, operation.relativePath);
          const stagedPath = transaction.fileStages.get(operation.relativePath);
          const promotion = { targetPath, promoted: false, backupPath: null, originalLocation: null };
          promotions.push(promotion);
          this.makeDirectory(path.dirname(targetPath), transaction.createdDirectories);
          if (fs.existsSync(targetPath)) {
            const backupPath = path.join(transaction.backupsRoot, `file-${fileIndex}`);
            this.fsOps.renameSync(targetPath, backupPath);
            promotion.backupPath = backupPath;
          }
          this.fsOps.renameSync(stagedPath, targetPath);
          promotion.promoted = true;
          fileIndex += 1;
        }
      } catch (error) {
        this.commitState.phase = "rolling-back";
        this.commitState.rollbackAttempted = true;
        try {
          this.rollbackTransaction(transaction, promotions);
          this.commitState.phase = "rolled-back";
        } catch (rollbackError) {
          this.commitState.phase = "rollback-failed";
          throw new Error(`Dove mutation commit failed and rollback also failed: ${errorMessage(error)}; rollback: ${errorMessage(rollbackError)}`, { cause: error });
        }
        throw new Error(`Dove mutation commit failed and all staged changes were rolled back: ${errorMessage(error)}`, { cause: error });
      }
      this.commitState.phase = "committed";
      try {
        this.fsOps.rmSync(transactionRoot, { recursive: true, force: true });
      } catch (cleanupError) {
        this.commitState.cleanupFailures.push({ path: transactionRoot, reason: errorMessage(cleanupError) });
      }
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      try {
        this.releaseCommitLocks(acquiredLocks);
      } catch (cleanupError) {
        if (!primaryError && this.commitState.phase === "committed") {
          this.commitState.cleanupFailures.push({ path: "commit-locks", reason: errorMessage(cleanupError) });
        }
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
        workspaceRealpath: fs.realpathSync.native(this.root),
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
      if (fs.realpathSync.native(path.resolve(root)) !== context.root) return null;
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
