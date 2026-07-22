// scripts/doctor-mcp-probe.mjs
import assert2 from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process2 from "node:process";

// scripts/mcp-stdio-client.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import process from "node:process";
var CALL_TIMEOUT_MS = 15e3;
function createMcpStdioClient({ args, cwd, command = process.execPath, env = process.env, timeoutMs = CALL_TIMEOUT_MS, onRequest = null, framing = "content-length" }) {
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
var target = path.resolve(process2.argv[2] ?? process2.cwd());
var serverScriptPath = path.join(target, "mcp", "dove-state-server-package.mjs");
var EXPECTED_TOOL_NAMES = [
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
var elicitationCount = 0;
var client = createMcpStdioClient({
  args: [serverScriptPath],
  cwd: target,
  env: { ...process2.env, CLAUDE_PROJECT_DIR: target },
  onRequest(method) {
    assert2.equal(method, "elicitation/create", `Unexpected MCP client request: ${method}`);
    elicitationCount += 1;
    return { action: "decline", content: {} };
  }
});
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
  assert2.equal(result.content?.[0]?.type, "text");
  return JSON.parse(result.content[0].text);
}
async function main() {
  const before = snapshotTree(target);
  const init = await client.call("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: { elicitation: {} },
    clientInfo: { name: "dove-doctor", version: "0.4.0" }
  });
  assert2.equal(init.serverInfo.name, "dove");
  assert2.equal(init.protocolVersion, "2025-06-18");
  client.notify("notifications/initialized");
  const listed = await client.call("tools/list");
  const toolNames = listed.tools.map((tool) => tool.name);
  assert2.equal(toolNames.length, 28);
  assert2.deepEqual(toolNames, EXPECTED_TOOL_NAMES, "MCP registry drifted from the sealed schema 9 surface");
  assert2.equal(toolNames.includes("create_dove_mission"), true);
  const checkpoint = parseToolPayload(await client.call("tools/call", {
    name: "create_dove_mission",
    arguments: {
      missionId: "dove-doctor-decline-probe",
      goal: "Verify that declining a Dove checkpoint performs no durable writes."
    }
  }));
  assert2.equal(elicitationCount, 1);
  assert2.equal(checkpoint.status, "declined");
  assert2.deepEqual(snapshotTree(target), before);
  console.log(JSON.stringify({
    ok: true,
    toolCount: toolNames.length,
    hasCreateDoveMission: true,
    elicitationCount,
    checkpointStatus: checkpoint.status,
    zeroWrite: true
  }));
}
try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process2.exitCode = 1;
} finally {
  client.kill();
}
