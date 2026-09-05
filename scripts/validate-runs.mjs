#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { captureRunGitFacts, normalizeRunGitFacts } from "../src/core/run-environment.mjs";
import { inspectRunStatus, normalizeRunSeed } from "../src/core/run-record.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH_ROOT = path.join(ROOT, ".dove-dev", "tmp");
fs.mkdirSync(SCRATCH_ROOT, { recursive: true });

function cli(args, options = {}) {
  return spawnSync(process.execPath, [path.join(ROOT, "bin", "dove.mjs"), ...args], {
    cwd: options.cwd ?? ROOT,
    encoding: "utf8",
    ...options
  });
}

function jsonCli(args, options = {}) {
  const result = cli(args, options);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  const value = JSON.parse(result.stdout);
  if (args[0] === "run") assertNoPublicDeprecatedRunFields(value, args.join(" "));
  return value;
}

function git(project, args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: project,
    encoding: "utf8",
    shell: false,
    timeout: 10000,
    maxBuffer: 4 * 1024 * 1024,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Dove Validator",
      GIT_AUTHOR_EMAIL: "dove@example.invalid",
      GIT_COMMITTER_NAME: "Dove Validator",
      GIT_COMMITTER_EMAIL: "dove@example.invalid"
    },
    ...options
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function initializeGitSnapshot(project) {
  git(project, ["init", "-q"]);
  git(project, ["add", "-A"]);
  const tree = git(project, ["write-tree"]);
  const commit = git(project, ["commit-tree", tree, "-m", "fixture snapshot"]);
  git(project, ["update-ref", "HEAD", commit]);
  return commit;
}

function refreshGitSnapshot(project) {
  git(project, ["add", "-A"]);
  const tree = git(project, ["write-tree"]);
  const commit = git(project, ["commit-tree", tree, "-p", git(project, ["rev-parse", "HEAD"]), "-m", "fixture snapshot"]);
  git(project, ["update-ref", "HEAD", commit]);
  return commit;
}

function assertNoPublicDeprecatedRunFields(value, label = "public run result") {
  const forbidden = new Set(["environment", "environmentComparison", "environmentFields", "stagedCount", "unstagedCount", "untrackedCount", "porcelainStatusSha256", "lockfiles", "platform"]);
  const visit = (item, trail) => {
    if (Array.isArray(item)) {
      item.forEach((entry, index) => visit(entry, `${trail}[${index}]`));
      return;
    }
    if (item === null || typeof item !== "object") return;
    for (const [key, nested] of Object.entries(item)) {
      assert.equal(forbidden.has(key), false, `${label} must not expose deprecated field ${trail}.${key}`);
      visit(nested, `${trail}.${key}`);
    }
  };
  visit(value, "$ ");
}

function assertNoNewJournalDeprecatedRunFields(event, label = "run.started") {
  for (const key of ["environment", "platform", "stagedCount", "unstagedCount", "untrackedCount", "porcelainStatusSha256", "lockfiles"]) {
    assert.equal(Object.hasOwn(event, key), false, `${label} must not record ${key}`);
  }
}

function readStartedEvent(project, runId) {
  return readJsonLines(runPath(project, runId, "run.jsonl")).find((event) => event.type === "run.started");
}

function readJsonLines(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  assert.ok(text.endsWith("\n"), `${filePath} must be newline terminated`);
  return text.trimEnd().split("\n").map((line) => JSON.parse(line));
}

function assertJournal(project, runId, options = {}) {
  const journal = path.join(project, ".dove", "runs", runId, "run.jsonl");
  const events = readJsonLines(journal);
  events.forEach((event, index) => {
    assert.equal(event.schemaVersion, "dove.run.event.v1");
    assert.equal(event.seq, index + 1);
    assert.equal(event.runId, runId);
    assert.match(event.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
  });
  assert.equal(events.filter((event) => event.type === "run.terminal").length, options.allowNoTerminal === true ? 0 : 1, `${runId} must have exactly one run.terminal event`);
  return events;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function waitForTerminal(project, runId) {
  let last = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    last = jsonCli(["run", "status", "--project", project, "--id", runId, "--json"]);
    if (last.terminal) return last;
    sleep(50);
  }
  throw new Error(`run ${runId} did not become terminal; last status ${JSON.stringify(last)}`);
}

function fileState(filePath) {
  const stat = fs.statSync(filePath);
  return { bytes: stat.size, mtimeMs: stat.mtimeMs };
}

function assertFileStateEqual(left, right, label) {
  assert.equal(left.bytes, right.bytes, `${label} bytes changed`);
  assert.equal(left.mtimeMs, right.mtimeMs, `${label} mtime changed`);
}

function writeScript(filePath, source) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source);
  fs.chmodSync(filePath, 0o755);
}

