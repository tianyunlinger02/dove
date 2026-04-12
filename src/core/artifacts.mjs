import {
  ARTIFACT_PATHS,
  PIPELINE_STAGE_ORDER,
  createDefaultState
} from "./schema.mjs";
import {
  buildRebuttalStrategy,
  loadBoard,
  updateResearchBrief,
  upsertOrchestrationBoard
} from "./orchestration.mjs";
import {
  ensureWorkspace,
  extractCitationKeysFromText,
  listArtifacts,
  listDraftFiles,
  loadState,
  nowIso,
  readJson,
  readText,
  saveState,
  writeJson,
  writeText
} from "./workspace.mjs";
import { queryWorkspaceIndex, refreshDurableSurfaces } from "./navigation.mjs";

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function normalizeIdentifier(value, fallback) {
  return slugify(value ?? fallback);
}

function isStrictMode(state, args = {}) {
  return Boolean(args.strictMode ?? state.settings?.strictMode);
}

function assertStrictCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function stageRank(stage) {
  const index = PIPELINE_STAGE_ORDER.indexOf(stage);
  return index === -1 ? -1 : index;
}

function assertStageAtLeast(state, minimumStage, message) {
  const currentRank = Math.max(stageRank(state.pipeline?.currentStage), stageRank(state.pipeline?.lastCompletedStage));
  assertStrictCondition(currentRank >= stageRank(minimumStage), message);
}

function updatePipeline(state, currentStage, resumeCommand) {
  return {
    ...state,
    pipeline: {
      ...state.pipeline,
      currentStage,
      lastCompletedStage: currentStage,
      resumeCommand,
      updatedAt: nowIso()
    },
    orchestration: {
      ...state.orchestration,
      phase: currentStage
    }
  };
}

function syncPhase(root, state, { stage, resumeCommand, role, objective, evidenceLinks, experimentIds, rebuttalIssueIds, activeComparisonTargets, intentType, currentFocus, nextAction, reviewRequiredBeforeFinalize } = {}) {
  const nextState = updatePipeline(state, stage, resumeCommand);
  saveState(root, nextState);
  upsertOrchestrationBoard(root, {
    phase: stage,
    assignedRole: role,
    objective,
    evidenceLinks,
    experimentIds,
    rebuttalIssueIds,
    activeComparisonTargets,
    intentType,
    currentFocus,
    nextAction,
    reviewRequiredBeforeFinalize
  });
  return nextState;
}

function renderPlan(args, state, board) {
  const sections = Array.isArray(args.sections) && args.sections.length > 0
    ? args.sections.map((section) => `- [ ] ${section}`).join("\n")
    : Object.values(state.sections).map((section) => `- [ ] ${section.title}`).join("\n");
  const evidenceGaps = Array.isArray(args.evidenceGaps) && args.evidenceGaps.length > 0
    ? args.evidenceGaps.map((item) => `- ${item}`).join("\n")
    : "- No evidence gaps recorded yet.";
  const milestones = Array.isArray(args.milestones) && args.milestones.length > 0
    ? args.milestones.map((item, index) => `${index + 1}. ${item}`).join("\n")
    : "1. Refresh the orchestration board\n2. Expand research brief\n3. Plan experiments\n4. Draft sections\n5. Run review loop";
  const figures = Array.isArray(args.figures) && args.figures.length > 0
    ? args.figures.map((item) => `- ${item}`).join("\n")
    : "- No figures planned yet.";
  const boardTasks = board.tasks.length > 0
    ? board.tasks.map((task) => `- [${task.status === "done" ? "x" : " "}] ${task.title} (${task.assignedRole}) → ${task.nextAction}`).join("\n")
    : "- No board tasks recorded yet.";
  const blockers = board.blockers.length > 0
    ? board.blockers.map((item) => `- [${item.status}] ${item.summary}`).join("\n")
    : "- No open blockers recorded.";

  return [
    "# Current paper plan",
    "",
    `## Thesis\n\n${args.thesis ?? state.paper.thesis}`,
    "",
    `## Audience\n\n${args.audience ?? state.paper.audience}`,
    "",
    `## Paper objective\n\n${board.paperObjective}`,
    "",
    `## Current focus\n\n${board.currentFocus}`,
    "",
    `## Next action\n\n${board.nextAction}`,
    "",
    `## Section plan\n\n${sections}`,
    "",
    `## Evidence gaps\n\n${evidenceGaps}`,
    "",
    `## Board tasks\n\n${boardTasks}`,
    "",
    `## Active blockers\n\n${blockers}`,
    "",
    `## Figures and tables\n\n${figures}`,
    "",
    `## Milestones\n\n${milestones}`,
    "",
    `## Notes\n\n${args.notes ?? "No additional planning notes yet."}`
  ].join("\n");
}

function renderOutline(args, state, board) {
  const sections = Array.isArray(args.sections) && args.sections.length > 0
    ? args.sections
    : Object.values(state.sections).map((section) => ({ id: section.id, title: section.title, goal: "TBD", status: section.status }));
  return [
    "# Current outline",
    "",
    `- Active phase: ${board.currentPhase}`,
    `- Assigned role: ${board.assignedRole}`,
    `- Current focus: ${board.currentFocus}`,
    `- Next action: ${board.nextAction}`,
    "",
    ...sections.flatMap((section) => [
      `## ${section.title ?? section.id}`,
      "",
      `- Section ID: ${section.id ?? slugify(section.title)}`,
      `- Status: ${section.status ?? "planned"}`,
      `- Goal: ${section.goal ?? "TBD"}`,
      `- Evidence focus: ${section.evidenceFocus ?? "TBD"}`,
      ""
    ])
  ].join("\n");
}

