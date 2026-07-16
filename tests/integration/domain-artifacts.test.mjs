import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createDoveMission } from "../../src/core/mission-contracts.mjs";
import { ingestExecutionReceipt } from "../../src/core/execution-receipts.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { recordTrustedSourceVerification, registerSource, verifySource } from "../../src/core/source-trust.mjs";
import {
  buildRebuttal,
  buildRebuttalStrategy,
  compareVersions,
  createVersionSnapshot,
  normalizeRebuttalIssues,
  runExperienceWorkflow,
  runFigureWorkflow,
  upsertClaims,
  upsertDraft,
  upsertNote
} from "../../src/core/retained-domain-workflows.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function write(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function sha256(root, relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relativePath))).digest("hex");
}

function tree(root) {
  const result = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else result[path.relative(root, fullPath)] = fs.readFileSync(fullPath).toString("base64");
    }
  };
  visit(root);
  return result;
}

function mutate(root, actionId, callback, mutationMode = "direct-process") {
  return runWithMutationContext(root, { actionId, mutationMode, hostId: "test" }, callback);
}

function mission(root, missionId = "domain-mission") {
  const proposal = createDoveMission(root, { missionId, goal: `Exercise ${missionId} domain workflows.`, completionCriteria: [], evidenceRequirements: [] });
  return mutate(root, "create-dove-mission", () => createDoveMission(root, proposal.confirmation.confirmArgs)).mission;
}

function ownArtifact(root, currentMission, relativePath, content, kind = "data", receiptId = `seed-${crypto.randomUUID()}`) {
  write(root, relativePath, content);
  return mutate(root, "ingest-execution-receipt", () => ingestExecutionReceipt(root, {
    receiptId,
    missionId: currentMission.missionId,
    contractDigest: currentMission.contractDigest,
    summary: `Own ${relativePath}.`,
    artifacts: [{ path: relativePath, kind, sha256: sha256(root, relativePath) }],
    validations: [],
    criteriaSatisfied: [],
    producedAt: new Date().toISOString()
  }));
}

function receiptFiles(root) {
  return fs.readdirSync(path.join(root, ".dove/receipts/execution")).filter((name) => name.endsWith(".json"));
}

test("source candidates import captured material, public rejection is explicit, and positive trust fails closed", () => {
  const root = createTempRoot("dove-domain-source-");
  const currentMission = mission(root);
  write(root, "inputs/paper.pdf", Buffer.from("captured paper material"));

  const registered = mutate(root, "register-source", () => registerSource(root, {
    missionId: currentMission.missionId,
    sourceId: "paper-one",
    title: "Paper One",
    locator: "https://example.test/paper-one",
    capturePath: "inputs/paper.pdf"
  }));
  assert.equal(registered.source.lifecycle, "candidate");
  assert.equal(registered.source.capturedMaterial.path, ".dove/sources/materials/paper-one.pdf");
  assert.equal(fs.existsSync(path.join(root, registered.source.capturedMaterial.path)), true);
  assert.equal(registered.completionEligible, false);

  const beforePositive = tree(root);
  assert.throws(() => recordTrustedSourceVerification(root, { missionId: currentMission.missionId, sourceId: "paper-one", receiptId: registered.receipt.receiptId }), /positive source verification is unavailable/u);
  assert.deepEqual(tree(root), beforePositive);

  const rejected = mutate(root, "verify-source", () => verifySource(root, {
    missionId: currentMission.missionId,
    sourceId: "paper-one",
    method: "manual material audit",
    checkedMaterial: "captured PDF",
    auditEvidence: [{ reference: "page 1", kind: "capture", observation: "Identity does not match the claimed paper." }]
  }));
  assert.equal(rejected.source.lifecycle, "rejected");
  assert.equal(rejected.source.currentDecision.decision, "rejected");

  const storedPath = path.join(root, ".dove/sources/paper-one.json");
  const stored = JSON.parse(fs.readFileSync(storedPath, "utf8"));
  stored.lifecycle = "verified";
  stored.currentDecision = { decision: "verified", decidedAt: new Date().toISOString() };
  fs.writeFileSync(storedPath, `${JSON.stringify(stored, null, 2)}\n`);
  assert.throws(() => mutate(root, "register-source", () => registerSource(root, { missionId: currentMission.missionId, sourceId: "other", title: "Other", capturePath: "inputs/paper.pdf" })), /stored verified source state is invalid/u);
});

