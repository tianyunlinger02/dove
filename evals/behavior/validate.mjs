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
  behaviorEvalShapeExamples,
  createFixtureCliLauncher,
  parseArgs,
  invokeClaude,
  executionResult,
  materializedSnapshotInclude,
  parseEvidence,
  evaluateHardExpectation,
  assertReceiptRecordShape,
  assertToolActionsShape,
  isSafeProjectRelativePathSpec
} from "./eval.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CASES_ROOT = path.join(ROOT, "evals", "behavior", "cases");
const FIXTURES_ROOT = path.join(ROOT, "evals", "behavior", "fixtures");
const CASE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const FIXTURE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const CASE_FILE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/u;
const EXPECTATION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ALLOWED_SURFACE_ENTRIES = new Set(["slash-command", "ambient-prompt"]);
const ALLOWED_SURFACE_COMMANDS = new Set(["/dove:research", "/dove:status", "/dove:source", "/dove:experiment", "/dove:draft", "/dove:figure", "/dove:review", "/dove:rebuttal", "/dove:lessons"]);
const FORBIDDEN_FIXTURE_ROOT_ENTRIES = new Set(["node_modules", ".claude", ".git"]);
const REQUIRED_EVIDENCE_FILES = [
  "receipt.json",
  "public-output.md",
  "stream.jsonl",
  "stderr.log",
  "tool-actions.json",
  "snapshot-before.json",
  "snapshot-after.json",
  "snapshot-diff.json",
  "hard-checks.json"
];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertTrimmedNonEmptyString(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.equal(value.trim(), value, `${label} must be trimmed`);
  assert.notEqual(value, "", `${label} must be non-empty`);
  assert.equal(value.includes("\0"), false, `${label} must not contain NUL`);
}

function assertStringArray(value, label, { minLength = 0 } = {}) {
  assert.equal(Array.isArray(value), true, `${label} must be an array`);
  assert.ok(value.length >= minLength, `${label} must have at least ${minLength} item(s)`);
  value.forEach((item, index) => assertTrimmedNonEmptyString(item, `${label}[${index}]`));
}

function realpathNative(target) {
  return typeof fs.realpathSync.native === "function" ? fs.realpathSync.native(target) : fs.realpathSync(target);
}

function assertContainedExistingPath(base, target, label) {
  const baseReal = realpathNative(base);
  const targetReal = realpathNative(target);
  const relative = path.relative(baseReal, targetReal);
  assert.equal(relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative)), true, `${label} must stay inside ${baseReal}: ${target}`);
  return targetReal;
}

function walkNoSymlink(root, label) {
  const stat = fs.lstatSync(root);
  assert.equal(stat.isSymbolicLink(), false, `${label} must not be a symlink: ${root}`);
  if (!stat.isDirectory()) return;
  for (const entry of fs.readdirSync(root)) walkNoSymlink(path.join(root, entry), label);
}

function listCaseFiles() {
  return fs.readdirSync(CASES_ROOT).filter((file) => file.endsWith(".json")).sort();
}

function assertBehaviorFeedbackSource(source) {
  assert.equal(isObject(source), true, "source must be an object");
  if (source.kind === "user-feedback-excerpt") {
    assert.equal(source.document, "current-user-request", "user feedback must identify the supplied request, not an invented DOCTOR location");
    assertStringArray(source.quotes, "source.quotes", { minLength: 1 });
    assertTrimmedNonEmptyString(source.context, "source.context");
    assert.equal(Object.hasOwn(source, "lineStart") || Object.hasOwn(source, "lineEnd"), false, "user excerpts have no invented document line numbers");
    return;
  }
  assert.equal(source.kind, undefined, "unknown feedback source kind");
  assert.equal(source.document, ".dove/install/DOCTOR.md", "source.document must cite the feedback document path without reading repository-local project state");
  assert.equal(Number.isInteger(source.lineStart), true, "source.lineStart must be an integer");
  assert.equal(Number.isInteger(source.lineEnd), true, "source.lineEnd must be an integer");
  assert.ok(source.lineStart >= 1, "source.lineStart must be positive");
  assert.ok(source.lineEnd >= source.lineStart, "source.lineEnd must be >= lineStart");
  assertStringArray(source.quotes, "source.quotes", { minLength: 1 });
}

function assertFixture(testCase) {
  assertTrimmedNonEmptyString(testCase.fixture, "fixture");
  assert.match(testCase.fixture, FIXTURE_ID_PATTERN, "fixture must be a safe fixture id");
  const fixtureRoot = path.join(FIXTURES_ROOT, testCase.fixture);
  assertContainedExistingPath(FIXTURES_ROOT, fixtureRoot, `fixture ${testCase.fixture}`);
  const fixtureStat = fs.lstatSync(fixtureRoot);
  assert.equal(fixtureStat.isDirectory(), true, `fixture must be a directory: ${testCase.fixture}`);
  assert.equal(fixtureStat.isSymbolicLink(), false, `fixture root must not be a symlink: ${testCase.fixture}`);
  walkNoSymlink(fixtureRoot, `fixture ${testCase.fixture}`);
  for (const entry of fs.readdirSync(fixtureRoot)) assert.equal(FORBIDDEN_FIXTURE_ROOT_ENTRIES.has(entry), false, `fixture ${testCase.fixture} must not contain root ${entry}`);
  assert.equal(fs.existsSync(path.join(fixtureRoot, ".dove", "install", "manifest.json")), false, `fixture ${testCase.fixture} must not preinstall Dove integration`);
  return fixtureRoot;
}

