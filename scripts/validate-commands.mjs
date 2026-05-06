import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  GOVERNANCE_EXEMPT_MUTATIONS,
  GOVERNANCE_GUARDED_MUTATIONS,
  GOVERNANCE_READONLY_COMMANDS,
  GOVERNANCE_READONLY_TOOLS
} from "../src/core/schema.mjs";
import {
  COMMAND_SURFACES,
  OPENCODE_ROLE_SKILL_PATHS,
  TOOL_CONTEXT_PATHS,
  commandContextPaths
} from "../src/core/command-manifest.mjs";
import { checkGeneratedAdapters, generatedAdapterEntries } from "./generate-command-adapters.mjs";

const ROOT = process.cwd();

function readRelative(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Missing generated Dove adapter surface: ${relativePath}`);
  return fs.readFileSync(absolutePath, "utf8");
}

const drift = checkGeneratedAdapters(ROOT);
assert.equal(drift.length, 0, `Generated command adapter drift: ${drift.map((item) => `${item.relativePath} (${item.reason})`).join(", ")}`);

const generatorText = fs.readFileSync(path.join(ROOT, "scripts", "generate-command-adapters.mjs"), "utf8");
assert.doesNotMatch(generatorText, /const\s+(?:BASE_CONTEXT_PATHS|TOOL_CONTEXT_PATHS|COMMAND_CONTEXT_PATHS|COMMAND_CONSTRAINTS)\b/, "Command context and constraint metadata belongs in src/core/command-manifest.mjs, not the adapter generator");

for (const command of COMMAND_SURFACES) {
  assert.ok(commandContextPaths(command).includes(".dove/context/actions/current.json"), `${command.id} should inherit base action context`);
  for (const toolName of command.requiredTools ?? []) {
    assert.ok(TOOL_CONTEXT_PATHS[toolName], `${command.id} required tool ${toolName} should declare manifest context paths`);
  }
}

const classifiedCommandIds = new Set([
  ...GOVERNANCE_GUARDED_MUTATIONS.flatMap((entry) => entry.surfaceBindings?.commandIds ?? []),
  ...GOVERNANCE_EXEMPT_MUTATIONS.flatMap((entry) => entry.surfaceBindings?.commandIds ?? []),
  ...GOVERNANCE_READONLY_COMMANDS
]);
for (const command of COMMAND_SURFACES) {
  assert.equal(classifiedCommandIds.has(command.id), true, `Unclassified command surface: ${command.id}`);
}

const readOnlyToolNames = new Set(GOVERNANCE_READONLY_TOOLS);
const forbiddenReadOnlyDoveTools = new Set([
  ...GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.surfaceBindings?.mcpTool),
  ...GOVERNANCE_EXEMPT_MUTATIONS.map((entry) => entry.surfaceBindings?.mcpTool)
].filter((toolName) => toolName && !readOnlyToolNames.has(toolName)));
const forbiddenRefreshingDoveQueries = ["query_task_graph", "query_workspace_index", "query_lineage", "query_meta_optimize"];
const proposalOnlyDoveQueryTools = new Set(["query_dove_orchestrate", "query_dove_mission", "query_dove_mission_board", "query_dove_audit", "query_dove_return"]);

for (const { command, relativePath } of generatedAdapterEntries()) {
  const commandText = readRelative(relativePath);
  for (const requiredTool of command.requiredTools ?? []) {
    assert.equal(commandText.includes(requiredTool), true, `${relativePath} must mention ${requiredTool}`);
  }
  for (const forbiddenTool of command.forbiddenTools ?? []) {
    assert.equal(commandText.includes(forbiddenTool), false, `${relativePath} must not mention forbidden tool ${forbiddenTool}`);
  }
  if ((command.requiredTools ?? []).some((tool) => proposalOnlyDoveQueryTools.has(tool))) {
    for (const forbiddenTool of forbiddenReadOnlyDoveTools) {
      assert.equal(commandText.includes(forbiddenTool), false, `${relativePath} must stay read-only and not mention mutating MCP tool ${forbiddenTool}`);
    }
    for (const forbiddenQuery of forbiddenRefreshingDoveQueries) {
      assert.equal(commandText.includes(forbiddenQuery), false, `${relativePath} must not recommend refreshing query helper ${forbiddenQuery}`);
    }
  }
  if (command.id === "dove.launch") {
    assert.equal(commandText.includes("launch_dove_mission"), true, `${relativePath} must mention launch_dove_mission`);
    assert.equal(commandText.includes("materialize_guidance_packet"), false, `${relativePath} must use launch_dove_mission instead of direct materialize_guidance_packet`);
  }
}

for (const relativePath of OPENCODE_ROLE_SKILL_PATHS) {
  assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `Missing skill: ${relativePath}`);
}

const opencodeConfig = JSON.parse(fs.readFileSync(path.join(ROOT, ".opencode.json"), "utf8"));
assert.equal(opencodeConfig.mcpServers["dove"].command, "node");
assert.equal(Object.hasOwn(opencodeConfig, "$schema"), false);
console.log("Command and skill validation passed.");
