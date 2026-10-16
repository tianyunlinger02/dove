import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  HOST_MIGRATION_PENDING_PATH, HOST_MIGRATION_REGISTERED_PATH, HOST_MIGRATION_TASK,
  hostMigrationContext, prepareHostMigration, readHostSettings, writeHostSettings
} from "../src/core/host-migration.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import { importProjectRoots, syncRegisteredProjects } from "../src/core/project-cascade.mjs";
import {
  completeReinstallProjectIntegration, initializeProjectIntegration, inspectProjectIntegration,
  previewProjectCompleteReinstall, syncProjectIntegration, updateProjectIntegration
} from "../src/core/project-installation.mjs";
import { readLastProjectSync } from "../src/core/project-registry.mjs";
import { sessionStartOutput } from "../src/core/session-start-hook.mjs";
import { inspectCurrentPromptGuidance, userPromptSubmitOutput } from "../src/core/user-prompt-submit-hook.mjs";

const ROOT = "/memory/dove/project";
const HOME = "/memory/dove/home";
const NOW = "2026-10-15T12:00:00.000Z";
const PENDING = path.join(ROOT, HOST_MIGRATION_PENDING_PATH);
const REGISTERED = path.join(ROOT, HOST_MIGRATION_REGISTERED_PATH);
const MANIFEST = `${ROOT}/.dove/install/manifest.json`;
const USER_SETTINGS = `${HOME}/config/dove/settings.json`;
const event = { hook_event_name: "UserPromptSubmit", prompt: "Continue the current task." };

// A transaction-capable Map, not a real project or a disk fixture. Production
// lifecycle and registry operations below receive this fsOps exclusively.
function memory(t) {
  for (const name of ["readFileSync", "writeFileSync", "appendFileSync", "mkdirSync", "mkdtempSync", "renameSync", "unlinkSync", "rmSync", "rmdirSync", "chmodSync", "statSync", "lstatSync", "realpathSync", "readdirSync"]) {
    t.mock.method(fs, name, () => assert.fail(`Unexpected disk I/O: ${name}`));
  }
  const nodes = new Map([["/", { type: "directory", mode: 0o700 }]]);
  const reads = [];
  const writes = [];
  const error = (code, file) => Object.assign(new Error(`${code}: ${file}`), { code });
  const get = (file) => { if (!nodes.has(file)) throw error("ENOENT", file); return nodes.get(file); };
  const stat = (file) => {
    const node = get(file);
    return { isDirectory: () => node.type === "directory", isFile: () => node.type === "file", isSymbolicLink: () => false, mode: node.mode, uid: process.getuid?.() };
  };
  const fsOps = {
    statSync: stat, lstatSync: stat,
    existsSync: (file) => nodes.has(file),
    realpathSync: (file) => { get(file); return file; },
    mkdirSync(file, options = {}) {
      if (nodes.has(file)) { if (options.recursive) return; throw error("EEXIST", file); }
      const parent = path.dirname(file);
      if (!nodes.has(parent) && options.recursive) fsOps.mkdirSync(parent, options);
      assert.equal(get(parent).type, "directory");
      nodes.set(file, { type: "directory", mode: options.mode ?? 0o700 });
      writes.push(file);
    },
    readFileSync(file, encoding) {
      reads.push(file);
      const node = get(file);
      assert.equal(node.type, "file");
      return encoding ? node.content.toString(encoding) : Buffer.from(node.content);
    },
    writeFileSync(file, content, options = {}) {
      if (options.flag === "wx" && nodes.has(file)) throw error("EEXIST", file);
      assert.equal(get(path.dirname(file)).type, "directory");
      const mode = nodes.get(file)?.mode ?? options.mode ?? 0o600;
      nodes.set(file, { type: "file", content: Buffer.from(content), mode });
      writes.push(file);
    },
    renameSync(from, to) {
      const node = get(from);
      assert.equal(get(path.dirname(to)).type, "directory");
      nodes.set(to, node);
      nodes.delete(from);
      writes.push(from, to);
    },
    readdirSync(directory, options = {}) {
      assert.equal(get(directory).type, "directory");
      return [...nodes.keys()].filter((file) => file !== directory && path.dirname(file) === directory).sort().map((file) => options.withFileTypes ? { name: path.basename(file), ...stat(file) } : path.basename(file));
    },
    chmodSync(file, mode) { get(file).mode = mode; writes.push(file); },
    unlinkSync(file) { assert.equal(get(file).type, "file"); nodes.delete(file); writes.push(file); },
    rmdirSync(file) { assert.equal(fsOps.readdirSync(file).length, 0); nodes.delete(file); writes.push(file); }
  };
  fsOps.mkdirSync(ROOT, { recursive: true });
  fsOps.mkdirSync(HOME, { recursive: true });
  const options = { fsOps, env: { HOME, XDG_CONFIG_HOME: `${HOME}/config` }, packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, now: NOW };
  const put = (file, content) => { fsOps.mkdirSync(path.dirname(file), { recursive: true }); fsOps.writeFileSync(file, content); };
  const text = (file) => get(file).content.toString("utf8");
  const snapshot = () => [...nodes].filter(([, node]) => node.type === "file").map(([file, node]) => [file, node.content.toString("utf8"), node.mode]).sort(([a], [b]) => a.localeCompare(b));
  writes.length = 0;
  return { fsOps, options, nodes, reads, writes, put, text, snapshot };
}

