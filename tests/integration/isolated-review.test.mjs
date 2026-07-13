import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  ARTIFACT_PATHS,
  createVersionSnapshot,
  ensureWorkspace,
  importAudioReview,
  importIsolatedReview,
  initProject,
  loadBoard,
  prepareAudioReview,
  prepareIsolatedReview,
  recordDocumentEvidence,
  runAudioReview,
  runExperienceWorkflow,
  runFigureWorkflow,
  registerSource,
  setSectionStatus,
  syncCitations,
  updateResearchBrief,
  upsertDraft,
  upsertFigurePlan,
  upsertPlan,
} from "../../src/core/internal-api.mjs";
import { importFigureGeneration, prepareFigureGeneration } from "../../src/core/figure-generation.mjs";
import { upsertSystemOrchestrationBoard } from "../../src/core/orchestration.mjs";
import { snapshotReviewedArtifacts } from "../../src/core/review-artifact-snapshot.mjs";
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
    writeJson(root, packet.packetPath, updated);
    const index = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.taskPacketsIndex), "utf8"));
    writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, { ...index, items: index.items.map((item) => item.id === packetId ? updated : item) });
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
  upsertSystemOrchestrationBoard(root, {
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
  const paths = [ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.orchestrationBoard, ARTIFACT_PATHS.orchestrationHandoffs];
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

function rewritePreparedReviewScope(root, prepared, artifactPath, includedPacketIds) {
  const snapshot = snapshotReviewedArtifacts(root, [artifactPath], "coordinated review tamper");
  const inputPath = path.join(root, prepared.inputPath);
  const manifestPath = path.join(root, path.dirname(prepared.inputPath), "manifest.json");
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  input.includedPacketIds = includedPacketIds;
  input.reviewedArtifactPaths = [artifactPath];
  input.reviewedArtifacts = snapshot.reviewedArtifacts;
  input.reviewedArtifactSetSha256 = snapshot.reviewedArtifactSetSha256;
  if (input.reviewerKind === "audio") {
    input.finalPlanPaths = [];
    input.finalResultPaths = [];
    input.explicitArtifactPaths = [artifactPath];
  }
  const inputText = `${JSON.stringify(input, null, 2)}\n`;
  const inputSha256 = crypto.createHash("sha256").update(inputText).digest("hex");
  writeJson(root, prepared.inputPath, input);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.includedPacketIds = includedPacketIds;
  manifest.inputSha256 = inputSha256;
  manifest.reviewedArtifactPaths = [artifactPath];
  manifest.reviewedArtifacts = snapshot.reviewedArtifacts;
  manifest.reviewedArtifactSetSha256 = snapshot.reviewedArtifactSetSha256;
  if (manifest.reviewerKind === "audio") {
    manifest.finalPlanPaths = [];
    manifest.finalResultPaths = [];
    manifest.explicitArtifactPaths = [artifactPath];
  }
  writeJson(root, path.posix.join(path.posix.dirname(prepared.inputPath), "manifest.json"), manifest);
  return { inputSha256, manifestPath };
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

test("coordinated prepared review scope rewrites fail closed with zero import side effects", () => {
  for (const reviewKind of ["isolated", "audio"]) {
    const root = tempRoot(`dove-${reviewKind}-coordinated-scope-tamper-`);
    runFixtureMutation(root, `${reviewKind}-coordinated-scope-tamper`, () => {
      ensureTestWorkspace(root);
      const packetId = seedTaskPacket(root, `${reviewKind}-scope-owner`);
      const ownedArtifact = seedReviewedArtifact(root, `.dove/drafts/${reviewKind}-owned.md`, packetId);
      const ownerPacket = JSON.parse(fs.readFileSync(path.join(root, `.dove/task-packets/packets/${packetId}.json`), "utf8"));
      const foreignPacketId = seedTaskPacket(root, `${reviewKind}-scope-foreign`);
      const foreignArtifact = seedReviewedArtifact(root, `.dove/drafts/${reviewKind}-foreign.md`, foreignPacketId);
      const foreignPacket = JSON.parse(fs.readFileSync(path.join(root, `.dove/task-packets/packets/${foreignPacketId}.json`), "utf8"));
      writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, {
        version: 3,
        items: [ownerPacket, foreignPacket],
        lifecycleCounts: {},
        dependencyHealth: {},
        updatedAt: new Date(0).toISOString()
      });
      const prepared = reviewKind === "audio"
        ? prepareAudioReview(root, { packetId, runId: `${reviewKind}-coordinated-scope`, artifactPaths: [ownedArtifact] })
        : prepareIsolatedReview(root, { packetId, runId: `${reviewKind}-coordinated-scope`, reviewedArtifactPaths: [ownedArtifact] });
      const rewritten = rewritePreparedReviewScope(root, prepared, foreignArtifact, [packetId, foreignPacketId]);
      fs.writeFileSync(path.join(root, prepared.reportPath), `# ${reviewKind} review\n\nCaller-rewritten scope.\n`, "utf8");
      fs.writeFileSync(path.join(root, prepared.handoffPath), `${JSON.stringify({
        runId: prepared.runId,
        status: "completed",
        verdict: "coherent",
        reviewerId: "caller-forged-reviewer",
        summary: "Caller rewrote every prepared scope field and hash.",
        inputPath: prepared.inputPath,
        inputSha256: rewritten.inputSha256,
        reportPath: prepared.reportPath,
        reviewedArtifactPaths: [foreignArtifact],
        findings: [],
        actionItems: []
      }, null, 2)}\n`, "utf8");
      const before = captureReviewSideEffects(root, rewritten.manifestPath);
      const result = reviewKind === "audio"
        ? importAudioReview(root, { packetId, runId: prepared.runId })
        : importIsolatedReview(root, { packetId, runId: prepared.runId });
      assert.equal(result.status, "verification-failed", reviewKind);
      assert.ok(
        result.boundary.failures.includes("canonical-reviewed-artifact-scope-mismatch")
          || result.boundary.failures.includes("canonical-included-packet-set-mismatch"),
        `${reviewKind}: ${result.boundary.failures.join(", ")}`
      );
      assertReviewSideEffectsUnchanged(root, rewritten.manifestPath, before);
    });
  }
});

test("open review proof concern restores Reviewer ownership from a drifted board", () => {
  const root = tempRoot("dove-review-proof-board-drift-");
  return runFixtureMutation(root, "review-proof-board-drift", () => {
    ensureTestWorkspace(root);
    writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
      version: 2,
      items: [{
        id: "drifted-review-proof-required",
        status: "open",
        summary: "Reviewer proof is required.",
        responseOwnerRole: "reviewer"
      }],
      updatedAt: new Date(0).toISOString()
    });
    const boardPath = path.join(root, ARTIFACT_PATHS.orchestrationBoard);
    const driftedBoard = {
      ...loadBoard(root),
      currentPhase: "init",
      assignedRole: "planner"
    };
    writeJson(root, ARTIFACT_PATHS.orchestrationBoard, driftedBoard);
    assert.throws(
      () => upsertSystemOrchestrationBoard(root, {
        phase: "versions",
        assignedRole: "planner"
      }),
      /review-proof-required.*authorized independent Reviewer proof/u
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(boardPath, "utf8")), driftedBoard);
    const restored = upsertSystemOrchestrationBoard(root, {
      phase: "review",
      assignedRole: "reviewer",
      reviewRequiredBeforeFinalize: true
    });
    assert.equal(restored.currentPhase, "review");
    assert.equal(restored.assignedRole, "reviewer");
  });
});

