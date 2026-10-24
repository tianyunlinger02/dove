import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  calibrateRound,
  computeOverrun,
  inspectRoundState,
  parseBriefHeader,
  parseMainMetric,
  parseMentorPending,
  parseActual,
  parseMethodDesign,
  parsePrediction,
  parseResultHeader,
  resultProvenance,
  parseTrendTable,
  renderRoundSituation
} from "../src/core/round-state.mjs";

const DAY = 86400000;
const at = (date) => Date.parse(`${date}T12:00:00`);

function memory(files) {
  const root = "/memory/project";
  const map = new Map(Object.entries(files).map(([relative, text]) => [path.join(root, relative), Buffer.from(text)]));
  const directories = new Set([root]);
  for (const file of map.keys()) for (let parent = path.dirname(file); parent.startsWith(root); parent = path.dirname(parent)) directories.add(parent);
  const fsOps = {
    lstatSync(target) {
      if (!map.has(target) && !directories.has(target)) throw Object.assign(new Error("absent"), { code: "ENOENT" });
      return { isFile: () => map.has(target), isDirectory: () => directories.has(target), isSymbolicLink: () => false, size: map.get(target)?.length ?? 0, mtimeMs: at("2026-10-20"), birthtimeMs: at("2026-10-20") };
    },
    readFileSync: (target) => map.get(target),
    readdirSync(target) {
      if (!directories.has(target)) throw Object.assign(new Error("absent"), { code: "ENOENT" });
      return [...new Set([...map.keys(), ...directories].filter((item) => path.dirname(item) === target).map((item) => path.basename(item)))];
    }
  };
  return { root, fsOps };
}

test("a brief's opening lines give the aim, due date with start, scale, one line and how it counts as done", () => {
  const brief = parseBriefHeader("Author: mentor\n**对准**：数据与评价——先对齐协议\n见分晓：2026-10-30（开始：2026-10-23）\n规模：445 对全量。\n\n一句话：对齐协议。\n\n## 预期结果\n\n评价这一维算成：同协议跑通。\n");
  assert.deepEqual(
    { target: brief.targetDimension, due: brief.due, start: brief.start, scale: brief.scale, summary: brief.summary, success: brief.success },
    { target: "数据与评价", due: "2026-10-30", start: "2026-10-23", scale: "445 对全量", summary: "对齐协议。", success: "评价这一维算成：同协议跑通。" }
  );
  assert.equal(parseBriefHeader("见分晓：2026-10-30（2026-10-20 开始）\n").start, "2026-10-20");
  assert.equal(parseBriefHeader("见分晓：2026-10-30\n").start, null, "the due date is never taken as the start");
  assert.equal(parseBriefHeader("Author: x\n\n## 预期结果\n\n对准的那一维怎样算成：……\n").target, null, "a later sentence is not the aim");
  assert.equal(parseBriefHeader("对准：评价\n").targetDimension, "数据与评价", "short names map to the dimension");
});

test("verdicts are read from the result's first lines and fall into three kinds", () => {
  assert.equal(parseResultHeader("判定：兑现（达到 55%）\n").verdictKind, "delivered");
  assert.equal(parseResultHeader("判定：未兑现\n").verdictKind, "missed");
  assert.equal(parseResultHeader("- **判定**：方法取舍（放弃类别分支）\n").verdictKind, "decision");
  assert.equal(parseResultHeader("判定：部分兑现\n").verdictKind, null, "other wording is shown as written, not guessed");
  assert.equal(parseResultHeader("一句话：旧格式结果。\n").verdict, null);
});

test("overrun means past the due date by as long again as planned", () => {
  const plan = { due: "2026-10-25", start: "2026-10-20" };
  assert.equal(computeOverrun(plan, at("2026-10-30")), null, "five days late on a five-day plan is not yet overrun");
  assert.deepEqual(computeOverrun(plan, at("2026-10-31")), { due: "2026-10-25", daysPastDue: 6, plannedDays: 5 });
  assert.equal(computeOverrun({ due: "2026-10-25", start: null, createdAt: at("2026-10-24") }, at("2026-10-26")), null);
  assert.ok(computeOverrun({ due: "2026-10-25", start: null, createdAt: at("2026-10-24") }, at("2026-10-27")), "without a start the brief's creation day counts");
  assert.equal(computeOverrun({ due: null }, at("2027-01-01")), null);
  assert.equal(at("2026-10-31") - at("2026-10-25"), 6 * DAY);
});