test("notes and drafts require current mission-owned evidence and preflight drift before writing", () => {
  const root = createTempRoot("dove-domain-note-draft-");
  const currentMission = mission(root);
  ownArtifact(root, currentMission, "outputs/evidence.txt", "current evidence\n", "report", "seed-evidence");

  const note = mutate(root, "upsert-note", () => upsertNote(root, {
    missionId: currentMission.missionId,
    noteId: "synthesis",
    summary: "The current artifact supports the implementation claim.",
    artifactRefs: ["outputs/evidence.txt"]
  }));
  assert.equal(note.note.summary.includes("supports"), true);
  assert.equal(note.completionEligible, false);

  const draft = mutate(root, "upsert-draft", () => upsertDraft(root, {
    missionId: currentMission.missionId,
    draftId: "methods",
    title: "Methods",
    body: "We evaluate the method against the current evidence artifact.",
    evidenceRefs: ["artifact:outputs/evidence.txt"]
  }));
  assert.match(fs.readFileSync(path.join(root, ".dove/drafts/methods.md"), "utf8"), /We evaluate the method/u);
  assert.equal(draft.receipt.criteriaSatisfied.length, 0);

  assert.throws(() => mutate(root, "upsert-draft", () => upsertDraft(root, {
    missionId: currentMission.missionId,
    draftId: "unsupported",
    body: "Body without evidence."
  })), /requires at least one current eligible evidence/u);

  write(root, "outputs/evidence.txt", "drifted evidence\n");
  const before = tree(root);
  assert.throws(() => mutate(root, "upsert-note", () => upsertNote(root, {
    missionId: currentMission.missionId,
    noteId: "should-not-write",
    summary: "This must fail.",
    artifactRefs: ["outputs/evidence.txt"]
  })), /changed since its latest ownership receipt/u);
  assert.deepEqual(tree(root), before);
});

test("experiment protocol result audit and claim bridge use one preflighted implementation", () => {
  const root = createTempRoot("dove-domain-experiment-");
  const currentMission = mission(root);
  ownArtifact(root, currentMission, "outputs/result.json", "{\"score\":0.91}\n", "data", "seed-result");
  mutate(root, "upsert-claims", () => upsertClaims(root, {
    missionId: currentMission.missionId,
    claims: [{ claimId: "quality-gain", text: "The method improves quality.", artifactRefs: ["outputs/result.json"] }]
  }));

  const beforeFailure = tree(root);
  assert.throws(() => mutate(root, "run-experience-workflow", () => runExperienceWorkflow(root, {
    missionId: currentMission.missionId,
    experimentId: "quality-ablation",
    goal: "Measure quality gain.",
    hypothesis: "The new method improves the score.",
    protocol: "Run the fixed benchmark once with identical inputs.",
    successCriteria: ["Score exceeds 0.90"],
    result: "The score reached 0.91.",
    resultEvidenceRefs: ["artifact:outputs/result.json"],
    auditFindings: ["The protocol and output are present."],
    integrityFlags: ["seed mismatch"],
    claimId: "quality-gain",
    bridgeReason: "The audited result supports the claim."
  })), /cannot bridge to a claim/u);
  assert.deepEqual(tree(root), beforeFailure);

  const receiptCount = receiptFiles(root).length;
  const completed = mutate(root, "run-experience-workflow", () => runExperienceWorkflow(root, {
    missionId: currentMission.missionId,
    experimentId: "quality-ablation",
    goal: "Measure quality gain.",
    hypothesis: "The new method improves the score.",
    protocol: "Run the fixed benchmark once with identical inputs.",
    successCriteria: ["Score exceeds 0.90"],
    result: "The score reached 0.91.",
    resultEvidenceRefs: ["artifact:outputs/result.json"],
    auditFindings: ["The protocol and output are present."],
    integrityFlags: [],
    claimId: "quality-gain",
    bridgeReason: "The audited result supports the claim."
  }));
  assert.equal(completed.audit.passed, true);
  assert.equal(completed.bridge.claimId, "quality-gain");
  assert.equal(receiptFiles(root).length, receiptCount + 1);
  for (const suffix of ["plan", "result", "audit"]) assert.equal(fs.existsSync(path.join(root, `.dove/experiments/quality-ablation.${suffix}.json`)), true);
  assert.equal(fs.existsSync(path.join(root, ".dove/claims/quality-ablation-quality-gain.bridge.json")), true);
});

