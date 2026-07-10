import {
  ARTIFACT_PATHS
} from "./schema.mjs";
import { resolveDoveResponseLanguage } from "./i18n.mjs";
import { assertTaskScopedMutationTarget } from "./mutation-guard.mjs";
import { buildPreActionGuidance } from "./pre-action-guidance.mjs";
import { buildCommandResultCard } from "./result-cards.mjs";
import { assertGovernanceMutationRegistered, ensureWorkspace, nowIso, readJson, writeJson, writeText } from "./workspace.mjs";
import { evidencePathProblemFlags } from "./artifact-integrity.mjs";

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

function localizedText(responseLanguage, zh, en) {
  return responseLanguage === "en" ? en : zh;
}

function publicIntegrityActions(flags = [], responseLanguage = "zh") {
  const labels = {
    "missing-claim-link": localizedText(responseLanguage, "补上要验证的论点。", "Add the claim this result should support."),
    "missing-evidence-links": localizedText(responseLanguage, "补上可核查的实验结果材料。", "Attach checkable experiment evidence."),
    "missing-methodology": localizedText(responseLanguage, "说明实验方法。", "Describe the experiment method."),
    "missing-success-metric": localizedText(responseLanguage, "说明成功指标。", "Describe the success metric."),
    "missing-result-summary": localizedText(responseLanguage, "补一段结果摘要。", "Add a result summary."),
    "pending-outcome": localizedText(responseLanguage, "给出明确实验结论。", "Record a concrete experiment outcome."),
    "missing-evidence-file": localizedText(responseLanguage, "提供存在的本地实验证据文件。", "Provide an existing local experiment evidence file."),
    "empty-evidence-file": localizedText(responseLanguage, "把空实验证据文件替换为真实结果材料。", "Replace empty experiment evidence with real result material."),
    "directory-evidence-file": localizedText(responseLanguage, "引用具体实验证据文件，不要引用目录。", "Reference a concrete evidence file, not a directory."),
    "unsafe-evidence-path": localizedText(responseLanguage, "使用项目内相对证据路径。", "Use a project-relative evidence path."),
    "bookkeeping-evidence-file": localizedText(responseLanguage, "改用真实实验结果文件，不要用状态、导航或 ledger 记录。", "Use real result files instead of status, navigation, or ledger records."),
    "unsupported-evidence-file": localizedText(responseLanguage, "引用普通文件形式的实验证据。", "Reference a regular file as experiment evidence."),
    "unreadable-evidence-file": localizedText(responseLanguage, "修复不可读取的实验证据文件。", "Fix unreadable experiment evidence.")
  };
  return normalizeStringArray(flags.map((flag) => labels[flag] ?? localizedText(responseLanguage, "补齐实验审计指出的缺口。", "Fill the gap raised by experiment review.")));
}

