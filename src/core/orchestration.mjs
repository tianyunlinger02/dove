import path from "node:path";
import crypto from "node:crypto";

import { ARTIFACT_PATHS, ROLE_IDS, createDefaultBoard } from "./schema.mjs";
import { loadState, nowIso, readJson, readText, resolvePath, saveState, writeJson, writeText } from "./workspace.mjs";

const ALLOWED_TRANSITIONS = {
  init: ["init", "sources", "research"],
  sources: ["sources", "notes", "research"],
  notes: ["notes", "research", "plan"],
  research: ["research", "plan", "experiments", "review"],
  plan: ["plan", "outline", "research"],
  outline: ["outline", "draft", "research"],
  draft: ["draft", "experiments", "citations", "review"],
  experiments: ["experiments", "draft", "review"],
  citations: ["citations", "review", "draft"],
  review: ["review", "rebuttal", "plan", "research", "draft"],
  rebuttal: ["rebuttal", "versions", "draft"],
  versions: ["versions", "review", "checklist"],
  checklist: ["checklist", "research", "plan", "draft"]
};

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)))
    : [];
}

function normalizeTask(task = {}, index = 0) {
  return {
    id: slugify(task.id ?? task.title ?? `task-${index + 1}`),
    title: task.title ?? `Task ${index + 1}`,
    status: task.status ?? "pending",
    assignedRole: ROLE_IDS.includes(task.assignedRole) ? task.assignedRole : "planner",
    evidenceLinks: normalizeStringArray(task.evidenceLinks),
    experimentIds: normalizeStringArray(task.experimentIds),
    rebuttalIssueIds: normalizeStringArray(task.rebuttalIssueIds),
    blockedBy: normalizeStringArray(task.blockedBy),
    notes: task.notes ?? ""
  };
}

function normalizeBlocker(blocker = {}, index = 0) {
  return {
    id: slugify(blocker.id ?? blocker.summary ?? `blocker-${index + 1}`),
    summary: blocker.summary ?? `Blocker ${index + 1}`,
    status: blocker.status ?? "open",
    assignedRole: ROLE_IDS.includes(blocker.assignedRole) ? blocker.assignedRole : "planner",
    evidenceLinks: normalizeStringArray(blocker.evidenceLinks),
    experimentIds: normalizeStringArray(blocker.experimentIds),
    rebuttalIssueIds: normalizeStringArray(blocker.rebuttalIssueIds)
  };
}

function transitionAllowed(fromPhase, toPhase) {
  const allowed = ALLOWED_TRANSITIONS[fromPhase] ?? [fromPhase];
  return allowed.includes(toPhase);
}

function assertLegalTransition(currentPhase, nextPhase, strictMode) {
  if (!strictMode) {
    return;
  }
  if (!currentPhase || !nextPhase) {
    return;
  }
  if (!transitionAllowed(currentPhase, nextPhase)) {
    throw new Error(`Illegal orchestration phase transition: ${currentPhase} -> ${nextPhase}`);
  }
}

function hashText(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function collectDraftSnapshot(root, sections) {
  return Object.fromEntries(
    Object.entries(sections).map(([sectionId, section]) => {
      const relativePath = section.draftPath ?? `${ARTIFACT_PATHS.draftsDir}/${sectionId}.md`;
      const content = readText(root, relativePath, "");
      return [sectionId, {
        draftPath: relativePath,
        contentHash: content ? hashText(content) : null,
        citedKeys: Array.from(new Set(content.match(/\[cite:[^\]]+\]/g)?.map((item) => item.slice(6, -1).trim()) ?? []))
      }];
    })
  );
}

function setTaskStatus(tasks, taskId, status, notes = "") {
  return tasks.map((task) => task.id === taskId ? { ...task, status, notes: notes || task.notes } : task);
}

function ensureTask(tasks, task) {
  const normalized = normalizeTask(task);
  const existingIndex = tasks.findIndex((item) => item.id === normalized.id);
  if (existingIndex >= 0) {
    const next = [...tasks];
    next[existingIndex] = { ...next[existingIndex], ...normalized };
    return next;
  }
  return [...tasks, normalized];
}

function ensureBlocker(blockers, blocker) {
  const normalized = normalizeBlocker(blocker);
  const existingIndex = blockers.findIndex((item) => item.id === normalized.id);
  if (existingIndex >= 0) {
    const next = [...blockers];
    next[existingIndex] = { ...next[existingIndex], ...normalized };
    return next;
  }
  return [...blockers, normalized];
}

