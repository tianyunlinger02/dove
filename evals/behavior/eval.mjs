#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const BEHAVIOR_CASE_SCHEMA_VERSION = "dove.behavior.case.v1";
export const PROJECT_SNAPSHOT_SCHEMA_VERSION = "dove.behavior.snapshot.v1";
export const TOOL_ACTIONS_SCHEMA_VERSION = "dove.behavior.tool-actions.v1";
export const RUN_RECEIPT_SCHEMA_VERSION = "dove.behavior.run-receipt.v2";
export const HARD_CHECKS_SCHEMA_VERSION = "dove.behavior.hard-checks.v1";

export const SUPPORTED_HARD_EXPECTATION_KINDS = Object.freeze([
  "path-changed",
  "path-exists",
  "path-not-created",
  "path-unchanged",
  "public-output-not-empty"
]);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CASES_ROOT = path.join(ROOT, "evals", "behavior", "cases");
const FIXTURES_ROOT = path.join(ROOT, "evals", "behavior", "fixtures");
const OUTPUT_ROOT = path.join(ROOT, ".claude", "tmp", "dove-behavior-evals");
const KNOWN_EVIDENCE_FILES = Object.freeze([
  "receipt.json",
  "public-output.md",
  "stream.jsonl",
  "stderr.log",
  "tool-actions.json",
  "snapshot-before.json",
  "snapshot-after.json",
  "snapshot-diff.json",
  "hard-checks.json"
]);

function utcNow() {
  return new Date().toISOString();
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function relativePosix(root, target) {
  return path.relative(root, target).split(path.sep).join("/");
}

export function isSafeProjectRelativePathSpec(value) {
  if (typeof value !== "string" || value.trim() !== value || value === "" || value.includes("\0") || value.includes("\\")) return false;
  let candidate = value;
  if (candidate.endsWith("/**")) candidate = candidate.slice(0, -3);
  if (candidate.includes("*")) return false;
  if (candidate.startsWith("/") || candidate === "." || candidate.startsWith("./")) return false;
  const parsed = path.posix.normalize(candidate);
  if (parsed !== candidate || parsed === ".." || parsed.startsWith("../") || parsed.includes("/../")) return false;
  return true;
}

function pathSpecBase(spec) {
  return spec.endsWith("/**") ? spec.slice(0, -3) : spec;
}

function matchesPathSpec(relativePath, spec) {
  const base = pathSpecBase(spec);
  if (spec.endsWith("/**")) return relativePath === base || relativePath.startsWith(`${base}/`);
  return relativePath === base || relativePath.startsWith(`${base}/`);
}

function assertContainedPath(root, target, label) {
  const resolvedRoot = fs.realpathSync.native(root);
  const resolvedTarget = fs.realpathSync.native(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return resolvedTarget;
  throw new Error(`${label} must stay inside ${resolvedRoot}: ${target}`);
}

function assertNoSymlinkTree(root, label) {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`${label} must not contain symbolic links: ${current}`);
    if (!stat.isDirectory()) continue;
    for (const entry of fs.readdirSync(current)) stack.push(path.join(current, entry));
  }
}

function copyFixtureTree(sourceRoot, targetRoot) {
  assertNoSymlinkTree(sourceRoot, "Behavior fixture");
  fs.mkdirSync(targetRoot, { recursive: true });
  const stack = [""];
  while (stack.length > 0) {
    const current = stack.pop();
    const absolute = path.join(sourceRoot, current);
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const relative = current ? path.join(current, entry.name) : entry.name;
      const source = path.join(sourceRoot, relative);
      const target = path.join(targetRoot, relative);
      const stat = fs.lstatSync(source);
      if (stat.isSymbolicLink()) throw new Error(`Behavior fixture must not contain symlinks: ${source}`);
      if (entry.isDirectory()) {
        fs.mkdirSync(target, { recursive: true, mode: stat.mode & 0o7777 });
        stack.push(relative);
      } else if (entry.isFile()) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target);
        fs.chmodSync(target, stat.mode & 0o7777);
      } else {
        throw new Error(`Behavior fixture has unsupported path type: ${source}`);
      }
    }
  }
}

