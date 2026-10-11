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

function plan(settings = {}, { previous = [], replacementPolicy = "explicit-update", hosts = ["claude"] } = {}) {
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
  const now = "2026-01-01T00:00:00.000Z";
  const manifest = previous.length === 0 ? null : createProjectInstallationManifest({
    package: { name: PACKAGE_NAME, version: "0.0.1" }, hosts, managed: previous, now
  }, { hostIds: ["claude", "dsh"] });
  const result = preparePlan({ root, hosts, packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, now, fsOps, manifest, replacementPolicy });
  const written = result.entries.find((entry) => entry.relativePath === owned.path);
  return { ...result, settings: written ? JSON.parse(written.content) : settings };
}

test("new installations neither register nor own Stop and the parser rejects its retired command", () => {
  assert.equal(resourcesForHosts(["claude", "dsh"]).some((entry) => entry.selector === STOP_SELECTOR), false);
  for (const hosts of [["claude"], ["dsh"]]) {
    const installed = plan({}, { hosts });
    assert.equal(installed.manifest.managed.some((entry) => entry.selector === STOP_SELECTOR), false);
    assert.equal(installed.settings.hooks?.Stop, undefined);
  }
  assert.throws(() => parseDoveCli(["hook", "stop", "--project", "/workspace"]), /hook 只接受这些子命令/u);
});

test("preparePlan retires only unchanged manifest-owned Stop through the ownership gate", () => {
  const settings = { hooks: { Stop: [foreign, stopHook], SessionStart: [foreign] }, user: true };
  const retired = plan(settings, { previous: [owned] });
  assert.deepEqual(retired.settings.hooks.Stop, [foreign]);
  assert.equal(retired.settings.user, true);
  assert.deepEqual(retired.settings.hooks.SessionStart[0], foreign);
  assert.equal(retired.manifest.managed.some((entry) => entry.selector === STOP_SELECTOR), false);
  assert.deepEqual(retired.skippedLocalEdits, []);

  const unowned = plan(settings);
  assert.deepEqual(unowned.settings.hooks.Stop, settings.hooks.Stop, "even an identical unowned Stop is not deletion authority");
  assert.equal(unowned.manifest.managed.some((entry) => entry.selector === STOP_SELECTOR), false);
});

test("preparePlan keeps modified or missing retired Stop and its old ownership during auto-inspect", () => {
  const edited = { hooks: [{ ...stopHook.hooks[0], timeout: 20 }] };
  for (const stops of [[foreign, edited], [foreign]]) {
    const settings = { hooks: { Stop: stops } };
    const inspected = plan(settings, { previous: [owned], replacementPolicy: "auto-inspect" });
    assert.deepEqual(inspected.settings.hooks.Stop, stops);
    assert.deepEqual(inspected.skippedLocalEdits, [{ path: owned.path, selector: STOP_SELECTOR }]);
    assert.deepEqual(inspected.manifest.managed.find((entry) => entry.selector === STOP_SELECTOR), owned);
    for (const replacementPolicy of ["explicit-update", "confirmed-reinstall", "safe"]) {
      assert.throws(() => plan(settings, { previous: [owned], replacementPolicy }), /ownership drift/u);
    }
  }
});

test("retired fragment ownership still requires the supported host, path, kind and selector", () => {
  for (const entry of [
    { ...owned, path: ".mcp.json" },
    { ...owned, kind: "text-block" },
    { ...owned, selector: "/hooks/Stop[unknown]" }
  ]) {
    assert.throws(() => plan({}, { previous: [entry] }), /unknown ownership/u);
  }
  assert.throws(() => plan({}, { previous: [owned], hosts: ["dsh"] }), /unknown ownership/u);
});
