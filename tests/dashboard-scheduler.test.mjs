import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setImmediate as nextTurn, setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { build } from "esbuild";
import { createDashboardActions } from "../src/cli/dashboard-actions.mjs";
import { startDashboardServer } from "../src/cli/dashboard-server.mjs";
import { refreshUserOriginalsInBackground } from "../src/cli/user-originals-worker.mjs";
import { collectDashboard, readProjectDocument } from "../src/core/dashboard-data.mjs";
import { localDate, writeGlobalWatchSettings, writeWatchConfig } from "../src/core/paper-watch.mjs";
import { changeRegisteredProjects } from "../src/core/project-registry.mjs";
import { refreshUserOriginals, USER_ORIGINALS_INDEX_PATH, USER_ORIGINALS_PATH } from "../src/core/user-originals.mjs";

const execute = promisify(execFile);
const PACKAGE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const at = (day, hour = 8, minute = 0) => new Date(2026, 9, day, hour, minute);

function put(root, relative, content) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

function fixture(t, names = ["study"]) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "dove-dashboard-scheduler-"));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const env = { HOME: path.join(base, "home"), XDG_CONFIG_HOME: path.join(base, "config"), TMPDIR: os.tmpdir() };
  fs.mkdirSync(env.HOME);
  const projects = Object.fromEntries(names.map((name) => {
    const root = path.join(base, name);
    put(root, ".dove/research/IDENTITY.md", `Mainline: ${name}\n`);
    return [name, root];
  }));
  changeRegisteredProjects(Object.values(projects), [], { env });
  writeGlobalWatchSettings({ dailyHour: 8 }, { env });
  return { base, env, projects };
}

function tick(actions, date) {
  clearInterval(actions.startScheduler({ now: () => new Date(date), intervalMs: 1e9 }));
}

async function waitFor(condition) {
  const deadline = Date.now() + 10000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, "background work should finish within the test deadline");
    await delay(5);
  }
}

async function idle(actions) {
  await waitFor(() => {
    const state = actions.getSettings();
    return !state.userOriginalsRunning && !state.watchRunning;
  });
}

function session(env, root, text = "用户希望模型真正学会完整结构生成") {
  const directory = path.join(".claude/projects", root.replace(/[^A-Za-z0-9]/gu, "-"));
  return put(env.HOME, path.join(directory, "aaaaaaaa-session.jsonl"), `${JSON.stringify({ type: "user", timestamp: "2026-10-16T07:00:00Z", message: { role: "user", content: text } })}\n`);
}

function snapshot(root) {
  return fs.readdirSync(root, { recursive: true }).sort().map((relative) => {
    const file = path.join(root, relative);
    const stat = fs.statSync(file);
    return [relative, stat.mtimeMs, stat.isDirectory() ? null : fs.readFileSync(file).toString("base64")];
  });
}

test("at dailyHour every existing registered project prewarms independently of watch eligibility", async (t) => {
  const { base, env, projects: p } = fixture(t, ["active", "disabled", "done", "unconfigured"]);
  const bare = path.join(base, "bare");
  fs.mkdirSync(bare);
  const missing = path.join(base, "missing");
  const file = put(base, "not-a-directory", "not a project");
  put(base, "unregistered/README.md", "not registered");
  changeRegisteredProjects([bare, missing, file], [], { env });
  writeGlobalWatchSettings({ dailyHour: 14 }, { env });
  writeWatchConfig(p.disabled, { enabled: false });
  put(p.done, ".dove/research/watch/state.json", JSON.stringify({ status: "done", lastRun: at(16, 13).toISOString() }));
  put(env.XDG_CONFIG_HOME, "dove/watch-state.json", JSON.stringify({ lastRunDate: localDate(at(16)), results: [{ root: p.unconfigured, status: "unconfigured" }] }));
  const warmed = [];
  const watched = [];
  const before = snapshot(base);
  const actions = createDashboardActions({ env, refreshOriginals: (root, options) => { warmed.push({ root, options }); }, run: async (roots) => { watched.push(roots); } });

  tick(actions, at(16, 13, 59));
  await nextTurn();
  assert.equal(warmed.length, 0);
  assert.equal(watched.length, 0);
  assert.deepEqual(snapshot(base), before);

  tick(actions, at(16, 14));
  await idle(actions);
  assert.deepEqual(warmed.map((item) => item.root), [...Object.values(p), bare].sort());
  assert.deepEqual(watched, [[p.active, bare].sort()]);
  for (const { options } of warmed) {
    assert.equal(options.home, env.HOME);
    assert.equal(options.env, env);
    assert.equal(options.budgetMs, 20000, "each project keeps its own 20-second scan budget");
  }
  assert.deepEqual(snapshot(base), before, "scheduling itself does not mutate research or create a schedule database");
});

