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

function syncPhase(root, state, { stage, resumeCommand, role, objective, evidenceLinks, experimentIds, rebuttalIssueIds, activeComparisonTargets } = {}) {
  const nextState = updatePipeline(state, stage, resumeCommand);
  saveState(root, nextState);
  upsertOrchestrationBoard(root, {
    phase: stage,
    assignedRole: role,
    objective,
    evidenceLinks,
    experimentIds,
    rebuttalIssueIds,
    activeComparisonTargets
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
    ? board.tasks.map((task) => `- [${task.status === "done" ? "x" : " "}] ${task.title} (${task.assignedRole})`).join("\n")
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

function renderChecklist(state, reviewState, board, plans, results, issues, versions) {
  const openItems = Array.isArray(reviewState.openItems) ? reviewState.openItems : [];
  const draftedSections = Object.values(state.sections).filter((section) => section.status !== "planned").length;
  return [
    "# Paper checklist",
    "",
    "## Orchestration",
    "",
    `- [ ] Keep the board current for phase \`${board.currentPhase}\``,
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
    "",
    "## Review + rebuttal",
    "",
    ...(openItems.length > 0 ? openItems.map((item) => `- [ ] ${item}`) : ["- [ ] Run `project:paper.review-loop` and convert findings into actions."]),
    `- [ ] Keep ${issues.items.length} rebuttal issues normalized and triaged`,
    "",
    "## Versions",
    "",
    `- [ ] Snapshot paper versions (current snapshots: ${versions.items.length})`,
    `- [ ] Compare active targets: ${board.activeComparisonTargets.join(", ") || "none"}`
  ].join("\n");
}

function renderQueryPack(notesIndex, sourcesIndex, agenda) {
  return [
    "# Query pack",
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

function renderWiki(state, board, notesIndex, evidenceIndex, reviewState, sourcesIndex, agenda, plans, results, issues, versions) {
  return [
    "# Paper wiki",
    "",
    `## Thesis\n\n${state.paper.thesis}`,
    "",
    "## Orchestration board",
    "",
    `- Objective: ${board.paperObjective}`,
    `- Phase: ${board.currentPhase}`,
    `- Assigned role: ${board.assignedRole}`,
    `- Active comparison targets: ${board.activeComparisonTargets.join(", ") || "none"}`,
    "",
    "## Source inventory",
    "",
    ...(sourcesIndex.items.length > 0 ? sourcesIndex.items.map((source) => `- ${source.id}: ${source.title}`) : ["- No sources registered yet."]),
    "",
    "## Evidence inventory",
    "",
    ...(evidenceIndex.claims.length > 0 ? evidenceIndex.claims.map((claim) => `- ${claim.id}: ${claim.text}`) : ["- No claims promoted yet."]),
    "",
    "## Research agenda",
    "",
    ...(agenda.agenda.length > 0 ? agenda.agenda.map((item) => `- ${item}`) : ["- No research agenda recorded."]),
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
    ...(reviewState.openItems.length > 0 ? reviewState.openItems.map((item) => `- ${item}`) : ["- No open review items."]),
    "",
    "## Rebuttal issues",
    "",
    ...(issues.items.length > 0 ? issues.items.map((issue) => `- ${issue.id}: ${issue.summary} (${issue.status})`) : ["- No rebuttal issues recorded."]),
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
  if (source.year) {
    fields.push(`  year = {${source.year}}`);
  }
  if (source.locator) {
    fields.push(`  howpublished = {${source.locator}}`);
  }
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
    objective: state.paper.objective
  });

  writeText(root, ARTIFACT_PATHS.project, `# Project brief\n\n- Working title: ${state.paper.title}\n- Venue: ${state.paper.venue}\n- Objective: ${state.paper.objective}\n- Deadline: ${state.paper.deadline || "TBD"}\n\n## Thesis\n\n${state.paper.thesis}\n\n## Audience\n\n${state.paper.audience}\n`);
  writeText(root, ARTIFACT_PATHS.researchContract, `# Research contract\n\n## Project\n\n- Title: ${state.paper.title}\n- Venue: ${state.paper.venue}\n- Objective: ${state.paper.objective}\n\n## Working rules\n\n- No unsupported claims.\n- No citation from memory.\n- Preserve durable artifacts after every stage.\n- Keep the orchestration board and handoffs current.\n`);
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
  return state;
}

export function readState(root) {
  const state = loadState(root);
  return {
    ...state,
    orchestrationBoard: loadBoard(root)
  };
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
  if (existingIndex >= 0) {
    sources.items[existingIndex] = { ...sources.items[existingIndex], ...source };
  } else {
    sources.items.push(source);
  }
  sources.updatedAt = nowIso();
  writeJson(root, ARTIFACT_PATHS.sources, sources);
  syncCitations(root, { preservePhase: true });
  const state = loadState(root);
  syncPhase(root, state, {
    stage: "sources",
    resumeCommand: "project:paper.research",
    role: "researcher"
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
  if (unknownSourceIds.length > 0) {
    throw new Error(`Note references unknown sources: ${unknownSourceIds.join(", ")}`);
  }
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
  if (existingIndex >= 0) {
    notes.items[existingIndex] = note;
  } else {
    notes.items.push(note);
  }
  notes.updatedAt = nowIso();
  writeJson(root, ARTIFACT_PATHS.notes, notes);

  const agenda = readJson(root, ARTIFACT_PATHS.researchAgenda, { version: 1, objective: loadState(root).paper.objective, agenda: [], evidenceBacklog: [], updatedAt: null });
  writeText(root, ARTIFACT_PATHS.queryPack, renderQueryPack(notes, sources, agenda));
  const state = loadState(root);
  syncPhase(root, state, {
    stage: "notes",
    resumeCommand: "project:paper.claim-gate",
    role: "researcher"
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
    paper: {
      ...state.paper,
      thesis: args.thesis ?? state.paper.thesis,
      audience: args.audience ?? state.paper.audience
    }
  }, {
    stage: "plan",
    resumeCommand: "project:paper.outline",
    role: "planner"
  });
  writeText(root, ARTIFACT_PATHS.plan, renderPlan(args, nextState, loadBoard(root)));
  return { planPath: ARTIFACT_PATHS.plan, thesis: nextState.paper.thesis };
}

export function upsertOutline(root, args = {}) {
  let state = loadState(root);
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 2, claims: [], updatedAt: null });
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
    role: "planner"
  });
  writeText(root, ARTIFACT_PATHS.outline, renderOutline(args, state, loadBoard(root)));
  return { outlinePath: ARTIFACT_PATHS.outline, sectionCount: Object.keys(state.sections).length };
}

export function upsertDraft(root, args = {}) {
  const sectionId = normalizeIdentifier(args.sectionId, "introduction");
  const state = loadState(root);
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 2, claims: [], updatedAt: null });
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
    role: "researcher"
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
    tasks: board.tasks.map((task) => {
      if (task.id !== sectionId && task.id !== `${sectionId}-draft`) {
        return task;
      }
      return {
        ...task,
        status: args.status === "ready" ? "done" : task.status,
        notes: args.summary ?? task.notes
      };
    })
  });
  return state.sections[sectionId];
}

