#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { COMMAND_SURFACES, MANAGED_PACKAGE_PATHS } from "../src/core/command-manifest.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_SCRIPTS = ["build", "build:check", "commands:check", "commands:validate", "package:validate", "test", "check", "release:check"];
const FORBIDDEN_PACKAGE_PATHS = [".opencode.json", "mcp/dove-state-server-package.mjs"];
const FORBIDDEN_SCRIPTS = ["mcp:serve", "mcp:validate"];

const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const packageLock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));

assert.equal(packageJson.name, PACKAGE_NAME);
assert.equal(packageJson.version, PACKAGE_VERSION);
assert.equal(packageLock.version, packageJson.version);
assert.equal(packageLock.packages?.[""]?.version, packageJson.version);
assert.deepEqual(packageJson.bin, { dove: "bin/dove-package.mjs" });
assert.deepEqual(packageJson.exports, { ".": "./dist/index.mjs" });
for (const script of REQUIRED_SCRIPTS) assert.equal(typeof packageJson.scripts?.[script], "string", `missing package script ${script}`);
for (const script of FORBIDDEN_SCRIPTS) assert.equal(Object.hasOwn(packageJson.scripts ?? {}, script), false, `retired package script remains: ${script}`);
for (const relativePath of FORBIDDEN_PACKAGE_PATHS) assert.equal(packageJson.files.includes(relativePath), false, `retired package file remains: ${relativePath}`);

assert.deepEqual(COMMAND_SURFACES.map((surface) => surface.id), [
  "dove.research", "dove.status", "dove.source", "dove.experiment", "dove.draft",
  "dove.figure", "dove.review", "dove.rebuttal", "dove.lessons", "dove.auto"
]);

const packageExports = await import(new URL("../dist/index.mjs", import.meta.url));
assert.equal(packageExports.PACKAGE_NAME, packageJson.name);
assert.equal(packageExports.PACKAGE_VERSION, packageJson.version);

const cliVersion = spawnSync(process.execPath, [path.join(ROOT, "bin", "dove-package.mjs"), "--version"], { cwd: ROOT, encoding: "utf8" });
assert.equal(cliVersion.status, 0, cliVersion.stderr || cliVersion.stdout);
assert.equal(cliVersion.stdout.trim(), packageJson.version);

const packed = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: ROOT, encoding: "utf8" });
assert.equal(packed.status, 0, packed.stderr || packed.stdout);
const [pack] = JSON.parse(packed.stdout);
assert.equal(pack.name, packageJson.name);
assert.equal(pack.version, packageJson.version);
assert.equal(pack.filename, `${packageJson.name}-${packageJson.version}.tgz`);
assert.deepEqual(pack.files.map((file) => file.path).sort(), [...MANAGED_PACKAGE_PATHS, "package.json"].sort());
for (const relativePath of FORBIDDEN_PACKAGE_PATHS) assert.equal(pack.files.some((file) => file.path === relativePath), false, `retired path packed: ${relativePath}`);

console.log(JSON.stringify({ status: "passed" }, null, 2));
