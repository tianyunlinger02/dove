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
    "run_dove_auto",
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

  const mission = await callTool("create_dove_task", {
    id: "validator-paper-task",
    goal: "Draft and review the validator paper section with one figure and one experiment.",
    title: "Validator paper task",
    evidenceExpectations: ["draft", "figure", "review"],
    artifactRefs: [".dove/drafts/introduction.md"]
  });
  assert.equal(mission.status, "created");
  assert.equal(mission.createdTask.level, 3);
  assert.equal(mission.createdTask.creatorKind, "user");
  assert.equal(mission.createdTask.rootId, initGoal.init.id);
  assert.ok(["paper", "experiment", "engineering"].includes(mission.classification.domain));
  const packetId = mission.createdTask.id;

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
  assert.equal(needsConfirmation.confirmationRequired, true);

  const autoRun = await callTool("run_dove_auto", {
    packetId,
    confirmed: true,
    runId: "validator-auto-run",
    maxSteps: 2
  });
  assert.equal(autoRun.status, "blocked-boundary");
  assert.equal(autoRun.result.packetId, packetId);
  assert.ok(autoRun.result.allowedInternalCommands.includes("dove.review-loop"));

  const secondMission = await callTool("create_dove_task", {
    id: "validator-kill-task",
    goal: "Temporary validator task to kill.",
    title: "Validator kill task"
  });
  const killed = await callTool("kill_dove_task", {
    packetId: secondMission.createdTask.id,
    reason: "MCP validator kill path."
  });
  assert.equal(killed.status, "killed");
  assert.equal(killed.killedTask.status, "killed");

  const status = await callTool("query_dove_status", {});
  assert.equal(status.mode, "dove-status-query");
  assert.ok(status.dashboard.tasks.counts.total >= 1);
  assert.ok(status.dashboard.tasks.tree.length >= 1);
  assert.equal(status.dashboard.tasks.index.activeInitId, initGoal.init.id);
  assert.equal(status.taskGraph, undefined);
  assert.equal(status.paperLifecycle, undefined);
  assert.equal(status.diagnostics.mayRefreshDerivedSurfaces, false);

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
