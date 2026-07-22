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
import { TOOL_INTERACTION_CONTRACTS } from "../../src/core/command-manifest.mjs";
import { dispatchTool } from "../../src/mcp/handlers.mjs";
import {
  MUTATING_TOOL_NAMES,
  TOOL_INPUT_PROPERTY_NAMES,
  TOOL_INPUT_SCHEMAS,
  toolDefinitions
} from "../../src/mcp/tool-definitions.mjs";
import { createMcpStdioClient } from "../../scripts/mcp-stdio-client.mjs";
import { assertNoCompactPublicLeaks } from "../helpers/compact-public.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

const ROOT = process.cwd();
const SERVER = path.join(ROOT, "mcp", "dove-state-server.mjs");

const EXPECTED_TOOL_NAMES = [
  "init_dove_goal",
  "create_dove_mission",
  "query_dove_mission",
  "query_dove_status",
  "ingest_execution_receipt",
  "close_host_outcome",
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

const RETIRED_PUBLIC_CONTROL_FIELDS = [
  "resultMode",
  "mutationMode",
  "confirmed",
  "confirm",
  "confirmArgs",
  "proposalVersion",
  "proposalWorkspace",
  "proposalDigest",
  "proposalToken",
  "workspaceId"
];

const PUBLIC_RESULT_KEYS = new Set([
  "status", "operation", "query", "proposalOnly", "noAutoApply", "detailsAvailable", "zeroWrite",
  "complete", "policy", "inputBoundary", "message", "approval", "mission", "current", "attention",
  "candidates", "providers", "sources", "lessons", "completion", "changes", "authority", "continuation",
  "gaps", "artifacts", "verification", "outcome", "review"
]);
const PUBLIC_STATUS_CURRENT_KEYS = new Set(["missionCount", "missionScope", "sourceCount", "integrity", "review", "researchTree"]);
const PUBLIC_STATUS_INTEGRITY_KEYS = new Set(["status", "complete", "gaps"]);
const PUBLIC_STATUS_RESEARCH_TREE_KEYS = new Set(["nodeCount", "statusCounts"]);
const PUBLIC_STATUS_ATTENTION_KEYS = new Set(["status", "summary", "reasons"]);

function extractToolJson(result) {
  assert.ok(result.content?.[0]?.text, "Expected MCP text content");
  assert.notEqual(result.isError, true, result.content[0].text);
  return JSON.parse(result.content[0].text);
}

async function callTool(root, name, args = {}, options = {}) {
  return extractToolJson(await dispatchTool(root, name, args, options));
}

function assertOnlyKeys(value, allowed, label) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  for (const key of Object.keys(value)) assert.equal(allowed.has(key), true, `${label} exposed non-public key ${key}`);
}

function assertPublicResult(result) {
  assertOnlyKeys(result, PUBLIC_RESULT_KEYS, "MCP result");
  assertNoCompactPublicLeaks(result);
}

function assertPublicStatus(status) {
  assertPublicResult(status);
  assertOnlyKeys(status.current, PUBLIC_STATUS_CURRENT_KEYS, "status.current");
  if (status.current.integrity) assertOnlyKeys(status.current.integrity, PUBLIC_STATUS_INTEGRITY_KEYS, "status.current.integrity");
  if (status.current.researchTree) assertOnlyKeys(status.current.researchTree, PUBLIC_STATUS_RESEARCH_TREE_KEYS, "status.current.researchTree");
  assertOnlyKeys(status.attention, PUBLIC_STATUS_ATTENTION_KEYS, "status.attention");
}

function assertPublicCompletion(completion) {
  assertPublicResult(completion);
  assert.equal(Object.hasOwn(completion, "dependencyCoverage"), false);
  assert.equal(Object.hasOwn(completion, "contributingReceiptIds"), false);
}

