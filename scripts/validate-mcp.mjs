import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { createMcpStdioClient } from "./mcp-stdio-client.mjs";
import { cleanupTempWorkspace, createTempWorkspace } from "./temp-workspace.mjs";

const ROOT = process.cwd();
const serverScriptPath = path.join(ROOT, "mcp", "dove-state-server.mjs");
const tempWorkspace = createTempWorkspace("dove-validate-");
const { call, notify, kill } = createMcpStdioClient({ args: [serverScriptPath], cwd: tempWorkspace });
const VALIDATION_EVIDENCE_PATH = ".dove/evidence/mcp-validation.md";

function writeValidationEvidence(text = "MCP validation inspected substantive local evidence.\n") {
  const fullPath = path.join(tempWorkspace, VALIDATION_EVIDENCE_PATH);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text, "utf8");
  return VALIDATION_EVIDENCE_PATH;
}

function extractJson(result) {
  assert.ok(result.content?.[0]?.text, "Expected text content in MCP tool result");
  assert.notEqual(result.isError, true, result.content[0].text);
  return JSON.parse(result.content[0].text);
}

function unwrapMcpResult(payload) {
  if (payload?.presentation === "dove-mcp-result-contract" && payload.fullResult) {
    return payload.fullResult;
  }
  return payload;
}

async function callToolResult(name, args = {}) {
  const toolArgs = { ...args, resultMode: args.resultMode ?? "full" };
  return call("tools/call", { name, arguments: toolArgs });
}

async function callTool(name, args = {}) {
  return unwrapMcpResult(extractJson(await callToolResult(name, args)));
}

async function callOperationalFailureTool(
  name,
  args = {}
) {
  const result = await callToolResult(name, args);
  assert.equal(
    result.isError,
    true,
    result.content?.[0]?.text
      ?? `${name} must report an operational failure`
  );
  assert.ok(
    result.content?.[0]?.text,
    "Expected text content in MCP tool result"
  );
  return unwrapMcpResult(
    JSON.parse(result.content[0].text)
  );
}

async function proposeMission(args, label) {
  const result = await callToolResult("create_dove_task", args);
  const payload = extractJson(result);
  const proposal = unwrapMcpResult(payload);
  assert.equal(proposal.status, "needs-confirmation", `${label} must require confirmation`);
  assert.ok(payload.confirmation?.confirmArgs, `${label} must expose exact confirmArgs in the MCP confirmation capsule`);
  assert.match(payload.confirmation.confirmArgs.proposalDigest, /^[0-9a-f]{64}$/u);
  return { proposal, confirmArgs: structuredClone(payload.confirmation.confirmArgs) };
}

function requireToolError(result, pattern, label) {
  const text = result.content?.[0]?.text ?? "";
  assert.equal(result.isError, true, `${label} must be rejected`);
  assert.match(text, pattern, `${label} must explain the rejection`);
  return text;
}

function requireTextIncludes(text, needle, label) {
  assert.equal(text.includes(needle), true, `${label} must include ${needle}`);
}

const COMPACT_DISCOVERY_FORBIDDEN_KEYS = new Set([
  "packetId",
  "packetIds",
  "taskPacketId",
  "missionPacketId",
  "taskId",
  "runId",
  "receiptId",
  "boundaryId",
  "boundaryType",
  "implementationBoundaryType",
  "implementationReason",
  "ownerRole",
  "nextRole",
  "handoff",
  "handoffId",
  "handoffSuggestion",
  "actorRole",
  "providerId",
  "providerStatus",
  "providerError",
  "apiKeyEnv",
  "sourceSvgPath",
  "targetFinalSvgPath",
  "finalSvgPath",
  "outputManifestPath",
  "svgContent",
  "qaPath",
  "resultPath",
  "documentPath",
  "artifactPaths",
  "sourceArtifactPath",
  "sourceArtifactPaths",
  "evidencePaths",
  "validationEvidencePaths",
  "verificationEvidencePaths",
  "reviewEvidencePaths",
  "reviewedArtifactPaths",
  "finalPlanPaths",
  "finalResultPaths",
  "artifactRefs",
  "sourceRefs",
  "sourceIds",
  "claimIds",
  "noteIds",
  "experimentIds",
  "reviewConcernIds",
  "rebuttalIssueIds",
  "mutationMode",
  "queueSummary",
  "queuePreview",
  "preActionGuidance",
  "preActionGuidanceSummary",
  "fullDetails",
  "fullResult",
  "diagnostics"
]);

const COMPACT_DISCOVERY_FORBIDDEN_TEXT = /\.dove\/|\bproject:dove\.[a-z0-9.-]+|--packet-id\b|\b(?:packetId|taskPacketId|missionPacketId|taskId|runId|receiptId|boundaryId|boundaryType|mutationMode|patch-plan|direct-process|ownerRole|nextRole|handoff|providerId|sourceSvgPath|targetFinalSvgPath|finalSvgPath|outputManifestPath|svgContent|queueSummary|queuePreview|preActionGuidance|resultCard|fullResult)\b|\b(?:query_dove_status|run_dove_auto|record_dove_mission_pass|run_figure_workflow|run_dove_operator|record_document_evidence|upsert_note|upsert_draft|register_source|run_review_loop|run_dove_review_loop|run_experience_workflow|set_section_status|reset_dove_version|build_rebuttal|build_rebuttal_strategy|normalize_rebuttal_issues|record_operator_lesson|init_dove_goal)\b/u;

