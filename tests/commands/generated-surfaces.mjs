import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { COMMAND_SURFACES, HOST_ADAPTERS, PACKAGE_GENERATED_SUPPORT_PATHS, PROJECT_HOST_IDS, adapterPathForCommand, packageResourcePath } from "../../src/core/command-manifest.mjs";
import { generatedDoveAgentEntries, renderClaudeDoveAgent } from "../../src/core/dove-agent-definition.mjs";
import { DOVE_RESEARCH_QUALITY_CRITERIA, DOVE_RESEARCH_QUALITY_REFERENCE_PATHS, renderDoveResearchQualityReference } from "../../src/core/dove-research-contract.mjs";
import { resourcesForHosts } from "../../src/core/project-installation-resources.mjs";
import { PAPER_SEARCH_SUPPORT_SKILL_PATH, renderPaperSearchSupportSkill } from "../../src/core/paper-search-integration.mjs";
import { USER_RESPONSE_POLICY } from "../../src/core/user-response-policy.mjs";
import { generatedAdapterEntries, generatedClaudeAmbientProjectEntries, generatedResearchQualityReferenceEntries, renderCommandAdapter } from "../../scripts/generate-command-adapters.mjs";
import { ROOT, assertDoveAgentRoleSemantics, assertSharedResearchContractOnce, assertUnique, contractActions, skillContract } from "./common.mjs";
import { assertSharedAuthorStance, assertSharedResearchJudgment, assertUserResponsePolicy } from "./ambient-docs.mjs";
import { assertCapabilityJudgment, assertExperimentScientificEvaluation } from "./agent-capabilities.mjs";

function assertGeneratedFileMatches(relativePath, content) {
  assert.equal(fs.readFileSync(path.join(ROOT, relativePath), "utf8"), `${content.trimEnd()}\n`, `${relativePath}: canonical projection`);
}

export function assertFinalEntrypointWiring() {
  const rule = generatedClaudeAmbientProjectEntries().find(({ destinationPath }) => destinationPath === ".claude/rules/dove.md")?.content;
  assert.ok(rule);
  for (const entry of generatedAdapterEntries()) {
    const prefixes = entry.hostId === "claude" ? [rule, `${rule}\n\n${renderClaudeDoveAgent()}`] : [""];
    for (const prefix of prefixes) {
      const value = `${prefix}\n\n${entry.content}`;
      const label = `${entry.hostId} ${entry.command.id}`;
      assertRenderedCapabilityWiring(entry);
      assertSharedResearchJudgment(value, label);
      assertSharedResearchContractOnce(value, label);
      assertUserResponsePolicy(value, label);
      for (const instruction of USER_RESPONSE_POLICY) {
        assert.equal(value.split(instruction).length - 1, 1, `${label}: one communication policy owner`);
        assert.equal(entry.content.includes(instruction), entry.hostId === "dsh");
      }
      assert.equal(value.split(DOVE_RESEARCH_QUALITY_REFERENCE_PATHS[entry.hostId]).length - 1, 1);
      for (const criterion of DOVE_RESEARCH_QUALITY_CRITERIA) assert.ok(!value.includes(criterion), `${label}: full criteria stay on demand`);
      if (entry.hostId === "dsh" && entry.command.id === "dove.status") {
        assert.equal(value.includes("## Author stance"), false);
        assert.match(value, /only to inspect and report/iu);
      } else assertSharedAuthorStance(value, label);
    }
  }
}

// Preserve consequential workflow order, not sentence order or punctuation.
// Locate the canonical actions by their task purpose; their projection is tested
// independently below. Actual plan persistence and raster evidence have fixtures
// in behavior:validate rather than word-deletion mutation probes.
export function assertRenderedCapabilityWiring(entry) {
  const value = entry.content.slice(entry.content.indexOf("## How Dove approaches this work"));
  const label = `${entry.hostId} ${entry.command.id}`;
  assertCapabilityJudgment(value, entry.command.id, label);
  if (entry.command.id === "dove.experiment") {
    assertExperimentScientificEvaluation(value, label);
    const actions = contractActions(entry.command);
    const plan = actions.findIndex((action) => /save the prospective plan/iu.test(action));
    const execution = actions.findIndex((action) => /Execute only when/iu.test(action));
    assert.ok(plan >= 0 && execution > plan, `${label}: prospective persistence before execution`);
    assert.match(actions[plan], /before execution/iu);
    assert.match(actions[execution], /successfully saved/iu);
    assert.match(actions[execution], /append/iu);
    assert.match(actions[execution], /same Experiment document/iu);
  }
  if (entry.command.id === "dove.source") {
    assert.match(value, /partial support/iu);
    assert.match(value, /without automatically editing/iu);
  }
  if (entry.command.id === "dove.figure") {
    assert.match(value, /rerender and inspect/iu);
    assert.match(value, /planning-only or assessment-only/iu);
  }
  if (entry.command.id === "dove.review") {
    for (const topic of [/same review id/iu, /only those listed materials/iu, /current independent/iu, /same full version/iu, /unmet, not waived/iu]) assert.match(value, topic);
  }
  if (entry.command.id === "dove.status") assert.match(value, /do not modify files/iu);
}

