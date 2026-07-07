import fs from "node:fs";
import path from "node:path";

import { COMMAND_SURFACES } from "./command-manifest.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";

export const WORKFLOW_GOAL_CONTRACTS = [
  {
    id: "operator-host-pass-without-results",
    surface: "dove.operator",
    objective: "A confirmed foreground operator pass must not claim execution progress for host-pass-required work unless a safe internal step or an explicit host result exists.",
    pressureTest: "Seed a ready source task that requires host provenance, preview the operator queue, then confirm run_dove_operator without taskResults.",
    acceptanceCriteria: [
      "Preview classifies the task as host-pass-required and does not report auto-runnable work.",
      "Confirmed execution without taskResults returns needs-host-results.",
      "No task is reported as updated and the result card does not expose affected packet ids.",
      "The task remains ready and has no synthetic boundary.",
      "No runtime result entry is persisted for the run.",
      "The response returns material-specific required actions for the host pass."
    ],
    failureMode: "fake-foreground-progress-without-evidence",
    failureReflection: {
      lessonCaptureRequired: true,
      lessonCommand: "project:dove.lessons",
      remediationRequired: true,
      operatorFollowThroughRequired: true,
      regressionArtifacts: [
        "scripts/validate-workflow-goals.mjs",
        "tests/integration/workflow-goals.test.mjs",
        "tests/integration/mcp-tools.test.mjs"
      ],
      remediationTargets: [
        "src/core/task-workflow.mjs",
        "src/core/workflow-goals.mjs",
        "src/core/command-manifest.mjs"
      ],
      summary: "If this goal fails, close the fix only after adding or updating an explicit lesson/remediation note and keeping this scenario in the workflow-goals gate."
    }
  },
  {
    id: "mission-completion-requires-evidence",
    surface: "dove.mission",
    objective: "A Dove mission pass must not mark a task completed from a bare completion flag or summary without explicit evidence, artifacts, validation output, or concrete plan-output missions.",
    pressureTest: "Seed a ready mission task, then call record_dove_mission_pass with resultStatus completed and a summary but no evidence or artifacts.",
    acceptanceCriteria: [
      "The mission pass returns needs-completion-evidence and remains proposal-only.",
      "The task remains ready instead of completed.",
      "No runtime result entry is persisted for the rejected completion.",
      "The response names the missing evidence/artifact action."
    ],
    failureMode: "fake-mission-completion-without-evidence",
    failureReflection: {
      lessonCaptureRequired: true,
      lessonCommand: "project:dove.lessons",
      remediationRequired: true,
      operatorFollowThroughRequired: true,
      regressionArtifacts: [
        "scripts/validate-workflow-goals.mjs",
        "tests/integration/workflow-goals.test.mjs",
        "tests/integration/mcp-tools.test.mjs"
      ],
      remediationTargets: [
        "src/core/task-workflow.mjs",
        "src/core/workflow-goals.mjs",
        "src/core/result-cards.mjs"
      ],
      summary: "If mission completion can succeed without evidence, repair the mission pass contract and keep this pressure scenario executable."
    }
  },
  {
    id: "auto-read-only-step-cannot-complete",
    surface: "dove.auto",
    objective: "A confirmed Dove auto run must not treat read-only status or lesson queries as durable task progress or completion.",
    pressureTest: "Seed a ready task and confirm run_dove_auto with a single dove.status step marked completeTask.",
    acceptanceCriteria: [
      "The auto run returns needs-explicit-progress-step.",
      "No auto iteration is recorded or persisted as completed work.",
      "The task remains ready instead of in-progress, blocked, or completed.",
      "The response requires an explicit write/generation/review step."
    ],
    failureMode: "read-only-auto-step-fake-completion",
    failureReflection: {
      lessonCaptureRequired: true,
      lessonCommand: "project:dove.lessons",
      remediationRequired: true,
      operatorFollowThroughRequired: true,
      regressionArtifacts: [
        "scripts/validate-workflow-goals.mjs",
        "tests/integration/workflow-goals.test.mjs",
        "tests/integration/mcp-tools.test.mjs"
      ],
      remediationTargets: [
        "src/core/task-workflow.mjs",
        "src/core/workflow-goals.mjs",
        "src/core/result-cards.mjs"
      ],
      summary: "If read-only auto steps can complete tasks, repair auto step classification and keep this pressure scenario executable."
    }
  },
  {
    id: "experience-blocked-audit-not-bridged",
    surface: "dove.experience",
    objective: "An experience result with blocked audit integrity must not be reported as a bridged claim update.",
    pressureTest: "Seed a task and call run_experience_workflow with an incomplete result that lacks required evidence and methodology.",
    acceptanceCriteria: [
      "The workflow returns needs-review rather than bridged.",
      "The audit verdict is blocked and integrity flags are visible.",
      "Any bridge entry is held rather than applied.",
      "No claim state is upgraded from blocked audit evidence."
    ],
    failureMode: "blocked-experiment-audit-reported-as-bridged",
    failureReflection: {
      lessonCaptureRequired: true,
      lessonCommand: "project:dove.lessons",
      remediationRequired: true,
      operatorFollowThroughRequired: true,
      regressionArtifacts: [
        "scripts/validate-workflow-goals.mjs",
        "tests/integration/workflow-goals.test.mjs",
        "tests/integration/evidence-integrity.test.mjs"
      ],
      remediationTargets: [
        "src/core/experience-workflow.mjs",
        "src/core/workflow-goals.mjs",
        "src/core/result-cards.mjs"
      ],
      summary: "If blocked experiment audits are presented as bridged results, repair the audit-to-claim bridge and keep this pressure scenario executable."
    }
  },
  {
    id: "plan-completion-requires-executable-children",
    surface: "dove.mission",
    objective: "A completed planning pass must not complete unless it returns explicit executable child missions with contracts.",
    pressureTest: "Seed a plan-stage task, then record a completed mission pass with summary and criteria evidence but no child mission output.",
    acceptanceCriteria: [
      "The mission pass returns plan-output-not-executable and remains proposal-only.",
      "The plan task remains ready instead of completed.",
      "No runtime result entry is persisted for the rejected plan pass.",
      "The response requires explicit executable child missions."
    ],
    failureMode: "plan-pass-completed-without-executable-child-work",
    failureReflection: workflowFailureReflection({
      regressionArtifacts: ["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs", "tests/integration/mcp-tools.test.mjs"],
      remediationTargets: ["src/core/task-workflow.mjs", "src/core/workflow-goals.mjs", "src/core/command-manifest.mjs"],
      summary: "If a plan pass can complete without explicit executable child contracts, repair plan-output gating and keep this pressure scenario executable."
    })
  },
  {
    id: "plan-child-contract-requires-criteria",
    surface: "dove.mission",
    objective: "A plan-derived child mission must not be materialized from a child contract that lacks convergence criteria.",
    pressureTest: "Seed a plan-stage task, then record a completed pass with one child mission whose executionContract omits convergence.criteria.",
    acceptanceCriteria: [
      "The mission pass returns plan-output-not-executable.",
      "The response identifies the child mission as not executable.",
      "The response names convergence.criteria as missing.",
      "No child task is created from the invalid plan output."
    ],
    failureMode: "plan-child-materialized-without-convergence-criteria",
    failureReflection: workflowFailureReflection({
      regressionArtifacts: ["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs", "tests/integration/mcp-tools.test.mjs"],
      remediationTargets: ["src/core/task-workflow.mjs", "src/core/workflow-goals.mjs"],
      summary: "If a plan child can materialize without convergence criteria, repair child executionContract readiness checks and keep this scenario executable."
    })
  },
  {
    id: "status-adjust-completion-requires-criteria",
    surface: "dove.status",
    objective: "A status adjustment must not mark a task complete unless verifiedCriteria covers the execution contract criteria.",
    pressureTest: "Seed a ready task with an executable contract, then apply a confirmed completed status adjustment with summary and evidence but no verifiedCriteria coverage.",
    acceptanceCriteria: [
      "The status adjustment returns rejected.",
      "The rejection contains a verification-failed completion block.",
      "The task remains ready instead of completed.",
      "The response requires verified criteria coverage."
    ],
    failureMode: "status-adjustment-fake-completion-without-criteria",
    failureReflection: workflowFailureReflection({
      regressionArtifacts: ["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs", "tests/integration/dove-query.test.mjs"],
      remediationTargets: ["src/core/task-workflow.mjs", "src/core/dove.mjs", "src/core/workflow-goals.mjs"],
      summary: "If status adjustment can complete without verified criteria, repair the shared completion gate and keep this pressure scenario executable."
    })
  },
  {
    id: "operator-host-result-requires-criteria",
    surface: "dove.operator",
    objective: "A host pass result supplied to the operator must not complete a task without convergence criteria coverage.",
    pressureTest: "Seed a host-pass-required task, then confirm run_dove_operator with a completed taskResult that has evidence but no verifiedCriteria.",
    acceptanceCriteria: [
      "The operator records a verification-failed iteration.",
      "The task becomes blocked with a verification-failed boundary instead of completed.",
      "The operator result is recorded only as a boundary-producing pass.",
      "The response requires verified criteria coverage."
    ],
    failureMode: "operator-host-result-fake-completion-without-criteria",
    failureReflection: workflowFailureReflection({
      regressionArtifacts: ["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs", "tests/integration/mcp-tools.test.mjs"],
      remediationTargets: ["src/core/task-workflow.mjs", "src/core/workflow-goals.mjs"],
      summary: "If operator host results can complete without criteria coverage, repair host-result completion verification and keep this pressure scenario executable."
    })
  },
  {
    id: "auto-completion-requires-criteria",
    surface: "dove.auto",
    objective: "A Dove auto step that produces artifacts must still route to verification failure when verifiedCriteria does not cover the task contract.",
    pressureTest: "Seed a ready task with an executable contract, then run a concrete auto note step marked completeTask without verifiedCriteria.",
    acceptanceCriteria: [
      "The auto run returns verification-failed.",
      "The task becomes blocked rather than completed.",
      "The boundary type is verification-failed.",
      "The response requires verified criteria coverage."
    ],
    failureMode: "auto-artifact-step-fake-completion-without-criteria",
    failureReflection: workflowFailureReflection({
      regressionArtifacts: ["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs", "tests/unit/phase6-hardening.test.mjs"],
      remediationTargets: ["src/core/task-workflow.mjs", "src/core/workflow-goals.mjs"],
      summary: "If auto artifacts can complete tasks without criteria coverage, repair auto completion verification and keep this scenario executable."
    })
  },
  {
    id: "status-routes-missing-execution-contract",
    surface: "dove.status",
    objective: "Status must route an active task without an executable contract to a visible Planner next action instead of treating the task as ordinary mission display.",
    pressureTest: "Seed a ready task, remove its executionContract from durable packet state, then query full Dove status.",
    acceptanceCriteria: [
      "Status returns blocked because executionGaps has a missingContract count.",
      "The first ranked recovery action wraps missing-executable-contract as recoveryPrimaryKind.",
      "The next action points to the Planner/mission surface.",
      "preActionGuidance reports planner as the execution next role."
    ],
    failureMode: "status-hides-missing-executable-contract",
    failureReflection: workflowFailureReflection({
      regressionArtifacts: ["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs", "tests/integration/dove-query.test.mjs"],
      remediationTargets: ["src/core/dove.mjs", "src/core/pre-action-guidance.mjs", "src/core/workflow-goals.mjs"],
      summary: "If status does not rank missing executable contracts as Planner work, repair status routing and keep this pressure scenario executable."
    })
  },
  {
    id: "public-surfaces-stay-flat",
    surface: "dove.status",
    objective: "Dove must not expose public role or mission-board slash surfaces when improving workflow orchestration.",
    pressureTest: "Inspect the public command manifest and assert that planner, builder, reviewer, missions, board, and list surfaces are absent.",
    acceptanceCriteria: [
      "The command manifest contains no dove.planner surface.",
      "The command manifest contains no dove.builder or dove.reviewer surface.",
      "The command manifest contains no dove.missions, dove.board, or dove.list surface.",
      "The existing flat Dove surfaces remain present."
    ],
    failureMode: "public-slash-surface-sprawl",
    failureReflection: workflowFailureReflection({
      regressionArtifacts: ["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs", "tests/integration/mcp-tools.test.mjs"],
      remediationTargets: ["src/core/command-manifest.mjs", "src/core/workflow-goals.mjs"],
      summary: "If role or mission-board slash surfaces appear, remove the public surface sprawl and keep this pressure scenario executable."
    })
  }
];

