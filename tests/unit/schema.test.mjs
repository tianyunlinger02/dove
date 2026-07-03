import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { ensureWorkspace, readJson } from "../../src/core/workspace.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";
import {
  ARTIFACT_PATHS,
  DEFAULT_DOVE_RESPONSE_LANGUAGE,
  DOVE_AUDIO_CONTEXT_POLICY,
  DOVE_ARCHIVED_TASK_STATUSES,
  DOVE_BOUNDARY_STATUSES,
  DOVE_DOCUMENT_EVIDENCE_SCOPES,
  DOVE_DOCUMENT_KINDS,
  DOVE_DOCUMENT_STATUSES,
  DOVE_BOUNDARY_TYPES,
  DOVE_DOMAIN_GUIDANCE,
  DOVE_DOMAIN_IDS,
  DOVE_HANDOFF_STATUSES,
  DOVE_MISSION_LIFECYCLE_STAGES,
  DOVE_PRIMARY_ROLE_IDS,
  DOVE_RESPONSE_LANGUAGES,
  DOVE_TASK_CREATOR_KINDS,
  DOVE_TASK_DOMAINS,
  DOVE_TASK_STAGES,
  DOVE_TASK_STATUSES,
  DOVE_WORKFLOW_KERNEL_VERSION,
  PAPER_LIFECYCLE_FAMILIES,
  PAPER_LIFECYCLE_FAMILY_IDS,
  PAPER_LIFECYCLE_TAXONOMY_VERSION,
  PAPER_MAJOR_CHANGE_PROTOCOL_STAGES,
  SCHEMA_VERSION,
  createDefaultBoard,
  createDefaultState,
  createDocumentLedgerIndex,
  createDoveAuthorityManifest,
  createMetaOperatorLessonsIndex,
  createTaskPacketsIndex,
  createWorkspaceIndex,
  normalizeCampaignsIndex,
  normalizeDoveAuthorityManifest,
  normalizeDoveBoundary,
  normalizeDoveBoundaryType,
  normalizeDoveExecutionReceipt,
  normalizeDoveHandoff,
  normalizeDoveHandoffStatus,
  normalizeDovePrimaryRoleId,
  normalizeDoveResponseLanguage,
  normalizeDocumentLedgerIndex,
  normalizeMetaOperatorLessonsIndex,
  normalizeRuntimeEventsIndex,
  normalizeRuntimeResultsIndex,
  normalizeSettings,
  normalizeState,
  normalizeWorkspaceIndex
} from "../../src/core/schema.mjs";

test("normalizeState migrates v1 state into v2", () => {
  const migrated = normalizeState({
    version: 1,
    projectTitle: "Legacy Paper",
    venue: "NeurIPS",
    objective: "Legacy objective",
    deadline: "2026-05-01",
    currentPhase: "draft",
    updatedAt: "2026-01-01T00:00:00.000Z"
  });

  assert.equal(migrated.version, SCHEMA_VERSION);
  assert.equal(migrated.dove.title, "Legacy Paper");
  assert.equal(migrated.pipeline.currentStage, "draft");
  assert.equal(migrated.orchestration.phase, "draft");
  assert.ok(migrated.sections.introduction);
});

test("createDefaultState exposes durable artifact paths", () => {
  const state = createDefaultState();
  assert.equal(state.artifacts.plan, ".dove/plans/current-plan.md");
  assert.equal(state.artifacts.checklist, ".dove/checklists/current.md");
  assert.equal(state.artifacts.orchestrationBoard, ".dove/orchestration/board.json");
  assert.equal(state.artifacts.taskPacketsIndex, ".dove/task-packets/index.json");
  assert.equal(state.artifacts.packetContextsDir, ".dove/context/packets");
  assert.equal(state.artifacts.artifactContextsDir, ".dove/context/artifacts");
  assert.equal(state.artifacts.actionContextsDir, ".dove/context/actions");
  assert.equal(state.artifacts.sessionSummary, ".dove/sessions/LATEST_SUMMARY.md");
  assert.equal(state.artifacts.workflowBoundaries, ".dove/workflow-pack/boundaries.json");
  assert.equal(state.artifacts.workspaceArtifactMap, ".dove/workspace/artifact-map.json");
  assert.equal(state.artifacts.doveRootManifest, ".dove/manifest.json");
  assert.equal(state.artifacts.programsIndex, ".dove/programs/index.json");
  assert.equal(state.artifacts.programRuns, ".dove/programs/runs.json");
  assert.equal(state.artifacts.programApprovals, ".dove/programs/approvals.json");
  assert.equal(state.artifacts.campaignsIndex, ".dove/programs/campaigns.json");
  assert.equal(state.artifacts.researchBrief, ".dove/research/brief.md");
  assert.equal(state.artifacts.rebuttalIssues, ".dove/rebuttal/issues.json");
  assert.equal(state.artifacts.metaLongHorizonMemory, ".dove/meta/long-horizon-memory.json");
  assert.equal(state.artifacts.metaOperatorLessons, ".dove/meta/operator-lessons.json");
  assert.equal(state.artifacts.versionsIndex, ".dove/versions/index.json");
  assert.equal(state.artifacts.mutationsIndex, ".dove/mutations/index.json");
  assert.equal(state.artifacts.audioReviewsDir, ".dove/audio/reviews");
  assert.deepEqual(DOVE_RESPONSE_LANGUAGES, ["zh", "en"]);
  assert.equal(DEFAULT_DOVE_RESPONSE_LANGUAGE, "zh");
  assert.equal(state.settings.responseLanguage, "zh");
  assert.match(state.dove.title, /未命名/);
  assert.match(state.orchestration.nextAction, /运行 project:dove\.mission/);
  assert.equal(state.settings.taskModel.uniqueInitLevel, 0);
  assert.equal(state.settings.taskModel.userDefaultLevel, 3);
  assert.equal(state.settings.taskModel.autoClassifyMissionTasks, true);
  assert.equal(state.settings.auto.maxIterations, 3);
  assert.equal(state.settings.reviewLoop.maxIterations, 3);
  assert.equal(state.settings.audioIsolation.defaultContextPolicy, DOVE_AUDIO_CONTEXT_POLICY);
  assert.equal(state.reviews.lastVerdict, "not-reviewed");
});

