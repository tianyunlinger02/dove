import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { COMMAND_SURFACE_BY_ID } from "../../src/core/command-manifest.mjs";
import { ARTIFACT_PATHS, DOVE_WORKSPACE_SCHEMA_VERSION } from "../../src/core/schema.mjs";
import { operationForTool, operationInteraction, operationRequiresCheckpoint } from "../../src/core/operation-registry.mjs";
import { readCurrentResearchDecision } from "../../src/core/research-decision-store.mjs";
import { dispatchTool } from "../../src/mcp/handlers.mjs";
import { toolDefinitions } from "../../src/mcp/tool-definitions.mjs";
import { createMcpStdioClient } from "../../scripts/mcp-stdio-client.mjs";
import { assertNoCompactPublicLeaks } from "../helpers/compact-public.mjs";
import { initializeWorkspace, materializeRootMission } from "../helpers/current-schema-workspace.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

const ROOT = process.cwd();
const SERVER = path.join(ROOT, "mcp", "dove-state-server.mjs");

function extractEnvelope(result) {
  assert.notEqual(result.isError, true, result.content?.[0]?.text);
  assert.ok(result.structuredContent && typeof result.structuredContent === "object", "Expected public MCP structuredContent");
  assert.ok(result.structuredContent.report && result.structuredContent.hostControl, "Expected the public report and HostControl channels");
  if (result.structuredContent.hostControl.presentation?.mode === "silent") {
    assert.deepEqual(result.content, [], "Silent results must not emit human MCP text");
  } else {
    assert.ok(result.content?.[0]?.text, "Expected human-readable MCP text content");
    assert.throws(() => JSON.parse(result.content[0].text), /Unexpected token|Unexpected non-whitespace|JSON/u, "MCP text must not be a raw JSON fallback");
  }
  return result.structuredContent;
}

function extract(result) {
  return extractEnvelope(result).report;
}

function missionFileCount(root) {
  const directory = path.join(root, ".dove", "missions");
  return fs.existsSync(directory) ? fs.readdirSync(directory).length : 0;
}

function readMissions(root) {
  const directory = path.join(root, ARTIFACT_PATHS.missionsDir);
  return fs.readdirSync(directory)
    .map((file) => JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")))
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)) || left.missionId.localeCompare(right.missionId));
}

function missionTransitionCount(root) {
  const directory = path.join(root, ARTIFACT_PATHS.missionTransitionsDir);
  return fs.existsSync(directory) ? fs.readdirSync(directory).length : 0;
}

function workspaceSnapshot(root) {
  const files = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(fullPath);
      else files[path.relative(root, fullPath)] = fs.readFileSync(fullPath).toString("base64");
    }
  };
  visit(root);
  return files;
}

async function createMission(root, args) {
  initializeWorkspace(root);
  const result = extract(await dispatchTool(root, "manage_dove_mission", {
    operation: args.operation ?? "create-root",
    mode: args.mode ?? "research",
    ...args
  }, { requestCheckpointApproval: async () => "accept" }));
  const missions = fs.readdirSync(path.join(root, ".dove", "missions"));
  const missionId = missions.map((file) => ({ file, stat: fs.statSync(path.join(root, ".dove", "missions", file)) })).sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)[0].file.replace(/\.json$/u, "");
  return { result, missionId };
}

function publicDecisionArgs(missionNumber, decision, overrides = {}) {
  const hypotheses = overrides.hypotheses ?? decision.hypotheses.map((item) => ({
    statement: item.statement,
    assessment: item.assessment,
    supportingEvidence: [...item.supportingEvidence],
    counterEvidence: [...item.counterEvidence],
    falsificationCondition: item.falsificationCondition
  }));
  const openQuestions = overrides.openQuestions ?? decision.openQuestions.map((item) => ({ question: item.question }));
  const target = hypotheses.length > 0 ? "hypothesis:1" : "question:1";
  return {
    operation: "reevaluate-research-decision",
    missionNumber,
    requestedDisposition: overrides.requestedDisposition ?? "continue",
    synthesis: overrides.synthesis ?? "The bounded direction remains viable for one explicit next action.",
    hypotheses,
    routes: overrides.routes ?? decision.routes.map((item) => ({ routeId: item.routeId, summary: item.summary, disposition: item.disposition, rationale: item.rationale })),
    openQuestions,
    evidenceRefs: overrides.evidenceRefs ?? [],
    reasonCodes: overrides.reasonCodes ?? [],
    nextAction: Object.hasOwn(overrides, "nextAction") ? overrides.nextAction : {
      kind: "analysis",
      description: "Run one current bounded analysis.",
      rationale: "The current judgment authorizes one more bounded step.",
      targets: [target],
      successConditions: ["Return one inspectable bounded result."],
      stopConditions: ["Stop after one action."],
      expectedEvidence: ["bounded-result"],
      budget: { actions: 1, timeMinutes: 30, costUnits: 1 }
    }
  };
}

async function ownArtifact(root, missionNumber, relativePath, content = "Current review material.\n") {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  return extract(await dispatchTool(root, "close_host_outcome", {
    missionNumber,
    attemptId: `review-material-${missionNumber}-${path.basename(relativePath).replace(/[^a-z0-9._-]+/giu, "-").toLowerCase()}`,
    status: "completed",
    summary: "Record current review material.",
    artifactPaths: [relativePath]
  }));
}

test("lightweight command contracts classify all twelve surfaces", () => {
  assert.equal(Object.keys(COMMAND_SURFACE_BY_ID).length, 12);
  assert.equal(COMMAND_SURFACE_BY_ID["dove.mission"].operationId, "command.dove.mission");
  assert.equal(COMMAND_SURFACE_BY_ID["dove.mission"].interaction, "checkpoint");
  assert.equal(COMMAND_SURFACE_BY_ID["dove.mission"].continuation, "terminal");
  assert.equal(COMMAND_SURFACE_BY_ID["dove.mission"].closure, "none");
  assert.deepEqual(COMMAND_SURFACE_BY_ID["dove.workspace"].requiredTools, ["query_dove_status", "manage_dove_workspace"]);
  assert.equal(COMMAND_SURFACE_BY_ID["dove.workspace"].interaction, "write");
  assert.equal(COMMAND_SURFACE_BY_ID["dove.workspace"].checkpoint, false);
  assert.deepEqual(COMMAND_SURFACE_BY_ID["dove.mission"].requiredTools, ["query_dove_status", "manage_dove_mission"]);
  assert.equal(COMMAND_SURFACE_BY_ID["dove.status"].interaction, "read");
  assert.equal(COMMAND_SURFACE_BY_ID["dove.source"].interaction, "write");
  assert.equal(COMMAND_SURFACE_BY_ID["dove.note"].interaction, "write");
  assert.equal(COMMAND_SURFACE_BY_ID["dove.experience"].interaction, "write");
  assert.equal(COMMAND_SURFACE_BY_ID["dove.experiment"].interaction, "write");
  assert.equal(operationInteraction(operationForTool("create_ambient_dove_mission")), "ambient-create");
  assert.equal(operationInteraction(operationForTool("close_host_outcome")), "write");
  assert.equal(operationRequiresCheckpoint(operationForTool("manage_dove_review"), { operation: "scope" }), false);
  assert.equal(operationInteraction(operationForTool("manage_dove_review"), { operation: "scope" }), "read");
  assert.equal(operationRequiresCheckpoint(operationForTool("manage_dove_review"), { operation: "archive" }), false);
  assert.equal(operationInteraction(operationForTool("manage_dove_review"), { operation: "archive" }), "write");
});