test("prewarming deduplicates the local day, includes newly registered roots and resumes next day at dailyHour", async (t) => {
  const { base, env, projects: { study } } = fixture(t);
  const warmed = [];
  const actions = createDashboardActions({ env, refreshOriginals: (root) => { warmed.push(root); }, run: async () => {} });
  tick(actions, at(16));
  await idle(actions);
  tick(actions, at(16, 12));
  tick(actions, at(16, 23, 59));
  await idle(actions);
  assert.deepEqual(warmed, [study]);

  const added = path.join(base, "new-registration");
  fs.mkdirSync(added);
  changeRegisteredProjects([added], [], { env });
  tick(actions, at(16, 23, 59));
  await idle(actions);
  assert.deepEqual(warmed, [study, added]);
  tick(actions, at(17, 7, 59));
  await idle(actions);
  assert.deepEqual(warmed, [study, added]);
  tick(actions, at(17));
  await idle(actions);
  assert.deepEqual(warmed, [study, added, ...[study, added].sort()]);
});

test("successful derived output survives restart; a fresh mentor summary counts but an index alone does not", async (t) => {
  const { env, projects: p } = fixture(t, ["mentor-refreshed", "stale", "index-only"]);
  for (const name of ["mentor-refreshed", "stale"]) {
    refreshUserOriginals(p[name], { env });
    const date = at(name === "stale" ? 15 : 16, 7);
    fs.utimesSync(path.join(p[name], USER_ORIGINALS_PATH), date, date);
  }
  put(p["index-only"], USER_ORIGINALS_INDEX_PATH, JSON.stringify({ files: {} }));
  let current = at(16);
  const warmed = [];
  const create = () => createDashboardActions({ env, run: async () => {}, refreshOriginals: (root, options) => {
    warmed.push(root);
    const result = refreshUserOriginals(root, options);
    fs.utimesSync(path.join(root, USER_ORIGINALS_PATH), current, current);
    return result;
  } });
  const initial = create();
  tick(initial, current);
  await idle(initial);
  assert.deepEqual(warmed, [p["index-only"], p.stale].sort());
  const restarted = create();
  tick(restarted, current);
  await idle(restarted);
  assert.equal(warmed.length, 2, "restart does not scan successfully refreshed projects again today");
  current = at(17);
  tick(restarted, current);
  await idle(restarted);
  assert.deepEqual(warmed.slice(2), Object.values(p).sort());
});

test("sync and async refresh failures are isolated from other projects and paper watch, with no same-day retry storm", async (t) => {
  const { env, projects: p } = fixture(t, ["a-sync-failure", "b-async-failure", "c-success"]);
  const errors = t.mock.method(console, "error", () => {});
  const warmed = [];
  const watched = [];
  let fail = true;
  const actions = createDashboardActions({ env, refreshOriginals: (root) => {
    warmed.push(root);
    if (fail && root === p["a-sync-failure"]) throw new Error("sync scan failed");
    if (fail && root === p["b-async-failure"]) return Promise.reject(new Error("child scan failed"));
  }, run: async (roots) => { watched.push(roots); throw new Error("watch network failed"); } });
  tick(actions, at(16));
  await idle(actions);
  assert.deepEqual(warmed, Object.values(p));
  assert.deepEqual(watched, [Object.values(p)]);
  assert.deepEqual(actions.getSettings().userOriginalsErrors, [{ root: p["a-sync-failure"], error: "sync scan failed" }, { root: p["b-async-failure"], error: "child scan failed" }]);
  assert.equal(actions.getSettings().watchError, "watch network failed");
  assert.equal(errors.mock.callCount(), 2);
  tick(actions, at(16, 9));
  await idle(actions);
  assert.equal(warmed.length, 3);
  assert.equal(errors.mock.callCount(), 2);
  fail = false;
  tick(actions, at(17));
  await idle(actions);
  assert.deepEqual(warmed, [...Object.values(p), ...Object.values(p)]);
  assert.deepEqual(actions.getSettings().userOriginalsErrors, []);
});

