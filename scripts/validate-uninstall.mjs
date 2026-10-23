import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  completeReinstallProjectIntegration,
  initializeProjectIntegration,
  previewProjectCompleteReinstall,
  previewProjectUninstall,
  uninstallProjectIntegration,
  updateProjectIntegration
} from "../src/core/project-installation.mjs";
import { DOVE_CLAUDE_STATUS_LINE, DOVE_CLAUDE_STOP_HOOK_ENTRY, DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_ENTRY } from "../src/core/ambient-policy.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import { semanticDigest, STOP_SELECTOR } from "../src/core/project-installation-resources.mjs";
import { inspectProjectDoctor } from "../src/core/project-doctor.mjs";
import { resolveTempWorkspaceBase } from "./temp-workspace.mjs";
import { inspectProjectRoot, resolveProjectRootForInit } from "../src/core/project-root.mjs";
import {
  EXA_MCP_FRAGMENT,
  EXA_MCP_SELECTOR,
  EXA_MCP_SERVER_NAME,
  WEB_FETCH_DENY_PERMISSION,
  WEB_FETCH_DENY_SELECTOR
} from "../src/core/web-access-integration.mjs";

const scratchRoot = resolveTempWorkspaceBase();
const referencePaths = [".dove/install/AUTHOR_PREFERENCES_FULL.md", ".dove/install/AUTHOR_PREFERENCES.md", ".dove/install/RESEARCH_QUALITY.md", ".dove/install/TOPIC_CRITERIA.md"];
fs.mkdirSync(scratchRoot, { recursive: true });
let fixture;
const userPromptHook = { hooks: [{ type: "command", command: "project prompt hook" }] };

function reset() {
  fixture = fs.mkdtempSync(path.join(scratchRoot, "dove-uninstall-"));
  fs.mkdirSync(path.join(fixture, ".git"));
  fs.writeFileSync(path.join(fixture, "package.json"), "{}\n");
  fs.mkdirSync(path.join(fixture, ".claude"), { recursive: true });
  fs.writeFileSync(path.join(fixture, ".claude", "settings.json"), `${JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "command", command: "project hook" }] }], UserPromptSubmit: [userPromptHook] }, enabledPlugins: { demo: true } }, null, 2)}\n`);
  fs.writeFileSync(path.join(fixture, ".mcp.json"), `${JSON.stringify({ mcpServers: { other: { type: "stdio", command: "other" } } }, null, 2)}\n`);
}

