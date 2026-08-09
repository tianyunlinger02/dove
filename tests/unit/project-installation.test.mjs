import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DOVE_CLAUDE_AMBIENT_HOOK_ENTRY } from "../../src/core/ambient-policy.mjs";
import { INSTALLED_DOVE_MCP_SERVER } from "../../src/core/command-manifest.mjs";
import { LEGACY_PROJECT_BUNDLE_PROBES } from "../../src/core/project-legacy-installation.mjs";
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
  INSTALLATION_INTEGRATION_VERSION,
  INSTALLATION_MANIFEST_PATH,
  LEGACY_INSTALLATION_MANIFEST_PATH,
  INSTALLATION_OWNERSHIP_VERSION,
  PREVIOUS_INSTALLATION_INTEGRATION_VERSION,
  PREVIOUS_INSTALLATION_OWNERSHIP_VERSION
} from "../../src/core/project-installation-manifest.mjs";
import {
  PREVIOUS_CLAUDE_INIT_CONTENT,
  PREVIOUS_CLAUDE_INIT_DIGEST,
  PREVIOUS_CLAUDE_INIT_PATH
} from "../helpers/previous-project-installation.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

const PACKAGE = { packageName: "dove", packageVersion: "0.4.1" };
const INIT_NOW = "2026-07-26T01:00:00.000Z";
const SYNC_NOW = "2026-07-26T02:00:00.000Z";

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

