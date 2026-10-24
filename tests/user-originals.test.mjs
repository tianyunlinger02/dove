import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readActivity, refreshUserOriginals, sessionDirectories, USER_ORIGINALS_INDEX_PATH, USER_ORIGINALS_PATH } from "../src/core/user-originals.mjs";

const encode = (value) => value.replace(/[^A-Za-z0-9]/gu, "-");
const user = (cwd, time, content, extra = {}) => JSON.stringify({ type: "user", cwd, timestamp: time, message: { role: "user", content }, ...extra });

function fixture(t, name = "garment-study") {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "dove-originals-"));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const home = path.join(base, "home");
  const project = path.join(base, name);
  const directory = path.join(home, ".claude/projects", encode(project));
  fs.mkdirSync(project);
  fs.mkdirSync(directory, { recursive: true });
  return { base, home, project, directory };
}

test("only the exact encoded root is scanned, with relays marked and noise left out", (t) => {
  const { base, home, project, directory } = fixture(t);
  const otherProject = path.join(base, "elsewhere", "garment-study");
  const sameBasename = path.join(home, ".claude/projects", encode(otherProject));
  const unrelated = path.join(home, ".claude/projects", "-home-someone-else");
  for (const other of [sameBasename, unrelated]) {
    fs.mkdirSync(other, { recursive: true });
    fs.writeFileSync(path.join(other, "cccccccc-1.jsonl"), `${user(project, "2026-09-01T00:00:00Z", "即使 cwd 相同也不能读取其他来源目录")}\n`);
  }
  fs.writeFileSync(path.join(directory, "aaaaaaaa-1.jsonl"), `${user(project, "2026-09-06T16:05:00Z", "如果科研我们需不需要训练或者微调一个我们的模型")}\n`);
  fs.writeFileSync(path.join(directory, "bbbbbbbb-1.jsonl"), [
    user(project, "2026-10-04T10:00:00Z", "主会话 Claude，转达用户新要求：只推理，不训练"),
    user(project, "2026-10-04T10:01:00Z", "This session is being continued from a previous conversation."),
    user(project, "2026-10-04T10:02:00Z", [{ type: "tool_result", content: "工具输出不算" }]),
    user(project, "2026-10-04T10:03:00Z", "子任务里的话不算", { isSidechain: true }),
    user(project, "2026-10-04T10:03:00Z", "系统注入的话不算", { isMeta: true }),
    user(project, "2026-10-04T10:03:00Z", "压缩摘要里的话不算", { isCompactSummary: true }),
    user(project, "2026-10-04T10:04:00Z", "继续"),
    user(project, "2026-10-04T10:05:00Z", [{ type: "text", text: "记得我们不是要把服装写死，而是要让那模型学会" }]),
    user(project, "2026-10-04T10:06:00Z", "<command-message>dove.notes</command-message><command-args>斜杠命令里亲自输入的研究要求也应保留</command-args>"),
    ""
  ].join("\n"));
  assert.deepEqual(sessionDirectories(project, { home }), [directory]);
  const result = refreshUserOriginals(project, { home });
  assert.deepEqual([result.own, result.relay, result.directories], [3, 1, [directory]]);
  const text = fs.readFileSync(path.join(project, USER_ORIGINALS_PATH), "utf8");
  assert.ok(text.indexOf("需不需要训练") < text.indexOf("让那模型学会"), "entries are in time order across sessions");
  assert.match(text, /转述 · 主会话 Claude/u);
  assert.match(text, /本人 · 斜杠命令里亲自输入/u);
  assert.match(text, /短消息 1 条/u);
  assert.doesNotMatch(text, /工具输出不算|子任务里的话不算|系统注入的话不算|压缩摘要里的话不算|previous conversation|其他来源目录/u);
});

