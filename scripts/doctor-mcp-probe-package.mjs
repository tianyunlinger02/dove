#!/usr/bin/env node
import { createRequire as __doveCreateRequire } from "node:module"; const require = __doveCreateRequire(import.meta.url);

// scripts/doctor-mcp-probe.mjs
import assert2 from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// scripts/mcp-stdio-client.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import process2 from "node:process";
var CALL_TIMEOUT_MS = 15e3;
function createMcpStdioClient({ args, cwd, command = process2.execPath, env = process2.env, timeoutMs = CALL_TIMEOUT_MS, onRequest = null, framing = "content-length" }) {
  const server = spawn(command, args, {
    cwd,
    env,
    stdio: ["pipe", "pipe", "inherit"]
  });
  let buffer = Buffer.alloc(0);
  let nextId = 1;
  const pending = /* @__PURE__ */ new Map();
  function sendMessage(message) {
    const body = JSON.stringify(message);
    if (framing === "jsonl") {
      server.stdin.write(`${body}
`);
      return;
    }
    server.stdin.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r
\r
${body}`);
  }
  function call(method, params = {}, label = null) {
    const id = nextId++;
    const callLabel = label ?? (method === "tools/call" && params?.name ? `${method}:${params.name}` : method);
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        server.kill();
        reject(new Error(`MCP call timed out after ${timeoutMs}ms: ${callLabel}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer, method, label: callLabel });
    });
    sendMessage({ jsonrpc: "2.0", id, method, params });
    return promise;
  }
  function notify(method, params = {}) {
    sendMessage({ jsonrpc: "2.0", method, params });
  }
  function handleMessage(message) {
    if (message.method && message.id !== void 0) {
      Promise.resolve().then(() => typeof onRequest === "function" ? onRequest(message.method, message.params) : null).then(
        (result) => sendMessage({ jsonrpc: "2.0", id: message.id, result }),
        (error) => sendMessage({ jsonrpc: "2.0", id: message.id, error: { code: -32603, message: error instanceof Error ? error.message : String(error) } })
      );
      return;
    }
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    clearTimeout(waiter.timer);
    if (message.error) waiter.reject(new Error(`${waiter.label}: ${message.error.message}`));
    else waiter.resolve(message.result);
  }
  function parseMessages() {
    while (true) {
      if (framing === "jsonl") {
        const lineEnd = buffer.indexOf("\n");
        if (lineEnd === -1) return;
        const body2 = buffer.slice(0, lineEnd).toString("utf8").trim();
        buffer = buffer.slice(lineEnd + 1);
        if (body2) handleMessage(JSON.parse(body2));
        continue;
      }
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const headerText = buffer.slice(0, headerEnd).toString("utf8");
      const match = headerText.match(/Content-Length:\s*(\d+)/i);
      assert.ok(match, "Missing Content-Length header from MCP server");
      const length = Number(match[1]);
      const totalLength = headerEnd + 4 + length;
      if (buffer.length < totalLength) return;
      const body = buffer.slice(headerEnd + 4, totalLength).toString("utf8");
      buffer = buffer.slice(totalLength);
      handleMessage(JSON.parse(body));
    }
  }
  server.stdout.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    parseMessages();
  });
  server.on("exit", (code) => {
    for (const waiter of pending.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error(`MCP server exited early during ${waiter.label} with code ${code}`));
    }
    pending.clear();
  });
  return {
    call,
    notify,
    kill: () => server.kill(),
    server
  };
}

