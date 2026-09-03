import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { DOVE_REVIEW_BACKEND_ID, runClaudeReviewBackend } from "./review-claude-backend.mjs";
import { createReviewSnapshot } from "./review-snapshot.mjs";
import { assertReviewWorkspaceMatchesSnapshot, createReviewId, finalizePreparedReviewWorkspace, normalizeReviewId, prepareReviewWorkspace, resolveReviewStateRoot, restorePreparedReviewWorkspace } from "./review-workspace.mjs";
import { writeFileSetTransaction } from "./file-set-transaction.mjs";
import { resolveInstalledProjectRoot } from "./project-root.mjs";
import { openRootedFilesystem } from "./rooted-filesystem.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";
import { renderDoveAgentInstructions } from "./dove-agent-persona.mjs";

const REVIEW_RECORD_SCHEMA = "dove.review.record.v1";
const IMPORTED_SNAPSHOT_SCHEMA = "dove.review.imported-snapshot.v1";
const LOCAL_BACKEND_ID = "dove-review-runtime";

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function exactIsoTimestamp(value = new Date()) {
  const timestamp = value instanceof Date ? value.toISOString() : value;
  if (typeof timestamp !== "string" || new Date(timestamp).toISOString() !== timestamp) throw new Error("Dove review runtime timestamp must be an exact ISO timestamp.");
  return timestamp;
}

function reviewBasePath(reviewId) {
  return `.dove/reviews/${normalizeReviewId(reviewId)}`;
}

function roundBasePath(reviewId, round) {
  if (!Number.isInteger(round) || round < 1) throw new Error("Dove review round must be a positive integer.");
  return `${reviewBasePath(reviewId)}/rounds/${round}`;
}

function reviewPath(reviewId) {
  return `${reviewBasePath(reviewId)}/review.json`;
}

function roundPaths(reviewId, round) {
  const base = roundBasePath(reviewId, round);
  return {
    snapshot: `${base}/snapshot.json`,
    report: `${base}/report.md`,
    backend: `${base}/backend.json`
  };
}

