import fs from "node:fs";

import { COLD_READ_KEY } from "./cold-read.mjs";
import { userSaying } from "./dove-author-preferences.mjs";
import { readHookState, updateHookState } from "./hook-state.mjs";
import { inspectRoundState } from "./round-state.mjs";

// When the host ends a turn, Dove checks the two conditions it computes from
// the records (overrun, stall) and, once per condition, puts the user's own
// words back in front of the host. Clearly labeled as Dove quoting the user;
// never fires while the host is already answering a Stop prompt. A turn that
// rebuilt the manuscript gets one reminder of the cold read before delivery,
// then none until the next cold read.

const MANUSCRIPT_BUILD = /\b(?:latexmk|pdflatex|xelatex|lualatex|tectonic)\b/u;
const TRANSCRIPT_TAIL_BYTES = 4 << 20;

/** Did this turn (since the user's last own message) run a LaTeX build? */
export function turnRebuiltManuscript(transcriptPath, fsOps = fs) {
  if (typeof transcriptPath !== "string" || !transcriptPath) return false;
  let text;
  try {
    const size = fsOps.statSync(transcriptPath).size;
    const start = Math.max(0, size - TRANSCRIPT_TAIL_BYTES);
    const fd = fsOps.openSync(transcriptPath, "r");
    try {
      const buffer = Buffer.alloc(size - start);
      fsOps.readSync(fd, buffer, 0, buffer.length, start);
      text = buffer.toString("utf8");
    } finally {
      fsOps.closeSync(fd);
    }
  } catch {
    return false;
  }
  const lines = text.split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    let record;
    try {
      record = JSON.parse(lines[index]);
    } catch {
      continue;
    }
    if (!record || record.isSidechain) continue;
    const content = record.message?.content;
    if (record.type === "user" && !record.isMeta) {
      const toolResult = Array.isArray(content) && content.some((block) => block?.type === "tool_result");
      const own = typeof content === "string" ? Boolean(content.trim()) : Array.isArray(content) && content.some((block) => block?.type === "text" && block.text?.trim());
      if (own && !toolResult) return false;
      continue;
    }
    if (record.type === "assistant" && Array.isArray(content)) {
      if (content.some((block) => block?.type === "tool_use" && block.name === "Bash" && MANUSCRIPT_BUILD.test(String(block.input?.command ?? "")))) return true;
    }
  }
  return false;
}

export function coldReadPrompt() {
  return "这一轮重新编译了稿件。交给用户之前，按 Draft 的终检做一次冷读：先 dove figure --pages <稿件.pdf> --body-pages <正文页数上限> --output <总览.png> 看版面，再 dove cold-read --pdf <稿件.pdf>，把它输出的调用正文原样交给一个全新的 dove-review，只给这份 PDF，不给源码、读数或项目背景；逐条处理它列出的行话、读不懂的地方和防御措辞，改完再冷读一次。写稿的人自己查不出自己的行话，这一步不能用自查代替。还在改就接着改，交付前再做。这段话是 Dove 根据本轮操作自动提出的，不是用户刚说的。";
}

export function parseStopPayload(input) {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    throw new Error("Dove Stop hook received malformed JSON.");
  }
  if (payload?.hook_event_name !== "Stop") throw new Error("Dove Stop hook received an unsupported or missing hook event.");
  return payload;
}

function quoted(id) {
  const saying = userSaying(id);
  return `【Dove 引用用户 ${saying.date} 的原话】“${saying.quote}”`;
}

export function overrunPrompt(state) {
  const round = state.currentRound;
  return `${quoted("fastest")}

第 ${round.number} 轮（${round.brief.file}）原定 ${state.overrun.due} 见分晓，预计 ${state.overrun.plannedDays} 天，现在已过 ${state.overrun.daysPastDue} 天，还没有结果。请先直接回答：卡在哪里？有没有更快、更直接的路？然后按操作说明“超时或停滞”这一时刻整理，停下来用一页决定备忘问用户：继续当前方法（附理由）、换方法，还是换方向。这段话是 Dove 根据记录自动提出的，不是用户刚说的。`;
}

export function stallPrompt(state) {
  return `${quoted("triage")}

第 ${state.stall.rounds.join("、")} 轮的判定都是未兑现，其间没有方法取舍。请按这句话整理一遍，然后停下来用一页决定备忘问用户：继续当前方法（附理由）、换方法（至少给一个不是从当前方法改出来的方法族，可以来自其他领域解同构问题的做法），还是换方向。等用户答复时，只做不依赖这个决定的事。这段话是 Dove 根据记录自动提出的，不是用户刚说的。`;
}

/**
 * Returns the Stop hook output, or null to let the host stop. Options: fsOps,
 * now, enabled (the user's stopPrompts setting).
 */
export function stopHookOutput(payload, project, options = {}) {
  if (options.enabled === false || payload?.stop_hook_active === true) return null;
  const state = inspectRoundState(project, options);
  const asked = readHookState(project, options).asked;
  const candidates = [];
  if (state.overrun) candidates.push({ key: `overrun:${state.currentRound.brief.file}:${state.overrun.due}`, reason: overrunPrompt(state) });
  if (state.stall) candidates.push({ key: `stall:${state.stall.results.at(-1)}`, reason: stallPrompt(state) });
  if (turnRebuiltManuscript(payload?.transcript_path, options.fsOps)) candidates.push({ key: `coldread:remind:${asked[COLD_READ_KEY] ?? "never"}`, reason: coldReadPrompt() });
  const next = candidates.find((candidate) => !asked[candidate.key]);
  if (!next) return null;
  updateHookState(project, (hookState) => {
    hookState.asked[next.key] = new Date(options.now ?? Date.now()).toISOString();
  }, options);
  return { decision: "block", reason: next.reason };
}
