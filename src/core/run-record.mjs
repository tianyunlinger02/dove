import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { ARTIFACT_PATHS } from "./schema.mjs";
import { resolveInstalledProjectRoot } from "./project-root.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";
import { normalizeRunGitFacts } from "./run-environment.mjs";

export const RUN_EVENT_SCHEMA_VERSION = "dove.run.event.v1";
export const RUNS_DIRECTORY_PATH = ARTIFACT_PATHS.runsDir;
export const RUN_JOURNAL_FILE = "run.jsonl";
export const RUN_STDOUT_FILE = "stdout.log";
export const RUN_STDERR_FILE = "stderr.log";

const RUN_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9])?$/u;
const WINDOWS_RESERVED_NAMES = new Set(["CON", "PRN", "AUX", "NUL", ...Array.from({ length: 9 }, (_, index) => `COM${index + 1}`), ...Array.from({ length: 9 }, (_, index) => `LPT${index + 1}`)]);
const RESERVED_EVENT_FIELDS = new Set(["schemaVersion", "seq", "at", "type", "runId"]);
const FINAL_DECISIONS_MAX_LENGTH = 400;
const FINAL_NOTE_MAX_LENGTH = 4000;
const RUN_LOCK_DIRECTORY = ".journal.lock";
const RUN_LOCK_OWNER_FILE = "owner.json";
const RUN_LOCK_OWNER_SCHEMA_VERSION = "dove.run.lock.v1";
const RUN_LOCK_STALE_MS = 30_000;
const RUN_LOCK_WAIT_MS = 2_000;
const RUN_LOCK_RETRY_MS = 25;
const RUN_SEED_MAX_LENGTH = 200;
const RUN_TIMER_MAX_MS = 2_147_483_647;

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function lstatOrNull(fsOps, targetPath) {
  try {
    return fsOps.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function assertRealDirectory(fsOps, targetPath, label) {
  const stat = lstatOrNull(fsOps, targetPath);
  if (stat === null) throw new Error(`${label} must exist: ${targetPath}`);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`${label} must be a real directory: ${targetPath}`);
  return stat;
}

function assertRegularFile(fsOps, targetPath, label) {
  const stat = lstatOrNull(fsOps, targetPath);
  if (stat === null) throw new Error(`${label} is missing: ${targetPath}`);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${label} must be a regular non-symlink file: ${targetPath}`);
  return stat;
}

function exactIsoTimestamp(value = new Date(), label = "Dove run timestamp") {
  const timestamp = value instanceof Date ? value.toISOString() : value;
  if (typeof timestamp !== "string" || !timestamp.trim() || timestamp.includes("\0")) throw new Error(`${label} must be an exact ISO timestamp.`);
  const milliseconds = Date.parse(timestamp);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== timestamp) throw new Error(`${label} must be an exact ISO timestamp.`);
  return timestamp;
}

function sanitizeOptionalText(value, label, options = {}) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("\0")) throw new Error(`${label} must be a non-empty string without NUL bytes.`);
  const max = options.max ?? 1000;
  if (trimmed.length > max) throw new Error(`${label} must be at most ${max} characters.`);
  return trimmed;
}

function finiteNumber(value, label) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
    return value;
  }
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new Error(`${label} must be a finite number.`);
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a finite number.`);
  return number;
}

function positiveIntegerOrNull(value, label) {
  if (value === undefined || value === null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number <= 0 || number > Number.MAX_SAFE_INTEGER) throw new Error(`${label} must be a positive safe integer.`);
  return number;
}

function nonNegativeInteger(value, label) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 0 || number > Number.MAX_SAFE_INTEGER) throw new Error(`${label} must be a non-negative safe integer.`);
  return number;
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

export function observePid(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return { pid: Number.isInteger(pid) ? pid : null, alive: false, observation: "not-recorded", identity: "pid-only" };
  try {
    process.kill(pid, 0);
    return { pid, alive: true, observation: "signal-zero", identity: "pid-only" };
  } catch (error) {
    if (error?.code === "ESRCH") return { pid, alive: false, observation: "not-observed", identity: "pid-only" };
    if (error?.code === "EPERM") return { pid, alive: true, observation: "permission-denied", identity: "pid-only" };
    return { pid, alive: false, observation: `error:${error?.code ?? "unknown"}`, identity: "pid-only" };
  }
}

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

export function createRunId(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const date = now.toISOString().slice(0, 10).replace(/-/gu, "");
  const time = now.toISOString().slice(11, 19).replace(/:/gu, "");
  const suffix = crypto.randomBytes(4).toString("hex");
  return `run-${date}-${time}-${suffix}`;
}

