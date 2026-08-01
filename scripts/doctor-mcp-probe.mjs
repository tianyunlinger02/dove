#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { createMcpStdioClient } from "./mcp-stdio-client.mjs";

const target = path.resolve(process.argv[2] ?? process.cwd());
const serverScriptPath = path.join(target, "mcp", "dove-state-server-package.mjs");
const ambientHookPath = path.join(target, "scripts", "dove-user-prompt-submit-package.mjs");
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
let elicitationCount = 0;
let approvalAction = "decline";
let probeWorkspace = null;
let client = null;

function snapshotTree(root) {
  const result = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(absolutePath);
      else if (entry.isSymbolicLink()) result[relativePath] = `symlink:${fs.readlinkSync(absolutePath)}`;
      else result[relativePath] = fs.readFileSync(absolutePath).toString("base64");
    }
  };
  visit(root);
  return result;
}

function parseToolPayload(result) {
  assert.notEqual(result.isError, true, result.content?.[0]?.text ?? "MCP tool failed");
  assert.ok(result.structuredContent && typeof result.structuredContent === "object", "MCP tool must return public structuredContent");
  if (result.structuredContent.hostControl?.presentation?.mode === "silent") {
    assert.deepEqual(result.content, [], "Silent MCP tools must not return human text");
  } else {
    assert.equal(result.content?.[0]?.type, "text");
    assert.ok(result.content[0].text.trim(), "Visible MCP tools must return human-readable text");
    assert.throws(() => JSON.parse(result.content[0].text), /Unexpected token|Unexpected non-whitespace|JSON/u, "MCP text must not be a raw JSON DTO");
  }
  return result.structuredContent;
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
  return parseToolPayload(await client.call("tools/call", { name, arguments: arguments_ }));
}

async function main() {
  const targetBefore = snapshotTree(target);
  const hookStat = fs.lstatSync(ambientHookPath);
  assert.equal(hookStat.isFile() && !hookStat.isSymbolicLink(), true, "Installed ambient hook bundle must be a regular file");
  probeWorkspace = fs.mkdtempSync(path.join(path.dirname(target), ".dove-doctor-runtime-probe-"));
  client = createMcpStdioClient({
    args: [serverScriptPath],
    cwd: probeWorkspace,
    env: { ...process.env, CLAUDE_PROJECT_DIR: probeWorkspace },
    onRequest(method) {
      assert.equal(method, "elicitation/create", `Unexpected MCP client request: ${method}`);
      elicitationCount += 1;
      return { action: approvalAction, content: {} };
    }
  });

  const initialized = await client.call("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: { elicitation: {} },
    clientInfo: { name: "dove-doctor", version: "0.4.0" }
  });
  assert.equal(initialized.serverInfo.name, "dove");
  assert.equal(initialized.protocolVersion, "2025-06-18");
  client.notify("notifications/initialized");

  const listed = await client.call("tools/list");
  const toolNames = listed.tools.map((tool) => tool.name);
  assert.equal(toolNames.length, 14);
  assert.deepEqual(toolNames, EXPECTED_TOOL_NAMES, "MCP registry drifted from the sealed current-schema surface");

  approvalAction = "accept";
  const workspace = await callTool("manage_dove_workspace", {
    operation: "initialize",
    goal: "Verify the installed Dove research workflow.",
    mainline: "Verify the installed Dove research workflow."
  });
  assert.equal(workspace.report.status, "initialized");
  assert.equal(elicitationCount, 1);

  const materialized = await callTool("create_ambient_dove_mission", {
    mode: "ordinary",
    goal: "Verify installed direct Mission persistence.",
    mainlineAlignment: "This bounded validation directly checks the installed Dove workflow.",
    changesWorkspaceMainline: false,
    requirements: ["The installed runtime must preserve direct Mission fields."],
    completionCriteria: ["The installed direct Mission contract is current."]
  });
  assert.equal(materialized.report.status, "materialized");
  assert.deepEqual(materialized.hostControl.presentation, { mode: "silent", reason: "ambient-create-succeeded" });
  assert.equal(materialized.hostControl.classification.continuation, "resume-original");
  assert.equal(Object.hasOwn(materialized, "researchHandoff"), false);
  assert.equal(materialized.hostControl.closureRequest.tool, "close_host_outcome");

  const status = await callTool("query_dove_status", { operation: "status", detail: "full" });
  assert.equal(status.report.technicalAppendix.workstreams.items[0].number, 1);

  const beforeDecline = snapshotTree(probeWorkspace);
  approvalAction = "decline";
  const checkpoint = await callTool("manage_dove_mission", {
    operation: "branch",
    mode: "ordinary",
    parentMissionNumber: 1,
    branchKind: "alternative",
    branchReason: "Verify that a declined explicit child checkpoint remains zero-write.",
    stopParentReason: "The parent would stop only if this child checkpoint were approved.",
    goal: "Exercise a declined explicit child branch.",
    changeFrom: {
      dispositions: [{
        requirementId: "requirement-goal",
        disposition: "changed",
        reason: "The declined branch would test an alternative bounded goal."
      }]
    }
  });
  assert.equal(elicitationCount, 2);
  assert.equal(checkpoint.report.status, "declined");
  assert.deepEqual(snapshotTree(probeWorkspace), beforeDecline);

  const slash = runAmbientHook({ hook_event_name: "UserPromptSubmit", prompt: "  /dove:status" });
  assert.equal(slash.status, 0, slash.stderr);
  assert.equal(slash.stdout, "");
  const ordinary = runAmbientHook({ hook_event_name: "UserPromptSubmit", prompt: "Implement the bounded package probe" });
  assert.equal(ordinary.status, 0, ordinary.stderr);
  const ambientPayload = JSON.parse(ordinary.stdout);
  assert.equal(ambientPayload.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(ambientPayload.hookSpecificOutput.additionalContext, /dove-intake/u);
  assert.doesNotMatch(ordinary.stdout, /Implement the bounded package probe/u);

  client.kill();
  client = null;
  fs.rmSync(probeWorkspace, { recursive: true, force: true });
  probeWorkspace = null;
  assert.deepEqual(snapshotTree(target), targetBefore);

  console.log(JSON.stringify({
    ok: true,
    toolCount: toolNames.length,
    hasManageDoveWorkspace: true,
    hasCreateAmbientDoveMission: true,
    elicitationCount,
    checkpointStatus: checkpoint.report.status,
    workspaceInitialized: true,
    ambientHookBundle: true,
    zeroWrite: true
  }));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  client?.kill();
  if (probeWorkspace) fs.rmSync(probeWorkspace, { recursive: true, force: true });
}