function roundAttemptPaths(reviewId, round, attempt) {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Dove review attempt must be a positive integer.");
  const base = `${roundBasePath(reviewId, round)}/attempts/${attempt}`;
  return {
    report: `${base}/report.md`,
    backend: `${base}/backend.json`
  };
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function materialLines(snapshot) {
  return snapshot.materials.map((material) => `- ${material.path} (${material.size} bytes, sha256 ${material.sha256})`).join("\n");
}

function promptForRound(options) {
  const materialList = materialLines(options.snapshot);
  const operationLine = options.operation === "resume"
    ? "Continue the current frozen round in this same reviewer session. Re-read the listed current materials as needed before updating the review."
    : options.operation === "rerun"
      ? "This is a new full-material round in the same reviewer session. Review the complete current submission again, not just a diff."
      : "This is the initial full-material review round for this isolated reviewer session.";
  return `${renderDoveAgentInstructions()}\n\n# Independent dove-review task\n\nYou are running in a separate Claude Code reviewer session for Dove's isolated \`dove-review\` path. Review only the copied materials in this workspace. Do not use author private conversation, author research notes, prior reviews, hidden settings, CLAUDE.md, transcripts, web tools, shell commands, Edit, Write, Bash, MCP, or any unlisted path. Your available tool is Read, and the large files are intentionally not inlined here.\n\nTarget venue: ${options.venue ?? "not specified"}\nReview id: ${options.reviewId}\nRound: ${options.round}\n\n${operationLine}\n\nFrozen materials for this round:\n${materialList || "- No project materials were listed for this imported-only record."}\n\nReturn Markdown only. Read the whole current manuscript/submission represented by these files. Separate the judgment into at least these two top-level concerns in natural language:\n\n1. Scientific acceptability: contribution, novelty, claims, evidence, methods, experiments, limitations, related work, likely reader objections, and whether the paper should be accepted scientifically at the target venue.\n2. Delivery readiness: venue-facing package, formatting, build/output, completeness of submission materials, anonymity or author fields when relevant, figures/tables/assets, and other handoff or submission problems.\n\nAlso include the strongest objections, evidence needed to resolve them, and concrete author-side next actions. Do not edit files and do not claim external acceptance or certification.\n`;
}

function normalizeProject(project, options = {}) {
  return resolveInstalledProjectRoot(project ?? options.cwd ?? process.cwd(), { fsOps: options.fsOps ?? fs });
}

function absentFileState() {
  return { exists: false, type: "absent", sha256: null, mode: null };
}

function fileState(projectRoot, relativePath, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const anchor = openRootedFilesystem(projectRoot, { fsOps });
  const stat = anchor.tryLstat(relativePath);
  if (!stat) return absentFileState();
  if (stat.isSymbolicLink()) throw new Error(`Dove review state path must not be a symbolic link: ${relativePath}`);
  if (stat.isDirectory()) return { exists: true, type: "directory", sha256: null, mode: stat.mode & 0o7777 };
  if (!stat.isFile()) throw new Error(`Dove review state path must be absent, a directory, or a regular file: ${relativePath}`);
  const bytes = anchor.readFile(relativePath);
  return { exists: true, type: "file", sha256: sha256(bytes), mode: stat.mode & 0o7777 };
}

function readReviewRecordWithState(projectRoot, reviewId, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const anchor = openRootedFilesystem(projectRoot, { fsOps });
  const pathName = reviewPath(reviewId);
  const stat = anchor.tryLstat(pathName);
  if (!stat) return { record: null, expectedState: absentFileState() };
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Dove review record must be a regular non-symlink file: ${pathName}`);
  const bytes = anchor.readFile(pathName);
  const value = parseJsonWithoutDuplicateKeys(bytes.toString("utf8"), pathName);
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schema !== REVIEW_RECORD_SCHEMA || value.id !== normalizeReviewId(reviewId)) {
    throw new Error(`Dove review record is not a valid Dove review record: ${pathName}`);
  }
  return { record: value, expectedState: { exists: true, type: "file", sha256: sha256(bytes), mode: stat.mode & 0o7777 } };
}

function readReviewRecord(projectRoot, reviewId, options = {}) {
  return readReviewRecordWithState(projectRoot, reviewId, options).record;
}

function requireReviewRecordWithState(projectRoot, reviewId, options = {}) {
  const result = readReviewRecordWithState(projectRoot, reviewId, options);
  if (result.record === null) throw new Error(`Dove review record does not exist: ${reviewPath(reviewId)}`);
  return result;
}

function requireReviewRecord(projectRoot, reviewId, options = {}) {
  return requireReviewRecordWithState(projectRoot, reviewId, options).record;
}

function readSnapshot(projectRoot, reviewId, round, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const anchor = openRootedFilesystem(projectRoot, { fsOps });
  const pathName = roundPaths(reviewId, round).snapshot;
  const value = parseJsonWithoutDuplicateKeys(anchor.readFile(pathName).toString("utf8"), pathName);
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.materials)) throw new Error(`Dove review snapshot is invalid: ${pathName}`);
  return value;
}

function writeReviewFiles(projectRoot, files, options = {}) {
  const entries = files.map((file) => ({
    root: projectRoot,
    relativePath: file.relativePath,
    content: file.content,
    encoding: file.encoding,
    force: true,
    ...(file.expectedState ? { expectedState: file.expectedState } : {}),
    label: "Dove review record path"
  }));
  return writeFileSetTransaction(entries, { fsOps: options.fsOps ?? fs, transactionBase: ".dove/reviews/.transactions" });
}

function reportBytesForOutcome(outcome) {
  if (outcome.status === "completed") return Buffer.from(outcome.report, "utf8");
  return Buffer.from(`# Dove review runtime failure\n\nNo reviewer report was generated. See \`backend.json\` for the backend error.\n`, "utf8");
}

function makeRoundRecord(options) {
  const paths = roundPaths(options.reviewId, options.round);
  return {
    round: options.round,
    status: options.status,
    provenance: options.provenance,
    venue: options.venue ?? null,
    createdAt: options.createdAt,
    updatedAt: options.updatedAt,
    snapshotPath: paths.snapshot,
    reportPath: paths.report,
    backendPath: paths.backend,
    latestReportPath: options.latestReportPath ?? paths.report,
    latestBackendPath: options.latestBackendPath ?? paths.backend,
    materials: options.materials,
    reportSha256: options.reportSha256,
    sessionId: options.sessionId ?? null,
    imported: options.provenance === "imported",
    attempts: Array.isArray(options.attempts) ? options.attempts : []
  };
}

function nextAttemptNumber(roundRecord) {
  const attempts = Array.isArray(roundRecord?.attempts) ? roundRecord.attempts : [];
  const max = attempts.reduce((current, attempt) => Number.isInteger(attempt?.attempt) && attempt.attempt > current ? attempt.attempt : current, 0);
  return max + 1;
}

function makeAttemptRecord(options) {
  const paths = roundAttemptPaths(options.reviewId, options.round, options.attempt);
  return {
    attempt: options.attempt,
    status: options.status,
    provenance: options.provenance,
    createdAt: options.createdAt,
    reportPath: paths.report,
    backendPath: paths.backend,
    reportSha256: options.reportSha256,
    sessionId: options.sessionId ?? null
  };
}

function upsertRound(record, roundRecord) {
  const existing = Array.isArray(record.rounds) ? record.rounds.filter((item) => item.round !== roundRecord.round) : [];
  return [...existing, roundRecord].sort((left, right) => left.round - right.round);
}

function recordStatusFromRound(roundRecord) {
  if (roundRecord.provenance === "imported") return "imported";
  return roundRecord.status;
}

function updateRecordForRound(record, roundRecord, options = {}) {
  const sessionId = typeof options.sessionId === "string" && options.sessionId.trim()
    ? options.sessionId
    : record.session?.sessionId ?? null;
  return {
    ...record,
    venue: roundRecord.venue ?? record.venue ?? null,
    updatedAt: roundRecord.updatedAt,
    status: recordStatusFromRound(roundRecord),
    currentRound: roundRecord.round,
    session: {
      backend: record.session?.backend ?? DOVE_REVIEW_BACKEND_ID,
      sessionId
    },
    rounds: upsertRound(record, roundRecord)
  };
}

function newRecord(options) {
  return {
    schema: REVIEW_RECORD_SCHEMA,
    id: options.reviewId,
    projectRoot: options.projectRoot,
    venue: options.venue ?? null,
    createdAt: options.createdAt,
    updatedAt: options.updatedAt,
    status: "pending",
    currentRound: 0,
    session: { backend: DOVE_REVIEW_BACKEND_ID, sessionId: null },
    rounds: []
  };
}

function localBackendFailure(error, options = {}) {
  const message = error instanceof Error ? error.message : String(error);
  const now = exactIsoTimestamp(options.now ?? new Date());
  return {
    schema: "dove.review.backend.v1",
    backend: LOCAL_BACKEND_ID,
    status: "failed",
    startedAt: now,
    completedAt: now,
    error: message
  };
}

function writeRuntimeRound(projectRoot, record, snapshot, backend, reportBytes, options = {}) {
  const now = exactIsoTimestamp(options.now ?? new Date());
  const round = options.round;
  const reportSha = sha256(reportBytes);
  const status = backend.status === "completed" ? "completed" : "failed";
  const existingRound = Array.isArray(record.rounds) ? record.rounds.find((item) => item.round === round) : null;
  const appendAttempt = options.preserveCurrentRoundReturn === true && existingRound;
  const paths = appendAttempt ? roundAttemptPaths(record.id, round, nextAttemptNumber(existingRound)) : roundPaths(record.id, round);
  const attempts = appendAttempt
    ? [
      ...(Array.isArray(existingRound.attempts) ? existingRound.attempts : []),
      makeAttemptRecord({
        reviewId: record.id,
        round,
        attempt: nextAttemptNumber(existingRound),
        status,
        provenance: "runtime",
        createdAt: now,
        reportSha256: reportSha,
        sessionId: backend.sessionId ?? null
      })
    ]
    : Array.isArray(existingRound?.attempts) ? existingRound.attempts : [];
  const roundRecord = appendAttempt
    ? {
      ...existingRound,
      status,
      updatedAt: now,
      latestReportPath: paths.report,
      latestBackendPath: paths.backend,
      sessionId: backend.sessionId ?? existingRound.sessionId ?? null,
      attempts
    }
    : makeRoundRecord({
      reviewId: record.id,
      round,
      status,
      provenance: "runtime",
      venue: snapshot.venue ?? record.venue,
      createdAt: options.roundCreatedAt ?? now,
      updatedAt: now,
      materials: snapshot.materials,
      reportSha256: reportSha,
      latestReportPath: paths.report,
      latestBackendPath: paths.backend,
      sessionId: backend.sessionId ?? null,
      attempts
    });
  const nextRecord = updateRecordForRound(record, roundRecord, { sessionId: backend.sessionId });
  const recordState = options.recordExpectedState ?? fileState(projectRoot, reviewPath(record.id), options);
  const writeEntries = [
    { relativePath: paths.report, content: reportBytes, expectedState: absentFileState() },
    { relativePath: paths.backend, content: serializeJson(backend), encoding: "utf8", expectedState: absentFileState() },
    { relativePath: reviewPath(record.id), content: serializeJson(nextRecord), encoding: "utf8", expectedState: recordState }
  ];
  if (!appendAttempt) writeEntries.unshift({ relativePath: roundPaths(record.id, round).snapshot, content: serializeJson(snapshot), encoding: "utf8", expectedState: absentFileState() });
  writeReviewFiles(projectRoot, writeEntries, options);
  return { record: nextRecord, round: roundRecord, reportPath: paths.report, backendPath: paths.backend, snapshotPath: roundPaths(record.id, round).snapshot };
}

function sessionIdOrThrow(record) {
  const sessionId = record.session?.sessionId;
  if (typeof sessionId !== "string" || !sessionId.trim()) throw new Error(`Dove review ${record.id} has no real runtime reviewer session id to resume.`);
  return sessionId;
}

function assertCurrentRoundCanUseRuntime(record) {
  const round = record.currentRound;
  const current = Array.isArray(record.rounds) ? record.rounds.find((item) => item.round === round) : null;
  if (!current) throw new Error(`Dove review ${record.id} is missing the current round record and cannot use runtime continuity safely.`);
  if (current.provenance !== "runtime") throw new Error(`Dove review ${record.id} current round is ${current.provenance}; import another return or start a new runtime review id instead of resuming runtime continuity from imported material.`);
  return current;
}

function stateRootOptions(options = {}) {
  return {
    fsOps: options.fsOps ?? fs,
    env: options.env ?? process.env,
    ...(options.stateRoot ? { stateRoot: options.stateRoot } : {}),
    ...(options.projectRoot ? { projectRoot: options.projectRoot } : {})
  };
}

function ensureLockRoot(stateRootFs) {
  const lockRoot = ".locks";
  const stat = stateRootFs.tryLstat(lockRoot);
  if (stat) {
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Dove review lock root must be a real directory.");
    return lockRoot;
  }
  try {
    stateRootFs.mkdir(lockRoot, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const raced = stateRootFs.tryLstat(lockRoot);
    if (!raced || raced.isSymbolicLink() || !raced.isDirectory()) throw new Error("Dove review lock root must be a real directory.");
  }
  return lockRoot;
}

function acquireReviewMutationLock(reviewId, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const stateRoot = resolveReviewStateRoot(stateRootOptions(options));
  const stateRootFs = openRootedFilesystem(stateRoot, { fsOps });
  const lockRoot = ensureLockRoot(stateRootFs);
  const lockPath = `${lockRoot}/${normalizeReviewId(reviewId)}.lock`;
  try {
    stateRootFs.mkdir(lockPath, { mode: 0o700 });
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error(`Dove review ${reviewId} already has an active operation or stale runtime lock: ${stateRootFs.displayPath(lockPath)}`);
    throw error;
  }
  let released = false;
  return {
    release() {
      if (released) return;
      released = true;
      stateRootFs.remove(lockPath, { recursive: true, force: true });
    }
  };
}

function withReviewMutationLock(reviewId, options, callback) {
  const lock = acquireReviewMutationLock(reviewId, options);
  try {
    return callback();
  } finally {
    lock.release();
  }
}

function publicRound(round) {
  return {
    round: round.round,
    status: round.status,
    provenance: round.provenance,
    venue: round.venue,
    snapshotPath: round.snapshotPath,
    reportPath: round.reportPath,
    backendPath: round.backendPath,
    latestReportPath: round.latestReportPath ?? round.reportPath,
    latestBackendPath: round.latestBackendPath ?? round.backendPath,
    sessionId: round.sessionId,
    materials: round.materials,
    imported: round.imported,
    attempts: Array.isArray(round.attempts) ? round.attempts.map((attempt) => ({
      attempt: attempt.attempt,
      status: attempt.status,
      provenance: attempt.provenance,
      reportPath: attempt.reportPath,
      backendPath: attempt.backendPath,
      sessionId: attempt.sessionId
    })) : []
  };
}

function publicReviewResult(kind, projectRoot, review, round, extras = {}) {
  return {
    command: kind,
    status: review.status,
    project: projectRoot,
    reviewId: review.id,
    round: round?.round ?? review.currentRound,
    venue: review.venue,
    sessionId: review.session?.sessionId ?? null,
    provenance: round?.provenance ?? null,
    snapshotPath: round?.snapshotPath ?? null,
    reportPath: round?.reportPath ?? null,
    backendPath: round?.backendPath ?? null,
    materials: round?.materials ?? [],
    ...extras
  };
}

export function handoffReview(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const projectRoot = normalizeProject(options.project, options);
  const reviewId = normalizeReviewId(options.id ?? createReviewId({ now: options.now }));
  return withReviewMutationLock(reviewId, { ...options, projectRoot }, () => {
    const existingRecord = readReviewRecordWithState(projectRoot, reviewId, { fsOps });
    if (existingRecord.record !== null) throw new Error(`Dove review record already exists: ${reviewPath(reviewId)}. Use resume or rerun.`);
    const reviewDirectoryState = fileState(projectRoot, reviewBasePath(reviewId), { fsOps });
    if (reviewDirectoryState.exists) throw new Error(`Dove review path already exists without a valid record: ${reviewBasePath(reviewId)}.`);
    const createdAt = exactIsoTimestamp(options.now ?? new Date());
    const { snapshot, files } = createReviewSnapshot({ projectRoot, reviewId, round: 1, venue: options.venue, materials: options.materials, now: createdAt, fsOps });
    const workspace = prepareReviewWorkspace({ reviewId, files, ...stateRootOptions({ ...options, projectRoot }) });
    const sessionId = options.sessionId ?? crypto.randomUUID();
    const prompt = promptForRound({ operation: "handoff", reviewId, round: 1, venue: options.venue, snapshot });
    const outcome = runClaudeReviewBackend({
      workspaceRoot: workspace.workspaceRoot,
      prompt,
      session: { sessionId },
      claudeCommand: options.claudeCommand,
      env: options.env,
      spawnSync: options.spawnSync,
      timeout: options.timeout
    });
    const record = newRecord({ reviewId, projectRoot, venue: options.venue, createdAt, updatedAt: createdAt });
    const reportBytes = reportBytesForOutcome(outcome);
    try {
      const written = writeRuntimeRound(projectRoot, record, snapshot, outcome.backend, reportBytes, { ...options, round: 1, roundCreatedAt: createdAt, recordExpectedState: existingRecord.expectedState });
      return publicReviewResult("handoff", projectRoot, written.record, written.round, { workspaceRoot: workspace.workspaceRoot });
    } catch (error) {
      restorePreparedReviewWorkspace(workspace, stateRootOptions({ ...options, projectRoot }));
      throw error;
    }
  });
}

export function resumeReview(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const projectRoot = normalizeProject(options.project, options);
  const reviewId = normalizeReviewId(options.id);
  return withReviewMutationLock(reviewId, { ...options, projectRoot }, () => {
    const { record, expectedState } = requireReviewRecordWithState(projectRoot, reviewId, { fsOps });
    const sessionId = sessionIdOrThrow(record);
    const round = record.currentRound;
    if (!Number.isInteger(round) || round < 1) throw new Error(`Dove review ${reviewId} has no current round to resume.`);
    const existingRound = assertCurrentRoundCanUseRuntime(record);
    const snapshot = readSnapshot(projectRoot, reviewId, round, { fsOps });
    let workspace;
    let outcome;
    try {
      workspace = assertReviewWorkspaceMatchesSnapshot({ reviewId, snapshot, ...stateRootOptions({ ...options, projectRoot }) });
      const prompt = promptForRound({ operation: "resume", reviewId, round, venue: record.venue, snapshot });
      outcome = runClaudeReviewBackend({
        workspaceRoot: workspace.workspaceRoot,
        prompt,
        session: { resumeSessionId: sessionId },
        claudeCommand: options.claudeCommand,
        env: options.env,
        spawnSync: options.spawnSync,
        timeout: options.timeout
      });
    } catch (error) {
      outcome = { status: "failed", report: null, sessionId: null, backend: localBackendFailure(error, options) };
    }
    const reportBytes = reportBytesForOutcome(outcome);
    const written = writeRuntimeRound(projectRoot, record, snapshot, outcome.backend, reportBytes, { ...options, round, roundCreatedAt: existingRound.createdAt ?? exactIsoTimestamp(options.now ?? new Date()), preserveCurrentRoundReturn: true, recordExpectedState: expectedState });
    return publicReviewResult("resume", projectRoot, written.record, written.round, { workspaceRoot: workspace?.workspaceRoot ?? null, latestReportPath: written.reportPath, latestBackendPath: written.backendPath });
  });
}

export function rerunReview(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const projectRoot = normalizeProject(options.project, options);
  const reviewId = normalizeReviewId(options.id);
  return withReviewMutationLock(reviewId, { ...options, projectRoot }, () => {
    const { record, expectedState } = requireReviewRecordWithState(projectRoot, reviewId, { fsOps });
    const sessionId = sessionIdOrThrow(record);
    const round = record.currentRound + 1;
    const createdAt = exactIsoTimestamp(options.now ?? new Date());
    const venue = options.venue ?? record.venue ?? null;
    const { snapshot, files } = createReviewSnapshot({ projectRoot, reviewId, round, venue, materials: options.materials, now: createdAt, fsOps });
    const workspaceOptions = stateRootOptions({ ...options, projectRoot });
    const workspace = prepareReviewWorkspace({ reviewId, files, keepPreviousWorkspaceBackup: true, ...workspaceOptions });
    try {
      const prompt = promptForRound({ operation: "rerun", reviewId, round, venue, snapshot });
      const outcome = runClaudeReviewBackend({
        workspaceRoot: workspace.workspaceRoot,
        prompt,
        session: { resumeSessionId: sessionId },
        claudeCommand: options.claudeCommand,
        env: options.env,
        spawnSync: options.spawnSync,
        timeout: options.timeout
      });
      const reportBytes = reportBytesForOutcome(outcome);
      const written = writeRuntimeRound(projectRoot, record, snapshot, outcome.backend, reportBytes, { ...options, round, roundCreatedAt: createdAt, recordExpectedState: expectedState });
      finalizePreparedReviewWorkspace(workspace, workspaceOptions);
      return publicReviewResult("rerun", projectRoot, written.record, written.round, { workspaceRoot: workspace.workspaceRoot });
    } catch (error) {
      restorePreparedReviewWorkspace(workspace, workspaceOptions);
      throw error;
    }
  });
}

function importFileBytes(filePath, options = {}) {
  if (typeof filePath !== "string" || !filePath.trim() || filePath.includes("\0")) throw new Error("dove review import requires --file <path>.");
  const fsOps = options.fsOps ?? fs;
  const resolved = path.resolve(options.cwd ?? process.cwd(), filePath);
  const stat = fsOps.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Dove review import file must be a regular non-symlink file: ${resolved}`);
  return { sourceFile: resolved, bytes: fsOps.readFileSync(resolved) };
}

function importedSnapshot(options) {
  if (Array.isArray(options.materials) && options.materials.length > 0) {
    return createReviewSnapshot({
      projectRoot: options.projectRoot,
      reviewId: options.reviewId,
      round: options.round,
      venue: options.venue,
      materials: options.materials,
      now: options.createdAt,
      fsOps: options.fsOps ?? fs
    }).snapshot;
  }
  return {
    schema: IMPORTED_SNAPSHOT_SCHEMA,
    reviewId: options.reviewId,
    round: options.round,
    projectRoot: options.projectRoot,
    venue: options.venue ?? null,
    createdAt: options.createdAt,
    imported: true,
    materials: []
  };
}

export function importReviewReturn(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const projectRoot = normalizeProject(options.project, options);
  const reviewId = normalizeReviewId(options.id);
  return withReviewMutationLock(reviewId, { ...options, projectRoot }, () => {
    const { record: existing, expectedState } = readReviewRecordWithState(projectRoot, reviewId, { fsOps });
    if (existing === null && fileState(projectRoot, reviewBasePath(reviewId), { fsOps }).exists) throw new Error(`Dove review path already exists without a valid record: ${reviewBasePath(reviewId)}.`);
    const createdAt = exactIsoTimestamp(options.now ?? new Date());
    const round = existing ? existing.currentRound + 1 : 1;
    const venue = options.venue ?? existing?.venue ?? null;
    const { sourceFile, bytes } = importFileBytes(options.file, { fsOps, cwd: options.cwd });
    const snapshot = importedSnapshot({ projectRoot, reviewId, round, venue, materials: options.materials, createdAt, fsOps });
    const backend = {
      schema: "dove.review.backend.v1",
      backend: null,
      status: "imported",
      provenance: "imported",
      runtimeGenerated: false,
      importedAt: createdAt,
      sourceFile,
      sessionId: null,
      error: null
    };
    const paths = roundPaths(reviewId, round);
    const reportSha = sha256(bytes);
    const roundRecord = makeRoundRecord({
      reviewId,
      round,
      status: "imported",
      provenance: "imported",
      venue,
      createdAt,
      updatedAt: createdAt,
      materials: snapshot.materials,
      reportSha256: reportSha,
      latestReportPath: paths.report,
      latestBackendPath: paths.backend,
      sessionId: null,
      attempts: []
    });
    const baseRecord = existing ?? newRecord({ reviewId, projectRoot, venue, createdAt, updatedAt: createdAt });
    const nextRecord = updateRecordForRound(baseRecord, roundRecord, { sessionId: baseRecord.session?.sessionId ?? null });
    writeReviewFiles(projectRoot, [
      { relativePath: paths.snapshot, content: serializeJson(snapshot), encoding: "utf8", expectedState: absentFileState() },
      { relativePath: paths.report, content: bytes, expectedState: absentFileState() },
      { relativePath: paths.backend, content: serializeJson(backend), encoding: "utf8", expectedState: absentFileState() },
      { relativePath: reviewPath(reviewId), content: serializeJson(nextRecord), encoding: "utf8", expectedState }
    ], options);
    return publicReviewResult("import", projectRoot, nextRecord, roundRecord, { sourceFile });
  });
}

function reviewRecordsDirectory(projectRoot, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const anchor = openRootedFilesystem(projectRoot, { fsOps });
  const stat = anchor.tryLstat(".dove/reviews");
  if (!stat) return [];
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Dove review records directory must be a real directory: .dove/reviews");
  return anchor.readdir(".dove/reviews", { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith(".") && entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => entry.name)
    .sort();
}

export function inspectReviewStatus(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const projectRoot = normalizeProject(options.project, options);
  if (options.id !== undefined && options.id !== null) {
    const reviewId = normalizeReviewId(options.id);
    const record = requireReviewRecord(projectRoot, reviewId, { fsOps });
    return {
      command: "status",
      status: record.status,
      project: projectRoot,
      reviewId,
      venue: record.venue,
      currentRound: record.currentRound,
      sessionId: record.session?.sessionId ?? null,
      rounds: record.rounds.map(publicRound)
    };
  }
  const reviews = reviewRecordsDirectory(projectRoot, { fsOps }).map((id) => {
    const record = readReviewRecord(projectRoot, id, { fsOps });
    return record === null ? null : {
      reviewId: record.id,
      status: record.status,
      venue: record.venue,
      currentRound: record.currentRound,
      sessionId: record.session?.sessionId ?? null
    };
  }).filter(Boolean);
  return { command: "status", status: "ok", project: projectRoot, reviews };
}

export function reviewStateLocation(options = {}) {
  const root = resolveReviewStateRoot(stateRootOptions(options));
  return { stateRoot: root };
}
