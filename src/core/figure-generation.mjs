import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ARTIFACT_PATHS } from "./schema.mjs";
import { assertNoInlineSecrets, createGptImage2FigureProvider, loadFigureGenerationConfig, redactDoveConfig } from "./config.mjs";
import { resolveDoveResponseLanguage } from "./i18n.mjs";
import { assertTaskScopedMutationTarget } from "./mutation-guard.mjs";
import { isPatchPlanMode } from "./mutation-backend.mjs";
import { refreshDurableSurfaces } from "./navigation.mjs";
import { buildPreActionGuidance, summarizePreActionGuidance } from "./pre-action-guidance.mjs";
import { summarizeFigureQa, validateFigurePipeline } from "./artifacts.mjs";
import { inspectDeclaredPath } from "./artifact-integrity.mjs";
import {
  assertFollowThroughReady,
  assertGovernanceMutationRegistered,
  ensureDir,
  ensureWorkspace,
  nowIso,
  readJson,
  readText,
  resolvePath,
  writeJson,
  writeText
} from "./workspace.mjs";

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function normalizeStringArray(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  return Array.from(new Set(source.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())));
}

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeSemanticCoverage(value) {
  const source = normalizePlainObject(value);
  if (!source) {
    return null;
  }
  return {
    ...source,
    visualElements: normalizeStringArray(source.visualElements),
    coveredVisualElements: normalizeStringArray(source.coveredVisualElements),
    evidencePaths: normalizeStringArray(source.evidencePaths),
    artifactPaths: normalizeStringArray(source.artifactPaths)
  };
}

function normalizeSemanticReview(value) {
  const source = normalizePlainObject(value);
  if (!source) {
    return null;
  }
  return {
    ...source,
    status: typeof source.status === "string" ? source.status.trim() : source.status,
    evidencePaths: normalizeStringArray(source.evidencePaths),
    artifactPaths: normalizeStringArray(source.artifactPaths)
  };
}

function figureGenerationGuidanceSummary(root, args = {}, target = {}, details = {}) {
  return summarizePreActionGuidance(buildPreActionGuidance({
    surface: "dove.figure",
    responseLanguage: resolveDoveResponseLanguage(root, args),
    request: args.intent ?? args.description ?? args.caption ?? args.captionDraft ?? args.figureId ?? args.id ?? null,
    roleId: "builder",
    packet: target.packet,
    currentContext: {
      domain: target.packet?.domain ?? null,
      stage: target.packet?.stage ?? "execute",
      primaryRole: "builder"
    },
    operatorLessons: readJson(root, ARTIFACT_PATHS.metaOperatorLessons, { lessons: [] }),
    nextAction: details.nextAction ?? "project:dove.figure",
    routeHint: details.nextAction ?? "project:dove.figure",
    workflowKind: "figure",
    domain: target.packet?.domain ?? null,
    stage: target.packet?.stage ?? "execute",
    tags: ["figure", "artifact-provenance", "qa"],
    statusSummary: details.statusSummary
  }));
}

function normalizeRelativePath(value, fallback = null) {
  const source = typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
  if (!source) {
    return null;
  }
  return path.posix.normalize(String(source).replace(/\\/g, "/").replace(/^\.\//, ""));
}

function isSafeProjectRelativePath(relativePath) {
  if (!relativePath || path.posix.isAbsolute(relativePath)) {
    return false;
  }
  const normalized = path.posix.normalize(relativePath);
  return normalized !== ".." && !normalized.startsWith("../");
}

function assertSafeFigurePath(relativePath, label, allowedPrefixes = [".dove/figures/"]) {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized || !isSafeProjectRelativePath(normalized) || !allowedPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error(`${label} must stay under ${allowedPrefixes.join(" or ")}: ${relativePath ?? "<missing>"}`);
  }
  return normalized;
}

function assertNoLegacyFinalSvgInput(value, label) {
  if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "finalSvgPath")) {
    throw new Error(`${label} no longer accepts finalSvgPath as input; use sourceSvgPath for generated SVG input or targetFinalSvgPath for the final artifact target.`);
  }
}

function assertNoLegacyProviderOutputFields(value, label) {
  for (const field of ["finalSvgPath", "finalSvgContent", "svg"]) {
    if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, field)) {
      throw new Error(`${label} must use sourceSvgPath or svgContent; ${field} is not accepted.`);
    }
  }
}

function assertSafeFigureSourcePath(relativePath, label, runId) {
  return assertSafeFigurePath(relativePath, label, [`${generationRunDir(runId)}/`]);
}

function assertSafeFigureFinalTargetPath(relativePath, label) {
  const normalized = assertSafeFigurePath(relativePath, label);
  if (normalized.startsWith(".dove/figures/runs/")) {
    throw new Error(`${label} must be a final figure artifact outside .dove/figures/runs/: ${relativePath ?? "<missing>"}`);
  }
  return normalized;
}

function generationRunDir(runId) {
  return `.dove/figures/runs/${runId}`;
}

function defaultRunId(figureId) {
  return slugify(`${figureId}-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`);
}

function readFigures(root) {
  return readJson(root, ARTIFACT_PATHS.figuresIndex, { version: 1, items: [], updatedAt: null });
}

function resolveFigure(root, args = {}) {
  const figures = readFigures(root);
  const rawFigureId = args.figureId ?? args.id;
  const figureId = rawFigureId ? slugify(rawFigureId) : null;
  if (!figureId && (figures.items ?? []).length !== 1) {
    throw new Error("Figure generation requires figureId when the figure backlog does not contain exactly one item.");
  }
  const figure = figureId
    ? (figures.items ?? []).find((item) => item.id === figureId)
    : (figures.items ?? [])[0];
  if (!figure) {
    throw new Error(`Figure generation target not found in ${ARTIFACT_PATHS.figuresIndex}: ${figureId}`);
  }
  return { figures, figure };
}

function findById(items = [], id) {
  return items.find((item) => item.id === id || item.citationKey === id || item.experimentId === id);
}

function materialRequirement({ type, refId, label, status, artifactPath = null, summary = "", source = "dove", evidence = {} }) {
  return {
    id: slugify(`${type}-${refId ?? label}`),
    type,
    refId: refId ?? null,
    label: label ?? refId ?? type,
    status,
    artifactPath,
    summary,
    source,
    evidence
  };
}

