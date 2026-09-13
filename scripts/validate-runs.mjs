#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { captureRunGitFacts, normalizeRunGitFacts } from "../src/core/run-environment.mjs";
import { appendFinalizedRun, appendRunEvent, compareRuns, inspectRunStatus, normalizeRunBudget, normalizeRunSeed, parseWallTime } from "../src/core/run-record.mjs";
import { resumeRun } from "../src/core/run-supervisor.mjs";
import * as publicCore from "../src/core/index.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH_ROOT = path.join(ROOT, ".claude", "tmp");
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

function waitForCondition(check, label, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    sleep(25);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function processRunning(pid) {
  const result = spawnSync("ps", ["-p", String(pid), "-o", "stat="], { encoding: "utf8" });
  if (result.status === 1 && result.stdout.trim() === "") return false;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  // A terminated orphan may briefly remain a zombie until its adopter reaps it.
  return !result.stdout.trim().startsWith("Z");
}

function validateRunTimeouts(project) {
  const maxDelay = 2_147_483_647;
  assert.deepEqual(normalizeRunBudget(), { timeoutMs: null, killGraceMs: 5000 });
  assert.deepEqual(normalizeRunBudget({ timeoutMs: 1, killGraceMs: 0 }), { timeoutMs: 1, killGraceMs: 0 });
  assert.deepEqual(normalizeRunBudget({ timeoutMs: maxDelay, killGraceMs: maxDelay }), { timeoutMs: maxDelay, killGraceMs: maxDelay });
  assert.equal(parseWallTime(`${maxDelay}ms`), maxDelay);
  assert.throws(() => normalizeRunBudget({ timeoutMs: maxDelay + 1 }), /--timeout-ms.*2147483647/u);
  assert.throws(() => normalizeRunBudget({ killGraceMs: maxDelay + 1 }), /--kill-grace-ms.*2147483647/u);
  assert.throws(() => parseWallTime(`${maxDelay + 1}ms`), /--wall-time.*2147483647/u);

  for (const [index, [flag, value]] of [
    ["--timeout-ms", "2147483648"],
    ["--kill-grace-ms", "2147483648"],
    ["--wall-time", "2147483648ms"],
    ["--wall-time", "2147484s"],
    ["--wall-time", "35792m"],
    ["--wall-time", "597h"]
  ].entries()) {
    const id = `invalid-timer-${index}`;
    const runsRoot = path.join(project, ".dove", "runs");
    const before = fs.existsSync(runsRoot) ? fs.readdirSync(runsRoot) : null;
    const marker = path.join(project, `${id}.executed`);
    const result = cli(["run", "start", "--project", project, "--id", id, flag, value, "--json", "--", process.execPath, "-e", `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'unexpected')`]);
    assert.notEqual(result.status, 0, `${flag} ${value} must be rejected`);
    assert.equal(result.stdout, "");
    const failure = JSON.parse(result.stderr);
    assert.equal(failure.status, "blocked");
    assert.ok(failure.message.includes(flag), failure.message);
    assert.match(failure.message, /2147483647.*Node\.js timer limit/u);
    assert.equal(fs.existsSync(marker), false, "invalid duration must not execute the target");
    assert.deepEqual(fs.existsSync(runsRoot) ? fs.readdirSync(runsRoot) : null, before, "invalid duration must not create a Run or runs root");
  }

  for (const flag of ["--timeout-ms", "--wall-time"]) {
    const id = flag === "--timeout-ms" ? "max-timeout" : "max-wall-time";
    const started = startRun(project, id, [flag, String(maxDelay), "--kill-grace-ms", String(maxDelay)], [process.execPath, "-e", "setTimeout(() => process.exit(0), 150)"]);
    assert.deepEqual(started.budget, { timeoutMs: maxDelay, killGraceMs: maxDelay });
    const status = waitForTerminal(project, id);
    assert.equal(status.status, "succeeded");
    assert.equal(status.timeoutTriggered, false);
    assert.deepEqual(status.budget, started.budget);
    const events = assertJournal(project, id);
    assert.deepEqual(events.map((event) => event.type), ["run.started", "target.started", "run.terminal"]);
    assert.deepEqual(events[0].budget, started.budget);
  }

  for (const [id, argv, expectedStatus, exitCode] of [
    ["timer-normal-failure", [process.execPath, "-e", "process.exit(7)"], "failed", 7],
    ["timer-launch-failure", [path.join(project, "missing-timeout-command")], "launch-failed", null]
  ]) {
    startRun(project, id, ["--timeout-ms", "1000"], argv);
    const status = waitForTerminal(project, id);
    assert.equal(status.status, expectedStatus);
    assert.equal(status.exitCode, exitCode);
    assert.equal(status.timeoutTriggered, false);
    assertJournal(project, id);
  }

  if (process.platform === "win32") {
    startRun(project, "timeout-direct-child", ["--timeout-ms", "500", "--kill-grace-ms", "100"], [process.execPath, "-e", "setInterval(() => {}, 1000)"]);
    assert.equal(waitForTerminal(project, "timeout-direct-child").status, "timed-out");
    const events = assertJournal(project, "timeout-direct-child");
    assert.equal(events[0].timeout.scope, "direct-child-best-effort");
    assert.equal(events.find((event) => event.type === "target.started").targetProcessGroup, null);
    return;
  }

  for (const [id, leaderIgnoresTerm, withChild, graceMs, earlyExit = false, naturalEnd = false] of [
    ["timeout-leader-exits", false, true, 1000],
    ["timeout-leader-ignores", true, true, 100],
    ["timeout-zero-grace", false, true, 0],
    ["timeout-group-gone", false, false, maxDelay],
    ["early-leader-natural", false, true, 100, true, true],
    ["early-leader-deadline", false, true, 1000, true],
    ["early-leader-zero-grace", false, true, 0, true]
  ]) {
    const timeoutMs = earlyExit ? 4000 : 1200;
    const childMarker = path.join(project, `${id}.child`);
    const termMarker = path.join(project, `${id}.term`);
    const heartbeat = path.join(project, `${id}.heartbeat`);
    const releaseMarker = path.join(project, `${id}.release`);
    const script = path.join(project, `${id}.mjs`);
    const childCode = `const fs = require('node:fs'); process.on('SIGTERM', () => {}); fs.writeFileSync(${JSON.stringify(childMarker)}, String(process.pid)); setInterval(() => { if (fs.existsSync(${JSON.stringify(releaseMarker)})) process.exit(0); fs.appendFileSync(${JSON.stringify(heartbeat)}, '.'); }, 25); setTimeout(() => process.exit(0), 15000);`;
    writeScript(script, `
      import fs from 'node:fs';
      import { spawn } from 'node:child_process';
      process.on('SIGTERM', () => { fs.writeFileSync(${JSON.stringify(termMarker)}, 'TERM'); ${leaderIgnoresTerm ? "" : "process.exit(0);"} });
      ${withChild ? `spawn(process.execPath, ['-e', ${JSON.stringify(childCode)}], { stdio: 'ignore' });` : ""}
      ${earlyExit ? `setInterval(() => { if (fs.existsSync(${JSON.stringify(childMarker)})) process.exit(0); }, 10);` : ""}
      setInterval(() => {}, 1000);
      setTimeout(() => process.exit(0), 15000);
    `);
    const started = startRun(project, id, ["--wall-time", `${timeoutMs}ms`, "--kill-grace-ms", String(graceMs)], [process.execPath, script]);
    let targetPid = null;
    let childPid = null;
    try {
      waitForCondition(() => {
        targetPid = readJsonLines(runPath(project, id, "run.jsonl")).find((event) => event.type === "target.started")?.targetPid ?? null;
        return targetPid !== null;
      }, `${id} target start`);
      if (withChild) {
        waitForCondition(() => fs.existsSync(childMarker) && fs.existsSync(heartbeat), `${id} child readiness`);
        childPid = Number(fs.readFileSync(childMarker, "utf8"));
        const pgid = spawnSync("ps", ["-p", String(childPid), "-o", "pgid="], { encoding: "utf8" });
        assert.equal(pgid.status, 0, pgid.stderr);
        assert.equal(Number(pgid.stdout.trim()), targetPid, "test child must remain in the target's process group");
      }
      if (earlyExit) {
        waitForCondition(() => !processRunning(targetPid), `${id} leader exit before deadline`);
        const pending = jsonCli(["run", "status", "--project", project, "--id", id, "--json"]);
        assert.equal(pending.terminal, false, "early leader exit must not finalize a still-observed group");
        assert.equal(pending.timeoutTriggered, false, "fixture must close its leader before the deadline");
        assert.equal(processRunning(started.supervisorPid), true, "group wait must keep the supervisor alive");
        assertJournal(project, id, { allowNoTerminal: true });
        const before = fileState(runPath(project, id, "run.jsonl"));
        const resumed = jsonCli(["run", "resume", "--project", project, "--id", id, "--json"]);
        assert.equal(resumed.status, "active");
        assert.equal(resumed.write, false);
        assertFileStateEqual(fileState(runPath(project, id, "run.jsonl")), before, "resume before deadline");
        const bytes = fs.statSync(heartbeat).size;
        sleep(150);
        assert.ok(fs.statSync(heartbeat).size > bytes, "child must continue work after early leader close");
        if (naturalEnd) {
          fs.writeFileSync(releaseMarker, "finish");
          waitForCondition(() => !processRunning(childPid), `${id} natural child exit`);
        }
      }
      if (id === "timeout-leader-exits" || (earlyExit && !naturalEnd && graceMs > 0)) {
        waitForCondition(() => readJsonLines(runPath(project, id, "run.jsonl")).some((event) => event.type === "timeout.requested") && !processRunning(targetPid), "leader closed during timeout grace");
        const duringGrace = jsonCli(["run", "status", "--project", project, "--id", id, "--json"]);
        assert.equal(duringGrace.terminal, false, "leader exit must not declare terminal while group escalation is pending");
        assert.equal(duringGrace.timeoutTriggered, true);
        assert.equal(processRunning(childPid), true, "child must survive SIGTERM to exercise escalation");
        const bytes = fs.statSync(heartbeat).size;
        sleep(100);
        assert.ok(fs.statSync(heartbeat).size > bytes, "child must continue work during grace");
        const before = fileState(runPath(project, id, "run.jsonl"));
        const resumed = jsonCli(["run", "resume", "--project", project, "--id", id, "--json"]);
        assert.equal(resumed.status, "active");
        assert.equal(resumed.write, false);
        assertFileStateEqual(fileState(runPath(project, id, "run.jsonl")), before, "resume during grace");
      }
      const status = waitForTerminal(project, id);
      const events = assertJournal(project, id);
      const timedOut = !naturalEnd || status.timeoutTriggered;
      assert.equal(status.status, timedOut ? "timed-out" : "succeeded");
      assert.equal(status.timeoutTriggered, timedOut);
      assert.equal(events.at(-1).outcome, status.status, "terminal event must use the current timeout state");
      assert.equal(events.at(-1).timedOut, timedOut);
      if (naturalEnd && !timedOut) {
        const spawned = events.find((event) => event.type === "target.started");
        assert.ok(Date.parse(events.at(-1).at) - Date.parse(spawned.at) < timeoutMs - 200, "natural completion must cancel the deadline, not merely finalize when it fires");
      }
      if (earlyExit || (!leaderIgnoresTerm && graceMs > 0)) assert.equal(status.exitCode, 0, "receipt must retain the leader's exit code, not its cached outcome");
      if (earlyExit) {
        assert.equal(status.signal, null);
        if (timedOut) {
          const requested = events.find((event) => event.type === "timeout.requested");
          const spawned = events.find((event) => event.type === "target.started");
          assert.ok(Date.parse(requested.at) - Date.parse(spawned.at) >= timeoutMs - 20, "early leader close must preserve the original deadline");
        }
      }
      if (naturalEnd && timedOut) {
        // Signal 0 cannot distinguish an unreaped orphan from a working child.
        // Only accept this bounded conservative timeout if the dead fixture was
        // still observable when TERM was requested; do not claim natural success.
        assert.equal(processRunning(childPid), false);
        assert.equal(events.find((event) => event.type === "timeout.requested").firstSignal.ok, true);
        console.log("early-leader-natural: exited child remained observable (zombie); conservative deadline exercised, natural group disappearance not verified");
      }
      waitForCondition(() => !processRunning(targetPid) && !processRunning(started.supervisorPid) && (!withChild || !processRunning(childPid)), `${id} processes to stop`);
      assert.equal(events[0].timeout.scope, "process-group");
      assert.deepEqual(events[0].budget, { timeoutMs, killGraceMs: graceMs });
      assert.deepEqual(events.map((event) => event.type), ["run.started", "target.started", ...(timedOut ? ["timeout.requested", ...(withChild ? ["timeout.escalated"] : [])] : []), "run.terminal"]);
      if (withChild && timedOut) {
        const escalation = events.find((event) => event.type === "timeout.escalated");
        assert.equal(escalation.secondSignal.ok, true);
        assert.equal(escalation.targetProcessGroup, targetPid);
        const requested = events.find((event) => event.type === "timeout.requested");
        assert.ok(Date.parse(escalation.at) - Date.parse(requested.at) >= graceMs - 20, "grace must not collapse to a 1ms timer");
        const bytes = fs.statSync(heartbeat).size;
        sleep(100);
        assert.equal(fs.statSync(heartbeat).size, bytes, "no child work after escalation");
      }
      const journal = runPath(project, id, "run.jsonl");
      const before = fileState(journal);
      const human = cli(["run", "status", "--project", project, "--id", id]);
      assert.equal(human.status, 0, human.stderr);
      assert.ok(human.stdout.includes(`状态：${status.status}`), human.stdout);
      assert.match(human.stdout, /生命周期：terminal/u);
      assert.equal(jsonCli(["run", "resume", "--project", project, "--id", id, "--json"]).write, false);
      assertFileStateEqual(fileState(journal), before, "terminal status and resume must be read-only");
    } finally {
      // Only this fixture's recorded group and supervisor are eligible for cleanup.
      targetPid ??= readJsonLines(runPath(project, id, "run.jsonl")).find((event) => event.type === "target.started")?.targetPid;
      if (childPid === null && fs.existsSync(childMarker)) childPid = Number(fs.readFileSync(childMarker, "utf8"));
      if (targetPid && (processRunning(targetPid) || (childPid && processRunning(childPid)))) {
        try { process.kill(-targetPid, "SIGKILL"); } catch {}
      }
      if (processRunning(started.supervisorPid)) {
        try { process.kill(started.supervisorPid, "SIGKILL"); } catch {}
      }
    }
  }
}

function validateRunComparisonDeltas(project) {
  for (const direction of ["min", "max"]) {
    const group = `extreme-${direction}`;
    const metrics = { negative: -1e308, zero: 0, positive: 1e308, "positive-tie": 1e308 };
    for (const [label, metricValue] of Object.entries(metrics)) {
      const id = `${group}-${label}`;
      startRun(project, id, ["--group", group, "--metric-name", "score", "--direction", direction, "--timeout-ms", "1000"], [process.execPath, "-e", "process.exit(0)"]);
      assert.equal(waitForTerminal(project, id).status, "succeeded");
      assert.equal(finalize(project, id, metricValue).event.metric.value, metricValue, "finite metrics must remain accepted");
      const events = assertJournal(project, id);
      assert.equal(events.at(-1).type, "run.finalized");
      assert.equal(events.at(-1).metric.value, metricValue);
    }
    const before = Object.keys(metrics).map((label) => fileState(runPath(project, `${group}-${label}`, "run.jsonl")));
    const direct = compareRuns({ project, group });
    const result = jsonCli(["run", "compare", "--project", project, "--group", group, "--json"]);
    assert.equal(result.comparable, true);
    assert.deepEqual(direct.ranking, result.ranking, "core must return explicit null, not Infinity silently serialized as null");
    const labels = direction === "min" ? ["negative", "zero", "positive", "positive-tie"] : ["positive", "positive-tie", "zero", "negative"];
    assert.deepEqual(result.ranking.map((item) => item.runId), labels.map((label) => `${group}-${label}`));
    assert.deepEqual(result.ranking.map((item) => item.rank), [1, 2, 3, 4]);
    assert.deepEqual(result.ranking.map((item) => item.metricValue), labels.map((label) => metrics[label]));
    assert.deepEqual(result.ranking.map((item) => item.deltaFromBest), direction === "min" ? [0, 1e308, null, null] : [0, 0, 1e308, null]);
    const human = cli(["run", "compare", "--project", project, "--group", group]);
    assert.equal(human.status, 0, human.stderr);
    assert.equal(human.stderr, "");
    assert.doesNotMatch(human.stdout, /Infinity|NaN/u);
    for (const item of result.ranking) {
      assert.ok(human.stdout.includes(`${item.rank}. ${item.runId} 指标值 ${item.metricValue}，与最佳差值 ${item.deltaFromBest ?? "unavailable"}`), human.stdout);
    }
    Object.keys(metrics).forEach((label, index) => assertFileStateEqual(fileState(runPath(project, `${group}-${label}`, "run.jsonl")), before[index], "compare must not mutate receipts"));
  }
}

async function validateRunReceipts(project) {
  assert.equal(publicCore.appendFinalizedRun, appendFinalizedRun);
  assert.equal(Object.hasOwn(publicCore, "finalizeRunWithSupervisor"), false);
  const fixture = (id, supervisorPid = null, targetPid = null) => {
    const events = [{
      schemaVersion: "dove.run.event.v1", seq: 1, at: "2026-09-02T00:00:00.000Z",
      type: "run.started", runId: id, argv: ["never-execute-this-fixture"], cwd: project,
      supervisorPid, metric: { name: "score", direction: "max", unit: null }
    }];
    if (targetPid) events.push({ schemaVersion: "dove.run.event.v1", seq: 2, at: "2026-09-02T00:00:01.000Z", type: "target.started", runId: id, targetPid });
    return writeManualRunJournal(project, id, events);
  };
  fixture("direct-reconcile");
  const reconciled = resumeRun({ project, id: "direct-reconcile" });
  assert.equal(reconciled.write, true);
  assert.equal(readJsonLines(runPath(project, "direct-reconcile", "run.jsonl")).at(-1).reconcilerPid, process.pid, "resume appends in its caller without any executable path");
  assert.equal(resumeRun({ project, id: "direct-reconcile" }).write, false);
  const finalized = publicCore.appendFinalizedRun(project, "direct-reconcile", { metricValue: 1 });
  assert.equal(finalized.event.metric.value, 1);
  assert.throws(() => appendFinalizedRun(project, "direct-reconcile", { metricValue: 2 }), /already finalized/u);
  assert.equal(fs.existsSync(runPath(project, "direct-reconcile", ".journal.lock")), false, "precondition failure releases lock");
  fixture("not-terminal");
  assert.throws(() => appendFinalizedRun(project, "not-terminal", { metricValue: 1 }), /requires a terminal run/u);
  assert.equal(fs.existsSync(runPath(project, "not-terminal", ".journal.lock")), false);

  for (const [id, supervisor, target, status] of [["observed-supervisor", process.pid, null, "active"], ["observed-target", null, process.pid, "orphaned"]]) {
    fixture(id, supervisor, target);
    const before = fs.readFileSync(runPath(project, id, "run.jsonl"));
    const result = resumeRun({ project, id });
    assert.equal(result.status, status);
    assert.equal(result.write, false);
    assert.deepEqual(fs.readFileSync(runPath(project, id, "run.jsonl")), before);
  }

  fixture("append-error");
  assert.throws(() => appendRunEvent(project, "append-error", "test.event", {}, {
    fsOps: { ...fs, appendFileSync() { throw new Error("injected journal append failure"); } }
  }), /injected journal append failure/u);
  assert.equal(fs.existsSync(runPath(project, "append-error", ".journal.lock")), false, "I/O failure releases lock");
  let attempts = 0;
  appendRunEvent(project, "append-error", "test.retry", {}, {
    fsOps: {
      ...fs,
      mkdirSync(target, ...args) {
        if (target === runPath(project, "append-error", ".journal.lock") && attempts++ < 2) throw Object.assign(new Error("busy"), { code: "EEXIST" });
        return fs.mkdirSync(target, ...args);
      },
      appendFileSync(target, ...args) {
        assert.deepEqual(fs.readdirSync(runPath(project, "append-error", ".journal.lock")), [], "lock has no owner receipt");
        return fs.appendFileSync(target, ...args);
      }
    }
  });
  assert.equal(attempts, 3, "brief contention retries before append");

  for (const withOwner of [false, true]) {
    const id = withOwner ? "leftover-owner-lock" : "leftover-empty-lock";
    fixture(id);
    const lockPath = runPath(project, id, ".journal.lock");
    fs.mkdirSync(lockPath);
    if (withOwner) fs.writeFileSync(path.join(lockPath, "owner.json"), '{"pid":null,"token":"old"}');
    fs.utimesSync(lockPath, new Date(0), new Date(0));
    const before = fs.readFileSync(runPath(project, id, "run.jsonl"));
    const started = Date.now();
    const result = cli(["run", "resume", "--project", project, "--id", id, "--json"]);
    assert.notEqual(result.status, 0);
    assert.ok(JSON.parse(result.stderr).message.includes(lockPath));
    assert.match(result.stderr, /does not recover locks automatically/u);
    assert.ok(Date.now() - started < 10000, "lock retry must be bounded");
    assert.deepEqual(fs.readFileSync(runPath(project, id, "run.jsonl")), before);
    assert.equal(fs.existsSync(lockPath), true, "leftover locks are never auto-recovered");
    assert.deepEqual(fs.readdirSync(lockPath), withOwner ? ["owner.json"] : []);
  }

  fixture("concurrent-finalize");
  resumeRun({ project, id: "concurrent-finalize" });
  const contenders = await Promise.all([1, 2].map((value) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, "bin/dove.mjs"), "run", "finalize", "--project", project, "--id", "concurrent-finalize", "--metric-value", String(value), "--json"], { cwd: project, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  })));
  assert.deepEqual(contenders.map((item) => item.code).sort(), [0, 1]);
  assert.match(contenders.find((item) => item.code === 1).stderr, /already finalized/u);
  const events = readJsonLines(runPath(project, "concurrent-finalize", "run.jsonl"));
  assert.equal(events.filter((event) => event.type === "run.finalized").length, 1);
  assert.deepEqual(events.map((event) => event.seq), [1, 2, 3]);

  for (const mode of ["reconcile", "finalize"]) {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(ROOT, "bin/dove.mjs"), "__dove-run-supervisor"], { cwd: project, stdio: ["ignore", "ignore", "ignore", "ipc"] });
      let failure;
      child.on("message", (message) => {
        if (message.type === "awaiting-config") child.send({ type: "config", payload: { mode } });
        if (message.type === "failed") failure = message;
      });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, failure }));
    });
    assert.equal(result.code, 1);
    assert.match(result.failure.error, /only supports start/u);
  }
}

