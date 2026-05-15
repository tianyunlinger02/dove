import path from "node:path";

import {
  ARTIFACT_PATHS,
  DOVE_AUDIO_CONTEXT_POLICY,
  DOVE_TASK_CREATOR_KINDS,
  DOVE_TASK_DOMAINS,
  DOVE_TASK_STAGES,
  DOVE_TASK_STATUSES,
  createTaskPacketsIndex
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

function activeStatus(status) {
  return !["completed", "killed", "archived", "archived-with-lineage"].includes(status);
}

function normalizeIndex(index = createTaskPacketsIndex()) {
  const base = createTaskPacketsIndex();
  const items = Array.isArray(index.items) ? index.items.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : [];
  const activeInit = items.find((item) => item.level === 0 && item.status !== "killed") ?? null;
  const activeItems = items.filter((item) => item.level !== 0 && activeStatus(item.status));
  const lifecycleCounts = {};
  const stageCounts = Object.fromEntries(DOVE_TASK_STAGES.map((stage) => [stage, 0]));
  const domainCounts = Object.fromEntries(DOVE_TASK_DOMAINS.map((domain) => [domain, 0]));
  const levelCounts = {};
  for (const item of items) {
    const status = normalizeStatus(item.status ?? item.lifecycleStatus, "pending");
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
    currentFocus: packet.currentFocus,
    nextAction: packet.nextAction,
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
    killedAt: packet.killedAt ?? null,
    killReason: packet.killReason ?? null,
    lessonIds: packet.lessonIds,
    artifactRefs: packet.artifactRefs,
    contextPolicy: packet.contextPolicy,
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

function classifyTask(args = {}) {
  const text = [args.goal, args.objective, args.prompt, args.title, args.summary, args.intent].map((item) => String(item ?? "").toLowerCase()).join(" ");
  const explicitStage = normalizeAllowed(args.stage ?? args.missionStage, DOVE_TASK_STAGES, null);
  const explicitDomain = normalizeAllowed(args.domain ?? args.doveDomain ?? args.missionDomain, DOVE_TASK_DOMAINS, null);
  const stage = explicitStage ?? (/(review|audit|check|verify|audio|审稿|审核|检查)/u.test(text) ? "audit" : /(plan|design|outline|proposal|规划|计划|方案)/u.test(text) ? "plan" : "execute");
  const domain = explicitDomain ?? (/(experiment|ablation|baseline|metric|result|实验|消融|指标)/u.test(text) ? "experiment" : /(paper|draft|claim|figure|citation|rebuttal|reviewer|论文|草稿|图|返修|审稿)/u.test(text) ? "paper" : "engineering");
  return {
    stage,
    domain,
    rationale: [`stage=${stage}`, `domain=${domain}`]
  };
}

function nextCommandFor(classification) {
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

function activeLessons(root, packetId = null) {
  const lessons = readJson(root, ARTIFACT_PATHS.metaOperatorLessons, { lessons: [] });
  return (Array.isArray(lessons.lessons) ? lessons.lessons : []).filter((lesson) => {
    const status = lesson.status ?? "active";
    const packetIds = normalizeStringArray(lesson.packetIds);
    return status === "active" && (!packetId || packetIds.length === 0 || packetIds.includes(packetId));
  }).map((lesson) => ({ id: lesson.id, title: lesson.title, mustObey: lesson.mustObey ?? true, nextTime: lesson.nextTime ?? [] }));
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
  return {
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
    killedAt: null,
    killReason: null,
    lessonIds: normalizeStringArray(args.lessonIds),
    artifactRefs: normalizeStringArray(args.artifactRefs ?? args.artifactPaths),
    contextPolicy: normalizeString(args.contextPolicy, DOVE_AUDIO_CONTEXT_POLICY),
    packetPath: taskPacketPath(id),
    packetContextPath: taskContextPath(id),
    currentFocus: normalizeString(overrides.currentFocus ?? args.currentFocus ?? args.goal ?? args.objective ?? args.prompt, requestedTitle),
    nextAction: normalizeString(overrides.nextAction ?? args.nextAction, nextCommandFor(classification)),
    evidenceExpectations: normalizeStringArray(args.evidenceExpectations),
    ...(overrides.extraFields && typeof overrides.extraFields === "object" && !Array.isArray(overrides.extraFields) ? overrides.extraFields : {})
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
    { id: "clarify-scope-acceptance-evidence", title: doveText(responseLanguage, "checklistClarifyTitle"), summary: doveText(responseLanguage, "checklistClarifySummary") },
    { id: "perform-core-mission-work", title: doveText(responseLanguage, "checklistWorkTitle"), summary: doveText(responseLanguage, "checklistWorkSummary") },
    { id: classification.stage === "audit" ? "run-independent-review-record-findings" : "validate-evidence-record-completion", title: validationTitle, summary: doveText(responseLanguage, "checklistValidateSummary") }
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
    return {
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
      killedAt: null,
      killReason: null,
      lessonIds: [],
      artifactRefs: normalized.artifactRefs,
      contextPolicy: parent.contextPolicy,
      packetPath: taskPacketPath(id),
      packetContextPath: taskContextPath(id),
      currentFocus: normalizeString(normalized.summary, title),
      nextAction: normalizeString(normalized.nextAction, parent.nextAction),
      evidenceExpectations: normalized.evidenceExpectations
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
    killedAt: null,
    killReason: null,
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
    killedAt: null,
    killReason: null,
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

function stripPlanTitle(title, responseLanguage = "zh") {
  const stripped = String(title ?? "")
    .replace(/^\s*(?:plan|planning|design|proposal|方案|计划|规划)\s*[:：,，\-—]?\s*/iu, "")
    .trim();
  return stripped || normalizeString(title, doveText(responseLanguage, "executePlannedWork"));
}

function normalizePlanMissionSource(item, index, fallbackTitle) {
  if (typeof item === "string") {
    return { title: item, summary: item };
  }
  const source = plainObject(item);
  const title = normalizeString(source.title ?? source.goal ?? source.objective ?? source.summary, `${fallbackTitle} ${index + 1}`);
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
  const fallbackTitle = stripPlanTitle(planTask.title ?? planTask.summary, responseLanguage);
  const topMissions = missionInputs.length > 0
    ? missionInputs.map((item, index) => normalizePlanMissionSource(item, index, fallbackTitle))
    : [{ title: fallbackTitle, summary: normalizeString(planTask.summary, fallbackTitle) }];
  return topMissions.map((mission, index) => ({
    ...mission,
    childMissions: [
      ...objectArray(mission.children),
      ...objectArray(mission.childMissions),
      ...(index === 0 ? globalChildren : [])
    ]
  }));
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
  const title = normalizeString(source.title ?? source.goal ?? source.objective ?? source.summary, options.fallbackTitle ?? doveText(responseLanguage, "missionFallbackTitle"));
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
      fallbackTitle: stripPlanTitle(planTask.title ?? planTask.summary, responseLanguage),
      derivedFrom: "completed-plan-mission"
    });
    const topResult = materializeOneDerivedTask(root, nextIndex, topPacket, catalog);
    nextIndex = topResult.index;
    (topResult.created ? createdMissions : reusedMissions).push(topResult.packet);
    const childFallbackTitle = doveText(responseLanguage, "childMissionFallback", { title: topPacket.title });
    const childSources = objectArray(source.childMissions).map((item, childIndex) => normalizePlanMissionSource(item, childIndex, childFallbackTitle));
    for (const [childIndex, childSource] of childSources.entries()) {
      const childLevel = normalizeLevel(childSource.level ?? childSource.taskLevel ?? childSource.missionLevel, topResult.packet.level + 1);
      const childPacket = buildDerivedTask(root, init, topResult.packet, childSource, {
        idPrefix: `${topResult.packet.id}-mission-${childIndex + 1}`,
        level: childLevel,
        minimumLevel: topResult.packet.level + 1,
        classification: { stage: childSource.stage ?? topResult.packet.stage, domain: childSource.domain ?? topResult.packet.domain },
        sourcePlanTaskId: planTask.id,
        sourceMissionPassRunId: runId,
        fallbackTitle: childFallbackTitle,
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

function chooseTask(root, index, args = {}) {
  const candidates = candidateTasks(index);
  if (Number.isFinite(args.index)) {
    return { selected: candidates[Math.max(0, Math.floor(args.index) - 1)] ?? null, candidates };
  }
  if (hasExplicitTaskSelector(args)) {
    try {
      const resolved = resolveDurableTaskPacket(root, args, workflowTargetOptions());
      const indexed = (index.items ?? []).find((item) => item.id === resolved.packetId) ?? resolved.packet;
      return { selected: indexed, candidates, resolution: resolved.resolution };
    } catch (error) {
      return {
        selected: null,
        candidates: Array.isArray(error.candidates) && error.candidates.length > 0 ? error.candidates : candidates,
        resolutionError: error.message
      };
    }
  }
  return { selected: candidates.length === 1 ? candidates[0] : null, candidates };
}

function normalizeMissionPassStatus(args = {}) {
  const explicit = normalizeAllowed(args.resultStatus ?? args.taskStatus ?? args.missionStatus, ["completed", "blocked", "in-progress"], null);
  if (explicit) {
    return explicit;
  }
  if (args.completeTask === true || args.complete === true || args.completeOnSuccess === true) {
    return "completed";
  }
  if (args.blocked === true) {
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
  "stopReason",
  "evidenceLinks",
  "evidencePaths",
  "validationEvidencePaths",
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
  return [payload.evidenceLinks, payload.evidencePaths, payload.validationEvidencePaths, payload.plannedMissions, payload.resultingMissions, payload.missions, payload.childMissions].some(nonEmptyArrayField)
    || Object.keys(plainObject(payload.planConversion)).length > 0;
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
  const { selected, candidates } = chooseTask(root, index, args);
  if (!selected) {
    return {
      status: "needs-task-selection",
      choices: taskSelectionChoices(candidates),
      responseLanguage,
      message: doveText(responseLanguage, "missionPassSelectMessage")
    };
  }
  if (selected.level === 0) {
    throw new Error("The level-0 init task cannot receive a mission pass result. Convert a user demand into a non-init mission first.");
  }
  const taskBefore = loadFullTask(root, selected);
  const resultStatus = normalizeMissionPassStatus(args);
  const nextAction = normalizeString(args.nextAction, resultStatus === "completed" ? "project:dove.status" : taskBefore.nextAction ?? "project:dove.status");
  const artifactRefs = normalizeStringArray([...(Array.isArray(taskBefore.artifactRefs) ? taskBefore.artifactRefs : []), ...normalizeStringArray(args.artifactRefs ?? args.artifactPaths)]);
  const task = updateTaskLifecycle(root, taskBefore, resultStatus, { nextAction, artifactRefs });
  const timestamp = nowIso();
  const runId = normalizeTaskPacketId(args.runId ?? `mission-${task.id}-${Date.now().toString(36)}`);
  const evidenceLinks = normalizeStringArray(args.evidenceLinks ?? args.evidencePaths ?? args.validationEvidencePaths);
  const summary = normalizeString(args.resultSummary ?? args.summary, resultStatus === "completed" ? doveText(responseLanguage, "missionPassCompletedSummary") : resultStatus === "blocked" ? doveText(responseLanguage, "missionPassBlockedSummary") : doveText(responseLanguage, "missionPassProgressSummary"));
  const command = normalizeAutoCommandId(args.command ?? args.workflow ?? args.preset ?? args.nextCommand);
  const outcome = normalizeString(args.outcome, resultStatus === "completed" ? "task-completed" : resultStatus === "blocked" ? "mission-pass-blocked" : "single-pass-progress-recorded");
  const stopReason = normalizeString(args.stopReason, resultStatus === "blocked" ? "mission-pass-blocked" : null);
  const planConversion = taskBefore.stage === "plan" && resultStatus === "completed" && args.convertPlanToMissions !== false
    ? materializePlanResultMissions(root, taskBefore, args, runId)
    : null;
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
          nextAction,
          planConversion
        },
        startedAt: normalizeString(args.startedAt, timestamp),
        completedAt: normalizeString(args.completedAt, timestamp)
      }
    ],
    planConversion,
    createdPlanMissions: planConversion?.createdMissions ?? [],
    reusedPlanMissions: planConversion?.reusedMissions ?? [],
    taskStatusBefore: taskBefore.status,
    taskStatusAfter: task.status,
    responseLanguage,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  persistAutoResult(root, result);
  return {
    status: result.status,
    task,
    result,
    evidenceLinks,
    artifactRefs,
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
  const timestamp = nowIso();
  const catalog = readTaskPacketCatalog(root);
  const fullPacket = catalog.byId.get(selected.id) ?? selected;
  const packet = {
    ...fullPacket,
    status: "killed",
    lifecycleStatus: "killed",
    killedAt: timestamp,
    killReason: normalizeString(args.reason ?? args.killReason, doveText(responseLanguage, "killReason")),
    updatedAt: timestamp
  };
  writePacket(root, packet);
  const nextIndex = saveTaskIndex(root, upsertIndexItem(index, packet));
  const state = loadState(root);
  saveState(root, {
    ...state,
    orchestration: {
      ...state.orchestration,
      activeTaskIds: nextIndex.taskModel.activeTaskIds
    }
  });
  return {
    status: "killed",
    killedTask: packet,
    activeTaskIds: nextIndex.taskModel.activeTaskIds,
    responseLanguage
  };
}

function lifecycleFieldsForStatus(status, args = {}, timestamp = nowIso(), responseLanguage = "zh") {
  const fields = {};
  const nextAction = normalizeString(args.nextAction, null);
  if (nextAction) {
    fields.nextAction = nextAction;
  }
  const artifactRefs = normalizeStringArray(args.artifactRefs ?? args.artifactPaths);
  if (artifactRefs.length > 0) {
    fields.artifactRefs = artifactRefs;
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
  return fields;
}

function normalizeStatusAdjustment(item, index) {
  const source = plainObject(item);
  return {
    index: index + 1,
    packetId: normalizeString(source.packetId ?? source.taskPacketId ?? source.taskId ?? source.id, null),
    status: normalizeAllowed(source.status ?? source.taskStatus ?? source.missionStatus, DOVE_TASK_STATUSES, null),
    reason: normalizeString(source.reason ?? source.summary, ""),
    nextAction: normalizeString(source.nextAction, null),
    artifactRefs: normalizeStringArray(source.artifactRefs ?? source.artifactPaths)
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
    return {
      status: "no-op",
      applied: [],
      skipped: [],
      rejected: [],
      statusChoices: DOVE_TASK_STATUSES,
      activeTaskIds: loadTaskIndex(root).taskModel.activeTaskIds,
      responseLanguage,
      taskIndexPath: ARTIFACT_PATHS.taskPacketsIndex
    };
  }
  const catalog = readTaskPacketCatalog(root);
  const applied = [];
  const skipped = [];
  const rejected = [];
  for (const adjustment of adjustments) {
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
    if (packet.status === adjustment.status) {
      skipped.push({ packetId, status: adjustment.status, reason: doveText(responseLanguage, "statusAdjustSameReason") });
      continue;
    }
    const updated = updateTaskLifecycle(root, packet, adjustment.status, lifecycleFieldsForStatus(adjustment.status, adjustment, nowIso(), responseLanguage));
    catalog.byId.set(packetId, updated);
    applied.push({ packetId, fromStatus: packet.status, toStatus: updated.status, title: updated.title, level: updated.level });
  }
  return {
    status: rejected.length > 0 && applied.length > 0 ? "partially-applied" : rejected.length > 0 ? "rejected" : "applied",
    applied,
    skipped,
    rejected,
    statusChoices: DOVE_TASK_STATUSES,
    activeTaskIds: loadTaskIndex(root).taskModel.activeTaskIds,
    responseLanguage,
    taskIndexPath: ARTIFACT_PATHS.taskPacketsIndex
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

function applyOperatorHostResult(root, taskItem, taskResult, timestamp, responseLanguage = "zh") {
  const task = loadFullTask(root, taskItem);
  const taskStatus = normalizeMissionPassStatus(taskResult);
  const fields = lifecycleFieldsForStatus(taskStatus, taskResult, timestamp, responseLanguage);
  fields.artifactRefs = normalizeStringArray([...(Array.isArray(task.artifactRefs) ? task.artifactRefs : []), ...normalizeStringArray(taskResult.artifactRefs ?? taskResult.artifactPaths)]);
  const updatedTask = updateTaskLifecycle(root, task, taskStatus, fields);
  return {
    updatedTask,
    iteration: {
      packetId: task.id,
      title: task.title,
      status: taskStatus,
      outcome: normalizeString(taskResult.outcome, taskStatus === "completed" ? "operator-task-completed" : taskStatus === "blocked" ? "operator-task-blocked" : "operator-task-progress"),
      summary: normalizeString(taskResult.summary ?? taskResult.resultSummary, doveText(responseLanguage, "operatorResultSummary")),
      evidenceLinks: normalizeStringArray(taskResult.evidenceLinks ?? taskResult.evidencePaths),
      artifactRefs: fields.artifactRefs,
      startedAt: normalizeString(taskResult.startedAt, timestamp),
      completedAt: normalizeString(taskResult.completedAt, timestamp)
    }
  };
}

function runOperatorInternalStep(root, taskItem, timestamp, responseLanguage = "zh") {
  const task = loadFullTask(root, taskItem);
  const autoPlan = inferAutoStepsForTask(task, {});
  const step = autoPlan.steps[0] ?? null;
  if (!step) {
    return {
      awaitingTaskId: task.id,
      iteration: operatorAwaitingHostIteration(task, timestamp, responseLanguage)
    };
  }
  const startedAt = nowIso();
  let workingTask = task.status === "ready" ? updateTaskLifecycle(root, task, "in-progress") : task;
  try {
    const output = executeAutoStep(root, step.command, stepArgsForTask(workingTask, step.args));
    const classified = classifyAutoStepResult(step.command, output);
    const completedAt = nowIso();
    let updatedTask = workingTask;
    if (step.completeTask === true) {
      updatedTask = updateTaskLifecycle(root, workingTask, "completed", { nextAction: "project:dove.status" });
    } else if (classified.terminal) {
      updatedTask = updateTaskLifecycle(root, workingTask, "blocked", { nextAction: "project:dove.status" });
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
        proposedSteps: autoPlan.proposedSteps,
        startedAt,
        completedAt
      }
    };
  } catch (error) {
    const completedAt = nowIso();
    workingTask = updateTaskLifecycle(root, workingTask, "blocked", { nextAction: "project:dove.status" });
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
  if (blockedTasks.length === 0) {
    return { createdMissions: [], reusedMissions: [], missionCount: 0, taskIndexPath: ARTIFACT_PATHS.taskPacketsIndex };
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
      fallbackTitle: source.title,
      derivedFrom: "blocked-mission-investigation"
    });
    const result = materializeOneDerivedTask(root, nextIndex, packet, catalog);
    nextIndex = result.index;
    (result.created ? createdMissions : reusedMissions).push(result.packet);
  }
  if (createdMissions.length > 0) {
    persistDerivedTaskIndex(root, nextIndex, createdMissions.at(-1));
  }
  return {
    createdMissions: createdMissions.map(operatorTaskSummary),
    reusedMissions: reusedMissions.map(operatorTaskSummary),
    missionCount: createdMissions.length + reusedMissions.length,
    taskIndexPath: ARTIFACT_PATHS.taskPacketsIndex
  };
}

export function runDoveOperator(root, args = {}) {
  assertGovernanceMutationRegistered("run-dove-operator", "guarded");
  ensureWorkspace(root);
  const responseLanguage = resolveDoveResponseLanguage(root, args);
  const index = loadTaskIndex(root);
  const queue = operatorQueue(index);
  if (!hasExplicitConfirmation(args)) {
    return {
      status: "needs-confirmation",
      proposalOnly: true,
      noAutoApply: true,
      writes: [],
      confirmationRequired: true,
      executionMode: "operator-one-foreground-pass",
      foreground: true,
      background: false,
      daemon: false,
      autoRunnableTasks: queue.autoRunnable.map(operatorTaskSummary),
      hostPassRequiredTasks: queue.hostPassRequired.map(operatorTaskSummary),
      runnableTasks: queue.runnable.map(operatorTaskSummary),
      blockedTasks: queue.blocked.map(operatorTaskSummary),
      pendingTasks: queue.pending.map(operatorTaskSummary),
      confirmArgs: {
        ...args,
        confirmed: true
      },
      responseLanguage,
      message: doveText(responseLanguage, "operatorConfirmMessage")
    };
  }
  const timestamp = nowIso();
  const runId = normalizeTaskPacketId(args.runId ?? `operator-${Date.now().toString(36)}`);
  const resultMap = operatorResultMap(args);
  const iterations = [];
  const updatedTasks = [];
  const awaitingResults = [];
  for (const taskItem of queue.autoRunnable) {
    const stepResult = runOperatorInternalStep(root, taskItem, timestamp, responseLanguage);
    iterations.push(stepResult.iteration);
    if (stepResult.updatedTask) {
      updatedTasks.push(stepResult.updatedTask);
    }
    if (stepResult.awaitingTaskId) {
      awaitingResults.push(stepResult.awaitingTaskId);
    }
  }
  for (const taskItem of queue.hostPassRequired) {
    const task = loadFullTask(root, taskItem);
    const taskResult = resultMap.get(task.id);
    if (!taskResult) {
      awaitingResults.push(task.id);
      iterations.push(operatorAwaitingHostIteration(task, timestamp, responseLanguage));
      continue;
    }
    const hostResult = applyOperatorHostResult(root, task, taskResult, timestamp, responseLanguage);
    updatedTasks.push(hostResult.updatedTask);
    iterations.push(hostResult.iteration);
  }
  const blockerPlanConversion = materializeBlockedInvestigationMissions(root, queue.blocked, runId, responseLanguage);
  const result = {
    id: runId,
    surface: "dove.operator",
    status: awaitingResults.length > 0 ? "awaiting-host-results" : "completed",
    outcome: awaitingResults.length > 0 ? "operator-pass-results-required" : "operator-pass-recorded",
    foreground: true,
    background: false,
    daemon: false,
    maxIterations: 1,
    iterationCount: iterations.length,
    autoRunnableTaskIds: queue.autoRunnable.map((task) => task.id),
    hostPassRequiredTaskIds: queue.hostPassRequired.map((task) => task.id),
    runnableTaskIds: queue.runnable.map((task) => task.id),
    updatedTaskIds: updatedTasks.map((task) => task.id),
    awaitingResultTaskIds: awaitingResults,
    blockedTaskIds: queue.blocked.map((task) => task.id),
    pendingTaskIds: queue.pending.map((task) => task.id),
    blockerPlanConversion,
    iterations,
    stopReason: awaitingResults.length > 0 ? "host-pass-results-required" : null,
    responseLanguage,
    createdAt: timestamp,
    updatedAt: nowIso()
  };
  persistAutoResult(root, result);
  return {
    status: result.status,
    result,
    autoRunnableTasks: queue.autoRunnable.map(operatorTaskSummary),
    hostPassRequiredTasks: queue.hostPassRequired.map(operatorTaskSummary),
    updatedTasks: updatedTasks.map(operatorTaskSummary),
    awaitingResultTaskIds: awaitingResults,
    blockerPlanConversion,
    responseLanguage,
    nextAction: "project:dove.status"
  };
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
    return {
      command: normalizeAutoCommandId(source.command ?? source.workflow ?? source.preset ?? source.id),
      args: source.args && typeof source.args === "object" && !Array.isArray(source.args) ? source.args : source,
      completeTask: source.completeTask === true || source.complete === true
    };
  }).filter((step) => step.command);
}

function taskIntentText(task = {}, args = {}) {
  return [args.goal, args.objective, args.prompt, args.title, args.summary, args.intent, args.command, args.workflow, args.preset, args.nextCommand, task.title, task.summary, task.currentFocus, task.nextAction, task.stage, task.domain]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");
}

function summarizeAutoSteps(steps = []) {
  return steps.map((step, index) => ({
    index: index + 1,
    command: step.command,
    completeTask: step.completeTask === true
  }));
}

function inferAutoStepsForTask(task = {}, args = {}) {
  const explicitSteps = normalizeExplicitAutoSteps(args);
  if (explicitSteps.length > 0) {
    return {
      steps: explicitSteps,
      proposedSteps: summarizeAutoSteps(explicitSteps),
      safeToRun: true,
      requiresHostPass: false,
      whyThisStep: "explicit-auto-steps"
    };
  }
  const explicitCommand = normalizeAutoCommandId(args.command ?? args.workflow ?? args.preset ?? args.nextCommand ?? task.nextAction);
  if (explicitCommand) {
    const steps = [{ command: explicitCommand, args: stripAutoControlArgs(args), completeTask: args.completeTask === true || args.complete === true }];
    return {
      steps,
      proposedSteps: summarizeAutoSteps(steps),
      safeToRun: true,
      requiresHostPass: false,
      whyThisStep: `explicit-or-task-next-action:${explicitCommand}`
    };
  }
  const text = taskIntentText(task, args);
  const stepArgs = stripAutoControlArgs(args);
  const inferredCommand = /(review-loop|revision loop|审稿循环|评审循环)/u.test(text)
    ? "dove.review-loop"
    : /(review|audit|audio|审稿|审核|复审)/u.test(text)
      ? "dove.review"
      : /(figure|diagram|pipeline overview|图|示意图|流程图)/u.test(text)
        ? "dove.figure"
        : /(draft|revise|section|introduction|abstract|草稿|修改|章节|引言|摘要)/u.test(text)
          ? "dove.draft"
          : (task.domain === "experiment" || /(experiment|ablation|baseline|metric|result|evidence|实验|消融|指标|结果|证据)/u.test(text))
            ? "dove.experience"
            : /(source|citation|literature|paper search|reference|来源|引用|文献)/u.test(text)
              ? "dove.source"
              : null;
  if (inferredCommand) {
    const steps = [{ command: inferredCommand, args: stepArgs, completeTask: args.completeTask === true || args.complete === true }];
    return {
      steps,
      proposedSteps: summarizeAutoSteps(steps),
      safeToRun: true,
      requiresHostPass: false,
      whyThisStep: `inferred-safe-workflow:${inferredCommand}`
    };
  }
  return {
    steps: [],
    proposedSteps: [],
    safeToRun: false,
    requiresHostPass: true,
    whyThisStep: "requires-host-pass-or-explicit-workflow-step"
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
  if (output.providerReadiness?.status) {
    summary.providerReadiness = output.providerReadiness.status;
  }
  if (output.importArgs) {
    summary.importArgs = output.importArgs;
  }
  return summary;
}

function classifyAutoStepResult(command, output) {
  const status = typeof output?.status === "string" ? output.status : "completed";
  if (status === "prepared-awaiting-audio") {
    return { status: "blocked-boundary", outcome: "awaiting-review-output", stopReason: "awaiting-audio-review-output", terminal: true };
  }
  if (status === "prepared-awaiting-output") {
    return { status: "blocked-boundary", outcome: "awaiting-provider-output", stopReason: "awaiting-figure-provider-output", terminal: true };
  }
  if (status === "blocked-missing-materials") {
    return { status: "blocked-boundary", outcome: "missing-required-materials", stopReason: "missing-figure-materials", terminal: true };
  }
  if (status === "provider-failed") {
    return { status: "blocked-boundary", outcome: "provider-failed", stopReason: "figure-provider-failed", terminal: true };
  }
  if (status === "qa-needs-attention" || status === "blocked" || status.startsWith("blocked-")) {
    return { status: "blocked-boundary", outcome: status, stopReason: `${command}-${status}`, terminal: true };
  }
  return { status: "step-completed", outcome: `${command}-${status}`, stopReason: null, terminal: false };
}

function loadFullTask(root, task) {
  const catalog = readTaskPacketCatalog(root);
  return catalog.byId.get(task.id) ?? task;
}

function updateTaskLifecycle(root, task, status, fields = {}) {
  const timestamp = nowIso();
  const packet = {
    ...loadFullTask(root, task),
    ...fields,
    status,
    lifecycleStatus: status,
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
  return packet;
}

function persistAutoResult(root, result) {
  const runtimeResults = readJson(root, ARTIFACT_PATHS.runtimeResults, { version: 1, items: [], updatedAt: null });
  writeJson(root, ARTIFACT_PATHS.runtimeResults, {
    ...runtimeResults,
    items: [...(Array.isArray(runtimeResults.items) ? runtimeResults.items.filter((item) => item.id !== result.id) : []), result],
    updatedAt: result.updatedAt
  });
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

  if (task.status === "killed") {
    result.status = "stopped-killed";
    result.outcome = "task-already-killed";
    result.stopReason = "task-killed";
    persistAutoResult(root, result);
    return { status: result.status, task, result, applicableLessons: activeLessons(root, task.id), responseLanguage, nextAction: task.nextAction };
  }
  if (task.status === "completed") {
    result.status = "completed";
    result.outcome = "task-already-completed";
    result.stopReason = "task-completed";
    persistAutoResult(root, result);
    return { status: result.status, task, result, applicableLessons: activeLessons(root, task.id), responseLanguage, nextAction: task.nextAction };
  }
  if (task.status === "blocked") {
    result.status = "blocked";
    result.outcome = "task-already-blocked";
    result.stopReason = "task-blocked";
    persistAutoResult(root, result);
    return { status: result.status, task, result, applicableLessons: activeLessons(root, task.id), responseLanguage, nextAction: task.nextAction };
  }

  const autoPlan = inferAutoStepsForTask(task, args);
  const steps = autoPlan.steps;
  result.proposedSteps = autoPlan.proposedSteps;
  result.safeToRun = autoPlan.safeToRun;
  result.requiresHostPass = autoPlan.requiresHostPass;
  result.whyThisStep = autoPlan.whyThisStep;
  if (steps.length === 0) {
    const completedAt = nowIso();
    result.iterations.push({
      iteration: 1,
      command: null,
      status: "awaiting-host-pass",
      outcome: "host-pass-required",
      stopReason: "requires-host-pass-or-explicit-workflow-step",
      startedAt: timestamp,
      completedAt
    });
    result.status = "awaiting-host-pass";
    result.outcome = "host-pass-required";
    result.stopReason = "requires-host-pass-or-explicit-workflow-step";
    result.iterationCount = result.iterations.length;
    result.taskStatusAfter = task.status;
    result.updatedAt = completedAt;
    persistAutoResult(root, result);
    return {
      status: result.status,
      task,
      result,
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

  task = updateTaskLifecycle(root, task, "in-progress");
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
        stopReason: "requires-host-pass-or-explicit-workflow-step",
        startedAt,
        completedAt
      });
      result.status = "awaiting-host-pass";
      result.outcome = "host-pass-required";
      result.stopReason = doveText(responseLanguage, "autoNoStepStopReason");
      finalTaskStatus = task.status;
      break;
    }

    try {
      const output = executeAutoStep(root, step.command, stepArgsForTask(task, step.args));
      const classified = classifyAutoStepResult(step.command, output);
      const completedAt = nowIso();
      result.iterations.push({
        iteration: iterationNumber,
        command: step.command,
        status: classified.status,
        outcome: classified.outcome,
        stopReason: classified.stopReason,
        output: summarizeStepOutput(output),
        startedAt,
        completedAt
      });
      if (step.completeTask === true || args.completeTask === true || args.complete === true || args.completeOnSuccess === true) {
        task = updateTaskLifecycle(root, task, "completed", { nextAction: "project:dove.status" });
        result.status = "completed";
        result.outcome = "task-completed";
        result.stopReason = "completion-confirmed-by-auto-step";
        finalTaskStatus = "completed";
        break;
      }
      if (classified.terminal) {
        result.status = classified.status;
        result.outcome = classified.outcome;
        result.stopReason = classified.stopReason;
        finalTaskStatus = "blocked";
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
      finalTaskStatus = "blocked";
      break;
    }
  }

  if (finalTaskStatus === "blocked" && task.status !== "blocked") {
    task = updateTaskLifecycle(root, task, "blocked", { nextAction: "project:dove.status" });
  }
  result.iterationCount = result.iterations.length;
  result.taskStatusAfter = finalTaskStatus;
  result.updatedAt = nowIso();
  persistAutoResult(root, result);
  return {
    status: result.status,
    task,
    result,
    applicableLessons: activeLessons(root, task.id),
    responseLanguage,
    nextAction: task.nextAction
  };
}
