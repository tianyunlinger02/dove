import test from "node:test";
import assert from "node:assert/strict";

import { parseDoveCli } from "../../src/cli/command-parser.mjs";

test("CLI parser supports separated and equals option values", () => {
  const parsed = parseDoveCli(["mission", "/workspace", "--goal=Ship", "--domain", "engineering", "--artifact=a.mjs", "--artifact", "b.mjs"]);
  assert.equal(parsed.command, "mission");
  assert.deepEqual(parsed.positionals, ["/workspace"]);
  assert.deepEqual(parsed.args, ["--goal", "Ship", "--domain", "engineering", "--artifact", "a.mjs", "--artifact", "b.mjs"]);
});

test("CLI parser honors the option separator", () => {
  const parsed = parseDoveCli(["publish-global-status", "--project", "/one", "--", "--literal-project", "/two"]);
  assert.deepEqual(parsed.positionals, ["--literal-project", "/two"]);
  assert.deepEqual(parsed.args, ["--project", "/one"]);
});

test("CLI parser never consumes a following option as a value", () => {
  assert.throws(
    () => parseDoveCli(["mission", "--goal", "--domain", "engineering"]),
    /--goal requires a value/
  );
});

test("CLI parser fails closed for unknown options", () => {
  assert.throws(
    () => parseDoveCli(["status", "--definitely-unknown"]),
    /Unknown or unsupported CLI argument/
  );
});

test("CLI parser fails closed for duplicate singleton aliases", () => {
  assert.throws(
    () => parseDoveCli(["mission", "--domain", "engineering", "--dove-domain=paper"]),
    /may be provided only once/
  );
});

test("CLI parser permits repeatable aliases", () => {
  const parsed = parseDoveCli(["note", "--source-id", "source-a", "--source-id=source-b"]);
  assert.deepEqual(parsed.args, ["--source-id", "source-a", "--source-id", "source-b"]);
});

test("CLI parser fails closed for excess positionals", () => {
  assert.throws(
    () => parseDoveCli(["status", "/one", "/two"]),
    /accepts at most 1 positional/
  );
});

test("source subcommands allow an action and target positional", () => {
  const parsed = parseDoveCli(["source", "verify", "/workspace", "--source-id=paper-1", "--decision", "verified"]);
  assert.deepEqual(parsed.positionals, ["verify", "/workspace"]);
  assert.deepEqual(parsed.args, ["--source-id", "paper-1", "--decision", "verified"]);
});
