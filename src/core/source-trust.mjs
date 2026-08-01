import fs from "node:fs";
import path from "node:path";

import { snapshotArtifactBuffer } from "./review-artifact-snapshot.mjs";
import {
  assertSealedDomainArgs, canonicalDomainPath, domainJson, domainNonEmptyText,
  domainSafeId, domainStringArray, finalizeDomainArtifacts, readCurrentMission
} from "./domain-artifacts.mjs";
import { missionCanReadMission } from "./mission-graph.mjs";
import { readJson } from "./workspace.mjs";
import { openDoveWorkspace } from "./workspace-schema.mjs";

export const SOURCE_SCHEMA_VERSION = 3;
export const SOURCE_LIFECYCLE_STATES = Object.freeze(["candidate", "rejected"]);
export const SOURCE_USE_LIMITATION = "Captured source material is current but not independently verified.";

const HASH = /^[0-9a-f]{64}$/u;
const SOURCE_FIELDS = new Set([
  "schemaVersion", "sourceId", "missionId", "contractDigest", "citationKey", "title", "authors", "year", "locator", "sourceType",
  "abstract", "origin", "capturedMaterial", "lifecycle", "currentDecision", "useLimitation"
]);
const MATERIAL_FIELDS = new Set(["path", "sizeBytes", "sha256", "capturedAt"]);
const CANDIDATE_FIELDS = new Set(["decision", "decidedAt", "reason"]);
const REJECTED_FIELDS = new Set(["decision", "method", "checkedMaterial", "auditEvidence", "decidedAt"]);
const AUDIT_FIELDS = new Set(["reference", "kind", "observation"]);
const REGISTER_FIELDS = new Set(["missionId", "sourceId", "citationKey", "title", "authors", "year", "locator", "sourceType", "abstract", "origin", "capturePath"]);
const REJECT_FIELDS = new Set(["missionId", "sourceId", "method", "checkedMaterial", "auditEvidence"]);
const QUERY_FIELDS = new Set(["missionId", "sourceId", "lifecycle", "limit"]);

function text(value) { return typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : ""; }
function sealed(value, fields, label) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`); const unknown = Object.keys(value).filter((field) => !fields.has(field)); if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`); return value; }
function timestamp(value, label) { if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`); return value; }
function sourcePath(id) { return path.posix.join(".dove/sources", `${id}.json`); }
function materialSnapshot(root, rawPath, includeContent = false) { const canonical = canonicalDomainPath(rawPath, "capturePath"); const snapshot = snapshotArtifactBuffer(root, canonical, "capturePath"); return includeContent ? snapshot : { path: snapshot.path, sizeBytes: snapshot.sizeBytes, sha256: snapshot.sha256 }; }

export function validateStoredSource(root, source, filename, missions, label) {
  sealed(source, SOURCE_FIELDS, label);
  if (source.schemaVersion !== SOURCE_SCHEMA_VERSION) throw new Error(`${label} has an unsupported schemaVersion.`);
  const sourceId = domainSafeId(source.sourceId, `${label}.sourceId`);
  if (filename !== `${sourceId}.json`) throw new Error(`${label} filename must match sourceId.`);
  const missionId = domainSafeId(source.missionId, `${label}.missionId`);
  const mission = missions.get(missionId);
  if (!mission || source.contractDigest !== mission.contractDigest || !HASH.test(String(source.contractDigest))) throw new Error(`${label}.contractDigest does not match its mission.`);
  if (!source.title && !source.locator) throw new Error(`${label} requires a title or locator.`);
  domainStringArray(source.authors, `${label}.authors`);
  if (!SOURCE_LIFECYCLE_STATES.includes(source.lifecycle)) throw new Error(`${label}.lifecycle is unsupported.`);
  if (source.useLimitation !== SOURCE_USE_LIMITATION) throw new Error(`${label}.useLimitation must preserve the explicit independent-verification limitation.`);
  sealed(source.capturedMaterial, MATERIAL_FIELDS, `${label}.capturedMaterial`);
  const materialPath = canonicalDomainPath(source.capturedMaterial.path, `${label}.capturedMaterial.path`, ".dove/sources/materials");
  if (!HASH.test(String(source.capturedMaterial.sha256)) || !Number.isSafeInteger(source.capturedMaterial.sizeBytes) || source.capturedMaterial.sizeBytes < 1) throw new Error(`${label}.capturedMaterial is invalid.`);
  timestamp(source.capturedMaterial.capturedAt, `${label}.capturedMaterial.capturedAt`);
  const material = materialSnapshot(root, materialPath, true);
  if (material.path !== materialPath || material.sha256 !== source.capturedMaterial.sha256 || material.sizeBytes !== source.capturedMaterial.sizeBytes) throw new Error(`${label}.capturedMaterial is missing, aliased, empty, size-drifted, or hash-drifted.`);
  sealed(source.currentDecision, source.lifecycle === "candidate" ? CANDIDATE_FIELDS : REJECTED_FIELDS, `${label}.currentDecision`);
  if (source.currentDecision.decision !== source.lifecycle) throw new Error(`${label}.currentDecision does not match lifecycle.`);
  timestamp(source.currentDecision.decidedAt, `${label}.currentDecision.decidedAt`);
  if (source.lifecycle === "candidate") domainNonEmptyText(source.currentDecision.reason, `${label}.currentDecision.reason`);
  else {
    domainNonEmptyText(source.currentDecision.method, `${label}.currentDecision.method`);
    domainNonEmptyText(source.currentDecision.checkedMaterial, `${label}.currentDecision.checkedMaterial`);
    if (!Array.isArray(source.currentDecision.auditEvidence) || source.currentDecision.auditEvidence.length === 0) throw new Error(`${label}.currentDecision.auditEvidence is required.`);
    source.currentDecision.auditEvidence.forEach((item, index) => { sealed(item, AUDIT_FIELDS, `${label}.currentDecision.auditEvidence[${index}]`); for (const field of AUDIT_FIELDS) domainNonEmptyText(item[field], `${label}.currentDecision.auditEvidence[${index}].${field}`); });
  }
  return source;
}

function readSourceFiles(root) {
  const workspace = openDoveWorkspace(root, { operation: "Source query" });
  return fs.readdirSync(path.resolve(root, ".dove/sources"), { withFileTypes: true })
    .filter((entry) => entry.name !== "materials")
    .map((entry) => {
      const relativePath = path.posix.join(".dove/sources", entry.name);
      if (entry.isSymbolicLink() || !entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${relativePath} must be a regular JSON source file.`);
      return validateStoredSource(root, readJson(root, relativePath, null), entry.name, workspace.missions, relativePath);
    }).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}

