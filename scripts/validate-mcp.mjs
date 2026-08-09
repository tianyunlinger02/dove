#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { dispatchTool } from "../src/mcp/handlers.mjs";
import {
  TOOL_INPUT_SCHEMAS,
  TOOL_OPERATION_SCHEMAS,
  toolDefinitions
} from "../src/mcp/tool-definitions.mjs";
import { cleanupTempWorkspace, createTempWorkspace, resolveTempWorkspaceBase } from "./temp-workspace.mjs";

const ROOT = path.resolve(process.cwd());
const EXPECTED_TOOL_NAMES = [
  "query_dove_research",
  "manage_dove_workspace",
  "manage_dove_missions",
  "manage_dove_sources",
  "manage_dove_experiments",
  "manage_dove_claims",
  "manage_dove_reviews",
  "manage_dove_lessons"
];
const EXPECTED_OPERATIONS = {
  query_dove_research: ["overview", "diagnosis", "related-work", "hypotheses", "experiment-options", "result-synthesis", "claim-story", "branch-synthesis", "reviews"],
  manage_dove_workspace: ["initialize", "set-mainline"],
  manage_dove_missions: ["query", "create", "branch", "conclude"],
  manage_dove_sources: ["query", "record"],
  manage_dove_experiments: ["query", "freeze", "record-result"],
  manage_dove_claims: ["query", "record"],
  manage_dove_reviews: ["local-preflight", "prepare", "import", "coverage"],
  manage_dove_lessons: ["read", "replace"]
};
const READ_OPERATIONS = new Set([
  "query_dove_research:*",
  "manage_dove_missions:query",
  "manage_dove_sources:query",
  "manage_dove_experiments:query",
  "manage_dove_claims:query",
  "manage_dove_reviews:local-preflight",
  "manage_dove_reviews:prepare",
  "manage_dove_reviews:coverage",
  "manage_dove_lessons:read"
]);
const RETIRED_TOOL_NAMES = [
  "manage_dove_mission",
  "query_dove_status",
  "record_dove_experiment",
  "record_dove_claims",
  "record_dove_draft",
  "record_dove_figure",
  "manage_dove_review",
  "record_dove_rebuttal",
  "create_ambient_dove_mission",
  "close_host_outcome",
  "record_research_outcome",
  "create_dove_mission",
  "query_dove_mission",
  "ingest_execution_receipt",
  "assess_mission_completion"
];
const RETIRED_CONTROL_TERMS = [
  "missionNumber",
  "attemptId",
  "decisionRevision",
  "resultMode",
  "mutationMode",
  "confirmed",
  "proposalVersion",
  "proposalWorkspace",
  "proposalDigest",
  "proposalToken",
  "workspaceId",
  "hostControl",
  "researchHandoff",
  "closureRequest",
  "Outcome",
  "ResearchHandoff",
  "HostControl"
];
const PRIVATE_PROJECTION_KEYS = new Set(["writes", "diagnostics", "reviewedArtifactSetSha256"]);

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
      for (const [field, fieldSchema] of Object.entries(value ?? {})) {
        assertSealedObjects(fieldSchema, `${location}.properties.${field}`, seen);
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => assertSealedObjects(item, `${location}.${key}[${index}]`, seen));
    } else {
      assertSealedObjects(value, `${location}.${key}`, seen);
    }
  }
}