function renderChecklist(state, reviewState, board, plans, results, issues, versions, workspaceIndex) {
  const openItems = Array.isArray(reviewState.openItems) ? reviewState.openItems : [];
  const draftedSections = Object.values(state.sections).filter((section) => section.status !== "planned").length;
  return [
    "# Paper checklist",
    "",
    "## Orchestration",
    "",
    `- [ ] Keep the board current for phase \`${board.currentPhase}\``,
    `- [ ] Keep current focus explicit: ${board.currentFocus}`,
    `- [ ] Resolve ${board.blockers.filter((item) => item.status !== "resolved").length} open blockers`,
    "- [ ] Append a handoff when roles change",
    "",
    "## Research memory",
    "",
    "- [ ] Register core sources in `.paper/sources/index.json`",
    "- [ ] Capture structured notes in `.paper/notes/index.json`",
    "- [ ] Maintain `.paper/research/brief.md` and `.paper/research/agenda.json`",
    "",
    "## Writing spine",
    "",
    `- [ ] Draft ${Object.keys(state.sections).length} sections (currently active: ${draftedSections})`,
    "- [ ] Keep `.paper/outline/current-outline.md` aligned with the plan",
    "",
    "## Experiments",
    "",
    `- [ ] Keep ${plans.items.length} experiment plans claim-driven`,
    `- [ ] Record ${results.items.length} experiment results with evidence links`,
    "- [ ] Persist experiment audits separately from raw results",
    "- [ ] Persist result-to-claim bridge events for claim state changes",
    "",
    "## Review + rebuttal",
    "",
    ...(openItems.length > 0 ? openItems.map((item) => `- [ ] ${item}`) : ["- [ ] Run `project:paper.review-loop` and convert findings into actions."]),
    `- [ ] Keep ${(reviewState.unresolvedConcernIds ?? []).length} unresolved concerns visible across review rounds`,
    `- [ ] Keep ${issues.items.length} rebuttal issues normalized and triaged`,
    "",
    "## Versions + workspace",
    "",
    `- [ ] Snapshot paper versions (current snapshots: ${versions.items.length})`,
    `- [ ] Compare active targets: ${board.activeComparisonTargets.join(", ") || "none"}`,
    `- [ ] Keep workspace index resumable (${workspaceIndex.activePackets?.length ?? 0} active packets)`
  ].join("\n");
}

function renderQueryPack(notesIndex, sourcesIndex, agenda, workspaceIndex) {
  return [
    "# Query pack",
    "",
    `- Current focus: ${workspaceIndex.currentFocus ?? "unknown"}`,
    `- Next action: ${workspaceIndex.nextAction ?? "unknown"}`,
    "",
    "## Source IDs",
    "",
    ...(sourcesIndex.items.length > 0 ? sourcesIndex.items.map((source) => `- ${source.id}: ${source.title}`) : ["- No sources registered yet."]),
    "",
    "## Note prompts",
    "",
    ...(notesIndex.items.length > 0 ? notesIndex.items.map((note) => `- ${note.id}: convert into section evidence for ${note.sectionId ?? "unknown section"}`) : ["- No notes captured yet."]),
    "",
    "## Research agenda",
    "",
    ...(agenda.agenda.length > 0 ? agenda.agenda.map((item) => `- ${item}`) : ["- No research agenda recorded."])
  ].join("\n");
}

function renderWiki(state, board, sourcesIndex, notesIndex, evidenceIndex, concernsIndex, issues, plans, results, versions, workspaceIndex) {
  return [
    "# Paper wiki",
    "",
    `## Thesis\n\n${state.paper.thesis}`,
    "",
    "## Orchestration board",
    "",
    `- Objective: ${board.paperObjective}`,
    `- Phase: ${board.currentPhase}`,
    `- Intent: ${board.intentType}`,
    `- Assigned role: ${board.assignedRole}`,
    `- Current focus: ${board.currentFocus}`,
    `- Next action: ${board.nextAction}`,
    `- Active comparison targets: ${board.activeComparisonTargets.join(", ") || "none"}`,
    "",
    "## Source inventory",
    "",
    ...(sourcesIndex.items.length > 0 ? sourcesIndex.items.map((source) => `- ${source.id}: ${source.title}`) : ["- No sources registered yet."]),
    "",
    "## Evidence inventory",
    "",
    ...(evidenceIndex.claims.length > 0 ? evidenceIndex.claims.map((claim) => `- ${claim.id}: ${claim.text} [${claim.status}/${claim.confidence}]`) : ["- No claims promoted yet."]),
    "",
    "## Experiments",
    "",
    ...(plans.items.length > 0 ? plans.items.map((plan) => `- ${plan.id}: ${plan.title} (${plan.status})`) : ["- No experiment plans recorded."]),
    ...(results.items.length > 0 ? ["", "## Experiment results", "", ...results.items.map((result) => `- ${result.id}: ${result.summary || result.outcome}`)] : []),
    "",
    "## Working notes",
    "",
    ...(notesIndex.items.length > 0 ? notesIndex.items.map((note) => `- ${note.id}: ${note.summary || note.title}`) : ["- No notes captured yet."]),
    "",
    "## Reviewer concerns",
    "",
    ...(concernsIndex.items.length > 0 ? concernsIndex.items.map((item) => `- ${item.id}: ${item.summary} (${item.status})`) : ["- No persistent concerns recorded."]),
    "",
    "## Rebuttal issues",
    "",
    ...(issues.items.length > 0 ? issues.items.map((issue) => `- ${issue.id}: ${issue.summary} (${issue.status})`) : ["- No rebuttal issues recorded."]),
    "",
    "## Workspace overview",
    "",
    `- Active roles: ${(workspaceIndex.activeRoles ?? []).join(", ") || "none"}`,
    `- Active packets: ${(workspaceIndex.activePackets ?? []).length}`,
    `- Unresolved concerns: ${(workspaceIndex.unresolvedConcernIds ?? []).join(", ") || "none"}`,
    "",
    "## Version lineage",
    "",
    ...(versions.items.length > 0 ? versions.items.map((item) => `- ${item.id}: ${item.summary}`) : ["- No snapshots yet."])
  ].join("\n");
}