function assertPublicApproval(approval) {
  assertOnlyKeys(approval, new Set(["required", "noChangesApplied", "summary", "effects", "question"]), "checkpoint approval");
  assert.equal(approval.required, true);
  assert.equal(approval.noChangesApplied, true);
  assertNoCompactPublicLeaks(approval);
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

async function materializeMission(root, missionId = "mcp-schema-nine", overrides = {}) {
  let approvalCalls = 0;
  const created = await callTool(root, "create_dove_mission", {
    missionId,
    goal: "Exercise the sealed schema 9 MCP contract.",
    targetArtifacts: ["README.md"],
    expectedArtifacts: ["README.md"],
    completionCriteria: ["The approved artifact is current."],
    evidenceRequirements: ["artifact:README.md"],
    ...overrides
  }, {
    requestCheckpointApproval: async (approval) => {
      approvalCalls += 1;
      assertPublicApproval(approval);
      return "accept";
    }
  });
  assert.equal(approvalCalls, 1);
  assert.equal(created.status, "materialized");
  assertPublicResult(created);
  return created;
}

test("schema 9 MCP exposes one sealed lightweight registry", () => {
  assert.deepEqual(toolDefinitions.map((tool) => tool.name), EXPECTED_TOOL_NAMES);
  assert.equal(new Set(EXPECTED_TOOL_NAMES).size, EXPECTED_TOOL_NAMES.length);
  assert.deepEqual([...TOOL_INPUT_SCHEMAS.keys()], EXPECTED_TOOL_NAMES);
  assert.deepEqual([...TOOL_INPUT_PROPERTY_NAMES.keys()], EXPECTED_TOOL_NAMES);

  assert.deepEqual(toolDefinitions.find((tool) => tool.name === "query_dove_lessons").inputSchema.properties.kind.enum, ["preference", "constraint", "method", "failure", "review-insight"]);
  assert.deepEqual(toolDefinitions.find((tool) => tool.name === "record_dove_lesson").inputSchema.properties.kind.enum, ["preference", "constraint", "method", "failure", "review-insight"]);
  const missionTool = toolDefinitions.find((tool) => tool.name === "create_dove_mission");
  assert.deepEqual(missionTool.inputSchema.required, ["missionId"]);
  assert.equal(Object.hasOwn(missionTool.inputSchema, "allOf"), false);

  const statusProperties = toolDefinitions.find((tool) => tool.name === "query_dove_status").inputSchema.properties;
  assert.ok(statusProperties.missionId);
  assert.deepEqual(statusProperties.detail.enum, ["compact", "full"]);
  assert.deepEqual(statusProperties.language.enum, ["zh", "en"]);
  for (const retired of ["intent", "view", "full", "includeDetails", "showMissions", "includeMissionDetails"]) {
    assert.equal(Object.hasOwn(statusProperties, retired), false, `query_dove_status must not expose ${retired}`);
  }

  for (const tool of toolDefinitions) {
    assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
    assertSchemaObjectsSealed(tool.inputSchema);
    for (const retired of [
      ...RETIRED_PUBLIC_CONTROL_FIELDS,
      "packetId", "taskPacketId", "assignedRole", "nextAction", "route", "queue", "lease", "campaignId",
      "continuationId", "policyOverrideReason"
    ]) {
      assert.equal(Object.hasOwn(tool.inputSchema.properties, retired), false, `${tool.name} must not expose ${retired}`);
    }
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
    assert.equal(result.content[0].text, "Unknown tool: The requested action");
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);
    cleanupTempRoot(root);
  }
});

test("read-only mission preview and status use only the public allowlist and remain zero-write", async () => {
  const root = createTempRoot("dove-mcp-readonly-");
  try {
    const before = snapshot(root);
    const preview = await callTool(root, "query_dove_mission", { goal: "Preview without durable state." });
    assertPublicResult(preview);
    assert.equal(preview.status, "proposal");
    assert.deepEqual(Object.keys(preview.mission).sort(), ["artifacts", "completionCriteria", "evidenceRequirements", "goal", "outOfScope", "scope"]);

    const status = await callTool(root, "query_dove_status");
    assertPublicStatus(status);
    assert.equal(status.current.missionCount, 0);
    assert.equal(status.attention.status, "needs-init");
    assert.deepEqual(snapshot(root), before);

    for (const args of [{ board: true }, { resultMode: "full" }]) {
      const rejected = await dispatchTool(root, "query_dove_status", args);
      assert.equal(rejected.isError, true);
      if (Object.hasOwn(args, "resultMode")) {
        assert.equal(rejected.content[0].text, "The requested action could not complete because recorded internal state is unavailable or no longer current.");
      } else {
        assert.match(rejected.content[0].text, /does not accept unknown input/u);
      }
      assert.deepEqual(snapshot(root), before);
    }
  } finally {
    cleanupTempRoot(root);
  }
});