test("direct Skill start returns the exact mission binding used by the next domain call", async () => {
  const root = createTempRoot("dove-mcp-skill-binding-");
  try {
    initializeWorkspace(root);
    const started = extractEnvelope(await dispatchTool(root, "manage_dove_mission", {
      operation: "start-skill",
      skill: "source",
      goal: "Inspect the current external source candidates."
    }));

    assert.equal(started.report.status, "materialized");
    assert.equal(Object.hasOwn(started.report, "missionNumber"), false);
    assert.deepEqual(started.selector, { missionNumber: 1 });
    assert.equal(started.hostControl.closureRequest.tool, "record_research_outcome");
    assert.equal(started.hostControl.closureRequest.boundArgs.missionNumber, started.selector.missionNumber);
    assert.ok(started.researchHandoff);
    assert.deepEqual(started.hostControl.closureRequest.requiredOutcomeFields, ["attemptId", "status", "performedActionCount", "actualUsage", "evidenceReturned", "artifactPaths", "validationPaths", "facts", "startedAt", "finishedAt"]);
    assert.deepEqual(started.hostControl.closureRequest.outcomeContract.evidenceReturned.allowedValues, started.researchHandoff.expectedEvidence);
    const rootMission = readMissions(root)[0];
    assert.equal(rootMission.mode, "research");
    assert.equal(Object.hasOwn(rootMission, "parentMissionId"), false);
    const { missionNumber } = started.selector;

    const sources = extract(await dispatchTool(root, "manage_dove_sources", {
      operation: "query",
      missionNumber
    }));
    assert.equal(sources.status, "empty");
    assert.deepEqual(sources.sources, []);
    assert.equal(missionFileCount(root), 1);
    assertNoCompactPublicLeaks(started.report);
    assertNoCompactPublicLeaks(sources);
  } finally {
    cleanupTempRoot(root);
  }
});

test("Skill result selector and typed closure cannot diverge before commit", async () => {
  const root = createTempRoot("dove-mcp-skill-selector-atomic-");
  try {
    initializeWorkspace(root);
    const before = workspaceSnapshot(root);
    const result = await dispatchTool(root, "manage_dove_mission", {
      operation: "start-skill",
      skill: "source",
      goal: "Abort if the public Skill bindings diverge."
    }, {
      callbackResolvers: { missionNumber: () => 999 }
    });

    assert.equal(result.isError, true);
    assert.deepEqual(workspaceSnapshot(root), before);
    assert.equal(missionFileCount(root), 0);
    assert.equal(Object.hasOwn(result.structuredContent, "selector"), false);
    assert.doesNotMatch(JSON.stringify(result.structuredContent), /mission-[a-z0-9._-]+|parentMissionId|routing|contextArtifactCount/u);
  } finally {
    cleanupTempRoot(root);
  }
});

test("Skill start creates a research root without implicit latest-mission routing", async () => {
  const root = createTempRoot("dove-mcp-skill-root-routing-");
  try {
    await createMission(root, { mode: "ordinary", goal: "Keep the first existing mission active." });
    await createMission(root, { mode: "ordinary", goal: "Keep the second existing mission active." });
    const started = extractEnvelope(await dispatchTool(root, "manage_dove_mission", {
      operation: "start-skill",
      skill: "note",
      goal: "Synthesize one bounded internal project question."
    }));

    assert.deepEqual(started.selector, { missionNumber: 3 });
    assert.ok(started.researchHandoff);
    assert.equal(started.hostControl.closureRequest.tool, "record_research_outcome");
    assert.deepEqual(started.hostControl.closureRequest.boundArgs, { missionNumber: 3, decisionRevision: 1 });
    const missions = readMissions(root);
    assert.equal(missions[2].mode, "research");
    assert.equal(Object.hasOwn(missions[2], "parentMissionId"), false);
    assert.equal(missionTransitionCount(root), 0);
    assert.doesNotMatch(JSON.stringify(started), /mission-[a-z0-9._-]+|parentMissionId|routing|contextArtifactCount/u);
    assertNoCompactPublicLeaks(started, { ignoredKeys: ["hostControl", "researchHandoff"] });
  } finally {
    cleanupTempRoot(root);
  }
});

test("explicit public parent hint creates a research Skill child and leaves its parent active", async () => {
  const root = createTempRoot("dove-mcp-skill-explicit-parent-");
  try {
    const parent = await createMission(root, { mode: "ordinary", goal: "Own the active parent work." });
    const started = extractEnvelope(await dispatchTool(root, "manage_dove_mission", {
      operation: "start-skill",
      skill: "draft",
      goal: "Draft one bounded child result.",
      parentMissionNumber: 1
    }));

    assert.deepEqual(started.selector, { missionNumber: 2 });
    assert.ok(started.researchHandoff);
    assert.equal(started.hostControl.closureRequest.tool, "record_research_outcome");
    assert.deepEqual(started.hostControl.closureRequest.boundArgs, { missionNumber: 2, decisionRevision: 1 });
    const child = readMissions(root)[1];
    assert.equal(child.mode, "research");
    assert.equal(child.parentMissionId, parent.missionId);
    assert.equal(child.branchKind, "follow-up");
    assert.equal(missionTransitionCount(root), 0);
  } finally {
    cleanupTempRoot(root);
  }
});

test("a terminal mission may remain the immutable parent of later research Skill work", async () => {
  for (const [suffix, selectorArgs] of [
    ["explicit", { parentMissionNumber: 1 }],
    ["context", { contextArtifactPaths: ["outputs/terminal-parent-context.md"] }]
  ]) {
    const root = createTempRoot(`dove-mcp-skill-terminal-parent-${suffix}-`);
    try {
      const parent = await createMission(root, {
        mode: "ordinary",
        goal: "Own one completed result that later research may use.",
        artifacts: [{ path: "outputs/terminal-parent-context.md", required: true, role: "output" }]
      });
      await ownArtifact(root, 1, "outputs/terminal-parent-context.md");
      assert.equal(missionTransitionCount(root), 1);

      const started = extractEnvelope(await dispatchTool(root, "manage_dove_mission", {
        operation: "start-skill",
        skill: "figure",
        goal: "Create a figure from the completed parent result.",
        ...selectorArgs
      }));
      const child = readMissions(root)[1];
      assert.equal(child.mode, "research");
      assert.equal(child.parentMissionId, parent.missionId);
      assert.deepEqual(started.selector, { missionNumber: 2 });
      assert.equal(started.hostControl.closureRequest.tool, "record_research_outcome");
      assert.equal(missionTransitionCount(root), 1, "starting later work must not reactivate or replace the terminal parent");
    } finally {
      cleanupTempRoot(root);
    }
  }
});

test("context artifact ownership selects one research Skill child parent", async () => {
  const root = createTempRoot("dove-mcp-skill-context-parent-");
  try {
    const parent = await createMission(root, {
      mode: "ordinary",
      goal: "Own the current context artifact while another required output remains pending.",
      artifacts: [
        { path: "outputs/context.md", required: true, role: "output" },
        { path: "outputs/pending.md", required: true, role: "output" }
      ]
    });
    await ownArtifact(root, 1, "outputs/context.md");
    const started = extractEnvelope(await dispatchTool(root, "manage_dove_mission", {
      operation: "start-skill",
      skill: "review",
      goal: "Review the uniquely owned context artifact.",
      contextArtifactPaths: ["outputs/context.md"]
    }));

    const child = readMissions(root)[1];
    assert.equal(child.mode, "research");
    assert.equal(child.parentMissionId, parent.missionId);
    assert.deepEqual(started.selector, { missionNumber: 2 });
    assert.equal(started.hostControl.closureRequest.tool, "record_research_outcome");
    assert.equal(missionTransitionCount(root), 0);
  } finally {
    cleanupTempRoot(root);
  }
});

