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
const EXPECTED_CLI_COMMANDS = ["init", "sync", "doctor", "workspace", "mcp", "hook", "mission", "status", "lessons", "source", "experiment", "draft", "figure", "review", "rebuttal"];
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
assert.deepEqual(Object.keys(CLI_COMMAND_SPECS), EXPECTED_CLI_COMMANDS, "CLI must expose the exact ordered 15-command inventory");
assert.equal(COMMAND_SURFACES.length, 12, "host workflow inventory must remain exactly 12");
assert.equal(toolDefinitions.length, 14, "MCP inventory must remain exactly 14");
assert.equal(PROJECT_HOST_IDS.length, 5, "checked-in project host inventory must remain exactly five");
assert.equal(allGeneratedCommandAdapterPaths().length, 60, "generated adapter inventory must remain exactly 60");

const readText = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const readme = readText("README.md");
const usage = readText("docs/USAGE.md");
const packaging = readText("docs/PACKAGING.md");
const install = readText("docs/INSTALL.md");
const capabilityMatrix = readText("docs/CAPABILITY_MATRIX.md");
assert.match(readme, /^Dove is a local-first research workflow toolkit for papers, experiments, engineering, and review-driven work\./mu, "README must describe Dove as a local-first research workflow toolkit");
for (const [relativePath, content] of [["README.md", readme], ["docs/USAGE.md", usage], ["docs/CAPABILITY_MATRIX.md", capabilityMatrix]]) {
  assert.doesNotMatch(content, /\brunning experiments\b/iu, `${relativePath} must not claim that Dove runs experiments`);
}
assert.match(usage, /host resumes the original task only after successful creation/u, "usage docs must preserve the Dove responsibility boundary");
assert.match(capabilityMatrix, /leaves planning and execution to the host|host work|host execution/u, "capability matrix must state the execution boundary");
assert.doesNotMatch(readme, /npm install --save-dev dove(?:\s|$)/u, "README must not direct users to the unrelated bare npm package");
assert.doesNotMatch(install, /npm install --save-dev dove(?:\s|$)/u, "installation docs must not direct users to the unrelated bare npm package");
assert.match(install, /bare public npm package named `dove` is unrelated/u, "installation docs must state the current npm-name collision");
assert.equal(packageJson.repository?.url, "git+https://github.com/tianyunlinger02/dove.git", "package metadata must identify the public source repository");
for (const sourceEntry of ["src/core/index.mjs", "bin/dove.mjs", "mcp/dove-state-server.mjs", "scripts/doctor-mcp-probe.mjs", "scripts/dove-user-prompt-submit.mjs"]) {
  assert.ok(packaging.includes(sourceEntry), `packaging docs must map bundle source ${sourceEntry}`);
}
for (const requiredStatement of ["npm ci", "npm run build:check", "12/14/60", "bundle reproducibility"]) {
  assert.ok(packaging.includes(requiredStatement), `packaging docs must include ${requiredStatement}`);
}

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
