import fs from "node:fs";
import path from "node:path";

import { ARTIFACT_PATHS } from "./schema.mjs";
import { assertNoInlineSecrets } from "./config.mjs";
import { buildCommandResultCard } from "./result-cards.mjs";
import { importFigureGeneration, prepareFigureGeneration } from "./figure-generation.mjs";
import { resolveDoveResponseLanguage } from "./i18n.mjs";
import { assertTaskScopedMutationTarget } from "./mutation-guard.mjs";
import { isPatchPlanMode } from "./mutation-backend.mjs";
import { buildPreActionGuidance } from "./pre-action-guidance.mjs";
import { summarizeFigureQa, upsertFigurePlan, validateFigurePipeline } from "./artifacts.mjs";
import {
  assertFollowThroughReady,
  assertGovernanceMutationRegistered,
  ensureDir,
  ensureWorkspace,
  readJson,
  resolvePath,
  writeText
} from "./workspace.mjs";

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "figure";
}

function normalizeStringArray(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  return Array.from(new Set(source.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())));
}

function firstText(...values) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? null;
}

const FIGURE_MATERIAL_INPUT_KEYS = new Set([
  "id",
  "type",
  "label",
  "summary",
  "artifactPath",
  "path"
]);
const FIGURE_SEMANTIC_COVERAGE_INPUT_KEYS = new Set([
  "observations",
  "evidencePaths",
  "artifactPaths"
]);
const FIGURE_SEMANTIC_REVIEW_INPUT_KEYS = new Set([
  "summary",
  "observations",
  "evidencePaths",
  "artifactPaths"
]);

function assertFigurePlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`run_figure_workflow requires an object at ${label}.`);
  }
}

function assertFigureString(value, label) {
  if (typeof value !== "string") {
    throw new Error(`run_figure_workflow requires a string at ${label}.`);
  }
}

function assertFigureStringArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`run_figure_workflow requires an array at ${label}.`);
  }
  value.forEach((item, index) => assertFigureString(item, `${label}[${index}]`));
}

function assertFigureObjectKeys(value, allowedKeys, label) {
  assertFigurePlainObject(value, label);
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknown.length > 0) {
    throw new Error(`run_figure_workflow does not accept unknown input ${unknown.map((key) => `${label}.${key}`).join(", ")}.`);
  }
}

function assertFigureMaterialItem(value, label) {
  assertFigureObjectKeys(value, FIGURE_MATERIAL_INPUT_KEYS, label);
  for (const key of FIGURE_MATERIAL_INPUT_KEYS) {
    if (Object.hasOwn(value, key)) {
      assertFigureString(value[key], `${label}.${key}`);
    }
  }
}

function assertFigureSemanticObservation(value, allowedKeys, label) {
  assertFigureObjectKeys(value, allowedKeys, label);
  if (Object.hasOwn(value, "summary")) {
    assertFigureString(value.summary, `${label}.summary`);
  }
  for (const key of ["observations", "evidencePaths", "artifactPaths"]) {
    if (Object.hasOwn(value, key)) {
      assertFigureStringArray(value[key], `${label}.${key}`);
    }
  }
}

function assertFigurePublicInput(args = {}) {
  if (Object.hasOwn(args, "materialRequirements")) {
    if (!Array.isArray(args.materialRequirements)) {
      throw new Error("run_figure_workflow requires an array at $.materialRequirements.");
    }
    args.materialRequirements.forEach((item, index) => assertFigureMaterialItem(item, `$.materialRequirements[${index}]`));
  }
  if (Object.hasOwn(args, "materialHints")) {
    if (!Array.isArray(args.materialHints)) {
      throw new Error("run_figure_workflow requires an array at $.materialHints.");
    }
    args.materialHints.forEach((item, index) => {
      if (typeof item !== "string") {
        assertFigureMaterialItem(item, `$.materialHints[${index}]`);
      }
    });
  }
  if (Object.hasOwn(args, "semanticCoverage")) {
    assertFigureSemanticObservation(
      args.semanticCoverage,
      FIGURE_SEMANTIC_COVERAGE_INPUT_KEYS,
      "$.semanticCoverage"
    );
  }
  if (Object.hasOwn(args, "semanticReview")) {
    assertFigureSemanticObservation(
      args.semanticReview,
      FIGURE_SEMANTIC_REVIEW_INPUT_KEYS,
      "$.semanticReview"
    );
  }
}

