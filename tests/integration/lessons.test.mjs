import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { assessMissionCompletion } from "../../src/core/completion-gates.mjs";
import { ingestExecutionReceipt } from "../../src/core/execution-receipts.mjs";
import { queryDoveLessons, recordDoveLesson } from "../../src/core/lessons.mjs";
import { createDoveMission } from "../../src/core/mission-contracts.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { ARTIFACT_PATHS } from "../../src/core/schema.mjs";
import { inspectDoveWorkspace } from "../../src/core/workspace-schema.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function snapshot(root) {
  const files = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(fullPath);
      else files[path.relative(root, fullPath)] = entry.isSymbolicLink() ? `link:${fs.readlinkSync(fullPath)}` : fs.readFileSync(fullPath).toString("base64");
    }
  };
  visit(root);
  return files;
}

function write(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function sha256(root, relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relativePath))).digest("hex");
}

function mutate(root, actionId, callback, mutationMode = "direct-process") {
  return runWithMutationContext(root, { actionId, mutationMode, hostId: "test" }, callback);
}

function mission(root, missionId) {
  const proposal = createDoveMission(root, { missionId, goal: `Exercise ${missionId}.`, completionCriteria: [], evidenceRequirements: [] });
  return mutate(root, "create-dove-mission", () => createDoveMission(root, proposal.confirmation.confirmArgs)).mission;
}

function own(root, currentMission, relativePath, content = "artifact\n") {
  write(root, relativePath, content);
  return mutate(root, "ingest-execution-receipt", () => ingestExecutionReceipt(root, {
    receiptId: `seed-${currentMission.missionId}-${path.basename(relativePath).replace(/[^a-z0-9]+/giu, "-").toLowerCase()}`,
    missionId: currentMission.missionId,
    contractDigest: currentMission.contractDigest,
    summary: `Own ${relativePath}.`,
    artifacts: [{ path: relativePath, kind: "data", sha256: sha256(root, relativePath) }],
    validations: [],
    criteriaSatisfied: [],
    producedAt: new Date().toISOString()
  }));
}

function lessonArgs(currentMission, overrides = {}) {
  return {
    missionId: currentMission.missionId,
    lessonId: overrides.lessonId ?? "lesson-one",
    scope: overrides.scope ?? "global",
    kind: overrides.kind ?? "method",
    summary: overrides.summary ?? "Preserve exact evidence bindings when recording durable guidance.",
    nextTimeGuidance: overrides.nextTimeGuidance ?? ["Revalidate all referenced artifacts immediately before confirmation."],
    sourceIds: overrides.sourceIds ?? [],
    noteIds: overrides.noteIds ?? [],
    artifactRefs: overrides.artifactRefs ?? [],
    appliesToArtifactRefs: overrides.appliesToArtifactRefs ?? [],
    tags: overrides.tags ?? ["integrity"],
    ...(overrides.details === undefined ? {} : { details: overrides.details }),
    ...(overrides.supersedesLessonId === undefined ? {} : { supersedesLessonId: overrides.supersedesLessonId })
  };
}

function record(root, args, mutationMode = "direct-process") {
  const proposal = recordDoveLesson(root, { ...args, mutationMode });
  return {
    proposal,
    result: mutate(root, "record-dove-lesson", () => recordDoveLesson(root, proposal.confirmation.confirmArgs), mutationMode)
  };
}

test("lesson query and proposal are zero-write, and missing optional lessons directory is healthy", () => {
  const root = createTempRoot("dove-lessons-zero-write-");
  const currentMission = mission(root, "lesson-zero-write");
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.lessonsDir)), false);
  assert.equal(inspectDoveWorkspace(root).healthy, true);

  const before = snapshot(root);
  const query = queryDoveLessons(root, {});
  assert.equal(query.status, "empty");
  assert.deepEqual(snapshot(root), before);

  const proposal = recordDoveLesson(root, lessonArgs(currentMission));
  assert.equal(proposal.status, "needs-confirmation");
  assert.equal(proposal.advisoryOnly, true);
  assert.equal(proposal.authority, false);
  assert.equal(Object.hasOwn(proposal.confirmation.confirmArgs, "confirm"), false);
  assert.deepEqual(snapshot(root), before);
});