function bibEntryType(sourceType) {
  if (sourceType === "paper" || sourceType === "article") {
    return "article";
  }
  if (sourceType === "inproceedings" || sourceType === "conference") {
    return "inproceedings";
  }
  return "misc";
}

function renderBibEntry(source) {
  const authors = Array.isArray(source.authors) && source.authors.length > 0 ? source.authors.join(" and ") : "Unknown";
  const fields = [
    `  author = {${authors}}`,
    `  title = {${source.title ?? "Untitled Source"}}`
  ];
  if (source.year) fields.push(`  year = {${source.year}}`);
  if (source.locator) fields.push(`  howpublished = {${source.locator}}`);
  return `@${bibEntryType(source.sourceType)}{${source.citationKey ?? source.id},\n${fields.join(",\n")}\n}`;
}

function renderCitationLog(sourcesIndex, citedKeys, missingKeys) {
  return [
    "# Citation log",
    "",
    `- Updated: ${nowIso()}`,
    "",
    "## Registered sources",
    "",
    ...(sourcesIndex.items.length > 0
      ? sourcesIndex.items.map((source) => `- [${citedKeys.has(source.citationKey ?? source.id) ? "cited" : "registered"}] ${source.citationKey ?? source.id}: ${source.title}`)
      : ["- No sources registered yet."]),
    "",
    "## Missing citation keys",
    "",
    ...(missingKeys.length > 0 ? missingKeys.map((key) => `- [missing] ${key}`) : ["- None"])
  ].join("\n");
}

function renderRebuttalDraft(reviewState, claimsIndex, issuesPath, strategyPath, responseDraftPath) {
  return [
    "# Rebuttal Notes",
    "",
    "## Reviewer concerns",
    "",
    ...(reviewState.openItems.length > 0 ? reviewState.openItems.map((item) => `- ${item}`) : ["- No open reviewer concerns recorded."]),
    "",
    "## Evidence-backed responses",
    "",
    ...(claimsIndex.claims.length > 0 ? claimsIndex.claims.map((claim) => `- ${claim.id}: ${claim.text}`) : ["- No evidence-backed claims recorded yet."]),
    "",
    "## Durable rebuttal artifacts",
    "",
    `- Issues: ${issuesPath}`,
    `- Strategy: ${strategyPath}`,
    `- Response draft: ${responseDraftPath}`,
    "",
    "## Remaining limitations",
    "",
    "- Document unresolved concerns honestly here."
  ].join("\n");
}

function createWikiArtifacts(state, board, sourcesIndex, notesIndex, evidenceIndex, concernsIndex, decisions, questions, plans, results, issues) {
  const entities = [];
  const relations = [];
  entities.push({ id: "paper-current", entityType: "paper", label: state.paper.title, summary: state.paper.objective, status: board.currentPhase, updatedAt: nowIso() });
  for (const note of notesIndex.items ?? []) {
    entities.push({ id: `idea-${note.id}`, entityType: "idea", label: note.title, summary: note.summary ?? "", sectionId: note.sectionId ?? null, updatedAt: note.updatedAt ?? nowIso() });
    for (const sourceId of note.sourceIds ?? []) {
      relations.push({ id: `idea-${note.id}-uses-${sourceId}`, fromId: `idea-${note.id}`, toId: sourceId, relationType: "uses-source", updatedAt: nowIso() });
    }
  }
  for (const source of sourcesIndex.items ?? []) {
    entities.push({ id: source.id, entityType: "paper", label: source.title, summary: source.abstract ?? "", status: source.sourceType ?? "source", updatedAt: source.addedAt ?? nowIso() });
  }
  for (const claim of evidenceIndex.claims ?? []) {
    entities.push({ id: claim.id, entityType: "claim", label: claim.text, summary: `${claim.status}/${claim.confidence}`, sectionId: claim.sectionId, status: claim.status, updatedAt: evidenceIndex.updatedAt ?? nowIso() });
    for (const sourceId of claim.sourceIds ?? []) relations.push({ id: `${claim.id}-supported-by-${sourceId}`, fromId: claim.id, toId: sourceId, relationType: "supported-by-source", updatedAt: nowIso() });
    for (const noteId of claim.noteIds ?? []) relations.push({ id: `${claim.id}-supported-by-note-${noteId}`, fromId: claim.id, toId: `idea-${noteId}`, relationType: "supported-by-idea", updatedAt: nowIso() });
    for (const experimentId of claim.experimentIds ?? []) relations.push({ id: `${claim.id}-tested-by-${experimentId}`, fromId: claim.id, toId: `experiment-${experimentId}`, relationType: "tested-by-experiment", updatedAt: nowIso() });
  }
  for (const plan of plans.items ?? []) {
    entities.push({ id: `experiment-${plan.id}`, entityType: "experiment", label: plan.title, summary: plan.methodology ?? "", status: plan.status, updatedAt: plan.updatedAt ?? nowIso() });
    if (plan.claimId) relations.push({ id: `experiment-${plan.id}-tests-${plan.claimId}`, fromId: `experiment-${plan.id}`, toId: plan.claimId, relationType: "tests-claim", updatedAt: nowIso() });
  }
  for (const concern of concernsIndex.items ?? []) {
    entities.push({ id: concern.id, entityType: "review concern", label: concern.summary, summary: concern.reviewerRationale ?? "", status: concern.status, updatedAt: concern.updatedAt ?? nowIso() });
    for (const claimId of concern.claimIds ?? []) relations.push({ id: `${concern.id}-concerns-${claimId}`, fromId: concern.id, toId: claimId, relationType: "concerns-claim", updatedAt: nowIso() });
  }
  for (const issue of issues.items ?? []) {
    entities.push({ id: `question-${issue.id}`, entityType: "question", label: issue.summary, summary: issue.responseDirection ?? "", status: issue.status, updatedAt: issue.updatedAt ?? nowIso() });
  }
  for (const decision of decisions) {
    entities.push({ id: `decision-${decision.id}`, entityType: "decision", label: decision.summary, summary: decision.rationale ?? "", packetId: decision.packetId ?? null, updatedAt: decision.recordedAt ?? nowIso() });
  }
  for (const question of questions) {
    entities.push({ id: `question-${question.id}`, entityType: "question", label: question.summary, summary: question.origin ?? "", packetId: question.packetId ?? null, sectionId: question.sectionId ?? null, status: question.status, updatedAt: nowIso() });
  }
  return {
    entities: { version: 1, items: entities, updatedAt: nowIso() },
    relations: { version: 1, items: relations, updatedAt: nowIso() }
  };
}

