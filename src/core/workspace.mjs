import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  GOVERNANCE_EXEMPT_MUTATIONS,
  GOVERNANCE_GUARDED_MUTATIONS,
  createDefaultState,
  createMetaOperatorFollowThroughIndex,
  createWorkflowBoundaries,
  normalizeMetaOperatorFollowThroughIndex,
  normalizeState
} from "./schema.mjs";
import { currentMutationContext, jsonContent } from "./mutation-backend.mjs";
import {
  WORKSPACE_BOOTSTRAP_DIRECTORIES,
  createManagedWorkspaceJsonArtifacts,
  createStarterMarkdown,
  createWorkspaceBootstrapJsonArtifacts
} from "./workspace-bootstrap.mjs";

function normalizeStringArrayLocal(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

const WORKFLOW_BOUNDARIES = createWorkflowBoundaries();

function isBootstrapManagedDovePath(relativePath) {
  return relativePath === ARTIFACT_PATHS.state || WORKFLOW_BOUNDARIES.doveBootstrapOnlyPaths.includes(relativePath);
}

export function nowIso() {
  return new Date().toISOString();
}

export function resolvePath(root, relativePath) {
  return path.join(root, relativePath);
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cloneFallback(fallback) {
  return typeof fallback === "function" ? fallback() : structuredClone(fallback);
}

function fileExists(root, relativePath) {
  const context = currentMutationContext(root);
  if (context) {
    return context.fileExists(relativePath);
  }
  return fs.existsSync(resolvePath(root, relativePath));
}

export function readJson(root, relativePath, fallback) {
  const context = currentMutationContext(root);
  if (context) {
    return context.readJson(relativePath, fallback);
  }
  const fullPath = resolvePath(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    return cloneFallback(fallback);
  }
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    throw new Error(`Malformed JSON in ${relativePath}: ${error.message}`);
  }
}

export function writeJson(root, relativePath, value) {
  const context = currentMutationContext(root);
  if (context) {
    return context.writeJson(relativePath, value);
  }
  const fullPath = resolvePath(root, relativePath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, jsonContent(value), "utf8");
  return null;
}

function writeJsonIfChanged(root, relativePath, value) {
  const context = currentMutationContext(root);
  if (context) {
    return context.writeJsonIfChanged(relativePath, value);
  }
  const fullPath = resolvePath(root, relativePath);
  const nextContent = jsonContent(value);
  ensureDir(path.dirname(fullPath));
  if (fs.existsSync(fullPath) && fs.readFileSync(fullPath, "utf8") === nextContent) {
    return false;
  }
  fs.writeFileSync(fullPath, nextContent, "utf8");
  return true;
}

function reconcileManagedJsonArtifact(root, relativePath, fallback, normalize) {
  const normalized = normalize(readJson(root, relativePath, fallback));
  writeJsonIfChanged(root, relativePath, normalized);
  return normalized;
}

export function readText(root, relativePath, fallback = "") {
  const context = currentMutationContext(root);
  if (context) {
    return context.readText(relativePath, fallback);
  }
  const fullPath = resolvePath(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    return fallback;
  }
  return fs.readFileSync(fullPath, "utf8");
}

export function writeText(root, relativePath, content) {
  const context = currentMutationContext(root);
  if (context) {
    return context.writeText(relativePath, content);
  }
  const fullPath = resolvePath(root, relativePath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content, "utf8");
  return null;
}

export function appendText(root, relativePath, content) {
  const context = currentMutationContext(root);
  if (context) {
    return context.appendText(relativePath, content);
  }
  const fullPath = resolvePath(root, relativePath);
  ensureDir(path.dirname(fullPath));
  fs.appendFileSync(fullPath, content, "utf8");
  return null;
}

function ensureFile(root, relativePath, content) {
  const context = currentMutationContext(root);
  if (context) {
    return context.ensureFile(relativePath, content);
  }
  const fullPath = resolvePath(root, relativePath);
  ensureDir(path.dirname(fullPath));
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, content, "utf8");
    return true;
  }
  return false;
}

export function ensureWorkspace(root) {
  const state = normalizeState(readJson(root, ARTIFACT_PATHS.state, createDefaultState));
  const context = currentMutationContext(root);

  const created = [];
  for (const relativeDir of WORKSPACE_BOOTSTRAP_DIRECTORIES) {
    if (context) {
      context.ensureDirectory(relativeDir);
    } else {
      ensureDir(resolvePath(root, relativeDir));
    }
  }

  if (!fileExists(root, ARTIFACT_PATHS.state)) {
    writeJson(root, ARTIFACT_PATHS.state, state);
    created.push(ARTIFACT_PATHS.state);
  }

  for (const [relativePath, content] of Object.entries(createStarterMarkdown(state))) {
    if (isBootstrapManagedDovePath(relativePath) && ensureFile(root, relativePath, content)) {
      created.push(relativePath);
    }
  }

  for (const [relativePath, factory] of createWorkspaceBootstrapJsonArtifacts(state)) {
    if (isBootstrapManagedDovePath(relativePath) && !fileExists(root, relativePath)) {
      writeJson(root, relativePath, factory());
      created.push(relativePath);
    }
  }

  for (const [relativePath, fallback, normalize] of createManagedWorkspaceJsonArtifacts()) {
    reconcileManagedJsonArtifact(root, relativePath, fallback, normalize);
  }

  return { root, created };
}

