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

test("author stance uses Lessons once at consequential triggers without burdening local work", () => {
  const stance = renderDoveAuthorStanceSection();
  const overview = "`.dove/research/RESEARCH.md`";
  const lessons = "`.dove/research/lessons/LESSONS.md`";
  assert.equal(stance.split(overview).length - 1, 1);
  assert.equal(stance.split(lessons).length - 1, 1);
  assert.match(stance, /first consequential route, method, evaluation, implementation, delegation, artifact-adoption, or investment choice/iu);
  assert.match(stance, /user correction or recurring repair or failure/iu);
  assert.match(stance, /once if it exists unless it has already been checked for this question/iu);
  assert.match(stance, /only directly relevant or plausibly decision-changing linked Lessons/iu);
  assert.match(stance, /RESEARCH\.md[^.]*not a prerequisite/iu);
  assert.match(stance, /Missing Lessons never blocks work or requires creating files/iu);
  assert.match(stance, /Lessons guide judgment rather than supply research evidence/iu);
  assert.match(stance, /Do not scan the broad research tree/iu);
  assert.match(stance, /Ordinary deterministic local[^.]*no research-tree prerequisite/iu);
  assert.match(stance, /research Markdown other than Lessons only when/iu);
  assert.match(stance, /even if the research mainline, conclusion, decision, or priority did not change/iu);
  assert.match(stance, /explicit `\/dove:lessons` invocation is not required/iu);
  assert.match(stance, /routine progress, transient status, one-off tool failures, or non-transferable bugs/iu);
  assert.match(stance, /Read-only, assessment-only, Status, explicitly no-record, or isolated-review work/iu);
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
