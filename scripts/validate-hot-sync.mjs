#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DOVE_CLAUDE_AMBIENT_HOOK_COMMAND,
  DOVE_CLAUDE_SESSION_START_HOOK_COMMAND
} from "../src/core/ambient-policy.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import { PAPER_SEARCH_MCP_FRAGMENT, PAPER_SEARCH_MCP_SERVER_NAME } from "../src/core/paper-search-integration.mjs";
import { adoptProjectIntegration, initializeProjectIntegration, previewProjectAdoption, synchronizeProjectIntegrationOnly } from "../src/core/project-installation.mjs";
import { INSTALLATION_MANIFEST_PATH } from "../src/core/project-installation-manifest.mjs";
import { RESEARCH_DEFAULT_DIRECTORY_PATHS, RESEARCH_DEFAULT_DOCUMENTS } from "../src/core/research-defaults.mjs";
import {
  EXA_MCP_FRAGMENT,
  EXA_MCP_SERVER_NAME,
  WEB_FETCH_DENY_PERMISSION,
  WEB_FETCH_DENY_SELECTOR
} from "../src/core/web-access-integration.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH_ROOT = path.join(path.dirname(ROOT), ".dove-dev", "tmp");
fs.mkdirSync(SCRATCH_ROOT, { recursive: true });

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function semanticDigest(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function writeJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function makeProject() {
  const root = fs.mkdtempSync(path.join(SCRATCH_ROOT, "dove-hot-sync-"));
  fs.mkdirSync(path.join(root, ".git"));
  initializeProjectIntegration(root, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, now: "2026-08-22T00:00:00.000Z" });
  return root;
}

