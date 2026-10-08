import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Daily paper tracking for registered projects. Fetching and ranking use no
// model: arXiv supplies everything new, Hugging Face daily papers signal what
// the community notices, and Semantic Scholar (optional key) adds venue and
// citations. Judging impact on a project is left to the mentor's next round.
const WATCH_DIR = ".dove/research/watch";
const PROJECT_CONFIG = `${WATCH_DIR}/config.json`;
const PROJECT_STATE = `${WATCH_DIR}/state.json`;
const MAX_SEEN = 5000;
const DEFAULT_CATEGORIES = ["cs.CV", "cs.GR", "cs.LG"];
const FIRST_RUN_DAYS = 30;
const ARXIV_INDEX_LAG_DAYS = 3;
const MIN_RELEVANCE = 2;

export const DEFAULT_GLOBAL_WATCH_SETTINGS = Object.freeze({ dailyHour: 8, lookbackDays: 3, proxy: "", maxPerDigest: 30 });

export function localDate(value = Date.now()) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function doveConfigDirectory(options = {}) {
  const env = options.env ?? process.env;
  const base = env.XDG_CONFIG_HOME || path.join(env.HOME || os.homedir(), ".config");
  return path.join(base, "dove");
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writePrivateFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, content, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function writeProjectFile(root, relative, content) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, content);
  fs.renameSync(temporary, file);
}

const cleanList = (value) => (Array.isArray(value) ? value : String(value ?? "").split(/\r?\n|[,，]/u))
  .map((item) => String(item).trim()).filter(Boolean).slice(0, 100);

export function normalizeWatchConfig(value = {}) {
  return {
    enabled: value.enabled !== false,
    keywords: cleanList(value.keywords),
    categories: cleanList(value.categories).length ? cleanList(value.categories) : [...DEFAULT_CATEGORIES],
    authors: cleanList(value.authors)
  };
}

export function readWatchConfig(root) {
  return normalizeWatchConfig(readJson(path.join(root, PROJECT_CONFIG), {}));
}

export function writeWatchConfig(root, value) {
  const config = normalizeWatchConfig(value);
  writeProjectFile(root, PROJECT_CONFIG, `${JSON.stringify(config, null, 2)}\n`);
  return config;
}

export function normalizeGlobalWatchSettings(value = {}) {
  const hour = Number(value.dailyHour);
  const days = Number(value.lookbackDays);
  const max = Number(value.maxPerDigest);
  return {
    dailyHour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_GLOBAL_WATCH_SETTINGS.dailyHour,
    lookbackDays: Number.isInteger(days) && days >= 1 && days <= 14 ? days : DEFAULT_GLOBAL_WATCH_SETTINGS.lookbackDays,
    proxy: typeof value.proxy === "string" ? value.proxy.trim() : "",
    maxPerDigest: Number.isInteger(max) && max >= 5 && max <= 200 ? max : DEFAULT_GLOBAL_WATCH_SETTINGS.maxPerDigest
  };
}

export function readGlobalWatchSettings(options = {}) {
  return normalizeGlobalWatchSettings(readJson(path.join(doveConfigDirectory(options), "watch.json"), {}));
}

export function writeGlobalWatchSettings(value, options = {}) {
  const settings = normalizeGlobalWatchSettings(value);
  writePrivateFile(path.join(doveConfigDirectory(options), "watch.json"), `${JSON.stringify(settings, null, 2)}\n`);
  return settings;
}

export function readSemanticScholarKey(options = {}) {
  try {
    return fs.readFileSync(path.join(doveConfigDirectory(options), "s2-api-key"), "utf8").trim() || null;
  } catch {
    return null;
  }
}

export function writeSemanticScholarKey(key, options = {}) {
  const file = path.join(doveConfigDirectory(options), "s2-api-key");
  const value = String(key ?? "").trim();
  if (!value) {
    fs.rmSync(file, { force: true });
    return false;
  }
  writePrivateFile(file, value);
  return true;
}

export function readGlobalWatchState(options = {}) {
  return readJson(path.join(doveConfigDirectory(options), "watch-state.json"), {});
}

