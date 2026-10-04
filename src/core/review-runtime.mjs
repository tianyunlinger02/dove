import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { DOVE_REVIEW_BACKEND_ID, runClaudeReviewBackend } from "./review-claude-backend.mjs";
import { createReviewSnapshot, isReviewMaterialDenied, normalizeReviewScope, REVIEW_IDENTITY_MATERIAL_PATH } from "./review-snapshot.mjs";
import { DOVE_REVIEW_QUALITY_FULL_REFERENCE_PATH, DOVE_REVIEW_QUALITY_REFERENCE_PATH, assertReviewWorkspaceMatchesSnapshot, createReviewGuidance, createReviewId, finalizePreparedReviewWorkspace, normalizeReviewGuidanceIdentity, normalizeReviewId, prepareReviewWorkspace, resolveReviewStateRoot, restorePreparedReviewWorkspace, reviewWorkspaceName } from "./review-workspace.mjs";
import { writeFileSetTransaction } from "./file-set-transaction.mjs";
import { resolveInstalledProjectRoot } from "./project-root.mjs";
import { openRootedFilesystem } from "./rooted-filesystem.mjs";
import { renderDoveReviewerStanceSection, renderDoveSharedResearchContractSection } from "./dove-agent-persona.mjs";

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

function liveScope(scope) {
  return scope === "route" || scope === "design";
}

function liveReviewSubmission(projectRoot, materials, round, options = {}) {
  if (!Array.isArray(materials) || materials.length === 0) throw new Error("dove review requires at least one --material <path>.");
  const fsOps = options.fsOps ?? fs;
  const paths = [...new Set([...materials, REVIEW_IDENTITY_MATERIAL_PATH].map((material) => {
    if (typeof material !== "string" || !material.trim() || material.includes("\0")) throw new Error("Dove review material must name a file or directory.");
    return path.resolve(projectRoot, material);
  }))].sort();
  for (const material of paths) {
    const stat = fsOps.statSync(material);
    if (!stat.isFile() && !stat.isDirectory()) throw new Error(`Dove review material must be a file or directory: ${material}`);
  }
  return { round, venue: options.venue ?? null, materials: paths.map((material) => ({ path: material })) };
}

function materialLines(snapshot, scope) {
  return snapshot.materials.map((material) => liveScope(scope)
    ? `- ${JSON.stringify(material.path)}`
    : `- ${material.path} (${material.size} bytes)`).join("\n");
}

function promptForRound(options) {
  const scope = normalizeReviewScope(options.scope);
  const materialList = materialLines(options.snapshot, scope);
  const operationLine = scope !== "paper"
    ? "Judge the latest actual contents at the listed live paths in a clean NEW reviewer session, with no previous reviewer or author conversation."
    : options.operation === "resume"
      ? "Continue the current frozen round in this same reviewer session. Re-read the listed current materials as needed before updating the review."
      : options.operation === "rerun"
        ? "This is a new full-material round in the same reviewer session. Review the complete current submission again, not just a diff."
        : "This is the initial full-material review round for this isolated reviewer session.";
  const fullReference = options.guidance?.full ? DOVE_REVIEW_QUALITY_FULL_REFERENCE_PATH : DOVE_REVIEW_QUALITY_REFERENCE_PATH;
  const guidanceLine = liveScope(scope)
    ? `Quality summary (absolute path): \`${options.guidance.summaryPath}\`. Read it first. Full quality reference: \`${options.guidance.fullPath}\`; consult relevant details when they can change this scoped judgment.`
    : options.guidance?.full
      ? `Quality summary (workspace-relative): \`${DOVE_REVIEW_QUALITY_REFERENCE_PATH}\`. Read it first. Full quality reference: \`${fullReference}\`; consult relevant details when they can change this scoped judgment.`
      : `Full quality reference (workspace-relative): \`${fullReference}\`. Read it proactively at the decision triggers above.`;
  const selectedTask = scope === "route"
    ? "Judge the current goal in the identity card against the supplied cumulative candidate, change, prediction and actual-result trajectory. Read the selected files and directories directly; these are author-selected paths, not an automatically scanned history. A narrative of changes does not replace supplied actual diffs or results. Cite concrete material observations; if needed inputs are missing, say which conclusions remain undetermined."
    : scope === "design"
      ? "Judge the supplied one-page method design against the current goal in the identity card. Cite its concrete mechanism, baseline comparison, predicted example and grounds, separating predictions from observed results and identifying material missing inputs."
      : "Return Markdown only under these four top-level headings: `## Verdict`, `## Blocking issues`, `## Grounding basis`, and `## Author-side next actions`. Do not edit files and do not claim external acceptance or certification.";
  return `# Independent dove-review task

${scope === "paper" ? `${renderDoveSharedResearchContractSection()}\n\n` : ""}${renderDoveReviewerStanceSection(scope)}

You are the same Dove researcher in a separate Read-only Claude Code reviewer session. ${liveScope(scope) ? "Read only the listed live files and directories. Use Read for file contents and Glob to list files within supplied directories; do not inspect unlisted paths. Materials are not copied or inlined." : "Review only the listed frozen copies in this workspace. Your available tool is Read; large files are intentionally not inlined here."}

${guidanceLine} This ${liveScope(scope) ? "package guidance" : "fixed package guidance"} is not user material or research evidence and grants no additional tool or material access. All scientific grounding remains limited to the listed ${liveScope(scope) ? "live paths" : "frozen materials"}.

Review scope: ${scope}
${scope === "paper" ? `Target venue: ${options.venue ?? "not specified"}\n` : ""}Review id: ${options.reviewId}
Round: ${options.round}

${operationLine}

${liveScope(scope) ? "Live material paths (absolute, JSON-quoted):" : "Frozen materials for this round:"}
${materialList || "- No project materials were listed for this imported-only record."}

${selectedTask}
`;
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
  const value = JSON.parse(bytes.toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schema !== REVIEW_RECORD_SCHEMA || value.id !== normalizeReviewId(reviewId)
    || !Array.isArray(value.rounds) || !Number.isSafeInteger(value.currentRound) || value.currentRound < 0) {
    throw new Error(`Dove review record is not a valid Dove review record: ${pathName}`);
  }
  return { record: value, expectedState: liveScope(value.scope) ? undefined : { exists: true, type: "file", sha256: sha256(bytes), mode: stat.mode & 0o7777 } };
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
  const value = JSON.parse(anchor.readFile(pathName).toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.materials)) throw new Error(`Dove review snapshot is invalid: ${pathName}`);
  return value;
}

