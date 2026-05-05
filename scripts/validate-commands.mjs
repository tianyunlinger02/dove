import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GOVERNANCE_EXEMPT_MUTATIONS, GOVERNANCE_GUARDED_MUTATIONS, GOVERNANCE_READONLY_COMMANDS, GOVERNANCE_READONLY_TOOLS } from "../src/core/schema.mjs";

const ROOT = process.cwd();

const doveSurfaces = ["orchestrate", "mission", "board", "audit", "return"];
const doveSurfaceQueries = {
  orchestrate: "query_dove_orchestrate",
  mission: "query_dove_mission",
  board: "query_dove_mission_board",
  audit: "query_dove_audit",
  return: "query_dove_return"
};

const requiredCommands = [
  "paper.init.md",
  "paper.orchestrate.md",
  ...doveSurfaces.map((surface) => `dove.${surface}.md`),
  "dove.launch.md",
  "paper.audit.md",
  "paper.onboard.md",
  "paper.research.md",
  "paper.source.md",
  "paper.note.md",
  "paper.claim-gate.md",
  "paper.outline.md",
  "paper.plan.md",
  "paper.draft.md",
  "paper.experiment-plan.md",
  "paper.experiment-audit.md",
  "paper.review.md",
  "paper.review-loop.md",
  "paper.isolated-review.md",
  "paper.result-bridge.md",
  "paper.revise.md",
  "paper.rebuttal-strategy.md",
  "paper.version-snapshot.md",
  "paper.version-compare.md",
  "paper.task-graph.md",
  "paper.open-questions.md",
  "paper.decisions.md",
  "paper.lineage.md",
  "paper.meta-optimize.md",
  "paper.follow-through.md",
  "paper.materialize.md",
  "paper.autonomy-operate.md",
  "paper.governance-audit.md",
  "paper.wiki.md",
  "paper.checklist.md",
  "paper.citations.md",
  "paper.figure.md",
  "paper.pipeline.md",
  "paper.rebuttal.md"
];

const requiredSkills = [
  "paper-factory-pipeline/SKILL.md",
  "paper-factory-planner/SKILL.md",
  "paper-factory-researcher/SKILL.md",
  "paper-factory-reviewer/SKILL.md",
  "paper-factory-rebuttal-strategist/SKILL.md",
  "paper-factory-experiment-planning/SKILL.md",
  "paper-factory-version-analyst/SKILL.md",
  "paper-factory-claim-gate/SKILL.md",
  "paper-factory-review-loop/SKILL.md",
  "paper-factory-citation-discipline/SKILL.md",
  "paper-factory-rebuttal/SKILL.md"
];

const doveAdapterFiles = [
  ...doveSurfaces.map((surface) => ({ surface, relativePath: path.join(".opencode", "commands", `dove.${surface}.md`) })),
  ...doveSurfaces.map((surface) => ({ surface, relativePath: path.join(".claude", "commands", "dove", `${surface}.md`) })),
  ...doveSurfaces.map((surface) => ({ surface, relativePath: path.join(".cursor", "commands", `dove-${surface}.md`) })),
  ...doveSurfaces.map((surface) => ({ surface, relativePath: path.join(".codex", "skills", `dove-${surface}`, "SKILL.md") })),
  ...doveSurfaces.map((surface) => ({ surface, relativePath: path.join(".agents", "skills", `dove-${surface}`, "SKILL.md") }))
];
const doveLaunchAdapterFiles = [
  path.join(".opencode", "commands", "dove.launch.md"),
  path.join(".claude", "commands", "dove", "launch.md"),
  path.join(".cursor", "commands", "dove-launch.md"),
  path.join(".codex", "skills", "dove-launch", "SKILL.md"),
  path.join(".agents", "skills", "dove-launch", "SKILL.md")
];

for (const fileName of requiredCommands) {
  assert.ok(fs.existsSync(path.join(ROOT, ".opencode", "commands", fileName)), `Missing command: ${fileName}`);
}