test("figure workflow keeps provider execution host-side and imports exact output with caption QA and proof boundary", () => {
  const root = createTempRoot("dove-domain-figure-");
  const currentMission = mission(root);
  ownArtifact(root, currentMission, "outputs/material.csv", "x,y\n1,2\n", "data", "seed-material");
  write(root, "outputs/figure.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Result</text></svg>\n");

  const beforeMismatch = tree(root);
  assert.throws(() => mutate(root, "run-figure-workflow", () => runFigureWorkflow(root, {
    missionId: currentMission.missionId,
    figureId: "main-result",
    intent: "Show the main result.",
    purpose: "Explain the measured improvement.",
    materials: ["outputs/material.csv"],
    prompt: "Draw a clean result chart.",
    outputPath: "outputs/figure.svg",
    outputSha256: "0".repeat(64),
    caption: "Main result.",
    qaFindings: []
  })), /hash does not match/u);
  assert.deepEqual(tree(root), beforeMismatch);

  const imported = mutate(root, "run-figure-workflow", () => runFigureWorkflow(root, {
    missionId: currentMission.missionId,
    figureId: "main-result",
    intent: "Show the main result.",
    purpose: "Explain the measured improvement.",
    materials: ["outputs/material.csv"],
    prompt: "Draw a clean result chart.",
    outputPath: "outputs/figure.svg",
    outputSha256: sha256(root, "outputs/figure.svg"),
    caption: "Main result with measured improvement.",
    qaFindings: []
  }));
  assert.equal(imported.hostBoundary.executesProvider, false);
  assert.equal(imported.imported.validated, false);
  assert.equal(imported.qa.status, "ready-for-independent-review");
  assert.equal(imported.qa.reviewCoverage.covered, false);
  assert.deepEqual(imported.qa.reviewCoverage.requestedArtifactPaths, [".dove/figures/main-result.final.svg"]);
  assert.equal(imported.qa.reviewCoverage.requestedArtifactSetSha256?.length, 64);
  assert.ok(imported.qa.reviewCoverage.failures.includes("trusted-review-issuer-missing"));
  assert.equal(fs.existsSync(path.join(root, ".dove/figures/main-result.final.svg")), true);
  assert.equal(fs.existsSync(path.join(root, ".dove/figures/main-result.caption.md")), true);

  write(root, "outputs/empty.svg", "");
  assert.throws(() => mutate(root, "run-figure-workflow", () => runFigureWorkflow(root, {
    missionId: currentMission.missionId,
    figureId: "empty-result",
    intent: "Reject empty output.",
    purpose: "Validate import boundary.",
    materials: ["outputs/material.csv"],
    prompt: "Draw.",
    outputPath: "outputs/empty.svg",
    caption: "Empty."
  })), /non-empty regular file|empty file/u);
  fs.symlinkSync("figure.svg", path.join(root, "outputs/figure-alias.svg"));
  assert.throws(() => mutate(root, "run-figure-workflow", () => runFigureWorkflow(root, {
    missionId: currentMission.missionId,
    figureId: "alias-result",
    intent: "Reject alias output.",
    purpose: "Validate import boundary.",
    materials: ["outputs/material.csv"],
    prompt: "Draw.",
    outputPath: "outputs/figure-alias.svg",
    caption: "Alias."
  })), /canonical realpath-contained path|symlink or alias/u);
});

