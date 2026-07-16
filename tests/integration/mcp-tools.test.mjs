import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  GOVERNANCE_GUARDED_MUTATIONS,
  GOVERNANCE_READONLY_TOOLS
} from "../../src/core/schema.mjs";
import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { dispatchTool } from "../../src/mcp/handlers.mjs";
import {
  MUTATING_TOOL_NAMES,
  TOOL_INPUT_PROPERTY_NAMES,
  TOOL_INPUT_SCHEMAS,
  toolDefinitions
} from "../../src/mcp/tool-definitions.mjs";
import { createMcpStdioClient } from "../../scripts/mcp-stdio-client.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

const ROOT = process.cwd();
const SERVER = path.join(ROOT, "mcp", "dove-state-server.mjs");

const EXPECTED_TOOL_NAMES = [
  "init_dove_goal",
  "create_dove_mission",
  "query_dove_mission",
  "query_dove_status",
  "ingest_execution_receipt",
  "assess_mission_completion",
  "search_network",
  "query_network_search_providers",
  "query_sources",
  "query_dove_lessons",
  "record_dove_lesson",
  "register_source",
  "verify_source",
  "upsert_note",
  "upsert_claims",
  "run_experience_workflow",
  "upsert_draft",
  "upsert_draft_metadata",
  "run_figure_workflow",
  "prepare_review_exchange",
  "import_review_exchange",
  "verify_review_coverage",
  "normalize_rebuttal_issues",
  "build_rebuttal_strategy",
  "build_rebuttal",
  "create_version_snapshot",
  "compare_versions"
];

const DELETED_TOOL_NAMES = [
  "query_dove_mission_board",
  "query_dove_orchestrate",
  "query_dove_audit",
  "query_dove_return",
  "record_dove_mission_pass",
  "apply_dove_status_adjustments",
  "run_dove_auto",
  "run_dove_operator",
  "kill_dove_task",
  "run_dove_review_loop",
  "launch_dove_mission",
  "upsert_orchestration_board",
  "append_handoff",
  "materialize_guidance_packet",
  "query_program_approvals",
  "query_campaigns",
  "plan_campaign",
  "issue_program_approval",
  "run_autonomy_once",
  "run_autonomy_foreground",
  "run_autonomy_operate",
  "query_operator_lessons",
  "record_operator_lesson"
];

function extractToolJson(result) {
  assert.ok(result.content?.[0]?.text, "Expected MCP text content");
  assert.notEqual(result.isError, true, result.content[0].text);
  return JSON.parse(result.content[0].text);
}

function snapshot(root) {
  const output = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(fullPath);
      else output[path.relative(root, fullPath).split(path.sep).join("/")] = entry.isSymbolicLink()
        ? `link:${fs.readlinkSync(fullPath)}`
        : fs.readFileSync(fullPath).toString("base64");
    }
  };
  visit(root);
  return output;
}

function assertSchemaObjectsSealed(schema, inputPath = "$", seen = new WeakSet()) {
  if (!schema || typeof schema !== "object" || seen.has(schema)) return;
  seen.add(schema);
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.includes("object") && schema.properties) {
    assert.equal(schema.additionalProperties, false, `${inputPath} must reject unknown object properties`);
  }
  for (const [key, value] of Object.entries(schema)) {
    if (key === "properties") {
      for (const [propertyName, propertySchema] of Object.entries(value ?? {})) {
        assertSchemaObjectsSealed(propertySchema, `${inputPath}.properties.${propertyName}`, seen);
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => assertSchemaObjectsSealed(item, `${inputPath}.${key}[${index}]`, seen));
    } else {
      assertSchemaObjectsSealed(value, `${inputPath}.${key}`, seen);
    }
  }
}

function materializeMission(root, missionId = "mcp-schema-seven") {
  const proposal = extractToolJson(dispatchTool(root, "create_dove_mission", {
    missionId,
    goal: "Exercise the sealed schema 8 MCP contract.",
    targetArtifacts: ["README.md"],
    expectedArtifacts: ["README.md"],
    completionCriteria: ["The approved artifact is current."],
    evidenceRequirements: ["artifact:README.md"],
    resultMode: "full"
  }));
  return {
    proposal,
    created: extractToolJson(dispatchTool(root, "create_dove_mission", {
      ...proposal.confirmation.confirmArgs,
      resultMode: "full"
    }))
  };
}