function materialInspection(root, artifactPath) {
  const normalized = normalizeRelativePath(artifactPath);
  if (!normalized) {
    return { normalized, inspection: null, available: false, reason: "missing artifact path" };
  }
  const inspection = inspectDeclaredPath(root, normalized, {
    requireNonEmpty: true,
    rejectBookkeeping: true
  });
  return {
    normalized,
    inspection,
    available: inspection.status === "existing",
    reason: inspection.reason ?? inspection.status
  };
}

function sourceArtifactRequirement(root, artifactPath, index) {
  const inspected = materialInspection(root, artifactPath);
  return materialRequirement({
    type: "source-artifact",
    refId: inspected.normalized ?? `source-artifact-${index + 1}`,
    label: inspected.normalized ?? `Source artifact ${index + 1}`,
    status: inspected.available ? "available" : "missing",
    artifactPath: inspected.normalized,
    summary: inspected.available ? "Source artifact is present and non-empty." : `Source artifact is not usable: ${inspected.reason}.`,
    evidence: { inspection: inspected.inspection }
  });
}

function buildMaterialRequirements(root, figure, args = {}) {
  const state = readJson(root, ARTIFACT_PATHS.state, { sections: {} });
  const sources = readJson(root, ARTIFACT_PATHS.sources, { version: 1, items: [], updatedAt: null });
  const notes = readJson(root, ARTIFACT_PATHS.notes, { version: 1, items: [], updatedAt: null });
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null });
  const experimentPlans = readJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null });
  const experimentResults = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  const reviewConcerns = readJson(root, ARTIFACT_PATHS.reviewConcerns, { version: 2, items: [], updatedAt: null });
  const rebuttalIssues = readJson(root, ARTIFACT_PATHS.rebuttalIssues, { version: 1, items: [], updatedAt: null });
  const requirements = [];
  const linkedClaimIds = normalizeStringArray(figure.targetClaimIds);
  const linkedClaims = linkedClaimIds.map((claimId) => findById(evidence.claims ?? [], claimId));
  const sourceIds = normalizeStringArray(linkedClaims.flatMap((claim) => claim?.sourceIds ?? []));
  const noteIds = normalizeStringArray(linkedClaims.flatMap((claim) => claim?.noteIds ?? []));
  const experimentIds = normalizeStringArray([...(figure.relatedExperimentIds ?? []), ...linkedClaims.flatMap((claim) => claim?.experimentIds ?? [])]);

  for (const sectionId of normalizeStringArray(figure.sourceSections)) {
    const section = state.sections?.[sectionId];
    requirements.push(materialRequirement({
      type: "section",
      refId: sectionId,
      label: section?.title ?? sectionId,
      status: section ? "available" : "missing",
      artifactPath: section?.draftPath ?? null,
      summary: section?.summary ?? (section ? "Section metadata is available." : "Linked source section is missing from state."),
      evidence: { sectionStatus: section?.status ?? null }
    }));
  }

  for (const [index, artifactPath] of normalizeStringArray(figure.sourceArtifactPaths).entries()) {
    requirements.push(sourceArtifactRequirement(root, artifactPath, index));
  }

  for (const claimId of linkedClaimIds) {
    const claim = findById(evidence.claims ?? [], claimId);
    requirements.push(materialRequirement({
      type: "claim",
      refId: claimId,
      label: claim?.text ?? claimId,
      status: claim ? "available" : "missing",
      artifactPath: ARTIFACT_PATHS.evidence,
      summary: claim?.gap ?? claim?.status ?? (claim ? "Claim is available." : "Linked target claim is missing."),
      evidence: { sourceIds: claim?.sourceIds ?? [], noteIds: claim?.noteIds ?? [], experimentIds: claim?.experimentIds ?? [] }
    }));
  }

  for (const sourceId of sourceIds) {
    const source = findById(sources.items ?? [], sourceId);
    requirements.push(materialRequirement({
      type: "source",
      refId: sourceId,
      label: source?.title ?? sourceId,
      status: source ? "available" : "missing",
      artifactPath: ARTIFACT_PATHS.sources,
      summary: source?.abstract ?? (source ? "Source metadata is available." : "Claim-linked source is missing."),
      evidence: { citationKey: source?.citationKey ?? null, sourceType: source?.sourceType ?? null }
    }));
  }

  for (const noteId of noteIds) {
    const note = findById(notes.items ?? [], noteId);
    requirements.push(materialRequirement({
      type: "note",
      refId: noteId,
      label: note?.title ?? noteId,
      status: note ? "available" : "missing",
      artifactPath: ARTIFACT_PATHS.notes,
      summary: note?.summary ?? (note ? "Note is available." : "Claim-linked note is missing."),
      evidence: { sourceIds: note?.sourceIds ?? [], sectionId: note?.sectionId ?? null }
    }));
  }

  for (const experimentId of experimentIds) {
    const plan = findById(experimentPlans.items ?? [], experimentId);
    const results = (experimentResults.items ?? []).filter((result) => result.experimentId === experimentId || result.id === experimentId);
    requirements.push(materialRequirement({
      type: "experiment",
      refId: experimentId,
      label: plan?.title ?? experimentId,
      status: plan || results.length > 0 ? "available" : "missing",
      artifactPath: ARTIFACT_PATHS.experimentResults,
      summary: results[0]?.summary ?? plan?.methodology ?? (plan ? "Experiment plan is available." : "Linked experiment is missing."),
      evidence: { planId: plan?.id ?? null, resultIds: results.map((result) => result.id) }
    }));
  }

  for (const concernId of normalizeStringArray(figure.reviewConcernIds)) {
    const concern = findById(reviewConcerns.items ?? [], concernId);
    requirements.push(materialRequirement({
      type: "review-concern",
      refId: concernId,
      label: concern?.summary ?? concernId,
      status: concern ? "available" : "missing",
      artifactPath: ARTIFACT_PATHS.reviewConcerns,
      summary: concern?.reviewerRationale ?? (concern ? "Review concern is available." : "Linked review concern is missing.")
    }));
  }

  for (const issueId of normalizeStringArray(figure.rebuttalIssueIds)) {
    const issue = findById(rebuttalIssues.items ?? [], issueId);
    requirements.push(materialRequirement({
      type: "rebuttal-issue",
      refId: issueId,
      label: issue?.summary ?? issueId,
      status: issue ? "available" : "missing",
      artifactPath: ARTIFACT_PATHS.rebuttalIssues,
      summary: issue?.responseDirection ?? (issue ? "Rebuttal issue is available." : "Linked rebuttal issue is missing.")
    }));
  }

  for (const visualElement of normalizeStringArray(figure.requiredVisualElements)) {
    requirements.push(materialRequirement({
      type: "visual-element",
      refId: visualElement,
      label: visualElement,
      status: "available",
      summary: "Visual element is declared as a drawing instruction in the figure plan.",
      source: "figure-plan"
    }));
  }

  for (const requirement of Array.isArray(figure.materialRequirements) ? figure.materialRequirements : []) {
    const inspected = materialInspection(root, requirement.artifactPath ?? requirement.path);
    requirements.push(materialRequirement({
      type: requirement.type ?? "operator-material",
      refId: requirement.id ?? requirement.label,
      label: requirement.label ?? requirement.id ?? "Operator material",
      status: inspected.normalized ? (inspected.available ? "available" : "missing") : (requirement.status ?? "needs-operator"),
      artifactPath: inspected.normalized,
      summary: requirement.summary ?? (inspected.available ? "Operator-declared material artifact is present and non-empty." : `Operator-declared material is not usable: ${inspected.reason}.`),
      source: "figure-plan",
      evidence: { inspection: inspected.inspection }
    }));
  }

  const hints = Array.isArray(args.materialHints) ? args.materialHints : [];
  for (let index = 0; index < hints.length; index += 1) {
    const hint = hints[index];
    if (typeof hint === "string") {
      requirements.push(materialRequirement({ type: "operator-hint", refId: `hint-${index + 1}`, label: hint, status: "available", summary: hint, source: "operator" }));
    } else if (hint && typeof hint === "object") {
      const inspected = materialInspection(root, hint.artifactPath ?? hint.path);
      requirements.push(materialRequirement({
        type: hint.type ?? "operator-hint",
        refId: hint.id ?? `hint-${index + 1}`,
        label: hint.label ?? hint.summary ?? `Hint ${index + 1}`,
        status: inspected.normalized ? (inspected.available ? "available" : "missing") : (hint.status ?? "available"),
        artifactPath: inspected.normalized,
        summary: hint.summary ?? hint.label ?? (inspected.available ? "Operator-provided material artifact is present and non-empty." : `Operator-provided material is not usable: ${inspected.reason}.`),
        source: "operator",
        evidence: { inspection: inspected.inspection }
      }));
    }
  }

  const byId = new Map();
  for (const requirement of requirements) {
    byId.set(requirement.id, requirement);
  }
  return Array.from(byId.values());
}

