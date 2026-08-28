import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { openRootedFilesystem } from "./rooted-filesystem.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";

const RESEARCH_ROOT = ARTIFACT_PATHS.researchDocumentsDir;

export const RESEARCH_DEFAULT_PATHS = Object.freeze({
  root: RESEARCH_ROOT,
  overview: ARTIFACT_PATHS.researchOverview,
  missionsDirectory: `${RESEARCH_ROOT}/missions`,
  missionsSummary: `${RESEARCH_ROOT}/missions/MISSIONS.md`,
  experimentsDirectory: `${RESEARCH_ROOT}/experiments`,
  experimentsSummary: `${RESEARCH_ROOT}/experiments/EXPERIMENTS.md`,
  sourcesDirectory: `${RESEARCH_ROOT}/sources`,
  sourcesSummary: `${RESEARCH_ROOT}/sources/SOURCES.md`,
  reviewsDirectory: `${RESEARCH_ROOT}/reviews`,
  reviewsSummary: `${RESEARCH_ROOT}/reviews/REVIEWS.md`,
  claimsDirectory: `${RESEARCH_ROOT}/claims`,
  claimsSummary: `${RESEARCH_ROOT}/claims/CLAIMS.md`,
  lessonsDirectory: `${RESEARCH_ROOT}/lessons`,
  lessonsSummary: ARTIFACT_PATHS.researchLessons,
  decisionMaking: `${RESEARCH_ROOT}/lessons/decision-making.md`,
  researchMethod: `${RESEARCH_ROOT}/lessons/research-method.md`,
  experimentsAndEvidence: `${RESEARCH_ROOT}/lessons/experiments-and-evidence.md`,
  engineeringAndValidation: `${RESEARCH_ROOT}/lessons/engineering-and-validation.md`,
  writingAndReview: `${RESEARCH_ROOT}/lessons/writing-and-review.md`,
  collaborationAndEnvironment: `${RESEARCH_ROOT}/lessons/collaboration-and-environment.md`,
  importedLessons: `${RESEARCH_ROOT}/lessons/imported-lessons.md`
});

const RETIRED_RESEARCH_PATHS = Object.freeze({
  additionalLessons: `${RESEARCH_ROOT}/lessons/additional-lessons.md`,
  topLevelLessons: `${RESEARCH_ROOT}/LESSONS.md`
});

export const IMPORTED_LESSONS_LINK = "- [Imported legacy Lessons](imported-lessons.md)";

const SUMMARY_DOCUMENTS = Object.freeze([
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.overview,
    title: "# Research",
    blocks: Object.freeze([
      "This researcher-owned entry keeps the current research mainline, material progress, important conclusions and limits, linked work, and next priorities concise and recoverable."
    ]),
    navigationHeading: null,
    navigationLines: Object.freeze([])
  })
]);

export const RESEARCH_LESSON_TOPICS = Object.freeze([]);

function renderDocument({ title, blocks = [], navigationHeading = null, navigationLines = [] }) {
  const parts = [title, ...blocks];
  if (navigationLines.length > 0) parts.push(navigationHeading, navigationLines.join("\n"));
  return `${parts.join("\n\n")}\n`;
}

export const RESEARCH_DEFAULT_DOCUMENTS = Object.freeze(
  SUMMARY_DOCUMENTS.map((document) => Object.freeze({ path: document.path, content: renderDocument(document) }))
);

export const RESEARCH_DEFAULT_FILE_PATHS = Object.freeze(RESEARCH_DEFAULT_DOCUMENTS.map((document) => document.path));
export const RESEARCH_DEFAULT_DIRECTORY_PATHS = Object.freeze([
  RESEARCH_DEFAULT_PATHS.root
]);

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function canonicalRoot(root, fsOps) {
  const resolved = path.resolve(root);
  return typeof fsOps.realpathSync.native === "function" ? fsOps.realpathSync.native(resolved) : fsOps.realpathSync(resolved);
}

