import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  DOVE_CLAUDE_AMBIENT_HOOK_COMMAND,
  DOVE_CLAUDE_AMBIENT_RULE_PATH,
  DOVE_CLAUDE_AMBIENT_SKILL_PATH,
  DOVE_CLAUDE_SETTINGS_PATH
} from "../../src/core/ambient-policy.mjs";
import { DOVE_MCP_CONFIG_PATH, INSTALLED_DOVE_MCP_SERVER, PACKAGE_RUNTIME_PATHS } from "../../src/core/command-manifest.mjs";
import {
  DOVE_CLAUDE_LOCAL_SETTINGS_PATH,
  DOVE_CLAUDE_MCP_APPROVAL_SELECTOR
} from "../../src/core/claude-project-settings.mjs";
import { inspectProjectDoctor } from "../../src/core/project-doctor.mjs";
import {
  INSTALLATION_MANIFEST_PATH,
  createProjectInstallationManifest,
  serializeProjectInstallationManifest
} from "../../src/core/project-installation-manifest.mjs";
import { PROJECT_HOST_IDS } from "../../src/core/host-registry.mjs";
import {
  createMinimalWorkspaceDocuments,
  materializeMinimalWorkspaceDirectory
} from "../../src/core/workspace-schema.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

const NOW = "2026-07-26T00:00:00.000Z";
const PACKAGE = { name: "@dove-research/cli", version: "0.5.0" };

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stable(item)]));
  }
  return value;
}

