import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { parseDoveCurrentRound } from "../src/core/identity-card.mjs";
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
  predictionFlags,
  unscorableFlags,
  resultProvenance,
  parseTrendTable,
  renderRoundSituation,
  renderRoundStatusSummary
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

test("brief fields preserve the concrete aim alongside the date, scale and expected result", () => {
  const target = "方法质量与可行性——在完整输出中保留对象与动作的绑定";
  const success = "真实任务上正确对象与动作的配对增加，原有正确输出不丢失。";
  const brief = parseBriefHeader(`Author: mentor\n**对准**：${target}\n见分晓：2026-10-30（开始：2026-10-23）\n规模：445 对全量。\n\n一句话：改对象与动作绑定。\n\n## 预期结果\n\n${success}\n`);
  assert.deepEqual(
    { target: brief.target, due: brief.due, start: brief.start, scale: brief.scale, summary: brief.summary, success: brief.success },
    { target, due: "2026-10-30", start: "2026-10-23", scale: "445 对全量", summary: "改对象与动作绑定。", success }
  );
  const state = { currentRound: { number: 1, open: true, brief }, pending: [] };
  assert.ok(renderRoundSituation(state).includes(target));
  assert.ok(renderRoundStatusSummary(state).includes(target));
  assert.equal(parseBriefHeader("见分晓：2026-10-30（2026-10-20 开始）\n").start, "2026-10-20");
  assert.equal(parseBriefHeader("见分晓：2026-10-30\n").start, null, "the due date is never taken as the start");
  assert.equal(parseBriefHeader("Author: x\n\n## 预期结果\n\n对准的能力应该改善。\n").target, null, "a later sentence is not the aim");
  assert.equal(parseBriefHeader("对准：评价\n").targetDimension, "数据与评价", "existing dimension names remain readable");
});

test("verdicts are read from the result's first lines and fall into three kinds", () => {
  assert.equal(parseResultHeader("判定：兑现（达到 55%）\n").verdictKind, "delivered");
  assert.equal(parseResultHeader("判定：未兑现\n").verdictKind, "missed");
  assert.equal(parseResultHeader("- **判定**：方法取舍（放弃类别分支）\n").verdictKind, "decision");
  assert.equal(parseResultHeader("判定：部分兑现\n").verdictKind, null, "other wording is shown as written, not guessed");
  assert.equal(parseResultHeader("一句话：旧格式结果。\n").verdict, null);
});

