import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { parsePaperImpacts } from "../src/core/dashboard-data.mjs";
import { renderMentorBrief } from "../src/core/mentor-brief.mjs";

const ROOT = "/memory/dove/project";
const RESEARCH = ".dove/research";
const WATCH = `${RESEARCH}/watch`;

// Every project byte lives in this Map. No disk fixtures or real project reads.
function memoryFiles(t, entries = {}, times = {}) {
  for (const name of ["readFileSync", "writeFileSync", "appendFileSync", "mkdirSync", "mkdtempSync", "renameSync", "unlinkSync", "rmSync", "statSync", "lstatSync", "realpathSync", "readdirSync", "openSync", "readSync", "closeSync"]) {
    t.mock.method(fs, name, () => assert.fail(`Unexpected disk I/O: ${name}`));
  }
  const files = new Map(Object.entries(entries).map(([file, text]) => [path.resolve(ROOT, file), Buffer.from(text)]));
  const mtimes = new Map(Object.entries(times).map(([file, time]) => [path.resolve(ROOT, file), time]));
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
      return { size: files.get(file)?.length ?? 0, mtimeMs: mtimes.get(file), isFile: () => files.has(file), isDirectory: () => directory(file) };
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
  assert.equal((brief.match(/^\d+\. /gmu) ?? []).length, 7);
  assert.match(brief, /## Dove 算出的事实/u);
  assert.match(brief, /当前轮次：身份卡没有指向当前轮次/u);
  assert.match(brief, /主指标：EVAL 开头还没写/u);
  assert.match(brief, /长期意图对照到期（导师笔记缺失/u, "a first mentor reads the project's whole goal history");
  for (const file of [".dove/install/RESEARCH_QUALITY.md", `${RESEARCH}/IDENTITY.md`, `${RESEARCH}/MENTOR_NOTES.md`, `${RESEARCH}/EVAL.md`, ".dove/install/TOPIC_CRITERIA.md", `${RESEARCH}/topics/PROJECT.md`, `${WATCH}/config.json`]) {
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
    [".dove/install/TOPIC_CRITERIA.md"]: "dove criteria",
    [`${RESEARCH}/topics/PROJECT.md`]: "project settings",
    [`${RESEARCH}/rounds/002-brief.md`]: "old brief",
    [`${RESEARCH}/rounds/002-result.md`]: "old result",
    [`${RESEARCH}/rounds/009-brief.md`]: "recent brief",
    [`${RESEARCH}/rounds/009-result.md`]: "recent result",
    [`${RESEARCH}/rounds/010-brief.md`]: "latest brief",
    [`${RESEARCH}/rounds/011-result.md`]: "latest result",
    [`${RESEARCH}/rounds/execution-dialogue.md`]: "do not read execution dialogue",
    [artifact]: "method,real_dev_score\nbaseline,0.62\nours,0.58\n",
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
  assert.ok(!brief.includes("measure-19"));
  assert.ok(!brief.includes("measure-30"), "executor EVAL remains a pointer, not the conclusion frame");
  assert.ok(brief.includes("> baseline,0.62\n> ours,0.58"));
  assert.ok(brief.indexOf("原始结果文件与数字") < brief.indexOf("宿主记录与目录"));
  assert.ok(brief.includes(path.join(ROOT, artifact)));
  assert.ok(brief.includes("/external/new-output.json"));
  assert.ok(!brief.includes("arbitrary executor task"));
  assert.ok(!brief.includes("custom template"));
  const opened = memory.reads.map(({ file }) => path.relative(ROOT, file));
  assert.ok(opened.includes(artifact), "explicit artifacts are bounded source attachments");
  // Besides explicit artifacts, Dove reads only the records it computes facts from.
  assert.ok(opened.every((file) => file === artifact || [`${RESEARCH}/MENTOR_NOTES.md`, `${RESEARCH}/IDENTITY.md`, `${RESEARCH}/EVAL.md`].includes(file) || /^\.dove\/research\/rounds\/\d+-(?:brief|result)\.md$/u.test(file)), opened.join(", "));
  assert.equal(opened.includes(`${RESEARCH}/rounds/execution-dialogue.md`), false);
  assert.equal(opened.includes(".dove/install/AUTHOR_PREFERENCES.md"), false);
  assert.ok(!memory.inspected.includes(source), "source pointer is not even stat-ed");
  assert.ok(memory.inspected.includes(path.join(ROOT, artifact)), "only explicit artifact paths are inspected");
  assert.deepEqual([...memory.files], before);
});

test("mentor facts keep historical misses separate from unanswered record snapshots", (t) => {
  const identity = `${RESEARCH}/IDENTITY.md`;
  const design = `${RESEARCH}/rounds/003-brief.md`;
  const memory = memoryFiles(t, {
    [identity]: "Current round: rounds/003-brief.md\nRound status: ongoing；A已完成，B待做\nMethod design: rounds/003-brief.md\n",
    [`${RESEARCH}/rounds/001-result.md`]: "判定：未兑现\n",
    [`${RESEARCH}/rounds/002-result.md`]: "判定：未兑现\n",
    [design]: "对准：实现\n见分晓：2026-10-21（开始：2026-10-20）\n规模：完整输入输出。\n",
    [`${RESEARCH}/MENTOR_NOTES.md`]: "### 待用户决定\n- 是否增加新数据。\n"
  });
  const render = () => renderMentorBrief(ROOT, { fsOps: memory.fsOps, now: new Date(2026, 9, 26, 12) });
  let brief = render();
  assert.match(brief, /第 1、2 轮判定都是未兑现/u);
  assert.match(brief, /原定 2026-10-21 见分晓/u);
  assert.match(brief, /导师笔记快照：是否增加新数据/u);
  assert.doesNotMatch(brief, /继续当前方法、换方法还是换方向，等用户定/u);
  memory.files.set(path.join(ROOT, design), Buffer.from("## 方法设计\n### 要解决什么问题\n核心未实现。\n### 外部方法为什么不行\n缺完整输出。\n### 我们的改法为什么能修\n补齐计算链路。\n### 用户答复\n"));
  brief = render();
  assert.match(brief, /方法设计（rounds\/003-brief\.md）尚未记录书面答复/u);
  memory.files.set(path.join(ROOT, design), Buffer.from(`${memory.files.get(path.join(ROOT, design)).toString()}2026-10-26 当前会话：先补齐核心代码。\n`));
  brief = render();
  assert.doesNotMatch(brief, /方法设计（rounds\/003-brief\.md）尚未记录书面答复/u);
  assert.match(brief, /第 1、2 轮判定都是未兑现/u, "recording a reply does not erase the historical misses");
  assert.match(brief, /导师笔记快照：是否增加新数据/u, "the saved note is still a snapshot, not a current decision judgment");
});

test("large original results get a bounded sourced tail instead of an EVAL conclusion", (t) => {
  const artifact = "outputs/results.csv";
  const memory = memoryFiles(t, {
    [`${RESEARCH}/EVAL.md`]: "宿主结论：方法取得重大突破。",
    [artifact]: `${"旧测量行，不应读完整历史。\n".repeat(30000)}${Array.from({ length: 20 }, (_, index) => `最新-${index} | ${"观测".repeat(300)}\n`).join("")}`
  });
  const brief = renderMentorBrief(ROOT, { fsOps: memory.fsOps, artifact: [artifact] });
  const reads = memory.reads.filter(({ file }) => file.endsWith("/results.csv"));
  assert.equal(reads.length, 1);
  assert.equal(reads[0].length, 8192);
  assert.ok(reads[0].position > 0);
  assert.match(brief, /末尾片段，读取字节 \d+–\d+ \/ \d+；起首可能是残行，不代表全文/u);
  assert.ok(brief.includes("最新-19"));
  assert.ok(!brief.includes("最新-0 |"));
  assert.ok(!brief.includes("旧测量行"));
  assert.ok(!brief.includes("重大突破"), "Dove reads only EVAL's main-metric line and trend table, never its conclusions");
  assert.ok(!brief.includes("�"));
  assert.ok(Buffer.byteLength(brief) < 15000);
});

test("user wording, correction excerpts and raw numbers precede host framing without opening sessions", (t) => {
  const originals = ".dove/install/USER_ORIGINALS.md";
  const source = "/private/host/session.jsonl";
  const index = "# 用户本人原话汇总\n- 2026-10-19 10:00 · 本人 · 你这感觉变成工程，不是科研了啊\n- 2026-10-20 11:00 · 转述 · 这里只是代传，不是用户确认\n";
  const original = "先回答我。\n\n保留  原来的空格。";
  const raw = "outputs/results.json";
  const memory = memoryFiles(t, {
    [originals]: index,
    [raw]: `{\"real_dev_baseline\":0.72,\"real_dev_ours\":0.61,\"next_file\":\"${source}\"}`,
    [`${RESEARCH}/EVAL.md`]: "宿主称结果完全成功",
    [source]: "PRIVATE_CONVERSATION_NOT_TO_READ"
  });
  const brief = renderMentorBrief(ROOT, {
    fsOps: memory.fsOps, userOriginal: original, userSource: source, since: "2026-10-20", until: "2026-10-22",
    userOriginals: { path: originals, own: 1, relay: 1, directories: ["/private/session-directory"], pendingBytes: 1 },
    artifact: [raw], trigger: "执行者建议直接继续"
  });
  assert.ok(brief.includes(original.split("\n").map((line) => `> ${line}`).join("\n")), "direct supplied wording stays verbatim");
  assert.ok(brief.includes(index.split("\n").map((line) => `> ${line}`).join("\n")));
  assert.match(brief, /索引性摘录.*每条最多 700 字.*不是完整原话/u);
  assert.match(brief, /尚未整理完/u);
  assert.match(brief, /日期范围仅按输入展示/u);
  assert.ok(brief.indexOf(original.split("\n")[0]) < brief.indexOf("你这感觉变成工程"));
  assert.ok(brief.indexOf("你这感觉变成工程") < brief.indexOf("real_dev_baseline"));
  assert.ok(brief.indexOf("real_dev_baseline") < brief.indexOf("执行者建议直接继续"));
  assert.ok(!brief.includes("完全成功"));
  assert.ok(!brief.includes("PRIVATE_CONVERSATION_NOT_TO_READ"));
  assert.ok(!memory.inspected.includes(source));
  assert.ok(!memory.inspected.includes("/private/session-directory"));
});

test("raw attachments are bounded explicit files, not recursive data or claimed reads", (t) => {
  const artifacts = ["outputs/a.csv", "outputs", "outputs/binary.bin", "/external/missing.csv", "outputs/extra.csv"];
  const memory = memoryFiles(t, {
    [artifacts[0]]: "baseline,0.55\nours,0.48\n",
    "outputs/not-requested.csv": "NOT_REQUESTED_SECRET",
    [artifacts[2]]: "binary\0payload",
    [artifacts[4]]: "EXTRA_NOT_READ",
    ".dove/install/USER_ORIGINALS.md": `${"old excerpt\n".repeat(1000)}- 2026-10-22 · 本人 · 先回答有没有实质科研进展\n`
  });
  const brief = renderMentorBrief(ROOT, { fsOps: memory.fsOps, artifact: artifacts });
  assert.match(brief, /baseline,0.55/u);
  assert.ok(brief.includes(`来源：\`${path.join(ROOT, artifacts[0])}\`（全文，`));
  assert.match(brief, /不是文件；未附正文/u);
  assert.match(brief, /二进制内容，未展开/u);
  assert.match(brief, /缺失；未附正文/u);
  assert.match(brief, /超出本次展开数量，仅列路径/u);
  assert.match(brief, /先回答有没有实质科研进展/u);
  assert.match(brief, /末尾片段，读取字节/u);
  assert.ok(!brief.includes("NOT_REQUESTED_SECRET"));
  assert.ok(!brief.includes("EXTRA_NOT_READ"));
  assert.ok(!memory.inspected.includes(path.join(ROOT, artifacts[4])));
  assert.ok(!memory.inspected.includes(path.join(ROOT, "outputs/not-requested.csv")));
  assert.ok(memory.reads.every(({ length }) => length <= 8192));
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

test("bounded mentor and dashboard agree on linked/fullwidth exact labels and newer uncertain rows", (t) => {
  const ids = Array.from({ length: 7 }, (_, index) => `2610.${String(index + 1).padStart(5, "0")}`);
  const memory = memoryFiles(t, {
    [`${RESEARCH}/rounds/001-brief.md`]: ids.map((id) => `- ${id} | 无关 | 旧的正式判断`).join("\n"),
    [`${WATCH}/impact-2026-10-15.md`]: [
      "2610.00001 | 无关？待核实 | 需要复核",
      "1. | [\`arXiv:2610.00002v2\`](https://arxiv.org/abs/2610.00002) | **可借用** | A \\| B | 方向 | 一句话 |",
      "- 2610.00003 ｜ 新基线 ｜ 已确定",
      "- 2610.00004 | 未知 | 暂无结论",
      "- 2610.00005 | 无关 | 已核实",
      "- 2610.00006 | 撞题（暂定） | 还需核实",
      "- 2610.00007 | 无关? | 同文件较早的不确定判断",
      "- 2610.00007 | 撞题 | 新判断覆盖"
    ].join("\n"),
    [`${WATCH}/impact-2026-10-14.md`]: "- 2610.00001 | 无关 | 中间正式判断\n",
    [`${WATCH}/2026-10-15.json`]: digest(ids.map((id) => paper(id)))
  });
  const brief = renderMentorBrief(ROOT, { fsOps: memory.fsOps });
  const fsOps = {
    statSync: memory.fsOps.statSync,
    lstatSync(file) { return { ...memory.fsOps.statSync(file), isSymbolicLink: () => false }; },
    readFileSync(file, encoding) { assert.ok(memory.files.has(file)); return encoding ? memory.files.get(file).toString(encoding) : memory.files.get(file); },
    readdirSync(directory) {
      const prefix = `${directory}/`;
      return [...new Set([...memory.files.keys()].filter((file) => file.startsWith(prefix)).map((file) => file.slice(prefix.length).split("/")[0]))];
    }
  };
  const impacts = parsePaperImpacts(ROOT, { fsOps });
  const pending = [ids[0], ids[3], ids[5]];
  assert.match(brief, /找到 3 项/u);
  for (const id of ids) {
    assert.equal(!impacts[id], pending.includes(id), id);
    assert.equal(brief.includes(`> ${id} ·`), pending.includes(id), id);
  }
  assert.equal(impacts[ids[1]].note, "A | B");
  assert.ok(memory.reads.every(({ file, length }) => length <= (file.endsWith(".json") ? 262144 : 65536)));
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

test("the long-term intent comparison comes due by rounds, not calendar days", (t) => {
  const notesFile = `${RESEARCH}/MENTOR_NOTES.md`;
  const resultFile = `${RESEARCH}/rounds/001-result.md`;
  const memory = memoryFiles(t, {
    [notesFile]: "## 长期意图（2026-10-10）\n最近对照。",
    [`${RESEARCH}/rounds/001-brief.md`]: "Author: mentor\n",
    [resultFile]: "判定：未兑现\n"
  }, { [resultFile]: Date.parse("2026-10-11T12:00:00") });
  const due = () => renderMentorBrief(ROOT, { fsOps: memory.fsOps }).includes("长期意图对照到期");
  assert.equal(due(), false, "one round since the comparison");
  memory.files.set(path.join(ROOT, notesFile), Buffer.from("## 长期意图\n无日期。"));
  assert.equal(due(), true, "an undated comparison is due");
  memory.files.set(path.join(ROOT, notesFile), Buffer.from(`${"历史。\n".repeat(20000)}\n## 长期意图（2026-10-10）\n最近对照。`));
  memory.files.set(path.join(ROOT, resultFile), Buffer.from("判定：方法取舍（放弃类别分支）\n"));
  assert.equal(due(), true, "a method decision since the comparison");
});

test("tracking guidance reflects the saved source and never treats broken configuration as adopted", (t) => {
  const file = path.join(ROOT, WATCH, "config.json");
  const memory = memoryFiles(t);
  const render = () => renderMentorBrief(ROOT, { fsOps: memory.fsOps });
  assert.match(render(), /追踪配置待导师修正/u);
  for (const source of ["draft", "mentor", "user"]) {
    memory.files.set(file, Buffer.from(JSON.stringify({ source, keywords: ["mechanism"] })));
    assert.equal(render().includes("追踪配置待导师修正"), source === "draft");
  }
  for (const text of ["{broken JSON", JSON.stringify({ source: "mentor", keywords: ["x".repeat(9000)] })]) {
    memory.files.set(file, Buffer.from(text));
    assert.match(render(), /追踪配置待导师修正/u);
  }
});

test("an opinion stays a path attachment that reports its author and length without blocking the call", (t) => {
  const file = "notes/executor-opinion.md";
  const author = "作者：执行者\n";
  const opinion = `${author}${"观".repeat(1000 - Array.from(author).length)}`;
  const memory = memoryFiles(t, { [file]: opinion });
  const brief = renderMentorBrief(ROOT, { fsOps: memory.fsOps, opinion: file });
  assert.ok(brief.includes(path.join(ROOT, file)));
  assert.ok(brief.includes("作者：执行者"));
  assert.ok(brief.includes("约 1000 字"));
  assert.ok(!brief.includes("观观观"), "opinion body is not copied into the call");
  const target = path.join(ROOT, file);
  memory.files.set(target, Buffer.from(`${opinion}${"多".repeat(2000)}`));
  assert.ok(renderMentorBrief(ROOT, { fsOps: memory.fsOps, opinion: file }).includes("超过 4 KiB"));
  memory.files.set(target, Buffer.from("Unattributed advice"));
  assert.ok(renderMentorBrief(ROOT, { fsOps: memory.fsOps, opinion: file }).includes("未署名"));
  memory.files.set(target, Buffer.from("**Author**: Executor\nA labeled opinion."));
  assert.ok(renderMentorBrief(ROOT, { fsOps: memory.fsOps, opinion: file }).includes("作者：Executor"));
  assert.throws(() => renderMentorBrief(ROOT, { fsOps: memory.fsOps, opinion: "missing-opinion.md" }), /意见文件缺失/u);
});

test("long notes come due for consolidation, and the brief lists the practice corrections", (t) => {
  const notesFile = `${RESEARCH}/MENTOR_NOTES.md`;
  const memory = memoryFiles(t, {
    [notesFile]: `## 长期意图（2026-10-20）\n### 核心需求\n- 写可改的程序\n${"历史判断。\n".repeat(16000)}`,
    [`${RESEARCH}/PRACTICE.md`]: "- 2026-10-25 · 写稿和图 · 原话：“查不出自己的行话” · 错在哪：只自查 · 以后：交付前冷读\n- 2026-10-24 · 写稿和图 · 原话：“摘要堆数字” · 以后：先讲发现\n"
  });
  const brief = renderMentorBrief(ROOT, { fsOps: memory.fsOps, now: new Date(2026, 9, 26, 9) });
  assert.match(brief, /导师笔记整理到期（现有 \d+ KB，超过 64 KB）：本次另返回“## 整理后的导师笔记（2026-10-26）”/u);
  assert.match(brief, /MENTOR_NOTES-2026-10-26\.md/u);
  assert.match(brief, /做法更正（\.dove\/research\/PRACTICE\.md，共 2 条，最近 10 条如下；反复出现：写稿和图 2 次）/u);
  assert.match(brief, /2026-10-25 · 写稿和图 · 原话：“查不出自己的行话” · 错在哪：只自查 · 以后：交付前冷读/u);
  memory.files.set(path.join(ROOT, notesFile), Buffer.from("## 长期意图（2026-10-20）\n短笔记。"));
  assert.doesNotMatch(renderMentorBrief(ROOT, { fsOps: memory.fsOps }), /整理到期/u, "short notes are not due");
});
