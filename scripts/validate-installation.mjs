#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DOVE_CLAUDE_STATUS_LINE } from "../src/core/ambient-policy.mjs";
import {
  DOVE_AUTHOR_PREFERENCES_CONTINUITY,
  renderDoveAuthorPreferencesBootstrap,
  renderDoveAuthorPreferencesReference
} from "../src/core/dove-author-preferences.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import { initializeProjectIntegration, inspectProjectIntegration, updateProjectIntegration, previewProjectCompleteReinstall, completeReinstallProjectIntegration, previewProjectUninstall } from "../src/core/project-installation.mjs";
import { INSTALLATION_MANIFEST_PATH, validateProjectInstallationManifest } from "../src/core/project-installation-manifest.mjs";
import { resourcesForHosts, STATUS_LINE_SELECTOR } from "../src/core/project-installation-resources.mjs";
import { prepareResearchDefaults } from "../src/core/research-defaults.mjs";
import { inspectProjectDoctor } from "../src/core/project-doctor.mjs";
import { updateDoveLifecycle } from "../src/core/dove-lifecycle.mjs";
import { DOVE_RESEARCH_REFLECTION_CONTINUITY, renderDoveResearchQualityReference, renderDoveResearchQualityFullReference } from "../src/core/dove-research-contract.mjs";
import { resolveTempWorkspaceBase } from "./temp-workspace.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH_ROOT = resolveTempWorkspaceBase();
const CLI_ENV = {
  ...process.env,
  HOME: path.join(SCRATCH_ROOT, "installation-home"),
  XDG_CONFIG_HOME: path.join(SCRATCH_ROOT, "installation-config"),
  npm_config_prefix: path.join(SCRATCH_ROOT, "installation-prefix")
};
const REFERENCES = [
  [".dove/install/AUTHOR_PREFERENCES.md", renderDoveAuthorPreferencesReference()],
  [".dove/install/AUTHOR_PREFERENCES_FULL.md", fs.readFileSync(path.join(ROOT, "docs/AUTHOR_PREFERENCES.md"), "utf8")],
  [".dove/install/RESEARCH_QUALITY.md", renderDoveResearchQualityReference()],
  [".dove/install/RESEARCH_QUALITY_FULL.md", renderDoveResearchQualityFullReference()]
].map(([relativePath, content]) => ({ path: relativePath, content: `${content.trimEnd()}\n` })).sort((left, right) => left.path.localeCompare(right.path));
const PACKAGE_OPTIONS = { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION };
fs.mkdirSync(SCRATCH_ROOT, { recursive: true });

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function semanticDigest(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function writeJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function makeProject() {
  const root = fs.mkdtempSync(path.join(SCRATCH_ROOT, "dove-installation-"));
  fs.mkdirSync(path.join(root, ".git"));
  initializeProjectIntegration(root, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, now: "2026-08-22T00:00:00.000Z" });
  return root;
}

function writeFile(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function readJson(target) {
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

function cliDove(args, options = {}) {
  return spawnSync(process.execPath, [path.join(ROOT, "bin", "dove.mjs"), ...args], {
    cwd: ROOT,
    encoding: "utf8",
    ...options,
    env: { ...CLI_ENV, ...options.env }
  });
}

function cliHook(root, name, payload) {
  return cliDove(["hook", name, "--project", root], { input: JSON.stringify(payload) });
}

function treeSnapshot(root) {
  const entries = [];
  const visit = (relativePath) => {
    const target = path.join(root, relativePath);
    const stat = fs.lstatSync(target, { bigint: true });
    entries.push({
      path: relativePath,
      mtime: stat.mtimeNs,
      bytes: stat.isFile() ? fs.readFileSync(target) : null,
      link: stat.isSymbolicLink() ? fs.readlinkSync(target) : null
    });
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(target).sort()) visit(path.join(relativePath, child));
    }
  };
  visit(".");
  return entries;
}

function assertDoctorReadOnly(root, cliPath = path.join(ROOT, "bin", "dove.mjs")) {
  const before = treeSnapshot(root);
  const invoke = (args) => spawnSync(process.execPath, [cliPath, "doctor", "--project", root, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...CLI_ENV, NO_COLOR: "1" }
  });
  const json = invoke(["--json"]);
  const human = invoke([]);
  assert.equal(json.stderr, "");
  assert.equal(human.stderr, "");
  const result = JSON.parse(json.stdout);
  assert.equal(json.status, result.staticChecksPassed ? 0 : 1);
  assert.equal(human.status, json.status);
  assert.deepEqual(treeSnapshot(root), before, "human and JSON Doctor must preserve all fixture bytes, paths, and mtimes");
  assert.match(human.stdout, /软件\s+Dove/u);
  assert.equal(human.stdout.includes(`Dove ${result.userCli.package.version}`), true);
  const recordedVersion = result.projectIntegration.manifest?.package.version;
  assert.equal(human.stdout.includes(`项目接入  manifest 版本 ${recordedVersion ?? "未知"}；`), true);
  assert.match(human.stdout, /静态检查/u);
  assert.match(human.stdout, /不验证当前会话加载/u);
  assert.match(human.stdout, /不等于研究内容正确/u);
  assert.doesNotMatch(json.stdout, /"(?:digest|sha256)"|[a-f0-9]{64}/u);
  const matchedPaths = result.projectIntegration.retiredHooks?.matchedPaths ?? [];
  for (const target of matchedPaths) assert.equal(human.stdout.includes(target), true);
  if (matchedPaths.length > 0) {
    assert.match(human.stdout, /残留（只读）.*仅精确旧项，不代表自定义或全局配置已清理/u);
  } else {
    assert.doesNotMatch(human.stdout, /退役 Hook|未匹配旧项|已清理/u);
  }
  assert.doesNotMatch(json.stdout, /"unrecognizedPaths"/u);
  return { ...result, human: human.stdout };
}

