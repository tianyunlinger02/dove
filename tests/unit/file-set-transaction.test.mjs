import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { inspectDirectoryTreeDigest, writeFileSetTransaction } from "../../src/core/file-set-transaction.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

test("delete entries roll back when a later promotion fails", () => {
  const root = createTempRoot("dove-file-set-delete-rollback-");
  fs.writeFileSync(path.join(root, "delete.txt"), "keep me\n");
  fs.writeFileSync(path.join(root, "replace.txt"), "old\n");
  let promotions = 0;
  const fsOps = {
    ...fs,
    renameSync(from, to, metadata) {
      if (["delete.txt", "replace.txt"].includes(metadata?.anchoredTo)) {
        promotions += 1;
        if (promotions === 1) throw new Error("injected promotion failure");
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

test("directory moves report their archive destination and preserve symlinks in the digest", () => {
  const root = createTempRoot("dove-file-set-directory-move-");
  fs.mkdirSync(path.join(root, ".dove", "nested"), { recursive: true });
  fs.writeFileSync(path.join(root, ".dove", "nested", "state.json"), "{\"keep\":true}\n");
  fs.symlinkSync("nested/state.json", path.join(root, ".dove", "state-link"));
  const digest = inspectDirectoryTreeDigest(root, ".dove");

  const result = writeFileSetTransaction([
    { root, relativePath: ".dove", moveTo: ".dove-archive/upgrade-test", expectedTreeDigest: digest },
    { root, relativePath: "installed.txt", content: "current\n" }
  ], { transactionId: "directory-move" });

  assert.deepEqual(result.movedPaths, [{ from: ".dove", to: ".dove-archive/upgrade-test" }]);
  assert.deepEqual(result.removedPaths, []);
  assert.equal(fs.existsSync(path.join(root, ".dove")), false);
  assert.equal(fs.readlinkSync(path.join(root, ".dove-archive", "upgrade-test", "state-link")), "nested/state.json");
  assert.match(digest, /^[a-f0-9]{64}$/u);
});

test("directory move rolls the archive back before removing created parents", () => {
  const root = createTempRoot("dove-file-set-directory-rollback-");
  fs.mkdirSync(path.join(root, ".dove"));
  fs.writeFileSync(path.join(root, ".dove", "state.json"), "{\"keep\":true}\n");
  const digest = inspectDirectoryTreeDigest(root, ".dove");
  const fsOps = {
    ...fs,
    renameSync(from, to, metadata) {
      if (metadata?.anchoredTo === "installed.txt") throw new Error("injected post-move failure");
      return fs.renameSync(from, to);
    }
  };

  assert.throws(() => writeFileSetTransaction([
    { root, relativePath: ".dove", moveTo: ".dove-archive/upgrade-test", expectedTreeDigest: digest },
    { root, relativePath: "installed.txt", content: "current\n" }
  ], { fsOps, transactionId: "directory-move-rollback" }), /all staged changes were rolled back.*post-move failure/iu);
  assert.equal(fs.readFileSync(path.join(root, ".dove", "state.json"), "utf8"), "{\"keep\":true}\n");
  assert.equal(fs.existsSync(path.join(root, ".dove-archive")), false);
});

test("directory cleanup rejects an unscheduled child created during promotion and rolls back", () => {
  const root = createTempRoot("dove-file-set-directory-race-");
  fs.mkdirSync(path.join(root, "reserved"));
  fs.writeFileSync(path.join(root, "reserved", "owned.txt"), "owned\n");
  const treeDigest = inspectDirectoryTreeDigest(root, "reserved");
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
      expectedTreeDigest: treeDigest
    }
  ], { fsOps, transactionId: "directory-cleanup-race" }), /rolled back.*unscheduled child/iu);
  assert.equal(injected, true);
  assert.equal(fs.readFileSync(path.join(root, "reserved", "owned.txt"), "utf8"), "owned\n");
  assert.equal(fs.readFileSync(path.join(root, "reserved", "unowned.txt"), "utf8"), "preserve\n");
});

test("directory move rejects a symbolic-link destination parent", () => {
  const root = createTempRoot("dove-file-set-directory-parent-symlink-");
  const outside = createTempRoot("dove-file-set-directory-parent-outside-");
  fs.mkdirSync(path.join(root, ".dove"));
  fs.writeFileSync(path.join(root, ".dove", "state.json"), "{}\n");
  fs.symlinkSync(outside, path.join(root, ".dove-archive"));
  const digest = inspectDirectoryTreeDigest(root, ".dove");

  assert.throws(() => writeFileSetTransaction([
    { root, relativePath: ".dove", moveTo: ".dove-archive/upgrade-test", expectedTreeDigest: digest }
  ], { transactionId: "directory-parent-symlink" }), /real directory|symbolic link/iu);
  assert.equal(fs.existsSync(path.join(root, ".dove", "state.json")), true);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test("multi-root post-commit cleanup failure preserves committed targets and reports bounded residue", () => {
  const firstRoot = createTempRoot("dove-file-set-cleanup-first-");
  const secondRoot = createTempRoot("dove-file-set-cleanup-second-");
  fs.writeFileSync(path.join(firstRoot, "target.txt"), "first original\n");
  fs.writeFileSync(path.join(secondRoot, "target.txt"), "second original\n");

  const fsOps = {
    ...fs,
    rmdirSync(targetPath, metadata) {
      if (metadata?.recursiveCleanup === true && metadata.displayPath.startsWith(path.join(secondRoot, ".dove-file-transaction-"))) {
        throw new Error("injected second-root cleanup failure");
      }
      return fs.rmdirSync(targetPath);
    }
  };

  const written = writeFileSetTransaction([
    { root: firstRoot, relativePath: "target.txt", content: "first committed\n", force: true },
    { root: secondRoot, relativePath: "target.txt", content: "second committed\n", force: true }
  ], { fsOps, transactionId: "cleanup-failure" });

  assert.deepEqual(written.writtenPaths, ["target.txt", "target.txt"]);
  assert.equal(fs.readFileSync(path.join(firstRoot, "target.txt"), "utf8"), "first committed\n");
  assert.equal(fs.readFileSync(path.join(secondRoot, "target.txt"), "utf8"), "second committed\n");
  assert.equal(written.transactionState.phase, "committed");
  assert.equal(written.transactionState.rollbackAttempted, false);
  assert.equal(written.transactionState.cleanup.status, "residue");
  assert.equal(written.transactionState.cleanup.residueCount, 1);
  assert.equal(written.transactionState.cleanup.residues.length, 1);
  assert.match(written.transactionState.cleanup.residues[0].reason, /injected second-root cleanup failure/u);
  assert.equal(written.transactionState.cleanup.omittedResidueCount, 0);
  assert.equal(fs.readdirSync(firstRoot).some((name) => name.startsWith(".dove-file-transaction-")), false);
  assert.equal(fs.readdirSync(secondRoot).some((name) => name.startsWith(".dove-file-transaction-")), true);
});