function seedResearch(store) {
  const originals = new Map([
    [`${ROOT}/.dove/research/IDENTITY.md`, "Mainline: Keep my exact words.\n".repeat(200)],
    [`${ROOT}/.dove/research/EVAL.md`, "Historical measurement and conclusion\n".repeat(300)],
    [`${ROOT}/.dove/research/MENTOR_NOTES.md`, "Mentor's own notes\n".repeat(400)],
    [`${ROOT}/.dove/research/watch/config.json`, '{"source":"draft","keywords":["garment"]}\n']
  ]);
  for (const [file, content] of originals) store.put(file, content);
  store.reads.length = 0;
  store.writes.length = 0;
  return originals;
}

function assertResearchUntouched(store, originals) {
  for (const [file, content] of originals) assert.equal(store.text(file), content);
  assert.equal(store.reads.some((file) => file.startsWith(`${ROOT}/.dove/research/`)), false);
  assert.equal(store.writes.some((file) => file.startsWith(`${ROOT}/.dove/research/`)), false);
}

test("host settings default off without creating a directory or file", (t) => {
  const store = memory(t);
  assert.deepEqual(readHostSettings(store.options), { hostMigration: false });
  assert.deepEqual(readHostSettings({ fsOps: store.fsOps, env: { HOME } }), { hostMigration: false });
  assert.deepEqual(store.writes, []);
  assert.equal(store.nodes.has(USER_SETTINGS), false);
  assert.equal(store.nodes.has(`${HOME}/config`), false);
});

test("host settings round-trip booleans through XDG and HOME without touching projects", (t) => {
  const store = memory(t);
  for (const hostMigration of [true, false]) {
    assert.deepEqual(writeHostSettings({ hostMigration }, store.options), { hostMigration });
    assert.deepEqual(readHostSettings(store.options), { hostMigration });
  }
  const homeOptions = { fsOps: store.fsOps, env: { HOME } };
  writeHostSettings({ hostMigration: true }, homeOptions);
  assert.deepEqual(readHostSettings(homeOptions), { hostMigration: true });
  assert.deepEqual(readHostSettings(store.options), { hostMigration: false });
  assert.equal(store.writes.some((file) => file.startsWith(`${ROOT}/`)), false);
  const before = store.snapshot();
  assert.throws(() => writeHostSettings({ hostMigration: "on" }, store.options), /boolean hostMigration/u);
  assert.deepEqual(store.snapshot(), before);
});

test("disabled installation and updates neither register nor read research for migration", (t) => {
  const store = memory(t);
  const originals = seedResearch(store);
  initializeProjectIntegration(ROOT, store.options);
  assert.equal(updateProjectIntegration(ROOT, store.options).status, "unchanged");
  assert.equal(syncProjectIntegration(ROOT, store.options).status, "unchanged");
  assert.equal(store.nodes.has(PENDING), false);
  assert.equal(store.nodes.has(REGISTERED), false);
  assert.equal(store.nodes.has(USER_SETTINGS), false);
  assertResearchUntouched(store, originals);
});

test("enabled installation only registers version, time and existing-record tasks beside integration", (t) => {
  const store = memory(t);
  const originals = seedResearch(store);
  writeHostSettings({ hostMigration: true }, store.options);
  const result = initializeProjectIntegration(ROOT, store.options);
  assert.ok(result.changedPaths.includes(HOST_MIGRATION_PENDING_PATH));
  assert.ok(result.changedPaths.includes(HOST_MIGRATION_REGISTERED_PATH));
  assert.deepEqual(JSON.parse(store.text(REGISTERED)), { version: PACKAGE_VERSION, task: HOST_MIGRATION_TASK });
  assert.ok(store.text(PENDING).includes(`Dove ${PACKAGE_VERSION}`));
  assert.ok(store.text(PENDING).includes(NOW));
  assert.ok(store.text(PENDING).includes(HOST_MIGRATION_TASK));
  const pending = store.text(PENDING);
  assert.equal(result.manifest.managed.some((entry) => entry.path === HOST_MIGRATION_PENDING_PATH || entry.path === HOST_MIGRATION_REGISTERED_PATH), false);
  assert.equal(inspectProjectIntegration(ROOT, store.options).status, "current", "migration metadata is not guidance drift");
  assert.equal(inspectCurrentPromptGuidance(ROOT, store.options).version, PACKAGE_VERSION);
  assertResearchUntouched(store, originals);
});