const CONTRACT_BY_ID = new Map(WORKFLOW_GOAL_CONTRACTS.map((contract) => [contract.id, contract]));

function workflowFailureReflection({ regressionArtifacts, remediationTargets, summary }) {
  return {
    lessonCaptureRequired: true,
    lessonCommand: "project:dove.lessons",
    remediationRequired: true,
    operatorFollowThroughRequired: true,
    regressionArtifacts,
    remediationTargets,
    summary
  };
}

const WORKFLOW_GOAL_CRITERION = "workflow goal convergence criterion";
const WORKFLOW_GOAL_VERIFICATION_PATH = ".dove/evidence/workflow-goal-verification.log";
const WORKFLOW_GOAL_ARTIFACT_PATH = ".dove/evidence/workflow-goal-result.md";

function workflowExecutionContract(overrides = {}) {
  const base = {
    chainType: "engineering-host-pass-verify",
    roleSequence: ["builder", "reviewer"],
    readFirst: [],
    action: "project:dove.auto",
    implementation: ["Produce the workflow goal artifact."],
    files: [],
    materials: {
      requiredInputs: [],
      requiredArtifacts: [],
      sourceRefs: [],
      artifactRefs: []
    },
    convergence: {
      criteria: [WORKFLOW_GOAL_CRITERION],
      verificationCommands: ["node --test tests/integration/workflow-goals.test.mjs"],
      evidenceRequired: [WORKFLOW_GOAL_ARTIFACT_PATH, WORKFLOW_GOAL_VERIFICATION_PATH],
      definitionOfDone: "The workflow goal criterion is covered by explicit verification evidence."
    },
    failureRoutes: [
      { on: "missing-required-materials", boundaryType: "missing-required-materials", nextAction: "project:dove.status", requiredActions: ["provide-required-materials"] },
      { on: "verification-failed", boundaryType: "verification-failed", nextAction: "project:dove.status", requiredActions: ["provide-verified-criteria"] }
    ]
  };
  return {
    ...base,
    ...overrides,
    roleSequence: overrides.roleSequence ?? base.roleSequence,
    readFirst: overrides.readFirst ?? base.readFirst,
    implementation: overrides.implementation ?? base.implementation,
    files: overrides.files ?? base.files,
    materials: {
      ...base.materials,
      ...(overrides.materials ?? {})
    },
    convergence: {
      ...base.convergence,
      ...(overrides.convergence ?? {})
    },
    failureRoutes: overrides.failureRoutes ?? base.failureRoutes
  };
}

