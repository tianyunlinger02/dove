import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { createMcpStdioClient } from "./mcp-stdio-client.mjs";

const target = path.resolve(process.argv[2] ?? process.cwd());
const serverScriptPath = path.join(target, "mcp", "dove-state-server-package.mjs");
const EXPECTED_TOOL_NAMES = [
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
let elicitationCount = 0;
const client = createMcpStdioClient({
  args: [serverScriptPath],
  cwd: target,
  env: { ...process.env, CLAUDE_PROJECT_DIR: target },
  onRequest(method) {
    assert.equal(method, "elicitation/create", `Unexpected MCP client request: ${method}`);
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
  assert.notEqual(result.isError, true, result.content?.[0]?.text ?? "MCP tool failed");
  assert.equal(result.content?.[0]?.type, "text");
  return JSON.parse(result.content[0].text);
}

async function main() {
  const before = snapshotTree(target);
  const init = await client.call("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: { elicitation: {} },
    clientInfo: { name: "dove-doctor", version: "0.4.0" }
  });
  assert.equal(init.serverInfo.name, "dove");
  assert.equal(init.protocolVersion, "2025-06-18");
  client.notify("notifications/initialized");

  const listed = await client.call("tools/list");
  const toolNames = listed.tools.map((tool) => tool.name);
  assert.equal(toolNames.length, 28);
  assert.deepEqual(toolNames, EXPECTED_TOOL_NAMES, "MCP registry drifted from the sealed schema 9 surface");
  assert.equal(toolNames.includes("create_dove_mission"), true);

  const checkpoint = parseToolPayload(await client.call("tools/call", {
    name: "create_dove_mission",
    arguments: {
      missionId: "dove-doctor-decline-probe",
      goal: "Verify that declining a Dove checkpoint performs no durable writes."
    }
  }));
  assert.equal(elicitationCount, 1);
  assert.equal(checkpoint.status, "declined");
  assert.deepEqual(snapshotTree(target), before);

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
  process.exitCode = 1;
} finally {
  client.kill();
}
