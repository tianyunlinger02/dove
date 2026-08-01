import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PROJECT_HOST_IDS } from "../../src/core/host-registry.mjs";
import {
  INSTALLATION_MANIFEST_PATH,
  createProjectInstallationManifest,
  INSTALLATION_INTEGRATION_VERSION,
  INSTALLATION_OWNERSHIP_VERSION,
  PREVIOUS_INSTALLATION_INTEGRATION_VERSION,
  PREVIOUS_INSTALLATION_OWNERSHIP_VERSION,
  readProjectInstallationManifest,
  serializeProjectInstallationManifest,
  validateProjectInstallationManifest
} from "../../src/core/project-installation-manifest.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);
const NOW = "2026-07-26T00:00:00.000Z";

function manifestInput(overrides = {}) {
  return {
    installationId: "installation-123e4567-e89b-42d3-a456-426614174000",
    package: { name: "@dove-research/cli", version: "0.5.0" },
    hosts: ["claude"],
    managed: [
      { path: ".claude/rules/dove.md", owner: "host:claude:rule", mode: "exclusive-file", selector: null, digest: DIGEST_A },
      { path: ".mcp.json", owner: "host:claude:mcp:dove", mode: "json-fragment", selector: "/mcpServers/dove", digest: DIGEST_B }
    ],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

function options() {
  return { hostIds: PROJECT_HOST_IDS };
}

test("project installation manifest creates stable sealed schema", () => {
  const manifest = createProjectInstallationManifest(manifestInput({
    hosts: ["claude", "opencode", "claude"],
    managed: [...manifestInput().managed].reverse()
  }), options());
  assert.deepEqual(manifest.hosts, ["opencode", "claude"]);
  assert.deepEqual(manifest.managed.map((entry) => entry.path), [".claude/rules/dove.md", ".mcp.json"]);
  assert.equal(manifest.integrationVersion, INSTALLATION_INTEGRATION_VERSION);
  assert.equal(manifest.ownershipVersion, INSTALLATION_OWNERSHIP_VERSION);
  assert.equal(manifest.runtime.mode, "user-cli");
  assert.equal(manifest.runtime.protocolVersion, 1);
  assert.equal(Object.isFrozen(manifest), true);
  assert.equal(Object.isFrozen(manifest.managed[0]), true);
  assert.equal(serializeProjectInstallationManifest(manifest, options()).endsWith("\n"), true);
});

test("project installation manifest rejects workspace paths, all, absolute paths, and backslashes", () => {
  for (const managedPath of [".dove", ".dove/manifest.json", "/absolute/file", "C:\\absolute\\file", ".claude\\rules\\dove.md"]) {
    assert.throws(() => createProjectInstallationManifest(manifestInput({
      managed: [{ path: managedPath, owner: "test", mode: "exclusive-file", selector: null, digest: DIGEST_A }]
    }), options()), /project-relative|workspace state|canonical/u, managedPath);
  }
  assert.throws(() => createProjectInstallationManifest(manifestInput({ hosts: ["all"] }), options()), /concrete known host/u);
  assert.throws(() => createProjectInstallationManifest(manifestInput({ hosts: ["unknown"] }), options()), /concrete known host/u);
});

test("project installation manifest enforces selector modes and sealed fields", () => {
  assert.throws(() => createProjectInstallationManifest(manifestInput({
    managed: [{ path: "owned.md", owner: "test", mode: "exclusive-file", selector: "not-null", digest: DIGEST_A }]
  }), options()), /selector must be null/u);
  assert.throws(() => createProjectInstallationManifest(manifestInput({
    managed: [{ path: ".mcp.json", owner: "test", mode: "json-fragment", selector: null, digest: DIGEST_A }]
  }), options()), /selector must be a non-empty/u);
  const valid = createProjectInstallationManifest(manifestInput(), options());
  assert.throws(() => validateProjectInstallationManifest({ ...valid, extra: true }, options()), /unknown fields/u);
});

test("strict manifest reader rejects duplicate keys and symlink marker", () => {
  const root = createTempRoot("dove-install-manifest-");
  const outside = createTempRoot("dove-install-manifest-outside-");
  try {
    fs.mkdirSync(path.join(root, ".dove-install"));
    fs.writeFileSync(path.join(root, INSTALLATION_MANIFEST_PATH), '{"schemaVersion":1,"schemaVersion":1}\n');
    assert.throws(() => readProjectInstallationManifest(root, options()), /duplicate JSON object keys/u);

    fs.rmSync(path.join(root, INSTALLATION_MANIFEST_PATH));
    const outsideManifest = path.join(outside, "manifest.json");
    fs.writeFileSync(outsideManifest, "{}\n");
    fs.symlinkSync(outsideManifest, path.join(root, INSTALLATION_MANIFEST_PATH));
    assert.throws(() => readProjectInstallationManifest(root, options()), /must not be a symbolic link/u);
  } finally {
    cleanupTempRoot(root);
    cleanupTempRoot(outside);
  }
});

test("project installation manifest reads only complete previous version pairs during explicit migration", () => {
  const root = createTempRoot("dove-install-manifest-previous-");
  try {
    const current = createProjectInstallationManifest(manifestInput(), options());
    const previous = {
      ...structuredClone(current),
      integrationVersion: PREVIOUS_INSTALLATION_INTEGRATION_VERSION,
      ownershipVersion: PREVIOUS_INSTALLATION_OWNERSHIP_VERSION
    };
    fs.mkdirSync(path.join(root, ".dove-install"));
    fs.writeFileSync(path.join(root, INSTALLATION_MANIFEST_PATH), `${JSON.stringify(previous, null, 2)}\n`);
    assert.throws(() => readProjectInstallationManifest(root, options()), /integrationVersion\/ownershipVersion/u);
    assert.deepEqual(readProjectInstallationManifest(root, { ...options(), allowPrevious: true }), previous);

    for (const mixed of [
      { ...previous, integrationVersion: INSTALLATION_INTEGRATION_VERSION },
      { ...previous, ownershipVersion: INSTALLATION_OWNERSHIP_VERSION }
    ]) {
      fs.writeFileSync(path.join(root, INSTALLATION_MANIFEST_PATH), `${JSON.stringify(mixed, null, 2)}\n`);
      assert.throws(
        () => readProjectInstallationManifest(root, { ...options(), allowPrevious: true }),
        /integrationVersion\/ownershipVersion/u
      );
    }
  } finally {
    cleanupTempRoot(root);
  }
});

test("project installation manifest reads a strict round trip", () => {
  const root = createTempRoot("dove-install-manifest-roundtrip-");
  try {
    const manifest = createProjectInstallationManifest(manifestInput(), options());
    fs.mkdirSync(path.join(root, ".dove-install"));
    fs.writeFileSync(path.join(root, INSTALLATION_MANIFEST_PATH), serializeProjectInstallationManifest(manifest, options()));
    assert.deepEqual(readProjectInstallationManifest(root, options()), manifest);
  } finally {
    cleanupTempRoot(root);
  }
});