function renderHandoffEntry({ timestamp, fromRole, toRole, phase, summary, nextActions, evidenceLinks, blockerIds }) {
  return [
    `\n## ${timestamp} — ${fromRole} -> ${toRole}`,
    "",
    `- Phase: ${phase}`,
    `- Summary: ${summary}`,
    "- Next actions:",
    ...(nextActions.length > 0 ? nextActions.map((item) => `  - ${item}`) : ["  - None recorded"]),
    `- Evidence links: ${evidenceLinks.join(", ") || "none"}`,
    `- Blockers: ${blockerIds.join(", ") || "none"}`,
    ""
  ].join("\n");
}

function appendHandoffEntry(root, payload) {
  const existing = readText(root, ARTIFACT_PATHS.orchestrationHandoffs, "");
  writeText(root, ARTIFACT_PATHS.orchestrationHandoffs, `${existing}${renderHandoffEntry(payload)}`.replace(/^\n+/, ""));
}

export function loadBoard(root) {
  return readJson(root, ARTIFACT_PATHS.orchestrationBoard, () => createDefaultBoard(loadState(root)));
}

function syncStateWithBoard(root, board, state = loadState(root)) {
  const nextState = {
    ...state,
    pipeline: {
      ...state.pipeline,
      currentStage: board.currentPhase,
      lastCompletedStage: board.currentPhase,
      updatedAt: board.updatedAt ?? nowIso()
    },
    orchestration: {
      ...state.orchestration,
      phase: board.currentPhase,
      assignedRole: board.assignedRole,
      activeTaskIds: board.tasks.filter((task) => task.status !== "done" && task.status !== "cancelled").map((task) => task.id),
      blockerIds: board.blockers.filter((blocker) => blocker.status !== "resolved").map((blocker) => blocker.id),
      evidenceLinks: normalizeStringArray(board.evidenceLinks),
      experimentIds: normalizeStringArray(board.experimentIds),
      rebuttalIssueIds: normalizeStringArray(board.rebuttalIssueIds),
      currentVersionId: board.versionLineage?.currentVersionId ?? null,
      activeComparisonTargets: normalizeStringArray(board.activeComparisonTargets)
    }
  };
  saveState(root, nextState);
  return nextState;
}

export function saveBoard(root, board) {
  const normalized = {
    ...createDefaultBoard(loadState(root)),
    ...board,
    assignedRole: ROLE_IDS.includes(board.assignedRole) ? board.assignedRole : "planner",
    tasks: Array.isArray(board.tasks) ? board.tasks.map(normalizeTask) : [],
    blockers: Array.isArray(board.blockers) ? board.blockers.map(normalizeBlocker) : [],
    evidenceLinks: normalizeStringArray(board.evidenceLinks),
    experimentIds: normalizeStringArray(board.experimentIds),
    rebuttalIssueIds: normalizeStringArray(board.rebuttalIssueIds),
    activeComparisonTargets: normalizeStringArray(board.activeComparisonTargets),
    versionLineage: {
      currentVersionId: board.versionLineage?.currentVersionId ?? null,
      parentVersionId: board.versionLineage?.parentVersionId ?? null,
      snapshotIds: normalizeStringArray(board.versionLineage?.snapshotIds)
    },
    updatedAt: nowIso()
  };
  writeJson(root, ARTIFACT_PATHS.orchestrationBoard, normalized);
  syncStateWithBoard(root, normalized);
  return normalized;
}

function phaseResumeCommand(phase) {
  switch (phase) {
    case "sources":
      return "project:paper.research";
    case "notes":
    case "research":
      return "project:paper.claim-gate";
    case "plan":
      return "project:paper.outline";
    case "outline":
      return "project:paper.draft";
    case "draft":
    case "experiments":
      return "project:paper.review-loop";
    case "review":
      return "project:paper.rebuttal-strategy";
    case "rebuttal":
      return "project:paper.version-snapshot";
    case "versions":
      return "project:paper.version-compare";
    default:
      return "project:paper.orchestrate";
  }
}

