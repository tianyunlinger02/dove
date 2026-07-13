import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { inspectDeclaredPath } from "./artifact-integrity.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { nowIso, readJson, writeJson } from "./workspace.mjs";

export const SOURCE_LIFECYCLE_STATES = Object.freeze(["candidate", "verified", "rejected"]);

const TRUSTED_SOURCE_VERIFICATION_ISSUERS = new Map([
  ["dove-reviewer", "reviewer"],
  ["dove-system", "system"]
]);

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

function sourceDoi(source = {}) {
  return normalizeDoi(source.doi) || normalizeDoi(source.url) || normalizeDoi(source.locator);
}

function sourceUrl(source = {}) {
  return normalizeUrl(source.url) || normalizeUrl(source.locator);
}

export function canonicalSourceIdentity(source = {}) {
  return {
    doi: sourceDoi(source),
    url: sourceUrl(source),
    locator: normalizeIdentityText(source.locator),
    title: normalizeIdentityText(source.title),
    authors: (Array.isArray(source.authors) ? source.authors : [])
      .map(normalizeIdentityText)
      .filter(Boolean)
      .sort()
  };
}

export function sourceIdentityFingerprint(source = {}) {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalSourceIdentity(source))).digest("hex");
}

function verificationMaterialState(root, materialPath) {
  const normalizedPath = normalizeText(materialPath);
  if (!normalizedPath) return { valid: false, reason: "source-verification-material-missing" };
  const inspection = inspectDeclaredPath(root, normalizedPath, { requireNonEmpty: true });
  if (inspection.status !== "existing") {
    return { valid: false, reason: `source-verification-material-${inspection.status}` };
  }
  const canonicalPath = inspection.canonicalRelativePath ?? inspection.normalizedPath;
  const fullPath = path.resolve(root, canonicalPath);
  const materialHash = crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex");
  return { valid: true, materialPath: canonicalPath, materialHash };
}

function trustedVerificationProvenance(verification = {}) {
  const issuer = normalizeText(verification.issuer);
  const issuerRole = normalizeText(verification.issuerRole).toLowerCase();
  const expectedRole = TRUSTED_SOURCE_VERIFICATION_ISSUERS.get(issuer);
  if (!expectedRole || issuerRole !== expectedRole) return false;
  return normalizeText(verification.provenance) === "trusted-internal-transition";
}

export function readSourceTrustState(root) {
  const sources = readJson(root, ARTIFACT_PATHS.sources, { version: 2, items: [], updatedAt: null });
  const verifications = readJson(root, ARTIFACT_PATHS.sourceVerifications, { version: 1, items: [], updatedAt: null });
  return { sources, verifications };
}

export function sourceReferenceMap(sources = []) {
  return new Map(sources.flatMap((source) => [
    source.id ? [source.id, source] : null,
    source.citationKey ? [source.citationKey, source] : null,
    source.locator ? [source.locator, source] : null,
    source.url ? [source.url, source] : null,
    source.doi ? [source.doi, source] : null
  ].filter(Boolean)));
}

export function sourceEligibility(source, verifications = [], options = {}) {
  if (!source) return { eligible: false, reason: "unknown-source", source: null, verification: null };
  const verification = [...verifications].reverse().find((item) => item.sourceId === source.id) ?? null;
  if (!verification) return { eligible: false, reason: `source-${source.lifecycle ?? "candidate"}`, source, verification: null };
  if (verification.decision !== "verified") {
    return { eligible: false, reason: `source-${verification.decision ?? source.lifecycle ?? "candidate"}`, source, verification };
  }
  if (!trustedVerificationProvenance(verification)) {
    return { eligible: false, reason: "source-verification-untrusted-provenance", source, verification };
  }
  const fingerprint = sourceIdentityFingerprint(source);
  if (verification.fingerprint !== fingerprint) {
    return { eligible: false, reason: "source-identity-changed", source, verification };
  }
  const sourcePacketIds = new Set(Array.isArray(source.packetIds) ? source.packetIds : []);
  if (!verification.packetId || !sourcePacketIds.has(verification.packetId)) {
    return { eligible: false, reason: "source-packet-binding-mismatch", source, verification };
  }
  if (options.root) {
    const material = verificationMaterialState(options.root, verification.materialPath);
    if (!material.valid) {
      return { eligible: false, reason: material.reason, source, verification };
    }
    if (!verification.materialHash || verification.materialHash !== material.materialHash) {
      return { eligible: false, reason: "source-verification-material-changed", source, verification };
    }
  } else if (!verification.materialPath || !verification.materialHash) {
    return { eligible: false, reason: "source-verification-material-unavailable", source, verification };
  }
  return { eligible: true, reason: "verified-source", source, verification };
}

