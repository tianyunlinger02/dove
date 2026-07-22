import test from "node:test";
import assert from "node:assert/strict";

import { parseDoveCli } from "../../src/cli/command-parser.mjs";

test("CLI parser supports separated and equals mission option values", () => {
  const parsed = parseDoveCli(["mission", "/workspace", "--goal=Ship", "--scope", "core", "--target-artifact=a.mjs", "--target-artifact", "b.mjs"]);
  assert.equal(parsed.command, "mission");
  assert.deepEqual(parsed.positionals, ["/workspace"]);
  assert.deepEqual(parsed.args, ["--goal", "Ship", "--scope", "core", "--target-artifact", "a.mjs", "--target-artifact", "b.mjs"]);
});

test("CLI parser honors the option separator", () => {
  const parsed = parseDoveCli(["source", "--mission-id", "mission-1", "--", "--literal-action", "/workspace"]);
  assert.deepEqual(parsed.positionals, ["--literal-action", "/workspace"]);
  assert.deepEqual(parsed.args, ["--mission-id", "mission-1"]);
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
  for (const command of ["auto", "operator", "review-loop", "launch", "orchestrate", "audit", "return"]) {
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

test("CLI parser supports research-tree reevaluation inputs without a new command", () => {
  const parsed = parseDoveCli(["mission", "/workspace", "--operation", "reevaluate-research-tree", "--mission-id", "mission-1", "--requirement", "Investigate the remaining gap.", "--node-update-json", '{"nodeId":"node-1"}', "--node-update-json", '{"nodeId":"node-2"}']);
  assert.deepEqual(parsed.positionals, ["/workspace"]);
  assert.deepEqual(parsed.args.slice(0, 6), ["--operation", "reevaluate-research-tree", "--mission-id", "mission-1", "--requirement", "Investigate the remaining gap."]);
  assert.equal(parsed.args.filter((item) => item === "--node-update-json").length, 2);
});

test("CLI parser fails closed for duplicate singleton mission options", () => {
  assert.throws(
    () => parseDoveCli(["mission", "--mission-id", "one", "--mission-id=two"]),
    /may be provided only once/
  );
});

test("CLI parser rejects retired mission aliases", () => {
  for (const flag of ["--id", "--packet-id", "--task-id", "--domain", "--stage", "--artifact", "--artifact-path", "--target", "--acceptance-check", "--check", "--next-command", "--yes"]) {
    assert.throws(
      () => parseDoveCli(["mission", flag]),
      /Unknown or unsupported CLI argument/
    );
  }
});

test("CLI parser permits repeatable aliases", () => {
  const parsed = parseDoveCli(["note", "--source-id", "source-a", "--source-id=source-b"]);
  assert.deepEqual(parsed.args, ["--source-id", "source-a", "--source-id", "source-b"]);
});

test("CLI parser supports lessons query and exact record surfaces", () => {
  const query = parseDoveCli(["lessons", "query", "/workspace", "--mission-id", "mission-1", "--kind=method", "--tag", "integrity", "--artifact", "outputs/result.md", "--include-unscoped", "--limit", "10"]);
  assert.deepEqual(query.positionals, ["query", "/workspace"]);
  assert.deepEqual(query.args, ["--mission-id", "mission-1", "--kind", "method", "--tag", "integrity", "--artifact", "outputs/result.md", "--include-unscoped", "--limit", "10"]);

  const record = parseDoveCli(["lessons", "record", "/workspace", "--mission-id", "mission-1", "--lesson-id", "lesson-1", "--scope", "mission", "--kind", "review-insight", "--summary", "Preserve exact review scope.", "--next-time-guidance", "Recheck the frozen artifact hash.", "--proposal-token", "abc_DEF-123", "--confirmed"]);
  assert.deepEqual(record.positionals, ["record", "/workspace"]);
  assert.deepEqual(record.args.slice(-3), ["--proposal-token", "abc_DEF-123", "--confirmed"]);

  assert.throws(() => parseDoveCli(["lessons", "record", "--confirm"]), /Unknown or unsupported CLI argument: --confirm/);
});

test("CLI parser supports the flat execution receipt surface", () => {
  const parsed = parseDoveCli([
    "receipt",
    "/workspace",
    "--receipt-id", "receipt-1",
    "--mission-id=mission-1",
    "--artifact-json", '{"path":"result.md","kind":"report","sha256":"abc"}',
    "--artifact-json", '{"path":"figure.svg","kind":"figure","sha256":"def"}',
    "--criterion-json", '{"criterionId":"criterion-1","evidenceRefs":["artifact:result.md"]}',
    "--mutation-mode", "patch-plan"
  ]);
  assert.equal(parsed.command, "receipt");
  assert.deepEqual(parsed.positionals, ["/workspace"]);
  assert.deepEqual(parsed.args, [
    "--receipt-id", "receipt-1",
    "--mission-id", "mission-1",
    "--artifact-json", '{"path":"result.md","kind":"report","sha256":"abc"}',
    "--artifact-json", '{"path":"figure.svg","kind":"figure","sha256":"def"}',
    "--criterion-json", '{"criterionId":"criterion-1","evidenceRefs":["artifact:result.md"]}',
    "--mutation-mode", "patch-plan"
  ]);
});

test("CLI parser rejects retired execution receipt aliases and caller authority", () => {
  for (const flag of ["--authority", "--role", "--verdict", "--status", "--successful", "--record-dove-mission-pass"]) {
    assert.throws(
      () => parseDoveCli(["receipt", flag, "value"]),
      /Unknown or unsupported CLI argument/
    );
  }
});

test("CLI parser fails closed for excess positionals", () => {
  assert.throws(
    () => parseDoveCli(["status", "/one", "/two"]),
    /accepts at most 1 positional/
  );
});

test("source subcommands allow query, register, and verify with sealed fields", () => {
  const query = parseDoveCli(["source", "query", "/workspace", "--mission-id", "mission-1", "--source-id", "paper-1"]);
  assert.deepEqual(query.positionals, ["query", "/workspace"]);
  const parsed = parseDoveCli(["source", "verify", "/workspace", "--mission-id", "mission-1", "--source-id=paper-1", "--method", "manual-audit", "--checked-material", "captured PDF", "--audit-evidence-json", "{\"decision\":\"rejected\"}"]);
  assert.deepEqual(parsed.positionals, ["verify", "/workspace"]);
  assert.deepEqual(parsed.args, ["--mission-id", "mission-1", "--source-id", "paper-1", "--method", "manual-audit", "--checked-material", "captured PDF", "--audit-evidence-json", "{\"decision\":\"rejected\"}"]);
  assert.throws(() => parseDoveCli(["source", "verify", "/workspace", "--decision", "verified"]), /Unknown or unsupported CLI argument: --decision/);
});
