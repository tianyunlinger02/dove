import { isCorrection, readOwnEntries } from "./cross-project.mjs";
import { calibrateRound, inspectRoundState, resultProvenance, VERDICT_LABELS } from "./round-state.mjs";
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
      calibration: calibrateRound(round.brief.prediction, round.result?.actual),
      provenance: options.provenance && round.result ? resultProvenance(project, round.result.file, options) : null,
      hedgesPer1k: activity.scanned && chars ? Math.round((10000 * sum("hedges")) / chars) / 10 : null,
      gates: activity.scanned ? sum("gates") : null,
      claims: activity.scanned ? sum("claims") : null,
      unrunClaims: activity.scanned ? sum("unrun") : null
    };
  });
  const finished = rows.filter((row) => !row.open);
  const calibrated = finished.filter((row) => row.calibration);
  const ratios = calibrated.map((row) => row.calibration.ratio).filter((ratio) => ratio != null);
  return {
    rows,
    activityScanned: activity.scanned,
    summary: {
      finished: finished.length,
      withoutPrediction: finished.filter((row) => !row.prediction).length,
      calibrated: calibrated.length,
      hits: calibrated.filter((row) => row.calibration.hit).length,
      wrongWay: calibrated.filter((row) => row.calibration.wrongWay).length,
      medianRatio: median(ratios),
      correctionsPerRound: finished.length ? Math.round((10 * finished.reduce((total, row) => total + row.corrections, 0)) / finished.length) / 10 : null
    }
  };
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
    const check = row.calibration ? `（${row.calibration.hit ? "落在预测范围内" : "不在预测范围内"}${row.calibration.wrongWay ? "，方向和预测相反" : row.calibration.ratio != null ? `，预测的变化是实际的 ${Math.round(row.calibration.ratio * 10) / 10} 倍` : ""}）` : "";
    parts.push(`预测 ${row.prediction ?? "未写"} → 实测 ${row.actual ?? (row.open ? "未出" : "未写")}${check}`);
  } else if (!row.open) {
    parts.push("没写预测和实测");
  }
  if (row.provenance) parts.push(row.provenance.artifacts ? `结果里 ${row.provenance.numbers} 个数字有 ${row.provenance.found} 个能在链接的 ${row.provenance.artifacts} 个产物里找到` : `结果里的 ${row.provenance.numbers} 个数字没有链接可核对的文本产物`);
  if (row.hedgesPer1k != null) parts.push(`回复每千字兜底词 ${row.hedgesPer1k}，新增门禁词 ${row.gates}，没运行也没读取就说已验证或通过 ${row.unrunClaims} 次`);
  return parts.join("；");
}
