import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

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
