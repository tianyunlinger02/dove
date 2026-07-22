import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { assessMissionCompletion } from "../../src/core/completion-gates.mjs";
import { readArtifactHistory, readArtifactLineage, readArtifactOwnership } from "../../src/core/artifact-lineage.mjs";
import { finalizeDomainArtifacts } from "../../src/core/domain-artifacts.mjs";
import { closeHostOutcome, ingestExecutionReceipt, resolveExecutionReceiptPostCommit, validateExecutionReceipt } from "../../src/core/execution-receipts.mjs";
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
    evidenceRequirements: overrides.evidenceRequirements ?? [],
    dependsOnMissionIds: overrides.dependsOnMissionIds ?? [],
    ...(overrides.supersedesMissionId ? { supersedesMissionId: overrides.supersedesMissionId } : {})
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
  assert.equal(validated.receipt.schemaVersion, 3);
  assert.equal(validated.receipt.ledgerSequence, 1);
  assert.equal(validated.receipt.producer.kind, "public-execution");
  assert.equal(validated.receipt.producer.actionId, "ingest-execution-receipt");
  assert.equal(typeof validated.receipt.recordedAt, "string");
  assert.deepEqual(validated.receipt.artifacts[0].derivedReferences, [`criterion:${receipt.criteriaSatisfied[0].criterionId}`]);
  assert.deepEqual(snapshot(root), before);

  const assessment = assessMissionCompletion(root, { missionId: mission.missionId });
  assert.equal(assessment.complete, false);
  assert.deepEqual(assessment.incompleteReasons, ["execution-receipt-missing", "criteria-coverage-missing"]);
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

test("receipt ingestion rejects canonical artifact and validation overlap", () => {
  const { root, mission } = preparedRoot({ missionId: "receipt-overlap" });
  const receipt = validReceipt(root, mission, {
    artifacts: [{ path: "outputs/result.md", kind: "report", sha256: sha256File(root, "outputs/result.md") }],
    validations: [{ kind: "test-log", reference: "outputs/result.md", outputHash: sha256File(root, "outputs/result.md") }],
    criteriaSatisfied: []
  });
  const before = snapshot(root);
  assert.throws(() => ingestDirect(root, receipt), /artifact and validation paths must be canonically distinct/u);
  assert.deepEqual(snapshot(root), before);
});