test("Dove response language settings normalize to supported Chinese and English values", () => {
  assert.equal(normalizeDoveResponseLanguage("中文"), "zh");
  assert.equal(normalizeDoveResponseLanguage("Chinese"), "zh");
  assert.equal(normalizeDoveResponseLanguage("english"), "en");
  assert.equal(normalizeDoveResponseLanguage("en-US"), "en");
  assert.equal(normalizeDoveResponseLanguage("fr", "en"), "en");
  assert.throws(() => normalizeDoveResponseLanguage("fr", "zh", { strict: true }), /Unsupported Dove response language/);
  assert.equal(normalizeSettings({ responseLanguage: "English" }).responseLanguage, "en");
  assert.equal(normalizeSettings({ language: "中文" }).responseLanguage, "zh");
  assert.equal(normalizeSettings({ auto: { maxIterations: 5 } }).auto.maxIterations, 5);
  assert.equal(normalizeSettings({ auto: { maxIterations: 0 } }).auto.maxIterations, 1);

  const englishState = createDefaultState({ settings: { responseLanguage: "en" } });
  assert.equal(englishState.settings.responseLanguage, "en");
  assert.equal(englishState.dove.title, "Untitled Mission Workspace");
  assert.equal(englishState.orchestration.nextAction, "Run project:dove.mission to create the next task under the init goal.");
  assert.equal(englishState.orchestration.continuationState.lastCheckpoint, "Workspace bootstrapped.");

  const chineseState = createDefaultState();
  const chineseBoard = createDefaultBoard(chineseState);
  assert.match(chineseBoard.currentFocus, /对齐看板/);
  assert.equal(chineseBoard.continuationState.lastCheckpoint, "工作区已初始化。");

  const normalizedEnglishState = normalizeState({ version: SCHEMA_VERSION, settings: { responseLanguage: "en" } });
  assert.equal(normalizedEnglishState.settings.responseLanguage, "en");
  assert.equal(normalizedEnglishState.dove.title, "Untitled Mission Workspace");
});

test("task packet index exposes the task-centered model defaults", () => {
  const index = createTaskPacketsIndex();
  assert.equal(index.version, 4);
  assert.deepEqual(DOVE_TASK_STAGES, ["plan", "execute", "audit"]);
  assert.deepEqual(DOVE_TASK_DOMAINS, ["paper", "experiment", "engineering"]);
  assert.deepEqual(DOVE_TASK_STATUSES, ["pending", "ready", "in-progress", "blocked", "completed", "killed", "archived"]);
  assert.deepEqual(DOVE_ARCHIVED_TASK_STATUSES, ["archived", "archived-with-lineage"]);
  assert.deepEqual(DOVE_TASK_CREATOR_KINDS, ["user", "system"]);
  assert.equal(index.taskModel.uniqueInitLevel, 0);
  assert.equal(index.taskModel.userDefaultLevel, 3);
  assert.equal(index.taskModel.activeInitId, null);
  assert.deepEqual(index.taskModel.activeTaskIds, []);
  assert.deepEqual(index.stageCounts, { plan: 0, execute: 0, audit: 0 });
  assert.deepEqual(index.domainCounts, { paper: 0, experiment: 0, engineering: 0 });
});

test("workspace index normalization drops legacy removed command lists", () => {
  const normalized = normalizeWorkspaceIndex({
    dove: {
      taskCenteredCommands: ["project:dove.kill", "project:dove.status"],
      overview: "Legacy workspace index."
    }
  });

  assert.equal("taskCenteredCommands" in normalized.dove, false);
  assert.equal(normalized.dove.overview, "Legacy workspace index.");
});

