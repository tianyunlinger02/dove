import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { assessMissionCompletion } from "../../src/core/completion-gates.mjs";
import { readArtifactHistory, readArtifactLineage, readArtifactOwnership } from "../../src/core/artifact-lineage.mjs";
import { ingestExecutionReceipt, resolveExecutionReceiptPostCommit, validateExecutionReceipt } from "../../src/core/execution-receipts.mjs";
import { createDoveMission, missionCompletionCriteria, missionCompletionCriterionId } from "../../src/core/mission-contracts.mjs";
import { queryDoveStatus } from "../../src/core/mission-queries.mjs";
import { ARTIFACT_PATHS } from "../../src/core/schema.mjs";
import { registerSource, verifySource } from "../../src/core/source-trust.mjs";
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
  const result = runWithMutationContext(root, {
    actionId: "ingest-execution-receipt",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => ingestExecutionReceipt(root, receipt));
  return resolveExecutionReceiptPostCommit(root, result);
}

test("receipt validation and completion queries are strictly zero-write", () => {
  const { root, mission } = preparedRoot();
  const receipt = validReceipt(root, mission);
  const before = snapshot(root);
  const validated = validateExecutionReceipt(root, receipt);
  assert.equal(validated.receipt.receiptId, receipt.receiptId);
  assert.equal(validated.receipt.schemaVersion, 2);
  assert.equal(validated.receipt.ledgerSequence, 1);
  assert.equal(validated.receipt.producer.kind, "public-execution");
  assert.equal(validated.receipt.producer.actionId, "ingest-execution-receipt");
  assert.equal(typeof validated.receipt.recordedAt, "string");
  assert.deepEqual(validated.receipt.artifacts[0].derivedReferences, [`criterion:${receipt.criteriaSatisfied[0].criterionId}`]);
  assert.deepEqual(snapshot(root), before);

  const assessment = assessMissionCompletion(root, { missionId: mission.missionId });
  assert.equal(assessment.complete, false);
  assert.deepEqual(assessment.incompleteReasons, ["execution-receipt-missing"]);
  assert.deepEqual(snapshot(root), before);
});