function assertPathSpec(value, label) {
  assertTrimmedNonEmptyString(value, label);
  assert.equal(isSafeProjectRelativePathSpec(value), true, `${label} must remain inside the fixture: ${value}`);
}

function assertSurface(testCase) {
  assert.equal(isObject(testCase.surface), true, "surface must be an object");
  assert.equal(testCase.surface.host, "claude-code", "surface.host must be claude-code");
  assert.equal(ALLOWED_SURFACE_ENTRIES.has(testCase.surface.entry), true, `surface.entry must be one of ${[...ALLOWED_SURFACE_ENTRIES].join(", ")}`);
  if (testCase.surface.entry === "slash-command") {
    assert.equal(ALLOWED_SURFACE_COMMANDS.has(testCase.surface.command), true, `surface.command must be a supported flat Dove slash command: ${testCase.surface.command}`);
  } else {
    assert.equal(Object.hasOwn(testCase.surface, "command"), false, "ambient prompts must not declare a slash command");
  }
  assertTrimmedNonEmptyString(testCase.surface.prompt, "surface.prompt");
  assert.ok(testCase.surface.prompt.length <= 4000, "surface.prompt must be bounded");
}

function assertBudgets(testCase) {
  assert.equal(isObject(testCase.budgets), true, "budgets must be an object");
  assert.equal(Number.isInteger(testCase.budgets.timeoutMs), true, "budgets.timeoutMs must be an integer");
  assert.ok(testCase.budgets.timeoutMs >= 30_000 && testCase.budgets.timeoutMs <= 900_000, "budgets.timeoutMs must be between 30000 and 900000");
  assert.equal(typeof testCase.budgets.maxBudgetUsd, "number", "budgets.maxBudgetUsd must be a number");
  assert.ok(Number.isFinite(testCase.budgets.maxBudgetUsd) && testCase.budgets.maxBudgetUsd > 0 && testCase.budgets.maxBudgetUsd <= 5, "budgets.maxBudgetUsd must be >0 and <=5");
}

function assertSnapshot(testCase) {
  assert.equal(isObject(testCase.snapshot), true, "snapshot must be an object");
  assertStringArray(testCase.snapshot.include, "snapshot.include");
  for (const spec of testCase.snapshot.include) {
    // Public review exchange records may be captured as file facts, never host transcripts.
    assertPathSpec(spec, `snapshot.include ${spec}`);
  }
}

function expectationPath(expectation) {
  return typeof expectation.path === "string" ? expectation.path : null;
}

function fixturePathExists(fixtureRoot, spec) {
  const base = spec.replace(/\/\*\*$/u, "");
  return fs.existsSync(path.join(fixtureRoot, base));
}

function assertHardExpectations(testCase, fixtureRoot) {
  assert.equal(Array.isArray(testCase.hardExpectations), true, "hardExpectations must be an array");
  const ids = new Set();
  for (const [index, expectation] of testCase.hardExpectations.entries()) {
    assert.equal(isObject(expectation), true, `hardExpectations[${index}] must be an object`);
    assertTrimmedNonEmptyString(expectation.id, `hardExpectations[${index}].id`);
    assert.match(expectation.id, EXPECTATION_ID_PATTERN, `hardExpectations[${index}].id must be kebab-case`);
    assert.equal(ids.has(expectation.id), false, `hard expectation id duplicated: ${expectation.id}`);
    ids.add(expectation.id);
    assert.equal(SUPPORTED_HARD_EXPECTATION_KINDS.includes(expectation.kind), true, `hard expectation kind is unsupported: ${expectation.kind}`);
    const spec = expectationPath(expectation);
    if (spec !== null) {
      assertPathSpec(spec, `hardExpectations[${index}].path`);
      if (["path-changed", "path-unchanged"].includes(expectation.kind)) {
        assert.equal(fixturePathExists(fixtureRoot, spec), true, `hard expectation ${expectation.id} must point at an existing fixture path: ${spec}`);
      }
    }
    if (expectation.kind === "public-output-includes-any") {
      assertStringArray(expectation.terms, `hardExpectations[${index}].terms`, { minLength: 1 });
      for (const term of expectation.terms) assertPathSpec(term, `hardExpectations[${index}].terms artifact path`);
      if (expectation.minMatches !== undefined) {
        assert.equal(Number.isInteger(expectation.minMatches), true, `hardExpectations[${index}].minMatches must be an integer`);
        assert.ok(expectation.minMatches >= 1 && expectation.minMatches <= expectation.terms.length, `hardExpectations[${index}].minMatches must be feasible`);
      }
    }
    if (expectation.kind === "tool-action-path" && expectation.verbs !== undefined) {
      assertStringArray(expectation.verbs, `hardExpectations[${index}].verbs`, { minLength: 1 });
      for (const verb of expectation.verbs) assert.match(verb, /^[A-Za-z][A-Za-z0-9_:-]*$/u, `tool verb must be stable: ${verb}`);
    }
    if (expectation.description !== undefined) assertTrimmedNonEmptyString(expectation.description, `hardExpectations[${index}].description`);
  }
}

