import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  GOVERNANCE_EXEMPT_MUTATIONS,
  GOVERNANCE_GUARDED_MUTATIONS,
  createAdversarialReviewState,
  createClaimBridgeLog,
    createDefaultBoard,
    createDefaultState,
    createEvidenceIndex,
    createExperimentAuditsIndex,
    createExperimentPlansIndex,
    createExperimentResultsIndex,
  createFigureBriefsIndex,
  createFigureEditableIndex,
  createFigureFinalIndex,
  createFigureQaIndex,
  createFigureSegmentsIndex,
  createFigureTemplatesIndex,
  createFiguresIndex,
  createMetaEventsIndex,
  createMetaExecutionBridgeCandidatesIndex,
  createMetaGovernanceCoverageIndex,
  createMetaGovernanceCoverageReport,
  createMetaLongHorizonMemory,
  createMetaOperatorFollowThroughIndex,
  createMetaOperatorFollowThroughTransitionsIndex,
  createMetaOperatorPlaybooksIndex,
  createMetaRemediationPacksIndex,
  createMetaOptimizerState,
  createMetaRecommendationsIndex,
  createCampaignsIndex,
  createProgramApprovalsIndex,
  createProgramsIndex,
  createProgramRunsIndex,
  createNotesIndex,
  createResearchAgenda,
  createReviewConcernsIndex,
  createReviewState,
  createRebuttalIssuesIndex,
  createRuntimeControllerState,
  createRuntimeContinuationIndex,
  createRuntimeEventsIndex,
  createRuntimeLeasesIndex,
  createRuntimeResultsIndex,
  createSessionJournal,
  createSourcesIndex,
  createTaskPacketsIndex,
  createVersionComparisonsIndex,
  createVersionsIndex,
  createWikiEntitiesIndex,
  createWikiRelationsIndex,
  createWorkflowBoundaries,
  createWorkspaceIndex,
  normalizeMetaExecutionBridgeCandidatesIndex,
  normalizeMetaGovernanceCoverageIndex,
  normalizeMetaGovernanceCoverageReport,
  normalizeMetaLongHorizonMemory,
  normalizeMetaOperatorFollowThroughIndex,
  normalizeMetaOperatorFollowThroughTransitionsIndex,
  normalizeMetaOperatorPlaybooksIndex,
  normalizeMetaRemediationPacksIndex,
  normalizeMetaOptimizerState,
  normalizeMetaRecommendationsIndex,
  normalizeCampaignsIndex,
  normalizeProgramApprovalsIndex,
  normalizeProgramsIndex,
  normalizeProgramRunsIndex,
  normalizeRuntimeControllerState,
  normalizeRuntimeContinuationIndex,
  normalizeRuntimeEventsIndex,
  normalizeRuntimeLeasesIndex,
  normalizeRuntimeResultsIndex,
  normalizeWorkflowBoundaries,
  normalizeWorkspaceIndex,
  normalizeState
} from "./schema.mjs";

