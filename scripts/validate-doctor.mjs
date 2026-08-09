#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { cleanupTempWorkspace, createTempWorkspace } from "./temp-workspace.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const SOURCE_CLI = path.join(PACKAGE_ROOT, "bin", "dove.mjs");
const target = createTempWorkspace("dove-doctor-");
const claudeConfigRoot = createTempWorkspace("dove-claude-config-");
const settingsPath = path.join(claudeConfigRoot, "settings.json");
const shellRoot = createTempWorkspace("dove-claude-shell-");
const shellPath = path.join(shellRoot, ".bashrc");
const claudeCommand = path.join(shellRoot, "claude");
const doveCommand = path.join(shellRoot, "dove");
const settingsBefore = '{"theme":"dark","fastMode":false,"env":{"KEEP":"unchanged"}}\n';
const shellBefore = "# user shell\nexport KEEP=unchanged\n";
const FORBIDDEN_PROJECT_PATHS = [".dove-install", "bin", "dist", "mcp", "scripts"];

function snapshotTree(root) {
  const result = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        result[`${relativePath}/`] = "directory";
        visit(absolutePath);
      } else if (entry.isSymbolicLink()) {
        result[relativePath] = `symlink:${fs.readlinkSync(absolutePath)}`;
      } else {
        result[relativePath] = `file:${fs.readFileSync(absolutePath).toString("base64")}`;
      }
    }
  };
  visit(root);
  return result;
}

function parseJsonOutput(result, label) {
  assert.equal(result.error, undefined, `${label} failed to start: ${result.error?.message ?? "unknown error"}`);
  assert.equal(result.status, 0, `${label} failed:\n${result.stderr || result.stdout}`);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    assert.fail(`${label} returned invalid JSON: ${error.message}\n${result.stdout}`);
  }
}

function runSourceCli(args, env, label) {
  return parseJsonOutput(spawnSync(process.execPath, [SOURCE_CLI, ...args], {
    cwd: PACKAGE_ROOT,
    encoding: "utf8",
    env
  }), label);
}

function assertNoCopiedRuntime(root) {
  for (const relativePath of FORBIDDEN_PROJECT_PATHS) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, `project init must not create ${relativePath}`);
  }
}