function normalizeFigureItem(item = {}, index = 0) {
  const id = slugify(item.id ?? item.name ?? `figure-${index + 1}`);
  const briefId = `${id}-brief`;
  const templateId = `${id}-template`;
  return {
    id,
    name: item.name ?? item.id ?? `Figure ${index + 1}`,
    purpose: item.purpose ?? item.narrativeIntent ?? "TBD",
    sourceSections: Array.isArray(item.sourceSections) ? item.sourceSections : (item.sourceSection ? [item.sourceSection] : []),
    targetClaimIds: Array.isArray(item.targetClaimIds) ? item.targetClaimIds : (item.targetClaimId ? [item.targetClaimId] : []),
    narrativeIntent: item.narrativeIntent ?? item.purpose ?? "Explain the linked method/result clearly.",
    requiredVisualElements: Array.isArray(item.requiredVisualElements) ? item.requiredVisualElements : (Array.isArray(item.inputs) ? item.inputs : []),
    owner: item.owner ?? "manual",
    mode: item.mode ?? "manual",
    status: item.status ?? "planned",
    briefId,
    segmentId: `${id}-segments`,
    templateId,
    editableArtifactId: `${id}-editable`,
    templateSvgPath: item.templateSvgPath ?? `.paper/figures/${id}.template.svg`,
    finalSvgPath: item.finalSvgPath ?? `.paper/figures/${id}.final.svg`,
    reviewNotes: item.reviewNotes ?? []
  };
}

export function initProject(root, args = {}) {
  ensureWorkspace(root);
  const defaults = createDefaultState();
  let state = loadState(root);
  state = {
    ...state,
    paper: {
      ...state.paper,
      title: args.title ?? state.paper.title,
      venue: args.venue ?? state.paper.venue,
      objective: args.objective ?? state.paper.objective,
      deadline: args.deadline ?? state.paper.deadline,
      thesis: args.thesis ?? state.paper.thesis,
      audience: args.audience ?? state.paper.audience
    },
    settings: {
      ...state.settings,
      strictMode: Boolean(args.strictMode ?? state.settings?.strictMode ?? false)
    },
    sections: state.sections ?? defaults.sections
  };

  state = syncPhase(root, state, {
    stage: "init",
    resumeCommand: "project:paper.orchestrate",
    role: "planner",
    objective: state.paper.objective,
    intentType: "plan",
    currentFocus: "Align the project goal and workflow contract.",
    nextAction: "Refresh the board, then register sources and research questions."
  });

  writeText(root, ARTIFACT_PATHS.project, `# Project brief\n\n- Working title: ${state.paper.title}\n- Venue: ${state.paper.venue}\n- Objective: ${state.paper.objective}\n- Deadline: ${state.paper.deadline || "TBD"}\n\n## Thesis\n\n${state.paper.thesis}\n\n## Audience\n\n${state.paper.audience}\n`);
  writeText(root, ARTIFACT_PATHS.researchContract, `# Research contract\n\n## Project\n\n- Title: ${state.paper.title}\n- Venue: ${state.paper.venue}\n- Objective: ${state.paper.objective}\n\n## Working rules\n\n- No unsupported claims.\n- No citation from memory.\n- Preserve durable artifacts after every stage.\n- Keep the orchestration board and handoffs current.\n- Require review-before-finalize for high-risk changes.\n`);
  updateResearchBrief(root, {
    objective: state.paper.objective,
    agenda: [
      "Clarify the paper objective and contribution.",
      "Build an evidence base before drafting stronger claims."
    ],
    evidenceBacklog: ["Register at least one durable source and note."],
    phase: "init",
    assignedRole: "planner"
  });
  refreshDurableSurfaces(root, {
    type: "init-project",
    summary: `Initialized project ${state.paper.title}.`,
    artifactPaths: [ARTIFACT_PATHS.project, ARTIFACT_PATHS.researchContract, ARTIFACT_PATHS.sessionSummary, ARTIFACT_PATHS.workspaceIndex]
  });
  return state;
}

export function readState(root) {
  const state = loadState(root);
  return { ...state, orchestrationBoard: loadBoard(root), workspaceIndex: queryWorkspaceIndex(root) };
}

