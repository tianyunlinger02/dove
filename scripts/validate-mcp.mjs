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
    "record_operator_lesson"
  ]) {
    assert.equal(toolNames.has(requiredTool), true, `Missing MCP tool ${requiredTool}`);
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

  const draft = await callTool("upsert_draft", {
    packetId,
    sectionId: "introduction",
    title: "Introduction",
    body: "# Introduction\n\nDove keeps task state durable. TODO[evidence]: add second baseline.\n",
    status: "drafting"
  });
  assert.equal(draft.sectionId, "introduction");

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
  assert.equal(status.mode, "dove-status-query");
  assert.equal(status.proposalOnly, true);
  assert.equal(status.noAutoApply, true);
  assert.deepEqual(status.writes, []);
  assert.equal(status.dailyHome.presentation, "dove-status-home");
  assert.equal(status.dailyHome.liveContextFirst, true);
  assert.ok(status.dailyHome.nextActions.length <= 3);
  assert.ok(status.dailyHome.nextActions.every((card) => card.proposalOnly === true && card.noAutoApply === true));
  assert.ok(status.dailyHome.boundaryActionCards.every((card) => card.proposalOnly === true && card.noAutoApply === true));
  assert.deepEqual(status.dailyHome.suppressUserFacingDumps, ["mission counts", "status counts", "recent completed missions", "recent killed missions"]);
  assert.ok(status.dashboard.tasks.counts.total >= 1);
  assert.ok(status.dashboard.tasks.tree.length >= 1);
  assert.equal(status.dashboard.tasks.index.activeInitId, initGoal.init.id);
  assert.equal(status.dashboard.dailyHome.presentation, "dove-status-home");
  assert.ok(Array.isArray(status.dashboard.tasks.boundaryActionCards));
  assert.ok(status.projectSummary && typeof status.projectSummary === "object");
  assert.equal(status.statusAdjustmentContract.mutationTool, "apply_dove_status_adjustments");
  assert.deepEqual(status.statusAdjustmentContract.statusChoices, ["pending", "ready", "in-progress", "blocked", "completed", "killed"]);
  assert.ok(status.statusAdjustmentContract.adjustmentCards.every((card) => card.presentation === "compact-status-adjustment-card"));
  assert.equal(status.statusAdjustmentContract.items.some((item) => item.packetId === secondMission.createdTask.id), false);
  assert.equal(status.statusAdjustmentContract.items.some((item) => ["completed", "killed"].includes(item.currentStatus)), false);
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

  const operatorRun = await callTool("run_dove_operator", { confirmed: true, runId: "validator-operator-run" });
  assert.equal(operatorRun.resultCard.presentation, "compact-result-summary-card");
  assert.equal(operatorRun.resultCard.surface, "dove.operator");

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
