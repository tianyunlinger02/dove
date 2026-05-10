import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { compareVersions, ensureWorkspace, upsertOrchestrationBoard } from "../../src/core/index.mjs";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dove-legacy-snapshot-"));
}

function seedTaskPacket(root) {
  const timestamp = new Date(0).toISOString();
  const packet = {
    id: "legacy-snapshot-packet",
    title: "Legacy snapshot packet",
    summary: "Unit test packet for version comparison.",
    sourceType: "test-task",
    sourceId: "legacy-snapshot-packet",
    status: "pending",
    lifecycleStatus: "active",
    active: true,
    assignedRole: "version-analyst",
    currentFocus: "Compare legacy snapshots.",
    nextAction: "Run version comparison.",
    evidenceLinks: [],
    outputPaths: [],
    packetPath: ".dove/task-packets/packets/legacy-snapshot-packet.json",
    packetContextPath: ".dove/context/packets/legacy-snapshot-packet.json",
    updatedAt: timestamp
  };
  fs.mkdirSync(path.join(root, ".dove", "task-packets", "packets"), { recursive: true });
  fs.writeFileSync(path.join(root, packet.packetPath), `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(root, ".dove", "task-packets", "index.json"), `${JSON.stringify({ version: 3, items: [packet], lifecycleCounts: {}, dependencyHealth: {}, updatedAt: timestamp }, null, 2)}\n`, "utf8");
}

test("compareVersions tolerates legacy snapshot shapes with missing modern fields", () => {
  const root = tempRoot();
  ensureWorkspace(root);
  seedTaskPacket(root);
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
