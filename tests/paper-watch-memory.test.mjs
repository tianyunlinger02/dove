import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createDashboardActions } from "../src/cli/dashboard-actions.mjs";
import { renderDashboardHtml } from "../src/cli/dashboard-server.mjs";
import { parsePaperImpacts } from "../src/core/dashboard-data.mjs";
import {
  arxivIdFromUrl, createWatchFetcher, fetchArxiv, fetchSemanticScholar,
  MIN_RELEVANCE, normalizeWatchConfig, readWatchDigests, readWatchState,
  runWatch, scorePaper, watchScanDue
} from "../src/core/paper-watch.mjs";

const ROOT = "/memory/dove/project";
const HOME = "/memory/dove/home";
const WATCH = `${ROOT}/.dove/research/watch`;
const GLOBAL = `${HOME}/.config/dove`;
const NOW = Date.parse("2026-10-15T12:00:00Z");
const env = { HOME };
const feed = (title = "GarmageNet: Sewing Pattern Generation", id = "2610.00001", published = "2026-10-14T00:00:00Z") => `<feed><entry><id>https://arxiv.org/abs/${id}v2</id><title>${title}</title><summary>Garment reconstruction and sewing pattern generation.</summary><published>${published}</published><author><name>Alice</name></author></entry></feed>`;

// All paths below exist only in this Map. Never create a project or fixture directory.
function memoryFiles(t, entries = {}) {
  const files = new Map(Object.entries(entries));
  const absent = (file) => Object.assign(new Error(`No in-memory file: ${file}`), { code: "ENOENT" });
  const stat = (file) => {
    const isFile = files.has(file);
    const isDirectory = [...files.keys()].some((name) => name.startsWith(`${file}/`));
    if (!isFile && !isDirectory) throw absent(file);
    return { isFile: () => isFile, isDirectory: () => isDirectory, isSymbolicLink: () => false, uid: process.getuid?.(), mode: 0o700, mtimeMs: NOW };
  };
  for (const name of ["statSync", "lstatSync"]) t.mock.method(fs, name, stat);
  t.mock.method(fs, "existsSync", (file) => { try { stat(file); return true; } catch { return false; } });
  t.mock.method(fs, "readFileSync", (file, encoding) => {
    if (!files.has(file)) throw absent(file);
    return encoding ? String(files.get(file)) : Buffer.from(files.get(file));
  });
  t.mock.method(fs, "readdirSync", (directory) => [...new Set([...files.keys()].filter((file) => file.startsWith(`${directory}/`)).map((file) => file.slice(directory.length + 1).split("/")[0]))]);
  t.mock.method(fs, "mkdirSync", () => {});
  t.mock.method(fs, "writeFileSync", (file, content) => files.set(file, String(content)));
  t.mock.method(fs, "renameSync", (from, to) => { if (!files.has(from)) throw absent(from); files.set(to, files.get(from)); files.delete(from); });
  return files;
}

function configFiles(config = {}, extra = {}) {
  return {
    [`${WATCH}/config.json`]: JSON.stringify(normalizeWatchConfig({ keywords: ["sewing pattern"], ...config })),
    [`${GLOBAL}/projects.json`]: JSON.stringify({ revision: 1, projects: [ROOT] }),
    [`${GLOBAL}/watch.json`]: JSON.stringify({ lookbackDays: 1 }),
    ...extra
  };
}

function clock() {
  let time = NOW;
  return { clock: () => time, wait: async (ms) => { time += ms; } };
}

function retrieval({ arxiv = { status: 200, body: feed() }, s2 = { status: 429, body: '{"message":"shared quota"}' }, hf = { status: 200, body: "[]" } } = {}) {
  return async (url) => {
    if (url.includes("arxiv.org")) return arxiv;
    if (url.includes("huggingface.co")) return hf;
    if (url.includes("semanticscholar.org")) return s2;
    if (url.includes("openalex.org")) return { status: 503, body: "upstream unavailable" };
    throw new Error(`Unexpected request: ${url}`);
  };
}