function writeReviewFiles(projectRoot, files, options = {}) {
  if (liveScope(options.scope)) {
    const anchor = openRootedFilesystem(projectRoot, { fsOps: options.fsOps ?? fs });
    for (const file of files) {
      anchor.mkdir(path.posix.dirname(file.relativePath), { recursive: true, mode: 0o700 });
      const temporary = `${file.relativePath}.${crypto.randomUUID()}.tmp`;
      try {
        anchor.writeNewFile(temporary, file.content, { encoding: file.encoding });
        anchor.rename(temporary, file.relativePath);
      } finally {
        anchor.unlink(temporary, { force: true });
      }
    }
    return;
  }
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
  const scope = normalizeReviewScope(options.scope);
  const guidance = liveScope(scope) || options.provenance === "imported" && (options.guidance === undefined || options.guidance === null)
    ? null
    : normalizeReviewGuidanceIdentity(options.guidance, "Dove review round guidance");
  return {
    round: options.round,
    scope: normalizeReviewScope(options.scope),
    status: options.status,
    provenance: options.provenance,
    venue: options.venue ?? null,
    createdAt: options.createdAt,
    updatedAt: options.updatedAt,
    ...(liveScope(scope) ? {} : { snapshotPath: paths.snapshot }),
    reportPath: paths.report,
    backendPath: paths.backend,
    latestReportPath: options.latestReportPath ?? paths.report,
    latestBackendPath: options.latestBackendPath ?? paths.backend,
    materials: options.materials,
    ...(liveScope(scope) ? {} : { guidance }),
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
    sessionId: options.sessionId ?? null
  };
}

function upsertRound(record, roundRecord) {
  const existing = Array.isArray(record.rounds) ? record.rounds.filter((item) => item.round !== roundRecord.round) : [];
  return [...existing, roundRecord].sort((left, right) => left.round - right.round);
}

