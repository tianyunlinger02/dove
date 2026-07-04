import path from "node:path";

import {
  ARTIFACT_PATHS,
  DOVE_ARCHIVED_TASK_STATUSES,
  DOVE_AUDIO_CONTEXT_POLICY,
  DOVE_TASK_CREATOR_KINDS,
  DOVE_TASK_DOMAINS,
  DOVE_TASK_STAGES,
  DOVE_TASK_STATUSES,
  createTaskPacketsIndex,
  doveExecutionContractReadiness,
  doveExecutionCriteriaCoverage,
  normalizeDoveBoundary,
  normalizeDoveBoundaryType,
  normalizeDoveExecutionContract,
  normalizeDoveExecutionReceipt,
  normalizeDoveHandoff,
  normalizeDoveVerifiedCriteria,
  normalizeDovePrimaryRoleId
} from "./schema.mjs";
import { assertGovernanceMutationRegistered, ensureWorkspace, loadState, nowIso, readJson, saveState, writeJson } from "./workspace.mjs";
import { normalizeTaskPacketId, readTaskPacketCatalog, resolveDurableTaskPacket } from "./task-packets.mjs";
import { registerSource, upsertNote, upsertDraft, buildRebuttal } from "./artifacts.mjs";
import { runFigureWorkflow } from "./figure-workflow.mjs";
import { runExperienceWorkflow } from "./experience-workflow.mjs";
import { runAudioReview } from "./audio-review.mjs";
import { runDoveReviewLoop } from "./dove-review-loop.mjs";
import { normalizeRebuttalIssues, buildRebuttalStrategy } from "./orchestration.mjs";
import { doveText, resolveDoveResponseLanguage } from "./i18n.mjs";
import { buildPreActionGuidance, summarizePreActionGuidance } from "./pre-action-guidance.mjs";
import { buildCommandResultCard } from "./result-cards.mjs";
import { appendEvent, appendResult, loadRuntimeArtifacts, saveRuntimeArtifacts } from "./runtime-state.mjs";

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "task";
}

function normalizeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean))) : [];
}

function normalizeAllowed(value, allowed, fallback) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/_/g, "-") : "";
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeStatus(value, fallback = "pending") {
  return normalizeAllowed(value, DOVE_TASK_STATUSES, fallback);
}

function normalizeLevel(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : fallback;
}

function requestedLevel(args = {}) {
  for (const value of [args.level, args.taskLevel, args.missionLevel]) {
    if (value === null || value === undefined || value === "" || typeof value === "boolean") {
      continue;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return Math.max(0, Math.floor(numeric));
    }
  }
  return null;
}

function normalizeMissionLevel(args = {}, fallback = 3) {
  const explicit = requestedLevel(args);
  const level = explicit ?? normalizeLevel(fallback, 3);
  if (level === 0) {
    throw new Error("Level 0 is reserved for the unique Dove init task. Use /dove:init for level-0 work.");
  }
  return Math.max(1, level);
}

function normalizeChildLevel(args = {}, parentLevel) {
  const explicit = requestedLevel(args);
  const minimumLevel = parentLevel + 1;
  const level = explicit ?? minimumLevel;
  if (level <= parentLevel) {
    throw new Error(`System checklist task level ${level} must be greater than parent mission level ${parentLevel}.`);
  }
  return level;
}

function hasExplicitConfirmation(args = {}) {
  return args.confirmed === true || args.confirm === true;
}

function taskPacketPath(packetId) {
  return path.join(ARTIFACT_PATHS.taskPacketsPacketsDir, `${packetId}.json`);
}

function taskContextPath(packetId) {
  return path.join(ARTIFACT_PATHS.packetContextsDir, `${packetId}.json`);
}

const ARCHIVED_TASK_STATUSES = new Set(DOVE_ARCHIVED_TASK_STATUSES);

function activeStatus(status) {
  const normalized = String(status ?? "").trim().toLowerCase();
  return !["completed", "killed"].includes(normalized) && !ARCHIVED_TASK_STATUSES.has(normalized);
}

function archivedTaskStatus(task) {
  return [task?.status, task?.lifecycleStatus].some((status) => ARCHIVED_TASK_STATUSES.has(String(status ?? "").trim().toLowerCase()));
}

function openChecklistChildForParent(task, parentId) {
  return task?.parentId === parentId
    && task.creatorKind === "system"
    && !task.derivedFrom
    && !task.sourcePlanTaskId
    && !archivedTaskStatus(task)
    && activeStatus(normalizeStatus(task.status ?? task.lifecycleStatus, "pending"));
}

function openChecklistChildrenForParent(root, parent) {
  const catalog = readTaskPacketCatalog(root);
  return Array.from(catalog.byId.values()).filter((task) => openChecklistChildForParent(task, parent.id));
}

function checklistCompletionBlock(root, task, status, responseLanguage = "zh") {
  if (status !== "completed") {
    return null;
  }
  const openChecklistChildren = openChecklistChildrenForParent(root, task);
  if (openChecklistChildren.length === 0) {
    return null;
  }
  const message = responseLanguage === "en"
    ? "The parent mission cannot be marked done while checklist children remain open."
    : "父 mission 仍有 open checklist 子项，不能标记为 done。";
  return {
    status: "needs-checklist-reconciliation",
    requestedStatus: "done",
    machineStatus: "completed",
    packetId: task.id,
    title: task.title,
    openChecklistChildIds: openChecklistChildren.map((child) => child.id),
    openChecklistChildren: openChecklistChildren.map((child) => ({
      id: child.id,
      packetId: child.id,
      title: child.title,
      status: child.status,
      displayStatus: child.status === "completed" || child.status === "killed" ? "done" : child.status,
      parentId: child.parentId
    })),
    nextAction: "project:dove.status",
    message
  };
}

function normalizeIndex(index = createTaskPacketsIndex()) {
  const base = createTaskPacketsIndex();
  const items = Array.isArray(index.items) ? index.items.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : [];
  const activeInit = items.find((item) => item.level === 0 && activeStatus(item.status)) ?? null;
  const activeItems = items.filter((item) => item.level !== 0 && activeStatus(item.status));
  const lifecycleCounts = {};
  const stageCounts = Object.fromEntries(DOVE_TASK_STAGES.map((stage) => [stage, 0]));
  const domainCounts = Object.fromEntries(DOVE_TASK_DOMAINS.map((domain) => [domain, 0]));
  const levelCounts = {};
  for (const item of items) {
    const status = archivedTaskStatus(item) ? "archived" : normalizeStatus(item.status ?? item.lifecycleStatus, "pending");
    lifecycleCounts[status] = (lifecycleCounts[status] ?? 0) + 1;
    if (DOVE_TASK_STAGES.includes(item.stage)) {
      stageCounts[item.stage] += 1;
    }
    if (DOVE_TASK_DOMAINS.includes(item.domain)) {
      domainCounts[item.domain] += 1;
    }
    const levelKey = String(Number.isFinite(item.level) ? item.level : 3);
    levelCounts[levelKey] = (levelCounts[levelKey] ?? 0) + 1;
  }
  return {
    ...base,
    ...index,
    version: base.version,
    items,
    taskModel: {
      ...base.taskModel,
      ...(index.taskModel && typeof index.taskModel === "object" && !Array.isArray(index.taskModel) ? index.taskModel : {}),
      activeInitId: activeInit?.id ?? null,
      activeTaskIds: activeItems.map((item) => item.id)
    },
    lifecycleCounts,
    stageCounts,
    domainCounts,
    levelCounts,
    updatedAt: index.updatedAt ?? null
  };
}

function writePacket(root, packet) {
  const { context: _derivedContext, ...packetRecord } = packet;
  writeJson(root, taskPacketPath(packet.id), packetRecord);
  writeJson(root, taskContextPath(packet.id), {
    id: packet.id,
    parentId: packet.parentId,
    rootId: packet.rootId,
    level: packet.level,
    creatorKind: packet.creatorKind,
    stage: packet.stage,
    domain: packet.domain,
    status: packet.status,
    dependencies: packet.dependencies,
    blockedBy: packet.blockedBy,
    lessonIds: packet.lessonIds,
    artifactRefs: packet.artifactRefs,
    contextPolicy: packet.contextPolicy,
    executionContract: normalizeDoveExecutionContract(packet.executionContract, null),
    currentFocus: packet.currentFocus,
    nextAction: packet.nextAction,
    completedAt: packet.completedAt ?? null,
    blockedReason: packet.blockedReason ?? null,
    killedAt: packet.killedAt ?? null,
    killReason: packet.killReason ?? null,
    ownerRole: packet.ownerRole ?? null,
    nextRole: packet.nextRole ?? null,
    boundary: packet.boundary ?? null,
    boundaryHistory: Array.isArray(packet.boundaryHistory) ? packet.boundaryHistory : [],
    handoff: packet.handoff ?? null,
    lastTransition: packet.lastTransition ?? null,
    updatedAt: packet.updatedAt
  });
}

function upsertIndexItem(index, packet) {
  const item = {
    id: packet.id,
    title: packet.title,
    summary: packet.summary,
    parentId: packet.parentId,
    rootId: packet.rootId,
    level: packet.level,
    creatorKind: packet.creatorKind,
    stage: packet.stage,
    domain: packet.domain,
    status: packet.status,
    lifecycleStatus: packet.lifecycleStatus,
    dependencies: packet.dependencies,
    blockedBy: packet.blockedBy,
    createdAt: packet.createdAt,
    updatedAt: packet.updatedAt,
    completedAt: packet.completedAt ?? null,
    blockedReason: packet.blockedReason ?? null,
    killedAt: packet.killedAt ?? null,
    killReason: packet.killReason ?? null,
    ownerRole: packet.ownerRole ?? null,
    nextRole: packet.nextRole ?? null,
    boundary: packet.boundary ?? null,
    boundaryHistory: Array.isArray(packet.boundaryHistory) ? packet.boundaryHistory : [],
    handoff: packet.handoff ?? null,
    lastTransition: packet.lastTransition ?? null,
    lessonIds: packet.lessonIds,
    artifactRefs: packet.artifactRefs,
    contextPolicy: packet.contextPolicy,
    executionContract: normalizeDoveExecutionContract(packet.executionContract, null),
    packetPath: packet.packetPath,
    packetContextPath: packet.packetContextPath,
    currentFocus: packet.currentFocus,
    nextAction: packet.nextAction
  };
  const items = [...(index.items ?? []).filter((existing) => existing.id !== item.id), item].sort((left, right) => (left.level ?? 3) - (right.level ?? 3) || String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? "")) || left.id.localeCompare(right.id));
  return normalizeIndex({ ...index, items, updatedAt: packet.updatedAt });
}

function loadTaskIndex(root) {
  return normalizeIndex(readJson(root, ARTIFACT_PATHS.taskPacketsIndex, createTaskPacketsIndex));
}

function saveTaskIndex(root, index) {
  const normalized = normalizeIndex(index);
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, normalized);
  return normalized;
}

function initPacket(index) {
  return (index.items ?? []).find((item) => item.level === 0 && item.status !== "killed") ?? null;
}

function workflowSignals(text) {
  const value = String(text ?? "").toLowerCase();
  const source = /\b(source|sources|citation|citations|literature|paper search|reference|references|bibliography|template|templates|author kit|latex|overleaf|venue|venues|guideline|guidelines|style file|style files|call for papers|cfp|ranking|rankings|journal|journals|conference|conferences|evidence[-_ ]?urls?|provenance|deposit|bind|archive)\b|来源|引用|文献|模板|作者包|会议|期刊|一区|高水平|写作风格|审稿偏好|证据链接|沉淀|绑定|归档/u.test(value);
  const reviewLoop = /\b(review-loop|revision loop)\b|审稿循环|评审循环/u.test(value);
  const review = /\b(review|audit|audio|verify|check|integrity)\b|审查|审核|复审|检查|完整性/u.test(value);
  const figure = /\b(figure|diagram|pipeline overview)\b|示意图|流程图|图表/u.test(value);
  const draft = /\b(draft|revise|section|introduction|abstract)\b|草稿|修改|章节|引言|摘要/u.test(value);
  const experiment = /\b(experiment|ablation|baseline|metric|result)\b|实验|消融|指标|结果/u.test(value);
  const plan = /\b(plan|design|outline|proposal)\b|规划|计划|方案/u.test(value);
  const paper = source || figure || draft || /\b(paper|claim|rebuttal|reviewer)\b|论文|返修|审稿/u.test(value);
  return { source, reviewLoop, review, figure, draft, experiment, plan, paper };
}

function workflowCommandFromSignals(signals = {}) {
  if (signals.source) {
    return "dove.source";
  }
  if (signals.reviewLoop) {
    return "dove.review-loop";
  }
  if (signals.review) {
    return "dove.review";
  }
  if (signals.figure) {
    return "dove.figure";
  }
  if (signals.draft) {
    return "dove.draft";
  }
  if (signals.experiment) {
    return "dove.experience";
  }
  return null;
}

function projectCommandForWorkflow(command) {
  return command ? `project:${command}` : null;
}

function classifyTask(args = {}) {
  const text = [args.goal, args.objective, args.prompt, args.title, args.summary, args.intent].map((item) => String(item ?? "").toLowerCase()).join(" ");
  const explicitStage = normalizeAllowed(args.stage ?? args.missionStage, DOVE_TASK_STAGES, null);
  const explicitDomain = normalizeAllowed(args.domain ?? args.doveDomain ?? args.missionDomain, DOVE_TASK_DOMAINS, null);
  const signals = workflowSignals(text);
  const workflowCommand = workflowCommandFromSignals(signals);
  const stage = explicitStage ?? (signals.source ? "execute" : signals.review || signals.reviewLoop ? "audit" : signals.plan ? "plan" : "execute");
  const domain = explicitDomain ?? (signals.experiment ? "experiment" : signals.paper ? "paper" : "engineering");
  return {
    stage,
    domain,
    workflowCommand,
    rationale: [`stage=${stage}`, `domain=${domain}`, workflowCommand ? `workflow=${workflowCommand}` : null].filter(Boolean)
  };
}

function nextCommandFor(classification) {
  const workflowCommand = projectCommandForWorkflow(classification.workflowCommand);
  if (workflowCommand) {
    return workflowCommand;
  }
  if (classification.stage === "audit") {
    return "project:dove.review";
  }
  if (classification.domain === "experiment") {
    return "project:dove.experience";
  }
  if (classification.domain === "paper" && classification.stage === "execute") {
    return "project:dove.draft";
  }
  return "project:dove.auto";
}

function publicMissionCommand(command, fallback = "project:dove.auto") {
  const normalized = normalizeString(command, "");
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
    run_audio_review: "project:dove.review",
    run_dove_review_loop: "project:dove.review-loop",
    run_experience_workflow: "project:dove.experience",
    run_figure_workflow: "project:dove.figure",
    register_source: "project:dove.source",
    upsert_note: "project:dove.note",
    upsert_draft: "project:dove.draft",
    build_rebuttal: "project:dove.rebuttal"
  };
  return toolRoutes[normalized] ?? fallback;
}

function copyableMissionCommand(command, packetId) {
  const publicCommand = publicMissionCommand(command);
  return packetId ? `${publicCommand} --packet-id ${packetId}` : publicCommand;
}