test("same-packet prepared subset rewrites fail closed with zero import side effects", () => {
  for (const reviewKind of ["isolated", "audio"]) {
    const root = tempRoot(`dove-${reviewKind}-same-packet-scope-tamper-`);
    runFixtureMutation(root, `${reviewKind}-same-packet-scope-tamper`, () => {
      ensureTestWorkspace(root);
      const packetId = seedTaskPacket(root, `${reviewKind}-same-packet-owner`);
      const preparedArtifact = seedReviewedArtifact(root, `.dove/drafts/${reviewKind}-prepared.md`, packetId);
      const substitutedArtifact = seedReviewedArtifact(root, `.dove/drafts/${reviewKind}-substituted.md`, packetId);
      const prepared = reviewKind === "audio"
        ? prepareAudioReview(root, { packetId, runId: `${reviewKind}-same-packet-scope`, artifactPaths: [preparedArtifact] })
        : prepareIsolatedReview(root, { packetId, runId: `${reviewKind}-same-packet-scope`, reviewedArtifactPaths: [preparedArtifact] });
      const rewritten = rewritePreparedReviewScope(root, prepared, substitutedArtifact, [packetId]);
      fs.writeFileSync(path.join(root, prepared.reportPath), `# ${reviewKind} review\n\nCaller-rewritten same-packet scope.\n`, "utf8");
      fs.writeFileSync(path.join(root, prepared.handoffPath), `${JSON.stringify({
        runId: prepared.runId,
        status: "completed",
        verdict: "needs-revision",
        reviewerId: "caller-forged-reviewer",
        summary: "Caller replaced the prepared subset with another owned artifact.",
        inputPath: prepared.inputPath,
        inputSha256: rewritten.inputSha256,
        reportPath: prepared.reportPath,
        reviewedArtifactPaths: [substitutedArtifact],
        findings: [{
          id: "substituted-scope",
          severity: "high",
          summary: "Finding on a substituted artifact.",
          linkedArtifactPaths: [substitutedArtifact]
        }],
        actionItems: ["Do not import this finding."]
      }, null, 2)}\n`, "utf8");
      const before = captureReviewSideEffects(root, rewritten.manifestPath);
      const result = reviewKind === "audio"
        ? importAudioReview(root, { packetId, runId: prepared.runId })
        : importIsolatedReview(root, { packetId, runId: prepared.runId });
      assert.equal(result.status, "verification-failed", reviewKind);
      assert.ok(result.boundary.failures.includes("canonical-reviewed-artifact-set-mismatch"));
      assertReviewSideEffectsUnchanged(root, rewritten.manifestPath, before);
    });
  }
});

