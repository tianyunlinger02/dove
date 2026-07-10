import fs from "node:fs";
import path from "node:path";

const DEFAULT_READ_LIMIT_BYTES = 24 * 1024;

const BOOKKEEPING_EVIDENCE_PATHS = new Set([
  ".dove/state.json",
  ".dove/task-packets/index.json",
  ".dove/public/status.json",
  ".dove/public/status.md",
  ".dove/public/index.html",
  ".dove/documents/ledger.json",
  ".dove/workspace/index.json",
  ".dove/workspace/artifact-map.json",
  ".dove/evidence/index.json",
  ".dove/wiki/index.md",
  ".dove/wiki/navigation.md",
  ".dove/wiki/query_pack.md",
  ".dove/wiki/entities.json",
  ".dove/wiki/relations.json",
  ".dove/runtime/controller-state.json",
  ".dove/runtime/continuation.json",
  ".dove/runtime/leases.json",
  ".dove/runtime/events.json",
  ".dove/runtime/results.json",
  ".dove/sessions/journal.json",
  ".dove/sessions/LATEST_SUMMARY.md",
  ".dove/mutations/index.json"
]);

const BOOKKEEPING_EVIDENCE_PATTERNS = [
  /^\.dove\/task-packets\/packets\/[^/]+\.json$/u,
  /^\.dove\/context\/packets\/[^/]+\.json$/u,
  /^\.dove\/runtime\/[^/]+\.json$/u,
  /^\.dove\/public\//u
];

function normalizeStringArray(value) {
  const values = Array.isArray(value) ? value : (typeof value === "string" ? [value] : []);
  return Array.from(new Set(values.map((item) => String(item).trim()).filter(Boolean)));
}

export function isExternalArtifactReference(value) {
  const text = String(value ?? "").trim();
  return /^[a-z][a-z0-9+.-]*:\/\//iu.test(text)
    || /^(?:doi|urn|arxiv):/iu.test(text)
    || /^10\.\d{4,9}\//u.test(text);
}

export function normalizeProjectRelativePath(rawPath) {
  const original = typeof rawPath === "string" ? rawPath.trim() : String(rawPath ?? "").trim();
  if (!original) {
    return { ok: false, path: original, reason: "empty path" };
  }
  if (original.includes("\0")) {
    return { ok: false, path: original, reason: "path contains a null byte" };
  }
  if (path.isAbsolute(original) || /^[A-Za-z]:[\\/]/.test(original)) {
    return { ok: false, path: original, reason: "absolute paths are not inspected" };
  }
  const normalizedPath = path.posix.normalize(original.replace(/\\/g, "/"));
  if (normalizedPath === "." || normalizedPath === ".." || normalizedPath.startsWith("../")) {
    return { ok: false, path: original, normalizedPath, reason: "path escapes the project root" };
  }
  return { ok: true, path: original, normalizedPath };
}

function readBoundedText(fullPath, maxBytes = DEFAULT_READ_LIMIT_BYTES) {
  const descriptor = fs.openSync(fullPath, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const bytesRead = fs.readSync(descriptor, buffer, 0, maxBytes, 0);
    return {
      text: buffer.subarray(0, bytesRead).toString("utf8"),
      bytesRead
    };
  } finally {
    fs.closeSync(descriptor);
  }
}

export function isBookkeepingArtifactPath(relativePath) {
  const normalized = normalizeProjectRelativePath(relativePath);
  if (!normalized.ok) {
    return false;
  }
  const normalizedPath = normalized.normalizedPath;
  return BOOKKEEPING_EVIDENCE_PATHS.has(normalizedPath)
    || BOOKKEEPING_EVIDENCE_PATTERNS.some((pattern) => pattern.test(normalizedPath));
}

