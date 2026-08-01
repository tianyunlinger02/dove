import crypto from "node:crypto";
import path from "node:path";

import { normalizeProjectRelativePath } from "./artifact-integrity.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";

export const ARTIFACT_HANDOFF_SCHEMA_VERSION = 1;

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const FIELDS = new Set(["schemaVersion", "workspaceId", "handoffId", "handoffDigest", "path", "fromMissionId", "toMissionId", "fromReceiptId", "fromSha256", "reason", "createdAt"]);
function stableValue(value) { if (Array.isArray(value)) return value.map(stableValue); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)])); return value; }
function serialize(value) { return JSON.stringify(stableValue(value)); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function plain(value, label) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`); }
function sealed(value, fields, label) { plain(value, label); const unknown = Object.keys(value).filter((field) => !fields.has(field)); if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`); }
function safeId(value, label) { if (typeof value !== "string" || !SAFE_ID.test(value)) throw new Error(`${label} must be a safe lowercase identifier.`); return value; }
function hash(value, label) { if (typeof value !== "string" || !HASH.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest.`); return value; }
function text(value, label) { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`); return value.trim(); }
function exactIso(value, label) { if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`); return value; }
function canonicalPath(value) { const normalized = normalizeProjectRelativePath(value); if (!normalized.ok || normalized.normalizedPath !== value) throw new Error("Artifact handoff path must be a canonical safe project-relative path."); return value; }
function normalized(value) {
  const fromMissionId = safeId(value.fromMissionId, "Artifact handoff fromMissionId");
  const toMissionId = safeId(value.toMissionId, "Artifact handoff toMissionId");
  if (fromMissionId === toMissionId) throw new Error("Artifact handoff must transfer authority to a different mission.");
  return {
    workspaceId: safeId(value.workspaceId, "Artifact handoff workspaceId"),
    path: canonicalPath(value.path),
    fromMissionId,
    toMissionId,
    fromReceiptId: safeId(value.fromReceiptId, "Artifact handoff fromReceiptId"),
    fromSha256: hash(value.fromSha256, "Artifact handoff fromSha256"),
    reason: text(value.reason, "Artifact handoff reason"),
    createdAt: exactIso(value.createdAt, "Artifact handoff createdAt")
  };
}
function digest(value) { return sha256(serialize({ schemaVersion: ARTIFACT_HANDOFF_SCHEMA_VERSION, ...normalized(value) })); }
function id(value, handoffDigest) { return `artifact-handoff-${sha256(serialize({ path: value.path, fromMissionId: value.fromMissionId, toMissionId: value.toMissionId, handoffDigest })).slice(0, 24)}`; }
export function createArtifactHandoff(value) { const content = normalized(value); const handoffDigest = digest(content); return { schemaVersion: ARTIFACT_HANDOFF_SCHEMA_VERSION, handoffId: id(content, handoffDigest), handoffDigest, ...content }; }
export function validateArtifactHandoff(value, options = {}) {
  const label = options.label ?? "Artifact handoff";
  sealed(value, FIELDS, label);
  if (value.schemaVersion !== ARTIFACT_HANDOFF_SCHEMA_VERSION) throw new Error(`${label} has an unsupported schemaVersion.`);
  const content = normalized(value); const handoffDigest = digest(content); const handoffId = id(content, handoffDigest);
  if (value.handoffDigest !== handoffDigest || value.handoffId !== handoffId) throw new Error(`${label} does not match its canonical content.`);
  if (options.workspaceId !== undefined && content.workspaceId !== options.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest.`);
  if (options.filename !== undefined && options.filename !== `${handoffId}.json`) throw new Error(`${label} filename must match handoffId.`);
  if (!options.missions?.has(content.fromMissionId) || !options.missions?.has(content.toMissionId)) throw new Error(`${label} references an unknown mission.`);
  return { schemaVersion: ARTIFACT_HANDOFF_SCHEMA_VERSION, handoffId, handoffDigest, ...content };
}
export function validateArtifactHandoffs(values, options = {}) {
  const byPath = new Map(); const byId = new Map();
  for (const value of values) {
    const handoff = validateArtifactHandoff(value, options);
    if (byId.has(handoff.handoffId)) throw new Error(`Duplicate artifact handoff ${handoff.handoffId}.`);
    byId.set(handoff.handoffId, handoff);
    const chain = byPath.get(handoff.path) ?? [];
    chain.push(handoff); byPath.set(handoff.path, chain);
  }
  for (const [artifactPath, chain] of byPath) {
    chain.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.handoffId.localeCompare(b.handoffId));
    const outgoing = new Map();
    for (const handoff of chain) {
      if (outgoing.has(handoff.fromMissionId)) throw new Error(`Artifact handoff chain forks for ${artifactPath} at mission ${handoff.fromMissionId}.`);
      outgoing.set(handoff.fromMissionId, handoff.toMissionId);
    }
    const seen = new Set(); let current = chain[0]?.fromMissionId;
    while (current && outgoing.has(current)) { if (seen.has(current)) throw new Error(`Artifact handoff chain contains a cycle for ${artifactPath}.`); seen.add(current); current = outgoing.get(current); }
  }
  return { byId, byPath };
}
export function validateArtifactHandoffAuthority(handoffs, receiptLedger) {
  if (!handoffs?.byPath || !(handoffs.byPath instanceof Map)) throw new Error("Artifact handoff authority validation requires validated handoff chains.");
  if (!receiptLedger || !Array.isArray(receiptLedger.artifactHistory)) throw new Error("Artifact handoff authority validation requires the validated execution receipt ledger.");
  const receiptByPathAndId = new Map();
  for (const entry of receiptLedger.artifactHistory) receiptByPathAndId.set(`${entry.path}\n${entry.receiptId}`, entry);
  for (const [artifactPath, chain] of handoffs.byPath) {
    let expectedOwner = null;
    for (const handoff of chain) {
      const source = receiptByPathAndId.get(`${artifactPath}\n${handoff.fromReceiptId}`);
      if (!source || source.missionId !== handoff.fromMissionId || source.sha256 !== handoff.fromSha256) {
        throw new Error(`Artifact handoff ${handoff.handoffId} source receipt does not prove ownership of ${artifactPath} by mission ${handoff.fromMissionId}.`);
      }
      if (expectedOwner !== null && handoff.fromMissionId !== expectedOwner) {
        throw new Error(`Artifact handoff chain for ${artifactPath} does not continue from the previously authorized owner ${expectedOwner}.`);
      }
      expectedOwner = handoff.toMissionId;
    }
  }
  return handoffs;
}
export function artifactHandoffPath(handoffId) { return path.posix.join(ARTIFACT_PATHS.artifactHandoffsDir, `${safeId(handoffId, "Artifact handoff id")}.json`); }
export function handoffAuthorizes(handoffs, artifactPath, fromMissionId, toMissionId, receiptId, sha256Value) {
  const chain = handoffs?.byPath?.get(artifactPath) ?? [];
  return chain.some((handoff) => handoff.fromMissionId === fromMissionId && handoff.toMissionId === toMissionId && handoff.fromReceiptId === receiptId && handoff.fromSha256 === sha256Value);
}