test("the current-round parser recognizes an explicit ongoing token, not a word prefix", () => {
  const parse = (status) => parseDoveCurrentRound(`Current round: rounds/004-brief.md\n${status === null ? "" : `Round status: ${status}\n`}`);
  assert.equal(parse("ongoing；A已完成，B待做").ongoing, true);
  assert.equal(parse("进行中，A已完成，B待做").ongoing, true);
  assert.equal(parse("**ongoing**（A已完成，B待做）").ongoing, true);
  for (const status of ["ongoingish", "进行中止", "paused", "completed", "A已完成，B待做", "unknown", null]) {
    assert.equal(parse(status)?.ongoing ?? false, false, `status is not ongoing: ${status}`);
  }
  assert.equal(parseDoveCurrentRound("Round status: ongoing\n"), null, "a missing current-round reference is unknown");
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

test("only an explicitly ongoing current round without a result can be open or overrun", () => {
  const overdue = { due: "2026-10-10", daysPastDue: 13, plannedDays: 2 };
  const statuses = [
    ["ongoing", true],
    ["ONGOING；A已完成，B待做", true],
    ["**ongoing**（A已完成，B待做）", true],
    ["ongoing，A已暂停并结束，B待做", true],
    ["进行中；A已完成，B待做", true],
    ["paused；A已完成，B待做", false],
    ["completed；B待做", false],
    ["暂停（后续 ongoing）", false],
    ["已完成（后续进行中）", false],
    ["ongoingish", false],
    ["ongoing_next", false],
    ["ongoing-next", false],
    ["ongoing2", false],
    ["ongoing待做", false],
    ["进行中止", false],
    ["unknown", false],
    ["A已完成，B待做", false],
    ["", false],
    [null, false]
  ];
  for (const [status, ongoing] of statuses) {
    for (const hasResult of [false, true]) {
      const { root, fsOps } = memory({
        ".dove/research/IDENTITY.md": `Current round: rounds/004-brief.md\n${status === null ? "" : `Round status: ${status}\n`}`,
        ".dove/research/rounds/004-brief.md": "对准：创新\n见分晓：2026-10-10（开始：2026-10-08）\n规模：全量。\n",
        ...(hasResult ? { ".dove/research/rounds/004-result.md": "判定：未兑现\n" } : {})
      });
      const state = inspectRoundState(root, { fsOps, now: at("2026-10-23") });
      const context = `status=${status}, result=${hasResult}`;
      assert.equal(state.currentRound.open, ongoing && !hasResult, context);
      assert.equal(state.currentRound.status, status || null, context);
      assert.deepEqual(state.overrun, ongoing && !hasResult ? overdue : null, context);
      assert.deepEqual(state.pending, [], "overrun alone does not imply a pending user decision");
      if (hasResult) {
        assert.equal(state.currentRound.result.verdictKind, "missed", context);
        assert.match(renderRoundSituation(state, { now: at("2026-10-23") }).split("\n")[0], /已出结果/u, context);
      }
    }
  }

  const absent = memory({ ".dove/research/rounds/004-brief.md": "见分晓：2026-10-10\n" });
  const state = inspectRoundState(absent.root, { fsOps: absent.fsOps, now: at("2026-10-23") });
  assert.equal(state.currentRound, null, "a round file without an identity-card reference is not the current round");
  assert.equal(state.overrun, null);
});

test("an existing current result takes precedence outside the recent-round window and without a brief or verdict", () => {
  for (const hasBrief of [false, true]) {
    const { root, fsOps } = memory({
      ".dove/research/IDENTITY.md": "Current round: rounds/004-brief.md\nRound status: ongoing；A已完成，B待做\n",
      ".dove/research/rounds/004-result.md": "一句话：旧格式结果。\n",
      ".dove/research/rounds/005-brief.md": "一句话：下一轮。\n",
      ...(hasBrief ? { ".dove/research/rounds/004-brief.md": "见分晓：2026-10-10（开始：2026-10-08）\n" } : {})
    });
    const state = inspectRoundState(root, { fsOps, maxRounds: 1, now: at("2026-10-23") });
    assert.deepEqual(state.rounds.map((round) => round.number), [5], "reading the current round does not enlarge the recent-round window");
    assert.equal(state.currentRound.number, 4);
    assert.equal(state.currentRound.result.file, "rounds/004-result.md");
    assert.equal(state.currentRound.result.verdict, null);
    assert.equal(state.currentRound.open, false);
    assert.equal(state.overrun, null);
    assert.match(renderRoundSituation(state, { now: at("2026-10-23") }).split("\n")[0], /已出结果/u);
    assert.match(renderRoundStatusSummary(state), /已出结果/u);
  }
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

test("historical stall stays separate from the method and mentor note snapshots", () => {
  const { root, fsOps } = memory({
    ".dove/research/IDENTITY.md": "Current round: rounds/004-brief.md\nRound status: ongoing\nMethod design: rounds/004-brief.md\nMainline: x\n",
    ".dove/research/rounds/002-result.md": "判定：未兑现\n",
    ".dove/research/rounds/003-result.md": "判定：未兑现（仍低于预期）\n",
    ".dove/research/rounds/004-brief.md": "Author: mentor\n\n一句话：没写计划。\n\n## 方法设计\n### 要解决什么问题\n失败。\n### 用户答复\n\n## 预期结果\n",
    ".dove/research/MENTOR_NOTES.md": "### 待用户决定\n- 是否扩大到 494 对\n",
    ".dove/research/EVAL.md": "主指标：F1（dev）；当前最好：0.5（第 3 轮）\n"
  });
  const state = inspectRoundState(root, { fsOps, now: at("2026-10-23") });
  assert.deepEqual(state.stall, { results: ["rounds/002-result.md", "rounds/003-result.md"], rounds: [2, 3] });
  assert.equal(state.overrun, null, "a brief without a due date cannot overrun");
  assert.deepEqual(state.pending.map((item) => item.kind), ["method-design", "mentor"]);
  assert.equal(state.methodDesign.userReply, null);
  assert.equal(state.methodDesign.source, "rounds/004-brief.md");
  const situation = renderRoundSituation(state, { now: at("2026-10-23") });
  assert.match(situation, /本轮：第 4 轮（rounds\/004-brief\.md，进行中）：没写计划。/u);
  assert.match(situation, /停滞：第 2、3 轮判定都是未兑现/u);
  assert.match(situation, /主指标：F1（dev）；当前最好：0\.5（第 3 轮）/u);
  assert.deepEqual(situation.split("\n").filter((line) => line.startsWith("- ")), state.pending.map((item) => `- ${item.text}`), "rendered pending items contain only the recorded method and mentor entries");

  const decided = memory({
    ".dove/research/IDENTITY.md": "Current round: rounds/004-brief.md\nRound status: ongoing\n",
    ".dove/research/rounds/002-result.md": "判定：未兑现\n",
    ".dove/research/rounds/003-result.md": "判定：方法取舍（放弃类别分支）\n",
    ".dove/research/rounds/004-brief.md": "对准：创新\n见分晓：2026-10-10（开始：2026-10-08）\n规模：全量。\n"
  });
  const later = inspectRoundState(decided.root, { fsOps: decided.fsOps, now: at("2026-10-23") });
  assert.equal(later.stall, null, "a method decision between misses is not a stall");
  assert.deepEqual(later.overrun, { due: "2026-10-10", daysPastDue: 13, plannedDays: 2 });
  assert.deepEqual(later.pending, [], "overrun facts do not add a user-decision item");
});

test("an old written agreement cannot erase later missed verdicts or invent a pending decision", () => {
  const replies = [
    ["", null],
    ["（待用户答复）", null],
    ["用户 2026-10-01：可以，按这个方法继续。", "用户 2026-10-01：可以，按这个方法继续。"],
    ["用户 2026-10-01：暂停。", "用户 2026-10-01：暂停。"],
    ["用户 2026-10-01：换个方向试试。", "用户 2026-10-01：换个方向试试。"]
  ];
  for (const [reply, userReply] of replies) {
    const { root, fsOps } = memory({
      ".dove/research/IDENTITY.md": "Current round: rounds/004-brief.md\nRound status: ongoing\nMethod design: rounds/001-brief.md\n",
      ".dove/research/rounds/001-brief.md": `## 方法设计\n### 要解决什么问题\n失败。\n### 外部方法为什么不行\n不足。\n### 我们的改法为什么能修\n改法。\n### 用户答复\n${reply}\n`,
      ".dove/research/rounds/002-result.md": "判定：未兑现\n",
      ".dove/research/rounds/003-result.md": "判定：未兑现\n",
      ".dove/research/rounds/004-brief.md": "对准：创新\n见分晓：2026-10-10（开始：2026-10-08）\n规模：全量。\n"
    });
    const state = inspectRoundState(root, { fsOps, now: at("2026-10-23") });
    assert.deepEqual(state.stall, { results: ["rounds/002-result.md", "rounds/003-result.md"], rounds: [2, 3] }, `recorded reply does not change historical verdicts: ${reply}`);
    assert.deepEqual(state.overrun, { due: "2026-10-10", daysPastDue: 13, plannedDays: 2 });
    assert.equal(state.methodDesign.userReply, userReply);
    assert.deepEqual(state.pending.map((item) => item.kind), userReply ? [] : ["method-design"]);
    assert.deepEqual(renderRoundSituation(state, { now: at("2026-10-23") }).split("\n").filter((line) => line.startsWith("- ")), state.pending.map((item) => `- ${item.text}`));
  }
});

test("a prediction and its measurement are reconciled against an eighty-percent range", () => {
  const prediction = parsePrediction("事件 F1 12.7 → 15–18");
  assert.deepEqual([prediction.baseline, prediction.low, prediction.high, prediction.quantities], [12.7, 15, 18, 1]);
  const missed = calibrateRound(prediction, parseActual("事件 F1 13.2（第 40 轮）"));
  assert.deepEqual([missed.hit, missed.scorable, missed.missSide], [false, true, "short"]);
  assert.ok(Math.abs(missed.ratio - 7.6) < 1e-9, "the predicted change was 7.6 times the real one");
  assert.ok(Math.abs(missed.score - (3 + 10 * 1.8)) < 1e-9, "interval score: width plus ten times the miss");
  assert.ok(Math.abs(missed.widthRatio - 6) < 1e-9, "the range was six times as wide as the real change");
  const hit = calibrateRound(prediction, parseActual("F1 16"));
  assert.deepEqual([hit.hit, hit.wrongWay, Math.round(hit.ratio * 100) / 100], [true, false, 1.15]);
  const point = calibrateRound(parsePrediction("F1 12.7 → 15"), parseActual("F1 12.0"));
  assert.deepEqual([point.hit, point.scorable, point.wrongWay], [null, false, true], "a point without a range only compares the change");
  const fractions = parsePrediction("结构通过 76/100 → 82/100–88/100");
  assert.deepEqual([fractions.baseline, fractions.low, fractions.high], [76, 82, 88]);
  assert.equal(calibrateRound(fractions, parseActual("结构通过 85/100")).hit, true);
  assert.deepEqual([parsePrediction("事件 F1 未测 → 14–17").baseline, parsePrediction("事件 F1 未测 → 14–17").unmeasured], [null, true]);
  assert.equal(calibrateRound(parsePrediction("写出可执行的整衣程序"), parseActual("F1 1.0")), null, "no number, no reconciliation");
  assert.equal(parseBriefHeader("Author: mentor\n对准：数据与评价\n预测（主指标）：F1 12.7 → 14–16\n").prediction.high, 16);
  assert.equal(parseResultHeader("判定：未兑现\n实测：F1 13.2\n").actual.value, 13.2);
});

test("predictions written as words instead of a range are read and flagged", () => {
  const conditional = parsePrediction("基线 58/136；方案 A 预计 0–3/136；方案 D 若能解决瓶颈预计超过 58/136，否则不超过；所有预测不用于调参");
  assert.deepEqual([Math.round(conditional.low * 100) / 100, Math.round(conditional.high * 100) / 100], [0, 2.21], "0–3/136 shares the denominator");
  assert.deepEqual(predictionFlags(conditional), ["条件式", "写了 3 个量", "带 1 处前提"]);
  const commas = parsePrediction("基线 58/136；A 预计 0–3/136，B 的变化需逐题判断，D 若能解决瓶颈预计超过 58/136，否则不超过");
  assert.deepEqual([commas.low === 0, commas.conditional, predictionFlags(commas).includes("条件式")], [true, false, true], "a comma separates the plain clause from the conditional one");
  assert.equal(parsePrediction("联合成功（结构正确，完整分母）2260/10432 → 21–23%").baseline, (2260 / 10432) * 100, "commas inside brackets stay in the quantity's name");
  const oneSided = parsePrediction("候选数 0/2 → 至少 1/2（低置信度；不是完整成功率）");
  assert.deepEqual([oneSided.baseline, oneSided.low, oneSided.high], [0, 50, Infinity]);
  assert.deepEqual(unscorableFlags(oneSided), ["只给了下限"]);
  assert.equal(calibrateRound(oneSided, parseActual("候选数 1/2")).scorable, false, "a one-sided bound is checked but not scored");
  assert.equal(calibrateRound(oneSided, parseActual("候选数 1/2")).hit, true);
  const atMost = parsePrediction("最大间隙 520.754 毫米 → 不超过 5 毫米");
  assert.deepEqual([atMost.baseline, atMost.low, atMost.high], [520.754, -Infinity, 5], "不超过 is an upper bound, not 超过");
  const unmeasured = parsePrediction("条件信号 Δ/SE 当前未测 → ≥5；冷重放成功率 当前未测 → ≥160/200 件。前者只是开头信号，不代替后者");
  assert.deepEqual([unmeasured.baseline, unmeasured.low, unmeasured.quantities], [null, 5, 2]);
  const point = parsePrediction("联合成功 约2260/10432 件 → 约2210/10432 件。这是开发率外推，不是保证");
  assert.deepEqual(unscorableFlags(point), ["没有区间"]);
  assert.ok(predictionFlags(point).some((flag) => /前提/u.test(flag)));
  assert.equal(predictionFlags(parsePrediction("F1 12.7 → 11–15")).includes("区间包住了现在的值"), true);
  assert.deepEqual(predictionFlags(parsePrediction("取若干样本的 F1 12.7 → 14–17（八成把握）")), [], "若干 is not a condition and the stated confidence is not a number");
  const labelled = parsePrediction("同一上衣 705 个原缝的最大间隙 520.754 毫米 → 3–8 毫米");
  assert.equal(calibrateRound(labelled, parseActual("同一上衣 705 个原缝的最大间隙 6.1 毫米")).value, 6.1, "the value is read after the quantity's own name");
});

test("values are read outside bracketed notes, and a result that did not move is no change", () => {
  const prediction = parsePrediction("事件F1（固定445、官方协议）原始模型 11.54% → 微调预计 12%–16%；旧微调另计");
  assert.deepEqual([prediction.baseline, prediction.low, prediction.high], [11.54, 12, 16]);
  const result = calibrateRound(prediction, parseActual("事件F1（固定445、官方协议）2.8169%；变化比例 26.0674%（116/445）"));
  assert.deepEqual([result.value, result.hit, result.wrongWay], [2.8169, false, true], "445 inside the brackets is the protocol, not the value");
  const flat = parsePrediction("候选数 0/2 → 0–1/2（很低置信度，至少1/2才算兑现）");
  assert.deepEqual([flat.low, flat.high], [0, 50], "the range outside the brackets wins over the bound inside them");
  const still = calibrateRound(flat, parseActual("候选数 0/2"));
  assert.deepEqual([still.hit, still.unchanged, still.wrongWay, still.widthRatio, still.includesBaseline], [true, true, false, null, true]);
  const missed = calibrateRound(parsePrediction("候选数 0/2 → 至少 1/2"), parseActual("候选数 0/2"));
  assert.deepEqual([missed.hit, missed.unchanged, missed.wrongWay, missed.missSide], [false, true, false, null]);
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

test("optional planning fields remain readable without changing the per-message work context", () => {
  const evidence = "已有方法在真实数据上保留了跨图对应关系";
  const text = `Author: mentor\n对准：保留完整变化事件的对应关系\n正向证据：${evidence}\n预测：F1 12.7 → 14–17\n`;
  const header = parseBriefHeader(text);
  assert.equal(header.positiveEvidence, evidence);
  assert.equal(header.prediction.high, 17);
  const state = (brief) => ({ currentRound: { number: 5, open: true, brief: { file: "rounds/005-brief.md", ...brief } }, pending: [] });
  const minimal = parseBriefHeader("Author: mentor\n对准：保留完整变化事件的对应关系\n");
  assert.equal(renderRoundSituation(state(minimal)), renderRoundSituation(state(header)), "auxiliary fields neither add a completion demand nor a forecasting agenda");
  const completed = { ...state(header), currentRound: { ...state(header).currentRound, open: false, result: { verdict: null } } };
  assert.deepEqual(renderRoundSituation(completed).split("\n").slice(1), renderRoundSituation(state(header)).split("\n").slice(1), "an unclassified historical result changes the status, not the work context");
  completed.currentRound.result.actual = parseActual("事件 F1 13.2");
  assert.ok(renderRoundSituation(completed).includes(completed.currentRound.result.actual.text));
});
