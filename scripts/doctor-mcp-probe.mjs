import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const target = path.resolve(process.argv[2] ?? process.cwd());
const serverScriptPath = path.join(target, "mcp", "dove-state-server.mjs");

const server = spawn("node", [serverScriptPath], {
  cwd: target,
  stdio: ["pipe", "pipe", "inherit"]
});

let buffer = Buffer.alloc(0);
let nextId = 1;
const pending = new Map();

function sendMessage(message) {
  const body = JSON.stringify(message);
  server.stdin.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}

function call(method, params = {}) {
  const id = nextId++;
  const promise = new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
  sendMessage({ jsonrpc: "2.0", id, method, params });
  return promise;
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
    if (message.error) {
      waiter.reject(new Error(message.error.message));
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
    waiter.reject(new Error(`MCP server exited early with code ${code}`));
  }
  pending.clear();
});

async function main() {
  const init = await call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "dove-doctor",
      version: "0.2.0"
    }
  });
  assert.equal(init.serverInfo.name, "dove");
  sendMessage({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });

  const listed = await call("tools/list");
  const names = new Set(listed.tools.map((tool) => tool.name));
  const requiredTools = [
    "ensure_workspace",
    "read_state",
    "query_workspace_index",
    "query_meta_optimize",
    "query_governance_coverage_report",
    "query_dove_orchestrate",
    "query_dove_mission",
    "query_dove_mission_board",
    "query_dove_audit",
    "query_dove_return",
    "query_program_approvals",
    "launch_dove_mission",
    "materialize_guidance_packet",
    "run_autonomy_once",
    "run_autonomy_foreground",
    "run_autonomy_operate",
    "run_experiment_audit",
    "bridge_result_to_claim",
    "run_review_loop",
    "sync_citations",
    "refresh_wiki",
    "build_rebuttal"
  ];
  for (const required of requiredTools) {
    assert.equal(names.has(required), true, `Missing MCP tool ${required}`);
  }

  await call("tools/call", { name: "read_state", arguments: {} });
  await call("tools/call", { name: "query_workspace_index", arguments: {} });
  await call("tools/call", { name: "query_governance_coverage_report", arguments: {} });
  const metaOptimize = await call("tools/call", { name: "query_meta_optimize", arguments: {} });
  const parsed = JSON.parse(metaOptimize.content[0].text);
  assert.equal(parsed.proposalOnly, true);
  assert.ok(Array.isArray(parsed.clusters), "Expected grouped optimizer clusters");
  assert.ok(parsed.frontier && typeof parsed.frontier === "object", "Expected optimizer frontier summary");
  assert.ok(parsed.groupedFrontier && typeof parsed.groupedFrontier === "object", "Expected grouped frontier envelope");
  assert.equal(parsed.groupedFrontier.ranking?.method, "durable-signal-frontier-v1");
  assert.ok(parsed.longHorizon && typeof parsed.longHorizon === "object", "Expected long-horizon optimizer memory");
  assert.equal(parsed.longHorizon.proposalOnly, true);

  for (const readOnlyDoveTool of ["query_dove_orchestrate", "query_dove_mission", "query_dove_mission_board", "query_dove_audit", "query_dove_return"]) {
    const result = await call("tools/call", { name: readOnlyDoveTool, arguments: {} });
    const payload = JSON.parse(result.content[0].text);
    assert.equal(payload.proposalOnly, true, `${readOnlyDoveTool} should stay proposal-only`);
    assert.deepEqual(payload.writes, [], `${readOnlyDoveTool} should not write during doctor probe`);
  }
  await call("tools/call", { name: "query_program_approvals", arguments: {} });
}

try {
  await main();
  server.kill();
} catch (error) {
  server.kill();
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