test("canonical review exchange leaves reject workspace-external symlinks with zero import side effects", () => {
  for (const reviewKind of ["isolated", "audio"]) {
    const root = tempRoot(`dove-${reviewKind}-external-handoff-symlink-`);
    runFixtureMutation(root, `${reviewKind}-external-handoff-symlink`, () => {
      ensureTestWorkspace(root);
      const packetId = seedTaskPacket(root, `${reviewKind}-external-handoff-packet`);
      const artifactPath = seedReviewedArtifact(root, `.dove/drafts/${reviewKind}-external-handoff.md`, packetId);
      const prepared = reviewKind === "audio"
        ? prepareAudioReview(root, { packetId, runId: `${reviewKind}-external-handoff`, artifactPaths: [artifactPath] })
        : prepareIsolatedReview(root, { packetId, runId: `${reviewKind}-external-handoff`, reviewedArtifactPaths: [artifactPath] });
      fs.writeFileSync(path.join(root, prepared.reportPath), `# ${reviewKind} report\n\nReviewed content.\n`, "utf8");
      const outsidePath = path.join(path.dirname(root), `${path.basename(root)}-${reviewKind}-handoff.json`);
      fs.writeFileSync(outsidePath, `${JSON.stringify({
        runId: prepared.runId,
        status: "completed",
        verdict: "needs-revision",
        reviewerId: "external-reviewer",
        summary: "This external handoff must not be imported.",
        inputPath: prepared.inputPath,
        inputSha256: prepared.inputSha256,
        reportPath: prepared.reportPath,
        reviewedArtifactPaths: prepared.reviewedArtifactPaths,
        findings: [],
        actionItems: ["Reject the external symlink."]
      }, null, 2)}\n`, "utf8");
      fs.symlinkSync(outsidePath, path.join(root, prepared.handoffPath));
      const manifestPath = path.join(root, path.dirname(prepared.inputPath), "manifest.json");
      const before = captureReviewSideEffects(root, manifestPath);
      const result = reviewKind === "audio"
        ? importAudioReview(root, { packetId, runId: prepared.runId })
        : importIsolatedReview(root, { packetId, runId: prepared.runId });
      assert.equal(result.status, "verification-failed");
      assert.ok(result.boundary.failures.includes("handoff-unsafe"));
      assertReviewSideEffectsUnchanged(root, manifestPath, before);
      fs.rmSync(outsidePath, { force: true });
    });
  }
});

test("canonical review input leaves reject workspace-external symlinks with zero import side effects", () => {
  for (const reviewKind of ["isolated", "audio"]) {
    const root = tempRoot(`dove-${reviewKind}-external-input-symlink-`);
    runFixtureMutation(root, `${reviewKind}-external-input-symlink`, () => {
      ensureTestWorkspace(root);
      const packetId = seedTaskPacket(root, `${reviewKind}-external-input-packet`);
      const artifactPath = seedReviewedArtifact(root, `.dove/drafts/${reviewKind}-external-input.md`, packetId);
      const prepared = reviewKind === "audio"
        ? prepareAudioReview(root, { packetId, runId: `${reviewKind}-external-input`, artifactPaths: [artifactPath] })
        : prepareIsolatedReview(root, { packetId, runId: `${reviewKind}-external-input`, reviewedArtifactPaths: [artifactPath] });
      fs.writeFileSync(path.join(root, prepared.reportPath), `# ${reviewKind} report\n\nReviewed content.\n`, "utf8");
      fs.writeFileSync(path.join(root, prepared.handoffPath), `${JSON.stringify({
        runId: prepared.runId,
        status: "completed",
        verdict: "coherent",
        reviewerId: "external-input-reviewer",
        summary: "The input symlink must be rejected.",
        inputPath: prepared.inputPath,
        inputSha256: prepared.inputSha256,
        reportPath: prepared.reportPath,
        reviewedArtifactPaths: prepared.reviewedArtifactPaths,
        findings: [],
        actionItems: []
      }, null, 2)}\n`, "utf8");
      const inputPath = path.join(root, prepared.inputPath);
      const outsidePath = path.join(path.dirname(root), `${path.basename(root)}-${reviewKind}-input.json`);
      fs.renameSync(inputPath, outsidePath);
      fs.symlinkSync(outsidePath, inputPath);
      const manifestPath = path.join(root, path.dirname(prepared.inputPath), "manifest.json");
      const before = captureReviewSideEffects(root, manifestPath);
      const result = reviewKind === "audio"
        ? importAudioReview(root, { packetId, runId: prepared.runId })
        : importIsolatedReview(root, { packetId, runId: prepared.runId });
      assert.equal(result.status, "verification-failed");
      assert.ok(result.boundary.failures.includes("input-unsafe"));
      assertReviewSideEffectsUnchanged(root, manifestPath, before);
      fs.rmSync(outsidePath, { force: true });
    });
  }
});