export function syncChecklist(root) {
  const state = loadState(root);
  const board = loadBoard(root);
  const reviewState = readJson(root, ARTIFACT_PATHS.reviewState, { version: 1, history: [], openItems: [], lastVerdict: "not-reviewed", lastReviewedAt: null });
  const plans = readJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null });
  const results = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  const issues = readJson(root, ARTIFACT_PATHS.rebuttalIssues, { version: 1, items: [], updatedAt: null });
  const versions = readJson(root, ARTIFACT_PATHS.versionsIndex, { version: 1, currentVersionId: null, items: [], lineage: [], updatedAt: null });
  writeText(root, ARTIFACT_PATHS.checklist, renderChecklist(state, reviewState, board, plans, results, issues, versions));
  return { checklistPath: ARTIFACT_PATHS.checklist, openItemCount: reviewState.openItems.length };
}

export function upsertFigurePlan(root, args = {}) {
  const figures = readJson(root, ARTIFACT_PATHS.figuresIndex, { version: 1, items: [], updatedAt: null });
  figures.items = Array.isArray(args.items) ? args.items : [];
  figures.updatedAt = nowIso();
  writeJson(root, ARTIFACT_PATHS.figuresIndex, figures);
  const content = [
    "# Figures backlog",
    "",
    ...(figures.items.length > 0
      ? figures.items.flatMap((item) => [
          `## ${item.name ?? item.id ?? "Unnamed figure"}`,
          "",
          `- Purpose: ${item.purpose ?? "TBD"}`,
          `- Inputs: ${Array.isArray(item.inputs) ? item.inputs.join(", ") : (item.inputs ?? "TBD")}`,
          `- Owner: ${item.owner ?? "TBD"}`,
          `- Mode: ${item.mode ?? "manual"}`,
          `- Status: ${item.status ?? "planned"}`,
          ""
        ])
      : ["No figures planned yet."])
  ].join("\n");
  writeText(root, ARTIFACT_PATHS.figuresReadme, content);
  return { figureCount: figures.items.length };
}