test("receipt ingestion rejects unknown fields and caller authority before writing", () => {
  const forbiddenFields = ["authority", "role", "verdict", "status", "successful", "schemaVersion", "ledgerSequence", "recordedAt", "producer"];
  for (const field of forbiddenFields) {
    const { root, mission } = preparedRoot({ missionId: `forbidden-${field.toLowerCase()}` });
    const receipt = validReceipt(root, mission, { extra: { [field]: field === "successful" ? true : field === "ledgerSequence" || field === "schemaVersion" ? 1 : field === "producer" ? { kind: "dove-internal", actionId: "upsert-note" } : "reviewer" } });
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

test("receipt ingestion preflights malformed receipt ledger and required artifact coverage before writing", () => {
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
  writeText(root, `${ARTIFACT_PATHS.executionReceiptsDir}/broken.json`, "{ malformed\n");
  const beforeMalformed = snapshot(root);
  assert.throws(() => ingestDirect(root, completeReceipt), /Malformed durable JSON|Expected property name/u);
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
  const directMutation = runWithMutationContext(direct.root, {
    actionId: "ingest-execution-receipt",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => ingestExecutionReceipt(direct.root, directReceipt));
  assert.equal(directMutation.completion.assessment, null);
  assert.deepEqual(directMutation.postCommit, { kind: "assess-mission-completion", missionId: direct.mission.missionId });
  const directResult = resolveExecutionReceiptPostCommit(direct.root, directMutation);
  assert.equal(directResult.status, "ingested");
  assert.equal(Object.hasOwn(directResult, "postCommit"), false);
  assert.equal(directResult.completion.assessWith, "assess_mission_completion");
  assert.equal(directResult.completion.assessment.missionId, direct.mission.missionId);
  assert.equal(directResult.completion.assessment.currentReceiptId, directReceipt.receiptId);
  assert.equal(directResult.completion.assessment.complete, true);
  assert.equal(directResult.writesApplied, true);
  assert.equal(fs.existsSync(path.join(direct.root, ARTIFACT_PATHS.executionReceiptsDir, `${directReceipt.receiptId}.json`)), true);
  assert.equal(fs.existsSync(path.join(direct.root, ".dove/artifacts/ownership.json")), false);
  assert.equal(fs.existsSync(path.join(direct.root, ".dove/artifacts/lineage.json")), false);
  const ownership = readArtifactOwnership(direct.root);
  const lineage = readArtifactLineage(direct.root);
  const history = readArtifactHistory(direct.root);
  assert.equal(ownership.artifacts[0].receiptId, directReceipt.receiptId);
  assert.deepEqual(lineage.artifacts[0].derivedReferences, [`criterion:${directReceipt.criteriaSatisfied[0].criterionId}`]);
  assert.equal(history[0].ledgerSequence, 1);
  assert.equal(fs.existsSync(path.join(direct.root, ".dove", "mutations")), false);

  const planned = preparedRoot({ missionId: "patch-mode" });
  const plannedReceipt = validReceipt(planned.root, planned.mission, { receiptId: "receipt-planned" });
  const before = snapshot(planned.root);
  const plannedMutation = runWithMutationContext(planned.root, {
    actionId: "ingest-execution-receipt",
    mutationMode: "patch-plan",
    hostId: "test"
  }, () => ingestExecutionReceipt(planned.root, plannedReceipt));
  const plannedResult = resolveExecutionReceiptPostCommit(planned.root, plannedMutation);
  assert.equal(plannedResult.status, "ingest-planned");
  assert.equal(Object.hasOwn(plannedResult, "postCommit"), false);
  assert.equal(plannedResult.completion.assessment, null);
  assert.equal(plannedResult.writesApplied, false);
  assert.deepEqual(plannedResult.mutationPlan.operations.map((item) => item.relativePath), [
    `${ARTIFACT_PATHS.executionReceiptsDir}/receipt-planned.json`
  ]);
  assert.deepEqual(snapshot(planned.root), before);
});

test("failed direct-process receipt commit returns no completion assessment", () => {
  const { root, mission } = preparedRoot({ missionId: "failed-receipt-commit" });
  const receipt = validReceipt(root, mission, { receiptId: "failed-receipt" });
  const receiptPath = path.join(root, ARTIFACT_PATHS.executionReceiptsDir, `${receipt.receiptId}.json`);
  let coreResult = null;
  const fsOps = {
    ...fs,
    renameSync(from, to) {
      if (to === receiptPath) throw new Error("injected receipt promotion failure");
      return fs.renameSync(from, to);
    }
  };
  assert.throws(() => runWithMutationContext(root, {
    actionId: "ingest-execution-receipt",
    mutationMode: "direct-process",
    hostId: "test",
    fsOps
  }, () => {
    coreResult = ingestExecutionReceipt(root, receipt);
    assert.equal(coreResult.completion.assessment, null);
    assert.deepEqual(coreResult.postCommit, { kind: "assess-mission-completion", missionId: mission.missionId });
    return coreResult;
  }), /all staged changes were rolled back.*injected receipt promotion failure/u);
  assert.equal(fs.existsSync(receiptPath), false);
  assert.equal(coreResult.completion.assessment, null);
  const assessment = assessMissionCompletion(root, { missionId: mission.missionId });
  assert.equal(assessment.currentReceiptId, null);
  assert.equal(assessment.complete, false);
});

test("simultaneous receipt ingestions cannot allocate the same ledger sequence", async () => {
  const { root, mission } = preparedRoot({ missionId: "concurrent-ledger" });
  const first = validReceipt(root, mission, { receiptId: "concurrent-first" });
  const second = validReceipt(root, mission, { receiptId: "concurrent-second" });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let ready = 0;
  const start = (receipt) => runWithMutationContext(root, { actionId: "ingest-execution-receipt", mutationMode: "direct-process", hostId: "test" }, async () => {
    const result = ingestExecutionReceipt(root, receipt);
    ready += 1;
    if (ready === 2) release();
    await gate;
    return result;
  });
  const settled = await Promise.allSettled([start(first), start(second)]);
  assert.equal(settled.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(settled.filter((item) => item.status === "rejected").length, 1);
  assert.match(settled.find((item) => item.status === "rejected").reason.message, /commit precondition changed|ledger append lock/u);
  const status = queryDoveStatus(root, { missionId: mission.missionId });
  assert.equal(status.currentContext.receiptCount, 1);
  const stored = fs.readdirSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir)).filter((name) => name.endsWith(".json"));
  assert.equal(stored.length, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir, stored[0]), "utf8")).ledgerSequence, 1);
  assert.equal(fs.existsSync(path.join(root, ".dove/.receipt-ledger-append.lock")), false);
});