test("open review proof concern blocks noncoherent imports before the first durable import write", () => {
  for (const reviewKind of ["isolated", "audio"]) {
    const root = tempRoot(`dove-${reviewKind}-blocked-import-atomicity-`);
    runFixtureMutation(root, `${reviewKind}-blocked-import-atomicity`, () => {
      ensureTestWorkspace(root);
      const packetId = seedTaskPacket(root, `${reviewKind}-blocked-import-packet`);
      const artifactPath = seedReviewedArtifact(root, `.dove/drafts/${reviewKind}-blocked-import.md`, packetId);
      const prepared = reviewKind === "audio"
        ? prepareAudioReview(root, { packetId, runId: `${reviewKind}-blocked-import`, artifactPaths: [artifactPath] })
        : prepareIsolatedReview(root, { packetId, runId: `${reviewKind}-blocked-import`, reviewedArtifactPaths: [artifactPath] });
      fs.writeFileSync(path.join(root, prepared.reportPath), `# ${reviewKind} report\n\nNeeds revision.\n`, "utf8");
      fs.writeFileSync(path.join(root, prepared.handoffPath), `${JSON.stringify({
        runId: prepared.runId,
        status: "completed",
        verdict: "needs-revision",
        reviewerId: "external-reviewer",
        summary: "Needs revision.",
        inputPath: prepared.inputPath,
        inputSha256: prepared.inputSha256,
        reportPath: prepared.reportPath,
        reviewedArtifactPaths: prepared.reviewedArtifactPaths,
        findings: [{ id: "blocked-import", severity: "high", summary: "Do not partially import this finding.", linkedArtifactPaths: [artifactPath] }],
        actionItems: ["Revise the artifact."]
      }, null, 2)}\n`, "utf8");
      writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
        version: 2,
        items: [{ id: "prior-review-proof-required", packetId, status: "open", summary: "Reviewer proof required.", responseOwnerRole: "reviewer" }],
        updatedAt: new Date(0).toISOString()
      });
      const manifestPath = path.join(root, path.dirname(prepared.inputPath), "manifest.json");
      const before = captureReviewSideEffects(root, manifestPath);
      assert.throws(
        () => reviewKind === "audio"
          ? importAudioReview(root, { packetId, runId: prepared.runId })
          : importIsolatedReview(root, { packetId, runId: prepared.runId }),
        /review-proof-required.*authorized independent Reviewer proof/u
      );
      assertReviewSideEffectsUnchanged(root, manifestPath, before);
    });
  }
});

test("review imports preflight the complete board transition before durable writes", () => {
  for (const reviewKind of ["isolated", "audio"]) {
    for (const verdict of ["needs-revision", "coherent"]) {
      const root = tempRoot(`dove-${reviewKind}-${verdict}-transition-preflight-`);
      runFixtureMutation(root, `${reviewKind}-${verdict}-transition-preflight`, () => {
        ensureTestWorkspace(root);
        const packetId = seedTaskPacket(root, `${reviewKind}-${verdict}-transition-packet`);
        const artifactPath = seedReviewedArtifact(root, `.dove/drafts/${reviewKind}-${verdict}-transition.md`, packetId);
        const prepared = reviewKind === "audio"
          ? prepareAudioReview(root, { packetId, runId: `${reviewKind}-${verdict}-transition`, artifactPaths: [artifactPath] })
          : prepareIsolatedReview(root, { packetId, runId: `${reviewKind}-${verdict}-transition`, reviewedArtifactPaths: [artifactPath] });
        fs.writeFileSync(path.join(root, prepared.reportPath), `# ${reviewKind} report\n\nTransition preflight review.\n`, "utf8");
        fs.writeFileSync(path.join(root, prepared.handoffPath), `${JSON.stringify({
          runId: prepared.runId,
          status: "completed",
          verdict,
          reviewerId: "transition-preflight-reviewer",
          summary: "This import must fail before any durable review write.",
          inputPath: prepared.inputPath,
          inputSha256: prepared.inputSha256,
          reportPath: prepared.reportPath,
          reviewedArtifactPaths: prepared.reviewedArtifactPaths,
          findings: verdict === "coherent" ? [] : [{ id: "transition-preflight", severity: "high", summary: "Needs revision.", linkedArtifactPaths: [artifactPath] }],
          actionItems: verdict === "coherent" ? [] : ["Revise the artifact."]
        }, null, 2)}\n`, "utf8");
        const statePath = path.join(root, ARTIFACT_PATHS.state);
        const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
        writeJson(root, ARTIFACT_PATHS.state, {
          ...state,
          settings: {
            ...state.settings,
            strictMode: true
          }
        });
        const driftedBoard = {
          ...loadBoard(root),
          currentPhase: "plan",
          assignedRole: "planner"
        };
        writeJson(root, ARTIFACT_PATHS.orchestrationBoard, driftedBoard);
        const manifestPath = path.join(root, path.dirname(prepared.inputPath), "manifest.json");
        const before = captureReviewSideEffects(root, manifestPath);
        assert.throws(
          () => reviewKind === "audio"
            ? importAudioReview(root, { packetId, runId: prepared.runId })
            : importIsolatedReview(root, { packetId, runId: prepared.runId }),
          /Illegal orchestration phase transition/u
        );
        assertReviewSideEffectsUnchanged(root, manifestPath, before);
      });
    }
  }
});

