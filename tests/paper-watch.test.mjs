import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createDashboardActions } from "../src/cli/dashboard-actions.mjs";
import { startDashboardServer } from "../src/cli/dashboard-server.mjs";
import { collectDashboard, readProjectDocument } from "../src/core/dashboard-data.mjs";
import { codeLink, draftWatchConfig, localDate, parseArxivFeed, readWatchConfig, readWatchDigests, runWatch, scorePaper, writeGlobalWatchSettings, writeSemanticScholarKey, writeWatchConfig } from "../src/core/paper-watch.mjs";
import { parsePaperImpacts } from "../src/core/dashboard-data.mjs";
import { changeRegisteredProjects } from "../src/core/project-registry.mjs";

const NOW = Date.parse("2026-10-08T12:00:00Z");

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function project() {
  const root = tempDir("dove-watch-project-");
  fs.mkdirSync(path.join(root, ".dove/research"), { recursive: true });
  fs.writeFileSync(path.join(root, ".dove/research/IDENTITY.md"), "Mainline: 测试主线\n");
  return root;
}

const arxivXml = `<?xml version="1.0"?><feed>
<entry><id>http://arxiv.org/abs/2610.00001v1</id><published>2026-10-07T10:00:00Z</published>
<title>Sewing Pattern Generation with Diffusion</title><summary>We generate sewing patterns &amp; garments.</summary>
<author><name>Alice Zhang</name></author><author><name>Bob Li</name></author><category term="cs.CV"/></entry>
<entry><id>http://arxiv.org/abs/2610.00002v2</id><published>2026-10-07T11:00:00Z</published>
<title>Unrelated Robotics Paper</title><summary>Robots walk.</summary><author><name>Carol</name></author></entry>
<entry><id>http://arxiv.org/abs/2609.00003v1</id><published>2026-09-01T11:00:00Z</published>
<title>Old sewing pattern work</title><summary>old</summary><author><name>Dan</name></author></entry>
</feed>`;

function fakeGet({ s2Status = 429 } = {}) {
  const calls = [];
  const get = async (url, options = {}) => {
    calls.push({ url, headers: options.headers ?? {} });
    if (url.includes("export.arxiv.org")) return { status: 200, body: arxivXml };
    if (url.includes("huggingface.co")) return { status: 200, body: JSON.stringify([{ paper: { id: "2610.00001", title: "Sewing Pattern Generation with Diffusion", summary: "x", upvotes: 15, authors: [{ name: "Alice Zhang" }] } }, { paper: { id: "2610.09999", title: "Popular but unrelated LLM", summary: "y", upvotes: 99 } }]) };
    if (url.includes("semanticscholar")) return s2Status === 200 ? { status: 200, body: JSON.stringify([{ externalIds: { ArXiv: "2610.00001" }, venue: "CVPR", citationCount: 4 }]) } : { status: s2Status, body: "" };
    return { status: 404, body: "" };
  };
  return { get, calls };
}

test("parses arXiv entries and scores by keyword, author and popularity", () => {
  const entries = parseArxivFeed(arxivXml);
  assert.deepEqual(entries.map((entry) => entry.id), ["2610.00001", "2610.00002", "2609.00003"]);
  assert.equal(entries[0].abstract, "We generate sewing patterns & garments.");
  const config = { keywords: ["sewing pattern"], authors: ["Alice Zhang"], categories: ["cs.CV"], enabled: true };
  const scored = scorePaper(entries[0], config, { hf: { upvotes: 15 }, s2: { venue: "CVPR", citations: 4 } });
  assert.ok(scored.score > 8);
  assert.ok(scored.reasons.some((reason) => reason.includes("标题含")));
  assert.ok(scored.reasons.some((reason) => reason.includes("HF")));
  assert.deepEqual(scorePaper(entries[1], config).reasons, []);
  const weak = scorePaper({ title: "Robot policy", abstract: "folding a garment", authors: [] }, { keywords: ["garment"], authors: [] }, { hf: { upvotes: 50 } });
  assert.equal(weak.relevance, 1, "one abstract mention stays below the relevance bar even when popular");
});

