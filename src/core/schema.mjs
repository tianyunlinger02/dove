import crypto from "node:crypto";

export const SCHEMA_VERSION = 5;
export const PACKAGE_VERSION = "0.2.0";

export const DEFAULT_SECTION_ORDER = [
  ["abstract", "Abstract"],
  ["introduction", "Introduction"],
  ["related-work", "Related Work"],
  ["method", "Method"],
  ["experiments", "Experiments"],
  ["limitations", "Limitations"],
  ["conclusion", "Conclusion"],
  ["rebuttal", "Rebuttal Notes"]
];

export const PIPELINE_STAGE_ORDER = [
  "init",
  "sources",
  "notes",
  "research",
  "plan",
  "outline",
  "draft",
  "experiments",
  "citations",
  "review",
  "rebuttal",
  "versions",
  "checklist"
];

export const ROLE_IDS = [
  "planner",
  "researcher",
  "reviewer",
  "rebuttal-lead",
  "experiment-planner",
  "version-analyst"
];

export const ARTIFACT_PATHS = {
  paperRoot: ".paper",
  state: ".paper/state.json",
  readme: ".paper/README.md",
  project: ".paper/project.md",
  researchContract: ".paper/contracts/research-contract.md",
  orchestrationBoard: ".paper/orchestration/board.json",
  orchestrationHandoffs: ".paper/orchestration/handoffs.md",
  taskPacketsDir: ".paper/task-packets",
  taskPacketsPacketsDir: ".paper/task-packets/packets",
  taskPacketsIndex: ".paper/task-packets/index.json",
  roleContextsDir: ".paper/context/roles",
  phaseContextsDir: ".paper/context/phases",
  sessionJournal: ".paper/sessions/journal.json",
  sessionSummary: ".paper/sessions/LATEST_SUMMARY.md",
  workspaceDir: ".paper/workspace",
  workspaceIndex: ".paper/workspace/index.json",
  workflowPackDir: ".paper/workflow-pack",
  workflowBoundaries: ".paper/workflow-pack/boundaries.json",
  researchBrief: ".paper/research/brief.md",
  researchAgenda: ".paper/research/agenda.json",
  plan: ".paper/plans/current-plan.md",
  outline: ".paper/outline/current-outline.md",
  findings: ".paper/findings.md",
  experimentLog: ".paper/experiments/EXPERIMENT_LOG.md",
  experimentPlans: ".paper/experiments/plans.json",
  experimentResults: ".paper/experiments/results.json",
  experimentAudits: ".paper/experiments/audits.json",
  sources: ".paper/sources/index.json",
  notes: ".paper/notes/index.json",
  evidence: ".paper/evidence/index.json",
  claims: ".paper/claims/CLAIMS_FROM_RESULTS.md",
  claimBridgeLog: ".paper/claims/bridge-log.json",
  draftsDir: ".paper/drafts",
  reviewLog: ".paper/reviews/log.md",
  reviewState: ".paper/reviews/REVIEW_STATE.json",
  reviewConcerns: ".paper/reviews/concerns.json",
  reviewDebateLog: ".paper/reviews/debate-log.md",
  adversarialReviewState: ".paper/reviews/adversarial-state.json",
  revisionPlan: ".paper/revision-plans/current-plan.md",
  wiki: ".paper/wiki/index.md",
  queryPack: ".paper/wiki/query_pack.md",
  navigationReport: ".paper/wiki/navigation.md",
  wikiEntities: ".paper/wiki/entities.json",
  wikiRelations: ".paper/wiki/relations.json",
  checklist: ".paper/checklists/paper.md",
  bibliography: ".paper/bibliography/references.bib",
  citationLog: ".paper/bibliography/citation-log.md",
  figuresReadme: ".paper/figures/README.md",
  figuresIndex: ".paper/figures/index.json",
  figureBriefs: ".paper/figures/briefs.json",
  figureSegments: ".paper/figures/segments.json",
  figureTemplates: ".paper/figures/templates.json",
  figureEditableIndex: ".paper/figures/editable-index.json",
  rebuttalIssues: ".paper/rebuttal/issues.json",
  rebuttalStrategy: ".paper/rebuttal/strategy.md",
  rebuttalResponseDraft: ".paper/rebuttal/response-draft.md",
  versionsIndex: ".paper/versions/index.json",
  versionComparisons: ".paper/versions/comparisons.json",
  versionComparisonReport: ".paper/versions/LATEST_COMPARISON.md",
  versionSnapshotsDir: ".paper/versions/snapshots"
};

