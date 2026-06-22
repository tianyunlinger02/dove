import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createMcpStdioClient } from "./mcp-stdio-client.mjs";

const ROOT = process.cwd();
const serverScriptPath = path.join(ROOT, "mcp", "dove-state-server.mjs");
const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "dove-validate-"));
const { call, notify, kill } = createMcpStdioClient({ args: [serverScriptPath], cwd: tempWorkspace });

function extractJson(result) {
  assert.ok(result.content?.[0]?.text, "Expected text content in MCP tool result");
  assert.notEqual(result.isError, true, result.content[0].text);
  return JSON.parse(result.content[0].text);
}

async function callTool(name, args = {}) {
  return extractJson(await call("tools/call", { name, arguments: args }));
}

function requireTextIncludes(text, needle, label) {
  assert.equal(text.includes(needle), true, `${label} must include ${needle}`);
}

function requireFullPreActionGuidance(guidance, expected = {}) {
  assert.ok(guidance && typeof guidance === "object", "Expected full pre-action guidance object");
  assert.equal(guidance.presentation, "dove-pre-action-guidance");
  assert.equal(guidance.mode, "read-only-guidance");
  if (expected.surface) {
    assert.equal(guidance.surface, expected.surface);
  }
  if (expected.primaryRole) {
    assert.equal(guidance.roleFrame?.primaryRole, expected.primaryRole);
  }
  assert.equal(guidance.intentFrame?.ordinaryPromptFirst, true);
  assert.equal(guidance.intentFrame?.missionAsWorkContract, true);
  assert.equal(guidance.intentFrame?.noDedicatedMissionListCommand, true);
  assert.equal(guidance.lessonRecall?.automatic, true);
  assert.equal(guidance.lessonRecall?.readOnly, true);
  assert.equal(guidance.lessonRecall?.recordingExplicitOnly, true);
  assert.equal(guidance.lessonRecall?.lessonsPath, ".dove/meta/operator-lessons.json");
  assert.equal(guidance.guardrails?.explicitOnly, true);
  assert.equal(guidance.guardrails?.noHiddenRuntime, true);
  assert.equal(guidance.guardrails?.noAutoApply, true);
  assert.equal(guidance.guardrails?.requiresConfirmationForWrites, true);
  assert.equal(guidance.guardrails?.boundedForegroundOnly, true);
}

function requirePreActionGuidanceSummary(summary, expected = {}) {
  assert.ok(summary && typeof summary === "object", "Expected pre-action guidance summary object");
  assert.equal(summary.presentation, "dove-pre-action-guidance-summary");
  if (expected.surface) {
    assert.equal(summary.surface, expected.surface);
  }
  if (expected.primaryRole) {
    assert.equal(summary.primaryRole, expected.primaryRole);
  }
  assert.equal(summary.noHiddenRuntime, true);
  assert.equal(summary.requiresConfirmationForWrites, true);
  assert.equal(summary.recordingExplicitOnly, true);
}

