import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { assessMissionCompletion } from "../../src/core/completion-gates.mjs";
import { ingestExecutionReceipt, validateExecutionReceipt } from "../../src/core/execution-receipts.mjs";
import { createDoveMission, missionCompletionCriteria, missionCompletionCriterionId } from "../../src/core/mission-contracts.mjs";
import { queryDoveStatus } from "../../src/core/mission-queries.mjs";
import { ARTIFACT_PATHS } from "../../src/core/schema.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

const PRODUCED_AT = "2026-07-15T00:00:00.000Z";

function sha256File(root, relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relativePath))).digest("hex");
}

function writeText(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

function snapshot(root) {
  const files = {};
  const walk = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else files[path.relative(root, fullPath)] = fs.readFileSync(fullPath).toString("base64");
    }
  };
  walk(root);
  return files;
}

function materializeMission(root, overrides = {}) {
  const args = {
    missionId: overrides.missionId ?? "receipt-mission",
    goal: overrides.goal ?? "Produce one hash-bound mission artifact.",
    targetArtifacts: overrides.targetArtifacts ?? [],
    expectedArtifacts: overrides.expectedArtifacts ?? [],
    completionCriteria: overrides.completionCriteria ?? ["Artifact exists with current content."],
    evidenceRequirements: overrides.evidenceRequirements ?? []
  };
  const proposal = createDoveMission(root, args);
  return runWithMutationContext(root, {
    actionId: "create-dove-mission",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => createDoveMission(root, proposal.confirmation.confirmArgs)).mission;
}

function validReceipt(root, mission, overrides = {}) {
  const artifactPath = overrides.artifactPath ?? "outputs/result.md";
  const validationPath = overrides.validationPath ?? "outputs/validation.log";
  const criteria = missionCompletionCriteria(mission);
  return {
    receiptId: overrides.receiptId ?? "receipt-1",
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    summary: overrides.summary ?? "Produced the bound artifact and checked it.",
    artifacts: overrides.artifacts ?? [{ path: artifactPath, kind: "report", sha256: sha256File(root, artifactPath) }],
    validations: overrides.validations ?? [{ kind: "test-log", reference: validationPath, outputHash: sha256File(root, validationPath) }],
    criteriaSatisfied: overrides.criteriaSatisfied ?? criteria.map(({ criterionId }) => ({
      criterionId,
      evidenceRefs: [`artifact:${artifactPath}`, `validation:${validationPath}`]
    })),
    producedAt: overrides.producedAt ?? PRODUCED_AT,
    ...overrides.extra
  };
}

function preparedRoot(overrides = {}) {
  const root = createTempRoot("dove-execution-receipts-");
  writeText(root, "outputs/result.md", "result\n");
  writeText(root, "outputs/validation.log", "tests passed\n");
  const mission = materializeMission(root, overrides);
  return { root, mission };
}

function ingestDirect(root, receipt) {
  return runWithMutationContext(root, {
    actionId: "ingest-execution-receipt",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => ingestExecutionReceipt(root, receipt));
}

test("receipt validation and completion queries are strictly zero-write", () => {
  const { root, mission } = preparedRoot();
  const receipt = validReceipt(root, mission);
  const before = snapshot(root);
  const validated = validateExecutionReceipt(root, receipt);
  assert.equal(validated.receipt.receiptId, receipt.receiptId);
  assert.deepEqual(snapshot(root), before);

  const assessment = assessMissionCompletion(root, { missionId: mission.missionId });
  assert.equal(assessment.complete, false);
  assert.deepEqual(assessment.incompleteReasons, ["execution-receipt-missing"]);
  assert.deepEqual(snapshot(root), before);
});

test("receipt ingestion rejects unknown fields and caller authority before writing", () => {
  const forbiddenFields = ["authority", "role", "verdict", "status", "successful"];
  for (const field of forbiddenFields) {
    const { root, mission } = preparedRoot({ missionId: `forbidden-${field}` });
    const receipt = validReceipt(root, mission, { extra: { [field]: field === "successful" ? true : "reviewer" } });
    const before = snapshot(root);
    assert.throws(() => ingestDirect(root, receipt), /does not accept unknown input/u);
    assert.deepEqual(snapshot(root), before);
  }

  const { root, mission } = preparedRoot({ missionId: "nested-authority" });
  const receipt = validReceipt(root, mission);
  receipt.artifacts[0].authority = "reviewer";
  const before = snapshot(root);
  assert.throws(() => ingestDirect(root, receipt), /does not accept unknown input/u);
  assert.deepEqual(snapshot(root), before);
});

test("receipt ingestion rejects unsafe, missing, empty, aliased, and external paths", () => {
  const cases = [
    ["missing", "outputs/missing.md", /safe existing non-empty regular file/u],
    ["empty", "outputs/empty.md", /safe existing non-empty regular file/u],
    ["traversal", "../outside.md", /unsafe path/u],
    ["internal-alias", "outputs/alias.md", /canonical realpath-contained path/u],
    ["external-link", "outputs/external.md", /safe existing non-empty regular file/u]
  ];
  for (const [name, artifactPath, errorPattern] of cases) {
    const { root, mission } = preparedRoot({ missionId: `path-${name}` });
    if (name === "empty") writeText(root, artifactPath, "");
    if (name === "internal-alias") fs.symlinkSync("result.md", path.join(root, artifactPath));
    if (name === "external-link") {
      const externalRoot = createTempRoot("dove-external-receipt-");
      writeText(externalRoot, "outside.md", "outside\n");
      fs.symlinkSync(path.join(externalRoot, "outside.md"), path.join(root, artifactPath));
    }
    const receipt = validReceipt(root, mission);
    receipt.artifacts[0].path = artifactPath;
    const before = snapshot(root);
    assert.throws(() => ingestDirect(root, receipt), errorPattern);
    assert.deepEqual(snapshot(root), before);
  }
});

test("receipt ingestion rejects artifact and validation integrity failures", () => {
  const cases = [
    ["artifact-kind", (receipt) => { receipt.artifacts[0].kind = "authoritative-figure"; }, /kind must be one of/u],
    ["validation-kind", (receipt) => { receipt.validations[0].kind = "review-approved"; }, /kind must be one of/u],
    ["artifact-hash", (receipt) => { receipt.artifacts[0].sha256 = "0".repeat(64); }, /SHA-256 mismatch/u],
    ["validation-missing", (receipt) => { receipt.validations[0].reference = "outputs/missing-validation.log"; }, /safe existing non-empty regular file/u],
    ["validation-hash", (receipt) => { receipt.validations[0].outputHash = "0".repeat(64); }, /SHA-256 mismatch/u]
  ];
  for (const [name, mutate, errorPattern] of cases) {
    const { root, mission } = preparedRoot({ missionId: name });
    const receipt = validReceipt(root, mission);
    mutate(receipt);
    const before = snapshot(root);
    assert.throws(() => ingestDirect(root, receipt), errorPattern);
    assert.deepEqual(snapshot(root), before);
  }
});

test("receipt ingestion enforces exact deterministic criterion coverage", () => {
  const cases = [
    ["missing", (receipt) => { receipt.criteriaSatisfied = []; }, /missing mission completion criteria/u],
    ["duplicate", (receipt) => { receipt.criteriaSatisfied.push(structuredClone(receipt.criteriaSatisfied[0])); }, /duplicate criterionId/u],
    ["unknown", (receipt) => { receipt.criteriaSatisfied[0].criterionId = "criterion-unknown"; }, /is unknown for the current mission/u],
    ["summary-only", (receipt) => { receipt.criteriaSatisfied[0].evidenceRefs = []; }, /summary is not evidence/u]
  ];
  for (const [name, mutate, errorPattern] of cases) {
    const { root, mission } = preparedRoot({ missionId: `criterion-${name}` });
    const receipt = validReceipt(root, mission);
    mutate(receipt);
    const before = snapshot(root);
    assert.throws(() => ingestDirect(root, receipt), errorPattern);
    assert.deepEqual(snapshot(root), before);
  }
});

test("criterion ids stay stable across unrelated criterion insertion", () => {
  const criterion = "Artifact exists with current content.";
  assert.equal(missionCompletionCriterionId(0, criterion), missionCompletionCriterionId(4, criterion));
});

test("mission target and expected artifact paths must be canonical and substantive", () => {
  const root = createTempRoot("dove-mission-artifact-paths-");
  const before = snapshot(root);
  assert.throws(() => createDoveMission(root, {
    missionId: "noncanonical-target",
    goal: "Bind one canonical artifact path.",
    expectedArtifacts: ["outputs/../result.md"]
  }), /path must be canonical/u);
  assert.throws(() => createDoveMission(root, {
    missionId: "bookkeeping-target",
    goal: "Do not let bookkeeping satisfy a mission.",
    targetArtifacts: [".dove/missions/bookkeeping-target.json"]
  }), /not Dove bookkeeping/u);
  assert.throws(() => createDoveMission(root, {
    missionId: "bookkeeping-evidence",
    goal: "Do not let receipts satisfy themselves.",
    evidenceRequirements: ["artifact:.dove/receipts/execution/receipt.json"]
  }), /not Dove bookkeeping/u);
  assert.deepEqual(snapshot(root), before);
});

test("mission contracts reject unsupported evidence requirements before materialization", () => {
  const root = createTempRoot("dove-mission-evidence-syntax-");
  const before = snapshot(root);
  assert.throws(() => createDoveMission(root, {
    missionId: "unsupported-evidence",
    goal: "Require exact evidence syntax.",
    evidenceRequirements: ["test output"]
  }), /must use artifact:<path>/u);
  assert.deepEqual(snapshot(root), before);
});

test("receipt ingestion rejects contract mismatch and immutable receipt collisions", () => {
  const { root, mission } = preparedRoot();
  const mismatch = validReceipt(root, mission);
  mismatch.contractDigest = "0".repeat(64);
  const beforeMismatch = snapshot(root);
  assert.throws(() => ingestDirect(root, mismatch), /contractDigest does not match/u);
  assert.deepEqual(snapshot(root), beforeMismatch);

  const receipt = validReceipt(root, mission);
  ingestDirect(root, receipt);
  const beforeCollision = snapshot(root);
  assert.throws(() => ingestDirect(root, receipt), /already occupied/u);
  assert.deepEqual(snapshot(root), beforeCollision);
});

test("direct-process lineage preflight rejects cross-mission ownership without partial writes", () => {
  const root = createTempRoot("dove-receipt-cross-mission-");
  writeText(root, "outputs/shared.md", "shared\n");
  writeText(root, "outputs/validation.log", "tests passed\n");
  const firstMission = materializeMission(root, { missionId: "owner-one" });
  const firstReceipt = validReceipt(root, firstMission, { artifactPath: "outputs/shared.md", receiptId: "owner-one-receipt" });
  ingestDirect(root, firstReceipt);

  const secondMission = materializeMission(root, { missionId: "owner-two" });
  const secondReceipt = validReceipt(root, secondMission, { artifactPath: "outputs/shared.md", receiptId: "owner-two-receipt" });
  const before = snapshot(root);
  assert.throws(() => ingestDirect(root, secondReceipt), /already owned by mission owner-one/u);
  assert.deepEqual(snapshot(root), before);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir, "owner-two-receipt.json")), false);
});

