import assert from "node:assert/strict";
import test from "node:test";

import { parseDoveCli } from "../../src/cli/command-parser.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../../src/core/package-metadata.mjs";
import { createProjectInstallationManifest } from "../../src/core/project-installation-manifest.mjs";
import { preparePlan } from "../../src/core/project-installation-plan.mjs";
import { resourcesForHosts, semanticDigest, STOP_SELECTOR } from "../../src/core/project-installation-resources.mjs";

const stopHook = { hooks: [{ type: "command", command: 'dove hook stop --project "$CLAUDE_PROJECT_DIR"', timeout: 10 }] };
const foreign = { matcher: "", hooks: [{ type: "command", command: "other stop command" }] };
const owned = { path: ".claude/settings.json", kind: "json-fragment", selector: STOP_SELECTOR, digest: semanticDigest(stopHook) };

function plan(settings = {}, { previous = [], replacementPolicy = "explicit-update" } = {}) {
  const root = "/virtual-project";
  const bytes = Buffer.from(JSON.stringify(settings));
  const fsOps = {
    lstatSync(target) {
      const directory = target === `${root}/.claude`;
      const file = target === `${root}/.claude/settings.json`;
      if (!directory && !file) throw Object.assign(new Error("absent"), { code: "ENOENT" });
      return { isSymbolicLink: () => false, isDirectory: () => directory, isFile: () => file, mode: 0o644 };
    },
    readFileSync: () => bytes
  };
  const now = "2026-10-23T00:00:00.000Z";
  const manifest = previous.length === 0 ? null : createProjectInstallationManifest({
    package: { name: PACKAGE_NAME, version: "0.0.1" }, hosts: ["claude"], managed: previous, now
  }, { hostIds: ["claude"] });
  const result = preparePlan({ root, hosts: ["claude"], packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, now, fsOps, manifest, replacementPolicy });
  const written = result.entries.find((entry) => entry.relativePath === owned.path);
  return { ...result, settings: written ? JSON.parse(written.content) : settings };
}

test("installations register and own Dove's Stop hook beside the user's own", () => {
  const resource = resourcesForHosts(["claude"]).find((entry) => entry.selector === STOP_SELECTOR);
  assert.deepEqual(resource.fragment, stopHook);
  const installed = plan({ hooks: { Stop: [foreign] }, user: true });
  assert.deepEqual(installed.settings.hooks.Stop, [foreign, stopHook]);
  assert.equal(installed.settings.user, true);
  assert.deepEqual(installed.manifest.managed.find((entry) => entry.selector === STOP_SELECTOR), owned);
  assert.deepEqual(parseDoveCli(["hook", "stop", "--project", "/workspace"]), { command: "hook", subcommand: "stop", options: { project: "/workspace" }, passthrough: [] });
});

test("an identical existing Stop is adopted, not duplicated; a different Dove Stop is a conflict", () => {
  const adopted = plan({ hooks: { Stop: [stopHook] } });
  assert.deepEqual(adopted.settings.hooks.Stop, [stopHook]);
  assert.deepEqual(adopted.manifest.managed.find((entry) => entry.selector === STOP_SELECTOR), owned);
  const edited = { hooks: [{ ...stopHook.hooks[0], timeout: 20 }] };
  assert.throws(() => plan({ hooks: { Stop: [edited] } }), /conflict/iu);
});

test("an edited or removed owned Stop follows the usual local-edit policies", () => {
  const edited = { hooks: [{ ...stopHook.hooks[0], timeout: 20 }] };
  const replaced = plan({ hooks: { Stop: [foreign, edited] } }, { previous: [owned] });
  assert.deepEqual(replaced.settings.hooks.Stop, [foreign, stopHook]);
  assert.deepEqual(replaced.replacedLocalEdits, [{ path: owned.path, selector: STOP_SELECTOR }]);
  for (const stops of [[foreign, edited], [foreign]]) {
    const inspected = plan({ hooks: { Stop: stops } }, { previous: [owned], replacementPolicy: "auto-inspect" });
    assert.deepEqual(inspected.settings.hooks.Stop, stops, "automatic sync keeps the user's change");
    assert.deepEqual(inspected.skippedLocalEdits, [{ path: owned.path, selector: STOP_SELECTOR }]);
    assert.deepEqual(inspected.manifest.managed.find((entry) => entry.selector === STOP_SELECTOR), owned);
  }
  assert.throws(() => plan({ hooks: { Stop: [foreign, edited] } }, { previous: [owned], replacementPolicy: "safe" }), /ownership drift/u);
});

test("retired package files are recognized so an upgrade can remove them", () => {
  for (const retiredPath of [".claude/commands/dove/lessons.md", ".claude/commands/dove/rebuttal.md", ".dove/install/RESEARCH_QUALITY_FULL.md"]) {
    const previous = [{ path: retiredPath, kind: "exclusive-file", selector: null, digest: "a".repeat(64) }];
    const upgraded = plan({}, { previous });
    assert.equal(upgraded.manifest.managed.some((entry) => entry.path === retiredPath), false, retiredPath);
  }
  assert.throws(() => plan({}, { previous: [{ ...owned, selector: "/hooks/Stop[unknown]" }] }), /unknown ownership/u);
});
