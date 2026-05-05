import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { compareVersions, ensureWorkspace, upsertOrchestrationBoard } from "../../src/core/index.mjs";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dove-legacy-snapshot-"));
}

test("compareVersions tolerates legacy snapshot shapes with missing modern fields", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  const snapshotDir = path.join(root, ".dove", "versions", "snapshots");
  fs.mkdirSync(snapshotDir, { recursive: true });

  fs.writeFileSync(path.join(snapshotDir, "legacy-a.json"), JSON.stringify({
    id: "legacy-a",
    paper: { objective: "A", thesis: "A thesis" },
    sections: {},
    claimIds: ["claim-a"]
  }, null, 2));

  fs.writeFileSync(path.join(snapshotDir, "legacy-b.json"), JSON.stringify({
    id: "legacy-b",
    paper: { objective: "B", thesis: "B thesis" },
    sections: {},
    claimIds: ["claim-a", "claim-b"]
  }, null, 2));

  upsertOrchestrationBoard(root, {
    phase: "versions",
    assignedRole: "version-analyst",
    reviewRequiredBeforeFinalize: false
  });

  const comparison = compareVersions(root, { fromVersionId: "legacy-a", toVersionId: "legacy-b" });
  assert.equal(comparison.fromVersionId, "legacy-a");
  assert.equal(comparison.toVersionId, "legacy-b");
  assert.deepEqual(comparison.addedClaimIds, ["claim-b"]);
});
