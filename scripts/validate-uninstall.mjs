import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  completeReinstallProjectIntegration,
  initializeProjectIntegration,
  previewProjectCompleteReinstall,
  previewProjectUninstall,
  uninstallProjectIntegration,
  updateProjectIntegration
} from "../src/core/project-installation.mjs";
import { DOVE_CLAUDE_STATUS_LINE } from "../src/core/ambient-policy.mjs";
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
const scratchRoot = path.join(root, ".dove-dev", "tmp");
fs.mkdirSync(scratchRoot, { recursive: true });
let fixture;

function reset() {
  fixture = fs.mkdtempSync(path.join(scratchRoot, "dove-uninstall-"));
  fs.mkdirSync(path.join(fixture, ".git"));
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
const initializedSettings = JSON.parse(fs.readFileSync(path.join(fixture, ".claude", "settings.json"), "utf8"));
assert.deepEqual(initializedSettings.statusLine, DOVE_CLAUDE_STATUS_LINE);
assert.equal(initializedSettings.permissions.deny.includes(WEB_FETCH_DENY_PERMISSION), true);
const initializedMcp = JSON.parse(fs.readFileSync(path.join(fixture, ".mcp.json"), "utf8"));
assert.deepEqual(initializedMcp.mcpServers[EXA_MCP_SERVER_NAME], EXA_MCP_FRAGMENT);
const statusline = spawnSync(process.execPath, [path.join(root, "bin", "dove.mjs"), "hook", "statusline", "--project", fixture], {
  cwd: fixture,
  input: JSON.stringify({
    model: { display_name: "gpt-5.6-sol(high)" },
    context_window: { context_window_size: 272_000, used_percentage: 76, remaining_percentage: 24 },
    cost: { total_duration_ms: ((54 * 60) + 34) * 60_000 }
  }),
  encoding: "utf8"
});
assert.equal(statusline.status, 0, statusline.stderr || statusline.stdout);
const statuslineParts = statusline.stdout.trim().split(" · ");
assert.equal(statuslineParts[0], "gpt-5.6-sol(high) (272K)");
assert.equal(statuslineParts[1], "ctx 24%");
assert.equal(statuslineParts.at(-1), "54h34m");
assert.equal(statusline.stdout.includes("ctx 76%"), false);
const doctor = path.join(fixture, ".dove", "install", "DOCTOR.md");
fs.writeFileSync(doctor, "preserve this feedback\n");
const reviewRecord = path.join(fixture, ".dove", "reviews", "review-preserve", "review.json");
fs.mkdirSync(path.dirname(reviewRecord), { recursive: true });
fs.writeFileSync(reviewRecord, "{\"schema\":\"user-owned-review\"}\n");
const runRecord = path.join(fixture, ".dove", "runs", "run-preserve", "run.jsonl");
fs.mkdirSync(path.dirname(runRecord), { recursive: true });
fs.writeFileSync(runRecord, "{\"schemaVersion\":\"dove.run.event.v1\",\"seq\":1,\"at\":\"2026-09-02T00:00:00.000Z\",\"type\":\"run.started\",\"runId\":\"run-preserve\"}\n");
const research = path.join(fixture, ".dove", "research", "RESEARCH.md");
const legacyMarker = path.join(fixture, ".dove", "manifest.json");
fs.writeFileSync(legacyMarker, `${JSON.stringify({
  schemaVersion: 9,
  manifestVersion: 1,
  workspaceId: "workspace-uninstall-validation",
  createdAt: "2026-07-17T10:56:07.603Z",
  packageVersion: "0.4.0"
}, null, 2)}\n`);
const before = { doctor: digest(doctor), research: digest(research), review: digest(reviewRecord), run: digest(runRecord) };
const preview = previewProjectUninstall(fixture);
assert.equal(preview.action, "uninstall");
assert(preview.removedPaths.includes(".dove/install/manifest.json"));
assert.equal(preview.removedPaths.includes(".dove/manifest.json"), false);
assert(preview.removedPaths.includes(".dove/install/RESEARCH_QUALITY.md"));
assert(preview.removedPaths.includes(".claude/agents/dove.md"));
assert(preview.removedPaths.includes(".dsh/skills/dove-research/SKILL.md"));
const result = uninstallProjectIntegration(fixture, { confirmed: true });
assert.equal(result.status, "uninstalled");
assert.equal(fs.existsSync(path.join(fixture, ".dove", "install", "manifest.json")), false);
assert.equal(fs.existsSync(legacyMarker), true);
assert.equal(fs.existsSync(path.join(fixture, ".claude", "agents", "dove.md")), false);
assert.equal(fs.existsSync(path.join(fixture, ".dsh", "skills", "dove-research", "SKILL.md")), false);
assert.deepEqual({ doctor: digest(doctor), research: digest(research), review: digest(reviewRecord), run: digest(runRecord) }, before);
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
assert.equal(postUninstallDoctor.setup.mode, "uninitialized");
assert.equal(postUninstallDoctor.setup.reason, "uninitialized");
assert.deepEqual(postUninstallDoctor.actions, [{ kind: "init", command: "dove init" }]);
assert.equal(resolveProjectRootForInit(fixture), fixture);

reset();
const preexistingStatusLineSettingsPath = path.join(fixture, ".claude", "settings.json");
const preexistingStatusLineSettings = JSON.parse(fs.readFileSync(preexistingStatusLineSettingsPath, "utf8"));
preexistingStatusLineSettings.statusLine = { type: "command", command: "trellis-statusline" };
fs.writeFileSync(preexistingStatusLineSettingsPath, `${JSON.stringify(preexistingStatusLineSettings, null, 2)}\n`);
const preexistingStatusLineInit = initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
assert.equal(preexistingStatusLineInit.manifest.managed.some((entry) => entry.selector === "/statusLine[dove-project-directory]"), false);
assert.deepEqual(JSON.parse(fs.readFileSync(preexistingStatusLineSettingsPath, "utf8")).statusLine, { type: "command", command: "trellis-statusline" });
assert.equal(updateProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }).status, "unchanged");
uninstallProjectIntegration(fixture, { confirmed: true });
assert.deepEqual(JSON.parse(fs.readFileSync(preexistingStatusLineSettingsPath, "utf8")).statusLine, { type: "command", command: "trellis-statusline" });

