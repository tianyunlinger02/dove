import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  DOVE_ARCHIVED_TASK_STATUSES,
  DOVE_PRIMARY_ROLES,
  DOVE_TASK_CREATOR_KINDS,
  DOVE_TASK_DOMAINS,
  DOVE_TASK_STAGES,
  DOVE_TASK_STATUSES,
  PIPELINE_STAGE_ORDER,
  ROLE_IDS,
  createDefaultBoard,
  createDefaultState,
  createDoveAuthorityManifest,
  createDoveWorkspaceKernel,
  createMutationProvenanceIndex,
  createReviewState,
  createRuntimeContinuationIndex,
  createRuntimeEventsIndex,
  createRuntimeResultsIndex,
  createTaskPacketsIndex,
  createVersionComparisonsIndex,
  createVersionsIndex,
  createWorkspaceIndex,
  doveExecutionContractReadiness,
  doveExecutionCriteriaCoverage,
  normalizeDoveBoundary,
  normalizeDoveDomainId,
  normalizeDoveExecutionContract,
  normalizeDoveExecutionReceipt,
  normalizeDoveHandoff,
  normalizeDoveMissionLifecycleStage,
  normalizeDoveAuthorityManifest,
  normalizeDoveVerifiedCriteria,
  normalizeMutationProvenanceIndex,
  normalizeRuntimeContinuationIndex,
  normalizeRuntimeEventsIndex,
  normalizeRuntimeResultsIndex,
  normalizeState,
  normalizeWorkspaceIndex
} from "./schema.mjs";
import { materializeGuidancePacket } from "./navigation.mjs";
import { queryPaperAudit } from "./paper-audit.mjs";
import { buildPreActionGuidance } from "./pre-action-guidance.mjs";
import { readTaskPacketCatalog } from "./task-packets.mjs";
import { assertGovernanceMutationRegistered } from "./workspace.mjs";
import { doveText, resolveDoveResponseLanguage } from "./i18n.mjs";

function cloneFallback(fallback) {
  return typeof fallback === "function" ? fallback() : structuredClone(fallback);
}

function resolveProjectPath(root, relativePath) {
  return path.join(root, relativePath);
}

function safeReadJson(root, relativePath, fallback, readErrors) {
  const fullPath = resolveProjectPath(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    return cloneFallback(fallback);
  }
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    readErrors.push({
      path: relativePath,
      message: error instanceof Error ? error.message : String(error)
    });
    return cloneFallback(fallback);
  }
}

function safeReadText(root, relativePath, readErrors) {
  const fullPath = resolveProjectPath(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  try {
    return fs.readFileSync(fullPath, "utf8");
  } catch (error) {
    readErrors.push({
      path: relativePath,
      message: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

function objectOrFallback(value, fallback) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : cloneFallback(fallback);
}

const VALIDATION_OUTPUT_READ_LIMIT_BYTES = 24 * 1024;
const ARCHIVED_PACKET_STATUSES = new Set(DOVE_ARCHIVED_TASK_STATUSES);

function archivedPacketStatus(value) {
  return ARCHIVED_PACKET_STATUSES.has(String(value ?? "").trim().toLowerCase());
}

function isArchivedStatusTask(task) {
  return archivedPacketStatus(task?.status) || archivedPacketStatus(task?.lifecycleStatus);
}

function normalizeStringArray(value) {
  const values = Array.isArray(value) ? value : (typeof value === "string" ? [value] : []);
  return Array.from(new Set(values.map((item) => String(item).trim()).filter(Boolean)));
}

function mergeStringArrays(...values) {
  return Array.from(new Set(values.flatMap((value) => normalizeStringArray(value))));
}

function activePackets(packets = []) {
  return packets.filter((packet) => !archivedPacketStatus(packet.status) && !archivedPacketStatus(packet.lifecycleStatus));
}

function normalizeProjectRelativePath(rawPath) {
  const original = typeof rawPath === "string" ? rawPath.trim() : String(rawPath ?? "").trim();
  if (!original) {
    return { ok: false, path: original, reason: "empty path" };
  }
  if (original.includes("\0")) {
    return { ok: false, path: original, reason: "path contains a null byte" };
  }
  if (path.isAbsolute(original) || /^[A-Za-z]:[\\/]/.test(original)) {
    return { ok: false, path: original, reason: "absolute paths are not inspected" };
  }
  const normalizedPath = path.posix.normalize(original.replace(/\\/g, "/"));
  if (normalizedPath === "." || normalizedPath === ".." || normalizedPath.startsWith("../")) {
    return { ok: false, path: original, normalizedPath, reason: "path escapes the project root" };
  }
  return { ok: true, path: original, normalizedPath };
}

function readBoundedText(fullPath, maxBytes = VALIDATION_OUTPUT_READ_LIMIT_BYTES) {
  const descriptor = fs.openSync(fullPath, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const bytesRead = fs.readSync(descriptor, buffer, 0, maxBytes, 0);
    return {
      text: buffer.subarray(0, bytesRead).toString("utf8"),
      bytesRead
    };
  } finally {
    fs.closeSync(descriptor);
  }
}

function inspectDeclaredPath(root, rawPath, options = {}) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath ?? null,
      status: "unsafe",
      exists: false,
      file: false,
      reason: normalized.reason
    };
  }
  const rootPath = path.resolve(root);
  const fullPath = path.resolve(rootPath, normalized.normalizedPath);
  const relativeToRoot = path.relative(rootPath, fullPath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "unsafe",
      exists: false,
      file: false,
      reason: "resolved path escapes the project root"
    };
  }
  let stat;
  try {
    stat = fs.statSync(fullPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        path: normalized.path,
        normalizedPath: normalized.normalizedPath,
        status: "missing",
        exists: false,
        file: false,
        reason: "path does not exist"
      };
    }
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "unreadable",
      exists: false,
      file: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
  if (stat.isDirectory()) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "directory",
      exists: true,
      file: false,
      sizeBytes: stat.size,
      reason: "path is a directory"
    };
  }
  if (!stat.isFile()) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "unsupported",
      exists: true,
      file: false,
      sizeBytes: stat.size,
      reason: "path is not a regular file"
    };
  }
  const item = {
    path: normalized.path,
    normalizedPath: normalized.normalizedPath,
    status: "existing",
    exists: true,
    file: true,
    sizeBytes: stat.size
  };
  if (!options.readText) {
    return item;
  }
  try {
    const read = readBoundedText(fullPath, options.maxBytes ?? VALIDATION_OUTPUT_READ_LIMIT_BYTES);
    return {
      ...item,
      text: read.text,
      bytesRead: read.bytesRead,
      truncated: stat.size > read.bytesRead
    };
  } catch (error) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "unreadable",
      exists: true,
      file: true,
      sizeBytes: stat.size,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

function publicPathInspection(item) {
  const { text, ...publicItem } = item;
  return publicItem;
}

function summarizePathInspections(inspections) {
  const pathsWithStatus = (status) => inspections
    .filter((item) => item.status === status)
    .map((item) => item.normalizedPath ?? item.path)
    .filter(Boolean);
  const problemStatuses = new Set(["missing", "unsafe", "unreadable", "directory", "unsupported"]);
  return {
    declaredPaths: Array.from(new Set(inspections.map((item) => item.path).filter(Boolean))),
    inspectedPaths: Array.from(new Set(inspections.filter((item) => item.status !== "unsafe").map((item) => item.normalizedPath).filter(Boolean))),
    existingPaths: pathsWithStatus("existing"),
    missingPaths: pathsWithStatus("missing"),
    unsafePaths: pathsWithStatus("unsafe"),
    unreadablePaths: pathsWithStatus("unreadable"),
    directoryPaths: pathsWithStatus("directory"),
    unsupportedPaths: pathsWithStatus("unsupported"),
    satisfied: inspections.some((item) => item.status === "existing"),
    problemCount: inspections.filter((item) => problemStatuses.has(item.status)).length,
    items: inspections.map(publicPathInspection)
  };
}

function inspectPathEvidence(root, paths, options = {}) {
  return summarizePathInspections(normalizeStringArray(paths).map((item) => inspectDeclaredPath(root, item, options)));
}

function classifyValidationOutputText(text) {
  const normalized = String(text ?? "").toLowerCase();
  if (!normalized.trim()) {
    return "unknown";
  }
  const failurePatterns = [
    /\bnot ok\b/,
    /\btraceback\b/,
    /\bexception\b/,
    /\berror\b/,
    /\b[1-9]\d*\s+(?:failing|failures?|failed)\b/,
    /\bfailed\b/,
    /\bnon[- ]?zero\b/,
    /\bexit\s+[1-9]\d*\b/
  ];
  if (failurePatterns.some((pattern) => pattern.test(normalized))) {
    return "failed";
  }
  const passPatterns = [
    /\bpass(?:ed|es)?\b/,
    /\bsuccess(?:ful)?\b/,
    /\bok\b/,
    /\b0\s+(?:failing|failures?|failed)\b/,
    /\bexit\s+0\b/
  ];
  if (passPatterns.some((pattern) => pattern.test(normalized))) {
    return "passed";
  }
  return "unknown";
}

function summarizeValidationOutputText(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
}

function aggregateValidationOutputStatus(signals, pathEvidence) {
  if (signals.some((signal) => signal.status === "failed")) {
    return "failed";
  }
  if (signals.some((signal) => signal.status === "passed")) {
    return "passed";
  }
  if (signals.length > 0) {
    return "unknown";
  }
  return pathEvidence.declaredPaths.length > 0 ? "missing" : "missing";
}

function buildValidationOutputEvidence(root, pathValues, textValues) {
  const paths = mergeStringArrays(...pathValues);
  const inspections = paths.map((item) => inspectDeclaredPath(root, item, { readText: true, maxBytes: VALIDATION_OUTPUT_READ_LIMIT_BYTES }));
  const pathEvidence = summarizePathInspections(inspections);
  const pathSignals = inspections
    .filter((item) => typeof item.text === "string")
    .map((item) => ({
      source: "path",
      path: item.normalizedPath,
      status: classifyValidationOutputText(item.text),
      bytesRead: item.bytesRead ?? 0,
      truncated: Boolean(item.truncated),
      sample: summarizeValidationOutputText(item.text)
    }));
  const textSignals = mergeStringArrays(...textValues).map((text, index) => ({
    source: "text",
    index,
    status: classifyValidationOutputText(text),
    sample: summarizeValidationOutputText(text)
  }));
  const signals = [...pathSignals, ...textSignals];
  const status = aggregateValidationOutputStatus(signals, pathEvidence);
  return {
    status,
    satisfied: status === "passed",
    declaredTextCount: textSignals.length,
    paths: pathEvidence,
    signals
  };
}

function acceptanceChecksInclude(mission, terms) {
  return mission.acceptanceChecks.some((check) => {
    const normalized = check.toLowerCase();
    return terms.some((term) => normalized.includes(term));
  });
}

function addPathProblemEvidence(missingEvidence, category, requirement, evidence) {
  const problemPaths = [
    ...evidence.missingPaths,
    ...evidence.unsafePaths,
    ...evidence.unreadablePaths,
    ...evidence.directoryPaths,
    ...evidence.unsupportedPaths
  ];
  if (problemPaths.length > 0) {
    missingEvidence.push({
      category,
      requirement,
      reason: "One or more declared evidence paths could not be safely inspected.",
      paths: problemPaths,
      suggestedInput: `Provide project-local existing file paths for ${requirement}.`
    });
  }
}

function buildEngineeringEvidence(root, args, inputs, mission, completedChecks, uncheckedChecks) {
  const missionPackets = activePackets(inputs.packets).filter((packet) => packet.doveDomain === "engineering");
  const changedFiles = inspectPathEvidence(root, mergeStringArrays(
    args.changedFilePaths,
    args.changedFiles,
    args.changedPaths,
    missionPackets.flatMap((packet) => packet.outputPaths)
  ));
  const validationEvidence = inspectPathEvidence(root, mergeStringArrays(
    args.validationEvidencePaths,
    args.validationEvidence,
    args.evidencePaths,
    args.testEvidencePaths,
    args.testPaths,
    missionPackets.flatMap((packet) => packet.evidenceLinks)
  ));
  const validationOutput = buildValidationOutputEvidence(root, [
    args.validationOutputPaths,
    args.validationLogPaths,
    args.testOutputPaths
  ], [
    args.validationOutputs,
    args.validationOutput
  ]);
  const reviewEvidence = inspectPathEvidence(root, mergeStringArrays(args.reviewEvidencePaths, args.reviewEvidence));
  const requiresValidationOutput = acceptanceChecksInclude(mission, ["test", "validation", "output"]);
  const requiresReview = acceptanceChecksInclude(mission, ["review"]);
  const requiresChecklist = acceptanceChecksInclude(mission, ["checklist"]);
  const missingEvidence = [];

  if (changedFiles.declaredPaths.length === 0) {
    missingEvidence.push({
      category: "changed-files",
      requirement: "changed files",
      reason: "No changed source, test, or documentation files were declared for the engineering return.",
      paths: [],
      suggestedInput: "Pass --changed-file or provide packet outputPaths."
    });
  } else if (!changedFiles.satisfied) {
    missingEvidence.push({
      category: "changed-files",
      requirement: "changed files",
      reason: "Changed-file evidence was declared but no existing project-local file could be inspected.",
      paths: changedFiles.declaredPaths,
      suggestedInput: "Pass project-local changed-file paths that exist in the workspace."
    });
  }
  addPathProblemEvidence(missingEvidence, "changed-files", "changed files", changedFiles);

  if (validationEvidence.declaredPaths.length === 0) {
    missingEvidence.push({
      category: "validation-evidence",
      requirement: "tests or validation evidence",
      reason: "No test, validation, or evidence file was declared for the engineering return.",
      paths: [],
      suggestedInput: "Pass --test-evidence, --validation-evidence, or provide packet evidenceLinks."
    });
  } else if (!validationEvidence.satisfied) {
    missingEvidence.push({
      category: "validation-evidence",
      requirement: "tests or validation evidence",
      reason: "Validation evidence was declared but no existing project-local evidence file could be inspected.",
      paths: validationEvidence.declaredPaths,
      suggestedInput: "Pass project-local test or validation evidence files that exist in the workspace."
    });
  }
  addPathProblemEvidence(missingEvidence, "validation-evidence", "tests or validation evidence", validationEvidence);

  if (requiresValidationOutput && validationOutput.status !== "passed") {
    missingEvidence.push({
      category: "validation-output",
      requirement: "validation output",
      reason: validationOutput.status === "failed"
        ? "Declared validation output contains failure signals."
        : validationOutput.status === "unknown"
          ? "Declared validation output is inconclusive."
          : "No passing validation output was declared.",
      paths: validationOutput.paths.declaredPaths,
      suggestedInput: "Pass a project-local validation output file or explicit validation output text showing a passing run."
    });
  }
  addPathProblemEvidence(missingEvidence, "validation-output", "validation output", validationOutput.paths);

  const reviewMissing = requiresReview && inputs.reviewState.lastVerdict === "not-reviewed" && !reviewEvidence.satisfied;
  if (reviewMissing) {
    missingEvidence.push({
      category: "review-evidence",
      requirement: "review evidence",
      reason: "The mission asks for review evidence, but no review verdict or review evidence path is available.",
      paths: reviewEvidence.declaredPaths,
      suggestedInput: "Run a review surface or pass project-local review evidence paths."
    });
  }
  addPathProblemEvidence(missingEvidence, "review-evidence", "review evidence", reviewEvidence);

  const checklistMissing = requiresChecklist && (!inputs.checklist || uncheckedChecks > 0);
  if (checklistMissing) {
    missingEvidence.push({
      category: "acceptance-checklist",
      requirement: "acceptance checklist",
      reason: !inputs.checklist ? "No checklist artifact is available." : "The checklist still has unchecked items.",
      paths: [ARTIFACT_PATHS.checklist],
      suggestedInput: "Complete or update the acceptance checklist before return."
    });
  }

  const pathProblemCount = changedFiles.problemCount + validationEvidence.problemCount + validationOutput.paths.problemCount + reviewEvidence.problemCount;
  const hasFailedValidationOutput = validationOutput.status === "failed";
  const hasReviewGap = missingEvidence.some((item) => item.category === "review-evidence");
  const hasChecklistGap = missingEvidence.some((item) => item.category === "acceptance-checklist");
  const hasEvidenceGaps = missingEvidence.some((item) => ["changed-files", "validation-evidence", "validation-output"].includes(item.category));
  return {
    declaredInputsOnly: true,
    noCommandExecution: true,
    noGitInspection: true,
    packetEvidence: {
      packetIds: missionPackets.map((packet) => packet.packetId ?? packet.id).filter(Boolean),
      missionPacketIds: missionPackets.map((packet) => packet.missionPacketId ?? packet.packetId ?? packet.id).filter(Boolean),
      missionPacketStorePath: ARTIFACT_PATHS.taskPacketsIndex,
      missionPacketPaths: Array.from(new Set(missionPackets.map((packet) => packet.missionPacketPath).filter(Boolean))),
      outputPaths: Array.from(new Set(missionPackets.flatMap((packet) => packet.outputPaths))),
      evidenceLinks: Array.from(new Set(missionPackets.flatMap((packet) => packet.evidenceLinks)))
    },
    changedFiles,
    validationEvidence,
    validationOutput,
    reviewEvidence,
    checklist: {
      completedCount: completedChecks,
      uncheckedCount: uncheckedChecks,
      path: ARTIFACT_PATHS.checklist
    },
    missingEvidence,
    readinessSignals: [
      { category: "changed-files", status: changedFiles.satisfied ? "present" : "missing" },
      { category: "validation-evidence", status: validationEvidence.satisfied ? "present" : "missing" },
      { category: "validation-output", status: validationOutput.status },
      { category: "review-evidence", status: hasReviewGap ? "missing" : "not-required-or-present" },
      { category: "acceptance-checklist", status: hasChecklistGap ? "incomplete" : "not-required-or-complete" }
    ],
    readiness: {
      ready: missingEvidence.length === 0,
      pathProblemCount,
      hasEvidenceGaps,
      hasFailedValidationOutput,
      hasReviewGap,
      hasChecklistGap,
      validationOutputStatus: validationOutput.status
    },
    evidenceReadPaths: Array.from(new Set([
      ...changedFiles.existingPaths,
      ...validationEvidence.existingPaths,
      ...validationOutput.paths.existingPaths,
      ...reviewEvidence.existingPaths
    ]))
  };
}

function missionStageForPhase(phase) {
  const map = {
    init: "goal",
    sources: "goal",
    notes: "goal",
    research: "goal",
    plan: "design",
    outline: "design",
    checklist: "checklist",
    draft: "execution",
    experiments: "execution",
    citations: "execution",
    rebuttal: "execution",
    review: "audit",
    versions: "return"
  };
  return normalizeDoveMissionLifecycleStage(map[String(phase ?? "").trim()], "goal");
}

function domainForPacket(packet = {}) {
  const explicit = normalizeDoveDomainId(packet.doveDomain ?? packet.missionDomain ?? packet.domain, null);
  if (explicit) {
    return explicit;
  }
  if ((packet.experimentIds ?? []).length > 0 || packet.lifecycleFamily === "audit") {
    return "experiment";
  }
  if (packet.assignedRole === "reviewer" || packet.lifecycleFamily === "concern") {
    return "review";
  }
  if (packet.lifecycleFamily === "work-unit" || packet.lifecycleFamily === "campaign") {
    return "general";
  }
  return "paper";
}

