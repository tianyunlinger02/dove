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
  assert.match(overview, /user confirms Mainline.*standards.*parallel candidates.*user to choose before method implementation/iu);
  assert.match(overview, /short history index.*leave existing.*in place/iu);
});