export function upsertOrchestrationBoard(root, args = {}) {
  const state = loadState(root);
  const current = loadBoard(root);
  const nextPhase = args.phase ?? current.currentPhase;
  assertLegalTransition(current.currentPhase, nextPhase, state.settings?.strictMode);
  const nextAssignedRole = args.assignedRole ?? current.assignedRole;
  if (nextAssignedRole !== current.assignedRole && !args.skipAutoHandoff) {
    appendHandoffEntry(root, {
      timestamp: args.timestamp ?? nowIso(),
      fromRole: current.assignedRole,
      toRole: nextAssignedRole,
      phase: nextPhase,
      summary: args.handoffSummary ?? `Role ownership moved from ${current.assignedRole} to ${nextAssignedRole}.`,
      nextActions: normalizeStringArray(args.nextActions),
      evidenceLinks: normalizeStringArray(args.evidenceLinks ?? current.evidenceLinks),
      blockerIds: normalizeStringArray((args.blockers ?? current.blockers).filter?.((item) => item.status !== "resolved").map?.((item) => item.id) ?? [])
    });
  }
  const next = saveBoard(root, {
    ...current,
    paperObjective: args.paperObjective ?? args.objective ?? current.paperObjective ?? state.paper.objective,
    currentPhase: nextPhase,
    assignedRole: nextAssignedRole,
    tasks: Array.isArray(args.tasks)
      ? args.tasks.map(normalizeTask)
      : current.tasks,
    blockers: Array.isArray(args.blockers)
      ? args.blockers.map(normalizeBlocker)
      : current.blockers,
    evidenceLinks: args.evidenceLinks ? normalizeStringArray(args.evidenceLinks) : current.evidenceLinks,
    experimentIds: args.experimentIds ? normalizeStringArray(args.experimentIds) : current.experimentIds,
    rebuttalIssueIds: args.rebuttalIssueIds ? normalizeStringArray(args.rebuttalIssueIds) : current.rebuttalIssueIds,
    activeComparisonTargets: args.activeComparisonTargets ? normalizeStringArray(args.activeComparisonTargets) : current.activeComparisonTargets,
    versionLineage: {
      currentVersionId: args.versionLineage?.currentVersionId ?? current.versionLineage?.currentVersionId ?? null,
      parentVersionId: args.versionLineage?.parentVersionId ?? current.versionLineage?.parentVersionId ?? null,
      snapshotIds: args.versionLineage?.snapshotIds ? normalizeStringArray(args.versionLineage.snapshotIds) : (current.versionLineage?.snapshotIds ?? [])
    }
  });
  syncStateWithBoard(root, next, {
    ...state,
    paper: {
      ...state.paper,
      objective: next.paperObjective
    },
    pipeline: {
      ...state.pipeline,
      resumeCommand: phaseResumeCommand(next.currentPhase)
    }
  });
  return next;
}

export function appendHandoff(root, args = {}) {
  const board = loadBoard(root);
  const state = loadState(root);
  const timestamp = args.timestamp ?? nowIso();
  const fromRole = args.fromRole ?? board.assignedRole;
  const toRole = args.toRole ?? board.assignedRole;
  assertLegalTransition(board.currentPhase, args.phase ?? board.currentPhase, state.settings?.strictMode);
  appendHandoffEntry(root, {
    timestamp,
    fromRole,
    toRole,
    phase: args.phase ?? board.currentPhase,
    summary: args.summary ?? "No summary provided.",
    nextActions: Array.isArray(args.nextActions) ? args.nextActions : [],
    evidenceLinks: normalizeStringArray(args.evidenceLinks ?? board.evidenceLinks),
    blockerIds: normalizeStringArray(args.blockerIds ?? board.blockers.filter((item) => item.status !== "resolved").map((item) => item.id))
  });

  return upsertOrchestrationBoard(root, {
    phase: args.phase ?? board.currentPhase,
    assignedRole: toRole,
    evidenceLinks: args.evidenceLinks ?? board.evidenceLinks,
    tasks: board.tasks,
    blockers: board.blockers,
    skipAutoHandoff: true
  });
}

function renderResearchBrief(agenda) {
  return [
    "# Research brief",
    "",
    `## Objective\n\n${agenda.objective}`,
    "",
    "## Agenda",
    "",
    ...(agenda.agenda.length > 0 ? agenda.agenda.map((item) => `- ${item}`) : ["- No research agenda recorded."]),
    "",
    "## Evidence backlog",
    "",
    ...(agenda.evidenceBacklog.length > 0 ? agenda.evidenceBacklog.map((item) => `- ${item}`) : ["- No evidence backlog recorded."])
  ].join("\n");
}

