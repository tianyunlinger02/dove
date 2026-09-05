#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { initializeProjectIntegration } from "../src/core/project-installation.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import * as publicCore from "../src/core/index.mjs";
import * as bundledCore from "../dist/index.mjs";

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

function directoryObservationDigest(root) {
  const digest = new Map();
  if (!fs.existsSync(root)) return digest;
  const stack = [""];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(path.join(root, current), { withFileTypes: true })) {
      const relativePath = current ? `${current}/${entry.name}` : entry.name;
      const absolutePath = path.join(root, relativePath);
      const stat = fs.lstatSync(absolutePath);
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        digest.set(relativePath, { type: "directory", mode: stat.mode & 0o7777 });
        stack.push(relativePath);
      } else if (stat.isSymbolicLink()) {
        digest.set(relativePath, { type: "symlink", link: fs.readlinkSync(absolutePath), mode: stat.mode & 0o7777 });
      } else if (stat.isFile()) {
        digest.set(relativePath, { type: "file", sha256: sha256(fs.readFileSync(absolutePath)), mode: stat.mode & 0o7777 });
      } else {
        digest.set(relativePath, { type: "special", mode: stat.mode & 0o7777, rdev: stat.rdev });
      }
    }
  }
  return digest;
}

function assertDigestEqual(left, right, label) {
  assert.deepEqual([...left.entries()].sort(), [...right.entries()].sort(), label);
}

function assertReviewStatusReadOnly(project, env, args, assertion) {
  const reviewRoot = path.join(project, ".dove", "reviews");
  const stateRootPath = typeof env.DOVE_REVIEW_STATE_ROOT === "string" ? env.DOVE_REVIEW_STATE_ROOT : null;
  const projectBefore = directoryObservationDigest(project);
  const reviewsBefore = directoryObservationDigest(reviewRoot);
  const stateBefore = stateRootPath ? directoryObservationDigest(stateRootPath) : null;
  const status = jsonCli(args, env);
  assertion(status);
  assertDigestEqual(directoryObservationDigest(reviewRoot), reviewsBefore, "dove review status must not write review records");
  assertDigestEqual(directoryObservationDigest(project), projectBefore, "dove review status must not write project files");
  if (stateRootPath) assertDigestEqual(directoryObservationDigest(stateRootPath), stateBefore, "dove review status must not write reviewer workspaces");
  return status;
}

function roundCurrentness(status, roundNumber) {
  return status.rounds.find((round) => round.round === roundNumber)?.materialCurrentness;
}

function materialFact(currentness, materialPath) {
  return currentness?.items.find((item) => item.path === materialPath);
}

function assertNoPublicHashFields(value, label = "public review result") {
  const visit = (item, trail) => {
    if (Array.isArray(item)) {
      item.forEach((entry, index) => visit(entry, `${trail}[${index}]`));
      return;
    }
    if (item === null || typeof item !== "object") return;
    for (const [key, nested] of Object.entries(item)) {
      const words = key.replace(/([a-z0-9])([A-Z])/gu, "$1 $2").replace(/([A-Z])([A-Z][a-z])/gu, "$1 $2");
      assert.doesNotMatch(words, /(?:^|[^a-z0-9])(?:hash(?:es)?|sha(?:1|224|256|384|512)?|md5|digest(?:s)?|checksum(?:s)?)(?:$|[^a-z0-9])/iu, `${label} must not expose hash field ${trail}.${key}`);
      visit(nested, `${trail}.${key}`);
    }
  };
  visit(value, "$ ");
}

