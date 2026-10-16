const DAY_MS = 86400000;

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

export function longTermIntentDue(intent, now = new Date()) {
  if (!intent?.date || dateIn(intent.date) !== intent.date) return true;
  const current = new Date(now);
  const today = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate());
  const age = (today - Date.parse(`${intent.date}T00:00:00Z`)) / DAY_MS;
  return age > 7 || age < 0;
}