test("Skill parent conflicts and unknown context paths fail before any write", async () => {
  const root = createTempRoot("dove-mcp-skill-context-conflicts-");
  try {
    await createMission(root, { mode: "ordinary", goal: "Own context artifact alpha." });
    await createMission(root, { mode: "ordinary", goal: "Own context artifact beta." });
    await ownArtifact(root, 1, "outputs/alpha.md");
    await ownArtifact(root, 2, "outputs/beta.md");
    fs.writeFileSync(path.join(root, "outputs/unowned.md"), "Existing but not owned by any Mission.\n");

    for (const args of [
      { contextArtifactPaths: ["outputs/alpha.md", "outputs/beta.md"] },
      { parentMissionNumber: 2, contextArtifactPaths: ["outputs/alpha.md"] },
      { contextArtifactPaths: ["outputs/unowned.md"] },
      { contextArtifactPaths: ["outputs/unknown.md"] }
    ]) {
      const before = workspaceSnapshot(root);
      const result = await dispatchTool(root, "manage_dove_mission", {
        operation: "start-skill",
        skill: "figure",
        goal: "Reject ambiguous or unavailable context routing.",
        ...args
      });
      assert.equal(result.isError, true);
      assert.deepEqual(workspaceSnapshot(root), before);
      assert.equal(missionFileCount(root), 2);
      assert.doesNotMatch(JSON.stringify(result.structuredContent), /mission-[a-z0-9._-]+|parentMissionId|routing|contextArtifactCount/u);
    }
  } finally {
    cleanupTempRoot(root);
  }
});

test("host-default MCP schemas hide result and replay controls", () => {
  for (const tool of toolDefinitions) {
    for (const field of [
      "resultMode", "mutationMode", "confirmed", "proposalVersion", "proposalWorkspace", "proposalDigest",
      "proposalToken", "workspaceId"
    ]) {
      assert.equal(Object.hasOwn(tool.inputSchema.properties, field), false, `${tool.name}.${field}`);
    }
  }
  const missionTool = toolDefinitions.find((tool) => tool.name === "manage_dove_mission");
  assert.deepEqual(missionTool.inputSchema.required, []);
  assert.equal(Object.hasOwn(missionTool.inputSchema, "anyOf"), false);
  assert.equal(Object.hasOwn(missionTool.inputSchema, "oneOf"), false);
  assert.ok(missionTool.inputSchema.properties.missionNumber);
  assert.ok(missionTool.inputSchema.properties.missionGoal);
  assert.equal(Object.hasOwn(missionTool.inputSchema.properties, "decisionBudget"), false);
  assert.equal(Object.hasOwn(missionTool.inputSchema, "allOf"), false);
  assert.equal(Object.hasOwn(toolDefinitions.find((tool) => tool.name === "manage_dove_workspace").inputSchema, "oneOf"), false);
});

test("checkpoint actions accept, decline, and cancel without exposing control data", async () => {
  for (const action of ["accept", "decline", "cancel"]) {
    const root = createTempRoot(`dove-mcp-checkpoint-${action}-`);
    try {
      const envelope = extractEnvelope(await dispatchTool(root, "manage_dove_workspace", { operation: "initialize", mainline: `Exercise ${action}.` }, {
        requestCheckpointApproval: async (approval) => {
          assertNoCompactPublicLeaks(approval);
          return action;
        }
      }));
      const result = envelope.report;
      assertNoCompactPublicLeaks(result);
      assert.equal(result.status, action === "accept" ? "initialized" : action === "decline" ? "declined" : "cancelled");
      assert.equal(envelope.hostControl.classification.terminal, true);
      assert.equal(envelope.hostControl.classification.retry, "none");
      if (action !== "accept") assert.equal(result.zeroWrite, true);
      assert.equal(fs.existsSync(path.join(root, ".dove")), action === "accept");
    } finally {
      cleanupTempRoot(root);
    }
  }
});

test("explicit mission invocation always elicits and returns terminal HostControl", async () => {
  const root = createTempRoot("dove-mcp-mission-checkpoint-");
  let approvalCalls = 0;
  try {
    initializeWorkspace(root);
    fs.writeFileSync(path.join(root, "README.md"), "# Demo\n\nA focused project description.\n", "utf8");
    const envelope = extractEnvelope(await dispatchTool(root, "manage_dove_mission", {
      operation: "create-root",
      mode: "ordinary",
      goal: "Verify whether the first README paragraph accurately states the project positioning without modifying files.",
      scope: ["README first paragraph", "current workspace project materials"],
      outOfScope: ["Modify README.md or any other file"],
      artifacts: [{ path: "README.md", required: true, role: "supporting" }],
      completionCriteria: ["State whether the positioning is accurate and cite the workspace evidence used."],
      evidenceRequirements: ["artifact:README.md"]
    }, { requestCheckpointApproval: async () => { approvalCalls += 1; return "accept"; } }));
    const result = envelope.report;
    assert.equal(approvalCalls, 1);
    assert.equal(result.status, "materialized");
    assert.deepEqual(envelope.hostControl.classification, {
      outcome: "succeeded",
      category: "success",
      phase: "execution",
      blocking: false,
      userAction: "none",
      terminal: true,
      continuation: "terminal",
      closure: "none",
      retry: "none"
    });
    assertNoCompactPublicLeaks(result);
    assert.equal(missionFileCount(root), 1);
  } finally {
    cleanupTempRoot(root);
  }
});

test("explicit research mission resumes its bounded handoff with one typed outcome closure", async () => {
  const root = createTempRoot("dove-mcp-research-mission-checkpoint-");
  try {
    initializeWorkspace(root);
    const envelope = extractEnvelope(await dispatchTool(root, "manage_dove_mission", {
      operation: "create-root",
      mode: "research",
      goal: "Freeze one bounded comparison protocol before changing the method.",
      artifacts: [{ path: "docs/protocol.md", required: true, role: "output" }],
      completionCriteria: ["The protocol records the comparison and stop conditions."],
      evidenceRequirements: ["artifact:docs/protocol.md"]
    }, { requestCheckpointApproval: async () => "accept" }));

    assert.equal(envelope.report.status, "materialized");
    assert.ok(envelope.researchHandoff);
    assert.deepEqual(envelope.hostControl.classification, {
      outcome: "continuation",
      category: "success",
      phase: "execution",
      blocking: false,
      userAction: "none",
      terminal: false,
      continuation: "resume-original",
      closure: "research-outcome",
      retry: "none"
    });
    assert.equal(envelope.hostControl.closureRequest.tool, "record_research_outcome");
    assert.equal(envelope.hostControl.closureRequest.exactlyOnce, true);
    assert.deepEqual(envelope.hostControl.closureRequest.boundArgs, { missionNumber: 1, decisionRevision: 1 });
    assert.deepEqual(envelope.hostControl.closureRequest.requiredOutcomeFields, ["attemptId", "status", "performedActionCount", "actualUsage", "evidenceReturned", "artifactPaths", "validationPaths", "facts", "startedAt", "finishedAt"]);
    assertNoCompactPublicLeaks(envelope);
  } finally {
    cleanupTempRoot(root);
  }
});