function normalizeContractStringArray(value) {
  if (Array.isArray(value)) {
    return normalizeStringArray(value);
  }
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

function firstContractStringArray(...values) {
  for (const value of values) {
    const normalized = normalizeContractStringArray(value);
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return [];
}

function defaultContractDeliverables(task = {}, responseLanguage = "zh") {
  if (task.stage === "audit") {
    return normalizeContractStringArray(doveText(responseLanguage, "workContractDeliverablesAudit", { title: task.title }));
  }
  if (task.stage === "plan") {
    return normalizeContractStringArray(doveText(responseLanguage, "workContractDeliverablesPlan", { title: task.title }));
  }
  if (task.domain === "experiment") {
    return normalizeContractStringArray(doveText(responseLanguage, "workContractDeliverablesExperiment", { title: task.title }));
  }
  if (task.domain === "paper") {
    return normalizeContractStringArray(doveText(responseLanguage, "workContractDeliverablesPaper", { title: task.title }));
  }
  return normalizeContractStringArray(doveText(responseLanguage, "workContractDeliverablesEngineering", { title: task.title }));
}

function defaultContractEvidence(task = {}, responseLanguage = "zh") {
  const evidence = normalizeContractStringArray(task.evidenceExpectations);
  return evidence.length > 0 ? evidence : normalizeContractStringArray(doveText(responseLanguage, "workContractEvidenceDefault", { title: task.title }));
}

function defaultContractDoneCriteria(task = {}, responseLanguage = "zh") {
  return normalizeContractStringArray(doveText(responseLanguage, "workContractDoneDefault", { title: task.title }));
}

function defaultContractOutOfScope(responseLanguage = "zh") {
  return normalizeContractStringArray(doveText(responseLanguage, "workContractOutOfScopeDefault"));
}

function defaultContractImpact(task = {}, responseLanguage = "zh") {
  if (task.stage === "audit") {
    return doveText(responseLanguage, "workContractImpactAudit", { title: task.title });
  }
  if (task.stage === "plan") {
    return doveText(responseLanguage, "workContractImpactPlan", { title: task.title });
  }
  if (task.domain === "experiment") {
    return doveText(responseLanguage, "workContractImpactExperiment", { title: task.title });
  }
  if (task.domain === "paper") {
    return doveText(responseLanguage, "workContractImpactPaper", { title: task.title });
  }
  return doveText(responseLanguage, "workContractImpactEngineering", { title: task.title });
}

function routeLabelFor(command, responseLanguage = "zh") {
  if (command === "project:dove.auto") {
    return doveText(responseLanguage, "workContractRouteAutoLabel");
  }
  if (command === "project:dove.review" || command === "project:dove.review-loop") {
    return doveText(responseLanguage, "workContractRouteReviewLabel");
  }
  return doveText(responseLanguage, "workContractRoutePrimaryLabel");
}

function routeWhenFor(command, responseLanguage = "zh") {
  if (command === "project:dove.auto") {
    return doveText(responseLanguage, "workContractRouteAutoWhen");
  }
  if (command === "project:dove.review" || command === "project:dove.review-loop") {
    return doveText(responseLanguage, "workContractRouteReviewWhen");
  }
  return doveText(responseLanguage, "workContractRoutePrimaryWhen");
}

function normalizeContractRoutes(routes, task = {}, responseLanguage = "zh") {
  return (Array.isArray(routes) ? routes : []).map((route, index) => {
    const source = typeof route === "string" ? { command: route } : plainObject(route);
    const command = publicMissionCommand(source.command ?? source.nextAction ?? source.workflow, publicMissionCommand(task.nextAction ?? nextCommandFor(task)));
    if (!command) {
      return null;
    }
    return {
      label: normalizeString(source.label ?? source.title, routeLabelFor(command, responseLanguage)),
      command,
      copyableCommand: normalizeString(source.copyableCommand ?? source.copyCommand, copyableMissionCommand(command, task.id)),
      packetId: normalizeString(source.packetId ?? source.taskPacketId ?? source.missionPacketId, task.id ?? null),
      when: normalizeString(source.when ?? source.reason, routeWhenFor(command, responseLanguage)),
      role: normalizeDovePrimaryRoleId(source.role ?? source.ownerRole ?? task.nextRole ?? task.ownerRole, ownerRoleFor(task)),
      evidenceRequired: firstContractStringArray(source.evidenceRequired, source.evidenceContract, source.evidenceExpectations, task.evidenceExpectations),
      doneCriteria: firstContractStringArray(source.doneCriteria, task.workContract?.doneCriteria),
      rank: Number.isFinite(source.rank) ? source.rank : index + 1
    };
  }).filter(Boolean);
}

function defaultContractRoutes(task = {}, responseLanguage = "zh") {
  const primary = publicMissionCommand(task.nextAction ?? nextCommandFor(task));
  const routes = [{ command: primary }];
  if (primary !== "project:dove.auto") {
    routes.push({ command: "project:dove.auto" });
  }
  return normalizeContractRoutes(routes, task, responseLanguage);
}

function normalizeWorkContract(task = {}, args = {}, classification = {}, responseLanguage = "zh") {
  const classifiedTask = {
    ...task,
    stage: task.stage ?? classification.stage ?? "execute",
    domain: task.domain ?? classification.domain ?? "engineering"
  };
  const explicit = plainObject(args.workContract ?? task.workContract);
  const deliverables = firstContractStringArray(explicit.deliverables, args.deliverables, defaultContractDeliverables(classifiedTask, responseLanguage));
  const evidenceContract = firstContractStringArray(explicit.evidenceContract, args.evidenceContract, args.evidenceExpectations, args.acceptanceChecks, defaultContractEvidence(classifiedTask, responseLanguage));
  const doneCriteria = firstContractStringArray(explicit.doneCriteria, args.doneCriteria, args.acceptanceChecks, defaultContractDoneCriteria(classifiedTask, responseLanguage));
  const outOfScope = firstContractStringArray(explicit.outOfScope, explicit.outOfScopeItems, args.outOfScope, args.outOfScopeItems, defaultContractOutOfScope(responseLanguage));
  const recommendedRoutes = normalizeContractRoutes(explicit.recommendedRoutes ?? args.recommendedRoutes, { ...classifiedTask, workContract: { doneCriteria } }, responseLanguage);
  return {
    purpose: normalizeString(explicit.purpose ?? args.purpose, doveText(responseLanguage, "workContractPurpose", { title: classifiedTask.title, stage: classifiedTask.stage, domain: classifiedTask.domain })),
    deliverables,
    outOfScope,
    evidenceContract,
    doneCriteria,
    recommendedRoutes: recommendedRoutes.length > 0 ? recommendedRoutes : defaultContractRoutes({ ...classifiedTask, workContract: { doneCriteria } }, responseLanguage),
    practicalImpact: normalizeString(explicit.practicalImpact ?? args.practicalImpact, defaultContractImpact(classifiedTask, responseLanguage))
  };
}

function executionChainTypeFor(task = {}, classification = {}) {
  const stage = task.stage ?? classification.stage;
  const domain = task.domain ?? classification.domain;
  if (stage === "plan") {
    return "plan-to-executable-missions";
  }
  if (domain === "experiment") {
    return "experiment-plan-result-audit";
  }
  if (domain === "paper") {
    return "paper-source-note-draft-review";
  }
  return "engineering-host-pass-verify";
}

function roleSequenceForExecutionContract(task = {}, classification = {}) {
  const stage = task.stage ?? classification.stage;
  if (stage === "plan") {
    return ["planner", "builder", "reviewer"];
  }
  if (stage === "audit") {
    return ["reviewer"];
  }
  return ["builder", "reviewer"];
}

function defaultExecutionFailureRoutes(task = {}, responseLanguage = "zh") {
  const routes = [
    { on: "missing-required-materials", boundaryType: "missing-required-materials", nextAction: "project:dove.status", requiredActions: ["provide-required-materials"] },
    { on: "verification-failed", boundaryType: "verification-failed", nextAction: "project:dove.status", requiredActions: ["provide-verified-criteria"] },
    { on: "reviewer-rejection", boundaryType: "fix-required", nextAction: "project:dove.status", requiredActions: ["revise-and-return-evidence"] }
  ];
  if (task.stage === "plan") {
    routes.unshift({ on: "plan-output-not-executable", boundaryType: "plan-output-not-executable", nextAction: "project:dove.status", requiredActions: ["provide-executable-child-missions"] });
  }
  return routes.map((route) => ({
    ...route,
    requiredActions: route.requiredActions.length > 0 ? route.requiredActions : [doveText(responseLanguage, "compactCardNoEvidence")]
  }));
}

function defaultExecutionImplementation(task = {}, workContract = {}, responseLanguage = "zh") {
  const implementation = firstContractStringArray(workContract.deliverables, task.evidenceExpectations);
  if (implementation.length > 0) {
    return implementation;
  }
  return [doveText(responseLanguage, "executePlannedWork")];
}

function defaultExecutionContract(task = {}, args = {}, classification = {}, workContract = {}, responseLanguage = "zh") {
  const nextAction = normalizeString(task.nextAction ?? args.nextAction, nextCommandFor(classification));
  return {
    chainType: executionChainTypeFor(task, classification),
    roleSequence: roleSequenceForExecutionContract(task, classification),
    readFirst: normalizeStringArray(args.readFirst),
    action: nextAction,
    implementation: defaultExecutionImplementation(task, workContract, responseLanguage),
    files: [],
    materials: {
      requiredInputs: normalizeStringArray(args.requiredInputs),
      requiredArtifacts: normalizeStringArray(args.requiredArtifacts),
      sourceRefs: normalizeStringArray(args.sourceRefs),
      artifactRefs: normalizeStringArray(task.artifactRefs)
    },
    convergence: {
      criteria: firstContractStringArray(workContract.doneCriteria, args.acceptanceChecks),
      verificationCommands: normalizeStringArray(args.verificationCommands),
      evidenceRequired: firstContractStringArray(workContract.evidenceContract, task.evidenceExpectations),
      definitionOfDone: normalizeString(workContract.practicalImpact, "")
    },
    failureRoutes: defaultExecutionFailureRoutes(task, responseLanguage)
  };
}

function mergeExecutionContract(task = {}, args = {}, classification = {}, workContract = {}, responseLanguage = "zh") {
  return normalizeDoveExecutionContract(args.executionContract ?? task.executionContract, defaultExecutionContract(task, args, classification, workContract, responseLanguage));
}

function ownerRoleFor(classification = {}) {
  if (classification.stage === "audit") {
    return "reviewer";
  }
  if (classification.stage === "plan") {
    return "planner";
  }
  return "builder";
}

function compactScope(task = {}, responseLanguage = "zh") {
  return doveText(responseLanguage, "compactCardScope", {
    stage: task.stage ?? "execute",
    domain: task.domain ?? "engineering",
    status: task.status ?? "pending"
  });
}

function compactEvidence(task = {}, responseLanguage = "zh") {
  const evidence = normalizeStringArray(task.evidenceExpectations);
  return evidence.length > 0 ? evidence : [doveText(responseLanguage, "compactCardNoEvidence")];
}

function compactStepLabels(steps = []) {
  if (!Array.isArray(steps)) {
    return [];
  }
  return steps.map((step) => {
    if (typeof step === "string") {
      return step;
    }
    if (step && typeof step === "object" && !Array.isArray(step)) {
      return [step.command, step.completeTask === true ? "complete" : null].filter(Boolean).join(" ");
    }
    return "";
  }).filter(Boolean);
}

function buildTaskConfirmationCard(task = {}, context = {}, responseLanguage = "zh") {
  const workContract = task.workContract ?? context.workContract ?? null;
  const executionContract = normalizeDoveExecutionContract(task.executionContract ?? context.executionContract, null);
  const executionReadiness = doveExecutionContractReadiness(executionContract);
  return {
    presentation: "compact-task-card",
    packetId: task.id ?? null,
    title: task.title ?? doveText(responseLanguage, "taskFallbackTitle"),
    why: workContract?.practicalImpact ?? task.summary ?? context.why ?? "",
    scope: compactScope(task, responseLanguage),
    stage: task.stage ?? null,
    domain: task.domain ?? null,
    status: task.status ?? null,
    level: task.level ?? null,
    firstAction: workContract?.recommendedRoutes?.[0]?.copyableCommand ?? context.firstAction ?? task.nextAction ?? doveText(responseLanguage, "compactCardFirstActionFallback"),
    evidenceRequired: executionContract?.convergence?.evidenceRequired ?? workContract?.evidenceContract ?? compactEvidence(task, responseLanguage),
    deliverables: workContract?.deliverables ?? [],
    doneCriteria: executionContract?.convergence?.criteria ?? workContract?.doneCriteria ?? [],
    executionContract,
    executionReadiness,
    recommendedRoutes: workContract?.recommendedRoutes ?? [],
    preActionGuidance: context.preActionGuidance ?? null,
    boundaryOrResume: context.boundaryOrResume ?? doveText(responseLanguage, "compactCardBoundaryFallback"),
    confirmation: doveText(responseLanguage, "compactCardNoAutomaticExecution"),
    confirmationRequired: true,
    proposalOnly: true,
    noAutoApply: true
  };
}

function buildAutoConfirmationCard(task = {}, autoPlan = {}, context = {}, responseLanguage = "zh") {
  const proposedSteps = compactStepLabels(autoPlan.proposedSteps);
  return {
    presentation: "compact-auto-card",
    packetId: task.id ?? null,
    title: task.title ?? doveText(responseLanguage, "taskFallbackTitle"),
    scope: compactScope(task, responseLanguage),
    maxIterations: context.maxIterations ?? null,
    firstAction: proposedSteps[0] ?? task.nextAction ?? doveText(responseLanguage, "compactCardFirstActionFallback"),
    proposedSteps,
    preActionGuidance: context.preActionGuidance ?? null,
    safeToRun: autoPlan.safeToRun ?? false,
    requiresHostPass: autoPlan.requiresHostPass ?? false,
    why: autoPlan.whyThisStep ?? task.summary ?? "",
    evidenceRequired: compactEvidence(task, responseLanguage),
    boundaryOrResume: doveText(responseLanguage, "compactCardBoundaryFallback"),
    confirmation: doveText(responseLanguage, "compactCardNoAutomaticExecution"),
    confirmationRequired: true,
    proposalOnly: true,
    noAutoApply: true
  };
}

function buildOperatorQueueCard(task = {}, context = {}, responseLanguage = "zh") {
  return {
    presentation: "compact-operator-queue-card",
    queue: context.queue ?? "pending",
    packetId: task.id ?? null,
    title: task.title ?? doveText(responseLanguage, "taskFallbackTitle"),
    status: task.status ?? null,
    scope: compactScope(task, responseLanguage),
    firstAction: task.nextAction ?? context.firstAction ?? doveText(responseLanguage, "compactCardFirstActionFallback"),
    why: context.why ?? task.rationale ?? task.summary ?? "",
    evidenceRequired: compactEvidence(task, responseLanguage),
    preActionGuidance: context.preActionGuidance ?? null,
    boundaryOrResume: task.blockedReason ?? task.nextAction ?? doveText(responseLanguage, "compactCardBoundaryFallback"),
    confirmation: doveText(responseLanguage, "compactCardNoAutomaticExecution"),
    confirmationRequired: true,
    proposalOnly: true,
    noAutoApply: true
  };
}

function taskWorkflowDurableWrites(responseLanguage = "zh", { runtime = false, lifecycle = true, planConversion = null } = {}) {
  const writes = lifecycle ? [
    doveText(responseLanguage, "resultCardTaskPacketUpdated"),
    doveText(responseLanguage, "resultCardTaskIndexUpdated"),
    doveText(responseLanguage, "resultCardRuntimeEventRecorded")
  ] : [];
  if (runtime) {
    writes.push(doveText(responseLanguage, "resultCardRuntimeResultRecorded"));
  }
  if (planConversion?.createdMissions?.length > 0 || planConversion?.reusedMissions?.length > 0) {
    writes.push(`${ARTIFACT_PATHS.taskPacketsIndex}: plan missions ${planConversion.createdMissions?.length ?? 0} created, ${planConversion.reusedMissions?.length ?? 0} reused`);
  }
  return writes;
}

function buildWorkflowHandoffSuggestion(task = {}, result = {}, responseLanguage = "zh") {
  const boundary = result.boundary ?? task.boundary ?? null;
  const statusText = `${result.status ?? ""} ${result.outcome ?? ""} ${result.stopReason ?? ""}`;
  const actionableStop = Boolean(boundary) || /awaiting|blocked|required|missing|failed|exhausted|needs-/u.test(statusText);
  if (!actionableStop) {
    return null;
  }
  const ownerRole = boundary?.ownerRole ?? task.ownerRole ?? null;
  const nextRole = boundary?.nextRole ?? task.nextRole ?? ownerRole;
  const requiredInputs = normalizeStringArray(boundary?.requiredInputs);
  const requiredActions = normalizeStringArray(boundary?.requiredActions);
  const requires = normalizeStringArray([...requiredInputs, ...requiredActions]);
  const reason = boundary?.reason ?? result.stopReason ?? null;
  const roleTransfer = ownerRole && nextRole && ownerRole !== nextRole;
  return {
    presentation: "dove-handoff-suggestion",
    boundaryId: boundary?.id ?? null,
    boundaryType: boundary?.type ?? result.outcome ?? result.status ?? null,
    ownerRole,
    nextRole,
    handoff: boundary?.handoff ?? task.handoff ?? null,
    requiredInputs,
    requiredActions,
    requires,
    reason,
    summary: roleTransfer
      ? doveText(responseLanguage, "resultCardHandoffRoleTransfer", { ownerRole, nextRole })
      : doveText(responseLanguage, "resultCardHandoffResolveBoundary", { ownerRole })
  };
}

function workflowActionMetadata(task = {}, result = {}, handoffSuggestion = null) {
  const boundary = result.boundary ?? task.boundary ?? null;
  const hasHandoffContext = Boolean(boundary || handoffSuggestion);
  const requiredInputs = hasHandoffContext ? normalizeStringArray(boundary?.requiredInputs ?? handoffSuggestion?.requiredInputs) : [];
  const requiredActions = hasHandoffContext ? normalizeStringArray(boundary?.requiredActions ?? handoffSuggestion?.requiredActions) : [];
  return {
    boundary,
    boundaryId: boundary?.id ?? handoffSuggestion?.boundaryId ?? null,
    boundaryType: boundary?.type ?? handoffSuggestion?.boundaryType ?? (hasHandoffContext ? result.outcome ?? result.status ?? null : null),
    ownerRole: hasHandoffContext ? boundary?.ownerRole ?? handoffSuggestion?.ownerRole ?? task.ownerRole ?? null : null,
    nextRole: hasHandoffContext ? boundary?.nextRole ?? handoffSuggestion?.nextRole ?? task.nextRole ?? null : null,
    handoff: hasHandoffContext ? boundary?.handoff ?? task.handoff ?? handoffSuggestion?.handoff ?? null : null,
    requiredInputs,
    requiredActions,
    requires: normalizeStringArray([...requiredInputs, ...requiredActions]),
    handoffSuggestion
  };
}

function withWorkflowActionMetadata(actions = [], task = {}, result = {}, responseLanguage = "zh", handoffSuggestion = null) {
  const suggestion = handoffSuggestion ?? buildWorkflowHandoffSuggestion(task, result, responseLanguage);
  const metadata = workflowActionMetadata(task, result, suggestion);
  return (Array.isArray(actions) ? actions : []).map((action) => ({
    ...metadata,
    ...action,
    boundary: action.boundary ?? metadata.boundary,
    boundaryId: action.boundaryId ?? metadata.boundaryId,
    boundaryType: action.boundaryType ?? metadata.boundaryType,
    ownerRole: action.ownerRole ?? metadata.ownerRole,
    nextRole: action.nextRole ?? metadata.nextRole,
    handoff: action.handoff ?? metadata.handoff,
    requiredInputs: action.requiredInputs ?? metadata.requiredInputs,
    requiredActions: action.requiredActions ?? metadata.requiredActions,
    requires: action.requires ?? metadata.requires,
    handoffSuggestion: action.handoffSuggestion ?? metadata.handoffSuggestion
  }));
}

function operatorHandoffSuggestion(result = {}, responseLanguage = "zh") {
  if (result.awaitingResultTaskIds?.length > 0) {
    const requiredActions = normalizeStringArray(result.awaitingRequiredActions);
    return {
      presentation: "dove-handoff-suggestion",
      boundaryType: "awaiting-host-pass-result",
      ownerRole: "builder",
      nextRole: "builder",
      requires: result.awaitingResultTaskIds,
      requiredActions: requiredActions.length > 0 ? requiredActions : ["provide-host-pass-result"],
      reason: result.stopReason,
      summary: doveText(responseLanguage, "resultCardHandoffProvideEvidence")
    };
  }
  if (result.blockerPlanConversion?.createdMissions?.length > 0) {
    return {
      presentation: "dove-handoff-suggestion",
      boundaryType: "blocked-boundary",
      ownerRole: "planner",
      nextRole: "planner",
      requires: result.blockerPlanConversion.createdMissions.map((mission) => mission.id),
      summary: doveText(responseLanguage, "resultCardHandoffResolveBoundary", { ownerRole: "planner" })
    };
  }
  const proposedBlockedTaskIds = normalizeStringArray(result.blockerPlanConversion?.proposedBlockedTaskIds);
  if (proposedBlockedTaskIds.length > 0) {
    return {
      presentation: "dove-handoff-suggestion",
      boundaryType: "blocked-boundary",
      ownerRole: "planner",
      nextRole: "planner",
      requires: proposedBlockedTaskIds,
      requiredActions: ["rerun-operator-with-blockerInvestigationMode-create"],
      reason: result.stopReason,
      summary: doveText(responseLanguage, "resultCardHandoffResolveBoundary", { ownerRole: "planner" })
    };
  }
  return null;
}

function missionResultCard(task = {}, result = {}, context = {}, responseLanguage = "zh") {
  const handoffSuggestion = buildWorkflowHandoffSuggestion(task, result, responseLanguage);
  const nextAction = context.nextAction ?? result.iterations?.[0]?.output?.nextAction;
  const baseNextActions = Array.isArray(context.nextActions) && context.nextActions.length > 0
    ? context.nextActions
    : (nextAction ? [{ title: doveText(responseLanguage, "resultCardNextStatus"), command: nextAction, packetId: task.id }] : []);
  return buildCommandResultCard({
    surface: "dove.mission",
    command: "record_dove_mission_pass",
    packetId: task.id,
    title: task.title,
    runId: result.id,
    status: result.status,
    outcome: result.outcome,
    summary: context.summary ?? result.iterations?.[0]?.output?.summary,
    stopReason: result.stopReason,
    taskStatusBefore: result.taskStatusBefore,
    taskStatusAfter: result.taskStatusAfter,
    evidenceLinks: context.evidenceLinks,
    artifactRefs: context.artifactRefs,
    validationEvidence: context.validationEvidence,
    executionReceipt: context.executionReceipt ?? result.executionReceipt ?? result.iterations?.[0]?.output?.executionReceipt,
    evidenceExplanation: context.evidenceExplanation,
    artifactResolution: context.artifactResolution,
    durableWrites: taskWorkflowDurableWrites(responseLanguage, { runtime: true, lifecycle: true, planConversion: context.planConversion }),
    boundary: task.boundary ?? null,
    nextAction,
    nextActions: withWorkflowActionMetadata(baseNextActions, task, result, responseLanguage, handoffSuggestion),
    preActionGuidanceSummary: context.preActionGuidanceSummary ?? null,
    foreground: result.foreground,
    background: result.background,
    daemon: result.daemon
  }, responseLanguage);
}

function latestExecutionReceipt(iterations = [], fallback = null) {
  return [...(Array.isArray(iterations) ? iterations : [])]
    .reverse()
    .map((iteration) => normalizeDoveExecutionReceipt(iteration.output?.executionReceipt ?? iteration.executionReceipt, null))
    .find(Boolean) ?? normalizeDoveExecutionReceipt(fallback, null);
}

function mergeDoveExecutionReceipts(primary, fallback = null) {
  const primaryReceipt = normalizeDoveExecutionReceipt(primary, null);
  const fallbackReceipt = normalizeDoveExecutionReceipt(fallback, null);
  if (!primaryReceipt && !fallbackReceipt) {
    return null;
  }
  return normalizeDoveExecutionReceipt({
    ...(fallbackReceipt ?? {}),
    ...(primaryReceipt ?? {}),
    artifactRefs: normalizeStringArray([...(fallbackReceipt?.artifactRefs ?? []), ...(primaryReceipt?.artifactRefs ?? [])]),
    artifactPaths: normalizeStringArray([...(fallbackReceipt?.artifactPaths ?? []), ...(primaryReceipt?.artifactPaths ?? [])]),
    evidenceLinks: normalizeStringArray([...(fallbackReceipt?.evidenceLinks ?? []), ...(primaryReceipt?.evidenceLinks ?? [])]),
    evidencePaths: normalizeStringArray([...(fallbackReceipt?.evidencePaths ?? []), ...(primaryReceipt?.evidencePaths ?? [])]),
    validationEvidencePaths: normalizeStringArray([...(fallbackReceipt?.validationEvidencePaths ?? []), ...(primaryReceipt?.validationEvidencePaths ?? [])]),
    verificationEvidencePaths: normalizeStringArray([...(fallbackReceipt?.verificationEvidencePaths ?? []), ...(primaryReceipt?.verificationEvidencePaths ?? [])]),
    verifiedCriteria: normalizeDoveVerifiedCriteria([...(fallbackReceipt?.verifiedCriteria ?? []), ...(primaryReceipt?.verifiedCriteria ?? [])]),
    validationGateResults: objectArray([...(fallbackReceipt?.validationGateResults ?? []), ...(primaryReceipt?.validationGateResults ?? [])]),
    criteriaCoverage: primaryReceipt?.criteriaCoverage ?? fallbackReceipt?.criteriaCoverage ?? null,
    boundary: primaryReceipt?.boundary ?? fallbackReceipt?.boundary ?? null
  }, fallbackReceipt);
}

function autoResultCard(task = {}, result = {}, context = {}, responseLanguage = "zh") {
  const evidenceLinks = result.iterations?.flatMap((iteration) => normalizeStringArray(iteration.output?.evidenceLinks ?? iteration.evidenceLinks)) ?? [];
  const artifactRefs = result.iterations?.flatMap((iteration) => normalizeStringArray(iteration.output?.artifactRefs ?? iteration.artifactRefs)) ?? [];
  const executionReceipt = latestExecutionReceipt(result.iterations, result.executionReceipt);
  const handoffSuggestion = buildWorkflowHandoffSuggestion(task, result, responseLanguage);
  const baseNextActions = context.nextActions ?? (result.status === "awaiting-host-pass"
    ? [{ title: doveText(responseLanguage, "resultCardNextProvideEvidence"), command: "record_dove_mission_pass", packetId: task.id, confirmationRequired: true }]
    : [{ title: doveText(responseLanguage, "resultCardNextStatus"), command: context.nextAction ?? task.nextAction ?? "project:dove.status", packetId: task.id }]);
  const nextActions = withWorkflowActionMetadata(baseNextActions, task, result, responseLanguage, handoffSuggestion);
  return buildCommandResultCard({
    surface: "dove.auto",
    command: "run_dove_auto",
    packetId: task.id,
    title: task.title,
    runId: result.id,
    status: result.status,
    outcome: result.outcome,
    summary: result.outcome,
    stopReason: result.stopReason,
    taskStatusBefore: result.taskStatusBefore,
    taskStatusAfter: result.taskStatusAfter,
    evidenceLinks,
    artifactRefs,
    executionReceipt,
    durableWrites: taskWorkflowDurableWrites(responseLanguage, { runtime: true, lifecycle: result.taskStatusBefore !== result.taskStatusAfter || Boolean(result.boundary) }),
    boundary: result.boundary ?? task.boundary ?? null,
    nextActions,
    preActionGuidanceSummary: context.preActionGuidanceSummary ?? null,
    foreground: result.foreground,
    background: result.background,
    daemon: result.daemon
  }, responseLanguage);
}

function operatorResultCard(result = {}, context = {}, responseLanguage = "zh") {
  const evidenceLinks = result.iterations?.flatMap((iteration) => normalizeStringArray(iteration.evidenceLinks ?? iteration.output?.evidenceLinks)) ?? [];
  const artifactRefs = result.iterations?.flatMap((iteration) => normalizeStringArray(iteration.artifactRefs ?? iteration.output?.artifactRefs)) ?? [];
  const executionReceipt = latestExecutionReceipt(result.iterations, result.executionReceipt);
  const createdBlockerCount = result.blockerPlanConversion?.createdCount ?? result.blockerPlanConversion?.createdMissions?.length ?? 0;
  const reusedBlockerCount = result.blockerPlanConversion?.reusedCount ?? result.blockerPlanConversion?.reusedMissions?.length ?? 0;
  const proposedBlockerCount = result.blockerPlanConversion?.proposedBlockedTaskIds?.length ?? 0;
  const skippedHostPassCount = result.skippedHostPassTaskIds?.length ?? 0;
  const runtimeRecorded = result.runtimeRecorded !== false;
  const handoffSuggestion = operatorHandoffSuggestion(result, responseLanguage);
  const baseNextActions = result.awaitingResultTaskIds?.length > 0
    ? [{ title: doveText(responseLanguage, "resultCardNextProvideEvidence"), command: "project:dove.status", requires: result.awaitingResultTaskIds }]
    : [{ title: doveText(responseLanguage, "resultCardNextStatus"), command: context.nextAction ?? "project:dove.status" }];
  const nextActions = baseNextActions.map((action) => handoffSuggestion ? {
    ...action,
    boundaryId: handoffSuggestion.boundaryId,
    boundaryType: handoffSuggestion.boundaryType,
    ownerRole: handoffSuggestion.ownerRole,
    nextRole: handoffSuggestion.nextRole,
    requiredInputs: handoffSuggestion.requiredInputs,
    requiredActions: handoffSuggestion.requiredActions,
    requires: action.requires ?? handoffSuggestion.requires,
    handoffSuggestion
  } : action);
  return buildCommandResultCard({
    surface: "dove.operator",
    command: "run_dove_operator",
    packetIds: result.updatedTaskIds,
    runId: result.id,
    status: result.status,
    outcome: result.outcome,
    summary: `updated=${result.updatedTaskIds?.length ?? 0}; awaiting-results=${result.awaitingResultTaskIds?.length ?? 0}; skipped-host-pass=${skippedHostPassCount}; blockers-proposed=${proposedBlockerCount}; blockers-created=${createdBlockerCount}; blockers-reused=${reusedBlockerCount}`,
    stopReason: result.stopReason,
    evidenceLinks,
    artifactRefs,
    executionReceipt,
    durableWrites: [
      ...(runtimeRecorded ? [doveText(responseLanguage, "resultCardRuntimeResultRecorded")] : []),
      ...(result.updatedTaskIds?.length > 0 ? [doveText(responseLanguage, "resultCardTaskPacketUpdated"), doveText(responseLanguage, "resultCardTaskIndexUpdated"), doveText(responseLanguage, "resultCardRuntimeEventRecorded")] : []),
      ...(createdBlockerCount > 0 ? [`${ARTIFACT_PATHS.taskPacketsIndex}: blocker investigation missions created=${createdBlockerCount}`] : [])
    ],
    nextAction: context.nextAction ?? "project:dove.status",
    nextActions,
    preActionGuidanceSummary: context.preActionGuidanceSummary ?? null,
    foreground: result.foreground,
    background: result.background,
    daemon: result.daemon
  }, responseLanguage);
}

function statusAdjustmentResultCard(result = {}, responseLanguage = "zh") {
  const applied = Array.isArray(result.applied) ? result.applied : [];
  const skipped = Array.isArray(result.skipped) ? result.skipped : [];
  const rejected = Array.isArray(result.rejected) ? result.rejected : [];
  return buildCommandResultCard({
    surface: "dove.status",
    command: "apply_dove_status_adjustments",
    packetIds: applied.map((item) => item.packetId),
    status: result.status,
    outcome: result.status,
    summary: `applied=${applied.length}; skipped=${skipped.length}; rejected=${rejected.length}`,
    executionReceipt: result.executionReceipt ?? result.executionReceipts?.[0] ?? null,
    durableWrites: applied.length > 0 ? [doveText(responseLanguage, "resultCardTaskPacketUpdated"), doveText(responseLanguage, "resultCardTaskIndexUpdated"), doveText(responseLanguage, "resultCardRuntimeEventRecorded"), doveText(responseLanguage, "resultCardRuntimeResultRecorded")] : [],
    nextAction: "project:dove.status",
    nextActions: [{ title: doveText(responseLanguage, "resultCardNextStatus"), command: "project:dove.status" }],
    foreground: true,
    background: false,
    daemon: false
  }, responseLanguage);
}

function readOperatorLessonsIndex(root) {
  return readJson(root, ARTIFACT_PATHS.metaOperatorLessons, { lessons: [] });
}

function activeLessons(root, packetId = null) {
  const lessons = readOperatorLessonsIndex(root);
  return (Array.isArray(lessons.lessons) ? lessons.lessons : []).filter((lesson) => {
    const status = lesson.status ?? "active";
    const packetIds = normalizeStringArray(lesson.packetIds);
    return status === "active" && (!packetId || packetIds.length === 0 || packetIds.includes(packetId));
  }).map((lesson) => ({ id: lesson.id, title: lesson.title, mustObey: lesson.mustObey ?? true, nextTime: lesson.nextTime ?? [] }));
}

function preActionGuidanceForTask(root, surface, task = {}, context = {}, responseLanguage = "zh") {
  return buildPreActionGuidance({
    surface,
    responseLanguage,
    request: context.request ?? task.summary ?? task.title ?? null,
    roleId: context.roleId ?? task.ownerRole ?? task.nextRole,
    subagentSpecialty: context.subagentSpecialty,
    packet: task,
    currentContext: {
      domain: task.domain ?? context.domain ?? null,
      stage: task.stage ?? context.stage ?? null,
      primaryRole: context.roleId ?? task.ownerRole ?? task.nextRole ?? null
    },
    operatorLessons: context.operatorLessons ?? readOperatorLessonsIndex(root),
    nextAction: context.nextAction ?? task.nextAction ?? null,
    routeHint: context.routeHint ?? task.nextAction ?? null,
    workflowKind: context.workflowKind,
    domain: task.domain ?? context.domain ?? null,
    stage: task.stage ?? context.stage ?? null,
    tags: context.tags ?? []
  });
}

function preActionGuidanceSummaryForTask(root, surface, task = {}, context = {}, responseLanguage = "zh") {
  return summarizePreActionGuidance(preActionGuidanceForTask(root, surface, task, context, responseLanguage));
}

function requestTextFromArgs(args = {}) {
  return normalizeString(args.goal ?? args.objective ?? args.prompt ?? args.title ?? args.summary ?? args.request ?? args.userRequest, null);
}

function buildPacket(root, args, init, classification, overrides = {}) {
  const state = loadState(root);
  const responseLanguage = resolveDoveResponseLanguage(root, args, { state });
  const timestamp = nowIso();
  const creatorKind = overrides.creatorKind ?? normalizeAllowed(args.creatorKind, DOVE_TASK_CREATOR_KINDS, "user");
  const dependencies = normalizeStringArray(args.dependencies ?? args.dependencyIds);
  const blockedBy = normalizeStringArray(args.blockedBy ?? args.blockerIds);
  const requestedTitle = normalizeString(overrides.title ?? args.title ?? args.goal ?? args.objective ?? args.prompt, doveText(responseLanguage, "taskFallbackTitle"));
  const id = normalizeTaskPacketId(overrides.id ?? args.id ?? args.packetId ?? `task-${slugify(requestedTitle)}-${Date.now().toString(36)}`);
  const level = overrides.level ?? normalizeMissionLevel(args, state.settings.taskModel.userDefaultLevel);
  const status = normalizeStatus(overrides.status ?? args.status, dependencies.length > 0 || blockedBy.length > 0 ? "blocked" : "ready");
  const basePacket = {
    id,
    title: requestedTitle,
    summary: normalizeString(overrides.summary ?? args.summary ?? args.goal ?? args.objective ?? args.prompt, requestedTitle),
    parentId: overrides.parentId ?? init.id,
    rootId: overrides.rootId ?? init.rootId ?? init.id,
    level,
    creatorKind,
    stage: classification.stage,
    domain: classification.domain,
    status,
    lifecycleStatus: status,
    dependencies,
    blockedBy,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    blockedReason: null,
    killedAt: null,
    killReason: null,
    ownerRole: normalizeDovePrimaryRoleId(overrides.ownerRole ?? args.ownerRole, ownerRoleFor(classification)),
    nextRole: normalizeDovePrimaryRoleId(overrides.nextRole ?? args.nextRole, overrides.ownerRole ?? args.ownerRole ?? ownerRoleFor(classification)),
    boundary: normalizeDoveBoundary(overrides.boundary ?? args.boundary, null),
    boundaryHistory: [],
    handoff: normalizeDoveHandoff(overrides.handoff ?? args.handoff, null),
    lastTransition: null,
    lessonIds: normalizeStringArray(args.lessonIds),
    artifactRefs: normalizeStringArray(args.artifactRefs ?? args.artifactPaths),
    contextPolicy: normalizeString(args.contextPolicy, DOVE_AUDIO_CONTEXT_POLICY),
    packetPath: taskPacketPath(id),
    packetContextPath: taskContextPath(id),
    currentFocus: normalizeString(overrides.currentFocus ?? args.currentFocus ?? args.goal ?? args.objective ?? args.prompt, requestedTitle),
    nextAction: normalizeString(overrides.nextAction ?? args.nextAction, nextCommandFor(classification)),
    evidenceExpectations: normalizeStringArray([
      ...normalizeStringArray(args.evidenceExpectations),
      ...normalizeStringArray(args.acceptanceChecks)
    ]),
    ...(overrides.extraFields && typeof overrides.extraFields === "object" && !Array.isArray(overrides.extraFields) ? overrides.extraFields : {})
  };
  const workContract = normalizeWorkContract(basePacket, args, classification, responseLanguage);
  return {
    ...basePacket,
    workContract,
    executionContract: mergeExecutionContract(basePacket, args, classification, workContract, responseLanguage)
  };
}

function explicitChecklistItems(args = {}) {
  for (const value of [args.checklistItems, args.subtasks, args.systemTasks]) {
    if (Array.isArray(value)) {
      return value;
    }
  }
  return Array.isArray(args.checklist) ? args.checklist : [];
}

function normalizeChecklistItem(item, index, responseLanguage = "zh") {
  if (typeof item === "string") {
    return { title: item };
  }
  const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  return {
    id: source.id,
    title: normalizeString(source.title ?? source.goal ?? source.summary, doveText(responseLanguage, "checklistItem", { index: index + 1 })),
    summary: normalizeString(source.summary ?? source.goal ?? source.title, ""),
    level: requestedLevel(source),
    stage: source.stage ?? source.missionStage,
    domain: source.domain ?? source.doveDomain ?? source.missionDomain,
    status: source.status,
    dependencies: normalizeStringArray(source.dependencies ?? source.dependencyIds),
    blockedBy: normalizeStringArray(source.blockedBy ?? source.blockerIds),
    evidenceExpectations: normalizeStringArray(source.evidenceExpectations),
    artifactRefs: normalizeStringArray(source.artifactRefs ?? source.artifactPaths),
    nextAction: source.nextAction
  };
}

function shouldAutoCreateChecklist(args = {}) {
  if (args.autoChecklist === false || args.createChecklist === false || args.checklist === false) {
    return false;
  }
  if (args.autoChecklist === true || args.createChecklist === true || args.checklist === true) {
    return true;
  }
  const evidenceCount = normalizeStringArray(args.evidenceExpectations).length;
  const artifactCount = normalizeStringArray(args.artifactRefs ?? args.artifactPaths).length;
  const text = [args.goal, args.objective, args.prompt, args.title, args.summary].map((value) => String(value ?? "")).join(" ");
  const hasComplexVerb = /(implement|refactor|validate|verify|test|document|workflow|pipeline|loop|review|实现|重构|验证|测试|文档|流程|闭环|审查)/iu.test(text);
  const hasComposition = /(\band\b|\bthen\b|\bwith\b|,|，|、|并|和|以及|同时|然后)/iu.test(text);
  return evidenceCount >= 2 || artifactCount >= 3 || (hasComplexVerb && hasComposition);
}

function generatedChecklistItems(args = {}, classification, responseLanguage = "zh") {
  const explicit = explicitChecklistItems(args).map((item, index) => normalizeChecklistItem(item, index, responseLanguage));
  if (explicit.length > 0) {
    return explicit;
  }
  if (!shouldAutoCreateChecklist(args)) {
    return [];
  }
  const validationTitle = classification.stage === "audit" ? doveText(responseLanguage, "checklistReviewTitle") : doveText(responseLanguage, "checklistValidateTitle");
  return [
    { title: doveText(responseLanguage, "checklistClarifyTitle"), summary: doveText(responseLanguage, "checklistClarifySummary") },
    { title: doveText(responseLanguage, "checklistWorkTitle"), summary: doveText(responseLanguage, "checklistWorkSummary") },
    { title: validationTitle, summary: doveText(responseLanguage, "checklistValidateSummary") }
  ];
}

function buildChecklistTasks(root, args, parent, classification, responseLanguage = "zh") {
  const timestamp = nowIso();
  return generatedChecklistItems(args, classification, responseLanguage).map((item, index) => {
    const normalized = normalizeChecklistItem(item, index, responseLanguage);
    const title = normalized.title;
    const id = normalizeTaskPacketId(normalized.id ?? `${parent.id}-checklist-${index + 1}-${slugify(title)}`);
    const level = normalizeChildLevel(normalized, parent.level);
    const status = normalizeStatus(normalized.status, normalized.dependencies.length > 0 || normalized.blockedBy.length > 0 ? "blocked" : "ready");
    const baseTask = {
      id,
      title,
      summary: normalizeString(normalized.summary, title),
      parentId: parent.id,
      rootId: parent.rootId,
      level,
      creatorKind: "system",
      stage: normalizeAllowed(normalized.stage, DOVE_TASK_STAGES, parent.stage),
      domain: normalizeAllowed(normalized.domain, DOVE_TASK_DOMAINS, parent.domain),
      status,
      lifecycleStatus: status,
      dependencies: normalized.dependencies,
      blockedBy: normalized.blockedBy,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      blockedReason: null,
      killedAt: null,
      killReason: null,
      ownerRole: normalizeDovePrimaryRoleId(parent.ownerRole, ownerRoleFor(parent)),
      nextRole: normalizeDovePrimaryRoleId(parent.nextRole, parent.ownerRole ?? ownerRoleFor(parent)),
      boundary: null,
      boundaryHistory: [],
      handoff: null,
      lastTransition: null,
      lessonIds: [],
      artifactRefs: normalized.artifactRefs,
      contextPolicy: parent.contextPolicy,
      packetPath: taskPacketPath(id),
      packetContextPath: taskContextPath(id),
      currentFocus: normalizeString(normalized.summary, title),
      nextAction: normalizeString(normalized.nextAction, parent.nextAction),
      evidenceExpectations: normalized.evidenceExpectations
    };
    const taskClassification = { stage: baseTask.stage, domain: baseTask.domain };
    const workContract = normalizeWorkContract(baseTask, normalized, taskClassification, responseLanguage);
    return {
      ...baseTask,
      workContract,
      executionContract: mergeExecutionContract(baseTask, normalized, taskClassification, workContract, responseLanguage)
    };
  });
}

function checklistContract(tasks = []) {
  return {
    autoSelected: tasks.length > 0,
    itemCount: tasks.length,
    items: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      summary: task.summary,
      parentId: task.parentId,
      rootId: task.rootId,
      level: task.level,
      creatorKind: task.creatorKind,
      stage: task.stage,
      domain: task.domain,
      status: task.status,
      dependencies: task.dependencies,
      blockedBy: task.blockedBy,
      evidenceExpectations: task.evidenceExpectations,
      artifactRefs: task.artifactRefs,
      nextAction: task.nextAction
    }))
  };
}