function writeFile(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function makeAdoptableProject() {
  const root = fs.mkdtempSync(path.join(SCRATCH_ROOT, "dove-adopt-"));
  fs.mkdirSync(path.join(root, ".git"));
  fs.mkdirSync(path.join(root, ".dove"), { recursive: true });
  writeJson(path.join(root, ".dove", "manifest.json"), {
    schemaVersion: 9,
    manifestVersion: 1,
    workspaceId: "workspace-validation",
    createdAt: "2026-07-17T10:56:07.603Z",
    packageVersion: "0.4.0"
  });
  for (const relativePath of RESEARCH_DEFAULT_DIRECTORY_PATHS) fs.mkdirSync(path.join(root, relativePath), { recursive: true });
  for (const document of RESEARCH_DEFAULT_DOCUMENTS) writeFile(root, document.path, document.content);
  return root;
}

function researchSnapshot(root) {
  const paths = [
    ".dove/manifest.json",
    ".dove/install/DOCTOR.md",
    ".dove/private/state.json",
    ".dove-archive/old.md",
    ".dove/research/RESEARCH.md",
    ".dove/research/lessons/project-owned.md"
  ];
  return new Map(paths.filter((relativePath) => fs.existsSync(path.join(root, relativePath))).map((relativePath) => [relativePath, fs.readFileSync(path.join(root, relativePath))]));
}

function assertSnapshotUnchanged(root, before) {
  for (const [relativePath, bytes] of before.entries()) assert.deepEqual(fs.readFileSync(path.join(root, relativePath)), bytes, `${relativePath} changed during adoption`);
}

function readJson(target) {
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

function cliDove(args, options = {}) {
  return spawnSync(process.execPath, [path.join(ROOT, "bin", "dove.mjs"), ...args], {
    cwd: ROOT,
    encoding: "utf8",
    ...options
  });
}

function cliHook(root, name, payload) {
  return cliDove(["hook", name, "--project", root], { input: JSON.stringify(payload) });
}

const roots = [];
try {
  const bridgeRoot = makeProject();
  roots.push(bridgeRoot);
  const settingsPath = path.join(bridgeRoot, ".claude", "settings.json");
  const manifestPath = path.join(bridgeRoot, INSTALLATION_MANIFEST_PATH);
  const initializedMcp = readJson(path.join(bridgeRoot, ".mcp.json"));
  assert.deepEqual(initializedMcp.mcpServers[PAPER_SEARCH_MCP_SERVER_NAME], PAPER_SEARCH_MCP_FRAGMENT);
  assert.deepEqual(initializedMcp.mcpServers[EXA_MCP_SERVER_NAME], EXA_MCP_FRAGMENT);
  const researchPath = path.join(bridgeRoot, ".dove", "research", "RESEARCH.md");
  const customResearchPath = path.join(bridgeRoot, ".dove", "research", "claims", "custom.md");
  const retiredResearchPath = path.join(bridgeRoot, ".dove", "research", "LESSONS.md");

  const initializedSettings = readJson(settingsPath);
  assert.deepEqual(Object.keys(initializedSettings.hooks), ["UserPromptSubmit", "SessionStart"]);
  assert.equal(initializedSettings.permissions.deny.includes(WEB_FETCH_DENY_PERMISSION), true);

  fs.writeFileSync(researchPath, "# Researcher-owned mainline\n\nDo not rewrite.\n");
  fs.mkdirSync(path.dirname(customResearchPath), { recursive: true });
  fs.writeFileSync(customResearchPath, "custom evidence\n");
  fs.writeFileSync(retiredResearchPath, "retired but researcher-visible\n");
  const researchBefore = [researchPath, customResearchPath, retiredResearchPath].map((target) => fs.readFileSync(target));

  const oldSettings = readJson(settingsPath);
  delete oldSettings.hooks.SessionStart;
  oldSettings.hooks.UserPromptSubmit.push({ hooks: [{ type: "command", command: "user-owned-prompt", timeout: 5 }] });
  oldSettings.hooks.SessionStart = [{ hooks: [{ type: "command", command: "user-owned-session-start", timeout: 5 }] }];
  writeJson(settingsPath, oldSettings);
  const oldFragment = {
    UserPromptSubmit: oldSettings.hooks.UserPromptSubmit.find((entry) => entry.hooks?.some((hook) => hook.command?.includes("dove hook user-prompt-submit")))
  };
  const oldManifest = readJson(manifestPath);
  oldManifest.package.version = "2.9.0";
  oldManifest.managed.find((entry) => entry.path === ".claude/settings.json").digest = semanticDigest(oldFragment);
  writeJson(manifestPath, oldManifest);

  const prompt = cliHook(bridgeRoot, "user-prompt-submit", {
    hook_event_name: "UserPromptSubmit",
    cwd: bridgeRoot,
    prompt: "继续"
  });
  assert.equal(prompt.status, 0, prompt.stderr || prompt.stdout);
  assert.equal(prompt.stdout, "");
  const bridgedSettings = readJson(settingsPath);
  assert.equal(bridgedSettings.hooks.SessionStart.some((entry) => entry.hooks?.some((hook) => hook.command === 'dove hook session-start --project "$CLAUDE_PROJECT_DIR"')), true);
  assert.equal(bridgedSettings.hooks.SessionStart.some((entry) => entry.hooks?.some((hook) => hook.command === "user-owned-session-start")), true);
  assert.equal(bridgedSettings.hooks.UserPromptSubmit.some((entry) => entry.hooks?.some((hook) => hook.command === "user-owned-prompt")), true);
  assert.equal(readJson(manifestPath).package.version, PACKAGE_VERSION);
  [researchPath, customResearchPath, retiredResearchPath].forEach((target, index) => assert.deepEqual(fs.readFileSync(target), researchBefore[index]));

  const unchangedManifest = fs.readFileSync(manifestPath);
  const session = cliHook(bridgeRoot, "session-start", { hook_event_name: "SessionStart", cwd: bridgeRoot });
  assert.equal(session.status, 0, session.stderr || session.stdout);
  assert.equal(session.stdout, "");
  assert.deepEqual(fs.readFileSync(manifestPath), unchangedManifest);

  const dshRoot = fs.mkdtempSync(path.join(SCRATCH_ROOT, "dove-dsh-"));
  roots.push(dshRoot);
  fs.mkdirSync(path.join(dshRoot, ".git"));
  initializeProjectIntegration(dshRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["dsh"] });
  assert.equal(fs.existsSync(path.join(dshRoot, ".claude", "settings.json")), false);
  assert.equal(fs.existsSync(path.join(dshRoot, ".mcp.json")), false);

  const absentResearchRoot = makeProject();
  roots.push(absentResearchRoot);
  fs.rmSync(path.join(absentResearchRoot, ".dove", "research"), { recursive: true });
  synchronizeProjectIntegrationOnly(absentResearchRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  assert.equal(fs.existsSync(path.join(absentResearchRoot, ".dove", "research")), false);

  const driftRoot = makeProject();
  roots.push(driftRoot);
  const driftResearch = path.join(driftRoot, ".claude", "commands", "dove", "research.md");
  fs.appendFileSync(driftResearch, "drift\n");
  assert.throws(
    () => synchronizeProjectIntegrationOnly(driftRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }),
    /ownership drift/iu
  );

  const newerRoot = makeProject();
  roots.push(newerRoot);
  const newerManifestPath = path.join(newerRoot, INSTALLATION_MANIFEST_PATH);
  const newerManifest = readJson(newerManifestPath);
  newerManifest.package.version = "99.0.0";
  writeJson(newerManifestPath, newerManifest);
  assert.throws(
    () => synchronizeProjectIntegrationOnly(newerRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }),
    /hot sync refuses/iu
  );

  const mismatchRoot = makeProject();
  roots.push(mismatchRoot);
  const mismatchManifestPath = path.join(mismatchRoot, INSTALLATION_MANIFEST_PATH);
  const mismatchManifest = readJson(mismatchManifestPath);
  mismatchManifest.package.name = "not-dove";
  writeJson(mismatchManifestPath, mismatchManifest);
  assert.throws(
    () => synchronizeProjectIntegrationOnly(mismatchRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }),
    /hot sync refuses/iu
  );

  const stopRoot = makeProject();
  roots.push(stopRoot);
  const stopSettingsPath = path.join(stopRoot, ".claude", "settings.json");
  const oldStopSettings = readJson(stopSettingsPath);
  oldStopSettings.hooks.Stop = [
    { hooks: [{ type: "command", command: "user-owned-stop", timeout: 5 }] },
    { hooks: [{ type: "command", command: 'dove hook stop --project "$CLAUDE_PROJECT_DIR"', timeout: 10 }] }
  ];
  writeJson(stopSettingsPath, oldStopSettings);
  const stopManifest = readJson(path.join(stopRoot, INSTALLATION_MANIFEST_PATH));
  stopManifest.package.version = "2.9.0";
  stopManifest.managed.find((entry) => entry.path === ".claude/settings.json").digest = semanticDigest({
    UserPromptSubmit: oldStopSettings.hooks.UserPromptSubmit.find((entry) => entry.hooks?.some((hook) => hook.command?.includes("dove hook user-prompt-submit"))),
    SessionStart: oldStopSettings.hooks.SessionStart.find((entry) => entry.hooks?.some((hook) => hook.command?.includes("dove hook session-start"))),
    Stop: oldStopSettings.hooks.Stop.find((entry) => entry.hooks?.some((hook) => hook.command?.includes("dove hook stop")))
  });
  writeJson(path.join(stopRoot, INSTALLATION_MANIFEST_PATH), stopManifest);
  synchronizeProjectIntegrationOnly(stopRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  const cleanedStopSettings = readJson(stopSettingsPath);
  assert.equal(cleanedStopSettings.hooks.Stop.length, 1);
  assert.equal(cleanedStopSettings.hooks.Stop[0].hooks[0].command, "user-owned-stop");

  const nonArrayStopRoot = makeProject();
  roots.push(nonArrayStopRoot);
  const nonArrayStopSettingsPath = path.join(nonArrayStopRoot, ".claude", "settings.json");
  const nonArrayStopSettings = readJson(nonArrayStopSettingsPath);
  nonArrayStopSettings.hooks.Stop = "user-owned-stop";
  writeJson(nonArrayStopSettingsPath, nonArrayStopSettings);
  const nonArrayBefore = fs.readFileSync(nonArrayStopSettingsPath);
  synchronizeProjectIntegrationOnly(nonArrayStopRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  assert.deepEqual(fs.readFileSync(nonArrayStopSettingsPath), nonArrayBefore);

  const userStopRoot = makeProject();
  roots.push(userStopRoot);
  const userStopSettingsPath = path.join(userStopRoot, ".claude", "settings.json");
  const userStopSettings = readJson(userStopSettingsPath);
  userStopSettings.hooks.Stop = [{ hooks: [{ type: "command", command: "user-owned-stop", timeout: 10 }] }];
  writeJson(userStopSettingsPath, userStopSettings);
  const userStopBefore = fs.readFileSync(userStopSettingsPath);
  synchronizeProjectIntegrationOnly(userStopRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  assert.deepEqual(fs.readFileSync(userStopSettingsPath), userStopBefore);

  const stopCli = cliHook(userStopRoot, "stop", {
    hook_event_name: "Stop",
    cwd: userStopRoot,
    stop_hook_active: false,
    last_assistant_message: "internal phrasing"
  });
  assert.notEqual(stopCli.status, 0);
  assert.match(stopCli.stderr, /accepts only session-start, user-prompt-submit, or statusline/iu);

  const adoptionRoot = makeAdoptableProject();
  roots.push(adoptionRoot);
  writeFile(adoptionRoot, ".dove/install/DOCTOR.md", "# Doctor notes\n\nKeep this.\n");
  writeFile(adoptionRoot, ".dove/private/state.json", "{\"private\":true}\n");
  writeFile(adoptionRoot, ".dove-archive/old.md", "archived legacy state\n");
  writeFile(adoptionRoot, ".dove/research/RESEARCH.md", "# Researcher mainline\n\nPreserve exactly.\n");
  writeFile(adoptionRoot, ".dove/research/lessons/project-owned.md", "project-owned lesson\n");
  writeJson(path.join(adoptionRoot, ".mcp.json"), {
    mcpServers: {
      userServer: { type: "stdio", command: "user-server" }
    }
  });
  writeJson(path.join(adoptionRoot, ".claude", "settings.json"), {
    permissions: { deny: [WEB_FETCH_DENY_PERMISSION] },
    hooks: {
      OtherEvent: [{ hooks: [{ type: "command", command: "user-owned-other", timeout: 5 }] }]
    }
  });
  const adoptionBefore = researchSnapshot(adoptionRoot);
  const adoptionPreview = previewProjectAdoption(adoptionRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, now: "2026-08-22T00:00:01.000Z" });
  assert.equal(adoptionPreview.action, "adopt");
  assert.equal(adoptionPreview.confirmation.required, false);
  assert.equal(adoptionPreview.writtenPaths.includes(INSTALLATION_MANIFEST_PATH), true);
  assert.equal(adoptionPreview.changedPaths.some((relativePath) => relativePath.startsWith(".dove/research/")), false);
  assert.equal(adoptionPreview.removedPaths.length, 0);
  const adoptedCli = cliDove(["update", "--project", adoptionRoot, "--json"]);
  assert.equal(adoptedCli.status, 0, adoptedCli.stderr || adoptedCli.stdout);
  const adopted = JSON.parse(adoptedCli.stdout);
  assert.equal(adopted.status, "adopted");
  assert.equal(adopted.writtenPaths.includes(INSTALLATION_MANIFEST_PATH), true);
  assert.equal(adopted.changedPaths.some((relativePath) => relativePath.startsWith(".dove/research/")), false);
  assertSnapshotUnchanged(adoptionRoot, adoptionBefore);
  const adoptionManifest = readJson(path.join(adoptionRoot, INSTALLATION_MANIFEST_PATH));
  assert.equal(adoptionManifest.revision, "2.0");
  assert.equal(adoptionManifest.package.name, PACKAGE_NAME);
  assert.equal(adoptionManifest.package.version, PACKAGE_VERSION);
  assert.deepEqual(adoptionManifest.hosts, ["claude"]);
  assert.equal(adoptionManifest.managed.some((entry) => entry.selector === WEB_FETCH_DENY_SELECTOR), false);
  const adoptedSettings = readJson(path.join(adoptionRoot, ".claude", "settings.json"));
  assert.equal(adoptedSettings.hooks.OtherEvent.some((entry) => entry.hooks?.some((hook) => hook.command === "user-owned-other")), true);
  assert.equal(adoptedSettings.hooks.UserPromptSubmit.some((entry) => entry.hooks?.some((hook) => hook.command === DOVE_CLAUDE_AMBIENT_HOOK_COMMAND)), true);
  assert.equal(adoptedSettings.hooks.SessionStart.some((entry) => entry.hooks?.some((hook) => hook.command === DOVE_CLAUDE_SESSION_START_HOOK_COMMAND)), true);
  assert.equal(adoptedSettings.permissions.deny.includes(WEB_FETCH_DENY_PERMISSION), true);
  assert.equal(Object.hasOwn(adoptedSettings.hooks, "Stop"), false);
  const adoptedMcp = readJson(path.join(adoptionRoot, ".mcp.json"));
  assert.equal(adoptedMcp.mcpServers.userServer.command, "user-server");
  assert.deepEqual(adoptedMcp.mcpServers[PAPER_SEARCH_MCP_SERVER_NAME], PAPER_SEARCH_MCP_FRAGMENT);
  assert.deepEqual(adoptedMcp.mcpServers[EXA_MCP_SERVER_NAME], EXA_MCP_FRAGMENT);
  const unchangedAdoption = synchronizeProjectIntegrationOnly(adoptionRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  assert.equal(unchangedAdoption.status, "unchanged");

  const invalidAdoptionRoot = fs.mkdtempSync(path.join(SCRATCH_ROOT, "dove-invalid-adopt-"));
  roots.push(invalidAdoptionRoot);
  fs.mkdirSync(path.join(invalidAdoptionRoot, ".git"));
  fs.mkdirSync(path.join(invalidAdoptionRoot, ".dove"), { recursive: true });
  writeJson(path.join(invalidAdoptionRoot, ".dove", "manifest.json"), { legacyWorkspace: true });
  for (const relativePath of RESEARCH_DEFAULT_DIRECTORY_PATHS) fs.mkdirSync(path.join(invalidAdoptionRoot, relativePath), { recursive: true });
  for (const document of RESEARCH_DEFAULT_DOCUMENTS) writeFile(invalidAdoptionRoot, document.path, document.content);
  assert.throws(
    () => previewProjectAdoption(invalidAdoptionRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }),
    /legacy workspace marker/iu
  );

  const hookAdoptionRoot = makeAdoptableProject();
  roots.push(hookAdoptionRoot);
  const hookAdoption = cliHook(hookAdoptionRoot, "user-prompt-submit", {
    hook_event_name: "UserPromptSubmit",
    cwd: hookAdoptionRoot,
    prompt: "research this"
  });
  assert.notEqual(hookAdoption.status, 0);
  assert.match(hookAdoption.stderr, /not initialized/iu);
  assert.equal(fs.existsSync(path.join(hookAdoptionRoot, INSTALLATION_MANIFEST_PATH)), false);

  const exclusiveDriftAdoptionRoot = makeAdoptableProject();
  roots.push(exclusiveDriftAdoptionRoot);
  writeFile(exclusiveDriftAdoptionRoot, ".claude/commands/dove/research.md", "user-owned research command\n");
  assert.throws(
    () => adoptProjectIntegration(exclusiveDriftAdoptionRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }),
    /cannot claim conflicting content/iu
  );
  assert.equal(fs.existsSync(path.join(exclusiveDriftAdoptionRoot, INSTALLATION_MANIFEST_PATH)), false);

  const hookDriftAdoptionRoot = makeAdoptableProject();
  roots.push(hookDriftAdoptionRoot);
  writeJson(path.join(hookDriftAdoptionRoot, ".claude", "settings.json"), {
    hooks: {
      UserPromptSubmit: [{ hooks: [{ type: "command", command: "dove hook user-prompt-submit --project somewhere-else", timeout: 10 }] }]
    }
  });
  assert.throws(
    () => previewProjectAdoption(hookDriftAdoptionRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }),
    /cannot claim conflicting content/iu
  );
  assert.equal(fs.existsSync(path.join(hookDriftAdoptionRoot, INSTALLATION_MANIFEST_PATH)), false);

  const mcpDriftAdoptionRoot = makeAdoptableProject();
  roots.push(mcpDriftAdoptionRoot);
  writeJson(path.join(mcpDriftAdoptionRoot, ".mcp.json"), {
    mcpServers: {
      [PAPER_SEARCH_MCP_SERVER_NAME]: { type: "stdio", command: "other-paper-search" }
    }
  });
  assert.throws(
    () => previewProjectAdoption(mcpDriftAdoptionRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }),
    /cannot claim conflicting content/iu
  );
  assert.equal(fs.existsSync(path.join(mcpDriftAdoptionRoot, INSTALLATION_MANIFEST_PATH)), false);

  const exaDriftAdoptionRoot = makeAdoptableProject();
  roots.push(exaDriftAdoptionRoot);
  writeJson(path.join(exaDriftAdoptionRoot, ".mcp.json"), {
    mcpServers: {
      [EXA_MCP_SERVER_NAME]: { type: "stdio", command: "not-exa" }
    }
  });
  assert.throws(
    () => previewProjectAdoption(exaDriftAdoptionRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }),
    /cannot claim conflicting content/iu
  );
  assert.equal(fs.existsSync(path.join(exaDriftAdoptionRoot, INSTALLATION_MANIFEST_PATH)), false);

  const otherRoot = makeProject();
  roots.push(otherRoot);
  const mismatchCwd = cliHook(stopRoot, "session-start", { hook_event_name: "SessionStart", cwd: otherRoot });
  assert.notEqual(mismatchCwd.status, 0);
  assert.match(mismatchCwd.stderr, /does not belong/iu);

  console.log(JSON.stringify({ status: "passed" }, null, 2));
} finally {
  for (const root of roots.reverse()) fs.rmSync(root, { recursive: true, force: true });
}
