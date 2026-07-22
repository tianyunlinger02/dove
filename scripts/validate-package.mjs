#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { CLI_COMMAND_SPECS } from "../src/cli/command-parser.mjs";
import { COMMAND_SURFACES, MANAGED_PACKAGE_PATHS, PROJECT_HOST_IDS, allGeneratedCommandAdapterPaths } from "../src/core/command-manifest.mjs";
import { toolDefinitions } from "../src/mcp/tool-definitions.mjs";

const ROOT = process.cwd();
const EXPECTED_CLI_COMMANDS = ["install", "sync", "doctor", "init", "mission", "receipt", "status", "lessons", "version", "source", "note", "draft", "experience", "figure", "review", "rebuttal"];
const EXPECTED_PACKAGE_PATHS = [
  ...MANAGED_PACKAGE_PATHS,
  "package.json"
].sort();

const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const packageLock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
assert.equal(packageJson.version, "0.4.0", "package.json must declare Dove 0.4.0");
assert.equal(packageLock.version, packageJson.version, "package-lock root version must match package.json");
assert.equal(packageLock.packages?.[""]?.version, packageJson.version, "package-lock package version must match package.json");
assert.deepEqual(packageLock.packages?.[""]?.bin, packageJson.bin, "package-lock root bin must match package.json");
assert.deepEqual(Object.keys(CLI_COMMAND_SPECS), EXPECTED_CLI_COMMANDS, "CLI must expose the exact ordered 16-command inventory");
assert.equal(COMMAND_SURFACES.length, 12, "host workflow inventory must remain exactly 12");
assert.equal(toolDefinitions.length, 28, "MCP inventory must remain exactly 28");
assert.equal(PROJECT_HOST_IDS.length, 4, "checked-in project host inventory must remain exactly four");
assert.equal(allGeneratedCommandAdapterPaths().length + COMMAND_SURFACES.length, 60, "generated adapter inventory must remain exactly 60");

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
  workflowCount: COMMAND_SURFACES.length,
  toolCount: toolDefinitions.length,
  adapterCount: 60,
  packageEntryCount: pack.entryCount
}, null, 2));
