import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ingestExecutionReceipt } from "../../src/core/execution-receipts.mjs";
import { createDoveMission } from "../../src/core/mission-contracts.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { evidenceDigest } from "../../src/core/evidence-contracts.mjs";
import { registerSource, SOURCE_USE_LIMITATION, verifySource } from "../../src/core/source-trust.mjs";
import { recordDoveDraft, recordDoveFigure, recordDoveRebuttal, runExperienceWorkflow, upsertClaims } from "../../src/core/retained-domain-workflows.mjs";
import { openDoveWorkspace } from "../../src/core/workspace-schema.mjs";
import { reviewMissionBinding } from "../../src/core/review-mission-binding.mjs";
import { archiveReviewRecord, scopeReviewRecord } from "../../src/core/review-records.mjs";
import { inspectDoveWorkspace } from "../../src/core/workspace-schema.mjs";
import { initializeWorkspace } from "../helpers/current-schema-workspace.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function write(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}
function sha256(root, relativePath) { return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relativePath))).digest("hex"); }
function mutate(root, actionId, callback) { return runWithMutationContext(root, { actionId, mutationMode: "direct-process", hostId: "test" }, callback); }
function mission(root, missionId = "domain-mission") {
  initializeWorkspace(root);
  const proposal = createDoveMission(root, { operation: "create-root", mode: "research", missionId, goal: "Exercise current domain invariants." });
  return mutate(root, "create-dove-mission", () => createDoveMission(root, proposal.confirmation.confirmArgs)).mission;
}
function own(root, currentMission, relativePath, content, kind = "data") {
  write(root, relativePath, content);
  return mutate(root, "ingest-execution-receipt", () => ingestExecutionReceipt(root, {
    receiptId: `seed-${crypto.randomUUID()}`, missionId: currentMission.missionId, contractDigest: currentMission.contractDigest,
    summary: `Own ${relativePath}.`, artifacts: [{ path: relativePath, kind, sha256: sha256(root, relativePath) }],
    validations: [], criteriaSatisfied: [], producedAt: new Date().toISOString()
  }));
}
function protocol() {
  return {
    question: "Does the bounded method improve score?",
    hypothesis: "The method improves score relative to the declared baseline.",
    procedure: ["Run every declared input once.", "Record every output and failure."],
    inputs: ["benchmark-one"], comparisons: ["baseline-one"], metrics: ["score"],
    successConditions: ["The score improvement is positive."], stopConditions: ["Stop after all declared inputs are accounted for."],
    constraints: ["Use the same inputs for both methods."], expectedArtifacts: ["outputs/result.json", "outputs/failure.json"],
    frozenAt: new Date().toISOString()
  };
}
function result() {
  return {
    status: "completed", outcome: "The bounded run produced a score improvement.",
    measurements: [{ metric: "score", value: 0.11, comparison: "baseline-one" }],
    artifactRefs: ["outputs/result.json"], validationRefs: [],
    denominator: { total: 3, successful: 2, failed: 1, excluded: 0 },
    failures: [{ failureId: "failed-item", count: 1, reason: "No valid output was produced.", evidenceRefs: ["artifact:outputs/failure.json"] }],
    deviations: [], limitations: ["The evidence covers one bounded benchmark only."], recordedAt: new Date().toISOString()
  };
}

function tree(root) {
  const output = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(fullPath);
      else output[path.relative(root, fullPath)] = entry.isSymbolicLink() ? `link:${fs.readlinkSync(fullPath)}` : fs.readFileSync(fullPath).toString("base64");
    }
  };
  visit(root); return output;
}

