import test from "node:test";
import assert from "node:assert/strict";

import { COMMAND_SURFACES } from "../../src/core/command-manifest.mjs";
import {
  COMMAND_OPERATIONS,
  TOOL_OPERATIONS,
  commandOperationMetadata,
  operationCallback,
  operationClosure,
  operationContinuation,
  operationForTool,
  operationForCommand,
  operationInteraction,
  operationPresentation,
  operationPublicProjector,
  operationRequiresCheckpoint,
  operationTargetTool,
  operationRetry,
  operationStatus,
  operationStatuses
} from "../../src/core/operation-registry.mjs";
import { toolDefinitions } from "../../src/mcp/tool-definitions.mjs";

test("operation registry covers every MCP tool and command exactly once", () => {
  assert.deepEqual(TOOL_OPERATIONS.map((operation) => operation.toolName), toolDefinitions.map((tool) => tool.name));
  assert.deepEqual(COMMAND_OPERATIONS.map((operation) => operation.commandId), COMMAND_SURFACES.map((command) => command.id));
  assert.equal(new Set(TOOL_OPERATIONS.map((operation) => operation.id)).size, TOOL_OPERATIONS.length);
  assert.equal(new Set(COMMAND_OPERATIONS.map((operation) => operation.id)).size, COMMAND_OPERATIONS.length);
  for (const operation of [...TOOL_OPERATIONS, ...COMMAND_OPERATIONS]) {
    assert.equal(operationPublicProjector(operation), operation.publicProjector, `${operation.id} needs one public projector`);
    if (typeof operation.continuation === "function") {
      assert.equal(operationContinuation(operation), operation.continuation({}), `${operation.id} has an invalid dynamic continuation`);
    } else {
      assert.equal(operationContinuation(operation), operation.continuation, `${operation.id} has an invalid continuation`);
    }
    if (typeof operation.closure === "function") {
      assert.equal(operationClosure(operation), operation.closure({}), `${operation.id} has an invalid dynamic closure`);
    } else {
      assert.equal(operationClosure(operation), operation.closure, `${operation.id} has an invalid closure`);
    }
    assert.equal(operationPresentation(operation), operation.presentation, `${operation.id} has an invalid presentation policy`);
    for (const outcome of ["succeeded", "declined", "cancelled", "failed"]) {
      assert.equal(operationRetry(operation, outcome), operation.retry[outcome], `${operation.id} has an invalid ${outcome} retry policy`);
    }
  }

  for (const command of COMMAND_SURFACES) {
    const metadata = commandOperationMetadata(command.operationId);
    assert.equal(command.interaction, metadata.interaction);
    assert.equal(command.continuation, metadata.continuation);
    assert.equal(command.closure, metadata.closure);
    assert.deepEqual(command.retry, metadata.retry);
    assert.equal(command.presentation, metadata.presentation);
    assert.equal(command.publicProjector, metadata.publicProjector);
    assert.equal(metadata.statuses, operationStatuses(command.operationId));
    assert.deepEqual(command.requiredTools, metadata.requiredTools);
  }
});

test("operation registry canonically owns result status semantics", () => {
  const operation = operationForTool("close_host_outcome");
  assert.equal(Object.isFrozen(operationStatuses(operation)), true);
  assert.deepEqual(operationStatus(operation, "replayed"), {
    outcome: "replay",
    category: "success-zero-write",
    phase: "execution",
    userAction: "none",
    retry: "none"
  });
  assert.deepEqual(operationStatus(operationForTool("record_research_outcome"), "recorded"), {
    outcome: "success"
  });
  assert.deepEqual(operationStatus(operationForTool("record_research_outcome"), "replayed"), {
    outcome: "replay",
    category: "success-zero-write",
    phase: "execution",
    userAction: "none",
    retry: "none"
  });
  assert.deepEqual(operationStatus(operation, "no-progress-skipped"), {
    outcome: "failure",
    category: "blocked",
    phase: "execution",
    userAction: "resolve-blocker",
    retry: "explicit-request"
  });
  assert.deepEqual(operationStatus(operation, "partial-commit-failure"), {
    outcome: "failure",
    category: "internal-failure",
    phase: "internal",
    userAction: "reassess-read-only",
    retry: "none"
  });
  assert.equal(operationStatus(operation, "unknown-runtime-status"), null);
});