function digest(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function treeSnapshot(directory = fixture) {
  return fs.readdirSync(directory).sort().flatMap((name) => {
    const file = path.join(directory, name);
    const stat = fs.lstatSync(file);
    const entry = [path.relative(fixture, file), stat.mode, stat.isFile() ? digest(file) : null];
    return stat.isDirectory() ? [entry, ...treeSnapshot(file)] : [entry];
  });
}

reset();
const initialized = initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
assert.equal(initialized.manifest.managed.some((entry) => entry.selector === EXA_MCP_SELECTOR), true, "missing Exa is installed and owned");
const initializedSettings = JSON.parse(fs.readFileSync(path.join(fixture, ".claude", "settings.json"), "utf8"));
assert.deepEqual(initializedSettings.statusLine, DOVE_CLAUDE_STATUS_LINE);
assert.deepEqual(initializedSettings.hooks.UserPromptSubmit, [userPromptHook, DOVE_CLAUDE_USER_PROMPT_SUBMIT_HOOK_ENTRY]);
assert.deepEqual(initializedSettings.hooks.Stop, [DOVE_CLAUDE_STOP_HOOK_ENTRY]);
assert.equal(initializedSettings.permissions?.deny?.includes(WEB_FETCH_DENY_PERMISSION) ?? false, false, "Dove leaves WebFetch available");
const initializedMcp = JSON.parse(fs.readFileSync(path.join(fixture, ".mcp.json"), "utf8"));
assert.deepEqual(initializedMcp.mcpServers[EXA_MCP_SERVER_NAME], EXA_MCP_FRAGMENT);
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
for (const relativePath of referencePaths) assert.equal(preview.removedPaths.includes(relativePath), true);
for (const relativePath of [".dove/install/DOCTOR.md", ".dove/install/unknown.bin", ".dove/research/RESEARCH.md", ".dove/reviews/review-preserve/review.json", ".dove/runs/run-preserve/run.jsonl"]) {
  assert.equal(preview.removedPaths.includes(relativePath), false);
}
assert(preview.removedPaths.includes(".claude/agents/dove.md"));
assert(preview.removedPaths.includes(".claude/commands/dove/research.md"));
assert.throws(() => uninstallProjectIntegration(fixture, { confirmed: true }), /approved uninstall preview/u);
const wrongActionPreview = previewProjectCompleteReinstall(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
assert.throws(
  () => uninstallProjectIntegration(fixture, { confirmed: true, preview: wrongActionPreview }),
  /approved uninstall preview/u
);
const targetMismatchPreview = { ...preview, target: `${fixture}-other` };
assert.throws(
  () => uninstallProjectIntegration(fixture, { confirmed: true, preview: targetMismatchPreview }),
  /preview is stale/u
);
fs.rmSync(path.join(fixture, ".claude/commands/dove/research.md"));
assert.throws(
  () => uninstallProjectIntegration(fixture, { confirmed: true, preview }),
  /preview is stale/u
);
const result = uninstallProjectIntegration(fixture, { confirmed: true, preview: previewProjectUninstall(fixture) });
assert.equal(result.status, "uninstalled");
assert.equal(fs.existsSync(path.join(fixture, ".dove", "install", "manifest.json")), false);
assert.equal(fs.existsSync(legacyMarker), true);
assert.equal(fs.existsSync(path.join(fixture, ".claude", "agents", "dove.md")), false);
assert.equal(fs.existsSync(path.join(fixture, ".claude", "commands", "dove", "research.md")), false);
for (const relativePath of referencePaths) assert.equal(fs.existsSync(path.join(fixture, relativePath)), false);
assert.deepEqual({ doctor: digest(doctor), research: digest(research), review: digest(reviewRecord), run: digest(runRecord) }, before);
const settings = JSON.parse(fs.readFileSync(path.join(fixture, ".claude", "settings.json"), "utf8"));
assert.equal(settings.statusLine, undefined);
assert.deepEqual(settings.hooks.UserPromptSubmit, [userPromptHook]);
assert.equal(settings.hooks.Stop, undefined, "uninstall removes Dove's own Stop hook");
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
assert.deepEqual(postUninstallDoctor.actions, [{ kind: "init", command: `dove init --project '${fixture.replace(/'/gu, "'\\\\''")}'` }]);
assert.equal(resolveProjectRootForInit(fixture), fixture);

reset();
const preexistingStatusLineSettingsPath = path.join(fixture, ".claude", "settings.json");
const preexistingStatusLineSettings = JSON.parse(fs.readFileSync(preexistingStatusLineSettingsPath, "utf8"));
preexistingStatusLineSettings.statusLine = { type: "command", command: "custom-statusline" };
fs.writeFileSync(preexistingStatusLineSettingsPath, `${JSON.stringify(preexistingStatusLineSettings, null, 2)}\n`);
const preexistingStatusLineInit = initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
assert.equal(preexistingStatusLineInit.manifest.managed.some((entry) => entry.selector === "/statusLine[dove-project-directory]"), false);
assert.deepEqual(JSON.parse(fs.readFileSync(preexistingStatusLineSettingsPath, "utf8")).statusLine, { type: "command", command: "custom-statusline" });
assert.equal(updateProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }).status, "unchanged");
uninstallProjectIntegration(fixture, { confirmed: true, preview: previewProjectUninstall(fixture) });
assert.deepEqual(JSON.parse(fs.readFileSync(preexistingStatusLineSettingsPath, "utf8")).statusLine, { type: "command", command: "custom-statusline" });

