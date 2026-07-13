import fs from "node:fs";
import path from "node:path";

function pathEscapesRoot(relativePath) {
  return relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath);
}

function existingAncestor(candidatePath) {
  let currentPath = candidatePath;
  while (!fs.existsSync(currentPath)) {
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      break;
    }
    currentPath = parentPath;
  }
  return currentPath;
}

export function resolveCanonicalContainedWrite(root, candidatePath, options = {}) {
  const label = options.label ?? "Write path";
  const resolvedRoot = path.resolve(root);
  const canonicalRoot = fs.realpathSync.native(resolvedRoot);
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
      stat = fs.lstatSync(currentPath);
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

  const canonicalAncestor = fs.realpathSync.native(existingAncestor(requestedPath));
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