test("direct research Skill command modes canonically start, resume, or remain read-only", () => {
  const startModes = new Set([
    "dove.source/register", "dove.note/research", "dove.experience/conceive", "dove.experiment/protocol",
    "dove.draft/new", "dove.figure/new", "dove.review/review", "dove.rebuttal/new"
  ]);
  const resumeModes = new Set([
    "dove.source/query", "dove.source/reject", "dove.note/continue", "dove.experience/continue",
    "dove.experiment/result", "dove.experiment/claim", "dove.draft/revision", "dove.figure/revision",
    "dove.rebuttal/revision"
  ]);
  const readOnlyModes = new Set();
  for (const commandId of ["dove.source", "dove.note", "dove.experience", "dove.experiment", "dove.draft", "dove.figure", "dove.review", "dove.rebuttal"]) {
    const surface = COMMAND_SURFACES.find((item) => item.id === commandId);
    assert.ok(surface);
    for (const flowMode of surface.callFlow.modes) {
      const key = `${commandId}/${flowMode.id}`;
      assert.equal(flowMode.steps[0].tool, "query_dove_status", key);
      assert.equal(flowMode.steps.slice(1).some((step) => step.tool === "query_dove_status"), false, key);
      if (startModes.has(key)) {
        assert.equal(flowMode.steps[1].tool, "manage_dove_mission", key);
        assert.match(flowMode.steps[1].instruction, /operation=start-skill/iu, key);
        assert.match(flowMode.steps[1].instruction, /research Skill Mission/iu, key);
        assert.match(flowMode.steps[1].instruction, /research outcome closure exactly once/iu, key);
      } else if (resumeModes.has(key)) {
        assert.equal(flowMode.steps.some((step) => step.tool === "manage_dove_mission"), false, key);
        assert.match(flowMode.steps[0].instruction, /exact existing work number|exact work number/iu, key);
        assert.match(flowMode.steps[0].instruction, /do not call start-skill/iu, key);
        assert.match(flowMode.steps[0].instruction, /do not guess the latest work/iu, key);
      } else {
        assert.equal(readOnlyModes.has(key), true, `Unclassified lifecycle mode ${key}`);
        assert.equal(flowMode.steps.some((step) => step.tool === "manage_dove_mission"), false, key);
        assert.match(flowMode.steps[0].instruction, /read-only/iu, key);
        assert.match(flowMode.steps[0].instruction, /do not create a Skill Mission/iu, key);
      }
    }
    const operation = operationForCommand(commandId);
    assert.equal(operationInteraction(operation), "write", commandId);
    assert.equal(operationRequiresCheckpoint(operation), false, commandId);
  }
  assert.deepEqual(operationForCommand("dove.note").tools, ["query_dove_status", "manage_dove_mission"]);
  assert.deepEqual(operationForCommand("dove.experience").tools, ["query_dove_status", "manage_dove_mission"]);
});

test("start-skill route resumes with mode-appropriate typed closure metadata", () => {
  const operation = operationForTool("manage_dove_mission");
  assert.equal(operationInteraction(operation, { operation: "start-skill" }), "write");
  assert.equal(operationRequiresCheckpoint(operation, { operation: "start-skill" }), false);
  assert.equal(operationTargetTool(operation, { operation: "start-skill" }), "start_dove_skill_mission");

  const researchRoot = { operation: "start-skill", currentResearchDecision: {}, executionHandoff: {} };
  assert.equal(operationContinuation(operation, researchRoot), "resume-original");
  assert.equal(operationClosure(operation, researchRoot), "research-outcome");
  assert.equal(operationCallback(operation, researchRoot).tool, "record_research_outcome");

  const researchChild = { operation: "start-skill", mission: { mode: "research" }, currentResearchDecision: {}, executionHandoff: {} };
  assert.equal(operationContinuation(operation, researchChild), "resume-original");
  assert.equal(operationClosure(operation, researchChild), "research-outcome");
  const callback = operationCallback(operation, researchChild);
  assert.equal(callback.tool, "record_research_outcome");
  assert.equal(callback.exactlyOnce, true);
  assert.deepEqual(callback.boundArgNames, ["missionNumber", "decisionRevision"]);
});

test("research decision reevaluation is a direct domain mutation while mission creation remains a checkpoint", () => {
  const operation = operationForTool("manage_dove_mission");
  assert.equal(operationInteraction(operation, { operation: "create-root" }), "checkpoint");
  assert.equal(operationRequiresCheckpoint(operation, { operation: "create-root" }), true);
  assert.equal(operationContinuation(operation, { operation: "create-root" }), "terminal");
  assert.equal(operationClosure(operation, { operation: "create-root" }), "none");
  const createdResearch = { operation: "create-root", executionHandoff: { authorizedAction: {} } };
  assert.equal(operationContinuation(operation, createdResearch), "resume-original");
  assert.equal(operationClosure(operation, createdResearch), "research-outcome");
  assert.equal(operationCallback(operation, { ...createdResearch, currentResearchDecision: {} }).tool, "record_research_outcome");
  assert.equal(operationInteraction(operation, { operation: "reevaluate-research-decision" }), "write");
  assert.equal(operationRequiresCheckpoint(operation, { operation: "reevaluate-research-decision" }), false);
  assert.equal(operationTargetTool(operation, { operation: "reevaluate-research-decision" }), "reevaluate_research_decision");
  assert.equal(operationPublicProjector(operation, { operation: "reevaluate-research-decision" }), "create_dove_mission");
  assert.equal(operationClosure(operation, { operation: "reevaluate-research-decision", executionHandoff: null }), "none");
  const result = { operation: "reevaluate-research-decision", executionHandoff: { authorizedAction: {} } };
  assert.equal(operationClosure(operation, result), "research-outcome");
  const reevaluationCallback = operationCallback(operation, result);
  assert.equal(reevaluationCallback.tool, "record_research_outcome");
  assert.equal(Object.isFrozen(reevaluationCallback), true);
  assert.equal(Object.isFrozen(reevaluationCallback.boundArgNames), true);
  assert.equal(Object.isFrozen(reevaluationCallback.requiredOutcomeFields), true);
  assert.equal(Object.isFrozen(reevaluationCallback.defaults), true);
  assert.equal(operationCallback(operation, { operation: "reevaluate-research-decision", executionHandoff: null }), null);
});

