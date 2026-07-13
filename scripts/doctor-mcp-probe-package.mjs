// scripts/doctor-mcp-probe.mjs
import assert2 from "node:assert/strict";
import path from "node:path";
import process from "node:process";

// scripts/mcp-stdio-client.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
var CALL_TIMEOUT_MS = 15e3;
function createMcpStdioClient({ args, cwd, command = "node", timeoutMs = CALL_TIMEOUT_MS }) {
  const server = spawn(command, args, {
    cwd,
    stdio: ["pipe", "pipe", "inherit"]
  });
  let buffer = Buffer.alloc(0);
  let nextId = 1;
  const pending = /* @__PURE__ */ new Map();
  function sendMessage(message) {
    const body = JSON.stringify(message);
    server.stdin.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r
\r
${body}`);
  }
  function call2(method, params = {}, label = null) {
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
  function notify2(method, params = {}) {
    sendMessage({ jsonrpc: "2.0", method, params });
  }
  function parseMessages() {
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }
      const headerText = buffer.slice(0, headerEnd).toString("utf8");
      const match = headerText.match(/Content-Length:\s*(\d+)/i);
      assert.ok(match, "Missing Content-Length header from MCP server");
      const length = Number(match[1]);
      const totalLength = headerEnd + 4 + length;
      if (buffer.length < totalLength) {
        return;
      }
      const body = buffer.slice(headerEnd + 4, totalLength).toString("utf8");
      buffer = buffer.slice(totalLength);
      const message = JSON.parse(body);
      const waiter = pending.get(message.id);
      if (!waiter) {
        continue;
      }
      pending.delete(message.id);
      clearTimeout(waiter.timer);
      if (message.error) {
        waiter.reject(new Error(`${waiter.label}: ${message.error.message}`));
      } else {
        waiter.resolve(message.result);
      }
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
    call: call2,
    notify: notify2,
    kill: () => server.kill(),
    server
  };
}

// scripts/doctor-mcp-probe.mjs
var target = path.resolve(process.argv[2] ?? process.cwd());
var serverScriptPath = path.join(target, "mcp", "dove-state-server-package.mjs");
var { call, notify, kill } = createMcpStdioClient({ args: [serverScriptPath], cwd: target });
function parseToolPayload(result) {
  const payload = JSON.parse(result.content[0].text);
  if (payload?.presentation === "dove-mcp-result-contract" && payload.fullResult) {
    return payload.fullResult;
  }
  return payload;
}
function assertNoWrites(payload, label) {
  if (payload.writes === void 0) {
    return;
  }
  if (Array.isArray(payload.writes)) {
    assert2.deepEqual(payload.writes, [], `${label} should not write during doctor probe`);
    return;
  }
  assert2.deepEqual(payload.writes, {
    applied: false,
    count: 0,
    writeIntent: "none",
    rollbackEligible: "not-applicable"
  }, `${label} should not write during doctor probe`);
}
async function callReadOnlyTool(name, args = {}) {
  const result = await call("tools/call", { name, arguments: { ...args, resultMode: args.resultMode ?? "full" } });
  return parseToolPayload(result);
}
async function main() {
  const init = await call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "dove-doctor",
      version: "0.2.0"
    }
  });
  assert2.equal(init.serverInfo.name, "dove");
  notify("notifications/initialized");
  const operatorListed = await call("tools/list");
  const operatorNames = new Set(operatorListed.tools.map((tool) => tool.name));
  const requiredOperatorTools = [
    "query_dove_status",
    "query_dove_orchestrate",
    "query_document_ledger",
    "query_operator_lessons",
    "search_network",
    "query_network_search_providers",
    "create_dove_task",
    "run_dove_auto",
    "run_dove_operator",
    "register_source",
    "upsert_note",
    "upsert_draft",
    "record_document_evidence",
    "run_figure_workflow",
    "run_experience_workflow",
    "run_review_loop",
    "build_rebuttal_strategy",
    "query_dove_return"
  ];
  for (const required of requiredOperatorTools) {
    assert2.equal(operatorNames.has(required), true, `Missing default operator MCP tool ${required}`);
  }
  for (const hiddenByDefault of ["ensure_workspace", "record_dove_mission_pass", "materialize_guidance_packet", "launch_dove_mission"]) {
    assert2.equal(operatorNames.has(hiddenByDefault), false, `Default MCP operator surface should not expose ${hiddenByDefault}`);
  }
  const listed = await call("tools/list", { surface: "full" });
  const names = new Set(listed.tools.map((tool) => tool.name));
  for (const retiredTool of ["issue_program_approval", "run_autonomy_once", "run_autonomy_foreground", "run_autonomy_operate"]) {
    assert2.equal(names.has(retiredTool), false, `Full MCP surface must not register ${retiredTool}`);
  }
  const requiredTools = [
    "ensure_workspace",
    "read_state",
    "query_workspace_index",
    "query_meta_optimize",
    "query_governance_coverage_report",
    "search_network",
    "query_network_search_providers",
    "query_dove_orchestrate",
    "query_dove_mission",
    "query_dove_mission_board",
    "query_dove_status",
    "publish_dove_status",
    "publish_dove_global_status",
    "query_document_ledger",
    "record_document_evidence",
    "query_dove_audit",
    "query_dove_return",
    "init_dove_goal",
    "create_dove_task",
    "record_dove_mission_pass",
    "apply_dove_status_adjustments",
    "run_dove_auto",
    "run_dove_operator",
    "kill_dove_task",
    "reset_dove_version",
    "run_experience_workflow",
    "prepare_audio_review",
    "import_audio_review",
    "run_audio_review",
    "run_dove_review_loop",
    "query_program_approvals",
    "launch_dove_mission",
    "materialize_guidance_packet",
    "run_experiment_audit",
    "bridge_result_to_claim",
    "run_review_loop",
    "sync_citations",
    "refresh_wiki",
    "build_rebuttal"
  ];
  for (const required of requiredTools) {
    assert2.equal(names.has(required), true, `Missing full MCP tool ${required}`);
  }
  await callReadOnlyTool("read_state");
  await callReadOnlyTool("query_workspace_index");
  await callReadOnlyTool("query_governance_coverage_report");
  const providerStatus = await callReadOnlyTool("query_network_search_providers");
  assert2.ok(Array.isArray(providerStatus.providers), "Expected network search provider status list");
  assertNoWrites(providerStatus, "query_network_search_providers");
  const searchStatus = await callReadOnlyTool("search_network", { query: "dove doctor public web status", kind: "web" });
  assert2.equal(searchStatus.status, "blocked");
  assert2.equal(searchStatus.candidates.length, 0, "Expected unavailable public web search to exhaust with no candidate work");
  assert2.equal(searchStatus.needsAttention?.status, "blocked");
  assertNoWrites(searchStatus, "search_network");
  const parsed = await callReadOnlyTool("query_meta_optimize");
  assert2.equal(parsed.proposalOnly, true);
  assert2.ok(Array.isArray(parsed.clusters), "Expected grouped optimizer clusters");
  assert2.ok(parsed.frontier && typeof parsed.frontier === "object", "Expected optimizer frontier summary");
  assert2.ok(parsed.groupedFrontier && typeof parsed.groupedFrontier === "object", "Expected grouped frontier envelope");
  assert2.equal(parsed.groupedFrontier.ranking?.method, "durable-signal-frontier-v1");
  assert2.ok(parsed.longHorizon && typeof parsed.longHorizon === "object", "Expected long-horizon optimizer memory");
  assert2.equal(parsed.longHorizon.proposalOnly, true);
  for (const readOnlyDoveTool of ["query_dove_orchestrate", "query_dove_mission", "query_dove_mission_board", "query_dove_status", "query_document_ledger", "query_dove_audit", "query_dove_return"]) {
    const payload = await callReadOnlyTool(readOnlyDoveTool);
    assert2.equal(payload.proposalOnly, true, `${readOnlyDoveTool} should stay proposal-only`);
    assertNoWrites(payload, readOnlyDoveTool);
  }
  await callReadOnlyTool("query_program_approvals");
}
try {
  await main();
  kill();
} catch (error) {
  kill();
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
