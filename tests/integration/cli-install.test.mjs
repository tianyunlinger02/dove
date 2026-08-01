import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { createMcpStdioClient } from "../../scripts/mcp-stdio-client.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const PACKAGE = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const CLAUDE_COMMAND_NAMES = Object.freeze([
  "draft",
  "experience",
  "figure",
  "lessons",
  "mission",
  "note",
  "rebuttal",
  "review",
  "source",
  "status",
  "experiment",
  "workspace"
]);
const CLAUDE_EXCLUSIVE_PATHS = Object.freeze([
  ...CLAUDE_COMMAND_NAMES.map((name) => `.claude/commands/dove/${name}.md`),
  ".claude/rules/dove.md",
  ".claude/skills/dove-intake/SKILL.md",
  ".claude/skills/dove-lessons-intake/SKILL.md"
]);
const CLAUDE_FRAGMENT_PATHS = Object.freeze([".claude/settings.json", ".claude/settings.local.json", ".mcp.json"]);
const PROJECT_RUNTIME_PATHS = Object.freeze([
  "bin/dove-package.mjs",
  "dist/index.mjs",
  "mcp/dove-state-server-package.mjs",
  "scripts/doctor-mcp-probe-package.mjs",
  "scripts/dove-user-prompt-submit-package.mjs"
]);
const EXPECTED_MCP_SERVER = Object.freeze({
  type: "stdio",
  command: "dove",
  args: ["mcp", "serve", "--project", "."]
});
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
      if (relativePath === ".dove" || relativePath.startsWith(".dove/")) continue;
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
  const shimBin = path.join(root, "shim-bin");
  const home = path.join(root, "home");
  fs.mkdirSync(packDirectory, { recursive: true });
  fs.mkdirSync(consumer, { recursive: true });
  fs.mkdirSync(shimBin, { recursive: true });
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

  const claude = path.join(shimBin, "claude");
  fs.writeFileSync(claude, `#!/usr/bin/env node\nif (process.argv.slice(2).join(" ") !== "mcp get dove") process.exit(2);\nconsole.log("Status: " + (process.env.DOVE_TEST_CLAUDE_STATUS || "Connected"));\n`, "utf8");
  fs.chmodSync(claude, 0o755);

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
      PATH: [shimBin, binDirectory, process.env.PATH].filter(Boolean).join(path.delimiter),
      DOVE_TEST_CLAUDE_STATUS: "Connected"
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
  assert.equal(fs.existsSync(path.join(root, ".dove")), false, "project init must not create research state");
  for (const directory of ["bin", "dist", "mcp", "scripts"]) {
    assert.equal(fs.existsSync(path.join(root, directory)), false, `project init created runtime directory: ${directory}`);
  }
  for (const relativePath of PROJECT_RUNTIME_PATHS) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, `project init copied runtime: ${relativePath}`);
  }
}

function writeLegacyCopiedRuntime(root) {
  for (const [relativePath, content] of [
    ["bin/dove-package.mjs", "copied Dove CLI runtime\n"],
    ["dist/index.mjs", "copied Dove package runtime\n"]
  ]) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, "utf8");
  }
}

