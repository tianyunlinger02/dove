#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const COPY_PATHS = [".opencode", ".opencode.json", ".paper", "bin", "docs", "mcp", "scripts", "src", "README.md"];

function usage() {
  console.log(`paper-factory

Usage:
  paper-factory install [target] [--force]
  paper-factory sync [target] [--force]
  paper-factory doctor [target]
`);
}

function resolveTarget(rawTarget) {
  return path.resolve(process.cwd(), rawTarget || ".");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyRecursive(source, destination, force) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    ensureDir(destination);
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(destination, entry), force);
    }
    return;
  }

  ensureDir(path.dirname(destination));
  if (fs.existsSync(destination) && !force) {
    return;
  }
  fs.copyFileSync(source, destination);
}

function installOrSync(target, force) {
  const copied = [];
  for (const relativePath of COPY_PATHS) {
    const source = path.join(PACKAGE_ROOT, relativePath);
    if (!fs.existsSync(source)) {
      continue;
    }
    const destination = path.join(target, relativePath);
    copyRecursive(source, destination, force);
    copied.push(relativePath);
  }
  return { target, copied, force };
}

function doctor(target) {
  const required = [
    ".opencode/commands/paper.init.md",
    ".opencode/commands/paper.orchestrate.md",
    ".opencode/commands/paper.pipeline.md",
    ".opencode/skills/paper-factory-pipeline/SKILL.md",
    ".opencode/skills/paper-factory-planner/SKILL.md",
    ".opencode.json",
    ".paper/state.json",
    "mcp/paper-state-server.mjs",
    "src/mcp/server.mjs"
  ];

  const missing = required.filter((relativePath) => !fs.existsSync(path.join(target, relativePath)));
  const result = {
    target,
    node: process.version,
    healthy: missing.length === 0,
    missing,
    checks: []
  };

  const jsonChecks = [
    ".opencode.json",
    ".paper/state.json"
  ];

  for (const relativePath of jsonChecks) {
    const fullPath = path.join(target, relativePath);
    try {
      JSON.parse(fs.readFileSync(fullPath, "utf8"));
      result.checks.push({ check: `json:${relativePath}`, ok: true });
    } catch (error) {
      result.checks.push({ check: `json:${relativePath}`, ok: false, message: error instanceof Error ? error.message : String(error) });
    }
  }

  const probeScript = path.join(target, "scripts", "doctor-mcp-probe.mjs");
  if (fs.existsSync(probeScript)) {
    const probe = spawnSync("node", [probeScript, target], {
      cwd: target,
      encoding: "utf8"
    });
    result.checks.push({
      check: "mcp-probe",
      ok: probe.status === 0,
      message: probe.status === 0 ? "ok" : (probe.stderr || probe.stdout || `exit ${probe.status}`)
    });
  }

  result.healthy = result.healthy && result.checks.every((check) => check.ok);

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.healthy ? 0 : 1;
}

const [, , command, maybeTarget, ...rest] = process.argv;
const force = rest.includes("--force");

if (!command || command === "help" || command === "--help") {
  usage();
  process.exit(0);
}

if (command === "install" || command === "sync") {
  const target = resolveTarget(maybeTarget);
  const result = installOrSync(target, force);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

if (command === "doctor") {
  doctor(resolveTarget(maybeTarget));
  process.exit(process.exitCode ?? 0);
}

usage();
process.exit(1);
