import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PROJECT_HOST_IDS } from "../../src/core/host-registry.mjs";
import {
  INSTALLATION_MANIFEST_PATH,
  INSTALLATION_MANIFEST_REVISION,
  PREVIOUS_INSTALLATION_MANIFEST_REVISION,
  createProjectInstallationManifest,
  readProjectInstallationManifest,
  readProjectInstallationManifestForMigration,
  serializeProjectInstallationManifest,
  validateProjectInstallationManifest
} from "../../src/core/project-installation-manifest.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);
const NOW = "2026-07-26T00:00:00.000Z";

function options() {
  return { hostIds: PROJECT_HOST_IDS };
}

function input(overrides = {}) {
  return {
    package: { name: "dove", version: "1.0.0" },
    hosts: ["claude"],
    managed: [
      { path: ".claude/rules/dove.md", kind: "exclusive-file", selector: null, digest: DIGEST_A },
      { path: ".claude/settings.json", kind: "json-fragment", selector: "/hooks/UserPromptSubmit[dove-user-prompt-submit]", digest: DIGEST_B }
    ],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

test("installation manifest 2.0 has one revision and byte-protection entries", () => {
  const manifest = createProjectInstallationManifest(input({
    hosts: ["claude", "claude"],
    managed: [...input().managed].reverse()
  }), options());
  assert.equal(manifest.revision, INSTALLATION_MANIFEST_REVISION);
  assert.equal(manifest.revision, "2.0");
  assert.deepEqual(manifest.hosts, ["claude"]);
  assert.deepEqual(manifest.managed.map((entry) => entry.path), [".claude/rules/dove.md", ".claude/settings.json"]);
  assert.deepEqual(Object.keys(manifest.managed[0]).sort(), ["digest", "kind", "path", "selector"]);
  for (const retired of ["installationId", "integrationVersion", "ownershipVersion", "schemaVersion"]) assert.equal(Object.hasOwn(manifest, retired), false);
  assert.equal(Object.hasOwn(manifest.runtime, "protocolVersion"), false);
  assert.equal(Object.isFrozen(manifest), false);
  assert.equal(serializeProjectInstallationManifest(manifest, options()).endsWith("\n"), true);
});

test("manifest validation protects paths, selectors, digests, and rejects unknown fields", () => {
  for (const managedPath of [".dove", ".dove/manifest.json", "/absolute/file", "C:\\absolute\\file", ".claude\\rules\\dove.md"]) {
    assert.throws(() => createProjectInstallationManifest(input({ managed: [{ path: managedPath, kind: "exclusive-file", selector: null, digest: DIGEST_A }] }), options()), /project-relative|research or installation state|canonical/u);
  }
  assert.throws(() => createProjectInstallationManifest(input({ managed: [{ path: "owned.md", kind: "exclusive-file", selector: "x", digest: DIGEST_A }] }), options()), /selector must be null/u);
  assert.throws(() => createProjectInstallationManifest(input({ managed: [{ path: "owned.json", kind: "json-fragment", selector: null, digest: DIGEST_A }] }), options()), /selector must be a non-empty/u);
  const manifest = createProjectInstallationManifest(input(), options());
  assert.throws(() => validateProjectInstallationManifest({ ...manifest, extra: true }, options()), /unknown fields/u);
});

test("ordinary reader accepts only revision 2.0 and explicit migration reads 1.0", () => {
  const root = createTempRoot("dove-install-manifest-revisions-");
  try {
    const current = createProjectInstallationManifest(input(), options());
    fs.mkdirSync(path.join(root, path.posix.dirname(INSTALLATION_MANIFEST_PATH)), { recursive: true });
    fs.writeFileSync(path.join(root, INSTALLATION_MANIFEST_PATH), serializeProjectInstallationManifest(current, options()));
    assert.deepEqual(readProjectInstallationManifest(root, options()), current);

    const previous = {
      revision: PREVIOUS_INSTALLATION_MANIFEST_REVISION,
      package: current.package,
      runtime: current.runtime,
      hosts: current.hosts,
      managed: current.managed,
      createdAt: current.createdAt,
      updatedAt: current.updatedAt
    };
    fs.writeFileSync(path.join(root, INSTALLATION_MANIFEST_PATH), `${JSON.stringify(previous, null, 2)}\n`);
    assert.throws(() => readProjectInstallationManifest(root, options()), /revision must equal 2\.0/u);
    const migrated = readProjectInstallationManifestForMigration(root, options());
    assert.equal(migrated.revision, "1.0");
    assert.deepEqual(migrated.managed, previous.managed);
  } finally {
    cleanupTempRoot(root);
  }
});

test("manifest reader rejects duplicate keys and symbolic-link manifests", () => {
  const root = createTempRoot("dove-install-manifest-strict-");
  const outside = createTempRoot("dove-install-manifest-outside-");
  try {
    fs.mkdirSync(path.join(root, path.posix.dirname(INSTALLATION_MANIFEST_PATH)), { recursive: true });
    fs.writeFileSync(path.join(root, INSTALLATION_MANIFEST_PATH), '{"revision":"2.0","revision":"2.0"}\n');
    assert.throws(() => readProjectInstallationManifest(root, options()), /duplicate JSON object keys/u);
    fs.rmSync(path.join(root, INSTALLATION_MANIFEST_PATH));
    fs.writeFileSync(path.join(outside, "manifest.json"), "{}\n");
    fs.symlinkSync(path.join(outside, "manifest.json"), path.join(root, INSTALLATION_MANIFEST_PATH));
    assert.throws(() => readProjectInstallationManifest(root, options()), /must not be a symbolic link/u);
  } finally {
    cleanupTempRoot(root);
    cleanupTempRoot(outside);
  }
});