export function assertSourceIdentityGuidanceProjection() {
  const source = COMMAND_SURFACES.find(({ id }) => id === "dove.source");
  const sourceWork = contractActions(source).find((action) => /direct DOI lookup/iu.test(action));
  assert.ok(sourceWork);
  for (const topic of [/unknown/iu, /metadata identity/iu, /full-text inspection/iu, /claim support/iu]) assert.match(sourceWork, topic);
  for (const entry of generatedAdapterEntries().filter(({ command }) => command.id === source.id)) {
    assertGeneratedFileMatches(entry.relativePath, entry.content);
    assert.ok(entry.content.includes(sourceWork));
  }
  const support = generatedClaudeAmbientProjectEntries().find(({ destinationPath }) => destinationPath === PAPER_SEARCH_SUPPORT_SKILL_PATH);
  assert.equal(support.content, renderPaperSearchSupportSkill());
  assertGeneratedFileMatches(packageResourcePath("claude", support.destinationPath), support.content);
  for (const topic of [/get_crossref_paper_by_doi/u, /verified, conflict, not-found, or unknown/iu, /bounded bibliography DOI identity check/iu, /actual paper content/iu]) assert.match(support.content, topic);
}

export function assertGeneratedAdapters() {
  const entries = generatedAdapterEntries();
  assert.equal(entries.length, COMMAND_SURFACES.length * PROJECT_HOST_IDS.length);
  assertUnique(entries.map(({ relativePath }) => relativePath), "Adapter paths");
  for (const entry of generatedDoveAgentEntries()) {
    assertDoveAgentRoleSemantics(entry.content, "Generated agent");
    assertGeneratedFileMatches(packageResourcePath("claude", entry.relativePath), entry.content);
  }
  for (const entry of entries) {
    assert.equal(entry.destinationPath, adapterPathForCommand(entry.hostId, entry.command));
    assert.equal(entry.content, renderCommandAdapter(entry.hostId, entry.command));
    assertGeneratedFileMatches(entry.relativePath, entry.content);
    const contract = skillContract(entry.command);
    let previous = -1;
    for (const action of contractActions(entry.command)) {
      const index = entry.content.indexOf(action);
      assert.ok(index > previous, `${entry.relativePath}: canonical action order`);
      previous = index;
    }
    for (const instruction of contract.returnWith) assert.ok(entry.content.includes(instruction));
    assert.ok(entry.content.lastIndexOf("### Return with") > entry.content.indexOf("### Using host tools"));
    if (entry.hostId === "claude") assert.equal(entry.content.split("$ARGUMENTS").length - 1, 1);
    else assert.equal(entry.content.includes("$ARGUMENTS"), false);
    assertRenderedCapabilityWiring(entry);
  }
}

export function assertQualityReferenceResources() {
  const entries = generatedResearchQualityReferenceEntries();
  assert.deepEqual(entries.map(({ hostId }) => hostId), PROJECT_HOST_IDS);
  for (const entry of entries) {
    assert.equal(entry.destinationPath, DOVE_RESEARCH_QUALITY_REFERENCE_PATHS[entry.hostId]);
    assert.equal(entry.relativePath, packageResourcePath(entry.hostId, entry.destinationPath));
    assert.ok(PACKAGE_GENERATED_SUPPORT_PATHS.includes(entry.relativePath));
    assert.ok(HOST_ADAPTERS[entry.hostId].requiredPaths.includes(entry.destinationPath));
    assert.equal(entry.content, renderDoveResearchQualityReference());
    assertGeneratedFileMatches(entry.relativePath, entry.content);
    const references = resourcesForHosts([entry.hostId]).filter(({ path: resourcePath }) => resourcePath.startsWith(".dove/"));
    assert.equal(references.length, 1);
    assert.equal(references[0].path, ".dove/install/RESEARCH_QUALITY.md");
    assert.equal(references[0].kind, "exclusive-file");
    assert.equal(references[0].content, entry.content);
  }
  assert.equal(resourcesForHosts(PROJECT_HOST_IDS).filter(({ path: resourcePath }) => resourcePath === ".dove/install/RESEARCH_QUALITY.md").length, 1);
}
