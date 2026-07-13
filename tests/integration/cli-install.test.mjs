import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { checkGeneratedAdapters, writeGeneratedAdapters } from "../../scripts/generate-command-adapters.mjs";
import { CLAUDE_CODE_GATEWAY_ENV_DEFAULTS, CLAUDE_CODE_GATEWAY_SHELL_BLOCK_END, CLAUDE_CODE_GATEWAY_SHELL_BLOCK_START } from "../../src/core/claude-code-gateway.mjs";
import { PROJECT_HOST_IDS, commandAdapterPathsForHost } from "../../src/core/command-manifest.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

const ROOT = process.cwd();
const CLI = path.join(ROOT, "bin", "dove-package.mjs");
const DOVE_HOST_PATHS = Object.fromEntries(PROJECT_HOST_IDS.map((hostId) => [hostId, commandAdapterPathsForHost(hostId)]));
const SECRET_VALUE_PATTERN = /(?:ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN)\s*[:=]\s*["']?[^"'\s,}]+|sk-[A-Za-z0-9_-]{16,}/iu;

function assertNoSecretValues(output) {
  assert.doesNotMatch(output, SECRET_VALUE_PATTERN);
}

function createClaudeHostTestEnv() {
  const claudeConfigRoot = createTempRoot("dove-claude-config-");
  const shellRoot = createTempRoot("dove-claude-shell-");
  const claudeShellRc = path.join(shellRoot, ".bashrc");
  return {
    claudeConfigRoot,
    claudeShellRc,
    env: {
      ...process.env,
      DOVE_CLAUDE_CONFIG_DIR: claudeConfigRoot,
      DOVE_CLAUDE_SHELL_RC: claudeShellRc
    }
  };
}

function extractClaudeGatewayShellBlock(content) {
  const start = content.indexOf(CLAUDE_CODE_GATEWAY_SHELL_BLOCK_START);
  const end = content.indexOf(CLAUDE_CODE_GATEWAY_SHELL_BLOCK_END);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return content.slice(start, end + CLAUDE_CODE_GATEWAY_SHELL_BLOCK_END.length);
}

function assertClaudeGatewaySettings(settings) {
  assert.equal(settings.fastMode, true);
  for (const [key, value] of Object.entries(CLAUDE_CODE_GATEWAY_ENV_DEFAULTS)) {
    assert.equal(settings.env?.[key], value, `missing Claude gateway env ${key}`);
  }
}

function assertDoveHostPaths(target, hostIds) {
  for (const hostId of hostIds) {
    for (const relativePath of DOVE_HOST_PATHS[hostId]) {
      assert.ok(fs.existsSync(path.join(target, relativePath)), `missing ${relativePath}`);
    }
  }
}

function snapshotInstalledDurableState(target) {
  const doveRoot = path.join(target, ".dove");
  const snapshot = {};
  if (!fs.existsSync(doveRoot)) {
    return snapshot;
  }
  const stack = [doveRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else {
        snapshot[path.relative(target, absolutePath).split(path.sep).join("/")] = fs.readFileSync(absolutePath, "utf8");
      }
    }
  }
  return snapshot;
}

test("public package docs distinguish installed commands from source-checkout development", () => {
  const publicDocPaths = ["README.md", "docs/README.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md"];
  for (const relativePath of publicDocPaths) {
    const text = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    assert.doesNotMatch(text, /\/home\/nvme01\/paper_factory/);
  }
  const installText = fs.readFileSync(path.join(ROOT, "docs", "INSTALL.md"), "utf8");
  assert.match(installText, /npx dove install \. --force/);
  assert.match(installText, /raw `bin\/dove\.mjs` entrypoint exists only in a Dove source checkout/);
  assert.doesNotMatch(installText, /From the repository root:[\s\S]{0,600}node \.\/bin\/dove-package\.mjs install/);
  for (const relativePath of ["README.md", "docs/README.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md"]) {
    const text = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    for (const command of ["npm run commands:generate", "npm run commands:check", "npm run workflow-goals:validate", "npm run build", "npm run check", "npm run release:check"]) {
      if (text.includes(command)) {
        assert.match(text, /source checkout|source-checkout|maintainer-only/i, `${relativePath} must scope ${command} to source development`);
      }
    }
  }
});

test("npm package dry-run includes Dove-only adapters and current public docs", () => {
  const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const [pack] = JSON.parse(result.stdout);
  const packagedPaths = new Set(pack.files.map((file) => file.path));
  for (const hostPaths of Object.values(DOVE_HOST_PATHS)) {
    for (const relativePath of hostPaths) {
      assert.ok(packagedPaths.has(relativePath), `missing packaged adapter ${relativePath}`);
    }
  }
  for (const publicDocPath of [
    "docs/README.md",
    "docs/INSTALL.md",
    "docs/USAGE.md",
    "docs/PACKAGING.md",
    "docs/CAPABILITY_MATRIX.md"
  ]) {
    assert.ok(packagedPaths.has(publicDocPath), `missing public doc ${publicDocPath}`);
  }
  for (const publicCommand of ["init", "mission", "auto", "status", "operator", "lessons", "version", "source", "note", "figure", "experience", "draft", "review", "review-loop", "rebuttal"]) {
    assert.ok(packagedPaths.has(`.opencode/commands/dove.${publicCommand}.md`), `missing public command ${publicCommand}`);
  }
  for (const removedPath of [
    ".opencode/commands/dove.orchestrate.md",
    ".opencode/commands/dove.plan.md",
    ".opencode/commands/dove.checklist.md",
    ".opencode/commands/dove.audit.md",
    ".opencode/commands/dove.autonomy-operate.md",
    ".opencode/commands/dove.return.md",
    ".opencode/commands/dove.follow-through.md",
    ".opencode/commands/dove.governance-audit.md",
    ".opencode/commands/dove.onboard.md",
    ".opencode/commands/dove.launch.md",
    ".opencode/commands/dove.approvals.md",
    ".opencode/commands/dove.kill.md",
    ".opencode/commands/dove.paper.experiment.md",
    ".opencode/commands/dove.paper.version.md",
    ".opencode/commands/dove.paper.figure.md",
    ".claude/commands/dove/paper/draft.md",
    ".codex/skills/dove-paper-approvals/SKILL.md",
    ".agents/skills/dove-paper-orchestrate/SKILL.md",
    "src/core/runtime.mjs"
  ]) {
    assert.equal(packagedPaths.has(removedPath), false, `packaged removed adapter ${removedPath}`);
  }
  assert.ok(packagedPaths.has(".opencode/skills/dove-pipeline/SKILL.md"));
  assert.ok(packagedPaths.has(".agents/skills/dove-lessons/SKILL.md"));
  for (const forbiddenPath of [
    ".codex/config.toml",
    ".codex/skills/parallel/SKILL.md",
    ".agents/skills/start/SKILL.md",
    ".opencode/commands/trellis/start.md",
    ".claude/commands/trellis/start.md",
    ".cursor/commands/trellis-start.md",
    "docs/DOVE_REFACTOR_PLAN_2026-05-04.md",
    "docs/ROLE_HIERARCHY_REFACTOR_PLAN_2026-05-04.md",
    "docs/PAPER_FACTORY_SYSTEM_ORIGINS.zh-CN.md",
    "docs/REFERENCE_ARCHITECTURES.zh-CN.md"
  ]) {
    assert.equal(packagedPaths.has(forbiddenPath), false, `packaged internal artifact ${forbiddenPath}`);
  }
});

