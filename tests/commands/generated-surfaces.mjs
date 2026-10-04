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
  DOVE_RESEARCH_MAINLINE_ANCHORING,
  DOVE_RESEARCH_MAINTENANCE_TRIGGER,
  DOVE_RESEARCH_QUALITY_CRITERIA,
  DOVE_RESEARCH_QUALITY_REFERENCE_PATHS,
  DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS,
  DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS,
  DOVE_RESEARCH_SHARED_CONTRACT_BULLETS,
  renderDoveResearchQualityReference,
  renderDoveResearchQualityFullReference
} from "../../src/core/dove-research-contract.mjs";
import { resourcesForHosts } from "../../src/core/project-installation-resources.mjs";
import {
  DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP,
  DOVE_AUTHOR_PREFERENCES_READ_TRIGGER,
  DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS,
  DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATHS,
  renderDoveAuthorPreferencesReference,
  renderDoveAuthorPreferencesFullReference
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
  assert.match(value, /problem → method → contribution/u, label);
  assert.match(value, /confirmed goal, intended contribution, and completion meaning/iu, label);
  assert.match(value, /not the current method, route, or next action/iu, label);
  assert.match(value, /user’s actual goal/iu, label);
  assert.match(value, /every open-goal round/iu, label);
  assert.match(value, /before acting, after results, and before ending/iu, label);
  assert.match(value, /local batch or validation plan does not by itself complete/iu, label);
  assert.match(value, /if requirements remain, do the next core work/iu, label);
  assert.match(value, /current method remains revisable/iu, label);
  assert.match(value, /root cause is known, change the method/iu, label);
  assert.match(value, /actual producer and consumer/iu, label);
  assert.match(value, /fresh read-only Dove context/iu, label);
  assert.match(value, /dove review handoff --scope route --material <trajectory> --json/u, label);
  assert.match(value, /--scope design --material <design>/u, label);
  assert.match(value, /several candidates in one method family without a positive signal/iu, label);
  assert.match(value, /cumulative candidate\/change\/prediction\/result sequence/iu, label);
  assert.match(value, /not just the latest candidate or process conversation/iu, label);
  assert.match(value, /family is still worth pursuing, shared failure causes/iu, label);
  assert.match(value, /Mainline drift/iu, label);
  assert.match(value, /Apply findings to actual work/iu, label);
  assert.match(value, /rework rejected patches/iu, label);
  assert.match(value, /retain rejected approaches in the card/iu, label);
  assert.match(value, /Do not review every candidate/iu, label);
  assert.match(value, /one-page design/iu, label);
  assert.match(value, /public-baseline advantage/iu, label);
  assert.match(value, /data\/model\/training\/evaluation/iu, label);
  assert.match(value, /concrete predicted example/iu, label);
  assert.match(value, /likely-success grounds and biggest risk/iu, label);
  assert.match(value, /Revise unsupported designs and send them back/iu, label);
  assert.match(value, /implement without renewed user approval/iu, label);
  assert.match(value, /confirmed mainline covers its core implementation, reruns, diagnosis, and suitable GPU work/iu, label);
  assert.match(value, /final heldout confirmation needs a frozen/iu, label);
  assert.match(value, /plain-language Quality line/iu, label);
  assert.match(value, /Report what we are making/iu, label);
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
  assert.match(participation, /main session retains judgment before and after delegation/iu);
  for (const command of COMMAND_SURFACES) {
    assert.equal(rule.split(command.contract.ambientParticipation).length - 1, 1, `${command.id}: one ambient participation sentence`);
  }
  const statusParticipation = COMMAND_SURFACES.find(({ id }) => id === "dove.status").contract.ambientParticipation;
  const lessonsParticipation = COMMAND_SURFACES.find(({ id }) => id === "dove.lessons").contract.ambientParticipation;
  assert.match(statusParticipation, /status question from actual project evidence/iu);
  assert.match(statusParticipation, /closing an active open goal/iu);
  assert.match(lessonsParticipation, /after corrections and recurring failures/iu);
  const experimentParticipation = COMMAND_SURFACES.find(({ id }) => id === "dove.experiment").contract.ambientParticipation;
  assert.match(experimentParticipation, /During development, inspect ground truth and rerun quickly/iu);
  assert.match(experimentParticipation, /final confirmation/iu);
  assert.match(rule, /identity card/iu);
  assert.match(rule, /user correction/iu);
  assert.match(renderClaudeDoveAgent(), /no higher judgment authority/iu);
  assertCoreActionGuidance(rule, "ordinary Claude rule");
  assertSharedContractOnce(rule, "ordinary Claude rule alone");
  assert.equal(rule.split(DOVE_RESEARCH_MAINLINE_ANCHORING).length - 1, 1, "ordinary rule alone owns Mainline anchoring once");
  assert.equal(renderDoveAuthorStanceSection().includes(DOVE_RESEARCH_MAINLINE_ANCHORING), false, "Mainline anchoring belongs to shared judgment, not author stance");
  assert.equal(renderClaudeDoveAgent().includes(DOVE_RESEARCH_MAINLINE_ANCHORING), false, "optional agent does not duplicate the ordinary rule's Mainline contract");
  assert.equal(renderDoveAuthorStanceSection().split(DOVE_AUTHOR_PREFERENCES_READ_TRIGGER).length - 1, 1, "author stance owns the preference read trigger");
  assert.equal(renderDoveAuthorStanceSection().split(DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP).length - 1, 1, "author stance requires one main-agent bootstrap");
  assert.match(rule, /current host main agent must personally read/iu);
  assert.match(rule, /personally read only the two short summaries/iu);
  assert.doesNotMatch(rule, /offsets until EOF|completely from beginning to end/iu);
  assert.match(rule, /Full references are on demand/iu);
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
    args: ["--from", PAPER_SEARCH_PACKAGE_SPECIFIER, "--with", "mcp<2", "paper-search-mcp"]
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
    assert.equal(entry.content.includes(renderDoveAuthorPreferencesReference()), false, `${label}: the brief is read, not copied into each adapter`);
    assert.equal(entry.content.includes(renderDoveAuthorPreferencesFullReference()), false, `${label}: full preferences stay on demand`);
    for (const prefix of prefixes) {
      const value = `${prefix}\n\n${entry.content}`;
      assertSharedContractOnce(value, label);
      if (["dove.research", "dove.experiment"].includes(entry.command.id)) {
        assertCoreActionGuidance(value, label);
        assert.match(value, /ground truth/iu, label);
        assert.match(value, /final heldout/iu, label);
      }
      assert.doesNotMatch(value, /Workspace mainline/u);
      if (["dove.research", "dove.status"].includes(entry.command.id)) assert.match(value, /identity card/iu);
      for (const instruction of USER_RESPONSE_POLICY) {
        assert.equal(value.split(instruction).length - 1, 1, `${label}: one response-policy owner`);
        assert.equal(entry.content.includes(instruction), entry.hostId === "dsh");
      }
      assert.equal(value.split(DOVE_RESEARCH_QUALITY_REFERENCE_PATHS[entry.hostId]).length - 1, 1, `${label}: one short quality reference`);
      assert.equal(value.split(DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS[entry.hostId]).length - 1, 1, `${label}: full quality details stay on demand`);
      for (const criterion of DOVE_RESEARCH_QUALITY_CRITERIA) {
        assert.equal(value.includes(criterion), false, `${label}: detailed criteria stay on demand`);
      }
      const authorOwners = entry.hostId === "dsh" && entry.command.id === "dove.status" ? 0 : 1;
      assert.equal(value.split(renderDoveAuthorStanceSection()).length - 1, authorOwners, `${label}: one applicable author owner`);
      assert.equal(value.split(DOVE_AUTHOR_PREFERENCES_READ_TRIGGER).length - 1, authorOwners, `${label}: preference trigger follows author stance`);
      assert.equal(value.split(DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS[entry.hostId]).length - 1, authorOwners, `${label}: preference path follows author stance`);
      if (authorOwners === 0) {
        const statusGuidance = entry.content.slice(0, entry.content.indexOf("## How Dove approaches this work"));
        assert.equal(value.includes("## Author stance"), false);
        assert.match(statusGuidance, /only to inspect and report/iu, label);
        assert.match(statusGuidance, /except to retain the user's material correction in affected identity-card fields/iu, label);
        assert.match(statusGuidance, /Do not execute research actions or otherwise maintain documents/iu, label);
        assert.match(statusGuidance, /do not rewrite an unchanged Mainline/iu, label);
        assert.match(statusGuidance, /Respect explicit no-write instructions and host refusal/iu, label);
      }
    }
  }
}