function assertSha256(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.match(value, /^[a-f0-9]{64}$/u, `${label} must be a SHA-256 hex digest`);
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
  const value = JSON.parse(result.stdout);
  assertNoPublicHashFields(value, args.join(" "));
  return value;
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
assert.doesNotMatch(input, /# Dove Agent/u);
assert.match(input, /Independent dove-review task/u);
assert.match(input, /Shared researcher judgment/u);
assert.match(input, /Reviewer stance/u);
assert.match(input, /method answers the research question|method answer/iu);
assert.match(input, /correct[^;\\n]*field|field[^;\\n]*correct/iu);
assert.match(input, /fit the target venue|venue fit/iu);
assert.match(input, /strongest reasonable objection/iu);
assert.match(input, /## Verdict/u);
assert.match(input, /## Blocking issues/u);
assert.match(input, /## Grounding basis/u);
assert.match(input, /## Author-side next actions/u);
assert.match(input, /Your available tool is Read/u);
assert.match(input, /private conversation/iu);
assert.match(input, /transcripts/iu);
assert.match(input, /do not include enough venue rules or literature grounding/iu);

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
  result: "## Verdict\\n\\nThe fake reviewer read only the listed materials and returns a bounded scientific judgment.\\n\\n## Blocking issues\\n\\nNo synthetic blocking issue.\\n\\n## Grounding basis\\n\\nOnly the copied frozen materials were inspected.\\n\\n## Author-side next actions\\n\\nUse author-side judgment for any revision."
}));
`, "utf8");
  fs.chmodSync(fakePath, 0o755);
}

function makeProject(tempRoot, name) {
  const project = path.join(tempRoot, name);
  fs.mkdirSync(project, { recursive: true });
  fs.mkdirSync(path.join(project, ".git"));
  fs.writeFileSync(path.join(project, ".git", "config"), "[core]\n\trepositoryformatversion = 0\n");
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
  assert.equal(handoff.status, "completed", readJson(path.join(project, handoff.backendPath)).error);
  assert.equal(handoff.reviewId, reviewId);
  assert.equal(handoff.round, 1);
  assert.equal(typeof handoff.sessionId, "string");
  assert.ok(handoff.sessionId.length > 0);
  assert.deepEqual(handoff.materials.map((item) => item.path), ["paper/main.tex", "paper/result.pdf"]);

  const reviewRecordPath = path.join(project, ".dove", "reviews", reviewId, "review.json");
  const record1 = readJson(reviewRecordPath);
  assert.equal(record1.session.sessionId, handoff.sessionId);
  assert.equal(record1.rounds[0].reportPath, `.dove/reviews/${reviewId}/rounds/1/report.md`);
  assertSha256(record1.rounds[0].reportSha256, "review.json round reportSha256");
  assert.deepEqual(record1.rounds[0].materials.map((item) => item.path), ["paper/main.tex", "paper/result.pdf"]);
  for (const material of record1.rounds[0].materials) assertSha256(material.sha256, `review.json material ${material.path}`);
  const snapshot1 = readJson(path.join(project, ".dove", "reviews", reviewId, "rounds", "1", "snapshot.json"));
  for (const material of snapshot1.materials) assertSha256(material.sha256, `snapshot material ${material.path}`);
  const backend1 = readJson(path.join(project, ".dove", "reviews", reviewId, "rounds", "1", "backend.json"));
  assert.equal(backend1.status, "completed");
  assert.equal(backend1.sessionId, handoff.sessionId);
  assertSha256(backend1.promptSha256, "backend promptSha256");
  assertSha256(backend1.resultSha256, "backend resultSha256");
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

  const gitPrivate = cliReview([
    "review", "handoff",
    "--project", project,
    "--venue", "TestConf 2026",
    "--id", "review-git-private",
    "--material", ".git/config",
    "--json"
  ], env);
  assert.notEqual(gitPrivate.status, 0);
  assert.match(gitPrivate.stderr, /private or Dove-owned/iu);
  assert.equal(fs.existsSync(path.join(project, ".dove", "reviews", "review-git-private")), false);

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

  assertReviewStatusReadOnly(project, env, ["review", "status", "--project", project, "--id", reviewId, "--json"], (value) => {
    assert.equal(value.command, "status");
    assert.equal(value.reviewId, reviewId);
    assert.equal(value.currentRound, 1);
    assert.equal(value.sessionId, handoff.sessionId);
    assert.equal(value.materialCurrentness.overall, "current");
    assert.equal(roundCurrentness(value, 1).overall, "current");
    assert.equal(materialFact(value.materialCurrentness, "paper/main.tex").status, "current");
    assert.equal(materialFact(value.materialCurrentness, "paper/result.pdf").observed.type, "file");
    assert.equal(materialFact(value.materialCurrentness, "paper/result.pdf").observed.exists, true);
    assert.equal(materialFact(value.materialCurrentness, "paper/result.pdf").observed.size, fs.statSync(path.join(project, "paper", "result.pdf")).size);
  });

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
  assertReviewStatusReadOnly(project, env, ["review", "status", "--project", project, "--id", reviewId, "--json"], (value) => {
    assert.equal(value.rounds[0].reportPath, `.dove/reviews/${reviewId}/rounds/1/report.md`);
    assert.equal(value.rounds[0].latestReportPath, `.dove/reviews/${reviewId}/rounds/1/attempts/1/report.md`);
    assert.equal(value.rounds[0].attempts.length, 1);
    assert.equal(value.materialCurrentness.overall, "current");
  });

  writeFile(project, "paper/main.tex", "\\section{Main} Revised manuscript.\n");
  assertReviewStatusReadOnly(project, env, ["review", "status", "--project", project, "--id", reviewId, "--json"], (value) => {
    assert.equal(value.materialCurrentness.overall, "changed");
    assert.equal(materialFact(value.materialCurrentness, "paper/main.tex").status, "changed");
    assert.equal(materialFact(value.materialCurrentness, "paper/result.pdf").status, "current");
    assert.equal(roundCurrentness(value, 1).overall, "changed");
  });
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
  assertReviewStatusReadOnly(project, env, ["review", "status", "--project", project, "--id", reviewId, "--json"], (value) => {
    assert.equal(value.materialCurrentness.overall, "current");
    assert.equal(roundCurrentness(value, 1).overall, "changed");
    assert.equal(roundCurrentness(value, 2).overall, "current");
  });
  fs.unlinkSync(path.join(project, "paper", "supplement.tex"));
  assertReviewStatusReadOnly(project, env, ["review", "status", "--project", project, "--id", reviewId, "--json"], (value) => {
    assert.equal(value.materialCurrentness.overall, "missing");
    assert.equal(roundCurrentness(value, 2).overall, "missing");
    assert.equal(materialFact(roundCurrentness(value, 2), "paper/main.tex").status, "current");
    assert.equal(materialFact(roundCurrentness(value, 2), "paper/supplement.tex").status, "missing");
    assert.equal(materialFact(roundCurrentness(value, 2), "paper/supplement.tex").observed.type, "absent");
  });

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
  assertReviewStatusReadOnly(project, env, ["review", "status", "--project", project, "--id", reviewId, "--json"], (value) => {
    assert.equal(value.currentRound, 3);
    assert.equal(value.materialCurrentness.overall, "unavailable");
    assert.deepEqual(value.materialCurrentness.items, []);
    assert.equal(roundCurrentness(value, 3).overall, "unavailable");
  });

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
  assertReviewStatusReadOnly(project, env, ["review", "status", "--project", project, "--id", reviewId, "--json"], (value) => {
    assert.equal(value.currentRound, 4);
    assert.equal(value.materialCurrentness.overall, "current");
    assert.equal(materialFact(value.materialCurrentness, "paper/failure-round.tex").observed.type, "file");
    assert.equal(materialFact(value.materialCurrentness, "paper/failure-round.tex").observed.size, fs.statSync(path.join(project, "paper", "failure-round.tex")).size);
    assert.deepEqual(failedRerun.materials, [{ path: "paper/failure-round.tex", size: fs.statSync(path.join(project, "paper", "failure-round.tex")).size }]);
  });
  if (process.platform !== "win32") {
    const failurePath = path.join(project, "paper", "failure-round.tex");
    fs.unlinkSync(failurePath);
    fs.symlinkSync("main.tex", failurePath);
    assertReviewStatusReadOnly(project, env, ["review", "status", "--project", project, "--id", reviewId, "--json"], (value) => {
      assert.equal(value.materialCurrentness.overall, "changed");
      assert.equal(materialFact(value.materialCurrentness, "paper/failure-round.tex").status, "changed");
      assert.equal(materialFact(value.materialCurrentness, "paper/failure-round.tex").observed.type, "symlink");
      assert.equal(Object.hasOwn(materialFact(value.materialCurrentness, "paper/failure-round.tex").observed, "sha256"), false);
    });
    fs.unlinkSync(failurePath);
    const mkfifo = spawnSync("mkfifo", [failurePath], { encoding: "utf8" });
    assert.equal(mkfifo.status, 0, mkfifo.stderr || mkfifo.stdout);
    assertReviewStatusReadOnly(project, env, ["review", "status", "--project", project, "--id", reviewId, "--json"], (value) => {
      assert.equal(value.materialCurrentness.overall, "changed");
      assert.equal(materialFact(value.materialCurrentness, "paper/failure-round.tex").status, "changed");
      assert.equal(materialFact(value.materialCurrentness, "paper/failure-round.tex").observed.type, "special");
      assert.equal(Object.hasOwn(materialFact(value.materialCurrentness, "paper/failure-round.tex").observed, "sha256"), false);
    });
    fs.unlinkSync(failurePath);
    writeFile(project, "paper/failure-round.tex", "A failed rerun should still keep reviewer continuity.\n");
  }
  const round4SnapshotPath = path.join(project, ".dove", "reviews", reviewId, "rounds", "4", "snapshot.json");
  const round4Snapshot = readJson(round4SnapshotPath);
  round4Snapshot.materials = [{ path: `.dove/reviews/${reviewId}/review.json`, size: 1, sha256: "0".repeat(64) }];
  writeJson(round4SnapshotPath, round4Snapshot);
  assertReviewStatusReadOnly(project, env, ["review", "status", "--project", project, "--id", reviewId, "--json"], (value) => {
    assert.equal(value.materialCurrentness.overall, "changed");
    assert.equal(materialFact(value.materialCurrentness, `.dove/reviews/${reviewId}/review.json`).status, "changed");
    assert.equal(materialFact(value.materialCurrentness, `.dove/reviews/${reviewId}/review.json`).observed.type, "unsafe-path");
    assert.equal(Object.hasOwn(materialFact(value.materialCurrentness, `.dove/reviews/${reviewId}/review.json`).observed, "sha256"), false);
  });

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

  for (const [label, core] of [["source", publicCore], ["bundle", bundledCore]]) {
    for (const internal of ["createReviewSnapshot", "snapshotDigest", "runClaudeReviewBackend"]) {
      assert.equal(Object.hasOwn(core, internal), false, `${label} must keep raw hash receipt helpers internal`);
    }
    const id = `public-core-${label}`;
    const options = { project, id, venue: "TestConf 2026", materials: ["paper/main.tex"], stateRoot, claudeCommand: fakeClaude, env };
    const first = core.handoffReview(options);
    assert.equal(first.status, "completed");
    assertNoPublicHashFields(first);
    const materialFds = new Set();
    let materialReads = 0;
    const currentnessStatus = core.inspectReviewStatus({
      ...options,
      fsOps: {
        ...fs,
        openSync(file, ...args) {
          const fd = fs.openSync(file, ...args);
          if (file === path.join(project, "paper", "main.tex")) materialFds.add(fd);
          return fd;
        },
        readFileSync(file, ...args) {
          const bytes = fs.readFileSync(file, ...args);
          if (materialFds.has(file)) {
            materialReads += 1;
            if (materialReads > 1) bytes[0] ^= 1;
          }
          return bytes;
        },
        closeSync(fd) {
          materialFds.delete(fd);
          return fs.closeSync(fd);
        }
      }
    });
    assert.equal(materialReads, 1, "status must read each round's material only once");
    assert.equal(currentnessStatus.materialCurrentness.overall, "current");
    assert.deepEqual(currentnessStatus.materialCurrentness, currentnessStatus.rounds[0].materialCurrentness);
    const missingSnapshotStatus = core.inspectReviewStatus({
      ...options,
      fsOps: {
        ...fs,
        readFileSync(file, ...args) {
          if (file === path.join(project, first.snapshotPath)) throw Object.assign(new Error("ENOENT: frozen snapshot is missing"), { code: "ENOENT" });
          return fs.readFileSync(file, ...args);
        }
      }
    });
    assert.equal(missingSnapshotStatus.materialCurrentness.overall, "unavailable");
    assert.match(missingSnapshotStatus.materialCurrentness.error, /ENOENT/u);
    assert.deepEqual(missingSnapshotStatus.materialCurrentness, missingSnapshotStatus.rounds[0].materialCurrentness);
    assertNoPublicHashFields(core.resumeReview(options));
    assertNoPublicHashFields(core.rerunReview(options));
    const workspaceFile = path.join(stateRoot, id, "paper", "main.tex");
    const frozenBytes = fs.readFileSync(workspaceFile);
    const changedBytes = Buffer.from(frozenBytes);
    changedBytes[0] ^= 1;
    fs.writeFileSync(workspaceFile, changedBytes);
    const tampered = core.resumeReview(options);
    assert.equal(tampered.status, "failed", "same-size workspace changes must still be detected by internal SHA");
    assertNoPublicHashFields(tampered);
    assert.match(readJson(path.join(project, tampered.latestBackendPath)).error, /no longer matches the frozen snapshot/u);
    fs.writeFileSync(workspaceFile, frozenBytes);
    assertNoPublicHashFields(core.importReviewReturn({ ...options, file: importedReturn }));

    const recordPath = path.join(project, ".dove", "reviews", id, "review.json");
    const stored = readJson(recordPath);
    const invalidText = { sha256: "internal-only-receipt", nested: { contentHash: "internal-only-receipt" } };
    stored.venue = invalidText;
    stored.rounds[0].venue = invalidText;
    stored.rounds[0].materials[0].path = invalidText;
    stored.rounds[0].attempts[0].sessionId = invalidText;
    stored.extraMetadata = invalidText;
    writeJson(recordPath, stored);
    const before = directoryObservationDigest(project);
    const coreStatus = core.inspectReviewStatus(options);
    assertNoPublicHashFields(coreStatus);
    assert.equal(coreStatus.venue, null, "venue is public text, not arbitrary metadata");
    assert.equal(coreStatus.rounds[0].venue, null);
    assert.equal(coreStatus.rounds[0].materials[0].path, null);
    assert.equal(coreStatus.rounds[0].attempts[0].sessionId, null);
    assert.equal(Object.hasOwn(coreStatus, "extraMetadata"), false);
    assert.equal(coreStatus.rounds[1].venue, "TestConf 2026", "valid venue text must survive projection");
    assertDigestEqual(directoryObservationDigest(project), before, "public core status must remain read-only");
    const listed = core.inspectReviewStatus({ project });
    assertNoPublicHashFields(listed);
    assert.equal(listed.reviews.find((review) => review.reviewId === id).venue, null);
    assertReviewStatusReadOnly(project, env, ["review", "status", "--project", project, "--id", id, "--json"], (value) => assert.equal(value.venue, null));
    for (const executable of ["dove.mjs", "dove-package.mjs"]) {
      const human = spawnSync(process.execPath, [path.join(ROOT, "bin", executable), "review", "status", "--project", project, "--id", id], { cwd: ROOT, encoding: "utf8", env });
      assert.equal(human.status, 0, human.stderr);
      assert.doesNotMatch(human.stdout, /internal-only-receipt|sha256|reportSha256|[a-f0-9]{64}/u);
    }
  }

  console.log(JSON.stringify({ status: "passed" }, null, 2));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
