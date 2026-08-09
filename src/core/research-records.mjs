import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { openAnchoredFilesystem } from "./anchored-filesystem.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";

export const SAFE_RESEARCH_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
export const SHA256 = /^[0-9a-f]{64}$/u;

export function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  return value;
}

export function assertFields(value, fields, label) {
  assertPlainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  return value;
}

export function researchId(value, label) {
  if (typeof value !== "string" || !SAFE_RESEARCH_ID.test(value)) throw new Error(`${label} must be a safe lowercase identifier.`);
  return value;
}

export function nonEmptyText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

export function optionalText(value, label) {
  if (value === null || value === undefined) return null;
  return nonEmptyText(value, label);
}

export function exactTimestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return value;
}

export function stringArray(value, label, options = {}) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${label} must be an array of non-empty strings.`);
  const normalized = value.map((item) => item.trim());
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} must not contain duplicates.`);
  if (normalized.length < (options.min ?? 0)) throw new Error(`${label} must contain at least ${options.min} item(s).`);
  return normalized;
}

export function enumeration(value, values, label) {
  if (!values.includes(value)) throw new Error(`${label} must be one of: ${values.join(", ")}.`);
  return value;
}

export function normalizedRelativePath(value, label, options = {}) {
  const supplied = nonEmptyText(value, label).replace(/\\/gu, "/");
  const normalized = path.posix.normalize(supplied);
  if (path.posix.isAbsolute(normalized) || normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("\0")) throw new Error(`${label} must stay inside the project.`);
  if (supplied !== normalized) throw new Error(`${label} must be normalized.`);
  if (options.allowDove !== true && (normalized === ".dove" || normalized.startsWith(".dove/"))) throw new Error(`${label} must not reference Dove bookkeeping.`);
  return normalized;
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function jsonDocument(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function newResearchId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function canonicalRoot(root, fsOps) {
  const resolved = path.resolve(root);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}

function normalizedWritePath(value) {
  return normalizedRelativePath(value, "Research record path", { allowDove: true });
}

function currentFile(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return null;
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Research record target must be absent or a regular file: ${relativePath}.`);
  return { bytes: anchor.readFile(relativePath), mode: stat.mode & 0o7777 };
}

export function readResearchText(root, relativePath, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const normalized = normalizedWritePath(relativePath);
  const anchor = openAnchoredFilesystem(canonicalRoot(root, fsOps), { ...options, fsOps });
  try {
    const current = currentFile(anchor, normalized);
    return current ? current.bytes.toString("utf8") : (options.fallback ?? null);
  } finally {
    anchor.close();
  }
}

export function readResearchJson(root, relativePath, options = {}) {
  const text = readResearchText(root, relativePath, options);
  if (text === null) return options.fallback ?? null;
  return parseJsonWithoutDuplicateKeys(text, options.label ?? relativePath);
}

export function writeResearchFileAtomic(root, relativePath, content, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const normalized = normalizedWritePath(relativePath);
  const anchor = openAnchoredFilesystem(canonicalRoot(root, fsOps), { ...options, fsOps });
  const bytes = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(String(content), options.encoding ?? "utf8");
  const transactionRoot = `.dove/install/transactions/research-${crypto.randomUUID()}`;
  const temporary = `${transactionRoot}/staged`;
  const backup = `${transactionRoot}/backup`;
  const installExisted = anchor.exists(".dove/install");
  const transactionsExisted = anchor.exists(".dove/install/transactions");
  let previous = null;
  let promoted = false;
  let backedUp = false;
  let phase = "preparing";
  try {
    previous = currentFile(anchor, normalized);
    if (options.ifAbsent === true && previous) throw new Error(`${options.label ?? "Research record"} is immutable and already exists: ${normalized}.`);
    if (options.expectedContent !== undefined) {
      const expected = Buffer.isBuffer(options.expectedContent) ? options.expectedContent : Buffer.from(String(options.expectedContent));
      if (!previous || !previous.bytes.equals(expected)) throw new Error(`${options.label ?? "Research record"} changed before replacement: ${normalized}.`);
    }
    anchor.mkdir(transactionRoot, { recursive: true });
    anchor.writeNewFile(temporary, bytes, { mode: previous?.mode ?? options.mode ?? 0o600 });
    const parent = path.posix.dirname(normalized);
    if (parent !== ".") anchor.mkdir(parent, { recursive: true });
    phase = "promoting";
    if (previous) {
      anchor.rename(normalized, backup);
      backedUp = true;
    }
    anchor.rename(temporary, normalized);
    promoted = true;
    phase = "committed";
    if (backedUp) anchor.unlink(backup);
    phase = "cleanup";
    anchor.rmdir(transactionRoot);
    if (!transactionsExisted && anchor.readdir(".dove/install/transactions").length === 0) anchor.rmdir(".dove/install/transactions", { force: true });
    if (!installExisted && anchor.readdir(".dove/install").length === 0) anchor.rmdir(".dove/install", { force: true });
    return normalized;
  } catch (error) {
    if (phase === "committed" || phase === "cleanup") {
      throw new Error(`Atomic research write committed before post-commit cleanup failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
    try {
      if (promoted && anchor.exists(normalized)) anchor.unlink(normalized);
      if (backedUp && anchor.exists(backup)) anchor.rename(backup, normalized);
      if (anchor.exists(transactionRoot)) anchor.remove(transactionRoot, { recursive: true, force: true });
      if (!transactionsExisted && anchor.exists(".dove/install/transactions") && anchor.readdir(".dove/install/transactions").length === 0) anchor.rmdir(".dove/install/transactions", { force: true });
      if (!installExisted && anchor.exists(".dove/install") && anchor.readdir(".dove/install").length === 0) anchor.rmdir(".dove/install", { force: true });
    } catch (rollbackError) {
      throw new Error(`Atomic research write failed and rollback also failed: ${error instanceof Error ? error.message : String(error)}; rollback: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`, { cause: error });
    }
    throw error;
  } finally {
    anchor.close();
  }
}

export function writeResearchJsonAtomic(root, relativePath, value, options = {}) {
  return writeResearchFileAtomic(root, relativePath, jsonDocument(value), options);
}
