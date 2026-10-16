import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import test from "node:test";

import { createDashboardActions } from "../src/cli/dashboard-actions.mjs";
import { renderDashboardHtml } from "../src/cli/dashboard-server.mjs";
import { parsePaperImpacts } from "../src/core/dashboard-data.mjs";
import { exportPaperBibtex, groupPaperLibrary, readPaperLibrary, renderPaperLibrary } from "../src/core/paper-library.mjs";
import {
  arxivIdFromUrl, createWatchFetcher, curlGet, fetchArxiv, fetchHuggingFaceDaily, fetchSemanticScholar,
  MIN_RELEVANCE, normalizeGlobalWatchSettings, normalizeWatchConfig, readWatchDigests, readWatchState,
  runWatch, scorePaper, syncPaperLibrary, watchScanDue
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

test("curl preserves transport exit codes, final headers and stderr without command credentials", async (t) => {
  let attempts = 0;
  const bodies = [];
  t.mock.method(childProcess, "execFile", (command, args, _options, callback) => {
    assert.equal(command, "curl");
    assert.ok(args.includes("--data-binary"));
    assert.ok(args.includes("http://user:proxy-secret@proxy.invalid"));
    attempts += 1;
    if (attempts === 1) callback(Object.assign(new Error("curl -x proxy-secret -H x-api-key: key-secret"), { code: 35 }), "\n000", "curl: (35) unexpected eof while reading\n");
    else callback(null, "HTTP/1.1 100 Continue\r\n\r\nHTTP/2 429\r\nRetry-After: 5\r\nContent-Type: application/json\r\n\r\n{\"message\":\"quota\"}\n429", "");
    return { stdin: { end: (body) => bodies.push(body) } };
  });
  const options = { proxy: "http://user:proxy-secret@proxy.invalid", headers: { "x-api-key": "key-secret" }, body: '{"ids":["ARXIV:1706.03762"]}' };
  const failed = await curlGet("https://example.invalid/batch", options);
  assert.equal(failed.exitCode, 35);
  assert.equal(failed.status, 0);
  assert.match(failed.error, /unexpected eof/u);
  assert.doesNotMatch(JSON.stringify(failed), /proxy-secret|key-secret/u);
  const response = await curlGet("https://example.invalid/batch", options);
  assert.equal(response.status, 429);
  assert.equal(response.exitCode, 0);
  assert.equal(response.headers["retry-after"], "5");
  assert.equal(response.body, '{"message":"quota"}');
  assert.deepEqual(bodies, [options.body, options.body]);
});

const HF_DAILY = "https://huggingface.co/api/daily_papers?date=2026-10-15&limit=100";
const SSL_EOF = { status: 0, body: "", exitCode: 35, error: "curl: (35) OpenSSL: unexpected eof while reading" };

test("HF daily and arXiv recover transient transport and temporary HTTP failures with bounded backoff", async () => {
  for (const url of [HF_DAILY, "https://export.arxiv.org/api/query"]) {
    for (const failure of [
      SSL_EOF,
      { status: 200, body: "partial", exitCode: 28, error: "Operation timed out" },
      { status: 0, body: "", exitCode: 56, error: "Recv failure: Connection reset by peer" },
      { status: 0, body: "", exitCode: 52, error: "Empty reply from server" },
      ...[500, 502, 503, 504].map((status) => ({ status, body: "temporarily unavailable" }))
    ]) {
      const time = clock();
      const calledAt = [];
      const get = createWatchFetcher({ ...time, get: async () => {
        calledAt.push(time.clock());
        return calledAt.length < 3 ? failure : { status: 200, body: "[]" };
      } });
      const response = await get(url);
      assert.deepEqual(calledAt.map((at) => at - NOW), [0, 3000, 9000]);
      assert.equal(response.status, 200);
      assert.equal(response.error, undefined);
      assert.equal(response.retry.reason, "recovered");
      assert.equal(response.retry.attempts, 3);
      assert.deepEqual(response.retry.delaysMs, [3000, 6000]);
      assert.equal(response.retry.failures.length, 2);
    }
  }
});

test("HF daily never retries 400, certificate failures, permanent TLS errors or valid empty responses", async () => {
  for (const response of [
    { status: 400, body: '{"error":"bad date, not a timeout"}', headers: { "retry-after": "5" } },
    { status: 0, body: "", exitCode: 60, error: "SSL certificate problem" },
    { status: 0, body: "", exitCode: 35, error: "certificate verify failed: EOF" },
    { status: 0, body: "", exitCode: 35, error: "unsupported protocol" },
    { status: 501, body: "Not implemented" },
    { status: 200, body: "[]" },
    { status: 200, body: '[{"paper":{"id":"1706.03762","title":"EOF timeout methods"}}]' }
  ]) {
    let calls = 0;
    const get = createWatchFetcher({ ...clock(), wait: async () => assert.fail("permanent response must not wait"), get: async () => { calls += 1; return response; } });
    const result = await fetchHuggingFaceDaily(1, { now: NOW, get });
    assert.equal(calls, 1);
    assert.equal(result.errors.length, response.status === 200 ? 0 : 1);
    if (response.status === 400) assert.match(result.errors[0], /400.*bad date/u);
    if (response.exitCode) assert.match(result.errors[0], new RegExp(`exitCode: ${response.exitCode}`, "u"));
  }
});

test("HF daily honors Retry-After dates and seconds, with a one-minute wait ceiling and host-local cooldown", async () => {
  const time = clock();
  const calledAt = [];
  const get = createWatchFetcher({ ...time, get: async () => {
    calledAt.push(time.clock());
    if (calledAt.length === 1) return { status: 429, body: "quota", headers: { "retry-after": "5" } };
    if (calledAt.length === 2) return { status: 503, body: "busy", headers: { "Retry-After": new Date(NOW + 12000).toUTCString() } };
    return { status: 200, body: "[]" };
  } });
  await get(HF_DAILY);
  assert.deepEqual(calledAt.map((at) => at - NOW), [0, 5000, 12000]);
  for (const header of ["3600", new Date(NOW + 3600000).toUTCString()]) {
    let calls = 0;
    const paused = createWatchFetcher({ ...clock(), wait: async () => assert.fail("do not shorten a long server delay"), get: async (url) => {
      if (!url.includes("huggingface.co")) return { status: 200, body: feed() };
      calls += 1;
      return { status: 429, body: "long pause", headers: { "retry-after": header } };
    } });
    const first = await paused(HF_DAILY);
    const second = await paused(`${HF_DAILY}&other=1`);
    assert.equal(calls, 1);
    assert.equal(first.retry.attempts, 1);
    assert.equal(second.retry.attempts, 0, "a deferred request must not claim it was sent");
    assert.equal(first.retry.reason, "wait-limit");
    assert.equal((await paused("https://export.arxiv.org/api/query")).status, 200);
  }
  for (const [header, expected] of [["60", 60000], ["0", 3000], ["invalid", 3000]]) {
    const time = clock();
    let calls = 0;
    const get = createWatchFetcher({ ...time, get: async () => ++calls === 1
      ? { status: 503, body: "busy", headers: { "retry-after": header } } : { status: 200, body: "[]" } });
    await get(HF_DAILY);
    assert.equal(time.clock() - NOW, expected);
  }
});

test("HF daily exhaustion retains partial days and marks the watch incomplete rather than empty", async (t) => {
  const files = memoryFiles(t, configFiles());
  let calls = 0;
  const failed = await runWatch([ROOT], { env, now: NOW, ...clock(), get: async (url) => {
    if (url.includes("huggingface.co")) { calls += 1; return SSL_EOF; }
    return retrieval()(url);
  } });
  assert.equal(calls, 3);
  assert.equal(failed.status, "partial");
  assert.equal(failed.results[0].status, "partial");
  assert.equal(failed.lastRun, null);
  assert.match(failed.hfErrors.join(" "), /exitCode: 35.*unexpected eof.*请求 3 次.*三次请求上限/u);
  assert.match(files.get(`${WATCH}/2026-10-15.md`), /检索未完成/u);
  assert.doesNotMatch(files.get(`${WATCH}/2026-10-15.md`), /没有发现新的相关论文/u);
  calls = 0;
  const partial = await fetchHuggingFaceDaily(2, { now: NOW, get: createWatchFetcher({ ...clock(), get: async (url) => {
    calls += 1;
    return url.includes("2026-10-15") ? SSL_EOF : { status: 200, body: '[{"paper":{"id":"1706.03762","title":"Attention Is All You Need"}}]' };
  } }) });
  assert.equal(calls, 4);
  assert.equal(partial.papers.size, 1);
  assert.equal(partial.errors.length, 1);
});

test("recovered HF daily and arXiv retain recovery evidence without leaving a failed watermark", async (t) => {
  const files = memoryFiles(t, configFiles());
  const counts = new Map();
  const recovered = await runWatch([ROOT], { env, now: NOW, ...clock(), get: async (url) => {
    const host = new URL(url).hostname;
    const count = (counts.get(host) ?? 0) + 1;
    counts.set(host, count);
    if (count === 1 && ["huggingface.co", "export.arxiv.org"].includes(host)) return SSL_EOF;
    return retrieval()(url);
  } });
  assert.equal(recovered.status, "done");
  assert.equal(recovered.results[0].status, "done");
  assert.deepEqual(recovered.hfErrors, []);
  assert.match(recovered.hfNotes.join(" "), /Hugging Face.*请求 2 次.*unexpected eof.*请求已恢复/u);
  assert.ok(recovered.results[0].notes.some((note) => /arXiv.*unexpected eof.*请求已恢复/u.test(note)));
  assert.equal(readWatchState(ROOT).lastRun, new Date(NOW).toISOString());
  assert.match(files.get(`${WATCH}/2026-10-15.json`), /unexpected eof/u);
  assert.match(files.get(`${GLOBAL}/watch-state.json`), /unexpected eof/u);
  assert.equal(counts.get("api.semanticscholar.org"), 1, "S2 429 remains a single optional request");
});

test("Semantic Scholar stays single-attempt through the watch fetcher and preserves a 429 response", async () => {
  let calls = 0;
  const get = createWatchFetcher({ ...clock(), wait: async () => assert.fail("S2 quota must not be retried"), get: async (_url, options) => {
    calls += 1;
    assert.deepEqual(JSON.parse(options.body), { ids: ["ARXIV:1706.03762"] });
    return { status: 429, body: '{"message":"shared quota"}', headers: { "retry-after": "30" } };
  } });
  const result = await fetchSemanticScholar(["1706.03762"], { get });
  assert.equal(calls, 1);
  assert.equal(result.papers.size, 0);
  assert.match(result.error, /429.*shared quota.*Retry-After: 30.*未设置 key/u);
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
  const actions = createDashboardActions({ env, run: async (roots) => calls.push(roots), refreshOriginals: async () => {} });
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

const PAPERS = `${ROOT}/.dove/research/papers`;
const selectedPaper = (id, extra = {}) => ({ id, title: `Sewing pattern study ${id}`, abstract: "We reconstruct garments from sewing patterns.", authors: ["Alice Zhang", "Bob Li"], published: "2026-10-14T00:00:00Z", url: `https://arxiv.org/abs/${id}`, ...extra });
const digestText = (items, date = "2026-10-14") => JSON.stringify({ date, items, notes: [], status: "done" });

test("five-column impacts expose authored Chinese lines read-only and keep old three-column judgments", (t) => {
  const summary = "从服装图像预测二维纸样，并用缝合约束恢复面片连接。";
  const files = memoryFiles(t, {
    [`${WATCH}/2026-10-14.json`]: digestText([selectedPaper("2610.00001"), selectedPaper("2610.00002"), selectedPaper("2610.00003")]),
    [`${WATCH}/impact-2026-10-15.md`]: `- 2610.00001v2 | 可借用 | 可复用 A \\| B，但不是撞题或新基线 | 纸样重建 | ${summary}\n| 2610.00002 | 新基线 | 比较可借用部分 | 拓扑预测 | 预测面片之间的拓扑连接。 |\n- 2610.00003 | 无关 | 提到撞题，但并不相关\n`
  });
  const before = [...files];
  const impacts = parsePaperImpacts(ROOT);
  assert.equal(impacts["2610.00001"].impact, "borrow");
  assert.equal(impacts["2610.00001"].note, "可复用 A | B，但不是撞题或新基线");
  assert.equal(impacts["2610.00001"].direction, "纸样重建");
  assert.equal(impacts["2610.00001"].line, summary);
  assert.equal(impacts["2610.00002"].impact, "baseline");
  assert.equal(impacts["2610.00002"].line, "预测面片之间的拓扑连接。");
  assert.equal(impacts["2610.00003"].impact, "irrelevant");
  assert.equal(impacts["2610.00003"].line, "");
  assert.equal(readWatchDigests(ROOT)[0].items[0].line, summary);
  assert.equal(readWatchDigests(ROOT)[0].items[2].line, "");
  assert.deepEqual(readPaperLibrary(ROOT), { papers: [] });
  assert.deepEqual([...files], before, "reading must not create a library or rewrite a digest");
});

test("explicit library accumulation groups judgments, deduplicates ids, and leaves cumulative QA untouched", (t) => {
  const qa = "# 逐问阅读\n问题一：损失函数？\n回答：见正文第 3.2 节；以后继续追加。\n";
  const files = memoryFiles(t, {
    [`${PAPERS}/2610.00001.md`]: qa,
    [`${WATCH}/2026-10-13.json`]: digestText([selectedPaper("2610.00001v2")], "2026-10-13"),
    [`${WATCH}/2026-10-14.json`]: digestText([
      selectedPaper("2610.00001"), selectedPaper("2610.00002", { venue: "CVPR", kind: "conference" }),
      selectedPaper("2610.00003"), selectedPaper("2610.00004"), selectedPaper("W5", { authors: [], published: "", url: "https://openalex.org/W5" })
    ]),
    [`${WATCH}/impact-2026-10-15.md`]: "- 2610.00001 | 可借用 | 可借用缝合约束 | 纸样重建 | 用缝合约束重建纸样。\n- 2610.00002 | 新基线 | 同输入协议可比较 | 纸样重建 | 从图像预测纸样。\n- 2610.00003 | 无关 | 不满足输入限制 | 其它 | 研究不同任务。\n- W5 | 撞题 | 需用正文继续核对\n"
  });
  const library = syncPaperLibrary(ROOT);
  assert.deepEqual(library.papers.map((paper) => paper.id), ["2610.00001", "2610.00002", "W5"]);
  assert.equal(library.papers[0].line, "用缝合约束重建纸样。");
  assert.equal(library.papers[0].arxivId, "2610.00001");
  assert.deepEqual(library.papers[0].authors, ["Alice Zhang", "Bob Li"]);
  assert.equal(library.papers[0].date, "2026-10-14");
  assert.equal(library.papers[1].venue, "CVPR");
  const missing = library.papers[2];
  assert.deepEqual(missing.authors, []);
  for (const field of ["date", "venue", "arxivId"]) assert.equal(missing[field], null);
  assert.equal(missing.line, "");
  assert.equal(missing.direction, "");
  const groups = groupPaperLibrary(library.papers);
  assert.equal(groups.find((group) => group.direction === "纸样重建").papers.length, 2);
  assert.equal(groups.find((group) => group.direction === "待归类").papers[0].id, "W5");
  const markdown = files.get(`${PAPERS}/library.md`);
  assert.match(markdown, /## 纸样重建/u);
  assert.match(markdown, /用缝合约束重建纸样。/u);
  assert.match(markdown, /不代表读过全文/u);
  assert.match(markdown, /中文一句话待据摘要补充/u);
  assert.equal(files.get(`${PAPERS}/2610.00001.md`), qa);
  assert.deepEqual(JSON.parse(files.get(`${PAPERS}/library.json`)), library);
  const before = [...files];
  assert.deepEqual(syncPaperLibrary(ROOT), library);
  assert.deepEqual([...files], before, "repeat accumulation is idempotent");
  files.delete(`${WATCH}/2026-10-13.json`);
  files.delete(`${WATCH}/2026-10-14.json`);
  files.set(`${WATCH}/impact-2026-10-16.md`, "- 2610.00001 | 新基线 | 重分类 | 拓扑预测 | 用缝合约束预测面片连接。\n- 2610.00002 | 无关 | 已确认协议不匹配\n");
  const later = syncPaperLibrary(ROOT);
  assert.deepEqual(later.papers.map((paper) => paper.id), ["2610.00001", "W5"], "accumulated metadata survives pruned digests; latest exclusions win");
  assert.equal(later.papers[0].direction, "拓扑预测");
  assert.equal(later.papers[0].line, "用缝合约束预测面片连接。");
  assert.equal(later.papers[0].impact, "baseline");
  assert.equal(files.get(`${PAPERS}/2610.00001.md`), qa);
});

test("BibTeX and Markdown exports are pure and use only known bibliographic metadata", (t) => {
  const files = memoryFiles(t);
  const papers = [
    { id: "2401.00001", arxivId: "2401.00001", kind: "arxiv", title: "A & B: 50% Pattern_Study", authors: ["Alice Zhang", "Bob Li"], date: "2024-01-02", url: "https://arxiv.org/abs/2401.00001", direction: "纸样", impact: "borrow" },
    { id: "W2", kind: "conference", title: "Conference study", authors: ["Carol"], venue: "ICML 2025", date: null, url: "https://openreview.net/forum?id=example_paper&ref=known", direction: "纸样", impact: "baseline" },
    { id: "W3", kind: "journal", title: "Journal study", venue: "Known Journal", date: "2023-05-06", impact: "overlap" },
    { id: "W4", title: "Unknown type", venue: "Known venue", impact: "borrow" },
    { id: "2610.00005", arxivId: "2610.00005", title: "Unknown metadata", authors: [], impact: "borrow" }
  ];
  const before = JSON.stringify(papers);
  const bibtex = exportPaperBibtex([...papers, papers[0]]);
  assert.equal((bibtex.match(/^@/gmu) ?? []).length, 5);
  assert.match(bibtex, /@misc\{dove:2401\.00001/u);
  assert.ok(bibtex.includes("title = {A \\& B: 50\\% Pattern\\_Study}"));
  assert.match(bibtex, /author = \{Alice Zhang and Bob Li\}/u);
  assert.match(bibtex, /eprint = \{2401\.00001\}/u);
  assert.match(bibtex, /archivePrefix = \{arXiv\}/u);
  assert.ok(bibtex.includes("url = {https://openreview.net/forum?id=example_paper&ref=known}"));
  assert.match(bibtex, /@inproceedings\{dove:W2,[\s\S]*?booktitle = \{ICML 2025\}/u);
  assert.doesNotMatch(bibtex.split("\n\n")[1], /year =/u, "a venue's year is not an independently known publication date");
  assert.match(bibtex, /@article\{dove:W3,[\s\S]*?journal = \{Known Journal\}/u);
  const unknownVenue = bibtex.split("\n\n")[3];
  assert.match(unknownVenue, /@misc/u);
  assert.doesNotMatch(unknownVenue, /author =|year =|booktitle =|journal =/u);
  const unknown = bibtex.split("\n\n")[4];
  assert.doesNotMatch(unknown, /author =|year =|booktitle =|journal =|url =/u);
  groupPaperLibrary(papers);
  renderPaperLibrary(papers);
  assert.equal(JSON.stringify(papers), before);
  assert.equal(files.size, 0);
});

test("next watch run syncs saved impact lines while discovery never manufactures a Chinese summary", async (t) => {
  const files = memoryFiles(t, configFiles());
  const get = retrieval({ s2: { status: 200, body: "[]" } });
  await runWatch([ROOT], { env, now: NOW, ...clock(), get });
  assert.equal(readWatchDigests(ROOT)[0].items[0].line, "");
  assert.equal(files.has(`${PAPERS}/library.json`), false, "unjudged discoveries do not enter the library");
  assert.match(files.get(`${WATCH}/2026-10-15.md`), /待导师或主会话据摘要补充中文/u);
  files.set(`${WATCH}/impact-2026-10-15.md`, "- 2610.00001 | 可借用 | 缝合约束可借用 | 纸样重建 | 由服装图像预测纸样并重建服装。\n");
  const before = [...files];
  assert.equal(readWatchDigests(ROOT)[0].items[0].line, "由服装图像预测纸样并重建服装。");
  assert.deepEqual([...files], before);
  const state = await runWatch([ROOT], { env, now: NOW + 3600000, ...clock(), get });
  assert.equal(state.results[0].found, 0);
  assert.equal(readPaperLibrary(ROOT).papers[0].line, "由服装图像预测纸样并重建服装。");
  const digest = JSON.parse(files.get(`${WATCH}/2026-10-15.json`));
  assert.equal(digest.items.length, 1);
  assert.equal(digest.items[0].line, "由服装图像预测纸样并重建服装。");
  assert.match(files.get(`${WATCH}/2026-10-15.md`), /一句话（据摘要）：由服装图像预测纸样并重建服装。/u);
});

test("community discovery does not turn a push date into an unknown publication date", async () => {
  const result = await fetchHuggingFaceDaily(1, { now: NOW, get: async () => ({ status: 200, body: JSON.stringify([{ publishedAt: "2026-10-15", paper: { id: "2610.00001", title: "Sewing pattern reconstruction" } }]) }) });
  assert.equal(result.papers.get("2610.00001").published, "");
});

function olderRetrieval({ count = 8, recent = "<feed></feed>", olderStatus = 200, openalexStatus = 200, cited = true } = {}) {
  const calls = [];
  const older = Array.from({ length: count }, (_, index) => feed("Sewing pattern reconstruction", `2401.${String(index + 1).padStart(5, "0")}`, "2024-01-02T00:00:00Z").replace(/^<feed>|<\/feed>$/gu, ""));
  older.push(feed("Unrelated but very famous robotics", "2401.99999", "2024-01-02T00:00:00Z").replace(/^<feed>|<\/feed>$/gu, "").replace("Garment reconstruction and sewing pattern generation.", "Robots walk."));
  return { calls, get: async (url, options = {}) => {
    calls.push(url);
    if (url.includes("arxiv.org")) {
      const search = new URL(url).searchParams;
      if (search.get("search_query").includes("submittedDate:[")) {
        assert.equal(search.get("sortBy"), "relevance");
        assert.match(search.get("search_query"), /submittedDate:\[\d{12} TO \d{12}\]/u);
        return { status: olderStatus, body: `<feed>${older.join("")}</feed>` };
      }
      return typeof recent === "string" ? { status: 200, body: recent } : recent;
    }
    if (url.includes("openalex.org")) {
      assert.equal(new URL(url).searchParams.get("sort"), "cited_by_count:desc");
      assert.match(new URL(url).searchParams.get("filter"), /to_publication_date:/u);
      return { status: openalexStatus, body: JSON.stringify({ results: [] }) };
    }
    if (url.includes("huggingface.co")) return { status: 200, body: "[]" };
    if (url.includes("semanticscholar.org")) return { status: 200, body: JSON.stringify(JSON.parse(options.body).ids.map((id) => ({ externalIds: { ArXiv: id.slice(6) }, citationCount: cited ? 100 : 0 }))) };
    throw new Error(`Unexpected request: ${url}`);
  } };
}

test("older supplement is opt-in, bounded, relevance-gated and deduplicated across runs", async (t) => {
  assert.equal(normalizeGlobalWatchSettings().supplementOlder, false);
  assert.equal(normalizeGlobalWatchSettings({ supplementOlder: "true" }).supplementOlder, false);
  assert.equal(normalizeGlobalWatchSettings({ supplementOlder: true }).supplementOlder, true);
  const files = memoryFiles(t, configFiles());
  const { get, calls } = olderRetrieval();
  const options = { env, now: NOW, ...clock(), get };
  await runWatch([ROOT], options);
  assert.equal(calls.some((url) => url.includes("openalex.org") || url.includes("sortBy=relevance")), false);
  assert.equal(readWatchDigests(ROOT)[0].items.length, 0);
  files.set(`${GLOBAL}/watch.json`, JSON.stringify({ lookbackDays: 1, supplementOlder: true }));
  files.set(`${WATCH}/state.json`, JSON.stringify({ seen: ["2401.00001"] }));
  const filled = await runWatch([ROOT], { ...options, now: NOW + 3600000 });
  assert.equal(filled.results[0].found, 5);
  const items = readWatchDigests(ROOT)[0].items;
  assert.equal(items.length, 5);
  assert.ok(items.every((item) => item.supplement && item.relevance >= MIN_RELEVANCE && item.line === ""));
  assert.ok(items.every((item) => !["2401.00001", "2401.99999"].includes(item.id)));
  assert.equal(new Set(readWatchState(ROOT).seen).size, 6);
  assert.match(files.get(`${WATCH}/2026-10-15.md`), /较早论文补充/u);
  const oldCalls = calls.filter((url) => url.includes("sortBy=relevance")).length;
  await runWatch([ROOT], { ...options, now: NOW + 7200000 });
  assert.equal(calls.filter((url) => url.includes("sortBy=relevance")).length, oldCalls, "one day's supplement stays capped across retries");
  const nextDay = await runWatch([ROOT], { ...options, now: NOW + 86400000 });
  assert.equal(nextDay.results[0].found, 2, "do not fill three slots by weakening relevance or repeating papers");
  assert.ok(readWatchDigests(ROOT)[0].items.every((paper) => !items.some((old) => old.id === paper.id)));
  assert.equal(readWatchState(ROOT).seen.length, 8);
});

test("supplement never substitutes for failed discovery or crowds out new papers", async (t) => {
  const files = memoryFiles(t, configFiles({}, { [`${GLOBAL}/watch.json`]: JSON.stringify({ lookbackDays: 1, supplementOlder: true }) }));
  for (const recent of [{ status: 503, body: "unavailable" }, feed()]) {
    const { calls, get } = olderRetrieval({ recent });
    const state = await runWatch([ROOT], { env, now: NOW, ...clock(), get });
    assert.equal(calls.some((url) => url.includes("sortBy=relevance") || url.includes("openalex.org")), false);
    if (typeof recent !== "string") {
      assert.equal(state.results[0].status, "failed");
      assert.doesNotMatch(files.get(`${WATCH}/2026-10-15.md`), /没有发现新的相关论文/u);
    } else assert.equal(state.results[0].found, 1);
  }
  const { calls, get } = olderRetrieval();
  await runWatch([ROOT], { env, now: NOW + 3600000, ...clock(), get });
  assert.equal(calls.some((url) => url.includes("sortBy=relevance")), false, "an empty rerun is not an empty day");
});

test("older search failures stay incomplete and uncorroborated old papers do not fill a quota", async (t) => {
  const files = memoryFiles(t, configFiles({}, { [`${GLOBAL}/watch.json`]: JSON.stringify({ lookbackDays: 1, supplementOlder: true }) }));
  const failed = olderRetrieval({ olderStatus: 503, openalexStatus: 503 });
  const state = await runWatch([ROOT], { env, now: NOW, ...clock(), get: failed.get });
  assert.equal(state.results[0].status, "partial");
  assert.equal(state.results[0].found, 0);
  assert.match(files.get(`${WATCH}/2026-10-15.md`), /检索未完成/u);
  assert.doesNotMatch(files.get(`${WATCH}/2026-10-15.md`), /没有发现新的相关论文/u);
  const uncorroborated = olderRetrieval({ cited: false });
  const result = await runWatch([ROOT], { env, now: NOW + 3600000, ...clock(), get: uncorroborated.get });
  assert.equal(result.results[0].status, "done");
  assert.equal(result.results[0].found, 0);
  assert.equal(readWatchState(ROOT).seen.length, 0);
});

test("seen ledger retains earlier pushes beyond the former 5000-item cap", async (t) => {
  const seen = Array.from({ length: 5001 }, (_, index) => `W${index + 1}`);
  memoryFiles(t, configFiles({}, { [`${WATCH}/state.json`]: JSON.stringify({ seen }) }));
  await runWatch([ROOT], { env, now: NOW, ...clock(), get: retrieval() });
  assert.equal(readWatchState(ROOT).seen.length, 5002);
  assert.ok(readWatchState(ROOT).seen.includes("W5001"));
});

test("no executable configured query is not successful empty discovery and cannot trigger supplementation", async (t) => {
  const files = memoryFiles(t, configFiles({ keywords: [], authors: ['"'] }, { [`${GLOBAL}/watch.json`]: JSON.stringify({ lookbackDays: 1, supplementOlder: true }) }));
  const calls = [];
  const state = await runWatch([ROOT], { env, now: NOW, ...clock(), get: async (url) => {
    calls.push(url);
    assert.ok(url.includes("huggingface.co"), "no arXiv query or supplement should run");
    return { status: 200, body: "[]" };
  } });
  assert.equal(state.results[0].status, "failed");
  assert.equal(state.results[0].found, 0);
  assert.equal(calls.length, 1);
  assert.match(files.get(`${WATCH}/2026-10-15.md`), /检索未完成/u);
  assert.doesNotMatch(files.get(`${WATCH}/2026-10-15.md`), /没有发现新的相关论文/u);
});

test("dated old HF picks enter only opted-in supplements, never masquerade as new papers", async (t) => {
  const files = memoryFiles(t, configFiles());
  const older = olderRetrieval({ count: 0 });
  const get = (url, options) => url.includes("huggingface.co")
    ? Promise.resolve({ status: 200, body: JSON.stringify([{ paper: { id: "2402.00001", title: "Sewing pattern reconstruction", publishedAt: "2024-02-02T00:00:00Z", upvotes: 10 } }]) })
    : older.get(url, options);
  await runWatch([ROOT], { env, now: NOW, ...clock(), get });
  assert.equal(readWatchDigests(ROOT)[0].items.length, 0);
  files.set(`${GLOBAL}/watch.json`, JSON.stringify({ lookbackDays: 1, supplementOlder: true }));
  const state = await runWatch([ROOT], { env, now: NOW + 3600000, ...clock(), get });
  assert.equal(state.results[0].found, 1);
  const item = readWatchDigests(ROOT)[0].items[0];
  assert.equal(item.id, "2402.00001");
  assert.equal(item.supplement, true);
  assert.equal(item.published, "2024-02-02T00:00:00Z");
});