test("Source keeps capture metadata and candidate/rejected lifecycle without positive trust authority", () => {
  const root = createTempRoot("dove-domain-source-"); const currentMission = mission(root);
  write(root, "inputs/paper.txt", "captured source material\n");
  const registered = mutate(root, "register-source", () => registerSource(root, { missionId: currentMission.missionId, sourceId: "paper-one", title: "Paper One", locator: "https://example.test/paper-one", capturePath: "inputs/paper.txt" }));
  assert.equal(registered.source.schemaVersion, 3);
  assert.equal(registered.source.lifecycle, "candidate");
  assert.equal(registered.source.useLimitation, SOURCE_USE_LIMITATION);
  assert.match(registered.source.capturedMaterial.sha256, /^[0-9a-f]{64}$/u);
  for (const removed of ["identityFingerprint", "materialVerification", "researchEligibility"]) assert.equal(Object.hasOwn(registered.source, removed), false);
  const claim = mutate(root, "upsert-claims", () => upsertClaims(root, { missionId: currentMission.missionId, claims: [{ claimId: "source-claim", text: "The captured source reports one bounded observation.", sourceIds: ["paper-one"], artifactRefs: [], validationRefs: [], experimentEvidence: [], uncertainty: [SOURCE_USE_LIMITATION], unsupportedExtensions: ["No independent-verification claim."], currentAssessment: "inconclusive" }] }));
  assert.deepEqual(claim.claims[0].evidenceRefs, ["source:paper-one"]);
  assert.throws(() => mutate(root, "upsert-claims", () => upsertClaims(root, { missionId: currentMission.missionId, claims: [{ claimId: "unsafe-source-claim", text: "Unsafe source claim.", sourceIds: ["paper-one"], artifactRefs: [], validationRefs: [], experimentEvidence: [], uncertainty: [], unsupportedExtensions: [], currentAssessment: "supported" }] })), /explicit source limitation/u);
  write(root, "inputs/rejected.txt", "misidentified source material\n");
  mutate(root, "register-source", () => registerSource(root, { missionId: currentMission.missionId, sourceId: "paper-rejected", title: "Rejected Paper", capturePath: "inputs/rejected.txt" }));
  mutate(root, "verify-source", () => verifySource(root, { missionId: currentMission.missionId, sourceId: "paper-rejected", method: "capture audit", checkedMaterial: "captured text", auditEvidence: [{ reference: "line 1", kind: "identity", observation: "The capture is not the claimed source." }] }));
  assert.throws(() => mutate(root, "upsert-claims", () => upsertClaims(root, { missionId: currentMission.missionId, claims: [{ claimId: "rejected-source-claim", text: "Rejected evidence.", sourceIds: ["paper-rejected"], artifactRefs: [], validationRefs: [], experimentEvidence: [], uncertainty: [SOURCE_USE_LIMITATION], unsupportedExtensions: [], currentAssessment: "blocked" }] })), /source-rejected/u);
});

test("Experiment freezes a general protocol before immutable result and preserves failures", () => {
  const root = createTempRoot("dove-domain-experiment-"); const currentMission = mission(root);
  own(root, currentMission, "outputs/result.json", "{\"score\":0.11}\n");
  own(root, currentMission, "outputs/failure.json", "{\"failed\":[3]}\n");
  const frozenProtocol = protocol();
  const before = tree(root);
  assert.throws(() => mutate(root, "run-experience-workflow", () => runExperienceWorkflow(root, { missionId: currentMission.missionId, experimentId: "quality-run", protocol: frozenProtocol, result: result() })), /Freeze the formal experiment protocol/u);
  assert.deepEqual(tree(root), before);
  const frozen = mutate(root, "run-experience-workflow", () => runExperienceWorkflow(root, { missionId: currentMission.missionId, experimentId: "quality-run", protocol: frozenProtocol }));
  assert.equal(frozen.plan.protocolDigest, evidenceDigest(frozen.plan.protocol));
  const changed = { ...frozenProtocol, constraints: ["Changed after freeze."] };
  assert.throws(() => mutate(root, "run-experience-workflow", () => runExperienceWorkflow(root, { missionId: currentMission.missionId, experimentId: "quality-run", protocol: changed, result: result() })), /protocol is immutable/u);
  const bad = result(); bad.denominator.failed = 0;
  assert.throws(() => mutate(root, "run-experience-workflow", () => runExperienceWorkflow(root, { missionId: currentMission.missionId, experimentId: "quality-run", protocol: frozenProtocol, result: bad })), /full total|preserve every failed/u);
  const completed = mutate(root, "run-experience-workflow", () => runExperienceWorkflow(root, { missionId: currentMission.missionId, experimentId: "quality-run", protocol: frozenProtocol, result: result() }));
  assert.equal(completed.result.status, "completed");
  assert.equal(completed.result.failures[0].count, 1);
  assert.deepEqual(completed.result.limitations, ["The evidence covers one bounded benchmark only."]);
  assert.equal(inspectDoveWorkspace(root).healthy, true);
  assert.throws(() => mutate(root, "run-experience-workflow", () => runExperienceWorkflow(root, { missionId: currentMission.missionId, experimentId: "quality-run", protocol: frozenProtocol, result: result() })), /result is immutable/u);
});