function publicExperienceBoundary(boundary, audit, responseLanguage = "zh") {
  if (!boundary) {
    return null;
  }
  return {
    type: boundary.type,
    summary: boundary.type === "needs-review"
      ? localizedText(responseLanguage, "实验结果还需要 review 判断是否能支撑论点。", "The experiment result still needs review before it can support the claim.")
      : localizedText(responseLanguage, "实验材料还不够，不能直接推进成论点证据。", "The experiment material is not complete enough to promote as claim evidence."),
    requiredActions: publicIntegrityActions(audit?.integrityFlags ?? boundary.requiredInputs, responseLanguage)
  };
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

function requiredActionsForIntegrityFlags(flags = []) {
  const actions = {
    "missing-claim-link": "link-result-to-claim-or-create-claim",
    "missing-evidence-links": "attach-experiment-evidence",
    "missing-methodology": "provide-experiment-methodology",
    "missing-success-metric": "provide-success-metric",
    "missing-result-summary": "provide-result-summary",
    "pending-outcome": "provide-concrete-outcome",
    "missing-evidence-file": "attach-existing-experiment-evidence-file",
    "empty-evidence-file": "replace-empty-experiment-evidence",
    "directory-evidence-file": "attach-file-not-directory",
    "unsafe-evidence-path": "use-project-relative-evidence-path",
    "bookkeeping-evidence-file": "attach-substantive-experiment-artifact",
    "unsupported-evidence-file": "attach-regular-evidence-file",
    "unreadable-evidence-file": "fix-unreadable-experiment-evidence"
  };
  return normalizeStringArray(flags.map((flag) => actions[flag] ?? `resolve-${flag}`));
}

function experienceBoundaryFor({ status, plan, result, audit, bridge, artifactRefs }) {
  if (audit?.auditVerdict === "blocked") {
    const requiredActions = requiredActionsForIntegrityFlags(audit.integrityFlags);
    const materialFlags = ["missing-claim-link", "missing-evidence-links", "missing-evidence-file", "empty-evidence-file", "directory-evidence-file", "unsafe-evidence-path", "bookkeeping-evidence-file", "unsupported-evidence-file", "unreadable-evidence-file", "missing-methodology", "missing-success-metric", "missing-result-summary"];
    const hasMissingMaterials = audit.integrityFlags.some((flag) => materialFlags.includes(flag));
    return {
      id: `${result?.id ?? plan.id}-audit-blocked`,
      type: hasMissingMaterials ? "missing-required-materials" : "needs-review",
      reason: `Experiment audit ${audit.id} is blocked: ${audit.integrityFlags.join(", ")}.`,
      requiredInputs: audit.integrityFlags,
      requiredActions,
      artifactRefs,
      nextAction: hasMissingMaterials ? "project:dove.experience" : "project:dove.review",
      ownerRole: "builder",
      nextRole: hasMissingMaterials ? "builder" : "reviewer"
    };
  }
  if (bridge?.status === "held-missing-claim") {
    return {
      id: `${bridge.id}-missing-claim`,
      type: "missing-required-materials",
      reason: bridge.reason,
      requiredInputs: [bridge.claimId],
      requiredActions: ["create-or-link-claim-before-bridge"],
      artifactRefs,
      nextAction: "project:dove.experience",
      ownerRole: "builder",
      nextRole: "builder"
    };
  }
  if (bridge?.status === "held-audit-blocked") {
    return {
      id: `${bridge.id}-audit-blocked`,
      type: "needs-review",
      reason: bridge.reason,
      requiredInputs: audit?.integrityFlags ?? [],
      requiredActions: ["resolve-experiment-audit-flags"],
      artifactRefs,
      nextAction: "project:dove.review",
      ownerRole: "builder",
      nextRole: "reviewer"
    };
  }
  if (status === "recorded" && result && !bridge) {
    return {
      id: `${result.id}-bridge-required`,
      type: "missing-required-materials",
      reason: `Experiment result ${result.id} is recorded but not linked to a durable claim bridge.`,
      requiredInputs: ["claimId"],
      requiredActions: ["link-result-to-claim-or-create-claim"],
      artifactRefs,
      nextAction: "project:dove.experience",
      ownerRole: "builder",
      nextRole: "builder"
    };
  }
  return null;
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
  if (!resultInput && (!plan.methodology || !plan.successMetric)) {
    const missing = [!plan.methodology ? "missing-methodology" : null, !plan.successMetric ? "missing-success-metric" : null].filter(Boolean);
    const responseLanguage = resolveDoveResponseLanguage(root, args);
    const boundary = {
      id: `${experimentId}-plan-materials`,
      type: "missing-required-materials",
      reason: `Experiment plan ${experimentId} needs methodology and successMetric before it can be recorded as real progress: ${missing.join(", ")}.`,
      requiredInputs: missing,
      requiredActions: requiredActionsForIntegrityFlags(missing),
      artifactRefs: [],
      nextAction: "project:dove.experience",
      ownerRole: "builder",
      nextRole: "builder"
    };
    const resultCard = buildCommandResultCard({
      surface: "dove.experience",
      command: "run_experience_workflow",
      title: localizedText(responseLanguage, "实验材料不足", "Experiment material missing"),
      status: "missing-required-materials",
      happened: localizedText(responseLanguage, "没有写入实验计划；methodology 和 successMetric 是最低材料边界。", "No experiment plan was written; methodology and successMetric are the minimum material boundary."),
      durableWrites: [],
      boundary: publicExperienceBoundary(boundary, { integrityFlags: missing }, responseLanguage),
      nextActions: [{
        title: localizedText(responseLanguage, "补实验方法和成功指标", "Add method and success metric"),
        why: localizedText(responseLanguage, "只有题目或 idea 只是占位，不能算实验推进。", "A title or idea alone is a placeholder, not experiment progress.")
      }]
    }, responseLanguage);
    return {
      status: "missing-required-materials",
      packetId: target.packetId,
      plan,
      result: null,
      audit: null,
      bridge: null,
      boundary,
      boundaryType: boundary.type,
      requiredActions: boundary.requiredActions,
      artifactRefs: [],
      validationEvidencePaths: [],
      nextAction: boundary.nextAction,
      artifacts: [],
      resultCard
    };
  }
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

    const evidenceIntegrity = evidencePathProblemFlags(root, result.evidenceLinks);
    const integrityFlags = [];
    if (!result.claimId) integrityFlags.push("missing-claim-link");
    integrityFlags.push(...evidenceIntegrity.flags);
    if (!plan.methodology) integrityFlags.push("missing-methodology");
    if (!plan.successMetric) integrityFlags.push("missing-success-metric");
    if (!result.summary) integrityFlags.push("missing-result-summary");
    if (result.outcome === "pending") integrityFlags.push("pending-outcome");
    const uniqueIntegrityFlags = Array.from(new Set(integrityFlags));
    audit = {
      id: slugify(`${result.id}-audit`),
      packetId: target.packetId,
      experimentId,
      resultId: result.id,
      claimId: result.claimId,
      auditVerdict: uniqueIntegrityFlags.length === 0 ? "clean" : "blocked",
      integrityFlags: uniqueIntegrityFlags,
      auditFindings: uniqueIntegrityFlags.map((flag) => `Experience workflow flagged ${flag}.`),
      evidencePathIntegrity: evidenceIntegrity.pathEvidence,
      bridgeReadiness: uniqueIntegrityFlags.length === 0 ? "ready" : "blocked",
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

  const artifactRefs = [ARTIFACT_PATHS.experimentPlans, ARTIFACT_PATHS.experimentResults, ARTIFACT_PATHS.experimentAudits, ARTIFACT_PATHS.claimBridgeLog];
  const status = result ? (audit?.auditVerdict === "clean" && bridge?.status === "applied" ? "bridged" : audit?.auditVerdict === "clean" ? "recorded" : "needs-review") : "planned";
  const boundary = experienceBoundaryFor({ status, plan, result, audit, bridge, artifactRefs });
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  const preActionGuidance = buildPreActionGuidance({
    surface: "dove.experience",
    responseLanguage,
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
    nextAction: boundary?.nextAction ?? (result ? "project:dove.review" : "project:dove.experience"),
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
  const resultCard = buildCommandResultCard({
    surface: "dove.experience",
    command: "run_experience_workflow",
    title: localizedText(responseLanguage, "实验记录已更新", "Experience workflow updated"),
    status,
    happened: result
      ? localizedText(responseLanguage, "已记录实验计划、结果，并完成证据完整性检查。", "Recorded the experiment plan and result, then checked evidence readiness.")
      : localizedText(responseLanguage, "已记录实验计划，等待结果材料。", "Recorded the experiment plan and is waiting for result material."),
    durableWrites: [localizedText(responseLanguage, "实验计划、结果、审计和论点衔接状态已更新。", "Experiment plan, result, review, and claim-link state were updated.")],
    evidence: result?.summary ? [localizedText(responseLanguage, "已记录实验结果摘要。", "Experiment result summary recorded.")] : [],
    validation: audit ? [audit.auditVerdict === "clean" ? localizedText(responseLanguage, "实验材料检查通过。", "Experiment material check passed.") : localizedText(responseLanguage, "实验材料检查发现缺口。", "Experiment material check found gaps.")] : [],
    boundary: publicExperienceBoundary(boundary, audit, responseLanguage),
    scope: {
      goal: plan.goal,
      outcome: result?.outcome ?? null,
      review: audit?.auditVerdict ?? null,
      claimImpact: bridge?.status === "applied" ? localizedText(responseLanguage, "已影响论点状态", "Claim state updated") : null
    },
    nextActions: [{
      title: boundary
        ? localizedText(responseLanguage, "先补齐实验材料", "Fill the experiment material gaps first")
        : result
          ? localizedText(responseLanguage, "进入 review 检查支撑力度", "Review the support strength next")
          : localizedText(responseLanguage, "补实验结果和证据", "Add experiment result and evidence"),
      why: boundary
        ? localizedText(responseLanguage, "当前结果还不能安全支撑论文论点。", "The current result cannot safely support the paper claim yet.")
        : localizedText(responseLanguage, "实验记录已经可用于下一步判断，但还需要 review 确认不要过度主张。", "The experiment record is ready for the next decision, but review should confirm it is not over-claimed.")
    }]
  }, responseLanguage);

  return {
    status,
    preActionGuidance,
    resultCard,
    packetId: target.packetId,
    plan,
    result,
    audit,
    bridge,
    boundary,
    boundaryType: boundary?.type ?? null,
    requiredActions: boundary?.requiredActions ?? [],
    artifactRefs,
    validationEvidencePaths: audit ? [ARTIFACT_PATHS.experimentAudits] : [],
    nextAction: boundary?.nextAction ?? (result ? "project:dove.review" : "project:dove.experience"),
    artifacts: artifactRefs
  };
}
