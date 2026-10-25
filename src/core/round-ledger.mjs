import { isCorrection, readOwnEntries } from "./cross-project.mjs";
import { calibrateRound, inspectRoundState, predictionFlags, resultProvenance, VERDICT_LABELS } from "./round-state.mjs";
import { ACTIVITY_BUCKET_MS, readActivity } from "./user-originals.mjs";

// Per round rather than per calendar week: what a round cost (time, subagent
// and mentor calls, compactions, the user's corrections) beside what it
// settled (verdict, prediction against the measurement), plus how the host
// wrote during it. Statistics for the mentor and the dashboard only.
//
// Rounds partition time: a round runs from the end of the previous one (or
// its brief, for the first) to when its result was first written; an
// unfinished round ends where the next brief begins, or now. Ends come from
// the transcripts (first Write of the file) and fall back to file times.

const HOUR_MS = 3600000;
const LEDGER_ROUNDS = 8;

function localMidnight(day) {
  const [year, month, date] = String(day).split("-").map(Number);
  return new Date(year, month - 1, date).getTime();
}

function finite(...values) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value) && value > 0) ?? null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// Old briefs sometimes hold a paragraph under "预测"; tables show its start.
export function clip(text, limit = 60) {
  if (text == null) return null;
  const characters = Array.from(String(text));
  return characters.length > limit ? `${characters.slice(0, limit).join("")}…` : characters.join("");
}