test("encoding collisions still require each record to have an absolute cwd within this root", (t) => {
  const { base, home, project, directory } = fixture(t);
  const collision = path.join(base, "garment_study");
  assert.equal(encode(collision), encode(project));
  const file = path.join(directory, "aaaaaaaa-collision.jsonl");
  fs.writeFileSync(file, [
    user(project, "2026-10-01T00:00:00Z", "当前项目本人的长期研究要求"),
    user(path.join(project, "experiments"), "2026-10-01T00:01:00Z", "项目子目录里的原话也应收录"),
    user(collision, "2026-10-01T00:02:00Z", "编码相同的另一个项目绝不能混入"),
    user(`${project}-other`, "2026-10-01T00:03:00Z", "名称前缀相同的相邻项目不能混入"),
    user(base, "2026-10-01T00:04:00Z", "父目录下的记录不属于这个项目"),
    user(undefined, "2026-10-01T00:05:00Z", "缺少工作目录的记录不能采信"),
    user("garment-study", "2026-10-01T00:06:00Z", "相对工作目录的记录不能采信"),
    user(null, "2026-10-01T00:07:00Z", "空工作目录的记录不能采信"),
    user(collision, "2026-10-01T00:08:00Z", "主会话 Claude，转达其他项目的用户要求"),
    user(undefined, "2026-10-01T00:09:00Z", "继续"),
    ""
  ].join("\n"));
  const result = refreshUserOriginals(project, { home });
  assert.deepEqual([result.own, result.relay, result.pendingBytes], [2, 0, 0]);
  const text = fs.readFileSync(path.join(project, USER_ORIGINALS_PATH), "utf8");
  assert.match(text, /当前项目本人的长期研究要求/u);
  assert.match(text, /项目子目录里的原话也应收录/u);
  assert.match(text, /短消息 0 条/u);
  assert.doesNotMatch(text, /不能|不属于|其他项目/u);
  const index = JSON.parse(fs.readFileSync(path.join(project, USER_ORIGINALS_INDEX_PATH), "utf8"));
  assert.equal(index.files[file].offset, fs.statSync(file).size, "rejected records are consumed without entering the cache");
  assert.equal(index.files[file].entries.length, 2);
});

for (const invalid of ["legacy", "schema", "root"]) {
  test(`${invalid} indexes are discarded before a zero-budget refresh, including deleted-source pollution`, (t) => {
    const { base, home, project, directory } = fixture(t);
    const file = path.join(directory, "aaaaaaaa-current.jsonl");
    const deleted = path.join(directory, "bbbbbbbb-deleted.jsonl");
    fs.writeFileSync(file, `${user(project, "2026-10-01T00:00:00Z", "真实来源必须从头重新核验并收录")}\n`);
    fs.writeFileSync(deleted, `${user(project, "2026-10-01T00:01:00Z", "旧版本尚未核验过归属的会话内容")}\n`);
    refreshUserOriginals(project, { home });
    const indexFile = path.join(project, USER_ORIGINALS_INDEX_PATH);
    const index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
    for (const item of Object.values(index.files)) {
      item.entries = [{ time: "2026-09-01T00:00", session: "polluted", kind: "own", text: "旧缓存污染不得被保留或者复活" }];
      item.short = 77;
    }
    if (invalid === "legacy") { delete index.schema; delete index.root; }
    if (invalid === "schema") index.schema = -1;
    if (invalid === "root") index.root = path.join(base, "elsewhere", "garment-study");
    fs.writeFileSync(indexFile, JSON.stringify(index));
    fs.writeFileSync(path.join(project, USER_ORIGINALS_PATH), "旧缓存污染不得被保留或者复活\n");
    fs.unlinkSync(deleted);

    const deferred = refreshUserOriginals(project, { home, budgetMs: 0 });
    assert.deepEqual([deferred.own, deferred.relay, deferred.pendingBytes], [0, 0, fs.statSync(file).size]);
    const reset = JSON.parse(fs.readFileSync(indexFile, "utf8"));
    assert.equal(reset.schema, 1);
    assert.equal(reset.root, project);
    assert.deepEqual(reset.files, { [file]: { offset: 0, entries: [], short: 0 } });
    const empty = fs.readFileSync(path.join(project, USER_ORIGINALS_PATH), "utf8");
    assert.doesNotMatch(empty, /污染|旧版本/u);
    assert.match(empty, /短消息 0 条/u);

    const done = refreshUserOriginals(project, { home });
    assert.deepEqual([done.own, done.pendingBytes], [1, 0], "old offsets must not skip unverified live records");
    const text = fs.readFileSync(path.join(project, USER_ORIGINALS_PATH), "utf8");
    assert.match(text, /真实来源必须从头重新核验并收录/u);
    assert.doesNotMatch(text, /污染|旧版本/u);
  });
}

