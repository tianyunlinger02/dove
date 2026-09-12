import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { writeFileSetTransaction } from "../src/core/file-set-transaction.mjs";
import { createProjectInstallationManifest, readProjectInstallationManifest } from "../src/core/project-installation-manifest.mjs";
import { assertManagedOwnership, planJsonFragments, preparePlan } from "../src/core/project-installation-plan.mjs";
import { inspectProjectDoctor } from "../src/core/project-doctor.mjs";
import { resourcesForHosts } from "../src/core/project-installation-resources.mjs";
import { prepareResearchDefaults } from "../src/core/research-defaults.mjs";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../src/core/package-metadata.mjs";
import { inspectResearchDocuments } from "../src/core/research-documents.mjs";
import { parseJsonWithoutDuplicateKeys } from "../src/core/strict-json.mjs";
import { readRunEvents, inspectLatestRunFacts } from "../src/core/run-record.mjs";
import { handoffReview, inspectReviewStatus, resumeReview } from "../src/core/review-runtime.mjs";
import { runClaudeReviewBackend } from "../src/core/review-claude-backend.mjs";
import { DOVE_REVIEW_QUALITY_REFERENCE_PATH, prepareReviewWorkspace } from "../src/core/review-workspace.mjs";
import { normalizeReviewMaterialList } from "../src/core/review-snapshot.mjs";
import { renderDoveResearchQualityReference } from "../src/core/dove-research-contract.mjs";

