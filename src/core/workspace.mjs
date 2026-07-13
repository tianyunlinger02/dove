import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  GOVERNANCE_EXEMPT_MUTATIONS,
  GOVERNANCE_GUARDED_MUTATIONS,
  createDefaultState,
  createMetaOperatorFollowThroughIndex,
  createProgramApprovalsIndex,
  createProgramRunsIndex,
  createProgramsIndex,
  createWorkflowBoundaries,
  normalizeMetaOperatorFollowThroughIndex,
  normalizeProgramApprovalsIndex,
  normalizeProgramRunsIndex,
  normalizeProgramsIndex,
  normalizeState
} from "./schema.mjs";
import { followThroughAuthorityState } from "./follow-through-authority.mjs";
import { currentMutationContext } from "./mutation-backend.mjs";
import {
  WORKSPACE_BOOTSTRAP_DIRECTORIES,
  createManagedWorkspaceJsonArtifacts,
  createStarterMarkdown,
  createWorkspaceBootstrapJsonArtifacts
} from "./workspace-bootstrap.mjs";

export function assertNoPolicyOverrideArgs(args = {}, actionLabel = "This operation") {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return;
  }
  const fields = Object.keys(args).filter((key) => key.startsWith("policyOverride"));
  if (fields.length > 0) {
    throw new Error(`${actionLabel} does not accept retired policy override fields: ${fields.join(", ")}.`);
  }
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

function requireMutationContext(root, operation) {
  const context = currentMutationContext(root);
  if (!context) {
    throw new Error(`${operation} requires an active MutationContext.`);
  }
  return context;
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
  return requireMutationContext(root, "writeJson").writeJson(relativePath, value);
}

function writeJsonIfChanged(root, relativePath, value) {
  return requireMutationContext(root, "writeJsonIfChanged").writeJsonIfChanged(relativePath, value);
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
  return requireMutationContext(root, "writeText").writeText(relativePath, content);
}

export function writeBinary(root, relativePath, content) {
  return requireMutationContext(root, "writeBinary").writeBinary(relativePath, content);
}

export function appendText(root, relativePath, content) {
  return requireMutationContext(root, "appendText").appendText(relativePath, content);
}

function ensureFile(root, relativePath, content) {
  return requireMutationContext(root, "ensureFile").ensureFile(relativePath, content);
}

export function ensureWorkspace(root) {
  const context = requireMutationContext(root, "ensureWorkspace");
  const state = normalizeState(readJson(root, ARTIFACT_PATHS.state, createDefaultState));

  const created = [];
  for (const relativeDir of WORKSPACE_BOOTSTRAP_DIRECTORIES) {
    context.ensureDirectory(relativeDir);
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
  return normalizeState(readJson(root, ARTIFACT_PATHS.state, createDefaultState));
}

export function saveState(root, state) {
  const normalized = normalizeState(state);
  writeJson(root, ARTIFACT_PATHS.state, normalized);
  return normalized;
}

export function listArtifacts(root) {
  return Object.fromEntries(
    Object.entries(ARTIFACT_PATHS).map(([key, relativePath]) => {
      const fullPath = resolvePath(root, relativePath);
      return [key, { path: relativePath, exists: fs.existsSync(fullPath) }];
    })
  );
}

export function listDraftFiles(root) {
  const draftsDir = resolvePath(root, ARTIFACT_PATHS.draftsDir);
  if (!fs.existsSync(draftsDir)) {
    return [];
  }
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

export function assertFollowThroughReady(root, actionLabel, args = {}) {
  assertNoPolicyOverrideArgs(args, actionLabel);
  const ledger = normalizeMetaOperatorFollowThroughIndex(readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, createMetaOperatorFollowThroughIndex));
  const operatingState = {
    programs: normalizeProgramsIndex(readJson(root, ARTIFACT_PATHS.programsIndex, createProgramsIndex)),
    programRuns: normalizeProgramRunsIndex(readJson(root, ARTIFACT_PATHS.programRuns, createProgramRunsIndex)),
    programApprovals: normalizeProgramApprovalsIndex(readJson(root, ARTIFACT_PATHS.programApprovals, createProgramApprovalsIndex))
  };
  const actionRequiredItems = (ledger.items ?? []).filter((item) => {
    const status = item.status;
    const authorityState = followThroughAuthorityState(item, operatingState);
    const invalidStatus = Boolean(item.invalidStatus)
      || !["acknowledged", "accepted-for-execution", "executing", "deferred", "accepted-risk", "closed", "superseded"].includes(status)
      || !authorityState.trusted;
    const dueDeferred = status === "deferred" && item.deferUntil && String(item.deferUntil) <= nowIso();
    const targetBound = !["accepted-for-execution", "executing", "closed"].includes(status)
      ? true
      : targetArtifactContainsId(root, item.linkedTargetArtifact, item.linkedTargetId);
    const acceptedExecutionOpen = status === "accepted-for-execution" || status === "executing";
    return invalidStatus || Boolean(item.stale) || dueDeferred || !targetBound || acceptedExecutionOpen || status === "accepted-risk";
  }).map((item) => item.id);

  if (actionRequiredItems.length > 0) {
    throw new Error(`${actionLabel} is blocked while operator follow-through still requires action: ${actionRequiredItems.join(", ")}.`);
  }
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