test("current root-verified cache keeps deleted sessions but never retains entries from another source directory", (t) => {
  const { base, home, project, directory } = fixture(t);
  const file = path.join(directory, "aaaaaaaa-deleted.jsonl");
  fs.writeFileSync(file, [
    user(project, "2026-10-01T00:00:00Z", "本项目核验过的用户原话在会话删除后仍应保留"),
    user(project, "2026-10-01T00:01:00Z", "主会话 Claude，转达用户要求：同项目转述也应保留"),
    user(project, "2026-10-01T00:02:00Z", "继续"),
    ""
  ].join("\n"));
  refreshUserOriginals(project, { home });
  const indexFile = path.join(project, USER_ORIGINALS_INDEX_PATH);
  const index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
  const otherHome = path.join(base, "other-home");
  const outside = [
    path.join(home, ".claude/projects", encode(path.join(base, "elsewhere", "garment-study")), "bbbbbbbb.jsonl"),
    path.join(otherHome, ".claude/projects", encode(project), "cccccccc.jsonl"),
    path.join(directory, "nested", "dddddddd.jsonl")
  ];
  for (const foreign of outside) index.files[foreign] = { offset: 100, entries: [{ time: "2026-09-01T00:00", session: "foreign", kind: "own", text: "外目录缓存不得在末尾保留" }], short: 99 };
  fs.writeFileSync(indexFile, JSON.stringify(index));
  fs.unlinkSync(file);
  fs.rmdirSync(directory);

  const kept = refreshUserOriginals(project, { home, budgetMs: 0 });
  assert.deepEqual([kept.own, kept.relay, kept.pendingBytes, kept.directories], [1, 1, 0, []]);
  const text = fs.readFileSync(path.join(project, USER_ORIGINALS_PATH), "utf8");
  assert.match(text, /本项目核验过的用户原话/u);
  assert.match(text, /短消息 1 条/u);
  assert.doesNotMatch(text, /外目录缓存/u);
  assert.deepEqual(JSON.parse(fs.readFileSync(indexFile, "utf8")).files, { [file]: index.files[file] });
  assert.equal(refreshUserOriginals(project, { home: otherHome, budgetMs: 0 }).own, 0, "a different HOME is not the verified source directory");
});

test("incremental scans resume at the saved offset and sort appended words across sessions", (t) => {
  const { home, project, directory } = fixture(t);
  const file = path.join(directory, "aaaaaaaa-growing.jsonl");
  fs.writeFileSync(file, `${user(project, "2026-10-03T00:00:00Z", "第三条原话先存在于持续增长的会话中")}\n`);
  fs.writeFileSync(path.join(directory, "bbbbbbbb-fixed.jsonl"), `${user(project, "2026-10-02T00:00:00Z", "第二条原话存在于另一个未改变的会话中")}\n`);
  assert.equal(refreshUserOriginals(project, { home }).own, 2);
  const start = fs.statSync(file).size;
  fs.appendFileSync(file, [
    user(project, "2026-10-01T00:00:00Z", "第一条原话后追加但时间最早应排在最前"),
    user(project, "2026-10-04T00:00:00Z", "第四条原话最后追加且时间最晚应排在最后"),
    ""
  ].join("\n"));
  const positions = [];
  const fsOps = { ...fs, readSync(fd, buffer, offset, length, position) {
    positions.push(position);
    return fs.readSync(fd, buffer, offset, length, position);
  } };
  const result = refreshUserOriginals(project, { home, fsOps });
  assert.deepEqual([result.own, result.pendingBytes], [4, 0]);
  assert.equal(positions[0], start);
  assert.ok(positions.every((position) => position >= start), "unchanged files and previously scanned bytes are not rescanned");
  const text = fs.readFileSync(path.join(project, USER_ORIGINALS_PATH), "utf8");
  const locations = ["第一条原话", "第二条原话", "第三条原话", "第四条原话"].map((label) => text.indexOf(label));
  assert.ok(locations.every((location, index) => location >= 0 && (index === 0 || location > locations[index - 1])));
  const reads = positions.length;
  assert.equal(refreshUserOriginals(project, { home, fsOps }).own, 4);
  assert.equal(positions.length, reads, "a fully indexed session is not read again");
});