function newSource(args, material, contractDigest, existing) {
  const title = text(args.title); const locator = text(args.locator);
  if (!title && !locator) throw new Error("register_source requires a real title or locator.");
  const capturedAt = new Date().toISOString();
  return {
    schemaVersion: SOURCE_SCHEMA_VERSION,
    sourceId: domainSafeId(args.sourceId, "sourceId"),
    missionId: domainSafeId(args.missionId, "missionId"),
    contractDigest,
    citationKey: text(args.citationKey) || null,
    title: title || null,
    authors: domainStringArray(args.authors, "authors"),
    year: args.year === undefined || args.year === null || String(args.year).trim() === "" ? null : String(args.year).trim(),
    locator: locator || null,
    sourceType: text(args.sourceType) || null,
    abstract: text(args.abstract) || null,
    origin: text(args.origin) || null,
    capturedMaterial: { ...material, capturedAt },
    lifecycle: "candidate",
    currentDecision: { decision: "candidate", decidedAt: capturedAt, reason: existing ? "source-capture-refreshed" : "source-captured" },
    useLimitation: SOURCE_USE_LIMITATION
  };
}

export function registerSource(root, args = {}) {
  assertSealedDomainArgs(args, REGISTER_FIELDS, "register_source");
  const { mission } = readCurrentMission(root, args.missionId, "Source registration");
  readSourceFiles(root);
  const id = domainSafeId(args.sourceId, "sourceId");
  const relativePath = sourcePath(id);
  const existing = fs.existsSync(path.resolve(root, relativePath)) ? readJson(root, relativePath, null) : null;
  if (existing && existing.missionId !== mission.missionId) throw new Error(`Source ${id} belongs to another mission.`);
  const captured = materialSnapshot(root, args.capturePath, true);
  const materialPath = path.posix.join(".dove/sources/materials", `${id}${path.extname(captured.path).toLowerCase() || ".bin"}`);
  const source = newSource(args, { path: materialPath, sizeBytes: captured.sizeBytes, sha256: captured.sha256 }, mission.contractDigest, existing);
  return { ...finalizeDomainArtifacts(root, { actionId: "register-source", operation: "Source registration", missionId: mission.missionId, summary: `Captured source candidate ${id}.`, writes: [{ path: materialPath, kind: "document", content: captured.content, derivedReferences: [] }, { path: relativePath, kind: "data", content: domainJson(source), derivedReferences: [`artifact:${materialPath}`] }] }), source };
}
function auditEvidence(value) { if (!Array.isArray(value) || value.length === 0) throw new Error("verify_source requires at least one auditEvidence item."); return value.map((item, index) => { sealed(item, AUDIT_FIELDS, `auditEvidence[${index}]`); return Object.fromEntries([...AUDIT_FIELDS].map((field) => [field, domainNonEmptyText(item[field], `auditEvidence[${index}].${field}`)])); }); }
export function verifySource(root, args = {}) {
  assertSealedDomainArgs(args, REJECT_FIELDS, "verify_source");
  const { mission } = readCurrentMission(root, args.missionId, "Source rejection");
  const id = domainSafeId(args.sourceId, "sourceId");
  const source = readSourceFiles(root).find((item) => item.sourceId === id);
  if (!source || source.missionId !== mission.missionId) throw new Error("Source rejection cannot resolve the exact mission-bound source.");
  const next = { ...source, lifecycle: "rejected", currentDecision: { decision: "rejected", method: domainNonEmptyText(args.method, "method"), checkedMaterial: domainNonEmptyText(args.checkedMaterial, "checkedMaterial"), auditEvidence: auditEvidence(args.auditEvidence), decidedAt: new Date().toISOString() } };
  return { ...finalizeDomainArtifacts(root, { actionId: "verify-source", operation: "Source rejection", missionId: mission.missionId, summary: `Rejected source ${id}.`, writes: [{ path: sourcePath(id), kind: "data", content: domainJson(next), derivedReferences: [`artifact:${source.capturedMaterial.path}`] }] }), source: next };
}

