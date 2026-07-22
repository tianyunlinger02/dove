import fs from "node:fs";
import path from "node:path";

import { inspectDeclaredPath } from "./artifact-integrity.mjs";
import { snapshotArtifactBuffer } from "./review-artifact-snapshot.mjs";
import {
  assertSealedDomainArgs,
  canonicalDomainPath,
  domainJson,
  domainNonEmptyText,
  domainSafeId,
  domainSha256,
  domainStringArray,
  finalizeDomainArtifacts,
  readCurrentMission
} from "./domain-artifacts.mjs";
import { readJson } from "./workspace.mjs";
import { openDoveWorkspace } from "./workspace-schema.mjs";

export const SOURCE_LIFECYCLE_STATES = Object.freeze(["candidate", "rejected"]);

const SOURCE_FIELDS = new Set([
  "schemaVersion", "sourceId", "missionId", "contractDigest", "citationKey", "title", "authors", "year", "locator", "sourceType",
  "abstract", "origin", "identityFingerprint", "capturedMaterial", "lifecycle", "currentDecision"
]);
const CAPTURED_MATERIAL_FIELDS = new Set(["path", "sizeBytes", "sha256"]);
const CANDIDATE_DECISION_FIELDS = new Set(["decision", "decidedAt", "reason"]);
const REJECTED_DECISION_FIELDS = new Set(["decision", "method", "checkedMaterial", "auditEvidence", "decidedAt"]);
const AUDIT_EVIDENCE_FIELDS = new Set(["reference", "kind", "observation"]);
const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const NOTE_FIELDS = new Set(["schemaVersion", "noteId", "missionId", "contractDigest", "title", "summary", "quotes", "claims", "openQuestions", "sourceIds", "artifactRefs", "updatedAt"]);

const REGISTER_FIELDS = new Set(["missionId", "sourceId", "citationKey", "title", "authors", "year", "locator", "sourceType", "abstract", "origin", "capturePath"]);
const REJECT_FIELDS = new Set(["missionId", "sourceId", "method", "checkedMaterial", "auditEvidence"]);
const QUERY_FIELDS = new Set(["missionId", "sourceId", "lifecycle", "limit"]);

function normalizeText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "";
}

function normalizeIdentityText(value) {
  return normalizeText(value).normalize("NFKC").toLowerCase();
}

