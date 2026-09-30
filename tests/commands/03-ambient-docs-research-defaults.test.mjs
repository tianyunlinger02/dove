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
  assert.match(RESEARCH_DEFAULT_DOCUMENTS[0].content, /Short entry to the project identity card/iu);
  assert.match(RESEARCH_DEFAULT_DOCUMENTS[0].content, /Confirm the mainline with the user/iu);
  assert.doesNotMatch(RESEARCH_DEFAULT_DOCUMENTS[0].content, /^Mainline:/mu);
});

test("author stance uses Lessons once at consequential triggers without burdening local work", () => {
  const stance = renderDoveAuthorStanceSection();
  assert.match(stance, /short researcher-owned `\.dove\/research\/IDENTITY\.md`/iu);
  assert.match(stance, /Mainline: ` followed by one sentence in the user's words/iu);
  assert.match(stance, /rejected approaches; user restrictions; current route; next core action; hard blocker/iu);
  assert.match(stance, /Correct only the fields the user actually corrected/iu);
  assert.match(stance, /including during an assessment/iu);
  assert.match(stance, /unless writing is explicitly forbidden or the host refuses/iu);
  assert.match(stance, /Keep RESEARCH\.md a short entry to history/iu);
  assert.match(stance, /Preserve transferable Lessons only when useful/iu);
  assert.match(stance, /read-only assessment is not by itself a reason to forget the correction/iu);
  assert.match(stance, /Respect an explicit no-write instruction/iu);
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
