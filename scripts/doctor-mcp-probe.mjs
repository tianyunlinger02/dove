import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";

import { createMcpStdioClient } from "./mcp-stdio-client.mjs";
import { toolDefinitions } from "../src/mcp/tool-definitions.mjs";

const target = path.resolve(process.argv[2] ?? process.cwd());
const serverScriptPath = path.join(target, "mcp", "dove-state-server-package.mjs");
const { call, notify, kill } = createMcpStdioClient({ args: [serverScriptPath], cwd: target });

const TOOL_NAMES = toolDefinitions.map((tool) => tool.name);

function parseToolPayload(result) {
  assert.notEqual(result.isError, true, result.content?.[0]?.text ?? "MCP tool failed");
  return JSON.parse(result.content[0].text);
}

async function callReadOnlyTool(name, args = {}) {
  return parseToolPayload(await call("tools/call", { name, arguments: { ...args, resultMode: "full" } }));
}

async function main() {
  const init = await call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "dove-doctor", version: "0.3.0" }
  });
  assert.equal(init.serverInfo.name, "dove");
  notify("notifications/initialized");

  const listed = await call("tools/list");
  assert.deepEqual(listed.tools.map((tool) => tool.name), TOOL_NAMES, "MCP registry drifted from the sealed schema 8 surface");

  const status = await callReadOnlyTool("query_dove_status");
  assert.equal(status.query, true);
  assert.equal(status.proposalOnly, true);
  assert.equal(status.changes?.applied, false);

  const providers = await callReadOnlyTool("query_network_search_providers");
  assert.ok(Array.isArray(providers.providers));

  const search = await callReadOnlyTool("search_network", { query: "dove doctor public web status", kind: "web" });
  assert.ok(["blocked", "completed", "partial"].includes(search.status));
  assert.ok(Array.isArray(search.candidates));
}

try {
  await main();
  kill();
} catch (error) {
  kill();
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
