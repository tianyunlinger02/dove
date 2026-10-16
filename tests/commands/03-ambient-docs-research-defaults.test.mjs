import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  DOVE_RESEARCH_CORRECTION_RECORDING,
  DOVE_RESEARCH_EVALUATION,
  DOVE_RESEARCH_ROUND_RECORDS,
  renderDoveResearchQualityReference
} from "../../src/core/dove-research-contract.mjs";
import {
  RESEARCH_DEFAULT_DIRECTORY_PATHS,
  RESEARCH_DEFAULT_DOCUMENTS,
  RESEARCH_DEFAULT_PATHS
} from "../../src/core/research-defaults.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

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

test("Trellis specs match their installed Markdown templates", () => {
  for (const layer of ["frontend", "guides"]) {
    const source = path.join(ROOT, ".trellis/spec", layer);
    const template = path.join(ROOT, "src/templates/markdown/spec", layer);
    const names = (directory) => fs.readdirSync(directory).filter((name) => name.endsWith(".md")).sort();
    assert.deepEqual(names(template), names(source));
    for (const name of names(source)) {
      assert.ok(
        fs.readFileSync(path.join(source, name)).equals(fs.readFileSync(path.join(template, name))),
        `${layer}/${name}`
      );
    }
  }
});