reset();
initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
const userStatusLineSettingsPath = path.join(fixture, ".claude", "settings.json");
const userStatusLineSettings = JSON.parse(fs.readFileSync(userStatusLineSettingsPath, "utf8"));
userStatusLineSettings.statusLine = { type: "command", command: "user-statusline" };
fs.writeFileSync(userStatusLineSettingsPath, `${JSON.stringify(userStatusLineSettings, null, 2)}\n`);
uninstallProjectIntegration(fixture, { confirmed: true });
assert.deepEqual(JSON.parse(fs.readFileSync(userStatusLineSettingsPath, "utf8")).statusLine, { type: "command", command: "user-statusline" });

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
assert.deepEqual(stopCleanedSettings.hooks.Stop, stopSettings.hooks.Stop);

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
const driftAgent = path.join(fixture, ".claude", "agents", "dove.md");
const driftSettings = path.join(fixture, ".claude", "settings.json");
const driftResearch = path.join(fixture, ".dove", "research", "RESEARCH.md");
const driftDoctor = path.join(fixture, ".dove", "install", "DOCTOR.md");
fs.writeFileSync(driftDoctor, "preserve drift repair feedback\n");
const settingsBeforeDrift = JSON.parse(fs.readFileSync(driftSettings, "utf8"));
settingsBeforeDrift.statusLine = { type: "command", command: "user-modified-dove-statusline" };
settingsBeforeDrift.enabledPlugins = { demo: true };
fs.writeFileSync(driftSettings, `${JSON.stringify(settingsBeforeDrift, null, 2)}\n`);
fs.appendFileSync(driftAgent, "drift\n");
const driftReview = path.join(fixture, ".dove", "reviews", "drift-review", "review.json");
fs.mkdirSync(path.dirname(driftReview), { recursive: true });
fs.writeFileSync(driftReview, "{\"schema\":\"preserve-review\"}\n");
const driftRun = path.join(fixture, ".dove", "runs", "drift-run", "run.jsonl");
fs.mkdirSync(path.dirname(driftRun), { recursive: true });
fs.writeFileSync(driftRun, "{\"schemaVersion\":\"dove.run.event.v1\",\"seq\":1,\"at\":\"2026-09-02T00:00:00.000Z\",\"type\":\"run.started\",\"runId\":\"drift-run\"}\n");
const driftPreservedBefore = { research: digest(driftResearch), doctor: digest(driftDoctor), review: digest(driftReview), run: digest(driftRun) };
const explicitUpdateRepair = updateProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
assert.deepEqual(explicitUpdateRepair.replacedLocalEdits, [
  { path: ".claude/settings.json", selector: "/statusLine[dove-project-directory]" },
  { path: ".claude/agents/dove.md", selector: null }
]);
fs.appendFileSync(driftAgent, "drift\n");
assert.throws(() => previewProjectUninstall(fixture), /ownership drift/u);
const reinstallPreview = previewProjectCompleteReinstall(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
assert(reinstallPreview.replacedPaths.includes(".claude/agents/dove.md"));
fs.appendFileSync(driftAgent, "after preview\n");
assert.throws(
  () => completeReinstallProjectIntegration(fixture, {
    packageName: PACKAGE_NAME,
    packageVersion: PACKAGE_VERSION,
    confirmed: true,
    preview: reinstallPreview
  }),
  /preview is stale/u
);
const refreshedPreview = previewProjectCompleteReinstall(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
completeReinstallProjectIntegration(fixture, {
  packageName: PACKAGE_NAME,
  packageVersion: PACKAGE_VERSION,
  confirmed: true,
  preview: refreshedPreview
});
const repairedSettings = JSON.parse(fs.readFileSync(driftSettings, "utf8"));
assert.deepEqual(repairedSettings.statusLine, DOVE_CLAUDE_STATUS_LINE);
assert.deepEqual(repairedSettings.enabledPlugins, { demo: true });
assert.equal(fs.readFileSync(driftAgent, "utf8").includes("after preview"), false);
assert.deepEqual({ research: digest(driftResearch), doctor: digest(driftDoctor), review: digest(driftReview), run: digest(driftRun) }, driftPreservedBefore);
assert.equal(fs.existsSync(path.join(fixture, ".dove", "install", "manifest.json")), true);

reset();
initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
const unrecognizedMarker = path.join(fixture, ".dove", "manifest.json");
fs.writeFileSync(unrecognizedMarker, `${JSON.stringify({ legacyWorkspace: true }, null, 2)}\n`);
const unrecognizedPreview = previewProjectUninstall(fixture);
assert.equal(unrecognizedPreview.removedPaths.includes(".dove/manifest.json"), false);
uninstallProjectIntegration(fixture, { confirmed: true });
assert.equal(fs.existsSync(unrecognizedMarker), true);

reset();
fs.writeFileSync(path.join(fixture, ".claude", "settings.json"), `${JSON.stringify({
  permissions: { deny: [WEB_FETCH_DENY_PERMISSION] }
}, null, 2)}\n`);
initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
const preexistingPermissionManifest = JSON.parse(fs.readFileSync(path.join(fixture, ".dove", "install", "manifest.json"), "utf8"));
assert.equal(preexistingPermissionManifest.managed.some((entry) => entry.selector === WEB_FETCH_DENY_SELECTOR), false);
uninstallProjectIntegration(fixture, { confirmed: true });
const preexistingPermissionAfterUninstall = JSON.parse(fs.readFileSync(path.join(fixture, ".claude", "settings.json"), "utf8"));
assert.deepEqual(preexistingPermissionAfterUninstall.permissions.deny, [WEB_FETCH_DENY_PERMISSION]);

console.log(JSON.stringify({ status: "passed" }));
