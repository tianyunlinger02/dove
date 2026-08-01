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
  TOOL_INPUT_SCHEMAS,
  TOOL_OPERATION_SCHEMAS,
  toolDefinitions
} from "../src/mcp/tool-definitions.mjs";

const ROOT = process.cwd();
const SCRATCH_ROOT = path.join(ROOT, ".tmp");
const PRIVATE_HOST_CONTROL_FIELDS = [
  "resultMode", "mutationMode", "confirmed", "proposalVersion", "proposalWorkspace", "proposalDigest",
  "proposalToken", "workspaceId"
];

const EXPECTED_TOOL_NAMES = [
  "manage_dove_workspace",
  "manage_dove_mission",
  "query_dove_status",
  "manage_dove_sources",
  "record_dove_experiment",
  "record_dove_claims",
  "record_dove_draft",
  "record_dove_figure",
  "manage_dove_review",
  "record_dove_rebuttal",
  "manage_dove_lessons",
  "create_ambient_dove_mission",
  "close_host_outcome",
  "record_research_outcome"
];

const RETIRED_TOOL_NAMES = [
  "create_dove_mission",
  "query_dove_mission",
  "ingest_execution_receipt",
  "assess_mission_completion",
  "query_sources",
  "register_source",
  "verify_source",
  "query_dove_lessons",
  "record_dove_lesson",
  "upsert_claims",
  "run_experience_workflow",
  "upsert_draft",
  "run_figure_workflow",
  "prepare_review_exchange",
  "import_review_exchange",
  "verify_review_coverage",
  "normalize_rebuttal_issues",
  "build_rebuttal_strategy",
  "build_rebuttal",
  "upsert_draft_metadata",
  "write_dove_draft",
  "run_dove_figure",
  "build_dove_rebuttal",
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
  "append_handoff",
  "search_network",
  "query_network_search_providers",
  "upsert_note",
  "create_version_snapshot",
  "compare_versions"
];

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must not contain duplicates`);
}

function assertSealedObjects(schema, location, seen = new WeakSet()) {
  if (!schema || typeof schema !== "object" || seen.has(schema)) return;
  seen.add(schema);
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.includes("object") && schema.properties) {
    assert.equal(schema.additionalProperties, false, `${location} must reject unknown properties`);
  }
  for (const [key, value] of Object.entries(schema)) {
    if (key === "properties") {
      for (const [field, fieldSchema] of Object.entries(value ?? {})) assertSealedObjects(fieldSchema, `${location}.properties.${field}`, seen);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => assertSealedObjects(item, `${location}.${key}[${index}]`, seen));
    } else {
      assertSealedObjects(value, `${location}.${key}`, seen);
    }
  }
}

function governanceBindings() {
  const mutations = [...GOVERNANCE_GUARDED_MUTATIONS, ...GOVERNANCE_EXEMPT_MUTATIONS].flatMap((entry) => {
    const tool = entry.surfaceBindings?.mcpTool;
    if (!tool) return [];
    const operations = entry.surfaceBindings.mcpOperations;
    return operations === null
      ? [[`${tool}:*`, `mutation:${entry.id}`]]
      : operations.map((operation) => [`${tool}:${operation}`, `mutation:${entry.id}`]);
  });
  const reads = GOVERNANCE_READONLY_TOOLS.flatMap((entry) => entry.operations.map((operation) => [`${entry.mcpTool}:${operation}`, "read-only"]));
  return [...mutations, ...reads];
}

const fullNames = toolDefinitions.map((tool) => tool.name);
const fullNameSet = new Set(fullNames);
assertUnique(fullNames, "MCP tool registry");
assert.deepEqual(fullNames, EXPECTED_TOOL_NAMES, "MCP discovery must expose exactly the canonical 14-tool inventory");
assert.deepEqual([...TOOL_INPUT_SCHEMAS.keys()], EXPECTED_TOOL_NAMES);

for (const name of RETIRED_TOOL_NAMES) {
  assert.equal(fullNameSet.has(name), false, `Retired MCP tool ${name} must not remain discoverable`);
  assert.equal(TOOL_INPUT_SCHEMAS.has(name), false, `Retired MCP tool ${name} must not retain a public input schema`);
}

for (const tool of toolDefinitions) {
  assert.equal(tool.inputSchema.type, "object", `${tool.name} needs a flat top-level object schema`);
  assert.equal(tool.inputSchema.additionalProperties, false, `${tool.name} must reject unknown top-level fields`);
  assert.equal(Object.hasOwn(tool.inputSchema, "oneOf"), false, `${tool.name} must not expose top-level oneOf`);
  assert.equal(Object.hasOwn(tool.inputSchema, "allOf"), false, `${tool.name} must not expose top-level allOf`);
  assertSealedObjects(tool.inputSchema, `${tool.name}.inputSchema`);
  for (const field of PRIVATE_HOST_CONTROL_FIELDS) {
    assert.equal(Object.hasOwn(tool.inputSchema.properties, field), false, `${tool.name} must not expose private ${field} control data`);
  }
}

const operationEnums = Object.fromEntries(toolDefinitions.flatMap((tool) => {
  const values = tool.inputSchema.properties?.operation?.enum;
  return Array.isArray(values) ? [[tool.name, values]] : [];
}));
assert.deepEqual(operationEnums, {
  manage_dove_workspace: ["set-mainline", "initialize"],
  manage_dove_mission: ["query", "start-skill", "reevaluate-research-decision", "create-root", "branch"],
  query_dove_status: ["status", "completion"],
  manage_dove_sources: ["query", "register", "reject"],
  manage_dove_review: ["scope", "archive"],
  manage_dove_lessons: ["read", "update"]
});
for (const [name, operations] of Object.entries(operationEnums)) {
  const branches = TOOL_OPERATION_SCHEMAS.get(name);
  assert.ok(Array.isArray(branches) && branches.length >= operations.length, `${name} needs internal validation coverage for every canonical operation`);
  assert.deepEqual([...new Set(branches.map((branch) => branch.properties.operation.const))], operations);
  for (const branch of branches) {
    assert.equal(branch.required.includes("operation"), true, `${name}.${branch.properties.operation.const} must require operation`);
  }
}

const ambientMissionTool = toolDefinitions.find((tool) => tool.name === "create_ambient_dove_mission");
assert.deepEqual(ambientMissionTool.inputSchema.required, ["mode", "goal", "mainlineAlignment", "changesWorkspaceMainline"]);
assert.deepEqual(ambientMissionTool.inputSchema.properties.mode.enum, ["ordinary", "research"]);
const missionTool = toolDefinitions.find((tool) => tool.name === "manage_dove_mission");
for (const privateField of ["missionId", "parentMissionId", "dependsOnMissionIds", "decisionRevision", "consumedReceiptIds", "decisionBudget", "routing", "contextArtifactCount", "currentResearchDecision", "executionHandoff"]) {
  assert.equal(Object.hasOwn(missionTool.inputSchema.properties, privateField), false, `manage_dove_mission must not expose ${privateField}`);
}
assert.deepEqual(missionTool.inputSchema.properties.mode.enum, ["ordinary", "research"]);
const lessonsTool = toolDefinitions.find((tool) => tool.name === "manage_dove_lessons");
assert.deepEqual(Object.keys(lessonsTool.inputSchema.properties).sort(), ["binding", "markdown", "operation"]);
for (const field of ["missionNumber", "lessonId", "scope", "kind", "tags", "supersedesLessonId", "transcript", "runtime", "trellis", "authority", "completionEligible", "autoCapture", "autoRecall"]) {
  assert.equal(Object.hasOwn(lessonsTool.inputSchema.properties, field), false, `manage_dove_lessons must not expose ${field}`);
}
const closureTool = toolDefinitions.find((tool) => tool.name === "close_host_outcome");
assert.deepEqual(closureTool.inputSchema.required, ["missionNumber", "attemptId", "status", "summary"]);
const researchOutcomeTool = toolDefinitions.find((tool) => tool.name === "record_research_outcome");
assert.deepEqual(researchOutcomeTool.inputSchema.required, ["missionNumber", "decisionRevision", "attemptId", "status", "performedActionCount", "actualUsage", "evidenceReturned", "artifactPaths", "validationPaths", "facts", "startedAt", "finishedAt"]);

const classificationMap = new Map();
for (const [key, binding] of governanceBindings()) {
  const current = classificationMap.get(key) ?? [];
  current.push(binding);
  classificationMap.set(key, current);
}
for (const tool of toolDefinitions) {
  const operations = operationEnums[tool.name];
  const keys = operations ? operations.map((operation) => `${tool.name}:${operation}`) : [`${tool.name}:*`];
  for (const key of keys) {
    const bindings = classificationMap.get(key) ?? classificationMap.get(`${tool.name}:*`) ?? [];
    assert.equal(bindings.length, 1, `${key} must have exactly one operation-level governance classification: ${bindings.join(", ")}`);
  }
}
for (const key of classificationMap.keys()) {
  assert.equal(fullNameSet.has(key.split(":", 1)[0]), true, `Governance references undefined MCP tool operation ${key}`);
}

fs.mkdirSync(SCRATCH_ROOT, { recursive: true });
for (const name of RETIRED_TOOL_NAMES) {
  const root = fs.mkdtempSync(path.join(SCRATCH_ROOT, `validate-mcp-${name}-`));
  try {
    const result = await dispatchTool(root, name, {});
    assert.equal(result.isError, true, `${name} direct dispatch must fail`);
    assert.equal(fs.existsSync(path.join(root, ".dove")), false, `${name} must not create workspace state`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const skillRoot = fs.mkdtempSync(path.join(SCRATCH_ROOT, "validate-mcp-start-skill-"));
try {
  const initialized = await dispatchTool(skillRoot, "manage_dove_workspace", {
    operation: "set-mainline",
    projectBrief: "A bounded MCP validation workspace.",
    mainline: "Validate direct Skill Mission targeting"
  });
  assert.notEqual(initialized.isError, true, initialized.content?.[0]?.text);
  const started = await dispatchTool(skillRoot, "manage_dove_mission", {
    operation: "start-skill",
    skill: "source",
    goal: "Query current source candidates through the newly started Skill Mission."
  });
  assert.notEqual(started.isError, true, started.content?.[0]?.text);
  const envelope = started.structuredContent;
  assert.deepEqual(envelope.selector, { missionNumber: 1 }, "Skill start must return its exact public selector");
  assert.equal(Object.hasOwn(envelope.report, "missionNumber"), false, "The human report must not carry routing fields");
  assert.ok(envelope.researchHandoff, "A root Skill Mission must preserve its research handoff");
  assert.equal(envelope.hostControl.closureRequest.tool, "record_research_outcome");
  assert.deepEqual(envelope.hostControl.closureRequest.boundArgs, { missionNumber: 1, decisionRevision: 1 });
  assert.doesNotMatch(JSON.stringify(envelope), /mission-[a-z0-9._-]+|parentMissionId|contextArtifactCount|"routing"/u);

  const domainResult = await dispatchTool(skillRoot, "manage_dove_sources", {
    operation: "query",
    missionNumber: envelope.selector.missionNumber
  });
  assert.notEqual(domainResult.isError, true, domainResult.content?.[0]?.text);
  assert.equal(domainResult.structuredContent.report.status, "empty");
} finally {
  fs.rmSync(skillRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  status: "passed",
  toolCount: fullNames.length,
  retiredToolsChecked: RETIRED_TOOL_NAMES.length,
  operationBranchesChecked: Object.values(operationEnums).flat().length,
  privateHostControlsHidden: toolDefinitions.length * PRIVATE_HOST_CONTROL_FIELDS.length
}, null, 2));