function compactObject(fields) {
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

function normalizeRelativePath(value) {
  return path.posix.normalize(String(value ?? "").trim().replace(/\\/g, "/").replace(/^\.\//, ""));
}

function isSafeProjectRelativePath(relativePath) {
  return Boolean(relativePath) && !path.posix.isAbsolute(relativePath) && relativePath !== ".." && !relativePath.startsWith("../");
}

function assertSafeFinalTargetPath(relativePath, label) {
  const normalized = normalizeRelativePath(relativePath);
  if (!isSafeProjectRelativePath(normalized) || !normalized.startsWith(".dove/figures/") || normalized.startsWith(".dove/figures/runs/") || !normalized.endsWith(".svg")) {
    throw new Error(`${label} must be a final SVG artifact under .dove/figures/ and outside .dove/figures/runs/: ${relativePath ?? "<missing>"}`);
  }
  return normalized;
}

function assertNoLegacyFinalSvgInput(value, label) {
  if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "finalSvgPath")) {
    throw new Error(`${label} no longer accepts finalSvgPath as input; use sourceSvgPath for generated SVG input or targetFinalSvgPath for the final artifact target.`);
  }
}

function existingFigureById(root, figureId) {
  const figures = readJson(root, ARTIFACT_PATHS.figuresIndex, { version: 1, items: [], updatedAt: null });
  return {
    figures,
    existing: (figures.items ?? []).find((item) => item.id === figureId) ?? null
  };
}

function readInferenceContext(root) {
  const state = readJson(root, ARTIFACT_PATHS.state, { sections: {} });
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null });
  const experimentPlans = readJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null });
  const experimentResults = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  return { state, evidence, experimentPlans, experimentResults };
}

function inferClaimIds(args, existing, context) {
  const explicit = normalizeStringArray(args.targetClaimIds ?? args.claimIds, existing?.targetClaimIds ?? []);
  if (explicit.length > 0) {
    return explicit;
  }
  const claims = context.evidence.claims ?? [];
  return claims.length === 1 ? [claims[0].id] : [];
}

function inferSourceSections(args, existing, context, targetClaimIds) {
  const explicit = normalizeStringArray(args.sourceSections ?? args.sectionIds, existing?.sourceSections ?? []);
  if (explicit.length > 0) {
    return explicit;
  }
  const claimSections = targetClaimIds
    .map((claimId) => (context.evidence.claims ?? []).find((claim) => claim.id === claimId)?.sectionId)
    .filter(Boolean);
  if (claimSections.length > 0) {
    return normalizeStringArray(claimSections);
  }
  const sectionIds = Object.keys(context.state.sections ?? {});
  return sectionIds.length === 1 ? sectionIds : [];
}

function inferExperimentIds(args, existing, context, targetClaimIds) {
  const explicit = normalizeStringArray(args.relatedExperimentIds ?? args.experimentIds, existing?.relatedExperimentIds ?? []);
  if (explicit.length > 0) {
    return explicit;
  }
  const claimExperimentIds = targetClaimIds.flatMap((claimId) => {
    const claim = (context.evidence.claims ?? []).find((item) => item.id === claimId);
    return normalizeStringArray(claim?.experimentIds);
  });
  if (claimExperimentIds.length > 0) {
    return normalizeStringArray(claimExperimentIds);
  }
  const ids = normalizeStringArray([
    ...(context.experimentPlans.items ?? []).map((item) => item.id),
    ...(context.experimentResults.items ?? []).map((item) => item.experimentId)
  ]);
  return ids.length === 1 ? ids : [];
}

