import fs from "node:fs";

import { openRootedFilesystem } from "./rooted-filesystem.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { DOVE_IDENTITY_CARD_PATH } from "./identity-card.mjs";

const RESEARCH_ROOT = ARTIFACT_PATHS.researchDocumentsDir;

export const RESEARCH_DEFAULT_PATHS = Object.freeze({
  root: RESEARCH_ROOT,
  overview: ARTIFACT_PATHS.researchOverview,
  identity: DOVE_IDENTITY_CARD_PATH,
  evaluation: `${RESEARCH_ROOT}/EVAL.md`,
  roundsDirectory: `${RESEARCH_ROOT}/rounds`,
  lessonsDirectory: `${RESEARCH_ROOT}/lessons`,
  lessonsSummary: ARTIFACT_PATHS.researchLessons
});

export const RESEARCH_DEFAULT_DOCUMENTS = Object.freeze([
  Object.freeze({
    path: RESEARCH_DEFAULT_PATHS.overview,
    content: "# 研究\n\n当前研究用 `IDENTITY.md`、`EVAL.md` 和 `rounds/` 接续。选题先读标准，给有依据的候选交用户选主线，不先实现方法。主线确认后先搭真实评测；新方法前三段论证交用户看，连续两轮无科研结果就停下问用户。导师自写 `MENTOR_NOTES.md`。本文件只作短历史索引，旧 missions、experiments 和 claims 留在原处。\n"
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