export function normalizeRunId(value) {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.includes("\0")) throw new Error("Dove run id must be a non-empty trimmed path-safe string.");
  if (!RUN_ID_PATTERN.test(value)) throw new Error(`Dove run id must be path-safe and contain only letters, numbers, '.', '_' and '-': ${value}`);
  const upper = value.split(".", 1)[0].toUpperCase();
  if (WINDOWS_RESERVED_NAMES.has(upper)) throw new Error(`Dove run id must not use a reserved device name: ${value}`);
  return value;
}

export function normalizeRunProject(project, options = {}) {
  const fsOps = options.fsOps ?? fs;
  return resolveInstalledProjectRoot(project ?? options.cwd ?? process.cwd(), { fsOps });
}

export function runRelativePaths(runId) {
  const id = normalizeRunId(runId);
  const base = `${RUNS_DIRECTORY_PATH}/${id}`;
  return {
    runDirectory: base,
    journalPath: `${base}/${RUN_JOURNAL_FILE}`,
    stdoutPath: `${base}/${RUN_STDOUT_FILE}`,
    stderrPath: `${base}/${RUN_STDERR_FILE}`
  };
}

export function runAbsolutePaths(projectRoot, runId) {
  const relative = runRelativePaths(runId);
  return {
    ...relative,
    absoluteRunDirectory: path.join(projectRoot, relative.runDirectory),
    absoluteJournalPath: path.join(projectRoot, relative.journalPath),
    absoluteStdoutPath: path.join(projectRoot, relative.stdoutPath),
    absoluteStderrPath: path.join(projectRoot, relative.stderrPath)
  };
}

function ensureRunsRoot(projectRoot, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const doveRoot = path.join(projectRoot, ARTIFACT_PATHS.doveRoot);
  assertRealDirectory(fsOps, doveRoot, "Dove workspace root");
  const runsRoot = path.join(projectRoot, RUNS_DIRECTORY_PATH);
  const stat = lstatOrNull(fsOps, runsRoot);
  if (stat !== null) {
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove runs directory must be a real directory: ${RUNS_DIRECTORY_PATH}`);
    return runsRoot;
  }
  try {
    fsOps.mkdirSync(runsRoot, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const raced = lstatOrNull(fsOps, runsRoot);
    if (raced?.isDirectory() !== true || raced.isSymbolicLink()) throw new Error(`Dove runs directory must be a real directory: ${RUNS_DIRECTORY_PATH}`);
  }
  return runsRoot;
}

export function reserveRunDirectory(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const projectRoot = normalizeRunProject(options.project, options);
  const runId = normalizeRunId(options.id ?? createRunId({ now: options.now }));
  ensureRunsRoot(projectRoot, { fsOps });
  const paths = runAbsolutePaths(projectRoot, runId);
  try {
    fsOps.mkdirSync(paths.absoluteRunDirectory, { mode: 0o700 });
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error(`Dove run id already exists: ${runId}`);
    throw error;
  }
  assertRealDirectory(fsOps, paths.absoluteRunDirectory, "Dove run directory");
  return { projectRoot, runId, paths };
}

function requireRunDirectory(projectRoot, runId, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const paths = runAbsolutePaths(projectRoot, runId);
  assertRealDirectory(fsOps, paths.absoluteRunDirectory, "Dove run directory");
  return paths;
}

function tryRunDirectory(projectRoot, runId, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const paths = runAbsolutePaths(projectRoot, runId);
  const stat = lstatOrNull(fsOps, paths.absoluteRunDirectory);
  if (stat === null) return null;
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove run directory must be a real directory: ${paths.runDirectory}`);
  return paths;
}

function readRunLockOwner(fsOps, lockPath) {
  const ownerPath = path.join(lockPath, RUN_LOCK_OWNER_FILE);
  const stat = lstatOrNull(fsOps, ownerPath);
  if (stat === null) return null;
  if (stat.isSymbolicLink() || !stat.isFile()) return { invalid: true, reason: "owner file is not a regular file" };
  try {
    const owner = JSON.parse(fsOps.readFileSync(ownerPath, "utf8"));
    if (!plainObject(owner) || owner.schemaVersion !== RUN_LOCK_OWNER_SCHEMA_VERSION) return { invalid: true, reason: "owner file has an invalid schema" };
    return owner;
  } catch {
    return { invalid: true, reason: "owner file is not readable JSON" };
  }
}

