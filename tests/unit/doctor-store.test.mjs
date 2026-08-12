import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { readDoctorDocument, readDoctorState, reconcileDoctorIssues, recordDoctorIssue, recordDoctorIssueBestEffort, resolveDoctorIssues, setDoctorEnabled } from "../../src/core/doctor-store.mjs";
import { ARTIFACT_PATHS } from "../../src/core/schema.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function installedRoot() {
  const root = createTempRoot("dove-doctor-store-");
  fs.mkdirSync(path.join(root, ARTIFACT_PATHS.installDir), { recursive: true });
  return root;
}

const ISSUE = {
  issueId: "research-state-invalid",
  category: "research-state",
  severity: "error",
  summary: "Dove 研究记录无法安全读取",
  action: "dove doctor",
  detectedBy: "doctor"
};

function bytes(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath));
}

test("Doctor creates one readable document without exposing machine bookkeeping", () => {
  const root = installedRoot();
  recordDoctorIssue(root, ISSUE, { now: "2026-08-11T00:00:00.000Z" });
  const state = readDoctorState(root);
  const document = readDoctorDocument(root);
  assert.equal(state.issues.length, 1);
  assert.equal(document.exists, true);
  assert.match(document.markdown, /# Dove 问题/u);
  assert.match(document.markdown, /Dove 研究记录无法安全读取/u);
  assert.match(document.markdown, /建议：`dove doctor`/u);
  assert.doesNotMatch(document.markdown, /research-state-invalid|occurrences|issueId|sha256|---/iu);
});

test("repeated identical detection is a semantic no-op", () => {
  const root = installedRoot();
  recordDoctorIssue(root, ISSUE, { now: "2026-08-11T00:00:00.000Z" });
  const beforeJson = bytes(root, ARTIFACT_PATHS.doctor);
  const beforeMarkdown = bytes(root, ARTIFACT_PATHS.doctorDocument);
  recordDoctorIssue(root, ISSUE, { now: "2026-08-11T00:01:00.000Z" });
  assert.deepEqual(bytes(root, ARTIFACT_PATHS.doctor), beforeJson);
  assert.deepEqual(bytes(root, ARTIFACT_PATHS.doctorDocument), beforeMarkdown);
  assert.equal(readDoctorState(root).issues[0].occurrences, 1);
});

test("Doctor resolves only the inspected surface and records a bounded readable resolution", () => {
  const root = installedRoot();
  recordDoctorIssue(root, ISSUE, { now: "2026-08-11T00:00:00.000Z" });
  recordDoctorIssue(root, { ...ISSUE, issueId: "project-needs-sync", category: "project-integration", severity: "warning", summary: "当前项目集成需要更新", action: "dove sync", detectedBy: "home" }, { now: "2026-08-11T00:01:00.000Z" });

  const reconciled = reconcileDoctorIssues(root, [], { detectedBy: "home", now: "2026-08-11T00:02:00.000Z" });
  assert.equal(reconciled.issues.find((issue) => issue.issueId === "project-needs-sync").state, "resolved");
  assert.equal(reconciled.issues.find((issue) => issue.issueId === "research-state-invalid").state, "open");
  const markdown = readDoctorDocument(root).markdown;
  assert.match(markdown, /Dove 研究记录无法安全读取/u);
  assert.match(markdown, /2026-08-11：已解决“当前项目集成需要更新”/u);
});

test("automatic maintenance obeys the switch while manual Doctor remains available", () => {
  const root = installedRoot();
  setDoctorEnabled(root, false, { now: "2026-08-11T00:00:00.000Z" });
  const beforeJson = bytes(root, ARTIFACT_PATHS.doctor);
  const beforeMarkdown = bytes(root, ARTIFACT_PATHS.doctorDocument);
  recordDoctorIssue(root, ISSUE, { now: "2026-08-11T00:01:00.000Z" });
  assert.deepEqual(bytes(root, ARTIFACT_PATHS.doctor), beforeJson);
  assert.deepEqual(bytes(root, ARTIFACT_PATHS.doctorDocument), beforeMarkdown);
  recordDoctorIssue(root, ISSUE, { manual: true, now: "2026-08-11T00:02:00.000Z" });
  assert.equal(readDoctorState(root).issues.length, 1);
  assert.match(readDoctorDocument(root).markdown, /自动维护当前已关闭/u);
});

test("Doctor document rejects outside edits and best-effort failures stay contained", () => {
  const root = installedRoot();
  recordDoctorIssue(root, ISSUE, { now: "2026-08-11T00:00:00.000Z" });
  fs.appendFileSync(path.join(root, ARTIFACT_PATHS.doctorDocument), "user edit\n");
  assert.throws(() => resolveDoctorIssues(root, [], { now: "2026-08-11T00:01:00.000Z" }), /changed outside Dove/iu);
  assert.equal(recordDoctorIssueBestEffort(root, { ...ISSUE, issueId: "second" }), false);

  const missing = createTempRoot("dove-doctor-store-missing-");
  assert.equal(recordDoctorIssueBestEffort(missing, ISSUE), false);
});

test("Doctor escapes multiline issue text in Markdown", () => {
  const root = installedRoot();
  recordDoctorIssue(root, { ...ISSUE, summary: "问题\n## 注入", action: "dove doctor\n`bad`" }, { now: "2026-08-11T00:00:00.000Z" });
  const markdown = readDoctorDocument(root).markdown;
  assert.doesNotMatch(markdown, /^## 注入$/mu);
  assert.match(markdown, /问题 ## 注入/u);
  assert.match(markdown, /dove doctor 'bad'/u);
});