test("Semantic Scholar keeps documented JSON format, normalizes ids and includes all 150 candidates", async () => {
  assert.equal(arxivIdFromUrl("https://arxiv.org/pdf/1706.03762v7.pdf"), "1706.03762");
  assert.equal(arxivIdFromUrl("ARXIV:hep-th/9901001v3"), "hep-th/9901001");
  assert.equal(arxivIdFromUrl("https://doi.org/10.48550/arXiv.1706.03762"), "1706.03762");
  assert.equal(arxivIdFromUrl("https://elsewhere.org/1706.03762"), null);
  assert.equal(arxivIdFromUrl("invalid-2610.00001-extra"), null);
  assert.equal(arxivIdFromUrl("2613.00001"), null);
  const ids = Array.from({ length: 150 }, (_, i) => `2610.${String(i + 1).padStart(5, "0")}`);
  let calls = 0;
  const result = await fetchSemanticScholar([...ids, "ARXIV:2610.00001v2", "https://arxiv.org/abs/hep-th/9901001", "W123"], {
    key: "test-key", get: async (url, options) => {
      calls += 1;
      assert.equal(new URL(url).searchParams.get("fields"), "venue,citationCount,externalIds");
      assert.equal(options.headers["content-type"], "application/json");
      assert.equal(options.headers["x-api-key"], "test-key");
      assert.deepEqual(JSON.parse(options.body), { ids: [...ids, "hep-th/9901001"].map((id) => `ARXIV:${id}`) });
      return { status: 200, body: JSON.stringify([null, { externalIds: { ArXiv: "2610.00150v1" }, venue: "CVPR", citationCount: 4 }]) };
    }
  });
  assert.equal(calls, 1);
  assert.equal(result.papers.get("2610.00150").venue, "CVPR");
});

test("Semantic Scholar retains actual 400 body and no-key failure is optional, without retry storms", async () => {
  let calls = 0;
  const result = await fetchSemanticScholar(["ARXIV:1706.03762v2"], { get: async (_url, options) => {
    calls += 1;
    assert.equal(options.headers["x-api-key"], undefined);
    return { status: 400, body: '{"error":"Unrecognized field: example"}' };
  } });
  assert.equal(calls, 1);
  assert.match(result.error, /400.*Unrecognized field: example/u);
  assert.match(result.error, /未设置 key.*仅缺少会议/u);
  assert.equal(result.papers.size, 0);
});

test("arXiv serializes and paces requests, respects numeric/date Retry-After, and combines keyword/author query", async () => {
  const time = clock();
  const calledAt = [];
  let count = 0;
  const get = createWatchFetcher({ ...time, get: async (url) => {
    calledAt.push(time.clock());
    const query = new URL(url).searchParams.get("search_query");
    assert.match(query, /ti:"sewing pattern"/u);
    assert.match(query, /au:"Alice"/u);
    count += 1;
    if (count === 1) return { status: 429, body: "rate limit", headers: { "retry-after": "5" } };
    if (count === 2) return { status: 429, body: "rate limit", headers: { "retry-after": new Date(NOW + 12000).toUTCString() } };
    return { status: 200, body: feed() };
  } });
  const config = normalizeWatchConfig({ keywords: ["sewing pattern"], authors: ["Alice"] });
  const results = await Promise.all([fetchArxiv(config, { get }), fetchArxiv(config, { get })]);
  assert.deepEqual(calledAt.map((time) => time - NOW), [0, 5000, 12000, 15000]);
  assert.ok(results.every((result) => result.items.length === 1));
});

test("arXiv retry count and excessive Retry-After stay bounded without violating server delay", async () => {
  let calls = 0;
  const get = createWatchFetcher({ ...clock(), get: async () => { calls += 1; return { status: 429, body: "try later" }; } });
  assert.equal((await get("https://export.arxiv.org/api/query")).status, 429);
  assert.equal(calls, 3);
  calls = 0;
  const paused = createWatchFetcher({ ...clock(), get: async () => { calls += 1; return { status: 429, headers: { "retry-after": "3600" }, body: "long pause" }; } });
  await paused("https://export.arxiv.org/api/query?a=1");
  await paused("https://export.arxiv.org/api/query?a=2");
  assert.equal(calls, 1);
  const invalid = await fetchArxiv(normalizeWatchConfig({ keywords: ["garment"] }), { get: async () => ({ status: 200, body: "<html>upstream error</html>" }) });
  assert.match(invalid.error, /无效 feed/u);
});

test("topic relevance rejects broad titles and substring accidents but keeps garment-specific positive examples", () => {
  const config = normalizeWatchConfig({ keywords: ["image editing", "single image", "vendor success", "sewing pattern", "garment", "cloth"], authors: ["Alice"], institutions: ["Example Lab"] });
  for (const title of ["ThinkDrag: Image Editing from a Single Image", "Vendor Success with Image Editing", "Clothing-free robot control"]) {
    const scored = scorePaper({ title, abstract: "", authors: ["Alice"], institutions: ["Example Lab"] }, config, { hf: { upvotes: 999 }, s2: { venue: "CVPR", citations: 999 } });
    assert.equal(scored.relevance, 0, title);
  }
  for (const title of ["AIpparel: A Multimodal Foundation Model for Digital Garments", "GarmageNet: Sewing Pattern Generation"]) {
    assert.ok(scorePaper({ title, abstract: "", authors: [] }, config).relevance >= MIN_RELEVANCE, title);
  }
  assert.equal(scorePaper({ title: "Editing", abstract: "sewing pattern generation", authors: [] }, normalizeWatchConfig({ keywords: ["sewing pattern", "sewing pattern generation"] })).relevance, 1, "overlapping abstract terms are not independent evidence");
  assert.equal(scorePaper({ title: "Other field", authors: ["Alice"] }, normalizeWatchConfig({ authors: ["Alice"] })).relevance, 3, "explicit author-only watches still work");
});

