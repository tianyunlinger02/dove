import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { GOVERNANCE_EXEMPT_MUTATIONS, GOVERNANCE_GUARDED_MUTATIONS, GOVERNANCE_READONLY_TOOLS } from "../../src/core/index.mjs";
import { dispatchTool } from "../../src/mcp/handlers.mjs";
import { MUTATING_TOOL_NAMES, toolDefinitions } from "../../src/mcp/tool-definitions.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function extractMcpEnvelopeJson(result) {
  assert.ok(result.content?.[0]?.text, "Expected text content in MCP tool result");
  assert.notEqual(result.isError, true, result.content[0].text);
  return JSON.parse(result.content[0].text);
}

function extractToolJson(result) {
  const parsed = extractMcpEnvelopeJson(result);
  if (parsed.presentation === "dove-mcp-result-contract" && parsed.resultMode === "full" && parsed.fullResult) {
    return parsed.fullResult;
  }
  return parsed;
}

function dispatchToolFull(root, name, args = {}) {
  return dispatchTool(root, name, { ...args, resultMode: "full" });
}

function assertFullPreActionGuidance(guidance, expected = {}) {
  assert.ok(guidance && typeof guidance === "object", "expected full pre-action guidance");
  assert.equal(guidance.presentation, "dove-pre-action-guidance");
  assert.equal(guidance.mode, "read-only-guidance");
  if (expected.surface) {
    assert.equal(guidance.surface, expected.surface);
  }
  if (expected.primaryRole) {
    assert.equal(guidance.roleFrame?.primaryRole, expected.primaryRole);
  }
  if (expected.subagentSpecialty) {
    assert.equal(guidance.roleFrame?.subagentSpecialty, expected.subagentSpecialty);
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

function assertDurableContextNotice(notice) {
  assert.ok(notice && typeof notice === "object", "expected durable context notice");
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
  assert.equal(typeof notice.mutationRollbackModel.hostRollbackEligible, "boolean");
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
  assert.match(notice.summary, /mutationMode|direct-process|patch-plan/);
  assert.match(notice.recovery, /patch-plan|direct-process|回滚|rollback/);
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

function assertPreActionGuidanceSummary(summary, expected = {}) {
  assert.ok(summary && typeof summary === "object", "expected pre-action guidance summary");
  assert.equal(summary.presentation, "dove-pre-action-guidance-summary");
  if (expected.surface) {
    assert.equal(summary.surface, expected.surface);
  }
  if (expected.primaryRole) {
    assert.equal(summary.primaryRole, expected.primaryRole);
  }
  if (expected.subagentSpecialty) {
    assert.equal(summary.subagentSpecialty, expected.subagentSpecialty);
  }
  assert.equal(summary.noHiddenRuntime, true);
  assert.equal(summary.requiresConfirmationForWrites, true);
  assert.equal(summary.recordingExplicitOnly, true);
}

const MCP_EXECUTION_CRITERION = "MCP execution criterion";
const MCP_VERIFICATION_PATH = ".dove/evidence/mcp-verification.log";

function mcpExecutionContract(overrides = {}) {
  const base = {
    chainType: "engineering-host-pass-verify",
    roleSequence: ["builder", "reviewer"],
    readFirst: [],
    action: "project:dove.auto",
    implementation: ["Produce the MCP workflow artifact."],
    files: [],
    materials: {
      requiredInputs: [],
      requiredArtifacts: [],
      sourceRefs: [],
      artifactRefs: []
    },
    convergence: {
      criteria: [MCP_EXECUTION_CRITERION],
      verificationCommands: ["node --test tests/integration/mcp-tools.test.mjs"],
      evidenceRequired: [MCP_VERIFICATION_PATH],
      definitionOfDone: "The MCP execution criterion is verified."
    },
    failureRoutes: [
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

function mcpVerifiedCriteria(criterion = MCP_EXECUTION_CRITERION) {
  return [{ criterion, status: "verified", evidencePaths: [MCP_VERIFICATION_PATH] }];
}

function mcpTaskCriterion(task, fallback = MCP_EXECUTION_CRITERION) {
  return task?.executionContract?.convergence?.criteria?.[0] ?? fallback;
}

function seedTaskPacket(root, packetId = "mcp-main-packet") {
  const timestamp = new Date(0).toISOString();
  const packet = {
    id: packetId,
    title: "MCP integration packet",
    summary: "Integration test packet for task-scoped MCP writes.",
    sourceType: "test-task",
    sourceId: packetId,
    status: "pending",
    lifecycleStatus: "active",
    active: true,
    assignedRole: "builder",
    currentFocus: "Run the MCP integration flow.",
    nextAction: "Continue the scoped MCP flow.",
    evidenceLinks: [],
    outputPaths: [],
    packetPath: `.dove/task-packets/packets/${packetId}.json`,
    packetContextPath: `.dove/context/packets/${packetId}.json`,
    updatedAt: timestamp
  };
  fs.mkdirSync(path.join(root, ".dove", "task-packets", "packets"), { recursive: true });
  fs.writeFileSync(path.join(root, packet.packetPath), `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(root, ".dove", "task-packets", "index.json"), `${JSON.stringify({ version: 3, items: [packet], lifecycleCounts: {}, dependencyHealth: {}, updatedAt: timestamp }, null, 2)}\n`, "utf8");
  return packetId;
}

test("MCP tool definitions include the mature workflow tools", () => {
  const names = toolDefinitions.map((tool) => tool.name);
  assert.deepEqual(names, [
    "ensure_workspace",
    "init_project",
    "read_state",
    "query_task_graph",
    "query_open_questions",
    "query_decisions",
    "query_lineage",
    "query_workspace_index",
    "query_meta_optimize",
    "query_governance_coverage_report",
    "query_operator_lessons",
    "query_operator_follow_through",
    "query_paper_audit",
    "query_dove_onboarding",
    "query_paper_pipeline",
    "query_dove_orchestrate",
    "query_dove_mission",
    "query_dove_mission_board",
    "query_dove_status",
    "publish_dove_status",
    "publish_dove_global_status",
    "query_document_ledger",
    "record_document_evidence",
    "query_dove_audit",
    "query_dove_return",
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
    "launch_dove_mission",
    "query_program_approvals",
    "query_campaigns",
    "query_boundary_report",
    "read_role_context_manifest",
    "read_phase_context_manifest",
    "read_packet_context_manifest",
    "read_artifact_context_manifest",
    "read_action_context_bundle",
    "summarize_session_journal",
    "upsert_orchestration_board",
    "append_handoff",
    "update_research_brief",
    "register_source",
    "upsert_note",
    "upsert_claims",
    "upsert_plan",
    "upsert_outline",
    "upsert_draft",
    "upsert_experiment_plan",
    "upsert_experiment_result",
    "run_experiment_audit",
    "bridge_result_to_claim",
    "run_review_loop",
    "append_review_log",
    "prepare_isolated_review",
    "import_isolated_review",
    "upsert_revision_plan",
    "set_section_status",
    "sync_checklist",
    "sync_citations",
    "refresh_wiki",
    "normalize_rebuttal_issues",
    "build_rebuttal_strategy",
    "build_rebuttal",
    "create_version_snapshot",
    "compare_versions",
    "list_artifacts",
    "upsert_figure_plan",
    "run_figure_workflow",
    "prepare_figure_generation",
    "import_figure_generation",
    "validate_figure_pipeline",
    "record_operator_lesson",
    "record_operator_follow_through",
    "issue_program_approval",
    "plan_campaign",
    "revoke_program_approval",
    "materialize_guidance_packet",
    "run_autonomy_once",
    "run_autonomy_foreground",
    "run_autonomy_operate"
  ]);
});

test("doctor MCP probe requires current Dove tools without calling mutating tools", () => {
  const probeText = fs.readFileSync(path.join(process.cwd(), "scripts", "doctor-mcp-probe.mjs"), "utf8");
  for (const requiredTool of ["query_dove_status", "publish_dove_status", "publish_dove_global_status", "query_document_ledger", "record_document_evidence", "init_dove_goal", "create_dove_task", "record_dove_mission_pass", "apply_dove_status_adjustments", "run_dove_auto", "run_dove_operator", "kill_dove_task", "reset_dove_version", "run_experience_workflow", "prepare_audio_review", "import_audio_review", "run_audio_review", "run_dove_review_loop", "query_program_approvals", "launch_dove_mission", "materialize_guidance_packet", "run_autonomy_operate"]) {
    assert.match(probeText, new RegExp(`"${requiredTool}"`));
  }
  for (const mutatingTool of ["publish_dove_status", "publish_dove_global_status", "record_document_evidence", "init_dove_goal", "create_dove_task", "record_dove_mission_pass", "apply_dove_status_adjustments", "run_dove_auto", "run_dove_operator", "kill_dove_task", "reset_dove_version", "run_experience_workflow", "prepare_audio_review", "import_audio_review", "run_audio_review", "run_dove_review_loop", "launch_dove_mission", "materialize_guidance_packet", "run_autonomy_once", "run_autonomy_foreground", "run_autonomy_operate"]) {
    assert.equal(probeText.includes(`tools/call", { name: "${mutatingTool}"`), false, `doctor probe must not call mutating tool ${mutatingTool}`);
  }
});

test("MCP validation scripts share bounded stdio client timeouts", () => {
  const helperText = fs.readFileSync(path.join(process.cwd(), "scripts", "mcp-stdio-client.mjs"), "utf8");
  assert.match(helperText, /CALL_TIMEOUT_MS\s*=\s*15000/);
  assert.match(helperText, /setTimeout\(\(\) => \{/);
  assert.match(helperText, /pending\.set\(id, \{ resolve, reject, timer, method, label: callLabel \}\)/);
  assert.match(helperText, /clearTimeout\(waiter\.timer\)/);
  assert.match(helperText, /server\.kill\(\)/);

  for (const scriptPath of ["scripts/validate-mcp.mjs", "scripts/doctor-mcp-probe.mjs"]) {
    const scriptText = fs.readFileSync(path.join(process.cwd(), scriptPath), "utf8");
    assert.match(scriptText, /createMcpStdioClient/);
    assert.match(scriptText, /notify\("notifications\/initialized"\)/);
    assert.doesNotMatch(scriptText, /const pending = new Map\(\)/);
  }
});

test("Dove MCP server supports Claude Code JSONL stdio framing", async () => {
  const root = createTempRoot("dove-mcp-jsonl-");
  const server = spawn(process.execPath, [path.join(process.cwd(), "mcp", "dove-state-server.mjs")], {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"]
  });
  const responses = [];
  let stdout = "";
  let stderr = "";

  server.stdout.setEncoding("utf8");
  server.stdout.on("data", (chunk) => {
    stdout += chunk;
    while (stdout.includes("\n")) {
      const lineEnd = stdout.indexOf("\n");
      const line = stdout.slice(0, lineEnd).trim();
      stdout = stdout.slice(lineEnd + 1);
      if (line) {
        responses.push(JSON.parse(line));
      }
    }
  });
  server.stderr.setEncoding("utf8");
  server.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  function send(id, method, params = {}) {
    server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  }

  try {
    send(1, "initialize");
    send(2, "tools/list");
    await new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (responses.length >= 2) {
          clearInterval(timer);
          resolve();
          return;
        }
        if (Date.now() - startedAt > 5000) {
          clearInterval(timer);
          reject(new Error(`Timed out waiting for JSONL MCP responses. stderr=${stderr}`));
        }
      }, 20);
    });

    assert.equal(responses[0].result.serverInfo.name, "dove");
    assert.ok(responses[1].result.tools.some((tool) => tool.name === "query_dove_status"));
  } finally {
    server.kill();
  }
});

test("every MCP tool surface is classified as guarded, exempt, or read-only", () => {
  const classifiedToolNames = new Set([
    ...GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.surfaceBindings?.mcpTool).filter(Boolean),
    ...GOVERNANCE_EXEMPT_MUTATIONS.map((entry) => entry.surfaceBindings?.mcpTool).filter(Boolean),
    ...GOVERNANCE_READONLY_TOOLS
  ]);
  for (const tool of toolDefinitions) {
    assert.equal(classifiedToolNames.has(tool.name), true, `Unclassified MCP tool: ${tool.name}`);
  }
});

test("mutating MCP tool schemas expose only canonical mutationMode", () => {
  for (const tool of toolDefinitions) {
    const mutationMode = tool.inputSchema?.properties?.mutationMode;
    if (MUTATING_TOOL_NAMES.has(tool.name)) {
      assert.ok(mutationMode, `${tool.name} should expose mutationMode`);
      assert.equal(mutationMode.type, "string");
      assert.deepEqual(mutationMode.enum, ["patch-plan", "direct-process"]);
      assert.match(mutationMode.description, /patch-plan/);
      assert.match(mutationMode.description, /direct-process/);
      continue;
    }
    assert.equal(mutationMode, undefined, `${tool.name} should not expose mutationMode`);
  }
});

test("MCP tool schemas expose canonical resultMode expansion", () => {
  for (const tool of toolDefinitions) {
    const resultMode = tool.inputSchema?.properties?.resultMode;
    assert.ok(resultMode, `${tool.name} should expose resultMode`);
    assert.equal(resultMode.type, "string");
    assert.deepEqual(resultMode.enum, ["compact", "full", "debug"]);
    assert.match(resultMode.description, /compact/);
    assert.match(resultMode.description, /fullResult/);
  }
});

test("MCP results default to compact contracts and expand explicitly", () => {
  const root = createTempRoot("dove-mcp-compact-contract-");
  try {
    const compactStatus = extractMcpEnvelopeJson(dispatchTool(root, "query_dove_status", { domain: "paper" }));
    assert.equal(compactStatus.presentation, "dove-mcp-result-contract");
    assert.equal(compactStatus.tool, "query_dove_status");
    assert.equal(compactStatus.resultMode, "compact");
    assert.equal(compactStatus.writesApplied, false);
    assert.ok(compactStatus.summary);
    assert.ok(compactStatus.nextStep && typeof compactStatus.nextStep === "object");
    assert.equal(compactStatus.nextStep.copyableCommand, "project:dove.init");
    assert.equal(compactStatus.needsAttention.status, "clear");
    assert.deepEqual(compactStatus.changes, {
      intent: "none",
      applied: false,
      count: 0,
      rollback: "not-applicable"
    });
    assert.ok(compactStatus.showMore && typeof compactStatus.showMore === "object");
    assert.ok(compactStatus.currentContext && typeof compactStatus.currentContext === "object");
    assert.equal("nextAction" in compactStatus, true);
    assert.equal(compactStatus.operatorUnblock?.detail, undefined);
    assert.equal("statusHome" in compactStatus, false);
    assert.equal("dashboard" in compactStatus, false);
    assert.equal("dailyHome" in compactStatus, false);
    assert.equal("fullResult" in compactStatus, false);

    const fullStatus = extractMcpEnvelopeJson(dispatchTool(root, "query_dove_status", { domain: "paper", resultMode: "full" }));
    assert.equal(fullStatus.presentation, "dove-mcp-result-contract");
    assert.equal(fullStatus.resultMode, "full");
    assert.ok(fullStatus.fullResult && typeof fullStatus.fullResult === "object");
    assert.equal(fullStatus.fullResult.mode, "dove-status-query");
    assert.equal(fullStatus.fullResult.statusHome.presentation, "dove-project-situation-home");

    const compactPatchPlan = extractMcpEnvelopeJson(dispatchTool(root, "init_dove_goal", {
      mutationMode: "patch-plan",
      id: "compact-contract-init",
      title: "Compact contract init",
      goal: "Keep patch-plan operations out of the default MCP response."
    }));
    assert.equal(compactPatchPlan.presentation, "dove-mcp-result-contract");
    assert.equal(compactPatchPlan.tool, "init_dove_goal");
    assert.equal(compactPatchPlan.resultMode, "compact");
    assert.equal(compactPatchPlan.writesApplied, false);
    assert.equal(compactPatchPlan.writes.mutationMode, "patch-plan");
    assert.equal("mutationPlan" in compactPatchPlan, false);
    assert.equal("fullResult" in compactPatchPlan, false);
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);

    const fullPatchPlan = extractMcpEnvelopeJson(dispatchTool(root, "init_dove_goal", {
      mutationMode: "patch-plan",
      resultMode: "full",
      id: "compact-contract-init",
      title: "Compact contract init",
      goal: "Expose patch-plan operations only under fullResult."
    }));
    assert.equal(fullPatchPlan.resultMode, "full");
    assert.equal("mutationPlan" in fullPatchPlan, false);
    assert.ok(fullPatchPlan.fullResult.mutationPlan && typeof fullPatchPlan.fullResult.mutationPlan === "object");
    assert.ok(fullPatchPlan.fullResult.mutationPlan.operations.some((operation) => operation.relativePath === ".dove/state.json"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("operator lessons MCP tools query, record, and reject raw Trellis traces", () => {
  const root = createTempRoot("dove-mcp-lessons-");
  try {
    const packetId = seedTaskPacket(root, "lesson-target-packet");
    const empty = extractToolJson(dispatchToolFull(root, "query_operator_lessons", {}));
    assert.equal(empty.explicitOnly, true);
    assert.equal(empty.noAutoCapture, true);
    assert.equal(empty.noAutoApply, true);
    assert.equal(empty.resultCount, 0);
    assert.equal(empty.lessonsPath, ".dove/meta/operator-lessons.json");

    const recorded = extractToolJson(dispatchToolFull(root, "record_operator_lesson", {
      title: "Keep retrospectives distilled",
      problem: "Raw traces are too noisy for future operators.",
      decisions: ["Record only reusable decisions."],
      pitfalls: ["Do not import raw runtime logs."],
      validation: ["Query lessons after recording."],
      nextTime: ["Write the lesson at task closure."],
      domain: "engineering",
      stage: "return",
      actorRole: "planner",
      tags: ["retrospective", "lessons"],
      sourceArtifacts: [".dove/meta/long-horizon-memory.json"]
    }));
    assert.equal(recorded.summary.activeLessonCount, 1);
    assert.equal(recorded.recordedLesson.title, "Keep retrospectives distilled");
    assert.deepEqual(recorded.recordedLesson.packetIds, []);

    const targeted = extractToolJson(dispatchToolFull(root, "record_operator_lesson", {
      title: "Bind lessons through task aliases",
      problem: "Task-scoped lessons should not require callers to remember packetId aliases.",
      decisions: ["Resolve taskName through the durable packet resolver."],
      pitfalls: ["Do not silently bind to the latest task."],
      validation: ["Recorded lesson includes the resolved packet id."],
      nextTime: ["Use taskName or packetTarget when the operator speaks naturally."],
      taskName: "MCP integration packet",
      domain: "engineering",
      stage: "return",
      actorRole: "planner",
      tags: ["task-target"],
      sourceArtifacts: [".dove/task-packets/index.json"]
    }));
    assert.equal(targeted.summary.activeLessonCount, 2);
    assert.deepEqual(targeted.recordedLesson.packetIds, [packetId]);

    const queried = extractToolJson(dispatchToolFull(root, "query_operator_lessons", { tag: "lessons" }));
    assert.equal(queried.resultCount, 1);
    assert.equal(queried.lessons[0].title, "Keep retrospectives distilled");

    const rejected = dispatchTool(root, "record_operator_lesson", {
      title: "Reject raw traces",
      problem: "Raw Trellis task traces should stay ignored.",
      decisions: ["Keep source artifacts curated."],
      pitfalls: ["Do not point lessons at trace folders."],
      validation: ["Attempting to cite raw traces fails."],
      nextTime: ["Use durable Dove summaries instead."],
      sourceArtifacts: [".trellis/tasks/example/task.json"]
    });
    assert.equal(rejected.isError, true);
    assert.match(rejected.content[0].text, /\.trellis\/tasks/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("onboarding, status, and paper pipeline MCP queries stay proposal-only", () => {
  const root = createTempRoot("dove-mcp-query-surfaces-");
  try {
    fs.writeFileSync(path.join(root, "main.tex"), "\\documentclass{article}\n\\begin{document}Hi\\end{document}\n", "utf8");
    const onboarding = extractToolJson(dispatchToolFull(root, "query_dove_onboarding", { writeMap: true }));
    assert.equal(onboarding.mode, "dove-onboarding-query");
    assert.equal(onboarding.proposalOnly, true);
    assert.equal(onboarding.writeMap, false);
    assert.deepEqual(onboarding.writes, []);
    assert.equal(onboarding.diagnostics.writeMapForcedFalse, true);
    assert.equal(fs.existsSync(path.join(root, ".dove", "workspace", "artifact-map.json")), false);

    const status = extractToolJson(dispatchToolFull(root, "query_dove_status", { domain: "paper" }));
    const fullStatus = extractToolJson(dispatchToolFull(root, "query_dove_status", { domain: "paper", detail: "full" }));
    assert.equal(status.mode, "dove-status-query");
    assert.equal(status.responseLanguage, "zh");
    assert.equal(status.proposalOnly, true);
    assert.equal(status.noAutoApply, true);
    assert.equal(status.query, true);
    assert.deepEqual(status.writes, {
      applied: false,
      count: 0,
      writeIntent: "none",
      rollbackEligible: "not-applicable"
    });
    assert.equal(status.writeIntent, "none");
    assert.equal(status.rollbackEligible, "not-applicable");
    assert.equal(status.detail, "compact");
    assert.equal(status.statusHome.presentation, "dove-project-situation-home");
    assert.equal(status.statusHome.liveContextFirst, true);
    assert.ok(status.statusHome.currentContext && typeof status.statusHome.currentContext === "object");
    assert.equal(status.statusHome.currentContext.stateSource, "filesystem-durable-state");
    assert.equal(status.statusHome.currentContext.durableRoot, ".dove");
    assert.ok(status.statusHome.nextSteps && typeof status.statusHome.nextSteps === "object");
    assert.ok(status.statusHome.nextSteps.ranked.length <= 3);
    assert.ok(status.statusHome.nextSteps.ranked.every((card) => card.kind && card.title && card.command));
    assert.equal(status.statusHome.detailsAvailable, true);
    assert.equal(status.statusHome.expansion.fullDetails.args.detail, "full");
    assert.equal(status.statusHome.expansion.missionDetails.args.showMissions, true);
    assert.equal(status.statusHome.expansion.statusAdjustments.args.requestStatusAdjustment, true);
    assert.equal("durableContextNotice" in status, false);
    assert.equal("dashboard" in status, false);
    assert.equal("dailyHome" in status, false);
    assert.equal("diagnostics" in status, false);
    assert.equal("statusAdjustmentContract" in status, false);
    assert.equal("preActionGuidance" in status.statusHome, false);
    assert.equal("projectState" in status.statusHome, false);
    assert.equal("blockersAndReconciliation" in status.statusHome, false);
    assert.equal("optionalMissionDetails" in status.statusHome, false);
    assert.equal(status.taskGraph, undefined);
    assert.equal(status.paperLifecycle, undefined);
    assert.equal(status.openQuestions, undefined);
    assert.equal(status.decisions, undefined);
    assert.equal(status.lineage, undefined);
    assert.equal(fullStatus.detail, "full");
    assertDurableContextNotice(fullStatus.durableContextNotice);
    assertFullPreActionGuidance(fullStatus.preActionGuidance, { surface: "dove.status", primaryRole: "planner" });
    assert.ok(fullStatus.dashboard && typeof fullStatus.dashboard === "object");
    assert.deepEqual(fullStatus.dashboard.project.durableContextNotice, fullStatus.durableContextNotice);
    assert.deepEqual(fullStatus.diagnostics.durableContextNotice, fullStatus.durableContextNotice);
    assert.ok(fullStatus.dashboard.tasks && typeof fullStatus.dashboard.tasks === "object");
    assert.equal(fullStatus.dashboard.dailyHome.presentation, "dove-status-home");
    assert.equal(fullStatus.dashboard.nextAction, fullStatus.dailyHome.nextActions[0].command);
    assert.ok(fullStatus.projectSummary && typeof fullStatus.projectSummary === "object");
    assert.equal(fullStatus.statusAdjustmentContract.mutationTool, "apply_dove_status_adjustments");
    assert.deepEqual(fullStatus.statusAdjustmentContract.statusChoices, ["pending", "ready", "in-progress", "blocked", "completed", "killed", "archived"]);
    assert.deepEqual(fullStatus.statusAdjustmentContract.writes, []);
    assert.equal(fullStatus.diagnostics.mayRefreshDerivedSurfaces, false);
    assert.equal(fullStatus.diagnostics.noCommandExecution, true);

    const pipeline = extractToolJson(dispatchToolFull(root, "query_paper_pipeline", {}));
    assert.equal(pipeline.mode, "paper-pipeline-query");
    assert.equal(pipeline.proposalOnly, true);
    assert.equal(pipeline.noAutoApply, true);
    assert.deepEqual(pipeline.writes, []);
    assert.equal(pipeline.diagnostics.noCommandExecution, true);
    assert.equal(pipeline.diagnostics.noExternalProcess, true);
    assert.equal(pipeline.diagnostics.noGitInspection, true);
    assert.ok(pipeline.stages.some((stage) => stage.id === "return" && stage.commandId === "project:dove.status"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("MCP run_figure_workflow routes gpt-image2 missing key to a secret boundary", () => {
  const root = createTempRoot("dove-mcp-figure-gpt-image2-");
  const previousEnv = {
    DOVE_CONFIG_PATH: process.env.DOVE_CONFIG_PATH,
    DOVE_FIGURE_PROVIDER_ID: process.env.DOVE_FIGURE_PROVIDER_ID,
    DOVE_FIGURE_PROVIDER: process.env.DOVE_FIGURE_PROVIDER,
    DOVE_FIGURE_PROVIDER_TYPE: process.env.DOVE_FIGURE_PROVIDER_TYPE,
    DOVE_FIGURE_ENDPOINT: process.env.DOVE_FIGURE_ENDPOINT,
    DOVE_FIGURE_COMMAND: process.env.DOVE_FIGURE_COMMAND,
    DOVE_FIGURE_MODEL: process.env.DOVE_FIGURE_MODEL,
    DOVE_FIGURE_API_KEY_ENV: process.env.DOVE_FIGURE_API_KEY_ENV,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY
  };
  try {
    seedTaskPacket(root, "mcp-figure-packet");
    process.env.DOVE_CONFIG_PATH = path.join(root, "missing-config.json");
    for (const key of ["DOVE_FIGURE_PROVIDER_ID", "DOVE_FIGURE_PROVIDER", "DOVE_FIGURE_PROVIDER_TYPE", "DOVE_FIGURE_ENDPOINT", "DOVE_FIGURE_COMMAND", "DOVE_FIGURE_MODEL", "DOVE_FIGURE_API_KEY_ENV", "OPENAI_API_KEY"]) {
      delete process.env[key];
    }

    const result = extractToolJson(dispatchToolFull(root, "run_figure_workflow", {
      packetId: "mcp-figure-packet",
      figureId: "mcp-gpt-image2",
      runId: "mcp-gpt-image2-missing-key-run",
      intent: "Draw a gpt-image2 figure through the MCP tool path.",
      requiredVisualElements: ["mcp evidence node", "mcp claim node"],
      providerId: "gpt-image2",
      executeProvider: true
    }));

    assert.equal(result.status, "blocked-boundary");
    assert.equal(result.diagnostics.providerReadiness.status, "missing-secret-env");
    assert.equal(result.diagnostics.providerExecution.status, "missing-secret-env");
    assert.equal(result.diagnostics.providerExecution.apiKeyEnv, "OPENAI_API_KEY");
    assert.equal(result.boundaryType, "awaiting-provider-output");
    assert.equal(result.boundary.type, "awaiting-provider-output");
    assert.equal(result.boundary.detail.implementationBoundaryType, "missing-secret-env");
    assert.deepEqual(result.boundary.requiredInputs, ["OPENAI_API_KEY"]);
    assert.ok(result.requiredActions.includes("set-provider-api-key-env"));
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("MCP run_figure_workflow keeps provider execution as a direct-process boundary in patch-plan mode", () => {
  const root = createTempRoot("dove-mcp-figure-patch-plan-");
  const providerScript = path.join(root, "mcp-patch-plan-provider.cjs");
  const previousEnv = {
    DOVE_CONFIG_PATH: process.env.DOVE_CONFIG_PATH,
    DOVE_FIGURE_PROVIDER_ID: process.env.DOVE_FIGURE_PROVIDER_ID,
    DOVE_FIGURE_PROVIDER: process.env.DOVE_FIGURE_PROVIDER,
    DOVE_FIGURE_PROVIDER_TYPE: process.env.DOVE_FIGURE_PROVIDER_TYPE,
    DOVE_FIGURE_ENDPOINT: process.env.DOVE_FIGURE_ENDPOINT,
    DOVE_FIGURE_COMMAND: process.env.DOVE_FIGURE_COMMAND,
    DOVE_FIGURE_MODEL: process.env.DOVE_FIGURE_MODEL,
    DOVE_FIGURE_API_KEY_ENV: process.env.DOVE_FIGURE_API_KEY_ENV,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY
  };
  try {
    seedTaskPacket(root, "mcp-figure-patch-plan-packet");
    fs.writeFileSync(providerScript, `#!/usr/bin/env node
const fs = require("node:fs");
fs.writeFileSync("mcp-provider-spawned.txt", "spawned", "utf8");
process.stdout.write(JSON.stringify({
  sourceSvgPath: ".dove/figures/runs/mcp-patch-plan-run/provider.svg",
  svgContent: "<svg xmlns=\\"http://www.w3.org/2000/svg\\"><text>MCP provider output claim node</text></svg>",
  caption: "MCP provider generated the workflow figure for the claim node."
}));
`, "utf8");
    fs.chmodSync(providerScript, 0o755);
    process.env.DOVE_CONFIG_PATH = path.join(root, "missing-config.json");
    process.env.DOVE_FIGURE_PROVIDER_ID = "mcp-patch-plan-command";
    process.env.DOVE_FIGURE_PROVIDER_TYPE = "external-command";
    process.env.DOVE_FIGURE_COMMAND = providerScript;
    for (const key of ["DOVE_FIGURE_PROVIDER", "DOVE_FIGURE_ENDPOINT", "DOVE_FIGURE_MODEL", "DOVE_FIGURE_API_KEY_ENV", "OPENAI_API_KEY"]) {
      delete process.env[key];
    }

    const result = extractToolJson(dispatchToolFull(root, "run_figure_workflow", {
      mutationMode: "patch-plan",
      packetId: "mcp-figure-patch-plan-packet",
      figureId: "mcp-patch-plan",
      runId: "mcp-patch-plan-run",
      intent: "Draw a provider-backed figure through MCP patch-plan mode.",
      requiredVisualElements: ["provider output", "claim node"],
      executeProvider: true
    }));

    assert.equal(result.mutationMode, "patch-plan");
    assert.equal(result.mutationModeSource, "explicit");
    assert.equal(result.writesApplied, false);
    assert.equal(result.hostRollbackEligible, true);
    assert.equal(result.status, "prepared-awaiting-output");
    assert.equal(result.diagnostics.providerExecution.status, "awaiting-provider-output");
    assert.equal(result.diagnostics.providerExecution.requiredMutationMode, "direct-process");
    assert.equal(result.diagnostics.providerExecution.directProcessRequired, true);
    assert.equal(result.boundaryType, "awaiting-provider-output");
    assert.ok(result.boundary.requiredInputs.includes("mutationMode: direct-process"));
    assert.ok(result.requiredActions.includes("retry-with-mutationMode-direct-process"));
    assert.equal(result.imported, null);
    assert.equal(result.finalSvgPath, null);
    assert.equal(fs.existsSync(path.join(root, "mcp-provider-spawned.txt")), false);
    assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "mcp-patch-plan.final.svg")), false);
    assert.equal(fs.existsSync(path.join(root, ".dove", "figures", "runs", "mcp-patch-plan-run", "provider.svg")), false);
    assert.ok(result.mutationPlan.operations.some((operation) => operation.relativePath === ".dove/figures/index.json"));
    assert.ok(result.mutationPlan.operations.some((operation) => operation.relativePath === ".dove/figures/generations.json"));
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("MCP mutations do not create Dove-specific rollback checkpoints", () => {
  const root = createTempRoot("dove-mcp-native-rollback-");
  try {
    extractToolJson(dispatchToolFull(root, "init_dove_goal", {
      id: "native-rollback-init",
      title: "Native rollback init",
      goal: "Validate host-native rollback visibility."
    }));
    const proposal = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "native-rollback-task",
      title: "Native rollback task",
      goal: "This task is tracked through Dove-written .dove files that host rollback may or may not capture."
    }));
    assert.equal(proposal.status, "needs-confirmation");
    assert.equal(proposal.rollbackCheckpoint, undefined);

    const created = extractToolJson(dispatchToolFull(root, "create_dove_task", proposal.confirmArgs));
    assert.equal(created.createdTask.id, "native-rollback-task");
    assert.equal(created.rollbackCheckpoint, undefined);
    assert.equal(fs.existsSync(path.join(root, ".dove", "versions", "rollback-index.json")), false);
    assert.equal(fs.existsSync(path.join(root, ".dove", "versions", "rollback")), false);

    const status = extractToolJson(dispatchToolFull(root, "query_dove_status", { detail: "full" }));
    assertDurableContextNotice(status.durableContextNotice);
    assert.equal(status.durableContextNotice.doveRestoreSupported, false);
    assert.equal("nativeProjectRollbackExpected" in status.durableContextNotice, false);
    assert.equal("nativeProjectRollbackRequiresProjectCheckpoint" in status.durableContextNotice, false);
    assert.equal(status.durableContextNotice.nativeHostRollbackRequiresFileCheckpoint, true);
    assert.equal(status.durableContextNotice.hostCheckpointStatus, "not-programmatically-verifiable");
    assert.equal(status.durableContextNotice.externalWriteCaptureVerified, false);
    assert.deepEqual(status.durableContextNotice.trackedDurablePaths, [".dove/state.json", ".dove/task-packets/index.json", ".dove/mutations/index.json"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("MCP patch-plan mutations return host-applied operations without writing disk", () => {
  const root = createTempRoot("dove-mcp-patch-plan-");
  try {
    const planned = extractToolJson(dispatchToolFull(root, "init_dove_goal", {
      mutationMode: "patch-plan",
      id: "patch-plan-init",
      title: "Patch-plan init",
      goal: "Return file operations for host-tracked application."
    }));
    assert.equal(planned.mutationMode, "patch-plan");
    assert.equal(planned.mutationModeSource, "explicit");
    assert.equal(planned.writesApplied, false);
    assert.equal(planned.hostRollbackEligible, true);
    assert.equal(planned.hostRollbackIneligibleReason, null);
    assert.equal(planned.recommendedMutationMode, null);
    assert.equal(planned.hostTrackedFileEditsRequired, true);
    assert.equal(planned.directProcessWritesAreRollbackSafe, false);
    assert.equal(planned.externalWriteCaptureVerified, false);
    assert.equal(planned.doveRestoreSupported, false);
    assert.ok(planned.mutationPlan && typeof planned.mutationPlan === "object");
    assert.equal(planned.mutationPlan.presentation, "dove-mutation-plan");
    assert.equal(planned.mutationPlan.writesApplied, false);
    assert.equal(planned.mutationPlan.hostTrackedFileEditsRequired, true);
    assert.equal(planned.mutationPlan.operations.some((operation) => operation.relativePath === ".dove/state.json"), true);
    assert.equal(planned.mutationPlan.operations.some((operation) => operation.relativePath === ".dove/task-packets/index.json"), true);
    assert.equal(planned.mutationPlan.operations.some((operation) => operation.relativePath === ".dove/mutations/index.json"), true);
    assert.ok(planned.mutationPlan.operations.every((operation) => operation.rollbackEligibility === "host-tracked-file-edits-required"));
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("MCP default direct-process mutations report rollback limits", () => {
  const root = createTempRoot("dove-mcp-default-direct-");
  try {
    const result = extractToolJson(dispatchToolFull(root, "init_dove_goal", {
      id: "default-direct-init",
      title: "Default direct init",
      goal: "Write normally while reporting host rollback limits."
    }));
    assert.equal(result.mutationMode, "direct-process");
    assert.equal(result.mutationModeSource, "default");
    assert.equal(result.writesApplied, true);
    assert.equal(result.hostRollbackEligible, false);
    assert.match(result.hostRollbackIneligibleReason, /direct-process writes are performed by the Dove process/);
    assert.equal(result.recommendedMutationMode, "patch-plan");
    assert.match(result.rollbackAdvice, /mutationMode: patch-plan/);
    assert.equal(fs.existsSync(path.join(root, ".dove", "state.json")), true);

    const status = extractToolJson(dispatchToolFull(root, "query_dove_status", { detail: "full" }));
    assert.equal(status.durableContextNotice.mutationRollbackModel.lastMutationMode, "direct-process");
    assert.match(status.durableContextNotice.mutationRollbackModel.hostRollbackIneligibleReason, /direct-process writes/);
    assert.equal(status.durableContextNotice.mutationRollbackModel.recommendedMutationMode, "patch-plan");
    assert.match(status.durableContextNotice.recoveryActions[2].rollbackAdvice, /mutationMode: patch-plan/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});


test("publish_dove_status writes sanitized public artifacts", () => {
  const root = createTempRoot("dove-mcp-public-status-");
  try {
    extractToolJson(dispatchToolFull(root, "init_dove_goal", {
      id: "public-status-init",
      title: "Public status init",
      goal: "Expose progress without exposing secrets."
    }));
    const proposal = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "public-status-task",
      goal: "Publish status without leaking api_key=supersecret.",
      title: "Public status task api_key=supersecret"
    }));
    extractToolJson(dispatchToolFull(root, "create_dove_task", proposal.confirmArgs));
    extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "public-status-archived",
      goal: "Archived public status noise should not leak details.",
      title: "Archived public status secret api_key=archivedsecret",
      status: "ready",
      confirmed: true,
      checklist: false
    }));
    const archived = extractToolJson(dispatchToolFull(root, "apply_dove_status_adjustments", {
      confirmed: true,
      adjustments: [{ packetId: "public-status-archived", status: "archived", reason: "Retired public dogfood noise." }]
    }));
    assert.equal(archived.status, "applied");

    const published = extractToolJson(dispatchToolFull(root, "publish_dove_status", { generatedAt: "2026-06-16T00:00:00.000Z" }));
    assert.equal(published.mode, "dove-public-status-publish");
    assert.equal(published.status, "published");
    assert.deepEqual(published.writes, [".dove/public/status.json", ".dove/public/status.md", ".dove/public/index.html"]);
    assert.equal(published.privacy.sanitized, true);
    assert.equal(published.privacy.transcriptsIncluded, false);
    assert.equal(published.privacy.runtimeEntriesIncluded, false);
    assert.equal(published.privacy.documentLedgerRawEntriesIncluded, false);
    assert.equal(published.privacy.documentBodiesIncluded, false);
    assert.equal(published.snapshot.documents.counts.total, 0);
    assert.equal(published.noExternalProcess, true);
    assert.equal(published.cloudflareTunnelStarted, false);
    assert.equal(published.snapshot.progress.counts.archived, 0);
    assert.equal(published.snapshot.progress.counts.archivedHidden, 1);
    assert.equal(published.snapshot.tasks.active.some((task) => task.id === "public-status-task"), true);
    assert.equal(published.snapshot.tasks.active.some((task) => task.id === "public-status-archived"), false);

    const jsonPath = path.join(root, ".dove", "public", "status.json");
    const mdPath = path.join(root, ".dove", "public", "status.md");
    const htmlPath = path.join(root, ".dove", "public", "index.html");
    assert.equal(fs.existsSync(jsonPath), true);
    assert.equal(fs.existsSync(mdPath), true);
    assert.equal(fs.existsSync(htmlPath), true);
    const publicText = `${fs.readFileSync(jsonPath, "utf8")}\n${fs.readFileSync(mdPath, "utf8")}\n${fs.readFileSync(htmlPath, "utf8")}`;
    assert.equal(publicText.includes("supersecret"), false);
    assert.equal(publicText.includes("archivedsecret"), false);
    assert.equal(publicText.includes("public-status-archived"), false);
    assert.equal(publicText.includes("Archived public status secret"), false);
    assert.equal(publicText.includes("Retired public dogfood noise"), false);
    assert.match(publicText, /<redacted>/);
    assert.match(publicText, /默认隐藏 1/);
    assert.match(publicText, /不包含 raw transcripts/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("publish_dove_global_status aggregates explicit project public artifacts without leaking roots", () => {
  const root = createTempRoot("dove-mcp-global-public-status-");
  const projectA = path.join(root, "project-a");
  const projectB = path.join(root, "project-b");
  const missingProject = path.join(root, "missing-project");
  const outputDir = path.join(root, "global-public");
  try {
    for (const [projectRoot, suffix] of [[projectA, "a"], [projectB, "b"]]) {
      fs.mkdirSync(projectRoot, { recursive: true });
      extractToolJson(dispatchToolFull(projectRoot, "init_dove_goal", {
        id: `global-status-init-${suffix}`,
        title: `Global Status Project ${suffix.toUpperCase()}`,
        goal: "Expose a project-local public status for global aggregation."
      }));
      extractToolJson(dispatchToolFull(projectRoot, "create_dove_task", {
        id: `global-status-task-${suffix}`,
        goal: "Publish project status for the global index.",
        title: `Global status task ${suffix}`,
        confirmed: true
      }));
      extractToolJson(dispatchToolFull(projectRoot, "publish_dove_status", { generatedAt: `2026-06-17T0${suffix === "a" ? "1" : "2"}:00:00.000Z` }));
    }

    const published = extractToolJson(dispatchToolFull(root, "publish_dove_global_status", {
      projectRoots: [projectA, projectB, missingProject],
      outputDir,
      generatedAt: "2026-06-17T03:00:00.000Z"
    }));
    assert.equal(published.mode, "dove-global-public-status-publish");
    assert.equal(published.status, "published");
    assert.equal(published.refresh, false);
    assert.equal(published.snapshot.counts.configured, 3);
    assert.equal(published.snapshot.counts.published, 2);
    assert.equal(published.snapshot.counts.missing, 1);
    assert.equal(published.privacy.absoluteRootsIncluded, false);
    assert.equal(published.noExternalProcess, true);
    assert.equal(published.cloudflareTunnelStarted, false);
    assert.equal(fs.existsSync(path.join(outputDir, "status.json")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "status.md")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "index.html")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "projects", "project-a", "status.json")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "projects", "project-b", "index.html")), true);
    assert.equal(fs.existsSync(path.join(outputDir, "projects", "missing-project", "status.md")), true);

    const publicText = [
      path.join(outputDir, "status.json"),
      path.join(outputDir, "status.md"),
      path.join(outputDir, "index.html"),
      path.join(outputDir, "projects", "missing-project", "status.json"),
      path.join(outputDir, "projects", "missing-project", "status.md"),
      path.join(outputDir, "projects", "missing-project", "index.html")
    ].map((filePath) => fs.readFileSync(filePath, "utf8")).join("\n");
    assert.equal(publicText.includes(root), false);
    assert.match(publicText, /Global Status Project A/);
    assert.match(publicText, /missing-project/);
    assert.ok(published.snapshot.projects.every((project) => !Object.hasOwn(project, "root")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("publish_dove_global_status patch-plan stages project-local global artifacts", () => {
  const root = createTempRoot("dove-mcp-global-patch-plan-");
  const project = path.join(root, "project-a");
  const outputDir = path.join(root, "planned-global");
  try {
    fs.mkdirSync(project, { recursive: true });
    extractToolJson(dispatchToolFull(project, "init_dove_goal", {
      id: "global-patch-init",
      title: "Global Patch Project",
      goal: "Publish project status before aggregation."
    }));
    extractToolJson(dispatchToolFull(project, "publish_dove_status", { generatedAt: "2026-06-17T04:00:00.000Z" }));

    const planned = extractToolJson(dispatchToolFull(root, "publish_dove_global_status", {
      mutationMode: "patch-plan",
      projectRoots: [project],
      outputDir,
      generatedAt: "2026-06-17T05:00:00.000Z"
    }));
    assert.equal(planned.mode, "dove-global-public-status-publish");
    assert.equal(planned.mutationMode, "patch-plan");
    assert.equal(planned.writesApplied, false);
    assert.equal(planned.hostRollbackEligible, true);
    assert.equal(planned.mutationPlan.operations.some((operation) => operation.relativePath === "planned-global/status.json"), true);
    assert.equal(planned.mutationPlan.operations.some((operation) => operation.relativePath === "planned-global/projects/project-a/status.json"), true);
    assert.equal(planned.mutationPlan.operations.some((operation) => operation.relativePath === ".dove/mutations/index.json"), true);
    assert.equal(fs.existsSync(outputDir), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("document evidence ledger stores internal and public-safe entries without publishing raw bodies", () => {
  const root = createTempRoot("dove-mcp-doc-ledger-");
  try {
    extractToolJson(dispatchToolFull(root, "init_dove_goal", {
      id: "doc-ledger-init",
      title: "Document ledger init",
      goal: "Validate document evidence archival."
    }));
    const created = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "doc-ledger-task",
      goal: "Record internal and external document evidence.",
      title: "Document ledger task",
      checklist: false,
      confirmed: true
    }));
    const packetId = created.createdTask.id;

    const internal = extractToolJson(dispatchToolFull(root, "record_document_evidence", {
      packetId,
      id: "internal-review-entry",
      title: "Internal review evidence",
      documentKind: "review",
      evidenceScope: "internal",
      summary: "Internal ledger-only summary api_key=private-ledger-secret.",
      artifactRefs: [".dove/reviews/internal.md"],
      evidenceLinks: [".dove/runtime/results.json"]
    }));
    assert.equal(internal.status, "recorded");
    assert.equal(internal.createdDocument, false);
    assert.equal(internal.entry.publicSafe, false);
    assert.equal(internal.entry.evidenceScope, "internal");
    assert.deepEqual(internal.writes, [".dove/documents/ledger.json"]);
    assertPreActionGuidanceSummary(internal.preActionGuidanceSummary, { surface: "dove.documents", primaryRole: "builder" });
    assertPreActionGuidanceSummary(internal.resultCard.preActionGuidanceSummary, { surface: "dove.documents", primaryRole: "builder" });

    const internalQuery = extractToolJson(dispatchToolFull(root, "query_document_ledger", { packetId, publicSafe: false }));
    assert.equal(internalQuery.mode, "document-ledger-query");
    assert.equal(internalQuery.proposalOnly, true);
    assert.equal(internalQuery.noAutoApply, true);
    assert.deepEqual(internalQuery.writes, []);
    assert.equal(internalQuery.entries.length, 1);
    assert.equal(internalQuery.entries[0].id, "internal-review-entry");
    assert.equal(internalQuery.privacy.documentBodiesIncluded, false);

    const internalOnlyPublic = extractToolJson(dispatchToolFull(root, "publish_dove_status", { generatedAt: "2026-06-17T00:00:00.000Z" }));
    assert.equal(internalOnlyPublic.snapshot.documents.counts.total, 0);
    assert.equal(internalOnlyPublic.snapshot.documents.counts.publicSafe, 0);
    assert.deepEqual(internalOnlyPublic.snapshot.documents.recentPublicSafe, []);

    const publicEntry = extractToolJson(dispatchToolFull(root, "record_document_evidence", {
      packetId,
      id: "public-source-entry",
      title: "Public source evidence",
      documentKind: "source",
      evidenceScope: "external",
      publicSafe: true,
      summary: "Public-safe external evidence summary.",
      artifactRefs: [".dove/sources/index.json"],
      evidenceLinks: [".dove/evidence/index.json"],
      createDocument: true,
      documentPath: ".dove/documents/source/public-evidence.md",
      body: "# Public evidence body\n\nDocument body should not be copied to public status.\n"
    }));
    assert.equal(publicEntry.createdDocument, true);
    assert.equal(publicEntry.entry.publicSafe, true);
    assert.equal(publicEntry.entry.documentPath, ".dove/documents/source/public-evidence.md");
    assert.equal(fs.existsSync(path.join(root, publicEntry.entry.documentPath)), true);
    assertPreActionGuidanceSummary(publicEntry.preActionGuidanceSummary, { surface: "dove.documents", primaryRole: "builder" });
    assertPreActionGuidanceSummary(publicEntry.resultCard.preActionGuidanceSummary, { surface: "dove.documents", primaryRole: "builder" });

    const duplicateCreate = extractToolJson(dispatchToolFull(root, "record_document_evidence", {
      packetId,
      id: "public-source-entry-duplicate",
      title: "Public source evidence duplicate",
      documentKind: "source",
      evidenceScope: "external",
      publicSafe: true,
      summary: "Duplicate public-safe evidence summary.",
      createDocument: true,
      documentPath: ".dove/documents/source/public-evidence.md",
      body: "# Duplicate public evidence body\n"
    }));
    assert.equal(duplicateCreate.createdDocument, true);
    assert.equal(duplicateCreate.entry.documentPath, ".dove/documents/source/public-evidence-2.md");
    assert.equal(fs.existsSync(path.join(root, duplicateCreate.entry.documentPath)), true);
    assertPreActionGuidanceSummary(duplicateCreate.preActionGuidanceSummary, { surface: "dove.documents", primaryRole: "builder" });
    assertPreActionGuidanceSummary(duplicateCreate.resultCard.preActionGuidanceSummary, { surface: "dove.documents", primaryRole: "builder" });

    const appended = extractToolJson(dispatchToolFull(root, "record_document_evidence", {
      packetId,
      id: "public-source-entry-append",
      title: "Public source evidence append",
      documentKind: "source",
      evidenceScope: "external",
      publicSafe: true,
      summary: "Append public-safe evidence summary.",
      appendDocument: true,
      documentPath: publicEntry.entry.documentPath,
      body: "Appended archive-only body."
    }));
    assert.equal(appended.appendedDocument, true);
    assert.match(fs.readFileSync(path.join(root, publicEntry.entry.documentPath), "utf8"), /Appended archive-only body/);
    assertPreActionGuidanceSummary(appended.preActionGuidanceSummary, { surface: "dove.documents", primaryRole: "builder" });
    assertPreActionGuidanceSummary(appended.resultCard.preActionGuidanceSummary, { surface: "dove.documents", primaryRole: "builder" });

    const publicQuery = extractToolJson(dispatchToolFull(root, "query_document_ledger", { packetId, publicSafe: true }));
    assert.equal(publicQuery.entries.length, 3);
    assert.ok(publicQuery.entries.every((entry) => entry.publicSafe === true));

    const published = extractToolJson(dispatchToolFull(root, "publish_dove_status", { generatedAt: "2026-06-17T01:00:00.000Z" }));
    assert.equal(published.snapshot.documents.counts.total, 3);
    assert.equal(published.snapshot.documents.counts.publicSafe, 3);
    assert.equal(published.snapshot.documents.recentPublicSafe.length, 3);
    assert.equal(published.snapshot.documents.recentPublicSafe[0].title, "Public source evidence");
    assert.equal(published.privacy.documentLedgerRawEntriesIncluded, false);
    assert.equal(published.privacy.documentBodiesIncluded, false);

    const publicText = `${fs.readFileSync(path.join(root, ".dove", "public", "status.json"), "utf8")}\n${fs.readFileSync(path.join(root, ".dove", "public", "status.md"), "utf8")}\n${fs.readFileSync(path.join(root, ".dove", "public", "index.html"), "utf8")}`;
    assert.match(publicText, /Public-safe external evidence summary/);
    assert.equal(publicText.includes("private-ledger-secret"), false);
    assert.equal(publicText.includes("Document body should not be copied"), false);
    assert.equal(publicText.includes("Appended archive-only body"), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("thin workflow MCP surfaces return pre-action guidance summaries", () => {
  const root = createTempRoot("dove-mcp-thin-guidance-");
  try {
    extractToolJson(dispatchToolFull(root, "ensure_workspace", {}));
    const packetId = seedTaskPacket(root, "thin-summary-packet");
    const override = "Integration test exercises direct thin-surface guidance summaries.";

    const emptySource = dispatchTool(root, "register_source", { packetId });
    assert.equal(emptySource.isError, true);
    assert.match(emptySource.content[0].text, /title or locator/);

    const unverifiedSource = extractToolJson(dispatchToolFull(root, "register_source", {
      packetId,
      sourceId: "blocked-cvpr-guidelines",
      title: "CVPR 2026 Author Guidelines",
      locator: "https://cvpr.thecvf.com/Conferences/2026/AuthorGuidelines",
      origin: "WebSearch did 0 searches and WebFetch page verification was blocked by safe-domain verification."
    }));
    assert.equal(unverifiedSource.status, "needs-source-verification");
    assert.equal(unverifiedSource.sourceCount, 0);
    assert.equal(unverifiedSource.proposalOnly, true);
    assert.deepEqual(unverifiedSource.writes, []);
    assert.equal(unverifiedSource.boundary.type, "host-tool-blocked");
    assert.equal(unverifiedSource.resultCard.requiresAction, true);
    const sourcePath = path.join(root, ".dove", "sources", "index.json");
    if (fs.existsSync(sourcePath)) {
      assert.equal(JSON.parse(fs.readFileSync(sourcePath, "utf8")).items.length, 0);
    }

    const emptyNote = dispatchTool(root, "upsert_note", { packetId, noteId: "empty-note" });
    assert.equal(emptyNote.isError, true);
    assert.match(emptyNote.content[0].text, /summary, quote, claim, or open question/);
    const notesPath = path.join(root, ".dove", "notes", "index.json");
    if (fs.existsSync(notesPath)) {
      assert.equal(JSON.parse(fs.readFileSync(notesPath, "utf8")).items.length, 0);
    }

    const emptyDraft = dispatchTool(root, "upsert_draft", { packetId, sectionId: "empty-draft" });
    assert.equal(emptyDraft.isError, true);
    assert.match(emptyDraft.content[0].text, /requires body content/);
    assert.equal(fs.existsSync(path.join(root, ".dove", "drafts", "empty-draft.md")), false);

    const emptyExperience = dispatchTool(root, "run_experience_workflow", { packetId });
    assert.equal(emptyExperience.isError, true);
    assert.match(emptyExperience.content[0].text, /experiment goal, title, idea, or experimentId/);
    const experimentPlansPath = path.join(root, ".dove", "experiments", "plans.json");
    if (fs.existsSync(experimentPlansPath)) {
      assert.equal(JSON.parse(fs.readFileSync(experimentPlansPath, "utf8")).items.length, 0);
    }

    const emptyReviewLoopDraft = dispatchTool(root, "run_dove_review_loop", { packetId, runId: "empty-review-loop-draft", draft: {} });
    assert.equal(emptyReviewLoopDraft.isError, true);
    assert.match(emptyReviewLoopDraft.content[0].text, /draftBody or draft\.body/);
    const emptyReviewLoopExperience = dispatchTool(root, "run_dove_review_loop", { packetId, runId: "empty-review-loop-experience", experience: {} });
    assert.equal(emptyReviewLoopExperience.isError, true);
    assert.match(emptyReviewLoopExperience.content[0].text, /experienceGoal or an experience goal/);
    const reviewArtifactText = [path.join(root, ".dove", "reviews", "REVIEW_STATE.json"), path.join(root, ".dove", "reviews", "log.md")]
      .filter((filePath) => fs.existsSync(filePath))
      .map((filePath) => fs.readFileSync(filePath, "utf8"))
      .join("\n");
    assert.equal(reviewArtifactText.includes("empty-review-loop"), false);

    const source = extractToolJson(dispatchToolFull(root, "register_source", {
      packetId,
      citationKey: "thin2026guidance",
      title: "Thin Surface Guidance",
      authors: ["Validator"],
      year: 2026,
      sourceType: "paper"
    }));
    assertPreActionGuidanceSummary(source.preActionGuidanceSummary, { surface: "dove.source", primaryRole: "builder" });
    assert.ok(source.packetIds.includes(packetId));
    assert.deepEqual(source.artifactWrites.primaryArtifactPaths, [".dove/sources/index.json"]);
    assert.ok(source.artifactWrites.synthesisArtifactPaths.includes(".dove/bibliography/references.bib"));
    assert.ok(source.artifactWrites.synthesisArtifactPaths.includes(".dove/bibliography/citation-log.md"));
    assert.ok(source.artifactWrites.synthesisArtifactPaths.includes(".dove/wiki/query_pack.md"));
    assert.ok(source.artifactWrites.refreshOnlyArtifactPaths.includes(".dove/workspace/index.json"));

    const batchSources = extractToolJson(dispatchToolFull(root, "register_source", {
      packetId,
      sourceType: "guideline",
      origin: "integration-test",
      sources: [
        {
          sourceId: "cvpr-author-kit",
          citationKey: "cvprAuthorKit2026",
          title: "CVPR Author Kit",
          locator: "CVPR author-kit fixture"
        },
        {
          sourceId: "cvpr-reviewer-guidelines",
          citationKey: "cvprReviewerGuidelines2026",
          title: "CVPR Reviewer Guidelines",
          locator: "CVPR reviewer-guidelines fixture"
        }
      ]
    }));
    assert.equal(batchSources.status, "registered");
    assert.equal(batchSources.sourceCount, 2);
    assert.deepEqual(batchSources.sourceIds, ["cvpr-author-kit", "cvpr-reviewer-guidelines"]);
    assert.ok(batchSources.items.every((item) => item.packetIds.includes(packetId)));
    assertPreActionGuidanceSummary(batchSources.preActionGuidanceSummary, { surface: "dove.source", primaryRole: "builder" });
    assert.deepEqual(batchSources.artifactWrites.primaryArtifactPaths, [".dove/sources/index.json"]);
    assert.ok(batchSources.artifactWrites.synthesisArtifactPaths.includes(".dove/wiki/query_pack.md"));
    assert.ok(batchSources.artifactWrites.refreshOnlyArtifactPaths.includes(".dove/sessions/LATEST_SUMMARY.md"));

    const note = extractToolJson(dispatchToolFull(root, "upsert_note", {
      packetId,
      title: "Thin guidance note",
      sectionId: "introduction",
      sourceIds: [source.id],
      summary: "Thin surfaces should preserve guidance summaries.",
      claims: ["Thin surfaces preserve guidance summaries."]
    }));
    assertPreActionGuidanceSummary(note.preActionGuidanceSummary, { surface: "dove.note", primaryRole: "builder" });
    assert.ok(note.packetIds.includes(packetId));
    assert.deepEqual(note.artifactWrites.primaryArtifactPaths, [".dove/notes/index.json"]);
    assert.deepEqual(note.artifactWrites.synthesisArtifactPaths, [".dove/wiki/query_pack.md"]);
    assert.ok(note.artifactWrites.refreshOnlyArtifactPaths.includes(".dove/workspace/index.json"));
    assert.ok(note.artifactWrites.refreshOnlyArtifactPaths.includes(".dove/sessions/LATEST_SUMMARY.md"));

    const batchNote = extractToolJson(dispatchToolFull(root, "upsert_note", {
      packetId,
      noteId: "venue-writing-intelligence",
      title: "Venue writing intelligence",
      sectionId: "venue-writing",
      sourceIds: batchSources.sourceIds,
      summary: "Reviewer-preference synthesis belongs in notes after external provenance is registered.",
      claims: ["Venue writing preferences are internal synthesis, not an external source."]
    }));
    assert.deepEqual(batchNote.sourceIds, batchSources.sourceIds);
    assert.ok(batchNote.packetIds.includes(packetId));
    assertPreActionGuidanceSummary(batchNote.preActionGuidanceSummary, { surface: "dove.note", primaryRole: "builder" });

    const persistedSources = JSON.parse(fs.readFileSync(path.join(root, ".dove", "sources", "index.json"), "utf8"));
    assert.equal(persistedSources.items.length, 3);
    assert.ok(persistedSources.items.every((item) => item.packetIds.includes(packetId)));
    const persistedNotes = JSON.parse(fs.readFileSync(path.join(root, ".dove", "notes", "index.json"), "utf8"));
    assert.ok(persistedNotes.items.every((item) => item.packetIds.includes(packetId)));

    const claims = extractToolJson(dispatchToolFull(root, "upsert_claims", {
      packetId,
      claims: [{
        id: "thin-guidance-claim",
        text: "Thin workflow surfaces return pre-action guidance summaries.",
        sectionId: "introduction",
        sourceIds: [source.id],
        noteIds: [note.id],
        evidenceLinks: [".dove/notes/index.json"],
        status: "draft",
        confidence: "medium"
      }],
      policyOverrideReason: override
    }));
    assert.ok(claims.claims.some((claim) => claim.id === "thin-guidance-claim"));
    assertPreActionGuidanceSummary(claims.preActionGuidanceSummary, { surface: "dove.draft", primaryRole: "builder" });

    const draftEnvelope = extractMcpEnvelopeJson(dispatchTool(root, "upsert_draft", {
      resultMode: "full",
      packetId,
      sectionId: "thin-guidance-draft",
      title: "Thin guidance draft",
      body: "Thin workflow surfaces preserve direct draft evidence for reviewer handoff.",
      summary: "Draft quick path write evidence."
    }));
    assert.equal(draftEnvelope.writeIntent, "applied");
    assert.equal(draftEnvelope.rollbackEligible, "unverified");
    assert.ok(draftEnvelope.writes.paths.includes(".dove/drafts/thin-guidance-draft.md"));
    const draft = draftEnvelope.fullResult;
    assert.equal(draft.draftPath, ".dove/drafts/thin-guidance-draft.md");
    assertPreActionGuidanceSummary(draft.preActionGuidanceSummary, { surface: "dove.draft", primaryRole: "builder" });
    assert.deepEqual(draft.artifactWrites.primaryArtifactPaths, [".dove/drafts/thin-guidance-draft.md"]);
    assert.ok(draft.artifactWrites.refreshOnlyArtifactPaths.includes(".dove/workspace/index.json"));
    assert.ok(draft.artifactWrites.refreshOnlyArtifactPaths.includes(".dove/sessions/LATEST_SUMMARY.md"));

    const experimentPlan = extractToolJson(dispatchToolFull(root, "upsert_experiment_plan", {
      packetId,
      id: "thin-guidance-experiment",
      title: "Thin guidance experiment",
      claimId: "thin-guidance-claim",
      hypothesis: "Direct thin surfaces preserve guidance summaries.",
      methodology: "Record a direct result and inspect audit and bridge summaries.",
      successMetric: "All direct returns include guidance summaries.",
      comparisonTargets: ["chat-only"],
      policyOverrideReason: override
    }));
    assert.equal(experimentPlan.id, "thin-guidance-experiment");
    assertPreActionGuidanceSummary(experimentPlan.preActionGuidanceSummary, { surface: "dove.experience", primaryRole: "builder" });
    const experimentPacketId = `experiment-${experimentPlan.id}`;

    const experimentResult = extractToolJson(dispatchToolFull(root, "upsert_experiment_result", {
      packetId: experimentPacketId,
      result: {
        id: "thin-guidance-result",
        experimentId: "thin-guidance-experiment",
        claimId: "thin-guidance-claim",
        outcome: "supports",
        summary: "Thin result supports the guidance summary claim.",
        evidenceLinks: [".dove/evidence/index.json"],
        comparisonTargets: ["chat-only"]
      },
      policyOverrideReason: override
    }));
    assert.equal(experimentResult.id, "thin-guidance-result");
    assertPreActionGuidanceSummary(experimentResult.preActionGuidanceSummary, { surface: "dove.experience", primaryRole: "builder" });

    const experimentAudit = extractToolJson(dispatchToolFull(root, "run_experiment_audit", {
      packetId: experimentPacketId,
      resultId: "thin-guidance-result",
      policyOverrideReason: override
    }));
    assert.equal(experimentAudit.resultId, "thin-guidance-result");
    assertPreActionGuidanceSummary(experimentAudit.preActionGuidanceSummary, { surface: "dove.experience", primaryRole: "reviewer" });

    const claimBridge = extractToolJson(dispatchToolFull(root, "bridge_result_to_claim", {
      packetId: experimentPacketId,
      resultId: "thin-guidance-result",
      auditIds: [experimentAudit.id],
      reason: "Bridge thin result into claim state for guidance summary coverage.",
      policyOverrideReason: override
    }));
    assert.equal(claimBridge.resultId, "thin-guidance-result");
    assertPreActionGuidanceSummary(claimBridge.preActionGuidanceSummary, { surface: "dove.experience", primaryRole: "builder" });

    const checklist = extractToolJson(dispatchToolFull(root, "sync_checklist", {}));
    assert.equal(checklist.checklistPath, ".dove/checklists/current.md");
    assertPreActionGuidanceSummary(checklist.preActionGuidanceSummary, { surface: "dove.status", primaryRole: "planner" });

    const citations = extractToolJson(dispatchToolFull(root, "sync_citations", { preservePhase: true }));
    assert.equal(citations.sourceCount, 3);
    assertPreActionGuidanceSummary(citations.preActionGuidanceSummary, { surface: "dove.draft", primaryRole: "builder" });

    const wiki = extractToolJson(dispatchToolFull(root, "refresh_wiki", {}));
    assert.equal(wiki.wikiPath, ".dove/wiki/index.md");
    assertPreActionGuidanceSummary(wiki.preActionGuidanceSummary, { surface: "dove.status", primaryRole: "planner" });

    const figurePlan = extractToolJson(dispatchToolFull(root, "upsert_figure_plan", {
      packetId,
      items: [{
        id: "thin-guidance-figure",
        name: "Thin guidance figure",
        purpose: "Show thin workflow guidance summary coverage.",
        targetClaimIds: ["thin-guidance-claim"],
        relatedExperimentIds: ["thin-guidance-experiment"],
        requiredVisualElements: ["claim", "experiment", "guidance"],
        captionIntent: "Explain how direct figure surfaces preserve provenance guidance.",
        outputFormat: "svg"
      }]
    }));
    assert.equal(figurePlan.figureCount, 1);
    assertPreActionGuidanceSummary(figurePlan.preActionGuidanceSummary, { surface: "dove.figure", primaryRole: "builder" });

    const preparedFigure = extractToolJson(dispatchToolFull(root, "prepare_figure_generation", {
      packetId,
      figureId: "thin-guidance-figure",
      runId: "thin-guidance-figure-run",
      allowMissingMaterials: true
    }));
    assert.equal(preparedFigure.runId, "thin-guidance-figure-run");
    assertPreActionGuidanceSummary(preparedFigure.preActionGuidanceSummary, { surface: "dove.figure", primaryRole: "builder" });

    const importedFigure = extractToolJson(dispatchToolFull(root, "import_figure_generation", {
      packetId,
      figureId: "thin-guidance-figure",
      runId: preparedFigure.runId,
      sourceSvgPath: ".dove/figures/runs/thin-guidance-figure-run/final.svg",
      svgContent: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Thin guidance figure</text></svg>",
      caption: "Thin guidance figure records safe import provenance."
    }));
    assert.equal(importedFigure.finalSvgPath, ".dove/figures/thin-guidance-figure.final.svg");
    assertPreActionGuidanceSummary(importedFigure.preActionGuidanceSummary, { surface: "dove.figure", primaryRole: "builder" });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("create_dove_task converts demand before materializing a one-pass mission", () => {
  const root = createTempRoot("dove-mcp-mission-confirm-");
  try {
    const init = extractToolJson(dispatchToolFull(root, "init_dove_goal", {
      id: "mission-confirm-init",
      goal: "Validate mission confirmation boundaries."
    }));
    const proposal = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "mission-confirm-task",
      goal: "Convert operator demand into a task contract before one mission pass.",
      title: "Mission conversion task"
    }));
    assert.equal(proposal.status, "needs-confirmation");
    assert.equal(proposal.responseLanguage, "zh");
    assert.match(proposal.message, /批准/);
    assert.equal(proposal.proposalOnly, true);
    assert.equal(proposal.noAutoApply, true);
    assert.deepEqual(proposal.writes, []);
    assert.equal(proposal.confirmationRequired, true);
    assert.equal(proposal.demandConversion, true);
    assert.equal(proposal.executionMode, "single-foreground-pass");
    assert.equal(proposal.proposedTask.id, "mission-confirm-task");
    assert.equal(proposal.proposedTask.rootId, init.init.id);
    assert.equal(proposal.taskCard.presentation, "compact-task-card");
    assert.equal(proposal.taskCard.packetId, "mission-confirm-task");
    assert.equal(proposal.taskCard.proposalOnly, true);
    assert.equal(proposal.taskCard.noAutoApply, true);
    assertFullPreActionGuidance(proposal.preActionGuidance, { surface: "dove.mission", primaryRole: "planner" });
    assertFullPreActionGuidance(proposal.taskCard.preActionGuidance, { surface: "dove.mission", primaryRole: "planner" });
    assert.equal(proposal.workContract.purpose.includes("Mission conversion task"), true);
    assert.ok(proposal.workContract.deliverables.length > 0);
    assert.ok(proposal.workContract.outOfScope.length > 0);
    assert.ok(proposal.workContract.evidenceContract.length > 0);
    assert.ok(proposal.workContract.doneCriteria.length > 0);
    assert.equal(proposal.workContract.recommendedRoutes[0].command, "project:dove.auto");
    assert.equal(proposal.workContract.recommendedRoutes[0].copyableCommand, "project:dove.auto --packet-id mission-confirm-task");
    assert.deepEqual(proposal.taskCard.recommendedRoutes, proposal.workContract.recommendedRoutes);
    assert.equal(proposal.confirmArgs.confirmed, true);
    assert.deepEqual(proposal.confirmArgs.workContract, proposal.workContract);

    const englishProposal = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "mission-confirm-task-en",
      goal: "Keep generated task messages in English when requested.",
      title: "English mission conversion task",
      responseLanguage: "en"
    }));
    assert.equal(englishProposal.status, "needs-confirmation");
    assert.equal(englishProposal.responseLanguage, "en");
    assert.equal(englishProposal.taskCard.confirmation, "No automatic execution; explicit confirmation is required.");
    assert.match(englishProposal.message, /Approve this demand-to-task mission contract/);

    const proposedIndex = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "index.json"), "utf8"));
    assert.deepEqual(proposedIndex.items.map((item) => item.id), ["mission-confirm-init"]);

    const created = extractToolJson(dispatchToolFull(root, "create_dove_task", proposal.confirmArgs));
    assert.equal(created.status, "created-awaiting-host-pass");
    assert.equal(created.confirmationRequired, false);
    assert.equal(created.demandConversion, true);
    assert.equal(created.executionMode, "single-foreground-pass");
    assert.equal(created.missionPassRequired, true);
    assert.equal(created.recordMissionPassTool, "record_dove_mission_pass");
    assertPreActionGuidanceSummary(created.preActionGuidanceSummary, { surface: "dove.mission", primaryRole: "planner" });
    assert.equal(created.createdTask.id, "mission-confirm-task");
    assert.deepEqual(created.createdTask.workContract, proposal.workContract);
    const createdPacket = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "packets", "mission-confirm-task.json"), "utf8"));
    assert.deepEqual(createdPacket.workContract, proposal.workContract);

    const missionCriterion = created.createdTask.executionContract.convergence.criteria[0];
    const pass = extractToolJson(dispatchToolFull(root, "record_dove_mission_pass", {
      packetId: created.createdTask.id,
      runId: "mission-confirm-pass",
      resultStatus: "completed",
      resultSummary: "Confirmed demand was converted and one foreground pass completed.",
      evidenceLinks: [".dove/task-packets/index.json"],
      artifactRefs: [".dove/task-packets/index.json"],
      verificationEvidencePaths: [MCP_VERIFICATION_PATH],
      verifiedCriteria: mcpVerifiedCriteria(missionCriterion)
    }));
    assert.equal(pass.status, "completed");
    assert.equal(pass.result.surface, "dove.mission");
    assert.equal(pass.result.maxIterations, 1);
    assert.equal(pass.result.iterationCount, 1);
    assert.equal(pass.result.packetId, "mission-confirm-task");
    assert.equal(pass.resultCard.presentation, "compact-result-summary-card");
    assert.equal(pass.resultCard.surface, "dove.mission");
    assert.equal(pass.resultCard.packetId, "mission-confirm-task");
    assertPreActionGuidanceSummary(pass.preActionGuidanceSummary, { surface: "dove.mission" });
    assertPreActionGuidanceSummary(pass.resultCard.preActionGuidanceSummary, { surface: "dove.mission" });
    assert.ok(pass.resultCard.evidence.includes(".dove/task-packets/index.json"));
    assert.equal(pass.executionReceipt.packetId, "mission-confirm-task");
    assert.equal(pass.result.executionReceipt.packetId, "mission-confirm-task");
    assert.equal(pass.resultCard.executionReceipt.packetId, "mission-confirm-task");
    assert.equal(pass.resultCard.executionReceipt.criteriaCoverage.complete, true);
    assert.ok(pass.resultCard.executionReceipt.evidenceCount >= 2);
    assert.equal(pass.resultCard.proposalOnly, false);

    const statusAfterPass = extractToolJson(dispatchToolFull(root, "query_dove_status", { detail: "full" }));
    assert.equal(statusAfterPass.dailyHome.recentExecutionReceipts.length, 1);
    assert.equal(statusAfterPass.dailyHome.recentExecutionReceipts[0].packetId, "mission-confirm-task");
    assert.equal(statusAfterPass.dailyHome.recentExecutionReceipts[0].criteriaCoverage.complete, true);

    const materializedIndex = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "index.json"), "utf8"));
    assert.deepEqual(materializedIndex.items.map((item) => item.id), ["mission-confirm-init", "mission-confirm-task"]);
    assert.equal(materializedIndex.items.find((item) => item.id === "mission-confirm-task").status, "completed");

    const inlineContract = mcpExecutionContract({ convergence: { criteria: ["Inline pass recorded criterion"] } });
    const passRecorded = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "mission-pass-recorded-task",
      goal: "Convert and record one pass in the approved mission call.",
      title: "Mission pass recorded task",
      confirmed: true,
      executionContract: inlineContract,
      resultStatus: "completed",
      resultSummary: "The host pass already produced evidence.",
      evidenceLinks: [".dove/runtime/results.json"],
      artifactRefs: [".dove/runtime/results.json"],
      verificationEvidencePaths: [MCP_VERIFICATION_PATH],
      verifiedCriteria: mcpVerifiedCriteria("Inline pass recorded criterion")
    }));
    assert.equal(passRecorded.status, "pass-recorded");
    assert.equal(passRecorded.missionPassRequired, false);
    assert.equal(passRecorded.task.status, "completed");
    assert.equal(passRecorded.result.packetId, "mission-pass-recorded-task");
    assert.equal(passRecorded.resultCard.presentation, "compact-result-summary-card");
    assert.equal(passRecorded.resultCard.packetId, passRecorded.missionPass.resultCard.packetId);
    assertPreActionGuidanceSummary(passRecorded.preActionGuidanceSummary, { surface: "dove.mission" });
    assertPreActionGuidanceSummary(passRecorded.resultCard.preActionGuidanceSummary, { surface: "dove.mission" });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("record_dove_mission_pass rejects completion without criteria coverage", () => {
  const root = createTempRoot("dove-mcp-mission-criteria-gate-");
  try {
    extractToolJson(dispatchToolFull(root, "init_dove_goal", {
      id: "mission-criteria-init",
      goal: "Validate mission criteria completion gate."
    }));
    const created = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "mission-criteria-task",
      goal: "Require verified criteria before completion.",
      title: "Mission criteria task",
      checklist: false,
      confirmed: true,
      executionContract: mcpExecutionContract()
    }));

    const rejected = extractToolJson(dispatchToolFull(root, "record_dove_mission_pass", {
      packetId: created.createdTask.id,
      runId: "mission-criteria-pass",
      resultStatus: "completed",
      resultSummary: "This completion has evidence but does not cover the contract criteria.",
      artifactRefs: [".dove/task-packets/index.json"],
      verificationEvidencePaths: [MCP_VERIFICATION_PATH]
    }));
    assert.equal(rejected.status, "verification-failed");
    assert.equal(rejected.noAutoApply, true);
    assert.ok(rejected.requiredActions.includes("provide-verified-criteria"));

    const index = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "index.json"), "utf8"));
    assert.equal(index.items.find((item) => item.id === "mission-criteria-task").status, "ready");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("create_dove_task can propose first-run init and mission together", () => {
  const root = createTempRoot("dove-mcp-first-run-mission-");
  try {
    const proposal = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "first-run-mission-task",
      goal: "Start Dove from a real demand without a prior init command.",
      title: "First-run mission task",
      initTitle: "First-run Dove workspace",
      initObjective: "Validate inline init creation before task materialization.",
      checklist: false
    }));
    assert.equal(proposal.status, "needs-confirmation");
    assert.equal(proposal.initMaterializationRequired, true);
    assert.equal(proposal.proposedInit.id, "init");
    assert.equal(proposal.proposedInit.level, 0);
    assert.equal(proposal.proposedInit.title, "First-run Dove workspace");
    assert.equal(proposal.proposedTask.parentId, proposal.proposedInit.id);
    assert.equal(proposal.proposedTask.rootId, proposal.proposedInit.id);
    assert.equal(proposal.confirmArgs.initTitle, "First-run Dove workspace");
    assert.equal(proposal.confirmArgs.initObjective, "Validate inline init creation before task materialization.");

    const previewIndex = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "index.json"), "utf8"));
    assert.deepEqual(previewIndex.items, []);

    const created = extractToolJson(dispatchToolFull(root, "create_dove_task", proposal.confirmArgs));
    assert.equal(created.status, "created-awaiting-host-pass");
    assert.equal(created.initMaterializationRequired, true);
    assert.equal(created.createdInit.id, "init");
    assert.equal(created.createdTask.id, "first-run-mission-task");
    assert.equal(created.createdTask.parentId, "init");
    assert.equal(created.createdTask.rootId, "init");

    const materializedIndex = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "index.json"), "utf8"));
    assert.deepEqual(materializedIndex.items.map((item) => item.id), ["init", "first-run-mission-task"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("completed plan mission pass materializes pending executable missions", () => {
  const root = createTempRoot("dove-mcp-plan-conversion-");
  try {
    const init = extractToolJson(dispatchToolFull(root, "init_dove_goal", {
      id: "plan-conversion-init",
      goal: "Validate plan conversion."
    }));
    const planContract = mcpExecutionContract({
      chainType: "plan-to-executable-missions",
      roleSequence: ["planner", "builder", "reviewer"],
      action: "record_dove_mission_pass",
      implementation: ["Return explicit executable child missions."],
      convergence: {
        criteria: ["Plan conversion emits executable missions"],
        evidenceRequired: [MCP_VERIFICATION_PATH],
        definitionOfDone: "The planning pass returns child missions with executable contracts."
      },
      failureRoutes: [
        { on: "plan-output-not-executable", boundaryType: "plan-output-not-executable", nextAction: "record_dove_mission_pass", requiredActions: ["provide-executable-child-missions"] }
      ]
    });
    const created = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "plan-conversion-task",
      goal: "Plan improvements for Dove status and operator workflows.",
      title: "Plan Dove workflow improvements",
      stage: "plan",
      domain: "engineering",
      checklist: false,
      confirmed: true,
      executionContract: planContract
    }));
    assert.equal(created.createdTask.stage, "plan");

    const topContract = mcpExecutionContract({
      action: "project:dove.auto",
      implementation: ["Implement the planned Dove workflow improvements."],
      convergence: { criteria: ["Top mission implementation verified"] }
    });
    const childContract = mcpExecutionContract({
      chainType: "plan-to-executable-missions",
      roleSequence: ["planner", "builder", "reviewer"],
      action: "record_dove_mission_pass",
      implementation: ["Plan and wire Dove status UX improvements."],
      convergence: { criteria: ["Child mission plan verified"] },
      failureRoutes: [{ on: "plan-output-not-executable", boundaryType: "plan-output-not-executable", nextAction: "record_dove_mission_pass", requiredActions: ["provide-executable-child-missions"] }]
    });
    const pass = extractToolJson(dispatchToolFull(root, "record_dove_mission_pass", {
      packetId: created.createdTask.id,
      runId: "plan-conversion-pass",
      resultStatus: "completed",
      resultSummary: "The plan produced executable follow-up missions.",
      verificationEvidencePaths: [MCP_VERIFICATION_PATH],
      verifiedCriteria: mcpVerifiedCriteria("Plan conversion emits executable missions"),
      plannedMissions: [{
        id: "plan-converted-top",
        title: "Optimize Dove workflow",
        summary: "Implement the planned Dove workflow improvements.",
        executionContract: topContract,
        childMissions: [{
          id: "plan-converted-child",
          title: "Wire Dove status UX",
          summary: "Plan and wire Dove status UX improvements.",
          stage: "plan",
          level: 4,
          executionContract: childContract
        }]
      }]
    }));
    assert.equal(pass.status, "completed");
    assert.equal(pass.createdPlanMissions.length, 2);
    const top = pass.createdPlanMissions.find((mission) => mission.id === "plan-converted-top");
    const child = pass.createdPlanMissions.find((mission) => mission.id === "plan-converted-child");
    assert.equal(top.level, 3);
    assert.equal(top.stage, "execute");
    assert.equal(top.status, "pending");
    assert.equal(top.parentId, init.init.id);
    assert.equal(child.level, 4);
    assert.equal(child.stage, "plan");
    assert.equal(child.status, "pending");
    assert.equal(child.parentId, top.id);
    const planIndex = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "index.json"), "utf8"));
    const persistedTop = planIndex.items.find((item) => item.id === "plan-converted-top");
    const persistedChild = planIndex.items.find((item) => item.id === "plan-converted-child");
    assert.deepEqual(persistedTop.executionContract.convergence.criteria, ["Top mission implementation verified"]);
    assert.deepEqual(persistedChild.executionContract.convergence.criteria, ["Child mission plan verified"]);

    const repeated = extractToolJson(dispatchToolFull(root, "record_dove_mission_pass", {
      packetId: created.createdTask.id,
      runId: "plan-conversion-pass-repeat",
      resultStatus: "completed",
      resultSummary: "The plan conversion was replayed with the same executable mission contracts.",
      verificationEvidencePaths: [MCP_VERIFICATION_PATH],
      verifiedCriteria: mcpVerifiedCriteria("Plan conversion emits executable missions"),
      plannedMissions: [{
        id: "plan-converted-top",
        title: "Optimize Dove workflow",
        summary: "Implement the planned Dove workflow improvements.",
        executionContract: topContract,
        childMissions: [{
          id: "plan-converted-child",
          title: "Wire Dove status UX",
          summary: "Plan and wire Dove status UX improvements.",
          stage: "plan",
          level: 4,
          executionContract: childContract
        }]
      }]
    }));
    assert.deepEqual(repeated.createdPlanMissions, []);
    assert.equal(repeated.reusedPlanMissions.length, 2);

    const index = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "index.json"), "utf8"));
    assert.equal(index.items.find((item) => item.id === "plan-converted-top").status, "pending");
    assert.equal(index.items.find((item) => item.id === "plan-converted-child").parentId, "plan-converted-top");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("status adjustment contract applies confirmed non-terminal mission status choices and archives cleanup", () => {
  const root = createTempRoot("dove-mcp-status-adjust-");
  try {
    const init = extractToolJson(dispatchToolFull(root, "init_dove_goal", {
      id: "status-adjust-init",
      goal: "Validate status adjustment UX."
    }));
    for (const task of [
      { id: "status-ready-task", title: "Status ready task", status: "ready" },
      { id: "status-progress-task", title: "Status progress task", status: "in-progress" },
      { id: "status-blocked-task", title: "Status blocked task", status: "blocked" },
      { id: "status-completed-task", title: "Status completed task", status: "completed" },
      { id: "status-killed-task", title: "Status killed task", status: "killed" }
    ]) {
      extractToolJson(dispatchToolFull(root, "create_dove_task", {
        ...task,
        goal: task.title,
        checklist: false,
        confirmed: true
      }));
    }

    const status = extractToolJson(dispatchToolFull(root, "query_dove_status", {}));
    const adjustmentStatus = extractToolJson(dispatchToolFull(root, "query_dove_status", { requestStatusAdjustment: true }));
    const fullStatus = extractToolJson(dispatchToolFull(root, "query_dove_status", { detail: "full" }));
    assert.equal(status.detail, "compact");
    assert.equal(status.dashboard, undefined);
    assert.equal(status.dailyHome, undefined);
    assert.equal("projectSummary" in status, false);
    assert.equal("statusAdjustmentContract" in status, false);
    assert.equal(fullStatus.detail, "full");
    assert.ok(fullStatus.dashboard);
    assert.equal(status.statusHome.presentation, "dove-project-situation-home");
    assert.ok(status.statusHome.nextSteps.ranked.length <= 3);
    assert.ok(status.statusHome.nextSteps.ranked.every((card) => card.kind && card.title));
    assert.ok(status.statusHome.nextSteps.ranked.every((card) => card.kind === "recover-current-work" || card.command));
    assert.equal(status.current.nextCommand, status.statusHome.nextSteps.primary.command ?? status.suggestedNextCommand);
    assert.equal(fullStatus.dashboard.nextAction, fullStatus.dailyHome.nextActions[0].command ?? fullStatus.suggestedNextCommand);
    assert.equal(fullStatus.statusAdjustmentContract.mutationTool, "apply_dove_status_adjustments");
    assert.deepEqual(fullStatus.statusAdjustmentContract.statusChoices, ["pending", "ready", "in-progress", "blocked", "completed", "killed", "archived"]);
    assert.equal(fullStatus.statusAdjustmentContract.items.length, 3);
    assert.equal(fullStatus.statusAdjustmentContract.adjustmentCards.length, fullStatus.statusAdjustmentContract.items.length);
    assert.ok(fullStatus.statusAdjustmentContract.adjustmentCards.every((card) => card.presentation === "compact-status-adjustment-card"));
    const adjustmentPreview = adjustmentStatus.statusHome.statusAdjustmentPreview;
    assert.equal(adjustmentStatus.statusHome.expansion.statusAdjustments.args.requestStatusAdjustment, true);
    assert.equal(adjustmentPreview.statusAdjustmentItemsIncluded, true);
    assert.equal(adjustmentPreview.adjustmentCards.length, adjustmentPreview.items.length);
    assert.ok(adjustmentPreview.adjustmentCards.every((card) => card.presentation === "compact-status-adjustment-card"));
    const itemIds = adjustmentPreview.items.map((candidate) => candidate.packetId);
    assert.equal(itemIds.includes(init.init.id), false);
    assert.equal(itemIds.includes("status-ready-task"), true);
    assert.equal(itemIds.includes("status-progress-task"), true);
    assert.equal(itemIds.includes("status-blocked-task"), true);
    assert.equal(itemIds.includes("status-completed-task"), false);
    assert.equal(itemIds.includes("status-killed-task"), false);
    assert.equal(adjustmentPreview.items.some((candidate) => ["completed", "killed"].includes(candidate.currentStatus)), false);
    const item = adjustmentPreview.items.find((candidate) => candidate.packetId === "status-ready-task");
    assert.ok(item);
    assert.deepEqual(item.choices, ["pending", "ready", "in-progress", "blocked", "completed", "killed", "archived"]);

    const preview = extractToolJson(dispatchToolFull(root, "apply_dove_status_adjustments", {
      adjustments: [{ packetId: "status-ready-task", status: "blocked", reason: "Needs investigation." }]
    }));
    assert.equal(preview.status, "needs-confirmation");
    assert.equal(preview.proposalOnly, true);
    assert.deepEqual(preview.writes, []);
    assert.equal(preview.adjustmentCards.length, 1);
    assert.equal(preview.adjustmentCards[0].presentation, "compact-status-adjustment-card");
    assert.equal(preview.adjustmentCards[0].packetId, "status-ready-task");
    assert.equal(preview.adjustmentCards[0].proposalOnly, true);
    assert.equal(preview.confirmArgs.confirmed, true);
    const previewIndex = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "index.json"), "utf8"));
    assert.equal(previewIndex.items.find((candidate) => candidate.id === "status-ready-task").status, "ready");

    const applied = extractToolJson(dispatchToolFull(root, "apply_dove_status_adjustments", preview.confirmArgs));
    assert.equal(applied.status, "applied");
    assert.deepEqual(applied.rejected, []);
    assert.equal(applied.applied[0].fromStatus, "ready");
    assert.equal(applied.applied[0].toStatus, "blocked");
    assert.equal(applied.resultCard.presentation, "compact-result-summary-card");
    assert.equal(applied.resultCard.surface, "dove.status");
    assert.equal(applied.resultCard.proposalOnly, false);
    const postApplyStatus = extractToolJson(dispatchToolFull(root, "query_dove_status", { requestStatusAdjustment: true }));
    const blockedAdjustedItem = postApplyStatus.statusHome.statusAdjustmentPreview.items.find((candidate) => candidate.packetId === "status-ready-task");
    assert.ok(blockedAdjustedItem);
    assert.equal(blockedAdjustedItem.currentStatus, "blocked");

    const archivedApplied = extractToolJson(dispatchToolFull(root, "apply_dove_status_adjustments", {
      confirmed: true,
      runId: "status-archive-run",
      adjustments: [{ packetId: "status-progress-task", status: "archived", reason: "Retired status adjustment dogfood." }]
    }));
    assert.equal(archivedApplied.status, "applied");
    assert.deepEqual(archivedApplied.rejected, []);
    assert.equal(archivedApplied.applied[0].fromStatus, "in-progress");
    assert.equal(archivedApplied.applied[0].toStatus, "archived");
    assert.equal(archivedApplied.executionReceipts[0].packetId, "status-progress-task");
    assert.equal(archivedApplied.executionReceipts[0].actionType, "cleanup");
    assert.equal(archivedApplied.executionReceipts[0].lifecycleTransition.previousStatus, "in-progress");
    assert.equal(archivedApplied.executionReceipts[0].lifecycleTransition.nextStatus, "archived");
    assert.equal(archivedApplied.resultCard.executionReceipt.actionType, "cleanup");

    const archivedPacket = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "packets", "status-progress-task.json"), "utf8"));
    assert.equal(archivedPacket.status, "archived");
    assert.equal(archivedPacket.lifecycleStatus, "archived");
    assert.equal(archivedPacket.archiveReason, "Retired status adjustment dogfood.");
    assert.ok(archivedPacket.archivedAt);
    const archivedIndex = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "index.json"), "utf8"));
    assert.equal(archivedIndex.taskModel.activeTaskIds.includes("status-progress-task"), false);
    assert.equal(archivedIndex.items.find((candidate) => candidate.id === "status-progress-task").status, "archived");
    const archiveRuntimeResults = JSON.parse(fs.readFileSync(path.join(root, ".dove", "runtime", "results.json"), "utf8"));
    const archiveRun = archiveRuntimeResults.entries.find((entry) => entry.id === "status-archive-run");
    assert.ok(archiveRun);
    assert.equal(archiveRun.iterations[0].packetId, "status-progress-task");
    assert.equal(archiveRun.iterations[0].executionReceipt.actionType, "cleanup");

    const postArchiveDefault = extractToolJson(dispatchToolFull(root, "query_dove_status", { detail: "full", requestStatusAdjustment: true }));
    assert.equal(postArchiveDefault.dashboard.tasks.counts.archived, 0);
    assert.equal(postArchiveDefault.dashboard.tasks.counts.archivedHidden, 1);
    assert.equal(postArchiveDefault.statusAdjustmentContract.items.some((candidate) => candidate.packetId === "status-progress-task"), false);
    const postArchiveIncluded = extractToolJson(dispatchToolFull(root, "query_dove_status", { detail: "full", includeArchived: true, requestStatusAdjustment: true }));
    assert.equal(postArchiveIncluded.dashboard.tasks.counts.archived, 1);
    assert.equal(postArchiveIncluded.dashboard.tasks.counts.archivedHidden, 0);
    assert.equal(postArchiveIncluded.dashboard.tasks.tree[0].children.some((task) => task.id === "status-progress-task" && task.status === "archived"), true);
    assert.equal(postArchiveIncluded.statusAdjustmentContract.items.some((candidate) => candidate.packetId === "status-progress-task"), false);

    const rejected = extractToolJson(dispatchToolFull(root, "apply_dove_status_adjustments", {
      confirmed: true,
      adjustments: [{ packetId: init.init.id, status: "killed" }]
    }));
    assert.equal(rejected.status, "rejected");
    assert.match(rejected.rejected[0].reason, /level-0 init (?:task|任务)/);

    const noOp = extractToolJson(dispatchToolFull(root, "apply_dove_status_adjustments", {
      confirmed: true,
      adjustments: []
    }));
    assert.equal(noOp.status, "no-op");
    assert.deepEqual(noOp.applied, []);
    assert.deepEqual(noOp.skipped, []);
    assert.deepEqual(noOp.rejected, []);
    assert.deepEqual(noOp.statusChoices, ["pending", "ready", "in-progress", "blocked", "completed", "killed", "archived"]);
    assert.equal(noOp.resultCard.presentation, "compact-result-summary-card");
    assert.equal(noOp.resultCard.status, "no-op");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("apply_dove_status_adjustments records execution receipts for verified completion", () => {
  const root = createTempRoot("dove-mcp-status-receipt-");
  try {
    dispatchTool(root, "init_dove_goal", {
      id: "status-receipt-init",
      goal: "Validate status adjustment execution receipts."
    });
    extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "status-receipt-task",
      title: "Status receipt task",
      goal: "Complete through status adjustment only when verification evidence is attached.",
      status: "ready",
      executionContract: mcpExecutionContract(),
      confirmed: true,
      checklist: false
    }));

    const rejected = extractToolJson(dispatchToolFull(root, "apply_dove_status_adjustments", {
      confirmed: true,
      runId: "status-receipt-run-rejected",
      adjustments: [{
        packetId: "status-receipt-task",
        status: "completed",
        reason: "Summary without verification evidence."
      }]
    }));
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.rejected[0].completionBlock.status, "needs-completion-evidence");

    const applied = extractToolJson(dispatchToolFull(root, "apply_dove_status_adjustments", {
      confirmed: true,
      runId: "status-receipt-run",
      adjustments: [{
        packetId: "status-receipt-task",
        status: "completed",
        reason: "Verified status adjustment completion.",
        artifactRefs: [".dove/drafts/status-receipt.md"],
        verificationEvidencePaths: [MCP_VERIFICATION_PATH],
        verifiedCriteria: mcpVerifiedCriteria(),
        executionReceipt: {
          receiptId: "status-adjustment-explicit-receipt",
          actionType: "verify",
          artifactRefs: [".dove/drafts/status-receipt.md"],
          verificationEvidencePaths: [MCP_VERIFICATION_PATH],
          verifiedCriteria: mcpVerifiedCriteria(),
          criteriaCoverage: {
            complete: true,
            required: [MCP_EXECUTION_CRITERION],
            missing: [],
            verified: mcpVerifiedCriteria()
          }
        }
      }]
    }));
    assert.equal(applied.status, "applied");
    assert.equal(applied.applied[0].toStatus, "completed");
    assert.equal(applied.executionReceipts[0].receiptId, "status-adjustment-explicit-receipt");
    assert.equal(applied.executionReceipts[0].packetId, "status-receipt-task");
    assert.equal(applied.resultCard.executionReceipt.receiptId, "status-adjustment-explicit-receipt");
    assert.equal(applied.resultCard.executionReceipt.criteriaCoverage.complete, true);

    const runtimeResults = JSON.parse(fs.readFileSync(path.join(root, ".dove", "runtime", "results.json"), "utf8"));
    const persisted = runtimeResults.entries.find((item) => item.id === "status-receipt-run");
    assert.ok(persisted, "status adjustment runtime result should be persisted");
    assert.equal(persisted.iterations[0].packetId, "status-receipt-task");
    assert.equal(persisted.iterations[0].executionReceipt.receiptId, "status-adjustment-explicit-receipt");

    const status = extractToolJson(dispatchToolFull(root, "query_dove_status", { detail: "full" }));
    assert.equal(status.dailyHome.recentExecutionReceipts[0].packetId, "status-receipt-task");
    assert.equal(status.dailyHome.recentExecutionReceipts[0].receiptId, "status-adjustment-explicit-receipt");
    assert.equal(status.dailyHome.recentExecutionReceipts[0].criteriaCoverage.complete, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("run_dove_operator leaves host-pass-only queues unchanged without taskResults", () => {
  const root = createTempRoot("dove-mcp-operator-host-only-");
  try {
    dispatchTool(root, "init_dove_goal", {
      id: "operator-host-only-init",
      goal: "Validate host-pass-only operator no-op semantics."
    });
    extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "operator-host-only-source",
      title: "Operator host-only source task",
      goal: "Collect source provenance through host tools.",
      status: "ready",
      nextAction: "project:dove.source",
      domain: "paper",
      checklist: false,
      confirmed: true
    }));

    const preview = extractToolJson(dispatchToolFull(root, "run_dove_operator", {}));
    assert.equal(preview.status, "needs-confirmation");
    assert.deepEqual(preview.queueSummary.autoRunnableTaskIds, []);
    assert.deepEqual(preview.queueSummary.hostPassRequiredTaskIds, ["operator-host-only-source"]);
    assert.equal(preview.autoRunnableTasks, undefined);
    assert.equal(preview.hostPassRequiredTasks, undefined);
    assert.equal(preview.queueCards, undefined);
    assert.deepEqual(preview.queuePreview.hostPassRequired.map((card) => card.packetId), ["operator-host-only-source"]);

    const run = extractToolJson(dispatchToolFull(root, "run_dove_operator", {
      confirmed: true,
      runId: "operator-host-only-run"
    }));

    assert.equal(run.status, "needs-host-results");
    assert.deepEqual(run.updatedTaskIds, []);
    assert.equal(run.updatedTasks, undefined);
    assert.deepEqual(run.awaitingResultTaskIds, ["operator-host-only-source"]);
    assert.deepEqual(run.operatorResultSummary.skippedHostPassTaskIds, ["operator-host-only-source"]);
    assert.equal(run.operatorResultSummary.runtimeRecorded, false);
    assert.equal(run.resultCard.status, "needs-host-results");
    assert.deepEqual(run.resultCard.packetIds, []);
    assert.equal(run.resultCard.durableWrites.length, 1);
    assert.ok(run.awaitingRequiredActions.includes("collect-source-provenance"));
    assert.ok(run.awaitingRequiredActions.includes("call-register-source-with-sources-array"));

    const taskIndex = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "index.json"), "utf8"));
    const task = taskIndex.items.find((item) => item.id === "operator-host-only-source");
    assert.equal(task.status, "ready");
    assert.equal(task.boundary, null);
    const runtimeResults = JSON.parse(fs.readFileSync(path.join(root, ".dove", "runtime", "results.json"), "utf8"));
    assert.equal(runtimeResults.entries.some((item) => item.id === "operator-host-only-run"), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("run_dove_operator previews blocker investigations and only creates them when explicit", () => {
  const root = createTempRoot("dove-mcp-operator-");
  try {
    dispatchTool(root, "init_dove_goal", {
      id: "operator-init",
      goal: "Validate operator queue semantics."
    });
    for (const task of [
      { id: "operator-auto-ready", title: "Operator auto-ready lessons task", status: "ready", nextAction: "project:dove.lessons" },
      { id: "operator-host-progress", title: "Operator host progress task", status: "in-progress", executionContract: mcpExecutionContract({ convergence: { criteria: ["Operator host progress criterion"] } }) },
      { id: "operator-host-missing", title: "Operator host missing task", status: "ready" },
      { id: "operator-source-host-pass", title: "Operator source task needs provenance", status: "ready", nextAction: "project:dove.source" },
      { id: "operator-note-host-pass", title: "Operator note task needs synthesis", status: "ready", nextAction: "project:dove.note" },
      { id: "operator-draft-host-pass", title: "Operator draft task needs body", status: "ready", nextAction: "project:dove.draft" },
      { id: "operator-experience-host-pass", title: "Operator experience task needs objective", status: "ready", nextAction: "project:dove.experience" },
      { id: "operator-unresolved", title: "Operator unresolved dependency task", status: "ready", dependencies: ["missing-dependency"] },
      { id: "operator-blocked", title: "Operator blocked task", status: "blocked" },
      { id: "operator-pending", title: "Operator pending task", status: "pending" }
    ]) {
      extractToolJson(dispatchToolFull(root, "create_dove_task", {
        ...task,
        goal: task.title,
        domain: "engineering",
        checklist: false,
        confirmed: true
      }));
    }

    const preview = extractToolJson(dispatchToolFull(root, "run_dove_operator", {}));
    const hostPassRequiredIds = ["operator-draft-host-pass", "operator-experience-host-pass", "operator-host-missing", "operator-host-progress", "operator-note-host-pass", "operator-source-host-pass"];
    assert.equal(preview.status, "needs-confirmation");
    assert.equal(preview.proposalOnly, true);
    assert.deepEqual(preview.writes, []);
    assert.deepEqual(preview.queueSummary.autoRunnableTaskIds, ["operator-auto-ready"]);
    assert.deepEqual(preview.queueSummary.hostPassRequiredTaskIds.sort(), hostPassRequiredIds.sort());
    assert.deepEqual(preview.queueSummary.runnableTaskIds.sort(), ["operator-auto-ready", ...hostPassRequiredIds].sort());
    assert.deepEqual(preview.queueSummary.blockedTaskIds.sort(), ["operator-blocked", "operator-unresolved"].sort());
    assert.deepEqual(preview.queueSummary.pendingTaskIds, ["operator-pending"]);
    assert.equal(preview.blockerInvestigationMode, "propose");
    assert.equal(preview.blockerPlanConversion.proposalOnly, true);
    assert.deepEqual(preview.blockerPlanConversion.proposedBlockedTaskIds.sort(), ["operator-blocked", "operator-unresolved"].sort());
    assert.equal(preview.blockerPlanConversion.createdCount, 0);
    assert.equal(preview.autoRunnableTasks, undefined);
    assert.equal(preview.hostPassRequiredTasks, undefined);
    assert.equal(preview.queueCards, undefined);
    assert.deepEqual(preview.queuePreview.autoRunnable.map((card) => card.packetId), ["operator-auto-ready"]);
    assert.equal(preview.queuePreview.hostPassRequired.length, 2);
    assertFullPreActionGuidance(preview.preActionGuidance, { surface: "dove.operator", primaryRole: "planner" });

    const detailedPreview = extractToolJson(dispatchToolFull(root, "run_dove_operator", { includeQueueDetails: true }));
    assert.deepEqual(detailedPreview.autoRunnableTasks.map((task) => task.id), ["operator-auto-ready"]);
    assert.deepEqual(detailedPreview.hostPassRequiredTasks.map((task) => task.id).sort(), hostPassRequiredIds.sort());
    assert.equal(detailedPreview.hostPassRequiredTasks.find((task) => task.id === "operator-source-host-pass").whyThisStep, "source-requires-host-provenance");
    assert.equal(detailedPreview.hostPassRequiredTasks.find((task) => task.id === "operator-note-host-pass").whyThisStep, "note-requires-host-synthesis");
    assert.equal(detailedPreview.hostPassRequiredTasks.find((task) => task.id === "operator-draft-host-pass").whyThisStep, "draft-requires-host-content");
    assert.equal(detailedPreview.hostPassRequiredTasks.find((task) => task.id === "operator-experience-host-pass").whyThisStep, "experience-requires-host-objective");
    assert.deepEqual(detailedPreview.queueCards.autoRunnable.map((card) => card.packetId), ["operator-auto-ready"]);
    assert.deepEqual(detailedPreview.queueCards.hostPassRequired.map((card) => card.packetId).sort(), hostPassRequiredIds.sort());
    assertFullPreActionGuidance(detailedPreview.queueCards.autoRunnable[0].preActionGuidance, { surface: "dove.operator", primaryRole: "planner" });
    assert.equal(detailedPreview.queueCards.blocked.every((card) => card.presentation === "compact-operator-queue-card" && card.proposalOnly === true), true);
    assertFullPreActionGuidance(detailedPreview.queueCards.blocked[0].preActionGuidance, { surface: "dove.operator", primaryRole: "planner" });
    assert.equal(detailedPreview.blockedTasks.find((task) => task.id === "operator-unresolved").unresolvedDependencyIds[0], "missing-dependency");

    const run = extractToolJson(dispatchToolFull(root, "run_dove_operator", {
      confirmed: true,
      runId: "operator-run",
      taskResults: [
        {
          packetId: "operator-host-progress",
          resultStatus: "completed",
          summary: "Host progress task completed.",
          verificationEvidencePaths: [MCP_VERIFICATION_PATH],
          verifiedCriteria: mcpVerifiedCriteria("Operator host progress criterion")
        }
      ]
    }));
    const awaitingHostIds = hostPassRequiredIds.filter((id) => id !== "operator-host-progress");
    assert.equal(run.status, "awaiting-host-results");
    assert.deepEqual([...run.awaitingResultTaskIds].sort(), [...awaitingHostIds].sort());
    assert.deepEqual(run.updatedTaskIds.sort(), ["operator-auto-ready", "operator-host-progress"].sort());
    assert.equal(run.updatedTasks, undefined);
    assert.equal(run.result, undefined);
    assert.deepEqual(run.operatorResultSummary.autoRunnableTaskIds, ["operator-auto-ready"]);
    assert.deepEqual(run.operatorResultSummary.hostPassRequiredTaskIds.sort(), hostPassRequiredIds.sort());
    assert.deepEqual(run.operatorResultSummary.skippedHostPassTaskIds.sort(), awaitingHostIds.sort());
    assert.equal(run.resultCard.presentation, "compact-result-summary-card");
    assert.equal(run.resultCard.surface, "dove.operator");
    assertPreActionGuidanceSummary(run.preActionGuidanceSummary, { surface: "dove.operator", primaryRole: "planner" });
    assertPreActionGuidanceSummary(run.resultCard.preActionGuidanceSummary, { surface: "dove.operator", primaryRole: "planner" });
    assert.equal(run.resultCard.requiresAction, true);
    assert.equal(run.resultCard.nextActions[0].handoffSuggestion.boundaryType, "awaiting-host-pass-result");
    assert.equal(run.resultCard.nextActions[0].handoffSuggestion.ownerRole, "builder");
    assert.deepEqual([...run.resultCard.nextActions[0].requires].sort(), [...awaitingHostIds].sort());
    for (const requiredAction of [
      "provide-host-pass-result",
      "collect-source-provenance",
      "call-register-source-with-sources-array",
      "synthesize-note-content",
      "call-upsert-note-with-summary-or-claims",
      "write-draft-body",
      "call-upsert-draft-with-body",
      "define-experience-objective",
      "call-run-experience-workflow-with-goal-or-experimentId",
      "provide-explicit-auto-step"
    ]) {
      assert.ok(run.resultCard.nextActions[0].requiredActions.includes(requiredAction), `${requiredAction} should be surfaced`);
    }
    assert.equal(run.blockerInvestigationMode, "propose");
    assert.equal(run.blockerPlanConversion.mode, "propose");
    assert.equal(run.blockerPlanConversion.proposalOnly, true);
    assert.deepEqual(run.blockerPlanConversion.proposedBlockedTaskIds.sort(), ["operator-blocked", "operator-unresolved"].sort());
    assert.equal(run.blockerPlanConversion.missionCount, 0);
    assert.equal(run.blockerPlanConversion.createdCount, 0);
    assert.equal(run.blockerPlanConversion.reusedCount, 0);
    assert.deepEqual(run.blockerPlanConversion.createdMissionIds, []);
    assert.deepEqual(run.blockerPlanConversion.reusedMissionIds, []);
    assert.equal(run.blockerPlanConversion.taskIndexPath, ".dove/task-packets/index.json");

    const runtimeResults = JSON.parse(fs.readFileSync(path.join(root, ".dove", "runtime", "results.json"), "utf8"));
    const persisted = runtimeResults.entries.find((item) => item.id === "operator-run");
    assert.equal(persisted.surface, "dove.operator");
    assert.equal(persisted.foreground, true);
    assert.equal(persisted.status, "awaiting-host-results");
    assert.equal(persisted.resultCard, undefined);
    const taskIndex = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "index.json"), "utf8"));
    assert.equal(taskIndex.items.some((item) => item.derivedFrom === "blocked-mission-investigation"), false);
    const missingTask = taskIndex.items.find((item) => item.id === "operator-host-missing");
    assert.equal(missingTask.status, "ready");
    assert.equal(missingTask.boundary, null);
    for (const id of awaitingHostIds) {
      const awaitingTask = taskIndex.items.find((item) => item.id === id);
      assert.equal(awaitingTask.status, "ready");
      assert.equal(awaitingTask.boundary, null);
    }
    assert.ok(run.awaitingRequiredActions.includes("collect-source-provenance"));
    assert.ok(run.awaitingRequiredActions.includes("call-register-source-with-sources-array"));
    assert.ok(run.awaitingRequiredActions.includes("synthesize-note-content"));
    assert.ok(run.awaitingRequiredActions.includes("call-upsert-note-with-summary-or-claims"));
    assert.ok(run.awaitingRequiredActions.includes("write-draft-body"));
    assert.ok(run.awaitingRequiredActions.includes("call-upsert-draft-with-body"));
    assert.ok(run.awaitingRequiredActions.includes("define-experience-objective"));
    assert.ok(run.awaitingRequiredActions.includes("call-run-experience-workflow-with-goal-or-experimentId"));
    const runtimeEvents = JSON.parse(fs.readFileSync(path.join(root, ".dove", "runtime", "events.json"), "utf8"));
    assert.equal(runtimeEvents.entries.some((entry) => entry.type === "task.boundary.opened" && entry.packetId === "operator-host-missing"), false);
    assert.equal(runtimeEvents.entries.some((entry) => entry.type === "task.lifecycle.transitioned" && entry.packetId === "operator-host-progress" && entry.toStatus === "completed"), true);

    const createRun = extractToolJson(dispatchToolFull(root, "run_dove_operator", {
      confirmed: true,
      runId: "operator-create-blockers-run",
      blockerInvestigationMode: "create"
    }));
    assert.equal(createRun.blockerInvestigationMode, "create");
    assert.equal(createRun.blockerPlanConversion.mode, "create");
    assert.equal(createRun.blockerPlanConversion.proposalOnly, false);
    assert.equal(createRun.blockerPlanConversion.createdCount, 2);
    assert.equal(createRun.blockerPlanConversion.reusedCount, 0);
    assert.equal(createRun.blockerPlanConversion.missionCount, 2);
    assert.equal(createRun.blockerPlanConversion.createdMissionIds.length, 2);
    assert.deepEqual(createRun.blockerPlanConversion.reusedMissionIds, []);
    const createTaskIndex = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "index.json"), "utf8"));
    const createdBlockerPlans = createRun.blockerPlanConversion.createdMissionIds.map((id) => createTaskIndex.items.find((item) => item.id === id));
    assert.equal(createdBlockerPlans.every(Boolean), true);
    const blockerPlan = createdBlockerPlans.find((mission) => mission.parentId === "operator-blocked");
    assert.equal(blockerPlan.status, "pending");
    assert.equal(blockerPlan.stage, "plan");
    assert.equal(blockerPlan.level, 4);
    const unresolvedPlan = createdBlockerPlans.find((mission) => mission.parentId === "operator-unresolved");
    assert.equal(unresolvedPlan.status, "pending");
    assert.equal(unresolvedPlan.stage, "plan");
    assert.equal(unresolvedPlan.level, 4);

    const reuseRun = extractToolJson(dispatchToolFull(root, "run_dove_operator", {
      confirmed: true,
      runId: "operator-reuse-blockers-run",
      createBlockedInvestigations: true
    }));
    assert.equal(reuseRun.blockerInvestigationMode, "create");
    assert.equal(reuseRun.blockerPlanConversion.createdCount, 0);
    assert.equal(reuseRun.blockerPlanConversion.reusedCount, 2);
    assert.equal(reuseRun.blockerPlanConversion.missionCount, 0);
    assert.deepEqual(reuseRun.blockerPlanConversion.createdMissionIds, []);
    assert.equal(reuseRun.blockerPlanConversion.reusedMissionIds.length, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("create_dove_task materializes checklist children below explicit mission levels", () => {
  const root = createTempRoot("dove-mcp-mission-checklist-");
  try {
    const init = extractToolJson(dispatchToolFull(root, "init_dove_goal", {
      id: "mission-checklist-init",
      goal: "Validate mission checklist hierarchy."
    }));
    const proposal = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "mission-checklist-parent",
      goal: "Implement and validate a checklist-backed mission workflow.",
      title: "Mission checklist parent",
      level: 2,
      autoChecklist: true,
      evidenceExpectations: ["implementation", "validation"]
    }));
    assert.equal(proposal.status, "needs-confirmation");
    assert.equal(proposal.proposedTask.level, 2);
    assert.equal(proposal.checklistProposal.autoSelected, true);
    assert.equal(proposal.checklistProposal.itemCount, 3);
    assert.ok(proposal.checklistProposal.items.every((item) => item.parentId === "mission-checklist-parent"));
    assert.ok(proposal.checklistProposal.items.every((item) => item.creatorKind === "system"));
    assert.ok(proposal.checklistProposal.items.every((item) => item.level > proposal.proposedTask.level));
    assert.ok(proposal.checklistProposal.items.every((item) => item.id.startsWith("mission-checklist-parent-checklist-")));

    const proposedIndex = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "index.json"), "utf8"));
    assert.deepEqual(proposedIndex.items.map((item) => item.id), [init.init.id]);

    const created = extractToolJson(dispatchToolFull(root, "create_dove_task", proposal.confirmArgs));
    assert.equal(created.status, "created-awaiting-host-pass");
    assert.equal(created.createdTask.level, 2);
    assert.equal(created.createdChecklistTasks.length, 3);
    for (const child of created.createdChecklistTasks) {
      assert.equal(child.parentId, created.createdTask.id);
      assert.equal(child.rootId, init.init.id);
      assert.equal(child.creatorKind, "system");
      assert.ok(child.level > created.createdTask.level);
      assert.ok(child.id.startsWith(`${created.createdTask.id}-checklist-`));
    }

    const materializedIndex = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "index.json"), "utf8"));
    assert.deepEqual(materializedIndex.items.map((item) => item.id), [
      "mission-checklist-init",
      "mission-checklist-parent",
      ...created.createdChecklistTasks.map((item) => item.id)
    ]);

    const secondCreated = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "mission-checklist-second-parent",
      goal: "Implement and validate another checklist-backed mission workflow.",
      title: "Second mission checklist parent",
      level: 2,
      autoChecklist: true,
      evidenceExpectations: ["implementation", "validation"],
      confirmed: true
    }));
    assert.equal(secondCreated.createdChecklistTasks.length, 3);
    const firstChildIds = new Set(created.createdChecklistTasks.map((item) => item.id));
    for (const child of secondCreated.createdChecklistTasks) {
      assert.ok(child.id.startsWith(`${secondCreated.createdTask.id}-checklist-`));
      assert.equal(firstChildIds.has(child.id), false);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("record_dove_mission_pass accepts descendant evidence for explicit parent packet", () => {
  const root = createTempRoot("dove-mcp-parent-child-evidence-");
  try {
    dispatchTool(root, "init_dove_goal", {
      id: "parent-child-evidence-init",
      goal: "Validate parent mission pass evidence lineage."
    });
    const created = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "parent-child-evidence-parent",
      goal: "Record parent mission evidence produced by checklist children.",
      title: "Parent child evidence mission",
      autoChecklist: true,
      confirmed: true
    }));
    assert.equal(created.createdChecklistTasks.length, 3);
    const child = created.createdChecklistTasks[0];
    const childArtifact = ".dove/audio/reviews/parent-child-evidence/report.md";

    const childPass = extractToolJson(dispatchToolFull(root, "record_dove_mission_pass", {
      packetId: child.id,
      runId: "parent-child-evidence-child-pass",
      resultStatus: "completed",
      resultSummary: "Checklist child produced explicit review evidence.",
      artifactRefs: [childArtifact],
      evidenceLinks: [childArtifact],
      verificationEvidencePaths: [MCP_VERIFICATION_PATH],
      verifiedCriteria: mcpVerifiedCriteria(mcpTaskCriterion(child))
    }));
    assert.equal(childPass.status, "completed");
    assert.equal(childPass.result.packetId, child.id);

    for (const [index, checklistChild] of created.createdChecklistTasks.slice(1).entries()) {
      const checklistArtifact = `.dove/audio/reviews/parent-child-evidence/checklist-${index + 2}.md`;
      const checklistPass = extractToolJson(dispatchToolFull(root, "record_dove_mission_pass", {
        packetId: checklistChild.id,
        runId: `parent-child-evidence-child-${index + 2}-pass`,
        resultStatus: "completed",
        resultSummary: "Checklist child is done before parent closure.",
        artifactRefs: [checklistArtifact],
        evidenceLinks: [checklistArtifact],
        verificationEvidencePaths: [MCP_VERIFICATION_PATH],
        verifiedCriteria: mcpVerifiedCriteria(mcpTaskCriterion(checklistChild))
      }));
      assert.equal(checklistPass.status, "completed");
    }

    const parentPass = extractToolJson(dispatchToolFull(root, "record_dove_mission_pass", {
      packetId: created.createdTask.id,
      runId: "parent-child-evidence-parent-pass",
      resultStatus: "completed",
      resultSummary: "Parent mission can close with evidence produced by its own checklist child.",
      artifactRefs: [childArtifact],
      evidenceLinks: [childArtifact],
      verificationEvidencePaths: [MCP_VERIFICATION_PATH],
      verifiedCriteria: mcpVerifiedCriteria(mcpTaskCriterion(created.createdTask))
    }));
    assert.equal(parentPass.status, "completed");
    assert.equal(parentPass.result.packetId, created.createdTask.id);
    assert.ok(parentPass.artifactRefs.includes(childArtifact));
    assert.deepEqual(parentPass.evidenceLinks, [childArtifact]);
    assert.equal(parentPass.evidenceExplanation.code, "accepted-descendant-artifacts");
    assert.equal(parentPass.artifactResolution.acceptedMatches[0].packetId, child.id);
    assert.equal(parentPass.artifactResolution.acceptedMatches[0].relation, "descendant");
    assert.equal(parentPass.resultCard.evidenceExplanation.code, "accepted-descendant-artifacts");
    assert.equal(parentPass.resultCard.evidenceSelection.acceptedMatches[0].packetId, child.id);

    const persistedParent = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "packets", `${created.createdTask.id}.json`), "utf8"));
    assert.ok(persistedParent.artifactRefs.includes(childArtifact));
    assert.deepEqual(persistedParent.evidenceLinks, [childArtifact]);

    const siblingArtifact = ".dove/audio/reviews/parent-child-evidence-sibling/report.md";
    const sibling = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "parent-child-evidence-sibling",
      goal: "Produce sibling evidence that should not be accepted by the parent.",
      title: "Parent child evidence sibling",
      checklist: false,
      confirmed: true
    }));
    const siblingPass = extractToolJson(dispatchToolFull(root, "record_dove_mission_pass", {
      packetId: sibling.createdTask.id,
      runId: "parent-child-evidence-sibling-pass",
      resultStatus: "completed",
      resultSummary: "Sibling task produced its own evidence.",
      artifactRefs: [siblingArtifact],
      evidenceLinks: [siblingArtifact],
      verificationEvidencePaths: [MCP_VERIFICATION_PATH],
      verifiedCriteria: mcpVerifiedCriteria(mcpTaskCriterion(sibling.createdTask))
    }));
    assert.equal(siblingPass.status, "completed");

    const rejected = extractToolJson(dispatchToolFull(root, "record_dove_mission_pass", {
      packetId: created.createdTask.id,
      runId: "parent-child-evidence-sibling-conflict",
      resultStatus: "completed",
      resultSummary: "Parent should not accept sibling-owned evidence.",
      artifactRefs: [siblingArtifact],
      evidenceLinks: [siblingArtifact],
      verificationEvidencePaths: [MCP_VERIFICATION_PATH],
      verifiedCriteria: mcpVerifiedCriteria(mcpTaskCriterion(created.createdTask))
    }));
    assert.equal(rejected.status, "needs-task-selection");
    assert.ok(rejected.choices.some((choice) => choice.id === sibling.createdTask.id));
    assert.equal(rejected.resolutionErrorCode, "artifact-conflict");
    assert.equal(rejected.evidenceExplanation.code, "artifact-conflict");
    assert.equal(rejected.artifactResolution.conflictingMatches[0].packetId, sibling.createdTask.id);
    assert.equal(rejected.artifactResolution.conflictingMatches[0].relation, "sibling");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("record_dove_mission_pass requires checklist children to be done before parent mission", () => {
  const root = createTempRoot("dove-mcp-parent-child-completion-");
  try {
    dispatchTool(root, "init_dove_goal", {
      id: "parent-child-completion-init",
      goal: "Validate parent completion waits for checklist children."
    });
    const created = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "parent-child-completion-parent",
      goal: "Complete a checklist-backed parent mission.",
      title: "Parent child completion mission",
      autoChecklist: true,
      confirmed: true
    }));
    assert.equal(created.createdChecklistTasks.length, 3);

    const artifact = ".dove/runtime/parent-child-completion-result.json";
    const blocked = extractToolJson(dispatchToolFull(root, "record_dove_mission_pass", {
      packetId: created.createdTask.id,
      runId: "parent-child-completion-blocked-pass",
      resultStatus: "completed",
      resultSummary: "Parent result cannot close before checklist children.",
      artifactRefs: [artifact],
      evidenceLinks: [artifact],
      verificationEvidencePaths: [MCP_VERIFICATION_PATH],
      verifiedCriteria: mcpVerifiedCriteria(mcpTaskCriterion(created.createdTask))
    }));
    assert.equal(blocked.status, "needs-checklist-reconciliation");
    assert.equal(blocked.requestedStatus, "done");
    assert.equal(blocked.machineStatus, "completed");
    assert.deepEqual(blocked.openChecklistChildIds.sort(), created.createdChecklistTasks.map((child) => child.id).sort());

    for (const [index, child] of created.createdChecklistTasks.entries()) {
      const childArtifact = `.dove/runtime/parent-child-completion-child-${index + 1}.json`;
      const childPass = extractToolJson(dispatchToolFull(root, "record_dove_mission_pass", {
        packetId: child.id,
        runId: `${child.id}-pass`,
        resultStatus: "completed",
        resultSummary: "Checklist child is done.",
        artifactRefs: [childArtifact],
        evidenceLinks: [childArtifact],
        verificationEvidencePaths: [MCP_VERIFICATION_PATH],
        verifiedCriteria: mcpVerifiedCriteria(mcpTaskCriterion(child))
      }));
      assert.equal(childPass.status, "completed");
    }

    const pass = extractToolJson(dispatchToolFull(root, "record_dove_mission_pass", {
      packetId: created.createdTask.id,
      runId: "parent-child-completion-pass",
      resultStatus: "completed",
      resultSummary: "Parent can close after checklist children are done.",
      artifactRefs: [artifact],
      evidenceLinks: [artifact],
      verificationEvidencePaths: [MCP_VERIFICATION_PATH],
      verifiedCriteria: mcpVerifiedCriteria(mcpTaskCriterion(created.createdTask))
    }));
    assert.equal(pass.status, "completed");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("apply_dove_status_adjustments rejects completed parents with open checklist children", () => {
  const root = createTempRoot("dove-mcp-parent-child-repair-");
  try {
    dispatchTool(root, "init_dove_goal", {
      id: "parent-child-repair-init",
      goal: "Validate completed parent checklist reconciliation."
    });
    const created = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "parent-child-repair-parent",
      goal: "Reject a legacy completed parent with open checklist children.",
      title: "Parent child repair mission",
      autoChecklist: true,
      confirmed: true
    }));
    const timestamp = new Date().toISOString();
    const parentPath = path.join(root, ".dove", "task-packets", "packets", `${created.createdTask.id}.json`);
    const parentPacket = JSON.parse(fs.readFileSync(parentPath, "utf8"));
    fs.writeFileSync(parentPath, `${JSON.stringify({ ...parentPacket, status: "completed", lifecycleStatus: "completed", completedAt: timestamp, updatedAt: timestamp }, null, 2)}\n`, "utf8");
    const archivedChild = created.createdChecklistTasks[0];
    const archivedChildPath = path.join(root, ".dove", "task-packets", "packets", `${archivedChild.id}.json`);
    const archivedChildPacket = JSON.parse(fs.readFileSync(archivedChildPath, "utf8"));
    fs.writeFileSync(archivedChildPath, `${JSON.stringify({ ...archivedChildPacket, lifecycleStatus: "archived", updatedAt: timestamp }, null, 2)}\n`, "utf8");
    const expectedOpenChildren = created.createdChecklistTasks.slice(1);
    const indexPath = path.join(root, ".dove", "task-packets", "index.json");
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    fs.writeFileSync(indexPath, `${JSON.stringify({
      ...index,
      items: index.items.map((item) => {
        if (item.id === created.createdTask.id) {
          return { ...item, status: "completed", lifecycleStatus: "completed", completedAt: timestamp, updatedAt: timestamp };
        }
        if (item.id === archivedChild.id) {
          return { ...item, lifecycleStatus: "archived", updatedAt: timestamp };
        }
        return item;
      })
    }, null, 2)}\n`, "utf8");

    const statusHome = extractToolJson(dispatchToolFull(root, "query_dove_status", { detail: "full" }));
    assert.equal(statusHome.dailyHome.completionConsistency.status, "needs-reconciliation");
    assert.equal(statusHome.dailyHome.completionConsistency.findings[0].parentDisplayStatus, "done");
    assert.equal(statusHome.dailyHome.completionConsistency.findings[0].parentMachineStatus, "completed");
    assert.deepEqual(statusHome.dailyHome.completionConsistency.findings[0].openChecklistChildIds.sort(), expectedOpenChildren.map((child) => child.id).sort());

    const filteredStatusHome = extractToolJson(dispatchToolFull(root, "query_dove_status", { detail: "full", status: "completed" }));
    assert.equal(filteredStatusHome.dailyHome.completionConsistency.status, "needs-reconciliation");
    assert.deepEqual(filteredStatusHome.dailyHome.completionConsistency.findings[0].openChecklistChildIds.sort(), expectedOpenChildren.map((child) => child.id).sort());
    const recoveryAction = statusHome.dailyHome.nextActions[0];
    assert.equal(recoveryAction.kind, "recover-current-work");
    assert.equal(recoveryAction.recoveryPrimaryKind, "reconcile-completion-consistency");
    assert.equal(recoveryAction.findingCount, 1);
    assert.equal(recoveryAction.openChecklistChildCount, expectedOpenChildren.length);

    const rejected = extractToolJson(dispatchToolFull(root, "apply_dove_status_adjustments", {
      confirmed: true,
      adjustments: [{ packetId: created.createdTask.id, status: "completed" }]
    }));
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.rejected[0].completionBlock.status, "needs-checklist-reconciliation");
    assert.equal(rejected.rejected[0].completionBlock.requestedStatus, "done");
    assert.deepEqual(rejected.rejected[0].completionBlock.openChecklistChildIds.sort(), expectedOpenChildren.map((child) => child.id).sort());

    const unchangedIndex = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    for (const child of created.createdChecklistTasks) {
      assert.equal(unchangedIndex.items.find((item) => item.id === child.id).status, "ready");
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("apply_dove_status_adjustments accepts parent and checklist completion in one unordered batch", () => {
  const root = createTempRoot("dove-mcp-parent-child-batch-completion-");
  try {
    dispatchTool(root, "init_dove_goal", {
      id: "parent-child-batch-completion-init",
      goal: "Validate batch completion order for checklist-backed parents."
    });
    const created = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "parent-child-batch-completion-parent",
      goal: "Complete parent and checklist children in one confirmation.",
      title: "Parent child batch completion mission",
      autoChecklist: true,
      confirmed: true
    }));

    const result = extractToolJson(dispatchToolFull(root, "apply_dove_status_adjustments", {
      confirmed: true,
      adjustments: [
        {
          packetId: created.createdTask.id,
          status: "completed",
          summary: "Parent mission completed with checklist evidence in the same batch.",
          verificationEvidencePaths: [MCP_VERIFICATION_PATH],
          verifiedCriteria: mcpVerifiedCriteria(mcpTaskCriterion(created.createdTask))
        },
        ...created.createdChecklistTasks.map((child) => ({
          packetId: child.id,
          status: "completed",
          summary: `${child.title} completed with verification evidence.`,
          verificationEvidencePaths: [MCP_VERIFICATION_PATH],
          verifiedCriteria: mcpVerifiedCriteria(mcpTaskCriterion(child))
        }))
      ]
    }));
    assert.equal(result.status, "applied");
    assert.equal(result.rejected.length, 0);
    assert.deepEqual(result.applied.map((item) => item.packetId).sort(), [created.createdTask.id, ...created.createdChecklistTasks.map((child) => child.id)].sort());

    const statusHome = extractToolJson(dispatchToolFull(root, "query_dove_status", { detail: "full" }));
    assert.equal(statusHome.dailyHome.completionConsistency.status, "consistent");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("create_dove_task rejects checklist children that are not deeper than the parent mission", () => {
  const root = createTempRoot("dove-mcp-mission-checklist-reject-");
  try {
    dispatchTool(root, "init_dove_goal", {
      id: "mission-checklist-reject-init",
      goal: "Validate checklist hierarchy rejection."
    });
    const rejected = dispatchTool(root, "create_dove_task", {
      id: "mission-checklist-invalid",
      goal: "Reject shallow checklist children.",
      level: 3,
      checklistItems: [{ title: "Invalid same-level system child", level: 3 }]
    });
    assert.equal(rejected.isError, true);
    assert.match(rejected.content[0].text, /must be greater than parent mission level/);

    const index = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "index.json"), "utf8"));
    assert.deepEqual(index.items.map((item) => item.id), ["mission-checklist-reject-init"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("run_dove_auto records bounded foreground iterations", () => {
  const root = createTempRoot("dove-mcp-auto-foreground-");
  try {
    dispatchTool(root, "init_dove_goal", {
      id: "auto-foreground-init",
      goal: "Validate foreground auto iterations."
    });
    const foregroundTask = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "auto-foreground-task",
      goal: "Run two explicit foreground auto steps.",
      title: "Auto foreground task",
      confirmed: true
    }));

    const needsConfirmation = extractToolJson(dispatchToolFull(root, "run_dove_auto", {
      packetId: "auto-foreground-task",
      goal: "Run only after confirmation."
    }));
    assert.equal(needsConfirmation.status, "needs-confirmation");
    assert.equal(needsConfirmation.proposalOnly, true);
    assert.equal(needsConfirmation.noAutoApply, true);
    assert.deepEqual(needsConfirmation.writes, []);
    assert.equal(needsConfirmation.confirmationRequired, true);
    assert.equal(needsConfirmation.demandConversion, false);
    assert.equal(needsConfirmation.executionMode, "multi-round-foreground-auto");
    assert.equal(needsConfirmation.selectedTask.id, "auto-foreground-task");
    assert.equal(needsConfirmation.confirmArgs.confirmed, true);
    assert.equal(needsConfirmation.confirmArgs.packetId, "auto-foreground-task");
    assert.equal(needsConfirmation.taskCard.presentation, "compact-task-card");
    assert.equal(needsConfirmation.autoCard.presentation, "compact-auto-card");
    assert.equal(needsConfirmation.autoCard.proposalOnly, true);
    assertFullPreActionGuidance(needsConfirmation.preActionGuidance, { surface: "dove.auto", primaryRole: "builder" });
    assertFullPreActionGuidance(needsConfirmation.taskCard.preActionGuidance, { surface: "dove.auto", primaryRole: "builder" });
    assertFullPreActionGuidance(needsConfirmation.autoCard.preActionGuidance, { surface: "dove.auto", primaryRole: "builder" });
    assert.equal(needsConfirmation.foreground, true);
    assert.equal(needsConfirmation.background, false);
    assert.equal(needsConfirmation.maxIterations, 3);

    const missionAliasConfirmation = extractToolJson(dispatchToolFull(root, "run_dove_auto", {
      missionPacketId: "auto-foreground-task"
    }));
    assert.equal(missionAliasConfirmation.status, "needs-confirmation");
    assert.equal(missionAliasConfirmation.selectedTask.id, "auto-foreground-task");

    const packetTargetConfirmation = extractToolJson(dispatchToolFull(root, "run_dove_auto", {
      packetTarget: "Auto foreground task"
    }));
    assert.equal(packetTargetConfirmation.status, "needs-confirmation");
    assert.equal(packetTargetConfirmation.selectedTask.id, "auto-foreground-task");

    const demandConfirmation = extractToolJson(dispatchToolFull(root, "run_dove_auto", {
      id: "auto-demand-task",
      goal: "Convert a new demand into an auto task contract before execution.",
      title: "Auto demand task",
      evidenceExpectations: ["contract", "runtime"]
    }));
    assert.equal(demandConfirmation.status, "needs-confirmation");
    assert.equal(demandConfirmation.proposalOnly, true);
    assert.equal(demandConfirmation.demandConversion, true);
    assert.equal(demandConfirmation.executionMode, "multi-round-foreground-auto");
    assert.equal(demandConfirmation.proposedTask.id, "auto-demand-task");
    assert.equal(demandConfirmation.taskCard.presentation, "compact-task-card");
    assert.equal(demandConfirmation.autoCard.presentation, "compact-auto-card");
    assertFullPreActionGuidance(demandConfirmation.preActionGuidance, { surface: "dove.auto", primaryRole: "builder" });
    assertFullPreActionGuidance(demandConfirmation.taskCard.preActionGuidance, { surface: "dove.auto", primaryRole: "builder" });
    assertFullPreActionGuidance(demandConfirmation.autoCard.preActionGuidance, { surface: "dove.auto", primaryRole: "builder" });
    assert.equal(demandConfirmation.checklistProposal.autoSelected, true);
    assert.equal(demandConfirmation.confirmArgs.confirmed, true);
    assert.equal(demandConfirmation.confirmArgs.checklistItems.length, 3);

    extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "auto-host-boundary-task",
      goal: "Require a real host pass instead of pretending generic engineering work ran.",
      title: "Auto host boundary task",
      confirmed: true,
      checklist: false
    }));
    const hostBoundary = extractToolJson(dispatchToolFull(root, "run_dove_auto", {
      packetId: "auto-host-boundary-task",
      confirmed: true,
      runId: "auto-host-boundary-run"
    }));
    assert.equal(hostBoundary.status, "awaiting-host-pass");
    assert.equal(hostBoundary.requiresHostPass, true);
    assert.deepEqual(hostBoundary.proposedSteps, []);
    assert.equal(hostBoundary.result.taskStatusAfter, "blocked");
    assert.equal(hostBoundary.task.status, "blocked");
    assert.equal(hostBoundary.boundary.type, "awaiting-host-pass");
    assert.equal(hostBoundary.task.boundary.type, "awaiting-host-pass");
    assert.deepEqual(hostBoundary.task.boundary.requiredActions, ["provide-host-pass-result", "provide-explicit-auto-step"]);
    assert.equal(hostBoundary.resultCard.presentation, "compact-result-summary-card");
    assert.equal(hostBoundary.resultCard.surface, "dove.auto");
    assertPreActionGuidanceSummary(hostBoundary.resultCard.preActionGuidanceSummary, { surface: "dove.auto", primaryRole: "builder" });
    assert.equal(hostBoundary.resultCard.requiresAction, true);
    assert.equal(hostBoundary.resultCard.nextActions[0].boundaryType, "awaiting-host-pass");
    assert.equal(hostBoundary.resultCard.nextActions[0].ownerRole, "builder");
    assert.equal(hostBoundary.resultCard.nextActions[0].handoffSuggestion.boundaryType, "awaiting-host-pass");
    assert.deepEqual(hostBoundary.resultCard.nextActions[0].requiredActions, ["provide-host-pass-result", "provide-explicit-auto-step"]);

    extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "auto-host-tool-blocked-task",
      goal: "Record a host tool classifier failure as a blocked mission.",
      title: "Auto host tool blocked task",
      confirmed: true,
      checklist: false
    }));
    const hostToolBlocked = extractToolJson(dispatchToolFull(root, "record_dove_mission_pass", {
      packetId: "auto-host-tool-blocked-task",
      runId: "auto-host-tool-blocked-run",
      resultStatus: "blocked",
      boundaryType: "host-tool-blocked",
      reason: "Host WebSearch safety classifier unavailable.",
      summary: "Host source retrieval could not run.",
      requiredActions: ["retry-host-search-or-use-authorized-retrieval"],
      nextAction: "project:dove.status"
    }));
    assert.equal(hostToolBlocked.status, "blocked");
    assert.equal(hostToolBlocked.task.status, "blocked");
    assert.equal(hostToolBlocked.task.boundary.type, "host-tool-blocked");
    assert.equal(hostToolBlocked.resultCard.requiresAction, true);
    assert.equal(hostToolBlocked.resultCard.nextActions[0].boundaryType, "host-tool-blocked");
    assert.deepEqual(hostToolBlocked.resultCard.nextActions[0].requiredActions, ["retry-host-search-or-use-authorized-retrieval"]);
    const blockedStatus = extractToolJson(dispatchToolFull(root, "query_dove_status", { detail: "full", showMissions: true }));
    const hostToolCard = blockedStatus.boundaryActionCards.find((card) => card.packetId === "auto-host-tool-blocked-task");
    assert.ok(hostToolCard);
    assert.equal(hostToolCard.boundaryType, "host-tool-blocked");
    assert.equal(hostToolCard.kind, "provide-evidence-or-result");

    extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "auto-source-needs-host",
      goal: "Collect CVPR author kit source provenance and register external URLs.",
      title: "Auto source needs host provenance",
      confirmed: true,
      checklist: false
    }));
    const sourceConfirmation = extractToolJson(dispatchToolFull(root, "run_dove_auto", {
      packetId: "auto-source-needs-host"
    }));
    assert.equal(sourceConfirmation.status, "needs-confirmation");
    assert.deepEqual(sourceConfirmation.proposedSteps, [{ index: 1, command: "dove.source", completeTask: false }]);
    assert.equal(sourceConfirmation.safeToRun, false);
    assert.equal(sourceConfirmation.requiresHostPass, true);
    assert.equal(sourceConfirmation.whyThisStep, "source-requires-host-provenance");

    const sourceBoundary = extractToolJson(dispatchToolFull(root, "run_dove_auto", {
      packetId: "auto-source-needs-host",
      confirmed: true,
      runId: "auto-source-needs-host-run"
    }));
    assert.equal(sourceBoundary.status, "awaiting-host-pass");
    assert.equal(sourceBoundary.result.iterations[0].command, null);
    assert.equal(sourceBoundary.result.stopReason, "source-requires-host-provenance");
    assert.equal(sourceBoundary.task.status, "blocked");
    assert.deepEqual(sourceBoundary.task.boundary.requiredActions, ["collect-source-provenance", "call-register-source-with-sources-array", "provide-explicit-auto-step"]);
    const sourceIndex = JSON.parse(fs.readFileSync(path.join(root, ".dove", "sources", "index.json"), "utf8"));
    assert.equal(sourceIndex.items.length, 0);

    extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "auto-source-unverified-provenance",
      goal: "Try to register a source after host search and fetch failed.",
      title: "Auto source unverified provenance",
      confirmed: true,
      checklist: false
    }));
    const unverifiedSourceRun = extractToolJson(dispatchToolFull(root, "run_dove_auto", {
      packetId: "auto-source-unverified-provenance",
      confirmed: true,
      runId: "auto-source-unverified-provenance-run",
      steps: [
        {
          command: "dove.source",
          args: {
            sourceType: "guideline",
            sources: [
              {
                sourceId: "cvpr-author-guidelines-blocked",
                title: "CVPR 2026 Author Guidelines",
                locator: "https://cvpr.thecvf.com/Conferences/2026/AuthorGuidelines",
                origin: "WebSearch did 0 searches and WebFetch failed safe-domain verification."
              }
            ]
          }
        }
      ]
    }));
    assert.equal(unverifiedSourceRun.status, "blocked-boundary");
    assert.equal(unverifiedSourceRun.result.stopReason, "source-provenance-unverified");
    assert.equal(unverifiedSourceRun.task.status, "blocked");
    assert.equal(unverifiedSourceRun.task.boundary.type, "host-tool-blocked");
    assert.deepEqual(unverifiedSourceRun.task.boundary.requiredActions, ["retry-host-search-or-use-authorized-retrieval", "provide-verifiable-source-title-and-locator", "call-register-source-only-after-successful-access-or-operator-provided-material"]);
    const sourceIndexAfterUnverifiedRun = JSON.parse(fs.readFileSync(path.join(root, ".dove", "sources", "index.json"), "utf8"));
    assert.equal(sourceIndexAfterUnverifiedRun.items.length, 0);

    const sourceNoteTask = extractToolJson(dispatchToolFull(root, "create_dove_task", {
      id: "auto-source-note-sequence",
      goal: "Collect CVPR source provenance and synthesize venue writing guidance.",
      title: "Auto source note sequence",
      confirmed: true,
      checklist: false
    }));
    const sourceNoteRun = extractToolJson(dispatchToolFull(root, "run_dove_auto", {
      packetId: "auto-source-note-sequence",
      confirmed: true,
      runId: "auto-source-note-sequence-run",
      maxIterations: 2,
      steps: [
        {
          command: "dove.source",
          args: {
            sourceType: "guideline",
            origin: "integration-test",
            sources: [
              {
                sourceId: "cvpr-author-guidelines",
                citationKey: "cvprAuthorGuidelines2026",
                title: "CVPR 2026 Author Guidelines",
                locator: "https://cvpr.thecvf.com/Conferences/2026/AuthorGuidelines"
              },
              {
                sourceId: "cvpr-reviewer-guidelines",
                citationKey: "cvprReviewerGuidelines2026",
                title: "CVPR 2026 Reviewer Guidelines",
                locator: "https://cvpr.thecvf.com/Conferences/2026/ReviewerGuidelines"
              }
            ]
          }
        },
        {
          command: "dove.note",
          completeTask: true,
          outputArtifacts: [".dove/notes/index.json"],
          verificationEvidencePaths: [MCP_VERIFICATION_PATH],
          verifiedCriteria: mcpVerifiedCriteria(mcpTaskCriterion(sourceNoteTask.createdTask)),
          args: {
            noteId: "cvpr-venue-writing-synthesis",
            title: "CVPR venue writing synthesis",
            sectionId: "venue-writing",
            sourceIds: ["cvpr-author-guidelines", "cvpr-reviewer-guidelines"],
            summary: "CVPR source research should register official provenance and synthesize writing guidance in the same auto run.",
            claims: ["CVPR venue intelligence needs both source provenance and internal synthesis."]
          }
        }
      ]
    }));
    assert.equal(sourceNoteRun.status, "completed");
    assert.deepEqual(sourceNoteRun.result.iterations.map((iteration) => iteration.command), ["dove.source", "dove.note"]);
    assert.notEqual(sourceNoteRun.result.stopReason, "source-requires-host-provenance");
    const progressedSources = JSON.parse(fs.readFileSync(path.join(root, ".dove", "sources", "index.json"), "utf8"));
    assert.ok(progressedSources.items.some((item) => item.id === "cvpr-author-guidelines" && item.packetIds.includes("auto-source-note-sequence")));
    assert.ok(progressedSources.items.some((item) => item.id === "cvpr-reviewer-guidelines" && item.packetIds.includes("auto-source-note-sequence")));
    const progressedNotes = JSON.parse(fs.readFileSync(path.join(root, ".dove", "notes", "index.json"), "utf8"));
    const progressedNote = progressedNotes.items.find((item) => item.id === "cvpr-venue-writing-synthesis");
    assert.ok(progressedNote);
    assert.deepEqual(progressedNote.sourceIds, ["cvpr-author-guidelines", "cvpr-reviewer-guidelines"]);
    assert.ok(progressedNote.packetIds.includes("auto-source-note-sequence"));

    for (const missingMaterialCase of [
      {
        id: "auto-note-needs-synthesis",
        step: { command: "dove.note", args: { title: "Missing note synthesis" } },
        reason: "note-requires-host-synthesis",
        requiredActions: ["synthesize-note-content", "call-upsert-note-with-summary-or-claims", "provide-explicit-auto-step"]
      },
      {
        id: "auto-draft-needs-body",
        step: { command: "dove.draft", args: { sectionId: "missing-draft-body" } },
        reason: "draft-requires-host-content",
        requiredActions: ["write-draft-body", "call-upsert-draft-with-body", "provide-explicit-auto-step"]
      },
      {
        id: "auto-experience-needs-objective",
        step: { command: "dove.experience", args: {} },
        reason: "experience-requires-host-objective",
        requiredActions: ["define-experience-objective", "call-run-experience-workflow-with-goal-or-experimentId", "provide-explicit-auto-step"]
      },
      {
        id: "auto-review-loop-needs-material",
        step: { command: "dove.review-loop", args: { draft: {} } },
        reason: "review-loop-requires-host-material",
        requiredActions: ["provide-review-loop-draft-or-experience-material", "provide-explicit-auto-step"]
      }
    ]) {
      extractToolJson(dispatchToolFull(root, "create_dove_task", {
        id: missingMaterialCase.id,
        goal: `Validate ${missingMaterialCase.reason}.`,
        title: missingMaterialCase.id,
        confirmed: true,
        checklist: false
      }));
      const boundary = extractToolJson(dispatchToolFull(root, "run_dove_auto", {
        packetId: missingMaterialCase.id,
        confirmed: true,
        runId: `${missingMaterialCase.id}-run`,
        steps: [missingMaterialCase.step]
      }));
      assert.equal(boundary.status, "awaiting-host-pass");
      assert.equal(boundary.result.stopReason, missingMaterialCase.reason);
      assert.deepEqual(boundary.task.boundary.requiredActions, missingMaterialCase.requiredActions);
      assert.deepEqual(boundary.resultCard.nextActions[0].requiredActions, missingMaterialCase.requiredActions);
    }

    const autoRun = extractToolJson(dispatchToolFull(root, "run_dove_auto", {
      packetId: "auto-foreground-task",
      confirmed: true,
      runId: "auto-foreground-run",
      maxIterations: 3,
      steps: [
        { command: "dove.note", args: { title: "Auto note", sectionId: "auto", summary: "Auto recorded a foreground note." } },
        {
          command: "dove.note",
          completeTask: true,
          outputArtifacts: [".dove/notes/index.json"],
          verificationEvidencePaths: [MCP_VERIFICATION_PATH],
          verifiedCriteria: mcpVerifiedCriteria(mcpTaskCriterion(foregroundTask.createdTask)),
          executionReceipt: {
            receiptId: "auto-explicit-step-receipt",
            packetId: "auto-foreground-task",
            actionType: "build",
            artifactRefs: [".dove/notes/index.json"],
            verificationEvidencePaths: [MCP_VERIFICATION_PATH],
            verifiedCriteria: mcpVerifiedCriteria(mcpTaskCriterion(foregroundTask.createdTask)),
            criteriaCoverage: {
              complete: true,
              required: [mcpTaskCriterion(foregroundTask.createdTask)],
              missing: [],
              verified: mcpVerifiedCriteria(mcpTaskCriterion(foregroundTask.createdTask))
            }
          },
          args: {
            noteId: "auto-completion-note",
            title: "Auto completion note",
            sectionId: "auto",
            summary: "Auto completed the foreground task with a durable note artifact."
          }
        }
      ]
    }));
    assert.equal(autoRun.status, "completed");
    assert.equal(autoRun.result.foreground, true);
    assert.equal(autoRun.result.background, false);
    assert.equal(autoRun.result.daemon, false);
    assert.equal(autoRun.result.maxIterations, 3);
    assert.equal(autoRun.result.iterationCount, 2);
    assert.deepEqual(autoRun.result.iterations.map((iteration) => iteration.command), ["dove.note", "dove.note"]);
    assert.equal(autoRun.result.iterations[1].executionReceipt.receiptId, "auto-explicit-step-receipt");
    assert.equal(autoRun.result.iterations[1].executionReceipt.criteriaCoverage.complete, true);
    assert.equal(autoRun.result.stopReason, "completion-confirmed-by-auto-step");
    assert.equal(autoRun.result.taskStatusAfter, "completed");
    assert.equal(autoRun.resultCard.presentation, "compact-result-summary-card");
    assert.equal(autoRun.resultCard.surface, "dove.auto");
    assert.equal(autoRun.resultCard.executionReceipt.receiptId, "auto-explicit-step-receipt");
    assert.equal(autoRun.resultCard.executionReceipt.criteriaCoverage.complete, true);
    assertPreActionGuidanceSummary(autoRun.resultCard.preActionGuidanceSummary, { surface: "dove.auto", primaryRole: "builder" });
    assert.equal(autoRun.resultCard.completed, true);

    const runtimeResults = JSON.parse(fs.readFileSync(path.join(root, ".dove", "runtime", "results.json"), "utf8"));
    const persisted = runtimeResults.entries.find((item) => item.id === "auto-foreground-run");
    assert.ok(persisted, "auto runtime result should be persisted");
    assert.equal(persisted.iterationCount, 2);
    assert.equal(persisted.iterations[1].executionReceipt.receiptId, "auto-explicit-step-receipt");
    assert.equal(persisted.iterations[1].executionReceipt.criteriaCoverage.complete, true);
    assert.equal(persisted.background, false);
    assert.equal(persisted.resultCard, undefined);
    const runtimeEvents = JSON.parse(fs.readFileSync(path.join(root, ".dove", "runtime", "events.json"), "utf8"));
    assert.equal(runtimeEvents.entries.some((entry) => entry.type === "task.boundary.opened" && entry.packetId === "auto-host-boundary-task"), true);
    assert.equal(runtimeEvents.entries.some((entry) => entry.type === "task.lifecycle.transitioned" && entry.packetId === "auto-foreground-task" && entry.toStatus === "completed"), true);

    const taskIndex = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "index.json"), "utf8"));
    const task = taskIndex.items.find((item) => item.id === "auto-foreground-task");
    assert.equal(task.status, "completed");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("run_dove_auto can propose first-run init and materialize after confirmation", () => {
  const root = createTempRoot("dove-mcp-first-run-auto-");
  try {
    const proposal = extractToolJson(dispatchToolFull(root, "run_dove_auto", {
      id: "first-run-auto-task",
      goal: "Start auto from a real demand without a prior init command.",
      title: "First-run auto task",
      initTitle: "First-run auto workspace",
      initObjective: "Validate inline init creation before auto execution.",
      checklist: false,
      maxIterations: 2
    }));
    assert.equal(proposal.status, "needs-confirmation");
    assert.equal(proposal.initMaterializationRequired, true);
    assert.equal(proposal.proposedInit.id, "init");
    assert.equal(proposal.proposedInit.level, 0);
    assert.equal(proposal.proposedTask.parentId, "init");
    assert.equal(proposal.executionMode, "multi-round-foreground-auto");
    assert.equal(proposal.confirmArgs.initTitle, "First-run auto workspace");
    assert.equal(proposal.confirmArgs.maxIterations, 2);

    const run = extractToolJson(dispatchToolFull(root, "run_dove_auto", {
      ...proposal.confirmArgs,
      runId: "first-run-auto-run",
      steps: [{
        command: "dove.note",
        completeTask: true,
        outputArtifacts: [".dove/notes/index.json"],
        verificationEvidencePaths: [MCP_VERIFICATION_PATH],
        verifiedCriteria: mcpVerifiedCriteria(mcpTaskCriterion(proposal.proposedTask)),
        args: {
          noteId: "first-run-auto-note",
          title: "First-run auto note",
          sectionId: "first-run",
          summary: "First-run auto completed with a durable note artifact."
        }
      }]
    }));
    assert.equal(run.status, "completed");
    assert.equal(run.task.id, "first-run-auto-task");
    assert.equal(run.result.packetId, "first-run-auto-task");
    assert.equal(run.result.iterationCount, 1);

    const taskIndex = JSON.parse(fs.readFileSync(path.join(root, ".dove", "task-packets", "index.json"), "utf8"));
    assert.deepEqual(taskIndex.items.map((item) => item.id), ["init", "first-run-auto-task"]);
    assert.equal(taskIndex.items.find((item) => item.id === "first-run-auto-task").status, "completed");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("isolated review MCP tools prepare and import explicit handoff artifacts", () => {
  const root = createTempRoot("dove-mcp-isolated-review-");
  try {
    seedTaskPacket(root);
    const prepared = extractToolJson(dispatchToolFull(root, "prepare_isolated_review", { packetId: "mcp-main-packet", runId: "mcp-isolated-1", scope: "mcp validation" }));
    assert.equal(prepared.status, "prepared");
    assert.equal(prepared.runId, "mcp-isolated-1");
    assertPreActionGuidanceSummary(prepared.preActionGuidanceSummary, { surface: "dove.review", primaryRole: "reviewer" });
    assert.match(prepared.inputPath, /\.dove\/reviews\/isolated\/mcp-isolated-1\/input\.json/);

    const reportPath = path.join(root, prepared.reportPath);
    fs.writeFileSync(reportPath, "# MCP isolated report\n\nExplicit report only.\n", "utf8");
    fs.writeFileSync(path.join(root, prepared.handoffPath), `${JSON.stringify({
      version: 1,
      runId: prepared.runId,
      status: "completed",
      verdict: "coherent",
      reviewerId: "mcp-reviewer",
      summary: "MCP isolated review returned explicit artifacts only.",
      inputPath: prepared.inputPath,
      inputSha256: prepared.inputSha256,
      reportPath: prepared.reportPath,
      reviewedArtifactPaths: prepared.reviewedArtifactPaths,
      findings: [],
      actionItems: []
    }, null, 2)}\n`, "utf8");
    fs.writeFileSync(path.join(root, ".dove", "reviews", "isolated", "mcp-isolated-1", "private-transcript.md"), "PRIVATE\n", "utf8");

    const imported = extractToolJson(dispatchToolFull(root, "import_isolated_review", { packetId: "mcp-main-packet", runId: "mcp-isolated-1" }));
    assert.equal(imported.status, "imported");
    assertPreActionGuidanceSummary(imported.preActionGuidanceSummary, { surface: "dove.review", primaryRole: "reviewer" });
    assert.equal(imported.privateTranscriptImported, false);
    assert.equal(imported.verdict, "coherent");
    const reviewLog = fs.readFileSync(path.join(root, ".dove", "reviews", "log.md"), "utf8");
    assert.doesNotMatch(reviewLog, /PRIVATE/);
    const runReview = extractToolJson(dispatchToolFull(root, "run_audio_review", { packetId: "mcp-main-packet", runId: "mcp-isolated-2", scope: "mcp validation" }));
    assert.equal(runReview.status, "prepared-awaiting-audio");
    assert.equal(runReview.resultCard.presentation, "compact-result-summary-card");
    assert.equal(runReview.resultCard.surface, "dove.review");
    assertPreActionGuidanceSummary(runReview.resultCard.preActionGuidanceSummary, { surface: "dove.review", primaryRole: "reviewer" });
    assert.equal(runReview.resultCard.nextActions[0].handoffSuggestion.boundaryType, "awaiting-review-output");
    assert.equal(runReview.resultCard.nextActions[0].handoffSuggestion.detail.implementationBoundaryType, "awaiting-audio-review-output");
    assert.equal("reason" in runReview.resultCard.nextActions[0].handoffSuggestion, false);
    assert.equal(runReview.resultCard.nextActions[0].nextRole, "reviewer");
    assert.deepEqual(runReview.resultCard.nextActions[0].requiredActions, ["complete-isolated-review-handoff"]);

    const reviewLoop = extractToolJson(dispatchToolFull(root, "run_dove_review_loop", { packetId: "mcp-main-packet", runId: "mcp-review-loop-awaiting-output", maxIterations: 1 }));
    assert.equal(reviewLoop.status, "blocked");
    assert.equal(reviewLoop.stopReason, "awaiting-review-output");
    assert.equal(reviewLoop.iterations[0].review.status, "prepared-awaiting-audio");
    assert.equal(reviewLoop.iterations[0].review.resultCard.nextActions[0].handoffSuggestion.boundaryType, "awaiting-review-output");
    assert.equal(reviewLoop.iterations[0].review.resultCard.nextActions[0].handoffSuggestion.detail.implementationBoundaryType, "awaiting-audio-review-output");

    fs.writeFileSync(path.join(root, runReview.reportPath), "# MCP isolated report\n\nNeeds validation evidence.\n", "utf8");
    fs.writeFileSync(path.join(root, runReview.handoffPath), `${JSON.stringify({
      version: 1,
      runId: runReview.runId,
      status: "completed",
      verdict: "needs-evidence",
      reviewerId: "mcp-reviewer",
      summary: "MCP isolated review needs validation evidence.",
      inputPath: runReview.inputPath,
      inputSha256: runReview.inputSha256,
      reportPath: runReview.reportPath,
      findings: [{ id: "missing-validation", severity: "medium", summary: "Provide validation evidence." }],
      actionItems: ["Provide validation evidence."]
    }, null, 2)}\n`, "utf8");
    const needsEvidence = extractToolJson(dispatchToolFull(root, "import_audio_review", { packetId: "mcp-main-packet", runId: "mcp-isolated-2" }));
    assertPreActionGuidanceSummary(needsEvidence.resultCard.preActionGuidanceSummary, { surface: "dove.review", primaryRole: "reviewer" });
    assert.equal(needsEvidence.resultCard.nextActions[0].command, "project:dove.mission");
    assert.equal(needsEvidence.resultCard.nextActions[0].handoffSuggestion.boundaryType, "verification-failed");
    assert.equal(needsEvidence.resultCard.nextActions[0].handoffSuggestion.detail.implementationBoundaryType, "audio-review-needs-evidence");
    assert.deepEqual(needsEvidence.resultCard.nextActions[0].requiredActions, ["Provide validation evidence."]);
    assert.equal(runReview.privacyBoundary.projectContextShared, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("role-bound MCP tools expose explicit override fields", () => {
  const roleBoundTools = [
    "upsert_orchestration_board",
    "append_handoff",
    "upsert_claims",
    "upsert_experiment_plan",
    "upsert_experiment_result",
    "run_experiment_audit",
    "bridge_result_to_claim",
    "run_review_loop",
    "append_review_log",
    "prepare_isolated_review",
    "import_isolated_review",
    "upsert_revision_plan",
    "normalize_rebuttal_issues",
    "build_rebuttal_strategy",
    "create_version_snapshot",
    "compare_versions",
    "record_operator_lesson",
    "record_operator_follow_through",
    "materialize_guidance_packet",
    "launch_dove_mission"
  ];

  for (const name of roleBoundTools) {
    const tool = toolDefinitions.find((item) => item.name === name);
    assert.ok(tool, `missing tool definition for ${name}`);
    assert.ok(tool.inputSchema.properties.actorRole, `${name} should expose actorRole`);
    assert.ok(tool.inputSchema.properties.policyOverrideReason, `${name} should expose policyOverrideReason`);
  }

  const taskScopedTools = [
    "update_research_brief",
    "register_source",
    "upsert_note",
    "upsert_claims",
    "upsert_plan",
    "upsert_outline",
    "upsert_draft",
    "set_section_status",
    "record_dove_mission_pass",
    "record_operator_lesson",
    "run_experience_workflow",
    "prepare_audio_review",
    "import_audio_review",
    "run_audio_review",
    "run_dove_review_loop",
    "upsert_figure_plan",
    "run_figure_workflow",
    "prepare_figure_generation",
    "import_figure_generation",
    "build_rebuttal",
    "append_review_log",
    "run_review_loop",
    "prepare_isolated_review",
    "import_isolated_review",
    "upsert_revision_plan",
    "normalize_rebuttal_issues",
    "build_rebuttal_strategy",
    "upsert_experiment_plan",
    "upsert_experiment_result",
    "run_experiment_audit",
    "bridge_result_to_claim",
    "create_version_snapshot",
    "compare_versions"
  ];
  for (const name of taskScopedTools) {
    const tool = toolDefinitions.find((item) => item.name === name);
    assert.ok(tool, `missing task-scoped tool definition for ${name}`);
    for (const field of ["packetId", "taskPacketId", "missionPacketId", "taskId", "target", "packetTarget", "taskName"]) {
      assert.ok(tool.inputSchema.properties[field], `${name} should expose ${field}`);
    }
  }

  const createDoveTaskTool = toolDefinitions.find((item) => item.name === "create_dove_task");
  const recordMissionPassTool = toolDefinitions.find((item) => item.name === "record_dove_mission_pass");
  const recordDocumentEvidenceTool = toolDefinitions.find((item) => item.name === "record_document_evidence");
  const registerSourceTool = toolDefinitions.find((item) => item.name === "register_source");
  const upsertNoteTool = toolDefinitions.find((item) => item.name === "upsert_note");
  const upsertDraftTool = toolDefinitions.find((item) => item.name === "upsert_draft");
  const applyStatusAdjustmentsTool = toolDefinitions.find((item) => item.name === "apply_dove_status_adjustments");
  const runDoveAutoTool = toolDefinitions.find((item) => item.name === "run_dove_auto");
  const runDoveOperatorTool = toolDefinitions.find((item) => item.name === "run_dove_operator");
  const followThroughTool = toolDefinitions.find((item) => item.name === "record_operator_follow_through");
  const approvalsQueryTool = toolDefinitions.find((item) => item.name === "query_program_approvals");
  const doveOrchestrateQueryTool = toolDefinitions.find((item) => item.name === "query_dove_orchestrate");
  const doveMissionQueryTool = toolDefinitions.find((item) => item.name === "query_dove_mission");
  const doveBoardQueryTool = toolDefinitions.find((item) => item.name === "query_dove_mission_board");
  const doveStatusQueryTool = toolDefinitions.find((item) => item.name === "query_dove_status");
  const resetDoveVersionTool = toolDefinitions.find((item) => item.name === "reset_dove_version");
  const queryOperatorLessonsTool = toolDefinitions.find((item) => item.name === "query_operator_lessons");
  const recordOperatorLessonTool = toolDefinitions.find((item) => item.name === "record_operator_lesson");
  const publishStatusTool = toolDefinitions.find((item) => item.name === "publish_dove_status");
  const publishGlobalStatusTool = toolDefinitions.find((item) => item.name === "publish_dove_global_status");
  const doveAuditQueryTool = toolDefinitions.find((item) => item.name === "query_dove_audit");
  const doveReturnQueryTool = toolDefinitions.find((item) => item.name === "query_dove_return");
  const doveOnboardingQueryTool = toolDefinitions.find((item) => item.name === "query_dove_onboarding");
  const paperPipelineQueryTool = toolDefinitions.find((item) => item.name === "query_paper_pipeline");
  const prepareIsolatedReviewTool = toolDefinitions.find((item) => item.name === "prepare_isolated_review");
  const importIsolatedReviewTool = toolDefinitions.find((item) => item.name === "import_isolated_review");
  const runExperienceTool = toolDefinitions.find((item) => item.name === "run_experience_workflow");
  const runAudioReviewTool = toolDefinitions.find((item) => item.name === "run_audio_review");
  const runReviewLoopTool = toolDefinitions.find((item) => item.name === "run_dove_review_loop");
  const runFigureTool = toolDefinitions.find((item) => item.name === "run_figure_workflow");
  const prepareFigureTool = toolDefinitions.find((item) => item.name === "prepare_figure_generation");
  const importFigureTool = toolDefinitions.find((item) => item.name === "import_figure_generation");
  const issueApprovalTool = toolDefinitions.find((item) => item.name === "issue_program_approval");
  const revokeApprovalTool = toolDefinitions.find((item) => item.name === "revoke_program_approval");
  const materializeTool = toolDefinitions.find((item) => item.name === "materialize_guidance_packet");
  const launchDoveTool = toolDefinitions.find((item) => item.name === "launch_dove_mission");
  const foregroundTool = toolDefinitions.find((item) => item.name === "run_autonomy_foreground");
  const operateTool = toolDefinitions.find((item) => item.name === "run_autonomy_operate");
  assert.ok(createDoveTaskTool, "create_dove_task should exist");
  assert.match(createDoveTaskTool.description, /compact task card/);
  assert.match(createDoveTaskTool.description, /preActionGuidance/);
  assert.match(createDoveTaskTool.description, /mission is a durable work\/progress object/);
  assert.match(createDoveTaskTool.description, /bounded foreground mission pass/);
  assert.match(createDoveTaskTool.description, /resultCard\/preActionGuidanceSummary/);
  assert.ok(createDoveTaskTool.inputSchema.properties.confirmed, "create_dove_task should expose confirmed");
  assert.ok(createDoveTaskTool.inputSchema.properties.confirm, "create_dove_task should expose confirm");
  assert.ok(createDoveTaskTool.inputSchema.properties.initTitle, "create_dove_task should expose first-run init title");
  assert.ok(createDoveTaskTool.inputSchema.properties.initObjective, "create_dove_task should expose first-run init objective");
  assert.ok(createDoveTaskTool.inputSchema.properties.initDomain, "create_dove_task should expose first-run init domain");
  assert.ok(createDoveTaskTool.inputSchema.properties.level, "create_dove_task should expose explicit mission level");
  assert.ok(createDoveTaskTool.inputSchema.properties.taskLevel, "create_dove_task should expose taskLevel");
  assert.ok(createDoveTaskTool.inputSchema.properties.missionLevel, "create_dove_task should expose missionLevel");
  assert.ok(createDoveTaskTool.inputSchema.properties.checklist, "create_dove_task should expose checklist controls");
  assert.ok(createDoveTaskTool.inputSchema.properties.autoChecklist, "create_dove_task should expose autoChecklist");
  assert.ok(createDoveTaskTool.inputSchema.properties.checklistItems, "create_dove_task should expose checklistItems");
  assert.ok(createDoveTaskTool.inputSchema.properties.subtasks, "create_dove_task should expose subtasks");
  assert.ok(createDoveTaskTool.inputSchema.properties.command, "create_dove_task should expose mission pass command hints");
  assert.ok(createDoveTaskTool.inputSchema.properties.runId, "create_dove_task should expose mission pass runId");
  assert.ok(createDoveTaskTool.inputSchema.properties.missionPass, "create_dove_task should expose missionPass envelope");
  assert.ok(createDoveTaskTool.inputSchema.properties.resultStatus, "create_dove_task should expose mission pass resultStatus");
  assert.ok(createDoveTaskTool.inputSchema.properties.resultSummary, "create_dove_task should expose mission pass resultSummary");
  assert.ok(createDoveTaskTool.inputSchema.properties.evidencePaths, "create_dove_task should expose mission pass evidence paths");
  assert.ok(createDoveTaskTool.inputSchema.properties.workContract, "create_dove_task should expose workContract");
  assert.ok(createDoveTaskTool.inputSchema.properties.executionContract, "create_dove_task should expose executionContract");
  assert.ok(createDoveTaskTool.inputSchema.properties.executionReceipt, "create_dove_task should expose executionReceipt");
  assert.ok(createDoveTaskTool.inputSchema.properties.verifiedCriteria, "create_dove_task should expose verifiedCriteria");
  assert.ok(createDoveTaskTool.inputSchema.properties.validationEvidencePaths, "create_dove_task should expose validationEvidencePaths");
  assert.ok(createDoveTaskTool.inputSchema.properties.verificationEvidencePaths, "create_dove_task should expose verificationEvidencePaths");
  assert.ok(createDoveTaskTool.inputSchema.properties.executionContract.properties.convergence.properties.criteria, "create_dove_task executionContract should expose convergence criteria");
  assert.ok(createDoveTaskTool.inputSchema.properties.deliverables, "create_dove_task should expose deliverables");
  assert.ok(createDoveTaskTool.inputSchema.properties.evidenceContract, "create_dove_task should expose evidenceContract");
  assert.ok(createDoveTaskTool.inputSchema.properties.doneCriteria, "create_dove_task should expose doneCriteria");
  assert.ok(createDoveTaskTool.inputSchema.properties.recommendedRoutes, "create_dove_task should expose recommendedRoutes");
  assert.ok(recordMissionPassTool, "record_dove_mission_pass should exist");
  assert.match(recordMissionPassTool.description, /resultCard/);
  assert.match(recordMissionPassTool.description, /host-tool-blocked/);
  assert.match(recordMissionPassTool.description, /visibly blocked/);
  assert.ok(recordMissionPassTool.inputSchema.properties.runId, "record_dove_mission_pass should expose runId");
  assert.ok(recordMissionPassTool.inputSchema.properties.resultStatus, "record_dove_mission_pass should expose resultStatus");
  assert.ok(recordMissionPassTool.inputSchema.properties.completeTask, "record_dove_mission_pass should expose completeTask");
  assert.ok(recordMissionPassTool.inputSchema.properties.blocked, "record_dove_mission_pass should expose blocked");
  assert.ok(recordMissionPassTool.inputSchema.properties.evidenceLinks, "record_dove_mission_pass should expose evidenceLinks");
  assert.ok(recordMissionPassTool.inputSchema.properties.artifactRefs, "record_dove_mission_pass should expose artifactRefs");
  assert.ok(recordMissionPassTool.inputSchema.properties.executionContract, "record_dove_mission_pass should expose executionContract");
  assert.ok(recordMissionPassTool.inputSchema.properties.executionReceipt, "record_dove_mission_pass should expose executionReceipt");
  assert.ok(recordMissionPassTool.inputSchema.properties.verifiedCriteria, "record_dove_mission_pass should expose verifiedCriteria");
  assert.ok(recordMissionPassTool.inputSchema.properties.validationEvidencePaths, "record_dove_mission_pass should expose validationEvidencePaths");
  assert.ok(recordMissionPassTool.inputSchema.properties.verificationEvidencePaths, "record_dove_mission_pass should expose verificationEvidencePaths");
  assert.ok(recordMissionPassTool.inputSchema.properties.command, "record_dove_mission_pass should expose command");
  assert.ok(recordMissionPassTool.inputSchema.properties.nextAction, "record_dove_mission_pass should expose nextAction");
  assert.ok(recordMissionPassTool.inputSchema.properties.plannedMissions, "record_dove_mission_pass should expose plannedMissions");
  assert.ok(recordMissionPassTool.inputSchema.properties.plannedMissions.items.properties.executionContract, "plannedMissions should expose executionContract");
  assert.ok(recordMissionPassTool.inputSchema.properties.plannedMissions.items.properties.executionReceipt, "plannedMissions should expose executionReceipt");
  assert.ok(recordMissionPassTool.inputSchema.properties.plannedMissions.items.properties.verifiedCriteria, "plannedMissions should expose verifiedCriteria");
  assert.ok(recordMissionPassTool.inputSchema.properties.resultingMissions, "record_dove_mission_pass should expose resultingMissions");
  assert.ok(recordMissionPassTool.inputSchema.properties.missions, "record_dove_mission_pass should expose missions");
  assert.ok(recordMissionPassTool.inputSchema.properties.childMissions, "record_dove_mission_pass should expose childMissions");
  assert.ok(recordMissionPassTool.inputSchema.properties.planConversion, "record_dove_mission_pass should expose planConversion");
  assert.ok(applyStatusAdjustmentsTool, "apply_dove_status_adjustments should exist");
  assert.match(applyStatusAdjustmentsTool.description, /compact status adjustment cards/);
  assert.match(applyStatusAdjustmentsTool.description, /resultCard/);
  assert.ok(applyStatusAdjustmentsTool.inputSchema.properties.confirmed, "apply_dove_status_adjustments should expose confirmed");
  assert.ok(applyStatusAdjustmentsTool.inputSchema.properties.adjustments, "apply_dove_status_adjustments should expose adjustments");
  assert.ok(applyStatusAdjustmentsTool.inputSchema.properties.adjustments.items.properties.executionReceipt, "status adjustments should expose executionReceipt");
  assert.ok(applyStatusAdjustmentsTool.inputSchema.properties.adjustments.items.properties.verificationEvidencePaths, "status adjustments should expose verificationEvidencePaths");
  assert.ok(applyStatusAdjustmentsTool.inputSchema.properties.adjustments.items.properties.verifiedCriteria, "status adjustments should expose verifiedCriteria");
  assert.ok(runDoveAutoTool, "run_dove_auto should exist");
  assert.match(runDoveAutoTool.description, /compact task\/auto cards/);
  assert.match(runDoveAutoTool.description, /preActionGuidance/);
  assert.match(runDoveAutoTool.description, /bounded foreground iterations/);
  assert.match(runDoveAutoTool.description, /explicit source and note steps/);
  assert.match(runDoveAutoTool.description, /never claim source research succeeded when search\/fetch returned zero results or safety errors/);
  assert.match(runDoveAutoTool.description, /only a packet id records a source-requires-host-provenance boundary/);
  assert.match(runDoveAutoTool.description, /placeholder writes/);
  assert.match(runDoveAutoTool.description, /blocked host-tool-blocked mission results/);
  assert.match(runDoveAutoTool.description, /no hidden continuation, scheduler, or daemon/);
  assert.ok(runDoveAutoTool.inputSchema.properties.missionPacketId, "run_dove_auto should expose missionPacketId");
  assert.ok(runDoveAutoTool.inputSchema.properties.taskId, "run_dove_auto should expose taskId");
  assert.ok(runDoveAutoTool.inputSchema.properties.packetTarget, "run_dove_auto should expose packetTarget");
  assert.ok(runDoveAutoTool.inputSchema.properties.initTitle, "run_dove_auto should expose first-run init title");
  assert.ok(runDoveAutoTool.inputSchema.properties.initObjective, "run_dove_auto should expose first-run init objective");
  assert.ok(runDoveAutoTool.inputSchema.properties.maxIterations, "run_dove_auto should expose maxIterations");
  assert.ok(runDoveAutoTool.inputSchema.properties.steps, "run_dove_auto should expose foreground steps");
  assert.ok(runDoveAutoTool.inputSchema.properties.steps.items.properties.requiredMaterials, "run_dove_auto steps should expose requiredMaterials");
  assert.ok(runDoveAutoTool.inputSchema.properties.steps.items.properties.outputArtifacts, "run_dove_auto steps should expose outputArtifacts");
  assert.ok(runDoveAutoTool.inputSchema.properties.steps.items.properties.convergenceChecks, "run_dove_auto steps should expose convergenceChecks");
  assert.ok(runDoveAutoTool.inputSchema.properties.steps.items.properties.failureRoutes, "run_dove_auto steps should expose failureRoutes");
  assert.ok(runDoveAutoTool.inputSchema.properties.steps.items.properties.executionContract, "run_dove_auto steps should expose executionContract");
  assert.ok(runDoveAutoTool.inputSchema.properties.steps.items.properties.executionReceipt, "run_dove_auto steps should expose executionReceipt");
  assert.ok(runDoveAutoTool.inputSchema.properties.steps.items.properties.verifiedCriteria, "run_dove_auto steps should expose verifiedCriteria");
  assert.ok(runDoveAutoTool.inputSchema.properties.autoSteps.items.properties.executionReceipt, "run_dove_auto autoSteps should expose executionReceipt");
  assert.ok(runDoveAutoTool.inputSchema.properties.completeTask, "run_dove_auto should expose explicit completion");
  assert.ok(runDoveOperatorTool, "run_dove_operator should exist");
  assert.match(runDoveOperatorTool.description, /compact queue summary\/cards/);
  assert.match(runDoveOperatorTool.description, /includeQueueDetails/);
  assert.match(runDoveOperatorTool.description, /planner preActionGuidance/);
  assert.match(runDoveOperatorTool.description, /read-only lesson recall/);
  assert.match(runDoveOperatorTool.description, /resultCard/);
  assert.match(runDoveOperatorTool.description, /material-specific host-pass requiredActions/);
  assert.match(runDoveOperatorTool.description, /host-tool-blocked task results/);
  assert.match(runDoveOperatorTool.description, /no scheduler or hidden runtime/);
  assert.ok(runDoveOperatorTool.inputSchema.properties.confirmed, "run_dove_operator should expose confirmed");
  assert.ok(runDoveOperatorTool.inputSchema.properties.includeQueueDetails, "run_dove_operator should expose includeQueueDetails");
  assert.ok(runDoveOperatorTool.inputSchema.properties.taskResults, "run_dove_operator should expose taskResults");
  assert.ok(runDoveOperatorTool.inputSchema.properties.taskResults.items.properties.executionContract, "operator taskResults should expose executionContract");
  assert.ok(runDoveOperatorTool.inputSchema.properties.taskResults.items.properties.executionReceipt, "operator taskResults should expose executionReceipt");
  assert.ok(runDoveOperatorTool.inputSchema.properties.taskResults.items.properties.verifiedCriteria, "operator taskResults should expose verifiedCriteria");
  assert.ok(runDoveOperatorTool.inputSchema.properties.taskResults.items.properties.verificationEvidencePaths, "operator taskResults should expose verificationEvidencePaths");
  assert.ok(approvalsQueryTool, "query_program_approvals should exist");
  assert.ok(doveOrchestrateQueryTool, "query_dove_orchestrate should exist");
  assert.ok(doveMissionQueryTool, "query_dove_mission should exist");
  assert.ok(doveBoardQueryTool, "query_dove_mission_board should exist");
  assert.ok(doveStatusQueryTool, "query_dove_status should exist");
  assert.match(doveStatusQueryTool.description, /compact Dove status translator/);
  assert.match(doveStatusQueryTool.description, /summary\/headline/);
  assert.match(doveStatusQueryTool.description, /nextStep/);
  assert.match(doveStatusQueryTool.description, /needsAttention/);
  assert.match(doveStatusQueryTool.description, /changes/);
  assert.match(doveStatusQueryTool.description, /showMore/);
  assert.match(doveStatusQueryTool.description, /one recommended action/);
  assert.match(doveStatusQueryTool.description, /resultMode: full\/debug/);
  assert.match(doveStatusQueryTool.description, /statusHome\.durableContextNotice/);
  assert.match(doveStatusQueryTool.description, /mutationRollbackModel/);
  assert.match(doveStatusQueryTool.description, /patch-plan plus host-tracked file-edit requirements/);
  assert.match(doveStatusQueryTool.description, /host checkpoint verification limits/);
  assert.match(doveStatusQueryTool.description, /unverified direct-process writes/);
  assert.match(doveStatusQueryTool.description, /not git detection/);
  assert.match(doveStatusQueryTool.description, /not direct-process/);
  assert.match(doveStatusQueryTool.description, /not reset_dove_version/);
  assert.match(doveStatusQueryTool.description, /statusHome\.preActionGuidance/);
  assert.match(doveStatusQueryTool.description, /automatic read-only lesson recall/);
  assert.match(doveStatusQueryTool.description, /Planner\/Builder\/Reviewer role framing/);
  assert.match(doveStatusQueryTool.description, /must not render a Missions panel/);
  assert.match(doveStatusQueryTool.description, /showMissions\/includeMissionDetails/);
  assert.ok(resetDoveVersionTool, "reset_dove_version should exist");
  assert.match(resetDoveVersionTool.description, /direction-change snapshot/);
  assert.match(resetDoveVersionTool.description, /not a \.dove rollback restore entrypoint/);
  assert.match(resetDoveVersionTool.description, /mutationMode: patch-plan/);
  assert.match(resetDoveVersionTool.description, /host-tracked file edits/);
  assert.match(resetDoveVersionTool.description, /host native checkpoint/);
  for (const property of ["id", "versionId", "title", "reason", "summary"]) {
    assert.ok(resetDoveVersionTool.inputSchema.properties[property], `reset_dove_version should expose ${property}`);
  }
  for (const property of ["rollbackCheckpointId", "restoreCheckpointId", "checkpointId", "restoreVersionId", "confirmed", "confirm"]) {
    assert.equal(resetDoveVersionTool.inputSchema.properties[property], undefined, `reset_dove_version should not expose ${property}`);
  }
  assert.ok(queryOperatorLessonsTool, "query_operator_lessons should exist");
  assert.match(queryOperatorLessonsTool.description, /recall applicable lessons automatically/);
  assert.match(queryOperatorLessonsTool.description, /read-only preActionGuidance/);
  assert.ok(recordOperatorLessonTool, "record_operator_lesson should exist");
  assert.match(recordOperatorLessonTool.description, /auto-recall lessons read-only/);
  assert.match(recordOperatorLessonTool.description, /recording never happens implicitly/);
  assert.ok(recordDocumentEvidenceTool, "record_document_evidence should exist");
  assert.match(recordDocumentEvidenceTool.description, /document\/evidence ledger entry/);
  assert.match(recordDocumentEvidenceTool.description, /source\/artifact provenance/);
  assert.match(recordDocumentEvidenceTool.description, /internal summaries, pressure-test reports, and synthesized outputs/);
  assert.ok(registerSourceTool, "register_source should exist");
  assert.match(registerSourceTool.description, /external source records/);
  assert.match(registerSourceTool.description, /sources: \[\.\.\.\]/);
  assert.match(registerSourceTool.description, /upsert_note/);
  assert.match(registerSourceTool.description, /record_document_evidence/);
  assert.ok(registerSourceTool.inputSchema.properties.sources, "register_source should expose batch sources");
  assert.equal(registerSourceTool.inputSchema.properties.sources.type, "array");
  assert.ok(registerSourceTool.inputSchema.properties.sources.items.properties.sourceId, "register_source batch items should expose sourceId");
  assert.ok(upsertNoteTool, "upsert_note should exist");
  assert.match(upsertNoteTool.description, /internal synthesis/);
  assert.match(upsertNoteTool.description, /pressure-test findings/);
  assert.match(upsertNoteTool.description, /writing-style summaries/);
  assert.match(upsertNoteTool.description, /reviewer-preference analysis/);
  assert.match(upsertNoteTool.description, /summary, quote, claim, or open question/);
  assert.ok(upsertDraftTool, "upsert_draft should exist");
  assert.match(upsertDraftTool.description, /require body content/);
  assert.match(upsertDraftTool.description, /set_section_status/);
  assert.ok(publishStatusTool, "publish_dove_status should exist");
  assert.match(publishStatusTool.description, /sanitized public Dove project progress artifacts/);
  assert.ok(publishStatusTool.inputSchema.properties.includeArchived, "publish_dove_status should expose includeArchived");
  assert.ok(publishStatusTool.inputSchema.properties.responseLanguage, "publish_dove_status should expose responseLanguage");
  assert.ok(publishGlobalStatusTool, "publish_dove_global_status should exist");
  assert.match(publishGlobalStatusTool.description, /global static Dove status index/);
  assert.ok(publishGlobalStatusTool.inputSchema.properties.projectRoots, "publish_dove_global_status should expose projectRoots");
  assert.ok(publishGlobalStatusTool.inputSchema.properties.projects, "publish_dove_global_status should expose projects");
  assert.ok(publishGlobalStatusTool.inputSchema.properties.outputDir, "publish_dove_global_status should expose outputDir");
  assert.ok(publishGlobalStatusTool.inputSchema.properties.refresh, "publish_dove_global_status should expose refresh");
  assert.ok(publishGlobalStatusTool.inputSchema.properties.includeConfig, "publish_dove_global_status should expose includeConfig");
  assert.ok(doveAuditQueryTool, "query_dove_audit should exist");
  assert.ok(doveReturnQueryTool, "query_dove_return should exist");
  assert.ok(doveOnboardingQueryTool, "query_dove_onboarding should exist");
  assert.ok(paperPipelineQueryTool, "query_paper_pipeline should exist");
  assert.ok(prepareIsolatedReviewTool, "prepare_isolated_review should exist");
  assert.match(prepareIsolatedReviewTool.description, /Reviewer preActionGuidanceSummary/);
  assert.match(prepareIsolatedReviewTool.description, /explicit isolation boundaries/);
  assert.ok(importIsolatedReviewTool, "import_isolated_review should exist");
  assert.match(importIsolatedReviewTool.description, /Reviewer preActionGuidanceSummary/);
  assert.match(importIsolatedReviewTool.description, /private transcripts/);
  assert.ok(runExperienceTool, "run_experience_workflow should exist");
  assert.match(runExperienceTool.description, /Builder\/experiment-planner preActionGuidance/);
  assert.match(runExperienceTool.description, /read-only lesson recall/);
  assert.match(runExperienceTool.description, /real experiment goal, title, idea, or experimentId/);
  assert.match(runExperienceTool.description, /claim-bridge boundary/);
  assert.ok(runAudioReviewTool, "run_audio_review should exist");
  assert.match(runAudioReviewTool.description, /resultCard/);
  assert.match(runAudioReviewTool.description, /Reviewer preActionGuidanceSummary/);
  assert.ok(runReviewLoopTool, "run_dove_review_loop should exist");
  assert.match(runReviewLoopTool.description, /Reviewer preActionGuidance/);
  assert.match(runReviewLoopTool.description, /draftBody or draft\.body/);
  assert.match(runReviewLoopTool.description, /experience substeps require/);
  assert.match(runReviewLoopTool.description, /foreground stop conditions/);
  assert.ok(runFigureTool, "run_figure_workflow should exist");
  assert.match(runFigureTool.description, /Builder preActionGuidance/);
  assert.match(runFigureTool.description, /artifact-provenance/);
  assert.match(runFigureTool.description, /QA gates/);
  assert.ok(prepareFigureTool, "prepare_figure_generation should exist");
  assert.ok(importFigureTool, "import_figure_generation should exist");
  assert.ok(doveOnboardingQueryTool.inputSchema.properties.maxDepth, "query_dove_onboarding should expose maxDepth");
  assert.ok(prepareIsolatedReviewTool.inputSchema.properties.reviewedArtifactPaths, "prepare_isolated_review should expose reviewedArtifactPaths");
  assert.ok(importIsolatedReviewTool.inputSchema.properties.handoffPath, "import_isolated_review should expose handoffPath");
  assert.ok(runExperienceTool.inputSchema.properties.experimentId, "run_experience_workflow should expose experimentId");
  assert.ok(runAudioReviewTool.inputSchema.properties.finalPlanPaths, "run_audio_review should expose finalPlanPaths");
  assert.ok(runReviewLoopTool.inputSchema.properties.maxIterations, "run_dove_review_loop should expose maxIterations");
  assert.ok(runFigureTool.inputSchema.properties.intent, "run_figure_workflow should expose intent");
  assert.ok(runFigureTool.inputSchema.properties.description, "run_figure_workflow should expose description");
  assert.ok(runFigureTool.inputSchema.properties.materialHints, "run_figure_workflow should expose materialHints");
  assert.ok(runFigureTool.inputSchema.properties.executeProvider, "run_figure_workflow should expose executeProvider");
  assert.ok(runFigureTool.inputSchema.properties.outputManifestPath, "run_figure_workflow should expose outputManifestPath");
  assert.ok(runFigureTool.inputSchema.properties.sourceSvgPath, "run_figure_workflow should expose sourceSvgPath");
  assert.ok(runFigureTool.inputSchema.properties.targetFinalSvgPath, "run_figure_workflow should expose targetFinalSvgPath");
  assert.ok(runFigureTool.inputSchema.properties.svgContent, "run_figure_workflow should expose svgContent");
  assert.equal(runFigureTool.inputSchema.properties.finalSvgPath, undefined, "run_figure_workflow should not expose legacy finalSvgPath input");
  assert.ok(runFigureTool.inputSchema.properties.caption, "run_figure_workflow should expose caption");
  assert.ok(prepareFigureTool.inputSchema.properties.figureId, "prepare_figure_generation should expose figureId");
  assert.ok(prepareFigureTool.inputSchema.properties.materialHints, "prepare_figure_generation should expose materialHints");
  assert.ok(prepareFigureTool.inputSchema.properties.executeProvider, "prepare_figure_generation should expose executeProvider");
  assert.ok(importFigureTool.inputSchema.properties.outputManifestPath, "import_figure_generation should expose outputManifestPath");
  assert.ok(importFigureTool.inputSchema.properties.sourceSvgPath, "import_figure_generation should expose sourceSvgPath");
  assert.equal(importFigureTool.inputSchema.properties.finalSvgPath, undefined, "import_figure_generation should not expose legacy finalSvgPath input");
  assert.ok(importFigureTool.inputSchema.properties.caption, "import_figure_generation should expose caption");
  assert.ok(doveOrchestrateQueryTool.inputSchema.properties.request, "query_dove_orchestrate should expose request");
  assert.ok(doveOrchestrateQueryTool.inputSchema.properties.domain, "query_dove_orchestrate should expose domain");
  assert.ok(doveOrchestrateQueryTool.inputSchema.properties.stage, "query_dove_orchestrate should expose stage");
  assert.ok(doveOrchestrateQueryTool.inputSchema.properties.allowAutonomy, "query_dove_orchestrate should expose allowAutonomy");
  assert.ok(doveMissionQueryTool.inputSchema.properties.domain, "query_dove_mission should expose domain");
  assert.ok(doveMissionQueryTool.inputSchema.properties.acceptanceChecks, "query_dove_mission should expose acceptanceChecks");
  assert.ok(doveBoardQueryTool.inputSchema.properties.domain, "query_dove_mission_board should expose domain");
  assert.ok(doveBoardQueryTool.inputSchema.properties.stage, "query_dove_mission_board should expose stage");
  assert.ok(doveBoardQueryTool.inputSchema.properties.packetId, "query_dove_mission_board should expose packetId");
  assert.ok(doveBoardQueryTool.inputSchema.properties.missionPacketId, "query_dove_mission_board should expose missionPacketId");
  assert.ok(doveBoardQueryTool.inputSchema.properties.status, "query_dove_mission_board should expose status");
  assert.ok(doveBoardQueryTool.inputSchema.properties.includeArchived, "query_dove_mission_board should expose includeArchived");
  assert.ok(doveStatusQueryTool.inputSchema.properties.domain, "query_dove_status should expose domain");
  assert.ok(doveStatusQueryTool.inputSchema.properties.stage, "query_dove_status should expose stage");
  assert.ok(doveStatusQueryTool.inputSchema.properties.packetId, "query_dove_status should expose packetId");
  assert.ok(doveStatusQueryTool.inputSchema.properties.status, "query_dove_status should expose status");
  assert.ok(doveStatusQueryTool.inputSchema.properties.includeArchived, "query_dove_status should expose includeArchived");
  assert.ok(doveStatusQueryTool.inputSchema.properties.detail, "query_dove_status should expose detail");
  assert.ok(doveStatusQueryTool.inputSchema.properties.full, "query_dove_status should expose full");
  assert.ok(doveStatusQueryTool.inputSchema.properties.includeDetails, "query_dove_status should expose includeDetails");
  assert.ok(doveStatusQueryTool.inputSchema.properties.showMissions, "query_dove_status should expose showMissions");
  assert.ok(doveStatusQueryTool.inputSchema.properties.includeMissionDetails, "query_dove_status should expose includeMissionDetails");
  assert.ok(doveStatusQueryTool.inputSchema.properties.requestStatusAdjustment, "query_dove_status should expose requestStatusAdjustment");
  assert.ok(doveStatusQueryTool.inputSchema.properties.includeStatusAdjustmentPreview, "query_dove_status should expose includeStatusAdjustmentPreview");
  assert.ok(doveAuditQueryTool.inputSchema.properties.scope, "query_dove_audit should expose scope");
  assert.ok(doveAuditQueryTool.inputSchema.properties.changedFilePaths, "query_dove_audit should expose changedFilePaths");
  assert.ok(doveAuditQueryTool.inputSchema.properties.validationOutputPaths, "query_dove_audit should expose validationOutputPaths");
  assert.ok(doveReturnQueryTool.inputSchema.properties.validationEvidencePaths, "query_dove_return should expose validationEvidencePaths");
  assert.ok(doveReturnQueryTool.inputSchema.properties.changedFilePaths, "query_dove_return should expose changedFilePaths");
  assert.ok(doveReturnQueryTool.inputSchema.properties.testEvidencePaths, "query_dove_return should expose testEvidencePaths");
  assert.ok(doveReturnQueryTool.inputSchema.properties.validationOutputPaths, "query_dove_return should expose validationOutputPaths");
  assert.ok(doveReturnQueryTool.inputSchema.properties.validationOutput, "query_dove_return should expose validationOutput");
  assert.ok(doveReturnQueryTool.inputSchema.properties.reviewEvidencePaths, "query_dove_return should expose reviewEvidencePaths");
  assert.ok(doveReturnQueryTool.inputSchema.properties.scope, "query_dove_return should expose scope");
  assert.ok(issueApprovalTool.inputSchema.properties.continuationFromRunId, "issue_program_approval should expose continuationFromRunId for review-to-reapproval bridging");
  assert.ok(issueApprovalTool.inputSchema.properties.noteTitle, "issue_program_approval should expose noteTitle for approved note steps");
  assert.ok(issueApprovalTool.inputSchema.properties.auditResultId, "issue_program_approval should expose auditResultId for approved experiment audit steps");
  assert.ok(issueApprovalTool.inputSchema.properties.bridgeResultId, "issue_program_approval should expose bridgeResultId for approved result bridge steps");
  assert.ok(issueApprovalTool.inputSchema.properties.reviewScope, "issue_program_approval should expose reviewScope for approved review-loop steps");
  assert.ok(issueApprovalTool.inputSchema.properties.stepSequence, "issue_program_approval should expose stepSequence for multi-step authority envelopes");
  assert.ok(issueApprovalTool.inputSchema.properties.autonomyPolicy, "issue_program_approval should expose autonomyPolicy for objective-aware step selection");
  assert.ok(issueApprovalTool.inputSchema.properties.packetId, "issue_program_approval should expose packetId");
  assert.ok(issueApprovalTool.inputSchema.properties.programRunId, "issue_program_approval should expose programRunId");
  assert.ok(issueApprovalTool.inputSchema.properties.approvalId, "issue_program_approval should expose approvalId");
  assert.ok(revokeApprovalTool.inputSchema.properties.approvalId, "revoke_program_approval should expose approvalId");
  assert.ok(followThroughTool.inputSchema.properties.workerRole, "record_operator_follow_through should expose workerRole for planner-supervised envelopes");
  assert.ok(materializeTool.inputSchema.properties.workerRole, "materialize_guidance_packet should expose workerRole for planner-supervised envelopes");
  assert.ok(followThroughTool.inputSchema.properties.programId, "record_operator_follow_through should expose programId for program-linked execution intent");
  assert.ok(materializeTool.inputSchema.properties.programId, "materialize_guidance_packet should expose programId for program-linked packets");
  assert.ok(materializeTool.inputSchema.properties.programRunId, "materialize_guidance_packet should expose programRunId for approved program runs");
  assert.ok(materializeTool.inputSchema.properties.approvalId, "materialize_guidance_packet should expose approvalId for approved program runs");
  assert.ok(materializeTool.inputSchema.properties.allowedStepType, "materialize_guidance_packet should expose allowedStepType for approved bounded program steps");
  assert.ok(materializeTool.inputSchema.properties.noteTitle, "materialize_guidance_packet should expose noteTitle for approved note steps");
  assert.ok(materializeTool.inputSchema.properties.auditResultId, "materialize_guidance_packet should expose auditResultId for approved experiment audit steps");
  assert.ok(materializeTool.inputSchema.properties.bridgeResultId, "materialize_guidance_packet should expose bridgeResultId for approved result bridge steps");
  assert.ok(materializeTool.inputSchema.properties.reviewScope, "materialize_guidance_packet should expose reviewScope for approved review-loop steps");
  assert.ok(launchDoveTool, "launch_dove_mission should exist");
  assert.ok(launchDoveTool.inputSchema.properties.actorRole, "launch_dove_mission should expose actorRole");
  assert.ok(launchDoveTool.inputSchema.properties.sourceType, "launch_dove_mission should expose sourceType");
  assert.ok(launchDoveTool.inputSchema.properties.sourceId, "launch_dove_mission should expose sourceId");
  assert.ok(launchDoveTool.inputSchema.properties.domain, "launch_dove_mission should expose domain");
  assert.ok(launchDoveTool.inputSchema.properties.stage, "launch_dove_mission should expose stage");
  assert.ok(launchDoveTool.inputSchema.properties.missionPacketId, "launch_dove_mission should expose missionPacketId");
  assert.ok(launchDoveTool.inputSchema.properties.executeBy, "launch_dove_mission should expose executeBy");
  assert.ok(launchDoveTool.inputSchema.properties.reviewAfter, "launch_dove_mission should expose reviewAfter");
  assert.ok(launchDoveTool.inputSchema.properties.policyOverrideReason, "launch_dove_mission should expose policy override fields");
  assert.ok(foregroundTool, "run_autonomy_foreground should exist");
  assert.ok(foregroundTool.inputSchema.properties.maxSteps, "run_autonomy_foreground should expose maxSteps");
  assert.ok(foregroundTool.inputSchema.properties.packetId, "run_autonomy_foreground should expose packetId");
  assert.ok(foregroundTool.inputSchema.properties.programRunId, "run_autonomy_foreground should expose programRunId");
  assert.ok(foregroundTool.inputSchema.properties.approvalId, "run_autonomy_foreground should expose approvalId");
  assert.ok(operateTool, "run_autonomy_operate should exist");
  assert.ok(operateTool.inputSchema.properties.objective, "run_autonomy_operate should expose objective");
  assert.ok(operateTool.inputSchema.properties.sourceType, "run_autonomy_operate should expose sourceType");
  assert.ok(operateTool.inputSchema.properties.sourceId, "run_autonomy_operate should expose sourceId");
  assert.ok(operateTool.inputSchema.properties.stepSequence, "run_autonomy_operate should expose stepSequence");
  assert.ok(operateTool.inputSchema.properties.campaignId, "run_autonomy_operate should expose campaignId");
});
