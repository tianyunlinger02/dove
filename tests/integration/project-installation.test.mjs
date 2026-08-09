import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { commandAdapterPathsForHost } from "../../src/core/command-manifest.mjs";
import {
  completeReinstallProjectIntegration,
  initializeProjectIntegration,
  previewProjectCompleteReinstall,
  PROJECT_INTEGRATION_MANAGED_PATHS,
  syncProjectIntegration
} from "../../src/core/project-installation.mjs";
import { INSTALLATION_MANIFEST_PATH } from "../../src/core/project-installation-manifest.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

const PACKAGE = { packageName: "dove", packageVersion: "0.4.1" };
const INIT_NOW = "2026-07-26T04:00:00.000Z";
const SYNC_NOW = "2026-07-26T05:00:00.000Z";

function write(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

function snapshotPath(target) {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) return { type: "symlink", target: fs.readlinkSync(target) };
  if (stat.isFile()) return { type: "file", bytes: fs.readFileSync(target).toString("base64") };
  if (stat.isDirectory()) {
    return {
      type: "directory",
      children: Object.fromEntries(fs.readdirSync(target).sort().map((name) => [name, snapshotPath(path.join(target, name))]))
    };
  }
  return { type: "other" };
}

function projectSnapshot(root) {
  return snapshotPath(root);
}

