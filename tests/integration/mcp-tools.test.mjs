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
import { operationForTool } from "../../src/core/operation-registry.mjs";
import { initializeProjectIntegration } from "../../src/core/project-installation.mjs";
import { readCurrentResearchDecision } from "../../src/core/research-decision-store.mjs";
import { renderPublicReport } from "../../src/core/public-reports.mjs";
import { dispatchTool } from "../../src/mcp/handlers.mjs";
import { assertMcpInputSchema } from "../../src/mcp/schema-validation.mjs";
import {
  TOOL_INPUT_SCHEMAS,
  TOOL_OPERATION_SCHEMAS,
  toolDefinitions
} from "../../src/mcp/tool-definitions.mjs";
import { createMcpStdioClient } from "../../scripts/mcp-stdio-client.mjs";
import { assertNoCompactPublicLeaks } from "../helpers/compact-public.mjs";
import { initializeWorkspace } from "../helpers/current-schema-workspace.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

const ROOT = process.cwd();
const SERVER = path.join(ROOT, "mcp", "dove-state-server.mjs");
const PACKAGED_CLI = path.join(ROOT, "bin", "dove-package.mjs");

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

const DELETED_TOOL_NAMES = [
  "create_dove_mission", "query_dove_mission", "ingest_execution_receipt", "assess_mission_completion",
  "query_sources", "register_source", "verify_source", "query_dove_lessons", "record_dove_lesson",
  "upsert_claims", "run_experience_workflow", "upsert_draft", "run_figure_workflow",
  "prepare_review_exchange", "import_review_exchange", "verify_review_coverage",
  "normalize_rebuttal_issues", "build_rebuttal_strategy", "build_rebuttal",
  "write_dove_draft", "run_dove_figure", "build_dove_rebuttal",
  "upsert_draft_metadata",
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
  "search_network",
  "query_network_search_providers",
  "upsert_note",
  "create_version_snapshot",
  "compare_versions",
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
  "status", "operation", "detailsAvailable", "zeroWrite", "complete", "policy", "inputBoundary", "message", "approval", "mission", "markdown",
  "candidates", "providers", "sources", "completion", "changes", "authority", "artifacts", "verification", "outcome", "review",
  "executiveSummary", "currentSituation", "progress", "findings", "risksAndBlockers", "workStatus", "evidenceStatus", "operationalIntegrity", "partialCommit", "researchNarrative", "narrativeState", "recommendation", "nextActions", "technicalAppendix", "research", "experiment", "facts", "inferences", "recommendations", "unknowns", "projectBrief", "mainline"
]);
const PUBLIC_STATUS_SITUATION_KEYS = new Set(["scope", "trackedWorkstreams", "summary", "attentionRequired"]);
const PUBLIC_STATUS_PROGRESS_KEYS = new Set(["state", "completedItems", "inProgressItems", "blockedItems", "totalItems", "summary"]);
const PUBLIC_STATUS_WORK_KEYS = new Set(["state", "summary", "currentOutputCount", "currentOutputs", "returnStatus", "observationOnly"]);
const PUBLIC_STATUS_EVIDENCE_KEYS = new Set(["state", "summary", "currentEvidenceCount", "sourceCount", "review"]);
function extractToolEnvelope(result) {
  assert.notEqual(result.isError, true, result.content?.[0]?.text);
  assert.ok(result.structuredContent && typeof result.structuredContent === "object", "Expected public MCP structuredContent");
  assert.ok(result.structuredContent.report && result.structuredContent.hostControl, "Expected separated report and hostControl channels");
  const presentation = result.structuredContent.hostControl.presentation;
  assert.ok(presentation && typeof presentation === "object", "Expected public presentation policy");
  if (presentation.mode === "silent") {
    assert.deepEqual(result.content, [], "Silent results must not emit human MCP text");
  } else {
    assert.ok(result.content?.[0]?.text, "Expected human-readable MCP text content");
    const rendered = ["zh", "en"].map((language) => renderPublicReport(result.structuredContent.report, { language }));
    assert.equal(rendered.includes(result.content[0].text), true, "MCP text must come only from the human report renderer");
    assert.throws(() => JSON.parse(result.content[0].text), /Unexpected token|Unexpected non-whitespace|JSON/u, "MCP text must not be a raw JSON fallback");
  }
  return result.structuredContent;
}

async function callToolEnvelope(root, name, args = {}, options = {}) {
  return extractToolEnvelope(await dispatchTool(root, name, args, options));
}

async function callTool(root, name, args = {}, options = {}) {
  return (await callToolEnvelope(root, name, args, options)).report;
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
  for (const field of ["executiveSummary", "currentSituation", "progress", "findings", "risksAndBlockers", "workStatus", "evidenceStatus", "recommendation", "nextActions"]) {
    assert.equal(Object.hasOwn(status, field), true, `status needs ${field}`);
  }
  assertOnlyKeys(status.currentSituation, PUBLIC_STATUS_SITUATION_KEYS, "status.currentSituation");
  assertOnlyKeys(status.progress, PUBLIC_STATUS_PROGRESS_KEYS, "status.progress");
  assertOnlyKeys(status.workStatus, PUBLIC_STATUS_WORK_KEYS, "status.workStatus");
  assertOnlyKeys(status.evidenceStatus, PUBLIC_STATUS_EVIDENCE_KEYS, "status.evidenceStatus");
  assert.equal(Object.hasOwn(status, "maturity"), false);
  assert.equal(JSON.stringify(status).includes("production-readiness"), false);
  if (status.technicalAppendix) assert.equal(status.technicalAppendix.bounded, true);
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

async function materializeMission(root, missionLabel = "mcp-schema-17", overrides = {}) {
  initializeWorkspace(root);
  let approvalCalls = 0;
  const created = await callTool(root, "manage_dove_mission", {
    operation: overrides.operation ?? "create-root",
    mode: "ordinary",
    goal: "Exercise the sealed current-schema MCP contract.",
    artifacts: [{ path: "README.md", required: true, role: "output" }],
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
  const status = await callTool(root, "query_dove_status", { operation: "status", detail: "full" });
  const missionNumber = status.technicalAppendix.workstreams.items.find((item) => item.goal === (overrides.goal ?? "Exercise the sealed current-schema MCP contract."))?.number;
  assert.equal(Number.isSafeInteger(missionNumber), true, missionLabel);
  const missionFile = fs.readdirSync(path.join(root, ARTIFACT_PATHS.missionsDir))
    .map((file) => JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.missionsDir, file), "utf8")))
    .find((mission) => mission.goal === (overrides.goal ?? "Exercise the sealed current-schema MCP contract."));
  return { created, missionNumber, mission: missionFile };
}

