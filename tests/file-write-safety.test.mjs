import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { resolveTempWorkspaceBase } from "../scripts/temp-workspace.mjs";
import { writeFileSetTransaction } from "../src/core/file-set-transaction.mjs";
import { HOST_MIGRATION_PENDING_PATH, HOST_MIGRATION_REGISTERED_PATH, HOST_MIGRATION_TASK, hostMigrationContext, prepareHostMigration, readHostSettings, writeHostSettings } from "../src/core/host-migration.mjs";
import { PROJECT_HOST_IDS } from "../src/core/host-registry.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import { completeReinstallProjectIntegration, initializeProjectIntegration, previewProjectCompleteReinstall, previewProjectUninstall, uninstallProjectIntegration, updateProjectIntegration } from "../src/core/project-installation.mjs";
import { createProjectInstallationManifest, INSTALLATION_MANIFEST_PATH, readProjectInstallationManifest } from "../src/core/project-installation-manifest.mjs";
import { planJsonFragments } from "../src/core/project-installation-plan.mjs";
import { parseJsonWithoutDuplicateKeys } from "../src/core/strict-json.mjs";

const scratch = resolveTempWorkspaceBase();

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
    for (const duplicate of ['{"user":{"keep":1,"keep":2}}', '{"user":{"keep":1,"\\u006beep":2}}']) {
      const file = write(root, relative, duplicate);
      assert.throws(() => planJsonFragments(root, relative, [], []), /duplicate/iu);
      assert.equal(fs.readFileSync(file, "utf8"), duplicate);
    }
  }
  assert.throws(() => parseJsonWithoutDuplicateKeys('{"a":1,"\\u0061":2}'), /duplicate/iu);
});

function snapshot(root) {
  const entries = [];
  function visit(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const file = path.join(directory, name);
      const stat = fs.lstatSync(file);
      entries.push([path.relative(root, file), stat.mode, stat.isFile() ? fs.readFileSync(file).toString("hex") : null]);
      if (stat.isDirectory()) visit(file);
    }
  }
  visit(root);
  return entries;
}

const packageOptions = { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION };

test("duplicate manifest keys, including escaped equivalents, block lifecycle writes and retain the error cause", (t) => {
  const root = fixture(t);
  const manifest = createProjectInstallationManifest({
    hosts: ["claude"], package: { name: PACKAGE_NAME, version: PACKAGE_VERSION }, now: "2026-01-01T00:00:00.000Z",
    managed: [{ path: ".claude/rules/dove.md", kind: "exclusive-file", selector: null, digest: "a".repeat(64) }]
  }, { hostIds: PROJECT_HOST_IDS });
  const valid = JSON.stringify(manifest);
  write(root, INSTALLATION_MANIFEST_PATH, valid);
  assert.deepEqual(readProjectInstallationManifest(root, { hostIds: PROJECT_HOST_IDS }), manifest);
  write(root, ".claude/settings.json", '{"user":"preserve"}\n');
  write(root, ".mcp.json", '{"mcpServers":{"user":{"command":"preserve"}}}\n');
  const operations = [
    () => initializeProjectIntegration(root, { ...packageOptions, hosts: ["claude"] }),
    () => updateProjectIntegration(root, packageOptions),
    () => previewProjectCompleteReinstall(root, packageOptions),
    () => completeReinstallProjectIntegration(root, { ...packageOptions, confirmed: true, preview: { action: "reinstall" } }),
    () => previewProjectUninstall(root),
    () => uninstallProjectIntegration(root, { confirmed: true, preview: { action: "uninstall" } })
  ];
  for (const duplicate of [
    `{"revision":"1.0",${valid.slice(1)}`,
    `{"\\u0068osts":["dsh"],${valid.slice(1)}`,
    valid.replace('"package":{', '"package":{"\\u006eame":"untrusted",'),
    valid.replace('"digest":', `"\\u0064igest":"${"b".repeat(64)}","digest":`)
  ]) {
    write(root, INSTALLATION_MANIFEST_PATH, duplicate);
    const before = snapshot(root);
    assert.throws(() => readProjectInstallationManifest(root, { hostIds: PROJECT_HOST_IDS }), (error) => {
      assert.ok(error.message.startsWith(`Invalid Dove project installation manifest at ${path.join(root, INSTALLATION_MANIFEST_PATH)}:`));
      assert.match(error.cause?.message, /duplicate JSON object keys/iu);
      return true;
    });
    for (const operation of operations) assert.throws(operation, /Invalid Dove project installation manifest.*duplicate/iu);
    assert.deepEqual(snapshot(root), before);
  }
});

test("duplicate host settings reject reads and writes while keeping migration disabled", (t) => {
  const root = fixture(t);
  const options = { env: { XDG_CONFIG_HOME: path.join(root, "config") }, packageVersion: PACKAGE_VERSION };
  const settings = path.join(root, "config/dove/settings.json");
  write(root, HOST_MIGRATION_PENDING_PATH, "existing migration notice\n");
  assert.deepEqual(readHostSettings(options), { hostMigration: false });
  for (const duplicate of [
    '{"hostMigration":false,"hostMigration":true}',
    '{"hostMigration":false,"\\u0068ostMigration":true}',
    '{"hostMigration":true,"figure":{"model":"first","\\u006dodel":"second"}}'
  ]) {
    write(root, "config/dove/settings.json", duplicate);
    const before = snapshot(root);
    assert.throws(() => readHostSettings(options), /Dove host settings.*duplicate/iu);
    assert.throws(() => writeHostSettings({ hostMigration: true }, options), /Dove host settings.*duplicate/iu);
    assert.deepEqual(prepareHostMigration(root, options), []);
    assert.equal(hostMigrationContext(root, options), "");
    assert.deepEqual(snapshot(root), before);
    assert.equal(fs.readFileSync(settings, "utf8"), duplicate);
  }
  write(root, "config/dove/settings.json", '{"hostMigration":true}');
  assert.deepEqual(readHostSettings(options), { hostMigration: true });
  assert.equal(prepareHostMigration(root, options).length, 2);
  assert.match(hostMigrationContext(root, options), /existing migration notice/u);
});

test("duplicate migration registration keys are rejected before lifecycle writes", (t) => {
  const root = fixture(t);
  const options = { ...packageOptions, env: { XDG_CONFIG_HOME: path.join(root, "config") } };
  write(root, ".git", "fixture project marker\n");
  write(root, "config/dove/settings.json", '{"hostMigration":true}');
  const initialized = initializeProjectIntegration(root, { ...options, hosts: ["claude"] });
  assert.equal(initialized.status, "initialized");
  assert.deepEqual(prepareHostMigration(root, options), []);
  const valid = JSON.stringify({ version: PACKAGE_VERSION, task: HOST_MIGRATION_TASK });
  for (const duplicate of [
    `{"version":"0.0.0",${valid.slice(1)}`,
    `{"\\u0074ask":"untrusted",${valid.slice(1)}`
  ]) {
    write(root, HOST_MIGRATION_REGISTERED_PATH, duplicate);
    const before = snapshot(root);
    const expectedError = /migration-registered\.json.*duplicate/iu;
    assert.throws(() => prepareHostMigration(root, options), expectedError);
    assert.throws(() => updateProjectIntegration(root, options), expectedError);
    assert.throws(() => previewProjectCompleteReinstall(root, options), expectedError);
    assert.throws(() => completeReinstallProjectIntegration(root, { ...options, confirmed: true, preview: { action: "reinstall" } }), expectedError);
    assert.deepEqual(snapshot(root), before);
  }
});
