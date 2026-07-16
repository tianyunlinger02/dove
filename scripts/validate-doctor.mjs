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
const settingsBefore = '{"theme":"dark","fastMode":false,"env":{"KEEP":"unchanged"}}\n';
const shellBefore = "# user shell\nexport KEEP=unchanged\n";
let exitCode = 0;

try {
  fs.writeFileSync(settingsPath, settingsBefore, "utf8");
  fs.writeFileSync(shellPath, shellBefore, "utf8");
  const env = { ...process.env, DOVE_CLAUDE_CONFIG_DIR: claudeConfigRoot, DOVE_CLAUDE_SHELL_RC: shellPath };
  const install = spawnSync("node", ["./bin/dove-package.mjs", "install", target, "--force", "--host", "claude", "--json"], { cwd: PACKAGE_ROOT, stdio: "inherit", env });
  exitCode = install.status ?? 1;
  if (exitCode === 0 && (fs.readFileSync(settingsPath, "utf8") !== settingsBefore || fs.readFileSync(shellPath, "utf8") !== shellBefore)) exitCode = 1;
  if (exitCode === 0) {
    const doctor = spawnSync("node", ["./bin/dove-package.mjs", "doctor", target, "--json"], { cwd: PACKAGE_ROOT, stdio: "inherit", env });
    exitCode = doctor.status ?? 1;
  }
} finally {
  cleanupTempWorkspace(target);
  cleanupTempWorkspace(claudeConfigRoot);
  cleanupTempWorkspace(shellRoot);
}

process.exitCode = exitCode;