test("inconsistent explicit mission details return an actionable public correction", async () => {
  const root = createTempRoot("dove-mcp-mission-invalid-details-");
  try {
    initializeWorkspace(root);
    const before = workspaceSnapshot(root);
    const result = await dispatchTool(root, "manage_dove_mission", {
      operation: "create-root",
      mode: "ordinary",
      goal: "Verify the README project positioning.",
      requirements: ["Verify the README project positioning.", "Verify the README project positioning."]
    }, { requestCheckpointApproval: async () => { throw new Error("Invalid details must fail before elicitation."); } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /requirements must not contain duplicates/u);
    assert.match(result.structuredContent.report.message, /requirements must not contain duplicates/u);
    assert.equal(result.structuredContent.hostControl.classification.category, "invalid-input");
    assert.deepEqual(workspaceSnapshot(root), before);
    assert.equal(missionFileCount(root), 0);
  } finally {
    cleanupTempRoot(root);
  }
});

test("ambient mission invocation generates private identity without elicitation", async () => {
  const root = createTempRoot("dove-mcp-ambient-mission-");
  let approvalCalls = 0;
  try {
    initializeWorkspace(root);
    const envelope = extractEnvelope(await dispatchTool(root, "create_ambient_dove_mission", {
      mode: "ordinary",
      goal: "Implement the focused ordinary request.",
      artifacts: [{ path: "report.md", required: true, role: "output" }],
      mainlineAlignment: "The bounded report directly advances the established workspace research mainline.",
      changesWorkspaceMainline: false
    }, { requestCheckpointApproval: async () => { approvalCalls += 1; return "accept"; } }));
    const result = envelope.report;
    assert.equal(approvalCalls, 0);
    assert.equal(result.status, "materialized");
    assert.deepEqual(envelope.hostControl.presentation, { mode: "silent", reason: "ambient-create-succeeded" });
    assert.match(result.message, /requested work has not been completed yet/iu);
    assert.equal(envelope.hostControl.classification.outcome, "continuation");
    assert.equal(envelope.hostControl.classification.continuation, "resume-original");
    assert.equal(envelope.hostControl.classification.closure, "host-outcome");
    assert.equal(Object.hasOwn(envelope, "researchHandoff"), false);
    assert.equal(envelope.hostControl.closureRequest.tool, "close_host_outcome");
    assert.equal(envelope.hostControl.classification.terminal, false);
    assertNoCompactPublicLeaks(result);
    assert.equal(missionFileCount(root), 1);
  } finally {
    cleanupTempRoot(root);
  }
});

test("ambient callback mission numbers remain stable across rapid mission creation", async () => {
  const root = createTempRoot("dove-mcp-ambient-number-stability-");
  try {
    initializeWorkspace(root);
    const first = extractEnvelope(await dispatchTool(root, "create_ambient_dove_mission", {
      mode: "ordinary",
      goal: "Create the first rapid ambient mission.",
      mainlineAlignment: "The bounded request directly advances the established workspace research mainline.",
      changesWorkspaceMainline: false
    }));
    const second = extractEnvelope(await dispatchTool(root, "create_ambient_dove_mission", {
      mode: "ordinary",
      goal: "Create the second rapid ambient mission.",
      mainlineAlignment: "The bounded request directly advances the established workspace research mainline.",
      changesWorkspaceMainline: false
    }));

    assert.equal(first.hostControl.closureRequest.boundArgs.missionNumber, 1);
    assert.equal(second.hostControl.closureRequest.boundArgs.missionNumber, 2);
    const missions = fs.readdirSync(path.join(root, ".dove", "missions"))
      .map((file) => JSON.parse(fs.readFileSync(path.join(root, ".dove", "missions", file), "utf8")))
      .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)) || left.missionId.localeCompare(right.missionId));
    assert.equal(missions.length, 2);
    assert.ok(missions[0].createdAt < missions[1].createdAt);
  } finally {
    cleanupTempRoot(root);
  }
});

test("mission 100 and 101 keep stable public selectors beyond the bounded status display", async () => {
  const root = createTempRoot("dove-mcp-mission-selector-101-");
  try {
    for (let missionNumber = 1; missionNumber <= 101; missionNumber += 1) {
      materializeRootMission(root, {
        missionId: `mission-selector-${String(missionNumber).padStart(3, "0")}`,
        mode: "ordinary",
        goal: `Selector mission ${missionNumber}.`
      });
    }

    const status = extract(await dispatchTool(root, "query_dove_status", { operation: "status", detail: "full" }));
    assert.equal(status.technicalAppendix.workstreams.totalCount, 101);
    assert.equal(status.technicalAppendix.workstreams.truncated, true);
    assert.equal(status.technicalAppendix.workstreams.items.length, 100);
    assert.equal(status.technicalAppendix.workstreams.items[99].number, 100);
    assert.equal(status.technicalAppendix.workstreams.items[99].goal, "Selector mission 100.");
    assert.equal(JSON.stringify(status).includes("mission-selector-101"), false);

    for (const missionNumber of [100, 101]) {
      const selected = extract(await dispatchTool(root, "query_dove_status", { operation: "completion", missionNumber }));
      assert.equal(selected.status, "incomplete");
      assertNoCompactPublicLeaks(selected);
    }
  } finally {
    cleanupTempRoot(root);
  }
});

test("ambient mission 101 returns a usable private-safe closure selector atomically", async () => {
  const root = createTempRoot("dove-mcp-ambient-selector-101-");
  try {
    for (let missionNumber = 1; missionNumber <= 100; missionNumber += 1) {
      materializeRootMission(root, {
        missionId: `mission-ambient-prefix-${String(missionNumber).padStart(3, "0")}`,
        mode: "ordinary",
        goal: `Ambient prefix mission ${missionNumber}.`
      });
    }
    const before = workspaceSnapshot(root);
    const envelope = extractEnvelope(await dispatchTool(root, "create_ambient_dove_mission", {
      mode: "ordinary",
      goal: "Create the ambient mission beyond the status display bound.",
      mainlineAlignment: "The bounded fix directly advances the established workspace research mainline.",
      changesWorkspaceMainline: false
    }));

    assert.equal(envelope.hostControl.closureRequest.boundArgs.missionNumber, 101);
    assert.equal(missionFileCount(root), 101);
    assert.equal(Object.keys(workspaceSnapshot(root)).length > Object.keys(before).length, true);
    assert.equal(JSON.stringify(envelope).includes("mission-ambient-"), false);
    assertNoCompactPublicLeaks(envelope);

    const closed = extract(await dispatchTool(root, "close_host_outcome", {
      missionNumber: 101,
      attemptId: "ambient-101-attempt",
      status: "completed",
      summary: "The bounded ordinary operation returned a concrete result.",
      facts: [{ statement: "The bounded ordinary operation completed without producing a file.", criterionNumbers: [] }]
    }));
    assert.equal(closed.outcome.status, "completed");
    assertNoCompactPublicLeaks(closed);
  } finally {
    cleanupTempRoot(root);
  }
});

