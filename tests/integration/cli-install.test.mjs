import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { createTempRoot } from "../helpers/temp-root.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const PACKAGE = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const CLAUDE_COMMAND_NAMES = Object.freeze([
  "auto", "draft", "experiment", "figure", "lessons", "rebuttal", "research", "review", "source", "status"
]);
const CLAUDE_EXCLUSIVE_PATHS = Object.freeze([
  ...CLAUDE_COMMAND_NAMES.map((name) => `.claude/commands/dove/${name}.md`),
  ".claude/agents/dove-reviewer.md",
  ".claude/rules/dove.md",
  ".claude/skills/dove-intake/SKILL.md",
  ".claude/skills/dove-lessons-intake/SKILL.md"
]);
const PROJECT_RUNTIME_PATHS = Object.freeze([
  "bin/dove-package.mjs",
  "dist/index.mjs",
  "scripts/dove-user-prompt-submit-package.mjs"
]);
const EXPECTED_HOOK_COMMAND = 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"';

let installedFixture = null;

function combinedOutput(result) {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
}

function assertSuccess(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message ?? "spawn failed"}`);
  assert.equal(result.signal, null, `${label}: terminated by ${result.signal}`);
  assert.equal(result.status, 0, `${label}: ${combinedOutput(result)}`);
}

function assertFailure(result, label, pattern = /./u) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message ?? "spawn failed"}`);
  assert.equal(result.signal, null, `${label}: command did not fail closed`);
  assert.notEqual(result.status, 0, `${label}: unexpectedly succeeded`);
  assert.match(combinedOutput(result), pattern, `${label}: ${combinedOutput(result)}`);
}

function parseJsonOutput(result, label) {
  assertSuccess(result, label);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    assert.fail(`${label}: stdout was not JSON: ${error.message}\n${combinedOutput(result)}`);
  }
}

function writeJson(root, relativePath, value) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function snapshotTree(root) {
  const entries = [];
  function visit(directory, prefix = "") {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = prefix ? path.posix.join(prefix, entry.name) : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        entries.push({ path: relativePath, type: "directory" });
        visit(absolutePath, relativePath);
      } else if (entry.isSymbolicLink()) {
        entries.push({ path: relativePath, type: "symlink", target: fs.readlinkSync(absolutePath) });
      } else {
        entries.push({ path: relativePath, type: "file", bytes: fs.readFileSync(absolutePath).toString("base64") });
      }
    }
  }
  visit(root);
  return entries;
}

function installPackedFixture() {
  if (installedFixture !== null) return installedFixture;

  const root = createTempRoot("dove-cli-install-fixture-");
  const packDirectory = path.join(root, "pack");
  const consumer = path.join(root, "consumer");
  const home = path.join(root, "home");
  fs.mkdirSync(packDirectory, { recursive: true });
  fs.mkdirSync(consumer, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(consumer, "package.json"), `${JSON.stringify({ name: "dove-cli-install-consumer", private: true }, null, 2)}\n`, "utf8");

  const packed = spawnSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", packDirectory], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 120000
  });
  assertSuccess(packed, "pack Dove without build scripts");
  const [packResult] = JSON.parse(packed.stdout);
  const tarball = path.join(packDirectory, packResult.filename);

  const installed = spawnSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock", tarball], {
    cwd: consumer,
    encoding: "utf8",
    timeout: 120000
  });
  assertSuccess(installed, "install packed Dove into isolated consumer");

  const binDirectory = path.join(consumer, "node_modules", ".bin");
  const cli = path.join(binDirectory, "dove");
  assert.equal(fs.existsSync(cli), true, "isolated installation must expose node_modules/.bin/dove");
  installedFixture = {
    root,
    consumer,
    cli,
    packageRoot: path.join(consumer, "node_modules", PACKAGE.name),
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: path.join(home, ".config"),
      PATH: [binDirectory, process.env.PATH].filter(Boolean).join(path.delimiter)
    }
  };
  return installedFixture;
}

function runCli(args, options = {}) {
  const fixture = installPackedFixture();
  return spawnSync(fixture.cli, args, {
    cwd: options.cwd ?? fixture.consumer,
    env: { ...fixture.env, ...options.env },
    input: options.input,
    encoding: "utf8",
    timeout: options.timeout ?? 15000,
    maxBuffer: 4 * 1024 * 1024
  });
}

