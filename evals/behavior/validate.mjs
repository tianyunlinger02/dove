#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BEHAVIOR_CASE_SCHEMA_VERSION,
  SUPPORTED_HARD_EXPECTATION_KINDS,
  assertReceiptRecordShape,
  assertToolActionsShape,
  behaviorEvalShapeExamples,
  createFixtureCliLauncher,
  createSnapshotRecord,
  evaluateHardExpectation,
  executionResult,
  invokeClaude,
  isSafeProjectRelativePathSpec,
  materializedSnapshotInclude,
  parseArgs,
  parseEvidence
} from "./eval.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CASES_ROOT = path.join(ROOT, "evals", "behavior", "cases");
const FIXTURES_ROOT = path.join(ROOT, "evals", "behavior", "fixtures");
const CASE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ALLOWED_SURFACE_ENTRIES = new Set(["slash-command", "ambient-prompt"]);
const ALLOWED_SURFACE_COMMANDS = new Set(["/dove:research", "/dove:status", "/dove:source", "/dove:experiment", "/dove:draft", "/dove:figure", "/dove:review", "/dove:rebuttal", "/dove:lessons"]);
const REQUIRED_EVIDENCE_FILES = new Set([
  "receipt.json", "public-output.md", "stream.jsonl", "stderr.log", "tool-actions.json",
  "snapshot-before.json", "snapshot-after.json", "snapshot-diff.json", "hard-checks.json"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertString(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.equal(value.trim(), value, `${label} must be trimmed`);
  assert.notEqual(value, "", `${label} must be non-empty`);
  assert.equal(value.includes("\0"), false, `${label} must not contain NUL`);
}

function assertStringArray(value, label, minLength = 0) {
  assert.equal(Array.isArray(value), true, `${label} must be an array`);
  assert.ok(value.length >= minLength, `${label} must have at least ${minLength} item(s)`);
  value.forEach((item, index) => assertString(item, `${label}[${index}]`));
}

function assertPathSpec(value, label) {
  assertString(value, label);
  assert.equal(isSafeProjectRelativePathSpec(value), true, `${label} must remain inside the fixture: ${value}`);
}

function fixtureRoot(testCase) {
  assertString(testCase.fixture, "fixture");
  assert.match(testCase.fixture, CASE_ID_PATTERN, "fixture must be a safe id");
  const root = path.join(FIXTURES_ROOT, testCase.fixture);
  const relative = path.relative(fs.realpathSync.native(FIXTURES_ROOT), fs.realpathSync.native(root));
  assert.equal(relative.startsWith("..") || path.isAbsolute(relative), false, "fixture must stay inside the fixture root");
  assert.equal(fs.lstatSync(root).isDirectory(), true, `fixture must be a directory: ${testCase.fixture}`);
  for (const entry of [".git", ".claude", "node_modules"]) assert.equal(fs.existsSync(path.join(root, entry)), false, `fixture must not contain ${entry}`);
  return root;
}

function assertSource(source) {
  assert.equal(isObject(source), true, "source must be an object");
  assertStringArray(source.quotes, "source.quotes", 1);
  if (source.kind === "user-feedback-excerpt") {
    assert.equal(source.document, "current-user-request");
    assertString(source.context, "source.context");
    return;
  }
  assert.equal(source.kind, undefined);
  assert.equal(source.document, ".dove/install/DOCTOR.md");
  assert.ok(Number.isInteger(source.lineStart) && source.lineStart >= 1);
  assert.ok(Number.isInteger(source.lineEnd) && source.lineEnd >= source.lineStart);
}

function fixturePathExists(root, spec) {
  return fs.existsSync(path.join(root, spec.replace(/\/\*\*$/u, "")));
}

function assertCase(testCase, file) {
  assert.equal(isObject(testCase), true, `${file} must be an object`);
  assert.equal(testCase.schemaVersion, BEHAVIOR_CASE_SCHEMA_VERSION);
  assertString(testCase.id, `${file}.id`);
  assert.match(testCase.id, CASE_ID_PATTERN);
  assert.equal(file, `${testCase.id}.json`);
  assertString(testCase.title, `${file}.title`);
  assertString(testCase.failureMode, `${file}.failureMode`);
  assertSource(testCase.source);
  const root = fixtureRoot(testCase);

  assert.equal(isObject(testCase.surface), true);
  assert.equal(testCase.surface.host, "claude-code");
  assert.equal(ALLOWED_SURFACE_ENTRIES.has(testCase.surface.entry), true);
  if (testCase.surface.entry === "slash-command") assert.equal(ALLOWED_SURFACE_COMMANDS.has(testCase.surface.command), true);
  else assert.equal(Object.hasOwn(testCase.surface, "command"), false);
  assertString(testCase.surface.prompt, "surface.prompt");

  assert.equal(isObject(testCase.budgets), true);
  assert.ok(Number.isInteger(testCase.budgets.timeoutMs) && testCase.budgets.timeoutMs >= 30_000 && testCase.budgets.timeoutMs <= 900_000);
  assert.ok(Number.isFinite(testCase.budgets.maxBudgetUsd) && testCase.budgets.maxBudgetUsd > 0 && testCase.budgets.maxBudgetUsd <= 5);

  assert.equal(isObject(testCase.snapshot), true);
  assertStringArray(testCase.snapshot.include, "snapshot.include");
  testCase.snapshot.include.forEach((spec) => assertPathSpec(spec, "snapshot.include path"));

  assert.equal(isObject(testCase.expectedBehavior), true);
  assertStringArray(testCase.expectedBehavior.mustInspectOrChange, "expectedBehavior.mustInspectOrChange");
  for (const spec of testCase.expectedBehavior.mustInspectOrChange) {
    assertPathSpec(spec, "expectedBehavior path");
    assert.equal(fixturePathExists(root, spec), true, `expected material must exist: ${spec}`);
  }

  assert.equal(Array.isArray(testCase.hardExpectations), true);
  const expectationIds = new Set();
  for (const expectation of testCase.hardExpectations) {
    assertString(expectation.id, "hard expectation id");
    assert.equal(expectationIds.has(expectation.id), false, `duplicate hard expectation: ${expectation.id}`);
    expectationIds.add(expectation.id);
    assert.equal(SUPPORTED_HARD_EXPECTATION_KINDS.includes(expectation.kind), true, `unsupported hard expectation: ${expectation.kind}`);
    if (expectation.path !== undefined) {
      assertPathSpec(expectation.path, "hard expectation path");
      if (["path-changed", "path-unchanged"].includes(expectation.kind)) assert.equal(fixturePathExists(root, expectation.path), true);
    }
  }

  assert.equal(Array.isArray(testCase.humanReviewRubric), true);
  assert.ok(testCase.humanReviewRubric.length > 0);
  for (const item of testCase.humanReviewRubric) {
    assertString(item.criterion, "rubric criterion");
    assertStringArray(item.evidence, "rubric evidence", 1);
    assertStringArray(item.failureSignals, "rubric failure signals", 1);
    assert.equal(item.evidence.some((entry) => REQUIRED_EVIDENCE_FILES.has(entry)), true);
  }
}

function listCaseFiles() {
  return fs.readdirSync(CASES_ROOT).filter((file) => file.endsWith(".json")).sort();
}

test("behavior corpus remains loadable, bounded, and reviewable", () => {
  const files = listCaseFiles();
  assert.ok(files.length > 0, "behavior corpus must contain cases");
  const ids = new Set();
  for (const file of files) {
    const testCase = readJson(path.join(CASES_ROOT, file));
    assertCase(testCase, file);
    assert.equal(ids.has(testCase.id), false, `duplicate case id: ${testCase.id}`);
    ids.add(testCase.id);
  }
});

test("public evidence contains only direct main-assistant text", () => {
  const records = [
    { type: "assistant", message: { role: "assistant", content: [
      { type: "thinking", thinking: "private" },
      { type: "text", text: "Inspecting the manuscript." },
      { type: "tool_use", name: "Read", input: { file_path: "/workspace/paper/main.tex" } }
    ] } },
    { type: "assistant", parent_tool_use_id: "child", message: { role: "assistant", content: [{ type: "text", text: "Subagent verdict." }] } },
    { type: "user", message: { role: "user", content: [{ type: "tool_result", content: "Tool output." }] } },
    { type: "result", result: "Final public answer.", subtype: "success" }
  ];
  const evidence = parseEvidence(records.map((record) => JSON.stringify(record)).join("\n"), "/workspace");
  assert.equal(evidence.publicText, "Inspecting the manuscript.\n\nFinal public answer.");
  assert.deepEqual(evidence.toolActions.actions, [{ index: 1, name: "Read", referencedPaths: ["paper/main.tex"], inputShape: ["file_path"] }]);
  assertToolActionsShape(evidence.toolActions);
  assert.equal(evaluateHardExpectation({ id: "answer", kind: "public-output-not-empty" }, { publicOutput: evidence.publicText }).passed, true);
  assert.equal(evaluateHardExpectation({ id: "answer", kind: "public-output-not-empty" }, { publicOutput: "" }).passed, false);
});

test("snapshot hard checks prove artifact boundaries", () => {
  const file = (digest) => ({ path: "paper/main.tex", type: "file", mode: 0o644, size: 1, sha256: digest.repeat(64) });
  const before = createSnapshotRecord({ createdAt: "2026-09-04T00:00:00.000Z", rootLabel: "before", include: ["paper/main.tex", "results/out.json"], entries: [file("0")] });
  const after = createSnapshotRecord({ createdAt: "2026-09-04T00:00:01.000Z", rootLabel: "after", include: before.include, entries: [file("1"), { path: "results/out.json", type: "file", mode: 0o644, size: 2, sha256: "2".repeat(64) }] });
  assert.equal(evaluateHardExpectation({ id: "changed", kind: "path-changed", path: "paper/main.tex" }, { before, after }).passed, true);
  assert.equal(evaluateHardExpectation({ id: "exists", kind: "path-exists", path: "results/out.json" }, { before, after }).passed, true);
  assert.equal(evaluateHardExpectation({ id: "unchanged", kind: "path-unchanged", path: "paper/main.tex" }, { before, after }).passed, false);
  assert.equal(evaluateHardExpectation({ id: "not-created", kind: "path-not-created", path: "results/other.json" }, { before, after }).passed, true);
});

test("receipt records only minimum execution and evidence facts", () => {
  const { receipt } = behaviorEvalShapeExamples();
  assertReceiptRecordShape(receipt);
  assert.deepEqual(Object.keys(receipt.runner).sort(), ["kind", "maxBudgetUsd", "permissionMode"]);
  assert.deepEqual(Object.keys(receipt.result).sort(), ["budgetExceeded", "exitCode", "permissionDenials", "signal", "status"]);
  const escaped = structuredClone(receipt);
  escaped.paths.stream = "../stream.jsonl";
  assert.throws(() => assertReceiptRecordShape(escaped), /must stay under its repo-local/u);
});

test("one offline spawn reaches a public successful terminal", (t) => {
  const scratch = fs.mkdtempSync(path.join(ROOT, "evals", "behavior", ".scratch-spawn-"));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const launcher = createFixtureCliLauncher(scratch);
  const fakeCli = path.join(ROOT, "evals", "behavior", "fake-claude-cli.mjs");
  const testCase = readJson(path.join(CASES_ROOT, "pure-judgment-answer-and-stop.json"));
  const options = parseArgs(["--claude-command", fakeCli, "--model", "fake-success", "--permission-mode", "acceptEdits", "--max-budget-usd", "0.002"]);
  const invoked = invokeClaude(testCase, options, scratch, launcher);
  assert.equal(invoked.result.status, 0, invoked.result.stderr);
  const evidence = parseEvidence(invoked.result.stdout, scratch);
  assert.match(evidence.publicText, /Offline synthetic answer/u);
  assert.equal(executionResult(invoked.result, evidence.streamRecords, invoked.maxBudgetUsd).status, "completed");
});

test("generic terminal rules reject failure, missing terminal, and budget interruption", () => {
  const processResult = { status: 0, signal: null };
  const success = { type: "result", subtype: "success", total_cost_usd: 0.001 };
  assert.equal(executionResult(processResult, [success], 0.002).status, "completed");
  assert.equal(executionResult({ status: 1, signal: null }, [success], 0.002).status, "failed");
  assert.equal(executionResult(processResult, [], 0.002).status, "incomplete");
  assert.equal(executionResult(processResult, [{ ...success, subtype: "error_max_budget_usd", is_error: true }], 0.002).status, "failed");
  assert.equal(executionResult(processResult, [{ ...success, total_cost_usd: 0.003 }], 0.002).status, "failed");
});

test("permission denial is recorded but cannot prove a missing artifact", () => {
  const denial = { tool_name: "Write", tool_use_id: "denied-plan" };
  const outcome = executionResult({ status: 0, signal: null }, [{ type: "result", subtype: "success", permission_denials: [denial] }], 0.02);
  assert.equal(outcome.status, "completed");
  assert.deepEqual(outcome.permissionDenials, [denial]);
  assert.equal(evaluateHardExpectation({ id: "plan", kind: "path-exists", path: "notes/plan.md" }, { after: { entries: [] } }).passed, false);
});

test("all declared material and hard-check paths enter snapshots", () => {
  for (const file of listCaseFiles()) {
    const testCase = readJson(path.join(CASES_ROOT, file));
    const include = materializedSnapshotInclude(testCase);
    for (const spec of [...testCase.snapshot.include, ...testCase.expectedBehavior.mustInspectOrChange]) assert.ok(include.includes(spec), `${testCase.id}: ${spec}`);
    for (const expectation of testCase.hardExpectations) if (expectation.path) assert.ok(include.includes(expectation.path), `${testCase.id}: ${expectation.path}`);
  }
});

test("central execution fixture captures prospective bytes before computing", (t) => {
  const scratch = fs.mkdtempSync(path.join(ROOT, "evals", "behavior", ".scratch-central-"));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  fs.mkdirSync(path.join(scratch, "scripts"));
  fs.copyFileSync(path.join(FIXTURES_ROOT, "central-execution-plan-append", "scripts", "central_probe.py"), path.join(scratch, "scripts", "central_probe.py"));
  const record = path.join(scratch, "notes", "central-experiment.md");
  fs.mkdirSync(path.dirname(record));
  const plan = "Compare matched estimators on the supplied synthetic system.\nJudge the MSE contrast, not real-data generalization.\n";
  fs.writeFileSync(record, plan);
  const result = spawnSync("python3", ["-B", path.join(scratch, "scripts", "central_probe.py"), "--record", "notes/central-experiment.md"], { cwd: scratch, encoding: "utf8", timeout: 30_000 });
  assert.equal(result.error, undefined, "the offline fixture requires an existing Python 3 interpreter, not an install");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(scratch, "results", "plan-before.txt"), "utf8"), plan);
  assert.equal(fs.readFileSync(record, "utf8"), plan, "the program cannot rewrite its prospective plan");
  assert.deepEqual(readJson(path.join(scratch, "results", "probe.json")), JSON.parse(result.stdout));
  assert.equal(fs.existsSync(path.join(scratch, ".dove")), false);
});