function digestText(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function createManagedArtifactMeta(kind, relativePath) {
  const seed = JSON.stringify({ kind, relativePath, schema: SCHEMA_VERSION, pack: PACKAGE_VERSION });
  return {
    revisionId: `schema-v${SCHEMA_VERSION}:${kind}`,
    templateHash: digestText(seed),
    generatedByVersion: PACKAGE_VERSION,
    managedKind: kind,
    path: relativePath
  };
}

export function createContinuationState(overrides = {}) {
  return {
    status: "ready-to-resume",
    lastCheckpoint: "Workspace bootstrapped.",
    checkpointHistory: [],
    updatedAt: null,
    ...overrides,
    checkpointHistory: Array.isArray(overrides.checkpointHistory) ? overrides.checkpointHistory : []
  };
}

function defaultSections() {
  return Object.fromEntries(
    DEFAULT_SECTION_ORDER.map(([id, title]) => [
      id,
      {
        id,
        title,
        status: "planned",
        summary: "",
        draftPath: `.paper/drafts/${id}.md`,
        claimIds: []
      }
    ])
  );
}

function defaultRoleRoster() {
  return [
    {
      id: "planner",
      label: "Planner",
      charter: "Keeps the board current, sequences work, and maintains plan/review gates."
    },
    {
      id: "researcher",
      label: "Researcher",
      charter: "Expands sources, notes, claims, and durable research briefs."
    },
    {
      id: "reviewer",
      label: "Reviewer",
      charter: "Runs evidence-aware review and records blockers or revision items."
    },
    {
      id: "rebuttal-lead",
      label: "Rebuttal Lead",
      charter: "Normalizes reviewer issues, writes strategy, and keeps responses factual."
    },
    {
      id: "experiment-planner",
      label: "Experiment Planner",
      charter: "Defines claim-driven experiments and tracks results-to-claim closure."
    },
    {
      id: "version-analyst",
      label: "Version Analyst",
      charter: "Snapshots versions, tracks lineage, and compares changes honestly."
    }
  ];
}

export function createDefaultBoard(stateOverrides = {}) {
  const objective = stateOverrides.paper?.objective ?? "Capture the paper's goal and contribution.";
  const phase = stateOverrides.pipeline?.currentStage ?? "init";
  return {
    version: 2,
    paperObjective: objective,
    currentPhase: phase,
    intentType: "plan",
    assignedRole: "planner",
    currentFocus: "Align the board and choose the next durable step.",
    nextAction: "Run project:paper.orchestrate and record the next role-owned task.",
    continuationState: createContinuationState(),
    reviewRequiredBeforeFinalize: false,
    tasks: [],
    blockers: [],
    evidenceLinks: [],
    experimentIds: [],
    rebuttalIssueIds: [],
    unresolvedBlockersByRole: {},
    versionLineage: {
      currentVersionId: null,
      parentVersionId: null,
      snapshotIds: []
    },
    activeComparisonTargets: [],
    roleRoster: defaultRoleRoster(),
    updatedAt: new Date(0).toISOString()
  };
}

export function createDefaultState(overrides = {}) {
  const base = {
    version: SCHEMA_VERSION,
    paper: {
      title: "Untitled Paper",
      venue: "Unspecified",
      objective: "Capture the paper's goal and contribution.",
      deadline: "",
      thesis: "Describe the paper's core claim in one sentence.",
      audience: "TBD"
    },
    pipeline: {
      currentStage: "init",
      lastCompletedStage: null,
      resumeCommand: "project:paper.orchestrate",
      updatedAt: new Date(0).toISOString()
    },
    orchestration: {
      boardPath: ARTIFACT_PATHS.orchestrationBoard,
      handoffPath: ARTIFACT_PATHS.orchestrationHandoffs,
      phase: "init",
      intentType: "plan",
      assignedRole: "planner",
      currentFocus: "Align the board and choose the next durable step.",
      nextAction: "Run project:paper.orchestrate and record the next role-owned task.",
      continuationState: createContinuationState(),
      reviewRequiredBeforeFinalize: false,
      activeTaskIds: [],
      blockerIds: [],
      evidenceLinks: [],
      experimentIds: [],
      rebuttalIssueIds: [],
      currentVersionId: null,
      activeComparisonTargets: []
    },
    sections: defaultSections(),
    artifacts: {
      ...ARTIFACT_PATHS
    },
    reviews: {
      lastVerdict: "not-reviewed",
      lastReviewedAt: null,
      openItems: [],
      unresolvedConcernIds: []
    },
    settings: {
      strictMode: false
    }
  };

  return {
    ...base,
    ...overrides,
    paper: {
      ...base.paper,
      ...(overrides.paper ?? {})
    },
    pipeline: {
      ...base.pipeline,
      ...(overrides.pipeline ?? {})
    },
    orchestration: normalizeOrchestration(overrides.orchestration, base.orchestration),
    sections: normalizeSections(overrides.sections),
    artifacts: {
      ...ARTIFACT_PATHS,
      ...(overrides.artifacts ?? {})
    },
    reviews: {
      ...base.reviews,
      ...(overrides.reviews ?? {}),
      openItems: Array.isArray(overrides.reviews?.openItems) ? overrides.reviews.openItems : [],
      unresolvedConcernIds: Array.isArray(overrides.reviews?.unresolvedConcernIds) ? overrides.reviews.unresolvedConcernIds : []
    },
    settings: {
      ...base.settings,
      ...(overrides.settings ?? {})
    }
  };
}

export function normalizeSections(rawSections) {
  const merged = defaultSections();
  if (!rawSections || typeof rawSections !== "object") {
    return merged;
  }

  for (const [id, section] of Object.entries(rawSections)) {
    merged[id] = {
      ...(merged[id] ?? {
        id,
        title: id,
        status: "planned",
        summary: "",
        draftPath: `.paper/drafts/${id}.md`,
        claimIds: []
      }),
      ...section,
      id,
      draftPath: section?.draftPath ?? `.paper/drafts/${id}.md`,
      claimIds: Array.isArray(section?.claimIds) ? section.claimIds : []
    };
  }

  return merged;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeContinuation(value) {
  if (!value || typeof value !== "object") {
    return createContinuationState();
  }
  return createContinuationState(value);
}

function normalizeOrchestration(raw = {}, defaults = {}) {
  return {
    ...defaults,
    ...raw,
    continuationState: normalizeContinuation(raw.continuationState ?? defaults.continuationState),
    activeTaskIds: normalizeArray(raw.activeTaskIds),
    blockerIds: normalizeArray(raw.blockerIds),
    evidenceLinks: normalizeArray(raw.evidenceLinks),
    experimentIds: normalizeArray(raw.experimentIds),
    rebuttalIssueIds: normalizeArray(raw.rebuttalIssueIds),
    activeComparisonTargets: normalizeArray(raw.activeComparisonTargets)
  };
}

export function normalizeState(raw = {}) {
  if (!raw || typeof raw !== "object") {
    return createDefaultState();
  }

  if (raw.version === 1) {
    return createDefaultState({
      paper: {
        title: raw.projectTitle ?? "Untitled Paper",
        venue: raw.venue ?? "Unspecified",
        objective: raw.objective ?? "Capture the paper's goal and contribution.",
        deadline: raw.deadline ?? "",
        thesis: "Describe the paper's core claim in one sentence.",
        audience: "TBD"
      },
      pipeline: {
        currentStage: raw.currentPhase ?? "init",
        lastCompletedStage: null,
        resumeCommand: "project:paper.orchestrate",
        updatedAt: raw.updatedAt ?? new Date(0).toISOString()
      },
      orchestration: {
        phase: raw.currentPhase ?? "init"
      }
    });
  }

  if (raw.version === 2) {
    return createDefaultState({
      ...raw,
      version: SCHEMA_VERSION,
      orchestration: {
        phase: raw.pipeline?.currentStage ?? "init",
        assignedRole: raw.pipeline?.currentStage === "review" ? "reviewer" : "planner",
        activeTaskIds: [],
        blockerIds: [],
        evidenceLinks: [],
        experimentIds: [],
        rebuttalIssueIds: [],
        currentVersionId: null,
        activeComparisonTargets: []
      },
      pipeline: {
        ...(raw.pipeline ?? {}),
        resumeCommand: raw.pipeline?.resumeCommand ?? "project:paper.orchestrate"
      }
    });
  }

  const defaults = createDefaultState();
  return {
    ...defaults,
    ...raw,
    version: SCHEMA_VERSION,
    paper: {
      ...defaults.paper,
      ...(raw.paper ?? {})
    },
    pipeline: {
      ...defaults.pipeline,
      ...(raw.pipeline ?? {})
    },
    orchestration: normalizeOrchestration(raw.orchestration, defaults.orchestration),
    sections: normalizeSections(raw.sections),
    artifacts: {
      ...ARTIFACT_PATHS,
      ...(raw.artifacts ?? {})
    },
    reviews: {
      ...defaults.reviews,
      ...(raw.reviews ?? {}),
      openItems: Array.isArray(raw.reviews?.openItems) ? raw.reviews.openItems : [],
      unresolvedConcernIds: Array.isArray(raw.reviews?.unresolvedConcernIds) ? raw.reviews.unresolvedConcernIds : []
    },
    settings: {
      ...defaults.settings,
      ...(raw.settings ?? {})
    }
  };
}

export function createSourcesIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createNotesIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createEvidenceIndex() {
  return { version: 3, claims: [], updatedAt: null };
}

export function createTaskPacketsIndex() {
  return { version: 2, items: [], updatedAt: null };
}

export function createReviewState() {
  return {
    version: 2,
    lastVerdict: "not-reviewed",
    lastReviewedAt: null,
    history: [],
    openItems: [],
    unresolvedConcernIds: []
  };
}

export function createReviewConcernsIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createAdversarialReviewState() {
  return {
    version: 1,
    round: 0,
    unresolvedConcernIds: [],
    lastAuditIds: [],
    lastBridgeIds: [],
    updatedAt: null
  };
}

export function createFiguresIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createFigureBriefsIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createFigureSegmentsIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createFigureTemplatesIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createFigureEditableIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createResearchAgenda() {
  return {
    version: 1,
    objective: "Capture the paper's goal and contribution.",
    agenda: [],
    evidenceBacklog: [],
    updatedAt: null
  };
}

export function createSessionJournal() {
  return { version: 1, entries: [], updatedAt: null };
}

export function createExperimentPlansIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createExperimentResultsIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createExperimentAuditsIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createClaimBridgeLog() {
  return { version: 1, items: [], updatedAt: null };
}

export function createRebuttalIssuesIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createVersionsIndex() {
  return {
    version: 1,
    currentVersionId: null,
    items: [],
    lineage: [],
    updatedAt: null
  };
}

export function createVersionComparisonsIndex() {
  return { version: 1, items: [], activeTargets: [], updatedAt: null };
}

export function createWikiEntitiesIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createWikiRelationsIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createWorkspaceIndex() {
  return {
    version: 1,
    managed: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workspaceIndex),
    activePackets: [],
    activeRoles: [],
    unresolvedConcernIds: [],
    mostRecentSessions: [],
    latestVersions: {
      currentVersionId: null,
      activeTargets: []
    },
    updatedAt: null
  };
}

export function createWorkflowBoundaries() {
  const paperBootstrapOnlyPaths = [
    ".paper/README.md",
    ".paper/project.md",
    ".paper/contracts/research-contract.md",
    ".paper/orchestration/board.json",
    ".paper/orchestration/handoffs.md",
    ".paper/task-packets/index.json",
    ".paper/research/brief.md",
    ".paper/research/agenda.json",
    ".paper/plans/current-plan.md",
    ".paper/outline/current-outline.md",
    ".paper/findings.md",
    ".paper/experiments/EXPERIMENT_LOG.md",
    ".paper/experiments/plans.json",
    ".paper/experiments/results.json",
    ".paper/experiments/audits.json",
    ".paper/sources/index.json",
    ".paper/notes/index.json",
    ".paper/evidence/index.json",
    ".paper/claims/CLAIMS_FROM_RESULTS.md",
    ".paper/claims/bridge-log.json",
    ".paper/reviews/log.md",
    ".paper/reviews/REVIEW_STATE.json",
    ".paper/reviews/concerns.json",
    ".paper/reviews/debate-log.md",
    ".paper/reviews/adversarial-state.json",
    ".paper/revision-plans/current-plan.md",
    ".paper/wiki/index.md",
    ".paper/wiki/query_pack.md",
    ".paper/wiki/navigation.md",
    ".paper/wiki/entities.json",
    ".paper/wiki/relations.json",
    ".paper/checklists/paper.md",
    ".paper/bibliography/references.bib",
    ".paper/bibliography/citation-log.md",
    ".paper/figures/README.md",
    ".paper/figures/index.json",
    ".paper/figures/briefs.json",
    ".paper/figures/segments.json",
    ".paper/figures/templates.json",
    ".paper/figures/editable-index.json",
    ".paper/rebuttal/issues.json",
    ".paper/rebuttal/strategy.md",
    ".paper/rebuttal/response-draft.md",
    ".paper/versions/index.json",
    ".paper/versions/comparisons.json",
    ".paper/versions/LATEST_COMPARISON.md",
    ".paper/sessions/journal.json",
    ".paper/sessions/LATEST_SUMMARY.md",
    ".paper/workspace/index.json",
    ".paper/workflow-pack/boundaries.json"
  ];
  return {
    version: 2,
    managedPaths: [
      ".opencode",
      ".opencode.json",
      "README.md",
      "bin",
      "docs",
      "mcp",
      "scripts",
      "src"
    ],
    paperBootstrapOnlyPaths,
    userOwnedPaths: [
      ".paper/drafts",
      ".paper/sources",
      ".paper/notes",
      ".paper/evidence",
      ".paper/experiments",
      ".paper/reviews",
      ".paper/rebuttal",
      ".paper/versions/snapshots",
      ".paper/task-packets/packets",
      ".paper/context/roles",
      ".paper/context/phases",
      ".paper/sessions"
    ],
    managedArtifacts: {
      codePack: createManagedArtifactMeta("managed-replaceable", "src"),
      workflowBoundaries: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workflowBoundaries),
      workspaceIndex: createManagedArtifactMeta("bootstrap-only", ARTIFACT_PATHS.workspaceIndex)
    },
    notes: [
      "Pack installs and syncs should bootstrap missing .paper artifacts but should not overwrite user-authored workspace state.",
      ".paper remains the durable source of truth and is treated as workspace data, not a managed code payload.",
      "Managed replaceable code and bootstrap-only workspace artifacts now advertise revision/template metadata for clearer reconciliation."
    ],
    updatedAt: null
  };
}
