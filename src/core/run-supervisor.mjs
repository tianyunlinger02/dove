import { spawn } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

import {
  appendFinalizedRun,
  appendReconciledInterrupted,
  appendRunEvent,
  createRunId,
  inspectRunStatus,
  normalizeRunBasis,
  normalizeRunBudget,
  normalizeRunCommandArgv,
  normalizeRunGroup,
  normalizeRunId,
  normalizeRunMetricSpec,
  normalizeRunProject,
  normalizeRunSeed,
  reserveRunDirectory,
  runAbsolutePaths,
  summarizeRun
} from "./run-record.mjs";
import { captureRunGitFacts, normalizeRunGitFacts } from "./run-environment.mjs";

const SUPERVISOR_ENTRY = "__dove-run-supervisor";
const SUPERVISOR_READY_TIMEOUT_MS = 10000;
const SUPERVISOR_CONFIG_TIMEOUT_MS = 10000;

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sendSupervisorMessage(message) {
  if (typeof process.send === "function") {
    try { process.send(message); } catch {}
  }
}

function sendSupervisorMessageAsync(message) {
  return new Promise((resolve, reject) => {
    if (typeof process.send !== "function") {
      reject(new Error("Dove run supervisor IPC channel is not available."));
      return;
    }
    try {
      process.send(message, (error) => {
        if (error) reject(error);
        else resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function closeFd(fd) {
  if (!Number.isInteger(fd)) return;
  try { fs.closeSync(fd); } catch {}
}

function terminationScope() {
  return process.platform === "win32"
    ? {
      scope: "direct-child-best-effort",
      note: "Windows termination is best-effort for the direct child process only."
    }
    : {
      scope: "process-group",
      note: "POSIX termination targets the child process group; only same-process-group descendants are addressed."
    };
}

function targetDetached() {
  return process.platform !== "win32";
}

function signalTargetGroup(targetPid, signal) {
  if (!Number.isInteger(targetPid) || targetPid <= 0) return { ok: false, error: "target pid unavailable" };
  try {
    if (process.platform === "win32") process.kill(targetPid, signal);
    else process.kill(-targetPid, signal);
    return { ok: true, error: null };
  } catch (error) {
    if (error?.code === "ESRCH") return { ok: false, error: "not-observed" };
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function terminalPayloadForClose(code, signal, timedOut) {
  if (timedOut) return { outcome: "timed-out", status: "timed-out", timedOut: true, exitCode: code ?? null, signal: signal ?? null };
  if (signal !== null && signal !== undefined) return { outcome: "signaled", status: "signaled", timedOut: false, exitCode: code ?? null, signal };
  if (code === 0) return { outcome: "succeeded", status: "succeeded", timedOut: false, exitCode: 0, signal: null };
  return { outcome: "failed", status: "failed", timedOut: false, exitCode: code ?? null, signal: null };
}

function appendTerminalEvent(projectRoot, runId, payload, options = {}) {
  appendRunEvent(projectRoot, runId, "run.terminal", {
    ...payload,
    terminal: true,
    source: options.source ?? "supervisor",
    supervisorPid: process.pid,
    targetPid: options.targetPid ?? null
  }, { now: options.now, operation: "terminal" });
}

function openRunLogFiles(paths) {
  return {
    stdoutFd: fs.openSync(paths.absoluteStdoutPath, "wx", 0o600),
    stderrFd: fs.openSync(paths.absoluteStderrPath, "wx", 0o600)
  };
}

function normalizeStartPayload(raw) {
  const runId = normalizeRunId(raw.runId);
  const projectRoot = raw.projectRoot;
  if (typeof projectRoot !== "string" || !projectRoot.trim() || projectRoot.includes("\0")) throw new Error("Dove run supervisor project root is invalid.");
  const argv = normalizeRunCommandArgv(raw.argv);
  const budget = normalizeRunBudget(raw.budget ?? {});
  const metric = normalizeRunMetricSpec(raw.metric ?? {});
  const basis = normalizeRunBasis(raw.basis ?? {});
  const seed = plainObject(raw.seed)
    ? normalizeRunSeed(raw.seed.declaration === "declared" ? raw.seed.value : null)
    : normalizeRunSeed(raw.seed);
  const git = normalizeRunGitFacts(raw);
  const group = normalizeRunGroup(raw.group);
  return { runId, projectRoot, argv, budget, metric, basis, seed, commit: git.commit, dirty: git.dirty, group };
}

async function superviseTargetRun(rawPayload) {
  const payload = normalizeStartPayload(rawPayload);
  const { projectRoot, runId, argv, budget, metric, basis, seed, commit, dirty, group } = payload;
  const paths = runAbsolutePaths(projectRoot, runId);
  let stdoutFd = null;
  let stderrFd = null;
  let target = null;
  let timeoutTimer = null;
  let graceTimer = null;
  let timedOut = false;
  let terminalWritten = false;
  let readySent = false;

  async function sendReady(extra = {}) {
    if (readySent) return;
    await sendSupervisorMessageAsync({ type: "ready", runId, project: projectRoot, supervisorPid: process.pid, paths: paths.runDirectory, ...extra });
    readySent = true;
  }

  function finish(status = 0) {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (graceTimer) clearTimeout(graceTimer);
    closeFd(stdoutFd);
    closeFd(stderrFd);
    process.exit(status);
  }

  try {
    const logs = openRunLogFiles(paths);
    stdoutFd = logs.stdoutFd;
    stderrFd = logs.stderrFd;
    const scope = terminationScope();
    appendRunEvent(projectRoot, runId, "run.started", {
      argv,
      cwd: projectRoot,
      group,
      budget,
      metric,
      data: basis.data,
      evaluator: basis.evaluator,
      resourceBasis: basis.resourceBasis,
      seed,
      commit,
      dirty,
      supervisorPid: process.pid,
      timeout: {
        requested: budget.timeoutMs !== null,
        timeoutMs: budget.timeoutMs,
        killGraceMs: budget.killGraceMs,
        ...scope
      }
    }, { operation: "start" });
    await sendReady({ commit, dirty });

    target = spawn(argv[0], argv.slice(1), {
      cwd: projectRoot,
      shell: false,
      detached: targetDetached(),
      windowsHide: true,
      stdio: ["ignore", stdoutFd, stderrFd]
    });

    target.once("spawn", () => {
      try {
        appendRunEvent(projectRoot, runId, "target.started", {
          targetPid: target.pid,
          targetProcessGroup: process.platform === "win32" ? null : target.pid,
          supervisorPid: process.pid,
          stdoutPath: paths.stdoutPath,
          stderrPath: paths.stderrPath,
          termination: scope
        }, { operation: "target-started" });
      } catch {}
      if (budget.timeoutMs !== null) {
        timeoutTimer = setTimeout(() => {
          timedOut = true;
          const firstSignal = signalTargetGroup(target.pid, "SIGTERM");
          try {
            appendRunEvent(projectRoot, runId, "timeout.requested", {
              targetPid: target.pid,
              targetProcessGroup: process.platform === "win32" ? null : target.pid,
              supervisorPid: process.pid,
              reason: "wall-time",
              timeoutMs: budget.timeoutMs,
              killGraceMs: budget.killGraceMs,
              signal: "SIGTERM",
              firstSignal,
              termination: scope
            }, { operation: "timeout" });
          } catch {}
          const kill = () => {
            const secondSignal = signalTargetGroup(target.pid, "SIGKILL");
            try {
              appendRunEvent(projectRoot, runId, "timeout.escalated", {
                targetPid: target.pid,
                targetProcessGroup: process.platform === "win32" ? null : target.pid,
                supervisorPid: process.pid,
                reason: "kill-grace-expired",
                signal: "SIGKILL",
                secondSignal,
                termination: scope
              }, { operation: "timeout-escalated" });
            } catch {}
          };
          if (budget.killGraceMs === 0) kill();
          else graceTimer = setTimeout(kill, budget.killGraceMs);
        }, budget.timeoutMs);
        timeoutTimer.unref?.();
      }
    });

    target.once("error", (error) => {
      if (terminalWritten) return;
      terminalWritten = true;
      try {
        appendTerminalEvent(projectRoot, runId, {
          outcome: "launch-failed",
          status: "launch-failed",
          timedOut: false,
          exitCode: null,
          signal: null,
          error: {
            code: error?.code ?? null,
            message: error instanceof Error ? error.message : String(error)
          }
        }, { source: "launch-error", targetPid: target?.pid ?? null });
        finish(0);
      } catch {
        finish(1);
      }
    });

    target.once("close", (code, signal) => {
      if (terminalWritten) return;
      terminalWritten = true;
      const terminal = terminalPayloadForClose(code, signal, timedOut);
      try {
        appendTerminalEvent(projectRoot, runId, terminal, { source: "target-close", targetPid: target.pid });
        finish(0);
      } catch {
        finish(1);
      }
    });
    await new Promise(() => {});
  } catch (error) {
    if (!readySent) sendSupervisorMessage({ type: "failed", runId, project: projectRoot, error: error instanceof Error ? error.message : String(error) });
    else {
      try {
        if (!terminalWritten) {
          appendTerminalEvent(projectRoot, runId, {
            outcome: "launch-failed",
            status: "launch-failed",
            timedOut: false,
            exitCode: null,
            signal: null,
            error: { code: error?.code ?? null, message: error instanceof Error ? error.message : String(error) }
          }, { source: "supervisor-error", targetPid: target?.pid ?? null });
        }
      } catch {}
    }
    finish(1);
  }
}

function normalizeReconcilePayload(raw) {
  const runId = normalizeRunId(raw.runId);
  const projectRoot = raw.projectRoot;
  if (typeof projectRoot !== "string" || !projectRoot.trim() || projectRoot.includes("\0")) throw new Error("Dove run reconcile project root is invalid.");
  return { runId, projectRoot, supervisorPid: raw.supervisorPid ?? null, targetPid: raw.targetPid ?? null };
}

function normalizeFinalizePayload(raw) {
  const runId = normalizeRunId(raw.runId);
  const projectRoot = raw.projectRoot;
  if (typeof projectRoot !== "string" || !projectRoot.trim() || projectRoot.includes("\0")) throw new Error("Dove run finalize project root is invalid.");
  return {
    runId,
    projectRoot,
    metricName: raw.metricName,
    direction: raw.direction,
    metricUnit: raw.metricUnit,
    metricValue: raw.metricValue,
    decision: raw.decision,
    note: raw.note
  };
}

async function reconcileInterruptedRun(rawPayload) {
  const payload = normalizeReconcilePayload(rawPayload);
  try {
    const written = appendReconciledInterrupted(payload.projectRoot, payload.runId, {
      supervisorPid: payload.supervisorPid,
      targetPid: payload.targetPid
    });
    await sendSupervisorMessageAsync({ type: "reconciled", runId: payload.runId, project: payload.projectRoot, event: written.event });
    process.exit(0);
  } catch (error) {
    try { await sendSupervisorMessageAsync({ type: "failed", runId: payload.runId, project: payload.projectRoot, error: error instanceof Error ? error.message : String(error) }); } catch {}
    process.exit(1);
  }
}

async function finalizeRun(rawPayload) {
  const payload = normalizeFinalizePayload(rawPayload);
  try {
    const written = appendFinalizedRun(payload.projectRoot, payload.runId, payload);
    await sendSupervisorMessageAsync({ type: "finalized", runId: payload.runId, project: payload.projectRoot, event: written.event, summary: written.summary });
    process.exit(0);
  } catch (error) {
    try { await sendSupervisorMessageAsync({ type: "failed", runId: payload.runId, project: payload.projectRoot, error: error instanceof Error ? error.message : String(error) }); } catch {}
    process.exit(1);
  }
}

function spawnSupervisor(executablePath, payload, options = {}) {
  if (typeof executablePath !== "string" || !executablePath.trim()) throw new Error("Dove run supervisor requires the current CLI executable path.");
  const child = spawn(process.execPath, [executablePath, SUPERVISOR_ENTRY], {
    cwd: payload.projectRoot,
    detached: options.detached === true,
    windowsHide: true,
    stdio: ["ignore", "ignore", "ignore", "ipc"]
  });
  return child;
}

function waitForSupervisorMessage(child, acceptedTypes, options = {}) {
  return new Promise((resolve, reject) => {
    const timeoutMs = options.timeoutMs ?? SUPERVISOR_READY_TIMEOUT_MS;
    const expected = acceptedTypes.join("/");
    let settled = false;
    const timer = setTimeout(() => {
      settle(() => reject(new Error(`Dove run supervisor did not report ${expected} before the timeout.`)));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      child.off("message", onMessage);
      child.off("error", onError);
      child.off("exit", onExit);
    };
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const onMessage = (message) => {
      if (!plainObject(message) || typeof message.type !== "string") return;
      if (message.type === "failed") {
        settle(() => reject(new Error(message.error ?? "Dove run supervisor failed.")));
        return;
      }
      if (acceptedTypes.includes(message.type)) settle(() => resolve(message));
    };
    const onError = (error) => settle(() => reject(error));
    const onExit = (code, signal) => settle(() => reject(new Error(`Dove run supervisor exited before reporting ${acceptedTypes.join("/")}: code ${code ?? "null"}, signal ${signal ?? "null"}.`)));
    child.on("message", onMessage);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

function sendSupervisorConfig(child, payload) {
  return new Promise((resolve, reject) => {
    if (typeof child.send !== "function" || child.connected === false) {
      reject(new Error("Dove run supervisor IPC channel is not available for configuration."));
      return;
    }
    child.send({ type: "config", payload }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function configureSupervisorAndWait(child, payload, acceptedTypes) {
  await waitForSupervisorMessage(child, ["awaiting-config"], { timeoutMs: SUPERVISOR_CONFIG_TIMEOUT_MS });
  const result = waitForSupervisorMessage(child, acceptedTypes);
  try {
    await sendSupervisorConfig(child, payload);
  } catch (error) {
    result.catch(() => {});
    throw error;
  }
  return await result;
}

function removeEmptyReservedRunDirectory(paths, fsOps = fs) {
  try {
    const entries = fsOps.readdirSync(paths.absoluteRunDirectory);
    if (entries.length === 0) fsOps.rmdirSync(paths.absoluteRunDirectory);
  } catch {}
}

export async function startDetachedRunSupervisor(options = {}) {
  const argv = normalizeRunCommandArgv(options.argv);
  const budget = normalizeRunBudget(options);
  const metric = normalizeRunMetricSpec(options);
  const basis = normalizeRunBasis(options);
  const seed = normalizeRunSeed(options.seed);
  const group = normalizeRunGroup(options.group);
  const projectRoot = normalizeRunProject(options.project, { cwd: options.cwd });
  const runId = normalizeRunId(options.id ?? createRunId({ now: options.now }));
  const git = captureRunGitFacts(projectRoot);
  const reserved = reserveRunDirectory({ project: projectRoot, id: runId, cwd: options.cwd, now: options.now });
  const payload = {
    mode: "start",
    projectRoot: reserved.projectRoot,
    runId: reserved.runId,
    argv,
    budget,
    metric,
    basis,
    seed,
    commit: git.commit,
    dirty: git.dirty,
    group
  };
  const child = spawnSupervisor(options.executablePath, payload, { detached: true });
  let ready;
  try {
    ready = await configureSupervisorAndWait(child, payload, ["ready"]);
  } catch (error) {
    try { child.kill(); } catch {}
    removeEmptyReservedRunDirectory(reserved.paths);
    throw error;
  }
  try { child.disconnect(); } catch {}
  child.unref();
  return {
    command: "start",
    status: "started",
    project: reserved.projectRoot,
    runId: reserved.runId,
    supervisorPid: ready.supervisorPid ?? child.pid,
    argv,
    cwd: reserved.projectRoot,
    group,
    budget,
    metric,
    data: basis.data,
    evaluator: basis.evaluator,
    resourceBasis: basis.resourceBasis,
    seed,
    commit: ready.commit,
    dirty: ready.dirty,
    paths: {
      runDirectory: reserved.paths.runDirectory,
      journalPath: reserved.paths.journalPath,
      stdoutPath: reserved.paths.stdoutPath,
      stderrPath: reserved.paths.stderrPath
    }
  };
}

async function runReconcileSupervisor(options = {}) {
  const projectRoot = options.projectRoot;
  const runId = normalizeRunId(options.runId);
  const payload = {
    mode: "reconcile",
    projectRoot,
    runId,
    supervisorPid: options.supervisorPid ?? null,
    targetPid: options.targetPid ?? null
  };
  const child = spawnSupervisor(options.executablePath, payload, { detached: false });
  const message = await configureSupervisorAndWait(child, payload, ["reconciled"]);
  try { child.disconnect(); } catch {}
  return message;
}

export async function finalizeRunWithSupervisor(options = {}) {
  const initial = inspectRunStatus(options);
  const payload = {
    mode: "finalize",
    projectRoot: initial.project,
    runId: initial.runId,
    metricName: options.metricName,
    direction: options.direction,
    metricUnit: options.metricUnit,
    metricValue: options.metricValue,
    decision: options.decision,
    note: options.note
  };
  const child = spawnSupervisor(options.executablePath, payload, { detached: false });
  const message = await configureSupervisorAndWait(child, payload, ["finalized"]);
  try { child.disconnect(); } catch {}
  return { command: "finalize", event: message.event, summary: message.summary };
}

export async function resumeRun(options = {}) {
  const initial = inspectRunStatus(options);
  if (initial.terminal) return { command: "resume", status: "terminal", action: "none", write: false, reason: "run is already terminal", run: initial };
  if (initial.pidObservation.supervisor.alive) return { command: "resume", status: "active", action: "none", write: false, reason: "supervisor pid is currently observable by PID-only liveness; Dove will not reconcile or mutate it", run: initial };
  if (initial.pidObservation.target.alive) return { command: "resume", status: "orphaned", action: "blocked", write: false, reason: "target pid is observable by PID-only liveness but supervisor pid is not; Dove will not rerun or mutate this run", run: initial };
  await runReconcileSupervisor({
    executablePath: options.executablePath,
    projectRoot: initial.project,
    runId: initial.runId,
    supervisorPid: initial.supervisorPid,
    targetPid: initial.targetPid
  });
  const reconciled = summarizeRun(initial.project, initial.runId, { fsOps: options.fsOps ?? fs });
  return { command: "resume", status: "interrupted", action: "reconciled", write: true, reason: "supervisor and target pids were not observable, so Dove recorded one interrupted reconciliation", run: reconciled };
}

export function isRunSupervisorInvocation(argv) {
  return argv?.[0] === SUPERVISOR_ENTRY;
}

function receiveSupervisorConfig() {
  if (typeof process.send !== "function") throw new Error("Dove hidden run supervisor requires an IPC configuration channel.");
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settle(() => reject(new Error("Dove hidden run supervisor did not receive IPC configuration before the timeout.")));
    }, SUPERVISOR_CONFIG_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timer);
      process.off("message", onMessage);
      process.off("disconnect", onDisconnect);
    };
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const onMessage = (message) => {
      if (!plainObject(message) || message.type !== "config") return;
      if (!plainObject(message.payload)) {
        settle(() => reject(new Error("Dove hidden run supervisor IPC configuration must contain a payload object.")));
        return;
      }
      settle(() => resolve(message.payload));
    };
    const onDisconnect = () => settle(() => reject(new Error("Dove hidden run supervisor IPC disconnected before configuration.")));
    process.on("message", onMessage);
    process.once("disconnect", onDisconnect);
    sendSupervisorMessage({ type: "awaiting-config", supervisorPid: process.pid });
  });
}

export async function runSupervisorMain(argv = process.argv.slice(2)) {
  if (!isRunSupervisorInvocation(argv)) throw new Error("Not a Dove run supervisor invocation.");
  let payload;
  try {
    if (argv.length !== 1) throw new Error("Dove hidden run supervisor does not accept command-line payload arguments.");
    payload = await receiveSupervisorConfig();
    if (payload.mode === "start") await superviseTargetRun(payload);
    else if (payload.mode === "reconcile") await reconcileInterruptedRun(payload);
    else if (payload.mode === "finalize") await finalizeRun(payload);
    else throw new Error("Dove hidden run supervisor mode is unsupported.");
  } catch (error) {
    sendSupervisorMessage({ type: "failed", runId: payload?.runId ?? null, project: payload?.projectRoot ?? null, error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}