test("MCP human output defaults to Chinese and preserves explicit English", async () => {
  const root = createTempRoot("dove-mcp-language-");
  try {
    const defaultLanguage = await dispatchTool(root, "query_dove_status", { operation: "status",});
    assert.equal(defaultLanguage.content[0].text, renderPublicReport(defaultLanguage.structuredContent.report, { language: "zh" }));
    const english = await dispatchTool(root, "query_dove_status", { operation: "status", language: "en" });
    assert.equal(english.content[0].text, renderPublicReport(english.structuredContent.report, { language: "en" }));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("current-schema MCP exposes one sealed lightweight registry", () => {
  assert.deepEqual(toolDefinitions.map((tool) => tool.name), EXPECTED_TOOL_NAMES);
  assert.equal(new Set(EXPECTED_TOOL_NAMES).size, EXPECTED_TOOL_NAMES.length);
  assert.deepEqual([...TOOL_INPUT_SCHEMAS.keys()], EXPECTED_TOOL_NAMES);
  assert.deepEqual(
    toolDefinitions.filter((tool) => ["query_dove_status", "manage_dove_workspace"].includes(tool.name)).map((tool) => tool.name),
    ["manage_dove_workspace", "query_dove_status"],
    "Workspace status and explicit management must remain discoverable in the same sealed MCP registry"
  );

  assert.deepEqual(Object.keys(toolDefinitions.find((tool) => tool.name === "manage_dove_lessons").inputSchema.properties).sort(), ["binding", "markdown", "operation"]);
  const missionTool = toolDefinitions.find((tool) => tool.name === "manage_dove_mission");
  assert.deepEqual(missionTool.inputSchema.required, []);
  assert.equal(Object.hasOwn(missionTool.inputSchema, "anyOf"), false);
  assert.equal(Object.hasOwn(missionTool.inputSchema, "oneOf"), false, "Claude Code skips MCP tools whose public input schema uses top-level oneOf");
  assert.ok(missionTool.inputSchema.properties.missionNumber);
  assert.ok(missionTool.inputSchema.properties.missionGoal);
  assert.equal(Object.hasOwn(missionTool.inputSchema, "allOf"), false);
  for (const field of ["requirements", "assumptions", "artifacts", "requestedDisposition", "synthesis", "hypotheses", "routes", "openQuestions", "evidenceRefs", "reasonCodes", "nextAction"]) assert.ok(missionTool.inputSchema.properties[field], field);
  for (const field of ["decisionRevision", "consumedReceiptIds", "decisionBudget"]) assert.equal(Object.hasOwn(missionTool.inputSchema.properties, field), false, `public reevaluation must derive ${field} from durable state`);
  assert.equal(TOOL_OPERATION_SCHEMAS.get("manage_dove_mission").length, 5);
  assert.deepEqual(missionTool.inputSchema.properties.skill.enum, ["source", "note", "experience", "experiment", "draft", "figure", "review", "rebuttal"]);
  const skillStartBranch = TOOL_OPERATION_SCHEMAS.get("manage_dove_mission").find((branch) => branch.properties.operation.const === "start-skill");
  assert.deepEqual(skillStartBranch.required, ["operation", "skill", "goal"]);
  const publicRoute = missionTool.inputSchema.properties.routes.items;
  assert.deepEqual(Object.keys(publicRoute.properties).sort(), ["disposition", "rationale", "summary"]);
  assert.deepEqual(publicRoute.required, ["summary", "disposition", "rationale"]);
  assert.equal(Object.hasOwn(publicRoute.properties, "routeId"), false, "public reevaluation must not accept durable route ids");
  for (const branch of TOOL_OPERATION_SCHEMAS.get("manage_dove_mission")) assert.ok(branch.not?.anyOf?.length > 0, "each mission operation branch must forbid fields from the other branches");

  const sourceTool = toolDefinitions.find((tool) => tool.name === "manage_dove_sources");
  const sourceRegisterBranch = TOOL_OPERATION_SCHEMAS.get("manage_dove_sources").find((branch) => branch.properties.operation.const === "register");
  assert.equal(sourceTool.inputSchema.properties.capturePath.minLength, 1);
  assert.equal(sourceRegisterBranch.required.includes("capturePath"), true, "Source registration must require real captured material");

  const workspaceTool = toolDefinitions.find((tool) => tool.name === "manage_dove_workspace");
  assert.equal(Object.hasOwn(workspaceTool.inputSchema, "oneOf"), false, "Claude Code must discover the workspace mutation tool");
  assert.equal(TOOL_OPERATION_SCHEMAS.get("manage_dove_workspace").length, 3);
  assert.deepEqual(workspaceTool.inputSchema.properties.operation.enum, ["set-mainline", "initialize"]);
  assert.equal(Object.hasOwn(workspaceTool.inputSchema.properties, "userApproved"), false);
  assert.equal(operationForTool("manage_dove_workspace").checkpoint({ operation: "set-mainline" }), false);

  const ambientTool = toolDefinitions.find((tool) => tool.name === "create_ambient_dove_mission");
  assert.deepEqual(Object.keys(ambientTool.inputSchema.properties).sort(), ["artifacts", "assumptions", "changesWorkspaceMainline", "completionCriteria", "evidenceRequirements", "goal", "mainlineAlignment", "mode", "outOfScope", "requirements", "scope"]);
  assert.deepEqual(ambientTool.inputSchema.required, ["mode", "goal", "mainlineAlignment", "changesWorkspaceMainline"]);
  assert.deepEqual(ambientTool.inputSchema.properties.evidenceRequirements.items, {
    type: "string",
    pattern: "^(?:artifact|validation):.+$",
    description: "Use artifact:<project-relative-path> or validation:<project-relative-path>."
  });
  assert.match(ambientTool.description, /evidenceRequirements.*artifact:<path>.*validation:<path>/iu);
  for (const forbidden of ["missionId", "operation", "supersedesMissionId", "changeFrom", "missionDisplayIndex", "missionGoal", "researchItemNumber", "nodeUpdates", "summary", "decisions", "workItems", "alignment"]) {
    assert.equal(Object.hasOwn(ambientTool.inputSchema.properties, forbidden), false, `ambient schema must not expose ${forbidden}`);
  }

  const statusProperties = toolDefinitions.find((tool) => tool.name === "query_dove_status").inputSchema.properties;
  assert.ok(statusProperties.missionNumber);
  assert.equal(Object.hasOwn(statusProperties, "missionId"), false);
  assert.deepEqual(statusProperties.detail.enum, ["compact", "full"]);
  assert.deepEqual(statusProperties.language.enum, ["zh", "en"]);
  for (const retired of ["intent", "view", "full", "includeDetails", "showMissions", "includeMissionDetails"]) {
    assert.equal(Object.hasOwn(statusProperties, retired), false, `query_dove_status must not expose ${retired}`);
  }

  const hostOutcomeTool = toolDefinitions.find((tool) => tool.name === "close_host_outcome");
  assert.deepEqual(Object.keys(hostOutcomeTool.inputSchema.properties).sort(), ["artifactPaths", "attemptId", "facts", "missionNumber", "status", "summary", "validationPaths"]);
  assert.deepEqual(hostOutcomeTool.inputSchema.required, ["missionNumber", "attemptId", "status", "summary"]);
  assert.deepEqual(hostOutcomeTool.inputSchema.properties.status.enum, ["completed", "stopped", "blocked", "failed"]);

  const researchOutcomeTool = toolDefinitions.find((tool) => tool.name === "record_research_outcome");
  assert.ok(researchOutcomeTool, "record_research_outcome must remain MCP-only");
  assert.deepEqual(Object.keys(researchOutcomeTool.inputSchema.properties).sort(), [
    "actualUsage", "artifactPaths", "attemptId", "decisionRevision", "evidenceReturned", "facts", "finishedAt", "missionNumber", "performedActionCount", "startedAt", "status", "validationPaths"
  ]);
  assert.deepEqual(researchOutcomeTool.inputSchema.required, ["missionNumber", "decisionRevision", "attemptId", "status", "performedActionCount", "actualUsage", "evidenceReturned", "artifactPaths", "validationPaths", "facts", "startedAt", "finishedAt"]);
  assert.match(researchOutcomeTool.description, /single immutable receipt.*decision remains unchanged.*execution facts only/isu);
  assert.match(researchOutcomeTool.inputSchema.properties.evidenceReturned.description, /expected-evidence labels.*current closure request/isu);
  assert.match(researchOutcomeTool.inputSchema.properties.facts.description, /execution observations only.*scientific conclusions/isu);
  assert.match(researchOutcomeTool.inputSchema.properties.actualUsage.description, /non-negative integer usage.*closure request budget.*performedActionCount/isu);
  for (const field of ["actions", "timeMinutes", "costUnits"]) {
    assert.equal(researchOutcomeTool.inputSchema.properties.actualUsage.properties[field].type, "integer");
  }
  for (const field of ["missionId", "actionId", "decisionId", "envelopeId", "contractDigest", "decisionDigest", "seal", "receiptId"]) {
    assert.equal(Object.hasOwn(researchOutcomeTool.inputSchema.properties, field), false, `record_research_outcome must not expose ${field}`);
  }

  for (const tool of toolDefinitions) {
    assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
    assertSchemaObjectsSealed(tool.inputSchema);
    for (const retired of [
      ...RETIRED_PUBLIC_CONTROL_FIELDS,
      "packetId", "taskPacketId", "assignedRole", "queue", "lease", "campaignId",
      "continuationId", "policyOverrideReason"
    ]) {
      assert.equal(Object.hasOwn(tool.inputSchema.properties, retired), false, `${tool.name} must not expose ${retired}`);
    }
    assert.equal(Object.hasOwn(tool, "operatorTier"), false);
    assert.equal(Object.hasOwn(tool, "primaryEntry"), false);
    assert.equal(Object.hasOwn(tool, "internalOnly"), false);
  }

  const governedTools = new Set([
    ...GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.surfaceBindings.mcpTool),
    ...GOVERNANCE_READONLY_TOOLS.map((entry) => entry.mcpTool)
  ].filter(Boolean));
  assert.deepEqual(governedTools, new Set(EXPECTED_TOOL_NAMES));
});

test("manage_dove_mission seals all five operation branches and separates public from private fields", () => {
  const schema = TOOL_INPUT_SCHEMAS.get("manage_dove_mission");
  const branches = TOOL_OPERATION_SCHEMAS.get("manage_dove_mission");
  const validInputs = [
    { operation: "query", mode: "ordinary", goal: "Preview one bounded mission." },
    { operation: "start-skill", skill: "source", goal: "Start one bounded Source Skill Mission.", parentMissionNumber: 1, contextArtifactPaths: ["outputs/context.md"] },
    { operation: "reevaluate-research-decision", missionNumber: 1, requestedDisposition: "stop-satisfied", synthesis: "The bounded objective is satisfied.", hypotheses: [], routes: [{ summary: "Stop after the bounded objective is satisfied.", disposition: "selected", rationale: "No further route is warranted." }], openQuestions: [], evidenceRefs: [], reasonCodes: ["bounded-objective-satisfied"], nextAction: null },
    { operation: "create-root", mode: "ordinary", goal: "Create one bounded root mission." },
    { operation: "branch", mode: "ordinary", goal: "Create one bounded explicit branch.", parentMissionNumber: 1, branchKind: "follow-up", branchReason: "Continue through an explicit child." }
  ];
  assert.deepEqual(branches.map((branch) => branch.properties.operation.const), ["query", "start-skill", "reevaluate-research-decision", "create-root", "branch"]);
  for (const input of validInputs) {
    assert.doesNotThrow(() => assertMcpInputSchema("manage_dove_mission", input, schema));
    assert.doesNotThrow(() => assertMcpInputSchema("manage_dove_mission", input, { oneOf: branches }));
  }
  for (const input of [
    { ...validInputs[0], skill: "source" },
    { ...validInputs[1], mode: "research" },
    { ...validInputs[2], contextArtifactPaths: [] },
    { ...validInputs[3], parentMissionNumber: 1 },
    { ...validInputs[4], skill: "draft" }
  ]) {
    assert.throws(() => assertMcpInputSchema("manage_dove_mission", input, { oneOf: branches }), /input is invalid|must match exactly one allowed schema/iu);
  }
  for (const privateField of ["missionId", "parentMissionId", "dependsOnMissionIds", "routing", "contextArtifactCount", "currentResearchDecision", "executionHandoff"]) {
    assert.equal(Object.hasOwn(schema.properties, privateField), false, `manage_dove_mission must not expose ${privateField}`);
  }
});

test("deleted MCP tools are absent and fail without creating workspace state", () => {
  const names = new Set(EXPECTED_TOOL_NAMES);
  for (const name of DELETED_TOOL_NAMES) {
    assert.equal(names.has(name), false, name);
    assert.equal(TOOL_INPUT_SCHEMAS.has(name), false, name);
    const root = createTempRoot(`dove-mcp-deleted-${name}-`);
    const result = dispatchTool(root, name, {});
    assert.equal(result.isError, true);
    assert.ok(result.structuredContent?.report && result.structuredContent?.hostControl, "Unknown tools must still return the sealed public error envelope");
    assert.equal(result.content[0].text, renderPublicReport(result.structuredContent.report, { language: "en" }));
    assert.equal(result.structuredContent.hostControl.classification.category, "not-found");
    assert.equal(result.content[0].text, "Unknown tool: The requested action");
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);
    cleanupTempRoot(root);
  }
});

test("read-only mission preview and status use only the public allowlist and remain zero-write", async () => {
  const root = createTempRoot("dove-mcp-readonly-");
  try {
    const before = snapshot(root);
    const preview = await callTool(root, "manage_dove_mission", { operation: "query", mode: "ordinary", goal: "Preview without durable state." });
    assertPublicResult(preview);
    assert.equal(preview.status, "proposal");
    assert.deepEqual(Object.keys(preview.mission).sort(), ["artifacts", "assumptions", "completionCriteria", "evidenceRequirements", "goal", "mode", "outOfScope", "requirements", "scope"]);

    const status = await callTool(root, "query_dove_status", { operation: "status" });
    assertPublicStatus(status);
    assert.equal(status.currentSituation.trackedWorkstreams, 0);
    assert.equal(status.workStatus.state, "not-started");
    assert.equal(status.risksAndBlockers.length > 0, true);
    assert.deepEqual(snapshot(root), before);

    for (const args of [{ board: true }, { resultMode: "full" }]) {
      const rejected = await dispatchTool(root, "query_dove_status", args);
      assert.equal(rejected.isError, true);
      if (Object.hasOwn(args, "resultMode")) {
        assert.equal(rejected.content[0].text, "The requested action could not complete because recorded internal state is unavailable or no longer current.");
      } else {
        assert.match(rejected.content[0].text, /requested action input is invalid.*not allowed/iu);
      }
      assert.deepEqual(snapshot(root), before);
    }
  } finally {
    cleanupTempRoot(root);
  }
});

test("MCP Lessons read-update keeps binding machine-only and creates no Mission or Receipt", async () => {
  const root = createTempRoot("dove-mcp-lessons-");
  try {
    initializeWorkspace(root);
    const before = snapshot(root);
    const read = await callToolEnvelope(root, "manage_dove_lessons", { operation: "read" });
    assertPublicResult(read.report);
    assert.equal(read.report.status, "ok");
    assert.match(read.report.markdown, /^# Dove Lessons/mu);
    assert.equal(typeof read.hostControl.lessonsDocument.binding, "string");
    assert.match(read.hostControl.lessonsDocument.currentHash, /^[0-9a-f]{64}$/u);
    assert.equal(Object.hasOwn(read.report, "currentHash"), false);
    assert.deepEqual(snapshot(root), before);

    let approvalCalls = 0;
    const markdown = read.report.markdown.replace("## 工程与可复现性\n\n- 暂无。", "## 工程与可复现性\n\n- 保持 MCP 更新精确。\n");
    const updated = await callToolEnvelope(root, "manage_dove_lessons", {
      operation: "update",
      binding: read.hostControl.lessonsDocument.binding,
      markdown
    }, { requestCheckpointApproval: async () => { approvalCalls += 1; return "accept"; } });
    assert.equal(approvalCalls, 0);
    assert.equal(updated.report.status, "updated");
    assert.equal(updated.report.markdown, markdown);
    assert.equal(Object.hasOwn(updated.hostControl, "lessonsDocument"), false);
    assertPublicResult(updated.report);
    assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.missionsDir)) ? fs.readdirSync(path.join(root, ARTIFACT_PATHS.missionsDir)).length : 0, 0);
    assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir)) ? fs.readdirSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir)).length : 0, 0);
  } finally {
    cleanupTempRoot(root);
  }
});