function normalizeStringArrayLocal(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

const WORKFLOW_BOUNDARIES = createWorkflowBoundaries();

function isBootstrapManagedPaperPath(relativePath) {
  return relativePath === ARTIFACT_PATHS.state || WORKFLOW_BOUNDARIES.paperBootstrapOnlyPaths.includes(relativePath);
}

export function nowIso() {
  return new Date().toISOString();
}

export function resolvePath(root, relativePath) {
  return path.join(root, relativePath);
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cloneFallback(fallback) {
  return typeof fallback === "function" ? fallback() : structuredClone(fallback);
}

function repairMalformedJson(root, relativePath, fallback) {
  const fullPath = resolvePath(root, relativePath);
  const backupPath = `${fullPath}.broken-${Date.now()}`;
  const recovered = cloneFallback(fallback);

  ensureDir(path.dirname(fullPath));
  if (fs.existsSync(fullPath)) {
    fs.copyFileSync(fullPath, backupPath);
  }
  writeJson(root, relativePath, recovered);
  return recovered;
}

export function readJson(root, relativePath, fallback) {
  const fullPath = resolvePath(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    return cloneFallback(fallback);
  }
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    return repairMalformedJson(root, relativePath, fallback);
  }
}

export function writeJson(root, relativePath, value) {
  const fullPath = resolvePath(root, relativePath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonIfChanged(root, relativePath, value) {
  const fullPath = resolvePath(root, relativePath);
  const nextContent = `${JSON.stringify(value, null, 2)}\n`;
  ensureDir(path.dirname(fullPath));
  if (fs.existsSync(fullPath) && fs.readFileSync(fullPath, "utf8") === nextContent) {
    return false;
  }
  fs.writeFileSync(fullPath, nextContent, "utf8");
  return true;
}

function reconcileManagedJsonArtifact(root, relativePath, fallback, normalize) {
  const normalized = normalize(readJson(root, relativePath, fallback));
  writeJsonIfChanged(root, relativePath, normalized);
  return normalized;
}

export function readText(root, relativePath, fallback = "") {
  const fullPath = resolvePath(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    return fallback;
  }
  return fs.readFileSync(fullPath, "utf8");
}

export function writeText(root, relativePath, content) {
  const fullPath = resolvePath(root, relativePath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content, "utf8");
}

export function appendText(root, relativePath, content) {
  const fullPath = resolvePath(root, relativePath);
  ensureDir(path.dirname(fullPath));
  fs.appendFileSync(fullPath, content, "utf8");
}

function ensureFile(root, relativePath, content) {
  const fullPath = resolvePath(root, relativePath);
  ensureDir(path.dirname(fullPath));
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, content, "utf8");
    return true;
  }
  return false;
}

function starterMarkdown(state) {
  return {
    [ARTIFACT_PATHS.readme]: `# .paper workspace\n\nThis directory is the durable source of truth for paper_factory.\n\n- Commands, skills, and MCP should converge on these files.\n- The orchestration board in \\.paper/orchestration/ is the canonical work tracker.\n- Durable task packets, role manifests, and session summaries should stay inside \\.paper/.\n- Research, experiments, rebuttal, and version evolution should remain file-first and resumable.\n- Phase-2 integrity artifacts make intent, continuation, review, and result-to-claim transitions auditable.\n`,
    [ARTIFACT_PATHS.project]: `# Project brief\n\n- Working title: ${state.paper.title}\n- Venue: ${state.paper.venue}\n- Objective: ${state.paper.objective}\n- Deadline: ${state.paper.deadline || "TBD"}\n\n## Thesis\n\n${state.paper.thesis}\n\n## Audience\n\n${state.paper.audience}\n`,
    [ARTIFACT_PATHS.researchContract]: `# Research contract\n\n## Scope\n\n- Title: ${state.paper.title}\n- Venue: ${state.paper.venue}\n- Objective: ${state.paper.objective}\n\n## Evidence policy\n\n- No citation from memory.\n- Every major claim should map to a source, note, experiment, or clearly marked gap.\n- Review findings and rebuttal issues must become durable action items.\n- Finalization claims require an explicit verification pass.\n`,
    [ARTIFACT_PATHS.researchBrief]: `# Research brief\n\n## Objective\n\n${state.paper.objective}\n\n## Agenda\n\n- Clarify the paper objective and contribution.\n- Expand the evidence base before making strong claims.\n\n## Comparison targets\n\n- Add active comparison targets here before evaluation.\n`,
    [ARTIFACT_PATHS.plan]: `# Current paper plan\n\n## One-sentence thesis\n\n${state.paper.thesis}\n\n## Planned sections\n\n${Object.values(state.sections).map((section) => `- [ ] ${section.title}`).join("\n")}\n\n## Immediate next step\n\nRun \`project:paper.orchestrate\` to align the board and assign the next role.\n`,
    [ARTIFACT_PATHS.outline]: `# Current outline\n\n${Object.values(state.sections).map((section) => `## ${section.title}\n\n- Goal: TBD\n- Evidence: TBD\n`).join("\n")}`,
    [ARTIFACT_PATHS.findings]: `# Findings\n\nCapture key empirical or analytical takeaways here before turning them into claims.\n`,
    [ARTIFACT_PATHS.claims]: `# Claims from results\n\nList only claims that can be traced to sources, notes, or experiments.\n`,
    [ARTIFACT_PATHS.experimentLog]: `# Experiment log\n\nDocument planned runs, settings, outcomes, and failure cases here.\n`,
    [ARTIFACT_PATHS.orchestrationHandoffs]: `# Handoffs\n\n## 1970-01-01T00:00:00.000Z — planner -> researcher\n\n- Phase: init\n- Intent: plan\n- Summary: Workspace initialized.\n- Current focus: Clarify the paper objective.\n- Next action: Register core sources.\n- Next actions:\n  - Register core sources.\n  - Create the first research brief.\n- Evidence links: none\n- Blockers: none\n`,
    [ARTIFACT_PATHS.reviewLog]: `# Review log\n\nThis file is append-only.\n\n## 1970-01-01T00:00:00.000Z — bootstrap\n\n- Scope: workspace initialization\n- Verdict: not-reviewed\n- Summary: Starter review log created.\n- Action items:\n  - Build the source and note base before drafting.\n`,
    [ARTIFACT_PATHS.reviewDebateLog]: `# Debate log\n\nUse this file to capture adversarial review rounds, rebuttals, and rulings in durable prose.\n`,
    [ARTIFACT_PATHS.revisionPlan]: `# Current revision plan\n\nNo review loop has generated a revision plan yet.\n`,
    [ARTIFACT_PATHS.wiki]: `# Paper wiki\n\n## Thesis\n\n${state.paper.thesis}\n\n## Evidence inventory\n\n- TBD\n\n## Reviewer concerns\n\n- TBD\n\n## Version lineage\n\n- No snapshots yet.\n`,
    [ARTIFACT_PATHS.queryPack]: `# Query pack\n\n- What evidence is still missing?\n- Which claims are weakly supported?\n- Which experiments need to be run before drafting stronger conclusions?\n- Which rebuttal issues remain unresolved?\n`,
    [ARTIFACT_PATHS.navigationReport]: `# Navigation\n\n## Task graph\n\n- No task packets generated yet.\n\n## Open questions\n\n- No open questions recorded yet.\n\n## Decisions\n\n- No durable decisions recorded yet.\n\n## Lineage\n\n- No durable lineage summary recorded yet.\n`,
    [ARTIFACT_PATHS.checklist]: `# Paper checklist\n\n## Orchestration\n\n- [ ] Keep \.paper/orchestration/board.json current\n- [ ] Append a handoff after each major role transition\n\n## Research\n\n- [ ] Register the core sources in .paper/sources/index.json\n- [ ] Capture structured notes in .paper/notes/index.json\n- [ ] Maintain the research brief and agenda\n\n## Drafting\n\n- [ ] Create the first outline in .paper/outline/current-outline.md\n- [ ] Create at least one section draft in .paper/drafts/\n\n## Experiments, review, and rebuttal\n\n- [ ] Create claim-driven experiment plans and record results\n- [ ] Run project:paper.review-loop\n- [ ] Normalize rebuttal issues and draft a strategy\n\n## Versioning\n\n- [ ] Snapshot a paper version before major revisions\n- [ ] Compare versions when claims or conclusions move\n`,
    [ARTIFACT_PATHS.bibliography]: "",
    [ARTIFACT_PATHS.citationLog]: `# Citation log\n\nTrack registration and verification status for sources here.\n`,
    [ARTIFACT_PATHS.figuresReadme]: `# Figures backlog\n\nUse this directory for figure/table planning artifacts. This package records durable figure briefs, segmentation placeholders, template plans, and editable-contract paths, but it does not claim to ship a render backend.\n`,
    [ARTIFACT_PATHS.rebuttalStrategy]: `# Rebuttal strategy\n\nNo issue strategy has been generated yet.\n`,
    [ARTIFACT_PATHS.rebuttalResponseDraft]: `# Rebuttal response draft\n\nDraft concise, evidence-backed responses here after normalizing reviewer issues.\n`,
    [ARTIFACT_PATHS.versionComparisonReport]: `# Latest version comparison\n\nNo comparison has been generated yet.\n`,
    [ARTIFACT_PATHS.metaOptimizerReport]: `# Latest optimizer report\n\n- Proposal only: true\n- No meta-optimization recommendations have been generated yet.\n`,
    [ARTIFACT_PATHS.sessionSummary]: `# Latest session summary\n\n- No durable session summary has been generated yet.\n`,
    [path.join(ARTIFACT_PATHS.draftsDir, "README.md")]: `# Drafts\n\nStore one section per markdown file.\n`,
    [path.join(ARTIFACT_PATHS.claims.replace("CLAIMS_FROM_RESULTS.md", "README.md"))]: `# Claims\n\nThis directory holds evidence-grounded claim artifacts.\n`
  };
}

export function ensureWorkspace(root) {
  const state = normalizeState(readJson(root, ARTIFACT_PATHS.state, createDefaultState));

  const created = [];
  for (const relativeDir of [
    ARTIFACT_PATHS.paperRoot,
    ".paper/contracts",
    ".paper/orchestration",
    ARTIFACT_PATHS.taskPacketsDir,
    ARTIFACT_PATHS.taskPacketsPacketsDir,
     ".paper/context",
     ARTIFACT_PATHS.roleContextsDir,
     ARTIFACT_PATHS.phaseContextsDir,
     ARTIFACT_PATHS.packetContextsDir,
     ARTIFACT_PATHS.artifactContextsDir,
     ARTIFACT_PATHS.actionContextsDir,
      ".paper/sessions",
    ARTIFACT_PATHS.workspaceDir,
    ARTIFACT_PATHS.programsDir,
    ARTIFACT_PATHS.workflowPackDir,
    ".paper/research",
    ".paper/plans",
    ".paper/outline",
    ".paper/sources",
    ".paper/notes",
    ".paper/evidence",
    ".paper/claims",
    ".paper/drafts",
    ".paper/experiments",
    ".paper/reviews",
    ".paper/revision-plans",
    ".paper/wiki",
    ".paper/checklists",
    ".paper/bibliography",
    ".paper/figures",
    ".paper/rebuttal",
    ".paper/versions",
    ARTIFACT_PATHS.runtimeDir,
    ARTIFACT_PATHS.metaDir,
    ARTIFACT_PATHS.versionSnapshotsDir
  ]) {
    ensureDir(resolvePath(root, relativeDir));
  }

  if (!fs.existsSync(resolvePath(root, ARTIFACT_PATHS.state))) {
    writeJson(root, ARTIFACT_PATHS.state, state);
    created.push(ARTIFACT_PATHS.state);
  }

  for (const [relativePath, content] of Object.entries(starterMarkdown(state))) {
    if (isBootstrapManagedPaperPath(relativePath) && ensureFile(root, relativePath, content)) {
      created.push(relativePath);
    }
  }

  for (const [relativePath, factory] of [
    [ARTIFACT_PATHS.orchestrationBoard, () => createDefaultBoard(state)],
    [ARTIFACT_PATHS.sources, createSourcesIndex],
    [ARTIFACT_PATHS.notes, createNotesIndex],
    [ARTIFACT_PATHS.evidence, createEvidenceIndex],
    [ARTIFACT_PATHS.taskPacketsIndex, createTaskPacketsIndex],
    [ARTIFACT_PATHS.reviewState, createReviewState],
    [ARTIFACT_PATHS.reviewConcerns, createReviewConcernsIndex],
    [ARTIFACT_PATHS.adversarialReviewState, createAdversarialReviewState],
    [ARTIFACT_PATHS.figuresIndex, createFiguresIndex],
    [ARTIFACT_PATHS.figureBriefs, createFigureBriefsIndex],
    [ARTIFACT_PATHS.figureSegments, createFigureSegmentsIndex],
    [ARTIFACT_PATHS.figureTemplates, createFigureTemplatesIndex],
    [ARTIFACT_PATHS.figureEditableIndex, createFigureEditableIndex],
    [ARTIFACT_PATHS.figureFinalIndex, createFigureFinalIndex],
    [ARTIFACT_PATHS.figureQa, createFigureQaIndex],
    [ARTIFACT_PATHS.researchAgenda, createResearchAgenda],
    [ARTIFACT_PATHS.experimentPlans, createExperimentPlansIndex],
    [ARTIFACT_PATHS.experimentResults, createExperimentResultsIndex],
    [ARTIFACT_PATHS.experimentAudits, createExperimentAuditsIndex],
    [ARTIFACT_PATHS.claimBridgeLog, createClaimBridgeLog],
    [ARTIFACT_PATHS.metaEvents, createMetaEventsIndex],
    [ARTIFACT_PATHS.metaExecutionBridgeCandidates, createMetaExecutionBridgeCandidatesIndex],
    [ARTIFACT_PATHS.metaGovernanceCoverage, createMetaGovernanceCoverageIndex],
    [ARTIFACT_PATHS.metaGovernanceCoverageReport, createMetaGovernanceCoverageReport],
    [ARTIFACT_PATHS.metaLongHorizonMemory, createMetaLongHorizonMemory],
    [ARTIFACT_PATHS.metaOperatorFollowThrough, createMetaOperatorFollowThroughIndex],
    [ARTIFACT_PATHS.metaOperatorFollowThroughTransitions, createMetaOperatorFollowThroughTransitionsIndex],
    [ARTIFACT_PATHS.metaOperatorPlaybooks, createMetaOperatorPlaybooksIndex],
    [ARTIFACT_PATHS.metaRemediationPacks, createMetaRemediationPacksIndex],
    [ARTIFACT_PATHS.metaRecommendations, createMetaRecommendationsIndex],
    [ARTIFACT_PATHS.metaOptimizerState, createMetaOptimizerState],
    [ARTIFACT_PATHS.rebuttalIssues, createRebuttalIssuesIndex],
    [ARTIFACT_PATHS.versionsIndex, createVersionsIndex],
    [ARTIFACT_PATHS.versionComparisons, createVersionComparisonsIndex],
    [ARTIFACT_PATHS.wikiEntities, createWikiEntitiesIndex],
    [ARTIFACT_PATHS.wikiRelations, createWikiRelationsIndex],
    [ARTIFACT_PATHS.sessionJournal, createSessionJournal],
    [ARTIFACT_PATHS.runtimeControllerState, createRuntimeControllerState],
    [ARTIFACT_PATHS.runtimeContinuation, createRuntimeContinuationIndex],
    [ARTIFACT_PATHS.runtimeLeases, createRuntimeLeasesIndex],
    [ARTIFACT_PATHS.runtimeEvents, createRuntimeEventsIndex],
    [ARTIFACT_PATHS.runtimeResults, createRuntimeResultsIndex],
    [ARTIFACT_PATHS.programsIndex, createProgramsIndex],
    [ARTIFACT_PATHS.programRuns, createProgramRunsIndex],
    [ARTIFACT_PATHS.programApprovals, createProgramApprovalsIndex],
    [ARTIFACT_PATHS.campaignsIndex, createCampaignsIndex],
    [ARTIFACT_PATHS.workspaceIndex, createWorkspaceIndex],
    [ARTIFACT_PATHS.workflowBoundaries, createWorkflowBoundaries]
  ]) {
    if (isBootstrapManagedPaperPath(relativePath) && !fs.existsSync(resolvePath(root, relativePath))) {
      writeJson(root, relativePath, factory());
      created.push(relativePath);
    }
  }

  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.workflowBoundaries, createWorkflowBoundaries, normalizeWorkflowBoundaries);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.metaExecutionBridgeCandidates, createMetaExecutionBridgeCandidatesIndex, normalizeMetaExecutionBridgeCandidatesIndex);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.metaGovernanceCoverage, createMetaGovernanceCoverageIndex, normalizeMetaGovernanceCoverageIndex);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.metaGovernanceCoverageReport, createMetaGovernanceCoverageReport, normalizeMetaGovernanceCoverageReport);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.metaLongHorizonMemory, createMetaLongHorizonMemory, normalizeMetaLongHorizonMemory);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.metaOperatorFollowThrough, createMetaOperatorFollowThroughIndex, normalizeMetaOperatorFollowThroughIndex);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.metaOperatorFollowThroughTransitions, createMetaOperatorFollowThroughTransitionsIndex, normalizeMetaOperatorFollowThroughTransitionsIndex);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.metaOperatorPlaybooks, createMetaOperatorPlaybooksIndex, normalizeMetaOperatorPlaybooksIndex);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.metaRemediationPacks, createMetaRemediationPacksIndex, normalizeMetaRemediationPacksIndex);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.metaRecommendations, createMetaRecommendationsIndex, normalizeMetaRecommendationsIndex);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.metaOptimizerState, createMetaOptimizerState, normalizeMetaOptimizerState);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.runtimeControllerState, createRuntimeControllerState, normalizeRuntimeControllerState);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.runtimeContinuation, createRuntimeContinuationIndex, normalizeRuntimeContinuationIndex);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.runtimeLeases, createRuntimeLeasesIndex, normalizeRuntimeLeasesIndex);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.runtimeEvents, createRuntimeEventsIndex, normalizeRuntimeEventsIndex);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.runtimeResults, createRuntimeResultsIndex, normalizeRuntimeResultsIndex);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.programsIndex, createProgramsIndex, normalizeProgramsIndex);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.programRuns, createProgramRunsIndex, normalizeProgramRunsIndex);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.programApprovals, createProgramApprovalsIndex, normalizeProgramApprovalsIndex);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.campaignsIndex, createCampaignsIndex, normalizeCampaignsIndex);
  reconcileManagedJsonArtifact(root, ARTIFACT_PATHS.workspaceIndex, createWorkspaceIndex, normalizeWorkspaceIndex);

  return { root, created };
}

