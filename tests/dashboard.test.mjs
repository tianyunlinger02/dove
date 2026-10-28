import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import vm from "node:vm";

import { collectDashboard, parseAuthor, parseMarkdownTables, readProjectDocument, summarizeProject } from "../src/core/dashboard-data.mjs";
import { createDashboardServer, renderDashboardHtml, startDashboardServer } from "../src/cli/dashboard-server.mjs";

function fixtureProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dove-dashboard-"));
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return root;
}

const researchFiles = {
  ".dove/research/IDENTITY.md": "Current round: rounds/002-brief.md\nRound status: ongoing\nMainline: 从四张图恢复完整服装结构\nCore capability: 从稀疏输入恢复完整结构并在未见类别上泛化\n",
  ".dove/research/EVAL.md": "# EVAL\n\n| 轮次 | 基线 | 未见类别 |\n|---|---:|---:|\n| 001 | 0.31 | 0.12 |\n| 002 | 0.31 | 0.18 |\n",
  ".dove/research/rounds/001-brief.md": "# 统一解码\nAuthor: 导师\n\n预测：未见类别 0.15\n",
  ".dove/research/rounds/001-result.md": "未见类别 0.12，低于预测。\n",
  ".dove/research/rounds/002-brief.md": "# 联合生成\n作者：用户\n"
};

test("summarizes identity, evaluation tables and rounds without writing", () => {
  const root = fixtureProject(researchFiles);
  const before = fs.readdirSync(path.join(root, ".dove/research/rounds")).sort();
  const project = summarizeProject(root);
  assert.equal(project.mainline, "从四张图恢复完整服装结构");
  assert.equal(project.currentRound, "rounds/002-brief.md");
  assert.equal(project.roundStatus, "ongoing");
  assert.deepEqual(project.evaluation.tables[0].header, ["轮次", "基线", "未见类别"]);
  assert.equal(project.evaluation.tables[0].rows.length, 2);
  assert.deepEqual(project.rounds.map((round) => [round.label, round.author, Boolean(round.result)]), [["002", "user", false], ["001", "mentor", true]]);
  assert.equal(project.rounds[1].title, "统一解码");
  assert.equal(project.rounds[1].brief.text, undefined);
  assert.match(readProjectDocument(root, "001-result.md").text, /低于预测/u);
  assert.equal(readProjectDocument(root, "../IDENTITY.md"), null);
  assert.match(readProjectDocument(root, "EVAL.md").text, /未见类别/u);
  assert.equal(project.evaluation.text, null);
  assert.deepEqual(fs.readdirSync(path.join(root, ".dove/research/rounds")).sort(), before);
});

test("project round targets preserve the concrete aim rather than a normalized dimension", () => {
  const target = "数据与评价——完整方法在真实全量数据和未见类别上的实际效果。";
  const brief = `# 联合生成\n对准：${target}\n见分晓：2026-10-30（开始：2026-10-28）\n规模：完整开发集。\n\n一句话：比较完整方法与外部方法。\n`;
  const root = fixtureProject({ ...researchFiles, ".dove/research/rounds/002-brief.md": brief });
  const project = summarizeProject(root, { now: new Date(2026, 9, 28) });
  assert.equal(project.rounds.find((round) => round.number === 2).brief.target, target);
  assert.equal(fs.readFileSync(path.join(root, ".dove/research/rounds/002-brief.md"), "utf8"), brief);
});

test("parses authors and markdown tables tolerantly", () => {
  assert.equal(parseAuthor("Author: external reviewer"), "external");
  assert.equal(parseAuthor("- **作者**：导师"), "mentor");
  assert.equal(parseAuthor("no author line"), null);
  assert.deepEqual(parseMarkdownTables("| a | b |\n| :- | -: |\n| 1 | 2 |\n\ntext\n| c |\n|---|\n"), [
    { header: ["a", "b"], rows: [["1", "2"]] },
    { header: ["c"], rows: [] }
  ]);
});

test("collect skips missing roots and projects without research records", () => {
  const withResearch = fixtureProject(researchFiles);
  const bare = fixtureProject({ "README.md": "x" });
  const result = collectDashboard({ projects: [withResearch, bare, path.join(bare, "missing")], packageVersion: "9.9.9" });
  assert.deepEqual(result.projects.map((project) => project.root), [withResearch]);
  assert.equal(result.version, "9.9.9");
});