test("overlapping ticks serialize prewarming without waiting for watch, including a tick across midnight", async (t) => {
  const { env, projects: p } = fixture(t, ["first", "second"]);
  const gates = Object.fromEntries(Object.values(p).map((root) => [root, Promise.withResolvers()]));
  const watchGate = Promise.withResolvers();
  t.after(() => { for (const gate of Object.values(gates)) gate.resolve(); watchGate.resolve(); });
  const warmed = [];
  const watched = [];
  let active = 0;
  let peak = 0;
  const actions = createDashboardActions({ env, refreshOriginals: async (root) => {
    warmed.push(root);
    peak = Math.max(peak, ++active);
    await gates[root].promise;
    active -= 1;
  }, run: async (roots) => { watched.push(roots); await watchGate.promise; } });
  tick(actions, at(16, 23));
  tick(actions, at(16, 23));
  await nextTurn();
  assert.deepEqual(warmed, [p.first]);
  assert.deepEqual(watched, [Object.values(p)]);
  assert.equal(actions.getSettings().watchRunning, true);
  tick(actions, at(17));
  await nextTurn();
  assert.deepEqual(warmed, [p.first]);
  gates[p.first].resolve();
  await nextTurn();
  assert.deepEqual(warmed, [p.first, p.second]);
  assert.equal(peak, 1);
  tick(actions, at(17));
  await nextTurn();
  assert.equal(warmed.length, 2);
  gates[p.second].resolve();
  await waitFor(() => !actions.getSettings().userOriginalsRunning);
  assert.equal(actions.getSettings().watchRunning, true, "paper retrieval does not hold up prewarming");
  tick(actions, at(17));
  await waitFor(() => !actions.getSettings().userOriginalsRunning);
  assert.deepEqual(warmed, [p.first, p.second, p.first, p.second]);
  assert.equal(peak, 1);
  watchGate.resolve();
  await idle(actions);
});

test("paper-watch retry backoff does not defer the daily originals prewarm", async (t) => {
  const { env, projects: { study } } = fixture(t);
  put(env.XDG_CONFIG_HOME, "dove/watch-state.json", JSON.stringify({ lastAttempt: at(16, 8).toISOString() }));
  const warmed = [];
  const watched = [];
  const actions = createDashboardActions({ env, refreshOriginals: (root) => { warmed.push(root); }, run: async (roots) => { watched.push(roots); } });
  tick(actions, at(16, 8, 1));
  await idle(actions);
  assert.deepEqual(warmed, [study]);
  assert.deepEqual(watched, []);
  tick(actions, at(16, 9));
  await idle(actions);
  assert.deepEqual(warmed, [study]);
  assert.deepEqual(watched, [[study]]);
});