function workflowVerifiedCriteria(criterion = WORKFLOW_GOAL_CRITERION) {
  return [{ criterion, status: "verified", evidencePaths: [WORKFLOW_GOAL_VERIFICATION_PATH] }];
}

function writeJson(root, relativePath, value) {
  fs.writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function patchGoalTask(root, packetId, patch = {}) {
  const packetPath = `${ARTIFACT_PATHS.taskPacketsDir}/packets/${packetId}.json`;
  const packet = readJson(root, packetPath);
  const nextPacket = { ...packet, ...patch };
  for (const key of Object.keys(patch)) {
    if (patch[key] === undefined) {
      delete nextPacket[key];
    }
  }
  writeJson(root, packetPath, nextPacket);

  const index = readJson(root, ARTIFACT_PATHS.taskPacketsIndex);
  const nextItems = (index.items ?? []).map((item) => {
    if (item.id !== packetId) {
      return item;
    }
    const nextItem = { ...item, ...patch };
    for (const key of Object.keys(patch)) {
      if (patch[key] === undefined) {
        delete nextItem[key];
      }
    }
    return nextItem;
  });
  writeJson(root, ARTIFACT_PATHS.taskPacketsIndex, { ...index, items: nextItems });
  return nextPacket;
}

class WorkflowGoalValidationError extends Error {
  constructor(failures) {
    const details = failures.map((failure) => {
      const reflection = failure.failureReflection ?? {};
      const remediation = [
        reflection.summary,
        reflection.lessonCaptureRequired ? `Record/update lesson with ${reflection.lessonCommand}.` : null,
        reflection.operatorFollowThroughRequired ? "Record operator follow-through for the failed goal before closing." : null,
        reflection.regressionArtifacts?.length ? `Regression artifacts: ${reflection.regressionArtifacts.join(", ")}` : null
      ].filter(Boolean).join(" ");
      return `- ${failure.id}: ${failure.message}${remediation ? ` ${remediation}` : ""}`;
    }).join("\n");
    super(`Workflow goal validation failed:\n${details}`);
    this.name = "WorkflowGoalValidationError";
    this.failures = failures;
  }
}

export { WorkflowGoalValidationError };

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
}

function assertContract(condition, contract, message) {
  if (!condition) {
    throw new Error(`Workflow goal contract ${contract.id ?? "<missing-id>"} is invalid: ${message}`);
  }
}

export function validateWorkflowGoalContracts(contracts = WORKFLOW_GOAL_CONTRACTS) {
  const seen = new Set();
  for (const contract of contracts) {
    assertContract(contract && typeof contract === "object" && !Array.isArray(contract), { id: "<unknown>" }, "contract must be an object");
    assertContract(typeof contract.id === "string" && contract.id.trim(), contract, "id is required");
    assertContract(!seen.has(contract.id), contract, "id must be unique");
    seen.add(contract.id);
    assertContract(typeof contract.surface === "string" && contract.surface.startsWith("dove."), contract, "surface must name a Dove workflow surface");
    assertContract(typeof contract.objective === "string" && contract.objective.trim(), contract, "objective is required");
    assertContract(typeof contract.pressureTest === "string" && contract.pressureTest.trim(), contract, "pressureTest is required");
    assertContract(normalizeArray(contract.acceptanceCriteria).length >= 3, contract, "at least three acceptance criteria are required");
    assertContract(typeof contract.failureMode === "string" && contract.failureMode.trim(), contract, "failureMode is required");
    const reflection = contract.failureReflection;
    assertContract(reflection && typeof reflection === "object" && !Array.isArray(reflection), contract, "failureReflection is required");
    assertContract(reflection.lessonCaptureRequired === true, contract, "failureReflection.lessonCaptureRequired must be true");
    assertContract(reflection.lessonCommand === "project:dove.lessons", contract, "failureReflection.lessonCommand must be project:dove.lessons");
    assertContract(reflection.remediationRequired === true, contract, "failureReflection.remediationRequired must be true");
    assertContract(reflection.operatorFollowThroughRequired === true, contract, "failureReflection.operatorFollowThroughRequired must be true");
    assertContract(normalizeArray(reflection.regressionArtifacts).length > 0, contract, "failureReflection.regressionArtifacts must name regression gates");
    assertContract(normalizeArray(reflection.remediationTargets).length > 0, contract, "failureReflection.remediationTargets must name likely repair targets");
    assertContract(typeof reflection.summary === "string" && reflection.summary.trim(), contract, "failureReflection.summary is required");
  }
  return {
    status: "passed",
    contractCount: contracts.length,
    contractIds: contracts.map((contract) => contract.id)
  };
}

