import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { renderDoveHome } from "../../src/cli/terminal-output.mjs";
import { DOVE_CLAUDE_AMBIENT_HOOK_ENTRY } from "../../src/core/ambient-policy.mjs";
import { inspectProjectDoctor } from "../../src/core/project-doctor.mjs";
import {
  completeReinstallProjectIntegration,
  initializeProjectIntegration,
  inspectProjectIntegration,
  previewProjectCompleteReinstall,
  previewProjectUpgrade,
  syncProjectIntegration,
  upgradeProjectIntegration
} from "../../src/core/project-installation.mjs";
import {
  INSTALLATION_MANIFEST_PATH,
  LEGACY_INSTALLATION_MANIFEST_PATH
} from "../../src/core/project-installation-manifest.mjs";
import {
  PREVIOUS_CLAUDE_INIT_CONTENT,
  PREVIOUS_CLAUDE_INIT_DIGEST,
  PREVIOUS_CLAUDE_INIT_PATH
} from "../helpers/previous-project-installation.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

const PACKAGE = { packageName: "dove", packageVersion: "2.0.0" };
const PREVIOUS_PACKAGE_VERSION = "1.0.0";
const NEXT_PACKAGE_VERSION = "2.0.1";
const INIT_NOW = "2026-07-26T01:00:00.000Z";
const SYNC_NOW = "2026-07-26T02:00:00.000Z";
const LATER_NOW = "2026-07-26T03:00:00.000Z";

