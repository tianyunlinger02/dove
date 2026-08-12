import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { writeFileSetTransaction } from "../../src/core/file-set-transaction.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

test("delete and replace entries roll back when a later promotion fails", () => {
  const root = createTempRoot("dove-file-set-delete-rollback-");
  fs.writeFileSync(path.join(root, "delete.txt"), "keep me\n");
  fs.writeFileSync(path.join(root, "replace.txt"), "old\n");
  let injected = false;
  const fsOps = {
    ...fs,
    renameSync(from, to, metadata) {
      if (!injected && metadata?.anchoredTo === "replace.txt") {
        injected = true;
        throw new Error("injected promotion failure");
      }
      return fs.renameSync(from, to);
    }
  };
  assert.throws(() => writeFileSetTransaction([
    { root, relativePath: "delete.txt", delete: true },
    { root, relativePath: "replace.txt", content: "new\n", force: true }
  ], { fsOps, transactionId: "delete-rollback" }), /all staged changes were rolled back/u);
  assert.equal(fs.readFileSync(path.join(root, "delete.txt"), "utf8"), "keep me\n");
  assert.equal(fs.readFileSync(path.join(root, "replace.txt"), "utf8"), "old\n");
});

test("each target receives one immediate stale check before promotion", () => {
  const root = createTempRoot("dove-file-set-stale-check-");
  fs.writeFileSync(path.join(root, "first.txt"), "first-old\n");
  fs.writeFileSync(path.join(root, "second.txt"), "second-old\n");
  let injected = false;
  const fsOps = {
    ...fs,
    renameSync(from, to, metadata) {
      const result = fs.renameSync(from, to);
      if (!injected && metadata?.anchoredTo === "first.txt") {
        injected = true;
        fs.writeFileSync(path.join(root, "second.txt"), "concurrent\n");
      }
      return result;
    }
  };
  assert.throws(() => writeFileSetTransaction([
    { root, relativePath: "first.txt", content: "first-new\n", force: true },
    { root, relativePath: "second.txt", content: "second-new\n", force: true }
  ], { fsOps, transactionId: "stale-check" }), /rolled back.*precondition changed.*second\.txt/iu);
  assert.equal(fs.readFileSync(path.join(root, "first.txt"), "utf8"), "first-old\n");
  assert.equal(fs.readFileSync(path.join(root, "second.txt"), "utf8"), "concurrent\n");
});

test("empty-directory deletion rejects an unexpected child and rolls back", () => {
  const root = createTempRoot("dove-file-set-directory-race-");
  fs.mkdirSync(path.join(root, "reserved"));
  fs.writeFileSync(path.join(root, "reserved", "owned.txt"), "owned\n");
  const mode = fs.lstatSync(path.join(root, "reserved")).mode & 0o7777;
  let injected = false;
  const fsOps = {
    ...fs,
    renameSync(from, to, metadata) {
      const result = fs.renameSync(from, to);
      if (!injected && metadata?.anchoredFrom === "reserved/owned.txt") {
        injected = true;
        fs.writeFileSync(path.join(root, "reserved", "unowned.txt"), "preserve\n");
      }
      return result;
    }
  };
  assert.throws(() => writeFileSetTransaction([
    { root, relativePath: "reserved/owned.txt", delete: true },
    {
      root,
      relativePath: "reserved",
      delete: true,
      deleteEmptyDirectory: true,
      expectedState: { exists: true, type: "directory", sha256: null, mode }
    }
  ], { fsOps, transactionId: "directory-race" }), /rolled back.*unscheduled child/iu);
  assert.equal(fs.readFileSync(path.join(root, "reserved", "owned.txt"), "utf8"), "owned\n");
  assert.equal(fs.readFileSync(path.join(root, "reserved", "unowned.txt"), "utf8"), "preserve\n");
});

test("post-commit cleanup failures preserve committed bytes and return bounded warnings", () => {
  const root = createTempRoot("dove-file-set-cleanup-warning-");
  fs.writeFileSync(path.join(root, "target.txt"), "old\n");
  const fsOps = {
    ...fs,
    rmdirSync(targetPath, metadata) {
      if (metadata?.recursiveCleanup === true && metadata.displayPath.includes("cleanup-warning")) {
        throw new Error("injected cleanup failure");
      }
      return fs.rmdirSync(targetPath);
    }
  };
  const result = writeFileSetTransaction([
    { root, relativePath: "target.txt", content: "committed\n", force: true }
  ], { fsOps, transactionId: "cleanup-warning" });
  assert.equal(fs.readFileSync(path.join(root, "target.txt"), "utf8"), "committed\n");
  assert.equal(result.cleanupWarnings.length, 1);
  assert.match(result.cleanupWarnings[0].reason, /injected cleanup failure/u);
  assert.equal(result.omittedCleanupWarningCount, 0);
  assert.equal(Object.hasOwn(result, "transactionState"), false);
});

test("retired replay and tree-digest options are rejected", () => {
  const root = createTempRoot("dove-file-set-retired-options-");
  for (const entry of [
    { root, relativePath: "a.txt", assertOnly: true },
    { root, relativePath: "b.txt", expectedTreeDigest: "a".repeat(64) },
    { root, relativePath: "c.txt", moveTo: "d.txt" }
  ]) {
    assert.throws(() => writeFileSetTransaction([entry]), /unsupported fields/u);
  }
});

test("successful cleanup removes only transaction staging residue", () => {
  const root = createTempRoot("dove-file-set-cleanup-");
  fs.mkdirSync(path.join(root, ".dove", "install", "transactions"), { recursive: true });
  const result = writeFileSetTransaction([{ root, relativePath: "target.txt", content: "committed\n" }], { transactionId: "clean" });
  assert.equal(fs.readFileSync(path.join(root, "target.txt"), "utf8"), "committed\n");
  assert.deepEqual(result.cleanupWarnings, []);
  assert.equal(fs.existsSync(path.join(root, ".dove", "install", "transactions")), false);
  assert.equal(fs.existsSync(path.join(root, ".dove", "install")), true);
});