function writeGlobalWatchState(state, options = {}) {
  writePrivateFile(path.join(doveConfigDirectory(options), "watch-state.json"), `${JSON.stringify(state, null, 2)}\n`);
}

// curl honours an explicit proxy and needs no extra dependency.
export function curlGet(url, { proxy = "", headers = {}, timeoutSeconds = 40, body = null } = {}) {
  const args = ["-sS", "-L", "--max-time", String(timeoutSeconds), "-w", "\n%{http_code}"];
  if (proxy) args.push("-x", proxy);
  for (const [name, value] of Object.entries(headers)) args.push("-H", `${name}: ${value}`);
  if (body !== null) args.push("-X", "POST", "--data-binary", "@-");
  args.push(url);
  return new Promise((resolve) => {
    const child = execFile("curl", args, { maxBuffer: 32 * 1024 * 1024 }, (error, stdout) => {
      if (error && !stdout) {
        resolve({ status: 0, body: "", error: error.message });
        return;
      }
      const split = stdout.lastIndexOf("\n");
      resolve({ status: Number(stdout.slice(split + 1)) || 0, body: stdout.slice(0, split) });
    });
    if (body !== null) child.stdin.end(body);
  });
}

const decodeXml = (text = "") => text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, "$1")
  .replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&quot;/gu, "\"").replace(/&#39;/gu, "'").replace(/&amp;/gu, "&")
  .replace(/\s+/gu, " ").trim();

export function arxivIdFromUrl(value = "") {
  const match = String(value).match(/(\d{4}\.\d{4,5})(v\d+)?/u);
  return match ? match[1] : null;
}

export function parseArxivFeed(xml = "") {
  const entries = [];
  for (const block of xml.split(/<entry>/u).slice(1)) {
    const field = (name) => decodeXml(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "u"))?.[1] ?? "");
    const id = arxivIdFromUrl(field("id"));
    if (!id) continue;
    entries.push({
      id,
      title: field("title"),
      abstract: field("summary"),
      published: field("published"),
      authors: [...block.matchAll(/<name>([\s\S]*?)<\/name>/gu)].map((match) => decodeXml(match[1])),
      categories: [...block.matchAll(/<category[^>]*term="([^"]+)"/gu)].map((match) => match[1]),
      url: `https://arxiv.org/abs/${id}`
    });
  }
  return entries;
}

function arxivQuery(config) {
  const categories = config.categories.map((category) => `cat:${category}`).join(" OR ");
  const terms = config.keywords.map((keyword) => {
    const phrase = keyword.replace(/"/gu, "");
    return /\s/u.test(phrase) ? `ti:"${phrase}" OR abs:"${phrase}"` : `ti:${phrase} OR abs:${phrase}`;
  }).join(" OR ");
  return terms ? `(${categories}) AND (${terms})` : `(${categories})`;
}

export async function fetchArxiv(config, { since, proxy, get = curlGet }) {
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(arxivQuery(config))}&sortBy=submittedDate&sortOrder=descending&max_results=200`;
  const response = await get(url, { proxy });
  if (response.status !== 200) return { items: [], error: `arXiv ${response.status || response.error}` };
  return { items: parseArxivFeed(response.body).filter((item) => !since || Date.parse(item.published) >= since) };
}

export async function fetchHuggingFaceDaily(days, { proxy, get = curlGet, now = Date.now() }) {
  const papers = new Map();
  const errors = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(now - offset * 86400000).toISOString().slice(0, 10); // Hugging Face lists by UTC day
    const response = await get(`https://huggingface.co/api/daily_papers?date=${date}&limit=100`, { proxy });
    if (response.status !== 200) {
      errors.push(`Hugging Face ${date} ${response.status || response.error}`);
      continue;
    }
    let list = [];
    try {
      list = JSON.parse(response.body);
    } catch {
      continue;
    }
    for (const entry of list) {
      const paper = entry.paper ?? entry;
      const id = arxivIdFromUrl(paper.id);
      if (!id) continue;
      papers.set(id, {
        id,
        title: decodeXml(paper.title ?? entry.title ?? ""),
        abstract: decodeXml(paper.summary ?? ""),
        published: paper.publishedAt ?? entry.publishedAt ?? date,
        authors: (paper.authors ?? []).map((author) => author.name).filter(Boolean),
        upvotes: Number(paper.upvotes ?? 0),
        url: `https://arxiv.org/abs/${id}`
      });
    }
  }
  return { papers, errors };
}

