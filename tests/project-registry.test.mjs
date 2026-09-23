import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { changeRegisteredProjects, readLastProjectSync, readRegisteredProjects, writeLastProjectSync } from "../src/core/project-registry.mjs";

const scratch = fileURLToPath(new URL("../.claude/tmp/", import.meta.url));

function fixture(t) {
  fs.mkdirSync(scratch, { recursive: true });
  const root = fs.mkdtempSync(path.join(scratch, "dove-registry-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = { HOME: root, XDG_CONFIG_HOME: path.join(root, "config") };
  return { root, env };
}

test("registry updates deduplicate paths without losing concurrent changes", (t) => {
  const options = fixture(t);
  const one = path.join(options.root, "one");
  const two = path.join(options.root, "two");
  assert.deepEqual(readRegisteredProjects(options), []);
  assert.deepEqual(changeRegisteredProjects([one], [], options), [one]);
  assert.deepEqual(changeRegisteredProjects([two, one], [], options), [one, two]);
  assert.deepEqual(changeRegisteredProjects([], [one], options), [two]);
  assert.deepEqual(readRegisteredProjects(options), [two]);
});

test("occupied registry lock and malformed registry fail without modifying ownership", (t) => {
  const options = fixture(t);
  const one = path.join(options.root, "one");
  changeRegisteredProjects([one], [], options);
  const registry = path.join(options.env.XDG_CONFIG_HOME, "dove", "projects.json");
  const lock = path.join(path.dirname(registry), ".registry-lock");
  fs.mkdirSync(lock);
  assert.throws(() => changeRegisteredProjects([path.join(options.root, "two")], [], options), /locked/u);
  assert.deepEqual(readRegisteredProjects(options), [one]);
  fs.rmdirSync(lock);
  assert.deepEqual(changeRegisteredProjects([path.join(options.root, "two")], [], options), [one, path.join(options.root, "two")]);
  fs.writeFileSync(registry, "invalid JSON", { mode: 0o600 });
  assert.throws(() => changeRegisteredProjects([], [], options), /JSON|Unexpected token/u);
  assert.equal(fs.readFileSync(registry, "utf8"), "invalid JSON");
});

test("older package sync cannot replace a newer saved report", (t) => {
  const options = fixture(t);
  const newer = { packageVersion: "3.2.5", projects: [], status: "current" };
  assert.equal(writeLastProjectSync(newer, options), true);
  assert.equal(writeLastProjectSync({ packageVersion: "3.2.4", projects: [], status: "partial" }, options), false);
  assert.deepEqual(readLastProjectSync(options), { revision: 1, ...newer });
});

test("symlinked registry and publicly writable config roots are rejected", (t) => {
  const options = fixture(t);
  changeRegisteredProjects([], [], options);
  const directory = path.join(options.env.XDG_CONFIG_HOME, "dove");
  const registry = path.join(directory, "projects.json");
  const original = path.join(options.root, "original.json");
  fs.renameSync(registry, original);
  fs.symlinkSync(original, registry);
  assert.throws(() => readRegisteredProjects(options), /regular file/u);
  assert.throws(() => changeRegisteredProjects([path.join(options.root, "one")], [], options), /regular file/u);
  assert.deepEqual(JSON.parse(fs.readFileSync(original, "utf8")), { revision: 1, projects: [] });
  fs.unlinkSync(registry);
  fs.chmodSync(options.env.XDG_CONFIG_HOME, 0o775);
  assert.deepEqual(changeRegisteredProjects([], [], options), []);
  fs.chmodSync(options.env.XDG_CONFIG_HOME, 0o777);
  assert.throws(() => changeRegisteredProjects([], [], options), /publicly writable/u);
});