export function loadState(root) {
  ensureWorkspace(root);
  return normalizeState(readJson(root, ARTIFACT_PATHS.state, createDefaultState));
}

export function saveState(root, state) {
  const normalized = normalizeState(state);
  writeJson(root, ARTIFACT_PATHS.state, normalized);
  return normalized;
}

export function listArtifacts(root) {
  ensureWorkspace(root);
  return Object.fromEntries(
    Object.entries(ARTIFACT_PATHS).map(([key, relativePath]) => {
      const fullPath = resolvePath(root, relativePath);
      return [key, { path: relativePath, exists: fs.existsSync(fullPath) }];
    })
  );
}

export function listDraftFiles(root) {
  ensureWorkspace(root);
  const draftsDir = resolvePath(root, ARTIFACT_PATHS.draftsDir);
  return fs.readdirSync(draftsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => entry.name);
}

export function extractCitationKeysFromText(content) {
  const keys = [];
  const pattern = /\[cite:([^\]]+)\]/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const key = match[1]?.trim();
    if (key) {
      keys.push(key);
    }
  }
  return keys;
}

export function listDraftCitationKeys(root) {
  const citations = [];
  for (const draftFile of listDraftFiles(root)) {
    const content = readText(root, `${ARTIFACT_PATHS.draftsDir}/${draftFile}`, "");
    const keys = extractCitationKeysFromText(content);
    for (const key of keys) {
      citations.push({ draftFile, key });
    }
  }
  return citations;
}