function write(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

function initialize(root, overrides = {}) {
  return initializeProjectIntegration(root, { hosts: ["claude"], ...PACKAGE, now: INIT_NOW, ...overrides });
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function compareManaged(left, right) {
  return left.path.localeCompare(right.path)
    || left.kind.localeCompare(right.kind)
    || String(left.selector ?? "").localeCompare(String(right.selector ?? ""));
}

function createRevisionOneInstallation(root, { managed = [], manifestPath = LEGACY_INSTALLATION_MANIFEST_PATH } = {}) {
  initialize(root, { packageVersion: PREVIOUS_PACKAGE_VERSION });
  const current = readJson(root, INSTALLATION_MANIFEST_PATH);
  const previous = {
    ...current,
    revision: "1.0",
    managed: [...current.managed, ...managed].sort(compareManaged)
  };
  write(root, manifestPath, `${JSON.stringify(previous, null, 2)}\n`);
  if (manifestPath !== INSTALLATION_MANIFEST_PATH) {
    fs.rmSync(path.join(root, path.posix.dirname(INSTALLATION_MANIFEST_PATH)), { recursive: true, force: true });
  }
  return previous;
}

function writeReleasedRevisionOneInstallation(root) {
  const manifest = {
    schemaVersion: 1,
    integrationVersion: 4,
    ownershipVersion: 4,
    installationId: "installation-123e4567-e89b-42d3-a456-426614174000",
    package: { name: "dove", version: PREVIOUS_PACKAGE_VERSION },
    runtime: { mode: "user-cli", protocolVersion: 3 },
    hosts: ["claude"],
    managed: [{
      path: PREVIOUS_CLAUDE_INIT_PATH,
      owner: `host:claude:file:${PREVIOUS_CLAUDE_INIT_PATH}`,
      mode: "exclusive-file",
      selector: null,
      digest: PREVIOUS_CLAUDE_INIT_DIGEST
    }],
    createdAt: INIT_NOW,
    updatedAt: INIT_NOW
  };
  write(root, PREVIOUS_CLAUDE_INIT_PATH, PREVIOUS_CLAUDE_INIT_CONTENT);
  write(root, INSTALLATION_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

test("project integration init creates a current 2.0 Claude installation", () => {
  const root = createTempRoot("dove-project-integration-init-");
  try {
    const result = initialize(root);

    assert.equal(result.status, "initialized");
    assert.equal(result.target, fs.realpathSync.native(root));
    assert.deepEqual(result.hosts, ["claude"]);
    assert.equal(result.manifest.revision, "2.0");
    assert.deepEqual(result.manifest.package, { name: "dove", version: "2.0.0" });
    assert.deepEqual(readJson(root, ".claude/settings.json").hooks.UserPromptSubmit, [DOVE_CLAUDE_AMBIENT_HOOK_ENTRY]);
    for (const relativePath of [
      ".claude/commands/dove/research.md",
      ".claude/commands/dove/status.md",
      ".claude/commands/dove/auto.md",
      ".claude/rules/dove.md",
      ".claude/skills/dove-intake/SKILL.md",
      ".claude/skills/dove-lessons-intake/SKILL.md",
      ".claude/agents/dove-reviewer.md"
    ]) {
      assert.equal(fs.existsSync(path.join(root, relativePath)), true, relativePath);
    }
    for (const relativePath of [
      ".mcp.json",
      ".claude/settings.local.json",
      "bin/dove-package.mjs",
      "dist/index.mjs",
      "mcp/dove-state-server-package.mjs",
      "scripts/dove-user-prompt-submit-package.mjs",
      ".dove-install"
    ]) {
      assert.equal(fs.existsSync(path.join(root, relativePath)), false, relativePath);
    }
    assert.deepEqual(fs.readdirSync(path.join(root, ".dove")), ["install"]);
    assert.equal(inspectProjectIntegration(root, { now: LATER_NOW }).status, "current");

    const manifestBefore = fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH));
    assert.throws(() => initialize(root, { now: LATER_NOW }), /already initialized.*sync instead/iu);
    assert.deepEqual(fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH)), manifestBefore);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration preserves unrelated shared JSON and local MCP decisions", () => {
  const root = createTempRoot("dove-project-integration-shared-json-");
  try {
    const mcpBytes = `${JSON.stringify({ metadata: { keep: true }, mcpServers: { other: { command: "other", args: ["--keep"] } } }, null, 2)}\n`;
    const localSettingsBytes = `${JSON.stringify({
      permissions: { allow: ["Read"] },
      enabledMcpjsonServers: ["other"],
      disabledMcpjsonServers: ["dove"]
    }, null, 2)}\n`;
    write(root, ".mcp.json", mcpBytes);
    write(root, ".claude/settings.json", `${JSON.stringify({
      theme: "dark",
      hooks: {
        SessionStart: [{ hooks: [{ type: "command", command: "keep-session" }] }],
        UserPromptSubmit: [{ matcher: "keep", hooks: [{ type: "command", command: "keep-prompt" }] }]
      }
    }, null, 2)}\n`);
    write(root, ".claude/settings.local.json", localSettingsBytes);

    initialize(root);

    assert.equal(fs.readFileSync(path.join(root, ".mcp.json"), "utf8"), mcpBytes);
    assert.equal(fs.readFileSync(path.join(root, ".claude/settings.local.json"), "utf8"), localSettingsBytes);
    const settings = readJson(root, ".claude/settings.json");
    assert.equal(settings.theme, "dark");
    assert.equal(settings.hooks.SessionStart[0].hooks[0].command, "keep-session");
    assert.equal(settings.hooks.UserPromptSubmit[0].matcher, "keep");
    assert.deepEqual(settings.hooks.UserPromptSubmit[1], DOVE_CLAUDE_AMBIENT_HOOK_ENTRY);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration inspection is zero-write across current and needs-sync states", () => {
  const root = createTempRoot("dove-project-integration-needs-sync-");
  try {
    initialize(root);
    write(root, ".dove/workspace.json", "{\"keep\":true}\r\n");
    const researchBefore = fs.readFileSync(path.join(root, ".dove/workspace.json"));
    const manifestBefore = fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH));

    const current = inspectProjectIntegration(root, { now: LATER_NOW });
    assert.equal(current.status, "current");
    assert.deepEqual(current.changedPaths, []);

    const needsSync = inspectProjectIntegration(root, { packageVersion: NEXT_PACKAGE_VERSION, now: SYNC_NOW });
    assert.equal(needsSync.status, "needs-sync");
    assert.deepEqual(needsSync.writtenPaths, [INSTALLATION_MANIFEST_PATH]);
    assert.deepEqual(needsSync.removedPaths, []);
    assert.deepEqual(fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH)), manifestBefore);

    const synchronized = syncProjectIntegration(root, { packageVersion: NEXT_PACKAGE_VERSION, now: SYNC_NOW });
    assert.equal(synchronized.status, "synchronized");
    assert.deepEqual(synchronized.changedPaths, [INSTALLATION_MANIFEST_PATH]);
    assert.equal(synchronized.manifest.package.version, NEXT_PACKAGE_VERSION);
    assert.equal(inspectProjectIntegration(root, { now: LATER_NOW }).status, "current");

    const synchronizedManifest = fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH));
    const unchanged = syncProjectIntegration(root, { now: LATER_NOW });
    assert.equal(unchanged.status, "unchanged");
    assert.deepEqual(unchanged.changedPaths, []);
    assert.deepEqual(fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH)), synchronizedManifest);
    assert.deepEqual(fs.readFileSync(path.join(root, ".dove/workspace.json")), researchBefore);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration never overwrites modified managed bytes", () => {
  const root = createTempRoot("dove-project-integration-user-bytes-");
  try {
    initialize(root);
    const managedPath = ".claude/commands/dove/status.md";
    const userBytes = Buffer.from([0, 255, 1, 128, 10]);
    write(root, managedPath, userBytes);
    const manifestBefore = fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH));

    assert.throws(() => syncProjectIntegration(root, { now: SYNC_NOW }), /ownership drift.*status\.md/iu);
    assert.deepEqual(fs.readFileSync(path.join(root, managedPath)), userBytes);
    assert.deepEqual(fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH)), manifestBefore);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration rejects symlinked managed files and parents without touching targets", () => {
  const outside = createTempRoot("dove-project-integration-symlink-outside-");
  try {
    for (const mode of ["file", "parent"]) {
      const root = createTempRoot(`dove-project-integration-symlink-${mode}-`);
      try {
        if (mode === "file") {
          write(outside, "settings.json", "{\"outside\":true}\n");
          fs.mkdirSync(path.join(root, ".claude"), { recursive: true });
          fs.symlinkSync(path.join(outside, "settings.json"), path.join(root, ".claude/settings.json"));
        } else {
          write(outside, "claude/keep.txt", "outside parent bytes\n");
          fs.symlinkSync(path.join(outside, "claude"), path.join(root, ".claude"));
        }

        assert.throws(() => initialize(root), /must not be a symbolic link/u);
        assert.equal(fs.existsSync(path.join(root, INSTALLATION_MANIFEST_PATH)), false);
        const outsidePath = mode === "file" ? "settings.json" : "claude/keep.txt";
        const expected = mode === "file" ? "{\"outside\":true}\n" : "outside parent bytes\n";
        assert.equal(fs.readFileSync(path.join(outside, outsidePath), "utf8"), expected);
      } finally {
        cleanupTempRoot(root);
      }
    }
  } finally {
    cleanupTempRoot(outside);
  }
});