// Optional enrichment: without a key the shared pool may refuse; the run continues.
export async function fetchSemanticScholar(ids, { key, proxy, get = curlGet }) {
  if (!ids.length) return { papers: new Map() };
  const headers = { "content-type": "application/json", ...(key ? { "x-api-key": key } : {}) };
  const response = await get("https://api.semanticscholar.org/graph/v1/paper/batch?fields=venue,citationCount,externalIds", {
    proxy, headers, body: JSON.stringify({ ids: ids.slice(0, 100).map((id) => `ARXIV:${id}`) })
  });
  if (response.status !== 200) return { papers: new Map(), error: `Semantic Scholar ${response.status || response.error}${key ? "" : "（未设置 key）"}` };
  const papers = new Map();
  try {
    for (const paper of JSON.parse(response.body)) {
      const id = paper?.externalIds?.ArXiv;
      if (id) papers.set(id, { venue: paper.venue || null, citations: paper.citationCount ?? null });
    }
  } catch {
    return { papers, error: "Semantic Scholar 返回无法解析" };
  }
  return { papers };
}

const lower = (value) => String(value ?? "").toLowerCase();

export function scorePaper(paper, config, signals = {}) {
  const reasons = [];
  let score = 0;
  let relevance = 0;
  const title = lower(paper.title);
  const abstract = lower(paper.abstract);
  for (const keyword of config.keywords) {
    const needle = lower(keyword);
    if (title.includes(needle)) { relevance += 3; reasons.push(`标题含「${keyword}」`); }
    else if (abstract.includes(needle)) { relevance += 1; reasons.push(`摘要含「${keyword}」`); }
  }
  const authors = (paper.authors ?? []).map(lower);
  for (const watched of config.authors) {
    if (authors.some((author) => author.includes(lower(watched)))) { relevance += 3; reasons.push(`关注作者 ${watched}`); }
  }
  score += relevance;
  if (signals.hf) { score += 2 + Math.min(3, Math.log2(1 + (signals.hf.upvotes || 0)) / 2); reasons.push(`HF 每日热门（${signals.hf.upvotes || 0} 赞）`); }
  if (signals.s2?.venue) { score += 1; reasons.push(`已发表：${signals.s2.venue}`); }
  if (signals.s2?.citations) { score += Math.min(2, Math.log10(1 + signals.s2.citations)); }
  // Popularity and venue only order relevant papers; they never make one relevant.
  return { score: Math.round(score * 10) / 10, relevance, reasons };
}

function renderDigest(project, date, items, notes) {
  const lines = [`# 论文追踪 ${date}`, "", `项目：${project}。导师在下一轮开始时判断每篇对本项目的影响：撞题 / 新基线 / 可借用 / 无关。`, ""];
  if (notes.length) lines.push(`说明：${notes.join("；")}`, "");
  if (!items.length) lines.push("今天没有新的相关论文。");
  for (const item of items) {
    lines.push(`## ${item.title}`, `- 链接：${item.url}  ·  分数 ${item.score}  ·  ${item.published.slice(0, 10)}`, `- 作者：${item.authors.slice(0, 6).join(", ")}${item.authors.length > 6 ? " 等" : ""}`, `- 选中原因：${item.reasons.join("；") || "分类内新论文"}`, `- 摘要：${item.abstract.slice(0, 400)}${item.abstract.length > 400 ? "…" : ""}`, "");
  }
  return `${lines.join("\n")}\n`;
}

