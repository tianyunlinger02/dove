import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createMutationContext, currentMutationContext, runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { readText, writeBinary, writeJson, writeText } from "../../src/core/workspace.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function exists(root, relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

test("patch-plan mutations are zero-write and contain exact operations without a provenance ledger", () => {
  const root = createTempRoot("dove-mutation-patch-");
  const result = runWithMutationContext(root, { actionId: "unit-test", mutationMode: "patch-plan", hostId: "test" }, () => {
    writeJson(root, ".dove/notes/example.json", { ok: true });
    writeText(root, ".dove/drafts/example.md", "hello\n");
    return { ok: true };
  });
  assert.equal(result.writesApplied, false);
  assert.equal(result.hostRollbackEligible, true);
  assert.deepEqual(result.mutationPlan.operations.map((item) => item.relativePath), [".dove/notes/example.json", ".dove/drafts/example.md"]);
  assert.equal(exists(root, ".dove"), false);
  assert.equal(result.mutationPlan.operations.some((item) => item.relativePath.includes("mutations")), false);
});

test("direct-process writes are visible through the active context and durable after finish", () => {
  const root = createTempRoot("dove-mutation-direct-");
  const result = runWithMutationContext(root, { actionId: "unit-test", mutationMode: "direct-process", hostId: "test" }, () => {
    assert.ok(currentMutationContext(root));
    writeText(root, ".dove/notes/example.md", "hello\n");
    assert.equal(readText(root, ".dove/notes/example.md"), "hello\n");
    return { ok: true };
  });
  assert.equal(result.writesApplied, true);
  assert.equal(fs.readFileSync(path.join(root, ".dove/notes/example.md"), "utf8"), "hello\n");
  assert.equal(exists(root, ".dove/mutations"), false);
  assert.equal(currentMutationContext(root), null);
});

test("invalid modes and binary patch plans fail before writes", () => {
  const root = createTempRoot("dove-mutation-invalid-");
  assert.throws(() => createMutationContext(root, { mutationMode: "invalid" }), /mutationMode must be either/);
  assert.throws(() => runWithMutationContext(root, { actionId: "binary", mutationMode: "patch-plan" }, () => writeBinary(root, ".dove/figures/image.png", Buffer.from([1]))), /Binary mutations require direct-process/);
  assert.equal(exists(root, ".dove"), false);
});

test("mutation paths reject traversal and symlink escape", () => {
  const root = createTempRoot("dove-mutation-containment-");
  const outside = createTempRoot("dove-mutation-outside-");
  assert.throws(() => runWithMutationContext(root, { actionId: "escape", mutationMode: "direct-process" }, () => writeText(root, "../escape.txt", "no")), /stay inside the project/);
  fs.mkdirSync(path.join(root, ".dove"), { recursive: true });
  fs.symlinkSync(outside, path.join(root, ".dove/notes"), "dir");
  assert.throws(() => runWithMutationContext(root, { actionId: "escape", mutationMode: "direct-process" }, () => writeText(root, ".dove/notes/escape.md", "no")), /symbolic links|outside/u);
  assert.deepEqual(fs.readdirSync(outside), []);
});
