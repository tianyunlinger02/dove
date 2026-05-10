import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  DOVE_PRIMARY_ROLES,
  PIPELINE_STAGE_ORDER,
  ROLE_IDS,
  createDefaultBoard,
  createDefaultState,
  createDoveAuthorityManifest,
  createDoveWorkspaceKernel,
  createReviewState,
  createTaskPacketsIndex,
  createVersionComparisonsIndex,
  createVersionsIndex,
  createWorkspaceIndex,
  normalizeDoveDomainId,
  normalizeDoveMissionLifecycleStage,
  normalizeDoveAuthorityManifest,
  normalizeState,
  normalizeWorkspaceIndex
} from "./schema.mjs";
import {
  materializeGuidancePacket,
  queryDecisions,
  queryLineage,
  queryOpenQuestions,
  queryTaskGraph
} from "./navigation.mjs";
import { queryPaperAudit } from "./paper-audit.mjs";
import { assertGovernanceMutationRegistered } from "./workspace.mjs";

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
const ARCHIVED_PACKET_STATUSES = new Set(["archived", "archived-with-lineage"]);

function normalizeStringArray(value) {
  const values = Array.isArray(value) ? value : (typeof value === "string" ? [value] : []);
  return Array.from(new Set(values.map((item) => String(item).trim()).filter(Boolean)));
}

function mergeStringArrays(...values) {
  return Array.from(new Set(values.flatMap((value) => normalizeStringArray(value))));
}

function activePackets(packets = []) {
  return packets.filter((packet) => !ARCHIVED_PACKET_STATUSES.has(packet.lifecycleStatus));
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

function readDoveInputs(root) {
  const readErrors = [];
  const state = normalizeState(objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.state, createDefaultState, readErrors), createDefaultState));
  const board = objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.orchestrationBoard, () => createDefaultBoard(state), readErrors), () => createDefaultBoard(state));
  const workspaceIndex = normalizeWorkspaceIndex(objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.workspaceIndex, createWorkspaceIndex, readErrors), createWorkspaceIndex));
  const doveAuthorityManifest = normalizeDoveAuthorityManifest(objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.doveRootManifest, createDoveAuthorityManifest, readErrors), createDoveAuthorityManifest));
  const taskPackets = objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.taskPacketsIndex, createTaskPacketsIndex, readErrors), createTaskPacketsIndex);
  const reviewState = objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.reviewState, createReviewState, readErrors), createReviewState);
  const versions = objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.versionsIndex, createVersionsIndex, readErrors), createVersionsIndex);
  const comparisons = objectOrFallback(safeReadJson(root, ARTIFACT_PATHS.versionComparisons, createVersionComparisonsIndex, readErrors), createVersionComparisonsIndex);
  const checklist = safeReadText(root, ARTIFACT_PATHS.checklist, readErrors);
  const packets = Array.isArray(taskPackets.items) ? taskPackets.items.map(summarizePacket) : [];
  return { state, board, workspaceIndex, doveAuthorityManifest, taskPackets, packets, reviewState, versions, comparisons, checklist, readErrors };
}

function inferDomain(args, inputs) {
  const explicit = normalizeDoveDomainId(args.domain ?? args.doveDomain ?? args.missionDomain, null);
  if (explicit) {
    return explicit;
  }
  const activePacket = inputs.packets.find((packet) => packet.lifecycleStatus !== "archived" && packet.lifecycleStatus !== "archived-with-lineage");
  return activePacket?.doveDomain ?? normalizeDoveDomainId(inputs.workspaceIndex.dove?.currentDomain, "paper");
}

function inferStage(args, inputs) {
  const explicit = normalizeDoveMissionLifecycleStage(args.stage ?? args.missionStage, null);
  if (explicit) {
    return explicit;
  }
  return normalizeDoveMissionLifecycleStage(inputs.workspaceIndex.dove?.missionLifecycle?.currentStage, missionStageForPhase(inputs.board.currentPhase));
}

function inferGoal(args, inputs) {
  const explicit = typeof args.goal === "string" && args.goal.trim() ? args.goal.trim() : null;
  if (explicit) {
    return explicit;
  }
  return inputs.board.currentFocus
    ?? inputs.board.objective
    ?? inputs.state.dove?.thesis
    ?? inputs.state.dove?.objective
    ?? inputs.state.dove?.title
    ?? "Frame one bounded Dove mission from the current workspace.";
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
  const domain = inferDomain(args, inputs);
  const stage = inferStage(args, inputs);
  const domainGuidance = selectDomainGuidance(inputs.workspaceIndex, domain);
  const primaryRole = primaryRoleForStage(stage);
  const targetArtifacts = collectTargetArtifacts(args, inputs.packets);
  const acceptanceChecks = normalizeStringArray(args.acceptanceChecks).length > 0
    ? normalizeStringArray(args.acceptanceChecks)
    : domainGuidance.returnEvidence;
  const nextCommand = args.nextCommand ?? domainGuidance.stageRoutes?.[stage] ?? "project:dove.orchestrate";
  return {
    inputs,
    mission: {
      goal: inferGoal(args, inputs),
      domain,
      stage,
      primaryRole: primaryRole.id,
      nextCommand,
      targetArtifacts,
      acceptanceChecks,
      returnProtocol: `Return with ${acceptanceChecks.join(", ")}.`,
      domainGuidance: {
        label: domainGuidance.label,
        summary: domainGuidance.summary,
        stageRoutes: domainGuidance.stageRoutes,
        returnEvidence: domainGuidance.returnEvidence
      }
    }
  };
}