export function sourceEligibility(source, _unused = [], options = {}) {
  const base = { source, limitation: source?.useLimitation ?? SOURCE_USE_LIMITATION };
  if (!source) return { ...base, eligible: false, reason: "unknown-source" };
  let readable = false;
  try { readable = missionCanReadMission(options.missionGraph, text(options.missionId), source.missionId); } catch { readable = false; }
  if (!readable) return { ...base, eligible: false, reason: "source-mission-binding-mismatch" };
  if (source.lifecycle !== "candidate") return { ...base, eligible: false, reason: `source-${source.lifecycle}` };
  try {
    const material = materialSnapshot(options.root, source.capturedMaterial.path, true);
    if (material.sha256 !== source.capturedMaterial.sha256 || material.sizeBytes !== source.capturedMaterial.sizeBytes) return { ...base, eligible: false, reason: "source-captured-material-changed" };
  } catch { return { ...base, eligible: false, reason: "source-captured-material-invalid" }; }
  return { ...base, eligible: true, reason: "current-captured-source-not-independently-verified" };
}
export function evaluateSourceIds(root, ids = [], missionId = null) { const workspace = openDoveWorkspace(root, { operation: "Source evaluation" }); const byId = new Map(readSourceFiles(root).map((source) => [source.sourceId, source])); return ids.map((sourceId) => ({ sourceId, ...sourceEligibility(byId.get(sourceId), [], { root, missionId, missionGraph: workspace.missionGraph }) })); }
export function evaluateSourceReferences(root, references = [], missionId = null) { const workspace = openDoveWorkspace(root, { operation: "Source evaluation" }); const byRef = new Map(readSourceFiles(root).flatMap((source) => [source.sourceId, source.citationKey, source.locator].filter(Boolean).map((reference) => [reference, source]))); return references.map((reference) => ({ reference, ...sourceEligibility(byRef.get(reference), [], { root, missionId, missionGraph: workspace.missionGraph }) })); }
export function querySources(root, args = {}) {
  assertSealedDomainArgs(args, QUERY_FIELDS, "query_sources");
  const { workspace, mission } = readCurrentMission(root, args.missionId, "Source query");
  const sourceId = text(args.sourceId); const lifecycle = text(args.lifecycle).toLowerCase();
  if (lifecycle && !SOURCE_LIFECYCLE_STATES.includes(lifecycle)) throw new Error(`lifecycle must be one of: ${SOURCE_LIFECYCLE_STATES.join(", ")}.`);
  const limit = Math.min(200, Math.max(1, Number.isFinite(Number(args.limit)) ? Math.trunc(Number(args.limit)) : 50));
  const items = readSourceFiles(root).filter((source) => missionCanReadMission(workspace.missionGraph, mission.missionId, source.missionId)).filter((source) => !sourceId || [source.sourceId, source.citationKey, source.locator].includes(sourceId)).filter((source) => !lifecycle || source.lifecycle === lifecycle).slice(0, limit).map((source) => ({ ...source, eligibility: sourceEligibility(source, [], { root, missionId: mission.missionId, missionGraph: workspace.missionGraph }) }));
  return { status: items.length ? "ok" : "empty", missionId: mission.missionId, sourceCount: items.length, items, writes: [] };
}
export function readSourceTrustState(root) { return { sources: { version: SOURCE_SCHEMA_VERSION, items: readSourceFiles(root) } }; }
export function sourceReferenceMap(sources = []) { return new Map(sources.flatMap((source) => [source.sourceId, source.citationKey, source.locator].filter(Boolean).map((reference) => [reference, source]))); }
export function assertEligibleSourceReferences(root, references = [], label = "Evidence", missionId = null) { const failures = evaluateSourceReferences(root, references, missionId).filter((item) => !item.eligible); if (failures.length) throw new Error(`${label} cannot use unusable source references: ${failures.map((item) => `${item.reference} (${item.reason})`).join(", ")}.`); return true; }
