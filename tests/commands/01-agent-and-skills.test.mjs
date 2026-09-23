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
  DOVE_RESEARCH_CANDIDATE_COVERAGE,
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

test("Lessons supports bounded ambient use and content-driven first preservation", () => {
  const lessons = COMMAND_SURFACE_BY_ID["dove.lessons"].contract;
  const value = [
    lessons.ambientParticipation,
    lessons.purpose,
    lessons.when,
    ...lessons.responsibilities,
    ...lessons.actions,
    ...lessons.boundaries,
    ...lessons.nonGoals
  ].join("\n");
  assert.match(lessons.ambientParticipation, /consequential choices or after corrections and recurring failures/iu);
  assert.match(lessons.ambientParticipation, /once within the active context/iu);
  assert.match(lessons.ambientParticipation, /without waiting for an explicit command/iu);
  assert.match(value, /content-bearing "\.dove\/research\/lessons\/LESSONS\.md"/iu);
  assert.match(value, /do not bootstrap an empty directory or index during reading/iu);
  assert.match(value, /naturally named linked Markdown file only when separating a theme is genuinely useful/iu);
  assert.match(value, /actual basis, conditions, counterexamples, and limits/iu);
  assert.match(value, /routine progress, transient status, one-off tool failures, non-transferable bugs/iu);
  assert.match(value, /Do not create lesson IDs, frontmatter, an application ledger/iu);
  assert.match(value, /fallible guidance rather than evidence|fallible guidance, never as evidence/iu);

  for (const id of ["dove.research", "dove.source", "dove.experiment", "dove.draft", "dove.figure", "dove.rebuttal"]) {
    assert.match(
      COMMAND_SURFACE_BY_ID[id].contract.boundaries.join("\n"),
      /research Markdown other than Lessons only when/iu,
      `${id}: general maintenance must not swallow the Lessons threshold`
    );
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
    assert.equal(guidance.includes(".dove/research/lessons/LESSONS.md"), false);
    assert.equal(guidance.includes("preserve the narrowest useful researcher-owned Lesson"), false);
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
  for (const concept of [/decisive basis/iu, /affected claim or dependent investment/iu, /next authorized action/iu, /what result would change the judgment/iu]) {
    assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, concept);
  }
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /realizes or tests a still-worthwhile authorized core proposition/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /restores necessary capability or evaluation validity/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /minimum decision-changing evidence/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /completes an agreed bounded deliverable/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /close the round/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /stop dependent investment/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /preserve independent useful authorized work/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /one grounded recommendation with its strongest objection, decisive test/iu);
  assert.match(DOVE_RESEARCH_DECISION_CONSEQUENCE, /stop or pause stoppable dependent work before extending it/iu);
});

test("Experiment permits early diagnostics but rejects incomparable controls and proxy milestones", () => {
  const experiment = COMMAND_SURFACE_BY_ID["dove.experiment"].contract;
  const value = [...experiment.responsibilities, ...experiment.actions].join("\n");
  assert.match(value, /single-case diagnostic with a working input-to-result chain/iu);
  assert.match(value, /before multi-case robustness or paper-level sufficiency/iu);
  assert.match(value, /not.*confirmatory positive/iu);
  assert.match(value, /actual control still has the claimed input, candidate support, budget, execution semantics/iu);
  assert.match(value, /non-equivalent control leaves a diagnostic or comparison failure/iu);
  assert.match(value, /events needed by a scientific downstream consumer/iu);
  assert.match(experiment.boundaries.join("\n"), /Design-only work does not authorize diagnostic or experiment execution/iu);
});

test("Experiment candidate coverage keeps generation, selection, and end-to-end conclusions distinct", () => {
  const experiment = COMMAND_SURFACE_BY_ID["dove.experiment"].contract;
  const value = [experiment.purpose, ...experiment.responsibilities, ...experiment.actions, ...experiment.boundaries, ...experiment.nonGoals].join("\\n");
  assert.equal(value.split(DOVE_RESEARCH_CANDIDATE_COVERAGE).length - 1, 1);
  assert.match(value, /candidate reachability or generation/iu);
  assert.match(value, /selection quality given the same candidate set/iu);
  assert.match(value, /end-to-end target effect/iu);
  assert.match(value, /fixed candidates does not by itself assess candidate generation/iu);
  assert.match(value, /successful intersection cannot stand in for an end-to-end conclusion/iu);
  assert.match(value, /failed, missing, invalid, and excluded cases enter the denominator/iu);
  assert.match(value, /do not silently retain only successful cases/iu);
  assert.match(value, /collapse every failure into the same scientific failure/iu);
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
    assert.match(context, /all affected actions and delegation/iu);
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
  assert.match(reminder, /one authorized action/iu);
  assert.match(reminder, /user's live/iu);
  assert.match(reminder, /fixed constraints/iu);
  assert.match(reminder, /inspected evidence/iu);
  assert.match(reminder, /completion meaning/iu);
  assert.match(reminder, /stale tasks/iu);
  assert.match(reminder, /one authorized action/iu);
  assert.match(reminder, /producer-consumer path/iu);
  assert.match(reminder, /prior positive evidence/iu);
  assert.match(reminder, /refuted premise stops dependent investment/iu);
  assert.match(reminder, /corrections change all affected tasks and delegation/iu);
  assert.match(reminder, /bounded requests bounded/iu);
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