function artifactPathsReadForDove() {
  return [
    ARTIFACT_PATHS.state,
    ARTIFACT_PATHS.orchestrationBoard,
    ARTIFACT_PATHS.workspaceIndex,
    ARTIFACT_PATHS.doveRootManifest,
    ARTIFACT_PATHS.taskPacketsIndex,
    ARTIFACT_PATHS.reviewState,
    ARTIFACT_PATHS.versionsIndex,
    ARTIFACT_PATHS.versionComparisons,
    ARTIFACT_PATHS.checklist
  ];
}

const PAPER_PIPELINE_STAGE_METADATA = {
  init: { commandId: "project:dove.paper.init", artifactPaths: [ARTIFACT_PATHS.state, ARTIFACT_PATHS.project, ARTIFACT_PATHS.researchContract] },
  sources: { commandId: "project:dove.paper.source", artifactPaths: [ARTIFACT_PATHS.sources, ARTIFACT_PATHS.bibliography] },
  notes: { commandId: "project:dove.paper.note", artifactPaths: [ARTIFACT_PATHS.notes] },
  research: { commandId: "project:dove.paper.research", artifactPaths: [ARTIFACT_PATHS.researchBrief, ARTIFACT_PATHS.researchAgenda] },
  plan: { commandId: "project:dove.plan", artifactPaths: [ARTIFACT_PATHS.plan] },
  outline: { commandId: "project:dove.paper.outline", artifactPaths: [ARTIFACT_PATHS.outline] },
  draft: { commandId: "project:dove.paper.draft", artifactPaths: [ARTIFACT_PATHS.draftsDir] },
  experiments: { commandId: "project:dove.paper.experiment", artifactPaths: [ARTIFACT_PATHS.experimentPlans, ARTIFACT_PATHS.experimentResults, ARTIFACT_PATHS.experimentAudits] },
  citations: { commandId: "project:dove.paper.citations", artifactPaths: [ARTIFACT_PATHS.bibliography, ARTIFACT_PATHS.citationLog] },
  review: { commandId: "project:dove.paper.review", artifactPaths: [ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.reviewConcerns] },
  rebuttal: { commandId: "project:dove.paper.rebuttal", artifactPaths: [ARTIFACT_PATHS.rebuttalIssues, ARTIFACT_PATHS.rebuttalStrategy, ARTIFACT_PATHS.rebuttalResponseDraft] },
  versions: { commandId: "project:dove.paper.version", artifactPaths: [ARTIFACT_PATHS.versionsIndex, ARTIFACT_PATHS.versionComparisons] },
  checklist: { commandId: "project:dove.checklist", artifactPaths: [ARTIFACT_PATHS.checklist] },
  return: { commandId: "project:dove.return", artifactPaths: [ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.versionsIndex, ARTIFACT_PATHS.checklist] }
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
  return nextStage?.commandId ?? "project:dove.return";
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
    archived: ARCHIVED_PACKET_STATUSES.has(packet.lifecycleStatus)
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
  if (ARCHIVED_PACKET_STATUSES.has(lifecycleStatus)) {
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
    return "project:dove.paper.review";
  }
  if (status === "needs-execution") {
    return domain === "paper" ? "project:dove.checklist" : "project:dove.checklist";
  }
  if (status === "needs-audit") {
    return domain === "engineering" ? "project:dove.return" : "project:dove.paper.audit";
  }
  if (status === "blocked") {
    return "project:dove.mission";
  }
  return "project:dove.paper.version";
}

function routeRequestText(args, mission) {
  return normalizeStringArray([args.request, args.userRequest, args.goal, mission.goal]).join(" ").toLowerCase();
}

