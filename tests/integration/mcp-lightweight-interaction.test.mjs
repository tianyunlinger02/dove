import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { COMMAND_SURFACE_BY_ID, toolInteractionFor } from "../../src/core/command-manifest.mjs";
import { dispatchTool } from "../../src/mcp/handlers.mjs";
import { toolDefinitions } from "../../src/mcp/tool-definitions.mjs";
import { createMcpStdioClient } from "../../scripts/mcp-stdio-client.mjs";
import { assertNoCompactPublicLeaks } from "../helpers/compact-public.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

const ROOT = process.cwd();
const SERVER = path.join(ROOT, "mcp", "dove-state-server.mjs");

function extract(result) {
  assert.notEqual(result.isError, true, result.content?.[0]?.text);
  return JSON.parse(result.content[0].text);
}

function missionFileCount(root) {
  const directory = path.join(root, ".dove", "missions");
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
  return extract(await dispatchTool(root, "create_dove_mission", args, { requestCheckpointApproval: async () => "accept" }));
}

async function ownArtifact(root, missionId, relativePath, content = "Current review material.\n") {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex");
  return extract(await dispatchTool(root, "ingest_execution_receipt", {
    receiptId: `receipt-${missionId}-${path.basename(relativePath).replace(/[^a-z0-9._-]+/giu, "-").toLowerCase()}`,
    missionId,
    contractDigest: JSON.parse(fs.readFileSync(path.join(root, ".dove", "missions", `${missionId}.json`), "utf8")).contractDigest,
    summary: "Record current review material.",
    artifacts: [{ path: relativePath, kind: "report", sha256 }],
    validations: [],
    criteriaSatisfied: [],
    producedAt: new Date().toISOString()
  }));
}

test("lightweight command contracts classify all twelve surfaces", () => {
  assert.equal(Object.keys(COMMAND_SURFACE_BY_ID).length, 12);
  assert.equal(COMMAND_SURFACE_BY_ID["dove.mission"].interaction, "checkpoint");
  assert.equal(COMMAND_SURFACE_BY_ID["dove.mission"].continuation, "resume-original");
  assert.equal(COMMAND_SURFACE_BY_ID["dove.mission"].closure, "host-outcome");
  assert.deepEqual(COMMAND_SURFACE_BY_ID["dove.mission"].closureTools, ["close_host_outcome"]);
  assert.deepEqual(COMMAND_SURFACE_BY_ID["dove.mission"].requiredTools, ["create_dove_mission"]);
  assert.equal(COMMAND_SURFACE_BY_ID["dove.mission"].explicitStopMode, "create-only");
  assert.equal(COMMAND_SURFACE_BY_ID["dove.status"].interaction, "read");
  assert.equal(COMMAND_SURFACE_BY_ID["dove.source"].interaction, "write");
  assert.equal(toolInteractionFor("compare_versions"), "read");
  assert.equal(toolInteractionFor("close_host_outcome"), "write");
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
  const missionTool = toolDefinitions.find((tool) => tool.name === "create_dove_mission");
  assert.deepEqual(missionTool.inputSchema.required, ["missionId"]);
  assert.equal(Object.hasOwn(missionTool.inputSchema, "allOf"), false);
});

test("checkpoint actions accept, decline, and cancel without exposing control data", async () => {
  for (const action of ["accept", "decline", "cancel"]) {
    const root = createTempRoot(`dove-mcp-checkpoint-${action}-`);
    try {
      const result = extract(await dispatchTool(root, "init_dove_goal", { goal: `Exercise ${action}.` }, {
        requestCheckpointApproval: async (approval) => {
          assertNoCompactPublicLeaks(approval);
          return action;
        }
      }));
      assertNoCompactPublicLeaks(result);
      assert.equal(result.status, action === "accept" ? "initialized" : action === "decline" ? "declined" : "cancelled");
      assert.equal(fs.existsSync(path.join(root, ".dove")), action === "accept");
    } finally {
      cleanupTempRoot(root);
    }
  }
});

