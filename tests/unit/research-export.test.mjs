import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { exportResearch, previewResearchExport } from "../../src/core/research-export.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function write(root, relativePath, value, json = true) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, json ? `${JSON.stringify(value, null, 2)}\n` : value);
}

function fixture() {
  const root = createTempRoot("dove-research-export-");
  write(root, ".dove/format.json", { format: "dove-research-v2" });
  write(root, ".dove/workspace.json", {
    workspaceId: "workspace-one",
    researchQuestion: "Why does the method fail on the hard cases?",
    mainline: "Test the measurement explanation.",
    contributionIntent: "Bound the mechanism claim.",
    currentFocus: "Run the discriminating experiment.",
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z"
  });
  write(root, ".dove/LESSONS.md", "# Lessons\n\nPreserve negative evidence.\n", false);
  write(root, ".dove/missions/main.json", {
    missionId: "main",
    parentMissionId: null,
    dependsOnMissionIds: [],
    branchKind: null,
    branchReason: null,
    goal: "Test the measurement explanation.",
    requirements: [],
    assumptions: ["One benchmark."],
    scope: [],
    outOfScope: [],
    evidenceRequirements: [],
    competingHypotheses: [],
    openQuestions: ["Does calibration remove the effect?"],
    contextRefs: [],
    contributionRole: "Bound the mechanism claim.",
    createdAt: "2026-08-08T00:00:00.000Z"
  });
  write(root, ".dove/experiments/calibration.plan.json", {
    experimentId: "calibration",
    missionId: "main",
    title: "Calibration experiment",
    hypothesisRefs: [],
    protocol: ["Run all cases."],
    inputs: ["benchmark"],
    comparisons: [],
    metrics: ["score"],
    discriminatingObservations: ["Whether calibration removes the effect."],
    successConditions: [],
    stopConditions: ["One pass."],
    constraints: [],
    expectedArtifacts: [],
    cost: "One pass.",
    risk: "Low.",
    failureValue: "Bounds the mechanism.",
    contributionRole: "Discriminate explanations.",
    plannedAt: "2026-08-08T00:00:00.000Z"
  });
  write(root, ".dove/experiments/calibration.result.json", {
    experimentId: "calibration",
    missionId: "main",
    kind: "negative",
    summary: "Calibration did not remove the effect.",
    observations: ["21/22 retained the effect."],
    measurements: [],
    denominator: { total: 22, observed: 22, failed: 0, excluded: 0 },
    hypothesisImpacts: [],
    claimImpacts: [],
    unexpectedObservations: [],
    artifactRefs: [],
    failures: [],
    deviations: [],
    limitations: ["One benchmark."],
    uncertainty: ["No external replication."],
    recordedAt: "2026-08-08T00:01:00.000Z"
  });
  write(root, ".dove/sources/prior-work.json", {
    sourceId: "prior-work",
    missionId: "main",
    citationKey: null,
    title: "Prior Work",
    authors: [],
    year: null,
    locator: "https://example.test",
    sourceType: null,
    summary: "Reports a narrower effect.",
    conditions: [],
    relationship: "condition-specific",
    conflicts: [],
    limitations: ["Different denominator."],
    capture: null,
    recordedAt: "2026-08-08T00:00:00.000Z"
  });
  write(root, ".dove/review-exchanges/results.json", { exchangeId: "results", missionId: "main", artifacts: [{ path: "paper/results.md", sha256: "a".repeat(64) }], preparedAt: "2026-08-08T00:00:00.000Z" });
  write(root, ".dove/reviews/results.json", { reviewId: "results", exchangeId: "results", missionId: "main", artifacts: [{ path: "paper/results.md", sha256: "a".repeat(64) }], status: "completed", verdict: "needs-evidence", summary: "Narrow the claim.", rubric: ["Evidence"], findings: [{ findingId: "scope", severity: "high", summary: "Evidence is narrow.", linkedArtifactPaths: ["paper/results.md"] }], actionItems: ["Narrow the claim."], report: "# Review\n\nThe evidence is narrow.\n", provenance: {}, limitations: ["Advisory only."], reviewedAt: "2026-08-08T00:01:00.000Z" });
  return root;
}

test("preview exports v2 JSON to readable Markdown without writes", () => {
  const root = fixture();
  const before = fs.readdirSync(root, { recursive: true }).map(String).sort();
  const preview = previewResearchExport(root, { now: new Date("2026-08-12T07:00:00.000Z") });
  assert.equal(preview.from, "dove-research-v2");
  assert.equal(preview.to, "markdown");
  assert.equal(preview.archiveDirectory, ".dove/archive/research-format-v2-20260812T070000-000Z");
  assert.ok(preview.writtenPaths.includes(".dove/research/RESEARCH.md"));
  assert.ok(preview.writtenPaths.some((item) => item.startsWith(".dove/research/experiments/")));
  assert.deepEqual(fs.readdirSync(root, { recursive: true }).map(String).sort(), before);
});