function snapshotEntriesForPath(root, relativePath) {
  const absolute = path.join(root, relativePath);
  let stat;
  try {
    stat = fs.lstatSync(absolute);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const entries = [];
  function visit(currentAbsolute) {
    const currentStat = fs.lstatSync(currentAbsolute);
    const currentRelative = relativePosix(root, currentAbsolute);
    if (currentStat.isSymbolicLink()) {
      entries.push({ path: currentRelative, type: "symlink", target: fs.readlinkSync(currentAbsolute) });
    } else if (currentStat.isDirectory()) {
      entries.push({ path: currentRelative, type: "directory", mode: currentStat.mode & 0o7777 });
      for (const entry of fs.readdirSync(currentAbsolute).sort()) visit(path.join(currentAbsolute, entry));
    } else if (currentStat.isFile()) {
      entries.push({
        path: currentRelative,
        type: "file",
        mode: currentStat.mode & 0o7777,
        size: currentStat.size,
        sha256: sha256(fs.readFileSync(currentAbsolute))
      });
    } else {
      entries.push({ path: currentRelative, type: "other", mode: currentStat.mode & 0o7777 });
    }
  }
  if (stat.isDirectory()) visit(absolute);
  else visit(absolute);
  return entries;
}

export function createSnapshotRecord({ createdAt = utcNow(), rootLabel, include, entries }) {
  return {
    schemaVersion: PROJECT_SNAPSHOT_SCHEMA_VERSION,
    createdAt,
    rootLabel,
    include: [...include],
    entries: [...entries].sort((left, right) => left.path.localeCompare(right.path))
  };
}

function snapshotProject(root, include, rootLabel) {
  const entries = [];
  for (const spec of include) {
    const base = pathSpecBase(spec);
    if (!isSafeProjectRelativePathSpec(spec)) throw new Error(`unsafe snapshot path spec: ${spec}`);
    entries.push(...snapshotEntriesForPath(root, base));
  }
  const unique = new Map();
  for (const entry of entries) unique.set(entry.path, entry);
  return createSnapshotRecord({ rootLabel, include, entries: [...unique.values()] });
}

function digestEntrySet(snapshot, spec) {
  return snapshot.entries
    .filter((entry) => matchesPathSpec(entry.path, spec))
    .map((entry) => JSON.stringify(entry))
    .sort();
}

function snapshotHasPath(snapshot, spec) {
  return snapshot.entries.some((entry) => matchesPathSpec(entry.path, spec));
}

function diffSnapshots(before, after) {
  const beforeMap = new Map(before.entries.map((entry) => [entry.path, entry]));
  const afterMap = new Map(after.entries.map((entry) => [entry.path, entry]));
  const paths = [...new Set([...beforeMap.keys(), ...afterMap.keys()])].sort();
  const added = [];
  const removed = [];
  const changed = [];
  for (const entryPath of paths) {
    const left = beforeMap.get(entryPath);
    const right = afterMap.get(entryPath);
    if (!left) added.push(entryPath);
    else if (!right) removed.push(entryPath);
    else if (JSON.stringify(left) !== JSON.stringify(right)) changed.push(entryPath);
  }
  return { schemaVersion: "dove.behavior.snapshot-diff.v1", added, removed, changed };
}

export function assertSnapshotRecordShape(value) {
  assert.equal(isObject(value), true, "snapshot must be an object");
  assert.equal(value.schemaVersion, PROJECT_SNAPSHOT_SCHEMA_VERSION);
  assert.equal(typeof value.createdAt, "string");
  assert.match(value.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
  assert.equal(typeof value.rootLabel, "string");
  assert.equal(Array.isArray(value.include), true);
  assert.equal(Array.isArray(value.entries), true);
  for (const spec of value.include) assert.equal(isSafeProjectRelativePathSpec(spec), true, `unsafe snapshot include ${spec}`);
  for (const entry of value.entries) {
    assert.equal(isObject(entry), true, "snapshot entry must be an object");
    assert.equal(typeof entry.path, "string");
    assert.equal(isSafeProjectRelativePathSpec(entry.path), true, `unsafe snapshot entry path ${entry.path}`);
    assert.equal(typeof entry.type, "string");
    if (entry.type === "file") {
      assert.equal(Number.isInteger(entry.size), true);
      assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
    }
  }
}

function extractStreamRecords(stdout) {
  const records = [];
  for (const [index, line] of stdout.split(/\r?\n/u).entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch {
      records.push({ type: "plain", line: index + 1, text: line });
    }
  }
  return records;
}

function maybePathStrings(value, results = []) {
  if (typeof value === "string") {
    if (value.includes("/") || value.startsWith(".") || /\.(?:md|tex|json|txt|py|mjs|js|svg|png|pdf|docx|csv)$/iu.test(value)) results.push(value);
    for (const match of value.matchAll(/(?:^|\s|["'`])((?:\.?\.?\/|\.?[A-Za-z0-9_.-]+\/|\/)[^\s"'`<>|;&]+)(?=$|\s|["'`])/gu)) results.push(match[1]);
    return results;
  }
  if (Array.isArray(value)) {
    for (const item of value) maybePathStrings(item, results);
    return results;
  }
  if (!isObject(value)) return results;
  for (const [key, nested] of Object.entries(value)) {
    if (/path|file|glob|cwd|command/iu.test(key) || typeof nested !== "object") maybePathStrings(nested, results);
  }
  return results;
}

function normalizeToolAction(rawAction, workspaceRoot) {
  const referencedPaths = [...new Set(maybePathStrings(rawAction.input).map((value) => {
    if (typeof value !== "string" || value.includes("\0")) return null;
    const normalized = value.split(path.sep).join("/");
    if (path.isAbsolute(value)) {
      const relative = path.relative(workspaceRoot, value).split(path.sep).join("/");
      return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? relative : normalized;
    }
    if (normalized.startsWith("./")) return normalized.slice(2);
    return normalized;
  }).filter(Boolean))].sort();
  return { name: rawAction.name, referencedPaths, inputShape: Object.keys(rawAction.input ?? {}).sort() };
}

export function parseEvidence(stdout, workspaceRoot) {
  const streamRecords = extractStreamRecords(stdout);
  const publicChunks = [];
  const rawToolActions = [];
  for (const record of streamRecords) {
    if (!isObject(record)) continue;
    const isMainAssistant = record.parent_tool_use_id == null;
    if (record.type === "assistant" && record.message?.role === "assistant" && Array.isArray(record.message.content)) {
      const messageText = [];
      // Only direct assistant blocks are evidence; never descend into tool results or thinking.
      for (const block of record.message.content) {
        if (!isObject(block)) continue;
        if (isMainAssistant && block.type === "text" && typeof block.text === "string") messageText.push(block.text);
        if (block.type === "tool_use" && typeof block.name === "string") {
          rawToolActions.push({ name: block.name, input: isObject(block.input) ? block.input : {} });
        }
      }
      const text = messageText.join("\n\n").trim();
      if (text) publicChunks.push(text);
    } else if (isMainAssistant && record.type === "result" && typeof record.result === "string") {
      const text = record.result.trim();
      // Claude repeats the final assistant answer in result; retain result-only answers.
      if (text && text !== publicChunks.at(-1)) publicChunks.push(text);
    }
  }
  const actions = rawToolActions.map((action, index) => ({ index: index + 1, ...normalizeToolAction(action, workspaceRoot) }));
  return {
    streamRecords,
    publicText: publicChunks.join("\n\n"),
    toolActions: { schemaVersion: TOOL_ACTIONS_SCHEMA_VERSION, actions }
  };
}

export function assertToolActionsShape(value) {
  assert.equal(isObject(value), true, "tool actions must be an object");
  assert.equal(value.schemaVersion, TOOL_ACTIONS_SCHEMA_VERSION);
  assert.equal(Array.isArray(value.actions), true);
  for (const action of value.actions) {
    assert.equal(Number.isInteger(action.index), true);
    assert.equal(typeof action.name, "string");
    assert.equal(Array.isArray(action.referencedPaths), true);
    assert.equal(Array.isArray(action.inputShape), true);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function casePrompt(testCase) {
  const command = testCase.surface.entry === "slash-command" ? `${testCase.surface.command}\n\n` : "";
  return `${command}${testCase.surface.prompt}\n`;
}

export function materializedSnapshotInclude(testCase) {
  // Capture the case's selected materials and explicit file expectations.
  const include = new Set([
    ...testCase.snapshot.include,
    ...testCase.expectedBehavior.mustInspectOrChange
  ]);
  for (const expectation of testCase.hardExpectations) {
    if (typeof expectation.path === "string" && isSafeProjectRelativePathSpec(expectation.path)) include.add(expectation.path);
  }
  return [...include].sort();
}

export function evaluateHardExpectation(expectation, context) {
  const { before, after, publicOutput } = context;
  if (expectation.kind === "public-output-not-empty") {
    return { id: expectation.id, kind: expectation.kind, passed: publicOutput.trim().length > 0, evidence: { bytes: Buffer.byteLength(publicOutput) } };
  }
  if (expectation.kind === "path-exists") {
    return { id: expectation.id, kind: expectation.kind, passed: snapshotHasPath(after, expectation.path), evidence: { path: expectation.path } };
  }
  if (expectation.kind === "path-not-created") {
    const existedBefore = snapshotHasPath(before, expectation.path);
    const existsAfter = snapshotHasPath(after, expectation.path);
    return { id: expectation.id, kind: expectation.kind, passed: existedBefore || !existsAfter, evidence: { path: expectation.path, existedBefore, existsAfter } };
  }
  if (expectation.kind === "path-unchanged") {
    const left = digestEntrySet(before, expectation.path);
    const right = digestEntrySet(after, expectation.path);
    const bothMissing = left.length === 0 && right.length === 0;
    const passed = expectation.ifExists === true && bothMissing ? true : JSON.stringify(left) === JSON.stringify(right);
    return { id: expectation.id, kind: expectation.kind, passed, evidence: { path: expectation.path, beforeEntries: left.length, afterEntries: right.length } };
  }
  if (expectation.kind === "path-changed") {
    const left = digestEntrySet(before, expectation.path);
    const right = digestEntrySet(after, expectation.path);
    const passed = left.length > 0 && right.length > 0 && JSON.stringify(left) !== JSON.stringify(right);
    return { id: expectation.id, kind: expectation.kind, passed, evidence: { path: expectation.path, beforeEntries: left.length, afterEntries: right.length } };
  }
  throw new Error(`Unsupported hard expectation kind: ${expectation.kind}`);
}

function evaluateHardExpectations(testCase, context) {
  const checks = testCase.hardExpectations.map((expectation) => evaluateHardExpectation(expectation, context));
  return { schemaVersion: HARD_CHECKS_SCHEMA_VERSION, passed: checks.every((check) => check.passed), checks };
}

export function createReceiptRecord({ runId, testCase, attempt, startedAt, completedAt, runner, paths, init, result, hardChecks, budgetOverrideMaxBudgetUsd = null, effectiveMaxBudgetUsd: actualMaxBudgetUsd = testCase.budgets.maxBudgetUsd }) {
  return {
    schemaVersion: RUN_RECEIPT_SCHEMA_VERSION,
    runId,
    caseId: testCase.id,
    attempt,
    startedAt,
    completedAt,
    surface: testCase.surface,
    budgets: {
      timeoutMs: testCase.budgets.timeoutMs,
      caseMaxBudgetUsd: testCase.budgets.maxBudgetUsd,
      overrideMaxBudgetUsd: budgetOverrideMaxBudgetUsd,
      effectiveMaxBudgetUsd: actualMaxBudgetUsd
    },
    runner: {
      kind: runner.kind,
      permissionMode: runner.permissionMode,
      maxBudgetUsd: runner.maxBudgetUsd
    },
    paths,
    init: {
      git: { status: init.git.status },
      dove: { status: init.dove.status }
    },
    result: {
      status: result.status,
      exitCode: result.exitCode,
      signal: result.signal,
      budgetExceeded: result.budgetExceeded,
      permissionDenials: result.permissionDenials
    },
    hardChecks,
    humanReview: {
      rubric: testCase.humanReviewRubric,
      note: "Scientific quality is not auto-judged. Review public output, tool actions, snapshots, and hard checks manually."
    }
  };
}

export function assertReceiptRecordShape(value) {
  assert.equal(isObject(value), true, "receipt must be an object");
  assert.equal(value.schemaVersion, RUN_RECEIPT_SCHEMA_VERSION);
  assert.equal(typeof value.runId, "string");
  assert.equal(typeof value.caseId, "string");
  assert.equal(Number.isInteger(value.attempt), true);
  assert.equal(typeof value.startedAt, "string");
  assert.equal(typeof value.completedAt, "string");
  assert.equal(isObject(value.surface), true);
  assert.equal(isObject(value.budgets), true);
  assert.equal(Number.isInteger(value.budgets.timeoutMs), true);
  assert.equal(typeof value.budgets.caseMaxBudgetUsd, "number");
  assert.equal(value.budgets.overrideMaxBudgetUsd === null || typeof value.budgets.overrideMaxBudgetUsd === "number", true);
  assert.equal(typeof value.budgets.effectiveMaxBudgetUsd, "number");
  assert.ok(value.budgets.effectiveMaxBudgetUsd <= value.budgets.caseMaxBudgetUsd);
  if (value.budgets.overrideMaxBudgetUsd !== null) assert.ok(value.budgets.effectiveMaxBudgetUsd <= value.budgets.overrideMaxBudgetUsd);
  assert.equal(isObject(value.runner), true);
  assert.equal(value.runner.kind, "claude-code-cli");
  assert.equal(typeof value.runner.permissionMode, "string");
  assert.doesNotMatch(value.runner.permissionMode, /bypass/iu, "runner permission mode must not bypass permissions");
  assert.equal(value.runner.maxBudgetUsd, value.budgets.effectiveMaxBudgetUsd);
  assert.equal(isObject(value.paths), true);
  for (const key of ["runRoot", "workspaceRoot", "stream", "stderr", "publicOutput", "toolActions", "snapshotBefore", "snapshotAfter", "snapshotDiff", "hardChecks", "receipt"]) {
    assert.equal(typeof value.paths[key], "string", `receipt paths.${key} must be a string`);
    const validPath = key === "workspaceRoot"
      ? /^\.claude\/tmp\/w-[A-Za-z0-9]+$/u.test(value.paths[key])
      : value.paths[key].startsWith(".claude/tmp/dove-behavior-evals/") && isSafeProjectRelativePathSpec(value.paths[key]);
    assert.equal(validPath, true, `receipt paths.${key} must stay under its repo-local .claude/tmp root`);
  }
  assert.doesNotMatch(JSON.stringify(Object.keys(value).sort()), /transcript|conversationLog|privateMemory/iu, "receipt must not expose private transcript fields");
  assert.equal(isObject(value.init), true);
  assert.equal(isObject(value.init.git), true);
  assert.equal(isObject(value.init.dove), true);
  assert.equal(typeof value.init.git.status, "string");
  assert.equal(typeof value.init.dove.status, "string");
  assert.equal(isObject(value.result), true);
  assert.ok(["completed", "failed", "incomplete", "skipped"].includes(value.result.status));
  assert.equal(value.result.signal === null || typeof value.result.signal === "string", true);
  assert.equal(value.result.budgetExceeded === null || typeof value.result.budgetExceeded === "boolean", true);
  assert.equal(Array.isArray(value.result.permissionDenials), true);
  assert.equal(isObject(value.hardChecks), true);
  assert.equal(value.hardChecks.schemaVersion, HARD_CHECKS_SCHEMA_VERSION);
  assert.equal(Array.isArray(value.hardChecks.checks), true);
  assert.equal(isObject(value.humanReview), true);
  assert.equal(Array.isArray(value.humanReview.rubric), true);
}

export function behaviorEvalShapeExamples() {
  const snapshot = createSnapshotRecord({
    createdAt: "2026-09-04T00:00:00.000Z",
    rootLabel: "workspace-before",
    include: ["paper/main.tex"],
    entries: [{ path: "paper/main.tex", type: "file", mode: 0o644, size: 12, sha256: "0".repeat(64) }]
  });
  const testCase = {
    id: "shape-example",
    surface: { host: "claude-code", entry: "slash-command", command: "/dove:research", prompt: "Continue." },
    budgets: { timeoutMs: 1000, maxBudgetUsd: 0.01 },
    humanReviewRubric: [{ criterion: "Manual review reads public evidence.", evidence: KNOWN_EVIDENCE_FILES, failureSignals: ["No evidence."] }]
  };
  const receipt = createReceiptRecord({
    runId: "shape-example-attempt-1",
    testCase,
    attempt: 1,
    startedAt: "2026-09-04T00:00:00.000Z",
    completedAt: "2026-09-04T00:00:01.000Z",
    runner: { kind: "claude-code-cli", permissionMode: "acceptEdits", maxBudgetUsd: 0.01 },
    paths: {
      runRoot: ".claude/tmp/dove-behavior-evals/shape-example-attempt-1",
      workspaceRoot: ".claude/tmp/w-example",
      stream: ".claude/tmp/dove-behavior-evals/shape-example-attempt-1/stream.jsonl",
      stderr: ".claude/tmp/dove-behavior-evals/shape-example-attempt-1/stderr.log",
      publicOutput: ".claude/tmp/dove-behavior-evals/shape-example-attempt-1/public-output.md",
      toolActions: ".claude/tmp/dove-behavior-evals/shape-example-attempt-1/tool-actions.json",
      snapshotBefore: ".claude/tmp/dove-behavior-evals/shape-example-attempt-1/snapshot-before.json",
      snapshotAfter: ".claude/tmp/dove-behavior-evals/shape-example-attempt-1/snapshot-after.json",
      snapshotDiff: ".claude/tmp/dove-behavior-evals/shape-example-attempt-1/snapshot-diff.json",
      hardChecks: ".claude/tmp/dove-behavior-evals/shape-example-attempt-1/hard-checks.json",
      receipt: ".claude/tmp/dove-behavior-evals/shape-example-attempt-1/receipt.json"
    },
    init: { git: { status: "skipped", exitCode: 0 }, dove: { status: "skipped", exitCode: 0 } },
    result: { status: "skipped", exitCode: 0, signal: null, budgetExceeded: null, permissionDenials: [] },
    hardChecks: { schemaVersion: HARD_CHECKS_SCHEMA_VERSION, passed: true, checks: [] }
  });
  return { snapshot, toolActions: { schemaVersion: TOOL_ACTIONS_SCHEMA_VERSION, actions: [] }, receipt };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadCases() {
  const files = fs.readdirSync(CASES_ROOT).filter((file) => file.endsWith(".json")).sort();
  return files.map((file) => readJson(path.join(CASES_ROOT, file)));
}

function relativeOutputPath(filePath) {
  return relativePosix(ROOT, filePath);
}

function effectiveMaxBudgetUsd(testCase, options) {
  return options.maxBudgetUsd === null ? testCase.budgets.maxBudgetUsd : Math.min(testCase.budgets.maxBudgetUsd, options.maxBudgetUsd);
}

function addCaseIds(options, rawValue) {
  const values = String(rawValue ?? "").split(",").filter(Boolean);
  if (values.length === 0) throw new Error("--case requires at least one case id.");
  options.caseIds.push(...values);
}

export function parseArgs(argv) {
  const options = {
    runReal: false,
    list: false,
    caseIds: [],
    attempts: 1,
    model: process.env.DOVE_BEHAVIOR_EVAL_MODEL || null,
    claudeCommand: process.env.DOVE_CLAUDE_COMMAND || "claude",
    permissionMode: process.env.DOVE_BEHAVIOR_EVAL_PERMISSION_MODE || "acceptEdits",
    maxBudgetUsd: null,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--run-real") options.runReal = true;
    else if (arg === "--list") options.list = true;
    else if (arg === "--case") addCaseIds(options, argv[++index]);
    else if (arg.startsWith("--case=")) addCaseIds(options, arg.slice("--case=".length));
    else if (arg === "--attempts") options.attempts = Number(argv[++index]);
    else if (arg.startsWith("--attempts=")) options.attempts = Number(arg.slice("--attempts=".length));
    else if (arg === "--model") options.model = String(argv[++index] ?? "");
    else if (arg.startsWith("--model=")) options.model = arg.slice("--model=".length);
    else if (arg === "--claude-command") options.claudeCommand = String(argv[++index] ?? "");
    else if (arg.startsWith("--claude-command=")) options.claudeCommand = arg.slice("--claude-command=".length);
    else if (arg === "--permission-mode") options.permissionMode = String(argv[++index] ?? "");
    else if (arg.startsWith("--permission-mode=")) options.permissionMode = arg.slice("--permission-mode=".length);
    else if (arg === "--max-budget-usd") options.maxBudgetUsd = Number(argv[++index]);
    else if (arg.startsWith("--max-budget-usd=")) options.maxBudgetUsd = Number(arg.slice("--max-budget-usd=".length));
    else throw new Error(`Unknown behavior eval option: ${arg}`);
  }
  if (!Number.isInteger(options.attempts) || options.attempts < 1 || options.attempts > 10) throw new Error("--attempts must be an integer from 1 to 10.");
  if (options.model !== null && (typeof options.model !== "string" || options.model.trim() !== options.model || options.model === "")) throw new Error("--model must be a non-empty trimmed model name when provided.");
  if (typeof options.claudeCommand !== "string" || options.claudeCommand.trim() !== options.claudeCommand || options.claudeCommand === "") throw new Error("--claude-command must be non-empty when provided.");
  if (options.permissionMode !== null && (typeof options.permissionMode !== "string" || options.permissionMode.trim() !== options.permissionMode || options.permissionMode === "")) throw new Error("--permission-mode must be non-empty when provided.");
  if (/bypass/iu.test(options.permissionMode ?? "")) throw new Error("behavior:eval refuses bypass permission modes.");
  if (options.maxBudgetUsd !== null && (!Number.isFinite(options.maxBudgetUsd) || options.maxBudgetUsd <= 0)) throw new Error("--max-budget-usd must be positive when provided.");
  return options;
}

function helpText() {
  return `Dove behavior evaluation runner\n\nUsage:\n  npm run behavior:eval -- [--list]\n  npm run behavior:eval -- --run-real [--case <id>[,<id>]] [--attempts <n>] [--model <name>] [--claude-command <cmd>] [--permission-mode <mode>] [--max-budget-usd <usd>]\n\nDefault behavior is a no-model, no-network skip. Passing --run-real invokes the deployed Claude Code CLI in an initialized Dove fixture project and writes only public evidence under .claude/tmp/dove-behavior-evals/.\nModel defaults to DOVE_BEHAVIOR_EVAL_MODEL when set; otherwise the Claude Code installation default is used. Permission mode defaults to acceptEdits for non-interactive synthetic workspaces; override with DOVE_BEHAVIOR_EVAL_PERMISSION_MODE or --permission-mode.\n--max-budget-usd is a per-attempt cap override; the actual Claude cap is min(case budget, override) and is passed before invocation.\n`;
}

export function createFixtureCliLauncher(runRoot, nodePath = process.execPath, cliPath = path.join(ROOT, "bin", "dove.mjs")) {
  const binRoot = path.join(runRoot, "bin");
  const launcherPath = path.join(binRoot, "dove");
  const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  fs.mkdirSync(binRoot, { recursive: true });
  fs.writeFileSync(launcherPath, `#!/bin/sh\nexec ${shellQuote(nodePath)} ${shellQuote(cliPath)} "$@"\n`, { mode: 0o755, flag: "wx" });
  return launcherPath;
}

function initializeGitBoundary(workspaceRoot) {
  const result = spawnSync("git", ["init", "--quiet", workspaceRoot], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024
  });
  return { status: result.status === 0 ? "initialized" : "failed", exitCode: result.status, signal: result.signal, error: result.error?.message ?? null, stderr: result.stderr ?? "" };
}

function runInit(workspaceRoot) {
  const result = spawnSync(process.execPath, [path.join(ROOT, "bin", "dove.mjs"), "init", "--project", workspaceRoot, "--host", "claude", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  });
  return { status: result.status === 0 ? "initialized" : "failed", exitCode: result.status, signal: result.signal, error: result.error?.message ?? null, stderr: result.stderr ?? "" };
}

export function executionResult(result, streamRecords, maxBudgetUsd) {
  const terminalRecords = streamRecords.filter((record) => isObject(record) && record.type === "result" && record.parent_tool_use_id == null);
  const terminal = terminalRecords.at(-1);
  const terminalCost = terminal?.total_cost_usd;
  const observedCostUsd = typeof terminalCost === "number" && Number.isFinite(terminalCost) && terminalCost >= 0 ? terminalCost : null;
  const budgetExceeded = observedCostUsd === null ? null : observedCostUsd > maxBudgetUsd;
  const streamFailed = terminalRecords.some((record) => record.is_error === true || record.subtype !== "success" || (Array.isArray(record.errors) && record.errors.length > 0));
  const permissionDenials = terminalRecords.flatMap((record) => Array.isArray(record.permission_denials) ? record.permission_denials : []);
  return {
    status: result.error || result.status !== 0 || result.signal || streamFailed || budgetExceeded === true
      ? "failed"
      : !terminal ? "incomplete" : "completed",
    exitCode: result.status,
    signal: result.signal,
    budgetExceeded,
    permissionDenials
  };
}

export function invokeClaude(testCase, options, workspaceRoot, fixtureCliPath, turn = {}) {
  const maxBudgetUsd = turn.maxBudgetUsd ?? effectiveMaxBudgetUsd(testCase, options);
  const argv = ["--print", "--verbose", "--output-format", "stream-json", "--input-format", "text", "--permission-mode", options.permissionMode, "--max-budget-usd", String(maxBudgetUsd)];
  if (options.model) argv.push("--model", options.model);
  if (turn.sessionId) argv.push(turn.resume ? "--resume" : "--session-id", turn.sessionId);
  const startedMs = Date.now();
  const result = spawnSync(options.claudeCommand, argv, {
    cwd: workspaceRoot,
    input: turn.prompt ?? casePrompt(testCase),
    encoding: "utf8",
    timeout: turn.timeoutMs ?? testCase.budgets.timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      NO_COLOR: "1",
      DOVE_BEHAVIOR_EVAL: "1",
      PATH: `${path.dirname(fixtureCliPath)}${path.delimiter}${process.env.PATH ?? ""}`
    }
  });
  return { argv, maxBudgetUsd, result, durationMs: Date.now() - startedMs };
}

export function correctionBudget(firstResult, firstRecords, capUsd, elapsedMs, timeoutMs, sessionId) {
  const outcome = executionResult(firstResult, firstRecords, capUsd);
  const initialized = firstRecords.some((record) => record.type === "system" && record.subtype === "init" && record.session_id === sessionId);
  const firstCost = firstRecords.filter((record) => record.type === "result" && record.parent_tool_use_id == null).at(-1)?.total_cost_usd;
  const remainingMs = timeoutMs - elapsedMs;
  return outcome.status === "completed" && initialized && Number.isFinite(firstCost) && firstCost >= 0 && firstCost < capUsd && remainingMs > 0
    ? { maxBudgetUsd: Number((capUsd - firstCost).toPrecision(12)), timeoutMs: remainingMs, firstCost } : null;
}

export function correctionOutcome(result, records, remainingBudgetUsd, totalBudgetUsd, sessionId) {
  const outcome = executionResult(result, records, remainingBudgetUsd);
  const terminal = records.filter((record) => record.type === "result" && record.parent_tool_use_id == null).at(-1);
  const cost = terminal?.total_cost_usd;
  // A resumed terminal may report cumulative session cost rather than this turn's cost.
  if (Number.isFinite(cost) && cost > remainingBudgetUsd && cost <= totalBudgetUsd
    && terminal?.subtype === "success" && terminal.is_error !== true && !terminal.errors?.length
    && outcome.status === "failed" && result.status === 0) {
    outcome.status = "incomplete";
    outcome.budgetExceeded = null;
  }
  if (outcome.status === "completed" && (!Number.isFinite(cost)
    || !records.some((record) => record.type === "system" && record.subtype === "init" && record.session_id === sessionId)
    || typeof terminal.result !== "string" || !terminal.result.trim())) outcome.status = "incomplete";
  return outcome;
}

function runOneAttempt(testCase, attempt, options) {
  const fixtureRoot = path.join(FIXTURES_ROOT, testCase.fixture);
  assertContainedPath(FIXTURES_ROOT, fixtureRoot, "Behavior fixture");
  assertNoSymlinkTree(fixtureRoot, "Behavior fixture");

  const runId = `${new Date().toISOString().replace(/[:.]/gu, "-")}-${testCase.id}-attempt-${attempt}-${crypto.randomUUID().slice(0, 8)}`;
  // Keep workspace paths short enough for the host's Unix sockets; the receipt carries the descriptive id.
  const runRoot = fs.mkdtempSync(path.join(OUTPUT_ROOT, "r-"));
  const fixtureCliPath = createFixtureCliLauncher(runRoot);
  const workspaceRoot = fs.mkdtempSync(path.join(ROOT, ".claude", "tmp", "w-"));
  copyFixtureTree(fixtureRoot, workspaceRoot);
  const gitInit = initializeGitBoundary(workspaceRoot);
  if (gitInit.status !== "initialized") throw new Error(`Behavior eval failed to initialize an isolated git repository for ${testCase.id}: ${gitInit.stderr || gitInit.error || "unknown git init failure"}`);

  const startedAt = utcNow();
  const init = runInit(workspaceRoot);
  if (init.status !== "initialized") throw new Error(`Dove fixture init failed for ${testCase.id}: ${init.stderr || init.error || "unknown init failure"}`);

  const include = materializedSnapshotInclude(testCase);
  const before = snapshotProject(workspaceRoot, include, "workspace-before");
  assertSnapshotRecordShape(before);
  writeJson(path.join(runRoot, "snapshot-before.json"), before);

  const actualMaxBudgetUsd = effectiveMaxBudgetUsd(testCase, options);
  const sessionId = testCase.surface.correctionPrompt ? crypto.randomUUID() : null;
  const firstStartedMs = Date.now();
  const first = invokeClaude(testCase, options, workspaceRoot, fixtureCliPath, sessionId ? { sessionId } : {});
  let stdout = first.result.stdout ?? "";
  let stderr = first.result.stderr ?? "";
  let result = first.result;
  let outcome = executionResult(result, extractStreamRecords(stdout), actualMaxBudgetUsd);
  let correctionDelivered = false;
  if (sessionId) {
    // The correction is a second user turn in the SAME Claude session, not another fresh attempt.
    const firstRecords = extractStreamRecords(stdout);
    const remaining = correctionBudget(first.result, firstRecords, actualMaxBudgetUsd, Date.now() - firstStartedMs, testCase.budgets.timeoutMs, sessionId);
    if (remaining) {
      writeJson(path.join(runRoot, "snapshot-at-correction.json"), snapshotProject(workspaceRoot, include, "workspace-at-correction"));
      const secondTimeoutMs = testCase.budgets.timeoutMs - (Date.now() - firstStartedMs);
      if (secondTimeoutMs <= 0) outcome.status = "incomplete";
      else {
        writeJson(path.join(runRoot, "correction.json"), { sessionId, prompt: testCase.surface.correctionPrompt, firstCostUsd: remaining.firstCost, remainingBudgetUsd: remaining.maxBudgetUsd, remainingTimeoutMs: secondTimeoutMs });
        const second = invokeClaude(testCase, options, workspaceRoot, fixtureCliPath, {
          sessionId, resume: true, prompt: `${testCase.surface.correctionPrompt}\n`,
          maxBudgetUsd: remaining.maxBudgetUsd, timeoutMs: secondTimeoutMs
        });
        result = second.result;
        correctionDelivered = true;
        stdout += `\n${result.stdout ?? ""}`;
        stderr += `\n${result.stderr ?? ""}`;
        const secondRecords = extractStreamRecords(result.stdout ?? "");
        outcome = correctionOutcome(result, secondRecords, remaining.maxBudgetUsd, actualMaxBudgetUsd, sessionId);
        outcome.permissionDenials = [...executionResult(first.result, firstRecords, actualMaxBudgetUsd).permissionDenials, ...outcome.permissionDenials];
      }
    } else if (outcome.status === "completed") {
      outcome.status = "incomplete"; // No verified session continuation or remaining budget/time.
    }
  }
  writeText(path.join(runRoot, "stream.jsonl"), stdout);
  writeText(path.join(runRoot, "stderr.log"), stderr);

  const evidence = parseEvidence(stdout, workspaceRoot);
  const publicOutput = correctionDelivered ? parseEvidence(result.stdout ?? "", workspaceRoot).publicText : evidence.publicText;
  writeText(path.join(runRoot, "public-output.md"), `${publicOutput}\n`);
  writeJson(path.join(runRoot, "tool-actions.json"), evidence.toolActions);
  assertToolActionsShape(evidence.toolActions);

  const after = snapshotProject(workspaceRoot, include, "workspace-after");
  assertSnapshotRecordShape(after);
  writeJson(path.join(runRoot, "snapshot-after.json"), after);
  const snapshotDiff = diffSnapshots(before, after);
  writeJson(path.join(runRoot, "snapshot-diff.json"), snapshotDiff);

  const hardChecks = evaluateHardExpectations(testCase, { before, after, publicOutput, toolActions: evidence.toolActions, workspaceRoot });
  writeJson(path.join(runRoot, "hard-checks.json"), hardChecks);

  const completedAt = utcNow();
  const receipt = createReceiptRecord({
    runId,
    testCase,
    attempt,
    startedAt,
    completedAt,
    runner: {
      kind: "claude-code-cli",
      permissionMode: options.permissionMode,
      maxBudgetUsd: actualMaxBudgetUsd
    },
    paths: {
      runRoot: relativeOutputPath(runRoot),
      workspaceRoot: relativeOutputPath(workspaceRoot),
      stream: relativeOutputPath(path.join(runRoot, "stream.jsonl")),
      stderr: relativeOutputPath(path.join(runRoot, "stderr.log")),
      publicOutput: relativeOutputPath(path.join(runRoot, "public-output.md")),
      toolActions: relativeOutputPath(path.join(runRoot, "tool-actions.json")),
      snapshotBefore: relativeOutputPath(path.join(runRoot, "snapshot-before.json")),
      snapshotAfter: relativeOutputPath(path.join(runRoot, "snapshot-after.json")),
      snapshotDiff: relativeOutputPath(path.join(runRoot, "snapshot-diff.json")),
      hardChecks: relativeOutputPath(path.join(runRoot, "hard-checks.json")),
      receipt: relativeOutputPath(path.join(runRoot, "receipt.json")),
      ...(correctionDelivered ? {
        correction: relativeOutputPath(path.join(runRoot, "correction.json")),
        snapshotAtCorrection: relativeOutputPath(path.join(runRoot, "snapshot-at-correction.json"))
      } : {})
    },
    init: { git: gitInit, dove: init },
    budgetOverrideMaxBudgetUsd: options.maxBudgetUsd,
    effectiveMaxBudgetUsd: actualMaxBudgetUsd,
    result: outcome,
    hardChecks
  });
  assertReceiptRecordShape(receipt);
  writeJson(path.join(runRoot, "receipt.json"), receipt);
  return receipt;
}

function selectCases(cases, caseIds) {
  if (caseIds.length === 0) return cases;
  const byId = new Map(cases.map((testCase) => [testCase.id, testCase]));
  return caseIds.map((id) => {
    const found = byId.get(id);
    if (!found) throw new Error(`Unknown behavior case: ${id}`);
    return found;
  });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(helpText());
    return;
  }
  const cases = loadCases();
  if (options.list) {
    console.log(JSON.stringify({ status: "listed", cases: cases.map((testCase) => ({ id: testCase.id, title: testCase.title, timeoutMs: testCase.budgets.timeoutMs, maxBudgetUsd: testCase.budgets.maxBudgetUsd })) }, null, 2));
    return;
  }
  const selected = selectCases(cases, options.caseIds);
  if (!options.runReal) {
    console.log(JSON.stringify({
      status: "skipped",
      reason: "behavior:eval requires --run-real to invoke Claude Code/Dove.",
      deterministicAlternative: "npm run behavior:validate",
      outputRoot: relativeOutputPath(OUTPUT_ROOT),
      selectedCases: selected.map((testCase) => testCase.id),
      attempts: options.attempts,
      model: options.model ?? "claude-code-default",
      permissionMode: options.permissionMode,
      budgetOverrideMaxBudgetUsd: options.maxBudgetUsd
    }, null, 2));
    return;
  }
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  const receipts = [];
  for (const testCase of selected) {
    for (let attempt = 1; attempt <= options.attempts; attempt += 1) receipts.push(runOneAttempt(testCase, attempt, options));
  }
  const executionSucceeded = receipts.every((receipt) => receipt.result.status === "completed" && receipt.result.budgetExceeded !== true);
  const hardChecksPassed = receipts.every((receipt) => receipt.hardChecks.passed);
  console.log(JSON.stringify({
    status: executionSucceeded && hardChecksPassed ? "completed" : "failed",
    outputRoot: relativeOutputPath(OUTPUT_ROOT),
    receipts: receipts.map((receipt) => receipt.paths.receipt),
    executionSucceeded,
    hardChecksPassed,
    note: "Only hard checks are reported automatically; inspect the rubric and public evidence manually for research-quality judgments."
  }, null, 2));
  if (!executionSucceeded || !hardChecksPassed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
