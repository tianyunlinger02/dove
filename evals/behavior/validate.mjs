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
  RUN_RECEIPT_SCHEMA_VERSION,
  SUPPORTED_HARD_EXPECTATION_KINDS,
  behaviorEvalShapeExamples,
  createFixtureCliLauncher,
  parseEvidence,
  evaluateHardExpectation,
  assertReceiptRecordShape,
  assertSnapshotRecordShape,
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
const PRIVATE_PATH_PREFIXES = [".git", ".claude", ".dove/install", ".dove/reviews", ".dove/runs"];
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

function hasPathPrefix(relativePath, prefix) {
  return relativePath === prefix || relativePath.startsWith(`${prefix}/`);
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

function assertPathSpec(value, label, { allowPrivateForbiddenPath = false } = {}) {
  assertTrimmedNonEmptyString(value, label);
  assert.equal(isSafeProjectRelativePathSpec(value), true, `${label} must be a safe project-relative path spec: ${value}`);
  if (!allowPrivateForbiddenPath) {
    for (const forbidden of PRIVATE_PATH_PREFIXES) assert.equal(hasPathPrefix(value.replace(/\/\*\*$/u, ""), forbidden), false, `${label} must not point at private runner/Dove installation path ${forbidden}: ${value}`);
  }
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
  assert.doesNotMatch(testCase.surface.prompt, /transcript|conversation log|private memory|API completion|curl|WebFetch/iu, "surface.prompt must not ask for private transcripts, API completion, or web-fetch substitutes");
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
  assertStringArray(testCase.snapshot.include, "snapshot.include", { minLength: 1 });
  for (const spec of testCase.snapshot.include) assertPathSpec(spec, `snapshot.include ${spec}`);
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
  assert.ok(testCase.hardExpectations.length >= 3, "hardExpectations must include at least three hard checks");
  const ids = new Set();
  const kinds = new Set();
  for (const [index, expectation] of testCase.hardExpectations.entries()) {
    assert.equal(isObject(expectation), true, `hardExpectations[${index}] must be an object`);
    assertTrimmedNonEmptyString(expectation.id, `hardExpectations[${index}].id`);
    assert.match(expectation.id, EXPECTATION_ID_PATTERN, `hardExpectations[${index}].id must be kebab-case`);
    assert.equal(ids.has(expectation.id), false, `hard expectation id duplicated: ${expectation.id}`);
    ids.add(expectation.id);
    assert.equal(SUPPORTED_HARD_EXPECTATION_KINDS.includes(expectation.kind), true, `hard expectation kind is unsupported: ${expectation.kind}`);
    kinds.add(expectation.kind);
    const spec = expectationPath(expectation);
    if (spec !== null) {
      assertPathSpec(spec, `hardExpectations[${index}].path`, { allowPrivateForbiddenPath: expectation.kind === "tool-action-forbidden-path" || expectation.kind === "path-not-created" });
      if (["path-changed", "path-unchanged", "tool-action-path"].includes(expectation.kind)) {
        assert.equal(fixturePathExists(fixtureRoot, spec), true, `hard expectation ${expectation.id} must point at an existing fixture path: ${spec}`);
      }
    }
    if (expectation.kind === "public-output-includes-any" || expectation.kind === "public-output-excludes-any") {
      assertStringArray(expectation.terms, `hardExpectations[${index}].terms`, { minLength: 1 });
      assert.ok(expectation.terms.every((term) => term.length <= 120), `hardExpectations[${index}].terms must be bounded`);
      if (expectation.minMatches !== undefined) {
        assert.equal(Number.isInteger(expectation.minMatches), true, `hardExpectations[${index}].minMatches must be an integer`);
        assert.ok(expectation.minMatches >= 1 && expectation.minMatches <= expectation.terms.length, `hardExpectations[${index}].minMatches must be feasible`);
      }
    }
    if (expectation.kind === "tool-action-path") {
      assertStringArray(expectation.verbs, `hardExpectations[${index}].verbs`, { minLength: 1 });
      for (const verb of expectation.verbs) assert.match(verb, /^[A-Za-z][A-Za-z0-9_:-]*$/u, `tool verb must be stable: ${verb}`);
    }
    if (expectation.description !== undefined) assertTrimmedNonEmptyString(expectation.description, `hardExpectations[${index}].description`);
  }
  assert.equal(kinds.has("public-output-not-empty"), true, "hardExpectations must include public-output-not-empty");
  assert.equal([...kinds].some((kind) => kind.startsWith("path-")), true, "hardExpectations must include a path-based check");
  assert.equal(kinds.has("tool-action-forbidden-path") || kinds.has("no-tool-path-outside-workspace"), true, "hardExpectations must include a runner boundary/tool-path hard check");
}

function assertMustAndForbiddenPaths(testCase, fixtureRoot) {
  assert.equal(isObject(testCase.expectedBehavior), true, "expectedBehavior must be an object");
  assertStringArray(testCase.expectedBehavior.mustInspectOrChange, "expectedBehavior.mustInspectOrChange");
  assertStringArray(testCase.expectedBehavior.mustNotTouch, "expectedBehavior.mustNotTouch", { minLength: 1 });
  for (const spec of testCase.expectedBehavior.mustInspectOrChange) {
    assertPathSpec(spec, `expectedBehavior.mustInspectOrChange ${spec}`);
    assert.equal(fixturePathExists(fixtureRoot, spec), true, `expectedBehavior.mustInspectOrChange must point at an existing fixture path: ${spec}`);
  }
  for (const spec of testCase.expectedBehavior.mustNotTouch) assertPathSpec(spec, `expectedBehavior.mustNotTouch ${spec}`, { allowPrivateForbiddenPath: true });
  const forbidden = new Set(testCase.expectedBehavior.mustNotTouch.map((spec) => spec.replace(/\/\*\*$/u, "")));
  for (const spec of testCase.expectedBehavior.mustInspectOrChange) {
    const base = spec.replace(/\/\*\*$/u, "");
    for (const forbiddenSpec of forbidden) {
      assert.equal(hasPathPrefix(base, forbiddenSpec) || hasPathPrefix(forbiddenSpec, base), false, `must path ${spec} conflicts with forbidden path ${forbiddenSpec}`);
    }
  }
}

function assertRubric(testCase) {
  assert.equal(Array.isArray(testCase.humanReviewRubric), true, "humanReviewRubric must be an array");
  assert.ok(testCase.humanReviewRubric.length >= 3, "humanReviewRubric must include at least three criteria");
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
  assertMustAndForbiddenPaths(testCase, fixtureRoot);
  assertHardExpectations(testCase, fixtureRoot);
  assertRubric(testCase);
}

test("behavior case corpus is schema-valid, sourced, safe, and reviewable", () => {
  const files = listCaseFiles();
  assert.ok(files.length >= 8 && files.length <= 10, "behavior eval corpus should contain about eight sourced cases from DOCTOR.md for task #201");
  const ids = new Set();
  const fixtureIds = new Set();
  for (const file of files) {
    assert.match(file, CASE_FILE_PATTERN, `case file name must be kebab-case JSON: ${file}`);
    const testCase = readJson(path.join(CASES_ROOT, file));
    assertCase(testCase, file);
    assert.equal(ids.has(testCase.id), false, `duplicate case id ${testCase.id}`);
    ids.add(testCase.id);
    fixtureIds.add(testCase.fixture);
  }
  assert.ok(fixtureIds.size >= 4, "behavior cases should cover multiple fixtures, not one prompt-only regex fixture");
});

test("behavior eval runner evidence shapes are deterministic contracts", () => {
  const examples = behaviorEvalShapeExamples();
  assertSnapshotRecordShape(examples.snapshot);
  assertToolActionsShape(examples.toolActions);
  assertReceiptRecordShape(examples.receipt);
  assert.equal(examples.receipt.schemaVersion, RUN_RECEIPT_SCHEMA_VERSION);
  assert.equal(examples.receipt.budgets.effectiveMaxBudgetUsd, 0.01);
  assert.equal(examples.receipt.runner.argv[examples.receipt.runner.argv.indexOf("--max-budget-usd") + 1], "0.01");
  assert.equal(examples.receipt.runner.argv.includes("--verbose"), true);
  assert.equal(examples.receipt.runner.permissionMode, "acceptEdits");
  assert.deepEqual(Object.keys(examples.receipt.paths).sort(), ["hardChecks", "publicOutput", "receipt", "runRoot", "snapshotAfter", "snapshotBefore", "snapshotDiff", "stderr", "stream", "toolActions", "workspaceRoot"].sort());
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
  const scratchParent = path.join(ROOT, ".claude", "tmp");
  fs.mkdirSync(scratchParent, { recursive: true });
  const scratch = fs.mkdtempSync(path.join(scratchParent, "behavior-cli-"));
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

test("outside tool paths fail workspace-boundary hard checks", () => {
  const stream = fs.readFileSync(path.join(FIXTURES_ROOT, "claude-stream-json", "outside-tool-path.jsonl"), "utf8");
  const evidence = parseEvidence(stream, ROOT);
  assert.equal(evidence.toolActions.actions.length, 1);
  assert.deepEqual(evidence.toolActions.actions[0].referencedPaths, ["/etc/passwd"]);
  const hardCheck = evaluateHardExpectation({ id: "no-outside", kind: "no-tool-path-outside-workspace" }, {
    before: { entries: [] },
    after: { entries: [] },
    publicOutput: evidence.publicText,
    toolActions: evidence.toolActions,
    workspaceRoot: ROOT
  });
  assert.equal(hardCheck.passed, false);
  assert.deepEqual(hardCheck.evidence.outside, [{ action: 1, path: "/etc/passwd" }]);

  const relativeEscape = evaluateHardExpectation({ id: "no-relative-escape", kind: "no-tool-path-outside-workspace" }, {
    before: { entries: [] },
    after: { entries: [] },
    publicOutput: "ok",
    toolActions: { schemaVersion: "dove.behavior.tool-actions.v1", actions: [{ index: 1, name: "Read", referencedPaths: ["../outside.md"], inputShape: ["file_path"] }] },
    workspaceRoot: ROOT
  });
  assert.equal(relativeEscape.passed, false);
  assert.deepEqual(relativeEscape.evidence.outside, [{ action: 1, path: "../outside.md" }]);
});

test("package scripts expose deterministic validate without releasing the corpus", () => {
  const packageJson = readJson(path.join(ROOT, "package.json"));
  assert.equal(packageJson.scripts?.["behavior:validate"], "node ./evals/behavior/validate.mjs");
  assert.equal(packageJson.scripts?.["behavior:eval"], "node ./evals/behavior/eval.mjs");
  assert.match(packageJson.scripts?.check ?? "", /npm run behavior:validate/u, "npm run check must include behavior:validate");
  assert.doesNotMatch(packageJson.scripts?.["release:check"] ?? "", /behavior:eval/u, "release:check must not run behavior:eval");
  assert.equal(packageJson.files.some((entry) => entry === "evals" || entry.startsWith("evals/")), false, "eval corpus must not be packed via package files inventory");
});