test("runs without a Semantic Scholar key and keeps going when it refuses", async () => {
  const env = { HOME: tempDir("dove-watch-home-") };
  const root = project();
  const unconfigured = project();
  writeWatchConfig(root, { keywords: "sewing pattern\ngarment", authors: "Alice Zhang" });
  writeGlobalWatchSettings({ lookbackDays: 3 }, { env });
  const { get, calls } = fakeGet({ s2Status: 429 });
  const state = await runWatch([root, unconfigured], { env, get, now: NOW });
  assert.equal(state.lastRunDate, localDate(NOW));
  assert.deepEqual(state.results.map((item) => item.status), ["done", "unconfigured"]);
  assert.ok(state.results[0].notes.some((note) => /Semantic Scholar 429.*未设置 key.*仅缺少会议/u.test(note)));
  const [digest] = readWatchDigests(root);
  assert.deepEqual(digest.items.map((item) => item.id), ["2610.00001"]);
  assert.ok(fs.readFileSync(path.join(root, `.dove/research/watch/${localDate(NOW)}.md`), "utf8").includes("Sewing Pattern Generation"));
  assert.ok(calls.filter((call) => call.url.includes("semanticscholar")).every((call) => !call.headers["x-api-key"]));
  const again = await runWatch([root], { env, get, now: NOW + 3600000 });
  assert.equal(again.results[0].found, 0, "already reported papers are not repeated");
  assert.deepEqual(readWatchDigests(root)[0].items.map((item) => item.id), ["2610.00001"], "a second run keeps the day's earlier finds");
});

test("uses the Semantic Scholar key when one is saved", async () => {
  const env = { HOME: tempDir("dove-watch-home-") };
  const root = project();
  writeWatchConfig(root, { keywords: ["sewing pattern"] });
  writeSemanticScholarKey("k-123", { env });
  assert.equal((fs.statSync(path.join(env.HOME, ".config/dove/s2-api-key")).mode & 0o777), 0o600);
  const { get, calls } = fakeGet({ s2Status: 200 });
  await runWatch([root], { env, get, now: NOW });
  assert.ok(calls.some((call) => call.url.includes("semanticscholar") && call.headers["x-api-key"] === "k-123"));
  assert.equal(readWatchDigests(root)[0].items[0].venue, "CVPR");
});

test("settings API needs the custom header and only allows settings actions", async () => {
  const env = { HOME: tempDir("dove-watch-home-") };
  const root = project();
  const runs = [];
  const actions = createDashboardActions({ env, run: async (roots) => { runs.push(roots); } });
  actions.getSettings = () => ({ ok: true });
  const server = await startDashboardServer({ collect: () => collectDashboard({ projects: [root] }), listRoots: () => [root], readDocument: readProjectDocument, actions, port: 0 });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (body, headers = { "x-dove-request": "1" }) => fetch(`${base}/api/action`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
    assert.equal((await post({ type: "saveWatchConfig", root, config: { keywords: ["x"] } }, {})).status, 403);
    assert.equal((await post({ type: "saveWatchConfig", root, config: { keywords: "cloth simulation" } })).status, 200);
    assert.deepEqual((await (await fetch(`${base}/api/watch?project=${encodeURIComponent(root)}`)).json()).config.keywords, ["cloth simulation"]);
    assert.equal((await post({ type: "saveWatchConfig", root: "/etc", config: {} })).status, 404);
    assert.equal((await post({ type: "startScheduler" })).status, 400);
    assert.equal((await post({ type: "runWatch", root })).status, 200);
    assert.deepEqual(runs, [[root]]);
    assert.equal((await post({ type: "changePassword", password: "longenough" })).status, 400, "no password file means no password change");
  } finally {
    server.close();
  }
});

