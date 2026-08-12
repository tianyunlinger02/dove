import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { openAnchoredFilesystem } from "./anchored-filesystem.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";

function canonicalRoot(root, fsOps) {
  const resolved = path.resolve(root);
  return typeof fsOps.realpathSync.native === "function"
    ? fsOps.realpathSync.native(resolved)
    : fsOps.realpathSync(resolved);
}

function normalizedPath(value) {
  const supplied = String(value).replace(/\\/gu, "/");
  const normalized = path.posix.normalize(supplied);
  if (!supplied || supplied !== normalized || path.posix.isAbsolute(normalized) || normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("\0")) {
    throw new Error("Dove project state path must stay normalized inside the project.");
  }
  return normalized;
}

export function inspectProjectStateFile(root, relativePath, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const normalized = normalizedPath(relativePath);
  const anchor = openAnchoredFilesystem(canonicalRoot(root, fsOps), { ...options, fsOps });
  try {
    const current = currentFile(anchor, normalized);
    if (!current) return { content: null, state: { exists: false, type: "absent", sha256: null, mode: null } };
    let content;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(current.bytes);
    } catch (error) {
      throw new Error(`${normalized} must contain valid UTF-8 text.`, { cause: error });
    }
    return {
      content,
      state: {
        exists: true,
        type: "file",
        sha256: crypto.createHash("sha256").update(current.bytes).digest("hex"),
        mode: current.mode
      }
    };
  } finally {
    anchor.close();
  }
}

function currentFile(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return null;
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`Dove project state target must be absent or a regular file: ${relativePath}.`);
  }
  return { bytes: anchor.readFile(relativePath), mode: stat.mode & 0o7777 };
}

export function exactTimestamp(value, label = "Timestamp") {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  }
  return value;
}

export function readProjectStateText(root, relativePath, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const normalized = normalizedPath(relativePath);
  const anchor = openAnchoredFilesystem(canonicalRoot(root, fsOps), { ...options, fsOps });
  try {
    const current = currentFile(anchor, normalized);
    if (!current) return options.fallback ?? null;
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(current.bytes);
    } catch (error) {
      throw new Error(`${normalized} must contain valid UTF-8 text.`, { cause: error });
    }
  } finally {
    anchor.close();
  }
}

export function readProjectStateJson(root, relativePath, options = {}) {
  const text = readProjectStateText(root, relativePath, options);
  if (text === null) return options.fallback ?? null;
  return parseJsonWithoutDuplicateKeys(text, options.label ?? relativePath);
}

export function writeProjectStateJsonAtomic(root, relativePath, value, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const normalized = normalizedPath(relativePath);
  const anchor = openAnchoredFilesystem(canonicalRoot(root, fsOps), { ...options, fsOps });
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  const expected = options.expectedContent === undefined
    ? null
    : Buffer.from(String(options.expectedContent));
  const parent = path.posix.dirname(normalized);
  const temporary = path.posix.join(parent, `.${path.posix.basename(normalized)}.${crypto.randomUUID()}.tmp`);
  let staged = false;
  try {
    if (parent !== ".") anchor.mkdir(parent, { recursive: true });
    const previous = currentFile(anchor, normalized);
    if (expected && (!previous || !previous.bytes.equals(expected))) {
      throw new Error(`${options.label ?? "Dove project state"} changed before replacement: ${normalized}.`);
    }
    anchor.writeNewFile(temporary, bytes, { mode: previous?.mode ?? options.mode ?? 0o600 });
    staged = true;
    if (expected) {
      const current = currentFile(anchor, normalized);
      if (!current || !current.bytes.equals(expected)) {
        throw new Error(`${options.label ?? "Dove project state"} changed before replacement: ${normalized}.`);
      }
    }
    anchor.rename(temporary, normalized);
    staged = false;
    return normalized;
  } catch (error) {
    if (staged) {
      try {
        anchor.unlink(temporary, { force: true });
      } catch (cleanupError) {
        throw new Error(
          `Dove project state write failed and temporary-file cleanup also failed: ${error instanceof Error ? error.message : String(error)}; cleanup: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
          { cause: error }
        );
      }
    }
    throw error;
  } finally {
    anchor.close();
  }
}