test("open review proof concern blocks composite experience and figure writes", () => {
  const root = tempRoot("dove-review-proof-composite-workflows-");
  return runFixtureMutation(root, "review-proof-composite-workflows", () => {
    ensureTestWorkspace(root);
    const packetId = seedTaskPacket(root, "review-proof-composite-packet");
    writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
      version: 2,
      items: [{ id: "composite-review-proof-required", packetId, status: "open", summary: "Reviewer proof required.", responseOwnerRole: "reviewer" }],
      updatedAt: new Date(0).toISOString()
    });
    upsertSystemOrchestrationBoard(root, { phase: "review", assignedRole: "reviewer", reviewRequiredBeforeFinalize: true });
    const paths = [
      ARTIFACT_PATHS.experimentPlans,
      ARTIFACT_PATHS.figuresIndex,
      ARTIFACT_PATHS.figureMaterials,
      ARTIFACT_PATHS.figureGenerations
    ];
    const before = Object.fromEntries(paths.map((relativePath) => [relativePath, fs.readFileSync(path.join(root, relativePath), "utf8")]));
    assert.throws(
      () => runExperienceWorkflow(root, { packetId, experimentId: "blocked-experiment", goal: "Blocked experiment", methodology: "Do real work", successMetric: "Pass" }),
      /review-proof-required.*authorized independent Reviewer proof/u
    );
    assert.throws(
      () => upsertFigurePlan(root, { packetId, items: [{ id: "blocked-figure", name: "Blocked figure", purpose: "Do not write", narrativeIntent: "Do not write" }] }),
      /review-proof-required.*authorized independent Reviewer proof/u
    );
    assert.throws(
      () => runFigureWorkflow(root, { packetId, figureId: "blocked-workflow-figure", intent: "Do not write a figure workflow", purpose: "Do not write", narrativeIntent: "Do not write", allowMissingMaterials: true }),
      /review-proof-required.*authorized independent Reviewer proof/u
    );
    assert.throws(
      () => prepareFigureGeneration(root, { packetId, figureId: "blocked-figure", runId: "blocked-generation" }),
      /review-proof-required.*authorized independent Reviewer proof/u
    );
    for (const relativePath of paths) {
      assert.equal(fs.readFileSync(path.join(root, relativePath), "utf8"), before[relativePath], relativePath);
    }
  });
});