test("server serves the page and read-only JSON", async () => {
  const root = fixtureProject(researchFiles);
  const server = await startDashboardServer({ collect: () => collectDashboard({ projects: [root] }), listRoots: () => [root], readDocument: readProjectDocument, port: 0 });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const page = await fetch(`${base}/`);
    assert.match(await page.text(), /Dove 科研面板/u);
    const api = await (await fetch(`${base}/api/dashboard`)).json();
    assert.equal(api.projects[0].name, path.basename(root));
    const brief = await (await fetch(`${base}/api/doc?project=${encodeURIComponent(root)}&name=001-brief.md`)).json();
    assert.match(brief.text, /预测：未见类别 0\.15/u);
    assert.equal((await fetch(`${base}/api/doc?project=${encodeURIComponent(root)}&name=../IDENTITY.md`)).status, 404);
    assert.equal((await fetch(`${base}/api/doc?project=%2Ftmp&name=001-brief.md`)).status, 404);
    assert.equal((await fetch(`${base}/api/dashboard`, { method: "POST" })).status, 405);
    assert.equal((await fetch(`${base}/nope`)).status, 404);
  } finally {
    server.close();
  }
  assert.ok(renderDashboardHtml().includes("/api/dashboard"));
});

test("with a password every page and API request needs the session cookie", async () => {
  const root = fixtureProject(researchFiles);
  const server = await startDashboardServer({ collect: () => collectDashboard({ projects: [root] }), listRoots: () => [root], readDocument: readProjectDocument, password: "s3cret-pass", port: 0 });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const login = await (await fetch(`${base}/`)).text();
    assert.match(login, /请输入访问密码/u);
    assert.doesNotMatch(login, /从四张图/u);
    assert.equal((await fetch(`${base}/api/dashboard`)).status, 401);
    assert.equal((await fetch(`${base}/api/doc?project=${encodeURIComponent(root)}&name=001-brief.md`)).status, 401);
    const post = (password) => fetch(`${base}/login`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ password }) });
    const wrong = await post("nope");
    assert.equal(wrong.headers.get("location"), "/?failed=1");
    assert.equal(wrong.headers.get("set-cookie"), null);
    const right = await post("s3cret-pass");
    const cookie = right.headers.get("set-cookie");
    assert.match(cookie, /^dove_dashboard=[^;]+; Path=\/; HttpOnly; SameSite=Strict/u);
    const headers = { cookie: cookie.split(";")[0] };
    assert.equal((await fetch(`${base}/api/dashboard`, { headers })).status, 200);
    assert.match(await (await fetch(`${base}/`, { headers })).text(), /action="\/logout"/u);
    assert.equal((await fetch(`${base}/api/dashboard`, { headers: { cookie: "dove_dashboard=forged" } })).status, 401);
  } finally {
    server.close();
  }
});

test("password changes trim before validation and keep the same session after restart", async () => {
  const request = (server, method, url, body = "", headers = {}) => new Promise((resolve) => {
    const input = Readable.from([Buffer.from(body)]);
    Object.assign(input, { method, url, headers, socket: {} });
    const response = {
      headers: {},
      writeHead(status, values = {}) { this.status = status; Object.assign(this.headers, values); return this; },
      end(text = "") { resolve({ status: this.status, headers: this.headers, text: String(text) }); }
    };
    server.emit("request", input, response);
  });
  let saved = null;
  const serverOptions = {
    collect: () => ({}), listRoots: () => [], readDocument: () => null,
    password: "synthetic-original",
    actions: { changePassword: (value) => { saved = value; } }
  };
  const server = createDashboardServer(serverOptions);
  const login = await request(server, "POST", "/login", new URLSearchParams({ password: serverOptions.password }).toString());
  const cookie = login.headers["set-cookie"].split(";")[0];
  const headers = { cookie, "x-dove-request": "1" };
  for (const password of ["        ", "  short  "]) {
    assert.equal((await request(server, "POST", "/api/action", JSON.stringify({ type: "changePassword", password }), headers)).status, 400);
    assert.equal(saved, null);
  }
  const changed = await request(server, "POST", "/api/action", JSON.stringify({ type: "changePassword", password: "  synthetic-new  \n" }), headers);
  assert.equal(changed.status, 200);
  assert.equal(saved, "synthetic-new");
  const nextCookie = changed.headers["set-cookie"].split(";")[0];
  assert.equal((await request(server, "GET", "/api/dashboard", "", { cookie })).status, 401);
  assert.equal((await request(server, "GET", "/api/dashboard", "", { cookie: nextCookie })).status, 200);
  const restarted = createDashboardServer({ ...serverOptions, password: saved.trim() });
  assert.equal((await request(restarted, "GET", "/api/dashboard", "", { cookie: nextCookie })).status, 200);
  const denied = createDashboardServer({ ...serverOptions, actions: { changePassword() { throw new Error("Synthetic write denied"); } } });
  assert.equal((await request(denied, "POST", "/api/action", JSON.stringify({ type: "changePassword", password: "synthetic-failed" }), headers)).status, 400);
  assert.equal((await request(denied, "GET", "/api/dashboard", "", { cookie })).status, 200);
});