function recordStatusFromRound(roundRecord) {
  const provenance = liveScope(roundRecord.scope) ? roundRecord.attempts?.at(-1)?.provenance ?? roundRecord.provenance : roundRecord.provenance;
  if (provenance === "imported") return "imported";
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
    scope: normalizeReviewScope(options.scope),
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

function prepareRuntimeRound(projectRoot, record, snapshot, workspaceRoot, requestedSessionId, guidance, options = {}) {
  const now = exactIsoTimestamp(options.now ?? new Date());
  const existingRound = record.rounds.find((item) => item.round === snapshot.round);
  const roundRecord = existingRound
    ? { ...existingRound, status: "pending", updatedAt: now }
    : {
      ...makeRoundRecord({
        reviewId: record.id, scope: record.scope, round: snapshot.round, status: "pending", provenance: "runtime",
        venue: snapshot.venue, createdAt: now, updatedAt: now, materials: snapshot.materials, guidance
      }),
      reportPath: null, backendPath: null, latestReportPath: null, latestBackendPath: null
    };
  const nextRecord = {
    ...updateRecordForRound(record, roundRecord),
    pendingExchange: { round: snapshot.round, workspaceRoot, requestedSessionId }
  };
  const entries = [{ relativePath: reviewPath(record.id), content: serializeJson(nextRecord), expectedState: options.recordExpectedState }];
  if (!existingRound && !liveScope(record.scope)) entries.unshift({ relativePath: roundRecord.snapshotPath, content: serializeJson(snapshot), expectedState: absentFileState() });
  writeReviewFiles(projectRoot, entries, { ...options, scope: record.scope });
  return nextRecord;
}

function writeRuntimeRound(projectRoot, record, snapshot, backend, reportBytes, options = {}) {
  const now = exactIsoTimestamp(options.now ?? new Date());
  const round = options.round;
  const status = backend.status === "completed" ? "completed" : "failed";
  const existingRound = Array.isArray(record.rounds) ? record.rounds.find((item) => item.round === round) : null;
  const appendAttempt = existingRound?.reportPath != null;
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
        sessionId: backend.sessionId ?? null
      })
    ]
    : Array.isArray(existingRound?.attempts) ? existingRound.attempts : [];
  const roundGuidance = existingRound?.guidance ?? options.guidance;
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
      scope: record.scope,
      round,
      status,
      provenance: "runtime",
      venue: snapshot.venue ?? record.venue,
      createdAt: options.roundCreatedAt ?? now,
      updatedAt: now,
      materials: snapshot.materials,
      guidance: roundGuidance,
      latestReportPath: paths.report,
      latestBackendPath: paths.backend,
      sessionId: backend.sessionId ?? null,
      attempts
    });
  const nextRecord = updateRecordForRound(record, roundRecord, { sessionId: backend.sessionId });
  if (backend.status === "completed") delete nextRecord.pendingExchange;
  const recordState = liveScope(record.scope) ? undefined : options.recordExpectedState ?? fileState(projectRoot, reviewPath(record.id), options);
  const writeEntries = [
    { relativePath: paths.report, content: reportBytes, expectedState: absentFileState() },
    { relativePath: paths.backend, content: serializeJson(backend), encoding: "utf8", expectedState: absentFileState() },
    { relativePath: reviewPath(record.id), content: serializeJson(nextRecord), encoding: "utf8", expectedState: recordState }
  ];
  try {
    writeReviewFiles(projectRoot, writeEntries, { ...options, scope: record.scope });
  } catch (error) {
    const recovery = liveScope(record.scope)
      ? "resume judges the latest listed live materials in a new session, but cannot recover this unsaved return"
      : "resume attempts the requested session, but cannot recover this unsaved return";
    throw new Error(`Dove review ${record.id} return was not saved. The ${liveScope(record.scope) ? "listed paths" : "frozen materials"} and exchange records are retained; ${recovery}. ${error.message}`, { cause: error });
  }
  return { record: nextRecord, round: roundRecord, reportPath: paths.report, backendPath: paths.backend, snapshotPath: roundPaths(record.id, round).snapshot };
}

