import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { openRootedFilesystem } from "./rooted-filesystem.mjs";

export const REVIEW_MATERIAL_DENY_PATTERNS = Object.freeze([
  /(?:^|\/)CLAUDE\.md$/u,
  /(?:^|\/)\.git(?:\/|$)/u,
  /(?:^|\/)\.claude(?:\/|$)/u,
  /(?:^|\/)\.dsh(?:\/|$)/u,
  /(?:^|\/)\.mcp\.json$/u,
  /(?:^|\/)\.dove-package(?:\/|$)/u,
  /(?:^|\/)\.dove\/install(?:\/|$)/u,
  /(?:^|\/)\.dove\/research(?:\/|$)/u,
  /(?:^|\/)\.dove\/reviews(?:\/|$)/u,
  /(?:^|\/)\.dove\/archive(?:\/|$)/u,
  /(?:^|\/)\.dove(?:\/|$)/u
]);

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function exactIsoTimestamp(value = new Date()) {
  const timestamp = value instanceof Date ? value.toISOString() : value;
  if (typeof timestamp !== "string" || new Date(timestamp).toISOString() !== timestamp) throw new Error("Dove review snapshot timestamp must be an exact ISO timestamp.");
  return timestamp;
}

export const REVIEW_IDENTITY_MATERIAL_PATH = ".dove/research/IDENTITY.md";

export function normalizeReviewScope(scope = "paper") {
  if (!["paper", "route", "design"].includes(scope)) throw new Error("Dove review scope must be paper, route, or design.");
  return scope;
}

export function isReviewMaterialDenied(relativePath, scope = "paper") {
  if ((scope === "route" || scope === "design") && relativePath === REVIEW_IDENTITY_MATERIAL_PATH) return false;
  return REVIEW_MATERIAL_DENY_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function normalizeMaterialPath(projectFs, rawPath, scope) {
  const input = typeof rawPath === "string" ? rawPath : "";
  const normalized = projectFs.normalize(input, "Dove review material path");
  if (isReviewMaterialDenied(normalized, scope)) {
    throw new Error(`Dove review material is private or Dove-owned and must not be copied: ${normalized}`);
  }
  return normalized;
}

function canonicalProjectFile(projectFs, rawPath, scope) {
  const relativePath = normalizeMaterialPath(projectFs, rawPath, scope);
  const stat = projectFs.inspectRegularFile(relativePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Dove review material must be a regular non-symlink file: ${relativePath}`);
  const absolutePath = projectFs.displayPath(relativePath);
  const canonical = projectFs.fsOps.realpathSync.native?.(absolutePath) ?? projectFs.fsOps.realpathSync(absolutePath);
  const relative = path.relative(projectFs.root, canonical);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`Dove review material must stay inside the initialized project: ${relativePath}`);
  if (relative.split(path.sep).join("/") !== relativePath) throw new Error(`Dove review material path must be canonical project-relative form: ${rawPath}`);
  return { relativePath, absolutePath };
}

export function normalizeReviewMaterialList(materials, options = {}) {
  if (!Array.isArray(materials) || materials.length === 0) throw new Error("dove review requires at least one --material <path>.");
  const projectFs = openRootedFilesystem(options.projectRoot, { fsOps: options.fsOps ?? fs });
  const scope = normalizeReviewScope(options.scope);
  const byPath = new Map();
  for (const material of materials) {
    const { relativePath } = canonicalProjectFile(projectFs, material, scope);
    if (!byPath.has(relativePath)) byPath.set(relativePath, relativePath);
  }
  return [...byPath.keys()].sort();
}

export function createReviewSnapshot(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const projectRoot = fsOps.realpathSync.native?.(path.resolve(options.projectRoot)) ?? fsOps.realpathSync(path.resolve(options.projectRoot));
  const projectFs = openRootedFilesystem(projectRoot, { fsOps });
  const scope = normalizeReviewScope(options.scope);
  const selectedPaths = normalizeReviewMaterialList(options.materials, { projectRoot, fsOps, scope });
  const materialPaths = scope === "paper" ? selectedPaths
    : normalizeReviewMaterialList([...selectedPaths, REVIEW_IDENTITY_MATERIAL_PATH], { projectRoot, fsOps, scope });
  const files = [];
  const manifest = [];
  for (const materialPath of materialPaths) {
    const { relativePath } = canonicalProjectFile(projectFs, materialPath, scope);
    const bytes = projectFs.readFile(relativePath);
    const digest = sha256(bytes);
    manifest.push({ path: relativePath, size: bytes.length, sha256: digest });
    files.push({ path: relativePath, bytes });
  }
  return {
    snapshot: {
      schema: "dove.review.snapshot.v1",
      reviewId: options.reviewId,
      scope,
      round: options.round,
      projectRoot,
      venue: options.venue ?? null,
      createdAt: exactIsoTimestamp(options.now),
      materials: manifest
    },
    files
  };
}