test("project Upgrade performs the explicit 1.0 to 2.0 migration and preserves research bytes", () => {
  const root = createTempRoot("dove-project-upgrade-1-to-2-");
  try {
    write(root, ".claude/settings.json", `${JSON.stringify({
      theme: "dark",
      hooks: { UserPromptSubmit: [{ matcher: "keep", hooks: [{ type: "command", command: "keep-prompt" }] }] }
    }, null, 2)}\n`);
    createRevisionOneInstallation(root, {
      managed: [{
        path: PREVIOUS_CLAUDE_INIT_PATH,
        kind: "exclusive-file",
        selector: null,
        digest: PREVIOUS_CLAUDE_INIT_DIGEST
      }]
    });
    write(root, PREVIOUS_CLAUDE_INIT_PATH, PREVIOUS_CLAUDE_INIT_CONTENT);
    write(root, ".mcp.json", `${JSON.stringify({
      metadata: { keep: true },
      mcpServers: {
        other: { command: "keep" },
        dove: { type: "stdio", command: "dove", args: ["mcp", "serve", "--project", "."] }
      }
    }, null, 2)}\n`);
    write(root, ".claude/settings.local.json", `${JSON.stringify({
      permissions: { allow: ["Read"] },
      enabledMcpjsonServers: ["other", "dove"]
    }, null, 2)}\n`);
    write(root, ".dove/format.json", "{\"format\":\"dove-research-v1\"}\r\n");
    write(root, ".dove/workspace.json", "{\"keep\":true}\n");
    write(root, ".dove/missions/result.bin", Buffer.from([0, 255, 1, 128]));
    write(root, "ordinary.txt", "keep ordinary\n");
    const preserved = new Map([
      [".dove/format.json", fs.readFileSync(path.join(root, ".dove/format.json"))],
      [".dove/workspace.json", fs.readFileSync(path.join(root, ".dove/workspace.json"))],
      [".dove/missions/result.bin", fs.readFileSync(path.join(root, ".dove/missions/result.bin"))]
    ]);

    const preview = previewProjectUpgrade(root, { ...PACKAGE, now: SYNC_NOW });
    assert.equal(preview.status, "ready");
    assert.equal(preview.action, "upgrade");
    assert.deepEqual(preview.confirmation, { required: false, default: false });
    for (const relativePath of [PREVIOUS_CLAUDE_INIT_PATH, LEGACY_INSTALLATION_MANIFEST_PATH, ".dove-install"]) {
      assert.equal(preview.removedPaths.includes(relativePath), true, relativePath);
    }
    for (const relativePath of preserved.keys()) {
      assert.equal(preview.changedPaths.includes(relativePath), false, relativePath);
    }

    const result = upgradeProjectIntegration(root, { ...PACKAGE, now: SYNC_NOW, preview });
    assert.equal(result.status, "upgraded");
    assert.equal(result.manifest.revision, "2.0");
    assert.equal(result.manifest.package.version, PACKAGE.packageVersion);
    assert.equal(fs.existsSync(path.join(root, ".dove-install")), false);
    assert.equal(fs.existsSync(path.join(root, PREVIOUS_CLAUDE_INIT_PATH)), false);
    for (const [relativePath, bytes] of preserved) {
      assert.deepEqual(fs.readFileSync(path.join(root, relativePath)), bytes, relativePath);
    }
    assert.equal(fs.readFileSync(path.join(root, "ordinary.txt"), "utf8"), "keep ordinary\n");
    assert.deepEqual(readJson(root, ".mcp.json"), {
      metadata: { keep: true },
      mcpServers: { other: { command: "keep" } }
    });
    assert.deepEqual(readJson(root, ".claude/settings.local.json"), {
      permissions: { allow: ["Read"] },
      enabledMcpjsonServers: ["other"]
    });
    const settings = readJson(root, ".claude/settings.json");
    assert.equal(settings.theme, "dark");
    assert.equal(settings.hooks.UserPromptSubmit[0].matcher, "keep");
    assert.deepEqual(settings.hooks.UserPromptSubmit[1], DOVE_CLAUDE_AMBIENT_HOOK_ENTRY);
    assert.equal(inspectProjectIntegration(root, PACKAGE).status, "current");
  } finally {
    cleanupTempRoot(root);
  }
});