export function loadState(root) {
  ensureWorkspace(root);
  return normalizeState(readJson(root, ARTIFACT_PATHS.state, createDefaultState));
}

export function saveState(root, state) {
  const normalized = normalizeState(state);
  writeJson(root, ARTIFACT_PATHS.state, normalized);
  return normalized;
}

export function listArtifacts(root) {
  ensureWorkspace(root);
  return Object.fromEntries(
    Object.entries(ARTIFACT_PATHS).map(([key, relativePath]) => {
      const fullPath = resolvePath(root, relativePath);
      return [key, { path: relativePath, exists: fs.existsSync(fullPath) }];
    })
  );
}

export function listDraftFiles(root) {
  ensureWorkspace(root);
  const draftsDir = resolvePath(root, ARTIFACT_PATHS.draftsDir);
  return fs.readdirSync(draftsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => entry.name);
}

export function extractCitationKeysFromText(content) {
  const keys = [];
  const pattern = /\[cite:([^\]]+)\]/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const key = match[1]?.trim();
    if (key) {
      keys.push(key);
    }
  }
  return keys;
}

export function listDraftCitationKeys(root) {
  const citations = [];
  for (const draftFile of listDraftFiles(root)) {
    const content = readText(root, `${ARTIFACT_PATHS.draftsDir}/${draftFile}`, "");
    const keys = extractCitationKeysFromText(content);
    for (const key of keys) {
      citations.push({ draftFile, key });
    }
  }
  return citations;
}

function targetArtifactContainsId(root, artifactPath, targetId) {
  if (!artifactPath || !targetId) {
    return false;
  }
  const fullPath = resolvePath(root, artifactPath);
  if (!fs.existsSync(fullPath)) {
    return false;
  }
  const extension = path.extname(artifactPath).toLowerCase();
  if (extension === ".json") {
    try {
      const value = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      const queue = [value];
      while (queue.length > 0) {
        const current = queue.shift();
        if (current === targetId) {
          return true;
        }
        if (Array.isArray(current)) {
          queue.push(...current);
          continue;
        }
        if (current && typeof current === "object") {
          queue.push(...Object.values(current));
        }
      }
      return false;
    } catch {
      return false;
    }
  }
  return fs.readFileSync(fullPath, "utf8").includes(String(targetId));
}

function normalizeGuardPolicyOverride(args = {}) {
  const reason = typeof args.policyOverrideReason === "string" ? args.policyOverrideReason.trim() : "";
  const reasonCode = typeof args.policyOverrideReasonCode === "string" ? args.policyOverrideReasonCode.trim() : "";
  return {
    active: reason.length > 0,
    reason,
    reasonCode,
    actorRole: typeof args.actorRole === "string" && args.actorRole.trim().length > 0 ? args.actorRole : null,
    evidencePaths: Array.isArray(args.policyOverrideEvidencePaths) ? args.policyOverrideEvidencePaths.filter((item) => typeof item === "string" && item.trim().length > 0) : [],
    targetArtifact: typeof args.policyOverrideTargetArtifact === "string" && args.policyOverrideTargetArtifact.trim().length > 0 ? args.policyOverrideTargetArtifact : null,
    targetId: typeof args.policyOverrideTargetId === "string" && args.policyOverrideTargetId.trim().length > 0 ? args.policyOverrideTargetId : null,
    sourceId: typeof args.policyOverrideSourceId === "string" && args.policyOverrideSourceId.trim().length > 0 ? args.policyOverrideSourceId : null,
    phase: typeof args.policyOverridePhase === "string" && args.policyOverridePhase.trim().length > 0 ? args.policyOverridePhase : null,
    expiresAt: typeof args.policyOverrideExpiresAt === "string" && args.policyOverrideExpiresAt.trim().length > 0 ? args.policyOverrideExpiresAt : null
  };
}

function artifactPathLocallyRelates(candidatePath, anchorPath) {
  if (!candidatePath || !anchorPath) {
    return false;
  }
  if (candidatePath === anchorPath) {
    return true;
  }
  const candidateDir = path.dirname(candidatePath);
  const anchorDir = path.dirname(anchorPath);
  return candidateDir === anchorDir
    || candidatePath.startsWith(`${anchorDir}/`)
    || anchorPath.startsWith(`${candidateDir}/`);
}

export function isRelevantOverrideEvidencePath(root, item = {}, evidencePath) {
  if (!evidencePath || !fs.existsSync(resolvePath(root, evidencePath))) {
    return false;
  }
  const anchors = [
    item.sourceArtifactPath,
    item.linkedTargetArtifact,
    ...(item.closureArtifactPaths ?? [])
  ].filter(Boolean);
  if (anchors.some((anchorPath) => artifactPathLocallyRelates(evidencePath, anchorPath))) {
    return true;
  }
  const ids = [item.linkedTargetId, item.sourceId].filter(Boolean);
  return ids.some((targetId) => targetArtifactContainsId(root, evidencePath, targetId));
}

