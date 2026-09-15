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
import { renderDoveAuthorStanceSection, renderDoveReviewerStanceSection, renderDoveSharedResearchContractSection } from "../../src/core/dove-agent-persona.mjs";
import { DOVE_AUTHOR_PREFERENCES_READ_TRIGGER, DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS } from "../../src/core/dove-author-preferences.mjs";
import {
  DOVE_RESEARCH_DECISION_CONSEQUENCE,
  DOVE_RESEARCH_RESULT_ADOPTION,
  DOVE_RESEARCH_SHARED_CONTRACT_BULLETS,
  renderDoveResearchQualityReference,
  renderDoveResearchReanchor
} from "../../src/core/dove-research-contract.mjs";
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
  assert.match(agent, /no higher judgment authority/iu);
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
  assert.match(reference, /input-output capability defines an engineering boundary/iu);
  assert.match(reference, /simpler existing solution suffices|no research contribution remains/iu);
  assert.match(reference, /past effort matters only through/iu);
  assert.match(reference, /Contract correctness establishes implementation/iu);
  assert.match(reference, /discriminating observation establishes only the scientific claim/iu);
});

test("material decision consequences stay in standing and full quality guidance", () => {
  assert.ok(DOVE_RESEARCH_SHARED_CONTRACT_BULLETS.includes(DOVE_RESEARCH_DECISION_CONSEQUENCE));
  for (const value of [renderDoveSharedResearchContractSection(), renderDoveResearchQualityReference()]) {
    assert.equal(value.split(DOVE_RESEARCH_DECISION_CONSEQUENCE).length - 1, 1);
  }
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /dimensions that can change candidate actions/iu);
  for (const concept of [/proposition disposition/iu, /claim strength/iu, /candidate actions/iu, /dependent investment/iu, /task identity/iu, /current-use sufficiency/iu]) {
    assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, concept);
  }
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /necessary dependency/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /use condition/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /realizes or tests a still-worthwhile authorized core proposition/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /restores necessary capability or evaluation validity/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /minimum decision-changing evidence/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /completes an agreed bounded deliverable/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /close the round/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /stop dependent investment/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /preserving independent useful work/iu);
});

test("capabilities and bounded agents reuse one result-adoption contract", () => {
  for (const command of COMMAND_SURFACES) {
    assert.deepEqual(command.contract.returnWith, [DOVE_RESEARCH_RESULT_ADOPTION], command.id);
  }
  for (const [label, value] of [
    ["bounded-agent instructions", renderDoveAgentInstructions()],
    ["author stance", renderDoveAuthorStanceSection()],
    ["Claude agent", renderClaudeDoveAgent()]
  ]) {
    assert.equal(value.split(DOVE_RESEARCH_RESULT_ADOPTION).length - 1, 1, label);
  }
  assert.match(DOVE_RESEARCH_RESULT_ADOPTION, /motivating proposition or decision/iu);
  assert.match(DOVE_RESEARCH_RESULT_ADOPTION, /actual inspected artifact, material, and version/iu);
  assert.match(DOVE_RESEARCH_RESULT_ADOPTION, /decisive evidence and counterevidence/iu);
  assert.match(DOVE_RESEARCH_RESULT_ADOPTION, /unresolved or unverified limits/iu);
  assert.match(DOVE_RESEARCH_RESULT_ADOPTION, /useful work outside current authorization/iu);
  assert.match(DOVE_RESEARCH_RESULT_ADOPTION, /return does not itself authorize/iu);
});

test("research entrances retain one spine and distinguish scientific goals from available implementation", () => {
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
    assert.match(context, /interface[^.\n]*(?:not by itself|do not by themselves)[^.\n]*(?:scientific|question|contribution)/iu);
    assert.match(context, /available (?:data|datasets)[^.\n]*(?:do not define|does not authorize[^.\n]*define) the goal/iu);
    assert.match(context, /targeted (?:same-granularity|near-neighbor) subtraction/iu);
    assert.match(context, /exhaustive (?:search|literature)[^.\n]*prerequisite/iu);
    assert.match(context, /local effects support local claims|supports only the local claim/iu);
    assert.match(context, /past effort matters only through/iu);
    assert.match(context, /scientific contract is clear enough/iu);
    assert.match(context, /producer-consumer (?:path|contract|behavior)/iu);
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
  assert.match(reminder, /stale tasks\/notes/iu);
  assert.match(reminder, /interface/iu);
  assert.match(reminder, /available assets\/supervision/iu);
  assert.match(reminder, /supplied solutions/iu);
  assert.match(reminder, /past effort/iu);
  assert.match(reminder, /do not define the scientific goal/iu);
  assert.match(reminder, /which core gap/iu);
  assert.match(reminder, /simpler route/iu);
  assert.match(reminder, /ends investment/iu);
  assert.match(reminder, /do not expand/iu);
  assert.match(reminder, /actual route reassessment/iu);
  assert.match(reminder, /affected assumptions, tasks, and delegation/iu);
  assert.match(reminder, /scientific contract is clear enough/iu);
  assert.match(reminder, /producer-consumer path/iu);
  assert.match(reminder, /prior positive signal/iu);
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
