import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { renderMentorBrief } from "../src/core/mentor-brief.mjs";

const ROOT = "/memory/dove/project";
const RESEARCH = ".dove/research";
const WATCH = `${RESEARCH}/watch`;
const QUESTIONS = [
  "1. 相对用户原话，方向对不对？",
  "2. 这几轮是在建立通用能力，还是反复打补丁？",
  "3. 离用户目标和目标档次还差什么？",
  "4. 下一轮该做什么，为什么？"
].join("\n");

// Every project byte lives in this Map. No disk fixtures or real project reads.
function memoryFiles(t, entries = {}) {
  for (const name of ["readFileSync", "writeFileSync", "appendFileSync", "mkdirSync", "mkdtempSync", "renameSync", "unlinkSync", "rmSync", "statSync", "lstatSync", "realpathSync", "readdirSync", "openSync", "readSync", "closeSync"]) {
    t.mock.method(fs, name, () => assert.fail(`Unexpected disk I/O: ${name}`));
  }
  const files = new Map(Object.entries(entries).map(([file, text]) => [path.resolve(ROOT, file), Buffer.from(text)]));
  const reads = [];
  const inspected = [];
  const handles = new Map();
  let nextFd = 1;
  const absent = (file) => Object.assign(new Error(`No in-memory file: ${file}`), { code: "ENOENT" });
  const directory = (file) => file === ROOT || [...files.keys()].some((name) => name.startsWith(`${file}/`));
  const fsOps = {
    statSync(file) {
      inspected.push(file);
      if (!files.has(file) && !directory(file)) throw absent(file);
      return { size: files.get(file)?.length ?? 0, isFile: () => files.has(file), isDirectory: () => directory(file) };
    },
    readdirSync(file) {
      inspected.push(file);
      if (!directory(file)) throw absent(file);
      return [...new Set([...files.keys()].filter((name) => name.startsWith(`${file}/`)).map((name) => name.slice(file.length + 1).split("/")[0]))];
    },
    openSync(file, flags) {
      assert.equal(flags, "r");
      if (!files.has(file)) throw absent(file);
      const fd = nextFd++;
      handles.set(fd, file);
      return fd;
    },
    readSync(fd, target, offset, length, position) {
      const file = handles.get(fd);
      assert.ok(file, "read requires an open memory handle");
      reads.push({ file, length, position });
      return files.get(file).copy(target, offset, position, position + length);
    },
    closeSync(fd) {
      assert.ok(handles.delete(fd), "all memory handles close once");
    }
  };
  t.after(() => assert.equal(handles.size, 0));
  return { files, reads, inspected, fsOps };
}

function digest(items, status = "done") {
  return JSON.stringify({ date: "2026-10-15", status, items });
}

function paper(id, title = `Paper ${id}`) {
  return { id, title, published: "2026-10-10", abstract: `Original abstract for ${id}` };
}

test("empty memory project renders a short fixed template without creating records", (t) => {
  const memory = memoryFiles(t);
  const brief = renderMentorBrief(ROOT, { fsOps: memory.fsOps });
  assert.equal(typeof brief, "string");
  assert.ok(brief.endsWith(`${QUESTIONS}\n`));
  assert.equal((brief.match(/^\d+\. /gmu) ?? []).length, 4);
  assert.ok(Buffer.byteLength(brief) <= 1800, `empty template: ${Buffer.byteLength(brief)} bytes`);
  for (const file of [".dove/install/RESEARCH_QUALITY.md", `${RESEARCH}/IDENTITY.md`, `${RESEARCH}/MENTOR_NOTES.md`, `${RESEARCH}/EVAL.md`, `${RESEARCH}/topics/CRITERIA.md`, `${RESEARCH}/topics/PROJECT.md`, `${WATCH}/config.json`]) {
    assert.ok(brief.includes(`\`${file}\`（缺失）`), file);
  }
  assert.match(brief, /来源：未提供/u);
  assert.match(brief, /日期范围：未提供起点 — 未提供终点/u);
  assert.match(brief, /同轮再调用.*触发/u);
  assert.match(brief, /未找到追踪清单/u);
  assert.match(brief, /最近扫描：未找到/u);
  assert.equal(memory.files.size, 0);
  assert.equal(memory.reads.length, 0);
});

