import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  ARTIFACT_PATHS,
  ensureWorkspace,
  importAudioReview,
  importIsolatedReview,
  initProject,
  loadBoard,
  prepareAudioReview,
  prepareIsolatedReview,
  runAudioReview,
  upsertDraft,
  upsertOrchestrationBoard
} from "../../src/core/internal-api.mjs";
import { writeJson } from "../../src/core/workspace.mjs";
import { ensureTestWorkspace, runFixtureMutation } from "../helpers/mutation-fixture.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

const ROOT = process.cwd();
const CLI = path.join(ROOT, "bin", "dove.mjs");

function tempRoot(prefix = "dove-isolated-review-") {
  return createTempRoot(prefix);
}

function seedTaskPacket(root, packetId = "isolated-review-packet") {
  const timestamp = new Date(0).toISOString();
  const packet = {
    id: packetId,
    title: "Isolated review packet",
    summary: "Integration test packet for isolated review handoff.",
    sourceType: "test-task",
    sourceId: packetId,
    status: "pending",
    lifecycleStatus: "active",
    active: true,
    assignedRole: "reviewer",
    currentFocus: "Run isolated review.",
    nextAction: "Prepare isolated reviewer handoff.",
    evidenceLinks: [],
    outputPaths: [],
    packetPath: `.dove/task-packets/packets/${packetId}.json`,
    packetContextPath: `.dove/context/packets/${packetId}.json`,
    updatedAt: timestamp
  };
  writeJson(root, packet.packetPath, packet);
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, { version: 3, items: [packet], lifecycleCounts: {}, dependencyHealth: {}, updatedAt: timestamp });
  return packetId;
}

function writeFakeReviewer(dir) {
  const scriptPath = path.join(dir, "fake-reviewer.mjs");
  fs.writeFileSync(scriptPath, `import fs from "node:fs";\nimport path from "node:path";\nconst args = process.argv.slice(2);\nconst flag = (name) => args[args.indexOf(name) + 1];\nconst inputPath = flag("--input");\nconst handoffPath = flag("--handoff");\nconst reportPath = flag("--report");\nconst runId = flag("--run-id");\nconst input = JSON.parse(fs.readFileSync(inputPath, "utf8"));\nfs.mkdirSync(path.dirname(handoffPath), { recursive: true });\nfs.writeFileSync(path.join(path.dirname(handoffPath), "private-transcript.md"), "PRIVATE REVIEWER CHAIN SHOULD NOT BE IMPORTED\\n", "utf8");\nfs.writeFileSync(reportPath, "# Isolated report\\n\\nThe method claim needs direct source support.\\n", "utf8");\nfs.writeFileSync(handoffPath, JSON.stringify({\n  version: 1,\n  runId,\n  status: "completed",\n  verdict: "needs-revision",\n  reviewerId: "fake-isolated-reviewer",\n  reviewerSessionId: "parallel-session-1",\n  timestamp: "2026-05-03T00:00:00.000Z",\n  summary: "The draft needs direct source support before finalization.",\n  inputPath,\n  inputSha256: input.inputSha256 ?? process.env.DOVE_ISOLATED_REVIEW_INPUT_SHA256,\n  reportPath,\n  reviewedArtifactPaths: input.reviewedArtifactPaths,\n  findings: [{\n    id: "method-needs-source",\n    severity: "high",\n    summary: "The method claim needs direct source support.",\n    responseOwnerRole: "researcher",\n    linkedArtifactPaths: [".dove/drafts/method.md"]\n  }],\n  actionItems: ["Add direct source support for the method claim."]\n}, null, 2) + "\\n", "utf8");\n`, "utf8");
  return scriptPath;
}

