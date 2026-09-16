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
  packageResourcePath,
  renderDoveAmbientParticipationSection
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
  DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP,
  DOVE_AUTHOR_PREFERENCES_READ_TRIGGER,
  DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS,
  renderDoveAuthorPreferencesReference
} from "../../src/core/dove-author-preferences.mjs";
import { checkGeneratedAuthorPreferencesContent } from "../../scripts/generate-author-preferences.mjs";
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
  generatedAuthorPreferencesReferenceEntries,
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

function assertCoreActionGuidance(value, label) {
  assert.match(value, /unfinished core capabilities or evidence/iu, label);
  assert.match(value, /Being related to the goal is not enough/iu, label);
  assert.match(value, /Scientific core means/iu, label);
  assert.match(value, /engineering core means[^.\n]*producer-consumer behavior/iu, label);
  assert.match(value, /neither refuses nor expands/iu, label);
  assert.match(value, /scientific contract is clear enough[^.\n]*implement the necessary core path/iu, label);
  assert.match(value, /no fixed round count or per-step progress quota/iu, label);
  assert.match(value, /Contract tests establish implementation behavior/iu, label);
  assert.match(value, /claim-matched controls and evaluation establish only the scientific claim/iu, label);
  assert.match(value, /Credible positive signals are preliminary support/iu, label);
  assert.match(value, /core implementation need not wait for positive evidence/iu, label);
  assert.match(value, /never select samples, change criteria, or hide counterevidence/iu, label);
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
  const participation = renderDoveAmbientParticipationSection();
  assert.ok(rule.includes(renderDoveSharedResearchContractSection()));
  assert.ok(rule.includes(renderDoveAuthorStanceSection()));
  assert.equal(rule.split("## Capability participation").length - 1, 1, "ordinary Claude has one capability projection");
  assert.equal(rule.split(participation).length - 1, 1, "ordinary Claude uses the canonical capability projection");
  assert.equal(participation.split("\n").filter((line) => line.startsWith("- Dove ")).length, COMMAND_SURFACES.length);
  assert.match(participation, /commands are shortcuts, not prerequisites/iu);
  assert.match(participation, /never expands authorization/iu);
  for (const command of COMMAND_SURFACES) {
    assert.equal(rule.split(command.contract.ambientParticipation).length - 1, 1, `${command.id}: one ambient participation sentence`);
  }
  const statusParticipation = COMMAND_SURFACES.find(({ id }) => id === "dove.status").contract.ambientParticipation;
  const lessonsParticipation = COMMAND_SURFACES.find(({ id }) => id === "dove.lessons").contract.ambientParticipation;
  assert.match(statusParticipation, /explicitly asked/iu);
  assert.match(statusParticipation, /read-only/iu);
  assert.match(lessonsParticipation, /consequential choices or after corrections and recurring failures/iu);
  assert.match(lessonsParticipation, /once within the active context/iu);
  assert.match(lessonsParticipation, /without waiting for an explicit command/iu);
  assert.equal(rule.split("`.dove/research/lessons/LESSONS.md`").length - 1, 1, "ordinary Claude owns one bounded Lessons index trigger");
  assert.match(rule, /research Markdown other than Lessons only when/iu);
  assert.match(rule, /explicit `\/dove:lessons` invocation is not required/iu);
  assert.match(rule, /without requiring `--agent dove` or a Skill/iu);
  assert.match(renderClaudeDoveAgent(), /no higher judgment authority/iu);
  assertCoreActionGuidance(rule, "ordinary Claude rule");
  assert.equal(renderDoveAuthorStanceSection().split(DOVE_AUTHOR_PREFERENCES_READ_TRIGGER).length - 1, 1, "author stance owns the preference read trigger");
  assert.equal(renderDoveAuthorStanceSection().split(DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP).length - 1, 1, "author stance requires one main-agent bootstrap");
  assert.match(rule, /current host main agent must personally read/iu);
  assert.match(rule, /offsets until EOF/iu);
  assert.match(rule, /Do not delegate this bootstrap read/iu);
  assert.equal(renderDoveSharedResearchContractSection().includes(DOVE_AUTHOR_PREFERENCES_READ_TRIGGER), false, "shared judgment does not carry author-only guidance");
  assert.equal(renderDoveAgentInstructions().includes(DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP), false, "bounded agent definition must not own the bootstrap");

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
    assert.equal(entry.content.includes("## Capability participation"), false, `${label}: no duplicated ambient section`);
    if (entry.hostId === "claude") {
      for (const command of COMMAND_SURFACES) {
        assert.equal(entry.content.includes(command.contract.ambientParticipation), false, `${label}: ambient participation stays in the ordinary rule`);
      }
    } else {
      assert.ok(entry.content.includes(renderDoveSharedResearchContractSection()), `${label}: standalone shared contract`);
      assert.match(entry.content, /## How Dove approaches this work/u, `${label}: full capability contract`);
      assert.match(entry.content, /### Return with/u, `${label}: capability return contract`);
    }
    const standaloneAuthor = entry.hostId === "dsh" && entry.command.id !== "dove.status";
    assert.equal(entry.content.includes(renderDoveAuthorStanceSection()), standaloneAuthor, `${label}: author stance projection`);
    assert.equal(entry.content.includes(DOVE_AUTHOR_PREFERENCES_READ_TRIGGER), standaloneAuthor, `${label}: author-only preference entry`);
    assert.equal(entry.content.includes(DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP), standaloneAuthor, `${label}: main-agent bootstrap follows author stance`);
    assert.equal(entry.content.includes(renderDoveAuthorPreferencesReference()), false, `${label}: full preferences stay in the installed reference`);
    for (const prefix of prefixes) {
      const value = `${prefix}\n\n${entry.content}`;
      assertSharedContractOnce(value, label);
      if (["dove.research", "dove.experiment"].includes(entry.command.id)) assertCoreActionGuidance(value, label);
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
      const authorOwners = entry.hostId === "dsh" && entry.command.id === "dove.status" ? 0 : 1;
      assert.equal(value.split(renderDoveAuthorStanceSection()).length - 1, authorOwners, `${label}: one applicable author owner`);
      assert.equal(value.split(DOVE_AUTHOR_PREFERENCES_READ_TRIGGER).length - 1, authorOwners, `${label}: preference trigger follows author stance`);
      assert.equal(value.split(DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS[entry.hostId]).length - 1, authorOwners, `${label}: preference path follows author stance`);
      if (authorOwners === 0) {
        assert.equal(value.includes("## Author stance"), false);
        assert.match(value, /only to inspect and report/iu);
      }
    }
  }
}

export function assertRenderedCapabilityWiring(entry) {
  const value = entry.content.slice(entry.content.indexOf("## How Dove approaches this work"));
  const label = `${entry.hostId} ${entry.command.id}`;
  if (entry.command.id === "dove.research") {
    assert.match(value, /input-output capability is an engineering boundary/iu, label);
    assert.match(value, /available data[^.\n]*provisional candidates rather than definitions of the goal or default method/iu, label);
    assert.match(value, /simpler existing solution or no remaining research contribution/iu, label);
    assert.match(value, /targeted near-neighbor subtraction/iu, label);
    assert.match(value, /exhaustive search[^.\n]*prerequisite/iu, label);
    assert.match(value, /local effect supports only the local claim/iu, label);
    assert.match(value, /Judge continuation prospectively/iu, label);
    assert.match(value, /past work matters only through/iu, label);
  }
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
  if (entry.command.id === "dove.status") {
    assert.match(value, /do not modify files/iu, label);
    assert.doesNotMatch(value, /preserve the narrowest useful researcher-owned Lesson/iu, label);
  }
  if (entry.command.id === "dove.lessons") {
    assert.match(value, /content-bearing "\.dove\/research\/lessons\/LESSONS\.md"/iu, label);
    assert.match(value, /do not bootstrap an empty directory or index during reading/iu, label);
    assert.match(value, /one-off tool failures, non-transferable bugs/iu, label);
  }
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
  const establishedSupportPaths = {
    claude: [
      ".claude/rules/dove.md",
      ".dove/install/RESEARCH_QUALITY.md",
      ".dove/install/AUTHOR_PREFERENCES.md",
      ".claude/skills/dove-paper-search/SKILL.md",
      ".claude/skills/dove-web-reader/SKILL.md",
      ".claude/settings.json"
    ],
    dsh: [
      ".dove/install/RESEARCH_QUALITY.md",
      ".dove/install/AUTHOR_PREFERENCES.md"
    ]
  };
  for (const hostId of PROJECT_HOST_IDS) {
    const hostEntries = entries.filter((entry) => entry.hostId === hostId);
    assert.deepEqual(
      hostEntries.map((entry) => entry.command.id),
      COMMAND_SURFACES.map(({ id }) => id),
      `${hostId}: exactly the nine canonical capability adapters`
    );
    const expectedManaged = [...hostEntries.map(({ destinationPath }) => destinationPath), ...establishedSupportPaths[hostId]];
    assert.deepEqual(HOST_ADAPTERS[hostId].paths, expectedManaged, `${hostId}: no hidden Skill or managed path`);
    assert.deepEqual(HOST_ADAPTERS[hostId].requiredPaths, expectedManaged, `${hostId}: required managed path inventory`);
  }

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

export function assertAuthorPreferencesResources() {
  const source = fs.readFileSync(path.join(ROOT, "docs/AUTHOR_PREFERENCES.md"), "utf8");
  assert.deepEqual(checkGeneratedAuthorPreferencesContent(ROOT), []);
  assert.equal(renderDoveAuthorPreferencesReference(), source);
  const entries = generatedAuthorPreferencesReferenceEntries();
  assert.deepEqual(entries.map(({ hostId }) => hostId), PROJECT_HOST_IDS);
  for (const entry of entries) {
    assert.equal(entry.destinationPath, ".dove/install/AUTHOR_PREFERENCES.md");
    assert.equal(entry.destinationPath, DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS[entry.hostId]);
    assert.equal(entry.relativePath, packageResourcePath(entry.hostId, entry.destinationPath));
    assert.ok(PACKAGE_GENERATED_SUPPORT_PATHS.includes(entry.relativePath));
    assert.ok(HOST_ADAPTERS[entry.hostId].requiredPaths.includes(entry.destinationPath));
    assert.equal(entry.content, source);
    assert.equal(fs.readFileSync(path.join(ROOT, entry.relativePath), "utf8"), source);
  }
  for (const hosts of [["claude"], ["dsh"], PROJECT_HOST_IDS]) {
    const references = resourcesForHosts(hosts).filter(({ path }) => path.startsWith(".dove/"));
    assert.deepEqual(references.map(({ path }) => path), [".dove/install/AUTHOR_PREFERENCES.md", ".dove/install/RESEARCH_QUALITY.md"]);
    assert.ok(references.every(({ kind, selector }) => kind === "exclusive-file" && selector === null));
    assert.equal(references[0].content, source);
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
    assert.deepEqual(references.map(({ path }) => path), [".dove/install/AUTHOR_PREFERENCES.md", ".dove/install/RESEARCH_QUALITY.md"]);
    const quality = references.find(({ path }) => path === entry.destinationPath);
    assert.equal(quality.kind, "exclusive-file");
    assert.equal(quality.content, entry.content);
  }
  assert.equal(
    resourcesForHosts(PROJECT_HOST_IDS).filter(({ path: resourcePath }) => resourcePath === ".dove/install/RESEARCH_QUALITY.md").length,
    1
  );
}
