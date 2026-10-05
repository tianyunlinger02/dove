import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  COMMAND_SURFACES,
  PACKAGE_GENERATED_SUPPORT_PATHS,
  PROJECT_HOST_IDS,
  adapterPathForCommand,
  packageResourcePath,
  renderDoveAmbientParticipationSection
} from "../../src/core/command-manifest.mjs";
import { generatedDoveAgentEntries, renderClaudeDoveAgent } from "../../src/core/dove-agent-definition.mjs";
import { renderDoveAuthorStanceSection, renderDoveSharedResearchContractSection } from "../../src/core/dove-agent-persona.mjs";
import { DOVE_AUTHOR_PREFERENCES_READ_TRIGGER, renderDoveAuthorPreferencesReference, renderDoveAuthorPreferencesFullReference } from "../../src/core/dove-author-preferences.mjs";
import { renderDoveResearchQualityReference, renderDoveResearchQualityFullReference } from "../../src/core/dove-research-contract.mjs";
import { createProjectInstallationManifest } from "../../src/core/project-installation-manifest.mjs";
import { resourcesForHosts } from "../../src/core/project-installation-resources.mjs";
import { renderAuthorPreferencesContentModule } from "../../scripts/generate-author-preferences.mjs";
import {
  generatedAdapterEntries,
  generatedAuthorPreferencesReferenceEntries,
  generatedClaudeAmbientProjectEntries,
  generatedResearchQualityReferenceEntries
} from "../../scripts/generate-command-adapters.mjs";

const REFERENCE_PATHS = [".dove/install/AUTHOR_PREFERENCES_FULL.md", ".dove/install/AUTHOR_PREFERENCES.md", ".dove/install/RESEARCH_QUALITY_FULL.md", ".dove/install/RESEARCH_QUALITY.md"];
const normalized = (content) => `${content.trimEnd()}\n`;

test("rendered host adapters and agents reach installation resources without extra Skills", () => {
  const entries = generatedAdapterEntries();
  assert.equal(new Set(entries.map(({ relativePath }) => relativePath)).size, entries.length);
  for (const hostId of PROJECT_HOST_IDS) {
    const hostEntries = entries.filter((entry) => entry.hostId === hostId);
    assert.deepEqual(hostEntries.map(({ command }) => command.id), COMMAND_SURFACES.map(({ id }) => id));
    const resources = resourcesForHosts([hostId]);
    for (const entry of hostEntries) {
      assert.equal(entry.destinationPath, adapterPathForCommand(hostId, entry.command));
      assert.equal(entry.relativePath, packageResourcePath(hostId, entry.destinationPath));
      assert.equal(resources.find(({ path }) => path === entry.destinationPath).content, normalized(entry.content));
      for (const action of entry.command.contract.actions) assert.ok(entry.content.includes(action), `${entry.command.id}: canonical actions reach the host`);
      assert.equal(entry.content.includes("$ARGUMENTS"), hostId === "claude");
    }
  }
  for (const entry of generatedDoveAgentEntries()) {
    assert.ok(PACKAGE_GENERATED_SUPPORT_PATHS.includes(packageResourcePath("claude", entry.relativePath)), entry.relativePath);
    assert.equal(resourcesForHosts(["claude"]).find(({ path }) => path === entry.relativePath).content, normalized(entry.content));
  }
});

test("ordinary Claude and standalone DSH carry one applicable shared and author owner", () => {
  const rule = generatedClaudeAmbientProjectEntries().find(({ destinationPath }) => destinationPath === ".claude/rules/dove.md").content;
  const shared = renderDoveSharedResearchContractSection();
  const author = renderDoveAuthorStanceSection();
  const participation = renderDoveAmbientParticipationSection();
  assert.ok(rule.includes(participation));
  assert.equal(participation.split("\n").filter((line) => line.startsWith("- Dove ")).length, 9);
  for (const entry of generatedAdapterEntries()) {
    const contexts = entry.hostId === "claude" ? [`${rule}\n${entry.content}`, `${rule}\n${renderClaudeDoveAgent()}\n${entry.content}`] : [entry.content];
    const authorOwners = entry.hostId === "dsh" && entry.command.id === "dove.status" ? 0 : 1;
    for (const context of contexts) {
      assert.equal(context.split(shared).length - 1, 1, `${entry.command.id}: shared guidance once`);
      assert.equal(context.split(author).length - 1, authorOwners, `${entry.command.id}: applicable author stance`);
      assert.equal(context.split(DOVE_AUTHOR_PREFERENCES_READ_TRIGGER).length - 1, authorOwners, `${entry.command.id}: main-context bootstrap only`);
    }
    assert.equal(entry.content.includes(participation), false);
  }
  assert.equal(rule.split(shared).length - 1, 1, "ordinary conversation needs no optional agent or Skill");
});