function seedReviewedArtifact(root, relativePath = ".dove/drafts/audio-review.md", packetId = null) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, "# Audio review material\n\nSubstantive material for governed audio review.\n", "utf8");
  if (packetId) {
    const packetPath = path.join(root, `.dove/task-packets/packets/${packetId}.json`);
    const packet = JSON.parse(fs.readFileSync(packetPath, "utf8"));
    const updated = { ...packet, outputPaths: Array.from(new Set([...(packet.outputPaths ?? []), relativePath])), artifactRefs: Array.from(new Set([...(packet.artifactRefs ?? []), relativePath])) };
    fs.writeFileSync(packetPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
    const indexPath = path.join(root, ARTIFACT_PATHS.taskPacketsIndex);
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    index.items = index.items.map((item) => item.id === packetId ? updated : item);
    fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  }
  return relativePath;
}

function seedBlockingFollowThrough(root, packetId, id = "review-governance-blocker") {
  const timestamp = new Date().toISOString();
  writeJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, {
    version: 1,
    proposalOnly: true,
    explicitOnly: true,
    items: [{
      id,
      sourceType: "remediation-pack",
      sourceId: `${id}-source`,
      sourceArtifactPath: ARTIFACT_PATHS.metaRemediationPacks,
      sourceFingerprint: `${id}-fingerprint`,
      sourceTitle: "Review governance blocker",
      sourceSummary: "An accepted execution item must block review mutation.",
      status: "accepted-for-execution",
      actorRole: "planner",
      linkedTargetArtifact: `.dove/task-packets/packets/${packetId}.json`,
      linkedTargetId: packetId,
      executeBy: "2099-01-01T00:00:00.000Z",
      reviewAfter: "2099-01-01T12:00:00.000Z",
      recordedAt: timestamp,
      updatedAt: timestamp
    }],
    updatedAt: timestamp
  });
}

function writeAudioReturn(root, prepared, {
  verdict = "needs-revision",
  summary = "Audio review requires revision.",
  actionItems = ["Revise the reviewed material."],
  findings = [{ id: "audio-revision", severity: "high", summary: "Revise the reviewed material." }]
} = {}) {
  fs.writeFileSync(path.join(root, prepared.reportPath), "# Audio report\n\nThe supplied material needs revision.\n", "utf8");
  fs.writeFileSync(path.join(root, prepared.handoffPath), `${JSON.stringify({
    version: 1,
    runId: prepared.runId,
    status: "completed",
    verdict,
    reviewerId: "audio-reviewer",
    summary,
    inputPath: prepared.inputPath,
    inputSha256: prepared.inputSha256,
    reportPath: prepared.reportPath,
    reviewedArtifactPaths: prepared.reviewedArtifactPaths,
    findings,
    actionItems
  }, null, 2)}\n`, "utf8");
}

