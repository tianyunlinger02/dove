#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { cleanupTempWorkspace, createTempWorkspace } from "./temp-workspace.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const target = createTempWorkspace("dove-doctor-");
const claudeConfigRoot = createTempWorkspace("dove-claude-config-");
const settingsPath = path.join(claudeConfigRoot, "settings.json");
const shellRoot = createTempWorkspace("dove-claude-shell-");
const shellPath = path.join(shellRoot, ".bashrc");
const claudeCommand = path.join(shellRoot, "claude");
const settingsBefore = '{"theme":"dark","fastMode":false,"env":{"KEEP":"unchanged"}}\n';
const shellBefore = "# user shell\nexport KEEP=unchanged\n";
let exitCode = 0;

function snapshotTree(root) {
  const result = {};
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(absolutePath);
      else if (entry.isSymbolicLink()) result[relativePath] = `symlink:${fs.readlinkSync(absolutePath)}`;
      else result[relativePath] = fs.readFileSync(absolutePath).toString("base64");
    }
  };
  visit(root);
  return result;
}

try {
  fs.writeFileSync(settingsPath, settingsBefore, "utf8");
  fs.writeFileSync(shellPath, shellBefore, "utf8");
  fs.writeFileSync(claudeCommand, '#!/usr/bin/env node\nif (process.argv.slice(2).join(" ") !== "mcp get dove") process.exit(2);\nconsole.log("Status: Connected");\n', "utf8");
  fs.chmodSync(claudeCommand, 0o755);
  const env = { ...process.env, DOVE_CLAUDE_CONFIG_DIR: claudeConfigRoot, DOVE_CLAUDE_SHELL_RC: shellPath, DOVE_CLAUDE_COMMAND: claudeCommand };
  const install = spawnSync("node", ["./bin/dove-package.mjs", "install", target, "--force", "--host", "claude", "--json"], { cwd: PACKAGE_ROOT, stdio: "inherit", env });
  exitCode = install.status ?? 1;
  if (exitCode === 0 && (fs.readFileSync(settingsPath, "utf8") !== settingsBefore || fs.readFileSync(shellPath, "utf8") !== shellBefore)) exitCode = 1;
  if (exitCode === 0) {
    const mcpConfigPath = path.join(target, ".mcp.json");
    const markerPath = path.join(target, "mcp", "dove-claude-project.json");
    if (!fs.existsSync(mcpConfigPath) || !fs.existsSync(markerPath)) exitCode = 1;
  }
  if (exitCode === 0) {
    const targetBefore = snapshotTree(target);
    const claudeBefore = snapshotTree(claudeConfigRoot);
    const shellBeforeDoctor = snapshotTree(shellRoot);
    const doctor = spawnSync("node", ["./bin/dove-package.mjs", "doctor", target, "--json"], { cwd: PACKAGE_ROOT, encoding: "utf8", env });
    exitCode = doctor.status ?? 1;
    if (exitCode === 0) {
      const payload = JSON.parse(doctor.stdout);
      const connection = payload.checks.find((check) => check.check === "claude-mcp-status");
      const probe = payload.checks.find((check) => check.check === "runtime:mcp-package-probe");
      if (connection?.state !== "connected" || probe?.toolCount !== 28 || probe?.hasCreateDoveMission !== true || probe?.elicitationCount !== 1 || probe?.checkpointStatus !== "declined" || probe?.zeroWrite !== true) exitCode = 1;
    }
    if (JSON.stringify(snapshotTree(target)) !== JSON.stringify(targetBefore)) exitCode = 1;
    if (JSON.stringify(snapshotTree(claudeConfigRoot)) !== JSON.stringify(claudeBefore)) exitCode = 1;
    if (JSON.stringify(snapshotTree(shellRoot)) !== JSON.stringify(shellBeforeDoctor)) exitCode = 1;
  }
} finally {
  cleanupTempWorkspace(target);
  cleanupTempWorkspace(claudeConfigRoot);
  cleanupTempWorkspace(shellRoot);
}

process.exitCode = exitCode;