test("MCP lesson query is zero-write and lesson recording is one ordinary write call", async () => {
  const root = createTempRoot("dove-mcp-lessons-");
  try {
    await materializeMission(root, "mcp-lessons");
    const before = snapshot(root);

    const query = await callTool(root, "query_dove_lessons", { missionId: "mcp-lessons" });
    assertPublicResult(query);
    assert.equal(query.status, "empty");
    assert.deepEqual(query.lessons, []);
    assert.deepEqual(snapshot(root), before);

    let approvalCalls = 0;
    const recorded = await callTool(root, "record_dove_lesson", {
      missionId: "mcp-lessons",
      lessonId: "mcp-lesson-one",
      scope: "mission",
      kind: "method",
      summary: "Keep MCP lesson recording exact.",
      nextTimeGuidance: ["Use one ordinary write call."],
      sourceIds: [],
      noteIds: [],
      artifactRefs: [],
      appliesToArtifactRefs: [],
      tags: ["mcp"]
    }, { requestCheckpointApproval: async () => { approvalCalls += 1; return "accept"; } });
    assert.equal(approvalCalls, 0);
    assert.equal(recorded.status, "recorded");
    assertPublicResult(recorded);
    assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.lessonsDir, "mcp-lesson-one.json")), true);
  } finally {
    cleanupTempRoot(root);
  }
});

test("MCP init checkpoint elicits once and applies only after acceptance", async () => {
  const root = createTempRoot("dove-mcp-init-checkpoint-");
  try {
    const before = snapshot(root);
    let declinedApprovals = 0;
    const declined = await callTool(root, "init_dove_goal", { goal: "Plan project initialization." }, {
      requestCheckpointApproval: async (approval) => {
        declinedApprovals += 1;
        assertPublicApproval(approval);
        assert.deepEqual(approval.effects, ["Create minimal Dove project records.", "Save the current project goal."]);
        return "decline";
      }
    });
    assert.equal(declinedApprovals, 1);
    assert.equal(declined.status, "declined");
    assertPublicResult(declined);
    assert.deepEqual(snapshot(root), before);

    let acceptedApprovals = 0;
    const initialized = await callTool(root, "init_dove_goal", { goal: "Plan project initialization." }, {
      requestCheckpointApproval: async (approval) => {
        acceptedApprovals += 1;
        assertPublicApproval(approval);
        return "accept";
      }
    });
    assert.equal(acceptedApprovals, 1);
    assert.equal(initialized.status, "initialized");
    assertPublicResult(initialized);
    assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.doveRootManifest)), true);
    assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.projectIdentity)), true);
  } finally {
    cleanupTempRoot(root);
  }
});

test("MCP archive reset checkpoint remains zero-write when declined", async () => {
  const root = createTempRoot("dove-mcp-reset-checkpoint-");
  try {
    fs.mkdirSync(path.join(root, ".dove"));
    fs.writeFileSync(path.join(root, ".dove", "state.json"), "{\"version\":6}\n");
    const before = snapshot(root);
    let approvalCalls = 0;
    const result = await callTool(root, "init_dove_goal", {
      goal: "Replace invalid project records.",
      archiveReset: true
    }, {
      requestCheckpointApproval: async (approval) => {
        approvalCalls += 1;
        assertPublicApproval(approval);
        assert.ok(approval.effects.includes("Archive the invalid Dove project records."));
        return "decline";
      }
    });
    assert.equal(approvalCalls, 1);
    assert.equal(result.status, "declined");
    assertPublicResult(result);
    assert.deepEqual(snapshot(root), before);
  } finally {
    cleanupTempRoot(root);
  }
});