test("project integration clean init owns only Claude project resources and manifest", () => {
  const root = createTempRoot("dove-project-integration-clean-");
  try {
    const result = initialize(root);
    assert.equal(result.status, "initialized");
    assert.equal(result.target, fs.realpathSync.native(root));
    assert.deepEqual(result.hosts, ["claude"]);
    assert.equal(result.manifest.managed.length, 16);
    assert.equal(result.changedPaths.includes(INSTALLATION_MANIFEST_PATH), true);
    assert.deepEqual(readJson(root, ".mcp.json"), { mcpServers: { dove: INSTALLED_DOVE_MCP_SERVER } });
    assert.deepEqual(readJson(root, ".claude/settings.local.json"), { enabledMcpjsonServers: ["dove"] });
    assert.deepEqual(readJson(root, ".claude/settings.json").hooks.UserPromptSubmit, [DOVE_CLAUDE_AMBIENT_HOOK_ENTRY]);
    assert.equal(fs.existsSync(path.join(root, ".claude/commands/dove/status.md")), true);
    assert.equal(fs.existsSync(path.join(root, ".claude/rules/dove.md")), true);
    assert.equal(fs.existsSync(path.join(root, ".claude/skills/dove-intake/SKILL.md")), true);
    assert.equal(fs.existsSync(path.join(root, ".claude/skills/dove-lessons-intake/SKILL.md")), true);
    const reviewer = fs.readFileSync(path.join(root, ".claude/agents/dove-reviewer.md"), "utf8");
    assert.match(reviewer, /^---\nname: dove-reviewer\n[\s\S]*\ntools: Read\n---/u);
    assert.match(reviewer, /Do not edit files or invoke Dove tools/u);
    for (const relativePath of ["bin/dove-package.mjs", "dist/index.mjs", "mcp/dove-state-server-package.mjs", "scripts/dove-user-prompt-submit-package.mjs", "mcp/dove-claude-project.json", ".dove-install"]) {
      assert.equal(fs.existsSync(path.join(root, relativePath)), false, relativePath);
    }
    assert.deepEqual(fs.readdirSync(path.join(root, ".dove", "install")), ["manifest.json"]);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration preserves unrelated MCP servers and Claude settings", () => {
  const root = createTempRoot("dove-project-integration-shared-json-");
  try {
    write(root, ".mcp.json", `${JSON.stringify({ metadata: { keep: true }, mcpServers: { other: { command: "other", args: ["--keep"] } } }, null, 2)}\n`);
    write(root, ".claude/settings.json", `${JSON.stringify({ theme: "dark", hooks: { SessionStart: [{ hooks: [{ type: "command", command: "keep" }] }], UserPromptSubmit: [{ matcher: "keep", hooks: [{ type: "command", command: "other" }] }] } }, null, 2)}\n`);
    write(root, ".claude/settings.local.json", `${JSON.stringify({ permissions: { allow: ["Read"] }, enabledMcpjsonServers: ["other"] }, null, 2)}\n`);
    initialize(root);
    const mcp = readJson(root, ".mcp.json");
    assert.deepEqual(mcp.metadata, { keep: true });
    assert.deepEqual(mcp.mcpServers.other, { command: "other", args: ["--keep"] });
    assert.deepEqual(mcp.mcpServers.dove, INSTALLED_DOVE_MCP_SERVER);
    const settings = readJson(root, ".claude/settings.json");
    assert.equal(settings.theme, "dark");
    assert.equal(settings.hooks.SessionStart[0].hooks[0].command, "keep");
    assert.equal(settings.hooks.UserPromptSubmit[0].matcher, "keep");
    assert.deepEqual(settings.hooks.UserPromptSubmit[1], DOVE_CLAUDE_AMBIENT_HOOK_ENTRY);
    const localSettings = readJson(root, ".claude/settings.local.json");
    assert.deepEqual(localSettings.permissions, { allow: ["Read"] });
    assert.deepEqual(localSettings.enabledMcpjsonServers, ["other", "dove"]);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration respects an explicit local Dove MCP rejection", () => {
  const root = createTempRoot("dove-project-integration-disabled-mcp-");
  try {
    write(root, ".claude/settings.local.json", `${JSON.stringify({ disabledMcpjsonServers: ["dove"] }, null, 2)}\n`);
    const before = fs.readFileSync(path.join(root, ".claude/settings.local.json"), "utf8");
    assert.throws(() => initialize(root), /explicitly disables.*Dove MCP/iu);
    assert.equal(fs.readFileSync(path.join(root, ".claude/settings.local.json"), "utf8"), before);
    assert.equal(fs.existsSync(path.join(root, INSTALLATION_MANIFEST_PATH)), false);
    assert.equal(fs.existsSync(path.join(root, ".mcp.json")), false);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration init rejects an existing manifest", () => {
  const root = createTempRoot("dove-project-integration-existing-manifest-");
  try {
    initialize(root);
    const before = fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH), "utf8");
    assert.throws(() => initialize(root, { now: SYNC_NOW }), /already initialized.*sync instead/iu);
    assert.equal(fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH), "utf8"), before);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration init rejects conflicting Dove semantic fragments", () => {
  for (const [relativePath, value, expected] of [
    [".mcp.json", { mcpServers: { dove: { command: "other" } } }, /conflicting content.*mcpServers\/dove/iu],
    [".claude/settings.json", { hooks: { UserPromptSubmit: [{ hooks: [{ type: "command", command: "dove hook user-prompt-submit --project . --changed", timeout: 10 }] }] } }, /legacy Dove project installation|conflicting/iu]
  ]) {
    const root = createTempRoot("dove-project-integration-fragment-conflict-");
    try {
      write(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
      const before = fs.readFileSync(path.join(root, relativePath), "utf8");
      assert.throws(() => initialize(root), expected);
      assert.equal(fs.readFileSync(path.join(root, relativePath), "utf8"), before);
      assert.equal(fs.existsSync(path.join(root, INSTALLATION_MANIFEST_PATH)), false);
    } finally {
      cleanupTempRoot(root);
    }
  }
});

test("project integration rejects sync without a manifest and incomplete hosts", () => {
  const root = createTempRoot("dove-project-integration-host-rejection-");
  try {
    assert.throws(() => syncProjectIntegration(root, { ...PACKAGE, now: SYNC_NOW }), /not initialized.*Run 'dove init'/iu);
    assert.throws(() => initializeProjectIntegration(root, { hosts: [], ...PACKAGE, now: INIT_NOW }), /at least one host/u);
    assert.throws(() => initializeProjectIntegration(root, { hosts: ["opencode"], ...PACKAGE, now: INIT_NOW }), /not available.*complete project MCP registration/u);
    assert.throws(() => initializeProjectIntegration(root, { hosts: ["all"], ...PACKAGE, now: INIT_NOW }), /not available.*complete project MCP registration/u);
    assert.equal(fs.readdirSync(root).length, 0);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration claims pre-existing exact resources without rewriting their bytes", () => {
  const source = createTempRoot("dove-project-integration-claim-source-");
  const target = createTempRoot("dove-project-integration-claim-target-");
  try {
    initialize(source);
    for (const relativePath of [
      ".claude/commands/dove/research.md",
      ".claude/commands/dove/status.md",
      ".claude/commands/dove/source.md",
      ".claude/commands/dove/experiment.md",
      ".claude/commands/dove/draft.md",
      ".claude/commands/dove/figure.md",
      ".claude/commands/dove/review.md",
      ".claude/commands/dove/rebuttal.md",
      ".claude/commands/dove/lessons.md",
      ".claude/rules/dove.md",
      ".claude/skills/dove-intake/SKILL.md",
      ".claude/skills/dove-lessons-intake/SKILL.md",
      ".claude/agents/dove-reviewer.md"
    ]) {
      write(target, relativePath, fs.readFileSync(path.join(source, relativePath)));
    }
    const mcpBytes = '{"mcpServers":{"dove":{"args":["mcp","serve","--project","."],"command":"dove","type":"stdio"}},"keep":true}\n';
    write(target, ".mcp.json", mcpBytes);
    const settingsBytes = `${JSON.stringify({ theme: "dark", hooks: { UserPromptSubmit: [DOVE_CLAUDE_AMBIENT_HOOK_ENTRY] } })}\n`;
    write(target, ".claude/settings.json", settingsBytes);
    const localSettingsBytes = `${JSON.stringify({ enabledMcpjsonServers: ["dove"], keep: true })}\n`;
    write(target, ".claude/settings.local.json", localSettingsBytes);
    const result = initialize(target);
    assert.deepEqual(result.changedPaths, [INSTALLATION_MANIFEST_PATH]);
    assert.equal(fs.readFileSync(path.join(target, ".mcp.json"), "utf8"), mcpBytes);
    assert.equal(fs.readFileSync(path.join(target, ".claude/settings.json"), "utf8"), settingsBytes);
    assert.equal(fs.readFileSync(path.join(target, ".claude/settings.local.json"), "utf8"), localSettingsBytes);
  } finally {
    cleanupTempRoot(source);
    cleanupTempRoot(target);
  }
});

test("project integration sync is byte-idempotent and does not refresh updatedAt", () => {
  const root = createTempRoot("dove-project-integration-idempotent-");
  try {
    const initialized = initialize(root);
    const beforeManifest = fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH), "utf8");
    const beforeMcp = fs.readFileSync(path.join(root, ".mcp.json"), "utf8");
    const result = syncProjectIntegration(path.join(root, ".claude", "commands"), { now: SYNC_NOW });
    assert.equal(result.status, "unchanged");
    assert.deepEqual(result.writtenPaths, []);
    assert.deepEqual(result.removedPaths, []);
    assert.deepEqual(result.changedPaths, []);
    assert.equal(result.manifest.updatedAt, initialized.manifest.updatedAt);
    assert.equal(fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH), "utf8"), beforeManifest);
    assert.equal(fs.readFileSync(path.join(root, ".mcp.json"), "utf8"), beforeMcp);
    const inspected = inspectProjectIntegration(root, { now: "2026-07-26T03:00:00.000Z" });
    assert.equal(inspected.status, "current");
    assert.deepEqual(inspected.changedPaths, []);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration migrates a valid previous manifest and retires its owned init command atomically", () => {
  const root = createTempRoot("dove-project-integration-previous-");
  try {
    const initialized = initialize(root);
    const currentManifest = readJson(root, INSTALLATION_MANIFEST_PATH);
    const retiredPath = PREVIOUS_CLAUDE_INIT_PATH;
    write(root, retiredPath, PREVIOUS_CLAUDE_INIT_CONTENT);
    const previous = {
      ...currentManifest,
      integrationVersion: PREVIOUS_INSTALLATION_INTEGRATION_VERSION,
      ownershipVersion: PREVIOUS_INSTALLATION_OWNERSHIP_VERSION,
      managed: [...currentManifest.managed, {
        path: retiredPath,
        owner: `host:claude:file:${retiredPath}`,
        mode: "exclusive-file",
        selector: null,
        digest: PREVIOUS_CLAUDE_INIT_DIGEST
      }].sort((left, right) => `${left.path}\0${left.mode}\0${left.selector ?? ""}\0${left.owner}`.localeCompare(`${right.path}\0${right.mode}\0${right.selector ?? ""}\0${right.owner}`))
    };
    write(root, INSTALLATION_MANIFEST_PATH, `${JSON.stringify(previous, null, 2)}\n`);

    const result = syncProjectIntegration(root, { now: SYNC_NOW });
    assert.equal(result.status, "synchronized");
    assert.equal(fs.existsSync(path.join(root, retiredPath)), false);
    assert.equal(fs.existsSync(path.join(root, ".claude/commands/dove/research.md")), true);
    assert.equal(result.manifest.integrationVersion, INSTALLATION_INTEGRATION_VERSION);
    assert.equal(result.manifest.ownershipVersion, INSTALLATION_OWNERSHIP_VERSION);
    assert.equal(result.manifest.createdAt, initialized.manifest.createdAt);
    assert.equal(result.manifest.managed.some((entry) => entry.path === retiredPath), false);
    assert.equal(inspectProjectIntegration(root).status, "current");
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration fails closed when a previous retired owned resource drifted", () => {
  const root = createTempRoot("dove-project-integration-previous-drift-");
  try {
    initialize(root);
    const manifest = readJson(root, INSTALLATION_MANIFEST_PATH);
    const retiredPath = PREVIOUS_CLAUDE_INIT_PATH;
    write(root, retiredPath, "user modified retired command\n");
    const previous = {
      ...manifest,
      integrationVersion: PREVIOUS_INSTALLATION_INTEGRATION_VERSION,
      ownershipVersion: PREVIOUS_INSTALLATION_OWNERSHIP_VERSION,
      managed: [...manifest.managed, {
        path: retiredPath,
        owner: `host:claude:file:${retiredPath}`,
        mode: "exclusive-file",
        selector: null,
        digest: PREVIOUS_CLAUDE_INIT_DIGEST
      }].sort((left, right) => `${left.path}\0${left.mode}\0${left.selector ?? ""}\0${left.owner}`.localeCompare(`${right.path}\0${right.mode}\0${right.selector ?? ""}\0${right.owner}`))
    };
    write(root, INSTALLATION_MANIFEST_PATH, `${JSON.stringify(previous, null, 2)}\n`);
    const beforeManifest = fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH));
    assert.throws(() => syncProjectIntegration(root, { now: SYNC_NOW }), /ownership drift.*init\.md/iu);
    assert.equal(fs.readFileSync(path.join(root, retiredPath), "utf8"), "user modified retired command\n");
    assert.deepEqual(fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH)), beforeManifest);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration updates manifest timestamp only for package metadata changes", () => {
  const root = createTempRoot("dove-project-integration-package-update-");
  try {
    const initialized = initialize(root);
    const result = syncProjectIntegration(root, { packageVersion: "0.5.0", now: SYNC_NOW });
    assert.equal(result.status, "synchronized");
    assert.deepEqual(result.changedPaths, [INSTALLATION_MANIFEST_PATH]);
    assert.equal(result.manifest.package.version, "0.5.0");
    assert.equal(result.manifest.createdAt, initialized.manifest.createdAt);
    assert.equal(result.manifest.updatedAt, SYNC_NOW);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration fails closed on exclusive file drift", () => {
  const root = createTempRoot("dove-project-integration-exclusive-drift-");
  try {
    initialize(root);
    write(root, ".claude/commands/dove/status.md", "user replacement\n");
    const manifestBefore = fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH), "utf8");
    assert.throws(() => syncProjectIntegration(root, { now: SYNC_NOW }), /ownership drift.*status\.md/iu);
    assert.equal(fs.readFileSync(path.join(root, ".claude/commands/dove/status.md"), "utf8"), "user replacement\n");
    assert.equal(fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH), "utf8"), manifestBefore);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration fails closed on MCP and settings semantic fragment drift", () => {
  for (const [label, mutate, expected] of [
    ["mcp", (root) => {
      const config = readJson(root, ".mcp.json");
      config.mcpServers.dove.command = "other";
      write(root, ".mcp.json", `${JSON.stringify(config, null, 2)}\n`);
    }, /ownership drift.*mcpServers\/dove/iu],
    ["settings", (root) => {
      const settings = readJson(root, ".claude/settings.json");
      settings.hooks.UserPromptSubmit.at(-1).hooks[0].timeout = 99;
      write(root, ".claude/settings.json", `${JSON.stringify(settings, null, 2)}\n`);
    }, /ownership drift.*UserPromptSubmit/iu]
  ]) {
    const root = createTempRoot(`dove-project-integration-${label}-drift-`);
    try {
      initialize(root);
      mutate(root);
      const before = fs.readFileSync(path.join(root, label === "mcp" ? ".mcp.json" : ".claude/settings.json"), "utf8");
      assert.throws(() => syncProjectIntegration(root, { now: SYNC_NOW }), expected);
      assert.equal(fs.readFileSync(path.join(root, label === "mcp" ? ".mcp.json" : ".claude/settings.json"), "utf8"), before);
    } finally {
      cleanupTempRoot(root);
    }
  }
});

