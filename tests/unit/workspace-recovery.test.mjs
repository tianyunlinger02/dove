import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { readJson } from "../../src/core/index.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

test("readJson rejects malformed JSON without repairing files", () => {
  const root = createTempRoot("dove-json-");
  const relative = ".dove/state.json";
  fs.mkdirSync(path.join(root, ".dove"), { recursive: true });
  fs.writeFileSync(path.join(root, relative), "{broken json", "utf8");

  assert.throws(() => readJson(root, relative, { version: 1, ok: true }), /Malformed JSON/);

  const entries = fs.readdirSync(path.join(root, ".dove"));
  assert.equal(entries.some((entry) => entry.startsWith("state.json.broken-")), false);
  assert.equal(fs.readFileSync(path.join(root, relative), "utf8"), "{broken json");
});