test("materials use actual paths, recent numbered rounds, and verbatim user fields without reading sessions", (t) => {
  const source = "/private/host/session.jsonl";
  const artifact = "outputs/raw.csv";
  const original = "请保留完整任务。\n不要把我的要求改成最窄的设计。";
  const memory = memoryFiles(t, {
    ".dove/install/RESEARCH_QUALITY.md": "quality is read by mentor",
    ".dove/install/AUTHOR_PREFERENCES.md": "private preferences",
    [`${RESEARCH}/IDENTITY.md`]: "Mainline: unchanged\n",
    [`${RESEARCH}/MENTOR_NOTES.md`]: "mentor memory\n".repeat(1000),
    [`${RESEARCH}/EVAL.md`]: Array.from({ length: 30 }, (_, index) => `| measure-${String(index + 1).padStart(2, "0")} | 0.5 |`).join("\n"),
    [`${RESEARCH}/topics/CRITERIA.md`]: "project criteria",
    [`${RESEARCH}/topics/PROJECT.md`]: "project settings",
    [`${RESEARCH}/rounds/002-brief.md`]: "old brief",
    [`${RESEARCH}/rounds/002-result.md`]: "old result",
    [`${RESEARCH}/rounds/009-brief.md`]: "recent brief",
    [`${RESEARCH}/rounds/009-result.md`]: "recent result",
    [`${RESEARCH}/rounds/010-brief.md`]: "latest brief",
    [`${RESEARCH}/rounds/011-result.md`]: "latest result",
    [`${RESEARCH}/rounds/execution-dialogue.md`]: "do not read execution dialogue",
    [artifact]: "raw data stays at path",
    [source]: "private execution conversation"
  });
  const before = [...memory.files];
  const brief = renderMentorBrief(ROOT, {
    fsOps: memory.fsOps, trigger: "用户纠正方向（本轮再次调用）", userSource: source,
    since: "2026-10-14", until: "2026-10-15 10:30", userOriginal: original,
    artifact: [artifact, "/external/new-output.json"],
    task: "replace the fixed questions", body: "arbitrary executor task", template: "custom template"
  });
  assert.match(brief, /用户纠正方向（本轮再次调用）/u);
  assert.ok(brief.includes(`> 来源：${source}`));
  assert.ok(brief.includes("> 日期范围：2026-10-14 — 2026-10-15 10:30"));
  assert.ok(brief.includes(original.split("\n").map((line) => `> ${line}`).join("\n")));
  for (const name of ["009-brief.md", "009-result.md", "010-brief.md", "011-result.md"]) assert.ok(brief.includes(name));
  assert.ok(!brief.includes("002-brief.md"));
  assert.ok(!brief.includes("002-result.md"));
  assert.ok(!brief.includes("measure-18"));
  assert.ok(brief.includes("measure-19"));
  assert.ok(brief.includes("measure-30"));
  assert.ok(brief.includes(path.join(ROOT, artifact)));
  assert.ok(brief.includes("/external/new-output.json"));
  assert.ok(!brief.includes("arbitrary executor task"));
  assert.ok(!brief.includes("custom template"));
  assert.ok(brief.endsWith(`${QUESTIONS}\n`));
  const opened = memory.reads.map(({ file }) => path.relative(ROOT, file));
  assert.ok(opened.every((file) => file === `${RESEARCH}/EVAL.md` || /^\.dove\/research\/rounds\/\d+-brief\.md$/u.test(file)));
  assert.ok(!memory.inspected.includes(source), "source pointer is not even stat-ed");
  assert.ok(!memory.inspected.includes(path.join(ROOT, artifact)), "raw artifacts are path-only attachments");
  assert.deepEqual([...memory.files], before);
});

test("large EVAL reads only a bounded tail with recent lines and intact UTF-8", (t) => {
  const evaluation = `${RESEARCH}/EVAL.md`;
  const memory = memoryFiles(t, {
    [evaluation]: `${"旧测量行，不应读完整历史。\n".repeat(30000)}${Array.from({ length: 20 }, (_, index) => `最新-${index} | ${"观测".repeat(300)}\n`).join("")}`
  });
  const brief = renderMentorBrief(ROOT, { fsOps: memory.fsOps });
  const reads = memory.reads.filter(({ file }) => file.endsWith("/EVAL.md"));
  assert.equal(reads.length, 1);
  assert.equal(reads[0].length, 16384);
  assert.ok(reads[0].position > 0);
  assert.ok(brief.includes("最新-19"));
  assert.ok(!brief.includes("最新-0 |"));
  assert.ok(!brief.includes("旧测量行"));
  assert.ok(!brief.includes("�"));
  assert.ok(Buffer.byteLength(brief) < 10000);
});