test("ambient public projection failure aborts before durable commit", async () => {
  const root = createTempRoot("dove-mcp-ambient-projection-atomic-");
  try {
    initializeWorkspace(root);
    const before = workspaceSnapshot(root);
    const result = await dispatchTool(root, "create_ambient_dove_mission", {
      mode: "ordinary",
      goal: "Abort if the closure selector cannot be projected.",
      mainlineAlignment: "The bounded atomicity check supports the established workspace research mainline.",
      changesWorkspaceMainline: false
    }, {
      callbackResolvers: {
        missionNumber: () => {
          throw new Error("Injected public projection failure.");
        }
      }
    });

    assert.equal(result.isError, true);
    assert.deepEqual(workspaceSnapshot(root), before);
    assert.equal(missionFileCount(root), 0);
    assertNoCompactPublicLeaks(result.structuredContent);
  } finally {
    cleanupTempRoot(root);
  }
});

test("child branch decline and cancel remain zero-write", async () => {
  for (const action of ["decline", "cancel"]) {
    const root = createTempRoot(`dove-mcp-mission-${action}-`);
    try {
      await createMission(root, { goal: "Create the original mission." });
      const before = workspaceSnapshot(root);
      const result = extract(await dispatchTool(root, "manage_dove_mission", {
        operation: "branch",
        mode: "research",
        goal: `Do not save the ${action} child branch.`,
        parentMissionNumber: 1,
        branchKind: "continuation",
        branchReason: "Continue through an explicit child branch.",
        stopParentReason: "Stop the active parent before creating the child branch.",
      }, { requestCheckpointApproval: async () => action }));
      assert.equal(result.status, action === "decline" ? "declined" : "cancelled");
      assertNoCompactPublicLeaks(result);
      assert.deepEqual(workspaceSnapshot(root), before);
      assert.equal(missionFileCount(root), 1);
    } finally {
      cleanupTempRoot(root);
    }
  }
});

test("direct Mission requirements persist without separate snapshot authority", async () => {
  const root = createTempRoot("dove-mcp-direct-mission-");
  try {
    const selected = await createMission(root, {
      goal: "Track one research decision.",
      requirements: ["Check whether a comparable baseline exists."],
      assumptions: ["Official material can answer the bounded question."],
      artifacts: [{ path: "outputs/baseline.md", required: true, role: "output" }]
    });
    const mission = JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.missionsDir, `${selected.missionId}.json`), "utf8"));
    assert.deepEqual(mission.requirements, ["Check whether a comparable baseline exists."]);
    assert.deepEqual(mission.assumptions, ["Official material can answer the bounded question."]);
    assert.deepEqual(mission.artifacts, [{ path: "outputs/baseline.md", required: true, role: "output" }]);
    assert.equal(Object.hasOwn(mission, "requirementSnapshotId"), false);
    assert.equal(fs.existsSync(path.join(root, ".dove/requirement-snapshots")), false);
  } finally {
    cleanupTempRoot(root);
  }
});

test("child Mission resolves the public parent number without exposing mission ids", async () => {
  const root = createTempRoot("dove-mcp-visible-parent-selector-");
  try {
    const parent = await createMission(root, { goal: "Prepare the official review criteria." });
    const child = extract(await dispatchTool(root, "manage_dove_mission", {
      operation: "branch",
      mode: "research",
      goal: "Compare NeurIPS and ICLR official review criteria.",
      requirements: ["Compare only the current official criteria."],
      parentMissionNumber: 1,
      branchKind: "continuation",
      branchReason: "Continue the bounded comparison through an explicit child.",
      stopParentReason: "Stop the parent before continuing through the child."
    }, { requestCheckpointApproval: async () => "accept" }));

    assert.equal(child.status, "materialized");
    assert.equal(JSON.stringify(child).includes(parent.missionId), false);
    const missions = fs.readdirSync(path.join(root, ARTIFACT_PATHS.missionsDir)).map((file) => JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.missionsDir, file), "utf8")));
    const persisted = missions.find((mission) => mission.goal.startsWith("Compare NeurIPS"));
    assert.equal(persisted.parentMissionId, parent.missionId);
    assert.deepEqual(persisted.requirements, ["Compare only the current official criteria."]);
    const transitions = fs.readdirSync(path.join(root, ARTIFACT_PATHS.missionTransitionsDir)).map((file) => JSON.parse(fs.readFileSync(path.join(root, ARTIFACT_PATHS.missionTransitionsDir, file), "utf8")));
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].missionId, parent.missionId);
    assert.equal(transitions[0].status, "stopped");
    assertNoCompactPublicLeaks(child);
  } finally {
    cleanupTempRoot(root);
  }
});

test("public Mission relationship selectors fail closed without cross-mission writes", async () => {
  const root = createTempRoot("dove-mcp-relationship-fail-closed-");
  try {
    await createMission(root, { goal: "First relationship mission." });
    await createMission(root, { goal: "Second relationship mission." });
    for (const invalid of [
      { operation: "branch", mode: "research", goal: "Reject missing parent.", parentMissionNumber: 999, branchKind: "continuation", branchReason: "Exercise missing selection." },
      { operation: "create-root", mode: "research", goal: "Reject private dependency.", dependsOnMissionNumbers: [1], dependsOnMissionIds: ["private-mission"] },
      { operation: "branch", mode: "research", goal: "Reject private parent.", parentMissionNumber: 1, parentMissionId: "private-mission", branchKind: "continuation", branchReason: "Exercise private selection." }
    ]) {
      const before = workspaceSnapshot(root);
      const result = await dispatchTool(root, "manage_dove_mission", invalid);
      assert.equal(result.isError, true);
      assert.deepEqual(workspaceSnapshot(root), before);
    }
    assert.equal(missionFileCount(root), 2);
  } finally {
    cleanupTempRoot(root);
  }
});

test("public mission selectors fail closed on missing, conflicting, or private visible targets", async () => {
  const root = createTempRoot("dove-mcp-visible-mission-selector-fail-closed-");
  const duplicateGoal = "Use the same exact visible goal.";
  try {
    const alpha = await createMission(root, { goal: "Visible alpha goal." });
    await createMission(root, { goal: duplicateGoal });
    const status = extract(await dispatchTool(root, "query_dove_status", { operation: "status", detail: "full" }));
    const alphaNumber = status.technicalAppendix.workstreams.items.find((item) => item.goal === "Visible alpha goal.")?.number;
    const alphaDecision = readCurrentResearchDecision(root, alpha.missionId);
    for (const selector of [
      { missionId: "private-alpha" },
      { missionNumber: 999 },
      { missionGoal: "Missing visible goal." },
      { missionNumber: alphaNumber, missionGoal: duplicateGoal }
    ]) {
      const before = workspaceSnapshot(root);
      const result = await dispatchTool(root, "manage_dove_mission", {
        ...publicDecisionArgs(alphaNumber, alphaDecision),
        ...selector
      });
      assert.equal(result.isError, true);
      assert.deepEqual(workspaceSnapshot(root), before);
    }

    await createMission(root, { goal: duplicateGoal });
    const beforeMissingNumber = workspaceSnapshot(root);
    const missingNumber = await dispatchTool(root, "manage_dove_mission", {
      ...publicDecisionArgs(alphaNumber, alphaDecision),
      missionNumber: undefined,
      missionGoal: duplicateGoal
    });
    assert.equal(missingNumber.isError, true);
    assert.deepEqual(workspaceSnapshot(root), beforeMissingNumber);
  } finally {
    cleanupTempRoot(root);
  }
});