function recoverExistingRunMutationLock(runId, lockPath, options) {
  const fsOps = options.fsOps;
  const stat = lstatOrNull(fsOps, lockPath);
  if (stat === null) return { recovered: true, reason: "lock disappeared" };
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove run ${runId} journal lock is not a real directory.`);
  const owner = readRunLockOwner(fsOps, lockPath);
  if (owner !== null && owner.invalid !== true) {
    const pid = Number(owner.pid);
    if (Number.isInteger(pid) && pid > 0) {
      const observation = observePid(pid);
      if (observation.alive) {
        return {
          recovered: false,
          reason: `journal writer lock is held by observable pid ${pid} (${observation.observation}; ${observation.identity})`
        };
      }
      fsOps.rmSync(lockPath, { recursive: true, force: true });
      return { recovered: true, reason: `removed stale journal lock from non-observable owner pid ${pid}` };
    }
  }
  const ageMs = Math.max(0, Date.now() - stat.mtimeMs);
  if (ageMs >= RUN_LOCK_STALE_MS) {
    fsOps.rmSync(lockPath, { recursive: true, force: true });
    return { recovered: true, reason: `removed stale journal lock without a live owner after ${Math.round(ageMs)}ms` };
  }
  return {
    recovered: false,
    reason: owner?.invalid === true
      ? `journal writer lock owner is incomplete (${owner.reason}) and only ${Math.round(ageMs)}ms old`
      : `journal writer lock has no owner yet and is only ${Math.round(ageMs)}ms old`
  };
}

function writeRunLockOwner(fsOps, lockPath, runId, token, options) {
  const owner = {
    schemaVersion: RUN_LOCK_OWNER_SCHEMA_VERSION,
    runId,
    pid: process.pid,
    token,
    createdAt: exactIsoTimestamp(options.now ?? new Date()),
    operation: options.operation ?? "append"
  };
  fsOps.writeFileSync(path.join(lockPath, RUN_LOCK_OWNER_FILE), `${JSON.stringify(owner)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
}

function acquireRunMutationLock(projectRoot, runId, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const paths = requireRunDirectory(projectRoot, runId, { fsOps });
  const lockPath = path.join(paths.absoluteRunDirectory, RUN_LOCK_DIRECTORY);
  const token = crypto.randomBytes(16).toString("hex");
  const start = Date.now();
  let lastReason = "journal writer lock is busy";
  while (Date.now() - start <= RUN_LOCK_WAIT_MS) {
    try {
      fsOps.mkdirSync(lockPath, { mode: 0o700 });
      try {
        writeRunLockOwner(fsOps, lockPath, runId, token, options);
      } catch (error) {
        fsOps.rmSync(lockPath, { recursive: true, force: true });
        throw error;
      }
      let released = false;
      return {
        release() {
          if (released) return;
          released = true;
          const owner = readRunLockOwner(fsOps, lockPath);
          if (owner?.token === token) fsOps.rmSync(lockPath, { recursive: true, force: true });
        }
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const recovery = recoverExistingRunMutationLock(runId, lockPath, { fsOps });
      lastReason = recovery.reason;
      if (recovery.recovered) continue;
      sleepSync(RUN_LOCK_RETRY_MS);
    }
  }
  throw new Error(`Dove run ${runId} already has an active journal writer lock; ${lastReason}. Stale locks are removed only when the owner pid is not observable or an ownerless lock is older than ${RUN_LOCK_STALE_MS}ms.`);
}

function validateRunEvent(value, expectedRunId, expectedSeq, label) {
  if (!plainObject(value)) throw new Error(`${label} must be a JSON object.`);
  if (value.schemaVersion !== RUN_EVENT_SCHEMA_VERSION) throw new Error(`${label} has unsupported schemaVersion.`);
  if (value.seq !== expectedSeq) throw new Error(`${label} must have contiguous seq ${expectedSeq}.`);
  exactIsoTimestamp(value.at, `${label}.at`);
  if (typeof value.type !== "string" || !value.type.trim() || value.type.includes("\0")) throw new Error(`${label}.type must be a non-empty string.`);
  if (value.runId !== expectedRunId) throw new Error(`${label}.runId must equal ${expectedRunId}.`);
  return value;
}

export function readRunEvents(projectRoot, runId, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const id = normalizeRunId(runId);
  const paths = requireRunDirectory(projectRoot, id, { fsOps });
  assertRegularFile(fsOps, paths.absoluteJournalPath, "Dove run journal");
  const text = fsOps.readFileSync(paths.absoluteJournalPath, "utf8");
  if (!text.endsWith("\n")) throw new Error(`Dove run journal must be newline-terminated JSONL: ${paths.journalPath}`);
  const lines = text.slice(0, -1).split("\n");
  if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) throw new Error(`Dove run journal must contain JSONL events: ${paths.journalPath}`);
  return lines.map((line, index) => {
    if (!line.trim()) throw new Error(`Dove run journal must not contain blank lines: ${paths.journalPath}`);
    const parsed = parseJsonWithoutDuplicateKeys(line, `${paths.journalPath}:${index + 1}`);
    return validateRunEvent(parsed, id, index + 1, `${paths.journalPath}:${index + 1}`);
  });
}

function tryReadRunEvents(projectRoot, runId, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const id = normalizeRunId(runId);
  const paths = tryRunDirectory(projectRoot, id, { fsOps });
  if (paths === null) return null;
  const stat = lstatOrNull(fsOps, paths.absoluteJournalPath);
  if (stat === null) return null;
  return readRunEvents(projectRoot, id, { fsOps });
}

export function appendRunEvents(projectRoot, runId, items, options = {}) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Dove run event append requires at least one event item.");
  const fsOps = options.fsOps ?? fs;
  const id = normalizeRunId(runId);
  const lock = acquireRunMutationLock(projectRoot, id, { fsOps });
  try {
    const paths = requireRunDirectory(projectRoot, id, { fsOps });
    const exists = lstatOrNull(fsOps, paths.absoluteJournalPath) !== null;
    const previousEvents = exists ? readRunEvents(projectRoot, id, { fsOps }) : [];
    if (options.requireExisting === true && previousEvents.length === 0) throw new Error(`Dove run journal does not exist: ${paths.journalPath}`);
    if (typeof options.precondition === "function") options.precondition(previousEvents);
    const appended = [];
    for (const [index, item] of items.entries()) {
      if (!plainObject(item)) throw new Error(`Dove run event append item ${index} must be an object.`);
      const { type, payload = {} } = item;
      if (typeof type !== "string" || !type.trim() || type.includes("\0")) throw new Error("Dove run event type must be a non-empty string.");
      const resolvedPayload = typeof payload === "function" ? payload([...previousEvents, ...appended]) : payload;
      if (!plainObject(resolvedPayload)) throw new Error("Dove run event payload must be a plain object.");
      const forbidden = Object.keys(resolvedPayload).filter((field) => RESERVED_EVENT_FIELDS.has(field));
      if (forbidden.length > 0) throw new Error(`Dove run event payload cannot override public fields: ${forbidden.join(", ")}.`);
      appended.push({
        schemaVersion: RUN_EVENT_SCHEMA_VERSION,
        seq: previousEvents.length + appended.length + 1,
        at: exactIsoTimestamp(options.now ?? new Date()),
        type,
        runId: id,
        ...resolvedPayload
      });
    }
    fsOps.appendFileSync(paths.absoluteJournalPath, appended.map((event) => JSON.stringify(event)).join("\n") + "\n", { encoding: "utf8", mode: 0o600 });
    return appended;
  } finally {
    lock.release();
  }
}

