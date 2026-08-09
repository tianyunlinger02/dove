import test from "node:test";
import assert from "node:assert/strict";

import { COMMAND_SURFACES } from "../../src/core/command-manifest.mjs";
import { ambientContextForPrompt, lessonsContextForPrompt, renderClaudeAmbientRule, renderClaudeAmbientSkill } from "../../src/core/ambient-policy.mjs";
import { DOVE_PRIMARY_ROLES, reviewerPrompt } from "../../src/core/role-definitions.mjs";
import { dispatchTool } from "../../src/mcp/handlers.mjs";
import { toolDefinitions } from "../../src/mcp/tool-definitions.mjs";
import { initializeProjectIntegration } from "../../src/core/project-installation.mjs";
import { initializeResearchWorkspace } from "../../src/core/workspace-init.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

const TOOLS = [
  "query_dove_research", "manage_dove_workspace", "manage_dove_missions", "manage_dove_sources",
  "manage_dove_experiments", "manage_dove_claims", "manage_dove_reviews", "manage_dove_lessons"
];
const SKILLS = ["research", "status", "source", "experiment", "draft", "figure", "review", "rebuttal", "lessons"];

test("public MCP exposes exactly eight research tools without legacy control fields", () => {
  assert.deepEqual(toolDefinitions.map((item) => item.name), TOOLS);
  const serialized = JSON.stringify(toolDefinitions);
  for (const forbidden of ["Outcome", "ResearchDecision", "Handoff", "completion", "attemptId", "replay", "binding", "missionNumber", "hostControl", "closureRequest"]) assert.doesNotMatch(serialized, new RegExp(forbidden, "iu"));
  const result = dispatchTool(process.cwd(), "close_host_outcome", {});
  assert.equal(result.isError, true);
  assert.deepEqual(Object.keys(result.structuredContent).sort(), ["operation", "research", "status"]);
});

test("absent and empty research projections are stable zero-write results in Chinese and English", async () => {
  const absent = createTempRoot("dove-mcp-absent-");
  const zh = await dispatchTool(absent, "query_dove_research", { operation: "overview" });
  assert.equal(zh.isError, undefined);
  assert.equal(zh.structuredContent.status, "absent");
  assert.equal(zh.structuredContent.research.reason, "research-workspace-not-initialized");
  assert.equal(zh.structuredContent.research.zeroWrite, true);
  assert.match(zh.content[0].text, /尚未建立.*没有写入.*普通项目材料/su);

  const en = await dispatchTool(absent, "query_dove_research", { operation: "overview", language: "en" });
  assert.equal(en.structuredContent.status, "absent");
  assert.match(en.content[0].text, /No Dove Research Workspace.*Nothing was written.*ordinary project materials/su);
  assert.doesNotMatch(en.content[0].text, /\/home\/|ENOENT|research-workspace-not-initialized/u);

  const installOnly = createTempRoot("dove-mcp-install-only-");
  initializeProjectIntegration(installOnly, { packageName: "dove", packageVersion: "0.7.0", hosts: ["claude"] });
  const installed = await dispatchTool(installOnly, "query_dove_research", { operation: "overview" });
  assert.equal(installed.structuredContent.status, "absent");
  assert.equal(installed.structuredContent.research.workspaceState, "research-absent");
  assert.equal(installed.structuredContent.research.zeroWrite, true);

  initializeResearchWorkspace(absent, {
    workspaceId: "workspace-empty",
    researchQuestion: "What should be investigated?",
    mainline: "Keep an empty durable research frame.",
    contributionIntent: "Validate empty projection behavior.",
    currentFocus: "No Mission exists yet.",
    createdAt: "2026-08-09T00:00:00.000Z"
  });
  const empty = await dispatchTool(absent, "query_dove_research", { operation: "overview" });
  assert.equal(empty.structuredContent.status, "ok");
  assert.equal(empty.structuredContent.research.inventory.missions, 0);
  assert.equal(empty.structuredContent.research.zeroWrite, true);
});

test("command manifest exposes nine flat Skills and review uses a user-managed exchange", () => {
  assert.deepEqual(COMMAND_SURFACES.map((item) => item.id), SKILLS.map((slug) => `dove.${slug}`));
  const review = COMMAND_SURFACES.find((item) => item.id === "dove.review");
  assert.match(JSON.stringify(review), /local-preflight.*prepare.*import.*coverage/isu);
  assert.doesNotMatch(JSON.stringify(COMMAND_SURFACES), /start-skill|create_ambient|closureRequest|record_dove_(?:draft|figure|rebuttal)/iu);
});

test("ambient routing is zero-write and reviewer role is not authority", () => {
  assert.match(ambientContextForPrompt("Implement the focused parser change"), /zero-write role and Skill routing/iu);
  assert.match(lessonsContextForPrompt("Read our lessons"), /manage_dove_lessons/iu);
  const ambient = `${renderClaudeAmbientRule()}\n${renderClaudeAmbientSkill()}`;
  assert.doesNotMatch(ambient, /create_ambient_dove_mission|closureRequest|researchHandoff|hostControl/iu);
  assert.match(ambient, /do not create a Mission/iu);
  assert.match(DOVE_PRIMARY_ROLES.reviewer.description, /convenience definition.*not.*independence.*authority/iu);
  assert.match(reviewerPrompt({ hostKind: "claude", reviewedArtifacts: [{ path: "paper.md", sizeBytes: 1, sha256: "a".repeat(64) }] }), /user-managed separate review exchange.*do not prove independence/isu);
});