test("failed research attempt persists without fabricated positive evidence or decision advance", async () => {
  const root = createTempRoot("dove-mcp-research-failed-attempt-");
  try {
    const blockedMission = await createMission(root, { goal: "Track a failed research direction." });
    const decision = readCurrentResearchDecision(root, blockedMission.missionId);
    const startedAt = new Date(Math.max(Date.parse(decision.createdAt), Date.now() - 1000)).toISOString();
    const failed = extract(await dispatchTool(root, "record_research_outcome", {
      missionNumber: 1,
      decisionRevision: decision.revision,
      attemptId: "direction-exhausted-attempt",
      status: "failed",
      performedActionCount: 1,
      actualUsage: { actions: 1, timeMinutes: 1, costUnits: 1 },
      evidenceReturned: [],
      artifactPaths: [],
      validationPaths: [],
      facts: ["The approved direction was exhausted without producing usable material."],
      startedAt,
      finishedAt: new Date(Date.parse(startedAt) + 1).toISOString()
    }));

    assert.equal(failed.status, "recorded");
    assert.equal(failed.outcome.status, "failed");
    assert.equal(failed.outcome.evidenceComplete, false);
    assert.deepEqual(failed.artifacts, []);
    assert.deepEqual(failed.verification, []);
    assert.equal(failed.research.decisionUnchanged, true);
    assert.equal(readCurrentResearchDecision(root, blockedMission.missionId).revision, decision.revision);
    assertNoCompactPublicLeaks(failed);
  } finally {
    cleanupTempRoot(root);
  }
});