function parseToolJson(result, action) {
  const text = result?.content?.[0]?.text;
  if (!text) {
    throw new Error(`${action} returned no text content.`);
  }
  if (result.isError === true) {
    throw new Error(`${action} failed: ${text}`);
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed?.presentation === "dove-mcp-result-contract" && parsed.fullResult) {
      return parsed.fullResult;
    }
    return parsed;
  } catch (error) {
    throw new Error(`${action} returned invalid JSON: ${error.message}`);
  }
}

function readJson(root, relativePath) {
  const fullPath = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function expect(condition, message, evidence = {}) {
  if (!condition) {
    const detail = Object.keys(evidence).length > 0 ? ` Evidence: ${JSON.stringify(evidence)}` : "";
    throw new Error(`${message}.${detail}`);
  }
}

function findTask(index, taskId) {
  return (index.items ?? []).find((item) => item.id === taskId) ?? null;
}

function runOperatorHostPassWithoutResultsGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("operator-host-pass-without-results");
  const packetId = "workflow-goal-operator-source";
  const runId = "workflow-goal-operator-run";

  parseToolJson(dispatch(root, "init_dove_goal", {
    id: "workflow-goal-init",
    goal: "Validate workflow goal acceptance gates."
  }), "init_dove_goal");

  parseToolJson(dispatch(root, "create_dove_task", {
    id: packetId,
    title: "Workflow goal source task",
    goal: "Collect source provenance through host tools.",
    status: "ready",
    nextAction: "project:dove.source",
    domain: "paper",
    checklist: false,
    confirmed: true
  }), "create_dove_task");

  const beforeIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex);
  const beforeTask = findTask(beforeIndex, packetId);
  expect(beforeTask?.status === "ready", "Seeded host-pass task must start ready", { status: beforeTask?.status });
  expect(beforeTask?.boundary === null, "Seeded host-pass task must start without boundary", { boundary: beforeTask?.boundary });

  const preview = parseToolJson(dispatch(root, "run_dove_operator", {}), "run_dove_operator preview");
  expect(preview.status === "needs-confirmation", "Operator preview must require confirmation", { status: preview.status });
  expect(preview.autoRunnableTasks === undefined, "Operator preview must stay compact by default", { autoRunnableTasks: preview.autoRunnableTasks });
  expect(preview.hostPassRequiredTasks === undefined, "Operator preview must not return full host-pass arrays by default", { hostPassRequiredTasks: preview.hostPassRequiredTasks });
  expect(Array.isArray(preview.queueSummary?.autoRunnableTaskIds) && preview.queueSummary.autoRunnableTaskIds.length === 0, "Host-pass-only queue must not report auto-runnable work", { queueSummary: preview.queueSummary });
  expect(JSON.stringify(preview.queueSummary?.hostPassRequiredTaskIds ?? []) === JSON.stringify([packetId]), "Operator preview must classify the task as host-pass-required", { queueSummary: preview.queueSummary });
  expect(Array.isArray(preview.writes) && preview.writes.length === 0, "Operator preview must remain proposal-only", { writes: preview.writes });

  const run = parseToolJson(dispatch(root, "run_dove_operator", {
    confirmed: true,
    runId
  }), "run_dove_operator confirmed");
  expect(run.status === "needs-host-results", "Confirmed operator run without taskResults must stop at needs-host-results", { status: run.status });
  expect(run.updatedTasks === undefined, "Confirmed operator run must stay compact by default", { updatedTasks: run.updatedTasks });
  expect(Array.isArray(run.updatedTaskIds) && run.updatedTaskIds.length === 0, "Confirmed operator run without taskResults must not report updated task ids", { updatedTaskIds: run.updatedTaskIds });
  expect(JSON.stringify(run.awaitingResultTaskIds ?? []) === JSON.stringify([packetId]), "Confirmed operator run must report awaiting host result task ids", { awaitingResultTaskIds: run.awaitingResultTaskIds });
  expect(JSON.stringify(run.skippedHostPassTaskIds ?? []) === JSON.stringify([packetId]), "Confirmed operator run must report skipped host-pass task ids", { skippedHostPassTaskIds: run.skippedHostPassTaskIds });
  expect(run.operatorResultSummary?.runtimeRecorded === false, "Confirmed operator run without actual work must not record a runtime result", { runtimeRecorded: run.operatorResultSummary?.runtimeRecorded });
  expect(run.resultCard?.status === "needs-host-results", "Result card must preserve needs-host-results status", { resultCardStatus: run.resultCard?.status });
  expect(!Object.hasOwn(run.resultCard ?? {}, "packetIds"), "Result card must not expose affected packet ids when nothing changed", { resultCardKeys: Object.keys(run.resultCard ?? {}) });
  expect((run.awaitingRequiredActions ?? []).includes("collect-source-provenance"), "Confirmed operator run must return source provenance required action", { awaitingRequiredActions: run.awaitingRequiredActions });
  expect((run.awaitingRequiredActions ?? []).includes("call-register-source-with-sources-array"), "Confirmed operator run must return register-source required action", { awaitingRequiredActions: run.awaitingRequiredActions });

  const afterIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex);
  const afterTask = findTask(afterIndex, packetId);
  expect(afterTask?.status === "ready", "Host-pass task must remain ready after no-result operator run", { status: afterTask?.status });
  expect(afterTask?.boundary === null, "Host-pass task must not get a synthetic awaiting boundary", { boundary: afterTask?.boundary });

  const packet = readJson(root, `${ARTIFACT_PATHS.taskPacketsDir}/packets/${packetId}.json`);
  expect(packet.status === "ready", "Host-pass packet file must remain ready after no-result operator run", { status: packet.status });
  expect(packet.boundary === null, "Host-pass packet file must not get a synthetic boundary", { boundary: packet.boundary });

  const runtimeResults = readJson(root, ARTIFACT_PATHS.runtimeResults);
  const runtimeEntry = (runtimeResults.entries ?? []).find((entry) => entry.id === runId || entry.runId === runId);
  expect(!runtimeEntry, "No runtime result entry may be persisted when no actual operator work happened", { runId, runtimeEntry });

  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      runId,
      previewStatus: preview.status,
      runStatus: run.status,
      updatedTaskCount: run.updatedTaskIds.length,
      runtimeRecorded: run.operatorResultSummary.runtimeRecorded,
      finalTaskStatus: afterTask.status,
      finalBoundary: afterTask.boundary,
      runtimeEntryPersisted: false,
      requiredActions: run.awaitingRequiredActions
    },
    failureReflection: contract.failureReflection
  };
}