function buildFigureItem(root, args, target) {
  const intent = firstText(args.intent, args.description, args.summary, args.purpose, args.captionIntent, args.name, args.title) ?? "Requested paper figure";
  const rawFigureId = args.figureId ?? args.id ?? args.name ?? args.title ?? intent;
  const figureId = slugify(rawFigureId);
  const { figures, existing } = existingFigureById(root, figureId);
  const context = readInferenceContext(root);
  const targetClaimIds = inferClaimIds(args, existing, context);
  const sourceSections = inferSourceSections(args, existing, context, targetClaimIds);
  const relatedExperimentIds = inferExperimentIds(args, existing, context, targetClaimIds);
  const requiredVisualElements = normalizeStringArray(
    args.requiredVisualElements ?? args.visualElements,
    normalizeStringArray(existing?.requiredVisualElements, [intent])
  );
  const item = {
    ...(existing ?? {}),
    id: figureId,
    name: firstText(args.name, args.title, existing?.name, intent) ?? figureId,
    purpose: firstText(args.purpose, args.intent, args.description, existing?.purpose, intent) ?? intent,
    sourceSections,
    sourceArtifactPaths: normalizeStringArray(args.sourceArtifactPaths ?? args.artifactPaths, existing?.sourceArtifactPaths ?? []),
    targetClaimIds,
    relatedExperimentIds,
    reviewConcernIds: normalizeStringArray(args.reviewConcernIds ?? args.concernIds, existing?.reviewConcernIds ?? []),
    rebuttalIssueIds: normalizeStringArray(args.rebuttalIssueIds ?? args.issueIds, existing?.rebuttalIssueIds ?? []),
    narrativeIntent: firstText(args.narrativeIntent, args.intent, args.description, existing?.narrativeIntent, intent) ?? intent,
    requiredVisualElements,
    materialRequirements: Array.isArray(args.materialRequirements) ? args.materialRequirements : existing?.materialRequirements ?? [],
    generationProviderId: args.providerId ?? args.generationProviderId ?? existing?.generationProviderId ?? null,
    generationMode: args.generationMode ?? existing?.generationMode ?? "workflow",
    generationConstraints: normalizeStringArray(args.constraints, existing?.generationConstraints ?? []),
    outputFormat: args.outputFormat ?? existing?.outputFormat ?? "svg",
    captionIntent: firstText(args.captionIntent, args.caption, args.captionDraft, existing?.captionIntent, intent) ?? intent,
    templateSvgPath: args.templateSvgPath ?? existing?.templateSvgPath ?? `.dove/figures/${figureId}.template.svg`,
    editableSvgPath: args.editableSvgPath ?? existing?.editableSvgPath ?? `.dove/figures/${figureId}.editable.svg`,
    finalSvgPath: assertSafeFinalTargetPath(args.targetFinalSvgPath ?? existing?.finalSvgPath ?? `.dove/figures/${figureId}.final.svg`, "targetFinalSvgPath"),
    owner: args.owner ?? existing?.owner ?? target.packet.assignedRole ?? "builder",
    mode: args.mode ?? existing?.mode ?? "generated",
    status: existing?.status ?? "planned",
    reviewNotes: normalizeStringArray(args.reviewNotes, existing?.reviewNotes ?? [])
  };
  const items = [...(figures.items ?? []).filter((figure) => figure.id !== figureId), item];
  return { figureId, item, items };
}

