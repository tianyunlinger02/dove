import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  COMMAND_SURFACES,
  PACKAGE_GENERATED_SUPPORT_PATHS,
  adapterPathForCommand,
  packageResourcePath,
  renderDoveAmbientParticipationSection
} from "../../src/core/command-manifest.mjs";
import { generatedDoveAgentEntries } from "../../src/core/dove-agent-definition.mjs";
import { DOVE_USER_SAYINGS, renderDoveAuthorPreferencesReference, renderDoveAuthorPreferencesFullReference } from "../../src/core/dove-author-preferences.mjs";
import {
  DOVE_OPERATING_MOMENTS,
  DOVE_RESEARCH_QUALITY_CRITERIA,
  DOVE_RESEARCH_STANCE_BULLETS,
  renderDoveResearchQualityReference
} from "../../src/core/dove-research-contract.mjs";
import { USER_RESPONSE_POLICY } from "../../src/core/user-response-policy.mjs";
import { createProjectInstallationManifest } from "../../src/core/project-installation-manifest.mjs";
import { resourcesForHosts } from "../../src/core/project-installation-resources.mjs";
import { renderAuthorPreferencesContentModule } from "../../scripts/generate-author-preferences.mjs";
import {
  generatedAdapterEntries,
  generatedAuthorPreferencesReferenceEntries,
  generatedClaudeAmbientProjectEntries,
  generatedResearchQualityReferenceEntries,
  renderCommandAdapter
} from "../../scripts/generate-command-adapters.mjs";

const REFERENCE_PATHS = [".dove/install/AUTHOR_PREFERENCES_FULL.md", ".dove/install/AUTHOR_PREFERENCES.md", ".dove/install/RESEARCH_QUALITY.md", ".dove/install/TOPIC_CRITERIA.md"];
const normalized = (content) => `${content.trimEnd()}\n`;
const rule = () => generatedClaudeAmbientProjectEntries().find(({ destinationPath }) => destinationPath === ".claude/rules/dove.md").content;

test("each Skill's own practice reaches its installed file and nothing else is added", () => {
  const entries = generatedAdapterEntries();
  assert.ok(COMMAND_SURFACES.find(({ id }) => id === "dove.figure").contract.modelPrompt?.trim(), "Figure owns an adaptable design brief");
  assert.deepEqual(entries.map(({ command }) => command.id), COMMAND_SURFACES.map(({ id }) => id));
  const resources = resourcesForHosts(["claude"]);
  for (const entry of entries) {
    assert.equal(entry.destinationPath, adapterPathForCommand("claude", entry.command));
    assert.equal(entry.relativePath, packageResourcePath("claude", entry.destinationPath));
    assert.equal(entry.content, renderCommandAdapter("claude", entry.command));
    assert.equal(resources.find(({ path }) => path === entry.destinationPath).content, normalized(entry.content));
    const contract = entry.command.contract;
    for (const instruction of [contract.purpose, contract.when, ...(contract.responsibilities ?? []), ...contract.actions, ...contract.boundaries, ...(contract.modelPrompt ? [contract.modelPrompt] : []), ...(contract.hostGuidance?.common ?? []), ...(contract.hostGuidance?.claude ?? [])]) {
      assert.ok(entry.content.includes(instruction), `${entry.command.id}: its own practice is installed`);
    }
    assert.ok(entry.content.includes("$ARGUMENTS"));
  }
  for (const entry of [
    ...generatedDoveAgentEntries().map((entry) => ({ ...entry, destinationPath: entry.relativePath })),
    ...generatedClaudeAmbientProjectEntries()
  ]) {
    assert.ok(PACKAGE_GENERATED_SUPPORT_PATHS.includes(packageResourcePath("claude", entry.destinationPath)), entry.destinationPath);
    assert.equal(resources.find(({ path }) => path === entry.destinationPath).content, normalized(entry.content));
  }
  assert.throws(() => renderCommandAdapter("dsh", COMMAND_SURFACES[0]), /Unknown host adapter/u);
});

test("the operating manual is the one place that states the operating rules", () => {
  const manual = rule();
  for (const moment of DOVE_OPERATING_MOMENTS) assert.equal(manual.split(moment).length - 1, 1);
  for (const policy of USER_RESPONSE_POLICY) assert.equal(manual.split(policy).length - 1, 1);
  const participation = renderDoveAmbientParticipationSection();
  assert.ok(manual.includes(participation));
  assert.equal(participation.split("\n").filter((line) => line.startsWith("- Dove ")).length, COMMAND_SURFACES.length);
  // Skills carry their own practice only; the moments and response policy are not repeated in them.
  for (const entry of generatedAdapterEntries()) {
    for (const moment of DOVE_OPERATING_MOMENTS) assert.equal(entry.content.includes(moment), false, `${entry.command.id} restates a moment`);
    for (const policy of USER_RESPONSE_POLICY) assert.equal(entry.content.includes(policy), false, `${entry.command.id} restates the response policy`);
  }
  // Keep the authority and stop boundaries, not a required form vocabulary.
  assert.match(manual, /只为三类情况停下来/u);
  assert.match(manual, /限制只能来自用户原话/u);
  assert.match(manual, /CROSS_PROJECT_EXPERIENCE\.md/u);
});