test("project Upgrade cleans exact retired OpenCode server fragments and preserves unrelated JSON", () => {
  for (const mode of ["only-dove", "mixed", "ambiguous"]) {
    const root = createTempRoot(`dove-project-upgrade-opencode-${mode}-`);
    try {
      createRevisionOneInstallation(root);
      const dove = mode === "ambiguous"
        ? { type: "stdio", command: "other", args: ["--keep"] }
        : { type: "stdio", command: "dove", args: ["mcp", "serve", "--project", "."] };
      const config = mode === "mixed"
        ? { metadata: { keep: true }, mcpServers: { other: { command: "keep" }, dove } }
        : { mcpServers: { dove } };
      write(root, ".opencode.json", `${JSON.stringify(config, null, 2)}\n`);

      if (mode === "ambiguous") {
        const before = fs.readFileSync(path.join(root, ".opencode.json"));
        assert.throws(
          () => previewProjectUpgrade(root, { ...PACKAGE, now: SYNC_NOW }),
          /ambiguous non-Dove fragment.*mcpServers\/dove/iu
        );
        assert.deepEqual(fs.readFileSync(path.join(root, ".opencode.json")), before);
        continue;
      }

      const preview = previewProjectUpgrade(root, { ...PACKAGE, now: SYNC_NOW });
      const result = upgradeProjectIntegration(root, { ...PACKAGE, now: SYNC_NOW, preview });
      assert.equal(result.status, "upgraded");
      if (mode === "only-dove") {
        assert.equal(fs.existsSync(path.join(root, ".opencode.json")), false);
      } else {
        assert.deepEqual(readJson(root, ".opencode.json"), {
          metadata: { keep: true },
          mcpServers: { other: { command: "keep" } }
        });
      }
    } finally {
      cleanupTempRoot(root);
    }
  }
});