test("open review proof concern blocks figure import and other public composite writes", () => {
  const root = tempRoot("dove-review-proof-public-composites-");
  return runFixtureMutation(root, "review-proof-public-composites", () => {
    ensureTestWorkspace(root);
    const packetId = seedTaskPacket(root, "review-proof-public-composite-packet");
    seedReviewedArtifact(root, ".dove/drafts/review-proof-section.md", packetId);
    upsertFigurePlan(root, {
      packetId,
      items: [{
        id: "review-proof-import-figure",
        name: "Review proof import figure",
        purpose: "Exercise the guarded import path.",
        narrativeIntent: "Exercise the guarded import path.",
        finalSvgPath: ".dove/figures/review-proof-import-figure.final.svg"
      }]
    });
    const prepared = prepareFigureGeneration(root, {
      packetId,
      figureId: "review-proof-import-figure",
      runId: "review-proof-import-run"
    });
    writeJson(root, ARTIFACT_PATHS.reviewConcerns, {
      version: 2,
      items: [{ id: "public-composite-review-proof-required", packetId, status: "open", summary: "Reviewer proof required.", responseOwnerRole: "reviewer" }],
      updatedAt: new Date(0).toISOString()
    });
    upsertSystemOrchestrationBoard(root, { phase: "review", assignedRole: "reviewer", reviewRequiredBeforeFinalize: true });
    const trackedPaths = [
      ARTIFACT_PATHS.figureGenerations,
      ARTIFACT_PATHS.figureCaptions,
      ARTIFACT_PATHS.figureFinalIndex,
      ARTIFACT_PATHS.documentsLedger,
      ARTIFACT_PATHS.researchAgenda,
      ARTIFACT_PATHS.researchBrief,
      ARTIFACT_PATHS.state,
      ARTIFACT_PATHS.orchestrationBoard
    ];
    const before = Object.fromEntries(trackedPaths.map((relativePath) => {
      const fullPath = path.join(root, relativePath);
      return [relativePath, fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : null];
    }));
    const finalSvgPath = path.join(root, ".dove/figures/review-proof-import-figure.final.svg");
    const generatedDocumentPath = path.join(root, ARTIFACT_PATHS.documentsDir, "report", "unauthorized-review-proof.md");

    assert.throws(
      () => importFigureGeneration(root, {
        packetId,
        figureId: "review-proof-import-figure",
        runId: prepared.runId,
        svgContent: '<svg xmlns="http://www.w3.org/2000/svg"><text>blocked</text></svg>'
      }),
      /review-proof-required.*authorized independent Reviewer proof/u
    );
    assert.throws(
      () => recordDocumentEvidence(root, {
        packetId,
        title: "Unauthorized review proof",
        documentPath: ".dove/documents/report/unauthorized-review-proof.md",
        documentKind: "report",
        createDocument: true,
        body: "# Unauthorized\n\nThis must not be written.\n"
      }),
      /review-proof-required.*authorized independent Reviewer proof/u
    );
    assert.throws(
      () => updateResearchBrief(root, {
        packetId,
        objective: "Unauthorized research",
        agenda: ["Do not write this brief."]
      }),
      /review-proof-required.*authorized independent Reviewer proof/u
    );
    assert.throws(
      () => setSectionStatus(root, {
        packetId,
        sectionId: "review-proof-section",
        status: "planned"
      }),
      /review-proof-required.*authorized independent Reviewer proof/u
    );

    assert.equal(fs.existsSync(finalSvgPath), false);
    assert.equal(fs.existsSync(generatedDocumentPath), false);
    for (const [relativePath, contents] of Object.entries(before)) {
      const fullPath = path.join(root, relativePath);
      assert.equal(fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : null, contents, relativePath);
    }
  });
});

test("audio review rejects poisoned manifest identity and artifact classifications", () => {
  const root = tempRoot("dove-audio-manifest-poison-");
  return runFixtureMutation(root, "audio-manifest-poison", () => {
    ensureTestWorkspace(root);
    const packetId = seedTaskPacket(root, "audio-manifest-poison-packet");
    const artifactPath = seedReviewedArtifact(root, ".dove/drafts/audio-manifest-poison.md", packetId);
    const prepared = prepareAudioReview(root, {
      packetId,
      runId: "audio-manifest-poison",
      artifactPaths: [artifactPath]
    });
    writeAudioReturn(root, prepared);
    const manifestPath = path.join(root, ARTIFACT_PATHS.audioReviewsDir, prepared.runId, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    writeJson(root, path.posix.join(ARTIFACT_PATHS.audioReviewsDir, prepared.runId, "manifest.json"), {
      ...manifest,
      runId: "forged-run",
      finalPlanPaths: ["../../outside.md"],
      finalResultPaths: [".dove/drafts/not-reviewed.md"],
      explicitArtifactPaths: ["https://attacker.example/x"]
    });
    const before = captureReviewSideEffects(root, manifestPath);
    const result = importAudioReview(root, { packetId, runId: prepared.runId });
    assert.equal(result.status, "verification-failed");
    assert.ok(result.boundary.failures.includes("canonical-run-id-mismatch"));
    assert.ok(result.boundary.failures.some((failure) => failure.startsWith("canonical-audio-")));
    assertReviewSideEffectsUnchanged(root, manifestPath, before);
  });
});

test("public isolated review import remains non-authoritative without trusted Reviewer runtime capability", () => {
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
  assert.equal(imported.verdict, "needs-evidence");
  assert.equal(imported.importedVerdict, "coherent");
  assert.equal(imported.authoritative, false);
  assert.equal(imported.independentReviewProof, null);
  assert.equal(imported.reviewProofRequired, true);
  assert.ok(imported.proofFailures.includes("reviewer-runtime-authorization-required"));
  assert.equal(imported.boundary.type, "review-proof-required");
  assert.equal(imported.ownerRole, "reviewer");
  assert.equal(imported.nextRole, "reviewer");
  const reviewState = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.reviewState), "utf8"));
  assert.equal(reviewState.lastVerdict, "needs-evidence");
  assert.match(reviewState.history.at(-1).summary, /approved Reviewer runtime execution claim/u);
  assert.ok(reviewState.history.at(-1).reviewedArtifactPaths.includes(artifactPath));
  const board = loadBoard(root);
  assert.equal(board.currentPhase, "review");
  assert.equal(board.assignedRole, "reviewer");
  assert.match(board.nextAction, /authoritative proof.*approved Reviewer runtime execution claim/u);
  const statePath = path.join(root, ARTIFACT_PATHS.state);
  const planPath = path.join(root, ARTIFACT_PATHS.plan);
  const stateBeforePlanAttempt = fs.readFileSync(statePath, "utf8");
  const planBeforePlanAttempt = fs.existsSync(planPath) ? fs.readFileSync(planPath, "utf8") : null;
  assert.throws(
    () => upsertPlan(root, { packetId, thesis: "Caller cannot take ownership from Reviewer." }),
    /review-proof-required.*authorized independent Reviewer proof/u
  );
  assert.equal(fs.readFileSync(statePath, "utf8"), stateBeforePlanAttempt);
  assert.equal(fs.existsSync(planPath) ? fs.readFileSync(planPath, "utf8") : null, planBeforePlanAttempt);
  const boardAfterPlanAttempt = loadBoard(root);
  assert.equal(boardAfterPlanAttempt.currentPhase, "review");
  assert.equal(boardAfterPlanAttempt.assignedRole, "reviewer");
  assert.equal(boardAfterPlanAttempt.reviewRequiredBeforeFinalize, true);
  const draftPath = path.join(root, ".dove/drafts/review-proof-partial-write.md");
  assert.equal(fs.existsSync(draftPath), false);
  assert.throws(
    () => upsertDraft(root, {
      packetId,
      sectionId: "review-proof-partial-write",
      title: "Blocked draft",
      body: "# Blocked draft\n\nThis must not be written.\n"
    }),
    /review-proof-required.*authorized independent Reviewer proof/u
  );
  assert.equal(fs.existsSync(draftPath), false);
  const sourcesPath = path.join(root, ARTIFACT_PATHS.sources);
  const sourcesBefore = fs.readFileSync(sourcesPath, "utf8");
  assert.throws(
    () => registerSource(root, {
      packetId,
      citationKey: "blocked-review-source",
      title: "Blocked review source",
      locator: "https://example.org/blocked-review-source"
    }),
    /review-proof-required.*authorized independent Reviewer proof/u
  );
  assert.equal(fs.readFileSync(sourcesPath, "utf8"), sourcesBefore);
  const handoffs = fs.readFileSync(path.join(root, ARTIFACT_PATHS.orchestrationHandoffs), "utf8");
  assert.doesNotMatch(handoffs, /reviewer -> planner/u);
  assert.match(handoffs, /reviewer -> reviewer/u);
  assert.match(handoffs, /Reviewer ownership is retained/u);
  const manifestPath = path.join(root, ARTIFACT_PATHS.isolatedReviewsDir, prepared.runId, "manifest.json");
  const forgedManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  forgedManifest.reviewerId = "caller-forged-reviewer";
  forgedManifest.independentReviewProof = { verified: true, authoritative: true };
  fs.writeFileSync(manifestPath, `${JSON.stringify(forgedManifest, null, 2)}\n`, "utf8");
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

