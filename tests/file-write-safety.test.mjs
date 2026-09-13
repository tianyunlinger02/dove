import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { writeFileSetTransaction } from "../src/core/file-set-transaction.mjs";
import { planJsonFragments } from "../src/core/project-installation-plan.mjs";
import { parseJsonWithoutDuplicateKeys } from "../src/core/strict-json.mjs";

const scratch = fileURLToPath(new URL("../.claude/tmp/", import.meta.url));

function fixture(t) {
  fs.mkdirSync(scratch, { recursive: true });
  const root = fs.mkdtempSync(path.join(scratch, "dove-file-write-safety-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root, name, content) {
  const target = path.join(root, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}

test("promotion failure restores original bytes and modes", (t) => {
  const root = fixture(t);
  write(root, "a.txt", "old-a");
  fs.chmodSync(path.join(root, "a.txt"), 0o640);
  const entries = [
    { root, relativePath: "a.txt", content: "new-a", force: true },
    { root, relativePath: "new/b.txt", content: "new-b" }
  ];

  assert.throws(() => writeFileSetTransaction(entries, {
    transactionId: "rollback",
    transactionBase: "transactions",
    fsOps: {
      ...fs,
      renameSync(source, destination) {
        if (destination === path.join(root, "new/b.txt")) throw new Error("injected promotion failure");
        return fs.renameSync(source, destination);
      }
    }
  }), /all staged changes were rolled back.*injected promotion failure/u);

  assert.equal(fs.readFileSync(path.join(root, "a.txt"), "utf8"), "old-a");
  assert.equal(fs.statSync(path.join(root, "a.txt")).mode & 0o777, 0o640);
  assert.equal(fs.existsSync(path.join(root, "transactions")), false);
  assert.equal(fs.existsSync(path.join(root, "new")), false);
});

test("restore failure retains its backup and reports recovery paths", (t) => {
  const root = fixture(t);
  write(root, "a.txt", "irreplaceable original");
  write(root, "b.txt", "original-b");
  const transaction = path.join(root, "transactions/restore-failure");
  const backup = path.join(transaction, "backups/file-0");

  assert.throws(() => writeFileSetTransaction([
    { root, relativePath: "a.txt", content: "new-a", force: true },
    { root, relativePath: "b.txt", content: "new-b", force: true }
  ], {
    transactionBase: "transactions",
    transactionId: "restore-failure",
    fsOps: {
      ...fs,
      renameSync(source, destination) {
        if (source === backup) throw new Error("injected restore failure");
        if (destination === path.join(root, "b.txt") && source.endsWith(".tmp")) {
          throw new Error("injected promotion failure");
        }
        return fs.renameSync(source, destination);
      }
    }
  }), (error) => {
    assert.match(error.message, /rollback also failed.*injected restore failure/u);
    assert.ok(error.message.includes(transaction));
    assert.ok(error.message.includes(path.join(transaction, "backups")));
    return true;
  });

  assert.equal(fs.readFileSync(backup, "utf8"), "irreplaceable original");
  assert.equal(fs.readFileSync(path.join(root, "b.txt"), "utf8"), "original-b");
});

test("occupied rollback target and original backup both survive", (t) => {
  const root = fixture(t);
  write(root, "a.txt", "old-a");
  const transaction = path.join(root, "transactions/occupied");

  assert.throws(() => writeFileSetTransaction([
    { root, relativePath: "a.txt", content: "new-a", force: true }
  ], {
    transactionBase: "transactions",
    transactionId: "occupied",
    fsOps: {
      ...fs,
      renameSync(source, destination) {
        if (source.endsWith(".tmp")) {
          fs.writeFileSync(destination, "concurrent user content");
          throw new Error("injected promotion failure with occupied target");
        }
        return fs.renameSync(source, destination);
      }
    }
  }), /rollback target is occupied/u);

  assert.equal(fs.readFileSync(path.join(root, "a.txt"), "utf8"), "concurrent user content");
  assert.equal(fs.readFileSync(path.join(transaction, "backups/file-0"), "utf8"), "old-a");
});

test("rollback does not overwrite a concurrently changed promoted target", (t) => {
  const root = fixture(t);
  write(root, "a.txt", "original-a");
  write(root, "b.txt", "original-b");
  const transaction = path.join(root, "transactions/changed-promoted");

  assert.throws(() => writeFileSetTransaction([
    { root, relativePath: "a.txt", content: "promoted-a", force: true },
    { root, relativePath: "b.txt", content: "promoted-b", force: true }
  ], {
    transactionBase: "transactions",
    transactionId: "changed-promoted",
    fsOps: {
      ...fs,
      renameSync(source, destination) {
        if (source.endsWith(".tmp") && destination === path.join(root, "b.txt")) {
          fs.writeFileSync(path.join(root, "a.txt"), "concurrent user content");
          throw new Error("injected later promotion failure");
        }
        return fs.renameSync(source, destination);
      }
    }
  }), /rollback target changed/u);

  assert.equal(fs.readFileSync(path.join(root, "a.txt"), "utf8"), "concurrent user content");
  assert.equal(fs.readFileSync(path.join(root, "b.txt"), "utf8"), "original-b");
  assert.equal(fs.readFileSync(path.join(transaction, "backups/file-0"), "utf8"), "original-a");
});

test("ambiguous shared configuration is rejected without changing user bytes", (t) => {
  const root = fixture(t);
  for (const relative of [".claude/settings.json", ".mcp.json"]) {
    const duplicate = '{"user":{"keep":1,"keep":2}}';
    const file = write(root, relative, duplicate);
    assert.throws(() => planJsonFragments(root, relative, [], []), /duplicate/iu);
    assert.equal(fs.readFileSync(file, "utf8"), duplicate);
  }
  assert.throws(() => parseJsonWithoutDuplicateKeys('{"a":1,"\\u0061":2}'), /duplicate/iu);
});