export function evaluateSourceReferences(root, references = []) {
  const { sources, verifications } = readSourceTrustState(root);
  const byReference = sourceReferenceMap(sources.items ?? []);
  return references.map((reference) => {
    const source = byReference.get(reference) ?? null;
    return { reference, ...sourceEligibility(source, verifications.items ?? [], { root }) };
  });
}

export function evaluateNoteReferences(root, references = [], packetId = null) {
  const notes = readJson(root, ARTIFACT_PATHS.notes, { version: 1, items: [], updatedAt: null });
  const { sources, verifications } = readSourceTrustState(root);
  const bySource = sourceReferenceMap(sources.items ?? []);
  const normalizedPacketId = normalizeText(packetId);
  return references.map((reference) => {
    const note = (notes.items ?? []).find((item) => item.id === reference) ?? null;
    if (!note) return { reference, eligible: false, reason: "unknown-note", note: null, sources: [] };
    if (!normalizedPacketId || !(note.packetIds ?? []).includes(normalizedPacketId)) {
      return { reference, eligible: false, reason: "note-packet-binding-mismatch", note, sources: [] };
    }
    const sourceIds = Array.isArray(note.sourceIds) ? note.sourceIds : [];
    if (sourceIds.length === 0) {
      return { reference, eligible: false, reason: "note-source-missing", note, sources: [] };
    }
    const sourceEvaluations = sourceIds.map((sourceId) => {
      const source = bySource.get(sourceId) ?? null;
      const eligibility = sourceEligibility(source, verifications.items ?? [], { root });
      if (eligibility.eligible && eligibility.verification?.packetId !== normalizedPacketId) {
        return { reference: sourceId, ...eligibility, eligible: false, reason: "source-verification-packet-mismatch" };
      }
      return { reference: sourceId, ...eligibility };
    });
    const failure = sourceEvaluations.find((item) => !item.eligible);
    return {
      reference,
      eligible: !failure,
      reason: failure ? failure.reason : "verified-note",
      note,
      sources: sourceEvaluations
    };
  });
}

export function querySources(root, args = {}) {
  const { sources, verifications } = readSourceTrustState(root);
  const sourceId = normalizeText(args.sourceId ?? args.id);
  const packetId = normalizeText(args.packetId ?? args.taskPacketId ?? args.missionPacketId);
  const lifecycle = normalizeText(args.lifecycle).toLowerCase();
  const limit = Math.min(200, Math.max(1, Number.isFinite(Number(args.limit)) ? Math.trunc(Number(args.limit)) : 50));
  const items = (sources.items ?? [])
    .filter((source) => !sourceId || [source.id, source.citationKey, source.locator, source.url, source.doi].includes(sourceId))
    .filter((source) => !packetId || (source.packetIds ?? []).includes(packetId))
    .map((source) => {
      const eligibility = sourceEligibility(source, verifications.items ?? [], { root });
      return {
        ...source,
        eligibility: {
          eligible: eligibility.eligible,
          reason: eligibility.reason,
          verificationId: eligibility.verification?.id ?? null,
          decision: eligibility.verification?.decision ?? null,
          packetId: eligibility.verification?.packetId ?? null,
          checkedAt: eligibility.verification?.checkedAt ?? null
        }
      };
    })
    .filter((source) => !lifecycle || source.eligibility.decision === lifecycle || source.lifecycle === lifecycle)
    .slice(0, limit);
  return {
    status: items.length > 0 ? "ok" : "empty",
    sourceCount: items.length,
    items,
    bookkeeping: [ARTIFACT_PATHS.sources, ARTIFACT_PATHS.sourceVerifications]
  };
}

export function assertEligibleSourceReferences(root, references = [], label = "Evidence") {
  const evaluations = evaluateSourceReferences(root, references);
  const failures = evaluations.filter((item) => !item.eligible);
  if (failures.length > 0) {
    throw new Error(`${label} requires verified sources with matching identity fingerprints: ${failures.map((item) => `${item.reference} (${item.reason})`).join(", ")}.`);
  }
  return evaluations;
}