test("explicit upgrade carries the 3.4.0 backlog while preserving all existing research", (t) => {
  const store = memory(t);
  const originals = seedResearch(store);
  initializeProjectIntegration(ROOT, { ...store.options, packageVersion: "3.4.0" });
  writeHostSettings({ hostMigration: true }, store.options);
  store.reads.length = 0;
  store.writes.length = 0;
  const result = updateProjectIntegration(ROOT, store.options);
  assert.equal(result.manifest.package.version, PACKAGE_VERSION);
  assert.ok(result.changedPaths.includes(HOST_MIGRATION_PENDING_PATH));
  assertResearchUntouched(store, originals);
});

test("repeat sync preserves pending edits and completion deletion never re-registers that version", (t) => {
  const store = memory(t);
  writeHostSettings({ hostMigration: true }, store.options);
  initializeProjectIntegration(ROOT, store.options);
  store.put(PENDING, `${store.text(PENDING)}\nHost note: next mentor call.\n`);
  const pending = store.text(PENDING);
  assert.equal(syncProjectIntegration(ROOT, store.options).status, "unchanged");
  assert.equal(store.text(PENDING), pending);
  store.fsOps.unlinkSync(PENDING);
  for (const operation of [syncProjectIntegration, updateProjectIntegration]) assert.equal(operation(ROOT, store.options).status, "unchanged");
  const preview = previewProjectCompleteReinstall(ROOT, store.options);
  completeReinstallProjectIntegration(ROOT, { ...store.options, preview, confirmed: true });
  assert.equal(store.nodes.has(PENDING), false);
  assert.deepEqual(JSON.parse(store.text(REGISTERED)), { version: PACKAGE_VERSION, task: HOST_MIGRATION_TASK });
  assert.equal(hostMigrationContext(ROOT, store.options), "");
});

test("current integration can register once when enabled later without rewriting guidance", (t) => {
  const store = memory(t);
  initializeProjectIntegration(ROOT, store.options);
  const manifest = store.text(MANIFEST);
  writeHostSettings({ hostMigration: true }, store.options);
  const result = syncProjectIntegration(ROOT, store.options);
  assert.deepEqual(result.changedPaths, [HOST_MIGRATION_PENDING_PATH, HOST_MIGRATION_REGISTERED_PATH]);
  assert.equal(store.text(MANIFEST), manifest);
  assert.equal(inspectProjectIntegration(ROOT, store.options).status, "current");
});

test("this package does not register its task for another release or read research to infer work", (t) => {
  const store = memory(t);
  writeHostSettings({ hostMigration: true }, store.options);
  store.reads.length = 0;
  assert.deepEqual(prepareHostMigration(ROOT, { ...store.options, packageVersion: "0.0.0" }), []);
  assert.deepEqual(store.reads, []);
  assert.equal(store.nodes.has(PENDING), false);
});

test("changed migration content replaces an unfinished earlier notice instead of stacking it", (t) => {
  const store = memory(t);
  initializeProjectIntegration(ROOT, store.options);
  const older = "# Earlier pending work\nKeep this unfinished instruction.\n";
  store.put(PENDING, older);
  store.put(REGISTERED, '{"version":"3.4.0"}\n');
  writeHostSettings({ hostMigration: true }, store.options);
  syncProjectIntegration(ROOT, store.options);
  assert.ok(!store.text(PENDING).includes("Earlier pending work"));
  assert.equal((store.text(PENDING).match(/宿主迁移待办/gu) ?? []).length, 1);
  assert.ok(store.text(PENDING).includes(HOST_MIGRATION_TASK));
  assert.deepEqual(JSON.parse(store.text(REGISTERED)), { version: PACKAGE_VERSION, task: HOST_MIGRATION_TASK });
});

