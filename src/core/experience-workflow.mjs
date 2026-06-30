import {
  ARTIFACT_PATHS
} from "./schema.mjs";
import { resolveDoveResponseLanguage } from "./i18n.mjs";
import { assertTaskScopedMutationTarget } from "./mutation-guard.mjs";
import { buildPreActionGuidance } from "./pre-action-guidance.mjs";
import { assertGovernanceMutationRegistered, ensureWorkspace, nowIso, readJson, writeJson, writeText } from "./workspace.mjs";

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "experience";
}

function normalizeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean))) : [];
}

function hasNonEmptyString(value) {
  return typeof value === "string" && value.trim();
}

function hasExperienceObjective(rawPlan = {}, args = {}) {
  return [rawPlan.experimentId, rawPlan.id, rawPlan.goal, rawPlan.idea, args.idea, rawPlan.title].some(hasNonEmptyString);
}

function renderClaimsMarkdown(claims = []) {
  return [
    "# Claims From Results",
    "",
    ...claims.flatMap((claim) => [
      `## ${claim.id}`,
      "",
      `- Status: ${claim.status ?? "unknown"}`,
      `- Confidence: ${claim.confidence ?? "unknown"}`,
      `- Summary: ${claim.summary ?? claim.statement ?? "No summary recorded."}`,
      `- Experiments: ${(claim.experimentIds ?? []).join(", ") || "none"}`,
      ""
    ])
  ].join("\n");
}

function normalizeOutcome(value) {
  return ["supports", "refutes", "inconclusive", "failed", "pending"].includes(value) ? value : "pending";
}

function upsertById(items, item) {
  const existing = items.findIndex((entry) => entry.id === item.id);
  if (existing >= 0) {
    items[existing] = { ...items[existing], ...item };
  } else {
    items.push(item);
  }
  return items;
}