test("project integration rejects duplicate shared JSON keys before writes", () => {
  for (const [relativePath, content] of [
    [".mcp.json", '{"mcpServers":{},"mcpServers":{}}\n'],
    [".claude/settings.json", '{"hooks":{"UserPromptSubmit":[],"UserPromptSubmit":[]}}\n']
  ]) {
    const root = createTempRoot("dove-project-integration-duplicate-json-");
    try {
      write(root, relativePath, content);
      const before = fs.readFileSync(path.join(root, relativePath), "utf8");
      assert.throws(() => initialize(root), /duplicate JSON object keys/u);
      assert.equal(fs.readFileSync(path.join(root, relativePath), "utf8"), before);
      assert.equal(fs.existsSync(path.join(root, INSTALLATION_MANIFEST_PATH)), false);
    } finally {
      cleanupTempRoot(root);
    }
  }
});

test("project integration rejects symlinked managed files and parent directories", () => {
  const outside = createTempRoot("dove-project-integration-symlink-outside-");
  try {
    for (const mode of ["file", "parent"]) {
      const root = createTempRoot(`dove-project-integration-symlink-${mode}-`);
      try {
        if (mode === "file") {
          write(outside, "mcp.json", "{}\n");
          fs.symlinkSync(path.join(outside, "mcp.json"), path.join(root, ".mcp.json"));
        } else {
          fs.mkdirSync(path.join(outside, "claude"), { recursive: true });
          fs.symlinkSync(path.join(outside, "claude"), path.join(root, ".claude"));
        }
        assert.throws(() => initialize(root), /must not be a symbolic link/u);
        assert.equal(fs.existsSync(path.join(root, INSTALLATION_MANIFEST_PATH)), false);
      } finally {
        cleanupTempRoot(root);
      }
    }
  } finally {
    cleanupTempRoot(outside);
  }
});