test("packed installed CLI exposes a concise home, help, and version", () => {
  const fixture = installPackedFixture();
  assert.equal(fs.realpathSync.native(fixture.cli).startsWith(fs.realpathSync.native(fixture.packageRoot)), true);

  const home = runCli([]);
  assertSuccess(home, "installed bare dove");
  assert.match(home.stdout, /围绕科研主线探索/u);
  assert.match(home.stdout, /尚未配置 Dove/u);
  assert.match(home.stdout, /下一步  dove/u);
  assert.match(home.stdout, /dove --help/u);
  assert.doesNotMatch(home.stdout, /Usage:|\[/u);

  const help = runCli(["--help"]);
  assertSuccess(help, "installed dove --help");
  assert.match(help.stdout, /dove init \[--project <dir>\]/u);
  assert.match(help.stdout, /dove mcp serve --project <dir>/u);
  assert.doesNotMatch(help.stdout, /dove install\b/u);

  const version = runCli(["--version"]);
  assertSuccess(version, "installed dove --version");
  assert.equal(version.stdout.trim(), PACKAGE.version);
});

test("packed init defaults to clean human text while JSON remains machine-readable", () => {
  const humanRoot = createTempRoot("dove-cli-human-init-");
  const human = runCli(["init", "--project", humanRoot]);
  assertSuccess(human, "human project initialization");
  assert.match(human.stdout, /Dove 已在此项目启用/u);
  assert.match(human.stdout, /Claude Code/u);
  assert.match(human.stdout, /科研主线尚未建立/u);
  assert.match(human.stdout, /\/dove:workspace/u);
  assert.match(human.stdout, /重新进入 Claude Code/u);
  assert.doesNotMatch(human.stdout, /\[|writtenPaths|changedPaths|transactionState|\.claude\/commands|\.mcp\.json/u);
  assertNoProjectRuntime(humanRoot);

  const jsonRoot = createTempRoot("dove-cli-json-init-");
  const json = runCli(["init", "--project", jsonRoot, "--format", "json"]);
  const payload = parseJsonOutput(json, "JSON project initialization");
  assert.equal(payload.status, "initialized");
  assert.deepEqual(payload.hosts, ["claude"]);
  assert.doesNotMatch(json.stdout, /\[/u);
  assertNoProjectRuntime(jsonRoot);

  const home = runCli([], { cwd: humanRoot });
  assertSuccess(home, "initialized project home");
  assert.match(home.stdout, /项目集成已是当前版本/u);
  assert.match(home.stdout, /\/dove:workspace/u);
  assert.doesNotMatch(home.stdout, /Usage:|\[/u);

  const repeated = runCli(["init", "--project", humanRoot, "--host", "claude"]);
  assertSuccess(repeated, "repeated project initialization");
  assert.match(repeated.stdout, /已经在此项目启用/u);
  assert.match(repeated.stdout, /没有写入任何文件/u);
  assert.match(repeated.stdout, /dove sync/u);

  const sync = runCli(["sync", "--project", humanRoot]);
  assertSuccess(sync, "human project synchronization");
  assert.match(sync.stdout, /已是最新/u);
  assert.match(sync.stdout, /科研记录未被修改/u);
  assert.doesNotMatch(sync.stdout, /\[|writtenPaths|transactionState/u);
});

test("clean Claude project init writes only manifest, 12 adapters, ambient files, and shared JSON fragments", () => {
  const root = createTempRoot("dove-cli-clean-project-");
  const existingMcp = {
    projectMetadata: { keep: true, values: [1, 2, 3] },
    mcpServers: { existing: { type: "stdio", command: "existing", args: ["--keep"] } }
  };
  const existingSettings = {
    theme: "dark",
    env: { KEEP: "yes" },
    hooks: {
      SessionStart: [{ matcher: "startup", hooks: [{ type: "command", command: "keep-session" }] }],
      UserPromptSubmit: [{ matcher: "user-owned", hooks: [{ type: "command", command: "keep-prompt" }] }]
    }
  };
  writeJson(root, ".mcp.json", existingMcp);
  writeJson(root, ".claude/settings.json", existingSettings);

  initializeClaudeProject(root);

  const manifest = JSON.parse(fs.readFileSync(path.join(root, ".dove-install", "manifest.json"), "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.package.name, PACKAGE.name);
  assert.equal(manifest.package.version, PACKAGE.version);
  assert.deepEqual(manifest.runtime, { mode: "user-cli", protocolVersion: 1 });
  assert.deepEqual(manifest.hosts, ["claude"]);
  assert.equal(manifest.managed.length, 18);
  assert.deepEqual(
    new Set(manifest.managed.map((entry) => entry.path)),
    new Set([...CLAUDE_EXCLUSIVE_PATHS, ...CLAUDE_FRAGMENT_PATHS])
  );

  const commandDirectory = path.join(root, ".claude", "commands", "dove");
  assert.deepEqual(
    fs.readdirSync(commandDirectory).sort(),
    CLAUDE_COMMAND_NAMES.map((name) => `${name}.md`).sort()
  );
  for (const relativePath of CLAUDE_EXCLUSIVE_PATHS) {
    assert.equal(fs.lstatSync(path.join(root, relativePath)).isFile(), true, `missing ${relativePath}`);
  }

  const mcp = JSON.parse(fs.readFileSync(path.join(root, ".mcp.json"), "utf8"));
  assert.deepEqual(mcp.projectMetadata, existingMcp.projectMetadata);
  assert.deepEqual(mcp.mcpServers.existing, existingMcp.mcpServers.existing);
  assert.deepEqual(mcp.mcpServers.dove, EXPECTED_MCP_SERVER);

  const settings = JSON.parse(fs.readFileSync(path.join(root, ".claude", "settings.json"), "utf8"));
  assert.equal(settings.theme, existingSettings.theme);
  assert.deepEqual(settings.env, existingSettings.env);
  assert.deepEqual(settings.hooks.SessionStart, existingSettings.hooks.SessionStart);
  assert.deepEqual(settings.hooks.UserPromptSubmit[0], existingSettings.hooks.UserPromptSubmit[0]);
  assert.equal(settings.hooks.UserPromptSubmit.length, 2);
  assert.equal(settings.hooks.UserPromptSubmit[1].hooks[0].command, EXPECTED_HOOK_COMMAND);
  assertNoProjectRuntime(root);
});

test("sync resolves the installed root from nested cwd and is byte-idempotent", () => {
  const root = createTempRoot("dove-cli-sync-nested-");
  initializeClaudeProject(root);
  const nested = path.join(root, "docs", "nested");
  fs.mkdirSync(nested, { recursive: true });
  const before = snapshotTree(root);

  const sync = runCli(["sync", "--json"], { cwd: nested });
  const payload = parseJsonOutput(sync, "sync initialized project from nested cwd");
  assert.equal(payload.status, "unchanged");
  assert.equal(payload.target, fs.realpathSync.native(root));
  assert.deepEqual(payload.hosts, ["claude"]);
  assert.deepEqual(payload.writtenPaths, []);
  assert.deepEqual(payload.removedPaths, []);
  assert.deepEqual(payload.changedPaths, []);
  assert.deepEqual(snapshotTree(root), before);
  assertNoProjectRuntime(root);
});

test("business, MCP, and hook routes fail closed outside an initialized project", () => {
  for (const [label, args, options] of [
    ["manifest-driven sync", ["sync", "--project", "PROJECT", "--json"], {}],
    ["business status", ["status", "--json"], {}],
    ["MCP serve", ["mcp", "serve", "--project", "PROJECT"], { timeout: 3000 }],
    ["UserPromptSubmit hook", ["hook", "user-prompt-submit", "--project", "PROJECT"], {
      input: `${JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "Implement the parser and add regression tests." })}\n`
    }]
  ]) {
    const root = createTempRoot(`dove-cli-uninitialized-${label.replaceAll(" ", "-")}-`);
    const argsWithProject = args.map((item) => item === "PROJECT" ? root : item);
    const before = snapshotTree(root);
    const result = runCli(argsWithProject, { cwd: root, ...options });
    assertFailure(result, label, /not initialized|run ['"]?dove init|Dove project integration/iu);
    assert.deepEqual(snapshotTree(root), before, `${label} wrote to an uninitialized project`);
    assert.equal(fs.existsSync(path.join(root, ".dove")), false);
  }
});

test("retired install, platform, and top-level workspace-init forms are rejected without writes", () => {
  const cases = [
    ["legacy install command", (root) => ["install", "--project", root]],
    ["legacy platform option", (root) => ["init", "--project", root, "--host", "claude", "--platform", "linux"]],
    ["legacy init goal", (root) => ["init", "--project", root, "--goal", "Old workspace init"]],
    ["legacy init migration", (root) => ["init", "--project", root, "--migrate-workspace"]],
    ["legacy init archive reset", (root) => ["init", "--project", root, "--archive-reset"]]
  ];

  for (const [label, argsFor] of cases) {
    const root = createTempRoot(`dove-cli-retired-${label.replaceAll(" ", "-")}-`);
    const result = runCli(argsFor(root), { cwd: root });
    assertFailure(result, label, /Usage:|Unknown|unsupported|does not accept|not a Dove command/iu);
    assert.deepEqual(snapshotTree(root), [], `${label} changed the project`);
  }
});

test("installed hook output and PATH-based MCP route are minimally connected without workspace bootstrap", async () => {
  const root = createTempRoot("dove-cli-routes-");
  initializeClaudeProject(root);
  assertNoProjectRuntime(root);

  const hook = runCli(["hook", "user-prompt-submit", "--project", root], {
    cwd: root,
    input: `${JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "Implement the parser and add regression tests." })}\n`
  });
  const hookPayload = parseJsonOutput(hook, "installed UserPromptSubmit route");
  assert.equal(hookPayload.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(hookPayload.hookSpecificOutput.additionalContext, /dove-intake|create_ambient_dove_mission/u);
  assert.equal(fs.existsSync(path.join(root, ".dove")), false);

  const fixture = installPackedFixture();
  const client = createMcpStdioClient({
    command: fixture.cli,
    args: ["mcp", "serve", "--project", root],
    cwd: root,
    env: { ...fixture.env, CLAUDE_PROJECT_DIR: root }
  });
  try {
    const initialized = await client.call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "dove-cli-install-test", version: "1" }
    });
    assert.match(initialized.serverInfo.name, /dove/iu);
    client.notify("notifications/initialized");
    const listed = await client.call("tools/list");
    const toolNames = new Set(listed.tools.map((tool) => tool.name));
    assert.equal(toolNames.has("query_dove_status"), true);
    assert.equal(toolNames.has("create_ambient_dove_mission"), true);
  } finally {
    client.kill();
  }
  assert.equal(fs.existsSync(path.join(root, ".dove")), false);
});

test("doctor is zero-write and requires Connected Claude readiness", () => {
  const root = createTempRoot("dove-cli-doctor-connected-");
  initializeClaudeProject(root);
  const nested = path.join(root, "docs", "nested");
  fs.mkdirSync(nested, { recursive: true });
  const before = snapshotTree(root);

  const doctor = runCli(["doctor", "--json"], { cwd: nested, env: { DOVE_TEST_CLAUDE_STATUS: "Connected" } });
  const payload = parseJsonOutput(doctor, "doctor from nested initialized project");
  assert.equal(payload.healthy, true);
  assert.equal(payload.zeroWrite, true);
  assert.deepEqual(payload.writes, []);
  assert.equal(payload.target, fs.realpathSync.native(root));
  assert.equal(payload.projectIntegration.healthy, true);
  assert.equal(payload.workspaceState.mode, "absent");
  assert.equal(payload.workspaceState.healthy, true);
  assert.equal(payload.hostRegistration.healthy, true);
  assert.equal(payload.readiness.state, "connected");
  assert.equal(payload.readiness.ready, true);
  assert.equal(payload.legacyCopiedRuntime.detected, false);
  assert.deepEqual(snapshotTree(root), before);

  const pending = runCli(["doctor", "--project", root, "--json"], {
    cwd: nested,
    env: { DOVE_TEST_CLAUDE_STATUS: "Pending approval (run claude to approve)" }
  });
  assert.equal(pending.error, undefined);
  assert.equal(pending.signal, null);
  assert.notEqual(pending.status, 0, combinedOutput(pending));
  const pendingPayload = JSON.parse(pending.stdout);
  assert.equal(pendingPayload.healthy, false);
  assert.equal(pendingPayload.zeroWrite, true);
  assert.deepEqual(pendingPayload.writes, []);
  assert.equal(pendingPayload.readiness.state, "pending-approval");
  assert.equal(pendingPayload.readiness.ready, false);
  assert.deepEqual(snapshotTree(root), before);
  assertNoProjectRuntime(root);
});

test("legacy copied runtime is rejected by init and reported unhealthy by zero-write doctor", () => {
  const legacyRoot = createTempRoot("dove-cli-legacy-init-");
  writeLegacyCopiedRuntime(legacyRoot);
  const legacyBefore = snapshotTree(legacyRoot);
  const rejected = runCli(["init", "--project", legacyRoot, "--host", "claude", "--json"], { cwd: legacyRoot });
  assertFailure(rejected, "legacy copied runtime init", /legacy|copied runtime|unsupported/iu);
  assert.deepEqual(snapshotTree(legacyRoot), legacyBefore);
  assert.equal(fs.existsSync(path.join(legacyRoot, ".dove-install")), false);
  assert.equal(fs.existsSync(path.join(legacyRoot, ".dove")), false);

  const initializedRoot = createTempRoot("dove-cli-legacy-doctor-");
  initializeClaudeProject(initializedRoot);
  writeLegacyCopiedRuntime(initializedRoot);
  const doctorBefore = snapshotTree(initializedRoot);
  const doctor = runCli(["doctor", "--project", initializedRoot, "--json"], {
    cwd: initializedRoot,
    env: { DOVE_TEST_CLAUDE_STATUS: "Connected" }
  });
  assert.equal(doctor.error, undefined);
  assert.equal(doctor.signal, null);
  assert.notEqual(doctor.status, 0, combinedOutput(doctor));
  const payload = JSON.parse(doctor.stdout);
  assert.equal(payload.healthy, false);
  assert.equal(payload.zeroWrite, true);
  assert.deepEqual(payload.writes, []);
  assert.equal(payload.legacyCopiedRuntime.detected, true);
  assert.equal(payload.legacyCopiedRuntime.healthy, false);
  assert.deepEqual(snapshotTree(initializedRoot), doctorBefore);
  assert.equal(fs.existsSync(path.join(initializedRoot, ".dove")), false);
});
