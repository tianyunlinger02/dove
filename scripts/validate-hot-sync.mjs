#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DOVE_CLAUDE_SESSION_START_HOOK_COMMAND,
  DOVE_CLAUDE_STATUS_LINE
} from "../src/core/ambient-policy.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import { PAPER_SEARCH_MCP_FRAGMENT, PAPER_SEARCH_MCP_SERVER_NAME } from "../src/core/paper-search-integration.mjs";
import { adoptProjectIntegration, initializeProjectIntegration, previewProjectAdoption, synchronizeProjectIntegrationOnly, updateProjectIntegration } from "../src/core/project-installation.mjs";
import { INSTALLATION_MANIFEST_PATH } from "../src/core/project-installation-manifest.mjs";
import { RESEARCH_DEFAULT_DIRECTORY_PATHS, RESEARCH_DEFAULT_DOCUMENTS } from "../src/core/research-defaults.mjs";
import {
  EXA_MCP_FRAGMENT,
  EXA_MCP_SERVER_NAME,
  WEB_FETCH_DENY_PERMISSION,
  WEB_FETCH_DENY_SELECTOR
} from "../src/core/web-access-integration.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH_ROOT = path.join(ROOT, ".dove-dev", "tmp");
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
  const root = fs.mkdtempSync(path.join(SCRATCH_ROOT, "dove-hot-sync-"));
  fs.mkdirSync(path.join(root, ".git"));
  initializeProjectIntegration(root, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, now: "2026-08-22T00:00:00.000Z" });
  return root;
}

function writeFile(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function makeAdoptableProject() {
  const root = fs.mkdtempSync(path.join(SCRATCH_ROOT, "dove-adopt-"));
  fs.mkdirSync(path.join(root, ".git"));
  fs.mkdirSync(path.join(root, ".dove"), { recursive: true });
  writeJson(path.join(root, ".dove", "manifest.json"), {
    schemaVersion: 9,
    manifestVersion: 1,
    workspaceId: "workspace-validation",
    createdAt: "2026-07-17T10:56:07.603Z",
    packageVersion: "0.4.0"
  });
  for (const relativePath of RESEARCH_DEFAULT_DIRECTORY_PATHS) fs.mkdirSync(path.join(root, relativePath), { recursive: true });
  for (const document of RESEARCH_DEFAULT_DOCUMENTS) writeFile(root, document.path, document.content);
  return root;
}

function fileSnapshot(root, relativeRoots = ["."]) {
  const files = new Map();
  const visit = (relativePath) => {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) return;
    const stat = fs.lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
      files.set(relativePath, Buffer.from(`symlink:${fs.readlinkSync(absolutePath)}`, "utf8"));
      return;
    }
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(absolutePath).map(String).sort()) {
        visit(relativePath === "." ? child : path.posix.join(relativePath, child));
      }
      return;
    }
    if (stat.isFile()) files.set(relativePath, fs.readFileSync(absolutePath));
  };
  for (const relativeRoot of relativeRoots) visit(relativeRoot);
  return files;
}

function researchSnapshot(root) {
  return fileSnapshot(root, [".dove/research", ".dove/reviews", ".dove/runs"]);
}

function assertSnapshotUnchanged(root, before, label = "snapshot", relativeRoots = ["."]) {
  const after = fileSnapshot(root, relativeRoots);
  assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort(), `${label} file set changed`);
  for (const [relativePath, bytes] of before.entries()) assert.deepEqual(after.get(relativePath), bytes, `${relativePath} changed during ${label}`);
}

function assertResearchSnapshotUnchanged(root, before, label = "research/review/run snapshot") {
  assertSnapshotUnchanged(root, before, label, [".dove/research", ".dove/reviews", ".dove/runs"]);
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
  assert.equal(sameVersion.projectIntegration.state, "needs-sync", "same package version must not suppress managed resource differences");
  assert.equal(sameVersion.projectIntegration.syncPaths.includes(resourcePath), true);
  assert.deepEqual(sameVersion.projectIntegration.skippedLocalEdits, []);
  assert.match(sameVersion.human, /需要更新.*待同步路径/u);

  writeFile(root, resourcePath, `${oldContent}User modification.\n`);
  const locallyEdited = assertDoctorReadOnly(root, cliPath);
  assert.equal(locallyEdited.projectIntegration.state, "needs-sync");
  assert.deepEqual(locallyEdited.projectIntegration.skippedLocalEdits, [{ path: resourcePath, selector: null }]);
  assert.deepEqual(locallyEdited.projectIntegration.replacedLocalEdits, []);
  assert.equal(locallyEdited.projectIntegration.syncPaths.includes(resourcePath), false);
  assert.match(locallyEdited.human, /本地编辑.*SessionStart 跳过/u);

  writeFile(root, resourcePath, original);
  const staleManifest = assertDoctorReadOnly(root, cliPath);
  assert.equal(staleManifest.projectIntegration.state, "needs-sync", "canonical disk bytes do not make stale managed manifest entries current");
  assert.deepEqual(staleManifest.projectIntegration.syncPaths, [INSTALLATION_MANIFEST_PATH]);
  assert.deepEqual(staleManifest.projectIntegration.skippedLocalEdits, []);
  writeJson(manifestPath, manifest);
}

