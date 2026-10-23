import { userSaying } from "./dove-author-preferences.mjs";
import { readHookState, updateHookState } from "./hook-state.mjs";
import { inspectRoundState } from "./round-state.mjs";

// When the host ends a turn, Dove checks the two conditions it computes from
// the records (overrun, stall) and, once per condition, puts the user's own
// words back in front of the host. Clearly labeled as Dove quoting the user;
// never fires while the host is already answering a Stop prompt.

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
  const candidates = [];
  if (state.overrun) candidates.push({ key: `overrun:${state.currentRound.brief.file}:${state.overrun.due}`, reason: overrunPrompt(state) });
  if (state.stall) candidates.push({ key: `stall:${state.stall.results.at(-1)}`, reason: stallPrompt(state) });
  const asked = readHookState(project, options).asked;
  const next = candidates.find((candidate) => !asked[candidate.key]);
  if (!next) return null;
  updateHookState(project, (hookState) => {
    hookState.asked[next.key] = new Date(options.now ?? Date.now()).toISOString();
  }, options);
  return { decision: "block", reason: next.reason };
}
