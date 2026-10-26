function dateIn(text) {
  const date = String(text).match(/\b\d{4}-\d{2}-\d{2}\b/u)?.[0];
  const time = date ? Date.parse(`${date}T00:00:00Z`) : NaN;
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date ? date : null;
}

// Keep the section's Markdown and child headings. A date on its enclosing note
// also counts; an unrelated dated paragraph must not renew an old intent.
export function latestLongTermIntent(text = "") {
  const lines = String(text).split(/\r?\n/u);
  const headings = [];
  const parents = [];
  let fence = null;
  for (const [index, line] of lines.entries()) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/u)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    const match = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/u);
    if (!match) {
      const explicitDate = line.match(/^\s*(?:[-*]\s*)?(?:\*\*)?日期(?:\*\*)?\s*[:：]\s*(\d{4}-\d{2}-\d{2})\s*$/u)?.[1];
      if (parents.length && explicitDate) parents.at(-1).bodyDate ??= dateIn(explicitDate);
      continue;
    }
    const level = match[1].length;
    while (parents.length && parents.at(-1).level >= level) parents.pop();
    const heading = { index, level, title: match[2], date: dateIn(match[2]), inheritedDate: parents.at(-1)?.date ?? parents.at(-1)?.inheritedDate ?? null };
    headings.push(heading);
    parents.push(heading);
  }
  let latest = null;
  for (const [index, heading] of headings.entries()) {
    if (!/^长期意图(?:\s|[（(:：—–-]|$)/u.test(heading.title)) continue;
    const end = headings.slice(index + 1).find((next) => next.level <= heading.level)?.index ?? lines.length;
    const body = lines.slice(heading.index + 1, end).join("\n").trim();
    const intent = { date: heading.date ?? heading.bodyDate ?? heading.inheritedDate, text: body };
    if (!latest || (intent.date && (!latest.date || intent.date >= latest.date)) || (!intent.date && !latest.date)) latest = intent;
  }
  return latest;
}

export const LONG_TERM_INTENT_ROUNDS = 3;
// Phases without rounds (writing a paper) still bring new needs: the user's own words count too.
export const LONG_TERM_INTENT_MESSAGES = 30;

/**
 * Counted in rounds and in the user's words, not calendar days: due when
 * there is no dated comparison yet, once three rounds have ended since it,
 * when a round since it decided on the core method, or once the user has said
 * 30 more messages of their own. `finishedRounds` is [{ day, kind }].
 */
export function longTermIntentDue(intent, finishedRounds = [], newOwnMessages = 0) {
  if (!intent?.date || dateIn(intent.date) !== intent.date) return true;
  const since = finishedRounds.filter((round) => round?.day && round.day > intent.date);
  return since.length >= LONG_TERM_INTENT_ROUNDS || since.some((round) => round.kind === "decision") || newOwnMessages >= LONG_TERM_INTENT_MESSAGES;
}

/** The user's own messages after a date (local days), from the originals summary entries. */
export function ownMessagesSince(entries, date) {
  return entries.filter((entry) => !date || (entry.day && entry.day > date)).length;
}

/**
 * The part of the latest long-term intent a host should carry: its "核心需求"
 * and "约束" subsections, or the opening of the section when it has neither.
 */
export function coreNeedsOf(intent, limit = 900) {
  if (!intent?.text) return null;
  const lines = intent.text.split(/\r?\n/u);
  const section = (title) => {
    const start = lines.findIndex((line) => new RegExp(`^\\s{0,3}#{2,6}\\s*${title}`, "u").test(line));
    if (start === -1) return null;
    const end = lines.findIndex((line, index) => index > start && /^\s{0,3}#{2,6}\s/u.test(line));
    const body = lines.slice(start + 1, end === -1 ? undefined : end).join("\n").trim();
    return body || null;
  };
  const needs = section("核心需求");
  const limits = section("约束");
  if (needs || limits) return [needs ? `核心需求：\n${needs}` : null, limits ? `约束：\n${limits}` : null].filter(Boolean).join("\n");
  // Older sections lead with the long-term goal; the paragraphs after it are status.
  const first = intent.text.trim().split(/\n\s*\n/u)[0].trim();
  const characters = Array.from(first);
  const short = Math.min(limit, 400);
  return characters.length > short ? `${characters.slice(0, short).join("")}…` : characters.join("");
}

export function finishedRoundsOf(rounds = [], dayOf) {
  return rounds.filter((round) => round.result).map((round) => ({ day: dayOf(round.result.createdAt ?? round.result.mtime), kind: round.result.verdictKind }));
}