test("Lessons read and update stay project-scoped without Mission closure", () => {
  const operation = operationForTool("manage_dove_lessons");
  assert.equal(operationInteraction(operation, { operation: "read" }), "read");
  assert.equal(operationTargetTool(operation, { operation: "read" }), "read_dove_lessons");
  assert.equal(operationPublicProjector(operation, { operation: "read" }), "read_dove_lessons");
  assert.equal(operationRequiresCheckpoint(operation, { operation: "read" }), false);
  assert.equal(operationInteraction(operation, { operation: "update" }), "write");
  assert.equal(operationTargetTool(operation, { operation: "update" }), "update_dove_lessons");
  assert.equal(operationPublicProjector(operation, { operation: "update" }), "update_dove_lessons");
  assert.equal(operationRequiresCheckpoint(operation, { operation: "update" }), false);
  assert.equal(operationClosure(operation), "none");
  assert.equal(operationCallback(operation, { status: "updated" }), null);
  assert.deepEqual(operationForCommand("dove.lessons").tools, ["manage_dove_lessons"]);
  assert.equal(operationClosure(operationForCommand("dove.lessons")), "none");
});

test("operation registry owns canonical review routing", () => {
  const operation = operationForTool("manage_dove_review");
  assert.equal(operationForTool("scope_review_record"), operation);
  assert.equal(operationForTool("archive_review_record"), operation);
  assert.equal(operationInteraction(operation, { operation: "scope" }), "read");
  assert.equal(operationRequiresCheckpoint(operation, { operation: "scope" }), false);
  assert.equal(operationTargetTool(operation, { operation: "scope" }), "scope_review_record");
  assert.equal(operationInteraction(operation, { operation: "archive" }), "write");
  assert.equal(operationRequiresCheckpoint(operation, { operation: "archive" }), false);
  assert.equal(operationTargetTool(operation, { operation: "archive" }), "archive_review_record");
  assert.throws(() => operationTargetTool(operation, { operation: "prepare" }), /requires one canonical operation/u);
});

test("workspace registry keeps direct mainline writes separate from archive-reset checkpoints", () => {
  const operation = operationForTool("manage_dove_workspace");
  assert.equal(operationInteraction(operation, { operation: "set-mainline" }), "write");
  assert.equal(operationRequiresCheckpoint(operation, { operation: "set-mainline" }), false);
  assert.equal(operationInteraction(operation, { operation: "initialize", archiveReset: true }), "checkpoint");
  assert.equal(operationRequiresCheckpoint(operation, { operation: "initialize", archiveReset: true }), true);
});

test("ambient and explicit mission entries have separate executable routes", () => {
  const ambient = operationForTool("create_ambient_dove_mission");
  const explicit = operationForTool("manage_dove_mission");
  assert.equal(operationInteraction(ambient), "ambient-create");
  assert.equal(operationRequiresCheckpoint(ambient), false);
  assert.equal(operationContinuation(ambient), "resume-original");
  assert.equal(operationClosure(ambient), "host-outcome");
  assert.equal(operationClosure(ambient, { mission: { mode: "ordinary" } }), "host-outcome");
  assert.equal(operationClosure(ambient, { mission: { mode: "research" } }), "research-outcome");
  assert.equal(operationPresentation(ambient), "silent-on-success");
  assert.equal(operationCallback(ambient, { status: "materialized", mission: { mode: "ordinary" } }).tool, "close_host_outcome");
  assert.equal(operationCallback(ambient, { status: "materialized", mission: { mode: "research" }, executionHandoff: {} }).tool, "record_research_outcome");
  assert.notEqual(operationPublicProjector(ambient), operationPublicProjector(explicit));
  assert.equal(operationInteraction(explicit, { operation: "create-root" }), "checkpoint");
  assert.equal(operationRequiresCheckpoint(explicit, { operation: "create-root" }), true);
  assert.equal(operationContinuation(explicit), "terminal");
  assert.equal(operationClosure(explicit), "none");
  assert.equal(operationPresentation(explicit), "show");
});