function providerIdIsNone(value) {
  return typeof value === "string" && value.trim().toLowerCase() === "none";
}

function providerIdIsGptImage2(value) {
  return typeof value === "string" && value.trim().toLowerCase().replace(/[-_]/g, "") === "gptimage2";
}

function normalizeProviderId(value) {
  if (typeof value !== "string") {
    return value ?? null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function selectedProviderIdFor(config, providerId) {
  if (providerIdIsNone(providerId)) {
    return null;
  }
  const explicitProviderId = normalizeProviderId(providerId);
  if (explicitProviderId) {
    return explicitProviderId;
  }
  return providerIdIsNone(config.defaultProviderId) ? null : normalizeProviderId(config.defaultProviderId);
}

function selectProvider(config, providerId, env) {
  const selectedProviderId = selectedProviderIdFor(config, providerId);
  const provider = selectedProviderId
    ? config.providers.find((item) => item.id === selectedProviderId) ?? (providerIdIsGptImage2(selectedProviderId) ? createGptImage2FigureProvider() : null)
    : null;
  if (selectedProviderId && !provider) {
    throw new Error(`Unknown figure generation provider: ${selectedProviderId}`);
  }
  if (!provider) {
    return {
      provider: null,
      readiness: {
        status: "not-configured",
        summary: "No figure generation provider is configured; use the prompt/input bundle with an external drawing tool, then import its output."
      }
    };
  }
  const secretConfigured = provider.apiKeyEnv ? Boolean(env[provider.apiKeyEnv]) : true;
  return {
    provider,
    readiness: {
      status: secretConfigured ? "ready" : "missing-secret-env",
      summary: secretConfigured ? `Provider ${provider.id} is configured.` : `Provider ${provider.id} requires environment variable ${provider.apiKeyEnv}.`,
      apiKeyEnv: provider.apiKeyEnv ?? null,
      apiKeyEnvConfigured: secretConfigured
    }
  };
}

function providerRequestSummary(provider, readiness) {
  if (!provider) {
    return { providerId: null, providerType: null, readiness };
  }
  return {
    providerId: provider.id,
    providerType: provider.type,
    endpoint: provider.endpoint ?? null,
    command: provider.command ?? null,
    model: provider.model ?? null,
    imageSize: provider.imageSize ?? null,
    imageQuality: provider.imageQuality ?? null,
    imageBackground: provider.imageBackground ?? null,
    timeoutMs: provider.timeoutMs,
    maxPromptChars: provider.maxPromptChars,
    maxSvgBytes: provider.maxSvgBytes,
    secret: provider.apiKeyEnv ? { apiKeyEnv: provider.apiKeyEnv, configured: readiness.apiKeyEnvConfigured } : null,
    readiness
  };
}

function buildGenerationPrompt({ figure, packet, requirements, constraints, outputFormat, provider }) {
  const lines = [
    `# Figure generation request: ${figure.name ?? figure.id}`,
    "",
    "## Purpose",
    figure.purpose ?? figure.narrativeIntent ?? "Explain the linked paper evidence clearly.",
    "",
    "## Caption intent",
    figure.captionIntent ?? figure.narrativeIntent ?? figure.purpose ?? "Explain what the figure shows and why it matters.",
    "",
    "## Durable task packet",
    `- Packet id: ${packet.id}`,
    `- Packet title: ${packet.title ?? packet.id}`,
    `- Current focus: ${packet.currentFocus ?? "none"}`,
    "",
    "## Required output",
    `- Format: ${outputFormat}`,
    `- Dove final artifact target: ${figure.finalSvgPath}`,
    "- Return an output manifest with sourceSvgPath and caption, or return svgContent so Dove can import it into the final artifact target.",
    "",
    "## Visual elements",
    ...(normalizeStringArray(figure.requiredVisualElements).length > 0 ? normalizeStringArray(figure.requiredVisualElements).map((item) => `- ${item}`) : ["- No visual elements declared yet; infer a minimal evidence-linked figure from the materials."]),
    "",
    "## Materials",
    ...requirements.map((item) => `- [${item.status}] ${item.type}:${item.refId ?? item.id} — ${item.label}${item.artifactPath ? ` (${item.artifactPath})` : ""}. ${item.summary}`),
    "",
    "## Constraints",
    ...(constraints.length > 0 ? constraints.map((item) => `- ${item}`) : ["- Keep labels editable and avoid unsupported visual claims.", "- Use only the provided evidence and mark missing information visibly."]),
    "",
    "## Provider hint",
    provider ? `Use provider ${provider.id} (${provider.type})${provider.model ? ` with model ${provider.model}` : ""}.` : "No provider is configured; this prompt is provider-neutral."
  ];
  return `${lines.join("\n")}\n`;
}

function truncatePrompt(prompt, maxChars) {
  if (prompt.length <= maxChars) {
    return prompt;
  }
  return `${prompt.slice(0, Math.max(0, maxChars - 80))}\n\n[Prompt truncated to fit configured maxPromptChars.]\n`;
}

function updateIndexItem(index, item) {
  const items = Array.isArray(index.items) ? index.items : [];
  return {
    ...index,
    items: [...items.filter((existing) => existing.id !== item.id), item],
    updatedAt: item.updatedAt ?? nowIso()
  };
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function svgSafetyIssues(content, maxSvgBytes) {
  const issues = [];
  if (Buffer.byteLength(content, "utf8") > maxSvgBytes) {
    issues.push(`SVG exceeds maxSvgBytes (${maxSvgBytes}).`);
  }
  if (!/^\s*(?:<\?xml\s[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(content)) {
    issues.push("Generated output must be an SVG document.");
  }
  const checks = [
    [/<script\b/i, "SVG must not contain script elements."],
    [/\son[a-z]+\s*=/i, "SVG must not contain inline event handlers."],
    [/<foreignObject\b/i, "SVG must not contain foreignObject."],
    [/(?:href|xlink:href)\s*=\s*["']\s*(?:[a-z][a-z0-9+.-]*:|\/\/)/i, "SVG must not reference remote, javascript, data, file, or other URL schemes."],
    [/url\(\s*["']?(?:[a-z][a-z0-9+.-]*:|\/\/)/i, "SVG must not reference remote, javascript, data, file, or other URL resources."]
  ];
  for (const [pattern, message] of checks) {
    if (pattern.test(content)) {
      issues.push(message);
    }
  }
  return issues;
}

function readOutputManifest(root, runId, outputManifestPath, outputDefaults = {}) {
  const defaultPath = `${generationRunDir(runId)}/output.json`;
  const manifestPath = assertSafeFigurePath(outputManifestPath ?? defaultPath, "outputManifestPath", [generationRunDir(runId), ".dove/figures/"]);
  const inspection = inspectDeclaredPath(root, manifestPath, { requireNonEmpty: true });
  if (inspection.status === "existing") {
    return { manifestPath, manifest: readJson(root, manifestPath, {}) };
  }
  if (inspection.status !== "missing") {
    throw new Error(`Figure output manifest is not a usable file at ${manifestPath}: ${inspection.reason ?? inspection.status}`);
  }
  const manifest = { ...outputDefaults, runId, generatedAt: nowIso() };
  writeJson(root, manifestPath, manifest);
  return { manifestPath, manifest };
}

function assertManifestHasNoInlineSecrets(root, manifestPath, manifest, label) {
  try {
    assertNoInlineSecrets(manifest, label);
  } catch (error) {
    writeJson(root, manifestPath, redactDoveConfig(manifest));
    throw error;
  }
}

function parseProviderOutput(rawOutput) {
  if (rawOutput && typeof rawOutput === "object") {
    return rawOutput;
  }
  const text = String(rawOutput ?? "").trim();
  if (!text) {
    return null;
  }
  if (text.startsWith("{")) {
    return JSON.parse(text);
  }
  if (text.startsWith("<svg")) {
    return { svgContent: text };
  }
  throw new Error("Figure provider returned neither JSON nor SVG output.");
}

function writeProviderOutput(root, runId, providerOutput, timestamp) {
  const output = parseProviderOutput(providerOutput);
  if (!output) {
    const defaultManifestPath = `${generationRunDir(runId)}/output.json`;
    if (fs.existsSync(resolvePath(root, defaultManifestPath))) {
      const manifest = readJson(root, defaultManifestPath, {});
      assertManifestHasNoInlineSecrets(root, defaultManifestPath, manifest, "figureGeneration.providerOutputManifest");
      return { outputManifestPath: defaultManifestPath, manifest };
    }
    throw new Error("Figure provider did not return output and did not write output.json.");
  }
  assertNoInlineSecrets(output, "figureGeneration.providerOutput");
  assertNoLegacyProviderOutputFields(output, "figureGeneration.providerOutput");
  const outputManifestPath = assertSafeFigurePath(output.outputManifestPath ?? `${generationRunDir(runId)}/output.json`, "provider output manifest", [`${generationRunDir(runId)}/`]);
  const svgContent = output.svgContent;
  const sourceSvgPath = assertSafeFigureSourcePath(output.sourceSvgPath ?? output.svgPath ?? `${generationRunDir(runId)}/final.svg`, "provider source SVG path", runId);
  const manifest = { ...output, runId, sourceSvgPath, generatedAt: output.generatedAt ?? timestamp };
  delete manifest.svgContent;
  if (typeof svgContent === "string" && svgContent.trim()) {
    writeText(root, sourceSvgPath, svgContent.endsWith("\n") ? svgContent : `${svgContent}\n`);
  }
  writeJson(root, outputManifestPath, manifest);
  return { outputManifestPath, manifest };
}

function assertSpawnSucceeded(result, label, timeoutMs) {
  if (result.error) {
    const message = result.error?.code === "ETIMEDOUT" ? `${label} timed out after ${timeoutMs}ms.` : result.error.message;
    throw new Error(message);
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status}: ${String(result.stderr ?? "").slice(0, 1000)}`);
  }
}

function invokeExternalCommandProvider(root, provider, inputPath, runId, timestamp) {
  const result = spawnSync(provider.command, [resolvePath(root, inputPath)], {
    cwd: root,
    encoding: "utf8",
    timeout: provider.timeoutMs,
    maxBuffer: provider.maxSvgBytes * 2 + 100000
  });
  assertSpawnSucceeded(result, `Figure provider ${provider.id}`, provider.timeoutMs);
  return writeProviderOutput(root, runId, result.stdout, timestamp);
}

function postProviderJson(provider, label, payload, maxBuffer = provider.maxSvgBytes * 2 + 100000) {
  const script = `
const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", async () => {
  try {
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), payload.timeoutMs);
    const headers = { "content-type": "application/json", "accept": payload.accept || "application/json" };
    if (payload.apiKey) headers.authorization = \`Bearer \${payload.apiKey}\`;
    const response = await fetch(payload.endpoint, { method: "POST", headers, body: JSON.stringify(payload.request), signal: controller.signal });
    clearTimeout(timer);
    const body = await response.text();
    process.stdout.write(JSON.stringify({ ok: response.ok, status: response.status, contentType: response.headers.get("content-type") || "", body }));
  } catch (error) {
    process.stderr.write(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
});
`;
  const result = spawnSync(process.execPath, ["-e", script], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    timeout: provider.timeoutMs + 1000,
    maxBuffer
  });
  assertSpawnSucceeded(result, label, provider.timeoutMs);
  const response = JSON.parse(result.stdout);
  if (!response.ok) {
    throw new Error(`${label} returned ${response.status}: ${String(response.body ?? "").slice(0, 1000)}`);
  }
  return response;
}

function invokeHttpJsonProvider(root, provider, input, prompt, env, runId, timestamp) {
  const apiKey = provider.apiKeyEnv ? env[provider.apiKeyEnv] : null;
  if (provider.apiKeyEnv && !apiKey) {
    throw new Error(`Figure provider ${provider.id} requires environment variable ${provider.apiKeyEnv}.`);
  }
  const response = postProviderJson(provider, `HTTP figure provider ${provider.id}`, {
    endpoint: provider.endpoint,
    apiKey,
    timeoutMs: provider.timeoutMs,
    accept: "application/json, image/svg+xml, text/plain",
    request: {
      model: provider.model ?? undefined,
      prompt,
      input
    }
  });
  const providerOutput = response.contentType.includes("json") ? JSON.parse(response.body) : response.body;
  return writeProviderOutput(root, runId, providerOutput, timestamp);
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dimensionsFromImageSize(value) {
  const match = typeof value === "string" ? value.match(/^(\d+)x(\d+)$/) : null;
  return match ? { width: Number(match[1]), height: Number(match[2]) } : { width: 1024, height: 1024 };
}

function openAiImageRequest(provider, prompt) {
  const request = {
    model: provider.model ?? "gpt-image-2",
    prompt,
    n: 1
  };
  if (provider.imageSize) {
    request.size = provider.imageSize;
  }
  if (provider.imageQuality) {
    request.quality = provider.imageQuality;
  }
  if (provider.imageBackground) {
    request.background = provider.imageBackground;
  }
  return request;
}

function openAiImageData(responseBody, providerId) {
  const parsed = JSON.parse(responseBody);
  const item = Array.isArray(parsed.data) ? parsed.data[0] : null;
  const b64 = item?.b64_json ?? item?.image?.b64_json;
  if (typeof b64 !== "string" || b64.trim().length === 0) {
    throw new Error(`OpenAI image provider ${providerId} did not return b64_json image data.`);
  }
  return {
    b64,
    revisedPrompt: item?.revised_prompt ?? item?.revisedPrompt ?? null,
    responseId: parsed.id ?? null
  };
}

function invokeOpenAiImageProvider(root, provider, input, prompt, env, runId, timestamp) {
  const apiKey = provider.apiKeyEnv ? env[provider.apiKeyEnv] : null;
  if (provider.apiKeyEnv && !apiKey) {
    throw new Error(`Figure provider ${provider.id} requires environment variable ${provider.apiKeyEnv}.`);
  }
  const response = postProviderJson(provider, `OpenAI image figure provider ${provider.id}`, {
    endpoint: provider.endpoint,
    apiKey,
    timeoutMs: provider.timeoutMs,
    accept: "application/json",
    request: openAiImageRequest(provider, prompt)
  }, provider.maxSvgBytes * 8 + 100000);
  const image = openAiImageData(response.body, provider.id);
  const imagePath = `${generationRunDir(runId)}/gpt-image2.png`;
  ensureDir(path.dirname(resolvePath(root, imagePath)));
  fs.writeFileSync(resolvePath(root, imagePath), Buffer.from(image.b64, "base64"));
  const sourceSvgPath = assertSafeFigureSourcePath(`${generationRunDir(runId)}/gpt-image2.svg`, "OpenAI image sourceSvgPath", runId);
  const targetFinalSvgPath = assertSafeFigureFinalTargetPath(input.figure?.finalSvgPath, "OpenAI image final artifact target");
  const href = path.posix.relative(path.posix.dirname(targetFinalSvgPath), imagePath) || path.posix.basename(imagePath);
  const { width, height } = dimensionsFromImageSize(provider.imageSize);
  const title = xmlEscape(input.figure?.name ?? input.figureId ?? "Generated figure");
  const desc = xmlEscape(input.figure?.purpose ?? "Generated by an OpenAI image provider and wrapped as a local SVG artifact.");
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">${title}</title><desc id="desc">${desc}</desc><image href="${xmlEscape(href)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/></svg>\n`;
  return writeProviderOutput(root, runId, {
    sourceSvgPath,
    svgContent,
    caption: `${input.figure?.name ?? input.figureId ?? "Figure"} generated with ${provider.id}.`,
    rasterImagePath: imagePath,
    providerResponseId: image.responseId,
    revisedPrompt: image.revisedPrompt,
    model: provider.model ?? "gpt-image-2",
    imageSize: provider.imageSize ?? null,
    generatedAt: timestamp
  }, timestamp);
}

function executeFigureProvider(root, provider, input, prompt, env, runId, timestamp) {
  if (provider.type === "external-command") {
    return invokeExternalCommandProvider(root, provider, input.inputPath ?? `${generationRunDir(runId)}/input.json`, runId, timestamp);
  }
  if (provider.type === "http-json") {
    return invokeHttpJsonProvider(root, provider, input, prompt, env, runId, timestamp);
  }
  if (provider.type === "openai-image") {
    return invokeOpenAiImageProvider(root, provider, input, prompt, env, runId, timestamp);
  }
  throw new Error(`Unsupported figure provider type: ${provider.type}`);
}

function patchPlanProviderExecutionBoundary(provider) {
  return {
    status: "awaiting-provider-output",
    reason: `Figure provider ${provider.id} requires direct-process execution because provider calls may spawn processes, call external APIs, or write binary outputs that patch-plan cannot safely represent.`,
    providerId: provider.id,
    providerType: provider.type,
    requiredMutationMode: "direct-process",
    requiredActions: ["retry-with-mutationMode-direct-process", "import-manual-figure-output"],
    directProcessRequired: true,
    hostRollbackEligible: false
  };
}

function updateFigureIndexesForImport(root, figure, generation, caption, timestamp) {
  const figures = readFigures(root);
  figures.items = (figures.items ?? []).map((item) => item.id === figure.id ? {
    ...item,
    status: "generated",
    latestGenerationRunId: generation.id,
    captionId: caption.id,
    finalSvgPath: generation.finalSvgPath,
    updatedAt: timestamp
  } : item);
  figures.updatedAt = timestamp;
  writeJson(root, ARTIFACT_PATHS.figuresIndex, figures);

  const finals = readJson(root, ARTIFACT_PATHS.figureFinalIndex, { version: 1, items: [], updatedAt: null });
  finals.items = (finals.items ?? []).map((item) => item.figureId === figure.id ? {
    ...item,
    generationRunId: generation.id,
    captionId: caption.id,
    finalSvgPath: generation.finalSvgPath,
    readinessStatus: "ready-for-finalization",
    updatedAt: timestamp
  } : item);
  finals.updatedAt = timestamp;
  writeJson(root, ARTIFACT_PATHS.figureFinalIndex, finals);

  const editable = readJson(root, ARTIFACT_PATHS.figureEditableIndex, { version: 1, items: [], updatedAt: null });
  editable.items = (editable.items ?? []).map((item) => item.figureId === figure.id ? {
    ...item,
    generationRunId: generation.id,
    captionId: caption.id,
    finalSvgPath: generation.finalSvgPath,
    updatedAt: timestamp
  } : item);
  editable.updatedAt = timestamp;
  writeJson(root, ARTIFACT_PATHS.figureEditableIndex, editable);
}

function buildCaptionText(figure, generation, providedCaption) {
  const base = typeof providedCaption === "string" && providedCaption.trim().length > 0
    ? providedCaption.trim()
    : `${figure.name ?? figure.id} shows ${figure.narrativeIntent ?? figure.purpose ?? "the linked paper evidence"} for ${normalizeStringArray(figure.targetClaimIds).join(", ") || "the current paper argument"}.`;
  const provenance = `Generated/imported through run ${generation.id}${generation.providerId ? ` using provider ${generation.providerId}` : ""}.`;
  return base.includes(generation.id) ? base : `${base} ${provenance}`;
}

export function prepareFigureGeneration(root, args = {}) {
  assertGovernanceMutationRegistered("prepare-figure-generation", "guarded");
  const target = assertTaskScopedMutationTarget(root, "prepare-figure-generation", args);
  assertFollowThroughReady(root, "Preparing figure generation", args);
  ensureWorkspace(root);
  const { env: _env, ...safeArgs } = args;
  assertNoInlineSecrets(safeArgs, "figureGeneration.args");
  const { figure } = resolveFigure(root, args);
  const config = loadFigureGenerationConfig(root, args.env ?? process.env);
  const { provider, readiness } = selectProvider(config, args.providerId ?? figure.generationProviderId, args.env ?? process.env);
  const timestamp = nowIso();
  const runId = slugify(args.runId ?? defaultRunId(figure.id));
  const runDir = generationRunDir(runId);
  const inputPath = `${runDir}/input.json`;
  const promptPath = `${runDir}/prompt.md`;
  const outputManifestPath = `${runDir}/output.json`;
  const manifestPath = `${runDir}/manifest.json`;
  const outputFormat = args.outputFormat ?? figure.outputFormat ?? "svg";
  const constraints = normalizeStringArray(args.constraints, Array.isArray(figure.generationConstraints) ? figure.generationConstraints : []);
  const requirements = buildMaterialRequirements(root, figure, args);
  const missingRequirementIds = requirements.filter((item) => item.status !== "available").map((item) => item.id);
  const materialRecord = {
    id: `${figure.id}-materials`,
    figureId: figure.id,
    packetId: target.packetId,
    runId,
    status: missingRequirementIds.length > 0 ? "needs-materials" : "ready",
    requirements,
    missingRequirementIds,
    updatedAt: timestamp
  };
  const prompt = truncatePrompt(buildGenerationPrompt({ figure, packet: target.packet, requirements, constraints, outputFormat, provider }), provider?.maxPromptChars ?? config.maxPromptChars);
  const input = {
    version: 1,
    runId,
    figureId: figure.id,
    packetId: target.packetId,
    figure: {
      id: figure.id,
      name: figure.name,
      purpose: figure.purpose,
      narrativeIntent: figure.narrativeIntent,
      finalSvgPath: figure.finalSvgPath,
      targetClaimIds: figure.targetClaimIds ?? [],
      relatedExperimentIds: figure.relatedExperimentIds ?? []
    },
    materialRecord,
    outputFormat,
    constraints,
    providerRequest: providerRequestSummary(provider, readiness),
    config: redactDoveConfig({ figureGeneration: { ...config, providers: provider ? [provider] : [] } }).figureGeneration,
    inputPath,
    promptPath,
    expectedOutputManifestPath: outputManifestPath,
    createdAt: timestamp
  };

  const materials = readJson(root, ARTIFACT_PATHS.figureMaterials, { version: 1, items: [], updatedAt: null });
  writeJson(root, ARTIFACT_PATHS.figureMaterials, updateIndexItem(materials, materialRecord));
  writeJson(root, inputPath, input);
  writeText(root, promptPath, prompt);

  let generation = {
    id: runId,
    figureId: figure.id,
    packetId: target.packetId,
    status: "prepared",
    providerId: provider?.id ?? null,
    providerType: provider?.type ?? null,
    materialRecordId: materialRecord.id,
    inputPath,
    promptPath,
    outputManifestPath,
    manifestPath,
    outputFormat,
    missingRequirementIds,
    readiness,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const generations = readJson(root, ARTIFACT_PATHS.figureGenerations, { version: 1, items: [], updatedAt: null });
  let providerExecution = null;
  if (args.executeProvider === true) {
    if (!provider) {
      providerExecution = { status: "failed", error: "No figure generation provider is configured." };
    } else if (isPatchPlanMode(root)) {
      providerExecution = patchPlanProviderExecutionBoundary(provider);
      generation = { ...generation, status: providerExecution.status, providerExecution, updatedAt: timestamp };
    } else if (readiness.status === "missing-secret-env") {
      providerExecution = {
        status: "missing-secret-env",
        error: readiness.summary,
        apiKeyEnv: readiness.apiKeyEnv ?? provider.apiKeyEnv ?? null
      };
      generation = { ...generation, status: "missing-secret-env", providerError: providerExecution.error, updatedAt: timestamp };
    } else if (missingRequirementIds.length > 0 && args.allowMissingMaterials !== true) {
      providerExecution = { status: "skipped-missing-materials", missingRequirementIds };
    } else {
      try {
        const output = executeFigureProvider(root, provider, input, prompt, args.env ?? process.env, runId, timestamp);
        providerExecution = { status: "completed", outputManifestPath: output.outputManifestPath };
        generation = { ...generation, status: "provider-output-ready", outputManifestPath: output.outputManifestPath, providerExecutedAt: timestamp, updatedAt: timestamp };
      } catch (error) {
        providerExecution = { status: "failed", error: error instanceof Error ? error.message : String(error) };
        generation = { ...generation, status: "provider-failed", providerError: providerExecution.error, updatedAt: timestamp };
      }
    }
  }
  if (providerExecution && generation.status === "prepared") {
    generation = { ...generation, status: providerExecution.status, providerExecution, updatedAt: timestamp };
  } else if (providerExecution) {
    generation = { ...generation, providerExecution };
  }
  writeJson(root, ARTIFACT_PATHS.figureGenerations, updateIndexItem(generations, generation));
  writeJson(root, manifestPath, generation);
  refreshDurableSurfaces(root, {
    type: "prepare-figure-generation",
    summary: `Prepared figure generation run ${runId} for ${figure.id} with ${missingRequirementIds.length} missing materials${providerExecution ? `; provider execution ${providerExecution.status}` : ""}.`,
    artifactPaths: [ARTIFACT_PATHS.figureMaterials, ARTIFACT_PATHS.figureGenerations, inputPath, promptPath, outputManifestPath, manifestPath]
  });
  return {
    runId,
    figureId: figure.id,
    packetId: target.packetId,
    materialStatus: materialRecord.status,
    missingRequirementIds,
    providerReadiness: readiness,
    providerExecution,
    inputPath,
    promptPath,
    outputManifestPath: generation.outputManifestPath,
    manifestPath,
    preActionGuidanceSummary: figureGenerationGuidanceSummary(root, args, target, {
      nextAction: missingRequirementIds.length > 0 ? "project:dove.figure" : "project:dove.review",
      statusSummary: {
        runId,
        figureId: figure.id,
        materialStatus: materialRecord.status,
        missingRequirementCount: missingRequirementIds.length,
        providerExecutionStatus: providerExecution?.status ?? null
      }
    })
  };
}

export function importFigureGeneration(root, args = {}) {
  assertGovernanceMutationRegistered("import-figure-generation", "guarded");
  const target = assertTaskScopedMutationTarget(root, "import-figure-generation", args);
  assertFollowThroughReady(root, "Importing figure generation", args);
  ensureWorkspace(root);
  assertNoLegacyFinalSvgInput(args, "import_figure_generation");
  const { env: _env, svgContent: _svgContent, ...safeArgs } = args;
  assertNoInlineSecrets(safeArgs, "figureGeneration.importArgs");
  const { figure } = resolveFigure(root, args);
  const runId = slugify(args.runId ?? "");
  if (!runId) {
    throw new Error("import_figure_generation requires runId.");
  }
  const generations = readJson(root, ARTIFACT_PATHS.figureGenerations, { version: 1, items: [], updatedAt: null });
  const existingGeneration = (generations.items ?? []).find((item) => item.id === runId);
  if (!existingGeneration) {
    throw new Error(`Figure generation run not found: ${runId}`);
  }
  if (existingGeneration.figureId !== figure.id) {
    throw new Error(`Figure generation run ${runId} belongs to ${existingGeneration.figureId}, not ${figure.id}.`);
  }
  if (existingGeneration.packetId !== target.packetId) {
    throw new Error(`Figure generation run ${runId} belongs to packet ${existingGeneration.packetId}, not ${target.packetId}.`);
  }

  const defaultSourceSvgPath = `${generationRunDir(runId)}/final.svg`;
  const { manifestPath: outputManifestPath, manifest } = readOutputManifest(root, runId, args.outputManifestPath, {
    sourceSvgPath: args.sourceSvgPath ?? defaultSourceSvgPath,
    caption: args.caption ?? args.captionDraft
  });
  assertManifestHasNoInlineSecrets(root, outputManifestPath, manifest, "figureGeneration.outputManifest");
  assertNoLegacyFinalSvgInput(manifest, "figureGeneration.outputManifest");
  assertNoLegacyProviderOutputFields(manifest, "figureGeneration.outputManifest");
  const semanticCoverage = normalizeSemanticCoverage(args.semanticCoverage ?? manifest.semanticCoverage ?? existingGeneration.semanticCoverage);
  const semanticReview = normalizeSemanticReview(args.semanticReview ?? manifest.semanticReview ?? existingGeneration.semanticReview);
  if (semanticCoverage || semanticReview) {
    writeJson(root, outputManifestPath, {
      ...manifest,
      ...(semanticCoverage ? { semanticCoverage } : {}),
      ...(semanticReview ? { semanticReview } : {})
    });
  }
  const rawSvgContent = typeof args.svgContent === "string" ? args.svgContent : typeof manifest.svgContent === "string" ? manifest.svgContent : null;
  const sourceSvgPath = assertSafeFigureSourcePath(args.sourceSvgPath ?? manifest.sourceSvgPath ?? manifest.svgPath ?? defaultSourceSvgPath, "sourceSvgPath", runId);
  const finalSvgPath = assertSafeFigureFinalTargetPath(figure.finalSvgPath, "figure.finalSvgPath");

  const config = loadFigureGenerationConfig(root, args.env ?? process.env);
  let svgContent;
  if (rawSvgContent) {
    svgContent = rawSvgContent.endsWith("\n") ? rawSvgContent : `${rawSvgContent}\n`;
    writeText(root, sourceSvgPath, svgContent);
  } else {
    const sourceInspection = inspectDeclaredPath(root, sourceSvgPath, {
      requireNonEmpty: true,
      rejectBookkeeping: true,
      readText: true,
      maxBytes: config.maxSvgBytes
    });
    if (sourceInspection.status !== "existing") {
      throw new Error(`Generated SVG output is not a usable non-empty file at ${sourceSvgPath}: ${sourceInspection.reason ?? sourceInspection.status}`);
    }
    svgContent = sourceInspection.text ?? readText(root, sourceSvgPath, "");
  }

  const provider = existingGeneration.providerId ? config.providers.find((item) => item.id === existingGeneration.providerId) : null;
  const maxSvgBytes = provider?.maxSvgBytes ?? config.maxSvgBytes;
  const safetyIssues = svgSafetyIssues(svgContent, maxSvgBytes);
  if (safetyIssues.length > 0) {
    throw new Error(`Generated SVG failed safety validation: ${safetyIssues.join(" ")}`);
  }

  if (sourceSvgPath !== finalSvgPath) {
    writeText(root, finalSvgPath, svgContent);
  }

  const timestamp = nowIso();
  const generation = {
    ...existingGeneration,
    status: "imported",
    outputManifestPath,
    sourceSvgPath,
    finalSvgPath,
    finalSha256: sha256(svgContent),
    importedAt: timestamp,
    updatedAt: timestamp,
    safety: { status: "passed", checks: ["script", "event-handlers", "foreignObject", "remote-hrefs", "remote-url-resources"], maxSvgBytes },
    ...(semanticCoverage ? { semanticCoverage } : {}),
    ...(semanticReview ? { semanticReview } : {})
  };
  const caption = {
    id: slugify(args.captionId ?? `${figure.id}-${runId}-caption`),
    figureId: figure.id,
    runId,
    packetId: target.packetId,
    text: buildCaptionText(figure, generation, args.caption ?? args.captionDraft ?? manifest.caption),
    purpose: figure.purpose ?? figure.narrativeIntent ?? "Explain the linked paper evidence.",
    targetClaimIds: normalizeStringArray(figure.targetClaimIds),
    relatedExperimentIds: normalizeStringArray(figure.relatedExperimentIds),
    provenance: {
      providerId: generation.providerId,
      providerType: generation.providerType,
      runId,
      outputManifestPath,
      finalSha256: generation.finalSha256
    },
    updatedAt: timestamp
  };

  writeJson(root, ARTIFACT_PATHS.figureGenerations, updateIndexItem(generations, { ...generation, captionId: caption.id }));
  const captions = readJson(root, ARTIFACT_PATHS.figureCaptions, { version: 1, items: [], updatedAt: null });
  writeJson(root, ARTIFACT_PATHS.figureCaptions, updateIndexItem(captions, caption));
  writeJson(root, `${generationRunDir(runId)}/manifest.json`, { ...generation, captionId: caption.id });
  updateFigureIndexesForImport(root, figure, { ...generation, captionId: caption.id }, caption, timestamp);
  const validation = validateFigurePipeline(root);
  const figureQa = summarizeFigureQa(root, figure.id, validation);
  refreshDurableSurfaces(root, {
    type: "import-figure-generation",
    summary: `Imported figure generation run ${runId} for ${figure.id}.`,
    artifactPaths: [ARTIFACT_PATHS.figureGenerations, ARTIFACT_PATHS.figureCaptions, ARTIFACT_PATHS.figureFinalIndex, ARTIFACT_PATHS.figureQa, finalSvgPath]
  });
  return {
    runId,
    figureId: figure.id,
    packetId: target.packetId,
    captionId: caption.id,
    sourceSvgPath,
    finalSvgPath,
    finalSha256: generation.finalSha256,
    qaIssueCount: figureQa.issueCount,
    workspaceQaIssueCount: figureQa.workspaceIssueCount,
    qaPath: figureQa.qaPath,
    figureQa,
    preActionGuidanceSummary: figureGenerationGuidanceSummary(root, args, target, {
      nextAction: figureQa.issueCount > 0 ? "project:dove.figure" : "project:dove.review",
      statusSummary: {
        runId,
        figureId: figure.id,
        captionId: caption.id,
        sourceSvgPath,
        finalSvgPath,
        qaIssueCount: figureQa.issueCount,
        workspaceQaIssueCount: figureQa.workspaceIssueCount
      }
    })
  };
}