test("MCP set-mainline initializes and revises directly while preserving workspace revision history", async () => {
  const root = createTempRoot("dove-mcp-set-mainline-");
  try {
    let approvalCalls = 0;
    const initialized = await callTool(root, "manage_dove_workspace", {
      operation: "set-mainline",
      projectBrief: "This repository provides a local-first Dove runtime with sealed core state, MCP tools, generated host adapters, and focused integration tests.",
      mainline: "Evidence-Grounded Research Workflows for Reliable Autonomous Systems"
    }, { requestCheckpointApproval: async () => { approvalCalls += 1; return "accept"; } });
    assert.equal(approvalCalls, 0);
    assert.equal(initialized.status, "initialized");
    assert.equal(initialized.mainline, "Evidence-Grounded Research Workflows for Reliable Autonomous Systems");
    assert.match(renderPublicReport(initialized, { language: "en" }), /^This repository provides.*\n\nEvidence-Grounded Research Workflows/su);
    assertPublicResult(initialized);

    for (const invalid of [
      { operation: "set-mainline", projectBrief: "Concise project brief.", mainline: "Invalid\nsecond line" }
    ]) {
      const rejected = await dispatchTool(root, "manage_dove_workspace", invalid);
      assert.equal(rejected.isError, true);
      assert.equal(approvalCalls, 0);
    }

    const firstProject = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.projectIdentity), "utf8"));
    const firstRevisionId = firstProject.currentRevisionId;
    const revised = await callTool(root, "manage_dove_workspace", {
      operation: "set-mainline",
      projectBrief: "The project remains a sealed research workflow system, with the current work focused on simplifying explicit Workspace direction management.",
      mainline: "Traceable Mainline Revision for Evidence-Grounded Research Systems"
    }, { requestCheckpointApproval: async () => { approvalCalls += 1; return "accept"; } });
    assert.equal(approvalCalls, 0);
    assert.equal(revised.status, "revised");
    assert.equal(revised.mainline, "Traceable Mainline Revision for Evidence-Grounded Research Systems");

    const secondProject = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.projectIdentity), "utf8"));
    assert.notEqual(secondProject.currentRevisionId, firstRevisionId);
    assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.workspaceRevisionsDir, `${firstRevisionId}.json`)), true);
    assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.workspaceRevisionsDir, `${secondProject.currentRevisionId}.json`)), true);
    assert.equal(fs.readdirSync(path.join(root, ARTIFACT_PATHS.workspaceRevisionsDir)).length, 2);
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
    const result = await callTool(root, "manage_dove_workspace", {
      operation: "initialize",
      mainline: "Replace invalid project records.",
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

test("MCP archive reset preserves unsupported state whole and current runtime ignores the archive", async () => {
  const root = createTempRoot("dove-mcp-reset-archive-");
  try {
    fs.mkdirSync(path.join(root, ".dove"));
    fs.writeFileSync(path.join(root, ARTIFACT_PATHS.doveRootManifest), `${JSON.stringify({ schemaVersion: 16 }, null, 2)}\n`);
    fs.writeFileSync(path.join(root, ".dove", "legacy-evidence.json"), "{\"preserved\":true}\n");

    const result = await callTool(root, "manage_dove_workspace", {
      operation: "initialize",
      mainline: "Establish a new current workspace after archiving unsupported state.",
      archiveReset: true
    }, { requestCheckpointApproval: async (approval) => {
      assertPublicApproval(approval);
      return "accept";
    } });

    assert.equal(result.status, "archive-reset-complete");
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.doveRootManifest), "utf8")).schemaVersion, 18);
    const archiveRoot = path.join(root, ".dove-archive");
    const archivedDirectories = fs.readdirSync(archiveRoot);
    assert.equal(archivedDirectories.length, 1);
    const archivedState = path.join(archiveRoot, archivedDirectories[0]);
    assert.equal(fs.readFileSync(path.join(archivedState, "legacy-evidence.json"), "utf8"), "{\"preserved\":true}\n");

    fs.writeFileSync(path.join(archivedState, "legacy-evidence.json"), "malformed archived data\n");
    const status = await callTool(root, "query_dove_status", { operation: "status",});
    assertPublicStatus(status);
  } finally {
    cleanupTempRoot(root);
  }
});

