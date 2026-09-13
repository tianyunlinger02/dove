#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMMAND_TEST_FILES = Object.freeze([
  "tests/commands/01-agent-and-skills.test.mjs",
  "tests/commands/02-generated-adapters.test.mjs",
  "tests/commands/03-ambient-docs-research-defaults.test.mjs",
  "tests/commands/04-cli-parser-renderers.test.mjs",
  "tests/commands/05-interactive-setup.test.mjs"
]);

const result = spawnSync(process.execPath, [
  "--test",
  "--test-concurrency=1",
  ...COMMAND_TEST_FILES
], {
  cwd: ROOT,
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.signal) {
  console.error(`Command validation test runner terminated by signal ${result.signal}.`);
  process.exit(1);
}

process.exit(result.status ?? 1);
