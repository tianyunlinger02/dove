import test from "node:test";
import assert from "node:assert/strict";

import { parseDoveCli } from "../../src/cli/command-parser.mjs";

test("CLI parser supports shared language and project selection on business commands", () => {
  const parsed = parseDoveCli(["experiment", "/workspace", "--project", "/project", "--mission-number", "1", "--experiment-id", "experiment-1", "--language", "en"]);
  assert.deepEqual(parsed.positionals, ["/workspace"]);
  assert.deepEqual(parsed.args.slice(-2), ["--language", "en"]);
  assert.deepEqual(parsed.args.slice(0, 2), ["--project", "/project"]);
});

test("CLI parser supports separated and equals mission option values", () => {
  const parsed = parseDoveCli(["mission", "/workspace", "--goal=Ship", "--scope", "core", "--artifact-json={\"path\":\"a.mjs\",\"required\":true,\"role\":\"output\"}", "--artifact-json", '{"path":"b.mjs","required":false,"role":"supporting"}']);
  assert.equal(parsed.command, "mission");
  assert.deepEqual(parsed.positionals, ["/workspace"]);
  assert.deepEqual(parsed.args, ["--goal", "Ship", "--scope", "core", "--artifact-json", '{"path":"a.mjs","required":true,"role":"output"}', "--artifact-json", '{"path":"b.mjs","required":false,"role":"supporting"}']);
});

test("CLI parser honors the option separator", () => {
  const parsed = parseDoveCli(["source", "--mission-number", "1", "--", "--literal-action", "/workspace"]);
  assert.deepEqual(parsed.positionals, ["--literal-action", "/workspace"]);
  assert.deepEqual(parsed.args, ["--mission-number", "1"]);
});

test("CLI parser never consumes a following option as a value", () => {
  assert.throws(
    () => parseDoveCli(["mission", "--goal", "--scope", "engineering"]),
    /--goal requires a value/
  );
});

test("CLI parser fails closed for unknown options", () => {
  assert.throws(
    () => parseDoveCli(["status", "--definitely-unknown"]),
    /Unknown or unsupported CLI argument/
  );
});

test("deleted CLI commands have no command specification", () => {
  for (const command of ["auto", "operator", "review-loop", "launch", "orchestrate", "audit", "return", "note", "version", "experience", "receipt"]) {
    const parsed = parseDoveCli([command, "."]);
    assert.equal(parsed.command, command);
    assert.deepEqual(parsed.positionals, ["."]);
    assert.deepEqual(parsed.args, []);
  }
});

test("status legacy and mutation options are unsupported", () => {
  for (const flag of ["--request-status-adjustment", "--status-adjustment", "--show-status-adjustments", "--include-status-adjustment-preview", "--result-mode", "--full", "--missions", "--view", "--include-details", "--include-mission-details"]) {
    assert.throws(
      () => parseDoveCli(["status", flag]),
      /Unknown or unsupported CLI argument/
    );
  }
});

test("CLI parser exposes install initialization and sync as project-scoped host operations", () => {
  const init = parseDoveCli(["init", "--project", "/workspace", "--host", "claude", "--host=codex", "--json"]);
  assert.deepEqual(init.positionals, []);
  assert.deepEqual(init.args, ["--project", "/workspace", "--host", "claude", "--host", "codex", "--json"]);
  const sync = parseDoveCli(["sync", "--project=/workspace", "--host", "all", "--format", "json"]);
  assert.deepEqual(sync.positionals, []);
  assert.deepEqual(sync.args, ["--project", "/workspace", "--host", "all", "--format", "json"]);
  const retiredInstall = parseDoveCli(["install"]);
  assert.equal(retiredInstall.command, "install");
  assert.deepEqual(retiredInstall.positionals, []);
  assert.deepEqual(retiredInstall.args, []);
  assert.throws(() => parseDoveCli(["init", "/workspace"]), /accepts at most 0 positional/);
  assert.throws(() => parseDoveCli(["sync", "--platform", "linux"]), /Unknown or unsupported CLI argument/);
  assert.throws(() => parseDoveCli(["init", "--force"]), /Unknown or unsupported CLI argument/);
});