test("receipt ingestion preflights malformed lineage and required artifact coverage before writing", () => {
  const { root, mission } = preparedRoot({
    missionId: "preflight-lineage",
    targetArtifacts: ["outputs/result.md"],
    expectedArtifacts: ["outputs/expected.md"]
  });
  writeText(root, "outputs/expected.md", "expected\n");
  const missingExpected = validReceipt(root, mission);
  const beforeMissing = snapshot(root);
  assert.throws(() => ingestDirect(root, missingExpected), /missing mission target or expected artifacts/u);
  assert.deepEqual(snapshot(root), beforeMissing);

  const completeReceipt = validReceipt(root, mission, {
    receiptId: "preflight-complete",
    artifacts: [
      { path: "outputs/result.md", kind: "report", sha256: sha256File(root, "outputs/result.md") },
      { path: "outputs/expected.md", kind: "report", sha256: sha256File(root, "outputs/expected.md") }
    ]
  });
  writeText(root, ARTIFACT_PATHS.artifactLineage, "{ malformed\n");
  const beforeMalformed = snapshot(root);
  assert.throws(() => ingestDirect(root, completeReceipt), /Malformed JSON|Expected property name/u);
  assert.deepEqual(snapshot(root), beforeMalformed);
});

test("receipt ingestion rejects validation bookkeeping and duplicate canonical references", () => {
  const { root, mission } = preparedRoot({ missionId: "validation-closed" });
  const bookkeeping = validReceipt(root, mission, {
    validations: [{ kind: "test-log", reference: ARTIFACT_PATHS.projectIdentity, outputHash: sha256File(root, ARTIFACT_PATHS.projectIdentity) }]
  });
  const beforeBookkeeping = snapshot(root);
  assert.throws(() => ingestDirect(root, bookkeeping), /rather than Dove bookkeeping/u);
  assert.deepEqual(snapshot(root), beforeBookkeeping);

  const duplicate = validReceipt(root, mission);
  duplicate.validations.push(structuredClone(duplicate.validations[0]));
  const beforeDuplicate = snapshot(root);
  assert.throws(() => ingestDirect(root, duplicate), /duplicate canonical reference/u);
  assert.deepEqual(snapshot(root), beforeDuplicate);
});