function runPath(project, runId, fileName) {
  return path.join(project, ".dove", "runs", runId, fileName);
}

function findUnobservedPid() {
  for (const candidate of [2_147_000_000, 1_900_000_000, 1_500_000_000, 1_000_000_000, 500_000_000, 100_000_000]) {
    try {
      process.kill(candidate, 0);
    } catch (error) {
      if (error?.code === "ESRCH") return candidate;
    }
  }
  for (let candidate = process.pid + 10_000; candidate < process.pid + 20_000; candidate += 1) {
    try {
      process.kill(candidate, 0);
    } catch (error) {
      if (error?.code === "ESRCH") return candidate;
    }
  }
  throw new Error("could not find a non-observable PID for run resume validation");
}

function writeManualRunJournal(project, runId, events) {
  const manualDir = path.join(project, ".dove", "runs", runId);
  fs.mkdirSync(manualDir, { recursive: true });
  fs.writeFileSync(path.join(manualDir, "stdout.log"), "", { mode: 0o600 });
  fs.writeFileSync(path.join(manualDir, "stderr.log"), "", { mode: 0o600 });
  fs.writeFileSync(path.join(manualDir, "run.jsonl"), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, { mode: 0o600 });
  return manualDir;
}

function startRun(project, runId, extraArgs, commandArgs, options = {}) {
  return jsonCli(["run", "start", "--project", project, "--id", runId, ...extraArgs, "--json", "--", ...commandArgs], options);
}

function finalize(project, runId, metricValue, extra = []) {
  return jsonCli(["run", "finalize", "--project", project, "--id", runId, "--metric-value", String(metricValue), ...extra, "--json"]);
}

