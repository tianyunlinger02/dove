import fs from "node:fs";
import path from "node:path";

import { openRootedFilesystem } from "./rooted-filesystem.mjs";
import { RESEARCH_DEFAULT_PATHS } from "./research-defaults.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";

const V2_FORMAT_PATH = ".dove/format.json";
const V2_FORMAT = "dove-research-v2";

export const RESEARCH_DOCUMENT_PATHS = Object.freeze({ ...RESEARCH_DEFAULT_PATHS });

const SUMMARY_ENTRIES = Object.freeze([
  Object.freeze(["missions", RESEARCH_DOCUMENT_PATHS.missionsDirectory, RESEARCH_DOCUMENT_PATHS.missionsSummary]),
  Object.freeze(["experiments", RESEARCH_DOCUMENT_PATHS.experimentsDirectory, RESEARCH_DOCUMENT_PATHS.experimentsSummary]),
  Object.freeze(["sources", RESEARCH_DOCUMENT_PATHS.sourcesDirectory, RESEARCH_DOCUMENT_PATHS.sourcesSummary]),
  Object.freeze(["reviews", RESEARCH_DOCUMENT_PATHS.reviewsDirectory, RESEARCH_DOCUMENT_PATHS.reviewsSummary]),
  Object.freeze(["claims", RESEARCH_DOCUMENT_PATHS.claimsDirectory, RESEARCH_DOCUMENT_PATHS.claimsSummary]),
  Object.freeze(["lessons", RESEARCH_DOCUMENT_PATHS.lessonsDirectory, RESEARCH_DOCUMENT_PATHS.lessonsSummary])
]);

function messageFor(error) {
  return error instanceof Error ? error.message : String(error);
}

function canonicalRoot(root, fsOps) {
  const resolved = path.resolve(root);
  return typeof fsOps.realpathSync.native === "function"
    ? fsOps.realpathSync.native(resolved)
    : fsOps.realpathSync(resolved);
}

function readMarkdown(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return null;
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${relativePath} must be a regular file without symbolic links.`);
  }
  let markdown;
  try {
    markdown = new TextDecoder("utf-8", { fatal: true }).decode(anchor.readFile(relativePath));
  } catch (error) {
    throw new Error(`${relativePath} must contain valid UTF-8 Markdown.`, { cause: error });
  }
  if (markdown.includes("\0")) throw new Error(`${relativePath} contains null bytes.`);
  return markdown;
}

function inspectDirectory(anchor, relativePath) {
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return false;
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`${relativePath} must be a real directory.`);
  return true;
}

function emptyResult(state, fields = {}) {
  return {
    healthy: true,
    state,
    root: RESEARCH_DOCUMENT_PATHS.root,
    overview: null,
    summaries: {
      missions: null,
      experiments: null,
      sources: null,
      reviews: null,
      claims: null,
      lessons: null
    },
    missingSummaries: SUMMARY_ENTRIES.map(([, , summaryPath]) => summaryPath),
    ...fields
  };
}

export function inspectResearchDocuments(root, options = {}) {
  const fsOps = options.fsOps ?? fs;
  let anchor;
  try {
    anchor = openRootedFilesystem(canonicalRoot(root, fsOps), { ...options, fsOps });
    const directory = anchor.tryLstat(RESEARCH_DOCUMENT_PATHS.root);
    if (!directory) {
      const format = anchor.tryLstat(V2_FORMAT_PATH);
      if (format) {
        if (format.isSymbolicLink() || !format.isFile()) {
          throw new Error(`${V2_FORMAT_PATH} must be a regular file without symbolic links.`);
        }
        const marker = parseJsonWithoutDuplicateKeys(
          new TextDecoder("utf-8", { fatal: true }).decode(anchor.readFile(V2_FORMAT_PATH)),
          V2_FORMAT_PATH
        );
        if (marker?.format === V2_FORMAT && Object.keys(marker).length === 1) {
          return emptyResult("previous-research-format", { exportCommand: "dove export-research" });
        }
      }
      return emptyResult("absent");
    }
    if (directory.isSymbolicLink() || !directory.isDirectory()) {
      throw new Error(`${RESEARCH_DOCUMENT_PATHS.root} must be a real directory.`);
    }

    const overview = readMarkdown(anchor, RESEARCH_DOCUMENT_PATHS.overview);
    const summaries = {};
    const missingSummaries = [];
    for (const [name, directoryPath, summaryPath] of SUMMARY_ENTRIES) {
      const directoryExists = inspectDirectory(anchor, directoryPath);
      const markdown = directoryExists ? readMarkdown(anchor, summaryPath) : null;
      summaries[name] = markdown === null ? null : { path: summaryPath };
      if (markdown === null) missingSummaries.push(summaryPath);
    }
    return {
      healthy: true,
      state: "current",
      root: RESEARCH_DOCUMENT_PATHS.root,
      overview: overview === null ? null : { path: RESEARCH_DOCUMENT_PATHS.overview },
      summaries,
      missingSummaries
    };
  } catch (error) {
    return {
      healthy: false,
      state: "invalid",
      root: RESEARCH_DOCUMENT_PATHS.root,
      overview: null,
      summaries: {
        missions: null,
        experiments: null,
        sources: null,
        reviews: null,
        claims: null,
        lessons: null
      },
      missingSummaries: [],
      error: messageFor(error)
    };
  }
}
