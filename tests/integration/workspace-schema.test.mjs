import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { ARTIFACT_PATHS, DOVE_WORKSPACE_SCHEMA_VERSION } from "../../src/core/schema.mjs";
import { createDoveMission, initDoveGoal } from "../../src/core/mission-contracts.mjs";
import { validateMissionGraph } from "../../src/core/mission-graph.mjs";
import { queryDoveMission, queryDoveStatus } from "../../src/core/mission-queries.mjs";
import { inspectDoveSourceTree, inspectDoveWorkspace } from "../../src/core/workspace-schema.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

const ROOT = process.cwd();
const CLI = path.join(ROOT, "bin", "dove.mjs");

function snapshot(root) {
  const values = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(fullPath);
      else values[path.relative(root, fullPath)] = entry.isSymbolicLink() ? `link:${fs.readlinkSync(fullPath)}` : fs.readFileSync(fullPath).toString("base64");
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

function initCurrent(root, goal = "Test current schema") {
  const proposal = initDoveGoal(root, { goal, mutationMode: "direct-process" });
  return runWithMutationContext(root, { actionId: "init-dove-goal", mutationMode: "direct-process", hostId: "test" }, () => initDoveGoal(root, proposal.confirmation.confirmArgs));
}

function assertZeroWriteFailure(root, callback, pattern) {
  const before = snapshot(root);
  assert.throws(callback, pattern);
  assert.deepEqual(snapshot(root), before);
}

test("absent reads and normal init proposal are zero-write, exact confirmation creates only schema 8 minimum", () => {
  const root = createTempRoot("dove-schema-absent-");
  const before = snapshot(root);
  const absentStatus = queryDoveStatus(root);
  assert.equal(absentStatus.scope.state, "absent");
  assert.equal(absentStatus.needsAttention.status, "needs-init");
  assert.deepEqual(snapshot(root), before);
  const preview = queryDoveMission(root, { goal: "Preview absent mission" });
  assert.equal(preview.status, "proposal");
  assert.deepEqual(snapshot(root), before);

  const proposal = initDoveGoal(root, { goal: "Initialize strict workspace", mutationMode: "direct-process" });
  assert.equal(proposal.newSchemaVersion, DOVE_WORKSPACE_SCHEMA_VERSION);
  assert.equal(proposal.mutation.writesApplied, false);
  assert.deepEqual(snapshot(root), before);
  const patchProposal = initDoveGoal(root, { goal: "Initialize strict workspace", mutationMode: "patch-plan" });
  const patchResult = runWithMutationContext(root, { actionId: "init-dove-goal", mutationMode: "patch-plan", hostId: "test" }, () => initDoveGoal(root, patchProposal.confirmation.confirmArgs));
  assert.equal(patchResult.status, "initialization-planned");
  assert.equal(patchResult.writesApplied, false);
  assert.ok(patchResult.mutationPlan.operations.some((operation) => operation.kind === "ensure-directory"));
  assert.deepEqual(snapshot(root), before);

  const initialized = runWithMutationContext(root, { actionId: "init-dove-goal", mutationMode: "direct-process", hostId: "test" }, () => initDoveGoal(root, proposal.confirmation.confirmArgs));
  assert.equal(initialized.status, "initialized");
  assert.equal(inspectDoveWorkspace(root).healthy, true);
  assert.deepEqual(fs.readdirSync(path.join(root, ".dove")).sort(), [
    "artifacts", "claims", "drafts", "experiments", "figures", "manifest.json", "missions", "notes", "project.json", "rebuttal", "receipts", "reviews", "sources", "versions"
  ]);
  assert.equal(fs.existsSync(path.join(root, ".dove", "state.json")), false);
  assert.equal(fs.existsSync(path.join(root, ".dove", "task-packets")), false);
  assert.equal(fs.existsSync(path.join(root, ".dove", "artifacts", "ownership.json")), false);
  assert.equal(fs.existsSync(path.join(root, ".dove", "artifacts", "lineage.json")), false);
});

test("strict opener rejects a dangling .dove symlink as an invalid root without writes", () => {
  const root = createTempRoot("dove-schema-dangling-root-");
  fs.symlinkSync("missing-dove-target", path.join(root, ".dove"), "dir");
  assertZeroWriteFailure(root, () => queryDoveStatus(root), /invalid Dove workspace state invalid-root/u);
  assert.equal(fs.lstatSync(path.join(root, ".dove")).isSymbolicLink(), true);
});

test("strict opener classifies missing, malformed, legacy, future, and contradictory manifests and rejects reads and mutations without writes", () => {
  const cases = [
    ["missing", (root) => fs.mkdirSync(path.join(root, ".dove")), /legacy Dove schema state/u],
    ["malformed", (root) => { fs.mkdirSync(path.join(root, ".dove")); fs.writeFileSync(path.join(root, ".dove", "manifest.json"), "{bad\n"); }, /invalid Dove workspace state malformed-manifest/u],
    ["legacy", (root) => writeJson(root, ".dove/manifest.json", { schemaVersion: 6 }), /legacy Dove schema state/u],
    ["legacy-authority", (root) => writeJson(root, ".dove/manifest.json", { version: 1, status: "authoritative" }), /legacy Dove schema state/u],
    ["future", (root) => writeJson(root, ".dove/manifest.json", { schemaVersion: 99 }), /future Dove schema 99/u],
    ["contradictory", (root) => initCurrent(root), /contradicts required layout/u]
  ];
  for (const [name, setup, pattern] of cases) {
    const root = createTempRoot(`dove-schema-${name}-`);
    setup(root);
    if (name === "contradictory") fs.rmSync(path.join(root, ".dove", "receipts", "authority"), { recursive: true });
    assertZeroWriteFailure(root, () => queryDoveStatus(root), pattern);
    assertZeroWriteFailure(root, () => queryDoveMission(root, { goal: "must reject" }), pattern);
    assertZeroWriteFailure(root, () => createDoveMission(root, { goal: "must reject" }), pattern);
  }
});

test("current schema rejects retained legacy markers and persisted ownership mirrors as a contradictory layout without writes", () => {
  for (const legacyPath of [
    ".dove/state.json",
    ".dove/task-packets",
    ".dove/orchestration",
    ".dove/runtime",
    ".dove/workspace",
    ".dove/mutations",
    ".dove/programs",
    ".dove/meta",
    ".dove/context",
    ".dove/wiki",
    ".dove/artifacts/ownership.json",
    ".dove/artifacts/lineage.json"
  ]) {
    const root = createTempRoot("dove-schema-current-legacy-contradiction-");
    initCurrent(root);
    if (legacyPath.endsWith(".json")) writeJson(root, legacyPath, { version: 7 });
    else fs.mkdirSync(path.join(root, legacyPath), { recursive: true });
    assertZeroWriteFailure(
      root,
      () => queryDoveStatus(root),
      /contradicts required layout.*retained legacy artifact/u
    );
  }
});

test("manifest classification does not deep-read trees for legacy, future, or malformed schemas", () => {
  const cases = [
    ["legacy", { schemaVersion: 6 }, "legacy"],
    ["future", { schemaVersion: 99 }, "future"],
    ["malformed", null, "invalid"]
  ];
  for (const [name, manifest, expectedCategory] of cases) {
    const root = createTempRoot(`dove-schema-shallow-${name}-`);
    fs.mkdirSync(path.join(root, ".dove"));
    if (manifest === null) fs.writeFileSync(path.join(root, ".dove", "manifest.json"), "{bad\n");
    else writeJson(root, ".dove/manifest.json", manifest);
    fs.symlinkSync("missing-target", path.join(root, ".dove", "unreadable-tree-entry"));
    const inspection = inspectDoveWorkspace(root);
    assert.equal(inspection.category, expectedCategory);
    assert.equal(Object.hasOwn(inspection.source, "treeDigest"), false);
  }
});

test("malformed current project, mission, and receipt JSON fail visibly without repair or backup", () => {
  const projectRoot = createTempRoot("dove-schema-bad-project-");
  initCurrent(projectRoot);
  fs.writeFileSync(path.join(projectRoot, ARTIFACT_PATHS.projectIdentity), "{bad\n");
  assertZeroWriteFailure(projectRoot, () => queryDoveStatus(projectRoot), /Malformed durable JSON in \.dove\/project\.json/u);
  assert.equal(fs.readdirSync(path.join(projectRoot, ".dove")).some((name) => /backup|repair/iu.test(name)), false);

  const missionRoot = createTempRoot("dove-schema-bad-mission-");
  initCurrent(missionRoot);
  fs.writeFileSync(path.join(missionRoot, ARTIFACT_PATHS.missionsDir, "broken.json"), "{bad\n");
  assertZeroWriteFailure(missionRoot, () => queryDoveStatus(missionRoot), /Malformed durable JSON in \.dove\/missions\/broken\.json/u);

  const receiptRoot = createTempRoot("dove-schema-bad-receipt-");
  initCurrent(receiptRoot);
  fs.writeFileSync(path.join(receiptRoot, ARTIFACT_PATHS.executionReceiptsDir, "broken.json"), "{bad\n");
  assertZeroWriteFailure(receiptRoot, () => queryDoveStatus(receiptRoot), /Malformed durable JSON|receipt-json-malformed/u);
});

test("normal init exact replay rejects cross-workspace data before inspecting destination state", () => {
  const source = createTempRoot("dove-schema-init-source-");
  const target = createTempRoot("dove-schema-init-target-");
  writeJson(target, ".dove/manifest.json", { schemaVersion: 99 });
  const proposal = initDoveGoal(source, { goal: "Initialize source only", mutationMode: "direct-process" });
  const before = snapshot(target);
  assert.throws(() => runWithMutationContext(target, { actionId: "init-dove-goal", mutationMode: "direct-process" }, () => initDoveGoal(target, proposal.confirmation.confirmArgs)), /different canonical workspace/u);
  assert.deepEqual(snapshot(target), before);
});

test("archive-reset proposal is zero-write and rejects patch-plan, drift, tamper, collision, and cross-workspace replay", () => {
  const root = createTempRoot("dove-schema-reset-");
  writeJson(root, ".dove/state.json", { version: 6, marker: "legacy" });
  const before = snapshot(root);
  const proposal = initDoveGoal(root, { goal: "Fresh schema", archiveReset: true, mutationMode: "direct-process" });
  assert.equal(proposal.kind, "archive-reset");
  assert.equal(proposal.operations[0].type, "atomic-directory-rename");
  const repeated = initDoveGoal(root, { goal: "Fresh schema", archiveReset: true, mutationMode: "direct-process" });
  assert.equal(repeated.archiveTarget, proposal.archiveTarget);
  assert.notEqual(repeated.confirmation.confirmArgs.workspaceId, proposal.confirmation.confirmArgs.workspaceId);
  assert.deepEqual(snapshot(root), before);
  assert.throws(() => initDoveGoal(root, { goal: "Fresh schema", archiveReset: true, mutationMode: "patch-plan" }), /cannot run in patch-plan mode/u);

  const tampered = structuredClone(proposal.confirmation.confirmArgs);
  tampered.proposalDigest = "0".repeat(64);
  assertZeroWriteFailure(root, () => runWithMutationContext(root, { actionId: "init-dove-goal", mutationMode: "direct-process" }, () => initDoveGoal(root, tampered)), /no longer matches/u);

  fs.writeFileSync(path.join(root, ".dove", "drift.txt"), "drift");
  assertZeroWriteFailure(root, () => runWithMutationContext(root, { actionId: "init-dove-goal", mutationMode: "direct-process" }, () => initDoveGoal(root, proposal.confirmation.confirmArgs)), /no longer matches|changed after proposal/u);

  const fresh = initDoveGoal(root, { goal: "Fresh schema", archiveReset: true, mutationMode: "direct-process" });
  const tamperedTarget = structuredClone(fresh.confirmation.confirmArgs);
  tamperedTarget.archiveTarget = path.join(root, "chosen-by-caller");
  assertZeroWriteFailure(root, () => runWithMutationContext(root, { actionId: "init-dove-goal", mutationMode: "direct-process" }, () => initDoveGoal(root, tamperedTarget)), /no longer matches/u);
  fs.mkdirSync(fresh.archiveTarget, { recursive: true });
  assertZeroWriteFailure(root, () => runWithMutationContext(root, { actionId: "init-dove-goal", mutationMode: "direct-process" }, () => initDoveGoal(root, fresh.confirmation.confirmArgs)), /Archive target is already occupied/u);

  const other = createTempRoot("dove-schema-reset-other-");
  writeJson(other, ".dove/state.json", { version: 6 });
  assertZeroWriteFailure(other, () => runWithMutationContext(other, { actionId: "init-dove-goal", mutationMode: "direct-process" }, () => initDoveGoal(other, fresh.confirmation.confirmArgs)), /different canonical workspace/u);
});

test("archive-reset refuses a symlinked archive parent without writes", () => {
  const root = createTempRoot("dove-schema-reset-archive-link-");
  const outside = createTempRoot("dove-schema-reset-archive-link-outside-");
  writeJson(root, ".dove/state.json", { version: 6 });
  fs.symlinkSync(outside, path.join(root, ".dove-archive"), "dir");
  assertZeroWriteFailure(root, () => initDoveGoal(root, { goal: "Reject archive symlink", archiveReset: true, mutationMode: "direct-process" }), /archive parent.*symbolic link/u);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test("archive-reset exact replay rejects source mode and same-content replacement drift", () => {
  const modeRoot = createTempRoot("dove-schema-reset-mode-drift-");
  writeJson(modeRoot, ".dove/state.json", { version: 6 });
  const modeProposal = initDoveGoal(modeRoot, { goal: "Reject mode drift", archiveReset: true, mutationMode: "direct-process" });
  fs.chmodSync(path.join(modeRoot, ".dove", "state.json"), 0o640);
  assertZeroWriteFailure(modeRoot, () => runWithMutationContext(modeRoot, { actionId: "init-dove-goal", mutationMode: "direct-process" }, () => initDoveGoal(modeRoot, modeProposal.confirmation.confirmArgs)), /no longer matches|changed after proposal/u);

  const replacementRoot = createTempRoot("dove-schema-reset-replacement-drift-");
  writeJson(replacementRoot, ".dove/state.json", { version: 6 });
  const replacementProposal = initDoveGoal(replacementRoot, { goal: "Reject replacement drift", archiveReset: true, mutationMode: "direct-process" });
  const statePath = path.join(replacementRoot, ".dove", "state.json");
  const sameContent = fs.readFileSync(statePath);
  fs.unlinkSync(statePath);
  fs.writeFileSync(statePath, sameContent);
  fs.chmodSync(statePath, 0o600);
  assertZeroWriteFailure(replacementRoot, () => runWithMutationContext(replacementRoot, { actionId: "init-dove-goal", mutationMode: "direct-process" }, () => initDoveGoal(replacementRoot, replacementProposal.confirmation.confirmArgs)), /no longer matches|changed after proposal/u);
});

test("direct archive-reset preserves the archived tree byte-for-byte and initializes a clean schema", () => {
  const root = createTempRoot("dove-schema-reset-success-");
  writeJson(root, ".dove/state.json", { version: 6, nested: { value: true } });
  fs.mkdirSync(path.join(root, ".dove", "nested"), { recursive: true });
  fs.writeFileSync(path.join(root, ".dove", "nested", "bytes.bin"), Buffer.from([0, 1, 2, 255]));
  fs.chmodSync(path.join(root, ".dove", "nested", "bytes.bin"), 0o640);
  fs.symlinkSync("nested/bytes.bin", path.join(root, ".dove", "bytes-link"));
  const before = snapshot(path.join(root, ".dove"));
  const proposal = initDoveGoal(root, { goal: "Clean schema", archiveReset: true, mutationMode: "direct-process" });
  const result = runWithMutationContext(root, { actionId: "init-dove-goal", mutationMode: "direct-process", hostId: "test" }, () => initDoveGoal(root, proposal.confirmation.confirmArgs));
  assert.equal(result.status, "archive-reset-complete");
  assert.deepEqual(snapshot(result.archiveTarget), before);
  assert.equal(fs.lstatSync(path.join(result.archiveTarget, "nested", "bytes.bin")).mode & 0o777, 0o640);
  assert.equal(fs.readlinkSync(path.join(result.archiveTarget, "bytes-link")), "nested/bytes.bin");
  assert.equal(inspectDoveWorkspace(root).healthy, true);
  assert.equal(fs.existsSync(path.join(root, ".dove", "state.json")), false);
});


test("normal init, archive reset, and first mission participate in commit rollback", () => {
  const initRoot = createTempRoot("dove-schema-init-transaction-failure-");
  const initBefore = snapshot(initRoot);
  const initProposal = initDoveGoal(initRoot, { goal: "Transactional init", mutationMode: "direct-process" });
  const failDovePromotion = {
    ...fs,
    renameSync(from, to) {
      if (to === path.join(initRoot, ".dove")) throw new Error("injected init promotion failure");
      return fs.renameSync(from, to);
    }
  };
  assert.throws(() => runWithMutationContext(initRoot, { actionId: "init-dove-goal", mutationMode: "direct-process", fsOps: failDovePromotion }, () => initDoveGoal(initRoot, initProposal.confirmation.confirmArgs)), /all staged changes were rolled back.*injected init promotion failure/u);
  assert.deepEqual(snapshot(initRoot), initBefore);

  const archiveRoot = createTempRoot("dove-schema-archive-transaction-failure-");
  writeJson(archiveRoot, ".dove/state.json", { version: 6, marker: "retain" });
  fs.mkdirSync(path.join(archiveRoot, ".dove/nested"));
  fs.writeFileSync(path.join(archiveRoot, ".dove/nested/bytes.bin"), Buffer.from([0, 1, 2, 255]));
  const archiveBefore = snapshot(archiveRoot);
  const archiveProposal = initDoveGoal(archiveRoot, { goal: "Transactional reset", archiveReset: true, mutationMode: "direct-process" });
  const failResetPromotion = {
    ...fs,
    renameSync(from, to) {
      if (to === path.join(archiveRoot, ".dove") && from.includes(".dove-transaction-")) throw new Error("injected reset promotion failure");
      return fs.renameSync(from, to);
    }
  };
  assert.throws(() => runWithMutationContext(archiveRoot, { actionId: "init-dove-goal", mutationMode: "direct-process", fsOps: failResetPromotion }, () => initDoveGoal(archiveRoot, archiveProposal.confirmation.confirmArgs)), /all staged changes were rolled back.*injected reset promotion failure/u);
  assert.deepEqual(snapshot(archiveRoot), archiveBefore);

  const missionRoot = createTempRoot("dove-schema-first-mission-transaction-failure-");
  const missionBefore = snapshot(missionRoot);
  const missionProposal = createDoveMission(missionRoot, {
    goal: "Transactional first mission",
    targetArtifacts: ["README.md"],
    expectedArtifacts: ["README.md"],
    mutationMode: "direct-process"
  });
  const failFirstMissionPromotion = {
    ...fs,
    renameSync(from, to) {
      if (to === path.join(missionRoot, ".dove")) throw new Error("injected first mission promotion failure");
      return fs.renameSync(from, to);
    }
  };
  assert.throws(() => runWithMutationContext(missionRoot, { actionId: "create-dove-mission", mutationMode: "direct-process", fsOps: failFirstMissionPromotion }, () => createDoveMission(missionRoot, missionProposal.confirmation.confirmArgs)), /all staged changes were rolled back.*injected first mission promotion failure/u);
  assert.deepEqual(snapshot(missionRoot), missionBefore);
});

test("first mission patch-plan reuses the schema 8 initializer and remains zero-write", () => {
  const root = createTempRoot("dove-schema-first-mission-patch-");
  const before = snapshot(root);
  const proposal = createDoveMission(root, {
    goal: "Plan the first mission without writes",
    scope: ["Define the mission contract"],
    targetArtifacts: ["README.md"],
    expectedArtifacts: ["README.md"],
    completionCriteria: ["The mission contract is durable"],
    evidenceRequirements: ["artifact:README.md"],
    mutationMode: "patch-plan"
  });
  const result = runWithMutationContext(root, {
    actionId: "create-dove-mission",
    mutationMode: "patch-plan",
    hostId: "test"
  }, () => createDoveMission(root, proposal.confirmation.confirmArgs));
  assert.equal(result.status, "materialization-planned");
  assert.equal(result.writesApplied, false);
  assert.deepEqual(snapshot(root), before);
  const paths = new Set(result.mutationPlan.operations.map((operation) => operation.relativePath));
  for (const requiredPath of [
    ".dove/manifest.json",
    ".dove/project.json",
    `.dove/missions/${proposal.mission.missionId}.json`
  ]) assert.equal(paths.has(requiredPath), true, requiredPath);
  assert.equal(paths.has(".dove/state.json"), false);
  assert.equal(paths.has(".dove/task-packets/index.json"), false);
  assert.equal(paths.has(".dove/artifacts/ownership.json"), false);
  assert.equal(paths.has(".dove/artifacts/lineage.json"), false);
});

test("first mission direct-process cleans a newly initialized workspace if the mission write fails", () => {
  const root = createTempRoot("dove-schema-first-mission-failure-");
  const before = snapshot(root);
  const proposal = createDoveMission(root, {
    goal: "Fail the first mission write cleanly",
    scope: ["Exercise mission rollback"],
    targetArtifacts: ["README.md"],
    expectedArtifacts: ["README.md"],
    completionCriteria: ["No partial first mission state remains"],
    evidenceRequirements: ["artifact:README.md"],
    mutationMode: "direct-process"
  });
  assert.throws(
    () => runWithMutationContext(root, {
      actionId: "create-dove-mission",
      mutationMode: "direct-process",
      hostId: "test"
    }, (context) => {
      const originalWriteJson = context.writeJson.bind(context);
      context.writeJson = (relativePath, value) => {
        if (relativePath.startsWith(".dove/missions/")) throw new Error("injected first mission write failure");
        return originalWriteJson(relativePath, value);
      };
      return createDoveMission(root, proposal.confirmation.confirmArgs);
    }),
    /injected first mission write failure/u
  );
  assert.deepEqual(snapshot(root), before);
});

test("mission graph validation rejects unknown dependencies, self edges, cycles, and supersession forks without writes", () => {
  const root = createTempRoot("dove-schema-mission-graph-");
  initCurrent(root);
  assertZeroWriteFailure(root, () => createDoveMission(root, { missionId: "unknown-dependency", goal: "Unknown dependency", dependsOnMissionIds: ["missing"] }), /depends on unknown mission/u);

  const firstProposal = createDoveMission(root, { missionId: "first", goal: "First" });
  runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, firstProposal.confirmation.confirmArgs));
  assertZeroWriteFailure(root, () => createDoveMission(root, { missionId: "self-edge", goal: "Self edge", dependsOnMissionIds: ["self-edge"] }), /must not depend on itself/u);
  const successorProposal = createDoveMission(root, { missionId: "second", goal: "Second", supersedesMissionId: "first" });
  runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, successorProposal.confirmation.confirmArgs));
  assertZeroWriteFailure(root, () => createDoveMission(root, { missionId: "fork", goal: "Fork", supersedesMissionId: "first" }), /supersession forks/u);

  assert.throws(() => validateMissionGraph([
    { filename: "first.json", mission: { missionId: "first", dependsOnMissionIds: ["second"] } },
    { filename: "second.json", mission: { missionId: "second", dependsOnMissionIds: ["first"] } }
  ]), /dependency graph contains a cycle/u);
});