test("schema 8 MCP exposes one sealed registry without board or operator discovery tiers", () => {
  assert.deepEqual(toolDefinitions.map((tool) => tool.name), EXPECTED_TOOL_NAMES);
  assert.equal(new Set(EXPECTED_TOOL_NAMES).size, EXPECTED_TOOL_NAMES.length);
  assert.deepEqual([...TOOL_INPUT_SCHEMAS.keys()], EXPECTED_TOOL_NAMES);
  assert.deepEqual([...TOOL_INPUT_PROPERTY_NAMES.keys()], EXPECTED_TOOL_NAMES);

  assert.deepEqual(toolDefinitions.find((tool) => tool.name === "query_dove_lessons").inputSchema.properties.kind.enum, ["preference", "constraint", "method", "failure", "review-insight"]);
  assert.deepEqual(toolDefinitions.find((tool) => tool.name === "record_dove_lesson").inputSchema.properties.kind.enum, ["preference", "constraint", "method", "failure", "review-insight"]);
  assert.ok(toolDefinitions.find((tool) => tool.name === "query_dove_status").inputSchema.properties.missionId);

  for (const tool of toolDefinitions) {
    assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
    assertSchemaObjectsSealed(tool.inputSchema);
    assert.ok(tool.inputSchema.properties.resultMode, `${tool.name} must expose resultMode`);
    for (const retired of ["packetId", "taskPacketId", "assignedRole", "nextAction", "route", "queue", "lease", "campaignId", "continuationId", "policyOverrideReason"]) {
      assert.equal(Object.hasOwn(tool.inputSchema.properties, retired), false, `${tool.name} must not expose ${retired}`);
    }
    if (["create_dove_mission", "record_dove_lesson"].includes(tool.name)) assert.equal(Object.hasOwn(tool.inputSchema.properties, "confirm"), false, `${tool.name} must not expose a confirmation alias`);
    assert.equal(Object.hasOwn(tool, "operatorTier"), false);
    assert.equal(Object.hasOwn(tool, "primaryEntry"), false);
    assert.equal(Object.hasOwn(tool, "internalOnly"), false);
  }

  const classified = new Map(EXPECTED_TOOL_NAMES.map((name) => [name, 0]));
  for (const entry of GOVERNANCE_GUARDED_MUTATIONS) classified.set(entry.surfaceBindings.mcpTool, classified.get(entry.surfaceBindings.mcpTool) + 1);
  for (const name of GOVERNANCE_READONLY_TOOLS) classified.set(name, classified.get(name) + 1);
  for (const [name, count] of classified) assert.equal(count, 1, `${name} governance classification`);
});

test("deleted MCP tools are absent and fail without creating workspace state", () => {
  const names = new Set(EXPECTED_TOOL_NAMES);
  for (const name of DELETED_TOOL_NAMES) {
    assert.equal(names.has(name), false, name);
    assert.equal(TOOL_INPUT_SCHEMAS.has(name), false, name);
    const root = createTempRoot(`dove-mcp-deleted-${name}-`);
    const result = dispatchTool(root, name, {});
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, new RegExp(`Unknown tool: ${name}`));
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);
    cleanupTempRoot(root);
  }
});

test("read-only mission preview and status are zero-write and reject unknown inputs", () => {
  const root = createTempRoot("dove-mcp-readonly-");
  const before = snapshot(root);
  const preview = extractToolJson(dispatchTool(root, "query_dove_mission", {
    goal: "Preview without durable state.",
    resultMode: "full"
  }));
  assert.equal(preview.status, "proposal");
  const status = extractToolJson(dispatchTool(root, "query_dove_status", { resultMode: "full" }));
  assert.equal(status.query, true);
  assert.equal(status.proposalOnly, true);
  assert.equal(status.scope.state, "absent");
  assert.deepEqual(snapshot(root), before);

  const rejected = dispatchTool(root, "query_dove_status", { board: true });
  assert.equal(rejected.isError, true);
  assert.match(rejected.content[0].text, /does not accept unknown input.*\$\.board/u);
  assert.deepEqual(snapshot(root), before);
  cleanupTempRoot(root);
});