test("registered-project cascade uses the same settings and preserves statusLine drift", (t) => {
  const store = memory(t);
  const originals = seedResearch(store);
  initializeProjectIntegration(ROOT, { ...store.options, packageVersion: "3.4.0" });
  const settingsPath = `${ROOT}/.claude/settings.json`;
  const settings = JSON.parse(store.text(settingsPath));
  settings.statusLine.command = "node /memory/local-statusline.mjs";
  const localSettings = `${JSON.stringify(settings)}\n`;
  store.put(settingsPath, localSettings);
  importProjectRoots([ROOT], store.options);
  writeHostSettings({ hostMigration: true }, store.options);
  store.reads.length = 0;
  store.writes.length = 0;
  const result = syncRegisteredProjects(store.options);
  assert.equal(result.status, "current");
  assert.equal(result.projects[0].status, "updated");
  assert.ok(result.projects[0].changedPaths.includes(HOST_MIGRATION_PENDING_PATH));
  assert.deepEqual(result.projects[0].preservedLocalEdits, [{ path: ".claude/settings.json", selector: "/statusLine[dove-project-directory]" }]);
  assert.equal(store.text(settingsPath), localSettings);
  assert.equal(inspectProjectIntegration(ROOT, store.options).status, "needs-update");
  assert.equal(inspectCurrentPromptGuidance(ROOT, store.options).version, PACKAGE_VERSION);
  assert.equal(readLastProjectSync(store.options).projects[0].status, "updated");
  assertResearchUntouched(store, originals);
});

test("both existing hook events deliver pending work read-only at a natural task boundary", (t) => {
  const store = memory(t);
  writeHostSettings({ hostMigration: true }, store.options);
  initializeProjectIntegration(ROOT, store.options);
  const hookOptions = { ...store.options, project: ROOT };
  const before = store.snapshot();
  const guidance = inspectCurrentPromptGuidance(ROOT, store.options);
  store.writes.length = 0;
  const pending = store.text(PENDING).trim();
  const prompt = userPromptSubmitOutput(event, guidance, hookOptions);
  assert.ok(prompt.hookSpecificOutput.additionalContext.endsWith(pending));
  assert.ok(prompt.hookSpecificOutput.additionalContext.startsWith(`Dove ${PACKAGE_VERSION}`));
  for (const source of ["startup", "clear", "resume", "compact"]) {
    const output = sessionStartOutput({ hook_event_name: "SessionStart", source }, { status: "current" }, hookOptions);
    assert.ok(output.hookSpecificOutput.additionalContext.endsWith(pending), source);
  }
  assert.deepEqual(userPromptSubmitOutput(event, guidance, hookOptions), prompt, "pending is delivered until the host completes it");
  assert.deepEqual(store.writes, []);
  assert.deepEqual(store.snapshot(), before);
});

test("switching off restores original hook output without deleting or recreating pending work", (t) => {
  const store = memory(t);
  initializeProjectIntegration(ROOT, store.options);
  const hookOptions = { ...store.options, project: ROOT };
  const guidance = inspectCurrentPromptGuidance(ROOT, store.options);
  const baselinePrompt = userPromptSubmitOutput(event, guidance, hookOptions);
  const sessionEvent = { hook_event_name: "SessionStart", source: "resume" };
  const baselineSession = sessionStartOutput(sessionEvent, { status: "current" }, hookOptions);
  writeHostSettings({ hostMigration: true }, store.options);
  syncProjectIntegration(ROOT, store.options);
  assert.notDeepEqual(userPromptSubmitOutput(event, guidance, hookOptions), baselinePrompt);
  writeHostSettings({ hostMigration: false }, store.options);
  const pending = store.text(PENDING);
  const before = store.snapshot();
  store.writes.length = 0;
  store.reads.length = 0;
  assert.deepEqual(userPromptSubmitOutput(event, guidance, hookOptions), baselinePrompt);
  assert.deepEqual(sessionStartOutput(sessionEvent, { status: "current" }, hookOptions), baselineSession);
  assert.equal(syncProjectIntegration(ROOT, store.options).status, "unchanged");
  assert.equal(store.reads.includes(PENDING), false);
  assert.equal(store.reads.includes(REGISTERED), false);
  assert.equal(store.text(PENDING), pending);
  assert.deepEqual(store.writes, []);
  assert.deepEqual(store.snapshot(), before);
});

test("a new release with unchanged migration content registers nothing for a project that finished it", (t) => {
  const store = memory(t);
  initializeProjectIntegration(ROOT, store.options);
  store.put(REGISTERED, `${JSON.stringify({ version: "3.4.0", task: HOST_MIGRATION_TASK })}\n`);
  writeHostSettings({ hostMigration: true }, store.options);
  syncProjectIntegration(ROOT, store.options);
  assert.equal(store.nodes.has(PENDING), false);
  store.put(REGISTERED, `${JSON.stringify({ version: "3.4.0", task: "an older task" })}\n`);
  syncProjectIntegration(ROOT, store.options);
  assert.ok(store.text(PENDING).includes(HOST_MIGRATION_TASK));
});