test("Doctor recognizes the released current-path 1.0 manifest without granting runtime authority", () => {
  const root = createTempRoot("dove-project-current-path-1x-");
  try {
    writeReleasedRevisionOneInstallation(root);
    write(root, ".dove/workspace.json", "{\"keep\":true}\r\n");
    const manifestBefore = fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH));
    const researchBefore = fs.readFileSync(path.join(root, ".dove/workspace.json"));

    const doctor = inspectProjectDoctor(root, {
      ...PACKAGE,
      packageRoot: path.resolve(path.dirname(new URL(import.meta.url).pathname), "../.."),
      executablePath: path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../bin/dove.mjs"),
      inspectPathExecutable: () => ({ found: true, usable: true, path: "/usr/local/bin/dove", state: "found" }),
      inspectUserMcpRegistration: () => ({ state: "current", exact: true, registration: null })
    });

    assert.equal(doctor.projectIntegration.state, "invalid");
    assert.equal(doctor.migrationInstallation.state, "valid-legacy");
    assert.equal(doctor.migrationInstallation.markerPath, INSTALLATION_MANIFEST_PATH);
    assert.equal(doctor.migrationInstallation.manifest.revision, "1.0");
    assert.equal(doctor.migrationInstallation.upgrade.ready, true);
    assert.equal(Object.hasOwn(doctor, "projectEligibility"), false);
    assert.equal(Object.hasOwn(doctor, "connection"), false);
    assert.equal(Object.hasOwn(doctor, "userMcpRegistration"), false);
    assert.deepEqual(doctor.actions[0], { kind: "upgrade", command: "dove upgrade" });
    assert.match(renderDoveHome({ stream: { isTTY: false }, env: {}, state: "upgrade" }), /dove upgrade/u);
    assert.throws(() => syncProjectIntegration(root, { now: SYNC_NOW }), /Invalid Dove project installation manifest|does not accept unknown fields/iu);
    assert.deepEqual(fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH)), manifestBefore);
    assert.deepEqual(fs.readFileSync(path.join(root, ".dove/workspace.json")), researchBefore);

    const upgraded = upgradeProjectIntegration(root, { ...PACKAGE, now: SYNC_NOW, preview: doctor.migrationInstallation.upgrade.preview });
    assert.equal(upgraded.status, "upgraded");
    assert.equal(readJson(root, INSTALLATION_MANIFEST_PATH).revision, "2.0");
    assert.deepEqual(fs.readFileSync(path.join(root, ".dove/workspace.json")), researchBefore);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project Upgrade deletes retired files only with affirmative evidence", () => {
  const root = createTempRoot("dove-project-upgrade-retired-user-bytes-");
  try {
    createRevisionOneInstallation(root);
    const userBytes = Buffer.from("user-authored command at a retired Dove path\n");
    write(root, PREVIOUS_CLAUDE_INIT_PATH, userBytes);
    const manifestBefore = fs.readFileSync(path.join(root, LEGACY_INSTALLATION_MANIFEST_PATH));

    assert.throws(
      () => previewProjectUpgrade(root, { ...PACKAGE, now: SYNC_NOW }),
      /refuses to remove retired file with unrecognized content.*init\.md/iu
    );
    assert.deepEqual(fs.readFileSync(path.join(root, PREVIOUS_CLAUDE_INIT_PATH)), userBytes);
    assert.deepEqual(fs.readFileSync(path.join(root, LEGACY_INSTALLATION_MANIFEST_PATH)), manifestBefore);
    assert.equal(fs.existsSync(path.join(root, INSTALLATION_MANIFEST_PATH)), false);
  } finally {
    cleanupTempRoot(root);
  }
});