export function assertRenderedCapabilityWiring(entry) {
  const value = entry.content.slice(entry.content.indexOf("## How Dove approaches this work"));
  const label = `${entry.hostId} ${entry.command.id}`;
  if (["dove.research", "dove.source", "dove.experiment", "dove.draft", "dove.figure", "dove.rebuttal"].includes(entry.command.id)) {
    assert.ok(value.includes(DOVE_RESEARCH_MAINTENANCE_TRIGGER), `${label}: scoped maintenance trigger projection`);
    assert.match(value, /conclusion, route decision, or priority within the confirmed goal/iu, label);
  }
  if (entry.command.id === "dove.research") {
    assert.match(value, /project identity card/iu, label);
    assert.match(value, /correct only affected fields/iu, label);
    assert.match(value, /without replacing an explicitly no-write request/iu, label);
    assert.match(value, /Route and next-action updates do not rewrite the confirmed Mainline/iu, label);
    assert.match(value, /carry out the next core action/iu, label);
    assert.match(value, /root cause calls for a method change/iu, label);
    assert.match(value, /final confirmation/iu, label);
  }
  if (entry.command.id === "dove.source") {
    assert.match(value, /Partial support is not support for the whole sentence/u, label);
    assert.match(value, /supported, contradicted, or uncovered/iu, label);
  }
  if (entry.command.id === "dove.experiment") {
    assert.match(value, /No per-run prospective document, frozen development bank or one-shot quota/iu, label);
    assert.match(value, /Only for final heldout confirmation, save the selected plan before executing/iu, label);
    assert.match(value, /read-only or design-only request does not run experiments/iu, label);
  }
  if (entry.command.id === "dove.review") {
    assert.ok(value.includes(DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS), `${label}: canonical review questions`);
    assert.match(value, /only those listed materials/iu, label);
  }
  if (entry.command.id === "dove.figure") assert.match(value, /rerender and inspect/iu, label);
  if (entry.command.id === "dove.status") {
    assert.match(value, /material user correction updates only affected identity-card fields/iu, label);
    assert.match(value, /even during assessment, not an unchanged Mainline/iu, label);
    assert.match(value, /explicit no-write instruction or host refusal still prohibits that write/iu, label);
    assert.match(value, /ongoing mainline after answering/iu, label);
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
      ".dove/install/RESEARCH_QUALITY_FULL.md",
      ".dove/install/AUTHOR_PREFERENCES.md",
      ".dove/install/AUTHOR_PREFERENCES_FULL.md",
      ".claude/skills/dove-paper-search/SKILL.md",
      ".claude/skills/dove-web-reader/SKILL.md",
      ".claude/settings.json"
    ],
    dsh: [
      ".dove/install/RESEARCH_QUALITY.md",
      ".dove/install/RESEARCH_QUALITY_FULL.md",
      ".dove/install/AUTHOR_PREFERENCES.md",
      ".dove/install/AUTHOR_PREFERENCES_FULL.md"
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
  const brief = renderDoveAuthorPreferencesReference();
  assert.deepEqual(checkGeneratedAuthorPreferencesContent(ROOT), []);
  assert.equal(renderDoveAuthorPreferencesFullReference(), source, "the full reference preserves the sole canonical author source");
  assert.ok(brief.length < 1_000, "author bootstrap stays a short readable summary");
  assert.match(brief, /AUTHOR_PREFERENCES_FULL\.md/u);
  const entries = generatedAuthorPreferencesReferenceEntries();
  assert.deepEqual(entries.map(({ hostId }) => hostId), PROJECT_HOST_IDS.flatMap((hostId) => [hostId, hostId]));
  for (const hostId of PROJECT_HOST_IDS) {
    assert.deepEqual(entries.filter((entry) => entry.hostId === hostId).map(({ destinationPath }) => destinationPath), [
      DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS[hostId],
      DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATHS[hostId]
    ]);
  }
  for (const entry of entries) {
    assert.equal(entry.relativePath, packageResourcePath(entry.hostId, entry.destinationPath));
    assert.ok(PACKAGE_GENERATED_SUPPORT_PATHS.includes(entry.relativePath));
    assert.ok(HOST_ADAPTERS[entry.hostId].requiredPaths.includes(entry.destinationPath));
    const expected = entry.destinationPath === DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS[entry.hostId] ? brief : source;
    assert.equal(entry.content, expected);
    assert.equal(fs.readFileSync(path.join(ROOT, entry.relativePath), "utf8"), expected);
  }
  for (const hosts of [["claude"], ["dsh"], PROJECT_HOST_IDS]) {
    const references = resourcesForHosts(hosts).filter(({ path }) => path.startsWith(".dove/"));
    assert.deepEqual(references.map(({ path }) => path), [".dove/install/AUTHOR_PREFERENCES_FULL.md", ".dove/install/AUTHOR_PREFERENCES.md", ".dove/install/RESEARCH_QUALITY_FULL.md", ".dove/install/RESEARCH_QUALITY.md"]);
    assert.ok(references.every(({ kind, selector }) => kind === "exclusive-file" && selector === null));
    assert.equal(references.find(({ path }) => path === ".dove/install/AUTHOR_PREFERENCES_FULL.md").content, source);
    assert.equal(references.find(({ path }) => path === ".dove/install/AUTHOR_PREFERENCES.md").content, brief);
  }
}

export function assertQualityReferenceResources() {
  const brief = renderDoveResearchQualityReference();
  const full = renderDoveResearchQualityFullReference();
  assert.ok(brief.length < 1_000, "quality bootstrap stays a short readable summary");
  assert.match(brief, /RESEARCH_QUALITY_FULL\.md/u);
  assert.equal(full.split(DOVE_RESEARCH_MAINLINE_ANCHORING).length - 1, 1, "full quality reference retains Mainline anchoring once");
  for (const criterion of DOVE_RESEARCH_QUALITY_CRITERIA) {
    assert.equal(full.split(criterion).length - 1, 1, "full quality reference retains each canonical detailed criterion");
    assert.equal(brief.includes(criterion), false, "detailed criteria stay on demand");
  }
  const entries = generatedResearchQualityReferenceEntries();
  assert.deepEqual(entries.map(({ hostId }) => hostId), PROJECT_HOST_IDS.flatMap((hostId) => [hostId, hostId]));
  for (const hostId of PROJECT_HOST_IDS) {
    assert.deepEqual(entries.filter((entry) => entry.hostId === hostId).map(({ destinationPath }) => destinationPath), [
      DOVE_RESEARCH_QUALITY_REFERENCE_PATHS[hostId],
      DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS[hostId]
    ]);
  }
  for (const entry of entries) {
    assert.equal(entry.relativePath, packageResourcePath(entry.hostId, entry.destinationPath));
    assert.ok(PACKAGE_GENERATED_SUPPORT_PATHS.includes(entry.relativePath));
    assert.ok(HOST_ADAPTERS[entry.hostId].requiredPaths.includes(entry.destinationPath));
    assert.equal(entry.content, entry.destinationPath === DOVE_RESEARCH_QUALITY_REFERENCE_PATHS[entry.hostId] ? brief : full);
    assertGeneratedFileMatches(entry.relativePath, entry.content);
    const quality = resourcesForHosts([entry.hostId]).find(({ path }) => path === entry.destinationPath);
    assert.equal(quality.kind, "exclusive-file");
    assert.equal(quality.selector, null);
    assert.equal(quality.content, entry.content);
  }
  for (const referencePath of [DOVE_RESEARCH_QUALITY_REFERENCE_PATHS.claude, DOVE_RESEARCH_QUALITY_FULL_REFERENCE_PATHS.claude]) {
    assert.equal(resourcesForHosts(PROJECT_HOST_IDS).filter(({ path }) => path === referencePath).length, 1, "each quality reference is shared once across hosts");
  }
}
