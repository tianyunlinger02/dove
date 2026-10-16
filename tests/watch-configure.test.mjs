import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import { normalizeWatchConfig, readWatchConfig, writeWatchConfig } from "../src/core/paper-watch.mjs";
import { createProjectInstallationManifest } from "../src/core/project-installation-manifest.mjs";
import { configureWatchFromMentor } from "../src/core/watch-configure.mjs";

const CLI = fileURLToPath(new URL("../bin/dove.mjs", import.meta.url));
const CONFIG = ".dove/research/watch/config.json";
const INITIAL = {
  enabled: false,
  keywords: ["old question"],
  categories: ["cs.AI", "cs.RO"],
  authors: ["Original Author"],
  venues: ["Original Venue"],
  institutions: ["Original Institute"],
  seedPapers: ["2405.12345", "https://doi.org/10.1234/example"],
  source: "draft"
};
// Any retrieval/model process or network access fails the child immediately.
const NO_EXTERNAL_IO = `
  import childProcess from "node:child_process";
  import http from "node:http";
  import https from "node:https";
  import { syncBuiltinESMExports } from "node:module";
  const forbidden = () => { process.stderr.write("Unexpected external I/O\\n"); process.exit(91); };
  for (const name of ["exec", "execSync", "execFile", "execFileSync", "spawn", "spawnSync", "fork"]) childProcess[name] = forbidden;
  for (const owner of [http, https]) for (const name of ["request", "get"]) owner[name] = forbidden;
  globalThis.fetch = forbidden;
  syncBuiltinESMExports();
`;