test("Claims accept artifact-only evidence and check Experiment measurements only when referenced", () => {
  const root = createTempRoot("dove-domain-claims-"); const currentMission = mission(root);
  own(root, currentMission, "outputs/evidence.md", "bounded evidence\n", "document");
  const artifactClaim = mutate(root, "upsert-claims", () => upsertClaims(root, { missionId: currentMission.missionId, claims: [{ claimId: "artifact-only", text: "The artifact supports a bounded observation.", sourceIds: [], artifactRefs: ["outputs/evidence.md"], validationRefs: [], experimentEvidence: [], uncertainty: ["Only one artifact is available."], unsupportedExtensions: ["No causal claim."], currentAssessment: "supported" }] }));
  assert.deepEqual(artifactClaim.claims[0].experimentEvidence, []);
  own(root, currentMission, "outputs/result.json", "{\"score\":0.11}\n"); own(root, currentMission, "outputs/failure.json", "{\"failed\":[3]}\n");
  const frozenProtocol = protocol();
  mutate(root, "run-experience-workflow", () => runExperienceWorkflow(root, { missionId: currentMission.missionId, experimentId: "claim-run", protocol: frozenProtocol }));
  mutate(root, "run-experience-workflow", () => runExperienceWorkflow(root, { missionId: currentMission.missionId, experimentId: "claim-run", protocol: frozenProtocol, result: result() }));
  assert.throws(() => mutate(root, "upsert-claims", () => upsertClaims(root, { missionId: currentMission.missionId, claims: [{ claimId: "wrong-measurement", text: "Wrong value.", sourceIds: [], artifactRefs: [], validationRefs: [], experimentEvidence: [{ experimentId: "claim-run", metric: "score", value: 0.12, comparison: "baseline-one" }], uncertainty: [], unsupportedExtensions: [], currentAssessment: "supported" }] })), /does not exactly match/u);
  const measured = mutate(root, "upsert-claims", () => upsertClaims(root, { missionId: currentMission.missionId, claims: [{ claimId: "exact-measurement", text: "The measured score improvement is 0.11.", sourceIds: [], artifactRefs: [], validationRefs: [], experimentEvidence: [{ experimentId: "claim-run", metric: "score", value: 0.11, comparison: "baseline-one" }], uncertainty: ["One benchmark only."], unsupportedExtensions: ["No generalization claim."], currentAssessment: "supported" }] }));
  assert.equal(measured.claims[0].experimentEvidence[0].value, 0.11);
});