reset();
const preexistingExaPath = path.join(fixture, ".mcp.json");
const preexistingExaConfig = JSON.parse(fs.readFileSync(preexistingExaPath, "utf8"));
// Reverse the canonical key order so equality is semantic, not serialized bytes.
preexistingExaConfig.mcpServers[EXA_MCP_SERVER_NAME] = { type: EXA_MCP_FRAGMENT.type, url: EXA_MCP_FRAGMENT.url };
fs.writeFileSync(preexistingExaPath, `${JSON.stringify(preexistingExaConfig, null, 2)}\n`);
const assertUnownedExa = () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(fixture, ".dove/install/manifest.json"), "utf8"));
  assert.equal(manifest.managed.some((entry) => entry.selector === EXA_MCP_SELECTOR), false);
  assert.equal(JSON.stringify(JSON.parse(fs.readFileSync(preexistingExaPath, "utf8")).mcpServers[EXA_MCP_SERVER_NAME]), JSON.stringify(preexistingExaConfig.mcpServers[EXA_MCP_SERVER_NAME]), "same-value Exa is not overwritten");
};
initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
assertUnownedExa();
const preexistingExaBytes = fs.readFileSync(preexistingExaPath);
const preexistingExaUpdate = updateProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
assert.equal(preexistingExaUpdate.status, "unchanged");
assert.equal(preexistingExaUpdate.changedPaths.includes(".mcp.json"), false);
assertUnownedExa();
const preexistingExaPreview = previewProjectCompleteReinstall(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
assert.equal(preexistingExaPreview.changedPaths.includes(".mcp.json"), false);
const preexistingExaReinstall = completeReinstallProjectIntegration(fixture, {
  packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, confirmed: true, preview: preexistingExaPreview
});
assert.equal(preexistingExaReinstall.changedPaths.includes(".mcp.json"), false);
assert.deepEqual(fs.readFileSync(preexistingExaPath), preexistingExaBytes);
assertUnownedExa();
uninstallProjectIntegration(fixture, { confirmed: true, preview: previewProjectUninstall(fixture) });
assert.deepEqual(JSON.parse(fs.readFileSync(preexistingExaPath, "utf8")), preexistingExaConfig, "uninstall keeps the preexisting Exa and other user MCP configuration");

for (const alreadyInitialized of [false, true]) {
  reset();
  if (alreadyInitialized) {
    initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
    const manifestPath = path.join(fixture, ".dove/install/manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.managed = manifest.managed.filter((entry) => entry.selector !== EXA_MCP_SELECTOR);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const mcpPath = path.join(fixture, ".mcp.json");
  const config = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
  config.mcpServers[EXA_MCP_SERVER_NAME] = { ...EXA_MCP_FRAGMENT, url: "https://example.invalid/local-exa" };
  fs.writeFileSync(mcpPath, `${JSON.stringify(config, null, 2)}\n`);
  const before = treeSnapshot();
  const conflict = /cannot claim conflicting content at \.mcp\.json#\/mcpServers\/exa/u;
  if (alreadyInitialized) {
    assert.throws(() => updateProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }), conflict);
    assert.throws(() => previewProjectCompleteReinstall(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }), conflict);
    assert.throws(() => completeReinstallProjectIntegration(fixture, {
      packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, confirmed: true, preview: { action: "reinstall" }
    }), conflict);
  } else {
    assert.throws(() => initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] }), conflict);
  }
  assert.deepEqual(treeSnapshot(), before, "unowned conflicting Exa never authorizes partial writes");
}

