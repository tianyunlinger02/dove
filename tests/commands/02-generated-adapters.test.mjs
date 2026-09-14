import assert from "node:assert/strict";
import test from "node:test";

import { createProjectInstallationManifest } from "../../src/core/project-installation-manifest.mjs";
import { resourcesForHosts } from "../../src/core/project-installation-resources.mjs";
import { renderAuthorPreferencesContentModule } from "../../scripts/generate-author-preferences.mjs";

import {
  assertAuthorPreferencesResources,
  assertFinalEntrypointWiring,
  assertGeneratedAdapters,
  assertQualityReferenceResources,
  assertSourceIdentityGuidanceProjection
} from "./generated-surfaces.mjs";

test("generated host adapters match canonical command renderers", () => {
  assertGeneratedAdapters();
});

test("final Claude context + command and standalone DSH preserve scientific judgment", () => {
  assertFinalEntrypointWiring();
});

test("Source DOI identity guidance stays canonical and projected", () => {
  assertSourceIdentityGuidanceProjection();
});

test("quality references are rendered and included in host installation resources", () => {
  assertQualityReferenceResources();
});

test("author preferences retain the full Markdown in generated and installed resources", async () => {
  assertAuthorPreferencesResources();
  const content = '# 中文\n`code` ${expression} \\ "quote"\n\n';
  const generated = renderAuthorPreferencesContentModule(content);
  const module = await import(`data:text/javascript;base64,${Buffer.from(generated).toString("base64")}`);
  assert.equal(module.DOVE_AUTHOR_PREFERENCES_CONTENT, content);
});

test("installation manifests own only the two exact Dove reference files", () => {
  const hosts = ["claude", "dsh"];
  const input = {
    package: { name: "dove", version: "3.0.11" },
    hosts,
    managed: resourcesForHosts(hosts),
    now: "2026-09-13T00:00:00.000Z"
  };
  const manifest = createProjectInstallationManifest(input, { hostIds: hosts });
  assert.equal(manifest.revision, "2.0");
  const referencePaths = [".dove/install/AUTHOR_PREFERENCES.md", ".dove/install/RESEARCH_QUALITY.md"];
  assert.deepEqual(manifest.managed.filter(({ path }) => path.startsWith(".dove/")).map(({ path }) => path), referencePaths);
  for (const path of referencePaths) {
    for (const kind of ["json-fragment", "text-block"]) {
      assert.throws(() => createProjectInstallationManifest({ ...input, managed: [{ path, kind, selector: "/anything", digest: "a".repeat(64) }] }, { hostIds: hosts }), /one exclusive file/u);
    }
  }
  for (const path of [".dove/install/DOCTOR.md", ".dove/install/manifest.json", ".dove/install/unknown.md", ".dove/research/RESEARCH.md", ...referencePaths.map((path) => `${path}/extra`)]) {
    assert.throws(() => createProjectInstallationManifest({ ...input, managed: [{ path, kind: "exclusive-file", selector: null, digest: "a".repeat(64) }] }, { hostIds: hosts }), /must not manage/u);
  }
});