test("page scripts parse in every mode", () => {
  for (const options of [{}, { canEdit: true }, { canEdit: true, canSignOut: true }]) {
    const html = renderDashboardHtml(options);
    assert.doesNotThrow(() => new Function(html.split("<script>")[1].split("</script>")[0]), JSON.stringify(options));
  }
});

test("project data keeps the latest intent after long notes and reads without mutation", () => {
  const note = `${"历史笔记。\n".repeat(12000)}\n## 长期意图（2026-10-15）\n要证明通用能力。\n### 指标\n未见数据。\n## 预测\n下一轮预测。`;
  const root = fixtureProject({ ...researchFiles, ".dove/research/MENTOR_NOTES.md": note });
  const project = summarizeProject(root, { now: new Date(2026, 9, 16) });
  assert.equal(project.coreCapability, "从稀疏输入恢复完整结构并在未见类别上泛化");
  assert.deepEqual(project.longTermIntent, { date: "2026-10-15", text: "要证明通用能力。\n### 指标\n未见数据。", due: false });
  assert.equal(fs.readFileSync(path.join(root, ".dove/research/MENTOR_NOTES.md"), "utf8"), note);
  assert.equal(readProjectDocument(root, "MENTOR_NOTES.md"), null, "notes are not exposed as arbitrary documents");
});

test("core capability is read with English or Chinese explanatory labels", () => {
  for (const label of ["Core capability", "Core capability（核心能力）", "Core capability (核心能力)", "核心能力"]) {
    const identity = `${label}: 学会通用能力而不是逐例修补\n`;
    const root = fixtureProject({ ".dove/research/IDENTITY.md": identity });
    assert.equal(summarizeProject(root).coreCapability, "学会通用能力而不是逐例修补", label);
    assert.equal(fs.readFileSync(path.join(root, ".dove/research/IDENTITY.md"), "utf8"), identity);
  }
});

test("project view renders capability and collapsed intent, preserves toggle state and escapes text", () => {
  const root = "/memory/project";
  const project = {
    root, name: "Project", mainline: "主线目标", coreCapability: "核心 <能力>", rounds: [],
    longTermIntent: { date: "2026-10-15", text: "真实目标 <script>alert(1)</script>", due: false }
  };
  const handlers = {};
  const detail = { dataset: { intent: root }, open: false, addEventListener: (event, fn) => { handlers[event] = fn; } };
  const view = { innerHTML: "", querySelectorAll: (selector) => selector === "details[data-intent]" ? [detail] : [] };
  const script = renderDashboardHtml().split("<script>")[1].split("</script>")[0];
  const section = script.slice(script.indexOf("function esc("), script.indexOf("const texts ="));
  const context = { document: { getElementById: () => view }, data: { projects: [project] }, selected: root, open: new Map(), CAN_EDIT: false, STATUS: {}, AUTHOR: {} };
  vm.runInNewContext(`${section}\nrenderView();`, context);
  assert.ok(view.innerHTML.indexOf("核心 &lt;能力&gt;") < view.innerHTML.indexOf("现在在做什么"));
  assert.match(view.innerHTML, /<details class="card" data-intent="\/memory\/project"><summary>长期意图 · 2026-10-15/u);
  assert.ok(view.innerHTML.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!view.innerHTML.includes("<script>"));
  detail.open = true;
  handlers.toggle();
  vm.runInNewContext("renderView();", context);
  assert.match(view.innerHTML, /data-intent="\/memory\/project" open>/u);
});

