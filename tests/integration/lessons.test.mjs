import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { assessMissionCompletion } from "../../src/core/completion-gates.mjs";
import { ingestExecutionReceipt } from "../../src/core/execution-receipts.mjs";
import { readDoveLessons, updateDoveLessons } from "../../src/core/lessons.mjs";
import { createDoveMission } from "../../src/core/mission-contracts.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { ARTIFACT_PATHS } from "../../src/core/schema.mjs";
import { DEFAULT_DOVE_LESSONS_MARKDOWN, DOVE_LESSONS_SECTIONS, inspectDoveWorkspace } from "../../src/core/workspace-schema.mjs";
import { initializeWorkspace, materializeRootMission } from "../helpers/current-schema-workspace.mjs";
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

function mutate(root, callback, mutationMode = "direct-process") {
  return runWithMutationContext(root, { actionId: "update-dove-lessons", mutationMode, hostId: "test" }, callback);
}

function revisedMarkdown(note = "失败案例必须保留，并与成功结果一起复核。") {
  return DEFAULT_DOVE_LESSONS_MARKDOWN.replace("## 工程与可复现性\n\n- 暂无。", `## 工程与可复现性\n\n- ${note}`);
}

function countJsonFiles(root, relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  return fs.existsSync(directory) ? fs.readdirSync(directory).filter((name) => name.endsWith(".json")).length : 0;
}

test("Schema 18 initialization creates one canonical Chinese Lessons document", () => {
  const root = createTempRoot("dove-lessons-init-");
  initializeWorkspace(root);
  const lessonsPath = path.join(root, ARTIFACT_PATHS.lessonsDocument);
  assert.equal(fs.readFileSync(lessonsPath, "utf8"), DEFAULT_DOVE_LESSONS_MARKDOWN);
  assert.equal(inspectDoveWorkspace(root).healthy, true);
  for (const section of DOVE_LESSONS_SECTIONS) assert.match(DEFAULT_DOVE_LESSONS_MARKDOWN, new RegExp(`^## ${section.heading}$`, "mu"));
  assert.equal(fs.existsSync(path.join(root, ".dove/lessons")), false);
});

test("Lessons read is zero-write and returns complete Markdown with a stable opaque binding", () => {
  const root = createTempRoot("dove-lessons-read-");
  initializeWorkspace(root);
  const before = snapshot(root);
  const first = readDoveLessons(root, {});
  const second = readDoveLessons(root, {});
  assert.equal(first.status, "ok");
  assert.equal(first.markdown, DEFAULT_DOVE_LESSONS_MARKDOWN);
  assert.equal(first.zeroWrite, true);
  assert.equal(first.advisoryOnly, true);
  assert.equal(first.authority, false);
  assert.equal(first.completionEligible, false);
  assert.match(first.currentHash, /^[0-9a-f]{64}$/u);
  assert.equal(first.lessonsBinding, second.lessonsBinding);
  assert.equal(first.currentHash, second.currentHash);
  assert.deepEqual(snapshot(root), before);
  assert.throws(() => readDoveLessons(root, { limit: 1 }), /does not accept unknown input/u);
});

test("Lessons update atomically replaces the complete document without creating Mission or Receipt state", () => {
  const root = createTempRoot("dove-lessons-update-");
  initializeWorkspace(root);
  const missionsBefore = countJsonFiles(root, ARTIFACT_PATHS.missionsDir);
  const receiptsBefore = countJsonFiles(root, ARTIFACT_PATHS.executionReceiptsDir);
  const read = readDoveLessons(root, {});
  const markdown = revisedMarkdown();
  const result = mutate(root, () => updateDoveLessons(root, { binding: read.lessonsBinding, markdown }));
  assert.equal(result.status, "updated");
  assert.equal(result.markdown, markdown);
  assert.equal(result.advisoryOnly, true);
  assert.equal(result.authority, false);
  assert.equal(result.completionEligible, false);
  assert.deepEqual(result.writes, [ARTIFACT_PATHS.lessonsDocument]);
  assert.equal(fs.readFileSync(path.join(root, ARTIFACT_PATHS.lessonsDocument), "utf8"), markdown);
  assert.equal(countJsonFiles(root, ARTIFACT_PATHS.missionsDir), missionsBefore);
  assert.equal(countJsonFiles(root, ARTIFACT_PATHS.executionReceiptsDir), receiptsBefore);
});

