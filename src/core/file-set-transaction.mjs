import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { openRootedFilesystem } from "./rooted-filesystem.mjs";

const MAX_CLEANUP_WARNINGS = 20;
const ENTRY_FIELDS = new Set(["root", "relativePath", "content", "encoding", "force", "delete", "deleteEmptyDirectory", "expectedState", "label"]);

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
  return left.exists === right.exists && left.type === right.type && left.sha256 === right.sha256 && left.mode === right.mode;
}

function expectedState(raw, index) {
  if (raw === undefined) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Transactional write entry ${index} expectedState must be an object.`);
  const keys = Object.keys(raw).sort();
  if (keys.join(",") !== "exists,mode,sha256,type") throw new Error(`Transactional write entry ${index} expectedState must contain exactly exists, type, sha256, and mode.`);
  if (typeof raw.exists !== "boolean" || !["absent", "directory", "file"].includes(raw.type)) throw new Error(`Transactional write entry ${index} expectedState is invalid.`);
  if (raw.exists !== (raw.type !== "absent")) throw new Error(`Transactional write entry ${index} expectedState existence is contradictory.`);
  if (raw.exists ? !Number.isInteger(raw.mode) || raw.mode < 0 || raw.mode > 0o7777 : raw.mode !== null) throw new Error(`Transactional write entry ${index} expectedState mode is invalid.`);
  if (raw.type === "file") {
    if (typeof raw.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(raw.sha256)) throw new Error(`Transactional write entry ${index} expectedState file requires a lowercase SHA-256 digest.`);
  } else if (raw.sha256 !== null) {
    throw new Error(`Transactional write entry ${index} expectedState ${raw.type} must use a null digest.`);
  }
  return { exists: raw.exists, type: raw.type, sha256: raw.sha256, mode: raw.mode };
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

function inspectParentDirectories(anchor, relativePath) {
  for (const directoryPath of parentDirectories(relativePath)) {
    const stat = anchor.tryLstat(directoryPath);
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw new Error(`Transactional directory component must be a real directory: ${directoryPath}`);
    if (!stat) break;
  }
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

function removeNewTransactionParents(anchor, transaction) {
  if (anchor.exists(transaction.transactionBase) && anchor.readdir(transaction.transactionBase).length === 0) anchor.rmdir(transaction.transactionBase, { force: true });
  for (const parent of [...transaction.transactionParents].reverse()) {
    if (!parent.existed && anchor.exists(parent.relativePath) && anchor.readdir(parent.relativePath).length === 0) anchor.rmdir(parent.relativePath, { force: true });
  }
}

function assertNoUnexpectedChildren(entry, resolved) {
  const scheduledChildren = new Set(resolved
    .filter((candidate) => candidate.anchor === entry.anchor && candidate.deleting && path.posix.dirname(candidate.relativePath) === entry.relativePath)
    .map((candidate) => path.posix.basename(candidate.relativePath)));
  const unexpected = entry.anchor.readdir(entry.relativePath)
    .map((child) => typeof child === "string" ? child : child.name)
    .filter((child) => !scheduledChildren.has(child));
  if (unexpected.length > 0) {
    throw new Error(`Transactional directory deletion found an unscheduled child: ${entry.relativePath}/${unexpected.sort().join(`, ${entry.relativePath}/`)}.`);
  }
}

function committedResult(entries, cleanupFailures) {
  const warnings = cleanupFailures.slice(0, MAX_CLEANUP_WARNINGS);
  return {
    writtenPaths: entries.filter((entry) => !entry.deleting).map((entry) => entry.relativePath),
    removedPaths: entries.filter((entry) => entry.deleting).map((entry) => entry.relativePath),
    changedPaths: entries.map((entry) => entry.relativePath),
    cleanupWarnings: warnings,
    omittedCleanupWarningCount: Math.max(0, cleanupFailures.length - warnings.length)
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

  const anchorFor = (root) => {
    const canonicalRoot = typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(path.resolve(root)) : fsOps.realpathSync(path.resolve(root));
    if (!anchors.has(canonicalRoot)) anchors.set(canonicalRoot, openRootedFilesystem(canonicalRoot, { fsOps }));
    return anchors.get(canonicalRoot);
  };

  try {
    for (const [index, entry] of entries.entries()) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Transactional write entry ${index} must be an object.`);
      const unknownFields = Object.keys(entry).filter((field) => !ENTRY_FIELDS.has(field));
      if (unknownFields.length > 0) throw new Error(`Transactional write entry ${index} uses unsupported fields: ${unknownFields.join(", ")}.`);
      const anchor = anchorFor(entry.root);
      const relativePath = anchor.normalize(entry.relativePath, entry.label ?? "Transactional write path");
      const key = `${anchor.root}\0${relativePath}`;
      if (targets.has(key)) throw new Error(`Transactional write set contains duplicate target ${relativePath}.`);
      targets.add(key);
      inspectParentDirectories(anchor, relativePath);
      const previous = state(anchor, relativePath);
      const approvedState = expectedState(entry.expectedState, index);
      if (approvedState !== null && !sameState(previous, approvedState)) throw new Error(`Transactional write approved precondition changed for ${relativePath}.`);
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
        deletingEmptyDirectory,
        previous,
        content: deleting ? null : Buffer.isBuffer(entry.content) ? Buffer.from(entry.content) : Buffer.from(String(entry.content ?? ""), entry.encoding ?? "utf8")
      });
    }
    if (resolved.length === 0) return committedResult([], []);

    for (const anchor of new Set(resolved.map((entry) => entry.anchor))) {
      const transactionBase = anchor.normalize(options.transactionBase ?? ".dove/install/transactions", "Transactional staging base");
      const transactionPath = `${transactionBase}/${transactionId}`;
      if (anchor.exists(transactionPath)) throw new Error(`Transactional staging path is already occupied: ${anchor.displayPath(transactionPath)}.`);
      const transactionParents = parentDirectories(`${transactionPath}/placeholder`).map((relativePath) => ({ relativePath, existed: anchor.exists(relativePath) }));
      anchor.mkdir(transactionPath, { recursive: true });
      anchor.mkdir(`${transactionPath}/backups`);
      transactions.set(anchor, { transactionBase, transactionPath, transactionParents, backupRoot: `${transactionPath}/backups` });
      createdDirectories.set(anchor, []);
    }

    for (const [index, entry] of resolved.entries()) {
      if (entry.deleting) continue;
      const parent = path.posix.dirname(entry.relativePath);
      const temporaryName = `.${path.posix.basename(entry.relativePath)}.${transactionId}.${index}.tmp`;
      entry.stagedPath = parent === "." ? temporaryName : `${parent}/${temporaryName}`;
      ensureParentDirectories(entry.anchor, entry.relativePath, createdDirectories.get(entry.anchor));
      entry.anchor.writeNewFile(entry.stagedPath, entry.content);
      if (entry.previous.mode !== null) entry.anchor.chmod(entry.stagedPath, entry.previous.mode);
    }

    for (const [index, entry] of resolved.entries()) {
      const transaction = transactions.get(entry.anchor);
      const promotion = { entry, backupPath: null, promoted: false };
      promotions.push(promotion);
      ensureParentDirectories(entry.anchor, entry.relativePath, createdDirectories.get(entry.anchor));
      const actual = state(entry.anchor, entry.relativePath);
      if (!sameState(actual, entry.previous)) throw new Error(`Transactional write precondition changed for ${entry.relativePath}.`);
      if (entry.deletingEmptyDirectory) assertNoUnexpectedChildren(entry, resolved);
      if (entry.previous.exists) {
        promotion.backupPath = `${transaction.backupRoot}/file-${index}`;
        entry.anchor.rename(entry.relativePath, promotion.backupPath);
      }
      if (!entry.deleting) {
        entry.anchor.rename(entry.stagedPath, entry.relativePath);
        promotion.promoted = true;
      }
    }

    const cleanupFailures = [];
    for (const [anchor, transaction] of transactions) {
      try {
        anchor.remove(transaction.transactionPath, { recursive: true, force: true });
        removeNewTransactionParents(anchor, transaction);
      } catch (cleanupError) {
        cleanupFailures.push({ path: anchor.displayPath(transaction.transactionPath), reason: errorMessage(cleanupError) });
      }
    }
    return committedResult(resolved, cleanupFailures);
  } catch (error) {
    const rollbackFailures = [];
    const attempt = (callback) => {
      try { callback(); } catch (rollbackError) { rollbackFailures.push(errorMessage(rollbackError)); }
    };
    for (const promotion of [...promotions].reverse()) {
      const { entry } = promotion;
      if (promotion.promoted && entry.anchor.exists(entry.relativePath)) {
        attempt(() => entry.anchor.remove(entry.relativePath, { force: true }));
      }
      if (promotion.backupPath && entry.anchor.exists(promotion.backupPath)) attempt(() => {
        if (entry.anchor.exists(entry.relativePath)) throw new Error(`Transactional rollback target is occupied: ${entry.relativePath}.`);
        entry.anchor.rename(promotion.backupPath, entry.relativePath);
      });
    }
    for (const [anchor, directories] of createdDirectories) {
      for (const directoryPath of [...directories].sort((left, right) => right.length - left.length)) attempt(() => anchor.rmdir(directoryPath, { force: true }));
    }
    for (const entry of resolved) {
      if (entry.stagedPath && entry.anchor.exists(entry.stagedPath)) attempt(() => entry.anchor.remove(entry.stagedPath, { force: true }));
    }
    for (const [anchor, transaction] of transactions) {
      attempt(() => anchor.remove(transaction.transactionPath, { recursive: true, force: true }));
      attempt(() => removeNewTransactionParents(anchor, transaction));
    }
    if (rollbackFailures.length > 0) {
      throw new Error(`Transactional write failed and rollback also failed: ${errorMessage(error)}; rollback: ${rollbackFailures.join("; ")}`, { cause: error });
    }
    throw new Error(`Transactional write failed and all staged changes were rolled back: ${errorMessage(error)}`, { cause: error });
  }
}
