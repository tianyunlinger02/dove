#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  GOVERNANCE_EXEMPT_MUTATIONS,
  GOVERNANCE_GUARDED_MUTATIONS,
  GOVERNANCE_READONLY_TOOLS
} from "../src/core/schema.mjs";
import { dispatchTool } from "../src/mcp/handlers.mjs";
import {
  TOOL_INPUT_PROPERTY_NAMES,
  TOOL_INPUT_SCHEMAS,
  toolDefinitions
} from "../src/mcp/tool-definitions.mjs";

const ROOT = process.cwd();
const SCRATCH_ROOT = path.join(ROOT, ".tmp");
const PRIVATE_HOST_CONTROL_FIELDS = [
  "resultMode", "mutationMode", "confirmed", "proposalVersion", "proposalWorkspace", "proposalDigest",
  "proposalToken", "workspaceId"
];

const DELETED_TOOL_NAMES = [
  "record_dove_mission_pass",
  "apply_dove_status_adjustments",
  "run_dove_auto",
  "run_dove_operator",
  "kill_dove_task",
  "run_dove_review_loop",
  "prepare_isolated_review",
  "import_isolated_review",
  "run_isolated_review",
  "prepare_audio_review",
  "import_audio_review",
  "run_audio_review",
  "launch_dove_mission",
  "query_program_approvals",
  "query_campaigns",
  "query_operator_follow_through",
  "record_operator_follow_through",
  "query_operator_lessons",
  "record_operator_lesson",
  "plan_campaign",
  "revoke_program_approval",
  "materialize_guidance_packet",
  "issue_program_approval",
  "run_autonomy_once",
  "run_autonomy_foreground",
  "run_autonomy_operate",
  "query_dove_orchestrate",
  "query_dove_audit",
  "query_dove_return",
  "query_dove_mission_board",
  "query_paper_pipeline",
  "upsert_orchestration_board",
  "append_handoff"
];