export function updateResearchBrief(root, args = {}) {
  const state = loadState(root);
  const current = readJson(root, ARTIFACT_PATHS.researchAgenda, { version: 1, objective: state.paper.objective, agenda: [], evidenceBacklog: [], updatedAt: null });
  const next = {
    version: 1,
    objective: args.objective ?? current.objective ?? state.paper.objective,
    agenda: args.agenda ? normalizeStringArray(args.agenda) : current.agenda,
    evidenceBacklog: args.evidenceBacklog ? normalizeStringArray(args.evidenceBacklog) : current.evidenceBacklog,
    updatedAt: nowIso()
  };
  writeJson(root, ARTIFACT_PATHS.researchAgenda, next);
  writeText(root, ARTIFACT_PATHS.researchBrief, renderResearchBrief(next));
  upsertOrchestrationBoard(root, {
    objective: next.objective,
    phase: args.phase ?? "research",
    assignedRole: args.assignedRole ?? "researcher"
  });
  return next;
}

function normalizeExperimentPlan(plan = {}, index = 0) {
  return {
    id: slugify(plan.id ?? plan.title ?? `experiment-${index + 1}`),
    title: plan.title ?? `Experiment ${index + 1}`,
    claimId: plan.claimId ?? "",
    hypothesis: plan.hypothesis ?? "",
    methodology: plan.methodology ?? "",
    successMetric: plan.successMetric ?? "",
    comparisonTargets: normalizeStringArray(plan.comparisonTargets),
    status: plan.status ?? "planned",
    owner: ROLE_IDS.includes(plan.owner) ? plan.owner : "experiment-planner",
    updatedAt: nowIso()
  };
}

function renderExperimentLog(plans, results) {
  return [
    "# Experiment log",
    "",
    "## Planned experiments",
    "",
    ...(plans.length > 0 ? plans.flatMap((plan) => [
      `### ${plan.id} — ${plan.title}`,
      "",
      `- Claim ID: ${plan.claimId || "none"}`,
      `- Hypothesis: ${plan.hypothesis || "TBD"}`,
      `- Methodology: ${plan.methodology || "TBD"}`,
      `- Success metric: ${plan.successMetric || "TBD"}`,
      `- Comparison targets: ${plan.comparisonTargets.join(", ") || "none"}`,
      `- Status: ${plan.status}`,
      ""
    ]) : ["No experiment plans recorded.", ""]),
    "## Recorded results",
    "",
    ...(results.length > 0 ? results.flatMap((result) => [
      `### ${result.id}`,
      "",
      `- Experiment ID: ${result.experimentId}`,
      `- Claim ID: ${result.claimId || "none"}`,
      `- Outcome: ${result.outcome}`,
      `- Summary: ${result.summary || "No summary provided."}`,
      `- Evidence links: ${result.evidenceLinks.join(", ") || "none"}`,
      ""
    ]) : ["No experiment results recorded."])
  ].join("\n");
}

export function upsertExperimentPlan(root, args = {}) {
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 2, claims: [], updatedAt: null });
  const plansIndex = readJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null });
  const rawPlan = args.plan ?? args;
  const plan = normalizeExperimentPlan(rawPlan, plansIndex.items.length);
  const existingIndex = plansIndex.items.findIndex((item) => item.id === plan.id);
  const existingPlan = existingIndex >= 0 ? plansIndex.items[existingIndex] : null;
  const nextPlan = {
    ...(existingPlan ?? {}),
    ...plan,
    claimId: Object.hasOwn(rawPlan, "claimId") ? plan.claimId : (existingPlan?.claimId ?? plan.claimId),
    updatedAt: nowIso()
  };
  if (nextPlan.claimId && !evidence.claims.some((claim) => claim.id === nextPlan.claimId)) {
    throw new Error(`Experiment plan ${nextPlan.id} references unknown claim ${nextPlan.claimId}`);
  }
  if (existingIndex >= 0) {
    plansIndex.items[existingIndex] = nextPlan;
  } else {
    plansIndex.items.push(nextPlan);
  }
  plansIndex.updatedAt = nowIso();
  writeJson(root, ARTIFACT_PATHS.experimentPlans, plansIndex);

  const resultsIndex = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  writeText(root, ARTIFACT_PATHS.experimentLog, renderExperimentLog(plansIndex.items, resultsIndex.items));
  const board = loadBoard(root);
  upsertOrchestrationBoard(root, {
    phase: "experiments",
    assignedRole: "experiment-planner",
    experimentIds: Array.from(new Set([...board.experimentIds, nextPlan.id])),
    activeComparisonTargets: Array.from(new Set([...board.activeComparisonTargets, ...nextPlan.comparisonTargets]))
  });
  return nextPlan;
}