function placeholderSvg(figure) {
  const label = (figure.name ?? figure.id).replace(/[<>&]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400"><title>${label}</title><text x="32" y="48">${label}</text></svg>\n`;
}

function ensureSvgFile(root, relativePath, content) {
  if (!relativePath || fs.existsSync(resolvePath(root, relativePath))) {
    return false;
  }
  if (!isPatchPlanMode(root)) {
    ensureDir(path.dirname(resolvePath(root, relativePath)));
  }
  writeText(root, relativePath, content);
  return true;
}

function ensureStageSvgFiles(root, figure) {
  const content = placeholderSvg(figure);
  return {
    templateCreated: ensureSvgFile(root, figure.templateSvgPath, content),
    editableCreated: ensureSvgFile(root, figure.editableSvgPath, content)
  };
}

function hasImportableOutput(args, prepared) {
  return Boolean(
    args.svgContent ||
    args.sourceSvgPath ||
    args.outputManifestPath ||
    prepared.providerExecution?.status === "completed"
  );
}

function hasExplicitFigureMaterialInput(args = {}) {
  return Boolean(
    args.svgContent
    || args.sourceSvgPath
    || args.outputManifestPath
    || firstText(args.caption, args.captionDraft, args.captionIntent)
    || normalizeStringArray(args.requiredVisualElements ?? args.visualElements).length > 0
    || normalizeStringArray(args.sourceArtifactPaths ?? args.artifactPaths).length > 0
    || (Array.isArray(args.materialRequirements) && args.materialRequirements.length > 0)
    || (Array.isArray(args.materialHints) && args.materialHints.length > 0)
  );
}

function figureNeedsPrePlanMaterialBoundary(args, item) {
  if (args.allowMissingMaterials === true) {
    return false;
  }
  const hasEvidenceLinkage = normalizeStringArray(item.targetClaimIds).length > 0
    || normalizeStringArray(item.relatedExperimentIds).length > 0;
  return !hasEvidenceLinkage && !hasExplicitFigureMaterialInput(args);
}

function prePlanFigureBoundary(figureId, runId) {
  return {
    id: `${figureId}-${runId}-figure-materials`,
    type: "missing-required-materials",
    reason: `Figure ${figureId} needs claim/experiment linkage or explicit visual/caption/material input before Dove can write a figure plan.`,
    requiredInputs: ["claim-or-experiment-linkage", "visual-elements-or-caption-or-source-material"],
    requiredActions: ["link-figure-to-claim-or-experiment", "provide-figure-visual-or-caption-material"],
    artifactRefs: [],
    nextAction: "project:dove.figure",
    ownerRole: "builder",
    nextRole: "builder",
    detail: { implementationBoundaryType: "missing-figure-materials-before-plan" }
  };
}

function statusFor(prepared, imported, figureQa) {
  if (["missing-secret-env", "failed"].includes(prepared.providerExecution?.status)) {
    return "blocked-boundary";
  }
  if (imported) {
    return figureQa.issueCount === 0 ? "validated" : "qa-needs-attention";
  }
  if ((prepared.missingRequirementIds ?? []).length > 0) {
    return "blocked-missing-materials";
  }
  return "prepared-awaiting-output";
}

function figureArtifactRefs(validation) {
  return normalizeStringArray([
    ARTIFACT_PATHS.figuresIndex,
    ARTIFACT_PATHS.figureGenerations,
    ARTIFACT_PATHS.figureMaterials,
    ARTIFACT_PATHS.figureQa,
    validation?.qaPath
  ]);
}

function figureValidationEvidencePaths(validation) {
  return normalizeStringArray([validation?.qaPath]);
}

function figureBoundaryFor(status, prepared, validation, figureQa, figureId, runId) {
  const artifactRefs = figureArtifactRefs(validation);
  const providerStatus = prepared.providerExecution?.status ?? null;
  if (status === "blocked-missing-materials") {
    return {
      id: `${figureId}-${runId}-missing-materials`,
      type: "missing-required-materials",
      reason: `Figure ${figureId} is missing required materials: ${(prepared.missingRequirementIds ?? []).join(", ")}.`,
      requiredInputs: prepared.missingRequirementIds ?? [],
      requiredActions: ["provide-figure-materials", "resolve-missing-figure-requirements"],
      artifactRefs,
      nextAction: "project:dove.figure",
      ownerRole: "builder",
      nextRole: "builder"
    };
  }
  if (providerStatus === "missing-secret-env") {
    const apiKeyEnv = prepared.providerExecution?.apiKeyEnv ?? prepared.providerReadiness?.apiKeyEnv ?? "provider-api-key-env";
    return {
      id: `${figureId}-${runId}-awaiting-provider-output`,
      type: "awaiting-provider-output",
      reason: `Figure ${figureId} is awaiting provider configuration before output can be imported.`,
      requiredInputs: [apiKeyEnv],
      requiredActions: ["set-provider-api-key-env", "retry-figure-provider", "import-manual-figure-output"],
      artifactRefs,
      nextAction: "project:dove.figure",
      ownerRole: "builder",
      nextRole: "builder",
      detail: compactObject({
        implementationBoundaryType: "missing-secret-env",
        providerStatus,
        apiKeyEnv,
        providerError: prepared.providerExecution?.error
      })
    };
  }
  if (providerStatus === "failed") {
    return {
      id: `${figureId}-${runId}-awaiting-provider-output`,
      type: "awaiting-provider-output",
      reason: `Figure ${figureId} is awaiting provider recovery or manual output import.`,
      requiredInputs: ["provider-error-resolution-or-manual-output"],
      requiredActions: ["fix-figure-provider-and-retry", "import-manual-figure-output"],
      artifactRefs,
      nextAction: "project:dove.figure",
      ownerRole: "builder",
      nextRole: "builder",
      detail: compactObject({
        implementationBoundaryType: "provider-failed",
        providerStatus,
        providerError: prepared.providerExecution?.error
      })
    };
  }
  if (status === "prepared-awaiting-output") {
    const providerRequiredActions = normalizeStringArray(prepared.providerExecution?.requiredActions);
    const providerRequiredInputs = prepared.providerExecution?.requiredMutationMode ? [`mutationMode: ${prepared.providerExecution.requiredMutationMode}`] : [];
    return {
      id: `${figureId}-${runId}-awaiting-provider-output`,
      type: "awaiting-provider-output",
      reason: `Figure ${figureId} is awaiting provider output or manual output import.`,
      requiredInputs: normalizeStringArray([...providerRequiredInputs, "sourceSvgPath-or-outputManifestPath-or-svgContent"]),
      requiredActions: normalizeStringArray([...providerRequiredActions, "run-provider-or-import-output", "provide-source-svg-or-output-manifest"]),
      artifactRefs,
      nextAction: "project:dove.figure",
      ownerRole: "builder",
      nextRole: "builder",
      detail: compactObject({
        implementationBoundaryType: providerStatus,
        providerReason: prepared.providerExecution?.reason,
        requiredMutationMode: prepared.providerExecution?.requiredMutationMode
      })
    };
  }
  if (status === "qa-needs-attention") {
    return {
      id: `${figureId}-${runId}-qa-needs-attention`,
      type: "verification-failed",
      reason: `Figure ${figureId} has ${figureQa.issueCount} review issue(s) to fix before it is ready.`,
      requiredInputs: ["current-figure-review-findings"],
      requiredActions: ["review-current-figure", "resolve-current-figure-issues"],
      artifactRefs,
      nextAction: "project:dove.review",
      ownerRole: "builder",
      nextRole: "reviewer",
      detail: { implementationBoundaryType: "needs-review" }
    };
  }
  return null;
}

function figureText(responseLanguage, zh, en) {
  return responseLanguage === "en" ? en : zh;
}

function figureResultHappened(status, { prepared, figureQa, imported, responseLanguage }) {
  const missing = normalizeStringArray(prepared.missingRequirementIds).join("、");
  const apiKeyEnv = prepared.providerExecution?.apiKeyEnv ?? prepared.providerReadiness?.apiKeyEnv ?? "provider API key";
  if (status === "validated") {
    return figureText(responseLanguage, "这张图已经通过当前图检查，可以进入 review。", "This figure passed the current-figure checks and is ready for review.");
  }
  if (status === "qa-needs-attention") {
    return figureText(responseLanguage, `这张图已经导入，但当前图还有 ${figureQa.issueCount} 个需要修的问题。`, `This figure was imported, but it still has ${figureQa.issueCount} review issue(s) to handle first.`);
  }
  if (status === "blocked-missing-materials") {
    return missing
      ? figureText(responseLanguage, `这张图还缺材料：${missing}。`, `This figure is still missing materials: ${missing}.`)
      : figureText(responseLanguage, "这张图还缺材料，暂时不能继续生成或导入。", "This figure is missing materials, so generation or import cannot continue yet.");
  }
  if (prepared.providerExecution?.status === "missing-secret-env") {
    return figureText(responseLanguage, `这张图还不能调用画图服务，缺少 ${apiKeyEnv}；也可以先走手工 SVG 导入。`, `This figure cannot call the drawing provider yet because ${apiKeyEnv} is missing; manual SVG import is still available.`);
  }
  if (prepared.providerExecution?.status === "failed") {
    return figureText(responseLanguage, "这张图的画图服务生成失败了；可以修好服务后重试，也可以直接导入手工 SVG。", "Drawing-provider generation failed for this figure; fix the provider and retry, or import a manual SVG.");
  }
  if (!imported) {
    return figureText(responseLanguage, "这张图的计划和材料包已经准备好，还缺 SVG 输出。", "This figure has its plan and material bundle ready, but still needs SVG output.");
  }
  return figureText(responseLanguage, "这张图已经更新。", "This figure was updated.");
}

function figureResultNextTitle(status, { prepared, responseLanguage }) {
  const missing = normalizeStringArray(prepared.missingRequirementIds).join("、");
  if (status === "validated") {
    return figureText(responseLanguage, "把这张图送入 review", "Send this figure to review");
  }
  if (status === "qa-needs-attention") {
    return figureText(responseLanguage, "先处理当前这张图需要修的问题", "Handle this figure's review issues first");
  }
  if (status === "blocked-missing-materials") {
    return missing
      ? figureText(responseLanguage, `先补这张图的材料：${missing}`, `Provide this figure's missing materials: ${missing}`)
      : figureText(responseLanguage, "先补这张图缺的材料", "Provide this figure's missing materials first");
  }
  if (prepared.providerExecution?.status === "missing-secret-env") {
    const apiKeyEnv = prepared.providerExecution?.apiKeyEnv ?? prepared.providerReadiness?.apiKeyEnv ?? "provider API key";
    return figureText(responseLanguage, `配置 ${apiKeyEnv}，或改用手工 SVG 导入`, `Configure ${apiKeyEnv}, or use manual SVG import`);
  }
  if (prepared.providerExecution?.status === "failed") {
    return figureText(responseLanguage, "修好画图服务后重试，或直接导入手工 SVG", "Fix the drawing provider and retry, or import a manual SVG");
  }
  return figureText(responseLanguage, "提供 SVG 输出后再导入", "Provide SVG output and import it");
}

function buildFigureResultCard({ status, figureId, runId, target, boundary, prepared, imported, figureQa, responseLanguage, writesApplied = true }) {
  const actionCommand = boundary?.nextAction ?? (status === "validated" ? "project:dove.review" : "project:dove.figure");
  const card = buildCommandResultCard({
    surface: "dove.figure",
    command: "run_figure_workflow",
    packetId: target.packetId,
    runId,
    title: figureText(responseLanguage, "图表工作流结果", "Figure workflow result"),
    status,
    outcome: boundary?.type ?? status,
    happened: figureResultHappened(status, { figureId, prepared, figureQa, imported, responseLanguage }),
    durableWrites: !writesApplied || (status === "blocked-missing-materials" && boundary?.detail?.implementationBoundaryType === "missing-figure-materials-before-plan")
      ? []
      : imported
        ? [figureText(responseLanguage, "已更新图表计划、caption provenance 和当前图检查状态。", "Updated the figure plan, caption provenance, and this figure's check state.")]
        : [figureText(responseLanguage, "已更新图表计划和生成材料包。", "Updated the figure plan and generation material bundle.")],
    boundary,
    scope: compactObject({ kind: "figure", figureId, packetId: target.packetId }),
    nextActions: [{
      title: figureResultNextTitle(status, { prepared, responseLanguage }),
      why: boundary?.reason,
      command: actionCommand,
      boundary,
      boundaryType: boundary?.type,
      requiredInputs: boundary?.requiredInputs,
      requiredActions: boundary?.requiredActions,
      ownerRole: boundary?.ownerRole,
      nextRole: boundary?.nextRole
    }]
  }, responseLanguage);
  delete card.evidence;
  delete card.validation;
  delete card.codeChanges;
  return card;
}

export function runFigureWorkflow(root, args = {}) {
  assertGovernanceMutationRegistered("run-figure-workflow", "guarded");
  assertFigurePublicInput(args);
  const target = assertTaskScopedMutationTarget(root, "run-figure-workflow", args);
  assertNoLegacyFinalSvgInput(args, "run_figure_workflow");
  const { env: _env, svgContent: _svgContent, ...safeArgs } = args;
  assertNoInlineSecrets(safeArgs, "figureWorkflow.args");

  const { figureId, item, items } = buildFigureItem(root, args, target);
  const runId = slugify(args.runId ?? `${figureId}-run`);
  if (figureNeedsPrePlanMaterialBoundary(args, item)) {
    const responseLanguage = resolveDoveResponseLanguage(root, args);
    const boundary = prePlanFigureBoundary(figureId, runId);
    const prepared = { missingRequirementIds: boundary.requiredInputs, materialStatus: "needs-materials", providerExecution: null };
    const figureQa = { issueCount: 0, workspaceIssueCount: 0, qaPath: null };
    const resultCard = buildFigureResultCard({
      status: "blocked-missing-materials",
      figureId,
      runId,
      target,
      boundary,
      prepared,
      imported: null,
      figureQa,
      responseLanguage
    });
    return {
      status: "blocked-missing-materials",
      resultCard,
      figureId,
      runId,
      packetId: target.packetId,
      boundary,
      boundaryType: boundary.type,
      requiredActions: boundary.requiredActions,
      artifactRefs: [],
      validationEvidencePaths: [],
      nextAction: boundary.nextAction,
      plan: null,
      stageFiles: { templateCreated: false, editableCreated: false },
      materialStatus: "needs-materials",
      missingRequirementIds: boundary.requiredInputs,
      imported: null,
      validation: null,
      figureQa,
      diagnostics: { providerReadiness: null, providerExecution: null, prepared: null },
      captionId: null,
      finalSvgPath: null,
      qaIssueCount: 0,
      workspaceQaIssueCount: 0,
      qaPath: null
    };
  }
  assertFollowThroughReady(root, "Running the figure workflow", args);
  ensureWorkspace(root);
  const plan = upsertFigurePlan(root, { packetId: target.packetId, items });
  const stageFiles = ensureStageSvgFiles(root, item);
  const executeProvider = args.executeProvider === true;
  const prepared = prepareFigureGeneration(root, {
    packetId: target.packetId,
    figureId,
    runId,
    providerId: args.providerId,
    constraints: args.constraints,
    outputFormat: args.outputFormat,
    ...(Object.hasOwn(args, "materialHints") ? { materialHints: args.materialHints } : {}),
    executeProvider,
    allowMissingMaterials: args.allowMissingMaterials,
    env: args.env
  });

  let imported = null;
  if (hasImportableOutput(args, prepared)) {
    imported = importFigureGeneration(root, {
      packetId: target.packetId,
      figureId,
      runId: prepared.runId,
      outputManifestPath: args.outputManifestPath,
      caption: args.caption,
      captionDraft: args.captionDraft,
      captionId: args.captionId,
      sourceSvgPath: args.sourceSvgPath,
      svgContent: args.svgContent,
      ...(Object.hasOwn(args, "semanticCoverage") ? { semanticCoverage: args.semanticCoverage } : {}),
      ...(Object.hasOwn(args, "semanticReview") ? { semanticReview: args.semanticReview } : {}),
      env: args.env
    });
  }

  const validation = validateFigurePipeline(root);
  const figureQa = summarizeFigureQa(root, figureId, validation);
  const status = statusFor(prepared, imported, figureQa);
  const artifactRefs = figureArtifactRefs(validation);
  const validationEvidencePaths = figureValidationEvidencePaths(figureQa);
  const boundary = figureBoundaryFor(status, prepared, validation, figureQa, figureId, prepared.runId);
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  const resultCard = buildFigureResultCard({ status, figureId, runId: prepared.runId, target, boundary, prepared, imported, figureQa, responseLanguage, writesApplied: !isPatchPlanMode(root) });
  const preActionGuidance = buildPreActionGuidance({
    surface: "dove.figure",
    responseLanguage,
    request: firstText(args.intent, args.description, args.summary, args.purpose, args.captionIntent, args.name, args.title),
    roleId: "builder",
    packet: target.packet,
    currentContext: {
      domain: target.packet?.domain ?? null,
      stage: target.packet?.stage ?? "execute",
      primaryRole: "builder"
    },
    operatorLessons: readJson(root, ARTIFACT_PATHS.metaOperatorLessons, { lessons: [] }),
    nextAction: boundary?.nextAction ?? (imported ? "project:dove.review" : "project:dove.figure"),
    routeHint: "project:dove.figure",
    workflowKind: "figure",
    domain: target.packet?.domain ?? null,
    stage: target.packet?.stage ?? "execute",
    tags: ["figure", "artifact-provenance", "qa"],
    statusSummary: {
      status,
      materialStatus: prepared.materialStatus,
      missingRequirementCount: prepared.missingRequirementIds?.length ?? 0,
      qaIssueCount: figureQa.issueCount,
      workspaceQaIssueCount: figureQa.workspaceIssueCount,
      imported: Boolean(imported)
    }
  });
  return {
    status,
    resultCard,
    preActionGuidance,
    figureId,
    runId: prepared.runId,
    packetId: target.packetId,
    boundary,
    boundaryType: boundary?.type ?? null,
    requiredActions: boundary?.requiredActions ?? [],
    artifactRefs,
    validationEvidencePaths,
    nextAction: boundary?.nextAction ?? (imported ? "project:dove.review" : "project:dove.figure"),
    plan,
    stageFiles,
    materialStatus: prepared.materialStatus,
    missingRequirementIds: prepared.missingRequirementIds,
    imported,
    validation,
    figureQa,
    diagnostics: {
      providerReadiness: prepared.providerReadiness,
      providerExecution: prepared.providerExecution,
      prepared
    },
    captionId: imported?.captionId ?? null,
    finalSvgPath: imported?.finalSvgPath ?? null,
    qaIssueCount: figureQa.issueCount,
    workspaceQaIssueCount: figureQa.workspaceIssueCount,
    qaPath: figureQa.qaPath
  };
}
