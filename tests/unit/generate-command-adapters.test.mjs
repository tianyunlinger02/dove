import test from "node:test";
import assert from "node:assert/strict";

import { generatedWriteSummary } from "../../scripts/generate-command-adapters.mjs";

test("generated adapter write summary reads nested transaction phases", () => {
  const committed = generatedWriteSummary(
    { writtenPaths: ["first.md"], transactionState: { phase: "committed" } },
    { writtenPaths: ["second.md"], transactionState: { phase: "committed" } }
  );
  assert.deepEqual(committed, { written: ["first.md", "second.md"], transactionState: "committed" });

  const failed = generatedWriteSummary(
    { writtenPaths: ["first.md"], transactionState: { phase: "committed" } },
    { writtenPaths: [], transactionState: { phase: "rolled-back" } }
  );
  assert.equal(failed.transactionState, "failed");
});