test("exact lesson replay writes an immutable lesson and derived receipt-ledger lineage", () => {
  const root = createTempRoot("dove-lessons-record-");
  const currentMission = mission(root, "lesson-record");
  own(root, currentMission, "outputs/method.json");
  const { result } = record(root, lessonArgs(currentMission, {
    artifactRefs: ["outputs/method.json"],
    appliesToArtifactRefs: ["outputs/method.json"]
  }));

  assert.equal(result.advisoryOnly, true);
  assert.equal(result.authority, false);
  assert.equal(result.completionEligible, false);
  assert.deepEqual(result.receipt.criteriaSatisfied, []);
  assert.equal(result.lesson.workspaceId, JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.doveRootManifest), "utf8")).workspaceId);
  assert.equal(result.lesson.contractDigest, currentMission.contractDigest);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.lessonsDir, "lesson-one.json")), true);
  assert.equal(fs.readdirSync(path.join(root, ARTIFACT_PATHS.completionReceiptsDir)).length, 0);
  assert.equal(fs.readdirSync(path.join(root, ARTIFACT_PATHS.authorityReceiptsDir)).length, 0);

  const query = queryDoveLessons(root, { missionId: currentMission.missionId, artifactRefs: ["outputs/method.json"] });
  assert.equal(query.lessonCount, 1);
  assert.deepEqual(query.items[0].assessment.matchedArtifactRefs, ["outputs/method.json"]);
  assert.equal(query.items[0].assessment.current, true);

  const beforeCollision = snapshot(root);
  assert.throws(() => recordDoveLesson(root, lessonArgs(currentMission)), /already occupied/u);
  assert.deepEqual(snapshot(root), beforeCollision);
});

test("confirmed replay rejects content, contract, mutation mode, artifact, and supersession drift without writes", () => {
  const cases = [
    ["content", (root, mission, proposal) => ({ ...proposal.confirmation.confirmArgs, summary: "Changed summary." }), /no longer matches/u],
    ["contract", (root, mission, proposal) => ({ ...proposal.confirmation.confirmArgs, contractDigest: "0".repeat(64) }), /contract digest|no longer matches/u],
    ["mode", (root, mission, proposal) => ({ ...proposal.confirmation.confirmArgs, mutationMode: "patch-plan" }), /mutationMode|no longer matches/u],
    ["artifact", (root, mission, proposal) => { write(root, "outputs/evidence.txt", "drifted\n"); return proposal.confirmation.confirmArgs; }, /changed since its latest ownership receipt/u],
    ["supersession", (root, mission, proposal) => { record(root, lessonArgs(mission, { lessonId: "other-successor", supersedesLessonId: "base-lesson" })); return proposal.confirmation.confirmArgs; }, /already has successor/u]
  ];
  for (const [name, change, pattern] of cases) {
    const root = createTempRoot(`dove-lessons-replay-${name}-`);
    const currentMission = mission(root, `lesson-replay-${name}`);
    own(root, currentMission, "outputs/evidence.txt", "current\n");
    if (name === "supersession") record(root, lessonArgs(currentMission, { lessonId: "base-lesson" }));
    const args = lessonArgs(currentMission, {
      lessonId: name === "supersession" ? "planned-successor" : "planned-lesson",
      artifactRefs: ["outputs/evidence.txt"],
      ...(name === "supersession" ? { supersedesLessonId: "base-lesson" } : {})
    });
    const proposal = recordDoveLesson(root, args);
    const replay = change(root, currentMission, proposal);
    const before = snapshot(root);
    assert.throws(() => mutate(root, "record-dove-lesson", () => recordDoveLesson(root, replay), replay.mutationMode ?? "direct-process"), pattern);
    assert.deepEqual(snapshot(root), before);
  }
});