function targetArtifactContainsId(root, artifactPath, targetId) {
  if (!artifactPath || !targetId) {
    return false;
  }
  const fullPath = resolvePath(root, artifactPath);
  if (!fs.existsSync(fullPath)) {
    return false;
  }
  const extension = path.extname(artifactPath).toLowerCase();
  if (extension === ".json") {
    try {
      const value = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      const queue = [value];
      while (queue.length > 0) {
        const current = queue.shift();
        if (current === targetId) {
          return true;
        }
        if (Array.isArray(current)) {
          queue.push(...current);
          continue;
        }
        if (current && typeof current === "object") {
          queue.push(...Object.values(current));
        }
      }
      return false;
    } catch {
      return false;
    }
  }
  return fs.readFileSync(fullPath, "utf8").includes(String(targetId));
}

function normalizeGuardPolicyOverride(args = {}) {
  const reason = typeof args.policyOverrideReason === "string" ? args.policyOverrideReason.trim() : "";
  const reasonCode = typeof args.policyOverrideReasonCode === "string" ? args.policyOverrideReasonCode.trim() : "";
  return {
    active: reason.length > 0,
    reason,
    reasonCode,
    actorRole: typeof args.actorRole === "string" && args.actorRole.trim().length > 0 ? args.actorRole : null,
    evidencePaths: Array.isArray(args.policyOverrideEvidencePaths) ? args.policyOverrideEvidencePaths.filter((item) => typeof item === "string" && item.trim().length > 0) : [],
    targetArtifact: typeof args.policyOverrideTargetArtifact === "string" && args.policyOverrideTargetArtifact.trim().length > 0 ? args.policyOverrideTargetArtifact : null,
    targetId: typeof args.policyOverrideTargetId === "string" && args.policyOverrideTargetId.trim().length > 0 ? args.policyOverrideTargetId : null,
    sourceId: typeof args.policyOverrideSourceId === "string" && args.policyOverrideSourceId.trim().length > 0 ? args.policyOverrideSourceId : null,
    phase: typeof args.policyOverridePhase === "string" && args.policyOverridePhase.trim().length > 0 ? args.policyOverridePhase : null,
    expiresAt: typeof args.policyOverrideExpiresAt === "string" && args.policyOverrideExpiresAt.trim().length > 0 ? args.policyOverrideExpiresAt : null
  };
}

