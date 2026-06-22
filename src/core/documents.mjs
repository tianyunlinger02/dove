import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  DOVE_DOCUMENT_EVIDENCE_SCOPES,
  DOVE_DOCUMENT_KINDS,
  DOVE_DOCUMENT_STATUSES,
  createDocumentLedgerIndex,
  normalizeDocumentLedgerIndex
} from "./schema.mjs";
import { resolveDoveResponseLanguage } from "./i18n.mjs";
import { assertTaskScopedMutationTarget } from "./mutation-guard.mjs";
import { buildPreActionGuidance, summarizePreActionGuidance } from "./pre-action-guidance.mjs";
import { assertGovernanceMutationRegistered, appendText, ensureWorkspace, nowIso, readJson, resolvePath, writeJson, writeText } from "./workspace.mjs";

function slugify(value, fallback = "document") {
  return String(value ?? fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

function normalizeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStringArray(value) {
  const source = Array.isArray(value) ? value : (typeof value === "string" ? [value] : []);
  return Array.from(new Set(source.map((item) => String(item).trim()).filter(Boolean)));
}

function normalizeAllowed(value, allowed, fallback) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeRelativePath(value) {
  const text = normalizeString(value, null);
  if (!text) {
    return null;
  }
  const normalized = text.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.split("/").includes("..")) {
    return null;
  }
  return normalized;
}

function assertWritableDocumentPath(relativePath) {
  if (!relativePath || !relativePath.startsWith(`${ARTIFACT_PATHS.documentsDir}/`) || relativePath === ARTIFACT_PATHS.documentsLedger) {
    throw new Error(`Document writes must target ${ARTIFACT_PATHS.documentsDir}/ and cannot overwrite the ledger.`);
  }
}

function uniqueRelativePath(root, relativePath) {
  const parsed = path.posix.parse(relativePath);
  let candidate = relativePath;
  let suffix = 2;
  while (fs.existsSync(resolvePath(root, candidate))) {
    candidate = path.posix.join(parsed.dir, `${parsed.name}-${suffix}${parsed.ext || ".md"}`);
    suffix += 1;
  }
  return candidate;
}

function generatedDocumentPath(timestamp, documentKind, title) {
  const safeTime = timestamp.replace(/[:.]/g, "-");
  return path.posix.join(ARTIFACT_PATHS.documentsDir, documentKind, `${safeTime}-${slugify(title)}.md`);
}

function uniqueEntryId(entries, seed) {
  const existing = new Set(entries.map((entry) => entry.id));
  let candidate = slugify(seed, "document-entry");
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `${slugify(seed, "document-entry")}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function publicSafeFromArgs(args = {}) {
  return args.publicSafe === true || args.visibility === "public-safe";
}

function documentGuidanceSummary(root, args = {}, target = {}, entry = {}) {
  return summarizePreActionGuidance(buildPreActionGuidance({
    surface: "dove.documents",
    responseLanguage: resolveDoveResponseLanguage(root, args),
    request: args.title ?? args.documentTitle ?? args.summary ?? entry.title ?? null,
    roleId: "builder",
    subagentSpecialty: "researcher",
    packet: target.packet,
    currentContext: {
      domain: target.packet?.domain ?? null,
      stage: target.packet?.stage ?? "execute",
      primaryRole: "builder"
    },
    operatorLessons: readJson(root, ARTIFACT_PATHS.metaOperatorLessons, { lessons: [] }),
    nextAction: "project:dove.status",
    routeHint: "project:dove.status",
    workflowKind: "document-evidence",
    domain: target.packet?.domain ?? null,
    stage: target.packet?.stage ?? "execute",
    tags: ["document", "evidence", "provenance"],
    statusSummary: {
      documentId: entry.documentId ?? null,
      documentKind: entry.documentKind ?? null,
      evidenceScope: entry.evidenceScope ?? null,
      publicSafe: entry.publicSafe === true
    }
  }));
}

function buildResultCard({ entry, writes, createdDocument, appendedDocument, preActionGuidanceSummary }) {
  const evidence = [...entry.evidenceLinks, ...entry.artifactRefs, ...entry.sourceRefs];
  return {
    presentation: "compact-result-summary-card",
    surface: "dove.documents",
    command: "record_document_evidence",
    packetId: entry.packetId,
    title: entry.title,
    status: "recorded",
    happened: createdDocument ? "已新建归档文档并记录文档证据。" : appendedDocument ? "已追加归档文档并记录文档证据。" : "已记录文档证据索引，不覆盖原始文档。",
    durableWrites: writes,
    evidence: evidence.length > 0 ? evidence : ["未记录额外 evidence/artifact/source 指针。"],
    validation: ["本次只记录显式传入的文档/证据元数据，未声明额外验证结果。"],
    nextActions: ["project:dove.status"],
    proposalOnly: false,
    confirmationRequired: false,
    preActionGuidanceSummary
  };
}

function filteredEntries(entries, filters) {
  return entries.filter((entry) => {
    if (filters.packetId && entry.packetId !== filters.packetId) return false;
    if (filters.documentKind && entry.documentKind !== filters.documentKind) return false;
    if (filters.status && entry.status !== filters.status) return false;
    if (filters.evidenceScope && entry.evidenceScope !== filters.evidenceScope) return false;
    if (typeof filters.publicSafe === "boolean" && entry.publicSafe !== filters.publicSafe) return false;
    return true;
  });
}

export function queryDocumentLedger(root, args = {}) {
  const ledger = normalizeDocumentLedgerIndex(readJson(root, ARTIFACT_PATHS.documentsLedger, createDocumentLedgerIndex));
  const filters = {
    packetId: normalizeString(args.packetId ?? args.taskPacketId ?? args.missionPacketId ?? args.taskId, null),
    documentKind: args.documentKind ? normalizeAllowed(args.documentKind, DOVE_DOCUMENT_KINDS, null) : null,
    status: args.status ? normalizeAllowed(args.status, DOVE_DOCUMENT_STATUSES, null) : null,
    evidenceScope: args.evidenceScope ? normalizeAllowed(args.evidenceScope, DOVE_DOCUMENT_EVIDENCE_SCOPES, null) : null,
    publicSafe: typeof args.publicSafe === "boolean" ? args.publicSafe : null
  };
  const limit = Number.isFinite(Number(args.limit)) ? Math.max(1, Math.min(100, Math.floor(Number(args.limit)))) : 25;
  const entries = filteredEntries(ledger.entries, filters).slice(-limit);
  return {
    mode: "document-ledger-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    filters,
    summary: ledger.summary,
    entries,
    privacy: {
      documentBodiesIncluded: false,
      rawTranscriptIncluded: false,
      privateReasoningIncluded: false,
      environmentIncluded: false
    }
  };
}

export function recordDocumentEvidence(root, args = {}) {
  assertGovernanceMutationRegistered("record-document-evidence", "guarded");
  const target = assertTaskScopedMutationTarget(root, "record-document-evidence", args);
  ensureWorkspace(root);
  const timestamp = nowIso();
  const documentKind = normalizeAllowed(args.documentKind ?? args.kind, DOVE_DOCUMENT_KINDS, "other");
  const status = normalizeAllowed(args.status, DOVE_DOCUMENT_STATUSES, "created");
  const title = normalizeString(args.title ?? args.documentTitle ?? args.summary, "Document evidence");
  const body = normalizeString(args.body ?? args.content, "");
  let documentPath = normalizeRelativePath(args.documentPath ?? args.path);
  const writes = [ARTIFACT_PATHS.documentsLedger];
  let createdDocument = false;
  let appendedDocument = false;

  if (args.createDocument === true && args.appendDocument === true) {
    throw new Error("Choose either createDocument or appendDocument, not both.");
  }

  if (args.createDocument === true) {
    if (!body) {
      throw new Error("createDocument requires a non-empty body or content field.");
    }
    const requestedPath = normalizeRelativePath(args.documentPath ?? args.path);
    const basePath = requestedPath && requestedPath.startsWith(`${ARTIFACT_PATHS.documentsDir}/`) ? requestedPath : generatedDocumentPath(timestamp, documentKind, title);
    assertWritableDocumentPath(basePath);
    documentPath = uniqueRelativePath(root, basePath.endsWith(".md") ? basePath : `${basePath}.md`);
    writeText(root, documentPath, body.endsWith("\n") ? body : `${body}\n`);
    createdDocument = true;
    writes.push(documentPath);
  }

  if (args.appendDocument === true) {
    if (!body) {
      throw new Error("appendDocument requires a non-empty body or content field.");
    }
    documentPath = normalizeRelativePath(args.documentPath ?? args.path);
    assertWritableDocumentPath(documentPath);
    appendText(root, documentPath, body.startsWith("\n") ? body : `\n${body.endsWith("\n") ? body : `${body}\n`}`);
    appendedDocument = true;
    writes.push(documentPath);
  }

  const ledger = normalizeDocumentLedgerIndex(readJson(root, ARTIFACT_PATHS.documentsLedger, createDocumentLedgerIndex));
  const seed = args.id ?? args.documentId ?? documentPath ?? `${target.packetId}-${documentKind}-${title}`;
  const id = uniqueEntryId(ledger.entries, seed);
  const entry = {
    id,
    packetId: target.packetId,
    documentId: normalizeString(args.documentId, id),
    title,
    documentPath,
    documentKind,
    status,
    evidenceScope: normalizeAllowed(args.evidenceScope ?? args.scope, DOVE_DOCUMENT_EVIDENCE_SCOPES, "internal"),
    publicSafe: publicSafeFromArgs(args),
    summary: normalizeString(args.summary, ""),
    context: normalizeString(args.context ?? args.reason, ""),
    sourceRefs: normalizeStringArray(args.sourceRefs ?? args.sourceIds),
    artifactRefs: normalizeStringArray(args.artifactRefs ?? args.artifactPaths),
    evidenceLinks: normalizeStringArray(args.evidenceLinks ?? args.evidencePaths),
    claimIds: normalizeStringArray(args.claimIds ?? args.claims),
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: normalizeString(args.createdBy ?? args.actorRole, "operator"),
    appendOnly: true,
    rawTranscriptIncluded: false,
    privateReasoningIncluded: false,
    environmentIncluded: false
  };
  const nextLedger = normalizeDocumentLedgerIndex({
    ...ledger,
    entries: [...ledger.entries, entry],
    updatedAt: timestamp
  });
  writeJson(root, ARTIFACT_PATHS.documentsLedger, nextLedger);
  const preActionGuidanceSummary = documentGuidanceSummary(root, args, target, entry);
  return {
    mode: "document-evidence-record",
    status: "recorded",
    packetId: target.packetId,
    entry: nextLedger.entries.at(-1),
    ledger: {
      path: ARTIFACT_PATHS.documentsLedger,
      summary: nextLedger.summary
    },
    writes,
    createdDocument,
    appendedDocument,
    privacy: {
      rawTranscriptIncluded: false,
      privateReasoningIncluded: false,
      environmentIncluded: false,
      defaultEvidenceScope: "internal",
      publicProjectionDerivedOnly: true
    },
    preActionGuidanceSummary,
    resultCard: buildResultCard({ entry, writes, createdDocument, appendedDocument, preActionGuidanceSummary })
  };
}