function normalizeExperimentResult(result = {}, index = 0) {
  return {
    id: slugify(result.id ?? `${result.experimentId ?? "experiment"}-result-${index + 1}`),
    experimentId: result.experimentId ?? "",
    claimId: result.claimId ?? "",
    outcome: result.outcome ?? "pending",
    summary: result.summary ?? "",
    evidenceLinks: normalizeStringArray(result.evidenceLinks),
    comparisonTargets: normalizeStringArray(result.comparisonTargets),
    updatedAt: nowIso()
  };
}

export function upsertExperimentResult(root, args = {}) {
  const plansIndex = readJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null });
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 2, claims: [], updatedAt: null });
  const resultsIndex = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  const result = normalizeExperimentResult(args.result ?? args, resultsIndex.items.length);
  const allowedOutcomes = new Set(["supports", "refutes", "inconclusive", "failed", "pending"]);
  if (!allowedOutcomes.has(result.outcome)) {
    throw new Error(`Experiment result ${result.id} has invalid outcome ${result.outcome}`);
  }
  const linkedPlan = plansIndex.items.find((item) => item.id === result.experimentId);
  if (!linkedPlan) {
    throw new Error(`Experiment result ${result.id} references unknown experiment ${result.experimentId}`);
  }
  if (linkedPlan.claimId && !result.claimId) {
    throw new Error(`Experiment result ${result.id} must include claimId ${linkedPlan.claimId} from its plan`);
  }
  if (result.claimId && !evidence.claims.some((claim) => claim.id === result.claimId)) {
    throw new Error(`Experiment result ${result.id} references unknown claim ${result.claimId}`);
  }
  if (linkedPlan.claimId && result.claimId && linkedPlan.claimId !== result.claimId) {
    throw new Error(`Experiment result ${result.id} claim ${result.claimId} does not match plan claim ${linkedPlan.claimId}`);
  }
  const existingIndex = resultsIndex.items.findIndex((item) => item.id === result.id);
  if (existingIndex >= 0) {
    resultsIndex.items[existingIndex] = { ...resultsIndex.items[existingIndex], ...result, updatedAt: nowIso() };
  } else {
    resultsIndex.items.push(result);
  }
  resultsIndex.updatedAt = nowIso();
  writeJson(root, ARTIFACT_PATHS.experimentResults, resultsIndex);

  writeText(root, ARTIFACT_PATHS.experimentLog, renderExperimentLog(plansIndex.items, resultsIndex.items));
  const board = loadBoard(root);
  const blockers = (result.outcome === "failed" || result.outcome === "refutes")
    ? ensureBlocker(board.blockers, {
        id: `${result.experimentId}-needs-followup`,
        summary: `Experiment ${result.experimentId} returned ${result.outcome}; revisit linked claim and draft language.`,
        status: "open",
        assignedRole: "reviewer",
        evidenceLinks: result.evidenceLinks,
        experimentIds: [result.experimentId]
      })
    : board.blockers;
  upsertOrchestrationBoard(root, {
    phase: "experiments",
    assignedRole: "experiment-planner",
    blockers,
    evidenceLinks: Array.from(new Set([...board.evidenceLinks, ...result.evidenceLinks])),
    activeComparisonTargets: Array.from(new Set([...board.activeComparisonTargets, ...result.comparisonTargets]))
  });
  return result;
}

function normalizeIssue(issue = {}, index = 0) {
  return {
    id: slugify(issue.id ?? issue.summary ?? `issue-${index + 1}`),
    reviewer: issue.reviewer ?? `reviewer-${index + 1}`,
    summary: issue.summary ?? `Issue ${index + 1}`,
    severity: issue.severity ?? "medium",
    status: issue.status ?? "open",
    evidenceLinks: normalizeStringArray(issue.evidenceLinks),
    claimIds: normalizeStringArray(issue.claimIds),
    experimentIds: normalizeStringArray(issue.experimentIds),
    responseDirection: issue.responseDirection ?? "clarify",
    updatedAt: nowIso()
  };
}

