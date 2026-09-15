import assert from "node:assert/strict";
import test from "node:test";

import { DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_ENTRY as promptHook, mergeClaudeUserPromptSubmitSettings } from "../../src/core/ambient-policy.mjs";
import { planJsonFragments } from "../../src/core/project-installation-plan.mjs";
import { claudeResources, dshResources, semanticDigest, USER_PROMPT_SUBMIT_SELECTOR } from "../../src/core/project-installation-resources.mjs";

const projectHook = { matcher: "", hooks: [{ type: "command", command: "user prompt hook" }] };
const legacy = { hooks: [{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR/scripts/dove-user-prompt-submit-package.mjs"', timeout: 10 }] };
const resource = { path: ".claude/settings.json", kind: "json-fragment", selector: USER_PROMPT_SUBMIT_SELECTOR, fragment: promptHook, digest: semanticDigest(promptHook) };
const owned = (fragment) => ({ ...resource, digest: semanticDigest(fragment) });

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

test("UserPromptSubmit merge is idempotent and preserves unrelated hooks and settings", () => {
  const settings = { hooks: { UserPromptSubmit: [projectHook], Stop: [projectHook] }, enabledPlugins: { user: true } };
  const merged = mergeClaudeUserPromptSubmitSettings(settings);
  assert.deepEqual(merged.settings, { ...settings, hooks: { ...settings.hooks, UserPromptSubmit: [projectHook, promptHook] } });
  assert.equal(mergeClaudeUserPromptSubmitSettings(merged.settings).changed, false);
  assert.deepEqual(settings.hooks.UserPromptSubmit, [projectHook]);
  assert.throws(() => mergeClaudeUserPromptSubmitSettings({ hooks: { UserPromptSubmit: {} } }), /must be an array/u);
  assert.throws(() => mergeClaudeUserPromptSubmitSettings({ hooks: { UserPromptSubmit: [{ ...promptHook, matcher: "custom" }] } }), /conflicting/u);
});

test("UserPromptSubmit is a desired Claude-only managed resource", () => {
  const entries = claudeResources().filter((entry) => entry.selector === USER_PROMPT_SUBMIT_SELECTOR);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].fragment, promptHook);
  assert.equal(dshResources().some((entry) => entry.selector === USER_PROMPT_SUBMIT_SELECTOR), false);
});

test("prompt lifecycle installs, repairs explicit owned edits, and removes only unchanged owned hooks", () => {
  const initial = { hooks: { UserPromptSubmit: [projectHook], Stop: [projectHook] }, user: true };
  const installed = plan(initial);
  assert.deepEqual(installed.settings.hooks.UserPromptSubmit, [projectHook, promptHook]);
  assert.equal(plan(installed.settings, [resource], [owned(promptHook)]).entry, null);
  const edited = { hooks: [{ ...promptHook.hooks[0], timeout: 20 }] };
  const settings = { ...initial, hooks: { ...initial.hooks, UserPromptSubmit: [projectHook, edited] } };
  const inspected = plan(settings, [resource], [owned(promptHook)], "inspect");
  assert.equal(inspected.entry, null);
  assert.equal(inspected.skippedLocalEdits.length, 1);
  const repaired = plan(settings, [resource], [owned(promptHook)]);
  assert.deepEqual(repaired.settings, installed.settings);
  assert.equal(repaired.replacedLocalEdits.length, 1);
  for (const policy of ["safe", "confirmed-reinstall"]) {
    assert.deepEqual(plan(installed.settings, [], [owned(promptHook)], policy).settings, initial);
    assert.deepEqual(plan(settings, [], [owned(promptHook)], policy).settings, settings);
    assert.deepEqual(plan(installed.settings, [], [], policy).settings, installed.settings);
  }
});

test("package-script retirement requires exact fragment and matching manifest ownership", () => {
  const settings = { hooks: { UserPromptSubmit: [projectHook, legacy], Stop: [projectHook] } };
  assert.deepEqual(plan(settings).settings.hooks.UserPromptSubmit, [projectHook, legacy, promptHook]);
  assert.deepEqual(plan(settings, [resource], [owned(legacy)]).settings.hooks.UserPromptSubmit, [projectHook, promptHook]);
  assert.deepEqual(plan(settings, [], [owned(legacy)]).settings.hooks.UserPromptSubmit, [projectHook]);
  const changedLegacy = { hooks: [{ ...legacy.hooks[0], timeout: 11 }] };
  for (const entry of [changedLegacy, { ...legacy, matcher: "custom" }]) {
    const modified = { hooks: { UserPromptSubmit: [entry] } };
    assert.deepEqual(plan(modified, [resource], [owned(legacy)]).settings.hooks.UserPromptSubmit, [entry, promptHook]);
    assert.deepEqual(plan(modified, [], [owned(legacy)]).settings, modified);
  }
  assert.deepEqual(plan(settings, [], [owned(promptHook)]).settings, settings);
  const coexist = { hooks: { UserPromptSubmit: [legacy, projectHook, promptHook] } };
  assert.deepEqual(plan(coexist, [resource], [owned(legacy)]).settings.hooks.UserPromptSubmit, [projectHook, promptHook]);
  assert.deepEqual(plan(coexist, [], [owned(promptHook)]).settings.hooks.UserPromptSubmit, [legacy, projectHook]);
});