test("round summaries give the trajectory its goal, expected result and actual outcome", async () => {
  const { summarizeRoundText } = await import("../src/core/dashboard-data.mjs");
  const brief = "作者：导师\n方法版本：v2\n\n一句话：用 [全量数据](x.md) 检验 **新解码器** 是否减少漏报。\n\n## 预期结果\n- 漏报下降一半；没下降就换对应方法。\n\n## 细节\n略";
  assert.deepEqual(summarizeRoundText(brief, "brief"), { summary: "用 全量数据 检验 新解码器 是否减少漏报。", expected: "漏报下降一半；没下降就换对应方法。" });
  const result = "# 结果\nAuthor: mentor\n\n漏报从 30% 降到 18%。\n\n## 预期与实际\n| 项目 | 预测 | 实际 |\n|---|---|---|\n| 漏报 | 15% | 18% |\n\n## 改了什么\n解码器";
  assert.deepEqual(summarizeRoundText(result, "result"), { summary: "漏报从 30% 降到 18%。", actual: "漏报：15% → 18%；" });
});

const methodArguments = {
  problem: `${"官方真实开发集仍有漏报，原始结果见 results/dev.json。".repeat(20)}\n\n具体失败：稀疏输入下漏掉完整结构。`,
  externalMethods: "论文 A 的逐片段解码不能约束整体覆盖。\n真实开发集对照仍漏掉 18%，见 [原始结果](results/baseline.json)。",
  change: "联合生成完整结构，直接约束覆盖。\n\n#### 预期与成立、失败条件\n预期：真实开发集漏报下降。\n成立：漏报下降且完整结构准确率不退步。\n失败：漏报不降或准确率退步。"
};

function methodBrief(userReply = "") {
  return `# 联合生成\n\n## 方法设计\n### 要解决什么问题\n${methodArguments.problem}\n\n### 外部方法为什么不行\n${methodArguments.externalMethods}\n\n### 我们的改法为什么能修\n${methodArguments.change}\n${userReply ? `\n### 用户答复\n${userReply}\n` : ""}\n## 本轮安排\n只修评测。\n### 用户答复\n这不是方法设计中的用户答复。\n`;
}

test("method design reads the current brief reference without shortening arguments or inventing consent", () => {
  const userReply = "2026-10-22 · 出处：当前会话\n用户原话：我看过了，先别开工，我还有问题。";
  const identity = `${researchFiles[".dove/research/IDENTITY.md"]}Method design: rounds/002-brief.md\n`;
  const brief = methodBrief(userReply);
  const root = fixtureProject({ ...researchFiles, ".dove/research/IDENTITY.md": identity, ".dove/research/rounds/002-brief.md": brief });
  assert.deepEqual(summarizeProject(root).methodDesign, { source: "rounds/002-brief.md", ...methodArguments, userReply, missing: [] });
  assert.equal(fs.readFileSync(path.join(root, ".dove/research/IDENTITY.md"), "utf8"), identity);
  assert.equal(fs.readFileSync(path.join(root, ".dove/research/rounds/002-brief.md"), "utf8"), brief);
});

test("later repair and evaluation rounds keep the explicitly referenced method design", () => {
  const root = fixtureProject({
    ...researchFiles,
    ".dove/research/IDENTITY.md": "Current round: rounds/003-brief.md\nRound status: ongoing\nMethod design: rounds/002-brief.md\n",
    ".dove/research/rounds/002-brief.md": methodBrief(),
    ".dove/research/rounds/003-brief.md": "# 修复官方评测\n\n一句话：修复评分接口，不改方法。\n"
  });
  const project = summarizeProject(root);
  assert.equal(project.currentRound, "rounds/003-brief.md");
  assert.deepEqual(project.methodDesign, { source: "rounds/002-brief.md", ...methodArguments, userReply: null, missing: [] });
});

