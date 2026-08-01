import crypto from "node:crypto";
import path from "node:path";

import { ARTIFACT_PATHS } from "./schema.mjs";

export const MISSION_TRANSITION_SCHEMA_VERSION = 1;
export const MISSION_TERMINAL_STATUSES = Object.freeze(["completed", "stopped", "failed"]);

const STATUS_SET = new Set(MISSION_TERMINAL_STATUSES);
const TRIGGER_SET = new Set(["user", "workspace-revision", "research-decision", "completion-gate"]);
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const FIELDS = new Set(["schemaVersion", "workspaceId", "transitionId", "transitionDigest", "missionId", "contractDigest", "workspaceRevisionId", "status", "reason", "evidenceRefs", "trigger", "createdAt"]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]));
  return value;
}
function serialize(value) { return JSON.stringify(stableValue(value)); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function plain(value, label) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`); }
function sealed(value, fields, label) { plain(value, label); const unknown = Object.keys(value).filter((field) => !fields.has(field)); if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`); }
function safeId(value, label) { if (typeof value !== "string" || !SAFE_ID.test(value)) throw new Error(`${label} must be a safe lowercase identifier.`); return value; }
function hash(value, label) { if (typeof value !== "string" || !HASH.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest.`); return value; }
function text(value, label) { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`); return value.trim(); }
function exactIso(value, label) { if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`); return value; }
function strings(value, label) { if (!Array.isArray(value)) throw new Error(`${label} must be an array.`); const result = value.map((item, index) => text(item, `${label}[${index}]`)); if (new Set(result).size !== result.length) throw new Error(`${label} must not contain duplicates.`); return result; }
function normalized(value) {
  const status = text(value.status, "Mission transition status");
  if (!STATUS_SET.has(status)) throw new Error("Mission transition status is unsupported.");
  const trigger = text(value.trigger, "Mission transition trigger");
  if (!TRIGGER_SET.has(trigger)) throw new Error("Mission transition trigger is unsupported.");
  return {
    workspaceId: safeId(value.workspaceId, "Mission transition workspaceId"),
    missionId: safeId(value.missionId, "Mission transition missionId"),
    contractDigest: hash(value.contractDigest, "Mission transition contractDigest"),
    workspaceRevisionId: safeId(value.workspaceRevisionId, "Mission transition workspaceRevisionId"),
    status,
    reason: text(value.reason, "Mission transition reason"),
    evidenceRefs: strings(value.evidenceRefs ?? [], "Mission transition evidenceRefs"),
    trigger,
    createdAt: exactIso(value.createdAt, "Mission transition createdAt")
  };
}
function digest(value) { return sha256(serialize({ schemaVersion: MISSION_TRANSITION_SCHEMA_VERSION, ...normalized(value) })); }
function transitionId(missionId, transitionDigest) { return `mission-transition-${sha256(serialize({ missionId, transitionDigest })).slice(0, 24)}`; }

export function createMissionTransition(value) {
  const content = normalized(value);
  const transitionDigest = digest(content);
  return { schemaVersion: MISSION_TRANSITION_SCHEMA_VERSION, transitionId: transitionId(content.missionId, transitionDigest), transitionDigest, ...content };
}

export function validateMissionTransition(value, options = {}) {
  const label = options.label ?? "Mission transition";
  sealed(value, FIELDS, label);
  if (value.schemaVersion !== MISSION_TRANSITION_SCHEMA_VERSION) throw new Error(`${label} has an unsupported schemaVersion.`);
  const content = normalized(value);
  const transitionDigest = digest(content);
  const expectedId = transitionId(content.missionId, transitionDigest);
  if (value.transitionDigest !== transitionDigest || value.transitionId !== expectedId) throw new Error(`${label} does not match its canonical content.`);
  if (options.workspaceId !== undefined && content.workspaceId !== options.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest.`);
  if (options.filename !== undefined && options.filename !== `${expectedId}.json`) throw new Error(`${label} filename must match transitionId.`);
  const mission = options.missions?.get(content.missionId);
  if (!mission || mission.contractDigest !== content.contractDigest) throw new Error(`${label} does not bind an existing exact mission contract.`);
  return { schemaVersion: MISSION_TRANSITION_SCHEMA_VERSION, transitionId: expectedId, transitionDigest, ...content };
}

export function validateMissionTransitions(values, options = {}) {
  const byMission = new Map();
  for (const value of values) {
    const transition = validateMissionTransition(value, options);
    if (byMission.has(transition.missionId)) throw new Error(`Mission ${transition.missionId} has more than one terminal transition.`);
    byMission.set(transition.missionId, transition);
  }
  return byMission;
}

export function missionTransitionPath(transitionIdValue) {
  return path.posix.join(ARTIFACT_PATHS.missionTransitionsDir, `${safeId(transitionIdValue, "Mission transition id")}.json`);
}

export function missionLifecycle(workspace, missionId) {
  return workspace.missionTransitions?.get(missionId) ?? null;
}

export function assertMissionLifecycleAcceptsWrites(workspace, mission, options = {}) {
  const transition = missionLifecycle(workspace, mission.missionId);
  if (!transition) return;
  const suffix = options.receipt === true ? "and no longer accepts execution receipts." : "and is read-only history.";
  throw new Error(`Mission ${mission.missionId} is ${transition.status} ${suffix}`);
}
