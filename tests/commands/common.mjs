import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOVE_RESEARCH_SHARED_CONTRACT_BULLETS } from "../../src/core/dove-research-contract.mjs";
import { renderDoveAgentInstructions } from "../../src/core/dove-agent-persona.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const EXPECTED_HOST_IDS = ["claude", "dsh"];
export const EXPECTED_SKILL_IDS = ["dove.research", "dove.status", "dove.source", "dove.experiment", "dove.draft", "dove.figure", "dove.review", "dove.rebuttal", "dove.lessons"];
export const SEMANTIC_SECTION_FIELDS = Object.freeze(["responsibilities", "actions", "boundaries", "nonGoals"]);

export function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label}: no duplicate entries`);
}

export function skillContract(command) {
  const contract = command.contract;
  assert.equal(typeof contract?.purpose, "string");
  assert.equal(typeof contract?.when, "string");
  for (const field of ["returnWith", "boundaries", "clarification"]) assert.ok(Array.isArray(contract[field]), `${command.id} ${field}`);
  for (const field of ["responsibilities", "actions", "nonGoals"]) {
    if (contract.semanticSections) assert.equal(Object.hasOwn(contract, field), false, `${command.id}: sections own ${field}`);
    else assert.ok(Array.isArray(contract[field]));
  }
  assert.equal(typeof contract.hostGuidance, "object");
  return contract;
}

export function contractActions(command) {
  const contract = skillContract(command);
  return contract.semanticSections ? contract.semanticSections.flatMap((section) => section.actions ?? []) : contract.actions;
}

function structuredText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(structuredText).join("\n");
  if (typeof value === "object") return Object.values(value).map(structuredText).join("\n");
  return String(value);
}

export function semanticContractText(command) {
  return structuredText(skillContract(command));
}

export function assertMatchesAll(value, label, patterns) {
  for (const pattern of patterns) assert.match(value, pattern, `${label}: missing topic ${pattern}`);
}

export function assertSharedResearchContractOnce(value, label) {
  // Equality here protects renderer ownership, not wording against later edits.
  for (const instruction of DOVE_RESEARCH_SHARED_CONTRACT_BULLETS) assert.equal(value.split(instruction).length - 1, 1, `${label}: one shared instruction owner`);
}

export function assertDoveAgentRoleSemantics(value, label) {
  assert.ok(value.includes(renderDoveAgentInstructions()), `${label}: canonical identity and scope projection`);
  assertMatchesAll(value, label, [/project research rule/iu, /main session/iu, /bounded subagent/iu, /assigned question/iu]);
  assert.equal(value.includes("## Shared researcher judgment"), false);
  assert.equal(value.includes("## Author stance"), false);
}