test("public coherent audio review import remains Reviewer-owned without authoritative proof", () => {
  const root = tempRoot("dove-audio-review-proof-boundary-");
  return runFixtureMutation(root, "audio-review-public-coherent-remains-reviewer-owned", () => {
  ensureTestWorkspace(root);
  const packetId = seedTaskPacket(root, "audio-proof-boundary-packet");
  upsertSystemOrchestrationBoard(root, {
    phase: "plan",
    assignedRole: "planner"
  });
  const artifactPath = seedReviewedArtifact(
    root,
    ".dove/drafts/audio-proof-boundary.md",
    packetId
  );
  const prepared = prepareAudioReview(root, {
    packetId,
    runId: "audio-proof-boundary",
    artifactPaths: [artifactPath]
  });
  writeAudioReturn(root, prepared, {
    verdict: "coherent",
    summary: "Caller-authored coherent audio handoff.",
    findings: [],
    actionItems: []
  });
  const preparedManifestPath = path.join(
    root,
    ARTIFACT_PATHS.audioReviewsDir,
    prepared.runId,
    "manifest.json"
  );
  const preparedManifest = JSON.parse(
    fs.readFileSync(preparedManifestPath, "utf8")
  );
  fs.writeFileSync(
    preparedManifestPath,
    `${JSON.stringify({
      ...preparedManifest,
      authoritative: true,
      independentReviewProof: { authoritative: true },
      reviewProofRequired: false
    }, null, 2)}\n`,
    "utf8"
  );
  const handoff = JSON.parse(
    fs.readFileSync(path.join(root, prepared.handoffPath), "utf8")
  );
  handoff.reviewerId = "caller-forged-reviewer";
  fs.writeFileSync(
    path.join(root, prepared.handoffPath),
    `${JSON.stringify(handoff, null, 2)}\n`,
    "utf8"
  );

  const imported = importAudioReview(root, {
    packetId,
    runId: prepared.runId
  });
  assert.equal(imported.status, "imported");
  assert.equal(imported.verdict, "needs-evidence");
  assert.equal(imported.importedVerdict, "coherent");
  assert.equal(imported.authoritative, false);
  assert.equal(imported.independentReviewProof, null);
  assert.equal(imported.reviewProofRequired, true);
  assert.ok(imported.proofFailures.includes("reviewer-runtime-authorization-required"));
  assert.equal(imported.boundary.type, "review-proof-required");
  assert.equal(imported.ownerRole, "reviewer");
  assert.equal(imported.nextRole, "reviewer");
  assert.deepEqual(
    imported.resultCard.nextActions[0].requiredActions,
    ["submit-authoritative-reviewer-runtime-proof"]
  );
  assert.match(
    imported.resultCard.nextActions[0].title,
    /Reviewer proof/u
  );
  assert.equal(imported.resultCard.requiresAction, true);

  const reviewState = JSON.parse(
    fs.readFileSync(path.join(root, ARTIFACT_PATHS.reviewState), "utf8")
  );
  assert.equal(reviewState.lastVerdict, "needs-evidence");
  assert.equal(reviewState.history.at(-1).importedVerdict, "coherent");
  assert.equal(reviewState.history.at(-1).authoritative, false);
  assert.ok(reviewState.history.at(-1).reviewedArtifactPaths.includes(artifactPath));
  const concerns = JSON.parse(
    fs.readFileSync(path.join(root, ARTIFACT_PATHS.reviewConcerns), "utf8")
  );
  assert.ok(
    concerns.items.some(
      (item) => item.id === "audio-audio-proof-boundary-review-proof-required"
        && item.status === "open"
        && item.responseOwnerRole === "reviewer"
    )
  );

  const board = loadBoard(root);
  assert.equal(board.currentPhase, "review");
  assert.equal(board.assignedRole, "reviewer");
  assert.equal(board.reviewRequiredBeforeFinalize, true);
  const importedManifest = JSON.parse(
    fs.readFileSync(
      path.join(root, ARTIFACT_PATHS.audioReviewsDir, prepared.runId, "manifest.json"),
      "utf8"
    )
  );
  assert.equal(importedManifest.authoritative, false);
  assert.equal(importedManifest.independentReviewProof, null);
  assert.equal(importedManifest.reviewProofRequired, true);
  assert.match(
    board.nextAction,
    /authoritative proof.*approved Reviewer runtime execution claim/u
  );
  const handoffs = fs.readFileSync(
    path.join(root, ARTIFACT_PATHS.orchestrationHandoffs),
    "utf8"
  );
  assert.doesNotMatch(handoffs, /reviewer -> planner/u);
  assert.match(handoffs, /reviewer -> reviewer/u);
  assert.match(handoffs, /Reviewer ownership is retained/u);

  syncCitations(root, { preservePhase: true });
  const boardAfterCitationSync = loadBoard(root);
  assert.equal(boardAfterCitationSync.currentPhase, "review");
  assert.equal(boardAfterCitationSync.assignedRole, "reviewer");
  assert.equal(boardAfterCitationSync.reviewRequiredBeforeFinalize, true);
  assert.throws(
    () => createVersionSnapshot(root, {
      packetId,
      versionId: "audio-proof-bypass-attempt"
    }),
    /current final draft|canonical finalization review gate|authorized independent Reviewer proof/u
  );
  });
});