function initializeClaudeProject(root, options = {}) {
  const result = runCli(["init", "--project", root, "--host", "claude", "--json"], options);
  const payload = parseJsonOutput(result, "initialize Claude project integration");
  assert.equal(payload.status, "initialized");
  assert.equal(payload.target, fs.realpathSync.native(root));
  assert.deepEqual(payload.hosts, ["claude"]);
  return payload;
}

function assertNoProjectRuntime(root) {
  assert.equal(fs.existsSync(path.join(root, ".dove", "install", "manifest.json")), true, "project init must create only current integration state");
  assert.equal(fs.existsSync(path.join(root, ".dove", "research", "RESEARCH.md")), false, "project init must not create research documents");
  assert.deepEqual(fs.readdirSync(path.join(root, ".dove")), ["install"]);
  for (const directory of ["bin", "dist", "mcp", "scripts"]) {
    assert.equal(fs.existsSync(path.join(root, directory)), false, `project init created runtime directory: ${directory}`);
  }
  for (const relativePath of PROJECT_RUNTIME_PATHS) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, `project init copied runtime: ${relativePath}`);
  }
}

test("packed installed CLI exposes help and version without MCP commands", () => {
  const fixture = installPackedFixture();
  assert.equal(fs.realpathSync.native(fixture.cli).startsWith(fs.realpathSync.native(fixture.packageRoot)), true);

  const help = runCli(["--help"]);
  assertSuccess(help, "installed dove --help");
  assert.match(help.stdout, /dove init \[--project <dir>\]/u);
  assert.match(help.stdout, /dove hook user-prompt-submit/u);
  assert.doesNotMatch(help.stdout, /\bdove mcp\b|register-user|unregister-user|MCP serving|MCP tools/iu);

  for (const args of [["mcp", "serve"], ["mcp", "register-user"], ["mcp", "unregister-user"]]) {
    assertFailure(runCli(args), `retired ${args.join(" ")}`, /Unknown or unsupported Dove command/iu);
  }

  const version = runCli(["--version"]);
  assertSuccess(version, "installed dove --version");
  assert.equal(version.stdout.trim(), "3.0.0");
});

test("packed init and sync install Skills and hook without project server resources", () => {
  const root = createTempRoot("dove-cli-clean-project-");
  const existingMcp = {
    projectMetadata: { keep: true },
    mcpServers: { existing: { type: "stdio", command: "existing", args: ["--keep"] } }
  };
  const existingSettings = {
    theme: "dark",
    hooks: { UserPromptSubmit: [{ matcher: "user-owned", hooks: [{ type: "command", command: "keep-prompt" }] }] }
  };
  writeJson(root, ".mcp.json", existingMcp);
  writeJson(root, ".claude/settings.json", existingSettings);

  initializeClaudeProject(root);
  assertNoProjectRuntime(root);

  const manifest = JSON.parse(fs.readFileSync(path.join(root, ".dove", "install", "manifest.json"), "utf8"));
  assert.equal(manifest.revision, "2.0");
  assert.deepEqual(manifest.package, { name: PACKAGE.name, version: PACKAGE.version });
  assert.deepEqual(manifest.runtime, { mode: "user-cli" });
  assert.deepEqual(manifest.hosts, ["claude"]);
  assert.equal(manifest.managed.length, CLAUDE_EXCLUSIVE_PATHS.length + 1);
  assert.deepEqual(new Set(manifest.managed.map((entry) => entry.path)), new Set([...CLAUDE_EXCLUSIVE_PATHS, ".claude/settings.json"]));

  for (const relativePath of CLAUDE_EXCLUSIVE_PATHS) assert.equal(fs.lstatSync(path.join(root, relativePath)).isFile(), true, relativePath);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, ".mcp.json"), "utf8")), existingMcp);
  assert.equal(fs.existsSync(path.join(root, ".opencode.json")), false);
  assert.equal(fs.existsSync(path.join(root, ".claude/settings.local.json")), false);

  const settings = JSON.parse(fs.readFileSync(path.join(root, ".claude/settings.json"), "utf8"));
  assert.equal(settings.theme, "dark");
  assert.equal(settings.hooks.UserPromptSubmit[0].matcher, "user-owned");
  assert.equal(settings.hooks.UserPromptSubmit[1].hooks[0].command, EXPECTED_HOOK_COMMAND);

  const sync = runCli(["sync", "--project", root, "--json"]);
  const payload = parseJsonOutput(sync, "sync initialized project");
  assert.equal(payload.status, "unchanged");
  assert.deepEqual(payload.changedPaths, []);
});