function toolNames(tools) {
  return tools.map((tool) => tool.name);
}

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must not contain duplicates`);
}

function governanceBindings() {
  return [
    ...GOVERNANCE_GUARDED_MUTATIONS.flatMap((entry) => entry.surfaceBindings?.mcpTool
      ? [[entry.surfaceBindings.mcpTool, `guarded:${entry.id}`]]
      : []),
    ...GOVERNANCE_EXEMPT_MUTATIONS.flatMap((entry) => entry.surfaceBindings?.mcpTool
      ? [[entry.surfaceBindings.mcpTool, `exempt:${entry.id}`]]
      : []),
    ...GOVERNANCE_READONLY_TOOLS.map((name) => [name, "read-only"])
  ];
}

const fullNames = toolNames(toolDefinitions);
const fullNameSet = new Set(fullNames);

assertUnique(fullNames, "MCP tool registry");
assert.equal(fullNames.length, 28, "MCP tool registry must expose exactly 28 sealed tools");

for (const name of DELETED_TOOL_NAMES) {
  assert.equal(fullNameSet.has(name), false, `Deleted MCP tool ${name} must not remain in the registry`);
  assert.equal(TOOL_INPUT_SCHEMAS.has(name), false, `Deleted MCP tool ${name} must not retain an input schema`);
  assert.equal(TOOL_INPUT_PROPERTY_NAMES.has(name), false, `Deleted MCP tool ${name} must not retain input properties`);
}

const statusTool = toolDefinitions.find((tool) => tool.name === "query_dove_status");
assert.ok(statusTool, "query_dove_status must remain public");
const lessonQueryTool = toolDefinitions.find((tool) => tool.name === "query_dove_lessons");
const lessonRecordTool = toolDefinitions.find((tool) => tool.name === "record_dove_lesson");
assert.ok(lessonQueryTool, "query_dove_lessons must remain public");
assert.ok(lessonRecordTool, "record_dove_lesson must remain public");
assert.deepEqual(lessonQueryTool.inputSchema.properties.kind.enum, ["preference", "constraint", "method", "failure", "review-insight"]);
assert.deepEqual(lessonRecordTool.inputSchema.properties.kind.enum, ["preference", "constraint", "method", "failure", "review-insight"]);
for (const field of ["transcript", "runtime", "trellis", "authority", "completionEligible", "autoCapture", "autoRecall"]) {
  assert.equal(Object.hasOwn(lessonQueryTool.inputSchema.properties, field), false, `query_dove_lessons must not expose ${field}`);
  assert.equal(Object.hasOwn(lessonRecordTool.inputSchema.properties, field), false, `record_dove_lesson must not expose ${field}`);
}
assert.deepEqual(Object.keys(statusTool.inputSchema.properties).sort(), ["detail", "language", "missionId"]);
assert.deepEqual(statusTool.inputSchema.properties.detail.enum, ["compact", "full"]);
for (const tool of toolDefinitions) {
  for (const field of PRIVATE_HOST_CONTROL_FIELDS) {
    assert.equal(Object.hasOwn(tool.inputSchema.properties, field), false, `${tool.name} must not expose private ${field} control data`);
  }
}
const missionTool = toolDefinitions.find((tool) => tool.name === "create_dove_mission");
assert.deepEqual(missionTool.inputSchema.properties.operation.enum, ["create", "reevaluate-research-tree"]);
assert.equal(missionTool.inputSchema.properties.missionId.pattern, "^[a-z0-9][a-z0-9._-]{0,127}$");
assert.deepEqual(missionTool.inputSchema.required, ["missionId"]);
assert.equal(Object.hasOwn(missionTool.inputSchema, "allOf"), false, "create_dove_mission must remain discoverable by hosts that reject conditional tool schemas");
assert.deepEqual(
  Object.keys(missionTool.inputSchema.properties.nodeUpdates.items.properties).sort(),
  [
    "blockedReasonCode", "nodeId", "outcomeEvidenceRefs", "outcomeSummary", "parentNodeId", "questionOrHypothesis",
    "status", "successOrStopCriterion", "workDescription", "workKind"
  ]
);
assert.equal(missionTool.inputSchema.properties.nodeUpdates.items.additionalProperties, false);
const versionTool = toolDefinitions.find((tool) => tool.name === "create_version_snapshot");
assert.equal(Object.hasOwn(versionTool.inputSchema.properties, "finalize"), false, "create_version_snapshot must not expose finalize");
const closureTool = toolDefinitions.find((tool) => tool.name === "close_host_outcome");
assert.ok(closureTool, "close_host_outcome must remain MCP-only");
assert.deepEqual(Object.keys(closureTool.inputSchema.properties).sort(), ["artifactPaths", "missionId", "summary", "validationPaths"]);
for (const field of ["receiptId", "contractDigest", "producedAt", "sha256", "criteriaSatisfied", "taskId", "sessionId"]) {
  assert.equal(Object.hasOwn(closureTool.inputSchema.properties, field), false, `close_host_outcome must not expose ${field}`);
}

const classifications = new Map(toolDefinitions.map((tool) => [tool.name, []]));
for (const [name, binding] of governanceBindings()) {
  assert.equal(fullNameSet.has(name), true, `Governance references undefined MCP tool ${name}`);
  classifications.get(name).push(binding);
}
for (const [name, bindings] of classifications) {
  assert.equal(bindings.length, 1, `${name} must have exactly one governance classification: ${bindings.join(", ")}`);
}

fs.mkdirSync(SCRATCH_ROOT, { recursive: true });
for (const name of DELETED_TOOL_NAMES) {
  const root = fs.mkdtempSync(path.join(SCRATCH_ROOT, `validate-mcp-${name}-`));
  try {
    const result = dispatchTool(root, name, {});
    assert.equal(result.isError, true, `${name} direct dispatch must fail`);
    assert.equal(result.content?.[0]?.text ?? "", "Unknown tool: The requested action");
    assert.equal(fs.existsSync(path.join(root, ".dove")), false, `${name} must not create workspace state`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

console.log(JSON.stringify({
  status: "passed",
  toolCount: fullNames.length,
  deletedToolsChecked: DELETED_TOOL_NAMES.length,
  governanceBindingsChecked: classifications.size,
  privateHostControlsHidden: toolDefinitions.length * PRIVATE_HOST_CONTROL_FIELDS.length
}, null, 2));