test("project Upgrade preserves research bytes and unrelated shared JSON while refreshing integration", () => {
  const root = createTempRoot("dove-project-upgrade-");
  try {
    write(root, ".mcp.json", `${JSON.stringify({ metadata: { keep: true }, mcpServers: { other: { command: "keep" } } }, null, 2)}\n`);
    write(root, ".claude/settings.json", `${JSON.stringify({
      theme: "dark",
      hooks: {
        SessionStart: [{ hooks: [{ type: "command", command: "keep-session" }] }],
        UserPromptSubmit: [{ matcher: "keep", hooks: [{ type: "command", command: "keep-prompt" }] }]
      }
    }, null, 2)}\n`);
    write(root, ".claude/settings.local.json", `${JSON.stringify({ permissions: { allow: ["Read"] }, enabledMcpjsonServers: ["other"] }, null, 2)}\n`);
    write(root, ".opencode.json", `${JSON.stringify({ keep: true, mcpServers: { other: { command: "keep" } } }, null, 2)}\n`);
    initialize(root);

    const mcp = readJson(root, ".mcp.json");
    mcp.mcpServers.dove = { type: "stdio", command: "node", args: ["./mcp/dove-state-server-package.mjs"] };
    write(root, ".mcp.json", `${JSON.stringify(mcp, null, 2)}\n`);
    const settings = readJson(root, ".claude/settings.json");
    settings.hooks.UserPromptSubmit.at(-1).hooks[0] = { type: "command", command: "node ./scripts/dove-user-prompt-submit-package.mjs" };
    write(root, ".claude/settings.json", `${JSON.stringify(settings, null, 2)}\n`);

    write(root, ".dove/format.json", "{\"format\":\"dove-research-v1\"}\r\n");
    write(root, ".dove/workspace.json", "{\"keep\":true}\n");
    write(root, ".dove/missions/result.bin", Buffer.from([0, 255, 1, 128]));
    write(root, ".dove-archive/existing/private.json", "{\"archive\":true}\r\n");
    write(root, "ordinary.txt", "keep ordinary\n");
    const researchBefore = new Map([
      [".dove/format.json", fs.readFileSync(path.join(root, ".dove/format.json"))],
      [".dove/workspace.json", fs.readFileSync(path.join(root, ".dove/workspace.json"))],
      [".dove/missions/result.bin", fs.readFileSync(path.join(root, ".dove/missions/result.bin"))]
    ]);
    const managedPath = ".claude/commands/dove/status.md";
    const installedContent = fs.readFileSync(path.join(root, managedPath), "utf8");
    write(root, managedPath, `${installedContent}stale installed content\n`);

    const preview = previewProjectUpgrade(root, { ...PACKAGE, now: SYNC_NOW });
    assert.equal(preview.status, "ready");
    assert.equal(preview.previewType, "project-upgrade");
    assert.equal(preview.previewVersion, 1);
    assert.deepEqual(preview.confirmation, {
      required: false,
      default: false,
      exactReplay: true,
      previewDigest: preview.confirmation.previewDigest
    });
    assert.equal(preview.changedPaths.includes(".dove/workspace.json"), false);
    assert.deepEqual(preview.movedPaths, [{ from: ".dove-archive", to: ".dove/archive" }]);

    const result = upgradeProjectIntegration(root, { ...PACKAGE, now: SYNC_NOW, preview });
    assert.equal(result.status, "upgraded");
    for (const [relativePath, bytes] of researchBefore) {
      assert.deepEqual(fs.readFileSync(path.join(root, relativePath)), bytes, relativePath);
    }
    assert.equal(fs.readFileSync(path.join(root, ".dove/archive/existing/private.json"), "utf8"), "{\"archive\":true}\r\n");
    assert.equal(fs.existsSync(path.join(root, ".dove-archive")), false);
    assert.equal(fs.readFileSync(path.join(root, "ordinary.txt"), "utf8"), "keep ordinary\n");
    assert.equal(fs.readFileSync(path.join(root, managedPath), "utf8"), installedContent);

    const upgradedMcp = readJson(root, ".mcp.json");
    assert.deepEqual(upgradedMcp.metadata, { keep: true });
    assert.deepEqual(upgradedMcp.mcpServers.other, { command: "keep" });
    assert.deepEqual(upgradedMcp.mcpServers.dove, INSTALLED_DOVE_MCP_SERVER);
    const upgradedSettings = readJson(root, ".claude/settings.json");
    assert.equal(upgradedSettings.theme, "dark");
    assert.equal(upgradedSettings.hooks.SessionStart[0].hooks[0].command, "keep-session");
    assert.equal(upgradedSettings.hooks.UserPromptSubmit[0].matcher, "keep");
    assert.deepEqual(upgradedSettings.hooks.UserPromptSubmit[1], DOVE_CLAUDE_AMBIENT_HOOK_ENTRY);
    assert.deepEqual(readJson(root, ".claude/settings.local.json"), {
      permissions: { allow: ["Read"] },
      enabledMcpjsonServers: ["other", "dove"]
    });
    assert.deepEqual(readJson(root, ".opencode.json"), { keep: true, mcpServers: { other: { command: "keep" } } });
    assert.equal(inspectProjectIntegration(root, PACKAGE).status, "current");
  } finally {
    cleanupTempRoot(root);
  }
});