export function registerSource(root, args = {}) {
  ensureWorkspace(root);
  const sources = readJson(root, ARTIFACT_PATHS.sources, { version: 1, items: [], updatedAt: null });
  const baseId = normalizeIdentifier(args.sourceId, `${slugify(args.citationKey ?? args.title ?? `source-${sources.items.length + 1}`)}${args.year ? `-${args.year}` : ""}`);
  const source = {
    id: baseId,
    citationKey: args.citationKey ?? baseId,
    title: args.title ?? "Untitled Source",
    authors: Array.isArray(args.authors) ? args.authors : [],
    year: args.year ?? "",
    locator: args.locator ?? "",
    sourceType: args.sourceType ?? "paper",
    abstract: args.abstract ?? "",
    origin: args.origin ?? "manual",
    addedAt: nowIso()
  };
  const existingIndex = sources.items.findIndex((item) => item.id === source.id || item.citationKey === source.citationKey);
  if (existingIndex >= 0) sources.items[existingIndex] = { ...sources.items[existingIndex], ...source };
  else sources.items.push(source);
  sources.updatedAt = nowIso();
  writeJson(root, ARTIFACT_PATHS.sources, sources);
  syncCitations(root, { preservePhase: true });
  const state = loadState(root);
  syncPhase(root, state, {
    stage: "sources",
    resumeCommand: "project:paper.research",
    role: "researcher",
    intentType: "research",
    currentFocus: `Register and curate sources for ${state.paper.title}.`,
    nextAction: "Capture notes from the strongest source next."
  });
  refreshDurableSurfaces(root, {
    type: "register-source",
    summary: `Registered source ${source.id}.`,
    artifactPaths: [ARTIFACT_PATHS.sources, ARTIFACT_PATHS.citationLog, ARTIFACT_PATHS.queryPack]
  });
  return source;
}

export function upsertNote(root, args = {}) {
  ensureWorkspace(root);
  const notes = readJson(root, ARTIFACT_PATHS.notes, { version: 1, items: [], updatedAt: null });
  const sources = readJson(root, ARTIFACT_PATHS.sources, { version: 1, items: [], updatedAt: null });
  const knownSourceIds = new Set(sources.items.flatMap((item) => [item.id, item.citationKey].filter(Boolean)));
  const requestedSourceIds = Array.isArray(args.sourceIds) ? args.sourceIds : [];
  const unknownSourceIds = requestedSourceIds.filter((id) => !knownSourceIds.has(id));
  if (unknownSourceIds.length > 0) throw new Error(`Note references unknown sources: ${unknownSourceIds.join(", ")}`);
  const note = {
    id: normalizeIdentifier(args.noteId, `${args.sectionId ?? "general"}-${args.title ?? `note-${notes.items.length + 1}`}`),
    title: args.title ?? "Untitled Note",
    sectionId: normalizeIdentifier(args.sectionId, "introduction"),
    sourceIds: requestedSourceIds,
    summary: args.summary ?? "",
    quotes: Array.isArray(args.quotes) ? args.quotes : [],
    claims: Array.isArray(args.claims) ? args.claims : [],
    openQuestions: Array.isArray(args.openQuestions) ? args.openQuestions : [],
    updatedAt: nowIso()
  };
  const existingIndex = notes.items.findIndex((item) => item.id === note.id);
  if (existingIndex >= 0) notes.items[existingIndex] = note;
  else notes.items.push(note);
  notes.updatedAt = nowIso();
  writeJson(root, ARTIFACT_PATHS.notes, notes);

  const agenda = readJson(root, ARTIFACT_PATHS.researchAgenda, { version: 1, objective: loadState(root).paper.objective, agenda: [], evidenceBacklog: [], updatedAt: null });
  writeText(root, ARTIFACT_PATHS.queryPack, renderQueryPack(notes, sources, agenda, queryWorkspaceIndex(root)));
  const state = loadState(root);
  syncPhase(root, state, {
    stage: "notes",
    resumeCommand: "project:paper.claim-gate",
    role: "researcher",
    intentType: "research",
    currentFocus: note.summary || note.title,
    nextAction: "Promote any supported findings into durable claims."
  });
  refreshDurableSurfaces(root, {
    type: "upsert-note",
    summary: `Updated note ${note.id}.`,
    artifactPaths: [ARTIFACT_PATHS.notes, ARTIFACT_PATHS.queryPack, ARTIFACT_PATHS.sessionSummary]
  });
  return note;
}

export function upsertPlan(root, args = {}) {
  const state = loadState(root);
  const sources = readJson(root, ARTIFACT_PATHS.sources, { version: 1, items: [], updatedAt: null });
  const notes = readJson(root, ARTIFACT_PATHS.notes, { version: 1, items: [], updatedAt: null });
  if (isStrictMode(state, args)) {
    assertStageAtLeast(state, "notes", "Strict mode requires source and note capture before planning.");
    assertStrictCondition(sources.items.length > 0, "Strict mode requires at least one registered source before planning.");
    assertStrictCondition(notes.items.length > 0, "Strict mode requires at least one structured note before planning.");
  }
  const nextState = syncPhase(root, {
    ...state,
    paper: { ...state.paper, thesis: args.thesis ?? state.paper.thesis, audience: args.audience ?? state.paper.audience }
  }, {
    stage: "plan",
    resumeCommand: "project:paper.outline",
    role: "planner",
    intentType: "plan",
    currentFocus: "Convert supported claims into a sectioned writing plan.",
    nextAction: "Refresh the outline before drafting.",
    reviewRequiredBeforeFinalize: true
  });
  writeText(root, ARTIFACT_PATHS.plan, renderPlan(args, nextState, loadBoard(root)));
  refreshDurableSurfaces(root, {
    type: "upsert-plan",
    summary: "Updated current paper plan.",
    artifactPaths: [ARTIFACT_PATHS.plan, ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.sessionSummary]
  });
  return { planPath: ARTIFACT_PATHS.plan, thesis: nextState.paper.thesis };
}