function artifactPathLocallyRelates(candidatePath, anchorPath) {
  if (!candidatePath || !anchorPath) {
    return false;
  }
  if (candidatePath === anchorPath) {
    return true;
  }
  const candidateDir = path.dirname(candidatePath);
  const anchorDir = path.dirname(anchorPath);
  return candidateDir === anchorDir
    || candidatePath.startsWith(`${anchorDir}/`)
    || anchorPath.startsWith(`${candidateDir}/`);
}

export function isRelevantOverrideEvidencePath(root, item = {}, evidencePath) {
  if (!evidencePath || !fs.existsSync(resolvePath(root, evidencePath))) {
    return false;
  }
  const anchors = [
    item.sourceArtifactPath,
    item.linkedTargetArtifact,
    ...(item.closureArtifactPaths ?? [])
  ].filter(Boolean);
  if (anchors.some((anchorPath) => artifactPathLocallyRelates(evidencePath, anchorPath))) {
    return true;
  }
  const ids = [item.linkedTargetId, item.sourceId].filter(Boolean);
  return ids.some((targetId) => targetArtifactContainsId(root, evidencePath, targetId));
}

export function overrideEvidenceRelevantToItems(root, items = [], evidencePaths = []) {
  const normalizedEvidencePaths = normalizeStringArrayLocal(evidencePaths);
  if (normalizedEvidencePaths.length === 0) {
    return { ok: false, unrelatedItemIds: items.map((item) => item.id), relevantEvidencePaths: [] };
  }
  const unrelatedItemIds = items
    .filter((item) => !normalizedEvidencePaths.some((artifactPath) => isRelevantOverrideEvidencePath(root, item, artifactPath)))
    .map((item) => item.id);
  return {
    ok: unrelatedItemIds.length === 0,
    unrelatedItemIds,
    relevantEvidencePaths: normalizedEvidencePaths.filter((artifactPath) => items.some((item) => isRelevantOverrideEvidencePath(root, item, artifactPath)))
  };
}