export async function runProjectWatch(root, { settings, key, hf, now = Date.now(), get = curlGet }) {
  const config = readWatchConfig(root);
  const date = localDate(now);
  if (!config.enabled) return { root, status: "disabled" };
  if (!config.keywords.length && !config.authors.length) return { root, status: "unconfigured" };
  const notes = [];
  const statePath = path.join(root, PROJECT_STATE);
  const state = readJson(statePath, {});
  const lastRun = Date.parse(state.lastRun ?? "");
  // First run backfills a month; later runs reach back past the last run to cover arXiv's search lag.
  const since = Number.isFinite(lastRun)
    ? Math.min(now - settings.lookbackDays * 86400000, lastRun - ARXIV_INDEX_LAG_DAYS * 86400000)
    : now - FIRST_RUN_DAYS * 86400000;
  const arxiv = await fetchArxiv(config, { since, proxy: settings.proxy, get });
  if (arxiv.error) notes.push(arxiv.error);
  const candidates = new Map(arxiv.items.map((item) => [item.id, item]));
  for (const [id, paper] of hf.papers) if (!candidates.has(id)) candidates.set(id, { ...paper, categories: [] });
  const seen = new Set(state.seen ?? []);
  let ranked = [...candidates.values()].filter((item) => !seen.has(item.id))
    .map((item) => ({ ...item, ...scorePaper(item, config, { hf: hf.papers.get(item.id) }) }))
    .filter((item) => item.relevance >= MIN_RELEVANCE)
    .sort((left, right) => right.score - left.score)
    .slice(0, settings.maxPerDigest);
  const s2 = await fetchSemanticScholar(ranked.map((item) => item.id), { key, proxy: settings.proxy, get });
  if (s2.error) notes.push(s2.error);
  ranked = ranked.map((item) => ({ ...item, ...s2.papers.get(item.id), ...scorePaper(item, config, { hf: hf.papers.get(item.id), s2: s2.papers.get(item.id) }) }))
    .sort((left, right) => right.score - left.score);
  // A second run on the same day adds to that day's digest instead of replacing it.
  const earlier = readJson(path.join(root, WATCH_DIR, `${date}.json`), null);
  const merged = [...ranked, ...(earlier?.items ?? []).filter((item) => !ranked.some((fresh) => fresh.id === item.id))]
    .sort((left, right) => right.score - left.score);
  const digest = { date, generatedAt: new Date(now).toISOString(), notes, items: merged };
  writeProjectFile(root, `${WATCH_DIR}/${date}.json`, `${JSON.stringify(digest, null, 2)}\n`);
  writeProjectFile(root, `${WATCH_DIR}/${date}.md`, renderDigest(path.basename(root), date, merged, notes));
  const nextSeen = [...ranked.map((item) => item.id), ...seen].slice(0, MAX_SEEN);
  writeProjectFile(root, PROJECT_STATE, `${JSON.stringify({ lastRun: digest.generatedAt, seen: nextSeen }, null, 2)}\n`);
  return { root, status: "done", found: ranked.length, notes };
}

export async function runWatch(roots, options = {}) {
  const now = options.now ?? Date.now();
  const settings = readGlobalWatchSettings(options);
  const key = readSemanticScholarKey(options);
  const get = options.get ?? curlGet;
  const hf = await fetchHuggingFaceDaily(settings.lookbackDays, { proxy: settings.proxy, get, now });
  const results = [];
  for (const root of roots) {
    try {
      results.push(await runProjectWatch(root, { settings, key, hf, now, get }));
    } catch (error) {
      results.push({ root, status: "failed", error: error instanceof Error ? error.message : String(error) });
    }
  }
  const state = { lastRun: new Date(now).toISOString(), lastRunDate: localDate(now), hfErrors: hf.errors, results };
  if (options.recordGlobalState !== false) writeGlobalWatchState(state, options);
  return state;
}

export function readWatchDigests(root, limit = 3) {
  const directory = path.join(root, WATCH_DIR);
  let files = [];
  try {
    files = fs.readdirSync(directory).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/u.test(name)).sort().reverse().slice(0, limit);
  } catch {
    return [];
  }
  return files.map((name) => readJson(path.join(directory, name), null)).filter(Boolean);
}