test("CLI parser supports explicit workspace actions and the documented goal alias", () => {
  const parsed = parseDoveCli(["workspace", "revise-mainline", "--project", "/workspace", "--mainline", "Preserve the research record", "--change-reason", "New evidence", "--mutation-mode", "direct-process", "--language", "zh"]);
  assert.deepEqual(parsed.positionals, ["revise-mainline"]);
  assert.deepEqual(parsed.args, ["--project", "/workspace", "--mainline", "Preserve the research record", "--change-reason", "New evidence", "--mutation-mode", "direct-process", "--language", "zh"]);
  assert.deepEqual(parseDoveCli(["workspace", "init", "--goal", "Initial research direction"]), { command: "workspace", positionals: ["init"], args: ["--goal", "Initial research direction"] });
  assert.throws(() => parseDoveCli(["workspace"]), /requires 1 positional/);
  assert.throws(() => parseDoveCli(["workspace", "init", "extra"]), /accepts at most 1 positional/);
  for (const flag of ["--archive-reset", "--migrate-workspace", "--platform"]) {
    assert.throws(() => parseDoveCli(["workspace", "init", flag]), /Unknown or unsupported CLI argument/);
  }
});

test("CLI parser seals mcp and hook subcommand syntax", () => {
  assert.deepEqual(parseDoveCli(["mcp", "serve", "--project", "/workspace"]), { command: "mcp", positionals: ["serve"], args: ["--project", "/workspace"] });
  assert.deepEqual(parseDoveCli(["hook", "user-prompt-submit", "--project=/workspace"]), { command: "hook", positionals: ["user-prompt-submit"], args: ["--project", "/workspace"] });
  assert.throws(() => parseDoveCli(["mcp"]), /requires 1 positional/);
  assert.throws(() => parseDoveCli(["hook", "user-prompt-submit", "extra"]), /accepts at most 1 positional/);
  assert.throws(() => parseDoveCli(["mcp", "serve", "--json"]), /Unknown or unsupported CLI argument/);
});

test("CLI parser supports top-level version as a special command", () => {
  assert.deepEqual(parseDoveCli(["--version"]), { command: "--version", positionals: [], args: [] });
});

test("CLI parser adds project selection without changing existing positional target limits", () => {
  const expectedMax = { mission: 1, status: 1, lessons: 2, source: 2, experiment: 1, draft: 1, figure: 1, review: 1, rebuttal: 1 };
  for (const [command, max] of Object.entries(expectedMax)) {
    const positionals = Array.from({ length: max }, (_, index) => `target-${index + 1}`);
    const parsed = parseDoveCli([command, ...positionals, "--project", "/project"]);
    assert.deepEqual(parsed.positionals, positionals, `${command} positional target limit changed`);
    assert.deepEqual(parsed.args.slice(0, 2), ["--project", "/project"]);
  }
});

test("CLI parser supports direct Mission contract inputs", () => {
  const parsed = parseDoveCli([
    "mission", "/workspace", "--operation", "create-root", "--mode", "research", "--goal", "Implement structured inputs",
    "--requirement", "Preserve the direct requirement.",
    "--assumption", "The current interface remains available.",
    "--scope", "src/", "--out-of-scope", "docs/",
    "--artifact-json", '{"path":"outputs/result.md","required":true,"role":"output"}',
    "--completion-criterion", "The result is recorded.",
    "--evidence-requirement", "artifact:outputs/result.md"
  ]);
  for (const flag of ["--requirement", "--assumption", "--scope", "--out-of-scope", "--artifact-json", "--completion-criterion", "--evidence-requirement"]) assert.ok(parsed.args.includes(flag));
});