function requireCompactDiscoveryPublic(value, pathLabel = "operator tools") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => requireCompactDiscoveryPublic(item, `${pathLabel}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      assert.equal(COMPACT_DISCOVERY_FORBIDDEN_KEYS.has(key) || /(?:^|[A-Za-z])Ids?$/u.test(key), false, `${pathLabel} leaked internal key ${key}`);
      requireCompactDiscoveryPublic(child, `${pathLabel}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && !pathLabel.endsWith(".name")) {
    assert.doesNotMatch(value, COMPACT_DISCOVERY_FORBIDDEN_TEXT, `${pathLabel} leaked internal text ${value}`);
  }
}

function requirePublicResultCard(card, expected = {}) {
  assert.ok(card && typeof card === "object", "Expected compact public result card");
  assert.equal(card.presentation, "compact-result-summary-card");
  if (expected.surface) {
    assert.equal(card.surface, expected.surface);
  }
  assert.equal(card.detailsAvailable, true);
  const { command, ...publicCard } = card;
  requireCompactDiscoveryPublic(publicCard, `${expected.surface ?? "result"} result card`);
}

function requireDoveWorkspaceVisibilityPolicy() {
  const durableStateCheck = spawnSync("git", ["check-ignore", "-v", ".dove/state.json", ".dove/task-packets/index.json"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(durableStateCheck.status, 1, `.dove durable state must remain normal workspace files, not ignored local-only config: ${durableStateCheck.stdout}${durableStateCheck.stderr}`);

  const localConfigCheck = spawnSync("git", ["check-ignore", "-v", ".dove/config.local.json"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(localConfigCheck.status, 0, `.dove/config.local.json must remain local-only ignored: ${localConfigCheck.stdout}${localConfigCheck.stderr}`);
  assert.match(localConfigCheck.stdout, /\.dove\/config\.local\.json/);
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

function requireDurableContextNotice(notice) {
  assert.ok(notice && typeof notice === "object", "Expected durable context notice object");
  assert.equal(notice.presentation, "dove-durable-context-notice");
  assert.equal(notice.stateSource, "filesystem-durable-state");
  assert.equal(notice.durableRoot, ".dove");
  assert.equal(notice.rollbackCoverage, "host-tracked-mutation-plan-required");
  assert.equal("nativeProjectRollbackExpected" in notice, false);
  assert.equal("nativeProjectRollbackRequiresProjectCheckpoint" in notice, false);
  assert.equal("projectCheckpointDetected" in notice, false);
  assert.equal("projectCheckpointStatus" in notice, false);
  assert.equal("projectCheckpoint" in notice, false);
  assert.equal(notice.nativeHostRollbackRequiresFileCheckpoint, true);
  assert.equal(notice.hostCheckpointDetected, false);
  assert.equal(notice.hostCheckpointStatus, "not-programmatically-verifiable");
  assert.ok(notice.hostCheckpoint && typeof notice.hostCheckpoint === "object");
  assert.equal(notice.hostCheckpoint.required, true);
  assert.equal(notice.hostCheckpoint.verificationRequired, true);
  assert.equal(notice.hostCheckpoint.externalWriteCaptureRequired, true);
  assert.ok(notice.mutationRollbackModel && typeof notice.mutationRollbackModel === "object");
  assert.equal(notice.mutationRollbackModel.patchPlanSupported, true);
  assert.equal(notice.mutationRollbackModel.hostTrackedFileEditsRequired, true);
  assert.equal(notice.mutationRollbackModel.directProcessWritesAreRollbackSafe, false);
  assert.equal(notice.mutationRollbackModel.hostCheckpointVerified, false);
  assert.equal(notice.mutationRollbackModel.externalWriteCaptureVerified, false);
  assert.equal(notice.mutationRollbackModel.doveRestoreSupported, false);
  assert.equal(notice.mutationRollbackModel.mutationProvenancePath, ".dove/mutations/index.json");
  assert.equal(notice.externalWriteCaptureRequired, true);
  assert.equal(notice.externalWriteCaptureVerified, false);
  assert.equal(notice.projectVisibilityRequired, true);
  assert.equal(notice.projectVisibilityVerified, false);
  assert.equal(notice.doveRestoreSupported, false);
  assert.equal(notice.doveRestoreCommand, null);
  assert.equal(notice.automaticRollback, false);
  assert.equal("rollbackSupported" in notice, false);
  assert.equal("rollbackCheckpointAvailable" in notice, false);
  assert.equal("latestRollbackCheckpoint" in notice, false);
  assert.deepEqual(notice.trackedDurablePaths, [".dove/state.json", ".dove/task-packets/index.json", ".dove/mutations/index.json"]);
  assert.deepEqual(notice.localOnlyIgnoredPaths, [".dove/config.local.json"]);
  assert.match(notice.summary, /\.dove/);
  assert.match(notice.recovery, /patch-plan|direct-process|host|回滚|rollback/);
  assert.deepEqual(notice.recoveryActions.map((action) => action.kind), ["refresh-status", "apply-mutation-plan-with-host-tracked-edits", "use-direct-process-as-unverified", "adjust-status"]);
  assert.equal(notice.recoveryActions[0].mutation, false);
  assert.equal(notice.recoveryActions[1].mutation, true);
  assert.equal(notice.recoveryActions[1].handledByHost, true);
  assert.equal(notice.recoveryActions[1].hostTrackedFileEditsRequired, true);
  assert.equal(notice.recoveryActions[2].mutation, true);
  assert.equal(notice.recoveryActions[2].hostRollbackEligible, false);
  assert.equal("requiresCheckpointKind" in notice.recoveryActions[2], false);
  assert.equal(notice.recoveryActions[3].confirmationRequired, true);
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
  requireDoveWorkspaceVisibilityPolicy();
  writeValidationEvidence();

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

  const operatorListed = await call("tools/list");
  const operatorToolNames = new Set(operatorListed.tools.map((tool) => tool.name));
  for (const requiredTool of [
    "query_dove_status",
    "query_dove_orchestrate",
    "query_document_ledger",
    "query_operator_lessons",
    "create_dove_task",
    "run_dove_auto",
    "run_dove_operator",
    "register_source",
    "upsert_note",
    "upsert_draft",
    "record_document_evidence",
    "run_figure_workflow",
    "run_experience_workflow",
    "run_review_loop",
    "build_rebuttal_strategy",
    "query_dove_return"
  ]) {
    assert.equal(operatorToolNames.has(requiredTool), true, `Missing default operator MCP tool ${requiredTool}`);
  }
  for (const hiddenByDefaultTool of ["init_dove_goal", "record_dove_mission_pass", "materialize_guidance_packet", "launch_dove_mission"]) {
    assert.equal(operatorToolNames.has(hiddenByDefaultTool), false, `Default MCP operator surface should not expose ${hiddenByDefaultTool}`);
  }
  for (const tool of operatorListed.tools) {
    requireCompactDiscoveryPublic(tool, `operator tool ${tool.name}`);
  }

  const retiredAuthorityTools = [
    "issue_program_approval",
    "run_autonomy_once",
    "run_autonomy_foreground",
    "run_autonomy_operate"
  ];
  for (const retiredTool of retiredAuthorityTools) {
    assert.equal(operatorToolNames.has(retiredTool), false, `Default MCP operator surface must not register ${retiredTool}`);
  }

  const listed = await call("tools/list", { surface: "full" });
  const toolNames = new Set(listed.tools.map((tool) => tool.name));
  for (const retiredTool of retiredAuthorityTools) {
    assert.equal(toolNames.has(retiredTool), false, `Full MCP surface must not register ${retiredTool}`);
  }
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
    query_dove_status: ["summary/headline", "nextStep", "needsAttention", "changes", "showMore", "one recommended action", "resultMode: full/debug", "statusHome.durableContextNotice", "mutationRollbackModel", "patch-plan plus host-tracked file-edit requirements", "host checkpoint verification limits", "unverified direct-process writes", "not git detection", "not direct-process", "not reset_dove_version", "statusHome.preActionGuidance", "automatic read-only lesson recall", "Planner/Builder/Reviewer role framing", "must not render a Missions panel", "blocked counts", "execution-gap counts", "required-evidence blocks", "requestStatusAdjustment"],
    create_dove_task: ["proposal-only mission work contract", "preActionGuidance", "complete returned confirmArgs", "exact id and proposalDigest", "same mutationMode", "recommended handoff routes", "without executing or recording a pass"],
    record_dove_mission_pass: ["host-tool-blocked", "visibly blocked"],
    run_dove_auto: ["preActionGuidance", "host-tool-blocked", "no hidden continuation", "scheduler", "daemon"],
    run_dove_operator: ["planner preActionGuidance", "host-tool-blocked", "read-only lesson recall", "no scheduler or hidden runtime"],
    query_operator_lessons: ["recall applicable lessons automatically", "read-only preActionGuidance"],
    record_operator_lesson: ["auto-recall lessons read-only", "recording never happens implicitly"],
    run_experience_workflow: ["Builder/experiment-planner preActionGuidance", "read-only lesson recall", "claim-bridge boundary"],
    run_figure_workflow: ["Builder preActionGuidance", "artifact-provenance", "QA gates", "providerId none", "plan-only/manual-output", "awaiting-provider-output", "providerId gpt-image2", "OPENAI_API_KEY"],
    prepare_audio_review: ["Reviewer preActionGuidanceSummary", "no-private-transcript boundary"],
    import_audio_review: ["Reviewer preActionGuidanceSummary", "private reviewer transcripts"],
    run_audio_review: ["Reviewer preActionGuidanceSummary", "localized resultCard"],
    run_dove_review_loop: ["independent local Reviewer", "Builder handoff"],
    reset_dove_version: ["direction-change snapshot", "not a .dove rollback restore entrypoint", "mutationMode: patch-plan", "host-tracked file edits", "host native checkpoint"],
    run_review_loop: ["independent review", "role-framed preActionGuidance"],
    prepare_isolated_review: ["Reviewer preActionGuidanceSummary", "explicit isolation boundaries"],
    import_isolated_review: ["Reviewer preActionGuidanceSummary", "private transcripts"],
    record_document_evidence: ["Builder/researcher preActionGuidanceSummary", "internal summaries, pressure-test reports, and synthesized outputs", "source/artifact provenance", "raw transcripts/private reasoning"],
    register_source: ["Builder/researcher preActionGuidanceSummary", "external source records", "sources: [...]", "verified registered sources", "candidate links", "upsert_note", "record_document_evidence"],
    verify_source: ["identity fingerprint", "method", "checkedMaterial", "auditable evidence", "caller-minted"],
    upsert_note: ["Builder/researcher preActionGuidanceSummary", "internal synthesis", "pressure-test findings", "writing-style summaries", "reviewer-preference analysis"],
    upsert_plan: ["Planner preActionGuidanceSummary", "scope/gate guardrails"],
    upsert_outline: ["Planner preActionGuidanceSummary", "draft gate guardrails"],
    set_section_status: ["Planner preActionGuidanceSummary", "section gate context"],
    sync_checklist: ["Planner preActionGuidanceSummary", "status gate context"],
    sync_citations: ["Builder/researcher preActionGuidanceSummary", "citation and evidence guardrails"],
    refresh_wiki: ["Planner preActionGuidanceSummary", "reusable context refresh"],
    run_experiment_audit: ["Reviewer preActionGuidanceSummary", "audit gate"],
    bridge_result_to_claim: ["Builder/experiment-planner preActionGuidanceSummary", "result-to-claim bridge"],
    prepare_figure_generation: ["Builder preActionGuidanceSummary", "material provenance", "providerId gpt-image2", "OPENAI_API_KEY", "inline secret"],
    import_figure_generation: ["Builder preActionGuidanceSummary", "artifact-provenance gate"]
  };
  for (const [toolName, requiredFragments] of Object.entries(descriptionChecks)) {
    const description = toolByName.get(toolName)?.description ?? "";
    assert.notEqual(description, "", `Missing MCP description for ${toolName}`);
    for (const fragment of requiredFragments) {
      requireTextIncludes(description, fragment, `${toolName} description`);
    }
  }
  const registerSourceSchema = toolByName.get("register_source")?.inputSchema?.properties ?? {};
  assert.equal(registerSourceSchema.sources?.type, "array", "register_source must expose batch sources array");
  assert.ok(registerSourceSchema.sources?.items?.properties?.sourceId, "register_source batch items must expose sourceId");
  assert.ok(registerSourceSchema.sources?.items?.properties?.citationKey, "register_source batch items must expose citationKey");
  const resetVersionSchema = toolByName.get("reset_dove_version")?.inputSchema?.properties ?? {};
  for (const property of ["id", "versionId", "title", "reason", "summary"]) {
    assert.ok(resetVersionSchema[property], `reset_dove_version must expose ${property}`);
  }
  for (const property of ["rollbackCheckpointId", "restoreCheckpointId", "checkpointId", "restoreVersionId", "confirmed", "confirm"]) {
    assert.equal(resetVersionSchema[property], undefined, `reset_dove_version must not expose ${property}`);
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

  const missionRequest = {
    id: "validator-paper-task",
    goal: "Draft and review the validator paper section with one figure and one experiment.",
    title: "Validator paper task",
    evidenceExpectations: ["draft", "figure", "review"],
    artifactRefs: [
      ".dove/plans/current-plan.md",
      ".dove/drafts/introduction.md",
      ".dove/figures/validator-figure.final.svg"
    ]
  };
  const { proposal: missionProposal, confirmArgs: approvedMissionConfirmArgs } = await proposeMission(missionRequest, "validator paper mission proposal");
  assert.equal(missionProposal.status, "needs-confirmation");
  assert.equal(missionProposal.proposalOnly, true);
  assert.deepEqual(missionProposal.writes, []);
  assert.equal(missionProposal.confirmationRequired, true);
  assert.equal(missionProposal.demandConversion, true);
  assert.equal(missionProposal.executionMode, "contract-handoff");
  assert.equal(missionProposal.workflowMode, "mission-contract");
  assert.equal(missionProposal.proposedTask.level, 3);
  assert.equal(approvedMissionConfirmArgs.confirmed, true);
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

  const bareMissionConfirmation = await callToolResult("create_dove_task", {
    ...missionRequest,
    confirmed: true
  });
  requireToolError(bareMissionConfirmation, /exact proposalDigest/u, "bare create_dove_task confirmation");
  const staleMissionConfirmation = await callToolResult("create_dove_task", {
    ...structuredClone(approvedMissionConfirmArgs),
    title: "Stale validator paper task"
  });
  requireToolError(staleMissionConfirmation, /no longer matches the current contract/u, "stale create_dove_task confirmation");

  const { confirmArgs: freshMissionConfirmArgs } = await proposeMission(missionRequest, "fresh validator paper mission proposal");
  const mission = await callTool("create_dove_task", freshMissionConfirmArgs);
  assert.equal(mission.status, "materialized");
  assert.equal(mission.confirmationRequired, false);
  assert.equal(mission.demandConversion, true);
  assert.equal(mission.executionMode, "contract-handoff");
  assert.equal(mission.workflowMode, "mission-contract");
  assert.equal(mission.contractMaterialized, true);
  assert.equal("missionPassRequired" in mission, false);
  assert.equal("recordMissionPassTool" in mission, false);
  assert.equal("result" in mission, false);
  assert.equal(mission.foreground, false);
  assert.equal(mission.background, false);
  assert.ok(Array.isArray(mission.handoffRoutes) && mission.handoffRoutes.length > 0);
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
    resultSummary: "Explicit validator work happened after mission materialization and now records a result.",
    evidenceLinks: [".dove/task-packets/index.json"],
    artifactRefs: [".dove/task-packets/index.json"],
    nextAction: "project:dove.status"
  });
  assert.equal(missionPass.status, "in-progress");
  assert.equal(missionPass.result.surface, "dove.mission");
  assert.equal(missionPass.result.maxIterations, 1);
  assert.equal(missionPass.result.iterationCount, 1);
  assert.equal(missionPass.result.packetId, packetId);
  requirePublicResultCard(missionPass.resultCard, { surface: "dove.mission" });
  assert.equal("packetId" in missionPass.resultCard, false);
  assert.equal("proposalOnly" in missionPass.resultCard, false);
  requirePreActionGuidanceSummary(missionPass.preActionGuidanceSummary, { surface: "dove.mission" });

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
  requirePublicResultCard(internalDocumentEvidence.resultCard, { surface: "dove.documents" });

  const publicDocumentEvidence = await callTool("record_document_evidence", {
    packetId,
    id: "validator-public-document-evidence",
    title: "Validator public document evidence",
    documentKind: "source",
    evidenceScope: "external",
    publicSafe: true,
    summary: "Validator public-safe document evidence summary.",
    evidenceLinks: [VALIDATION_EVIDENCE_PATH]
  });
  assert.equal(publicDocumentEvidence.status, "recorded");
  assert.equal(publicDocumentEvidence.entry.publicSafe, true);
  requirePreActionGuidanceSummary(publicDocumentEvidence.preActionGuidanceSummary, { surface: "dove.documents", primaryRole: "builder" });
  requirePublicResultCard(publicDocumentEvidence.resultCard, { surface: "dove.documents" });

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
    origin: "validator",
    locator: "https://example.org/dove-task-centered-research-workflows"
  });
  assert.equal(source.citationKey, "smith2026dove");
  assert.equal(source.lifecycle, "candidate");
  assert.ok(source.packetIds.includes(packetId));
  requirePreActionGuidanceSummary(source.preActionGuidanceSummary, { surface: "dove.source", primaryRole: "builder" });
  const verifiedSource = await callTool("verify_source", {
    packetId,
    sourceId: source.id,
    decision: "verified",
    method: "validator inspected the canonical source fixture",
    checkedMaterial: "title, authors, and publication locator",
    auditEvidence: [
      { reference: source.locator, kind: "source", observation: "Canonical source locator matched the registered source identity." },
      { reference: VALIDATION_EVIDENCE_PATH, kind: "capture", observation: "Local validation capture records the inspected metadata." }
    ]
  });
  assert.equal(verifiedSource.source.lifecycle, "verified");
  assert.equal(verifiedSource.verification.sourceId, source.id);
  assert.equal(verifiedSource.verification.fingerprint, verifiedSource.source.fingerprint);

  const batchSources = await callTool("register_source", {
    packetId,
    sourceType: "guideline",
    origin: "validator",
    sources: [
      {
        sourceId: "validator-author-kit",
        citationKey: "validatorAuthorKit2026",
        title: "Validator Author Kit",
        locator: "Validator author-kit fixture"
      },
      {
        sourceId: "validator-reviewer-guidelines",
        citationKey: "validatorReviewerGuidelines2026",
        title: "Validator Reviewer Guidelines",
        locator: "Validator reviewer-guidelines fixture"
      }
    ]
  });
  assert.equal(batchSources.status, "registered");
  assert.equal(batchSources.sourceCount, 2);
  assert.deepEqual(batchSources.sourceIds, ["validator-author-kit", "validator-reviewer-guidelines"]);
  assert.ok(batchSources.items.every((item) => item.packetIds.includes(packetId)));
  requirePreActionGuidanceSummary(batchSources.preActionGuidanceSummary, { surface: "dove.source", primaryRole: "builder" });

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
  assert.ok(note.packetIds.includes(packetId));
  requirePreActionGuidanceSummary(note.preActionGuidanceSummary, { surface: "dove.note", primaryRole: "builder" });

  const batchNote = await callTool("upsert_note", {
    packetId,
    noteId: "validator-venue-intelligence",
    title: "Validator venue intelligence",
    sectionId: "venue-writing",
    sourceIds: batchSources.sourceIds,
    summary: "Reviewer-preference synthesis belongs in notes after sources are registered.",
    claims: ["Writing-preference analysis is internal synthesis, not an external source."]
  });
  assert.deepEqual(batchNote.sourceIds, batchSources.sourceIds);
  assert.ok(batchNote.packetIds.includes(packetId));
  requirePreActionGuidanceSummary(batchNote.preActionGuidanceSummary, { surface: "dove.note", primaryRole: "builder" });

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

  const claimCheckpoint = await callTool("append_handoff", {
    summary: "Record the validator claim-work checkpoint under the durable board owner."
  });
  assert.equal(typeof claimCheckpoint.assignedRole, "string");

  const directClaims = await callTool("upsert_claims", {
    packetId,
    claims: [{
      id: "validator-direct-claim",
      text: "Direct MCP thin surfaces preserve pre-action guidance summaries.",
      sectionId: "introduction",
      sourceIds: [source.id],
      noteIds: [note.id],
      evidenceLinks: [VALIDATION_EVIDENCE_PATH],
      status: "draft",
      confidence: "medium"
    }]  });
  assert.ok(directClaims.claims.some((claim) => claim.id === "validator-direct-claim"));
  requirePreActionGuidanceSummary(directClaims.preActionGuidanceSummary, { surface: "dove.draft", primaryRole: "builder" });

  const experimentCheckpoint = await callTool("append_handoff", {
    summary: "Record the validator experiment-work checkpoint under the durable board owner."
  });
  assert.equal(experimentCheckpoint.assignedRole, claimCheckpoint.assignedRole);

  const directExperimentPlan = await callTool("upsert_experiment_plan", {
    packetId,
    id: "validator-direct-experiment",
    title: "Validator direct experiment",
    claimId: "validator-direct-claim",
    hypothesis: "Thin direct experiment surfaces keep guidance summaries.",
    methodology: "Record a durable direct result and audit/bridge it.",
    successMetric: "Every returned direct artifact includes guidance summary.",
    comparisonTargets: ["chat-only"]  });
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
      evidenceLinks: [VALIDATION_EVIDENCE_PATH],
      comparisonTargets: ["chat-only"]
    }  });
  assert.equal(directExperimentResult.id, "validator-direct-result");
  assert.equal(directExperimentResult.latestAuditId, "validator-direct-experiment-audit-1");
  requirePreActionGuidanceSummary(directExperimentResult.preActionGuidanceSummary, { surface: "dove.experience", primaryRole: "builder" });

  const directExperimentAudit = await callTool("run_experiment_audit", {
    packetId: directExperimentPacketId,
    resultId: "validator-direct-result"  });
  assert.equal(directExperimentAudit.resultId, "validator-direct-result");
  requirePreActionGuidanceSummary(directExperimentAudit.preActionGuidanceSummary, { surface: "dove.experience", primaryRole: "reviewer" });

  const directClaimBridge = await callTool("bridge_result_to_claim", {
    packetId: directExperimentPacketId,
    resultId: "validator-direct-result",
    auditIds: [directExperimentAudit.id],
    reason: "Validator exercises direct claim bridge guidance summary."  });
  assert.equal(directClaimBridge.resultId, "validator-direct-result");
  requirePreActionGuidanceSummary(directClaimBridge.preActionGuidanceSummary, { surface: "dove.experience", primaryRole: "builder" });

  const checklistSync = await callTool("sync_checklist", {});
  assert.equal(checklistSync.checklistPath, ".dove/checklists/current.md");
  requirePreActionGuidanceSummary(checklistSync.preActionGuidanceSummary, { surface: "dove.status", primaryRole: "planner" });

  const citationSync = await callTool("sync_citations", { preservePhase: true });
  assert.equal(citationSync.sourceCount >= 3, true);
  requirePreActionGuidanceSummary(citationSync.preActionGuidanceSummary, { surface: "dove.draft", primaryRole: "builder" });

  const wikiRefresh = await callTool("refresh_wiki", {});
  assert.equal(wikiRefresh.wikiPath, ".dove/wiki/index.md");
  requirePreActionGuidanceSummary(wikiRefresh.preActionGuidanceSummary, { surface: "dove.status", primaryRole: "planner" });

  const experience = await callTool("run_experience_workflow", {
    packetId: directExperimentPacketId,
    experimentId: "validator-direct-experiment",
    claimId: "validator-direct-claim",
    goal: "Compare task-centered Dove against a chat-only workflow.",
    methodology: "Check durable artifact completeness.",
    successMetric: "Fewer missing evidence links",
    comparisonTargets: ["chat-only"],
    result: {
      outcome: "supports",
      summary: "Task-centered Dove kept the evidence trail explicit.",
      evidenceLinks: [VALIDATION_EVIDENCE_PATH]
    }
  });
  assert.equal(experience.status, "bridged");
  assert.equal(experience.audit.auditVerdict, "clean");
  assert.equal(experience.bridge.status, "applied");
  assert.equal(experience.packetId, directExperimentPacketId);
  assert.equal(experience.plan.id, "validator-direct-experiment");
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
    sourceSvgPath: ".dove/figures/runs/validator-direct-figure-run/final.svg",
    svgContent: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Direct validator figure</text></svg>",
    caption: "Direct validator figure records safe import provenance."
  });
  assert.equal(importedFigure.figureId, "validator-direct-figure");
  assert.equal(importedFigure.finalSvgPath, ".dove/figures/validator-direct-figure.final.svg");
  requirePreActionGuidanceSummary(importedFigure.preActionGuidanceSummary, { surface: "dove.figure", primaryRole: "builder" });

  const figure = await callOperationalFailureTool(
    "run_figure_workflow",
    {
      packetId,
      figureId: "validator-figure",
      runId: "validator-figure-run",
      intent: "Show init, mission, auto, review, and lessons as a task loop.",
      sourceSections: ["introduction"],
      relatedExperimentIds: ["validator-experience"],
      requiredVisualElements: ["init", "mission", "review", "lesson"],
      svgContent: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Validator workflow</text></svg>",
      caption: "Validator figure shows the task-centered Dove loop."
    }
  );
  assert.equal(
    figure.status,
    "qa-needs-attention"
  );
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
  requirePublicResultCard(review.resultCard, { surface: "dove.review" });

  const draftBeforeReviewLoop = fs.readFileSync(path.join(tempWorkspace, ".dove/drafts/introduction.md"), "utf8");
  const reviewLoop = await callTool("run_dove_review_loop", {
    packetId,
    runId: "validator-review-loop",
    artifactPaths: [
      ".dove/plans/current-plan.md",
      ".dove/drafts/introduction.md",
      ".dove/figures/validator-figure.final.svg"
    ]
  });
  assert.ok(["coherent", "needs-review"].includes(reviewLoop.status));
  assert.ok(["review-coherent", "builder-revision-required"].includes(reviewLoop.stopReason));
  assert.equal(reviewLoop.ownerRole, "reviewer");
  assert.equal(reviewLoop.pass.review.verdict, reviewLoop.review.verdict);
  assert.ok(["coherent", "needs-evidence", "needs-revision"].includes(reviewLoop.review.verdict));
  assert.notEqual(reviewLoop.review.status, "prepared-awaiting-audio");
  assert.equal(fs.readFileSync(path.join(tempWorkspace, ".dove/drafts/introduction.md"), "utf8"), draftBeforeReviewLoop);
  requireFullPreActionGuidance(reviewLoop.preActionGuidance, { surface: "dove.review", primaryRole: "reviewer" });

  const autoReviewSteps = [{
    command: "dove.review",
    args: {
      scope: "paper",
      stage: "review"
    }
  }];
  const needsConfirmation = await callTool("run_dove_auto", {
    packetId,
    goal: "Validate auto confirmation behavior.",
    maxIterations: 2,
    steps: autoReviewSteps
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

  const autoRun = await callOperationalFailureTool(
    "run_dove_auto",
    {
      ...needsConfirmation.confirmArgs,
      runId: "validator-auto-run"
    }
  );
  assert.equal(autoRun.status, "blocked-boundary");
  assert.equal(autoRun.result.packetId, packetId);
  assert.equal(autoRun.result.foreground, true);
  assert.equal(autoRun.result.background, false);
  assert.equal(autoRun.result.maxIterations, 2);
  assert.equal(autoRun.result.iterationCount, 0);
  assert.equal(autoRun.result.boundary?.type, reviewLoop.boundary?.type);
  assert.equal(autoRun.result.stopReason, reviewLoop.boundary?.reason);
  assert.ok(autoRun.result.allowedInternalCommands.includes("dove.review-loop"));
  requirePublicResultCard(autoRun.resultCard, { surface: "dove.auto" });
  assert.equal(autoRun.resultCard.requiresAction, true);

  const { confirmArgs: secondMissionConfirmArgs } = await proposeMission({
    id: "validator-kill-task",
    goal: "Temporary validator task to kill.",
    title: "Validator kill task"
  }, "validator kill mission proposal");
  const secondMission = await callTool("create_dove_task", secondMissionConfirmArgs);
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
  assert.equal(status.detail, "compact");
  assert.equal(status.detailsAvailable, true);
  assert.deepEqual(status.changes, {
    intent: "none",
    applied: false,
    count: 0,
    rollback: "not-applicable"
  });
  assert.equal("writes" in status, false);
  assert.equal("writeIntent" in status, false);
  assert.equal("rollbackEligible" in status, false);
  assert.equal(status.statusHome.presentation, "dove-project-situation-home");
  assert.equal(status.statusHome.detail, "compact");
  assert.equal(status.statusHome.liveContextFirst, true);
  assert.equal(status.statusHome.detailsAvailable, true);
  assert.ok(status.statusHome.headline);
  assert.ok(status.statusHome.scope && typeof status.statusHome.scope === "object");
  assert.equal(status.statusHome.scope.kind, "workspace");
  assert.ok(status.statusHome.currentContext && typeof status.statusHome.currentContext === "object");
  assert.ok(status.statusHome.nextStep && typeof status.statusHome.nextStep === "object");
  assert.ok(status.statusHome.needsAttention && typeof status.statusHome.needsAttention === "object");
  assert.deepEqual(status.statusHome.changes, status.changes);
  assert.ok(status.statusHome.showMore?.text);
  assert.equal(status.statusHome.showMore.detailsAvailable, true);
  assert.equal(typeof status.statusHome.showMore.missionDetailsAvailable, "boolean");
  assert.equal(typeof status.statusHome.showMore.statusAdjustmentsAvailable, "boolean");
  assert.equal("fullDetails" in status.statusHome.showMore, false);
  assert.equal("missionDetails" in status.statusHome.showMore, false);
  for (const hidden of ["stateSource", "durableRoot", "nativeProjectRollbackExpected", "nativeProjectRollbackRequiresProjectCheckpoint", "projectCheckpointDetected", "projectCheckpointStatus", "nativeHostRollbackRequiresFileCheckpoint", "hostCheckpointDetected", "hostCheckpointStatus", "externalWriteCaptureRequired", "externalWriteCaptureVerified", "doveRestoreSupported", "projectVisibilityRequired"]) {
    assert.equal(hidden in status.statusHome.currentContext, false);
  }
  assert.equal("durableContextNotice" in status, false);
  assert.equal("dashboard" in status, false);
  assert.equal("dailyHome" in status, false);
  assert.equal("diagnostics" in status, false);
  assert.equal("statusAdjustmentContract" in status, false);
  assert.equal("preActionGuidance" in status.statusHome, false);
  assert.equal("projectState" in status.statusHome, false);
  assert.equal("blockersAndReconciliation" in status.statusHome, false);
  assert.equal("optionalMissionDetails" in status.statusHome, false);
  assert.equal("nextSteps" in status.statusHome, false);
  assert.equal("expansion" in status.statusHome, false);
  assert.equal(missionStatus.statusHome.optionalMissionDetails.detail, "compact");
  assert.equal(missionStatus.statusHome.optionalMissionDetails.missionItemsIncluded, true);
  assert.equal(missionStatus.statusHome.optionalMissionDetails.groups.done.defaultCollapsed, true);
  assert.equal(fullStatus.detail, "full");
  requireDurableContextNotice(fullStatus.durableContextNotice);
  assert.ok(fullStatus.dashboard);
  assert.deepEqual(fullStatus.dashboard.project.durableContextNotice, fullStatus.durableContextNotice);
  assert.deepEqual(fullStatus.diagnostics.durableContextNotice, fullStatus.durableContextNotice);
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
  assert.ok(fullStatus.projectSummary && typeof fullStatus.projectSummary === "object");
  assert.equal(fullStatus.statusAdjustmentContract.mutationTool, "apply_dove_status_adjustments");
  assert.deepEqual(fullStatus.statusAdjustmentContract.statusChoices, ["pending", "ready", "in-progress", "blocked", "completed", "killed", "archived"]);
  assert.equal(fullStatus.statusAdjustmentContract.statusAdjustmentItemsIncluded ?? false, false);
  assert.ok(Array.isArray(fullStatus.statusAdjustmentContract.items));
  assert.ok(Array.isArray(fullStatus.statusAdjustmentContract.adjustmentCards));
  assert.equal(typeof adjustmentStatus.statusHome.showMore.statusAdjustmentsAvailable, "boolean");
  assert.equal("statusAdjustments" in adjustmentStatus.statusHome.showMore, false);
  assert.equal(adjustmentStatus.statusHome.statusAdjustmentPreview.statusAdjustmentItemsIncluded, true);
  assert.ok(adjustmentStatus.statusHome.statusAdjustmentPreview.adjustmentCards.every((card) => card.presentation === "compact-status-adjustment-card"));
  assert.equal(adjustmentStatus.statusHome.statusAdjustmentPreview.items.some((item) => item.packetId === secondMission.createdTask.id), false);
  assert.equal(adjustmentStatus.statusHome.statusAdjustmentPreview.items.some((item) => ["completed", "killed"].includes(item.currentStatus)), false);
  assert.equal(status.taskGraph, undefined);
  assert.equal(status.paperLifecycle, undefined);
  assert.equal(fullStatus.diagnostics.mayRefreshDerivedSurfaces, false);

  const statusAdjustmentPreview = await callTool("apply_dove_status_adjustments", {
    adjustments: [{ packetId, status: "ready", reason: "Validator selects ready from status UX." }]
  });
  assert.equal(statusAdjustmentPreview.status, "needs-confirmation");
  assert.equal(statusAdjustmentPreview.proposalOnly, true);
  assert.deepEqual(statusAdjustmentPreview.writes, []);
  assert.deepEqual(statusAdjustmentPreview.statusChoices, ["pending", "ready", "in-progress", "blocked", "completed", "killed", "archived"]);
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
  assert.ok(operatorPreview.queueSummary && typeof operatorPreview.queueSummary === "object");
  assert.ok(operatorPreview.queuePreview && typeof operatorPreview.queuePreview === "object");
  assert.equal(operatorPreview.queueCards, undefined);
  assert.equal(operatorPreview.autoRunnableTasks, undefined);
  assert.equal(operatorPreview.hostPassRequiredTasks, undefined);
  requireFullPreActionGuidance(operatorPreview.preActionGuidance, { surface: "dove.operator", primaryRole: "planner" });

  const detailedOperatorPreview = await callTool("run_dove_operator", { includeQueueDetails: true });
  assert.ok(detailedOperatorPreview.queueCards && typeof detailedOperatorPreview.queueCards === "object");
  assert.ok(Array.isArray(detailedOperatorPreview.queueCards.runnable));
  for (const queueCard of Object.values(detailedOperatorPreview.queueCards).flat()) {
    requireFullPreActionGuidance(queueCard.preActionGuidance, { surface: "dove.operator", primaryRole: "planner" });
  }

  const operatorRun = await callTool("run_dove_operator", { confirmed: true, runId: "validator-operator-run" });
  requirePublicResultCard(operatorRun.resultCard, { surface: "dove.operator" });
  requirePreActionGuidanceSummary(operatorRun.preActionGuidanceSummary, { surface: "dove.operator", primaryRole: "planner" });

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
  const lessonRecallStatus = await callTool("query_dove_status", { detail: "full" });
  requireFullPreActionGuidance(lessonRecallStatus.preActionGuidance, { surface: "dove.status", primaryRole: "planner" });
  assert.ok(lessonRecallStatus.preActionGuidance.lessonRecall.topLessons.some((lesson) => lesson.id === recordedLesson.recordedLesson.id));

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
  cleanupTempWorkspace(tempWorkspace);
}
