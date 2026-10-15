import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

// Daily paper tracking for registered projects. Fetching and ranking use no
// model and no required key: arXiv supplies everything new (by keyword and by
// watched author), OpenAlex finds new papers citing known neighbours and work
// from watched institutions, Hugging Face daily papers signal what the
// community notices, and Semantic Scholar (optional key) adds venue and
// citations. The next mentor invocation judges impact, independently of rounds.
const WATCH_DIR = ".dove/research/watch";
const PROJECT_CONFIG = `${WATCH_DIR}/config.json`;
const PROJECT_STATE = `${WATCH_DIR}/state.json`;
const MAX_SEEN = 5000;
const DEFAULT_CATEGORIES = ["cs.CV", "cs.GR", "cs.LG"];
const FIRST_RUN_DAYS = 30;
const ARXIV_INDEX_LAG_DAYS = 3;
export const MIN_RELEVANCE = 2;
const ARXIV_INTERVAL_MS = 3000;
const ARXIV_MAX_BACKOFF_MS = 60000;
const OPENALEX = "https://api.openalex.org";
const OPENALEX_FIELDS = "id,title,publication_date,authorships,abstract_inverted_index,locations,primary_location,referenced_works";
const HOT_FILE = "watch-hot.json";

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
    authors: cleanList(value.authors),
    venues: cleanList(value.venues),
    institutions: cleanList(value.institutions),
    seedPapers: cleanList(value.seedPapers).map((item) => arxivIdFromUrl(item) ?? item),
    source: ["draft", "mentor"].includes(value.source) ? value.source : "user"
  };
}

export function watchConfigExists(root) {
  return fs.existsSync(path.join(root, PROJECT_CONFIG));
}

export function readWatchConfig(root) {
  return normalizeWatchConfig(readJson(path.join(root, PROJECT_CONFIG), {}));
}

export function watchConfigGuidance(config) {
  return config.source === "draft"
    ? "追踪配置仍是自动初稿。请在设置页修正为项目具体问题、方法和近邻论文；也可在下一次导师调用时返回修正建议，由主会话写回 config.json 并标记 source: mentor，不必等下一轮。"
    : null;
}

export function readWatchState(root) {
  return readJson(path.join(root, PROJECT_STATE), {});
}

export function writeWatchConfig(root, value) {
  const config = normalizeWatchConfig(value);
  writeProjectFile(root, PROJECT_CONFIG, `${JSON.stringify(config, null, 2)}\n`);
  return config;
}

const STRUCTURE_WORDS = new Set("dove research rounds round brief briefs result results runs run artifacts artifact outputs output scripts script src home nvme tmp json md py mjs txt csv yaml yml log logs train val test dev split checkpoint checkpoints config configs identity eval mainline readme main repo commit worktree claude gpu cpu cuda batch epoch epochs step steps true false null none".split(" "));