function seedGoalWorkspace(root, dispatch, initId = "workflow-goal-init") {
  parseToolJson(dispatch(root, "init_dove_goal", {
    id: initId,
    goal: "Validate workflow goal acceptance gates."
  }), "init_dove_goal");
}

function seedGoalTask(root, dispatch, packetId, fields = {}) {
  return parseToolJson(dispatch(root, "create_dove_task", {
    ...fields,
    id: packetId,
    title: fields.title ?? packetId.replace(/-/g, " "),
    goal: fields.goal ?? "Validate Dove workflow goal behavior.",
    status: fields.status ?? "ready",
    nextAction: fields.nextAction ?? "project:dove.status",
    domain: fields.domain ?? "engineering",
    checklist: false,
    confirmed: true
  }), "create_dove_task");
}

function runMissionCompletionRequiresEvidenceGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("mission-completion-requires-evidence");
  const packetId = "workflow-goal-mission-completion";
  const runId = "workflow-goal-mission-completion-run";
  seedGoalWorkspace(root, dispatch, "workflow-goal-mission-init");
  seedGoalTask(root, dispatch, packetId, { title: "Workflow goal mission completion", nextAction: "project:dove.mission" });

  const rejected = parseToolJson(dispatch(root, "record_dove_mission_pass", {
    packetId,
    runId,
    resultStatus: "completed",
    resultSummary: "The mission claims it is done but provides no evidence."
  }), "record_dove_mission_pass completion without evidence");
  expect(rejected.status === "needs-completion-evidence", "Mission completion without evidence must be rejected", { status: rejected.status });
  expect(rejected.noAutoApply === true && Array.isArray(rejected.writes) && rejected.writes.length === 0, "Rejected mission completion must remain proposal-only", { noAutoApply: rejected.noAutoApply, writes: rejected.writes });
  expect((rejected.requiredActions ?? []).includes("provide-evidence-links-or-artifact-refs-or-verification-evidence"), "Rejected mission completion must request evidence, artifacts, or verification evidence", { requiredActions: rejected.requiredActions });

  const afterIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex);
  const afterTask = findTask(afterIndex, packetId);
  expect(afterTask?.status === "ready", "Task must remain ready after rejected mission completion", { status: afterTask?.status });
  const runtimeResults = readJson(root, ARTIFACT_PATHS.runtimeResults);
  const runtimeEntry = (runtimeResults.entries ?? []).find((entry) => entry.id === runId || entry.runId === runId);
  expect(!runtimeEntry, "Rejected mission completion must not persist a runtime result", { runId, runtimeEntry });

  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      runId,
      rejectedStatus: rejected.status,
      finalTaskStatus: afterTask.status,
      runtimeEntryPersisted: false,
      requiredActions: rejected.requiredActions
    },
    failureReflection: contract.failureReflection
  };
}

function runAutoReadOnlyCannotCompleteGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("auto-read-only-step-cannot-complete");
  const packetId = "workflow-goal-auto-read-only";
  const runId = "workflow-goal-auto-read-only-run";
  seedGoalWorkspace(root, dispatch, "workflow-goal-auto-init");
  seedGoalTask(root, dispatch, packetId, { title: "Workflow goal auto read-only", nextAction: "project:dove.auto" });

  const run = parseToolJson(dispatch(root, "run_dove_auto", {
    packetId,
    confirmed: true,
    runId,
    steps: [{ command: "dove.status", completeTask: true }]
  }), "run_dove_auto read-only completion");
  expect(run.status === "needs-explicit-progress-step", "Read-only auto completion must require an explicit progress step", { status: run.status });
  expect(run.noAutoApply === true && Array.isArray(run.writes) && run.writes.length === 0, "Read-only auto rejection must remain proposal-only", { noAutoApply: run.noAutoApply, writes: run.writes });
  expect(run.result?.iterationCount === 0, "Read-only auto rejection must not record a completed iteration", { iterationCount: run.result?.iterationCount });
  expect((run.requiredActions ?? []).includes("provide-explicit-auto-step"), "Read-only auto rejection must request an explicit progress step", { requiredActions: run.requiredActions });

  const afterIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex);
  const afterTask = findTask(afterIndex, packetId);
  expect(afterTask?.status === "ready", "Read-only auto step must leave task ready", { status: afterTask?.status });
  const runtimeResults = readJson(root, ARTIFACT_PATHS.runtimeResults);
  const runtimeEntry = (runtimeResults.entries ?? []).find((entry) => entry.id === runId || entry.runId === runId);
  expect(!runtimeEntry, "Read-only auto rejection must not persist runtime work", { runId, runtimeEntry });

  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      runId,
      runStatus: run.status,
      iterationCount: run.result.iterationCount,
      finalTaskStatus: afterTask.status,
      runtimeEntryPersisted: false,
      requiredActions: run.requiredActions
    },
    failureReflection: contract.failureReflection
  };
}

function runExperienceBlockedAuditNotBridgedGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("experience-blocked-audit-not-bridged");
  const packetId = "workflow-goal-experience-blocked";
  seedGoalWorkspace(root, dispatch, "workflow-goal-experience-init");
  seedGoalTask(root, dispatch, packetId, { title: "Workflow goal blocked experience", nextAction: "project:dove.experience", domain: "experiment" });

  const result = parseToolJson(dispatch(root, "run_experience_workflow", {
    packetId,
    experimentId: "blocked-audit-experiment",
    goal: "Validate that blocked experiment audits do not bridge claims.",
    claimId: "unseeded-claim",
    result: {
      outcome: "supports",
      summary: "This result is intentionally incomplete."
    }
  }), "run_experience_workflow blocked audit");
  expect(result.status === "needs-review", "Blocked experiment audit must return needs-review", { status: result.status });
  expect(result.audit?.auditVerdict === "blocked", "Incomplete experiment result must have blocked audit verdict", { audit: result.audit });
  expect((result.audit?.integrityFlags ?? []).length > 0, "Blocked audit must expose integrity flags", { integrityFlags: result.audit?.integrityFlags });
  expect(result.bridge?.status !== "applied", "Blocked audit bridge must not be applied", { bridge: result.bridge });

  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      runStatus: result.status,
      auditVerdict: result.audit.auditVerdict,
      integrityFlags: result.audit.integrityFlags,
      bridgeStatus: result.bridge?.status ?? null
    },
    failureReflection: contract.failureReflection
  };
}

function runPlanCompletionRequiresExecutableChildrenGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("plan-completion-requires-executable-children");
  const packetId = "workflow-goal-plan-no-children";
  const runId = "workflow-goal-plan-no-children-run";
  seedGoalWorkspace(root, dispatch, "workflow-goal-plan-no-children-init");
  seedGoalTask(root, dispatch, packetId, {
    title: "Workflow goal plan requires children",
    stage: "plan",
    nextAction: "project:dove.mission",
    executionContract: workflowExecutionContract({
      chainType: "plan-to-executable-missions",
      roleSequence: ["planner", "builder", "reviewer"],
      action: "record_dove_mission_pass",
      implementation: ["Return explicit executable child missions."],
      convergence: {
        criteria: ["Explicit executable child missions returned"],
        evidenceRequired: ["plannedMissions with executionContract"],
        definitionOfDone: "Planning yields executable child contracts."
      },
      failureRoutes: [
        { on: "plan-output-not-executable", boundaryType: "plan-output-not-executable", nextAction: "record_dove_mission_pass", requiredActions: ["provide-executable-child-missions"] }
      ]
    })
  });

  const rejected = parseToolJson(dispatch(root, "record_dove_mission_pass", {
    packetId,
    runId,
    resultStatus: "completed",
    resultSummary: "The plan claims completion without child mission output.",
    verificationEvidencePaths: [WORKFLOW_GOAL_VERIFICATION_PATH],
    verifiedCriteria: workflowVerifiedCriteria("Explicit executable child missions returned")
  }), "record_dove_mission_pass plan completion without children");
  expect(rejected.status === "plan-output-not-executable", "Plan completion without child missions must be rejected", { status: rejected.status });
  expect(rejected.noAutoApply === true && Array.isArray(rejected.writes) && rejected.writes.length === 0, "Rejected plan completion must remain proposal-only", { noAutoApply: rejected.noAutoApply, writes: rejected.writes });
  expect((rejected.requiredActions ?? []).includes("provide-executable-child-missions"), "Rejected plan completion must request executable child missions", { requiredActions: rejected.requiredActions });

  const afterIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex);
  const afterTask = findTask(afterIndex, packetId);
  expect(afterTask?.status === "ready", "Plan task must remain ready after missing child output", { status: afterTask?.status });
  const runtimeResults = readJson(root, ARTIFACT_PATHS.runtimeResults);
  const runtimeEntry = (runtimeResults.entries ?? []).find((entry) => entry.id === runId || entry.runId === runId);
  expect(!runtimeEntry, "Rejected plan completion must not persist a runtime result", { runId, runtimeEntry });

  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      runId,
      rejectedStatus: rejected.status,
      finalTaskStatus: afterTask.status,
      runtimeEntryPersisted: false,
      requiredActions: rejected.requiredActions
    },
    failureReflection: contract.failureReflection
  };
}

function runPlanChildContractRequiresCriteriaGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("plan-child-contract-requires-criteria");
  const packetId = "workflow-goal-plan-child-no-criteria";
  const runId = "workflow-goal-plan-child-no-criteria-run";
  seedGoalWorkspace(root, dispatch, "workflow-goal-plan-child-no-criteria-init");
  seedGoalTask(root, dispatch, packetId, {
    title: "Workflow goal plan child criteria",
    stage: "plan",
    nextAction: "project:dove.mission",
    executionContract: workflowExecutionContract({
      chainType: "plan-to-executable-missions",
      roleSequence: ["planner", "builder", "reviewer"],
      action: "record_dove_mission_pass",
      implementation: ["Return explicit executable child missions."],
      convergence: { criteria: ["Executable child mission contracts validated"] },
      failureRoutes: [{ on: "plan-output-not-executable", boundaryType: "plan-output-not-executable", nextAction: "record_dove_mission_pass", requiredActions: ["provide-executable-child-missions"] }]
    })
  });

  const rejected = parseToolJson(dispatch(root, "record_dove_mission_pass", {
    packetId,
    runId,
    resultStatus: "completed",
    resultSummary: "The plan returns a child mission without convergence criteria.",
    plannedMissions: [{
      id: "workflow-goal-invalid-child",
      title: "Invalid child without criteria",
      summary: "This child is intentionally missing convergence criteria.",
      executionContract: workflowExecutionContract({
        convergence: { criteria: [] }
      })
    }]
  }), "record_dove_mission_pass plan child without criteria");
  expect(rejected.status === "plan-output-not-executable", "Plan child without criteria must be rejected", { status: rejected.status });
  expect((rejected.notExecutable ?? []).length === 1, "Rejected plan output must identify the invalid child mission", { notExecutable: rejected.notExecutable });
  expect((rejected.notExecutable?.[0]?.missing ?? []).includes("convergence.criteria"), "Rejected child mission must name convergence.criteria as missing", { notExecutable: rejected.notExecutable });

  const afterIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex);
  const createdChild = findTask(afterIndex, "workflow-goal-invalid-child");
  expect(!createdChild, "Invalid child mission must not be materialized", { createdChild });

  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      runId,
      rejectedStatus: rejected.status,
      notExecutable: rejected.notExecutable,
      childCreated: Boolean(createdChild)
    },
    failureReflection: contract.failureReflection
  };
}

