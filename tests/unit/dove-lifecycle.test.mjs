import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { completeReinstallDoveLifecycle, upgradeDoveLifecycle } from "../../src/core/dove-lifecycle.mjs";
import { initializeProjectIntegration } from "../../src/core/project-installation.mjs";
import {
  INSTALLATION_MANIFEST_PATH,
  LEGACY_INSTALLATION_MANIFEST_PATH
} from "../../src/core/project-installation-manifest.mjs";
import { cleanupTempRoot, createTempRoot } from "../helpers/temp-root.mjs";

const PACKAGE = { packageName: "dove", packageVersion: "0.7.0", now: "2026-08-08T12:00:00.000Z" };

function write(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function snapshotTree(root, relativePath) {
  const base = path.join(root, relativePath);
  const result = {};
  const visit = (target) => {
    for (const entry of fs.readdirSync(target, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const full = path.join(target, entry.name);
      const relative = path.relative(base, full);
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(full);
      else result[relative] = entry.isSymbolicLink() ? `link:${fs.readlinkSync(full)}` : fs.readFileSync(full).toString("base64");
    }
  };
  visit(base);
  return result;
}

test("Upgrade migrates legacy installation metadata, preserves Research Format 1 bytes, and moves the root archive", () => {
  const root = createTempRoot("dove-lifecycle-upgrade-");
  try {
    initializeProjectIntegration(root, { hosts: ["claude"], ...PACKAGE });
    const legacyManifest = fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH));
    write(root, LEGACY_INSTALLATION_MANIFEST_PATH, legacyManifest);
    fs.rmSync(path.join(root, INSTALLATION_MANIFEST_PATH));
    write(root, ".dove/format.json", '{"format":"dove-research-v1"}\r\n');
    write(root, ".dove/workspace.json", '{"workspace":"byte-exact"}\n');
    write(root, ".dove/LESSONS.md", "# Lessons\r\n");
    write(root, ".dove/missions/mission.bin", Buffer.from([0, 255, 1, 128]));
    write(root, ".dove-archive/old/result.txt", "archive bytes\r\n");
    const beforeResearch = snapshotTree(root, ".dove");

    const result = upgradeDoveLifecycle(root, PACKAGE);

    assert.equal(result.status, "upgraded");
    assert.equal(fs.existsSync(path.join(root, LEGACY_INSTALLATION_MANIFEST_PATH)), false);
    assert.equal(fs.existsSync(path.join(root, INSTALLATION_MANIFEST_PATH)), true);
    assert.equal(fs.existsSync(path.join(root, ".dove-archive")), false);
    assert.equal(fs.readFileSync(path.join(root, ".dove/archive/old/result.txt"), "utf8"), "archive bytes\r\n");
    const afterResearch = snapshotTree(root, ".dove");
    delete afterResearch[path.join("install", "manifest.json")];
    delete afterResearch[path.join("archive", "old", "result.txt")];
    const expectedResearch = { ...beforeResearch };
    delete expectedResearch[path.join("install", "manifest.json")];
    assert.deepEqual(afterResearch, expectedResearch);
  } finally {
    cleanupTempRoot(root);
  }
});

test("Complete Reinstall removes project Dove state and legacy state, then creates only the current private manifest", () => {
  const root = createTempRoot("dove-lifecycle-reinstall-");
  try {
    initializeProjectIntegration(root, { hosts: ["claude"], ...PACKAGE });
    write(root, ".dove/format.json", '{"format":"dove-research-v1"}\n');
    write(root, ".dove/workspace.json", '{"delete":true}\n');
    write(root, ".dove/missions/mission.json", '{"delete":true}\n');
    write(root, ".dove/archive/current/old.txt", "delete\n");
    write(root, ".dove-archive/legacy/old.txt", "delete\n");
    write(root, LEGACY_INSTALLATION_MANIFEST_PATH, fs.readFileSync(path.join(root, INSTALLATION_MANIFEST_PATH)));
    write(root, "ordinary.txt", "keep\n");

    assert.throws(() => completeReinstallDoveLifecycle(root, PACKAGE), /confirmed: true/u);
    const result = completeReinstallDoveLifecycle(root, { ...PACKAGE, confirmed: true });

    assert.equal(result.status, "reinstalled");
    assert.deepEqual(fs.readdirSync(path.join(root, ".dove")), ["install"]);
    assert.deepEqual(fs.readdirSync(path.join(root, ".dove/install")), ["manifest.json"]);
    assert.equal(fs.existsSync(path.join(root, LEGACY_INSTALLATION_MANIFEST_PATH)), false);
    assert.equal(fs.existsSync(path.join(root, ".dove-archive")), false);
    assert.equal(fs.readFileSync(path.join(root, "ordinary.txt"), "utf8"), "keep\n");
    assert.equal(fs.existsSync(path.join(root, ".claude/commands/dove/status.md")), true);
  } finally {
    cleanupTempRoot(root);
  }
});
