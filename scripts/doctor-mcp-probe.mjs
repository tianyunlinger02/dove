#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { DOVE_MCP_SERVER_NAME } from "../src/core/command-manifest.mjs";
import { DOVE_MCP_PROBE_PROTOCOL_VERSION } from "../src/core/mcp-runtime-identity.mjs";
import { DOVE_RESEARCH_FORMAT, PACKAGE_VERSION } from "../src/core/schema.mjs";
import { createMcpStdioClient } from "./mcp-stdio-client.mjs";

const target = path.resolve(process.argv[2] ?? process.cwd());
const identityOnly = process.argv.includes("--identity");
const sourceServerScriptPath = path.join(target, "mcp", "dove-state-server.mjs");
const packagedServerScriptPath = path.join(target, "mcp", "dove-state-server-package.mjs");
const sourceAmbientHookPath = path.join(target, "scripts", "dove-user-prompt-submit.mjs");
const packagedAmbientHookPath = path.join(target, "scripts", "dove-user-prompt-submit-package.mjs");
const usingSourceRuntime = fs.existsSync(sourceServerScriptPath);
const serverScriptPath = usingSourceRuntime ? sourceServerScriptPath : packagedServerScriptPath;
const ambientHookPath = fs.existsSync(sourceAmbientHookPath) ? sourceAmbientHookPath : packagedAmbientHookPath;
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
let probeWorkspace = null;
let probeBase = null;
let createdProbeDirectories = [];
let client = null;

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function snapshotTree(root) {
  const result = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
      const stat = fs.lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        result[relativePath] = { type: "symlink", target: fs.readlinkSync(absolutePath) };
      } else if (stat.isDirectory()) {
        result[`${relativePath}/`] = { type: "directory", mode: stat.mode & 0o7777 };
        visit(absolutePath);
      } else if (stat.isFile()) {
        result[relativePath] = { type: "file", mode: stat.mode & 0o7777, size: stat.size, sha256: sha256File(absolutePath) };
      } else {
        result[relativePath] = { type: "other", mode: stat.mode & 0o7777 };
      }
    }
  };
  visit(root);
  return result;
}

