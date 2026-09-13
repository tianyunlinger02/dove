#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createProjectInstallationManifest } from "../src/core/project-installation-manifest.mjs";
import { DOVE_REVIEW_QUALITY_REFERENCE_PATH, reviewWorkspaceName } from "../src/core/review-workspace.mjs";
import { DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS, renderDoveResearchQualityReference } from "../src/core/dove-research-contract.mjs";
import { renderDoveAuthorStanceSection, renderDoveReviewerStanceSection, renderDoveSharedResearchContractSection } from "../src/core/dove-agent-persona.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import * as publicCore from "../src/core/index.mjs";

assert.ok(renderDoveReviewerStanceSection().includes(DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS));

const SOURCE_ONLY = process.argv.includes("--source-only");
const coreEntries = [["source", publicCore]];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH_ROOT = path.join(ROOT, ".claude", "tmp", "dove-wiring-audit");
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
  const { expectedStatus = 0, ...spawnOptions } = options;
  const result = cliReview(args, env, spawnOptions);
  assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
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
assert.match(input, /research question/iu);
assert.match(input, /field/iu);
assert.match(input, /target venue/iu);
assert.match(input, /strongest reasonable objection/iu);
assert.match(input, /## Verdict/u);
assert.match(input, /## Blocking issues/u);
assert.match(input, /## Grounding basis/u);
assert.match(input, /## Author-side next actions/u);
// Check actual backend input against its owning renderers, not copied sentences.
// Tool permissions and frozen-material/session behavior are checked separately.
assert.ok(input.includes(${JSON.stringify(renderDoveSharedResearchContractSection())}));
assert.ok(input.includes(${JSON.stringify(renderDoveReviewerStanceSection())}));
assert.equal(input.includes(${JSON.stringify(renderDoveAuthorStanceSection())}), false);
const referencePath = ${JSON.stringify(DOVE_REVIEW_QUALITY_REFERENCE_PATH)};
assert.ok(input.includes(referencePath));
assert.match(input, /package guidance/iu);
assert.doesNotMatch(input, /sha256|[a-f0-9]{64}/iu);
assert.equal(fs.readFileSync(path.join(process.cwd(), referencePath), "utf8"), ${JSON.stringify(renderDoveResearchQualityReference())});
assert.doesNotMatch(input, /^## Author stance$/mu);

const allowed = new Set();
for (const match of input.matchAll(/^- (.+?) \\(\\d+ bytes\\)$/gmu)) allowed.add(match[1]);
assert.equal(allowed.has(referencePath), false, "package guidance is not user material");
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
assert.deepEqual(actual.sort(), [referencePath, ...allowed].sort());
for (const forbidden of ["private-note.md", "CLAUDE.md", ".claude/settings.json", ".dove/research/RESEARCH.md", "paper/result.pdf"]) {
  if (!allowed.has(forbidden)) assert.equal(actual.includes(forbidden), false, forbidden);
}
const sessionPath = path.join(process.env.DOVE_FAKE_SESSION_ROOT, sessionId + ".json");
const materialBytes = Object.fromEntries(actual.map((file) => [file, fs.readFileSync(path.join(process.cwd(), file)).toString("hex")]));
const exchange = { mode, round: Number(input.match(/^Round: (\\d+)$/mu)[1]), materialBytes };
if (process.env.DOVE_FAKE_LOG) fs.appendFileSync(process.env.DOVE_FAKE_LOG, JSON.stringify({ ...exchange, sessionId, cwd: process.cwd(), allowed: [...allowed].sort() }) + "\\n");
if (mode === "--resume" && !fs.existsSync(sessionPath)) {
  process.stderr.write("requested reviewer session does not exist\\n");
  process.exit(18);
}
const session = mode === "--session-id" ? { cwd: process.cwd(), history: [] } : JSON.parse(fs.readFileSync(sessionPath, "utf8"));
assert.equal(session.cwd, process.cwd(), "resumed session must keep its workspace");
session.history.push(exchange);
fs.writeFileSync(sessionPath, JSON.stringify(session), { flag: mode === "--session-id" ? "wx" : "w" });
if (process.env.DOVE_FAKE_CLAUDE_FAIL === "1") {
  process.stderr.write("fake reviewer backend failed after reading the frozen materials\\n");
  process.exit(17);
}
process.stdout.write(JSON.stringify({
  type: "result",
  session_id: process.env.DOVE_FAKE_BAD_SESSION === "1" ? sessionId + "-wrong" : sessionId,
  result: process.env.DOVE_FAKE_REPORT ?? "## Verdict\\n\\nThe fake reviewer read only the listed materials and returns a bounded scientific judgment.\\n\\n## Blocking issues\\n\\nNo synthetic blocking issue.\\n\\n## Grounding basis\\n\\nOnly the copied frozen materials were inspected.\\n\\n## Author-side next actions\\n\\nUse author-side judgment for any revision."
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
  // Synthetic runtime fixture only: do not install or synchronize host resources.
  writeJson(path.join(project, ".dove/install/manifest.json"), createProjectInstallationManifest({
    package: { name: PACKAGE_NAME, version: PACKAGE_VERSION }, hosts: ["claude"], now: "2026-09-02T00:00:00.000Z"
  }, { hostIds: ["claude"] }));
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
const sessionRoot = path.join(tempRoot, "sessions");
const env = { ...process.env, DOVE_CLAUDE_COMMAND: fakeClaude, DOVE_REVIEW_STATE_ROOT: stateRoot, DOVE_FAKE_LOG: fakeLog, DOVE_FAKE_SESSION_ROOT: sessionRoot };
try {
  fs.mkdirSync(sessionRoot);
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
  assert.equal(Object.hasOwn(record1.rounds[0], "reportSha256"), false);
  assert.equal(fs.existsSync(path.join(project, record1.rounds[0].reportPath)), true);
  assert.deepEqual(record1.rounds[0].materials.map((item) => item.path), ["paper/main.tex", "paper/result.pdf"]);
  for (const material of record1.rounds[0].materials) assertSha256(material.sha256, `review.json material ${material.path}`);
  const snapshot1 = readJson(path.join(project, ".dove", "reviews", reviewId, "rounds", "1", "snapshot.json"));
  for (const material of snapshot1.materials) assertSha256(material.sha256, `snapshot material ${material.path}`);
  const backend1 = readJson(path.join(project, ".dove", "reviews", reviewId, "rounds", "1", "backend.json"));
  assert.equal(backend1.status, "completed");
  assert.equal(backend1.sessionId, handoff.sessionId);
  for (const field of ["promptSha256", "resultSha256", "claudeJsonFields"]) assert.equal(Object.hasOwn(backend1, field), false);
  assert.equal(backend1.argv.includes("--session-id"), true);
  assert.equal(backend1.argv.includes("--resume"), false);

  const copied1 = listFiles(handoff.workspaceRoot);
  assert.deepEqual(copied1, [DOVE_REVIEW_QUALITY_REFERENCE_PATH, "paper/main.tex", "paper/result.pdf"]);
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
  assert.deepEqual(listFiles(handoff.workspaceRoot), [DOVE_REVIEW_QUALITY_REFERENCE_PATH, "paper/main.tex", "paper/supplement.tex"]);
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
  ], { ...env, DOVE_FAKE_CLAUDE_FAIL: "1" }, { expectedStatus: 1 });
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
  assert.deepEqual(listFiles(handoff.workspaceRoot), [DOVE_REVIEW_QUALITY_REFERENCE_PATH, "paper/failure-round.tex"]);
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
  ], { ...env, DOVE_FAKE_CLAUDE_FAIL: "1" }, { expectedStatus: 1 });
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
  assert.deepEqual(invocations.map((item) => item.mode), ["--session-id", "--resume", "--resume", "--resume", "--session-id"]);
  const history = readJson(path.join(sessionRoot, `${handoff.sessionId}.json`)).history;
  assert.deepEqual(history.map((item) => item.round), [1, 1, 2, 4]);
  assert.notEqual(history[0].materialBytes["paper/main.tex"], history[2].materialBytes["paper/main.tex"]);
  assert.deepEqual(history[3].materialBytes, invocations[3].materialBytes, "failed backend calls also advance reviewer history");
  assert.equal(invocations[1].sessionId, invocations[0].sessionId);
  assert.equal(invocations[2].sessionId, invocations[0].sessionId);

  const firstRoundProject = makeProject(tempRoot, "first-round-recovery");
  const firstRoundOptions = { project: firstRoundProject, materials: ["paper/main.tex"], stateRoot, env };
  let firstPrepareFailure = false;
  assert.throws(() => publicCore.handoffReview({
    ...firstRoundOptions, id: "prepare-failure",
    spawnSync() { assert.fail("failed initial preparation must not invoke a reviewer"); },
    fsOps: {
      ...fs,
      mkdirSync(target, ...args) {
        if (!firstPrepareFailure && String(target).startsWith(path.join(firstRoundProject, ".dove/reviews/.transactions"))) {
          firstPrepareFailure = true;
          throw new Error("injected initial preparation failure");
        }
        return fs.mkdirSync(target, ...args);
      }
    }
  }), /injected initial preparation failure/u);
  assert.equal(firstPrepareFailure, true);
  assert.equal(fs.existsSync(path.join(firstRoundProject, ".dove/reviews/prepare-failure/review.json")), false);

  for (const sessionExists of [true, false]) {
    const id = sessionExists ? "first-timeout-existing" : "first-timeout-missing";
    const options = { ...firstRoundOptions, id };
    let requestedId;
    const timedOut = publicCore.handoffReview({
      ...options,
      spawnSync(command, args, spawnOptions) {
        requestedId = args.at(-1);
        const pending = readJson(path.join(firstRoundProject, ".dove/reviews", id, "review.json"));
        assert.equal(pending.session.sessionId, null, "requested id is not yet a verified session");
        assert.equal(pending.pendingExchange.requestedSessionId, requestedId);
        if (sessionExists) {
          const result = spawnSync(command, args, spawnOptions);
          assert.equal(result.status, 0, result.stderr);
        }
        return { status: null, signal: "SIGTERM", error: Object.assign(new Error("synthetic first-round timeout"), { code: "ETIMEDOUT" }) };
      }
    });
    assert.equal(timedOut.status, "failed");
    assert.equal(timedOut.sessionId, null);
    assert.equal(timedOut.pendingExchange.requestedSessionId, requestedId);
    const originalBackend = fs.readFileSync(path.join(firstRoundProject, timedOut.backendPath));
    const originalReport = fs.readFileSync(path.join(firstRoundProject, timedOut.reportPath));
    if (sessionExists) {
      const jsonError = publicCore.resumeReview({
        ...options,
        spawnSync(command, args) {
          assert.deepEqual(args.slice(-2), ["--resume", requestedId]);
          return { status: 0, stdout: JSON.stringify({ session_id: requestedId, is_error: true, result: "synthetic reviewer session error" }) };
        }
      });
      assert.equal(jsonError.status, "failed", "matching session id on an error payload is not successful recovery");
      assert.equal(jsonError.sessionId, null);
      assert.equal(jsonError.pendingExchange.requestedSessionId, requestedId);
      const mismatch = publicCore.resumeReview({ ...options, env: { ...env, DOVE_FAKE_BAD_SESSION: "1" } });
      assert.equal(mismatch.status, "failed");
      assert.equal(mismatch.sessionId, null);
      assert.equal(mismatch.pendingExchange.requestedSessionId, requestedId);
      assert.match(readJson(path.join(firstRoundProject, mismatch.latestBackendPath)).error, /does not match the requested reviewer session/u);
    }
    const continued = publicCore.resumeReview(options);
    assert.equal(continued.status, sessionExists ? "completed" : "failed");
    assert.equal(continued.sessionId, sessionExists ? requestedId : null);
    assert.deepEqual(fs.readFileSync(path.join(firstRoundProject, timedOut.backendPath)), originalBackend);
    assert.deepEqual(fs.readFileSync(path.join(firstRoundProject, timedOut.reportPath)), originalReport);
    const calls = fs.readFileSync(fakeLog, "utf8").trim().split("\n").map(JSON.parse).filter((item) => item.sessionId === requestedId);
    if (sessionExists) {
      assert.equal(continued.pendingExchange, null);
      assert.deepEqual(calls.map((item) => item.mode), ["--session-id", "--resume", "--resume"]);
      const again = publicCore.resumeReview(options);
      assert.equal(again.status, "completed", "workspace lookup must use the saved successful attempt, not the first timeout return");
      const session = readJson(path.join(sessionRoot, `${requestedId}.json`));
      assert.equal(session.history.length, 4);
      assert.ok(session.history.every((item) => JSON.stringify(item.materialBytes) === JSON.stringify(session.history[0].materialBytes)));
    } else {
      assert.equal(continued.pendingExchange.requestedSessionId, requestedId);
      assert.match(readJson(path.join(firstRoundProject, continued.latestBackendPath)).error, /requested reviewer session does not exist/u);
      assert.deepEqual(calls.map((item) => item.mode), ["--resume"], "missing initial session must fail, never create a replacement session");
      assert.equal(fs.existsSync(path.join(sessionRoot, `${requestedId}.json`)), false);
    }
  }

  const orphanId = "unclaimed-workspace";
  const orphanRoot = path.join(stateRoot, reviewWorkspaceName(orphanId, { projectRoot: project }));
  writeFile(orphanRoot, "keep.txt", "Existing workspace must not be adopted by a new handoff.\n");
  const orphanBefore = directoryObservationDigest(orphanRoot);
  const orphanHandoff = cliReview(["review", "handoff", "--project", project, "--id", orphanId, "--material", "paper/main.tex", "--json"], env);
  assert.notEqual(orphanHandoff.status, 0);
  assert.match(orphanHandoff.stderr, /workspace already exists without this review's recorded session/u);
  assertDigestEqual(directoryObservationDigest(orphanRoot), orphanBefore, "handoff must not overwrite a workspace without its record");
  assert.equal(fs.existsSync(path.join(project, ".dove/reviews", orphanId)), false);

  // Two real source CLI projects share an id and state root, never a workspace or lock.
  const projectA = makeProject(tempRoot, `a/${"long-project-parent-".repeat(8)}/project`);
  const projectB = makeProject(tempRoot, "b/project");
  const sharedId = "same-review";
  const argsFor = (operation, target, materials = []) => ["review", operation, "--project", target, "--id", sharedId, ...materials.flatMap((material) => ["--material", material]), "--json"];
  writeFile(projectA, "paper/main.tex", "Project A frozen version one.\n");
  writeFile(projectB, "paper/main.tex", "Project B frozen version one.\n");
  const firstA = jsonCli(argsFor("handoff", projectA, ["paper/main.tex"]), env);
  assert.equal(firstA.status, "completed");
  const workspaceA = directoryObservationDigest(firstA.workspaceRoot);
  const recordsA = directoryObservationDigest(path.join(projectA, ".dove/reviews"));
  const lockA = path.join(stateRoot, ".locks", `${reviewWorkspaceName(sharedId, { projectRoot: projectA })}.lock`);
  fs.mkdirSync(lockA);
  let firstB;
  try {
    firstB = jsonCli(argsFor("handoff", projectB, ["paper/main.tex"]), env);
    assert.equal(firstB.status, "completed", "project A's lock must not block project B");
    const lockedA = cliReview(argsFor("resume", projectA), env);
    assert.notEqual(lockedA.status, 0);
    assert.match(lockedA.stderr, /active operation or stale runtime lock/u);
  } finally {
    fs.rmdirSync(lockA);
  }
  assertDigestEqual(directoryObservationDigest(firstA.workspaceRoot), workspaceA, "B handoff must not replace A materials");
  assertDigestEqual(directoryObservationDigest(path.join(projectA, ".dove/reviews")), recordsA, "B handoff and A lock rejection must not change A records");
  assert.notEqual(firstB.workspaceRoot, firstA.workspaceRoot);
  assert.notEqual(firstB.sessionId, firstA.sessionId);
  for (const first of [firstA, firstB]) {
    assert.equal(path.dirname(first.workspaceRoot), stateRoot);
    assert.match(path.basename(first.workspaceRoot), /^r-[a-f0-9]{20}$/u, "workspace suffix stays short even for deep project paths");
  }
  const workspaceB = directoryObservationDigest(firstB.workspaceRoot);
  for (const [target, first] of [[projectA, firstA], [projectB, firstB]]) {
    const continued = jsonCli(argsFor("resume", target), env);
    assert.equal(continued.status, "completed");
    assert.equal(continued.sessionId, first.sessionId);
    assert.equal(continued.workspaceRoot, first.workspaceRoot);
  }
  const recordsB = directoryObservationDigest(path.join(projectB, ".dove/reviews"));
  writeFile(projectA, "paper/main.tex", "Project A revised full version.\n");
  const nextA = jsonCli(argsFor("rerun", projectA, ["paper/main.tex"]), env);
  assert.equal(nextA.status, "completed");
  assert.equal(nextA.round, 2);
  assert.equal(nextA.sessionId, firstA.sessionId);
  assert.equal(nextA.workspaceRoot, firstA.workspaceRoot);
  assertDigestEqual(directoryObservationDigest(firstB.workspaceRoot), workspaceB, "A rerun must not change B materials");
  assertDigestEqual(directoryObservationDigest(path.join(projectB, ".dove/reviews")), recordsB, "A rerun must not change B records");
  const lastB = jsonCli(argsFor("resume", projectB), env);
  assert.equal(lastB.status, "completed");
  assert.equal(lastB.sessionId, firstB.sessionId);
  assert.equal(lastB.workspaceRoot, firstB.workspaceRoot);
  const sharedInvocations = fs.readFileSync(fakeLog, "utf8").trim().split("\n").map(JSON.parse).filter((item) => [firstA.sessionId, firstB.sessionId].includes(item.sessionId));
  assert.deepEqual(sharedInvocations.filter((item) => item.sessionId === firstA.sessionId).map((item) => item.materialBytes["paper/main.tex"]), ["Project A frozen version one.\n", "Project A frozen version one.\n", "Project A revised full version.\n"].map((text) => Buffer.from(text).toString("hex")));
  assert.ok(sharedInvocations.filter((item) => item.sessionId === firstB.sessionId).every((item) => item.cwd === firstB.workspaceRoot && item.materialBytes["paper/main.tex"] === Buffer.from("Project B frozen version one.\n").toString("hex")));

  const beforePreparationA = directoryObservationDigest(firstA.workspaceRoot);
  const beforePreparationB = directoryObservationDigest(firstB.workspaceRoot);
  const recordAPath = path.join(projectA, ".dove/reviews", sharedId, "review.json");
  const recordBeforePreparation = fs.readFileSync(recordAPath);
  const sessionAPath = path.join(sessionRoot, `${firstA.sessionId}.json`);
  const historyBeforePreparation = readJson(sessionAPath).history;
  writeFile(projectA, "paper/main.tex", "A revision whose record transaction will fail.\n");
  let injectedFailure = false;
  assert.throws(() => publicCore.rerunReview({
    project: projectA, id: sharedId, materials: ["paper/main.tex"], stateRoot, env,
    spawnSync() { assert.fail("preparation failure must not call the reviewer"); },
    fsOps: {
      ...fs,
      mkdirSync(target, ...args) {
        if (!injectedFailure && String(target).startsWith(path.join(projectA, ".dove/reviews/.transactions"))) {
          injectedFailure = true;
          throw new Error("injected review preparation failure");
        }
        return fs.mkdirSync(target, ...args);
      }
    }
  }), /injected review preparation failure/u);
  assert.equal(injectedFailure, true);
  assertDigestEqual(directoryObservationDigest(firstA.workspaceRoot), beforePreparationA, "before calling the backend, failed preparation may restore the old materials");
  assert.deepEqual(fs.readFileSync(recordAPath), recordBeforePreparation);
  assert.deepEqual(readJson(sessionAPath).history, historyBeforePreparation);

  let backendCalled = false;
  let commitFailure = false;
  const oldReturns = directoryObservationDigest(path.join(projectA, ".dove/reviews", sharedId, "rounds"));
  assert.throws(() => publicCore.rerunReview({
    project: projectA, id: sharedId, materials: ["paper/main.tex"], stateRoot, env,
    spawnSync(command, args, options) {
      const prepared = readJson(recordAPath);
      assert.equal(prepared.currentRound, 3);
      assert.equal(prepared.status, "pending");
      assert.deepEqual(prepared.pendingExchange, { round: 3, workspaceRoot: firstA.workspaceRoot, requestedSessionId: firstA.sessionId });
      assert.equal(fs.existsSync(path.join(projectA, prepared.rounds[2].snapshotPath)), true);
      backendCalled = true;
      return spawnSync(command, args, options);
    },
    fsOps: {
      ...fs,
      renameSync(source, destination) {
        if (backendCalled && !commitFailure && destination === recordAPath) {
          commitFailure = true;
          throw new Error("injected review return commit failure");
        }
        return fs.renameSync(source, destination);
      }
    }
  }), /return was not saved[\s\S]*cannot recover this unsaved return[\s\S]*injected review return commit failure/u);
  assert.equal(commitFailure, true);
  const pending = readJson(recordAPath);
  assert.equal(pending.currentRound, 3, "post-call failure must not pretend the reviewer stayed on round 2");
  assert.equal(pending.status, "pending");
  assert.equal(pending.pendingExchange.requestedSessionId, firstA.sessionId);
  assert.equal(pending.rounds[2].reportPath, null);
  assert.equal(fs.existsSync(path.join(projectA, ".dove/reviews", sharedId, "rounds/3/report.md")), false);
  assert.equal(fs.readFileSync(path.join(firstA.workspaceRoot, "paper/main.tex"), "utf8"), "A revision whose record transaction will fail.\n");
  assert.equal(readJson(sessionAPath).history.length, historyBeforePreparation.length + 1);
  for (const [file, fact] of oldReturns) assert.deepEqual(directoryObservationDigest(path.join(projectA, ".dove/reviews", sharedId, "rounds")).get(file), fact, "previous returns remain unchanged");
  assertDigestEqual(directoryObservationDigest(firstB.workspaceRoot), beforePreparationB, "A failures must not touch B workspace");
  const pendingStatus = assertReviewStatusReadOnly(projectA, env, argsFor("status", projectA), (status) => {
    assert.equal(status.status, "pending");
    assert.deepEqual(status.pendingExchange, pending.pendingExchange);
  });
  assert.equal(pendingStatus.rounds[2].latestReportPath, null);
  const pendingHuman = cliReview(argsFor("status", projectA).filter((arg) => arg !== "--json"), env);
  assert.equal(pendingHuman.status, 0);
  assert.match(pendingHuman.stdout, /待完成交换[\s\S]*返回匹配[\s\S]*不会找回未保存/u);
  assert.match(pendingHuman.stdout, /尚未保存/u);
  assert.throws(() => publicCore.rerunReview({ project: projectA, id: sharedId, materials: ["paper/main.tex"], stateRoot, env }), /pending exchange; use resume/u);
  writeFile(projectA, "paper/main.tex", "Unsubmitted author change must not replace pending frozen materials.\n");
  const recovered = jsonCli(argsFor("resume", projectA), env);
  assert.equal(recovered.status, "completed");
  assert.equal(recovered.round, 3);
  assert.equal(recovered.sessionId, firstA.sessionId);
  assert.equal(recovered.pendingExchange, null);
  const recoveredHistory = readJson(sessionAPath).history;
  assert.deepEqual(recoveredHistory.at(-1).materialBytes, recoveredHistory.at(-2).materialBytes, "resume continues the materials already seen, not old or newly edited author files");
  assert.deepEqual(recoveredHistory.slice(0, -2), historyBeforePreparation);
  assert.equal(fs.readdirSync(stateRoot).some((entry) => entry.includes(".previous-") || entry.includes(".staging-")), false);

  const currentReturns = directoryObservationDigest(path.join(projectA, ".dove/reviews", sharedId, "rounds/3"));
  backendCalled = false;
  commitFailure = false;
  assert.throws(() => publicCore.resumeReview({
    project: projectA, id: sharedId, stateRoot, env,
    spawnSync(command, args, options) {
      backendCalled = true;
      return spawnSync(command, args, options);
    },
    fsOps: {
      ...fs,
      renameSync(source, destination) {
        if (backendCalled && !commitFailure && destination === recordAPath) {
          commitFailure = true;
          throw new Error("injected resume return commit failure");
        }
        return fs.renameSync(source, destination);
      }
    }
  }), /return was not saved[\s\S]*injected resume return commit failure/u);
  assert.equal(commitFailure, true);
  assert.equal(readJson(recordAPath).pendingExchange.round, 3);
  assert.equal(readJson(sessionAPath).history.length, recoveredHistory.length + 1);
  assertDigestEqual(directoryObservationDigest(path.join(projectA, ".dove/reviews", sharedId, "rounds/3")), currentReturns, "failed resume commit must preserve all existing round returns");

  const failedResume = jsonCli(argsFor("resume", projectA), { ...env, DOVE_FAKE_CLAUDE_FAIL: "1" }, { expectedStatus: 1 });
  assert.equal(failedResume.status, "failed");
  assert.equal(failedResume.sessionId, firstA.sessionId);
  assertReviewStatusReadOnly(projectA, env, argsFor("status", projectA), (status) => assert.equal(status.status, "failed"));
  const humanFailure = cliReview(argsFor("resume", projectA).filter((arg) => arg !== "--json"), { ...env, DOVE_FAKE_CLAUDE_FAIL: "1" });
  assert.equal(humanFailure.status, 1);
  assert.equal(humanFailure.stderr, "");
  assert.match(humanFailure.stdout, /运行失败/u);
  assert.doesNotMatch(humanFailure.stdout, /已完成|已恢复并更新/u);
  const negativeVerdict = "## Verdict\n\nReject this synthetic paper: the central claim is unsupported.\n\n## Blocking issues\n\nMissing decisive evidence.\n\n## Grounding basis\n\nCopied material only.\n\n## Author-side next actions\n\nInvestigate the claim.\n";
  const negativeReturn = jsonCli(argsFor("resume", projectA), { ...env, DOVE_FAKE_REPORT: negativeVerdict });
  assert.equal(negativeReturn.status, "completed", "a negative scientific verdict is not a runtime failure");
  assert.equal(fs.readFileSync(path.join(projectA, negativeReturn.latestReportPath), "utf8"), negativeVerdict);

  // Old shared-id cwd receipts cannot prove ownership. Fail closed, without path discovery or migration.
  const legacyProject = makeProject(tempRoot, "recorded-workspace");
  const legacyId = "existing-session";
  const legacyOptions = { project: legacyProject, id: legacyId, materials: ["paper/main.tex"], stateRoot, env };
  const legacyFirst = publicCore.handoffReview(legacyOptions);
  const legacyPeer = publicCore.handoffReview({ ...legacyOptions, project: projectB });
  assert.equal(legacyFirst.status, "completed");
  assert.equal(legacyPeer.status, "completed");
  const legacyRoot = path.join(stateRoot, legacyId);
  fs.renameSync(legacyFirst.workspaceRoot, legacyRoot);
  for (const [target, first] of [[legacyProject, legacyFirst], [projectB, legacyPeer]]) {
    const backendPath = path.join(target, first.backendPath);
    writeJson(backendPath, { ...readJson(backendPath), cwd: legacyRoot });
    writeJson(path.join(sessionRoot, `${first.sessionId}.json`), { cwd: legacyRoot });
  }
  const legacyBefore = directoryObservationDigest(legacyRoot);
  const peerBefore = directoryObservationDigest(legacyPeer.workspaceRoot);
  const callsBeforeLegacy = fs.readFileSync(fakeLog, "utf8");
  for (const target of [legacyProject, projectB]) {
    const options = { ...legacyOptions, project: target };
    const recordsBefore = directoryObservationDigest(path.join(target, ".dove/reviews", legacyId));
    assert.throws(() => publicCore.rerunReview(options), /Start a new review id/u);
    assertDigestEqual(directoryObservationDigest(path.join(target, ".dove/reviews", legacyId)), recordsBefore, "unowned rerun must not write a round");
    const resumed = publicCore.resumeReview(options);
    assert.equal(resumed.status, "failed");
    assert.match(readJson(path.join(target, resumed.latestBackendPath)).error, /Start a new review id/u);
  }
  assert.equal(fs.readFileSync(fakeLog, "utf8"), callsBeforeLegacy, "unowned old sessions must not launch a reviewer or rediscover a new workspace");
  assertDigestEqual(directoryObservationDigest(legacyRoot), legacyBefore, "neither old project may replace the shared-id workspace");
  assertDigestEqual(directoryObservationDigest(legacyPeer.workspaceRoot), peerBefore, "recorded cwd must not silently fall back to the computed workspace");
  const fresh = publicCore.handoffReview({ ...legacyOptions, id: "fresh-owned-session" });
  assert.equal(fresh.status, "completed");
  assert.notEqual(fresh.workspaceRoot, legacyRoot);
  const freshBackendPath = path.join(legacyProject, fresh.backendPath);
  writeJson(freshBackendPath, { ...readJson(freshBackendPath), cwd: firstA.workspaceRoot });
  const foreignBefore = directoryObservationDigest(firstA.workspaceRoot);
  assert.throws(() => publicCore.rerunReview({ ...legacyOptions, id: fresh.reviewId }), /recorded workspace must belong to this project/u);
  assertDigestEqual(directoryObservationDigest(firstA.workspaceRoot), foreignBefore, "a foreign project's recorded cwd must not authorize replacement");

  for (const [label, core] of coreEntries) {
    for (const internal of ["createReviewSnapshot", "snapshotDigest", "runClaudeReviewBackend"]) {
      assert.equal(Object.hasOwn(core, internal), false, `${label} must keep raw hash receipt helpers internal`);
    }
    const id = `public-core-${label}`;
    const options = { project, id, venue: "TestConf 2026", materials: ["paper/main.tex"], stateRoot, claudeCommand: fakeClaude, env };
    const first = core.handoffReview(options);
    assert.equal(first.status, "completed");
    assertNoPublicHashFields(first);
    let materialReads = 0;
    const currentnessStatus = core.inspectReviewStatus({
      ...options,
      fsOps: {
        ...fs,
        openSync() { assert.fail("material currentness must not use fd forensics"); },
        readFileSync(file, ...args) {
          const bytes = fs.readFileSync(file, ...args);
          if (file === path.join(project, "paper", "main.tex")) materialReads += 1;
          return bytes;
        }
      }
    });
    assert.equal(materialReads, 1, "status must read each normalized material path only once");
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
    const secondSnapshotPath = path.join(project, `.dove/reviews/${id}/rounds/2/snapshot.json`);
    const secondSnapshot = readJson(secondSnapshotPath);
    secondSnapshot.materials[0].path = "paper\\main.tex";
    writeJson(secondSnapshotPath, secondSnapshot);
    const readsAcrossRounds = new Map();
    const inspectCached = () => core.inspectReviewStatus({
      ...options,
      fsOps: {
        ...fs,
        openSync() { assert.fail("currentness must not open descriptors"); },
        readFileSync(file, ...args) {
          if (file === path.join(project, "paper/main.tex")) readsAcrossRounds.set(file, (readsAcrossRounds.get(file) ?? 0) + 1);
          return fs.readFileSync(file, ...args);
        }
      }
    });
    assert.equal(inspectCached().materialCurrentness.overall, "current");
    assert.equal(readsAcrossRounds.get(path.join(project, "paper/main.tex")), 1, "all rounds share one normalized-path observation");
    assert.equal(inspectCached().materialCurrentness.overall, "current");
    assert.equal(readsAcrossRounds.get(path.join(project, "paper/main.tex")), 2, "cache must not outlive a status call");
    secondSnapshot.materials[0].path = "paper/main.tex";
    writeJson(secondSnapshotPath, secondSnapshot);
    const projectMaterialPath = path.join(project, "paper/main.tex");
    const originalProjectBytes = fs.readFileSync(projectMaterialPath);
    const sameSizeChange = Buffer.from(originalProjectBytes);
    sameSizeChange[0] ^= 1;
    fs.writeFileSync(projectMaterialPath, sameSizeChange);
    assert.equal(core.inspectReviewStatus(options).materialCurrentness.overall, "changed", "same-size project changes must still be detected by material SHA");
    fs.writeFileSync(projectMaterialPath, originalProjectBytes);
    const referenceFile = path.join(first.workspaceRoot, DOVE_REVIEW_QUALITY_REFERENCE_PATH);
    const referenceBytes = fs.readFileSync(referenceFile);
    fs.writeFileSync(referenceFile, "not canonical guidance");
    const badReference = core.resumeReview(options);
    assert.equal(badReference.status, "failed");
    assert.match(readJson(path.join(project, badReference.latestBackendPath)).error, /does not match canonical guidance/u);
    fs.writeFileSync(referenceFile, referenceBytes);
    assert.equal(core.resumeReview(options).status, "completed");
    const workspaceFile = path.join(first.workspaceRoot, "paper", "main.tex");
    const frozenBytes = fs.readFileSync(workspaceFile);
    const changedBytes = Buffer.from(frozenBytes);
    changedBytes[0] ^= 1;
    fs.writeFileSync(workspaceFile, changedBytes);
    const tampered = core.resumeReview(options);
    assert.equal(tampered.status, "failed", "same-size workspace changes must still be detected by internal SHA");
    assertNoPublicHashFields(tampered);
    assert.match(readJson(path.join(project, tampered.latestBackendPath)).error, /no longer matches the frozen snapshot/u);
    fs.writeFileSync(workspaceFile, frozenBytes);
    assert.equal(core.resumeReview(options).status, "completed", "local material-check failure must not hide the last saved successful session return");
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
    for (const executable of SOURCE_ONLY ? ["dove.mjs"] : ["dove.mjs", "dove-package.mjs"]) {
      const human = spawnSync(process.execPath, [path.join(ROOT, "bin", executable), "review", "status", "--project", project, "--id", id], { cwd: ROOT, encoding: "utf8", env });
      assert.equal(human.status, 0, human.stderr);
      assert.doesNotMatch(human.stdout, /internal-only-receipt|sha256|reportSha256|[a-f0-9]{64}/u);
    }
  }

  console.log(JSON.stringify({ status: "passed" }, null, 2));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
