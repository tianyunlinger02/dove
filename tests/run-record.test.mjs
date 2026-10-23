import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { renderRunResult } from "../src/cli/run-output.mjs";
import { compareRuns, inspectLatestRunFacts, inspectRunStatus, listRunSummaries, normalizeRunCommandArgv } from "../src/core/run-record.mjs";

const ROOT = "/memory/dove/project";
const NOW = "2026-10-23T00:00:00.000Z";
const WRITE_METHODS = ["writeFileSync", "appendFileSync", "mkdirSync", "mkdtempSync", "renameSync", "unlinkSync", "rmSync", "rmdirSync", "chmodSync", "truncateSync", "utimesSync"];

// The same Map-backed fsOps pattern as the other memory tests: every fixture
// byte stays in memory, and even swallowed disk I/O or writes fail the test.
function memoryRuns(t) {
  const diskIO = [];
  const writes = [];
  for (const name of [...WRITE_METHODS, "readFileSync", "statSync", "lstatSync", "realpathSync", "readdirSync", "openSync", "fstatSync", "readSync", "closeSync"]) {
    t.mock.method(fs, name, () => {
      diskIO.push(name);
      assert.fail(`Unexpected disk I/O: ${name}`);
    });
  }
  const nodes = new Map([["/", { type: "directory" }]]);
  const fullReads = [];
  const metadataReads = [];
  const listings = [];
  const handles = new Map();
  let nextFd = 1;
  const get = (file) => {
    if (!nodes.has(file)) throw Object.assign(new Error(`ENOENT: ${file}`), { code: "ENOENT" });
    return nodes.get(file);
  };
  const stat = (file) => {
    const node = get(file);
    return { isDirectory: () => node.type === "directory", isFile: () => node.type === "file", isSymbolicLink: () => node.type === "symlink" };
  };
  const directory = (file) => {
    const absolute = path.resolve(ROOT, file);
    if (!nodes.has(path.dirname(absolute))) directory(path.dirname(absolute));
    nodes.set(absolute, { type: "directory" });
  };
  const put = (file, text) => {
    const absolute = path.resolve(ROOT, file);
    directory(path.dirname(absolute));
    nodes.set(absolute, { type: "file", content: Buffer.from(text) });
  };
  const fsOps = {
    statSync: stat,
    lstatSync: stat,
    realpathSync: (file) => { get(file); return file; },
    readdirSync(file, options = {}) {
      assert.equal(get(file).type, "directory");
      listings.push(file);
      return [...nodes.keys()].filter((name) => name !== file && path.dirname(name) === file).map((name) => options.withFileTypes ? { name: path.basename(name), ...stat(name) } : path.basename(name));
    },
    readFileSync(file, encoding) {
      fullReads.push(file);
      const node = get(file);
      assert.equal(node.type, "file");
      return encoding ? node.content.toString(encoding) : Buffer.from(node.content);
    },
    openSync(file, flags) {
      assert.equal(flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_APPEND), 0, "metadata opens must be read-only");
      assert.equal(get(file).type, "file");
      const fd = nextFd++;
      handles.set(fd, { file, position: 0 });
      return fd;
    },
    fstatSync: (fd) => stat(handles.get(fd).file),
    readSync(fd, buffer, offset, length, position) {
      const handle = handles.get(fd);
      assert.ok(handle, "read requires an open memory handle");
      const start = position ?? handle.position;
      const count = get(handle.file).content.copy(buffer, offset, start, start + length);
      if (position === null) handle.position += count;
      metadataReads.push(handle.file);
      return count;
    },
    closeSync(fd) { assert.ok(handles.delete(fd), "each metadata handle closes once"); }
  };
  for (const name of WRITE_METHODS) {
    fsOps[name] = () => { writes.push(name); assert.fail(`Unexpected write: ${name}`); };
  }
  put(".dove/install/manifest.json", JSON.stringify({
    revision: "2.0", package: { name: "dove", version: "3.0.0" }, runtime: { mode: "user-cli" },
    hosts: ["claude"], managed: [], createdAt: NOW, updatedAt: NOW
  }));
  t.after(() => {
    assert.deepEqual(diskIO, [], "run reads must never fall through to real disk I/O");
    assert.deepEqual(writes, [], "status, comparison, and latest facts must be zero-write");
    assert.equal(handles.size, 0, "metadata handles must close on success and errors");
  });
  return { nodes, fullReads, metadataReads, listings, directory, put, options: { project: ROOT, fsOps } };
}