test("receipt ingestion supports patch-plan and direct-process mutation modes", () => {
  const direct = preparedRoot({ missionId: "direct-mode" });
  const directReceipt = validReceipt(direct.root, direct.mission);
  const directResult = ingestDirect(direct.root, directReceipt);
  assert.equal(directResult.status, "ingested");
  assert.equal(directResult.writesApplied, true);
  assert.equal(fs.existsSync(path.join(direct.root, ARTIFACT_PATHS.executionReceiptsDir, `${directReceipt.receiptId}.json`)), true);
  assert.equal(fs.existsSync(path.join(direct.root, ARTIFACT_PATHS.artifactOwnership)), true);
  assert.equal(fs.existsSync(path.join(direct.root, ARTIFACT_PATHS.artifactLineage)), true);
  const lineage = JSON.parse(fs.readFileSync(path.join(direct.root, ARTIFACT_PATHS.artifactLineage), "utf8"));
  assert.deepEqual(lineage.artifacts[0].derivedReferences, [`criterion:${directReceipt.criteriaSatisfied[0].criterionId}`]);
  assert.equal(fs.existsSync(path.join(direct.root, ".dove", "mutations")), false);

  const planned = preparedRoot({ missionId: "patch-mode" });
  const plannedReceipt = validReceipt(planned.root, planned.mission, { receiptId: "receipt-planned" });
  const before = snapshot(planned.root);
  const plannedResult = runWithMutationContext(planned.root, {
    actionId: "ingest-execution-receipt",
    mutationMode: "patch-plan",
    hostId: "test"
  }, () => ingestExecutionReceipt(planned.root, plannedReceipt));
  assert.equal(plannedResult.status, "ingest-planned");
  assert.equal(plannedResult.writesApplied, false);
  assert.deepEqual(plannedResult.mutationPlan.operations.map((item) => item.relativePath), [
    `${ARTIFACT_PATHS.executionReceiptsDir}/receipt-planned.json`,
    ARTIFACT_PATHS.artifactOwnership,
    ARTIFACT_PATHS.artifactLineage
  ]);
  assert.deepEqual(snapshot(planned.root), before);
});