export function appendRunEvent(projectRoot, runId, type, payload = {}, options = {}) {
  return appendRunEvents(projectRoot, runId, [{ type, payload }], options)[0];
}

export function normalizeRunCommandArgv(rawArgv) {
  if (!Array.isArray(rawArgv) || rawArgv.length === 0) throw new Error("dove run start requires a command after '--'.");
  const argv = rawArgv.map((item) => String(item));
  for (const [index, item] of argv.entries()) {
    if (!item || item.includes("\0")) throw new Error(`Dove run command argv[${index}] must be a non-empty string without NUL bytes.`);
  }
  return argv;
}

export function parseWallTime(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new Error("--wall-time must be a duration such as 500ms, 2s, 10m, or 1h.");
  const match = value.trim().match(/^(\d+)(ms|s|m|h)?$/iu);
  if (!match) throw new Error("--wall-time must be a duration such as 500ms, 2s, 10m, or 1h.");
  const amount = Number(match[1]);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("--wall-time must be a positive duration.");
  const unit = (match[2] ?? "ms").toLowerCase();
  const multiplier = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }[unit];
  const milliseconds = amount * multiplier;
  if (!Number.isSafeInteger(milliseconds) || milliseconds > RUN_TIMER_MAX_MS) throw new Error(`--wall-time must be at most ${RUN_TIMER_MAX_MS}ms (Node.js timer limit).`);
  return milliseconds;
}