test("MCP explicit mission checkpoint persists the approved direct Mission contract", async () => {
  const root = createTempRoot("dove-mcp-mission-checkpoint-");
  try {
    const selected = await materializeMission(root, "accepted-mission", {
      goal: "Persist only this approved mission contract.",
      scope: ["current-schema MCP"],
      artifacts: [{ path: "README.md", required: true, role: "output" }],
      completionCriteria: ["README is current"]
    });
    const persisted = selected.mission;
    assert.equal(persisted.mode, "ordinary");
    assert.equal(Object.hasOwn(persisted, "executionHandoff"), false);
    assert.equal(readCurrentResearchDecision(root, persisted.missionId), null);
    assert.deepEqual(persisted.requirements, []);
    assert.deepEqual(persisted.artifacts, [{ path: "README.md", required: true, role: "output" }]);
    assert.equal(Object.hasOwn(persisted, "requirementSnapshotId"), false);
    assert.deepEqual(Object.keys(snapshot(root)).sort(), [
      ARTIFACT_PATHS.doveRootManifest,
      ARTIFACT_PATHS.lessonsDocument,
      `${ARTIFACT_PATHS.missionsDir}/${persisted.missionId}.json`,
      ARTIFACT_PATHS.projectIdentity,
      `${ARTIFACT_PATHS.workspaceRevisionsDir}/${JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.projectIdentity), "utf8")).currentRevisionId}.json`
    ].sort());
    assert.equal(fs.existsSync(path.join(root, ".dove", "state.json")), false);
    assert.equal(fs.existsSync(path.join(root, ".dove", "task-packets")), false);
  } finally {
    cleanupTempRoot(root);
  }
});

test("ambient mission evidence requirement schema exposes and enforces typed formats", () => {
  const schema = TOOL_INPUT_SCHEMAS.get("create_ambient_dove_mission");
  const base = {
    mode: "ordinary",
    goal: "Fix the focused usability issue.",
    mainlineAlignment: "This bounded fix supports the current project mainline.",
    changesWorkspaceMainline: false
  };
  for (const reference of ["artifact:src/mcp/tool-definitions.mjs", "validation:test-results/mcp.log"]) {
    assert.doesNotThrow(() => assertMcpInputSchema("create_ambient_dove_mission", {
      ...base,
      evidenceRequirements: [reference]
    }, schema));
  }
  for (const reference of ["Host-observed read confirms the schema.", "source:ambient-acceptance", "note:ambient-acceptance"]) {
    assert.throws(() => assertMcpInputSchema("create_ambient_dove_mission", {
      ...base,
      evidenceRequirements: [reference]
    }, schema), /evidenceRequirements\[0\].*required pattern/iu);
  }
});

test("ambient mission without a workspace explains that the research mainline is not established and stays zero-write", async () => {
  for (const changesWorkspaceMainline of [false, true]) {
    const root = createTempRoot(`dove-mcp-ambient-missing-workspace-${changesWorkspaceMainline}-`);
    try {
      const before = snapshot(root);
      const result = await dispatchTool(root, "create_ambient_dove_mission", {
        mode: "ordinary",
        goal: "Append one exact sentence to README.md.",
        mainlineAlignment: "This is a narrowly scoped documentation edit directly requested by the user.",
        changesWorkspaceMainline,
        artifacts: [{ path: "README.md", required: true, role: "supporting" }],
        completionCriteria: ["README.md ends with the exact requested sentence."]
      });

      assert.equal(result.isError, true);
      const expectedMessage = changesWorkspaceMainline
        ? "Ambient The requested work record requires current-mainline alignment and no mainline change."
        : "The project research mainline has not been established. Run /dove:workspace explicitly before starting new work.";
      assert.equal(result.content[0].text, expectedMessage);
      assert.equal(result.structuredContent.report.message, expectedMessage);
      assert.deepEqual(result.structuredContent.hostControl.presentation, { mode: "show", reason: "failure" });
      assert.equal(result.structuredContent.hostControl.closureRequest, null);
      assertNoCompactPublicLeaks(result.structuredContent);
      assert.deepEqual(snapshot(root), before);
    } finally {
      cleanupTempRoot(root);
    }
  }
});

test("ambient mainline-change rejection remains natural and zero-write in an initialized workspace", async () => {
  const root = createTempRoot("dove-mcp-ambient-mainline-change-");
  try {
    initializeWorkspace(root);
    const before = snapshot(root);
    const result = await dispatchTool(root, "create_ambient_dove_mission", {
      mode: "ordinary",
      goal: "Replace the project research direction.",
      mainlineAlignment: "The request proposes a different research direction.",
      changesWorkspaceMainline: true
    });

    assert.equal(result.isError, true);
    assert.equal(result.content[0].text, "Ambient The requested work record requires current-mainline alignment and no mainline change.");
    assert.equal(result.structuredContent.report.message, result.content[0].text);
    assert.equal(result.structuredContent.hostControl.classification.category, "invalid-input");
    assert.deepEqual(snapshot(root), before);
  } finally {
    cleanupTempRoot(root);
  }
});

test("ambient mission tool creates one mission without elicitation and seals control inputs", async () => {
  const root = createTempRoot("dove-mcp-ambient-create-");
  try {
    initializeWorkspace(root);
    let approvalCalls = 0;
    const envelope = await callToolEnvelope(root, "create_ambient_dove_mission", {
      mode: "ordinary",
      goal: "Implement the ordinary request.",
      mainlineAlignment: "This bounded request directly advances the established workspace research mainline.",
      changesWorkspaceMainline: false,
      scope: ["current workspace"],
      artifacts: [{ path: "report.md", required: true, role: "output" }],
      completionCriteria: ["The report is complete."],
      evidenceRequirements: ["artifact:report.md"]
    }, { requestCheckpointApproval: async () => { approvalCalls += 1; return "accept"; } });
    const result = envelope.report;
    assert.equal(approvalCalls, 0);
    assert.equal(result.status, "materialized");
    assert.deepEqual(envelope.hostControl.presentation, { mode: "silent", reason: "ambient-create-succeeded" });
    assert.match(result.message, /requested work has not been completed yet/iu);
    assert.equal(Object.hasOwn(envelope, "researchHandoff"), false);
    const persistedMission = fs.readdirSync(path.join(root, ARTIFACT_PATHS.missionsDir))
      .map((file) => JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.missionsDir, file), "utf8")))[0];
    const currentDecision = readCurrentResearchDecision(root, persistedMission.missionId);
    assert.equal(persistedMission.mode, "ordinary");
    assert.deepEqual(persistedMission.evidenceRequirements.map((item) => item.requirement), ["artifact:report.md"]);
    assert.equal(currentDecision, null);
    assert.deepEqual(envelope.hostControl.closureRequest, {
      tool: "close_host_outcome",
      mode: "host-outcome",
      exactlyOnce: true,
      boundArgs: { missionNumber: 1 },
      requiredOutcomeFields: ["attemptId", "status", "summary"],
      defaults: { artifactPaths: [], validationPaths: [], facts: [] }
    });
    assert.deepEqual(envelope.hostControl.classification, {
      outcome: "continuation",
      category: "success",
      phase: "execution",
      blocking: false,
      userAction: "none",
      terminal: false,
      continuation: "resume-original",
      closure: "host-outcome",
      retry: "none"
    });
    for (const field of ["disposition", "execution", "outcomeClosure", "continuation", "closure", "retry", "terminal"]) assert.equal(Object.hasOwn(result, field), false);
    assert.equal(fs.readdirSync(path.join(root, ARTIFACT_PATHS.missionsDir)).length, 1);
    assert.equal(JSON.stringify(result).includes("mission-"), false);

    const before = snapshot(root);
    for (const [field, value] of [["missionId", "caller-id"], ["supersedesMissionId", "older"], ["changeFrom", {}], ["operation", "create"], ["nodeUpdates", []]]) {
      const rejected = await dispatchTool(root, "create_ambient_dove_mission", {
        mode: "ordinary",
        goal: "Reject control input.",
        mainlineAlignment: "The bounded control test serves the established workspace research mainline.",
        changesWorkspaceMainline: false,
        [field]: value
      });
      assert.equal(rejected.isError, true);
      assert.deepEqual(snapshot(root), before);
    }

    fs.writeFileSync(path.join(root, "report.md"), "The ordinary request produced this report.\n", "utf8");
    const closed = await callTool(root, envelope.hostControl.closureRequest.tool, {
      missionNumber: envelope.hostControl.closureRequest.boundArgs.missionNumber,
      attemptId: "ambient-report-attempt",
      status: "completed",
      summary: "The requested report was produced.",
      artifactPaths: ["report.md"]
    });
    assert.equal(closed.status, "ingested");
    assert.equal(closed.outcome.status, "completed");
    assert.equal(Object.hasOwn(closed, "researchNarrative"), false);
    assertNoCompactPublicLeaks(closed);
    const status = await callTool(root, "query_dove_status", { operation: "status", language: "zh" });
    assert.equal(status.workStatus.state, "work-produced");
    assert.deepEqual(status.workStatus.currentOutputs, ["report.md"]);
    assert.equal(status.evidenceStatus.state, "current-with-gaps");
    assert.match(status.findings.join("\n"), /report\.md/u);
  } finally {
    cleanupTempRoot(root);
  }
});

test("raw execution receipt ingestion is retired and cannot write", async () => {
  const root = createTempRoot("dove-mcp-retired-raw-receipt-");
  try {
    const before = snapshot(root);
    const result = await dispatchTool(root, "ingest_execution_receipt", {
      receiptId: "retired-raw-receipt",
      missionNumber: 1,
      contractDigest: "0".repeat(64),
      summary: "This retired surface must not be callable.",
      artifacts: [],
      validations: [],
      criteriaSatisfied: [],
      producedAt: "2026-07-16T00:00:00.000Z"
    });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.hostControl.classification.category, "not-found");
    assert.deepEqual(snapshot(root), before);
  } finally {
    cleanupTempRoot(root);
  }
});

