#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DOVE_CLAUDE_STATUS_LINE } from "../src/core/ambient-policy.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import { initializeProjectIntegration, inspectProjectIntegration, updateProjectIntegration, previewProjectCompleteReinstall, completeReinstallProjectIntegration, previewProjectUninstall } from "../src/core/project-installation.mjs";
import { INSTALLATION_MANIFEST_PATH, validateProjectInstallationManifest } from "../src/core/project-installation-manifest.mjs";
import { resourcesForHosts, STATUS_LINE_SELECTOR } from "../src/core/project-installation-resources.mjs";
import { prepareResearchDefaults } from "../src/core/research-defaults.mjs";
import { inspectProjectDoctor } from "../src/core/project-doctor.mjs";
import { updateDoveLifecycle } from "../src/core/dove-lifecycle.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH_ROOT = path.join(ROOT, ".dove-dev", "tmp");
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
    ...options
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
    env: { ...process.env, NO_COLOR: "1" }
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

function validateDoctorVersions(root, cliPath) {
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

  const resourcePath = ".claude/agents/dove.md";
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
  const researchPath = path.join(root, ".dove/research/RESEARCH.md");
  const reviewPath = path.join(root, ".dove/reviews/a-latest/review.json");
  const snapshotPath = path.join(root, ".dove/reviews/a-latest/rounds/2/snapshot.json");
  const journalPath = path.join(root, ".dove/runs/a-latest/run.jsonl");
  const oldTime = "2026-08-01T00:00:00.000Z";
  const reviewTime = "2026-08-03T00:00:00.000Z";
  const runTime = "2026-08-02T00:00:00.000Z";
  const secret = "DO_NOT_INJECT_BODY_REPORT_LOG_TRANSCRIPT_OR_EXTRA_FIELDS";

  const invoke = (source, overrides = {}, rawInput = null) => {
    const before = treeSnapshot(root);
    const result = spawnSync(process.execPath, [
      "--import", `data:text/javascript,${encodeURIComponent(hookReadGuard(root, source))}`,
      executable, "hook", "session-start", "--project", root
    ], {
      cwd: ROOT,
      input: rawInput ?? JSON.stringify({ hook_event_name: "SessionStart", source, cwd: root, transcript_path: path.join(root, "synthetic-transcript.jsonl"), ...overrides }),
      encoding: "utf8",
      timeout: 15000
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.stderr, "", "The hook must not attempt forbidden reads, even when errors are caught.");
    assert.deepEqual(treeSnapshot(root), before, "No-op/failed hook must preserve all tree bytes and file/directory mtimes.");
    const output = result.stdout ? JSON.parse(result.stdout) : null;
    if (output?.hookSpecificOutput) {
      assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
      const context = output.hookSpecificOutput.additionalContext;
      assert.equal(typeof context, "string");
      assert.equal(context.split("\n").length, 4, "Facts stay limited to one header and three items.");
      assert.match(context, /not the current research mainline/u);
      assert.doesNotMatch(context, /sha256|digest|report\.md|stdout\.log|stderr\.log|ago|minutes? later|DO_NOT_INJECT/iu);
      assert.doesNotMatch(context, /z-older|historical-material/u);
    }
    return output;
  };
  const context = (source = "compact") => invoke(source).hookSpecificOutput.additionalContext;

  // Missing trees stay missing. No read helper may create its input directories.
  fs.renameSync(path.join(root, ".dove/research"), path.join(SCRATCH_ROOT, `${path.basename(root)}-initial-research`));
  for (const source of ["startup", "clear", "compact", "resume"]) {
    const output = invoke(source);
    if (source === "startup" || source === "clear") assert.equal(output, null);
    else {
      assert.match(output.hookSpecificOutput.additionalContext, /RESEARCH\.md: exists=no; mtime=unavailable/u);
      assert.match(output.hookSpecificOutput.additionalContext, /Latest Review: unavailable\nLatest Run: unavailable/u);
    }
  }
  for (const directory of ["research", "reviews", "runs"]) assert.equal(fs.existsSync(path.join(root, ".dove", directory)), false);

  writeFile(root, ".dove/research/RESEARCH.md", secret);
  fs.utimesSync(researchPath, new Date(oldTime), new Date(oldTime));
  writeFile(root, "paper.txt", "current paper bytes\n");
  writeFile(root, "historical-material.txt", secret);
  writeFile(root, "unlisted-report.md", secret);
  writeFile(root, "synthetic-transcript.jsonl", secret);
  const material = { path: "paper.txt", size: Buffer.byteLength("current paper bytes\n"), sha256: crypto.createHash("sha256").update("current paper bytes\n").digest("hex") };
  const latestReview = {
    schema: "dove.review.record.v1", id: "a-latest", createdAt: oldTime, updatedAt: reviewTime, currentRound: 2,
    rounds: [{ round: 1, createdAt: oldTime }, { round: 2, createdAt: reviewTime, updatedAt: reviewTime }],
    report: secret, privateNote: secret
  };
  writeJson(reviewPath, latestReview);
  const latestSnapshot = { schema: "dove.review.snapshot.v1", reviewId: "a-latest", round: 2, materials: [material] };
  writeJson(snapshotPath, latestSnapshot);
  writeJson(path.join(root, ".dove/reviews/a-latest/rounds/1/snapshot.json"), { materials: [{ ...material, path: "historical-material.txt" }] });
  writeJson(path.join(root, ".dove/reviews/z-older/review.json"), { ...latestReview, id: "z-older", updatedAt: oldTime, currentRound: 1 });
  writeJson(path.join(root, ".dove/reviews/z-older/rounds/1/snapshot.json"), { materials: [{ ...material, path: "historical-material.txt" }] });
  writeFile(root, ".dove/reviews/a-latest/rounds/2/report.md", secret);
  writeFile(root, ".dove/reviews/a-latest/rounds/2/backend.json", secret);
  const writeRun = (id, at, exitCode) => writeFile(root, `.dove/runs/${id}/run.jsonl`, [
    { schemaVersion: "dove.run.event.v1", seq: 1, at, type: "run.started", runId: id, argv: [secret], note: secret },
    { schemaVersion: "dove.run.event.v1", seq: 2, at, type: "run.terminal", runId: id, outcome: exitCode === 0 ? "succeeded" : "failed", exitCode }
  ].map((event) => JSON.stringify(event)).join("\n") + "\n");
  writeRun("a-latest", runTime, 7);
  writeRun("z-older", oldTime, 0);
  writeFile(root, ".dove/runs/a-latest/stdout.log", secret);
  writeFile(root, ".dove/runs/a-latest/stderr.log", secret);
  // Selection follows absolute record timestamps, not directory name or mtime.
  fs.utimesSync(reviewPath, new Date(oldTime), new Date(oldTime));
  fs.utimesSync(journalPath, new Date(oldTime), new Date(oldTime));
  for (const source of ["startup", "clear", "compact", "resume"]) {
    const output = invoke(source);
    if (source === "startup" || source === "clear") assert.equal(output, null);
    else {
      const facts = output.hookSpecificOutput.additionalContext;
      assert.match(facts, new RegExp(`RESEARCH\\.md: exists=yes; mtime=${oldTime}`, "u"));
      assert.ok(facts.includes(`Latest Review: id=a-latest; round=2; updatedAt=${reviewTime}; material currentness=current`));
      assert.ok(facts.includes(`Latest Run: id=a-latest; startedAt=${runTime}; status=failed; exit=7`));
    }
  }

  const olderJournalPath = path.join(root, ".dove/runs/z-older/run.jsonl");
  const olderJournal = fs.readFileSync(olderJournalPath, "utf8");
  const olderEvents = olderJournal.trimEnd().split("\n").map((line) => JSON.parse(line));
  olderEvents[0].supervisorPid = 214214;
  olderEvents[0].note = "多字节启动元数据".repeat(400);
  const olderStart = JSON.stringify(olderEvents[0]) + "\n";
  const selectedJournal = fs.readFileSync(journalPath, "utf8");
  const selectedStart = selectedJournal.slice(0, selectedJournal.indexOf("\n") + 1);
  // An old journal's truncated terminal/finalized event is not relevant to
  // latest selection. The guard also rejects full old-journal reads, scans past
  // its first newline, and observations of its synthetic supervisor PID.
  for (const type of ["run.terminal", "run.finalized"]) {
    const brokenTail = `{"type":"${type}","note":"${"x".repeat(100000)}`;
    fs.writeFileSync(olderJournalPath, olderStart + brokenTail);
    for (const source of ["compact", "resume"]) {
      assert.ok(context(source).includes(`Latest Run: id=a-latest; startedAt=${runTime}; status=failed; exit=7`));
    }
    fs.writeFileSync(journalPath, selectedStart + brokenTail);
    for (const source of ["compact", "resume"]) assert.match(context(source), /material currentness=current\nLatest Run: unavailable/u);
    fs.writeFileSync(journalPath, selectedJournal);
  }
  // Even a directory named like an old run cannot be skipped when its start
  // timestamp is unknown: it could actually be the newest candidate.
  for (const invalidStart of [
    "{broken\n",
    JSON.stringify({ ...olderEvents[0], at: undefined }) + "\n",
    JSON.stringify({ ...olderEvents[0], type: "run.terminal" }) + "\n",
    olderStart.trimEnd()
  ]) {
    fs.writeFileSync(olderJournalPath, invalidStart);
    assert.match(context(), /material currentness=current\nLatest Run: unavailable/u);
  }
  fs.writeFileSync(olderJournalPath, olderJournal);

  writeFile(root, "paper.txt", "changed paper bytes\n");
  assert.match(context(), /material currentness=changed/u);
  fs.rmSync(path.join(root, "paper.txt"));
  assert.match(context("resume"), /material currentness=missing/u);
  writeFile(root, "paper.txt", "current paper bytes\n");
  assert.match(context(), /material currentness=current/u);
  fs.writeFileSync(snapshotPath, "{broken");
  assert.match(context(), /round=2; updatedAt=.*; material currentness=unavailable/u);
  fs.rmSync(snapshotPath);
  assert.match(context(), /material currentness=unavailable/u);
  writeJson(snapshotPath, latestSnapshot);

  fs.writeFileSync(reviewPath, "{broken");
  assert.match(context(), /RESEARCH\.md: exists=yes.*\nLatest Review: unavailable\nLatest Run: id=a-latest/u);
  fs.rmSync(reviewPath);
  assert.match(context(), /Latest Review: unavailable\nLatest Run: id=a-latest/u);
  writeJson(reviewPath, { ...latestReview, currentRound: 3 });
  assert.match(context(), /Latest Review: unavailable/u);
  for (const updatedAt of [null, "yesterday", undefined]) {
    writeJson(reviewPath, { ...latestReview, updatedAt });
    assert.match(context(), /Latest Review: unavailable\nLatest Run: id=a-latest/u);
  }
  writeJson(reviewPath, latestReview);
  const journal = fs.readFileSync(journalPath);
  fs.writeFileSync(journalPath, "{broken\n");
  assert.match(context(), /material currentness=current\nLatest Run: unavailable/u);
  fs.rmSync(journalPath);
  assert.match(context(), /material currentness=current\nLatest Run: unavailable/u);
  const missingRunTime = journal.toString("utf8").trimEnd().split("\n").map((line) => JSON.parse(line));
  delete missingRunTime[0].at;
  fs.writeFileSync(journalPath, missingRunTime.map((event) => JSON.stringify(event)).join("\n") + "\n");
  assert.match(context(), /Latest Run: unavailable/u);
  fs.writeFileSync(journalPath, journal);
  fs.rmSync(researchPath);
  fs.mkdirSync(researchPath);
  assert.match(context(), /RESEARCH\.md: unavailable\nLatest Review: id=a-latest/u);
  fs.rmdirSync(researchPath);
  fs.symlinkSync(path.join(root, "unlisted-report.md"), researchPath);
  assert.match(context(), /RESEARCH\.md: unavailable\nLatest Review: id=a-latest/u);
  fs.unlinkSync(researchPath);
  writeFile(root, ".dove/research/RESEARCH.md", secret);

  fs.appendFileSync(path.join(root, ".claude/commands/dove/research.md"), "local edit\n");
  for (const source of ["startup", "clear", "compact", "resume"]) {
    const output = invoke(source);
    assert.match(output.systemMessage, /read-only.*dove update/u);
    assert.equal(Object.hasOwn(output, "hookSpecificOutput"), source === "compact" || source === "resume");
  }
  // A missing managed resource and an older package must prompt explicit
  // update, never cause the hook to restore files or refresh the manifest.
  const agentPath = path.join(root, ".claude/agents/dove.md");
  const savedAgentPath = path.join(SCRATCH_ROOT, `${path.basename(root)}-saved-agent.md`);
  fs.renameSync(agentPath, savedAgentPath);
  for (const source of ["startup", "clear", "compact", "resume"]) {
    const output = invoke(source);
    assert.match(output.systemMessage, /read-only.*dove update/u);
    assert.equal(Object.hasOwn(output, "hookSpecificOutput"), source === "compact" || source === "resume");
  }
  fs.renameSync(savedAgentPath, agentPath);
  const manifestPath = path.join(root, INSTALLATION_MANIFEST_PATH);
  const manifest = readJson(manifestPath);
  writeJson(manifestPath, { ...manifest, package: { ...manifest.package, version: "0.0.1" } });
  for (const source of ["startup", "clear", "compact", "resume"]) {
    assert.match(invoke(source).systemMessage, /read-only.*dove update/u);
  }
  writeJson(manifestPath, { ...manifest, package: { ...manifest.package, version: "99.0.0" } });
  for (const source of ["startup", "clear", "compact", "resume"]) {
    const output = invoke(source);
    assert.match(output.systemMessage, /could not inspect.*(?:refuses|拒绝)/u);
    assert.equal(Object.hasOwn(output, "hookSpecificOutput"), false, "Do not read facts after a blocked inspection.");
  }
  writeJson(manifestPath, manifest);
  const settingsPath = path.join(root, ".claude/settings.json");
  const settings = fs.readFileSync(settingsPath);
  fs.writeFileSync(settingsPath, "{broken");
  for (const source of ["startup", "clear", "compact", "resume"]) {
    const output = invoke(source);
    assert.match(output.systemMessage, /could not inspect/u);
    assert.equal(Object.hasOwn(output, "hookSpecificOutput"), false);
  }
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
  const quality = initialized.manifest.managed.filter((entry) => entry.path.startsWith(".dove/"));
  assert.deepEqual(quality.map((entry) => entry.path), [".dove/install/RESEARCH_QUALITY.md"]);
  const before = treeSnapshot(root);
  assert.equal(updateProjectIntegration(root, PACKAGE_OPTIONS).status, "unchanged");
  assert.deepEqual(treeSnapshot(root), before);
  const changed = updateProjectIntegration(root, { ...PACKAGE_OPTIONS, hosts: hosts.includes("claude") ? ["dsh"] : ["claude"] });
  assert.equal(changed.manifest.hosts.length, 1);
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
const unknownPaths = [".dove/install/unknown.bin", ".dove/install/DOCTOR.md", ".dove/manifest.json", "scripts/old-runtime.mjs"];
for (const relativePath of unknownPaths) writeFile(preservedRoot, relativePath, "preserve unknown bytes\n");
const preserved = unknownPaths.map((relativePath) => [relativePath, fs.readFileSync(path.join(preservedRoot, relativePath))]);
const qualityPath = ".dove/install/RESEARCH_QUALITY.md";
fs.appendFileSync(path.join(preservedRoot, qualityPath), "local edit\n");
const update = updateProjectIntegration(preservedRoot, PACKAGE_OPTIONS);
assert.deepEqual(update.replacedLocalEdits, [{ path: qualityPath, selector: null }]);
fs.appendFileSync(path.join(preservedRoot, qualityPath), "local edit\n");
const reinstall = previewProjectCompleteReinstall(preservedRoot, PACKAGE_OPTIONS);
assert.deepEqual(reinstall.removedPaths, []);
assert.deepEqual(reinstall.writtenPaths.sort(), [qualityPath, INSTALLATION_MANIFEST_PATH].sort());
completeReinstallProjectIntegration(preservedRoot, { ...PACKAGE_OPTIONS, preview: reinstall, confirmed: true });
for (const [relativePath, bytes] of preserved) assert.deepEqual(fs.readFileSync(path.join(preservedRoot, relativePath)), bytes);

const manifestPath = path.join(preservedRoot, INSTALLATION_MANIFEST_PATH);
const manifest = readJson(manifestPath);
for (const relativePath of [".dove/research/RESEARCH.md", ".dove/install/DOCTOR.md", ".dove/install/unknown.md", ".dove/install/manifest.json", ".dove/reviews/review.json", ".dove/runs/run.jsonl", ".dove", ".dove/install/RESEARCH_QUALITY.md/extra"]) {
  const invalid = structuredClone(manifest);
  invalid.managed.push({ path: relativePath, kind: "exclusive-file", selector: null, digest: "a".repeat(64) });
  assert.throws(() => validateProjectInstallationManifest(invalid, { hostIds: ["claude", "dsh"] }), /must not manage/u);
}
const fragmentQuality = structuredClone(manifest);
Object.assign(fragmentQuality.managed.find((entry) => entry.path === qualityPath), { kind: "json-fragment", selector: "/anything" });
assert.throws(() => validateProjectInstallationManifest(fragmentQuality, { hostIds: ["claude", "dsh"] }), /one exclusive file/u);
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
const prompt = { hooks: [{ type: "command", command: 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"', timeout: 10 }] };
settings.hooks.Stop = [stop];
settings.hooks.UserPromptSubmit = [prompt];
writeJson(settingsPath, settings);
before = treeSnapshot(retiredRoot);
const retiredDoctor = assertDoctorReadOnly(retiredRoot);
assert.equal(retiredDoctor.projectIntegration.state, "current");
assert.equal(retiredDoctor.projectIntegration.retiredHooks.matchedPaths.length, 2);
updateProjectIntegration(retiredRoot, PACKAGE_OPTIONS);
assert.deepEqual(treeSnapshot(retiredRoot), before);
const retiredManifestPath = path.join(retiredRoot, INSTALLATION_MANIFEST_PATH);
const retiredManifest = readJson(retiredManifestPath);
retiredManifest.managed.push({ path: ".claude/settings.json", kind: "json-fragment", selector: "/hooks/UserPromptSubmit[dove-user-prompt-submit]", digest: semanticDigest(prompt) });
writeJson(retiredManifestPath, retiredManifest);
updateProjectIntegration(retiredRoot, PACKAGE_OPTIONS);
assert.deepEqual(readJson(settingsPath).hooks.Stop, [stop]);
assert.equal(readJson(settingsPath).hooks.UserPromptSubmit, undefined);
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

console.log(JSON.stringify({ status: "passed", scratch: SCRATCH_ROOT, retainedFixtures: roots, sessionFactsCli: "bin/dove.mjs", checks: ["read-only SessionStart", "doctor/setup states", "explicit lifecycle", "opaque research bootstrap", "exact quality ownership", "legacy and unknown preservation"] }, null, 2));