export function normalizeRebuttalIssues(root, args = {}) {
  const issuesIndex = readJson(root, ARTIFACT_PATHS.rebuttalIssues, { version: 1, items: [], updatedAt: null });
  const provided = Array.isArray(args.issues) ? args.issues.map(normalizeIssue) : [];
  const merged = new Map((issuesIndex.items ?? []).map((issue, index) => {
    const normalized = normalizeIssue(issue, index);
    return [normalized.id, normalized];
  }));
  for (const issue of provided) {
    merged.set(issue.id, issue);
  }
  const items = Array.from(merged.values()).sort((left, right) => left.id.localeCompare(right.id));
  const next = { version: 1, items, updatedAt: nowIso() };
  writeJson(root, ARTIFACT_PATHS.rebuttalIssues, next);
  upsertOrchestrationBoard(root, {
    phase: "rebuttal",
    assignedRole: "rebuttal-lead",
    rebuttalIssueIds: items.map((issue) => issue.id),
    evidenceLinks: Array.from(new Set(items.flatMap((issue) => issue.evidenceLinks)))
  });
  return next;
}

export function buildRebuttalStrategy(root) {
  const issues = readJson(root, ARTIFACT_PATHS.rebuttalIssues, { version: 1, items: [], updatedAt: null });
  const board = loadBoard(root);
  const strategy = [
    "# Rebuttal strategy",
    "",
    `- Phase: ${board.currentPhase}`,
    `- Assigned role: ${board.assignedRole}`,
    "",
    "## Issue board",
    "",
    ...(issues.items.length > 0 ? issues.items.flatMap((issue) => [
      `### ${issue.id}`,
      "",
      `- Reviewer: ${issue.reviewer}`,
      `- Severity: ${issue.severity}`,
      `- Status: ${issue.status}`,
      `- Response direction: ${issue.responseDirection}`,
      `- Evidence links: ${issue.evidenceLinks.join(", ") || "none"}`,
      `- Claim IDs: ${issue.claimIds.join(", ") || "none"}`,
      `- Experiment IDs: ${issue.experimentIds.join(", ") || "none"}`,
      `- Recommended owner: ${issue.responseDirection === "fix" ? "planner + researcher" : "rebuttal-lead"}`,
      `- Required action: ${issue.responseDirection === "fix" ? "Update evidence or experiment coverage before final response." : "Clarify scope and cite the strongest existing evidence."}`,
      ""
    ]) : ["No rebuttal issues recorded."])
  ].join("\n");
  const responseDraft = [
    "# Rebuttal response draft",
    "",
    ...(issues.items.length > 0 ? issues.items.flatMap((issue) => [
      `## ${issue.id}`,
      "",
      `Reviewer concern: ${issue.summary}`,
      "",
      `Planned response: ${issue.responseDirection === "fix" ? "Describe the concrete revision and point to the updated evidence." : "Clarify the evidence and scope without over-claiming."}`,
      "",
      `Evidence links: ${issue.evidenceLinks.join(", ") || "none"}`,
      ""
    ]) : ["No issues available for rebuttal drafting."])
  ].join("\n");
  writeText(root, ARTIFACT_PATHS.rebuttalStrategy, strategy);
  writeText(root, ARTIFACT_PATHS.rebuttalResponseDraft, responseDraft);
  upsertOrchestrationBoard(root, {
    phase: "rebuttal",
    assignedRole: "rebuttal-lead",
    rebuttalIssueIds: issues.items.map((issue) => issue.id)
  });
  return { strategyPath: ARTIFACT_PATHS.rebuttalStrategy, responseDraftPath: ARTIFACT_PATHS.rebuttalResponseDraft, issueCount: issues.items.length };
}

function readSnapshot(root, snapshotId) {
  const snapshotPath = path.join(ARTIFACT_PATHS.versionSnapshotsDir, `${snapshotId}.json`);
  return readJson(root, snapshotPath, null);
}