test("huge tool and image lines are skipped and a time budget defers the rest to the next call", (t) => {
  const { home, project, directory } = fixture(t, "big-study");
  const image = user(project, "2026-10-01T00:00:00Z", [{ type: "text", text: "x".repeat(600 << 10) }]);
  fs.writeFileSync(path.join(directory, "dddddddd-1.jsonl"), `${image}\n${user(project, "2026-10-02T00:00:00Z", "我问的就是自主完整生成整件衣服")}\n`);
  const deferred = refreshUserOriginals(project, { home, budgetMs: 0 });
  assert.equal(deferred.own, 0);
  assert.ok(deferred.pendingBytes > 0);
  assert.match(fs.readFileSync(path.join(project, USER_ORIGINALS_PATH), "utf8"), /未整理/u);
  const done = refreshUserOriginals(project, { home });
  assert.deepEqual([done.own, done.pendingBytes], [1, 0]);
  assert.doesNotMatch(fs.readFileSync(path.join(project, USER_ORIGINALS_PATH), "utf8"), /xxxx/u);
});

test("activity counts calls, compactions, writing and claims made without running or reading", (t) => {
  const { home, project, directory } = fixture(t);
  const assistant = (time, content, extra = {}) => JSON.stringify({ type: "assistant", cwd: project, timestamp: time, message: { role: "assistant", content }, ...extra });
  fs.writeFileSync(path.join(directory, "aaaaaaaa-activity.jsonl"), [
    user(project, "2026-10-20T10:00:00Z", "继续推进"),
    assistant("2026-10-20T10:01:00Z", [{ type: "text", text: "已跑通，实测可能不错，但是仍需核对。" }]),
    assistant("2026-10-20T10:02:00Z", [{ type: "tool_use", id: "a", name: "Bash", input: { command: "python eval.py" } }]),
    assistant("2026-10-20T10:03:00Z", [{ type: "text", text: "已验证通过。" }]),
    assistant("2026-10-20T10:04:00Z", [{ type: "tool_use", id: "b", name: "Agent", input: { subagent_type: "dove-mentor", prompt: "x" } }, { type: "tool_use", id: "c", name: "Agent", input: { subagent_type: "general-purpose", prompt: "y" } }]),
    assistant("2026-10-20T10:05:00Z", [{ type: "tool_use", id: "d", name: "Write", input: { file_path: "/x", content: "sha256 冻结 hash(x) @dataclass(frozen=True)" } }]),
    assistant("2026-10-20T10:06:00Z", [{ type: "tool_use", id: "e", name: "Write", input: { file_path: `${project}/.dove/research/rounds/016-brief.md`, content: "Author: mentor" } }]),
    assistant("2026-10-20T10:07:00Z", [{ type: "tool_use", id: "f", name: "Write", input: { file_path: ".dove/research/rounds/016-brief.md", content: "改写" } }]),
    assistant("2026-10-20T10:08:00Z", [{ type: "tool_use", id: "g", name: "Write", input: { file_path: "/elsewhere/.dove/research/rounds/017-brief.md", content: "别的项目" } }]),
    JSON.stringify({ type: "system", subtype: "compact_boundary", cwd: project, timestamp: "2026-10-20T11:00:00Z" }),
    user(project, "2026-10-20T12:00:00Z", "下一步呢"),
    assistant("2026-10-20T12:01:00Z", [{ type: "text", text: "测试通过。" }]),
    assistant("2026-10-20T12:02:00Z", [{ type: "text", text: "子任务里的实测不算" }], { isSidechain: true }),
    ""
  ].join("\n"));
  refreshUserOriginals(project, { home });
  const activity = readActivity(project, { home });
  assert.deepEqual(activity.marks, { "brief:16": Date.parse("2026-10-20T10:06:00Z") }, "the first write of a round file in this project");
  assert.ok(Object.keys(activity.buckets).length >= 3, "ten-minute buckets keep the hours apart");
  const totals = {};
  for (const counts of Object.values(activity.buckets)) for (const [field, value] of Object.entries(counts)) totals[field] = (totals[field] ?? 0) + value;
  const chars = ["已跑通，实测可能不错，但是仍需核对。", "已验证通过。", "测试通过。"].reduce((sum, text) => sum + Array.from(text).length, 0);
  assert.deepEqual(totals, { agents: 2, mentor: 1, compactions: 1, gates: 2, chars, hedges: 3, claims: 3, unrun: 2 });
});