test("a valid receipt completes a no-review mission and artifact drift makes it stale", () => {
  const { root, mission } = preparedRoot();
  const receipt = validReceipt(root, mission);
  ingestDirect(root, receipt);

  const complete = assessMissionCompletion(root, { missionId: mission.missionId });
  assert.equal(complete.complete, true);
  assert.equal(complete.currentReceiptId, receipt.receiptId);
  assert.deepEqual(complete.staleReceiptIds, []);

  writeText(root, "outputs/result.md", "changed\n");
  const stale = assessMissionCompletion(root, { missionId: mission.missionId });
  assert.equal(stale.complete, false);
  assert.deepEqual(stale.staleReceiptIds, [receipt.receiptId]);
  assert.ok(stale.incompleteReasons.includes("execution-receipts-stale-or-invalid"));
});

test("review-required missions remain incomplete without authoritative proof", () => {
  const { root, mission } = preparedRoot({
    missionId: "review-required",
    evidenceRequirements: ["review:authoritative"]
  });
  ingestDirect(root, validReceipt(root, mission));
  const assessment = assessMissionCompletion(root, { missionId: mission.missionId });
  assert.equal(assessment.complete, false);
  assert.ok(assessment.incompleteReasons.includes("evidence-requirements-unmet"));
  assert.equal(assessment.evidenceRequirements[0].reason, "authoritative-review-proof-missing");
});

