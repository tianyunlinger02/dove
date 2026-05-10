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
  HOST_IDS,
  OPENCODE_ROLE_SKILL_PATHS,
  TOOL_CONTEXT_PATHS,
  adapterPathForCommand,
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

const commandIds = new Set(COMMAND_SURFACES.map((command) => command.id));
const commandId = (...segments) => ["dove", ...segments].join(".");
const removedPaperMirrorSuffixes = ["orchestrate", "plan", "task-graph", "checklist", "materialize", "autonomy-operate", "governance-audit", "approvals", "follow-through"];
const removedPaperMirrorCommandIds = removedPaperMirrorSuffixes.map((suffix) => commandId("paper", suffix));
const removedConsolidatedCommandIds = [
  commandId("board"),
  commandId("task-graph"),
  commandId("materialize"),
  commandId("paper", "pipeline"),
  commandId("paper", "review-loop"),
  commandId("paper", "rebuttal-strategy"),
  commandId("paper", "experiment-plan"),
  commandId("paper", "experiment-audit"),
  commandId("paper", "version-snapshot"),
  commandId("paper", "version-compare"),
  commandId("paper", "open-questions"),
  commandId("paper", "decisions"),
  commandId("paper", "lineage"),
  commandId("paper", "wiki")
];
const removedCommandIds = [...removedPaperMirrorCommandIds, ...removedConsolidatedCommandIds];
assert.equal(commandIds.has(commandId("paper", "onboard")), false, "paper-specific onboarding must not duplicate the generic dove.onboard surface");
assert.equal(commandIds.has(commandId("onboard")), true, "generic dove.onboard surface must exist");
for (const removedCommandId of removedPaperMirrorCommandIds) {
  assert.equal(commandIds.has(removedCommandId), false, `${removedCommandId} must not duplicate the shared Dove control plane`);
}
for (const removedCommandId of removedConsolidatedCommandIds) {
  assert.equal(commandIds.has(removedCommandId), false, `${removedCommandId} must not remain as a public slash surface after consolidation`);
}

for (const command of COMMAND_SURFACES) {
  assert.ok(commandContextPaths(command).includes(".dove/context/actions/current.json"), `${command.id} should inherit base action context`);
  assert.ok((command.requiredTools ?? []).length > 0, `${command.id} must bind at least one real MCP tool`);
  for (const toolName of command.requiredTools ?? []) {
    assert.ok(TOOL_CONTEXT_PATHS[toolName], `${command.id} required tool ${toolName} should declare manifest context paths`);
  }
}

assert.deepEqual(COMMAND_SURFACES.find((command) => command.id === "dove.onboard")?.requiredTools, ["query_dove_onboarding"]);
assert.deepEqual(COMMAND_SURFACES.find((command) => command.id === "dove.status")?.requiredTools, ["query_dove_status"]);
assert.deepEqual(COMMAND_SURFACES.find((command) => command.id === "dove.paper.experiment")?.requiredTools, ["upsert_experiment_plan", "upsert_experiment_result", "run_experiment_audit"]);
assert.deepEqual(COMMAND_SURFACES.find((command) => command.id === "dove.paper.version")?.requiredTools, ["create_version_snapshot", "compare_versions", "query_lineage"]);
assert.deepEqual(COMMAND_SURFACES.find((command) => command.id === "dove.launch")?.requiredTools, ["launch_dove_mission"]);
assert.deepEqual(COMMAND_SURFACES.find((command) => command.id === "dove.paper.isolated-review")?.requiredTools, ["prepare_isolated_review", "import_isolated_review"]);

const classifiedCommandIds = new Set([
  ...GOVERNANCE_GUARDED_MUTATIONS.flatMap((entry) => entry.surfaceBindings?.commandIds ?? []),
  ...GOVERNANCE_EXEMPT_MUTATIONS.flatMap((entry) => entry.surfaceBindings?.commandIds ?? []),
  ...GOVERNANCE_READONLY_COMMANDS
]);
for (const command of COMMAND_SURFACES) {
  assert.equal(classifiedCommandIds.has(command.id), true, `Unclassified command surface: ${command.id}`);
}
for (const removedCommandId of removedCommandIds) {
  assert.equal(classifiedCommandIds.has(removedCommandId), false, `${removedCommandId} must not remain in governance classifications`);
}

const generatedCommandIds = new Set(generatedAdapterEntries().map(({ command }) => command.id));
for (const removedCommandId of removedCommandIds) {
  assert.equal(generatedCommandIds.has(removedCommandId), false, `${removedCommandId} must not generate adapter surfaces`);
  for (const hostId of HOST_IDS) {
    const adapterPath = adapterPathForCommand(hostId, removedCommandId);
    assert.equal(fs.existsSync(path.join(ROOT, adapterPath)), false, `${adapterPath} must be deleted instead of kept as a compatibility surface`);
  }
}

const readOnlyToolNames = new Set(GOVERNANCE_READONLY_TOOLS);
const forbiddenReadOnlyDoveTools = new Set([
  ...GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.surfaceBindings?.mcpTool),
  ...GOVERNANCE_EXEMPT_MUTATIONS.map((entry) => entry.surfaceBindings?.mcpTool)
].filter((toolName) => toolName && !readOnlyToolNames.has(toolName)));
const forbiddenRefreshingDoveQueries = ["query_task_graph", "query_workspace_index", "query_lineage", "query_meta_optimize"];
const proposalOnlyDoveQueryTools = new Set(["query_dove_orchestrate", "query_dove_mission", "query_dove_mission_board", "query_dove_status", "query_dove_audit", "query_dove_return", "query_dove_onboarding", "query_paper_pipeline"]);

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