test("Complete Reinstall deletes Dove research and legacy lifecycle roots only after confirmation", () => {
  const root = createTempRoot("dove-project-complete-reinstall-");
  try {
    initialize(root);
    write(root, ".dove/format.json", "{\"format\":\"dove-research-v1\"}\n");
    write(root, ".dove/workspace.json", "{\"delete\":true}\n");
    write(root, ".dove/missions/result.bin", Buffer.from([0, 255, 1, 128]));
    write(root, ".dove/install/doctor.json", "{\"enabled\":false}\n");
    write(root, ".dove/install/transactions/residue/private.json", "{\"delete\":true}\n");
    write(root, ".dove-archive/existing/private.json", "{\"delete\":true}\n");
    write(root, ".dove-install/leftover.txt", "delete legacy lifecycle bytes\n");
    write(root, "paper.md", "keep paper\n");
    const mcpBytes = `${JSON.stringify({ keep: true, mcpServers: { other: { command: "keep" } } }, null, 2)}\n`;
    write(root, ".mcp.json", mcpBytes);

    const preview = previewProjectCompleteReinstall(root, { ...PACKAGE, now: SYNC_NOW });
    assert.equal(preview.status, "ready");
    assert.equal(preview.action, "reinstall");
    assert.deepEqual(preview.confirmation, { required: true, default: false });
    for (const relativePath of [
      ".dove/format.json",
      ".dove/workspace.json",
      ".dove/missions/result.bin",
      ".dove/install/doctor.json",
      ".dove/install/transactions/residue/private.json",
      ".dove-archive/existing/private.json",
      ".dove-install/leftover.txt"
    ]) {
      assert.equal(preview.removedPaths.includes(relativePath), true, relativePath);
    }

    assert.throws(
      () => completeReinstallProjectIntegration(root, { ...PACKAGE, now: SYNC_NOW, preview }),
      /confirmed: true/u
    );
    const result = completeReinstallProjectIntegration(root, {
      ...PACKAGE,
      now: SYNC_NOW,
      confirmed: true,
      preview
    });

    assert.equal(result.status, "reinstalled");
    assert.deepEqual(fs.readdirSync(path.join(root, ".dove")), ["install"]);
    assert.deepEqual(fs.readdirSync(path.join(root, ".dove/install")), ["manifest.json"]);
    assert.equal(readJson(root, INSTALLATION_MANIFEST_PATH).revision, "2.0");
    assert.equal(fs.existsSync(path.join(root, ".dove-archive")), false);
    assert.equal(fs.existsSync(path.join(root, ".dove-install")), false);
    assert.equal(fs.readFileSync(path.join(root, "paper.md"), "utf8"), "keep paper\n");
    assert.equal(fs.readFileSync(path.join(root, ".mcp.json"), "utf8"), mcpBytes);
    assert.equal(inspectProjectIntegration(root, { now: LATER_NOW }).status, "current");
  } finally {
    cleanupTempRoot(root);
  }
});

test("Complete Reinstall rejects symlinks in destructive state without touching targets", () => {
  const root = createTempRoot("dove-project-reinstall-symlink-");
  const outside = createTempRoot("dove-project-reinstall-symlink-outside-");
  try {
    initialize(root);
    write(outside, "archive/private.json", "outside archive bytes\n");
    fs.symlinkSync(path.join(outside, "archive"), path.join(root, ".dove-archive"));
    const manifestBefore = fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH));

    assert.throws(
      () => previewProjectCompleteReinstall(root, { ...PACKAGE, now: SYNC_NOW }),
      /refuses symbolic links in destructive scope.*\.dove-archive/iu
    );
    assert.equal(fs.readFileSync(path.join(outside, "archive/private.json"), "utf8"), "outside archive bytes\n");
    assert.deepEqual(fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH)), manifestBefore);
  } finally {
    cleanupTempRoot(root);
    cleanupTempRoot(outside);
  }
});
