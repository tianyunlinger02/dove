import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { initializeProjectIntegration, previewProjectUninstall, uninstallProjectIntegration, adoptProjectIntegration } from "../src/core/project-installation.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import { inspectProjectDoctor } from "../src/core/project-doctor.mjs";
import { inspectProjectRoot, resolveProjectRootForInit } from "../src/core/project-root.mjs";
import {
  EXA_MCP_FRAGMENT,
  EXA_MCP_SERVER_NAME,
  WEB_FETCH_DENY_PERMISSION,
  WEB_FETCH_DENY_SELECTOR
} from "../src/core/web-access-integration.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(path.dirname(root), ".dove-dev", "tmp", "uninstall-fixture");

function reset() {
  fs.rmSync(fixture, { recursive: true, force: true });
  fs.mkdirSync(fixture, { recursive: true });
  fs.writeFileSync(path.join(fixture, "package.json"), "{}\n");
  fs.mkdirSync(path.join(fixture, ".claude"), { recursive: true });
  fs.writeFileSync(path.join(fixture, ".claude", "settings.json"), `${JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "command", command: "project hook" }] }] }, enabledPlugins: { demo: true } }, null, 2)}\n`);
  fs.writeFileSync(path.join(fixture, ".mcp.json"), `${JSON.stringify({ mcpServers: { other: { type: "stdio", command: "other" } } }, null, 2)}\n`);
}

