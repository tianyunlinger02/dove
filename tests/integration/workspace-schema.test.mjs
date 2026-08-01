import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import * as core from "../../src/core/index.mjs";
import { ARTIFACT_PATHS, DOVE_WORKSPACE_SCHEMA_VERSION } from "../../src/core/schema.mjs";
import { closeHostOutcome } from "../../src/core/execution-receipts.mjs";
import { createDoveMission, manageDoveWorkspace } from "../../src/core/mission-contracts.mjs";
import { validateMissionGraph } from "../../src/core/mission-graph.mjs";
import { createMissionTransition } from "../../src/core/mission-lifecycle.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { queryDoveStatus } from "../../src/core/mission-queries.mjs";
import { inspectDoveWorkspace } from "../../src/core/workspace-schema.mjs";
import { initializeWorkspace } from "../helpers/current-schema-workspace.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function snapshot(root) {
  const values = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(fullPath);
      else values[path.relative(root, fullPath)] = entry.isSymbolicLink()
        ? `link:${fs.readlinkSync(fullPath)}`
        : fs.readFileSync(fullPath).toString("base64");
    }
  };
  visit(root);
  return values;
}

function writeJson(root, relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`);
}

function initCurrent(root, mainline = "Test current schema") {
  return initializeWorkspace(root, { mainline });
}

function materialize(root, args) {
  const proposal = createDoveMission(root, args);
  return runWithMutationContext(root, {
    actionId: "create-dove-mission",
    mutationMode: args.mutationMode ?? "direct-process",
    hostId: "test"
  }, () => createDoveMission(root, proposal.confirmation.confirmArgs));
}

function assertZeroWriteFailure(root, callback, pattern) {
  const before = snapshot(root);
  assert.throws(callback, pattern);
  assert.deepEqual(snapshot(root), before);
}

test("schema 18 public API omits retired RequirementSnapshot, ResearchTree, Note, and Version surfaces", () => {
  for (const field of [
    "requirementSnapshotsDir",
    "researchTreesDir",
    "completionReceiptsDir",
    "authorityReceiptsDir",
    "notesDir",
    "versionsDir"
  ]) {
    assert.equal(Object.hasOwn(ARTIFACT_PATHS, field), false);
  }
  for (const name of [
    "createRequirementSnapshot",
    "validatePersistedRequirementSnapshot",
    "readResearchTree",
    "reevaluateResearchTree",
    "researchTreePath",
    "researchTreeProjection",
    "validateResearchTree",
    "upsertNote",
    "createVersionSnapshot",
    "compareVersions",
    "ingestExecutionReceipt"
  ]) {
    assert.equal(Object.hasOwn(core, name), false);
  }
});

test("schema 18 initialization creates only the minimal current workspace layout", () => {
  const root = createTempRoot("dove-schema18-init-");
  const before = snapshot(root);
  assert.equal(queryDoveStatus(root).scope.state, "absent");
  assert.deepEqual(snapshot(root), before);

  const proposal = manageDoveWorkspace(root, {
    operation: "initialize",
    mainline: "Establish the current research mainline.",
    mutationMode: "direct-process"
  });
  assert.equal(proposal.newSchemaVersion, DOVE_WORKSPACE_SCHEMA_VERSION);
  assert.deepEqual(snapshot(root), before);

  const result = runWithMutationContext(root, {
    actionId: "manage-dove-workspace",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => manageDoveWorkspace(root, proposal.confirmation.confirmArgs));
  assert.equal(result.status, "initialized");
  const workspace = inspectDoveWorkspace(root);
  assert.equal(workspace.healthy, true);
  assert.equal(workspace.schemaVersion, 18);
  assert.equal(workspace.project.schemaVersion, 3);
  assert.equal(Object.hasOwn(workspace.project, "projectId"), false);
  assert.equal(Object.hasOwn(workspace.project, "trust"), false);
  assert.equal(fs.existsSync(path.join(root, ".dove/requirement-snapshots")), false);
  assert.equal(fs.existsSync(path.join(root, ".dove/research-trees")), false);
  assert.equal(fs.existsSync(path.join(root, ".dove/receipts/completion")), false);
  assert.equal(fs.existsSync(path.join(root, ".dove/receipts/authority")), false);
  assert.equal(fs.existsSync(path.join(root, ".dove/notes")), false);
  assert.equal(fs.existsSync(path.join(root, ".dove/versions")), false);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.lessonsDocument)), true);
  assert.equal(fs.existsSync(path.join(root, ".dove/lessons")), false);
});

test("schema 18 mission binds requirements and artifacts directly without snapshot authority", () => {
  const root = createTempRoot("dove-schema18-direct-mission-");
  initCurrent(root);
  const result = materialize(root, {
    mode: "research",
    missionId: "direct-mission",
    goal: "Resolve one bounded question.",
    requirements: ["Interpret one bounded result."],
    assumptions: ["The current file is inspectable."],
    artifacts: [{ path: "outputs/result.md", required: true, role: "output" }],
    completionCriteria: ["The result is interpreted."],
    evidenceRequirements: ["artifact:outputs/result.md"]
  });
  assert.deepEqual(result.mission.requirements, ["Interpret one bounded result."]);
  assert.deepEqual(result.mission.artifacts, [{ path: "outputs/result.md", required: true, role: "output" }]);
  assert.equal(Object.hasOwn(result.mission, "requirementSnapshotId"), false);
  assert.equal(Object.hasOwn(result.mission, "changeFrom"), false);
  assert.equal(inspectDoveWorkspace(root).requirementSnapshots, undefined);
  assert.equal(inspectDoveWorkspace(root).researchTrees, undefined);
});

test("mission patch plans remain zero-write and contain only Mission and Decision writes", () => {
  const root = createTempRoot("dove-schema18-mission-plan-");
  initCurrent(root);
  const before = snapshot(root);
  const proposal = createDoveMission(root, {
    mode: "research",
    goal: "Plan one bounded research mission.",
    artifacts: [{ path: "README.md", required: true, role: "output" }],
    mutationMode: "patch-plan"
  });
  const result = runWithMutationContext(root, {
    actionId: "create-dove-mission",
    mutationMode: "patch-plan",
    hostId: "test"
  }, () => createDoveMission(root, proposal.confirmation.confirmArgs));
  assert.equal(result.status, "materialization-planned");
  assert.deepEqual(snapshot(root), before);
  const paths = result.mutationPlan.operations.map((operation) => operation.relativePath);
  assert.ok(paths.some((item) => item.startsWith(`${ARTIFACT_PATHS.missionsDir}/`)));
  assert.ok(paths.some((item) => item.startsWith(`${ARTIFACT_PATHS.researchDecisionsDir}/`)));
  assert.equal(paths.some((item) => item.includes("requirement-snapshots") || item.includes("research-trees")), false);
});

test("mission direct-process promotion failures roll back atomically", () => {
  const root = createTempRoot("dove-schema18-mission-rollback-");
  initCurrent(root);
  const before = snapshot(root);
  const proposal = createDoveMission(root, {
    mode: "research",
    goal: "Exercise one atomic mission write.",
    artifacts: [{ path: "README.md", required: true, role: "output" }]
  });
  const fsOps = {
    ...fs,
    renameSync(from, to, metadata) {
      if (metadata?.anchoredTo?.startsWith(`${ARTIFACT_PATHS.missionsDir}/`)) {
        throw new Error("injected mission promotion failure");
      }
      return fs.renameSync(from, to);
    }
  };
  assert.throws(() => runWithMutationContext(root, {
    actionId: "create-dove-mission",
    mutationMode: "direct-process",
    hostId: "test",
    fsOps
  }, () => createDoveMission(root, proposal.confirmation.confirmArgs)), /all staged changes were rolled back.*injected mission promotion failure/u);
  assert.deepEqual(snapshot(root), before);
});

test("explicit child missions replace snapshot change maps with parent branch lineage", () => {
  const root = createTempRoot("dove-schema18-branch-");
  initCurrent(root);
  const parent = materialize(root, {
    mode: "research",
    missionId: "parent",
    goal: "Investigate the parent route."
  }).mission;
  const child = materialize(root, {
    operation: "branch",
    mode: "research",
    missionId: "child",
    goal: "Investigate one explicit child route.",
    parentMissionId: parent.missionId,
    branchKind: "alternative",
    branchReason: "Test a distinct explanation.",
    stopParentReason: "Stop the parent before opening its explicit child."
  }).mission;
  assert.equal(child.parentMissionId, parent.missionId);
  assert.equal(child.branchKind, "alternative");
  assert.equal(Object.hasOwn(child, "changeFrom"), false);
  const workspace = inspectDoveWorkspace(root);
  assert.deepEqual(workspace.missionGraph.childrenByMission.get(parent.missionId), [child.missionId]);
  assert.equal(workspace.missionTransitions.get(parent.missionId).status, "stopped");
});

test("mission graph validation rejects unknown, self, and cyclic edges", () => {
  const root = createTempRoot("dove-schema18-mission-graph-");
  initCurrent(root);
  assertZeroWriteFailure(root, () => createDoveMission(root, {
    mode: "research",
    missionId: "unknown-dependency",
    goal: "Reject an unknown dependency.",
    dependsOnMissionIds: ["missing"]
  }), /depends on unknown mission/u);
  assertZeroWriteFailure(root, () => createDoveMission(root, {
    mode: "research",
    missionId: "self-edge",
    goal: "Reject a self dependency.",
    dependsOnMissionIds: ["self-edge"]
  }), /must not depend on itself/u);
  assert.throws(() => validateMissionGraph([
    { filename: "first.json", mission: { missionId: "first", dependsOnMissionIds: ["second"] } },
    { filename: "second.json", mission: { missionId: "second", dependsOnMissionIds: ["first"] } }
  ]), /dependency graph contains a cycle/u);
});

test("strict opener validates typed ordinary observations and mission mode boundaries", () => {
  const root = createTempRoot("dove-schema18-host-observation-");
  initCurrent(root);
  const mission = materialize(root, {
    mode: "ordinary",
    missionId: "ordinary-observation",
    goal: "Perform one no-file operation.",
    completionCriteria: ["The operation returns a concrete observation."]
  }).mission;
  runWithMutationContext(root, {
    actionId: "close-host-outcome",
    mutationMode: "direct-process",
    hostId: "test"
  }, () => closeHostOutcome(root, {
    missionId: mission.missionId,
    attemptId: "ordinary-observation-attempt",
    status: "completed",
    summary: "The no-file operation completed.",
    artifactPaths: [],
    validationPaths: [],
    facts: [{ statement: "The bounded command returned exit code zero without producing a file.", criterionNumbers: [1] }]
  }));
  assert.equal(inspectDoveWorkspace(root).receiptLedger.receipts[0].ordinaryHostOutcome.mode, "observation-only");

  const [receiptName] = fs.readdirSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir));
  const receiptPath = path.join(root, ARTIFACT_PATHS.executionReceiptsDir, receiptName);
  const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  receipt.ordinaryHostOutcome.facts = [];
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  assertZeroWriteFailure(root, () => queryDoveStatus(root), /observation-only mode requires at least one execution fact/u);
});

test("strict opener rejects current Mission, Decision, and project identity tampering", () => {
  const root = createTempRoot("dove-schema18-tamper-");
  initCurrent(root);
  const result = materialize(root, {
    mode: "research",
    missionId: "tamper",
    goal: "Bind exact current content."
  });

  const missionPath = path.join(root, ARTIFACT_PATHS.missionsDir, "tamper.json");
  const mission = JSON.parse(fs.readFileSync(missionPath, "utf8"));
  mission.goal = "Hand-edited goal.";
  fs.writeFileSync(missionPath, `${JSON.stringify(mission, null, 2)}\n`);
  assertZeroWriteFailure(root, () => queryDoveStatus(root), /contractDigest does not match its canonical mission content/u);

  fs.writeFileSync(missionPath, `${JSON.stringify(result.mission, null, 2)}\n`);
  const decisionName = fs.readdirSync(path.join(root, ARTIFACT_PATHS.researchDecisionsDir))[0];
  const decisionPath = path.join(root, ARTIFACT_PATHS.researchDecisionsDir, decisionName);
  const decision = JSON.parse(fs.readFileSync(decisionPath, "utf8"));
  decision.synthesis = "Tampered scientific judgment.";
  fs.writeFileSync(decisionPath, `${JSON.stringify(decision, null, 2)}\n`);
  assertZeroWriteFailure(root, () => queryDoveStatus(root), /canonical content|does not match/u);

  fs.writeFileSync(decisionPath, `${JSON.stringify(result.currentResearchDecision, null, 2)}\n`);
  const projectPath = path.join(root, ARTIFACT_PATHS.projectIdentity);
  const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
  project.projectId = `project-${project.workspaceId}`;
  writeJson(root, ARTIFACT_PATHS.projectIdentity, project);
  assertZeroWriteFailure(root, () => queryDoveStatus(root), /does not accept unknown fields.*projectId/u);
});

test("strict opener rejects retired Schema 16 aggregate and generic receipt directories", () => {
  for (const relativePath of [
    ".dove/requirement-snapshots",
    ".dove/research-trees",
    ".dove/receipts/completion",
    ".dove/receipts/authority"
  ]) {
    const root = createTempRoot("dove-schema18-retired-path-");
    initCurrent(root);
    fs.mkdirSync(path.join(root, relativePath), { recursive: true });
    assertZeroWriteFailure(root, () => queryDoveStatus(root), /retained legacy artifact/u);
  }
});

test("schema 18 Mission transitions reject retired migration provenance", () => {
  assert.throws(() => createMissionTransition({
    workspaceId: "workspace-current",
    missionId: "mission-current",
    contractDigest: "a".repeat(64),
    workspaceRevisionId: "workspace-revision-current",
    status: "stopped",
    reason: "Do not admit migration provenance into current durable state.",
    evidenceRefs: [],
    trigger: "migration",
    createdAt: "2026-01-01T00:00:00.000Z"
  }), /trigger is unsupported/u);
});

test("schema 18 runtime rejects schema 16 without a conversion surface", () => {
  const root = createTempRoot("dove-schema18-block-schema16-");
  fs.mkdirSync(path.join(root, ".dove"), { recursive: true });
  writeJson(root, ARTIFACT_PATHS.doveRootManifest, { schemaVersion: 16 });
  assertZeroWriteFailure(root, () => queryDoveStatus(root), /cannot open unsupported Dove schema 16 under schema 18.*archive the old workspace/iu);
  assertZeroWriteFailure(root, () => manageDoveWorkspace(root, {
    operation: "migrate-workspace",
    mutationMode: "direct-process"
  }), /workspace operation must be initialize or revise-mainline/u);
});

test("malformed current project JSON fails visibly without repair", () => {
  const root = createTempRoot("dove-schema18-malformed-project-");
  initCurrent(root);
  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.projectIdentity), "{bad\n");
  assertZeroWriteFailure(root, () => queryDoveStatus(root), /Malformed durable JSON|malformed/u);
});
