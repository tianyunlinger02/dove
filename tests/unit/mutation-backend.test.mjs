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

test("direct-process writes stay in the overlay until finish and are durable after commit", () => {
  const root = createTempRoot("dove-mutation-direct-");
  fs.mkdirSync(path.join(root, ".dove/notes"), { recursive: true });
  fs.writeFileSync(path.join(root, ".dove/notes/example.md"), "old\n");
  const result = runWithMutationContext(root, { actionId: "unit-test", mutationMode: "direct-process", hostId: "test" }, () => {
    assert.ok(currentMutationContext(root));
    writeText(root, ".dove/notes/example.md", "hello\n");
    assert.equal(readText(root, ".dove/notes/example.md"), "hello\n");
    assert.equal(fs.readFileSync(path.join(root, ".dove/notes/example.md"), "utf8"), "old\n");
    return { ok: true };
  });
  assert.equal(result.writesApplied, true);
  assert.equal(result.hostRollbackEligible, false);
  assert.equal(result.directProcessWritesAreRollbackSafe, true);
  assert.equal(result.doveRestoreSupported, true);
  assert.equal(result.doveRestoreScope, "caught-commit-failures-only");
  assert.equal(result.crashConsistencyGuaranteed, false);
  assert.equal(fs.readFileSync(path.join(root, ".dove/notes/example.md"), "utf8"), "hello\n");
  assert.equal(exists(root, ".dove/mutations"), false);
  assert.equal(currentMutationContext(root), null);
});

test("callback exceptions and async rejections leave disk unchanged", async () => {
  for (const asynchronous of [false, true]) {
    const root = createTempRoot(`dove-mutation-abort-${asynchronous ? "async" : "sync"}-`);
    fs.writeFileSync(path.join(root, "existing.txt"), "old\n");
    const callback = () => {
      writeText(root, "existing.txt", "new\n");
      writeText(root, "created/nested.txt", "created\n");
      if (asynchronous) return Promise.reject(new Error("callback rejected"));
      throw new Error("callback failed");
    };
    if (asynchronous) await assert.rejects(runWithMutationContext(root, { mutationMode: "direct-process" }, callback), /callback rejected/u);
    else assert.throws(() => runWithMutationContext(root, { mutationMode: "direct-process" }, callback), /callback failed/u);
    assert.equal(fs.readFileSync(path.join(root, "existing.txt"), "utf8"), "old\n");
    assert.equal(exists(root, "created"), false);
  }
});

test("commit rejects first-touch precondition drift without applying the overlay", () => {
  const root = createTempRoot("dove-mutation-drift-");
  fs.writeFileSync(path.join(root, "target.txt"), "old\n");
  assert.throws(() => runWithMutationContext(root, { mutationMode: "direct-process" }, () => {
    writeText(root, "target.txt", "overlay\n");
    fs.writeFileSync(path.join(root, "target.txt"), "drift\n");
  }), /commit precondition changed/u);
  assert.equal(fs.readFileSync(path.join(root, "target.txt"), "utf8"), "drift\n");
});

test("same-path writes coalesce while preserving the original precondition", () => {
  const root = createTempRoot("dove-mutation-coalesce-");
  fs.writeFileSync(path.join(root, "target.txt"), "old\n");
  const result = runWithMutationContext(root, { mutationMode: "direct-process" }, () => {
    writeText(root, "target.txt", "first\n");
    writeText(root, "target.txt", "second\n");
  });
  assert.equal(result.mutationSummary.operationCount, 1);
  assert.equal(fs.readFileSync(path.join(root, "target.txt"), "utf8"), "second\n");
});