test("without a method reference only the current brief supplies a design, never an older card", () => {
  const root = fixtureProject({ ...researchFiles, ".dove/research/rounds/001-brief.md": methodBrief("旧方法的用户答复。") });
  assert.equal(summarizeProject(root).methodDesign, null);
  fs.writeFileSync(path.join(root, ".dove/research/rounds/002-brief.md"), methodBrief());
  assert.deepEqual(summarizeProject(root).methodDesign, { source: "rounds/002-brief.md", ...methodArguments, userReply: null, missing: [] });
});

test("method design reports a missing argument even when a user reply was recorded", () => {
  const root = fixtureProject({
    ...researchFiles,
    ".dove/research/rounds/002-brief.md": "## 方法设计\n### 要解决什么问题\n真实数据上的漏报。\n### 我们的改法为什么能修\n覆盖约束；预期漏报下降，否则失败。\n### 用户答复\n2026-10-22 · 当前会话：我还没看完。\n"
  });
  const design = summarizeProject(root).methodDesign;
  assert.equal(design.problem, "真实数据上的漏报。");
  assert.equal(design.externalMethods, null);
  assert.deepEqual(design.missing, ["外部方法为什么不行"]);
  assert.equal(design.userReply, "2026-10-22 · 当前会话：我还没看完。");
});

test("an explicit method reference must name a local round brief and never falls back to the current design", () => {
  const root = fixtureProject({ ...researchFiles, ".dove/research/rounds/002-brief.md": methodBrief() });
  for (const reference of ["rounds/002-result.md", "rounds/099-brief.md"]) {
    fs.writeFileSync(path.join(root, ".dove/research/IDENTITY.md"), `Current round: rounds/002-brief.md\nMethod design: ${reference}\n`);
    const design = summarizeProject(root).methodDesign;
    assert.equal(design.source, reference);
    assert.ok(design.error);
    assert.equal(design.problem, undefined);
  }
});

test("fenced examples do not create a method design or a user reply", () => {
  for (const fence of ["```", "~~~"]) {
    const example = `${fence}markdown\n## 方法设计\n### 要解决什么问题\n示例问题。\n### 外部方法为什么不行\n示例外部方法。\n### 我们的改法为什么能修\n示例改法。\n### 用户答复\n示例：已同意开工。\n${fence}`;
    const root = fixtureProject({ ...researchFiles, ".dove/research/rounds/002-brief.md": example });
    assert.equal(summarizeProject(root).methodDesign, null, "a fenced design is not a real design");
    const problem = `${methodArguments.problem}\n\n${example}\n围栏之后的问题依据。`;
    fs.writeFileSync(path.join(root, ".dove/research/rounds/002-brief.md"), methodBrief().replace(methodArguments.problem, problem));
    assert.deepEqual(summarizeProject(root).methodDesign, { source: "rounds/002-brief.md", ...methodArguments, problem, userReply: null, missing: [] }, "example headings remain original text, not user consent");
  }
});