function nearestRepositoryRoot(start) {
  let current = fs.realpathSync.native(start);
  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function createProbeWorkspace() {
  const repositoryRoot = nearestRepositoryRoot(target);
  probeBase = repositoryRoot
    ? path.join(repositoryRoot, ".tmp", "dove-workspaces")
    : path.join(target, ".tmp", "dove-workspaces");

  let current = probeBase;
  while (!fs.existsSync(current)) {
    createdProbeDirectories.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  fs.mkdirSync(probeBase, { recursive: true });
  probeWorkspace = fs.mkdtempSync(path.join(probeBase, "doctor-mcp-probe-"));
}

function cleanupProbeWorkspace() {
  if (probeWorkspace) fs.rmSync(probeWorkspace, { recursive: true, force: true });
  probeWorkspace = null;
  for (const directory of createdProbeDirectories) {
    try {
      fs.rmdirSync(directory);
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTEMPTY") throw error;
    }
  }
  createdProbeDirectories = [];
  probeBase = null;
}

function assertRegularFile(filePath, label) {
  const stat = fs.lstatSync(filePath);
  assert.equal(stat.isFile() && !stat.isSymbolicLink(), true, `${label} must be a regular file`);
}

function assertHumanText(content) {
  assert.equal(content?.[0]?.type, "text");
  assert.ok(content[0].text.trim(), "MCP tools must return human-readable text");
  let parsed = false;
  try {
    JSON.parse(content[0].text);
    parsed = true;
  } catch {
    parsed = false;
  }
  assert.equal(parsed, false, "MCP text must not be a raw JSON projection");
}

function parseToolPayload(name, result) {
  assert.notEqual(result.isError, true, result.content?.[0]?.text ?? `${name} failed`);
  assert.deepEqual(Object.keys(result.structuredContent ?? {}).sort(), ["operation", "research", "status"]);
  assert.equal(result.structuredContent.operation, name);
  assert.ok(result.structuredContent.research && typeof result.structuredContent.research === "object");
  assertHumanText(result.content);
  return result.structuredContent.research;
}

function runAmbientHook(input) {
  return spawnSync(process.execPath, [ambientHookPath], {
    cwd: probeWorkspace,
    encoding: "utf8",
    input: JSON.stringify(input),
    env: { ...process.env, CLAUDE_PROJECT_DIR: probeWorkspace }
  });
}

async function callTool(name, arguments_) {
  return parseToolPayload(name, await client.call("tools/call", { name, arguments: arguments_ }));
}

async function callZeroWriteTool(name, arguments_) {
  const before = snapshotTree(probeWorkspace);
  const research = await callTool(name, arguments_);
  assert.equal(research.zeroWrite, true, `${name}.${arguments_.operation} must declare zeroWrite`);
  assert.deepEqual(snapshotTree(probeWorkspace), before, `${name}.${arguments_.operation} must be zero-write`);
  return research;
}

async function main() {
  assertRegularFile(serverScriptPath, "Dove MCP server entry");
  assertRegularFile(ambientHookPath, "Dove ambient hook entry");
  const targetBefore = identityOnly ? null : snapshotTree(target);
  createProbeWorkspace();
  client = createMcpStdioClient({
    args: [serverScriptPath],
    cwd: probeWorkspace,
    env: { ...process.env, CLAUDE_PROJECT_DIR: probeWorkspace }
  });

  const initialized = await client.call("initialize", {
    protocolVersion: DOVE_MCP_PROBE_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "dove-doctor", version: PACKAGE_VERSION }
  });
  assert.equal(initialized.serverInfo.name, DOVE_MCP_SERVER_NAME, "MCP server name must be the canonical Dove name");
  assert.equal(initialized.serverInfo.version, PACKAGE_VERSION, "MCP server version must match the package version");
  assert.equal(initialized.protocolVersion, DOVE_MCP_PROBE_PROTOCOL_VERSION);
  client.notify("notifications/initialized");

  if (identityOnly) {
    client.kill();
    client = null;
    cleanupProbeWorkspace();
    console.log(JSON.stringify({
      ok: true,
      serverName: initialized.serverInfo.name,
      serverVersion: initialized.serverInfo.version,
      protocolVersion: initialized.protocolVersion,
      packageVersion: PACKAGE_VERSION,
      identityOnly: true,
      zeroWrite: true
    }));
    return;
  }

  const listed = await client.call("tools/list");
  const toolNames = listed.tools.map((tool) => tool.name);
  assert.deepEqual(toolNames, EXPECTED_TOOL_NAMES, "MCP discovery must expose exactly the eight Research Format 1 tools");
  for (const definition of listed.tools) {
    assert.deepEqual(definition.inputSchema?.properties?.operation?.enum, EXPECTED_OPERATIONS[definition.name], `${definition.name} operations must match Research Format 1`);
    assert.equal(definition.inputSchema?.additionalProperties, false, `${definition.name} input must be sealed`);
  }

  const workspace = await callTool("manage_dove_workspace", {
    operation: "initialize",
    researchQuestion: "Does the packaged or source MCP runtime preserve the Dove 0.7.0 Research Format 1 contract?",
    mainline: "Probe the exact eight-tool stdio surface with contained representative research records.",
    contributionIntent: "Provide bounded release evidence for the installed MCP runtime.",
    currentFocus: "Verify real persistence, zero-write queries, and ambient routing.",
    changeReason: "Initialized the isolated doctor probe workspace."
  });
  assert.equal(workspace.state, "current-healthy");
  assert.equal(workspace.format, DOVE_RESEARCH_FORMAT);
  assert.equal(workspace.workspaceRecord.researchQuestion.startsWith("Does the packaged or source MCP runtime"), true);
  assert.equal(workspace.workspaceRecord.mainline.startsWith("Probe the exact eight-tool"), true);
  assert.equal(workspace.workspaceRecord.contributionIntent.startsWith("Provide bounded release evidence"), true);
  assert.equal(workspace.workspaceRecord.currentFocus.startsWith("Verify real persistence"), true);

  const mission = await callTool("manage_dove_missions", {
    operation: "create",
    missionId: "doctor-probe",
    dependsOnMissionIds: [],
    goal: "Verify the current stdio MCP research surface without changing the target package tree.",
    requirements: ["Exercise representative durable research records.", "Preserve explicit evidence limits."],
    assumptions: ["The isolated probe workspace is disposable and contains no user research."],
    scope: ["The eight Research Format 1 MCP tools.", "The installed ambient hook route."],
    outOfScope: ["Scientific review authority.", "Generated package bundle regeneration."],
    evidenceRequirements: ["Successful stdio tool results.", "Identical snapshots around read operations and of the target tree."],
    competingHypotheses: ["The runtime matches Research Format 1.", "The runtime still exposes a stale surface."],
    openQuestions: ["Does every representative query preserve an identical workspace snapshot?"],
    contextRefs: ["probe:doctor-mcp"],
    contributionRole: "release-probe"
  });
  assert.equal(mission.missionId, "doctor-probe");

  fs.mkdirSync(path.join(probeWorkspace, "materials"), { recursive: true });
  fs.writeFileSync(path.join(probeWorkspace, "materials", "source.txt"), "Captured material for the isolated Dove doctor probe.\n");
  const source = await callTool("manage_dove_sources", {
    operation: "record",
    missionId: "doctor-probe",
    sourceId: "doctor-source",
    citationKey: "dove-doctor-probe",
    title: "Dove Doctor Probe Fixture",
    authors: ["Dove maintainers"],
    year: 2026,
    locator: "repository-local fixture",
    sourceType: "validation-fixture",
    summary: "A captured local fixture used only to verify Source persistence and query projection.",
    conditions: ["Repository-local isolated probe workspace."],
    relationship: "testable-gap",
    conflicts: [],
    limitations: ["Synthetic validation material, not external research evidence."],
    capturePath: "materials/source.txt",
    recordedAt: "2026-08-08T00:01:00.000Z"
  });
  assert.equal(source.sourceId, "doctor-source");
  await callZeroWriteTool("manage_dove_sources", { operation: "query", missionId: "doctor-probe" });

  const experimentPlan = await callTool("manage_dove_experiments", {
    operation: "freeze",
    missionId: "doctor-probe",
    experimentId: "doctor-experiment",
    title: "Stdio persistence and zero-write discrimination",
    hypothesisRefs: ["The runtime matches Research Format 1.", "The runtime still exposes a stale surface."],
    protocol: ["Record one contained fixture through stdio.", "Snapshot the workspace before and after each representative query."],
    inputs: ["The isolated probe workspace and current MCP registry."],
    comparisons: ["Pre-query tree snapshot versus post-query tree snapshot."],
    metrics: ["Changed tree entries."],
    discriminatingObservations: ["A zero changed-entry count supports the declared read-only behavior."],
    successConditions: ["All representative records round-trip and all queries preserve the tree."],
    stopConditions: ["Stop on the first failed assertion."],
    constraints: ["Do not change the target package tree."],
    expectedArtifacts: ["probe-artifacts/result.json"],
    cost: "One local stdio probe pass.",
    risk: "A stale runtime may reject current fields.",
    failureValue: "A failure identifies the exact packaging or source drift.",
    contributionRole: "runtime-discrimination",
    plannedAt: "2026-08-08T00:02:00.000Z"
  });
  assert.equal(experimentPlan.experimentId, "doctor-experiment");
  fs.mkdirSync(path.join(probeWorkspace, "probe-artifacts"), { recursive: true });
  fs.writeFileSync(path.join(probeWorkspace, "probe-artifacts", "result.json"), "{\"changedEntries\":0}\n");
  const experimentResult = await callTool("manage_dove_experiments", {
    operation: "record-result",
    missionId: "doctor-probe",
    experimentId: "doctor-experiment",
    kind: "positive",
    summary: "Representative records round-tripped through the current stdio surface.",
    observations: ["The current registry exposed the expected eight tools."],
    measurements: [{ metric: "tool-count", value: 8 }],
    denominator: { total: 8, observed: 8, failed: 0, excluded: 0 },
    hypothesisImpacts: [{ hypothesisRef: "The runtime matches Research Format 1.", impact: "supported-by-probe" }],
    claimImpacts: [],
    unexpectedObservations: [],
    uncertainty: ["This focused probe does not replace broader release validation."],
    artifactRefs: ["probe-artifacts/result.json"],
    failures: [],
    deviations: [],
    limitations: ["The fixture is synthetic and repository-local."],
    recordedAt: "2026-08-08T00:03:00.000Z"
  });
  assert.equal(experimentResult.kind, "positive");
  await callZeroWriteTool("manage_dove_experiments", { operation: "query", view: "result-synthesis", missionId: "doctor-probe" });

  const claims = await callTool("manage_dove_claims", {
    operation: "record",
    missionId: "doctor-probe",
    claims: [{
      claimId: "doctor-claim",
      statement: "This runtime exposed exactly eight Research Format 1 tools during the focused stdio probe.",
      supportRefs: ["experiment:doctor-experiment"],
      counterEvidenceRefs: [],
      missingEvidence: ["Broader release validation remains separate."],
      cannotSay: ["This probe does not establish scientific authority or complete release readiness."],
      uncertainty: ["Only the focused source-runtime or packaged-runtime path was exercised."],
      assessment: "supported",
      storyRole: "bounded-runtime-validation",
      artifactRefs: ["probe-artifacts/result.json"],
      recordedAt: "2026-08-08T00:04:00.000Z"
    }]
  });
  assert.equal(claims.claims[0].claimId, "doctor-claim");
  await callZeroWriteTool("manage_dove_claims", { operation: "query", missionId: "doctor-probe" });

  const lessonsMarkdown = "# Dove Lessons\n\n- Keep runtime probes aligned with the exact public research surface.\n- Treat focused validation as bounded evidence.\n";
  const lessonsWrite = await callTool("manage_dove_lessons", { operation: "replace", markdown: lessonsMarkdown });
  assert.equal(lessonsWrite.markdown, lessonsMarkdown);
  const lessonsRead = await callZeroWriteTool("manage_dove_lessons", { operation: "read" });
  assert.equal(lessonsRead.markdown, lessonsMarkdown);

  fs.writeFileSync(path.join(probeWorkspace, "review-scope.md"), "# Doctor Probe Review Scope\n");
  const review = await callZeroWriteTool("manage_dove_reviews", {
    operation: "local-preflight",
    missionId: "doctor-probe",
    exchangeId: "doctor-review",
    artifactPaths: ["review-scope.md"]
  });
  assert.equal(review.status, "ready");
  assert.equal(review.authority, "not-established");

  const overview = await callZeroWriteTool("query_dove_research", { operation: "overview", missionId: "doctor-probe", language: "en" });
  assert.deepEqual(overview.inventory, { missions: 1, sources: 1, experimentPlans: 1, experimentResults: 1, claims: 1, reviews: 0 });
  const missionQuery = await callZeroWriteTool("manage_dove_missions", { operation: "query", missionId: "doctor-probe" });
  assert.equal(missionQuery.inventory.missions, 1);

  const beforeHooks = snapshotTree(probeWorkspace);
  const slash = runAmbientHook({ hook_event_name: "UserPromptSubmit", prompt: "  /dove:status" });
  assert.equal(slash.status, 0, slash.stderr);
  assert.equal(slash.stdout, "");
  const ordinary = runAmbientHook({ hook_event_name: "UserPromptSubmit", prompt: "Implement the bounded package probe and add regression checks." });
  assert.equal(ordinary.status, 0, ordinary.stderr);
  const ambientPayload = JSON.parse(ordinary.stdout);
  assert.equal(ambientPayload.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(ambientPayload.hookSpecificOutput.additionalContext, /dove-intake/u);
  assert.match(ambientPayload.hookSpecificOutput.additionalContext, /zero-write/u);
  assert.doesNotMatch(ordinary.stdout, /Implement the bounded package probe/u);
  assert.deepEqual(snapshotTree(probeWorkspace), beforeHooks, "Ambient hook routing must be zero-write");

  client.kill();
  client = null;
  cleanupProbeWorkspace();
  assert.deepEqual(snapshotTree(target), targetBefore, "The target package tree changed during the MCP probe");

  console.log(JSON.stringify({
    ok: true,
    runtime: usingSourceRuntime ? "source" : "packaged",
    researchFormat: DOVE_RESEARCH_FORMAT,
    toolCount: toolNames.length,
    workspaceInitialized: true,
    missionCreated: true,
    sourceRoundTrip: true,
    experimentRoundTrip: true,
    claimRoundTrip: true,
    lessonsRoundTrip: true,
    reviewPreflightZeroWrite: true,
    queryZeroWrite: true,
    ambientRoutingZeroWrite: true,
    targetTreeUnchanged: true
  }));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  client?.kill();
  cleanupProbeWorkspace();
}