test("MCP research outcome resolves public selectors and returns a safe next judgment", async () => {
  const root = createTempRoot("dove-mcp-research-outcome-");
  try {
    fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
    fs.writeFileSync(path.join(root, "outputs/result.md"), "bounded research result\n", "utf8");
    const selected = await materializeMission(root, "mcp-research-outcome", {
      mode: "research",
      goal: "Execute one bounded analysis and return current evidence.",
      artifacts: [{ path: "outputs/result.md", required: true, role: "output" }],
      evidenceRequirements: ["artifact:outputs/result.md"]
    });
    const decision = readCurrentResearchDecision(root, selected.mission.missionId);
    const startedAt = new Date(Math.max(Date.parse(decision.createdAt), Date.now() - 1000)).toISOString();
    const finishedAt = new Date(Date.parse(startedAt) + 1).toISOString();
    const args = {
      missionNumber: selected.missionNumber,
      decisionRevision: decision.revision,
      attemptId: "mcp-research-outcome-attempt",
      status: "completed",
      performedActionCount: 1,
      actualUsage: { actions: 1, timeMinutes: 1, costUnits: 1 },
      evidenceReturned: [...decision.nextAction.expectedEvidence],
      artifactPaths: [path.join(root, "outputs/result.md")],
      validationPaths: [],
      facts: ["The bounded analysis completed and produced the declared result file."],
      startedAt,
      finishedAt
    };

    const recordedEnvelope = await callToolEnvelope(root, "record_research_outcome", args);
    const recorded = recordedEnvelope.report;
    assert.equal(recorded.status, "recorded");
    assert.equal(recordedEnvelope.hostControl.classification.category, "success");
    assert.equal(recordedEnvelope.hostControl.classification.reason, undefined);
    assert.deepEqual(recorded.outcome, {
      accepted: true,
      status: "completed",
      evidenceComplete: true,
      missingEvidence: [],
      scopeDeviation: false,
      deviationReasons: [],
      performedActionCount: 1
    });
    assert.equal(recorded.research.nextJudgment, "Review the recorded execution facts and evidence before making the next scientific judgment.");
    assert.equal(recorded.research.awaitingReevaluation, true);
    assert.equal(recorded.research.receiptRecorded, true);
    assert.equal(recorded.research.decisionUnchanged, true);
    assert.deepEqual(recorded.artifacts, [{ path: "outputs/result.md", kind: "other" }]);
    assert.deepEqual(recorded.verification, []);
    assertPublicResult(recorded);
    assert.equal(readCurrentResearchDecision(root, selected.mission.missionId).revision, 1);
    assert.equal(fs.readdirSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir)).length, 1);

    const beforeReplay = snapshot(root);
    const replayEnvelope = await callToolEnvelope(root, "record_research_outcome", args);
    const replayed = replayEnvelope.report;
    assert.equal(replayed.status, "replayed");
    assert.equal(replayed.zeroWrite, true);
    assert.deepEqual(replayEnvelope.hostControl.classification, {
      outcome: "succeeded",
      category: "success-zero-write",
      phase: "execution",
      blocking: false,
      userAction: "none",
      terminal: true,
      continuation: "terminal",
      closure: "none",
      retry: "none",
      reason: "replayed"
    });
    assert.equal(replayEnvelope.hostControl.closureRequest, null);
    assert.doesNotMatch(JSON.stringify(replayEnvelope), /missionId|decisionId|envelopeId|contractDigest|decisionDigest|receiptId|\.dove\//u);
    assert.deepEqual(snapshot(root), beforeReplay);

    const privateInput = await dispatchTool(root, "record_research_outcome", { ...args, missionId: selected.mission.missionId });
    assert.equal(privateInput.isError, true);
    assert.deepEqual(snapshot(root), beforeReplay);
  } finally {
    cleanupTempRoot(root);
  }
});

test("stdio ambient research closure exposes exact labels and records mission 2 on the first valid call", async () => {
  const root = createTempRoot("dove-mcp-stdio-ambient-research-closure-");
  const client = createMcpStdioClient({ args: [PACKAGED_CLI, "mcp", "serve", "--project", root], cwd: root });
  try {
    initializeProjectIntegration(root, { hosts: ["claude"], packageName: "dove", packageVersion: "0.4.0", now: "2026-07-29T00:00:00.000Z" });
    initializeWorkspace(root);
    fs.writeFileSync(path.join(root, "README.md"), "# Ambient research trace\n\nCurrent project evidence.\n", "utf8");
    await client.call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "dove-ambient-research-trace", version: "1.0.0" }
    });
    client.notify("notifications/initialized");

    extractToolEnvelope(await client.call("tools/call", {
      name: "create_ambient_dove_mission",
      arguments: {
        mode: "ordinary",
        goal: "Create the preceding ambient work item.",
        mainlineAlignment: "This bounded entry directly advances the current project research mainline.",
        changesWorkspaceMainline: false
      }
    }));
    const created = extractToolEnvelope(await client.call("tools/call", {
      name: "create_ambient_dove_mission",
      arguments: {
        mode: "research",
        goal: "Inspect README.md and return one bounded evidence-grounded observation for the research direction.",
        mainlineAlignment: "The bounded README analysis directly advances the current project research mainline.",
        changesWorkspaceMainline: false,
        artifacts: [{ path: "README.md", required: true, role: "supporting" }],
        completionCriteria: ["Return one concrete bounded observation without minting a scientific conclusion."],
        evidenceRequirements: ["artifact:README.md"]
      }
    }));
    const closure = created.hostControl.closureRequest;
    assert.deepEqual(closure.boundArgs, { missionNumber: 2, decisionRevision: 1 });
    assert.deepEqual(closure.outcomeContract.evidenceReturned, {
      allowedValues: ["artifact:README.md"],
      exactLabelsOnly: true,
      allExpectedForEvidenceComplete: true
    });
    assert.deepEqual(closure.outcomeContract.actualUsageLimits, {
      actions: 1,
      timeMinutes: 60,
      costUnits: 1,
      fieldTypes: { actions: "integer", timeMinutes: "integer", costUnits: "integer" },
      positiveFractions: "round-up-before-reporting",
      serverCoercion: false
    });
    assert.deepEqual(closure.outcomeContract.facts, {
      itemType: "string",
      executionObservationsOnly: true,
      scientificJudgmentAllowed: false
    });
    assertNoCompactPublicLeaks(created.researchHandoff);
    assert.doesNotMatch(JSON.stringify(created.report), /outcomeContract|allowedValues|missionNumber|decisionRevision/u);
    const researchMissionId = fs.readdirSync(path.join(root, ARTIFACT_PATHS.missionsDir))
      .map((file) => JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.missionsDir, file), "utf8")))
      .find((mission) => mission.goal.startsWith("Inspect README.md"))
      .missionId;
    const initialDecision = readCurrentResearchDecision(root, researchMissionId);

    assert.deepEqual(closure.outcomeContract.timestampWindow.acceptedUtcFormats, [
      "YYYY-MM-DDTHH:mm:ssZ",
      "YYYY-MM-DDTHH:mm:ss.sssZ"
    ]);
    assert.equal(closure.outcomeContract.timestampWindow.canonicalFormat, "YYYY-MM-DDTHH:mm:ss.sssZ");
    const startedAtMilliseconds = Math.max(
      Math.ceil(Date.parse(closure.outcomeContract.timestampWindow.startedAtNotBefore) / 1000) * 1000,
      Math.floor(Date.now() / 1000) * 1000 - 1000
    );
    const startedAt = new Date(startedAtMilliseconds).toISOString().replace(".000Z", "Z");
    const finishedAt = new Date(startedAtMilliseconds + 1000).toISOString().replace(".000Z", "Z");
    const waitMilliseconds = Date.parse(finishedAt) - Date.now();
    if (waitMilliseconds > 0) await new Promise((resolve) => setTimeout(resolve, waitMilliseconds));
    const recorded = extractToolEnvelope(await client.call("tools/call", {
      name: closure.tool,
      arguments: {
        ...closure.boundArgs,
        attemptId: "stdio-ambient-research-attempt",
        status: "completed",
        performedActionCount: 1,
        actualUsage: { actions: 1, timeMinutes: 0, costUnits: 0 },
        evidenceReturned: [...closure.outcomeContract.evidenceReturned.allowedValues],
        artifactPaths: ["README.md"],
        validationPaths: [],
        facts: ["README.md was read and contains the current project description used for the bounded analysis."],
        startedAt,
        finishedAt
      }
    }));
    assert.equal(recorded.report.status, "recorded");
    assert.equal(recorded.report.outcome.accepted, true);
    assert.equal(recorded.report.outcome.evidenceComplete, true);
    const persistedDecision = readCurrentResearchDecision(root, researchMissionId);
    assert.equal(persistedDecision.revision, initialDecision.revision);
    assert.equal(persistedDecision.createdAt, initialDecision.createdAt);
    const receiptNames = fs.readdirSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir));
    assert.equal(receiptNames.length, 1);
    const receipt = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir, receiptNames[0]), "utf8"));
    assert.equal(receipt.producedAt, new Date(Date.parse(finishedAt)).toISOString());
  } finally {
    client.kill();
    cleanupTempRoot(root);
  }
});