test("scheduler runs once per local day after the configured hour", async () => {
  const env = { HOME: tempDir("dove-watch-home-") };
  writeGlobalWatchSettings({ dailyHour: 8 }, { env });
  const root = project();
  changeRegisteredProjects([root], [], { env });
  const runs = [];
  const actions = createDashboardActions({ env, run: async (roots) => { runs.push(roots); } });
  const early = new Date(2026, 9, 8, 7, 0);
  clearInterval(actions.startScheduler({ now: () => early, intervalMs: 1e9 }));
  assert.equal(runs.length, 0);
  const late = new Date(2026, 9, 8, 9, 0);
  clearInterval(actions.startScheduler({ now: () => late, intervalMs: 1e9 }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(runs, [[root]]);
});

test("drafts keywords and neighbour papers from the project's own records", async () => {
  const root = project();
  fs.mkdirSync(path.join(root, ".dove/research/rounds"), { recursive: true });
  fs.writeFileSync(path.join(root, ".dove/research/rounds/001-brief.md"), [
    "作者：导师", "We compare sewing pattern generation against GarmentCode.", "Sewing pattern generation needs panel topology.",
    "Baseline: https://arxiv.org/abs/2306.03642 and arXiv:2306.03642 again; also arxiv.org/pdf/2405.12345.", "The sewing pattern generation results.", "panel topology matters; panel topology again."
  ].join("\n"));
  const draft = draftWatchConfig(root);
  assert.equal(draft.source, "draft");
  assert.ok(draft.keywords.includes("sewing pattern generation"), draft.keywords.join(","));
  assert.ok(draft.keywords.includes("panel topology"));
  assert.deepEqual(draft.seedPapers, ["2306.03642", "2405.12345"]);
  const env = { HOME: tempDir("dove-watch-home-") };
  const { get } = fakeGet();
  const state = await runWatch([root], { env, get, now: NOW });
  assert.equal(state.results[0].drafted, true, "a missing config is drafted on the first run");
  assert.equal(readWatchConfig(root).source, "draft");
});

test("finds papers citing neighbours and by watched authors, and rewards watched venues and code", async () => {
  const env = { HOME: tempDir("dove-watch-home-") };
  const root = project();
  writeWatchConfig(root, { keywords: ["sewing pattern"], authors: ["Carol"], venues: ["CVPR"], seedPapers: ["2306.03642"] });
  const citing = { id: "https://openalex.org/W999", title: "Draping Garments from Programs", publication_date: "2026-10-06", authorships: [{ author: { display_name: "Eve" }, institutions: [{ display_name: "ETH Zurich" }] }], abstract_inverted_index: { "We": [0], "drape": [1] }, locations: [{ landing_page_url: "https://arxiv.org/abs/2610.00077" }], primary_location: { source: { display_name: "CVPR" } }, referenced_works: ["https://openalex.org/W111"] };
  const base = fakeGet({ s2Status: 429 }).get;
  const get = async (url, options) => {
    if (url.includes("openalex.org/works?filter=locations.landing_page_url")) return { status: 200, body: JSON.stringify({ results: [{ id: "https://openalex.org/W111" }] }) };
    if (url.includes("openalex.org/works?filter=cites:W111")) return { status: 200, body: JSON.stringify({ results: [citing] }) };
    if (url.includes("export.arxiv.org") && new URL(url).searchParams.get("search_query")?.includes('au:"Carol"')) return { status: 200, body: arxivXml.replace("2610.00001v1", "2610.00055v1").replace("Sewing Pattern Generation with Diffusion", "Sewing pattern editing").replace("<name>Alice Zhang</name>", "<name>Carol</name>").replace("We generate sewing patterns &amp; garments.", "Code: https://github.com/x/y") };
    return base(url, options);
  };
  await runWatch([root], { env, get, now: NOW });
  const items = readWatchDigests(root)[0].items;
  const cited = items.find((item) => item.id === "2610.00077");
  assert.ok(cited, items.map((item) => item.id).join(","));
  assert.ok(cited.reasons.includes("引用了近邻论文 2306.03642"));
  assert.ok(cited.reasons.includes("关注会议 CVPR"));
  const byAuthor = items.find((item) => item.id === "2610.00055");
  assert.ok(byAuthor.reasons.includes("关注作者 Carol"));
  assert.ok(byAuthor && byAuthor.reasons.includes("有代码/主页"));
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, ".dove/research/watch/state.json"), "utf8")).openalex.seeds["2306.03642"], "W111");
  assert.equal(codeLink("see project page"), "（摘要提到主页/代码）");
});

test("reads mentor impact lines and builds the weekly trends view", async () => {
  const env = { HOME: tempDir("dove-watch-home-") };
  const root = project();
  writeWatchConfig(root, { keywords: ["sewing pattern"] });
  const { get } = fakeGet();
  await runWatch([root], { env, get, now: NOW });
  fs.mkdirSync(path.join(root, ".dove/research/rounds"), { recursive: true });
  fs.writeFileSync(path.join(root, ".dove/research/rounds/004-brief.md"), "作者：导师\n## 论文影响\n- 2610.00001 | 撞题 | 覆盖了结构生成主张\n");
  fs.writeFileSync(path.join(root, ".dove/research/watch/scan-2026-10-07.md"), "# 领域扫描\n- CVPR 2026 接收了 3 篇纸样生成");
  assert.equal(parsePaperImpacts(root)["2610.00001"].impact, "overlap");
  const registryOptions = { env };
  changeRegisteredProjects([root], [], registryOptions);
  const actions = createDashboardActions({ env });
  const trends = actions.readTrends({ now: NOW });
  assert.equal(trends.top[0].id, "2610.00001");
  assert.deepEqual(trends.top[0].impacts.map((item) => item.label), ["撞题"]);
  assert.equal(trends.hot[0].id, "2610.00001", "community hot papers are kept only when they touch a project keyword");
  assert.equal(trends.scans[0].date, "2026-10-07");
  assert.equal(actions.readWatch({ root }).scan.date, "2026-10-07");
});
