import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  PAPER_LIFECYCLE_TAXONOMY_VERSION,
  PAPER_MAJOR_CHANGE_PROTOCOL_STAGES,
  createDefaultState,
  createReviewConcernsIndex,
  createReviewState,
  createVersionComparisonsIndex,
  createWorkspaceIndex,
  normalizeState,
  normalizeWorkspaceIndex
} from "./schema.mjs";
import { extractCitationKeysFromText, listDraftFiles, readText, resolvePath } from "./workspace.mjs";

function cloneFallback(fallback) {
  return typeof fallback === "function" ? fallback() : structuredClone(fallback);
}

function safeReadJson(root, relativePath, fallback, readErrors) {
  const fullPath = resolvePath(root, relativePath);
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

function safeLoadState(root, readErrors) {
  return normalizeState(safeReadJson(root, ARTIFACT_PATHS.state, createDefaultState, readErrors));
}

function safeListDraftFiles(root) {
  const draftsDir = resolvePath(root, ARTIFACT_PATHS.draftsDir);
  if (!fs.existsSync(draftsDir)) {
    return [];
  }
  return fs.readdirSync(draftsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => entry.name);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function normalizeFigureArtifactPath(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isSafeProjectRelativePath(relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) {
    return false;
  }
  const normalized = path.normalize(relativePath);
  return normalized !== "." && !normalized.startsWith("..") && !normalized.includes(`${path.sep}..${path.sep}`);
}

function figurePathLooksPortable(relativePath) {
  if (!relativePath) {
    return true;
  }
  return isSafeProjectRelativePath(relativePath) && !relativePath.startsWith(".dove/") && !relativePath.includes("node_modules/");
}

function figureIssueId(figureId, code) {
  return `figure-${figureId}-${code}`.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
}

function responseOwnerForFigureIssue(issue) {
  if (issue.stage === "brief") {
    return "builder";
  }
  if (issue.stage === "editable" || issue.stage === "final-contract") {
    return "builder";
  }
  return "planner";
}

function buildFigureIssue({ figure, code, severity, stage, summary, artifactPaths, timestamp, claimIds, experimentIds, reviewConcernIds, rebuttalIssueIds }) {
  return {
    id: figureIssueId(figure.id, code),
    figureId: figure.id,
    severity,
    code,
    stage,
    summary,
    claimIds: claimIds ?? figure.targetClaimIds,
    experimentIds: experimentIds ?? figure.relatedExperimentIds,
    reviewConcernIds: reviewConcernIds ?? figure.reviewConcernIds,
    rebuttalIssueIds: rebuttalIssueIds ?? figure.rebuttalIssueIds,
    artifactPaths,
    updatedAt: timestamp
  };
}

function safeEvaluateEvidence(root, readErrors) {
  const evidence = safeReadJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null }, readErrors);
  const sources = safeReadJson(root, ARTIFACT_PATHS.sources, { version: 1, items: [], updatedAt: null }, readErrors);
  const notes = safeReadJson(root, ARTIFACT_PATHS.notes, { version: 1, items: [], updatedAt: null }, readErrors);
  const experimentResults = safeReadJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null }, readErrors);
  const audits = safeReadJson(root, ARTIFACT_PATHS.experimentAudits, { version: 1, items: [], updatedAt: null }, readErrors);
  const bridgeLog = safeReadJson(root, ARTIFACT_PATHS.claimBridgeLog, { version: 1, items: [], updatedAt: null }, readErrors);
  const sourceById = new Map((sources.items ?? []).flatMap((item) => [[item.id, item], item.citationKey ? [item.citationKey, item] : null].filter(Boolean)));
  const noteIds = new Set((notes.items ?? []).map((item) => item.id));
  const auditsById = new Map((audits.items ?? []).map((item) => [item.id, item]));
  const resultsById = new Map((experimentResults.items ?? []).map((item) => [item.id, item]));
  const unsupportedClaims = [];
  const weakClaims = [];
  const missingSourceRefs = [];
  const missingNoteRefs = [];
  const draftClaimMismatches = [];
  const claimBridgeProblems = [];
  const auditIntegrityFlags = [];

  for (const claim of evidence.claims ?? []) {
    if (!Array.isArray(claim.sourceIds) || claim.sourceIds.length === 0) {
      unsupportedClaims.push(claim);
      continue;
    }
    const unknownSources = claim.sourceIds.filter((id) => !sourceById.has(id));
    if (unknownSources.length > 0) {
      missingSourceRefs.push({ claim, missing: unknownSources });
      unsupportedClaims.push(claim);
      continue;
    }
    const unknownNotes = (Array.isArray(claim.noteIds) ? claim.noteIds : []).filter((id) => !noteIds.has(id));
    if (unknownNotes.length > 0) {
      missingNoteRefs.push({ claim, missing: unknownNotes });
    }
    if (claim.sourceIds.length === 1 || claim.status === "weak" || claim.confidence === "low") {
      weakClaims.push(claim);
    }

    const latestBridge = claim.latestBridgeId ? (bridgeLog.items ?? []).find((item) => item.id === claim.latestBridgeId) : null;
    if ((claim.experimentIds ?? []).length > 0 && !latestBridge) {
      claimBridgeProblems.push({ claim, reason: "missing-bridge-event" });
    }
    if (latestBridge && latestBridge.statusAfter !== claim.status) {
      claimBridgeProblems.push({ claim, reason: "stale-bridge-state", bridgeId: latestBridge.id });
    }
    if (latestBridge && (!Array.isArray(latestBridge.auditIds) || latestBridge.auditIds.length === 0)) {
      claimBridgeProblems.push({ claim, reason: "missing-audit-link", bridgeId: latestBridge.id });
    }
    if (latestBridge) {
      const unknownAuditIds = (latestBridge.auditIds ?? []).filter((id) => !auditsById.has(id));
      if (unknownAuditIds.length > 0) {
        claimBridgeProblems.push({ claim, reason: "unknown-audit-link", bridgeId: latestBridge.id, auditIds: unknownAuditIds });
      }
      if (latestBridge.bridgeStatus === "held-for-review" || latestBridge.auditVerdict === "blocked") {
        claimBridgeProblems.push({ claim, reason: "bridge-held-for-review", bridgeId: latestBridge.id, auditIds: latestBridge.auditIds ?? [] });
      }
    }

    const draftPath = `${ARTIFACT_PATHS.draftsDir}/${claim.sectionId}.md`;
    const draftContent = readText(root, draftPath, "");
    if (!draftContent) {
      draftClaimMismatches.push({ claim, reason: "missing-draft" });
      continue;
    }
    const citedKeys = new Set(extractCitationKeysFromText(draftContent));
    const expectedKeys = claim.sourceIds.flatMap((id) => {
      const source = sourceById.get(id);
      return source ? [source.id, source.citationKey].filter(Boolean) : [];
    });
    if (expectedKeys.length > 0 && !expectedKeys.some((key) => citedKeys.has(key))) {
      draftClaimMismatches.push({ claim, reason: "draft-missing-claim-citation", expectedKeys });
    }
  }

  for (const audit of audits.items ?? []) {
    const result = audit.resultId ? resultsById.get(audit.resultId) : null;
    if ((audit.integrityFlags ?? []).length > 0 || audit.auditVerdict === "blocked") {
      auditIntegrityFlags.push(audit);
    }
    if ((audit.reviewedArtifactRefs ?? []).length === 0) {
      auditIntegrityFlags.push({ ...audit, integrityFlags: [...(audit.integrityFlags ?? []), "missing-reviewed-artifact-refs"] });
    }
    if (result?.latestAuditId && result.latestAuditId !== audit.id && result.id === audit.resultId) {
      auditIntegrityFlags.push({ ...audit, integrityFlags: [...(audit.integrityFlags ?? []), "stale-result-audit-pointer"] });
    }
  }

  const citationTodos = [];
  const missingCitationRefs = [];
  for (const draftFile of safeListDraftFiles(root)) {
    const content = readText(root, `${ARTIFACT_PATHS.draftsDir}/${draftFile}`, "");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/TODO\[citation\]|CITATION NEEDED|TODO: citation/i.test(line)) {
        citationTodos.push({ draftFile, line: index + 1, text: line.trim() });
      }
    });
    for (const key of extractCitationKeysFromText(content)) {
      if (!sourceById.has(key)) {
        missingCitationRefs.push({ draftFile, key });
      }
    }
  }

  return {
    unsupportedClaims,
    weakClaims,
    missingSourceRefs,
    missingNoteRefs,
    missingCitationRefs,
    draftClaimMismatches,
    citationTodos,
    claimBridgeProblems,
    auditIntegrityFlags,
    claimCount: (evidence.claims ?? []).length
  };
}

