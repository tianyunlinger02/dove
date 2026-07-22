import fs from "node:fs";
import path from "node:path";

function pathEscapesRoot(relativePath) {
  return relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath);
}

function existingAncestor(fsOps, candidatePath) {
  let currentPath = candidatePath;
  while (!fsOps.existsSync(currentPath)) {
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
  }
  return currentPath;
}

function realpathNative(fsOps, targetPath) {
  return typeof fsOps.realpathSync?.native === "function" ? fsOps.realpathSync.native(targetPath) : fsOps.realpathSync(targetPath);
}

export function resolveCanonicalContainedWrite(root, candidatePath, options = {}) {
  const label = options.label ?? "Write path";
  const fsOps = options.fsOps ?? fs;
  const resolvedRoot = path.resolve(root);
  const canonicalRoot = realpathNative(fsOps, resolvedRoot);
  const requestedPath = path.isAbsolute(candidatePath)
    ? path.resolve(candidatePath)
    : path.resolve(resolvedRoot, candidatePath);
  const requestedRelative = path.relative(resolvedRoot, requestedPath);
  if (!requestedRelative || pathEscapesRoot(requestedRelative)) {
    throw new Error(`${label} must stay inside the canonical root: ${candidatePath}`);
  }

  let currentPath = resolvedRoot;
  for (const component of requestedRelative.split(path.sep)) {
    currentPath = path.join(currentPath, component);
    let stat;
    try {
      stat = fsOps.lstatSync(currentPath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        break;
      }
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`${label} must not contain symbolic links: ${candidatePath}`);
    }
  }

  const canonicalAncestor = realpathNative(fsOps, existingAncestor(fsOps, requestedPath));
  const canonicalRelative = path.relative(canonicalRoot, canonicalAncestor);
  if (pathEscapesRoot(canonicalRelative)) {
    throw new Error(`${label} must stay inside the canonical root: ${candidatePath}`);
  }

  return {
    root: canonicalRoot,
    relativePath: requestedRelative.split(path.sep).join("/"),
    fullPath: path.join(canonicalRoot, requestedRelative)
  };
}