test("public reevaluation binds the current decision and consumes its eligible receipts", async () => {
  const root = createTempRoot("dove-mcp-current-decision-binding-");
  try {
    const selected = await createMission(root, {
      goal: "Interpret one bounded protocol artifact.",
      artifacts: [{ path: "docs/protocol.md", required: true, role: "output" }],
      completionCriteria: ["The protocol artifact is interpreted."],
      evidenceRequirements: ["artifact:docs/protocol.md"]
    });
    fs.mkdirSync(path.join(root, "docs"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs/protocol.md"), "Bounded protocol with explicit stop conditions.\n");
    const first = readCurrentResearchDecision(root, selected.missionId);
    const startedAt = new Date(Math.max(Date.parse(first.createdAt), Date.now() - 1000)).toISOString();
    const recorded = extract(await dispatchTool(root, "record_research_outcome", {
      missionNumber: 1,
      decisionRevision: first.revision,
      attemptId: "protocol-artifact-attempt",
      status: "completed",
      performedActionCount: 1,
      actualUsage: { actions: 1, timeMinutes: 1, costUnits: 1 },
      evidenceReturned: ["artifact:docs/protocol.md"],
      artifactPaths: ["docs/protocol.md"],
      validationPaths: [],
      facts: ["The bounded protocol artifact was written with explicit stop conditions."],
      startedAt,
      finishedAt: new Date(Date.parse(startedAt) + 1).toISOString()
    }));
    assert.equal(recorded.status, "recorded");

    const judgment = publicDecisionArgs(1, first, {
      requestedDisposition: "stop-satisfied",
      synthesis: "The current protocol artifact satisfies this bounded research objective without establishing a method claim.",
      evidenceRefs: ["artifact:docs/protocol.md"],
      reasonCodes: ["bounded-objective-satisfied"],
      nextAction: null
    });
    for (const injected of [
      { decisionRevision: first.revision },
      { consumedReceiptIds: ["caller-selected-receipt"] }
    ]) {
      const before = workspaceSnapshot(root);
      const rejected = await dispatchTool(root, "manage_dove_mission", { ...judgment, ...injected });
      assert.equal(rejected.isError, true);
      assert.deepEqual(workspaceSnapshot(root), before);
    }

    let approvalCalls = 0;
    const envelope = extractEnvelope(await dispatchTool(root, "manage_dove_mission", judgment, {
      requestCheckpointApproval: async () => { approvalCalls += 1; return "accept"; }
    }));
    assert.equal(approvalCalls, 0);
    assert.equal(envelope.report.status, "recorded");
    assert.equal(missionFileCount(root), 1);
    const current = readCurrentResearchDecision(root, selected.missionId);
    assert.equal(current.revision, 2);
    assert.equal(current.consumedReceiptIds.length, 1);
    assert.equal(current.disposition, "stop-satisfied");
    assert.equal(envelope.hostControl.closureRequest, null);
    assertNoCompactPublicLeaks(envelope);
  } finally {
    cleanupTempRoot(root);
  }
});

test("research-decision validation errors do not expose private durable fields", async () => {
  const root = createTempRoot("dove-mcp-decision-error-");
  try {
    const selected = await createMission(root, { goal: "Validate public errors." });
    const decision = readCurrentResearchDecision(root, selected.missionId);
    const result = await dispatchTool(root, "manage_dove_mission", publicDecisionArgs(1, decision, {
      nextAction: {
        kind: "analysis",
        description: "Reject the invalid public target.",
        rationale: "Exercise public target validation.",
        targets: ["question:999"],
        successConditions: ["Reject invalid input."],
        stopConditions: ["Stop immediately."],
        expectedEvidence: ["none"],
        budget: { actions: 1, timeMinutes: 1, costUnits: 0 }
      }
    }));
    assert.equal(result.isError, true);
    assert.doesNotMatch(result.content[0].text, /missionId|decisionId|proposal|mutationMode|MutationContext|\.dove\//u);
  } finally {
    cleanupTempRoot(root);
  }
});

test("stale approved checkpoint errors hide replay controls and do not create a mission", async () => {
  const root = createTempRoot("dove-mcp-stale-checkpoint-");
  try {
    await createMission(root, { goal: "Create the workspace." });
    fs.writeFileSync(path.join(root, "target.md"), "Initial target.\n");
    const result = await dispatchTool(root, "manage_dove_mission", {
      operation: "branch",
      goal: "Bind the current target.",
      artifacts: [{ path: "target.md", required: true, role: "input-output" }],
      parentMissionNumber: 1,
      branchKind: "continuation",
      branchReason: "Bind the current target through an explicit child branch.",
      stopParentReason: "Stop the active parent before binding the changed target."
    }, {
      requestCheckpointApproval: async () => {
        fs.appendFileSync(path.join(root, "target.md"), "Changed after approval.\n");
        return "accept";
      }
    });
    assert.equal(result.isError, true);
    assert.equal(missionFileCount(root), 1);
    assert.doesNotMatch(result.content[0].text, /proposal|replay|mutationMode|MutationContext|workspaceId|\.dove\//u);
  } finally {
    cleanupTempRoot(root);
  }
});

test("review scope is zero-write and never requests checkpoint approval", async () => {
  const root = createTempRoot("dove-mcp-review-scope-");
  let approvalCalls = 0;
  try {
    await createMission(root, {
      mode: "ordinary",
      goal: "Produce the current report.",
      artifacts: [{ path: "outputs/report.md", required: true, role: "output" }]
    });
    await ownArtifact(root, 1, "outputs/report.md");
    const started = extractEnvelope(await dispatchTool(root, "manage_dove_mission", {
      operation: "start-skill",
      skill: "review",
      goal: "Independently review the current report.",
      contextArtifactPaths: ["outputs/report.md"]
    }));
    const before = workspaceSnapshot(root);
    const scoped = extractEnvelope(await dispatchTool(root, "manage_dove_review", {
      operation: "scope",
      missionNumber: started.selector.missionNumber,
      reviewMissionBinding: started.hostControl.reviewMission.binding,
      hostKind: "claude",
      artifactPaths: ["outputs/report.md"]
    }, {
      requestCheckpointApproval: async () => {
        approvalCalls += 1;
        return "accept";
      }
    }));
    assert.equal(approvalCalls, 0);
    assert.equal(scoped.report.status, "scoped");
    assert.deepEqual(scoped.report.artifacts, [{ path: "outputs/report.md" }]);
    assert.equal(scoped.hostControl.reviewerLaunch.exactlyOnce, true);
    assert.equal(scoped.hostControl.reviewerLaunch.mcpAgentLaunch, false);
    assertNoCompactPublicLeaks(scoped.report);
    assert.deepEqual(workspaceSnapshot(root), before);
  } finally {
    cleanupTempRoot(root);
  }
});

test("mission create and query normalize absolute future artifact paths", async () => {
  const root = createTempRoot("dove-mcp-absolute-mission-artifacts-");
  try {
    const futurePath = path.join(root, "outputs", "future.md");
    const queried = extract(await dispatchTool(root, "manage_dove_mission", { operation: "query",
      mode: "ordinary",
      goal: "Plan one future report.",
      artifacts: [{ path: futurePath, required: true, role: "output" }],
      evidenceRequirements: [`artifact:${futurePath}`]
    }));
    assert.deepEqual(queried.mission.artifacts, [{ path: "outputs/future.md" }]);
    assert.deepEqual(queried.mission.evidenceRequirements, ["artifact:outputs/future.md"]);

    const createdMission = await createMission(root, {
      goal: "Create one future report.",
      artifacts: [{ path: futurePath, required: true, role: "output" }],
      evidenceRequirements: [`artifact:${futurePath}`]
    });
    assert.equal(createdMission.result.status, "materialized");
    const stored = JSON.parse(fs.readFileSync(path.join(root, ".dove", "missions", `${createdMission.missionId}.json`), "utf8"));
    assert.deepEqual(stored.artifacts, [{ path: "outputs/future.md", required: true, role: "output" }]);
    assert.deepEqual(stored.evidenceRequirements.map((item) => item.requirement), ["artifact:outputs/future.md"]);
  } finally {
    cleanupTempRoot(root);
  }
});

test("mission artifact inputs reject existing non-files before approval", async () => {
  const root = createTempRoot("dove-mcp-invalid-mission-artifacts-");
  try {
    initializeWorkspace(root);
    fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
    const result = await dispatchTool(root, "manage_dove_mission", {
      operation: "create-root",
      mode: "ordinary",
      goal: "Reject a directory target.",
      artifacts: [{ path: path.join(root, "outputs"), required: true, role: "output" }]
    }, { requestCheckpointApproval: async () => "accept" });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /文件引用无效/u);
    assert.equal(result.structuredContent.hostControl.classification.outcome, "failed");
    assert.equal(result.structuredContent.hostControl.classification.terminal, true);
    assert.equal(result.structuredContent.hostControl.classification.retry, "explicit-request");
    assert.equal(missionFileCount(root), 0);
  } finally {
    cleanupTempRoot(root);
  }
});

test("workspace absolute source paths normalize before the domain write", async () => {
  const root = createTempRoot("dove-mcp-absolute-source-");
  try {
    await createMission(root, { goal: "Capture one source." });
    const capturePath = path.join(root, "downloads", "paper.txt");
    fs.mkdirSync(path.dirname(capturePath), { recursive: true });
    fs.writeFileSync(capturePath, "Captured source material.\n");
    const result = extract(await dispatchTool(root, "manage_dove_sources", { operation: "register",
      missionNumber: 1,
      sourceId: "paper-one",
      title: "Paper one",
      locator: "https://example.org/paper-one",
      sourceType: "web",
      origin: "public-web",
      capturePath
    }));
    assert.equal(result.status, "recorded");
    assertNoCompactPublicLeaks(result);
    const source = JSON.parse(fs.readFileSync(path.join(root, ".dove", "sources", "paper-one.json"), "utf8"));
    assert.match(source.capturedMaterial.path, /^\.dove\/sources\/materials\//u);
    assert.equal(fs.readFileSync(path.join(root, source.capturedMaterial.path), "utf8"), "Captured source material.\n");
  } finally {
    cleanupTempRoot(root);
  }
});

test("workspace absolute Review scope paths normalize without a checkpoint or write", async () => {
  const root = createTempRoot("dove-mcp-absolute-review-");
  try {
    await createMission(root, {
      mode: "ordinary",
      goal: "Produce the current report.",
      artifacts: [{ path: "outputs/report.md", required: true, role: "output" }]
    });
    await ownArtifact(root, 1, "outputs/report.md");
    const started = extractEnvelope(await dispatchTool(root, "manage_dove_mission", {
      operation: "start-skill",
      skill: "review",
      goal: "Independently review the current report.",
      contextArtifactPaths: ["outputs/report.md"]
    }));
    const before = workspaceSnapshot(root);
    const scoped = extractEnvelope(await dispatchTool(root, "manage_dove_review", {
      operation: "scope",
      missionNumber: started.selector.missionNumber,
      reviewMissionBinding: started.hostControl.reviewMission.binding,
      hostKind: "claude",
      artifactPaths: [path.join(root, "outputs", "report.md")]
    }));
    assert.equal(scoped.report.status, "scoped");
    assert.deepEqual(scoped.report.artifacts, [{ path: "outputs/report.md" }]);
    assert.deepEqual(workspaceSnapshot(root), before);
  } finally {
    cleanupTempRoot(root);
  }
});

test("Review scope rejects missing workspace paths without writing", async () => {
  const root = createTempRoot("dove-mcp-review-missing-scope-");
  try {
    await createMission(root, { goal: "Produce material for later review." });
    const started = extractEnvelope(await dispatchTool(root, "manage_dove_mission", {
      operation: "start-skill",
      skill: "review",
      goal: "Independently review the declared material.",
      parentMissionNumber: 1
    }));
    const before = workspaceSnapshot(root);
    const result = await dispatchTool(root, "manage_dove_review", {
      operation: "scope",
      missionNumber: started.selector.missionNumber,
      reviewMissionBinding: started.hostControl.reviewMission.binding,
      hostKind: "claude",
      artifactPaths: [path.join(root, "outputs", "missing.md")]
    });
    assert.equal(result.isError, true);
    assertNoCompactPublicLeaks(result.structuredContent.report);
    assert.deepEqual(workspaceSnapshot(root), before);
  } finally {
    cleanupTempRoot(root);
  }
});

test("Lessons MCP read is zero-write and update uses its machine-only binding without creating a Mission", async () => {
  const root = createTempRoot("dove-mcp-lessons-document-");
  try {
    initializeWorkspace(root);
    const before = workspaceSnapshot(root);
    const readEnvelope = extractEnvelope(await dispatchTool(root, "manage_dove_lessons", { operation: "read" }));
    assert.equal(readEnvelope.report.status, "ok");
    assert.match(readEnvelope.report.markdown, /^# Dove Lessons/mu);
    assert.equal(typeof readEnvelope.hostControl.lessonsDocument.binding, "string");
    assert.match(readEnvelope.hostControl.lessonsDocument.currentHash, /^[0-9a-f]{64}$/u);
    assert.equal(Object.hasOwn(readEnvelope.report, "lessonsBinding"), false);
    assert.equal(Object.hasOwn(readEnvelope.report, "currentHash"), false);
    assert.deepEqual(workspaceSnapshot(root), before);

    let approvalCalls = 0;
    const markdown = readEnvelope.report.markdown.replace("## 协作与工作实践\n\n- 暂无。", "## 协作与工作实践\n\n- 保持主机边界简洁。\n");
    const updated = extractEnvelope(await dispatchTool(root, "manage_dove_lessons", {
      operation: "update",
      binding: readEnvelope.hostControl.lessonsDocument.binding,
      markdown
    }, { requestCheckpointApproval: async () => { approvalCalls += 1; return "accept"; } }));
    assert.equal(approvalCalls, 0);
    assert.equal(updated.report.status, "updated");
    assert.equal(updated.report.markdown, markdown);
    assert.equal(Object.hasOwn(updated.hostControl, "lessonsDocument"), false);
    assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.missionsDir)) ? fs.readdirSync(path.join(root, ARTIFACT_PATHS.missionsDir)).length : 0, 0);
    assert.equal(fs.existsSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir)) ? fs.readdirSync(path.join(root, ARTIFACT_PATHS.executionReceiptsDir)).length : 0, 0);
    assertNoCompactPublicLeaks(updated.report);
  } finally {
    cleanupTempRoot(root);
  }
});