function primaryRoleForStage(stage) {
  if (stage === "audit" || stage === "return") {
    return DOVE_PRIMARY_ROLES.find((role) => role.id === "reviewer");
  }
  if (stage === "execution") {
    return DOVE_PRIMARY_ROLES.find((role) => role.id === "builder");
  }
  return DOVE_PRIMARY_ROLES.find((role) => role.id === "planner");
}

function selectDomainGuidance(workspaceIndex, domain) {
  const guidance = workspaceIndex.dove?.domainGuidance ?? createDoveWorkspaceKernel().domainGuidance;
  return guidance.find((item) => item.id === domain) ?? createDoveWorkspaceKernel().domainGuidance.find((item) => item.id === "paper");
}

function missionPacketAliases(packet) {
  const packetId = String(packet.id ?? packet.packetId ?? packet.missionPacketId ?? "").trim();
  const packetPath = packet.packetPath ?? (packetId ? path.join(ARTIFACT_PATHS.taskPacketsPacketsDir, `${packetId}.json`) : null);
  const packetContextPath = packet.packetContextPath ?? (packetId ? path.join(ARTIFACT_PATHS.packetContextsDir, `${packetId}.json`) : null);
  return {
    packetId,
    packetPath,
    packetContextPath,
    missionPacketId: packetId,
    missionPacketPath: packetPath,
    missionPacketContextPath: packetContextPath,
    missionPacketStorePath: ARTIFACT_PATHS.taskPacketsIndex,
    missionPacketStoreRoot: ARTIFACT_PATHS.taskPacketsDir,
    source: "mission-packet"
  };
}

function summarizePacket(packet) {
  return {
    id: packet.id,
    ...missionPacketAliases(packet),
    title: packet.title ?? packet.id,
    status: packet.status ?? "pending",
    lifecycleStatus: packet.lifecycleStatus ?? "active",
    lifecycleFamily: packet.lifecycleFamily ?? null,
    doveDomain: domainForPacket(packet),
    assignedRole: packet.assignedRole ?? null,
    phase: packet.phase ?? null,
    nextAction: packet.nextAction ?? null,
    outputPaths: normalizeStringArray(packet.outputPaths),
    evidenceLinks: normalizeStringArray(packet.evidenceLinks)
  };
}

function safeReadTaskPacketCatalog(root, taskPackets, readErrors) {
  try {
    return readTaskPacketCatalog(root);
  } catch (error) {
    readErrors.push({
      path: ARTIFACT_PATHS.taskPacketsDir,
      message: error instanceof Error ? error.message : String(error)
    });
    const packets = Array.isArray(taskPackets.items) ? taskPackets.items : [];
    return {
      index: taskPackets,
      packets,
      byId: new Map(packets.map((packet) => [packet.id, packet]).filter(([id]) => id))
    };
  }
}

function readDoveInputs(root) {
  const readErrors = [];
  const state = normalizeState(objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.state, createDefaultState, readErrors), createDefaultState));
  const board = objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.orchestrationBoard, () => createDefaultBoard(state), readErrors), () => createDefaultBoard(state));
  const workspaceIndex = normalizeWorkspaceIndex(objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.workspaceIndex, createWorkspaceIndex, readErrors), createWorkspaceIndex));
  const doveAuthorityManifest = normalizeDoveAuthorityManifest(objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.doveRootManifest, createDoveAuthorityManifest, readErrors), createDoveAuthorityManifest));
  const taskPackets = objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.taskPacketsIndex, createTaskPacketsIndex, readErrors), createTaskPacketsIndex);
  const taskCatalog = safeReadTaskPacketCatalog(root, taskPackets, readErrors);
  const reviewState = objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.reviewState, createReviewState, readErrors), createReviewState);
  const reviewConcerns = objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.reviewConcerns, () => ({ version: 2, items: [], updatedAt: null }), readErrors), () => ({ version: 2, items: [], updatedAt: null }));
  const versions = objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.versionsIndex, createVersionsIndex, readErrors), createVersionsIndex);
  const comparisons = objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.versionComparisons, createVersionComparisonsIndex, readErrors), createVersionComparisonsIndex);
  const experimentPlans = objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.experimentPlans, () => ({ version: 1, items: [], updatedAt: null }), readErrors), () => ({ version: 1, items: [], updatedAt: null }));
  const experimentResults = objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.experimentResults, () => ({ version: 1, items: [], updatedAt: null }), readErrors), () => ({ version: 1, items: [], updatedAt: null }));
  const experimentAudits = objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.experimentAudits, () => ({ version: 1, items: [], updatedAt: null }), readErrors), () => ({ version: 1, items: [], updatedAt: null }));
  const operatorLessons = objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.metaOperatorLessons, () => ({ version: 1, lessons: [], summary: { lessonCount: 0, activeLessonCount: 0, topLessonIds: [], lessonsPath: ARTIFACT_PATHS.metaOperatorLessons } }), readErrors), () => ({ version: 1, lessons: [], summary: { lessonCount: 0, activeLessonCount: 0, topLessonIds: [], lessonsPath: ARTIFACT_PATHS.metaOperatorLessons } }));
  const runtimeContinuation = normalizeRuntimeContinuationIndex(objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.runtimeContinuation, createRuntimeContinuationIndex, readErrors), createRuntimeContinuationIndex));
  const runtimeEvents = normalizeRuntimeEventsIndex(objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.runtimeEvents, createRuntimeEventsIndex, readErrors), createRuntimeEventsIndex));
  const runtimeResults = normalizeRuntimeResultsIndex(objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.runtimeResults, createRuntimeResultsIndex, readErrors), createRuntimeResultsIndex));
  const checklist = safeReadText(root, ARTIFACT_PATHS.checklist, readErrors);
  const packets = taskCatalog.packets.map(summarizePacket);
  return { state, board, workspaceIndex, doveAuthorityManifest, taskPackets, taskCatalog, packets, reviewState, reviewConcerns, versions, comparisons, experimentPlans, experimentResults, experimentAudits, operatorLessons, runtimeContinuation, runtimeEvents, runtimeResults, checklist, readErrors };
}

function normalizeDoveStatusTaskStatus(packet) {
  if ([packet.status, packet.lifecycleStatus].some(archivedPacketStatus)) {
    return "archived";
  }
  const raw = String(packet.status ?? packet.lifecycleStatus ?? "pending").trim().toLowerCase();
  if (DOVE_TASK_STATUSES.includes(raw)) {
    return raw;
  }
  if (raw === "active") {
    return "in-progress";
  }
  if (raw === "done") {
    return "completed";
  }
  return "pending";
}

function normalizeDoveStatusTaskStage(packet) {
  const raw = String(packet.stage ?? packet.taskStage ?? "").trim().toLowerCase();
  if (DOVE_TASK_STAGES.includes(raw)) {
    return raw;
  }
  const legacyStage = String(packet.missionStage ?? missionStageForPhase(packet.phase)).trim();
  if (["audit", "return"].includes(legacyStage)) {
    return "audit";
  }
  if (legacyStage === "execution") {
    return "execute";
  }
  return "plan";
}

function normalizeDoveStatusTaskDomain(packet) {
  const raw = String(packet.domain ?? packet.doveDomain ?? packet.missionDomain ?? "").trim().toLowerCase();
  if (DOVE_TASK_DOMAINS.includes(raw)) {
    return raw;
  }
  const legacyDomain = domainForPacket(packet);
  return DOVE_TASK_DOMAINS.includes(legacyDomain) ? legacyDomain : "engineering";
}

function normalizeDoveStatusCreatorKind(packet) {
  const raw = String(packet.creatorKind ?? "user").trim().toLowerCase();
  return DOVE_TASK_CREATOR_KINDS.includes(raw) ? raw : "user";
}

function normalizeDoveStatusLevel(packet) {
  const level = Number(packet.level);
  return Number.isFinite(level) ? level : 3;
}

function normalizeStatusContractStringArray(value) {
  if (Array.isArray(value)) {
    return normalizeStringArray(value);
  }
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

function firstStatusContractStringArray(...values) {
  for (const value of values) {
    const normalized = normalizeStatusContractStringArray(value);
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return [];
}

function statusCopyableCommand(command, packetId) {
  const publicCommand = toPublicDoveCommand(command, "project:dove.auto");
  return packetId ? `${publicCommand} --packet-id ${packetId}` : publicCommand;
}

function normalizeStatusContractRoutes(routes) {
  return (Array.isArray(routes) ? routes : []).map((route, index) => {
    const source = typeof route === "string" ? { command: route } : objectOrFallback(route, {});
    const command = typeof source.command === "string" && source.command.trim() ? toPublicDoveCommand(source.command, source.command) : null;
    if (!command) {
      return null;
    }
    return {
      label: source.label ?? source.title ?? null,
      command,
      copyableCommand: source.copyableCommand ?? source.copyCommand ?? null,
      packetId: source.packetId ?? source.taskPacketId ?? source.missionPacketId ?? null,
      when: source.when ?? source.reason ?? null,
      role: source.role ?? source.ownerRole ?? null,
      evidenceRequired: normalizeStatusContractStringArray(source.evidenceRequired ?? source.evidenceContract ?? source.evidenceExpectations),
      doneCriteria: normalizeStatusContractStringArray(source.doneCriteria),
      rank: Number.isFinite(source.rank) ? source.rank : index + 1
    };
  }).filter(Boolean);
}

function normalizeDoveStatusWorkContract(contract) {
  const explicit = objectOrFallback(contract, null);
  if (!explicit) {
    return null;
  }
  return {
    purpose: explicit.purpose ?? null,
    deliverables: normalizeStatusContractStringArray(explicit.deliverables),
    outOfScope: firstStatusContractStringArray(explicit.outOfScope, explicit.outOfScopeItems),
    evidenceContract: normalizeStatusContractStringArray(explicit.evidenceContract),
    doneCriteria: normalizeStatusContractStringArray(explicit.doneCriteria),
    recommendedRoutes: normalizeStatusContractRoutes(explicit.recommendedRoutes),
    practicalImpact: explicit.practicalImpact ?? null
  };
}

function summarizeDoveStatusTask(packet, responseLanguage = "zh") {
  const id = String(packet.id ?? packet.packetId ?? packet.missionPacketId ?? "").trim();
  const aliases = missionPacketAliases({ ...packet, id });
  const title = packet.title ?? id;
  const summary = packet.summary ?? packet.currentFocus ?? null;
  const stage = normalizeDoveStatusTaskStage(packet);
  const domain = normalizeDoveStatusTaskDomain(packet);
  const evidenceExpectations = normalizeStringArray(packet.evidenceExpectations ?? packet.acceptanceChecks);
  const ownerRole = packet.ownerRole ?? null;
  const nextRole = packet.nextRole ?? null;
  const nextAction = packet.nextAction ?? null;
  const workContract = normalizeDoveStatusWorkContract(packet.workContract);
  const executionContract = normalizeDoveExecutionContract(packet.executionContract, null);
  const executionReadiness = doveExecutionContractReadiness(executionContract);
  const verifiedCriteria = normalizeDoveVerifiedCriteria(packet.verifiedCriteria);
  const criteriaCoverage = doveExecutionCriteriaCoverage(executionContract, verifiedCriteria);
  const validationEvidencePaths = normalizeStringArray(packet.validationEvidencePaths);
  const verificationEvidencePaths = normalizeStringArray(packet.verificationEvidencePaths);
  const criteriaEvidencePaths = normalizeStringArray(verifiedCriteria.flatMap((item) => item.evidencePaths ?? []));
  const status = normalizeDoveStatusTaskStatus(packet);
  return {
    id,
    ...aliases,
    title,
    summary,
    parentId: packet.parentId ?? null,
    rootId: packet.rootId ?? null,
    level: normalizeDoveStatusLevel(packet),
    creatorKind: normalizeDoveStatusCreatorKind(packet),
    stage,
    domain,
    status,
    displayStatus: status === "completed" || status === "killed" ? "done" : status,
    lifecycleStatus: packet.lifecycleStatus ?? packet.status ?? null,
    dependencies: normalizeStringArray(packet.dependencies ?? packet.dependencyIds),
    blockedBy: normalizeStringArray(packet.blockedBy ?? packet.blockerIds),
    blockedReason: packet.blockedReason ?? packet.blockerReason ?? packet.blockingReason ?? null,
    lessonIds: normalizeStringArray(packet.lessonIds),
    sourcePlanTaskId: packet.sourcePlanTaskId ?? null,
    derivedFrom: packet.derivedFrom ?? null,
    evidenceExpectations,
    workContract,
    executionContract,
    executionReadiness,
    verifiedCriteria,
    criteriaCoverage,
    validationEvidencePaths,
    verificationEvidencePaths,
    artifactRefs: mergeStringArrays(packet.artifactRefs, packet.artifactPaths, packet.outputPaths, packet.evidenceLinks, validationEvidencePaths, verificationEvidencePaths, criteriaEvidencePaths),
    outputPaths: normalizeStringArray(packet.outputPaths),
    evidenceLinks: normalizeStringArray(packet.evidenceLinks),
    contextPolicy: packet.contextPolicy ?? null,
    currentFocus: packet.currentFocus ?? null,
    nextAction,
    createdAt: packet.createdAt ?? null,
    updatedAt: packet.updatedAt ?? null,
    completedAt: packet.completedAt ?? null,
    killedAt: packet.killedAt ?? null,
    killReason: packet.killReason ?? null,
    archivedAt: packet.archivedAt ?? null,
    archiveReason: packet.archiveReason ?? null,
    ownerRole,
    nextRole,
    boundary: normalizeDoveBoundary(packet.boundary, null),
    boundaryHistory: Array.isArray(packet.boundaryHistory) ? packet.boundaryHistory.map((item) => normalizeDoveBoundary(item, null)).filter(Boolean) : [],
    handoff: normalizeDoveHandoff(packet.handoff, null),
    lastTransition: packet.lastTransition && typeof packet.lastTransition === "object" && !Array.isArray(packet.lastTransition) ? packet.lastTransition : null
  };
}

function sortStatusTasks(tasks) {
  return [...tasks].sort((left, right) => left.level - right.level || String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? "")) || left.id.localeCompare(right.id));
}

function sortRecentStatusTasks(tasks) {
  return [...tasks].sort((left, right) => String(right.updatedAt ?? right.completedAt ?? right.killedAt ?? right.createdAt ?? "").localeCompare(String(left.updatedAt ?? left.completedAt ?? left.killedAt ?? left.createdAt ?? "")) || left.id.localeCompare(right.id));
}

function runtimeResultEntries(inputs) {
  const entries = [
    ...(Array.isArray(inputs.runtimeResults.items) ? inputs.runtimeResults.items : []),
    ...(Array.isArray(inputs.runtimeResults.entries) ? inputs.runtimeResults.entries : [])
  ].filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
  const byKey = new Map();
  for (const entry of entries) {
    const key = entry.id ?? entry.runId ?? `${entry.surface ?? "runtime"}:${entry.packetId ?? "unknown"}:${entry.updatedAt ?? entry.recordedAt ?? entry.createdAt ?? byKey.size}`;
    byKey.set(key, entry);
  }
  return Array.from(byKey.values());
}

function runtimeIterationForPacket(entry, packetId) {
  const iterations = Array.isArray(entry.iterations) ? entry.iterations : [];
  return [...iterations].reverse().find((iteration) => [iteration.packetId, iteration.taskId, iteration.missionPacketId].includes(packetId)) ?? null;
}

function runtimeEntryTouchesPacket(entry, packetId) {
  if ([entry.packetId, entry.taskId, entry.missionPacketId, entry.selectedPacketId].includes(packetId)) {
    return true;
  }
  if (runtimeIterationForPacket(entry, packetId)) {
    return true;
  }
  return ["updatedTaskIds", "awaitingResultTaskIds", "autoRunnableTaskIds", "hostPassRequiredTaskIds", "runnableTaskIds", "blockedTaskIds", "pendingTaskIds"].some((field) => normalizeStringArray(entry[field]).includes(packetId));
}

function runtimeTimestamp(entry, iteration = null) {
  return iteration?.completedAt ?? iteration?.startedAt ?? entry.updatedAt ?? entry.recordedAt ?? entry.completedAt ?? entry.createdAt ?? entry.startedAt ?? "";
}

function compactRuntimeExecutionReceipt(value) {
  const receipt = normalizeDoveExecutionReceipt(value, null);
  if (!receipt) {
    return null;
  }
  return {
    receiptId: receipt.receiptId ?? null,
    runId: receipt.runId ?? null,
    packetId: receipt.packetId ?? null,
    surface: receipt.surface ?? null,
    command: receipt.command ?? null,
    actionType: receipt.actionType ?? null,
    status: receipt.status ?? null,
    outcome: receipt.outcome ?? null,
    resultSummary: receipt.publicSafeSummary ?? receipt.resultSummary ?? null,
    lifecycleTransition: receipt.lifecycleTransition ?? null,
    evidenceCount: mergeStringArrays(
      receipt.evidenceLinks,
      receipt.evidencePaths,
      receipt.artifactRefs,
      receipt.artifactPaths,
      receipt.validationEvidencePaths,
      receipt.verificationEvidencePaths
    ).length,
    criteriaCoverage: receipt.criteriaCoverage ?? null,
    nextAction: receipt.nextAction ?? null
  };
}

function summarizeRuntimeRun(entry, packetId) {
  const iteration = runtimeIterationForPacket(entry, packetId);
  const executionReceipt = compactRuntimeExecutionReceipt(iteration?.output?.executionReceipt ?? iteration?.executionReceipt ?? entry.executionReceipt);
  return {
    id: entry.id ?? entry.runId ?? null,
    surface: entry.surface ?? null,
    packetId,
    status: iteration?.status ?? entry.status ?? null,
    outcome: iteration?.outcome ?? entry.outcome ?? null,
    stopReason: iteration?.stopReason ?? entry.stopReason ?? null,
    command: iteration?.command ?? entry.command ?? null,
    executionReceipt,
    startedAt: iteration?.startedAt ?? entry.startedAt ?? entry.createdAt ?? null,
    completedAt: iteration?.completedAt ?? entry.completedAt ?? entry.updatedAt ?? entry.recordedAt ?? null,
    updatedAt: entry.updatedAt ?? entry.recordedAt ?? null
  };
}

function lastRuntimeRunForTask(inputs, packetId) {
  return runtimeResultEntries(inputs)
    .filter((entry) => runtimeEntryTouchesPacket(entry, packetId))
    .sort((left, right) => String(runtimeTimestamp(right, runtimeIterationForPacket(right, packetId))).localeCompare(String(runtimeTimestamp(left, runtimeIterationForPacket(left, packetId)))))
    .map((entry) => summarizeRuntimeRun(entry, packetId))[0] ?? null;
}

function runtimeEventEntries(inputs) {
  return [
    ...(Array.isArray(inputs.runtimeEvents?.items) ? inputs.runtimeEvents.items : []),
    ...(Array.isArray(inputs.runtimeEvents?.entries) ? inputs.runtimeEvents.entries : [])
  ].filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
}