test("dashboard GETs and settings reads never trigger prewarming or write derived files", async (t) => {
  const { base, env, projects: { study } } = fixture(t);
  session(env, study);
  put(study, ".dove/research/EVAL.md", "# 评测\n尚未评测。\n");
  let refreshes = 0;
  let watches = 0;
  const actions = createDashboardActions({ env, refreshOriginals: () => { refreshes += 1; }, run: async () => { watches += 1; } });
  const before = snapshot(base);
  const server = await startDashboardServer({ collect: () => collectDashboard({ projects: [study] }), listRoots: () => [study], readDocument: readProjectDocument, actions, port: 0 });
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const project = encodeURIComponent(study);
    for (const route of ["/", "/api/dashboard", "/api/settings", "/api/topics", "/api/trends", `/api/watch?project=${project}`, `/api/doc?project=${project}&name=EVAL.md`, ...["json", "md", "bib"].map((format) => `/api/library?project=${project}&format=${format}`)]) {
      const response = await fetch(`${baseUrl}${route}`);
      assert.equal(response.status, 200, route);
      await response.text();
    }
    actions.getSettings();
    assert.equal(refreshes, 0);
    assert.equal(watches, 0);
    assert.deepEqual(snapshot(base), before);
    assert.equal(fs.existsSync(path.join(study, ".dove/install")), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("the default scheduler scans in a child with the supplied HOME and continues after a real output failure", async (t) => {
  const { env, projects: p } = fixture(t, ["a-broken", "b-good"]);
  put(p["a-broken"], ".dove/install", "cannot create output inside this file");
  const expected = "这段用户原话只存在于注入的测试 HOME 中";
  session(env, p["b-good"], expected);
  put(env.HOME, ".dsh/session.jsonl", "DSH content is not a Claude Code session");
  const originalOpen = fs.openSync;
  t.mock.method(fs, "openSync", (file, ...args) => {
    assert.ok(!String(file).endsWith(".jsonl"), "transcripts must not be synchronously scanned on the dashboard event loop");
    return originalOpen(file, ...args);
  });
  t.mock.method(console, "error", () => {});
  const before = Object.values(p).map((root) => snapshot(path.join(root, ".dove/research")));
  const actions = createDashboardActions({ env, run: async () => {} });
  tick(actions, at(16));
  await idle(actions);
  assert.deepEqual(actions.getSettings().userOriginalsErrors.map((item) => item.root), [p["a-broken"]]);
  const summary = fs.readFileSync(path.join(p["b-good"], USER_ORIGINALS_PATH), "utf8");
  assert.ok(summary.includes(expected));
  assert.ok(summary.includes(env.HOME));
  assert.ok(!summary.includes("DSH content"));
  assert.deepEqual(Object.values(p).map((root) => snapshot(path.join(root, ".dove/research"))), before);
});

test("isolated scanning preserves the per-project budget and resumes the existing incremental index", async (t) => {
  const { env, projects: { study } } = fixture(t);
  const file = session(env, study);
  const deferred = await refreshUserOriginalsInBackground(study, { env, budgetMs: 0 });
  assert.equal(deferred.own, 0);
  assert.equal(deferred.pendingBytes, fs.statSync(file).size);
  const refreshed = await refreshUserOriginalsInBackground(study, { env, budgetMs: 20000 });
  assert.deepEqual([refreshed.own, refreshed.pendingBytes], [1, 0]);
  fs.appendFileSync(file, `${JSON.stringify({ type: "user", timestamp: "2026-10-16T08:00:00Z", message: { content: "新增的长期要求应当保留并逐次增量整理" } })}\n`);
  const again = await refreshUserOriginalsInBackground(study, { env });
  assert.deepEqual([again.own, again.pendingBytes], [2, 0]);
  assert.equal(refreshUserOriginals(study, { env }).own, 2, "direct callers also honor the injected HOME");
});

test("standalone bundles launch their own private worker without source files or a third package output", async (t) => {
  const { base, env, projects: { study } } = fixture(t);
  const expected = "独立打包后仍然读取正确 HOME 的用户会话";
  session(env, study, expected);
  const metadata = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8"));
  const options = {
    absWorkingDir: PACKAGE_ROOT,
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    packages: "bundle",
    external: ["node:*"],
    define: { __DOVE_PACKAGE_NAME__: JSON.stringify(metadata.name), __DOVE_PACKAGE_VERSION__: JSON.stringify(metadata.version) },
    banner: { js: 'import { createRequire as __doveCreateRequire } from "node:module"; const require = __doveCreateRequire(import.meta.url);' },
    metafile: true,
    logLevel: "silent"
  };
  const standalone = path.join(base, "standalone");
  const actionsFile = path.join(standalone, "actions.mjs");
  const builtActions = await build({ ...options, entryPoints: ["src/cli/dashboard-actions.mjs"], outfile: actionsFile });
  assert.equal(Object.keys(builtActions.metafile.outputs).length, 1);
  const { createDashboardActions: bundledActions } = await import(pathToFileURL(actionsFile).href);
  const actions = bundledActions({ env, run: async () => {} });
  tick(actions, at(16));
  await idle(actions);
  assert.deepEqual(actions.getSettings().userOriginalsErrors, []);
  assert.ok(fs.readFileSync(path.join(study, USER_ORIGINALS_PATH), "utf8").includes(expected));

  const cliFile = path.join(standalone, "dove-package.mjs");
  const builtCli = await build({ ...options, entryPoints: ["bin/dove.mjs"], outfile: cliFile });
  assert.equal(Object.keys(builtCli.metafile.outputs).length, 1);
  const { stdout, stderr } = await execute(process.execPath, [cliFile, "__dove-user-originals", JSON.stringify({ root: study, home: env.HOME, budgetMs: 20000 })], { cwd: standalone, env, timeout: 10000 });
  assert.equal(stderr, "");
  assert.deepEqual([JSON.parse(stdout).own, JSON.parse(stdout).pendingBytes], [1, 0]);
  assert.deepEqual(fs.readdirSync(standalone).sort(), ["actions.mjs", "dove-package.mjs"]);
});