test("mission checkpoint materializes after exactly one elicitation and returns continuation wording", async () => {
  const root = createTempRoot("dove-mcp-mission-continuation-");
  const missionId = "mission-continuation";
  let approvalCalls = 0;
  try {
    const result = extract(await dispatchTool(root, "create_dove_mission", {
      missionId,
      goal: "Research the topic and write a concise report.",
      targetArtifacts: ["report.md"]
    }, { requestCheckpointApproval: async () => { approvalCalls += 1; return "accept"; } }));
    assert.equal(approvalCalls, 1);
    assert.equal(result.status, "materialized");
    assert.match(result.message, /continue the requested work/u);
    assert.equal(JSON.stringify(result).includes(missionId), false);
    assertNoCompactPublicLeaks(result);
    assert.equal(missionFileCount(root), 1);
  } finally {
    cleanupTempRoot(root);
  }
});

test("mission creation requires a private host mission id before elicitation", async () => {
  const root = createTempRoot("dove-mcp-mission-id-required-");
  let approvalCalls = 0;
  try {
    const before = workspaceSnapshot(root);
    const result = await dispatchTool(root, "create_dove_mission", {
      goal: "Reject an unrecoverable mission identity."
    }, { requestCheckpointApproval: async () => { approvalCalls += 1; return "accept"; } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /requested action could not complete/u);
    assert.doesNotMatch(result.content[0].text, /missionId|schema|contract|receipt|digest|token|MutationContext/u);
    assert.equal(approvalCalls, 0);
    assert.equal(missionFileCount(root), 0);
    assert.deepEqual(workspaceSnapshot(root), before);
  } finally {
    cleanupTempRoot(root);
  }
});

test("mission decline and cancel remain zero-write", async () => {
  for (const action of ["decline", "cancel"]) {
    const root = createTempRoot(`dove-mcp-mission-${action}-`);
    try {
      const before = workspaceSnapshot(root);
      const result = extract(await dispatchTool(root, "create_dove_mission", {
        missionId: `mission-${action}`,
        goal: `Do not save the ${action} mission.`
      }, { requestCheckpointApproval: async () => action }));
      assert.equal(result.status, action === "decline" ? "declined" : "cancelled");
      assertNoCompactPublicLeaks(result);
      assert.deepEqual(workspaceSnapshot(root), before);
      assert.equal(fs.existsSync(path.join(root, ".dove")), false);
    } finally {
      cleanupTempRoot(root);
    }
  }
});

test("research-tree checkpoint translates the public node model and elicits once", async () => {
  const root = createTempRoot("dove-mcp-research-tree-");
  let approvalCalls = 0;
  try {
    await createMission(root, { missionId: "tree-mission", goal: "Track one research decision." });
    const result = extract(await dispatchTool(root, "create_dove_mission", {
      operation: "reevaluate-research-tree",
      missionId: "tree-mission",
      requirement: "Check whether a comparable baseline exists.",
      nodeUpdates: [{
        nodeId: "baseline-search",
        parentNodeId: null,
        workKind: "analysis",
        questionOrHypothesis: "Does a directly comparable baseline exist?",
        workDescription: "Search and analyze the scoped literature.",
        successOrStopCriterion: "Find a comparable baseline or exhaust the scoped corpus.",
        status: "pending",
        outcomeSummary: null,
        outcomeEvidenceRefs: [],
        blockedReasonCode: null
      }]
    }, { requestCheckpointApproval: async (approval) => {
      approvalCalls += 1;
      assert.equal(approval.effects.includes("Add 1 research decision."), true);
      assert.doesNotMatch(JSON.stringify(approval), /baseline-search/u);
      assertNoCompactPublicLeaks(approval);
      return "accept";
    } }));
    assert.equal(approvalCalls, 1);
    assert.equal(result.status, "recorded");
    assert.deepEqual(result.changes, { addedCount: 1, completedCount: 0, blockedCount: 0, unchangedCount: 0 });
    assertNoCompactPublicLeaks(result);
    const tree = JSON.parse(fs.readFileSync(path.join(root, ".dove", "research-trees", "tree-mission.json"), "utf8"));
    assert.equal(tree.nodes[0].workKind, "analysis");
    assert.equal(tree.nodes[0].lessonId, null);
  } finally {
    cleanupTempRoot(root);
  }
});

test("checkpoint validation errors do not expose private research-tree fields", async () => {
  const root = createTempRoot("dove-mcp-checkpoint-error-");
  try {
    await createMission(root, { missionId: "error-mission", goal: "Validate public errors." });
    const result = await dispatchTool(root, "create_dove_mission", {
      operation: "reevaluate-research-tree",
      missionId: "error-mission",
      requirement: "Reject an invalid pending outcome.",
      nodeUpdates: [{
        nodeId: "invalid-node",
        parentNodeId: null,
        workKind: "analysis",
        questionOrHypothesis: "Is this valid?",
        workDescription: "Check the invalid input.",
        successOrStopCriterion: "Reject the invalid state.",
        status: "pending",
        outcomeSummary: "Pending nodes cannot have an outcome.",
        outcomeEvidenceRefs: [],
        blockedReasonCode: null
      }]
    }, { requestCheckpointApproval: async () => "accept" });
    assert.equal(result.isError, true);
    assert.doesNotMatch(result.content[0].text, /lessonId|proposal|mutationMode|MutationContext|\.dove\//u);
  } finally {
    cleanupTempRoot(root);
  }
});

test("stale approved checkpoint errors hide replay controls and do not create a mission", async () => {
  const root = createTempRoot("dove-mcp-stale-checkpoint-");
  try {
    await createMission(root, { missionId: "existing-mission", goal: "Create the workspace." });
    fs.writeFileSync(path.join(root, "target.md"), "Initial target.\n");
    const result = await dispatchTool(root, "create_dove_mission", {
      missionId: "stale-mission",
      goal: "Bind the current target.",
      targetArtifacts: ["target.md"]
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

test("review preparation elicits once and decline or cancel remains zero-write", async () => {
  for (const action of ["accept", "decline", "cancel"]) {
    const root = createTempRoot(`dove-mcp-review-${action}-`);
    let approvalCalls = 0;
    try {
      await createMission(root, {
        missionId: "review-mission",
        goal: "Review the current report.",
        targetArtifacts: ["outputs/report.md"]
      });
      await ownArtifact(root, "review-mission", "outputs/report.md");
      const before = workspaceSnapshot(root);
      const result = extract(await dispatchTool(root, "prepare_review_exchange", {
        missionId: "review-mission",
        policy: "external",
        artifactPaths: ["outputs/report.md"]
      }, {
        requestCheckpointApproval: async (approval) => {
          approvalCalls += 1;
          assertNoCompactPublicLeaks(approval);
          return action;
        }
      }));
      assert.equal(approvalCalls, 1);
      assertNoCompactPublicLeaks(result);
      assert.equal(result.status, action === "accept" ? "prepared" : action === "decline" ? "declined" : "cancelled");
      if (action === "accept") assert.notDeepEqual(workspaceSnapshot(root), before);
      else assert.deepEqual(workspaceSnapshot(root), before);
    } finally {
      cleanupTempRoot(root);
    }
  }
});

test("mission create and query normalize absolute future artifact paths", async () => {
  const root = createTempRoot("dove-mcp-absolute-mission-artifacts-");
  try {
    const futurePath = path.join(root, "outputs", "future.md");
    const queried = extract(await dispatchTool(root, "query_dove_mission", {
      goal: "Plan one future report.",
      targetArtifacts: [futurePath],
      expectedArtifacts: [futurePath],
      evidenceRequirements: [`artifact:${futurePath}`]
    }));
    assert.deepEqual(queried.mission.artifacts, [{ path: "outputs/future.md" }, { path: "outputs/future.md" }]);
    assert.deepEqual(queried.mission.evidenceRequirements, ["artifact:outputs/future.md"]);

    const created = await createMission(root, {
      missionId: "absolute-future-artifact",
      goal: "Create one future report.",
      targetArtifacts: [futurePath],
      expectedArtifacts: [futurePath],
      evidenceRequirements: [`artifact:${futurePath}`]
    });
    assert.equal(created.status, "materialized");
    const stored = JSON.parse(fs.readFileSync(path.join(root, ".dove", "missions", "absolute-future-artifact.json"), "utf8"));
    assert.deepEqual(stored.targetArtifacts, ["outputs/future.md"]);
    assert.deepEqual(stored.expectedArtifacts, ["outputs/future.md"]);
    assert.deepEqual(stored.evidenceRequirements, ["artifact:outputs/future.md"]);
  } finally {
    cleanupTempRoot(root);
  }
});

test("mission artifact inputs reject existing non-files before approval", async () => {
  const root = createTempRoot("dove-mcp-invalid-mission-artifacts-");
  try {
    fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
    const result = await dispatchTool(root, "create_dove_mission", {
      missionId: "invalid-artifact-directory",
      goal: "Reject a directory target.",
      targetArtifacts: [path.join(root, "outputs")]
    }, { requestCheckpointApproval: async () => "accept" });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /requested action could not complete|regular file or future file/iu);
    assert.equal(missionFileCount(root), 0);
  } finally {
    cleanupTempRoot(root);
  }
});

test("workspace absolute source paths normalize before the domain write", async () => {
  const root = createTempRoot("dove-mcp-absolute-source-");
  try {
    await createMission(root, { missionId: "source-mission", goal: "Capture one source." });
    const capturePath = path.join(root, "downloads", "paper.txt");
    fs.mkdirSync(path.dirname(capturePath), { recursive: true });
    fs.writeFileSync(capturePath, "Captured source material.\n");
    const result = extract(await dispatchTool(root, "register_source", {
      missionId: "source-mission",
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

test("workspace absolute review paths normalize before checkpoint approval", async () => {
  const root = createTempRoot("dove-mcp-absolute-review-");
  try {
    await createMission(root, { missionId: "absolute-review", goal: "Review the report.", targetArtifacts: ["outputs/report.md"] });
    await ownArtifact(root, "absolute-review", "outputs/report.md");
    const result = extract(await dispatchTool(root, "prepare_review_exchange", {
      missionId: "absolute-review",
      policy: "external",
      artifactPaths: [path.join(root, "outputs", "report.md")]
    }, { requestCheckpointApproval: async () => "accept" }));
    assert.equal(result.status, "prepared");
    assert.deepEqual(result.artifacts, [{ path: "outputs/report.md" }]);
  } finally {
    cleanupTempRoot(root);
  }
});

test("review coverage keeps missing workspace paths as structured zero-write gaps", async () => {
  const root = createTempRoot("dove-mcp-review-missing-coverage-");
  try {
    await createMission(root, { missionId: "missing-coverage", goal: "Check review coverage." });
    const before = workspaceSnapshot(root);
    const result = extract(await dispatchTool(root, "verify_review_coverage", {
      missionId: "missing-coverage",
      artifactPaths: [path.join(root, "outputs", "missing.md")]
    }));
    assert.equal(result.status, "not-covered");
    assert.equal(result.review.covered, false);
    assert.deepEqual(result.review.artifacts, [{ path: "outputs/missing.md" }]);
    assertNoCompactPublicLeaks(result);
    assert.deepEqual(workspaceSnapshot(root), before);
  } finally {
    cleanupTempRoot(root);
  }
});

test("lesson query keeps missing workspace artifact filters as read-only empty gaps", async () => {
  const root = createTempRoot("dove-mcp-lesson-future-filter-");
  try {
    await createMission(root, { missionId: "lesson-filter-mission", goal: "Query lessons for a future artifact." });
    const before = workspaceSnapshot(root);
    const result = extract(await dispatchTool(root, "query_dove_lessons", {
      missionId: "lesson-filter-mission",
      artifactRefs: [path.join(root, "outputs", "future.md")]
    }));
    assert.equal(result.status, "empty");
    assert.deepEqual(result.lessons, []);
    assert.deepEqual(workspaceSnapshot(root), before);
    fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
    const rejected = await dispatchTool(root, "query_dove_lessons", {
      missionId: "lesson-filter-mission",
      artifactRefs: [path.join(root, "outputs")]
    });
    assert.equal(rejected.isError, true);
    assert.match(rejected.content[0].text, /canonical regular file or future file inside the workspace/u);
  } finally {
    cleanupTempRoot(root);
  }
});

test("version comparison is a zero-write MCP query with immediate differences", async () => {
  const root = createTempRoot("dove-mcp-version-compare-");
  try {
    await createMission(root, { missionId: "version-mission", goal: "Compare two immutable snapshots." });
    await ownArtifact(root, "version-mission", "outputs/first.md", "First snapshot.\n");
    extract(await dispatchTool(root, "create_version_snapshot", { missionId: "version-mission", versionId: "v1", artifactRefs: ["outputs/first.md"] }));
    await ownArtifact(root, "version-mission", "outputs/second.md", "Second snapshot.\n");
    extract(await dispatchTool(root, "create_version_snapshot", { missionId: "version-mission", versionId: "v2", artifactRefs: ["outputs/second.md"] }));
    const before = workspaceSnapshot(root);

    const result = extract(await dispatchTool(root, "compare_versions", { missionId: "version-mission", fromVersionId: "v1", toVersionId: "v2" }));

    assert.equal(result.status, "compared");
    assert.equal(result.zeroWrite, true);
    assert.deepEqual(result.changes, {
      added: [{ path: "outputs/second.md" }],
      removed: [{ path: "outputs/first.md" }],
      changed: []
    });
    assert.deepEqual(workspaceSnapshot(root), before);
  } finally {
    cleanupTempRoot(root);
  }
});

test("explicit lesson recording is invocation-authorized and uses one tool call", async () => {
  const root = createTempRoot("dove-mcp-lesson-direct-");
  try {
    extract(await dispatchTool(root, "create_dove_mission", { missionId: "lesson-mission", goal: "Record one lesson." }, { requestCheckpointApproval: async () => "accept" }));
    let approvalCalls = 0;
    const result = extract(await dispatchTool(root, "record_dove_lesson", {
      missionId: "lesson-mission",
      lessonId: "lesson-one",
      scope: "mission",
      kind: "method",
      summary: "Keep the host boundary light.",
      nextTimeGuidance: ["Use one checkpoint only."],
      sourceIds: [],
      noteIds: [],
      artifactRefs: [],
      appliesToArtifactRefs: [],
      tags: ["ux"]
    }, { requestCheckpointApproval: async () => { approvalCalls += 1; return "accept"; } }));
    assert.equal(approvalCalls, 0);
    assert.equal(result.status, "recorded");
    assertNoCompactPublicLeaks(result);
    assert.equal(fs.existsSync(path.join(root, ".dove", "lessons", "lesson-one.json")), true);
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
      name: "init_dove_goal",
      arguments: { goal: "Decline the protocol checkpoint." }
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
      name: "init_dove_goal",
      arguments: { goal: "Exercise stdio elicitation." }
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
      name: "init_dove_goal",
      arguments: { goal: "Fail before approval." }
    });
    assert.equal(result.isError, true);
    assert.equal(result.content[0].text, "approval handler failed");
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
      name: "init_dove_goal",
      arguments: { goal: "Disconnect before approval." }
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
      name: "init_dove_goal",
      arguments: { goal: "Must wait for initialized notification." }
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
    assert.equal(listed.tools.length, 28);
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
      name: "init_dove_goal",
      arguments: { goal: "Must not initialize without elicitation." }
    });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /requires MCP elicitation support/u);
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);
  } finally {
    client.kill();
    cleanupTempRoot(root);
  }
});
