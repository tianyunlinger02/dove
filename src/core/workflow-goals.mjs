import fs from "node:fs";
import path from "node:path";

import { COMMAND_SURFACES } from "./command-manifest.mjs";
import { manageDoveWorkspace } from "./mission-contracts.mjs";
import { runWithMutationContext } from "./mutation-backend.mjs";

function reflection(regressionArtifacts, remediationTargets, summary) {
  return { remediationRequired: true, regressionArtifacts, remediationTargets, summary };
}

export const WORKFLOW_GOAL_CONTRACTS = Object.freeze([
  { id: "mission-contract-materializes-without-execution", surface: "dove.mission", objective: "An explicit mission checkpoint persists one current-schema direct Mission contract without executing host work.", acceptanceCriteria: ["explicit invocation elicits once and ends terminal", "decline is zero-write", "the direct Mission contract is persisted atomically"], failureReflection: reflection(["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs"], ["src/core/mission-contracts.mjs", "src/core/operation-registry.mjs", "src/mcp/handlers.mjs"], "Restore terminal explicit mission checkpoint handling and direct Mission contract persistence.") },
  { id: "status-defaults-to-whole-workspace-briefing", surface: "dove.status", objective: "Status returns an executive whole-workspace briefing with a bounded public task chain by default.", acceptanceCriteria: ["multiple missions do not require implicit latest selection", "public one-based workstream, requirement, and work-item relationships remain explicitly aligned", "raw durable graph fields stay internal and the query is zero-write"], failureReflection: reflection(["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs"], ["src/core/mission-queries.mjs", "src/core/public-reports.mjs", "src/mcp/handlers.mjs"], "Restore the default whole-workspace briefing and bounded public task-chain alignment without exposing the internal graph.") },
  { id: "experiment-result-replays-frozen-protocol", surface: "dove.experiment", objective: "An experiment result must replay the exact frozen protocol before any result write.", acceptanceCriteria: ["changed protocol fields are rejected", "rejection is zero-write", "no result record is created"], failureReflection: reflection(["scripts/validate-workflow-goals.mjs", "tests/integration/domain-artifacts.test.mjs"], ["src/core/retained-domain-workflows.mjs"], "Restore exact frozen-protocol preflight before the first result write.") },
  { id: "status-rejects-legacy-packet-state", surface: "dove.status", objective: "Status refuses a legacy marker without importing or changing it.", acceptanceCriteria: ["legacy state requires archive-reset", "the tree is unchanged", "no current-schema manifest or mission is synthesized"], failureReflection: reflection(["scripts/validate-workflow-goals.mjs", "tests/integration/workspace-schema.test.mjs"], ["src/core/workspace-schema.mjs", "src/core/mission-queries.mjs"], "Restore strict shallow legacy classification and zero-write reads.") },
  { id: "public-surfaces-stay-flat", surface: "dove.status", objective: "Dove exposes exactly the twelve approved flat command surfaces.", acceptanceCriteria: ["twelve approved commands are present", "no retired command is present", "the command order is canonical"], failureReflection: reflection(["scripts/validate-workflow-goals.mjs", "scripts/validate-commands.mjs"], ["src/core/command-manifest.mjs"], "Restore the exact current-schema command inventory.") }
]);

class WorkflowGoalValidationError extends Error {
  constructor(failures) {
    super(`Workflow goal validation failed:\n${failures.map((item) => `- ${item.id}: ${item.message}`).join("\n")}`);
    this.name = "WorkflowGoalValidationError";
    this.failures = failures;
  }
}

export { WorkflowGoalValidationError };

async function toolResult(result, action) {
  const resolved = await result;
  const envelope = resolved?.structuredContent;
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) || !envelope.report || !envelope.hostControl) throw new Error(`${action} returned no structured public envelope.`);
  if (resolved.isError) throw new Error(`${action} failed: ${envelope.report.message ?? "The requested action failed."}`);
  return envelope;
}

async function expectError(result, pattern, action) {
  const resolved = await result;
  const envelope = resolved?.structuredContent;
  const message = envelope && typeof envelope === "object" && !Array.isArray(envelope) && typeof envelope.report?.message === "string" ? envelope.report.message : "";
  if (resolved?.isError !== true || !pattern.test(message)) throw new Error(`${action} did not fail as expected: ${message}`);
  return message;
}