export function normalizeRunBudget(options = {}) {
  const timeoutMsFromNumber = positiveIntegerOrNull(options.timeoutMs, "--timeout-ms");
  if (timeoutMsFromNumber > RUN_TIMER_MAX_MS) throw new Error(`--timeout-ms must be at most ${RUN_TIMER_MAX_MS}ms (Node.js timer limit).`);
  const timeoutMsFromWallTime = parseWallTime(options.wallTime);
  if (timeoutMsFromNumber !== null && timeoutMsFromWallTime !== null) throw new Error("Use only one of --timeout-ms or --wall-time for a Dove run.");
  const timeoutMs = timeoutMsFromNumber ?? timeoutMsFromWallTime;
  const killGraceMs = options.killGraceMs === undefined || options.killGraceMs === null || options.killGraceMs === ""
    ? 5000
    : nonNegativeInteger(options.killGraceMs, "--kill-grace-ms");
  if (killGraceMs > RUN_TIMER_MAX_MS) throw new Error(`--kill-grace-ms must be at most ${RUN_TIMER_MAX_MS}ms (Node.js timer limit).`);
  return { timeoutMs, killGraceMs };
}

export function normalizeRunMetricSpec(options = {}) {
  const name = sanitizeOptionalText(options.metricName ?? options.name, "--metric-name", { max: 200 });
  const direction = sanitizeOptionalText(options.direction, "--direction", { max: 3 });
  const unit = sanitizeOptionalText(options.metricUnit ?? options.unit, "--metric-unit", { max: 80 });
  if ((direction !== null || unit !== null) && name === null) throw new Error("--direction and --metric-unit require --metric-name.");
  if (name !== null && !["min", "max"].includes(direction ?? "")) throw new Error("--metric-name requires --direction min or --direction max.");
  return name === null ? { name: null, direction: null, unit: null } : { name, direction, unit };
}

export function normalizeRunBasis(options = {}) {
  return {
    data: sanitizeOptionalText(options.data, "--data", { max: 500 }),
    evaluator: sanitizeOptionalText(options.evaluator, "--evaluator", { max: 500 }),
    resourceBasis: sanitizeOptionalText(options.resourceBasis, "--resource-basis", { max: 500 })
  };
}

export function normalizeRunSeed(value) {
  if (typeof value === "string" && /[\x00-\x1f\x7f-\x9f]/u.test(value)) throw new Error("--seed must not contain control characters.");
  const text = sanitizeOptionalText(value, "--seed", { max: RUN_SEED_MAX_LENGTH });
  return text === null
    ? { declaration: "not-declared", value: null }
    : { declaration: "declared", value: text };
}

export function normalizeRunGroup(value) {
  return sanitizeOptionalText(value, "--group", { max: 200 });
}

export function normalizeFinalizeInput(options = {}, startedMetric = { name: null, direction: null, unit: null }) {
  const metricValue = finiteNumber(options.metricValue, "--metric-value");
  const explicitMetric = normalizeRunMetricSpec(options);
  const name = explicitMetric.name ?? startedMetric?.name ?? null;
  const direction = explicitMetric.direction ?? startedMetric?.direction ?? null;
  const unit = explicitMetric.name === null ? startedMetric?.unit ?? null : explicitMetric.unit;
  if (typeof name !== "string" || !name || !["min", "max"].includes(direction)) {
    throw new Error("dove run finalize requires a metric name and direction, either from run start or from --metric-name and --direction.");
  }
  if (startedMetric?.name !== null && startedMetric?.name !== undefined) {
    if (name !== startedMetric.name || direction !== startedMetric.direction || (unit ?? null) !== (startedMetric.unit ?? null)) {
      throw new Error("dove run finalize metric definition must match the metric recorded at run start.");
    }
  }
  return {
    metric: { name, direction, unit: unit ?? null, value: metricValue },
    decision: sanitizeOptionalText(options.decision, "--decision", { max: FINAL_DECISIONS_MAX_LENGTH }),
    note: sanitizeOptionalText(options.note, "--note", { max: FINAL_NOTE_MAX_LENGTH })
  };
}

function terminalEventFrom(events) {
  return events.filter((event) => event.type === "run.terminal").at(-1) ?? null;
}

function reconciledEventFrom(events) {
  return events.filter((event) => event.type === "run.reconciled").at(-1) ?? null;
}

function finalizedEventFrom(events) {
  return events.filter((event) => event.type === "run.finalized").at(-1) ?? null;
}

function startedEventFrom(events) {
  return events.find((event) => event.type === "run.started") ?? null;
}

function normalizeStartedSeed(started) {
  try {
    return normalizeRunSeed(plainObject(started.seed) && started.seed.declaration === "declared" ? started.seed.value : null);
  } catch {
    return normalizeRunSeed(null);
  }
}