test("audio review run cannot promote a caller-authored coherent return", () => {
  const root = tempRoot("dove-audio-review-run-proof-boundary-");
  return runFixtureMutation(root, "audio-review-run-coherent-remains-reviewer-owned", () => {
  ensureTestWorkspace(root);
  const packetId = seedTaskPacket(root, "audio-run-proof-boundary-packet");
  const artifactPath = seedReviewedArtifact(
    root,
    ".dove/drafts/audio-run-proof-boundary.md",
    packetId
  );
  const prepared = prepareAudioReview(root, {
    packetId,
    runId: "audio-run-proof-boundary",
    artifactPaths: [artifactPath]
  });
  assert.equal(loadBoard(root).reviewRequiredBeforeFinalize, true);
  writeAudioReturn(root, prepared, {
    verdict: "coherent",
    summary: "Caller-authored coherent return through run surface.",
    findings: [],
    actionItems: []
  });

  const result = runAudioReview(root, {
    packetId,
    runId: prepared.runId,
    artifactPaths: [artifactPath]
  });
  assert.equal(result.status, "imported");
  assert.equal(result.verdict, "needs-evidence");
  assert.equal(result.reviewProofRequired, true);
  assert.equal(result.imported.authoritative, false);
  assert.equal(result.imported.boundary.type, "review-proof-required");
  const board = loadBoard(root);
  assert.equal(board.currentPhase, "review");
  assert.equal(board.assignedRole, "reviewer");
  assert.equal(board.reviewRequiredBeforeFinalize, true);
  });
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
  upsertSystemOrchestrationBoard(root, {
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
  assert.equal(reviewBoard.reviewRequiredBeforeFinalize, true);
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
