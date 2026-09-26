import assert from "node:assert/strict";
import test from "node:test";

import { DOVE_CLAUDE_STOP_HOOK_ENTRY as stopHook, mergeClaudeStopSettings } from "../../src/core/ambient-policy.mjs";
import { planJsonFragments, preparePlan } from "../../src/core/project-installation-plan.mjs";
import { claudeResources, dshResources, resourcesForHosts, semanticDigest, STOP_SELECTOR } from "../../src/core/project-installation-resources.mjs";

const foreign = { matcher: "", hooks: [{ type: "command", command: "other stop command" }] };
const resource = claudeResources({ includeStopHook: true }).find((entry) => entry.selector === STOP_SELECTOR);
const owned = (fragment = stopHook) => ({ path: resource.path, kind: resource.kind, selector: STOP_SELECTOR, digest: semanticDigest(fragment) });

function plan(settings, desired = [resource], previous = [], replacementPolicy = "explicit-update") {
  const bytes = Buffer.from(JSON.stringify(settings));
  const fsOps = {
    lstatSync(target) {
      return { isSymbolicLink: () => false, isDirectory: () => target.endsWith(".claude"), isFile: () => target.endsWith("settings.json"), mode: 0o644 };
    },
    readFileSync: () => bytes
  };
  const result = planJsonFragments("/virtual-project", resource.path, desired, previous, fsOps, { replacementPolicy });
  return { ...result, settings: result.entry ? JSON.parse(result.entry.content) : settings };
}

test("Stop is an explicit Claude-only selector and is not installed by default", () => {
  assert.equal(resource.digest, semanticDigest(stopHook));
  assert.equal(claudeResources().some((entry) => entry.selector === STOP_SELECTOR), false);
  assert.equal(resourcesForHosts(["claude"]).some((entry) => entry.selector === STOP_SELECTOR), false);
  assert.equal(resourcesForHosts(["claude"], { includeStopHook: true }).filter((entry) => entry.selector === STOP_SELECTOR).length, 1);
  assert.equal(dshResources().some((entry) => entry.selector === STOP_SELECTOR), false);
  const fsOps = { lstatSync() { throw Object.assign(new Error("absent"), { code: "ENOENT" }); } };
  const input = { root: "/virtual-project", hosts: ["claude"], packageName: "dove", packageVersion: "3.2.6", now: "2026-01-01T00:00:00.000Z", fsOps };
  assert.equal(preparePlan(input).manifest.managed.some((entry) => entry.selector === STOP_SELECTOR), false);
  assert.equal(preparePlan({ ...input, includeStopHook: true }).manifest.managed.some((entry) => entry.selector === STOP_SELECTOR), true);
});

test("Stop merge preserves unrelated hooks and refuses ambiguous Dove entries", () => {
  const settings = { hooks: { Stop: [foreign], SessionStart: [foreign] }, user: true };
  assert.deepEqual(mergeClaudeStopSettings(settings).settings, { ...settings, hooks: { ...settings.hooks, Stop: [foreign, stopHook] } });
  assert.equal(mergeClaudeStopSettings(mergeClaudeStopSettings(settings).settings).changed, false);
  assert.deepEqual(settings.hooks.Stop, [foreign]);
  assert.throws(() => mergeClaudeStopSettings({ hooks: { Stop: {} } }), /must be an array/u);
  assert.throws(() => mergeClaudeStopSettings({ hooks: { Stop: [{ ...stopHook, matcher: "custom" }] } }), /conflicting/u);
  assert.throws(() => mergeClaudeStopSettings({ hooks: { Stop: [stopHook, stopHook] } }), /conflicting/u);
});

test("Stop lifecycle keeps unowned hooks and refuses to orphan edited owned hooks", () => {
  const original = { hooks: { Stop: [foreign], SessionStart: [foreign] }, user: true };
  const installed = plan(original);
  assert.deepEqual(installed.settings.hooks.Stop, [foreign, stopHook]);
  assert.equal(plan(installed.settings, [resource], [owned()]).entry, null);
  assert.deepEqual(plan(installed.settings, [], [owned()], "safe").settings, original);
  assert.deepEqual(plan(installed.settings, [], [], "safe").settings, installed.settings);
  assert.throws(() => plan({ hooks: { Stop: [stopHook] } }), /conflicting/u);

  const edited = { hooks: [{ ...stopHook.hooks[0], timeout: 20 }] };
  const modified = { ...original, hooks: { ...original.hooks, Stop: [foreign, edited] } };
  const inspected = plan(modified, [resource], [owned()], "inspect");
  assert.equal(inspected.entry, null);
  assert.deepEqual(inspected.skippedLocalEdits, [{ path: resource.path, selector: STOP_SELECTOR }]);
  assert.throws(() => plan(modified, [resource], [owned()], "safe"), /drift/u);
  const repaired = plan(modified, [resource], [owned()]);
  assert.deepEqual(repaired.settings, installed.settings);
  assert.deepEqual(repaired.replacedLocalEdits, [{ path: resource.path, selector: STOP_SELECTOR }]);
  assert.deepEqual(plan(modified, [resource], [owned()], "confirmed-reinstall").settings, installed.settings);
  assert.throws(() => plan(modified, [], [owned()], "safe"), /ownership drift/u);
  assert.throws(() => plan(modified, [], [owned()], "explicit-update"), /ownership drift/u);
  assert.throws(() => plan(modified, [], [owned()], "confirmed-reinstall"), /ownership drift/u);
  const retiring = plan(modified, [], [owned()], "auto-inspect");
  assert.deepEqual(retiring.skippedLocalEdits, [{ path: resource.path, selector: STOP_SELECTOR }]);
  assert.deepEqual(retiring.retainedManaged, [owned()]);
  assert.equal(retiring.entry, null);
  assert.throws(() => plan(modified, [], [owned()], "auto-safe"), /ownership drift/u);
  assert.throws(() => plan(original, [], [owned()], "explicit-update"), /ownership drift/u);
});

test("retired Stop recognition excludes exactly owned fragments without claiming legacy or modified entries", () => {
  const settings = { hooks: { Stop: [foreign, stopHook] } };
  assert.deepEqual(plan(settings, [], [], "inspect").retiredHooks.matchedPaths, [".claude/settings.json#/hooks/Stop/1"]);
  assert.deepEqual(plan(settings, [resource], [owned()], "inspect").retiredHooks.matchedPaths, []);
  const altered = { hooks: { Stop: [foreign, { ...stopHook, matcher: "custom" }] } };
  assert.deepEqual(plan(altered, [resource], [owned()], "inspect").retiredHooks.matchedPaths, []);
  assert.equal(plan(altered, [resource], [owned()], "inspect").skippedLocalEdits.length, 1);
});