function assertExpectedMaterials(testCase, fixtureRoot) {
  assert.equal(isObject(testCase.expectedBehavior), true, "expectedBehavior must be an object");
  assertStringArray(testCase.expectedBehavior.mustInspectOrChange, "expectedBehavior.mustInspectOrChange");
  for (const spec of testCase.expectedBehavior.mustInspectOrChange) {
    assertPathSpec(spec, `expectedBehavior.mustInspectOrChange ${spec}`);
    assert.equal(fixturePathExists(fixtureRoot, spec), true, `expected material must exist: ${spec}`);
  }
}

function assertRubric(testCase) {
  assert.equal(Array.isArray(testCase.humanReviewRubric), true, "humanReviewRubric must be an array");
  assert.ok(testCase.humanReviewRubric.length > 0, "humanReviewRubric must describe the case's research judgment");
  for (const [index, item] of testCase.humanReviewRubric.entries()) {
    assert.equal(isObject(item), true, `humanReviewRubric[${index}] must be an object`);
    assertTrimmedNonEmptyString(item.criterion, `humanReviewRubric[${index}].criterion`);
    assertStringArray(item.evidence, `humanReviewRubric[${index}].evidence`, { minLength: 1 });
    assertStringArray(item.failureSignals, `humanReviewRubric[${index}].failureSignals`, { minLength: 1 });
    assert.equal(item.evidence.some((entry) => REQUIRED_EVIDENCE_FILES.includes(entry)), true, `humanReviewRubric[${index}].evidence must reference runner evidence files`);
  }
}

function assertCase(testCase, file) {
  assert.equal(isObject(testCase), true, `${file} must be a JSON object`);
  assert.equal(testCase.schemaVersion, BEHAVIOR_CASE_SCHEMA_VERSION, `${file} schemaVersion mismatch`);
  assertTrimmedNonEmptyString(testCase.id, `${file}.id`);
  assert.match(testCase.id, CASE_ID_PATTERN, `${file}.id must be kebab-case`);
  assert.equal(file, `${testCase.id}.json`, `${file} must match case id`);
  assertTrimmedNonEmptyString(testCase.title, `${file}.title`);
  assertTrimmedNonEmptyString(testCase.failureMode, `${file}.failureMode`);
  assertBehaviorFeedbackSource(testCase.source);
  const fixtureRoot = assertFixture(testCase);
  assertSurface(testCase);
  assertBudgets(testCase);
  assertSnapshot(testCase);
  assertExpectedMaterials(testCase, fixtureRoot);
  assertHardExpectations(testCase, fixtureRoot);
  assertRubric(testCase);
}

test("behavior case corpus is schema-valid, sourced, safe, and reviewable", () => {
  const files = listCaseFiles();
  assert.ok(files.length > 0, "behavior cases must be discoverable");
  const ids = new Set();
  for (const file of files) {
    assert.match(file, CASE_FILE_PATTERN, `case file name must be kebab-case JSON: ${file}`);
    const testCase = readJson(path.join(CASES_ROOT, file));
    assertCase(testCase, file);
    assert.equal(ids.has(testCase.id), false, `duplicate case id ${testCase.id}`);
    ids.add(testCase.id);
  }
});

test("receipt paths accept separate short workspace and evidence roots", () => {
  const { receipt } = behaviorEvalShapeExamples();
  const runRoot = ".claude/tmp/dove-behavior-evals/r-Ab12Cd";
  for (const [key, value] of Object.entries(receipt.paths)) {
    receipt.paths[key] = key === "workspaceRoot"
      ? ".claude/tmp/w-Ef34Gh"
      : key === "runRoot" ? runRoot : `${runRoot}/${path.posix.basename(value)}`;
  }
  receipt.runner.fixtureCliPath = `${runRoot}/bin/dove`;
  assertReceiptRecordShape(receipt);
  receipt.runner.fixtureCliPath = ".claude/tmp/dove-behavior-evals/r-other/bin/dove";
  assert.throws(() => assertReceiptRecordShape(receipt), /runner fixture CLI must belong to this evidence root/u);
});