export function upsertOutline(root, args = {}) {
  let state = loadState(root);
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null });
  if (isStrictMode(state, args)) {
    assertStageAtLeast(state, "plan", "Strict mode requires planning before outlining.");
    assertStrictCondition(evidence.claims.length > 0, "Strict mode requires at least one evidence-backed claim before outlining.");
  }
  const providedSections = Array.isArray(args.sections) ? args.sections : [];
  for (const section of providedSections) {
    const sectionId = normalizeIdentifier(section.id, section.title ?? "section");
    state.sections[sectionId] = {
      ...(state.sections[sectionId] ?? { id: sectionId, draftPath: `.paper/drafts/${sectionId}.md`, claimIds: [] }),
      title: section.title ?? state.sections[sectionId]?.title ?? sectionId,
      status: section.status ?? state.sections[sectionId]?.status ?? "planned",
      summary: section.goal ?? state.sections[sectionId]?.summary ?? ""
    };
  }
  state = syncPhase(root, state, {
    stage: "outline",
    resumeCommand: "project:paper.draft",
    role: "planner",
    intentType: "plan",
    currentFocus: "Translate the plan into a section-by-section outline.",
    nextAction: "Draft the highest-leverage section next.",
    reviewRequiredBeforeFinalize: true
  });
  writeText(root, ARTIFACT_PATHS.outline, renderOutline(args, state, loadBoard(root)));
  refreshDurableSurfaces(root, {
    type: "upsert-outline",
    summary: "Updated current outline.",
    artifactPaths: [ARTIFACT_PATHS.outline, ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.sessionSummary]
  });
  return { outlinePath: ARTIFACT_PATHS.outline, sectionCount: Object.keys(state.sections).length };
}

export function upsertDraft(root, args = {}) {
  const sectionId = normalizeIdentifier(args.sectionId, "introduction");
  const state = loadState(root);
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null });
  if (isStrictMode(state, args)) {
    assertStageAtLeast(state, "outline", "Strict mode requires an approved outline stage before drafting.");
    assertStrictCondition(evidence.claims.length > 0, "Strict mode requires evidence-backed claims before drafting.");
  }
  const draftPath = `${ARTIFACT_PATHS.draftsDir}/${sectionId}.md`;
  const title = args.title ?? sectionId.replace(/-/g, " ");
  const body = args.body ?? `# ${title}\n\nTODO[citation]: add evidence-backed content for this section.\n`;
  writeText(root, draftPath, body);

  state.sections[sectionId] = {
    ...(state.sections[sectionId] ?? { id: sectionId, title, draftPath, claimIds: [] }),
    title,
    status: args.status ?? "drafting",
    draftPath,
    summary: args.summary ?? state.sections[sectionId]?.summary ?? ""
  };
  syncPhase(root, state, {
    stage: "draft",
    resumeCommand: "project:paper.review-loop",
    role: "researcher",
    intentType: "write",
    currentFocus: `Draft ${title}.`,
    nextAction: "Refresh the review loop before making completion claims.",
    reviewRequiredBeforeFinalize: true
  });
  refreshDurableSurfaces(root, {
    type: "upsert-draft",
    summary: `Updated draft for section ${sectionId}.`,
    artifactPaths: [draftPath, ARTIFACT_PATHS.sessionSummary, ARTIFACT_PATHS.navigationReport]
  });
  return { draftPath, sectionId };
}

export function setSectionStatus(root, args = {}) {
  const sectionId = normalizeIdentifier(args.sectionId, "introduction");
  const state = loadState(root);
  state.sections[sectionId] = {
    ...(state.sections[sectionId] ?? { id: sectionId, title: sectionId, draftPath: `.paper/drafts/${sectionId}.md`, claimIds: [] }),
    status: args.status ?? "planned",
    summary: args.summary ?? state.sections[sectionId]?.summary ?? ""
  };
  const board = loadBoard(root);
  saveState(root, state);
  upsertOrchestrationBoard(root, {
    phase: state.pipeline.currentStage,
    assignedRole: board.assignedRole,
    currentFocus: args.summary ?? board.currentFocus,
    nextAction: board.nextAction,
    tasks: board.tasks.map((task) => {
      if (task.id !== sectionId && task.id !== `${sectionId}-draft`) return task;
      return { ...task, status: args.status === "ready" ? "done" : task.status, notes: args.summary ?? task.notes };
    })
  });
  refreshDurableSurfaces(root, {
    type: "set-section-status",
    summary: `Set section ${sectionId} to ${state.sections[sectionId].status}.`,
    artifactPaths: [ARTIFACT_PATHS.state, ARTIFACT_PATHS.orchestrationBoard, ARTIFACT_PATHS.sessionSummary]
  });
  return state.sections[sectionId];
}

export function syncChecklist(root) {
  const state = loadState(root);
  const board = loadBoard(root);
  const reviewState = readJson(root, ARTIFACT_PATHS.reviewState, { version: 2, history: [], openItems: [], lastVerdict: "not-reviewed", lastReviewedAt: null, unresolvedConcernIds: [] });
  const plans = readJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null });
  const results = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  const issues = readJson(root, ARTIFACT_PATHS.rebuttalIssues, { version: 1, items: [], updatedAt: null });
  const versions = readJson(root, ARTIFACT_PATHS.versionsIndex, { version: 1, currentVersionId: null, items: [], lineage: [], updatedAt: null });
  const workspaceIndex = queryWorkspaceIndex(root);
  writeText(root, ARTIFACT_PATHS.checklist, renderChecklist(state, reviewState, board, plans, results, issues, versions, workspaceIndex));
  refreshDurableSurfaces(root, {
    type: "sync-checklist",
    summary: "Refreshed checklist from current workspace state.",
    artifactPaths: [ARTIFACT_PATHS.checklist, ARTIFACT_PATHS.navigationReport, ARTIFACT_PATHS.workspaceIndex]
  });
  return { checklistPath: ARTIFACT_PATHS.checklist, openItemCount: reviewState.openItems.length };
}

