import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { DOVE_CLAUDE_AMBIENT_HOOK_ENTRY } from "../../src/core/ambient-policy.mjs";
import { INSTALLED_DOVE_MCP_SERVER } from "../../src/core/command-manifest.mjs";
import {
  initializeProjectIntegration,
  inspectProjectIntegration,
  overlayUpgradeProjectIntegration,
  previewProjectIntegrationOverlayUpgrade,
  syncProjectIntegration
} from "../../src/core/project-installation.mjs";
import {
  INSTALLATION_INTEGRATION_VERSION,
  INSTALLATION_MANIFEST_PATH,
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

const PACKAGE = { packageName: "dove", packageVersion: "0.4.0" };
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

function managedSort(left, right) {
  return `${left.path}\0${left.mode}\0${left.selector ?? ""}\0${left.owner}`.localeCompare(`${right.path}\0${right.mode}\0${right.selector ?? ""}\0${right.owner}`);
}

function seedLegacyDomainCommandOwnership(root) {
  const manifest = readJson(root, INSTALLATION_MANIFEST_PATH);
  const templateEntry = manifest.managed.find((entry) => entry.path === ".claude/commands/dove/experiment.md");
  for (const relativePath of [".claude/commands/dove/note.md", ".claude/commands/dove/experience.md"]) {
    const content = `---\ndescription: Legacy retired ${path.basename(relativePath, ".md")} workflow\n---\n`;
    write(root, relativePath, content);
    const entry = manifest.managed.find((item) => item.path === relativePath);
    entry.digest = crypto.createHash("sha256").update(content).digest("hex");
  }
  const retiredPath = ".claude/commands/dove/version.md";
  const content = "---\ndescription: Retired version workflow\n---\n";
  write(root, retiredPath, content);
  manifest.managed.push({
    ...templateEntry,
    path: retiredPath,
    owner: `host:claude:file:${retiredPath}`,
    digest: crypto.createHash("sha256").update(content).digest("hex")
  });
  manifest.managed.sort(managedSort);
  write(root, INSTALLATION_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

test("project integration clean init owns only Claude project resources and manifest", () => {
  const root = createTempRoot("dove-project-integration-clean-");
  try {
    const result = initialize(root);
    assert.equal(result.status, "initialized");
    assert.equal(result.target, fs.realpathSync.native(root));
    assert.deepEqual(result.hosts, ["claude"]);
    assert.equal(result.manifest.managed.length, 18);
    assert.equal(result.changedPaths.includes(INSTALLATION_MANIFEST_PATH), true);
    assert.deepEqual(readJson(root, ".mcp.json"), { mcpServers: { dove: INSTALLED_DOVE_MCP_SERVER } });
    assert.deepEqual(readJson(root, ".claude/settings.local.json"), { enabledMcpjsonServers: ["dove"] });
    assert.deepEqual(readJson(root, ".claude/settings.json").hooks.UserPromptSubmit, [DOVE_CLAUDE_AMBIENT_HOOK_ENTRY]);
    assert.equal(fs.existsSync(path.join(root, ".claude/commands/dove/status.md")), true);
    assert.equal(fs.existsSync(path.join(root, ".claude/rules/dove.md")), true);
    assert.equal(fs.existsSync(path.join(root, ".claude/skills/dove-intake/SKILL.md")), true);
    assert.equal(fs.existsSync(path.join(root, ".claude/skills/dove-lessons-intake/SKILL.md")), true);
    for (const relativePath of ["bin/dove-package.mjs", "dist/index.mjs", "mcp/dove-state-server-package.mjs", "scripts/dove-user-prompt-submit-package.mjs", "mcp/dove-claude-project.json", ".dove"]) {
      assert.equal(fs.existsSync(path.join(root, relativePath)), false, relativePath);
    }
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
      ".claude/commands/dove/workspace.md",
      ".claude/commands/dove/mission.md",
      ".claude/commands/dove/status.md",
      ".claude/commands/dove/lessons.md",
      ".claude/commands/dove/source.md",
      ".claude/commands/dove/note.md",
      ".claude/commands/dove/experience.md",
      ".claude/commands/dove/experiment.md",
      ".claude/commands/dove/draft.md",
      ".claude/commands/dove/figure.md",
      ".claude/commands/dove/review.md",
      ".claude/commands/dove/rebuttal.md",
      ".claude/rules/dove.md",
      ".claude/skills/dove-intake/SKILL.md",
      ".claude/skills/dove-lessons-intake/SKILL.md"
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

test("project integration sync restores Note and Experience while removing only the retired Version path", () => {
  const root = createTempRoot("dove-project-integration-domain-cutover-");
  try {
    initialize(root);
    seedLegacyDomainCommandOwnership(root);

    const inspected = inspectProjectIntegration(root, { now: SYNC_NOW });
    assert.equal(inspected.status, "needs-sync");
    assert.deepEqual(inspected.removedPaths, [".claude/commands/dove/version.md"]);
    assert.equal(inspected.writtenPaths.includes(".claude/commands/dove/note.md"), true);
    assert.equal(inspected.writtenPaths.includes(".claude/commands/dove/experience.md"), true);

    const result = syncProjectIntegration(root, { now: SYNC_NOW });
    assert.equal(result.status, "synchronized");
    assert.equal(fs.existsSync(path.join(root, ".claude/commands/dove/version.md")), false);
    assert.equal(fs.existsSync(path.join(root, ".claude/commands/dove/note.md")), true);
    assert.equal(fs.existsSync(path.join(root, ".claude/commands/dove/experience.md")), true);
    assert.equal(fs.existsSync(path.join(root, ".claude/commands/dove/experiment.md")), true);
    assert.equal(result.manifest.managed.length, 18);
    assert.equal(inspectProjectIntegration(root).status, "current");
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration retired-path cleanup is zero-write when Version drifted", () => {
  const root = createTempRoot("dove-project-integration-domain-cutover-drift-");
  try {
    initialize(root);
    seedLegacyDomainCommandOwnership(root);
    write(root, ".claude/commands/dove/version.md", "user modified retired command\n");
    const beforeManifest = fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH));

    assert.throws(() => syncProjectIntegration(root, { now: SYNC_NOW }), /ownership drift.*version\.md/iu);
    assert.equal(fs.readFileSync(path.join(root, ".claude/commands/dove/version.md"), "utf8"), "user modified retired command\n");
    assert.equal(fs.existsSync(path.join(root, ".claude/commands/dove/note.md")), true);
    assert.equal(fs.existsSync(path.join(root, ".claude/commands/dove/experience.md")), true);
    assert.deepEqual(fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH)), beforeManifest);
  } finally {
    cleanupTempRoot(root);
  }
});

test("project integration migrates a valid previous manifest, retires its owned init command, and installs workspace atomically", () => {
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
    assert.equal(fs.existsSync(path.join(root, ".claude/commands/dove/workspace.md")), true);
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

test("overlay upgrade archives .dove whole, ignores malformed manifest claims, and installs a fresh identity", () => {
  const root = createTempRoot("dove-project-overlay-upgrade-");
  try {
    const previousInstallation = initialize(root);
    write(root, ".dove/state/private.json", "{\"keep\":true}\n");
    fs.symlinkSync("state/private.json", path.join(root, ".dove", "private-link"));
    write(root, ".dove-archive/existing/keep.txt", "existing archive\n");
    write(root, ".claude/commands/dove/init.md", "old reserved command\n");
    write(root, "ordinary.txt", "keep ordinary\n");
    const malformedClaims = readJson(root, INSTALLATION_MANIFEST_PATH);
    malformedClaims.managed.push({
      path: "ordinary.txt",
      owner: "malformed:untrusted-claim",
      mode: "exclusive-file",
      selector: null,
      digest: crypto.createHash("sha256").update("keep ordinary\n").digest("hex")
    });
    write(root, INSTALLATION_MANIFEST_PATH, `${JSON.stringify(malformedClaims, null, 2)}\n`);
    write(root, ".mcp.json", `${JSON.stringify({ keep: true, mcpServers: { dove: { type: "stdio", command: "node", args: ["./mcp/dove-state-server-package.mjs"] }, other: { command: "keep" } } }, null, 2)}\n`);
    write(root, ".claude/settings.json", `${JSON.stringify({ keep: true, hooks: { UserPromptSubmit: [{ hooks: [{ type: "command", command: "node ./scripts/dove-user-prompt-submit-package.mjs" }] }] } }, null, 2)}\n`);

    const preview = previewProjectIntegrationOverlayUpgrade(root, { hosts: ["claude"], ...PACKAGE, now: SYNC_NOW });
    assert.equal(preview.status, "ready");
    assert.match(preview.sourceTreeDigest, /^[a-f0-9]{64}$/u);
    assert.match(preview.archiveTarget, /\.dove-archive[/\\]upgrade-[a-f0-9]{24}$/u);
    assert.equal(fs.existsSync(path.join(root, ".dove")), true);
    assert.equal(fs.existsSync(preview.archiveTarget), false);
    assert.throws(() => overlayUpgradeProjectIntegration(root, { preview, hosts: ["claude"], ...PACKAGE, now: SYNC_NOW }), /confirmed: true/u);

    const result = overlayUpgradeProjectIntegration(root, { confirmed: true, preview, hosts: ["claude"], ...PACKAGE, now: SYNC_NOW });
    assert.equal(result.status, "overlay-upgraded");
    assert.equal(result.archiveTarget, preview.archiveTarget);
    assert.deepEqual(result.movedPaths, [{ from: ".dove", to: path.relative(root, preview.archiveTarget).split(path.sep).join("/") }]);
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);
    assert.equal(fs.readFileSync(path.join(preview.archiveTarget, "state/private.json"), "utf8"), "{\"keep\":true}\n");
    assert.equal(fs.readlinkSync(path.join(preview.archiveTarget, "private-link")), "state/private.json");
    assert.equal(fs.readFileSync(path.join(root, ".dove-archive/existing/keep.txt"), "utf8"), "existing archive\n");
    assert.equal(fs.readFileSync(path.join(root, "ordinary.txt"), "utf8"), "keep ordinary\n");
    assert.equal(fs.existsSync(path.join(root, ".claude/commands/dove/init.md")), false);
    assert.notEqual(result.manifest.installationId, previousInstallation.manifest.installationId);
    assert.equal(result.manifest.installationId, readJson(root, INSTALLATION_MANIFEST_PATH).installationId);
    assert.equal(readJson(root, ".mcp.json").keep, true);
    assert.deepEqual(readJson(root, ".mcp.json").mcpServers.other, { command: "keep" });
    assert.deepEqual(readJson(root, ".mcp.json").mcpServers.dove, INSTALLED_DOVE_MCP_SERVER);
    assert.equal(readJson(root, ".claude/settings.json").keep, true);
    assert.deepEqual(readJson(root, ".claude/settings.json").hooks.UserPromptSubmit, [DOVE_CLAUDE_AMBIENT_HOOK_ENTRY]);
  } finally {
    cleanupTempRoot(root);
  }
});

test("overlay upgrade rejects stale approval, ambiguous shared JSON, and symlinked archive parents before writes", () => {
  for (const mode of ["stale", "stale-mode", "ambiguous-json", "archive-parent-symlink"]) {
    const root = createTempRoot(`dove-project-overlay-reject-${mode}-`);
    const outside = createTempRoot(`dove-project-overlay-outside-${mode}-`);
    try {
      write(root, ".dove/state.json", "{\"keep\":true}\n");
      write(root, ".mcp.json", mode === "ambiguous-json"
        ? `${JSON.stringify({ mcpServers: { dove: { command: "unrelated" } } })}\n`
        : `${JSON.stringify({ mcpServers: { dove: INSTALLED_DOVE_MCP_SERVER } })}\n`);
      if (mode === "archive-parent-symlink") fs.symlinkSync(outside, path.join(root, ".dove-archive"));
      const before = fs.readFileSync(path.join(root, ".dove/state.json"), "utf8");
      if (mode === "ambiguous-json") {
        assert.throws(() => previewProjectIntegrationOverlayUpgrade(root, { hosts: ["claude"], ...PACKAGE, now: SYNC_NOW }), /ambiguous non-Dove fragment/iu);
      } else if (mode === "archive-parent-symlink") {
        assert.throws(() => previewProjectIntegrationOverlayUpgrade(root, { hosts: ["claude"], ...PACKAGE, now: SYNC_NOW }), /archive target is already occupied|real directory|symbolic/iu);
      } else {
        const preview = previewProjectIntegrationOverlayUpgrade(root, { hosts: ["claude"], ...PACKAGE, now: SYNC_NOW });
        if (mode === "stale-mode") fs.chmodSync(path.join(root, ".mcp.json"), 0o600);
        else write(root, ".dove/state.json", "{\"changed\":true}\n");
        assert.throws(() => overlayUpgradeProjectIntegration(root, { confirmed: true, preview, hosts: ["claude"], ...PACKAGE, now: SYNC_NOW }), /stale|digest changed/iu);
      }
      assert.equal(fs.existsSync(path.join(root, ".dove")), true);
      if (mode !== "stale") assert.equal(fs.readFileSync(path.join(root, ".dove/state.json"), "utf8"), before);
      assert.equal(fs.existsSync(path.join(root, ".dove-install/manifest.json")), false);
      assert.deepEqual(fs.readdirSync(outside), []);
    } finally {
      cleanupTempRoot(root);
      cleanupTempRoot(outside);
    }
  }
});

test("overlay upgrade preserves unrelated shared JSON bytes and rejects lookalike ownership", () => {
  const root = createTempRoot("dove-project-overlay-precise-ownership-");
  try {
    const opencodeBytes = "{\"keep\":true,\"mcpServers\":{\"other\":{\"command\":\"keep\"}}}\n";
    write(root, ".opencode.json", opencodeBytes);
    const preview = previewProjectIntegrationOverlayUpgrade(root, { hosts: ["claude"], ...PACKAGE, now: SYNC_NOW });
    overlayUpgradeProjectIntegration(root, { confirmed: true, preview, hosts: ["claude"], ...PACKAGE, now: SYNC_NOW });
    assert.equal(fs.readFileSync(path.join(root, ".opencode.json"), "utf8"), opencodeBytes);
  } finally {
    cleanupTempRoot(root);
  }

  for (const [relativePath, content, expected] of [
    [".mcp.json", `${JSON.stringify({ mcpServers: { dove: { type: "stdio", command: "dove", args: ["mcp", "serve", "--project", ".", "--extra"] } } })}\n`, /ambiguous non-Dove fragment/iu],
    [".opencode.json", `${JSON.stringify({ mcpServers: { dove: { type: "stdio", command: "node", args: ["/unrelated/mcp/dove-state-server-package.mjs"] } } })}\n`, /ambiguous non-Dove fragment/iu],
    [".claude/settings.json", `${JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ type: "command", command: "dove hook user-prompt-submit --project . --extra", timeout: 10 }] }] } })}\n`, /ambiguous Dove UserPromptSubmit hook/iu],
    ["scripts/dove-user-prompt-submit-package.mjs", "// unrelated UserPromptSubmit helper\n", /affirmative Dove signatures/iu],
    ["mcp/dove-claude-project.json", '{"version":1,"host":"claude","extra":true}\n', /ambiguous project marker/iu]
  ]) {
    const ambiguousRoot = createTempRoot("dove-project-overlay-lookalike-");
    try {
      write(ambiguousRoot, relativePath, content);
      assert.throws(
        () => previewProjectIntegrationOverlayUpgrade(ambiguousRoot, { hosts: ["claude"], ...PACKAGE, now: SYNC_NOW }),
        expected
      );
      assert.equal(fs.readFileSync(path.join(ambiguousRoot, relativePath), "utf8"), content);
      assert.equal(fs.existsSync(path.join(ambiguousRoot, INSTALLATION_MANIFEST_PATH)), false);
    } finally {
      cleanupTempRoot(ambiguousRoot);
    }
  }
});

test("overlay upgrade rejects a replay-to-transaction race before Dove writes", () => {
  const root = createTempRoot("dove-project-overlay-transaction-race-");
  try {
    write(root, ".dove/state.json", "{\"keep\":true}\n");
    write(root, ".mcp.json", `${JSON.stringify({ mcpServers: { dove: INSTALLED_DOVE_MCP_SERVER } })}\n`);
    const preview = previewProjectIntegrationOverlayUpgrade(root, { hosts: ["claude"], ...PACKAGE, now: SYNC_NOW });
    let injected = false;
    const fsOps = {
      ...fs,
      openSync(targetPath, flags, ...rest) {
        if (!injected && path.resolve(String(targetPath)) === path.resolve(root) && (flags & fs.constants.O_DIRECTORY) !== 0) {
          injected = true;
          write(root, ".mcp.json", `${JSON.stringify({ changedAfterReplay: true, mcpServers: { dove: INSTALLED_DOVE_MCP_SERVER } })}\n`);
        }
        return fs.openSync(targetPath, flags, ...rest);
      }
    };

    assert.throws(
      () => overlayUpgradeProjectIntegration(root, { confirmed: true, preview, hosts: ["claude"], ...PACKAGE, now: SYNC_NOW, fsOps }),
      /approved precondition changed.*\.mcp\.json/iu
    );
    assert.equal(injected, true);
    assert.equal(fs.readFileSync(path.join(root, ".dove/state.json"), "utf8"), "{\"keep\":true}\n");
    assert.equal(fs.existsSync(preview.archiveTarget), false);
    assert.equal(fs.existsSync(path.join(root, INSTALLATION_MANIFEST_PATH)), false);
    assert.equal(fs.existsSync(path.join(root, ".claude/commands/dove/status.md")), false);
  } finally {
    cleanupTempRoot(root);
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
