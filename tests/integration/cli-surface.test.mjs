import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { initializeProjectIntegration } from "../../src/core/project-installation.mjs";
import { initializeWorkspace } from "../helpers/current-schema-workspace.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

const ROOT = process.cwd();
const CLI = path.join(ROOT, "bin", "dove.mjs");
const PACKAGE = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

function installProject(root) {
  initializeProjectIntegration(root, { packageName: PACKAGE.name, packageVersion: PACKAGE.version, hosts: ["claude"] });
}

function run(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: "utf8", ...options });
}

test("CLI help exposes the current command and Schema 18 option surface", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  for (const command of ["init", "sync", "doctor", "workspace", "mcp", "hook", "mission", "status", "lessons", "source", "experiment", "draft", "figure", "review", "rebuttal"]) {
    assert.match(result.stdout, new RegExp(`\\b${command}\\b`, "u"));
  }
  for (const stale of ["--snapshot-summary", "--requirement-json", "--decision-json", "--work-item-json", "--alignment-json", "--change-from-json", "--node-update-json", "--target-artifact", "--expected-artifact", "--decision-revision", "--consumed-receipt-id"]) {
    assert.equal(result.stdout.includes(stale), false, `help exposes retired flag ${stale}`);
  }
  assert.doesNotMatch(result.stdout, /schema(?:\s+version)?\s*17/iu);
});

test("retired CLI commands fail closed without creating research state", () => {
  for (const command of ["install", "receipt", "version", "auto", "operator", "review-loop", "orchestrate", "audit", "return"]) {
    const root = createTempRoot(`dove-cli-retired-${command}-`);
    try {
      const result = run([command, root]);
      assert.notEqual(result.status, 0, `${command} must fail`);
      assert.match(result.stdout, /Usage:/u);
      assert.equal(fs.existsSync(path.join(root, ".dove")), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("Lessons CLI reads the complete canonical document without a Mission selector", () => {
  const root = createTempRoot("dove-cli-lessons-current-");
  try {
    installProject(root);
    initializeWorkspace(root);
    const result = run(["lessons", root, "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.report.status, "ok");
    assert.match(payload.report.markdown, /^# Dove Lessons\n/iu);
    assert.equal(Object.hasOwn(payload.report, "missionNumber"), false);
    assert.equal(fs.existsSync(path.join(root, ".dove", "LESSONS.md")), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("status remains zero-write and public selection is one-based", () => {
  const root = createTempRoot("dove-cli-status-current-");
  try {
    installProject(root);
    initializeWorkspace(root);
    const before = fs.readFileSync(path.join(root, ".dove", "LESSONS.md"), "utf8");
    const result = run(["status", root, "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.hostControl.classification.phase, "read");
    assert.doesNotMatch(JSON.stringify(payload.report), /mission-[a-z0-9._-]+|contractDigest|sha256/iu);
    assert.equal(fs.readFileSync(path.join(root, ".dove", "LESSONS.md"), "utf8"), before);
    const invalid = run(["status", root, "--mission-number", "0"]);
    assert.notEqual(invalid.status, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("current Review CLI accepts only scope and archive operations", () => {
  const root = createTempRoot("dove-cli-review-current-");
  try {
    installProject(root);
    initializeWorkspace(root);
    const scope = run(["review", root, "--scope", "--mission-number", "1", "--host-kind", "claude", "--artifact", "missing.md", "--json"]);
    assert.notEqual(scope.status, 0);
    assert.doesNotMatch(`${scope.stdout}\n${scope.stderr}`, /exchange|prepare|import|policy/iu);
    const stale = run(["review", root, "--prepare", "--policy", "external"]);
    assert.notEqual(stale.status, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