test("MCP lesson query and proposal are zero-write, with confirmed replay entering MutationContext", () => {
  const root = createTempRoot("dove-mcp-lessons-");
  materializeMission(root, "mcp-lessons");
  const before = snapshot(root);

  const query = extractToolJson(dispatchTool(root, "query_dove_lessons", { missionId: "mcp-lessons", resultMode: "full" }));
  assert.equal(query.status, "empty");
  assert.deepEqual(snapshot(root), before);

  const proposal = extractToolJson(dispatchTool(root, "record_dove_lesson", {
    missionId: "mcp-lessons",
    lessonId: "mcp-lesson-one",
    scope: "mission",
    kind: "method",
    summary: "Keep MCP lesson recording exact.",
    nextTimeGuidance: ["Replay the exact confirmed proposal."],
    sourceIds: [],
    noteIds: [],
    artifactRefs: [],
    appliesToArtifactRefs: [],
    tags: ["mcp"],
    mutationMode: "direct-process",
    resultMode: "full"
  }));
  assert.equal(proposal.status, "needs-confirmation");
  assert.equal(Object.hasOwn(proposal.confirmation.confirmArgs, "confirm"), false);
  assert.deepEqual(snapshot(root), before);

  const alias = dispatchTool(root, "record_dove_lesson", { ...proposal.confirmation.confirmArgs, confirmed: undefined, confirm: true, resultMode: "full" });
  assert.equal(alias.isError, true);
  assert.match(alias.content[0].text, /unknown input.*\$\.confirm/u);
  assert.deepEqual(snapshot(root), before);

  const recorded = extractToolJson(dispatchTool(root, "record_dove_lesson", { ...proposal.confirmation.confirmArgs, resultMode: "full" }));
  assert.equal(recorded.status, "recorded");
  assert.equal(recorded.advisoryOnly, true);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.lessonsDir, "mcp-lesson-one.json")), true);
  cleanupTempRoot(root);
});

test("MCP init proposal and patch-plan confirmation remain zero-write and minimal", () => {
  const root = createTempRoot("dove-mcp-init-patch-");
  const before = snapshot(root);
  const proposal = extractToolJson(dispatchTool(root, "init_dove_goal", {
    goal: "Plan sealed schema 8 initialization.",
    mutationMode: "patch-plan",
    resultMode: "full"
  }));
  assert.equal(proposal.status, "needs-confirmation");
  assert.deepEqual(snapshot(root), before);

  const planned = extractToolJson(dispatchTool(root, "init_dove_goal", {
    ...proposal.confirmation.confirmArgs,
    resultMode: "full"
  }));
  assert.equal(planned.status, "initialization-planned");
  assert.equal(planned.writesApplied, false);
  const paths = new Set(planned.mutationPlan.operations.map((operation) => operation.relativePath));
  for (const required of [ARTIFACT_PATHS.doveRootManifest, ARTIFACT_PATHS.projectIdentity]) {
    assert.equal(paths.has(required), true, required);
  }
  for (const forbidden of [".dove/state.json", ".dove/task-packets/index.json", ".dove/orchestration/board.json", ".dove/runtime/results.json", ".dove/mutations/index.json"]) {
    assert.equal(paths.has(forbidden), false, forbidden);
  }
  assert.deepEqual(snapshot(root), before);
  cleanupTempRoot(root);
});

test("MCP archive-reset rejects patch-plan before operations or writes", () => {
  const root = createTempRoot("dove-mcp-reset-patch-");
  fs.mkdirSync(path.join(root, ".dove"));
  fs.writeFileSync(path.join(root, ".dove", "state.json"), "{\"version\":6}\n");
  const before = snapshot(root);
  const result = runWithMutationContext(root, {
    actionId: "init-dove-goal",
    mutationMode: "patch-plan",
    hostId: "test"
  }, (context) => {
    const rejected = dispatchTool(root, "init_dove_goal", {
      goal: "Reject archive reset planning.",
      archiveReset: true,
      mutationMode: "patch-plan"
    });
    assert.equal(rejected.isError, true);
    assert.match(rejected.content[0].text, /cannot run in patch-plan mode/u);
    assert.equal(context.operations().length, 0);
    return { status: "rejected" };
  });
  assert.equal(result.writesApplied, false);
  assert.equal(result.mutationPlan.operations.length, 0);
  assert.deepEqual(snapshot(root), before);
  cleanupTempRoot(root);
});

