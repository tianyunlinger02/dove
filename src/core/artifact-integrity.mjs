import fs from "node:fs";
import path from "node:path";

import { ARTIFACT_PATHS } from "./schema.mjs";
import { currentMutationContext } from "./mutation-backend.mjs";

const BOOKKEEPING_PREFIXES = Object.freeze([
  `${ARTIFACT_PATHS.missionsDir}/`,
  `${ARTIFACT_PATHS.researchDecisionsDir}/`,
  `${ARTIFACT_PATHS.receiptsDir}/`
]);
const BOOKKEEPING_FILES = new Set([ARTIFACT_PATHS.doveRootManifest, ARTIFACT_PATHS.projectIdentity, ARTIFACT_PATHS.lessonsDocument]);
const DOMAIN_PREFIXES = Object.freeze([
  ARTIFACT_PATHS.sourcesDir,
  ARTIFACT_PATHS.claimsDir,
  ARTIFACT_PATHS.experimentsDir,
  ARTIFACT_PATHS.reviewsDir
]);

export function normalizeProjectRelativePath(rawPath) {
  const original = typeof rawPath === "string" ? rawPath.trim() : String(rawPath ?? "").trim();
  if (!original) return { ok: false, path: original, reason: "empty path" };
  if (original.includes("\0")) return { ok: false, path: original, reason: "path contains a null byte" };
  if (path.isAbsolute(original) || /^[A-Za-z]:[\\/]/u.test(original)) {
    return { ok: false, path: original, reason: "absolute paths are not inspected" };
  }
  if (/^[a-z][a-z0-9+.-]*:/iu.test(original)) {
    return { ok: false, path: original, reason: "unsupported or malformed external reference scheme" };
  }
  const normalizedPath = path.posix.normalize(original.replace(/\\/gu, "/"));
  if (normalizedPath === "." || normalizedPath === ".." || normalizedPath.startsWith("../")) {
    return { ok: false, path: original, normalizedPath, reason: "path escapes the project root" };
  }
  return { ok: true, path: original, normalizedPath };
}

export function artifactEvidenceRole(relativePath) {
  const normalized = normalizeProjectRelativePath(relativePath);
  if (!normalized.ok) return "unsupported";
  const value = normalized.normalizedPath;
  if (!value.startsWith(`${ARTIFACT_PATHS.doveRoot}/`)) return "external-project";
  if (BOOKKEEPING_FILES.has(value) || BOOKKEEPING_PREFIXES.some((prefix) => value.startsWith(prefix))) return "bookkeeping";
  if (DOMAIN_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}/`))) return "substantive";
  return "unsupported";
}

export function isBookkeepingArtifactPath(relativePath) {
  return artifactEvidenceRole(relativePath) === "bookkeeping";
}

export function inspectDeclaredPath(root, rawPath, options = {}) {
  const normalized = normalizeProjectRelativePath(rawPath);
  const mutationContext = currentMutationContext(root);
  if (!normalized.ok) {
    return { path: normalized.path, normalizedPath: normalized.normalizedPath ?? null, status: "unsafe", exists: false, file: false, reason: normalized.reason };
  }
  const rootPath = path.resolve(root);
  const fullPath = path.resolve(rootPath, normalized.normalizedPath);
  const relativeToRoot = path.relative(rootPath, fullPath);
  if (relativeToRoot === ".." || relativeToRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToRoot)) {
    return { path: normalized.path, normalizedPath: normalized.normalizedPath, status: "unsafe", exists: false, file: false, reason: "resolved path escapes the project root" };
  }
  let realRootPath;
  let realFullPath;
  let canonicalRelativePath;
  let stat;
  try {
    if (mutationContext) {
      const snapshot = mutationContext.readFileSnapshot(normalized.normalizedPath);
      if (!snapshot.exists) return { path: normalized.path, normalizedPath: normalized.normalizedPath, status: "missing", exists: false, file: false, reason: "path does not exist" };
    }
    realRootPath = fs.realpathSync.native(rootPath);
    realFullPath = fs.realpathSync.native(fullPath);
    const relativeToRealRoot = path.relative(realRootPath, realFullPath);
    if (relativeToRealRoot === ".." || relativeToRealRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToRealRoot)) {
      return { path: normalized.path, normalizedPath: normalized.normalizedPath, status: "unsafe", exists: true, file: false, reason: "real path escapes the project root" };
    }
    canonicalRelativePath = relativeToRealRoot.split(path.sep).join("/");
    stat = fs.statSync(realFullPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { path: normalized.path, normalizedPath: normalized.normalizedPath, status: "missing", exists: false, file: false, reason: "path does not exist" };
    }
    return { path: normalized.path, normalizedPath: normalized.normalizedPath, status: "unreadable", exists: false, file: false, reason: error instanceof Error ? error.message : String(error) };
  }
  if (stat.isDirectory()) {
    return { path: normalized.path, normalizedPath: normalized.normalizedPath, canonicalRelativePath, status: "directory", exists: true, file: false, sizeBytes: stat.size, reason: "path is a directory" };
  }
  if (!stat.isFile()) {
    return { path: normalized.path, normalizedPath: normalized.normalizedPath, canonicalRelativePath, status: "unsupported", exists: true, file: false, sizeBytes: stat.size, reason: "path is not a regular file" };
  }
  const evidenceRole = artifactEvidenceRole(normalized.normalizedPath);
  const canonicalEvidenceRole = artifactEvidenceRole(canonicalRelativePath);
  const base = { path: normalized.path, normalizedPath: normalized.normalizedPath, canonicalRelativePath, evidenceRole, canonicalEvidenceRole, status: "existing", exists: true, file: true, sizeBytes: stat.size };
  if (options.rejectBookkeeping === true) {
    const rejected = [evidenceRole, canonicalEvidenceRole].find((role) => role === "bookkeeping" || role === "unsupported");
    if (rejected) {
      return { ...base, status: rejected, reason: rejected === "bookkeeping" ? "path is Dove bookkeeping rather than substantive evidence" : "path is not an approved current-schema evidence artifact" };
    }
  }
  if (options.requireNonEmpty === true && stat.size === 0) return { ...base, status: "empty", reason: "path is an empty file" };
  if (options.readText !== true) return base;
  try {
    const maxBytes = Number.isInteger(options.maxBytes) && options.maxBytes > 0 ? options.maxBytes : 24 * 1024;
    if (mutationContext && canonicalRelativePath === normalized.normalizedPath) {
      const content = mutationContext.readBuffer(canonicalRelativePath, null);
      if (content === null) return { ...base, status: "missing", exists: false, file: false, reason: "path does not exist" };
      const bytesRead = Math.min(maxBytes, content.length);
      return { ...base, text: content.subarray(0, bytesRead).toString("utf8"), bytesRead, truncated: content.length > bytesRead };
    }
    const descriptor = fs.openSync(realFullPath, "r");
    try {
      const buffer = Buffer.alloc(Math.min(maxBytes, stat.size));
      const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, 0);
      return { ...base, text: buffer.subarray(0, bytesRead).toString("utf8"), bytesRead, truncated: stat.size > bytesRead };
    } finally {
      fs.closeSync(descriptor);
    }
  } catch (error) {
    return { ...base, status: "unreadable", reason: error instanceof Error ? error.message : String(error) };
  }
}

export function inspectProjectArtifact(root, rawPath, options = {}) {
  return inspectDeclaredPath(root, rawPath, options);
}
