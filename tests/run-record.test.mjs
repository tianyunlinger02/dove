import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRunCommandArgv } from "../src/core/run-record.mjs";

test("run command argv preserves empty arguments but rejects an empty executable and NUL", () => {
  const argv = ["node", "", "--label", "", " "];
  assert.deepEqual(normalizeRunCommandArgv(argv), argv);
  assert.throws(() => normalizeRunCommandArgv([]), /command after/u);
  assert.throws(() => normalizeRunCommandArgv(["", "argument"]), /argv\[0\].*non-empty/u);
  for (const invalid of [["no\0de"], ["node", "\0"], ["node", "", "value\0"]]) {
    assert.throws(() => normalizeRunCommandArgv(invalid), /NUL/u);
  }
});
