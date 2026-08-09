import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { initializeProjectIntegration } from "../../src/core/project-installation.mjs";
import { INSTALLATION_MANIFEST_PATH } from "../../src/core/project-installation-manifest.mjs";
import { createMcpStdioClient } from "../../scripts/mcp-stdio-client.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CLI = path.join(ROOT, "bin", "dove.mjs");
const PACKAGE = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const RUNTIME_COMMANDS = ["init", "sync", "upgrade", "reinstall", "doctor", "mcp", "hook"];
const REMOVED_BUSINESS_COMMANDS = ["workspace", "mission", "receipt", "status", "lessons", "version", "source", "note", "draft", "experience", "experiment", "figure", "review", "rebuttal"];
const MCP_TOOLS = [
  "query_dove_research", "manage_dove_workspace", "manage_dove_missions", "manage_dove_sources",
  "manage_dove_experiments", "manage_dove_claims", "manage_dove_reviews", "manage_dove_lessons"
];

function run(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: options.cwd ?? ROOT,
    encoding: "utf8",
    input: options.input,
    timeout: options.timeout ?? 15000,
    env: { ...process.env, ...options.env }
  });
}

function installProject(root) {
  return initializeProjectIntegration(root, {
    packageName: PACKAGE.name,
    packageVersion: PACKAGE.version,
    hosts: ["claude"]
  });
}

test("CLI help exposes exactly seven runtime commands and no retired business route", () => {
  const help = run(["--help"]);
  assert.equal(help.status, 0, help.stderr || help.stdout);
  for (const command of RUNTIME_COMMANDS) assert.match(help.stdout, new RegExp(`dove ${command}\\b`, "u"));
  assert.match(help.stdout, /nine host Skills and eight public Dove MCP tools/iu);
  for (const command of REMOVED_BUSINESS_COMMANDS) {
    if (["status", "experiment", "draft", "figure", "review", "rebuttal", "lessons", "source", "research"].includes(command)) continue;
    assert.doesNotMatch(help.stdout, new RegExp(`dove ${command}\\b`, "u"));
  }
  assert.doesNotMatch(help.stdout, /--snapshot-summary|--mutation-mode|missionNumber|receipt/iu);
});

test("CLI init and sync use the unified installation root without creating Research Format 1", () => {
  const root = createTempRoot("dove-cli-surface-install-");
  const initialized = run(["init", "--project", root, "--host", "claude", "--json"]);
  assert.equal(initialized.status, 0, initialized.stderr || initialized.stdout);
  const payload = JSON.parse(initialized.stdout);
  assert.equal(payload.status, "initialized");
  assert.deepEqual(payload.hosts, ["claude"]);
  assert.equal(fs.existsSync(path.join(root, INSTALLATION_MANIFEST_PATH)), true);
  assert.equal(fs.existsSync(path.join(root, ".dove", "format.json")), false);
  assert.deepEqual(fs.readdirSync(path.join(root, ".claude", "commands", "dove")).sort(), [
    "draft.md", "experiment.md", "figure.md", "lessons.md", "rebuttal.md", "research.md", "review.md", "source.md", "status.md"
  ]);

  const synchronized = run(["sync", "--project", root, "--json"]);
  assert.equal(synchronized.status, 0, synchronized.stderr || synchronized.stdout);
  assert.equal(JSON.parse(synchronized.stdout).status, "unchanged");
  assert.equal(fs.existsSync(path.join(root, ".dove", "format.json")), false);
});

test("CLI MCP and hook routes require current Claude project integration", async () => {
  const root = createTempRoot("dove-cli-surface-routes-");
  const uninitialized = createTempRoot("dove-cli-surface-uninitialized-");
  installProject(root);

  const hook = run(["hook", "user-prompt-submit", "--project", root], {
    cwd: root,
    input: JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "Implement the bounded parser fix." })
  });
  assert.equal(hook.status, 0, hook.stderr || hook.stdout);
  assert.match(JSON.parse(hook.stdout).hookSpecificOutput.additionalContext, /dove-intake|zero-write role and Skill routing/u);

  for (const args of [["mcp", "serve", "--project", uninitialized], ["hook", "user-prompt-submit", "--project", uninitialized]]) {
    const rejected = run(args, { cwd: uninitialized, input: "{}", timeout: 3000 });
    assert.notEqual(rejected.status, 0);
    assert.match(`${rejected.stdout}\n${rejected.stderr}`, /not initialized|Dove project integration|dove init/iu);
  }

  const client = createMcpStdioClient({ command: process.execPath, args: [CLI, "mcp", "serve", "--project", root], cwd: root });
  try {
    const initialized = await client.call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "cli-surface-test", version: "1" }
    });
    assert.equal(initialized.serverInfo.name, "dove");
    client.notify("notifications/initialized");
    const listed = await client.call("tools/list");
    assert.deepEqual(listed.tools.map((tool) => tool.name), MCP_TOOLS);
  } finally {
    client.kill();
  }
});

test("retired business commands fail without creating Dove state", () => {
  for (const command of REMOVED_BUSINESS_COMMANDS) {
    const root = createTempRoot(`dove-cli-retired-${command}-`);
    const result = run([command, "--project", root], { cwd: root });
    assert.notEqual(result.status, 0, `${command} must be rejected`);
    assert.match(result.stdout, /Usage:/u);
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);
  }
});