test("injected later promotion failure restores existing bytes and removes new directories", () => {
  const root = createTempRoot("dove-mutation-promotion-rollback-");
  fs.mkdirSync(path.join(root, "data"));
  fs.writeFileSync(path.join(root, "data/first.bin"), Buffer.from([0, 1, 2, 255]));
  fs.writeFileSync(path.join(root, "data/second.txt"), "old second\n");
  const beforeBinary = fs.readFileSync(path.join(root, "data/first.bin"));
  let targetPromotions = 0;
  const fsOps = {
    ...fs,
    renameSync(from, to) {
      if (to === path.join(root, "data/first.bin") || to === path.join(root, "data/second.txt") || to === path.join(root, "new/nested.txt")) {
        targetPromotions += 1;
        if (targetPromotions === 2) throw new Error("injected later promotion failure");
      }
      return fs.renameSync(from, to);
    }
  };
  assert.throws(() => runWithMutationContext(root, { mutationMode: "direct-process", fsOps }, () => {
    writeBinary(root, "data/first.bin", Buffer.from([9, 8, 7]));
    writeText(root, "data/second.txt", "new second\n");
    writeText(root, "new/nested.txt", "new file\n");
  }), /all staged changes were rolled back.*injected later promotion failure/u);
  assert.deepEqual(fs.readFileSync(path.join(root, "data/first.bin")), beforeBinary);
  assert.equal(fs.readFileSync(path.join(root, "data/second.txt"), "utf8"), "old second\n");
  assert.equal(exists(root, "new"), false);
  assert.equal(fs.readdirSync(root).some((name) => name.startsWith(".dove-transaction-")), false);
});

test("post-commit transaction and lock cleanup failures preserve committed data and report residue", () => {
  const root = createTempRoot("dove-mutation-cleanup-residue-");
  fs.writeFileSync(path.join(root, "target.txt"), "original\n");
  const lockPath = path.join(root, ".commit.lock");
  const fsOps = {
    ...fs,
    rmSync(targetPath, options) {
      if (path.basename(targetPath).startsWith(".dove-transaction-")) throw new Error("injected transaction cleanup failure");
      return fs.rmSync(targetPath, options);
    },
    unlinkSync(targetPath) {
      if (targetPath === lockPath) throw new Error("injected lock cleanup failure");
      return fs.unlinkSync(targetPath);
    }
  };

  const result = runWithMutationContext(root, { mutationMode: "direct-process", fsOps }, (context) => {
    context.requireCommitLock(".commit.lock", { label: "test commit lock" });
    writeText(root, "target.txt", "committed\n");
  });

  assert.equal(fs.readFileSync(path.join(root, "target.txt"), "utf8"), "committed\n");
  assert.equal(result.writesApplied, true);
  assert.equal(result.mutationSummary.transactionState.phase, "committed");
  assert.equal(result.mutationSummary.transactionState.rollbackAttempted, false);
  assert.equal(result.mutationSummary.transactionState.cleanup.status, "residue");
  assert.equal(result.mutationSummary.transactionState.cleanup.residueCount, 2);
  const transactionName = fs.readdirSync(root).find((name) => name.startsWith(".dove-transaction-"));
  assert.ok(transactionName);
  assert.deepEqual(result.mutationSummary.transactionState.cleanup.residues.map((item) => item.path), [path.join(root, transactionName), "commit-locks"]);
  assert.equal(fs.existsSync(lockPath), true);
});

test("rollback failure reports both the commit and rollback errors", () => {
  const root = createTempRoot("dove-mutation-rollback-failure-");
  fs.writeFileSync(path.join(root, "first.txt"), "old first\n");
  fs.writeFileSync(path.join(root, "second.txt"), "old second\n");
  let targetPromotions = 0;
  const fsOps = {
    ...fs,
    renameSync(from, to) {
      if (to === path.join(root, "first.txt") || to === path.join(root, "second.txt")) {
        targetPromotions += 1;
        if (targetPromotions === 2) throw new Error("promotion exploded");
      }
      if (from.includes(`${path.sep}backups${path.sep}`) && to === path.join(root, "first.txt")) throw new Error("restore exploded");
      return fs.renameSync(from, to);
    }
  };
  assert.throws(() => runWithMutationContext(root, { mutationMode: "direct-process", fsOps }, () => {
    writeText(root, "first.txt", "new first\n");
    writeText(root, "second.txt", "new second\n");
  }), /commit failed and rollback also failed: promotion exploded; rollback: restore exploded/u);
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
