import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { initializeProjectIntegration, previewProjectUninstall, uninstallProjectIntegration } from "../src/core/project-installation.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import { inspectProjectDoctor } from "../src/core/project-doctor.mjs";
import { inspectProjectRoot, resolveProjectRootForInit } from "../src/core/project-root.mjs";

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

reset();
initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude", "dsh"] });
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
assert(preview.removedPaths.includes(".dsh/skills/dove-auto/SKILL.md"));
const result = uninstallProjectIntegration(fixture, { confirmed: true });
assert.equal(result.status, "uninstalled");
assert.equal(fs.existsSync(path.join(fixture, ".dove", "install", "manifest.json")), false);
assert.equal(fs.existsSync(legacyMarker), false);
assert.equal(fs.existsSync(path.join(fixture, ".claude", "agents", "dove.md")), false);
assert.equal(fs.existsSync(path.join(fixture, ".dsh", "skills", "dove-auto", "SKILL.md")), false);
assert.deepEqual({ doctor: digest(doctor), research: digest(research) }, before);
const settings = JSON.parse(fs.readFileSync(path.join(fixture, ".claude", "settings.json"), "utf8"));
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

console.log(JSON.stringify({ status: "passed" }));