// Drop code, links, paths and identifiers so only prose terms remain.
function proseOnly(text) {
  return String(text)
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/`[^`\n]*`/gu, " ")
    .replace(/https?:\/\/\S+/gu, " ")
    .replace(/\S*[\/\\]\S*/gu, " ")
    .replace(/\S*[_=<>{}$#@]\S*/gu, " ")
    .replace(/\b\S*\d\S*\b/gu, " ");
}

function phraseCounts(text, { minWordLength = 3 } = {}) {
  const phrases = new Map();
  for (const sentence of proseOnly(text).split(/[\n.;:!?()\[\]{}"|，。；：！？、（）]+/u)) {
    const words = (sentence.toLowerCase().match(/[a-z][a-z-]+/gu) ?? []).filter((word) => word.length >= minWordLength && !word.includes("--"));
    for (let size = 2; size <= 3; size += 1) {
      for (let index = 0; index + size <= words.length; index += 1) {
        const gram = words.slice(index, index + size);
        if (STOPWORDS.has(gram[0]) || STOPWORDS.has(gram[gram.length - 1]) || gram.some((word) => STRUCTURE_WORDS.has(word) || word.length > 24)) continue;
        const phrase = gram.join(" ");
        phrases.set(phrase, (phrases.get(phrase) ?? 0) + 1);
      }
    }
  }
  return phrases;
}

function topPhrases(phrases, { minCount, limit, exclude = [] }) {
  const ranked = [...phrases.entries()].filter(([, count]) => count >= minCount)
    .sort((left, right) => right[1] * right[0].split(" ").length - left[1] * left[0].split(" ").length);
  const kept = [...exclude];
  const result = [];
  for (const [phrase] of ranked) {
    if (result.length >= limit) break;
    if (kept.some((item) => item.includes(phrase) || phrase.includes(item))) continue;
    kept.push(phrase);
    result.push(phrase);
  }
  return result;
}

const STOPWORDS = new Set("the a an and or of for to in on with by from as is are was were be been this that these those it its into via using use used we our not no than then also can may per each all any both more most other such only same so very will would should could have has had which while when where what who how than at about after before over under between within without based new one two three first second via vs etc et al data model method methods result results paper work task tasks approach figure table section appendix".split(" "));

function collectProjectText(root) {
  const research = path.join(root, ".dove/research");
  const files = [];
  const add = (file) => { try { if (fs.statSync(file).isFile()) files.push(file); } catch { /* absent */ } };
  for (const name of ["IDENTITY.md", "EVAL.md", "RESEARCH.md"]) add(path.join(research, name));
  for (const directory of ["rounds", "sources", "missions", "experiments", "claims"]) {
    try {
      for (const name of fs.readdirSync(path.join(research, directory)).filter((item) => item.endsWith(".md")).sort().reverse().slice(0, 40)) add(path.join(research, directory, name));
    } catch { /* absent */ }
  }
  for (const directory of [root, path.join(root, "docs")]) {
    try {
      for (const name of fs.readdirSync(directory).filter((item) => /\.md$/iu.test(item)).sort().slice(0, 20)) add(path.join(directory, name));
    } catch { /* absent */ }
  }
  let total = 0;
  const texts = [];
  for (const file of files) {
    if (total > 3 * 1024 * 1024) break;
    try {
      const text = fs.readFileSync(file, "utf8").slice(0, 256 * 1024);
      total += text.length;
      texts.push(text);
    } catch { /* unreadable */ }
  }
  return texts.join("\n");
}

// A first draft from the project's own records: cited arXiv papers become
// tracked neighbours, and frequent English terms from prose (not code or
// paths) become keywords. With a fetcher, the neighbours' own titles and
// abstracts supply better keywords than mostly-Chinese notes can.
export function draftWatchConfig(root) {
  const text = collectProjectText(root);
  const seedCounts = new Map();
  for (const match of text.matchAll(/(?:arxiv\.org\/(?:abs|pdf)\/|arXiv[:\s]\s*)(\d{4}\.\d{4,5})/giu)) seedCounts.set(match[1], (seedCounts.get(match[1]) ?? 0) + 1);
  const keywords = topPhrases(phraseCounts(text), { minCount: 3, limit: 10 });
  const seedPapers = [...seedCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 15).map(([id]) => id);
  return normalizeWatchConfig({ keywords, seedPapers, source: "draft" });
}

// Method names written like GarmentCode or ReWeaver usually name published work.
export function namedMethods(text, limit = 8) {
  const counts = new Map();
  for (const match of proseOnly(text).matchAll(/\b([A-Z][a-z]+(?:[A-Z][a-z0-9]*)+|[A-Z]{2,}[a-z]+[A-Za-z]*)\b/gu)) {
    if (match[1].length < 5) continue;
    counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count >= 3).sort((left, right) => right[1] - left[1]).slice(0, limit).map(([name]) => name);
}

async function seedsFromNames(names, { proxy, get }) {
  if (!names.length) return [];
  const query = `(cat:cs.CV OR cat:cs.GR OR cat:cs.LG) AND (${names.map((name) => `ti:${name}`).join(" OR ")})`;
  const response = await get(`https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&max_results=60`, { proxy });
  if (response.status !== 200) return [];
  const papers = parseArxivFeed(response.body);
  const seeds = [];
  for (const name of names) {
    const hit = papers.find((paper) => new RegExp(`\\b${name}\\b`, "iu").test(paper.title));
    if (hit && !seeds.includes(hit.id)) seeds.push(hit.id);
  }
  return seeds;
}

export async function draftWatchConfigWithSources(root, { proxy = "", get = watchGet } = {}) {
  const draft = draftWatchConfig(root);
  if (draft.seedPapers.length < 3) {
    const found = await seedsFromNames(namedMethods(collectProjectText(root)), { proxy, get });
    draft.seedPapers = [...draft.seedPapers, ...found.filter((id) => !draft.seedPapers.includes(id))].slice(0, 15);
  }
  if (!draft.seedPapers.length) return draft;
  const response = await get(`https://export.arxiv.org/api/query?id_list=${draft.seedPapers.join(",")}&max_results=${draft.seedPapers.length}`, { proxy });
  if (response.status !== 200) return draft;
  const papers = parseArxivFeed(response.body);
  const fromSources = topPhrases(phraseCounts(papers.map((paper) => `${paper.title}. ${paper.title}. ${paper.abstract}`).join("\n"), { minWordLength: 3 }), { minCount: 2, limit: 8 });
  const keywords = [...fromSources, ...draft.keywords.filter((keyword) => !fromSources.some((item) => item.includes(keyword) || keyword.includes(item)))].slice(0, 12);
  return normalizeWatchConfig({ ...draft, keywords });
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

