#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { initializeProjectIntegration } from "../src/core/project-installation.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH_ROOT = path.join(ROOT, ".dove-dev", "tmp");
fs.mkdirSync(SCRATCH_ROOT, { recursive: true });

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeFile(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function listFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const stack = [""];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(path.join(root, current), { withFileTypes: true })) {
      const relativePath = current ? `${current}/${entry.name}` : entry.name;
      const absolutePath = path.join(root, relativePath);
      const stat = fs.lstatSync(absolutePath);
      if (stat.isSymbolicLink()) throw new Error(`unexpected symlink while listing ${absolutePath}`);
      if (stat.isDirectory()) stack.push(relativePath);
      else if (stat.isFile()) files.push(relativePath);
      else throw new Error(`unexpected path type ${absolutePath}`);
    }
  }
  return files.sort();
}

function directoryDigest(root) {
  const digest = new Map();
  for (const relativePath of listFiles(root)) {
    const filePath = path.join(root, relativePath);
    digest.set(relativePath, sha256(fs.readFileSync(filePath)));
  }
  return digest;
}

function assertDigestEqual(left, right, label) {
  assert.deepEqual([...left.entries()].sort(), [...right.entries()].sort(), label);
}

function cliReview(args, env, options = {}) {
  return spawnSync(process.execPath, [path.join(ROOT, "bin", "dove.mjs"), ...args], {
    cwd: options.cwd ?? ROOT,
    encoding: "utf8",
    env,
    ...options
  });
}