test("boundary and handoff metadata stay separate from task statuses", () => {
  assert.deepEqual(DOVE_TASK_STATUSES, ["pending", "ready", "in-progress", "blocked", "completed", "killed", "archived"]);
  assert.ok(DOVE_BOUNDARY_TYPES.includes("awaiting-host-pass"));
  assert.ok(DOVE_BOUNDARY_TYPES.includes("host-tool-blocked"));
  assert.ok(DOVE_BOUNDARY_TYPES.includes("needs-review"));
  assert.ok(DOVE_BOUNDARY_TYPES.includes("awaiting-provider-output"));
  assert.deepEqual(DOVE_BOUNDARY_STATUSES, ["open", "resolved"]);
  assert.deepEqual(DOVE_HANDOFF_STATUSES, ["none", "pending", "accepted", "completed", "blocked"]);
  for (const boundaryType of DOVE_BOUNDARY_TYPES) {
    assert.equal(DOVE_TASK_STATUSES.includes(boundaryType), false);
  }

  assert.equal(normalizeDoveBoundaryType("awaiting_host_pass"), "awaiting-host-pass");
  assert.equal(normalizeDoveHandoffStatus("ACCEPTED"), "accepted");
  assert.equal(normalizeDovePrimaryRoleId("Reviewer"), "reviewer");

  const boundary = normalizeDoveBoundary({
    boundaryId: "boundary-review",
    boundaryType: "needs_review",
    boundaryStatus: "OPEN",
    taskPacketId: "packet-alpha",
    surface: "dove.auto",
    stopReason: "Reviewer must inspect evidence.",
    requiredInputs: ["audit-report"],
    requiredActions: ["run-review"],
    ownerRole: "builder",
    nextRole: "reviewer"
  });
  assert.equal(boundary.id, "boundary-review");
  assert.equal(boundary.type, "needs-review");
  assert.equal(boundary.status, "open");
  assert.equal(boundary.packetId, "packet-alpha");
  assert.equal(boundary.sourceSurface, "dove.auto");
  assert.equal(boundary.reason, "Reviewer must inspect evidence.");
  assert.deepEqual(boundary.requiredInputs, ["audit-report"]);
  assert.deepEqual(boundary.requiredActions, ["run-review"]);
  assert.equal(boundary.ownerRole, "builder");
  assert.equal(boundary.nextRole, "reviewer");

  const handoff = normalizeDoveHandoff({
    handoffId: "handoff-review",
    status: "pending",
    ownerRole: "builder",
    nextRole: "reviewer",
    boundaryId: boundary.id,
    runId: "run-alpha",
    reason: "Independent review needed."
  });
  assert.equal(handoff.id, "handoff-review");
  assert.equal(handoff.fromRole, "builder");
  assert.equal(handoff.toRole, "reviewer");
  assert.equal(handoff.boundaryId, "boundary-review");
  assert.equal(handoff.sourceRunId, "run-alpha");
});

test("runtime event and result indexes normalize legacy items into canonical entries", () => {
  const runtimeEvents = normalizeRuntimeEventsIndex({
    items: [{ eventId: "event-legacy", eventType: "legacy-event" }],
    entries: [{ id: "event-new", type: "task.lifecycle.transitioned" }, { eventId: "event-legacy", type: "task.boundary.opened" }],
    summary: { eventCount: 3, lastEventType: "task.boundary.opened" }
  });
  assert.deepEqual(runtimeEvents.entries.map((entry) => entry.id ?? entry.eventId), ["event-legacy", "event-new"]);
  assert.equal(runtimeEvents.entries[0].type, "task.boundary.opened");
  assert.equal(runtimeEvents.summary.eventCount, 3);

  const runtimeResults = normalizeRuntimeResultsIndex({
    items: [{ id: "run-legacy", status: "completed" }],
    entries: [{ runId: "run-new", status: "noop" }, { id: "run-legacy", status: "error" }],
    summary: { runCount: 3, lastRunId: "run-new" }
  });
  assert.deepEqual(runtimeResults.entries.map((entry) => entry.id ?? entry.runId), ["run-legacy", "run-new"]);
  assert.equal(runtimeResults.entries[0].status, "error");
  assert.equal(runtimeResults.summary.runCount, 3);
});

test("execution receipts normalize lifecycle evidence and criteria coverage", () => {
  const receipt = normalizeDoveExecutionReceipt({
    id: "receipt-source-id",
    runId: "run-receipt",
    packetId: "packet-receipt",
    command: "record_dove_mission_pass",
    surface: "dove.mission",
    actionType: "build",
    summary: "Receipt fallback summary.",
    evidenceLinks: [" evidence.md ", "evidence.md"],
    artifactPaths: ["artifact.md"],
    verificationEvidencePaths: ["verification.log"],
    lifecycleTransition: { previousStatus: "ready", nextStatus: "completed" },
    verifiedCriteria: [{ criterion: "Criterion covered", status: "verified", evidencePaths: ["verification.log"] }],
    criteriaCoverage: {
      complete: true,
      required: ["Criterion covered"],
      missing: [],
      verified: [{ criterion: "Criterion covered", status: "verified", evidencePaths: ["verification.log"] }]
    }
  });

  assert.equal(receipt.receiptId, "receipt-source-id");
  assert.equal(receipt.resultSummary, "Receipt fallback summary.");
  assert.deepEqual(receipt.evidenceLinks, ["evidence.md"]);
  assert.deepEqual(receipt.artifactPaths, ["artifact.md"]);
  assert.deepEqual(receipt.lifecycleTransition, { previousStatus: "ready", nextStatus: "completed" });
  assert.equal(receipt.criteriaCoverage.complete, true);
  assert.deepEqual(receipt.criteriaCoverage.required, ["Criterion covered"]);
  assert.deepEqual(receipt.verifiedCriteria.map((item) => item.criterion), ["Criterion covered"]);
});