function normalizeDoi(value) {
  const text = normalizeIdentityText(value).replace(/^https?:\/\/(?:dx\.)?doi\.org\//u, "");
  return text.startsWith("10.") ? text : "";
}

function normalizeUrl(value) {
  const text = normalizeText(value);
  if (!text) return "";
  try {
    const parsed = new URL(text);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    if ((parsed.protocol === "https:" && parsed.port === "443") || (parsed.protocol === "http:" && parsed.port === "80")) parsed.port = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function canonicalSourceIdentity(source = {}) {
  return {
    doi: normalizeDoi(source.doi) || normalizeDoi(source.locator),
    url: normalizeUrl(source.url) || normalizeUrl(source.locator),
    locator: normalizeIdentityText(source.locator),
    title: normalizeIdentityText(source.title),
    authors: (Array.isArray(source.authors) ? source.authors : []).map(normalizeIdentityText).filter(Boolean).sort()
  };
}

export function sourceIdentityFingerprint(source = {}) {
  return domainSha256(JSON.stringify(canonicalSourceIdentity(source)));
}

function sourcePath(sourceId) {
  return path.posix.join(".dove/sources", `${sourceId}.json`);
}

function notePath(noteId) {
  return path.posix.join(".dove/notes", `${noteId}.json`);
}

function assertSealed(value, fields, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}

function exactTimestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return value;
}

function validateStoredSource(root, source, filename, missions, label) {
  assertSealed(source, SOURCE_FIELDS, label);
  if (source.schemaVersion !== 1) throw new Error(`${label} has an unsupported schemaVersion.`);
  const sourceId = domainSafeId(source.sourceId, `${label}.sourceId`);
  if (filename !== `${sourceId}.json`) throw new Error(`${label} filename must match sourceId ${sourceId}.`);
  const missionId = domainSafeId(source.missionId, `${label}.missionId`);
  const mission = missions.get(missionId);
  if (!mission) throw new Error(`${label} references unknown mission ${missionId}.`);
  if (!HASH_PATTERN.test(String(source.contractDigest ?? "")) || source.contractDigest !== mission.contractDigest) throw new Error(`${label}.contractDigest does not match mission ${missionId}.`);
  if (!SOURCE_LIFECYCLE_STATES.includes(source.lifecycle)) throw new Error(`${label}.lifecycle must be candidate or rejected; stored verified source state is invalid.`);
  if (source.identityFingerprint !== sourceIdentityFingerprint(source)) throw new Error(`${label}.identityFingerprint does not match current source identity.`);
  if (!source.title && !source.locator) throw new Error(`${label} requires a title or locator.`);
  if (!Array.isArray(source.authors) || source.authors.some((item) => typeof item !== "string" || !item.trim()) || new Set(source.authors).size !== source.authors.length) throw new Error(`${label}.authors must be a unique string array.`);
  if (!source.capturedMaterial) throw new Error(`${label}.capturedMaterial is required.`);
  assertSealed(source.capturedMaterial, CAPTURED_MATERIAL_FIELDS, `${label}.capturedMaterial`);
  const materialPath = canonicalDomainPath(source.capturedMaterial.path, `${label}.capturedMaterial.path`, ".dove/sources/materials");
  if (!HASH_PATTERN.test(String(source.capturedMaterial.sha256 ?? ""))) throw new Error(`${label}.capturedMaterial.sha256 must be a lowercase SHA-256 hash.`);
  if (!Number.isSafeInteger(source.capturedMaterial.sizeBytes) || source.capturedMaterial.sizeBytes <= 0) throw new Error(`${label}.capturedMaterial.sizeBytes must be a positive safe integer.`);
  const material = capturedMaterial(root, materialPath, { includeContent: true });
  if (!material || material.path !== materialPath || material.sizeBytes !== source.capturedMaterial.sizeBytes || material.sha256 !== source.capturedMaterial.sha256) throw new Error(`${label}.capturedMaterial is missing, aliased, empty, size-drifted, or hash-drifted.`);
  const expectedDecisionFields = source.lifecycle === "candidate" ? CANDIDATE_DECISION_FIELDS : REJECTED_DECISION_FIELDS;
  assertSealed(source.currentDecision, expectedDecisionFields, `${label}.currentDecision`);
  if (source.currentDecision.decision !== source.lifecycle) throw new Error(`${label}.currentDecision.decision must match lifecycle ${source.lifecycle}.`);
  exactTimestamp(source.currentDecision.decidedAt, `${label}.currentDecision.decidedAt`);
  if (source.lifecycle === "candidate") {
    domainNonEmptyText(source.currentDecision.reason, `${label}.currentDecision.reason`);
  } else {
    domainNonEmptyText(source.currentDecision.method, `${label}.currentDecision.method`);
    domainNonEmptyText(source.currentDecision.checkedMaterial, `${label}.currentDecision.checkedMaterial`);
    if (!Array.isArray(source.currentDecision.auditEvidence) || source.currentDecision.auditEvidence.length === 0) throw new Error(`${label}.currentDecision.auditEvidence must contain at least one item.`);
    source.currentDecision.auditEvidence.forEach((item, index) => {
      assertSealed(item, AUDIT_EVIDENCE_FIELDS, `${label}.currentDecision.auditEvidence[${index}]`);
      for (const field of AUDIT_EVIDENCE_FIELDS) domainNonEmptyText(item[field], `${label}.currentDecision.auditEvidence[${index}].${field}`);
    });
  }
  return source;
}

function readSourceFiles(root) {
  const workspace = openDoveWorkspace(root, { operation: "Source query" });
  const directory = path.resolve(root, ".dove/sources");
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.name !== "materials")
    .map((entry) => {
      const relativePath = path.posix.join(".dove/sources", entry.name);
      if (entry.isSymbolicLink()) throw new Error(`${relativePath} must not be a symbolic link.`);
      if (!entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`${relativePath} must be a regular JSON source file.`);
      return validateStoredSource(root, readJson(root, relativePath, null), entry.name, workspace.missions, relativePath);
    })
    .sort((left, right) => String(left.sourceId).localeCompare(String(right.sourceId)));
}

function capturedMaterial(root, capturePath, options = {}) {
  if (!capturePath) return null;
  const canonicalPath = canonicalDomainPath(capturePath, "capturePath");
  const snapshot = snapshotArtifactBuffer(root, canonicalPath, "capturePath");
  return options.includeContent === true ? snapshot : { path: snapshot.path, sha256: snapshot.sha256 };
}

function sourceRecord(args, capturedMaterial, contractDigest, current = null) {
  const missionId = domainSafeId(args.missionId, "missionId");
  const sourceId = domainSafeId(args.sourceId, "sourceId");
  const title = normalizeText(args.title);
  const locator = normalizeText(args.locator);
  if (!title && !locator) throw new Error("register_source requires a real title or locator.");
  const authors = domainStringArray(args.authors, "authors");
  const identityFields = { title, authors, locator };
  const fingerprint = sourceIdentityFingerprint(identityFields);
  return {
    schemaVersion: 1,
    sourceId,
    missionId,
    contractDigest,
    citationKey: normalizeText(args.citationKey) || null,
    title: title || null,
    authors,
    year: args.year === undefined || args.year === null || String(args.year).trim() === "" ? null : String(args.year).trim(),
    locator: locator || null,
    sourceType: normalizeText(args.sourceType) || null,
    abstract: normalizeText(args.abstract) || null,
    origin: normalizeText(args.origin) || null,
    identityFingerprint: fingerprint,
    capturedMaterial,
    lifecycle: "candidate",
    currentDecision: {
      decision: "candidate",
      decidedAt: new Date().toISOString(),
      reason: current ? "source-registration-refreshed" : "source-registered"
    }
  };
}

export function registerSource(root, args = {}) {
  assertSealedDomainArgs(args, REGISTER_FIELDS, "register_source");
  const { mission } = readCurrentMission(root, args.missionId, "Source registration");
  readSourceFiles(root);
  const sourceId = domainSafeId(args.sourceId, "sourceId");
  const relativePath = sourcePath(sourceId);
  const existing = fs.existsSync(path.resolve(root, relativePath)) ? readJson(root, relativePath, null) : null;
  if (existing && existing.missionId !== mission.missionId) throw new Error(`Source ${args.sourceId} belongs to mission ${existing.missionId}.`);
  const captured = capturedMaterial(root, args.capturePath, { includeContent: true });
  if (!captured) throw new Error("register_source requires capturePath for concrete non-empty captured material.");
  const materialPath = path.posix.join(".dove/sources/materials", `${sourceId}${path.extname(captured.path).toLowerCase() || ".bin"}`);
  const sourceMaterial = { path: materialPath, sizeBytes: captured.sizeBytes, sha256: captured.sha256 };
  const source = sourceRecord(args, sourceMaterial, mission.contractDigest, existing);
  const writes = [{ path: relativePath, kind: "data", content: domainJson(source), derivedReferences: [`artifact:${source.capturedMaterial.path}`] }];
  writes.unshift({ path: materialPath, kind: "document", content: captured.content, derivedReferences: [] });
  return {
    ...finalizeDomainArtifacts(root, {
      actionId: "register-source",
      operation: "Source registration",
      missionId: mission.missionId,
      summary: `Registered source candidate ${source.sourceId}.`,
      completionEligible: false,
      writes
    }),
    source
  };
}

function normalizeAuditEvidence(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("verify_source requires at least one auditEvidence item.");
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`auditEvidence[${index}] must be an object.`);
    const unknown = Object.keys(item).filter((field) => !["reference", "kind", "observation"].includes(field));
    if (unknown.length) throw new Error(`auditEvidence[${index}] does not accept unknown fields: ${unknown.join(", ")}.`);
    return {
      reference: domainNonEmptyText(item.reference, `auditEvidence[${index}].reference`),
      kind: domainNonEmptyText(item.kind, `auditEvidence[${index}].kind`),
      observation: domainNonEmptyText(item.observation, `auditEvidence[${index}].observation`)
    };
  });
}