function validateDoctorVersions(root, cliPath, resourcePath = ".claude/agents/dove.md") {
  const manifestPath = path.join(root, INSTALLATION_MANIFEST_PATH);
  const manifest = readJson(manifestPath);
  const current = assertDoctorReadOnly(root, cliPath);
  assert.equal(current.projectIntegration.state, "current");
  assert.deepEqual(current.projectIntegration.retiredHooks, { matchedPaths: [] });

  const missingVersion = structuredClone(manifest);
  delete missingVersion.package.version;
  writeJson(manifestPath, missingVersion);
  const missing = assertDoctorReadOnly(root, cliPath);
  assert.equal(missing.staticChecksPassed, false);
  assert.equal(missing.projectIntegration.manifest, null);
  assert.match(missing.human, /项目接入\s+manifest 版本 未知/u);

  const original = fs.readFileSync(path.join(root, resourcePath));
  const oldContent = "Synthetic older managed agent resource at the same package version.\n";
  const oldManifest = structuredClone(manifest);
  oldManifest.managed.find((entry) => entry.path === resourcePath).digest = crypto.createHash("sha256").update(oldContent).digest("hex");
  writeJson(manifestPath, oldManifest);
  writeFile(root, resourcePath, oldContent);
  const sameVersion = assertDoctorReadOnly(root, cliPath);
  assert.equal(sameVersion.projectIntegration.manifest.package.version, sameVersion.userCli.package.version);
  assert.equal(sameVersion.projectIntegration.state, "needs-update", "same package version must not suppress managed resource differences");
  assert.equal(sameVersion.projectIntegration.updatePaths.includes(resourcePath), true);
  assert.deepEqual(sameVersion.projectIntegration.skippedLocalEdits, []);
  assert.match(sameVersion.human, /需要更新.*待更新路径/u);

  writeFile(root, resourcePath, `${oldContent}User modification.\n`);
  const locallyEdited = assertDoctorReadOnly(root, cliPath);
  assert.equal(locallyEdited.projectIntegration.state, "needs-update");
  assert.deepEqual(locallyEdited.projectIntegration.skippedLocalEdits, [{ path: resourcePath, selector: null }]);
  assert.deepEqual(locallyEdited.projectIntegration.replacedLocalEdits, []);
  assert.equal(locallyEdited.projectIntegration.updatePaths.includes(resourcePath), false);
  assert.match(locallyEdited.human, /本地编辑.*显式 dove update/u);

  writeFile(root, resourcePath, original);
  const staleManifest = assertDoctorReadOnly(root, cliPath);
  assert.equal(staleManifest.projectIntegration.state, "needs-update", "canonical disk bytes do not make stale managed manifest entries current");
  assert.deepEqual(staleManifest.projectIntegration.updatePaths, [INSTALLATION_MANIFEST_PATH]);
  assert.deepEqual(staleManifest.projectIntegration.skippedLocalEdits, []);
  writeJson(manifestPath, manifest);
}

// Preload the real CLI process so even swallowed read errors fail validation.
// No contents of research Markdown, reports, logs, or historical materials are
// needed to select metadata and check the latest round's listed material.
function hookReadGuard(root, source) {
  return `
    import fs from "node:fs";
    import path from "node:path";
    import { fileURLToPath } from "node:url";
    import { syncBuiltinESMExports } from "node:module";
    const root = ${JSON.stringify(root)};
    const facts = ${JSON.stringify(source === "compact" || source === "resume")};
    const historicalDescriptors = new Map();
    function guard(target, operation) {
      if (typeof target === "number") {
        if (historicalDescriptors.has(target) && operation !== "readSync") {
          process.stderr.write("Forbidden full historical journal read\\n");
          throw new Error("Forbidden full historical journal read");
        }
        return;
      }
      const file = target instanceof URL ? fileURLToPath(target) : String(target);
      const relative = path.relative(root, path.resolve(file)).split(path.sep).join("/");
      const historicalJournal = relative === ".dove/runs/z-older/run.jsonl";
      const forbidden = (historicalJournal && operation !== "openSync")
        || relative.startsWith(".dove/research/")
        || relative === "historical-material.txt" || relative === "unlisted-report.md"
        || relative === "synthetic-transcript.jsonl"
        || (relative.startsWith(".dove/reviews/") && !(facts && (
          /^\\.dove\\/reviews\\/[^/]+\\/review\\.json$/u.test(relative)
          || relative === ".dove/reviews/a-latest/rounds/2/snapshot.json")))
        || (relative.startsWith(".dove/runs/") && !(facts && /^\\.dove\\/runs\\/[^/]+\\/run\\.jsonl$/u.test(relative)));
      if (forbidden) {
        process.stderr.write("Forbidden hook read: " + relative + "\\n");
        throw new Error("Forbidden hook read");
      }
    }
    for (const name of ["readFileSync", "readFile", "openSync", "open", "createReadStream"]) {
      const original = fs[name];
      fs[name] = function(target, ...args) {
        guard(target, name);
        const result = original.call(this, target, ...args);
        if (name === "openSync" && String(target) === path.join(root, ".dove/runs/z-older/run.jsonl")) historicalDescriptors.set(result, false);
        return result;
      };
    }
    for (const name of ["readFile", "open"]) {
      const original = fs.promises[name];
      fs.promises[name] = function(target, ...args) { guard(target, name); return original.call(this, target, ...args); };
    }
    const readSync = fs.readSync;
    fs.readSync = function(fd, buffer, offset, length, position) {
      if (historicalDescriptors.has(fd) && (historicalDescriptors.get(fd) || length > 1024)) {
        process.stderr.write("Forbidden historical journal tail scan\\n");
        throw new Error("Forbidden historical journal tail scan");
      }
      const count = readSync.call(this, fd, buffer, offset, length, position);
      if (historicalDescriptors.has(fd) && buffer.subarray(offset, offset + count).includes(10)) historicalDescriptors.set(fd, true);
      return count;
    };
    const closeSync = fs.closeSync;
    fs.closeSync = function(fd) { historicalDescriptors.delete(fd); return closeSync.call(this, fd); };
    const kill = process.kill;
    process.kill = function(pid, signal) {
      if (pid === 214214) {
        process.stderr.write("Forbidden historical PID observation\\n");
        throw new Error("Forbidden historical PID observation");
      }
      return kill.call(this, pid, signal);
    };
    function rejectWrite() {
      process.stderr.write("Forbidden hook write attempt\\n");
      throw new Error("Forbidden hook write attempt");
    }
    for (const name of ["writeFileSync", "appendFileSync", "mkdirSync", "renameSync", "unlinkSync", "rmSync", "rmdirSync", "chmodSync", "utimesSync", "writeSync", "createWriteStream"]) fs[name] = rejectWrite;
    for (const name of ["writeFile", "appendFile", "mkdir", "rename", "unlink", "rm", "rmdir", "chmod", "utimes"]) fs.promises[name] = rejectWrite;
    const openSync = fs.openSync;
    fs.openSync = function(target, flags, ...args) {
      if (typeof flags === "string" ? /[wa+]/u.test(flags) : (flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT)) !== 0) rejectWrite();
      return openSync.call(this, target, flags, ...args);
    };
    syncBuiltinESMExports();
  `;
}