for (const protocolVersion of ["2025-06-18", "2025-11-25"]) test(`stdio MCP negotiates ${protocolVersion} elicitation`, async () => {
  const root = createTempRoot(`dove-mcp-stdio-${protocolVersion}-`);
  let requestCount = 0;
  const client = createMcpStdioClient({
    args: [SERVER],
    cwd: root,
    onRequest: async (method) => {
      requestCount += 1;
      assert.equal(method, "elicitation/create");
      return { action: "decline", content: {} };
    }
  });
  try {
    const initialized = await client.call("initialize", {
      protocolVersion,
      capabilities: { elicitation: protocolVersion === "2025-11-25" ? { form: {} } : {} },
      clientInfo: { name: "dove-protocol-test", version: "1.0.0" }
    });
    assert.equal(initialized.protocolVersion, protocolVersion);
    client.notify("notifications/initialized");
    const result = extract(await client.call("tools/call", {
      name: "manage_dove_workspace",
      arguments: { operation: "initialize", mainline: "Decline the protocol checkpoint." }
    }));
    assert.equal(requestCount, 1);
    assert.equal(result.status, "declined");
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);
  } finally {
    client.kill();
    cleanupTempRoot(root);
  }
});

test("stdio MCP negotiates elicitation and keeps its public card clean", async () => {
  const root = createTempRoot("dove-mcp-stdio-elicitation-");
  let requestCount = 0;
  const client = createMcpStdioClient({
    args: [SERVER],
    cwd: root,
    framing: "jsonl",
    onRequest: async (method, params) => {
      requestCount += 1;
      assert.equal(method, "elicitation/create");
      assertNoCompactPublicLeaks(params);
      return { action: "accept", content: {} };
    }
  });
  try {
    const initialized = await client.call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: { elicitation: {} },
      clientInfo: { name: "dove-lightweight-test", version: "1.0.0" }
    });
    assert.equal(initialized.protocolVersion, "2025-06-18");
    client.notify("notifications/initialized");
    const result = extract(await client.call("tools/call", {
      name: "manage_dove_workspace",
      arguments: { operation: "initialize", mainline: "Exercise stdio elicitation." }
    }));
    assert.equal(requestCount, 1);
    assert.equal(result.status, "initialized");
    assertNoCompactPublicLeaks(result);
  } finally {
    client.kill();
    cleanupTempRoot(root);
  }
});

test("stdio client returns synchronous elicitation handler failures without crashing", async () => {
  const root = createTempRoot("dove-mcp-stdio-handler-error-");
  const client = createMcpStdioClient({
    args: [SERVER],
    cwd: root,
    onRequest: () => { throw new Error("approval handler failed"); }
  });
  try {
    await client.call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: { elicitation: {} },
      clientInfo: { name: "dove-handler-error-client", version: "1.0.0" }
    });
    client.notify("notifications/initialized");
    const result = await client.call("tools/call", {
      name: "manage_dove_workspace",
      arguments: { operation: "initialize", mainline:"Fail before approval." }
    });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /请求未能完成/u);
    assert.equal(result.structuredContent.hostControl.classification.outcome, "failed");
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);
  } finally {
    client.kill();
    cleanupTempRoot(root);
  }
});

test("disconnect during checkpoint approval remains zero-write", async () => {
  const root = createTempRoot("dove-mcp-disconnect-");
  let markRequest;
  const requestSeen = new Promise((resolve) => { markRequest = resolve; });
  const client = createMcpStdioClient({
    args: [SERVER],
    cwd: root,
    onRequest: async () => {
      markRequest();
      return new Promise(() => {});
    }
  });
  try {
    await client.call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: { elicitation: {} },
      clientInfo: { name: "dove-disconnect-client", version: "1.0.0" }
    });
    client.notify("notifications/initialized");
    const pendingCall = client.call("tools/call", {
      name: "manage_dove_workspace",
      arguments: { operation: "initialize", mainline:"Disconnect before approval." }
    });
    await requestSeen;
    client.server.stdin.end();
    await assert.rejects(pendingCall, /server exited early/u);
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);
  } finally {
    client.kill();
    cleanupTempRoot(root);
  }
});

test("checkpoint fails closed before initialized notification", async () => {
  const root = createTempRoot("dove-mcp-before-initialized-");
  const client = createMcpStdioClient({ args: [SERVER], cwd: root, onRequest: async () => ({ action: "accept" }) });
  try {
    await client.call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: { elicitation: {} },
      clientInfo: { name: "dove-uninitialized-client", version: "1.0.0" }
    });
    await assert.rejects(client.call("tools/call", {
      name: "manage_dove_workspace",
      arguments: { operation: "initialize", mainline:"Must wait for initialized notification." }
    }), /MCP server is not initialized/u);
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);
  } finally {
    client.kill();
    cleanupTempRoot(root);
  }
});

test("MCP tools require initialize completion and initialize runs once", async () => {
  const root = createTempRoot("dove-mcp-lifecycle-");
  const client = createMcpStdioClient({ args: [SERVER], cwd: root });
  try {
    await assert.rejects(client.call("tools/list"), /MCP server is not initialized/u);
    await client.call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "dove-lifecycle-client", version: "1.0.0" }
    });
    await assert.rejects(client.call("tools/list"), /MCP server is not initialized/u);
    client.notify("notifications/initialized");
    const listed = await client.call("tools/list");
    assert.equal(listed.tools.length, 14);
    await assert.rejects(client.call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "dove-lifecycle-client", version: "1.0.0" }
    }), /already initialized/u);
  } finally {
    client.kill();
    cleanupTempRoot(root);
  }
});

test("checkpoint fails closed when the client lacks elicitation", async () => {
  const root = createTempRoot("dove-mcp-no-elicitation-");
  const client = createMcpStdioClient({ args: [SERVER], cwd: root });
  try {
    await client.call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "dove-old-client", version: "1.0.0" }
    });
    client.notify("notifications/initialized");
    const result = await client.call("tools/call", {
      name: "manage_dove_workspace",
      arguments: { operation: "initialize", mainline:"Must not initialize without elicitation." }
    });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /缺少继续当前检查点所需的能力/u);
    assert.equal(result.structuredContent.hostControl.classification.category, "capability-unavailable");
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);
  } finally {
    client.kill();
    cleanupTempRoot(root);
  }
});
