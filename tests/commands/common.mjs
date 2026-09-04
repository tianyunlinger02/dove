import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const EXPECTED_HOST_IDS = ["claude", "dsh"];
export const EXPECTED_SKILL_IDS = ["dove.research", "dove.status", "dove.source", "dove.experiment", "dove.draft", "dove.figure", "dove.review", "dove.rebuttal", "dove.lessons"];
export const SEMANTIC_SECTION_FIELDS = Object.freeze(["responsibilities", "actions", "boundaries", "nonGoals"]);

export function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must not contain duplicates`);
}

export function text(value) {
  return JSON.stringify(value);
}

export function skillContract(command) {
  const contract = command.contract;
  assert.equal(typeof contract?.purpose, "string", `${command.id} needs a purpose`);
  assert.equal(typeof contract?.when, "string", `${command.id} needs use guidance`);
  for (const field of ["responsibilities", "actions", "boundaries", "nonGoals", "clarification"]) {
    assert.ok(Array.isArray(contract[field]), `${command.id} contract.${field} must be an array`);
  }
  assert.equal(typeof contract.hostGuidance, "object", `${command.id} needs conditional host guidance`);
  return contract;
}

export function contractText(command) {
  return text(skillContract(command));
}

export function contractAction(command, capability) {
  return skillContract(command).actions.find((item) => item.capability === capability);
}

export function contractActions(command) {
  return skillContract(command).actions;
}

export function actionCapabilities(command) {
  return contractActions(command).map((item) => item.capability);
}

export function structuredText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(structuredText).filter(Boolean).join("\n");
  if (typeof value === "object") return Object.values(value).map(structuredText).filter(Boolean).join("\n");
  return String(value);
}

export function semanticSectionText(section) {
  return [section.title, section.purpose, section.description, ...SEMANTIC_SECTION_FIELDS.map((field) => structuredText(section[field]))].filter(Boolean).join("\n");
}

export function semanticContractText(command) {
  const contract = skillContract(command);
  return structuredText([
    contract.purpose,
    contract.when,
    contract.semanticSections ?? [],
    contract.responsibilities,
    contract.actions,
    contract.boundaries,
    contract.nonGoals,
    contract.hostGuidance
  ]);
}

export function assertMatchesAll(value, label, patterns) {
  for (const pattern of patterns) assert.match(value, pattern, `${label} semantic contract drifted: ${pattern}`);
}

export function assertMatchesNone(value, label, patterns) {
  for (const pattern of patterns) assert.doesNotMatch(value, pattern, `${label} must not contain retired or unsafe language: ${pattern}`);
}

export function assertDoveAgentSurfaceSemantics(value, label) {
  assertMatchesAll(value, label, [
    /one complete (?:Dove )?research agent|same research collaboration/iu,
    /nine Skills.*(?:same research collaboration|current decision|optional specialist methods)|optional specialist capabilities/isu,
    /real research question/iu,
    /current or provisional route|provisional research question or route/iu,
    /user need/iu,
    /key uncertainty/iu,
    /decision that matters/iu,
    /literature|current theory|related work/iu,
    /adjacent (?:ideas|fields)|analogies/iu,
    /mathematics|mathematical|physical reasoning|physical analysis/iu,
    /assumptions/iu,
    /applicability/iu,
    /predictions/iu,
    /failure conditions/iu,
    /hunches.*hypotheses|first impressions.*hypotheses/isu,
    /negative results?.*near misses?.*(?:hypotheses|diagnostic|route|validity)|near misses?.*(?:hypotheses|diagnostic|route|validity)/isu,
    /inspected material|retrieved sources|executed work|rendered figures|checked artifacts/iu,
    /user-confirmed Workspace mainline/iu,
    /active confirmed research context.*feasible next in-scope step|short follow-ups.*perform the feasible next in-scope step/isu,
    /Maintain Dove research Markdown.*record, update, or save/iu,
    /preserving the work's evidence and continuation context is genuinely useful/iu,
    /author-side Review.*scientific self-check|author-side Review is Dove's own scientific self-check/isu,
    /independent `dove-review`.*real isolated persistent reviewer context|real isolated persistent reviewer context.*current frozen handoff/isu,
    /findings.*inform.*author-side judgment|findings.*evidence to absorb|not authority over the Workspace mainline/isu
  ]);
}