function runJournal(runId, options = {}) {
  const metric = { name: "score", direction: "max", unit: null };
  const events = [{
    schemaVersion: "dove.run.event.v1", seq: 1, at: options.at ?? NOW, type: "run.started", runId,
    group: Object.hasOwn(options, "group") ? options.group : "target", argv: ["never-execute-this-fixture"], cwd: ROOT,
    supervisorPid: null, budget: { timeoutMs: null, killGraceMs: 5000 }, metric,
    data: options.data ?? "fixture-v1", evaluator: "memory", resourceBasis: "local"
  }];
  events.push({ schemaVersion: "dove.run.event.v1", seq: 2, at: NOW, type: "run.terminal", runId, outcome: "succeeded", exitCode: 0 });
  if (options.finalized !== false) events.push({ schemaVersion: "dove.run.event.v1", seq: 3, at: NOW, type: "run.finalized", runId, metric: { ...metric, value: options.value ?? 1 } });
  return `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
}

function startWithBadTail(runId, options = {}) {
  return `${runJournal(runId, options).split("\n")[0]}\nnot-json`;
}

function assertSelectionFailure(result, errorIds, goodIds = ["good"]) {
  assert.equal(result.status, "partial");
  assert.equal(result.comparable, false);
  assert.equal(result.complete, false);
  assert.deepEqual(result.fields, ["selection"]);
  assert.deepEqual(result.errors.map((error) => error.runId), errorIds);
  assert.ok(result.errors.every((error) => typeof error.message === "string" && error.message.length > 0));
  assert.deepEqual(result.runs.map((run) => run.runId), goodIds);
  assert.equal(Object.hasOwn(result, "ranking"), false);
}

test("run command argv preserves empty arguments but rejects an empty executable and NUL", () => {
  const argv = ["node", "", "--label", "", " "];
  assert.deepEqual(normalizeRunCommandArgv(argv), argv);
  assert.throws(() => normalizeRunCommandArgv([]), /command after/u);
  assert.throws(() => normalizeRunCommandArgv(["", "argument"]), /argv\[0\].*non-empty/u);
  for (const invalid of [["no\0de"], ["node", "\0"], ["node", "", "value\0"]]) {
    assert.throws(() => normalizeRunCommandArgv(invalid), /NUL/u);
  }
});

test("run lists keep healthy entries while bad names, ordinary files, and journals become item errors", (t) => {
  const memory = memoryRuns(t);
  memory.put(".dove/runs/good-a/run.jsonl", runJournal("good-a"));
  memory.put(".dove/runs/good-z/run.jsonl", runJournal("good-z", { value: 2 }));
  memory.put(".dove/runs/bad name/run.jsonl", runJournal("bad name"));
  memory.put(".dove/runs/CON/run.jsonl", runJournal("CON"));
  memory.put(".dove/runs/notes.txt", "Not a run.\n");
  memory.put(".dove/runs/broken/run.jsonl", "not-json\n");
  memory.directory(".dove/runs/missing-journal");
  memory.nodes.set(`${ROOT}/.dove/runs/linked`, { type: "symlink" });

  const listed = listRunSummaries(memory.options);
  assert.equal(listed.status, "partial");
  assert.equal(listed.complete, false);
  assert.deepEqual(listed.runs.map((run) => run.runId), ["good-a", "good-z"]);
  assert.deepEqual(listed.errors.map((error) => error.runId), ["CON", "bad name", "broken", "linked", "notes.txt"]);
  assert.match(listed.errors.find((error) => error.runId === "notes.txt").message, /real directory/u);
  assert.match(listed.errors.find((error) => error.runId === "bad name").message, /path-safe/u);
  assert.ok(listed.errors.every((error) => error.message.length > 0));

  const beforeListings = memory.listings.length;
  const beforeReads = memory.fullReads.length;
  assert.equal(inspectRunStatus({ ...memory.options, id: "good-a" }).status, "succeeded");
  const explicit = compareRuns({ ...memory.options, ids: ["good-z", "good-a", "good-a"] });
  assert.equal(explicit.comparable, true);
  assert.deepEqual(explicit.runIds, ["good-a", "good-z"]);
  assert.deepEqual(explicit.ranking.map((item) => item.runId), ["good-z", "good-a"]);
  assert.equal(memory.listings.length, beforeListings, "explicit IDs must not enumerate unrelated run entries");
  assert.ok(memory.fullReads.slice(beforeReads).every((file) => file.endsWith("/manifest.json") || /\/good-[az]\/run\.jsonl$/u.test(file)));
});

test("group reads exclude validated other groups, including null and absent groups, without parsing their bad tails", (t) => {
  const memory = memoryRuns(t);
  memory.put(".dove/runs/good-a/run.jsonl", runJournal("good-a"));
  memory.put(".dove/runs/good-b/run.jsonl", runJournal("good-b", { value: 3 }));
  memory.put(".dove/runs/other/run.jsonl", startWithBadTail("other", { group: "another" }));
  memory.put(".dove/runs/ungrouped/run.jsonl", startWithBadTail("ungrouped", { group: null }));
  const absentGroupStart = JSON.parse(runJournal("absent-group").split("\n")[0]);
  delete absentGroupStart.group;
  memory.put(".dove/runs/absent-group/run.jsonl", `${JSON.stringify(absentGroupStart)}\nnot-json`);

  const result = inspectRunStatus({ ...memory.options, group: "target" });
  assert.equal(result.status, "ok");
  assert.equal(result.complete, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.runs.map((run) => run.runId), ["good-a", "good-b"]);
  const compared = compareRuns({ ...memory.options, group: "target" });
  assert.equal(compared.comparable, true);
  assert.deepEqual(compared.ranking.map((item) => item.runId), ["good-b", "good-a"]);
  for (const id of ["other", "ungrouped", "absent-group"]) {
    assert.ok(memory.metadataReads.includes(`${ROOT}/.dove/runs/${id}/run.jsonl`));
    assert.equal(memory.fullReads.includes(`${ROOT}/.dove/runs/${id}/run.jsonl`), false, "excluded tails must not be read as journals");
  }
});

test("a corrupt target-group tail blocks group and explicit-ID rankings while preserving healthy runs", (t) => {
  const memory = memoryRuns(t);
  memory.put(".dove/runs/good/run.jsonl", runJournal("good"));
  memory.put(".dove/runs/bad/run.jsonl", startWithBadTail("bad"));
  memory.put(".dove/runs/other/run.jsonl", startWithBadTail("other", { group: "another" }));

  const listed = inspectRunStatus({ ...memory.options, group: "target" });
  assert.equal(listed.complete, false);
  assert.deepEqual(listed.runs.map((run) => run.runId), ["good"]);
  assert.deepEqual(listed.errors.map((error) => error.runId), ["bad"]);
  assertSelectionFailure(compareRuns({ ...memory.options, group: "target" }), ["bad"]);
  assertSelectionFailure(compareRuns({ ...memory.options, ids: ["good", "bad"] }), ["bad"]);
  assertSelectionFailure(compareRuns({ ...memory.options, ids: ["missing"] }), ["missing"], []);
  assert.equal(compareRuns({ ...memory.options, ids: ["good"] }).comparable, true);
});

test("group selection cannot skip unknown or invalid first events even when they claim another group", (t) => {
  const memory = memoryRuns(t);
  memory.put(".dove/runs/good/run.jsonl", runJournal("good"));
  const invalidStarts = {
    "bad-json": "not-json\n",
    "empty": "",
    "bad-seq": { seq: 2 },
    "bad-id": { runId: "different" },
    "bad-schema": { schemaVersion: "unsupported" },
    "bad-time": { at: "not-a-timestamp" },
    "bad-type": { type: "run.terminal" },
    "bad-group": { group: { name: "another" } },
    "no-newline": "{}"
  };
  for (const [id, invalid] of Object.entries(invalidStarts)) {
    const started = JSON.parse(runJournal(id, { group: "another" }).split("\n")[0]);
    memory.put(`.dove/runs/${id}/run.jsonl`, typeof invalid === "string" ? invalid : `${JSON.stringify({ ...started, ...invalid })}\nnot-json`);
  }
  memory.directory(".dove/runs/missing");
  const errorIds = Object.keys(invalidStarts).sort();
  const listed = listRunSummaries({ ...memory.options, group: "target" });
  assert.equal(listed.status, "partial");
  assert.deepEqual(listed.runs.map((run) => run.runId), ["good"]);
  assert.deepEqual(listed.errors.map((error) => error.runId), errorIds);
  assertSelectionFailure(compareRuns({ ...memory.options, group: "target" }), errorIds);
  assert.equal(compareRuns({ ...memory.options, ids: ["good"] }).comparable, true);
});

test("reserved directories without journals stay out of lists while latest metadata remains strict", (t) => {
  const memory = memoryRuns(t);
  memory.put(".dove/runs/good/run.jsonl", runJournal("good"));
  memory.directory(".dove/runs/reserved");
  for (const options of [memory.options, { ...memory.options, group: "target" }]) {
    const listed = listRunSummaries(options);
    assert.equal(listed.status, "ok");
    assert.equal(listed.complete, true);
    assert.deepEqual(listed.errors, []);
    assert.deepEqual(listed.runs.map((run) => run.runId), ["good"]);
  }
  assert.equal(compareRuns({ ...memory.options, group: "target" }).comparable, true);
  assertSelectionFailure(compareRuns({ ...memory.options, ids: ["reserved"] }), ["reserved"], []);
  assert.throws(() => inspectLatestRunFacts(memory.options), /journal.*missing/u);
});

test("latest run facts ignore known historical tails but stay strict about unknown candidates", (t) => {
  const memory = memoryRuns(t);
  memory.put(".dove/runs/latest/run.jsonl", runJournal("latest"));
  memory.put(".dove/runs/old/run.jsonl", startWithBadTail("old", { at: "2026-10-22T00:00:00.000Z" }));
  assert.deepEqual(inspectLatestRunFacts(memory.options), { runId: "latest", startedAt: NOW, status: "succeeded", exitCode: 0 });
  assert.equal(memory.fullReads.includes(`${ROOT}/.dove/runs/old/run.jsonl`), false);

  memory.put(".dove/runs/unknown/run.jsonl", "not-json\n");
  assert.throws(() => inspectLatestRunFacts(memory.options));
  memory.nodes.delete(`${ROOT}/.dove/runs/unknown/run.jsonl`);
  memory.nodes.delete(`${ROOT}/.dove/runs/unknown`);
  memory.put(".dove/runs/notes.txt", "Not a run.\n");
  assert.throws(() => inspectLatestRunFacts(memory.options), /real directory/u);
  memory.nodes.delete(`${ROOT}/.dove/runs/notes.txt`);
  memory.put(".dove/runs/bad name/run.jsonl", runJournal("bad name"));
  assert.throws(() => inspectLatestRunFacts(memory.options), /path-safe/u);
});

test("illegal runs roots and root-level I/O failures still reject the whole query", async (t) => {
  for (const type of ["file", "symlink"]) {
    await t.test(type, (t) => {
      const memory = memoryRuns(t);
      memory.nodes.set(`${ROOT}/.dove/runs`, { type, content: Buffer.from("not a directory") });
      for (const query of [listRunSummaries, inspectRunStatus, inspectLatestRunFacts, (options) => compareRuns({ ...options, group: "target" })]) {
        assert.throws(() => query(memory.options), /runs directory must be a real directory/u);
      }
    });
  }
  await t.test("unreadable root", (t) => {
    const memory = memoryRuns(t);
    memory.directory(".dove/runs");
    const baseRead = memory.options.fsOps.readdirSync;
    memory.options.fsOps.readdirSync = (file, options) => {
      if (file === `${ROOT}/.dove/runs`) throw Object.assign(new Error("runs root unreadable"), { code: "EACCES" });
      return baseRead(file, options);
    };
    assert.throws(() => listRunSummaries(memory.options), /runs root unreadable/u);
    assert.throws(() => compareRuns({ ...memory.options, group: "target" }), /runs root unreadable/u);
  });
});

test("empty selections and normal state or basis refusals keep their existing successful-query protocol", (t) => {
  const memory = memoryRuns(t);
  const empty = listRunSummaries(memory.options);
  assert.equal(empty.status, "ok");
  assert.equal(empty.complete, true);
  assert.deepEqual(empty.runs, []);
  assert.deepEqual(empty.errors, []);
  assert.equal(inspectLatestRunFacts(memory.options), null);
  const none = compareRuns({ ...memory.options, group: "absent" });
  assert.equal(none.status, "ok");
  assert.notEqual(none.complete, false);
  assert.deepEqual(none.fields, ["selection"]);

  memory.put(".dove/runs/good/run.jsonl", runJournal("good"));
  memory.put(".dove/runs/pending/run.jsonl", runJournal("pending", { finalized: false }));
  memory.put(".dove/runs/different/run.jsonl", runJournal("different", { data: "fixture-v2" }));
  for (const [ids, fields] of [[["good", "pending"], ["state"]], [["good", "different"], ["data"]]]) {
    const result = compareRuns({ ...memory.options, ids });
    assert.equal(result.status, "ok");
    assert.equal(result.comparable, false);
    assert.notEqual(result.complete, false);
    assert.deepEqual(result.fields, fields);
    assert.equal(Object.hasOwn(result, "ranking"), false);
  }
});

test("partial human output explains incomplete lists and per-item causes without terminal control injection", (t) => {
  const memory = memoryRuns(t);
  const id = "bad\x1b[31m\nname";
  memory.put(`.dove/runs/${id}/run.jsonl`, runJournal(id));
  const partial = inspectRunStatus({ ...memory.options, group: "target" });
  const list = renderRunResult(partial);
  assert.match(list, /列表不完整/u);
  assert.match(list, /逐项读取错误/u);
  assert.match(list, /不能据此判断没有运行记录/u);
  assert.ok(list.includes("bad?[31m?name"));
  assert.doesNotMatch(list, /尚无匹配/u);
  assert.doesNotMatch(list, /[\x00-\x09\x0b-\x1f\x7f-\x9f]/u);

  const comparison = renderRunResult(compareRuns({ ...memory.options, group: "target" }));
  assert.match(comparison, /选择不完整/u);
  assert.match(comparison, /未生成排名/u);
  assert.match(comparison, /逐项读取错误/u);
  assert.ok(comparison.includes("bad?[31m?name"));
  assert.doesNotMatch(comparison, /[\x00-\x09\x0b-\x1f\x7f-\x9f]/u);
});