test("fixture CLI launcher selects current source and preserves quoted paths and arguments", (t) => {
  const scratch = fs.mkdtempSync(path.join(ROOT, "evals", "behavior", ".scratch-cli-"));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const originalPath = process.env.PATH;
  const launcher = createFixtureCliLauncher(scratch);
  const selected = spawnSync("/bin/sh", ["-c", "command -v dove && dove --help"], {
    encoding: "utf8",
    timeout: 30000,
    env: { ...process.env, NO_COLOR: "1", PATH: `${path.dirname(launcher)}${path.delimiter}${originalPath ?? ""}` }
  });
  const direct = spawnSync(process.execPath, [path.join(ROOT, "bin", "dove.mjs"), "--help"], {
    encoding: "utf8", timeout: 30000, env: { ...process.env, NO_COLOR: "1" }
  });
  assert.equal(direct.status, 0, direct.stderr);
  assert.equal(selected.status, 0, selected.stderr);
  assert.equal(selected.stdout, `${launcher}\n${direct.stdout}`);
  assert.equal(process.env.PATH, originalPath, "launcher selection must not change the parent PATH");

  const quotedRoot = path.join(scratch, "quoted ' paths $;");
  fs.mkdirSync(quotedRoot);
  const nodePath = path.join(quotedRoot, "node ' executable");
  const cliPath = path.join(quotedRoot, "cli ' source.mjs");
  fs.symlinkSync(process.execPath, nodePath);
  fs.writeFileSync(cliPath, "process.stdout.write(JSON.stringify(process.argv.slice(2)));\n");
  const quotedLauncher = createFixtureCliLauncher(quotedRoot, nodePath, cliPath);
  const args = ["", "two words", "single'quote", "double\"quote", "$HOME; $(not-a-command)"];
  const quoted = spawnSync(quotedLauncher, args, { encoding: "utf8", timeout: 30000 });
  assert.equal(quoted.status, 0, quoted.stderr);
  assert.deepEqual(JSON.parse(quoted.stdout), args);
});

test("receipt paths reject wrong roots, absolute paths, and traversal", () => {
  const { receipt } = behaviorEvalShapeExamples();
  const invalidEvidencePaths = [
    ".claude/tmp/w-Ab12Cd/stream.jsonl",
    ".claude/tmp/dove-behavior-evals-other/r-Ab12Cd/stream.jsonl",
    ".claude/tmp/dove-behavior-evals/../outside.json",
    ".claude/tmp/dove-behavior-evals/r-Ab12Cd/../../outside.json",
    ".claude/tmp/dove-behavior-evals/r-Ab12Cd/../other/stream.jsonl",
    ".claude/tmp/dove-behavior-evals/r-Ab12Cd\\..\\outside.json",
    "../.claude/tmp/dove-behavior-evals/r-Ab12Cd/stream.jsonl",
    "/tmp/dove-behavior-evals/r-Ab12Cd/stream.jsonl",
    path.join(ROOT, ".claude/tmp/dove-behavior-evals/r-Ab12Cd/stream.jsonl")
  ];
  const invalidWorkspacePaths = [
    ".claude/tmp/dove-behavior-evals/r-Ab12Cd/workspace",
    ".claude/tmp/w-",
    ".claude/tmp/w-Ab12Cd/nested",
    ".claude/tmp/w-Ab12Cd/../outside",
    ".claude/tmp/../w-Ab12Cd",
    ".claude/tmp/w-Ab12Cd\\..\\outside",
    "../.claude/tmp/w-Ab12Cd",
    "/tmp/w-Ab12Cd",
    path.join(ROOT, ".claude/tmp/w-Ab12Cd")
  ];
  for (const key of Object.keys(receipt.paths)) {
    for (const invalidPath of key === "workspaceRoot" ? invalidWorkspacePaths : invalidEvidencePaths) {
      const candidate = structuredClone(receipt);
      candidate.paths[key] = invalidPath;
      assert.throws(() => assertReceiptRecordShape(candidate), (error) =>
        error.code === "ERR_ASSERTION" && error.message.startsWith(`receipt paths.${key} must stay under its repo-local .claude/tmp root`),
      `${key} must reject ${invalidPath}`);
    }
  }
});