function normalizeStartedEventFacts(started, projectRoot) {
  const legacyGit = plainObject(started?.environment?.git) ? started.environment.git : {};
  const git = normalizeRunGitFacts({
    commit: Object.hasOwn(started, "commit") ? started.commit : legacyGit.fullHead,
    dirty: Object.hasOwn(started, "dirty") ? started.dirty : legacyGit.dirty
  });
  return {
    group: started.group ?? null,
    argv: Array.isArray(started.argv) ? [...started.argv] : [],
    cwd: started.cwd ?? projectRoot,
    budget: started.budget ?? { timeoutMs: null, killGraceMs: null },
    metric: started.metric ?? { name: null, direction: null, unit: null },
    data: started.data ?? null,
    evaluator: started.evaluator ?? null,
    resourceBasis: started.resourceBasis ?? null,
    seed: normalizeStartedSeed(started),
    commit: git.commit,
    dirty: git.dirty,
    supervisorPid: started.supervisorPid ?? null,
    startedAt: started.at
  };
}

function targetEventFrom(events) {
  return events.filter((event) => event.type === "target.started").at(-1) ?? null;
}

function timeoutEventFrom(events) {
  return events.filter((event) => event.type === "timeout.requested").at(-1) ?? null;
}

function summarizeStatus(projectRoot, runId, events) {
  const started = startedEventFrom(events);
  if (!started) throw new Error(`Dove run ${runId} has no run.started event.`);
  const startedFacts = normalizeStartedEventFacts(started, projectRoot);
  const target = targetEventFrom(events);
  const timeout = timeoutEventFrom(events);
  const terminal = terminalEventFrom(events);
  const reconciled = reconciledEventFrom(events);
  const finalized = finalizedEventFrom(events);
  const supervisorObservation = observePid(startedFacts.supervisorPid);
  const recordedTargetPid = target?.targetPid ?? terminal?.targetPid ?? reconciled?.targetPid ?? null;
  const targetObservation = observePid(recordedTargetPid);
  let status;
  let lifecycle;
  if (terminal) {
    status = terminal.outcome ?? terminal.status ?? "terminal";
    lifecycle = "terminal";
  } else if (reconciled?.terminal === true) {
    status = reconciled.outcome ?? reconciled.status ?? "interrupted";
    lifecycle = "terminal";
  } else if (supervisorObservation.alive) {
    status = target ? "running" : "starting";
    lifecycle = "active";
  } else if (targetObservation.alive) {
    status = "orphaned";
    lifecycle = "blocked";
  } else {
    status = "unreconciled";
    lifecycle = "needs-reconcile";
  }
  const paths = runRelativePaths(runId);
  return {
    runId,
    project: projectRoot,
    status,
    lifecycle,
    terminal: terminal !== null || reconciled?.terminal === true,
    finalized: finalized !== null,
    outcome: terminal?.outcome ?? reconciled?.outcome ?? null,
    exitCode: terminal?.exitCode ?? reconciled?.exitCode ?? null,
    signal: terminal?.signal ?? reconciled?.signal ?? null,
    group: startedFacts.group,
    argv: startedFacts.argv,
    cwd: startedFacts.cwd,
    budget: startedFacts.budget,
    metric: finalized?.metric ?? startedFacts.metric,
    startMetric: startedFacts.metric,
    data: startedFacts.data,
    evaluator: startedFacts.evaluator,
    resourceBasis: startedFacts.resourceBasis,
    seed: startedFacts.seed,
    commit: startedFacts.commit,
    dirty: startedFacts.dirty,
    startedAt: startedFacts.startedAt,
    terminalAt: terminal?.at ?? reconciled?.at ?? null,
    finalizedAt: finalized?.at ?? null,
    supervisorPid: startedFacts.supervisorPid,
    targetPid: recordedTargetPid,
    pidObservation: {
      supervisor: supervisorObservation,
      target: targetObservation,
      note: "PID liveness is observation only and is not a strong process identity."
    },
    timeoutTriggered: timeout !== null,
    paths,
    eventCount: events.length,
    latestEventType: events.at(-1)?.type ?? null
  };
}

export function summarizeRun(projectRoot, runId, options = {}) {
  const events = readRunEvents(projectRoot, runId, options);
  return summarizeStatus(projectRoot, normalizeRunId(runId), events);
}