test("quality and preference summaries and full references remain shared installation resources", () => {
  const expected = new Map([
    [".dove/install/RESEARCH_QUALITY.md", renderDoveResearchQualityReference()],
    [".dove/install/RESEARCH_QUALITY_FULL.md", renderDoveResearchQualityFullReference()],
    [".dove/install/AUTHOR_PREFERENCES.md", renderDoveAuthorPreferencesReference()],
    [".dove/install/AUTHOR_PREFERENCES_FULL.md", renderDoveAuthorPreferencesFullReference()]
  ]);
  assert.ok(renderDoveResearchQualityReference().length < 1_000);
  assert.ok(renderDoveAuthorPreferencesReference().length < 1_000);
  for (const entry of [...generatedResearchQualityReferenceEntries(), ...generatedAuthorPreferencesReferenceEntries()]) {
    assert.equal(entry.content, expected.get(entry.destinationPath));
    assert.ok(PACKAGE_GENERATED_SUPPORT_PATHS.includes(entry.relativePath));
  }
  for (const hosts of [["claude"], ["dsh"], PROJECT_HOST_IDS]) {
    const references = resourcesForHosts(hosts).filter(({ path }) => path.startsWith(".dove/"));
    assert.deepEqual(references.map(({ path }) => path), REFERENCE_PATHS);
    for (const reference of references) {
      assert.equal(reference.kind, "exclusive-file");
      assert.equal(reference.selector, null);
      assert.equal(reference.content, normalized(expected.get(reference.path)));
    }
  }
});

test("author preferences preserve their sole full Markdown source and Unicode module content", async () => {
  assert.equal(renderDoveAuthorPreferencesFullReference(), fs.readFileSync(new URL("../../docs/AUTHOR_PREFERENCES.md", import.meta.url), "utf8"));
  const content = '# 中文\n`code` ${expression} \\ "quote"\n\n';
  const generated = renderAuthorPreferencesContentModule(content);
  const module = await import(`data:text/javascript;base64,${Buffer.from(generated).toString("base64")}`);
  assert.equal(module.DOVE_AUTHOR_PREFERENCES_CONTENT, content);
});

test("installation manifests own references but not core research or historical documents", () => {
  const hosts = ["claude", "dsh"];
  const input = {
    package: { name: "dove", version: "3.0.11" },
    hosts,
    managed: resourcesForHosts(hosts),
    now: "2026-09-13T00:00:00.000Z"
  };
  const manifest = createProjectInstallationManifest(input, { hostIds: hosts });
  assert.equal(manifest.revision, "2.0");
  assert.deepEqual(manifest.managed.filter(({ path }) => path.startsWith(".dove/")).map(({ path }) => path), REFERENCE_PATHS);
  for (const path of REFERENCE_PATHS) {
    for (const kind of ["json-fragment", "text-block"]) {
      assert.throws(() => createProjectInstallationManifest({ ...input, managed: [{ path, kind, selector: "/anything", digest: "a".repeat(64) }] }, { hostIds: hosts }), /one exclusive file/u);
    }
  }
  for (const path of [".dove/install/DOCTOR.md", ".dove/install/manifest.json", ".dove/research/IDENTITY.md", ".dove/research/EVAL.md", ".dove/research/rounds/001-brief.md", ".dove/research/missions/old.md", ".dove/research/experiments/old.md", ".dove/research/claims/old.md", ".dove/research/lessons/LESSONS.md"]) {
    assert.throws(() => createProjectInstallationManifest({ ...input, managed: [{ path, kind: "exclusive-file", selector: null, digest: "a".repeat(64) }] }, { hostIds: hosts }), /must not manage/u);
  }
});