export function runExperienceWorkflow(root, args = {}) {
  assertGovernanceMutationRegistered("run-experience-workflow", "guarded");
  const target = assertTaskScopedMutationTarget(root, "run-experience-workflow", args);
  ensureWorkspace(root);
  const timestamp = nowIso();
  const rawPlan = args.plan && typeof args.plan === "object" ? args.plan : args;
  const resultInput = args.result && typeof args.result === "object" ? args.result : (args.outcome || args.resultSummary || args.summary || normalizeStringArray(args.evidenceLinks ?? args.artifactPaths).length > 0 ? args : null);
  if (!hasExperienceObjective(rawPlan, args)) {
    throw new Error("run_experience_workflow requires an experiment goal, title, idea, or experimentId.");
  }
  const experimentId = slugify(rawPlan.experimentId ?? rawPlan.id ?? rawPlan.goal ?? rawPlan.title);
  const claimId = normalizeString(rawPlan.claimId ?? args.claimId, null);
  const plan = {
    id: experimentId,
    packetId: target.packetId,
    title: normalizeString(rawPlan.title ?? rawPlan.goal, experimentId.replace(/-/g, " ")),
    goal: normalizeString(rawPlan.goal ?? rawPlan.idea ?? args.idea ?? rawPlan.title, ""),
    methodology: normalizeString(rawPlan.methodology ?? rawPlan.method, ""),
    successMetric: normalizeString(rawPlan.successMetric ?? rawPlan.metric, ""),
    comparisonTargets: normalizeStringArray(rawPlan.comparisonTargets ?? rawPlan.baselines),
    claimId,
    status: normalizeString(rawPlan.status, "planned"),
    createdAt: rawPlan.createdAt ?? timestamp,
    updatedAt: timestamp
  };
  const plansIndex = readJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null });
  plansIndex.items = upsertById(Array.isArray(plansIndex.items) ? plansIndex.items : [], plan);
  plansIndex.updatedAt = timestamp;
  writeJson(root, ARTIFACT_PATHS.experimentPlans, plansIndex);

  let result = null;
  let audit = null;
  let bridge = null;
  if (resultInput) {
    const resultsIndex = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
    result = {
      id: slugify(resultInput.resultId ?? resultInput.id ?? `${experimentId}-result`),
      packetId: target.packetId,
      experimentId,
      claimId: normalizeString(resultInput.claimId ?? claimId, null),
      outcome: normalizeOutcome(resultInput.outcome),
      summary: normalizeString(resultInput.summary ?? resultInput.resultSummary, ""),
      evidenceLinks: normalizeStringArray(resultInput.evidenceLinks ?? resultInput.artifactPaths),
      comparisonTargets: normalizeStringArray(resultInput.comparisonTargets),
      createdAt: resultInput.createdAt ?? timestamp,
      updatedAt: timestamp
    };
    resultsIndex.items = upsertById(Array.isArray(resultsIndex.items) ? resultsIndex.items : [], result);
    resultsIndex.updatedAt = timestamp;
    writeJson(root, ARTIFACT_PATHS.experimentResults, resultsIndex);

    const integrityFlags = [];
    if (!result.claimId) integrityFlags.push("missing-claim-link");
    if (result.evidenceLinks.length === 0) integrityFlags.push("missing-evidence-links");
    if (!plan.methodology) integrityFlags.push("missing-methodology");
    if (!plan.successMetric) integrityFlags.push("missing-success-metric");
    if (!result.summary) integrityFlags.push("missing-result-summary");
    if (result.outcome === "pending") integrityFlags.push("pending-outcome");
    audit = {
      id: slugify(`${result.id}-audit`),
      packetId: target.packetId,
      experimentId,
      resultId: result.id,
      claimId: result.claimId,
      auditVerdict: integrityFlags.length === 0 ? "clean" : "blocked",
      integrityFlags,
      auditFindings: integrityFlags.map((flag) => `Experience workflow flagged ${flag}.`),
      bridgeReadiness: integrityFlags.length === 0 ? "ready" : "blocked",
      updatedAt: timestamp
    };
    const auditsIndex = readJson(root, ARTIFACT_PATHS.experimentAudits, { version: 1, items: [], updatedAt: null });
    auditsIndex.items = upsertById(Array.isArray(auditsIndex.items) ? auditsIndex.items : [], audit);
    auditsIndex.updatedAt = timestamp;
    writeJson(root, ARTIFACT_PATHS.experimentAudits, auditsIndex);

    if (result.claimId) {
      const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null });
      const claimIndex = (evidence.claims ?? []).findIndex((claim) => claim.id === result.claimId);
      const claimExists = claimIndex >= 0;
      const bridgeReady = claimExists && audit.auditVerdict === "clean";
      const nextStatus = audit.auditVerdict === "clean" && result.outcome === "supports" ? "supported" : audit.auditVerdict === "clean" && ["refutes", "failed"].includes(result.outcome) ? "refuted" : "needs-review";
      bridge = {
        id: slugify(`${result.id}-bridge`),
        packetId: target.packetId,
        experimentId,
        resultId: result.id,
        claimId: result.claimId,
        status: bridgeReady ? "applied" : claimExists ? "held-audit-blocked" : "held-missing-claim",
        mapping: result.outcome,
        auditId: audit.id,
        claimStateAfter: bridgeReady ? nextStatus : claimExists ? "needs-review" : null,
        reason: bridgeReady ? result.summary : claimExists ? `Audit ${audit.id} is blocked: ${audit.integrityFlags.join(", ")}.` : `Claim ${result.claimId} does not exist yet.`,
        updatedAt: timestamp
      };
      const bridgeLog = readJson(root, ARTIFACT_PATHS.claimBridgeLog, { version: 1, items: [], updatedAt: null });
      bridgeLog.items = upsertById(Array.isArray(bridgeLog.items) ? bridgeLog.items : [], bridge);
      bridgeLog.updatedAt = timestamp;
      writeJson(root, ARTIFACT_PATHS.claimBridgeLog, bridgeLog);
      if (bridgeReady) {
        evidence.claims[claimIndex] = {
          ...evidence.claims[claimIndex],
          status: nextStatus,
          confidence: nextStatus === "supported" ? "high" : "low",
          experimentIds: Array.from(new Set([...(evidence.claims[claimIndex].experimentIds ?? []), experimentId])),
          latestBridgeId: bridge.id,
          latestAuditId: audit.id
        };
        evidence.updatedAt = timestamp;
        writeJson(root, ARTIFACT_PATHS.evidence, evidence);
        writeText(root, ARTIFACT_PATHS.claims, renderClaimsMarkdown(evidence.claims));
      }
    }
  }

  const status = result ? (audit?.auditVerdict === "clean" && bridge?.status === "applied" ? "bridged" : audit?.auditVerdict === "clean" ? "recorded" : "needs-review") : "planned";
  const preActionGuidance = buildPreActionGuidance({
    surface: "dove.experience",
    responseLanguage: resolveDoveResponseLanguage(root, args),
    request: normalizeString(rawPlan.goal ?? rawPlan.idea ?? rawPlan.title ?? args.idea, null),
    roleId: "builder",
    subagentSpecialty: "experiment-planner",
    packet: target.packet,
    currentContext: {
      domain: target.packet?.domain ?? null,
      stage: target.packet?.stage ?? "execute",
      primaryRole: "builder"
    },
    operatorLessons: readJson(root, ARTIFACT_PATHS.metaOperatorLessons, { lessons: [] }),
    nextAction: result ? "project:dove.review" : "project:dove.experience",
    routeHint: "project:dove.experience",
    workflowKind: "experience",
    domain: target.packet?.domain ?? null,
    stage: target.packet?.stage ?? "execute",
    tags: ["experiment", "claim-bridge", "audit"],
    statusSummary: {
      status,
      experimentId,
      hasResult: Boolean(result),
      auditVerdict: audit?.auditVerdict ?? null,
      bridgeStatus: bridge?.status ?? null
    }
  });

  return {
    status,
    preActionGuidance,
    packetId: target.packetId,
    plan,
    result,
    audit,
    bridge,
    artifacts: [ARTIFACT_PATHS.experimentPlans, ARTIFACT_PATHS.experimentResults, ARTIFACT_PATHS.experimentAudits, ARTIFACT_PATHS.claimBridgeLog]
  };
}
