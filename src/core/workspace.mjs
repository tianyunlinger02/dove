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

export function readText(root, relativePath, fallback = "") {
  const context = currentMutationContext(root);
  if (context) return context.readText(relativePath, fallback);
  const fullPath = resolvePath(root, relativePath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : fallback;
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