export function upsertFigurePlan(root, args = {}) {
  const figures = readJson(root, ARTIFACT_PATHS.figuresIndex, { version: 1, items: [], updatedAt: null });
  const normalizedItems = (Array.isArray(args.items) ? args.items : []).map(normalizeFigureItem);
  figures.items = normalizedItems;
  figures.updatedAt = nowIso();
  writeJson(root, ARTIFACT_PATHS.figuresIndex, figures);

  writeJson(root, ARTIFACT_PATHS.figureBriefs, {
    version: 1,
    items: normalizedItems.map((item) => ({
      id: item.briefId,
      figureId: item.id,
      sourceSections: item.sourceSections,
      targetClaimIds: item.targetClaimIds,
      narrativeIntent: item.narrativeIntent,
      requiredVisualElements: item.requiredVisualElements,
      updatedAt: nowIso()
    })),
    updatedAt: nowIso()
  });
  writeJson(root, ARTIFACT_PATHS.figureSegments, {
    version: 1,
    items: normalizedItems.map((item) => ({
      id: item.segmentId,
      figureId: item.id,
      placeholderSegments: item.requiredVisualElements.map((element, index) => ({ id: `${item.id}-segment-${index + 1}`, label: element })),
      updatedAt: nowIso()
    })),
    updatedAt: nowIso()
  });
  writeJson(root, ARTIFACT_PATHS.figureTemplates, {
    version: 1,
    items: normalizedItems.map((item) => ({
      id: item.templateId,
      figureId: item.id,
      templateSvgPath: item.templateSvgPath,
      finalSvgPath: item.finalSvgPath,
      templatePlan: `Use ${item.requiredVisualElements.join(", ") || "the planned visual elements"} to build an editable SVG template.`,
      updatedAt: nowIso()
    })),
    updatedAt: nowIso()
  });
  writeJson(root, ARTIFACT_PATHS.figureEditableIndex, {
    version: 1,
    items: normalizedItems.map((item) => ({
      id: item.editableArtifactId,
      figureId: item.id,
      templateSvgPath: item.templateSvgPath,
      finalSvgPath: item.finalSvgPath,
      reviewNotes: item.reviewNotes,
      updatedAt: nowIso()
    })),
    updatedAt: nowIso()
  });

  const content = [
    "# Figures backlog",
    "",
    "This staged figure contract does not claim to ship a render backend.",
    "",
    ...(normalizedItems.length > 0
      ? normalizedItems.flatMap((item) => [
          `## ${item.name}`,
          "",
          `- Purpose: ${item.purpose}`,
          `- Source sections: ${item.sourceSections.join(", ") || "none"}`,
          `- Target claims: ${item.targetClaimIds.join(", ") || "none"}`,
          `- Narrative intent: ${item.narrativeIntent}`,
          `- Required visual elements: ${item.requiredVisualElements.join(", ") || "none"}`,
          `- Template SVG path: ${item.templateSvgPath}`,
          `- Final SVG path: ${item.finalSvgPath}`,
          `- Owner: ${item.owner}`,
          `- Mode: ${item.mode}`,
          `- Status: ${item.status}`,
          ""
        ])
      : ["No figures planned yet."])
  ].join("\n");
  writeText(root, ARTIFACT_PATHS.figuresReadme, content);
  refreshDurableSurfaces(root, {
    type: "upsert-figure-plan",
    summary: `Updated figure backlog with ${normalizedItems.length} items.`,
    artifactPaths: [ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureBriefs, ARTIFACT_PATHS.figureSegments, ARTIFACT_PATHS.figureTemplates, ARTIFACT_PATHS.figureEditableIndex, ARTIFACT_PATHS.figuresReadme]
  });
  return { figureCount: normalizedItems.length };
}

export function syncCitations(root, args = {}) {
  ensureWorkspace(root);
  const sources = readJson(root, ARTIFACT_PATHS.sources, { version: 1, items: [], updatedAt: null });
  const citedKeys = new Set();
  for (const draftFile of listDraftFiles(root)) {
    const draftPath = `${ARTIFACT_PATHS.draftsDir}/${draftFile}`;
    const draftContent = readText(root, draftPath, "");
    for (const key of extractCitationKeysFromText(draftContent)) citedKeys.add(key);
  }
  const missingKeys = Array.from(citedKeys).filter((key) => !sources.items.some((source) => source.id === key || source.citationKey === key)).sort();
  const selectedSources = args.citedOnly
    ? sources.items.filter((source) => citedKeys.has(source.citationKey ?? source.id) || citedKeys.has(source.id))
    : sources.items;
  const bibliography = selectedSources.map(renderBibEntry).join("\n\n");
  writeText(root, ARTIFACT_PATHS.bibliography, bibliography ? `${bibliography}\n` : "");
  writeText(root, ARTIFACT_PATHS.citationLog, renderCitationLog(sources, citedKeys, missingKeys));
  const state = loadState(root);
  syncPhase(root, state, args.preservePhase ? {
    stage: state.pipeline.currentStage,
    resumeCommand: state.pipeline.resumeCommand,
    role: loadBoard(root).assignedRole,
    intentType: loadBoard(root).intentType,
    currentFocus: loadBoard(root).currentFocus,
    nextAction: loadBoard(root).nextAction
  } : {
    stage: "citations",
    resumeCommand: "project:paper.review-loop",
    role: "researcher",
    intentType: "review",
    currentFocus: "Reconcile bibliography coverage with cited drafts.",
    nextAction: "Run the review loop after citation sync completes.",
    reviewRequiredBeforeFinalize: true
  });
  refreshDurableSurfaces(root, {
    type: "sync-citations",
    summary: `Synchronized citations for ${citedKeys.size} cited keys.`,
    artifactPaths: [ARTIFACT_PATHS.bibliography, ARTIFACT_PATHS.citationLog, ARTIFACT_PATHS.navigationReport]
  });
  return { sourceCount: sources.items.length, citedKeyCount: citedKeys.size, missingKeys };
}