test("Lessons update rejects stale, cross-workspace, malformed, and incomplete input without writes", () => {
  const root = createTempRoot("dove-lessons-reject-");
  const other = createTempRoot("dove-lessons-other-");
  initializeWorkspace(root);
  initializeWorkspace(other);
  const initial = readDoveLessons(root, {});
  const otherRead = readDoveLessons(other, {});
  mutate(root, () => updateDoveLessons(root, { binding: initial.lessonsBinding, markdown: revisedMarkdown("先验证失败路径。") }));

  const invalidCases = [
    ["stale", { binding: initial.lessonsBinding, markdown: revisedMarkdown("过期更新。") }, /changed after it was read/u],
    ["workspace", { binding: otherRead.lessonsBinding, markdown: revisedMarkdown("跨工作区更新。") }, /changed after it was read/u],
    ["binding", { binding: "not-a-binding", markdown: revisedMarkdown() }, /binding is invalid/u],
    ["missing", { binding: readDoveLessons(root, {}).lessonsBinding, markdown: DEFAULT_DOVE_LESSONS_MARKDOWN.replace(/## 协作与工作实践[\s\S]*$/u, "") }, /five stable sections/u],
    ["duplicate", { binding: readDoveLessons(root, {}).lessonsBinding, markdown: `${DEFAULT_DOVE_LESSONS_MARKDOWN}## 研究方向与方法\n\n- 重复。\n` }, /five stable sections/u],
    ["reordered", { binding: readDoveLessons(root, {}).lessonsBinding, markdown: DEFAULT_DOVE_LESSONS_MARKDOWN.replace("## 研究方向与方法", "## TEMP").replace("## 证据与实验", "## 研究方向与方法").replace("## TEMP", "## 证据与实验") }, /five stable sections/u],
    ["newline", { binding: readDoveLessons(root, {}).lessonsBinding, markdown: DEFAULT_DOVE_LESSONS_MARKDOWN.trimEnd() }, /end with a newline/u]
  ];
  for (const [name, args, pattern] of invalidCases) {
    const before = snapshot(root);
    assert.throws(() => mutate(root, () => updateDoveLessons(root, args)), pattern, name);
    assert.deepEqual(snapshot(root), before, name);
  }
});

test("Lessons update supports patch-plan without touching the workspace", () => {
  const root = createTempRoot("dove-lessons-patch-plan-");
  initializeWorkspace(root);
  const read = readDoveLessons(root, {});
  const before = snapshot(root);
  const result = mutate(root, () => updateDoveLessons(root, { binding: read.lessonsBinding, markdown: revisedMarkdown() }), "patch-plan");
  assert.equal(result.status, "planned");
  assert.equal(result.mutation.writesApplied, false);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(snapshot(root), before);
});

test("the canonical Lessons document cannot be Mission artifact, receipt evidence, or completion proof", () => {
  const root = createTempRoot("dove-lessons-boundary-");
  const mission = materializeRootMission(root, { missionId: "lessons-boundary", mode: "ordinary", mission: { completionCriteria: ["Produce a substantive result."], evidenceRequirements: [] } });
  const lessonsPath = ARTIFACT_PATHS.lessonsDocument;

  assert.throws(() => createDoveMission(root, {
    operation: "create-root",
    missionId: "lessons-target",
    mode: "ordinary",
    goal: "Do not accept Lessons as output.",
    artifacts: [{ path: lessonsPath, required: true, role: "output" }]
  }), /advisory-only Lessons document/u);

  const hash = readDoveLessons(root, {}).currentHash;
  assert.throws(() => runWithMutationContext(root, { actionId: "ingest-execution-receipt", mutationMode: "direct-process", hostId: "test" }, () => ingestExecutionReceipt(root, {
    receiptId: "lessons-as-evidence",
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    summary: "Try to use Lessons as evidence.",
    artifacts: [{ path: lessonsPath, kind: "document", sha256: hash }],
    validations: [],
    criteriaSatisfied: [],
    producedAt: new Date().toISOString()
  })), /must not use a Dove lesson/u);

  const assessment = assessMissionCompletion(root, { missionId: mission.missionId });
  assert.equal(assessment.complete, false);
  assert.equal(assessment.completionEligible, undefined);
});
