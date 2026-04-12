import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultState, normalizeState, SCHEMA_VERSION } from "../../src/core/schema.mjs";

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
  assert.equal(migrated.paper.title, "Legacy Paper");
  assert.equal(migrated.pipeline.currentStage, "draft");
  assert.equal(migrated.orchestration.phase, "draft");
  assert.ok(migrated.sections.introduction);
});

test("createDefaultState exposes durable artifact paths", () => {
  const state = createDefaultState();
  assert.equal(state.artifacts.plan, ".paper/plans/current-plan.md");
  assert.equal(state.artifacts.orchestrationBoard, ".paper/orchestration/board.json");
  assert.equal(state.artifacts.taskPacketsIndex, ".paper/task-packets/index.json");
  assert.equal(state.artifacts.sessionSummary, ".paper/sessions/LATEST_SUMMARY.md");
  assert.equal(state.artifacts.workflowBoundaries, ".paper/workflow-pack/boundaries.json");
  assert.equal(state.artifacts.researchBrief, ".paper/research/brief.md");
  assert.equal(state.artifacts.rebuttalIssues, ".paper/rebuttal/issues.json");
  assert.equal(state.artifacts.versionsIndex, ".paper/versions/index.json");
  assert.equal(state.reviews.lastVerdict, "not-reviewed");
});
