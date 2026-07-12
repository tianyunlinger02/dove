import crypto from "node:crypto";

import { ARTIFACT_PATHS } from "./schema.mjs";
import { nowIso, readJson, writeJson } from "./workspace.mjs";

export const SOURCE_LIFECYCLE_STATES = Object.freeze(["candidate", "verified", "rejected"]);

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

export function sourceEligibility(source, verifications = []) {
  if (!source) return { eligible: false, reason: "unknown-source", source: null, verification: null };
  if (source.lifecycle !== "verified") {
    return { eligible: false, reason: `source-${source.lifecycle ?? "candidate"}`, source, verification: null };
  }
  const fingerprint = sourceIdentityFingerprint(source);
  const verification = [...verifications].reverse().find((item) => item.sourceId === source.id && item.decision === "verified") ?? null;
  if (!verification) return { eligible: false, reason: "missing-source-verification", source, verification: null };
  if (verification.fingerprint !== fingerprint) {
    return { eligible: false, reason: "source-identity-changed", source, verification };
  }
  return { eligible: true, reason: "verified-source", source, verification };
}

export function evaluateSourceReferences(root, references = []) {
  const { sources, verifications } = readSourceTrustState(root);
  const byReference = sourceReferenceMap(sources.items ?? []);
  return references.map((reference) => {
    const source = byReference.get(reference) ?? null;
    return { reference, ...sourceEligibility(source, verifications.items ?? []) };
  });
}

export function assertEligibleSourceReferences(root, references = [], label = "Evidence") {
  const evaluations = evaluateSourceReferences(root, references);
  const failures = evaluations.filter((item) => !item.eligible);
  if (failures.length > 0) {
    throw new Error(`${label} requires verified sources with matching identity fingerprints: ${failures.map((item) => `${item.reference} (${item.reason})`).join(", ")}.`);
  }
  return evaluations;
}

export function prepareSourceVerification(root, source, args = {}) {
  const method = normalizeText(args.method);
  const checkedMaterial = normalizeText(args.checkedMaterial);
  const auditEvidence = Array.isArray(args.auditEvidence)
    ? Array.from(new Set(args.auditEvidence.map(normalizeText).filter(Boolean)))
    : [];
  const decision = normalizeText(args.decision).toLowerCase();
  if (!source) throw new Error("verify_source references an unknown source.");
  if (!method) throw new Error("verify_source requires a verification method.");
  if (!checkedMaterial) throw new Error("verify_source requires checkedMaterial describing the material actually inspected.");
  if (auditEvidence.length === 0) throw new Error("verify_source requires at least one auditable evidence reference.");
  if (!SOURCE_LIFECYCLE_STATES.slice(1).includes(decision)) {
    throw new Error("verify_source decision must be verified or rejected.");
  }
  const timestamp = nowIso();
  const record = {
    id: `source-verification-${source.id}-${Date.now().toString(36)}`,
    sourceId: source.id,
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