export function createVersionSnapshot(root, args = {}) {
  const state = loadState(root);
  const board = loadBoard(root);
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 2, claims: [], updatedAt: null });
  const reviews = readJson(root, ARTIFACT_PATHS.reviewState, { version: 1, history: [], openItems: [], lastVerdict: "not-reviewed", lastReviewedAt: null });
  const plans = readJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null });
  const results = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  const versions = readJson(root, ARTIFACT_PATHS.versionsIndex, { version: 1, currentVersionId: null, items: [], lineage: [], updatedAt: null });

  const versionId = slugify(args.versionId ?? args.label ?? `${state.paper.title}-${versions.items.length + 1}`);
  const snapshot = {
    id: versionId,
    label: args.label ?? versionId,
    parentVersionId: args.parentVersionId ?? versions.currentVersionId ?? null,
    summary: args.summary ?? "Manual paper snapshot.",
    createdAt: nowIso(),
    paper: state.paper,
    board: {
      currentPhase: board.currentPhase,
      assignedRole: board.assignedRole,
      experimentIds: board.experimentIds,
      rebuttalIssueIds: board.rebuttalIssueIds,
      activeComparisonTargets: board.activeComparisonTargets
    },
    sections: state.sections,
    draftSnapshot: collectDraftSnapshot(root, state.sections),
    claimIds: evidence.claims.map((claim) => claim.id),
    evidenceLinks: Array.from(new Set(evidence.claims.flatMap((claim) => claim.evidenceLinks ?? []))),
    reviewVerdict: reviews.lastVerdict,
    openReviewItems: reviews.openItems,
    experimentPlanIds: plans.items.map((item) => item.id),
    experimentResultIds: results.items.map((item) => item.id)
  };

  writeJson(root, path.join(ARTIFACT_PATHS.versionSnapshotsDir, `${versionId}.json`), snapshot);
  const existingIndex = versions.items.findIndex((item) => item.id === versionId);
  const summaryEntry = {
    id: versionId,
    label: snapshot.label,
    parentVersionId: snapshot.parentVersionId,
    summary: snapshot.summary,
    createdAt: snapshot.createdAt
  };
  if (existingIndex >= 0) {
    versions.items[existingIndex] = summaryEntry;
  } else {
    versions.items.push(summaryEntry);
  }
  versions.currentVersionId = versionId;
  versions.lineage = versions.items.map((item) => ({ id: item.id, parentVersionId: item.parentVersionId ?? null }));
  versions.updatedAt = nowIso();
  writeJson(root, ARTIFACT_PATHS.versionsIndex, versions);

  const snapshotIds = Array.from(new Set([...(board.versionLineage?.snapshotIds ?? []), versionId]));
  upsertOrchestrationBoard(root, {
    phase: "versions",
    assignedRole: "version-analyst",
    versionLineage: {
      currentVersionId: versionId,
      parentVersionId: snapshot.parentVersionId,
      snapshotIds
    }
  });
  return snapshot;
}