test("isolated-review CLI imports only handoff and report from external reviewer", () => {
  const root = tempRoot();
  runFixtureMutation(root, "isolated-review-cli-setup", () => {
  ensureTestWorkspace(root);
  initProject(root, {
    title: "Isolated Review Paper",
    venue: "ICLR",
    objective: "Validate isolated review handoffs.",
    thesis: "Reviewer isolation improves critique quality.",
    audience: "reviewers"
  });
  const packetId = seedTaskPacket(root);
  upsertOrchestrationBoard(root, {
    phase: "outline",
    assignedRole: "planner"
  });
  upsertDraft(root, {
    packetId: "isolated-review-packet",
    sectionId: "method",
    body: "# Method\n\nWe claim the isolated reviewer improves rigor. TODO[citation]\n"
  });
  seedReviewedArtifact(root, ".dove/drafts/method.md", packetId);
  });

  const reviewerScript = writeFakeReviewer(root);
  const result = spawnSync("node", [
    CLI,
    "isolated-review",
    root,
    "--run-id",
    "test-review-1",
    "--reviewer-command",
    `node ${reviewerScript}`,
    "--scope",
    "current draft"
  ], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.status, "completed");
  assert.equal(payload.verdict, "needs-revision");
  assert.equal(payload.privateTranscriptImported, false);
  assert.match(payload.handoffPath, /\.dove\/reviews\/isolated\/test-review-1\/handoff\.json/);
  assert.match(payload.reportPath, /\.dove\/reviews\/isolated\/test-review-1\/report\.md/);

  const runDir = path.join(root, ".dove", "reviews", "isolated", "test-review-1");
  assert.ok(fs.existsSync(path.join(runDir, "input.json")));
  assert.ok(fs.existsSync(path.join(runDir, "handoff.json")));
  assert.ok(fs.existsSync(path.join(runDir, "report.md")));
  assert.ok(fs.existsSync(path.join(runDir, "private-transcript.md")));

  const input = JSON.parse(fs.readFileSync(path.join(runDir, "input.json"), "utf8"));
  assert.equal(input.privacyBoundary.writerPrivateTranscriptShared, false);
  assert.equal(input.privacyBoundary.reviewerPrivateTranscriptShouldReturn, false);
  assert.ok(input.reviewedArtifactPaths.includes(".dove/drafts/method.md"));

  const reviewLog = fs.readFileSync(path.join(root, ".dove", "reviews", "log.md"), "utf8");
  assert.match(reviewLog, /isolated-review/);
  assert.match(reviewLog, /The method claim needs direct source support/);
  assert.doesNotMatch(reviewLog, /PRIVATE REVIEWER CHAIN/);

  const concerns = JSON.parse(fs.readFileSync(path.join(root, ".dove", "reviews", "concerns.json"), "utf8"));
  assert.ok(concerns.items.some((item) => item.id === "isolated-test-review-1-method-needs-source"));

  const handoffs = fs.readFileSync(path.join(root, ".dove", "orchestration", "handoffs.md"), "utf8");
  assert.match(handoffs, /researcher -> reviewer/);
  assert.match(handoffs, /reviewer -> builder/);
  assert.match(handoffs, /Isolated reviewer fake-isolated-reviewer returned needs-revision/);
  assert.doesNotMatch(handoffs, /reviewer -> reviewer/);
  assert.doesNotMatch(handoffs, /Policy override:/);

  const board = loadBoard(root);
  assert.equal(board.currentPhase, "rebuttal");
  assert.equal(board.assignedRole, "builder");
  assert.equal(board.nextAction, "Add direct source support for the method claim.");
});

test("isolated-review prepare supports flag-first optional target parsing", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "isolated-review-prepare-supports-flag-first-optional-target-parsing", () => {
  ensureTestWorkspace(root);
  const packetId = seedTaskPacket(root);
  seedReviewedArtifact(root, ".dove/drafts/flag-first.md", packetId);

  const prepare = spawnSync("node", [CLI, "isolated-review-prepare", "--run-id", "flag-first-review"], {
    cwd: root,
    encoding: "utf8"
  });

  assert.equal(prepare.status, 0, prepare.stderr || prepare.stdout);
  const payload = JSON.parse(prepare.stdout);
  assert.equal(payload.runId, "flag-first-review");
  assert.ok(fs.existsSync(path.join(root, ".dove", "reviews", "isolated", "flag-first-review", "input.json")));
  });
});

