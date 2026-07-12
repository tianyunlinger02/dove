import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ARTIFACT_PATHS, createMutationProvenanceIndex, normalizeMutationProvenanceIndex } from "./schema.mjs";

const mutationStorage = new AsyncLocalStorage();
const DIRECT_PROCESS_ROLLBACK_REASON = "direct-process writes are performed by the Dove process, not by host-tracked file edits; native programming-terminal rollback cannot be verified for those writes.";
const PATCH_PLAN_ROLLBACK_ADVICE = "Use mutationMode: patch-plan and apply the returned operations through host-tracked file edits before relying on host rollback.";

function sha256(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

export function normalizeMutationMode(value) {
  if (value === undefined) {
    return "direct-process";
  }
  if (value === "patch-plan" || value === "direct-process") {
    return value;
  }
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
  if (relativePath === ".dove" || relativePath.startsWith(".dove/")) {
    return ".dove";
  }
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
  if (!fs.existsSync(fullPath)) {
    return fallback;
  }
  return fs.readFileSync(fullPath, "utf8");
}

function diskFileState(root, relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    return { exists: false, content: null, sha256: null };
  }
  const content = fs.readFileSync(fullPath, "utf8");
  return { exists: true, content, sha256: sha256(content) };
}

function buildMutationId() {
  return `mutation-${crypto.randomUUID()}`;
}

export class MutationContext {
  constructor(root, options = {}) {
    this.root = path.resolve(root);
    this.id = options.id ?? buildMutationId();
    this.actionId = options.actionId ?? "unspecified";
    this.mutationMode = normalizeMutationMode(options.mutationMode);
    this.mutationModeSource = options.mutationMode === "patch-plan" || options.mutationMode === "direct-process" ? "explicit" : "default";
    this.hostId = options.hostId ?? "unknown";
    this.packetId = options.packetId ?? null;
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.overlay = new Map();
    this.operationsByPath = new Map();
    this.operationOrder = [];
  }

  get patchPlanMode() {
    return this.mutationMode === "patch-plan";
  }

  resolve(relativePath) {
    const normalized = normalizeRelativePath(relativePath);
    const fullPath = path.resolve(this.root, normalized);
    const relativeFromRoot = path.relative(this.root, fullPath);
    if (relativeFromRoot.startsWith("..") || path.isAbsolute(relativeFromRoot)) {
      throw new Error(`Mutation path must stay inside the project: ${relativePath}`);
    }
    return { relativePath: normalized, fullPath };
  }

  fileExists(relativePath) {
    const { relativePath: normalized, fullPath } = this.resolve(relativePath);
    return this.overlay.has(normalized) || fs.existsSync(fullPath);
  }

  readText(relativePath, fallback = "") {
    const { relativePath: normalized } = this.resolve(relativePath);
    if (this.overlay.has(normalized)) {
      return this.overlay.get(normalized);
    }
    return readDiskText(this.root, normalized, fallback);
  }

  readJson(relativePath, fallback) {
    const text = this.readText(relativePath, null);
    if (text === null) {
      return typeof fallback === "function" ? fallback() : structuredClone(fallback);
    }
    return JSON.parse(text);
  }

  writeJson(relativePath, value) {
    return this.writeText(relativePath, serializeJson(value), "write-json");
  }

  writeJsonIfChanged(relativePath, value) {
    const nextContent = serializeJson(value);
    const currentContent = this.readText(relativePath, null);
    if (currentContent === nextContent) {
      return false;
    }
    this.writeText(relativePath, nextContent, "write-json");
    return true;
  }