test("strict opener recomputes mission contract digests and rejects canonical-content tampering", () => {
  const root = createTempRoot("dove-schema-mission-digest-tamper-");
  initCurrent(root);
  const proposal = createDoveMission(root, { missionId: "digest-bound", goal: "Bind this exact mission content." });
  runWithMutationContext(root, { actionId: "create-dove-mission", mutationMode: "direct-process", hostId: "test" }, () => createDoveMission(root, proposal.confirmation.confirmArgs));
  const missionPath = path.join(root, ".dove/missions/digest-bound.json");
  const mission = JSON.parse(fs.readFileSync(missionPath, "utf8"));
  mission.goal = "Hand-edited goal with the old digest.";
  fs.writeFileSync(missionPath, `${JSON.stringify(mission, null, 2)}\n`, "utf8");
  assertZeroWriteFailure(root, () => queryDoveStatus(root), /contractDigest does not match its canonical mission content/u);
});

test("current schema rejects unsealed completion and authority receipt directories", () => {
  for (const directory of ["completion", "authority"]) {
    const root = createTempRoot(`dove-schema-unsealed-${directory}-`);
    initCurrent(root);
    writeJson(root, `.dove/receipts/${directory}/unexpected.json`, { schemaVersion: 1 });
    assertZeroWriteFailure(root, () => queryDoveStatus(root), /must remain empty until its sealed schema is introduced/u);
  }
});

test("CLI archive-reset exact confirmation succeeds and doctor is read-only", () => {
  const root = createTempRoot("dove-schema-cli-");
  writeJson(root, ".dove/state.json", { version: 6 });
  const before = snapshot(root);
  const proposed = spawnSync(process.execPath, [CLI, "init", root, "--archive-reset", "--goal", "CLI reset", "--mutation-mode", "direct-process", "--json"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(proposed.status, 0, proposed.stderr || proposed.stdout);
  const payload = JSON.parse(proposed.stdout);
  assert.match(payload.confirmation.exactConfirmationCommand, /init/u);
  assert.deepEqual(snapshot(root), before);
  const confirmed = spawnSync("/bin/sh", ["-c", payload.confirmation.exactConfirmationCommand], { cwd: ROOT, encoding: "utf8" });
  assert.equal(confirmed.status, 0, confirmed.stderr || confirmed.stdout);
  const beforeDoctor = snapshot(root);
  const doctor = spawnSync(process.execPath, [CLI, "doctor", root], { cwd: ROOT, encoding: "utf8" });
  const doctorPayload = JSON.parse(doctor.stdout);
  assert.equal(doctorPayload.workspaceSchema.healthy, true);
  assert.deepEqual(snapshot(root), beforeDoctor);
});