function runStatusAdjustCompletionRequiresCriteriaGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("status-adjust-completion-requires-criteria");
  const packetId = "workflow-goal-status-no-criteria";
  seedGoalWorkspace(root, dispatch, "workflow-goal-status-no-criteria-init");
  seedGoalTask(root, dispatch, packetId, {
    title: "Workflow goal status criteria gate",
    executionContract: workflowExecutionContract()
  });

  const result = parseToolJson(dispatch(root, "apply_dove_status_adjustments", {
    confirmed: true,
    adjustments: [{
      packetId,
      status: "completed",
      reason: "The status adjustment claims completion with evidence but no criteria coverage.",
      artifactRefs: [WORKFLOW_GOAL_ARTIFACT_PATH],
      verificationEvidencePaths: [WORKFLOW_GOAL_VERIFICATION_PATH]
    }]
  }), "apply_dove_status_adjustments without criteria");
  const rejection = result.rejected?.[0];
  expect(result.status === "rejected", "Status adjustment without criteria coverage must be rejected", { status: result.status });
  expect(rejection?.completionBlock?.status === "verification-failed", "Status adjustment rejection must expose verification-failed", { rejection });
  expect((rejection?.completionBlock?.requiredActions ?? []).includes("provide-verified-criteria"), "Status adjustment rejection must require verified criteria", { rejection });

  const afterIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex);
  const afterTask = findTask(afterIndex, packetId);
  expect(afterTask?.status === "ready", "Status adjustment must leave task ready", { status: afterTask?.status });

  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      adjustmentStatus: result.status,
      rejectionStatus: rejection?.completionBlock?.status,
      finalTaskStatus: afterTask.status,
      requiredActions: rejection?.completionBlock?.requiredActions ?? []
    },
    failureReflection: contract.failureReflection
  };
}

function runOperatorHostResultRequiresCriteriaGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("operator-host-result-requires-criteria");
  const packetId = "workflow-goal-operator-no-criteria";
  const runId = "workflow-goal-operator-no-criteria-run";
  seedGoalWorkspace(root, dispatch, "workflow-goal-operator-no-criteria-init");
  seedGoalTask(root, dispatch, packetId, {
    title: "Workflow goal operator criteria gate",
    nextAction: "project:dove.source",
    domain: "paper",
    executionContract: workflowExecutionContract()
  });

  const run = parseToolJson(dispatch(root, "run_dove_operator", {
    confirmed: true,
    includeQueueDetails: true,
    runId,
    taskResults: [{
      packetId,
      resultStatus: "completed",
      summary: "The host pass claims completion with evidence but no criteria coverage.",
      artifactRefs: [WORKFLOW_GOAL_ARTIFACT_PATH],
      verificationEvidencePaths: [WORKFLOW_GOAL_VERIFICATION_PATH]
    }]
  }), "run_dove_operator host result without criteria");
  const iteration = run.result?.iterations?.find((item) => item.packetId === packetId);
  expect(iteration?.status === "verification-failed", "Operator host result without criteria must record verification-failed iteration", { iteration });
  expect((iteration?.requiredActions ?? []).includes("provide-verified-criteria"), "Operator host result must require verified criteria", { iteration });

  const afterIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex);
  const afterTask = findTask(afterIndex, packetId);
  expect(afterTask?.status === "blocked", "Operator host result without criteria must block the task", { status: afterTask?.status });
  expect(afterTask?.boundary?.type === "verification-failed", "Operator host result must open verification-failed boundary", { boundary: afterTask?.boundary });

  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      runStatus: run.status,
      iterationStatus: iteration?.status,
      finalTaskStatus: afterTask.status,
      boundaryType: afterTask.boundary?.type,
      requiredActions: iteration?.requiredActions ?? []
    },
    failureReflection: contract.failureReflection
  };
}

function runAutoCompletionRequiresCriteriaGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("auto-completion-requires-criteria");
  const packetId = "workflow-goal-auto-no-criteria";
  const runId = "workflow-goal-auto-no-criteria-run";
  seedGoalWorkspace(root, dispatch, "workflow-goal-auto-no-criteria-init");
  seedGoalTask(root, dispatch, packetId, {
    title: "Workflow goal auto criteria gate",
    nextAction: "project:dove.auto",
    executionContract: workflowExecutionContract()
  });

  const run = parseToolJson(dispatch(root, "run_dove_auto", {
    packetId,
    confirmed: true,
    runId,
    steps: [{
      command: "dove.note",
      completeTask: true,
      args: {
        noteId: "workflow-goal-auto-note",
        title: "Workflow goal auto note",
        summary: "The auto step produces a real note artifact but no verifiedCriteria coverage.",
        skipFollowThroughReady: true
      }
    }]
  }), "run_dove_auto artifact completion without criteria");
  expect(run.status === "verification-failed", "Auto artifact completion without criteria must return verification-failed", { status: run.status });
  expect(run.boundary?.type === "verification-failed", "Auto artifact completion must open verification-failed boundary", { boundary: run.boundary });
  expect((run.boundary?.requiredActions ?? []).includes("provide-verified-criteria"), "Auto artifact completion must require verified criteria", { boundary: run.boundary });

  const afterIndex = readJson(root, ARTIFACT_PATHS.taskPacketsIndex);
  const afterTask = findTask(afterIndex, packetId);
  expect(afterTask?.status === "blocked", "Auto artifact completion without criteria must block the task", { status: afterTask?.status });

  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      runStatus: run.status,
      finalTaskStatus: afterTask.status,
      boundaryType: run.boundary?.type,
      requiredActions: run.boundary?.requiredActions ?? []
    },
    failureReflection: contract.failureReflection
  };
}