function validateDoctorRetiredHooks(root, cliPath) {
  const settingsPath = path.join(root, ".claude/settings.json");
  const manifestPath = path.join(root, INSTALLATION_MANIFEST_PATH);
  const settings = readJson(settingsPath);
  const manifest = readJson(manifestPath);
  const exactStop = { hooks: [{ type: "command", command: 'dove hook stop --project "$CLAUDE_PROJECT_DIR"', timeout: 10 }] };
  const exactPrompt = { hooks: [{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR/scripts/dove-user-prompt-submit-package.mjs"', timeout: 10 }] };
  const customStop = { hooks: [{ ...exactStop.hooks[0], timeout: 11 }] };
  const customPrompt = { hooks: [{ ...exactPrompt.hooks[0], command: `${exactPrompt.hooks[0].command} && user-local-edit` }] };
  const withMatcher = { ...exactStop, matcher: "" };
  const withExtraHook = { hooks: [...exactPrompt.hooks, { type: "command", command: "user-owned-hook" }] };
  const oldSettings = structuredClone(settings);
  oldSettings.hooks.Stop = [customStop, exactStop, withMatcher];
  oldSettings.hooks.UserPromptSubmit = [exactPrompt, customPrompt, withExtraHook];
  const oldManifest = structuredClone(manifest);
  oldManifest.managed.push({
    path: ".claude/settings.json", kind: "json-fragment",
    selector: "/hooks/UserPromptSubmit[dove-user-prompt-submit]", digest: semanticDigest(exactPrompt)
  });
  writeJson(settingsPath, oldSettings);
  writeJson(manifestPath, oldManifest);
  const exact = assertDoctorReadOnly(root, cliPath);
  assert.equal(exact.projectIntegration.state, "needs-sync");
  assert.deepEqual(exact.projectIntegration.retiredHooks, {
    matchedPaths: [".claude/settings.json#/hooks/Stop/1", ".claude/settings.json#/hooks/UserPromptSubmit/0"]
  });
  synchronizeProjectIntegrationOnly(root, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  const after = readJson(settingsPath);
  assert.deepEqual(after.hooks.Stop, [customStop, withMatcher]);
  assert.deepEqual(after.hooks.UserPromptSubmit, [customPrompt, withExtraHook]);
  const preserved = assertDoctorReadOnly(root, cliPath);
  assert.deepEqual(preserved.projectIntegration.retiredHooks, { matchedPaths: [] });

  const nonArray = structuredClone(settings);
  nonArray.hooks.Stop = customStop;
  nonArray.hooks.UserPromptSubmit = "user-owned-prompt";
  writeJson(settingsPath, nonArray);
  writeJson(manifestPath, oldManifest);
  const nonArrayResult = assertDoctorReadOnly(root, cliPath);
  assert.deepEqual(nonArrayResult.projectIntegration.retiredHooks, { matchedPaths: [] });

  const unowned = structuredClone(settings);
  unowned.hooks.UserPromptSubmit = [exactPrompt];
  writeJson(settingsPath, unowned);
  writeJson(manifestPath, manifest);
  const unownedResult = assertDoctorReadOnly(root, cliPath);
  assert.equal(unownedResult.projectIntegration.state, "current", "managed resource currentness is separate from unowned residual hooks");
  assert.deepEqual(unownedResult.projectIntegration.retiredHooks.matchedPaths, [".claude/settings.json#/hooks/UserPromptSubmit/0"]);
  assert.deepEqual(unownedResult.actions, [{ kind: "inspect", command: "dove doctor --json" }]);
  const beforeSync = treeSnapshot(root);
  synchronizeProjectIntegrationOnly(root, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  assert.deepEqual(treeSnapshot(root), beforeSync, "diagnostic recognition must not grant ownership to delete an unowned prompt hook");
  writeJson(settingsPath, settings);
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
  fs.rmSync(path.join(root, ".dove/research"), { recursive: true });
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
    assert.match(output.systemMessage, /local edits.*dove update/u);
    assert.equal(Object.hasOwn(output, "hookSpecificOutput"), source === "compact" || source === "resume");
  }
  const manifestPath = path.join(root, INSTALLATION_MANIFEST_PATH);
  const manifest = readJson(manifestPath);
  writeJson(manifestPath, { ...manifest, package: { ...manifest.package, version: "99.0.0" } });
  for (const source of ["startup", "clear", "compact", "resume"]) {
    const output = invoke(source);
    assert.match(output.systemMessage, /did not synchronize.*(?:refuses|拒绝)/u);
    assert.equal(Object.hasOwn(output, "hookSpecificOutput"), false, "Do not read facts after an unsafe sync failure.");
  }
  writeJson(manifestPath, manifest);
  const settingsPath = path.join(root, ".claude/settings.json");
  const settings = fs.readFileSync(settingsPath);
  fs.writeFileSync(settingsPath, "{broken");
  for (const source of ["startup", "clear", "compact", "resume"]) {
    const output = invoke(source);
    assert.match(output.systemMessage, /did not synchronize/u);
    assert.equal(Object.hasOwn(output, "hookSpecificOutput"), false);
  }
  fs.writeFileSync(settingsPath, settings);
  const malformedEvent = invoke("compact", { hook_event_name: "OtherEvent" });
  assert.match(malformedEvent.systemMessage, /unsupported or missing hook event/u);
  assert.equal(Object.hasOwn(malformedEvent, "hookSpecificOutput"), false);
  assert.match(invoke("compact", {}, "{broken").systemMessage, /malformed JSON/u);
}

const roots = [];
try {
  const bridgeRoot = makeProject();
  roots.push(bridgeRoot);
  const settingsPath = path.join(bridgeRoot, ".claude", "settings.json");
  const manifestPath = path.join(bridgeRoot, INSTALLATION_MANIFEST_PATH);
  const initializedMcp = readJson(path.join(bridgeRoot, ".mcp.json"));
  assert.deepEqual(initializedMcp.mcpServers[PAPER_SEARCH_MCP_SERVER_NAME], PAPER_SEARCH_MCP_FRAGMENT);
  assert.deepEqual(initializedMcp.mcpServers[EXA_MCP_SERVER_NAME], EXA_MCP_FRAGMENT);
  const researchPath = path.join(bridgeRoot, ".dove", "research", "RESEARCH.md");
  const customResearchPath = path.join(bridgeRoot, ".dove", "research", "claims", "custom.md");
  const retiredResearchPath = path.join(bridgeRoot, ".dove", "research", "LESSONS.md");

  const initializedSettings = readJson(settingsPath);
  assert.deepEqual(Object.keys(initializedSettings.hooks).sort(), ["SessionStart"]);
  assert.equal(Object.hasOwn(initializedSettings, "statusLine"), false);
  assert.equal(initializedSettings.permissions.deny.includes(WEB_FETCH_DENY_PERMISSION), true);

  fs.writeFileSync(researchPath, "# Researcher-owned mainline\n\nDo not rewrite.\n");
  fs.mkdirSync(path.dirname(customResearchPath), { recursive: true });
  fs.writeFileSync(customResearchPath, "custom evidence\n");
  fs.writeFileSync(retiredResearchPath, "retired but researcher-visible\n");
  const reviewRecordPath = path.join(bridgeRoot, ".dove", "reviews", "hot-sync-preserve", "review.json");
  fs.mkdirSync(path.dirname(reviewRecordPath), { recursive: true });
  fs.writeFileSync(reviewRecordPath, "{\"schema\":\"preserve-review\"}\n");
  const runReceiptPath = path.join(bridgeRoot, ".dove", "runs", "hot-sync-preserve", "run.jsonl");
  fs.mkdirSync(path.dirname(runReceiptPath), { recursive: true });
  fs.writeFileSync(runReceiptPath, "{\"schemaVersion\":\"dove.run.event.v1\",\"seq\":1,\"at\":\"2026-09-02T00:00:00.000Z\",\"type\":\"run.started\",\"runId\":\"hot-sync-preserve\"}\n");
  const protectedBefore = researchSnapshot(bridgeRoot);

  const oldSettings = readJson(settingsPath);
  oldSettings.hooks.UserPromptSubmit = [
    { hooks: [{ type: "command", command: 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"', timeout: 10 }] },
    { hooks: [{ type: "command", command: "user-owned-prompt", timeout: 5 }] }
  ];
  oldSettings.hooks.SessionStart.push({ hooks: [{ type: "command", command: "user-owned-session-start", timeout: 5 }] });
  writeJson(settingsPath, oldSettings);
  const oldManifest = readJson(manifestPath);
  oldManifest.package.version = "2.9.0";
  oldManifest.managed.push({
    path: ".claude/settings.json",
    kind: "json-fragment",
    selector: "/hooks/UserPromptSubmit[dove-user-prompt-submit]",
    digest: semanticDigest(oldSettings.hooks.UserPromptSubmit[0])
  });
  writeJson(manifestPath, oldManifest);
  const promptHookBeforeSessionStart = fileSnapshot(bridgeRoot);

  const retiredPromptHook = cliHook(bridgeRoot, "user-prompt-submit", {
    hook_event_name: "UserPromptSubmit",
    cwd: bridgeRoot,
    prompt: "继续"
  });
  assert.notEqual(retiredPromptHook.status, 0);
  assertSnapshotUnchanged(bridgeRoot, promptHookBeforeSessionStart, "retired UserPromptSubmit CLI path");
  assertResearchSnapshotUnchanged(bridgeRoot, protectedBefore, "retired UserPromptSubmit protected state");
  assert.equal(readJson(manifestPath).package.version, "2.9.0");

  const session = cliHook(bridgeRoot, "session-start", { hook_event_name: "SessionStart", cwd: bridgeRoot });
  assert.equal(session.status, 0, session.stderr || session.stdout);
  assert.equal(session.stdout, "");
  const bridgedSettings = readJson(settingsPath);
  assert.equal(bridgedSettings.hooks.SessionStart.some((entry) => entry.hooks?.some((hook) => hook.command === 'dove hook session-start --project "$CLAUDE_PROJECT_DIR"')), true);
  assert.equal(bridgedSettings.hooks.SessionStart.some((entry) => entry.hooks?.some((hook) => hook.command === "user-owned-session-start")), true);
  assert.equal(bridgedSettings.hooks.UserPromptSubmit.some((entry) => entry.hooks?.some((hook) => hook.command === "user-owned-prompt")), true);
  assert.equal(bridgedSettings.hooks.UserPromptSubmit.some((entry) => entry.hooks?.some((hook) => hook.command === 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"')), false);
  assert.equal(readJson(manifestPath).package.version, PACKAGE_VERSION);
  assert.equal(readJson(manifestPath).managed.some((entry) => entry.selector === "/hooks/SessionStart[dove-session-start]"), true);
  assert.equal(readJson(manifestPath).managed.some((entry) => entry.selector === "/hooks/UserPromptSubmit[dove-user-prompt-submit]"), false);
  assert.equal(readJson(manifestPath).managed.some((entry) => entry.selector === "/statusLine[dove-project-directory]"), false);
  assertResearchSnapshotUnchanged(bridgeRoot, protectedBefore, "SessionStart protected state");

  const statusLineReleaseRoot = makeProject();
  roots.push(statusLineReleaseRoot);
  const statusLineReleaseSettingsPath = path.join(statusLineReleaseRoot, ".claude", "settings.json");
  const statusLineReleaseSettings = readJson(statusLineReleaseSettingsPath);
  statusLineReleaseSettings.statusLine = DOVE_CLAUDE_STATUS_LINE;
  writeJson(statusLineReleaseSettingsPath, statusLineReleaseSettings);
  const statusLineReleaseManifestPath = path.join(statusLineReleaseRoot, INSTALLATION_MANIFEST_PATH);
  const statusLineReleaseManifest = readJson(statusLineReleaseManifestPath);
  statusLineReleaseManifest.managed.push({
    path: ".claude/settings.json",
    kind: "json-fragment",
    selector: "/statusLine[dove-project-directory]",
    digest: semanticDigest(DOVE_CLAUDE_STATUS_LINE)
  });
  writeJson(statusLineReleaseManifestPath, statusLineReleaseManifest);
  const statusLineReleased = updateProjectIntegration(statusLineReleaseRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  assert.equal(statusLineReleased.replacedLocalEdits.length, 0);
  assert.equal(Object.hasOwn(readJson(statusLineReleaseSettingsPath), "statusLine"), false);
  assert.equal(readJson(statusLineReleaseManifestPath).managed.some((entry) => entry.selector === "/statusLine[dove-project-directory]"), false);

  const userStatusLineReleaseRoot = makeProject();
  roots.push(userStatusLineReleaseRoot);
  const userStatusLineSettingsPath = path.join(userStatusLineReleaseRoot, ".claude", "settings.json");
  const userStatusLineSettings = readJson(userStatusLineSettingsPath);
  userStatusLineSettings.statusLine = { type: "command", command: "user-statusline" };
  writeJson(userStatusLineSettingsPath, userStatusLineSettings);
  const userStatusLineManifestPath = path.join(userStatusLineReleaseRoot, INSTALLATION_MANIFEST_PATH);
  const userStatusLineManifest = readJson(userStatusLineManifestPath);
  userStatusLineManifest.managed.push({
    path: ".claude/settings.json",
    kind: "json-fragment",
    selector: "/statusLine[dove-project-directory]",
    digest: semanticDigest(DOVE_CLAUDE_STATUS_LINE)
  });
  writeJson(userStatusLineManifestPath, userStatusLineManifest);
  updateProjectIntegration(userStatusLineReleaseRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  assert.deepEqual(readJson(userStatusLineSettingsPath).statusLine, { type: "command", command: "user-statusline" });
  assert.equal(readJson(userStatusLineManifestPath).managed.some((entry) => entry.selector === "/statusLine[dove-project-directory]"), false);

  const dshRoot = fs.mkdtempSync(path.join(SCRATCH_ROOT, "dove-dsh-"));
  roots.push(dshRoot);
  fs.mkdirSync(path.join(dshRoot, ".git"));
  initializeProjectIntegration(dshRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["dsh"] });
  assert.equal(fs.existsSync(path.join(dshRoot, ".claude", "settings.json")), false);
  assert.equal(fs.existsSync(path.join(dshRoot, ".mcp.json")), false);

  const allHostRoot = fs.mkdtempSync(path.join(SCRATCH_ROOT, "dove-host-all-"));
  roots.push(allHostRoot);
  fs.mkdirSync(path.join(allHostRoot, ".git"));
  const allHost = cliDove(["init", "--project", allHostRoot, "--host", "all", "--json"]);
  assert.notEqual(allHost.status, 0);
  assert.match(allHost.stderr, /--host 只接受 claude 或 dsh|'all' is not supported|host selection accepts only claude or dsh/iu);
  assert.equal(fs.existsSync(path.join(allHostRoot, INSTALLATION_MANIFEST_PATH)), false);

  const absentResearchRoot = makeProject();
  roots.push(absentResearchRoot);
  fs.rmSync(path.join(absentResearchRoot, ".dove", "research"), { recursive: true });
  synchronizeProjectIntegrationOnly(absentResearchRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  assert.equal(fs.existsSync(path.join(absentResearchRoot, ".dove", "research")), false);

  const driftRoot = makeProject();
  roots.push(driftRoot);
  const driftResearch = path.join(driftRoot, ".claude", "commands", "dove", "research.md");
  const driftBefore = fs.readFileSync(driftResearch, "utf8");
  fs.appendFileSync(driftResearch, "drift\n");
  const partialSync = synchronizeProjectIntegrationOnly(driftRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  assert.equal(partialSync.status, "unchanged");
  assert.deepEqual(partialSync.skippedLocalEdits, [{ path: ".claude/commands/dove/research.md", selector: null }]);
  assert.equal(fs.readFileSync(driftResearch, "utf8"), `${driftBefore}drift\n`);
  const partialHook = cliHook(driftRoot, "session-start", { hook_event_name: "SessionStart", cwd: driftRoot });
  assert.equal(partialHook.status, 0, partialHook.stderr || partialHook.stdout);
  assert.match(JSON.parse(partialHook.stdout).systemMessage, /skipped|local edits|dove update/iu);
  const replaced = updateProjectIntegration(driftRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  assert.deepEqual(replaced.replacedLocalEdits, [{ path: ".claude/commands/dove/research.md", selector: null }]);
  assert.equal(fs.readFileSync(driftResearch, "utf8"), driftBefore);
  fs.appendFileSync(driftResearch, "drift-again\n");
  const replacedHuman = cliDove(["update", "--project", driftRoot]);
  assert.equal(replacedHuman.status, 0, replacedHuman.stderr || replacedHuman.stdout);
  assert.match(replacedHuman.stdout, /已覆盖 1 个 manifest-owned 本地编辑/iu);
  assert.match(replacedHuman.stdout, /\.claude\/commands\/dove\/research\.md/u);
  assert.equal(fs.readFileSync(driftResearch, "utf8"), driftBefore);

  const jsonDriftRoot = makeProject();
  roots.push(jsonDriftRoot);
  const jsonDriftSettingsPath = path.join(jsonDriftRoot, ".claude", "settings.json");
  const jsonDriftSettings = readJson(jsonDriftSettingsPath);
  jsonDriftSettings.hooks.UserPromptSubmit = [{ hooks: [{ type: "command", command: 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR" && user-local-edit', timeout: 10 }] }];
  delete jsonDriftSettings.hooks.SessionStart;
  writeJson(jsonDriftSettingsPath, jsonDriftSettings);
  const jsonDriftPartial = synchronizeProjectIntegrationOnly(jsonDriftRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  assert.deepEqual(jsonDriftPartial.skippedLocalEdits, []);
  const jsonDriftAfter = readJson(jsonDriftSettingsPath);
  assert.equal(jsonDriftAfter.hooks.UserPromptSubmit[0].hooks[0].command.endsWith("user-local-edit"), true);
  assert.equal(jsonDriftAfter.hooks.SessionStart.some((entry) => entry.hooks?.some((hook) => hook.command === DOVE_CLAUDE_SESSION_START_HOOK_COMMAND)), true);

  const newerRoot = makeProject();
  roots.push(newerRoot);
  const newerManifestPath = path.join(newerRoot, INSTALLATION_MANIFEST_PATH);
  const newerManifest = readJson(newerManifestPath);
  newerManifest.package.version = "99.0.0";
  writeJson(newerManifestPath, newerManifest);
  assert.throws(
    () => synchronizeProjectIntegrationOnly(newerRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }),
    /SessionStart sync refuses/iu
  );
  const newerHook = cliHook(newerRoot, "session-start", { hook_event_name: "SessionStart", cwd: newerRoot });
  assert.equal(newerHook.status, 0, "Unsafe sync must report through host-consumed hook JSON.");
  assert.match(JSON.parse(newerHook.stdout).systemMessage, /did not synchronize|refuses/iu);

  const mismatchRoot = makeProject();
  roots.push(mismatchRoot);
  const mismatchManifestPath = path.join(mismatchRoot, INSTALLATION_MANIFEST_PATH);
  const mismatchManifest = readJson(mismatchManifestPath);
  mismatchManifest.package.name = "not-dove";
  writeJson(mismatchManifestPath, mismatchManifest);
  assert.throws(
    () => synchronizeProjectIntegrationOnly(mismatchRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }),
    /SessionStart sync refuses/iu
  );
  const mismatchHook = cliHook(mismatchRoot, "session-start", { hook_event_name: "SessionStart", cwd: mismatchRoot });
  assert.equal(mismatchHook.status, 0, "Unsafe sync must report through host-consumed hook JSON.");
  assert.match(JSON.parse(mismatchHook.stdout).systemMessage, /did not synchronize|refuses/iu);

  const combinedHookRoot = makeProject();
  roots.push(combinedHookRoot);
  const combinedSettingsPath = path.join(combinedHookRoot, ".claude", "settings.json");
  const combinedSettings = readJson(combinedSettingsPath);
  combinedSettings.hooks.UserPromptSubmit = [
    { hooks: [{ type: "command", command: 'dove hook user-prompt-submit --project "$CLAUDE_PROJECT_DIR"', timeout: 10 }] },
    { hooks: [{ type: "command", command: "user-owned-prompt", timeout: 5 }] }
  ];
  combinedSettings.hooks.SessionStart.push({ hooks: [{ type: "command", command: "user-owned-session-start", timeout: 5 }] });
  combinedSettings.hooks.Stop = [{ hooks: [{ type: "command", command: 'dove hook stop --project "$CLAUDE_PROJECT_DIR"', timeout: 10 }] }];
  writeJson(combinedSettingsPath, combinedSettings);
  const combinedManifestPath = path.join(combinedHookRoot, INSTALLATION_MANIFEST_PATH);
  const combinedManifest = readJson(combinedManifestPath);
  const sessionStartIndex = combinedManifest.managed.findIndex((entry) => entry.selector === "/hooks/SessionStart[dove-session-start]");
  assert.notEqual(sessionStartIndex, -1);
  combinedManifest.managed.splice(sessionStartIndex, 1);
  combinedManifest.managed.push({
    path: ".claude/settings.json",
    kind: "json-fragment",
    selector: "/hooks/UserPromptSubmit[dove-user-prompt-submit]",
    digest: semanticDigest({
      UserPromptSubmit: combinedSettings.hooks.UserPromptSubmit[0],
      SessionStart: combinedSettings.hooks.SessionStart.find((entry) => entry.hooks?.some((hook) => hook.command === DOVE_CLAUDE_SESSION_START_HOOK_COMMAND))
    })
  });
  writeJson(combinedManifestPath, combinedManifest);
  const combinedDoctor = assertDoctorReadOnly(combinedHookRoot);
  assert.deepEqual(combinedDoctor.projectIntegration.retiredHooks.matchedPaths, [
    ".claude/settings.json#/hooks/Stop/0", ".claude/settings.json#/hooks/UserPromptSubmit/0"
  ]);
  synchronizeProjectIntegrationOnly(combinedHookRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  const combinedAfter = readJson(combinedSettingsPath);
  assert.equal(combinedAfter.hooks.UserPromptSubmit.length, 1);
  assert.equal(combinedAfter.hooks.UserPromptSubmit[0].hooks[0].command, "user-owned-prompt");
  assert.equal(combinedAfter.hooks.SessionStart.some((entry) => entry.hooks?.some((hook) => hook.command === DOVE_CLAUDE_SESSION_START_HOOK_COMMAND)), true);
  assert.equal(combinedAfter.hooks.SessionStart.some((entry) => entry.hooks?.some((hook) => hook.command === "user-owned-session-start")), true);
  assert.equal(Object.hasOwn(combinedAfter.hooks, "Stop"), false);
  const combinedManagedSelectors = readJson(combinedManifestPath).managed.filter((entry) => entry.path === ".claude/settings.json").map((entry) => entry.selector);
  assert.equal(combinedManagedSelectors.includes("/hooks/SessionStart[dove-session-start]"), true);
  assert.equal(combinedManagedSelectors.includes("/hooks/UserPromptSubmit[dove-user-prompt-submit]"), false);

  const stopRoot = makeProject();
  roots.push(stopRoot);
  const stopSettingsPath = path.join(stopRoot, ".claude", "settings.json");
  const oldStopSettings = readJson(stopSettingsPath);
  oldStopSettings.hooks.Stop = [
    { hooks: [{ type: "command", command: "user-owned-stop", timeout: 5 }] },
    { hooks: [{ type: "command", command: 'dove hook stop --project "$CLAUDE_PROJECT_DIR"', timeout: 10 }] }
  ];
  writeJson(stopSettingsPath, oldStopSettings);
  const stopManifest = readJson(path.join(stopRoot, INSTALLATION_MANIFEST_PATH));
  stopManifest.package.version = "2.9.0";
  stopManifest.managed.find((entry) => entry.selector === "/hooks/SessionStart[dove-session-start]").digest = semanticDigest(oldStopSettings.hooks.SessionStart.find((entry) => entry.hooks?.some((hook) => hook.command?.includes("dove hook session-start"))));
  writeJson(path.join(stopRoot, INSTALLATION_MANIFEST_PATH), stopManifest);
  const oldVersionDoctor = assertDoctorReadOnly(stopRoot);
  assert.equal(oldVersionDoctor.projectIntegration.manifest.package.version, "2.9.0");
  assert.deepEqual(oldVersionDoctor.projectIntegration.retiredHooks.matchedPaths, [".claude/settings.json#/hooks/Stop/1"]);
  synchronizeProjectIntegrationOnly(stopRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  const cleanedStopSettings = readJson(stopSettingsPath);
  assert.equal(cleanedStopSettings.hooks.Stop.length, 1);
  assert.equal(cleanedStopSettings.hooks.Stop[0].hooks[0].command, "user-owned-stop");

  const nonArrayStopRoot = makeProject();
  roots.push(nonArrayStopRoot);
  const nonArrayStopSettingsPath = path.join(nonArrayStopRoot, ".claude", "settings.json");
  const nonArrayStopSettings = readJson(nonArrayStopSettingsPath);
  nonArrayStopSettings.hooks.Stop = "user-owned-stop";
  writeJson(nonArrayStopSettingsPath, nonArrayStopSettings);
  const nonArrayBefore = fs.readFileSync(nonArrayStopSettingsPath);
  synchronizeProjectIntegrationOnly(nonArrayStopRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  assert.deepEqual(fs.readFileSync(nonArrayStopSettingsPath), nonArrayBefore);

  const userStopRoot = makeProject();
  roots.push(userStopRoot);
  const userStopSettingsPath = path.join(userStopRoot, ".claude", "settings.json");
  const userStopSettings = readJson(userStopSettingsPath);
  userStopSettings.hooks.Stop = [{ hooks: [{ type: "command", command: "user-owned-stop", timeout: 10 }] }];
  writeJson(userStopSettingsPath, userStopSettings);
  const userStopBefore = fs.readFileSync(userStopSettingsPath);
  synchronizeProjectIntegrationOnly(userStopRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  assert.deepEqual(fs.readFileSync(userStopSettingsPath), userStopBefore);

  const stopCli = cliHook(userStopRoot, "stop", {
    hook_event_name: "Stop",
    cwd: userStopRoot,
    stop_hook_active: false,
    last_assistant_message: "internal phrasing"
  });
  assert.notEqual(stopCli.status, 0);
  assert.match(stopCli.stderr, /hook 只接受这些子命令：session-start(?:，或| 或) statusline|accepts only session-start, or statusline/iu);

  const adoptionRoot = makeAdoptableProject();
  roots.push(adoptionRoot);
  writeFile(adoptionRoot, ".dove/install/DOCTOR.md", "# Doctor notes\n\nKeep this.\n");
  writeFile(adoptionRoot, ".dove/private/state.json", "{\"private\":true}\n");
  writeFile(adoptionRoot, ".dove-archive/old.md", "archived legacy state\n");
  writeFile(adoptionRoot, ".dove/research/RESEARCH.md", "# Researcher mainline\n\nPreserve exactly.\n");
  writeFile(adoptionRoot, ".dove/research/lessons/project-owned.md", "project-owned lesson\n");
  writeFile(adoptionRoot, ".dove/reviews/review-preserve/review.json", "{\"schema\":\"preserve-review\"}\n");
  writeFile(adoptionRoot, ".dove/runs/run-preserve/run.jsonl", "{\"schemaVersion\":\"dove.run.event.v1\",\"seq\":1,\"at\":\"2026-09-02T00:00:00.000Z\",\"type\":\"run.started\",\"runId\":\"run-preserve\"}\n");
  writeJson(path.join(adoptionRoot, ".mcp.json"), {
    mcpServers: {
      userServer: { type: "stdio", command: "user-server" }
    }
  });
  writeJson(path.join(adoptionRoot, ".claude", "settings.json"), {
    permissions: { deny: [WEB_FETCH_DENY_PERMISSION] },
    statusLine: DOVE_CLAUDE_STATUS_LINE,
    hooks: {
      OtherEvent: [{ hooks: [{ type: "command", command: "user-owned-other", timeout: 5 }] }]
    }
  });
  const adoptionBefore = researchSnapshot(adoptionRoot);
  const adoptionPreview = previewProjectAdoption(adoptionRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, now: "2026-08-22T00:00:01.000Z" });
  assert.equal(adoptionPreview.action, "adopt");
  assert.equal(adoptionPreview.confirmation.required, false);
  assert.equal(adoptionPreview.writtenPaths.includes(INSTALLATION_MANIFEST_PATH), true);
  assert.equal(adoptionPreview.changedPaths.some((relativePath) => relativePath.startsWith(".dove/research/")), false);
  assert.equal(adoptionPreview.removedPaths.length, 0);
  const adoptedCli = cliDove(["update", "--project", adoptionRoot, "--json"]);
  assert.equal(adoptedCli.status, 0, adoptedCli.stderr || adoptedCli.stdout);
  const adopted = JSON.parse(adoptedCli.stdout);
  assert.equal(adopted.status, "adopted");
  assert.equal(adopted.writtenPaths.includes(INSTALLATION_MANIFEST_PATH), true);
  assert.equal(adopted.changedPaths.some((relativePath) => relativePath.startsWith(".dove/research/")), false);
  assertResearchSnapshotUnchanged(adoptionRoot, adoptionBefore, "adoption preservation");
  const adoptionManifest = readJson(path.join(adoptionRoot, INSTALLATION_MANIFEST_PATH));
  assert.equal(adoptionManifest.revision, "2.0");
  assert.equal(adoptionManifest.package.name, PACKAGE_NAME);
  assert.equal(adoptionManifest.package.version, PACKAGE_VERSION);
  assert.deepEqual(adoptionManifest.hosts, ["claude"]);
  assert.equal(adoptionManifest.managed.some((entry) => entry.selector === WEB_FETCH_DENY_SELECTOR), false);
  const adoptedSettings = readJson(path.join(adoptionRoot, ".claude", "settings.json"));
  assert.equal(adoptedSettings.hooks.OtherEvent.some((entry) => entry.hooks?.some((hook) => hook.command === "user-owned-other")), true);
  assert.equal(Object.hasOwn(adoptedSettings.hooks, "UserPromptSubmit"), false);
  assert.equal(adoptedSettings.hooks.SessionStart.some((entry) => entry.hooks?.some((hook) => hook.command === DOVE_CLAUDE_SESSION_START_HOOK_COMMAND)), true);
  assert.equal(adoptedSettings.permissions.deny.includes(WEB_FETCH_DENY_PERMISSION), true);
  assert.deepEqual(adoptedSettings.statusLine, DOVE_CLAUDE_STATUS_LINE);
  assert.equal(adoptionManifest.managed.some((entry) => entry.selector === "/statusLine[dove-project-directory]"), false);
  assert.equal(Object.hasOwn(adoptedSettings.hooks, "Stop"), false);
  const adoptedMcp = readJson(path.join(adoptionRoot, ".mcp.json"));
  assert.equal(adoptedMcp.mcpServers.userServer.command, "user-server");
  assert.deepEqual(adoptedMcp.mcpServers[PAPER_SEARCH_MCP_SERVER_NAME], PAPER_SEARCH_MCP_FRAGMENT);
  assert.deepEqual(adoptedMcp.mcpServers[EXA_MCP_SERVER_NAME], EXA_MCP_FRAGMENT);
  const unchangedAdoption = synchronizeProjectIntegrationOnly(adoptionRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  assert.equal(unchangedAdoption.status, "unchanged");

  const invalidAdoptionRoot = fs.mkdtempSync(path.join(SCRATCH_ROOT, "dove-invalid-adopt-"));
  roots.push(invalidAdoptionRoot);
  fs.mkdirSync(path.join(invalidAdoptionRoot, ".git"));
  fs.mkdirSync(path.join(invalidAdoptionRoot, ".dove"), { recursive: true });
  writeJson(path.join(invalidAdoptionRoot, ".dove", "manifest.json"), { legacyWorkspace: true });
  for (const relativePath of RESEARCH_DEFAULT_DIRECTORY_PATHS) fs.mkdirSync(path.join(invalidAdoptionRoot, relativePath), { recursive: true });
  for (const document of RESEARCH_DEFAULT_DOCUMENTS) writeFile(invalidAdoptionRoot, document.path, document.content);
  assert.throws(
    () => previewProjectAdoption(invalidAdoptionRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }),
    /legacy workspace marker/iu
  );

  const hookAdoptionRoot = makeAdoptableProject();
  roots.push(hookAdoptionRoot);
  const hookAdoption = cliHook(hookAdoptionRoot, "user-prompt-submit", {
    hook_event_name: "UserPromptSubmit",
    cwd: hookAdoptionRoot,
    prompt: "research this"
  });
  assert.notEqual(hookAdoption.status, 0);
  assert.match(hookAdoption.stderr, /hook 只接受这些子命令：session-start(?:，或| 或) statusline/iu);
  assert.equal(fs.existsSync(path.join(hookAdoptionRoot, INSTALLATION_MANIFEST_PATH)), false);

  const exclusiveDriftAdoptionRoot = makeAdoptableProject();
  roots.push(exclusiveDriftAdoptionRoot);
  writeFile(exclusiveDriftAdoptionRoot, ".claude/commands/dove/research.md", "user-owned research command\n");
  assert.throws(
    () => adoptProjectIntegration(exclusiveDriftAdoptionRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }),
    /cannot claim conflicting content/iu
  );
  assert.equal(fs.existsSync(path.join(exclusiveDriftAdoptionRoot, INSTALLATION_MANIFEST_PATH)), false);

  const hookDriftAdoptionRoot = makeAdoptableProject();
  roots.push(hookDriftAdoptionRoot);
  writeJson(path.join(hookDriftAdoptionRoot, ".claude", "settings.json"), {
    hooks: {
      UserPromptSubmit: [{ hooks: [{ type: "command", command: "dove hook user-prompt-submit --project somewhere-else", timeout: 10 }] }]
    }
  });
  const promptHookAdoptionPreview = previewProjectAdoption(hookDriftAdoptionRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION });
  assert.equal(promptHookAdoptionPreview.writtenPaths.includes(".claude/settings.json"), true);
  assert.equal(fs.existsSync(path.join(hookDriftAdoptionRoot, INSTALLATION_MANIFEST_PATH)), false);

  const mcpDriftAdoptionRoot = makeAdoptableProject();
  roots.push(mcpDriftAdoptionRoot);
  writeJson(path.join(mcpDriftAdoptionRoot, ".mcp.json"), {
    mcpServers: {
      [PAPER_SEARCH_MCP_SERVER_NAME]: { type: "stdio", command: "other-paper-search" }
    }
  });
  assert.throws(
    () => previewProjectAdoption(mcpDriftAdoptionRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }),
    /cannot claim conflicting content/iu
  );
  assert.equal(fs.existsSync(path.join(mcpDriftAdoptionRoot, INSTALLATION_MANIFEST_PATH)), false);

  const exaDriftAdoptionRoot = makeAdoptableProject();
  roots.push(exaDriftAdoptionRoot);
  writeJson(path.join(exaDriftAdoptionRoot, ".mcp.json"), {
    mcpServers: {
      [EXA_MCP_SERVER_NAME]: { type: "stdio", command: "not-exa" }
    }
  });
  assert.throws(
    () => previewProjectAdoption(exaDriftAdoptionRoot, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION }),
    /cannot claim conflicting content/iu
  );
  assert.equal(fs.existsSync(path.join(exaDriftAdoptionRoot, INSTALLATION_MANIFEST_PATH)), false);

  const otherRoot = makeProject();
  roots.push(otherRoot);
  const mismatchCwd = cliHook(stopRoot, "session-start", { hook_event_name: "SessionStart", cwd: otherRoot });
  assert.equal(mismatchCwd.status, 0, "Invalid project boundaries must report through host-consumed hook JSON.");
  assert.match(JSON.parse(mismatchCwd.stdout).systemMessage, /不属于声明的已初始化项目|does not belong/iu);

  const cliEntrypoints = process.argv.includes("--source-only") ? ["dove.mjs"] : ["dove.mjs", "dove-package.mjs"];
  for (const entrypoint of cliEntrypoints) {
    const factsRoot = makeProject();
    roots.push(factsRoot);
    validateSessionFacts(factsRoot, path.join(ROOT, "bin", entrypoint));
    const doctorRoot = makeProject();
    roots.push(doctorRoot);
    validateDoctorVersions(doctorRoot, path.join(ROOT, "bin", entrypoint));
    validateDoctorRetiredHooks(doctorRoot, path.join(ROOT, "bin", entrypoint));
  }

  console.log(JSON.stringify({ status: "passed", sessionFactsCli: cliEntrypoints, doctorCli: cliEntrypoints }, null, 2));
} finally {
  for (const root of roots.reverse()) fs.rmSync(root, { recursive: true, force: true });
}
