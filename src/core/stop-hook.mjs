import fs from "node:fs";

import { COLD_READ_KEY } from "./cold-read.mjs";
import { userSaying } from "./dove-author-preferences.mjs";
import { readHookState, updateHookState } from "./hook-state.mjs";
import { practiceOnTopic, readPractice, reflectionReminder, reflectionRequested, REFLECTIONS_DIR } from "./practice.mjs";
import { inspectRoundState } from "./round-state.mjs";

// When the host ends a turn, Dove checks the two conditions it computes from
// the records (overrun, stall) and, once per condition, puts the user's own
// words back in front of the host. Clearly labeled as Dove quoting the user;
// never fires while the host is already answering a Stop prompt. A turn that
// rebuilt the manuscript gets one reminder of the cold read before delivery,
// then none until the next cold read.

const MANUSCRIPT_BUILD = /\b(?:latexmk|pdflatex|xelatex|lualatex|tectonic)\b/u;
const TRANSCRIPT_TAIL_BYTES = 4 << 20;

const AUTOMATIC = /^(?:<(?:task-notification|scheduled-wakeup|background-task|system-reminder)[\s>]|\[Your previous response)/u;

/**
 * This turn, since the message that started it: whether it ran a LaTeX
 * build, the message text (unless it was an automatic notice), a key for it,
 * and whether the turn wrote the practice corrections.
 */
export function inspectTurn(transcriptPath, fsOps = fs) {
  const turn = { rebuilt: false, userText: null, userKey: null, wrotePractice: false, wroteReflection: false };
  if (typeof transcriptPath !== "string" || !transcriptPath) return turn;
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
    return turn;
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
      if (Array.isArray(content) && content.some((block) => block?.type === "tool_result")) continue;
      const said = typeof content === "string" ? content : Array.isArray(content) ? content.filter((block) => block?.type === "text").map((block) => block.text ?? "").join("\n") : "";
      if (!said.trim()) continue;
      if (!AUTOMATIC.test(said.trim())) {
        turn.userText = said.trim();
        turn.userKey = record.uuid ?? record.timestamp ?? said.trim().slice(0, 80);
      }
      return turn;
    }
    if (record.type === "assistant" && Array.isArray(content)) {
      for (const block of content) {
        if (block?.type !== "tool_use") continue;
        if (block.name === "Bash" && MANUSCRIPT_BUILD.test(String(block.input?.command ?? ""))) turn.rebuilt = true;
        if ((block.name === "Write" || block.name === "Edit") && /(?:^|\/)\.dove\/research\/PRACTICE\.md$/u.test(String(block.input?.file_path ?? ""))) turn.wrotePractice = true;
        if ((block.name === "Write" || block.name === "Edit") && /(?:^|\/)\.dove\/research\/reflections\/[^/]+\.md$/u.test(String(block.input?.file_path ?? ""))) turn.wroteReflection = true;
      }
    }
  }
  return turn;
}

/** Did this turn (since the user's last own message) run a LaTeX build? */
export function turnRebuiltManuscript(transcriptPath, fsOps = fs) {
  return inspectTurn(transcriptPath, fsOps).rebuilt;
}

export function coldReadPrompt(writingPractice = "") {
  return `这一轮重新编译了稿件。交给用户之前，按 Draft 的终检做一次冷读：先 dove figure --pages <稿件.pdf> --body-pages <正文页数上限> --output <总览.png> 看版面，再 dove cold-read --pdf <稿件.pdf>，把它输出的调用正文原样交给一个全新的 dove-review，只给这份 PDF，不给源码、读数或项目背景；逐条处理它列出的行话、读不懂的地方和防御措辞，改完再冷读一次。写稿的人自己查不出自己的行话，这一步不能用自查代替。还在改就接着改，交付前再做。${writingPractice ? `\n本项目写稿和图方面的做法更正：\n${writingPractice}\n` : ""}这段话是 Dove 根据本轮操作自动提出的，不是用户刚说的。`;
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

第 ${round.number} 轮（${round.brief.file}）原定 ${state.overrun.due} 见分晓，预计 ${state.overrun.plannedDays} 天，现在已过 ${state.overrun.daysPastDue} 天，还没有结果。请主会话先核对最新真实对话和本事项有来源的用户答复：已有适用的决定就按其事项和范围照做，不重复问；旧同意不能扩成新授权。确实还没有决定时，再直接回答：卡在哪里？有没有更快、更直接的路？然后按操作说明“超时或停滞”这一时刻整理，停下来用一页决定备忘问用户：继续当前方法（附理由）、换方法，还是换方向。这段话是 Dove 根据记录自动提出的，不是用户刚说的。`;
}

export function stallPrompt(state) {
  return `${quoted("triage")}

第 ${state.stall.rounds.join("、")} 轮的判定都是未兑现，其间没有方法取舍。请主会话先核对最新真实对话和本事项有来源的用户答复：已有适用的决定就按其事项和范围照做，不重复问；旧同意不能扩成新授权。确实还没有决定时，再按这句话整理一遍，然后停下来用一页决定备忘问用户：继续当前方法（附理由）、换方法（至少给一个不是从当前方法改出来的方法族，可以来自其他领域解同构问题的做法），还是换方向。如果确实还没有决定，等用户答复时只做不依赖这个决定的事。这段话是 Dove 根据记录自动提出的，不是用户刚说的。`;
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
  const turn = inspectTurn(payload?.transcript_path, options.fsOps);
  const reflect = turn.userText ? reflectionRequested(turn.userText) : false;
  if (reflect && (!turn.wroteReflection || !turn.wrotePractice)) {
    const missing = [...(turn.wroteReflection ? [] : [`存到 ${REFLECTIONS_DIR}`]), ...(turn.wrotePractice ? [] : ["把以后怎么做记进做法更正"])];
    candidates.unshift({ key: `reflect:${turn.userKey}`, reason: reflectionReminder(missing) });
  }
  if (turn.rebuilt) candidates.push({ key: `coldread:remind:${asked[COLD_READ_KEY] ?? "never"}`, reason: coldReadPrompt(practiceOnTopic(readPractice(project, options), "writing")) });
  const next = candidates.find((candidate) => !asked[candidate.key]);
  if (!next) return null;
  updateHookState(project, (hookState) => {
    hookState.asked[next.key] = new Date(options.now ?? Date.now()).toISOString();
  }, options);
  return { decision: "block", reason: next.reason };
}
