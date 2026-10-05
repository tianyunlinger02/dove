import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

import { parseDoveCurrentRound, readDoveIdentityCard } from "./identity-card.mjs";
const MAX_MAINLINE_CODE_POINTS = 80;

const STATUS_SEPARATOR = " · ";
const CONTROL_CHARACTERS = /[\x00-\x1f\x7f-\x9f]/gu;
const CAPACITY_IN_MODEL_NAME = /\b\d+(?:\.\d+)?\s*[KMG](?:\s+context)?\b/iu;

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function oneLine(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(CONTROL_CHARACTERS, "?");
  return normalized || null;
}

function shortMainline(value) {
  const normalized = oneLine(value);
  if (!normalized) return null;
  const codePoints = [...normalized];
  return codePoints.length <= MAX_MAINLINE_CODE_POINTS
    ? normalized
    : `${codePoints.slice(0, MAX_MAINLINE_CODE_POINTS - 1).join("")}…`;
}

function nonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function parseDoveStatusLinePayload(input) {
  try {
    const value = JSON.parse(input);
    return plainObject(value) ? value : {};
  } catch {
    return {};
  }
}

export function formatContextCapacity(value) {
  const size = nonNegativeNumber(value);
  if (size === null || size === 0) return null;
  if (size >= 1_000_000) return `${Number((size / 1_000_000).toFixed(1))}M`;
  if (size >= 1_000) return `${Math.round(size / 1_000)}K`;
  return String(Math.round(size));
}

export function formatSessionDuration(value) {
  const milliseconds = nonNegativeNumber(value);
  if (milliseconds === null) return null;
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h${minutes % 60}m` : `${minutes}m`;
}

export function inspectGitBranch(projectRoot, options = {}) {
  const run = options.spawnSync ?? spawnSync;
  try {
    const result = run("git", ["branch", "--show-current"], {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: options.timeoutMs ?? 500,
      maxBuffer: 64 * 1024,
      windowsHide: true,
      env: {
        ...process.env,
        GIT_CEILING_DIRECTORIES: path.dirname(path.resolve(projectRoot))
      }
    });
    if (result?.status !== 0 || result.signal || result.error) return null;
    return oneLine(result.stdout);
  } catch {
    return null;
  }
}

const HTML_BLOCK_TAG = /^(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|ol|p|pre|script|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)$/iu;

function htmlBlockTag(line) {
  const match = line.match(/^ {0,3}<([A-Za-z][A-Za-z0-9-]*)\b[^>]*>/u);
  return match && HTML_BLOCK_TAG.test(match[1]) ? match[1].toLowerCase() : null;
}

function isBlockContinuation(line) {
  return /^ {0,3}(?:>\s?|(?:[-+*]|\d+[.)])\s+)/u.test(line);
}

function isMainlineBoundary(line) {
  return !(line ?? "").trim()
    || /^ {0,3}#{1,6}(?:[ \t]|$)/u.test(line ?? "")
    || /^ {0,3}(?:`{3,}|~{3,})/u.test(line ?? "")
    || /^ {0,3}(?:---|\.\.\.|-->)\s*$/u.test(line ?? "")
    || /^ {0,3}<!--/u.test(line ?? "")
    || /^(?:Current round|Round status):/u.test(line ?? "");
}

export function parseResearchMainline(markdown, options = {}) {
  let fence = null;
  let frontmatter = false;
  let comment = false;
  let htmlBlock = null;
  const matches = [];
  const lines = markdown.split(/\r?\n/u);
  for (const [index, line] of lines.entries()) {
    if (index === 0 && line === "---") {
      frontmatter = true;
      continue;
    }
    if (frontmatter) {
      if (line === "---" || line === "...") frontmatter = false;
      continue;
    }
    if (fence) {
      const closing = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/u);
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) fence = null;
      continue;
    }
    if (htmlBlock) {
      if (new RegExp(`^ {0,3}</${htmlBlock}>[ \\t]*$`, "iu").test(line)) htmlBlock = null;
      continue;
    }
    const opening = !comment && line.match(/^ {0,3}(`{3,}|~{3,})/u);
    if (opening) {
      fence = opening[1];
      continue;
    }
    const blockTag = !comment && htmlBlockTag(line);
    if (blockTag) {
      if (!new RegExp(`</${blockTag}>`, "iu").test(line)) htmlBlock = blockTag;
      continue;
    }
    const startsInComment = comment;
    for (const marker of line.matchAll(/<!--|-->/gu)) {
      if (marker[0] === "<!--") comment = true;
      else comment = false;
    }
    if (startsInComment || comment) continue;
    if (line.startsWith("Mainline:")) {
      const previousLine = lines[index - 1] ?? "";
      if (/^Mainline:/u.test(previousLine)) return null;
      const accepted = (index === 0 || isMainlineBoundary(previousLine))
        && !isBlockContinuation(previousLine)
        && !/^ {0,3}(?:=+|-+)[ \t]*$/u.test(lines[index + 1] ?? "");
      if (accepted && options.uncertainFinalLine && index === lines.length - 2) return null;
      if (accepted) matches.push(line.slice("Mainline:".length));
      if (matches.length > 1) return null;
    }
  }
  return matches.length === 1 && matches[0].startsWith(" ") ? oneLine(matches[0]) : null;
}

export function inspectResearchMainline(projectRoot, options = {}) {
  const card = readDoveIdentityCard(projectRoot, options);
  return card ? parseResearchMainline(card) : null;
}

export function renderDoveStatusLine(input, options = {}) {
  const payload = typeof input === "string" ? parseDoveStatusLinePayload(input) : plainObject(input) ? input : {};
  const model = oneLine(payload.model?.display_name);
  const capacity = formatContextCapacity(payload.context_window?.context_window_size);
  const remainingValue = nonNegativeNumber(payload.context_window?.remaining_percentage);
  const remaining = remainingValue === null ? null : Math.min(100, Math.round(remainingValue));
  const duration = formatSessionDuration(payload.cost?.total_duration_ms);
  const project = options.projectRoot ? oneLine(path.resolve(options.projectRoot)) : null;
  const card = readDoveIdentityCard(options.projectRoot, options) ?? "";
  const mainline = shortMainline(Object.hasOwn(options, "mainline")
    ? options.mainline
    : parseResearchMainline(card));
  const noColorValue = (options.env ?? process.env).NO_COLOR;
  const noColor = typeof noColorValue === "string" && noColorValue.length > 0;
  const branch = Object.hasOwn(options, "branch")
    ? oneLine(options.branch)
    : inspectGitBranch(options.projectRoot, options);

  const parts = [];
  if (model) parts.push(capacity && !CAPACITY_IN_MODEL_NAME.test(model) ? `${model} (${capacity})` : model);
  else if (capacity) parts.push(`ctx ${capacity}`);
  if (remaining !== null) parts.push(`ctx ${remaining}%`);
  if (mainline) parts.push(noColor ? mainline : `\x1b[36m${mainline}\x1b[0m`);
  const round = parseDoveCurrentRound(card);
  const roundNumber = round?.brief.match(/(?:^|\/)0*(\d+)-brief\.md(?:\)|$)/u)?.[1];
  if (roundNumber) parts.push(`第${Number(roundNumber)}轮`);
  if (branch) parts.push(branch);
  if (duration) parts.push(duration);
  const session = parts.length > 0 ? parts.join(STATUS_SEPARATOR) : "Dove";
  return project ? `${session}\n${project}` : session;
}