test("confirmed lesson recording supports patch-plan without writing", () => {
  const root = createTempRoot("dove-lessons-patch-plan-");
  const currentMission = mission(root, "lesson-patch-plan");
  const before = snapshot(root);
  const proposal = recordDoveLesson(root, { ...lessonArgs(currentMission), mutationMode: "patch-plan" });
  const result = mutate(root, "record-dove-lesson", () => recordDoveLesson(root, proposal.confirmation.confirmArgs), "patch-plan");
  assert.equal(result.status, "planned");
  assert.equal(result.writesApplied, false);
  assert.deepEqual(snapshot(root), before);
  assert.deepEqual(result.mutationPlan.operations.map((item) => item.relativePath), [
    `${ARTIFACT_PATHS.lessonsDir}/lesson-one.json`,
    result.mutation.paths[1]
  ]);
});

test("lesson schema accepts exactly five kinds", () => {
  const root = createTempRoot("dove-lessons-five-kinds-");
  const currentMission = mission(root, "lesson-five-kinds");
  const kinds = ["preference", "constraint", "method", "failure", "review-insight"];
  for (const kind of kinds) {
    record(root, lessonArgs(currentMission, { lessonId: `kind-${kind}`, kind }));
  }
  assert.deepEqual(queryDoveLessons(root, { missionId: currentMission.missionId }).items.map((item) => item.kind).sort(), kinds.sort());
});

test("sealed lesson schema rejects caller timestamps, confirm alias, runtime fields, and invalid kinds", () => {
  const forbidden = [
    ["createdAt", "2026-07-15T00:00:00.000Z"],
    ["confirm", true],
    ["runtime", {}],
    ["status", "active"],
    ["transcript", "raw conversation"]
  ];
  for (const [field, value] of forbidden) {
    const root = createTempRoot(`dove-lessons-sealed-${field}-`);
    const currentMission = mission(root, `lesson-sealed-${field.replace(/[^a-z0-9]+/gu, "-").toLowerCase()}`);
    const before = snapshot(root);
    assert.throws(() => recordDoveLesson(root, { ...lessonArgs(currentMission), [field]: value }), /does not accept unknown input|does not accept caller replay fields/u);
    assert.deepEqual(snapshot(root), before);
  }
  const root = createTempRoot("dove-lessons-kind-");
  const currentMission = mission(root, "lesson-kind");
  assert.throws(() => recordDoveLesson(root, lessonArgs(currentMission, { kind: "operator-state" })), /kind must be one of/u);
});

test("supersession supports later global missions, constrains mission scope, hides history, and detects forks", () => {
  const root = createTempRoot("dove-lessons-supersession-");
  const first = mission(root, "lesson-origin");
  record(root, lessonArgs(first, { lessonId: "global-old", scope: "global", kind: "constraint" }));
  record(root, lessonArgs(first, { lessonId: "mission-old", scope: "mission", kind: "method" }));
  const second = mission(root, "lesson-later");
  record(root, lessonArgs(second, { lessonId: "global-new", scope: "global", kind: "constraint", supersedesLessonId: "global-old" }));

  assert.deepEqual(queryDoveLessons(root, {}).items.map((item) => item.lessonId), ["global-new"]);
  assert.deepEqual(queryDoveLessons(root, { includeSuperseded: true }).items.map((item) => item.lessonId).sort(), ["global-new", "global-old"]);
  const firstMissionQuery = queryDoveLessons(root, { missionId: first.missionId });
  assert.deepEqual(firstMissionQuery.items.map((item) => item.lessonId).sort(), ["global-new", "mission-old"]);
  const globallyApplicable = firstMissionQuery.items.find((item) => item.lessonId === "global-new");
  assert.equal(globallyApplicable.scope, "global");
  assert.equal(globallyApplicable.missionId, second.missionId, "global applicability must retain recording-mission provenance");

  assert.throws(() => recordDoveLesson(root, lessonArgs(second, { lessonId: "bad-mission-successor", scope: "mission", kind: "method", supersedesLessonId: "mission-old" })), /same mission/u);
  assert.throws(() => recordDoveLesson(root, lessonArgs(second, { lessonId: "fork", scope: "global", kind: "constraint", supersedesLessonId: "global-old" })), /already has successor/u);
});