function snapshot(root) {
  const files = new Map();
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(full);
      else files.set(path.relative(root, full), entry.isSymbolicLink() ? `link:${fs.readlinkSync(full)}` : fs.readFileSync(full).toString("base64"));
    }
  };
  visit(root);
  return Object.fromEntries([...files.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function assertPublicProjection(value, location = "structuredContent") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPublicProjection(item, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string") assert.equal(value.startsWith(".dove/"), false, `${location} must not expose private .dove paths`);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    assert.equal(PRIVATE_PROJECTION_KEYS.has(key), false, `${location}.${key} must remain private`);
    assert.equal(/(?:Digest|Token|Binding)$/u.test(key), false, `${location}.${key} must remain private`);
    assertPublicProjection(item, `${location}.${key}`);
  }
}

function assertSuccess(result, label) {
  assert.notEqual(result.isError, true, `${label}: ${result.content?.[0]?.text ?? "unknown MCP error"}`);
  assert.deepEqual(Object.keys(result.structuredContent).sort(), ["operation", "research", "status"]);
  assertPublicProjection(result.structuredContent);
}

function assertFailure(result, label) {
  assert.equal(result.isError, true, `${label} must fail`);
  assert.deepEqual(Object.keys(result.structuredContent).sort(), ["operation", "research", "status"]);
  assertPublicProjection(result.structuredContent);
}

const fullNames = toolDefinitions.map((item) => item.name);
assertUnique(fullNames, "MCP tool registry");
assert.deepEqual(fullNames, EXPECTED_TOOL_NAMES, "MCP discovery must expose exactly the current eight tools");
assert.deepEqual([...TOOL_INPUT_SCHEMAS.keys()], EXPECTED_TOOL_NAMES, "Every current tool must have one public input schema");
assert.equal(TOOL_OPERATION_SCHEMAS.size, 0, "Research Format 1 must not retain the retired operation-branch registry");

const serializedDefinitions = JSON.stringify(toolDefinitions);
for (const retired of RETIRED_TOOL_NAMES) {
  assert.equal(fullNames.includes(retired), false, `Retired MCP tool ${retired} must not remain discoverable`);
  assert.equal(TOOL_INPUT_SCHEMAS.has(retired), false, `Retired MCP tool ${retired} must not retain a public schema`);
}
for (const term of RETIRED_CONTROL_TERMS) {
  assert.doesNotMatch(serializedDefinitions, new RegExp(term, "u"), `Public MCP schemas must not expose retired control-plane term ${term}`);
}

for (const definition of toolDefinitions) {
  const schema = definition.inputSchema;
  assert.equal(schema.type, "object", `${definition.name} needs a flat top-level object schema`);
  assert.equal(schema.additionalProperties, false, `${definition.name} must reject unknown top-level fields`);
  assertSealedObjects(schema, `${definition.name}.inputSchema`);
  assert.deepEqual(schema.properties.operation.enum, EXPECTED_OPERATIONS[definition.name], `${definition.name} operation schema must match Research Format 1`);
  assert.equal(schema.required.includes("operation"), true, `${definition.name} must require operation`);
}

const scratchBase = resolveTempWorkspaceBase();
assert.equal(scratchBase, path.join(ROOT, ".tmp", "dove-workspaces"), "MCP validation scratch must be repository-local");
assert.equal(scratchBase.startsWith(`${ROOT}${path.sep}`), true, "MCP validation scratch must stay inside the repository");
assert.equal(path.resolve(scratchBase).startsWith(`${path.parse(ROOT).root}tmp${path.sep}`), false, "MCP validation must not dispatch from root /tmp");

const root = createTempWorkspace("validate-mcp-rf1-");
let readOperationsChecked = 0;
let writeOperationsChecked = 0;
let unknownFieldsChecked = 0;
let retiredToolsChecked = 0;
try {
  assert.equal(path.dirname(root), scratchBase, "MCP dispatch workspace must use repository-local scratch");

  for (const name of RETIRED_TOOL_NAMES) {
    const before = snapshot(root);
    assertFailure(await dispatchTool(root, name, {}), `${name} direct dispatch`);
    assert.deepEqual(snapshot(root), before, `${name} must not write workspace state`);
    retiredToolsChecked += 1;
  }

  for (const name of EXPECTED_TOOL_NAMES) {
    const schema = TOOL_INPUT_SCHEMAS.get(name);
    const args = Object.fromEntries(schema.required.map((field) => {
      if (field === "operation") return [field, schema.properties.operation.enum[0]];
      const fieldSchema = schema.properties[field];
      const type = Array.isArray(fieldSchema.type) ? fieldSchema.type.find((item) => item !== "null") : fieldSchema.type;
      if (type === "array") return [field, []];
      if (type === "object") return [field, {}];
      if (type === "number" || type === "integer") return [field, 0];
      if (type === "boolean") return [field, false];
      return [field, "validation"];
    }));
    const before = snapshot(root);
    const result = await dispatchTool(root, name, { ...args, unexpectedField: true });
    assertFailure(result, `${name} unknown-field validation`);
    assert.match(result.content[0].text, /不符合公开 Dove 工具合同|does not match the public Dove tool contract/iu);
    assert.doesNotMatch(result.content[0].text, /unexpectedField|not allowed|\$\./iu);
    assert.equal(result.structuredContent.research.reason, "invalid-input");
    assert.deepEqual(snapshot(root), before, `${name} unknown-field rejection must be zero-write`);
    unknownFieldsChecked += 1;
  }

  const initialized = await dispatchTool(root, "manage_dove_workspace", {
    operation: "initialize",
    researchQuestion: "Does the current MCP surface preserve Research Format 1 semantics?",
    mainline: "Validate sealed schemas, semantic identifiers, public privacy, and contained writes.",
    contributionIntent: "Establish the exact Dove 0.7.0 MCP contract.",
    currentFocus: "Exercise each current operation through repository-local scratch."
  });
  assertSuccess(initialized, "workspace initialize");
  assert.equal(fs.existsSync(path.join(root, ".dove", "format.json")), true);
  writeOperationsChecked += 1;

  const missionArgs = {
    missionId: "mcp-validation",
    goal: "Validate current MCP read and write behavior.",
    requirements: ["Preserve negative evidence."],
    assumptions: ["The scratch workspace is isolated."],
    scope: ["Current eight MCP tools."],
    outOfScope: ["Host control planes."],
    evidenceRequirements: ["Direct dispatch results."],
    competingHypotheses: ["The surface is current.", "Legacy controls remain."],
    openQuestions: ["Are all projections private?"],
    contextRefs: ["validator:validate-mcp"],
    contributionRole: "validation"
  };
  assertSuccess(await dispatchTool(root, "manage_dove_missions", { operation: "create", ...missionArgs }), "mission create");
  writeOperationsChecked += 1;

  const sourceFile = path.join(root, "materials", "source.txt");
  fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
  fs.writeFileSync(sourceFile, "captured source\n");
  assertSuccess(await dispatchTool(root, "manage_dove_sources", {
    operation: "record",
    missionId: "mcp-validation",
    sourceId: "source-validation",
    title: "Validation Source",
    authors: ["Dove Validator"],
    locator: "https://example.test/validation",
    summary: "A repository-local source capture used by MCP validation.",
    conditions: ["Scratch only."],
    relationship: "testable-gap",
    conflicts: [],
    limitations: ["Synthetic fixture."],
    capturePath: sourceFile
  }), "source record");
  writeOperationsChecked += 1;

  const plan = {
    operation: "freeze",
    missionId: "mcp-validation",
    experimentId: "experiment-validation",
    title: "MCP semantic operation validation",
    hypothesisRefs: ["The surface is current."],
    protocol: ["Dispatch every current operation."],
    inputs: ["Repository-local scratch workspace."],
    comparisons: ["Read snapshot versus post-dispatch snapshot."],
    metrics: ["Write delta."],
    discriminatingObservations: ["Reads preserve an identical snapshot."],
    successConditions: ["Every dispatch matches its declared semantics."],
    stopConditions: ["Stop after one complete pass."],
    constraints: ["Never inspect repository root .dove state."],
    expectedArtifacts: [".dove/experiments/experiment-validation.result.json"],
    cost: "One local validation pass.",
    risk: "A stale validator may encode retired assumptions.",
    failureValue: "Any failure identifies the stale contract.",
    contributionRole: "surface-validation"
  };
  assertSuccess(await dispatchTool(root, "manage_dove_experiments", plan), "experiment freeze");
  writeOperationsChecked += 1;

  assertSuccess(await dispatchTool(root, "manage_dove_experiments", {
    operation: "record-result",
    missionId: "mcp-validation",
    experimentId: "experiment-validation",
    kind: "positive",
    summary: "Current MCP operations dispatched as declared.",
    observations: ["Read operations preserved snapshots."],
    measurements: [{ metric: "read-write-delta", value: 0 }],
    denominator: { total: 1, observed: 1, failed: 0, excluded: 0 },
    hypothesisImpacts: [{ hypothesisRef: "The surface is current.", impact: "supported" }],
    claimImpacts: [],
    unexpectedObservations: [],
    uncertainty: ["Only the focused validator path was exercised."],
    artifactRefs: [],
    failures: [],
    deviations: [],
    limitations: ["Synthetic scratch fixture."]
  }), "experiment record-result");
  writeOperationsChecked += 1;

  assertSuccess(await dispatchTool(root, "manage_dove_claims", {
    operation: "record",
    missionId: "mcp-validation",
    claims: [{
      claimId: "claim-validation",
      statement: "The Dove 0.7.0 MCP surface exposes exactly eight Research Format 1 tools.",
      supportRefs: ["experiment:experiment-validation"],
      counterEvidenceRefs: [],
      missingEvidence: [],
      cannotSay: ["This validator does not establish scientific authority."],
      uncertainty: ["Only focused MCP validation is covered."],
      assessment: "supported",
      storyRole: "release-validation",
      artifactRefs: []
    }]
  }), "claim record");
  writeOperationsChecked += 1;

  const reviewArtifact = path.join(root, "paper", "draft.md");
  fs.mkdirSync(path.dirname(reviewArtifact), { recursive: true });
  fs.writeFileSync(reviewArtifact, "# Validation Draft\n");
  assertSuccess(await dispatchTool(root, "manage_dove_reviews", {
    operation: "import",
    missionId: "mcp-validation",
    exchangeId: "review-validation",
    reviewId: "review-validation",
    artifactPaths: [reviewArtifact],
    review: {
      status: "completed",
      verdict: "bounded",
      summary: "The focused MCP claim is appropriately scoped.",
      rubric: ["Schema exactness", "Projection privacy"],
      findings: [{ severity: "low", summary: "Keep the validator focused." }],
      actionItems: [],
      report: "# Review\n\nThe validator covers the declared MCP boundary.\n",
      provenance: { host: "validator", model: "deterministic-fixture" },
      limitations: ["Not an independent scientific review."],
      reviewedAt: "2026-08-08T00:00:00.000Z"
    }
  }), "review import");
  writeOperationsChecked += 1;

  const lessons = "# Lessons\n\nKeep MCP validation aligned with the exact current research format.\n";
  assertSuccess(await dispatchTool(root, "manage_dove_lessons", { operation: "replace", markdown: lessons }), "lessons replace");
  writeOperationsChecked += 1;

  const update = await dispatchTool(root, "manage_dove_workspace", {
    operation: "set-mainline",
    researchQuestion: "Does the current MCP surface preserve Research Format 1 semantics?",
    mainline: "The exact eight-tool surface is validated through repository-local dispatch.",
    contributionIntent: "Establish the exact Dove 0.7.0 MCP contract.",
    currentFocus: "Keep validators free of retired control-plane assumptions.",
    changeReason: "Completed focused MCP dispatch validation."
  });
  assertSuccess(update, "workspace set-mainline");
  writeOperationsChecked += 1;

  assertSuccess(await dispatchTool(root, "manage_dove_missions", {
    operation: "branch",
    missionId: "mcp-validation-branch",
    parentMissionId: "mcp-validation",
    dependsOnMissionIds: [],
    branchKind: "follow-up",
    branchReason: "Preserve a semantic-id branch fixture.",
    goal: "Confirm semantic mission branching.",
    requirements: [],
    assumptions: [],
    scope: ["Mission branching."],
    outOfScope: [],
    evidenceRequirements: [],
    competingHypotheses: [],
    openQuestions: [],
    contextRefs: ["mission:mcp-validation"],
    contributionRole: "branch-validation"
  }), "mission branch");
  writeOperationsChecked += 1;

  const readCases = [
    ["query_dove_research", { operation: "overview" }],
    ["query_dove_research", { operation: "diagnosis", missionId: "mcp-validation" }],
    ["query_dove_research", { operation: "related-work", missionId: "mcp-validation" }],
    ["query_dove_research", { operation: "hypotheses", missionId: "mcp-validation" }],
    ["query_dove_research", { operation: "experiment-options", missionId: "mcp-validation" }],
    ["query_dove_research", { operation: "result-synthesis", missionId: "mcp-validation" }],
    ["query_dove_research", { operation: "claim-story", missionId: "mcp-validation" }],
    ["query_dove_research", { operation: "branch-synthesis" }],
    ["query_dove_research", { operation: "reviews", missionId: "mcp-validation" }],
    ["manage_dove_missions", { operation: "query", missionId: "mcp-validation" }],
    ["manage_dove_sources", { operation: "query", missionId: "mcp-validation" }],
    ["manage_dove_experiments", { operation: "query", view: "result-synthesis", missionId: "mcp-validation" }],
    ["manage_dove_claims", { operation: "query", missionId: "mcp-validation" }],
    ["manage_dove_reviews", { operation: "local-preflight", missionId: "mcp-validation", exchangeId: "review-preflight", artifactPaths: [reviewArtifact] }],
    ["manage_dove_reviews", { operation: "prepare", missionId: "mcp-validation", exchangeId: "review-prepare", artifactPaths: [reviewArtifact] }],
    ["manage_dove_reviews", { operation: "coverage", missionId: "mcp-validation", reviewId: "review-validation" }],
    ["manage_dove_lessons", { operation: "read" }]
  ];
  for (const [name, args] of readCases) {
    const key = `${name}:${name === "query_dove_research" ? "*" : args.operation}`;
    assert.equal(READ_OPERATIONS.has(key), true, `${key} must be classified as read-only`);
    const before = snapshot(root);
    const result = await dispatchTool(root, name, args);
    assertSuccess(result, `${name}.${args.operation}`);
    assert.deepEqual(snapshot(root), before, `${name}.${args.operation} must not mutate workspace state`);
    if (name === "query_dove_research" || args.operation === "query" || args.operation === "read") {
      assert.equal(result.structuredContent.research.zeroWrite, true, `${name}.${args.operation} must declare zeroWrite`);
    }
    readOperationsChecked += 1;
  }

  assertSuccess(await dispatchTool(root, "manage_dove_missions", {
    operation: "conclude",
    missionId: "mcp-validation",
    synthesis: "The current eight-tool MCP surface matches Research Format 1.",
    failures: [],
    limitations: ["Focused validation only."],
    uncertainty: ["Broader project checks are outside this validator run."],
    sourceIds: ["source-validation"],
    experimentIds: ["experiment-validation"],
    claimIds: ["claim-validation"],
    recommendedBranches: ["Run broader release checks separately."]
  }), "mission conclude");
  writeOperationsChecked += 1;
} finally {
  cleanupTempWorkspace(root);
}

console.log(JSON.stringify({
  status: "passed",
  toolCount: fullNames.length,
  operationCount: Object.values(EXPECTED_OPERATIONS).flat().length,
  readOperationsChecked,
  writeOperationsChecked,
  unknownFieldsChecked,
  retiredToolsChecked,
  scratchBase: path.relative(ROOT, scratchBase)
}, null, 2));