function runtimeEventTimestamp(entry) {
  return entry.timestamp ?? entry.recordedAt ?? entry.completedAt ?? entry.createdAt ?? entry.startedAt ?? "";
}

function runtimeEventTouchesPacket(entry, packetId) {
  return [entry.packetId, entry.taskId, entry.missionPacketId, entry.boundary?.packetId].includes(packetId);
}

function summarizeRuntimeEvent(entry) {
  return {
    id: entry.id ?? entry.eventId ?? null,
    type: entry.type ?? entry.eventType ?? null,
    packetId: entry.packetId ?? entry.taskId ?? entry.missionPacketId ?? null,
    runId: entry.runId ?? null,
    surface: entry.surface ?? entry.sourceSurface ?? null,
    command: entry.command ?? null,
    fromStatus: entry.fromStatus ?? null,
    toStatus: entry.toStatus ?? null,
    boundaryId: entry.boundaryId ?? entry.boundary?.id ?? null,
    handoffId: entry.handoffId ?? entry.handoff?.id ?? null,
    summary: entry.summary ?? null,
    timestamp: runtimeEventTimestamp(entry)
  };
}

function lastRuntimeEventForTask(inputs, packetId) {
  return runtimeEventEntries(inputs)
    .filter((entry) => runtimeEventTouchesPacket(entry, packetId))
    .sort((left, right) => String(runtimeEventTimestamp(right)).localeCompare(String(runtimeEventTimestamp(left))))
    .map(summarizeRuntimeEvent)[0] ?? null;
}

function continuationForTask(inputs, packetId) {
  const item = (Array.isArray(inputs.runtimeContinuation.items) ? inputs.runtimeContinuation.items : []).find((candidate) => candidate?.packetId === packetId) ?? null;
  if (!item) {
    return null;
  }
  return {
    kind: item.kind ?? null,
    command: item.command ?? null,
    packetId,
    programRunId: item.programRunId ?? null,
    followThroughId: item.followThroughId ?? null,
    summary: item.summary ?? null,
    requiredReadPaths: normalizeStringArray(item.requiredReadPaths),
    readyAt: item.readyAt ?? null
  };
}

function openBoundaryForTask(task) {
  const boundary = normalizeDoveBoundary(task.boundary, null);
  return boundary?.status === "open" ? boundary : null;
}

function summarizeActionableBoundary(task) {
  const boundary = task.currentBoundary ?? openBoundaryForTask(task);
  if (!boundary || task.level === 0 || ["completed", "killed"].includes(task.status)) {
    return null;
  }
  return {
    id: boundary.id,
    type: boundary.type,
    status: boundary.status,
    packetId: task.id,
    title: task.title,
    taskStatus: task.status,
    reason: boundary.reason,
    summary: boundary.summary,
    requiredInputs: normalizeStringArray(boundary.requiredInputs),
    requiredActions: normalizeStringArray(boundary.requiredActions),
    ownerRole: boundary.ownerRole ?? task.ownerRole ?? null,
    nextRole: boundary.nextRole ?? task.nextRole ?? null,
    createdAt: boundary.createdAt ?? null,
    command: boundary.command ?? task.nextAction ?? null,
    runId: boundary.runId ?? null,
    handoff: normalizeDoveHandoff(task.handoff, null)
  };
}

function boundaryRecommendsBlocked(task) {
  const boundary = task.currentBoundary ?? openBoundaryForTask(task);
  return ["blocked-boundary", "missing-executable-contract", "plan-output-not-executable", "missing-required-materials", "missing-secret-env", "provider-failed", "workflow-error-boundary", "verification-failed", "debug-retry-required", "fix-required", "needs-review", "awaiting-provider-output", "awaiting-review-output"].includes(boundary?.type);
}

function statusActionBase(fields = {}) {
  return {
    proposalOnly: true,
    noAutoApply: true,
    confirmationRequired: true,
    ...fields
  };
}

function boundaryActionKind(boundary) {
  if (["needs-review", "awaiting-review-output"].includes(boundary?.type)) {
    return "send-to-review";
  }
  if (["awaiting-host-pass", "awaiting-host-pass-result", "awaiting-host-results", "host-tool-blocked", "awaiting-provider-output", "missing-executable-contract", "plan-output-not-executable", "missing-required-materials", "missing-secret-env", "verification-failed", "debug-retry-required", "fix-required"].includes(boundary?.type)) {
    return "provide-evidence-or-result";
  }
  return "adjust-status";
}

function toPublicDoveCommand(command, fallback = "project:dove.status") {
  const normalized = typeof command === "string" ? command.trim() : "";
  if (!normalized) {
    return fallback;
  }
  if (normalized.startsWith("project:dove.")) {
    return normalized;
  }
  const toolRoutes = {
    run_dove_auto: "project:dove.auto",
    run_dove_operator: "project:dove.operator",
    create_dove_task: "project:dove.mission",
    record_dove_mission_pass: "project:dove.mission",
    apply_dove_status_adjustments: "project:dove.status",
    run_audio_review: "project:dove.review",
    run_dove_review_loop: "project:dove.review-loop",
    run_experience_workflow: "project:dove.experience",
    run_figure_workflow: "project:dove.figure",
    register_source: "project:dove.source",
    upsert_note: "project:dove.note",
    upsert_draft: "project:dove.draft",
    build_rebuttal: "project:dove.rebuttal"
  };
  return toolRoutes[normalized] ?? (normalized.startsWith("dove.") ? `project:${normalized}` : fallback);
}

function boundaryActionCommand(task, boundary, kind) {
  if (kind === "send-to-review") {
    return "project:dove.review";
  }
  if (kind === "adjust-status") {
    return "project:dove.status";
  }
  return toPublicDoveCommand(boundary?.command ?? task.continuationState?.command ?? task.nextAction, "project:dove.status");
}

function boundaryActionLabel(kind, responseLanguage) {
  if (kind === "send-to-review") {
    return doveText(responseLanguage, "boundaryActionReviewLabel");
  }
  if (kind === "provide-evidence-or-result") {
    return doveText(responseLanguage, "boundaryActionEvidenceLabel");
  }
  if (kind === "kill-through-status") {
    return doveText(responseLanguage, "boundaryActionKillLabel");
  }
  if (kind === "continue-resume") {
    return doveText(responseLanguage, "boundaryActionContinueLabel");
  }
  return doveText(responseLanguage, "boundaryActionStatusLabel");
}

function boundaryActionOption(kind, task, boundary, responseLanguage) {
  const command = boundaryActionCommand(task, boundary, kind);
  return statusActionBase({
    id: `${boundary.id}-${kind}`,
    label: boundaryActionLabel(kind, responseLanguage),
    kind,
    command,
    tool: ["adjust-status", "kill-through-status"].includes(kind) ? "apply_dove_status_adjustments" : null,
    packetId: task.id,
    boundaryId: boundary.id,
    boundaryType: boundary.type,
    requires: mergeStringArrays(boundary.requiredInputs, boundary.requiredActions),
    requiredInputs: normalizeStringArray(boundary.requiredInputs),
    requiredActions: normalizeStringArray(boundary.requiredActions)
  });
}

function buildBoundaryActionCard(task, responseLanguage = "zh") {
  const boundary = task.actionableBoundary ?? summarizeActionableBoundary(task);
  if (!boundary) {
    return null;
  }
  const primaryKind = boundaryActionKind(boundary);
  const optionKinds = Array.from(new Set([
    task.continuationState || task.nextAction ? "continue-resume" : null,
    primaryKind,
    "adjust-status",
    "kill-through-status"
  ].filter(Boolean)));
  const options = optionKinds.map((kind) => boundaryActionOption(kind, task, boundary, responseLanguage));
  const primaryOption = options.find((option) => option.kind === primaryKind) ?? options[0];
  return statusActionBase({
    id: `boundary-action-${boundary.id}`,
    label: primaryOption.label,
    kind: primaryKind,
    command: primaryOption.command,
    tool: primaryOption.tool,
    packetId: task.id,
    title: task.title,
    boundaryId: boundary.id,
    boundaryType: boundary.type,
    reason: boundary.reason,
    summary: boundary.summary,
    requiredInputs: normalizeStringArray(boundary.requiredInputs),
    requiredActions: normalizeStringArray(boundary.requiredActions),
    requires: mergeStringArrays(boundary.requiredInputs, boundary.requiredActions),
    ownerRole: boundary.ownerRole ?? task.ownerRole ?? null,
    nextRole: boundary.nextRole ?? task.nextRole ?? null,
    handoff: boundary.handoff ?? task.handoff ?? null,
    runId: boundary.runId ?? null,
    options
  });
}

function rankStatusActionCards(cards) {
  return cards
    .filter(Boolean)
    .sort((left, right) => (left.priority ?? 100) - (right.priority ?? 100) || String(left.title ?? "").localeCompare(String(right.title ?? "")))
    .slice(0, 3)
    .map((card, index) => {
      const { priority, ...rest } = card;
      return { ...rest, rank: index + 1 };
    });
}

function completionConsistencyFindings(completionConsistency = {}) {
  return Array.isArray(completionConsistency.findings) ? completionConsistency.findings : [];
}

function completionConsistencyOpenChecklistChildIds(completionConsistency = {}) {
  return new Set(completionConsistencyFindings(completionConsistency).flatMap((finding) => normalizeStringArray(finding.openChecklistChildIds)));
}

function buildCompletionReconciliationCard(completionConsistency = {}, responseLanguage = "zh") {
  const findings = completionConsistencyFindings(completionConsistency);
  if (findings.length === 0) {
    return null;
  }
  const openChecklistChildIds = Array.from(completionConsistencyOpenChecklistChildIds(completionConsistency));
  return statusActionBase({
    priority: 70,
    kind: "reconcile-completion-consistency",
    title: doveText(responseLanguage, "statusHomeReconcileTitle", { count: findings.length }),
    why: doveText(responseLanguage, "statusHomeReconcileWhy"),
    command: "project:dove.status",
    firstAction: "project:dove.status",
    affectedParentIds: normalizeStringArray(findings.map((finding) => finding.parentId)),
    findingCount: findings.length,
    openChecklistChildCount: openChecklistChildIds.length,
    openChecklistChildIds,
    evidenceRequired: openChecklistChildIds,
    doneCriteria: [doveText(responseLanguage, "statusHomeReconcileDoneCriteria")],
    findings
  });
}

function primaryStatusRoute(task = {}) {
  const routes = Array.isArray(task.workContract?.recommendedRoutes) ? task.workContract.recommendedRoutes : [];
  return routes.find((route) => typeof route?.command === "string" && route.command.trim()) ?? null;
}

function statusRouteEvidence(task = {}, route = null) {
  return firstStatusContractStringArray(route?.evidenceRequired, task.executionReadiness?.evidenceRequired, task.executionReadiness?.requiredMaterials, task.workContract?.evidenceContract, task.evidenceExpectations);
}

function statusRouteDoneCriteria(task = {}, route = null) {
  return firstStatusContractStringArray(route?.doneCriteria, task.executionContract?.convergence?.criteria, task.executionContract?.convergence?.definitionOfDone, task.workContract?.doneCriteria);
}

function statusInlineText(responseLanguage, zh, en) {
  return responseLanguage === "en" ? en : zh;
}

function statusTaskEvidenceBundle(task = {}) {
  return mergeStringArrays(
    task.artifactRefs,
    task.outputPaths,
    task.evidenceLinks,
    task.validationEvidencePaths,
    task.verificationEvidencePaths,
    task.verifiedCriteria?.flatMap((item) => item.evidencePaths ?? [])
  );
}

function missingExecutionMaterials(task = {}) {
  const required = normalizeStringArray(task.executionReadiness?.requiredMaterials);
  if (required.length === 0) {
    return [];
  }
  const available = new Set(statusTaskEvidenceBundle(task).map((item) => item.toLowerCase()));
  return required.filter((item) => !available.has(item.toLowerCase()));
}

function hasExecutableContract(task = {}) {
  return task.executionReadiness?.ready === true;
}

function buildMissingExecutionContractCard(task, responseLanguage = "zh") {
  if (hasExecutableContract(task)) {
    return null;
  }
  return statusActionBase({
    priority: 20,
    kind: "missing-executable-contract",
    title: statusInlineText(responseLanguage, `补齐可执行合同：${task.title}`, `Add executable contract: ${task.title}`),
    why: statusInlineText(responseLanguage, "Planner 必须先产出 action、implementation、convergence.criteria 和 failureRoutes，不能让任务只停留在 mission 文案。", "Planner must provide action, implementation, convergence.criteria, and failureRoutes before the task can execute."),
    packetId: task.id,
    command: "project:dove.mission",
    firstAction: statusCopyableCommand("project:dove.mission", task.id),
    evidenceRequired: normalizeStringArray(task.executionReadiness?.missing).map((item) => item === "executionContract" ? item : `executionContract.${item}`),
    doneCriteria: [statusInlineText(responseLanguage, "任务包含可执行合同，并明确 Builder 证据与 Reviewer 验证标准。", "Task has an executable contract with Builder evidence and Reviewer verification criteria.")],
    executionReadiness: task.executionReadiness,
    nextRole: "planner"
  });
}

function buildMissingExecutionMaterialsCard(task, responseLanguage = "zh") {
  if (!hasExecutableContract(task)) {
    return null;
  }
  const missingMaterials = missingExecutionMaterials(task);
  if (missingMaterials.length === 0) {
    return null;
  }
  return statusActionBase({
    priority: 30,
    kind: "missing-required-materials",
    title: statusInlineText(responseLanguage, `补材料/输入：${task.title}`, `Provide materials/inputs: ${task.title}`),
    why: statusInlineText(responseLanguage, "执行合同声明了必需输入或 artifact，Builder 不能在材料缺失时假装推进。", "The execution contract declares required inputs or artifacts; Builder cannot claim progress while materials are missing."),
    packetId: task.id,
    command: "project:dove.status",
    firstAction: "project:dove.status",
    evidenceRequired: missingMaterials,
    doneCriteria: [statusInlineText(responseLanguage, "缺失材料被注册为 source、artifact 或 verification evidence。", "Missing materials are registered as source, artifact, or verification evidence.")],
    requiredMaterials: missingMaterials,
    executionContract: task.executionContract,
    nextRole: "planner"
  });
}

function taskNeedsBuilderExecution(task = {}) {
  const hasEvidence = statusTaskEvidenceBundle(task).length > 0;
  return hasExecutableContract(task) && missingExecutionMaterials(task).length === 0 && !(task.criteriaCoverage?.complete === false && hasEvidence);
}

function buildReadyBuilderExecutionCard(task, responseLanguage = "zh") {
  if (!taskNeedsBuilderExecution(task)) {
    return null;
  }
  const route = primaryStatusRoute(task);
  const command = toPublicDoveCommand(route?.command ?? task.nextAction, "project:dove.auto");
  return statusActionBase({
    priority: 40,
    kind: "ready-builder-execution",
    title: statusInlineText(responseLanguage, `执行合同：${task.title}`, `Execute contract: ${task.title}`),
    why: statusInlineText(responseLanguage, "合同已可执行，下一步应由 Builder 产出真实证据，而不是继续整理状态。", "The contract is executable; Builder should now produce real evidence instead of more bookkeeping."),
    packetId: task.id,
    command,
    firstAction: route?.copyableCommand ?? statusCopyableCommand(command, task.id),
    copyableCommand: route?.copyableCommand ?? statusCopyableCommand(command, task.id),
    evidenceRequired: statusRouteEvidence(task, route),
    doneCriteria: statusRouteDoneCriteria(task, route),
    executionContract: task.executionContract,
    nextRole: "builder"
  });
}

function buildVerificationGapCard(task, responseLanguage = "zh") {
  if (!hasExecutableContract(task) || task.criteriaCoverage?.complete !== false || statusTaskEvidenceBundle(task).length === 0) {
    return null;
  }
  return statusActionBase({
    priority: 45,
    kind: "verification-failed",
    title: statusInlineText(responseLanguage, `补验证覆盖：${task.title}`, `Complete verification coverage: ${task.title}`),
    why: statusInlineText(responseLanguage, "已有执行证据，但 verifiedCriteria 尚未覆盖全部 convergence.criteria。", "Execution evidence exists, but verifiedCriteria does not cover all convergence.criteria."),
    packetId: task.id,
    command: "project:dove.status",
    firstAction: "project:dove.status",
    evidenceRequired: normalizeStringArray(task.criteriaCoverage?.missing),
    doneCriteria: normalizeStringArray(task.criteriaCoverage?.required),
    criteriaCoverage: task.criteriaCoverage,
    nextRole: "reviewer"
  });
}

function taskLooksLikeCleanupNoise(task = {}) {
  if (task.derivedFrom === "blocked-mission-investigation") {
    return true;
  }
  const searchable = normalizeStringArray([task.id, task.title, task.summary, task.sourceId, task.sourceType, task.creatorKind]).join(" ").toLowerCase();
  return /\bdogfood\b|visible[-_ ]?test|operator[-_ ]?investigation|blocked[-_ ]?mission[-_ ]?investigation/.test(searchable);
}

function cleanupArchiveCandidates(tasks = []) {
  return sortStatusTasks(tasks.filter((task) => task.level !== 0
    && !["completed", "killed", "archived"].includes(task.status)
    && !isArchivedStatusTask(task)
    && taskLooksLikeCleanupNoise(task))).slice(0, 5);
}

function buildCleanupArchiveCard(tasks = [], responseLanguage = "zh") {
  const candidates = cleanupArchiveCandidates(tasks);
  if (candidates.length === 0) {
    return null;
  }
  const candidateIds = candidates.map((task) => task.id);
  return statusActionBase({
    priority: 80,
    kind: "cleanup-archive",
    title: statusInlineText(responseLanguage, "归档过期测试/调查噪音", "Archive stale test/investigation noise"),
    why: statusInlineText(responseLanguage, "发现疑似 dogfood 或 operator blocker-investigation 噪音；只建议通过显式 status adjustment 归档，不删除证据。", "Likely dogfood or operator blocker-investigation noise was found; archive it only through explicit status adjustment and preserve evidence."),
    command: "project:dove.status",
    firstAction: "project:dove.status --request-status-adjustment",
    copyableCommand: "project:dove.status --request-status-adjustment",
    evidenceRequired: candidateIds,
    doneCriteria: [statusInlineText(responseLanguage, "确认这些 packet 已过期后，将它们调整为 archived，保留 durable evidence。", "After confirming these packets are stale, adjust them to archived while preserving durable evidence.")],
    requires: candidateIds,
    options: [{ kind: "preview-status-adjustments", label: statusInlineText(responseLanguage, "预览状态调整", "Preview status adjustments"), command: "project:dove.status --request-status-adjustment" }]
  });
}