function sessionIdOrThrow(record) {
  const sessionId = record.pendingExchange?.requestedSessionId ?? record.session?.sessionId;
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

function recordedWorkspaceRoot(projectRoot, record, options = {}) {
  if (record.projectRoot !== projectRoot) throw new Error("Dove review record belongs to a different project.");
  if (record.pendingExchange) return record.pendingExchange.workspaceRoot;
  const round = record.rounds.find((item) => item.provenance === "runtime" && item.sessionId === record.session.sessionId);
  if (!round) throw new Error("Dove review session has no recorded runtime workspace.");
  const anchor = openRootedFilesystem(projectRoot, { fsOps: options.fsOps ?? fs });
  const attempt = round.attempts.findLast((item) => item.status === "completed");
  const backendPath = attempt?.backendPath ?? round.backendPath;
  const backend = JSON.parse(anchor.readFile(backendPath).toString("utf8"));
  if (backend?.sessionId !== record.session.sessionId || typeof backend.cwd !== "string" || !backend.cwd) {
    throw new Error("Dove review backend is missing the workspace for its recorded session.");
  }
  return backend.cwd;
}

function stateRootOptions(options = {}) {
  return {
    fsOps: options.fsOps ?? fs,
    env: options.env ?? process.env,
    ...(options.stateRoot ? { stateRoot: options.stateRoot } : {}),
    ...(options.projectRoot ? { projectRoot: options.projectRoot } : {}),
    ...(options.scope ? { scope: options.scope } : {})
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
  const scope = options.scope ?? readReviewRecord(options.projectRoot, reviewId, { fsOps })?.scope;
  const stateRoot = liveScope(scope) ? options.projectRoot : resolveReviewStateRoot(stateRootOptions(options));
  const stateRootFs = openRootedFilesystem(stateRoot, { fsOps });
  if (liveScope(scope)) stateRootFs.mkdir(".dove/reviews/.locks", { recursive: true, mode: 0o700 });
  const lockRoot = liveScope(scope) ? ".dove/reviews/.locks" : ensureLockRoot(stateRootFs);
  const lockPath = `${lockRoot}/${liveScope(scope) ? normalizeReviewId(reviewId) : reviewWorkspaceName(reviewId, options)}.lock`;
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

function materialOverall(items) {
  if (!Array.isArray(items) || items.length === 0) return "unavailable";
  if (items.some((item) => item.status === "missing")) return "missing";
  if (items.some((item) => item.status === "changed")) return "changed";
  if (items.every((item) => item.status === "current")) return "current";
  return "changed";
}

function observeMaterialPath(anchor, relativePath) {
  const observed = { exists: null, type: "unreadable", size: null, sha256: null };
  try {
    const stat = anchor.tryLstat(relativePath);
    observed.exists = stat !== null;
    if (!stat) return { ...observed, type: "absent" };
    if (stat.isSymbolicLink()) return { ...observed, type: "symlink" };
    if (stat.isDirectory()) return { ...observed, type: "directory" };
    if (!stat.isFile()) return { ...observed, type: "special" };
    const absolutePath = anchor.displayPath(relativePath);
    const canonical = anchor.fsOps.realpathSync.native?.(absolutePath) ?? anchor.fsOps.realpathSync(absolutePath);
    if (path.relative(anchor.root, canonical).split(path.sep).join("/") !== relativePath) {
      throw new Error(`Dove review material path must be canonical project-relative form: ${relativePath}`);
    }
    const bytes = anchor.fsOps.readFileSync(absolutePath);
    return { exists: true, type: "file", size: bytes.length, sha256: sha256(bytes) };
  } catch (error) {
    return { ...observed, error: error instanceof Error ? error.message : String(error) };
  }
}

function observedMaterialFact(material, options = {}) {
  const pathName = typeof material?.path === "string" ? material.path : null;
  const expected = {
    path: pathName,
    size: Number.isSafeInteger(material?.size) ? material.size : null,
    sha256: typeof material?.sha256 === "string" ? material.sha256 : null
  };
  let relativePath;
  try {
    relativePath = options.anchor.normalize(pathName, "Dove review material status path");
  } catch (error) {
    return { path: pathName, status: "changed", expected, observed: { exists: null, type: "invalid-path", size: null, sha256: null, error: error instanceof Error ? error.message : String(error) } };
  }
  if (isReviewMaterialDenied(relativePath, options.scope)) {
    return { path: relativePath, status: "changed", expected, observed: { exists: null, type: "unsafe-path", size: null, sha256: null } };
  }
  if (!options.observations.has(relativePath)) options.observations.set(relativePath, observeMaterialPath(options.anchor, relativePath));
  const observed = options.observations.get(relativePath);
  const status = observed.type === "absent" ? "missing"
    : observed.type === "file" && observed.size === expected.size && observed.sha256 === expected.sha256 ? "current" : "changed";
  return { path: relativePath, status, expected, observed };
}

function materialCurrentnessForRound(projectRoot, reviewId, round, options = {}) {
  if (!round || !Number.isInteger(round.round)) return { overall: "unavailable", items: [] };
  let snapshot;
  try {
    snapshot = readSnapshot(projectRoot, reviewId, round.round, options);
  } catch (error) {
    return { overall: "unavailable", items: [], error: error instanceof Error ? error.message : String(error) };
  }
  const materials = Array.isArray(snapshot.materials) ? snapshot.materials : [];
  if (materials.length === 0) return { overall: "unavailable", items: [] };
  const anchor = openRootedFilesystem(projectRoot, { fsOps: options.fsOps ?? fs });
  const observations = options.observations ?? new Map();
  const items = materials.map((material) => observedMaterialFact(material, { anchor, observations, scope: options.scope }));
  return { overall: materialOverall(items), items };
}

function publicText(value) {
  return typeof value === "string" ? value : null;
}

function publicMaterial(material) {
  return {
    path: publicText(material?.path),
    ...(Object.hasOwn(material ?? {}, "size") ? { size: Number.isSafeInteger(material?.size) ? material.size : null } : {})
  };
}

function publicObservedMaterialFact(observed = {}) {
  const result = {
    exists: observed.exists === true ? true : observed.exists === false ? false : null,
    type: typeof observed.type === "string" ? observed.type : "unavailable",
    size: Number.isSafeInteger(observed.size) ? observed.size : null
  };
  if (typeof observed.error === "string" && observed.error) result.error = observed.error;
  return result;
}

function publicExpectedMaterialFact(expected = {}) {
  return {
    size: Number.isSafeInteger(expected.size) ? expected.size : null
  };
}

function publicMaterialCurrentness(currentness) {
  const result = {
    overall: typeof currentness?.overall === "string" ? currentness.overall : "unavailable",
    items: Array.isArray(currentness?.items) ? currentness.items.map((item) => ({
      path: publicText(item?.path),
      status: typeof item?.status === "string" ? item.status : "changed",
      expected: publicExpectedMaterialFact(item?.expected),
      observed: publicObservedMaterialFact(item?.observed)
    })) : []
  };
  if (typeof currentness?.error === "string" && currentness.error) result.error = currentness.error;
  return result;
}

function publicMaterials(materials) {
  return Array.isArray(materials) ? materials.map(publicMaterial) : [];
}

function publicRound(round, options = {}) {
  const scoped = liveScope(round.scope ?? options.scope);
  const materialCurrentness = scoped ? null : materialCurrentnessForRound(options.projectRoot, options.reviewId, round, options);
  return {
    round: Number.isSafeInteger(round.round) ? round.round : null,
    scope: publicText(round.scope ?? options.scope ?? "paper"),
    status: publicText(round.status),
    provenance: publicText(round.provenance),
    venue: publicText(round.venue),
    ...(scoped ? {} : { snapshotPath: publicText(round.snapshotPath) }),
    reportPath: publicText(round.reportPath),
    backendPath: publicText(round.backendPath),
    latestReportPath: publicText(round.latestReportPath ?? round.reportPath),
    latestBackendPath: publicText(round.latestBackendPath ?? round.backendPath),
    sessionId: publicText(round.sessionId),
    materials: publicMaterials(round.materials),
    ...(scoped ? {} : { materialCurrentness: publicMaterialCurrentness(materialCurrentness) }),
    imported: round.imported === true,
    attempts: Array.isArray(round.attempts) ? round.attempts.map((attempt) => ({
      attempt: Number.isSafeInteger(attempt?.attempt) ? attempt.attempt : null,
      status: publicText(attempt?.status),
      provenance: publicText(attempt?.provenance),
      reportPath: publicText(attempt?.reportPath),
      backendPath: publicText(attempt?.backendPath),
      sessionId: publicText(attempt?.sessionId)
    })) : []
  };
}

function publicPendingExchange(record) {
  const pending = record.pendingExchange;
  return pending ? {
    round: Number.isSafeInteger(pending.round) ? pending.round : null,
    workspaceRoot: publicText(pending.workspaceRoot),
    requestedSessionId: publicText(pending.requestedSessionId)
  } : null;
}

function publicReviewResult(kind, projectRoot, review, round, extras = {}) {
  const roundNumber = round?.round ?? review.currentRound;
  const result = {
    command: kind,
    status: publicText(review.status),
    project: projectRoot,
    reviewId: publicText(review.id),
    scope: publicText(review.scope ?? "paper"),
    round: Number.isSafeInteger(roundNumber) ? roundNumber : null,
    venue: publicText(review.venue),
    sessionId: publicText(review.session?.sessionId),
    pendingExchange: publicPendingExchange(review),
    provenance: publicText(liveScope(review.scope) ? round?.attempts?.at(-1)?.provenance ?? round?.provenance : round?.provenance),
    ...(liveScope(review.scope) ? {} : { snapshotPath: publicText(round?.snapshotPath) }),
    reportPath: publicText(round?.reportPath),
    backendPath: publicText(round?.backendPath),
    materials: publicMaterials(round?.materials)
  };
  for (const key of ["workspaceRoot", "latestReportPath", "latestBackendPath", "sourceFile"]) {
    if (Object.hasOwn(extras, key)) result[key] = publicText(extras[key]);
  }
  return result;
}

function runLiveReview(projectRoot, record, operation, materials, options = {}) {
  const round = operation === "handoff" ? 1 : operation === "resume" ? record.currentRound : record.currentRound + 1;
  const submission = liveReviewSubmission(projectRoot, materials, round, options);
  const workspace = prepareReviewWorkspace({ projectRoot, scope: record.scope, fsOps: options.fsOps });
  const sessionId = crypto.randomUUID();
  const prompt = promptForRound({ operation, reviewId: record.id, scope: record.scope, round, snapshot: submission, guidance: workspace.guidance });
  const pending = prepareRuntimeRound(projectRoot, record, submission, workspace.workspaceRoot, sessionId, null, options);
  let outcome;
  try {
    outcome = runClaudeReviewBackend({
      workspaceRoot: workspace.workspaceRoot,
      scope: record.scope,
      materials: submission.materials.map((material) => material.path),
      fsOps: options.fsOps,
      prompt,
      session: { sessionId },
      claudeCommand: options.claudeCommand,
      env: options.env,
      spawnSync: options.spawnSync,
      timeout: options.timeout
    });
  } catch (error) {
    outcome = { status: "failed", report: null, sessionId: null, backend: localBackendFailure(error, options) };
  }
  const written = writeRuntimeRound(projectRoot, pending, submission, outcome.backend, reportBytesForOutcome(outcome), { ...options, round });
  return publicReviewResult(operation, projectRoot, written.record, written.round, {
    workspaceRoot: workspace.workspaceRoot,
    ...(operation === "resume" ? { latestReportPath: written.reportPath, latestBackendPath: written.backendPath } : {})
  });
}

export function handoffReview(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const projectRoot = normalizeProject(options.project, options);
  const reviewId = normalizeReviewId(options.id ?? createReviewId({ now: options.now }));
  const scope = normalizeReviewScope(options.scope);
  return withReviewMutationLock(reviewId, { ...options, projectRoot, scope }, () => {
    const existingRecord = readReviewRecordWithState(projectRoot, reviewId, { fsOps });
    if (existingRecord.record !== null) throw new Error(`Dove review record already exists: ${reviewPath(reviewId)}. Use resume or rerun.`);
    const reviewDirectoryState = fileState(projectRoot, reviewBasePath(reviewId), { fsOps });
    if (reviewDirectoryState.exists) throw new Error(`Dove review path already exists without a valid record: ${reviewBasePath(reviewId)}.`);
    const createdAt = exactIsoTimestamp(options.now ?? new Date());
    if (liveScope(scope)) {
      const record = newRecord({ reviewId, scope, projectRoot, createdAt, updatedAt: createdAt });
      return runLiveReview(projectRoot, record, "handoff", options.materials, options);
    }
    const { snapshot, files } = createReviewSnapshot({ projectRoot, reviewId, scope, round: 1, venue: options.venue, materials: options.materials, now: createdAt, fsOps });
    const guidance = createReviewGuidance();
    const workspace = prepareReviewWorkspace({ reviewId, files, guidance, ...stateRootOptions({ ...options, projectRoot }) });
    const sessionId = scope === "paper" ? options.sessionId ?? crypto.randomUUID() : crypto.randomUUID();
    const prompt = promptForRound({ operation: "handoff", reviewId, scope, round: 1, venue: options.venue, snapshot, guidance });
    let record = newRecord({ reviewId, scope, projectRoot, venue: options.venue, createdAt, updatedAt: createdAt });
    try {
      record = prepareRuntimeRound(projectRoot, record, snapshot, workspace.workspaceRoot, sessionId, guidance, { ...options, recordExpectedState: existingRecord.expectedState });
    } catch (error) {
      restorePreparedReviewWorkspace(workspace, stateRootOptions({ ...options, projectRoot }));
      throw error;
    }
    const recordExpectedState = fileState(projectRoot, reviewPath(reviewId), { fsOps });
    let outcome;
    try {
      outcome = runClaudeReviewBackend({
        workspaceRoot: workspace.workspaceRoot,
        prompt,
        session: { sessionId },
        claudeCommand: options.claudeCommand,
        env: options.env,
        spawnSync: options.spawnSync,
        timeout: options.timeout
      });
    } catch (error) {
      outcome = { status: "failed", report: null, sessionId: null, backend: localBackendFailure(error, options) };
    }
    const reportBytes = reportBytesForOutcome(outcome);
    const written = writeRuntimeRound(projectRoot, record, snapshot, outcome.backend, reportBytes, { ...options, round: 1, roundCreatedAt: createdAt, recordExpectedState });
    return publicReviewResult("handoff", projectRoot, written.record, written.round, { workspaceRoot: workspace.workspaceRoot });
  });
}

export function resumeReview(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const projectRoot = normalizeProject(options.project, options);
  const reviewId = normalizeReviewId(options.id);
  return withReviewMutationLock(reviewId, { ...options, projectRoot }, () => {
    let { record, expectedState } = requireReviewRecordWithState(projectRoot, reviewId, { fsOps });
    const scope = normalizeReviewScope(record.scope);
    const sessionId = scope === "paper" ? sessionIdOrThrow(record) : crypto.randomUUID();
    const round = record.currentRound;
    if (!Number.isInteger(round) || round < 1) throw new Error(`Dove review ${reviewId} has no current round to resume.`);
    if (liveScope(scope)) {
      const current = record.rounds.find((item) => item.round === round);
      return runLiveReview(projectRoot, record, "resume", current?.materials?.map((material) => material.path), options);
    }
    const existingRound = assertCurrentRoundCanUseRuntime(record);
    const snapshot = readSnapshot(projectRoot, reviewId, round, { fsOps });
    let workspace;
    let outcome;
    try {
      const guidance = normalizeReviewGuidanceIdentity(existingRound.guidance, "Dove review frozen package guidance");
      workspace = assertReviewWorkspaceMatchesSnapshot({ reviewId, snapshot, guidance, ...stateRootOptions({ ...options, projectRoot }), workspaceRoot: recordedWorkspaceRoot(projectRoot, record, { fsOps }) });
    } catch (error) {
      outcome = { status: "failed", report: null, sessionId: null, backend: localBackendFailure(error, options) };
    }
    if (workspace) {
      const prompt = promptForRound({ operation: "resume", reviewId, scope, round, venue: record.venue, snapshot, guidance: existingRound.guidance });
      record = prepareRuntimeRound(projectRoot, record, snapshot, workspace.workspaceRoot, sessionId, existingRound.guidance, { ...options, recordExpectedState: expectedState });
      expectedState = fileState(projectRoot, reviewPath(reviewId), { fsOps });
      try {
        outcome = runClaudeReviewBackend({
          workspaceRoot: workspace.workspaceRoot,
          prompt,
          session: scope === "paper" ? { resumeSessionId: sessionId } : { sessionId },
          claudeCommand: options.claudeCommand,
          env: options.env,
          spawnSync: options.spawnSync,
          timeout: options.timeout
        });
      } catch (error) {
        outcome = { status: "failed", report: null, sessionId: null, backend: localBackendFailure(error, options) };
      }
    }
    const reportBytes = reportBytesForOutcome(outcome);
    const written = writeRuntimeRound(projectRoot, record, snapshot, outcome.backend, reportBytes, { ...options, round, guidance: existingRound.guidance, roundCreatedAt: existingRound.createdAt ?? exactIsoTimestamp(options.now ?? new Date()), recordExpectedState: expectedState });
    return publicReviewResult("resume", projectRoot, written.record, written.round, { workspaceRoot: workspace?.workspaceRoot ?? null, latestReportPath: written.reportPath, latestBackendPath: written.backendPath });
  });
}

export function rerunReview(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const projectRoot = normalizeProject(options.project, options);
  const reviewId = normalizeReviewId(options.id);
  return withReviewMutationLock(reviewId, { ...options, projectRoot }, () => {
    let { record, expectedState } = requireReviewRecordWithState(projectRoot, reviewId, { fsOps });
    const scope = normalizeReviewScope(record.scope);
    if (liveScope(scope)) return runLiveReview(projectRoot, record, "rerun", options.materials, options);
    if (scope === "paper" && record.pendingExchange) throw new Error(`Dove review ${reviewId} has a pending exchange; use resume before starting another round.`);
    const sessionId = scope === "paper" ? sessionIdOrThrow(record) : crypto.randomUUID();
    const round = record.currentRound + 1;
    const createdAt = exactIsoTimestamp(options.now ?? new Date());
    const venue = options.venue ?? record.venue ?? null;
    const { snapshot, files } = createReviewSnapshot({ projectRoot, reviewId, scope, round, venue, materials: options.materials, now: createdAt, fsOps });
    const guidance = createReviewGuidance();
    const workspaceOptions = { ...stateRootOptions({ ...options, projectRoot }), workspaceRoot: recordedWorkspaceRoot(projectRoot, record, { fsOps }) };
    const workspace = prepareReviewWorkspace({ reviewId, files, guidance, keepPreviousWorkspaceBackup: true, ...workspaceOptions });
    const prompt = promptForRound({ operation: "rerun", reviewId, scope, round, venue, snapshot, guidance });
    try {
      record = prepareRuntimeRound(projectRoot, record, snapshot, workspace.workspaceRoot, sessionId, guidance, { ...options, recordExpectedState: expectedState });
    } catch (error) {
      restorePreparedReviewWorkspace(workspace, workspaceOptions);
      throw error;
    }
    finalizePreparedReviewWorkspace(workspace, workspaceOptions);
    expectedState = fileState(projectRoot, reviewPath(reviewId), { fsOps });
    let outcome;
    try {
      outcome = runClaudeReviewBackend({
        workspaceRoot: workspace.workspaceRoot,
        prompt,
        session: scope === "paper" ? { resumeSessionId: sessionId } : { sessionId },
        claudeCommand: options.claudeCommand,
        env: options.env,
        spawnSync: options.spawnSync,
        timeout: options.timeout
      });
    } catch (error) {
      outcome = { status: "failed", report: null, sessionId: null, backend: localBackendFailure(error, options) };
    }
    const reportBytes = reportBytesForOutcome(outcome);
    const written = writeRuntimeRound(projectRoot, record, snapshot, outcome.backend, reportBytes, { ...options, round, guidance, roundCreatedAt: createdAt, recordExpectedState: expectedState });
    return publicReviewResult("rerun", projectRoot, written.record, written.round, { workspaceRoot: workspace.workspaceRoot });
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
      scope: options.scope,
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
    scope: normalizeReviewScope(options.scope),
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
    if (existing?.pendingExchange) throw new Error(`Dove review ${reviewId} has a pending exchange; use resume before importing another round.`);
    if (existing === null && fileState(projectRoot, reviewBasePath(reviewId), { fsOps }).exists) throw new Error(`Dove review path already exists without a valid record: ${reviewBasePath(reviewId)}.`);
    const createdAt = exactIsoTimestamp(options.now ?? new Date());
    const round = existing ? existing.currentRound + 1 : 1;
    const venue = options.venue ?? existing?.venue ?? null;
    const scope = normalizeReviewScope(existing?.scope);
    const { sourceFile, bytes } = importFileBytes(options.file, { fsOps, cwd: options.cwd });
    const snapshot = liveScope(scope)
      ? options.materials?.length ? liveReviewSubmission(projectRoot, options.materials, round, { fsOps }) : { round, materials: [] }
      : importedSnapshot({ projectRoot, reviewId, scope, round, venue, materials: options.materials, createdAt, fsOps });
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
    const roundRecord = makeRoundRecord({
      reviewId,
      scope,
      round,
      status: "imported",
      provenance: "imported",
      venue,
      createdAt,
      updatedAt: createdAt,
      materials: snapshot.materials,
      latestReportPath: paths.report,
      latestBackendPath: paths.backend,
      sessionId: null,
      attempts: []
    });
    const baseRecord = existing ?? newRecord({ reviewId, scope, projectRoot, venue, createdAt, updatedAt: createdAt });
    const nextRecord = updateRecordForRound(baseRecord, roundRecord, { sessionId: baseRecord.session?.sessionId ?? null });
    writeReviewFiles(projectRoot, [
      ...(!liveScope(scope) ? [{ relativePath: paths.snapshot, content: serializeJson(snapshot), encoding: "utf8", expectedState: absentFileState() }] : []),
      { relativePath: paths.report, content: bytes, expectedState: absentFileState() },
      { relativePath: paths.backend, content: serializeJson(backend), encoding: "utf8", expectedState: absentFileState() },
      { relativePath: reviewPath(reviewId), content: serializeJson(nextRecord), encoding: "utf8", expectedState }
    ], { ...options, scope });
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

// Read record metadata to select the latest exchange, then inspect only its current
// round's materials. The public status projection also inspects historical rounds.
export function inspectLatestReviewFacts(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const projectRoot = normalizeProject(options.project, options);
  let latest = null;
  for (const id of reviewRecordsDirectory(projectRoot, { fsOps })) {
    const record = requireReviewRecord(projectRoot, id, { fsOps });
    if ((record.scope ?? "paper") !== "paper") continue;
    if (typeof record.updatedAt !== "string") throw new Error("Dove review is missing its update timestamp.");
    exactIsoTimestamp(record.updatedAt);
    if (!latest || record.updatedAt > latest.updatedAt) latest = record;
  }
  if (!latest) return null;
  if (!Number.isSafeInteger(latest.currentRound) || latest.currentRound < 1 || !Array.isArray(latest.rounds)) {
    throw new Error("Latest Dove review has no valid current round.");
  }
  const rounds = latest.rounds.filter((round) => round?.round === latest.currentRound);
  if (rounds.length !== 1) throw new Error("Latest Dove review must have one current round record.");
  const currentness = materialCurrentnessForRound(projectRoot, latest.id, rounds[0], { fsOps });
  const invalidMaterial = currentness.items.some((item) =>
    !Number.isSafeInteger(item.expected?.size) || item.expected.size < 0
    || !/^[a-f0-9]{64}$/u.test(item.expected?.sha256 ?? "")
    || item.observed?.error);
  return {
    reviewId: latest.id,
    round: latest.currentRound,
    updatedAt: latest.updatedAt,
    materialCurrentness: invalidMaterial ? "unavailable" : currentness.overall
  };
}

export function inspectReviewStatus(options = {}) {
  const fsOps = options.fsOps ?? fs;
  const projectRoot = normalizeProject(options.project, options);
  if (options.id !== undefined && options.id !== null) {
    const reviewId = normalizeReviewId(options.id);
    const record = requireReviewRecord(projectRoot, reviewId, { fsOps });
    const observations = new Map();
    const rounds = record.rounds.map((round) => publicRound(round, { projectRoot, reviewId, fsOps, observations, scope: record.scope }));
    return {
      command: "status",
      status: publicText(record.status),
      project: projectRoot,
      reviewId,
      scope: publicText(record.scope ?? "paper"),
      venue: publicText(record.venue),
      currentRound: Number.isSafeInteger(record.currentRound) ? record.currentRound : null,
      sessionId: publicText(record.session?.sessionId),
      pendingExchange: publicPendingExchange(record),
      ...(liveScope(record.scope) ? {} : { materialCurrentness: rounds.find((round) => round.round === record.currentRound)?.materialCurrentness ?? publicMaterialCurrentness(null) }),
      rounds
    };
  }
  const reviews = reviewRecordsDirectory(projectRoot, { fsOps }).map((id) => {
    const record = readReviewRecord(projectRoot, id, { fsOps });
    return record === null ? null : {
      reviewId: publicText(record.id),
      scope: publicText(record.scope ?? "paper"),
      status: publicText(record.status),
      venue: publicText(record.venue),
      currentRound: Number.isSafeInteger(record.currentRound) ? record.currentRound : null,
      sessionId: publicText(record.session?.sessionId),
      pendingExchange: publicPendingExchange(record)
    };
  }).filter(Boolean);
  return { command: "status", status: "ok", project: projectRoot, reviews };
}

export function reviewStateLocation(options = {}) {
  const root = resolveReviewStateRoot(stateRootOptions(options));
  return { stateRoot: root };
}