test("CLI parser supports ResearchDecision reevaluation without internal selectors", () => {
  const parsed = parseDoveCli(["mission", "/workspace", "--operation", "reevaluate-research-decision", "--mission-number", "1", "--requested-disposition", "continue", "--synthesis", "Current evidence leaves one bounded question.", "--open-question-json", '{"question":"Does the comparison hold?"}', "--next-action-json", '{"kind":"analysis"}']);
  assert.deepEqual(parsed.positionals, ["/workspace"]);
  assert.deepEqual(parsed.args.slice(0, 8), ["--operation", "reevaluate-research-decision", "--mission-number", "1", "--requested-disposition", "continue", "--synthesis", "Current evidence leaves one bounded question."]);
  assert.equal(parsed.args.includes("--open-question-json"), true);
  assert.equal(parsed.args.includes("--next-action-json"), true);
  for (const flag of ["--decision-revision", "--consumed-receipt-id"]) {
    assert.throws(() => parseDoveCli(["mission", flag, "1"]), /Unknown or unsupported CLI argument/);
  }
});

test("CLI parser fails closed for duplicate singleton mission options", () => {
  assert.throws(
    () => parseDoveCli(["mission", "--mission-number", "1", "--mission-number=2"]),
    /may be provided only once/
  );
});

test("CLI parser rejects retired mission aliases", () => {
  for (const flag of ["--mission-id", "--id", "--packet-id", "--task-id", "--domain", "--stage", "--artifact", "--artifact-path", "--target", "--acceptance-check", "--check", "--next-command", "--yes", "--snapshot-summary", "--requirement-json", "--assumption-json", "--decision-json", "--work-item-json", "--alignment-json", "--change-from-json", "--node-update-json"]) {
    assert.throws(
      () => parseDoveCli(["mission", flag]),
      /Unknown or unsupported CLI argument/
    );
  }
});


test("CLI parser exposes only Lessons read and complete-document update fields", () => {
  const read = parseDoveCli(["lessons", "read", "/workspace"]);
  assert.deepEqual(read.positionals, ["read", "/workspace"]);
  assert.deepEqual(read.args, []);

  const update = parseDoveCli(["lessons", "update", "/workspace", "--binding", "opaque-binding", "--markdown", "# Dove Lessons\n"]);
  assert.deepEqual(update.positionals, ["update", "/workspace"]);
  assert.deepEqual(update.args, ["--binding", "opaque-binding", "--markdown", "# Dove Lessons\n"]);

  for (const flag of ["--mission-number", "--lesson-id", "--scope", "--kind", "--tag", "--include-superseded", "--proposal-token", "--confirmed", "--confirm"]) {
    assert.throws(() => parseDoveCli(["lessons", "update", flag]), new RegExp(`Unknown or unsupported CLI argument: ${flag}`, "u"));
  }
});

test("CLI parser fails closed for excess positionals", () => {
  assert.throws(
    () => parseDoveCli(["status", "/one", "/two"]),
    /accepts at most 1 positional/
  );
});

test("source subcommands allow query, register, and verify with sealed fields", () => {
  const query = parseDoveCli(["source", "query", "/workspace", "--mission-number", "1", "--source-id", "paper-1"]);
  assert.deepEqual(query.positionals, ["query", "/workspace"]);
  const parsed = parseDoveCli(["source", "verify", "/workspace", "--mission-number", "1", "--source-id=paper-1", "--method", "manual-audit", "--checked-material", "captured PDF", "--audit-evidence-json", "{\"decision\":\"rejected\"}"]);
  assert.deepEqual(parsed.positionals, ["verify", "/workspace"]);
  assert.deepEqual(parsed.args, ["--mission-number", "1", "--source-id", "paper-1", "--method", "manual-audit", "--checked-material", "captured PDF", "--audit-evidence-json", "{\"decision\":\"rejected\"}"]);
  assert.throws(() => parseDoveCli(["source", "verify", "/workspace", "--decision", "verified"]), /Unknown or unsupported CLI argument: --decision/);
});