export function verifySource(root, args = {}) {
  assertSealedDomainArgs(args, REJECT_FIELDS, "verify_source");
  const { mission } = readCurrentMission(root, args.missionId, "Source rejection");
  readSourceFiles(root);
  const sourceId = domainSafeId(args.sourceId, "sourceId");
  const relativePath = sourcePath(sourceId);
  const source = readJson(root, relativePath, null);
  if (!source) throw new Error(`Unknown source: ${sourceId}.`);
  if (source.missionId !== mission.missionId) throw new Error(`Source ${sourceId} belongs to mission ${source.missionId}.`);
  const next = {
    ...source,
    lifecycle: "rejected",
    currentDecision: {
      decision: "rejected",
      method: domainNonEmptyText(args.method, "method"),
      checkedMaterial: domainNonEmptyText(args.checkedMaterial, "checkedMaterial"),
      auditEvidence: normalizeAuditEvidence(args.auditEvidence),
      decidedAt: new Date().toISOString()
    }
  };
  return {
    ...finalizeDomainArtifacts(root, {
      actionId: "verify-source",
      operation: "Source rejection",
      missionId: mission.missionId,
      summary: `Rejected source ${sourceId}.`,
      completionEligible: false,
      writes: [{ path: relativePath, kind: "data", content: domainJson(next), derivedReferences: [] }]
    }),
    source: next
  };
}

