import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMMAND_SURFACES,
  HOST_ADAPTERS,
  PACKAGE_GENERATED_SUPPORT_PATHS,
  PROJECT_HOST_IDS,
  adapterPathForCommand,
  packageResourcePath
} from "../../src/core/command-manifest.mjs";
import { generatedDoveAgentEntries, renderClaudeDoveAgent } from "../../src/core/dove-agent-definition.mjs";
import {
  renderDoveAgentInstructions,
  renderDoveAuthorStanceSection,
  renderDoveSharedResearchContractSection
} from "../../src/core/dove-agent-persona.mjs";
import {
  DOVE_RESEARCH_QUALITY_CRITERIA,
  DOVE_RESEARCH_QUALITY_REFERENCE_PATHS,
  DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS,
  DOVE_RESEARCH_SHARED_CONTRACT_BULLETS,
  renderDoveResearchQualityReference
} from "../../src/core/dove-research-contract.mjs";
import { resourcesForHosts } from "../../src/core/project-installation-resources.mjs";
import {
  PAPER_SEARCH_MCP_FRAGMENT,
  PAPER_SEARCH_PACKAGE_SPECIFIER,
  PAPER_SEARCH_SUPPORT_SKILL_PATH,
  renderPaperSearchSupportSkill
} from "../../src/core/paper-search-integration.mjs";
import {
  EXA_MCP_FRAGMENT,
  EXA_WEB_SUPPORT_SKILL_PATH,
  WEB_FETCH_DENY_PERMISSION
} from "../../src/core/web-access-integration.mjs";
import { USER_RESPONSE_POLICY } from "../../src/core/user-response-policy.mjs";
import {
  generatedAdapterEntries,
  generatedClaudeAmbientProjectEntries,
  generatedResearchQualityReferenceEntries,
  renderCommandAdapter
} from "../../scripts/generate-command-adapters.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function contractActions(command) {
  return command.contract.semanticSections
    ? command.contract.semanticSections.flatMap((section) => section.actions ?? [])
    : command.contract.actions;
}

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, label);
}

function assertGeneratedFileMatches(relativePath, content) {
  assert.equal(
    fs.readFileSync(path.join(ROOT, relativePath), "utf8"),
    `${content.trimEnd()}\n`,
    `${relativePath}: canonical projection`
  );
}

function assertSharedContractOnce(value, label) {
  for (const instruction of DOVE_RESEARCH_SHARED_CONTRACT_BULLETS) {
    assert.equal(value.split(instruction).length - 1, 1, `${label}: one shared instruction owner`);
  }
}

function assertAgentProjection(value, label) {
  assert.ok(value.includes(renderDoveAgentInstructions()), `${label}: canonical agent instructions`);
  assert.equal(value.includes("## Shared researcher judgment"), false);
  assert.equal(value.includes("## Author stance"), false);
}

function assertHostGuidanceProjection(entry) {
  const guidance = entry.command.contract.hostGuidance;
  for (const instruction of [...(guidance.common ?? []), ...(guidance[entry.hostId] ?? [])]) {
    assert.ok(entry.content.includes(instruction), `${entry.relativePath}: host guidance projection`);
  }
}

export function assertFinalEntrypointWiring() {
  const ambient = generatedClaudeAmbientProjectEntries();
  assert.deepEqual(ambient.map(({ destinationPath }) => destinationPath), [
    ".claude/rules/dove.md",
    PAPER_SEARCH_SUPPORT_SKILL_PATH,
    EXA_WEB_SUPPORT_SKILL_PATH
  ]);
  const byPath = new Map(ambient.map(({ destinationPath, content }) => [destinationPath, content]));
  const rule = byPath.get(".claude/rules/dove.md");
  assert.ok(rule.includes(renderDoveSharedResearchContractSection()));
  assert.ok(rule.includes(renderDoveAuthorStanceSection()));
  assert.match(rule, /tests serve them rather than generate requirements/iu);

  for (const resourcePath of [PAPER_SEARCH_SUPPORT_SKILL_PATH, EXA_WEB_SUPPORT_SKILL_PATH]) {
    const support = byPath.get(resourcePath);
    assert.match(support, /user-invocable: false/u);
    assert.match(support, /permissions permit/iu);
  }
  assert.deepEqual(PAPER_SEARCH_MCP_FRAGMENT, {
    type: "stdio",
    command: "uvx",
    args: ["--from", PAPER_SEARCH_PACKAGE_SPECIFIER, "paper-search-mcp"]
  });
  assert.deepEqual(EXA_MCP_FRAGMENT, { url: "https://mcp.exa.ai/mcp", type: "http" });
  assert.equal(WEB_FETCH_DENY_PERMISSION, "WebFetch");

  for (const entry of generatedAdapterEntries()) {
    const label = `${entry.hostId} ${entry.command.id}`;
    const prefixes = entry.hostId === "claude" ? [rule, `${rule}\n\n${renderClaudeDoveAgent()}`] : [""];
    assertHostGuidanceProjection(entry);
    for (const prefix of prefixes) {
      const value = `${prefix}\n\n${entry.content}`;
      assertSharedContractOnce(value, label);
      assert.doesNotMatch(value, /Workspace mainline/u);
      if (["dove.research", "dove.status"].includes(entry.command.id)) assert.match(value, /Mainline: <text>/u);
      for (const instruction of USER_RESPONSE_POLICY) {
        assert.equal(value.split(instruction).length - 1, 1, `${label}: one response-policy owner`);
        assert.equal(entry.content.includes(instruction), entry.hostId === "dsh");
      }
      assert.equal(value.split(DOVE_RESEARCH_QUALITY_REFERENCE_PATHS[entry.hostId]).length - 1, 1);
      for (const criterion of DOVE_RESEARCH_QUALITY_CRITERIA) {
        assert.equal(value.includes(criterion), false, `${label}: detailed criteria stay on demand`);
      }
      if (entry.hostId === "dsh" && entry.command.id === "dove.status") {
        assert.equal(value.includes("## Author stance"), false);
        assert.match(value, /only to inspect and report/iu);
      } else {
        assert.ok(value.includes(renderDoveAuthorStanceSection()), `${label}: canonical author stance`);
      }
    }
  }
}

