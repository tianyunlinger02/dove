import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ensureWorkspace,
  queryPaperAudit
} from "../../src/core/internal-api.mjs";
import { ARTIFACT_PATHS } from "../../src/core/schema.mjs";
import { ensureTestWorkspace } from "../helpers/mutation-fixture.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function tempRoot() {
  return createTempRoot("dove-audit-");
}

function snapshotArtifacts(root, relativePaths) {
  return Object.fromEntries(relativePaths.map((relativePath) => {
    const fullPath = path.join(root, relativePath);
    return [relativePath, fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : null];
  }));
}

test("queryPaperAudit reports findings without writing paper artifacts", () => {
  const root = tempRoot();
  ensureTestWorkspace(root);

  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.evidence), `${JSON.stringify({
    version: 3,
    claims: [{
      id: "claim-audit-gap",
      text: "Unsupported audit claim.",
      sectionId: "introduction",
      sourceIds: [],
      noteIds: [],
      experimentIds: []
    }],
    updatedAt: null
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.reviewConcerns), `${JSON.stringify({
    version: 2,
    items: [{ id: "concern-open", summary: "Open review concern.", severity: "high", status: "open" }],
    updatedAt: null
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.checklist), "# Checklist\n\n- [ ] Close audit gap\n", "utf8");

  const watched = [
    ARTIFACT_PATHS.state,
    ARTIFACT_PATHS.evidence,
    ARTIFACT_PATHS.reviewConcerns,
    ARTIFACT_PATHS.reviewState,
    ARTIFACT_PATHS.checklist,
    ARTIFACT_PATHS.figureQa,
    ARTIFACT_PATHS.workspaceIndex,
    ARTIFACT_PATHS.orchestrationBoard
  ];
  const before = snapshotArtifacts(root, watched);
  const audit = queryPaperAudit(root, { scope: "no-write test" });
  const after = snapshotArtifacts(root, watched);

  assert.equal(audit.mode, "audit-only");
  assert.equal(audit.proposalOnly, true);
  assert.equal(audit.noAutoApply, true);
  assert.deepEqual(audit.writes, []);
  assert.equal(audit.diagnostics.requestedScope, "no-write test");
  assert.ok(audit.findings.some((finding) => finding.category === "evidence" && finding.claimIds.includes("claim-audit-gap")));
  assert.ok(audit.findings.some((finding) => finding.category === "review" && finding.reviewConcernIds.includes("concern-open")));
  assert.ok(audit.findings.some((finding) => finding.category === "process"));
  assert.deepEqual(after, before);
});

test("queryPaperAudit does not repair malformed JSON", () => {
  const root = tempRoot();
  ensureTestWorkspace(root);
  const malformedPath = path.join(root, ARTIFACT_PATHS.reviewConcerns);
  fs.writeFileSync(malformedPath, "{ broken json", "utf8");
  const before = fs.readFileSync(malformedPath, "utf8");

  const audit = queryPaperAudit(root);
  const after = fs.readFileSync(malformedPath, "utf8");

  assert.equal(after, before);
  assert.ok(audit.diagnostics.readErrors.some((item) => item.path === ARTIFACT_PATHS.reviewConcerns));
  assert.ok(audit.findings.some((finding) => finding.id.includes("malformed-json")));
  assert.equal(fs.readdirSync(path.dirname(malformedPath)).some((fileName) => fileName.includes(".broken-")), false);
});
