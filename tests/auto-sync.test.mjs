import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { PROJECT_HOST_IDS } from "../src/core/host-registry.mjs";
import { inspectProjectIntegration } from "../src/core/project-installation.mjs";
import { INSTALLATION_MANIFEST_PATH, validateProjectInstallationManifest } from "../src/core/project-installation-manifest.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import { PAPER_SEARCH_MCP_SERVER_NAME, PAPER_SEARCH_MCP_SELECTOR } from "../src/core/paper-search-integration.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const cli = path.join(root, "bin/dove.mjs");
const scratch = fileURLToPath(new URL("../.claude/tmp/", import.meta.url));

function workspace(t) {
  fs.mkdirSync(scratch, { recursive: true });
  const base = fs.mkdtempSync(path.join(scratch, "dove-auto-sync-"));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const env = {
    PATH: process.env.PATH,
    HOME: path.join(base, "home"),
    XDG_CONFIG_HOME: path.join(base, "config"),
    TMPDIR: path.join(base, "tmp"),
    npm_config_prefix: path.join(base, "prefix"),
    npm_config_cache: path.join(base, "cache"),
    npm_config_userconfig: path.join(base, "npmrc"),
    npm_config_globalconfig: path.join(base, "global-npmrc"),
    npm_config_update_notifier: "false",
    DOVE_TEMP_ROOT: path.join(base, "tmp")
  };
  for (const directory of [env.HOME, env.XDG_CONFIG_HOME, env.TMPDIR, env.npm_config_prefix, env.npm_config_cache]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  fs.chmodSync(env.XDG_CONFIG_HOME, 0o700);
  return { base, env };
}

function project(base, name) {
  const target = path.join(base, name);
  fs.mkdirSync(path.join(target, ".git"), { recursive: true });
  fs.writeFileSync(path.join(target, "paper.md"), `Synthetic ${name} material.\n`);
  return target;
}

function run(ws, command, args, { cwd = ws.base, ...options } = {}) {
  const result = spawnSync(command, args, {
    cwd, env: ws.env, encoding: "utf8", timeout: 120_000, maxBuffer: 4 * 1024 * 1024, ...options
  });
  assert.equal(result.error, undefined, result.error?.message);
  return result;
}

function checked(ws, command, args, options) {
  const result = run(ws, command, args, options);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function dove(ws, ...args) {
  return checked(ws, process.execPath, [cli, ...args, "--json"]);
}

function snapshot(directory) {
  const entries = [];
  function visit(current, relative) {
    for (const name of fs.readdirSync(current).sort()) {
      const absolute = path.join(current, name);
      const stat = fs.lstatSync(absolute, { bigint: true });
      const location = path.posix.join(relative, name);
      entries.push({
        path: location, mode: stat.mode, mtimeNs: stat.mtimeNs,
        content: stat.isFile() ? crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex") : null,
        link: stat.isSymbolicLink() ? fs.readlinkSync(absolute) : null
      });
      if (stat.isDirectory()) visit(absolute, location);
    }
  }
  visit(directory, "");
  return entries;
}

function manifest(projectRoot) {
  const value = JSON.parse(fs.readFileSync(path.join(projectRoot, INSTALLATION_MANIFEST_PATH), "utf8"));
  validateProjectInstallationManifest(value, { hostIds: PROJECT_HOST_IDS });
  return value;
}

function assertCurrent(projectRoot) {
  assert.equal(manifest(projectRoot).package.version, PACKAGE_VERSION);
  assert.equal(inspectProjectIntegration(projectRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }).status, "current");
}

function markOld(projectRoot) {
  const target = path.join(projectRoot, INSTALLATION_MANIFEST_PATH);
  const value = manifest(projectRoot);
  value.package.version = "0.0.1";
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  assert.equal(manifest(projectRoot).package.version, "0.0.1");
}

function drift(projectRoot) {
  const managed = manifest(projectRoot).managed.find((item) => item.path === ".dove/install/RESEARCH_QUALITY.md");
  assert.ok(managed, "fixture requires a manifest-owned reference");
  fs.appendFileSync(path.join(projectRoot, managed.path), "\nSynthetic local edit; never overwrite automatically.\n");
}

function driftMcpFragment(projectRoot) {
  const owned = manifest(projectRoot).managed.find((entry) => entry.path === ".mcp.json" && entry.selector === PAPER_SEARCH_MCP_SELECTOR);
  assert.ok(owned, "fixture requires an owned paper-search MCP fragment");
  const target = path.join(projectRoot, owned.path);
  const config = JSON.parse(fs.readFileSync(target, "utf8"));
  config.mcpServers[PAPER_SEARCH_MCP_SERVER_NAME].args.push("--synthetic-local-edit");
  fs.writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`);
}

function register(ws, ...projects) {
  const args = projects.flatMap((target) => ["--project", target]);
  dove(ws, "projects", "import", ...args);
}

test("projects import registers only installed synthetic projects and does not modify them", (t) => {
  const ws = workspace(t);
  const one = project(ws.base, "one");
  const two = project(ws.base, "two");
  dove(ws, "init", "--project", one, "--host", "claude");
  dove(ws, "init", "--project", two, "--host", "claude");
  const before = [snapshot(one), snapshot(two)];
  const registeredByLifecycle = dove(ws, "projects", "status");
  for (const target of [one, two]) {
    assert.ok(registeredByLifecycle.stdout.includes(target), `init must register ${target}`);
  }
  register(ws, one, two);
  assert.deepEqual([snapshot(one), snapshot(two)], before, "import without --sync must be read-only for projects");
  const registry = JSON.parse(fs.readFileSync(path.join(ws.env.XDG_CONFIG_HOME, "dove", "projects.json"), "utf8"));
  assert.deepEqual(registry, { revision: 1, projects: [one, two] });
  assert.equal(fs.statSync(path.join(ws.env.XDG_CONFIG_HOME, "dove", "projects.json")).mode & 0o077, 0, "registry must not expose project paths to other users");

  const status = dove(ws, "projects", "status");
  for (const target of [one, two]) {
    assert.ok(status.stdout.includes(target), `registry status must expose ${target}`);
  }
  assert.deepEqual([snapshot(one), snapshot(two)], before, "status must be read-only for projects");

  const missing = project(ws.base, "not-installed");
  const invalid = run(ws, process.execPath, [cli, "projects", "import", "--project", missing, "--json"]);
  assert.notEqual(invalid.status, 0, "uninitialized projects must not be registered");
  assert.deepEqual(snapshot(missing).map((item) => item.path), [".git", "paper.md"]);
  assert.equal(dove(ws, "projects", "status").stdout.includes(missing), false);

  const malformed = project(ws.base, "malformed-manifest");
  const manifestPath = path.join(malformed, INSTALLATION_MANIFEST_PATH);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify({ revision: "unsupported" }));
  const beforeMalformed = snapshot(malformed);
  const denied = run(ws, process.execPath, [cli, "projects", "import", "--project", malformed, "--json"]);
  assert.notEqual(denied.status, 0, "invalid manifest must not be registered");
  assert.deepEqual(snapshot(malformed), beforeMalformed);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ws.env.XDG_CONFIG_HOME, "dove", "projects.json"), "utf8")), registry);
});

test("projects import --sync updates an imported old manifest and preserves researcher material", (t) => {
  const ws = workspace(t);
  const target = project(ws.base, "imported");
  dove(ws, "init", "--project", target, "--host", "claude");
  markOld(target);
  const paper = fs.readFileSync(path.join(target, "paper.md"));
  dove(ws, "projects", "import", "--project", target, "--sync");
  assertCurrent(target);
  assert.deepEqual(fs.readFileSync(path.join(target, "paper.md")), paper);
});

test("auto-sync blocks every write to a drifted project but continues updating another project", (t) => {
  const ws = workspace(t);
  const edited = project(ws.base, "edited");
  const clean = project(ws.base, "clean");
  const invalid = project(ws.base, "invalid");
  for (const target of [edited, clean, invalid]) dove(ws, "init", "--project", target, "--host", "claude");
  register(ws, edited, clean, invalid);
  markOld(edited);
  drift(edited);
  markOld(clean);
  const invalidPath = path.join(invalid, INSTALLATION_MANIFEST_PATH);
  fs.writeFileSync(invalidPath, JSON.stringify({ revision: "unsupported" }));
  const untouched = snapshot(edited);
  const invalidBefore = snapshot(invalid);
  const paper = fs.readFileSync(path.join(clean, "paper.md"));

  const sync = run(ws, process.execPath, [cli, "projects", "sync", "--json"]);
  assert.ok(sync.status === 0 || sync.status === 1, sync.stderr);
  const report = JSON.parse(sync.stdout);
  assert.equal(report.status, "partial");
const editedReport = report.projects.find((item) => item.target === edited);
  assert.equal(editedReport?.status, "updated");
  assert.deepEqual(editedReport?.preservedLocalEdits, [{ path: ".dove/install/RESEARCH_QUALITY.md", selector: null }]);
  assert.match(fs.readFileSync(path.join(edited, ".dove/install/RESEARCH_QUALITY.md"), "utf8"), /Synthetic local edit/u, "the edited item stays as the user left it");
  assert.equal(manifest(edited).package.version, PACKAGE_VERSION, "everything else in the edited project is brought current");
  assert.notDeepEqual(snapshot(edited), untouched);
  assert.equal(report.projects.find((item) => item.target === invalid)?.status, "blocked");
  assert.deepEqual(snapshot(invalid), invalidBefore, "invalid manifest must prevent ALL project writes");
  assertCurrent(clean);
  assert.deepEqual(fs.readFileSync(path.join(clean, "paper.md")), paper);
});

test("managed MCP fragment drift is preserved while the rest of the project syncs", (t) => {
  const ws = workspace(t);
  const edited = project(ws.base, "mcp-edited");
  const clean = project(ws.base, "mcp-clean");
  for (const target of [edited, clean]) dove(ws, "init", "--project", target, "--host", "claude");
  register(ws, edited, clean);
  markOld(edited);
  markOld(clean);
  driftMcpFragment(edited);
  const before = snapshot(edited);
  const paper = fs.readFileSync(path.join(clean, "paper.md"));

  const report = JSON.parse(dove(ws, "projects", "sync").stdout);
  assert.equal(report.status, "current");
  const editedReport = report.projects.find((item) => item.target === edited);
  assert.equal(editedReport.status, "updated");
  assert.deepEqual(editedReport.preservedLocalEdits, [{ path: ".mcp.json", selector: PAPER_SEARCH_MCP_SELECTOR }]);
  assert.ok(JSON.parse(fs.readFileSync(path.join(edited, ".mcp.json"), "utf8")).mcpServers[PAPER_SEARCH_MCP_SERVER_NAME].args.includes("--synthetic-local-edit"));
  assert.equal(manifest(edited).package.version, PACKAGE_VERSION);
  assert.notDeepEqual(snapshot(edited), before);
  assertCurrent(clean);
  assert.deepEqual(fs.readFileSync(path.join(clean, "paper.md")), paper);
});

test("missing managed files and MCP fragments stay missing while the rest updates", (t) => {
  const ws = workspace(t);
  const fileMissing = project(ws.base, "file-missing");
  const fragmentMissing = project(ws.base, "fragment-missing");
  const clean = project(ws.base, "clean");
  for (const target of [fileMissing, fragmentMissing, clean]) {
    dove(ws, "init", "--project", target, "--host", "claude");
    markOld(target);
  }
  fs.unlinkSync(path.join(fileMissing, ".dove/install/RESEARCH_QUALITY.md"));
  const mcpPath = path.join(fragmentMissing, ".mcp.json");
  const mcp = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
  delete mcp.mcpServers[PAPER_SEARCH_MCP_SERVER_NAME];
  fs.writeFileSync(mcpPath, `${JSON.stringify(mcp, null, 2)}\n`);
  const before = [snapshot(fileMissing), snapshot(fragmentMissing)];
  const report = JSON.parse(dove(ws, "projects", "sync").stdout);
  assert.equal(report.status, "current");
  assert.deepEqual(report.projects.find((item) => item.target === fileMissing)?.preservedLocalEdits, [
    { path: ".dove/install/RESEARCH_QUALITY.md", selector: null }
  ]);
  assert.deepEqual(report.projects.find((item) => item.target === fragmentMissing)?.preservedLocalEdits, [
    { path: ".mcp.json", selector: PAPER_SEARCH_MCP_SELECTOR }
  ]);
  assert.equal(fs.existsSync(path.join(fileMissing, ".dove/install/RESEARCH_QUALITY.md")), false, "a removed file is not recreated");
  assert.equal(PAPER_SEARCH_MCP_SERVER_NAME in JSON.parse(fs.readFileSync(mcpPath, "utf8")).mcpServers, false, "a removed fragment is not recreated");
  for (const target of [fileMissing, fragmentMissing]) assert.equal(manifest(target).package.version, PACKAGE_VERSION);
  assert.notDeepEqual([snapshot(fileMissing), snapshot(fragmentMissing)], before);
  assertCurrent(clean);
});

test("global npm postinstall syncs registered projects and keeps local edits", (t) => {
  const ws = workspace(t);
  const edited = project(ws.base, "edited");
  const clean = project(ws.base, "clean");
  for (const target of [edited, clean]) dove(ws, "init", "--project", target, "--host", "claude");
  register(ws, edited, clean);
  markOld(edited);
  drift(edited);
  markOld(clean);
  const untouched = snapshot(edited);
  const packed = JSON.parse(checked(ws, "npm", ["pack", root, "--json", "--ignore-scripts"]).stdout);
  assert.equal(packed.length, 1);
  const tarball = path.join(ws.base, packed[0].filename);
  checked(ws, "npm", ["install", "--global", "--prefix", ws.env.npm_config_prefix, "--no-audit", "--no-fund", tarball]);
  const installedPackage = JSON.parse(fs.readFileSync(path.join(ws.env.npm_config_prefix, "lib", "node_modules", PACKAGE_NAME, "package.json"), "utf8"));
  assert.match(installedPackage.scripts?.postinstall ?? "", /projects postinstall/u, "packed package must declare its lifecycle hook");
  const postinstallReport = JSON.parse(fs.readFileSync(path.join(ws.env.XDG_CONFIG_HOME, "dove", "last-sync.json"), "utf8"));
  assert.equal(postinstallReport.packageVersion, PACKAGE_VERSION, "global install must execute postinstall with isolated registry");
  assert.equal(postinstallReport.projects.find((item) => item.target === edited)?.status, "updated");
  assert.match(fs.readFileSync(path.join(edited, ".dove/install/RESEARCH_QUALITY.md"), "utf8"), /Synthetic local edit/u, "postinstall keeps the local edit");
  assert.notDeepEqual(snapshot(edited), untouched);
  assertCurrent(clean);
  const executable = path.join(ws.env.npm_config_prefix, "bin", process.platform === "win32" ? "dove.cmd" : "dove");
  assert.equal(fs.existsSync(executable), true, "test must exercise an actual isolated global npm installation");
});

test("local npm install does not sync the user's registered projects", (t) => {
  const ws = workspace(t);
  const target = project(ws.base, "local-install");
  dove(ws, "init", "--project", target, "--host", "claude");
  markOld(target);
  const before = snapshot(target);
  const packed = JSON.parse(checked(ws, "npm", ["pack", root, "--json", "--ignore-scripts"]).stdout);
  const tarball = path.join(ws.base, packed[0].filename);
  checked(ws, "npm", ["install", "--prefix", path.join(ws.base, "consumer"), "--no-audit", "--no-fund", tarball]);
  assert.deepEqual(snapshot(target), before);
  assert.equal(fs.existsSync(path.join(ws.env.XDG_CONFIG_HOME, "dove", "last-sync.json")), false);
});

test("global npm --ignore-scripts does not cascade; one manual sync catches up", (t) => {
  const ws = workspace(t);
  const target = project(ws.base, "deferred");
  dove(ws, "init", "--project", target, "--host", "claude");
  register(ws, target);
  markOld(target);
  const before = snapshot(target);
  const reportPath = path.join(ws.env.XDG_CONFIG_HOME, "dove", "last-sync.json");
  assert.equal(fs.existsSync(reportPath), false, "fixture must have no previous sync report");

  const packed = JSON.parse(checked(ws, "npm", ["pack", root, "--json", "--ignore-scripts"]).stdout);
  assert.equal(packed.length, 1);
  checked(ws, "npm", ["install", "--global", "--ignore-scripts", "--prefix", ws.env.npm_config_prefix, "--no-audit", "--no-fund", path.join(ws.base, packed[0].filename)]);
  const executable = path.join(ws.env.npm_config_prefix, "bin", process.platform === "win32" ? "dove.cmd" : "dove");
  assert.equal(fs.existsSync(executable), true, "isolated global installation must have completed");
  assert.deepEqual(snapshot(target), before, "--ignore-scripts installation must not cascade to projects");
  assert.equal(fs.existsSync(reportPath), false, "--ignore-scripts must not write a sync receipt");

  const report = JSON.parse(checked(ws, executable, ["projects", "sync", "--json"]).stdout);
  assert.equal(report.status, "current");
  assert.equal(report.projects.find((item) => item.target === target)?.status, "updated");
  assertCurrent(target);
  assert.equal(JSON.parse(fs.readFileSync(reportPath, "utf8")).packageVersion, PACKAGE_VERSION);
});