test("Complete Reinstall deletes research and archive state then recreates only installation metadata", () => {
  const root = createTempRoot("dove-project-complete-reinstall-");
  try {
    initialize(root);
    write(root, ".dove/format.json", "{\"format\":\"dove-research-v1\"}\n");
    write(root, ".dove/workspace.json", "{\"secret\":true}\n");
    write(root, ".dove-archive/existing/private.json", "{\"archive\":true}\n");
    write(root, "paper.md", "keep\n");
    const preview = previewProjectCompleteReinstall(root, { ...PACKAGE, now: SYNC_NOW });
    assert.throws(() => completeReinstallProjectIntegration(root, { ...PACKAGE, now: SYNC_NOW, preview }), /confirmed: true/u);
    const result = completeReinstallProjectIntegration(root, { ...PACKAGE, now: SYNC_NOW, preview, confirmed: true });
    assert.equal(result.status, "reinstalled");
    assert.deepEqual(fs.readdirSync(path.join(root, ".dove")), ["install"]);
    assert.deepEqual(fs.readdirSync(path.join(root, ".dove", "install")), ["manifest.json"]);
    assert.equal(fs.existsSync(path.join(root, ".dove-archive")), false);
    assert.equal(fs.readFileSync(path.join(root, "paper.md"), "utf8"), "keep\n");
  } finally {
    cleanupTempRoot(root);
  }
});