test("document ledger index records document evidence boundaries", () => {
  const index = createDocumentLedgerIndex();
  assert.equal(ARTIFACT_PATHS.documentsDir, ".dove/documents");
  assert.equal(ARTIFACT_PATHS.documentsLedger, ".dove/documents/ledger.json");
  assert.deepEqual(DOVE_DOCUMENT_KINDS, ["draft", "note", "review", "figure", "experiment", "source", "claim-support", "operator-note", "implementation-summary", "decision-record", "other"]);
  assert.deepEqual(DOVE_DOCUMENT_STATUSES, ["planned", "created", "active", "superseded", "archived", "published"]);
  assert.deepEqual(DOVE_DOCUMENT_EVIDENCE_SCOPES, ["internal", "external", "mixed"]);
  assert.equal(index.version, 1);
  assert.deepEqual(index.entries, []);
  assert.equal(index.summary.documentCount, 0);
  assert.equal(index.summary.publicSafeCount, 0);
  assert.equal(index.summary.ledgerPath, ARTIFACT_PATHS.documentsLedger);

  const normalized = normalizeDocumentLedgerIndex({
    version: 99,
    entries: [{
      id: "doc-alpha",
      packetId: "packet-alpha",
      documentId: "external-review-alpha",
      title: "External review alpha",
      documentPath: ".dove/documents/review/external-review-alpha.md",
      documentKind: "review",
      status: "published",
      evidenceScope: "external",
      publicSafe: true,
      summary: "Public-safe review summary.",
      sourceRefs: ["source-alpha", "source-alpha", ""],
      artifactRefs: [".dove/drafts/introduction.md"],
      evidenceLinks: [".dove/evidence/index.json"],
      claimIds: ["claim-alpha"],
      createdAt: "2026-06-17T00:00:00.000Z",
      updatedAt: "2026-06-17T00:00:00.000Z",
      rawTranscriptIncluded: true,
      privateReasoningIncluded: true,
      environmentIncluded: true
    }, {
      id: "doc-beta",
      documentKind: "bad-kind",
      status: "bad-status",
      evidenceScope: "mixed",
      publicSafe: false
    }, "bad-shape"],
    updatedAt: "2026-06-17T00:00:00.000Z"
  });

  assert.equal(normalized.version, 1);
  assert.equal(normalized.entries.length, 2);
  assert.equal(normalized.entries[0].documentKind, "review");
  assert.equal(normalized.entries[0].status, "published");
  assert.equal(normalized.entries[0].evidenceScope, "external");
  assert.equal(normalized.entries[0].publicSafe, true);
  assert.deepEqual(normalized.entries[0].sourceRefs, ["source-alpha"]);
  assert.equal(normalized.entries[0].rawTranscriptIncluded, false);
  assert.equal(normalized.entries[0].privateReasoningIncluded, false);
  assert.equal(normalized.entries[0].environmentIncluded, false);
  assert.equal(normalized.entries[1].documentKind, "other");
  assert.equal(normalized.entries[1].status, "created");
  assert.equal(normalized.summary.documentCount, 2);
  assert.equal(normalized.summary.externalEvidenceCount, 1);
  assert.equal(normalized.summary.mixedEvidenceCount, 1);
  assert.equal(normalized.summary.publicSafeCount, 1);
  assert.equal(normalized.summary.lastDocumentId, "doc-beta");
});

test("operator lessons index is explicit-only and normalized", () => {
  const index = createMetaOperatorLessonsIndex();
  assert.equal(ARTIFACT_PATHS.metaOperatorLessons, ".dove/meta/operator-lessons.json");
  assert.equal(index.referenceOnly, true);
  assert.equal(index.explicitOnly, true);
  assert.equal(index.noAutoCapture, true);
  assert.equal(index.noAutoApply, true);
  assert.deepEqual(index.lessons, []);
  assert.equal(index.summary.lessonCount, 0);
  assert.equal(index.summary.lessonsPath, ARTIFACT_PATHS.metaOperatorLessons);

  const normalized = normalizeMetaOperatorLessonsIndex({
    version: 99,
    referenceOnly: false,
    explicitOnly: false,
    noAutoCapture: false,
    noAutoApply: false,
    lessons: [{
      id: "lesson-custom",
      title: "  Distill trace lessons  ",
      problem: "Operators need reusable task experience.",
      decisions: ["Keep curated decisions.", "Keep curated decisions.", ""],
      pitfalls: ["Avoid raw traces."],
      validation: ["Query by tag."],
      nextTime: ["Write a closure retrospective."],
      domain: "engineering",
      stage: "return",
      actorRole: "planner",
      tags: ["lessons", "lessons", "retrospective"],
      sourceArtifacts: [".trellis/tasks/example/task.json", ".dove/sessions/LATEST_SUMMARY.md"],
      status: "bad-status",
      createdAt: "2026-05-07T00:00:00.000Z"
    }, "bad-shape"],
    sourceArtifacts: [".trellis/tasks/example/task.json", ".dove/workspace/index.json"]
  });

  assert.equal(normalized.version, 1);
  assert.equal(normalized.referenceOnly, true);
  assert.equal(normalized.explicitOnly, true);
  assert.equal(normalized.noAutoCapture, true);
  assert.equal(normalized.noAutoApply, true);
  assert.equal(normalized.lessons.length, 1);
  assert.equal(normalized.lessons[0].title, "Distill trace lessons");
  assert.deepEqual(normalized.lessons[0].decisions, ["Keep curated decisions."]);
  assert.deepEqual(normalized.lessons[0].tags, ["lessons", "retrospective"]);
  assert.deepEqual(normalized.lessons[0].sourceArtifacts, [".dove/sessions/LATEST_SUMMARY.md"]);
  assert.equal(normalized.lessons[0].status, "active");
  assert.equal(normalized.summary.lessonCount, 1);
  assert.equal(normalized.summary.activeLessonCount, 1);
  assert.deepEqual(normalized.summary.topLessonIds, ["lesson-custom"]);
  assert.deepEqual(normalized.summary.topTags, ["lessons", "retrospective"]);
  assert.deepEqual(normalized.sourceArtifacts, [".dove/workspace/index.json"]);

  const workspaceIndex = createWorkspaceIndex();
  assert.equal(workspaceIndex.metaOptimize.operatorLessons.activeLessonCount, 0);
  assert.equal(workspaceIndex.metaOptimize.operatorLessons.lessonsPath, ARTIFACT_PATHS.metaOperatorLessons);
  const normalizedWorkspace = normalizeWorkspaceIndex({ metaOptimize: { operatorLessons: { lessonCount: 2, activeLessonCount: 1, topLessonIds: ["lesson-custom"], lessonsPath: "custom.json" } } });
  assert.equal(normalizedWorkspace.metaOptimize.operatorLessons.lessonCount, 2);
  assert.equal(normalizedWorkspace.metaOptimize.operatorLessons.activeLessonCount, 1);
  assert.deepEqual(normalizedWorkspace.metaOptimize.operatorLessons.topLessonIds, ["lesson-custom"]);
  assert.equal(normalizedWorkspace.metaOptimize.operatorLessons.lessonsPath, "custom.json");
});