export function initDoveGoal(root, args = {}) {
  assertGovernanceMutationRegistered("init-dove-goal", "guarded");
  ensureWorkspace(root);
  const timestamp = nowIso();
  const state = loadState(root);
  const responseLanguage = resolveDoveResponseLanguage(root, args, { state });
  const index = loadTaskIndex(root);
  const existing = initPacket(index);
  const title = normalizeString(args.title ?? args.goal ?? state.dove.title, state.dove.title);
  const objective = normalizeString(args.objective ?? args.goal ?? args.summary, state.dove.objective);
  const packetId = existing?.id ?? normalizeTaskPacketId(args.id ?? "init");
  const packet = {
    ...(existing ?? {}),
    id: packetId,
    title,
    summary: objective,
    parentId: null,
    rootId: packetId,
    level: 0,
    creatorKind: "user",
    stage: "plan",
    domain: normalizeAllowed(args.domain ?? args.doveDomain, DOVE_TASK_DOMAINS, "engineering"),
    status: normalizeStatus(args.status, "ready"),
    lifecycleStatus: normalizeStatus(args.status, "ready"),
    dependencies: [],
    blockedBy: [],
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    completedAt: null,
    blockedReason: null,
    killedAt: null,
    killReason: null,
    ownerRole: "planner",
    nextRole: "planner",
    boundary: null,
    boundaryHistory: [],
    handoff: null,
    lastTransition: null,
    lessonIds: normalizeStringArray(existing?.lessonIds),
    artifactRefs: normalizeStringArray(args.artifactRefs ?? existing?.artifactRefs),
    contextPolicy: DOVE_AUDIO_CONTEXT_POLICY,
    packetPath: taskPacketPath(packetId),
    packetContextPath: taskContextPath(packetId),
    currentFocus: objective,
    nextAction: "project:dove.mission"
  };
  writePacket(root, packet);
  const nextIndex = saveTaskIndex(root, upsertIndexItem(index, packet));
  saveState(root, {
    ...state,
    dove: {
      ...state.dove,
      title,
      objective
    },
    pipeline: {
      ...state.pipeline,
      currentStage: "init",
      resumeCommand: "project:dove.mission",
      updatedAt: timestamp
    },
    orchestration: {
      ...state.orchestration,
      activeTaskIds: nextIndex.taskModel.activeTaskIds,
      currentFocus: objective,
      nextAction: doveText(responseLanguage, "initNextActionDisplay")
    }
  });
  return {
    status: existing ? "updated" : "created",
    initId: packet.id,
    init: packet,
    nextAction: "project:dove.mission",
    responseLanguage,
    taskIndexPath: ARTIFACT_PATHS.taskPacketsIndex
  };
}

function buildProposedInitPacket(root, args = {}, classification = { domain: "engineering" }, responseLanguage = "zh") {
  const state = loadState(root);
  const timestamp = nowIso();
  const title = normalizeString(args.initTitle ?? args.projectTitle ?? args.workspaceTitle ?? state.dove.title, state.dove.title);
  const objective = normalizeString(args.initObjective ?? args.initGoal ?? args.projectObjective ?? args.projectGoal ?? state.dove.objective ?? args.goal ?? args.objective ?? args.summary, state.dove.objective ?? doveText(responseLanguage, "projectTitleFallback"));
  const packetId = normalizeTaskPacketId(args.initId ?? "init");
  return {
    id: packetId,
    title,
    summary: objective,
    parentId: null,
    rootId: packetId,
    level: 0,
    creatorKind: "user",
    stage: "plan",
    domain: normalizeAllowed(args.initDomain ?? args.projectDomain ?? classification.domain, DOVE_TASK_DOMAINS, "engineering"),
    status: normalizeStatus(args.initStatus, "ready"),
    lifecycleStatus: normalizeStatus(args.initStatus, "ready"),
    dependencies: [],
    blockedBy: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    blockedReason: null,
    killedAt: null,
    killReason: null,
    ownerRole: "planner",
    nextRole: "planner",
    boundary: null,
    boundaryHistory: [],
    handoff: null,
    lastTransition: null,
    lessonIds: [],
    artifactRefs: normalizeStringArray(args.initArtifactRefs),
    contextPolicy: DOVE_AUDIO_CONTEXT_POLICY,
    packetPath: taskPacketPath(packetId),
    packetContextPath: taskContextPath(packetId),
    currentFocus: objective,
    nextAction: "project:dove.mission"
  };
}

function buildDoveTaskContract(root, args = {}) {
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  const index = loadTaskIndex(root);
  const classification = classifyTask(args);
  const existingInit = initPacket(index);
  const proposedInit = existingInit ? null : buildProposedInitPacket(root, args, classification, responseLanguage);
  const init = existingInit ?? proposedInit;
  const packet = buildPacket(root, args, init, classification);
  const checklistTasks = buildChecklistTasks(root, args, packet, classification, responseLanguage);
  const checklistProposal = checklistContract(checklistTasks);
  return {
    index,
    init,
    proposedInit,
    initMaterializationRequired: proposedInit !== null,
    classification,
    packet,
    checklistTasks,
    checklistProposal,
    blockers: [...packet.dependencies, ...packet.blockedBy],
    executionContract: packet.executionContract,
    executionReadiness: doveExecutionContractReadiness(packet.executionContract),
    applicableLessons: activeLessons(root, packet.id),
    responseLanguage
  };
}

function materializeDoveTask(root, contract) {
  const { index, packet, checklistTasks, checklistProposal, classification, blockers, applicableLessons, responseLanguage, proposedInit } = contract;
  let nextIndex = index;
  if (proposedInit) {
    writePacket(root, proposedInit);
    nextIndex = upsertIndexItem(nextIndex, proposedInit);
  }
  writePacket(root, packet);
  nextIndex = upsertIndexItem(nextIndex, packet);
  for (const checklistTask of checklistTasks) {
    writePacket(root, checklistTask);
    nextIndex = upsertIndexItem(nextIndex, checklistTask);
  }
  nextIndex = saveTaskIndex(root, nextIndex);
  const state = loadState(root);
  saveState(root, {
    ...state,
    ...(proposedInit ? {
      dove: {
        ...state.dove,
        title: proposedInit.title,
        objective: proposedInit.summary
      },
      pipeline: {
        ...state.pipeline,
        currentStage: state.pipeline?.currentStage ?? "init",
        resumeCommand: "project:dove.mission",
        updatedAt: proposedInit.updatedAt
      }
    } : {}),
    orchestration: {
      ...state.orchestration,
      activeTaskIds: nextIndex.taskModel.activeTaskIds,
      currentFocus: packet.currentFocus,
      nextAction: packet.nextAction
    }
  });
  return {
    createdInit: proposedInit,
    initMaterializationRequired: proposedInit !== null,
    createdTask: packet,
    createdChecklistTasks: checklistTasks,
    checklistProposal,
    classification,
    blockers,
    evidenceExpectations: packet.evidenceExpectations,
    workContract: packet.workContract,
    executionContract: packet.executionContract,
    executionReadiness: doveExecutionContractReadiness(packet.executionContract),
    recommendedNextCommand: packet.nextAction,
    applicableLessons,
    responseLanguage,
    taskIndexPath: ARTIFACT_PATHS.taskPacketsIndex
  };
}

function objectArray(value) {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined) : [];
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizePlanMissionSource(item) {
  if (typeof item === "string") {
    return { title: item, summary: item };
  }
  const source = plainObject(item);
  const title = normalizeString(source.title ?? source.goal ?? source.objective ?? source.summary, null);
  return {
    ...source,
    title,
    summary: normalizeString(source.summary ?? source.goal ?? source.objective, title)
  };
}

function planMissionSources(args = {}, planTask, responseLanguage = "zh") {
  const planConversion = plainObject(args.planConversion);
  const missionInputs = [
    ...objectArray(planConversion.plannedMissions),
    ...objectArray(planConversion.resultingMissions),
    ...objectArray(planConversion.missions),
    ...objectArray(args.plannedMissions),
    ...objectArray(args.resultingMissions),
    ...objectArray(args.missions)
  ];
  const globalChildren = [
    ...objectArray(planConversion.childMissions),
    ...objectArray(args.childMissions)
  ];
  if (missionInputs.length === 0 && globalChildren.length === 0) {
    return [];
  }
  const topMissions = missionInputs.length > 0
    ? missionInputs.map((item) => normalizePlanMissionSource(item))
    : globalChildren.map((item) => normalizePlanMissionSource(item));
  return topMissions.map((mission, index) => ({
    ...mission,
    childMissions: [
      ...objectArray(mission.childMissions),
      ...(missionInputs.length > 0 && index === 0 ? globalChildren : [])
    ]
  }));
}

function flattenPlanMissionSources(sources = []) {
  return sources.flatMap((source) => [source, ...flattenPlanMissionSources(objectArray(source.childMissions))]);
}

function planOutputExecutionBlock(task, args = {}, responseLanguage = "zh") {
  if (task.stage !== "plan") {
    return null;
  }
  const sources = planMissionSources(args, task, responseLanguage);
  if (sources.length === 0) {
    return {
      status: "plan-output-not-executable",
      requestedStatus: "completed",
      packetId: task.id,
      title: task.title,
      boundaryType: "plan-output-not-executable",
      requiredActions: ["provide-executable-child-missions", "include-execution-contracts"],
      message: responseLanguage === "en"
        ? "A completed planning pass must return explicit child missions with executable contracts."
        : "完成规划 pass 必须返回带可执行合同的显式子 mission。",
      nextAction: "record_dove_mission_pass",
      proposalOnly: true,
      noAutoApply: true,
      writes: []
    };
  }
  const notExecutable = flattenPlanMissionSources(sources).map((source, index) => {
    const hasTitle = Boolean(normalizeString(source.title ?? source.goal ?? source.objective ?? source.summary, null));
    const hasExplicitContract = Object.keys(plainObject(source.executionContract)).length > 0;
    const readiness = doveExecutionContractReadiness(hasExplicitContract ? source.executionContract : null);
    const missing = [hasTitle ? null : "title", ...readiness.missing].filter(Boolean);
    return hasExplicitContract && readiness.ready && hasTitle ? null : {
      index: index + 1,
      title: source.title,
      missing
    };
  }).filter(Boolean);
  if (notExecutable.length === 0) {
    return null;
  }
  return {
    status: "plan-output-not-executable",
    requestedStatus: "completed",
    packetId: task.id,
    title: task.title,
    boundaryType: "plan-output-not-executable",
    notExecutable,
    requiredActions: ["provide-executable-child-missions", "include-action-implementation-criteria-and-failure-routes"],
    message: responseLanguage === "en"
      ? "Each child mission returned by a planning pass must include executionContract.action, implementation, convergence.criteria, and failureRoutes."
      : "规划 pass 返回的每个子 mission 都必须包含 executionContract.action、implementation、convergence.criteria 和 failureRoutes。",
    nextAction: "record_dove_mission_pass",
    proposalOnly: true,
    noAutoApply: true,
    writes: []
  };
}

function derivedClassification(source = {}, fallback = {}) {
  return {
    stage: normalizeAllowed(source.stage ?? source.missionStage, DOVE_TASK_STAGES, fallback.stage ?? "execute"),
    domain: normalizeAllowed(source.domain ?? source.doveDomain ?? source.missionDomain, DOVE_TASK_DOMAINS, fallback.domain ?? "engineering"),
    rationale: ["derived-from-plan-mission"]
  };
}

function deterministicDerivedTaskId(source, prefix, title) {
  return normalizeTaskPacketId(source.id ?? source.packetId ?? source.taskPacketId ?? `${prefix}-${slugify(title)}`);
}

function buildDerivedTask(root, init, parent, source, options = {}) {
  const responseLanguage = options.responseLanguage ?? resolveDoveResponseLanguage(root, source);
  const title = normalizeString(source.title ?? source.goal ?? source.objective ?? source.summary, null);
  if (!title) {
    throw new Error("Derived mission requires an explicit title, goal, objective, or summary.");
  }
  const classification = derivedClassification(source, options.classification);
  const parentLevel = Number.isFinite(parent.level) ? parent.level : 0;
  const level = normalizeLevel(source.level ?? source.taskLevel ?? source.missionLevel, options.level ?? Math.max(3, parentLevel + 1));
  if (options.minimumLevel !== undefined && level < options.minimumLevel) {
    throw new Error(`Derived mission ${title} level ${level} must be at least ${options.minimumLevel}.`);
  }
  const artifactRefs = normalizeStringArray([
    ...normalizeStringArray(source.artifactRefs ?? source.artifactPaths),
    ...(options.sourcePlanTaskId ? [taskPacketPath(options.sourcePlanTaskId)] : [])
  ]);
  return buildPacket(root, {
    ...source,
    title,
    summary: normalizeString(source.summary ?? source.goal ?? source.objective, title),
    stage: classification.stage,
    domain: classification.domain,
    status: "pending",
    creatorKind: "system",
    artifactRefs,
    nextAction: source.nextAction ?? (classification.stage === "plan" ? "project:dove.mission" : nextCommandFor(classification))
  }, init, classification, {
    id: deterministicDerivedTaskId(source, options.idPrefix ?? "task", title),
    parentId: parent.id,
    rootId: parent.rootId ?? parent.id,
    level,
    status: "pending",
    creatorKind: "system",
    extraFields: {
      sourcePlanTaskId: options.sourcePlanTaskId ?? null,
      sourceMissionPassRunId: options.sourceMissionPassRunId ?? null,
      derivedFrom: options.derivedFrom ?? "plan-mission-pass"
    }
  });
}

function persistDerivedTaskIndex(root, index, focusTask = null) {
  const nextIndex = saveTaskIndex(root, index);
  const state = loadState(root);
  saveState(root, {
    ...state,
    orchestration: {
      ...state.orchestration,
      activeTaskIds: nextIndex.taskModel.activeTaskIds,
      currentFocus: focusTask?.currentFocus ?? state.orchestration.currentFocus,
      nextAction: focusTask?.nextAction ?? state.orchestration.nextAction
    }
  });
  return nextIndex;
}

function materializeOneDerivedTask(root, index, packet, catalog) {
  const existing = catalog.byId.get(packet.id) ?? null;
  if (existing) {
    return { index, packet: existing, created: false };
  }
  writePacket(root, packet);
  catalog.byId.set(packet.id, packet);
  return { index: upsertIndexItem(index, packet), packet, created: true };
}