test("stdio record_research_outcome rejects fractional usage at the public schema boundary without writing", async () => {
  const root = createTempRoot("dove-mcp-stdio-research-fractional-usage-");
  const client = createMcpStdioClient({ args: [PACKAGED_CLI, "mcp", "serve", "--project", root], cwd: root });
  try {
    initializeProjectIntegration(root, { hosts: ["claude"], packageName: "dove", packageVersion: "0.4.0", now: "2026-07-29T00:00:00.000Z" });
    initializeWorkspace(root);
    fs.writeFileSync(path.join(root, "README.md"), "# Fractional usage trace\n", "utf8");
    await client.call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "dove-fractional-usage-trace", version: "1.0.0" }
    });
    client.notify("notifications/initialized");
    const created = extractToolEnvelope(await client.call("tools/call", {
      name: "create_ambient_dove_mission",
      arguments: {
        mode: "research",
        goal: "Inspect README.md and return one bounded research observation.",
        mainlineAlignment: "The bounded README inspection directly advances the current project research mainline.",
        changesWorkspaceMainline: false,
        artifacts: [{ path: "README.md", required: true, role: "supporting" }],
        evidenceRequirements: ["artifact:README.md"]
      }
    }));
    const closure = created.hostControl.closureRequest;
    assert.equal(closure.outcomeContract.actualUsageLimits.fieldTypes.timeMinutes, "integer");
    assert.equal(closure.outcomeContract.actualUsageLimits.positiveFractions, "round-up-before-reporting");
    assert.equal(closure.outcomeContract.actualUsageLimits.serverCoercion, false);

    const failed = await client.call("tools/call", {
      name: closure.tool,
      arguments: {
        ...closure.boundArgs,
        attemptId: "fractional-usage-attempt",
        status: "completed",
        performedActionCount: 1,
        actualUsage: { actions: 1, timeMinutes: 0.2, costUnits: 0 },
        evidenceReturned: [...closure.outcomeContract.evidenceReturned.allowedValues],
        artifactPaths: ["README.md"],
        validationPaths: [],
        facts: ["README.md was read."],
        startedAt: closure.outcomeContract.timestampWindow.startedAtNotBefore,
        finishedAt: closure.outcomeContract.timestampWindow.startedAtNotBefore
      }
    });
    assert.equal(failed.isError, true);
    assert.equal(failed.structuredContent.hostControl.classification.category, "invalid-input");
    assert.match(failed.content[0].text, /actualUsage\.timeMinutes.*integer/iu);
    assert.doesNotMatch(failed.content[0].text, /remainingTimeMinutes|Internal error|-32603|mission-|decision-|\.dove\//u);
    assert.equal(fs.readdirSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir)).length, 0);
    assert.equal(readCurrentResearchDecision(root, fs.readdirSync(path.join(root, ARTIFACT_PATHS.missionsDir))
      .map((file) => JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.missionsDir, file), "utf8")))[0].missionId).revision, 1);
  } finally {
    client.kill();
    cleanupTempRoot(root);
  }
});

test("stdio record_research_outcome projects evidence mismatch instead of returning JSON-RPC Internal error", async () => {
  const root = createTempRoot("dove-mcp-stdio-research-error-projection-");
  const client = createMcpStdioClient({ args: [PACKAGED_CLI, "mcp", "serve", "--project", root], cwd: root });
  try {
    initializeProjectIntegration(root, { hosts: ["claude"], packageName: "dove", packageVersion: "0.4.0", now: "2026-07-29T00:00:00.000Z" });
    initializeWorkspace(root);
    fs.writeFileSync(path.join(root, "README.md"), "# Ambient research error trace\n", "utf8");
    await client.call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "dove-ambient-research-error", version: "1.0.0" }
    });
    client.notify("notifications/initialized");
    const created = extractToolEnvelope(await client.call("tools/call", {
      name: "create_ambient_dove_mission",
      arguments: {
        mode: "research",
        goal: "Inspect README.md and return one bounded research observation.",
        mainlineAlignment: "The bounded README inspection directly advances the current project research mainline.",
        changesWorkspaceMainline: false,
        artifacts: [{ path: "README.md", required: true, role: "supporting" }],
        evidenceRequirements: ["artifact:README.md"]
      }
    }));
    const closure = created.hostControl.closureRequest;
    const startedAt = new Date(Math.max(Date.parse(closure.outcomeContract.timestampWindow.startedAtNotBefore), Date.now() - 1000)).toISOString();
    const failed = await client.call("tools/call", {
      name: closure.tool,
      arguments: {
        ...closure.boundArgs,
        attemptId: "evidence-mismatch-attempt",
        status: "completed",
        performedActionCount: 1,
        actualUsage: { actions: 1, timeMinutes: 0, costUnits: 0 },
        evidenceReturned: ["artifact:README.md — descriptive text is not an exact handoff label"],
        artifactPaths: ["README.md"],
        validationPaths: [],
        facts: ["README.md was read."],
        startedAt,
        finishedAt: new Date(Date.parse(startedAt) + 1).toISOString()
      }
    });
    assert.equal(failed.isError, true);
    assert.equal(failed.structuredContent.hostControl.classification.category, "evidence-incomplete");
    assert.match(failed.content[0].text, /evidenceReturned.*exact labels.*outcomeContract.*artifactPaths.*validationPaths.*facts/isu);
    assert.doesNotMatch(failed.content[0].text, /Internal error|-32603|mission-|decision-|\.dove\//u);
    assert.equal(fs.readdirSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir)).length, 0);

    const factCreated = extractToolEnvelope(await client.call("tools/call", {
      name: "create_ambient_dove_mission",
      arguments: {
        mode: "research",
        goal: "Inspect README.md again and return execution facts without a scientific judgment.",
        mainlineAlignment: "The second bounded README inspection directly advances the current project research mainline.",
        changesWorkspaceMainline: false,
        artifacts: [{ path: "README.md", required: true, role: "supporting" }],
        evidenceRequirements: ["artifact:README.md"]
      }
    }));
    const factClosure = factCreated.hostControl.closureRequest;
    const factStartedAt = new Date(Math.max(Date.parse(factClosure.outcomeContract.timestampWindow.startedAtNotBefore), Date.now() - 1000)).toISOString();
    const factFailure = await client.call("tools/call", {
      name: factClosure.tool,
      arguments: {
        ...factClosure.boundArgs,
        attemptId: "invalid-scientific-fact-attempt",
        status: "completed",
        performedActionCount: 1,
        actualUsage: { actions: 1, timeMinutes: 0, costUnits: 0 },
        evidenceReturned: [...factClosure.outcomeContract.evidenceReturned.allowedValues],
        artifactPaths: ["README.md"],
        validationPaths: [],
        facts: ["The scientific hypothesis is confirmed true."],
        startedAt: factStartedAt,
        finishedAt: new Date(Date.parse(factStartedAt) + 1).toISOString()
      }
    });
    assert.equal(factFailure.isError, true);
    assert.equal(factFailure.structuredContent.hostControl.classification.category, "invalid-input");
    assert.match(factFailure.content[0].text, /execution facts only.*scientific conclusion/iu);
    assert.doesNotMatch(factFailure.content[0].text, /Internal error|-32603|host outcome|mission-|decision-|\.dove\//iu);
    assert.equal(fs.readdirSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir)).length, 0);
  } finally {
    client.kill();
    cleanupTempRoot(root);
  }
});

