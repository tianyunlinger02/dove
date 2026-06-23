#!/usr/bin/env node

import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { cleanupTempWorkspace, createTempWorkspace } from "./temp-workspace.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: PACKAGE_ROOT,
    stdio: "inherit",
    env
  });
  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

const target = createTempWorkspace("dove-doctor-");
const claudeConfigRoot = createTempWorkspace("dove-claude-config-");
let exitCode = 0;

try {
  const env = { ...process.env, DOVE_CLAUDE_CONFIG_DIR: claudeConfigRoot };
  exitCode = run("node", ["./bin/dove.mjs", "install", target, "--force", "--host", "all"], env);
  if (exitCode === 0) {
    exitCode = run("node", ["./bin/dove.mjs", "doctor", target], env);
  }
} finally {
  cleanupTempWorkspace(target);
  cleanupTempWorkspace(claudeConfigRoot);
}

process.exitCode = exitCode;
