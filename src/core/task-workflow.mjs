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
import { normalizeTaskPacketId, readTaskPacketCatalog } from "./task-packets.mjs";

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
  writeJson(root, taskPacketPath(packet.id), packet);
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
  const timestamp = nowIso();
  const creatorKind = normalizeAllowed(args.creatorKind, DOVE_TASK_CREATOR_KINDS, "user");
  const dependencies = normalizeStringArray(args.dependencies ?? args.dependencyIds);
  const blockedBy = normalizeStringArray(args.blockedBy ?? args.blockerIds);
  const requestedTitle = normalizeString(args.title ?? args.goal ?? args.objective ?? args.prompt, "Dove task");
  const id = normalizeTaskPacketId(args.id ?? args.packetId ?? `task-${slugify(requestedTitle)}-${Date.now().toString(36)}`);
  const level = overrides.level ?? (creatorKind === "system" ? (dependencies.length > 0 ? 2 : 1) : state.settings.taskModel.userDefaultLevel);
  const status = normalizeStatus(args.status, dependencies.length > 0 || blockedBy.length > 0 ? "blocked" : "ready");
  return {
    id,
    title: requestedTitle,
    summary: normalizeString(args.summary ?? args.goal ?? args.objective ?? args.prompt, requestedTitle),
    parentId: init.id,
    rootId: init.rootId ?? init.id,
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
    currentFocus: normalizeString(args.currentFocus ?? args.goal ?? args.objective ?? args.prompt, requestedTitle),
    nextAction: normalizeString(args.nextAction, nextCommandFor(classification)),
    evidenceExpectations: normalizeStringArray(args.evidenceExpectations)
  };
}

export function initDoveGoal(root, args = {}) {
  assertGovernanceMutationRegistered("init-dove-goal", "guarded");
  ensureWorkspace(root);
  const timestamp = nowIso();
  const state = loadState(root);
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
      nextAction: "Run project:dove.mission to create the next task under the init goal."
    }
  });
  return {
    status: existing ? "updated" : "created",
    initId: packet.id,
    init: packet,
    nextAction: "project:dove.mission",
    taskIndexPath: ARTIFACT_PATHS.taskPacketsIndex
  };
}

export function createDoveTask(root, args = {}) {
  assertGovernanceMutationRegistered("create-dove-task", "guarded");
  ensureWorkspace(root);
  const index = loadTaskIndex(root);
  const init = initPacket(index);
  if (!init) {
    throw new Error("/dove:mission requires a level-0 init goal. Run /dove:init first.");
  }
  const classification = classifyTask(args);
  const packet = buildPacket(root, args, init, classification);
  writePacket(root, packet);
  const nextIndex = saveTaskIndex(root, upsertIndexItem(index, packet));
  const state = loadState(root);
  saveState(root, {
    ...state,
    orchestration: {
      ...state.orchestration,
      activeTaskIds: nextIndex.taskModel.activeTaskIds,
      currentFocus: packet.currentFocus,
      nextAction: packet.nextAction
    }
  });
  return {
    status: "created",
    createdTask: packet,
    classification,
    blockers: [...packet.dependencies, ...packet.blockedBy],
    evidenceExpectations: packet.evidenceExpectations,
    recommendedNextCommand: packet.nextAction,
    applicableLessons: activeLessons(root, packet.id),
    taskIndexPath: ARTIFACT_PATHS.taskPacketsIndex
  };
}

function candidateTasks(index) {
  return (index.items ?? []).filter((item) => item.level !== 0 && activeStatus(item.status));
}

function chooseTask(index, args = {}) {
  const candidates = candidateTasks(index);
  const explicitId = normalizeString(args.packetId ?? args.taskPacketId ?? args.taskId ?? args.id, null);
  if (explicitId) {
    const normalized = normalizeTaskPacketId(explicitId);
    const match = (index.items ?? []).find((item) => item.id === normalized);
    return { selected: match ?? null, candidates };
  }
  if (Number.isFinite(args.index)) {
    return { selected: candidates[Math.max(0, Math.floor(args.index) - 1)] ?? null, candidates };
  }
  const target = normalizeString(args.target ?? args.taskName ?? args.title, null);
  if (target) {
    const normalizedTarget = slugify(target);
    const matches = candidates.filter((item) => item.id === normalizedTarget || slugify(item.title).includes(normalizedTarget) || String(item.title ?? "").toLowerCase().includes(target.toLowerCase()));
    return { selected: matches.length === 1 ? matches[0] : null, candidates: matches.length > 0 ? matches : candidates };
  }
  return { selected: candidates.length === 1 ? candidates[0] : null, candidates };
}