function materializePlanResultMissions(root, planTask, args = {}, runId) {
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  const index = loadTaskIndex(root);
  const init = initPacket(index);
  if (!init) {
    throw new Error("Plan mission conversion requires the level-0 init task.");
  }
  const catalog = readTaskPacketCatalog(root);
  let nextIndex = index;
  const createdMissions = [];
  const reusedMissions = [];
  const topSources = planMissionSources(args, planTask, responseLanguage);
  for (const [missionIndex, source] of topSources.entries()) {
    const topPacket = buildDerivedTask(root, init, init, source, {
      idPrefix: `task-${planTask.id}-mission-${missionIndex + 1}`,
      level: normalizeLevel(source.level ?? source.taskLevel ?? source.missionLevel, 3),
      classification: { stage: "execute", domain: planTask.domain },
      sourcePlanTaskId: planTask.id,
      sourceMissionPassRunId: runId,
      derivedFrom: "completed-plan-mission"
    });
    const topResult = materializeOneDerivedTask(root, nextIndex, topPacket, catalog);
    nextIndex = topResult.index;
    (topResult.created ? createdMissions : reusedMissions).push(topResult.packet);
    const childSources = objectArray(source.childMissions).map((item) => normalizePlanMissionSource(item));
    for (const [childIndex, childSource] of childSources.entries()) {
      const childLevel = normalizeLevel(childSource.level ?? childSource.taskLevel ?? childSource.missionLevel, topResult.packet.level + 1);
      const childPacket = buildDerivedTask(root, init, topResult.packet, childSource, {
        idPrefix: `${topResult.packet.id}-mission-${childIndex + 1}`,
        level: childLevel,
        minimumLevel: topResult.packet.level + 1,
        classification: { stage: childSource.stage ?? topResult.packet.stage, domain: childSource.domain ?? topResult.packet.domain },
        sourcePlanTaskId: planTask.id,
        sourceMissionPassRunId: runId,
        derivedFrom: "completed-plan-mission-child"
      });
      const childResult = materializeOneDerivedTask(root, nextIndex, childPacket, catalog);
      nextIndex = childResult.index;
      (childResult.created ? createdMissions : reusedMissions).push(childResult.packet);
    }
  }
  const changed = createdMissions.length > 0;
  if (changed) {
    persistDerivedTaskIndex(root, nextIndex, createdMissions.at(-1));
  }
  return {
    sourcePlanTaskId: planTask.id,
    sourceMissionPassRunId: runId,
    createdMissions: createdMissions.map((mission) => ({ id: mission.id, title: mission.title, level: mission.level, stage: mission.stage, domain: mission.domain, status: mission.status, parentId: mission.parentId })),
    reusedMissions: reusedMissions.map((mission) => ({ id: mission.id, title: mission.title, level: mission.level, stage: mission.stage, domain: mission.domain, status: mission.status, parentId: mission.parentId })),
    missionCount: createdMissions.length + reusedMissions.length,
    taskIndexPath: ARTIFACT_PATHS.taskPacketsIndex
  };
}

export function createDoveTask(root, args = {}) {
  assertGovernanceMutationRegistered("create-dove-task", "guarded");
  ensureWorkspace(root);
  const contract = buildDoveTaskContract(root, args);
  const { packet, checklistProposal, classification, blockers, applicableLessons, responseLanguage, proposedInit, initMaterializationRequired } = contract;
  if (!hasExplicitConfirmation(args)) {
    const preActionGuidance = preActionGuidanceForTask(root, "dove.mission", packet, {
      request: requestTextFromArgs(args),
      roleId: "planner",
      nextAction: packet.nextAction,
      workflowKind: "mission"
    }, responseLanguage);
    return {
      status: "needs-confirmation",
      proposalOnly: true,
      noAutoApply: true,
      writes: [],
      confirmationRequired: true,
      demandConversion: true,
      executionMode: "single-foreground-pass",
      initMaterializationRequired,
      proposedInit,
      proposedTask: packet,
      workContract: packet.workContract,
      executionContract: packet.executionContract,
      executionReadiness: doveExecutionContractReadiness(packet.executionContract),
      preActionGuidance,
      taskCard: buildTaskConfirmationCard(packet, { firstAction: packet.nextAction, workContract: packet.workContract, executionContract: packet.executionContract, preActionGuidance }, responseLanguage),
      classification,
      blockers,
      evidenceExpectations: packet.evidenceExpectations,
      recommendedNextCommand: packet.nextAction,
      checklistProposal,
      applicableLessons,
      confirmArgs: {
        confirmed: true,
        ...(proposedInit ? {
          initId: proposedInit.id,
          initTitle: proposedInit.title,
          initObjective: proposedInit.summary,
          initDomain: proposedInit.domain
        } : {}),
        id: packet.id,
        goal: packet.summary,
        title: packet.title,
        summary: packet.summary,
        stage: packet.stage,
        domain: packet.domain,
        level: packet.level,
        creatorKind: packet.creatorKind,
        status: packet.status,
        dependencies: packet.dependencies,
        blockedBy: packet.blockedBy,
        evidenceExpectations: packet.evidenceExpectations,
        workContract: packet.workContract,
        executionContract: packet.executionContract,
        artifactRefs: packet.artifactRefs,
        contextPolicy: packet.contextPolicy,
        lessonIds: packet.lessonIds,
        checklistItems: checklistProposal.items
      },
      taskIndexPath: ARTIFACT_PATHS.taskPacketsIndex,
      responseLanguage,
      message: doveText(responseLanguage, "createTaskConfirmMessage")
    };
  }
  const materialized = materializeDoveTask(root, contract);
  const preActionGuidanceSummary = preActionGuidanceSummaryForTask(root, "dove.mission", materialized.createdTask, {
    request: requestTextFromArgs(args),
    roleId: "planner",
    nextAction: materialized.createdTask.nextAction,
    workflowKind: "mission"
  }, responseLanguage);
  const recordMissionPassArgs = {
    packetId: materialized.createdTask.id,
    runId: normalizeTaskPacketId(args.runId ?? `mission-${materialized.createdTask.id}-${Date.now().toString(36)}`)
  };
  const baseResult = {
    confirmationRequired: false,
    demandConversion: true,
    executionMode: "single-foreground-pass",
    foreground: true,
    background: false,
    daemon: false,
    recordMissionPassTool: "record_dove_mission_pass",
    recordMissionPassArgs,
    preActionGuidanceSummary,
    message: doveText(responseLanguage, "createTaskMaterializedMessage"),
    responseLanguage,
    ...materialized
  };
  if (hasMissionPassEnvelope(args)) {
    const missionPass = recordDoveMissionPass(root, missionPassArgsForTask(materialized.createdTask, args));
    return {
      ...baseResult,
      status: "pass-recorded",
      missionPassRequired: false,
      missionPass,
      task: missionPass.task,
      result: missionPass.result,
      resultCard: missionPass.resultCard,
      nextAction: missionPass.nextAction
    };
  }
  return {
    ...baseResult,
    status: "created-awaiting-host-pass",
    missionPassRequired: true
  };
}

function candidateTasks(index) {
  return (index.items ?? []).filter((item) => item.level !== 0 && activeStatus(item.status));
}

function workflowTargetOptions() {
  return {
    targetFields: ["target", "packetTarget", "taskName", "title"],
    artifactFields: ["artifactRefs", "artifactPaths", "artifacts", "evidenceLinks", "evidencePaths", "outputPaths", "validationEvidencePaths"]
  };
}

function evidenceExplanationForResolution(artifactResolution, responseLanguage = "zh") {
  if (!artifactResolution || typeof artifactResolution !== "object" || Array.isArray(artifactResolution)) {
    return null;
  }
  const keyByCode = {
    "no-artifacts": "evidenceResolutionNoArtifacts",
    "no-selected-packet": "evidenceResolutionNoSelectedPacket",
    "accepted-self-artifacts": "evidenceResolutionAcceptedSelf",
    "accepted-descendant-artifacts": "evidenceResolutionAcceptedDescendant",
    "no-existing-artifact-owner": "evidenceResolutionNoExistingOwner",
    "artifact-conflict": "evidenceResolutionConflict"
  };
  const code = normalizeString(artifactResolution.explanationCode, "no-artifacts");
  return {
    code,
    message: doveText(responseLanguage, keyByCode[code] ?? "evidenceResolutionNoArtifacts"),
    selectedPacketId: normalizeString(artifactResolution.selectedPacketId, null),
    requestedArtifacts: normalizeStringArray(artifactResolution.requestedArtifacts),
    acceptedPacketIds: Array.isArray(artifactResolution.acceptedMatches) ? artifactResolution.acceptedMatches.map((match) => match.packetId).filter(Boolean) : [],
    conflictingPacketIds: Array.isArray(artifactResolution.conflictingMatches) ? artifactResolution.conflictingMatches.map((match) => match.packetId).filter(Boolean) : []
  };
}

function chooseTask(root, index, args = {}) {
  const candidates = candidateTasks(index);
  if (Number.isFinite(args.index)) {
    return { selected: candidates[Math.max(0, Math.floor(args.index) - 1)] ?? null, candidates };
  }
  if (hasExplicitTaskSelector(args)) {
    try {
      const resolved = resolveDurableTaskPacket(root, args, workflowTargetOptions());
      const indexed = (index.items ?? []).find((item) => item.id === resolved.packetId) ?? resolved.packet;
      return { selected: indexed, candidates, resolution: resolved.resolution, artifactResolution: resolved.artifactResolution };
    } catch (error) {
      return {
        selected: null,
        candidates: Array.isArray(error.candidates) && error.candidates.length > 0 ? error.candidates : candidates,
        resolutionError: error.message,
        resolutionErrorCode: error.resolutionErrorCode ?? error.code,
        resolutionErrorReason: error.reason,
        artifactResolution: error.artifactResolution ?? null
      };
    }
  }
  return { selected: candidates.length === 1 ? candidates[0] : null, candidates };
}

function normalizeMissionPassStatus(args = {}) {
  const envelope = plainObject(args.missionPass ?? args.passResult ?? args.result);
  const explicit = normalizeAllowed(args.resultStatus ?? args.taskStatus ?? args.missionStatus ?? envelope.resultStatus ?? envelope.taskStatus ?? envelope.missionStatus, ["completed", "blocked", "in-progress"], null);
  if (explicit) {
    return explicit;
  }
  if (args.completeTask === true || args.complete === true || args.completeOnSuccess === true || envelope.completeTask === true || envelope.complete === true || envelope.completeOnSuccess === true) {
    return "completed";
  }
  if (args.blocked === true || envelope.blocked === true) {
    return "blocked";
  }
  return "in-progress";
}

const MISSION_PASS_FIELDS = [
  "runId",
  "resultStatus",
  "taskStatus",
  "missionStatus",
  "completeTask",
  "complete",
  "completeOnSuccess",
  "blocked",
  "resultSummary",
  "outcome",
  "reason",
  "summary",
  "stopReason",
  "blockedReason",
  "boundary",
  "boundaryType",
  "boundaryId",
  "requiredInputs",
  "requiredActions",
  "ownerRole",
  "nextRole",
  "handoff",
  "handoffId",
  "evidenceLinks",
  "evidencePaths",
  "validationEvidencePaths",
  "verificationEvidencePaths",
  "verifiedCriteria",
  "executionContract",
  "executionReceipt",
  "artifactRefs",
  "artifactPaths",
  "command",
  "workflow",
  "preset",
  "nextCommand",
  "nextAction",
  "startedAt",
  "completedAt",
  "convertPlanToMissions",
  "planConversion",
  "plannedMissions",
  "resultingMissions",
  "missions",
  "childMissions"
];

function missionPassPayload(args = {}) {
  const envelope = plainObject(args.missionPass ?? args.passResult ?? args.result);
  const payload = { ...envelope };
  for (const field of MISSION_PASS_FIELDS) {
    if (args[field] !== undefined) {
      payload[field] = args[field];
    }
  }
  return payload;
}

function nonEmptyArrayField(value) {
  return Array.isArray(value) && value.length > 0;
}

function hasMissionPassEnvelope(args = {}) {
  const payload = missionPassPayload(args);
  if (Object.keys(plainObject(args.missionPass ?? args.passResult ?? args.result)).length > 0) {
    return true;
  }
  if ([payload.resultStatus, payload.taskStatus, payload.missionStatus, payload.resultSummary, payload.outcome, payload.stopReason].some((value) => typeof value === "string" && value.trim())) {
    return true;
  }
  if (payload.completeTask === true || payload.complete === true || payload.completeOnSuccess === true || payload.blocked === true) {
    return true;
  }
  return [payload.evidenceLinks, payload.evidencePaths, payload.validationEvidencePaths, payload.verificationEvidencePaths, payload.verifiedCriteria, payload.plannedMissions, payload.resultingMissions, payload.missions, payload.childMissions].some(nonEmptyArrayField)
    || Object.keys(plainObject(payload.planConversion)).length > 0;
}

function hasPlanMissionOutput(args = {}) {
  const payload = missionPassPayload(args);
  return [payload.plannedMissions, payload.resultingMissions, payload.missions, payload.childMissions].some(nonEmptyArrayField)
    || Object.keys(plainObject(payload.planConversion)).length > 0;
}

function completionEvidenceForPayload(payload = {}) {
  const receipt = normalizeDoveExecutionReceipt(payload.executionReceipt, null);
  const verifiedCriteria = normalizeDoveVerifiedCriteria([
    ...normalizeDoveVerifiedCriteria(payload.verifiedCriteria),
    ...normalizeDoveVerifiedCriteria(receipt?.verifiedCriteria)
  ]);
  const verificationEvidencePaths = normalizeStringArray([
    ...normalizeStringArray(payload.verificationEvidencePaths),
    ...normalizeStringArray(receipt?.verificationEvidencePaths)
  ]);
  const validationEvidencePaths = normalizeStringArray([
    ...normalizeStringArray(payload.validationEvidencePaths),
    ...normalizeStringArray(receipt?.validationEvidencePaths)
  ]);
  const evidenceLinks = normalizeStringArray([
    ...normalizeStringArray(payload.evidenceLinks),
    ...normalizeStringArray(payload.evidencePaths),
    ...normalizeStringArray(receipt?.evidenceLinks),
    ...normalizeStringArray(receipt?.evidencePaths)
  ]);
  const artifactRefs = normalizeStringArray([
    ...normalizeStringArray(payload.artifactRefs),
    ...normalizeStringArray(payload.artifactPaths),
    ...normalizeStringArray(receipt?.artifactRefs),
    ...normalizeStringArray(receipt?.artifactPaths)
  ]);
  const criteriaEvidencePaths = normalizeStringArray(verifiedCriteria.flatMap((item) => item.evidencePaths ?? []));
  const evidencePaths = normalizeStringArray([
    ...evidenceLinks,
    ...artifactRefs,
    ...validationEvidencePaths,
    ...verificationEvidencePaths,
    ...criteriaEvidencePaths
  ]);
  return {
    evidenceLinks,
    artifactRefs,
    validationEvidencePaths,
    verificationEvidencePaths,
    verifiedCriteria,
    criteriaEvidencePaths,
    evidencePaths,
    executionReceipt: receipt
  };
}

function completionVerificationBlock(task, args = {}, responseLanguage = "zh") {
  const payload = missionPassPayload(args);
  const contract = normalizeDoveExecutionContract(payload.executionContract ?? task.executionContract, null);
  const readiness = doveExecutionContractReadiness(contract);
  if (!readiness.ready) {
    return {
      status: "missing-executable-contract",
      requestedStatus: "completed",
      packetId: task.id,
      title: task.title,
      boundaryType: "missing-executable-contract",
      executionReadiness: readiness,
      requiredActions: ["provide-execution-contract", ...readiness.missing.map((item) => `provide-${item}`)],
      message: responseLanguage === "en"
        ? "A Dove task cannot be completed until it has an executable contract with action, implementation, convergence criteria, and failure routes."
        : "Dove 任务必须先有包含 action、implementation、convergence.criteria 和 failureRoutes 的可执行合同，才能完成。",
      nextAction: "project:dove.status",
      proposalOnly: true,
      noAutoApply: true,
      writes: []
    };
  }
  const planBlock = planOutputExecutionBlock(task, payload, responseLanguage);
  if (planBlock) {
    return planBlock;
  }
  const evidence = completionEvidenceForPayload(payload);
  const hasPlanOutput = task.stage === "plan" && hasPlanMissionOutput(payload);
  const hasCompletionEvidence = evidence.evidencePaths.length > 0 || hasPlanOutput;
  const hasSummary = Boolean(normalizeString(payload.resultSummary ?? payload.summary ?? payload.reason, ""));
  if (!hasSummary || !hasCompletionEvidence) {
    const requiredActions = [
      hasSummary ? null : "provide-result-summary",
      hasCompletionEvidence ? null : "provide-evidence-links-or-artifact-refs-or-verification-evidence"
    ].filter(Boolean);
    return {
      status: "needs-completion-evidence",
      requestedStatus: "completed",
      packetId: task.id,
      title: task.title,
      boundaryType: "missing-required-materials",
      requiredActions,
      evidenceRequired: readiness.evidenceRequired,
      message: responseLanguage === "en"
        ? "Completing a Dove task requires a result summary plus evidence, artifact, validation, or verification paths."
        : "完成 Dove 任务必须提供结果摘要，并附带 evidence、artifact、validation 或 verification 路径。",
      nextAction: "project:dove.status",
      proposalOnly: true,
      noAutoApply: true,
      writes: []
    };
  }
  const coverage = doveExecutionCriteriaCoverage(contract, evidence.verifiedCriteria);
  if (!coverage.complete) {
    return {
      status: "verification-failed",
      requestedStatus: "completed",
      packetId: task.id,
      title: task.title,
      boundaryType: "verification-failed",
      criteriaCoverage: coverage,
      requiredActions: ["provide-verified-criteria", "cover-missing-convergence-criteria", "attach-verification-evidence"],
      message: responseLanguage === "en"
        ? "Completing a Dove task requires verifiedCriteria covering every executionContract.convergence.criteria item."
        : "完成 Dove 任务必须用 verifiedCriteria 覆盖 executionContract.convergence.criteria 中的每一项。",
      nextAction: "project:dove.status",
      proposalOnly: true,
      noAutoApply: true,
      writes: []
    };
  }
  return null;
}

function buildExecutionReceipt({ payload = {}, taskBefore = {}, taskAfter = {}, runId, surface, command, actionType, status, outcome, summary, nextAction, evidence = {}, startedAt, completedAt, boundary = null }) {
  const contract = taskAfter.executionContract ?? taskBefore.executionContract ?? payload.executionContract;
  const criteriaCoverage = doveExecutionCriteriaCoverage(contract, evidence.verifiedCriteria);
  return normalizeDoveExecutionReceipt(payload.executionReceipt, {
    receiptId: `${runId}-receipt`,
    runId,
    packetId: taskAfter.id ?? taskBefore.id ?? null,
    command,
    surface,
    actionType,
    startedAt,
    completedAt,
    status,
    outcome,
    resultSummary: summary,
    publicSafeSummary: summary,
    nextAction,
    lifecycleTransition: {
      previousStatus: taskBefore.status ?? null,
      nextStatus: taskAfter.status ?? status ?? null
    },
    artifactRefs: evidence.artifactRefs,
    evidenceLinks: evidence.evidenceLinks,
    validationEvidencePaths: evidence.validationEvidencePaths,
    verificationEvidencePaths: evidence.verificationEvidencePaths,
    verifiedCriteria: evidence.verifiedCriteria,
    criteriaCoverage,
    boundary
  });
}

function missionPassArgsForTask(task, args = {}) {
  const payload = missionPassPayload(args);
  return {
    ...payload,
    packetId: task.id,
    runId: normalizeTaskPacketId(payload.runId ?? args.runId ?? `mission-${task.id}-${Date.now().toString(36)}`)
  };
}