test("the main metric line and the trend table are read from EVAL", () => {
  assert.deepEqual(parseMainMetric("# EVAL\n\n主指标（待用户确认）：事件 F1（445 对）；当前最好：12.7（2026-10-22，第 39 轮）\n"),
    { text: "事件 F1（445 对）；当前最好：12.7（2026-10-22，第 39 轮）", name: "事件 F1（445 对）", best: "12.7（2026-10-22，第 39 轮）" });
  assert.equal(parseMainMetric("| 主指标 | x |\n"), null);
  const trend = parseTrendTable("| 日期 | 轮次 | 问题价值 | 创新 | 机制与理论 | 方法质量与可行性 | 数据与评价 | 实现 | 实验与证据价值 | 表达与交付 | 最卡的一维 |\n|---|---|---|---|---|---|---|---|---|---|---|\n| 10-20 | 第 2 轮 | 3 | 1 | 未知 | 2 | 2 | 2 | 2 | 2 | 创新 |\n| 10-22 | 第 3 轮 | 3 | 2 | 未知 | 2 | 1 | 2 | 2 | 2 | 数据与评价 |\n");
  assert.equal(trend.rows.length, 2);
  assert.equal(trend.latest.bottleneck, "数据与评价");
  assert.equal(trend.latest.grades["创新"], "2");
});

test("what waits for the user: an unanswered method design and the mentor's listed items", () => {
  const design = (reply) => `## 方法设计\n### 要解决什么问题\n失败。\n### 外部方法为什么不行\n不足。\n### 我们的改法为什么能修\n改法。\n### 用户答复\n${reply}\n## 预期结果\n`;
  assert.equal(parseMethodDesign(design("")).userReply, null);
  assert.equal(parseMethodDesign(design("（待用户答复）")).userReply, null);
  assert.equal(parseMethodDesign(design("尚未答复。")).userReply, null);
  assert.ok(parseMethodDesign(design("- 本人 2026-10-23：“可以，就这么做。”")).userReply);
  assert.deepEqual(parseMentorPending("## 10-20\n### 待用户决定\n- 旧事项\n## 10-22 导师笔记\n### 待用户决定\n- 是否扩大到 494 对\n- 无\n### 担忧\n- 不是待定项\n"), ["是否扩大到 494 对"]);
  assert.deepEqual(parseMentorPending("待用户决定：主指标；资源\n"), ["主指标", "资源"]);
  assert.deepEqual(parseMentorPending("### 待用户决定\n无\n"), []);
});

test("stall and overrun are computed from the records, and the situation names what is missing", () => {
  const { root, fsOps } = memory({
    ".dove/research/IDENTITY.md": "Current round: rounds/004-brief.md\nRound status: ongoing\nMethod design: rounds/004-brief.md\nMainline: x\n",
    ".dove/research/rounds/002-result.md": "判定：未兑现\n",
    ".dove/research/rounds/003-result.md": "判定：未兑现（仍低于预期）\n",
    ".dove/research/rounds/004-brief.md": "Author: mentor\n\n一句话：没写计划。\n\n## 方法设计\n### 要解决什么问题\n失败。\n### 用户答复\n\n## 预期结果\n",
    ".dove/research/EVAL.md": "主指标：F1（dev）；当前最好：0.5（第 3 轮）\n"
  });
  const state = inspectRoundState(root, { fsOps, now: at("2026-10-23") });
  assert.deepEqual(state.stall, { results: ["rounds/002-result.md", "rounds/003-result.md"], rounds: [2, 3] });
  assert.equal(state.overrun, null, "a brief without a due date cannot overrun");
  assert.deepEqual(state.pending.map((item) => item.kind), ["method-design", "stall"]);
  const situation = renderRoundSituation(state, { now: at("2026-10-23") });
  assert.match(situation, /本轮：第 4 轮（rounds\/004-brief\.md，进行中）：没写计划。/u);
  assert.match(situation, /本轮说明开头还缺：对准、见分晓、规模/u);
  assert.match(situation, /停滞：第 2、3 轮判定都是未兑现/u);
  assert.match(situation, /主指标：F1（dev）；当前最好：0\.5（第 3 轮）/u);

  const decided = memory({
    ".dove/research/IDENTITY.md": "Current round: rounds/004-brief.md\nRound status: ongoing\n",
    ".dove/research/rounds/002-result.md": "判定：未兑现\n",
    ".dove/research/rounds/003-result.md": "判定：方法取舍（放弃类别分支）\n",
    ".dove/research/rounds/004-brief.md": "对准：创新\n见分晓：2026-10-10（开始：2026-10-08）\n规模：全量。\n"
  });
  const later = inspectRoundState(decided.root, { fsOps: decided.fsOps, now: at("2026-10-23") });
  assert.equal(later.stall, null, "a method decision between misses is not a stall");
  assert.deepEqual(later.overrun, { due: "2026-10-10", daysPastDue: 13, plannedDays: 2 });
});

