import fs from "node:fs";
import path from "node:path";

import { openAnchoredFilesystem } from "./anchored-filesystem.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";

const V2_FORMAT_PATH = ".dove/format.json";
const V2_FORMAT = "dove-research-v2";

export const RESEARCH_DOCUMENT_PATHS = Object.freeze({
  root: ARTIFACT_PATHS.researchDocumentsDir,
  overview: ARTIFACT_PATHS.researchOverview,
  lessons: ARTIFACT_PATHS.researchLessons,
  missions: `${ARTIFACT_PATHS.researchDocumentsDir}/missions`,
  experiments: `${ARTIFACT_PATHS.researchDocumentsDir}/experiments`,
  sources: `${ARTIFACT_PATHS.researchDocumentsDir}/sources`,
  reviews: `${ARTIFACT_PATHS.researchDocumentsDir}/reviews`,
  claims: `${ARTIFACT_PATHS.researchDocumentsDir}/claims`
});

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

export function inspectResearchDocuments(root, options = {}) {
  const fsOps = options.fsOps ?? fs;
  let anchor;
  try {
    anchor = openAnchoredFilesystem(canonicalRoot(root, fsOps), { ...options, fsOps });
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
          return {
            healthy: true,
            state: "previous-research-format",
            root: RESEARCH_DOCUMENT_PATHS.root,
            overview: null,
            lessons: null,
            exportCommand: "dove export-research"
          };
        }
      }
      return {
        healthy: true,
        state: "absent",
        root: RESEARCH_DOCUMENT_PATHS.root,
        overview: null,
        lessons: null
      };
    }
    if (directory.isSymbolicLink() || !directory.isDirectory()) {
      throw new Error(`${RESEARCH_DOCUMENT_PATHS.root} must be a real directory.`);
    }
    const overview = readMarkdown(anchor, RESEARCH_DOCUMENT_PATHS.overview);
    const lessons = readMarkdown(anchor, RESEARCH_DOCUMENT_PATHS.lessons);
    return {
      healthy: true,
      state: "current",
      root: RESEARCH_DOCUMENT_PATHS.root,
      overview: overview === null ? null : { path: RESEARCH_DOCUMENT_PATHS.overview },
      lessons: lessons === null ? null : { path: RESEARCH_DOCUMENT_PATHS.lessons }
    };
  } catch (error) {
    return {
      healthy: false,
      state: "invalid",
      root: RESEARCH_DOCUMENT_PATHS.root,
      overview: null,
      lessons: null,
      error: messageFor(error)
    };
  } finally {
    anchor?.close();
  }
}