test("one research standard replaces the quality summary and full reference", () => {
  const standard = renderDoveResearchQualityReference();
  for (const stance of DOVE_RESEARCH_STANCE_BULLETS) assert.equal(standard.split(stance).length - 1, 1);
  for (const criterion of DOVE_RESEARCH_QUALITY_CRITERIA) assert.equal(standard.split(criterion).length - 1, 1);
  assert.deepEqual(DOVE_RESEARCH_QUALITY_CRITERIA.map((criterion) => criterion.split(" — ")[0]), [
    "问题价值（1–4）", "创新（1–4）", "机制与理论（1–4）",
    "方法质量与可行性（1–4）", "数据与评价（1–4）",
    "实现（1–3）", "实验与证据价值（1–4）", "表达与交付（1–4）"
  ]);
  for (const heading of ["## 研究者立场", "## 从问题到方法", "## 八维判断", "## 证据与实验", "## 选题与新意"]) assert.ok(standard.includes(heading), heading);
  assert.equal(standard.includes("RESEARCH_QUALITY_FULL"), false);
  const expected = new Map([
    [".dove/install/RESEARCH_QUALITY.md", standard],
    [".dove/install/TOPIC_CRITERIA.md", fs.readFileSync(new URL("../../docs/TOPIC_CRITERIA.md", import.meta.url), "utf8")],
    [".dove/install/AUTHOR_PREFERENCES.md", renderDoveAuthorPreferencesReference()],
    [".dove/install/AUTHOR_PREFERENCES_FULL.md", renderDoveAuthorPreferencesFullReference()]
  ]);
  for (const entry of [...generatedResearchQualityReferenceEntries(), ...generatedAuthorPreferencesReferenceEntries()]) {
    assert.equal(entry.content, expected.get(entry.destinationPath));
    assert.ok(PACKAGE_GENERATED_SUPPORT_PATHS.includes(entry.relativePath));
  }
  const references = resourcesForHosts(["claude"]).filter(({ path }) => path.startsWith(".dove/"));
  assert.deepEqual(references.map(({ path }) => path), REFERENCE_PATHS);
  for (const reference of references) {
    assert.equal(reference.kind, "exclusive-file");
    assert.equal(reference.content, normalized(expected.get(reference.path)));
  }
});

test("the user's most frequent sayings are quoted with dates and what to do", () => {
  const reference = renderDoveAuthorPreferencesReference();
  assert.equal(DOVE_USER_SAYINGS.length, 13);
  for (const saying of DOVE_USER_SAYINGS) {
    assert.ok(reference.includes(`“${saying.quote}”（${saying.date}）`), saying.id);
    assert.ok(reference.includes(`所以：${saying.so}`), saying.id);
  }
  assert.ok(reference.includes("AUTHOR_PREFERENCES_FULL.md"));
  assert.equal(renderDoveAuthorPreferencesFullReference(), fs.readFileSync(new URL("../../docs/AUTHOR_PREFERENCES.md", import.meta.url), "utf8"));
});

test("author preferences keep their full Markdown source and Unicode module content", async () => {
  const content = '# 中文\n`code` ${expression} \\ "quote"\n\n';
  const generated = renderAuthorPreferencesContentModule(content);
  const module = await import(`data:text/javascript;base64,${Buffer.from(generated).toString("base64")}`);
  assert.equal(module.DOVE_AUTHOR_PREFERENCES_CONTENT, content);
});

test("installation manifests own references but not research or historical documents", () => {
  const hosts = ["claude"];
  const input = {
    package: { name: "dove", version: "3.5.0" },
    hosts,
    managed: resourcesForHosts(hosts),
    now: "2026-10-23T00:00:00.000Z"
  };
  const manifest = createProjectInstallationManifest(input, { hostIds: hosts });
  assert.equal(manifest.revision, "2.0");
  assert.deepEqual(manifest.managed.filter(({ path }) => path.startsWith(".dove/")).map(({ path }) => path), REFERENCE_PATHS);
  for (const path of REFERENCE_PATHS) {
    for (const kind of ["json-fragment", "text-block"]) {
      assert.throws(() => createProjectInstallationManifest({ ...input, managed: [{ path, kind, selector: "/anything", digest: "a".repeat(64) }] }, { hostIds: hosts }), /one exclusive file/u);
    }
  }
  for (const path of [".dove/install/DOCTOR.md", ".dove/install/manifest.json", ".dove/install/hook-state.json", ".dove/install/CROSS_PROJECT_EXPERIENCE.md", ".dove/research/IDENTITY.md", ".dove/research/EVAL.md", ".dove/research/MENTOR_NOTES.md", ".dove/research/rounds/001-brief.md", ".dove/research/rounds/001-result.md", ".dove/research/watch/config.json", ".dove/research/papers/library.json", ".dove/research/missions/old.md", ".dove/research/lessons/LESSONS.md"]) {
    assert.throws(() => createProjectInstallationManifest({ ...input, managed: [{ path, kind: "exclusive-file", selector: null, digest: "a".repeat(64) }] }, { hostIds: hosts }), /must not manage/u);
  }
});