test("installed export-research JSON mode previews without writes", () => {
  const root = createTempRoot("dove-cli-export-");
  writeJson(root, ".dove/format.json", { format: "dove-research-v2" });
  writeJson(root, ".dove/workspace.json", {
    workspaceId: "workspace-one",
    researchQuestion: "What survives the old state?",
    mainline: "Export only recorded material.",
    contributionIntent: "Preserve mechanically recoverable context.",
    currentFocus: "Review the export preview.",
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z"
  });
  fs.writeFileSync(path.join(root, ".dove", "LESSONS.md"), "# Lessons\n\nKeep adverse evidence.\n");

  const before = snapshotTree(root);
  const preview = runCli(["export-research", "--project", root, "--json"]);
  const payload = parseJsonOutput(preview, "preview research export");
  assert.equal(payload.status, "ready");
  assert.equal(payload.action, "export-research");
  assert.deepEqual(payload.confirmation, { required: true, default: false });
  assert.equal(Object.hasOwn(payload, "plan"), false);
  assert.deepEqual(snapshotTree(root), before);
});

test("installed reinstall JSON mode returns a default-No preview without writes or prompts", () => {
  const root = createTempRoot("dove-cli-reinstall-preview-");
  initializeClaudeProject(root);
  fs.mkdirSync(path.join(root, ".dove", "research"), { recursive: true });
  fs.writeFileSync(path.join(root, ".dove", "research", "notes.md"), "private research\n");
  const before = snapshotTree(root);

  const preview = runCli(["reinstall", "--project", root, "--json"], { input: "" });
  const payload = parseJsonOutput(preview, "preview Complete Reinstall");
  assert.equal(preview.stderr, "");
  assert.equal(payload.status, "ready");
  assert.equal(payload.action, "reinstall");
  assert.deepEqual(payload.confirmation, { required: true, default: false });
  assert.equal(payload.removedPaths.includes(".dove/research/notes.md"), true);
  assert.equal(Object.hasOwn(payload, "manifest"), false);
  assert.deepEqual(snapshotTree(root), before);
});

test("installed prompt hook remains connected without creating research documents", () => {
  const root = createTempRoot("dove-cli-hook-");
  initializeClaudeProject(root);
  const hook = runCli(["hook", "user-prompt-submit", "--project", root], {
    cwd: root,
    input: `${JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "Implement the parser and add regression tests." })}\n`
  });
  const payload = parseJsonOutput(hook, "installed UserPromptSubmit route");
  assert.equal(payload.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(payload.hookSpecificOutput.additionalContext, /dove-intake|zero-write role and Skill routing/u);
  assert.equal(fs.existsSync(path.join(root, ".dove", "research")), false);
});

test("doctor is zero-write and omits registration, eligibility, and connection", () => {
  const root = createTempRoot("dove-cli-doctor-");
  initializeClaudeProject(root);
  fs.mkdirSync(path.join(root, ".dove", "research"), { recursive: true });
  fs.writeFileSync(path.join(root, ".dove", "research", "RESEARCH.md"), "# Free-form research overview\n");
  const before = snapshotTree(root);

  const doctor = runCli(["doctor", "--project", root, "--json"], { cwd: root });
  const payload = parseJsonOutput(doctor, "doctor initialized project");
  assert.equal(payload.ready, true);
  assert.equal(payload.target, fs.realpathSync.native(root));
  assert.equal(payload.projectIntegration.healthy, true);
  assert.equal(payload.workspaceState.state, "current");
  assert.equal(payload.workspaceState.healthy, true);
  assert.equal(payload.legacyCopiedRuntime.detected, false);
  for (const retired of ["userMcpRegistration", "projectEligibility", "connection", "hostRegistration", "readiness"]) {
    assert.equal(Object.hasOwn(payload, retired), false, retired);
  }
  assert.deepEqual(snapshotTree(root), before);
});