test("MCP mission checkpoint persists the minimal contract in one accepted call", async () => {
  const root = createTempRoot("dove-mcp-mission-checkpoint-");
  try {
    const before = snapshot(root);
    const declined = await callTool(root, "create_dove_mission", {
      missionId: "declined-mission",
      goal: "Do not persist this mission."
    }, { requestCheckpointApproval: async () => "decline" });
    assert.equal(declined.status, "declined");
    assertPublicResult(declined);
    assert.deepEqual(snapshot(root), before);

    await materializeMission(root, "accepted-mission", {
      goal: "Persist only this approved mission contract.",
      scope: ["schema 9 MCP"],
      targetArtifacts: ["README.md"],
      completionCriteria: ["README is current"]
    });
    const persisted = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.missionsDir, "accepted-mission.json"), "utf8"));
    assert.equal(persisted.missionId, "accepted-mission");
    assert.equal(Object.hasOwn(persisted, "executionHandoff"), false);
    assert.deepEqual(Object.keys(snapshot(root)).sort(), [
      ARTIFACT_PATHS.doveRootManifest,
      `${ARTIFACT_PATHS.missionsDir}/accepted-mission.json`,
      ARTIFACT_PATHS.projectIdentity
    ].sort());
    assert.equal(fs.existsSync(path.join(root, ".dove", "state.json")), false);
    assert.equal(fs.existsSync(path.join(root, ".dove", "task-packets")), false);
  } finally {
    cleanupTempRoot(root);
  }
});

test("MCP receipt ingestion is one ordinary write call with a public completion summary", async () => {
  const root = createTempRoot("dove-mcp-receipt-single-call-");
  try {
    fs.writeFileSync(path.join(root, "README.md"), "committed MCP receipt artifact\n", "utf8");
    await materializeMission(root, "mcp-receipt-single-call");
    const missionPath = path.join(root, ARTIFACT_PATHS.missionsDir, "mcp-receipt-single-call.json");
    const mission = JSON.parse(fs.readFileSync(missionPath, "utf8"));
    const receiptArgs = {
      receiptId: "mcp-receipt-current",
      missionId: mission.missionId,
      contractDigest: mission.contractDigest,
      summary: "Recorded the current MCP artifact.",
      artifacts: [{ path: "README.md", kind: "document", sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "README.md"))).digest("hex") }],
      validations: [],
      criteriaSatisfied: mission.completionCriterionIds.map((criterionId) => ({ criterionId, evidenceRefs: ["artifact:README.md"] })),
      producedAt: "2026-07-16T00:00:00.000Z"
    };

    const ingested = await callTool(root, "ingest_execution_receipt", receiptArgs);
    assert.equal(ingested.status, "ingested");
    assert.equal(ingested.completion.status, "complete");
    assert.equal(ingested.completion.complete, true);
    assert.deepEqual(ingested.completion.gaps, []);
    assert.deepEqual(ingested.completion.artifacts, [{ path: "README.md", covered: true }]);
    assertPublicCompletion(ingested);
    assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir, "mcp-receipt-current.json")), true);

    const lockPath = path.join(root, ".dove", ".receipt-ledger-append.lock");
    fs.writeFileSync(lockPath, "occupied\n", "utf8");
    const failed = await dispatchTool(root, "ingest_execution_receipt", { ...receiptArgs, receiptId: "mcp-receipt-failed" });
    assert.equal(failed.isError, true);
    assert.doesNotMatch(failed.content[0].text, /completion|assessment/u);
    assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir, "mcp-receipt-failed.json")), false);
    fs.rmSync(lockPath);
  } finally {
    cleanupTempRoot(root);
  }
});

