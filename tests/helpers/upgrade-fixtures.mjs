import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function assertRelative(relativePath) {
  assert.equal(path.isAbsolute(relativePath), false, `fixture path must be relative: ${relativePath}`);
  assert.equal(relativePath.split(/[\\/]/u).includes(".."), false, `fixture path must stay inside its root: ${relativePath}`);
}

export function writeFixture(root, relativePath, content, options = {}) {
  assertRelative(relativePath);
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, options);
  return target;
}

export function writeJsonFixture(root, relativePath, value) {
  return writeFixture(root, relativePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function snapshotEntry(target) {
  const stat = fs.lstatSync(target);
  const common = { mode: stat.mode & 0o7777 };
  if (stat.isSymbolicLink()) return { ...common, type: "symlink", target: fs.readlinkSync(target) };
  if (stat.isFile()) return { ...common, type: "file", bytes: fs.readFileSync(target).toString("base64") };
  if (stat.isDirectory()) {
    return {
      ...common,
      type: "directory",
      children: Object.fromEntries(
        fs.readdirSync(target).sort((left, right) => left.localeCompare(right))
          .map((name) => [name, snapshotEntry(path.join(target, name))])
      )
    };
  }
  return { ...common, type: "other" };
}

export function snapshotOptional(target) {
  return fs.existsSync(target) ? snapshotEntry(target) : null;
}

export function snapshotProject(root) {
  return snapshotEntry(root);
}

export function durableStateSnapshot(root) {
  return {
    dove: snapshotOptional(path.join(root, ".dove")),
    archive: snapshotOptional(path.join(root, ".dove-archive"))
  };
}

export function seedDurableState(root) {
  writeFixture(root, ".dove/state/binary.bin", Buffer.from([0, 255, 17, 128, 64]));
  writeFixture(root, ".dove/state/mission.json", "{\"mission\":\"keep-byte-for-byte\"}\n", "utf8");
  writeFixture(root, ".dove-archive/2026-08-08/result.txt", "archived evidence\r\n", "utf8");
  fs.chmodSync(path.join(root, ".dove/state/mission.json"), 0o640);
  return durableStateSnapshot(root);
}

export function seedUnrelatedProjectState(root) {
  writeFixture(root, "paper/notes.txt", "unrelated project bytes\r\n", "utf8");
  writeJsonFixture(root, ".mcp.json", {
    metadata: { keep: true },
    mcpServers: {
      other: { type: "stdio", command: "other-tool", args: ["--keep"] },
      dove: {
        type: "stdio",
        command: "node",
        args: ["./mcp/dove-state-server-package.mjs", "--project", "."]
      }
    }
  });
  writeJsonFixture(root, ".claude/settings.json", {
    theme: "dark",
    env: { KEEP: "yes" },
    hooks: {
      SessionStart: [{ matcher: "keep", hooks: [{ type: "command", command: "keep-session" }] }],
      UserPromptSubmit: [
        { matcher: "keep", hooks: [{ type: "command", command: "keep-prompt" }] },
        { hooks: [{ type: "command", command: "node ./scripts/dove-user-prompt-submit-package.mjs" }] }
      ]
    }
  });
  writeJsonFixture(root, ".claude/settings.local.json", {
    permissions: { allow: ["Read"] },
    enabledMcpjsonServers: ["other", "dove"]
  });
  return {
    paper: snapshotEntry(path.join(root, "paper")),
    mcpOther: { type: "stdio", command: "other-tool", args: ["--keep"] },
    settings: {
      theme: "dark",
      env: { KEEP: "yes" },
      sessionStart: [{ matcher: "keep", hooks: [{ type: "command", command: "keep-session" }] }],
      userPrompt: { matcher: "keep", hooks: [{ type: "command", command: "keep-prompt" }] },
      permissions: { allow: ["Read"] }
    }
  };
}

export function assertUnrelatedProjectState(root, expected) {
  assert.deepEqual(snapshotEntry(path.join(root, "paper")), expected.paper);
  const mcp = JSON.parse(fs.readFileSync(path.join(root, ".mcp.json"), "utf8"));
  assert.deepEqual(mcp.metadata, { keep: true });
  assert.deepEqual(mcp.mcpServers.other, expected.mcpOther);
  const settings = JSON.parse(fs.readFileSync(path.join(root, ".claude/settings.json"), "utf8"));
  assert.equal(settings.theme, expected.settings.theme);
  assert.deepEqual(settings.env, expected.settings.env);
  assert.deepEqual(settings.hooks.SessionStart, expected.settings.sessionStart);
  assert.deepEqual(settings.hooks.UserPromptSubmit.find((entry) => entry.matcher === "keep"), expected.settings.userPrompt);
  const local = JSON.parse(fs.readFileSync(path.join(root, ".claude/settings.local.json"), "utf8"));
  assert.deepEqual(local.permissions, expected.settings.permissions);
  assert.equal(local.enabledMcpjsonServers.includes("other"), true);
}

export function seedLegacyProjectFiles(root) {
  const signedRuntime = [
    "create_ambient_dove_mission",
    "DOVE_MCP_SERVER_NAME",
    "dove-state-server-package.mjs"
  ].join("\n");
  for (const relativePath of [
    ".claude/commands/dove/init.md",
    ".claude/commands/dove/version.md",
    ".claude/commands/dove/workspace.md",
    ".claude/skills/dove-init/SKILL.md",
    ".agents/skills/dove-init/SKILL.md",
    ".codex/skills/dove-init/SKILL.md",
    ".cursor/commands/dove-init.md",
    ".opencode/commands/dove.init.md"
  ]) {
    writeFixture(root, relativePath, `old Dove integration: ${relativePath}\n`, "utf8");
  }
  writeJsonFixture(root, "mcp/dove-claude-project.json", { version: 1, host: "claude" });
  writeFixture(root, "bin/dove-package.mjs", signedRuntime, "utf8");
  writeFixture(root, "dist/index.mjs", "DOVE_WORKSPACE_SCHEMA_VERSION\ncreateDoveMission\nqueryDoveStatus\n", "utf8");
  writeFixture(root, "mcp/dove-state-server-package.mjs", "create_ambient_dove_mission\nquery_dove_status\nDove MCP\n", "utf8");
  writeFixture(root, "scripts/doctor-mcp-probe-package.mjs", "hasCreateAmbientDoveMission\ncheckpointStatus\nambientHookBundle\n", "utf8");
  writeFixture(root, "scripts/dove-user-prompt-submit-package.mjs", "create_ambient_dove_mission\nUserPromptSubmit\nclosureRequest\n", "utf8");
}