test("MCP research attempt records one immutable receipt and leaves scientific judgment unchanged", async () => {
  const root = createTempRoot("dove-mcp-research-outcome-attempt-");
  try {
    fs.writeFileSync(path.join(root, "README.md"), "research outcome fixture\n", "utf8");
    const selected = await materializeMission(root, "mcp-research-outcome-attempt", {
      mode: "research",
      goal: "Analyze one exact bounded research attempt.",
      artifacts: [{ path: "README.md", required: true, role: "supporting" }],
      evidenceRequirements: ["artifact:README.md"]
    });
    const decision = readCurrentResearchDecision(root, selected.mission.missionId);
    const startedAt = new Date(Math.max(Date.parse(decision.createdAt), Date.now() - 1000)).toISOString();
    const recorded = await dispatchTool(root, "record_research_outcome", {
      missionNumber: selected.missionNumber,
      decisionRevision: decision.revision,
      attemptId: "exact-research-outcome-attempt",
      status: "completed",
      performedActionCount: 1,
      actualUsage: { actions: 1, timeMinutes: 1, costUnits: 1 },
      evidenceReturned: [...decision.nextAction.expectedEvidence],
      artifactPaths: ["README.md"],
      validationPaths: [],
      facts: ["The bounded analysis completed."],
      startedAt,
      finishedAt: new Date(Date.parse(startedAt) + 1).toISOString()
    });
    assert.equal(recorded.isError, undefined);
    assert.equal(recorded.structuredContent.report.research.awaitingReevaluation, true);
    assert.equal(recorded.structuredContent.report.research.decisionUnchanged, true);
    assert.equal(recorded.structuredContent.report.experiment, undefined);
    assert.doesNotMatch(JSON.stringify(recorded.structuredContent), /missionId|decisionId|envelopeId|receiptId|ledgerSequence|\.dove\//u);
    assert.equal(readCurrentResearchDecision(root, selected.mission.missionId).revision, 1);
    assert.equal(fs.readdirSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir)).length, 1);
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
      artifacts: [{ path: "outputs/result.md", required: true, role: "output" }]
    });
    assert.equal(JSON.stringify(created.created).includes(missionId), false);
    const closureTool = toolDefinitions.find((tool) => tool.name === "close_host_outcome");
    assert.deepEqual(Object.keys(closureTool.inputSchema.properties).sort(), ["artifactPaths", "attemptId", "facts", "missionNumber", "status", "summary", "validationPaths"]);
    assert.deepEqual(closureTool.inputSchema.required, ["missionNumber", "attemptId", "status", "summary"]);
    assert.deepEqual(closureTool.inputSchema.properties.status.enum, ["completed", "stopped", "blocked", "failed"]);
    assert.match(closureTool.description, /execution facts.*bound.*completion criteria.*no-file outcome/isu);
    assert.match(closureTool.inputSchema.properties.validationPaths.description, /Omit this field.*never repeat an artifactPaths entry/isu);
    const result = await callTool(root, "close_host_outcome", {
      missionNumber: created.missionNumber,
      attemptId: "host-produced-result-attempt",
      status: "completed",
      summary: "Recorded the host-produced result.",
      artifactPaths: [path.join(root, "outputs", "result.md")]
    });
    assert.equal(result.status, "ingested");
    assert.deepEqual(result.artifacts, [{ path: "outputs/result.md", kind: "other" }]);
    assert.equal(result.completion.complete, false);
    assertNoCompactPublicLeaks(result);

    const beforeRepeat = snapshot(root);
    const repeated = await callTool(root, "close_host_outcome", {
      missionNumber: created.missionNumber,
      attemptId: "host-produced-result-attempt",
      status: "completed",
      summary: "Recorded the host-produced result.",
      artifactPaths: ["outputs/result.md"]
    });
    assert.equal(repeated.status, "replayed");
    assert.equal(repeated.zeroWrite, true);
    assert.deepEqual(snapshot(root), beforeRepeat);
    const conflicting = await dispatchTool(root, "close_host_outcome", {
      missionNumber: created.missionNumber,
      attemptId: "host-produced-result-attempt",
      status: "completed",
      summary: "Do not silently replace the recorded callback.",
      artifactPaths: ["outputs/result.md"]
    });
    assert.equal(conflicting.isError, true);
    assert.deepEqual(snapshot(root), beforeRepeat);

    const rejected = await dispatchTool(root, "close_host_outcome", {
      missionNumber: created.missionNumber,
      attemptId: "caller-authority-attempt",
      status: "completed",
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

test("MCP ordinary no-file outcomes report completed, blocked, failed, and stopped states naturally", async () => {
  for (const status of ["completed", "blocked", "failed", "stopped"]) {
    const root = createTempRoot(`dove-mcp-host-observation-${status}-`);
    try {
      const created = await materializeMission(root, `mcp-host-observation-${status}`, {
        goal: "Perform one ordinary no-file operation.",
        completionCriteria: ["The bounded operation returns a concrete status."],
        artifacts: [],
        evidenceRequirements: []
      });
      const returned = await callTool(root, "close_host_outcome", {
        missionNumber: created.missionNumber,
        attemptId: `ordinary-${status}-attempt`,
        status,
        summary: `The ordinary operation returned ${status} status.`,
        facts: [{ statement: `The bounded ordinary operation returned ${status} status without producing a file.`, criterionNumbers: [] }]
      });
      assert.equal(returned.outcome.status, status);
      assert.equal(returned.outcome.kind, "observation");
      assert.equal(returned.artifacts.length, 0);
      assert.equal(returned.verification.length, 0);
      assert.equal(returned.completion.complete, false);
      assert.equal(returned.completion.hostReturn.status, status);
      assert.equal(returned.completion.hostReturn.kind, "observation");
      assert.equal(returned.operationalIntegrity.hostActionReturned, true);
      assert.equal(returned.operationalIntegrity.receiptRecorded, true);
      assert.equal(returned.operationalIntegrity.completionEvidenceSatisfied, false);
      assert.equal(returned.operationalIntegrity.lifecycleClosed, false);
      assertNoCompactPublicLeaks(returned);

      const statusReport = await callTool(root, "query_dove_status", { operation: "status", missionNumber: created.missionNumber, language: "en" });
      const statusReportZh = await callTool(root, "query_dove_status", { operation: "status", missionNumber: created.missionNumber, language: "zh" });
      const renderedStatusZh = renderPublicReport(statusReportZh, { language: "zh" });
      assert.notEqual(statusReport.workStatus.state, "complete");
      if (status === "completed") {
        assert.match(statusReport.executiveSummary, /host action returned.*not complete|execution observation.*completion evidence/iu);
        assert.doesNotMatch(statusReport.executiveSummary, /no-file work completed/iu);
        assert.doesNotMatch(renderedStatusZh, /普通无文件工作已经完成/isu);
      } else {
        assert.equal(statusReport.workStatus.state, "blocked");
        assert.match(statusReport.executiveSummary, new RegExp(`status ${status}.*not complete`, "iu"));
        assert.doesNotMatch(statusReport.executiveSummary, /does not yet have a recorded result/iu);
        assert.match(renderedStatusZh, /工作以(?:阻塞|失败|停止)状态结束.*尚未完成/isu);
      }
    } finally {
      cleanupTempRoot(root);
    }
  }
});

test("ambient closure accepts an in-place validation without requiring a duplicate validation file", async () => {
  const root = createTempRoot("dove-mcp-ambient-closure-in-place-validation-");
  try {
    initializeWorkspace(root);
    let created;
    for (let index = 1; index <= 3; index += 1) {
      created = await callToolEnvelope(root, "create_ambient_dove_mission", {
        mode: "ordinary",
        goal: index === 3 ? "核对 README 定位并记录明确结论。" : `Prepare preceding work ${index}.`,
        mainlineAlignment: "This bounded request directly advances the established workspace research mainline.",
        changesWorkspaceMainline: false,
        artifacts: [{ path: index === 3 ? "POSITIONING_ASSESSMENT.md" : `placeholder-${index}.md`, required: true, role: "output" }],
        completionCriteria: index === 3 ? ["文档存在且包含明确结论。"] : [],
        evidenceRequirements: index === 3
          ? ["artifact:POSITIONING_ASSESSMENT.md", "validation:POSITIONING_ASSESSMENT.md"]
          : []
      });
    }
    assert.deepEqual(created.hostControl.closureRequest, {
      tool: "close_host_outcome",
      mode: "host-outcome",
      exactlyOnce: true,
      boundArgs: { missionNumber: 3 },
      requiredOutcomeFields: ["attemptId", "status", "summary"],
      defaults: { artifactPaths: [], validationPaths: [], facts: [] }
    });
    fs.writeFileSync(path.join(root, "POSITIONING_ASSESSMENT.md"), "# README 项目定位核对\n\n## 明确结论\n\n基本一致，但需要限定。\n", "utf8");

    const closed = await callTool(root, created.hostControl.closureRequest.tool, {
      missionNumber: created.hostControl.closureRequest.boundArgs.missionNumber,
      attemptId: "in-place-validation-attempt",
      status: "completed",
      summary: "已核对 README 第一段与仓库当前内容，结论为总体基本一致，但相关表述需要限定；已将明确结论及仓库内关键依据写入 POSITIONING_ASSESSMENT.md，并验证文档存在且包含明确结论。",
      artifactPaths: ["POSITIONING_ASSESSMENT.md"],
      validationPaths: ["POSITIONING_ASSESSMENT.md"]
    });

    assert.equal(closed.status, "ingested");
    assert.deepEqual(closed.artifacts, [{ path: "POSITIONING_ASSESSMENT.md", kind: "other" }]);
    assert.deepEqual(closed.verification, []);
    const receiptNames = fs.readdirSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir));
    assert.equal(receiptNames.length, 1);
    const receipt = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir, receiptNames[0]), "utf8"));
    assert.deepEqual(receipt.validations, []);
  } finally {
    cleanupTempRoot(root);
  }
});