reset();
initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
const ownedExaPath = path.join(fixture, ".mcp.json");
const driftOwnedExa = () => {
  const config = JSON.parse(fs.readFileSync(ownedExaPath, "utf8"));
  config.mcpServers[EXA_MCP_SERVER_NAME].url = "https://example.invalid/edited-owned-exa";
  fs.writeFileSync(ownedExaPath, `${JSON.stringify(config, null, 2)}\n`);
};
driftOwnedExa();
const ownedExaUpdate = updateProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
assert.deepEqual(ownedExaUpdate.replacedLocalEdits, [{ path: ".mcp.json", selector: EXA_MCP_SELECTOR }]);
assert.equal(ownedExaUpdate.manifest.managed.some((entry) => entry.selector === EXA_MCP_SELECTOR), true);
assert.deepEqual(JSON.parse(fs.readFileSync(ownedExaPath, "utf8")).mcpServers[EXA_MCP_SERVER_NAME], EXA_MCP_FRAGMENT);
driftOwnedExa();
completeReinstallProjectIntegration(fixture, {
  packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, confirmed: true,
  preview: previewProjectCompleteReinstall(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION })
});
assert.deepEqual(JSON.parse(fs.readFileSync(ownedExaPath, "utf8")).mcpServers[EXA_MCP_SERVER_NAME], EXA_MCP_FRAGMENT);
uninstallProjectIntegration(fixture, { confirmed: true, preview: previewProjectUninstall(fixture) });
assert.equal(JSON.parse(fs.readFileSync(ownedExaPath, "utf8")).mcpServers[EXA_MCP_SERVER_NAME], undefined);

reset();
initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
const userStatusLineSettingsPath = path.join(fixture, ".claude", "settings.json");
const userStatusLineSettings = JSON.parse(fs.readFileSync(userStatusLineSettingsPath, "utf8"));
userStatusLineSettings.statusLine = { type: "command", command: "user-statusline" };
fs.writeFileSync(userStatusLineSettingsPath, `${JSON.stringify(userStatusLineSettings, null, 2)}\n`);
uninstallProjectIntegration(fixture, { confirmed: true, preview: previewProjectUninstall(fixture) });
assert.deepEqual(JSON.parse(fs.readFileSync(userStatusLineSettingsPath, "utf8")).statusLine, { type: "command", command: "user-statusline" });

reset();
initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
const stopSettingsPath = path.join(fixture, ".claude", "settings.json");
const stopSettings = JSON.parse(fs.readFileSync(stopSettingsPath, "utf8"));
assert.deepEqual(stopSettings.hooks.Stop, [DOVE_CLAUDE_STOP_HOOK_ENTRY]);
const stopManifest = JSON.parse(fs.readFileSync(path.join(fixture, ".dove/install/manifest.json"), "utf8"));
assert.deepEqual(stopManifest.managed.find((entry) => entry.selector === STOP_SELECTOR)?.digest, semanticDigest(DOVE_CLAUDE_STOP_HOOK_ENTRY));
const userStop = { hooks: [{ type: "command", command: "user-owned-stop", timeout: 5 }] };
stopSettings.hooks.Stop = [userStop, ...stopSettings.hooks.Stop];
fs.writeFileSync(stopSettingsPath, `${JSON.stringify(stopSettings, null, 2)}\n`);
uninstallProjectIntegration(fixture, { confirmed: true, preview: previewProjectUninstall(fixture) });
assert.deepEqual(JSON.parse(fs.readFileSync(stopSettingsPath, "utf8")).hooks.Stop, [userStop], "uninstall keeps the user's own Stop hook");

reset();
initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
const editedStopSettingsPath = path.join(fixture, ".claude", "settings.json");
const editedStopSettings = JSON.parse(fs.readFileSync(editedStopSettingsPath, "utf8"));
editedStopSettings.hooks.Stop = [{ hooks: [{ ...DOVE_CLAUDE_STOP_HOOK_ENTRY.hooks[0], timeout: 20 }] }];
fs.writeFileSync(editedStopSettingsPath, `${JSON.stringify(editedStopSettings, null, 2)}\n`);
assert.throws(() => previewProjectUninstall(fixture), /ownership drift/u, "an edited Dove Stop is not removed silently");

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
uninstallProjectIntegration(fixture, { confirmed: true, preview: previewProjectUninstall(fixture) });
assert.equal(fs.existsSync(unrecognizedMarker), true);