test("mixed streams extract only direct assistant text and tool uses", () => {
  const quotedTool = { type: "tool_use", name: "Write", input: { file_path: "/etc/quoted.md" } };
  const records = [
    { type: "system", message: { role: "assistant", content: [{ type: "text", text: "System notice" }, quotedTool] } },
    { type: "assistant", message: { role: "assistant", content: [
      { type: "tool_use", name: "Skill", input: { skill: "dove:review" } }
    ] } },
    { type: "user", message: { role: "user", content: [
      { type: "text", text: "# dove.review\nSkill prompt, not a model answer." },
      { type: "tool_result", content: [{ type: "text", text: "Quoted tool output" }, quotedTool] },
      quotedTool
    ] } },
    { type: "assistant", message: { role: "user", content: [{ type: "text", text: "Wrong role" }, quotedTool] } },
    { type: "assistant", text: "Not an assistant message block", content: [quotedTool] },
    { type: "text", text: "Top-level text is not an answer" },
    quotedTool,
    { type: "assistant", message: { role: "assistant", content: [
      { type: "thinking", thinking: "Synthetic non-public placeholder", content: [quotedTool] },
      { type: "text", text: "Inspecting the current manuscript." },
      { type: "tool_use", name: "Read", input: { file_path: "/workspace/paper/main.tex" } },
      { type: "tool_result", content: [{ type: "text", text: "Nested output is not an answer" }, quotedTool] }
    ] } },
    { type: "user", message: { role: "user", content: [{ type: "tool_result", content: "Manuscript body" }] } },
    { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "The scientific claim is unsupported." }] } },
    { type: "result", subtype: "success", result: "The scientific claim is unsupported.", total_cost_usd: 0.01 }
  ];
  const evidence = parseEvidence(records.map((record) => JSON.stringify(record)).join("\n"), "/workspace");
  assert.deepEqual(evidence.streamRecords, records, "raw stream records must remain intact");
  assert.equal(evidence.publicText, "Inspecting the current manuscript.\n\nThe scientific claim is unsupported.");
  assert.deepEqual(evidence.toolActions.actions, [
    { index: 1, name: "Skill", referencedPaths: [], inputShape: ["skill"] },
    { index: 2, name: "Read", referencedPaths: ["paper/main.tex"], inputShape: ["file_path"] }
  ]);
  assertToolActionsShape(evidence.toolActions);
});

test("subagent traces and delegation inputs are not main-assistant answers", () => {
  const records = [
    { type: "assistant", parent_tool_use_id: null, message: { role: "assistant", content: [
      { type: "tool_use", name: "Agent", input: { subagent_type: "Explore", prompt: "Delegated keyword: submission-ready" } }
    ] } },
    { type: "assistant", parent_tool_use_id: "toolu_explore", message: { role: "assistant", content: [
      { type: "text", text: "Subagent keyword: submission-ready" },
      { type: "tool_use", name: "Read", input: { file_path: "/workspace/paper/main.tex" } }
    ] } },
    { type: "result", parent_tool_use_id: "toolu_explore", result: "Subagent result: submission-ready" },
    { type: "assistant", parent_tool_use_id: null, message: { role: "assistant", content: [
      { type: "text", text: "The main assistant has not reached a verdict." }
    ] } },
    { type: "result", parent_tool_use_id: null, result: "The main assistant has not reached a verdict." }
  ];
  const evidence = parseEvidence(records.map((record) => JSON.stringify(record)).join("\n"), "/workspace");
  assert.deepEqual(evidence.streamRecords, records);
  assert.equal(evidence.publicText, "The main assistant has not reached a verdict.");
  assert.deepEqual(evidence.toolActions.actions.map((action) => action.name), ["Agent", "Read"]);
  assert.deepEqual(evidence.toolActions.actions[1].referencedPaths, ["paper/main.tex"]);
  const check = evaluateHardExpectation({ id: "keyword", kind: "public-output-includes-any", terms: ["submission-ready"] }, { publicOutput: evidence.publicText });
  assert.equal(check.passed, false, "delegation and subagent text cannot satisfy public-answer keyword checks");
  const subagentOnly = parseEvidence(records.slice(0, 3).map((record) => JSON.stringify(record)).join("\n"), "/workspace");
  assert.equal(subagentOnly.publicText, "");
});

test("streams without assistant or result text cannot satisfy the answer check", () => {
  const streams = [
    "",
    'Host diagnostic, not a model answer.\n{"type":"system","text":"Initialized"}',
    JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text: "Skill prompt" }] } }),
    JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "tool_result", content: [{ type: "text", text: "Tool output" }] }] } }),
    JSON.stringify({ type: "assistant", message: { role: "assistant", content: [
      { type: "thinking", thinking: "Synthetic non-public placeholder" },
      { type: "text", text: " \n " },
      { type: "tool_use", name: "Read", input: { file_path: "/workspace/paper/main.tex" } }
    ] } }),
    JSON.stringify({ type: "result", subtype: "error_during_execution", errors: ["Host failure"] }),
    'null\n17\n"Plain JSON string"\n[]\n{"type":"result","result":"  "}'
  ];
  for (const stream of streams) {
    const evidence = parseEvidence(stream, "/workspace");
    assert.equal(evidence.publicText, "");
    const check = evaluateHardExpectation({ id: "answer-visible", kind: "public-output-not-empty" }, { publicOutput: evidence.publicText });
    assert.equal(check.passed, false);
    assert.equal(check.evidence.bytes, 0);
  }
  const plainEvidence = parseEvidence("Host diagnostic\n", "/workspace");
  assert.deepEqual(plainEvidence.streamRecords, [{ type: "plain", line: 1, text: "Host diagnostic" }]);
});