test("campaign indexes and workspace mirrors are normalized", () => {
  const index = createWorkspaceIndex();
  assert.equal(ARTIFACT_PATHS.campaignsIndex, ".dove/programs/campaigns.json");
  assert.equal(index.campaigns.campaignCount, 0);
  assert.equal(index.campaigns.plannedCount, 0);
  assert.equal(index.campaigns.activeCount, 0);
  assert.equal(index.campaigns.reviewNeededCount, 0);
  assert.equal(index.campaigns.completedCount, 0);
  assert.equal(index.campaigns.blockedCount, 0);
  assert.deepEqual(index.campaigns.topCampaignIds, []);
  assert.equal(index.campaigns.currentCampaignId, null);
  assert.equal(index.campaigns.currentCampaignNextStepId, null);
  assert.equal(index.campaigns.campaignsPath, ".dove/programs/campaigns.json");

  const normalizedIndex = normalizeWorkspaceIndex({
    campaigns: {
      campaignCount: "bad-shape",
      plannedCount: 2,
      activeCount: 1,
      reviewNeededCount: "bad-shape",
      completedCount: 3,
      blockedCount: "bad-shape",
      topCampaignIds: "bad-shape",
      currentCampaignId: "campaign-alpha",
      currentCampaignStepCount: "bad-shape",
      currentCampaignCompletedStepCount: 1,
      currentCampaignReviewNeededStepCount: "bad-shape",
      currentCampaignNextAction: "Issue fresh approval for the next bounded cycle."
    }
  });
  assert.equal(normalizedIndex.campaigns.campaignCount, 0);
  assert.equal(normalizedIndex.campaigns.plannedCount, 2);
  assert.equal(normalizedIndex.campaigns.activeCount, 1);
  assert.equal(normalizedIndex.campaigns.reviewNeededCount, 0);
  assert.equal(normalizedIndex.campaigns.completedCount, 3);
  assert.equal(normalizedIndex.campaigns.blockedCount, 0);
  assert.deepEqual(normalizedIndex.campaigns.topCampaignIds, []);
  assert.equal(normalizedIndex.campaigns.currentCampaignId, "campaign-alpha");
  assert.equal(normalizedIndex.campaigns.currentCampaignStepCount, 0);
  assert.equal(normalizedIndex.campaigns.currentCampaignCompletedStepCount, 1);
  assert.equal(normalizedIndex.campaigns.currentCampaignReviewNeededStepCount, 0);
  assert.equal(normalizedIndex.campaigns.currentCampaignNextAction, "Issue fresh approval for the next bounded cycle.");

  const normalizedCampaigns = normalizeCampaignsIndex({
    version: 99,
    items: [{ id: "campaign-alpha" }, null, "bad-shape"],
    summary: {
      campaignCount: "bad-shape",
      activeCount: 1,
      topCampaignIds: ["campaign-alpha", ""],
      campaignsPath: "custom-path.json"
    },
    updatedAt: "2026-04-24T00:00:00.000Z"
  });
  assert.equal(normalizedCampaigns.version, 1);
  assert.deepEqual(normalizedCampaigns.items, [{ id: "campaign-alpha" }]);
  assert.equal(normalizedCampaigns.summary.campaignCount, 0);
  assert.equal(normalizedCampaigns.summary.activeCount, 1);
  assert.deepEqual(normalizedCampaigns.summary.topCampaignIds, ["campaign-alpha"]);
  assert.equal(normalizedCampaigns.summary.campaignsPath, "custom-path.json");
  assert.equal(normalizedCampaigns.updatedAt, "2026-04-24T00:00:00.000Z");
});

test("ensureWorkspace creates and repairs the campaigns artifact", () => {
  const root = createTempRoot("dove-schema-campaigns-");
  ensureWorkspace(root);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.workspaceArtifactMap)), false);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.doveRootManifest)), true);
  assert.equal(fs.existsSync(path.join(root, ".dove")), true);

  const manifest = readJson(root, ARTIFACT_PATHS.doveRootManifest, {});
  assert.equal(manifest.status, "authoritative");
  assert.equal(manifest.strategy, "dove-direct");
  assert.equal(manifest.authoritativeRoot, ".dove");

  const planMarkdown = fs.readFileSync(path.join(root, ARTIFACT_PATHS.plan), "utf8");
  const board = readJson(root, ARTIFACT_PATHS.orchestrationBoard, {});
  assert.match(planMarkdown, /当前 Dove 任务计划/);
  assert.match(board.currentFocus, /对齐看板/);

  const campaigns = readJson(root, ARTIFACT_PATHS.campaignsIndex, {});
  assert.equal(campaigns.version, 1);
  assert.deepEqual(campaigns.items, []);
  assert.equal(campaigns.summary.campaignCount, 0);
  assert.equal(campaigns.summary.campaignsPath, ".dove/programs/campaigns.json");

  fs.writeFileSync(path.join(root, ARTIFACT_PATHS.campaignsIndex), JSON.stringify({ version: 99, items: "bad-shape", summary: { activeCount: 2 } }), "utf8");
  ensureWorkspace(root);

  const repaired = readJson(root, ARTIFACT_PATHS.campaignsIndex, {});
  assert.equal(repaired.version, 1);
  assert.deepEqual(repaired.items, []);
  assert.equal(repaired.summary.campaignCount, 0);
  assert.equal(repaired.summary.activeCount, 2);
});