// curl honours an explicit proxy and keeps response headers for Retry-After.
export function curlGet(url, { proxy = "", headers = {}, timeoutSeconds = 40, body = null } = {}) {
  const args = ["-sS", "-L", "--include", "--suppress-connect-headers", "--max-time", String(timeoutSeconds), "-w", "\n%{http_code}"];
  if (proxy) args.push("-x", proxy);
  for (const [name, value] of Object.entries(headers)) args.push("-H", `${name}: ${value}`);
  if (body !== null) args.push("--data-binary", "@-");
  args.push(url);
  return new Promise((resolve) => {
    const child = execFile("curl", args, { maxBuffer: 32 * 1024 * 1024 }, (error, stdout) => {
      const split = stdout.lastIndexOf("\n");
      let content = stdout.slice(0, split);
      let responseHeaders = {};
      // Redirects and interim 100 responses precede the final headers.
      while (/^HTTP\/\S+ \d{3}\b/u.test(content)) {
        const boundary = /\r?\n\r?\n/u.exec(content);
        if (!boundary) break;
        responseHeaders = {};
        for (const line of content.slice(0, boundary.index).split(/\r?\n/u).slice(1)) {
          const colon = line.indexOf(":");
          if (colon > 0) responseHeaders[line.slice(0, colon).toLowerCase()] = line.slice(colon + 1).trim();
        }
        content = content.slice(boundary.index + boundary[0].length);
      }
      resolve({ status: Number(stdout.slice(split + 1)) || 0, body: content, headers: responseHeaders, ...(error ? { error: error.message } : {}) });
    });
    if (body !== null) child.stdin.end(body);
  });
}

function responseError(source, response) {
  const detail = String(response.body ?? "").replace(/\s+/gu, " ").trim().slice(0, 600);
  const retryAfter = response.headers?.["retry-after"];
  return `${source} ${response.status || "请求失败"}${response.error ? `：${response.error}` : ""}${detail ? `：${detail}` : ""}${retryAfter ? `（Retry-After: ${retryAfter}）` : ""}`;
}

// arXiv asks for one connection and at least three seconds between requests.
// Share this fetcher across projects; stop after two retries or a wait over a minute.
export function createWatchFetcher({ get = curlGet, wait = sleep, clock = Date.now } = {}) {
  let queue = Promise.resolve();
  let nextRequest = 0;
  let limited = null;
  return (url, options = {}) => {
    if (!url.startsWith("https://export.arxiv.org/api/")) return get(url, options);
    const request = queue.then(async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const delay = Math.max(0, nextRequest - clock());
        if (delay > ARXIV_MAX_BACKOFF_MS && limited) return limited;
        if (delay) await wait(delay);
        const response = await get(url, options);
        nextRequest = clock() + ARXIV_INTERVAL_MS;
        if (response.status !== 429) { limited = null; return response; }
        limited = response;
        const header = response.headers?.["retry-after"];
        const seconds = header ? Number(header) : NaN;
        const retryAfter = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header ?? "") - clock();
        nextRequest = clock() + Math.max(ARXIV_INTERVAL_MS * 2 ** attempt, Number.isFinite(retryAfter) ? retryAfter : 0);
      }
      return limited;
    });
    queue = request.catch(() => {});
    return request;
  };
}