const classifiedCommandIds = new Set([
  ...GOVERNANCE_GUARDED_MUTATIONS.flatMap((entry) => entry.surfaceBindings?.commandIds ?? []),
  ...GOVERNANCE_EXEMPT_MUTATIONS.flatMap((entry) => entry.surfaceBindings?.commandIds ?? []),
  ...GOVERNANCE_READONLY_COMMANDS
]);
for (const fileName of requiredCommands) {
  const commandId = fileName.replace(/\.md$/, "");
  assert.equal(classifiedCommandIds.has(commandId), true, `Unclassified command surface: ${commandId}`);
}

for (const routerFileName of ["paper.orchestrate.md", "dove.orchestrate.md"]) {
  const orchestrateText = fs.readFileSync(path.join(ROOT, ".opencode", "commands", routerFileName), "utf8");
  for (const forbiddenTool of ["upsert_orchestration_board", "append_handoff"]) {
    assert.equal(orchestrateText.includes(forbiddenTool), false, `${routerFileName} must stay a pure router and not mention ${forbiddenTool}`);
  }
}

const readOnlyToolNames = new Set(GOVERNANCE_READONLY_TOOLS);
const forbiddenReadOnlyDoveTools = new Set([
  ...GOVERNANCE_GUARDED_MUTATIONS.map((entry) => entry.surfaceBindings?.mcpTool),
  ...GOVERNANCE_EXEMPT_MUTATIONS.map((entry) => entry.surfaceBindings?.mcpTool)
].filter((toolName) => toolName && !readOnlyToolNames.has(toolName)));
const forbiddenRefreshingDoveQueries = ["query_task_graph", "query_workspace_index", "query_lineage", "query_meta_optimize"];
for (const { surface, relativePath } of doveAdapterFiles) {
  const absolutePath = path.join(ROOT, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Missing Dove adapter surface: ${relativePath}`);
  const commandText = fs.readFileSync(absolutePath, "utf8");
  assert.equal(commandText.includes(doveSurfaceQueries[surface]), true, `${relativePath} must mention ${doveSurfaceQueries[surface]}`);
  for (const forbiddenTool of forbiddenReadOnlyDoveTools) {
    assert.equal(commandText.includes(forbiddenTool), false, `${relativePath} must stay read-only and not mention mutating MCP tool ${forbiddenTool}`);
  }
  for (const forbiddenQuery of forbiddenRefreshingDoveQueries) {
    assert.equal(commandText.includes(forbiddenQuery), false, `${relativePath} must not recommend refreshing query helper ${forbiddenQuery}`);
  }
}

for (const relativePath of doveLaunchAdapterFiles) {
  const absolutePath = path.join(ROOT, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Missing Dove launch adapter surface: ${relativePath}`);
  const commandText = fs.readFileSync(absolutePath, "utf8");
  assert.equal(commandText.includes("launch_dove_mission"), true, `${relativePath} must mention launch_dove_mission`);
  assert.equal(commandText.includes("materialize_guidance_packet"), false, `${relativePath} must use launch_dove_mission instead of direct materialize_guidance_packet`);
  for (const forbiddenQuery of forbiddenRefreshingDoveQueries) {
    assert.equal(commandText.includes(forbiddenQuery), false, `${relativePath} must not recommend refreshing query helper ${forbiddenQuery}`);
  }
}

for (const relativePath of requiredSkills) {
  assert.ok(fs.existsSync(path.join(ROOT, ".opencode", "skills", relativePath)), `Missing skill: ${relativePath}`);
}

const opencodeConfig = JSON.parse(fs.readFileSync(path.join(ROOT, ".opencode.json"), "utf8"));
assert.equal(opencodeConfig.mcpServers["paper-factory"].command, "node");
assert.equal(Object.hasOwn(opencodeConfig, "$schema"), false);
console.log("Command and skill validation passed.");