test("confirmed export preserves raw bytes, combines experiment and review documents, and retires v2 files", () => {
  const root = fixture();
  const originalWorkspace = fs.readFileSync(path.join(root, ".dove/workspace.json"));
  const preview = previewResearchExport(root, { now: new Date("2026-08-12T07:00:00.000Z") });
  const result = exportResearch(root, { confirmed: true, now: new Date("2026-08-12T07:00:00.000Z"), transactionId: "research-export-test" });
  assert.equal(result.status, "exported");
  assert.equal(fs.existsSync(path.join(root, ".dove/format.json")), false);
  assert.equal(fs.existsSync(path.join(root, ".dove/workspace.json")), false);
  assert.deepEqual(fs.readFileSync(path.join(root, preview.archiveDirectory, "workspace.json")), originalWorkspace);
  const overview = fs.readFileSync(path.join(root, ".dove/research/RESEARCH.md"), "utf8");
  assert.match(overview, /Test the measurement explanation/u);
  const experimentPath = result.writtenPaths.find((item) => item.startsWith(".dove/research/experiments/"));
  const experiment = fs.readFileSync(path.join(root, experimentPath), "utf8");
  assert.match(experiment, /Prospective protocol/u);
  assert.match(experiment, /Actual execution and result/u);
  assert.match(experiment, /negative/u);
  const reviewPath = result.writtenPaths.find((item) => item.startsWith(".dove/research/reviews/"));
  const review = fs.readFileSync(path.join(root, reviewPath), "utf8");
  assert.match(review, /Declared artifact scope/u);
  assert.match(review, /Returned review/u);
  assert.match(review, /The evidence is narrow/u);
});

test("confirmed export rebuilds its trusted plan instead of accepting a caller-supplied preview", () => {
  const root = fixture();
  write(root, "ordinary.txt", "keep ordinary\n", false);
  const forgedPreview = {
    action: "export-research",
    from: "dove-research-v2",
    target: root,
    to: "markdown",
    researchDirectory: ".dove/research",
    archiveDirectory: ".dove/archive/forged",
    plan: {
      documents: [{ relativePath: "pwned.txt", content: "forged\n" }],
      archiveFiles: [],
      sourceFiles: [{
        relativePath: "ordinary.txt",
        state: { exists: true, type: "file", sha256: "0".repeat(64), mode: 0o644 }
      }]
    }
  };

  const result = exportResearch(root, {
    confirmed: true,
    preview: forgedPreview,
    now: new Date("2026-08-12T07:00:00.000Z"),
    transactionId: "research-export-forged-preview"
  });
  assert.equal(result.status, "exported");
  assert.equal(fs.existsSync(path.join(root, "pwned.txt")), false);
  assert.equal(fs.readFileSync(path.join(root, "ordinary.txt"), "utf8"), "keep ordinary\n");
  assert.equal(result.archiveDirectory, ".dove/archive/research-format-v2-20260812T070000-000Z");
});

test("export rejects malformed supported-v2 records before archiving or deleting them", () => {
  const orphan = fixture();
  fs.unlinkSync(path.join(orphan, ".dove/experiments/calibration.plan.json"));
  const orphanBefore = fs.readFileSync(path.join(orphan, ".dove/experiments/calibration.result.json"));
  assert.throws(() => previewResearchExport(orphan), /no matching prospective plan/iu);
  assert.deepEqual(fs.readFileSync(path.join(orphan, ".dove/experiments/calibration.result.json")), orphanBefore);
  assert.equal(fs.existsSync(path.join(orphan, ".dove/research")), false);
  assert.equal(fs.existsSync(path.join(orphan, ".dove/archive")), false);

  const mismatched = fixture();
  fs.renameSync(
    path.join(mismatched, ".dove/sources/prior-work.json"),
    path.join(mismatched, ".dove/sources/renamed.json")
  );
  assert.throws(() => previewResearchExport(mismatched), /does not match Source identifier/iu);

  const duplicate = fixture();
  fs.copyFileSync(
    path.join(duplicate, ".dove/sources/prior-work.json"),
    path.join(duplicate, ".dove/sources/prior-work-copy.json")
  );
  assert.throws(() => previewResearchExport(duplicate), /does not match Source identifier|duplicate Source identifier/iu);
});

test("confirmed export fails closed when a record appears after planning", () => {
  const root = fixture();
  const fsOps = Object.create(fs);
  let injected = false;
  fsOps.renameSync = (...args) => {
    if (!injected) {
      injected = true;
      write(root, ".dove/sources/concurrent.json", {
        sourceId: "concurrent",
        missionId: "main",
        citationKey: null,
        title: "Concurrent Source",
        authors: [],
        year: null,
        locator: null,
        sourceType: null,
        summary: "Appeared during export.",
        conditions: [],
        relationship: "uncovered",
        conflicts: [],
        limitations: [],
        capture: null,
        recordedAt: "2026-08-08T00:02:00.000Z"
      });
    }
    return fs.renameSync(...args);
  };

  assert.throws(
    () => exportResearch(root, {
      confirmed: true,
      now: new Date("2026-08-12T07:00:00.000Z"),
      transactionId: "research-export-concurrent-record",
      fsOps
    }),
    /unscheduled child/iu
  );
  assert.equal(fs.existsSync(path.join(root, ".dove/format.json")), true);
  assert.equal(fs.existsSync(path.join(root, ".dove/research")), false);
  assert.equal(fs.existsSync(path.join(root, ".dove/archive")), false);
  assert.equal(fs.existsSync(path.join(root, ".dove/sources/concurrent.json")), true);
});

test("export is default-No and rejects existing Markdown or symlinked v2 state", () => {
  const root = fixture();
  assert.throws(() => exportResearch(root), /confirmed: true/iu);

  fs.mkdirSync(path.join(root, ".dove/research"));
  assert.throws(() => previewResearchExport(root), /already exists/iu);

  const linked = fixture();
  fs.unlinkSync(path.join(linked, ".dove/workspace.json"));
  fs.symlinkSync(path.join(linked, ".dove/format.json"), path.join(linked, ".dove/workspace.json"));
  assert.throws(() => previewResearchExport(linked), /symbolic link/iu);
});