test("method design is visible below the mainline, preserves lines, escapes text and shows gaps", () => {
  const root = "/memory/project";
  const project = {
    root, name: "Project", mainline: "主线目标", rounds: [],
    methodDesign: {
      source: 'rounds/002-brief.md"><img src=x onerror=alert(1)>',
      problem: "真实失败 <script>alert(1)</script>\n第二行问题。",
      externalMethods: "外部方法 <机制>\n第二行依据。",
      change: "我们的改法 & 预期\n成立条件与失败条件。",
      userReply: '2026-10-22 · 当前会话\n用户原话：“我没同意 <开工>。”',
      missing: []
    }
  };
  const view = { innerHTML: "", querySelectorAll: () => [] };
  const script = renderDashboardHtml().split("<script>")[1].split("</script>")[0];
  const section = script.slice(script.indexOf("function esc("), script.indexOf("const texts ="));
  const context = { document: { getElementById: () => view }, data: { projects: [project] }, selected: root, open: new Map(), CAN_EDIT: false, STATUS: {}, AUTHOR: {} };
  vm.runInNewContext(`${section}\nrenderView();`, context);
  assert.ok(view.innerHTML.indexOf('class="hero"') < view.innerHTML.indexOf("方法设计"));
  assert.ok(view.innerHTML.indexOf("方法设计") < view.innerHTML.indexOf("现在在做什么"));
  assert.ok(view.innerHTML.includes("真实失败 &lt;script&gt;alert(1)&lt;/script&gt;\n第二行问题。"));
  assert.ok(view.innerHTML.includes("外部方法 &lt;机制&gt;\n第二行依据。"));
  assert.ok(view.innerHTML.includes("我们的改法 &amp; 预期\n成立条件与失败条件。"));
  assert.ok(view.innerHTML.includes('原文来源：rounds/002-brief.md&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(view.innerHTML.includes("用户原话：“我没同意 &lt;开工&gt;。”"));
  assert.match(view.innerHTML, /只展示记录，不自动认定用户已同意/u);
  assert.doesNotMatch(view.innerHTML, /<script>|<img /u);
  project.methodDesign.externalMethods = null;
  project.methodDesign.userReply = null;
  project.methodDesign.missing = ["外部方法为什么不行"];
  vm.runInNewContext("renderView();", context);
  assert.match(view.innerHTML, /外部方法为什么不行<\/h3><div class="note">缺口：这一段还没写，论证不完整。/u);
  assert.match(view.innerHTML, /尚未记录用户看过后的答复/u);
});

test("project progress shows historical warnings without creating pending decisions", () => {
  const project = {
    rounds: [],
    progress: {
      mainMetric: null, trend: null, pending: [],
      overrun: { due: "2026-10-21", plannedDays: 1, daysPastDue: 5 },
      stall: { rounds: [1, 2] }
    }
  };
  const script = renderDashboardHtml().split("<script>")[1].split("</script>")[0];
  const section = script.slice(script.indexOf("function esc("), script.indexOf("const texts ="));
  const tile = script.slice(script.indexOf("function tile("), script.indexOf("\n", script.indexOf("function tile(")));
  const context = vm.createContext({ project });
  vm.runInContext(`${section}\n${tile}`, context);
  const render = () => vm.runInContext("progressSection(project)", context);
  let html = render();
  assert.match(html, /本轮原定 2026-10-21 见分晓/u);
  assert.match(html, /历史停滞信号：第 1、2 轮/u);
  assert.doesNotMatch(html, /class="card pending"/u, "historical signals alone create no decision list");
  project.progress.pending = [
    { kind: "method-design", text: "方法设计（rounds/003-brief.md）尚未记录书面答复（当前文件快照）。" },
    { kind: "mentor", text: "导师笔记快照：是否增加 <新数据>。" }
  ];
  html = render();
  assert.equal((html.match(/<li>/gu) ?? []).length, 2, "only the supplied record snapshots are pending");
  assert.ok(html.includes("rounds/003-brief.md"));
  assert.ok(html.includes("导师笔记快照：是否增加 &lt;新数据&gt;。"));
  assert.doesNotMatch(html, /<新数据>/u);
  assert.match(html, /历史停滞信号：第 1、2 轮/u, "pending records do not erase historical signals");
});

test("project view puts design, current work and evaluation before collapsed process history", () => {
  const root = "/memory/project";
  const row = (number, extra) => ({ number, duration: "5 小时", open: false, agents: 4, compactions: 1, mentor: 1, corrections: 2, verdictLabel: "未兑现", prediction: "F1 <10> → 12–14", actual: "F1 10.5", check: "CALIBRATION_DETAIL_NOT_SHOWN", flags: ["PREDICTION_FLAG_NOT_SHOWN"], calibration: { hit: false, ratio: 6, wrongWay: false }, provenance: { numbers: 5, found: 4, artifacts: 2 }, hedgesPer1k: 2.5, gates: 3, unrunClaims: 1, ...extra });
  const project = {
    root, name: "Project", mainline: "主线", coreCapability: "完整结构生成能力", currentRound: "rounds/003-brief.md",
    rounds: [{ number: 3, label: "003", title: "完整方法评测", brief: { file: "003-brief.md", summary: "全量评价完整方法", target: "数据与评价——完整方法的真实能力", expected: "完整结构质量提高" } }],
    methodDesign: { source: "rounds/003-brief.md", problem: "整体结构缺失", externalMethods: "局部方法无法覆盖", change: "联合生成完整结构", userReply: null },
    evaluation: { tables: [{ header: ["Version/round", "Measurements"], rows: [["v2", "F1 10.5"]] }] },
    progress: {
      mainMetric: null, overrun: null, stall: null, pending: [],
      trend: { rows: [{ date: "2026-10-25", round: "002", grades: { 创新: "C" }, bottleneck: "方法质量与可行性" }] },
      practice: [{ date: "2026-10-25", topic: "写稿和图", quote: "“查不出 <自己> 的行话”", next: "交付前做冷读" }],
      ledger: {
        rows: [row(3, { open: true, verdictLabel: null, actual: null }), row(2, {}), row(1, {})],
        activityScanned: true,
        summary: { finished: 2, correctionsPerRound: 2, text: "CALIBRATION_SUMMARY_NOT_SHOWN" }
      }
    }
  };
  const view = { innerHTML: "", querySelectorAll: () => [] };
  const script = renderDashboardHtml().split("<script>")[1].split("</script>")[0];
  const section = script.slice(script.indexOf("function esc("), script.indexOf("const texts ="));
  const context = { document: { getElementById: () => view }, data: { projects: [project] }, selected: root, open: new Map(), CAN_EDIT: false, STATUS: {}, AUTHOR: {}, lazyDoc: () => "" };
  const dims = script.slice(script.indexOf("const DIMS ="), script.indexOf("\n", script.indexOf("const DIMS =")));
  const tile = script.slice(script.indexOf("function tile("), script.indexOf("\n", script.indexOf("function tile(")));
  vm.runInNewContext(`${dims}\n${section}\n${tile}\nrenderView();`, context);
  const html = view.innerHTML;
  const positions = ['class="hero"', 'class="method-design"', 'class="now"', '<h2>评测结果 ', '<h2>进展 ', '<h2>科研轨迹 '].map((marker) => html.indexOf(marker));
  assert.ok(positions.every((position) => position >= 0));
  assert.ok(positions.every((position, index) => index === 0 || positions[index - 1] < position));
  const trend = html.match(/<details\b([^>]*)><summary>八维走势[\s\S]*?<\/details>/u);
  const ledger = html.match(/<details\b([^>]*)><summary>每轮的投入和结果[\s\S]*?<\/details>/u);
  assert.ok(trend && ledger, "both histories are details elements");
  assert.doesNotMatch(trend[1], /\bopen(?:\s|=|$)/u);
  assert.doesNotMatch(ledger[1], /\bopen(?:\s|=|$)/u);
  assert.equal((ledger[0].match(/<tbody>([\s\S]*?)<\/tbody>/u)[1].match(/<tr\b/gu) ?? []).length, 3, "one ledger row per round");
  assert.match(ledger[0], /第 3 轮（进行中）/u);
  assert.ok(ledger[0].includes("F1 &lt;10&gt; → 12–14"));
  assert.doesNotMatch(html, /CALIBRATION_DETAIL_NOT_SHOWN|PREDICTION_FLAG_NOT_SHOWN|CALIBRATION_SUMMARY_NOT_SHOWN/u);
  assert.ok(html.includes("数据与评价——完整方法的真实能力"));
  assert.ok(html.includes("2026-10-25 · 写稿和图：交付前做冷读"));
  assert.ok(html.includes("查不出 &lt;自己&gt; 的行话") && !html.includes("<自己>"));
  assert.ok(!html.includes("<10>"));
});

test("process history and placeholder metrics are omitted without material", () => {
  const script = renderDashboardHtml().split("<script>")[1].split("</script>")[0];
  const section = script.slice(script.indexOf("function esc("), script.indexOf("const texts ="));
  const project = { rounds: [], progress: { mainMetric: null, trend: null, pending: [], practice: [], ledger: { rows: [] } } };
  assert.equal(vm.runInNewContext(`${section}\nprogressSection(project);`, { project }), "");
});

test("unknown verdict chips preserve and escape the original wording", () => {
  const script = renderDashboardHtml().split("<script>")[1].split("</script>")[0];
  const section = script.slice(script.indexOf("function esc("), script.indexOf("const texts ="));
  for (const kind of [null, "unknown"]) {
    const html = vm.runInNewContext(`${section}\nverdictChip(kind, text);`, { kind, text: '部分兑现 <完整能力> & "继续"' });
    assert.equal(html, '<span class="chip other">部分兑现 &lt;完整能力&gt; &amp; &quot;继续&quot;</span>');
  }
});