function assertInitializedProject(root, initResult) {
  const canonicalRoot = fs.realpathSync.native(root);
  assert.equal(initResult.status, "initialized");
  assert.equal(initResult.target, canonicalRoot);
  assert.deepEqual(initResult.hosts, ["claude"]);
  assert.deepEqual(initResult.removedPaths, []);
  assert.ok(initResult.changedPaths.includes(".dove/install/manifest.json"));
  assert.ok(initResult.changedPaths.includes(".mcp.json"));
  assert.ok(initResult.changedPaths.includes(".claude/settings.json"));
  assert.equal(initResult.changedPaths.some((relativePath) => FORBIDDEN_PROJECT_PATHS.some((prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`))), false);

  assertNoCopiedRuntime(root);
  assert.deepEqual(fs.readdirSync(root).sort(), [".claude", ".dove", ".mcp.json"]);

  const manifestPath = path.join(root, ".dove", "install", "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.runtime?.mode, "user-cli");
  assert.deepEqual(manifest.hosts, ["claude"]);
  assert.ok(Array.isArray(manifest.managed) && manifest.managed.length > 0);
  assert.equal(manifest.managed.every((entry) => entry.path === ".mcp.json" || entry.path.startsWith(".claude/")), true);
  for (const relativePath of [
    ".mcp.json",
    ".claude/settings.json",
    ".claude/rules/dove.md",
    ".claude/skills/dove-intake/SKILL.md",
    ".claude/skills/dove-lessons-intake/SKILL.md",
    ".claude/commands/dove/status.md"
  ]) {
    assert.ok(fs.existsSync(path.join(root, relativePath)), `missing Claude project surface ${relativePath}`);
  }
}

function assertDoctorPayload(payload, root) {
  const canonicalRoot = fs.realpathSync.native(root);
  assert.equal(payload.healthy, true);
  assert.equal(payload.state, "healthy");
  assert.equal(payload.target, canonicalRoot);
  assert.equal(payload.zeroWrite, true);
  assert.deepEqual(payload.writes, []);

  assert.equal(payload.userCli?.healthy, true);
  assert.equal(payload.userCli?.state, "healthy");
  assert.equal(payload.userCli?.executable?.path, SOURCE_CLI);
  assert.equal(payload.userCli?.pathExecutable?.usable, true);
  assert.equal(payload.userCli?.pathExecutable?.path, doveCommand);

  assert.equal(payload.projectIntegration?.healthy, true);
  assert.equal(payload.projectIntegration?.state, "current");
  assert.equal(payload.projectIntegration?.root, canonicalRoot);
  assert.equal(payload.projectIntegration?.manifest?.runtime?.mode, "user-cli");
  assert.deepEqual(payload.projectIntegration?.manifest?.hosts, ["claude"]);
  assert.deepEqual(payload.projectIntegration?.missing, []);
  assert.deepEqual(payload.projectIntegration?.drifted, []);

  assert.equal(payload.workspaceState?.healthy, true);
  assert.equal(payload.workspaceState?.state, "absent");
  assert.equal(payload.workspaceState?.mode, "absent");
  assert.equal(payload.workspaceState?.zeroWrite, true);

  assert.equal(payload.hostRegistration?.healthy, true);
  assert.equal(payload.hostRegistration?.state, "registered");
  assert.equal(payload.hostRegistration?.host, "claude");
  assert.equal(payload.hostRegistration?.mcp?.state, "registered");
  assert.equal(payload.hostRegistration?.ambient?.state, "configured");
  assert.deepEqual(payload.hostRegistration?.missing, []);
  assert.deepEqual(payload.hostRegistration?.drifted, []);

  assert.equal(payload.readiness?.healthy, true);
  assert.equal(payload.readiness?.ready, true);
  assert.equal(payload.readiness?.state, "connected");

  assert.equal(payload.legacyCopiedRuntime?.healthy, true);
  assert.equal(payload.legacyCopiedRuntime?.detected, false);
  assert.equal(payload.legacyCopiedRuntime?.state, "absent");
  assert.deepEqual(payload.legacyCopiedRuntime?.evidence, []);
}

try {
  fs.writeFileSync(settingsPath, settingsBefore, "utf8");
  fs.writeFileSync(shellPath, shellBefore, "utf8");
  fs.writeFileSync(claudeCommand, '#!/usr/bin/env node\nif (process.argv.slice(2).join(" ") !== "mcp get dove") process.exit(2);\nconsole.log("Status: Connected");\n', "utf8");
  fs.chmodSync(claudeCommand, 0o755);
  fs.symlinkSync(SOURCE_CLI, doveCommand);

  const env = {
    ...process.env,
    PATH: `${shellRoot}${path.delimiter}${process.env.PATH ?? ""}`,
    CLAUDE_CONFIG_DIR: claudeConfigRoot,
    DOVE_CLAUDE_SHELL_RC: shellPath,
    DOVE_CLAUDE_COMMAND: claudeCommand
  };
  const externalBeforeInit = {
    config: snapshotTree(claudeConfigRoot),
    shell: snapshotTree(shellRoot)
  };

  const initResult = runSourceCli(["init", "--host", "claude", "--project", target, "--json"], env, "dove init");
  assertInitializedProject(target, initResult);
  assert.deepEqual(snapshotTree(claudeConfigRoot), externalBeforeInit.config, "dove init changed external Claude configuration");
  assert.deepEqual(snapshotTree(shellRoot), externalBeforeInit.shell, "dove init changed the external shell environment");

  const targetBeforeDoctor = snapshotTree(target);
  const configBeforeDoctor = snapshotTree(claudeConfigRoot);
  const shellBeforeDoctor = snapshotTree(shellRoot);
  const doctor = runSourceCli(["doctor", "--project", target, "--json"], env, "dove doctor");
  assertDoctorPayload(doctor, target);

  assertNoCopiedRuntime(target);
  assert.deepEqual(snapshotTree(target), targetBeforeDoctor, "dove doctor changed the target project");
  assert.deepEqual(snapshotTree(claudeConfigRoot), configBeforeDoctor, "dove doctor changed external Claude configuration");
  assert.deepEqual(snapshotTree(shellRoot), shellBeforeDoctor, "dove doctor changed the external shell environment");

  console.log(JSON.stringify({
    status: "passed",
    projectIntegration: "healthy",
    workspaceState: "absent",
    readiness: "connected",
    legacyCopiedRuntime: "absent",
    zeroWrite: true
  }, null, 2));
} finally {
  cleanupTempWorkspace(target);
  cleanupTempWorkspace(claudeConfigRoot);
  cleanupTempWorkspace(shellRoot);
}
