import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { renderDoveAuthorStanceSection } from "../../src/core/dove-agent-persona.mjs";
import {
  RESEARCH_DEFAULT_DIRECTORY_PATHS,
  RESEARCH_DEFAULT_DOCUMENTS,
  RESEARCH_DEFAULT_PATHS
} from "../../src/core/research-defaults.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("research bootstrap remains a minimal researcher-owned overview", () => {
  assert.deepEqual(RESEARCH_DEFAULT_DOCUMENTS.map(({ path: documentPath }) => documentPath), [
    RESEARCH_DEFAULT_PATHS.overview
  ]);
  assert.deepEqual(RESEARCH_DEFAULT_DIRECTORY_PATHS, [RESEARCH_DEFAULT_PATHS.root]);
  assert.match(RESEARCH_DEFAULT_DOCUMENTS[0].content, /researcher-owned entry/iu);
});

test("author stance reads durable research context only when decision-relevant", () => {
  const stance = renderDoveAuthorStanceSection();
  const overview = "`.dove/research/RESEARCH.md`";
  assert.equal(stance.split(overview).length - 1, 1);
  assert.match(stance, /If durable Dove context may change the current decision/iu);
  assert.match(stance, /only directly relevant/iu);
  assert.match(stance, /Lessons guide judgment, not supply research evidence/iu);
  assert.match(stance, /Do not scan the broad research tree/iu);
  assert.match(stance, /no research-tree prerequisite/iu);
  assert.match(stance, /agreed bounded deliverables/iu);
  assert.match(stance, /investment dependent on a scientific proposition/iu);
  assert.match(stance, /Complete genuine bounded/iu);
  assert.match(stance, /neither refuses nor expands/iu);
  assert.match(stance, /Stop investment dependent on that justification/iu);
  assert.match(stance, /preserving independently useful authorized work/iu);
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