function clock(time) {
  const value = new Date(time);
  const pad = (number) => String(number).padStart(2, "0");
  return `${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function durationText(milliseconds) {
  const hours = milliseconds / HOUR_MS;
  return hours < 24 ? `${Math.max(1, Math.round(hours))} 小时` : `${Math.round(hours / 2.4) / 10} 天`;
}

/** [start, end) per round, oldest first. */
function roundSpans(rounds, marks, now) {
  const ordered = [...rounds].filter((round) => round.brief || round.result).sort((left, right) => left.number - right.number);
  const briefTime = (round) => finite(marks[`brief:${round.number}`], round.brief?.createdAt, round.brief?.start ? localMidnight(round.brief.start) : null);
  const resultTime = (round) => round.result ? finite(marks[`result:${round.number}`], round.result.createdAt, round.result.mtime) : null;
  const spans = new Map();
  let previousEnd = null;
  ordered.forEach((round, index) => {
    const next = ordered[index + 1];
    const end = resultTime(round) ?? (next ? briefTime(next) ?? resultTime(next) : null) ?? now;
    let start = previousEnd ?? briefTime(round) ?? end;
    if (start > end) start = briefTime(round) && briefTime(round) <= end ? briefTime(round) : end;
    spans.set(round.number, { start, end });
    previousEnd = Math.max(previousEnd ?? end, end);
  });
  return spans;
}

/**
 * Options: fsOps, now, state (an inspectRoundState result to reuse), limit
 * (rounds, default 8), provenance (check result numbers against linked artifacts).
 */
export function roundLedger(project, options = {}) {
  const state = options.state ?? inspectRoundState(project, options);
  const now = finite(typeof options.now === "number" ? options.now : options.now?.getTime?.()) ?? Date.now();
  let activity = { buckets: {}, marks: {}, scanned: false };
  try {
    activity = readActivity(project, options);
  } catch {
    // Without activity counts the ledger still shows plans and verdicts.
  }
  let corrections = [];
  try {
    corrections = readOwnEntries(project, options).filter((entry) => Number.isFinite(entry.at) && isCorrection(entry.text));
  } catch {
    corrections = [];
  }
  const buckets = Object.entries(activity.buckets ?? {}).map(([key, counts]) => [(Number(key) + 0.5) * ACTIVITY_BUCKET_MS, counts]);
  const spans = roundSpans(state.rounds, activity.marks ?? {}, now);
  const rows = state.rounds.filter((round) => round.brief && spans.has(round.number)).slice(0, options.limit ?? LEDGER_ROUNDS).map((round) => {
    const { start, end } = spans.get(round.number);
    const open = !round.result;
    // A bucket belongs to the round its middle falls in; an open round includes the bucket under way.
    const within = (time) => time >= start && (time < end || (open && time < end + ACTIVITY_BUCKET_MS));
    const sum = (field) => buckets.reduce((total, [time, counts]) => total + (within(time) ? counts[field] ?? 0 : 0), 0);
    const chars = sum("chars");
    const calibration = calibrateRound(round.brief.prediction, round.result?.actual);
    return {
      number: round.number,
      start,
      end,
      duration: durationText(end - start),
      open,
      agents: activity.scanned ? sum("agents") : null,
      compactions: activity.scanned ? sum("compactions") : null,
      mentor: activity.scanned ? sum("mentor") : null,
      corrections: corrections.filter((entry) => entry.at >= start && entry.at < (open ? end + ACTIVITY_BUCKET_MS : end)).length,
      verdict: round.result?.verdict ?? null,
      verdictKind: round.result?.verdictKind ?? null,
      verdictLabel: round.result ? VERDICT_LABELS[round.result.verdictKind] ?? (round.result.verdict ? "其他写法" : "未写判定") : null,
      prediction: clip(round.brief.prediction?.text),
      actual: clip(round.result?.actual?.text),
      flags: predictionFlags(round.brief.prediction),
      caveats: round.brief.prediction?.caveats ?? 0,
      calibration,
      check: calibration ? checkText(calibration) : null,
      provenance: options.provenance && round.result ? resultProvenance(project, round.result.file, options) : null,
      hedgesPer1k: activity.scanned && chars ? Math.round((10000 * sum("hedges")) / chars) / 10 : null,
      gates: activity.scanned ? sum("gates") : null,
      claims: activity.scanned ? sum("claims") : null,
      unrunClaims: activity.scanned ? sum("unrun") : null
    };
  });
  const finished = rows.filter((row) => !row.open);
  const summary = calibrationSummary(finished);
  summary.correctionsPerRound = finished.length ? Math.round((10 * finished.reduce((total, row) => total + row.corrections, 0)) / finished.length) / 10 : null;
  summary.text = renderCalibrationSummary(summary);
  return { rows, activityScanned: activity.scanned, summary };
}

// Fixed in advance, not tuned per project: with at least three scored rounds,
// hits on nine in ten with ranges at least twice the real change (or ranges
// that hold the value now in half the rounds) read as conservative; hits on
// six in ten or fewer with misses mostly short of the predicted change, or a
// predicted change at least twice the real one, read as optimistic; a
// predicted change at most half the real one also reads as conservative.
const SCORED_ROUNDS_FOR_DIRECTION = 3;

function round1(value) {
  return Math.round(value * 10) / 10;
}

export function calibrationSummary(finished) {
  const predicted = finished.filter((row) => row.prediction);
  const scored = finished.filter((row) => row.calibration?.scorable);
  const hits = scored.filter((row) => row.calibration.hit).length;
  const widths = scored.map((row) => row.calibration.widthRatio).filter((value) => value !== null);
  const ratios = finished.map((row) => row.calibration?.ratio).filter((value) => value !== null && value !== undefined);
  const holdsNow = scored.filter((row) => row.calibration.includesBaseline).length;
  const short = scored.filter((row) => row.calibration.missSide === "short").length;
  const beyond = scored.filter((row) => row.calibration.missSide === "beyond").length;
  const unscored = predicted.filter((row) => !row.calibration?.scorable);
  // Each unscored prediction counts once, under the first thing that keeps it from being scored.
  const reason = (row) => {
    const flags = row.flags ?? [];
    if (flags.includes("条件式")) return "conditional";
    if (flags.some((flag) => flag.startsWith("只给了"))) return "oneSided";
    if (flags.some((flag) => flag === "没有区间" || flag === "没有数字")) return "noRange";
    return "other";
  };
  const count = (kind) => unscored.filter((row) => reason(row) === kind).length;
  const medianWidth = median(widths);
  const medianRatio = median(ratios);
  const findings = [];
  if (predicted.length >= 2 && unscored.length * 2 >= predicted.length) findings.push({ kind: "vague", text: `说虚：写了预测的 ${predicted.length} 轮里有 ${unscored.length} 轮没法打分` });
  if (scored.length >= SCORED_ROUNDS_FOR_DIRECTION) {
    const rate = hits / scored.length;
    if (rate >= 0.9 && ((medianWidth ?? 0) >= 2 || holdsNow * 2 >= scored.length)) {
      findings.push({ kind: "conservative", text: `偏保守：命中 ${hits}/${scored.length}，${medianWidth === null ? "" : `区间宽度中位是实际变化的 ${round1(medianWidth)} 倍，`}${holdsNow} 轮区间包住了现在的值` });
    } else if (medianRatio !== null && medianRatio <= 0.5) {
      findings.push({ kind: "conservative", text: `偏保守：预测的变化中位只有实际的 ${round1(medianRatio)} 倍` });
    }
    if ((rate <= 0.6 && short > beyond) || (medianRatio !== null && medianRatio >= 2)) {
      findings.push({ kind: "optimistic", text: `偏乐观：命中 ${hits}/${scored.length}，落空 ${short + beyond} 轮里 ${short} 轮没达到预测的变化${medianRatio !== null ? `，预测的变化中位是实际的 ${round1(medianRatio)} 倍` : ""}` });
    }
    if (!findings.some((item) => item.kind !== "vague")) findings.push({ kind: "calibrated", text: `基本准：命中 ${hits}/${scored.length}（八成区间应约八成）` });
  }
  return {
    finished: finished.length,
    withPrediction: predicted.length,
    withoutPrediction: finished.length - predicted.length,
    scored: scored.length,
    hits,
    oneSided: count("oneSided"),
    conditional: count("conditional"),
    noRange: count("noRange"),
    holdsNow,
    unchanged: finished.filter((row) => row.calibration?.unchanged).length,
    short,
    beyond,
    medianWidth,
    medianRatio,
    caveats: predicted.reduce((total, row) => total + (row.caveats ?? 0), 0),
    direction: findings.map((item) => item.kind).filter((kind) => kind !== "vague")[0] ?? null,
    findings
  };
}

export function renderCalibrationSummary(summary) {
  if (!summary.finished) return "还没有出结果的轮次。";
  const parts = [`最近 ${summary.finished} 轮出了结果，写了预测 ${summary.withPrediction} 轮，能按八成区间打分 ${summary.scored} 轮`];
  const others = [["条件式", summary.conditional], ["只给一边", summary.oneSided], ["没有区间", summary.noRange]].filter(([, value]) => value).map(([name, value]) => `${name} ${value}`);
  if (others.length) parts[0] += `（另有${others.join("、")}）`;
  if (summary.scored) parts.push(`能打分的命中 ${summary.hits}/${summary.scored}，八成区间应约八成`);
  if (summary.medianWidth !== null) parts.push(`区间宽度中位是实际变化的 ${round1(summary.medianWidth)} 倍`);
  if (summary.unchanged) parts.push(`${summary.unchanged} 轮实际没有变化`);
  if (summary.medianRatio !== null) parts.push(`预测的变化中位是实际的 ${round1(summary.medianRatio)} 倍`);
  if (summary.caveats) parts.push(`预测行里共 ${summary.caveats} 处前提`);
  const verdict = summary.findings.length ? summary.findings.map((item) => item.text).join("；") : `能打分的轮次还不够 ${SCORED_ROUNDS_FOR_DIRECTION} 轮，先不下结论`;
  return `${parts.join("；")}。结论：${verdict}。`;
}

/** One round's reconciliation in a few words. */
export function checkText(calibration) {
  const words = [];
  if (calibration.hit === true) words.push("落在区间内");
  else if (calibration.hit === false) words.push(calibration.miss !== null ? `落在区间外，差 ${round1(calibration.miss)}` : "落在区间外");
  else words.push("没有区间，只比变化");
  if (calibration.unchanged) words.push("实际没有变化");
  else if (calibration.wrongWay) words.push("方向和预测相反");
  else if (calibration.ratio !== null) words.push(`预测的变化是实际的 ${round1(calibration.ratio)} 倍`);
  if (calibration.widthRatio !== null && calibration.widthRatio !== undefined) words.push(`区间宽度是实际变化的 ${round1(calibration.widthRatio)} 倍`);
  return words.join("，");
}

export function spanText(row) {
  return `${clock(row.start)}${row.open ? " 起，进行中" : ` — ${clock(row.end)}`}，${row.duration}`;
}

/** One plain line per round for the mentor's computed facts. */
export function renderLedgerRow(row) {
  const parts = [`第 ${row.number} 轮（${spanText(row)}）`];
  if (row.agents != null) parts.push(`子代理 ${row.agents} 次、上下文压缩 ${row.compactions} 次、导师 ${row.mentor} 次`);
  parts.push(`用户纠正 ${row.corrections} 次`);
  if (row.verdictLabel) parts.push(`判定 ${row.verdict ?? row.verdictLabel}`);
  if (row.prediction || row.actual) {
    parts.push(`预测 ${row.prediction ?? "未写"} → 实测 ${row.actual ?? (row.open ? "未出" : "未写")}${row.calibration ? `（${checkText(row.calibration)}）` : ""}`);
    if (row.flags?.length) parts.push(`预测写法：${row.flags.join("、")}`);
  } else if (!row.open) {
    parts.push("没写预测和实测");
  }
  if (row.provenance) parts.push(row.provenance.artifacts ? `结果里 ${row.provenance.numbers} 个数字有 ${row.provenance.found} 个能在链接的 ${row.provenance.artifacts} 个产物里找到` : `结果里的 ${row.provenance.numbers} 个数字没有链接可核对的文本产物`);
  if (row.hedgesPer1k != null) parts.push(`回复每千字兜底词 ${row.hedgesPer1k}，新增门禁词 ${row.gates}，没运行也没读取就说已验证或通过 ${row.unrunClaims} 次`);
  return parts.join("；");
}
