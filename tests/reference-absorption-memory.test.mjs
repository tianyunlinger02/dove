import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { renderDashboardHtml, renderPaperCard, startDashboardServer } from "../src/cli/dashboard-server.mjs";
import { parseCardHeader } from "../src/core/topic-selection.mjs";

const paper = {
  id: "2610.04074", title: "Source & mechanism", url: "https://arxiv.org/abs/2610.04074",
  abstract: "A source mechanism's assumptions and results.", authors: ["First Author", "Second Author"],
  published: "2026-10-08", reasons: ["标题含「mechanism」"]
};

test("paper cards lead with the Chinese takeaway and keep retrieval reasons as secondary evidence", () => {
  const line = "用来源机制回答一个具体问题。";
  const html = renderPaperCard({ ...paper, line });
  assert.ok(html.indexOf(line) < html.indexOf("标题含"));
  assert.match(html, /<details class="abs">.*不代表已读全文/u);
  assert.match(html, /Source &amp; mechanism/u);
  assert.match(html, /mechanism&#39;s assumptions/u);
  assert.match(html, /First Author、Second Author/u);
  const pending = renderPaperCard(paper);
  assert.match(pending, /中文一句话待补充/u);
  assert.ok(!pending.includes('<div class="takeaway">标题含'));
});

test("mentor impact takeaways override stale digest lines without changing source metadata", () => {
  const html = renderPaperCard({ ...paper, line: "旧摘要" }, { line: "按摘要修正的一句话", note: "可作比较", file: "watch/impact-2026-10-15.md" });
  assert.match(html, /按摘要修正的一句话/u);
  assert.ok(!html.includes("旧摘要"));
  assert.match(html, /可作比较/u);
  assert.match(html, /2610\.04074/u);
});

test("topic presentation consumes sourced candidate fields instead of six score dots", () => {
  const candidate = parseCardHeader("# 候选\n状态：候选\n阶段：发散\n定位：机制\n一句话：转用机制\n缺口：X 的 Y 留下 Z\n来源机制：[A] 的机制 M\n对应关系：U 对应 V\n成立前提：P 成立\n近邻差别：不同于 B\n最大风险：P 不成立\n评审结论：修改\n修改焦点：对应关系\n评审依据：2610.04074 第3节反例\n最强反对：U 与 V 不等价\n");
  const view = { innerHTML: "", querySelectorAll: () => [] };
  const script = renderDashboardHtml({ canEdit: true }).split("<script>")[1].split("</script>")[0];
  const section = script.slice(script.indexOf("const TOPIC_STATUS ="), script.indexOf("async function loadTopics()"));
  const context = { topics: { criteria: { present: true }, projects: [{ started: true, root: "/memory/project", name: "Project", cards: [{ ...candidate, file: "topics/cards/01.md" }], documents: [] }] }, topicRoot: null, document: { getElementById: () => view }, esc: (value) => String(value ?? ""), openDocs: new Set() };
  vm.runInNewContext(`${section}\nrenderTopics();`, context);
  for (const value of ["X 的 Y 留下 Z", "[A] 的机制 M", "U 对应 V", "P 成立", "不同于 B", "P 不成立", "修改", "2610.04074 第3节反例", "U 与 V 不等价"]) assert.ok(view.innerHTML.includes(value), value);
  assert.ok(!view.innerHTML.includes("六点"));
  assert.ok(!section.includes("sixParts"));
});

test("library presentation groups papers and offers exports even without a current digest", () => {
  const script = renderDashboardHtml({ canEdit: true }).split("<script>")[1].split("</script>")[0];
  const section = script.slice(script.indexOf("function librarySection("), script.indexOf("function papersSection("));
  const context = { esc: (value) => String(value ?? ""), paperHtml: renderPaperCard, groups: [{ direction: "结构对应", papers: [{ ...paper, line: "机制迁移的内容说明。" }] }] };
  const html = vm.runInNewContext(`${section}\nlibrarySection('/memory/project', groups);`, context);
  assert.match(html, /结构对应/u);
  assert.match(html, /机制迁移的内容说明/u);
  for (const format of ["json", "md", "bib"]) assert.ok(html.includes(`format=${format}`));
  assert.match(html, /积累已有影响判断/u);
});

test("literature downloads stay read-only and accumulation requires its explicit named action", async () => {
  let reads = 0, writes = 0;
  const root = "/memory/project";
  const actions = {
    readLibrary({ root: selected, format }) { assert.equal(selected, root); reads += 1; return format === "json" ? { papers: [paper] } : `export-${format}`; },
    syncPaperLibrary({ root: selected }) { assert.equal(selected, root); writes += 1; return { papers: [paper] }; }
  };
  const server = await startDashboardServer({ collect: () => ({}), listRoots: () => [root], actions, port: 0 });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const format of ["json", "md", "bib"]) {
      const response = await fetch(`${base}/api/library?project=${encodeURIComponent(root)}&format=${format}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-disposition"), new RegExp(`library\\.${format}`));
      if (format === "json") assert.equal((await response.json()).papers[0].id, paper.id);
      else { assert.equal(await response.text(), `export-${format}`); assert.match(response.headers.get("content-disposition"), new RegExp(`library\\.${format}`)); }
    }
    assert.equal(reads, 3);
    assert.equal(writes, 0);
    const response = await fetch(`${base}/api/action`, { method: "POST", headers: { "x-dove-request": "1", "content-type": "application/json" }, body: JSON.stringify({ type: "syncPaperLibrary", root }) });
    assert.equal(response.status, 200);
    assert.equal(writes, 1);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test("host-migration settings preserve default-off display and save both switch values", async () => {
  const script = renderDashboardHtml({ canEdit: true }).split("<script>")[1].split("</script>")[0];
  const section = script.slice(script.indexOf("const lines = (v)"), script.indexOf("function setMode("));
  const elements = new Map();
  const byId = (id) => {
    if (!elements.has(id)) elements.set(id, { checked: false, addEventListener(event, fn) { this[event] = fn; } });
    return elements.get(id);
  };
  const view = { innerHTML: "", querySelectorAll: () => [] };
  const saves = [];
  const context = {
    settings: { watchGlobal: { dailyHour: 8, lookbackDays: 3 }, projects: [], registered: [], hostSettings: { hostMigration: false } },
    document: { getElementById: (id) => id === "view" ? view : byId(id) }, esc: String,
    loadSettings: async () => {}, toast: () => {}, act: async (type, body) => saves.push({ type, ...body })
  };
  vm.runInNewContext(`${section}\nrenderSettings();`, context);
  assert.ok(view.innerHTML.includes('id="hostMigration">'));
  assert.ok(!view.innerHTML.includes('id="hostMigration" checked'));
  for (const checked of [true, false]) {
    byId("hostMigration").checked = checked;
    await byId("hostSave").click({ currentTarget: byId("hostSave") });
    assert.equal(saves.at(-1).type, "saveHostSettings");
    assert.equal(saves.at(-1).settings.hostMigration, checked);
  }
  context.settings.hostSettings.hostMigration = true;
  vm.runInNewContext("renderSettings();", context);
  assert.ok(view.innerHTML.includes('id="hostMigration" checked'));
});

test("all dashboard script variants parse with the shared paper-card renderer", () => {
  for (const options of [{}, { canEdit: true }, { canEdit: true, canSignOut: true }]) {
    const script = renderDashboardHtml(options).split("<script>")[1].split("</script>")[0];
    assert.doesNotThrow(() => new Function(script));
    assert.ok(script.includes(renderPaperCard.toString()));
    assert.ok(script.includes('id="wSupplement"'));
    assert.ok(script.includes('supplementOlder: byId("wSupplement").checked'));
    assert.ok(script.includes('hostMigration: byId("hostMigration").checked'));
  }
});