test("status briefs three workstreams after closure failure while recognizing the existing output", async () => {
  const root = createTempRoot("dove-mcp-status-three-workstreams-");
  try {
    initializeWorkspace(root);
    const scenarios = [
      {
        goal: "完成背景调研摘要。",
        output: "BACKGROUND_SUMMARY.md",
        criterion: "摘要覆盖主要背景和关键引用。",
        evidence: ["artifact:BACKGROUND_SUMMARY.md"]
      },
      {
        goal: "整理实验设置说明。",
        output: "EXPERIMENT_SETUP.md",
        criterion: "实验设置可复现。",
        evidence: ["artifact:EXPERIMENT_SETUP.md"]
      },
      {
        goal: "核对 README 项目定位并记录明确结论。",
        output: "POSITIONING_ASSESSMENT.md",
        criterion: "文档存在且包含明确结论。",
        evidence: ["artifact:POSITIONING_ASSESSMENT.md", "validation:POSITIONING_CHECK.log"]
      }
    ];
    const created = [];
    for (const scenario of scenarios) {
      created.push(await callToolEnvelope(root, "create_ambient_dove_mission", {
        mode: "ordinary",
        goal: scenario.goal,
        mainlineAlignment: "This bounded request directly advances the established workspace research mainline.",
        changesWorkspaceMainline: false,
        artifacts: [{ path: scenario.output, required: true, role: "output" }],
        completionCriteria: [scenario.criterion],
        evidenceRequirements: scenario.evidence
      }));
    }

    fs.writeFileSync(path.join(root, "POSITIONING_ASSESSMENT.md"), "# README 项目定位核对\n\n结论：总体基本一致，但相关表述需要限定。\n", "utf8");
    const beforeFailedClosure = snapshot(root);
    const failedClosure = await dispatchTool(root, "close_host_outcome", {
      missionNumber: created[2].hostControl.closureRequest.boundArgs.missionNumber,
      attemptId: "missing-validation-attempt",
      status: "completed",
      summary: "已形成定位核对记录，但独立验证输出尚未生成。",
      artifactPaths: ["POSITIONING_ASSESSMENT.md"],
      validationPaths: ["POSITIONING_CHECK.log"]
    });
    assert.equal(failedClosure.isError, true);
    assert.deepEqual(snapshot(root), beforeFailedClosure);

    const status = await callTool(root, "query_dove_status", { operation: "status", language: "zh" });
    assertPublicStatus(status);
    assert.equal(status.currentSituation.trackedWorkstreams, 3);
    assert.equal(status.workStatus.state, "work-produced");
    assert.deepEqual(status.workStatus.currentOutputs, ["POSITIONING_ASSESSMENT.md"]);
    assert.equal(status.evidenceStatus.state, "evidence-recording-missing");
    assert.equal(status.evidenceStatus.currentEvidenceCount, 0);
    assert.equal(status.risksAndBlockers.length, 2);
    const renderedStatus = renderPublicReport(status, { language: "zh" });
    assert.equal(Object.hasOwn(status, "briefing"), false);
    assert.match(renderedStatus, /Work 1, 2/u);
    assert.match(renderedStatus, /BACKGROUND_SUMMARY\.md/u);
    assert.match(renderedStatus, /EXPERIMENT_SETUP\.md/u);
    assert.match(renderedStatus, /Work 3/u);
    assert.match(renderedStatus, /POSITIONING_ASSESSMENT\.md/u);
    assert.match(renderedStatus, /文档存在且包含明确结论/u);
    assert.match(renderedStatus, /separate validation output at POSITIONING_CHECK\.log/u);
    assert.match(renderedStatus, /当前没有可用的科研判断/u);
    assert.doesNotMatch(renderedStatus, /更新受影响成果和检查项的现行证据/u);
    assert.doesNotMatch(renderedStatus, /the selected (?:item|path)|mission-[a-z0-9._-]+|requirement-[a-z0-9._-]+|receipt-[a-z0-9._-]+|\/home\/|\.dove\//iu);
  } finally {
    cleanupTempRoot(root);
  }
});

test("retired MCP replay and mutation controls are rejected without writes", async () => {
  const cases = [
    ["query_dove_status", { operation: "status", resultMode: "full" }, "resultMode"],
    ["manage_dove_mission", { goal: "Reject mutation mode.", mutationMode: "direct-process" }, "mutationMode"],
    ["manage_dove_mission", { goal: "Reject confirmation state.", confirmed: true }, "confirmed"],
    ["manage_dove_mission", { goal: "Reject confirmation alias.", confirm: true }, "confirm"],
    ["manage_dove_mission", { goal: "Reject replay arguments.", confirmArgs: {} }, "confirmArgs"],
    ["manage_dove_mission", { goal: "Reject replay digest.", proposalDigest: "0".repeat(64) }, "proposalDigest"]
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

test("workspace path contracts distinguish canonical operation routes", () => {
  const sources = operationForTool("manage_dove_sources");
  assert.deepEqual(sources.routes.reject.pathFields, []);
  const rebuttal = operationForTool("record_dove_rebuttal");
  assert.equal(rebuttal.pathFields.includes("findingRefs"), true);
});

test("mission-bound canonical domain tools retain explicit mission inputs", () => {
  const byName = new Map(toolDefinitions.map((tool) => [tool.name, tool]));
  for (const name of [
    "manage_dove_sources", "record_dove_claims", "record_dove_experiment",
    "record_dove_draft", "record_dove_figure", "manage_dove_review", "record_dove_rebuttal"
  ]) {
    assert.ok(byName.get(name).inputSchema.properties.missionNumber, `${name} missionNumber`);
    assert.equal(Object.hasOwn(byName.get(name).inputSchema.properties, "missionId"), false, `${name} private missionId`);
  }
  assert.equal(Object.hasOwn(byName.get("manage_dove_lessons").inputSchema.properties, "missionNumber"), false);
  assert.deepEqual(Object.keys(byName.get("manage_dove_lessons").inputSchema.properties).sort(), ["binding", "markdown", "operation"]);
  assert.ok(byName.get("record_research_outcome").inputSchema.properties.missionNumber);
  assert.equal(Object.hasOwn(byName.get("record_research_outcome").inputSchema.properties, "missionId"), false);
  assert.equal(Object.hasOwn(byName.get("manage_dove_sources").inputSchema.properties, "decision"), false);
  assert.equal(Object.hasOwn(byName.get("record_dove_figure").inputSchema.properties, "providerId"), false);
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
      clientInfo: { name: "schema-17-test", version: "1.0.0" }
    });
    assert.equal(initialized.protocolVersion, "2025-06-18");
    assert.equal(initialized.serverInfo.name, "dove");
    client.notify("notifications/initialized");

    const listed = await client.call("tools/list");
    assert.deepEqual(listed.tools.map((tool) => tool.name), EXPECTED_TOOL_NAMES);
    await assert.rejects(client.call("tools/list", { surface: "operator" }), /does not accept unknown input.*\$\.surface/u);
    await assert.rejects(client.call("tools/list", { resultMode: "full" }), /does not accept unknown input.*\$\.resultMode/u);

    const status = extractToolEnvelope(await client.call("tools/call", { name: "query_dove_status", arguments: { operation: "status" } })).report;
    assertPublicStatus(status);
    assert.equal(status.currentSituation.trackedWorkstreams, 0);
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);

    const checkpoint = extractToolEnvelope(await client.call("tools/call", {
      name: "manage_dove_workspace",
      arguments: { operation: "initialize", mainline: "Exercise stdio checkpoint elicitation." }
    }));
    assert.equal(elicitationCount, 1);
    assert.equal(checkpoint.report.status, "initialized");
    assertPublicResult(checkpoint.report);
  } finally {
    client.kill();
    cleanupTempRoot(root);
  }
});

test("public completion and status preserve lifecycle state without raw identifiers", async () => {
  const root = createTempRoot("dove-mcp-mission-lifecycle-");
  try {
    const dependency = await materializeMission(root, "dependency-mission");
    const dependentMission = await materializeMission(root, "dependent-mission", {
      goal: "Wait for the dependency mission.",
      dependsOnMissionNumbers: [dependency.missionNumber],
      completionCriteria: [],
      evidenceRequirements: []
    });
    const dependent = await callTool(root, "query_dove_status", { operation: "completion", missionNumber: dependentMission.missionNumber });
    assertPublicCompletion(dependent);
    assert.equal(dependent.complete, false);
    assert.ok(dependent.completion.gaps.includes("A required earlier workstream is not complete."));

    const successor = await materializeMission(root, "successor-mission", {
      operation: "branch",
      goal: "Continue from the dependency mission through an explicit child.",
      parentMissionNumber: dependency.missionNumber,
      branchKind: "continuation",
      branchReason: "Continue the dependency research through a traceable child mission.",
      stopParentReason: "Stop the dependency mission before continuing through the child.",
      completionCriteria: [],
      evidenceRequirements: []
    });
    await materializeMission(root, "terminal-mission", {
      operation: "branch",
      goal: "Continue from the intermediate child through another explicit branch.",
      parentMissionNumber: successor.missionNumber,
      branchKind: "follow-up",
      branchReason: "Preserve the second transition as a traceable child mission.",
      stopParentReason: "Stop the intermediate child before starting the follow-up.",
      completionCriteria: [],
      evidenceRequirements: []
    });
    const historical = await callTool(root, "query_dove_status", { operation: "status", missionNumber: dependency.missionNumber });
    assertPublicStatus(historical);
    assert.notEqual(historical.workStatus.state, "complete");
    assert.equal(historical.risksAndBlockers.length > 0, true);
    assert.equal(Object.hasOwn(historical, "nextStep"), false);
    assert.equal(Object.hasOwn(historical, "attention"), false);

    const blockedDependent = await callTool(root, "query_dove_status", { operation: "completion", missionNumber: dependentMission.missionNumber });
    assertPublicCompletion(blockedDependent);
    assert.ok(blockedDependent.completion.gaps.includes("A required earlier workstream is not complete."));
  } finally {
    cleanupTempRoot(root);
  }
});

test("materialized status uses the public mission scope and remains zero-write", async () => {
  const root = createTempRoot("dove-mcp-status-current-");
  try {
    const currentMission = await materializeMission(root, "status-current");
    const status = await callTool(root, "query_dove_status", { operation: "status", detail: "full" });
    assertPublicStatus(status);
    assert.equal(status.currentSituation.trackedWorkstreams, 1);
    assert.equal(status.currentSituation.scope, "single workstream");
    assert.equal(Object.hasOwn(status, "missions"), false);
    assert.equal(Object.hasOwn(status, "diagnostics"), false);

    await materializeMission(root, "status-second");
    const afterMissions = snapshot(root);
      const multipleBriefing = await callTool(root, "query_dove_status", { operation: "status" });
    assertPublicStatus(multipleBriefing);
    assert.equal(multipleBriefing.currentSituation.scope, "workspace portfolio");
    assert.equal(Object.hasOwn(multipleBriefing, "technicalAppendix"), false);

    const multiple = await callTool(root, "query_dove_status", { operation: "status", detail: "full" });
    assertPublicStatus(multiple);
    assert.equal(multiple.technicalAppendix.bounded, true);
    assert.equal(multiple.technicalAppendix.workstreams.totalCount, 2);

    const explicit = await callTool(root, "query_dove_status", { operation: "status", missionNumber: currentMission.missionNumber });
    assertPublicStatus(explicit);
    assert.equal(explicit.currentSituation.scope, "single workstream");
    assert.equal(Object.hasOwn(explicit.currentSituation, "selectedMissionId"), false);
    assert.deepEqual(snapshot(root), afterMissions);
  } finally {
    cleanupTempRoot(root);
  }
});
