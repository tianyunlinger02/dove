#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CLI_COMMAND_SPECS } from "../src/cli/command-parser.mjs";
import { COMMAND_SURFACES, MANAGED_PACKAGE_PATHS, PROJECT_HOST_IDS, allGeneratedCommandAdapterPaths } from "../src/core/command-manifest.mjs";
import { toolDefinitions } from "../src/mcp/tool-definitions.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_CLI_COMMANDS = ["init", "sync", "upgrade", "reinstall", "doctor", "mcp", "hook"];
const EXPECTED_SKILL_IDS = ["dove.research", "dove.status", "dove.source", "dove.experiment", "dove.draft", "dove.figure", "dove.review", "dove.rebuttal", "dove.lessons"];
const EXPECTED_TOOL_NAMES = ["query_dove_research", "manage_dove_workspace", "manage_dove_missions", "manage_dove_sources", "manage_dove_experiments", "manage_dove_claims", "manage_dove_reviews", "manage_dove_lessons"];
const EXPECTED_ADAPTER_COUNT = 45;
const EXPECTED_PACKAGE_PATHS = [
  ...MANAGED_PACKAGE_PATHS,
  "package.json"
].sort();

const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const packageLock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
assert.equal(packageJson.version, "0.7.0", "package.json must declare Dove 0.7.0");
assert.equal(packageLock.version, packageJson.version, "package-lock root version must match package.json");
assert.equal(packageLock.packages?.[""]?.version, packageJson.version, "package-lock package version must match package.json");
assert.deepEqual(packageLock.packages?.[""]?.bin, packageJson.bin, "package-lock root bin must match package.json");
assert.deepEqual(Object.keys(CLI_COMMAND_SPECS), EXPECTED_CLI_COMMANDS, "CLI must expose the exact ordered seven-command runtime inventory");
assert.deepEqual(COMMAND_SURFACES.map((surface) => surface.id), EXPECTED_SKILL_IDS, "Skill inventory must match the exact ordered nine-Skill contract");
assert.deepEqual(toolDefinitions.map((tool) => tool.name), EXPECTED_TOOL_NAMES, "MCP inventory must match the exact ordered eight-tool contract");
assert.equal(PROJECT_HOST_IDS.length, 5, "checked-in project host inventory must remain exactly five");
assert.equal(allGeneratedCommandAdapterPaths().length, EXPECTED_ADAPTER_COUNT, "generated adapter inventory must remain exactly 45");

assert.equal(packageJson.repository?.url, "git+https://github.com/tianyunlinger02/dove.git", "package metadata must identify the public source repository");

const packed = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: ROOT, encoding: "utf8" });
assert.equal(packed.status, 0, packed.stderr || packed.stdout);
const [pack] = JSON.parse(packed.stdout);
const actualPackagePaths = pack.files.map((file) => file.path).sort();
assert.deepEqual(actualPackagePaths, EXPECTED_PACKAGE_PATHS, "npm package file inventory drifted from the canonical managed path set");
assert.equal(pack.entryCount, EXPECTED_PACKAGE_PATHS.length, "npm package entry count drifted");

console.log(JSON.stringify({
  status: "passed",
  version: packageJson.version,
  cliCommandCount: EXPECTED_CLI_COMMANDS.length,
  skillCount: COMMAND_SURFACES.length,
  toolCount: toolDefinitions.length,
  adapterCount: EXPECTED_ADAPTER_COUNT,
  packageEntryCount: pack.entryCount
}, null, 2));