// Focused source-CLI checks need neither installation nor Git fixture commits.
const comparisonsOnly = process.argv.includes("--comparisons-only");
const receiptsOnly = process.argv.includes("--receipts-only");
if (process.argv.includes("--timeouts-only") || comparisonsOnly || receiptsOnly) {
  const project = fs.mkdtempSync(path.join(SCRATCH_ROOT, comparisonsOnly ? "dove-run-comparisons-" : "dove-run-timeouts-"));
  try {
    // Stop Git discovery at the synthetic fixture, without creating commits or
    // letting run metadata inspect the enclosing developer working tree.
    fs.mkdirSync(path.join(project, ".git"));
    const at = new Date().toISOString();
    fs.mkdirSync(path.join(project, ".dove", "install"), { recursive: true });
    fs.writeFileSync(path.join(project, ".dove", "install", "manifest.json"), JSON.stringify({
      revision: "2.0", package: { name: "dove", version: "3.0.0" }, runtime: { mode: "user-cli" },
      hosts: ["claude"], managed: [], createdAt: at, updatedAt: at
    }));
    if (receiptsOnly) await validateRunReceipts(project);
    else if (comparisonsOnly) validateRunComparisonDeltas(project);
    else validateRunTimeouts(project);
    console.log(JSON.stringify({ status: "passed", scope: receiptsOnly ? "run journal receipts (source CLI)" : comparisonsOnly ? "run comparison deltas (source CLI)" : "run timeouts (source CLI)", platform: process.platform }, null, 2));
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
  process.exit(0);
}

const tempRoot = fs.mkdtempSync(path.join(SCRATCH_ROOT, "dove-runs-"));
try {
  const project = path.join(tempRoot, "project");
  fs.mkdirSync(project, { recursive: true });
  fs.mkdirSync(path.join(project, ".git"));
  const init = jsonCli(["init", "--project", project, "--host", "claude", "--json"]);
  assert.equal(init.status, "initialized");
  await validateRunReceipts(project);
  validateRunTimeouts(project);
  validateRunComparisonDeltas(project);
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

  const hidden = cli(["__dove-run-supervisor", "not-a-public-command"]);
  assert.notEqual(hidden.status, 0);
  assert.doesNotMatch(hidden.stderr, /Usage:/u);

  console.log(JSON.stringify({ status: "passed" }, null, 2));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