const tempRoot = fs.mkdtempSync(path.join(SCRATCH_ROOT, "dove-runs-"));
const cleanupProcessGroups = [];
try {
  const project = path.join(tempRoot, "project");
  fs.mkdirSync(project, { recursive: true });
  fs.mkdirSync(path.join(project, ".git"));
  const init = jsonCli(["init", "--project", project, "--host", "claude", "--json"]);
  assert.equal(init.status, "initialized");
  fs.writeFileSync(path.join(project, "package-lock.json"), "{\"lockfileVersion\":3}\n");

  const invalidStart = cli(["run", "start", "--project", project, "--id", "invalid-start", "--metric-name", "score", "--direction", "mean", "--json", "--", process.execPath, "-e", "process.exit(0)"]);
  assert.notEqual(invalidStart.status, 0);
  assert.match(invalidStart.stderr, /--direction 只接受 min 或 max|--direction accepts only min or max|--direction min or --direction max/iu);
  assert.equal(fs.existsSync(path.join(project, ".dove", "runs", "invalid-start")), false, "invalid run start options must not reserve a run directory");

  const invalidSeed = cli(["run", "start", "--project", project, "--id", "invalid-seed", "--seed", "line\nbreak", "--json", "--", process.execPath, "-e", "process.exit(0)"]);
  assert.notEqual(invalidSeed.status, 0);
  assert.match(invalidSeed.stderr, /--seed.*control characters/iu);
  assert.equal(fs.existsSync(path.join(project, ".dove", "runs", "invalid-seed")), false, "invalid seed must not reserve a run directory");

  const successScript = path.join(project, "scripts", "success.mjs");
  writeScript(successScript, `process.stdout.write("success out\\n"); process.stderr.write("success err\\n"); process.exit(0);\n`);
  const cleanHead = initializeGitSnapshot(project);
  const success = startRun(project, "success-a", [
    "--group", "compatible",
    "--metric-name", "score",
    "--direction", "max",
    "--metric-unit", "points",
    "--data", "fixture-v1",
    "--evaluator", "validator",
    "--resource-basis", "cpu-local",
    "--seed", "seed-42",
    "--timeout-ms", "5000"
  ], [process.execPath, successScript, "--literal", "--not-a-dove-option"]);
  assert.equal(success.status, "started");
  assert.deepEqual(success.seed, { declaration: "declared", value: "seed-42" });
  assert.equal(success.commit, cleanHead);
  assert.equal(success.dirty, false);
  assert.deepEqual(success.argv.slice(-3), [successScript, "--literal", "--not-a-dove-option"]);
  const successStatus = waitForTerminal(project, "success-a");
  assert.equal(successStatus.status, "succeeded");
  assert.equal(successStatus.exitCode, 0);
  assert.equal(fs.readFileSync(runPath(project, "success-a", "stdout.log"), "utf8"), "success out\n");
  assert.equal(fs.readFileSync(runPath(project, "success-a", "stderr.log"), "utf8"), "success err\n");
  const successEvents = assertJournal(project, "success-a");
  assert.deepEqual(successEvents.map((event) => event.type), ["run.started", "target.started", "run.terminal"]);
  assert.equal(successEvents[0].argv.includes("--not-a-dove-option"), true);
  assert.deepEqual(successEvents[0].seed, { declaration: "declared", value: "seed-42" }, "run.started must preserve the explicitly supplied seed value without claiming target use");
  assert.equal(successEvents[0].commit, cleanHead);
  assert.equal(successEvents[0].dirty, false);
  assertNoNewJournalDeprecatedRunFields(successEvents[0]);

  const statusJournal = runPath(project, "success-a", "run.jsonl");
  const beforeStatus = fileState(statusJournal);
  const singleStatus = jsonCli(["run", "status", "--project", project, "--id", "success-a", "--json"]);
  assert.equal(singleStatus.status, "succeeded");
  assert.equal(singleStatus.commit, cleanHead);
  assert.equal(singleStatus.dirty, false);
  assert.equal(singleStatus.timeoutTriggered, false);
  assert.equal(Object.hasOwn(singleStatus, "timeoutRequested"), false);
  assertFileStateEqual(fileState(statusJournal), beforeStatus, "status must be read-only");
  const ambiguousStatus = cli(["run", "status", "--project", project, "--id", "success-a", "--group", "compatible", "--json"]);
  assert.notEqual(ambiguousStatus.status, 0);
  assert.match(ambiguousStatus.stderr, /(?:--id 不能和 --group|--group 不能和 --id) 同时使用|Use only one of --id or --group|cannot be combined/iu);
  assertFileStateEqual(fileState(statusJournal), beforeStatus, "ambiguous status must be zero-write");

  const beforeResume = fileState(statusJournal);
  const terminalResume = jsonCli(["run", "resume", "--project", project, "--id", "success-a", "--json"]);
  assert.equal(terminalResume.status, "terminal");
  assert.equal(terminalResume.write, false);
  assertFileStateEqual(fileState(statusJournal), beforeResume, "terminal resume must be zero-write");

  fs.writeFileSync(path.join(project, "tracked-dirty.txt"), "base\n");
  const dirtyBaseHead = refreshGitSnapshot(project);
  fs.appendFileSync(path.join(project, "tracked-dirty.txt"), "unstaged\n");
  fs.writeFileSync(path.join(project, "staged-dirty.txt"), "staged\n");
  git(project, ["add", "staged-dirty.txt"]);
  fs.writeFileSync(path.join(project, "untracked-dirty.txt"), "untracked\n");
  const dirtyRun = startRun(project, "dirty-environment", [], [process.execPath, successScript]);
  assert.equal(dirtyRun.status, "started");
  assert.deepEqual(dirtyRun.seed, { declaration: "not-declared", value: null });
  assert.equal(dirtyRun.commit, dirtyBaseHead);
  assert.equal(dirtyRun.dirty, true);
  waitForTerminal(project, "dirty-environment");
  const dirtyStarted = readStartedEvent(project, "dirty-environment");
  assert.equal(dirtyStarted.commit, dirtyBaseHead);
  assert.equal(dirtyStarted.dirty, true);
  assertNoNewJournalDeprecatedRunFields(dirtyStarted, "dirty run.started");

  const gitUnavailableRun = startRun(project, "git-unavailable", [], [process.execPath, successScript], { env: { ...process.env, PATH: "" } });
  assert.equal(gitUnavailableRun.status, "started");
  assert.equal(gitUnavailableRun.commit, null);
  assert.equal(gitUnavailableRun.dirty, null);
  waitForTerminal(project, "git-unavailable");

  const captureErrorGit = captureRunGitFacts("bad\0project");
  assert.deepEqual(captureErrorGit, { commit: null, dirty: null });

  const nonGitProject = path.join(tempRoot, "non-git-project");
  fs.mkdirSync(nonGitProject, { recursive: true });
  fs.writeFileSync(path.join(nonGitProject, ".git"), "not-a-gitdir\n");
  const nonGitInit = jsonCli(["init", "--project", nonGitProject, "--host", "claude", "--json"]);
  assert.equal(nonGitInit.status, "initialized");
  const nonGitRun = startRun(nonGitProject, "non-git-environment", [], [process.execPath, "-e", "process.exit(0)"]);
  assert.equal(nonGitRun.status, "started");
  assert.equal(nonGitRun.commit, null);
  assert.equal(nonGitRun.dirty, null);
  waitForTerminal(nonGitProject, "non-git-environment");

  const failScript = path.join(project, "scripts", "fail.mjs");
  writeScript(failScript, `process.stdout.write("fail out\\n"); process.stderr.write("fail err\\n"); process.exit(7);\n`);
  startRun(project, "failure-a", ["--timeout-ms", "5000"], [process.execPath, failScript]);
  const failureStatus = waitForTerminal(project, "failure-a");
  assert.equal(failureStatus.status, "failed");
  assert.equal(failureStatus.exitCode, 7);
  assert.equal(fs.readFileSync(runPath(project, "failure-a", "stdout.log"), "utf8"), "fail out\n");
  assert.equal(fs.readFileSync(runPath(project, "failure-a", "stderr.log"), "utf8"), "fail err\n");
  assertJournal(project, "failure-a");

  startRun(project, "launch-failed-a", [], [path.join(project, "does-not-exist-command")]);
  const launchFailedStatus = waitForTerminal(project, "launch-failed-a");
  assert.equal(launchFailedStatus.status, "launch-failed");
  assertJournal(project, "launch-failed-a");

  const timeoutScript = path.join(project, "scripts", "timeout.mjs");
  writeScript(timeoutScript, `process.stdout.write("timeout start\\n"); setInterval(() => {}, 1000);\n`);
  startRun(project, "active-a", ["--timeout-ms", "1000", "--kill-grace-ms", "50"], [process.execPath, timeoutScript]);
  let activeStatus = null;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    activeStatus = jsonCli(["run", "status", "--project", project, "--id", "active-a", "--json"]);
    if (!activeStatus.terminal && activeStatus.status === "running") break;
    sleep(20);
  }
  assert.equal(activeStatus.status, "running");
  if (process.platform !== "win32") {
    const ps = spawnSync("ps", ["-p", String(activeStatus.supervisorPid), "-o", "args="], { encoding: "utf8" });
    assert.equal(ps.status, 0, ps.stderr || ps.stdout);
    assert.match(ps.stdout, /__dove-run-supervisor/u);
    assert.doesNotMatch(ps.stdout, /__dove-run-supervisor\s+[A-Za-z0-9_-]{40,}/u, "hidden supervisor must not expose a base64url payload in the process argv");
  }
  const activeJournal = runPath(project, "active-a", "run.jsonl");
  const activeBeforeResume = fileState(activeJournal);
  const activeResume = jsonCli(["run", "resume", "--project", project, "--id", "active-a", "--json"]);
  assert.equal(activeResume.status, "active");
  assert.equal(activeResume.write, false);
  assertFileStateEqual(fileState(activeJournal), activeBeforeResume, "active resume must be zero-write");
  waitForTerminal(project, "active-a");

  startRun(project, "timeout-a", ["--timeout-ms", "200", "--kill-grace-ms", "50"], [process.execPath, timeoutScript]);
  const timeoutStatus = waitForTerminal(project, "timeout-a");
  assert.equal(timeoutStatus.status, "timed-out");
  assert.equal(timeoutStatus.timeoutTriggered, true);
  assert.equal(Object.hasOwn(timeoutStatus, "timeoutRequested"), false);
  const timeoutEvents = assertJournal(project, "timeout-a");
  assert.equal(timeoutEvents.some((event) => event.type === "timeout.requested"), true);
  assert.match(fs.readFileSync(runPath(project, "timeout-a", "stdout.log"), "utf8"), /timeout start/u);

  if (process.platform !== "win32") {
    const pgScript = path.join(project, "scripts", "pg-parent.mjs");
    const marker = path.join(project, "pg-child-marker.txt");
    writeScript(pgScript, `
      import { spawn } from "node:child_process";
      import fs from "node:fs";
      const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
      fs.writeFileSync(${JSON.stringify(marker)}, String(child.pid));
      setInterval(() => {}, 1000);
    `);
    startRun(project, "timeout-pg", ["--timeout-ms", "200", "--kill-grace-ms", "100"], [process.execPath, pgScript]);
    const pgStatus = waitForTerminal(project, "timeout-pg");
    assert.equal(pgStatus.status, "timed-out");
    const childPid = Number(fs.readFileSync(marker, "utf8"));
    sleep(200);
    try {
      process.kill(childPid, 0);
      throw new Error(`POSIX process-group child ${childPid} still appears alive`);
    } catch (error) {
      assert.equal(error.code, "ESRCH");
    }
  }

  const compatibleScript = path.join(project, "scripts", "compatible.mjs");
  writeScript(compatibleScript, `process.exit(0);\n`);
  startRun(project, "success-b", [
    "--group", "compatible",
    "--metric-name", "score",
    "--direction", "max",
    "--metric-unit", "points",
    "--data", "fixture-v1",
    "--evaluator", "validator",
    "--resource-basis", "cpu-local",
    "--timeout-ms", "5000"
  ], [process.execPath, compatibleScript]);
  waitForTerminal(project, "success-b");
  const finalizedA = finalize(project, "success-a", 10, ["--decision", "keep-a", "--note", "scalar metric only"]);
  const finalizedB = finalize(project, "success-b", 12);
  assert.equal(finalizedA.event.metric.value, 10);
  assert.equal(finalizedB.event.metric.value, 12);
  const duplicateFinalize = cli(["run", "finalize", "--project", project, "--id", "success-a", "--metric-value", "10", "--json"]);
  assert.notEqual(duplicateFinalize.status, 0);
  assert.match(duplicateFinalize.stderr, /already finalized/iu);
  const compareCompatible = jsonCli(["run", "compare", "--project", project, "--group", "compatible", "--json"]);
  assert.equal(compareCompatible.comparable, true, "Git commit/dirty differences must not affect metric comparability");
  assert.deepEqual(compareCompatible.ranking.map((item) => item.runId), ["success-b", "success-a"]);
  assert.equal(compareCompatible.ranking[1].deltaFromBest, 2);
  for (const item of compareCompatible.ranking) {
    const started = readStartedEvent(project, item.runId);
    assert.equal(item.commit, started.commit, "ranking must preserve the run's commit fact");
    assert.equal(item.dirty, started.dirty, "ranking must preserve the run's dirty fact");
  }
  const ambiguousCompare = cli(["run", "compare", "--project", project, "--id", "success-a", "--group", "compatible", "--json"]);
  assert.notEqual(ambiguousCompare.status, 0);
  assert.match(ambiguousCompare.stderr, /(?:--id 不能和 --group|--group 不能和 --id) 同时使用|Use only one of --id or --group|cannot be combined/iu);

  startRun(project, "basis-mismatch", [
    "--group", "compatible",
    "--metric-name", "score",
    "--direction", "max",
    "--metric-unit", "points",
    "--data", "fixture-v2",
    "--evaluator", "validator",
    "--resource-basis", "cpu-local",
    "--timeout-ms", "5000"
  ], [process.execPath, compatibleScript]);
  waitForTerminal(project, "basis-mismatch");
  finalize(project, "basis-mismatch", 99);
  const compareMismatch = jsonCli(["run", "compare", "--project", project, "--group", "compatible", "--json"]);
  assert.equal(compareMismatch.comparable, false);
  assert.equal(compareMismatch.fields.includes("data"), true);
  assert.equal(Object.hasOwn(compareMismatch, "ranking"), false);

  const missingPid = findUnobservedPid();
  const manualDir = writeManualRunJournal(project, "manual-interrupt", [{
    schemaVersion: "dove.run.event.v1",
    seq: 1,
    at: "2026-09-02T00:00:00.000Z",
    type: "run.started",
    runId: "manual-interrupt",
    argv: [process.execPath, "-e", "process.exit(0)"],
    cwd: project,
    group: null,
    budget: { timeoutMs: null, killGraceMs: 5000 },
    metric: { name: "score", direction: "max", unit: null },
    data: null,
    evaluator: null,
    resourceBasis: null,
    environment: {
      git: {
        fullHead: dirtyBaseHead,
        dirty: true,
        stagedCount: 9,
        unstagedCount: 8,
        untrackedCount: 7,
        porcelainStatusSha256: "a".repeat(64)
      },
      lockfiles: { fingerprints: [{ path: "package-lock.json", size: 1, sha256: "b".repeat(64) }] }
    },
    platform: { platform: process.platform, arch: process.arch, node: process.version, release: "manual" },
    supervisorPid: missingPid,
    timeout: { requested: false, timeoutMs: null, killGraceMs: 5000, scope: "manual", note: "manual fixture" }
  }]);
  const beforeManual = readJsonLines(path.join(manualDir, "run.jsonl")).length;
  const reconciled = jsonCli(["run", "resume", "--project", project, "--id", "manual-interrupt", "--json"]);
  assert.equal(reconciled.status, "interrupted");
  assert.equal(reconciled.write, true);
  assert.equal(reconciled.run.commit, dirtyBaseHead);
  assert.equal(reconciled.run.dirty, true);
  const compareOldRecord = jsonCli(["run", "compare", "--project", project, "--id", "manual-interrupt", "--json"]);
  assert.equal(compareOldRecord.comparable, false);
  assert.deepEqual(compareOldRecord.fields, ["state"]);
  const manualEvents = readJsonLines(path.join(manualDir, "run.jsonl"));
  assert.equal(manualEvents.length, beforeManual + 1);
  assert.equal(manualEvents.at(-1).type, "run.reconciled");
  assert.equal(manualEvents.at(-1).terminal, true);
  const beforeManualTerminalResume = fileState(path.join(manualDir, "run.jsonl"));
  const reconciledAgain = jsonCli(["run", "resume", "--project", project, "--id", "manual-interrupt", "--json"]);
  assert.equal(reconciledAgain.status, "terminal");
  assert.equal(reconciledAgain.write, false);
  assertFileStateEqual(fileState(path.join(manualDir, "run.jsonl")), beforeManualTerminalResume, "reconciled terminal resume must be zero-write");

  let orphanPid = null;
  let orphanProc = null;
  if (process.platform !== "win32") {
    orphanProc = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: "ignore" });
    orphanPid = orphanProc.pid;
    cleanupProcessGroups.push(orphanPid);
    orphanProc.unref();
    const orphanDir = path.join(project, ".dove", "runs", "manual-orphaned");
    fs.mkdirSync(orphanDir, { recursive: true });
    fs.writeFileSync(path.join(orphanDir, "stdout.log"), "");
    fs.writeFileSync(path.join(orphanDir, "stderr.log"), "");
    fs.writeFileSync(path.join(orphanDir, "run.jsonl"), `${JSON.stringify({
      schemaVersion: "dove.run.event.v1",
      seq: 1,
      at: "2026-09-02T00:00:00.000Z",
      type: "run.started",
      runId: "manual-orphaned",
      argv: [process.execPath, "-e", "setInterval(() => {}, 1000)"],
      cwd: project,
      group: null,
      budget: { timeoutMs: null, killGraceMs: 5000 },
      metric: { name: null, direction: null, unit: null },
      data: null,
      evaluator: null,
      resourceBasis: null,
      platform: { platform: process.platform, arch: process.arch, node: process.version, release: "manual" },
      supervisorPid: findUnobservedPid(),
      timeout: { requested: false, timeoutMs: null, killGraceMs: 5000, scope: "manual", note: "manual fixture" }
    })}\n${JSON.stringify({
      schemaVersion: "dove.run.event.v1",
      seq: 2,
      at: "2026-09-02T00:00:01.000Z",
      type: "target.started",
      runId: "manual-orphaned",
      targetPid: orphanPid,
      targetProcessGroup: orphanPid,
      supervisorPid: findUnobservedPid(),
      stdoutPath: ".dove/runs/manual-orphaned/stdout.log",
      stderrPath: ".dove/runs/manual-orphaned/stderr.log",
      termination: { scope: "manual", note: "manual fixture" }
    })}\n`);
    const orphanBefore = fileState(path.join(orphanDir, "run.jsonl"));
    const orphaned = jsonCli(["run", "resume", "--project", project, "--id", "manual-orphaned", "--json"]);
    assert.equal(orphaned.status, "orphaned");
    assert.equal(orphaned.write, false);
    assertFileStateEqual(fileState(path.join(orphanDir, "run.jsonl")), orphanBefore, "orphaned resume must be zero-write");
    try { process.kill(-orphanPid, "SIGKILL"); } catch {}
    cleanupProcessGroups.pop();
  }

  const staleLockDir = writeManualRunJournal(project, "manual-stale-lock", [{
    schemaVersion: "dove.run.event.v1",
    seq: 1,
    at: "2026-09-02T00:00:00.000Z",
    type: "run.started",
    runId: "manual-stale-lock",
    argv: [process.execPath, "-e", "process.exit(0)"],
    cwd: project,
    group: null,
    budget: { timeoutMs: null, killGraceMs: 5000 },
    metric: { name: null, direction: null, unit: null },
    data: null,
    evaluator: null,
    resourceBasis: null,
    platform: { platform: process.platform, arch: process.arch, node: process.version, release: "manual" },
    supervisorPid: findUnobservedPid(),
    timeout: { requested: false, timeoutMs: null, killGraceMs: 5000, scope: "manual", note: "manual fixture" }
  }]);
  const staleLock = path.join(staleLockDir, ".journal.lock");
  fs.mkdirSync(staleLock, { mode: 0o700 });
  fs.writeFileSync(path.join(staleLock, "owner.json"), `${JSON.stringify({ schemaVersion: "dove.run.lock.v1", runId: "manual-stale-lock", pid: findUnobservedPid(), token: "stale", createdAt: "2026-09-02T00:00:00.000Z", operation: "manual-fixture" })}\n`, { mode: 0o600 });
  const staleReconciled = jsonCli(["run", "resume", "--project", project, "--id", "manual-stale-lock", "--json"]);
  assert.equal(staleReconciled.status, "interrupted");
  assert.equal(fs.existsSync(staleLock), false, "stale journal lock must be removed after safe owner check");

  const liveLockDir = writeManualRunJournal(project, "manual-live-lock", [{
    schemaVersion: "dove.run.event.v1",
    seq: 1,
    at: "2026-09-02T00:00:00.000Z",
    type: "run.started",
    runId: "manual-live-lock",
    argv: [process.execPath, "-e", "process.exit(0)"],
    cwd: project,
    group: null,
    budget: { timeoutMs: null, killGraceMs: 5000 },
    metric: { name: null, direction: null, unit: null },
    data: null,
    evaluator: null,
    resourceBasis: null,
    platform: { platform: process.platform, arch: process.arch, node: process.version, release: "manual" },
    supervisorPid: findUnobservedPid(),
    timeout: { requested: false, timeoutMs: null, killGraceMs: 5000, scope: "manual", note: "manual fixture" }
  }]);
  const liveLock = path.join(liveLockDir, ".journal.lock");
  fs.mkdirSync(liveLock, { mode: 0o700 });
  fs.writeFileSync(path.join(liveLock, "owner.json"), `${JSON.stringify({ schemaVersion: "dove.run.lock.v1", runId: "manual-live-lock", pid: process.pid, token: "live", createdAt: new Date().toISOString(), operation: "manual-fixture" })}\n`, { mode: 0o600 });
  const liveLocked = cli(["run", "resume", "--project", project, "--id", "manual-live-lock", "--json"]);
  assert.notEqual(liveLocked.status, 0);
  assert.match(liveLocked.stderr, /active journal writer lock|observable pid/iu);
  assert.equal(fs.existsSync(liveLock), true, "observable live journal lock must not be deleted");
  fs.rmSync(liveLock, { recursive: true, force: true });

  const hidden = cli(["__dove-run-supervisor", "not-a-public-command"]);
  assert.notEqual(hidden.status, 0);
  assert.doesNotMatch(hidden.stderr, /Usage:/u);

  console.log(JSON.stringify({ status: "passed" }, null, 2));
} finally {
  for (const pid of cleanupProcessGroups) {
    try { process.kill(-pid, "SIGKILL"); } catch {}
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