export function recordTrustedSourceVerification() {
  throw new Error("Trusted positive source verification is unavailable until a private verifier capability can issue current material- and fingerprint-bound authority.");
}

export function sourceEligibility(source, _verifications = [], options = {}) {
  if (!source) return { eligible: false, reason: "unknown-source", source: null, verification: null };
  const missionId = normalizeText(options.missionId);
  if (!missionId || source.missionId !== missionId) return { eligible: false, reason: "source-mission-binding-mismatch", source, verification: source.currentDecision ?? null };
  if (!SOURCE_LIFECYCLE_STATES.includes(source.lifecycle) || source.currentDecision?.decision !== source.lifecycle) return { eligible: false, reason: "source-durable-state-invalid", source, verification: source.currentDecision ?? null };
  if (source.identityFingerprint !== sourceIdentityFingerprint(source)) return { eligible: false, reason: "source-identity-changed", source, verification: source.currentDecision ?? null };
  if (!source.capturedMaterial) return { eligible: false, reason: "source-captured-material-missing", source, verification: source.currentDecision ?? null };
  try {
    const material = capturedMaterial(options.root, source.capturedMaterial.path, { includeContent: true });
    if (!material || material.sha256 !== source.capturedMaterial.sha256 || material.sizeBytes !== source.capturedMaterial.sizeBytes) return { eligible: false, reason: "source-captured-material-changed", source, verification: source.currentDecision ?? null };
  } catch {
    return { eligible: false, reason: "source-captured-material-invalid", source, verification: source.currentDecision ?? null };
  }
  return { eligible: false, reason: `source-${source.lifecycle}`, source, verification: source.currentDecision ?? null };
}

export function evaluateSourceIds(root, sourceIds = [], missionId = null) {
  const byId = new Map(readSourceFiles(root).map((source) => [source.sourceId, source]));
  return sourceIds.map((sourceId) => ({ sourceId, ...sourceEligibility(byId.get(sourceId) ?? null, [], { root, missionId }) }));
}

export function evaluateSourceReferences(root, references = [], missionId = null) {
  const sources = readSourceFiles(root);
  const byReference = new Map(sources.flatMap((source) => [source.sourceId, source.citationKey, source.locator].filter(Boolean).map((reference) => [reference, source])));
  return references.map((reference) => ({ reference, ...sourceEligibility(byReference.get(reference) ?? null, [], { root, missionId }) }));
}