export function recordDoveMissionPass(root, args = {}) {
  assertGovernanceMutationRegistered("record-dove-mission-pass", "guarded");
  ensureWorkspace(root);
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  const index = loadTaskIndex(root);
  const selection = chooseTask(root, index, args);
  const { selected, candidates } = selection;
  const selectionEvidenceExplanation = evidenceExplanationForResolution(selection.artifactResolution, responseLanguage);
  if (!selected) {
    return {
      status: "needs-task-selection",
      choices: taskSelectionChoices(candidates),
      responseLanguage,
      message: doveText(responseLanguage, "missionPassSelectMessage"),
      resolutionError: selection.resolutionError,
      resolutionErrorCode: selection.resolutionErrorCode,
      resolutionErrorReason: selection.resolutionErrorReason,
      artifactResolution: selection.artifactResolution ?? null,
      evidenceExplanation: selectionEvidenceExplanation
    };
  }
  if (selected.level === 0) {
    throw new Error("The level-0 init task cannot receive a mission pass result. Convert a user demand into a non-init mission first.");
  }
  const taskBefore = loadFullTask(root, selected);
  const payload = missionPassPayload(args);
  const resultStatus = normalizeMissionPassStatus(payload);
  const completionBlock = checklistCompletionBlock(root, taskBefore, resultStatus, responseLanguage);
  if (completionBlock) {
    return {
      ...completionBlock,
      responseLanguage,
      proposalOnly: true,
      noAutoApply: true,
      writes: []
    };
  }
  const verificationBlock = resultStatus === "completed" ? completionVerificationBlock(taskBefore, payload, responseLanguage) : null;
  if (verificationBlock) {
    return {
      ...verificationBlock,
      responseLanguage,
      artifactResolution: selection.artifactResolution ?? null,
      evidenceExplanation: selectionEvidenceExplanation
    };
  }
  const timestamp = nowIso();
  const runId = normalizeTaskPacketId(payload.runId ?? `mission-${taskBefore.id}-${Date.now().toString(36)}`);
  const nextAction = normalizeString(payload.nextAction, resultStatus === "completed" ? "project:dove.status" : taskBefore.nextAction ?? "project:dove.status");
  const payloadEvidence = completionEvidenceForPayload(payload);
  const artifactRefs = normalizeStringArray([...(Array.isArray(taskBefore.artifactRefs) ? taskBefore.artifactRefs : []), ...payloadEvidence.artifactRefs]);
  const lifecycleFields = lifecycleFieldsForStatus(resultStatus, payload, timestamp, responseLanguage);
  const task = updateTaskLifecycle(root, taskBefore, resultStatus, {
    ...lifecycleFields,
    runId,
    surface: "dove.mission",
    command: normalizeAutoCommandId(payload.command ?? payload.workflow ?? payload.preset ?? payload.nextCommand),
    summary: normalizeString(payload.resultSummary ?? payload.summary, ""),
    reason: normalizeString(payload.reason ?? payload.stopReason, ""),
    nextAction,
    artifactRefs,
    evidenceLinks: payloadEvidence.evidenceLinks
  });
  const evidenceLinks = payloadEvidence.evidenceLinks;
  const summary = normalizeString(payload.resultSummary ?? payload.summary, resultStatus === "completed" ? doveText(responseLanguage, "missionPassCompletedSummary") : resultStatus === "blocked" ? doveText(responseLanguage, "missionPassBlockedSummary") : doveText(responseLanguage, "missionPassProgressSummary"));
  const command = normalizeAutoCommandId(payload.command ?? payload.workflow ?? payload.preset ?? payload.nextCommand);
  const outcome = normalizeString(payload.outcome, resultStatus === "completed" ? "task-completed" : resultStatus === "blocked" ? "mission-pass-blocked" : "single-pass-progress-recorded");
  const stopReason = normalizeString(payload.stopReason, resultStatus === "blocked" ? "mission-pass-blocked" : null);
  const planConversion = taskBefore.stage === "plan" && resultStatus === "completed" && payload.convertPlanToMissions !== false
    ? materializePlanResultMissions(root, taskBefore, payload, runId)
    : null;
  const startedAt = normalizeString(args.startedAt, timestamp);
  const completedAt = normalizeString(args.completedAt, timestamp);
  const executionReceipt = buildExecutionReceipt({
    payload,
    taskBefore,
    taskAfter: task,
    runId,
    surface: "dove.mission",
    command,
    actionType: taskBefore.stage === "plan" ? "plan" : "build",
    status: resultStatus,
    outcome,
    summary,
    nextAction,
    evidence: payloadEvidence,
    startedAt,
    completedAt,
    boundary: task.boundary ?? null
  });
  const result = {
    id: runId,
    surface: "dove.mission",
    packetId: task.id,
    status: resultStatus,
    outcome,
    foreground: true,
    background: false,
    daemon: false,
    maxIterations: 1,
    iterationCount: 1,
    allowedInternalCommands: AUTO_INTERNAL_COMMANDS,
    stopReason,
    iterations: [
      {
        iteration: 1,
        command,
        status: resultStatus,
        outcome,
        stopReason,
        output: {
          summary,
          evidenceLinks,
          artifactRefs,
          validationEvidencePaths: payloadEvidence.validationEvidencePaths,
          verificationEvidencePaths: payloadEvidence.verificationEvidencePaths,
          verifiedCriteria: payloadEvidence.verifiedCriteria,
          executionReceipt,
          nextAction,
          planConversion
        },
        startedAt,
        completedAt
      }
    ],
    planConversion,
    createdPlanMissions: planConversion?.createdMissions ?? [],
    reusedPlanMissions: planConversion?.reusedMissions ?? [],
    executionReceipt,
    taskStatusBefore: taskBefore.status,
    taskStatusAfter: task.status,
    responseLanguage,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  persistAutoResult(root, result);
  const preActionGuidanceSummary = preActionGuidanceSummaryForTask(root, "dove.mission", task, {
    request: summary,
    roleId: task.ownerRole ?? "builder",
    nextAction,
    workflowKind: "mission-pass"
  }, responseLanguage);
  const resultCard = missionResultCard(task, result, {
    summary,
    evidenceLinks,
    artifactRefs,
    validationEvidence: payloadEvidence.validationEvidencePaths,
    verificationEvidence: payloadEvidence.verificationEvidencePaths,
    verifiedCriteria: payloadEvidence.verifiedCriteria,
    executionReceipt,
    planConversion,
    artifactResolution: selection.artifactResolution,
    evidenceExplanation: selectionEvidenceExplanation,
    preActionGuidanceSummary,
    nextAction,
    nextActions: resultStatus === "completed"
      ? [{ title: doveText(responseLanguage, "resultCardNextStatus"), command: nextAction, packetId: task.id }]
      : [{ title: doveText(responseLanguage, "resultCardNextProvideEvidence"), command: "project:dove.status", packetId: task.id, confirmationRequired: true }]
  }, responseLanguage);
  return {
    status: result.status,
    task,
    result,
    resultCard,
    executionReceipt,
    preActionGuidanceSummary,
    evidenceLinks,
    artifactRefs,
    validationEvidencePaths: payloadEvidence.validationEvidencePaths,
    verificationEvidencePaths: payloadEvidence.verificationEvidencePaths,
    verifiedCriteria: payloadEvidence.verifiedCriteria,
    artifactResolution: selection.artifactResolution ?? null,
    evidenceExplanation: selectionEvidenceExplanation,
    planConversion,
    createdPlanMissions: result.createdPlanMissions,
    reusedPlanMissions: result.reusedPlanMissions,
    responseLanguage,
    nextAction
  };
}

export function killDoveTask(root, args = {}) {
  assertGovernanceMutationRegistered("kill-dove-task", "guarded");
  ensureWorkspace(root);
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  const index = loadTaskIndex(root);
  const { selected, candidates } = chooseTask(root, index, args);
  if (!selected) {
    return {
      status: "needs-task-selection",
      choices: taskSelectionChoices(candidates),
      responseLanguage,
      message: doveText(responseLanguage, "killSelectMessage")
    };
  }
  if (selected.level === 0) {
    throw new Error("The level-0 init task cannot be killed. Use /dove:version to change direction while preserving init.");
  }
  const fullPacket = loadFullTask(root, selected);
  const packet = updateTaskLifecycle(root, fullPacket, "killed", lifecycleFieldsForStatus("killed", {
    ...args,
    reason: normalizeString(args.reason ?? args.killReason, doveText(responseLanguage, "killReason")),
    surface: "dove.status",
    command: "kill_dove_task"
  }, nowIso(), responseLanguage));
  return {
    status: "killed",
    killedTask: packet,
    activeTaskIds: loadTaskIndex(root).taskModel.activeTaskIds,
    responseLanguage
  };
}

function lifecycleFieldsForStatus(status, args = {}, timestamp = nowIso(), responseLanguage = "zh") {
  const fields = {};
  const nextAction = normalizeString(args.nextAction, null);
  if (nextAction) {
    fields.nextAction = nextAction;
  }
  const artifactRefs = normalizeStringArray([
    ...normalizeStringArray(args.artifactRefs),
    ...normalizeStringArray(args.artifactPaths)
  ]);
  if (artifactRefs.length > 0) {
    fields.artifactRefs = artifactRefs;
  }
  const evidence = completionEvidenceForPayload(args);
  if (evidence.evidenceLinks.length > 0) {
    fields.evidenceLinks = evidence.evidenceLinks;
  }
  if (evidence.validationEvidencePaths.length > 0) {
    fields.validationEvidencePaths = evidence.validationEvidencePaths;
  }
  if (evidence.verificationEvidencePaths.length > 0) {
    fields.verificationEvidencePaths = evidence.verificationEvidencePaths;
  }
  if (evidence.verifiedCriteria.length > 0) {
    fields.verifiedCriteria = evidence.verifiedCriteria;
  }
  const executionContract = normalizeDoveExecutionContract(args.executionContract, null);
  if (executionContract) {
    fields.executionContract = executionContract;
  }
  for (const key of ["runId", "surface", "sourceSurface", "command", "boundary", "boundaryType", "boundaryId", "requiredInputs", "requiredActions", "ownerRole", "nextRole", "handoff", "handoffId", "reason", "summary", "stopReason"]) {
    if (args[key] !== undefined) {
      fields[key] = args[key];
    }
  }
  if (status === "killed") {
    fields.killedAt = timestamp;
    fields.killReason = normalizeString(args.reason ?? args.killReason, doveText(responseLanguage, "lifecycleKillReason"));
    fields.nextAction = fields.nextAction ?? "project:dove.status";
  }
  if (status === "completed") {
    fields.completedAt = timestamp;
    fields.nextAction = fields.nextAction ?? "project:dove.status";
  }
  if (status === "blocked") {
    fields.blockedReason = normalizeString(args.reason ?? args.blockReason ?? args.blockedReason, "");
    fields.nextAction = fields.nextAction ?? "project:dove.status";
  }
  if (status === "archived") {
    fields.archivedAt = timestamp;
    fields.archiveReason = normalizeString(args.reason ?? args.archiveReason, "archived through status adjustment");
    fields.nextAction = fields.nextAction ?? "project:dove.status";
  }
  return fields;
}

function normalizeStatusAdjustment(item, index) {
  const source = plainObject(item);
  return {
    index: index + 1,
    packetId: normalizeString(source.packetId ?? source.taskPacketId ?? source.taskId ?? source.id, null),
    status: normalizeAllowed(source.status ?? source.taskStatus ?? source.missionStatus, DOVE_TASK_STATUSES, null),
    reason: normalizeString(source.reason ?? source.summary ?? source.resultSummary, ""),
    summary: normalizeString(source.summary ?? source.resultSummary ?? source.reason, ""),
    nextAction: normalizeString(source.nextAction, null),
    evidenceLinks: normalizeStringArray(source.evidenceLinks ?? source.evidencePaths),
    validationEvidencePaths: normalizeStringArray(source.validationEvidencePaths),
    verificationEvidencePaths: normalizeStringArray(source.verificationEvidencePaths),
    verifiedCriteria: normalizeDoveVerifiedCriteria(source.verifiedCriteria),
    executionReceipt: normalizeDoveExecutionReceipt(source.executionReceipt, null),
    executionContract: normalizeDoveExecutionContract(source.executionContract, null),
    artifactRefs: normalizeStringArray(source.artifactRefs ?? source.artifactPaths)
  };
}

function buildStatusAdjustmentPreviewCard(adjustment, responseLanguage = "zh") {
  return {
    presentation: "compact-status-adjustment-card",
    packetId: adjustment.packetId,
    requestedStatus: adjustment.status === "completed" ? "done" : adjustment.status,
    machineStatus: adjustment.status,
    why: adjustment.reason || doveText(responseLanguage, "statusAdjustConfirmMessage"),
    firstAction: "apply_dove_status_adjustments",
    evidenceRequired: adjustment.artifactRefs.length > 0 ? adjustment.artifactRefs : [doveText(responseLanguage, "compactCardNoEvidence")],
    boundaryOrResume: adjustment.nextAction ?? null,
    confirmation: doveText(responseLanguage, "compactCardNoAutomaticExecution"),
    confirmationRequired: true,
    proposalOnly: true,
    noAutoApply: true
  };
}

export function applyDoveStatusAdjustments(root, args = {}) {
  assertGovernanceMutationRegistered("apply-dove-status-adjustments", "guarded");
  ensureWorkspace(root);
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  const adjustments = objectArray(args.adjustments ?? args.statusAdjustments ?? args.items).map(normalizeStatusAdjustment);
  if (!hasExplicitConfirmation(args)) {
    return {
      status: "needs-confirmation",
      proposalOnly: true,
      noAutoApply: true,
      writes: [],
      confirmationRequired: true,
      statusChoices: DOVE_TASK_STATUSES,
      adjustments,
      adjustmentCards: adjustments.map((adjustment) => buildStatusAdjustmentPreviewCard(adjustment, responseLanguage)),
      confirmArgs: {
        ...args,
        confirmed: true,
        adjustments
      },
      responseLanguage,
      message: doveText(responseLanguage, "statusAdjustConfirmMessage")
    };
  }
  if (adjustments.length === 0) {
    const result = {
      status: "no-op",
      applied: [],
      skipped: [],
      rejected: [],
      statusChoices: DOVE_TASK_STATUSES,
      activeTaskIds: loadTaskIndex(root).taskModel.activeTaskIds,
      responseLanguage,
      taskIndexPath: ARTIFACT_PATHS.taskPacketsIndex
    };
    return {
      ...result,
      resultCard: statusAdjustmentResultCard(result, responseLanguage)
    };
  }
  const catalog = readTaskPacketCatalog(root);
  const adjustmentLevel = (adjustment) => {
    if (!adjustment.packetId) {
      return -1;
    }
    return catalog.byId.get(normalizeTaskPacketId(adjustment.packetId))?.level ?? -1;
  };
  const orderedAdjustments = [...adjustments].sort((left, right) => adjustmentLevel(right) - adjustmentLevel(left) || left.index - right.index);
  const resultId = normalizeTaskPacketId(args.runId ?? `status-adjust-${Date.now().toString(36)}`);
  const executionIterations = [];
  const executionReceipts = [];
  const applied = [];
  const skipped = [];
  const rejected = [];
  for (const adjustment of orderedAdjustments) {
    if (!adjustment.packetId || !adjustment.status) {
      rejected.push({ ...adjustment, reason: doveText(responseLanguage, "statusAdjustMissingReason") });
      continue;
    }
    const packetId = normalizeTaskPacketId(adjustment.packetId);
    const packet = catalog.byId.get(packetId);
    if (!packet) {
      rejected.push({ ...adjustment, packetId, reason: doveText(responseLanguage, "statusAdjustNoPacketReason") });
      continue;
    }
    if (packet.level === 0) {
      rejected.push({ ...adjustment, packetId, reason: doveText(responseLanguage, "statusAdjustInitReason") });
      continue;
    }
    const fullPacket = loadFullTask(root, packet);
    const completionBlock = checklistCompletionBlock(root, fullPacket, adjustment.status, responseLanguage);
    if (completionBlock) {
      rejected.push({ ...adjustment, packetId, reason: completionBlock.message, completionBlock });
      continue;
    }
    const verificationBlock = adjustment.status === "completed" ? completionVerificationBlock(fullPacket, { ...adjustment, resultSummary: adjustment.summary || adjustment.reason }, responseLanguage) : null;
    if (verificationBlock) {
      rejected.push({ ...adjustment, packetId, reason: verificationBlock.message, completionBlock: verificationBlock });
      continue;
    }
    const transitionAt = nowIso();
    const fields = lifecycleFieldsForStatus(adjustment.status, { ...adjustment, runId: `${resultId}-${packetId}`, surface: "dove.status", command: "apply_dove_status_adjustments" }, transitionAt, responseLanguage);
    if (fullPacket.status === adjustment.status) {
      skipped.push({ packetId, status: adjustment.status, displayStatus: adjustment.status === "completed" || adjustment.status === "killed" ? "done" : adjustment.status, reason: doveText(responseLanguage, "statusAdjustSameReason") });
      continue;
    }
    const updated = updateTaskLifecycle(root, fullPacket, adjustment.status, fields);
    const payloadEvidence = completionEvidenceForPayload(adjustment);
    const executionReceipt = buildExecutionReceipt({
      payload: { ...adjustment, runId: `${resultId}-${packetId}` },
      taskBefore: fullPacket,
      taskAfter: updated,
      runId: `${resultId}-${packetId}`,
      surface: "dove.status",
      command: "apply_dove_status_adjustments",
      actionType: adjustment.status === "completed" ? "verify" : "cleanup",
      status: adjustment.status,
      outcome: `status-${adjustment.status}`,
      summary: adjustment.summary || adjustment.reason || `status-${adjustment.status}`,
      nextAction: updated.nextAction ?? "project:dove.status",
      evidence: payloadEvidence,
      startedAt: transitionAt,
      completedAt: transitionAt,
      boundary: updated.boundary ?? null
    });
    executionReceipts.push(executionReceipt);
    executionIterations.push({
      iteration: executionIterations.length + 1,
      packetId,
      command: "apply_dove_status_adjustments",
      status: adjustment.status,
      outcome: `status-${adjustment.status}`,
      startedAt: transitionAt,
      completedAt: transitionAt,
      artifactRefs: payloadEvidence.artifactRefs,
      evidenceLinks: payloadEvidence.evidenceLinks,
      validationEvidencePaths: payloadEvidence.validationEvidencePaths,
      verificationEvidencePaths: payloadEvidence.verificationEvidencePaths,
      verifiedCriteria: payloadEvidence.verifiedCriteria,
      executionReceipt
    });
    catalog.byId.set(packetId, updated);
    applied.push({
      packetId,
      fromStatus: fullPacket.status,
      toStatus: updated.status,
      displayStatus: updated.status === "completed" || updated.status === "killed" ? "done" : updated.status,
      title: updated.title,
      level: updated.level,
      executionReceipt
    });
  }
  const completedAt = nowIso();
  const result = {
    id: resultId,
    runId: resultId,
    surface: "dove.status",
    command: "apply_dove_status_adjustments",
    status: rejected.length > 0 && applied.length > 0 ? "partially-applied" : rejected.length > 0 ? "rejected" : "applied",
    outcome: rejected.length > 0 && applied.length > 0 ? "partially-applied" : rejected.length > 0 ? "rejected" : "applied",
    packetIds: applied.map((item) => item.packetId),
    applied,
    skipped,
    rejected,
    iterations: executionIterations,
    iterationCount: executionIterations.length,
    executionReceipts,
    executionReceipt: executionReceipts[0] ?? null,
    statusChoices: DOVE_TASK_STATUSES,
    activeTaskIds: loadTaskIndex(root).taskModel.activeTaskIds,
    foreground: true,
    background: false,
    daemon: false,
    responseLanguage,
    taskIndexPath: ARTIFACT_PATHS.taskPacketsIndex,
    createdAt: completedAt,
    updatedAt: completedAt
  };
  if (applied.length > 0) {
    persistAutoResult(root, result);
  }
  return {
    ...result,
    resultCard: statusAdjustmentResultCard(result, responseLanguage)
  };
}

function unresolvedTaskDependencies(index, task) {
  const byId = new Map((index.items ?? []).map((item) => [item.id, item]));
  return Array.from(new Set([...normalizeStringArray(task.dependencies), ...normalizeStringArray(task.blockedBy)])).filter((dependencyId) => {
    const dependency = byId.get(dependencyId);
    return !dependency || dependency.status !== "completed";
  });
}

function operatorQueue(index) {
  const tasks = sortOperatorTasks((index.items ?? []).filter((task) => task.level !== 0 && !["completed", "killed"].includes(task.status))).map((task) => {
    const autoPlan = inferAutoStepsForTask(task, {});
    return {
      ...task,
      unresolvedDependencyIds: unresolvedTaskDependencies(index, task),
      proposedSteps: autoPlan.proposedSteps,
      safeToRun: autoPlan.safeToRun,
      requiresHostPass: autoPlan.requiresHostPass,
      whyThisStep: autoPlan.whyThisStep
    };
  });
  const runnableCandidates = tasks.filter((task) => ["ready", "in-progress"].includes(task.status) && task.unresolvedDependencyIds.length === 0);
  const autoRunnable = runnableCandidates.filter((task) => task.safeToRun);
  const hostPassRequired = runnableCandidates.filter((task) => !task.safeToRun);
  return {
    autoRunnable,
    hostPassRequired,
    runnable: [...autoRunnable, ...hostPassRequired],
    blocked: tasks.filter((task) => task.status === "blocked" || task.unresolvedDependencyIds.length > 0),
    pending: tasks.filter((task) => task.status === "pending")
  };
}

function blockerInvestigationTargetTasks(blockedTasks = []) {
  return blockedTasks.filter((task) => {
    if (normalizeStringArray(task.unresolvedDependencyIds).length > 0) {
      return true;
    }
    if (task.status !== "blocked" || task.derivedFrom === "blocked-mission-investigation") {
      return false;
    }
    return Object.keys(plainObject(task.boundary)).length === 0;
  });
}

function sortOperatorTasks(tasks = []) {
  return [...tasks].sort((left, right) => (left.level ?? 3) - (right.level ?? 3) || String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? "")) || String(left.id).localeCompare(String(right.id)));
}

function operatorTaskSummary(task) {
  const summary = { id: task.id, title: task.title, status: task.status, level: task.level, stage: task.stage, domain: task.domain, parentId: task.parentId ?? null, nextAction: task.nextAction };
  if (Array.isArray(task.unresolvedDependencyIds)) {
    summary.unresolvedDependencyIds = task.unresolvedDependencyIds;
  }
  if (Array.isArray(task.proposedSteps)) {
    summary.proposedSteps = task.proposedSteps;
  }
  if (task.safeToRun !== undefined) {
    summary.safeToRun = task.safeToRun;
  }
  if (task.requiresHostPass !== undefined) {
    summary.requiresHostPass = task.requiresHostPass;
  }
  if (task.whyThisStep !== undefined) {
    summary.whyThisStep = task.whyThisStep;
  }
  return summary;
}

function operatorTaskIds(tasks = []) {
  return tasks.map((task) => task.id).filter(Boolean);
}

function operatorQueueSummary(queue = {}) {
  const autoRunnable = queue.autoRunnable ?? [];
  const hostPassRequired = queue.hostPassRequired ?? [];
  const runnable = queue.runnable ?? [];
  const blocked = queue.blocked ?? [];
  const pending = queue.pending ?? [];
  return {
    autoRunnableCount: autoRunnable.length,
    hostPassRequiredCount: hostPassRequired.length,
    runnableCount: runnable.length,
    blockedCount: blocked.length,
    pendingCount: pending.length,
    autoRunnableTaskIds: operatorTaskIds(autoRunnable),
    hostPassRequiredTaskIds: operatorTaskIds(hostPassRequired),
    runnableTaskIds: operatorTaskIds(runnable),
    blockedTaskIds: operatorTaskIds(blocked),
    pendingTaskIds: operatorTaskIds(pending)
  };
}

function operatorQueueCards(queue = {}, preActionGuidance = null, responseLanguage = "zh", { includeGuidance = false } = {}) {
  const guidance = includeGuidance ? preActionGuidance : null;
  return {
    autoRunnable: (queue.autoRunnable ?? []).map((task) => buildOperatorQueueCard(operatorTaskSummary(task), { queue: "auto-runnable", preActionGuidance: guidance }, responseLanguage)),
    hostPassRequired: (queue.hostPassRequired ?? []).map((task) => buildOperatorQueueCard(operatorTaskSummary(task), { queue: "host-pass-required", why: doveText(responseLanguage, "operatorAwaitingStopReason"), preActionGuidance: guidance }, responseLanguage)),
    runnable: (queue.runnable ?? []).map((task) => buildOperatorQueueCard(operatorTaskSummary(task), { queue: "runnable", preActionGuidance: guidance }, responseLanguage)),
    blocked: (queue.blocked ?? []).map((task) => buildOperatorQueueCard(operatorTaskSummary(task), { queue: "blocked", preActionGuidance: guidance }, responseLanguage)),
    pending: (queue.pending ?? []).map((task) => buildOperatorQueueCard(operatorTaskSummary(task), { queue: "pending", preActionGuidance: guidance }, responseLanguage))
  };
}

function operatorQueuePreview(queue = {}, responseLanguage = "zh") {
  const cards = operatorQueueCards(queue, null, responseLanguage);
  return Object.fromEntries(Object.entries(cards).map(([key, value]) => [key, value.slice(0, 2)]));
}

function normalizeBlockerInvestigationMode(args = {}) {
  const explicit = normalizeString(args.blockerInvestigationMode, null);
  if (explicit) {
    const mode = explicit.toLowerCase();
    if (!["none", "propose", "create"].includes(mode)) {
      throw new Error('blockerInvestigationMode must be "none", "propose", or "create".');
    }
    return mode;
  }
  return args.createBlockedInvestigations === true ? "create" : "propose";
}

function emptyOperatorBlockerPlanConversion(blockedTasks = [], mode = "propose") {
  const blockedTaskIds = operatorTaskIds(blockedTasks);
  return {
    mode,
    proposalOnly: mode !== "create",
    blockedTaskIds,
    proposedBlockedTaskIds: mode === "propose" ? blockedTaskIds : [],
    createdMissions: [],
    reusedMissions: [],
    createdCount: 0,
    reusedCount: 0,
    missionCount: 0,
    createdMissionIds: [],
    reusedMissionIds: [],
    taskIndexPath: ARTIFACT_PATHS.taskPacketsIndex
  };
}

function compactOperatorBlockerPlanConversion(conversion = {}) {
  const createdMissionIds = normalizeStringArray(conversion.createdMissionIds ?? operatorTaskIds(conversion.createdMissions ?? []));
  const reusedMissionIds = normalizeStringArray(conversion.reusedMissionIds ?? operatorTaskIds(conversion.reusedMissions ?? []));
  const createdCount = conversion.createdCount ?? createdMissionIds.length;
  const reusedCount = conversion.reusedCount ?? reusedMissionIds.length;
  return {
    mode: conversion.mode ?? "propose",
    proposalOnly: conversion.proposalOnly !== false,
    blockedTaskIds: normalizeStringArray(conversion.blockedTaskIds),
    proposedBlockedTaskIds: normalizeStringArray(conversion.proposedBlockedTaskIds),
    createdCount,
    reusedCount,
    missionCount: conversion.missionCount ?? createdCount,
    createdMissionIds,
    reusedMissionIds,
    taskIndexPath: conversion.taskIndexPath ?? ARTIFACT_PATHS.taskPacketsIndex
  };
}

function compactOperatorResult(result = {}) {
  const { iterations: _iterations, blockerPlanConversion, ...summary } = result;
  return {
    ...summary,
    blockerPlanConversion: compactOperatorBlockerPlanConversion(blockerPlanConversion)
  };
}

function operatorResultMap(args = {}) {
  const results = objectArray(args.taskResults ?? args.results ?? args.passResults);
  const entries = results.map((result) => {
    const source = plainObject(result);
    const id = normalizeString(source.packetId ?? source.taskPacketId ?? source.taskId ?? source.id, null);
    return id ? [normalizeTaskPacketId(id), source] : null;
  }).filter(Boolean);
  return new Map(entries);
}

function operatorAwaitingHostIteration(task, timestamp, responseLanguage = "zh") {
  return {
    packetId: task.id,
    title: task.title,
    status: "awaiting-host-pass-result",
    outcome: "operator-pass-result-required",
    stopReason: doveText(responseLanguage, "operatorAwaitingStopReason"),
    startedAt: timestamp,
    completedAt: timestamp
  };
}

