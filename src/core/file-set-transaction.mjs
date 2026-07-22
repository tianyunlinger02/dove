import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { openAnchoredFilesystem } from "./anchored-filesystem.mjs";

const MAX_CLEANUP_RESIDUES = 20;

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function state(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return { exists: false, type: "absent", sha256: null, mode: null };
  if (stat.isSymbolicLink()) return { exists: true, type: "symlink", sha256: null, mode: stat.mode & 0o7777 };
  if (stat.isDirectory()) return { exists: true, type: "directory", sha256: null, mode: stat.mode & 0o7777 };
  if (!stat.isFile()) return { exists: true, type: "other", sha256: null, mode: stat.mode & 0o7777 };
  return { exists: true, type: "file", sha256: sha256(anchor.readFile(relativePath)), mode: stat.mode & 0o7777 };
}

function sameState(left, right) {
  return left.exists === right.exists && left.type === right.type && left.sha256 === right.sha256;
}

function parentDirectories(relativePath) {
  const directories = [];
  let current = path.posix.dirname(relativePath);
  while (current !== ".") {
    directories.push(current);
    current = path.posix.dirname(current);
  }
  return directories.reverse();
}

function ensureParentDirectories(anchor, relativePath, createdDirectories) {
  for (const directoryPath of parentDirectories(relativePath)) {
    const stat = anchor.tryLstat(directoryPath);
    if (stat) {
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Transactional directory component must be a real directory: ${directoryPath}`);
      continue;
    }
    anchor.mkdir(directoryPath);
    createdDirectories.push(directoryPath);
  }
}

function committedResult(entries, cleanupFailures) {
  const residues = cleanupFailures.slice(0, MAX_CLEANUP_RESIDUES);
  return {
    writtenPaths: entries.filter((entry) => !entry.deleting).map((entry) => entry.relativePath),
    removedPaths: entries.filter((entry) => entry.deleting).map((entry) => entry.relativePath),
    changedPaths: entries.map((entry) => entry.relativePath),
    transactionState: {
      phase: "committed",
      rollbackAttempted: false,
      cleanup: {
        status: cleanupFailures.length === 0 ? "clean" : "residue",
        residueCount: cleanupFailures.length,
        residues,
        omittedResidueCount: Math.max(0, cleanupFailures.length - residues.length)
      }
    }
  };
}

export function writeFileSetTransaction(entries, options = {}) {
  if (!Array.isArray(entries)) throw new Error("Transactional write entries must be an array.");
  const fsOps = options.fsOps ?? fs;
  const transactionId = (options.transactionId ?? crypto.randomUUID()).replace(/[^a-z0-9._-]/giu, "-");
  const anchors = new Map();
  const resolved = [];
  const targets = new Set();
  const transactions = new Map();
  const promotions = [];
  const createdDirectories = new Map();
  let phase = "preparing";

  const anchorFor = (root) => {
    const canonicalRoot = typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(path.resolve(root)) : fsOps.realpathSync(path.resolve(root));
    if (!anchors.has(canonicalRoot)) anchors.set(canonicalRoot, openAnchoredFilesystem(canonicalRoot, { fsOps, platform: options.platform, procFdRoot: options.procFdRoot }));
    return anchors.get(canonicalRoot);
  };

  try {
    for (const [index, entry] of entries.entries()) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Transactional write entry ${index} must be an object.`);
      const anchor = anchorFor(entry.root);
      const relativePath = anchor.normalize(entry.relativePath, entry.label ?? "Transactional write path");
      const key = `${anchor.root}\0${relativePath}`;
      if (targets.has(key)) throw new Error(`Transactional write set contains duplicate target ${relativePath}.`);
      targets.add(key);
      const previous = state(anchor, relativePath);
      const deleting = entry.delete === true;
      const deletingEmptyDirectory = deleting && entry.deleteEmptyDirectory === true;
      if (previous.exists && previous.type !== "file" && !(deletingEmptyDirectory && previous.type === "directory")) {
        throw new Error(`Transactional write target must be absent or a regular file${deletingEmptyDirectory ? " or an explicitly selected empty directory" : ""}: ${relativePath}.`);
      }
      if (deleting && !previous.exists) continue;
      if (!deleting && previous.exists && entry.force !== true) continue;
      resolved.push({
        ...entry,
        anchor,
        relativePath,
        deleting,
        content: deleting ? null : Buffer.isBuffer(entry.content) ? Buffer.from(entry.content) : Buffer.from(String(entry.content ?? ""), entry.encoding ?? "utf8"),
        previous
      });
    }
    if (resolved.length === 0) return committedResult([], []);

    for (const anchor of new Set(resolved.map((entry) => entry.anchor))) {
      const transactionPath = `.dove-file-transaction-${transactionId}`;
      if (anchor.exists(transactionPath)) throw new Error(`Transactional staging path is already occupied: ${anchor.displayPath(transactionPath)}.`);
      anchor.mkdir(transactionPath);
      anchor.mkdir(`${transactionPath}/staged`);
      anchor.mkdir(`${transactionPath}/backups`);
      transactions.set(anchor, { transactionPath, stagedRoot: `${transactionPath}/staged`, backupRoot: `${transactionPath}/backups` });
      createdDirectories.set(anchor, []);
    }

    for (const [index, entry] of resolved.entries()) {
      if (entry.deleting) continue;
      const transaction = transactions.get(entry.anchor);
      entry.stagedPath = `${transaction.stagedRoot}/file-${index}`;
      entry.anchor.writeNewFile(entry.stagedPath, entry.content);
      if (entry.previous.mode !== null) entry.anchor.chmod(entry.stagedPath, entry.previous.mode);
    }

    // Reads and target preconditions are revalidated after every byte is staged and before promotion begins.
    for (const entry of resolved) {
      const actual = state(entry.anchor, entry.relativePath);
      if (!sameState(actual, entry.previous)) throw new Error(`Transactional write precondition changed for ${entry.relativePath}.`);
      if (entry.deleting && entry.previous.type === "directory") {
        const children = entry.anchor.readdir(entry.relativePath);
        const scheduledChildren = new Set(resolved
          .filter((candidate) => candidate.anchor === entry.anchor && candidate.deleting && path.posix.dirname(candidate.relativePath) === entry.relativePath)
          .map((candidate) => path.posix.basename(candidate.relativePath)));
        if (children.some((child) => !scheduledChildren.has(typeof child === "string" ? child : child.name))) {
          throw new Error(`Transactional directory deletion requires every child to be an exact scheduled deletion: ${entry.relativePath}.`);
        }
      }
    }

    phase = "promoting";
    for (const [index, entry] of resolved.entries()) {
      const transaction = transactions.get(entry.anchor);
      const promotion = { entry, backupPath: null, promoted: false };
      promotions.push(promotion);
      ensureParentDirectories(entry.anchor, entry.relativePath, createdDirectories.get(entry.anchor));
      if (entry.previous.exists) {
        promotion.backupPath = `${transaction.backupRoot}/file-${index}`;
        entry.anchor.rename(entry.relativePath, promotion.backupPath);
      }
      if (!entry.deleting) {
        entry.anchor.rename(entry.stagedPath, entry.relativePath);
        promotion.promoted = true;
      }
    }

    phase = "committed";
    const cleanupFailures = [];
    for (const [anchor, transaction] of transactions) {
      try {
        anchor.remove(transaction.transactionPath, { recursive: true, force: true });
      } catch (cleanupError) {
        cleanupFailures.push({ path: anchor.displayPath(transaction.transactionPath), reason: errorMessage(cleanupError) });
      }
    }
    return committedResult(resolved, cleanupFailures);
  } catch (error) {
    if (phase === "committed") throw new Error(`Transactional write committed before post-commit cleanup failed: ${errorMessage(error)}`, { cause: error });
    const rollbackFailures = [];
    const attempt = (callback) => {
      try { callback(); } catch (rollbackError) { rollbackFailures.push(errorMessage(rollbackError)); }
    };
    for (const promotion of [...promotions].reverse()) {
      const { entry } = promotion;
      if (promotion.promoted) attempt(() => entry.anchor.remove(entry.relativePath, { force: true }));
      if (promotion.backupPath && entry.anchor.exists(promotion.backupPath)) attempt(() => entry.anchor.rename(promotion.backupPath, entry.relativePath));
    }
    for (const [anchor, directories] of createdDirectories) {
      for (const directoryPath of [...directories].sort((left, right) => right.length - left.length)) {
        attempt(() => anchor.rmdir(directoryPath, { force: true }));
      }
    }
    for (const [anchor, transaction] of transactions) {
      attempt(() => anchor.remove(transaction.transactionPath, { recursive: true, force: true }));
    }
    if (rollbackFailures.length > 0) throw new Error(`Transactional write failed and rollback also failed: ${errorMessage(error)}; rollback: ${rollbackFailures.join("; ")}`, { cause: error });
    throw new Error(`Transactional write failed and all staged changes were rolled back: ${errorMessage(error)}`, { cause: error });
  } finally {
    for (const anchor of anchors.values()) anchor.close();
  }
}
