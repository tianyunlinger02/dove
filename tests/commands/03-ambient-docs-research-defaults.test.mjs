import assert from "node:assert/strict";
import test from "node:test";

import {
  RESEARCH_DEFAULT_DIRECTORY_PATHS,
  RESEARCH_DEFAULT_DOCUMENTS,
  RESEARCH_DEFAULT_PATHS
} from "../../src/core/research-defaults.mjs";

test("research bootstrap indexes researcher-owned records without prepopulating research state", () => {
  assert.deepEqual(RESEARCH_DEFAULT_DOCUMENTS.map(({ path: documentPath }) => documentPath), [RESEARCH_DEFAULT_PATHS.overview]);
  assert.deepEqual(RESEARCH_DEFAULT_DIRECTORY_PATHS, [RESEARCH_DEFAULT_PATHS.root]);
  assert.equal(RESEARCH_DEFAULT_PATHS.identity, ".dove/research/IDENTITY.md");
  assert.equal(RESEARCH_DEFAULT_PATHS.evaluation, ".dove/research/EVAL.md");
  assert.equal(RESEARCH_DEFAULT_PATHS.roundsDirectory, ".dove/research/rounds");
  const overview = RESEARCH_DEFAULT_DOCUMENTS[0].content;
  for (const name of ["IDENTITY.md", "EVAL.md", "rounds/", "MENTOR_NOTES.md"]) assert.ok(overview.includes(name));
  assert.match(overview, /选题先读标准.*候选交用户选主线.*不先实现方法/u);
  assert.match(overview, /主线确认后先搭真实评测.*三段论证交用户看.*连续两轮无科研结果就停下问用户/u);
  assert.match(overview, /短历史索引.*旧 missions、experiments 和 claims 留在原处/u);
});