test("a prediction and its measurement are reconciled", () => {
  const prediction = parsePrediction("事件 F1 12.7 → 15–18");
  assert.deepEqual([prediction.baseline, prediction.low, prediction.high], [12.7, 15, 18]);
  const missed = calibrateRound(prediction, parseActual("事件 F1 13.2（第 40 轮）"));
  assert.equal(missed.hit, false);
  assert.ok(Math.abs(missed.ratio - 7.6) < 1e-9, "the predicted change was 7.6 times the real one");
  const hit = calibrateRound(prediction, parseActual("F1 16"));
  assert.deepEqual([hit.hit, hit.wrongWay, Math.round(hit.ratio * 100) / 100], [true, false, 1.15]);
  assert.equal(calibrateRound(parsePrediction("F1 12.7 → 15"), parseActual("F1 12.0")).wrongWay, true);
  const fractions = parsePrediction("结构通过 76/100 → 85/100");
  assert.deepEqual([fractions.baseline, fractions.low], [76, 85]);
  assert.equal(calibrateRound(fractions, parseActual("结构通过 85/100")).hit, true);
  assert.deepEqual([parsePrediction("事件 F1 15").baseline, parsePrediction("事件 F1 15").low], [null, 15], "without an arrow there is no baseline");
  assert.equal(calibrateRound(parsePrediction("写出可执行的整衣程序"), parseActual("F1 1.0")), null, "no number, no reconciliation");
  const header = parseBriefHeader("Author: mentor\n对准：数据与评价\n预测（主指标）：F1 12.7 → 15\n");
  assert.equal(header.prediction.low, 15);
  assert.equal(parseResultHeader("判定：未兑现\n实测：F1 13.2\n").actual.value, 13.2);
});

test("numbers a result reports are checked against the artifacts it links", () => {
  const { root, fsOps } = memory({
    ".dove/research/rounds/005-result.md": "判定：未兑现\n实测：F1 13.2\n\n## 测到了什么\n\nF1 13.20，召回 41.5%，结构 76/100；另有 9.99 不在产物里。见[结果](../../../outputs/metrics.json)。\n\n## 预期与实际\n\n12.7 不在这一节里。\n",
    "outputs/metrics.json": "{\"f1\": 0.132, \"recall\": 0.4152, \"structure_pass\": 76, \"total\": 100}"
  });
  assert.deepEqual(resultProvenance(root, "rounds/005-result.md", { fsOps }), { numbers: 4, found: 3, artifacts: 1 });
  const unlinked = memory({ ".dove/research/rounds/006-result.md": "## 测到了什么\n\nF1 13.20，见[说明](006-brief.md)。\n", ".dove/research/rounds/006-brief.md": "预测：F1 13.20\n" });
  assert.deepEqual(resultProvenance(unlinked.root, "rounds/006-result.md", { fsOps: unlinked.fsOps }), { numbers: 1, found: null, artifacts: 0 }, "Dove's own records are not artifacts");
});
