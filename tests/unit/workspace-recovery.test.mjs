import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { readJson } from "../../src/core/index.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

test("readJson repairs malformed JSON using the fallback and preserves a backup", () => {
  const root = createTempRoot("dove-json-");
  const relative = ".dove/state.json";
  fs.mkdirSync(path.join(root, ".dove"), { recursive: true });
  fs.writeFileSync(path.join(root, relative), "{broken json", "utf8");

  const recovered = readJson(root, relative, { version: 1, ok: true });
  assert.equal(recovered.ok, true);

  const entries = fs.readdirSync(path.join(root, ".dove"));
  assert.ok(entries.some((entry) => entry.startsWith("state.json.broken-")));
  const repaired = JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
  assert.equal(repaired.ok, true);
});