function applyOperatorHostResult(root, taskItem, taskResult, timestamp, responseLanguage = "zh", runId = null) {
  const task = loadFullTask(root, taskItem);
  const taskStatus = normalizeMissionPassStatus(taskResult);
  const taskResultEvidence = completionEvidenceForPayload(taskResult);
  const verificationBlock = taskStatus === "completed" ? completionVerificationBlock(task, taskResult, responseLanguage) : null;
  if (verificationBlock) {
    const updatedTask = updateTaskLifecycle(root, task, "blocked", {
      ...taskResult,
      runId,
      surface: "dove.operator",
      command: "host-pass-result",
      boundaryType: normalizeDoveBoundaryType(verificationBlock.boundaryType ?? verificationBlock.status, "blocked-boundary"),
      reason: verificationBlock.message,
      stopReason: verificationBlock.status,
      summary: verificationBlock.message,
      requiredActions: verificationBlock.requiredActions ?? [],
      nextAction: "project:dove.status"
    });
    return {
      updatedTask,
      iteration: {
        packetId: task.id,
        title: task.title,
        status: verificationBlock.status,
        outcome: verificationBlock.status,
        stopReason: verificationBlock.message,
        boundary: updatedTask.boundary,
        requiredActions: verificationBlock.requiredActions ?? [],
        evidenceLinks: taskResultEvidence.evidenceLinks,
        artifactRefs: taskResultEvidence.artifactRefs,
        verificationEvidencePaths: taskResultEvidence.verificationEvidencePaths,
        verifiedCriteria: taskResultEvidence.verifiedCriteria,
        executionReceipt: taskResultEvidence.executionReceipt,
        startedAt: normalizeString(taskResult.startedAt, timestamp),
        completedAt: normalizeString(taskResult.completedAt, timestamp)
      }
    };
  }
  const fields = lifecycleFieldsForStatus(taskStatus, { ...taskResult, runId, surface: "dove.operator", command: "host-pass-result" }, timestamp, responseLanguage);
  fields.artifactRefs = normalizeStringArray([...(Array.isArray(task.artifactRefs) ? task.artifactRefs : []), ...taskResultEvidence.artifactRefs]);
  const updatedTask = updateTaskLifecycle(root, task, taskStatus, fields);
  return {
    updatedTask,
    iteration: {
      packetId: task.id,
      title: task.title,
      status: taskStatus,
      outcome: normalizeString(taskResult.outcome, taskStatus === "completed" ? "operator-task-completed" : taskStatus === "blocked" ? "operator-task-blocked" : "operator-task-progress"),
      summary: normalizeString(taskResult.summary ?? taskResult.resultSummary, doveText(responseLanguage, "operatorResultSummary")),
      evidenceLinks: taskResultEvidence.evidenceLinks,
      artifactRefs: fields.artifactRefs,
      verificationEvidencePaths: taskResultEvidence.verificationEvidencePaths,
      verifiedCriteria: taskResultEvidence.verifiedCriteria,
      executionReceipt: taskResultEvidence.executionReceipt,
      startedAt: normalizeString(taskResult.startedAt, timestamp),
      completedAt: normalizeString(taskResult.completedAt, timestamp)
    }
  };
}

function runOperatorInternalStep(root, taskItem, timestamp, responseLanguage = "zh", runId = null) {
  const task = loadFullTask(root, taskItem);
  const autoPlan = inferAutoStepsForTask(task, {});
  const step = autoPlan.steps[0] ?? null;
  if (!step) {
    const iteration = operatorAwaitingHostIteration(task, timestamp, responseLanguage);
    const updatedTask = updateTaskLifecycle(root, task, "blocked", {
      runId,
      surface: "dove.operator",
      command: "host-pass-result",
      boundaryType: "awaiting-host-pass-result",
      reason: autoPlan.whyThisStep ?? iteration.stopReason,
      stopReason: autoPlan.whyThisStep ?? iteration.stopReason,
      summary: iteration.outcome,
      requiredActions: autoHostPassRequiredActions(autoPlan),
      nextAction: "project:dove.status"
    });
    return {
      awaitingTaskId: task.id,
      updatedTask,
      iteration
    };
  }
  const startedAt = nowIso();
  let workingTask = task.status === "ready" ? updateTaskLifecycle(root, task, "in-progress", { runId, surface: "dove.operator", command: step.command }) : task;
  try {
    const output = executeAutoStep(root, step.command, stepArgsForTask(workingTask, step.args));
    const classified = classifyAutoStepResult(step.command, output);
    const completedAt = nowIso();
    let updatedTask = workingTask;
    if (step.completeTask === true) {
      const completionArgs = {
        runId,
        surface: "dove.operator",
        command: step.command,
        resultSummary: classified.outcome,
        summary: classified.outcome,
        artifactRefs: classified.artifactRefs,
        evidenceLinks: classified.evidenceLinks,
        verificationEvidencePaths: classified.verificationEvidencePaths,
        verifiedCriteria: classified.verifiedCriteria,
        executionReceipt: classified.executionReceipt
      };
      const verificationBlock = completionVerificationBlock(workingTask, completionArgs, responseLanguage);
      if (verificationBlock) {
        updatedTask = updateTaskLifecycle(root, workingTask, "blocked", {
          ...completionArgs,
          boundaryType: normalizeDoveBoundaryType(verificationBlock.boundaryType ?? verificationBlock.status, "blocked-boundary"),
          reason: verificationBlock.message,
          stopReason: verificationBlock.status,
          summary: verificationBlock.message,
          requiredActions: verificationBlock.requiredActions ?? [],
          nextAction: "project:dove.status"
        });
      } else {
        updatedTask = updateTaskLifecycle(root, workingTask, "completed", { ...completionArgs, nextAction: "project:dove.status" });
      }
    } else if (classified.terminal) {
      updatedTask = updateTaskLifecycle(root, workingTask, "blocked", { runId, surface: "dove.operator", command: step.command, boundaryType: classified.outcome, reason: classified.stopReason, stopReason: classified.stopReason, nextAction: "project:dove.status" });
    }
    return {
      updatedTask,
      iteration: {
        packetId: task.id,
        title: task.title,
        command: step.command,
        status: classified.status,
        outcome: classified.outcome,
        stopReason: classified.stopReason,
        output: summarizeStepOutput(output),
        artifactRefs: classified.artifactRefs,
        evidenceLinks: classified.evidenceLinks,
        verificationEvidencePaths: classified.verificationEvidencePaths,
        verifiedCriteria: classified.verifiedCriteria,
        executionReceipt: classified.executionReceipt,
        proposedSteps: autoPlan.proposedSteps,
        startedAt,
        completedAt
      }
    };
  } catch (error) {
    const completedAt = nowIso();
    workingTask = updateTaskLifecycle(root, workingTask, "blocked", { runId, surface: "dove.operator", command: step.command, boundaryType: "workflow-error-boundary", reason: error.message, stopReason: error.message, nextAction: "project:dove.status" });
    return {
      updatedTask: workingTask,
      iteration: {
        packetId: task.id,
        title: task.title,
        command: step.command,
        status: "blocked-boundary",
        outcome: "workflow-error-boundary",
        stopReason: error.message,
        proposedSteps: autoPlan.proposedSteps,
        startedAt,
        completedAt
      }
    };
  }
}

function materializeBlockedInvestigationMissions(root, blockedTasks, runId, responseLanguage = "zh") {
  const blockedTaskIds = operatorTaskIds(blockedTasks);
  if (blockedTasks.length === 0) {
    return emptyOperatorBlockerPlanConversion(blockedTasks, "create");
  }
  const index = loadTaskIndex(root);
  const init = initPacket(index);
  if (!init) {
    throw new Error("Dove operator blocker investigation requires the level-0 init task.");
  }
  const catalog = readTaskPacketCatalog(root);
  let nextIndex = index;
  const createdMissions = [];
  const reusedMissions = [];
  for (const blockedTask of blockedTasks) {
    const fullTask = loadFullTask(root, blockedTask);
    const taskLabel = fullTask.title ?? fullTask.id;
    const source = {
      id: `task-investigate-blocker-for-${fullTask.id}`,
      title: doveText(responseLanguage, "blockerTitle", { title: taskLabel }),
      summary: normalizeString(fullTask.blockedReason, doveText(responseLanguage, "blockerSummary", { title: taskLabel })),
      stage: "plan",
      domain: fullTask.domain,
      level: (Number.isFinite(fullTask.level) ? fullTask.level : 3) + 1,
      evidenceExpectations: [doveText(responseLanguage, "blockerEvidenceWhy", { id: fullTask.id }), doveText(responseLanguage, "blockerEvidenceAction")]
    };
    const packet = buildDerivedTask(root, init, fullTask, source, {
      idPrefix: `task-investigate-blocker-for-${fullTask.id}`,
      level: source.level,
      minimumLevel: source.level,
      classification: { stage: "plan", domain: fullTask.domain },
      sourcePlanTaskId: fullTask.id,
      sourceMissionPassRunId: runId,
      derivedFrom: "blocked-mission-investigation"
    });
    const result = materializeOneDerivedTask(root, nextIndex, packet, catalog);
    nextIndex = result.index;
    (result.created ? createdMissions : reusedMissions).push(result.packet);
  }
  if (createdMissions.length > 0) {
    persistDerivedTaskIndex(root, nextIndex, createdMissions.at(-1));
  }
  const createdSummaries = createdMissions.map(operatorTaskSummary);
  const reusedSummaries = reusedMissions.map(operatorTaskSummary);
  return {
    mode: "create",
    proposalOnly: false,
    blockedTaskIds,
    proposedBlockedTaskIds: [],
    createdMissions: createdSummaries,
    reusedMissions: reusedSummaries,
    createdCount: createdSummaries.length,
    reusedCount: reusedSummaries.length,
    missionCount: createdSummaries.length,
    createdMissionIds: operatorTaskIds(createdSummaries),
    reusedMissionIds: operatorTaskIds(reusedSummaries),
    taskIndexPath: ARTIFACT_PATHS.taskPacketsIndex
  };
}

export function runDoveOperator(root, args = {}) {
  assertGovernanceMutationRegistered("run-dove-operator", "guarded");
  ensureWorkspace(root);
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  const index = loadTaskIndex(root);
  const queue = operatorQueue(index);
  const includeQueueDetails = args.includeQueueDetails === true;
  const blockerInvestigationMode = normalizeBlockerInvestigationMode(args);
  const blockerInvestigationTargets = blockerInvestigationTargetTasks(queue.blocked);
  const blockerInvestigationProposal = emptyOperatorBlockerPlanConversion(blockerInvestigationTargets, blockerInvestigationMode);
  if (!hasExplicitConfirmation(args)) {
    const preActionGuidance = buildPreActionGuidance({
      surface: "dove.operator",
      responseLanguage,
      request: requestTextFromArgs(args),
      roleId: "planner",
      operatorLessons: readOperatorLessonsIndex(root),
      nextAction: "project:dove.status",
      routeHint: "project:dove.status",
      workflowKind: "operator",
      statusSummary: {
        autoRunnableCount: queue.autoRunnable.length,
        hostPassRequiredCount: queue.hostPassRequired.length,
        runnableCount: queue.runnable.length,
        blockedCount: queue.blocked.length,
        pendingCount: queue.pending.length,
        blockerInvestigationMode
      }
    });
    const response = {
      status: "needs-confirmation",
      proposalOnly: true,
      noAutoApply: true,
      writes: [],
      confirmationRequired: true,
      executionMode: "operator-one-foreground-pass",
      preActionGuidance,
      foreground: true,
      background: false,
      daemon: false,
      queueSummary: operatorQueueSummary(queue),
      queuePreview: operatorQueuePreview(queue, responseLanguage),
      blockerInvestigationMode,
      blockerPlanConversion: compactOperatorBlockerPlanConversion(blockerInvestigationProposal),
      includeQueueDetails,
      confirmArgs: {
        ...args,
        confirmed: true
      },
      responseLanguage,
      message: doveText(responseLanguage, "operatorConfirmMessage")
    };
    if (includeQueueDetails) {
      Object.assign(response, {
        queueCards: operatorQueueCards(queue, preActionGuidance, responseLanguage, { includeGuidance: true }),
        autoRunnableTasks: queue.autoRunnable.map(operatorTaskSummary),
        hostPassRequiredTasks: queue.hostPassRequired.map(operatorTaskSummary),
        runnableTasks: queue.runnable.map(operatorTaskSummary),
        blockedTasks: queue.blocked.map(operatorTaskSummary),
        pendingTasks: queue.pending.map(operatorTaskSummary)
      });
    }
    return response;
  }
  const timestamp = nowIso();
  const runId = normalizeTaskPacketId(args.runId ?? `operator-${Date.now().toString(36)}`);
  const resultMap = operatorResultMap(args);
  const iterations = [];
  const updatedTasks = [];
  const awaitingResults = [];
  for (const taskItem of queue.autoRunnable) {
    const stepResult = runOperatorInternalStep(root, taskItem, timestamp, responseLanguage, runId);
    iterations.push(stepResult.iteration);
    if (stepResult.updatedTask) {
      updatedTasks.push(stepResult.updatedTask);
    }
    if (stepResult.awaitingTaskId) {
      awaitingResults.push(stepResult.awaitingTaskId);
    }
  }
  const skippedHostPassTaskIds = [];
  const skippedHostPassRequiredActions = [];
  for (const taskItem of queue.hostPassRequired) {
    const task = loadFullTask(root, taskItem);
    const autoPlan = inferAutoStepsForTask(task, {});
    const taskResult = resultMap.get(task.id);
    if (!taskResult) {
      skippedHostPassTaskIds.push(task.id);
      skippedHostPassRequiredActions.push(...autoHostPassRequiredActions(autoPlan));
      awaitingResults.push(task.id);
      continue;
    }
    const hostResult = applyOperatorHostResult(root, task, taskResult, timestamp, responseLanguage, runId);
    updatedTasks.push(hostResult.updatedTask);
    iterations.push(hostResult.iteration);
  }
  const blockerPlanConversion = blockerInvestigationMode === "create"
    ? materializeBlockedInvestigationMissions(root, blockerInvestigationTargets, runId, responseLanguage)
    : emptyOperatorBlockerPlanConversion(blockerInvestigationTargets, blockerInvestigationMode);
  const awaitingResultSet = new Set(awaitingResults);
  const awaitingRequiredActions = Array.from(new Set([
    ...updatedTasks
      .filter((task) => awaitingResultSet.has(task.id))
      .flatMap((task) => normalizeStringArray(task.boundary?.requiredActions ?? task.requiredActions)),
    ...skippedHostPassRequiredActions
  ]));
  const durableWorkHappened = iterations.length > 0 || updatedTasks.length > 0 || (blockerPlanConversion.createdCount ?? 0) > 0;
  const blockerProposalPending = blockerPlanConversion.proposedBlockedTaskIds?.length > 0;
  const resultStatus = awaitingResults.length > 0
    ? (durableWorkHappened ? "awaiting-host-results" : "needs-host-results")
    : (blockerProposalPending ? "blocked-investigation-proposed" : "completed");
  const resultOutcome = awaitingResults.length > 0
    ? (durableWorkHappened ? "operator-pass-results-required" : "operator-pass-needs-host-results")
    : (blockerProposalPending ? "operator-blocker-investigation-proposed" : "operator-pass-recorded");
  const result = {
    id: runId,
    surface: "dove.operator",
    status: resultStatus,
    outcome: resultOutcome,
    foreground: true,
    background: false,
    daemon: false,
    runtimeRecorded: durableWorkHappened,
    maxIterations: 1,
    iterationCount: iterations.length,
    autoRunnableTaskIds: queue.autoRunnable.map((task) => task.id),
    hostPassRequiredTaskIds: queue.hostPassRequired.map((task) => task.id),
    runnableTaskIds: queue.runnable.map((task) => task.id),
    updatedTaskIds: updatedTasks.map((task) => task.id),
    awaitingResultTaskIds: awaitingResults,
    skippedHostPassTaskIds,
    awaitingRequiredActions,
    blockedTaskIds: queue.blocked.map((task) => task.id),
    pendingTaskIds: queue.pending.map((task) => task.id),
    blockerInvestigationMode,
    blockerPlanConversion,
    iterations,
    stopReason: awaitingResults.length > 0 ? "host-pass-results-required" : (blockerProposalPending ? "blocked-investigation-requires-explicit-create" : null),
    responseLanguage,
    createdAt: timestamp,
    updatedAt: nowIso()
  };
  if (durableWorkHappened) {
    persistAutoResult(root, result);
  }
  const preActionGuidanceSummary = summarizePreActionGuidance(buildPreActionGuidance({
    surface: "dove.operator",
    responseLanguage,
    request: requestTextFromArgs(args),
    roleId: "planner",
    operatorLessons: readOperatorLessonsIndex(root),
    nextAction: "project:dove.status",
    routeHint: "project:dove.status",
    workflowKind: "operator",
    statusSummary: {
      autoRunnableCount: queue.autoRunnable.length,
      hostPassRequiredCount: queue.hostPassRequired.length,
      runnableCount: queue.runnable.length,
      blockedCount: queue.blocked.length,
      pendingCount: queue.pending.length,
      blockerInvestigationMode
    }
  }));
  const resultCard = operatorResultCard(result, { nextAction: "project:dove.status", preActionGuidanceSummary }, responseLanguage);
  const response = {
    status: result.status,
    operatorResultSummary: compactOperatorResult(result),
    resultCard,
    preActionGuidanceSummary,
    queueSummary: operatorQueueSummary(queue),
    updatedTaskIds: updatedTasks.map((task) => task.id),
    awaitingResultTaskIds: awaitingResults,
    skippedHostPassTaskIds,
    awaitingRequiredActions,
    blockerInvestigationMode,
    blockerPlanConversion: compactOperatorBlockerPlanConversion(blockerPlanConversion),
    includeQueueDetails,
    responseLanguage,
    nextAction: "project:dove.status"
  };
  if (includeQueueDetails) {
    Object.assign(response, {
      result,
      autoRunnableTasks: queue.autoRunnable.map(operatorTaskSummary),
      hostPassRequiredTasks: queue.hostPassRequired.map(operatorTaskSummary),
      updatedTasks: updatedTasks.map(operatorTaskSummary),
      blockerPlanConversionDetails: blockerPlanConversion
    });
  }
  return response;
}

export function resetDoveVersion(root, args = {}) {
  assertGovernanceMutationRegistered("reset-dove-version", "guarded");
  ensureWorkspace(root);
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  const timestamp = nowIso();
  const index = loadTaskIndex(root);
  const init = initPacket(index);
  if (!init) {
    throw new Error("/dove:version requires an init task to preserve. Run /dove:init first.");
  }
  const versionId = normalizeTaskPacketId(args.versionId ?? args.id ?? `version-${slugify(args.reason ?? args.title ?? timestamp)}`);
  const snapshotPath = path.join(ARTIFACT_PATHS.versionSnapshotsDir, `${versionId}-task-index.json`);
  writeJson(root, snapshotPath, { versionId, createdAt: timestamp, reason: normalizeString(args.reason ?? args.summary, doveText(responseLanguage, "versionReason")), taskIndex: index });
  const resetIndex = saveTaskIndex(root, {
    ...index,
    items: [init],
    updatedAt: timestamp
  });
  const versions = readJson(root, ARTIFACT_PATHS.versionsIndex, { version: 1, items: [], updatedAt: null });
  const item = {
    id: versionId,
    title: normalizeString(args.title, doveText(responseLanguage, "versionTitle")),
    reason: normalizeString(args.reason ?? args.summary, doveText(responseLanguage, "versionReason")),
    preservedInitId: init.id,
    clearedTaskIds: (index.items ?? []).filter((task) => task.level !== 0).map((task) => task.id),
    preservedLessonIds: activeLessons(root).map((lesson) => lesson.id),
    snapshotPath,
    createdAt: timestamp
  };
  writeJson(root, ARTIFACT_PATHS.versionsIndex, {
    ...versions,
    items: [...(Array.isArray(versions.items) ? versions.items.filter((existing) => existing.id !== versionId) : []), item],
    updatedAt: timestamp
  });
  const state = loadState(root);
  saveState(root, {
    ...state,
    pipeline: {
      ...state.pipeline,
      resumeCommand: "project:dove.mission",
      updatedAt: timestamp
    },
    orchestration: {
      ...state.orchestration,
      activeTaskIds: resetIndex.taskModel.activeTaskIds,
      currentVersionId: versionId,
      nextAction: doveText(responseLanguage, "versionNextActionDisplay")
    }
  });
  return {
    status: "reset",
    version: item,
    init,
    activeTaskIds: resetIndex.taskModel.activeTaskIds,
    responseLanguage,
    nextAction: "project:dove.mission"
  };
}

const AUTO_INTERNAL_COMMANDS = ["dove.source", "dove.note", "dove.experience", "dove.figure", "dove.draft", "dove.review", "dove.review-loop", "dove.rebuttal", "dove.lessons", "dove.status"];
const AUTO_READ_ONLY_COMMANDS = new Set(["dove.lessons", "dove.status"]);

function hasTaskIntent(args = {}) {
  return [args.goal, args.objective, args.prompt, args.title, args.summary].some((value) => typeof value === "string" && value.trim());
}

function hasExplicitTaskSelector(args = {}) {
  return [args.packetId, args.taskPacketId, args.missionPacketId, args.taskId, args.target, args.packetTarget, args.taskName].some((value) => typeof value === "string" && value.trim()) || Number.isFinite(args.index);
}

function normalizePositiveInteger(value, fallback) {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
}

function resolveAutoMaxIterations(state, args = {}) {
  return normalizePositiveInteger(args.maxIterations ?? args.maxSteps, normalizePositiveInteger(state.settings?.auto?.maxIterations, 3));
}

function normalizeAutoCommandId(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return null;
  }
  let normalized = raw.replace(/^project:/, "").replace(/^\/dove:/, "dove.").replace(/^dove:/, "dove.").replace(/_/g, "-");
  if (!normalized.startsWith("dove.")) {
    normalized = `dove.${normalized}`;
  }
  return AUTO_INTERNAL_COMMANDS.includes(normalized) ? normalized : null;
}

function normalizeConcreteAutoCommandId(value) {
  const command = normalizeAutoCommandId(value);
  return command && !["dove.status", "dove.auto"].includes(command) ? command : null;
}

function projectContinuationRoute(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase().replace(/^project:/, "") : "";
  return ["dove.status", "dove.auto"].includes(raw) ? raw : null;
}

function stripAutoControlArgs(args = {}) {
  const {
    actions: _actions,
    autoSteps: _autoSteps,
    command: _command,
    complete: _complete,
    completeOnSuccess: _completeOnSuccess,
    completeTask: _completeTask,
    confirm: _confirm,
    confirmed: _confirmed,
    id: _id,
    index: _index,
    maxIterations: _maxIterations,
    maxSteps: _maxSteps,
    missionPacketId: _missionPacketId,
    packetId: _packetId,
    packetTarget: _packetTarget,
    preset: _preset,
    runId: _runId,
    steps: _steps,
    target: _target,
    taskId: _taskId,
    taskName: _taskName,
    taskPacketId: _taskPacketId,
    workflow: _workflow,
    ...stepArgs
  } = args;
  return stepArgs;
}