export function refreshWiki(root) {
  ensureWorkspace(root);
  const state = loadState(root);
  const board = loadBoard(root);
  const notes = readJson(root, ARTIFACT_PATHS.notes, { version: 1, items: [], updatedAt: null });
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null });
  const concerns = readJson(root, ARTIFACT_PATHS.reviewConcerns, { version: 1, items: [], updatedAt: null });
  const sources = readJson(root, ARTIFACT_PATHS.sources, { version: 1, items: [], updatedAt: null });
  const agenda = readJson(root, ARTIFACT_PATHS.researchAgenda, { version: 1, objective: state.paper.objective, agenda: [], evidenceBacklog: [], updatedAt: null });
  const plans = readJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null });
  const results = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  const issues = readJson(root, ARTIFACT_PATHS.rebuttalIssues, { version: 1, items: [], updatedAt: null });
  const versions = readJson(root, ARTIFACT_PATHS.versionsIndex, { version: 1, currentVersionId: null, items: [], lineage: [], updatedAt: null });
  const navigation = refreshDurableSurfaces(root, {
    type: "refresh-wiki-prepass",
    summary: "Prepared navigation state before typed wiki refresh.",
    artifactPaths: [ARTIFACT_PATHS.navigationReport, ARTIFACT_PATHS.workspaceIndex]
  });
  const workspaceIndex = queryWorkspaceIndex(root);
  const typed = createWikiArtifacts(state, board, sources, notes, evidence, concerns, navigation.decisions, navigation.openQuestions, plans, results, issues);
  writeJson(root, ARTIFACT_PATHS.wikiEntities, typed.entities);
  writeJson(root, ARTIFACT_PATHS.wikiRelations, typed.relations);
  writeText(root, ARTIFACT_PATHS.wiki, renderWiki(state, board, sources, notes, evidence, concerns, issues, plans, results, versions, workspaceIndex));
  writeText(root, ARTIFACT_PATHS.queryPack, renderQueryPack(notes, sources, agenda, workspaceIndex));
  syncPhase(root, state, {
    stage: board.currentPhase,
    resumeCommand: state.pipeline.resumeCommand,
    role: board.assignedRole,
    intentType: board.intentType,
    currentFocus: board.currentFocus,
    nextAction: board.nextAction,
    reviewRequiredBeforeFinalize: board.reviewRequiredBeforeFinalize
  });
  refreshDurableSurfaces(root, {
    type: "refresh-wiki",
    summary: "Refreshed wiki, typed wiki indexes, query pack, and navigation surfaces.",
    artifactPaths: [ARTIFACT_PATHS.wiki, ARTIFACT_PATHS.queryPack, ARTIFACT_PATHS.wikiEntities, ARTIFACT_PATHS.wikiRelations, ARTIFACT_PATHS.navigationReport]
  });
  return { wikiPath: ARTIFACT_PATHS.wiki, noteCount: notes.items.length, claimCount: evidence.claims.length };
}

export function buildRebuttal(root) {
  ensureWorkspace(root);
  const reviewState = readJson(root, ARTIFACT_PATHS.reviewState, { version: 2, history: [], openItems: [], lastVerdict: "not-reviewed", lastReviewedAt: null, unresolvedConcernIds: [] });
  const claims = readJson(root, ARTIFACT_PATHS.evidence, { version: 3, claims: [], updatedAt: null });
  buildRebuttalStrategy(root);
  const draftPath = `${ARTIFACT_PATHS.draftsDir}/rebuttal.md`;
  writeText(root, draftPath, renderRebuttalDraft(reviewState, claims, ARTIFACT_PATHS.rebuttalIssues, ARTIFACT_PATHS.rebuttalStrategy, ARTIFACT_PATHS.rebuttalResponseDraft));
  const state = loadState(root);
  state.sections.rebuttal = {
    ...(state.sections.rebuttal ?? { id: "rebuttal", title: "Rebuttal Notes", draftPath, claimIds: [] }),
    status: reviewState.openItems.length > 0 ? "drafting" : "ready",
    draftPath,
    summary: "Artifact-backed rebuttal draft"
  };
  syncPhase(root, state, {
    stage: "rebuttal",
    resumeCommand: "project:paper.version-snapshot",
    role: "rebuttal-lead",
    intentType: "respond",
    currentFocus: "Convert normalized concerns into an evidence-backed rebuttal.",
    nextAction: "Snapshot the paper once rebuttal changes stabilize.",
    rebuttalIssueIds: readJson(root, ARTIFACT_PATHS.rebuttalIssues, { version: 1, items: [], updatedAt: null }).items.map((issue) => issue.id),
    reviewRequiredBeforeFinalize: true
  });
  refreshDurableSurfaces(root, {
    type: "build-rebuttal",
    summary: "Built artifact-backed rebuttal draft.",
    artifactPaths: [draftPath, ARTIFACT_PATHS.rebuttalStrategy, ARTIFACT_PATHS.rebuttalResponseDraft]
  });
  return { draftPath, openReviewItemCount: reviewState.openItems.length };
}

export function listWorkspaceArtifacts(root) {
  return listArtifacts(root);
}