function initializeValidationWorkspace(root) {
  const proposal = manageDoveWorkspace(root, {
    operation: "initialize",
    mainline: "Validate the bounded Dove workflow contracts.",
    mutationMode: "direct-process"
  });
  return runWithMutationContext(root, {
    actionId: "manage-dove-workspace",
    mutationMode: "direct-process",
    hostId: "workflow-goal-validation"
  }, () => manageDoveWorkspace(root, proposal.confirmation.confirmArgs));
}

function snapshot(root) {
  const output = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(fullPath);
      else output[path.relative(root, fullPath).split(path.sep).join("/")] = entry.isSymbolicLink() ? `link:${fs.readlinkSync(fullPath)}` : fs.readFileSync(fullPath).toString("base64");
    }
  };
  visit(root);
  return output;
}

async function missionGoal(root, dispatch) {
  initializeValidationWorkspace(root);
  const args = {
    operation: "create-root",
    mode: "ordinary",
    goal: "Materialize a minimal mission contract.",
    requirements: ["Persist the current mission requirement."],
    assumptions: [],
    completionCriteria: ["contract persisted"],
    evidenceRequirements: []
  };
  let approvalCalls = 0;
  const created = await toolResult(dispatch(root, "manage_dove_mission", args, {
    requestCheckpointApproval: async () => {
      approvalCalls += 1;
      return "accept";
    }
  }), "explicit mission checkpoint");
  const missionFile = fs.readdirSync(path.join(root, ".dove/missions"))[0];
  const persistedMission = JSON.parse(fs.readFileSync(path.join(root, ".dove/missions", missionFile), "utf8"));
  const missionId = persistedMission.missionId;
  if (persistedMission.requirements[0] !== "Persist the current mission requirement.") throw new Error("direct Mission requirements are not current");

  const checkpointArgs = {
    ...args,
    operation: "branch",
    goal: "Continue the workflow validation through an explicit child mission.",
    parentMissionNumber: 1,
    branchKind: "continuation",
    branchReason: "Validate the explicit child checkpoint without changing the approved parent.",
    stopParentReason: "Stop the parent only if the explicit child checkpoint is accepted."
  };
  const beforeRejected = snapshot(root);
  const declined = await toolResult(dispatch(root, "manage_dove_mission", checkpointArgs, {
    requestCheckpointApproval: async () => "decline"
  }), "declined supersession checkpoint");
  if (JSON.stringify(snapshot(root)) !== JSON.stringify(beforeRejected)) throw new Error("declined mission checkpoint changed the tree");
  const unsupported = await expectError(dispatch(root, "manage_dove_mission", checkpointArgs), /requires an MCP client with elicitation support/u, "mission checkpoint without elicitation");
  if (approvalCalls !== 1 || created.hostControl?.classification?.continuation !== "terminal" || created.hostControl?.classification?.terminal !== true) throw new Error("explicit mission checkpoint did not return one terminal approval result");
  return { id: "mission-contract-materializes-without-execution", status: "passed", evidence: { approvalCalls, terminal: true, materializedStatus: created.report.status, declineStatus: declined.report.status, declineZeroWrite: true, unsupportedClientRejected: unsupported.includes("elicitation support"), missionAbsentAfterRejectedCheckpoints: fs.readdirSync(path.join(root, ".dove/missions")).length === 1, directMissionContractBound: true, persistedPath: `.dove/missions/${missionId}.json`, legacyStateAbsent: !["state.json", "task-packets", "orchestration", "runtime", "workspace"].some((leaf) => fs.existsSync(path.join(root, ".dove", leaf))) } };
}

