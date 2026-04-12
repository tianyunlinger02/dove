#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { ensureWorkspace } from "../src/core/index.mjs";
import { createWorkflowBoundaries } from "../src/core/schema.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const COPY_PATHS = [".opencode", ".opencode.json", "bin", "docs", "mcp", "scripts", "src", "README.md"];

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
  const boundaries = createWorkflowBoundaries();
  const disallowedCopies = COPY_PATHS.filter((relativePath) => boundaries.userOwnedPaths.some((prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`)));
  if (disallowedCopies.length > 0) {
    throw new Error(`Refusing to manage user-owned paths: ${disallowedCopies.join(", ")}`);
  }
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
  ensureWorkspace(target);
  copied.push(".paper/* (bootstrap only, user-owned state preserved)");
  return {
    target,
    copied,
    force,
    boundaryPolicy: {
      managedPaths: boundaries.managedPaths,
      paperBootstrapOnlyPaths: boundaries.paperBootstrapOnlyPaths.length,
      userOwnedPaths: boundaries.userOwnedPaths
    }
  };
}

function doctor(target) {
  const boundariesPath = path.join(target, ".paper", "workflow-pack", "boundaries.json");
  const required = [
    ".opencode/commands/paper.init.md",
    ".opencode/commands/paper.orchestrate.md",
    ".opencode/commands/paper.pipeline.md",
    ".opencode/commands/paper.experiment-audit.md",
    ".opencode/commands/paper.result-bridge.md",
    ".opencode/skills/paper-factory-pipeline/SKILL.md",
    ".opencode/skills/paper-factory-planner/SKILL.md",
    ".opencode.json",
    ".paper/state.json",
    ".paper/workspace/index.json",
    "mcp/paper-state-server.mjs",
    "src/mcp/server.mjs"
  ];

  const missing = required.filter((relativePath) => !fs.existsSync(path.join(target, relativePath)));
  const result = {
    target,
    node: process.version,
    healthy: missing.length === 0,
    missing,
    checks: [],
    boundaryPolicy: null
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

  const rawJsonChecksPassed = result.checks.every((check) => check.ok);

  let boundaryRawParseOk = true;
  if (fs.existsSync(boundariesPath)) {
    try {
      JSON.parse(fs.readFileSync(boundariesPath, "utf8"));
    } catch (error) {
      boundaryRawParseOk = false;
      result.checks.push({
        check: "raw-boundary-json",
        ok: false,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (rawJsonChecksPassed && boundaryRawParseOk) {
    ensureWorkspace(target);
  }

  try {
    const boundaries = JSON.parse(fs.readFileSync(boundariesPath, "utf8"));
    const missingBootstrapPaths = (boundaries.paperBootstrapOnlyPaths ?? []).filter((relativePath) => !fs.existsSync(path.join(target, relativePath)));
    const boundaryHasMetadata = Boolean(boundaries.managedArtifacts?.workflowBoundaries?.revisionId)
      && Boolean(boundaries.managedArtifacts?.workflowBoundaries?.templateHash)
      && Boolean(boundaries.managedArtifacts?.workspaceIndex?.revisionId);
    const userOwnedExistingPaths = (boundaries.userOwnedPaths ?? []).filter((relativePath) => fs.existsSync(path.join(target, relativePath)));
    result.boundaryPolicy = {
      boundaryFile: ".paper/workflow-pack/boundaries.json",
      managedPaths: boundaries.managedPaths ?? [],
      missingBootstrapPaths,
      userOwnedExistingPaths,
      managedArtifactMetadataPresent: boundaryHasMetadata
    };
    result.checks.push({
      check: "boundary-policy",
      ok: missingBootstrapPaths.length === 0 && boundaryHasMetadata,
      message: missingBootstrapPaths.length === 0
        ? (boundaryHasMetadata ? "boundary metadata present" : "boundary metadata missing")
        : `missing bootstrap artifacts: ${missingBootstrapPaths.join(", ")}`
    });
  } catch (error) {
    result.checks.push({ check: "boundary-policy", ok: false, message: error instanceof Error ? error.message : String(error) });
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