test("completion reassessment fails closed for malformed receipts and unknown stored fields", () => {
  const malformed = preparedRoot({ missionId: "malformed-receipt" });
  writeText(malformed.root, `${ARTIFACT_PATHS.executionReceiptsDir}/broken.json`, "{ broken\n");
  const malformedBefore = snapshot(malformed.root);
  assert.throws(() => assessMissionCompletion(malformed.root, { missionId: malformed.mission.missionId }), /Malformed durable JSON/u);
  assert.deepEqual(snapshot(malformed.root), malformedBefore);

  const unknown = preparedRoot({ missionId: "unknown-stored-field" });
  const receipt = validReceipt(unknown.root, unknown.mission);
  ingestDirect(unknown.root, receipt);
  const receiptPath = path.join(unknown.root, ARTIFACT_PATHS.executionReceiptsDir, `${receipt.receiptId}.json`);
  const stored = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  stored.successful = true;
  fs.writeFileSync(receiptPath, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
  const beforeUnknown = snapshot(unknown.root);
  assert.throws(() => assessMissionCompletion(unknown.root, { missionId: unknown.mission.missionId }), /does not accept unknown fields/u);
  assert.deepEqual(snapshot(unknown.root), beforeUnknown);
});

test("current mission contract drift invalidates receipts without persisting status", () => {
  const { root, mission } = preparedRoot();
  const receipt = validReceipt(root, mission);
  ingestDirect(root, receipt);
  const missionPath = path.join(root, ARTIFACT_PATHS.missionsDir, `${mission.missionId}.json`);
  const changed = JSON.parse(fs.readFileSync(missionPath, "utf8"));
  changed.goal = "Tampered mission goal";
  fs.writeFileSync(missionPath, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
  const before = snapshot(root);
  const assessment = assessMissionCompletion(root, { missionId: mission.missionId });
  assert.equal(assessment.complete, false);
  assert.ok(assessment.incompleteReasons.includes("mission-contract-invalid"));
  assert.deepEqual(assessment.staleReceiptIds, [receipt.receiptId]);
  assert.deepEqual(snapshot(root), before);
  assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(missionPath, "utf8")), "status"), false);
});

test("minimal status exposes only high-level live integrity assessment", () => {
  const { root, mission } = preparedRoot();
  ingestDirect(root, validReceipt(root, mission));
  const before = snapshot(root);
  const status = queryDoveStatus(root);
  assert.deepEqual(status.currentContext.integrityAssessment, {
    complete: true,
    staleReceiptCount: 0,
    incompleteReasons: []
  });
  assert.equal(Object.hasOwn(status.currentContext.integrityAssessment, "currentReceiptId"), false);
  assert.equal(Object.hasOwn(status.currentContext, "objective"), false);
  assert.equal(Object.hasOwn(status.currentContext, "currentFocus"), false);
  assert.doesNotMatch(status.nextStep.label, new RegExp(mission.goal.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.deepEqual(snapshot(root), before);
});