test("rebuttal requires concrete current finding linkage and version comparison uses immutable snapshot copies", () => {
  const root = createTempRoot("dove-domain-rebuttal-version-");
  const currentMission = mission(root);
  ownArtifact(root, currentMission, "outputs/evidence.md", "Evidence v1\n", "document", "seed-version-evidence");
  ownArtifact(root, currentMission, ".dove/reviews/review-one.json", JSON.stringify({ schemaVersion: 1, missionId: currentMission.missionId, findings: [{ findingId: "missing-baseline", summary: "Add a baseline." }] }, null, 2), "report", "seed-review");

  const beforeBadFinding = tree(root);
  assert.throws(() => mutate(root, "normalize-rebuttal-issues", () => normalizeRebuttalIssues(root, {
    missionId: currentMission.missionId,
    issues: [{ issueId: "issue-one", summary: "Address the baseline concern.", findingRefs: [".dove/reviews/review-one.json#unknown"], evidenceRefs: ["artifact:outputs/evidence.md"] }]
  })), /does not resolve to a mission-bound review finding/u);
  assert.deepEqual(tree(root), beforeBadFinding);

  mutate(root, "normalize-rebuttal-issues", () => normalizeRebuttalIssues(root, {
    missionId: currentMission.missionId,
    issues: [{ issueId: "issue-one", summary: "Address the baseline concern.", findingRefs: [".dove/reviews/review-one.json#missing-baseline"], evidenceRefs: ["artifact:outputs/evidence.md"] }]
  }));
  mutate(root, "build-rebuttal-strategy", () => buildRebuttalStrategy(root, { missionId: currentMission.missionId, strategy: "Add the requested baseline and report the result." }));
  mutate(root, "build-rebuttal", () => buildRebuttal(root, {
    missionId: currentMission.missionId,
    responses: [{ issueId: "issue-one", response: "We added the baseline and linked the evidence.", evidenceRefs: ["artifact:outputs/evidence.md"] }]
  }));
  assert.match(fs.readFileSync(path.join(root, `.dove/rebuttal/${currentMission.missionId}.response.md`), "utf8"), /We added the baseline/u);

  mutate(root, "create-version-snapshot", () => createVersionSnapshot(root, { missionId: currentMission.missionId, versionId: "v1", artifactRefs: ["outputs/evidence.md"] }));
  write(root, "outputs/evidence.md", "Evidence v2\n");
  mutate(root, "upsert-draft", () => upsertDraft(root, { missionId: currentMission.missionId, draftId: "revision", body: "Revision text.", artifactRefs: [".dove/rebuttal/domain-mission.response.md"] }));
  ownArtifact(root, currentMission, "outputs/evidence-v2.md", "Evidence v2\n", "document", "seed-version-evidence-v2");
  mutate(root, "create-version-snapshot", () => createVersionSnapshot(root, { missionId: currentMission.missionId, versionId: "v2", artifactRefs: ["outputs/evidence-v2.md"], supersedesVersionId: "v1" }));
  const comparison = mutate(root, "compare-versions", () => compareVersions(root, { missionId: currentMission.missionId, fromVersionId: "v1", toVersionId: "v2" }));
  assert.deepEqual(comparison.artifacts.map((item) => item.path), [".dove/versions/v1--v2.comparison.json"]);
  const comparisonRecord = JSON.parse(fs.readFileSync(path.join(root, ".dove/versions/v1--v2.comparison.json"), "utf8"));
  assert.deepEqual(comparisonRecord.added, ["outputs/evidence-v2.md"]);
  assert.deepEqual(comparisonRecord.removed, ["outputs/evidence.md"]);

  const beforeFinalize = tree(root);
  assert.throws(() => mutate(root, "create-version-snapshot", () => createVersionSnapshot(root, { missionId: currentMission.missionId, versionId: "final", artifactRefs: ["outputs/evidence-v2.md"], finalize: true })), /finalization requires current mission completion and current authoritative review proof/u);
  assert.deepEqual(tree(root), beforeFinalize);
});
