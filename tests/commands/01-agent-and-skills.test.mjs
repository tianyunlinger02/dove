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
import { renderDoveReviewerStanceSection, renderDoveSharedResearchContractSection } from "../../src/core/dove-agent-persona.mjs";
import { DOVE_AUTHOR_PREFERENCES_READ_TRIGGER, DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS } from "../../src/core/dove-author-preferences.mjs";
import { renderDoveResearchQualityReference, renderDoveResearchReanchor } from "../../src/core/dove-research-contract.mjs";
import { generatedAdapterEntries, generatedClaudeAmbientProjectEntries } from "../../scripts/generate-command-adapters.mjs";

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

test("Experiment discovery includes agreed capability checks and retrospective work", () => {
  for (const entry of generatedAdapterEntries().filter(({ command }) => command.id === "dove.experiment")) {
    const description = JSON.parse(entry.content.match(/^description: (.+)$/mu)[1]);
    for (const purpose of [/reproduction/iu, /delivery/iu, /retrospective/iu]) {
      assert.match(description, purpose, `${entry.hostId}: discovery includes ${purpose.source}`);
    }
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

test("reviewer guidance excludes author stance and preference access", () => {
  // The runtime composes these owners; checking them needs no reviewer launch.
  for (const guidance of [renderDoveSharedResearchContractSection(), renderDoveReviewerStanceSection(), renderDoveResearchQualityReference()]) {
    assert.equal(guidance.includes("## Author stance"), false);
    assert.equal(guidance.includes(DOVE_AUTHOR_PREFERENCES_READ_TRIGGER), false);
    assert.equal(guidance.includes(DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS.claude), false);
  }
  assert.match(renderDoveReviewerStanceSection(), /read-only/iu);
  assert.match(renderDoveReviewerStanceSection(), /listed frozen materials/iu);
});

test("quality reference connects contribution signals to investment without positivity gates", () => {
  const reference = renderDoveResearchQualityReference();
  assert.match(reference, /preliminary support/iu);
  assert.match(reference, /valid derivations/iu);
  assert.match(reference, /important alternative explanations/iu);
  assert.match(reference, /core implementation without prior positive evidence/iu);
  assert.match(reference, /Preserve reliable negative findings and counterexamples/iu);
  assert.match(reference, /not a fixed sequence/iu);
});

test("research entrances retain one spine and whole-route expansion judgment", () => {
  const rule = generatedClaudeAmbientProjectEntries().find(({ destinationPath }) => destinationPath === ".claude/rules/dove.md").content;
  const research = generatedAdapterEntries().filter(({ command }) => command.id === "dove.research");
  const claude = research.find(({ hostId }) => hostId === "claude").content;
  const dsh = research.find(({ hostId }) => hostId === "dsh").content;
  for (const context of [rule, `${rule}\n${claude}`, `${rule}\n${renderClaudeDoveAgent()}\n${claude}`, dsh, renderDoveResearchQualityReference()]) {
    assert.match(context, /problem → method → contribution/u);
    assert.match(context, /total path/iu);
    assert.match(context, /Controls, baselines, diagnostics/iu);
    assert.match(context, /Before major expansion/iu);
    assert.match(context, /shared mistaken premise/iu);
    assert.match(context, /change the method, priorities, or dependent investment/iu);
  }
});

test("prompt re-anchor is a short research reminder with bounded judgment", () => {
  const reminder = renderDoveResearchReanchor();
  // This is injected each prompt, not another full standing contract.
  assert.ok(reminder.length < 900);
  assert.match(reminder, /problem → method → contribution/u);
  assert.match(reminder, /total path/iu);
  assert.match(reminder, /current user decisions/iu);
  assert.match(reminder, /fixed constraints/iu);
  assert.match(reminder, /inspected evidence/iu);
  assert.match(reminder, /completion meaning/iu);
  assert.match(reminder, /stale tasks or notes/iu);
  assert.match(reminder, /which core gap/iu);
  assert.match(reminder, /simpler route/iu);
  assert.match(reminder, /ends the investment/iu);
  assert.match(reminder, /do not make the dependent expansion/iu);
  assert.match(reminder, /actual route reassessment/iu);
  assert.match(reminder, /affected assumptions, tasks, and delegated context/iu);
  assert.match(reminder, /untested core/iu);
  assert.match(reminder, /negative findings/iu);
  assert.match(reminder, /bounded requests/iu);
  assert.match(reminder, /user's decision/iu);
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