export function killDoveTask(root, args = {}) {
  assertGovernanceMutationRegistered("kill-dove-task", "guarded");
  ensureWorkspace(root);
  const index = loadTaskIndex(root);
  const { selected, candidates } = chooseTask(index, args);
  if (!selected) {
    return {
      status: "needs-task-selection",
      choices: candidates.map((task, itemIndex) => ({ index: itemIndex + 1, id: task.id, title: task.title, status: task.status, level: task.level })),
      message: "Select a non-init task by index or packetId before killing it."
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
    killReason: normalizeString(args.reason ?? args.killReason, "Operator killed this task."),
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
    activeTaskIds: nextIndex.taskModel.activeTaskIds
  };
}

export function resetDoveVersion(root, args = {}) {
  assertGovernanceMutationRegistered("reset-dove-version", "guarded");
  ensureWorkspace(root);
  const timestamp = nowIso();
  const index = loadTaskIndex(root);
  const init = initPacket(index);
  if (!init) {
    throw new Error("/dove:version requires an init task to preserve. Run /dove:init first.");
  }
  const versionId = normalizeTaskPacketId(args.versionId ?? args.id ?? `version-${slugify(args.reason ?? args.title ?? timestamp)}`);
  const snapshotPath = path.join(ARTIFACT_PATHS.versionSnapshotsDir, `${versionId}-task-index.json`);
  writeJson(root, snapshotPath, { versionId, createdAt: timestamp, reason: normalizeString(args.reason ?? args.summary, "Direction changed."), taskIndex: index });
  const resetIndex = saveTaskIndex(root, {
    ...index,
    items: [init],
    updatedAt: timestamp
  });
  const versions = readJson(root, ARTIFACT_PATHS.versionsIndex, { version: 1, items: [], updatedAt: null });
  const item = {
    id: versionId,
    title: normalizeString(args.title, "Dove direction reset"),
    reason: normalizeString(args.reason ?? args.summary, "Direction changed."),
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
      nextAction: "Run project:dove.mission for the next direction."
    }
  });
  return {
    status: "reset",
    version: item,
    init,
    activeTaskIds: resetIndex.taskModel.activeTaskIds,
    nextAction: "project:dove.mission"
  };
}

export function runDoveAuto(root, args = {}) {
  assertGovernanceMutationRegistered("run-dove-auto", "guarded");
  ensureWorkspace(root);
  if (args.confirmed !== true && args.confirm !== true) {
    const classification = classifyTask(args);
    return {
      status: "needs-confirmation",
      classification,
      proposedNextCommand: nextCommandFor(classification),
      confirmationRequired: true,
      message: "Confirm before /dove:auto creates/selects a task and executes bounded automatic steps."
    };
  }
  const index = loadTaskIndex(root);
  const selected = chooseTask(index, args).selected;
  const task = selected ? selected : createDoveTask(root, args).createdTask;
  if (task.status === "killed") {
    return { status: "stopped-killed", task };
  }
  const timestamp = nowIso();
  const resultId = normalizeTaskPacketId(args.runId ?? `auto-${task.id}-${Date.now().toString(36)}`);
  const runtimeResults = readJson(root, ARTIFACT_PATHS.runtimeResults, { version: 1, items: [], updatedAt: null });
  const result = {
    id: resultId,
    packetId: task.id,
    status: "blocked-boundary",
    outcome: "awaiting-concrete-workflow",
    allowedInternalCommands: ["dove.source", "dove.note", "dove.experience", "dove.figure", "dove.draft", "dove.review", "dove.review-loop", "dove.rebuttal", "dove.lessons", "dove.status"],
    stopReason: "No concrete safe workflow step was supplied for this auto run.",
    createdAt: timestamp
  };
  writeJson(root, ARTIFACT_PATHS.runtimeResults, {
    ...runtimeResults,
    items: [...(Array.isArray(runtimeResults.items) ? runtimeResults.items.filter((item) => item.id !== resultId) : []), result],
    updatedAt: timestamp
  });
  return {
    status: result.status,
    task,
    result,
    applicableLessons: activeLessons(root, task.id),
    nextAction: task.nextAction
  };
}
