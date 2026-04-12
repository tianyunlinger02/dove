import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const CLI = path.join(ROOT, "bin", "paper-factory.mjs");

test("CLI install copies the workflow pack into a target workspace", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "paper-factory-install-"));
  const result = spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(fs.existsSync(path.join(target, ".opencode", "commands", "paper.pipeline.md")));
  assert.ok(fs.existsSync(path.join(target, ".opencode", "skills", "paper-factory-pipeline", "SKILL.md")));
  assert.ok(fs.existsSync(path.join(target, ".paper", "state.json")));
   assert.ok(fs.existsSync(path.join(target, ".paper", "workflow-pack", "boundaries.json")));
   assert.ok(fs.existsSync(path.join(target, ".paper", "task-packets", "index.json")));
  assert.ok(fs.existsSync(path.join(target, "bin", "paper-factory.mjs")));
  assert.ok(fs.existsSync(path.join(target, "mcp", "paper-state-server.mjs")));
  assert.ok(fs.existsSync(path.join(target, "scripts", "validate-mcp.mjs")));
  assert.ok(fs.existsSync(path.join(target, "src", "mcp", "server.mjs")));
  const config = JSON.parse(fs.readFileSync(path.join(target, ".opencode.json"), "utf8"));
  assert.equal(Object.hasOwn(config, "$schema"), false);
});

test("CLI sync preserves user-owned .paper workspace state", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "paper-factory-sync-"));
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  const draftPath = path.join(target, ".paper", "drafts", "introduction.md");
  fs.mkdirSync(path.dirname(draftPath), { recursive: true });
  fs.writeFileSync(draftPath, "# Introduction\n\nUser-owned draft content.\n", "utf8");

  const result = spawnSync("node", [CLI, "sync", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(fs.readFileSync(draftPath, "utf8"), /User-owned draft content/);
});

test("CLI doctor returns non-zero for unhealthy workspaces", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "paper-factory-doctor-"));
  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stdout);
});

test("CLI doctor fails when key JSON artifacts are malformed", () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "paper-factory-doctor-bad-json-"));
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  fs.writeFileSync(path.join(target, ".paper", "state.json"), "{bad json", "utf8");

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /json:.paper\/state.json/);
});