export function compareVersions(root, args = {}) {
  const fromId = args.fromVersionId;
  const toId = args.toVersionId;
  const fromSnapshot = readSnapshot(root, fromId);
  const toSnapshot = readSnapshot(root, toId);
  if (!fromSnapshot || !toSnapshot) {
    throw new Error(`Both snapshots must exist before comparison. Missing: ${!fromSnapshot ? fromId : toId}`);
  }

  const comparison = {
    id: slugify(`${fromId}-vs-${toId}`),
    fromVersionId: fromId,
    toVersionId: toId,
    createdAt: nowIso(),
    objectiveChanged: fromSnapshot.paper.objective !== toSnapshot.paper.objective,
    thesisChanged: fromSnapshot.paper.thesis !== toSnapshot.paper.thesis,
    addedClaimIds: toSnapshot.claimIds.filter((id) => !fromSnapshot.claimIds.includes(id)),
    removedClaimIds: fromSnapshot.claimIds.filter((id) => !toSnapshot.claimIds.includes(id)),
    addedExperimentResultIds: toSnapshot.experimentResultIds.filter((id) => !fromSnapshot.experimentResultIds.includes(id)),
    addedEvidenceLinks: toSnapshot.evidenceLinks.filter((item) => !fromSnapshot.evidenceLinks.includes(item)),
    removedEvidenceLinks: fromSnapshot.evidenceLinks.filter((item) => !toSnapshot.evidenceLinks.includes(item)),
    addedCitationKeys: Array.from(new Set(Object.values(toSnapshot.draftSnapshot ?? {}).flatMap((item) => item.citedKeys ?? []))).filter((item) => !Array.from(new Set(Object.values(fromSnapshot.draftSnapshot ?? {}).flatMap((entry) => entry.citedKeys ?? []))).includes(item)),
    removedCitationKeys: Array.from(new Set(Object.values(fromSnapshot.draftSnapshot ?? {}).flatMap((item) => item.citedKeys ?? []))).filter((item) => !Array.from(new Set(Object.values(toSnapshot.draftSnapshot ?? {}).flatMap((entry) => entry.citedKeys ?? []))).includes(item)),
    verdictChanged: fromSnapshot.reviewVerdict !== toSnapshot.reviewVerdict,
    changedDraftSections: Object.keys({ ...(fromSnapshot.draftSnapshot ?? {}), ...(toSnapshot.draftSnapshot ?? {}) }).flatMap((sectionId) => {
      const before = fromSnapshot.draftSnapshot?.[sectionId]?.contentHash ?? null;
      const after = toSnapshot.draftSnapshot?.[sectionId]?.contentHash ?? null;
      return before === after ? [] : [{ sectionId, from: before, to: after }];
    }),
    sectionStatusChanges: Object.keys({ ...fromSnapshot.sections, ...toSnapshot.sections }).flatMap((sectionId) => {
      const before = fromSnapshot.sections[sectionId]?.status ?? null;
      const after = toSnapshot.sections[sectionId]?.status ?? null;
      return before === after ? [] : [{ sectionId, from: before, to: after }];
    })
  };

  const comparisons = readJson(root, ARTIFACT_PATHS.versionComparisons, { version: 1, items: [], activeTargets: [], updatedAt: null });
  const existingIndex = comparisons.items.findIndex((item) => item.id === comparison.id);
  if (existingIndex >= 0) {
    comparisons.items[existingIndex] = comparison;
  } else {
    comparisons.items.push(comparison);
  }
  comparisons.activeTargets = [fromId, toId];
  comparisons.updatedAt = nowIso();
  writeJson(root, ARTIFACT_PATHS.versionComparisons, comparisons);
  writeText(root, ARTIFACT_PATHS.versionComparisonReport, [
    "# Latest version comparison",
    "",
    `- From: ${fromId}`,
    `- To: ${toId}`,
    `- Objective changed: ${comparison.objectiveChanged}`,
    `- Thesis changed: ${comparison.thesisChanged}`,
     `- Verdict changed: ${comparison.verdictChanged}`,
     "",
     "## Added evidence links",
     "",
     ...(comparison.addedEvidenceLinks.length > 0 ? comparison.addedEvidenceLinks.map((id) => `- ${id}`) : ["- None"]),
     "",
     "## Removed evidence links",
     "",
     ...(comparison.removedEvidenceLinks.length > 0 ? comparison.removedEvidenceLinks.map((id) => `- ${id}`) : ["- None"]),
     "",
     "## Added citation keys",
     "",
     ...(comparison.addedCitationKeys.length > 0 ? comparison.addedCitationKeys.map((id) => `- ${id}`) : ["- None"]),
     "",
     "## Removed citation keys",
     "",
     ...(comparison.removedCitationKeys.length > 0 ? comparison.removedCitationKeys.map((id) => `- ${id}`) : ["- None"]),
     "",
     "## Added claims",
    "",
    ...(comparison.addedClaimIds.length > 0 ? comparison.addedClaimIds.map((id) => `- ${id}`) : ["- None"]),
    "",
    "## Removed claims",
    "",
    ...(comparison.removedClaimIds.length > 0 ? comparison.removedClaimIds.map((id) => `- ${id}`) : ["- None"]),
    "",
     "## Section status changes",
     "",
     ...(comparison.sectionStatusChanges.length > 0 ? comparison.sectionStatusChanges.map((change) => `- ${change.sectionId}: ${change.from} -> ${change.to}`) : ["- None"]),
     "",
     "## Changed draft sections",
     "",
     ...(comparison.changedDraftSections.length > 0 ? comparison.changedDraftSections.map((change) => `- ${change.sectionId}: content hash changed`) : ["- None"])
   ].join("\n"));

  upsertOrchestrationBoard(root, {
    phase: "versions",
    assignedRole: "version-analyst",
    activeComparisonTargets: [fromId, toId]
  });
  return comparison;
}