test("MCP host outcome closure uses four public fields and normalizes workspace paths", async () => {
  const root = createTempRoot("dove-mcp-host-outcome-");
  const missionId = "mcp-host-outcome";
  try {
    fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
    fs.writeFileSync(path.join(root, "outputs", "result.md"), "host outcome\n", "utf8");
    const created = await materializeMission(root, missionId, {
      goal: "Record a host-produced result.",
      targetArtifacts: ["outputs/result.md"]
    });
    assert.equal(JSON.stringify(created).includes(missionId), false);
    const closureTool = toolDefinitions.find((tool) => tool.name === "close_host_outcome");
    assert.deepEqual(Object.keys(closureTool.inputSchema.properties).sort(), ["artifactPaths", "missionId", "summary", "validationPaths"]);
    const result = await callTool(root, "close_host_outcome", {
      missionId,
      summary: "Recorded the host-produced result.",
      artifactPaths: [path.join(root, "outputs", "result.md")]
    });
    assert.equal(result.status, "ingested");
    assert.deepEqual(result.artifacts, [{ path: "outputs/result.md", kind: "other" }]);
    assert.equal(result.completion.complete, false);
    assertNoCompactPublicLeaks(result);

    const beforeRepeat = snapshot(root);
    const repeated = await callTool(root, "close_host_outcome", {
      missionId,
      summary: "Do not duplicate the same evidence.",
      artifactPaths: ["outputs/result.md"]
    });
    assert.equal(repeated.status, "skipped");
    assert.equal(repeated.zeroWrite, true);
    assert.deepEqual(snapshot(root), beforeRepeat);

    const rejected = await dispatchTool(root, "close_host_outcome", {
      missionId,
      summary: "Reject caller authority.",
      artifactPaths: ["outputs/result.md"],
      receiptId: "caller-controlled"
    });
    assert.equal(rejected.isError, true);
    assert.equal(fs.readdirSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir)).length, 1);
  } finally {
    cleanupTempRoot(root);
  }
});

test("retired MCP replay and mutation controls are rejected without writes", async () => {
  const cases = [
    ["query_dove_status", { resultMode: "full" }, "resultMode"],
    ["create_dove_mission", { goal: "Reject mutation mode.", mutationMode: "direct-process" }, "mutationMode"],
    ["create_dove_mission", { goal: "Reject confirmation state.", confirmed: true }, "confirmed"],
    ["create_dove_mission", { goal: "Reject confirmation alias.", confirm: true }, "confirm"],
    ["create_dove_mission", { goal: "Reject replay arguments.", confirmArgs: {} }, "confirmArgs"],
    ["create_dove_mission", { goal: "Reject replay digest.", proposalDigest: "0".repeat(64) }, "proposalDigest"]
  ];
  for (const [name, args, field] of cases) {
    const root = createTempRoot(`dove-mcp-retired-${field}-`);
    try {
      const result = await dispatchTool(root, name, args);
      assert.equal(result.isError, true);
      assert.equal(result.content[0].text, "The requested action could not complete because recorded internal state is unavailable or no longer current.");
      assert.equal(fs.existsSync(path.join(root, ".dove")), false);
    } finally {
      cleanupTempRoot(root);
    }
  }
});

test("workspace path contracts distinguish locators and composite finding references", () => {
  assert.deepEqual(TOOL_INTERACTION_CONTRACTS.verify_source.pathFields, []);
  assert.equal(TOOL_INTERACTION_CONTRACTS.normalize_rebuttal_issues.pathFields.includes("issues[].findingRefs"), true);
  assert.equal(TOOL_INTERACTION_CONTRACTS.build_rebuttal.pathFields.includes("issues[].findingRefs"), true);
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

test("MCP stdio server lists the exact registry and uses elicitation for checkpoints", async () => {
  const root = createTempRoot("dove-mcp-stdio-");
  let elicitationCount = 0;
  const client = createMcpStdioClient({
    args: [SERVER],
    cwd: root,
    onRequest: async (method, params) => {
      elicitationCount += 1;
      assert.equal(method, "elicitation/create");
      assertOnlyKeys(params, new Set(["message", "requestedSchema"]), "elicitation request");
      assert.deepEqual(params.requestedSchema, { type: "object", properties: {}, additionalProperties: false });
      assertNoCompactPublicLeaks(params);
      return { action: "accept", content: {} };
    }
  });
  try {
    const initialized = await client.call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: { elicitation: {} },
      clientInfo: { name: "schema-nine-test", version: "1.0.0" }
    });
    assert.equal(initialized.protocolVersion, "2025-06-18");
    assert.equal(initialized.serverInfo.name, "dove");
    client.notify("notifications/initialized");

    const listed = await client.call("tools/list");
    assert.deepEqual(listed.tools.map((tool) => tool.name), EXPECTED_TOOL_NAMES);
    await assert.rejects(client.call("tools/list", { surface: "operator" }), /does not accept unknown input.*\$\.surface/u);
    await assert.rejects(client.call("tools/list", { resultMode: "full" }), /does not accept unknown input.*\$\.resultMode/u);

    const status = extractToolJson(await client.call("tools/call", { name: "query_dove_status", arguments: {} }));
    assertPublicStatus(status);
    assert.equal(status.current.missionCount, 0);
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);

    const checkpoint = extractToolJson(await client.call("tools/call", {
      name: "init_dove_goal",
      arguments: { goal: "Exercise stdio checkpoint elicitation." }
    }));
    assert.equal(elicitationCount, 1);
    assert.equal(checkpoint.status, "initialized");
    assertPublicResult(checkpoint);
  } finally {
    client.kill();
    cleanupTempRoot(root);
  }
});

