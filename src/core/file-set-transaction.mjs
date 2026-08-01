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

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function treeMetadata(stat) {
  return {
    device: String(stat.dev),
    inode: String(stat.ino),
    mode: Number(stat.mode),
    ctimeNs: String(stat.ctimeNs),
    mtimeNs: String(stat.mtimeNs)
  };
}

export function inspectDirectoryTreeDigest(root, relativePath, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const canonicalRoot = typeof fsOps.realpathSync.native === "function"
    ? fsOps.realpathSync.native(path.resolve(root))
    : fsOps.realpathSync(path.resolve(root));
  const normalized = path.posix.normalize(String(relativePath).replace(/\\/gu, "/"));
  if (normalized === "." || normalized === ".." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) {
    throw new Error(`Directory tree digest path must stay inside its root: ${relativePath}.`);
  }
  const directory = path.join(canonicalRoot, normalized);
  const rootStat = fsOps.lstatSync(directory, { bigint: true });
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error(`Directory tree digest source must be a real directory: ${normalized}.`);
  const entries = [{ path: "", kind: "directory", ...treeMetadata(rootStat) }];
  const visit = (absoluteDirectory, prefix) => {
    const names = fsOps.readdirSync(absoluteDirectory).map(String).sort((left, right) => left.localeCompare(right));
    for (const name of names) {
      const childPath = prefix ? path.posix.join(prefix, name) : name;
      const absoluteChild = path.join(absoluteDirectory, name);
      const stat = fsOps.lstatSync(absoluteChild, { bigint: true });
      const metadata = { path: childPath, ...treeMetadata(stat) };
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        entries.push({ ...metadata, kind: "directory" });
        visit(absoluteChild, childPath);
      } else if (stat.isFile()) {
        entries.push({ ...metadata, kind: "file", sizeBytes: String(stat.size), sha256: sha256(fsOps.readFileSync(absoluteChild)) });
      } else if (stat.isSymbolicLink()) {
        entries.push({ ...metadata, kind: "symlink", target: fsOps.readlinkSync(absoluteChild) });
      } else {
        throw new Error(`Unsupported filesystem entry inside ${normalized}: ${childPath}.`);
      }
    }
  };
  visit(directory, "");
  return sha256(canonicalJson(entries));
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
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Transactional write entry ${index} expectedState must be an object.`);
  }
  const keys = Object.keys(raw).sort();
  if (keys.join(",") !== "exists,mode,sha256,type") {
    throw new Error(`Transactional write entry ${index} expectedState must contain exactly exists, type, sha256, and mode.`);
  }
  if (typeof raw.exists !== "boolean" || !["absent", "directory", "file"].includes(raw.type)) {
    throw new Error(`Transactional write entry ${index} expectedState is invalid.`);
  }
  if (raw.exists !== (raw.type !== "absent")) throw new Error(`Transactional write entry ${index} expectedState existence is contradictory.`);
  if (raw.exists ? !Number.isInteger(raw.mode) || raw.mode < 0 || raw.mode > 0o7777 : raw.mode !== null) {
    throw new Error(`Transactional write entry ${index} expectedState mode is invalid.`);
  }
  if (raw.type === "file") {
    if (typeof raw.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(raw.sha256)) {
      throw new Error(`Transactional write entry ${index} expectedState file requires a lowercase SHA-256 digest.`);
    }
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
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) {
      throw new Error(`Transactional directory component must be a real directory: ${directoryPath}`);
    }
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

function committedResult(entries, cleanupFailures) {
  const residues = cleanupFailures.slice(0, MAX_CLEANUP_RESIDUES);
  const mutations = entries.filter((entry) => !entry.asserting);
  const movedPaths = mutations.filter((entry) => entry.movingDirectory).map((entry) => ({ from: entry.relativePath, to: entry.moveTo }));
  return {
    writtenPaths: mutations.filter((entry) => !entry.deleting && !entry.movingDirectory).map((entry) => entry.relativePath),
    removedPaths: mutations.filter((entry) => entry.deleting).map((entry) => entry.relativePath),
    movedPaths,
    changedPaths: mutations.flatMap((entry) => entry.movingDirectory ? [entry.relativePath, entry.moveTo] : [entry.relativePath]),
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
      const approvedState = expectedState(entry.expectedState, index);
      if (approvedState !== null && !sameState(previous, approvedState)) {
        throw new Error(`Transactional write approved precondition changed for ${relativePath}.`);
      }
      const movingDirectory = entry.moveTo !== undefined;
      const deleting = entry.delete === true;
      const asserting = entry.assertOnly === true;
      if (asserting && (movingDirectory || deleting || entry.content !== undefined || entry.force === true || entry.deleteEmptyDirectory === true)) {
        throw new Error(`Transactional assertion entry must not request a mutation: ${relativePath}.`);
      }
      if (asserting && approvedState === null) throw new Error(`Transactional assertion entry requires expectedState: ${relativePath}.`);
      if (movingDirectory && deleting) throw new Error(`Transactional entry cannot both move and delete: ${relativePath}.`);
      const deletingEmptyDirectory = deleting && entry.deleteEmptyDirectory === true;
      let moveTo = null;
      if (movingDirectory) {
        moveTo = anchor.normalize(entry.moveTo, entry.label ?? "Transactional move destination");
        const destinationKey = `${anchor.root}\0${moveTo}`;
        if (targets.has(destinationKey)) throw new Error(`Transactional write set contains duplicate target ${moveTo}.`);
        targets.add(destinationKey);
        if (!previous.exists || previous.type !== "directory") throw new Error(`Transactional move source must be a real directory: ${relativePath}.`);
        inspectParentDirectories(anchor, moveTo);
        const destination = state(anchor, moveTo);
        if (destination.exists) throw new Error(`Transactional move destination must be absent: ${moveTo}.`);
        if (typeof entry.expectedTreeDigest !== "string" || !/^[a-f0-9]{64}$/u.test(entry.expectedTreeDigest)) {
          throw new Error(`Transactional directory move requires a lowercase SHA-256 expectedTreeDigest: ${relativePath}.`);
        }
        const actualTreeDigest = inspectDirectoryTreeDigest(anchor.root, relativePath, { fsOps });
        if (actualTreeDigest !== entry.expectedTreeDigest) throw new Error(`Transactional move source tree digest changed for ${relativePath}.`);
      } else if (previous.exists && previous.type !== "file" && !(deletingEmptyDirectory && previous.type === "directory")) {
        throw new Error(`Transactional write target must be absent or a regular file${deletingEmptyDirectory ? " or an explicitly selected empty directory" : ""}: ${relativePath}.`);
      }
      if (deletingEmptyDirectory && previous.exists) {
        if (typeof entry.expectedTreeDigest !== "string" || !/^[a-f0-9]{64}$/u.test(entry.expectedTreeDigest)) {
          throw new Error(`Transactional directory deletion requires a lowercase SHA-256 expectedTreeDigest: ${relativePath}.`);
        }
        const actualTreeDigest = inspectDirectoryTreeDigest(anchor.root, relativePath, { fsOps });
        if (actualTreeDigest !== entry.expectedTreeDigest) throw new Error(`Transactional directory deletion tree digest changed for ${relativePath}.`);
      }
      if (asserting) {
        resolved.push({ ...entry, anchor, relativePath, moveTo, movingDirectory, deleting, asserting, content: null, previous });
        continue;
      }
      if (deleting && !previous.exists) continue;
      if (!movingDirectory && !deleting && previous.exists && entry.force !== true) continue;
      resolved.push({
        ...entry,
        anchor,
        relativePath,
        moveTo,
        movingDirectory,
        deleting,
        asserting,
        content: deleting || movingDirectory ? null : Buffer.isBuffer(entry.content) ? Buffer.from(entry.content) : Buffer.from(String(entry.content ?? ""), entry.encoding ?? "utf8"),
        previous
      });
    }
    if (resolved.length === 0) return committedResult([], []);

    const mutationEntries = resolved.filter((entry) => !entry.asserting);
    if (mutationEntries.length === 0) return committedResult(resolved, []);

    for (const anchor of new Set(mutationEntries.map((entry) => entry.anchor))) {
      const transactionPath = `.dove-file-transaction-${transactionId}`;
      if (anchor.exists(transactionPath)) throw new Error(`Transactional staging path is already occupied: ${anchor.displayPath(transactionPath)}.`);
      anchor.mkdir(transactionPath);
      anchor.mkdir(`${transactionPath}/staged`);
      anchor.mkdir(`${transactionPath}/backups`);
      transactions.set(anchor, { transactionPath, stagedRoot: `${transactionPath}/staged`, backupRoot: `${transactionPath}/backups` });
      createdDirectories.set(anchor, []);
    }

    for (const [index, entry] of resolved.entries()) {
      if (entry.asserting || entry.deleting || entry.movingDirectory) continue;
      const transaction = transactions.get(entry.anchor);
      entry.stagedPath = `${transaction.stagedRoot}/file-${index}`;
      entry.anchor.writeNewFile(entry.stagedPath, entry.content);
      if (entry.previous.mode !== null) entry.anchor.chmod(entry.stagedPath, entry.previous.mode);
    }

    // Reads and target preconditions are revalidated after every byte is staged and before promotion begins.
    for (const entry of resolved) {
      const actual = state(entry.anchor, entry.relativePath);
      if (!sameState(actual, entry.previous)) throw new Error(`Transactional write precondition changed for ${entry.relativePath}.`);
      if (entry.movingDirectory) {
        if (state(entry.anchor, entry.moveTo).exists) throw new Error(`Transactional move destination became occupied: ${entry.moveTo}.`);
        const actualTreeDigest = inspectDirectoryTreeDigest(entry.anchor.root, entry.relativePath, { fsOps });
        if (actualTreeDigest !== entry.expectedTreeDigest) throw new Error(`Transactional move source tree digest changed for ${entry.relativePath}.`);
      }
      if (entry.deleting && entry.previous.type === "directory") {
        const actualTreeDigest = inspectDirectoryTreeDigest(entry.anchor.root, entry.relativePath, { fsOps });
        if (actualTreeDigest !== entry.expectedTreeDigest) throw new Error(`Transactional directory deletion tree digest changed for ${entry.relativePath}.`);
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
      if (entry.asserting) continue;
      const transaction = transactions.get(entry.anchor);
      const promotion = { entry, backupPath: null, promoted: false, movedDirectory: false };
      promotions.push(promotion);
      if (entry.movingDirectory) {
        ensureParentDirectories(entry.anchor, entry.moveTo, createdDirectories.get(entry.anchor));
        if (state(entry.anchor, entry.moveTo).exists) throw new Error(`Transactional move destination became occupied: ${entry.moveTo}.`);
        const actualTreeDigest = inspectDirectoryTreeDigest(entry.anchor.root, entry.relativePath, { fsOps });
        if (actualTreeDigest !== entry.expectedTreeDigest) throw new Error(`Transactional move source tree digest changed for ${entry.relativePath}.`);
        entry.anchor.rename(entry.relativePath, entry.moveTo);
        promotion.movedDirectory = true;
        continue;
      }
      ensureParentDirectories(entry.anchor, entry.relativePath, createdDirectories.get(entry.anchor));
      if (entry.previous.type === "directory") {
        const scheduledChildren = new Set(resolved
          .filter((candidate) => candidate.anchor === entry.anchor && candidate.deleting && path.posix.dirname(candidate.relativePath) === entry.relativePath)
          .map((candidate) => path.posix.basename(candidate.relativePath)));
        const unexpected = entry.anchor.readdir(entry.relativePath)
          .map((child) => typeof child === "string" ? child : child.name)
          .filter((child) => !scheduledChildren.has(child));
        if (unexpected.length > 0) {
          throw new Error(`Transactional directory deletion found an unscheduled child during promotion: ${entry.relativePath}/${unexpected.sort().join(`, ${entry.relativePath}/`)}.`);
        }
      } else {
        const actual = state(entry.anchor, entry.relativePath);
        if (!sameState(actual, entry.previous)) throw new Error(`Transactional write precondition changed during promotion for ${entry.relativePath}.`);
      }
      if (entry.previous.exists) {
        promotion.backupPath = `${transaction.backupRoot}/file-${index}`;
        entry.anchor.rename(entry.relativePath, promotion.backupPath);
      }
      if (!entry.deleting) {
        entry.anchor.rename(entry.stagedPath, entry.relativePath);
        promotion.promoted = true;
      }
    }

    for (const entry of resolved.filter((candidate) => candidate.asserting)) {
      const actual = state(entry.anchor, entry.relativePath);
      if (!sameState(actual, entry.previous)) {
        throw new Error(`Transactional assertion changed during promotion for ${entry.relativePath}.`);
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
      if (promotion.movedDirectory && entry.anchor.exists(entry.moveTo)) attempt(() => entry.anchor.rename(entry.moveTo, entry.relativePath));
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
