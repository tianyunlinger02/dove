export const SCHEMA_VERSION = 3;

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
  researchBrief: ".paper/research/brief.md",
  researchAgenda: ".paper/research/agenda.json",
  plan: ".paper/plans/current-plan.md",
  outline: ".paper/outline/current-outline.md",
  findings: ".paper/findings.md",
  experimentLog: ".paper/experiments/EXPERIMENT_LOG.md",
  experimentPlans: ".paper/experiments/plans.json",
  experimentResults: ".paper/experiments/results.json",
  sources: ".paper/sources/index.json",
  notes: ".paper/notes/index.json",
  evidence: ".paper/evidence/index.json",
  claims: ".paper/claims/CLAIMS_FROM_RESULTS.md",
  draftsDir: ".paper/drafts",
  reviewLog: ".paper/reviews/log.md",
  reviewState: ".paper/reviews/REVIEW_STATE.json",
  revisionPlan: ".paper/revision-plans/current-plan.md",
  wiki: ".paper/wiki/index.md",
  queryPack: ".paper/wiki/query_pack.md",
  checklist: ".paper/checklists/paper.md",
  bibliography: ".paper/bibliography/references.bib",
  citationLog: ".paper/bibliography/citation-log.md",
  figuresReadme: ".paper/figures/README.md",
  figuresIndex: ".paper/figures/index.json",
  rebuttalIssues: ".paper/rebuttal/issues.json",
  rebuttalStrategy: ".paper/rebuttal/strategy.md",
  rebuttalResponseDraft: ".paper/rebuttal/response-draft.md",
  versionsIndex: ".paper/versions/index.json",
  versionComparisons: ".paper/versions/comparisons.json",
  versionComparisonReport: ".paper/versions/LATEST_COMPARISON.md",
  versionSnapshotsDir: ".paper/versions/snapshots"
};

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
    version: 1,
    paperObjective: objective,
    currentPhase: phase,
    assignedRole: "planner",
    tasks: [],
    blockers: [],
    evidenceLinks: [],
    experimentIds: [],
    rebuttalIssueIds: [],
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
      assignedRole: "planner",
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
      openItems: []
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
    orchestration: {
      ...base.orchestration,
      ...(overrides.orchestration ?? {})
    },
    sections: normalizeSections(overrides.sections),
    artifacts: {
      ...ARTIFACT_PATHS,
      ...(overrides.artifacts ?? {})
    },
    reviews: {
      ...base.reviews,
      ...(overrides.reviews ?? {}),
      openItems: Array.isArray(overrides.reviews?.openItems) ? overrides.reviews.openItems : []
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

function normalizeOrchestration(raw = {}, defaults = createDefaultState().orchestration) {
  return {
    ...defaults,
    ...raw,
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
      openItems: Array.isArray(raw.reviews?.openItems) ? raw.reviews.openItems : []
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
  return { version: 2, claims: [], updatedAt: null };
}

export function createReviewState() {
  return { version: 1, lastVerdict: "not-reviewed", lastReviewedAt: null, history: [], openItems: [] };
}

export function createFiguresIndex() {
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

export function createExperimentPlansIndex() {
  return { version: 1, items: [], updatedAt: null };
}

export function createExperimentResultsIndex() {
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