export function overrideEvidenceRelevantToItems(root, items = [], evidencePaths = []) {
  const normalizedEvidencePaths = normalizeStringArrayLocal(evidencePaths);
  if (normalizedEvidencePaths.length === 0) {
    return { ok: false, unrelatedItemIds: items.map((item) => item.id), relevantEvidencePaths: [] };
  }
  const unrelatedItemIds = items
    .filter((item) => !normalizedEvidencePaths.some((artifactPath) => isRelevantOverrideEvidencePath(root, item, artifactPath)))
    .map((item) => item.id);
  return {
    ok: unrelatedItemIds.length === 0,
    unrelatedItemIds,
    relevantEvidencePaths: normalizedEvidencePaths.filter((artifactPath) => items.some((item) => isRelevantOverrideEvidencePath(root, item, artifactPath)))
  };
}

export function assertFollowThroughReady(root, actionLabel, args = {}) {
  const ledger = normalizeMetaOperatorFollowThroughIndex(readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, createMetaOperatorFollowThroughIndex));
  const override = normalizeGuardPolicyOverride(args);
  const currentState = loadState(root);
  const currentOwner = currentState.orchestrationBoard?.assignedRole ?? "planner";
  const currentPhase = currentState.pipeline?.currentStage ?? currentState.orchestrationBoard?.currentPhase ?? "init";
  const actionRequiredItems = (ledger.items ?? []).filter((item) => {
    const status = item.status;
    const invalidStatus = Boolean(item.invalidStatus) || !["acknowledged", "accepted-for-execution", "executing", "deferred", "accepted-risk", "closed", "superseded"].includes(status);
    const dueDeferred = status === "deferred" && item.deferUntil && String(item.deferUntil) <= nowIso();
    const targetBound = !["accepted-for-execution", "executing", "closed"].includes(status)
      ? true
      : targetArtifactContainsId(root, item.linkedTargetArtifact, item.linkedTargetId);
    const acceptedExecutionOpen = status === "accepted-for-execution" || status === "executing";
    return invalidStatus || Boolean(item.stale) || dueDeferred || !targetBound || acceptedExecutionOpen;
  }).map((item) => item.id);

  if (actionRequiredItems.length === 0) {
    return;
  }
  if (override.active) {
    const relevance = override.actorRole ? overrideEvidenceRelevantToItems(root, (ledger.items ?? []).filter((item) => actionRequiredItems.includes(item.id)), override.evidencePaths) : { ok: false, unrelatedItemIds: actionRequiredItems };
    const targetItems = (ledger.items ?? []).filter((item) => actionRequiredItems.includes(item.id));
    const targetMatch = targetItems.some((item) => item.linkedTargetArtifact === override.targetArtifact && item.linkedTargetId === override.targetId);
    const sourceMatch = targetItems.some((item) => item.sourceId === override.sourceId);
    const notExpired = override.expiresAt && String(override.expiresAt) > nowIso();
    const withinWindow = notExpired && String(override.expiresAt) <= new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const actorMatches = override.actorRole && override.actorRole === currentOwner;
    const reasonCodeAllowed = ["emergency-repair", "manual-reconciliation", "operator-acknowledged-exception"].includes(override.reasonCode);
    const phaseMatches = override.phase === currentPhase;
    if (relevance.ok && targetMatch && sourceMatch && phaseMatches && withinWindow && actorMatches && reasonCodeAllowed) {
      return;
    }
    throw new Error(`${actionLabel} cannot override follow-through governance without current-owner actorRole, matching policyOverrideSourceId, matching policyOverrideTargetArtifact/policyOverrideTargetId, matching policyOverridePhase, allowed policyOverrideReasonCode, relevant policyOverrideEvidencePaths, and a short future policyOverrideExpiresAt. Action-required records: ${actionRequiredItems.join(", ")}. Unrelated records: ${relevance.unrelatedItemIds.join(", ") || "none"}.`);
  }
  throw new Error(`${actionLabel} is blocked while operator follow-through still requires action: ${actionRequiredItems.join(", ")}.`);
}

export function assertGovernanceMutationRegistered(actionId, expectedMode) {
  const guarded = new Map(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => [entry.id, entry]));
  const exempt = new Map(GOVERNANCE_EXEMPT_MUTATIONS.map((entry) => [entry.id, entry]));
  if (expectedMode === "guarded") {
    if (!guarded.has(actionId)) {
      throw new Error(`Governance registry missing guarded mutation entry: ${actionId}`);
    }
    return;
  }
  if (expectedMode === "exempt") {
    const entry = exempt.get(actionId);
    if (!entry) {
      throw new Error(`Governance registry missing exempt mutation entry: ${actionId}`);
    }
    if (entry.sunsetAt && entry.sunsetAt <= nowIso()) {
      throw new Error(`Governance exempt entry expired: ${actionId}`);
    }
    return;
  }
  throw new Error(`Unknown governance mutation mode: ${expectedMode}`);
}
