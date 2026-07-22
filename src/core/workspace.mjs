import fs from "node:fs";
import path from "node:path";

import { GOVERNANCE_EXEMPT_MUTATIONS, GOVERNANCE_GUARDED_MUTATIONS } from "./schema.mjs";
import { currentMutationContext } from "./mutation-backend.mjs";

export function nowIso() {
  return new Date().toISOString();
}

export function resolvePath(root, relativePath) {
  return path.join(root, relativePath);
}

function cloneFallback(fallback) {
  return typeof fallback === "function" ? fallback() : structuredClone(fallback);
}

function requireMutationContext(root, operation) {
  const context = currentMutationContext(root);
  if (!context) throw new Error(`${operation} requires an active MutationContext.`);
  return context;
}

export function readJson(root, relativePath, fallback) {
  const context = currentMutationContext(root);
  if (context) return context.readJson(relativePath, fallback);
  const fullPath = resolvePath(root, relativePath);
  if (!fs.existsSync(fullPath)) return cloneFallback(fallback);
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    throw new Error(`Malformed JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function readBuffer(root, relativePath, fallback = null) {
  const context = currentMutationContext(root);
  if (context) return context.readBuffer(relativePath, fallback);
  const fullPath = resolvePath(root, relativePath);
  if (!fs.existsSync(fullPath)) return typeof fallback === "function" ? fallback() : fallback === null ? null : Buffer.from(fallback);
  return Buffer.from(fs.readFileSync(fullPath));
}

export function readFileSnapshot(root, relativePath) {
  const context = currentMutationContext(root);
  if (context) return context.readFileSnapshot(relativePath);
  const fullPath = resolvePath(root, relativePath);
  if (!fs.existsSync(fullPath)) return { relativePath, exists: false, type: "absent", mode: null, sha256: null, buffer: null };
  const stat = fs.lstatSync(fullPath);
  if (!stat.isFile()) throw new Error(`Workspace read target must be a regular file: ${relativePath}`);
  const buffer = Buffer.from(fs.readFileSync(fullPath));
  return { relativePath, exists: true, type: "file", mode: stat.mode & 0o7777, sha256: null, buffer };
}

export function readDirectory(root, relativePath) {
  const context = currentMutationContext(root);
  if (context) return context.readDirectory(relativePath);
  const fullPath = resolvePath(root, relativePath);
  if (!fs.existsSync(fullPath)) return [];
  return fs.readdirSync(fullPath, { withFileTypes: true }).map((entry) => ({ name: entry.name, type: entry.isFile() ? "file" : entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "other" })).sort((left, right) => left.name.localeCompare(right.name));
}

export function readText(root, relativePath, fallback = "") {
  const buffer = readBuffer(root, relativePath, null);
  return buffer === null ? fallback : buffer.toString("utf8");
}

export function writeJson(root, relativePath, value) {
  return requireMutationContext(root, "writeJson").writeJson(relativePath, value);
}

export function writeText(root, relativePath, content) {
  return requireMutationContext(root, "writeText").writeText(relativePath, content);
}

export function writeBinary(root, relativePath, content) {
  return requireMutationContext(root, "writeBinary").writeBinary(relativePath, content);
}

export function assertGovernanceMutationRegistered(actionId, expectedMode) {
  const guarded = new Set(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.id));
  const exempt = new Map(GOVERNANCE_EXEMPT_MUTATIONS.map((entry) => [entry.id, entry]));
  if (expectedMode === "guarded") {
    if (!guarded.has(actionId)) throw new Error(`Governance registry missing guarded mutation entry: ${actionId}`);
    return;
  }
  if (expectedMode === "exempt") {
    const entry = exempt.get(actionId);
    if (!entry) throw new Error(`Governance registry missing exempt mutation entry: ${actionId}`);
    if (entry.sunsetAt && entry.sunsetAt <= nowIso()) throw new Error(`Governance exempt entry expired: ${actionId}`);
    return;
  }
  throw new Error(`Unknown governance mutation mode: ${expectedMode}`);
}