function validateSessionFacts(root, executable) {
  const cardPath = path.join(root, ".dove/research/IDENTITY.md");
  const secret = "SYNTHETIC_PRIVATE_REPORT_MUST_NOT_APPEAR";
  const readGuard = `
    import fs from "node:fs";
    import path from "node:path";
    import { fileURLToPath } from "node:url";
    import { syncBuiltinESMExports } from "node:module";
    const root = ${JSON.stringify(root)};
    function guard(target) {
      const file = target instanceof URL ? fileURLToPath(target) : String(target);
      const relative = path.relative(root, path.resolve(file)).split(path.sep).join("/");
      if ((relative.startsWith(".dove/research/") && relative !== ".dove/research/IDENTITY.md")
        || relative.startsWith(".dove/reviews/") || relative.startsWith(".dove/runs/")
        || relative === "synthetic-transcript.jsonl" || relative === "unlisted-report.md") {
        process.stderr.write("Forbidden SessionStart read: " + relative + "\\n");
        throw new Error("Forbidden SessionStart read");
      }
    }
    for (const name of ["readFileSync", "readFile", "openSync", "open", "createReadStream"]) {
      const original = fs[name];
      fs[name] = function(target, ...args) { guard(target); return original.call(this, target, ...args); };
    }
    for (const name of ["readFile", "open"]) {
      const original = fs.promises[name];
      fs.promises[name] = function(target, ...args) { guard(target); return original.call(this, target, ...args); };
    }
    function rejectWrite() { process.stderr.write("Forbidden SessionStart write\\n"); throw new Error("Forbidden SessionStart write"); }
    for (const name of ["writeFileSync", "appendFileSync", "mkdirSync", "renameSync", "unlinkSync", "rmSync", "rmdirSync", "chmodSync", "utimesSync", "writeSync", "createWriteStream"]) fs[name] = rejectWrite;
    for (const name of ["writeFile", "appendFile", "mkdir", "rename", "unlink", "rm", "rmdir", "chmod", "utimes"]) fs.promises[name] = rejectWrite;
    const openSync = fs.openSync;
    fs.openSync = function(target, flags, ...args) {
      if (typeof flags === "string" ? /[wa+]/u.test(flags) : (flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT)) !== 0) rejectWrite();
      return openSync.call(this, target, flags, ...args);
    };
    syncBuiltinESMExports();
  `;
  const invoke = (source, overrides = {}, rawInput = null) => {
    const before = treeSnapshot(root);
    const result = spawnSync(process.execPath, [
      "--import", `data:text/javascript,${encodeURIComponent(readGuard)}`,
      executable, "hook", "session-start", "--project", root
    ], {
      cwd: ROOT,
      input: rawInput ?? JSON.stringify({ hook_event_name: "SessionStart", source, cwd: root, transcript_path: path.join(root, "synthetic-transcript.jsonl"), ...overrides }),
      encoding: "utf8", timeout: 15000, env: CLI_ENV
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.stderr, "", "SessionStart must not attempt forbidden reads or writes, even when errors are caught.");
    assert.deepEqual(treeSnapshot(root), before, "SessionStart preserves all fixture bytes, paths, and mtimes.");
    return result.stdout ? JSON.parse(result.stdout) : null;
  };
  const bootstrap = renderDoveAuthorPreferencesBootstrap(
    path.join(root, ".dove/install/AUTHOR_PREFERENCES.md"),
    path.join(root, ".dove/install/RESEARCH_QUALITY.md")
  );
  const check = (card = null, truncated = false) => {
    for (const source of ["startup", "clear", "compact", "resume"]) {
      const output = invoke(source);
      assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
      const delivered = output.hookSpecificOutput.additionalContext;
      const sourceMarker = `\nUser-original source: ${JSON.stringify(path.join(root, "synthetic-transcript.jsonl"))}.`;
      assert.ok(delivered.includes(sourceMarker), "SessionStart appends the user-original source pointer without reading its contents");
      const context = delivered.slice(0, delivered.indexOf(sourceMarker));
      if (source === "startup" || source === "clear") {
        assert.equal(context, bootstrap, "startup and clear bootstrap the main agent's two short summaries before the source pointer");
      } else {
        if (card === null) {
          assert.match(context, /No readable short identity card at \.dove\/research\/IDENTITY\.md/u);
          assert.match(context, /do not infer a mainline/iu);
        } else {
          assert.ok(context.includes(card), "compact/resume inject the current synthetic identity card");
          assert.match(context, /Project identity card \(researcher-owned/iu);
          if (truncated) {
            assert.doesNotMatch(context, /No readable short identity card/iu);
            assert.match(context, /exceeds 4KB/iu);
            assert.match(context, /shorten it without changing Mainline/iu);
          }
        }
        assert.ok(context.includes(`${DOVE_AUTHOR_PREFERENCES_CONTINUITY}\n`));
        assert.ok(context.endsWith(DOVE_RESEARCH_REFLECTION_CONTINUITY));
      }
      assert.equal(delivered.includes(REFERENCES[0].content.slice(0, 500)), false, "do not embed author-preference body");
      assert.doesNotMatch(delivered, /SYNTHETIC_PRIVATE_REPORT_MUST_NOT_APPEAR|Latest Review:|Latest Run:|RESEARCH\.md: exists=/u);
    }
  };

  // All materials are synthetic and local to the fixture; no absent area is bootstrapped.
  fs.renameSync(path.join(root, ".dove/research"), path.join(SCRATCH_ROOT, `${path.basename(root)}-initial-research`));
  check();
  assert.equal(fs.existsSync(path.join(root, ".dove/research")), false);
  const card = "Mainline: User-confirmed synthetic research goal\nRejected approach: CPU by default\nNext core action: run GPU comparison\n";
  writeFile(root, ".dove/research/IDENTITY.md", card);
  writeFile(root, ".dove/research/RESEARCH.md", `Mainline: Wrong old goal\n${secret}\n`);
  writeFile(root, "unlisted-report.md", secret);
  writeFile(root, "synthetic-transcript.jsonl", secret);
  writeFile(root, ".dove/reviews/a-latest/review.json", secret);
  writeFile(root, ".dove/runs/a-latest/run.jsonl", secret);
  check(card);
  fs.writeFileSync(cardPath, "Mainline: Revised synthetic user goal\nNext core action: implement core route\n");
  check("Mainline: Revised synthetic user goal\nNext core action: implement core route\n");
  const oversizedCard = "Mainline: Oversized\n" + "x".repeat(4096);
  fs.writeFileSync(cardPath, oversizedCard);
  check(oversizedCard.slice(0, 4096), true);
  fs.rmSync(cardPath);
  fs.symlinkSync(path.join(root, "unlisted-report.md"), cardPath);
  check();
  fs.rmSync(cardPath);
  check();
  writeFile(root, ".dove/research/IDENTITY.md", card);

  fs.appendFileSync(path.join(root, ".claude/commands/dove/research.md"), "local edit\n");
  for (const source of ["startup", "clear", "compact", "resume"]) {
    const output = invoke(source);
    assert.match(output.systemMessage, /read-only.*dove update/u);
    assert.equal(Object.hasOwn(output, "hookSpecificOutput"), true);
  }
  const agentPath = path.join(root, ".claude/agents/dove.md");
  const savedAgentPath = path.join(SCRATCH_ROOT, `${path.basename(root)}-saved-agent.md`);
  fs.renameSync(agentPath, savedAgentPath);
  assert.match(invoke("compact").systemMessage, /read-only.*dove update/u);
  fs.renameSync(savedAgentPath, agentPath);
  const manifestPath = path.join(root, INSTALLATION_MANIFEST_PATH);
  const manifest = readJson(manifestPath);
  writeJson(manifestPath, { ...manifest, package: { ...manifest.package, version: "0.0.1" } });
  assert.match(invoke("compact").systemMessage, /read-only.*dove update/u);
  writeJson(manifestPath, { ...manifest, package: { ...manifest.package, version: "99.0.0" } });
  const blocked = invoke("compact");
  assert.match(blocked.systemMessage, /could not inspect.*(?:refuses|拒绝)/u);
  assert.equal(Object.hasOwn(blocked, "hookSpecificOutput"), false);
  writeJson(manifestPath, manifest);
  const settingsPath = path.join(root, ".claude/settings.json");
  const settings = fs.readFileSync(settingsPath);
  fs.writeFileSync(settingsPath, "{broken");
  assert.match(invoke("compact").systemMessage, /could not inspect/u);
  fs.writeFileSync(settingsPath, settings);
  const malformedEvent = invoke("compact", { hook_event_name: "OtherEvent" });
  assert.match(malformedEvent.systemMessage, /unsupported or missing hook event/u);
  assert.equal(Object.hasOwn(malformedEvent, "hookSpecificOutput"), false);
  assert.match(invoke("compact", {}, "{broken").systemMessage, /malformed JSON/u);
}


const roots = [];
function scratch() {
  const root = fs.mkdtempSync(path.join(SCRATCH_ROOT, "dove-installation-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, ".git"));
  return root;
}
function researchReadGuard(root) {
  const forbidden = [];
  const fsOps = Object.create(fs);
  for (const name of ["readFileSync", "readdirSync", "openSync"]) {
    fsOps[name] = (target, ...args) => {
      const relative = typeof target === "number" ? "" : path.relative(root, String(target)).split(path.sep).join("/");
      if (relative === ".dove/research" || relative.startsWith(".dove/research/")) {
        forbidden.push(relative);
        throw new Error("Research bootstrap must not read existing research.");
      }
      return fs[name](target, ...args);
    };
  }
  return { fsOps, forbidden };
}

// Run the source CLI only. Retain uniquely named scratch for inspection.
const factsRoot = makeProject();
roots.push(factsRoot);
validateSessionFacts(factsRoot, path.join(ROOT, "bin/dove.mjs"));
const doctorRoot = makeProject();
roots.push(doctorRoot);
validateDoctorVersions(doctorRoot, path.join(ROOT, "bin/dove.mjs"));
for (const hosts of [["claude"], ["dsh"], ["claude", "dsh"]]) {
  const root = scratch();
  const initialized = initializeProjectIntegration(root, { ...PACKAGE_OPTIONS, hosts });
  assert.deepEqual(fs.readdirSync(path.join(root, ".dove/research")), ["RESEARCH.md"]);
  assert.deepEqual(initialized.manifest.managed, resourcesForHosts(hosts).map(({ path, kind, selector, digest }) => ({ path, kind, selector, digest })));
  const references = initialized.manifest.managed.filter((entry) => entry.path.startsWith(".dove/"));
  assert.deepEqual(references, REFERENCES.map(({ path: relativePath, content }) => ({
    path: relativePath, kind: "exclusive-file", selector: null,
    digest: crypto.createHash("sha256").update(content).digest("hex")
  })));
  for (const reference of REFERENCES) {
    assert.equal(fs.readFileSync(path.join(root, reference.path), "utf8"), reference.content);
  }
  const before = treeSnapshot(root);
  assert.equal(updateProjectIntegration(root, PACKAGE_OPTIONS).status, "unchanged");
  assert.deepEqual(treeSnapshot(root), before);
  for (const reference of REFERENCES) {
    fs.rmSync(path.join(root, reference.path));
    const missing = assertDoctorReadOnly(root);
    assert.equal(missing.setup.mode, "needs-update");
    assert.equal(missing.projectIntegration.updatePaths.includes(reference.path), true);
    assert.deepEqual(missing.projectIntegration.skippedLocalEdits, []);
    const restored = updateProjectIntegration(root, PACKAGE_OPTIONS);
    assert.equal(restored.writtenPaths.includes(reference.path), true);
    assert.deepEqual(restored.replacedLocalEdits, []);
    assert.equal(fs.readFileSync(path.join(root, reference.path), "utf8"), reference.content);

    // An earlier valid revision-2 inventory may not yet include this reference.
    const manifestPath = path.join(root, INSTALLATION_MANIFEST_PATH);
    const manifest = readJson(manifestPath);
    manifest.managed = manifest.managed.filter((entry) => entry.path !== reference.path);
    writeJson(manifestPath, manifest);
    writeFile(root, reference.path, "unowned reference customization\n");
    const conflictBefore = treeSnapshot(root);
    assert.equal(assertDoctorReadOnly(root).setup.mode, "blocked");
    assert.throws(() => updateProjectIntegration(root, PACKAGE_OPTIONS), /conflicting content/u);
    assert.throws(() => previewProjectCompleteReinstall(root, PACKAGE_OPTIONS), /conflicting content/u);
    assert.deepEqual(treeSnapshot(root), conflictBefore, "Missing ownership must not authorize replacing a local reference.");
    fs.rmSync(path.join(root, reference.path));
    assert.equal(assertDoctorReadOnly(root).projectIntegration.updatePaths.includes(reference.path), true);
    const added = updateProjectIntegration(root, PACKAGE_OPTIONS);
    assert.deepEqual(added.manifest.managed.find((entry) => entry.path === reference.path), references.find((entry) => entry.path === reference.path));
    assert.equal(fs.readFileSync(path.join(root, reference.path), "utf8"), reference.content);
  }
  const changed = updateProjectIntegration(root, { ...PACKAGE_OPTIONS, hosts: hosts.includes("claude") ? ["dsh"] : ["claude"] });
  assert.equal(changed.manifest.hosts.length, 1);
  assert.deepEqual(changed.manifest.managed.filter((entry) => entry.path.startsWith(".dove/")), references);
  for (const reference of REFERENCES) assert.equal(changed.changedPaths.includes(reference.path), false, "Shared references survive host changes without rewriting.");
  assert.equal(inspectProjectDoctor(root, PACKAGE_OPTIONS).setup.mode, "current");
}

const userStatusLineRoot = scratch();
writeFile(userStatusLineRoot, ".claude/settings.json", `${JSON.stringify({
  statusLine: { type: "command", command: "trellis-statusline" },
  enabledPlugins: { demo: true }
}, null, 2)}\n`);
const userStatusLineInit = initializeProjectIntegration(userStatusLineRoot, { ...PACKAGE_OPTIONS, hosts: ["claude"] });
assert.equal(userStatusLineInit.manifest.managed.some((entry) => entry.selector === STATUS_LINE_SELECTOR), false);
assert.deepEqual(readJson(path.join(userStatusLineRoot, ".claude/settings.json")).statusLine, { type: "command", command: "trellis-statusline" });
assert.equal(readJson(path.join(userStatusLineRoot, ".claude/settings.json")).enabledPlugins.demo, true);
assert.equal(updateProjectIntegration(userStatusLineRoot, PACKAGE_OPTIONS).status, "unchanged");
const userStatusLinePreview = previewProjectCompleteReinstall(userStatusLineRoot, PACKAGE_OPTIONS);
completeReinstallProjectIntegration(userStatusLineRoot, { ...PACKAGE_OPTIONS, preview: userStatusLinePreview, confirmed: true });
assert.deepEqual(readJson(path.join(userStatusLineRoot, ".claude/settings.json")).statusLine, { type: "command", command: "trellis-statusline" });
fs.rmSync(path.join(userStatusLineRoot, ".claude/settings.json"));
const installFreedStatusLine = inspectProjectIntegration(userStatusLineRoot, PACKAGE_OPTIONS);
assert.equal(installFreedStatusLine.status, "needs-update");
updateProjectIntegration(userStatusLineRoot, PACKAGE_OPTIONS);
assert.deepEqual(readJson(path.join(userStatusLineRoot, ".claude/settings.json")).statusLine, DOVE_CLAUDE_STATUS_LINE);
assert.equal(readJson(path.join(userStatusLineRoot, INSTALLATION_MANIFEST_PATH)).managed.some((entry) => entry.selector === STATUS_LINE_SELECTOR), true);

for (const contents of [null, Buffer.from([0xff, 0x00])]) {
  const root = scratch();
  fs.mkdirSync(path.join(root, ".dove/research"), { recursive: true });
  if (contents) {
    writeFile(root, ".dove/research/RESEARCH.md", contents);
    writeFile(root, ".dove/research/lessons/unknown.bin", contents);
  }
  const before = treeSnapshot(path.join(root, ".dove/research"));
  const guarded = researchReadGuard(root);
  assert.deepEqual(prepareResearchDefaults(root, guarded).entries, []);
  initializeProjectIntegration(root, { ...PACKAGE_OPTIONS, fsOps: guarded.fsOps });
  updateProjectIntegration(root, { ...PACKAGE_OPTIONS, fsOps: guarded.fsOps });
  const preview = previewProjectCompleteReinstall(root, { ...PACKAGE_OPTIONS, fsOps: guarded.fsOps });
  completeReinstallProjectIntegration(root, { ...PACKAGE_OPTIONS, fsOps: guarded.fsOps, preview, confirmed: true });
  assert.deepEqual(guarded.forbidden, []);
  assert.deepEqual(treeSnapshot(path.join(root, ".dove/research")), before);
  assert.equal(inspectProjectDoctor(root, PACKAGE_OPTIONS).setup.mode, "current", "Research readability must not determine integration setup actions.");
}
const absent = scratch();
assert.equal(inspectProjectDoctor(absent, PACKAGE_OPTIONS).setup.mode, "uninitialized");
writeFile(absent, ".dove/manifest.json", '{"schemaVersion":9,"manifestVersion":1}\n');
writeFile(absent, ".dove/research/RESEARCH.md", "# Preserved\n");
let before = treeSnapshot(absent);
assert.throws(() => updateDoveLifecycle(absent, PACKAGE_OPTIONS), /not initialized/u);
assert.throws(() => previewProjectCompleteReinstall(absent, PACKAGE_OPTIONS), /manifest is missing/u);
assert.deepEqual(treeSnapshot(absent), before, "An old marker does not authorize adoption or cleanup.");
assert.equal(inspectProjectDoctor(absent, PACKAGE_OPTIONS).setup.mode, "uninitialized");

const preservedRoot = scratch();
initializeProjectIntegration(preservedRoot, PACKAGE_OPTIONS);
const unknownPaths = [".dove/install/unknown.bin", ".dove/install/DOCTOR.md", ".dove/manifest.json", ".dove/research/RESEARCH.md", ".dove/reviews/preserved/review.json", ".dove/runs/preserved/run.jsonl", "scripts/old-runtime.mjs"];
for (const relativePath of unknownPaths) writeFile(preservedRoot, relativePath, "preserve unknown bytes\n");
const preserved = unknownPaths.map((relativePath) => [relativePath, fs.readFileSync(path.join(preservedRoot, relativePath))]);
const assertPreserved = () => {
  for (const [relativePath, bytes] of preserved) assert.deepEqual(fs.readFileSync(path.join(preservedRoot, relativePath)), bytes);
};
const qualityPath = ".dove/install/RESEARCH_QUALITY.md";
for (const reference of REFERENCES) {
  validateDoctorVersions(preservedRoot, path.join(ROOT, "bin/dove.mjs"), reference.path);
  fs.appendFileSync(path.join(preservedRoot, reference.path), "local edit\n");
  const edited = assertDoctorReadOnly(preservedRoot);
  assert.deepEqual(edited.projectIntegration.drifted, [{ path: reference.path, selector: null }]);
  const update = updateProjectIntegration(preservedRoot, PACKAGE_OPTIONS);
  assert.deepEqual(update.replacedLocalEdits, [{ path: reference.path, selector: null }]);
  assert.equal(fs.readFileSync(path.join(preservedRoot, reference.path), "utf8"), reference.content);
  assertPreserved();
  for (const missing of [false, true]) {
    if (missing) fs.rmSync(path.join(preservedRoot, reference.path));
    else fs.appendFileSync(path.join(preservedRoot, reference.path), "local edit\n");
    const before = treeSnapshot(preservedRoot);
    const reinstall = previewProjectCompleteReinstall(preservedRoot, PACKAGE_OPTIONS);
    assert.deepEqual(reinstall.removedPaths, []);
    assert.deepEqual(reinstall.writtenPaths.sort(), [reference.path, INSTALLATION_MANIFEST_PATH].sort());
    assert.throws(() => completeReinstallProjectIntegration(preservedRoot, { ...PACKAGE_OPTIONS, preview: reinstall }), /requires confirmed/u);
    assert.deepEqual(treeSnapshot(preservedRoot), before, "Preview and unconfirmed reinstall must not write.");
    completeReinstallProjectIntegration(preservedRoot, { ...PACKAGE_OPTIONS, preview: reinstall, confirmed: true });
    assert.equal(fs.readFileSync(path.join(preservedRoot, reference.path), "utf8"), reference.content);
    assert.equal(inspectProjectDoctor(preservedRoot, PACKAGE_OPTIONS).setup.mode, "current");
    assertPreserved();
  }
}

const manifestPath = path.join(preservedRoot, INSTALLATION_MANIFEST_PATH);
const manifest = readJson(manifestPath);
for (const relativePath of [".dove/research/RESEARCH.md", ".dove/install/DOCTOR.md", ".dove/install/unknown.md", ".dove/install/manifest.json", ".dove/reviews/review.json", ".dove/runs/run.jsonl", ".dove", ".dove/install", ...REFERENCES.flatMap((entry) => [`${entry.path}/extra`, `${entry.path}.bak`, entry.path.toLowerCase()])]) {
  const invalid = structuredClone(manifest);
  invalid.managed.push({ path: relativePath, kind: "exclusive-file", selector: null, digest: "a".repeat(64) });
  assert.throws(() => validateProjectInstallationManifest(invalid, { hostIds: ["claude", "dsh"] }), /must not manage/u);
}
for (const reference of REFERENCES) {
  for (const kind of ["json-fragment", "text-block", "exclusive-file"]) {
    const fragmented = structuredClone(manifest);
    Object.assign(fragmented.managed.find((entry) => entry.path === reference.path), { kind, selector: "/anything" });
    assert.throws(() => validateProjectInstallationManifest(fragmented, { hostIds: ["claude", "dsh"] }), /one exclusive file/u);
  }
  const duplicated = structuredClone(manifest);
  duplicated.managed.push(structuredClone(duplicated.managed.find((entry) => entry.path === reference.path)));
  assert.throws(() => validateProjectInstallationManifest(duplicated, { hostIds: ["claude", "dsh"] }), /must be unique/u);
  const root = scratch();
  writeFile(root, reference.path, "unowned reference customization\n");
  const before = treeSnapshot(root);
  assert.throws(() => initializeProjectIntegration(root, PACKAGE_OPTIONS), /installation directory is incomplete/u);
  assert.deepEqual(treeSnapshot(root), before, "Init must not claim or overwrite an incomplete installation's reference bytes.");
}
for (const modify of [
  (value) => { value.revision = "1.0"; },
  (value) => { value.revision = "3.0"; },
  (value) => { value.package.name = "foreign"; },
  (value) => { value.package.version = "99.0.0"; },
  (value) => { value.managed.push({ path: "scripts/old-runtime.mjs", kind: "exclusive-file", selector: null, digest: "a".repeat(64) }); },
  (value) => { value.managed.push({ path: ".claude/settings.json", kind: "json-fragment", selector: "/unknown", digest: "a".repeat(64) }); }
]) {
  const invalid = structuredClone(manifest);
  modify(invalid);
  writeJson(manifestPath, invalid);
  before = treeSnapshot(preservedRoot);
  assert.equal(inspectProjectDoctor(preservedRoot, PACKAGE_OPTIONS).projectIntegration.state, "blocked");
  assert.equal(inspectProjectDoctor(preservedRoot, PACKAGE_OPTIONS).setup.mode, "blocked");
  assert.throws(() => updateDoveLifecycle(preservedRoot, PACKAGE_OPTIONS));
  assert.throws(() => previewProjectCompleteReinstall(preservedRoot, PACKAGE_OPTIONS));
  for (const source of ["startup", "clear", "compact", "resume"]) {
    const hook = cliHook(preservedRoot, "session-start", { hook_event_name: "SessionStart", source, cwd: preservedRoot });
    assert.equal(hook.status, 0, hook.stderr);
    assert.match(JSON.parse(hook.stdout).systemMessage, /read-only/u);
  }
  assert.deepEqual(treeSnapshot(preservedRoot), before);
}
writeJson(manifestPath, manifest);
const unknownOwnership = structuredClone(manifest);
unknownOwnership.managed.push({ path: "scripts/old-runtime.mjs", kind: "exclusive-file", selector: null, digest: "a".repeat(64) });
writeJson(manifestPath, unknownOwnership);
assert.throws(() => previewProjectUninstall(preservedRoot), /unknown ownership/u);
writeJson(manifestPath, manifest);
for (const current of [false, true]) {
  const root = scratch();
  if (current) initializeProjectIntegration(root, PACKAGE_OPTIONS);
  writeJson(path.join(root, ".dove-install/manifest.json"), { ...manifest, revision: "1.0" });
  const before = treeSnapshot(root);
  assert.equal(inspectProjectDoctor(root, PACKAGE_OPTIONS).setup.mode, "blocked");
  assert.throws(() => updateDoveLifecycle(root, PACKAGE_OPTIONS));
  assert.throws(() => initializeProjectIntegration(root, PACKAGE_OPTIONS));
  assert.throws(() => previewProjectCompleteReinstall(root, PACKAGE_OPTIONS));
  assert.deepEqual(treeSnapshot(root), before);
}
const retiredRoot = scratch();
initializeProjectIntegration(retiredRoot, PACKAGE_OPTIONS);
const settingsPath = path.join(retiredRoot, ".claude/settings.json");
const settings = readJson(settingsPath);
const stop = { hooks: [{ type: "command", command: 'dove hook stop --project "$CLAUDE_PROJECT_DIR"', timeout: 10 }] };
const currentPrompt = settings.hooks.UserPromptSubmit[0];
const prompt = { hooks: [{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR/scripts/dove-user-prompt-submit-package.mjs"', timeout: 10 }] };
settings.hooks.Stop = [stop];
settings.hooks.UserPromptSubmit = [currentPrompt, prompt];
writeJson(settingsPath, settings);
before = treeSnapshot(retiredRoot);
const retiredDoctor = assertDoctorReadOnly(retiredRoot);
assert.equal(retiredDoctor.projectIntegration.state, "current");
assert.equal(retiredDoctor.projectIntegration.retiredHooks.matchedPaths.length, 1);
updateProjectIntegration(retiredRoot, PACKAGE_OPTIONS);
assert.deepEqual(treeSnapshot(retiredRoot), before);
const retiredManifestPath = path.join(retiredRoot, INSTALLATION_MANIFEST_PATH);
const retiredManifest = readJson(retiredManifestPath);
retiredManifest.managed.find((entry) => entry.selector === "/hooks/UserPromptSubmit[dove-user-prompt-submit]").digest = semanticDigest(prompt);
settings.hooks.UserPromptSubmit = [prompt];
writeJson(settingsPath, settings);
writeJson(retiredManifestPath, retiredManifest);
updateProjectIntegration(retiredRoot, PACKAGE_OPTIONS);
assert.deepEqual(readJson(settingsPath).hooks.Stop, [stop]);
assert.deepEqual(readJson(settingsPath).hooks.UserPromptSubmit, [currentPrompt]);
const other = scratch();
initializeProjectIntegration(other, PACKAGE_OPTIONS);
const mismatch = cliHook(retiredRoot, "session-start", { hook_event_name: "SessionStart", cwd: other });
assert.match(JSON.parse(mismatch.stdout).systemMessage, /不属于声明的已初始化项目/u);

const missingResearch = scratch();
initializeProjectIntegration(missingResearch, PACKAGE_OPTIONS);
fs.renameSync(path.join(missingResearch, ".dove/research"), path.join(SCRATCH_ROOT, `${path.basename(missingResearch)}-preserved-research`));
updateProjectIntegration(missingResearch, PACKAGE_OPTIONS);
const missingPreview = previewProjectCompleteReinstall(missingResearch, PACKAGE_OPTIONS);
completeReinstallProjectIntegration(missingResearch, { ...PACKAGE_OPTIONS, preview: missingPreview, confirmed: true });
assert.equal(fs.existsSync(path.join(missingResearch, ".dove/research")), false, "Only init may bootstrap research.");
const symlinkRoot = scratch();
const outside = scratch();
writeFile(outside, "quality.md", "unowned external material\n");
fs.mkdirSync(path.join(symlinkRoot, ".dove/install"), { recursive: true });
fs.symlinkSync(path.join(outside, "quality.md"), path.join(symlinkRoot, qualityPath));
before = treeSnapshot(symlinkRoot);
assert.throws(() => initializeProjectIntegration(symlinkRoot, PACKAGE_OPTIONS));
assert.deepEqual(treeSnapshot(symlinkRoot), before);
assert.equal(fs.readFileSync(path.join(outside, "quality.md"), "utf8"), "unowned external material\n");
const conflictRoot = scratch();
writeFile(conflictRoot, ".claude/agents/dove.md", "unowned customization\n");
before = treeSnapshot(conflictRoot);
assert.throws(() => initializeProjectIntegration(conflictRoot, PACKAGE_OPTIONS), /conflicting content/u);
assert.deepEqual(treeSnapshot(conflictRoot), before);
const malformedRoot = scratch();
writeFile(malformedRoot, INSTALLATION_MANIFEST_PATH, "{broken");
before = treeSnapshot(malformedRoot);
assert.equal(inspectProjectDoctor(malformedRoot, PACKAGE_OPTIONS).setup.mode, "blocked");
assert.throws(() => updateDoveLifecycle(malformedRoot, PACKAGE_OPTIONS));
assert.throws(() => previewProjectCompleteReinstall(malformedRoot, PACKAGE_OPTIONS));
assert.deepEqual(treeSnapshot(malformedRoot), before);
const driftDoctor = inspectProjectDoctor(doctorRoot, {
  ...PACKAGE_OPTIONS,
  inspectCurrentIntegration: () => { throw new Error("ownership drift"); }
});
assert.equal(driftDoctor.projectIntegration.state, "blocked");
assert.equal(driftDoctor.setup.mode, "blocked");

console.log(JSON.stringify({ status: "passed", scratch: SCRATCH_ROOT, retainedFixtures: roots, sessionFactsCli: "bin/dove.mjs", checks: ["read-only SessionStart", "doctor/setup states", "explicit lifecycle", "opaque research bootstrap", "exact quality and author preferences ownership", "legacy and unknown preservation"] }, null, 2));