export function evaluateNoteReferences(root, references = [], missionId = null) {
  const workspace = openDoveWorkspace(root, { operation: "Note evidence receipt ledger read" });
  const owned = new Map(workspace.receiptLedger.currentOwnership.map((item) => [item.path, item]));
  const receiptById = new Map(workspace.receiptLedger.receipts.map((item) => [item.receiptId, item]));
  return references.map((reference) => {
    let noteId;
    try {
      noteId = domainSafeId(reference, "note reference");
    } catch {
      return { reference, eligible: false, reason: "note-reference-invalid", note: null, owner: null, sources: [], artifacts: [] };
    }
    const relativePath = notePath(noteId);
    const owner = owned.get(relativePath) ?? null;
    if (!owner) return { reference, eligible: false, reason: "note-ownership-missing", note: null, owner: null, sources: [], artifacts: [] };
    if (!missionId || owner.missionId !== missionId) return { reference, eligible: false, reason: "note-owner-mission-mismatch", note: null, owner, sources: [], artifacts: [] };
    let snapshot;
    try {
      snapshot = snapshotArtifactBuffer(root, relativePath, `note ${noteId}`);
    } catch {
      return { reference, eligible: false, reason: "note-path-invalid", note: null, owner, sources: [], artifacts: [] };
    }
    if (snapshot.sha256 !== owner.sha256) return { reference, eligible: false, reason: "note-hash-drift", note: null, owner, sources: [], artifacts: [] };
    let note;
    try {
      note = JSON.parse(snapshot.content.toString("utf8"));
      assertSealed(note, NOTE_FIELDS, `note ${noteId}`);
    } catch {
      return { reference, eligible: false, reason: "note-schema-invalid", note: null, owner, sources: [], artifacts: [] };
    }
    const ownerReceipt = receiptById.get(owner.receiptId);
    if (note.schemaVersion !== 2 || note.noteId !== noteId || note.missionId !== missionId || note.contractDigest !== owner.contractDigest || ownerReceipt?.contractDigest !== note.contractDigest) {
      return { reference, eligible: false, reason: "note-binding-invalid", note, owner, sources: [], artifacts: [] };
    }
    exactTimestamp(note.updatedAt, `note ${noteId}.updatedAt`);
    const sourceIds = Array.isArray(note.sourceIds) ? note.sourceIds : [];
    const artifactRefs = Array.isArray(note.artifactRefs) ? note.artifactRefs : [];
    if (sourceIds.length === 0 && artifactRefs.length === 0) return { reference, eligible: false, reason: "note-evidence-missing", note, owner, sources: [], artifacts: [] };
    const sources = evaluateSourceReferences(root, sourceIds, missionId);
    const sourceFailure = sources.find((item) => !item.eligible);
    const artifacts = artifactRefs.map((artifactPath) => {
      const artifactOwner = owned.get(artifactPath);
      if (!artifactOwner) return { path: artifactPath, current: false, reason: "artifact-ownership-missing" };
      if (artifactOwner.missionId !== missionId) return { path: artifactPath, current: false, reason: "artifact-mission-binding-mismatch" };
      try {
        const artifactSnapshot = snapshotArtifactBuffer(root, artifactPath, `note ${noteId} artifact`);
        return { path: artifactPath, current: artifactSnapshot.sha256 === artifactOwner.sha256, reason: artifactSnapshot.sha256 === artifactOwner.sha256 ? "current-artifact" : "artifact-hash-drift" };
      } catch (error) {
        return { path: artifactPath, current: false, reason: error instanceof Error ? error.message : "artifact-path-invalid" };
      }
    });
    const artifactFailure = artifacts.find((item) => !item.current);
    const failure = sourceFailure?.reason ?? artifactFailure?.reason ?? null;
    return { reference, eligible: !failure, reason: failure ?? "verified-note", note, owner, sources, artifacts };
  });
}

export function querySources(root, args = {}) {
  assertSealedDomainArgs(args, QUERY_FIELDS, "query_sources");
  const { mission } = readCurrentMission(root, args.missionId, "Source query");
  const sourceId = normalizeText(args.sourceId);
  const lifecycle = normalizeText(args.lifecycle).toLowerCase();
  if (lifecycle && !SOURCE_LIFECYCLE_STATES.includes(lifecycle)) throw new Error(`lifecycle must be one of: ${SOURCE_LIFECYCLE_STATES.join(", ")}.`);
  const limit = Math.min(200, Math.max(1, Number.isFinite(Number(args.limit)) ? Math.trunc(Number(args.limit)) : 50));
  const items = readSourceFiles(root)
    .filter((source) => source.missionId === mission.missionId)
    .filter((source) => !sourceId || [source.sourceId, source.citationKey, source.locator].includes(sourceId))
    .filter((source) => !lifecycle || source.lifecycle === lifecycle)
    .slice(0, limit)
    .map((source) => {
      const eligibility = sourceEligibility(source, [], { root, missionId: mission.missionId });
      return { ...source, eligibility: { eligible: eligibility.eligible, reason: eligibility.reason } };
    });
  return { status: items.length ? "ok" : "empty", missionId: mission.missionId, sourceCount: items.length, items, writes: [] };
}

export function readSourceTrustState(root) {
  return { sources: { version: 1, items: readSourceFiles(root) }, verifications: { version: 1, items: [] } };
}

export function sourceReferenceMap(sources = []) {
  return new Map(sources.flatMap((source) => [source.sourceId ?? source.id, source.citationKey, source.locator].filter(Boolean).map((reference) => [reference, source])));
}

export function assertEligibleSourceReferences(root, references = [], label = "Evidence", missionId = null) {
  const failures = evaluateSourceReferences(root, references, missionId).filter((item) => !item.eligible);
  if (failures.length) throw new Error(`${label} cannot use source references until a trusted positive verifier exists: ${failures.map((item) => `${item.reference} (${item.reason})`).join(", ")}.`);
  return true;
}