function buildStatusExecutionGaps(activeTasks = []) {
  const missingContractTasks = [];
  const missingMaterialTasks = [];
  const verificationGapTasks = [];
  const readyBuilderTasks = [];
  const requiredMaterials = [];
  const evidenceRequired = [];
  for (const task of activeTasks) {
    if (task.actionableBoundary) {
      continue;
    }
    if (!hasExecutableContract(task)) {
      missingContractTasks.push(task);
      evidenceRequired.push(...normalizeStringArray(task.executionReadiness?.missing).map((item) => item === "executionContract" ? item : `executionContract.${item}`));
      continue;
    }
    const missingMaterials = missingExecutionMaterials(task);
    if (missingMaterials.length > 0) {
      missingMaterialTasks.push(task);
      requiredMaterials.push(...missingMaterials);
      evidenceRequired.push(...missingMaterials);
      continue;
    }
    if (task.criteriaCoverage?.complete === false && statusTaskEvidenceBundle(task).length > 0) {
      verificationGapTasks.push(task);
      evidenceRequired.push(...normalizeStringArray(task.criteriaCoverage.missing));
      continue;
    }
    if (taskNeedsBuilderExecution(task)) {
      readyBuilderTasks.push(task);
      evidenceRequired.push(...statusRouteEvidence(task, primaryStatusRoute(task)));
    }
  }
  return {
    missingContractTaskIds: missingContractTasks.map((task) => task.id),
    missingMaterialTaskIds: missingMaterialTasks.map((task) => task.id),
    verificationGapTaskIds: verificationGapTasks.map((task) => task.id),
    readyBuilderTaskIds: readyBuilderTasks.map((task) => task.id),
    requiredMaterials: mergeStringArrays(requiredMaterials),
    evidenceRequired: mergeStringArrays(evidenceRequired),
    counts: {
      missingContract: missingContractTasks.length,
      missingMaterials: missingMaterialTasks.length,
      verificationGaps: verificationGapTasks.length,
      readyBuilder: readyBuilderTasks.length,
      blocking: missingContractTasks.length + missingMaterialTasks.length + verificationGapTasks.length
    }
  };
}

function buildStatusNextActionCards({ initTask, activeTasks, blockedTasks, visibleTasks, review, boundaryActionCards, completionConsistency, responseLanguage = "zh" }) {
  const cards = [];
  const seen = new Set();
  const reconciliationChildIds = completionConsistencyOpenChecklistChildIds(completionConsistency);
  const pushCard = (key, card) => {
    if (!key || seen.has(key) || !card) {
      return;
    }
    seen.add(key);
    cards.push(statusActionBase(card));
  };
  if (!initTask) {
    pushCard("init", {
      priority: 0,
      kind: "init",
      title: doveText(responseLanguage, "statusHomeInitTitle"),
      why: doveText(responseLanguage, "statusHomeInitWhy"),
      command: "project:dove.init",
      firstAction: "project:dove.init",
      evidenceRequired: []
    });
  }
  pushCard("completion-consistency", buildCompletionReconciliationCard(completionConsistency, responseLanguage));
  for (const action of boundaryActionCards) {
    if (reconciliationChildIds.has(action.packetId)) {
      continue;
    }
    const kind = action.kind === "send-to-review" ? "review-needed" : action.kind === "provide-evidence-or-result" ? "provide-evidence" : "boundary-resume";
    pushCard(`boundary:${action.boundaryId}`, {
      priority: 10,
      kind,
      title: doveText(responseLanguage, "statusHomeBoundaryTitle", { title: action.title ?? action.packetId }),
      why: doveText(responseLanguage, "statusHomeBoundaryWhy", { reason: action.reason }),
      packetId: action.packetId,
      command: action.command,
      firstAction: action.label,
      evidenceRequired: action.requires,
      boundary: {
        id: action.boundaryId,
        type: action.boundaryType,
        reason: action.reason,
        requiredInputs: action.requiredInputs,
        requiredActions: action.requiredActions
      },
      handoff: action.handoff,
      boundaryActionCard: action
    });
  }
  for (const task of activeTasks) {
    if (reconciliationChildIds.has(task.id) || task.actionableBoundary) {
      continue;
    }
    pushCard(`execution-contract:${task.id}`, buildMissingExecutionContractCard(task, responseLanguage));
    pushCard(`execution-materials:${task.id}`, buildMissingExecutionMaterialsCard(task, responseLanguage));
    pushCard(`execution-builder:${task.id}`, buildReadyBuilderExecutionCard(task, responseLanguage));
    pushCard(`execution-verification:${task.id}`, buildVerificationGapCard(task, responseLanguage));
  }
  for (const task of activeTasks) {
    if (reconciliationChildIds.has(task.id) || !task.continuationState) {
      continue;
    }
    const route = primaryStatusRoute(task);
    const command = toPublicDoveCommand(task.continuationState.command ?? route?.command ?? task.nextAction, "project:dove.auto");
    pushCard(`continuation:${task.id}`, {
      priority: 20,
      kind: "continue-task",
      title: doveText(responseLanguage, "statusHomeContinuationTitle", { title: task.title }),
      why: route?.when ?? task.workContract?.practicalImpact ?? doveText(responseLanguage, "statusHomeContinuationWhy"),
      packetId: task.id,
      command,
      firstAction: route?.copyableCommand ?? statusCopyableCommand(command, task.id),
      copyableCommand: route?.copyableCommand ?? statusCopyableCommand(command, task.id),
      evidenceRequired: statusRouteEvidence(task, route),
      doneCriteria: statusRouteDoneCriteria(task, route),
      workContract: task.workContract,
      route,
      continuation: task.continuationState,
      handoff: task.handoff ?? null
    });
  }
  for (const task of blockedTasks) {
    pushCard(`blocked:${task.id}`, {
      priority: 30,
      kind: "blocked-unblock",
      title: doveText(responseLanguage, "statusHomeBlockedTitle", { title: task.title }),
      why: doveText(responseLanguage, "statusHomeBlockedWhy", { reason: task.blockedReason ?? task.lastStopReason }),
      packetId: task.id,
      command: "project:dove.status",
      firstAction: "project:dove.status",
      evidenceRequired: normalizeStringArray(task.evidenceExpectations),
      boundary: task.currentBoundary ?? null,
      handoff: task.handoff ?? null
    });
  }
  if ((review.unresolvedConcernCount ?? 0) > 0) {
    pushCard("review", {
      priority: 40,
      kind: "review-needed",
      title: doveText(responseLanguage, "statusHomeReviewTitle"),
      why: doveText(responseLanguage, "statusHomeReviewWhy"),
      command: "project:dove.review",
      firstAction: "project:dove.review",
      evidenceRequired: normalizeStringArray(review.unresolvedConcernIds)
    });
  }
  for (const task of activeTasks) {
    if (reconciliationChildIds.has(task.id)) {
      continue;
    }
    const route = primaryStatusRoute(task);
    if (!task.nextAction && !route) {
      continue;
    }
    const command = toPublicDoveCommand(route?.command ?? task.nextAction, "project:dove.auto");
    pushCard(`next:${task.id}`, {
      priority: 50,
      kind: "continue-task",
      title: doveText(responseLanguage, "statusHomeContinueTitle", { title: task.title }),
      why: route?.when ?? task.workContract?.practicalImpact ?? doveText(responseLanguage, "statusHomeContinueWhy"),
      packetId: task.id,
      command,
      firstAction: route?.copyableCommand ?? statusCopyableCommand(command, task.id),
      copyableCommand: route?.copyableCommand ?? statusCopyableCommand(command, task.id),
      evidenceRequired: statusRouteEvidence(task, route),
      doneCriteria: statusRouteDoneCriteria(task, route),
      workContract: task.workContract,
      route,
      boundary: task.currentBoundary ?? null,
      handoff: task.handoff ?? null
    });
  }
  if (initTask && activeTasks.length === 0) {
    pushCard("mission", {
      priority: 60,
      kind: "create-mission",
      title: doveText(responseLanguage, "statusHomeCreateMissionTitle"),
      why: doveText(responseLanguage, "statusHomeCreateMissionWhy"),
      command: "project:dove.mission",
      firstAction: "project:dove.mission",
      evidenceRequired: []
    });
  }
  pushCard("cleanup-archive", buildCleanupArchiveCard(visibleTasks, responseLanguage));
  return rankStatusActionCards(cards);
}

function buildStatusAdjustmentCard(task, recommendedStatus, responseLanguage = "zh") {
  return statusActionBase({
    presentation: "compact-status-adjustment-card",
    packetId: task.id,
    title: task.title,
    currentStatus: task.status,
    recommendedStatus,
    scope: doveText(responseLanguage, "compactCardScope", { stage: task.stage, domain: task.domain, status: task.status }),
    why: task.blockedReason ?? task.lastStopReason ?? doveText(responseLanguage, "compactCardFirstActionFallback"),
    firstAction: "apply_dove_status_adjustments",
    evidenceRequired: normalizeStringArray(task.evidenceExpectations),
    boundaryOrResume: task.actionableBoundary ?? task.currentBoundary ?? null,
    confirmation: doveText(responseLanguage, "compactCardNoAutomaticExecution")
  });
}

