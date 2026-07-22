import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { COMMAND_SURFACES } from "./command-manifest.mjs";

function reflection(regressionArtifacts, remediationTargets, summary) {
  return { remediationRequired: true, regressionArtifacts, remediationTargets, summary };
}

export const WORKFLOW_GOAL_CONTRACTS = Object.freeze([
  { id: "mission-contract-materializes-without-execution", surface: "dove.mission", objective: "A mission persists only an exactly approved schema 9 contract.", acceptanceCriteria: ["proposal is zero-write", "bare or stale confirmation is rejected", "exact replay writes only the mission contract"], failureReflection: reflection(["scripts/validate-workflow-goals.mjs", "tests/integration/workflow-goals.test.mjs"], ["src/core/mission-contracts.mjs"], "Restore exact proposal replay and minimal mission persistence.") },
  { id: "experience-blocked-audit-not-bridged", surface: "dove.experience", objective: "A blocked experiment audit fails before result or claim bridge writes.", acceptanceCriteria: ["integrity flags reject claim bridging", "rejection is zero-write", "no result or bridge artifact is created"], failureReflection: reflection(["scripts/validate-workflow-goals.mjs", "tests/integration/domain-artifacts.test.mjs"], ["src/core/retained-domain-workflows.mjs"], "Restore complete domain preflight before the first write.") },
  { id: "status-rejects-legacy-packet-state", surface: "dove.status", objective: "Status refuses a legacy marker without importing or changing it.", acceptanceCriteria: ["legacy state requires archive-reset", "the tree is unchanged", "no schema 9 manifest or mission is synthesized"], failureReflection: reflection(["scripts/validate-workflow-goals.mjs", "tests/integration/workspace-schema.test.mjs"], ["src/core/workspace-schema.mjs", "src/core/mission-queries.mjs"], "Restore strict shallow legacy classification and zero-write reads.") },
  { id: "public-surfaces-stay-flat", surface: "dove.status", objective: "Dove exposes exactly the twelve approved flat command surfaces.", acceptanceCriteria: ["twelve approved commands are present", "no retired command is present", "the command order is canonical"], failureReflection: reflection(["scripts/validate-workflow-goals.mjs", "scripts/validate-commands.mjs"], ["src/core/command-manifest.mjs"], "Restore the exact schema 9 command inventory.") }
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
  const text = resolved?.content?.[0]?.text;
  if (!text) throw new Error(`${action} returned no result.`);
  if (resolved.isError) throw new Error(`${action} failed: ${text}`);
  return JSON.parse(text);
}

async function expectError(result, pattern, action) {
  const resolved = await result;
  const text = resolved?.content?.[0]?.text ?? "";
  if (resolved?.isError !== true || !pattern.test(text)) throw new Error(`${action} did not fail as expected: ${text}`);
  return text;
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
  const missionId = "workflow-goal-mission-handoff";
  const args = { missionId, goal: "Materialize a minimal mission contract.", completionCriteria: ["contract persisted"], evidenceRequirements: [] };
  let approvalCalls = 0;
  const created = await toolResult(dispatch(root, "create_dove_mission", args, {
    requestCheckpointApproval: async () => {
      approvalCalls += 1;
      return "accept";
    }
  }), "mission checkpoint");
  const rejectedId = `${missionId}-rejected`;
  const beforeRejected = snapshot(root);
  const declined = await toolResult(dispatch(root, "create_dove_mission", { ...args, missionId: rejectedId }, {
    requestCheckpointApproval: async () => "decline"
  }), "declined mission checkpoint");
  if (JSON.stringify(snapshot(root)) !== JSON.stringify(beforeRejected)) throw new Error("declined mission checkpoint changed the tree");
  const unsupported = await expectError(dispatch(root, "create_dove_mission", { ...args, missionId: `${rejectedId}-unsupported` }), /requires an MCP client with elicitation support/u, "mission checkpoint without elicitation");
  return { id: "mission-contract-materializes-without-execution", status: "passed", evidence: { approvalCalls, materializedStatus: created.status, declineStatus: declined.status, declineZeroWrite: true, unsupportedClientRejected: unsupported.includes("elicitation support"), missionAbsentAfterRejectedCheckpoints: !fs.existsSync(path.join(root, ".dove/missions", `${rejectedId}.json`)), persistedPath: `.dove/missions/${missionId}.json`, legacyStateAbsent: !["state.json", "task-packets", "orchestration", "runtime", "workspace"].some((leaf) => fs.existsSync(path.join(root, ".dove", leaf))) } };
}

async function experienceGoal(root, dispatch) {
  const created = await toolResult(dispatch(root, "create_dove_mission", { missionId: "workflow-goal-experience-blocked", goal: "Reject blocked audit bridging.", completionCriteria: [], evidenceRequirements: [] }, { requestCheckpointApproval: async () => "accept" }), "experience mission");
  const missionPath = path.join(root, ".dove/missions/workflow-goal-experience-blocked.json");
  const mission = JSON.parse(fs.readFileSync(missionPath, "utf8"));
  if (created.status !== "materialized") throw new Error("experience mission was not materialized");
  fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
  fs.writeFileSync(path.join(root, "outputs/evidence.md"), "Current host-produced evidence.\n");
  const evidenceSha256 = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "outputs/evidence.md"))).digest("hex");
  await toolResult(dispatch(root, "ingest_execution_receipt", { receiptId: "seed-experience-evidence", missionId: mission.missionId, contractDigest: mission.contractDigest, summary: "Seed workflow evidence.", artifacts: [{ path: "outputs/evidence.md", kind: "document", sha256: evidenceSha256 }], validations: [], criteriaSatisfied: [], producedAt: new Date().toISOString() }), "seed evidence receipt");
  await toolResult(dispatch(root, "upsert_draft", { missionId: mission.missionId, draftId: "evidence", body: "Current host-produced evidence.", artifactRefs: ["outputs/evidence.md"] }), "seed draft");
  const before = snapshot(root);
  const error = await expectError(dispatch(root, "run_experience_workflow", { missionId: mission.missionId, experimentId: "blocked", goal: "Check audit.", hypothesis: "Flags block bridging.", protocol: "Inspect current evidence.", successCriteria: ["No blocked bridge"], result: "Blocked result.", resultEvidenceRefs: ["artifact:.dove/drafts/evidence.md"], auditFindings: ["Integrity is incomplete."], integrityFlags: ["methodology-incomplete"], claimId: "missing", bridgeReason: "Must fail." }), /cannot bridge to a claim while integrity flags remain/u, "blocked experiment");
  if (JSON.stringify(snapshot(root)) !== JSON.stringify(before)) throw new Error("blocked experiment changed the tree");
  return { id: "experience-blocked-audit-not-bridged", status: "passed", evidence: { zeroWrite: true, resultAbsent: !fs.existsSync(path.join(root, ".dove/experiments/blocked.result.json")), bridgeAbsent: true, rejection: error } };
}

async function legacyStatusGoal(root, dispatch) {
  fs.mkdirSync(path.join(root, ".dove"), { recursive: true });
  fs.writeFileSync(path.join(root, ".dove/state.json"), '{"version":6}\n');
  const before = snapshot(root);
  const error = await expectError(dispatch(root, "query_dove_status", {}), /recorded internal state is unavailable or no longer current/u, "legacy status");
  if (JSON.stringify(snapshot(root)) !== JSON.stringify(before)) throw new Error("legacy status changed the tree");
  return { id: "status-rejects-legacy-packet-state", status: "passed", evidence: { staleStateRejected: error.includes("no longer current"), zeroWrite: true, manifestAbsent: !fs.existsSync(path.join(root, ".dove/manifest.json")), missionsAbsent: !fs.existsSync(path.join(root, ".dove/missions")), legacyPacketNotPresented: true } };
}

function surfaceGoal() {
  const required = ["dove.init", "dove.mission", "dove.status", "dove.lessons", "dove.version", "dove.source", "dove.note", "dove.figure", "dove.experience", "dove.draft", "dove.review", "dove.rebuttal"];
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
  const runners = [missionGoal, experienceGoal, legacyStatusGoal, surfaceGoal];
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