test("adding an overlapping abstract keyword never suppresses a stronger title match", () => {
  const paper = { title: "Garment reconstruction with seam constraints", abstract: "We study garment generation.", authors: [] };
  const base = scorePaper(paper, normalizeWatchConfig({ keywords: ["garment"] }));
  const expanded = scorePaper(paper, normalizeWatchConfig({ keywords: ["garment", "garment generation"] }));
  assert.equal(base.relevance, 3);
  assert.equal(expanded.relevance, base.relevance);
  assert.deepEqual(expanded.reasons, ["标题含「garment」"]);
});

test("community cache preserves author and full-abstract relevance from discovery to Trends", async (t) => {
  memoryFiles(t, configFiles({ keywords: [], authors: ["Alice"] }));
  const papers = [
    { id: "2610.00021", title: "Control policies", summary: "A study.", authors: [{ name: "Alice" }], upvotes: 4 },
    { id: "2610.00022", title: "Manufacturing methods", summary: `${"Context. ".repeat(100)}sewing pattern design with garment reconstruction.`, authors: [{ name: "Bob" }], upvotes: 3 }
  ];
  await runWatch([ROOT], { env, now: NOW, ...clock(), get: retrieval({ hf: { status: 200, body: JSON.stringify(papers.map((paper) => ({ paper }))) } }) });
  const actions = createDashboardActions({ env });
  assert.deepEqual(actions.readTrends({ now: NOW }).hot.map(({ id }) => id), ["2610.00021"]);
  actions.saveWatchConfig({ root: ROOT, config: { keywords: ["sewing pattern", "garment reconstruction"], authors: [] } });
  const hot = actions.readTrends({ now: NOW }).hot;
  assert.deepEqual(hot.map(({ id }) => id), ["2610.00022"]);
  assert.ok(hot[0].abstract.length > 600);
  assert.equal(scorePaper(hot[0], normalizeWatchConfig({ keywords: ["sewing pattern", "garment reconstruction"] })).relevance, 2);
});

test("failed retrieval preserves successful backfill watermark and never writes a no-papers claim", async (t) => {
  const lastRun = "2026-10-01T12:00:00Z";
  const files = memoryFiles(t, configFiles({ source: "draft" }, {
    [`${WATCH}/state.json`]: JSON.stringify({ lastRun, seen: [] }),
    [`${GLOBAL}/watch-state.json`]: JSON.stringify({ lastRun, lastRunDate: "2026-10-01" })
  }));
  const failed = await runWatch([ROOT], { env, now: NOW, ...clock(), get: retrieval({ arxiv: { status: 429, body: "arxiv quota" } }) });
  assert.equal(failed.results[0].status, "failed");
  assert.equal(failed.lastRun, lastRun);
  assert.equal(failed.lastRunDate, null);
  assert.equal(readWatchState(ROOT).lastRun, lastRun);
  assert.equal(readWatchState(ROOT).lastAttempt, new Date(NOW).toISOString());
  assert.match(failed.results[0].guidance, /自动初稿/u);
  assert.equal(failed.results[0].drafted, false);
  const markdown = [...files.entries()].find(([name]) => /watch\/\d{4}-\d{2}-\d{2}\.md$/u.test(name))[1];
  assert.match(markdown, /检索未完成/u);
  assert.doesNotMatch(markdown, /今天没有新的相关论文/u);
  const recovered = await runWatch([ROOT], { env, now: NOW + 3600000, ...clock(), get: retrieval({ arxiv: { status: 200, body: feed(undefined, "2610.00002", "2026-10-05T00:00:00Z") } }) });
  assert.equal(recovered.results[0].status, "done");
  assert.equal(recovered.results[0].found, 1, "retry still covers papers older than the ordinary lookback");
  assert.match(recovered.results[0].notes.join(" "), /Semantic Scholar 429.*shared quota/u);
});

test("partial source failure keeps discovered papers but does not mark retrieval complete", async (t) => {
  memoryFiles(t, configFiles({ seedPapers: ["W123"] }));
  const state = await runWatch([ROOT], { env, now: NOW, ...clock(), get: retrieval() });
  assert.equal(state.results[0].status, "partial");
  assert.equal(state.results[0].found, 1);
  assert.equal(readWatchDigests(ROOT)[0].items.length, 1);
  assert.equal(readWatchState(ROOT).lastRun, null);
  assert.match(state.results[0].notes.join(" "), /OpenAlex 503.*upstream unavailable/u);
});