function buildRecentExecutionReceipts(tasks = []) {
  const seen = new Set();
  return sortRecentStatusTasks(tasks)
    .map((task) => {
      const receipt = task.lastRun?.executionReceipt ?? null;
      if (!receipt) {
        return null;
      }
      return {
        ...receipt,
        packetId: receipt.packetId ?? task.id,
        title: task.title ?? null,
        completedAt: task.lastRun?.completedAt ?? task.lastRun?.updatedAt ?? null
      };
    })
    .filter((receipt) => {
      if (!receipt) {
        return false;
      }
      const key = receipt.receiptId ?? receipt.runId ?? `${receipt.packetId}:${receipt.completedAt ?? "unknown"}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function buildDailyHome({ initTask, activeTasks, blockedTasks, visibleTasks, review, boundaryActionCards, completionConsistency, executionGaps, archivedHiddenCount = 0, responseLanguage = "zh" }) {
  return {
    presentation: "dove-status-home",
    liveContextFirst: true,
    nextActions: buildStatusNextActionCards({ initTask, activeTasks, blockedTasks, visibleTasks, review, boundaryActionCards, completionConsistency, responseLanguage }),
    recentExecutionReceipts: buildRecentExecutionReceipts(visibleTasks),
    missionList: buildStatusMissionList(visibleTasks, { archivedHiddenCount }),
    completionConsistency,
    executionGaps,
    boundaryActionCards,
    suppressUserFacingDumps: ["raw mission counts", "raw status counts", "recent completed missions", "recent killed missions"]
  };
}

function selectDailyHomeNextCommand(statusHome, fallbackNextCommand) {
  const ranked = Array.isArray(statusHome?.nextSteps?.ranked) ? statusHome.nextSteps.ranked : statusHome?.nextActions;
  const firstAction = Array.isArray(ranked) ? ranked.find((card) => typeof card?.command === "string" && card.command.trim()) : null;
  return firstAction?.command ?? statusHome?.nextSteps?.suggestedNextCommand ?? fallbackNextCommand;
}

function applicableLessonsForTask(inputs, task) {
  const lessons = Array.isArray(inputs.operatorLessons.lessons) ? inputs.operatorLessons.lessons : [];
  const linkedLessonIds = new Set(normalizeStringArray(task.lessonIds));
  return lessons.filter((lesson) => {
    const status = String(lesson.status ?? "active").trim().toLowerCase();
    const packetIds = normalizeStringArray(lesson.packetIds);
    return status === "active" && (packetIds.length === 0 || packetIds.includes(task.id) || linkedLessonIds.has(lesson.id));
  }).slice(0, 10).map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    mustObey: lesson.mustObey ?? true,
    nextTime: normalizeStringArray(lesson.nextTime)
  }));
}

function unresolvedDependencyIdsForTask(task, byId) {
  return mergeStringArrays(task.dependencies, task.blockedBy).filter((dependencyId) => {
    const dependency = byId.get(dependencyId);
    return !dependency || dependency.status !== "completed";
  });
}

function enrichStatusTasks(tasks, inputs) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return tasks.map((task) => {
    const unresolvedDependencyIds = unresolvedDependencyIdsForTask(task, byId);
    const lastRun = lastRuntimeRunForTask(inputs, task.id);
    const lastEvent = lastRuntimeEventForTask(inputs, task.id);
    const continuationState = continuationForTask(inputs, task.id);
    const currentBoundary = openBoundaryForTask(task);
    const currentBoundaryBlocks = boundaryRecommendsBlocked({ ...task, currentBoundary });
    const blockedReason = task.blockedReason
      ?? (currentBoundaryBlocks ? currentBoundary?.reason : null)
      ?? (task.blockedBy.length > 0 ? `blocked-by:${task.blockedBy.join(",")}` : null)
      ?? (unresolvedDependencyIds.length > 0 ? `unresolved-dependencies:${unresolvedDependencyIds.join(",")}` : null);
    return {
      ...task,
      blockedReason,
      unresolvedDependencyIds,
      currentBoundary,
      actionableBoundary: summarizeActionableBoundary({ ...task, currentBoundary, blockedReason }),
      handoff: normalizeDoveHandoff(task.handoff, null),
      lastRun,
      lastEvent,
      lastStopReason: currentBoundary?.reason ?? lastRun?.stopReason ?? lastEvent?.summary ?? null,
      continuationState,
      applicableLessons: applicableLessonsForTask(inputs, task)
    };
  });
}

function hasTaskBlockerSignal(task) {
  return task.status === "blocked" || boundaryRecommendsBlocked(task) || Boolean(task.blockedReason) || task.blockedBy.length > 0 || normalizeStringArray(task.unresolvedDependencyIds).length > 0;
}

function runtimeIndicatesInProgress(task) {
  return [task.lastRun?.status, task.lastRun?.outcome, task.continuationState?.kind].some((value) => String(value ?? "").includes("in-progress") || String(value ?? "").includes("continue"));
}

function runtimeIndicatesCompleted(task) {
  return Boolean(task.completedAt) || [task.lastRun?.status, task.lastRun?.outcome].some((value) => ["completed", "task-completed"].includes(String(value ?? "")));
}

function recommendedStatusForTask(task) {
  if (task.status === "archived" || isArchivedStatusTask(task)) {
    return "archived";
  }
  if (runtimeIndicatesCompleted(task)) {
    return "completed";
  }
  if (boundaryRecommendsBlocked(task) || hasTaskBlockerSignal(task)) {
    return "blocked";
  }
  if (runtimeIndicatesInProgress(task)) {
    return "in-progress";
  }
  if (task.status === "pending") {
    return "ready";
  }
  return task.status;
}

function buildStatusAdjustmentContract(tasks, responseLanguage = "zh") {
  const adjustableTasks = sortStatusTasks(tasks.filter((task) => task.level !== 0 && !["completed", "killed", "archived"].includes(task.status) && !isArchivedStatusTask(task)));
  const items = adjustableTasks.map((task, index) => {
    const recommendedStatus = recommendedStatusForTask(task);
    const adjustmentCard = buildStatusAdjustmentCard(task, recommendedStatus, responseLanguage);
    return {
      index: index + 1,
      packetId: task.id,
      title: task.title,
      currentStatus: task.status,
      recommendedStatus,
      level: task.level,
      stage: task.stage,
      domain: task.domain,
      blockedReason: task.blockedReason,
      lastStopReason: task.lastStopReason,
      currentBoundary: task.currentBoundary ?? null,
      actionableBoundary: task.actionableBoundary ?? null,
      handoff: task.handoff ?? null,
      lastEvent: task.lastEvent ?? null,
      adjustmentCard,
      choices: DOVE_TASK_STATUSES,
      confirmArgs: {
        adjustments: [{ packetId: task.id, status: recommendedStatus }],
        confirmed: true
      }
    };
  });
  return {
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    mutationTool: "apply_dove_status_adjustments",
    statusChoices: DOVE_TASK_STATUSES,
    itemCount: adjustableTasks.length,
    adjustmentCards: items.map((item) => item.adjustmentCard),
    items
  };
}

const STATUS_COMPACT_GROUP_LIMITS = {
  doing: 5,
  blocked: 5,
  todo: 5,
  done: 0,
  archived: 0
};

const STATUS_ADJUSTMENT_PREVIEW_LIMIT = 8;

function wantsFullDoveStatus(args = {}) {
  const detail = String(args.detail ?? args.view ?? args.resultMode ?? "").trim().toLowerCase();
  return detail === "full" || detail === "details" || detail === "debug" || booleanArg(args.full) || booleanArg(args.includeDetails);
}

function wantsMissionDetails(args = {}) {
  const detail = String(args.detail ?? args.view ?? args.resultMode ?? "").trim().toLowerCase();
  return booleanArg(args.showMissions) || booleanArg(args.includeMissionDetails) || booleanArg(args.missions) || ["missions", "mission-details", "mission-list"].includes(detail);
}

function wantsStatusAdjustmentPreview(args = {}) {
  const detail = String(args.detail ?? args.view ?? args.resultMode ?? "").trim().toLowerCase();
  return booleanArg(args.requestStatusAdjustment) || booleanArg(args.includeStatusAdjustmentPreview) || booleanArg(args.showStatusAdjustments) || ["status-adjustments", "adjustments", "status-preview"].includes(detail);
}

function compactStatusGroup(group = {}, limit = 0) {
  const items = Array.isArray(group.items) ? group.items : [];
  const shownItems = items.slice(0, limit);
  return {
    ...group,
    items: shownItems,
    itemCount: items.length,
    shownCount: shownItems.length,
    hiddenCount: Math.max(0, items.length - shownItems.length),
    defaultCollapsed: Boolean(group.defaultCollapsed || limit === 0)
  };
}

function compactStatusGroupCounts(groups = {}) {
  return Object.fromEntries(Object.keys(STATUS_COMPACT_GROUP_LIMITS).map((name) => {
    const group = groups[name] ?? {};
    const items = Array.isArray(group.items) ? group.items : [];
    return [name, {
      label: group.label ?? name,
      description: group.description ?? null,
      itemCount: group.itemCount ?? items.length,
      defaultCollapsed: true
    }];
  }));
}

function compactStatusMissionList(missionList = {}, options = {}) {
  const groups = missionList.groups ?? {};
  if (options.includeItems !== true) {
    const groupCounts = compactStatusGroupCounts(groups);
    const hiddenCount = Object.values(groupCounts).reduce((total, group) => total + (group.itemCount ?? 0), 0);
    return {
      presentation: missionList.presentation ?? "dove-mission-list",
      detail: "summary",
      summary: missionList.summary ?? {},
      statusModel: missionList.statusModel ?? {},
      defaultCollapsed: true,
      expandWhenAsked: true,
      expanded: false,
      missionItemsIncluded: false,
      groupsOmitted: true,
      groupCounts,
      hiddenItemCount: hiddenCount,
      detailsAvailable: hiddenCount > 0
    };
  }
  const compactGroups = Object.fromEntries(Object.entries(STATUS_COMPACT_GROUP_LIMITS).map(([name, limit]) => [name, compactStatusGroup(groups[name], limit)]));
  const hiddenCount = Object.values(compactGroups).reduce((total, group) => total + (group.hiddenCount ?? 0), 0);
  return {
    ...missionList,
    detail: "compact",
    groups: compactGroups,
    previewLimits: STATUS_COMPACT_GROUP_LIMITS,
    hiddenItemCount: hiddenCount,
    detailsAvailable: hiddenCount > 0,
    expanded: true,
    missionItemsIncluded: true
  };
}

function compactWorkContract(contract) {
  if (!contract) {
    return null;
  }
  return {
    purpose: contract.purpose ?? null,
    deliverables: normalizeStringArray(contract.deliverables).slice(0, 3),
    evidenceContract: normalizeStringArray(contract.evidenceContract).slice(0, 3),
    doneCriteria: normalizeStringArray(contract.doneCriteria).slice(0, 3),
    practicalImpact: contract.practicalImpact ?? null
  };
}

function compactStatusObject(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => {
    if (value === null || value === undefined) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (value && typeof value === "object") {
      return Object.keys(value).length > 0;
    }
    return true;
  }));
}

function publicStatusBoundaryType(value) {
  const type = String(value ?? "").trim();
  if (!type) {
    return null;
  }
  if (["awaiting-audio-review-output"].includes(type)) {
    return "awaiting-review-output";
  }
  if (["missing-secret-env", "provider-failed"].includes(type)) {
    return "awaiting-provider-output";
  }
  if (["awaiting-host-pass", "awaiting-host-results", "needs-host-results", "needs-completion-evidence", "needs-explicit-progress-step"].includes(type)) {
    return "host-tool-blocked";
  }
  if (type.startsWith("audio-review-") || type === "needs-review") {
    return "verification-failed";
  }
  return type;
}

function compactStatusBoundary(boundary) {
  if (!boundary || typeof boundary !== "object" || Array.isArray(boundary)) {
    return null;
  }
  const implementationBoundaryType = String(boundary.type ?? boundary.boundaryType ?? "").trim() || null;
  const type = publicStatusBoundaryType(implementationBoundaryType);
  return compactStatusObject({
    id: boundary.id ?? boundary.boundaryId ?? null,
    type,
    status: boundary.status ?? null,
    packetId: boundary.packetId ?? null,
    summary: boundary.summary ?? null,
    requiredInputs: normalizeStringArray(boundary.requiredInputs),
    requiredActions: normalizeStringArray(boundary.requiredActions),
    command: boundary.command ?? boundary.nextAction ?? null,
    ownerRole: boundary.ownerRole ?? null,
    nextRole: boundary.nextRole ?? null,
    detail: implementationBoundaryType && type && implementationBoundaryType !== type ? { implementationBoundaryType } : null
  });
}

function compactStatusActionCard(card) {
  if (!card || typeof card !== "object") {
    return card;
  }
  const boundary = compactStatusBoundary(card.boundary);
  const boundaryType = publicStatusBoundaryType(card.boundaryType ?? card.boundary?.type);
  return compactStatusObject({
    presentation: card.presentation,
    proposalOnly: card.proposalOnly,
    noAutoApply: card.noAutoApply,
    rank: card.rank,
    priority: card.priority,
    kind: card.kind,
    title: card.title,
    why: card.why,
    packetId: card.packetId,
    affectedParentIds: normalizeStringArray(card.affectedParentIds),
    findingCount: card.findingCount,
    openChecklistChildCount: card.openChecklistChildCount,
    openChecklistChildIds: normalizeStringArray(card.openChecklistChildIds).slice(0, 20),
    command: card.command,
    firstAction: card.firstAction,
    copyableCommand: card.copyableCommand,
    evidenceRequired: normalizeStringArray(card.evidenceRequired).slice(0, 5),
    doneCriteria: normalizeStringArray(card.doneCriteria).slice(0, 5),
    workContract: compactWorkContract(card.workContract),
    executionReadiness: card.executionReadiness ? {
      ready: Boolean(card.executionReadiness.ready),
      status: card.executionReadiness.status ?? null,
      missing: normalizeStringArray(card.executionReadiness.missing).slice(0, 5)
    } : undefined,
    requiredMaterials: normalizeStringArray(card.requiredMaterials).slice(0, 5),
    criteriaCoverage: card.criteriaCoverage ? {
      complete: Boolean(card.criteriaCoverage.complete),
      missing: normalizeStringArray(card.criteriaCoverage.missing).slice(0, 5)
    } : undefined,
    boundaryId: card.boundaryId ?? card.boundary?.id ?? null,
    summary: card.summary ?? card.boundary?.summary ?? null,
    requiredInputs: normalizeStringArray(card.requiredInputs ?? card.boundary?.requiredInputs).slice(0, 5),
    requiredActions: normalizeStringArray(card.requiredActions ?? card.boundary?.requiredActions).slice(0, 5),
    ownerRole: card.ownerRole ?? card.boundary?.ownerRole ?? null,
    nextRole: card.nextRole ?? card.boundary?.nextRole ?? null,
    boundaryType,
    boundary,
    requires: normalizeStringArray(card.requires).slice(0, 5)
  });
}

function compactStatusAdjustmentItem(item) {
  return {
    index: item.index,
    packetId: item.packetId,
    title: item.title,
    currentStatus: item.currentStatus,
    recommendedStatus: item.recommendedStatus,
    level: item.level,
    stage: item.stage,
    domain: item.domain,
    blockedReason: item.blockedReason ?? null,
    lastStopReason: item.lastStopReason ?? null,
    boundaryType: item.currentBoundary?.type ?? item.actionableBoundary?.type ?? null,
    choices: item.choices,
    confirmArgs: item.confirmArgs
  };
}

function compactStatusAdjustmentContract(contract = {}, options = {}) {
  const items = Array.isArray(contract.items) ? contract.items : [];
  if (options.includeItems !== true) {
    return {
      proposalOnly: contract.proposalOnly,
      noAutoApply: contract.noAutoApply,
      writes: Array.isArray(contract.writes) ? contract.writes : [],
      mutationTool: contract.mutationTool,
      statusChoices: contract.statusChoices,
      itemCount: contract.itemCount ?? items.length,
      previewItemCount: 0,
      hiddenItemCount: items.length,
      adjustmentCards: [],
      items: [],
      defaultCollapsed: true,
      expandWhenAsked: true,
      confirmationRequiresExplicitRequest: true,
      statusAdjustmentItemsIncluded: false,
      detailsAvailable: items.length > 0
    };
  }
  const shownItems = items.slice(0, STATUS_ADJUSTMENT_PREVIEW_LIMIT).map(compactStatusAdjustmentItem);
  const adjustmentCards = Array.isArray(contract.adjustmentCards) ? contract.adjustmentCards.slice(0, STATUS_ADJUSTMENT_PREVIEW_LIMIT).map(compactStatusActionCard) : [];
  return {
    proposalOnly: contract.proposalOnly,
    noAutoApply: contract.noAutoApply,
    writes: Array.isArray(contract.writes) ? contract.writes : [],
    mutationTool: contract.mutationTool,
    statusChoices: contract.statusChoices,
    itemCount: contract.itemCount ?? items.length,
    previewItemCount: shownItems.length,
    hiddenItemCount: Math.max(0, items.length - shownItems.length),
    adjustmentCards,
    items: shownItems,
    defaultCollapsed: true,
    expandWhenAsked: true,
    confirmationRequiresExplicitRequest: true,
    statusAdjustmentItemsIncluded: true,
    detailsAvailable: items.length > shownItems.length
  };
}

function compactDiagnostics(diagnostics = {}) {
  return {
    readErrors: Array.isArray(diagnostics.readErrors) ? diagnostics.readErrors : [],
    mayRefreshDerivedSurfaces: diagnostics.mayRefreshDerivedSurfaces ?? false,
    noCommandExecution: diagnostics.noCommandExecution ?? true,
    noExternalProcess: diagnostics.noExternalProcess ?? true,
    noGitInspection: diagnostics.noGitInspection ?? true,
    noSourceMutation: diagnostics.noSourceMutation ?? true,
    omittedSections: ["dashboard", "task tree", "active task objects", "recent completed/killed mission recaps", "runtime event/result details"],
    fullDetails: { detail: "full" }
  };
}

function compactCompletionConsistency(consistency = {}) {
  const findings = Array.isArray(consistency.findings) ? consistency.findings : [];
  return {
    status: consistency.status ?? "consistent",
    findingCount: consistency.findingCount ?? findings.length,
    findings: findings.slice(0, 5).map((finding) => ({
      id: finding.id,
      type: finding.type,
      severity: finding.severity,
      parentId: finding.parentId,
      parentTitle: finding.parentTitle,
      parentDisplayStatus: finding.parentDisplayStatus,
      parentMachineStatus: finding.parentMachineStatus,
      openChecklistChildCount: normalizeStringArray(finding.openChecklistChildIds).length,
      openChecklistChildIds: normalizeStringArray(finding.openChecklistChildIds).slice(0, 20),
      nextAction: finding.nextAction,
      summary: finding.summary
    }))
  };
}

function buildHostFileCheckpointNotice() {
  return {
    required: true,
    detected: false,
    kind: "host-file-checkpoint",
    status: "not-programmatically-verifiable",
    scope: "host-runtime",
    verificationRequired: true,
    projectFilesRequired: true,
    externalWriteCaptureRequired: true,
    externalWriteCaptureVerified: false
  };
}

function buildMutationRollbackModel(root) {
  const indexPath = resolveProjectPath(root, ARTIFACT_PATHS.mutationsIndex);
  let index = createMutationProvenanceIndex();
  if (fs.existsSync(indexPath)) {
    try {
      index = normalizeMutationProvenanceIndex(JSON.parse(fs.readFileSync(indexPath, "utf8")));
    } catch {
      index = createMutationProvenanceIndex();
    }
  }
  const summary = index.summary ?? createMutationProvenanceIndex().summary;
  return {
    patchPlanSupported: true,
    hostTrackedFileEditsRequired: true,
    directProcessWritesAreRollbackSafe: false,
    lastMutationMode: summary.lastMutationMode ?? null,
    lastAppliedBy: summary.lastAppliedBy ?? null,
    hostRollbackEligible: Boolean(summary.hostRollbackEligible),
    hostRollbackIneligibleReason: summary.hostRollbackIneligibleReason ?? null,
    recommendedMutationMode: summary.recommendedMutationMode ?? null,
    rollbackAdvice: summary.rollbackAdvice ?? null,
    hostCheckpointVerified: false,
    externalWriteCaptureVerified: false,
    doveRestoreSupported: false,
    mutationProvenancePath: ARTIFACT_PATHS.mutationsIndex,
    mutationCount: summary.mutationCount ?? 0,
    patchPlanCount: summary.patchPlanCount ?? 0,
    directProcessCount: summary.directProcessCount ?? 0
  };
}

function buildDurableContextNotice(root, responseLanguage = "zh") {
  const hostCheckpoint = buildHostFileCheckpointNotice(root);
  const mutationRollbackModel = buildMutationRollbackModel(root);
  const recoveryActions = [
    { kind: "refresh-status", command: "project:dove.status", mutation: false },
    { kind: "apply-mutation-plan-with-host-tracked-edits", command: "mutationMode: patch-plan", mutation: true, handledByHost: true, hostTrackedFileEditsRequired: true },
    { kind: "use-direct-process-as-unverified", command: "mutationMode: direct-process", mutation: true, hostRollbackEligible: false, hostRollbackIneligibleReason: mutationRollbackModel.hostRollbackIneligibleReason, rollbackAdvice: mutationRollbackModel.rollbackAdvice },
    { kind: "adjust-status", command: "apply_dove_status_adjustments", mutation: true, confirmationRequired: true }
  ];
  return {
    presentation: "dove-durable-context-notice",
    stateSource: "filesystem-durable-state",
    durableRoot: ARTIFACT_PATHS.doveRoot,
    rollbackCoverage: "host-tracked-mutation-plan-required",
    nativeHostRollbackRequiresFileCheckpoint: true,
    hostCheckpointDetected: hostCheckpoint.detected,
    hostCheckpointStatus: hostCheckpoint.status,
    hostCheckpoint,
    mutationRollbackModel,
    projectVisibilityRequired: true,
    projectVisibilityVerified: false,
    externalWriteCaptureRequired: true,
    externalWriteCaptureVerified: false,
    doveRestoreSupported: false,
    doveRestoreCommand: null,
    automaticRollback: false,
    trackedDurablePaths: [ARTIFACT_PATHS.state, ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.mutationsIndex],
    localOnlyIgnoredPaths: [".dove/config.local.json"],
    summary: doveText(responseLanguage, "durableContextNoticeSummary"),
    recovery: doveText(responseLanguage, "durableContextNoticeRecovery"),
    recoveryActions
  };
}

function compactStatusRuntimeContinuation(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  return compactStatusObject({
    currentKind: value.currentKind ?? value.currentContinuationKind ?? null,
    currentPacketId: value.currentPacketId ?? value.currentContinuationPacketId ?? null,
    currentProgramRunId: value.currentProgramRunId ?? value.currentContinuationProgramRunId ?? null,
    currentCommand: value.currentCommand ?? value.currentContinuationCommand ?? null,
    continuationCount: value.continuationCount ?? null
  });
}

function compactStatusBoundaryFromAction(action) {
  if (!action) {
    return null;
  }
  return compactStatusBoundary(action.boundary) ?? compactStatusBoundary({
    id: action.boundaryId,
    boundaryType: action.boundaryType,
    packetId: action.packetId,
    summary: action.summary,
    requiredInputs: action.requiredInputs,
    requiredActions: action.requiredActions,
    command: action.command,
    ownerRole: action.ownerRole,
    nextRole: action.nextRole
  });
}

function compactStatusRequiredEvidence({ primaryStep, boundary, boundaryActionCards, executionGaps }) {
  return mergeStringArrays(
    primaryStep?.evidenceRequired,
    primaryStep?.requiredMaterials,
    primaryStep?.requires,
    primaryStep?.doneCriteria,
    boundary?.requiredInputs,
    boundary?.requiredActions,
    boundaryActionCards.flatMap((card) => mergeStringArrays(card.evidenceRequired, card.requiredMaterials, card.requires)),
    executionGaps.evidenceRequired,
    executionGaps.requiredMaterials
  ).slice(0, 12);
}

function buildCompactStatusHome({ result, missionList, nextActions, boundaryActionCards, statusAdjustmentContract, args }) {
  const summary = result.projectSummary ?? {};
  const current = result.current ?? {};
  const dashboard = result.dashboard ?? {};
  const readErrors = Array.isArray(result.diagnostics?.readErrors) ? result.diagnostics.readErrors : [];
  const blockers = Array.isArray(dashboard.blockers) ? dashboard.blockers : [];
  const runtimeContinuation = compactStatusRuntimeContinuation(dashboard.runtime?.continuation);
  const consistency = result.dailyHome?.completionConsistency ?? {};
  const completionConsistency = {
    status: consistency.status ?? "consistent",
    findingCount: consistency.findingCount ?? (Array.isArray(consistency.findings) ? consistency.findings.length : 0)
  };
  const executionGaps = result.dailyHome?.executionGaps ?? {};
  const executionCounts = {
    missingContract: executionGaps.counts?.missingContract ?? 0,
    missingMaterials: executionGaps.counts?.missingMaterials ?? 0,
    verificationGaps: executionGaps.counts?.verificationGaps ?? 0,
    readyBuilder: executionGaps.counts?.readyBuilder ?? 0,
    blocking: executionGaps.counts?.blocking ?? 0
  };
  const primaryStep = nextActions[0] ?? null;
  const boundary = compactStatusBoundaryFromAction(primaryStep) ?? compactStatusBoundaryFromAction(boundaryActionCards[0]);
  const boundaryType = boundary?.type ?? primaryStep?.boundaryType ?? boundaryActionCards[0]?.boundaryType ?? null;
  const requiredEvidence = compactStatusRequiredEvidence({ primaryStep, boundary, boundaryActionCards, executionGaps });
  const gapStatus = readErrors.length > 0 || blockers.length > 0 || completionConsistency.status === "needs-reconciliation" || executionCounts.blocking > 0 || boundaryActionCards.length > 0 ? "blocked" : "clear";
  const expansions = compactStatusObject({
    fullDetails: { tool: "query_dove_status", args: compactStatusDetailArgs(args) },
    missionDetails: { tool: "query_dove_status", args: compactStatusMissionDetailArgs(args) },
    statusAdjustments: { tool: "query_dove_status", args: compactStatusAdjustmentPreviewArgs(args) }
  });
  return compactStatusObject({
    presentation: "dove-project-situation-home",
    detail: "compact",
    liveContextFirst: true,
    currentContext: compactStatusObject({
      title: summary.title ?? null,
      objective: summary.objective ?? null,
      currentFocus: summary.currentFocus ?? null,
      domain: current.domain ?? null,
      stage: current.stage ?? null,
      primaryRole: current.primaryRole ?? null,
      durableRoot: dashboard.project?.durableRoot ?? ARTIFACT_PATHS.doveRoot,
      stateSource: result.durableContextNotice?.stateSource ?? "filesystem-durable-state",
      runtimeContinuation
    }),
    nextAction: primaryStep,
    nextSteps: compactStatusObject({
      primary: primaryStep,
      ranked: primaryStep ? [primaryStep] : [],
      count: nextActions.length,
      suggestedNextCommand: result.suggestedNextCommand ?? current.nextCommand ?? null
    }),
    boundary,
    gaps: compactStatusObject({
      status: gapStatus,
      boundaryType,
      boundaryCount: boundaryActionCards.length,
      blockerCount: blockers.length,
      readErrorCount: readErrors.length,
      completionConsistency,
      executionGaps: executionCounts,
      requiredMaterials: normalizeStringArray(executionGaps.requiredMaterials).slice(0, 12)
    }),
    requiredEvidence,
    writes: {
      applied: Array.isArray(result.writes) && result.writes.length > 0,
      count: Array.isArray(result.writes) ? result.writes.length : 0
    },
    optionalMissionDetails: missionList.missionItemsIncluded ? missionList : null,
    statusAdjustmentPreview: statusAdjustmentContract.statusAdjustmentItemsIncluded ? statusAdjustmentContract : null,
    detailsAvailable: true,
    expansion: expansions,
    fullDetails: expansions.fullDetails
  });
}

function compactDoveStatusResult(result, args = {}) {
  const includeMissionDetails = wantsMissionDetails(args);
  const includeStatusAdjustmentPreview = wantsStatusAdjustmentPreview(args);
  const missionList = compactStatusMissionList(result.dailyHome?.missionList, { includeItems: includeMissionDetails });
  const nextActions = (Array.isArray(result.dailyHome?.nextActions) ? result.dailyHome.nextActions : []).slice(0, 3).map(compactStatusActionCard);
  const boundaryActionCards = (Array.isArray(result.dailyHome?.boundaryActionCards) ? result.dailyHome.boundaryActionCards : []).slice(0, 5).map(compactStatusActionCard);
  const statusAdjustmentContract = compactStatusAdjustmentContract(result.statusAdjustmentContract, { includeItems: includeStatusAdjustmentPreview });
  const statusHome = buildCompactStatusHome({
    result,
    missionList,
    nextActions,
    boundaryActionCards,
    statusAdjustmentContract,
    args
  });
  return compactStatusObject({
    mode: result.mode,
    query: result.query,
    proposalOnly: result.proposalOnly,
    noAutoApply: result.noAutoApply,
    writes: result.writes,
    writesApplied: Array.isArray(result.writes) && result.writes.length > 0,
    responseLanguage: result.responseLanguage,
    detail: "compact",
    detailsAvailable: true,
    currentContext: statusHome.currentContext,
    nextAction: statusHome.nextAction,
    boundary: statusHome.boundary,
    boundaryType: statusHome.boundary?.type ?? statusHome.gaps?.boundaryType ?? null,
    gaps: statusHome.gaps,
    requiredEvidence: statusHome.requiredEvidence,
    statusHome,
    current: result.current,
    suggestedNextCommand: result.suggestedNextCommand,
    expansion: statusHome.expansion
  });
}

function compactStatusDetailArgs(args = {}) {
  return {
    domain: args.domain ?? args.doveDomain ?? args.missionDomain,
    stage: args.stage ?? args.missionStage,
    packetIds: normalizeStringArray(args.packetId ?? args.packetIds ?? args.missionPacketId ?? args.missionPacketIds),
    statuses: normalizeStringArray(args.status ?? args.statuses),
    includeArchived: booleanArg(args.includeArchived),
    detail: "full"
  };
}

function compactStatusExpansionArgs(args = {}, expansion = {}) {
  return {
    domain: args.domain ?? args.doveDomain ?? args.missionDomain,
    stage: args.stage ?? args.missionStage,
    packetIds: normalizeStringArray(args.packetId ?? args.packetIds ?? args.missionPacketId ?? args.missionPacketIds),
    statuses: normalizeStringArray(args.status ?? args.statuses),
    includeArchived: booleanArg(args.includeArchived),
    ...expansion
  };
}

function compactStatusMissionDetailArgs(args = {}) {
  return compactStatusExpansionArgs(args, { showMissions: true });
}

function compactStatusAdjustmentPreviewArgs(args = {}) {
  return compactStatusExpansionArgs(args, { requestStatusAdjustment: true });
}

function missionUserGroupForStatus(status) {
  if (status === "archived") {
    return "archived";
  }
  if (status === "blocked") {
    return "blocked";
  }
  if (status === "in-progress") {
    return "doing";
  }
  if (status === "completed" || status === "killed") {
    return "done";
  }
  return "todo";
}

function summarizeStatusMissionListItem(task, index) {
  const recommendedStatus = recommendedStatusForTask(task);
  const group = missionUserGroupForStatus(recommendedStatus);
  return {
    index,
    packetId: task.id,
    title: task.title,
    group,
    status: task.status,
    recommendedStatus,
    stage: task.stage,
    domain: task.domain,
    level: task.level,
    blockedReason: task.blockedReason ?? null,
    lastStopReason: task.lastStopReason ?? null,
    boundaryType: task.currentBoundary?.type ?? null,
    evidenceRequired: normalizeStringArray(task.evidenceExpectations),
    artifactRefs: normalizeStringArray(task.artifactRefs)
  };
}

function openChecklistChildForStatusParent(task, parentId) {
  return task.parentId === parentId
    && task.creatorKind === "system"
    && !task.derivedFrom
    && !task.sourcePlanTaskId
    && !isArchivedStatusTask(task)
    && !["completed", "killed"].includes(task.status);
}

function buildCompletionConsistency(tasks = [], responseLanguage = "zh") {
  const byParentId = new Map();
  for (const task of tasks) {
    if (!task.parentId || !openChecklistChildForStatusParent(task, task.parentId)) {
      continue;
    }
    byParentId.set(task.parentId, [...(byParentId.get(task.parentId) ?? []), task]);
  }
  const findings = tasks.filter((task) => task.status === "completed" && byParentId.has(task.id)).map((parent) => {
    const openChildren = sortStatusTasks(byParentId.get(parent.id) ?? []);
    return {
      id: `completion-consistency-${parent.id}`,
      type: "completed-parent-open-checklist",
      severity: "blocking",
      parentId: parent.id,
      parentTitle: parent.title,
      parentDisplayStatus: "done",
      parentMachineStatus: parent.status,
      openChecklistChildIds: openChildren.map((child) => child.id),
      openChecklistChildren: openChildren.map((child) => ({ id: child.id, title: child.title, status: child.status, displayStatus: child.displayStatus ?? child.status })),
      nextAction: "project:dove.status",
      summary: responseLanguage === "en" ? "A done parent mission still has open checklist children." : "done 父 mission 下仍有 open checklist 子项。"
    };
  });
  return {
    status: findings.length > 0 ? "needs-reconciliation" : "consistent",
    findingCount: findings.length,
    findings
  };
}

function buildStatusMissionList(tasks, options = {}) {
  const items = sortStatusTasks(tasks.filter((task) => task.level !== 0)).map((task, index) => summarizeStatusMissionListItem(task, index + 1));
  const groups = {
    todo: { label: "todo", description: "pending or ready missions", defaultCollapsed: false, items: [] },
    doing: { label: "doing", description: "missions with in-progress foreground runtime state", defaultCollapsed: false, items: [] },
    blocked: { label: "blocked", description: "missions blocked by dependency, boundary, or missing evidence", defaultCollapsed: false, items: [] },
    done: { label: "done", description: "completed or killed missions", defaultCollapsed: true, items: [] },
    archived: { label: "archived", description: "archived missions hidden from the default project situation", defaultCollapsed: true, items: [] }
  };
  for (const item of items) {
    groups[item.group].items.push(item);
  }
  return {
    presentation: "dove-mission-list",
    statusModel: {
      userGroups: ["todo", "doing", "blocked", "done", "archived"],
      machineStatuses: DOVE_TASK_STATUSES,
      mapping: {
        todo: ["pending", "ready"],
        doing: ["in-progress"],
        blocked: ["blocked"],
        done: ["completed", "killed"],
        archived: ["archived"]
      }
    },
    summary: {
      totalCount: items.length,
      openCount: groups.todo.items.length + groups.doing.items.length + groups.blocked.items.length,
      todoCount: groups.todo.items.length,
      doingCount: groups.doing.items.length,
      blockedCount: groups.blocked.items.length,
      doneCount: groups.done.items.length,
      archivedCount: groups.archived.items.length,
      archivedHiddenCount: Number(options.archivedHiddenCount ?? 0)
    },
    groups
  };
}

function buildProjectSummary({ title, objective, focus, initTask, tasks, activeTasks, blockedTasks, missionList, review, versions, experiments, blockers, nextCommand, returnStatus, archivedHiddenCount = 0 }) {
  return {
    title,
    objective,
    currentFocus: focus,
    initTaskId: initTask?.id ?? null,
    missionCount: tasks.filter((task) => task.level !== 0).length,
    openMissionCount: missionList?.summary?.openCount ?? activeTasks.length,
    todoMissionCount: missionList?.summary?.todoCount ?? 0,
    doingMissionCount: missionList?.summary?.doingCount ?? 0,
    activeMissionCount: activeTasks.length,
    blockedMissionCount: missionList?.summary?.blockedCount ?? blockedTasks.length,
    archivedMissionCount: missionList?.summary?.archivedCount ?? 0,
    archivedHiddenCount,
    statusCounts: countBy(tasks.map((task) => task.status), DOVE_TASK_STATUSES),
    reviewVerdict: review.verdict,
    unresolvedConcernCount: review.unresolvedConcernCount,
    versionCount: versions.versionCount,
    experimentPlanCount: experiments.planCount,
    blockerCount: blockers.length,
    returnStatus,
    nextCommand
  };
}

function buildStatusTaskTree(tasks) {
  const byId = new Map(tasks.map((task) => [task.id, { ...task, children: [] }]));
  const roots = [];
  for (const task of byId.values()) {
    if (task.parentId && task.parentId !== task.id && byId.has(task.parentId)) {
      byId.get(task.parentId).children.push(task);
    } else {
      roots.push(task);
    }
  }
  const normalizeNode = (node) => ({ ...node, children: sortStatusTasks(node.children).map(normalizeNode) });
  return sortStatusTasks(roots).map(normalizeNode);
}

function summarizeStatusBlocker(blocker, index, responseLanguage = "zh") {
  if (blocker && typeof blocker === "object" && !Array.isArray(blocker)) {
    return {
      id: blocker.id ?? blocker.blockerId ?? `board-blocker-${index + 1}`,
      source: "board",
      summary: blocker.summary ?? blocker.reason ?? blocker.title ?? blocker.id ?? doveText(responseLanguage, "boardBlockerFallback", { index: index + 1 }),
      severity: blocker.severity ?? null,
      taskId: blocker.taskId ?? blocker.packetId ?? null
    };
  }
  return {
    id: `board-blocker-${index + 1}`,
    source: "board",
    summary: String(blocker ?? doveText(responseLanguage, "boardBlockerFallback", { index: index + 1 })),
    severity: null,
    taskId: null
  };
}

function buildStatusBlockers(inputs, blockedTasks, responseLanguage = "zh") {
  const boardBlockers = Array.isArray(inputs.board.blockers) ? inputs.board.blockers.map((blocker, index) => summarizeStatusBlocker(blocker, index, responseLanguage)) : [];
  const taskBlockers = blockedTasks.map((task) => ({
    id: `task-blocker-${task.id}`,
    source: "task",
    summary: task.blockedReason ?? (task.blockedBy.length > 0 ? doveText(responseLanguage, "taskBlockedBySummary", { id: task.id, blockers: task.blockedBy.join(", ") }) : doveText(responseLanguage, "taskMarkedBlockedSummary", { id: task.id })),
    severity: "blocking",
    taskId: task.id,
    blockedBy: task.blockedBy,
    unresolvedDependencyIds: normalizeStringArray(task.unresolvedDependencyIds)
  }));
  return [...boardBlockers, ...taskBlockers];
}

function selectStatusNextCommand({ initTask, activeTasks, blockedTasks, review }) {
  if (!initTask) {
    return "project:dove.init";
  }
  if (blockedTasks.length > 0) {
    return "project:dove.status";
  }
  const nextActiveTask = activeTasks.find((task) => task.nextAction);
  if (nextActiveTask) {
    return nextActiveTask.nextAction;
  }
  if (activeTasks.length > 0) {
    return "project:dove.auto";
  }
  if ((review.unresolvedConcernCount ?? 0) > 0) {
    return "project:dove.review";
  }
  return initTask.nextAction ?? "project:dove.mission";
}

function summarizeStatusReview(inputs) {
  const concerns = Array.isArray(inputs.reviewConcerns.items) ? inputs.reviewConcerns.items : [];
  const openConcerns = concerns.filter((concern) => !["closed", "resolved", "accepted"].includes(String(concern.status ?? "open").trim().toLowerCase()));
  const unresolvedConcernIds = normalizeStringArray(inputs.reviewState.unresolvedConcernIds);
  return {
    verdict: inputs.reviewState.lastVerdict ?? "not-reviewed",
    reviewedAt: inputs.reviewState.lastReviewedAt ?? null,
    reviewRound: inputs.reviewState.reviewRound ?? 0,
    openItemCount: Array.isArray(inputs.reviewState.openItems) ? inputs.reviewState.openItems.length : 0,
    concernCount: concerns.length,
    openConcernCount: openConcerns.length,
    unresolvedConcernCount: unresolvedConcernIds.length || openConcerns.length,
    unresolvedConcernIds,
    reviewerIndependence: inputs.reviewState.reviewerIndependence ?? null
  };
}

function summarizeStatusLessons(inputs) {
  const lessons = Array.isArray(inputs.operatorLessons.lessons) ? inputs.operatorLessons.lessons : [];
  const activeLessons = lessons.filter((lesson) => String(lesson.status ?? "active").trim().toLowerCase() === "active");
  const mustObeyLessons = activeLessons.filter((lesson) => lesson.mustObey !== false);
  const summary = inputs.operatorLessons.summary && typeof inputs.operatorLessons.summary === "object" ? inputs.operatorLessons.summary : {};
  return {
    lessonCount: summary.lessonCount ?? lessons.length,
    activeLessonCount: summary.activeLessonCount ?? activeLessons.length,
    mustObeyLessonCount: mustObeyLessons.length,
    topLessonIds: normalizeStringArray(summary.topLessonIds).slice(0, 10),
    lessonsPath: summary.lessonsPath ?? ARTIFACT_PATHS.metaOperatorLessons
  };
}

function summarizeStatusVersions(inputs) {
  const versions = Array.isArray(inputs.versions.items) ? inputs.versions.items : [];
  const lineage = Array.isArray(inputs.versions.lineage) ? inputs.versions.lineage : [];
  const comparisons = Array.isArray(inputs.comparisons.items) ? inputs.comparisons.items : [];
  return {
    currentVersionId: inputs.versions.currentVersionId ?? null,
    versionCount: versions.length,
    lineageCount: lineage.length,
    comparisonCount: comparisons.length,
    activeComparisonTargets: normalizeStringArray(inputs.comparisons.activeTargets),
    versionsPath: ARTIFACT_PATHS.versionsIndex
  };
}

function summarizeStatusExperiments(inputs) {
  return {
    planCount: Array.isArray(inputs.experimentPlans.items) ? inputs.experimentPlans.items.length : 0,
    resultCount: Array.isArray(inputs.experimentResults.items) ? inputs.experimentResults.items.length : 0,
    auditCount: Array.isArray(inputs.experimentAudits.items) ? inputs.experimentAudits.items.length : 0
  };
}

function normalizeStatusStageArg(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (DOVE_TASK_STAGES.includes(raw)) {
    return raw;
  }
  if (["audit", "return"].includes(raw)) {
    return "audit";
  }
  if (raw === "execution") {
    return "execute";
  }
  if (["goal", "design", "checklist"].includes(raw)) {
    return "plan";
  }
  return null;
}

function inferDomain(args, inputs) {
  const explicit = normalizeDoveDomainId(args.domain ?? args.doveDomain ?? args.missionDomain, null);
  if (explicit) {
    return explicit;
  }
  const activePacket = inputs.packets.find((packet) => !archivedPacketStatus(packet.status) && !archivedPacketStatus(packet.lifecycleStatus));
  return activePacket?.doveDomain ?? normalizeDoveDomainId(inputs.workspaceIndex.dove?.currentDomain, "paper");
}

function inferStage(args, inputs) {
  const explicit = normalizeDoveMissionLifecycleStage(args.stage ?? args.missionStage, null);
  if (explicit) {
    return explicit;
  }
  return normalizeDoveMissionLifecycleStage(inputs.workspaceIndex.dove?.missionLifecycle?.currentStage, missionStageForPhase(inputs.board.currentPhase));
}

function inferGoal(args, inputs, responseLanguage = "zh") {
  const explicit = typeof args.goal === "string" && args.goal.trim() ? args.goal.trim() : null;
  if (explicit) {
    return explicit;
  }
  return inputs.board.currentFocus
    ?? inputs.board.objective
    ?? inputs.state.dove?.thesis
    ?? inputs.state.dove?.objective
    ?? inputs.state.dove?.title
    ?? doveText(responseLanguage, "queryFallbackGoal");
}

function collectTargetArtifacts(args, packets) {
  const explicit = normalizeStringArray(args.targetArtifacts ?? args.artifacts ?? args.artifactPaths);
  if (explicit.length > 0) {
    return explicit;
  }
  return Array.from(new Set(packets.flatMap((packet) => [...packet.outputPaths, ...packet.evidenceLinks]))).slice(0, 12);
}

function buildMissionContract(root, args = {}) {
  const inputs = readDoveInputs(root);
  const responseLanguage = resolveDoveResponseLanguage(root, args, { state: inputs.state });
  const domain = inferDomain(args, inputs);
  const stage = inferStage(args, inputs);
  const domainGuidance = selectDomainGuidance(inputs.workspaceIndex, domain);
  const primaryRole = primaryRoleForStage(stage);
  const targetArtifacts = collectTargetArtifacts(args, inputs.packets);
  const acceptanceChecks = normalizeStringArray(args.acceptanceChecks).length > 0
    ? normalizeStringArray(args.acceptanceChecks)
    : domainGuidance.returnEvidence;
  const nextCommand = args.nextCommand ?? domainGuidance.stageRoutes?.[stage] ?? "project:dove.status";
  return {
    inputs,
    mission: {
      goal: inferGoal(args, inputs, responseLanguage),
      domain,
      stage,
      primaryRole: primaryRole.id,
      nextCommand,
      targetArtifacts,
      acceptanceChecks,
      returnProtocol: doveText(responseLanguage, "returnProtocol", { checks: acceptanceChecks.join(", ") }),
      domainGuidance: {
        label: domainGuidance.label,
        summary: domainGuidance.summary,
        stageRoutes: domainGuidance.stageRoutes,
        returnEvidence: domainGuidance.returnEvidence
      }
    },
    responseLanguage
  };
}

function artifactPathsReadForDove() {
  return [
    ARTIFACT_PATHS.state,
    ARTIFACT_PATHS.orchestrationBoard,
    ARTIFACT_PATHS.workspaceIndex,
    ARTIFACT_PATHS.doveRootManifest,
    ARTIFACT_PATHS.taskPacketsIndex,
    ARTIFACT_PATHS.taskPacketsPacketsDir,
    ARTIFACT_PATHS.runtimeContinuation,
    ARTIFACT_PATHS.runtimeEvents,
    ARTIFACT_PATHS.runtimeResults,
    ARTIFACT_PATHS.reviewState,
    ARTIFACT_PATHS.reviewConcerns,
    ARTIFACT_PATHS.versionsIndex,
    ARTIFACT_PATHS.versionComparisons,
    ARTIFACT_PATHS.experimentPlans,
    ARTIFACT_PATHS.experimentResults,
    ARTIFACT_PATHS.experimentAudits,
    ARTIFACT_PATHS.metaOperatorLessons,
    ARTIFACT_PATHS.checklist
  ];
}

const PAPER_PIPELINE_STAGE_METADATA = {
  init: { commandId: "project:dove.init", artifactPaths: [ARTIFACT_PATHS.state, ARTIFACT_PATHS.project, ARTIFACT_PATHS.researchContract] },
  sources: { commandId: "project:dove.source", artifactPaths: [ARTIFACT_PATHS.sources, ARTIFACT_PATHS.bibliography] },
  notes: { commandId: "project:dove.note", artifactPaths: [ARTIFACT_PATHS.notes] },
  research: { commandId: "project:dove.source", artifactPaths: [ARTIFACT_PATHS.researchBrief, ARTIFACT_PATHS.researchAgenda] },
  plan: { commandId: "project:dove.mission", artifactPaths: [ARTIFACT_PATHS.plan] },
  outline: { commandId: "project:dove.mission", artifactPaths: [ARTIFACT_PATHS.outline] },
  draft: { commandId: "project:dove.draft", artifactPaths: [ARTIFACT_PATHS.draftsDir] },
  experiments: { commandId: "project:dove.experience", artifactPaths: [ARTIFACT_PATHS.experimentPlans, ARTIFACT_PATHS.experimentResults, ARTIFACT_PATHS.experimentAudits] },
  citations: { commandId: "project:dove.source", artifactPaths: [ARTIFACT_PATHS.bibliography, ARTIFACT_PATHS.citationLog] },
  review: { commandId: "project:dove.review", artifactPaths: [ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.reviewConcerns] },
  rebuttal: { commandId: "project:dove.rebuttal", artifactPaths: [ARTIFACT_PATHS.rebuttalIssues, ARTIFACT_PATHS.rebuttalStrategy, ARTIFACT_PATHS.rebuttalResponseDraft] },
  versions: { commandId: "project:dove.version", artifactPaths: [ARTIFACT_PATHS.versionsIndex, ARTIFACT_PATHS.versionComparisons] },
  checklist: { commandId: "project:dove.status", artifactPaths: [ARTIFACT_PATHS.checklist] },
  return: { commandId: "project:dove.status", artifactPaths: [ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.versionsIndex, ARTIFACT_PATHS.checklist] }
};

function inspectPipelineArtifact(root, relativePath) {
  return {
    path: relativePath,
    exists: fs.existsSync(path.join(root, relativePath))
  };
}

function buildPaperPipelineStage(root, stageId, index) {
  const metadata = PAPER_PIPELINE_STAGE_METADATA[stageId];
  const artifacts = metadata.artifactPaths.map((artifactPath) => inspectPipelineArtifact(root, artifactPath));
  const availableArtifacts = artifacts.filter((item) => item.exists).map((item) => item.path);
  const missingArtifacts = artifacts.filter((item) => !item.exists).map((item) => item.path);
  return {
    id: stageId,
    order: index + 1,
    commandId: metadata.commandId,
    keyArtifacts: artifacts,
    availableArtifacts,
    missingArtifacts,
    status: missingArtifacts.length === 0 ? "ready" : availableArtifacts.length > 0 ? "partial" : "missing"
  };
}

function selectPaperPipelineNextCommand(stages) {
  const nextStage = stages.find((stage) => stage.status !== "ready");
  return nextStage?.commandId ?? "project:dove.status";
}

function booleanArg(value) {
  if (value === true) {
    return true;
  }
  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  }
  return false;
}

function normalizeDoveRole(role, fallback = null) {
  const normalized = String(role ?? "").trim();
  return ROLE_IDS.includes(normalized) ? normalized : fallback;
}

function phaseForDoveStage(stage) {
  switch (stage) {
    case "goal":
    case "design":
      return "plan";
    case "checklist":
      return "checklist";
    case "execution":
      return "draft";
    case "audit":
      return "review";
    case "return":
      return "versions";
    default:
      return "plan";
  }
}

function staleLegacyAuthorityArtifacts(root) {
  return [
    ".paper/state.json",
    ".paper/workspace/index.json",
    ".paper/orchestration/board.json",
    ".paper/task-packets/index.json"
  ].filter((relativePath) => fs.existsSync(path.join(root, relativePath)));
}

function buildMissionBoardMission(packet) {
  const missionStage = missionStageForPhase(packet.phase);
  const primaryRole = primaryRoleForStage(missionStage);
  return {
    ...packet,
    ...missionPacketAliases(packet),
    missionStage,
    primaryRole: primaryRole.id,
    archived: archivedPacketStatus(packet.status) || archivedPacketStatus(packet.lifecycleStatus)
  };
}

function matchesMissionBoardFilters(mission, args = {}) {
  const domain = normalizeDoveDomainId(args.domain ?? args.doveDomain ?? args.missionDomain, null);
  if (domain && mission.doveDomain !== domain) {
    return false;
  }
  const stage = normalizeDoveMissionLifecycleStage(args.stage ?? args.missionStage, null);
  if (stage && mission.missionStage !== stage) {
    return false;
  }
  const packetIds = normalizeStringArray(args.packetId ?? args.packetIds ?? args.missionPacketId ?? args.missionPacketIds);
  if (packetIds.length > 0 && !packetIds.includes(mission.id) && !packetIds.includes(mission.packetId) && !packetIds.includes(mission.missionPacketId)) {
    return false;
  }
  const statuses = normalizeStringArray(args.status ?? args.statuses);
  if (statuses.length > 0 && !statuses.includes(mission.lifecycleStatus) && !statuses.includes(mission.status)) {
    return false;
  }
  return booleanArg(args.includeArchived) || !mission.archived;
}

function queueNameForMission(mission) {
  const lifecycleStatus = mission.lifecycleStatus ?? "active";
  if (mission.archived || archivedPacketStatus(mission.status) || archivedPacketStatus(lifecycleStatus)) {
    return "archived";
  }
  if (lifecycleStatus === "review-needed") {
    return "reviewNeeded";
  }
  if (["handoff", "handoff-ready", "returned"].includes(lifecycleStatus)) {
    return "handoff";
  }
  if (["waiting", "ready"].includes(lifecycleStatus)) {
    return lifecycleStatus;
  }
  if (["stale", "blocked", "active"].includes(lifecycleStatus)) {
    return lifecycleStatus;
  }
  if (["done", "completed"].includes(mission.status) || lifecycleStatus === "completed") {
    return "ready";
  }
  return "active";
}

function buildMissionQueues(missions) {
  const queues = {
    ready: [],
    waiting: [],
    reviewNeeded: [],
    handoff: [],
    stale: [],
    active: [],
    blocked: [],
    archived: []
  };
  for (const mission of missions) {
    queues[queueNameForMission(mission)].push(mission);
  }
  return queues;
}

function countBy(values, initialKeys = []) {
  const counts = Object.fromEntries(initialKeys.map((key) => [key, 0]));
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function buildMissionBoardCounts(missions) {
  const kernel = createDoveWorkspaceKernel();
  return {
    missionCount: missions.length,
    activeMissionCount: missions.filter((mission) => !mission.archived).length,
    reviewNeededMissionCount: missions.filter((mission) => mission.lifecycleStatus === "review-needed").length,
    domainCounts: countBy(missions.map((mission) => mission.doveDomain), kernel.domainIds),
    stageCounts: countBy(missions.map((mission) => mission.missionStage), kernel.missionLifecycle.stages),
    lifecycleStatusCounts: countBy(missions.map((mission) => mission.lifecycleStatus ?? "active"))
  };
}

function uncheckedChecklistCount(checklist) {
  if (!checklist) {
    return 0;
  }
  return checklist.split(/\r?\n/).filter((line) => /^\s*- \[ \]/.test(line)).length;
}

function completedChecklistCount(checklist) {
  if (!checklist) {
    return 0;
  }
  return checklist.split(/\r?\n/).filter((line) => /^\s*- \[[xX]\]/.test(line)).length;
}

function classifyReturnStatus({ mission, inputs, paperAudit, engineeringEvidence }) {
  if (inputs.readErrors.length > 0) {
    return "blocked";
  }
  const reviewNeeded = inputs.packets.some((packet) => packet.lifecycleStatus === "review-needed") || ["needs-work", "rejected", "blocked"].includes(inputs.reviewState.lastVerdict);
  if (reviewNeeded) {
    return "needs-review";
  }
  const currentPackets = activePackets(inputs.packets);
  if (mission.domain === "engineering" && engineeringEvidence) {
    if (engineeringEvidence.readiness.hasReviewGap) {
      return "needs-review";
    }
    if (engineeringEvidence.readiness.hasFailedValidationOutput) {
      return "needs-execution";
    }
    if (engineeringEvidence.readiness.hasEvidenceGaps || engineeringEvidence.readiness.pathProblemCount > 0) {
      return "needs-audit";
    }
    if (engineeringEvidence.readiness.hasChecklistGap) {
      return "needs-execution";
    }
  }
  if (uncheckedChecklistCount(inputs.checklist) > 0 || currentPackets.some((packet) => ["active", "waiting", "blocked", "stale"].includes(packet.lifecycleStatus))) {
    return "needs-execution";
  }
  if (paperAudit?.severityCounts?.high > 0 || paperAudit?.severityCounts?.critical > 0) {
    return "needs-audit";
  }
  return "ready";
}

function nextCommandForReturnStatus(status, domain) {
  if (status === "needs-review") {
    return "project:dove.review";
  }
  if (status === "needs-execution") {
    return domain === "paper" ? "project:dove.status" : "project:dove.status";
  }
  if (status === "needs-audit") {
    return domain === "engineering" ? "project:dove.status" : "project:dove.review";
  }
  if (status === "blocked") {
    return "project:dove.mission";
  }
  return "project:dove.version";
}

function routeRequestText(args, mission) {
  return normalizeStringArray([args.request, args.userRequest, args.goal, mission.goal]).join(" ").toLowerCase();
}

function selectRouteCommand(mission, args = {}) {
  const route = mission.domainGuidance.stageRoutes?.[mission.stage] ?? mission.nextCommand;
  const candidates = String(route ?? "project:dove.status").split(/\s+or\s+/).map((item) => item.trim()).filter(Boolean);
  if (candidates.length <= 1) {
    return candidates[0] ?? "project:dove.status";
  }
  const requestText = routeRequestText(args, mission);
  if (booleanArg(args.allowAutonomy)) {
    const autonomy = candidates.find((item) => item.includes(".auto") || item.includes("autonomy"));
    if (autonomy) {
      return autonomy;
    }
  }
  if (/\b(revise|revision|rebuttal|fix|review)\b/.test(requestText)) {
    const revision = candidates.find((item) => /revise|rebuttal|review/.test(item));
    if (revision) {
      return revision;
    }
  }
  return candidates[0];
}

function routeReason(mission, selectedCommand, args = {}, responseLanguage = "zh") {
  if (selectedCommand !== mission.nextCommand && String(mission.nextCommand).includes(" or ")) {
    return doveText(responseLanguage, "routeSelectedReason", { selectedCommand, nextCommand: mission.nextCommand });
  }
  if (booleanArg(args.allowAutonomy) && (selectedCommand.includes(".auto") || selectedCommand.includes("autonomy"))) {
    return doveText(responseLanguage, "routeAutoReason");
  }
  return doveText(responseLanguage, "routeDefaultReason", { stage: mission.stage, domain: mission.domain, selectedCommand });
}

function buildWorkspaceSummary(inputs) {
  const kernel = createDoveWorkspaceKernel();
  const authorityManifest = inputs.doveAuthorityManifest ?? inputs.workspaceIndex.dove?.authorityManifest ?? kernel.authorityManifest;
  return {
    kernelVersion: inputs.workspaceIndex.dove?.kernelVersion ?? kernel.kernelVersion,
    unified: true,
    explicitOnly: true,
    noHiddenRuntime: true,
    identity: inputs.workspaceIndex.dove?.identity ?? kernel.identity,
    authorityManifest,
    durableRoot: ARTIFACT_PATHS.doveRoot,
    authoritativeRoot: authorityManifest?.authoritativeRoot ?? ARTIFACT_PATHS.doveRoot
  };
}

function normalizePaperAuditFinding(finding, mission) {
  return {
    ...finding,
    missionDomain: mission.domain,
    missionStage: mission.stage,
    primaryRole: mission.primaryRole,
    blocking: ["critical", "high"].includes(finding.severity)
  };
}

function auditVerdictFromSeverityCounts(severityCounts = {}) {
  if ((severityCounts.critical ?? 0) > 0 || (severityCounts.high ?? 0) > 0) {
    return "blocking-findings";
  }
  if ((severityCounts.medium ?? 0) > 0 || (severityCounts.low ?? 0) > 0) {
    return "findings";
  }
  return "clear";
}

export function queryPaperPipeline(root, args = {}) {
  const inputs = readDoveInputs(root);
  const responseLanguage = resolveDoveResponseLanguage(root, args, { state: inputs.state });
  const currentStage = inferStage({ ...args, domain: "paper" }, inputs);
  const stageIds = [...PIPELINE_STAGE_ORDER, "return"];
  const stages = stageIds.map((stageId, index) => buildPaperPipelineStage(root, stageId, index));
  const stageCounts = countBy(stages.map((stage) => stage.status), ["ready", "partial", "missing"]);
  return {
    mode: "paper-pipeline-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    responseLanguage,
    current: {
      domain: "paper",
      missionStage: currentStage,
      boardPhase: inputs.board.currentPhase ?? null,
      boardAssignedRole: inputs.board.assignedRole ?? null,
      workspaceCurrentDomain: inputs.workspaceIndex.dove?.currentDomain ?? null,
      workspaceMissionStage: inputs.workspaceIndex.dove?.missionLifecycle?.currentStage ?? null
    },
    stages,
    summary: {
      stageCount: stages.length,
      readyStageCount: stageCounts.ready,
      partialStageCount: stageCounts.partial,
      missingStageCount: stageCounts.missing,
      activePacketCount: activePackets(inputs.packets).filter((packet) => ["paper", "experiment", "review"].includes(packet.doveDomain)).length,
      reviewVerdict: inputs.reviewState.lastVerdict ?? "not-reviewed",
      checklistUncheckedCount: uncheckedChecklistCount(inputs.checklist)
    },
    suggestedNextCommand: selectPaperPipelineNextCommand(stages),
    workspace: buildWorkspaceSummary(inputs),
    diagnostics: {
      readErrors: inputs.readErrors,
      artifactPathsRead: Array.from(new Set([...artifactPathsReadForDove(), ...stages.flatMap((stage) => stage.keyArtifacts.map((item) => item.path))])),
      noRefresh: true,
      noCommandExecution: true,
      noExternalProcess: true,
      noGitInspection: true
    }
  };
}

export function queryDoveStatus(root, args = {}) {
  const inputs = readDoveInputs(root);
  const responseLanguage = resolveDoveResponseLanguage(root, args, { state: inputs.state });
  const includeArchived = booleanArg(args.includeArchived);
  const allTasks = sortStatusTasks(enrichStatusTasks((Array.isArray(inputs.taskCatalog.packets) ? inputs.taskCatalog.packets : []).map((packet) => summarizeDoveStatusTask(packet, responseLanguage)).filter((task) => task.id), inputs));
  const archivedTasks = allTasks.filter(isArchivedStatusTask);
  const tasks = includeArchived ? allTasks : allTasks.filter((task) => !isArchivedStatusTask(task));
  const archivedHiddenCount = includeArchived ? 0 : archivedTasks.length;
  const consistencyTasks = allTasks.filter((task) => !isArchivedStatusTask(task));
  const requestedDomain = normalizeDoveDomainId(args.domain ?? args.doveDomain ?? args.missionDomain, null);
  const requestedStage = normalizeStatusStageArg(args.stage ?? args.missionStage);
  const requestedStatuses = normalizeStringArray(args.status ?? args.statuses);
  const requestedPacketIds = normalizeStringArray(args.packetId ?? args.packetIds ?? args.missionPacketId ?? args.missionPacketIds);
  const visibleTasks = tasks.filter((task) => {
    if (requestedDomain && task.domain !== requestedDomain) {
      return false;
    }
    if (requestedStage && task.stage !== requestedStage) {
      return false;
    }
    if (requestedStatuses.length > 0 && !requestedStatuses.includes(task.status) && !requestedStatuses.includes(String(task.lifecycleStatus ?? ""))) {
      return false;
    }
    if (requestedPacketIds.length > 0 && !requestedPacketIds.includes(task.id) && !requestedPacketIds.includes(task.packetId) && !requestedPacketIds.includes(task.missionPacketId)) {
      return false;
    }
    return true;
  });
  const initTask = tasks.find((task) => task.level === 0 && task.status !== "killed") ?? null;
  const activeStatusIds = new Set(["pending", "ready", "in-progress", "blocked"]);
  const activeTasks = visibleTasks.filter((task) => task.level !== 0 && activeStatusIds.has(task.status));
  const actionableBoundaries = activeTasks.map(summarizeActionableBoundary).filter(Boolean);
  const boundaryActionCards = activeTasks.map((task) => buildBoundaryActionCard(task, responseLanguage)).filter(Boolean);
  const blockedTasks = activeTasks.filter(hasTaskBlockerSignal);
  const completedTasks = sortRecentStatusTasks(visibleTasks.filter((task) => task.status === "completed")).slice(0, 10);
  const killedTasks = sortRecentStatusTasks(visibleTasks.filter((task) => task.status === "killed")).slice(0, 10);
  const completionConsistency = buildCompletionConsistency(consistencyTasks, responseLanguage);
  const executionGaps = buildStatusExecutionGaps(activeTasks);
  const review = summarizeStatusReview(inputs);
  const blockers = buildStatusBlockers(inputs, blockedTasks, responseLanguage);
  const lessons = summarizeStatusLessons(inputs);
  const versions = summarizeStatusVersions(inputs);
  const experiments = summarizeStatusExperiments(inputs);
  const fallbackNextCommand = selectStatusNextCommand({ initTask, activeTasks, blockedTasks, review });
  const currentStage = requestedStage ?? activeTasks[0]?.stage ?? initTask?.stage ?? null;
  const currentDomain = requestedDomain ?? activeTasks[0]?.domain ?? initTask?.domain ?? normalizeDoveDomainId(inputs.workspaceIndex.dove?.currentDomain, null);
  const primaryRole = currentStage === "audit" ? "reviewer" : currentStage === "execute" ? "builder" : "planner";
  const returnStatus = inputs.readErrors.length > 0
    ? "blocked"
    : blockers.length > 0 || completionConsistency.status === "needs-reconciliation" || (executionGaps.counts?.blocking ?? 0) > 0
      ? "blocked"
      : activeTasks.length > 0
        ? "in-progress"
        : review.unresolvedConcernCount > 0
          ? "needs-review"
          : "ready";
  const levelCounts = countBy(tasks.map((task) => String(task.level)), ["0", "1", "2", "3"]);
  const projectTitle = inputs.state.dove?.title ?? initTask?.title ?? doveText(responseLanguage, "projectTitleFallback");
  const projectObjective = inputs.state.dove?.objective ?? inputs.state.dove?.thesis ?? initTask?.summary ?? inputs.board.objective ?? null;
  const projectFocus = activeTasks[0]?.currentFocus ?? (activeTasks.length === 0 ? projectObjective : inputs.state.orchestration?.currentFocus ?? inputs.board.currentFocus ?? projectObjective);
  const dailyHome = buildDailyHome({ initTask, activeTasks, blockedTasks, visibleTasks, review, boundaryActionCards, completionConsistency, executionGaps, archivedHiddenCount, responseLanguage });
  const nextCommand = selectDailyHomeNextCommand(dailyHome, fallbackNextCommand);
  const projectSummary = buildProjectSummary({ title: projectTitle, objective: projectObjective, focus: projectFocus, initTask, tasks, activeTasks, blockedTasks, missionList: dailyHome.missionList, review, versions, experiments, blockers, nextCommand, returnStatus, archivedHiddenCount });
  const statusAdjustmentContract = buildStatusAdjustmentContract(visibleTasks, responseLanguage);
  const durableContextNotice = buildDurableContextNotice(root, responseLanguage);
  const preActionGuidance = buildPreActionGuidance({
    surface: "dove.status",
    responseLanguage,
    request: args.request ?? args.userRequest ?? args.prompt ?? null,
    roleId: primaryRole,
    currentContext: {
      title: projectTitle,
      objective: projectObjective,
      currentFocus: projectFocus,
      domain: currentDomain,
      stage: currentStage,
      primaryRole
    },
    operatorLessons: inputs.operatorLessons,
    nextAction: dailyHome.nextActions?.[0] ?? nextCommand,
    routeHint: nextCommand,
    workflowKind: "status",
    domain: currentDomain,
    stage: currentStage,
    statusSummary: {
      returnStatus,
      activeTaskCount: activeTasks.length,
      blockerCount: blockers.length,
      unresolvedConcernCount: review.unresolvedConcernCount,
      readErrorCount: inputs.readErrors.length,
      statusAdjustmentCount: statusAdjustmentContract.itemCount ?? 0,
      executionGaps
    }
  });
  const fullResult = {
    mode: "dove-status-query",
    query: true,
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    responseLanguage,
    detail: "full",
    projectSummary,
    durableContextNotice,
    preActionGuidance,
    statusAdjustmentContract,
    dailyHome,
    actionableBoundaries,
    boundaryActionCards,
    current: {
      domain: currentDomain,
      stage: currentStage,
      primaryRole,
      nextCommand
    },
    dashboard: {
      projectSummary,
      statusAdjustmentContract,
      dailyHome,
      project: {
        title: projectTitle,
        objective: projectObjective,
        responseLanguage,
        durableRoot: ARTIFACT_PATHS.doveRoot,
        authoritativeRoot: inputs.doveAuthorityManifest.authoritativeRoot ?? ARTIFACT_PATHS.doveRoot,
        durableContextNotice,
        currentFocus: projectFocus,
        nextAction: nextCommand,
        pipeline: {
          currentStage: inputs.state.pipeline?.currentStage ?? inputs.board.currentPhase ?? null,
          lastCompletedStage: inputs.state.pipeline?.lastCompletedStage ?? null,
          resumeCommand: inputs.state.pipeline?.resumeCommand ?? "project:dove.status"
        }
      },
      board: {
        phase: inputs.board.currentPhase ?? null,
        intentType: inputs.board.intentType ?? null,
        assignedRole: inputs.board.assignedRole ?? null,
        continuationStatus: inputs.board.continuationState?.status ?? null,
        reviewRequiredBeforeFinalize: inputs.board.reviewRequiredBeforeFinalize ?? false
      },
      runtime: {
        continuation: {
          ...inputs.runtimeContinuation.summary,
          items: Array.isArray(inputs.runtimeContinuation.items) ? inputs.runtimeContinuation.items : []
        },
        results: inputs.runtimeResults.summary,
        events: inputs.runtimeEvents.summary
      },
      init: initTask,
      tasks: {
        tree: buildStatusTaskTree(visibleTasks),
        active: activeTasks,
        grouped: dailyHome.missionList,
        blocked: blockedTasks,
        actionableBoundaries,
        boundaryActionCards,
        recentCompleted: completedTasks,
        recentKilled: killedTasks,
        activeTaskIds: activeTasks.map((task) => task.id),
        counts: {
          total: tasks.length,
          visible: visibleTasks.length,
          active: activeTasks.length,
          blocked: blockedTasks.length,
          completed: tasks.filter((task) => task.status === "completed").length,
          killed: tasks.filter((task) => task.status === "killed").length,
          archived: tasks.filter((task) => task.status === "archived" || isArchivedStatusTask(task)).length,
          archivedHidden: archivedHiddenCount,
          byStatus: countBy(tasks.map((task) => task.status), DOVE_TASK_STATUSES),
          byDomain: countBy(tasks.map((task) => task.domain), DOVE_TASK_DOMAINS),
          byStage: countBy(tasks.map((task) => task.stage), DOVE_TASK_STAGES),
          byLevel: levelCounts
        },
        index: {
          path: ARTIFACT_PATHS.taskPacketsIndex,
          version: inputs.taskPackets.version ?? null,
          activeInitId: inputs.taskPackets.taskModel?.activeInitId ?? initTask?.id ?? null,
          activeTaskIds: normalizeStringArray(inputs.taskPackets.taskModel?.activeTaskIds).length > 0 ? normalizeStringArray(inputs.taskPackets.taskModel?.activeTaskIds) : activeTasks.map((task) => task.id)
        }
      },
      blockers,
      review,
      lessons,
      versions,
      experiments,
      checklist: {
        path: ARTIFACT_PATHS.checklist,
        uncheckedCount: uncheckedChecklistCount(inputs.checklist),
        completedCount: completedChecklistCount(inputs.checklist)
      },
      returnReadiness: {
        status: returnStatus,
        activeTaskCount: activeTasks.length,
        blockerCount: blockers.length,
        unresolvedConcernCount: review.unresolvedConcernCount,
        readErrorCount: inputs.readErrors.length
      },
      nextAction: nextCommand
    },
    board: {
      domain: currentDomain,
      stage: currentStage,
      primaryRole,
      nextCommand,
      phase: inputs.board.currentPhase ?? null,
      assignedRole: inputs.board.assignedRole ?? null
    },
    suggestedNextCommand: nextCommand,
    diagnostics: {
      readErrors: inputs.readErrors,
      artifactPathsRead: artifactPathsReadForDove(),
      derivedReports: {
        navigationReportPath: ARTIFACT_PATHS.navigationReport,
        wikiPath: ARTIFACT_PATHS.wiki
      },
      primaryStateSources: [ARTIFACT_PATHS.state, ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.taskPacketsPacketsDir, ARTIFACT_PATHS.runtimeContinuation, ARTIFACT_PATHS.runtimeEvents, ARTIFACT_PATHS.runtimeResults, ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.versionsIndex, ARTIFACT_PATHS.metaOperatorLessons],
      durableContextNotice,
      mayRefreshDerivedSurfaces: false,
      noCommandExecution: true,
      noExternalProcess: true,
      noGitInspection: true,
      noSourceMutation: true
    }
  };
  return wantsFullDoveStatus(args) ? fullResult : compactDoveStatusResult(fullResult, args);
}

export function queryDoveOrchestrate(root, args = {}) {
  const { inputs, mission, responseLanguage } = buildMissionContract(root, args);
  const recommendedCommand = selectRouteCommand(mission, args);
  return {
    mode: "dove-orchestrate-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    responseLanguage,
    mission,
    route: {
      recommendedCommand,
      nextCommand: recommendedCommand,
      reason: routeReason(mission, recommendedCommand, args, responseLanguage),
      roleBoundary: {
        primaryRole: mission.primaryRole,
        reviewerIsolationRequired: mission.primaryRole === "reviewer" || mission.stage === "audit"
      },
      domainStageRoutes: mission.domainGuidance.stageRoutes
    },
    workspace: buildWorkspaceSummary(inputs),
    diagnostics: {
      readErrors: inputs.readErrors,
      artifactPathsRead: artifactPathsReadForDove(),
      noRefresh: true,
      noCommandExecution: true,
      noGitInspection: true
    }
  };
}

export function queryDoveAudit(root, args = {}) {
  const { inputs, mission, responseLanguage } = buildMissionContract(root, args);
  const paperAudit = queryPaperAudit(root, { scope: args.scope ?? mission.goal });
  const returnReadiness = queryDoveReturn(root, args);
  return {
    mode: "dove-audit-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    responseLanguage,
    mission,
    audit: {
      verdict: auditVerdictFromSeverityCounts(paperAudit.severityCounts),
      mode: paperAudit.mode,
      scope: args.scope ?? mission.goal,
      severityCounts: paperAudit.severityCounts,
      categoryCounts: paperAudit.categoryCounts,
      findingCount: paperAudit.findings.length,
      suggestedNextCommands: paperAudit.suggestedNextCommands
    },
    findings: paperAudit.findings.map((finding) => normalizePaperAuditFinding(finding, mission)),
    returnReadiness: {
      returnStatus: returnReadiness.returnStatus,
      nextCommand: returnReadiness.nextCommand,
      missingReturnEvidence: returnReadiness.missingReturnEvidence,
      engineeringEvidence: returnReadiness.engineeringEvidence,
      checklist: returnReadiness.checklist,
      review: returnReadiness.review
    },
    workspace: buildWorkspaceSummary(inputs),
    diagnostics: {
      readErrors: [...inputs.readErrors, ...(paperAudit.diagnostics?.readErrors ?? []), ...(returnReadiness.diagnostics?.readErrors ?? [])],
      artifactPathsRead: Array.from(new Set([
        ...artifactPathsReadForDove(),
        ...(paperAudit.artifactPathsRead ?? []),
        ...(returnReadiness.diagnostics?.artifactPathsRead ?? [])
      ])),
      noRefresh: true,
      noCommandExecution: true,
      noGitInspection: true
    }
  };
}

export function queryDoveMissionBoard(root, args = {}) {
  const { inputs, mission, responseLanguage } = buildMissionContract(root, args);
  const boardStage = normalizeDoveMissionLifecycleStage(args.stage ?? args.missionStage, missionStageForPhase(inputs.board.currentPhase));
  const boardRole = primaryRoleForStage(boardStage);
  const allMissions = inputs.packets.map(buildMissionBoardMission);
  const missions = allMissions.filter((item) => matchesMissionBoardFilters(item, args));
  return {
    mode: "dove-mission-board-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    responseLanguage,
    workspace: {
      ...buildWorkspaceSummary(inputs),
      asReadSnapshot: true,
      workspaceIndexUpdatedAt: inputs.workspaceIndex.updatedAt ?? null
    },
    board: {
      goal: mission.goal,
      domain: mission.domain,
      stage: boardStage,
      boardPhase: inputs.board.currentPhase ?? null,
      boardAssignedRole: inputs.board.assignedRole ?? null,
      primaryRole: boardRole.id,
      nextCommand: mission.nextCommand,
      currentFocus: inputs.board.currentFocus ?? inputs.workspaceIndex.currentFocus ?? null,
      objective: inputs.board.objective ?? null,
      intentType: inputs.board.intentType ?? null,
      nextAction: inputs.board.nextAction ?? inputs.workspaceIndex.nextAction ?? null,
      continuationState: inputs.board.continuationState ?? null,
      reviewRequiredBeforeFinalize: Boolean(inputs.board.reviewRequiredBeforeFinalize),
      acceptanceChecks: mission.acceptanceChecks,
      returnProtocol: mission.returnProtocol
    },
    missions,
    queues: buildMissionQueues(missions),
    counts: buildMissionBoardCounts(allMissions),
    filters: {
      domain: normalizeDoveDomainId(args.domain ?? args.doveDomain ?? args.missionDomain, null),
      stage: normalizeDoveMissionLifecycleStage(args.stage ?? args.missionStage, null),
      packetIds: normalizeStringArray(args.packetId ?? args.packetIds ?? args.missionPacketId ?? args.missionPacketIds),
      statuses: normalizeStringArray(args.status ?? args.statuses),
      includeArchived: booleanArg(args.includeArchived)
    },
    diagnostics: {
      readErrors: inputs.readErrors,
      artifactPathsRead: artifactPathsReadForDove(),
      noRefresh: true,
      noCommandExecution: true,
      noGitInspection: true
    }
  };
}

export function queryDoveMission(root, args = {}) {
  const { inputs, mission, responseLanguage } = buildMissionContract(root, args);
  return {
    mode: "dove-mission-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    responseLanguage,
    mission,
    workspace: buildWorkspaceSummary(inputs),
    packets: inputs.packets,
    diagnostics: {
      readErrors: inputs.readErrors,
      artifactPathsRead: artifactPathsReadForDove()
    }
  };
}

export function launchDoveMission(root, args = {}) {
  assertGovernanceMutationRegistered("launch-dove-mission", "guarded");
  const sourceType = String(args.sourceType ?? "").trim();
  const sourceId = String(args.sourceId ?? "").trim();
  if (!sourceType || !sourceId) {
    throw new Error("launchDoveMission requires sourceType and sourceId for an accepted governance source.");
  }
  if (!args.executeBy || !args.reviewAfter) {
    throw new Error("launchDoveMission requires executeBy and reviewAfter so the mission has an explicit execution window.");
  }

  const { mission, responseLanguage } = buildMissionContract(root, args);
  const actorRole = normalizeDoveRole(args.actorRole, "planner");
  const workerRole = normalizeDoveRole(args.workerRole ?? args.doveWorkerRole, null);
  const materialized = materializeGuidancePacket(root, {
    ...args,
    packetId: args.packetId ?? args.missionPacketId,
    sourceType,
    sourceId,
    actorRole,
    workerRole: workerRole ?? undefined,
    domain: mission.domain,
    doveDomain: mission.domain,
    missionDomain: mission.domain,
    stage: mission.stage,
    missionStage: mission.stage,
    goal: mission.goal,
    missionGoal: mission.goal,
    targetArtifacts: mission.targetArtifacts,
    acceptanceChecks: mission.acceptanceChecks,
    returnProtocol: mission.returnProtocol,
    title: args.title ?? mission.goal,
    summary: args.summary ?? `Dove ${mission.domain} mission: ${mission.goal}`,
    phase: args.phase ?? phaseForDoveStage(mission.stage),
    nextAction: args.nextAction ?? mission.nextCommand,
    decisionSummary: args.decisionSummary ?? `Launched Dove ${mission.domain} mission from ${sourceType}:${sourceId}.`
  });
  const missionPacket = missionPacketAliases(materialized.packet ?? {
    id: materialized.packetId,
    packetPath: materialized.packetPath,
    packetContextPath: materialized.packetContextPath
  });
  const board = queryDoveMissionBoard(root, {
    domain: mission.domain,
    packetId: materialized.packetId,
    includeArchived: true
  });
  return {
    mode: "dove-launch-mission",
    status: materialized.status,
    responseLanguage,
    proposalOnly: false,
    noAutoApply: false,
    writes: materialized.artifactPaths,
    mission: {
      ...mission,
      launchedPacketId: materialized.packetId,
      launchedMissionPacketId: missionPacket.missionPacketId
    },
    missionPacket: {
      id: missionPacket.missionPacketId,
      path: missionPacket.missionPacketPath,
      contextPath: missionPacket.missionPacketContextPath,
      storePath: missionPacket.missionPacketStorePath,
      source: missionPacket.source
    },
    materialization: {
      packetId: materialized.packetId,
      packetPath: materialized.packetPath,
      packetContextPath: materialized.packetContextPath,
      missionPacketId: missionPacket.missionPacketId,
      missionPacketPath: missionPacket.missionPacketPath,
      missionPacketContextPath: missionPacket.missionPacketContextPath,
      missionPacketStorePath: missionPacket.missionPacketStorePath,
      sourceType: materialized.sourceType,
      sourceId: materialized.sourceId,
      followThroughId: materialized.followThroughId,
      delegatedCoreFunction: "materializeGuidancePacket",
      delegatedMcpTool: "materialize_guidance_packet"
    },
    packet: materialized.packet ? { ...materialized.packet, ...missionPacket } : null,
    board: {
      mode: board.mode,
      missionIds: board.missions.map((item) => item.id),
      missionPacketIds: board.missions.map((item) => item.missionPacketId ?? item.id),
      queues: board.queues,
      counts: board.counts
    },
    workspace: board.workspace,
    governance: {
      registeredMutation: "launch-dove-mission",
      delegatedGuardedMutation: "materialize-guidance-packet",
      actorRole,
      workerRole,
      roleBoundary: {
        primaryRole: mission.primaryRole,
        actorRole,
        workerRole
      },
      explicitExecutionWindow: {
        executeBy: args.executeBy,
        reviewAfter: args.reviewAfter
      },
      currentWriteAuthority: ARTIFACT_PATHS.doveRoot,
      noHiddenRuntime: true,
      noAutonomyExecution: true
    },
    diagnostics: {
      staleLegacyAuthorityArtifacts: staleLegacyAuthorityArtifacts(root),
      noAutonomyExecution: true,
      noGitInspection: true,
      delegatedWrites: materialized.artifactPaths
    }
  };
}

export function queryDoveReturn(root, args = {}) {
  const { inputs, mission, responseLanguage } = buildMissionContract(root, args);
  const validationEvidencePaths = mergeStringArrays(args.validationEvidencePaths, args.validationEvidence, args.evidencePaths);
  const paperAudit = ["paper", "experiment", "review"].includes(mission.domain) ? queryPaperAudit(root, { scope: args.scope ?? mission.goal }) : null;
  const completedChecks = completedChecklistCount(inputs.checklist);
  const uncheckedChecks = uncheckedChecklistCount(inputs.checklist);
  const engineeringEvidence = mission.domain === "engineering"
    ? buildEngineeringEvidence(root, args, inputs, mission, completedChecks, uncheckedChecks)
    : null;
  const status = classifyReturnStatus({ mission, inputs, paperAudit, engineeringEvidence });
  const evidenceRead = Array.from(new Set([
    ...mission.targetArtifacts,
    ...(engineeringEvidence ? engineeringEvidence.evidenceReadPaths : validationEvidencePaths),
    ARTIFACT_PATHS.workspaceIndex,
    ARTIFACT_PATHS.taskPacketsIndex,
    ARTIFACT_PATHS.reviewState,
    ARTIFACT_PATHS.checklist,
    ARTIFACT_PATHS.versionsIndex,
    ARTIFACT_PATHS.versionComparisons
  ])).filter(Boolean);
  const acceptanceMissing = mission.acceptanceChecks.filter((check) => {
    const normalized = check.toLowerCase();
    if (mission.domain === "engineering") {
      if (normalized.includes("changed")) {
        return !engineeringEvidence.changedFiles.satisfied;
      }
      if (normalized.includes("test") || normalized.includes("validation") || normalized.includes("output")) {
        return !engineeringEvidence.validationEvidence.satisfied || engineeringEvidence.validationOutput.status !== "passed";
      }
    } else if (normalized.includes("test") || normalized.includes("validation")) {
      return validationEvidencePaths.length === 0 && !inputs.packets.some((packet) => packet.evidenceLinks.length > 0);
    }
    if (normalized.includes("checklist")) {
      return !inputs.checklist || uncheckedChecks > 0;
    }
    if (normalized.includes("review")) {
      return inputs.reviewState.lastVerdict === "not-reviewed";
    }
    return false;
  });
  const missingReturnEvidence = Array.from(new Set([
    ...acceptanceMissing,
    ...(engineeringEvidence ? engineeringEvidence.missingEvidence.map((item) => item.requirement) : [])
  ]));
  return {
    mode: "dove-return-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    responseLanguage,
    returnStatus: status,
    acceptanceVerdict: status === "ready" ? doveText(responseLanguage, "returnReadyVerdict") : doveText(responseLanguage, "returnNotReadyVerdict"),
    nextCommand: nextCommandForReturnStatus(status, mission.domain),
    mission,
    evidenceRead,
    missingReturnEvidence,
    lessonRitual: {
      command: "project:dove.lessons",
      optional: true,
      when: doveText(responseLanguage, "lessonRitualWhen"),
      requiredFields: ["title", "problem", "decisions", "pitfalls", "validation", "nextTime"],
      noAutoCapture: true,
      noAutoApply: true,
      noExecution: true
    },
    workspace: buildWorkspaceSummary(inputs),
    checklist: {
      completedCount: completedChecks,
      uncheckedCount: uncheckedChecks,
      path: ARTIFACT_PATHS.checklist
    },
    review: {
      lastVerdict: inputs.reviewState.lastVerdict ?? "not-reviewed",
      unresolvedConcernIds: normalizeStringArray(inputs.reviewState.unresolvedConcernIds),
      openItems: normalizeStringArray(inputs.reviewState.openItems)
    },
    packets: inputs.packets,
    engineeringEvidence,
    audit: paperAudit ? {
      mode: paperAudit.mode,
      severityCounts: paperAudit.severityCounts,
      findingCount: paperAudit.findings.length,
      suggestedNextCommands: paperAudit.suggestedNextCommands
    } : null,
    diagnostics: {
      readErrors: inputs.readErrors,
      artifactPathsRead: evidenceRead,
      declaredInputsOnly: mission.domain === "engineering",
      noCommandExecution: mission.domain === "engineering",
      noGitInspection: mission.domain === "engineering"
    }
  };
}