test("Upgrade and Complete Reinstall require exact fresh lifecycle previews", () => {
  for (const lifecycle of ["upgrade", "complete-reinstall"]) {
    const root = createTempRoot(`dove-project-${lifecycle}-stale-`);
    try {
      initialize(root);
      write(root, ".dove/workspace.json", "{\"before\":true}\n");
      const preview = lifecycle === "upgrade"
        ? previewProjectUpgrade(root, { ...PACKAGE, now: SYNC_NOW })
        : previewProjectCompleteReinstall(root, { ...PACKAGE, now: SYNC_NOW });
      const execute = (approvedPreview) => lifecycle === "upgrade"
        ? upgradeProjectIntegration(root, { ...PACKAGE, now: SYNC_NOW, preview: approvedPreview })
        : completeReinstallProjectIntegration(root, { ...PACKAGE, now: SYNC_NOW, confirmed: true, preview: approvedPreview });

      assert.throws(
        () => execute({ ...preview, previewType: "retired-reinstall" }),
        lifecycle === "upgrade" ? /exact project-upgrade preview/iu : /exact project-complete-reinstall preview/iu
      );
      write(root, ".claude/commands/dove/status.md", "changed after preview\n");
      assert.throws(() => execute(preview), /preview is stale|approved precondition changed/iu);
      assert.equal(fs.readFileSync(path.join(root, ".dove/workspace.json"), "utf8"), "{\"before\":true}\n");
    } finally {
      cleanupTempRoot(root);
    }
  }
});