async function main() {
  const init = await call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "dove-validator",
      version: "0.2.0"
    }
  });
  assert.equal(init.serverInfo.name, "dove");

  notify("notifications/initialized");

  const listed = await call("tools/list");
  const toolNames = new Set(listed.tools.map((tool) => tool.name));
  for (const requiredTool of [
    "init_dove_goal",
    "create_dove_task",
    "record_dove_mission_pass",
    "apply_dove_status_adjustments",
    "run_dove_auto",
    "run_dove_operator",
    "kill_dove_task",
    "reset_dove_version",
    "run_experience_workflow",
    "prepare_audio_review",
    "import_audio_review",
    "run_audio_review",
    "run_dove_review_loop",
    "run_figure_workflow",
    "register_source",
    "upsert_note",
    "upsert_draft",
    "query_dove_status",
    "publish_dove_status",
    "publish_dove_global_status",
    "query_document_ledger",
    "record_document_evidence",
    "query_operator_lessons",
    "record_operator_lesson"
  ]) {
    assert.equal(toolNames.has(requiredTool), true, `Missing MCP tool ${requiredTool}`);
  }

  const toolByName = new Map(listed.tools.map((tool) => [tool.name, tool]));
  const descriptionChecks = {
    query_dove_status: ["statusHome.preActionGuidance", "automatic read-only lesson recall", "Planner/Builder/Reviewer role-framed next action", "mission counts only", "must not render a Missions panel", "requestStatusAdjustment"],
    create_dove_task: ["preActionGuidance", "mission is a durable work/progress object", "bounded foreground mission pass"],
    run_dove_auto: ["preActionGuidance", "no hidden continuation", "scheduler", "daemon"],
    run_dove_operator: ["planner preActionGuidance", "read-only lesson recall", "no scheduler or hidden runtime"],
    query_operator_lessons: ["recall applicable lessons automatically", "read-only preActionGuidance"],
    record_operator_lesson: ["auto-recall lessons read-only", "recording never happens implicitly"],
    run_experience_workflow: ["Builder/experiment-planner preActionGuidance", "read-only lesson recall", "claim-bridge boundary"],
    run_figure_workflow: ["Builder preActionGuidance", "artifact-provenance", "QA gates"],
    prepare_audio_review: ["Reviewer preActionGuidanceSummary", "no-private-transcript boundary"],
    import_audio_review: ["Reviewer preActionGuidanceSummary", "private reviewer transcripts"],
    run_audio_review: ["Reviewer preActionGuidanceSummary", "localized resultCard"],
    run_dove_review_loop: ["Reviewer preActionGuidance", "foreground stop conditions"],
    run_review_loop: ["independent review", "role-framed preActionGuidance"],
    prepare_isolated_review: ["Reviewer preActionGuidanceSummary", "explicit isolation boundaries"],
    import_isolated_review: ["Reviewer preActionGuidanceSummary", "private transcripts"],
    record_document_evidence: ["Builder/researcher preActionGuidanceSummary", "raw transcripts/private reasoning"],
    register_source: ["Builder/researcher preActionGuidanceSummary", "evidence provenance"],
    upsert_note: ["Builder/researcher preActionGuidanceSummary", "evidence guardrails"],
    upsert_plan: ["Planner preActionGuidanceSummary", "scope/gate guardrails"],
    upsert_outline: ["Planner preActionGuidanceSummary", "draft gate guardrails"],
    set_section_status: ["Planner preActionGuidanceSummary", "section gate context"],
    sync_checklist: ["Planner preActionGuidanceSummary", "status gate context"],
    sync_citations: ["Builder/researcher preActionGuidanceSummary", "citation and evidence guardrails"],
    refresh_wiki: ["Planner preActionGuidanceSummary", "reusable context refresh"],
    run_experiment_audit: ["Reviewer preActionGuidanceSummary", "audit gate"],
    bridge_result_to_claim: ["Builder/experiment-planner preActionGuidanceSummary", "result-to-claim bridge"],
    prepare_figure_generation: ["Builder preActionGuidanceSummary", "material provenance"],
    import_figure_generation: ["Builder preActionGuidanceSummary", "artifact-provenance gate"]
  };
  for (const [toolName, requiredFragments] of Object.entries(descriptionChecks)) {
    const description = toolByName.get(toolName)?.description ?? "";
    assert.notEqual(description, "", `Missing MCP description for ${toolName}`);
    for (const fragment of requiredFragments) {
      requireTextIncludes(description, fragment, `${toolName} description`);
    }
  }

  await callTool("ensure_workspace");

  const initGoal = await callTool("init_dove_goal", {
    id: "validator-init",
    title: "Validator Dove goal",
    goal: "Validate the task-centered Dove workflow.",
    summary: "A level-0 goal for MCP validation."
  });
  assert.equal(initGoal.status, "created");
  assert.equal(initGoal.init.level, 0);
  assert.equal(initGoal.nextAction, "project:dove.mission");

  const missionProposal = await callTool("create_dove_task", {
    id: "validator-paper-task",
    goal: "Draft and review the validator paper section with one figure and one experiment.",
    title: "Validator paper task",
    evidenceExpectations: ["draft", "figure", "review"],
    artifactRefs: [".dove/drafts/introduction.md"]
  });
  assert.equal(missionProposal.status, "needs-confirmation");
  assert.equal(missionProposal.proposalOnly, true);
  assert.deepEqual(missionProposal.writes, []);
  assert.equal(missionProposal.confirmationRequired, true);
  assert.equal(missionProposal.demandConversion, true);
  assert.equal(missionProposal.executionMode, "single-foreground-pass");
  assert.equal(missionProposal.proposedTask.level, 3);
  assert.equal(missionProposal.confirmArgs.confirmed, true);
  assert.equal(missionProposal.taskCard.presentation, "compact-task-card");
  assert.equal(missionProposal.taskCard.proposalOnly, true);
  assert.equal(missionProposal.taskCard.noAutoApply, true);
  requireFullPreActionGuidance(missionProposal.preActionGuidance, { surface: "dove.mission", primaryRole: "planner" });
  requireFullPreActionGuidance(missionProposal.taskCard.preActionGuidance, { surface: "dove.mission", primaryRole: "planner" });
  assert.equal(missionProposal.preActionGuidance.lessonRecall.topLessons.length, 0);
  assert.equal(missionProposal.checklistProposal.autoSelected, true);
  assert.equal(missionProposal.checklistProposal.itemCount, 3);
  assert.ok(missionProposal.checklistProposal.items.every((item) => item.creatorKind === "system"));
  assert.ok(missionProposal.checklistProposal.items.every((item) => item.level > missionProposal.proposedTask.level));

  const mission = await callTool("create_dove_task", {
    ...missionProposal.confirmArgs
  });
  assert.equal(mission.status, "created-awaiting-host-pass");
  assert.equal(mission.confirmationRequired, false);
  assert.equal(mission.demandConversion, true);
  assert.equal(mission.executionMode, "single-foreground-pass");
  assert.equal(mission.missionPassRequired, true);
  assert.equal(mission.recordMissionPassTool, "record_dove_mission_pass");
  assert.equal(mission.foreground, true);
  assert.equal(mission.background, false);
  assert.equal(mission.createdTask.level, 3);
  requirePreActionGuidanceSummary(mission.preActionGuidanceSummary, { surface: "dove.mission", primaryRole: "planner" });
  assert.equal(mission.createdTask.creatorKind, "user");
  assert.equal(mission.createdTask.rootId, initGoal.init.id);
  assert.equal(mission.createdChecklistTasks.length, 3);
  assert.ok(mission.createdChecklistTasks.every((item) => item.parentId === mission.createdTask.id));
  assert.ok(mission.createdChecklistTasks.every((item) => item.level > mission.createdTask.level));
  assert.ok(["paper", "experiment", "engineering"].includes(mission.classification.domain));
  const packetId = mission.createdTask.id;

  const missionPass = await callTool("record_dove_mission_pass", {
    packetId,
    runId: "validator-mission-pass",
    resultStatus: "in-progress",
    resultSummary: "Validator mission converted demand into a task and completed one foreground pass.",
    evidenceLinks: [".dove/task-packets/index.json"],
    artifactRefs: [".dove/task-packets/index.json"],
    nextAction: "project:dove.status"
  });
  assert.equal(missionPass.status, "in-progress");
  assert.equal(missionPass.result.surface, "dove.mission");
  assert.equal(missionPass.result.maxIterations, 1);
  assert.equal(missionPass.result.iterationCount, 1);
  assert.equal(missionPass.result.packetId, packetId);
  assert.equal(missionPass.resultCard.presentation, "compact-result-summary-card");
  assert.equal(missionPass.resultCard.surface, "dove.mission");
  assert.equal(missionPass.resultCard.packetId, packetId);
  assert.equal(missionPass.resultCard.proposalOnly, false);
  requirePreActionGuidanceSummary(missionPass.preActionGuidanceSummary, { surface: "dove.mission" });
  requirePreActionGuidanceSummary(missionPass.resultCard.preActionGuidanceSummary, { surface: "dove.mission" });

  const internalDocumentEvidence = await callTool("record_document_evidence", {
    packetId,
    id: "validator-internal-document-evidence",
    title: "Validator internal document evidence",
    documentKind: "implementation-summary",
    evidenceScope: "internal",
    summary: "Validator internal document evidence stays out of public status.",
    artifactRefs: [".dove/task-packets/index.json"]
  });
  assert.equal(internalDocumentEvidence.status, "recorded");
  assert.equal(internalDocumentEvidence.entry.publicSafe, false);
  assert.equal(internalDocumentEvidence.entry.evidenceScope, "internal");
  requirePreActionGuidanceSummary(internalDocumentEvidence.preActionGuidanceSummary, { surface: "dove.documents", primaryRole: "builder" });
  requirePreActionGuidanceSummary(internalDocumentEvidence.resultCard.preActionGuidanceSummary, { surface: "dove.documents", primaryRole: "builder" });

  const publicDocumentEvidence = await callTool("record_document_evidence", {
    packetId,
    id: "validator-public-document-evidence",
    title: "Validator public document evidence",
    documentKind: "source",
    evidenceScope: "external",
    publicSafe: true,
    summary: "Validator public-safe document evidence summary.",
    evidenceLinks: [".dove/evidence/index.json"]
  });
  assert.equal(publicDocumentEvidence.status, "recorded");
  assert.equal(publicDocumentEvidence.entry.publicSafe, true);
  requirePreActionGuidanceSummary(publicDocumentEvidence.preActionGuidanceSummary, { surface: "dove.documents", primaryRole: "builder" });
  requirePreActionGuidanceSummary(publicDocumentEvidence.resultCard.preActionGuidanceSummary, { surface: "dove.documents", primaryRole: "builder" });

  const documentLedger = await callTool("query_document_ledger", { packetId });
  assert.equal(documentLedger.proposalOnly, true);
  assert.equal(documentLedger.noAutoApply, true);
  assert.deepEqual(documentLedger.writes, []);
  assert.equal(documentLedger.entries.length, 2);

  const source = await callTool("register_source", {
    packetId,
    citationKey: "smith2026dove",
    title: "Dove: Task-Centered Research Workflows",
    authors: ["Smith", "Lee"],
    year: 2026,
    sourceType: "paper",
    origin: "validator"
  });
  assert.equal(source.citationKey, "smith2026dove");
  requirePreActionGuidanceSummary(source.preActionGuidanceSummary, { surface: "dove.source", primaryRole: "builder" });

  const note = await callTool("upsert_note", {
    packetId,
    title: "Core contribution note",
    sectionId: "introduction",
    sourceIds: [source.id],
    summary: "The workflow is durable and task-centered.",
    claims: ["Task-centered file-backed workflows reduce context loss."],
    openQuestions: ["Need a stronger comparison baseline."]
  });
  assert.equal(note.sectionId, "introduction");
  requirePreActionGuidanceSummary(note.preActionGuidanceSummary, { surface: "dove.note", primaryRole: "builder" });

  const plan = await callTool("upsert_plan", {
    packetId,
    thesis: "Task-centered Dove keeps research workflows durable.",
    audience: "research tool builders",
    sections: ["introduction"],
    evidenceGaps: ["Add a second baseline."],
    milestones: ["draft", "review"]
  });
  assert.equal(plan.planPath, ".dove/plans/current-plan.md");
  requirePreActionGuidanceSummary(plan.preActionGuidanceSummary, { surface: "dove.plan", primaryRole: "planner" });

  const outline = await callTool("upsert_outline", {
    packetId,
    sections: [{ id: "introduction", title: "Introduction", status: "planned", goal: "Frame the durable workflow contribution." }]
  });
  assert.equal(outline.outlinePath, ".dove/outline/current-outline.md");
  requirePreActionGuidanceSummary(outline.preActionGuidanceSummary, { surface: "dove.draft", primaryRole: "planner" });

  const sectionStatus = await callTool("set_section_status", {
    packetId,
    sectionId: "introduction",
    status: "drafting",
    summary: "Introduction drafting is ready for evidence sync."
  });
  assert.equal(sectionStatus.status, "drafting");
  requirePreActionGuidanceSummary(sectionStatus.preActionGuidanceSummary, { surface: "dove.draft", primaryRole: "planner" });

  const directClaims = await callTool("upsert_claims", {
    packetId,
    claims: [{
      id: "validator-direct-claim",
      text: "Direct MCP thin surfaces preserve pre-action guidance summaries.",
      sectionId: "introduction",
      sourceIds: [source.id],
      noteIds: [note.id],
      evidenceLinks: [".dove/notes/index.json"],
      status: "draft",
      confidence: "medium"
    }],
    policyOverrideReason: "Validator exercises direct claim guidance summary without changing production governance."
  });
  assert.ok(directClaims.claims.some((claim) => claim.id === "validator-direct-claim"));
  requirePreActionGuidanceSummary(directClaims.preActionGuidanceSummary, { surface: "dove.draft", primaryRole: "builder" });

  const directExperimentPlan = await callTool("upsert_experiment_plan", {
    packetId,
    id: "validator-direct-experiment",
    title: "Validator direct experiment",
    claimId: "validator-direct-claim",
    hypothesis: "Thin direct experiment surfaces keep guidance summaries.",
    methodology: "Record a durable direct result and audit/bridge it.",
    successMetric: "Every returned direct artifact includes guidance summary.",
    comparisonTargets: ["chat-only"],
    policyOverrideReason: "Validator exercises direct experiment plan guidance summary."
  });
  assert.equal(directExperimentPlan.id, "validator-direct-experiment");
  requirePreActionGuidanceSummary(directExperimentPlan.preActionGuidanceSummary, { surface: "dove.experience", primaryRole: "builder" });
  const directExperimentPacketId = `experiment-${directExperimentPlan.id}`;

  const directExperimentResult = await callTool("upsert_experiment_result", {
    packetId: directExperimentPacketId,
    result: {
      id: "validator-direct-result",
      experimentId: "validator-direct-experiment",
      claimId: "validator-direct-claim",
      outcome: "supports",
      summary: "Direct result supports the guidance-summary claim.",
      evidenceLinks: [".dove/evidence/index.json"],
      comparisonTargets: ["chat-only"]
    },
    policyOverrideReason: "Validator exercises direct experiment result guidance summary."
  });
  assert.equal(directExperimentResult.id, "validator-direct-result");
  assert.equal(directExperimentResult.latestAuditId, "validator-direct-experiment-audit-1");
  requirePreActionGuidanceSummary(directExperimentResult.preActionGuidanceSummary, { surface: "dove.experience", primaryRole: "builder" });

  const directExperimentAudit = await callTool("run_experiment_audit", {
    packetId: directExperimentPacketId,
    resultId: "validator-direct-result",
    policyOverrideReason: "Validator exercises direct audit guidance summary."
  });
  assert.equal(directExperimentAudit.resultId, "validator-direct-result");
  requirePreActionGuidanceSummary(directExperimentAudit.preActionGuidanceSummary, { surface: "dove.experience", primaryRole: "reviewer" });

  const directClaimBridge = await callTool("bridge_result_to_claim", {
    packetId: directExperimentPacketId,
    resultId: "validator-direct-result",
    auditIds: [directExperimentAudit.id],
    reason: "Validator exercises direct claim bridge guidance summary.",
    policyOverrideReason: "Validator exercises direct result-to-claim bridge guidance summary."
  });
  assert.equal(directClaimBridge.resultId, "validator-direct-result");
  requirePreActionGuidanceSummary(directClaimBridge.preActionGuidanceSummary, { surface: "dove.experience", primaryRole: "builder" });

  const checklistSync = await callTool("sync_checklist", {});
  assert.equal(checklistSync.checklistPath, ".dove/checklists/current.md");
  requirePreActionGuidanceSummary(checklistSync.preActionGuidanceSummary, { surface: "dove.status", primaryRole: "planner" });

  const citationSync = await callTool("sync_citations", { preservePhase: true });
  assert.equal(citationSync.sourceCount >= 1, true);
  requirePreActionGuidanceSummary(citationSync.preActionGuidanceSummary, { surface: "dove.draft", primaryRole: "builder" });

  const wikiRefresh = await callTool("refresh_wiki", {});
  assert.equal(wikiRefresh.wikiPath, ".dove/wiki/index.md");
  requirePreActionGuidanceSummary(wikiRefresh.preActionGuidanceSummary, { surface: "dove.status", primaryRole: "planner" });

  const experience = await callTool("run_experience_workflow", {
    packetId,
    experimentId: "validator-experience",
    goal: "Compare task-centered Dove against a chat-only workflow.",
    methodology: "Check durable artifact completeness.",
    successMetric: "Fewer missing evidence links",
    comparisonTargets: ["chat-only"],
    result: {
      outcome: "supports",
      summary: "Task-centered Dove kept the evidence trail explicit.",
      evidenceLinks: [".dove/notes/index.json"]
    }
  });
  assert.ok(["recorded", "bridged"].includes(experience.status));
  assert.equal(experience.packetId, packetId);
  assert.equal(experience.plan.id, "validator-experience");
  requireFullPreActionGuidance(experience.preActionGuidance, { surface: "dove.experience", primaryRole: "builder" });
  assert.equal(experience.preActionGuidance.roleFrame.subagentSpecialty, "experiment-planner");

  const draft = await callTool("upsert_draft", {
    packetId,
    sectionId: "introduction",
    title: "Introduction",
    body: "# Introduction\n\nDove keeps task state durable. TODO[evidence]: add second baseline.\n",
    status: "drafting"
  });
  assert.equal(draft.sectionId, "introduction");
  requirePreActionGuidanceSummary(draft.preActionGuidanceSummary, { surface: "dove.draft", primaryRole: "builder" });

  const figurePlan = await callTool("upsert_figure_plan", {
    packetId,
    items: [{
      id: "validator-direct-figure",
      name: "Validator direct figure",
      purpose: "Show direct guidance summary coverage across thin figure surfaces.",
      sourceSections: ["introduction"],
      targetClaimIds: ["validator-direct-claim"],
      relatedExperimentIds: ["validator-direct-experiment"],
      requiredVisualElements: ["claim", "experiment", "guidance"],
      captionIntent: "Explain how direct thin figure surfaces preserve provenance guidance.",
      outputFormat: "svg"
    }]
  });
  assert.equal(figurePlan.figureCount, 1);
  requirePreActionGuidanceSummary(figurePlan.preActionGuidanceSummary, { surface: "dove.figure", primaryRole: "builder" });

  const preparedFigure = await callTool("prepare_figure_generation", {
    packetId,
    figureId: "validator-direct-figure",
    runId: "validator-direct-figure-run",
    constraints: ["Use compact labels."],
    allowMissingMaterials: true
  });
  assert.equal(preparedFigure.runId, "validator-direct-figure-run");
  requirePreActionGuidanceSummary(preparedFigure.preActionGuidanceSummary, { surface: "dove.figure", primaryRole: "builder" });

  const importedFigure = await callTool("import_figure_generation", {
    packetId,
    figureId: "validator-direct-figure",
    runId: preparedFigure.runId,
    finalSvgPath: ".dove/figures/runs/validator-direct-figure-run/final.svg",
    svgContent: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Direct validator figure</text></svg>",
    caption: "Direct validator figure records safe import provenance."
  });
  assert.equal(importedFigure.figureId, "validator-direct-figure");
  assert.equal(importedFigure.finalSvgPath, ".dove/figures/validator-direct-figure.final.svg");
  requirePreActionGuidanceSummary(importedFigure.preActionGuidanceSummary, { surface: "dove.figure", primaryRole: "builder" });

  const figure = await callTool("run_figure_workflow", {
    packetId,
    figureId: "validator-figure",
    runId: "validator-figure-run",
    intent: "Show init, mission, auto, review, and lessons as a task loop.",
    sourceSections: ["introduction"],
    relatedExperimentIds: ["validator-experience"],
    requiredVisualElements: ["init", "mission", "review", "lesson"],
    svgContent: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Validator workflow</text></svg>",
    caption: "Validator figure shows the task-centered Dove loop."
  });
  assert.equal(figure.packetId, packetId);
  assert.equal(figure.finalSvgPath, ".dove/figures/validator-figure.final.svg");
  requireFullPreActionGuidance(figure.preActionGuidance, { surface: "dove.figure", primaryRole: "builder" });

  const review = await callTool("run_audio_review", {
    packetId,
    runId: "validator-audio-review",
    finalPlanPaths: [".dove/plans/current-plan.md"],
    finalResultPaths: [".dove/drafts/introduction.md"],
    artifactPaths: [".dove/figures/validator-figure.final.svg"],
    instructions: "Review only the explicit validator artifacts."
  });
  assert.equal(review.status, "prepared-awaiting-audio");
  assert.equal(review.privacyBoundary.projectContextShared, false);
  assert.equal(review.privacyBoundary.writerPrivateTranscriptShared, false);
  assert.equal(review.resultCard.presentation, "compact-result-summary-card");
  assert.equal(review.resultCard.surface, "dove.review");
  requirePreActionGuidanceSummary(review.resultCard.preActionGuidanceSummary, { surface: "dove.review", primaryRole: "reviewer" });

  const reviewLoop = await callTool("run_dove_review_loop", {
    packetId,
    runId: "validator-review-loop",
    finalPlanPaths: [".dove/plans/current-plan.md"],
    finalResultPaths: [".dove/drafts/introduction.md"],
    artifactPaths: [".dove/figures/validator-figure.final.svg"],
    draftBody: "# Introduction\n\nReview-loop placeholder with TODO[evidence].\n",
    experienceGoal: "Plan evidence to resolve the validator review gap."
  });
  assert.equal(reviewLoop.status, "blocked");
  assert.equal(reviewLoop.maxIterations, 3);
  assert.equal(reviewLoop.iterations.length, 1);
  requireFullPreActionGuidance(reviewLoop.preActionGuidance, { surface: "dove.review", primaryRole: "reviewer" });

  const needsConfirmation = await callTool("run_dove_auto", {
    packetId,
    goal: "Validate auto confirmation behavior."
  });
  assert.equal(needsConfirmation.status, "needs-confirmation");
  assert.equal(needsConfirmation.proposalOnly, true);
  assert.equal(needsConfirmation.noAutoApply, true);
  assert.deepEqual(needsConfirmation.writes, []);
  assert.equal(needsConfirmation.confirmationRequired, true);
  assert.equal(needsConfirmation.demandConversion, false);
  assert.equal(needsConfirmation.executionMode, "multi-round-foreground-auto");
  assert.equal(needsConfirmation.selectedTask.id, packetId);
  assert.equal(needsConfirmation.confirmArgs.confirmed, true);
  assert.equal(needsConfirmation.confirmArgs.packetId, packetId);
  assert.equal(needsConfirmation.taskCard.presentation, "compact-task-card");
  assert.equal(needsConfirmation.autoCard.presentation, "compact-auto-card");
  assert.equal(needsConfirmation.autoCard.proposalOnly, true);
  requireFullPreActionGuidance(needsConfirmation.preActionGuidance, { surface: "dove.auto", primaryRole: "builder" });
  requireFullPreActionGuidance(needsConfirmation.taskCard.preActionGuidance, { surface: "dove.auto", primaryRole: "builder" });
  requireFullPreActionGuidance(needsConfirmation.autoCard.preActionGuidance, { surface: "dove.auto", primaryRole: "builder" });

  const autoProposal = await callTool("run_dove_auto", {
    id: "validator-auto-demand",
    goal: "Validate auto demand-to-task confirmation behavior.",
    title: "Validator auto demand",
    evidenceExpectations: ["contract", "runtime"]
  });
  assert.equal(autoProposal.status, "needs-confirmation");
  assert.equal(autoProposal.proposalOnly, true);
  assert.deepEqual(autoProposal.writes, []);
  assert.equal(autoProposal.demandConversion, true);
  assert.equal(autoProposal.executionMode, "multi-round-foreground-auto");
  assert.equal(autoProposal.proposedTask.id, "validator-auto-demand");
  assert.equal(autoProposal.checklistProposal.autoSelected, true);
  assert.equal(autoProposal.taskCard.presentation, "compact-task-card");
  assert.equal(autoProposal.autoCard.presentation, "compact-auto-card");
  requireFullPreActionGuidance(autoProposal.preActionGuidance, { surface: "dove.auto", primaryRole: "builder" });
  requireFullPreActionGuidance(autoProposal.taskCard.preActionGuidance, { surface: "dove.auto", primaryRole: "builder" });
  requireFullPreActionGuidance(autoProposal.autoCard.preActionGuidance, { surface: "dove.auto", primaryRole: "builder" });
  assert.equal(autoProposal.confirmArgs.confirmed, true);
  assert.equal(autoProposal.confirmArgs.checklistItems.length, 3);

  const autoRun = await callTool("run_dove_auto", {
    packetId,
    confirmed: true,
    runId: "validator-auto-run",
    maxSteps: 2,
    steps: [{
      command: "dove.review",
      args: {
        finalPlanPaths: [".dove/plans/current-plan.md"],
        finalResultPaths: [".dove/drafts/introduction.md"],
        artifactPaths: [".dove/figures/validator-figure.final.svg"],
        instructions: "Auto validator should stop at the isolated audio review boundary."
      }
    }]
  });
  assert.equal(autoRun.status, "blocked-boundary");
  assert.equal(autoRun.result.packetId, packetId);
  assert.equal(autoRun.result.foreground, true);
  assert.equal(autoRun.result.background, false);
  assert.equal(autoRun.result.maxIterations, 2);
  assert.equal(autoRun.result.iterationCount, 1);
  assert.equal(autoRun.result.iterations[0].command, "dove.review");
  assert.equal(autoRun.result.iterations[0].outcome, "awaiting-review-output");
  assert.equal(autoRun.result.stopReason, "awaiting-audio-review-output");
  assert.ok(autoRun.result.allowedInternalCommands.includes("dove.review-loop"));
  assert.equal(autoRun.resultCard.presentation, "compact-result-summary-card");
  assert.equal(autoRun.resultCard.surface, "dove.auto");
  assert.equal(autoRun.resultCard.requiresAction, true);
  requirePreActionGuidanceSummary(autoRun.resultCard.preActionGuidanceSummary, { surface: "dove.auto", primaryRole: "builder" });

  const secondMission = await callTool("create_dove_task", {
    id: "validator-kill-task",
    goal: "Temporary validator task to kill.",
    title: "Validator kill task",
    confirmed: true
  });
  const killed = await callTool("kill_dove_task", {
    packetId: secondMission.createdTask.id,
    reason: "MCP validator kill path."
  });
  assert.equal(killed.status, "killed");
  assert.equal(killed.killedTask.status, "killed");

  const status = await callTool("query_dove_status", {});
  const missionStatus = await callTool("query_dove_status", { showMissions: true });
  const adjustmentStatus = await callTool("query_dove_status", { requestStatusAdjustment: true });
  const fullStatus = await callTool("query_dove_status", { detail: "full" });
  assert.equal(status.mode, "dove-status-query");
  assert.equal(status.proposalOnly, true);
  assert.equal(status.noAutoApply, true);
  assert.deepEqual(status.writes, []);
  assert.equal(status.detail, "compact");
  assert.equal(status.statusHome.presentation, "dove-project-situation-home");
  assert.equal(status.statusHome.liveContextFirst, true);
  assert.ok(status.statusHome.currentContext && typeof status.statusHome.currentContext === "object");
  requireFullPreActionGuidance(status.statusHome.preActionGuidance, { surface: "dove.status", primaryRole: "planner" });
  assert.ok(status.statusHome.projectState && typeof status.statusHome.projectState === "object");
  assert.ok(status.statusHome.blockersAndReconciliation && typeof status.statusHome.blockersAndReconciliation === "object");
  assert.ok(status.statusHome.nextSteps && typeof status.statusHome.nextSteps === "object");
  assert.ok(status.statusHome.nextSteps.ranked.length <= 3);
  assert.ok(status.statusHome.nextSteps.ranked.every((card) => card.kind && card.title && card.command));
  assert.ok(status.statusHome.nextSteps.ranked.every((card) => card.proposalOnly === true && card.noAutoApply === true));
  assert.equal(status.statusHome.optionalMissionDetails.presentation, "dove-mission-list");
  assert.equal(status.statusHome.optionalMissionDetails.defaultCollapsed, true);
  assert.equal(status.statusHome.optionalMissionDetails.detail, "summary");
  assert.equal(status.statusHome.optionalMissionDetails.missionItemsIncluded, false);
  assert.equal("groups" in status.statusHome.optionalMissionDetails, false);
  assert.deepEqual(status.statusHome.optionalMissionDetails.statusModel.userGroups, ["todo", "doing", "blocked", "done"]);
  assert.deepEqual(status.statusHome.optionalMissionDetails.statusModel.machineStatuses, ["pending", "ready", "in-progress", "blocked", "completed", "killed"]);
  assert.equal(status.statusHome.optionalMissionDetails.requestArgs.showMissions, true);
  assert.equal(missionStatus.statusHome.optionalMissionDetails.detail, "compact");
  assert.equal(missionStatus.statusHome.optionalMissionDetails.missionItemsIncluded, true);
  assert.equal(missionStatus.statusHome.optionalMissionDetails.groups.done.defaultCollapsed, true);
  assert.equal(status.dashboard, undefined);
  assert.equal(status.dailyHome, undefined);
  assert.equal(fullStatus.detail, "full");
  assert.ok(fullStatus.dashboard);
  assert.ok(fullStatus.dashboard.tasks.counts.total >= 1);
  assert.ok(fullStatus.dashboard.tasks.tree.length >= 1);
  assert.equal(fullStatus.dashboard.tasks.index.activeInitId, initGoal.init.id);
  assert.deepEqual(fullStatus.dashboard.tasks.grouped, fullStatus.dailyHome.missionList);
  assert.equal(fullStatus.dashboard.dailyHome.presentation, "dove-status-home");

  const publicStatus = await callTool("publish_dove_status", { generatedAt: "2026-06-16T00:00:00.000Z" });
  assert.equal(publicStatus.mode, "dove-public-status-publish");
  assert.deepEqual(publicStatus.writes, [".dove/public/status.json", ".dove/public/status.md", ".dove/public/index.html"]);
  assert.equal(publicStatus.privacy.transcriptsIncluded, false);
  assert.equal(publicStatus.privacy.documentLedgerRawEntriesIncluded, false);
  assert.equal(publicStatus.privacy.documentBodiesIncluded, false);
  assert.equal(publicStatus.snapshot.documents.counts.publicSafe >= 1, true);
  assert.ok(publicStatus.snapshot.documents.recentPublicSafe.some((entry) => entry.id === "validator-public-document-evidence"));
  assert.equal(publicStatus.noExternalProcess, true);
  assert.equal(fs.existsSync(path.join(tempWorkspace, ".dove", "public", "status.json")), true);
  assert.equal(fs.existsSync(path.join(tempWorkspace, ".dove", "public", "status.md")), true);
  assert.equal(fs.existsSync(path.join(tempWorkspace, ".dove", "public", "index.html")), true);

  const globalOutputDir = path.join(tempWorkspace, "global-public");
  const globalStatus = await callTool("publish_dove_global_status", {
    projectRoots: [tempWorkspace, path.join(tempWorkspace, "missing-project")],
    outputDir: globalOutputDir,
    generatedAt: "2026-06-16T00:05:00.000Z"
  });
  assert.equal(globalStatus.mode, "dove-global-public-status-publish");
  assert.equal(globalStatus.snapshot.counts.configured, 2);
  assert.equal(globalStatus.snapshot.counts.published, 1);
  assert.equal(globalStatus.snapshot.counts.missing, 1);
  assert.equal(fs.existsSync(path.join(globalOutputDir, "status.json")), true);
  assert.equal(fs.existsSync(path.join(globalOutputDir, "status.md")), true);
  assert.equal(fs.existsSync(path.join(globalOutputDir, "index.html")), true);
  const globalPublicText = `${fs.readFileSync(path.join(globalOutputDir, "status.json"), "utf8")}\n${fs.readFileSync(path.join(globalOutputDir, "status.md"), "utf8")}\n${fs.readFileSync(path.join(globalOutputDir, "index.html"), "utf8")}`;
  assert.equal(globalPublicText.includes(tempWorkspace), false);

  assert.ok(Array.isArray(fullStatus.dashboard.tasks.boundaryActionCards));
  assert.ok(status.projectSummary && typeof status.projectSummary === "object");
  assert.equal(status.statusAdjustmentContract.mutationTool, "apply_dove_status_adjustments");
  assert.deepEqual(status.statusAdjustmentContract.statusChoices, ["pending", "ready", "in-progress", "blocked", "completed", "killed"]);
  assert.equal(status.statusAdjustmentContract.statusAdjustmentItemsIncluded, false);
  assert.deepEqual(status.statusAdjustmentContract.items, []);
  assert.deepEqual(status.statusAdjustmentContract.adjustmentCards, []);
  assert.equal(status.statusHome.statusAdjustmentPreview.requestArgs.requestStatusAdjustment, true);
  assert.equal(adjustmentStatus.statusAdjustmentContract.statusAdjustmentItemsIncluded, true);
  assert.ok(adjustmentStatus.statusAdjustmentContract.adjustmentCards.every((card) => card.presentation === "compact-status-adjustment-card"));
  assert.equal(adjustmentStatus.statusAdjustmentContract.items.some((item) => item.packetId === secondMission.createdTask.id), false);
  assert.equal(adjustmentStatus.statusAdjustmentContract.items.some((item) => ["completed", "killed"].includes(item.currentStatus)), false);
  assert.equal(status.taskGraph, undefined);
  assert.equal(status.paperLifecycle, undefined);
  assert.equal(status.diagnostics.mayRefreshDerivedSurfaces, false);

  const statusAdjustmentPreview = await callTool("apply_dove_status_adjustments", {
    adjustments: [{ packetId, status: "ready", reason: "Validator selects ready from status UX." }]
  });
  assert.equal(statusAdjustmentPreview.status, "needs-confirmation");
  assert.equal(statusAdjustmentPreview.proposalOnly, true);
  assert.deepEqual(statusAdjustmentPreview.writes, []);
  assert.deepEqual(statusAdjustmentPreview.statusChoices, ["pending", "ready", "in-progress", "blocked", "completed", "killed"]);
  assert.equal(statusAdjustmentPreview.adjustmentCards.length, 1);
  assert.equal(statusAdjustmentPreview.adjustmentCards[0].presentation, "compact-status-adjustment-card");
  assert.equal(statusAdjustmentPreview.adjustmentCards[0].proposalOnly, true);

  const statusAdjustment = await callTool("apply_dove_status_adjustments", statusAdjustmentPreview.confirmArgs);
  assert.ok(["applied", "skipped"].includes(statusAdjustment.status));
  assert.equal(statusAdjustment.rejected.length, 0);
  assert.equal(statusAdjustment.resultCard.presentation, "compact-result-summary-card");
  assert.equal(statusAdjustment.resultCard.surface, "dove.status");

  const operatorPreview = await callTool("run_dove_operator", {});
  assert.equal(operatorPreview.status, "needs-confirmation");
  assert.equal(operatorPreview.proposalOnly, true);
  assert.deepEqual(operatorPreview.writes, []);
  assert.equal(operatorPreview.executionMode, "operator-one-foreground-pass");
  assert.equal(operatorPreview.foreground, true);
  assert.equal(operatorPreview.background, false);
  assert.ok(operatorPreview.queueCards && typeof operatorPreview.queueCards === "object");
  assert.ok(Array.isArray(operatorPreview.queueCards.runnable));
  requireFullPreActionGuidance(operatorPreview.preActionGuidance, { surface: "dove.operator", primaryRole: "planner" });
  for (const queueCard of Object.values(operatorPreview.queueCards).flat()) {
    requireFullPreActionGuidance(queueCard.preActionGuidance, { surface: "dove.operator", primaryRole: "planner" });
  }

  const operatorRun = await callTool("run_dove_operator", { confirmed: true, runId: "validator-operator-run" });
  assert.equal(operatorRun.resultCard.presentation, "compact-result-summary-card");
  assert.equal(operatorRun.resultCard.surface, "dove.operator");
  requirePreActionGuidanceSummary(operatorRun.preActionGuidanceSummary, { surface: "dove.operator", primaryRole: "planner" });
  requirePreActionGuidanceSummary(operatorRun.resultCard.preActionGuidanceSummary, { surface: "dove.operator", primaryRole: "planner" });

  const recordedLesson = await callTool("record_operator_lesson", {
    title: "Keep MCP validator retrospectives distilled",
    problem: "Validator experience should be reusable without reading raw runtime traces.",
    decisions: ["Record a concise lesson through the explicit MCP tool."],
    pitfalls: ["Do not cite raw task logs as lesson sources."],
    validation: ["Query lessons by tag after recording."],
    nextTime: ["Close validation tasks with a short retrospective."],
    domain: "engineering",
    stage: "execute",
    actorRole: "planner",
    tags: ["validator", "retrospective"],
    sourceArtifacts: [".dove/sessions/LATEST_SUMMARY.md"]
  });
  assert.equal(recordedLesson.summary.activeLessonCount, 1);
  assert.equal(recordedLesson.recordedLesson.status, "active");
  const queriedLessons = await callTool("query_operator_lessons", { tag: "validator" });
  assert.equal(queriedLessons.lessonsPath, ".dove/meta/operator-lessons.json");
  assert.ok(queriedLessons.lessons.some((lesson) => lesson.id === recordedLesson.recordedLesson.id));
  const lessonRecallStatus = await callTool("query_dove_status", {});
  requireFullPreActionGuidance(lessonRecallStatus.statusHome.preActionGuidance, { surface: "dove.status", primaryRole: "planner" });
  assert.ok(lessonRecallStatus.statusHome.preActionGuidance.lessonRecall.topLessons.some((lesson) => lesson.id === recordedLesson.recordedLesson.id));

  const versionReset = await callTool("reset_dove_version", {
    versionId: "validator-direction-reset",
    reason: "Validate active task reset.",
    summary: "Only init and required lessons should remain active."
  });
  assert.equal(versionReset.status, "reset");
  assert.equal(versionReset.init.id, initGoal.init.id);
  assert.deepEqual(versionReset.activeTaskIds, []);
  assert.equal(versionReset.version.preservedLessonIds.length >= 1, true);

  const boundaryReport = await callTool("query_boundary_report");
  assert.equal(Array.isArray(boundaryReport.missingBootstrapArtifacts), true);

  const artifacts = await callTool("list_artifacts");
  assert.equal(artifacts.state.exists, true);

  console.log("MCP validation passed.");
}

try {
  await main();
  kill();
} catch (error) {
  kill();
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
} finally {
  fs.rmSync(tempWorkspace, { recursive: true, force: true });
}