  writeText(relativePath, content, kind = "write-text") {
    const { relativePath: normalized, fullPath } = this.resolve(relativePath);
    const nextContent = String(content ?? "");
    const existing = this.operationsByPath.get(normalized);
    const initial = existing ? { exists: existing.previousExists, sha256: existing.previousSha256 } : diskFileState(this.root, normalized);
    const nextSha = sha256(nextContent);
    const operation = {
      operationId: existing?.operationId ?? `op-${crypto.randomUUID()}`,
      mutationId: this.id,
      actionId: this.actionId,
      packetId: this.packetId,
      relativePath: normalized,
      kind,
      encoding: "utf8",
      content: nextContent,
      previousExists: initial.exists,
      previousSha256: initial.sha256,
      expectedPreviousSha256: initial.sha256,
      nextSha256: nextSha,
      scope: classifyScope(normalized),
      rollbackEligibility: this.patchPlanMode ? "host-tracked-file-edits-required" : "direct-process-unverified"
    };

    if (!existing) {
      this.operationOrder.push(normalized);
    }
    this.operationsByPath.set(normalized, operation);
    this.overlay.set(normalized, nextContent);

    if (!this.patchPlanMode) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, nextContent, "utf8");
    }
    return operation;
  }

  appendText(relativePath, content) {
    const previous = this.readText(relativePath, "");
    return this.writeText(relativePath, `${previous}${String(content ?? "")}`, "append-as-write");
  }

  ensureFile(relativePath, content) {
    if (this.fileExists(relativePath)) {
      return false;
    }
    this.writeText(relativePath, content, "ensure-file");
    return true;
  }

  ensureDirectory(relativePath) {
    const { fullPath } = this.resolve(relativePath);
    if (!this.patchPlanMode) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  operations() {
    return this.operationOrder.map((relativePath) => this.operationsByPath.get(relativePath)).filter(Boolean);
  }

  recordProvenance() {
    const operations = this.operations().filter((operation) => operation.relativePath !== ARTIFACT_PATHS.mutationsIndex);
    if (operations.length === 0) {
      return;
    }
    const currentText = this.readText(ARTIFACT_PATHS.mutationsIndex, null);
    const currentIndex = currentText === null ? createMutationProvenanceIndex() : normalizeMutationProvenanceIndex(JSON.parse(currentText));
    const entry = {
      id: this.id,
      actionId: this.actionId,
      packetId: this.packetId,
      mutationMode: this.mutationMode,
      mutationModeSource: this.mutationModeSource,
      writesApplied: !this.patchPlanMode,
      appliedBy: this.patchPlanMode ? "host-tracked-file-edits-required" : "node-fs",
      hostId: this.hostId,
      hostRollbackEligible: this.patchPlanMode,
      hostTrackedFileEditsRequired: this.patchPlanMode,
      hostCheckpointVerified: false,
      directProcessWritesAreRollbackSafe: false,
      externalWriteCaptureVerified: false,
      doveRestoreSupported: false,
      hostRollbackIneligibleReason: this.patchPlanMode ? null : DIRECT_PROCESS_ROLLBACK_REASON,
      recommendedMutationMode: this.patchPlanMode ? null : "patch-plan",
      rollbackAdvice: this.patchPlanMode ? null : PATCH_PLAN_ROLLBACK_ADVICE,
      operationCount: operations.length,
      paths: operations.map((operation) => operation.relativePath),
      createdAt: this.createdAt
    };
    const nextEntries = [...currentIndex.entries.filter((item) => item.id !== this.id), entry];
    this.writeJson(ARTIFACT_PATHS.mutationsIndex, normalizeMutationProvenanceIndex({
      ...currentIndex,
      entries: nextEntries,
      updatedAt: this.createdAt
    }));
  }

  summary(options = {}) {
    const operations = this.operations();
    const writesApplied = options.writesApplied ?? (!this.patchPlanMode && operations.length > 0);
    return {
      mutationId: this.id,
      actionId: this.actionId,
      mutationMode: this.mutationMode,
      mutationModeSource: this.mutationModeSource,
      writesApplied,
      operationCount: operations.length,
      paths: operations.map((operation) => operation.relativePath),
      hostRollbackEligible: this.patchPlanMode,
      hostRollbackIneligibleReason: this.patchPlanMode ? null : DIRECT_PROCESS_ROLLBACK_REASON,
      recommendedMutationMode: this.patchPlanMode ? null : "patch-plan",
      rollbackAdvice: this.patchPlanMode ? null : PATCH_PLAN_ROLLBACK_ADVICE,
      externalWriteCaptureVerified: false,
      doveRestoreSupported: false
    };
  }

  finish(result = {}) {
    this.recordProvenance();
    const operations = this.operations();
    const writesApplied = !this.patchPlanMode && (operations.length > 0 || resultDeclaresWrites(result));
    const metadata = {
      mutationId: this.id,
      mutationMode: this.mutationMode,
      mutationModeSource: this.mutationModeSource,
      writesApplied,
      hostRollbackEligible: this.patchPlanMode,
      hostTrackedFileEditsRequired: this.patchPlanMode,
      directProcessWritesAreRollbackSafe: false,
      externalWriteCaptureVerified: false,
      doveRestoreSupported: false,
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
        packetId: this.packetId,
        workspaceRealpath: fs.realpathSync.native(this.root),
        mutationModeSource: this.mutationModeSource,
        createdAt: this.createdAt,
        writesApplied: false,
        hostTrackedFileEditsRequired: true,
        directProcessWritesAreRollbackSafe: false,
        externalWriteCaptureVerified: false,
        doveRestoreSupported: false,
        operations
      };
    }
    if (result && typeof result === "object" && !Array.isArray(result)) {
      return { ...result, ...metadata };
    }
    return { result, ...metadata };
  }
}

export function createMutationContext(root, options = {}) {
  return new MutationContext(root, options);
}

export function runWithMutationContext(root, options, callback) {
  const context = createMutationContext(root, options);
  return mutationStorage.run(context, () => {
    const result = callback(context);
    return context.finish(result);
  });
}

export function currentMutationContext(root) {
  const context = mutationStorage.getStore();
  if (!context) {
    return null;
  }
  if (root) {
    const resolvedRoot = path.resolve(root);
    if (resolvedRoot !== context.root) {
      try {
        if (fs.realpathSync.native(resolvedRoot) !== fs.realpathSync.native(context.root)) {
          return null;
        }
      } catch {
        return null;
      }
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