test("impact parsing reads standalone and long historical briefs, with explicit labels rather than reason keywords", (t) => {
  memoryFiles(t, {
    [`${ROOT}/.dove/research/rounds/004-brief.md`]: `${"long old brief\n".repeat(6000)}- 2610.00001 | 撞题 | older judgement\n- 2610.00002 | 无关 | 不是撞题或新基线\n`,
    [`${WATCH}/impact-2026-10-14.md`]: "- 2610.00001 | 新基线 | earlier\n",
    [`${WATCH}/impact-2026-10-15.md`]: "- 2610.00001 | 可借用 | 不算撞题\n| hep-th/9901001 | 无关 | 不是新基线 |\n- W123 | 新基线 | baseline\n"
  });
  const impacts = parsePaperImpacts(ROOT);
  assert.equal(impacts["2610.00001"].impact, "borrow");
  assert.equal(impacts["2610.00001"].file, "watch/impact-2026-10-15.md");
  assert.equal(impacts["2610.00002"].impact, "irrelevant");
  assert.equal(impacts["hep-th/9901001"].impact, "irrelevant");
  assert.equal(impacts.W123.impact, "baseline");
});

test("panel exposes old unjudged papers, independent scans and persistent draft guidance without rounds", async (t) => {
  const entries = configFiles({ source: "draft" });
  for (let day = 1; day <= 5; day += 1) entries[`${WATCH}/2026-10-0${day}.json`] = JSON.stringify({ date: `2026-10-0${day}`, items: [{ id: `2610.0000${day}` }], notes: [] });
  entries[`${WATCH}/impact-2026-10-06.md`] = "- 2610.00001 | 无关 | unrelated\n";
  entries[`${WATCH}/scan-2026-10-01.md`] = "# standalone scan";
  memoryFiles(t, entries);
  const actions = createDashboardActions({ env, run: async () => {} });
  const view = actions.readWatch({ root: ROOT, now: NOW });
  assert.equal(view.scan.date, "2026-10-01");
  assert.equal(view.scanDue, true);
  assert.deepEqual(view.pending.map((paper) => paper.id), ["2610.00002"]);
  assert.match(view.guidance, /source: mentor/u);
  assert.equal(actions.runWatch({ root: ROOT }).guidance[0].root, ROOT);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(actions.runWatch().guidance[0].root, ROOT);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(watchScanDue({ date: "2026-10-14" }, NOW), false);
});

test("community trends use the same substantive relevance threshold", (t) => {
  memoryFiles(t, configFiles({ keywords: ["image editing", "single image", "sewing pattern"] }, {
    [`${GLOBAL}/watch-hot.json`]: JSON.stringify({ papers: [
      { id: "2610.00001", title: "Image Editing from a Single Image", abstract: "", upvotes: 999 },
      { id: "2610.00002", title: "GarmageNet: Sewing Pattern Generation", abstract: "", upvotes: 4 }
    ] })
  }));
  const trends = createDashboardActions({ env }).readTrends({ now: NOW });
  assert.deepEqual(trends.hot.map((paper) => paper.id), ["2610.00002"]);
  assert.equal(trends.scans[0].due, true);
});

test("scheduler retries failed work after an hour, not every tick or as a completed day", async (t) => {
  const current = new Date(2026, 9, 15, 12);
  const files = memoryFiles(t, configFiles({}, {
    [`${GLOBAL}/watch-state.json`]: JSON.stringify({ lastAttempt: new Date(current.getTime() - 1800000).toISOString(), lastRunDate: null }),
    [`${WATCH}/state.json`]: JSON.stringify({ status: "failed", lastRun: null })
  }));
  const calls = [];
  const actions = createDashboardActions({ env, run: async (roots) => calls.push(roots) });
  clearInterval(actions.startScheduler({ now: () => current, intervalMs: 1e9 }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 0);
  const later = new Date(current.getTime() + 3600000);
  clearInterval(actions.startScheduler({ now: () => later, intervalMs: 1e9 }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, [[ROOT]]);
  clearInterval(actions.startScheduler({ now: () => new Date(later.getTime() + 600000), intervalMs: 1e9 }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 1);
  files.set(`${WATCH}/state.json`, JSON.stringify({ status: "done", lastRun: later.toISOString() }));
  clearInterval(actions.startScheduler({ now: () => new Date(later.getTime() + 7200000), intervalMs: 1e9 }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 1);
});

test("dashboard browser scripts parse in each mode without writing files", () => {
  for (const options of [{}, { canEdit: true }, { canEdit: true, canSignOut: true }]) {
    const script = renderDashboardHtml(options).split("<script>")[1].split("</script>")[0];
    assert.doesNotThrow(() => new Function(script));
  }
});