test("Draft, Figure, and Rebuttal archive real project artifacts through Receipts without .dove mirrors", () => {
  const root = createTempRoot("dove-domain-archives-"); const currentMission = mission(root);
  own(root, currentMission, "paper/draft.md", "# Draft\n", "document");
  own(root, currentMission, "figures/result.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>\n", "figure");
  own(root, currentMission, "paper/rebuttal.md", "# Response\n", "document");
  const draft = mutate(root, "record-dove-draft", () => recordDoveDraft(root, { missionId: currentMission.missionId, artifactPath: "paper/draft.md", referencePaths: [], qa: ["References checked."], findings: [] }));
  const figure = mutate(root, "record-dove-figure", () => recordDoveFigure(root, { missionId: currentMission.missionId, artifactPath: "figures/result.svg", referencePaths: [], caption: "Bounded result.", qa: ["Caption and data checked."], findings: [] }));
  const currentWorkspace = openDoveWorkspace(root);
  const scoped = scopeReviewRecord(root, { missionId: currentMission.missionId, reviewMissionBinding: reviewMissionBinding(currentWorkspace, currentMission), hostKind: "claude", artifactPaths: ["paper/draft.md"] });
  const review = mutate(root, "archive-review-record", () => archiveReviewRecord(root, {
    missionId: currentMission.missionId, scopeBinding: scoped.scopeBinding, status: "completed", verdict: "needs-revision",
    summary: "Narrow the claim.", findings: [{ findingId: "finding-one", severity: "medium", summary: "Narrow the claim.", linkedArtifactPaths: ["paper/draft.md"] }],
    actionItems: ["Narrow the claim."], report: "# Review\n\nNarrow the claim.\n", provenance: { hostKind: "claude", reviewedAt: "2026-01-01T00:00:00.000Z" }
  }));
  const rebuttal = mutate(root, "record-dove-rebuttal", () => recordDoveRebuttal(root, { missionId: currentMission.missionId, artifactPath: "paper/rebuttal.md", referencePaths: [review.reviewPath], findingRefs: [`${review.reviewPath}#finding-one`], qa: [], findings: ["Claim narrowed."] }));
  assert.equal(draft.artifact.path, "paper/draft.md"); assert.equal(figure.caption, "Bounded result."); assert.equal(rebuttal.reviewerSignoff, false);
  for (const removed of [".dove/drafts", ".dove/figures", ".dove/rebuttal", ".dove/artifacts"]) assert.equal(fs.existsSync(path.join(root, removed)), false);
  const workspace = inspectDoveWorkspace(root);
  assert.equal(workspace.healthy, true);
  assert.equal(workspace.receiptLedger.currentOwnership.find((item) => item.path === "paper/rebuttal.md").receiptId, rebuttal.receipt.receiptId);
});

test("thin Figure and Rebuttal archives reject missing specialized fields without committing staged Receipts", () => {
  const root = createTempRoot("dove-domain-archive-preflight-"); const currentMission = mission(root);
  own(root, currentMission, "figures/result.svg", "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>\n", "figure");
  own(root, currentMission, "paper/rebuttal.md", "# Response\n", "document");
  for (const [actionId, callback, pattern] of [
    ["record-dove-figure", () => recordDoveFigure(root, { missionId: currentMission.missionId, artifactPath: "figures/result.svg", referencePaths: [], qa: [], findings: [] }), /caption.*non-empty/u],
    ["record-dove-rebuttal", () => recordDoveRebuttal(root, { missionId: currentMission.missionId, artifactPath: "paper/rebuttal.md", referencePaths: [], qa: [], findings: [] }), /findingRefs.*at least 1/u]
  ]) {
    const before = tree(root);
    assert.throws(() => mutate(root, actionId, callback), pattern);
    assert.deepEqual(tree(root), before);
  }
});

test("removed mirrors and unsupported prior state fail closed without fallback or migration", () => {
  const root = createTempRoot("dove-domain-removed-dir-"); mission(root);
  fs.mkdirSync(path.join(root, ".dove/drafts"));
  assert.equal(inspectDoveWorkspace(root).healthy, false);
  assert.match(inspectDoveWorkspace(root).error, /retained legacy artifact/u);
  const legacy = createTempRoot("dove-domain-prior-schema-"); fs.mkdirSync(path.join(legacy, ".dove"));
  write(legacy, ".dove/manifest.json", `${JSON.stringify({ schemaVersion: 17 })}\n`);
  const inspection = inspectDoveWorkspace(legacy);
  assert.equal(inspection.category, "legacy"); assert.equal(inspection.schemaVersion, 17);
});