function normalizedAuditEvidence(root, value) {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`verify_source auditEvidence[${index}] must be an object with reference, kind, and observation.`);
    }
    const keys = Object.keys(item);
    const unknown = keys.filter((key) => !["reference", "kind", "observation"].includes(key));
    if (unknown.length > 0) {
      throw new Error(`verify_source auditEvidence[${index}] does not accept unknown fields: ${unknown.join(", ")}.`);
    }
    const reference = normalizeText(item.reference);
    const kind = normalizeText(item.kind).toLowerCase();
    const observation = normalizeText(item.observation);
    if (!reference || !observation || !["source", "capture"].includes(kind)) {
      throw new Error(`verify_source auditEvidence[${index}] requires non-empty reference and observation, with kind source or capture.`);
    }
    if (kind === "source") {
      const validReference = /^https:\/\/[^\s]+$/iu.test(reference)
        || /^(?:doi:)?10\.\d{4,9}\/[^\s]+$/iu.test(reference)
        || /^arxiv:(?:\d{4}\.\d{4,5}|[a-z-]+\/\d{7})(?:v\d+)?$/iu.test(reference);
      if (!validReference) {
        throw new Error(`verify_source auditEvidence[${index}].reference must be HTTPS, DOI, or arXiv when kind is source.`);
      }
    } else {
      const inspection = inspectDeclaredPath(root, reference, { requireNonEmpty: true });
      if (inspection.status !== "existing") {
        throw new Error(`verify_source auditEvidence[${index}] capture must be a safe existing non-empty local file (${inspection.reason ?? inspection.status}).`);
      }
    }
    return { reference, kind, observation };
  });
}

function auditEvidenceMatchesSource(source, evidence) {
  const identity = canonicalSourceIdentity(source);
  const references = new Set([
    identity.url,
    identity.doi,
    identity.doi ? `doi:${identity.doi}` : "",
    identity.locator
  ].filter(Boolean));
  return evidence.some((item) => {
    if (item.kind !== "source") return false;
    const reference = normalizeIdentityText(item.reference);
    const referenceDoi = normalizeDoi(item.reference);
    const referenceUrl = normalizeUrl(item.reference);
    return references.has(reference) || (referenceDoi && referenceDoi === identity.doi) || (referenceUrl && referenceUrl === identity.url);
  });
}

export function prepareSourceVerification(root, source, args = {}, packetId = null) {
  const method = normalizeText(args.method);
  const checkedMaterial = normalizeText(args.checkedMaterial);
  const auditEvidence = normalizedAuditEvidence(root, args.auditEvidence);
  const decision = normalizeText(args.decision).toLowerCase();
  if (!source) throw new Error("verify_source references an unknown source.");
  if (!method) throw new Error("verify_source requires a verification method.");
  if (!checkedMaterial) throw new Error("verify_source requires checkedMaterial describing the material actually inspected.");
  if (auditEvidence.length === 0) throw new Error("verify_source requires at least one structured auditEvidence item.");
  if (!auditEvidenceMatchesSource(source, auditEvidence)) {
    throw new Error("verify_source requires at least one auditEvidence source reference matching the registered source identity.");
  }
  if (decision !== "rejected") {
    throw new Error("Public verify_source only records rejection. Positive verification requires a trusted internal Reviewer/system transition that is not exposed through this API.");
  }
  const normalizedPacketId = normalizeText(packetId);
  if (!normalizedPacketId || !(Array.isArray(source.packetIds) ? source.packetIds : []).includes(normalizedPacketId)) {
    throw new Error("verify_source requires the resolved packet to be bound to the registered source.");
  }
  const timestamp = nowIso();
  const record = {
    id: `source-verification-${source.id}-${Date.now().toString(36)}`,
    sourceId: source.id,
    packetId: normalizedPacketId,
    fingerprint: sourceIdentityFingerprint(source),
    decision,
    method,
    checkedMaterial,
    auditEvidence,
    checkedAt: timestamp
  };
  const index = readJson(root, ARTIFACT_PATHS.sourceVerifications, { version: 1, items: [], updatedAt: null });
  index.items.push(record);
  index.updatedAt = timestamp;
  return { record, index };
}