test("result-only answers are retained without repeating the last assistant answer", () => {
  const assistant = (...texts) => ({ type: "assistant", message: { role: "assistant", content: texts.map((text) => ({ type: "text", text })) } });
  const result = (text) => ({ type: "result", subtype: "success", result: text });
  const cases = [
    { records: [result("Result-only answer.")], expected: "Result-only answer." },
    { records: [assistant("Inspecting."), result("A distinct final answer.")], expected: "Inspecting.\n\nA distinct final answer." },
    { records: [assistant("Inspecting."), assistant("Final answer."), result("Final answer.")], expected: "Inspecting.\n\nFinal answer." },
    { records: [assistant("First paragraph.", "Second paragraph."), result(" \nFirst paragraph.\n\nSecond paragraph.\n")], expected: "First paragraph.\n\nSecond paragraph." },
    { records: [assistant("Repeated statement."), assistant("Repeated statement."), result("Repeated statement.")], expected: "Repeated statement.\n\nRepeated statement." },
    { records: [assistant("Earlier statement."), assistant("Later statement."), result("Earlier statement.")], expected: "Earlier statement.\n\nLater statement.\n\nEarlier statement." }
  ];
  for (const { records, expected } of cases) {
    const evidence = parseEvidence(records.map((record) => JSON.stringify(record)).join("\n"), "/workspace");
    assert.equal(evidence.publicText, expected);
    assert.deepEqual(evidence.streamRecords, records);
  }
});

test("Claude stream-json fixture parses public text and tool paths", () => {
  walkNoSymlink(path.join(FIXTURES_ROOT, "claude-stream-json"), "Claude stream-json fixture");
  const stream = fs.readFileSync(path.join(FIXTURES_ROOT, "claude-stream-json", "tool-use.jsonl"), "utf8");
  const evidence = parseEvidence(stream, "/workspace");
  assert.match(evidence.publicText, /Inspected paper\/main\.tex/u);
  assert.deepEqual(evidence.toolActions.actions.map((action) => action.name), ["Read", "Bash"]);
  assert.deepEqual(evidence.toolActions.actions[0].referencedPaths, ["paper/main.tex"]);
  assert.equal(evidence.toolActions.actions[1].referencedPaths.includes("paper/main.tex"), true);
  assert.equal(evidence.toolActions.actions[1].referencedPaths.includes("figures/result.svg"), true);
  assertToolActionsShape(evidence.toolActions);
});

test("path extraction preserves outside references as observations, not an access audit", () => {
  const stream = fs.readFileSync(path.join(FIXTURES_ROOT, "claude-stream-json", "outside-tool-path.jsonl"), "utf8");
  const evidence = parseEvidence(stream, ROOT);
  assert.deepEqual(evidence.toolActions.actions[0].referencedPaths, ["/etc/passwd"]);
  assertToolActionsShape(evidence.toolActions);
});

test("path checks reject similarly named files and never equate SVG source with raster evidence", () => {
  const evidence = parseEvidence(JSON.stringify({ type: "assistant", message: { role: "assistant", content: [
    { type: "tool_use", name: "Read", input: { file_path: "/workspace/paper/main.tex.bak" } },
    { type: "tool_use", name: "Bash", input: { command: "python scripts/check.py paper/main.tex figures/result.svg" } }
  ] } }), "/workspace");
  const expectation = { id: "paper", kind: "tool-action-path", path: "paper/main.tex" };
  assert.equal(evaluateHardExpectation(expectation, { toolActions: { actions: evidence.toolActions.actions.slice(0, 1) } }).passed, false);
  assert.equal(evaluateHardExpectation(expectation, { toolActions: evidence.toolActions }).passed, true);

  const action = (index, name, referencedPath) => ({ index, name, referencedPaths: [referencedPath] });
  assert.equal(evaluateHardExpectation(expectation, { toolActions: { actions: [action(1, "OtherHostTool", "paper/main.tex")] } }).passed, true, "path observations need not mandate a host tool");

  const raster = { id: "raster-reference", kind: "tool-action-path", path: "figures/result.png" };
  assert.equal(evaluateHardExpectation(raster, { toolActions: { actions: [action(1, "Read", "figures/result.svg")] } }).passed, false, "SVG source reading is not a raster observation");
});