test("artifact-scoped query is minimal, stable, optional-unscoped, and reports drift without writes", () => {
  const root = createTempRoot("dove-lessons-query-");
  const currentMission = mission(root, "lesson-query");
  own(root, currentMission, "outputs/a.txt", "a\n");
  own(root, currentMission, "outputs/b.txt", "b\n");
  record(root, lessonArgs(currentMission, { lessonId: "unscoped", scope: "mission" }));
  record(root, lessonArgs(currentMission, { lessonId: "a-only", scope: "mission", appliesToArtifactRefs: ["outputs/a.txt"] }));
  record(root, lessonArgs(currentMission, { lessonId: "a-b", scope: "global", appliesToArtifactRefs: ["outputs/a.txt", "outputs/b.txt"] }));

  assert.throws(() => queryDoveLessons(root, { artifactRefs: ["outputs/a.txt"] }), /require missionId/u);
  const exact = queryDoveLessons(root, { missionId: currentMission.missionId, artifactRefs: ["outputs/a.txt", "outputs/b.txt"] });
  assert.deepEqual(exact.items.map((item) => item.lessonId), ["a-b", "a-only"]);
  const withUnscoped = queryDoveLessons(root, { missionId: currentMission.missionId, artifactRefs: ["outputs/a.txt"], includeUnscoped: true, limit: 2 });
  assert.deepEqual(withUnscoped.items.map((item) => item.lessonId), ["a-only", "a-b"]);

  write(root, "outputs/b.txt", "drifted\n");
  const before = snapshot(root);
  const drifted = queryDoveLessons(root, { missionId: currentMission.missionId, lessonId: "a-b" });
  assert.equal(drifted.items[0].assessment.current, false);
  assert.deepEqual(snapshot(root), before);
});

test("lessons cannot be mission artifacts, external receipt evidence, or completion artifacts", () => {
  const root = createTempRoot("dove-lessons-advisory-boundary-");
  const currentMission = mission(root, "lesson-boundary");
  record(root, lessonArgs(currentMission));
  const lessonRelativePath = `${ARTIFACT_PATHS.lessonsDir}/lesson-one.json`;

  const beforeMission = snapshot(root);
  assert.throws(() => createDoveMission(root, {
    missionId: "lesson-as-target",
    goal: "Do not accept a lesson as output.",
    targetArtifacts: [lessonRelativePath]
  }), /advisory-only Dove lessons/u);
  assert.deepEqual(snapshot(root), beforeMission);

  const beforeReceipt = snapshot(root);
  assert.throws(() => mutate(root, "ingest-execution-receipt", () => ingestExecutionReceipt(root, {
    receiptId: "lesson-external-receipt",
    missionId: currentMission.missionId,
    contractDigest: currentMission.contractDigest,
    summary: "Try to use a lesson as output.",
    artifacts: [{ path: lessonRelativePath, kind: "data", sha256: sha256(root, lessonRelativePath) }],
    validations: [],
    criteriaSatisfied: [],
    producedAt: new Date().toISOString()
  })), /must not use a Dove lesson/u);
  assert.deepEqual(snapshot(root), beforeReceipt);

  const assessment = assessMissionCompletion(root, { missionId: currentMission.missionId });
  assert.equal(assessment.complete, false);
  assert.ok(assessment.receipts.every((receipt) => receipt.current === false));
});

test("optional lesson directory is strictly validated when present", () => {
  const root = createTempRoot("dove-lessons-schema-");
  mission(root, "lesson-schema");
  fs.mkdirSync(path.join(root, ARTIFACT_PATHS.lessonsDir));
  write(root, `${ARTIFACT_PATHS.lessonsDir}/unexpected.txt`, "bad\n");
  const inspection = inspectDoveWorkspace(root);
  assert.equal(inspection.healthy, false);
  assert.match(inspection.error, /regular JSON file/u);
});