// scripts/doctor-mcp-probe.mjs
var target = path.resolve(process.argv[2] ?? process.cwd());
var serverScriptPath = path.join(target, "mcp", "dove-state-server-package.mjs");
var ambientHookPath = path.join(target, "scripts", "dove-user-prompt-submit-package.mjs");
var EXPECTED_TOOL_NAMES = [
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
var elicitationCount = 0;
var approvalAction = "decline";
var probeWorkspace = null;
var client = null;
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
  assert2.notEqual(result.isError, true, result.content?.[0]?.text ?? "MCP tool failed");
  assert2.ok(result.structuredContent && typeof result.structuredContent === "object", "MCP tool must return public structuredContent");
  if (result.structuredContent.hostControl?.presentation?.mode === "silent") {
    assert2.deepEqual(result.content, [], "Silent MCP tools must not return human text");
  } else {
    assert2.equal(result.content?.[0]?.type, "text");
    assert2.ok(result.content[0].text.trim(), "Visible MCP tools must return human-readable text");
    assert2.throws(() => JSON.parse(result.content[0].text), /Unexpected token|Unexpected non-whitespace|JSON/u, "MCP text must not be a raw JSON DTO");
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
  assert2.equal(hookStat.isFile() && !hookStat.isSymbolicLink(), true, "Installed ambient hook bundle must be a regular file");
  probeWorkspace = fs.mkdtempSync(path.join(path.dirname(target), ".dove-doctor-runtime-probe-"));
  client = createMcpStdioClient({
    args: [serverScriptPath],
    cwd: probeWorkspace,
    env: { ...process.env, CLAUDE_PROJECT_DIR: probeWorkspace },
    onRequest(method) {
      assert2.equal(method, "elicitation/create", `Unexpected MCP client request: ${method}`);
      elicitationCount += 1;
      return { action: approvalAction, content: {} };
    }
  });
  const initialized = await client.call("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: { elicitation: {} },
    clientInfo: { name: "dove-doctor", version: "0.4.0" }
  });
  assert2.equal(initialized.serverInfo.name, "dove");
  assert2.equal(initialized.protocolVersion, "2025-06-18");
  client.notify("notifications/initialized");
  const listed = await client.call("tools/list");
  const toolNames = listed.tools.map((tool) => tool.name);
  assert2.equal(toolNames.length, 14);
  assert2.deepEqual(toolNames, EXPECTED_TOOL_NAMES, "MCP registry drifted from the sealed current-schema surface");
  approvalAction = "accept";
  const workspace = await callTool("manage_dove_workspace", {
    operation: "initialize",
    goal: "Verify the installed Dove research workflow.",
    mainline: "Verify the installed Dove research workflow."
  });
  assert2.equal(workspace.report.status, "initialized");
  assert2.equal(elicitationCount, 1);
  const materialized = await callTool("create_ambient_dove_mission", {
    mode: "ordinary",
    goal: "Verify installed direct Mission persistence.",
    mainlineAlignment: "This bounded validation directly checks the installed Dove workflow.",
    changesWorkspaceMainline: false,
    requirements: ["The installed runtime must preserve direct Mission fields."],
    completionCriteria: ["The installed direct Mission contract is current."]
  });
  assert2.equal(materialized.report.status, "materialized");
  assert2.deepEqual(materialized.hostControl.presentation, { mode: "silent", reason: "ambient-create-succeeded" });
  assert2.equal(materialized.hostControl.classification.continuation, "resume-original");
  assert2.equal(Object.hasOwn(materialized, "researchHandoff"), false);
  assert2.equal(materialized.hostControl.closureRequest.tool, "close_host_outcome");
  const status = await callTool("query_dove_status", { operation: "status", detail: "full" });
  assert2.equal(status.report.technicalAppendix.workstreams.items[0].number, 1);
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
  assert2.equal(elicitationCount, 2);
  assert2.equal(checkpoint.report.status, "declined");
  assert2.deepEqual(snapshotTree(probeWorkspace), beforeDecline);
  const slash = runAmbientHook({ hook_event_name: "UserPromptSubmit", prompt: "  /dove:status" });
  assert2.equal(slash.status, 0, slash.stderr);
  assert2.equal(slash.stdout, "");
  const ordinary = runAmbientHook({ hook_event_name: "UserPromptSubmit", prompt: "Implement the bounded package probe" });
  assert2.equal(ordinary.status, 0, ordinary.stderr);
  const ambientPayload = JSON.parse(ordinary.stdout);
  assert2.equal(ambientPayload.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert2.match(ambientPayload.hookSpecificOutput.additionalContext, /dove-intake/u);
  assert2.doesNotMatch(ordinary.stdout, /Implement the bounded package probe/u);
  client.kill();
  client = null;
  fs.rmSync(probeWorkspace, { recursive: true, force: true });
  probeWorkspace = null;
  assert2.deepEqual(snapshotTree(target), targetBefore);
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