function explicitStepsFrom(args = {}) {
  for (const value of [args.steps, args.autoSteps, args.actions]) {
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

function normalizeExplicitAutoSteps(args = {}) {
  return explicitStepsFrom(args).map((step) => {
    if (typeof step === "string") {
      return { command: normalizeAutoCommandId(step), args: {} };
    }
    const source = step && typeof step === "object" && !Array.isArray(step) ? step : {};
    const stepArgs = source.args && typeof source.args === "object" && !Array.isArray(source.args) ? source.args : source;
    const executionContract = normalizeDoveExecutionContract(source.executionContract ?? stepArgs.executionContract, null);
    return {
      command: normalizeAutoCommandId(source.command ?? source.workflow ?? source.preset ?? source.id),
      args: stepArgs,
      completeTask: source.completeTask === true || source.complete === true,
      requiredMaterials: normalizeStringArray(source.requiredMaterials ?? stepArgs.requiredMaterials),
      outputArtifacts: normalizeStringArray(source.outputArtifacts ?? stepArgs.outputArtifacts),
      convergenceChecks: normalizeStringArray(source.convergenceChecks ?? stepArgs.convergenceChecks ?? executionContract?.convergence?.criteria),
      failureRoutes: objectArray(source.failureRoutes ?? stepArgs.failureRoutes),
      executionContract,
      validationEvidencePaths: normalizeStringArray(source.validationEvidencePaths ?? stepArgs.validationEvidencePaths),
      verificationEvidencePaths: normalizeStringArray(source.verificationEvidencePaths ?? stepArgs.verificationEvidencePaths),
      verifiedCriteria: normalizeDoveVerifiedCriteria(source.verifiedCriteria ?? stepArgs.verifiedCriteria),
      executionReceipt: mergeDoveExecutionReceipts(source.executionReceipt, stepArgs.executionReceipt)
    };
  }).filter((step) => step.command);
}

function hasNonEmptyString(value) {
  return typeof value === "string" && value.trim();
}

function hasSourceItemProvenance(args = {}) {
  return [args.title, args.locator].some(hasNonEmptyString);
}

function hasAutoSourceProvenanceArgs(args = {}) {
  if (Array.isArray(args.sources)) {
    return args.sources.length > 0 && args.sources.every((item) => item && typeof item === "object" && !Array.isArray(item) && hasSourceItemProvenance(item));
  }
  return hasNonEmptyString(args.locator) || (hasNonEmptyString(args.title) && [args.sourceId, args.citationKey].some(hasNonEmptyString));
}

function hasAutoNoteSynthesisArgs(args = {}) {
  return hasNonEmptyString(args.summary)
    || normalizeStringArray(args.quotes).length > 0
    || normalizeStringArray(args.claims).length > 0
    || normalizeStringArray(args.openQuestions).length > 0;
}

function hasAutoDraftContentArgs(args = {}) {
  return hasNonEmptyString(args.body);
}

function hasAutoExperienceObjectiveArgs(args = {}) {
  const plan = args.plan && typeof args.plan === "object" && !Array.isArray(args.plan) ? args.plan : args;
  return [plan.experimentId, plan.id, plan.goal, plan.idea, args.idea, plan.title].some(hasNonEmptyString);
}

function reviewLoopDraftRequestedWithoutContent(args = {}) {
  return Boolean(args.draft || args.draftBody) && !hasNonEmptyString(args.draftBody ?? args.draft?.body);
}

function reviewLoopExperienceRequestedWithoutObjective(args = {}) {
  if (!args.experience && !args.experienceGoal) {
    return false;
  }
  const experience = args.experience && typeof args.experience === "object" && !Array.isArray(args.experience) ? args.experience : {};
  return ![args.experienceGoal, experience.experimentId, experience.id, experience.goal, experience.idea, experience.title].some(hasNonEmptyString);
}

function autoStepHostPassReason(command, stepArgs = {}) {
  if (command === "dove.source" && !hasAutoSourceProvenanceArgs(stepArgs)) {
    return "source-requires-host-provenance";
  }
  if (command === "dove.note" && !hasAutoNoteSynthesisArgs(stepArgs)) {
    return "note-requires-host-synthesis";
  }
  if (command === "dove.draft" && !hasAutoDraftContentArgs(stepArgs)) {
    return "draft-requires-host-content";
  }
  if (command === "dove.experience" && !hasAutoExperienceObjectiveArgs(stepArgs)) {
    return "experience-requires-host-objective";
  }
  if (command === "dove.review-loop" && (reviewLoopDraftRequestedWithoutContent(stepArgs) || reviewLoopExperienceRequestedWithoutObjective(stepArgs))) {
    return "review-loop-requires-host-material";
  }
  return null;
}

function autoPlanFromSteps(steps, whyThisStep) {
  const hostPassReason = steps.map((step) => autoStepHostPassReason(step.command, step.args)).find(Boolean);
  if (hostPassReason) {
    return {
      steps: [],
      proposedSteps: summarizeAutoSteps(steps),
      safeToRun: false,
      requiresHostPass: true,
      whyThisStep: hostPassReason
    };
  }
  return {
    steps,
    proposedSteps: summarizeAutoSteps(steps),
    safeToRun: true,
    requiresHostPass: false,
    whyThisStep
  };
}

function taskIntentText(task = {}, args = {}) {
  return [args.goal, args.objective, args.prompt, args.title, args.summary, args.intent, args.command, args.workflow, args.preset, args.nextCommand, task.title, task.summary, task.currentFocus, task.nextAction, task.stage, task.domain]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");
}

function autoHostPassRequiredActions(autoPlan = {}) {
  if (autoPlan.whyThisStep === "source-requires-host-provenance") {
    return ["collect-source-provenance", "call-register-source-with-sources-array", "provide-explicit-auto-step"];
  }
  if (autoPlan.whyThisStep === "note-requires-host-synthesis") {
    return ["synthesize-note-content", "call-upsert-note-with-summary-or-claims", "provide-explicit-auto-step"];
  }
  if (autoPlan.whyThisStep === "draft-requires-host-content") {
    return ["write-draft-body", "call-upsert-draft-with-body", "provide-explicit-auto-step"];
  }
  if (autoPlan.whyThisStep === "experience-requires-host-objective") {
    return ["define-experience-objective", "call-run-experience-workflow-with-goal-or-experimentId", "provide-explicit-auto-step"];
  }
  if (autoPlan.whyThisStep === "review-loop-requires-host-material") {
    return ["provide-review-loop-draft-or-experience-material", "provide-explicit-auto-step"];
  }
  return ["provide-host-pass-result", "provide-explicit-auto-step"];
}

function readOnlyAutoBlock(task, autoPlan = {}, args = {}, responseLanguage = "zh") {
  const steps = Array.isArray(autoPlan.steps) ? autoPlan.steps : [];
  if (steps.length === 0 || !steps.every((step) => AUTO_READ_ONLY_COMMANDS.has(step.command))) {
    return null;
  }
  const completionRequested = steps.some((step) => step.completeTask === true) || args.completeTask === true || args.complete === true || args.completeOnSuccess === true;
  return {
    status: "needs-explicit-progress-step",
    outcome: "auto-read-only-step-no-progress",
    requestedStatus: completionRequested ? "completed" : null,
    packetId: task.id,
    title: task.title,
    proposedSteps: summarizeAutoSteps(steps),
    safeToRun: false,
    requiresHostPass: false,
    requiredActions: ["provide-explicit-auto-step", "use-project-dove-status-for-status-queries"],
    message: responseLanguage === "en"
      ? "Read-only Dove auto steps can inspect context, but they cannot complete or advance a durable task. Provide an explicit write/generation/review step with evidence."
      : "只读 Dove auto 步骤只能查看上下文，不能完成或推进 durable task。请提供带证据的写入、生成或 review 步骤。",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    responseLanguage,
    nextAction: "project:dove.auto"
  };
}

function summarizeAutoSteps(steps = []) {
  return steps.map((step, index) => {
    const summary = {
      index: index + 1,
      command: step.command,
      completeTask: step.completeTask === true
    };
    if (normalizeStringArray(step.requiredMaterials).length > 0) {
      summary.requiredMaterials = normalizeStringArray(step.requiredMaterials);
    }
    if (normalizeStringArray(step.outputArtifacts).length > 0) {
      summary.outputArtifacts = normalizeStringArray(step.outputArtifacts);
    }
    if (normalizeStringArray(step.convergenceChecks).length > 0) {
      summary.convergenceChecks = normalizeStringArray(step.convergenceChecks);
    }
    if (objectArray(step.failureRoutes).length > 0) {
      summary.failureRoutes = objectArray(step.failureRoutes);
    }
    if (step.executionContract) {
      summary.executionContract = step.executionContract;
    }
    if (normalizeStringArray(step.validationEvidencePaths).length > 0) {
      summary.validationEvidencePaths = normalizeStringArray(step.validationEvidencePaths);
    }
    if (normalizeStringArray(step.verificationEvidencePaths).length > 0) {
      summary.verificationEvidencePaths = normalizeStringArray(step.verificationEvidencePaths);
    }
    const verifiedCriteria = normalizeDoveVerifiedCriteria(step.verifiedCriteria);
    if (verifiedCriteria.length > 0) {
      summary.verifiedCriteria = verifiedCriteria;
    }
    const executionReceipt = normalizeDoveExecutionReceipt(step.executionReceipt, null);
    if (executionReceipt) {
      summary.executionReceipt = executionReceipt;
    }
    return summary;
  });
}

function inferAutoStepsForTask(task = {}, args = {}) {
  const explicitSteps = normalizeExplicitAutoSteps(args);
  if (explicitSteps.length > 0) {
    return autoPlanFromSteps(explicitSteps, "explicit-auto-steps");
  }
  const explicitCommand = normalizeAutoCommandId(args.command ?? args.workflow ?? args.preset ?? args.nextCommand);
  if (explicitCommand) {
    const steps = [{ command: explicitCommand, args: stripAutoControlArgs(args), completeTask: args.completeTask === true || args.complete === true }];
    return autoPlanFromSteps(steps, `explicit-auto-command:${explicitCommand}`);
  }
  const taskCommand = normalizeConcreteAutoCommandId(task.nextAction);
  if (taskCommand) {
    const steps = [{ command: taskCommand, args: stripAutoControlArgs(args), completeTask: args.completeTask === true || args.complete === true }];
    return autoPlanFromSteps(steps, `task-next-action:${taskCommand}`);
  }
  const text = taskIntentText(task, args);
  const stepArgs = stripAutoControlArgs(args);
  const signals = workflowSignals(text);
  const inferredCommand = workflowCommandFromSignals({
    ...signals,
    experiment: task.domain === "experiment" || signals.experiment
  });
  if (inferredCommand) {
    const steps = [{ command: inferredCommand, args: stepArgs, completeTask: args.completeTask === true || args.complete === true }];
    return autoPlanFromSteps(steps, `inferred-safe-workflow:${inferredCommand}`);
  }
  const continuationRoute = projectContinuationRoute(task.nextAction);
  return {
    steps: [],
    proposedSteps: [],
    safeToRun: false,
    requiresHostPass: true,
    whyThisStep: continuationRoute ? `project-continuation-requires-status-triage:${continuationRoute}` : "requires-host-pass-or-explicit-workflow-step"
  };
}

function normalizeAutoSteps(args = {}, task) {
  return inferAutoStepsForTask(task, args).steps;
}

function stepArgsForTask(task, rawStepArgs = {}) {
  const stepArgs = rawStepArgs && typeof rawStepArgs === "object" && !Array.isArray(rawStepArgs) ? rawStepArgs : {};
  const explicitTarget = normalizeString(stepArgs.packetId ?? stepArgs.taskPacketId ?? stepArgs.missionPacketId ?? stepArgs.taskId, null);
  if (explicitTarget && normalizeTaskPacketId(explicitTarget) !== task.id) {
    throw new Error(`/dove:auto step target ${explicitTarget} does not match selected task ${task.id}.`);
  }
  return {
    ...stepArgs,
    packetId: task.id
  };
}

function executeAutoStep(root, command, stepArgs) {
  switch (command) {
    case "dove.source":
      return registerSource(root, stepArgs);
    case "dove.note":
      return upsertNote(root, stepArgs);
    case "dove.experience":
      return runExperienceWorkflow(root, stepArgs);
    case "dove.figure":
      return runFigureWorkflow(root, stepArgs);
    case "dove.draft":
      return upsertDraft(root, stepArgs);
    case "dove.review":
      return runAudioReview(root, stepArgs);
    case "dove.review-loop":
      return runDoveReviewLoop(root, stepArgs);
    case "dove.rebuttal": {
      const issues = Array.isArray(stepArgs.issues) ? normalizeRebuttalIssues(root, stepArgs) : null;
      const strategy = buildRebuttalStrategy(root, stepArgs);
      const draft = buildRebuttal(root, stepArgs);
      return { status: "drafted", issues, strategy, draft };
    }
    case "dove.lessons":
      return { status: "queried", lessons: activeLessons(root, stepArgs.packetId) };
    case "dove.status":
      return { status: "queried", packetId: stepArgs.packetId, taskIndexPath: ARTIFACT_PATHS.taskPacketsIndex };
    default:
      throw new Error(`Unsupported /dove:auto internal command: ${command}`);
  }
}

function summarizeStepOutput(output) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return { status: output == null ? null : String(output) };
  }
  const summary = {};
  for (const key of ["status", "packetId", "runId", "figureId", "finalSvgPath", "qaPath", "draftPath", "sectionId", "reviewStatePath", "reviewLogPath", "nextAction"]) {
    if (output[key] !== undefined) {
      summary[key] = output[key];
    }
  }
  if (Array.isArray(output.artifacts)) {
    summary.artifacts = output.artifacts;
  }
  if (Array.isArray(output.missingRequirementIds)) {
    summary.missingRequirementIds = output.missingRequirementIds;
  }
  if (output.boundary?.type) {
    summary.boundaryType = output.boundary.type;
  }
  const executionReceipt = normalizeDoveExecutionReceipt(output.executionReceipt, null);
  if (executionReceipt) {
    summary.executionReceipt = executionReceipt;
  }
  if (output.importArgs) {
    summary.importArgs = output.importArgs;
  }
  return summary;
}

function autoStepArtifactRefs(command, output = {}) {
  const refs = [];
  for (const key of ["finalSvgPath", "qaPath", "draftPath", "reviewStatePath", "reviewLogPath", "planPath", "outlinePath", "taskIndexPath"]) {
    if (typeof output?.[key] === "string" && output[key].trim()) {
      refs.push(output[key]);
    }
  }
  if (Array.isArray(output?.artifacts)) {
    refs.push(...output.artifacts);
  }
  if (command === "dove.source") refs.push(ARTIFACT_PATHS.sources, ARTIFACT_PATHS.citationLog);
  if (command === "dove.note") refs.push(ARTIFACT_PATHS.notes, ARTIFACT_PATHS.queryPack);
  if (command === "dove.experience") refs.push(ARTIFACT_PATHS.experimentPlans, ARTIFACT_PATHS.experimentResults, ARTIFACT_PATHS.experimentAudits);
  if (command === "dove.figure") refs.push(ARTIFACT_PATHS.figureQa);
  return normalizeStringArray(refs);
}

function completedAutoStep(command, output, outcomeStatus, options = {}) {
  const executionReceipt = normalizeDoveExecutionReceipt(output?.executionReceipt, null);
  const artifactRefs = normalizeStringArray([
    ...autoStepArtifactRefs(command, output),
    ...normalizeStringArray(executionReceipt?.artifactRefs),
    ...normalizeStringArray(executionReceipt?.artifactPaths)
  ]);
  const evidenceLinks = normalizeStringArray([
    ...normalizeStringArray(output?.evidenceLinks ?? output?.evidencePaths),
    ...normalizeStringArray(executionReceipt?.evidenceLinks),
    ...normalizeStringArray(executionReceipt?.evidencePaths)
  ]);
  const verificationEvidencePaths = normalizeStringArray([
    ...normalizeStringArray(output?.verificationEvidencePaths),
    ...normalizeStringArray(executionReceipt?.verificationEvidencePaths),
    ...normalizeStringArray(executionReceipt?.validationEvidencePaths)
  ]);
  const verifiedCriteria = normalizeDoveVerifiedCriteria([
    ...normalizeDoveVerifiedCriteria(output?.verifiedCriteria),
    ...normalizeDoveVerifiedCriteria(executionReceipt?.verifiedCriteria)
  ]);
  return {
    status: "step-completed",
    outcome: `${command}-${outcomeStatus}`,
    stopReason: null,
    terminal: false,
    canCompleteTask: options.canCompleteTask === true && (artifactRefs.length > 0 || evidenceLinks.length > 0 || verificationEvidencePaths.length > 0 || verifiedCriteria.length > 0),
    artifactRefs,
    evidenceLinks,
    verificationEvidencePaths,
    verifiedCriteria,
    executionReceipt
  };
}

function classifyAutoStepResult(command, output) {
  const status = typeof output?.status === "string" && output.status.trim() ? output.status.trim() : null;
  if (AUTO_READ_ONLY_COMMANDS.has(command)) {
    return { status: "step-no-progress", outcome: `${command}-read-only`, stopReason: "read-only-auto-step", terminal: true, canCompleteTask: false, artifactRefs: [], evidenceLinks: [] };
  }
  if (status === "prepared-awaiting-audio") {
    return { status: "blocked-boundary", outcome: "awaiting-review-output", stopReason: "awaiting-review-output", terminal: true, canCompleteTask: false, artifactRefs: [], evidenceLinks: [] };
  }
  if (status === "prepared-awaiting-output") {
    return { status: "blocked-boundary", outcome: "awaiting-provider-output", stopReason: "awaiting-figure-provider-output", terminal: true, canCompleteTask: false, artifactRefs: [], evidenceLinks: [] };
  }
  if (status === "blocked-missing-materials") {
    return { status: "blocked-boundary", outcome: "missing-required-materials", stopReason: "missing-figure-materials", terminal: true, canCompleteTask: false, artifactRefs: [], evidenceLinks: [] };
  }
  if (status === "missing-secret-env") {
    return { status: "blocked-boundary", outcome: "missing-secret-env", stopReason: "figure-provider-missing-secret-env", terminal: true, canCompleteTask: false, artifactRefs: [], evidenceLinks: [] };
  }
  if (status === "provider-failed") {
    return { status: "blocked-boundary", outcome: "provider-failed", stopReason: "figure-provider-failed", terminal: true, canCompleteTask: false, artifactRefs: [], evidenceLinks: [] };
  }
  if (status === "blocked-boundary" && output?.boundary?.type) {
    return {
      status: "blocked-boundary",
      outcome: output.boundary.type,
      stopReason: output.stopReason ?? output.boundary.type,
      terminal: true,
      canCompleteTask: false,
      artifactRefs: [],
      evidenceLinks: [],
      requiredActions: normalizeStringArray(output.requiredActions ?? output.boundary.requiredActions)
    };
  }
  if (command === "dove.source" && (status === "needs-source-verification" || output?.outcome === "source-provenance-unverified")) {
    return {
      status: "blocked-boundary",
      outcome: output?.boundary?.type ?? "host-tool-blocked",
      stopReason: output?.stopReason ?? "source-provenance-unverified",
      terminal: true,
      canCompleteTask: false,
      artifactRefs: [],
      evidenceLinks: [],
      requiredActions: normalizeStringArray(output?.requiredActions ?? output?.boundary?.requiredActions)
    };
  }
  if (status === "qa-needs-attention" || status === "blocked" || status === "needs-review" || status === "max-iterations-exhausted" || status?.startsWith("blocked-")) {
    return { status: "blocked-boundary", outcome: status, stopReason: `${command}-${status}`, terminal: true, canCompleteTask: false, artifactRefs: [], evidenceLinks: [] };
  }
  if (command === "dove.source" && (status === "registered" || Array.isArray(output?.sourceIds) || output?.id)) {
    return completedAutoStep(command, output, status ?? "registered", { canCompleteTask: true });
  }
  if (command === "dove.note" && (output?.id || output?.noteId)) {
    return completedAutoStep(command, output, status ?? "recorded", { canCompleteTask: true });
  }
  if (command === "dove.draft" && output?.draftPath) {
    return completedAutoStep(command, output, status ?? "drafted", { canCompleteTask: true });
  }
  if (command === "dove.experience" && ["planned", "recorded", "bridged"].includes(status)) {
    return completedAutoStep(command, output, status, { canCompleteTask: status === "bridged" });
  }
  if (command === "dove.figure" && status === "validated" && output?.imported) {
    return completedAutoStep(command, output, status, { canCompleteTask: true });
  }
  if (command === "dove.review" && output?.imported) {
    return completedAutoStep(command, output, "imported", { canCompleteTask: true });
  }
  if (command === "dove.review-loop" && status === "coherent") {
    return completedAutoStep(command, output, status, { canCompleteTask: true });
  }
  if (command === "dove.rebuttal" && status === "drafted") {
    return completedAutoStep(command, output, status, { canCompleteTask: true });
  }
  return {
    status: "blocked-boundary",
    outcome: "unexpected-step-status",
    stopReason: `${command}-unexpected-status:${status ?? "missing"}`,
    terminal: true,
    canCompleteTask: false,
    artifactRefs: [],
    evidenceLinks: []
  };
}

function loadFullTask(root, task) {
  const catalog = readTaskPacketCatalog(root);
  return catalog.byId.get(task.id) ?? task;
}

function boundaryTypeFor(fields = {}, status = "blocked") {
  const explicitType = normalizeString(fields.boundaryType, null);
  if (explicitType) {
    return explicitType;
  }
  return status === "blocked" ? "blocked-boundary" : null;
}

function transitionBoundaryFor(task, status, fields, timestamp) {
  const explicit = normalizeDoveBoundary(fields.boundary, null);
  if (explicit) {
    return {
      ...explicit,
      packetId: explicit.packetId ?? task.id,
      createdAt: explicit.createdAt ?? timestamp
    };
  }
  const type = boundaryTypeFor(fields, status);
  if (!type) {
    return null;
  }
  return normalizeDoveBoundary({
    id: normalizeTaskPacketId(fields.boundaryId ?? `boundary-${task.id}-${type}-${Date.now().toString(36)}`),
    type,
    status: "open",
    packetId: task.id,
    runId: fields.runId ?? null,
    sourceSurface: fields.sourceSurface ?? fields.surface ?? null,
    command: fields.command ?? null,
    reason: fields.reason ?? fields.blockedReason ?? fields.stopReason ?? "",
    summary: fields.summary ?? fields.blockedReason ?? fields.reason ?? fields.stopReason ?? "",
    requiredInputs: fields.requiredInputs ?? [],
    requiredActions: fields.requiredActions ?? [],
    ownerRole: fields.ownerRole ?? task.ownerRole ?? ownerRoleFor(task),
    nextRole: fields.nextRole ?? task.nextRole ?? task.ownerRole ?? ownerRoleFor(task),
    createdAt: timestamp
  }, null);
}

function transitionHandoffFor(task, fields, boundary, timestamp) {
  const explicit = normalizeDoveHandoff(fields.handoff, null);
  if (explicit) {
    return {
      ...explicit,
      boundaryId: explicit.boundaryId ?? boundary?.id ?? null,
      requestedAt: explicit.requestedAt ?? timestamp
    };
  }
  const ownerRole = normalizeDovePrimaryRoleId(fields.ownerRole ?? task.ownerRole, ownerRoleFor(task));
  const nextRole = normalizeDovePrimaryRoleId(fields.nextRole ?? boundary?.nextRole, ownerRole);
  if (nextRole === ownerRole) {
    return null;
  }
  return normalizeDoveHandoff({
    id: normalizeTaskPacketId(fields.handoffId ?? `handoff-${task.id}-${ownerRole}-to-${nextRole}-${Date.now().toString(36)}`),
    status: "pending",
    fromRole: ownerRole,
    toRole: nextRole,
    reason: fields.reason ?? boundary?.reason ?? "",
    summary: fields.summary ?? boundary?.summary ?? "",
    boundaryId: boundary?.id ?? null,
    sourceRunId: fields.runId ?? null,
    requestedAt: timestamp
  }, null);
}

function appendBoundaryHistory(task, boundary, resolvedBoundary) {
  return [
    ...(Array.isArray(task.boundaryHistory) ? task.boundaryHistory : []),
    ...(resolvedBoundary ? [resolvedBoundary] : []),
    ...(boundary ? [boundary] : [])
  ].slice(-20);
}

function runtimeEventId(packetId, type, count) {
  return normalizeTaskPacketId(`event-${packetId}-${type}-${Date.now().toString(36)}-${count}`);
}

function persistentLifecycleFields(fields = {}) {
  const allowedKeys = [
    "currentFocus",
    "nextAction",
    "lessonIds",
    "artifactRefs",
    "evidenceLinks",
    "validationEvidencePaths",
    "verificationEvidencePaths",
    "verifiedCriteria",
    "executionContract",
    "outputPaths",
    "claimIds",
    "noteIds",
    "experimentIds",
    "resultIds",
    "auditIds",
    "versionIds",
    "rebuttalIssueIds",
    "archivedAt",
    "archiveReason"
  ];
  return Object.fromEntries(allowedKeys.filter((key) => fields[key] !== undefined).map((key) => [key, fields[key]]));
}

function assertChecklistCompletionReady(root, task, status, responseLanguage = "zh") {
  const block = checklistCompletionBlock(root, task, status, responseLanguage);
  if (block) {
    const error = new Error(block.message);
    error.code = block.status;
    error.openChecklistChildIds = block.openChecklistChildIds;
    throw error;
  }
}

function recordLifecycleEvents(root, packet, transition, openedBoundary, resolvedBoundary, handoff) {
  const artifacts = loadRuntimeArtifacts(root);
  const baseCount = artifacts.events.entries?.length ?? 0;
  const base = {
    packetId: packet.id,
    runId: transition.runId ?? null,
    surface: transition.surface ?? transition.sourceSurface ?? null,
    command: transition.command ?? null,
    fromStatus: transition.fromStatus,
    toStatus: transition.toStatus,
    summary: transition.summary ?? "",
    evidenceLinks: normalizeStringArray(transition.evidenceLinks),
    artifactRefs: normalizeStringArray(transition.artifactRefs),
    timestamp: transition.timestamp,
    recordedAt: transition.timestamp
  };
  const events = [{
    ...base,
    id: runtimeEventId(packet.id, "task-lifecycle-transitioned", baseCount + 1),
    type: "task.lifecycle.transitioned",
    eventType: "task.lifecycle.transitioned",
    boundaryId: openedBoundary?.id ?? resolvedBoundary?.id ?? null,
    handoffId: handoff?.id ?? null
  }];
  if (resolvedBoundary) {
    events.push({
      ...base,
      id: runtimeEventId(packet.id, "task-boundary-resolved", baseCount + events.length + 1),
      type: "task.boundary.resolved",
      eventType: "task.boundary.resolved",
      boundaryId: resolvedBoundary.id,
      boundary: resolvedBoundary,
      handoffId: null
    });
  }
  if (openedBoundary) {
    events.push({
      ...base,
      id: runtimeEventId(packet.id, "task-boundary-opened", baseCount + events.length + 1),
      type: "task.boundary.opened",
      eventType: "task.boundary.opened",
      boundaryId: openedBoundary.id,
      boundary: openedBoundary,
      handoffId: handoff?.id ?? null
    });
  }
  if (handoff) {
    events.push({
      ...base,
      id: runtimeEventId(packet.id, "task-handoff-requested", baseCount + events.length + 1),
      type: "task.handoff.requested",
      eventType: "task.handoff.requested",
      boundaryId: openedBoundary?.id ?? resolvedBoundary?.id ?? null,
      handoffId: handoff.id,
      handoff
    });
  }
  for (const event of events) {
    appendEvent(artifacts, event);
  }
  saveRuntimeArtifacts(root, artifacts);
}