async function wholeWorkspaceStatusGoal(root, dispatch) {
  initializeValidationWorkspace(root);
  await toolResult(dispatch(root, "manage_dove_mission", {
    operation: "create-root",
    mode: "ordinary",
    goal: "Create the first status graph mission.",
    requirements: ["Represent the first mission in status."],
    completionCriteria: [], evidenceRequirements: []
  }, { requestCheckpointApproval: async () => "accept" }), "first status mission");
  await toolResult(dispatch(root, "manage_dove_mission", {
    operation: "create-root",
    mode: "ordinary",
    goal: "Create the second status graph mission.",
    requirements: ["Represent the second mission in status."],
    completionCriteria: [], evidenceRequirements: []
  }, { requestCheckpointApproval: async () => "accept" }), "second status mission");
  const before = snapshot(root);
  const statusEnvelope = await toolResult(dispatch(root, "query_dove_status", { operation: "status", detail: "full" }), "whole-workspace status");
  const status = statusEnvelope.report;
  if (JSON.stringify(snapshot(root)) !== JSON.stringify(before)) throw new Error("whole-workspace status changed the tree");
  const appendix = status.technicalAppendix;
  if (status.currentSituation?.scope !== "workspace portfolio" || appendix?.bounded !== true || appendix.workstreams?.totalCount !== 2 || appendix.requirements?.totalCount !== 2 || appendix.workItems?.totalCount !== 0) throw new Error("status did not return the complete bounded public task chain");
  if (appendix.workstreams.items.some((item) => !Number.isSafeInteger(item.number) || item.number < 1) || appendix.requirements.items.some((item) => !Number.isSafeInteger(item.workstreamNumber) || item.workstreamNumber < 1) || appendix.workItems.items.some((item) => !Number.isSafeInteger(item.workstreamNumber) || item.workstreamNumber < 1)) throw new Error("status task-chain numbering is not public and one-based");
  if (Object.hasOwn(status, "current") || Object.hasOwn(status, "durable") || Object.hasOwn(status, "workspaceGraph")) throw new Error("status exposed the internal workspace graph");
  return { id: "status-defaults-to-whole-workspace-briefing", status: "passed", evidence: { zeroWrite: true, missionScope: status.currentSituation.scope, missionCount: appendix.workstreams.totalCount, requirementCount: appendix.requirements.totalCount, workItemCount: appendix.workItems.totalCount, oneBasedNumbering: true, internalGraphHidden: true } };
}

async function experimentGoal(root, dispatch) {
  initializeValidationWorkspace(root);
  const created = await toolResult(dispatch(root, "manage_dove_mission", {
    operation: "create-root",
    mode: "ordinary",
    goal: "Reject an experiment result that does not match its frozen named checks.",
    completionCriteria: ["The mismatched result is rejected before any result record is written."],
    evidenceRequirements: []
  }, { requestCheckpointApproval: async () => "accept" }), "experiment mission");
  if (created.report.status !== "materialized") throw new Error("experiment mission was not materialized");
  fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
  fs.writeFileSync(path.join(root, "outputs/evidence.md"), "Current host-produced evidence.\n");
  await toolResult(dispatch(root, "close_host_outcome", { missionNumber: 1, attemptId: "seed-experiment-evidence", status: "completed", summary: "Seed workflow evidence.", artifactPaths: ["outputs/evidence.md"], validationPaths: [], facts: [] }), "seed evidence outcome");
  const protocol = {
    question: "Does the bounded workflow preserve its evidence contract?",
    hypothesis: "The current workflow preserves the declared evidence contract.",
    procedure: ["Run one bounded validation pass.", "Record the complete outcome."],
    inputs: ["outputs/evidence.md"], comparisons: ["current-contract"], metrics: ["completion"],
    successConditions: ["The declared evidence remains current."], stopConditions: ["Stop after one bounded validation pass."],
    constraints: ["Use the frozen input unchanged."], expectedArtifacts: ["outputs/evidence.md"], frozenAt: new Date().toISOString()
  };
  await toolResult(dispatch(root, "record_dove_experiment", { missionNumber: 1, experimentId: "protocol-replay", protocol }), "freeze experiment protocol");
  const before = snapshot(root);
  const changedProtocol = { ...protocol, constraints: ["Changed after protocol freeze."] };
  const result = {
    status: "completed", outcome: "The bounded validation completed.",
    measurements: [{ metric: "completion", value: 1, comparison: "current-contract" }],
    artifactRefs: ["outputs/evidence.md"], validationRefs: [],
    denominator: { total: 1, successful: 1, failed: 0, excluded: 0 }, failures: [], deviations: [],
    limitations: ["The result covers one bounded fixture."], recordedAt: new Date().toISOString()
  };
  const error = await expectError(dispatch(root, "record_dove_experiment", { missionNumber: 1, experimentId: "protocol-replay", protocol: changedProtocol, result }), /experiment is immutable once frozen.*replay the exact protocol/iu, "changed experiment protocol replay");
  if (JSON.stringify(snapshot(root)) !== JSON.stringify(before)) throw new Error("changed experiment protocol replay changed the tree");
  return { id: "experiment-result-replays-frozen-protocol", status: "passed", evidence: { zeroWrite: true, resultAbsent: !fs.existsSync(path.join(root, ".dove/experiments/protocol-replay.result.json")), rejection: error } };
}