test("CLI options reach the actual offline spawn and public outcome without initialization", (t) => {
  const scratch = fs.mkdtempSync(path.join(ROOT, "evals", "behavior", ".scratch-spawn-"));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const launcher = createFixtureCliLauncher(scratch);
  const fakeCli = path.join(ROOT, "evals", "behavior", "fake-claude-cli.mjs");
  const testCase = readJson(path.join(CASES_ROOT, "pure-judgment-answer-and-stop.json"));
  const originalPath = process.env.PATH;
  for (const [model, expectedStatus] of [
    ["fake-success", "completed"], ["fake-stream-error", "failed"], ["fake-budget-stop", "failed"],
    ["fake-over-budget", "failed"], ["fake-permission-denial", "completed"], ["fake-incomplete", "incomplete"]
  ]) {
    const options = parseArgs(["--case", testCase.id, "--attempts=2", "--model", model, "--permission-mode", "acceptEdits", "--claude-command", fakeCli, "--max-budget-usd=0.002"]);
    assert.equal(options.runReal, false, "the test invokes only the fake spawn seam, not runOneAttempt/init");
    assert.deepEqual(options.caseIds, [testCase.id]);
    assert.equal(options.attempts, 2);
    const invoked = invokeClaude(testCase, options, scratch, launcher);
    assert.equal(invoked.result.status, 0, invoked.result.stderr);
    assert.equal(invoked.maxBudgetUsd, 0.002);
    const evidence = parseEvidence(invoked.result.stdout, scratch);
    const init = evidence.streamRecords[0];
    assert.deepEqual(init.argv, invoked.argv);
    assert.equal(init.input, `${testCase.surface.command}\n\n${testCase.surface.prompt}\n`);
    assert.equal(init.cwd, scratch);
    assert.equal(init.evalFlag, "1");
    assert.equal(init.childPath, `${path.dirname(launcher)}${path.delimiter}${originalPath ?? ""}`);
    assert.equal(process.env.PATH, originalPath);
    const outcome = executionResult(invoked.result, evidence.streamRecords, invoked.durationMs, invoked.maxBudgetUsd);
    assert.equal(outcome.status, expectedStatus, model);
    assert.equal(outcome.observedCostUsd, model === "fake-incomplete" ? null : model === "fake-over-budget" ? 0.003 : 0.001, "nested per-model cost cannot overwrite the total");
    assert.equal(outcome.budgetExceeded, model === "fake-incomplete" ? null : model === "fake-over-budget");
    assert.equal(outcome.permissionDenials.length, model === "fake-permission-denial" ? 1 : 0);
    const { receipt } = behaviorEvalShapeExamples();
    receipt.result = outcome;
    assertReceiptRecordShape(receipt);
    assert.equal(evaluateHardExpectation({ id: "read", kind: "tool-action-path", path: "paper/main.tex" }, { toolActions: evidence.toolActions }).passed, true);
  }
  for (const override of [null, 1]) {
    const options = parseArgs(["--claude-command", fakeCli, "--permission-mode", "acceptEdits", "--model", "fake-success"]);
    options.maxBudgetUsd = override;
    const invoked = invokeClaude(testCase, options, scratch, launcher);
    assert.equal(invoked.maxBudgetUsd, testCase.budgets.maxBudgetUsd, "an override cannot increase the case cap");
  }
  const ambient = { ...testCase, surface: { host: "claude-code", entry: "ambient-prompt", prompt: "Answer and stop." } };
  const options = parseArgs(["--claude-command", fakeCli, "--permission-mode", "acceptEdits", "--model", "fake-success"]);
  assert.equal(parseEvidence(invokeClaude(ambient, options, scratch, launcher).result.stdout, scratch).streamRecords[0].input, "Answer and stop.\n");
  const missing = invokeClaude(testCase, { ...options, claudeCommand: path.join(scratch, "missing-cli") }, scratch, launcher);
  assert.equal(executionResult(missing.result, [], missing.durationMs, missing.maxBudgetUsd).status, "failed");
  assert.throws(() => parseArgs(["--permission-mode=bypassPermissions"]), /refuses bypass/u);
  assert.throws(() => parseArgs(["--max-budget-usd=0"]), /must be positive/u);
  assert.throws(() => parseArgs(["--attempts=0"]), /integer/u);
});

test("permission denial is an execution fact, independent of completion and hard checks", () => {
  const denial = { tool_name: "Write", tool_use_id: "denied-plan" };
  const terminal = { type: "result", subtype: "success", permission_denials: [denial] };
  const outcome = executionResult({ status: 0, signal: null, stderr: "" }, [terminal], 1, 0.02);
  assert.equal(outcome.status, "completed");
  assert.deepEqual(outcome.permissionDenials, [denial]);
  const expectation = { id: "plan", kind: "path-exists", path: "notes/plan.md" };
  assert.equal(evaluateHardExpectation(expectation, { after: { entries: [] } }).passed, false, "completion cannot supply a missing artifact");
  assert.equal(executionResult({ status: 1, signal: null, stderr: "" }, [terminal], 1, 0.02).status, "failed");
});

test("case-specific expectations need no fixed path, rubric, or check count", () => {
  const testCase = readJson(path.join(CASES_ROOT, "stop-continuation-zero-write.json"));
  testCase.snapshot.include = [];
  testCase.hardExpectations = [{ id: "answer-visible", kind: "public-output-not-empty" }];
  testCase.humanReviewRubric = testCase.humanReviewRubric.slice(0, 1);
  assertCase(testCase, `${testCase.id}.json`);
});