test("MCP mission exact replay persists only the minimal contract and rejects drift", () => {
  const root = createTempRoot("dove-mcp-mission-replay-");
  const proposal = extractToolJson(dispatchTool(root, "create_dove_mission", {
    missionId: "exact-replay",
    goal: "Persist only this approved mission contract.",
    scope: ["schema 8 MCP"],
    targetArtifacts: ["README.md"],
    completionCriteria: ["README is current"],
    resultMode: "full"
  }));
  assert.equal(proposal.status, "needs-confirmation");
  assert.equal(fs.existsSync(path.join(root, ".dove")), false);

  for (const altered of [
    { ...proposal.confirmation.confirmArgs, proposalDigest: "0".repeat(64) },
    { ...proposal.confirmation.confirmArgs, goal: "Changed after approval." },
    { ...proposal.confirmation.confirmArgs, confirmed: undefined, confirm: true },
    { ...proposal.confirmation.confirmArgs, packetId: "retired" }
  ]) {
    const rejected = dispatchTool(root, "create_dove_mission", { ...altered, resultMode: "full" });
    assert.equal(rejected.isError, true);
    assert.match(rejected.content[0].text, /no longer matches|unknown input|not allowed/u);
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);
  }

  const created = extractToolJson(dispatchTool(root, "create_dove_mission", {
    ...proposal.confirmation.confirmArgs,
    resultMode: "full"
  }));
  assert.equal(created.status, "materialized");
  assert.equal(created.mission.missionId, "exact-replay");
  assert.equal(created.executionHandoff.missionId, "exact-replay");
  assert.equal(created.executionHandoff.contractDigest, created.mission.contractDigest);
  assert.match(created.executionHandoff.receiptCliTemplate, /receipt .*--json/u);
  assert.deepEqual(created.executionHandoff.mcpTools, { ingest: "ingest_execution_receipt", assess: "assess_mission_completion" });
  assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.missionsDir, "exact-replay.json"), "utf8")), "executionHandoff"), false);
  assert.deepEqual(Object.keys(snapshot(root)).sort(), [
    ARTIFACT_PATHS.doveRootManifest,
    `${ARTIFACT_PATHS.missionsDir}/exact-replay.json`,
    ARTIFACT_PATHS.projectIdentity
  ].sort());
  assert.equal(fs.existsSync(path.join(root, ".dove", "state.json")), false);
  assert.equal(fs.existsSync(path.join(root, ".dove", "task-packets")), false);
  cleanupTempRoot(root);
});

test("MCP receipt ingestion returns current assessment only after commit and keeps patch plans null", () => {
  const root = createTempRoot("dove-mcp-receipt-post-commit-");
  fs.writeFileSync(path.join(root, "README.md"), "committed MCP receipt artifact\n", "utf8");
  const { created } = materializeMission(root, "mcp-receipt-post-commit");
  const missionPath = path.join(root, ARTIFACT_PATHS.missionsDir, `${created.mission.missionId}.json`);
  const mission = JSON.parse(fs.readFileSync(missionPath, "utf8"));
  const receiptArgs = {
    receiptId: "mcp-receipt-current",
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    summary: "Recorded the current MCP artifact.",
    artifacts: [{ path: "README.md", kind: "document", sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "README.md"))).digest("hex") }],
    validations: [],
    criteriaSatisfied: mission.completionCriterionIds.map((criterionId) => ({ criterionId, evidenceRefs: ["artifact:README.md"] })),
    producedAt: "2026-07-16T00:00:00.000Z",
    resultMode: "full"
  };

  const planned = extractToolJson(dispatchTool(root, "ingest_execution_receipt", { ...receiptArgs, receiptId: "mcp-receipt-planned", mutationMode: "patch-plan" }));
  assert.equal(planned.status, "ingest-planned");
  assert.equal(planned.completion.assessment, null);
  assert.equal(Object.hasOwn(planned, "postCommit"), false);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir, "mcp-receipt-planned.json")), false);

  const direct = extractToolJson(dispatchTool(root, "ingest_execution_receipt", { ...receiptArgs, mutationMode: "direct-process" }));
  assert.equal(direct.status, "ingested");
  assert.equal(direct.completion.assessment.currentReceiptId, receiptArgs.receiptId);
  assert.equal(direct.completion.assessment.complete, true);
  assert.equal(Object.hasOwn(direct, "postCommit"), false);

  const lockPath = path.join(root, ".dove", ".receipt-ledger-append.lock");
  fs.writeFileSync(lockPath, "occupied\n", "utf8");
  const failed = dispatchTool(root, "ingest_execution_receipt", { ...receiptArgs, receiptId: "mcp-receipt-failed", mutationMode: "direct-process" });
  assert.equal(failed.isError, true);
  assert.doesNotMatch(failed.content[0].text, /completion|assessment/u);
  assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir, "mcp-receipt-failed.json")), false);
  fs.rmSync(lockPath);
  cleanupTempRoot(root);
});