test("project integration materializes exactly the Claude adapters, ambient files, shared registrations, and manifest", () => {
  const root = createTempRoot("dove-project-integration-file-set-");
  try {
    initializeProjectIntegration(root, { hosts: ["claude"], ...PACKAGE, now: INIT_NOW });
    const expected = [
      ...commandAdapterPathsForHost("claude"),
      ".claude/rules/dove.md",
      ".claude/skills/dove-intake/SKILL.md",
      ".claude/skills/dove-lessons-intake/SKILL.md",
      ".claude/agents/dove-reviewer.md",
      ".claude/settings.json",
      ".claude/settings.local.json",
      ".mcp.json"
    ].sort();
    assert.deepEqual(PROJECT_INTEGRATION_MANAGED_PATHS, expected);
    for (const relativePath of expected) assert.equal(fs.existsSync(path.join(root, relativePath)), true, relativePath);
    assert.equal(fs.existsSync(path.join(root, INSTALLATION_MANIFEST_PATH)), true);
    for (const forbidden of ["bin", "dist", "mcp", "scripts", ".dove-install"]) {
      assert.equal(fs.existsSync(path.join(root, forbidden)), false, forbidden);
    }
    assert.deepEqual(fs.readdirSync(path.join(root, ".dove")), ["install"]);
    assert.deepEqual(fs.readdirSync(path.join(root, ".dove", "install")), ["manifest.json"]);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration creates install-only state inside the unified .dove root", () => {
  const root = createTempRoot("dove-project-integration-install-separation-");
  try {
    write(root, ".dove-user/data.json", '{"keep":true}\n');
    write(root, ".dove.install-note", "keep note\n");
    initializeProjectIntegration(root, { hosts: ["claude"], ...PACKAGE, now: INIT_NOW });
    syncProjectIntegration(root, { now: SYNC_NOW });
    assert.equal(fs.readFileSync(path.join(root, ".dove-user/data.json"), "utf8"), '{"keep":true}\n');
    assert.equal(fs.readFileSync(path.join(root, ".dove.install-note"), "utf8"), "keep note\n");
    assert.deepEqual(fs.readdirSync(path.join(root, ".dove")), ["install"]);
    assert.deepEqual(fs.readdirSync(path.join(root, ".dove", "install")), ["manifest.json"]);
    assert.equal(fs.existsSync(path.join(root, INSTALLATION_MANIFEST_PATH)), true);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration coexists with existing research state and rejects a symlinked unified root", () => {
  const existingRoot = createTempRoot("dove-project-integration-dove-existing-");
  try {
    write(existingRoot, ".dove/state/private.json", '{"keep":true}\n');
    const before = fs.readFileSync(path.join(existingRoot, ".dove/state/private.json"));
    initializeProjectIntegration(existingRoot, { hosts: ["claude"], ...PACKAGE, now: INIT_NOW });
    syncProjectIntegration(existingRoot, { now: SYNC_NOW });
    assert.deepEqual(fs.readFileSync(path.join(existingRoot, ".dove/state/private.json")), before);
    assert.equal(fs.existsSync(path.join(existingRoot, INSTALLATION_MANIFEST_PATH)), true);
  } finally {
    cleanupTempRoot(existingRoot);
  }

  const outside = createTempRoot("dove-project-integration-dove-outside-");
  const symlinkRoot = createTempRoot("dove-project-integration-dove-symlink-");
  try {
    write(outside, "state/secret.json", '{"secret":true}\n');
    fs.symlinkSync(path.join(outside, "state"), path.join(symlinkRoot, ".dove"));
    assert.throws(
      () => initializeProjectIntegration(symlinkRoot, { hosts: ["claude"], ...PACKAGE, now: INIT_NOW }),
      /installation directory must not be a symbolic link|installation path must be a directory|ENOTDIR/iu
    );
    assert.equal(fs.readFileSync(path.join(outside, "state/secret.json"), "utf8"), '{"secret":true}\n');
  } finally {
    cleanupTempRoot(symlinkRoot);
    cleanupTempRoot(outside);
  }
});

test("project integration rolls back resources and manifest when a later promotion fails", () => {
  const root = createTempRoot("dove-project-integration-rollback-");
  try {
    write(root, "README.md", "keep project\n");
    const before = projectSnapshot(root);
    const fsOps = {
      ...fs,
      renameSync(from, to, metadata) {
        if (metadata?.anchoredTo === INSTALLATION_MANIFEST_PATH) {
          throw new Error("injected manifest promotion failure");
        }
        return fs.renameSync(from, to);
      }
    };
    assert.throws(() => initializeProjectIntegration(root, { hosts: ["claude"], ...PACKAGE, now: INIT_NOW, fsOps }), /all staged changes were rolled back.*injected manifest promotion failure/iu);
    assert.deepEqual(projectSnapshot(root), before);
    assert.equal(fs.readdirSync(root).some((name) => name.startsWith(".dove-file-transaction-")), false);
  } finally {
    cleanupTempRoot(root);
  }
});

test("Complete Reinstall rolls back research deletion when manifest promotion fails", () => {
  const root = createTempRoot("dove-project-complete-reinstall-rollback-");
  try {
    initializeProjectIntegration(root, { hosts: ["claude"], ...PACKAGE, now: INIT_NOW });
    write(root, ".dove/state/private.json", "{\"deleteOnSuccess\":true}\n");
    write(root, ".dove-archive/existing/private.json", "{\"deleteOnSuccess\":true}\n");
    const preview = previewProjectCompleteReinstall(root, { ...PACKAGE, now: SYNC_NOW });
    const before = projectSnapshot(root);
    let injected = false;
    const fsOps = {
      ...fs,
      renameSync(from, to, metadata) {
        if (!injected && metadata?.anchoredTo === INSTALLATION_MANIFEST_PATH) {
          injected = true;
          throw new Error("injected Complete Reinstall manifest failure");
        }
        return fs.renameSync(from, to);
      }
    };

    assert.throws(() => completeReinstallProjectIntegration(root, {
      confirmed: true,
      preview,
      ...PACKAGE,
      now: SYNC_NOW,
      fsOps
    }), /all staged changes were rolled back.*Complete Reinstall manifest failure/iu);
    assert.deepEqual(projectSnapshot(root), before);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration deselection removes owned files and semantic fragments while preserving unrelated JSON", () => {
  const root = createTempRoot("dove-project-integration-deselection-");
  try {
    write(root, ".mcp.json", `${JSON.stringify({ keep: true, mcpServers: { other: { command: "keep" } } }, null, 2)}\n`);
    write(root, ".claude/settings.json", `${JSON.stringify({ theme: "dark", hooks: { UserPromptSubmit: [{ matcher: "keep", hooks: [{ type: "command", command: "keep" }] }] } }, null, 2)}\n`);
    initializeProjectIntegration(root, { hosts: ["claude"], ...PACKAGE, now: INIT_NOW });
    assert.throws(() => syncProjectIntegration(root, { hosts: [], now: SYNC_NOW }), /at least one host/u);
    assert.equal(fs.existsSync(path.join(root, ".claude/commands/dove/status.md")), true);
    const mcp = JSON.parse(fs.readFileSync(path.join(root, ".mcp.json"), "utf8"));
    assert.deepEqual(mcp.mcpServers.other, { command: "keep" });
    const settings = JSON.parse(fs.readFileSync(path.join(root, ".claude/settings.json"), "utf8"));
    assert.equal(settings.theme, "dark");
    assert.equal(settings.hooks.UserPromptSubmit[0].matcher, "keep");
  } finally {
    cleanupTempRoot(root);
  }
});
