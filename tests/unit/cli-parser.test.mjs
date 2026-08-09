import test from "node:test";
import assert from "node:assert/strict";

import { CLI_COMMAND_SPECS, parseDoveCli } from "../../src/cli/command-parser.mjs";

const SUPPORTED = ["init", "sync", "upgrade", "reinstall", "doctor", "mcp", "hook"];
const REMOVED = ["workspace", "mission", "status", "lessons", "source", "experiment", "draft", "figure", "review", "rebuttal"];

test("CLI parser exposes only project integration, doctor, MCP, and hook commands", () => {
  assert.deepEqual(Object.keys(CLI_COMMAND_SPECS), SUPPORTED);
  for (const command of REMOVED) {
    const parsed = parseDoveCli([command, "--mutation-mode", "direct-process"]);
    assert.equal(parsed.command, command);
    assert.deepEqual(parsed.positionals, ["--mutation-mode", "direct-process"]);
    assert.deepEqual(parsed.args, []);
  }
});

test("CLI parser supports bare, help, and version only as top-level special forms", () => {
  assert.deepEqual(parseDoveCli([]), { command: null, positionals: [], args: [] });
  assert.deepEqual(parseDoveCli(["--help"]), { command: "--help", positionals: [], args: [] });
  assert.deepEqual(parseDoveCli(["--version"]), { command: "--version", positionals: [], args: [] });
  assert.throws(() => parseDoveCli(["--help", "extra"]), /does not accept additional arguments/u);
  assert.equal(parseDoveCli(["help"]).command, "help");
});

test("CLI parser supports sealed install and doctor options", () => {
  assert.deepEqual(
    parseDoveCli(["init", "--project=/workspace", "--host", "claude", "--host=codex", "--json"]),
    { command: "init", positionals: [], args: ["--project", "/workspace", "--host", "claude", "--host", "codex", "--json"] }
  );
  assert.deepEqual(
    parseDoveCli(["sync", "--project", "/workspace", "--format=json"]),
    { command: "sync", positionals: [], args: ["--project", "/workspace", "--format", "json"] }
  );
  for (const command of ["upgrade", "reinstall"]) {
    assert.deepEqual(
      parseDoveCli([command, "--project", "/workspace", "--json"]),
      { command, positionals: [], args: ["--project", "/workspace", "--json"] }
    );
  }
  assert.deepEqual(
    parseDoveCli(["doctor", "--project", "/workspace", "--json"]),
    { command: "doctor", positionals: [], args: ["--project", "/workspace", "--json"] }
  );
  for (const args of [
    ["init", "/workspace"],
    ["sync", "--mutation-mode", "direct-process"],
    ["reinstall", "--confirmed"],
    ["doctor", "--migrate"],
    ["doctor", "--reset"]
  ]) assert.throws(() => parseDoveCli(args), /positional|Unknown or unsupported/u);
});

test("CLI parser seals MCP and prompt-hook forwarding syntax", () => {
  assert.deepEqual(parseDoveCli(["mcp", "serve", "--project", "/workspace"]), { command: "mcp", positionals: ["serve"], args: ["--project", "/workspace"] });
  assert.deepEqual(parseDoveCli(["hook", "user-prompt-submit", "--project=/workspace"]), { command: "hook", positionals: ["user-prompt-submit"], args: ["--project", "/workspace"] });
  assert.throws(() => parseDoveCli(["mcp"]), /requires 1 positional/u);
  assert.throws(() => parseDoveCli(["hook", "user-prompt-submit", "extra"]), /accepts at most 1 positional/u);
  assert.throws(() => parseDoveCli(["mcp", "serve", "--json"]), /Unknown or unsupported/u);
});

test("CLI parser rejects duplicate singleton and missing option values", () => {
  assert.throws(() => parseDoveCli(["doctor", "--project", "/one", "--project=/two"]), /may be provided only once/u);
  assert.throws(() => parseDoveCli(["init", "--project", "--host", "claude"]), /--project requires a value/u);
  assert.throws(() => parseDoveCli(["sync", "--format="]), /--format requires a value/u);
});