function runStatusRoutesMissingExecutionContractGoal(root, dispatch) {
  const contract = CONTRACT_BY_ID.get("status-routes-missing-execution-contract");
  const packetId = "workflow-goal-missing-contract";
  seedGoalWorkspace(root, dispatch, "workflow-goal-missing-contract-init");
  seedGoalTask(root, dispatch, packetId, {
    title: "Workflow goal missing contract",
    nextAction: "project:dove.status"
  });
  patchGoalTask(root, packetId, { executionContract: undefined });

  const status = parseToolJson(dispatch(root, "query_dove_status", { detail: "full" }), "query_dove_status missing contract");
  const nextAction = status.dailyHome?.nextActions?.[0];
  expect(status.projectSummary?.status === "blocked" || status.dashboard?.returnReadiness?.status === "blocked", "Status must be blocked when execution contract is missing", { projectSummary: status.projectSummary, returnReadiness: status.dashboard?.returnReadiness });
  expect(status.dailyHome?.executionGaps?.counts?.missingContract === 1, "Status execution gaps must count the missing contract task", { executionGaps: status.dailyHome?.executionGaps });
  expect(nextAction?.kind === "recover-current-work" && nextAction?.recoveryPrimaryKind === "missing-executable-contract", "Status must rank a recovery card for the missing executable contract first", { nextAction });
  expect(nextAction?.packetId === packetId && nextAction?.command === "project:dove.mission", "Missing contract recovery card must route to Planner mission surface", { nextAction });
  expect(status.preActionGuidance?.workflowFrame?.executionGuidance?.nextRole === "planner", "Pre-action guidance must identify planner as next role", { executionGuidance: status.preActionGuidance?.workflowFrame?.executionGuidance });

  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      packetId,
      returnStatus: status.projectSummary?.status ?? status.dashboard?.returnReadiness?.status,
      missingContractCount: status.dailyHome.executionGaps.counts.missingContract,
      firstActionKind: nextAction.kind,
      recoveryPrimaryKind: nextAction.recoveryPrimaryKind,
      executionNextRole: status.preActionGuidance.workflowFrame.executionGuidance.nextRole
    },
    failureReflection: contract.failureReflection
  };
}

function runPublicSurfacesStayFlatGoal() {
  const contract = CONTRACT_BY_ID.get("public-surfaces-stay-flat");
  const publicIds = COMMAND_SURFACES.map((surface) => surface.id);
  const forbidden = ["dove.planner", "dove.builder", "dove.reviewer", "dove.missions", "dove.board", "dove.list"];
  const presentForbidden = forbidden.filter((id) => publicIds.includes(id));
  const required = ["dove.init", "dove.mission", "dove.auto", "dove.status", "dove.operator", "dove.lessons", "dove.review"];
  const missingRequired = required.filter((id) => !publicIds.includes(id));
  expect(presentForbidden.length === 0, "Forbidden public Dove command surfaces must remain absent", { presentForbidden });
  expect(missingRequired.length === 0, "Required flat Dove command surfaces must remain present", { missingRequired });

  return {
    id: contract.id,
    status: "passed",
    surface: contract.surface,
    objective: contract.objective,
    acceptanceCriteria: contract.acceptanceCriteria,
    evidence: {
      surfaceCount: publicIds.length,
      forbiddenAbsent: forbidden,
      requiredPresent: required
    },
    failureReflection: contract.failureReflection
  };
}

const WORKFLOW_GOAL_RUNNERS = {
  "operator-host-pass-without-results": runOperatorHostPassWithoutResultsGoal,
  "mission-completion-requires-evidence": runMissionCompletionRequiresEvidenceGoal,
  "auto-read-only-step-cannot-complete": runAutoReadOnlyCannotCompleteGoal,
  "experience-blocked-audit-not-bridged": runExperienceBlockedAuditNotBridgedGoal,
  "plan-completion-requires-executable-children": runPlanCompletionRequiresExecutableChildrenGoal,
  "plan-child-contract-requires-criteria": runPlanChildContractRequiresCriteriaGoal,
  "status-adjust-completion-requires-criteria": runStatusAdjustCompletionRequiresCriteriaGoal,
  "operator-host-result-requires-criteria": runOperatorHostResultRequiresCriteriaGoal,
  "auto-completion-requires-criteria": runAutoCompletionRequiresCriteriaGoal,
  "status-routes-missing-execution-contract": runStatusRoutesMissingExecutionContractGoal,
  "public-surfaces-stay-flat": runPublicSurfacesStayFlatGoal
};

export function validateWorkflowGoals(options = {}) {
  const { createRoot, cleanupRoot, dispatch } = options;
  if (typeof createRoot !== "function") {
    throw new Error("validateWorkflowGoals requires createRoot.");
  }
  if (typeof cleanupRoot !== "function") {
    throw new Error("validateWorkflowGoals requires cleanupRoot.");
  }
  if (typeof dispatch !== "function") {
    throw new Error("validateWorkflowGoals requires dispatch.");
  }
  const dispatchForGoal = (root, name, args = {}) => dispatch(root, name, { ...args, resultMode: args.resultMode ?? "full" });

  validateWorkflowGoalContracts();

  const results = [];
  const failures = [];
  for (const contract of WORKFLOW_GOAL_CONTRACTS) {
    const runner = WORKFLOW_GOAL_RUNNERS[contract.id];
    if (!runner) {
      failures.push({
        id: contract.id,
        message: "No executable workflow-goal runner is registered.",
        failureReflection: contract.failureReflection
      });
      continue;
    }

    const root = createRoot(`dove-workflow-goal-${contract.id}-`);
    try {
      results.push(runner(root, dispatchForGoal));
    } catch (error) {
      failures.push({
        id: contract.id,
        message: error instanceof Error ? error.message : String(error),
        failureMode: contract.failureMode,
        failureReflection: contract.failureReflection
      });
    } finally {
      cleanupRoot(root);
    }
  }

  if (failures.length > 0) {
    throw new WorkflowGoalValidationError(failures);
  }

  return {
    status: "passed",
    goalCount: results.length,
    contracts: WORKFLOW_GOAL_CONTRACTS.map((contract) => ({
      id: contract.id,
      surface: contract.surface,
      objective: contract.objective,
      failureMode: contract.failureMode,
      failureReflection: contract.failureReflection
    })),
    results
  };
}
