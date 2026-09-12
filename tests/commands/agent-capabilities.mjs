import assert from "node:assert/strict";

import { COMMAND_SURFACE_BY_ID, COMMAND_SURFACES, PROJECT_HOST_IDS } from "../../src/core/command-manifest.mjs";
import { DOVE_AGENT_SURFACES, generatedDoveAgentEntries, renderClaudeDoveAgent } from "../../src/core/dove-agent-definition.mjs";
import { renderDoveAgentInstructions } from "../../src/core/dove-agent-persona.mjs";
import * as publicCore from "../../src/core/index.mjs";
import { USER_RESPONSE_POLICY } from "../../src/core/user-response-policy.mjs";
import { generatedAdapterEntries } from "../../scripts/generate-command-adapters.mjs";
import { EXPECTED_HOST_IDS, EXPECTED_SKILL_IDS, SEMANTIC_SECTION_FIELDS, assertDoveAgentRoleSemantics, assertMatchesAll, assertUnique, contractActions, semanticContractText, skillContract } from "./common.mjs";
import { assertUserResponsePolicy } from "./ambient-docs.mjs";

// These bounded topic checks detect missing capability responsibilities. They do
// not parse prose into scientific grades or certify model behavior. The offline
// behavior corpus supplies task-specific fixtures and human evidence review.
const CAPABILITY_TOPICS = {
  "dove.research": [/provisional/iu, /original proposition/iu, /alternatives/iu, /joint conditions/iu, /user's decision/iu, /Mission/iu],
  "dove.status": [/only inspect and report/iu, /live/iu, /confirmed mainline/iu, /provisional/iu, /authorization/iu, /undetermined/iu],
  "dove.source": [/citation identity/iu, /claim support/iu, /compound claims/iu, /contradicted/iu, /uncovered/iu, /PRISMA/iu, /comparable/iu],
  "dove.experiment": [/design-only/iu, /retrospective/iu, /prospective plan/iu, /negative result/iu, /uncertainty/iu, /joint conditions/iu],
  "dove.draft": [/authoritative source/iu, /build or export/iu, /author samples/iu, /unsupported central claim/iu, /assessment-only/iu],
  "dove.figure": [/real data/iu, /editable/iu, /rendered figure/iu, /caption/iu, /manuscript context/iu, /schematic/iu],
  "dove.review": [/scientific self-check/iu, /delivery readiness/iu, /frozen/iu, /isolated/iu, /returned review/iu, /context inspection/iu, /cited evidence/iu],
  "dove.rebuttal": [/same root cause/iu, /material finding/iu, /original claim/iu, /revised claim/iu, /Source/u, /Experiment/u, /original proposition/iu],
  "dove.lessons": [/researcher-owned/iu, /advisory/iu, /counterexamples/iu, /reuse/iu, /future value/iu]
};

export function assertCapabilityJudgment(value, id, label = id) {
  assert.ok(CAPABILITY_TOPICS[id], `${label}: declared capability coverage`);
  assertMatchesAll(value, label, CAPABILITY_TOPICS[id]);
}

export function assertExperimentScientificEvaluation(value, label) {
  assertMatchesAll(value, label, [
    /evaluation chain/iu, /actual output/iu, /proxy/iu, /denominators/iu,
    /paired comparisons/iu, /sample dependence/iu, /final-test independence/iu,
    /ablations/iu, /information access/iu, /training budget/iu,
    /component's gain/iu, /scientific mechanism/iu, /evaluation redesign/iu,
    /design-only/iu, /authorized/iu, /no-ground-truth/iu, /purely theoretical/iu,
    /original comparison/iu, /task identity/iu
  ]);
}

export function assertDoveAgentPersona() {
  for (const name of ["DOVE_AGENT_DEFINITION", "DOVE_AGENT_NAME", "DOVE_AGENT_CAPSULE_BULLETS", "DOVE_AGENT_PERSONA_BULLETS", "renderDoveAgentPersonaSection", "HOST_ADAPTER_POLICY", "DOVE_RESEARCH_SHARED_CONTRACT", "DOVE_RESEARCH_CAPSULE_BULLETS", "DOVE_RESEARCH_ACTION_LENS_FRAME", "DOVE_RESEARCH_MATURITY"]) {
    assert.equal(Object.hasOwn(publicCore, name), false, `${name}: no retired public export`);
  }
  assert.deepEqual(DOVE_AGENT_SURFACES, { claude: ".claude/agents/dove.md" });
  for (const value of [renderDoveAgentInstructions(), renderClaudeDoveAgent()]) assertDoveAgentRoleSemantics(value, "Dove agent");
  assert.deepEqual(generatedDoveAgentEntries(), [{ relativePath: DOVE_AGENT_SURFACES.claude, content: renderClaudeDoveAgent() }]);
}

export function assertSkillManifest() {
  assert.deepEqual(COMMAND_SURFACES.map(({ id }) => id), EXPECTED_SKILL_IDS);
  assert.deepEqual(Object.keys(COMMAND_SURFACE_BY_ID), EXPECTED_SKILL_IDS);
  assert.deepEqual(PROJECT_HOST_IDS, EXPECTED_HOST_IDS);
  for (const command of COMMAND_SURFACES) {
    assert.equal(COMMAND_SURFACE_BY_ID[command.id], command);
    assert.ok(command.summary.trim());
    const contract = skillContract(command);
    const actions = contractActions(command);
    assert.ok(actions.length > 0);
    assert.ok(contract.returnWith.length > 0);
    assert.ok(contract.boundaries.length > 0);
    for (const action of actions) assert.ok(typeof action === "string" && action.trim());
    for (const hostId of ["common", ...PROJECT_HOST_IDS]) assert.ok(Array.isArray(contract.hostGuidance[hostId]));
    if (contract.semanticSections) {
      assertUnique(contract.semanticSections.map(({ title }) => title), `${command.id} section titles`);
      for (const section of contract.semanticSections) {
        assert.ok(section.title.trim());
        assert.ok(SEMANTIC_SECTION_FIELDS.some((field) => section[field]?.length));
      }
    }
    for (const field of ["workflow", "modes", "steps", "requiredTools", "guidance"]) assert.equal(Object.hasOwn(command, field), false);
    assertCapabilityJudgment(semanticContractText(command), command.id);
  }
  assertExperimentScientificEvaluation(semanticContractText(COMMAND_SURFACE_BY_ID["dove.experiment"]), "Experiment");
}

export function assertHostPolicy() {
  for (const entry of generatedAdapterEntries()) {
    const contract = skillContract(entry.command);
    for (const instruction of [...contract.hostGuidance.common, ...contract.hostGuidance[entry.hostId]]) {
      assert.ok(entry.content.includes(instruction), `${entry.relativePath}: host guidance projection`);
    }
  }
  assertUserResponsePolicy(USER_RESPONSE_POLICY.join("\n"), "Canonical response policy");
}