export function assertRenderedCapabilityWiring(entry) {
  const value = entry.content.slice(entry.content.indexOf("## How Dove approaches this work"));
  const label = `${entry.hostId} ${entry.command.id}`;
  if (entry.command.id === "dove.source") {
    assert.match(value, /Partial support is not support for the whole sentence/u, label);
    assert.match(value, /supported, contradicted, or uncovered/iu, label);
  }
  if (entry.command.id === "dove.experiment") {
    assert.match(value, /Apply reference, pairing, and data-split reasoning only where it fits the study/u, label);
    assert.match(value, /do not impose ground truth, paired designs, or train\/test splits/u, label);
    const actions = contractActions(entry.command);
    const plan = actions.findIndex((action) => /save the prospective plan/iu.test(action));
    const execution = actions.findIndex((action) => /Execute only when/iu.test(action));
    assert.ok(plan >= 0 && execution > plan, `${label}: prospective persistence before execution`);
  }
  if (entry.command.id === "dove.review") {
    assert.ok(value.includes(DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS), `${label}: canonical review questions`);
    assert.match(value, /only those listed materials/iu, label);
  }
  if (entry.command.id === "dove.figure") assert.match(value, /rerender and inspect/iu, label);
  if (entry.command.id === "dove.status") assert.match(value, /do not modify files/iu, label);
}

export function assertSourceIdentityGuidanceProjection() {
  const source = COMMAND_SURFACES.find(({ id }) => id === "dove.source");
  const sourceWork = contractActions(source).find((action) => /direct DOI lookup/iu.test(action));
  assert.ok(sourceWork);
  for (const entry of generatedAdapterEntries().filter(({ command }) => command.id === source.id)) {
    assertGeneratedFileMatches(entry.relativePath, entry.content);
    assert.ok(entry.content.includes(sourceWork));
  }
  const support = generatedClaudeAmbientProjectEntries().find(
    ({ destinationPath }) => destinationPath === PAPER_SEARCH_SUPPORT_SKILL_PATH
  );
  assert.equal(support.content, renderPaperSearchSupportSkill());
  assertGeneratedFileMatches(packageResourcePath("claude", support.destinationPath), support.content);
  assert.match(support.content, /get_crossref_paper_by_doi/u);
}

export function assertGeneratedAdapters() {
  const entries = generatedAdapterEntries();
  assert.equal(entries.length, COMMAND_SURFACES.length * PROJECT_HOST_IDS.length);
  assertUnique(entries.map(({ relativePath }) => relativePath), "adapter paths are unique");

  for (const entry of generatedDoveAgentEntries()) {
    assertAgentProjection(entry.content, "generated agent");
    assertGeneratedFileMatches(packageResourcePath("claude", entry.relativePath), entry.content);
  }
  for (const entry of entries) {
    assert.equal(entry.destinationPath, adapterPathForCommand(entry.hostId, entry.command));
    assert.equal(entry.content, renderCommandAdapter(entry.hostId, entry.command));
    assertGeneratedFileMatches(entry.relativePath, entry.content);
    let previous = -1;
    for (const action of contractActions(entry.command)) {
      const index = entry.content.indexOf(action);
      assert.ok(index > previous, `${entry.relativePath}: canonical action order`);
      previous = index;
    }
    for (const instruction of entry.command.contract.returnWith) assert.ok(entry.content.includes(instruction));
    assert.ok(entry.content.lastIndexOf("### Return with") > entry.content.indexOf("### Using host tools"));
    assert.equal(entry.content.includes("$ARGUMENTS"), entry.hostId === "claude");
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
  assert.equal(
    resourcesForHosts(PROJECT_HOST_IDS).filter(({ path: resourcePath }) => resourcePath === ".dove/install/RESEARCH_QUALITY.md").length,
    1
  );
}