const watchGet = createWatchFetcher();

const decodeXml = (text = "") => text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, "$1")
  .replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&quot;/gu, "\"").replace(/&#39;/gu, "'").replace(/&amp;/gu, "&")
  .replace(/\s+/gu, " ").trim();

export function arxivIdFromUrl(value = "") {
  const candidate = String(value).trim()
    .replace(/^https?:\/\/(?:export\.)?arxiv\.org\/(?:abs|pdf)\//iu, "")
    .replace(/^(?:https?:\/\/doi\.org\/)?10\.48550\/arxiv\./iu, "")
    .replace(/^arxiv:\s*/iu, "");
  const match = candidate.match(/^(\d{2}(?:0[1-9]|1[0-2])\.\d{4,5}|[a-z][a-z.-]*\/\d{2}(?:0[1-9]|1[0-2])\d{3})(?:v\d+)?(?:\.pdf)?(?:[?#].*)?$/iu);
  return match ? match[1] : null;
}

export function codeLink(text = "") {
  const match = String(text).match(/https?:\/\/(?:www\.)?(?:github\.com|[a-z0-9-]+\.github\.io|huggingface\.co|gitlab\.com)[^\s)"'<>,;]*/iu);
  if (match) return match[0].replace(/[.]+$/u, "");
  return /project page|code is available|code will be (?:made )?available/iu.test(text) ? "（摘要提到主页/代码）" : null;
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
      code: codeLink(`${field("arxiv:comment")} ${field("summary")}`),
      url: `https://arxiv.org/abs/${id}`
    });
  }
  return entries;
}

function arxivQuery(config) {
  const categories = config.categories.map((category) => `cat:${category}`).join(" OR ");
  const terms = [...new Set(config.keywords)].map((keyword) => {
    const phrase = keyword.replace(/"/gu, "");
    return /\s/u.test(phrase) ? `ti:"${phrase}" OR abs:"${phrase}"` : `ti:${phrase} OR abs:${phrase}`;
  }).join(" OR ");
  const authors = [...new Set(config.authors)].map((name) => `au:"${name.replace(/"/gu, "")}"`).join(" OR ");
  return [terms && `((${categories}) AND (${terms}))`, authors && `(${authors})`].filter(Boolean).join(" OR ");
}

// One query covers both keywords and authors instead of two requests per project.
export async function fetchArxiv(config, { since, proxy, get = watchGet } = {}) {
  const query = arxivQuery(config);
  if (!query) return { items: [] };
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&sortBy=submittedDate&sortOrder=descending&max_results=200`;
  try {
    const response = await get(url, { proxy });
    if (response.status !== 200 || response.error) return { items: [], error: responseError("arXiv", response) };
    if (!/<feed\b/u.test(response.body) || /arxiv\.org\/api\/errors/u.test(response.body)) return { items: [], error: responseError("arXiv 返回无效 feed", response) };
    return { items: parseArxivFeed(response.body).filter((item) => !since || Date.parse(item.published) >= since) };
  } catch (error) {
    return { items: [], error: `arXiv：${error.message}` };
  }
}

async function openAlexJson(query, { proxy, get }) {
  const response = await get(`${OPENALEX}/${query}`, { proxy });
  if (response.status !== 200 || response.error) throw new Error(responseError("OpenAlex", response));
  const data = JSON.parse(response.body);
  if (!Array.isArray(data.results)) throw new Error("OpenAlex 返回无效 results");
  return data;
}

function abstractFromIndex(index) {
  if (!index || typeof index !== "object") return "";
  const words = [];
  for (const [word, positions] of Object.entries(index)) for (const position of positions) words[position] = word;
  return words.filter(Boolean).join(" ");
}

export function openAlexWorkToItem(work) {
  const arxiv = (work.locations ?? []).map((location) => arxivIdFromUrl(location?.landing_page_url ?? "")).find(Boolean)
    ?? (/arxiv/iu.test(work.doi ?? "") ? arxivIdFromUrl(work.doi) : null);
  const landing = work.primary_location?.landing_page_url ?? work.doi ?? work.id;
  return {
    id: arxiv ?? String(work.id).split("/").pop(),
    openalexId: String(work.id).split("/").pop(),
    title: decodeXml(work.title ?? ""),
    abstract: abstractFromIndex(work.abstract_inverted_index),
    published: work.publication_date ?? "",
    authors: (work.authorships ?? []).map((authorship) => authorship.author?.display_name).filter(Boolean),
    institutions: [...new Set((work.authorships ?? []).flatMap((authorship) => (authorship.institutions ?? []).map((institution) => institution.display_name)).filter(Boolean))],
    venue: work.primary_location?.source?.display_name ?? null,
    references: (work.referenced_works ?? []).map((reference) => String(reference).split("/").pop()),
    url: arxiv ? `https://arxiv.org/abs/${arxiv}` : landing
  };
}

async function resolveSeed(id, { proxy, get }) {
  if (/^W\d+$/u.test(id)) return id;
  if (!arxivIdFromUrl(id)) return null;
  for (const scheme of ["http", "https"]) {
    const data = await openAlexJson(`works?filter=locations.landing_page_url:${scheme}://arxiv.org/abs/${id}&select=id&per-page=1`, { proxy, get });
    if (data.results?.[0]?.id) return String(data.results[0].id).split("/").pop();
  }
  return null;
}

async function resolveInstitution(name, { proxy, get }) {
  const data = await openAlexJson(`institutions?search=${encodeURIComponent(name)}&select=id,display_name&per-page=1`, { proxy, get });
  return data.results?.[0]?.id ? String(data.results[0].id).split("/").pop() : null;
}

// Papers citing known neighbours and keyword papers from watched institutions.
export async function fetchOpenAlex(config, { since, proxy, get = curlGet, cache = {} }) {
  const errors = [];
  const items = [];
  const nextCache = { seeds: { ...(cache.seeds ?? {}) }, institutions: { ...(cache.institutions ?? {}) } };
  const from = localDate(since);
  try {
    for (const seed of config.seedPapers) if (!nextCache.seeds[seed]) nextCache.seeds[seed] = await resolveSeed(seed, { proxy, get });
    const seedIds = config.seedPapers.map((seed) => nextCache.seeds[seed]).filter(Boolean);
    const seedNames = new Map(config.seedPapers.map((seed) => [nextCache.seeds[seed], seed]));
    for (let index = 0; index < seedIds.length; index += 40) {
      const batch = seedIds.slice(index, index + 40);
      const data = await openAlexJson(`works?filter=cites:${batch.join("|")},from_publication_date:${from}&select=${OPENALEX_FIELDS}&per-page=100&sort=publication_date:desc`, { proxy, get });
      for (const work of data.results ?? []) {
        const item = openAlexWorkToItem(work);
        item.citedSeeds = item.references.filter((reference) => seedNames.has(reference)).map((reference) => seedNames.get(reference));
        items.push(item);
      }
    }
    for (const name of config.institutions) if (!nextCache.institutions[name]) nextCache.institutions[name] = await resolveInstitution(name, { proxy, get });
    const institutionIds = config.institutions.map((name) => nextCache.institutions[name]).filter(Boolean);
    if (institutionIds.length && config.keywords.length) {
      const search = config.keywords.map((keyword) => (/\s/u.test(keyword) ? `"${keyword}"` : keyword)).join(" OR ");
      const data = await openAlexJson(`works?search=${encodeURIComponent(search)}&filter=authorships.institutions.lineage:${institutionIds.join("|")},from_publication_date:${from}&select=${OPENALEX_FIELDS}&per-page=100&sort=publication_date:desc`, { proxy, get });
      for (const work of data.results ?? []) items.push(openAlexWorkToItem(work));
    }
    const unresolved = [...config.seedPapers.filter((seed) => !nextCache.seeds[seed]), ...config.institutions.filter((name) => !nextCache.institutions[name])];
    if (unresolved.length) errors.push(`OpenAlex 未找到：${unresolved.slice(0, 5).join("、")}${unresolved.length > 5 ? " 等" : ""}，相关追踪尚未完成`);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return { items, errors, cache: nextCache };
}

export async function fetchHuggingFaceDaily(days, { proxy, get = curlGet, now = Date.now() }) {
  const papers = new Map();
  const errors = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(now - offset * 86400000).toISOString().slice(0, 10); // Hugging Face lists by UTC day
    let list;
    try {
      const response = await get(`https://huggingface.co/api/daily_papers?date=${date}&limit=100`, { proxy });
      if (response.status !== 200 || response.error) throw new Error(responseError(`Hugging Face ${date}`, response));
      list = JSON.parse(response.body);
      if (!Array.isArray(list)) throw new Error("返回内容不是论文列表");
    } catch (error) {
      errors.push(`Hugging Face ${date}：${error.message}`);
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

// Optional enrichment. The documented JSON batch accepts up to 500 ids;
// no-key callers share a public quota. A refusal never invalidates discovery.
export async function fetchSemanticScholar(ids, { key, proxy, get = curlGet } = {}) {
  const papers = new Map();
  const normalized = [...new Set(ids.map(arxivIdFromUrl).filter(Boolean))].slice(0, 500);
  if (!normalized.length) return { papers };
  const headers = { "content-type": "application/json", ...(key ? { "x-api-key": key } : {}) };
  try {
    const response = await get("https://api.semanticscholar.org/graph/v1/paper/batch?fields=venue,citationCount,externalIds", {
      proxy, headers, body: JSON.stringify({ ids: normalized.map((id) => `ARXIV:${id}`) })
    });
    if (response.status !== 200 || response.error) return { papers, error: `${responseError("Semantic Scholar", response)}${key ? "" : "（未设置 key，使用共享额度）"}；仅缺少会议/引用数增补` };
    const list = JSON.parse(response.body);
    if (!Array.isArray(list)) throw new Error(`返回内容不是论文列表：${String(response.body).slice(0, 300)}`);
    for (const paper of list) {
      const id = arxivIdFromUrl(paper?.externalIds?.ArXiv);
      if (id && normalized.includes(id)) papers.set(id, { venue: paper.venue || null, citations: paper.citationCount ?? null });
    }
  } catch (error) {
    return { papers, error: `Semantic Scholar：${error.message}；仅缺少会议/引用数增补` };
  }
  return { papers };
}

const lower = (value) => String(value ?? "").toLowerCase();
const BROAD_TOPIC_WORDS = new Set("image images editing edit single generation generative visual vision learning deep neural network networks diffusion model models framework approach training evaluation efficient robust general vendor success".split(" "));
const topicText = (value) => lower(value).replace(/[-\s]+/gu, " ").trim();

function substantiveKeyword(keyword) {
  return (topicText(keyword).match(/[\p{L}\p{N}]+/gu) ?? []).some((word) => !BROAD_TOPIC_WORDS.has(word) && !STOPWORDS.has(word) && !STRUCTURE_WORDS.has(word));
}

function containsKeyword(text, keyword) {
  const escaped = topicText(keyword).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return escaped && new RegExp(`(?<![\\p{L}\\p{N}])${escaped}s?(?![\\p{L}\\p{N}])`, "u").test(topicText(text));
}

export function scorePaper(paper, config, signals = {}) {
  const reasons = [];
  let score = 0;
  let relevance = 0;
  const title = lower(paper.title);
  const abstract = lower(paper.abstract);
  const matched = [];
  const keywords = [...new Set(config.keywords)].filter(substantiveKeyword).sort((a, b) => b.length - a.length);
  for (const [text, weight, label] of [[title, 3, "标题"], [abstract, 1, "摘要"]]) {
    for (const keyword of keywords) {
      if (!containsKeyword(text, keyword) || matched.some((prior) => containsKeyword(prior, keyword) || containsKeyword(keyword, prior))) continue;
      relevance += weight;
      matched.push(keyword);
      reasons.push(`${label}含「${keyword}」`);
    }
  }
  const authors = (paper.authors ?? []).map(lower);
  for (const watched of config.authors) {
    if (authors.some((author) => author.includes(lower(watched)))) {
      // Author-only watches remain useful; a topic watch also needs a
      // substantive keyword match before its author's paper becomes relevant.
      if (!config.keywords.length || matched.length) relevance += 3;
      else score += 3;
      reasons.push(`关注作者 ${watched}`);
    }
  }
  for (const seed of paper.citedSeeds ?? []) { relevance += 3; reasons.push(`引用了近邻论文 ${seed}`); }
  const institutions = (paper.institutions ?? []).map(lower);
  for (const watched of config.institutions ?? []) {
    if (institutions.some((institution) => institution.includes(lower(watched)))) { score += 2; reasons.push(`关注机构 ${watched}`); }
  }
  score += relevance;
  const venue = signals.s2?.venue || paper.venue;
  for (const watched of config.venues ?? []) {
    if (venue && lower(venue).includes(lower(watched))) { score += 2; reasons.push(`关注会议 ${watched}`); }
  }
  if (paper.code) { score += 1; reasons.push(paper.code.startsWith("http") ? "有代码/主页" : "摘要提到代码/主页"); }
  if (signals.hf) { score += 2 + Math.min(3, Math.log2(1 + (signals.hf.upvotes || 0)) / 2); reasons.push(`HF 每日热门（${signals.hf.upvotes || 0} 赞）`); }
  if (signals.s2?.venue) { score += 1; reasons.push(`已发表：${signals.s2.venue}`); }
  if (signals.s2?.citations) { score += Math.min(2, Math.log10(1 + signals.s2.citations)); }
  // Popularity and venue only order relevant papers; they never make one relevant.
  return { score: Math.round(score * 10) / 10, relevance, reasons };
}

function renderDigest(project, date, items, notes, status) {
  const lines = [`# 论文追踪 ${date}`, "", `项目：${project}。下一次导师调用判断尚未评过的论文，返回「- 编号 | 撞题/新基线/可借用/无关 | 理由」，由主会话保存为 watch/impact-YYYY-MM-DD.md；不依赖轮次。`, ""];
  if (notes.length) lines.push(`说明：${notes.join("；")}`, "");
  if (status !== "done") lines.push("检索未完成，不能据此判断没有新的相关论文。", "");
  else if (!items.length) lines.push("本次检索没有发现新的相关论文。");
  for (const item of items) {
    lines.push(`## ${item.title}`, `- 编号：${item.id}  ·  链接：${item.url}  ·  分数 ${item.score}  ·  ${String(item.published).slice(0, 10)}`, `- 作者：${item.authors.slice(0, 6).join(", ")}${item.authors.length > 6 ? " 等" : ""}`, `- 选中原因：${item.reasons.join("；") || "分类内新论文"}`, `- 摘要：${item.abstract.slice(0, 400)}${item.abstract.length > 400 ? "…" : ""}`, "");
  }
  return `${lines.join("\n")}\n`;
}

export async function runProjectWatch(root, { settings, key, hf, now = Date.now(), get = watchGet }) {
  let drafted = false;
  if (!watchConfigExists(root)) {
    writeWatchConfig(root, await draftWatchConfigWithSources(root, { proxy: settings.proxy, get }));
    drafted = true;
  }
  const config = readWatchConfig(root);
  const guidance = watchConfigGuidance(config);
  const notes = guidance ? [guidance] : [];
  const date = localDate(now);
  if (!config.enabled) return { root, status: "disabled", guidance, notes };
  if (!config.keywords.length && !config.authors.length && !config.seedPapers.length) return { root, status: "unconfigured", drafted, guidance, notes };
  const state = readWatchState(root);
  const errors = [...(hf.errors ?? [])];
  let completedSources = 0;
  const lastRun = Date.parse(state.lastRun ?? "");
  // First run backfills a month; later runs reach back past the last run to cover arXiv's search lag.
  const since = Number.isFinite(lastRun)
    ? Math.min(now - settings.lookbackDays * 86400000, lastRun - ARXIV_INDEX_LAG_DAYS * 86400000)
    : now - FIRST_RUN_DAYS * 86400000;
  const candidates = new Map();
  const merge = (item) => {
    const existing = candidates.get(item.id);
    candidates.set(item.id, existing ? { ...item, ...existing, citedSeeds: [...new Set([...(existing.citedSeeds ?? []), ...(item.citedSeeds ?? [])])], institutions: existing.institutions?.length ? existing.institutions : item.institutions, venue: existing.venue ?? item.venue } : item);
  };
  if (config.keywords.length || config.authors.length) {
    const arxiv = await fetchArxiv(config, { since, proxy: settings.proxy, get });
    if (arxiv.error) errors.push(arxiv.error);
    else completedSources += 1;
    arxiv.items.forEach(merge);
  }
  const openAlex = await fetchOpenAlex(config, { since, proxy: settings.proxy, get, cache: state.openalex });
  errors.push(...openAlex.errors);
  if (!openAlex.errors.length && (config.seedPapers.length || (config.institutions.length && config.keywords.length))) completedSources += 1;
  notes.push(...errors);
  openAlex.items.forEach(merge);
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
  const status = errors.length ? (completedSources || ranked.length ? "partial" : "failed") : "done";
  const digest = { date, generatedAt: new Date(now).toISOString(), status, notes, items: merged };
  writeProjectFile(root, `${WATCH_DIR}/${date}.json`, `${JSON.stringify(digest, null, 2)}\n`);
  writeProjectFile(root, `${WATCH_DIR}/${date}.md`, renderDigest(path.basename(root), date, merged, notes, status));
  const nextSeen = [...ranked.map((item) => item.id), ...seen].slice(0, MAX_SEEN);
  writeProjectFile(root, PROJECT_STATE, `${JSON.stringify({ ...state, lastAttempt: digest.generatedAt, lastRun: status === "done" ? digest.generatedAt : state.lastRun ?? null, status, notes, seen: nextSeen, openalex: openAlex.cache }, null, 2)}\n`);
  return { root, status, found: ranked.length, notes, drafted, guidance, ...(status === "failed" ? { error: errors.join("；") } : {}) };
}

export async function runWatch(roots, options = {}) {
  const now = options.now ?? Date.now();
  const settings = readGlobalWatchSettings(options);
  const key = readSemanticScholarKey(options);
  const get = options.get ? createWatchFetcher({ get: options.get, wait: options.wait, clock: options.clock }) : watchGet;
  const hf = await fetchHuggingFaceDaily(settings.lookbackDays, { proxy: settings.proxy, get, now });
  const results = [];
  for (const root of roots) {
    try {
      results.push(await runProjectWatch(root, { settings, key, hf, now, get }));
    } catch (error) {
      results.push({ root, status: "failed", error: error instanceof Error ? error.message : String(error) });
    }
  }
  const previous = readGlobalWatchState(options);
  const complete = !hf.errors.length && results.every((result) => ["done", "disabled", "unconfigured"].includes(result.status));
  const attemptedAt = new Date(now).toISOString();
  const state = { lastAttempt: attemptedAt, lastRun: complete ? attemptedAt : previous.lastRun ?? null, lastRunDate: complete ? localDate(now) : null, status: complete ? "done" : "partial", hfErrors: hf.errors, results };
  if (options.recordGlobalState !== false) {
    writeGlobalWatchState(state, options);
    const hot = [...hf.papers.values()].sort((left, right) => right.upvotes - left.upvotes).slice(0, 60);
    writePrivateFile(path.join(doveConfigDirectory(options), HOT_FILE), `${JSON.stringify({ generatedAt: attemptedAt, errors: hf.errors, papers: hot }, null, 2)}\n`);
  }
  return state;
}

export function readWatchHot(options = {}) {
  return readJson(path.join(doveConfigDirectory(options), HOT_FILE), { papers: [] });
}

export function watchScanDue(scan, now = Date.now()) {
  return !scan || localDate(now - 7 * 86400000) >= scan.date;
}

export function readLatestScan(root) {
  try {
    const name = fs.readdirSync(path.join(root, WATCH_DIR)).filter((item) => /^scan-\d{4}-\d{2}-\d{2}\.md$/u.test(item)).sort().pop();
    return name ? { date: name.slice(5, 15), text: fs.readFileSync(path.join(root, WATCH_DIR, name), "utf8").slice(0, 64 * 1024) } : null;
  } catch {
    return null;
  }
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