export function inspectDeclaredPath(root, rawPath, options = {}) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath ?? null,
      status: "unsafe",
      exists: false,
      file: false,
      reason: normalized.reason
    };
  }
  const rootPath = path.resolve(root);
  const fullPath = path.resolve(rootPath, normalized.normalizedPath);
  const relativeToRoot = path.relative(rootPath, fullPath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "unsafe",
      exists: false,
      file: false,
      reason: "resolved path escapes the project root"
    };
  }
  let stat;
  try {
    stat = fs.statSync(fullPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        path: normalized.path,
        normalizedPath: normalized.normalizedPath,
        status: "missing",
        exists: false,
        file: false,
        reason: "path does not exist"
      };
    }
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "unreadable",
      exists: false,
      file: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
  if (stat.isDirectory()) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "directory",
      exists: true,
      file: false,
      sizeBytes: stat.size,
      reason: "path is a directory"
    };
  }
  if (!stat.isFile()) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "unsupported",
      exists: true,
      file: false,
      sizeBytes: stat.size,
      reason: "path is not a regular file"
    };
  }
  const baseItem = {
    path: normalized.path,
    normalizedPath: normalized.normalizedPath,
    status: "existing",
    exists: true,
    file: true,
    sizeBytes: stat.size
  };
  const integrityStatus = options.rejectBookkeeping && isBookkeepingArtifactPath(normalized.normalizedPath)
    ? {
        ...baseItem,
        status: "bookkeeping",
        reason: "path is a navigation, status, runtime, task, or ledger record rather than substantive work evidence"
      }
    : options.requireNonEmpty && stat.size <= 0
      ? {
          ...baseItem,
          status: "empty",
          reason: "path is an empty file"
        }
      : baseItem;
  if (!options.readText || integrityStatus.status !== "existing") {
    return integrityStatus;
  }
  try {
    const read = readBoundedText(fullPath, options.maxBytes ?? DEFAULT_READ_LIMIT_BYTES);
    return {
      ...integrityStatus,
      text: read.text,
      bytesRead: read.bytesRead,
      truncated: stat.size > read.bytesRead
    };
  } catch (error) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "unreadable",
      exists: true,
      file: true,
      sizeBytes: stat.size,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

export function inspectProjectArtifact(root, rawPath, options = {}) {
  return inspectDeclaredPath(root, rawPath, options);
}

function publicPathInspection(item) {
  const { text, ...publicItem } = item;
  return publicItem;
}

export function summarizePathInspections(inspections) {
  const pathsWithStatus = (status) => inspections
    .filter((item) => item.status === status)
    .map((item) => item.normalizedPath ?? item.path)
    .filter(Boolean);
  const problemStatuses = new Set(["missing", "unsafe", "unreadable", "directory", "unsupported", "empty", "bookkeeping"]);
  return {
    declaredPaths: Array.from(new Set(inspections.map((item) => item.path).filter(Boolean))),
    inspectedPaths: Array.from(new Set(inspections.filter((item) => item.status !== "unsafe").map((item) => item.normalizedPath).filter(Boolean))),
    existingPaths: pathsWithStatus("existing"),
    missingPaths: pathsWithStatus("missing"),
    unsafePaths: pathsWithStatus("unsafe"),
    unreadablePaths: pathsWithStatus("unreadable"),
    directoryPaths: pathsWithStatus("directory"),
    unsupportedPaths: pathsWithStatus("unsupported"),
    emptyPaths: pathsWithStatus("empty"),
    bookkeepingPaths: pathsWithStatus("bookkeeping"),
    satisfied: inspections.some((item) => item.status === "existing"),
    problemCount: inspections.filter((item) => problemStatuses.has(item.status)).length,
    items: inspections.map(publicPathInspection)
  };
}

export function inspectPathEvidence(root, paths, options = {}) {
  return summarizePathInspections(normalizeStringArray(paths).map((item) => inspectDeclaredPath(root, item, options)));
}