function safeEvaluateFigurePipeline(root, state, readErrors) {
  const evidence = safeReadJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null }, readErrors);
  const experimentPlans = safeReadJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null }, readErrors);
  const experimentResults = safeReadJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null }, readErrors);
  const reviewConcerns = safeReadJson(root, ARTIFACT_PATHS.reviewConcerns, createReviewConcernsIndex, readErrors);
  const rebuttalIssues = safeReadJson(root, ARTIFACT_PATHS.rebuttalIssues, { version: 1, items: [], updatedAt: null }, readErrors);
  const figures = safeReadJson(root, ARTIFACT_PATHS.figuresIndex, { version: 1, items: [], updatedAt: null }, readErrors);
  const briefs = safeReadJson(root, ARTIFACT_PATHS.figureBriefs, { version: 1, items: [], updatedAt: null }, readErrors);
  const segments = safeReadJson(root, ARTIFACT_PATHS.figureSegments, { version: 1, items: [], updatedAt: null }, readErrors);
  const templates = safeReadJson(root, ARTIFACT_PATHS.figureTemplates, { version: 1, items: [], updatedAt: null }, readErrors);
  const editable = safeReadJson(root, ARTIFACT_PATHS.figureEditableIndex, { version: 1, items: [], updatedAt: null }, readErrors);
  const finals = safeReadJson(root, ARTIFACT_PATHS.figureFinalIndex, { version: 1, items: [], updatedAt: null }, readErrors);
  const claimIds = new Set((evidence.claims ?? []).map((claim) => claim.id));
  const sectionIds = new Set(Object.keys(state.sections ?? {}));
  const experimentIds = new Set([
    ...(experimentPlans.items ?? []).map((item) => item.id),
    ...(experimentResults.items ?? []).map((item) => item.experimentId)
  ]);
  const reviewConcernIds = new Set((reviewConcerns.items ?? []).map((item) => item.id));
  const rebuttalIssueIds = new Set((rebuttalIssues.items ?? []).map((item) => item.id));
  const briefByFigure = new Map((briefs.items ?? []).map((item) => [item.figureId, item]));
  const segmentByFigure = new Map((segments.items ?? []).map((item) => [item.figureId, item]));
  const templateByFigure = new Map((templates.items ?? []).map((item) => [item.figureId, item]));
  const editableByFigure = new Map((editable.items ?? []).map((item) => [item.figureId, item]));
  const finalByFigure = new Map((finals.items ?? []).map((item) => [item.figureId, item]));
  const stagePathUsage = new Map();
  const timestamp = new Date(0).toISOString();
  const items = [];
  const issues = [];

  function normalizeFigureListField(figure, field, stage, artifactPaths) {
    const rawValue = figure[field];
    const normalized = normalizeStringArray(rawValue);
    if (rawValue !== undefined && rawValue !== null && !Array.isArray(rawValue)) {
      issues.push(buildFigureIssue({
        figure,
        code: `malformed-${field}`,
        severity: "medium",
        stage,
        summary: `Figure ${figure.id} has a malformed ${field} field and it was ignored during QA validation.`,
        artifactPaths,
        timestamp
      }));
    }
    return normalized;
  }

  for (const figure of figures.items ?? []) {
    for (const [field, stage] of [["templateSvgPath", "template"], ["editableSvgPath", "editable"], ["finalSvgPath", "final-contract"]]) {
      const normalizedPath = normalizeFigureArtifactPath(figure[field]);
      if (!normalizedPath || !isSafeProjectRelativePath(normalizedPath)) {
        continue;
      }
      const current = stagePathUsage.get(normalizedPath) ?? [];
      current.push({ figureId: figure.id, field, stage });
      stagePathUsage.set(normalizedPath, current);
    }
  }

  for (const figure of figures.items ?? []) {
    const figureIssues = [];
    const sourceSections = normalizeFigureListField(figure, "sourceSections", "brief", [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa]);
    const sourceArtifactPaths = normalizeFigureListField(figure, "sourceArtifactPaths", "brief", [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa]);
    const targetClaimIds = normalizeFigureListField(figure, "targetClaimIds", "brief", [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa]);
    const relatedExperimentIds = normalizeFigureListField(figure, "relatedExperimentIds", "brief", [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa]);
    const reviewConcernIdsForFigure = normalizeFigureListField(figure, "reviewConcernIds", "editable", [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.figureQa]);
    const rebuttalIssueIdsForFigure = normalizeFigureListField(figure, "rebuttalIssueIds", "final-contract", [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.figureQa]);
    const brief = briefByFigure.get(figure.id);
    const segment = segmentByFigure.get(figure.id);
    const template = templateByFigure.get(figure.id);
    const editableArtifact = editableByFigure.get(figure.id);
    const finalArtifact = finalByFigure.get(figure.id);
    const stageArtifacts = {
      brief: Boolean(brief),
      segments: Boolean(segment),
      template: Boolean(template),
      editable: Boolean(editableArtifact),
      finalContract: Boolean(finalArtifact)
    };
    const stageArtifactPaths = [
      ARTIFACT_PATHS.figuresIndex,
      ARTIFACT_PATHS.figureBriefs,
      ARTIFACT_PATHS.figureSegments,
      ARTIFACT_PATHS.figureTemplates,
      ARTIFACT_PATHS.figureEditableIndex,
      ARTIFACT_PATHS.figureFinalIndex,
      ARTIFACT_PATHS.figureQa
    ];
    const fileChecks = { stagedArtifacts: {}, sourceArtifacts: [] };

    for (const [stageName, present] of Object.entries(stageArtifacts)) {
      if (!present) {
        figureIssues.push(buildFigureIssue({
          figure,
          code: "missing-stage-artifact",
          severity: "high",
          stage: stageName,
          summary: `Figure ${figure.id} is missing the ${stageName} stage artifact.`,
          artifactPaths: stageArtifactPaths,
          timestamp
        }));
      }
    }

    if (targetClaimIds.length === 0) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "missing-claim-linkage",
        severity: "high",
        stage: "brief",
        summary: `Figure ${figure.id} has no linked target claims.`,
        claimIds: [],
        experimentIds: relatedExperimentIds,
        reviewConcernIds: reviewConcernIdsForFigure,
        rebuttalIssueIds: rebuttalIssueIdsForFigure,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }

    const missingSections = sourceSections.filter((sectionId) => !sectionIds.has(sectionId));
    if (missingSections.length > 0) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "missing-source-sections",
        severity: "medium",
        stage: "brief",
        summary: `Figure ${figure.id} references unknown source sections: ${missingSections.join(", ")}.`,
        claimIds: targetClaimIds,
        experimentIds: relatedExperimentIds,
        reviewConcernIds: reviewConcernIdsForFigure,
        rebuttalIssueIds: rebuttalIssueIdsForFigure,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }

    const missingClaims = targetClaimIds.filter((claimId) => !claimIds.has(claimId));
    if (missingClaims.length > 0) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "unknown-claims",
        severity: "high",
        stage: "brief",
        summary: `Figure ${figure.id} references unknown target claims: ${missingClaims.join(", ")}.`,
        claimIds: targetClaimIds,
        experimentIds: relatedExperimentIds,
        reviewConcernIds: reviewConcernIdsForFigure,
        rebuttalIssueIds: rebuttalIssueIdsForFigure,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }

    const missingExperiments = relatedExperimentIds.filter((experimentId) => !experimentIds.has(experimentId));
    if (missingExperiments.length > 0) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "unknown-experiments",
        severity: "medium",
        stage: "brief",
        summary: `Figure ${figure.id} references unknown related experiments: ${missingExperiments.join(", ")}.`,
        claimIds: targetClaimIds,
        experimentIds: relatedExperimentIds,
        reviewConcernIds: reviewConcernIdsForFigure,
        rebuttalIssueIds: rebuttalIssueIdsForFigure,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }

    const missingReviewConcerns = reviewConcernIdsForFigure.filter((id) => !reviewConcernIds.has(id));
    if (missingReviewConcerns.length > 0) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "unknown-review-concerns",
        severity: "medium",
        stage: "editable",
        summary: `Figure ${figure.id} references unknown review concerns: ${missingReviewConcerns.join(", ")}.`,
        claimIds: targetClaimIds,
        experimentIds: relatedExperimentIds,
        reviewConcernIds: reviewConcernIdsForFigure,
        rebuttalIssueIds: rebuttalIssueIdsForFigure,
        artifactPaths: [ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }

    const missingRebuttalIssues = rebuttalIssueIdsForFigure.filter((id) => !rebuttalIssueIds.has(id));
    if (missingRebuttalIssues.length > 0) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "unknown-rebuttal-issues",
        severity: "medium",
        stage: "final-contract",
        summary: `Figure ${figure.id} references unknown rebuttal issues: ${missingRebuttalIssues.join(", ")}.`,
        claimIds: targetClaimIds,
        experimentIds: relatedExperimentIds,
        reviewConcernIds: reviewConcernIdsForFigure,
        rebuttalIssueIds: rebuttalIssueIdsForFigure,
        artifactPaths: [ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.rebuttalIssues, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }

    const portablePathProblems = [figure.templateSvgPath, figure.editableSvgPath, figure.finalSvgPath].filter((relativePath) => !figurePathLooksPortable(relativePath));
    if (portablePathProblems.length > 0) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "non-portable-paths",
        severity: "high",
        stage: "template",
        summary: `Figure ${figure.id} uses non-portable artifact paths: ${portablePathProblems.join(", ")}.`,
        claimIds: targetClaimIds,
        experimentIds: relatedExperimentIds,
        reviewConcernIds: reviewConcernIdsForFigure,
        rebuttalIssueIds: rebuttalIssueIdsForFigure,
        artifactPaths: [ARTIFACT_PATHS.figureTemplates, ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }

    const stagePathChecks = [
      { field: "templateSvgPath", stage: "template", label: "template SVG", value: figure.templateSvgPath, artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureTemplates, ARTIFACT_PATHS.figureQa] },
      { field: "editableSvgPath", stage: "editable", label: "editable SVG", value: figure.editableSvgPath, artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.figureQa] },
      { field: "finalSvgPath", stage: "final-contract", label: "final SVG", value: figure.finalSvgPath, artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.figureQa] }
    ];

    for (const pathCheck of stagePathChecks) {
      const normalizedPath = normalizeFigureArtifactPath(pathCheck.value);
      const exists = normalizedPath && isSafeProjectRelativePath(normalizedPath) ? fs.existsSync(resolvePath(root, normalizedPath)) : false;
      fileChecks.stagedArtifacts[pathCheck.field] = { path: normalizedPath, exists };

      if (!normalizedPath || !isSafeProjectRelativePath(normalizedPath)) {
        figureIssues.push(buildFigureIssue({
          figure,
          code: `malformed-${pathCheck.field}`,
          severity: "high",
          stage: pathCheck.stage,
          summary: `Figure ${figure.id} has a malformed ${pathCheck.label.toLowerCase()} path.`,
          artifactPaths: pathCheck.artifactPaths,
          timestamp
        }));
        continue;
      }

      if (!exists) {
        figureIssues.push(buildFigureIssue({
          figure,
          code: `missing-${pathCheck.field}-file`,
          severity: "high",
          stage: pathCheck.stage,
          summary: `Figure ${figure.id} is missing the ${pathCheck.label.toLowerCase()} file at ${normalizedPath}.`,
          artifactPaths: pathCheck.artifactPaths,
          timestamp
        }));
      }
    }

    const distinctStagePaths = stagePathChecks.map((item) => normalizeFigureArtifactPath(item.value)).filter((item) => item && isSafeProjectRelativePath(item));
    if (new Set(distinctStagePaths).size !== distinctStagePaths.length) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "colliding-stage-paths",
        severity: "high",
        stage: "template",
        summary: `Figure ${figure.id} reuses the same file path for multiple staged SVG artifacts.`,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureTemplates, ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }

    for (const pathCheck of stagePathChecks) {
      const normalizedPath = normalizeFigureArtifactPath(pathCheck.value);
      const collisions = normalizedPath ? stagePathUsage.get(normalizedPath) ?? [] : [];
      if (collisions.some((entry) => entry.figureId !== figure.id)) {
        const otherFigureIds = Array.from(new Set(collisions.filter((entry) => entry.figureId !== figure.id).map((entry) => entry.figureId))).sort();
        figureIssues.push(buildFigureIssue({
          figure,
          code: `shared-${pathCheck.field}`,
          severity: "high",
          stage: pathCheck.stage,
          summary: `Figure ${figure.id} shares ${pathCheck.label.toLowerCase()} path ${normalizedPath} with ${otherFigureIds.join(", ")}.`,
          artifactPaths: pathCheck.artifactPaths,
          timestamp
        }));
      }
    }

    const normalizedSourceArtifactPaths = sourceArtifactPaths.map(normalizeFigureArtifactPath);
    for (let index = 0; index < normalizedSourceArtifactPaths.length; index += 1) {
      const sourcePath = normalizedSourceArtifactPaths[index];
      const exists = sourcePath && isSafeProjectRelativePath(sourcePath) ? fs.existsSync(resolvePath(root, sourcePath)) : false;
      fileChecks.sourceArtifacts.push({ path: sourcePath, exists });

      if (!sourcePath || !isSafeProjectRelativePath(sourcePath)) {
        figureIssues.push(buildFigureIssue({
          figure,
          code: `malformed-source-artifact-${index + 1}`,
          severity: "medium",
          stage: "brief",
          summary: `Figure ${figure.id} has a malformed source artifact path entry.`,
          artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa],
          timestamp
        }));
        continue;
      }

      if (!exists) {
        figureIssues.push(buildFigureIssue({
          figure,
          code: `missing-source-artifact-${index + 1}`,
          severity: "medium",
          stage: "brief",
          summary: `Figure ${figure.id} references a missing source artifact at ${sourcePath}.`,
          artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa],
          timestamp
        }));
      }
    }

    const templatePathMismatch = template && [template.templateSvgPath !== figure.templateSvgPath, template.editableSvgPath !== figure.editableSvgPath, template.finalSvgPath !== figure.finalSvgPath].some(Boolean);
    if (templatePathMismatch) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "inconsistent-template-stage-paths",
        severity: "high",
        stage: "template",
        summary: `Figure ${figure.id} has inconsistent staged SVG paths between the figure index and template artifact.`,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureTemplates, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }

    const editablePathMismatch = editableArtifact && [editableArtifact.templateSvgPath !== figure.templateSvgPath, editableArtifact.editableSvgPath !== figure.editableSvgPath, editableArtifact.finalSvgPath !== figure.finalSvgPath].some(Boolean);
    if (editablePathMismatch) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "inconsistent-editable-stage-paths",
        severity: "high",
        stage: "editable",
        summary: `Figure ${figure.id} has inconsistent staged SVG paths between the figure index and editable artifact.`,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }

    if (finalArtifact && finalArtifact.finalSvgPath !== figure.finalSvgPath) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "inconsistent-final-contract-path",
        severity: "high",
        stage: "final-contract",
        summary: `Figure ${figure.id} has inconsistent final SVG paths between the figure index and final contract.`,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }

    if (brief && JSON.stringify(brief.sourceArtifactPaths ?? []) !== JSON.stringify(figure.sourceArtifactPaths ?? [])) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "inconsistent-source-artifact-paths",
        severity: "medium",
        stage: "brief",
        summary: `Figure ${figure.id} has inconsistent source artifact paths between the figure index and brief artifact.`,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }

    if (editableArtifact && editableArtifact.finalSvgPath !== figure.finalSvgPath) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "inconsistent-final-path",
        severity: "high",
        stage: "editable",
        summary: `Figure ${figure.id} has inconsistent final SVG paths across staged artifacts.`,
        artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }

    if (((figure.reviewConcernIds ?? []).length > 0 || (figure.rebuttalIssueIds ?? []).length > 0) && (figure.reviewNotes ?? []).length === 0) {
      figureIssues.push(buildFigureIssue({
        figure,
        code: "missing-review-notes",
        severity: "medium",
        stage: "editable",
        summary: `Figure ${figure.id} links to review or rebuttal context but has no durable review notes.`,
        artifactPaths: [ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.rebuttalIssues, ARTIFACT_PATHS.figureQa],
        timestamp
      }));
    }

    issues.push(...figureIssues.map((issue) => ({
      ...issue,
      responseOwnerRole: responseOwnerForFigureIssue(issue)
    })));
    items.push({
      figureId: figure.id,
      qaStatus: figureIssues.some((issue) => issue.severity === "high") ? "blocked" : figureIssues.length > 0 ? "needs-review" : "ready",
      issueCount: figureIssues.length,
      openIssueIds: figureIssues.map((issue) => issue.id),
      stageArtifacts,
      targetClaimIds: figure.targetClaimIds,
      relatedExperimentIds: figure.relatedExperimentIds,
      reviewConcernIds: figure.reviewConcernIds,
      rebuttalIssueIds: figure.rebuttalIssueIds,
      fileChecks,
      updatedAt: timestamp
    });
  }

  return { version: 1, items, issues, updatedAt: timestamp };
}