test("Complete Reinstall ignores absent or malformed manifests and defaults to Claude", () => {
  for (const mode of ["absent", "malformed-current", "malformed-legacy"]) {
    const root = createTempRoot(`dove-project-complete-reinstall-${mode}-`);
    try {
      write(root, ".dove/workspace.json", "{\"delete\":true}\n");
      write(root, ".dove-archive/existing/private.json", "{\"delete\":true}\n");
      write(root, "ordinary.txt", "keep\n");
      if (mode === "malformed-current") write(root, INSTALLATION_MANIFEST_PATH, "{not valid json\n");
      if (mode === "malformed-legacy") write(root, ".dove-install/manifest.json", "{not valid json\n");

      const preview = previewProjectCompleteReinstall(root, { ...PACKAGE, now: SYNC_NOW });
      assert.deepEqual(preview.hosts, ["claude"]);
      assert.equal(preview.removedPaths.includes(".dove/workspace.json"), true);
      if (mode === "malformed-legacy") assert.equal(preview.removedPaths.includes(".dove-install"), true);
      const result = completeReinstallProjectIntegration(root, { ...PACKAGE, now: SYNC_NOW, confirmed: true, preview });

      assert.deepEqual(result.hosts, ["claude"]);
      assert.deepEqual(fs.readdirSync(path.join(root, ".dove")), ["install"]);
      assert.deepEqual(fs.readdirSync(path.join(root, ".dove/install")), ["manifest.json"]);
      assert.equal(fs.existsSync(path.join(root, ".dove-install")), false);
      assert.equal(fs.existsSync(path.join(root, ".dove-archive")), false);
      assert.equal(fs.readFileSync(path.join(root, "ordinary.txt"), "utf8"), "keep\n");
      assert.equal(fs.existsSync(path.join(root, ".claude/commands/dove/status.md")), true);
    } finally {
      cleanupTempRoot(root);
    }
  }
});

test("legacy Upgrade removes its whole old root and preserves unsupported research bytes", () => {
  const root = createTempRoot("dove-project-upgrade-valid-legacy-");
  try {
    initialize(root);
    const currentManifest = fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH));
    fs.mkdirSync(path.join(root, path.dirname(LEGACY_INSTALLATION_MANIFEST_PATH)), { recursive: true });
    fs.writeFileSync(path.join(root, LEGACY_INSTALLATION_MANIFEST_PATH), currentManifest);
    fs.rmSync(path.join(root, ".dove", "install"), { recursive: true, force: true });
    write(root, ".dove/manifest.json", "{\"schemaVersion\":17}\n");
    write(root, ".dove/missions/old.json", "old research bytes\n");
    const before = fs.readFileSync(path.join(root, ".dove/missions/old.json"));
    const preview = previewProjectUpgrade(root, { ...PACKAGE, now: SYNC_NOW });
    assert.equal(preview.removedPaths.includes(LEGACY_INSTALLATION_MANIFEST_PATH), true);
    assert.equal(preview.removedPaths.includes(".dove-install"), true);
    upgradeProjectIntegration(root, { ...PACKAGE, now: SYNC_NOW, preview });
    assert.equal(fs.existsSync(path.join(root, ".dove-install")), false);
    assert.equal(fs.existsSync(path.join(root, INSTALLATION_MANIFEST_PATH)), true);
    assert.deepEqual(fs.readFileSync(path.join(root, ".dove/missions/old.json")), before);
  } finally {
    cleanupTempRoot(root);
  }
});

test("legacy Upgrade rejects unknown files in its old root", () => {
  const root = createTempRoot("dove-project-upgrade-legacy-residue-");
  try {
    initialize(root);
    const currentManifest = fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH));
    fs.mkdirSync(path.join(root, path.dirname(LEGACY_INSTALLATION_MANIFEST_PATH)), { recursive: true });
    fs.writeFileSync(path.join(root, LEGACY_INSTALLATION_MANIFEST_PATH), currentManifest);
    fs.writeFileSync(path.join(root, ".dove-install/unknown.txt"), "do not remove\n");
    fs.rmSync(path.join(root, ".dove", "install"), { recursive: true, force: true });
    assert.throws(() => previewProjectUpgrade(root, { ...PACKAGE, now: SYNC_NOW }), /contain only its legacy manifest/u);
  } finally {
    cleanupTempRoot(root);
  }
});