// Synthetic records only. No install/sync, real workspace, or model invocation.
const scratch = fileURLToPath(new URL("../.claude/tmp/", import.meta.url));
function fixture(t) {
  fs.mkdirSync(scratch, { recursive: true });
  const root = fs.mkdtempSync(path.join(scratch, "dove-runtime-json-transaction-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function write(root, name, content) {
  const target = path.join(root, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}
function projectFixture(root) {
  const project = path.join(root, "project");
  const manifest = createProjectInstallationManifest({ package: { name: "dove", version: "3.0.5" }, hosts: ["claude"], now: "2026-09-02T00:00:00.000Z" }, { hostIds: ["claude"] });
  write(project, ".dove/install/manifest.json", JSON.stringify(manifest));
  return { project, manifest };
}
test("SessionStart source and bundle attempt no writes while warning or returning facts", (t) => {
  const { project, manifest } = projectFixture(fixture(t));
  fs.mkdirSync(path.join(project, ".git"));
  write(project, ".dove/research/RESEARCH.md", "research body must not be read");
  const guard = `
    import fs from "node:fs";
    import { syncBuiltinESMExports } from "node:module";
    const reject = () => { process.stderr.write("forbidden hook write\\n"); throw new Error("hook write"); };
    for (const method of ["writeFileSync", "appendFileSync", "mkdirSync", "renameSync", "unlinkSync", "rmSync", "rmdirSync", "chmodSync", "utimesSync", "writeSync", "createWriteStream"]) fs[method] = reject;
    const open = fs.openSync;
    fs.openSync = (file, flags, ...args) => {
      if (typeof flags === "string" ? /[wa+]/u.test(flags) : flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT)) reject();
      return open(file, flags, ...args);
    };
    const read = fs.readFileSync;
    fs.readFileSync = (file, ...args) => {
      if (String(file).startsWith(${JSON.stringify(path.join(project, ".dove/research/"))})) {
        process.stderr.write("forbidden research body read\\n");
        throw new Error("research body read");
      }
      return read(file, ...args);
    };
    syncBuiltinESMExports();
  `;
  for (const revision of ["2.0", "1.0"]) {
    write(project, ".dove/install/manifest.json", JSON.stringify({ ...manifest, revision }));
    for (const executable of ["dove.mjs", "dove-package.mjs"]) {
      for (const source of ["startup", "clear", "compact", "resume"]) {
        const result = spawnSync(process.execPath, [
          "--import", `data:text/javascript,${encodeURIComponent(guard)}`,
          fileURLToPath(new URL(`../bin/${executable}`, import.meta.url)), "hook", "session-start", "--project", project
        ], { cwd: project, encoding: "utf8", input: JSON.stringify({ hook_event_name: "SessionStart", source, cwd: project }) });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stderr, "", "caught forbidden reads/writes must still fail validation");
        const output = JSON.parse(result.stdout);
        assert.ok(output.systemMessage.includes("dove update"));
        assert.equal(Object.hasOwn(output, "hookSpecificOutput"), revision === "2.0" && ["compact", "resume"].includes(source));
        if (output.hookSpecificOutput) assert.ok(output.hookSpecificOutput.additionalContext.includes("RESEARCH.md: exists=yes"));
      }
    }
  }
});

const parseFile = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const fakeBackend = (_command, args) => ({ status: 0, stdout: JSON.stringify({ session_id: args.at(-1), result: "A bounded fake reviewer return." }) });

test("transaction success and promotion rollback preserve ordinary bytes and modes", (t) => {
  const root = fixture(t);
  write(root, "a.txt", "old-a");
  fs.chmodSync(path.join(root, "a.txt"), 0o640);
  const entries = [{ root, relativePath: "a.txt", content: "new-a", force: true }, { root, relativePath: "new/b.txt", content: "new-b" }];
  assert.throws(() => writeFileSetTransaction(entries, {
    transactionId: "rollback", transactionBase: "transactions",
    fsOps: { ...fs, renameSync(source, destination) {
      if (destination === path.join(root, "new/b.txt")) throw new Error("injected promotion failure");
      return fs.renameSync(source, destination);
    } }
  }), /all staged changes were rolled back.*injected promotion failure/u);
  assert.equal(fs.readFileSync(path.join(root, "a.txt"), "utf8"), "old-a");
  assert.equal(fs.statSync(path.join(root, "a.txt")).mode & 0o777, 0o640);
  assert.equal(fs.existsSync(path.join(root, "transactions")), false);
  assert.equal(fs.existsSync(path.join(root, "new")), false);
  assert.deepEqual(writeFileSetTransaction(entries, { transactionBase: "transactions" }).writtenPaths, ["a.txt", "new/b.txt"]);
  assert.equal(fs.readFileSync(path.join(root, "a.txt"), "utf8"), "new-a");
  assert.equal(fs.statSync(path.join(root, "a.txt")).mode & 0o777, 0o640);
});

test("failed transaction restore retains its root and backup and reports absolute paths", (t) => {
  const root = fixture(t);
  write(root, "a.txt", "irreplaceable original");
  write(root, "b.txt", "original-b");
  const transaction = path.join(root, "transactions/restore-failure");
  const backup = path.join(transaction, "backups/file-0");
  assert.throws(() => writeFileSetTransaction([
    { root, relativePath: "a.txt", content: "new-a", force: true },
    { root, relativePath: "b.txt", content: "new-b", force: true }
  ], {
    transactionBase: "transactions", transactionId: "restore-failure",
    fsOps: { ...fs, renameSync(source, destination) {
      if (source === backup) throw new Error("injected restore failure");
      if (destination === path.join(root, "b.txt") && source.endsWith(".tmp")) throw new Error("injected promotion failure");
      return fs.renameSync(source, destination);
    } }
  }), (error) => {
    assert.match(error.message, /rollback also failed.*injected restore failure/u);
    assert.ok(error.message.includes(transaction));
    assert.ok(error.message.includes(path.join(transaction, "backups")));
    return true;
  });
  assert.equal(fs.readFileSync(backup, "utf8"), "irreplaceable original");
  assert.equal(fs.readFileSync(path.join(root, "b.txt"), "utf8"), "original-b");
  assert.equal(fs.existsSync(path.join(root, "a.txt")), false);
});

test("occupied rollback target is untouched and its original backup survives", (t) => {
  const root = fixture(t);
  write(root, "a.txt", "old-a");
  const transaction = path.join(root, "transactions/occupied");
  assert.throws(() => writeFileSetTransaction([{ root, relativePath: "a.txt", content: "new-a", force: true }], {
    transactionBase: "transactions", transactionId: "occupied",
    fsOps: { ...fs, renameSync(source, destination) {
      if (source.endsWith(".tmp")) {
        fs.writeFileSync(destination, "concurrent user content");
        throw new Error("injected promotion failure with occupied target");
      }
      return fs.renameSync(source, destination);
    } }
  }), (error) => {
    assert.match(error.message, /rollback target is occupied/u);
    assert.ok(error.message.includes(transaction));
    return true;
  });
  assert.equal(fs.readFileSync(path.join(root, "a.txt"), "utf8"), "concurrent user content");
  assert.equal(fs.readFileSync(path.join(transaction, "backups/file-0"), "utf8"), "old-a");
});

test("rollback preserves a concurrently changed promoted target and its original backup", (t) => {
  const root = fixture(t);
  write(root, "a.txt", "original-a");
  write(root, "b.txt", "original-b");
  const transaction = path.join(root, "transactions/changed-promoted");
  assert.throws(() => writeFileSetTransaction([
    { root, relativePath: "a.txt", content: "promoted-a", force: true },
    { root, relativePath: "b.txt", content: "promoted-b", force: true }
  ], {
    transactionBase: "transactions", transactionId: "changed-promoted",
    fsOps: { ...fs, renameSync(source, destination) {
      if (source.endsWith(".tmp") && destination === path.join(root, "b.txt")) {
        fs.writeFileSync(path.join(root, "a.txt"), "concurrent user content");
        throw new Error("injected later promotion failure");
      }
      return fs.renameSync(source, destination);
    } }
  }), (error) => {
    assert.match(error.message, /rollback target changed/u);
    assert.ok(error.message.includes(transaction));
    return true;
  });
  assert.equal(fs.readFileSync(path.join(root, "a.txt"), "utf8"), "concurrent user content");
  assert.equal(fs.readFileSync(path.join(root, "b.txt"), "utf8"), "original-b");
  assert.equal(fs.readFileSync(path.join(transaction, "backups/file-0"), "utf8"), "original-a");
});

test("runtime installation JSON uses ordinary parsing and keeps manifest domain validation", (t) => {
  const root = fixture(t);
  const { project, manifest } = projectFixture(root);
  const file = path.join(project, ".dove/install/manifest.json");
  fs.writeFileSync(file, JSON.stringify(manifest).replace('"revision":"2.0"', '"revision":"unsupported","revision":"2.0"'));
  assert.equal(readProjectInstallationManifest(project, { hostIds: ["claude"] }).revision, "2.0");
  fs.writeFileSync(file, JSON.stringify({ ...manifest, revision: "unsupported" }));
  assert.throws(() => readProjectInstallationManifest(project, { hostIds: ["claude"] }), /revision must equal 2.0/u);
  fs.writeFileSync(file, "{broken");
  assert.throws(() => readProjectInstallationManifest(project, { hostIds: ["claude"] }), /Invalid Dove project installation manifest/u);
});

test("software format marker uses ordinary JSON parsing and remains read-only", (t) => {
  const root = fixture(t);
  const file = write(root, ".dove/format.json", '{"format":"other","format":"dove-research-v2"}');
  assert.equal(inspectResearchDocuments(root).state, "previous-research-format");
  assert.equal(fs.readFileSync(file, "utf8"), '{"format":"other","format":"dove-research-v2"}');
  fs.writeFileSync(file, '{"format":"dove-research-v2","extra":true}');
  assert.equal(inspectResearchDocuments(root).state, "absent", "domain recognition requires the exact marker shape");
  fs.writeFileSync(file, "{broken");
  assert.equal(inspectResearchDocuments(root).state, "invalid");
  assert.equal(fs.existsSync(path.join(root, ".dove/research")), false);
});

test("installation planning owns only the quality reference and leaves existing research opaque", (t) => {
  const { project } = projectFixture(fixture(t));
  write(project, ".dove/research/notes.bin", Buffer.from([0xff, 0x00]));
  const fsOps = { ...fs };
  for (const method of ["readFileSync", "readdirSync"]) {
    fsOps[method] = (file, ...args) => {
      assert.ok(!String(file).startsWith(path.join(project, ".dove/research")), "planning must not inspect research children");
      return fs[method](file, ...args);
    };
  }
  assert.deepEqual(prepareResearchDefaults(project, { fsOps }).entries, []);
  for (const hosts of [["claude"], ["dsh"], ["claude", "dsh"]]) {
    const plan = preparePlan({ root: project, hosts, packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION, now: "2026-09-03T00:00:00.000Z", fsOps });
    assert.deepEqual(plan.entries.filter((entry) => entry.relativePath.startsWith(".dove/")).map((entry) => entry.relativePath).sort(), [".dove/install/RESEARCH_QUALITY.md", ".dove/install/manifest.json"]);
    assertManagedOwnership(plan.manifest);
    assert.equal(resourcesForHosts(hosts).filter((entry) => entry.path === ".dove/install/RESEARCH_QUALITY.md").length, 1);
    for (const file of [".dove/install/DOCTOR.md", ".dove/install/unknown.md", ".dove/research/notes.bin", ".dove/reviews/review.json", ".dove/runs/run.jsonl", "scripts/old-runtime.mjs"]) {
      assert.throws(() => assertManagedOwnership({ ...plan.manifest, managed: [...plan.manifest.managed, { path: file, kind: "exclusive-file", selector: null }] }), /unknown ownership/u);
    }
  }
  assert.equal(fs.existsSync(path.join(project, ".claude")), false, "plans must not install host resources");
  assert.equal(fs.existsSync(path.join(project, ".dove/install/RESEARCH_QUALITY.md")), false);
});

test("Doctor inspects synthetic uninitialized, refreshable and blocked state without changing files", (t) => {
  const root = fixture(t);
  const { project, manifest } = projectFixture(root);
  fs.mkdirSync(path.join(project, ".git"));
  const manifestPath = path.join(project, ".dove/install/manifest.json");
  const options = { packageName: PACKAGE_NAME, packageVersion: PACKAGE_VERSION };
  assert.equal(inspectProjectDoctor(project, options).setup.mode, "needs-update");
  assert.equal(fs.existsSync(path.join(project, ".claude")), false);
  for (const revision of ["1.0", "3.0"]) {
    const bytes = JSON.stringify({ ...manifest, revision });
    fs.writeFileSync(manifestPath, bytes);
    assert.equal(inspectProjectDoctor(project, options).setup.mode, "blocked");
    assert.equal(fs.readFileSync(manifestPath, "utf8"), bytes);
  }
  fs.unlinkSync(manifestPath);
  assert.equal(inspectProjectDoctor(project, options).setup.mode, "uninitialized");
  assert.equal(fs.existsSync(manifestPath), false);
});

test("shared user configuration still rejects duplicate keys without writing", (t) => {
  const root = fixture(t);
  for (const relative of [".claude/settings.json", ".mcp.json"]) {
    const duplicate = '{"user":{"keep":1,"keep":2}}';
    const file = write(root, relative, duplicate);
    assert.throws(() => planJsonFragments(root, relative, [], []), /duplicate/iu);
    assert.equal(fs.readFileSync(file, "utf8"), duplicate);
    fs.writeFileSync(file, "[]");
    assert.throws(() => planJsonFragments(root, relative, [], []), /JSON object/u);
  }
  assert.throws(() => parseJsonWithoutDuplicateKeys('{"a":1,"\\u0061":2}'), /duplicate/iu);
});

test("runtime Run JSON keeps sequence, schema, identity and syntax checks with ordinary parsing", (t) => {
  const { project } = projectFixture(fixture(t));
  const event = { schemaVersion: "dove.run.event.v1", seq: 1, at: "2026-09-02T00:00:00.000Z", type: "run.started", runId: "json-run", supervisorPid: null };
  const file = write(project, ".dove/runs/json-run/run.jsonl", JSON.stringify(event).replace('"seq":1', '"seq":9,"seq":1') + "\n");
  assert.equal(readRunEvents(project, "json-run")[0].seq, 1);
  assert.equal(inspectLatestRunFacts({ project }).runId, "json-run");
  for (const patch of [{ seq: 2 }, { schemaVersion: "other" }, { runId: "other" }, { at: "not-a-date" }]) {
    fs.writeFileSync(file, JSON.stringify({ ...event, ...patch }) + "\n");
    assert.throws(() => readRunEvents(project, "json-run"));
  }
  fs.writeFileSync(file, "{broken\n");
  assert.throws(() => readRunEvents(project, "json-run"), SyntaxError);
});

test("review record, snapshot and backend JSON use ordinary parsing without losing session validation", (t) => {
  const root = fixture(t);
  const { project } = projectFixture(root);
  write(project, "paper.tex", "frozen manuscript");
  const options = { project, id: "json-review", materials: ["paper.tex"], stateRoot: path.join(root, "state"), spawnSync: fakeBackend };
  const first = handoffReview(options);
  assert.equal(first.status, "completed");
  const recordPath = path.join(project, ".dove/reviews/json-review/review.json");
  const record = parseFile(recordPath);
  fs.writeFileSync(recordPath, JSON.stringify(record).replace('"currentRound":1', '"currentRound":8,"currentRound":1'));
  const snapshotPath = path.join(project, first.snapshotPath);
  const snapshot = parseFile(snapshotPath);
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot).replace('"round":1', '"round":9,"round":1'));
  const backendPath = path.join(project, first.backendPath);
  const backend = parseFile(backendPath);
  fs.writeFileSync(backendPath, JSON.stringify(backend).replace('"cwd":', '"cwd":"unusable","cwd":'));
  assert.equal(inspectReviewStatus(options).materialCurrentness.overall, "current");
  assert.equal(resumeReview(options).status, "completed");
  fs.writeFileSync(recordPath, JSON.stringify({ ...record, schema: "other" }));
  assert.throws(() => inspectReviewStatus(options), /not a valid Dove review record/u);
  fs.writeFileSync(recordPath, JSON.stringify(record));
  fs.writeFileSync(snapshotPath, JSON.stringify({ ...snapshot, materials: null }));
  assert.equal(inspectReviewStatus(options).materialCurrentness.overall, "unavailable");

  const run = (stdout) => runClaudeReviewBackend({ session: { sessionId: "expected" }, spawnSync: () => ({ status: 0, stdout }) });
  assert.equal(run('{"session_id":"wrong","session_id":"expected","result":"review"}').status, "completed");
  for (const text of ['{"session_id":"wrong","result":"review"}', '{"session_id":"expected"}', '[]', '{broken', '{"session_id":"expected","is_error":true,"result":"failure"}']) assert.equal(run(text).status, "failed");
});