async function legacyStatusGoal(root, dispatch) {
  fs.mkdirSync(path.join(root, ".dove"), { recursive: true });
  fs.writeFileSync(path.join(root, ".dove/state.json"), '{"version":6}\n');
  const before = snapshot(root);
  const error = await expectError(dispatch(root, "query_dove_status", { operation: "status" }), /recorded internal state is unavailable or no longer current/u, "legacy status");
  if (JSON.stringify(snapshot(root)) !== JSON.stringify(before)) throw new Error("legacy status changed the tree");
  return { id: "status-rejects-legacy-packet-state", status: "passed", evidence: { staleStateRejected: error.includes("no longer current"), zeroWrite: true, manifestAbsent: !fs.existsSync(path.join(root, ".dove/manifest.json")), missionsAbsent: !fs.existsSync(path.join(root, ".dove/missions")), legacyPacketNotPresented: true } };
}

function surfaceGoal() {
  const required = ["dove.workspace", "dove.mission", "dove.status", "dove.lessons", "dove.source", "dove.note", "dove.experience", "dove.experiment", "dove.draft", "dove.figure", "dove.review", "dove.rebuttal"];
  const publicIds = COMMAND_SURFACES.map((item) => item.id);
  if (JSON.stringify(publicIds) !== JSON.stringify(required)) throw new Error(`unexpected command inventory: ${publicIds.join(", ")}`);
  return { id: "public-surfaces-stay-flat", status: "passed", evidence: { surfaceCount: publicIds.length, requiredPresent: required, forbiddenAbsent: ["dove.auto", "dove.operator", "dove.review-loop"], unexpectedAbsent: true } };
}

export function validateWorkflowGoalContracts(contracts = WORKFLOW_GOAL_CONTRACTS) {
  const ids = new Set();
  for (const contract of contracts) {
    if (!contract?.id || ids.has(contract.id)) throw new Error("Workflow goal ids must be unique non-empty strings.");
    ids.add(contract.id);
    if (!contract.surface?.startsWith("dove.") || !contract.objective || !Array.isArray(contract.acceptanceCriteria) || contract.acceptanceCriteria.length < 3) throw new Error(`Workflow goal contract ${contract.id} is incomplete.`);
    if (!contract.failureReflection?.remediationRequired || !contract.failureReflection.summary || !contract.failureReflection.regressionArtifacts?.length || !contract.failureReflection.remediationTargets?.length) throw new Error(`Workflow goal contract ${contract.id} lacks remediation metadata.`);
  }
  return { status: "passed", contractCount: contracts.length, contractIds: contracts.map((item) => item.id) };
}

export async function validateWorkflowGoals({ createRoot, cleanupRoot, dispatch } = {}) {
  if (typeof createRoot !== "function" || typeof cleanupRoot !== "function" || typeof dispatch !== "function") throw new Error("validateWorkflowGoals requires createRoot, cleanupRoot, and dispatch.");
  validateWorkflowGoalContracts();
  const runners = [missionGoal, wholeWorkspaceStatusGoal, experimentGoal, legacyStatusGoal, surfaceGoal];
  const results = [];
  const failures = [];
  for (const runner of runners) {
    const root = createRoot(`dove-workflow-goal-${runner.name}-`);
    try {
      results.push(await runner(root, dispatch));
    } catch (error) {
      failures.push({ id: runner.name, message: error instanceof Error ? error.message : String(error) });
    } finally {
      cleanupRoot(root);
    }
  }
  if (failures.length) throw new WorkflowGoalValidationError(failures);
  return { status: "passed", goalCount: results.length, contracts: WORKFLOW_GOAL_CONTRACTS, results };
}
