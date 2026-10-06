import fs from "node:fs";
import path from "node:path";

import { parseDoveCurrentRound } from "./identity-card.mjs";
import { readRegisteredProjects } from "./project-registry.mjs";

// Read-only view of each registered project's research core: identity card,
// EVAL.md and rounds/. Nothing here writes to a project.
const RESEARCH_ROOT = ".dove/research";
const MAX_TEXT_BYTES = 64 * 1024;
const MAX_ROUNDS = 40;
const ROUND_FILE = /^(\d+)[-_](brief|result)\.md$/iu;
const AUTHOR_LABELS = [
  [/导师|mentor/iu, "mentor"],
  [/用户|user/iu, "user"],
  [/外部|external/iu, "external"]
];

function readText(file, fsOps) {
  try {
    const stat = fsOps.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    const bytes = fsOps.readFileSync(file);
    const truncated = bytes.length > MAX_TEXT_BYTES;
    const text = new TextDecoder("utf-8").decode(bytes.subarray(0, MAX_TEXT_BYTES));
    return { text, truncated, mtime: stat.mtimeMs ?? null };
  } catch {
    return null;
  }
}

function listDirectory(directory, fsOps) {
  try {
    return fsOps.readdirSync(directory);
  } catch {
    return [];
  }
}

export function parseCardFields(text = "") {
  const fields = {};
  for (const line of text.split(/\r?\n/u)) {
    const match = line.match(/^\s*(?:[-*]\s*)?\**([^:：*\n]{1,40}?)\**\s*[:：]\s*(.+)$/u);
    if (!match) continue;
    const key = match[1].trim();
    if (!(key in fields)) fields[key] = match[2].trim();
  }
  return fields;
}

export function parseAuthor(text = "") {
  const line = text.split(/\r?\n/u).slice(0, 12).find((item) => /^\s*(?:[-*]\s*)?\**\s*(Author|作者)\s*\**\s*[:：]/iu.test(item));
  if (!line) return null;
  const value = line.replace(/^[^:：]*[:：]\s*/u, "");
  for (const [pattern, label] of AUTHOR_LABELS) if (pattern.test(value)) return label;
  return "other";
}

function firstHeading(text = "") {
  const heading = text.split(/\r?\n/u).find((line) => /^#{1,3}\s+\S/u.test(line));
  return heading ? heading.replace(/^#{1,3}\s+/u, "").trim() : null;
}

export function parseMarkdownTables(text = "") {
  const tables = [];
  let current = null;
  const cells = (line) => line.trim().replace(/^\|/u, "").replace(/\|$/u, "").split("|").map((cell) => cell.trim());
  for (const line of text.split(/\r?\n/u)) {
    if (!/^\s*\|.*\|\s*$/u.test(line)) {
      if (current) tables.push(current);
      current = null;
      continue;
    }
    const row = cells(line);
    if (row.every((cell) => /^:?-+:?$/u.test(cell))) continue;
    if (!current) current = { header: row, rows: [] };
    else current.rows.push(row);
  }
  if (current) tables.push(current);
  return tables;
}

function collectRounds(directory, fsOps) {
  const byNumber = new Map();
  for (const name of listDirectory(directory, fsOps)) {
    const match = name.match(ROUND_FILE);
    if (!match) continue;
    const number = Number(match[1]);
    const kind = match[2].toLowerCase();
    const file = readText(path.join(directory, name), fsOps);
    if (!file) continue;
    const entry = byNumber.get(number) ?? { number, label: match[1] };
    entry[kind] = { file: name, truncated: file.truncated, mtime: file.mtime };
    if (kind === "brief") {
      entry.author = parseAuthor(file.text);
      entry.title = firstHeading(file.text);
    }
    byNumber.set(number, entry);
  }
  return [...byNumber.values()].sort((left, right) => right.number - left.number).slice(0, MAX_ROUNDS);
}

function evaluationSummary(evaluation) {
  const tables = parseMarkdownTables(evaluation.text);
  // Tables carry the content; the raw file is fetched on demand to keep the first load small.
  return { mtime: evaluation.mtime, truncated: evaluation.truncated, tables, text: tables.length ? null : evaluation.text };
}

export function summarizeProject(root, options = {}) {
  const fsOps = options.fsOps ?? fs;
  const research = path.join(root, RESEARCH_ROOT);
  let exists = false;
  try {
    exists = fsOps.lstatSync(root).isDirectory();
  } catch {
    exists = false;
  }
  const identity = readText(path.join(research, "IDENTITY.md"), fsOps);
  const evaluation = readText(path.join(research, "EVAL.md"), fsOps);
  const doctor = readText(path.join(root, ".dove/install/DOCTOR.md"), fsOps);
  const rounds = exists ? collectRounds(path.join(research, "rounds"), fsOps) : [];
  const fields = identity ? parseCardFields(identity.text) : {};
  const current = identity ? parseDoveCurrentRound(identity.text) : null;
  const statusMatch = identity?.text.match(/^Round status:[ \t]*(.+)$/mu)?.[1]?.trim() ?? null;
  const times = [identity?.mtime, evaluation?.mtime, ...rounds.flatMap((round) => [round.brief?.mtime, round.result?.mtime])].filter((value) => typeof value === "number");
  return {
    root,
    name: path.basename(root),
    exists,
    mainline: fields.Mainline ?? fields["主线"] ?? null,
    currentRound: current?.brief ?? null,
    roundStatus: statusMatch,
    lastActivity: times.length ? Math.max(...times) : null,
    identity: identity ? { text: identity.text, truncated: identity.truncated, mtime: identity.mtime } : null,
    evaluation: evaluation ? evaluationSummary(evaluation) : null,
    rounds,
    doctor: doctor ? { mtime: doctor.mtime } : null
  };
}

const NAMED_DOCUMENTS = { "EVAL.md": `${RESEARCH_ROOT}/EVAL.md`, "DOCTOR.md": ".dove/install/DOCTOR.md" };

// Only round files and the two named documents are served; anything else is refused.
export function readProjectDocument(root, name, options = {}) {
  if (typeof name !== "string") return null;
  const relative = ROUND_FILE.test(name) ? `${RESEARCH_ROOT}/rounds/${name}` : NAMED_DOCUMENTS[name];
  return relative ? readText(path.join(root, relative), options.fsOps ?? fs) : null;
}

export function collectDashboard(options = {}) {
  const roots = options.projects ?? readRegisteredProjects(options);
  const projects = roots.map((root) => summarizeProject(root, options)).filter((project) => project.exists && (project.identity || project.evaluation || project.rounds.length));
  projects.sort((left, right) => (right.lastActivity ?? 0) - (left.lastActivity ?? 0));
  return { generatedAt: new Date(options.now ?? Date.now()).toISOString(), version: options.packageVersion ?? null, projects };
}