function updateTaskLifecycle(root, task, status, fields = {}) {
  const timestamp = nowIso();
  const fullTask = loadFullTask(root, task);
  assertChecklistCompletionReady(root, fullTask, status, resolveDoveResponseLanguage(root, fields));
  const fromStatus = fullTask.status;
  const artifactRefs = fields.artifactRefs !== undefined ? normalizeStringArray(fields.artifactRefs) : fullTask.artifactRefs;
  const evidenceLinks = fields.evidenceLinks !== undefined ? normalizeStringArray(fields.evidenceLinks) : fullTask.evidenceLinks;
  const persistedFields = persistentLifecycleFields(fields);
  const statusFields = {};
  if (status === "in-progress" && !fullTask.startedAt) {
    statusFields.startedAt = fields.startedAt ?? timestamp;
  }
  if (status === "completed") {
    statusFields.completedAt = fields.completedAt ?? timestamp;
    statusFields.blockedReason = null;
  }
  if (status === "blocked") {
    statusFields.blockedReason = normalizeString(fields.blockedReason ?? fields.reason ?? fields.stopReason, fullTask.blockedReason ?? "");
  }
  if (!["blocked"].includes(status) && fullTask.status === "blocked") {
    statusFields.blockedReason = null;
  }
  if (status === "killed") {
    statusFields.killedAt = fields.killedAt ?? timestamp;
    statusFields.killReason = normalizeString(fields.killReason ?? fields.reason, fullTask.killReason ?? "");
  }
  if (status === "archived") {
    statusFields.archivedAt = fields.archivedAt ?? timestamp;
    statusFields.archiveReason = normalizeString(fields.archiveReason ?? fields.reason, fullTask.archiveReason ?? "");
    statusFields.blockedReason = null;
  }
  const openedBoundary = status === "blocked" || fields.boundary || fields.boundaryType
    ? transitionBoundaryFor(fullTask, status, { ...fields, artifactRefs }, timestamp)
    : null;
  const resolvedBoundary = fullTask.boundary?.status === "open" && !openedBoundary && status !== "blocked"
    ? normalizeDoveBoundary({ ...fullTask.boundary, status: "resolved", resolvedAt: timestamp, resolution: fields.reason ?? `status:${status}` }, null)
    : null;
  const ownerRole = normalizeDovePrimaryRoleId(fields.ownerRole ?? fullTask.ownerRole, ownerRoleFor(fullTask));
  const nextRole = normalizeDovePrimaryRoleId(fields.nextRole ?? openedBoundary?.nextRole ?? fullTask.nextRole, ownerRole);
  const handoff = transitionHandoffFor(fullTask, { ...fields, ownerRole, nextRole }, openedBoundary, timestamp);
  const lastTransition = {
    fromStatus,
    toStatus: status,
    reason: normalizeString(fields.reason ?? fields.stopReason ?? fields.blockedReason, ""),
    summary: normalizeString(fields.summary, ""),
    surface: normalizeString(fields.surface ?? fields.sourceSurface, null),
    command: normalizeString(fields.command, null),
    runId: normalizeString(fields.runId, null),
    boundaryId: openedBoundary?.id ?? resolvedBoundary?.id ?? null,
    handoffId: handoff?.id ?? null,
    transitionedAt: timestamp
  };
  const packet = {
    ...fullTask,
    ...persistedFields,
    ...statusFields,
    artifactRefs,
    evidenceLinks,
    status,
    lifecycleStatus: status,
    ownerRole,
    nextRole,
    boundary: openedBoundary,
    boundaryHistory: appendBoundaryHistory(fullTask, openedBoundary, resolvedBoundary),
    handoff: handoff ?? (resolvedBoundary ? null : fullTask.handoff ?? null),
    lastTransition,
    updatedAt: timestamp
  };
  writePacket(root, packet);
  const nextIndex = saveTaskIndex(root, upsertIndexItem(loadTaskIndex(root), packet));
  const state = loadState(root);
  saveState(root, {
    ...state,
    orchestration: {
      ...state.orchestration,
      activeTaskIds: nextIndex.taskModel.activeTaskIds,
      currentFocus: packet.currentFocus ?? state.orchestration.currentFocus,
      nextAction: packet.nextAction ?? state.orchestration.nextAction
    }
  });
  recordLifecycleEvents(root, packet, {
    ...lastTransition,
    timestamp,
    evidenceLinks: fields.evidenceLinks,
    artifactRefs
  }, openedBoundary, resolvedBoundary, handoff);
  return packet;
}

function persistAutoResult(root, result) {
  const artifacts = loadRuntimeArtifacts(root);
  const entry = {
    ...result,
    runId: result.runId ?? result.id,
    recordedAt: result.recordedAt ?? result.updatedAt ?? nowIso()
  };
  appendResult(artifacts, entry);
  saveRuntimeArtifacts(root, artifacts);
}

function terminalAutoTaskStatus(status) {
  return status === "completed" || status === "killed" || status === "blocked";
}

function taskSelectionChoices(candidates = []) {
  return candidates.map((task, itemIndex) => ({
    index: itemIndex + 1,
    id: task.id ?? task.packetId,
    packetId: task.packetId ?? task.id,
    title: task.title,
    status: task.status,
    level: task.level,
    score: task.score,
    matchedBy: task.matchedBy
  }));
}

function autoConfirmArgs(args = {}, maxIterations, values = {}) {
  return {
    ...args,
    ...values,
    confirmed: true,
    maxIterations
  };
}

function autoSelectionConfirmation(root, args, selected, maxIterations, responseLanguage = "zh") {
  const task = loadFullTask(root, selected);
  const autoPlan = inferAutoStepsForTask(task, args);
  const preActionGuidance = preActionGuidanceForTask(root, "dove.auto", task, {
    request: requestTextFromArgs(args),
    roleId: "builder",
    nextAction: task.nextAction,
    workflowKind: "auto"
  }, responseLanguage);
  const classification = {
    stage: task.stage,
    domain: task.domain,
    rationale: [`stage=${task.stage}`, `domain=${task.domain}`, "selected-existing-task"]
  };
  return {
    status: "needs-confirmation",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    confirmationRequired: true,
    demandConversion: false,
    executionMode: "multi-round-foreground-auto",
    selectedTask: task,
    preActionGuidance,
    taskCard: buildTaskConfirmationCard(task, { firstAction: task.nextAction ?? nextCommandFor(classification), preActionGuidance }, responseLanguage),
    autoCard: buildAutoConfirmationCard(task, autoPlan, { maxIterations, preActionGuidance }, responseLanguage),
    classification,
    blockers: [...normalizeStringArray(task.dependencies), ...normalizeStringArray(task.blockedBy)],
    evidenceExpectations: normalizeStringArray(task.evidenceExpectations),
    proposedNextCommand: normalizeString(task.nextAction, nextCommandFor(classification)),
    proposedSteps: autoPlan.proposedSteps,
    safeToRun: autoPlan.safeToRun,
    requiresHostPass: autoPlan.requiresHostPass,
    whyThisStep: autoPlan.whyThisStep,
    confirmArgs: autoConfirmArgs(args, maxIterations, { packetId: task.id }),
    foreground: true,
    background: false,
    daemon: false,
    maxIterations,
    responseLanguage,
    message: doveText(responseLanguage, "autoSelectionConfirmMessage")
  };
}

function autoDemandConfirmation(root, args, maxIterations) {
  const contract = buildDoveTaskContract(root, args);
  const { packet, checklistProposal, classification, blockers, applicableLessons, responseLanguage, proposedInit, initMaterializationRequired } = contract;
  const autoPlan = inferAutoStepsForTask(packet, args);
  const preActionGuidance = preActionGuidanceForTask(root, "dove.auto", packet, {
    request: requestTextFromArgs(args),
    roleId: "builder",
    nextAction: packet.nextAction,
    workflowKind: "auto"
  }, responseLanguage);
  return {
    status: "needs-confirmation",
    proposalOnly: true,
    noAutoApply: true,
    writes: [],
    confirmationRequired: true,
    demandConversion: true,
    executionMode: "multi-round-foreground-auto",
    initMaterializationRequired,
    proposedInit,
    proposedTask: packet,
    preActionGuidance,
    taskCard: buildTaskConfirmationCard(packet, { firstAction: packet.nextAction, preActionGuidance }, responseLanguage),
    autoCard: buildAutoConfirmationCard(packet, autoPlan, { maxIterations, preActionGuidance }, responseLanguage),
    classification,
    blockers,
    evidenceExpectations: packet.evidenceExpectations,
    proposedNextCommand: packet.nextAction,
    proposedSteps: autoPlan.proposedSteps,
    safeToRun: autoPlan.safeToRun,
    requiresHostPass: autoPlan.requiresHostPass,
    whyThisStep: autoPlan.whyThisStep,
    checklistProposal,
    applicableLessons,
    confirmArgs: autoConfirmArgs(args, maxIterations, {
      ...(proposedInit ? {
        initId: proposedInit.id,
        initTitle: proposedInit.title,
        initObjective: proposedInit.summary,
        initDomain: proposedInit.domain
      } : {}),
      id: packet.id,
      goal: packet.summary,
      title: packet.title,
      summary: packet.summary,
      stage: packet.stage,
      domain: packet.domain,
      level: packet.level,
      creatorKind: packet.creatorKind,
      status: packet.status,
      dependencies: packet.dependencies,
      blockedBy: packet.blockedBy,
      evidenceExpectations: packet.evidenceExpectations,
      artifactRefs: packet.artifactRefs,
      contextPolicy: packet.contextPolicy,
      lessonIds: packet.lessonIds,
      checklistItems: checklistProposal.items
    }),
    foreground: true,
    background: false,
    daemon: false,
    maxIterations,
    taskIndexPath: ARTIFACT_PATHS.taskPacketsIndex,
    responseLanguage,
    message: doveText(responseLanguage, "autoDemandConfirmMessage")
  };
}

export function runDoveAuto(root, args = {}) {
  assertGovernanceMutationRegistered("run-dove-auto", "guarded");
  ensureWorkspace(root);
  const state = loadState(root);
  const responseLanguage = resolveDoveResponseLanguage(root, args, { state });
  const maxIterations = resolveAutoMaxIterations(state, args);
  if (!hasExplicitConfirmation(args)) {
    const index = loadTaskIndex(root);
    const selection = chooseTask(root, index, args);
    if (selection.selected && hasExplicitTaskSelector(args)) {
      return autoSelectionConfirmation(root, args, selection.selected, maxIterations, responseLanguage);
    }
    if (hasExplicitTaskSelector(args) && !selection.selected) {
      return {
        status: "needs-task-selection",
        choices: taskSelectionChoices(selection.candidates),
        responseLanguage,
        message: doveText(responseLanguage, "autoSelectExistingMessage")
      };
    }
    if (!hasTaskIntent(args)) {
      return {
        status: "needs-task-selection",
        choices: taskSelectionChoices(selection.candidates),
        responseLanguage,
        message: doveText(responseLanguage, "autoSelectOrDemandMessage")
      };
    }
    return autoDemandConfirmation(root, args, maxIterations);
  }

  const index = loadTaskIndex(root);
  const selection = chooseTask(root, index, args);
  if (!selection.selected && hasExplicitTaskSelector(args)) {
    return {
      status: "needs-task-selection",
      choices: taskSelectionChoices(selection.candidates),
      responseLanguage,
      message: doveText(responseLanguage, "autoSelectExistingConfirmedMessage")
    };
  }
  if (!selection.selected && !hasTaskIntent(args)) {
    return {
      status: "needs-task-selection",
      choices: taskSelectionChoices(selection.candidates),
      responseLanguage,
      message: doveText(responseLanguage, "autoProvideTargetMessage")
    };
  }

  let task = selection.selected ? loadFullTask(root, selection.selected) : materializeDoveTask(root, buildDoveTaskContract(root, args)).createdTask;
  const timestamp = nowIso();
  const resultId = normalizeTaskPacketId(args.runId ?? `auto-${task.id}-${Date.now().toString(36)}`);
  const result = {
    id: resultId,
    packetId: task.id,
    status: "in-progress",
    outcome: "foreground-iterations-started",
    foreground: true,
    background: false,
    daemon: false,
    maxIterations,
    iterationCount: 0,
    allowedInternalCommands: AUTO_INTERNAL_COMMANDS,
    stopReason: null,
    iterations: [],
    taskStatusBefore: task.status,
    taskStatusAfter: task.status,
    responseLanguage,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const preActionGuidanceSummary = preActionGuidanceSummaryForTask(root, "dove.auto", task, {
    request: requestTextFromArgs(args),
    roleId: "builder",
    nextAction: task.nextAction,
    workflowKind: "auto"
  }, responseLanguage);

  if (task.status === "killed") {
    result.status = "stopped-killed";
    result.outcome = "task-already-killed";
    result.stopReason = "task-killed";
    persistAutoResult(root, result);
    return { status: result.status, task, result, resultCard: autoResultCard(task, result, { nextAction: task.nextAction, preActionGuidanceSummary }, responseLanguage), applicableLessons: activeLessons(root, task.id), responseLanguage, nextAction: task.nextAction };
  }
  if (task.status === "completed") {
    result.status = "completed";
    result.outcome = "task-already-completed";
    result.stopReason = "task-completed";
    persistAutoResult(root, result);
    return { status: result.status, task, result, resultCard: autoResultCard(task, result, { nextAction: task.nextAction, preActionGuidanceSummary }, responseLanguage), applicableLessons: activeLessons(root, task.id), responseLanguage, nextAction: task.nextAction };
  }
  if (task.status === "blocked") {
    result.status = "blocked";
    result.outcome = "task-already-blocked";
    result.stopReason = "task-blocked";
    persistAutoResult(root, result);
    return { status: result.status, task, result, resultCard: autoResultCard(task, result, { nextAction: task.nextAction, preActionGuidanceSummary }, responseLanguage), applicableLessons: activeLessons(root, task.id), responseLanguage, nextAction: task.nextAction };
  }

  const autoPlan = inferAutoStepsForTask(task, args);
  const steps = autoPlan.steps;
  result.proposedSteps = autoPlan.proposedSteps;
  result.safeToRun = autoPlan.safeToRun;
  result.requiresHostPass = autoPlan.requiresHostPass;
  result.whyThisStep = autoPlan.whyThisStep;
  const readOnlyBlock = readOnlyAutoBlock(task, autoPlan, args, responseLanguage);
  if (readOnlyBlock) {
    return {
      ...readOnlyBlock,
      result: {
        ...result,
        status: readOnlyBlock.status,
        outcome: readOnlyBlock.outcome,
        stopReason: "read-only-auto-step",
        safeToRun: false,
        iterationCount: 0,
        taskStatusAfter: task.status,
        updatedAt: nowIso()
      },
      task,
      applicableLessons: activeLessons(root, task.id)
    };
  }
  if (steps.length === 0) {
    const completedAt = nowIso();
    result.iterations.push({
      iteration: 1,
      command: null,
      status: "awaiting-host-pass",
      outcome: "host-pass-required",
      stopReason: autoPlan.whyThisStep,
      startedAt: timestamp,
      completedAt
    });
    result.status = "awaiting-host-pass";
    result.outcome = "host-pass-required";
    result.stopReason = autoPlan.whyThisStep;
    task = updateTaskLifecycle(root, task, "blocked", {
      runId: resultId,
      surface: "dove.auto",
      command: "run_dove_auto",
      boundaryType: "awaiting-host-pass",
      reason: result.stopReason,
      stopReason: result.stopReason,
      summary: result.outcome,
      requiredActions: autoHostPassRequiredActions(autoPlan),
      nextAction: task.nextAction
    });
    result.boundary = task.boundary;
    result.iterationCount = result.iterations.length;
    result.taskStatusAfter = task.status;
    result.updatedAt = completedAt;
    persistAutoResult(root, result);
    return {
      status: result.status,
      task,
      result,
      resultCard: autoResultCard(task, result, { nextAction: task.nextAction, preActionGuidanceSummary }, responseLanguage),
      boundary: task.boundary,
      applicableLessons: activeLessons(root, task.id),
      responseLanguage,
      proposedSteps: autoPlan.proposedSteps,
      safeToRun: autoPlan.safeToRun,
      requiresHostPass: autoPlan.requiresHostPass,
      whyThisStep: autoPlan.whyThisStep,
      recordMissionPassTool: "record_dove_mission_pass",
      recordMissionPassArgs: {
        packetId: task.id,
        runId: normalizeTaskPacketId(`mission-${task.id}-${Date.now().toString(36)}`)
      },
      nextAction: task.nextAction
    };
  }

  task = updateTaskLifecycle(root, task, "in-progress", { runId: resultId, surface: "dove.auto", command: "run_dove_auto" });
  let finalTaskStatus = "in-progress";

  for (let index = 0; index < maxIterations; index += 1) {
    task = loadFullTask(root, task);
    if (terminalAutoTaskStatus(task.status)) {
      result.status = task.status === "completed" ? "completed" : task.status === "killed" ? "stopped-killed" : "blocked";
      result.outcome = `task-${task.status}`;
      result.stopReason = `task-${task.status}`;
      finalTaskStatus = task.status;
      break;
    }

    const iterationNumber = index + 1;
    const startedAt = nowIso();
    const step = steps[index] ?? null;
    if (!step) {
      const completedAt = nowIso();
      result.iterations.push({
        iteration: iterationNumber,
        command: null,
        status: "awaiting-host-pass",
        outcome: "host-pass-required",
        stopReason: autoPlan.whyThisStep,
        startedAt,
        completedAt
      });
      result.status = "awaiting-host-pass";
      result.outcome = "host-pass-required";
      result.stopReason = autoPlan.whyThisStep;
      task = updateTaskLifecycle(root, task, "blocked", {
        runId: resultId,
        surface: "dove.auto",
        command: "run_dove_auto",
        boundaryType: "awaiting-host-pass",
        reason: result.stopReason,
        stopReason: result.stopReason,
        summary: result.outcome,
        requiredActions: autoHostPassRequiredActions(autoPlan),
        nextAction: task.nextAction
      });
      result.boundary = task.boundary;
      finalTaskStatus = task.status;
      break;
    }

    try {
      const output = executeAutoStep(root, step.command, stepArgsForTask(task, step.args));
      const classified = classifyAutoStepResult(step.command, output);
      const executionReceipt = mergeDoveExecutionReceipts(step.executionReceipt, classified.executionReceipt);
      const completedAt = nowIso();
      result.iterations.push({
        iteration: iterationNumber,
        command: step.command,
        status: classified.status,
        outcome: classified.outcome,
        stopReason: classified.stopReason,
        output: summarizeStepOutput(output),
        artifactRefs: classified.artifactRefs,
        evidenceLinks: classified.evidenceLinks,
        verificationEvidencePaths: classified.verificationEvidencePaths,
        verifiedCriteria: classified.verifiedCriteria,
        executionReceipt,
        startedAt,
        completedAt
      });
      if (classified.terminal) {
        task = updateTaskLifecycle(root, task, "blocked", {
          runId: resultId,
          surface: "dove.auto",
          command: step.command,
          boundaryType: normalizeDoveBoundaryType(classified.outcome, "blocked-boundary"),
          reason: classified.stopReason,
          stopReason: classified.stopReason,
          summary: classified.outcome,
          requiredActions: classified.requiredActions ?? [],
          nextAction: "project:dove.status"
        });
        result.status = classified.status;
        result.outcome = classified.outcome;
        result.stopReason = classified.stopReason;
        result.boundary = task.boundary;
        finalTaskStatus = task.status;
        break;
      }
      if (step.completeTask === true || args.completeTask === true || args.complete === true || args.completeOnSuccess === true) {
        const completionArgs = {
          runId: resultId,
          surface: "dove.auto",
          command: step.command,
          resultSummary: classified.outcome,
          summary: classified.outcome,
          artifactRefs: normalizeStringArray([...(classified.artifactRefs ?? []), ...normalizeStringArray(step.outputArtifacts)]),
          evidenceLinks: classified.evidenceLinks,
          validationEvidencePaths: normalizeStringArray(step.validationEvidencePaths),
          verificationEvidencePaths: normalizeStringArray([...(classified.verificationEvidencePaths ?? []), ...normalizeStringArray(step.verificationEvidencePaths)]),
          verifiedCriteria: normalizeDoveVerifiedCriteria([...(classified.verifiedCriteria ?? []), ...normalizeDoveVerifiedCriteria(step.verifiedCriteria)]),
          executionReceipt,
          executionContract: step.executionContract ?? task.executionContract
        };
        const verificationBlock = completionVerificationBlock(task, completionArgs, responseLanguage);
        const completionEvidence = completionEvidenceForPayload(completionArgs);
        const canCompleteWithEvidence = classified.canCompleteTask === true || completionEvidence.evidencePaths.length > 0 || completionEvidence.verifiedCriteria.length > 0;
        if (!canCompleteWithEvidence || verificationBlock) {
          const block = verificationBlock ?? {
            status: "needs-completion-evidence",
            boundaryType: "missing-required-materials",
            message: "auto-step-did-not-produce-completion-evidence",
            requiredActions: ["provide-evidence-links-or-artifact-refs-or-verification-evidence"]
          };
          task = updateTaskLifecycle(root, task, "blocked", {
            ...completionArgs,
            boundaryType: normalizeDoveBoundaryType(block.boundaryType ?? block.status, "blocked-boundary"),
            reason: block.message,
            stopReason: block.status,
            summary: block.message,
            requiredActions: block.requiredActions ?? [],
            nextAction: "project:dove.status"
          });
          result.status = block.status;
          result.outcome = block.status;
          result.stopReason = block.message;
          result.boundary = task.boundary;
          finalTaskStatus = task.status;
          break;
        }
        task = updateTaskLifecycle(root, task, "completed", {
          ...completionArgs,
          reason: "completion-confirmed-by-auto-step",
          nextAction: "project:dove.status"
        });
        result.status = "completed";
        result.outcome = "task-completed";
        result.stopReason = "completion-confirmed-by-auto-step";
        finalTaskStatus = task.status;
        break;
      }
      if (iterationNumber === maxIterations) {
        result.status = "step-budget-exhausted";
        result.outcome = "max-iterations-reached";
        result.stopReason = "max-iterations-reached";
        finalTaskStatus = task.status;
      }
    } catch (error) {
      const completedAt = nowIso();
      result.iterations.push({
        iteration: iterationNumber,
        command: step.command,
        status: "blocked-boundary",
        outcome: "workflow-error-boundary",
        stopReason: error.message,
        startedAt,
        completedAt
      });
      result.status = "blocked-boundary";
      result.outcome = "workflow-error-boundary";
      result.stopReason = error.message;
      task = updateTaskLifecycle(root, task, "blocked", {
        runId: resultId,
        surface: "dove.auto",
        command: step.command,
        boundaryType: "workflow-error-boundary",
        reason: error.message,
        stopReason: error.message,
        summary: "workflow-error-boundary",
        nextAction: "project:dove.status"
      });
      result.boundary = task.boundary;
      finalTaskStatus = task.status;
      break;
    }
  }

  if (finalTaskStatus === "blocked" && task.status !== "blocked") {
    task = updateTaskLifecycle(root, task, "blocked", {
      runId: resultId,
      surface: "dove.auto",
      command: "run_dove_auto",
      boundaryType: normalizeDoveBoundaryType(result.outcome, "blocked-boundary"),
      reason: result.stopReason,
      stopReason: result.stopReason,
      summary: result.outcome,
      nextAction: "project:dove.status"
    });
    result.boundary = task.boundary;
    finalTaskStatus = task.status;
  }
  result.iterationCount = result.iterations.length;
  result.taskStatusAfter = finalTaskStatus;
  result.updatedAt = nowIso();
  persistAutoResult(root, result);
  return {
    status: result.status,
    task,
    result,
    resultCard: autoResultCard(task, result, { nextAction: task.nextAction, preActionGuidanceSummary }, responseLanguage),
    boundary: task.boundary ?? null,
    applicableLessons: activeLessons(root, task.id),
    responseLanguage,
    nextAction: task.nextAction
  };
}