function decodeMarkdown(bytes, relativePath) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch (error) {
    throw new Error(`${relativePath} must contain valid UTF-8 Markdown.`, { cause: error });
  }
  if (text.includes("\0")) throw new Error(`${relativePath} contains null bytes.`);
  return text;
}

function absentState(relativePath) {
  return { relativePath, exists: false, type: "absent", bytes: null, text: null, sha256: null, mode: null };
}

function readFileState(anchor, relativePath, options = {}) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return absentState(relativePath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${relativePath} must be a regular file without symbolic links.`);
  const bytes = anchor.readFile(relativePath);
  return {
    relativePath,
    exists: true,
    type: "file",
    bytes,
    text: options.decode === false ? null : decodeMarkdown(bytes, relativePath),
    sha256: sha256(bytes),
    mode: stat.mode & 0o7777
  };
}

function assertRealDirectoryIfPresent(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) throw new Error(`${relativePath} must be a real directory.`);
  return stat !== null;
}

function expectedState(state) {
  return state.exists
    ? { exists: true, type: "file", sha256: state.sha256, mode: state.mode }
    : { exists: false, type: "absent", sha256: null, mode: null };
}

function exactLinePresent(text, line) {
  return text.split(/\r?\n/u).includes(line);
}

function exactMarkdownBlockPresent(text, block) {
  let offset = 0;
  while (offset <= text.length) {
    const index = text.indexOf(block, offset);
    if (index === -1) return false;
    const end = index + block.length;
    const startsAtLineBoundary = index === 0 || (index === 1 && text[0] === "﻿") || text[index - 1] === "\n";
    const endsAtLineBoundary = end === text.length || text[end] === "\n" || text.startsWith("\r\n", end);
    if (startsAtLineBoundary && endsAtLineBoundary) return true;
    offset = index + 1;
  }
  return false;
}

function appendSeparator(text) {
  if (!text) return "";
  if (text.endsWith("\n\n")) return "";
  if (text.endsWith("\n")) return "\n";
  return "\n\n";
}

function appendByteSeparator(bytes) {
  if (bytes.length === 0) return Buffer.alloc(0);
  if (bytes.subarray(-4).equals(Buffer.from("\r\n\r\n")) || bytes.subarray(-2).equals(Buffer.from("\n\n"))) return Buffer.alloc(0);
  if (bytes.subarray(-2).equals(Buffer.from("\r\n"))) return Buffer.from("\r\n");
  if (bytes.at(-1) === 0x0a) return Buffer.from("\n");
  return Buffer.from("\n\n");
}

export function appendExactMarkdownBlocks(original, blocks) {
  let result = String(original);
  for (const raw of blocks) {
    const block = String(raw).trimEnd();
    if (!block || exactMarkdownBlockPresent(result, block)) continue;
    result += `${appendSeparator(result)}${block}\n`;
  }
  return result;
}

export function appendExactMarkdownBytes(original, addition) {
  const existing = Buffer.isBuffer(original) ? Buffer.from(original) : Buffer.from(original ?? "");
  const appended = Buffer.isBuffer(addition) ? Buffer.from(addition) : Buffer.from(addition ?? "");
  if (appended.length === 0 || existing.indexOf(appended) !== -1) return existing;
  return Buffer.concat([existing, appendByteSeparator(existing), appended]);
}

export function appendExactMarkdownLines(original, heading, lines) {
  const missing = lines.filter((line) => !exactLinePresent(original, line));
  if (missing.length === 0) return original;
  const parts = [];
  if (heading && !exactLinePresent(original, heading)) parts.push(heading);
  parts.push(...missing);
  return appendExactMarkdownBlocks(original, [parts.join("\n")]);
}

export function readResearchDefaultsSnapshot(root, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const replace = options.mode === "replace";
  const anchor = openRootedFilesystem(canonicalRoot(root, fsOps), { ...options, fsOps });
  for (const directoryPath of RESEARCH_DEFAULT_DIRECTORY_PATHS) assertRealDirectoryIfPresent(anchor, directoryPath);
  const states = new Map();
  const selectedPaths = new Set([
    ...RESEARCH_DEFAULT_FILE_PATHS,
    RESEARCH_DEFAULT_PATHS.missionsSummary,
    RESEARCH_DEFAULT_PATHS.experimentsSummary,
    RESEARCH_DEFAULT_PATHS.sourcesSummary,
    RESEARCH_DEFAULT_PATHS.reviewsSummary,
    RESEARCH_DEFAULT_PATHS.claimsSummary,
    RESEARCH_DEFAULT_PATHS.lessonsSummary,
    RETIRED_RESEARCH_PATHS.additionalLessons,
    RESEARCH_DEFAULT_PATHS.importedLessons,
    RETIRED_RESEARCH_PATHS.topLevelLessons
  ]);
  for (const relativePath of selectedPaths) {
    const opaque = relativePath === RETIRED_RESEARCH_PATHS.additionalLessons
      || relativePath === RESEARCH_DEFAULT_PATHS.importedLessons
      || relativePath === RETIRED_RESEARCH_PATHS.topLevelLessons;
    states.set(relativePath, readFileState(anchor, relativePath, { decode: !replace && !opaque }));
  }
  return { states };
}

function stateFor(snapshot, relativePath) {
  return snapshot.states.get(relativePath) ?? absentState(relativePath);
}

function setWrite(writes, snapshot, relativePath, content) {
  const bytes = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(String(content), "utf8");
  const state = stateFor(snapshot, relativePath);
  if (state.exists && state.bytes.equals(bytes)) {
    writes.delete(relativePath);
    return;
  }
  writes.set(relativePath, bytes);
}

function currentText(snapshot, writes, relativePath) {
  if (writes.has(relativePath)) return decodeMarkdown(writes.get(relativePath), relativePath);
  const state = stateFor(snapshot, relativePath);
  return state.exists ? state.text : null;
}

function planSummaryDocument(snapshot, writes, document) {
  const state = stateFor(snapshot, document.path);
  if (!state.exists) {
    setWrite(writes, snapshot, document.path, renderDocument(document));
    return;
  }
  const content = appendExactMarkdownLines(currentText(snapshot, writes, document.path), document.navigationHeading, document.navigationLines);
  setWrite(writes, snapshot, document.path, content);
}

export function planResearchDefaults(snapshot, options = {}) {
  if (!snapshot || !(snapshot.states instanceof Map)) {
    throw new Error("Research defaults planning requires a research Markdown snapshot.");
  }
  const mode = options.mode ?? "sync";
  if (!new Set(["sync", "replace"]).has(mode)) throw new Error(`Unsupported research defaults planning mode: ${mode}.`);
  const writes = new Map();
  const deletes = new Set();

  for (const document of SUMMARY_DOCUMENTS) {
    if (mode === "replace") setWrite(writes, snapshot, document.path, renderDocument(document));
    else planSummaryDocument(snapshot, writes, document);
  }

  return { writes, deletes };
}

export function researchDefaultTransactionEntries(root, snapshot, plan, options = {}) {
  const label = options.label ?? "Dove research bootstrap";
  return [
    ...[...plan.writes.entries()].map(([relativePath, content]) => ({
      root,
      relativePath,
      content,
      force: true,
      expectedState: expectedState(stateFor(snapshot, relativePath)),
      label: `${label} ${relativePath}`
    })),
    ...[...plan.deletes].map((relativePath) => ({
      root,
      relativePath,
      delete: true,
      force: true,
      expectedState: expectedState(stateFor(snapshot, relativePath)),
      label: `Retired Dove research document ${relativePath}`
    }))
  ];
}

export function prepareResearchDefaults(root, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const canonical = canonicalRoot(root, fsOps);
  const mode = options.mode ?? "sync";
  const snapshot = readResearchDefaultsSnapshot(canonical, { ...options, fsOps, mode });
  const plan = planResearchDefaults(snapshot, { mode });
  const entries = researchDefaultTransactionEntries(canonical, snapshot, plan, { label: options.label });
  return {
    root: canonical,
    snapshot,
    plan,
    entries,
    changedPaths: entries.map((entry) => entry.relativePath)
  };
}