function writeJson(root, relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`);
}

function healthyProject(root) {
  const mcpServer = structuredClone(INSTALLED_DOVE_MCP_SERVER);
  const settings = {
    hooks: {
      UserPromptSubmit: [{ hooks: [{ type: "command", command: DOVE_CLAUDE_AMBIENT_HOOK_COMMAND, timeout: 10 }] }]
    }
  };
  const files = new Map([
    [DOVE_CLAUDE_AMBIENT_RULE_PATH, "# Dove ambient rule\n"],
    [DOVE_CLAUDE_AMBIENT_SKILL_PATH, "# Dove ambient skill\n"]
  ]);
  for (const [relativePath, content] of files) {
    const fullPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  writeJson(root, DOVE_CLAUDE_SETTINGS_PATH, settings);
  writeJson(root, DOVE_CLAUDE_LOCAL_SETTINGS_PATH, { enabledMcpjsonServers: ["dove"] });
  writeJson(root, DOVE_MCP_CONFIG_PATH, { mcpServers: { dove: mcpServer } });
  const managed = [
    ...[...files].map(([relativePath, content]) => ({
      path: relativePath,
      owner: `test:${relativePath}`,
      mode: "exclusive-file",
      selector: null,
      digest: digest(content)
    })),
    {
      path: DOVE_CLAUDE_SETTINGS_PATH,
      owner: "test:ambient-hook",
      mode: "json-fragment",
      selector: "/hooks/UserPromptSubmit[dove-user-prompt-submit]",
      digest: digest(JSON.stringify(stable(settings.hooks.UserPromptSubmit[0])))
    },
    {
      path: DOVE_CLAUDE_LOCAL_SETTINGS_PATH,
      owner: "test:mcp-approval",
      mode: "json-fragment",
      selector: DOVE_CLAUDE_MCP_APPROVAL_SELECTOR,
      digest: digest(JSON.stringify("dove"))
    },
    {
      path: DOVE_MCP_CONFIG_PATH,
      owner: "test:mcp",
      mode: "json-fragment",
      selector: "/mcpServers/dove",
      digest: digest(JSON.stringify(stable(mcpServer)))
    }
  ];
  const manifest = createProjectInstallationManifest({
    installationId: "installation-123e4567-e89b-42d3-a456-426614174000",
    package: PACKAGE,
    hosts: ["claude"],
    managed,
    createdAt: NOW,
    updatedAt: NOW
  }, { hostIds: PROJECT_HOST_IDS });
  fs.mkdirSync(path.join(root, ".dove-install"), { recursive: true });
  fs.writeFileSync(path.join(root, INSTALLATION_MANIFEST_PATH), serializeProjectInstallationManifest(manifest, { hostIds: PROJECT_HOST_IDS }));
  return { manifest, settings };
}

function healthyOptions(overrides = {}) {
  return {
    packageName: PACKAGE.name,
    packageVersion: PACKAGE.version,
    inspectPathExecutable: () => ({ found: true, usable: true, path: "/usr/local/bin/dove", state: "found" }),
    inspectClaudeConnection: () => ({ state: "connected", ready: true, message: null }),
    inspectCurrentIntegration: (root) => ({ status: "current", target: root, hosts: ["claude"], changedPaths: [] }),
    ...overrides
  };
}

function treeBytes(root) {
  const entries = [];
  function visit(directory, prefix = "") {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = prefix ? path.posix.join(prefix, entry.name) : entry.name;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        entries.push({ path: relativePath, type: "directory" });
        visit(fullPath, relativePath);
      } else if (entry.isSymbolicLink()) {
        entries.push({ path: relativePath, type: "symlink", target: fs.readlinkSync(fullPath) });
      } else {
        entries.push({ path: relativePath, type: "file", bytes: fs.readFileSync(fullPath).toString("base64") });
      }
    }
  }
  visit(root);
  return entries;
}

function withRoot(prefix, callback) {
  const root = createTempRoot(prefix);
  try {
    return callback(root);
  } finally {
    cleanupTempRoot(root);
  }
}

test("project doctor is zero-write and accepts initialized integration with absent workspace", () => withRoot("dove-doctor-absent-", (root) => {
  healthyProject(root);
  const before = treeBytes(root);
  const result = inspectProjectDoctor(root, healthyOptions());
  const after = treeBytes(root);

  assert.deepEqual(after, before);
  assert.equal(result.zeroWrite, true);
  assert.deepEqual(result.writes, []);
  assert.equal(result.projectIntegration.healthy, true);
  assert.equal(result.workspaceState.mode, "absent");
  assert.equal(result.workspaceState.healthy, true);
  assert.equal(result.healthy, true);
}));

test("project doctor returns diagnostics instead of throwing for uninitialized projects", () => withRoot("dove-doctor-uninitialized-", (root) => {
  const result = inspectProjectDoctor(root, healthyOptions());
  assert.equal(result.healthy, false);
  assert.equal(result.projectIntegration.state, "uninitialized");
  assert.equal(result.workspaceState.mode, "absent");
  assert.equal(result.hostRegistration.healthy, false);
  assert.equal(result.readiness.state, "blocked");
}));

test("project doctor accepts a healthy current workspace", () => withRoot("dove-doctor-workspace-", (root) => {
  healthyProject(root);
  const documents = createMinimalWorkspaceDocuments({ workspaceId: "workspace-doctor", mainline: "Validate doctor", createdAt: NOW });
  materializeMinimalWorkspaceDirectory(path.join(root, ".dove"), documents);
  const result = inspectProjectDoctor(root, healthyOptions());
  assert.equal(result.workspaceState.state, "current-healthy");
  assert.equal(result.workspaceState.mode, "current");
  assert.equal(result.workspaceState.healthy, true);
  assert.equal(result.healthy, true);
}));

test("project doctor reports self-consistent old integration as needs-sync", () => withRoot("dove-doctor-needs-sync-", (root) => {
  healthyProject(root);
  const result = inspectProjectDoctor(root, healthyOptions({
    inspectCurrentIntegration: (target) => ({
      status: "needs-sync",
      target,
      hosts: ["claude"],
      changedPaths: [".claude/commands/dove/workspace.md", ".dove-install/manifest.json"]
    })
  }));
  assert.equal(result.projectIntegration.healthy, false);
  assert.equal(result.projectIntegration.state, "needs-sync");
  assert.equal(result.projectIntegration.needsSync, true);
  assert.equal(result.readiness.state, "blocked");
  assert.equal(result.zeroWrite, true);
}));

test("project doctor reports missing project-local Dove MCP approval", () => withRoot("dove-doctor-approval-", (root) => {
  healthyProject(root);
  fs.rmSync(path.join(root, DOVE_CLAUDE_LOCAL_SETTINGS_PATH));
  const result = inspectProjectDoctor(root, healthyOptions({
    inspectCurrentIntegration: (target) => ({
      status: "needs-sync",
      target,
      hosts: ["claude"],
      changedPaths: [DOVE_CLAUDE_LOCAL_SETTINGS_PATH]
    })
  }));
  assert.equal(result.projectIntegration.state, "drifted");
  assert.equal(result.hostRegistration.approval.state, "missing");
  assert.equal(result.readiness.state, "blocked");
}));

test("project doctor reports manifest-managed drift", () => withRoot("dove-doctor-drift-", (root) => {
  healthyProject(root);
  fs.appendFileSync(path.join(root, DOVE_CLAUDE_AMBIENT_RULE_PATH), "drift\n");
  const result = inspectProjectDoctor(root, healthyOptions());
  assert.equal(result.projectIntegration.healthy, false);
  assert.deepEqual(result.projectIntegration.drifted, [DOVE_CLAUDE_AMBIENT_RULE_PATH]);
  assert.equal(result.healthy, false);
}));

test("project doctor reports malformed managed JSON as drift and continues registration checks", () => withRoot("dove-doctor-managed-json-", (root) => {
  healthyProject(root);
  fs.writeFileSync(path.join(root, DOVE_MCP_CONFIG_PATH), "{malformed\n");
  const result = inspectProjectDoctor(root, healthyOptions());
  assert.equal(result.projectIntegration.state, "drifted");
  assert.deepEqual(result.projectIntegration.drifted, [DOVE_MCP_CONFIG_PATH]);
  assert.equal(result.hostRegistration.mcp.state, "invalid");
  assert.equal(result.readiness.state, "blocked");
}));

test("project doctor requires archive reset for every legacy workspace schema", () => {
  withRoot("dove-doctor-schema10-", (root) => {
    healthyProject(root);
    fs.mkdirSync(path.join(root, ".dove"));
    writeJson(root, ".dove/manifest.json", { schemaVersion: 10 });
    const result = inspectProjectDoctor(root, healthyOptions());
    assert.equal(result.workspaceState.mode, "archive-reset-required");
    assert.equal(result.workspaceState.healthy, false);
  });
  withRoot("dove-doctor-schema9-", (root) => {
    healthyProject(root);
    fs.mkdirSync(path.join(root, ".dove"));
    writeJson(root, ".dove/manifest.json", { schemaVersion: 9 });
    const result = inspectProjectDoctor(root, healthyOptions());
    assert.equal(result.workspaceState.mode, "archive-reset-required");
    assert.equal(result.workspaceState.healthy, false);
  });
});

test("Claude MCP inspection binds the resolved project root in cwd and environment", () => withRoot("dove-doctor-claude-env-", (root) => {
  healthyProject(root);
  let invocation = null;
  const result = inspectProjectDoctor(root, healthyOptions({
    inspectClaudeConnection: undefined,
    spawnSync(command, args, options) {
      invocation = { command, args, options };
      return { status: 0, stdout: "Status: Connected\n", stderr: "" };
    }
  }));
  assert.equal(result.readiness.state, "connected");
  assert.equal(invocation.options.cwd, root);
  assert.equal(invocation.options.env.CLAUDE_PROJECT_DIR, root);
}));

test("project doctor requires Connected Claude readiness", () => withRoot("dove-doctor-readiness-", (root) => {
  healthyProject(root);
  for (const [state, expectedHealthy] of [["connected", true], ["pending-approval", false], ["failed", false], ["unavailable", false]]) {
    const result = inspectProjectDoctor(root, healthyOptions({ inspectClaudeConnection: () => ({ state, ready: state === "connected" }) }));
    assert.equal(result.readiness.state, state);
    assert.equal(result.readiness.healthy, expectedHealthy);
    assert.equal(result.healthy, expectedHealthy);
  }
}));

test("project doctor reports missing package runtime files", () => withRoot("dove-doctor-package-", (packageRoot) => withRoot("dove-doctor-package-project-", (root) => {
  healthyProject(root);
  for (const relativePath of PACKAGE_RUNTIME_PATHS) {
    const fullPath = path.join(packageRoot, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, "runtime\n");
  }
  fs.rmSync(path.join(packageRoot, "dist/index.mjs"));
  const result = inspectProjectDoctor(root, healthyOptions({
    packageRoot,
    executablePath: path.join(packageRoot, "bin/dove-package.mjs")
  }));
  assert.equal(result.userCli.healthy, false);
  assert.deepEqual(result.userCli.missing, ["dist/index.mjs"]);
  assert.equal(result.healthy, false);
})));

test("project doctor continues safely after a malformed installation marker", () => withRoot("dove-doctor-malformed-marker-", (root) => {
  fs.mkdirSync(path.join(root, ".dove-install"));
  fs.writeFileSync(path.join(root, INSTALLATION_MANIFEST_PATH), "{malformed\n");
  const result = inspectProjectDoctor(root, healthyOptions());
  assert.equal(result.projectIntegration.state, "invalid");
  assert.match(result.projectIntegration.error, /manifest|JSON|valid/u);
  assert.equal(result.workspaceState.mode, "absent");
  assert.equal(result.zeroWrite, true);
}));

test("project doctor reports unsupported copied runtime without reading workspace internals", () => withRoot("dove-doctor-legacy-runtime-", (root) => {
  healthyProject(root);
  const bundles = [
    ["bin/dove-package.mjs", "DOVE_MCP_SERVER_NAME\n"],
    ["dist/index.mjs", "createDoveMission\n"]
  ];
  for (const [relativePath, content] of bundles) {
    const fullPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  const result = inspectProjectDoctor(root, healthyOptions());
  assert.equal(result.legacyCopiedRuntime.detected, true);
  assert.equal(result.legacyCopiedRuntime.healthy, false);
  assert.equal(result.healthy, false);
}));