test("strict opener rejects stored receipt filename, sequence, producer, binding, and cross-mission ledger tampering", () => {
  const cases = [
    ["filename", (root, receipt) => fs.renameSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir, `${receipt.receiptId}.json`), path.join(root, ARTIFACT_PATHS.executionReceiptsDir, "wrong-name.json")), /filename must match receiptId/u],
    ["sequence", (root, receipt) => { const receiptPath = path.join(root, ARTIFACT_PATHS.executionReceiptsDir, `${receipt.receiptId}.json`); const stored = JSON.parse(fs.readFileSync(receiptPath, "utf8")); stored.ledgerSequence = 2; fs.writeFileSync(receiptPath, `${JSON.stringify(stored, null, 2)}\n`); }, /contiguous from 1/u],
    ["producer", (root, receipt) => { const receiptPath = path.join(root, ARTIFACT_PATHS.executionReceiptsDir, `${receipt.receiptId}.json`); const stored = JSON.parse(fs.readFileSync(receiptPath, "utf8")); stored.producer = { kind: "dove-internal", actionId: "ingest-execution-receipt" }; fs.writeFileSync(receiptPath, `${JSON.stringify(stored, null, 2)}\n`); }, /producer actionId/u],
    ["binding", (root, receipt) => { const receiptPath = path.join(root, ARTIFACT_PATHS.executionReceiptsDir, `${receipt.receiptId}.json`); const stored = JSON.parse(fs.readFileSync(receiptPath, "utf8")); stored.contractDigest = "0".repeat(64); fs.writeFileSync(receiptPath, `${JSON.stringify(stored, null, 2)}\n`); }, /contractDigest does not match/u]
  ];
  for (const [name, tamper, pattern] of cases) {
    const { root, mission } = preparedRoot({ missionId: `stored-${name}` });
    const receipt = validReceipt(root, mission, { receiptId: `stored-${name}-receipt` });
    ingestDirect(root, receipt);
    tamper(root, receipt);
    assert.throws(() => queryDoveStatus(root), pattern);
  }

  const root = createTempRoot("dove-stored-cross-mission-");
  writeText(root, "outputs/shared.md", "shared\n");
  writeText(root, "outputs/validation.log", "tests passed\n");
  const firstMission = materializeMission(root, { missionId: "stored-owner-one" });
  const first = validReceipt(root, firstMission, { receiptId: "stored-owner-one-receipt", artifactPath: "outputs/shared.md" });
  ingestDirect(root, first);
  writeText(root, "outputs/other.md", "other\n");
  const secondMission = materializeMission(root, { missionId: "stored-owner-two" });
  const second = validReceipt(root, secondMission, { receiptId: "stored-owner-two-receipt", artifactPath: "outputs/other.md" });
  ingestDirect(root, second);
  const secondPath = path.join(root, ARTIFACT_PATHS.executionReceiptsDir, `${second.receiptId}.json`);
  const stored = JSON.parse(fs.readFileSync(secondPath, "utf8"));
  stored.artifacts[0].path = "outputs/shared.md";
  stored.artifacts[0].sha256 = sha256File(root, "outputs/shared.md");
  fs.writeFileSync(secondPath, `${JSON.stringify(stored, null, 2)}\n`);
  assert.throws(() => queryDoveStatus(root), /assigns artifact path .* after ownership by/u);
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