function runsRootEntries(projectRoot, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const runsRoot = path.join(projectRoot, RUNS_DIRECTORY_PATH);
  const stat = lstatOrNull(fsOps, runsRoot);
  if (stat === null) return [];
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Dove runs directory must be a real directory: ${RUNS_DIRECTORY_PATH}`);
  return fsOps.readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => {
      if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(`Dove run entry must be a real directory: ${RUNS_DIRECTORY_PATH}/${entry.name}`);
      return normalizeRunId(entry.name);
    })
    .sort();
}

export function listRunSummaries(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const projectRoot = normalizeRunProject(options.project, options);
  const group = normalizeRunGroup(options.group);
  const runs = [];
  for (const runId of runsRootEntries(projectRoot, { fsOps })) {
    const events = tryReadRunEvents(projectRoot, runId, { fsOps });
    if (events === null) continue;
    const summary = summarizeStatus(projectRoot, runId, events);
    if (group !== null && summary.group !== group) continue;
    runs.push(summary);
  }
  return { command: "status", status: "ok", project: projectRoot, group, runs };
}

function readRunStartMetadata(projectRoot, runId, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const paths = requireRunDirectory(projectRoot, runId, { fsOps });
  assertRegularFile(fsOps, paths.absoluteJournalPath, "Dove run journal");
  const fd = fsOps.openSync(paths.absoluteJournalPath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
  try {
    if (!fsOps.fstatSync(fd).isFile()) throw new Error("Dove run journal must be a regular file.");
    const chunks = [];
    while (true) {
      const buffer = Buffer.alloc(1024);
      const count = fsOps.readSync(fd, buffer, 0, buffer.length, null);
      if (count === 0) throw new Error("Dove run journal has no complete start event.");
      const bytes = buffer.subarray(0, count);
      const newline = bytes.indexOf(10);
      chunks.push(newline === -1 ? bytes : bytes.subarray(0, newline));
      if (newline === -1) continue;
      const label = `${paths.journalPath}:1`;
      const started = validateRunEvent(parseJsonWithoutDuplicateKeys(Buffer.concat(chunks).toString("utf8"), label), runId, 1, label);
      if (started.type !== "run.started" || typeof started.at !== "string") throw new Error("Dove run journal must start with a timestamped run.started event.");
      return { runId, startedAt: started.at };
    }
  } finally {
    fsOps.closeSync(fd);
  }
}

export function inspectLatestRunFacts(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const projectRoot = normalizeRunProject(options.project, options);
  let latest = null;
  // Unknown start metadata makes selection unavailable; do not silently skip a
  // candidate. Historical tails and PID observations are irrelevant to ordering.
  for (const runId of runsRootEntries(projectRoot, { fsOps })) {
    const started = readRunStartMetadata(projectRoot, runId, { fsOps });
    if (!latest || started.startedAt > latest.startedAt) latest = started;
  }
  if (!latest) return null;
  const summary = summarizeRun(projectRoot, latest.runId, { fsOps });
  if (summary.startedAt !== latest.startedAt) throw new Error("Latest Dove run start changed while reading its summary.");
  return { runId: summary.runId, startedAt: summary.startedAt, status: summary.status, exitCode: summary.exitCode };
}

export function inspectRunStatus(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const projectRoot = normalizeRunProject(options.project, options);
  if (options.id !== undefined && options.id !== null) {
    if (options.group !== undefined && options.group !== null) throw new Error("Use only one of --id or --group for dove run status.");
    const runId = normalizeRunId(options.id);
    return { command: "status", ...summarizeRun(projectRoot, runId, { fsOps }) };
  }
  return listRunSummaries({ ...options, fsOps, project: projectRoot });
}

export function appendReconciledInterrupted(projectRoot, runId, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const id = normalizeRunId(runId);
  const event = appendRunEvent(projectRoot, id, "run.reconciled", {
    outcome: "interrupted",
    status: "interrupted",
    terminal: true,
    reason: "supervisor-and-target-not-observed",
    observed: {
      supervisorPid: options.supervisorPid ?? null,
      targetPid: options.targetPid ?? null,
      supervisorAlive: false,
      targetAlive: false,
      pidIdentity: "pid-only"
    },
    reconcilerPid: process.pid
  }, {
    fsOps,
    requireExisting: true,
    now: options.now,
    operation: "reconcile",
    precondition(events) {
      if (terminalEventFrom(events) || reconciledEventFrom(events)?.terminal === true) throw new Error(`Dove run ${id} is already terminal.`);
      if (events.some((item) => item.type === "run.reconciled")) throw new Error(`Dove run ${id} has already been reconciled.`);
    }
  });
  return { event, summary: summarizeRun(projectRoot, id, { fsOps }) };
}

export function appendFinalizedRun(projectRoot, runId, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const root = normalizeRunProject(projectRoot, { fsOps, cwd: options.cwd });
  const id = normalizeRunId(runId);
  const event = appendRunEvent(root, id, "run.finalized", (events) => {
    const started = startedEventFrom(events);
    if (!started) throw new Error(`Dove run ${id} has no run.started event.`);
    return normalizeFinalizeInput(options, started.metric ?? { name: null, direction: null, unit: null });
  }, {
    fsOps,
    requireExisting: true,
    now: options.now,
    operation: "finalize",
    precondition(events) {
      if (!startedEventFrom(events)) throw new Error(`Dove run ${id} has no run.started event.`);
      if (!terminalEventFrom(events) && reconciledEventFrom(events)?.terminal !== true) throw new Error(`dove run finalize requires a terminal run: ${id}`);
      if (finalizedEventFrom(events)) throw new Error(`Dove run ${id} is already finalized.`);
    }
  });
  return { event, summary: summarizeRun(root, id, { fsOps }) };
}

function compareBasis(summary) {
  const metric = summary.metric ?? {};
  return {
    metric: { name: metric.name ?? null, direction: metric.direction ?? null, unit: metric.unit ?? null },
    budget: summary.budget ?? { timeoutMs: null, killGraceMs: null },
    data: summary.data ?? null,
    evaluator: summary.evaluator ?? null,
    resourceBasis: summary.resourceBasis ?? null
  };
}

function mismatchFields(summaries) {
  if (summaries.length <= 1) return [];
  const baseline = compareBasis(summaries[0]);
  return Object.keys(baseline).filter((field) => summaries.some((summary) => stableJson(compareBasis(summary)[field]) !== stableJson(baseline[field])));
}

function selectedRunIds(projectRoot, options = {}) {
  const explicitIds = Array.isArray(options.ids) ? options.ids.map(normalizeRunId) : [];
  if (explicitIds.length > 0 && options.group !== undefined && options.group !== null) throw new Error("Use only one of --id or --group for dove run compare.");
  const byGroup = options.group === undefined || options.group === null ? [] : listRunSummaries({ ...options, project: projectRoot }).runs.map((run) => run.runId);
  return [...new Set([...explicitIds, ...byGroup])].sort();
}

export function compareRuns(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const projectRoot = normalizeRunProject(options.project, options);
  const runIds = selectedRunIds(projectRoot, { ...options, fsOps });
  if (runIds.length === 0) {
    return { command: "compare", status: "ok", comparable: false, fields: ["selection"], project: projectRoot, group: options.group ?? null, runIds, runs: [], message: "No Dove runs were selected for comparison." };
  }
  const summaries = runIds.map((runId) => summarizeRun(projectRoot, runId, { fsOps }));
  const notReady = summaries.filter((summary) => !summary.terminal || !summary.finalized || typeof summary.metric?.value !== "number" || !Number.isFinite(summary.metric.value));
  if (notReady.length > 0) {
    return {
      command: "compare",
      status: "ok",
      comparable: false,
      fields: ["state"],
      project: projectRoot,
      group: options.group ?? null,
      runIds,
      runs: summaries.map((summary) => ({ runId: summary.runId, status: summary.status, terminal: summary.terminal, finalized: summary.finalized, metric: summary.metric, commit: summary.commit, dirty: summary.dirty }))
    };
  }
  const fields = mismatchFields(summaries);
  if (fields.length > 0) {
    return {
      command: "compare",
      status: "ok",
      comparable: false,
      fields,
      project: projectRoot,
      group: options.group ?? null,
      runIds,
      runs: summaries.map((summary) => ({ runId: summary.runId, basis: compareBasis(summary), metric: summary.metric, status: summary.status, commit: summary.commit, dirty: summary.dirty }))
    };
  }
  const basis = compareBasis(summaries[0]);
  const direction = basis.metric.direction;
  const ranked = [...summaries].sort((left, right) => {
    const delta = direction === "min" ? left.metric.value - right.metric.value : right.metric.value - left.metric.value;
    return delta || left.runId.localeCompare(right.runId);
  });
  const best = ranked[0].metric.value;
  const ranking = ranked.map((summary, index) => {
    const delta = direction === "min" ? summary.metric.value - best : best - summary.metric.value;
    return {
      rank: index + 1,
      runId: summary.runId,
      status: summary.status,
      metricValue: summary.metric.value,
      commit: summary.commit,
      dirty: summary.dirty,
      deltaFromBest: Number.isFinite(delta) ? delta : null,
      stdoutPath: summary.paths.stdoutPath,
      stderrPath: summary.paths.stderrPath
    };
  });
  return { command: "compare", status: "ok", comparable: true, fields: [], project: projectRoot, group: options.group ?? null, runIds, basis, ranking };
}