test("MCP validates mutation modes before writes and honors an active context", () => {
  const invalidRoot = createTempRoot("dove-mcp-invalid-mode-");
  const invalid = dispatchTool(invalidRoot, "create_dove_mission", {
    missionId: "invalid-mode",
    goal: "Reject invalid mode.",
    mutationMode: "invalid"
  });
  assert.equal(invalid.isError, true);
  assert.match(invalid.content[0].text, /\$\.mutationMode must be one of/u);
  assert.equal(fs.existsSync(path.join(invalidRoot, ".dove")), false);
  cleanupTempRoot(invalidRoot);

  const conflictRoot = createTempRoot("dove-mcp-conflict-mode-");
  const conflict = runWithMutationContext(conflictRoot, {
    actionId: "test",
    mutationMode: "patch-plan",
    hostId: "test"
  }, () => dispatchTool(conflictRoot, "create_dove_mission", {
    missionId: "conflict-mode",
    goal: "Reject conflicting mode.",
    mutationMode: "direct-process"
  }));
  assert.equal(conflict.isError, true);
  assert.match(conflict.content[0].text, /does not match the active mutation context mode patch-plan/u);
  assert.equal(conflict.mutationPlan.operations.length, 0);
  assert.equal(fs.existsSync(path.join(conflictRoot, ".dove")), false);
  cleanupTempRoot(conflictRoot);
});

test("mission-bound domain tools retain explicit mission inputs", () => {
  const byName = new Map(toolDefinitions.map((tool) => [tool.name, tool]));
  for (const name of [
    "query_sources", "query_dove_lessons", "record_dove_lesson", "register_source", "verify_source", "upsert_note", "upsert_claims",
    "run_experience_workflow", "upsert_draft", "upsert_draft_metadata", "run_figure_workflow",
    "prepare_review_exchange", "import_review_exchange", "verify_review_coverage",
    "normalize_rebuttal_issues", "build_rebuttal_strategy", "build_rebuttal",
    "create_version_snapshot", "compare_versions"
  ]) {
    assert.ok(byName.get(name).inputSchema.properties.missionId, `${name} missionId`);
  }
  assert.equal(Object.hasOwn(byName.get("verify_source").inputSchema.properties, "decision"), false);
  assert.equal(Object.hasOwn(byName.get("run_figure_workflow").inputSchema.properties, "providerId"), false);
  assert.equal(MUTATING_TOOL_NAMES.has("query_dove_status"), false);
  assert.equal(MUTATING_TOOL_NAMES.has("query_dove_lessons"), false);
  assert.equal(MUTATING_TOOL_NAMES.has("record_dove_lesson"), true);
  assert.equal(MUTATING_TOOL_NAMES.has("create_dove_mission"), true);
});

test("MCP stdio server lists the exact registry and rejects discovery tiers", async () => {
  const root = createTempRoot("dove-mcp-stdio-");
  const client = createMcpStdioClient({ args: [SERVER], cwd: root });
  try {
    const initialized = await client.call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "schema-seven-test", version: "1.0.0" }
    });
    assert.equal(initialized.serverInfo.name, "dove");
    client.notify("notifications/initialized");

    const listed = await client.call("tools/list");
    assert.deepEqual(listed.tools.map((tool) => tool.name), EXPECTED_TOOL_NAMES);
    await assert.rejects(client.call("tools/list", { surface: "operator" }), /does not accept unknown input.*\$\.surface/u);

    const statusResult = await client.call("tools/call", {
      name: "query_dove_status",
      arguments: { resultMode: "full" }
    });
    const status = extractToolJson(statusResult);
    assert.equal(status.scope.state, "absent");
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);
  } finally {
    client.kill();
    cleanupTempRoot(root);
  }
});

test("materialized mission status scopes one mission and multiple missions require explicit selection", () => {
  const root = createTempRoot("dove-mcp-status-current-");
  materializeMission(root, "status-current");
  const status = extractToolJson(dispatchTool(root, "query_dove_status", { full: true, resultMode: "full" }));
  assert.equal(status.currentContext.missionCount, 1);
  assert.equal(status.currentContext.missionScope, "only-mission");
  assert.equal(status.missions[0].missionId, "status-current");
  assert.equal(status.diagnostics.noRefresh, true);
  assert.equal(status.diagnostics.noSourceMutation, true);
  materializeMission(root, "status-second");
  const afterMissions = snapshot(root);
  const multiple = extractToolJson(dispatchTool(root, "query_dove_status", { resultMode: "full" }));
  assert.equal(multiple.currentContext.missionScope, "workspace");
  assert.equal(multiple.currentContext.selectedMissionId, null);
  assert.equal(multiple.needsAttention.status, "mission-selection-required");
  assert.ok(multiple.needsAttention.reasons.includes("explicit-mission-required"));
  const explicit = extractToolJson(dispatchTool(root, "query_dove_status", { missionId: "status-current", resultMode: "full" }));
  assert.equal(explicit.currentContext.missionScope, "explicit");
  assert.equal(explicit.currentContext.selectedMissionId, "status-current");
  assert.deepEqual(snapshot(root), afterMissions);
  cleanupTempRoot(root);
});