test("watch summaries exclude explicit historical judgments and show latest config and scan", (t) => {
  const memory = memoryFiles(t, {
    [`${WATCH}/config.json`]: JSON.stringify({ source: "draft", keywords: ["mechanism"] }),
    [`${WATCH}/2026-10-15.json`]: digest([paper("2610.00001"), paper("2610.00002"), { ...paper("2610.00003"), line: "已写的中文一句话" }], "partial"),
    [`${WATCH}/2026-10-14.json`]: digest([paper("2610.00003"), paper("2610.00004v2")]),
    [`${WATCH}/2026-10-13.json`]: digest([paper("2610.00005"), paper("2610.00006")]),
    [`${WATCH}/2026-10-12.json`]: digest([paper("2610.99999", "old digest is not read")]),
    [`${WATCH}/impact-2026-10-01.md`]: "- 2610.00001 | 无关 | 不当作未判断\n- 2610.00004 | 撞题 | 已判断\n",
    [`${WATCH}/impact-2026-10-15.md`]: "- 2610.00005 | 可借用 | 已判断 | 方向 | 已有摘要\n",
    [`${RESEARCH}/rounds/001-brief.md`]: "作者：导师\n- 2610.00002 | 新基线 | 历史判断仍有效\n",
    [`${WATCH}/scan-2026-10-01.md`]: "older scan body",
    [`${WATCH}/scan-2026-10-15.md`]: "latest scan body stays at path"
  });
  const before = [...memory.files];
  const brief = renderMentorBrief(ROOT, { fsOps: memory.fsOps });
  assert.ok(brief.includes('"source":"draft"'));
  assert.match(brief, /检索状态：partial/u);
  assert.match(brief, /最近 3 \/ 4 份清单找到 2 项/u);
  assert.ok(brief.includes("2610.00003"));
  assert.ok(brief.includes("已写的中文一句话"));
  assert.ok(brief.includes("Original abstract for 2610.00006"));
  assert.ok(brief.includes("原始发表日期：2026-10-10"));
  for (const id of ["2610.00001", "2610.00002", "2610.00004", "2610.00005", "2610.99999"]) assert.ok(!brief.includes(id), id);
  assert.ok(brief.includes("scan-2026-10-15.md"));
  assert.ok(!brief.includes("scan-2026-10-01.md"));
  assert.ok(!brief.includes("latest scan body"));
  assert.ok(!memory.reads.some(({ file }) => file.endsWith("2026-10-12.json") || file.includes("scan-")));
  assert.deepEqual([...memory.files], before);
});

test("watch bounds summaries and marks incomplete history, oversized or malformed digests", (t) => {
  const memory = memoryFiles(t, {
    [`${RESEARCH}/rounds/001-brief.md`]: `${"old material\n".repeat(10000)}- 2610.00001 | 可借用 | saved at the end\n`,
    [`${WATCH}/2026-10-15.json`]: digest(Array.from({ length: 12 }, (_, index) => ({ ...paper(`2610.${String(index + 1).padStart(5, "0")}`), abstract: "据摘要说明".repeat(300) }))),
    [`${WATCH}/2026-10-14.json`]: "{broken JSON",
    [`${WATCH}/2026-10-13.json`]: digest([{ ...paper("2610.99998"), abstract: "x".repeat(300000) }])
  });
  const brief = renderMentorBrief(ROOT, { fsOps: memory.fsOps });
  assert.match(brief, /待核对历史/u);
  assert.match(brief, /JSON 无法解析/u);
  assert.match(brief, /超过 256 KiB/u);
  assert.match(brief, /找到 11 项，最多展开 8 项/u);
  assert.equal((brief.match(/> 原始发表日期：/gu) ?? []).length, 8);
  assert.ok(!brief.includes("2610.00001"), "judgment at the end of an old long brief remains usable");
  assert.ok(!brief.includes("2610.00010"));
  assert.ok(memory.reads.every(({ file, length }) => length <= (file.endsWith(".json") ? 262144 : 65536)));
});

test("one signed opinion remains a path attachment and its complete length must not exceed 1000 characters", (t) => {
  const file = "notes/executor-opinion.md";
  const author = "作者：执行者\n";
  const opinion = `${author}${"观".repeat(1000 - Array.from(author).length)}`;
  const memory = memoryFiles(t, { [file]: opinion });
  const brief = renderMentorBrief(ROOT, { fsOps: memory.fsOps, opinion: file });
  assert.ok(brief.includes(path.join(ROOT, file)));
  assert.ok(brief.includes("作者：执行者"));
  assert.ok(brief.includes("1000 / 1000"));
  assert.ok(!brief.includes("观观观"), "opinion body is not copied into the call");
  const target = path.join(ROOT, file);
  memory.files.set(target, Buffer.from(`${opinion}多`));
  assert.throws(() => renderMentorBrief(ROOT, { fsOps: memory.fsOps, opinion: file }), /不超过 1000 字/u);
  memory.files.set(target, Buffer.from("Unattributed advice"));
  assert.throws(() => renderMentorBrief(ROOT, { fsOps: memory.fsOps, opinion: file }), /须标明作者/u);
  memory.files.set(target, Buffer.from("Author: \nNo name on the author line"));
  assert.throws(() => renderMentorBrief(ROOT, { fsOps: memory.fsOps, opinion: file }), /须标明作者/u);
  memory.files.set(target, Buffer.from("**Author**: Executor\nA labeled opinion."));
  assert.ok(renderMentorBrief(ROOT, { fsOps: memory.fsOps, opinion: file }).includes("作者：Executor"));
  assert.throws(() => renderMentorBrief(ROOT, { fsOps: memory.fsOps, opinion: "missing-opinion.md" }), /意见文件缺失/u);
});