function jsonCli(args, env, options = {}) {
  const result = cliReview(args, env, options);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function writeFakeClaude(fakePath) {
  fs.writeFileSync(fakePath, `#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const expectedPrefix = ["--safe-mode", "--setting-sources", "local", "--strict-mcp-config", "--disable-slash-commands", "--tools", "Read", "--permission-mode", "dontAsk", "--input-format", "text", "--print", "--output-format", "json"];
assert.deepEqual(args.slice(0, expectedPrefix.length), expectedPrefix);
for (const forbidden of ["--bare", "--fork-session", "--no-session-persistence", "--continue"]) assert.equal(args.includes(forbidden), false, forbidden);
assert.equal(args.includes("Bash"), false);
assert.equal(args.includes("Edit"), false);
assert.equal(args.includes("Write"), false);
assert.equal(args.includes("MCP"), false);
const mode = args[expectedPrefix.length];
assert.ok(mode === "--session-id" || mode === "--resume", mode);
const sessionId = args[expectedPrefix.length + 1];
assert.equal(typeof sessionId, "string");
assert.ok(sessionId.length > 0);
assert.equal(args.length, expectedPrefix.length + 2);

let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;
assert.match(input, /# Dove Agent/u);
assert.match(input, /Independent dove-review task/u);
assert.match(input, /Scientific acceptability/u);
assert.match(input, /Delivery readiness/u);
assert.match(input, /Your available tool is Read/u);
assert.match(input, /private conversation/iu);
assert.match(input, /transcripts/iu);

const allowed = new Set();
for (const match of input.matchAll(/^- (.+?) \\(\\d+ bytes, sha256 [a-f0-9]{64}\\)$/gmu)) allowed.add(match[1]);
const actual = [];
const stack = [""];
while (stack.length > 0) {
  const current = stack.pop();
  for (const entry of fs.readdirSync(path.join(process.cwd(), current), { withFileTypes: true })) {
    const relativePath = current ? current + "/" + entry.name : entry.name;
    const target = path.join(process.cwd(), relativePath);
    const stat = fs.lstatSync(target);
    assert.equal(stat.isSymbolicLink(), false, "workspace symlink " + relativePath);
    if (stat.isDirectory()) stack.push(relativePath);
    else if (stat.isFile()) actual.push(relativePath);
    else throw new Error("unsupported workspace path " + relativePath);
  }
}
assert.deepEqual(actual.sort(), [...allowed].sort());
for (const forbidden of ["private-note.md", "CLAUDE.md", ".claude/settings.json", ".dove/research/RESEARCH.md", "paper/result.pdf"]) {
  if (!allowed.has(forbidden)) assert.equal(actual.includes(forbidden), false, forbidden);
}
if (process.env.DOVE_FAKE_CLAUDE_FAIL === "1") {
  process.stderr.write("fake reviewer backend failed after validating argv and material workspace\\n");
  process.exit(17);
}
if (process.env.DOVE_FAKE_LOG) fs.appendFileSync(process.env.DOVE_FAKE_LOG, JSON.stringify({ mode, sessionId, cwd: process.cwd(), allowed: [...allowed].sort() }) + "\\n");
process.stdout.write(JSON.stringify({
  type: "result",
  session_id: process.env.DOVE_FAKE_BAD_SESSION === "1" ? sessionId + "-wrong" : sessionId,
  result: "# Fake dove-review report\\n\\n## Scientific acceptability\\n\\nThe fake reviewer read only the listed materials and returns a bounded scientific judgment.\\n\\n## Delivery readiness\\n\\nThe fake reviewer reports delivery issues separately."
}));
`, "utf8");
  fs.chmodSync(fakePath, 0o755);
}

function makeProject(tempRoot, name) {
  const project = path.join(tempRoot, name);
  fs.mkdirSync(project, { recursive: true });
  fs.mkdirSync(path.join(project, ".git"));
  fs.writeFileSync(path.join(project, "package.json"), "{}\n");
  initializeProjectIntegration(project, { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, hosts: ["claude"], now: "2026-09-02T00:00:00.000Z" });
  writeFile(project, "paper/main.tex", "\\section{Main} Initial manuscript.\n");
  writeFile(project, "paper/result.pdf", "%PDF fake current build\n");
  writeFile(project, "paper/private-note.md", "author-only note must not be copied\n");
  writeFile(project, "paper/.claude/settings.json", "nested author settings must not be copied\n");
  writeFile(project, "paper/CLAUDE.md", "nested author instruction must not be copied\n");
  writeFile(project, "CLAUDE.md", "author private project instruction must not be copied\n");
  writeFile(project, ".dove/research/notes.md", "author research note must not be copied\n");
  return project;
}

const tempRoot = fs.mkdtempSync(path.join(SCRATCH_ROOT, "dove-review-runtime-"));
const stateRoot = path.join(tempRoot, "state", "reviews");
const fakeClaude = path.join(tempRoot, "fake-claude.mjs");
const fakeLog = path.join(tempRoot, "fake-claude.jsonl");
const env = { ...process.env, DOVE_CLAUDE_COMMAND: fakeClaude, DOVE_REVIEW_STATE_ROOT: stateRoot, DOVE_FAKE_LOG: fakeLog };
try {
  writeFakeClaude(fakeClaude);
  const project = makeProject(tempRoot, "project");
  const reviewId = "review-validation";

  const handoff = jsonCli([
    "review", "handoff",
    "--project", project,
    "--venue", "TestConf 2026",
    "--id", reviewId,
    "--material", "paper/main.tex",
    "--material", "paper/result.pdf",
    "--json"
  ], env);
  assert.equal(handoff.command, "handoff");
  assert.equal(handoff.status, "completed");
  assert.equal(handoff.reviewId, reviewId);
  assert.equal(handoff.round, 1);
  assert.equal(typeof handoff.sessionId, "string");
  assert.ok(handoff.sessionId.length > 0);
  assert.deepEqual(handoff.materials.map((item) => item.path), ["paper/main.tex", "paper/result.pdf"]);

  const reviewRecordPath = path.join(project, ".dove", "reviews", reviewId, "review.json");
  const record1 = readJson(reviewRecordPath);
  assert.equal(record1.session.sessionId, handoff.sessionId);
  assert.equal(record1.rounds[0].reportPath, `.dove/reviews/${reviewId}/rounds/1/report.md`);
  const backend1 = readJson(path.join(project, ".dove", "reviews", reviewId, "rounds", "1", "backend.json"));
  assert.equal(backend1.status, "completed");
  assert.equal(backend1.sessionId, handoff.sessionId);
  assert.equal(backend1.argv.includes("--session-id"), true);
  assert.equal(backend1.argv.includes("--resume"), false);

  const copied1 = listFiles(path.join(stateRoot, reviewId));
  assert.deepEqual(copied1, ["paper/main.tex", "paper/result.pdf"]);
  assert.equal(copied1.includes("paper/private-note.md"), false);
  assert.equal(copied1.includes("CLAUDE.md"), false);
  assert.equal(copied1.includes("paper/CLAUDE.md"), false);
  assert.equal(copied1.includes("paper/.claude/settings.json"), false);
  assert.equal(copied1.some((item) => item.startsWith(".dove/")), false);

  const nestedPrivate = cliReview([
    "review", "handoff",
    "--project", project,
    "--venue", "TestConf 2026",
    "--id", "review-nested-private",
    "--material", "paper/CLAUDE.md",
    "--json"
  ], env);
  assert.notEqual(nestedPrivate.status, 0);
  assert.match(nestedPrivate.stderr, /private or Dove-owned/iu);
  assert.equal(fs.existsSync(path.join(project, ".dove", "reviews", "review-nested-private")), false);

  const internalStateRoot = cliReview([
    "review", "handoff",
    "--project", project,
    "--venue", "TestConf 2026",
    "--id", "review-internal-state-root",
    "--material", "paper/main.tex",
    "--json"
  ], { ...env, DOVE_REVIEW_STATE_ROOT: path.join(project, ".dove", "reviews") });
  assert.notEqual(internalStateRoot.status, 0);
  assert.match(internalStateRoot.stderr, /state root must be outside the initialized project/iu);
  assert.equal(fs.existsSync(path.join(project, ".dove", "reviews", "review-internal-state-root")), false);

  const beforeStatus = directoryDigest(path.join(project, ".dove", "reviews"));
  const status = jsonCli(["review", "status", "--project", project, "--id", reviewId, "--json"], env);
  assert.equal(status.command, "status");
  assert.equal(status.reviewId, reviewId);
  assert.equal(status.currentRound, 1);
  assert.equal(status.sessionId, handoff.sessionId);
  const afterStatus = directoryDigest(path.join(project, ".dove", "reviews"));
  assertDigestEqual(afterStatus, beforeStatus, "dove review status must not write review records");

  const report1BeforeResume = fs.readFileSync(path.join(project, ".dove", "reviews", reviewId, "rounds", "1", "report.md"), "utf8");
  const backend1BeforeResume = readJson(path.join(project, ".dove", "reviews", reviewId, "rounds", "1", "backend.json"));
  const resume = jsonCli(["review", "resume", "--project", project, "--id", reviewId, "--json"], env);
  assert.equal(resume.command, "resume");
  assert.equal(resume.round, 1);
  assert.equal(resume.sessionId, handoff.sessionId);
  assert.equal(resume.reportPath, `.dove/reviews/${reviewId}/rounds/1/report.md`);
  assert.equal(resume.latestReportPath, `.dove/reviews/${reviewId}/rounds/1/attempts/1/report.md`);
  assert.equal(fs.readFileSync(path.join(project, ".dove", "reviews", reviewId, "rounds", "1", "report.md"), "utf8"), report1BeforeResume);
  assert.deepEqual(readJson(path.join(project, ".dove", "reviews", reviewId, "rounds", "1", "backend.json")), backend1BeforeResume);
  const backendResume = readJson(path.join(project, ".dove", "reviews", reviewId, "rounds", "1", "attempts", "1", "backend.json"));
  assert.equal(backendResume.argv.includes("--resume"), true);
  assert.equal(backendResume.requestedSessionId, handoff.sessionId);
  const statusAfterResume = jsonCli(["review", "status", "--project", project, "--id", reviewId, "--json"], env);
  assert.equal(statusAfterResume.rounds[0].reportPath, `.dove/reviews/${reviewId}/rounds/1/report.md`);
  assert.equal(statusAfterResume.rounds[0].latestReportPath, `.dove/reviews/${reviewId}/rounds/1/attempts/1/report.md`);
  assert.equal(statusAfterResume.rounds[0].attempts.length, 1);

  writeFile(project, "paper/main.tex", "\\section{Main} Revised manuscript.\n");
  writeFile(project, "paper/supplement.tex", "Supplement now replaces the old build artifact.\n");
  const rerun = jsonCli([
    "review", "rerun",
    "--project", project,
    "--id", reviewId,
    "--material", "paper/main.tex",
    "--material", "paper/supplement.tex",
    "--json"
  ], env);
  assert.equal(rerun.command, "rerun");
  assert.equal(rerun.round, 2);
  assert.equal(rerun.sessionId, handoff.sessionId);
  assert.deepEqual(rerun.materials.map((item) => item.path), ["paper/main.tex", "paper/supplement.tex"]);
  assert.deepEqual(listFiles(path.join(stateRoot, reviewId)), ["paper/main.tex", "paper/supplement.tex"]);
  const backend2 = readJson(path.join(project, ".dove", "reviews", reviewId, "rounds", "2", "backend.json"));
  assert.equal(backend2.argv.includes("--resume"), true);
  assert.equal(backend2.requestedSessionId, handoff.sessionId);

  const importedReturn = path.join(tempRoot, "external-return.md");
  fs.writeFileSync(importedReturn, "# User obtained review\n\nThis return came from outside the runtime.\n");
  const imported = jsonCli(["review", "import", "--project", project, "--id", reviewId, "--file", importedReturn, "--json"], env);
  assert.equal(imported.command, "import");
  assert.equal(imported.status, "imported");
  assert.equal(imported.provenance, "imported");
  assert.equal(imported.round, 3);
  assert.equal(fs.readFileSync(path.join(project, ".dove", "reviews", reviewId, "rounds", "3", "report.md"), "utf8"), fs.readFileSync(importedReturn, "utf8"));
  const importedBackend = readJson(path.join(project, ".dove", "reviews", reviewId, "rounds", "3", "backend.json"));
  assert.equal(importedBackend.status, "imported");
  assert.equal(importedBackend.runtimeGenerated, false);
  assert.equal(importedBackend.sessionId, null);

  writeFile(project, "paper/failure-round.tex", "A failed rerun should still keep reviewer continuity.\n");
  const failedRerun = jsonCli([
    "review", "rerun",
    "--project", project,
    "--id", reviewId,
    "--material", "paper/failure-round.tex",
    "--json"
  ], { ...env, DOVE_FAKE_CLAUDE_FAIL: "1" });
  assert.equal(failedRerun.command, "rerun");
  assert.equal(failedRerun.status, "failed");
  assert.equal(failedRerun.round, 4);
  assert.equal(failedRerun.sessionId, handoff.sessionId);
  const failedRerunRecord = readJson(reviewRecordPath);
  assert.equal(failedRerunRecord.session.sessionId, handoff.sessionId);
  assert.equal(failedRerunRecord.rounds[3].sessionId, null);
  const failedRerunBackend = readJson(path.join(project, ".dove", "reviews", reviewId, "rounds", "4", "backend.json"));
  assert.equal(failedRerunBackend.status, "failed");
  assert.equal(failedRerunBackend.requestedSessionId, handoff.sessionId);
  assert.equal(Object.hasOwn(failedRerunBackend, "sessionId"), false);
  assert.deepEqual(listFiles(path.join(stateRoot, reviewId)), ["paper/failure-round.tex"]);

  const escape = cliReview([
    "review", "handoff",
    "--project", project,
    "--venue", "TestConf 2026",
    "--id", "review-escape",
    "--material", "../outside.txt",
    "--json"
  ], env);
  assert.notEqual(escape.status, 0);
  assert.match(escape.stderr, /inside the rooted workspace|material path/iu);
  assert.equal(fs.existsSync(path.join(project, ".dove", "reviews", "review-escape")), false);

  if (process.platform !== "win32") {
    fs.symlinkSync("main.tex", path.join(project, "paper", "link.tex"));
    const symlink = cliReview([
      "review", "handoff",
      "--project", project,
      "--venue", "TestConf 2026",
      "--id", "review-symlink",
      "--material", "paper/link.tex",
      "--json"
    ], env);
    assert.notEqual(symlink.status, 0);
    assert.match(symlink.stderr, /symbolic link|non-symlink|regular file/iu);
    assert.equal(fs.existsSync(path.join(project, ".dove", "reviews", "review-symlink")), false);
  }

  const failedProject = makeProject(tempRoot, "failed-project");
  const failed = jsonCli([
    "review", "handoff",
    "--project", failedProject,
    "--venue", "TestConf 2026",
    "--id", "review-failure",
    "--material", "paper/main.tex",
    "--json"
  ], { ...env, DOVE_FAKE_CLAUDE_FAIL: "1" });
  assert.equal(failed.command, "handoff");
  assert.equal(failed.status, "failed");
  assert.equal(failed.sessionId, null);
  const failedRecord = readJson(path.join(failedProject, ".dove", "reviews", "review-failure", "review.json"));
  assert.equal(failedRecord.session.sessionId, null);
  assert.equal(failedRecord.rounds[0].sessionId, null);
  const failedBackend = readJson(path.join(failedProject, ".dove", "reviews", "review-failure", "rounds", "1", "backend.json"));
  assert.equal(failedBackend.status, "failed");
  assert.match(failedBackend.error, /fake reviewer backend failed/iu);
  assert.equal(Object.hasOwn(failedBackend, "sessionId"), false);
  assert.equal(typeof failedBackend.requestedSessionId, "string");
  assert.ok(failedBackend.requestedSessionId.length > 0);

  const invocations = fs.readFileSync(fakeLog, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(invocations.map((item) => item.mode), ["--session-id", "--resume", "--resume"]);
  assert.equal(invocations[1].sessionId, invocations[0].sessionId);
  assert.equal(invocations[2].sessionId, invocations[0].sessionId);

  console.log(JSON.stringify({ status: "passed" }, null, 2));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