test("Upgrade remains strict about missing, malformed, or conflicting installation manifests", () => {
  for (const mode of ["absent", "malformed-current", "both"]) {
    const root = createTempRoot(`dove-project-upgrade-strict-${mode}-`);
    try {
      write(root, ".dove/workspace.json", "{\"keep\":true}\n");
      if (mode === "malformed-current") write(root, INSTALLATION_MANIFEST_PATH, "{not valid json\n");
      if (mode === "both") {
        initialize(root);
        write(root, ".dove-install/manifest.json", fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH)));
      }
      const before = fs.readFileSync(path.join(root, ".dove/workspace.json"));
      assert.throws(
        () => previewProjectUpgrade(root, { ...PACKAGE, now: SYNC_NOW }),
        mode === "absent" ? /requires an installed project manifest/iu : mode === "both" ? /both current and legacy/iu : /Invalid Dove project installation manifest/iu
      );
      assert.deepEqual(fs.readFileSync(path.join(root, ".dove/workspace.json")), before);
    } finally {
      cleanupTempRoot(root);
    }
  }
});

test("project Upgrade removes known retired paths and affirmatively signed copied runtime", () => {
  const root = createTempRoot("dove-project-upgrade-retired-");
  try {
    initialize(root);
    const retiredPaths = [
      ".claude/commands/dove/workspace.md",
      PREVIOUS_CLAUDE_INIT_PATH,
      ".claude/commands/dove/version.md"
    ];
    for (const retiredPath of retiredPaths) write(root, retiredPath, "retired Dove command\n");
    const runtimeProbe = LEGACY_PROJECT_BUNDLE_PROBES.find((entry) => entry.path === "bin/dove-package.mjs");
    write(root, runtimeProbe.path, `${runtimeProbe.signatures.slice(0, 2).join("\n")}\nlocally modified legacy runtime\n`);

    const preview = previewProjectUpgrade(root, { ...PACKAGE, now: SYNC_NOW });
    for (const retiredPath of retiredPaths) assert.equal(preview.removedPaths.includes(retiredPath), true, retiredPath);
    assert.equal(preview.removedPaths.includes(runtimeProbe.path), true);
    const result = upgradeProjectIntegration(root, { ...PACKAGE, now: SYNC_NOW, preview });

    assert.equal(result.status, "upgraded");
    for (const retiredPath of retiredPaths) assert.equal(fs.existsSync(path.join(root, retiredPath)), false, retiredPath);
    assert.equal(fs.existsSync(path.join(root, runtimeProbe.path)), false);
  } finally {
    cleanupTempRoot(root);
  }
});

test("Upgrade and Complete Reinstall reject symlinked reserved paths and unsigned copied runtime", () => {
  for (const lifecycle of ["upgrade", "complete-reinstall"]) {
    for (const mode of ["symlink", "unsigned-runtime"]) {
      const root = createTempRoot(`dove-project-${lifecycle}-block-${mode}-`);
      const outside = createTempRoot(`dove-project-${lifecycle}-outside-${mode}-`);
      try {
        initialize(root);
        if (mode === "symlink") {
          write(outside, "status.md", "outside\n");
          fs.rmSync(path.join(root, ".claude/commands/dove/status.md"));
          fs.symlinkSync(path.join(outside, "status.md"), path.join(root, ".claude/commands/dove/status.md"));
        } else {
          write(root, "bin/dove-package.mjs", "unsigned ordinary project runtime\n");
        }
        const beforeManifest = fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH));
        const preview = () => lifecycle === "upgrade"
          ? previewProjectUpgrade(root, { ...PACKAGE, now: SYNC_NOW })
          : previewProjectCompleteReinstall(root, { ...PACKAGE, now: SYNC_NOW });
        assert.throws(
          preview,
          mode === "symlink"
            ? /must not be a symbolic link.*status\.md/iu
            : /cannot safely remove copied runtime.*bin\/dove-package\.mjs/iu
        );
        assert.deepEqual(fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH)), beforeManifest);
        if (mode === "symlink") assert.equal(fs.readFileSync(path.join(outside, "status.md"), "utf8"), "outside\n");
        else assert.equal(fs.readFileSync(path.join(root, "bin/dove-package.mjs"), "utf8"), "unsigned ordinary project runtime\n");
      } finally {
        cleanupTempRoot(root);
        cleanupTempRoot(outside);
      }
    }
  }
});

test("project integration rejects legacy installation evidence before writes", () => {
  const root = createTempRoot("dove-project-integration-legacy-");
  try {
    write(root, "mcp/dove-claude-project.json", '{"version":1,"host":"claude"}\n');
    assert.throws(() => initialize(root), /Unsupported legacy Dove project installation/u);
    assert.equal(fs.existsSync(path.join(root, INSTALLATION_MANIFEST_PATH)), false);
    assert.equal(fs.existsSync(path.join(root, ".claude")), false);
  } finally {
    cleanupTempRoot(root);
  }
});