export function assertFollowThroughReady(root, actionLabel, args = {}) {
  const ledger = normalizeMetaOperatorFollowThroughIndex(readJson(root, ARTIFACT_PATHS.metaOperatorFollowThrough, createMetaOperatorFollowThroughIndex));
  const override = normalizeGuardPolicyOverride(args);
  const currentState = loadState(root);
  const currentOwner = currentState.orchestrationBoard?.assignedRole ?? "planner";
  const currentPhase = currentState.pipeline?.currentStage ?? currentState.orchestrationBoard?.currentPhase ?? "init";
  const actionRequiredItems = (ledger.items ?? []).filter((item) => {
    const status = item.status;
    const invalidStatus = Boolean(item.invalidStatus) || !["acknowledged", "accepted-for-execution", "executing", "deferred", "accepted-risk", "closed", "superseded"].includes(status);
    const dueDeferred = status === "deferred" && item.deferUntil && String(item.deferUntil) <= nowIso();
    const targetBound = !["accepted-for-execution", "executing", "closed"].includes(status)
      ? true
      : targetArtifactContainsId(root, item.linkedTargetArtifact, item.linkedTargetId);
    const acceptedExecutionOpen = status === "accepted-for-execution" || status === "executing";
    return invalidStatus || Boolean(item.stale) || dueDeferred || !targetBound || acceptedExecutionOpen;
  }).map((item) => item.id);

  if (actionRequiredItems.length === 0) {
    return;
  }
  if (override.active) {
    const relevance = override.actorRole ? overrideEvidenceRelevantToItems(root, (ledger.items ?? []).filter((item) => actionRequiredItems.includes(item.id)), override.evidencePaths) : { ok: false, unrelatedItemIds: actionRequiredItems };
    const targetItems = (ledger.items ?? []).filter((item) => actionRequiredItems.includes(item.id));
    const targetMatch = targetItems.some((item) => item.linkedTargetArtifact === override.targetArtifact && item.linkedTargetId === override.targetId);
    const sourceMatch = targetItems.some((item) => item.sourceId === override.sourceId);
    const notExpired = override.expiresAt && String(override.expiresAt) > nowIso();
    const withinWindow = notExpired && String(override.expiresAt) <= new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const actorMatches = override.actorRole && override.actorRole === currentOwner;
    const reasonCodeAllowed = ["emergency-repair", "manual-reconciliation", "migration-compatibility", "operator-acknowledged-exception"].includes(override.reasonCode);
    const phaseMatches = override.phase === currentPhase;
    if (relevance.ok && targetMatch && sourceMatch && phaseMatches && withinWindow && actorMatches && reasonCodeAllowed) {
      return;
    }
    throw new Error(`${actionLabel} cannot override follow-through governance without current-owner actorRole, matching policyOverrideSourceId, matching policyOverrideTargetArtifact/policyOverrideTargetId, matching policyOverridePhase, allowed policyOverrideReasonCode, relevant policyOverrideEvidencePaths, and a short future policyOverrideExpiresAt. Action-required records: ${actionRequiredItems.join(", ")}. Unrelated records: ${relevance.unrelatedItemIds.join(", ") || "none"}.`);
  }
  throw new Error(`${actionLabel} is blocked while operator follow-through still requires action: ${actionRequiredItems.join(", ")}.`);
}

export function assertGovernanceMutationRegistered(actionId, expectedMode) {
  const guarded = new Map(GOVERNANCE_GUARDED_MUTATIONS.map((entry) => [entry.id, entry]));
  const exempt = new Map(GOVERNANCE_EXEMPT_MUTATIONS.map((entry) => [entry.id, entry]));
  if (expectedMode === "guarded") {
    if (!guarded.has(actionId)) {
      throw new Error(`Governance registry missing guarded mutation entry: ${actionId}`);
    }
    return;
  }
  if (expectedMode === "exempt") {
    const entry = exempt.get(actionId);
    if (!entry) {
      throw new Error(`Governance registry missing exempt mutation entry: ${actionId}`);
    }
    if (entry.sunsetAt && entry.sunsetAt <= nowIso()) {
      throw new Error(`Governance exempt entry expired: ${actionId}`);
    }
    return;
  }
  throw new Error(`Unknown governance mutation mode: ${expectedMode}`);
}
