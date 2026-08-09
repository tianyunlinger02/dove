import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PROJECT_HOST_IDS } from "../../src/core/host-registry.mjs";
import {
  INSTALLATION_MANIFEST_PATH,
  LEGACY_INSTALLATION_MANIFEST_PATH,
  createProjectInstallationManifest,
  serializeProjectInstallationManifest
} from "../../src/core/project-installation-manifest.mjs";
import {
  inspectProjectRoot,
  resolveInstalledProjectRoot,
  resolveProjectRootForInit,
  resolveProjectRootForSetup
} from "../../src/core/project-root.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

const OPTIONS = { hostIds: PROJECT_HOST_IDS };

function writeManifest(root) {
  const manifest = createProjectInstallationManifest({
    installationId: "installation-123e4567-e89b-42d3-a456-426614174000",
    package: { name: "@dove-research/cli", version: "0.5.0" },
    hosts: ["claude"],
    managed: [],
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z"
  }, OPTIONS);
  fs.mkdirSync(path.join(root, path.posix.dirname(INSTALLATION_MANIFEST_PATH)), { recursive: true });
  fs.writeFileSync(path.join(root, INSTALLATION_MANIFEST_PATH), serializeProjectInstallationManifest(manifest, OPTIONS));
}

test("init resolver canonicalizes explicit projects and rejects nested installations", () => {
  const root = createTempRoot("dove-project-root-init-");
  try {
    const child = path.join(root, "child");
    fs.mkdirSync(child);
    assert.equal(resolveProjectRootForInit(child, OPTIONS), fs.realpathSync.native(child));
    writeManifest(root);
    assert.throws(() => resolveProjectRootForInit(child, OPTIONS), /Refusing nested Dove project initialization/u);
    assert.throws(() => resolveProjectRootForInit(root, OPTIONS), /already initialized/u);
    assert.throws(() => resolveProjectRootForInit(path.join(root, "missing"), OPTIONS), /existing directory/u);
  } finally {
    cleanupTempRoot(root);
  }
});

test("implicit init fails closed from a Git root subdirectory", () => {
  const root = createTempRoot("dove-project-root-git-");
  try {
    fs.mkdirSync(path.join(root, ".git"));
    const child = path.join(root, "packages", "paper");
    fs.mkdirSync(child, { recursive: true });
    assert.throws(() => resolveProjectRootForInit(undefined, { ...OPTIONS, cwd: child }), /Run dove init from the Git root/u);
    assert.equal(resolveProjectRootForInit(root, OPTIONS), fs.realpathSync.native(root));
  } finally {
    cleanupTempRoot(root);
  }
});

test("implicit init recognizes Git worktree .git files", () => {
  const root = createTempRoot("dove-project-root-worktree-");
  try {
    fs.writeFileSync(path.join(root, ".git"), "gitdir: /some/worktree/gitdir\n");
    const child = path.join(root, "nested");
    fs.mkdirSync(child);
    assert.throws(() => resolveProjectRootForInit(undefined, { ...OPTIONS, cwd: child }), /Git root/u);
  } finally {
    cleanupTempRoot(root);
  }
});

test("setup resolver selects the nearest installation marker or Git root without trusting a manifest", () => {
  const root = createTempRoot("dove-project-root-setup-");
  try {
    fs.mkdirSync(path.join(root, ".git"));
    const nested = path.join(root, "docs", "nested");
    fs.mkdirSync(nested, { recursive: true });
    assert.equal(resolveProjectRootForSetup(nested), fs.realpathSync.native(root));

    const inner = path.join(root, "packages", "paper");
    fs.mkdirSync(path.join(inner, path.posix.dirname(INSTALLATION_MANIFEST_PATH)), { recursive: true });
    fs.writeFileSync(path.join(inner, INSTALLATION_MANIFEST_PATH), "not valid JSON\n", "utf8");
    const innerNested = path.join(inner, "drafts");
    fs.mkdirSync(innerNested);
    assert.equal(resolveProjectRootForSetup(innerNested), fs.realpathSync.native(inner));
  } finally {
    cleanupTempRoot(root);
  }
});

test("setup resolver finds a legacy marker from a nested directory without granting runtime authority", () => {
  const root = createTempRoot("dove-project-root-legacy-setup-");
  try {
    const nested = path.join(root, "drafts", "nested");
    fs.mkdirSync(nested, { recursive: true });
    fs.mkdirSync(path.join(root, path.posix.dirname(LEGACY_INSTALLATION_MANIFEST_PATH)), { recursive: true });
    fs.writeFileSync(path.join(root, LEGACY_INSTALLATION_MANIFEST_PATH), "{malformed legacy marker\n", "utf8");
    assert.equal(resolveProjectRootForSetup(nested), fs.realpathSync.native(root));
    assert.throws(() => resolveInstalledProjectRoot(nested), /Run 'dove init'/u);
    assert.throws(() => resolveProjectRootForInit(root, OPTIONS), /legacy project installation.*dove upgrade/iu);
  } finally {
    cleanupTempRoot(root);
  }
});

test("installed resolver searches upward and defaults manifest host inventory", () => {
  const root = createTempRoot("dove-project-root-installed-");
  try {
    writeManifest(root);
    const nested = path.join(root, "docs", "nested");
    fs.mkdirSync(nested, { recursive: true });
    assert.equal(resolveInstalledProjectRoot(nested), fs.realpathSync.native(root));
    assert.deepEqual(inspectProjectRoot(nested), {
      state: "initialized",
      initialized: true,
      start: fs.realpathSync.native(nested),
      root: fs.realpathSync.native(root),
      error: null
    });
  } finally {
    cleanupTempRoot(root);
  }
});

test("installed resolver ignores an inner install-directory residue without a current marker", () => {
  const root = createTempRoot("dove-project-root-inner-residue-");
  try {
    writeManifest(root);
    const inner = path.join(root, "packages", "inner");
    fs.mkdirSync(path.join(inner, path.posix.dirname(INSTALLATION_MANIFEST_PATH)), { recursive: true });
    assert.equal(resolveInstalledProjectRoot(inner), fs.realpathSync.native(root));
    assert.throws(() => resolveProjectRootForInit(inner), /incomplete.*manifest\.json is missing/iu);
    const inspected = inspectProjectRoot(inner);
    assert.equal(inspected.state, "initialized");
    assert.equal(inspected.root, fs.realpathSync.native(root));
  } finally {
    cleanupTempRoot(root);
  }
});

test("installed resolver rejects symlink marker and inspection reports uninitialized without throwing", () => {
  const root = createTempRoot("dove-project-root-symlink-");
  const outside = createTempRoot("dove-project-root-symlink-outside-");
  try {
    fs.mkdirSync(path.join(root, path.posix.dirname(INSTALLATION_MANIFEST_PATH)), { recursive: true });
    fs.writeFileSync(path.join(outside, "manifest.json"), "{}\n");
    fs.symlinkSync(path.join(outside, "manifest.json"), path.join(root, INSTALLATION_MANIFEST_PATH));
    assert.throws(() => resolveInstalledProjectRoot(root), /must not be a symbolic link/u);
  } finally {
    cleanupTempRoot(root);
    cleanupTempRoot(outside);
  }

  const absent = createTempRoot("dove-project-root-absent-");
  try {
    assert.throws(() => resolveInstalledProjectRoot(absent), /Run 'dove init'/u);
    const inspected = inspectProjectRoot(absent);
    assert.equal(inspected.state, "uninitialized");
    assert.equal(inspected.initialized, false);
    assert.match(inspected.error, /Run 'dove init'/u);
  } finally {
    cleanupTempRoot(absent);
  }
});
