import fs from "node:fs";
import path from "node:path";

import { ARTIFACT_PATHS } from "./schema.mjs";
import { assertNoInlineSecrets } from "./config.mjs";
import { importFigureGeneration, prepareFigureGeneration } from "./figure-generation.mjs";
import { resolveDoveResponseLanguage } from "./i18n.mjs";
import { assertTaskScopedMutationTarget } from "./mutation-guard.mjs";
import { isPatchPlanMode } from "./mutation-backend.mjs";
import { buildPreActionGuidance } from "./pre-action-guidance.mjs";
import { upsertFigurePlan, validateFigurePipeline } from "./artifacts.mjs";
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
    finalSvgPath: args.figureFinalSvgPath ?? existing?.finalSvgPath ?? `.dove/figures/${figureId}.final.svg`,
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
    args.finalSvgPath ||
    args.outputManifestPath ||
    prepared.providerExecution?.status === "completed"
  );
}

function statusFor(prepared, imported, validation) {
  if (["missing-secret-env", "failed"].includes(prepared.providerExecution?.status)) {
    return "blocked-boundary";
  }
  if (imported) {
    return validation.issueCount === 0 ? "validated" : "qa-needs-attention";
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

function figureBoundaryFor(status, prepared, validation, figureId, runId) {
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
      requiredInputs: normalizeStringArray([...providerRequiredInputs, "finalSvgPath-or-outputManifestPath-or-svgContent"]),
      requiredActions: normalizeStringArray([...providerRequiredActions, "run-provider-or-import-output", "provide-final-svg-or-output-manifest"]),
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
      reason: `Figure ${figureId} has ${validation.issueCount} QA issue(s) requiring review.`,
      requiredInputs: [validation.qaPath],
      requiredActions: ["review-figure-qa", "resolve-figure-qa-issues"],
      artifactRefs,
      nextAction: "project:dove.review",
      ownerRole: "builder",
      nextRole: "reviewer",
      detail: { implementationBoundaryType: "needs-review" }
    };
  }
  return null;
}

export function runFigureWorkflow(root, args = {}) {
  assertGovernanceMutationRegistered("run-figure-workflow", "guarded");
  const target = assertTaskScopedMutationTarget(root, "run-figure-workflow", args);
  assertFollowThroughReady(root, "Running the figure workflow", args);
  ensureWorkspace(root);
  const { env: _env, svgContent: _svgContent, ...safeArgs } = args;
  assertNoInlineSecrets(safeArgs, "figureWorkflow.args");

  const { figureId, item, items } = buildFigureItem(root, args, target);
  const plan = upsertFigurePlan(root, { packetId: target.packetId, items });
  const stageFiles = ensureStageSvgFiles(root, item);
  const runId = slugify(args.runId ?? `${figureId}-run`);
  const executeProvider = args.executeProvider === true;
  const prepared = prepareFigureGeneration(root, {
    packetId: target.packetId,
    figureId,
    runId,
    providerId: args.providerId,
    constraints: args.constraints,
    outputFormat: args.outputFormat,
    materialHints: args.materialHints,
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
      finalSvgPath: args.finalSvgPath,
      svgContent: args.svgContent,
      semanticCoverage: args.semanticCoverage,
      semanticReview: args.semanticReview,
      env: args.env
    });
  }

  const validation = validateFigurePipeline(root);
  const status = statusFor(prepared, imported, validation);
  const artifactRefs = figureArtifactRefs(validation);
  const validationEvidencePaths = figureValidationEvidencePaths(validation);
  const boundary = figureBoundaryFor(status, prepared, validation, figureId, prepared.runId);
  const preActionGuidance = buildPreActionGuidance({
    surface: "dove.figure",
    responseLanguage: resolveDoveResponseLanguage(root, args),
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
      qaIssueCount: validation.issueCount,
      imported: Boolean(imported)
    }
  });
  return {
    status,
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
    diagnostics: {
      providerReadiness: prepared.providerReadiness,
      providerExecution: prepared.providerExecution,
      prepared
    },
    captionId: imported?.captionId ?? null,
    finalSvgPath: imported?.finalSvgPath ?? null,
    qaIssueCount: validation.issueCount,
    qaPath: validation.qaPath
  };
}
