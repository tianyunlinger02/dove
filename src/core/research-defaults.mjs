import fs from "node:fs";

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
  lessonsSummary: ARTIFACT_PATHS.researchLessons
});

export const RESEARCH_DEFAULT_DOCUMENTS = Object.freeze([
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.overview,
    content: "# Research\n\nThis researcher-owned entry keeps the current research mainline, material progress, important conclusions and limits, linked work, and next priorities concise and recoverable.\n"
  })
]);

export const RESEARCH_DEFAULT_DIRECTORY_PATHS = Object.freeze([RESEARCH_ROOT]);

export function prepareResearchDefaults(root, options = {}) {
  const anchor = openRootedFilesystem(root, { fsOps: options.fsOps ?? fs });
  const directory = anchor.tryLstat(RESEARCH_ROOT);
  if (directory && (directory.isSymbolicLink() || !directory.isDirectory())) {
    throw new Error(`${RESEARCH_ROOT} must be a real directory.`);
  }
  // An existing research directory belongs entirely to the researcher. Do not
  // read its children, fill missing documents, or normalize existing content.
  const entries = directory ? [] : RESEARCH_DEFAULT_DOCUMENTS.map(({ path: relativePath, content }) => ({
    root,
    relativePath,
    content,
    force: false,
    expectedState: { exists: false, type: "absent", sha256: null, mode: null },
    label: `Dove research bootstrap ${relativePath}`
  }));
  return { entries, changedPaths: entries.map((entry) => entry.relativePath) };
}