reset();
fs.writeFileSync(path.join(fixture, ".claude", "settings.json"), `${JSON.stringify({
  permissions: { deny: [WEB_FETCH_DENY_PERMISSION] }
}, null, 2)}\n`);
initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
const preexistingPermissionManifest = JSON.parse(fs.readFileSync(path.join(fixture, ".dove", "install", "manifest.json"), "utf8"));
assert.equal(preexistingPermissionManifest.managed.some((entry) => entry.selector === WEB_FETCH_DENY_SELECTOR), false);
uninstallProjectIntegration(fixture, { confirmed: true, preview: previewProjectUninstall(fixture) });
const preexistingPermissionAfterUninstall = JSON.parse(fs.readFileSync(path.join(fixture, ".claude", "settings.json"), "utf8"));
assert.deepEqual(preexistingPermissionAfterUninstall.permissions.deny, [WEB_FETCH_DENY_PERMISSION]);

for (const relativePath of referencePaths) {
  reset();
  initializeProjectIntegration(fixture, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"] });
  const referenceFile = path.join(fixture, relativePath);
  const unknownInstallFile = path.join(fixture, ".dove/install/unknown.bin");
  const unknownBytes = Buffer.from([0xff, 0x00, 0x01]);
  fs.writeFileSync(unknownInstallFile, unknownBytes);
  const canonicalBytes = fs.readFileSync(referenceFile);
  fs.appendFileSync(referenceFile, "local reference edit\n");
  const observedPaths = [relativePath, ".dove/install/manifest.json", ".claude/settings.json", ".claude/commands/dove/research.md"];
  const observe = () => observedPaths.map((file) => digest(path.join(fixture, file)));
  const before = observe();
  assert.throws(() => previewProjectUninstall(fixture), /ownership drift/u);
  assert.throws(() => uninstallProjectIntegration(fixture, { confirmed: true }), /approved uninstall preview/u);
  assert.deepEqual(observe(), before, "Uninstall must not partially remove integration after reference drift.");

  const options = { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION };
  const preview = previewProjectCompleteReinstall(fixture, options);
  assert.equal(preview.replacedPaths.includes(relativePath), true);
  fs.appendFileSync(referenceFile, "changed after preview\n");
  const changed = observe();
  assert.throws(() => completeReinstallProjectIntegration(fixture, { ...options, preview, confirmed: true }), /preview is stale/u);
  assert.deepEqual(observe(), changed);
  completeReinstallProjectIntegration(fixture, {
    ...options, confirmed: true, preview: previewProjectCompleteReinstall(fixture, options)
  });
  assert.deepEqual(fs.readFileSync(referenceFile), canonicalBytes);

  // A missing owned reference does not block removal of the remaining integration.
  fs.rmSync(referenceFile);
  const missingPreview = previewProjectUninstall(fixture);
  assert.equal(missingPreview.removedPaths.includes(relativePath), false);
  for (const other of referencePaths.filter((file) => file !== relativePath)) assert.equal(missingPreview.removedPaths.includes(other), true);
  uninstallProjectIntegration(fixture, { confirmed: true, preview: previewProjectUninstall(fixture) });
  for (const file of [...referencePaths, ".dove/install/manifest.json"]) assert.equal(fs.existsSync(path.join(fixture, file)), false);
  assert.equal(fs.existsSync(path.join(fixture, ".dove/research/RESEARCH.md")), true);
  assert.equal(missingPreview.removedPaths.includes(".dove/install/unknown.bin"), false);
  assert.deepEqual(fs.readFileSync(unknownInstallFile), unknownBytes);
  assert.equal(inspectProjectRoot(fixture).state, "blocked", "Preserved unknown installation residue is not a clean uninitialized project.");
  assert.throws(() => resolveProjectRootForInit(fixture), /installation directory is incomplete/u);
}

console.log(JSON.stringify({ status: "passed", checks: ["exact reference removal", "unowned same-value Exa lifecycle preservation", "unowned conflicting Exa refusal without writes", "owned Exa management", "reference drift and stale reinstall", "missing reference uninstall", "research and unknown installation preservation"] }));