test("packed package exposes only standalone public surfaces to an installed consumer", () => {
  const target = createTempRoot("dove-npm-consumer-");
  const packDir = path.join(target, "pack");
  const consumerDir = path.join(target, "consumer");

  try {
    fs.mkdirSync(packDir, { recursive: true });
    fs.mkdirSync(consumerDir, { recursive: true });
    const packed = spawnSync("npm", ["pack", "--json", "--pack-destination", packDir], { cwd: ROOT, encoding: "utf8" });
    assert.equal(packed.status, 0, packed.stderr || packed.stdout);
    const [packResult] = JSON.parse(packed.stdout);
    const tarball = path.join(packDir, packResult.filename);
    const packagedPaths = packResult.files.map((file) => file.path);
    for (const expected of [
      "dist/index.mjs",
      "bin/dove-package.mjs",
      "mcp/dove-state-server-package.mjs",
      "scripts/doctor-mcp-probe-package.mjs"
    ]) {
      assert.ok(packagedPaths.includes(expected), `missing package bundle ${expected}`);
    }
    for (const packagedPath of packagedPaths) {
      assert.doesNotMatch(packagedPath, /^src\//u, `raw source shipped: ${packagedPath}`);
      assert.doesNotMatch(packagedPath, /(?:\.map$|\/[^/]*chunk[^/]*\.[cm]?js$)/iu, `map or chunk shipped: ${packagedPath}`);
    }
    for (const forbidden of [
      "bin/dove.mjs",
      "mcp/dove-state-server.mjs",
      "scripts/doctor-mcp-probe.mjs",
      "scripts/build-package.mjs",
      "scripts/generate-command-adapters.mjs",
      "scripts/generate-command-adapters-cli.mjs"
    ]) {
      assert.equal(packagedPaths.includes(forbidden), false, `raw source shipped: ${forbidden}`);
    }

    fs.writeFileSync(path.join(consumerDir, "package.json"), `${JSON.stringify({ name: "dove-package-consumer-regression", private: true, type: "module" }, null, 2)}\n`);
    const installed = spawnSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], { cwd: consumerDir, encoding: "utf8" });
    assert.equal(installed.status, 0, installed.stderr || installed.stdout);

    const probeSource = `
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const rootApi = await import("dove");
for (const name of [
  "createMutationContext",
  "runWithMutationContext",
  "currentMutationContext",
  "isPatchPlanMode",
  "ensureWorkspace",
  "saveBoard",
  "writeJson",
  "writeText",
  "appendText",
  "saveState",
  "initProject",
  "registerSource",
  "upsertNote",
  "queryProgramApprovals"
]) {
  assert.equal(name in rootApi, false, \`forbidden root export \${name}\`);
}
for (const name of ["queryDoveStatus", "queryPaperAudit", "extractCitationKeysFromText"]) {
  assert.equal(typeof rootApi[name], "function", \`missing public root export \${name}\`);
}
const rootEntryUrl = import.meta.resolve("dove");
for (const moduleName of [
  "workspace.mjs",
  "mutation-backend.mjs",
  "runtime-state.mjs",
  "navigation.mjs",
  "artifacts.mjs",
  "orchestration.mjs",
  "reviews.mjs",
  "runtime-authorization.mjs",
  "program-operating-state.mjs",
  "schema.mjs",
  "task-workflow.mjs"
]) {
  await assert.rejects(import(new URL(\`./\${moduleName}\`, rootEntryUrl)), (error) => error?.code === "ERR_MODULE_NOT_FOUND");
}
for (const relativePath of ["../src/core/workspace.mjs", "../src/mcp/server.mjs"]) {
  await assert.rejects(import(new URL(relativePath, rootEntryUrl)), (error) => error?.code === "ERR_MODULE_NOT_FOUND");
}
`;
    const probe = spawnSync(process.execPath, ["--input-type=module", "-e", probeSource], { cwd: consumerDir, encoding: "utf8" });
    assert.equal(probe.status, 0, probe.stderr || probe.stdout);

    const installedCliPath = path.join(consumerDir, "node_modules", ".bin", "dove");
    const installedCli = spawnSync(installedCliPath, ["--help"], { cwd: consumerDir, encoding: "utf8" });
    assert.equal(installedCli.status, 0, installedCli.stderr || installedCli.stdout);

    const installedProject = path.join(target, "installed-project");
    fs.mkdirSync(installedProject, { recursive: true });
    const installProject = spawnSync(installedCliPath, ["install", installedProject, "--force", "--host", "opencode"], { cwd: consumerDir, encoding: "utf8" });
    assert.equal(installProject.status, 0, installProject.stderr || installProject.stdout);

    const initAdapter = fs.readFileSync(path.join(installedProject, ".opencode", "commands", "dove.init.md"), "utf8");
    assert.match(initAdapter, /node \.\/bin\/dove-package\.mjs init \. --goal "<project goal>" --mutation-mode direct-process/);
    const adapterInit = spawnSync("node", ["./bin/dove-package.mjs", "init", ".", "--goal", "Installed adapter smoke", "--mutation-mode", "direct-process", "--json"], { cwd: installedProject, encoding: "utf8" });
    assert.equal(adapterInit.status, 0, adapterInit.stderr || adapterInit.stdout);
    const initState = JSON.parse(fs.readFileSync(path.join(installedProject, ".dove", "state.json"), "utf8"));
    assert.match(JSON.stringify(initState), /Installed adapter smoke/);

    const packetIndexPath = path.join(installedProject, ".dove", "task-packets", "index.json");
    const beforeMissionProposal = fs.readFileSync(packetIndexPath, "utf8");
    const missionProposal = spawnSync("node", ["./bin/dove-package.mjs", "mission", ".", "--goal", "Verify installed exact mission replay", "--mutation-mode", "direct-process", "--json"], { cwd: installedProject, encoding: "utf8" });
    assert.equal(missionProposal.status, 0, missionProposal.stderr || missionProposal.stdout);
    const missionPayload = JSON.parse(missionProposal.stdout);
    assert.match(missionPayload.exactConfirmationCommand, /bin\/dove-package\.mjs/);
    assert.doesNotMatch(missionPayload.exactConfirmationCommand, /bin\/dove\.mjs/);
    assert.match(missionPayload.exactConfirmationCommand, /--mutation-mode 'direct-process'/);
    assert.equal(fs.readFileSync(packetIndexPath, "utf8"), beforeMissionProposal, "mission proposal must not write task packets");
    const missionReplay = spawnSync("/bin/sh", ["-c", missionPayload.exactConfirmationCommand], { cwd: installedProject, encoding: "utf8" });
    assert.equal(missionReplay.status, 0, missionReplay.stderr || missionReplay.stdout);
    assert.doesNotMatch(`${missionReplay.stderr}\n${missionReplay.stdout}`, /MODULE_NOT_FOUND/);
    assert.notEqual(fs.readFileSync(packetIndexPath, "utf8"), beforeMissionProposal, "confirmed mission must materialize durable state");

    const beforeAutoProposal = fs.readFileSync(packetIndexPath, "utf8");
    const autoSteps = JSON.stringify([
      { command: "dove.source", args: { sourceId: "installed-auto-source", title: "Installed auto source", locator: "https://example.com/installed-auto-source" } },
      { command: "dove.note", args: { summary: "Installed structured auto note", sourceIds: ["installed-auto-source"] } }
    ]);
    const autoProposal = spawnSync("node", ["./bin/dove-package.mjs", "auto", ".", "--target", missionPayload.proposedTask.title, "--steps-json", autoSteps, "--mutation-mode", "direct-process", "--json"], { cwd: installedProject, encoding: "utf8" });
    assert.equal(autoProposal.status, 0, autoProposal.stderr || autoProposal.stdout);
    const autoPayload = JSON.parse(autoProposal.stdout);
    assert.match(autoPayload.exactConfirmationCommand, /bin\/dove-package\.mjs/);
    assert.doesNotMatch(autoPayload.exactConfirmationCommand, /bin\/dove\.mjs/);
    assert.match(autoPayload.exactConfirmationCommand, /--mutation-mode 'direct-process'/);
    assert.equal(fs.readFileSync(packetIndexPath, "utf8"), beforeAutoProposal, "auto proposal must not write task packets");
    const autoReplay = spawnSync("/bin/sh", ["-c", autoPayload.exactConfirmationCommand], { cwd: installedProject, encoding: "utf8" });
    assert.notEqual(autoReplay.status, null, autoReplay.stderr || autoReplay.stdout);
    assert.doesNotMatch(`${autoReplay.stderr}\n${autoReplay.stdout}`, /MODULE_NOT_FOUND|missing-note-material/);
    const replayDurableText = [
      fs.readFileSync(path.join(installedProject, ".dove", "runtime", "results.json"), "utf8"),
      fs.readFileSync(path.join(installedProject, ".dove", "task-packets", "index.json"), "utf8"),
      fs.readFileSync(path.join(installedProject, ".dove", "notes", "index.json"), "utf8")
    ].join("\n");
    assert.match(replayDurableText, /Installed structured auto note|installed-auto-source/);

    const beforeMalformedAuto = snapshotInstalledDurableState(installedProject);
    for (const invalidArgs of [
      ["auto", ".", "--goal", "Malformed steps", "--steps-json", "{", "--mutation-mode", "direct-process", "--json"],
      ["auto", ".", "--goal", "Unknown flag", "--unknown-auto-flag", "value", "--mutation-mode", "direct-process", "--json"],
      ["operator", ".", "--confirmed", "--task-results-json", "{}", "--mutation-mode", "direct-process", "--json"],
      ["operator", ".", "--confirmed", "--unknown-operator-flag", "value", "--mutation-mode", "direct-process", "--json"]
    ]) {
      const rejected = spawnSync("node", ["./bin/dove-package.mjs", ...invalidArgs], { cwd: installedProject, encoding: "utf8" });
      assert.equal(rejected.status, 1, rejected.stderr || rejected.stdout);
      assert.deepEqual(snapshotInstalledDurableState(installedProject), beforeMalformedAuto);
    }
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("generated adapter writers reject symlinked destinations", () => {
  const root = createTempRoot("dove-generated-adapter-symlink-");
  const outside = createTempRoot("dove-generated-adapter-symlink-outside-");
  fs.mkdirSync(path.join(root, ".opencode"), { recursive: true });
  fs.symlinkSync(outside, path.join(root, ".opencode", "commands"), "dir");

  assert.throws(() => writeGeneratedAdapters(root), /must not contain symbolic links/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test("generated adapter check reports stale managed adapter files", () => {
  const target = createTempRoot("dove-generated-adapters-");

  try {
    writeGeneratedAdapters(target);
    assert.deepEqual(checkGeneratedAdapters(target), []);

    const staleRelativePath = ".claude/commands/dove/paper-stale.md";
    const staleAbsolutePath = path.join(target, staleRelativePath);
    fs.mkdirSync(path.dirname(staleAbsolutePath), { recursive: true });
    fs.writeFileSync(staleAbsolutePath, "# stale\n", "utf8");

    const drift = checkGeneratedAdapters(target);
    assert.ok(
      drift.some((item) => item.relativePath === staleRelativePath && item.reason === "stale"),
      JSON.stringify(drift)
    );
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test("release and maturity checks validate doctor through a clean install", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const maturityText = fs.readFileSync(path.join(ROOT, "scripts", "validate-maturity.mjs"), "utf8");
  const doctorValidationText = fs.readFileSync(path.join(ROOT, "scripts", "validate-doctor.mjs"), "utf8");

  assert.equal(packageJson.scripts["doctor:validate"], "node ./scripts/validate-doctor.mjs");
  assert.match(packageJson.scripts["release:check"], /npm run maturity:audit/);
  assert.doesNotMatch(packageJson.scripts["release:check"], /npm run doctor(?!:validate)/);
  assert.match(maturityText, /\["npm", \["run", "doctor:validate"\]\]/);
  assert.doesNotMatch(maturityText, /\["node", \["\.\/bin\/dove\.mjs", "doctor", "\."\]\]/);
  assert.match(doctorValidationText, /createTempWorkspace\("dove-doctor-"\)/);
  assert.match(doctorValidationText, /createTempWorkspace\("dove-claude-config-"\)/);
  assert.match(doctorValidationText, /createTempWorkspace\("dove-claude-shell-"\)/);
  assert.match(doctorValidationText, /DOVE_CLAUDE_SHELL_RC/);
  assert.match(doctorValidationText, /"install", target, "--force", "--host", "claude"/);
  assert.match(doctorValidationText, /"doctor", target/);
});

test("CLI install rejects symlinked managed destinations", () => {
  const target = createTempRoot("dove-install-symlink-");
  const outside = createTempRoot("dove-install-symlink-outside-");
  fs.symlinkSync(outside, path.join(target, ".dove"), "dir");

  const result = spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr || result.stdout, /must not contain symbolic links/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test("CLI install rejects symlinked nested managed destinations", () => {
  const target = createTempRoot("dove-install-nested-symlink-");
  const outside = createTempRoot("dove-install-nested-symlink-outside-");
  fs.mkdirSync(path.join(target, "docs"), { recursive: true });
  fs.symlinkSync(outside, path.join(target, "docs", "README.md"));

  const result = spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stderr || result.stdout, /must not contain symbolic links/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test("CLI install copies the workflow pack into a target workspace", () => {
  const target = createTempRoot("dove-install-");
  const result = spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  for (const publicCommand of ["init", "mission", "auto", "status", "operator", "lessons", "version", "source", "note", "figure", "experience", "draft", "review", "review-loop", "rebuttal"]) {
    assert.ok(fs.existsSync(path.join(target, ".opencode", "commands", `dove.${publicCommand}.md`)), `missing installed public command ${publicCommand}`);
  }
  for (const removedCommand of ["approvals", "launch", "kill", "plan", "audit", "return", "autonomy-operate", "follow-through", "onboard"]) {
    assert.equal(fs.existsSync(path.join(target, ".opencode", "commands", `dove.${removedCommand}.md`)), false);
  }
  assert.equal(fs.existsSync(path.join(target, ".opencode", "commands", "dove.paper.experiment.md")), false);
  assert.equal(fs.existsSync(path.join(target, ".opencode", "commands", "dove.paper.version.md")), false);
  assert.ok(fs.existsSync(path.join(target, ".opencode", "skills", "dove-pipeline", "SKILL.md")));
  assert.equal(fs.existsSync(path.join(target, ".opencode", "agents")), false);
  assert.equal(fs.existsSync(path.join(target, ".opencode", "plugins")), false);
  assert.ok(fs.existsSync(path.join(target, ".dove", "state.json")));
   assert.ok(fs.existsSync(path.join(target, ".dove", "workflow-pack", "boundaries.json")));
   assert.ok(fs.existsSync(path.join(target, ".dove", "task-packets", "index.json")));
  assert.ok(fs.existsSync(path.join(target, ".dove", "manifest.json")));
  assert.equal(fs.existsSync(path.join(target, ".dove")), true);
  assert.ok(fs.existsSync(path.join(target, "dist", "index.mjs")));
  assert.ok(fs.existsSync(path.join(target, "bin", "dove-package.mjs")));
  assert.ok(fs.existsSync(path.join(target, "mcp", "dove-state-server-package.mjs")));
  assert.ok(fs.existsSync(path.join(target, "scripts", "doctor-mcp-probe-package.mjs")));
  assert.equal(fs.existsSync(path.join(target, "bin", "dove.mjs")), false);
  assert.equal(fs.existsSync(path.join(target, "mcp", "dove-state-server.mjs")), false);
  assert.equal(fs.existsSync(path.join(target, "src")), false);
  for (const internalDoc of [
    "DOVE_REFACTOR_PLAN_2026-05-04.md",
    "ROLE_HIERARCHY_REFACTOR_PLAN_2026-05-04.md",
    "PAPER_FACTORY_SYSTEM_ORIGINS.zh-CN.md",
    "REFERENCE_ARCHITECTURES.zh-CN.md"
  ]) {
    assert.equal(fs.existsSync(path.join(target, "docs", internalDoc)), false);
  }
  const config = JSON.parse(fs.readFileSync(path.join(target, ".opencode.json"), "utf8"));
  assert.equal(Object.hasOwn(config, "$schema"), false);
});

test("CLI install can install optional host adapters without local unsafe files", () => {
  const target = createTempRoot("dove-install-hosts-");
  const result = spawnSync("node", [CLI, "install", target, "--force", "--host", "cursor", "--host", "agents"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.hosts, ["cursor", "agents"]);
  assert.equal(fs.existsSync(path.join(target, ".claude", "commands", "dove")), false);
  assert.ok(fs.existsSync(path.join(target, ".cursor", "commands")));
  assert.ok(fs.existsSync(path.join(target, ".agents", "skills")));
  assert.ok(fs.existsSync(path.join(target, "AGENTS.md")));
  assertDoveHostPaths(target, ["cursor", "agents"]);
  assert.equal(fs.existsSync(path.join(target, ".cursor", "commands", "trellis-start.md")), false);
  assert.equal(fs.existsSync(path.join(target, ".agents", "skills", "start", "SKILL.md")), false);
  assert.equal(fs.existsSync(path.join(target, ".claude", "settings.local.json")), false);
  assert.equal(fs.existsSync(path.join(target, ".opencode", "node_modules")), false);
});

test("CLI install rejects symlinked Claude user adapter and gateway files", () => {
  const target = createTempRoot("dove-install-claude-symlink-");
  const { claudeConfigRoot, claudeShellRc, env } = createClaudeHostTestEnv();
  const outside = createTempRoot("dove-install-claude-symlink-outside-");
  fs.mkdirSync(path.join(claudeConfigRoot, "commands"), { recursive: true });
  fs.symlinkSync(outside, path.join(claudeConfigRoot, "commands", "dove"), "dir");

  const adapterResult = spawnSync("node", [CLI, "install", target, "--force", "--host", "claude"], {
    cwd: ROOT,
    encoding: "utf8",
    env
  });
  assert.equal(adapterResult.status, 1, adapterResult.stderr || adapterResult.stdout);
  assert.match(adapterResult.stderr || adapterResult.stdout, /must not contain symbolic links/);

  fs.unlinkSync(path.join(claudeConfigRoot, "commands", "dove"));
  fs.symlinkSync(path.join(outside, "settings.json"), path.join(claudeConfigRoot, "settings.json"));
  const gatewayResult = spawnSync("node", [CLI, "sync", target, "--force", "--host", "claude"], {
    cwd: ROOT,
    encoding: "utf8",
    env
  });
  assert.equal(gatewayResult.status, 1, gatewayResult.stderr || gatewayResult.stdout);
  assert.match(gatewayResult.stderr || gatewayResult.stdout, /must not contain symbolic links/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test("CLI install writes Claude user-level command adapters and gateway defaults without project-local .claude files", () => {
  const target = createTempRoot("dove-install-claude-user-");
  const { claudeConfigRoot, claudeShellRc, env } = createClaudeHostTestEnv();
  fs.writeFileSync(path.join(claudeConfigRoot, "settings.json"), `${JSON.stringify({ theme: "dark", env: { EXISTING_ENV: "kept" } }, null, 2)}\n`, "utf8");
  fs.writeFileSync(claudeShellRc, '# user shell\n[ -z "$PS1" ] && return\nexport AFTER_RETURN=1\n', "utf8");

  const result = spawnSync("node", [CLI, "install", target, "--force", "--host", "claude"], {
    cwd: ROOT,
    encoding: "utf8",
    env
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.hosts, ["claude"]);
  assert.equal(fs.existsSync(path.join(target, ".claude", "commands", "dove")), false);
  assert.ok(fs.existsSync(path.join(claudeConfigRoot, "commands", "dove", "status.md")));
  assert.equal(payload.claudeCodeGateway.ok, true);
  assert.equal(payload.claudeCodeGateway.settings.fastMode, true);
  assert.deepEqual(payload.claudeCodeGateway.settings.ensuredEnvKeys, Object.keys(CLAUDE_CODE_GATEWAY_ENV_DEFAULTS));

  const settings = JSON.parse(fs.readFileSync(path.join(claudeConfigRoot, "settings.json"), "utf8"));
  assert.equal(settings.theme, "dark");
  assert.equal(settings.env.EXISTING_ENV, "kept");
  assertClaudeGatewaySettings(settings);

  const shell = fs.readFileSync(claudeShellRc, "utf8");
  const block = extractClaudeGatewayShellBlock(shell);
  assert.ok(shell.indexOf(CLAUDE_CODE_GATEWAY_SHELL_BLOCK_START) < shell.indexOf('[ -z "$PS1" ] && return'));
  for (const [key, value] of Object.entries(CLAUDE_CODE_GATEWAY_ENV_DEFAULTS)) {
    assert.match(block, new RegExp(`export ${key}=${JSON.stringify(value)}`));
  }
  assertNoSecretValues(block);
  assert.doesNotMatch(block, /password/iu);

  const second = spawnSync("node", [CLI, "sync", target, "--force", "--host", "claude"], {
    cwd: ROOT,
    encoding: "utf8",
    env
  });
  assert.equal(second.status, 0, second.stderr || second.stdout);
  const secondPayload = JSON.parse(second.stdout);
  assert.equal(secondPayload.claudeCodeGateway.settings.written, false);
  assert.equal(secondPayload.claudeCodeGateway.shell.written, false);
  const secondShell = fs.readFileSync(claudeShellRc, "utf8");
  assert.equal(secondShell.split(CLAUDE_CODE_GATEWAY_SHELL_BLOCK_START).length - 1, 1);

  const statusCommand = fs.readFileSync(path.join(claudeConfigRoot, "commands", "dove", "status.md"), "utf8");
  assert.match(statusCommand, /Default output should read like a project assistant/);
  assert.match(statusCommand, /Do not impose a fixed four-line template/);
  assert.match(statusCommand, /smallest useful action/);
  assert.match(statusCommand, /Default status is not a mission board or audit report/);
  assert.match(statusCommand, /collapsed unless the operator asks to expand/);
  assert.doesNotMatch(statusCommand, /query_dove_status|statusHome|boundaryActionCards|\.dove\//);
  assert.doesNotMatch(statusCommand, /dailyHome\.missionList/);
  assert.doesNotMatch(statusCommand, /Mission 主页/);
});

test("CLI install all host adapters skips unsafe local artifacts", () => {
  const target = createTempRoot("dove-install-all-hosts-");
  const { claudeConfigRoot, claudeShellRc, env } = createClaudeHostTestEnv();
  const result = spawnSync("node", [CLI, "install", target, "--force", "--host", "all"], {
    cwd: ROOT,
    encoding: "utf8",
    env
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.hosts, ["opencode", "codex", "cursor", "agents", "claude"]);
  assert.ok(fs.existsSync(path.join(target, ".opencode", "commands", "dove.status.md")));
  assert.equal(fs.existsSync(path.join(target, ".claude", "commands", "dove")), false);
  assert.ok(fs.existsSync(path.join(claudeConfigRoot, "commands", "dove", "status.md")));
  assertClaudeGatewaySettings(JSON.parse(fs.readFileSync(path.join(claudeConfigRoot, "settings.json"), "utf8")));
  assert.match(fs.readFileSync(claudeShellRc, "utf8"), new RegExp(CLAUDE_CODE_GATEWAY_SHELL_BLOCK_START));
  assert.equal(payload.claudeCodeGateway.ok, true);
  assert.equal(fs.existsSync(path.join(target, ".codex", "agents")), false);
  assert.equal(fs.existsSync(path.join(target, ".codex", "config.toml")), false);
  assert.ok(fs.existsSync(path.join(target, ".cursor", "commands")));
  assert.ok(fs.existsSync(path.join(target, ".agents", "skills")));
  assertDoveHostPaths(target, ["opencode", "cursor", "codex", "agents"]);
  assert.equal(fs.existsSync(path.join(target, ".codex", "skills", "parallel", "SKILL.md")), false);
  assert.equal(fs.existsSync(path.join(target, ".opencode", "node_modules")), false);
  assert.equal(fs.existsSync(path.join(target, ".claude", "settings.local.json")), false);
});

test("CLI sync preserves user-owned .dove workspace state", () => {
  const target = createTempRoot("dove-sync-");
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  const draftPath = path.join(target, ".dove", "drafts", "introduction.md");
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
  const target = createTempRoot("dove-doctor-");
  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stdout);
});

test("CLI doctor reports installed host adapters for multi-host workspaces", () => {
  const target = createTempRoot("dove-doctor-hosts-");
  spawnSync("node", [CLI, "install", target, "--force", "--host", "cursor,codex"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.hostAdapters.filter((host) => host !== "claude"), ["codex", "cursor"]);
  assert.ok(payload.checks.some((check) => check.check === "host-adapter:codex" && check.ok));
  assert.ok(payload.checks.some((check) => check.check === "host-adapter:cursor" && check.ok));
  assert.ok(payload.checks.some((check) => check.check === "dove-authority" && check.ok));
  assert.equal(payload.managedArtifacts.doveAuthorityManifest.authoritativeRoot, ".dove");
  assert.equal(payload.managedArtifacts.doveAuthorityManifest.currentWriteAuthority, ".dove");
});

test("CLI doctor reports missing Claude gateway defaults for explicit Claude config targets", () => {
  const target = createTempRoot("dove-doctor-claude-missing-");
  const { env } = createClaudeHostTestEnv();
  const install = spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8",
    env
  });
  assert.equal(install.status, 0, install.stderr || install.stdout);

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8",
    env
  });

  assert.equal(result.status, 1, result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.claudeCodeGateway.ok, false);
  assert.ok(payload.checks.some((check) => check.check === "claude-code-gateway" && !check.ok && /dove sync \. --host claude/.test(check.message)));
  assertNoSecretValues(result.stdout);
});

test("CLI doctor passes for a Claude-only install without requiring OpenCode", () => {
  const target = createTempRoot("dove-doctor-claude-ready-");
  const { env } = createClaudeHostTestEnv();
  const install = spawnSync("node", [CLI, "install", target, "--force", "--host", "claude"], {
    cwd: ROOT,
    encoding: "utf8",
    env
  });
  assert.equal(install.status, 0, install.stderr || install.stdout);

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8",
    env
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.claudeCodeGateway.ok, true);
  assert.deepEqual(payload.hostAdapters, ["claude"]);
  assert.equal(fs.existsSync(path.join(target, ".opencode")), false);
  assert.ok(payload.checks.some((check) => check.check === "host-adapter:claude" && check.ok));
  assert.equal(payload.checks.some((check) => check.check === "host-adapter:opencode"), false);
  assert.ok(payload.checks.some((check) => check.check === "claude-code-gateway" && check.ok));
  assert.deepEqual(payload.claudeCodeGateway.settings.ensuredEnvKeys, Object.keys(CLAUDE_CODE_GATEWAY_ENV_DEFAULTS));
  assertNoSecretValues(result.stdout);
});

test("CLI doctor fails when a required Dove adapter is missing", () => {
  const target = createTempRoot("dove-doctor-missing-host-");
  spawnSync("node", [CLI, "install", target, "--force", "--host", "cursor"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  const missingAdapterPath = ".cursor/commands/dove-draft.md";
  fs.rmSync(path.join(target, missingAdapterPath));

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.ok(payload.missing.includes(missingAdapterPath));
  assert.ok(payload.checks.some((check) => check.check === "host-adapter:cursor" && !check.ok && check.requiredPaths.includes(missingAdapterPath)));
});

test("CLI doctor exposes grouped meta-optimize frontier visibility for healthy workspaces", () => {
  const target = createTempRoot("dove-doctor-meta-optimize-");
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /meta-optimize-frontier/);
  assert.match(result.stdout, /grouped frontier: \d+ clusters \/ \d+ recommendations/);
  assert.match(result.stdout, /family playbooks:/);
  assert.match(result.stdout, /remediation readiness:/);
  assert.match(result.stdout, /playbook readiness:/);
  assert.match(result.stdout, /frontier summary:/);
  assert.match(result.stdout, /taxonomy pressure:/);
  assert.match(result.stdout, /long-horizon summary:/);
  assert.match(result.stdout, /dove-authority/);
  assert.match(result.stdout, /Dove authority: \.dove authoritative, writes=\.dove/);
});

test("retired autonomy CLI commands fail without creating workspace state", () => {
  for (const command of ["autonomy-once", "autonomy-foreground", "autonomy-operate"]) {
    const target = createTempRoot(`dove-retired-${command}-`);
    try {
      const result = spawnSync("node", [CLI, command, target, "--actor-role", "planner"], {
        cwd: ROOT,
        encoding: "utf8"
      });

      assert.notEqual(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stderr || result.stdout, /Usage:/);
      assert.equal(fs.existsSync(path.join(target, ".dove")), false);
      assert.deepEqual(fs.readdirSync(target), []);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

test("CLI doctor fails when key JSON artifacts are malformed", () => {
  const target = createTempRoot("dove-doctor-bad-json-");
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  fs.writeFileSync(path.join(target, ".dove", "state.json"), "{bad json", "utf8");

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /json:.dove\/state.json/);
});

test("CLI doctor reports ignored stale workspace artifacts as warnings", () => {
  const target = createTempRoot("dove-doctor-legacy-root-");
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  const legacyWorkspacePath = path.join(target, ".paper", "workspace");
  fs.mkdirSync(legacyWorkspacePath, { recursive: true });
  fs.writeFileSync(path.join(legacyWorkspacePath, "index.json"), "{}\n", "utf8");

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.healthy, true);
  assert.ok(payload.checks.some((check) => check.check === "dove-authority" && check.ok));
  assert.deepEqual(payload.managedArtifacts.doveAuthorityManifest.staleLegacyArtifacts, [".paper/workspace/index.json"]);
  assert.deepEqual(payload.managedArtifacts.doveAuthorityManifest.ignoredStaleWorkspaceArtifacts, [".paper/workspace/index.json"]);
  assert.ok(payload.warnings.some((warning) => warning.code === "ignored-stale-workspace-artifacts" && warning.paths.includes(".paper/workspace/index.json")));
});

test("CLI doctor reports degraded typed wiki relations explicitly", () => {
  const target = createTempRoot("dove-doctor-wiki-health-");
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  fs.writeFileSync(path.join(target, ".dove", "wiki", "relations.json"), `${JSON.stringify({
    version: 3,
    items: [{
      id: "claim-bad-supported-by-source",
      fromId: "claim-bad",
      toId: "missing-source",
      relationType: "supported-by-source",
      sourceArtifactPaths: [".dove/evidence/index.json", ".dove/sources/index.json"],
      taxonomy: {
        familyId: "evidence-grounding",
        familyLabel: "Evidence grounding",
        groupId: "claim-source-support",
        groupLabel: "Claim-to-source support"
      },
      semantics: {
        relationType: "supported-by-source",
        label: "Tracks that a claim cites a registered source directly.",
        expectedFromEntityType: "claim",
        expectedToEntityType: "source",
        directionalMeaning: {
          forward: "Claim cites source",
          reverse: "Source supports claim"
        }
      },
      integrity: {
        status: "degraded",
        severity: "high",
        reasons: [{ code: "dangling-to-entity", severity: "high", message: "Relation claim-bad-supported-by-source points to a missing target endpoint missing-source." }],
        endpointChecks: [],
        sourceArtifactChecks: []
      },
      updatedAt: new Date(0).toISOString()
    }],
    summary: {
      totalRelations: 1,
      healthyCount: 0,
      degradedCount: 1,
      relationTypeCounts: { "supported-by-source": 1 },
      integrityReasonCounts: { "dangling-to-entity": 1 },
      repairFrontier: [],
      taxonomyRepairFrontier: [],
      taxonomy: {
        familyCount: 1,
        groupCount: 1,
        degradedFamilyCount: 1,
        degradedGroupCount: 1,
        familyCounts: { "evidence-grounding": 1 },
        groupCounts: { "claim-source-support": 1 },
        topDegradedFamilyIds: ["evidence-grounding"],
        topDegradedGroupIds: ["claim-source-support"],
        families: [{
          id: "evidence-grounding",
          label: "Evidence grounding",
          degradedCount: 1,
          totalRelations: 1,
          overview: "Evidence grounding has 1 degraded family relation out of 1; dominant type supported-by-source; top issues dangling-to-entity.",
          topReasonCodes: ["dangling-to-entity"]
        }],
        groups: [{
          id: "claim-source-support",
          label: "Claim-to-source support",
          degradedCount: 1,
          totalRelations: 1,
          overview: "Claim-to-source support has 1 degraded group relation out of 1; dominant type supported-by-source; top issues dangling-to-entity.",
          topReasonCodes: ["dangling-to-entity"]
        }],
        overview: "1 typed wiki relation families across 1 groups; 1 families currently degraded."
      }
    },
    updatedAt: new Date(0).toISOString()
  }, null, 2)}\n`, "utf8");

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /typed-wiki-relations-health/);
  assert.match(result.stdout, /dangling-to-entity|missing target endpoint/);
  assert.match(result.stdout, /degraded families|evidence-grounding/);
});

test("CLI doctor reports explicit non-object managed artifact internals before normalization", () => {
  const target = createTempRoot("dove-doctor-bad-shape-");
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  fs.writeFileSync(path.join(target, ".dove", "meta", "recommendations.json"), `${JSON.stringify({
    version: 1,
    items: [],
    clusters: [],
    ranking: { method: "legacy", tieBreakOrder: "bad-shape" },
    frontier: { recommendationCount: 0 },
    summary: { topClusters: [] }
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(target, ".dove", "workspace", "index.json"), `${JSON.stringify({
    version: 6,
    repairFrontier: { prioritizedItems: [], relationFamilySummaries: [] },
    metaOptimize: {
      proposalOnly: true,
      topClusterIds: [],
      topRecommendationIds: [],
      topClusters: [],
      longHorizon: "bad-shape"
    }
  }, null, 2)}\n`, "utf8");

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /raw-meta-recommendations-shape/);
  assert.match(result.stdout, /ranking\.tieBreakOrder must be an array/);
  assert.match(result.stdout, /raw-workspace-index-shape/);
  assert.match(result.stdout, /metaOptimize\.longHorizon must be an object/);
});

test("CLI doctor reports workspace metaOptimize mirror drift explicitly", () => {
  const target = createTempRoot("dove-doctor-meta-drift-");
  spawnSync("node", [CLI, "install", target, "--force"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  fs.writeFileSync(path.join(target, ".dove", "meta", "recommendations.json"), `${JSON.stringify({
    version: 3,
    proposalOnly: true,
    items: [{ id: "rec-1", priority: "critical" }],
    clusters: [{ id: "cluster-1", rank: 1 }],
    ranking: { method: "durable-signal-frontier-v1", signals: [], tieBreakOrder: ["score-desc"] },
    frontier: {
      recommendationCount: 1,
      criticalCount: 1,
      clusterCount: 1,
      frontierScore: 10,
      topClusterIds: ["cluster-1"],
      topRecommendationIds: ["rec-1"],
      activeSignalTypes: [],
      frontierSummary: "Drifted frontier.",
      rankingMethod: "durable-signal-frontier-v1",
      topClusters: [{ id: "cluster-1" }]
    },
    summary: {
      recommendationCount: 1,
      criticalCount: 1,
      clusterCount: 1,
      frontierScore: 10,
      categories: {},
      signalTypes: [],
      topClusterIds: ["cluster-1"],
      topRecommendationIds: ["rec-1"],
      clusterMembership: { "cluster-1": ["rec-1"] },
      topClusters: [{ id: "cluster-1" }]
    }
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(target, ".dove", "meta", "optimizer-state.json"), `${JSON.stringify({
    version: 4,
    proposalOnly: true,
    sourceArtifacts: [],
    frontier: {
      recommendationCount: 1,
      criticalCount: 1,
      clusterCount: 1,
      frontierScore: 10,
      activeSignalTypes: [],
      topClusterIds: ["cluster-1"],
      topRecommendationIds: ["rec-1"],
      topClusters: [{ id: "cluster-1" }],
      frontierSummary: "Drifted frontier.",
      rankingMethod: "durable-signal-frontier-v1",
      tieBreakOrder: ["score-desc"],
      reportPath: ".dove/meta/LATEST_OPTIMIZER_REPORT.md",
      recommendationsPath: ".dove/meta/recommendations.json",
      longHorizonPath: ".dove/meta/long-horizon-memory.json"
    },
    clusters: [{ id: "cluster-1" }],
    longHorizon: {
      familyCount: 1,
      recurringFamilyCount: 0,
      risingFamilyCount: 0,
      stableFamilyCount: 1,
      coolingFamilyCount: 0,
      topFamilyIds: ["family-1"],
      overview: "Long horizon.",
      memoryPath: ".dove/meta/long-horizon-memory.json"
    }
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(target, ".dove", "meta", "long-horizon-memory.json"), `${JSON.stringify({
    version: 1,
    proposalOnly: true,
    historyWindowSize: 30,
    horizon: {},
    summary: {
      familyCount: 1,
      recurringFamilyCount: 0,
      risingFamilyCount: 0,
      stableFamilyCount: 1,
      coolingFamilyCount: 0,
      topFamilyIds: ["family-1"],
      overview: "Long horizon."
    },
    history: [],
    families: []
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(target, ".dove", "workspace", "index.json"), `${JSON.stringify({
    version: 6,
    repairFrontier: { prioritizedItems: [], relationFamilySummaries: [] },
    metaOptimize: {
      proposalOnly: true,
      recommendationCount: 99,
      clusterCount: 5,
      topClusterIds: ["wrong-cluster"],
      topRecommendationIds: ["wrong-rec"],
      topClusters: [],
      reportPath: ".dove/meta/WRONG.md",
      recommendationsPath: ".dove/meta/recommendations.json",
      statePath: ".dove/meta/WRONG-STATE.json",
      longHorizonPath: ".dove/meta/WRONG-LONG.json",
      longHorizon: {
        topFamilyIds: ["wrong-family"],
        memoryPath: ".dove/meta/WRONG-LONG.json"
      }
    }
  }, null, 2)}\n`, "utf8");

  const result = spawnSync("node", [CLI, "doctor", target], {
    cwd: ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /raw-meta-optimize-mirror-consistency/);
  assert.match(result.stdout, /workspace metaOptimize recommendation count drift/);
  assert.match(result.stdout, /workspace metaOptimize reportPath drift/);
  assert.match(result.stdout, /workspace metaOptimize statePath drift/);
  assert.match(result.stdout, /proposalFrontier/);
  assert.match(result.stdout, /meta-optimize-drift/);
});
