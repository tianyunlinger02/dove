import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";

import { createMcpStdioClient } from "./mcp-stdio-client.mjs";

const target = path.resolve(process.argv[2] ?? process.cwd());
const serverScriptPath = path.join(target, "mcp", "dove-state-server.mjs");
const { call, notify, kill } = createMcpStdioClient({ args: [serverScriptPath], cwd: target });

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
  notify("notifications/initialized");

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
    "query_dove_status",
    "publish_dove_status",
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

  for (const readOnlyDoveTool of ["query_dove_orchestrate", "query_dove_mission", "query_dove_mission_board", "query_dove_status", "query_document_ledger", "query_dove_audit", "query_dove_return"]) {
    const result = await call("tools/call", { name: readOnlyDoveTool, arguments: {} });
    const payload = JSON.parse(result.content[0].text);
    assert.equal(payload.proposalOnly, true, `${readOnlyDoveTool} should stay proposal-only`);
    assert.deepEqual(payload.writes, [], `${readOnlyDoveTool} should not write during doctor probe`);
  }
  await call("tools/call", { name: "query_program_approvals", arguments: {} });
}

try {
  await main();
  kill();
} catch (error) {
  kill();
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