function selectRouteCommand(mission, args = {}) {
  const route = mission.domainGuidance.stageRoutes?.[mission.stage] ?? mission.nextCommand;
  const candidates = String(route ?? "project:dove.orchestrate").split(/\s+or\s+/).map((item) => item.trim()).filter(Boolean);
  if (candidates.length <= 1) {
    return candidates[0] ?? "project:dove.orchestrate";
  }
  const requestText = routeRequestText(args, mission);
  if (booleanArg(args.allowAutonomy)) {
    const autonomy = candidates.find((item) => item.includes("autonomy"));
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

function routeReason(mission, selectedCommand, args = {}) {
  if (selectedCommand !== mission.nextCommand && String(mission.nextCommand).includes(" or ")) {
    return `Selected ${selectedCommand} from domain route ${mission.nextCommand} for a deterministic no-write Dove routing result.`;
  }
  if (booleanArg(args.allowAutonomy) && selectedCommand.includes("autonomy")) {
    return "Autonomy was explicitly allowed for this Dove routing query.";
  }
  return `Mission stage ${mission.stage} in domain ${mission.domain} maps to ${selectedCommand}.`;
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
  const currentStage = inferStage({ ...args, domain: "paper" }, inputs);
  const stageIds = [...PIPELINE_STAGE_ORDER, "return"];
  const stages = stageIds.map((stageId, index) => buildPaperPipelineStage(root, stageId, index));
  const stageCounts = countBy(stages.map((stage) => stage.status), ["ready", "partial", "missing"]);
  return {
    mode: "paper-pipeline-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
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
  const missionBoard = queryDoveMissionBoard(root, args);
  const taskGraph = queryTaskGraph(root);
  const paperLifecycle = queryPaperPipeline(root, args);
  const openQuestions = queryOpenQuestions(root);
  const decisions = queryDecisions(root);
  const lineage = queryLineage(root);
  const readErrors = [
    ...(missionBoard.diagnostics?.readErrors ?? []),
    ...(paperLifecycle.diagnostics?.readErrors ?? [])
  ];
  return {
    mode: "dove-status-query",
    query: true,
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    current: {
      domain: missionBoard.board?.domain ?? paperLifecycle.current?.domain ?? null,
      stage: missionBoard.board?.stage ?? paperLifecycle.current?.missionStage ?? null,
      primaryRole: missionBoard.board?.primaryRole ?? null,
      nextCommand: missionBoard.board?.nextCommand ?? paperLifecycle.suggestedNextCommand ?? "project:dove.orchestrate"
    },
    board: missionBoard.board,
    queues: missionBoard.queues,
    counts: missionBoard.counts,
    taskGraph,
    paperLifecycle,
    openQuestions,
    decisions,
    lineage,
    navigation: {
      reportPath: ARTIFACT_PATHS.navigationReport,
      wikiPath: ARTIFACT_PATHS.wiki
    },
    suggestedNextCommand: missionBoard.board?.nextCommand ?? paperLifecycle.suggestedNextCommand ?? "project:dove.orchestrate",
    diagnostics: {
      readErrors,
      artifactPathsRead: Array.from(new Set([
        ...artifactPathsReadForDove(),
        ...(paperLifecycle.diagnostics?.artifactPathsRead ?? []),
        ARTIFACT_PATHS.navigationReport,
        ARTIFACT_PATHS.wiki
      ])),
      mayRefreshDerivedSurfaces: true,
      noCommandExecution: true,
      noExternalProcess: true,
      noGitInspection: true,
      noSourceMutation: true
    }
  };
}

export function queryDoveOrchestrate(root, args = {}) {
  const { inputs, mission } = buildMissionContract(root, args);
  const recommendedCommand = selectRouteCommand(mission, args);
  return {
    mode: "dove-orchestrate-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    mission,
    route: {
      recommendedCommand,
      nextCommand: recommendedCommand,
      reason: routeReason(mission, recommendedCommand, args),
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
  const { inputs, mission } = buildMissionContract(root, args);
  const paperAudit = queryPaperAudit(root, { scope: args.scope ?? mission.goal });
  const returnReadiness = queryDoveReturn(root, args);
  return {
    mode: "dove-audit-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
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
  const { inputs, mission } = buildMissionContract(root, args);
  const boardStage = normalizeDoveMissionLifecycleStage(args.stage ?? args.missionStage, missionStageForPhase(inputs.board.currentPhase));
  const boardRole = primaryRoleForStage(boardStage);
  const allMissions = inputs.packets.map(buildMissionBoardMission);
  const missions = allMissions.filter((item) => matchesMissionBoardFilters(item, args));
  return {
    mode: "dove-mission-board-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
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
  const { inputs, mission } = buildMissionContract(root, args);
  return {
    mode: "dove-mission-query",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
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

  const { mission } = buildMissionContract(root, args);
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
  const { inputs, mission } = buildMissionContract(root, args);
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
    returnStatus: status,
    acceptanceVerdict: status === "ready" ? "Return is ready from the current durable evidence." : "Return is not ready; follow the next Dove command before closure.",
    nextCommand: nextCommandForReturnStatus(status, mission.domain),
    mission,
    evidenceRead,
    missingReturnEvidence,
    lessonRitual: {
      command: "project:dove.lessons",
      optional: true,
      when: "after return is ready and reusable experience is worth preserving",
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
