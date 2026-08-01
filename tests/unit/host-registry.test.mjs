import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_INITIALIZABLE_HOSTS,
  HOST_REGISTRY,
  PROJECT_HOST_IDS,
  normalizeHostSelection,
  requireNativeReviewerHost
} from "../../src/core/host-registry.mjs";

test("host registry has stable project order and only Claude is initializable", () => {
  assert.deepEqual(PROJECT_HOST_IDS, ["opencode", "codex", "cursor", "agents", "claude"]);
  assert.deepEqual(Object.keys(HOST_REGISTRY), PROJECT_HOST_IDS);
  assert.deepEqual(DEFAULT_INITIALIZABLE_HOSTS, ["claude"]);
  assert.equal(HOST_REGISTRY.claude.projectInitializable, true);
  for (const hostId of PROJECT_HOST_IDS.filter((hostId) => hostId !== "claude")) {
    assert.equal(HOST_REGISTRY[hostId].projectInitializable, false);
  }
  assert.equal(Object.isFrozen(HOST_REGISTRY), true);
  assert.equal(Object.isFrozen(HOST_REGISTRY.claude.capabilities), true);
  assert.equal(Object.isFrozen(HOST_REGISTRY.claude.legacySignatures), true);
});

test("host selection defaults, expands all, sorts, and deduplicates", () => {
  assert.deepEqual(normalizeHostSelection(undefined), ["claude"]);
  assert.deepEqual(normalizeHostSelection([], { defaultWhenEmpty: false }), []);
  assert.deepEqual(normalizeHostSelection(["claude", "opencode", "claude"]), ["opencode", "claude"]);
  assert.deepEqual(normalizeHostSelection("all"), PROJECT_HOST_IDS);
  assert.throws(() => normalizeHostSelection(["unknown"]), /Unknown Dove project host/u);
});

test("initializable host selection fails closed for incomplete registrations", () => {
  assert.deepEqual(normalizeHostSelection(undefined, { requireInitializable: true }), ["claude"]);
  assert.deepEqual(normalizeHostSelection(["claude"], { requireInitializable: true }), ["claude"]);
  assert.throws(() => normalizeHostSelection(["opencode"], { requireInitializable: true }), /complete project MCP registration/u);
  assert.throws(() => normalizeHostSelection(["all"], { requireInitializable: true }), /opencode, codex, cursor, agents/u);
});

test("native Reviewer support is explicit and fails closed", () => {
  for (const hostId of ["claude", "opencode"]) {
    const host = requireNativeReviewerHost(hostId);
    assert.equal(host.capabilities.nativeReviewer, true);
    assert.equal(host.capabilities.reviewerFreshContext, true);
    assert.equal(host.capabilities.reviewerReadOnly, true);
    assert.equal(host.capabilities.reviewerSynchronous, true);
  }
  for (const hostId of ["codex", "cursor", "agents", "unknown"]) {
    assert.throws(() => requireNativeReviewerHost(hostId), /does not support a dedicated native Reviewer/u);
  }
});