function digest(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function makeAdoptableProject() {
  reset();
  fs.mkdirSync(path.join(fixture, ".dove", "research"), { recursive: true });
  fs.writeFileSync(path.join(fixture, ".dove", "research", "RESEARCH.md"), "# Research\n\nResearcher-owned.\n");
  fs.writeFileSync(path.join(fixture, ".dove", "manifest.json"), `${JSON.stringify({
    schemaVersion: 9,
    manifestVersion: 1,
    workspaceId: "workspace-uninstall-adoption-validation",
    createdAt: "2026-07-17T10:56:07.603Z",
    packageVersion: "0.4.0"
  }, null, 2)}\n`);
}

reset();
initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude", "dsh"] });
const initializedSettings = JSON.parse(fs.readFileSync(path.join(fixture, ".claude", "settings.json"), "utf8"));
assert.deepEqual(initializedSettings.statusLine, { type: "command", command: 'dove hook statusline --project "$CLAUDE_PROJECT_DIR"' });
assert.equal(initializedSettings.permissions.deny.includes(WEB_FETCH_DENY_PERMISSION), true);
const initializedMcp = JSON.parse(fs.readFileSync(path.join(fixture, ".mcp.json"), "utf8"));
assert.deepEqual(initializedMcp.mcpServers[EXA_MCP_SERVER_NAME], EXA_MCP_FRAGMENT);
const statusline = spawnSync(process.execPath, [path.join(root, "bin", "dove.mjs"), "hook", "statusline", "--project", fixture], {
  cwd: fixture,
  input: JSON.stringify({ workspace: { project_dir: fixture } }),
  encoding: "utf8"
});
assert.equal(statusline.status, 0, statusline.stderr || statusline.stdout);
assert.equal(statusline.stdout.trim(), fs.realpathSync.native(fixture));
const doctor = path.join(fixture, ".dove", "install", "DOCTOR.md");
fs.writeFileSync(doctor, "preserve this feedback\n");
const research = path.join(fixture, ".dove", "research", "RESEARCH.md");
const legacyMarker = path.join(fixture, ".dove", "manifest.json");
fs.writeFileSync(legacyMarker, `${JSON.stringify({
  schemaVersion: 9,
  manifestVersion: 1,
  workspaceId: "workspace-uninstall-validation",
  createdAt: "2026-07-17T10:56:07.603Z",
  packageVersion: "0.4.0"
}, null, 2)}\n`);
const before = { doctor: digest(doctor), research: digest(research) };
const preview = previewProjectUninstall(fixture);
assert.equal(preview.action, "uninstall");
assert(preview.removedPaths.includes(".dove/install/manifest.json"));
assert(preview.removedPaths.includes(".dove/manifest.json"));
assert(preview.removedPaths.includes(".claude/agents/dove.md"));
assert(preview.removedPaths.includes(".dsh/skills/dove-research/SKILL.md"));
const result = uninstallProjectIntegration(fixture, { confirmed: true });
assert.equal(result.status, "uninstalled");
assert.equal(fs.existsSync(path.join(fixture, ".dove", "install", "manifest.json")), false);
assert.equal(fs.existsSync(legacyMarker), false);
assert.equal(fs.existsSync(path.join(fixture, ".claude", "agents", "dove.md")), false);
assert.equal(fs.existsSync(path.join(fixture, ".dsh", "skills", "dove-research", "SKILL.md")), false);
assert.deepEqual({ doctor: digest(doctor), research: digest(research) }, before);
const settings = JSON.parse(fs.readFileSync(path.join(fixture, ".claude", "settings.json"), "utf8"));
assert.equal(settings.statusLine, undefined);
assert.equal(settings.permissions, undefined);
assert.equal(settings.enabledPlugins.demo, true);
assert.equal(settings.hooks.SessionStart.length, 1);
assert.equal(settings.hooks.SessionStart[0].hooks[0].command, "project hook");
const mcp = JSON.parse(fs.readFileSync(path.join(fixture, ".mcp.json"), "utf8"));
assert.deepEqual(Object.keys(mcp.mcpServers), ["other"]);
assert.equal(inspectProjectRoot(fixture).state, "uninitialized");
const postUninstallDoctor = inspectProjectDoctor(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
assert.equal(postUninstallDoctor.adoption.state, "absent");
assert.equal(postUninstallDoctor.setup.mode, "init");
assert.equal(postUninstallDoctor.setup.reason, "preserved-research");
assert.deepEqual(postUninstallDoctor.actions, [{ kind: "init", command: "dove init" }]);
assert.equal(resolveProjectRootForInit(fixture), fixture);

reset();
initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
const stopSettingsPath = path.join(fixture, ".claude", "settings.json");
const stopSettings = JSON.parse(fs.readFileSync(stopSettingsPath, "utf8"));
stopSettings.hooks.Stop = [
  { hooks: [{ type: "command", command: "user-owned-stop", timeout: 5 }] },
  { hooks: [{ type: "command", command: 'dove hook stop --project "$CLAUDE_PROJECT_DIR"', timeout: 10 }] }
];
fs.writeFileSync(stopSettingsPath, `${JSON.stringify(stopSettings, null, 2)}\n`);
uninstallProjectIntegration(fixture, { confirmed: true });
const stopCleanedSettings = JSON.parse(fs.readFileSync(stopSettingsPath, "utf8"));
assert.deepEqual(stopCleanedSettings.hooks.Stop, [{ hooks: [{ type: "command", command: "user-owned-stop", timeout: 5 }] }]);

reset();
initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
const nonArrayStopSettingsPath = path.join(fixture, ".claude", "settings.json");
const nonArrayStopSettings = JSON.parse(fs.readFileSync(nonArrayStopSettingsPath, "utf8"));
nonArrayStopSettings.hooks.Stop = "user-owned-stop";
fs.writeFileSync(nonArrayStopSettingsPath, `${JSON.stringify(nonArrayStopSettings, null, 2)}\n`);
uninstallProjectIntegration(fixture, { confirmed: true });
const nonArrayStopCleanedSettings = JSON.parse(fs.readFileSync(nonArrayStopSettingsPath, "utf8"));
assert.equal(nonArrayStopCleanedSettings.hooks.Stop, "user-owned-stop");

reset();
initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
fs.appendFileSync(path.join(fixture, ".claude", "agents", "dove.md"), "drift\n");
assert.throws(() => previewProjectUninstall(fixture), /ownership drift/u);
assert.equal(fs.existsSync(path.join(fixture, ".dove", "install", "manifest.json")), true);

reset();
initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
const unrecognizedMarker = path.join(fixture, ".dove", "manifest.json");
fs.writeFileSync(unrecognizedMarker, `${JSON.stringify({ legacyWorkspace: true }, null, 2)}\n`);
const unrecognizedPreview = previewProjectUninstall(fixture);
assert.equal(unrecognizedPreview.removedPaths.includes(".dove/manifest.json"), false);
uninstallProjectIntegration(fixture, { confirmed: true });
assert.equal(fs.existsSync(unrecognizedMarker), true);

makeAdoptableProject();
fs.writeFileSync(path.join(fixture, ".claude", "settings.json"), `${JSON.stringify({
  permissions: { deny: [WEB_FETCH_DENY_PERMISSION] }
}, null, 2)}\n`);
adoptProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
const adoptedManifest = JSON.parse(fs.readFileSync(path.join(fixture, ".dove", "install", "manifest.json"), "utf8"));
assert.equal(adoptedManifest.managed.some((entry) => entry.selector === WEB_FETCH_DENY_SELECTOR), false);
uninstallProjectIntegration(fixture, { confirmed: true });
const adoptedSettingsAfterUninstall = JSON.parse(fs.readFileSync(path.join(fixture, ".claude", "settings.json"), "utf8"));
assert.deepEqual(adoptedSettingsAfterUninstall.permissions.deny, [WEB_FETCH_DENY_PERMISSION]);

console.log(JSON.stringify({ status: "passed" }));