test("public completion and status preserve lifecycle state without raw identifiers", async () => {
  const root = createTempRoot("dove-mcp-mission-lifecycle-");
  try {
    await materializeMission(root, "dependency-mission");
    await materializeMission(root, "dependent-mission", {
      goal: "Wait for the dependency mission.",
      dependsOnMissionIds: ["dependency-mission"],
      completionCriteria: [],
      evidenceRequirements: []
    });
    const dependent = await callTool(root, "assess_mission_completion", { missionId: "dependent-mission" });
    assertPublicCompletion(dependent);
    assert.equal(dependent.complete, false);
    assert.ok(dependent.completion.gaps.includes("A required earlier mission is not complete."));

    await materializeMission(root, "successor-mission", {
      goal: "Replace the dependency mission.",
      supersedesMissionId: "dependency-mission",
      completionCriteria: [],
      evidenceRequirements: []
    });
    await materializeMission(root, "terminal-mission", {
      goal: "Replace the intermediate successor mission.",
      supersedesMissionId: "successor-mission",
      completionCriteria: [],
      evidenceRequirements: []
    });
    const historical = await callTool(root, "query_dove_status", { missionId: "dependency-mission" });
    assertPublicStatus(historical);
    assert.equal(historical.current.integrity.status, "superseded");
    assert.equal(historical.attention.status, "superseded");
    assert.ok(historical.attention.reasons.includes("This mission has been superseded."));
    assert.equal(Object.hasOwn(historical, "nextStep"), false);
    assert.equal(Object.hasOwn(historical.attention, "stableGaps"), false);

    const blockedDependent = await callTool(root, "assess_mission_completion", { missionId: "dependent-mission" });
    assertPublicCompletion(blockedDependent);
    assert.ok(blockedDependent.completion.gaps.includes("A required earlier mission is not complete."));
  } finally {
    cleanupTempRoot(root);
  }
});

test("materialized status uses the public mission scope and remains zero-write", async () => {
  const root = createTempRoot("dove-mcp-status-current-");
  try {
    await materializeMission(root, "status-current");
    const status = await callTool(root, "query_dove_status", { detail: "full" });
    assertPublicStatus(status);
    assert.equal(status.current.missionCount, 1);
    assert.equal(status.current.missionScope, "only-mission");
    assert.equal(Object.hasOwn(status, "missions"), false);
    assert.equal(Object.hasOwn(status, "diagnostics"), false);

    await materializeMission(root, "status-second");
    const afterMissions = snapshot(root);
    const multiple = await callTool(root, "query_dove_status");
    assertPublicStatus(multiple);
    assert.equal(multiple.current.missionScope, "workspace");
    assert.equal(multiple.attention.status, "mission-selection-required");
    assert.ok(multiple.attention.reasons.includes("Choose a mission explicitly."));

    const explicit = await callTool(root, "query_dove_status", { missionId: "status-current" });
    assertPublicStatus(explicit);
    assert.equal(explicit.current.missionScope, "explicit");
    assert.equal(Object.hasOwn(explicit.current, "selectedMissionId"), false);
    assert.deepEqual(snapshot(root), afterMissions);
  } finally {
    cleanupTempRoot(root);
  }
});