test("execution evidence preserves stream failures, unknown cost, and interruption facts", () => {
  const spawned = { status: 0, signal: null, stderr: "" };
  const success = { type: "result", subtype: "success", total_cost_usd: 0.01 };
  const records = [
    { type: "user", message: { content: [{ type: "tool_result", total_cost_usd: 99 }] } },
    success,
    { type: "result", parent_tool_use_id: "child", subtype: "error_during_execution", total_cost_usd: 99 }
  ];
  assert.equal(executionResult(spawned, records, 1, 0.02).status, "completed");
  assert.equal(executionResult(spawned, records, 1, 0.02).observedCostUsd, 0.01);
  for (const total_cost_usd of [undefined, null, -1, "0.01", Infinity]) {
    assert.equal(executionResult(spawned, [{ ...success, total_cost_usd }], 1, 0.02).observedCostUsd, null);
  }
  assert.equal(executionResult(spawned, [{ ...success, is_error: true }], 1, 0.02).status, "failed");
  const errors = ["Synthetic failure"];
  assert.deepEqual(executionResult(spawned, [{ ...success, errors }], 1, 0.02).streamErrors, errors);
  assert.equal(executionResult(spawned, [{ ...success, errors }], 1, 0.02).status, "failed");
  assert.equal(executionResult(spawned, [], 1, 0.02).status, "incomplete");
  const timeout = executionResult({ status: null, signal: "SIGTERM", error: { code: "ETIMEDOUT", message: "Timed out" } }, [success], 1, 0.02);
  assert.equal(timeout.status, "timed-out");
  assert.equal(timeout.timedOut, true);
  const killed = executionResult({ status: null, signal: "SIGTERM" }, [success], 1, 0.02);
  assert.equal(killed.status, "failed");
  assert.equal(killed.timedOut, false, "SIGTERM alone does not prove timeout");
  assert.equal(executionResult({ ...spawned, error: { code: "ENOBUFS", message: "Buffer full" } }, [success], 1, 0.02).status, "failed");
});

test("all declared expected paths are captured without inventing automatic behavior gates", () => {
  for (const file of listCaseFiles()) {
    const testCase = readJson(path.join(CASES_ROOT, file));
    const include = materializedSnapshotInclude(testCase);
    for (const spec of [...testCase.snapshot.include, ...testCase.expectedBehavior.mustInspectOrChange]) {
      assert.ok(include.includes(spec), `${testCase.id}: missing snapshot capture for ${spec}`);
    }
    for (const expectation of testCase.hardExpectations) {
      if (expectation.path) assert.ok(include.includes(expectation.path));
    }
  }
});

test("central execution fixture captures arbitrary prospective bytes before computing and never writes the plan", (t) => {
  const scratch = fs.mkdtempSync(path.join(ROOT, "evals", "behavior", ".scratch-central-"));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  fs.mkdirSync(path.join(scratch, "scripts"));
  fs.copyFileSync(path.join(FIXTURES_ROOT, "central-execution-plan-append", "scripts", "central_probe.py"), path.join(scratch, "scripts", "central_probe.py"));
  const argv = ["-B", path.join(scratch, "scripts", "central_probe.py"), "--record", "notes/central-experiment.md"];
  const missingPlan = spawnSync("python3", argv, { cwd: scratch, encoding: "utf8", timeout: 30000 });
  assert.equal(missingPlan.error, undefined, "the offline fixture requires an existing Python 3 interpreter, not an install");
  assert.notEqual(missingPlan.status, 0);
  assert.equal(fs.existsSync(path.join(scratch, "results")), false, "no output is synthesized when the prospective file is absent");
  const record = path.join(scratch, "notes", "central-experiment.md");
  fs.mkdirSync(path.dirname(record));
  const plan = "Compare matched estimators on the supplied synthetic system.\nJudge the MSE contrast, not real-data generalization.\nNo fixed headings or schema.\n";
  fs.writeFileSync(record, plan);
  const result = spawnSync("python3", argv, { cwd: scratch, encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(scratch, "results", "plan-before.txt"), "utf8"), plan);
  assert.equal(fs.readFileSync(record, "utf8"), plan, "the experiment program cannot retrospectively rewrite or append its own prospective plan");
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.record, "notes/central-experiment.md");
  assert.deepEqual(readJson(path.join(scratch, "results", "probe.json")), payload);
  assert.ok(Object.values(payload.mean_squared_error).every((value) => Number.isFinite(value) && value >= 0));
  assert.equal(fs.existsSync(path.join(scratch, ".dove")), false, "the fixture program writes no research/installation/run ledger");
});

test("known user feedback excerpts need no fabricated DOCTOR citation or ledger", () => {
  const source = { kind: "user-feedback-excerpt", document: "current-user-request", quotes: ["审查整个dove有没有这种写了但实际都是缺口的，有的话都修了"], context: "Source compound-support coverage comes from the approved audit plan, not a user-reported research event or historical DOCTOR incident." };
  assertBehaviorFeedbackSource(source);
  assert.throws(() => assertBehaviorFeedbackSource({ ...source, lineStart: 1 }), /invented document line/u);
  assert.throws(() => assertBehaviorFeedbackSource({ ...source, kind: "invented" }), /unknown feedback source/u);
});