test("ensureWorkspace creates and repairs the operator lessons artifact", () => {
  const root = createTempRoot("dove-schema-lessons-");
  try {
    ensureWorkspace(root);
    const lessons = readJson(root, ARTIFACT_PATHS.metaOperatorLessons, {});
    assert.equal(lessons.version, 1);
    assert.equal(lessons.explicitOnly, true);
    assert.equal(lessons.noAutoCapture, true);
    assert.equal(lessons.noAutoApply, true);
    assert.deepEqual(lessons.lessons, []);
    assert.equal(lessons.summary.lessonsPath, ARTIFACT_PATHS.metaOperatorLessons);

    fs.writeFileSync(path.join(root, ARTIFACT_PATHS.metaOperatorLessons), JSON.stringify({ explicitOnly: false, noAutoApply: false, lessons: "bad-shape" }), "utf8");
    ensureWorkspace(root);

    const repaired = readJson(root, ARTIFACT_PATHS.metaOperatorLessons, {});
    assert.equal(repaired.explicitOnly, true);
    assert.equal(repaired.noAutoApply, true);
    assert.deepEqual(repaired.lessons, []);
    assert.equal(repaired.summary.lessonCount, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ensureWorkspace creates and repairs the document ledger artifact", () => {
  const root = createTempRoot("dove-schema-documents-");
  try {
    ensureWorkspace(root);
    const ledger = readJson(root, ARTIFACT_PATHS.documentsLedger, {});
    assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.documentsDir)), true);
    assert.equal(ledger.version, 1);
    assert.deepEqual(ledger.entries, []);
    assert.equal(ledger.summary.documentCount, 0);
    assert.equal(ledger.summary.ledgerPath, ARTIFACT_PATHS.documentsLedger);

    fs.writeFileSync(path.join(root, ARTIFACT_PATHS.documentsLedger), JSON.stringify({ entries: [{ id: "repair-doc", evidenceScope: "external", publicSafe: true }], summary: { documentCount: 99 } }), "utf8");
    ensureWorkspace(root);

    const repaired = readJson(root, ARTIFACT_PATHS.documentsLedger, {});
    assert.equal(repaired.version, 1);
    assert.equal(repaired.entries.length, 1);
    assert.equal(repaired.entries[0].id, "repair-doc");
    assert.equal(repaired.entries[0].evidenceScope, "external");
    assert.equal(repaired.summary.documentCount, 1);
    assert.equal(repaired.summary.externalEvidenceCount, 1);
    assert.equal(repaired.summary.publicSafeCount, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("workspace index exposes normalized paper lifecycle taxonomy", () => {
  const index = createWorkspaceIndex();
  assert.equal(index.lifecycle.taxonomyVersion, PAPER_LIFECYCLE_TAXONOMY_VERSION);
  assert.deepEqual(PAPER_LIFECYCLE_FAMILY_IDS, ["objective", "structure", "campaign", "work-unit", "concern", "audit", "knowledge"]);
  assert.deepEqual(index.lifecycle.familyIds, PAPER_LIFECYCLE_FAMILY_IDS);
  assert.equal(index.lifecycle.families.length, PAPER_LIFECYCLE_FAMILIES.length);
  assert.equal(index.lifecycle.families.find((family) => family.id === "concern").label, "Concern");
  assert.equal(index.lifecycle.artifactCounts.audit, 0);
  assert.equal(index.lifecycle.activePacketCounts["work-unit"], 0);
  assert.deepEqual(index.lifecycle.protocol.stages, PAPER_MAJOR_CHANGE_PROTOCOL_STAGES);

  const normalized = normalizeWorkspaceIndex({
    lifecycle: {
      taxonomyVersion: "custom-taxonomy",
      families: [{ id: "audit", artifactCount: 7, activePacketCount: 2, packetCount: 3 }],
      artifactCounts: { audit: 7, bogus: 99 },
      activePacketCounts: { audit: 2 },
      packetCounts: { audit: 3 },
      boardFamily: "audit",
      boardPhaseFamily: "bad-family",
      topFamilies: ["audit", "bad-family"],
      protocol: {
        stages: ["design", "bogus"],
        majorChangeSignals: ["core-claim-change", "bogus"],
        overview: "Custom protocol guidance."
      }
    }
  });
  assert.equal(normalized.lifecycle.taxonomyVersion, "custom-taxonomy");
  assert.equal(normalized.lifecycle.families.find((family) => family.id === "audit").artifactCount, 7);
  assert.equal(normalized.lifecycle.artifactCounts.audit, 7);
  assert.equal(normalized.lifecycle.artifactCounts.bogus, undefined);
  assert.equal(normalized.lifecycle.boardFamily, "audit");
  assert.equal(normalized.lifecycle.boardPhaseFamily, null);
  assert.deepEqual(normalized.lifecycle.topFamilies, ["audit"]);
  assert.deepEqual(normalized.lifecycle.protocol.stages, ["design"]);
  assert.deepEqual(normalized.lifecycle.protocol.majorChangeSignals, ["core-claim-change"]);
  assert.equal(normalized.lifecycle.protocol.overview, "Custom protocol guidance.");
});

test("workspace index exposes normalized Dove mission kernel", () => {
  const index = createWorkspaceIndex();
  assert.equal(index.dove.kernelVersion, DOVE_WORKFLOW_KERNEL_VERSION);
  assert.equal(index.dove.unified, true);
  assert.equal(index.dove.identity.productName, "Dove");
  assert.equal(index.dove.identity.packageName, "dove");
  assert.equal(index.dove.identity.publicCli, "dove");
  assert.equal(index.dove.identity.commandPrefix, "project:dove.");
  assert.equal(index.dove.identity.activeDurableRoot, ".dove");
  assert.equal(index.dove.identity.durableRootStatus, "authoritative");
  assert.equal(index.dove.authorityManifest.status, "authoritative");
  assert.equal(index.dove.authorityManifest.strategy, "dove-direct");
  assert.equal(index.dove.authorityManifest.activeDurableRoot, ".dove");
  assert.equal(index.dove.authorityManifest.authoritativeRoot, ".dove");
  assert.equal(index.dove.authorityManifest.manifestPath, ".dove/manifest.json");
  assert.equal(index.dove.authorityManifest.currentWriteAuthority, ".dove");
  assert.equal(index.dove.authorityManifest.dualRootInvariant.allowed, false);
  assert.equal(index.dove.authorityManifest.dualRootInvariant.doveRootAuthoritative, true);
  assert.equal(index.dove.authorityManifest.dualRootInvariant.legacyRootAuthoritative, false);
  assert.equal(index.dove.currentDomain, "paper");
  assert.deepEqual(index.dove.domainIds, DOVE_DOMAIN_IDS);
  assert.equal(index.dove.domainGuidance.length, DOVE_DOMAIN_GUIDANCE.length);
  assert.equal(index.dove.domainGuidance.find((domain) => domain.id === "engineering").stageRoutes.design, "project:dove.mission");
  assert.equal(index.dove.domainGuidance.find((domain) => domain.id === "engineering").stageRoutes.execution, "project:dove.mission or project:dove.auto");
  assert.equal(index.dove.domainGuidance.find((domain) => domain.id === "engineering").stageRoutes.audit, "project:dove.review");
  assert.equal(index.dove.domainGuidance.find((domain) => domain.id === "general").stageRoutes.design, "project:dove.mission");
  assert.equal(index.dove.domainGuidance.find((domain) => domain.id === "general").stageRoutes.audit, "project:dove.review");
  assert.deepEqual(index.dove.primaryRoleIds, DOVE_PRIMARY_ROLE_IDS);
  assert.deepEqual(index.dove.primaryRoles.map((role) => role.id), ["planner", "builder", "reviewer"]);
  assert.deepEqual(index.dove.missionLifecycle.stages, DOVE_MISSION_LIFECYCLE_STAGES);
  assert.equal(index.dove.missionLifecycle.currentStage, "goal");
  assert.deepEqual(index.dove.missionLifecycle.paperProtocolStages, PAPER_MAJOR_CHANGE_PROTOCOL_STAGES);
  assert.equal(index.dove.missionModel.domainField, "doveDomain");
  assert.equal(index.dove.missionModel.durableRoot, ".dove");

  const normalized = normalizeWorkspaceIndex({
    dove: {
      kernelVersion: "custom-dove",
      unified: "bad-shape",
      currentDomain: "engineering",
      domainIds: ["bad-domain"],
      primaryRoleIds: ["bad-role"],
      primaryRoles: [{ id: "builder", label: "Maker" }],
      domainGuidance: [{ id: "engineering", label: "Build", stageRoutes: { execution: "custom-engineering-route" }, returnEvidence: ["tests"] }, { id: "bad-domain", label: "Bad" }],
      identity: {
        productName: "Custom Dove",
        packageName: "custom-package",
        publicCli: "custom-dove",
        commandPrefix: "project:custom-dove."
      },
      authorityManifest: {
        status: "custom-authority",
        strategy: "custom-strategy",
        activeDurableRoot: ".custom-dove",
        currentWriteAuthority: ".custom-dove",
        dualRootInvariant: { allowed: "bad-shape" },
        phases: "bad-shape"
      },
      missionLifecycle: {
        stages: ["goal", "bogus"],
        currentStage: "execution",
        paperProtocolStages: ["design", "bogus"]
      },
      missionCount: "bad-shape",
      activeMissionCount: 2,
      reviewNeededMissionCount: "bad-shape",
      domainCounts: { engineering: 3, bogus: 99 },
      currentMissionFamily: "structure"
    }
  });
  assert.equal(normalized.dove.kernelVersion, "custom-dove");
  assert.equal(normalized.dove.unified, true);
  assert.equal(normalized.dove.currentDomain, "engineering");
  assert.deepEqual(normalized.dove.domainIds, DOVE_DOMAIN_IDS);
  assert.equal(normalized.dove.domainGuidance.find((domain) => domain.id === "engineering").label, "Build");
  assert.equal(normalized.dove.domainGuidance.find((domain) => domain.id === "engineering").stageRoutes.execution, "custom-engineering-route");
  assert.equal(normalized.dove.domainGuidance.find((domain) => domain.id === "bad-domain"), undefined);
  assert.deepEqual(normalized.dove.primaryRoleIds, DOVE_PRIMARY_ROLE_IDS);
  assert.equal(normalized.dove.identity.productName, "Custom Dove");
  assert.equal(normalized.dove.identity.packageName, "custom-package");
  assert.equal(normalized.dove.identity.publicCli, "custom-dove");
  assert.equal(normalized.dove.identity.commandPrefix, "project:custom-dove.");
  assert.equal(normalized.dove.authorityManifest.status, "custom-authority");
  assert.equal(normalized.dove.authorityManifest.strategy, "custom-strategy");
  assert.equal(normalized.dove.authorityManifest.activeDurableRoot, ".custom-dove");
  assert.equal(normalized.dove.authorityManifest.currentWriteAuthority, ".custom-dove");
  assert.equal(normalized.dove.authorityManifest.dualRootInvariant.allowed, false);
  assert.equal(normalized.dove.authorityManifest.phases.length, createDoveAuthorityManifest().phases.length);
  assert.equal(normalized.dove.primaryRoles.find((role) => role.id === "builder").label, "Maker");
  assert.deepEqual(normalized.dove.missionLifecycle.stages, ["goal"]);
  assert.equal(normalized.dove.missionLifecycle.currentStage, "execution");
  assert.deepEqual(normalized.dove.missionLifecycle.paperProtocolStages, ["design"]);
  assert.equal(normalized.dove.missionCount, 0);
  assert.equal(normalized.dove.activeMissionCount, 2);
  assert.equal(normalized.dove.reviewNeededMissionCount, 0);
  assert.equal(normalized.dove.domainCounts.engineering, 3);
  assert.equal(normalized.dove.domainCounts.bogus, undefined);
  assert.equal(normalized.dove.currentMissionFamily, "structure");
});

test("Dove authority manifest is authoritative", () => {
  const manifest = createDoveAuthorityManifest();
  assert.equal(manifest.status, "authoritative");
  assert.equal(manifest.strategy, "dove-direct");
  assert.equal(manifest.activeDurableRoot, ".dove");
  assert.equal(manifest.authoritativeRoot, ".dove");
  assert.equal(manifest.currentWriteAuthority, ".dove");
  assert.equal(manifest.manifestPath, ARTIFACT_PATHS.doveRootManifest);
  assert.equal(manifest.legacyRoot, ".paper");
  assert.equal(manifest.dualRootInvariant.allowed, false);
  assert.equal(manifest.dualRootInvariant.doveRootAuthoritative, true);
  assert.equal(manifest.dualRootInvariant.legacyRootAuthoritative, false);

  const normalized = normalizeDoveAuthorityManifest({
    status: "custom-status",
    strategy: "custom-strategy",
    authoritativeRoot: ".custom-dove",
    currentWriteAuthority: ".custom-dove",
    dualRootInvariant: { allowed: "bad-shape", reason: "custom reason" },
    phases: [{ id: "custom", status: "active", summary: "Custom phase." }, "bad-shape"]
  });
  assert.equal(normalized.status, "custom-status");
  assert.equal(normalized.strategy, "custom-strategy");
  assert.equal(normalized.authoritativeRoot, ".custom-dove");
  assert.equal(normalized.currentWriteAuthority, ".custom-dove");
  assert.equal(normalized.dualRootInvariant.allowed, false);
  assert.equal(normalized.dualRootInvariant.reason, "custom reason");
  assert.deepEqual(normalized.phases, [{ id: "custom", status: "active", summary: "Custom phase." }]);
});

test("workspace index exposes normalized unified autonomy loop skeleton", () => {
  const index = createWorkspaceIndex();
  assert.equal(index.autonomyLoops.contractVersion, "unified-autonomy-loop-v1");
  assert.equal(index.autonomyLoops.activeLifecycleState, "board-ready");
  assert.equal(index.autonomyLoops.loopCount, 4);
  assert.equal(index.autonomyLoops.explicitOnly, true);
  assert.equal(index.autonomyLoops.noHiddenRuntime, true);
  assert.equal(index.autonomyLoops.currentLoopId, "board-role-artifact-handoff");
  assert.equal(index.autonomyLoops.runtimePointers.includes(".dove/runtime/controller-state.json"), true);
  assert.equal(index.autonomyLoops.followThroughPointers.includes(".dove/meta/operator-follow-through.json"), true);
  assert.match(index.autonomyLoops.safeExecutionPath, /dove\.mission -> project:dove\.auto/);

  const normalized = normalizeWorkspaceIndex({
    autonomyLoops: {
      contractVersion: "custom-contract",
      activeLifecycleState: "runtime-result-awaiting-follow-through",
      loopCount: "bad-shape",
      explicitOnly: "bad-shape",
      loops: "bad-shape",
      approvalPointers: "bad-shape",
      lifecycleStates: "bad-shape",
      nextSafeAction: "Use explicit follow-through."
    }
  });
  assert.equal(normalized.autonomyLoops.contractVersion, "custom-contract");
  assert.equal(normalized.autonomyLoops.activeLifecycleState, "runtime-result-awaiting-follow-through");
  assert.equal(normalized.autonomyLoops.loopCount, 4);
  assert.equal(normalized.autonomyLoops.explicitOnly, true);
  assert.deepEqual(normalized.autonomyLoops.loops, []);
  assert.deepEqual(normalized.autonomyLoops.approvalPointers, []);
  assert.deepEqual(normalized.autonomyLoops.lifecycleStates, []);
  assert.equal(normalized.autonomyLoops.nextSafeAction, "Use explicit follow-through.");
});
