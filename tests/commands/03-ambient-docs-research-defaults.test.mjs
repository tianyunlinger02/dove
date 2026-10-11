import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { renderDoveAuthorStanceSection } from "../../src/core/dove-agent-persona.mjs";
import { DOVE_RESEARCH_ROUND_RECORDS } from "../../src/core/dove-research-contract.mjs";
import {
  RESEARCH_DEFAULT_DIRECTORY_PATHS,
  RESEARCH_DEFAULT_DOCUMENTS,
  RESEARCH_DEFAULT_PATHS
} from "../../src/core/research-defaults.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("research bootstrap indexes the three core records without prepopulating research state", () => {
  assert.deepEqual(RESEARCH_DEFAULT_DOCUMENTS.map(({ path: documentPath }) => documentPath), [RESEARCH_DEFAULT_PATHS.overview]);
  assert.deepEqual(RESEARCH_DEFAULT_DIRECTORY_PATHS, [RESEARCH_DEFAULT_PATHS.root]);
  assert.equal(RESEARCH_DEFAULT_PATHS.identity, ".dove/research/IDENTITY.md");
  assert.equal(RESEARCH_DEFAULT_PATHS.evaluation, ".dove/research/EVAL.md");
  assert.equal(RESEARCH_DEFAULT_PATHS.roundsDirectory, ".dove/research/rounds");
  const overview = RESEARCH_DEFAULT_DOCUMENTS[0].content;
  for (const name of ["IDENTITY.md", "EVAL.md", "rounds/"]) assert.ok(overview.includes(name));
  assert.match(overview, /Confirm inception.*user's originals first.*then.*mentor.*evaluation/iu);
  assert.match(overview, /short index.*history/iu);
  assert.doesNotMatch(overview, /^Mainline:/mu);
});

test("new round records keep human briefs attributable and old histories in place", () => {
  assert.match(DOVE_RESEARCH_ROUND_RECORDS, /IDENTITY\.md, EVAL\.md and rounds\/NNN-brief\.md plus NNN-result\.md/u);
  assert.match(DOVE_RESEARCH_ROUND_RECORDS, /Author: mentor \/ user \/ external/u);
  assert.match(DOVE_RESEARCH_ROUND_RECORDS, /method version and dated user sources/iu);
  assert.match(DOVE_RESEARCH_ROUND_RECORDS, /priority is user > external > mentor.*direct user tasks/iu);
  assert.match(DOVE_RESEARCH_ROUND_RECORDS, /one code version.*changes.*new version and full rerun/iu);
  assert.match(DOVE_RESEARCH_ROUND_RECORDS, /Replaced briefs.*author and reason/iu);
  assert.match(DOVE_RESEARCH_ROUND_RECORDS, /changed files, values, prediction versus actual/iu);
  assert.match(DOVE_RESEARCH_ROUND_RECORDS, /对本轮说明的反驳\/事实更正.*mentor answers that first/iu);
  assert.match(DOVE_RESEARCH_ROUND_RECORDS, /missions\/, experiments\/ and claims\/.*without migration or new entries/iu);
  assert.match(renderDoveAuthorStanceSection(), /Preserve reusable Lessons when useful, not routine progress or a substitute for repair/iu);
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
