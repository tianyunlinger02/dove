import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { writeFileSetTransaction } from "../../src/core/file-set-transaction.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

test("multi-root post-commit cleanup failure preserves committed targets and reports bounded residue", () => {
  const firstRoot = createTempRoot("dove-file-set-cleanup-first-");
  const secondRoot = createTempRoot("dove-file-set-cleanup-second-");
  fs.writeFileSync(path.join(firstRoot, "target.txt"), "first original\n");
  fs.writeFileSync(path.join(secondRoot, "target.txt"), "second original\n");

  const fsOps = {
    ...fs,
    rmSync(targetPath, options) {
      if (targetPath.startsWith(path.join(secondRoot, ".dove-file-transaction-"))) {
        throw new Error("injected second-root cleanup failure");
      }
      return fs.rmSync(targetPath, options);
    }
  };

  const written = writeFileSetTransaction([
    { root: firstRoot, relativePath: "target.txt", content: "first committed\n", force: true },
    { root: secondRoot, relativePath: "target.txt", content: "second committed\n", force: true }
  ], { fsOps, transactionId: "cleanup-failure" });

  assert.deepEqual(written.writtenPaths, ["target.txt", "target.txt"]);
  assert.equal(fs.readFileSync(path.join(firstRoot, "target.txt"), "utf8"), "first committed\n");
  assert.equal(fs.readFileSync(path.join(secondRoot, "target.txt"), "utf8"), "second committed\n");
  assert.equal(written.transactionState.phase, "committed");
  assert.equal(written.transactionState.rollbackAttempted, false);
  assert.equal(written.transactionState.cleanup.status, "residue");
  assert.equal(written.transactionState.cleanup.residueCount, 1);
  assert.equal(written.transactionState.cleanup.residues.length, 1);
  assert.match(written.transactionState.cleanup.residues[0].reason, /injected second-root cleanup failure/u);
  assert.equal(written.transactionState.cleanup.omittedResidueCount, 0);
  assert.equal(fs.readdirSync(firstRoot).some((name) => name.startsWith(".dove-file-transaction-")), false);
  assert.equal(fs.readdirSync(secondRoot).some((name) => name.startsWith(".dove-file-transaction-")), true);
});
