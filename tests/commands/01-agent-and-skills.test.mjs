import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMAND_SURFACE_BY_ID,
  COMMAND_SURFACES,
  DOVE_AGENT_SURFACES,
  PROJECT_HOST_IDS,
  generatedDoveAgentEntries,
  renderClaudeDoveAgent,
  renderDoveAgentInstructions
} from "../../src/core/index.mjs";
import * as publicCore from "../../src/core/index.mjs";

const EXPECTED_HOST_IDS = ["claude", "dsh"];
const EXPECTED_SKILL_IDS = [
  "dove.research",
  "dove.status",
  "dove.source",
  "dove.experiment",
  "dove.draft",
  "dove.figure",
  "dove.review",
  "dove.rebuttal",
  "dove.lessons"
];

function contractActions(command) {
  return command.contract.semanticSections
    ? command.contract.semanticSections.flatMap((section) => section.actions ?? [])
    : command.contract.actions;
}

test("public Dove capability and host surfaces remain explicit", () => {
  assert.deepEqual(COMMAND_SURFACES.map(({ id }) => id), EXPECTED_SKILL_IDS);
  assert.deepEqual(Object.keys(COMMAND_SURFACE_BY_ID), EXPECTED_SKILL_IDS);
  assert.deepEqual(PROJECT_HOST_IDS, EXPECTED_HOST_IDS);

  for (const command of COMMAND_SURFACES) {
    assert.equal(COMMAND_SURFACE_BY_ID[command.id], command);
    assert.ok(command.summary.trim());
    assert.ok(contractActions(command).length > 0);
  }
});

test("Dove exposes one Claude agent definition with bounded roles", () => {
  assert.deepEqual(DOVE_AGENT_SURFACES, { claude: ".claude/agents/dove.md" });
  const agent = renderClaudeDoveAgent();
  assert.ok(agent.includes(renderDoveAgentInstructions()));
  assert.match(agent, /main session/iu);
  assert.match(agent, /bounded subagent/iu);
  assert.equal(agent.includes("## Shared researcher judgment"), false);
  assert.equal(agent.includes("## Author stance"), false);
  assert.deepEqual(generatedDoveAgentEntries(), [
    { relativePath: DOVE_AGENT_SURFACES.claude, content: agent }
  ]);
});

test("retired abstractions do not return as public API", () => {
  for (const name of [
    "DOVE_AGENT_DEFINITION",
    "DOVE_AGENT_NAME",
    "DOVE_AGENT_CAPSULE_BULLETS",
    "DOVE_AGENT_PERSONA_BULLETS",
    "renderDoveAgentPersonaSection",
    "HOST_ADAPTER_POLICY",
    "DOVE_RESEARCH_SHARED_CONTRACT",
    "DOVE_RESEARCH_CAPSULE_BULLETS",
    "DOVE_RESEARCH_ACTION_LENS_FRAME",
    "DOVE_RESEARCH_MATURITY"
  ]) assert.equal(Object.hasOwn(publicCore, name), false, name);
});