function findingId(category, code, seed) {
  return `audit-${category}-${code}-${String(seed).replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase()}`;
}

function addFinding(findings, { id, severity, category, confidence = "high", summary, artifactPaths = [], suggestedNextCommand, claimIds = [], experimentIds = [], reviewConcernIds = [], rebuttalIssueIds = [], proposalOnly = true }) {
  findings.push({
    id,
    severity,
    category,
    confidence,
    summary,
    artifactPaths: Array.from(new Set(artifactPaths.filter(Boolean))),
    claimIds,
    experimentIds,
    reviewConcernIds,
    rebuttalIssueIds,
    suggestedNextCommand,
    proposalOnly,
    noAutoApply: true
  });
}

function countBy(items, field) {
  const counts = {};
  for (const item of items) {
    const key = item[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function suggestedCommandsFromFindings(findings) {
  return Array.from(new Set(findings.map((finding) => finding.suggestedNextCommand).filter(Boolean)));
}

function artifactPathsRead() {
  return [
    ARTIFACT_PATHS.state,
    ARTIFACT_PATHS.orchestrationBoard,
    ARTIFACT_PATHS.workspaceIndex,
    ARTIFACT_PATHS.checklist,
    ARTIFACT_PATHS.sources,
    ARTIFACT_PATHS.notes,
    ARTIFACT_PATHS.evidence,
    ARTIFACT_PATHS.experimentResults,
    ARTIFACT_PATHS.experimentAudits,
    ARTIFACT_PATHS.claimBridgeLog,
    ARTIFACT_PATHS.reviewState,
    ARTIFACT_PATHS.reviewConcerns,
    ARTIFACT_PATHS.versionComparisons,
    ARTIFACT_PATHS.figuresIndex,
    ARTIFACT_PATHS.figureBriefs,
    ARTIFACT_PATHS.figureSegments,
    ARTIFACT_PATHS.figureTemplates,
    ARTIFACT_PATHS.figureEditableIndex,
    ARTIFACT_PATHS.figureFinalIndex,
    ARTIFACT_PATHS.figureQa,
    ARTIFACT_PATHS.draftsDir
  ];
}

export function queryPaperAudit(root, args = {}) {
  const readErrors = [];
  const state = safeLoadState(root, readErrors);
  const board = safeReadJson(root, ARTIFACT_PATHS.orchestrationBoard, {}, readErrors);
  const reviewState = safeReadJson(root, ARTIFACT_PATHS.reviewState, createReviewState, readErrors);
  const reviewConcerns = safeReadJson(root, ARTIFACT_PATHS.reviewConcerns, createReviewConcernsIndex, readErrors);
  const versionComparisons = safeReadJson(root, ARTIFACT_PATHS.versionComparisons, createVersionComparisonsIndex, readErrors);
  const workspaceIndex = normalizeWorkspaceIndex(safeReadJson(root, ARTIFACT_PATHS.workspaceIndex, createWorkspaceIndex, readErrors));
  const checklistText = readText(root, ARTIFACT_PATHS.checklist, "");
  const evidence = safeEvaluateEvidence(root, readErrors);
  const figureQa = safeEvaluateFigurePipeline(root, state, readErrors);
  const findings = [];

  for (const error of readErrors) {
    addFinding(findings, {
      id: findingId("artifact", "malformed-json", error.path),
      severity: "high",
      category: "artifact",
      confidence: "high",
      summary: `${error.path} could not be parsed as JSON: ${error.message}`,
      artifactPaths: [error.path],
      suggestedNextCommand: "project:dove.paper.checklist"
    });
  }

  for (const claim of evidence.unsupportedClaims) {
    addFinding(findings, {
      id: findingId("evidence", "unsupported-claim", claim.id),
      severity: "high",
      category: "evidence",
      summary: `Claim ${claim.id} has no valid source support.`,
      artifactPaths: [ARTIFACT_PATHS.evidence, ARTIFACT_PATHS.sources],
      claimIds: [claim.id],
      suggestedNextCommand: "project:dove.paper.claim-gate"
    });
  }

  for (const claim of evidence.weakClaims) {
    addFinding(findings, {
      id: findingId("evidence", "weak-claim", claim.id),
      severity: "medium",
      category: "evidence",
      summary: `Claim ${claim.id} is weakly supported and should be strengthened before acceptance.`,
      artifactPaths: [ARTIFACT_PATHS.evidence, ARTIFACT_PATHS.sources, ARTIFACT_PATHS.notes],
      claimIds: [claim.id],
      suggestedNextCommand: "project:dove.paper.research"
    });
  }

  for (const item of evidence.missingSourceRefs) {
    addFinding(findings, {
      id: findingId("evidence", "missing-source-ref", item.claim.id),
      severity: "high",
      category: "evidence",
      summary: `Claim ${item.claim.id} references missing sources: ${item.missing.join(", ")}.`,
      artifactPaths: [ARTIFACT_PATHS.evidence, ARTIFACT_PATHS.sources],
      claimIds: [item.claim.id],
      suggestedNextCommand: "project:dove.paper.source"
    });
  }

  for (const item of evidence.missingNoteRefs) {
    addFinding(findings, {
      id: findingId("evidence", "missing-note-ref", item.claim.id),
      severity: "medium",
      category: "evidence",
      summary: `Claim ${item.claim.id} references missing notes: ${item.missing.join(", ")}.`,
      artifactPaths: [ARTIFACT_PATHS.evidence, ARTIFACT_PATHS.notes],
      claimIds: [item.claim.id],
      suggestedNextCommand: "project:dove.paper.note"
    });
  }

  for (const item of evidence.missingCitationRefs) {
    addFinding(findings, {
      id: findingId("citation", "missing-citation-ref", `${item.draftFile}-${item.key}`),
      severity: "high",
      category: "citation",
      summary: `${item.draftFile} cites unknown source key ${item.key}.`,
      artifactPaths: [ARTIFACT_PATHS.draftsDir, ARTIFACT_PATHS.sources, ARTIFACT_PATHS.bibliography],
      suggestedNextCommand: "project:dove.paper.citations"
    });
  }

  for (const todo of evidence.citationTodos) {
    addFinding(findings, {
      id: findingId("citation", "citation-todo", `${todo.draftFile}-${todo.line}`),
      severity: "medium",
      category: "citation",
      summary: `${todo.draftFile}:${todo.line} still has a citation TODO.`,
      artifactPaths: [ARTIFACT_PATHS.draftsDir, ARTIFACT_PATHS.bibliography],
      suggestedNextCommand: "project:dove.paper.citations"
    });
  }

  for (const item of evidence.draftClaimMismatches) {
    addFinding(findings, {
      id: findingId("draft", item.reason, item.claim.id),
      severity: "medium",
      category: "draft",
      summary: item.reason === "missing-draft"
        ? `Claim ${item.claim.id} targets section ${item.claim.sectionId} but no draft exists for that section.`
        : `Draft for ${item.claim.sectionId} does not cite any expected source for claim ${item.claim.id}.`,
      artifactPaths: [ARTIFACT_PATHS.draftsDir, ARTIFACT_PATHS.evidence],
      claimIds: [item.claim.id],
      suggestedNextCommand: "project:dove.paper.draft"
    });
  }

  for (const audit of evidence.auditIntegrityFlags) {
    addFinding(findings, {
      id: findingId("experiment", "audit-integrity", audit.id),
      severity: "high",
      category: "experiment",
      summary: `Experiment audit ${audit.id} raised integrity flags: ${(audit.integrityFlags ?? []).join(", ")}.`,
      artifactPaths: [ARTIFACT_PATHS.experimentAudits],
      claimIds: audit.claimId ? [audit.claimId] : [],
      experimentIds: audit.experimentId ? [audit.experimentId] : [],
      suggestedNextCommand: "project:dove.paper.experiment-audit"
    });
  }

  for (const bridgeProblem of evidence.claimBridgeProblems) {
    addFinding(findings, {
      id: findingId("claim-bridge", bridgeProblem.reason, bridgeProblem.claim.id),
      severity: "high",
      category: "claim-bridge",
      summary: `Claim ${bridgeProblem.claim.id} has a result-to-claim bridge problem (${bridgeProblem.reason}).`,
      artifactPaths: [ARTIFACT_PATHS.claimBridgeLog, ARTIFACT_PATHS.evidence],
      claimIds: [bridgeProblem.claim.id],
      experimentIds: bridgeProblem.claim.experimentIds ?? [],
      suggestedNextCommand: "project:dove.paper.result-bridge"
    });
  }

  for (const issue of figureQa.issues ?? []) {
    addFinding(findings, {
      id: findingId("figure", issue.code, issue.id),
      severity: issue.severity,
      category: "figure",
      summary: issue.summary,
      artifactPaths: issue.artifactPaths ?? [ARTIFACT_PATHS.figureQa],
      claimIds: issue.claimIds ?? [],
      experimentIds: issue.experimentIds ?? [],
      reviewConcernIds: issue.reviewConcernIds ?? [],
      rebuttalIssueIds: issue.rebuttalIssueIds ?? [],
      suggestedNextCommand: "project:dove.paper.figure"
    });
  }

  const openConcerns = (reviewConcerns.items ?? []).filter((item) => item.status !== "resolved");
  for (const concern of openConcerns) {
    addFinding(findings, {
      id: findingId("review", "open-concern", concern.id),
      severity: concern.severity ?? "medium",
      category: "review",
      summary: `Review concern ${concern.id} remains open: ${concern.summary ?? "No summary."}`,
      artifactPaths: [ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.reviewState],
      reviewConcernIds: [concern.id],
      suggestedNextCommand: "project:dove.paper.review-loop"
    });
  }

  if ((reviewState.lastVerdict === "needs-work" || reviewState.lastVerdict === "needs-evidence") && openConcerns.length === 0) {
    addFinding(findings, {
      id: findingId("review", "verdict-without-open-concerns", reviewState.lastVerdict),
      severity: "medium",
      category: "review",
      summary: `Review state verdict is ${reviewState.lastVerdict}, but no open concern items were found.`,
      artifactPaths: [ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.reviewConcerns],
      suggestedNextCommand: "project:dove.paper.review-loop"
    });
  }

  const activeComparisonTargets = versionComparisons.activeTargets ?? [];
  if (activeComparisonTargets.length > 0 && (versionComparisons.items ?? []).length === 0) {
    addFinding(findings, {
      id: findingId("version", "active-targets-without-comparison", activeComparisonTargets.join("-")),
      severity: "medium",
      category: "version",
      summary: `Version comparison has active targets (${activeComparisonTargets.join(", ")}) but no comparison records.`,
      artifactPaths: [ARTIFACT_PATHS.versionComparisons],
      suggestedNextCommand: "project:dove.paper.version-compare"
    });
  }

  if (/\[ \]|TODO|needs-review|blocked/i.test(checklistText) && PAPER_MAJOR_CHANGE_PROTOCOL_STAGES.includes("acceptance")) {
    addFinding(findings, {
      id: findingId("process", "open-checklist-items", ARTIFACT_PATHS.checklist),
      severity: "medium",
      category: "process",
      summary: "The checklist still appears to contain open, TODO, blocked, or needs-review items.",
      artifactPaths: [ARTIFACT_PATHS.checklist],
      suggestedNextCommand: "project:dove.paper.checklist"
    });
  }

  const boardPhase = board.currentPhase ?? board.phase ?? state.pipeline?.currentStage ?? "init";
  if (workspaceIndex.lifecycle?.boardFamily && workspaceIndex.lifecycle.boardFamily !== "work-unit" && !workspaceIndex.lifecycle.familyIds.includes(workspaceIndex.lifecycle.boardFamily)) {
    addFinding(findings, {
      id: findingId("workspace", "invalid-board-family", workspaceIndex.lifecycle.boardFamily),
      severity: "medium",
      category: "workspace",
      summary: `Workspace lifecycle board family ${workspaceIndex.lifecycle.boardFamily} is not part of the current taxonomy.`,
      artifactPaths: [ARTIFACT_PATHS.workspaceIndex],
      suggestedNextCommand: "project:dove.paper.task-graph"
    });
  }

  const severityCounts = countBy(findings, "severity");
  const categoryCounts = countBy(findings, "category");
  const suggestedNextCommands = suggestedCommandsFromFindings(findings);
  const highestSeverity = findings.some((finding) => finding.severity === "high") ? "high" : findings.some((finding) => finding.severity === "medium") ? "medium" : findings.some((finding) => finding.severity === "low") ? "low" : "none";

  return {
    mode: "audit-only",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    summary: {
      highestSeverity,
      findingCount: findings.length,
      claimCount: evidence.claimCount,
      figureCount: (figureQa.items ?? []).length,
      openConcernCount: openConcerns.length,
      boardPhase,
      lifecycleTaxonomyVersion: PAPER_LIFECYCLE_TAXONOMY_VERSION,
      majorChangeProtocolStages: PAPER_MAJOR_CHANGE_PROTOCOL_STAGES
    },
    findings,
    severityCounts,
    categoryCounts,
    artifactPathsRead: artifactPathsRead(),
    suggestedNextCommands,
    diagnostics: {
      readErrors,
      workspaceLifecycle: workspaceIndex.lifecycle ?? null,
      requestedScope: typeof args.scope === "string" && args.scope.trim().length > 0 ? args.scope.trim() : null
    }
  };
}
