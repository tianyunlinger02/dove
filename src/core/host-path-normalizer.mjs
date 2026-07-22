import path from "node:path";

import { openAnchoredFilesystem } from "./anchored-filesystem.mjs";

function invalidPath(label, value) {
  throw new Error(`${label} must name one canonical path inside the workspace: ${value}`);
}

export function normalizeHostWorkspacePath(root, value, label = "Host path") {
  if (typeof value !== "string" || !value || value !== value.trim() || value.includes("\0") || value.includes("\\")) invalidPath(label, value);
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value) && !/^[A-Za-z]:[\\/]/u.test(value)) invalidPath(label, value);
  const resolvedRoot = path.resolve(root);
  if (path.isAbsolute(value)) {
    const normalizedAbsolute = path.resolve(value);
    if (normalizedAbsolute !== value) invalidPath(label, value);
    const relative = path.relative(resolvedRoot, normalizedAbsolute);
    if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) invalidPath(label, value);
    return relative.split(path.sep).join("/");
  }
  if (/^[A-Za-z]:[\\/]/u.test(value)) invalidPath(label, value);
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === "." || normalized === ".." || normalized.startsWith("../") || value.includes("//") || value.endsWith("/")) invalidPath(label, value);
  return value;
}

export function normalizeHostWorkspaceArtifactPath(root, value, label = "Host artifact path") {
  let relativePath;
  try {
    relativePath = normalizeHostWorkspacePath(root, value, label);
  } catch (error) {
    throw new Error(`${label} must name one canonical regular file or future file inside the workspace: ${value}`, { cause: error });
  }
  const anchor = openAnchoredFilesystem(root);
  try {
    const stat = anchor.tryLstat(relativePath);
    if (stat === null) return relativePath;
    anchor.inspectRegularFile(relativePath);
    return relativePath;
  } catch (error) {
    throw new Error(`${label} must name one canonical regular file or future file inside the workspace: ${value}`, { cause: error });
  } finally {
    anchor.close();
  }
}

export function normalizeHostWorkspaceFilePath(root, value, label = "Host file path") {
  let relativePath;
  try {
    relativePath = normalizeHostWorkspacePath(root, value, label);
  } catch (error) {
    throw new Error(`${label} must name one canonical regular file inside the workspace: ${value}`, { cause: error });
  }
  const anchor = openAnchoredFilesystem(root);
  try {
    anchor.inspectRegularFile(relativePath);
    return relativePath;
  } catch (error) {
    throw new Error(`${label} must name one canonical regular file inside the workspace: ${value}`, { cause: error });
  } finally {
    anchor.close();
  }
}