test("selected mission status surfaces only contract-required source and review gaps", () => {
  const ordinary = preparedRoot({ missionId: "ordinary-status" });
  ingestDirect(ordinary.root, validReceipt(ordinary.root, ordinary.mission));
  const ordinaryStatus = queryDoveStatus(ordinary.root, { missionId: ordinary.mission.missionId });
  assert.equal(ordinaryStatus.needsAttention.status, "clear");
  assert.deepEqual(ordinaryStatus.needsAttention.stableGaps.sources, []);
  assert.deepEqual(ordinaryStatus.needsAttention.stableGaps.review, []);

  const missing = preparedRoot({ missionId: "missing-required-status", evidenceRequirements: ["source:paper-required"] });
  ingestDirect(missing.root, validReceipt(missing.root, missing.mission));
  const missingStatus = queryDoveStatus(missing.root, { missionId: missing.mission.missionId, full: true });
  assert.deepEqual(missingStatus.needsAttention.stableGaps.sources, [{ sourceId: "paper-required", lifecycle: "missing", eligible: false, reason: "unknown-source" }]);
  assert.deepEqual(missingStatus.sourceIntegrity.required, [{ sourceId: "paper-required", lifecycle: "missing", eligible: false, reason: "unknown-source" }]);
  assert.ok(missingStatus.needsAttention.reasons.includes("source-evidence-unavailable"));

  const required = preparedRoot({ missionId: "required-status", evidenceRequirements: ["source:paper-required", "review:authoritative"] });
  writeText(required.root, "inputs/paper.pdf", "captured source\n");
  writeText(required.root, "inputs/optional.pdf", "optional captured source\n");
  runWithMutationContext(required.root, { actionId: "register-source", mutationMode: "direct-process", hostId: "test" }, () => registerSource(required.root, { missionId: required.mission.missionId, sourceId: "paper-required", title: "Required paper", capturePath: "inputs/paper.pdf" }));
  runWithMutationContext(required.root, { actionId: "register-source", mutationMode: "direct-process", hostId: "test" }, () => registerSource(required.root, { missionId: required.mission.missionId, sourceId: "optional-candidate", title: "Optional paper", capturePath: "inputs/optional.pdf" }));
  ingestDirect(required.root, validReceipt(required.root, required.mission));
  const candidate = queryDoveStatus(required.root, { missionId: required.mission.missionId, full: true });
  assert.equal(candidate.needsAttention.status, "incomplete");
  assert.deepEqual(candidate.needsAttention.stableGaps.sources.map((item) => [item.sourceId, item.lifecycle, item.eligible, item.reason]), [["paper-required", "candidate", false, "source-candidate"]]);
  assert.deepEqual(candidate.sourceIntegrity.required.map((item) => item.sourceId), ["paper-required"]);
  assert.equal(candidate.sourceIntegrity.candidateCount, 2);
  assert.ok(candidate.needsAttention.stableGaps.review.includes("current-review-coverage-missing"));
  assert.ok(candidate.needsAttention.stableGaps.review.includes("trusted-review-issuer-missing"));

  runWithMutationContext(required.root, { actionId: "verify-source", mutationMode: "direct-process", hostId: "test" }, () => verifySource(required.root, { missionId: required.mission.missionId, sourceId: "paper-required", method: "manual-audit", checkedMaterial: "captured PDF", auditEvidence: [{ reference: "page 1", kind: "capture", observation: "Rejected after audit." }] }));
  const rejected = queryDoveStatus(required.root, { missionId: required.mission.missionId });
  assert.deepEqual(rejected.needsAttention.stableGaps.sources.map((item) => [item.sourceId, item.lifecycle, item.eligible, item.reason]), [["paper-required", "rejected", false, "source-rejected"]]);
  assert.notEqual(rejected.needsAttention.status, "clear");
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

test("current mission contract drift is rejected by the strict opener without persisting status", () => {
  const { root, mission } = preparedRoot();
  const receipt = validReceipt(root, mission);
  ingestDirect(root, receipt);
  const missionPath = path.join(root, ARTIFACT_PATHS.missionsDir, `${mission.missionId}.json`);
  const changed = JSON.parse(fs.readFileSync(missionPath, "utf8"));
  changed.goal = "Tampered mission goal";
  fs.writeFileSync(missionPath, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
  const before = snapshot(root);
  assert.throws(() => assessMissionCompletion(root, { missionId: mission.missionId }), /contractDigest does not match its canonical mission content/u);
  assert.deepEqual(snapshot(root), before);
  assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(missionPath, "utf8")), "status"), false);
});

test("minimal status scopes the only mission and exposes high-level live integrity", () => {
  const { root, mission } = preparedRoot();
  ingestDirect(root, validReceipt(root, mission));
  const before = snapshot(root);
  const status = queryDoveStatus(root);
  assert.equal(status.currentContext.missionScope, "only-mission");
  assert.equal(status.currentContext.selectedMissionId, mission.missionId);
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