function fixture(t, config = INITIAL) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "dove-watch-configure-"));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, "project");
  const home = path.join(base, "home");
  fs.mkdirSync(path.join(root, ".dove/install"), { recursive: true });
  fs.mkdirSync(home);
  // A valid isolated resolver fixture, not an installation or a research run.
  const manifest = createProjectInstallationManifest({
    package: { name: PACKAGE_NAME, version: PACKAGE_VERSION }, hosts: ["claude"], managed: []
  }, { hostIds: ["claude", "dsh"] });
  fs.writeFileSync(path.join(root, ".dove/install/manifest.json"), JSON.stringify(manifest));
  if (config !== null) writeWatchConfig(root, config);
  const file = path.join(base, "mentor advice.json");
  const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: path.join(home, ".config") };
  return {
    base, root, file, env, configPath: path.join(root, CONFIG),
    advice(value) { fs.writeFileSync(file, JSON.stringify(value)); },
    cli(argv, cwd = base) {
      const result = spawnSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(NO_EXTERNAL_IO)}`, CLI, ...argv], {
        cwd, env, encoding: "utf8", timeout: 10_000
      });
      assert.equal(result.error, undefined);
      assert.equal(result.signal, null, result.stderr);
      return result;
    }
  };
}

function snapshot(root) {
  const files = {};
  const visit = (directory) => {
    for (const name of fs.readdirSync(directory).sort()) {
      const file = path.join(directory, name);
      const key = path.relative(root, file);
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) files[key] = `symlink:${fs.readlinkSync(file)}`;
      else if (stat.isDirectory()) { files[key] = null; visit(file); }
      else files[key] = fs.readFileSync(file, "utf8");
    }
  };
  visit(root);
  return files;
}

function assertBlocked(result, pattern) {
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.equal(result.stdout, "", "failed commands must not print a save receipt");
  const error = JSON.parse(result.stderr);
  assert.equal(error.status, "blocked");
  assert.match(error.message, pattern);
}

function saveCli(f, extra = []) {
  return f.cli(["watch", "configure", "--project", f.root, "--mentor", f.file, "--json", ...extra]);
}

test("watch configure CLI explicitly replaces present fields, preserves omitted controls and writes only the resolved project", (t) => {
  const f = fixture(t);
  const nested = path.join(f.root, "work", "nested");
  fs.mkdirSync(nested, { recursive: true });
  const other = path.join(f.base, "another-project");
  writeWatchConfig(other, { ...INITIAL, keywords: ["other project"] });
  const registry = path.join(f.env.XDG_CONFIG_HOME, "dove/projects.json");
  fs.mkdirSync(path.dirname(registry), { recursive: true, mode: 0o700 });
  fs.writeFileSync(registry, JSON.stringify({ revision: 1, projects: [other, f.root] }), { mode: 0o600 });
  f.advice({ keywords: ["  specific mechanism  ", "问题边界"], authors: [], seedPapers: ["https://arxiv.org/abs/2610.12345v2"] });
  const before = snapshot(f.base);
  const result = f.cli(["watch", "configure", "--project", nested, "--mentor", path.basename(f.file), "--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const receipt = JSON.parse(result.stdout);
  const expected = { ...INITIAL, keywords: ["specific mechanism", "问题边界"], authors: [], seedPapers: ["2610.12345"], source: "mentor" };
  assert.deepEqual(receipt, { status: "configured", root: f.root, configPath: f.configPath, updatedFields: ["keywords", "authors", "seedPapers"], config: expected });
  assert.deepEqual(JSON.parse(fs.readFileSync(f.configPath, "utf8")), expected);
  assert.deepEqual(readWatchConfig(f.root), expected, "existing consumers see the saved config");
  const after = snapshot(f.base);
  const target = path.relative(f.base, f.configPath);
  delete before[target];
  delete after[target];
  assert.deepEqual(after, before, "no registry, other project, digest, library, session or mentor files change");
  t.diagnostic(JSON.stringify({ before: INITIAL, after: receipt.config, status: receipt.status }));
});

test("watch configure CLI uses defaults only when the config is absent and an empty list explicitly clears a field", (t) => {
  const f = fixture(t, null);
  f.advice({ keywords: [] });
  const result = saveCli(f);
  assert.equal(result.status, 0, result.stderr);
  const expected = normalizeWatchConfig({ keywords: [], source: "mentor" });
  assert.deepEqual(JSON.parse(result.stdout).config, expected);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.configPath, "utf8")), expected);
  assert.deepEqual(fs.readdirSync(path.dirname(f.configPath)), ["config.json"], "configure does not scan or draft research");
});

test("watch configure CLI accepts all five recommendation fields, including clearing every one", (t) => {
  const f = fixture(t, { ...INITIAL, enabled: true, source: "user" });
  const fields = ["keywords", "authors", "venues", "institutions", "seedPapers"];
  const advice = Object.fromEntries(fields.map((field) => [field, []]));
  f.advice(advice);
  const result = saveCli(f);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).config, { ...INITIAL, enabled: true, ...advice, source: "mentor" });
  f.advice({ venues: ["New Venue"], institutions: ["New Institute"] });
  const again = saveCli(f);
  assert.equal(again.status, 0, again.stderr);
  assert.deepEqual(JSON.parse(again.stdout).config, { ...INITIAL, enabled: true, ...advice, venues: ["New Venue"], institutions: ["New Institute"], source: "mentor" });
});

test("watch configure CLI rejects invalid suggestion JSON and control or unknown keys without any write", async (t) => {
  for (const [name, text, pattern] of [
    ["malformed", "{", /JSON/u],
    ["null", "null", /JSON 对象/u],
    ["array", "[]", /JSON 对象/u],
    ["string", '"keywords"', /JSON 对象/u],
    ["empty", "{}", /至少需要一个字段/u],
    ["non-array", '{"keywords":"text"}', /字符串数组/u],
    ["mixed-array", '{"authors":["Alice",1]}', /字符串数组/u],
    ["null-value", '{"seedPapers":null}', /字符串数组/u],
    ["enabled", '{"keywords":["new"],"enabled":true}', /enabled/u],
    ["categories", '{"keywords":[],"categories":["cs.CV"]}', /categories/u],
    ["source", '{"keywords":[],"source":"user"}', /source/u],
    ["unknown", '{"keywords":[],"lookbackDays":7}', /lookbackDays/u],
    ["prototype-key", '{"keywords":[],"__proto__":{"enabled":true}}', /__proto__/u]
  ]) {
    await t.test(name, (t) => {
      const f = fixture(t);
      fs.writeFileSync(f.file, text);
      const before = snapshot(f.base);
      assertBlocked(saveCli(f), pattern);
      assert.deepEqual(snapshot(f.base), before);
    });
  }
});

test("watch configure CLI refuses malformed existing config instead of replacing it with defaults", async (t) => {
  for (const text of ["{broken json", "", "null", "[]", '"not a config"', '{"enabled":"false"}', '{"categories":[]}', '{"authors":["kept"],"customField":"preserve me"}']) {
    await t.test(JSON.stringify(text), (t) => {
      const f = fixture(t);
      fs.writeFileSync(f.configPath, text);
      f.advice({ keywords: ["new question"] });
      const before = snapshot(f.base);
      assertBlocked(saveCli(f), /已有追踪配置/u);
      assert.deepEqual(snapshot(f.base), before);
    });
  }
});

test("watch configure CLI requires one explicit project and a JSON file path without falling back to registered projects", async (t) => {
  const f = fixture(t);
  f.advice({ keywords: ["new question"] });
  const uninstalled = path.join(f.base, "uninstalled");
  fs.mkdirSync(uninstalled);
  for (const [argv, pattern] of [
    [["watch", "configure", "--mentor", f.file, "--json"], /--project/u],
    [["watch", "configure", "--project", f.root, "--json"], /--mentor.*文件路径/u],
    [["watch", "configure", "--project", f.root, "--mentor", '{"keywords":["inline"]}', "--json"], /建议 JSON 文件/u],
    [["watch", "configure", "--project", f.root, "--mentor", f.base, "--json"], /普通 JSON 文件/u],
    [["watch", "configure", "--project", f.root, "--mentor", path.join(f.base, "missing.json"), "--json"], /建议 JSON 文件/u],
    [["watch", "configure", "--project", uninstalled, "--mentor", f.file, "--json"], /not initialized/u]
  ]) {
    await t.test(argv.join(" "), () => {
      const before = snapshot(f.base);
      assertBlocked(f.cli(argv), pattern);
      assert.deepEqual(snapshot(f.base), before);
    });
  }
});

test("watch configure preflight preserves the old config on read errors other than ENOENT", async (t) => {
  for (const code of ["EACCES", "EIO", "EISDIR"]) {
    await t.test(code, (t) => {
      const f = fixture(t);
      f.advice({ keywords: ["new"] });
      const before = snapshot(f.base);
      const fsOps = { ...fs, readFileSync(file, ...args) {
        if (file === f.configPath) throw Object.assign(new Error(`synthetic ${code}`), { code });
        return fs.readFileSync(file, ...args);
      } };
      assert.throws(() => configureWatchFromMentor(f.root, f.file, { fsOps }), /无法读取已有追踪配置.*未覆盖/u);
      assert.deepEqual(snapshot(f.base), before);
    });
  }
});

test("watch configure refuses config directories, escaping parent symlinks and occupied writer staging paths without writing", async (t) => {
  for (const kind of ["directory", "parent-symlink", "config-symlink", "staging-path"]) {
    await t.test(kind, (t) => {
      const f = fixture(t, null);
      f.advice({ keywords: ["new"] });
      if (kind === "directory") fs.mkdirSync(f.configPath, { recursive: true });
      if (kind === "parent-symlink") {
        const outside = path.join(f.base, "outside");
        fs.mkdirSync(outside);
        fs.symlinkSync(outside, path.join(f.root, ".dove/research"));
      }
      if (kind === "config-symlink") {
        fs.mkdirSync(path.dirname(f.configPath), { recursive: true });
        const outside = path.join(f.base, "outside.json");
        fs.writeFileSync(outside, JSON.stringify(INITIAL));
        fs.symlinkSync(outside, f.configPath);
      }
      if (kind === "staging-path") {
        fs.mkdirSync(path.dirname(f.configPath), { recursive: true });
        fs.writeFileSync(`${f.configPath}.${process.pid}.tmp`, "already occupied");
      }
      const before = snapshot(f.base);
      assert.throws(() => configureWatchFromMentor(f.root, f.file), /未覆盖/u);
      assert.deepEqual(snapshot(f.base), before);
    });
  }
});

test("watch configure reuses the atomic writer with a complete merged config before promotion", (t) => {
  const f = fixture(t);
  f.advice({ venues: ["New Venue"] });
  const originalBytes = fs.readFileSync(f.configPath, "utf8");
  const expected = { ...INITIAL, venues: ["New Venue"], source: "mentor" };
  const rename = fs.renameSync;
  let promotions = 0;
  t.mock.method(fs, "renameSync", (from, to) => {
    assert.equal(to, f.configPath);
    assert.equal(path.dirname(from), path.dirname(to));
    assert.equal(fs.readFileSync(f.configPath, "utf8"), originalBytes, "old config remains whole until rename");
    assert.deepEqual(JSON.parse(fs.readFileSync(from, "utf8")), expected, "staged config is already complete");
    promotions += 1;
    return rename(from, to);
  });
  assert.deepEqual(configureWatchFromMentor(f.root, f.file).config, expected);
  assert.equal(promotions, 1);
  assert.deepEqual(fs.readdirSync(path.dirname(f.configPath)), ["config.json"]);
});

test("watch configure does not overwrite the original config when atomic promotion fails", (t) => {
  const f = fixture(t);
  f.advice({ keywords: ["new"] });
  const before = fs.readFileSync(f.configPath, "utf8");
  t.mock.method(fs, "renameSync", () => { throw Object.assign(new Error("synthetic rename failure"), { code: "EIO" }); });
  assert.throws(() => configureWatchFromMentor(f.root, f.file), /synthetic rename failure/u);
  assert.equal(fs.readFileSync(f.configPath, "utf8"), before);
});

test("watch configure reports failed or inconsistent readback instead of claiming a confirmed save", async (t) => {
  for (const failure of ["read-error", "malformed", "incomplete"]) {
    await t.test(failure, (t) => {
      const f = fixture(t);
      f.advice({ keywords: [] });
      let configReads = 0;
      const fsOps = { ...fs, readFileSync(file, ...args) {
        if (file === f.configPath && ++configReads === 2) {
          if (failure === "read-error") throw Object.assign(new Error("synthetic readback failure"), { code: "EIO" });
          return failure === "malformed" ? "{" : JSON.stringify({ source: "mentor" });
        }
        return fs.readFileSync(file, ...args);
      } };
      assert.throws(() => configureWatchFromMentor(f.root, f.file, { fsOps }), /已尝试保存，但回读确认失败/u);
      assert.equal(readWatchConfig(f.root).source, "mentor", "a readback failure is not falsely reported as a rollback");
    });
  }
});

test("watch configure human output names the saved config and does not equate mentor provenance with user confirmation", (t) => {
  const f = fixture(t);
  f.advice({ authors: ["New Author"] });
  const result = f.cli(["watch", "configure", "--project", f.root, "--mentor", f.file]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(f.configPath));
  assert.match(result.stdout, /source: mentor/u);
  assert.match(result.stdout, /不代表用户确认/u);
  assert.deepEqual(readWatchConfig(f.root), { ...INITIAL, authors: ["New Author"], source: "mentor" });
});

test("CLI help documents the mentor JSON file argument and stays read-only", (t) => {
  const f = fixture(t);
  const before = snapshot(f.base);
  const result = f.cli(["--help"], f.root);
  assert.equal(result.status, 0, result.stderr);
  const usage = result.stdout.split("\n").find((line) => line.trimStart().startsWith("dove watch configure --project"));
  assert.ok(usage?.includes("--mentor <json-file>"));
  assert.ok(usage?.includes("JSON 文件路径"));
  assert.deepEqual(snapshot(f.base), before);
});

test("mentor brief CLI exposes originals gathering failure without blocking or reading real sessions", (t) => {
  const f = fixture(t);
  const index = path.join(f.root, ".dove/install/user-originals-index.json");
  fs.mkdirSync(index);
  const result = f.cli(["mentor", "brief", "--project", f.root, "--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const { brief } = JSON.parse(result.stdout);
  assert.ok(brief.includes(index), "the original failure reason is passed through to the brief renderer");
  assert.match(brief, /本人原话汇总整理失败/u);
  assert.match(brief, /调用继续/u);
});
