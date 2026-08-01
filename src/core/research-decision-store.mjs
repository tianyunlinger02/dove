import fs from "node:fs";
import path from "node:path";

import {
  appendResearchDecision as appendResearchDecisionChain,
  validateResearchDecisionChain
} from "./research-decisions.mjs";
import { currentMutationContext } from "./mutation-backend.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { assertGovernanceMutationRegistered, writeJson } from "./workspace.mjs";
import { openDoveWorkspace } from "./workspace-schema.mjs";

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const APPEND_FIELDS = new Set([
  "missionId",
  "predecessorDecisionId",
  "predecessorDecisionDigest",
  "createdAt",
  "content"
]);
const READ_FIELDS = new Set(["missionId"]);
const APPEND_LOCK_PATH = ".dove/.research-decision-append.lock";

function assertPlainObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
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

function safeId(value, label) {
  if (typeof value !== "string" || !SAFE_ID.test(value)) {
    throw new Error(`${label} must be a safe lowercase identifier.`);
  }
  return value;
}

export function researchDecisionPath(decisionId) {
  return path.posix.join(ARTIFACT_PATHS.researchDecisionsDir, `${safeId(decisionId, "decisionId")}.json`);
}

function sortedDecisions(decisions) {
  return [...decisions].sort((left, right) => (
    left.missionId.localeCompare(right.missionId)
    || left.revision - right.revision
    || left.decisionId.localeCompare(right.decisionId)
  ));
}

export function readResearchDecisions(root, options = {}) {
  assertSealed(options, READ_FIELDS, "Research decision read options");
  const workspace = openDoveWorkspace(root, { operation: "Research decision read" });
  const missionId = options.missionId === undefined ? null : safeId(options.missionId, "missionId");
  if (missionId !== null && !workspace.missions.has(missionId)) {
    throw new Error(`Research decision read references unknown mission ${missionId}.`);
  }
  const decisions = sortedDecisions(workspace.researchDecisions.values());
  return missionId === null ? decisions : decisions.filter((decision) => decision.missionId === missionId);
}

export function readCurrentResearchDecision(root, missionId) {
  const normalizedMissionId = safeId(missionId, "missionId");
  const workspace = openDoveWorkspace(root, { operation: "Current research decision read" });
  if (!workspace.missions.has(normalizedMissionId)) {
    throw new Error(`Current research decision read references unknown mission ${normalizedMissionId}.`);
  }
  return workspace.currentResearchDecisions.get(normalizedMissionId) ?? null;
}

export function appendResearchDecision(root, args = {}) {
  assertGovernanceMutationRegistered("append-research-decision", "guarded");
  assertSealed(args, APPEND_FIELDS, "appendResearchDecision");
  const context = currentMutationContext(root);
  if (!context) throw new Error("appendResearchDecision requires an active MutationContext.");

  const pendingAppend = context.operations().find((operation) => operation.relativePath.startsWith(`${ARTIFACT_PATHS.researchDecisionsDir}/`));
  if (pendingAppend) {
    throw new Error("appendResearchDecision allows only one research decision append per MutationContext.");
  }

  const missionId = safeId(args.missionId, "missionId");
  const workspace = openDoveWorkspace(root, { operation: "Research decision append" });
  const mission = workspace.missions.get(missionId);
  if (!mission) throw new Error(`Research decision append references unknown mission ${missionId}.`);
  if (mission.mode !== "research") throw new Error(`Research decision append requires a research mission; ${missionId} is ordinary.`);
  context.requireCommitPrecondition(path.posix.join(ARTIFACT_PATHS.missionsDir, `${mission.missionId}.json`));
  context.requireCommitPrecondition(ARTIFACT_PATHS.researchDecisionsDir);
  context.requireCommitLock(APPEND_LOCK_PATH, { label: "Research decision append lock" });

  const currentChain = readResearchDecisions(root, { missionId });
  const nextChain = appendResearchDecisionChain(currentChain, {
    missionId,
    contractDigest: mission.contractDigest,
    predecessorDecisionId: args.predecessorDecisionId,
    predecessorDecisionDigest: args.predecessorDecisionDigest,
    createdAt: args.createdAt,
    content: args.content
  });
  const decision = nextChain[nextChain.length - 1];
  const relativePath = researchDecisionPath(decision.decisionId);
  if (context.fileExists(relativePath) || fs.existsSync(path.resolve(root, relativePath))) {
    throw new Error(`Research decision id is already occupied: ${decision.decisionId}.`);
  }

  context.ensureDirectory(ARTIFACT_PATHS.researchDecisionsDir);
  writeJson(root, relativePath, decision);
  return {
    status: "appended",
    workspaceId: workspace.manifest.workspaceId,
    missionId,
    decision,
    currentResearchDecision: decision,
    writes: [relativePath]
  };
}
