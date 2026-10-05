import fs from "node:fs";

import { openRootedFilesystem } from "./rooted-filesystem.mjs";
import { RESEARCH_DEFAULT_PATHS } from "./research-defaults.mjs";

export const RESEARCH_DOCUMENT_PATHS = Object.freeze({ ...RESEARCH_DEFAULT_PATHS });

function readableMarkdown(root, relativePath) {
  const stat = root.tryLstat(relativePath);
  if (!stat) return null;
  const text = new TextDecoder("utf-8", { fatal: true }).decode(root.readFile(relativePath));
  if (text.includes("\0")) throw new Error(`${relativePath} contains null bytes.`);
  return { path: relativePath };
}

export function inspectResearchDocuments(project, options = {}) {
  const base = { root: RESEARCH_DOCUMENT_PATHS.root, identity: null, evaluation: null, rounds: null, overview: null };
  try {
    const root = openRootedFilesystem(project, { fsOps: options.fsOps ?? fs });
    const directory = root.tryLstat(RESEARCH_DOCUMENT_PATHS.root);
    if (!directory) return { ...base, healthy: true, state: "absent" };
    if (directory.isSymbolicLink() || !directory.isDirectory()) throw new Error(`${base.root} must be a real directory.`);
    const rounds = root.tryLstat(RESEARCH_DOCUMENT_PATHS.roundsDirectory);
    if (rounds && (rounds.isSymbolicLink() || !rounds.isDirectory())) throw new Error(`${RESEARCH_DOCUMENT_PATHS.roundsDirectory} must be a real directory.`);
    return {
      ...base,
      healthy: true,
      state: "current",
      identity: readableMarkdown(root, RESEARCH_DOCUMENT_PATHS.identity),
      evaluation: readableMarkdown(root, RESEARCH_DOCUMENT_PATHS.evaluation),
      rounds: rounds ? { path: RESEARCH_DOCUMENT_PATHS.roundsDirectory } : null,
      overview: readableMarkdown(root, RESEARCH_DOCUMENT_PATHS.overview)
    };
  } catch (error) {
    return { ...base, healthy: false, state: "invalid", error: error instanceof Error ? error.message : String(error) };
  }
}