export function syncCitations(root, args = {}) {
  ensureWorkspace(root);
  const sources = readJson(root, ARTIFACT_PATHS.sources, { version: 1, items: [], updatedAt: null });
  const citedKeys = new Set();
  for (const draftFile of listDraftFiles(root)) {
    const draftPath = `${ARTIFACT_PATHS.draftsDir}/${draftFile}`;
    const draftContent = readText(root, draftPath, "");
    for (const key of extractCitationKeysFromText(draftContent)) {
      citedKeys.add(key);
    }
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
    role: loadBoard(root).assignedRole
  } : {
    stage: "citations",
    resumeCommand: "project:paper.review-loop",
    role: "researcher"
  });
  return { sourceCount: sources.items.length, citedKeyCount: citedKeys.size, missingKeys };
}

export function refreshWiki(root) {
  ensureWorkspace(root);
  const state = loadState(root);
  const board = loadBoard(root);
  const notes = readJson(root, ARTIFACT_PATHS.notes, { version: 1, items: [], updatedAt: null });
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { version: 2, claims: [], updatedAt: null });
  const reviewState = readJson(root, ARTIFACT_PATHS.reviewState, { version: 1, history: [], openItems: [], lastVerdict: "not-reviewed", lastReviewedAt: null });
  const sources = readJson(root, ARTIFACT_PATHS.sources, { version: 1, items: [], updatedAt: null });
  const agenda = readJson(root, ARTIFACT_PATHS.researchAgenda, { version: 1, objective: state.paper.objective, agenda: [], evidenceBacklog: [], updatedAt: null });
  const plans = readJson(root, ARTIFACT_PATHS.experimentPlans, { version: 1, items: [], updatedAt: null });
  const results = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  const issues = readJson(root, ARTIFACT_PATHS.rebuttalIssues, { version: 1, items: [], updatedAt: null });
  const versions = readJson(root, ARTIFACT_PATHS.versionsIndex, { version: 1, currentVersionId: null, items: [], lineage: [], updatedAt: null });
  writeText(root, ARTIFACT_PATHS.wiki, renderWiki(state, board, notes, evidence, reviewState, sources, agenda, plans, results, issues, versions));
  writeText(root, ARTIFACT_PATHS.queryPack, renderQueryPack(notes, sources, agenda));
  syncPhase(root, state, {
    stage: board.currentPhase,
    resumeCommand: state.pipeline.resumeCommand,
    role: board.assignedRole
  });
  return { wikiPath: ARTIFACT_PATHS.wiki, noteCount: notes.items.length, claimCount: evidence.claims.length };
}

export function buildRebuttal(root) {
  ensureWorkspace(root);
  const reviewState = readJson(root, ARTIFACT_PATHS.reviewState, { version: 1, history: [], openItems: [], lastVerdict: "not-reviewed", lastReviewedAt: null });
  const claims = readJson(root, ARTIFACT_PATHS.evidence, { version: 2, claims: [], updatedAt: null });
  buildRebuttalStrategy(root);
  const draftPath = `${ARTIFACT_PATHS.draftsDir}/rebuttal.md`;
  writeText(root, draftPath, renderRebuttalDraft(
    reviewState,
    claims,
    ARTIFACT_PATHS.rebuttalIssues,
    ARTIFACT_PATHS.rebuttalStrategy,
    ARTIFACT_PATHS.rebuttalResponseDraft
  ));
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
    rebuttalIssueIds: readJson(root, ARTIFACT_PATHS.rebuttalIssues, { version: 1, items: [], updatedAt: null }).items.map((issue) => issue.id)
  });
  return { draftPath, openReviewItemCount: reviewState.openItems.length };
}

export function listWorkspaceArtifacts(root) {
  return listArtifacts(root);
}
