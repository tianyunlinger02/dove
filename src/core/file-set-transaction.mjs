import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { resolveCanonicalContainedWrite } from "./contained-write.mjs";

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function makeDirectory(fsOps, root, directoryPath, createdDirectories) {
  if (fs.existsSync(directoryPath)) return;
  const missing = [];
  let current = directoryPath;
  while (current !== root && !fs.existsSync(current)) {
    missing.push(current);
    current = path.dirname(current);
  }
  const relative = path.relative(root, current);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`Transactional write directory escaped its root: ${directoryPath}`);
  for (const item of missing.reverse()) {
    fsOps.mkdirSync(item, { recursive: false });
    createdDirectories.push(item);
  }
}

function removeEmptyDirectories(fsOps, directories) {
  for (const directoryPath of [...directories].sort((left, right) => right.length - left.length)) {
    try {
      fsOps.rmdirSync(directoryPath);
    } catch (error) {
      if (!["ENOENT", "ENOTEMPTY"].includes(error?.code)) throw error;
    }
  }
}

const MAX_CLEANUP_RESIDUES = 20;

function committedResult(paths, cleanupFailures) {
  const residues = cleanupFailures.slice(0, MAX_CLEANUP_RESIDUES);
  return {
    writtenPaths: [...paths],
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
  const transactionId = options.transactionId ?? crypto.randomUUID();
  const resolved = [];
  const targets = new Set();
  for (const [index, entry] of entries.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Transactional write entry ${index} must be an object.`);
    const root = fs.realpathSync.native(path.resolve(entry.root));
    const target = resolveCanonicalContainedWrite(root, entry.relativePath, { label: entry.label ?? "Transactional write path" });
    if (targets.has(target.fullPath)) throw new Error(`Transactional write set contains duplicate target ${target.relativePath}.`);
    targets.add(target.fullPath);
    let stat = null;
    try {
      stat = fs.lstatSync(target.fullPath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    if (stat && !stat.isFile()) throw new Error(`Transactional write target must be absent or a regular file: ${target.relativePath}.`);
    if (stat && entry.force !== true) continue;
    resolved.push({
      ...entry,
      root,
      relativePath: target.relativePath,
      fullPath: target.fullPath,
      content: Buffer.isBuffer(entry.content) ? Buffer.from(entry.content) : Buffer.from(String(entry.content ?? ""), entry.encoding ?? "utf8"),
      previous: stat ? Buffer.from(fs.readFileSync(target.fullPath)) : null,
      previousMode: stat ? stat.mode & 0o7777 : null
    });
  }
  if (resolved.length === 0) return committedResult([], []);

  const roots = [...new Set(resolved.map((entry) => entry.root))];
  const transactions = new Map();
  const createdDirectories = [];
  const promotions = [];
  let phase = "preparing";
  try {
    for (const root of roots) {
      const relativeTransactionPath = `.dove-file-transaction-${transactionId.replace(/[^a-z0-9._-]/giu, "-")}`;
      const transactionPath = resolveCanonicalContainedWrite(root, relativeTransactionPath, { label: "Transactional staging path" }).fullPath;
      if (fs.existsSync(transactionPath)) throw new Error(`Transactional staging path is already occupied: ${transactionPath}.`);
      fsOps.mkdirSync(transactionPath, { recursive: false });
      const stagedRoot = path.join(transactionPath, "staged");
      const backupRoot = path.join(transactionPath, "backups");
      fsOps.mkdirSync(stagedRoot, { recursive: false });
      fsOps.mkdirSync(backupRoot, { recursive: false });
      transactions.set(root, { transactionPath, stagedRoot, backupRoot });
    }
    for (const [index, entry] of resolved.entries()) {
      const transaction = transactions.get(entry.root);
      const stagedPath = path.join(transaction.stagedRoot, `file-${index}`);
      fsOps.writeFileSync(stagedPath, entry.content);
      if (entry.previousMode !== null && typeof fsOps.chmodSync === "function") fsOps.chmodSync(stagedPath, entry.previousMode);
      entry.stagedPath = stagedPath;
    }

    phase = "promoting";
    for (const [index, entry] of resolved.entries()) {
      resolveCanonicalContainedWrite(entry.root, entry.relativePath, { label: entry.label ?? "Transactional write path" });
      const currentExists = fs.existsSync(entry.fullPath);
      if (currentExists !== (entry.previous !== null)) throw new Error(`Transactional write precondition changed for ${entry.relativePath}.`);
      if (currentExists && !fs.readFileSync(entry.fullPath).equals(entry.previous)) throw new Error(`Transactional write precondition changed for ${entry.relativePath}.`);
      const transaction = transactions.get(entry.root);
      const promotion = { entry, backupPath: null, promoted: false };
      promotions.push(promotion);
      makeDirectory(fsOps, entry.root, path.dirname(entry.fullPath), createdDirectories);
      if (currentExists) {
        promotion.backupPath = path.join(transaction.backupRoot, `file-${index}`);
        fsOps.renameSync(entry.fullPath, promotion.backupPath);
      }
      fsOps.renameSync(entry.stagedPath, entry.fullPath);
      promotion.promoted = true;
    }
    phase = "committed";
    const cleanupFailures = [];
    for (const transaction of transactions.values()) {
      try {
        fsOps.rmSync(transaction.transactionPath, { recursive: true, force: true });
      } catch (cleanupError) {
        cleanupFailures.push({ path: transaction.transactionPath, reason: errorMessage(cleanupError) });
      }
    }
    return committedResult(resolved.map((entry) => entry.relativePath), cleanupFailures);
  } catch (error) {
    if (phase === "committed") throw new Error(`Transactional write committed before post-commit cleanup failed: ${errorMessage(error)}`, { cause: error });
    if (promotions.length === 0) {
      for (const transaction of transactions.values()) {
        try {
          if (fs.existsSync(transaction.transactionPath)) fsOps.rmSync(transaction.transactionPath, { recursive: true, force: true });
        } catch {}
      }
      throw error;
    }
    const rollbackFailures = [];
    for (const promotion of [...promotions].reverse()) {
      try {
        if (promotion.promoted && fs.existsSync(promotion.entry.fullPath)) fsOps.rmSync(promotion.entry.fullPath, { force: true });
        if (promotion.backupPath && fs.existsSync(promotion.backupPath)) fsOps.renameSync(promotion.backupPath, promotion.entry.fullPath);
      } catch (rollbackError) {
        rollbackFailures.push(errorMessage(rollbackError));
      }
    }
    try {
      removeEmptyDirectories(fsOps, createdDirectories);
    } catch (rollbackError) {
      rollbackFailures.push(errorMessage(rollbackError));
    }
    for (const transaction of transactions.values()) {
      try {
        if (fs.existsSync(transaction.transactionPath)) fsOps.rmSync(transaction.transactionPath, { recursive: true, force: true });
      } catch (rollbackError) {
        rollbackFailures.push(errorMessage(rollbackError));
      }
    }
    if (rollbackFailures.length > 0) throw new Error(`Transactional write failed and rollback also failed: ${errorMessage(error)}; rollback: ${rollbackFailures.join("; ")}`, { cause: error });
    throw new Error(`Transactional write failed and all staged changes were rolled back: ${errorMessage(error)}`, { cause: error });
  }
}