test("isolated-review-import rejects mismatched input hashes", () => {
  const root = tempRoot();
  return runFixtureMutation(root, "isolated-review-import-rejects-mismatched-input-hashes", () => {
  ensureTestWorkspace(root);
  const packetId = seedTaskPacket(root);
  seedReviewedArtifact(root, ".dove/drafts/bad-hash.md", packetId);
  const prepare = spawnSync("node", [CLI, "isolated-review-prepare", root, "--run-id", "bad-hash-review"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(prepare.status, 0, prepare.stderr || prepare.stdout);
  const prepared = JSON.parse(prepare.stdout);
  fs.writeFileSync(path.join(root, ".dove", "reviews", "isolated", "bad-hash-review", "handoff.json"), JSON.stringify({
    runId: "bad-hash-review",
    status: "completed",
    verdict: "coherent",
    reviewerId: "fake-reviewer",
    summary: "Bad hash should fail.",
    inputPath: prepared.inputPath,
    inputSha256: "wrong-hash",
    reportPath: prepared.reportPath,
    reviewedArtifactPaths: prepared.reviewedArtifactPaths,
    findings: [],
    actionItems: []
  }, null, 2), "utf8");

  const imported = spawnSync("node", [CLI, "isolated-review-import", root, "--run-id", "bad-hash-review"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(imported.status, 0, imported.stderr || imported.stdout);
  const payload = JSON.parse(imported.stdout);
  assert.equal(payload.status, "verification-failed");
  assert.ok(payload.boundary.failures.includes("input-hash-mismatch"));
  });
});

function captureReviewSideEffects(root, manifestPath) {
  const paths = [ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.orchestrationBoard, ARTIFACT_PATHS.orchestrationHandoffs];
  return {
    manifest: fs.readFileSync(manifestPath, "utf8"),
    files: Object.fromEntries(paths.map((relativePath) => {
      const fullPath = path.join(root, relativePath);
      return [relativePath, fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : null];
    }))
  };
}

function assertReviewSideEffectsUnchanged(root, manifestPath, before) {
  assert.equal(fs.readFileSync(manifestPath, "utf8"), before.manifest);
  for (const [relativePath, contents] of Object.entries(before.files)) {
    const fullPath = path.join(root, relativePath);
    assert.equal(fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : null, contents, relativePath);
  }
}

test("isolated review rejects stale reviewed artifacts and tampered input with zero import side effects", () => {
  for (const mutation of ["content-size", "same-size", "deleted", "empty", "directory", "input-tamper", "extra-handoff", "missing-handoff"]) {
    const root = tempRoot(`dove-isolated-snapshot-${mutation}-`);
    runFixtureMutation(root, `loop-${typeof mutation === "undefined" ? surface : mutation}`, () => {
    ensureTestWorkspace(root);
    const packetId = seedTaskPacket(root, `isolated-${mutation}-packet`);
    const artifactPath = seedReviewedArtifact(root, `.dove/drafts/isolated-${mutation}.md`, packetId);
    const prepared = prepareIsolatedReview(root, { packetId, runId: `isolated-${mutation}`, reviewedArtifactPaths: [artifactPath] });
    fs.writeFileSync(path.join(root, prepared.reportPath), "# Isolated report\n\nReviewed prepared content.\n", "utf8");
    const handoff = {
      runId: prepared.runId, status: "completed", verdict: "coherent", reviewerId: "isolated-reviewer",
      summary: "Prepared artifacts are coherent.", inputPath: prepared.inputPath, inputSha256: prepared.inputSha256,
      reportPath: prepared.reportPath, reviewedArtifactPaths: [...prepared.reviewedArtifactPaths], findings: [], actionItems: []
    };
    const fullArtifactPath = path.join(root, artifactPath);
    if (mutation === "content-size") fs.appendFileSync(fullArtifactPath, "changed\n");
    if (mutation === "same-size") {
      const original = fs.readFileSync(fullArtifactPath, "utf8");
      fs.writeFileSync(fullArtifactPath, `${original.slice(0, -1)}!`, "utf8");
    }
    if (mutation === "deleted") fs.rmSync(fullArtifactPath);
    if (mutation === "empty") fs.writeFileSync(fullArtifactPath, "", "utf8");
    if (mutation === "directory") { fs.rmSync(fullArtifactPath); fs.mkdirSync(fullArtifactPath); }
    if (mutation === "input-tamper") fs.appendFileSync(path.join(root, prepared.inputPath), " ");
    if (mutation === "extra-handoff") handoff.reviewedArtifactPaths.push(seedReviewedArtifact(root, ".dove/drafts/extra.md", packetId));
    if (mutation === "missing-handoff") handoff.reviewedArtifactPaths = [];
    fs.writeFileSync(path.join(root, prepared.handoffPath), `${JSON.stringify(handoff, null, 2)}\n`, "utf8");
    const manifestPath = path.join(root, ARTIFACT_PATHS.isolatedReviewsDir, prepared.runId, "manifest.json");
    const before = captureReviewSideEffects(root, manifestPath);
    const result = importIsolatedReview(root, { packetId, runId: prepared.runId });
    assert.equal(result.status, "verification-failed", mutation);
    assert.equal(result.boundaryType, "verification-failed", mutation);
    assertReviewSideEffectsUnchanged(root, manifestPath, before);
    });
  }
});

test("isolated review imports unchanged snapshot successfully", () => {
  const root = tempRoot("dove-isolated-snapshot-success-");
  return runFixtureMutation(root, "isolated-review-imports-unchanged-snapshot-successfully", () => {
  ensureTestWorkspace(root);
  const packetId = seedTaskPacket(root, "isolated-snapshot-success-packet");
  const artifactPath = seedReviewedArtifact(root, ".dove/drafts/isolated-success.md", packetId);
  const prepared = prepareIsolatedReview(root, { packetId, runId: "isolated-snapshot-success", reviewedArtifactPaths: [artifactPath] });
  fs.writeFileSync(path.join(root, prepared.reportPath), "# Isolated report\n\nUnchanged content is coherent.\n", "utf8");
  fs.writeFileSync(path.join(root, prepared.handoffPath), `${JSON.stringify({
    runId: prepared.runId, status: "completed", verdict: "coherent", reviewerId: "isolated-reviewer",
    summary: "Unchanged snapshot reviewed.", inputPath: prepared.inputPath, inputSha256: prepared.inputSha256,
    reportPath: prepared.reportPath, reviewedArtifactPaths: prepared.reviewedArtifactPaths, findings: [], actionItems: []
  }, null, 2)}\n`, "utf8");
  const imported = importIsolatedReview(root, { packetId, runId: prepared.runId });
  assert.equal(imported.status, "imported");
  assert.throws(
    () => importIsolatedReview(root, { packetId, runId: prepared.runId }),
    /not importable from manifest status imported/
  );
  });
});

test("audio review rejects changed artifacts and tampered handoff sets with zero side effects", () => {
  for (const mutation of ["same-size", "deleted", "input-tamper", "extra-handoff", "missing-handoff"]) {
    const root = tempRoot(`dove-audio-snapshot-${mutation}-`);
    runFixtureMutation(root, `loop-${typeof mutation === "undefined" ? surface : mutation}`, () => {
    ensureTestWorkspace(root);
    const packetId = seedTaskPacket(root, `audio-${mutation}-packet`);
    const artifactPath = seedReviewedArtifact(root, `.dove/drafts/audio-${mutation}.md`, packetId);
    const prepared = prepareAudioReview(root, { packetId, runId: `audio-${mutation}`, artifactPaths: [artifactPath] });
    writeAudioReturn(root, prepared, { verdict: "coherent", findings: [], actionItems: [] });
    const handoffPath = path.join(root, prepared.handoffPath);
    const handoff = JSON.parse(fs.readFileSync(handoffPath, "utf8"));
    if (mutation === "same-size") {
      const fullPath = path.join(root, artifactPath);
      const original = fs.readFileSync(fullPath, "utf8");
      fs.writeFileSync(fullPath, `${original.slice(0, -1)}!`, "utf8");
    }
    if (mutation === "deleted") fs.rmSync(path.join(root, artifactPath));
    if (mutation === "input-tamper") fs.appendFileSync(path.join(root, prepared.inputPath), " ");
    if (mutation === "extra-handoff") handoff.reviewedArtifactPaths.push(seedReviewedArtifact(root, ".dove/drafts/audio-extra.md", packetId));
    if (mutation === "missing-handoff") handoff.reviewedArtifactPaths = [];
    fs.writeFileSync(handoffPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8");
    const manifestPath = path.join(root, ARTIFACT_PATHS.audioReviewsDir, prepared.runId, "manifest.json");
    const before = captureReviewSideEffects(root, manifestPath);
    const result = importAudioReview(root, { packetId, runId: prepared.runId });
    assert.equal(result.status, "verification-failed", mutation);
    assertReviewSideEffectsUnchanged(root, manifestPath, before);
    });
  }
});

test("audio review import is single-use and packet-bound", () => {
  const root = tempRoot("dove-audio-review-single-use-");
  return runFixtureMutation(root, "audio-review-import-is-single-use-and-packet-bound", () => {
  ensureTestWorkspace(root);
  const packetId = seedTaskPacket(root, "audio-single-use-packet");
  const firstPacket = JSON.parse(fs.readFileSync(path.join(root, `.dove/task-packets/packets/${packetId}.json`), "utf8"));
  const otherPacketId = seedTaskPacket(root, "audio-other-packet");
  const indexPath = path.join(root, ARTIFACT_PATHS.taskPacketsIndex);
  const packetIndex = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  packetIndex.items = [firstPacket, ...packetIndex.items];
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, packetIndex);
  const artifactPath = seedReviewedArtifact(root, ".dove/drafts/audio-single-use.md", packetId);
  const prepared = prepareAudioReview(root, { packetId, runId: "audio-single-use", artifactPaths: [artifactPath] });
  writeAudioReturn(root, prepared, { verdict: "coherent", findings: [], actionItems: [] });

  assert.throws(
    () => importAudioReview(root, { packetId: otherPacketId, runId: prepared.runId }),
    /belongs to packet audio-single-use-packet, not audio-other-packet/
  );
  const imported = importAudioReview(root, { packetId, runId: prepared.runId });
  assert.equal(imported.status, "imported");
  assert.throws(
    () => importAudioReview(root, { packetId, runId: prepared.runId }),
    /not importable from manifest status imported/
  );
  });
});

test("audio review prepare and import record reviewer routing metadata and return handoff", () => {
  const root = tempRoot("dove-audio-review-governance-");
  return runFixtureMutation(root, "audio-review-prepare-and-import-record-reviewer-routing-metadata-and-ret", () => {
  ensureTestWorkspace(root);
  const packetId = seedTaskPacket(root, "audio-review-packet");
  upsertOrchestrationBoard(root, {
    phase: "plan",
    assignedRole: "planner",
    actorRole: "planner"
  });
  const reviewedArtifact = seedReviewedArtifact(root, ".dove/drafts/audio-review.md", packetId);

  const prepared = prepareAudioReview(root, {
    packetId,
    runId: "audio-governance",
    scope: "audio governance regression",
    artifactPaths: [reviewedArtifact]
  });
  const reviewBoard = loadBoard(root);
  assert.equal(reviewBoard.currentPhase, "review");
  assert.equal(reviewBoard.assignedRole, "reviewer");
  writeAudioReturn(root, prepared, {
    actionItems: ["Add direct validation evidence."]
  });

  const imported = importAudioReview(root, {
    packetId,
    runId: prepared.runId
  });
  assert.equal(imported.verdict, "needs-revision");
  const returnBoard = loadBoard(root);
  assert.equal(returnBoard.currentPhase, "rebuttal");
  assert.equal(returnBoard.assignedRole, "builder");
  assert.equal(returnBoard.nextAction, "Add direct validation evidence.");

  const handoffs = fs.readFileSync(path.join(root, ARTIFACT_PATHS.orchestrationHandoffs), "utf8");
  assert.match(handoffs, /planner -> reviewer/);
  assert.match(handoffs, /reviewer -> builder/);
  assert.match(handoffs, /Audio reviewer audio-reviewer returned needs-revision/);
  assert.doesNotMatch(handoffs, /reviewer -> reviewer/);
  assert.doesNotMatch(handoffs, /Policy override:/);
  });
});

test("audio review prepare and run block before review artifact writes when follow-through is unresolved", () => {
  for (const [surface, invoke] of [
    ["prepare", prepareAudioReview],
    ["run", runAudioReview]
  ]) {
    const root = tempRoot(`dove-audio-${surface}-blocked-`);
    runFixtureMutation(root, `loop-${typeof mutation === "undefined" ? surface : mutation}`, () => {
    ensureTestWorkspace(root);
    const packetId = seedTaskPacket(root, `audio-${surface}-packet`);
    const reviewedArtifact = seedReviewedArtifact(root, `.dove/drafts/audio-${surface}.md`, packetId);
    seedBlockingFollowThrough(root, packetId, `audio-${surface}-blocker`);
    const runId = `audio-${surface}-blocked`;

    assert.throws(() => invoke(root, {
      packetId,
      runId,
      artifactPaths: [reviewedArtifact]
    }), /blocked while operator follow-through still requires action/);
    assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.audioReviewsDir, runId)), false);
    });
  }
});

test("audio review import blocks before mutating review artifacts or changing return routing", () => {
  const root = tempRoot("dove-audio-import-blocked-");
  return runFixtureMutation(root, "audio-review-import-blocks-before-mutating-review-artifacts-or-changing-", () => {
  ensureTestWorkspace(root);
  const packetId = seedTaskPacket(root, "audio-import-packet");
  const reviewedArtifact = seedReviewedArtifact(root, ".dove/drafts/audio-import.md", packetId);
  const prepared = prepareAudioReview(root, {
    packetId,
    runId: "audio-import-blocked",
    artifactPaths: [reviewedArtifact]
  });
  writeAudioReturn(root, prepared);
  const manifestPath = path.join(root, ARTIFACT_PATHS.audioReviewsDir, prepared.runId, "manifest.json");
  const manifestBefore = fs.readFileSync(manifestPath, "utf8");
  const reviewLogPath = path.join(root, ARTIFACT_PATHS.reviewLog);
  const concernsPath = path.join(root, ARTIFACT_PATHS.reviewConcerns);
  const reviewLogBefore = fs.existsSync(reviewLogPath) ? fs.readFileSync(reviewLogPath, "utf8") : null;
  const concernsBefore = fs.existsSync(concernsPath) ? fs.readFileSync(concernsPath, "utf8") : null;
  const boardBefore = loadBoard(root);
  seedBlockingFollowThrough(root, packetId, "audio-import-blocker");

  assert.throws(() => importAudioReview(root, {
    packetId,
    runId: prepared.runId
  }), /blocked while operator follow-through still requires action/);
  assert.equal(fs.readFileSync(manifestPath, "utf8"), manifestBefore);
  assert.equal(fs.existsSync(reviewLogPath) ? fs.readFileSync(reviewLogPath, "utf8") : null, reviewLogBefore);
  assert.equal(fs.existsSync(concernsPath) ? fs.readFileSync(concernsPath, "utf8") : null, concernsBefore);
  assert.deepEqual(loadBoard(root), boardBefore);
  });
});

test("audio review run validates an existing return before rewriting prepared artifacts", () => {
  const root = tempRoot("dove-audio-run-existing-return-");
  return runFixtureMutation(root, "audio-review-run-validates-an-existing-return-before-rewriting-prepared-", () => {
  ensureTestWorkspace(root);
  const packetId = seedTaskPacket(root, "audio-run-existing-packet");
  const reviewedArtifact = seedReviewedArtifact(root, ".dove/drafts/audio-run-existing.md", packetId);
  const prepared = prepareAudioReview(root, {
    packetId,
    runId: "audio-run-existing",
    artifactPaths: [reviewedArtifact]
  });
  writeAudioReturn(root, prepared);
  const manifestPath = path.join(root, ARTIFACT_PATHS.audioReviewsDir, prepared.runId, "manifest.json");
  const inputPath = path.join(root, prepared.inputPath);
  const manifestBefore = fs.readFileSync(manifestPath, "utf8");
  const inputBefore = fs.readFileSync(inputPath, "utf8");
  const invalidHandoff = JSON.parse(fs.readFileSync(path.join(root, prepared.handoffPath), "utf8"));
  fs.writeFileSync(path.join(root, prepared.handoffPath), `${JSON.stringify({
    ...invalidHandoff,
    inputSha256: "invalid-input-hash"
  }, null, 2)}\n`, "utf8");

  const result = runAudioReview(root, {
    packetId,
    runId: prepared.runId,
    artifactPaths: [reviewedArtifact]
  });
  assert.equal(result.status, "verification-failed");
  assert.ok(result.boundary.failures.includes("input-hash-mismatch"));
  assert.equal(fs.readFileSync(manifestPath, "utf8"), manifestBefore);
  assert.equal(fs.readFileSync(inputPath, "utf8"), inputBefore);
  });
});