export function evidencePathProblemFlags(root, paths, options = {}) {
  const evidencePaths = normalizeStringArray(paths);
  const localEvidencePaths = evidencePaths.filter((item) => !isExternalArtifactReference(item));
  const externalEvidenceRefs = evidencePaths.filter(isExternalArtifactReference);
  const pathEvidence = inspectPathEvidence(root, localEvidencePaths, {
    requireNonEmpty: true,
    rejectBookkeeping: true,
    ...options
  });
  const flags = [];
  if (evidencePaths.length === 0) {
    flags.push("missing-evidence-links");
  } else if (localEvidencePaths.length === 0) {
    flags.push("missing-evidence-file");
  }
  if (pathEvidence.missingPaths.length > 0) flags.push("missing-evidence-file");
  if (pathEvidence.unsafePaths.length > 0) flags.push("unsafe-evidence-path");
  if (pathEvidence.unreadablePaths.length > 0) flags.push("unreadable-evidence-file");
  if (pathEvidence.directoryPaths.length > 0) flags.push("directory-evidence-file");
  if (pathEvidence.unsupportedPaths.length > 0) flags.push("unsupported-evidence-file");
  if (pathEvidence.emptyPaths.length > 0) flags.push("empty-evidence-file");
  if (pathEvidence.bookkeepingPaths.length > 0) flags.push("bookkeeping-evidence-file");
  return {
    evidencePaths,
    localEvidencePaths,
    externalEvidenceRefs,
    pathEvidence,
    flags: Array.from(new Set(flags)),
    satisfied: pathEvidence.satisfied && pathEvidence.problemCount === 0
  };
}

export function pathProblems(summary) {
  return [
    ...summary.missingPaths,
    ...summary.unsafePaths,
    ...summary.unreadablePaths,
    ...summary.directoryPaths,
    ...summary.unsupportedPaths,
    ...summary.emptyPaths,
    ...summary.bookkeepingPaths
  ];
}

function criteriaEvidenceIntegrity(root, verifiedCriteria, options = {}) {
  const criteria = Array.isArray(verifiedCriteria) ? verifiedCriteria : [];
  return criteria.map((criterion) => {
    const evidencePaths = normalizeStringArray(criterion?.evidencePaths);
    const localEvidencePaths = evidencePaths.filter((item) => !isExternalArtifactReference(item));
    const externalEvidenceRefs = evidencePaths.filter(isExternalArtifactReference);
    const pathEvidence = inspectPathEvidence(root, localEvidencePaths, options);
    return {
      criterion: criterion?.criterion ?? null,
      status: criterion?.status ?? null,
      evidencePaths,
      localEvidencePaths,
      externalEvidenceRefs,
      pathEvidence,
      satisfied: pathEvidence.satisfied,
      problemPaths: pathProblems(pathEvidence)
    };
  });
}

export function completionEvidenceIntegrity(root, evidence = {}, options = {}) {
  const inspectOptions = {
    requireNonEmpty: true,
    rejectBookkeeping: true,
    ...(options.inspectOptions ?? {})
  };
  const evidencePaths = normalizeStringArray(evidence.evidencePaths);
  const localEvidencePaths = evidencePaths.filter((item) => !isExternalArtifactReference(item));
  const externalEvidenceRefs = evidencePaths.filter(isExternalArtifactReference);
  const pathEvidence = inspectPathEvidence(root, localEvidencePaths, inspectOptions);
  const criteria = criteriaEvidenceIntegrity(root, Array.isArray(evidence.verifiedCriteria) ? evidence.verifiedCriteria : [], inspectOptions);
  const missingCriteriaEvidence = criteria.filter((item) => !item.satisfied);
  const problemPaths = pathProblems(pathEvidence);
  return {
    declaredPaths: evidencePaths,
    localEvidencePaths,
    externalEvidenceRefs,
    pathEvidence,
    existingEvidencePaths: pathEvidence.existingPaths,
    substantiveEvidencePaths: pathEvidence.existingPaths,
    problemPaths,
    criteria,
    missingCriteriaEvidence,
    satisfied: pathEvidence.satisfied && missingCriteriaEvidence.length === 0 && problemPaths.length === 0,
    hasSubstantiveEvidence: pathEvidence.satisfied
  };
}
