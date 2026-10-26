import fs from "node:fs";
import path from "node:path";

import { CROSS_PROJECT_EXPERIENCE_PATH, parseCrossProjectExperience, parseTransferable, readOwnEntries, relevantTransferable } from "./cross-project.mjs";
import { coreNeedsOf, latestLongTermIntent, LONG_TERM_INTENT_MESSAGES, ownMessagesSince } from "./mentor-intent.mjs";
import { practiceContext, readPractice } from "./practice.mjs";
import { inspectRoundState } from "./round-state.mjs";

// What the project has learned, put in front of the host itself rather than
// left for the mentor: the user's core needs and constraints as the mentor
// last distilled them from the user's own words, the practice corrections,
// and the few lessons that bear on this round. Injected when a context starts
// or is compacted; nothing here depends on the host deciding to look.

const MENTOR_NOTES = ".dove/research/MENTOR_NOTES.md";
const MAX_BYTES = 2 * 1024 * 1024;

function readText(file, fsOps) {
  try {
    const stat = fsOps.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) return null;
    return fsOps.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function clip(text, limit) {
  const characters = Array.from(String(text ?? ""));
  return characters.length > limit ? `${characters.slice(0, limit).join("")}…` : characters.join("");
}

function lessonsFor(project, notes, fsOps, options) {
  const name = path.basename(project);
  const own = notes ? parseTransferable(notes).map((item) => ({ ...item, project: name })) : [];
  const others = parseCrossProjectExperience(readText(path.join(project, CROSS_PROJECT_EXPERIENCE_PATH), fsOps) ?? "").filter((item) => item.project !== name);
  if (!own.length && !others.length) return "";
  let brief = null;
  try {
    brief = inspectRoundState(project, { ...options, fsOps }).currentRound?.brief ?? null;
  } catch {
    brief = null;
  }
  const picked = relevantTransferable([...own, ...others], { project: null, dimension: brief?.targetDimension ?? null, text: [brief?.summary, brief?.success, brief?.target].filter(Boolean).join("\n"), limit: 3 });
  if (!picked.length) return "";
  return [
    `和本轮相关的可迁移认识（导师写的，${brief?.targetDimension ? `按本轮对准的「${brief.targetDimension}」和本轮说明挑出` : "按本轮说明和时间挑出"}；全部见 ${CROSS_PROJECT_EXPERIENCE_PATH}）：`,
    ...picked.map((item) => `- ${item.date ?? "未注明日期"} · ${item.project}：${clip(item.text, 160)}`)
  ].join("\n");
}

/** The block a starting or compacted context reads; empty when the project has nothing yet. */
export function experienceContext(project, options = {}) {
  if (typeof project !== "string" || !project) return "";
  const fsOps = options.fsOps ?? fs;
  const parts = [];
  const notes = readText(path.join(project, MENTOR_NOTES), fsOps);
  const intent = notes ? latestLongTermIntent(notes) : null;
  const needs = coreNeedsOf(intent);
  if (needs) parts.push(`用户的核心需求与约束（导师 ${intent.date ?? "未注明日期"} 从用户原话提炼；和用户最新原话冲突时以原话为准）：\n${needs}`);
  let fresh = 0;
  try {
    fresh = ownMessagesSince(readOwnEntries(project, { fsOps }), intent?.date ?? null);
  } catch {
    fresh = 0;
  }
  if (fresh >= LONG_TERM_INTENT_MESSAGES) {
    parts.push(`用户的核心需求与约束该更新了：${intent?.date ? `上次提炼在 ${intent.date}，` : "导师还没有提炼过，"}之后用户又说了 ${fresh} 条本人原话。在下一个告一段落处调一次 dove-mentor（dove mentor brief 会标出长期意图对照到期），把导师返回的长期意图原样存进导师笔记。`);
  }
  const practice = practiceContext(readPractice(project, { fsOps }));
  if (practice) parts.push(practice);
  const lessons = lessonsFor(project, notes, fsOps, options);
  if (lessons) parts.push(lessons);
  return parts.join("\n\n");
}