test("package review reference is canonical guidance, never user evidence or permission expansion", (t) => {
  const root = fixture(t);
  const { project } = projectFixture(root);
  write(project, DOVE_REVIEW_QUALITY_REFERENCE_PATH, "user replacement must not be copied");
  write(project, "paper.tex", "frozen manuscript");
  assert.throws(() => normalizeReviewMaterialList([DOVE_REVIEW_QUALITY_REFERENCE_PATH], { projectRoot: project }), /private or Dove-owned/u);
  assert.throws(() => prepareReviewWorkspace({ reviewId: "reference", projectRoot: project, stateRoot: path.join(root, "state"), files: [{ path: DOVE_REVIEW_QUALITY_REFERENCE_PATH, bytes: Buffer.from("user") }] }), /must not be listed as user material/u);
  const result = handoffReview({ project, id: "reference", materials: ["paper.tex"], stateRoot: path.join(root, "state"), spawnSync(command, args, options) {
    assert.equal(fs.readFileSync(path.join(options.cwd, DOVE_REVIEW_QUALITY_REFERENCE_PATH), "utf8"), renderDoveResearchQualityReference());
    assert.match(options.input, /not user material or research evidence/u);
    assert.doesNotMatch(options.input, /sha256/u);
    assert.deepEqual(args.slice(args.indexOf("--tools"), args.indexOf("--tools") + 4), ["--tools", "Read", "--permission-mode", "dontAsk"]);
    return fakeBackend(command, args);
  } });
  assert.equal(result.status, "completed");
  assert.deepEqual(result.materials.map((item) => item.path), ["paper.tex"]);
  assert.deepEqual(parseFile(path.join(project, result.snapshotPath)).materials.map((item) => item.path), ["paper.tex"]);
});