test("receipt ingestion rejects unsafe, missing, empty, aliased, and external paths", () => {
  const cases = [
    ["missing", "outputs/missing.md", /safe existing non-empty regular file/u],
    ["empty", "outputs/empty.md", /safe existing non-empty regular file/u],
    ["traversal", "../outside.md", /unsafe path/u],
    ["internal-alias", "outputs/alias.md", /canonical realpath-contained path|symbolic links/u],
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

test("receipt ingestion accepts partial criterion progress and rejects invalid criterion declarations", () => {
  const partial = preparedRoot({ missionId: "criterion-partial" });
  const partialReceipt = validReceipt(partial.root, partial.mission);
  partialReceipt.criteriaSatisfied = [];
  assert.equal(validateExecutionReceipt(partial.root, partialReceipt).receipt.criteriaSatisfied.length, 0);
  const validationOnly = validReceipt(partial.root, partial.mission, { receiptId: "criterion-validation-only", artifacts: [], criteriaSatisfied: [] });
  assert.equal(validateExecutionReceipt(partial.root, validationOnly).receipt.validations.length, 1);
  ingestDirect(partial.root, validReceipt(partial.root, partial.mission, { receiptId: "criterion-owner", criteriaSatisfied: [] }));
  const criterionOnly = validReceipt(partial.root, partial.mission, { receiptId: "criterion-only", artifacts: [], validations: [], criteriaSatisfied: [{ criterionId: missionCompletionCriteria(partial.mission)[0].criterionId, evidenceRefs: ["artifact:outputs/result.md"] }] });
  assert.equal(validateExecutionReceipt(partial.root, criterionOnly).receipt.criteriaSatisfied.length, 1);
  assert.throws(() => validateExecutionReceipt(partial.root, validReceipt(partial.root, partial.mission, { receiptId: "empty-progress", artifacts: [], validations: [], criteriaSatisfied: [] })), /must contain at least one artifact, validation, or satisfied criterion/u);

  const cases = [
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

test("progress receipts aggregate current artifact and criterion coverage without historical revival", () => {
  const root = createTempRoot("dove-progress-aggregate-");
  writeText(root, "outputs/first.md", "first v1\n");
  writeText(root, "outputs/second.md", "second\n");
  writeText(root, "outputs/validation.log", "ok\n");
  const currentMission = materializeMission(root, {
    missionId: "aggregate-progress",
    targetArtifacts: ["outputs/first.md"],
    expectedArtifacts: ["outputs/second.md"],
    completionCriteria: ["First evidence is current.", "Second evidence is current."]
  });
  const [firstCriterion, secondCriterion] = missionCompletionCriteria(currentMission);
  ingestDirect(root, validReceipt(root, currentMission, {
    receiptId: "progress-first",
    artifactPath: "outputs/first.md",
    artifacts: [{ path: "outputs/first.md", kind: "report", sha256: sha256File(root, "outputs/first.md") }],
    criteriaSatisfied: [{ criterionId: firstCriterion.criterionId, evidenceRefs: ["artifact:outputs/first.md"] }]
  }));
  const partial = assessMissionCompletion(root, { missionId: currentMission.missionId });
  assert.equal(partial.complete, false);
  assert.deepEqual(partial.contributingReceiptIds, ["progress-first"]);
  assert.equal(partial.artifactCoverage.find((item) => item.path === "outputs/second.md").covered, false);
  assert.equal(partial.criterionCoverage.find((item) => item.criterionId === secondCriterion.criterionId).covered, false);

  ingestDirect(root, validReceipt(root, currentMission, {
    receiptId: "progress-second",
    artifactPath: "outputs/second.md",
    artifacts: [{ path: "outputs/second.md", kind: "report", sha256: sha256File(root, "outputs/second.md") }],
    criteriaSatisfied: [{ criterionId: secondCriterion.criterionId, evidenceRefs: ["artifact:outputs/second.md"] }]
  }));
  const complete = assessMissionCompletion(root, { missionId: currentMission.missionId });
  assert.equal(complete.complete, true);
  assert.deepEqual(complete.contributingReceiptIds, ["progress-first", "progress-second"]);
  assert.equal(Object.hasOwn(complete, "currentReceiptId"), false);

  writeText(root, "outputs/first.md", "first v2\n");
  ingestDirect(root, validReceipt(root, currentMission, {
    receiptId: "progress-first-replacement",
    artifactPath: "outputs/first.md",
    artifacts: [{ path: "outputs/first.md", kind: "report", sha256: sha256File(root, "outputs/first.md") }],
    criteriaSatisfied: []
  }));
  const superseded = assessMissionCompletion(root, { missionId: currentMission.missionId });
  assert.equal(superseded.complete, false);
  assert.equal(superseded.criterionCoverage.find((item) => item.criterionId === firstCriterion.criterionId).covered, false);
  assert.ok(superseded.staleReceiptIds.includes("progress-first"));
});

test("mission dependencies block completion until each dependency is complete", () => {
  const root = createTempRoot("dove-mission-dependencies-");
  writeText(root, "outputs/dependency.md", "dependency\n");
  writeText(root, "outputs/dependent.md", "dependent\n");
  writeText(root, "outputs/validation.log", "tests passed\n");
  const dependency = materializeMission(root, {
    missionId: "dependency",
    targetArtifacts: ["outputs/dependency.md"]
  });
  const dependent = materializeMission(root, {
    missionId: "dependent",
    targetArtifacts: ["outputs/dependent.md"],
    dependsOnMissionIds: [dependency.missionId]
  });
  ingestDirect(root, validReceipt(root, dependent, {
    receiptId: "dependent-receipt",
    artifactPath: "outputs/dependent.md"
  }));
  const blocked = assessMissionCompletion(root, { missionId: dependent.missionId });
  assert.equal(blocked.complete, false);
  assert.ok(blocked.incompleteReasons.includes("mission-dependency-incomplete"));
  assert.deepEqual(blocked.dependencyCoverage, [{
    missionId: dependency.missionId,
    status: "incomplete",
    complete: false,
    supersededByMissionId: null,
    incompleteReasons: ["execution-receipt-missing", "mission-artifact-coverage-missing", "criteria-coverage-missing"]
  }]);
  assert.deepEqual(blocked.contributingReceiptIds, ["dependent-receipt"]);

  ingestDirect(root, validReceipt(root, dependency, {
    receiptId: "dependency-receipt",
    artifactPath: "outputs/dependency.md"
  }));
  const complete = assessMissionCompletion(root, { missionId: dependent.missionId });
  assert.equal(complete.complete, true);
  assert.deepEqual(complete.incompleteReasons, []);
  assert.equal(complete.dependencyCoverage[0].complete, true);
  assert.deepEqual(complete.contributingReceiptIds, ["dependent-receipt"]);
});

test("successors explicitly take over current artifact ownership without inheriting completion credit", () => {
  const root = createTempRoot("dove-successor-artifact-takeover-");
  writeText(root, "outputs/shared.md", "shared result\n");
  writeText(root, "outputs/validation.log", "tests passed\n");
  const original = materializeMission(root, {
    missionId: "original-mission",
    targetArtifacts: ["outputs/shared.md"],
    expectedArtifacts: ["outputs/shared.md"],
    evidenceRequirements: ["artifact:outputs/shared.md"]
  });
  ingestDirect(root, validReceipt(root, original, {
    receiptId: "original-receipt",
    artifactPath: "outputs/shared.md"
  }));
  const successor = materializeMission(root, {
    missionId: "successor-mission",
    targetArtifacts: ["outputs/shared.md"],
    expectedArtifacts: ["outputs/shared.md"],
    evidenceRequirements: ["artifact:outputs/shared.md"],
    supersedesMissionId: original.missionId
  });
  const beforeTakeover = assessMissionCompletion(root, { missionId: successor.missionId });
  assert.equal(beforeTakeover.complete, false);
  assert.equal(beforeTakeover.receiptCount, 0);
  assert.deepEqual(beforeTakeover.contributingReceiptIds, []);

  ingestDirect(root, validReceipt(root, successor, {
    receiptId: "successor-receipt",
    artifactPath: "outputs/shared.md"
  }));
  const afterTakeover = assessMissionCompletion(root, { missionId: successor.missionId });
  assert.equal(afterTakeover.complete, true);
  assert.deepEqual(afterTakeover.contributingReceiptIds, ["successor-receipt"]);
  assert.equal(readArtifactOwnership(root).artifacts.find((item) => item.path === "outputs/shared.md").missionId, successor.missionId);
  assert.deepEqual(readArtifactHistory(root).filter((item) => item.path === "outputs/shared.md").map((item) => item.missionId), [original.missionId, successor.missionId]);

  const unrelated = materializeMission(root, { missionId: "unrelated-mission" });
  const beforeUnrelated = snapshot(root);
  assert.throws(() => ingestDirect(root, validReceipt(root, unrelated, {
    receiptId: "unrelated-receipt",
    artifactPath: "outputs/shared.md"
  })), /already owned by mission successor-mission.*unrelated mission unrelated-mission/u);
  assert.deepEqual(snapshot(root), beforeUnrelated);
});

test("superseded dependencies stay exact and expose their current successor", () => {
  const root = createTempRoot("dove-superseded-dependency-");
  writeText(root, "outputs/dependency.md", "dependency\n");
  writeText(root, "outputs/dependent.md", "dependent\n");
  writeText(root, "outputs/validation.log", "tests passed\n");
  const dependency = materializeMission(root, { missionId: "dependency", targetArtifacts: ["outputs/dependency.md"] });
  const dependent = materializeMission(root, { missionId: "dependent", targetArtifacts: ["outputs/dependent.md"], dependsOnMissionIds: [dependency.missionId] });
  ingestDirect(root, validReceipt(root, dependency, { receiptId: "dependency-receipt", artifactPath: "outputs/dependency.md" }));
  ingestDirect(root, validReceipt(root, dependent, { receiptId: "dependent-receipt", artifactPath: "outputs/dependent.md" }));
  assert.equal(assessMissionCompletion(root, { missionId: dependent.missionId }).complete, true);
  const successor = materializeMission(root, { missionId: "dependency-successor", supersedesMissionId: dependency.missionId });
  const blocked = assessMissionCompletion(root, { missionId: dependent.missionId });
  assert.equal(blocked.complete, false);
  assert.ok(blocked.incompleteReasons.includes("mission-dependency-incomplete"));
  assert.deepEqual(blocked.dependencyCoverage, [{
    missionId: dependency.missionId,
    status: "superseded",
    complete: false,
    supersededByMissionId: successor.missionId,
    incompleteReasons: ["mission-superseded"]
  }]);
});

test("supersession chains route historical missions to the terminal successor", () => {
  const root = createTempRoot("dove-supersession-chain-");
  writeText(root, "outputs/validation.log", "tests passed\n");
  const first = materializeMission(root, { missionId: "first" });
  materializeMission(root, { missionId: "second", supersedesMissionId: first.missionId });
  const terminal = materializeMission(root, { missionId: "terminal", supersedesMissionId: "second" });
  for (const missionId of ["first", "second"]) {
    const assessment = assessMissionCompletion(root, { missionId });
    assert.equal(assessment.status, "superseded");
    assert.equal(assessment.supersededByMissionId, terminal.missionId);
    const status = queryDoveStatus(root, { missionId });
    assert.equal(status.currentContext.integrityAssessment.supersededByMissionId, terminal.missionId);
    assert.match(status.nextStep.command, /--mission-id "terminal"/u);
  }
  const before = snapshot(root);
  assert.throws(() => ingestDirect(root, validReceipt(root, first, {
    receiptId: "late-chain-receipt",
    artifacts: [],
    validations: [],
    criteriaSatisfied: []
  })), /superseded by terminal.*no longer accepts execution receipts/u);
  assert.deepEqual(snapshot(root), before);
});

test("superseded missions become read-only history and reject public or internal progress writes", () => {
  const root = createTempRoot("dove-mission-supersession-");
  writeText(root, "outputs/old.md", "old result\n");
  writeText(root, "outputs/new.md", "new result\n");
  writeText(root, "outputs/validation.log", "tests passed\n");
  const oldMission = materializeMission(root, {
    missionId: "old-mission",
    targetArtifacts: ["outputs/old.md"]
  });
  ingestDirect(root, validReceipt(root, oldMission, {
    receiptId: "old-receipt",
    artifactPath: "outputs/old.md"
  }));
  assert.equal(assessMissionCompletion(root, { missionId: oldMission.missionId }).complete, true);

  const successor = materializeMission(root, {
    missionId: "new-mission",
    targetArtifacts: ["outputs/new.md"],
    supersedesMissionId: oldMission.missionId
  });
  const historical = assessMissionCompletion(root, { missionId: oldMission.missionId });
  assert.equal(historical.status, "superseded");
  assert.equal(historical.complete, false);
  assert.equal(historical.supersededByMissionId, successor.missionId);
  assert.deepEqual(historical.incompleteReasons, ["mission-superseded"]);
  assert.deepEqual(historical.contributingReceiptIds, ["old-receipt"]);

  const publicReceipt = validReceipt(root, oldMission, {
    receiptId: "old-late-receipt",
    artifactPath: "outputs/old.md",
    criteriaSatisfied: []
  });
  const beforePublic = snapshot(root);
  assert.throws(() => ingestDirect(root, publicReceipt), /superseded by new-mission.*no longer accepts execution receipts/u);
  assert.deepEqual(snapshot(root), beforePublic);

  const beforeInternal = snapshot(root);
  assert.throws(() => runWithMutationContext(root, {
    actionId: "upsert-draft",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => finalizeDomainArtifacts(root, {
    actionId: "upsert-draft",
    missionId: oldMission.missionId,
    summary: "Attempt a late internal write.",
    writes: [{ path: ".dove/drafts/late.md", kind: "document", content: "late\n", derivedReferences: [] }]
  })), /superseded by new-mission.*read-only history/u);
  assert.deepEqual(snapshot(root), beforeInternal);
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

test("receipt ingestion accepts partial artifact progress and preflights malformed receipt ledger", () => {
  const { root, mission } = preparedRoot({
    missionId: "preflight-lineage",
    targetArtifacts: ["outputs/result.md"],
    expectedArtifacts: ["outputs/expected.md"]
  });
  writeText(root, "outputs/expected.md", "expected\n");
  const partialReceipt = validReceipt(root, mission, { receiptId: "preflight-partial" });
  ingestDirect(root, partialReceipt);
  const partialAssessment = assessMissionCompletion(root, { missionId: mission.missionId });
  assert.equal(partialAssessment.complete, false);
  assert.ok(partialAssessment.incompleteReasons.includes("mission-artifact-coverage-missing"));

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

test("host outcome closure generates current receipt evidence and skips equivalent repeats", () => {
  const root = createTempRoot("dove-host-outcome-");
  writeText(root, "outputs/host-result.md", "host result\n");
  writeText(root, "outputs/host-validation.log", "validation output\n");
  const mission = materializeMission(root, {
    missionId: "host-outcome",
    targetArtifacts: ["outputs/host-result.md"]
  });
  const args = {
    missionId: mission.missionId,
    summary: "Recorded the host-produced result.",
    artifactPaths: ["outputs/host-result.md"],
    validationPaths: ["outputs/host-validation.log"]
  };
  const mutation = runWithMutationContext(root, {
    actionId: "close-host-outcome",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => closeHostOutcome(root, args));
  assert.equal(mutation.completion.assessment, null);
  assert.deepEqual(mutation.postCommit, { kind: "assess-mission-completion", missionId: mission.missionId });
  const result = resolveExecutionReceiptPostCommit(root, mutation);
  assert.equal(result.status, "ingested");
  assert.equal(result.completion.assessment.complete, false);
  assert.deepEqual(result.completion.assessment.incompleteReasons, ["criteria-coverage-missing"]);
  const [storedName] = fs.readdirSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir));
  const stored = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir, storedName), "utf8"));
  assert.match(stored.receiptId, /^receipt-host-outcome-/u);
  assert.equal(stored.contractDigest, mission.contractDigest);
  assert.equal(stored.artifacts[0].sha256, sha256File(root, "outputs/host-result.md"));
  assert.equal(stored.validations[0].outputHash, sha256File(root, "outputs/host-validation.log"));
  assert.deepEqual(stored.criteriaSatisfied, []);
  assert.deepEqual(stored.producer, { kind: "public-execution", actionId: "ingest-execution-receipt" });

  const beforeRepeat = snapshot(root);
  const repeated = runWithMutationContext(root, {
    actionId: "close-host-outcome",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => closeHostOutcome(root, args));
  assert.equal(repeated.status, "skipped");
  assert.equal(repeated.zeroWrite, true);
  assert.equal(repeated.writesApplied, false);
  assert.equal(Object.hasOwn(repeated, "postCommit"), true);
  assert.equal(repeated.postCommit, null);
  assert.deepEqual(snapshot(root), beforeRepeat);
});

test("host outcome closure is zero-write without uncovered artifacts and rejects unsafe claims", () => {
  const root = createTempRoot("dove-host-outcome-skip-");
  writeText(root, "outputs/validation.log", "validation only\n");
  const mission = materializeMission(root, { missionId: "host-skip" });
  const before = snapshot(root);
  const skipped = runWithMutationContext(root, {
    actionId: "close-host-outcome",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => closeHostOutcome(root, {
    missionId: mission.missionId,
    summary: "No host artifact was produced.",
    artifactPaths: [],
    validationPaths: ["outputs/validation.log"]
  }));
  assert.equal(skipped.status, "skipped");
  assert.equal(skipped.zeroWrite, true);
  assert.equal(skipped.writesApplied, false);
  assert.deepEqual(snapshot(root), before);

  for (const extra of [
    { receiptId: "caller-controlled" },
    { criteriaSatisfied: [] },
    { taskId: "host-task" }
  ]) {
    assert.throws(() => runWithMutationContext(root, {
      actionId: "close-host-outcome",
      mutationMode: "direct-process",
      hostId: "test"
    }, () => closeHostOutcome(root, {
      missionId: mission.missionId,
      summary: "Reject authority fields.",
      artifactPaths: [],
      ...extra
    })), /does not accept unknown input/u);
  }

  assert.throws(() => runWithMutationContext(root, {
    actionId: "close-host-outcome",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => closeHostOutcome(root, {
    missionId: mission.missionId,
    summary: "Reject bookkeeping.",
    artifactPaths: [ARTIFACT_PATHS.projectIdentity]
  })), /substantive workspace file rather than Dove bookkeeping/u);

  assert.throws(() => runWithMutationContext(root, {
    actionId: "close-host-outcome",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => closeHostOutcome(root, {
    missionId: mission.missionId,
    summary: "Reject validation bookkeeping even when no artifact is eligible.",
    artifactPaths: [],
    validationPaths: [ARTIFACT_PATHS.projectIdentity]
  })), /substantive workspace file rather than Dove bookkeeping/u);
  assert.deepEqual(snapshot(root), before);
});

test("host outcome closure supports successor artifact takeover and canonical overlap rejection", () => {
  const root = createTempRoot("dove-host-outcome-successor-");
  writeText(root, "outputs/shared.md", "shared result\n");
  const ancestor = materializeMission(root, {
    missionId: "host-ancestor",
    targetArtifacts: ["outputs/shared.md"]
  });
  runWithMutationContext(root, {
    actionId: "close-host-outcome",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => closeHostOutcome(root, {
    missionId: ancestor.missionId,
    summary: "Record the ancestor result.",
    artifactPaths: ["outputs/shared.md"]
  }));
  const successor = materializeMission(root, {
    missionId: "host-successor",
    targetArtifacts: ["outputs/shared.md"],
    supersedesMissionId: ancestor.missionId
  });
  const takenOver = runWithMutationContext(root, {
    actionId: "close-host-outcome",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => closeHostOutcome(root, {
    missionId: successor.missionId,
    summary: "Take over the current shared result.",
    artifactPaths: ["outputs/shared.md"]
  }));
  assert.equal(takenOver.status, "ingested");
  assert.equal(readArtifactOwnership(root).artifacts[0].missionId, successor.missionId);

  const domainPath = ".dove/drafts/shared.md";
  const domainAncestor = materializeMission(root, {
    missionId: "host-domain-ancestor",
    targetArtifacts: [domainPath]
  });
  runWithMutationContext(root, {
    actionId: "upsert-draft",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => finalizeDomainArtifacts(root, {
    actionId: "upsert-draft",
    missionId: domainAncestor.missionId,
    writes: [{
      path: domainPath,
      kind: "document",
      content: "domain-owned result\n"
    }],
    summary: "Record the domain-owned result."
  }));
  const domainSuccessor = materializeMission(root, {
    missionId: "host-domain-successor",
    targetArtifacts: [domainPath],
    supersedesMissionId: domainAncestor.missionId
  });
  const beforeDomainTakeover = snapshot(root);
  assert.throws(() => runWithMutationContext(root, {
    actionId: "close-host-outcome",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => closeHostOutcome(root, {
    missionId: domainSuccessor.missionId,
    summary: "Do not bypass the domain workflow during successor takeover.",
    artifactPaths: [domainPath]
  })), /owned by another mission/u);
  assert.deepEqual(snapshot(root), beforeDomainTakeover);

  const beforeOverlap = snapshot(root);
  assert.throws(() => runWithMutationContext(root, {
    actionId: "close-host-outcome",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => closeHostOutcome(root, {
    missionId: successor.missionId,
    summary: "Reject one file in two evidence roles.",
    artifactPaths: ["outputs/shared.md"],
    validationPaths: ["outputs\\shared.md"]
  })), /canonically distinct/u);
  assert.deepEqual(snapshot(root), beforeOverlap);
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
  assert.deepEqual(directResult.completion.assessment.contributingReceiptIds, [directReceipt.receiptId]);
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
    renameSync(from, to, metadata) {
      if (metadata?.displayTo === receiptPath || to === receiptPath) throw new Error("injected receipt promotion failure");
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
  assert.deepEqual(assessment.contributingReceiptIds, []);
  assert.equal(assessment.complete, false);
});

test("post-commit host outcome assessment failure preserves the committed receipt", () => {
  const root = createTempRoot("dove-host-outcome-assessment-failure-");
  writeText(root, "outputs/result.md", "committed host result\n");
  const mission = materializeMission(root, {
    missionId: "host-assessment-failure",
    targetArtifacts: ["outputs/result.md"]
  });
  const mutation = runWithMutationContext(root, {
    actionId: "close-host-outcome",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => closeHostOutcome(root, {
    missionId: mission.missionId,
    summary: "Record the result before assessment fails.",
    artifactPaths: ["outputs/result.md"]
  }));
  const receiptPath = path.join(root, ARTIFACT_PATHS.executionReceiptsDir, `${mutation.receipt.receiptId}.json`);
  assert.equal(fs.existsSync(receiptPath), true);
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.missionsDir, `${mission.missionId}.json`), "{ malformed\n", "utf8");
  const result = resolveExecutionReceiptPostCommit(root, mutation);
  assert.equal(result.status, "ingested");
  assert.equal(result.completion.assessment, null);
  assert.equal(result.completion.assessmentUnavailable, true);
  assert.equal(fs.existsSync(receiptPath), true);
  assert.equal(fs.readFileSync(path.join(root, "outputs/result.md"), "utf8"), "committed host result\n");
});

test("failed direct-process host outcome commit preserves the real host file", () => {
  const root = createTempRoot("dove-host-outcome-commit-failure-");
  writeText(root, "outputs/result.md", "real host result\n");
  const mission = materializeMission(root, {
    missionId: "failed-host-outcome",
    targetArtifacts: ["outputs/result.md"]
  });
  const before = snapshot(root);
  const fsOps = {
    ...fs,
    renameSync(from, to, metadata) {
      if (metadata?.anchoredTo?.startsWith(`${ARTIFACT_PATHS.executionReceiptsDir}/`)) {
        throw new Error("injected host outcome promotion failure");
      }
      return fs.renameSync(from, to);
    }
  };
  assert.throws(() => runWithMutationContext(root, {
    actionId: "close-host-outcome",
    mutationMode: "direct-process",
    hostId: "test",
    fsOps
  }, () => closeHostOutcome(root, {
    missionId: mission.missionId,
    summary: "Attempt to record the real host result.",
    artifactPaths: ["outputs/result.md"]
  })), /injected host outcome promotion failure/u);
  assert.deepEqual(snapshot(root), before);
  assert.equal(fs.readFileSync(path.join(root, "outputs/result.md"), "utf8"), "real host result\n");
  assert.deepEqual(readArtifactOwnership(root).artifacts, []);
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
  assert.deepEqual(complete.contributingReceiptIds, [receipt.receiptId]);
  assert.deepEqual(complete.staleReceiptIds, []);

  writeText(root, "outputs/result.md", "changed\n");
  const stale = assessMissionCompletion(root, { missionId: mission.missionId });
  assert.equal(stale.complete, false);
  assert.deepEqual(stale.staleReceiptIds, [receipt.receiptId]);
  assert.ok(stale.incompleteReasons.includes("execution-receipts-stale-or-invalid"));
});

test("mission proposals reject unavailable source and authoritative review requirements without writes", () => {
  for (const requirement of ["source:paper-required", "review:authoritative"]) {
    const root = createTempRoot("dove-receipt-unavailable-authority-");
    const before = snapshot(root);
    assert.throws(() => createDoveMission(root, {
      missionId: "unavailable-authority",
      goal: "Reject an unsatisfiable contract.",
      evidenceRequirements: [requirement]
    }), /no public authority path/u);
    assert.deepEqual(snapshot(root), before);
  }
});

test("selected mission status has no impossible source or authoritative-review contract gaps", () => {
  const ordinary = preparedRoot({ missionId: "ordinary-status" });
  ingestDirect(ordinary.root, validReceipt(ordinary.root, ordinary.mission));
  const ordinaryStatus = queryDoveStatus(ordinary.root, { missionId: ordinary.mission.missionId, detail: "full" });
  assert.equal(ordinaryStatus.needsAttention.status, "clear");
  assert.deepEqual(ordinaryStatus.needsAttention.stableGaps.sources, []);
  assert.deepEqual(ordinaryStatus.needsAttention.stableGaps.review, []);
  assert.deepEqual(ordinaryStatus.sourceIntegrity.required, []);
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
    status: "complete",
    complete: true,
    supersededByMissionId: null,
    dependencyCoverage: [],
    staleReceiptCount: 0,
    incompleteReasons: []
  });
  assert.equal(Object.hasOwn(status.currentContext.integrityAssessment, "currentReceiptId"), false);
  assert.equal(Object.hasOwn(status.currentContext, "objective"), false);
  assert.equal(Object.hasOwn(status.currentContext, "currentFocus"), false);
  assert.doesNotMatch(status.nextStep.label, new RegExp(mission.goal.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.deepEqual(snapshot(root), before);
});
